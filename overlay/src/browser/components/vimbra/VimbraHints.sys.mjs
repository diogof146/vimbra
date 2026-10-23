const HINT_CHARS = "sadfjklewcmpgh";

const CLICKABLE_SELECTOR = [
  "a[href]",
  "button",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  "label",
  "[onclick]",
  "[onmousedown]",
  "[contenteditable]:not([contenteditable=false])",
  "[tabindex]:not([tabindex='-1'])",
  ...[
    "button",
    "link",
    "checkbox",
    "radio",
    "switch",
    "tab",
    "menuitem",
    "option",
    "treeitem",
  ].map(role => `[role=${role}]`),
].join(",");

const CONTAINER_STYLE = {
  position: "fixed",
  inset: "0",
  pointerEvents: "none",
};

const HINT_STYLE = {
  position: "absolute",
  padding: "1px 4px",
  borderRadius: "3px",
  background: "#f9e2af",
  color: "#1e1e2e",
  font: "bold 12px/1.2 ui-monospace, monospace",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
  whiteSpace: "nowrap",
};

const TYPED_STYLE = { opacity: "0.45" };

function* allElements(root) {
  for (const element of root.querySelectorAll("*")) {
    yield element;
    const shadowRoot = element.openOrClosedShadowRoot;
    if (shadowRoot) {
      yield* allElements(shadowRoot);
    }
  }
}

function isClickable(element) {
  const doc = element.ownerDocument;
  if (element == doc.documentElement || element == doc.body) {
    return false;
  }
  return (
    element.matches(CLICKABLE_SELECTOR) ||
    Services.els.hasListenersFor(element, "click") ||
    Services.els.hasListenersFor(element, "mousedown")
  );
}

/**
 * Returns the point to click for `element`, or null if no part of it is
 * visible and on top in the viewport.
 */
function visiblePoint(element, win) {
  if (!element.checkVisibility({ checkOpacity: true, visibilityProperty: true })) {
    return null;
  }
  for (const rect of element.getClientRects()) {
    const left = Math.max(rect.left, 0);
    const top = Math.max(rect.top, 0);
    const right = Math.min(rect.right, win.innerWidth);
    const bottom = Math.min(rect.bottom, win.innerHeight);
    if (right - left < 1 || bottom - top < 1) {
      continue;
    }
    const x = (left + right) / 2;
    const y = (top + bottom) / 2;
    const hit = element.getRootNode().elementFromPoint(x, y);
    if (hit && (hit == element || element.contains(hit))) {
      return { x, y, left, top };
    }
  }
  return null;
}

/**
 * Labels of equal length, so no label is a prefix of another.
 */
function makeLabels(count) {
  const base = HINT_CHARS.length;
  let length = 1;
  while (base ** length < count) {
    length++;
  }
  const labels = [];
  for (let n = 0; n < count; n++) {
    let label = "";
    for (let i = 0, rest = n; i < length; i++, rest = Math.floor(rest / base)) {
      label = HINT_CHARS[rest % base] + label;
    }
    labels.push(label);
  }
  return labels;
}

/**
 * Link hints for one window: labels every visible clickable element, and
 * clicks the one whose label is typed.
 */
export class VimbraHints {
  #win;
  #newTab;
  #onClose;
  #content = null;
  #hints = [];
  #typed = "";

  /**
   * @param {Window} win The window to hint.
   * @param {object} options
   * @param {boolean} options.newTab Click with the new-tab modifier.
   * @param {Function} options.onClose Called once the hints are gone.
   */
  constructor(win, { newTab, onClose }) {
    this.#win = win;
    this.#newTab = newTab;
    this.#onClose = onClose;
  }

  /**
   * Shows the hints. Returns false, and shows nothing, when nothing on screen
   * is clickable.
   */
  show() {
    const targets = [];
    for (const element of allElements(this.#win.document)) {
      if (isClickable(element)) {
        const point = visiblePoint(element, this.#win);
        if (point) {
          targets.push({ element, ...point });
        }
      }
    }
    if (!targets.length) {
      return false;
    }

    const doc = this.#win.document;
    const container = doc.createElement("div");
    Object.assign(container.style, CONTAINER_STYLE);
    const labels = makeLabels(targets.length);
    this.#hints = targets.map((target, i) => {
      const marker = doc.createElement("span");
      Object.assign(marker.style, HINT_STYLE, {
        left: `${target.left}px`,
        top: `${target.top}px`,
      });
      const typed = doc.createElement("span");
      Object.assign(typed.style, TYPED_STYLE);
      const rest = doc.createElement("span");
      rest.textContent = labels[i].toUpperCase();
      marker.append(typed, rest);
      container.append(marker);
      return { ...target, label: labels[i], marker, typed, rest };
    });

    this.#content = doc.insertAnonymousContent();
    this.#content.root.append(container);
    for (const type of ["mousedown", "scroll", "resize", "pagehide"]) {
      this.#win.addEventListener(type, this, { capture: true });
    }
    return true;
  }

  /**
   * Handles a key typed while hints are shown (vim notation).
   */
  handleKey(key) {
    if (key == "<Esc>") {
      this.close();
      return;
    }
    if (key == "<BS>") {
      this.#typed = this.#typed.slice(0, -1);
    } else if (key.length == 1 && HINT_CHARS.includes(key.toLowerCase())) {
      this.#typed += key.toLowerCase();
    } else {
      return;
    }

    const matches = this.#hints.filter(h => h.label.startsWith(this.#typed));
    if (!matches.length) {
      this.#typed = this.#typed.slice(0, -1);
      return;
    }
    if (matches.length == 1 && matches[0].label == this.#typed) {
      this.close();
      this.#click(matches[0]);
      return;
    }
    for (const hint of this.#hints) {
      const match = hint.label.startsWith(this.#typed);
      hint.marker.style.display = match ? "" : "none";
      hint.typed.textContent = match ? this.#typed.toUpperCase() : "";
      hint.rest.textContent = hint.label.slice(this.#typed.length).toUpperCase();
    }
  }

  handleEvent() {
    this.close();
  }

  close() {
    if (!this.#content) {
      return;
    }
    for (const type of ["mousedown", "scroll", "resize", "pagehide"]) {
      this.#win.removeEventListener(type, this, { capture: true });
    }
    try {
      this.#win.document.removeAnonymousContent(this.#content);
    } catch (e) {
      // The document is already gone.
    }
    this.#content = null;
    this.#hints = [];
    this.#onClose();
  }

  #click({ x, y }) {
    let modifiers = 0;
    if (this.#newTab) {
      modifiers =
        Services.appinfo.OS == "Darwin"
          ? Ci.nsIDOMWindowUtils.MODIFIER_META
          : Ci.nsIDOMWindowUtils.MODIFIER_CONTROL;
    }
    for (const type of ["mousedown", "mouseup"]) {
      this.#win.synthesizeMouseEvent(type, x, y, {
        button: 0,
        clickCount: 1,
        modifiers,
      });
    }
  }
}
