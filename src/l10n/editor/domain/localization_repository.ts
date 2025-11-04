import { LocalizationBundle } from './localization_models';

export interface LocalizationRepository {
  /** 讀取 `lib/l10n` 下的所有語系檔案 */
  loadBundle(): Promise<LocalizationBundle>;
  /** 將編輯後的語系檔案統一寫回磁碟 */
  saveBundle(bundle: LocalizationBundle): Promise<void>;
}
