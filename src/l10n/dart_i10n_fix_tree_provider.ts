import * as vscode from 'vscode';
import { upperCase } from 'lodash';
import { toUpperCamelCase } from '../utils/regex/regex_utils';
import { FileListenerBase } from '../utils/base_file_listener';





class UntranslatedStringItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly range: vscode.Range,
        public readonly uri: vscode.Uri,
        public readonly tag: 'log' | 'fix' | 'print' | 'other'  // 新增 tag 欄位
    ) {
        super(`[${tag}] ${label}`);
        this.command = {
            command: 'vscode.open',
            title: 'Open String',
            arguments: [this.uri, { selection: this.range }]
        };
    }
}
export class DartL10nStringFixProvider implements vscode.TreeDataProvider<UntranslatedStringItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private filterTag: 'all' | 'fix' | 'log' | 'print' | 'other' = 'all';
    private items: UntranslatedStringItem[] = [];

    refresh(items: UntranslatedStringItem[]) {
        this.items = items;
        const tagPriority: Record<UntranslatedStringItem['tag'], number> = {
            fix: 0,
            log: 1,
            print: 2,
            other: 3
        };

        this.items = items.sort((a, b) => {
            return tagPriority[a.tag] - tagPriority[b.tag];
        });

        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: UntranslatedStringItem): vscode.TreeItem {
        return element;
    }

    setFilter(tag: TagType) {
        this.filterTag = tag;
        this._onDidChangeTreeData.fire();
    }

    getChildren(): vscode.ProviderResult<UntranslatedStringItem[]> {
        if (this.filterTag === 'all') return this.items;
        return this.items.filter(item => item.tag === this.filterTag);
    }
}



export class DartL10nListener extends FileListenerBase {
    private provider: DartL10nStringFixProvider;

    constructor(provider: DartL10nStringFixProvider) {
        super();
        this.provider = provider;
    }


    onDidChangeActiveTextEditor(): vscode.Disposable {
        return vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (!editor) return;
            const document = editor.document;
            if (!document.fileName.endsWith('.dart')) return;
            provider.setFilter('all')
            this.handleFile(document);
        });
    }

    onDidSaveTextDocument(): vscode.Disposable {
        return vscode.workspace.onDidSaveTextDocument((document) => {
            if (!document.fileName.endsWith('.dart')) return;

            this.handleFile(document);
        });
    }

    handleFile(document: vscode.TextDocument) {
        const text = document.getText();
        const items: UntranslatedStringItem[] = [];

        const regex = /(["'])(?:(?!\1).)*?\1/g;
        const lines = text.split('\n');

        lines.forEach((line, lineIndex) => {
            if (line.trim().startsWith('part') || line.trim().startsWith(`import`) || line.trim().startsWith(`export`) || line.trim() === "") return;
            // 移除所有空格
            let cleanLine = line.replace(/\s+/g, '');
            let isLog = cleanLine.startsWith('log') || cleanLine.startsWith('_log') || cleanLine.includes("Logger(");
            let isComment = cleanLine.startsWith("//");
            let skip = cleanLine.startsWith("/@") || line.includes("@JsonKey(name:") || line.includes("@Default(") || line.includes("RegExp(") || cleanLine.includes("case");
            if (isComment || skip) {
                return
            }
            let isPrint = cleanLine.startsWith('print');
            let tag: 'log' | 'print' | 'other' | 'fix' = isLog ? 'log' : isPrint ? 'print' : 'fix';
            let displayTag = tag as string
            let match: RegExpExecArray | null;
            while ((match = regex.exec(line)) !== null) {
                const fullMatch = match[0];
                const innerText = fullMatch.slice(1, -1);
                let cleanInnerText = innerText.replace(/\s+/g, '');
                if (cleanInnerText === "") continue;
                const colStart = match.index;
                const colEnd = match.index + fullMatch.length;
                let isOther = false
                const isRouteName = innerText.startsWith('/');
                const isPreFixOtherPattern = [`Key(`, `DateFormat(`, `fontFamily: `];
                const isEndFixOtherPattern = [` =>`, `:`];
                for (let pattern of isPreFixOtherPattern) {
                    let len = pattern.length
                    let contextStart = Math.max(0, colStart - len);
                    let beforeString = line.substring(contextStart, colStart);
                    if (beforeString == pattern) {
                        isOther = true
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
                if (isOther || isRouteName) {
                    tag = 'other';
                    displayTag = 'other';
                }


                displayTag = toUpperCamelCase(displayTag)

                if (!this.isTranslated(innerText)) {
                    const range = new vscode.Range(
                        new vscode.Position(lineIndex, colStart + 1),
                        new vscode.Position(lineIndex, colEnd - 1)
                    );

                    items.push(
                        new UntranslatedStringItem(
                            `[${displayTag}] ${innerText}`,
                            range,
                            document.uri,
                            tag
                        )
                    );
                }
            }
        });

        this.provider.refresh(items);
    }

    isTranslated(str: string): boolean {
        // Implement your real logic
        return false;
    }
}

const TAG_OPTIONS = ['all', 'fix', 'log', 'print', 'other'] as const;
type TagType = typeof TAG_OPTIONS[number];
const provider = new DartL10nStringFixProvider();
export function registerDartL10nStringTreeProvider(context: vscode.ExtensionContext) {

    vscode.window.registerTreeDataProvider('dartL10nFixView', provider);
    const listener = new DartL10nListener(provider);
    context.subscriptions.push(listener.onDidSaveTextDocument());
    vscode.commands.registerCommand('dartL10n.showTagFilter', async () => {
        const selected = await vscode.window.showQuickPick(TAG_OPTIONS, {
            title: 'Filter Untranslated Strings by Tag'
        });
        if (selected) {
            provider.setFilter(selected as 'all' | 'fix' | 'log' | 'print' | 'other');
        }
    });
}