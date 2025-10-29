import * as vscode from 'vscode';
import { command_flutter_l10n_fix } from '../command';




export class DartL10nCodeLensProvider implements vscode.CodeLensProvider {
    static enable: boolean = false;

    onDidChangeCodeLenses?: vscode.Event<void> | undefined;
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        if (!DartL10nCodeLensProvider.enable) return [];
        const codeLenses: vscode.CodeLens[] = [];
        const lines = document.getText().split('\n');

        lines.forEach((line, lineIndex) => {
            if (line.trim().startsWith('part') || line.trim().startsWith(`import`) || line.trim().startsWith(`export`) || line.trim() === "") return;
            let cleanLine = line.replace(/\s+/g, '');
            let isLog = cleanLine.startsWith('log') || cleanLine.startsWith('_log') || cleanLine.includes("Logger(");
            let isPrint = cleanLine.startsWith('print');
            let skip = cleanLine.startsWith("/@") || line.includes("@JsonKey(name:") || line.includes("@Default(") || line.includes("RegExp(") || cleanLine.includes("case") || cleanLine.startsWith("//");
            if (isLog || isPrint || skip) {
                return
            }
            let regex = /(["'])(?:(?!\1).)*?\1/g;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(line)) !== null) {
                const fullMatch = match[0];
                const innerText = fullMatch.slice(1, -1);
                const colStart = match.index;
                const colEnd = match.index + fullMatch.length;
                let cleanInnerText = innerText.replace(/\s+/g, '');
                if (cleanInnerText === "" || cleanInnerText.startsWith(`/`)) return
                if (!this.isTranslated(innerText)) {
                    const start = new vscode.Position(lineIndex, match.index + 1);
                    const end = new vscode.Position(lineIndex, (match.index + fullMatch.length) - 1);
                    const range = new vscode.Range(start, end);
                    const displayLabel = innerText.length > 20 ? innerText.slice(0, 20) + '...' : innerText;
                    codeLenses.push(new vscode.CodeLens(range, {
                        title: `🔧 Fix「 ${displayLabel} 」to l10n`,
                        command:command_flutter_l10n_fix,
                        arguments: [document.uri, range, innerText]
                    }));
                }
            }
        });

        return codeLenses;
    }

    private isTranslated(text: string): boolean {
        return text.includes(".l10n")
    }
}

// vscode.commands.registerCommand('dart-i18n.fixString', (uri: vscode.Uri, range: vscode.Range, original: string) => {
//     const edit = new vscode.WorkspaceEdit();
//     edit.replace(uri, range, `t(${JSON.stringify(original)})`);
//     vscode.workspace.applyEdit(edit);
// });

export function registerDartL10nStringFix(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { language: 'dart' },
            dartL10nCodeLensProvider
        )
    );
}
export const dartL10nCodeLensProvider = new DartL10nCodeLensProvider()

