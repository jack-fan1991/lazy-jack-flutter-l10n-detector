import * as vscode from 'vscode';
import { LocalizationEditorService, LocalizationSavePayload } from '../application/localization_editor_service';
import { LocalizationBundle, LocalizationPlaceholders } from '../domain/localization_models';

interface WebviewInitLanguage {
  locale: string;
  values: Record<string, string>;
}

interface WebviewInitPayload {
  languages: WebviewInitLanguage[];
  keys: string[];
  placeholders: LocalizationPlaceholders;
  message?: string;
}

export class LocalizationEditorPanel {
  private static currentPanel: LocalizationEditorPanel | undefined;

  static createOrShow(service: LocalizationEditorService) {
    if (LocalizationEditorPanel.currentPanel) {
      LocalizationEditorPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      LocalizationEditorPanel.currentPanel.reload();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'dartL10nEditor',
      'Flutter Localization Editor',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    LocalizationEditorPanel.currentPanel = new LocalizationEditorPanel(panel, service);
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly service: LocalizationEditorService;
  private bundle: LocalizationBundle | undefined;

  private constructor(panel: vscode.WebviewPanel, service: LocalizationEditorService) {
    this.panel = panel;
    this.service = service;
    this.panel.webview.html = this.buildHtml(this.panel.webview);
    this.registerListeners();
    this.reload();
  }

  private registerListeners() {
    this.panel.onDidDispose(() => {
      LocalizationEditorPanel.currentPanel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: { type: string; payload?: unknown }) => {
      if (message.type === 'save') {
        await this.handleSave(message.payload as LocalizationSavePayload);
      }
    });
  }

  private async reload() {
    try {
      this.bundle = await this.service.loadBundle();
      this.postInitMessage();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load localization files: ${(error as Error).message}`);
      this.panel.dispose();
    }
  }

  private async handleSave(payload: LocalizationSavePayload) {
    if (!this.bundle) {
      return;
    }
    try {
      this.bundle = await this.service.saveBundle(this.bundle, payload);
      await vscode.workspace.saveAll();
      await vscode.commands.executeCommand('dart.hotReload');
      this.postInitMessage({ message: 'Save completed.' });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save localization files: ${(error as Error).message}`);
    }
  }

  private postInitMessage(extra?: { message?: string }) {
    if (!this.bundle) {
      return;
    }
    const languages: WebviewInitLanguage[] = this.bundle.files.map(file => ({
      locale: file.locale,
      values: file.values,
    }));

    const keys = Array.from(
      new Set(
        this.bundle.files.flatMap(file => Object.keys(file.values))
      )
    ).sort((a, b) => a.localeCompare(b));

    const payload: WebviewInitPayload = {
      languages,
      keys,
      placeholders: this.bundle.placeholders ?? {},
      message: extra?.message,
    };

    this.panel.webview.postMessage({
      type: 'init',
      payload,
    });
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = this.generateNonce();
    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Flutter Localization Editor</title>
  <style>
    body {
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-editor-font-family, sans-serif);
      padding: 0;
      margin: 0;
    }
    header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-editorGroup-border);
      background: var(--vscode-editor-background);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .header-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    h1 {
      font-size: 16px;
      margin: 0;
    }
    #status {
      font-size: 12px;
      color: var(--vscode-editorInfo-foreground);
      min-height: 16px;
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .placeholder-filter {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .placeholder-filter input {
      margin: 0;
    }
    .filter-input {
      min-width: 220px;
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
    .filter-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    .mode-select {
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid var(--vscode-dropdown-border);
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
    }
    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--vscode-editorGroup-border);
      background: var(--vscode-sideBar-background);
    }
    .tab-bar button {
      border: none;
      padding: 10px 16px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      border-right: 1px solid var(--vscode-editorGroup-border);
    }
    .tab-bar button.active {
      background: var(--vscode-tab-activeBackground);
      color: var(--vscode-tab-activeForeground);
    }
    .content {
      padding: 16px;
      overflow: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      border-bottom: 1px solid var(--vscode-editorGroup-border);
      text-align: left;
      padding: 12px;
      vertical-align: top;
    }
    th {
      width: 20%;
      color: var(--vscode-descriptionForeground);
      font-weight: normal;
    }
    textarea {
      width: 100%;
      min-height: 48px;
      padding: 6px 8px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      resize: vertical;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 13px;
    }
    .placeholder-editor {
      margin-top: 12px;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid var(--vscode-editorGroup-border);
      background: var(--vscode-editor-background);
    }
    .placeholder-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .placeholder-entry {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .placeholder-entry:last-child {
      margin-bottom: 0;
    }
    .placeholder-entry code {
      background: var(--vscode-editorWidget-background);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
    .placeholder-type-input {
      flex: 1;
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
    }
    .placeholder-type-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }
    button.save {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
    button.save[disabled] {
      opacity: 0.5;
      cursor: default;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <div class="header-text">
        <h1>Flutter Localization Editor</h1>
        <div id="status"></div>
      </div>
      <div class="header-controls">
        <input
          id="filterInput"
          class="filter-input"
          type="search"
          placeholder="Filter by key or value"
        />
        <label class="placeholder-filter">
          <input type="checkbox" id="placeholderFilterCheckbox" />
          Placeholders only
        </label>
        <select id="modeSelect" class="mode-select">
          <option value="matrix">Combined view</option>
          <option value="tabbed">Tabbed view</option>
        </select>
        <button class="save" id="saveButton" disabled>Save All Localizations</button>
      </div>
    </div>
  </header>
  <nav class="tab-bar" id="tabBar"></nav>
  <main class="content">
    <div id="tableContainer"></div>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = {
      languages: [],
      keys: [],
      dirty: new Set(),
      activeLocale: undefined,
      mode: 'matrix',
      filterText: '',
      placeholders: {},
      filterPlaceholdersOnly: false,
    };

    const tabBar = document.getElementById('tabBar');
    const tableContainer = document.getElementById('tableContainer');
    const saveButton = document.getElementById('saveButton');
    const status = document.getElementById('status');
    const filterInput = document.getElementById('filterInput');
    const modeSelect = document.getElementById('modeSelect');
    const placeholderCheckbox = document.getElementById('placeholderFilterCheckbox');

    saveButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'save',
        payload: {
          files: state.languages.map(lang => ({
            locale: lang.locale,
            values: lang.values,
          })),
          placeholders: state.placeholders,
        },
      });
      status.textContent = 'Saving...';
    });

    filterInput.addEventListener('input', () => {
      state.filterText = filterInput.value;
      renderTable();
    });

    if (placeholderCheckbox instanceof HTMLInputElement) {
      placeholderCheckbox.addEventListener('change', () => {
        state.filterPlaceholdersOnly = placeholderCheckbox.checked;
        renderTable();
      });
    }

    modeSelect.addEventListener('change', () => {
      state.mode = modeSelect.value;
      if (state.mode === 'tabbed' && !state.activeLocale && state.languages.length > 0) {
        state.activeLocale = state.languages[0].locale;
      }
      renderTabs();
      renderTable();
    });

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'init') {
        onInit(message.payload);
      }
    });

    function onInit(payload) {
      state.languages = payload.languages;
      state.keys = payload.keys;
      state.placeholders = clonePlaceholders(payload.placeholders || {});
      if (payload.message) {
        status.textContent = payload.message;
      } else {
        status.textContent = '';
      }
      filterInput.value = state.filterText;
      if (placeholderCheckbox instanceof HTMLInputElement) {
        placeholderCheckbox.checked = state.filterPlaceholdersOnly;
      }
      modeSelect.value = state.mode;
      state.dirty.clear();
      saveButton.disabled = true;
      renderTabs();
      if (state.mode === 'tabbed') {
        if (!state.activeLocale && state.languages.length > 0) {
          state.activeLocale = state.languages[0].locale;
        }
        if (state.activeLocale && !state.languages.some(lang => lang.locale === state.activeLocale)) {
          state.activeLocale = state.languages.length > 0 ? state.languages[0].locale : undefined;
        }
      }
      renderTable();
    }

    function renderTabs() {
      tabBar.innerHTML = '';
      if (state.mode !== 'tabbed') {
        tabBar.style.display = 'none';
        return;
      }
      tabBar.style.display = 'flex';
      state.languages.forEach(lang => {
        const button = document.createElement('button');
        button.textContent = lang.locale;
        if (lang.locale === state.activeLocale) {
          button.classList.add('active');
        }
        button.addEventListener('click', () => {
          state.activeLocale = lang.locale;
          renderTabs();
          renderTable();
        });
        tabBar.appendChild(button);
      });
    }

    function renderTable() {
      tableContainer.innerHTML = '';
      if (state.languages.length === 0) {
        tableContainer.innerHTML = '<p>No localization files found.</p>';
        return;
      }

      const filteredKeys = getFilteredKeys();
      if (filteredKeys.length === 0) {
        tableContainer.innerHTML = '<p>No records match the current filter.</p>';
        return;
      }

      if (state.mode === 'tabbed') {
        if (!state.activeLocale || !state.languages.some(lang => lang.locale === state.activeLocale)) {
          state.activeLocale = state.languages[0].locale;
        }
        const language = state.languages.find(lang => lang.locale === state.activeLocale);
        if (!language) {
          tableContainer.innerHTML = '<p>Failed to load localization data.</p>';
          return;
        }

        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        filteredKeys.forEach(key => {
          ensurePlaceholdersForKey(key);
          const row = document.createElement('tr');
          const keyCell = document.createElement('th');
          keyCell.textContent = key;
          const valueCell = document.createElement('td');
          const textarea = document.createElement('textarea');
          textarea.value = language.values[key] ?? '';
          textarea.addEventListener('input', () => {
            language.values[key] = textarea.value;
            state.dirty.add(language.locale);
            saveButton.disabled = state.dirty.size === 0;
            if (ensurePlaceholdersForKey(key)) {
              updatePlaceholderEditor(key);
            }
          });
          valueCell.appendChild(textarea);
          row.appendChild(keyCell);
          row.appendChild(valueCell);
          tbody.appendChild(row);

        const placeholderRow = document.createElement('tr');
        const placeholderCell = document.createElement('td');
        placeholderCell.colSpan = 2;
        const placeholderContainer = createPlaceholderContainer(key);
        placeholderCell.appendChild(placeholderContainer);
        placeholderRow.appendChild(placeholderCell);
        tbody.appendChild(placeholderRow);
        renderPlaceholderEditor(key, placeholderContainer, placeholderRow);
      });
      table.appendChild(tbody);
      tableContainer.appendChild(table);
      return;
    }

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      const keyHeader = document.createElement('th');
      keyHeader.textContent = 'Key';
      headerRow.appendChild(keyHeader);
      state.languages.forEach(lang => {
        const th = document.createElement('th');
        th.textContent = lang.locale;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      filteredKeys.forEach(key => {
        ensurePlaceholdersForKey(key);
        const row = document.createElement('tr');
        const keyCell = document.createElement('th');
        keyCell.textContent = key;
        row.appendChild(keyCell);
        state.languages.forEach(lang => {
          const cell = document.createElement('td');
          const textarea = document.createElement('textarea');
          textarea.value = lang.values[key] ?? '';
          textarea.addEventListener('input', () => {
            lang.values[key] = textarea.value;
            state.dirty.add(lang.locale);
            saveButton.disabled = state.dirty.size === 0;
            if (ensurePlaceholdersForKey(key)) {
              updatePlaceholderEditor(key);
            }
          });
          cell.appendChild(textarea);
          row.appendChild(cell);
        });
        tbody.appendChild(row);

        const placeholderRow = document.createElement('tr');
        const placeholderCell = document.createElement('td');
        placeholderCell.colSpan = state.languages.length + 1;
        const placeholderContainer = createPlaceholderContainer(key);
        placeholderCell.appendChild(placeholderContainer);
        placeholderRow.appendChild(placeholderCell);
        tbody.appendChild(placeholderRow);
        renderPlaceholderEditor(key, placeholderContainer, placeholderRow);
      });
      table.appendChild(tbody);
      tableContainer.appendChild(table);
    }

    function createPlaceholderContainer(key) {
      const container = document.createElement('div');
      container.className = 'placeholder-editor';
      container.id = getPlaceholderContainerId(key);
      return container;
    }

    function updatePlaceholderEditor(key) {
      const container = document.getElementById(getPlaceholderContainerId(key));
      if (container) {
        renderPlaceholderEditor(key, container, container.closest('tr'));
      }
    }

    function renderPlaceholderEditor(key, container, row) {
      const targetRow = row ?? container.closest('tr');
      container.innerHTML = '';
      const placeholders = state.placeholders[key];
      if (!placeholders || Object.keys(placeholders).length === 0) {
        if (targetRow) {
          targetRow.style.display = 'none';
        }
        return;
      }
      if (targetRow) {
        targetRow.style.display = '';
      }

      const title = document.createElement('div');
      title.className = 'placeholder-title';
      title.textContent = 'Placeholders';
      container.appendChild(title);

      Object.entries(placeholders)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([name, meta]) => {
          const entry = document.createElement('div');
          entry.className = 'placeholder-entry';
          const code = document.createElement('code');
          code.textContent = '{' + name + '}';
          const input = document.createElement('input');
          input.className = 'placeholder-type-input';
          input.value = meta.type ?? '';
          input.placeholder = 'Type (e.g. String)';
          input.addEventListener('input', () => {
            meta.type = input.value;
          });
          entry.appendChild(code);
          entry.appendChild(input);
          container.appendChild(entry);
        });
    }

    function ensurePlaceholdersForKey(key) {
      const discovered = new Set();
      state.languages.forEach(lang => {
        collectPlaceholders(lang.values[key]).forEach(name => discovered.add(name));
      });

      const current = state.placeholders[key];
      if (discovered.size === 0) {
        if (current) {
          delete state.placeholders[key];
          return true;
        }
        return false;
      }

      const next = {};
      let changed = !current;

      discovered.forEach(name => {
        if (current && current[name]) {
          next[name] = current[name];
        } else {
          next[name] = { type: 'String' };
          changed = true;
        }
      });

      if (current) {
        Object.keys(current).forEach(name => {
          if (!discovered.has(name)) {
            changed = true;
          }
        });
      }

      if (changed) {
        state.placeholders[key] = next;
      }
      return changed;
    }

    function collectPlaceholders(value) {
      if (typeof value !== 'string') {
        return [];
      }
      const matches = value.match(/\{([a-zA-Z0-9_]+)\}/g);
      if (!matches) {
        return [];
      }
      return Array.from(new Set(matches.map(match => match.slice(1, -1))));
    }

    function hasPlaceholders(key) {
      const placeholders = state.placeholders[key];
      if (placeholders && Object.keys(placeholders).length > 0) {
        return true;
      }
      return state.languages.some(lang => collectPlaceholders(lang.values[key]).length > 0);
    }

    function getPlaceholderContainerId(key) {
      return 'placeholder-' + encodeURIComponent(key);
    }

    function clonePlaceholders(source) {
      const result = {};
      Object.entries(source).forEach(([key, placeholders]) => {
        result[key] = {};
        Object.entries(placeholders).forEach(([name, meta]) => {
          result[key][name] = { ...(meta ?? {}) };
        });
      });
      return result;
    }

    function getFilteredKeys() {
      const keyword = state.filterText.trim().toLowerCase();
      return state.keys.filter(key => {
        if (state.filterPlaceholdersOnly && !hasPlaceholders(key)) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        if (key.toLowerCase().includes(keyword)) {
          return true;
        }
        return state.languages.some(lang => {
          const value = lang.values[key];
          if (typeof value !== 'string') {
            return false;
          }
          return value.toLowerCase().includes(keyword);
        });
      });
    }
  </script>
</body>
</html>
    `;
  }

  private generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
