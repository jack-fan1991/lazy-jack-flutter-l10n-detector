export interface LocalizationFile {
  /** 語系代碼，例如 en、zh-TW */
  locale: string;
  /** 對應檔案完整路徑 */
  filePath: string;
  /** ARB 內所有純字串鍵值 */
  values: Record<string, string>;
  /** 保留原始內容以便回寫時帶入描述與其他欄位 */
  raw: Record<string, unknown>;
}

export interface PlaceholderEntry {
  type?: string;
  [key: string]: unknown;
}

export type LocalizationPlaceholders = Record<string, Record<string, PlaceholderEntry>>;

export interface LocalizationBundle {
  /** `lib/l10n` 實際存在的絕對路徑 */
  directory: string;
  /** 所有語系檔案 */
  files: LocalizationFile[];
  /** 每個 key 的 Placeholder 設定 */
  placeholders: LocalizationPlaceholders;
}
