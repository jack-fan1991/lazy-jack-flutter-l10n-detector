import * as vscode from 'vscode';
import path = require('path');
import * as fs from 'fs';
import * as crypto from 'crypto';
// let counter = new OpenCloseFinder()
import * as changeCase from "change-case";
import { EzCodeActionProviderInterface } from './code_action';
import { getActivateEditor, getActivateText, getCursorLineText, getRootPath, getSelectedText, openEditor } from '../../utils/vscode/vscode';
import { APP } from '../../extension';
import { command_flutter_l10n_fix } from '../../command';
import { loadConfig, FlutterL10nDetectorConfig } from '../config/config_provider';

function generateLocalizationExtensionContent(className: string, importPath: string): string {
    return `import 'package:flutter/widgets.dart';
import '${importPath}';

extension LocalizationExtension on BuildContext {
  ${className} get l10n => ${className}.of(this)!;
}
`;
}

export class StringToL10nDetector implements EzCodeActionProviderInterface {


    getLangrageType() { return 'dart' }

    // 編輯時對單行檢測
    public provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] | undefined {
        let cursorLineText = getCursorLineText()
        let actions: vscode.CodeAction[] = []
        if (cursorLineText == undefined) return undefined

        let action2 = l18nFixAction()
        if (action2 != undefined) {
            actions.push(action2)
        }
        if (actions.length == 0) {
            return undefined
        } else {
            return actions
        }

    }



    setOnActionCommandCallback(context: vscode.ExtensionContext) {
        context.subscriptions.push(vscode.commands.registerCommand(command_flutter_l10n_fix, async (uri: vscode.Uri, range: vscode.Range) => {
            if (uri != undefined) {
                const editor = await vscode.window.showTextDocument(uri, { preview: false });
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            }
            l18nFix()
        }));
    }







}


const findWidgetClassRegex = /class\s+([a-zA-Z_][\w]*)\s*(<[\w\s<>,]*)?\s*extends\s+(?!State\b)[\w\s<>,]*/g;

function getAllClassNames(text: string): string[] {
    let matches;
    const classNames = [];
    while ((matches = findWidgetClassRegex.exec(text)) !== null) {
        classNames.push(matches[1]);
    }
    return classNames;
}


function l18nFixAction(): vscode.CodeAction | undefined {
    if (APP.l10nYaml == undefined) {
        return undefined;
    }

    let editor = getActivateEditor();
    let document = editor.document;
    let selection = editor.selection;

    // 獲取選取區域的前後位置
    const startPos = selection.start;
    const endPos = selection.end;

    // 檢查前後字元是否為引號
    const startChar = startPos.character > 0 ?
        document.getText(new vscode.Range(
            new vscode.Position(startPos.line, startPos.character - 1),
            startPos
        )) : '';

    const endChar = endPos.character < document.lineAt(endPos.line).text.length ?
        document.getText(new vscode.Range(
            endPos,
            new vscode.Position(endPos.line, endPos.character + 1)
        )) : '';

    // 確認前後字元是否匹配且為引號
    if (!((startChar === '"' && endChar === '"') || (startChar === "'" && endChar === "'"))) {
        return undefined;
    }

    let data = "🌐 Export String to l10n resource";
    const fix = new vscode.CodeAction(data, vscode.CodeActionKind.QuickFix);
    fix.command = { command: command_flutter_l10n_fix, title: data };
    fix.isPreferred = true;
    return fix;
}


// 添加检测字符串参数的函数
function detectParameters(text: string): string[] {
    const simpleParamRegex = /\$(\w+)/g; // 匹配 $param 形式
    const bracketParamRegex = /\$\{(\w+)\}/g; // 匹配 ${param} 形式

    const params = new Set<string>();
    let match;

    // 匹配 $param 形式
    while ((match = simpleParamRegex.exec(text)) !== null) {
        // 排除已经是 ${param} 形式的一部分
        const fullMatch = match[0];
        if (fullMatch.charAt(0) === '$' && fullMatch.charAt(1) !== '{') {
            params.add(match[1]);
        }
    }

    // 匹配 ${param} 形式
    while ((match = bracketParamRegex.exec(text)) !== null) {
        params.add(match[1]);
    }

    return Array.from(params);
}

/**
 * 依選取字串產生固定長度的快速選單鍵名片段
 * @param text 選取字串
 * @returns 最長 37 字元的鍵名片段
 */
function generateQuickPickSelectionKey(text: string): string {

    const normalized = changeCase.snakeCase(text ?? '');
    if (normalized.length<30) {
        return normalized;
    }
    const segments = normalized.split('_').filter(Boolean).slice(0, 4);
    let base = segments.join('_');

    if (base.length === 0) {
        base = normalized.slice(0, 30).replace(/_+$/, '');
        if (base.length > 0 && base.length <= 30) {
            return base;
        }
    }
    if (base.length > 30) {
        base = base.slice(0, 30);
    }
    base = base.replace(/_+$/, '');
    const hashSource = text ?? normalized;
    const hashSuffix = crypto.createHash('md5').update(hashSource).digest('hex').slice(0, 6);
    return base ? `${base}_${hashSuffix}` : hashSuffix;
}

/**
 * 將帶參數的字串轉換為 Flutter 多國語言範本
 * @param text 原始文字
 * @param key 多語系鍵名
 * @returns 處理後的多語系物件
 */
async function processL10nWithParams(text: string, key: string): Promise<{ [key: string]: any } | undefined> {
    // 擷取所有參數
    const params = detectParameters(text);

    if (params.length === 0) {
        // 沒有參數
        return {};
    }

    // 準備儲存參數型別的物件
    const placeholders: { [param: string]: { type: string } } = {};
    let processedText = text;

    // 為每個參數詢問型別
    for (const param of params) {
        const paramType = await vscode.window.showQuickPick(
            ['String', 'num'],
            { placeHolder: `選擇 "${param}" 的型別` }
        );

        if (!paramType) {
            return undefined; // 使用者取消選擇，中止處理
        }

        placeholders[param] = { type: paramType };

        // 將文字中的參數格式替換為 Flutter 的 {param} 格式
        processedText = processedText.replace(new RegExp(`\\$\\{${param}\\}|\\$${param}(?!\\w)`, 'g'), `{${param}}`);
    }

    return {
        [key]: processedText,
        [`@${key}`]: {
            placeholders
        }
    };
}
async function l18nFix() {
    const config = loadConfig();
    const {
        className,
        localizationsPath,
        outputPath,
        projectName,
        accessorPrefix,
        accessorImport
    } = config.localizationExtension;

    const rootPath = getRootPath();
    if (!rootPath) {
        vscode.window.showErrorMessage('Could not determine workspace root path.');
        return;
    }
    const effectiveAccessorPrefix = accessorPrefix.trim().length > 0 ? accessorPrefix.trim() : 'context.l10n';
    const accessorPrefixWithDot = effectiveAccessorPrefix.endsWith('.') ? effectiveAccessorPrefix : `${effectiveAccessorPrefix}.`;
    const isDefaultAccessor = effectiveAccessorPrefix === 'context.l10n';

    if (isDefaultAccessor) {
        const fullOutputPath = path.join(rootPath, outputPath);
        const outputDir = path.dirname(fullOutputPath);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        if (!fs.existsSync(fullOutputPath)) {
            const importPath = `package:${projectName}/${localizationsPath.replace('lib/', '')}`;
            const fileContent = generateLocalizationExtensionContent(className, importPath);
            fs.writeFileSync(fullOutputPath, fileContent, 'utf8');
            vscode.window.showInformationMessage(`Generated localization extension file at: ${outputPath}`);
        }
    }

    let text = getSelectedText();
    let root = getRootPath();
    let editor = getActivateEditor()
    let fileName = editor.document.fileName.split('/').pop();

    let targetPath = `${root}/lib/l10n`;
    // 讀取所有 lib/l18n/*.arb 檔案
    let files = fs.readdirSync(targetPath).filter(file => file.endsWith('.arb'));
    if (files.length === 0) {
        return undefined;
    }
    let fullText = getActivateText()
    let position = editor.document.offsetAt(editor.selection.start);

    // 向前搜尋最近的 class 名稱
    let nearestClassName = findNearestClassName(fullText, position);
    let nearestClassDescription = nearestClassName ? changeCase.snakeCase(nearestClassName) : '';
    if (nearestClassDescription.endsWith("_widget")) {
        nearestClassDescription = nearestClassDescription.replace("_widget", "")
    }
    let fileNameDescription = '';
    if (fileName) {
        fileNameDescription = changeCase.snakeCase(fileName.replace(".dart", ""));
        if (fileNameDescription.endsWith("_widget")) {
            fileNameDescription = fileNameDescription.replace("_widget", "");
        }
    }
    type L10nKeySource = {
        baseKey: string;
        description: string;
    };

    const nearestClassSource: L10nKeySource | undefined = nearestClassName ? {
        baseKey: nearestClassDescription,
        description: `Source: nearest class ${nearestClassName}`
    } : undefined;

    let firstKey = files[0];
    let firstFilePath = path.join(targetPath, firstKey);
    // 彈出選單或輸入框讓使用者選擇 key
    let totalContent = getActivateText()
    let classMatch = getAllClassNames(totalContent).filter(e => e !== undefined);
    const classSources: L10nKeySource[] = classMatch.map(key => {
        let baseKey = changeCase.snakeCase(key);
        if (baseKey.endsWith("_widget")) {
            baseKey = baseKey.replace("_widget", "");
        }
        return {
            baseKey,
            description: `Source: class ${key}`
        };
    }).filter(source => source.baseKey.length > 0);

    const fileSource: L10nKeySource | undefined = fileName && fileNameDescription ? {
        baseKey: fileNameDescription,
        description: `Source: file ${fileName}`
    } : undefined;

    const candidateSources = [
        nearestClassSource,
        ...classSources,
        fileSource
    ].filter((source): source is L10nKeySource => !!source && source.baseKey.length > 0);

    const seenBaseKeys = new Set<string>();
    const uniqueSources = candidateSources.filter(source => {
        if (seenBaseKeys.has(source.baseKey)) {
            return false;
        }
        seenBaseKeys.add(source.baseKey);
        return true;
    });

    const selectedTextRaw = getSelectedText() ?? '';
    const selectionKeyFragment = generateQuickPickSelectionKey(selectedTextRaw);
    const buildSuggestedKey = (baseKey: string): string => {
        if (!baseKey && !selectionKeyFragment) {
            return '';
        }
        if (!baseKey) {
            return selectionKeyFragment;
        }
        if (!selectionKeyFragment) {
            return baseKey;
        }
        return `${baseKey}_${selectionKeyFragment}`;
    };

    const quickPickItemsResult: vscode.QuickPickItem[] = [
        {
            label: '✨ Custom key...',
            description: 'Enter a custom localization key'
        },
        ...uniqueSources.map(source => {
            const suggestedKey = buildSuggestedKey(source.baseKey);
            return {
                label: suggestedKey,
                description: source.description
            };
        })
    ].filter(item => item.label.trim().length > 0);

    let selectedKey = await vscode.window.showQuickPick(quickPickItemsResult, { placeHolder: "Select or customize localization key" });
    if (selectedKey == undefined) return

    let outputKey = "";
    if (selectedKey.label.startsWith("✨")) {
        outputKey = "";
    } else {
        outputKey = selectedKey.label;
    }

    // 彈出輸入框讓使用者輸入 key
    let key = await vscode.window.showInputBox({ prompt: 'Enter localization key', value: outputKey });
    if (!key) {
        return undefined;
    }
    key = key.replace(`"`, "")
    key = key.replace(".dart", "")
    key = changeCase.snakeCase(key)

    let l10nObject = await processL10nWithParams(text, key as string);
    if (l10nObject == undefined) return
    const keyAccessExpression = `${accessorPrefixWithDot}${key as string}`;
    let newText = "";
    if (Object.keys(l10nObject).length === 0) {
        // 將選取的文字作為 value，並將 key-value 加入每個 .arb 檔案的末端
        files.forEach(file => {
            let filePath = path.join(targetPath, file);
            let content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            content[key as string] = text;
            let sortedObject = sortArbKeysObject(content);
            let jsonString = JSON.stringify(sortedObject, null, 2);
            fs.writeFileSync(filePath, jsonString, 'utf8');
        });
        newText = keyAccessExpression;
    } else {
        const paramsList = detectParameters(text).join(",");
        // 將選取的文字作為 value，並將 key-value 加入每個 .arb 檔案的末端
        files.forEach(file => {
            let filePath = path.join(targetPath, file);
            let content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            // 將所有 key-value 從 l10nObject 放進 content
            Object.entries(l10nObject!).forEach(([k, v]) => {
                content[k] = v;
            });
            let sortedObject = sortArbKeysObject(content);
            let jsonString = JSON.stringify(sortedObject, null, 2);

            fs.writeFileSync(filePath, jsonString, 'utf8');
        });
        newText = `${keyAccessExpression}(${paramsList})`;
    }

    const currentFileContent = editor.document.getText();
    const importStatements: string[] = [];
    if (isDefaultAccessor) {
        const extensionImportPath = `package:${projectName}/${outputPath.replace(/^lib\//, '')}`;
        const extensionImportStatement = `import '${extensionImportPath}';`;
        if (!currentFileContent.includes(extensionImportPath)) {
            importStatements.push(extensionImportStatement);
        }
    } else if (accessorImport.trim().length > 0) {
        const accessorImportStatement = `import '${accessorImport.trim()}';`;
        if (!currentFileContent.includes(accessorImport.trim())) {
            importStatements.push(accessorImportStatement);
        }
    }
    if (importStatements.length > 0) {
        await editor.edit(editBuilder => {
            const insertion = importStatements.map(statement => `${statement}\n`).join('');
            editBuilder.insert(new vscode.Position(0, 0), insertion);
        });
        await editor.document.save(); // Save after inserting import
    }

    runTerminal('flutter gen-l10n');


    // 替換選取範圍的文字為輸入的 key
    editor.edit(editBuilder => {
        let replaceSelect = editor.selection
        replaceSelect = new vscode.Selection(new vscode.Position(replaceSelect.start.line, replaceSelect.start.character - 1), new vscode.Position(replaceSelect.end.line, replaceSelect.end.character + 1))
        editBuilder.replace(replaceSelect, newText);
    });
    await editor.document.save();
    vscode.window.showInformationMessage(`View l10n file `, 'Gen-l10n', 'open file', 'Cancel',).then(async (option) => {
        if (option == 'open file') {
            openEditor(firstFilePath)
        }
        if (option == 'Gen-l10n') {
            runTerminal('flutter gen-l10n');
        }
    })

    // if (!totalContent.includes(`import 'package:${APP.flutterLibName}/main.dart';`)) {
    //     editor.edit(editBuilder => {
    //         editBuilder.insert(new vscode.Position(0, 0), `import 'package:${APP.flutterLibName}/main.dart';\n`);
    //     });
    // }
    await editor.document.save();

    // 定義正則表達式，匹配 "ASD", 'ASD', '''ASD'''
    const regex = new RegExp(`(['"]{1,3})${newText}\\1`, 'g')
    text = getActivateText()
    let match: RegExpExecArray | null;
    const edit = new vscode.WorkspaceEdit();
    while ((match = regex.exec(text)) !== null) {
        const startPos = editor.document.positionAt(match.index);
        const endPos = editor.document.positionAt(match.index + match[0].length);

        // 定義替換的內容
        const range = new vscode.Range(startPos, endPos);
        let t = editor.document.getText(new vscode.Range(startPos, endPos))
        edit.replace(editor.document.uri, range, newText);
        t = editor.document.getText(new vscode.Range(startPos, endPos))

    }

    // Apply the edit and save
    const editSuccess = await vscode.workspace.applyEdit(edit);
    if (editSuccess) {
        await editor.document.save();

    } else {
        throw new Error('Failed to apply edits');
    }

}

export function findNearestClassName(text: string, position: number): string {
    let classRegex = /class\s+(\w+)/g;
    let match;
    let lastMatch;
    while ((match = findWidgetClassRegex.exec(text)) !== null) {
        if (match.index < position) {
            lastMatch = match;
        } else {
            break;
        }
    }
    while ((match = classRegex.exec(text)) !== null) {
        if (match.index < position) {
            lastMatch = match;
        } else {
            break;
        }
    }
    return lastMatch ? lastMatch[1] : "";
}



export function sortArbKeysObject(
    arbObject: Record<string, any>
): Record<string, any> {
    // 所有 key
    const keys = Object.keys(arbObject);

    // 分類
    const atKeys = keys.filter(k => k.startsWith('@'));
    const normalKeys = keys.filter(k => !k.startsWith('@') && k !== 'appName');

    // 準備最終排序的 key 陣列
    const sortedKeys: string[] = [];

    // 先放 appName
    if (keys.includes('appName')) {
        sortedKeys.push('appName');
    }

    // 找出有對應 @key 的 normal key
    const matchedNormalKeys = new Set(atKeys.map(atKey => atKey.slice(1)));

    // 先加入沒有對應 @key 的 normal key（字母排序）
    const unmatchedNormalKeys = normalKeys
        .filter(key => !matchedNormalKeys.has(key))
        .sort((a, b) => a.localeCompare(b));
    sortedKeys.push(...unmatchedNormalKeys);

    // 最後處理 @key 與其對應的 normal key
    atKeys.sort((a, b) => a.localeCompare(b)).forEach(atKey => {
        const matchingKey = atKey.slice(1);
        if (normalKeys.includes(matchingKey)) {
            sortedKeys.push(matchingKey, atKey);
        } else {
            sortedKeys.push(atKey);
        }
    });

    // 依排序結果建立新物件
    const sortedObject: Record<string, any> = {};
    sortedKeys.forEach(key => {
        sortedObject[key] = arbObject[key];
    });

    return sortedObject;
}


function findTerminalAndActivate(name: string): vscode.Terminal {
    const terminal = vscode.window.terminals.find(t => t.name == name);
    if (terminal) {
        terminal.show();
        return terminal;
    }
    else {
        const newTerminal = vscode.window.createTerminal(name);
        newTerminal.show();
        return newTerminal;
    }
}


export function runTerminal(cmd: string, terminalName: string = "", enter: boolean = false): vscode.Terminal {
    vscode.window.showInformationMessage('Run ' + cmd + '');
    terminalName = 'L10n fix ' + terminalName
    let terminal = findTerminalAndActivate(terminalName)
    terminal.sendText(cmd);
    if (enter) {
        terminal.sendText('\r');
    }
    return terminal;
}
