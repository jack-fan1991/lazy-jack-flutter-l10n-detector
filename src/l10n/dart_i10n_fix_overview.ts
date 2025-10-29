import * as vscode from 'vscode';
import { DartL10nCodeLensProvider } from './flutter_l10n_fix';
import { showInfo } from '../utils/logger/logger';



class DartFileItem extends vscode.TreeItem {
    constructor(
        public readonly uri: vscode.Uri,
        public readonly line: number,
        public readonly colStart: number,
        public readonly colEnd: number,
        public readonly foundString: string,
        public readonly lineContent: string,
    ) {
        super(vscode.workspace.asRelativePath(uri.fsPath), vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'dartFileItem';
        this.description = `"${foundString.trim()}"`;
        this.tooltip = `Found string: "${foundString.trim()}"\nIn line: "${lineContent}"`;
        this.command = {
            command: 'dartL10n.openFileAndReveal',
            title: 'Open and Reveal',
            arguments: [this]
        };
        this.resourceUri = uri;
    }
}

export class DartFileTreeProvider implements vscode.TreeDataProvider<DartFileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private items: DartFileItem[] = [];
    public ignoredFiles = new Set<string>();
    public ignoredDir = new Set<string>();
    public filterDir: string = "";
    refresh() {
        if (DartL10nCodeLensProvider.enable == false) {
            showInfo("Enable l10n helper")
        }
        DartL10nCodeLensProvider.enable = true
        this.scanDartFiles();
        this._onDidChangeTreeData.fire();
    }

    disable() {
        DartL10nCodeLensProvider.enable = false
        // show toast
        showInfo("Disable l10n helper")
        this.items = [];
        this._onDidChangeTreeData.fire();
    }

    setFilterDir(dir: string) {
        this.filterDir = dir;
        this.scanDartFiles();
        this._onDidChangeTreeData.fire();
    }

    ignoreAndRefresh(itemToIgnore: DartFileItem) {
        if (itemToIgnore.description === 'CurrentDir') {
            const dirPath = itemToIgnore.uri.fsPath;
            this.ignoredDir.add(dirPath);
            this.items = this.items.filter(item => !item.uri.fsPath.startsWith(dirPath));
        } else {
            const filePath = itemToIgnore.uri.fsPath;
            this.ignoredFiles.add(filePath);
            this.items = this.items.filter(item => item.uri.fsPath !== filePath);
        }
        this._onDidChangeTreeData.fire();
    }


    getTreeItem(element: DartFileItem): vscode.TreeItem {
        return element;
    }

    getChildren(): vscode.ProviderResult<DartFileItem[]> {
        return this.items;
    }

    private async scanDartFiles() {
        this.items = []
        // 忽略filterDir
        if (this.ignoredDir.has(this.filterDir) || this.ignoredDir.has(`/${this.filterDir}`)) {
            this._onDidChangeTreeData.fire();
            return
        }
        // 顯示現在目錄
        if (this.filterDir) {
            const dirItem = new DartFileItem(
                vscode.Uri.file(this.filterDir),
                0,
                0,
                0,
                "",
                "",
            );
            dirItem.contextValue = 'dartFileItem';
            dirItem.description = 'CurrentDir';
            dirItem.iconPath = new vscode.ThemeIcon('folder');
            dirItem.command = undefined;
            this.items.push(dirItem);
        }

        const pattern = this.filterDir != "" ? `${this.filterDir}/**/*.dart` : 'lib/**/*.dart';
        const files = await vscode.workspace.findFiles(pattern);
        const validFiles = files.filter(uri => {
            const name = uri.path.split('/').pop() || '';
            const dotCount = (name.match(/\./g) || []).length;
            return dotCount <= 1;
        });
        for (const uri of validFiles) {
            if (fileTreeProvider.ignoredFiles.has(uri.fsPath)) continue
            const doc = await vscode.workspace.openTextDocument(uri);
            const text = doc.getText();
            const lines = text.split('\n');

            lines.forEach((line, lineIndex) => {
                if (line.trim().startsWith('part') || line.trim().startsWith(`import`) || line.trim().startsWith(`export`) || line.trim() === "") return;
                // 移除所有空格
                let cleanLine = line.replace(/\s+/g, '');
                let isLog = cleanLine.startsWith('log') || cleanLine.startsWith('_log') || cleanLine.includes("Logger(");
                let isPrint = cleanLine.startsWith('print');
                let isComment = cleanLine.startsWith("//");
                let skip = cleanLine.startsWith("/@") || line.includes("@JsonKey(name:") || line.includes("@Default(") || line.includes("RegExp(") || cleanLine.includes("case")

                if (isLog || isPrint || isComment || skip) {
                    return
                }
                // let regex = /(["'])(?:(?!\1).)*?\1/g;
                let match: RegExpExecArray | null;
                let regex = /(["'])(?:(?!\1).)*?\1/g;
                while ((match = regex.exec(line)) !== null) {
                    const fullMatch = match[0];
                    const innerText = fullMatch.slice(1, -1);
                    let cleanInnerText = innerText.replace(/\s+/g, '');
                    const isRouteName = innerText.startsWith('/');
                    if (cleanInnerText === "" || isRouteName) return;
                    const colStart = match.index;
                    const colEnd = match.index + fullMatch.length;
                    const isPreFixOtherPattern = [`Key(`, `DateFormat(`, `fontFamily: `];
                    const isEndFixOtherPattern = [` =>`, `:`];
                    for (let pattern of isPreFixOtherPattern) {
                        let len = pattern.length
                        let contextStart = Math.max(0, colStart - len);
                        let beforeString = line.substring(contextStart, colStart);
                        if (beforeString == pattern) {
                            return
                        }
                    }
                    for (let pattern of isEndFixOtherPattern) {
                        let len = pattern.length
                        let contextEnd = Math.max(0, colEnd + len);
                        let endString = line.substring(colEnd, contextEnd);
                        if (endString == pattern) {
                            return
                        }

                    }
                    let isDuplicate = false;
                    this.items.forEach(item => {
                        if (item.uri.fsPath === uri.fsPath) {
                            isDuplicate = true;
                        }
                    });
                    if (isDuplicate) return;
                    let item = new DartFileItem(uri, lineIndex, colStart + 1, colEnd - 1, innerText, line.trim());
                    item.iconPath = new vscode.ThemeIcon('file-text');
                    this.items.push(item);


                }
            });

        }
        this.items.sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath));
        this._onDidChangeTreeData.fire();
    }
}

const fileTreeProvider = new DartFileTreeProvider();

export function registerDartL10nOverViewTreeProvider(context: vscode.ExtensionContext) {
    vscode.window.registerTreeDataProvider('dartL10nFixViewAllFiles', fileTreeProvider);
    vscode.commands.registerCommand('dartL10n.refresh', () => {
        fileTreeProvider.refresh();
    });

    vscode.commands.registerCommand('dartL10n.openFileAndReveal', async (item: DartFileItem) => {
        const doc = await vscode.workspace.openTextDocument(item.uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: false });

        const startPos = new vscode.Position(item.line, item.colStart);
        const endPos = new vscode.Position(item.line, item.colEnd);
        editor.selection = new vscode.Selection(startPos, endPos);
        editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
    });


    vscode.commands.registerCommand('dartL10n.ignoreFile', (item: DartFileItem) => {
        fileTreeProvider.ignoreAndRefresh(item);
        const relativePath = vscode.workspace.asRelativePath(item.uri);
        vscode.window.showInformationMessage(`✅ Ignored: ${relativePath}. It will be excluded from future scans.`);
    });

    vscode.commands.registerCommand('dartL10n.clean', (item: DartFileItem) => {
        fileTreeProvider.ignoredFiles.clear();
        fileTreeProvider.ignoredDir.clear();
        fileTreeProvider.filterDir = "";
        vscode.window.showInformationMessage('🧹 All filters and ignore lists have been cleared.');
        fileTreeProvider.refresh();
    });

    vscode.commands.registerCommand('dartL10n.clean.items', (item: DartFileItem) => {
        fileTreeProvider.ignoredFiles.clear();
        vscode.window.showInformationMessage('🧹 All filters and ignore lists have been cleared.');
        fileTreeProvider.refresh();
    });

    vscode.commands.registerCommand('dartL10n.disable', (item: DartFileItem) => {
        fileTreeProvider.disable()
    });

    vscode.commands.registerCommand('dartL10n.filterDir', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const libUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'lib');
        try {
            await vscode.workspace.fs.stat(libUri);

            let activeFileDirOption: (vscode.QuickPickItem & { isEntryPoint?: boolean }) | undefined;
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
                if (relativePath.startsWith('lib/')) {
                    const dirName = relativePath.substring(0, relativePath.lastIndexOf('/'));
                    if (dirName) {
                        activeFileDirOption = {
                            label: `$(file-directory) Scan Active File's Directory`,
                            description: `/${dirName}`,
                            isEntryPoint: true,
                        };
                    }
                }
            }

            let currentPath = fileTreeProvider.filterDir || 'lib';
            let keepSelecting = true;
            let isFirstTime = true;

            while (keepSelecting) {
                const currentUri = vscode.Uri.joinPath(workspaceFolders[0].uri, currentPath);
                const dirs = await vscode.workspace.fs.readDirectory(currentUri);
                const subDirs = dirs
                    .filter(([, type]) => type === vscode.FileType.Directory)
                    .map(([name]) => name)
                    .filter(name => !isDirIgnored(name, fileTreeProvider.ignoredDir));

                const options: (vscode.QuickPickItem & { isEntryPoint?: boolean })[] = [];

                if (isFirstTime && activeFileDirOption) {
                    options.push(activeFileDirOption);
                }
                isFirstTime = false;

                options.push(
                    { label: `$(sync) Scan strings in`, description: currentPath },
                    { label: `$(trash) Ignore Directory`, description: currentPath }
                );

                if (currentPath !== 'lib') {
                    options.push({ label: '$(arrow-left) Back to Parent Directory', description: '$(file-directory) Back to parent directory' });
                    options.push({ label: '$(refresh) Reset to /lib', description: 'Reset scan directory to lib' });
                }

                options.push(...subDirs.map(dir => ({
                    label: `$(sign-in) ${dir}`,
                    description: `Enter directory: ${currentPath}/${dir}`
                })));

                const selected = await vscode.window.showQuickPick(options, {
                    placeHolder: `Current path: /${currentPath}`,
                    canPickMany: false
                });

                if (!selected) {
                    return; // User cancelled selection
                }

                if (selected.isEntryPoint) {
                    fileTreeProvider.filterDir = activeFileDirOption!.description!.replace('Scan strings in: ', '');
                    keepSelecting = false;
                } else if (selected.label === `$(sync) Scan strings in`) {
                    fileTreeProvider.filterDir = currentPath;
                    keepSelecting = false;
                } else if (selected.label === '$(arrow-left) Back to Parent Directory') {
                    const parent = currentPath.split('/').slice(0, -1).join('/');
                    currentPath = parent ? parent : 'lib';
                } else if (selected.label === '$(refresh) Reset to /lib') {
                    currentPath = 'lib';
                } else if (selected.label === `$(trash) Ignore Directory`) {
                    fileTreeProvider.ignoredDir.add(selected.description!);
                    const parent = currentPath.split('/').slice(0, -1).join('/');
                    currentPath = parent ? parent : 'lib';
                } else {
                    currentPath = selected.description!.replace('Enter directory: ', '');
                }
            }

            if (fileTreeProvider.filterDir) {
                vscode.window.showInformationMessage(`🔍 Now scanning for strings only in: ${fileTreeProvider.filterDir}`);
                fileTreeProvider.refresh();
            }
        } catch (error) {
            vscode.window.showErrorMessage('Error accessing lib directory. Please make sure a "lib" folder exists.');
        }
    });
}

function isDirIgnored(name: string, ignoredSet: Set<string>): boolean {
    return [...ignoredSet].some(dir => dir.endsWith(name));
}