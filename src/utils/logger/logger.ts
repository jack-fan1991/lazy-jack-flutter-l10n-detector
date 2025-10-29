import * as vscode from "vscode";


export const Icon_Error = '⛔';
export const Icon_Warning = '⚠️';
export const Icon_Info = '💡';
export const Icon_Success2 = '✔️';
export const Icon_Debug = '🐛';
export const Icon_Star = '⭐';
export const Icon_Project = '📁';


export function logError(msg: any = "",showOnVscode:boolean = true) {
    console.error(`${Icon_Error} : ${msg}`);
    if(showOnVscode){
        vscode.window.showErrorMessage(msg)
    }
}

export function logInfo(msg: string = "",showOnVscode:boolean = true) {
    console.log(`${Icon_Info} : ${msg}`);
    if(showOnVscode){
        vscode.window.showInformationMessage(msg)
    }
}

export function showErrorMessage(msg: string = "") {
    vscode.window.showErrorMessage(msg)
}


export function showInfo(msg: string = "") {
    vscode.window.showInformationMessage(msg)
}

export function showWarning(msg: string = "") {
    vscode.window.showWarningMessage(msg)
}