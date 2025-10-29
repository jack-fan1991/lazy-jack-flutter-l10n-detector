import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getRootPath } from '../../utils/vscode/vscode';

export interface LocalizationExtensionConfig {
    className: string;
    localizationsPath: string;
    outputPath: string;
    projectName: string;
}

export interface FlutterL10nDetectorConfig {
    localizationExtension: LocalizationExtensionConfig;
}

export function loadConfig(): FlutterL10nDetectorConfig {
    const rootPath = getRootPath();
    if (!rootPath) {
        throw new Error("Workspace root not found. Please open a Flutter project.");
    }
    const config = vscode.workspace.getConfiguration('flutter-l10n-detector');

    const pubspecPath = path.join(rootPath, 'pubspec.yaml');
    let projectName = 'your_project_name'; // Fallback
    if (fs.existsSync(pubspecPath)) {
        const pubspecContent = fs.readFileSync(pubspecPath, 'utf8');
        const nameMatch = pubspecContent.match(/^name:\s*(\S+)/m);
        if (nameMatch && nameMatch[1]) {
            projectName = nameMatch[1];
        }
    }

    let outputPath = config.get<string>('localizations.outputPath') ?? 'lib/app/localization_extension.dart';
    let localizationsPath = config.get<string>('localizations.localizationsPath') ?? 'package:flutter_gen/gen_l10n/app_localizations.dart';

    if (!outputPath.endsWith('.dart')) {
        if (!outputPath.endsWith('/')) {
            outputPath += '/';
        }
        outputPath += 'localization_extension.dart';
    }

    if (!localizationsPath.endsWith('.dart')) {
        if (!localizationsPath.endsWith('/')) {
            localizationsPath += '/';
        }
        localizationsPath += 'app_localizations.dart';
    }
    // if (!outputPath.startsWith('package:')) {
    //     outputPath = `package:${projectName}/${localizationsPath.replace(/^lib\//, '')}`;
    // }
    // if (!localizationsPath.startsWith('package:')) {
    //     localizationsPath = `package:${projectName}/${localizationsPath.replace(/^lib\//, '')}`;
    // }

    const localizationExtensionConfig: LocalizationExtensionConfig = {
        className: config.get<string>('localizations.className') ?? 'AppLocalizations',
        localizationsPath: localizationsPath,
        outputPath: outputPath,
        projectName: projectName,
    };

    return {
        localizationExtension: localizationExtensionConfig,
    };
}
