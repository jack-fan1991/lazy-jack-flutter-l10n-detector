import * as vscode from 'vscode';


export interface EzCodeActionProviderInterface extends vscode.CodeActionProvider {
    setOnActionCommandCallback(context: vscode.ExtensionContext): void
    getLangrageType(): vscode.DocumentSelector

}