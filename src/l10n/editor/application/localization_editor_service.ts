import { LocalizationBundle, LocalizationPlaceholders } from '../domain/localization_models';
import { LocalizationRepository } from '../domain/localization_repository';

export interface LocalizationSaveFilePayload {
  locale: string;
  values: Record<string, string>;
}

export interface LocalizationSavePayload {
  files: LocalizationSaveFilePayload[];
  placeholders: LocalizationPlaceholders;
}

export class LocalizationEditorService {
  constructor(private readonly repository: LocalizationRepository) {}

  /** 載入目前專案可編輯的語系資料 */
  async loadBundle(): Promise<LocalizationBundle> {
    return this.repository.loadBundle();
  }

  /**
   * 依前端回傳結果更新所有語系檔案並重新讀取，
   * 確保後續狀態與磁碟內容同步。
   */
  async saveBundle(bundle: LocalizationBundle, payload: LocalizationSavePayload): Promise<LocalizationBundle> {
    const fileMap = new Map(bundle.files.map(file => [file.locale, file]));

    for (const filePayload of payload.files) {
      const target = fileMap.get(filePayload.locale);
      if (!target) {
        continue;
      }
      target.values = filePayload.values;
    }

    bundle.placeholders = payload.placeholders ?? {};

    await this.repository.saveBundle(bundle);
    return this.repository.loadBundle();
  }
}
