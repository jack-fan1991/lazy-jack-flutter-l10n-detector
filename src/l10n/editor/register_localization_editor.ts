import * as vscode from 'vscode';
import { command_flutter_l10n_editor } from '../../command';
import { LocalizationEditorService } from './application/localization_editor_service';
import { FileSystemLocalizationRepository } from './infrastructure/file_system_localization_repository';
import { LocalizationEditorPanel } from './presentation/localization_editor_panel';

export function registerLocalizationEditorCommand(context: vscode.ExtensionContext) {
  const repository = new FileSystemLocalizationRepository();
  const service = new LocalizationEditorService(repository);

  const command = vscode.commands.registerCommand(command_flutter_l10n_editor, () => {
    try {
      LocalizationEditorPanel.createOrShow(service);
    } catch (error) {
      vscode.window.showErrorMessage(`啟動語系編輯器失敗: ${(error as Error).message}`);
    }
  });

  context.subscriptions.push(command);
}
