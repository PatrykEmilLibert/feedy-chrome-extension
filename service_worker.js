const STORAGE_KEY = "feedyDataV1";

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

const INTERMEDIATE_ACTIONS = [
  { type: "key", value: "tab" },
  { type: "key", value: "tab" },
  { type: "key", value: "tab" },
  { type: "key", value: "tab" },
  { type: "key", value: "tab" },
  { type: "key", value: "tab" },
  { type: "key", value: "enter" },
  { type: "key", value: "shift+tab" },
  { type: "key", value: "shift+tab" },
  { type: "key", value: "shift+tab" },
  { type: "key", value: "shift+tab" },
  { type: "key", value: "enter" },
  { type: "key", value: "tab" },
  { type: "key", value: "tab" },
  { type: "key", value: "tab" },
  { type: "key", value: "tab" },
  { type: "key", value: "right" }
];

let runState = {
  id: null,
  stop: false,
  totalTabs: 0,
  processedTabs: 0
};

chrome.runtime.onInstalled.addListener(() => {
  setSidePanelBehavior();
});

chrome.runtime.onStartup.addListener(() => {
  setSidePanelBehavior();
});

function setSidePanelBehavior() {
  try {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (_err) {
    // Ignore unsupported Chrome variants.
  }
}

function createRunId() {
  return `run_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value, min, max, fallback) {
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

function normalizeData(input) {
  const data = input && typeof input === "object" ? input : {};
  const macros = data.macros && typeof data.macros === "object" ? data.macros : {};
  const rawSettings = data.settings && typeof data.settings === "object" ? data.settings : {};
  const normalizedMacros = {};

  for (const [macroName, macroData] of Object.entries(macros)) {
    if (!macroName || typeof macroName !== "string") {
      continue;
    }
    const actions = Array.isArray(macroData?.actions) ? macroData.actions : [];
    normalizedMacros[macroName] = {
      actions: actions
        .filter((action) => action && typeof action === "object")
        .map((action) => ({ ...action })),
      hotkey: typeof macroData?.hotkey === "string" ? macroData.hotkey : "Brak"
    };
  }

  const settings = {
    ...DEFAULT_DATA.settings,
    ...rawSettings
  };

  settings.parallelLimit = clampNumber(settings.parallelLimit, 1, 30, DEFAULT_DATA.settings.parallelLimit);
  settings.postActionDelayMs = clampNumber(settings.postActionDelayMs, 0, 5000, DEFAULT_DATA.settings.postActionDelayMs);
  settings.actionTimeoutMs = clampNumber(settings.actionTimeoutMs, 500, 60000, DEFAULT_DATA.settings.actionTimeoutMs);
  settings.repeats = clampNumber(settings.repeats, 1, 100, DEFAULT_DATA.settings.repeats);
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

async function loadData() {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeData(raw[STORAGE_KEY]);
}

async function saveData(data) {
  const normalized = normalizeData(data);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
  return normalized;
}

async function emitStatus(event, payload = {}) {
  try {
    await chrome.runtime.sendMessage({
      type: "RUN_STATUS",
      event,
      ...payload
    });
  } catch (_err) {
    // Side panel may be closed; this is fine.
  }
}

function isRunStopped(runId) {
  return runState.id !== runId || runState.stop;
}

function isUsableTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    return false;
  }
  return /^https?:/i.test(tab.url || "");
}

async function getTargetTabs(targetMode, explicitTabIds = []) {
  const mode = targetMode || "active";

  if (mode === "tabIds" && Array.isArray(explicitTabIds) && explicitTabIds.length > 0) {
    const results = [];
    for (const tabId of explicitTabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (isUsableTab(tab)) {
          results.push(tab);
        }
      } catch (_err) {
        // Ignore missing tabs.
      }
    }
    return results;
  }

  if (mode === "active") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs.filter(isUsableTab);
  }

  if (mode === "allCurrentWindow") {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs.filter(isUsableTab);
  }

  if (mode === "sameDomain") {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!isUsableTab(activeTab)) {
      return [];
    }

    let host = "";
    try {
      host = new URL(activeTab.url).host;
    } catch (_err) {
      return [];
    }

    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs.filter((tab) => {
      if (!isUsableTab(tab)) {
        return false;
      }
      try {
        return new URL(tab.url).host === host;
      } catch (_err) {
        return false;
      }
    });
  }

  return [];
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(label || "TIMEOUT"));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content_script.js"]
  });
}

async function sendMessageToTab(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch (_err) {
    await ensureContentScript(tabId);
    return await chrome.tabs.sendMessage(tabId, payload);
  }
}

async function executeActionOnTab(tabId, action, runConfig) {
  const response = await withTimeout(
    sendMessageToTab(tabId, {
      type: "EXECUTE_ACTION",
      action,
      context: {
        runId: runConfig.runId,
        postActionDelayMs: runConfig.postActionDelayMs
      }
    }),
    runConfig.actionTimeoutMs,
    "Action timeout"
  );

  if (!response || !response.ok) {
    throw new Error(response?.error || "Action failed");
  }

  return response;
}

const RUN_STOPPED_ERROR_CODE = "RUN_STOPPED";

function createRunStoppedError() {
  const err = new Error("Run stopped");
  err.code = RUN_STOPPED_ERROR_CODE;
  return err;
}

function isRunStoppedError(err) {
  return err?.code === RUN_STOPPED_ERROR_CODE;
}

async function finalizeTab(runId, tabId, status, summary, finalizedTabs, errorText = null) {
  if (finalizedTabs.has(tabId)) {
    return;
  }

  finalizedTabs.add(tabId);

  if (status === "ok") {
    summary.ok += 1;
  } else if (status === "stopped") {
    summary.stopped += 1;
  } else {
    summary.failed += 1;
    if (errorText) {
      summary.errors.push({ tabId, error: errorText });
    }
  }

  runState.processedTabs += 1;

  await emitStatus("tab-complete", {
    runId,
    tabId,
    status,
    ...(errorText ? { error: errorText } : {})
  });

  await emitStatus("progress", {
    runId,
    processedTabs: runState.processedTabs,
    totalTabs: runState.totalTabs
  });
}

async function executeActionWithDelay(tabId, action, runConfig) {
  if (isRunStopped(runConfig.runId)) {
    throw createRunStoppedError();
  }

  await executeActionOnTab(tabId, action, runConfig);

  const actionType = String(action?.type || "").toLowerCase();
  const isWebAction = actionType === "web_click" || actionType === "web_click_text";
  const delayMs = isWebAction ? Math.min(runConfig.postActionDelayMs, 40) : Math.min(runConfig.postActionDelayMs, 5);

  if (delayMs > 0) {
    await sleep(delayMs);
  }
}

async function runMacroSequenceOnSingleTab(tabId, macroNames, macrosMap, runConfig) {
  for (let repeatIndex = 0; repeatIndex < runConfig.repeats; repeatIndex += 1) {
    if (isRunStopped(runConfig.runId)) {
      throw createRunStoppedError();
    }

    for (let macroIndex = 0; macroIndex < macroNames.length; macroIndex += 1) {
      if (isRunStopped(runConfig.runId)) {
        throw createRunStoppedError();
      }

      const macroName = macroNames[macroIndex];
      const macroData = macrosMap[macroName];
      const actions = Array.isArray(macroData?.actions) ? macroData.actions : [];

      for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
        if (isRunStopped(runConfig.runId)) {
          throw createRunStoppedError();
        }

        await executeActionWithDelay(tabId, actions[actionIndex], runConfig);
      }

      const isLastMacroInSequence = macroIndex === macroNames.length - 1;
      const skipForFirstMacro = runConfig.skipIntermediateAfterFirstMacro && macroIndex === 0;
      const shouldRunIntermediate = !isLastMacroInSequence && !skipForFirstMacro;

      if (shouldRunIntermediate && !isRunStopped(runConfig.runId)) {
        await emitStatus("intermediate-start", {
          runId: runConfig.runId,
          tabId,
          afterMacro: macroName,
          repeatIndex: repeatIndex + 1,
          repeats: runConfig.repeats
        });

        for (let intermediateIndex = 0; intermediateIndex < INTERMEDIATE_ACTIONS.length; intermediateIndex += 1) {
          if (isRunStopped(runConfig.runId)) {
            throw createRunStoppedError();
          }

          await executeActionWithDelay(tabId, INTERMEDIATE_ACTIONS[intermediateIndex], runConfig);
        }

        await emitStatus("intermediate-complete", {
          runId: runConfig.runId,
          tabId,
          afterMacro: macroName,
          repeatIndex: repeatIndex + 1,
          repeats: runConfig.repeats
        });
      }
    }
  }
}

async function runMacroSequencePoolOnTabs(tabIds, macroNames, macrosMap, runConfig, summary, finalizedTabs) {
  const queue = tabIds.filter((tabId) => typeof tabId === "number");
  let nextIndex = 0;

  const workerCount = Math.max(1, Math.min(runConfig.parallelLimit, queue.length));

  async function worker() {
    while (true) {
      if (isRunStopped(runConfig.runId)) {
        return;
      }

      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= queue.length) {
        return;
      }

      const tabId = queue[currentIndex];

      await emitStatus("tab-start", {
        runId: runConfig.runId,
        tabId
      });

      try {
        await runMacroSequenceOnSingleTab(tabId, macroNames, macrosMap, runConfig);

        const status = isRunStopped(runConfig.runId) ? "stopped" : "ok";
        await finalizeTab(runConfig.runId, tabId, status, summary, finalizedTabs);
      } catch (err) {
        if (isRunStoppedError(err)) {
          await finalizeTab(runConfig.runId, tabId, "stopped", summary, finalizedTabs);
        } else {
          await finalizeTab(
            runConfig.runId,
            tabId,
            "failed",
            summary,
            finalizedTabs,
            String(err?.message || err || "Action failed")
          );
        }
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    activeTabIds: [],
    stopped: isRunStopped(runConfig.runId)
  };
}

function buildRunConfig(message, data, runId) {
  const defaults = data.settings || DEFAULT_DATA.settings;

  return {
    runId,
    repeats: clampNumber(message.repeats, 1, 100, defaults.repeats),
    parallelLimit: clampNumber(message.parallelLimit, 1, 30, defaults.parallelLimit),
    postActionDelayMs: clampNumber(message.postActionDelayMs, 0, 5000, defaults.postActionDelayMs),
    actionTimeoutMs: clampNumber(message.actionTimeoutMs, 500, 60000, defaults.actionTimeoutMs),
    skipIntermediateAfterFirstMacro: toBoolean(
      message.skipIntermediateAfterFirstMacro,
      defaults.skipIntermediateAfterFirstMacro
    )
  };
}

async function startRun(message) {
  const data = await loadData();

  const macroNames = Array.isArray(message.macroNames)
    ? [...new Set(message.macroNames.filter((name) => typeof name === "string" && data.macros[name]))]
    : [];

  if (macroNames.length === 0) {
    throw new Error("Select at least one existing macro.");
  }

  const tabs = await getTargetTabs(message.targetMode, message.tabIds);
  if (tabs.length === 0) {
    throw new Error("No compatible tabs found for selected target mode.");
  }

  if (runState.id) {
    runState.stop = true;
    await emitStatus("stop-requested", { runId: runState.id, reason: "New run started" });
  }

  const runId = createRunId();
  runState = {
    id: runId,
    stop: false,
    totalTabs: tabs.length,
    processedTabs: 0
  };

  const runConfig = buildRunConfig(message, data, runId);
  const tabIds = tabs.map((tab) => tab.id);

  void (async () => {
    const summary = {
      ok: 0,
      failed: 0,
      stopped: 0,
      errors: []
    };

    await emitStatus("run-start", {
      runId,
      totalTabs: tabIds.length,
      macroNames,
      targetMode: message.targetMode || "active",
      runConfig
    });

    const finalizedTabs = new Set();

    try {
      await runMacroSequencePoolOnTabs(
        tabIds,
        macroNames,
        data.macros,
        runConfig,
        summary,
        finalizedTabs
      );
    } catch (err) {
      const messageText = String(err?.message || err || "Run failed");
      summary.errors.push({ tabId: null, error: messageText });

      for (const tabId of tabIds) {
        if (!finalizedTabs.has(tabId)) {
          await finalizeTab(runId, tabId, "failed", summary, finalizedTabs, messageText);
        }
      }
    } finally {
      const stopped = runState.stop;
      await emitStatus("run-complete", {
        runId,
        stopped,
        summary
      });

      if (runState.id === runId) {
        runState.id = null;
      }
    }
  })();

  return {
    runId,
    started: true,
    totalTabs: tabIds.length
  };
}

async function stopRun() {
  if (runState.id) {
    runState.stop = true;
    await emitStatus("stop-requested", { runId: runState.id, reason: "User request" });
  }
  return { stopped: true, runId: runState.id };
}

async function startPickerOnActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const [tab] = tabs;

  if (!isUsableTab(tab)) {
    throw new Error("Active tab is not a supported HTTP/HTTPS page.");
  }

  await sendMessageToTab(tab.id, { type: "START_PICKER" });

  return {
    pickerStarted: true,
    tabId: tab.id
  };
}

function handleAsync(sendResponse, handler) {
  handler()
    .then((data) => {
      sendResponse({ ok: true, ...data });
    })
    .catch((err) => {
      sendResponse({ ok: false, error: String(err?.message || err || "Unknown error") });
    });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "GET_DATA") {
    handleAsync(sendResponse, async () => ({ data: await loadData() }));
    return true;
  }

  if (message.type === "SAVE_DATA") {
    handleAsync(sendResponse, async () => ({ data: await saveData(message.data) }));
    return true;
  }

  if (message.type === "RUN_MACROS") {
    handleAsync(sendResponse, async () => await startRun(message));
    return true;
  }

  if (message.type === "STOP_RUN") {
    handleAsync(sendResponse, async () => await stopRun());
    return true;
  }

  if (message.type === "START_PICKER") {
    handleAsync(sendResponse, async () => await startPickerOnActiveTab());
    return true;
  }

  return false;
});
