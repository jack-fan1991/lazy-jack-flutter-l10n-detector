import * as vscode from 'vscode';
import { logError } from '../logger/logger';
import path = require("path");
import * as fs from 'fs';
import * as yaml from "yaml";
export function getCursorLineText() {
    let editor = vscode.window.activeTextEditor
    if (!editor) {
        logError(`[No active editor]=> getCursorLineText`, false)
        return
    }
    const position = editor.selection.active;
    return editor.document.lineAt(position.line).text
}

export function getSelectedText() {
    let editor = vscode.window.activeTextEditor
    if (!editor)
        throw new Error('No active editor');
    let selection = editor.selection
    let text = editor.document.getText(selection)
    return text
}

export function getRootPath() {
    let path = getWorkspacePath('')
    return convertPathIfWindow(path!);
}

export function getActivateEditor(): vscode.TextEditor {
    let editor = vscode.window.activeTextEditor
    if (!editor)
        throw new Error('No active editor');
    return editor
}

export function getWorkspacePath(fileName: string): string | undefined {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        let filePath = path.join(
            `${vscode.workspace.workspaceFolders[0].uri.path}`,
            fileName
        );
        return convertPathIfWindow(filePath);
    }
}
export function isWindows(): boolean {
    return process.platform.startsWith('win');
}


export function convertPathIfWindow(path: string): string {
    try {
        if (isWindows()) {
            if (path.startsWith('\\')) {
                path = path.substring(1)
            }
            return path.replace(/\\/g, '/')
        }
        else {
            return path
        }
    }
    catch (e) {
        logError(e, false)
        return ''

    }
}

export function getActivateText(range: vscode.Range | undefined = undefined) {
    let editor = vscode.window.activeTextEditor
    if (!editor)
        throw new Error('No active editor');
    if (range != null) {
        return editor.document.getText(range)
    }
    let text = editor.document.getText()
    return text
}
export async function openEditor(filePath: string, focus?: boolean): Promise<vscode.TextEditor | undefined> {
    filePath = vscode.Uri.parse(filePath).fsPath
    filePath = convertPathIfWindow(filePath)
    if (!fs.existsSync(filePath)) return
    let editor = vscode.window.visibleTextEditors.find(e => convertPathIfWindow(e.document.fileName) === filePath)
    if (!editor) {
        await vscode.workspace.openTextDocument(filePath).then(async (document) =>
            editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside, focus ?? false).then(editor => editor))
    }
    return editor
}
export function getPubspecLockPath(): string | undefined {
    return getWorkspacePath("pubspec.lock");
}

export async function getYAMLFileContent(path: string | undefined): Promise<Record<string, any> | undefined> {
    try {
        if (path == undefined) throw new Error("path is undefined");
        //   logInfo(`正在解析 ${path}`,true)
        const fileContents = fs.readFileSync(path, 'utf-8');
        return yaml.parse(fileContents);
    } catch (e) {
        logError(`getYAMLFileContent ${e}`, false)
    }

}

export async function getPubspecLockAsMap(): Promise<Record<string, any> | undefined> {
    const pubspecLockPath = getPubspecLockPath();
    return getYAMLFileContent(pubspecLockPath);
}

export function getPackageJsonPath(): string | undefined {
  return getWorkspacePath("package.json");
}

export async function getPackageJsonAsMap(): Promise<Record<string, any> | undefined> {
    const packageJson = getPackageJsonPath();
    return getYAMLFileContent(packageJson);
  }

const PUBSPEC_FILE_NAME = "pubspec.yaml";
const PUBSPEC_LOCK_FILE_NAME = "pubspec.lock";

export function isFlutterProject (){
  return  getPubspecPath()!= null
}

export function getPubspecPath(): string | undefined {
  return getWorkspacePath(PUBSPEC_FILE_NAME);
}