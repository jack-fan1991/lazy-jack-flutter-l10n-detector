# Flutter L10n Assistant (Flutter L10n Detector)

[English](README.md) | [繁體中文](README.zh-TW.md)

## Key Features

* Streamlines the Flutter l10n workflow by **detecting** and **refactoring** hardcoded strings.
![功能預覽](images/scan.png)

### 1. Project-Wide Scan (Flutter L10n Overview)

* **Global string detection**: Adds a sidebar view that scans your `lib` folder and lists every Dart file containing hardcoded strings.
* **Custom scan scope**:
    * **Filter directories (`dartL10n.filterDir`)**: Limit the scan to specific subdirectories (for example `lib/features/profile`) to focus on a single feature.
    * **Ignore files or folders (`dartL10n.ignoreFile`)**: Temporarily or permanently exclude files or directories from the scan results.
* **One-click navigation**: Select any item to open the file and jump directly to the detected string.

### 2. String Refactoring (Quick Fix)

* **CodeLens quick fix**: Shows a `🔧 Fix「...」to l10n` button above each detected string; click to start refactoring.
* **Code Action support**: Select a string (without quotes) and trigger `🌐 Export String to l10n resource` with `Ctrl + .`.
* **Key suggestions**: Automatically detects the surrounding **class** or **file name**, converts it to snake_case (for example `my_widget_title`), and suggests it as the l10n key.
* **Parameter detection**:
    * Recognizes variables inside strings (for example `"Hello $name"` or `"Total: ${count}"`).
    * Prompts for parameter types (`String` or `num`) whenever a variable is found.
    * Generates the `placeholders` section in `.arb` files automatically.
* **Automatic code replacement**:
    * Replaces `"My String"` with `context.l10n.my_string`.
    * Replaces `"Hello $name"` with `context.l10n.hello_name(name)`.
* **`context.l10n` helper**:
    * Checks for and creates `localization_extension.dart` so the `context.l10n` getter is always available.
    * Adds required import statements to the top of the Dart file.

### 3. `.arb` File Automation

* **Auto-sort on save**: Validates JSON and sorts entries whenever you save an `.arb` file:
    1.  `appName` (if present)
    2.  All keys without matching `@` metadata (alphabetical)
    3.  Each `key` with its `@key` pair (alphabetical)
* **Automatic `flutter gen-l10n` runs**:
    * Whenever a new l10n key is created through refactoring.
    * Whenever an `.arb` file is saved manually.
    * Executes `flutter gen-l10n` in the terminal to keep `AppLocalizations.dart` up to date.

### 4. Active File Analysis (Flutter L10n Detector)

* **Real-time analysis view**: Adds another sidebar view dedicated to the **currently open** Dart file.
* **String categorization**:
    * `[Fix]`: Strings that should be refactored to l10n resources.
    * `[Log]`: Strings inside `log(...)` or `Logger(...)`.
    * `[Print]`: Strings inside `print(...)`.
    * `[Other]`: Strings recognized as constants, route paths (`/`), `Key()`, or `DateFormat()`.
* **Tag filters**: Quickly filter the list, for example to show only `[Fix]` items.

### 5. Localization Editor

* **Unified editing view**: Provides a webview editor to manage all `.arb` files in one place.
* **Two display modes**:
    * **Combined View**: Displays all languages side-by-side in a single table for easy comparison.
    * **Tabbed View**: Shows translations for one language at a time, simplifying focused editing.
* **Advanced filtering**:
    * **Filter by key or value**: Quickly find specific translations.
    * **Placeholder-only filter**: Isolate entries that contain variables.
* **Dynamic placeholder management**:
    * Automatically detects placeholders (e.g., `{name}`).
    * Allows editing placeholder types (e.g., `String`, `num`).
* **Auto-save and hot reload**: Saves all changes to the corresponding `.arb` files and triggers a hot reload.

## Recommended Workflow

1.  Open the **Flutter L10n Overview** view in the VS Code sidebar.
2.  Click the **Refresh** button (`dartL10n.refresh`) to scan your project.
3.  Review the list of files that contain hardcoded strings.
4.  Pick a file to open it at the detected string.
5.  Use the `🔧 Fix to l10n` CodeLens button or select the string and press `Ctrl + .`.
6.  Choose `🌐 Export String to l10n resource`.
7.  Pick a suggested key prefix (for example `[Class] MyWidget` or `[File] my_widget`) or enter a custom one.
8.  Confirm the final l10n key (for example `my_widget_title`).
9.  If parameters are detected (such as `$name`), select their types (`String` / `num`).
10. You're done! The extension will:
    * Update all `.arb` files under `lib/l10n/`.
    * Sort entries inside the `.arb` files.
    * Replace your Dart code with `context.l10n.my_widget_title`.
    * Add the import for `localization_extension.dart`.
    * Run `flutter gen-l10n` in the background.

## Extension Configuration

Configure the extension through `.vscode/settings.json`:

* l10m.yaml
```yaml
arb-dir: lib/l10n/
template-arb-file: app_en.arb
output-localization-file: app_localizations.dart
untranslated-messages-file: untranslated_messages.txt
output-dir: lib/l10n/gen
```

```json
{
  "flutter-l10n-detector.localizations": {
    "className": "AppLocalizations",
    "localizationsPath":  "lib/l10n/gen",
    "outputPath": "lib/l10n/gen"
  }
}
```
