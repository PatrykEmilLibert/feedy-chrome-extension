const DEFAULT_DATA = {
  version: 1,
  macros: {},
  settings: {
    parallelLimit: 12,
    postActionDelayMs: 0,
    actionTimeoutMs: 12000,
    repeats: 1,
    skipIntermediateAfterFirstMacro: false
  }
};

const LEGACY_MARKER_MAP = {
  "{TAB}": { type: "key", value: "tab" },
  "{ENTER}": { type: "key", value: "enter" },
  "{SHIFT_TAB}": { type: "key", value: "shift+tab" },
  "{CTRL_TAB}": { type: "key", value: "ctrl+tab" },
  "{UP}": { type: "key", value: "up" },
  "{DOWN}": { type: "key", value: "down" },
  "{LEFT}": { type: "key", value: "left" },
  "{RIGHT}": { type: "key", value: "right" }
};

const state = {
  data: structuredClone(DEFAULT_DATA),
  editorActions: [],
  selectedActionIndex: -1,
  structuredModifierRows: []
};

const elements = {
  macroEditorList: document.getElementById("macroEditorList"),
  macroRunList: document.getElementById("macroRunList"),
  macroName: document.getElementById("macroName"),
  macroHotkey: document.getElementById("macroHotkey"),
  actionList: document.getElementById("actionList"),
  actionType: document.getElementById("actionType"),
  actionValue: document.getElementById("actionValue"),
  actionLabel: document.getElementById("actionLabel"),
  actionTag: document.getElementById("actionTag"),
  actionExact: document.getElementById("actionExact"),
  actionIgnoreNavigation: document.getElementById("actionIgnoreNavigation"),
  targetMode: document.getElementById("targetMode"),
  repeats: document.getElementById("repeats"),
  parallelLimit: document.getElementById("parallelLimit"),
  postActionDelayMs: document.getElementById("postActionDelayMs"),
  skipIntermediateAfterFirstMacro: document.getElementById("skipIntermediateAfterFirstMacro"),
  statusLog: document.getElementById("statusLog"),
  jsonTransfer: document.getElementById("jsonTransfer"),
  jsonFileInput: document.getElementById("jsonFileInput"),
  btnNewMacro: document.getElementById("btnNewMacro"),
  btnSaveMacro: document.getElementById("btnSaveMacro"),
  btnDeleteMacro: document.getElementById("btnDeleteMacro"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnMoveUp: document.getElementById("btnMoveUp"),
  btnMoveDown: document.getElementById("btnMoveDown"),
  btnRemoveAction: document.getElementById("btnRemoveAction"),
  btnClearActions: document.getElementById("btnClearActions"),
  btnAddAction: document.getElementById("btnAddAction"),
  btnUpdateAction: document.getElementById("btnUpdateAction"),
  btnAddTab: document.getElementById("btnAddTab"),
  btnAddEnter: document.getElementById("btnAddEnter"),
  btnAddShiftTab: document.getElementById("btnAddShiftTab"),
  btnAddCtrlTab: document.getElementById("btnAddCtrlTab"),
  btnAddUp: document.getElementById("btnAddUp"),
  btnAddDown: document.getElementById("btnAddDown"),
  btnAddLeft: document.getElementById("btnAddLeft"),
  btnAddRight: document.getElementById("btnAddRight"),
  btnPresetFiles: document.getElementById("btnPresetFiles"),
  btnPresetSave: document.getElementById("btnPresetSave"),
  btnPresetRunScript: document.getElementById("btnPresetRunScript"),
  btnPresetAddFile: document.getElementById("btnPresetAddFile"),
  btnPresetAddPerSku: document.getElementById("btnPresetAddPerSku"),
  structuredMacroName: document.getElementById("structuredMacroName"),
  structuredResultFile: document.getElementById("structuredResultFile"),
  structuredCurrencyPair: document.getElementById("structuredCurrencyPair"),
  structuredMaxStock: document.getElementById("structuredMaxStock"),
  structuredPriceGroupCsv: document.getElementById("structuredPriceGroupCsv"),
  structuredPerSkuName: document.getElementById("structuredPerSkuName"),
  structuredMergeOnColumn: document.getElementById("structuredMergeOnColumn"),
  structuredModifierRows: document.getElementById("structuredModifierRows"),
  btnAddStructuredMacro: document.getElementById("btnAddStructuredMacro"),
  btnClearStructuredForm: document.getElementById("btnClearStructuredForm"),
  btnStartPicker: document.getElementById("btnStartPicker"),
  btnRun: document.getElementById("btnRun"),
  btnStop: document.getElementById("btnStop"),
  btnExportJson: document.getElementById("btnExportJson"),
  btnImportJson: document.getElementById("btnImportJson"),
  btnImportFile: document.getElementById("btnImportFile")
};

function nowTime() {
  return new Date().toLocaleTimeString();
}

function logLine(message) {
  const line = `[${nowTime()}] ${message}`;
  elements.statusLog.textContent = `${elements.statusLog.textContent}${line}\n`;
  elements.statusLog.scrollTop = elements.statusLog.scrollHeight;
}

function clearMacroEditor() {
  elements.macroName.value = "";
  elements.macroHotkey.value = "";
  state.editorActions = [];
  state.selectedActionIndex = -1;
  renderActionList();
}

function safeNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return fallback;
}

function detectCsvDelimiter(headerLine) {
  const sample = String(headerLine || "");
  const delimiters = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;

  for (const delimiter of delimiters) {
    const count = sample.split(delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

function parseCsvRow(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => String(cell || "").trim());
}

function parseCsvText(csvText) {
  const source = String(csvText || "").replace(/^\uFEFF/, "");
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { delimiter: ",", rows: [] };
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const rows = lines.map((line) => parseCsvRow(line, delimiter));

  return { delimiter, rows };
}

function convertLegacyRawActions(rawActions) {
  return rawActions
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => {
      const markerAction = LEGACY_MARKER_MAP[item];
      if (markerAction) {
        return { ...markerAction };
      }
      return { type: "text", value: item };
    });
}

function normalizeImportedActions(actions) {
  if (!Array.isArray(actions)) {
    return [];
  }

  if (actions.length > 0 && typeof actions[0] === "string") {
    return convertLegacyRawActions(actions);
  }

  return actions
    .filter((action) => action && typeof action === "object")
    .map((action) => ({ ...action }));
}

function parseJsonActionsCell(rawCell) {
  const raw = String(rawCell || "").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeImportedActions(parsed);
  } catch (_err) {
    return convertLegacyRawActions([raw]);
  }
}

function importLegacyCsvData(csvText, currentSettings) {
  const { rows } = parseCsvText(csvText);
  if (rows.length === 0) {
    throw new Error("CSV is empty.");
  }

  const header = rows[0].map((cell) => String(cell || "").trim().toLowerCase());
  const isHeaderBased = header.includes("nazwa_makra") && header.includes("akcje");
  const macros = {};

  if (isHeaderBased) {
    const nameIdx = header.indexOf("nazwa_makra");
    const actionsIdx = header.indexOf("akcje");
    const hotkeyIdx = header.indexOf("hotkey");

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const name = String(row[nameIdx] || "").trim();
      if (!name) {
        continue;
      }

      const actions = parseJsonActionsCell(row[actionsIdx]);
      const hotkey = hotkeyIdx >= 0 ? String(row[hotkeyIdx] || "Brak").trim() || "Brak" : "Brak";

      macros[name] = {
        actions,
        hotkey
      };
    }
  } else {
    // Very old format: macro name in first column, subsequent columns are plain actions/markers.
    const startRow = header[0] === "nazwa_makra" ? 1 : 0;

    for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const name = String(row[0] || "").trim();
      if (!name) {
        continue;
      }

      const rawActions = row.slice(1);
      const actions = convertLegacyRawActions(rawActions);

      macros[name] = {
        actions,
        hotkey: "Brak"
      };
    }
  }

  const imported = {
    version: 1,
    macros,
    settings: {
      ...currentSettings
    }
  };

  return normalizeData(imported);
}

function normalizeData(input) {
  const data = input && typeof input === "object" ? input : {};
  const macros = data.macros && typeof data.macros === "object" ? data.macros : {};
  const rawSettings = data.settings && typeof data.settings === "object" ? data.settings : {};

  const normalizedMacros = {};
  for (const [name, entry] of Object.entries(macros)) {
    if (!name || typeof name !== "string") {
      continue;
    }
    const actions = Array.isArray(entry?.actions) ? entry.actions : [];
    normalizedMacros[name] = {
      actions: actions.filter((action) => action && typeof action === "object").map((action) => ({ ...action })),
      hotkey: typeof entry?.hotkey === "string" ? entry.hotkey : "Brak"
    };
  }

  const settings = {
    ...DEFAULT_DATA.settings,
    ...rawSettings
  };

  settings.parallelLimit = safeNumber(settings.parallelLimit, 1, 30, DEFAULT_DATA.settings.parallelLimit);
  settings.postActionDelayMs = safeNumber(settings.postActionDelayMs, 0, 5000, DEFAULT_DATA.settings.postActionDelayMs);
  settings.actionTimeoutMs = safeNumber(settings.actionTimeoutMs, 500, 60000, DEFAULT_DATA.settings.actionTimeoutMs);
  settings.repeats = safeNumber(settings.repeats, 1, 100, DEFAULT_DATA.settings.repeats);
  settings.skipIntermediateAfterFirstMacro = toBoolean(
    settings.skipIntermediateAfterFirstMacro,
    DEFAULT_DATA.settings.skipIntermediateAfterFirstMacro
  );

  // One-time migration from legacy slower defaults.
  if (
    !Object.prototype.hasOwnProperty.call(rawSettings, "parallelLimit") ||
    Number(rawSettings.parallelLimit) === 4
  ) {
    settings.parallelLimit = DEFAULT_DATA.settings.parallelLimit;
  }
  if (
    !Object.prototype.hasOwnProperty.call(rawSettings, "postActionDelayMs") ||
    Number(rawSettings.postActionDelayMs) === 80
  ) {
    settings.postActionDelayMs = DEFAULT_DATA.settings.postActionDelayMs;
  }

  return {
    version: 1,
    macros: normalizedMacros,
    settings
  };
}

async function callWorker(payload) {
  const response = await chrome.runtime.sendMessage(payload);
  if (!response?.ok) {
    throw new Error(response?.error || "Request failed");
  }
  return response;
}

function renderMacroLists() {
  const names = Object.keys(state.data.macros).sort((a, b) => a.localeCompare(b));
  const editorSelected = elements.macroEditorList.value;
  const runSelected = new Set(Array.from(elements.macroRunList.selectedOptions).map((option) => option.value));

  elements.macroEditorList.innerHTML = "";
  elements.macroRunList.innerHTML = "";

  for (const name of names) {
    const editorOption = document.createElement("option");
    editorOption.value = name;
    editorOption.textContent = name;
    elements.macroEditorList.appendChild(editorOption);

    const runOption = document.createElement("option");
    runOption.value = name;
    runOption.textContent = name;
    elements.macroRunList.appendChild(runOption);
  }

  if (editorSelected && names.includes(editorSelected)) {
    elements.macroEditorList.value = editorSelected;
  }

  for (const option of elements.macroRunList.options) {
    option.selected = runSelected.has(option.value);
  }
}

function getActionLabel(action, index) {
  const type = action?.type || "unknown";
  const keyMap = {
    tab: "Tab",
    enter: "Enter",
    "shift+tab": "Shift+Tab",
    "ctrl+tab": "Ctrl+Tab",
    up: "Gora",
    down: "Dol",
    left: "Lewo",
    right: "Prawo"
  };

  if (type === "web_click") {
    return `${index + 1}. Klik WWW (selektor) -> ${String(action.value || "").slice(0, 60)}`;
  }
  if (type === "web_click_text") {
    return `${index + 1}. Klik WWW (tekst) -> ${String(action.value || "").slice(0, 60)}`;
  }
  if (type === "focus_input_fragment") {
    return `${index + 1}. Znajdz input po fragmencie -> ${String(action.value || "").slice(0, 60)}`;
  }
  if (type === "key") {
    const mapped = keyMap[String(action.value || "").toLowerCase()] || String(action.value || "");
    return `${index + 1}. Nacisnij klawisz -> ${mapped}`;
  }
  if (type === "text") {
    return `${index + 1}. Wpisz tekst -> ${String(action.value || "").slice(0, 60)}`;
  }
  return `${index + 1}. ${type}`;
}

function addActionToDraft(actionData, successMessage) {
  state.editorActions.push({ ...actionData });
  state.selectedActionIndex = state.editorActions.length - 1;
  renderActionList();
  if (successMessage) {
    logLine(successMessage);
  }
}

function clearStructuredMacroForm() {
  elements.structuredMacroName.value = "";
  elements.structuredResultFile.value = "";
  elements.structuredCurrencyPair.value = "";
  elements.structuredMaxStock.value = "";
  elements.structuredPriceGroupCsv.value = "";
  elements.structuredPerSkuName.value = "";
  elements.structuredMergeOnColumn.value = "";
  initializeStructuredModifierTable();
}

function createStructuredInput(value = "") {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  return input;
}

function initializeStructuredModifierTable(seedRows = null) {
  const defaults = [
    { interval: "", multiplier: "", added: "", ship: "", isLast: false },
    { interval: "", multiplier: "", added: "", ship: "", isLast: false },
    { interval: "", multiplier: "", added: "", ship: "", isLast: false },
    { interval: "", multiplier: "", added: "", ship: "", isLast: false },
    { interval: "", multiplier: "", added: "", ship: "", isLast: true }
  ];

  const rows = Array.isArray(seedRows) && seedRows.length > 0 ? seedRows : defaults;

  state.structuredModifierRows = [];
  elements.structuredModifierRows.innerHTML = "";

  rows.forEach((rowData, index) => {
    const isLast = index === rows.length - 1 || Boolean(rowData.isLast);

    const tr = document.createElement("tr");

    const tdInterval = document.createElement("td");
    let intervalInput = null;
    if (isLast) {
      const span = document.createElement("span");
      span.className = "structured-interval-last";
      span.textContent = "Powyzej poprzedniego";
      tdInterval.appendChild(span);
    } else {
      intervalInput = createStructuredInput(rowData.interval || "");
      tdInterval.appendChild(intervalInput);
    }
    tr.appendChild(tdInterval);

    const tdMultiplier = document.createElement("td");
    const multiplierInput = createStructuredInput(rowData.multiplier || "");
    tdMultiplier.appendChild(multiplierInput);
    tr.appendChild(tdMultiplier);

    const tdAdded = document.createElement("td");
    const addedInput = createStructuredInput(rowData.added || "");
    tdAdded.appendChild(addedInput);
    tr.appendChild(tdAdded);

    const tdShip = document.createElement("td");
    const shipInput = createStructuredInput(rowData.ship || "");
    tdShip.appendChild(shipInput);
    tr.appendChild(tdShip);

    elements.structuredModifierRows.appendChild(tr);

    state.structuredModifierRows.push({
      isLast,
      intervalInput,
      multiplierInput,
      addedInput,
      shipInput
    });
  });
}

function collectStructuredModifierRows() {
  if (!Array.isArray(state.structuredModifierRows) || state.structuredModifierRows.length === 0) {
    initializeStructuredModifierTable();
  }

  return state.structuredModifierRows.map((row) => ({
    interval: row.intervalInput ? row.intervalInput.value : "",
    multiplier: row.multiplierInput.value,
    added: row.addedInput.value,
    ship: row.shipInput.value,
    isLast: row.isLast
  }));
}

function buildStructuredMacroActions(payload) {
  const actions = [];

  const addText = (value) => {
    const v = String(value || "").trim();
    if (v || v === "0") {
      actions.push({ type: "text", value: v });
    }
  };

  const addKey = (key) => {
    actions.push({ type: "key", value: key });
  };

  addText(payload.resultFile);
  addKey("tab");
  addText(payload.currencyPair);
  addKey("tab");
  addKey("tab");
  addKey("tab");
  addText(payload.maxStock);
  addKey("tab");
  addText(payload.priceGroupCsv);
  addKey("tab");
  addKey("tab");

  payload.modifiers.forEach((row, index) => {
    const isLastRow = index === payload.modifiers.length - 1;

    if (!isLastRow) {
      addText(row.interval);
      addKey("tab");
    }

    addText(row.multiplier);
    addKey("tab");
    addText(row.added);
    addKey("tab");
    addText(row.ship);
    addKey("tab");
  });

  addKey("enter");
  addKey("shift+tab");
  addKey("shift+tab");
  addText(payload.perSkuName);
  addKey("tab");
  addText(payload.mergeOnColumn);

  return actions;
}

async function addStructuredMacroFromForm() {
  const macroName = String(elements.structuredMacroName.value || "").trim();
  if (!macroName) {
    throw new Error("Podaj nazwę makra strukturalnego.");
  }

  const modifiers = collectStructuredModifierRows();
  const actions = buildStructuredMacroActions({
    resultFile: elements.structuredResultFile.value,
    currencyPair: elements.structuredCurrencyPair.value,
    maxStock: elements.structuredMaxStock.value,
    priceGroupCsv: elements.structuredPriceGroupCsv.value,
    perSkuName: elements.structuredPerSkuName.value,
    mergeOnColumn: elements.structuredMergeOnColumn.value,
    modifiers
  });

  state.data.macros[macroName] = {
    actions,
    hotkey: "Brak"
  };

  await persistData();
  elements.macroEditorList.value = macroName;
  loadMacroToEditor(macroName);
  clearStructuredMacroForm();
  logLine(`Dodano makro strukturalne: ${macroName} (akcje: ${actions.length})`);
}

function createWebTextPresetAction(label, textValue) {
  return {
    type: "web_click_text",
    value: textValue,
    label,
    tag: "button",
    exact: true,
    ignore_navigation: true
  };
}

function renderActionList() {
  const selectedIndex = state.selectedActionIndex;
  elements.actionList.innerHTML = "";

  state.editorActions.forEach((action, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = getActionLabel(action, index);
    elements.actionList.appendChild(option);
  });

  if (selectedIndex >= 0 && selectedIndex < state.editorActions.length) {
    elements.actionList.selectedIndex = selectedIndex;
  } else {
    state.selectedActionIndex = -1;
  }
}

function actionToForm(action) {
  elements.actionType.value = action.type || "web_click";
  elements.actionValue.value = action.value || "";
  elements.actionLabel.value = action.label || "";
  elements.actionTag.value = action.tag || "button";
  if (action.type === "focus_input_fragment") {
    elements.actionExact.checked = Boolean(action.exact);
  } else {
    elements.actionExact.checked = action.exact !== false;
  }
  elements.actionIgnoreNavigation.checked = action.ignore_navigation !== false;
  syncActionTypeUi();
}

function syncActionTypeUi() {
  const type = elements.actionType.value;
  const isWebText = type === "web_click_text";
  const isFocusFragment = type === "focus_input_fragment";

  elements.actionTag.disabled = !isWebText;
  elements.actionIgnoreNavigation.disabled = !isWebText;

  if (isFocusFragment) {
    elements.actionTag.disabled = true;
    elements.actionIgnoreNavigation.disabled = true;
    elements.actionExact.checked = false;
    elements.actionValue.placeholder = "fragment value/placeholder/label, np. cena netto";
  } else if (isWebText) {
    elements.actionValue.placeholder = "tekst przycisku lub elementu";
  } else {
    elements.actionValue.placeholder = "selektor, tekst, kombinacja klawiszy";
  }
}

function formToAction() {
  const type = elements.actionType.value;
  const value = elements.actionValue.value.trim();
  const label = elements.actionLabel.value.trim();
  const tag = elements.actionTag.value.trim() || "button";

  if (!value) {
    throw new Error("Action value cannot be empty.");
  }

  if (type === "web_click") {
    return {
      type,
      value,
      label: label || value
    };
  }

  if (type === "web_click_text") {
    return {
      type,
      value,
      label: label || value,
      tag,
      exact: elements.actionExact.checked,
      ignore_navigation: elements.actionIgnoreNavigation.checked
    };
  }

  if (type === "focus_input_fragment") {
    return {
      type,
      value,
      label: label || value,
      exact: false
    };
  }

  if (type === "key") {
    return {
      type,
      value
    };
  }

  if (type === "text") {
    return {
      type,
      value
    };
  }

  throw new Error(`Unsupported action type: ${type}`);
}

function loadMacroToEditor(name) {
  const macro = state.data.macros[name];
  if (!macro) {
    return;
  }

  elements.macroName.value = name;
  elements.macroHotkey.value = macro.hotkey || "Brak";
  state.editorActions = Array.isArray(macro.actions) ? macro.actions.map((action) => ({ ...action })) : [];
  state.selectedActionIndex = -1;
  renderActionList();
  logLine(`Loaded macro for edit: ${name}`);
}

async function refreshData() {
  const response = await callWorker({ type: "GET_DATA" });
  state.data = normalizeData(response.data);

  elements.parallelLimit.value = String(state.data.settings.parallelLimit);
  elements.postActionDelayMs.value = String(state.data.settings.postActionDelayMs);
  elements.repeats.value = String(state.data.settings.repeats);
  elements.skipIntermediateAfterFirstMacro.checked = Boolean(state.data.settings.skipIntermediateAfterFirstMacro);

  renderMacroLists();
}

async function persistData() {
  state.data.settings.parallelLimit = safeNumber(elements.parallelLimit.value, 1, 30, state.data.settings.parallelLimit);
  state.data.settings.postActionDelayMs = safeNumber(
    elements.postActionDelayMs.value,
    0,
    5000,
    state.data.settings.postActionDelayMs
  );
  state.data.settings.repeats = safeNumber(elements.repeats.value, 1, 100, state.data.settings.repeats);
  state.data.settings.skipIntermediateAfterFirstMacro = Boolean(elements.skipIntermediateAfterFirstMacro.checked);

  const response = await callWorker({
    type: "SAVE_DATA",
    data: state.data
  });

  state.data = normalizeData(response.data);
  renderMacroLists();
}

function getSelectedRunMacros() {
  return Array.from(elements.macroRunList.selectedOptions).map((option) => option.value);
}

function bindEvents() {
  elements.actionType.addEventListener("change", () => {
    syncActionTypeUi();
  });

  elements.macroEditorList.addEventListener("change", () => {
    const name = elements.macroEditorList.value;
    if (name) {
      loadMacroToEditor(name);
    }
  });

  elements.actionList.addEventListener("change", () => {
    const index = elements.actionList.selectedIndex;
    state.selectedActionIndex = index;
    const action = state.editorActions[index];
    if (action) {
      actionToForm(action);
    }
  });

  elements.btnNewMacro.addEventListener("click", () => {
    clearMacroEditor();
    logLine("Started new macro draft.");
  });

  elements.btnSaveMacro.addEventListener("click", async () => {
    const name = elements.macroName.value.trim();
    if (!name) {
      logLine("Cannot save: macro name is empty.");
      return;
    }

    state.data.macros[name] = {
      actions: state.editorActions.map((action) => ({ ...action })),
      hotkey: elements.macroHotkey.value.trim() || "Brak"
    };

    await persistData();
    elements.macroEditorList.value = name;
    renderMacroLists();
    logLine(`Saved macro: ${name}`);
  });

  elements.btnDeleteMacro.addEventListener("click", async () => {
    const name = elements.macroEditorList.value || elements.macroName.value.trim();
    if (!name || !state.data.macros[name]) {
      logLine("No macro selected for delete.");
      return;
    }

    delete state.data.macros[name];
    await persistData();
    clearMacroEditor();
    logLine(`Deleted macro: ${name}`);
  });

  elements.btnRefresh.addEventListener("click", async () => {
    await refreshData();
    logLine("Data refreshed from storage.");
  });

  elements.btnAddAction.addEventListener("click", () => {
    try {
      addActionToDraft(formToAction(), "Dodano akcje.");
    } catch (err) {
      logLine(`Add action failed: ${err.message}`);
    }
  });

  elements.btnUpdateAction.addEventListener("click", () => {
    if (state.selectedActionIndex < 0 || state.selectedActionIndex >= state.editorActions.length) {
      logLine("Select action first to update.");
      return;
    }

    try {
      state.editorActions[state.selectedActionIndex] = formToAction();
      renderActionList();
      logLine("Action updated.");
    } catch (err) {
      logLine(`Update action failed: ${err.message}`);
    }
  });

  elements.btnRemoveAction.addEventListener("click", () => {
    if (state.selectedActionIndex < 0 || state.selectedActionIndex >= state.editorActions.length) {
      logLine("Select action first to remove.");
      return;
    }

    state.editorActions.splice(state.selectedActionIndex, 1);
    state.selectedActionIndex = -1;
    renderActionList();
    logLine("Action removed.");
  });

  elements.btnClearActions.addEventListener("click", () => {
    state.editorActions = [];
    state.selectedActionIndex = -1;
    renderActionList();
    logLine("All actions cleared from draft.");
  });

  elements.btnMoveUp.addEventListener("click", () => {
    const idx = state.selectedActionIndex;
    if (idx <= 0 || idx >= state.editorActions.length) {
      return;
    }
    const tmp = state.editorActions[idx - 1];
    state.editorActions[idx - 1] = state.editorActions[idx];
    state.editorActions[idx] = tmp;
    state.selectedActionIndex = idx - 1;
    renderActionList();
  });

  elements.btnMoveDown.addEventListener("click", () => {
    const idx = state.selectedActionIndex;
    if (idx < 0 || idx >= state.editorActions.length - 1) {
      return;
    }
    const tmp = state.editorActions[idx + 1];
    state.editorActions[idx + 1] = state.editorActions[idx];
    state.editorActions[idx] = tmp;
    state.selectedActionIndex = idx + 1;
    renderActionList();
  });

  elements.btnAddTab.addEventListener("click", () => addActionToDraft({ type: "key", value: "tab" }, "Dodano Tab."));
  elements.btnAddEnter.addEventListener("click", () =>
    addActionToDraft({ type: "key", value: "enter" }, "Dodano Enter.")
  );
  elements.btnAddShiftTab.addEventListener("click", () =>
    addActionToDraft({ type: "key", value: "shift+tab" }, "Dodano Shift+Tab.")
  );
  elements.btnAddCtrlTab.addEventListener("click", () =>
    addActionToDraft({ type: "key", value: "ctrl+tab" }, "Dodano Ctrl+Tab.")
  );
  elements.btnAddUp.addEventListener("click", () => addActionToDraft({ type: "key", value: "up" }, "Dodano Gora."));
  elements.btnAddDown.addEventListener("click", () =>
    addActionToDraft({ type: "key", value: "down" }, "Dodano Dol.")
  );
  elements.btnAddLeft.addEventListener("click", () =>
    addActionToDraft({ type: "key", value: "left" }, "Dodano Lewo.")
  );
  elements.btnAddRight.addEventListener("click", () =>
    addActionToDraft({ type: "key", value: "right" }, "Dodano Prawo.")
  );

  elements.btnPresetFiles.addEventListener("click", () =>
    addActionToDraft(createWebTextPresetAction("Files", "Files"), "Dodano preset Files.")
  );
  elements.btnPresetSave.addEventListener("click", () =>
    addActionToDraft(createWebTextPresetAction("Save", "Save"), "Dodano preset Save.")
  );
  elements.btnPresetRunScript.addEventListener("click", () =>
    addActionToDraft(createWebTextPresetAction("Run script", "Run script"), "Dodano preset Run script.")
  );
  elements.btnPresetAddFile.addEventListener("click", () =>
    addActionToDraft(createWebTextPresetAction("Add File", "Add File"), "Dodano preset Add File.")
  );
  elements.btnPresetAddPerSku.addEventListener("click", () =>
    addActionToDraft(
      createWebTextPresetAction("Add add per sku tab", "Add add per sku tab"),
      "Dodano preset Add per sku tab."
    )
  );

  elements.btnAddStructuredMacro.addEventListener("click", async () => {
    try {
      await addStructuredMacroFromForm();
    } catch (err) {
      logLine(`Dodawanie makra strukturalnego nieudane: ${err.message}`);
    }
  });

  elements.btnClearStructuredForm.addEventListener("click", () => {
    clearStructuredMacroForm();
    logLine("Wyczyszczono formularz makra strukturalnego.");
  });

  elements.btnStartPicker.addEventListener("click", async () => {
    try {
      const response = await callWorker({ type: "START_PICKER" });
      logLine(`Picker started on active tab ${response.tabId}. Click element on page.`);
    } catch (err) {
      logLine(`Picker failed: ${err.message}`);
    }
  });

  elements.btnRun.addEventListener("click", async () => {
    const macroNames = getSelectedRunMacros();
    if (macroNames.length === 0) {
      logLine("Select at least one macro in run list.");
      return;
    }

    try {
      const response = await callWorker({
        type: "RUN_MACROS",
        macroNames,
        targetMode: elements.targetMode.value,
        repeats: safeNumber(elements.repeats.value, 1, 100, 1),
        parallelLimit: safeNumber(elements.parallelLimit.value, 1, 30, 12),
        postActionDelayMs: safeNumber(elements.postActionDelayMs.value, 0, 5000, 0),
        skipIntermediateAfterFirstMacro: Boolean(elements.skipIntermediateAfterFirstMacro.checked)
      });
      logLine(`Run started: ${response.runId}, tabs=${response.totalTabs}`);
    } catch (err) {
      logLine(`Run failed to start: ${err.message}`);
    }
  });

  elements.btnStop.addEventListener("click", async () => {
    try {
      const response = await callWorker({ type: "STOP_RUN" });
      logLine(`Stop requested for run: ${response.runId || "none"}`);
    } catch (err) {
      logLine(`Stop request failed: ${err.message}`);
    }
  });

  elements.btnExportJson.addEventListener("click", () => {
    elements.jsonTransfer.value = JSON.stringify(state.data, null, 2);
    logLine("Exported current data to JSON box.");
  });

  elements.btnImportFile.addEventListener("click", async () => {
    const file = elements.jsonFileInput.files?.[0];
    if (!file) {
      logLine("Select a JSON file first.");
      return;
    }

    try {
      const text = await file.text();
      const lowerName = String(file.name || "").toLowerCase();
      let importedData;

      if (lowerName.endsWith(".csv")) {
        importedData = importLegacyCsvData(text, state.data.settings);
      } else {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && parsed.macros) {
          importedData = normalizeData(parsed);
        } else {
          importedData = normalizeData({
            version: 1,
            macros: parsed,
            settings: state.data.settings
          });
        }
      }

      state.data = importedData;
      await persistData();
      elements.jsonTransfer.value = JSON.stringify(state.data, null, 2);

      if (lowerName.endsWith(".csv")) {
        logLine(`Imported legacy CSV: ${file.name} | macros: ${Object.keys(state.data.macros).length}`);
      } else {
        logLine(`Imported JSON from file: ${file.name}`);
      }
    } catch (err) {
      logLine(`File import failed: ${err.message}`);
    }
  });

  elements.btnImportJson.addEventListener("click", async () => {
    const raw = elements.jsonTransfer.value.trim();
    if (!raw) {
      logLine("Paste JSON first.");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      let imported;

      if (parsed && typeof parsed === "object" && parsed.macros) {
        imported = parsed;
      } else {
        imported = {
          version: 1,
          macros: parsed,
          settings: state.data.settings
        };
      }

      state.data = normalizeData(imported);
      await persistData();
      logLine("JSON import completed.");
    } catch (err) {
      logLine(`Import failed: ${err.message}`);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message.type !== "string") {
      return;
    }

    if (message.type === "RUN_STATUS") {
      if (message.event === "run-start") {
        logLine(`Run ${message.runId} started for ${message.totalTabs} tabs.`);
      } else if (message.event === "progress") {
        logLine(`Progress: ${message.processedTabs}/${message.totalTabs}`);
      } else if (message.event === "tab-complete") {
        if (message.status === "ok") {
          logLine(`Tab ${message.tabId} completed.`);
        } else if (message.status === "failed") {
          logLine(`Tab ${message.tabId} failed: ${message.error}`);
        } else {
          logLine(`Tab ${message.tabId} stopped.`);
        }
      } else if (message.event === "intermediate-start") {
        logLine(`Akcje posrednie po makrze: ${message.afterMacro}`);
      } else if (message.event === "intermediate-complete") {
        logLine(`Zakonczono akcje posrednie po: ${message.afterMacro}`);
      } else if (message.event === "run-complete") {
        const summary = message.summary || {};
        logLine(
          `Run ${message.runId} done. ok=${summary.ok || 0}, failed=${summary.failed || 0}, stopped=${summary.stopped || 0}`
        );
      } else if (message.event === "stop-requested") {
        logLine(`Stop requested for run ${message.runId}.`);
      }
      return;
    }

    if (message.type === "PICKER_RESULT") {
      const payload = message.payload || {};
      if (payload.text) {
        elements.actionType.value = "web_click_text";
        elements.actionValue.value = payload.text;
        elements.actionLabel.value = payload.label || payload.text;
        elements.actionTag.value = payload.tag || "button";
        elements.actionExact.checked = true;
        elements.actionIgnoreNavigation.checked = payload.ignore_navigation !== false;
      } else {
        elements.actionType.value = "web_click";
        elements.actionValue.value = payload.selector || "";
        elements.actionLabel.value = payload.label || payload.selector || "picked element";
      }
      logLine(`Picker captured element: ${payload.label || payload.selector || "unknown"}`);
      return;
    }

    if (message.type === "PICKER_CANCELLED") {
      logLine("Picker cancelled.");
    }
  });
}

async function bootstrap() {
  bindEvents();
  initializeStructuredModifierTable();
  syncActionTypeUi();
  await refreshData();
  logLine("Side panel ready.");
}

bootstrap().catch((err) => {
  logLine(`Bootstrap failed: ${err.message}`);
});
