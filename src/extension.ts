import * as vscode from 'vscode';
import { getPackageJsonAsMap, getWorkspacePath } from './utils/vscode/vscode';
import * as fs from 'fs';
import { logError } from './utils/logger/logger';
import * as yaml from "yaml";
import { registerDartL10nStringFix } from './l10n/flutter_l10n_fix';
import { registerDartL10nStringTreeProvider } from './l10n/dart_i10n_fix_tree_provider';
import { registerDartL10nOverViewTreeProvider } from './l10n/dart_i10n_fix_overview';
import { EzCodeActionProviderInterface } from './l10n/code_action/code_action';
import { StringToL10nDetector } from './l10n/code_action/string_to_l10n_detector';
import { FileListenerBase } from './utils/base_file_listener';
import { commonStartFileListener, commonStopFileListener } from './command';
import { arbFileListener } from './l10n/arb_file_listener';



export class APP {
    public static pubspecYaml: any | undefined = undefined;
    public static l10nYaml: any | undefined = undefined;
}

export async function getL10nYAMLFileContent(): Promise<Record<string, any> | undefined> {
    try {
        let p = getWorkspacePath("l10n.yaml") as string;
        if (!fs.existsSync(p)) {
            return undefined;
        }

        const fileContents = fs.readFileSync(p, 'utf-8');
        return yaml.parse(fileContents);
    } catch (e) {
        logError(`getYAMLFileContent ${e}`, false)
    }

}

export async function activate(context: vscode.ExtensionContext) {
    APP.pubspecYaml = await getPackageJsonAsMap();
    APP.l10nYaml = getL10nYAMLFileContent();
    registerEzAction(context)
registerFileListener(context)
    // 列出為多國的字串
    registerDartL10nStringFix(context)
    registerDartL10nStringTreeProvider(context)
    registerDartL10nOverViewTreeProvider(context)

}

export function registerEzAction(context: vscode.ExtensionContext) {
    let providers: EzCodeActionProviderInterface[] = []
    providers.push(new StringToL10nDetector())
    for (let p of providers) {
        // 註冊命令回調
        p.setOnActionCommandCallback(context)
        context.subscriptions.push(
            vscode.languages.registerCodeActionsProvider(
                p.getLangrageType(),
                p,
               ));
    }
}


export function deactivate() { }



export function registerFileListener(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand(commonStartFileListener, (fileListener: FileListenerBase) => {
        fileListener.start(context)
    }
    )
    );
    context.subscriptions.push(vscode.commands.registerCommand(commonStopFileListener, (fileListener: FileListenerBase) => {
        fileListener.stop(context)
    }
    )
    );
    
    startFileListener(new FileListenerManger())

}


 function startFileListener(fileListener: FileListenerBase) {
    vscode.commands.executeCommand(commonStartFileListener, fileListener)
    
}

 function stopFileListener(fileListener: FileListenerBase) {
    vscode.commands.executeCommand(commonStopFileListener, fileListener)
}


export class FileListenerManger extends FileListenerBase {
    constructor() {
        super();
    }
    onDidChangeActiveTextEditor(): vscode.Disposable | undefined {
        return vscode.window.onDidChangeActiveTextEditor(editor => {
            if ( editor?.document.uri.path.endsWith('.arb')) {
                startFileListener(arbFileListener)
            }
         
          
        })
    }
    onDidCloseTextDocument(): vscode.Disposable | undefined {
        return vscode.workspace.onDidCloseTextDocument(doc => {
            if ( doc.uri.path.endsWith('.arb')) {
                stopFileListener (arbFileListener)
            }
          
        })
    }

}
