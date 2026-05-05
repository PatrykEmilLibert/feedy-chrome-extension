const pickerState = {
  enabled: false,
  hoverElement: null,
  originalOutline: null
};

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isVisible(element) {
  if (!element) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function elementMatchesIgnoreNavigation(element) {
  return Boolean(element.closest("nav, header, [role='navigation'], .menu, .navbar, .sidebar"));
}

function isEditable(element) {
  if (!element) {
    return false;
  }

  if (element.isContentEditable) {
    return true;
  }

  const tag = element.tagName.toLowerCase();
  if (tag === "textarea") {
    return true;
  }

  if (tag !== "input") {
    return false;
  }

  const type = (element.getAttribute("type") || "text").toLowerCase();
  return !["button", "submit", "checkbox", "radio", "file", "image", "range", "color", "reset"].includes(type);
}

function focusRelative(shiftPressed) {
  const focusable = Array.from(
    document.querySelectorAll(
      "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )
  ).filter(isVisible);

  if (focusable.length === 0) {
    return false;
  }

  const active = document.activeElement;
  const index = Math.max(0, focusable.indexOf(active));
  let nextIndex = shiftPressed ? index - 1 : index + 1;

  if (nextIndex < 0) {
    nextIndex = focusable.length - 1;
  }
  if (nextIndex >= focusable.length) {
    nextIndex = 0;
  }

  focusable[nextIndex].focus();
  return true;
}

function dispatchKeyboard(target, type, key, options = {}) {
  const event = new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    composed: true,
    ...options
  });
  target.dispatchEvent(event);
}

function selectAllInEditable(target) {
  if (!isEditable(target)) {
    return false;
  }

  target.focus();

  if (target.isContentEditable) {
    const selection = window.getSelection();
    if (!selection) {
      return false;
    }
    const range = document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  if (typeof target.select === "function") {
    target.select();
    return true;
  }

  const length = String(target.value || "").length;
  if (typeof target.setSelectionRange === "function") {
    target.setSelectionRange(0, length);
    return true;
  }

  return false;
}

function moveCaretToEnd(target) {
  if (!isEditable(target)) {
    return false;
  }

  target.focus();

  if (target.isContentEditable) {
    const selection = window.getSelection();
    if (!selection) {
      return false;
    }
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  const length = String(target.value || "").length;
  if (typeof target.setSelectionRange === "function") {
    target.setSelectionRange(length, length);
    return true;
  }

  return false;
}

function insertTextIntoContentEditable(target, text) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    target.textContent = `${target.textContent || ""}${text}`;
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const node = document.createTextNode(text);
  range.insertNode(node);

  const nextRange = document.createRange();
  nextRange.setStartAfter(node);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function applyTextInput(text) {
  const preferredTarget = document.activeElement;
  let target = isEditable(preferredTarget)
    ? preferredTarget
    : document.querySelector("input:not([type='hidden']):not([disabled]), textarea:not([disabled]), [contenteditable='true']");

  if (!target) {
    throw new Error("No editable element focused or available.");
  }

  target.focus();

  if (target.isContentEditable) {
    const inserted = document.execCommand("insertText", false, text);
    if (!inserted) {
      insertTextIntoContentEditable(target, text);
    }
    return;
  }

  const oldValue = target.value || "";
  const hasSelectionRange =
    typeof target.selectionStart === "number" && typeof target.selectionEnd === "number";

  const selectionStart = hasSelectionRange ? target.selectionStart : oldValue.length;
  const selectionEnd = hasSelectionRange ? target.selectionEnd : oldValue.length;

  const newValue = `${oldValue.slice(0, selectionStart)}${text}${oldValue.slice(selectionEnd)}`;
  target.value = newValue;

  const caret = selectionStart + text.length;
  if (typeof target.setSelectionRange === "function") {
    target.setSelectionRange(caret, caret);
  }

  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}

function parseKeyCombo(value) {
  return String(value || "")
    .split("+")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function executeKeyAction(action) {
  const combo = parseKeyCombo(action.value);
  if (combo.length === 0) {
    throw new Error("Key action has no key value.");
  }

  const initialTarget = document.activeElement || document.body;
  const modifiers = {
    ctrlKey: combo.includes("ctrl") || combo.includes("control"),
    shiftKey: combo.includes("shift"),
    altKey: combo.includes("alt")
  };

  const nonModifiers = combo.filter((token) => !["ctrl", "control", "shift", "alt"].includes(token));
  const finalKey = nonModifiers[nonModifiers.length - 1] || "";

  if (finalKey === "tab") {
    dispatchKeyboard(initialTarget, "keydown", "Tab", modifiers);
    dispatchKeyboard(initialTarget, "keyup", "Tab", modifiers);

    const moved = focusRelative(modifiers.shiftKey);
    if (moved) {
      selectAllInEditable(document.activeElement);
    }
    return;
  }

  if (finalKey === "right") {
    if (moveCaretToEnd(document.activeElement)) {
      return;
    }
  }

  const target = document.activeElement || document.body;
  dispatchKeyboard(target, "keydown", finalKey || "", modifiers);
  dispatchKeyboard(target, "keyup", finalKey || "", modifiers);

  if (finalKey === "enter") {
    if (typeof target.click === "function") {
      try {
        target.click();
      } catch (_err) {
        // Ignore click failures.
      }
    }
  }
}

function getWebClickElement(selector) {
  if (!selector || typeof selector !== "string") {
    throw new Error("web_click action requires selector in value.");
  }

  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found for selector: ${selector}`);
  }

  return element;
}

function findElementByText(action) {
  const wantedText = normalizeText(action.value);
  if (!wantedText) {
    throw new Error("web_click_text action requires text value.");
  }

  const tag = normalizeText(action.tag || "button").toLowerCase();
  const exact = Boolean(action.exact);
  const ignoreNavigation = Boolean(action.ignore_navigation);

  const selector = tag === "*" ? "*" : tag;
  const candidates = Array.from(document.querySelectorAll(selector));

  const filtered = candidates.filter((element) => {
    if (!isVisible(element)) {
      return false;
    }
    if (ignoreNavigation && elementMatchesIgnoreNavigation(element)) {
      return false;
    }

    const textFromNode = normalizeText(
      element.innerText ||
        element.textContent ||
        element.value ||
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        ""
    );

    if (!textFromNode) {
      return false;
    }

    if (exact) {
      return textFromNode === wantedText;
    }
    return textFromNode.toLowerCase().includes(wantedText.toLowerCase());
  });

  if (filtered.length === 0) {
    throw new Error(`No visible element found for text: ${wantedText}`);
  }

  return filtered[0];
}

function matchesByMode(sourceText, wantedText, exact) {
  const left = normalizeText(sourceText);
  const right = normalizeText(wantedText);
  if (!left || !right) {
    return false;
  }
  if (exact) {
    return left === right;
  }
  return left.toLowerCase().includes(right.toLowerCase());
}

function getEditableFieldSearchText(element) {
  const valueText = element.isContentEditable ? element.textContent || "" : element.value || "";
  const placeholder = element.getAttribute("placeholder") || "";
  const ariaLabel = element.getAttribute("aria-label") || "";
  const title = element.getAttribute("title") || "";
  const name = element.getAttribute("name") || "";
  const id = element.getAttribute("id") || "";

  const labelsText = [];
  if (element.labels && element.labels.length > 0) {
    labelsText.push(...Array.from(element.labels).map((label) => label.textContent || ""));
  }

  if (id) {
    const forLabel = document.querySelector(`label[for='${CSS.escape(id)}']`);
    if (forLabel) {
      labelsText.push(forLabel.textContent || "");
    }
  }

  const parentLabel = element.closest("label");
  if (parentLabel) {
    labelsText.push(parentLabel.textContent || "");
  }

  return {
    valueText,
    metaText: [placeholder, ariaLabel, title, name, id, ...labelsText].join(" ")
  };
}

function findEditableByFragmentWithMode(candidates, wantedText, exact) {
  // Prefer matching user-visible field value/content first.
  for (const element of candidates) {
    const { valueText } = getEditableFieldSearchText(element);
    if (matchesByMode(valueText, wantedText, exact)) {
      return element;
    }
  }

  // Then fallback to metadata/labels associated with field.
  for (const element of candidates) {
    const { metaText } = getEditableFieldSearchText(element);
    if (matchesByMode(metaText, wantedText, exact)) {
      return element;
    }
  }

  return null;
}

function findEditableByFragment(action) {
  const wantedText = normalizeText(action.value);
  if (!wantedText) {
    throw new Error("focus_input_fragment action requires text fragment in value.");
  }

  const exact = Boolean(action.exact);
  const candidates = Array.from(
    document.querySelectorAll(
      "input:not([type='hidden']):not([disabled]), textarea:not([disabled]), [contenteditable='true']"
    )
  ).filter((element) => isVisible(element) && isEditable(element));

  if (candidates.length === 0) {
    throw new Error("No editable fields found on page.");
  }

  const strictMatch = findEditableByFragmentWithMode(candidates, wantedText, exact);
  if (strictMatch) {
    return strictMatch;
  }

  // Fallback: if action was mistakenly saved as exact=true, try fragment mode anyway.
  if (exact) {
    const relaxedMatch = findEditableByFragmentWithMode(candidates, wantedText, false);
    if (relaxedMatch) {
      return relaxedMatch;
    }
  }

  throw new Error(`No editable field found for fragment: ${wantedText}`);
}

function clickElement(element) {
  element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  element.focus({ preventScroll: true });
  element.click();
}

async function executeAction(action) {
  if (!action || typeof action !== "object") {
    throw new Error("Action payload missing.");
  }

  const actionType = action.type;

  if (actionType === "web_click") {
    clickElement(getWebClickElement(action.value || action.selector));
    return { ok: true, actionType };
  }

  if (actionType === "web_click_text") {
    clickElement(findElementByText(action));
    return { ok: true, actionType };
  }

  if (actionType === "focus_input_fragment") {
    const field = findEditableByFragment(action);
    clickElement(field);
    return { ok: true, actionType };
  }

  if (actionType === "key") {
    executeKeyAction(action);
    return { ok: true, actionType };
  }

  if (actionType === "text") {
    applyTextInput(String(action.value || ""));
    return { ok: true, actionType };
  }

  throw new Error(`Unsupported action type in extension: ${actionType}`);
}

function uniqueSelectorFromElement(element) {
  if (!element) {
    return "";
  }

  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const attrs = ["data-testid", "data-test", "name", "aria-label"];
  for (const attrName of attrs) {
    const attrValue = element.getAttribute(attrName);
    if (!attrValue) {
      continue;
    }
    const candidate = `${element.tagName.toLowerCase()}[${attrName}='${CSS.escape(attrValue)}']`;
    if (document.querySelectorAll(candidate).length === 1) {
      return candidate;
    }
  }

  const classNames = Array.from(element.classList || []).slice(0, 2);
  if (classNames.length > 0) {
    const candidate = `${element.tagName.toLowerCase()}.${classNames.map((name) => CSS.escape(name)).join(".")}`;
    if (document.querySelectorAll(candidate).length === 1) {
      return candidate;
    }
  }

  const path = [];
  let node = element;
  while (node && node.nodeType === Node.ELEMENT_NODE && path.length < 6) {
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) {
      path.unshift(tag);
      break;
    }

    const siblings = Array.from(parent.children).filter((sibling) => sibling.tagName === node.tagName);
    if (siblings.length === 1) {
      path.unshift(tag);
    } else {
      const index = siblings.indexOf(node) + 1;
      path.unshift(`${tag}:nth-of-type(${index})`);
    }

    const candidate = path.join(" > ");
    if (candidate && document.querySelectorAll(candidate).length === 1) {
      return candidate;
    }

    node = parent;
  }

  return path.join(" > ");
}

function clearHoverHighlight() {
  if (!pickerState.hoverElement) {
    return;
  }

  pickerState.hoverElement.style.outline = pickerState.originalOutline || "";
  pickerState.hoverElement = null;
  pickerState.originalOutline = null;
}

function setHoverHighlight(element) {
  if (pickerState.hoverElement === element) {
    return;
  }

  clearHoverHighlight();
  pickerState.hoverElement = element;
  pickerState.originalOutline = element.style.outline;
  element.style.outline = "2px solid #ff3366";
}

function stopPicker(cancelled = false) {
  if (!pickerState.enabled) {
    return;
  }

  pickerState.enabled = false;
  clearHoverHighlight();

  document.removeEventListener("mousemove", onPickerMouseMove, true);
  document.removeEventListener("click", onPickerClick, true);
  document.removeEventListener("keydown", onPickerKeyDown, true);

  if (cancelled) {
    chrome.runtime.sendMessage({ type: "PICKER_CANCELLED" }).catch(() => {});
  }
}

function onPickerMouseMove(event) {
  const element = event.target;
  if (!(element instanceof HTMLElement)) {
    return;
  }
  setHoverHighlight(element);
}

function onPickerClick(event) {
  event.preventDefault();
  event.stopPropagation();

  const element = event.target;
  if (!(element instanceof HTMLElement)) {
    stopPicker(true);
    return;
  }

  const selector = uniqueSelectorFromElement(element);
  const tag = element.tagName.toLowerCase();
  const text = normalizeText(
    element.innerText || element.textContent || element.value || element.getAttribute("aria-label") || ""
  );

  const payload = {
    selector,
    tag,
    text,
    label: text.slice(0, 80) || `${tag} element`,
    exact: true,
    ignore_navigation: true
  };

  stopPicker(false);

  chrome.runtime.sendMessage({
    type: "PICKER_RESULT",
    payload
  }).catch(() => {});
}

function onPickerKeyDown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    stopPicker(true);
  }
}

function startPicker() {
  if (pickerState.enabled) {
    return;
  }

  pickerState.enabled = true;

  document.addEventListener("mousemove", onPickerMouseMove, true);
  document.addEventListener("click", onPickerClick, true);
  document.addEventListener("keydown", onPickerKeyDown, true);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "EXECUTE_ACTION") {
    executeAction(message.action)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err || "Action error") }));
    return true;
  }

  if (message.type === "START_PICKER") {
    startPicker();
    sendResponse({ ok: true, pickerStarted: true });
    return false;
  }

  return false;
});
