import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { LocalizationBundle, LocalizationFile, LocalizationPlaceholders, PlaceholderEntry } from '../domain/localization_models';
import { LocalizationRepository } from '../domain/localization_repository';
import { getWorkspacePath } from '../../../utils/vscode/vscode';
import { logError } from '../../../utils/logger/logger';
import { sortArbKeysObject } from '../../arb_file_listener';

export class FileSystemLocalizationRepository implements LocalizationRepository {
  async loadBundle(): Promise<LocalizationBundle> {
    const directory = getWorkspacePath('lib/l10n');
    if (!directory) {
      throw new Error('找不到工作區根目錄');
    }
    if (!fs.existsSync(directory)) {
      throw new Error('專案未建立 lib/l10n 目錄');
    }

    const files = await fsPromises.readdir(directory);
    const arbFiles = files.filter(file => file.endsWith('.arb'));

    if (arbFiles.length === 0) {
      throw new Error('lib/l10n 內沒有任何 ARB 語系檔案');
    }

    const localizationFiles: LocalizationFile[] = [];
    for (const fileName of arbFiles) {
      const fullPath = path.join(directory, fileName);
      const fileContent = await fsPromises.readFile(fullPath, 'utf8');
      const rawObject = JSON.parse(fileContent) as Record<string, unknown>;

      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(rawObject)) {
        if (!key.startsWith('@') && typeof value === 'string') {
          values[key] = value;
        }
      }

      localizationFiles.push({
        locale: this.extractLocale(fileName),
        filePath: fullPath,
        values,
        raw: rawObject,
      });
    }

    return {
      directory,
      files: localizationFiles,
      placeholders: this.buildPlaceholders(localizationFiles),
    };
  }

  async saveBundle(bundle: LocalizationBundle): Promise<void> {
    for (const file of bundle.files) {
      try {
        const updatedRaw: Record<string, unknown> = { ...file.raw };
        for (const [key, value] of Object.entries(file.values)) {
          updatedRaw[key] = value;
          this.applyPlaceholdersToRaw(updatedRaw, key, bundle.placeholders?.[key]);
        }

        const sortedObject = sortArbKeysObject(updatedRaw);
        const serialized = JSON.stringify(sortedObject, null, 2);
        await fsPromises.writeFile(file.filePath, serialized, 'utf8');
        file.raw = sortedObject;
      } catch (error) {
        logError(`寫入 ${file.filePath} 失敗: ${error}`, true);
        throw error;
      }
    }
  }

  private extractLocale(fileName: string): string {
    const baseName = path.basename(fileName, '.arb');
    const underscoreIndex = baseName.indexOf('_');
    if (underscoreIndex === -1) {
      return baseName;
    }
    return baseName.substring(underscoreIndex + 1);
  }

  private buildPlaceholders(files: LocalizationFile[]): LocalizationPlaceholders {
    const placeholders: LocalizationPlaceholders = {};
    for (const file of files) {
      for (const [key, value] of Object.entries(file.raw)) {
        if (!key.startsWith('@')) continue;
        const targetKey = key.substring(1);
        if (!value || typeof value !== 'object') continue;
        const placeholderSection = (value as Record<string, unknown>).placeholders as Record<string, PlaceholderEntry> | undefined;
        if (!placeholderSection) continue;
        if (!placeholders[targetKey]) {
          placeholders[targetKey] = {};
        }
        for (const [name, entry] of Object.entries(placeholderSection)) {
          if (!placeholders[targetKey][name]) {
            placeholders[targetKey][name] = { ...(entry ?? {}) };
          }
        }
      }
    }
    return placeholders;
  }

  private applyPlaceholdersToRaw(raw: Record<string, unknown>, key: string, placeholders: Record<string, PlaceholderEntry> | undefined) {
    const metaKey = `@${key}`;
    const meta = this.cloneRecord(raw[metaKey]);

    if (!placeholders || Object.keys(placeholders).length === 0) {
      if (meta) {
        delete meta.placeholders;
        if (Object.keys(meta).length === 0) {
          delete raw[metaKey];
        } else {
          raw[metaKey] = meta;
        }
      }
      return;
    }

    const updatedMeta = meta ?? {};
    const normalizedPlaceholders: Record<string, PlaceholderEntry> = {};
    for (const [name, entry] of Object.entries(placeholders)) {
      normalizedPlaceholders[name] = { ...(entry ?? {}) };
    }
    updatedMeta.placeholders = normalizedPlaceholders;
    raw[metaKey] = updatedMeta;
  }

  private cloneRecord(value: unknown): Record<string, any> | undefined {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    return { ...(value as Record<string, any>) };
  }
}
