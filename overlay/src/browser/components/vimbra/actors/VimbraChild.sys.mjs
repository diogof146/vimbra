import { clearTimeout, setTimeout } from "resource://gre/modules/Timer.sys.mjs";
import { COMMANDS_BY_NAME } from "moz-src:///browser/components/vimbra/VimbraCommands.sys.mjs";
import { VimbraHints } from "moz-src:///browser/components/vimbra/VimbraHints.sys.mjs";
import {
  keyFromEvent,
  VimbraKeymap,
} from "moz-src:///browser/components/vimbra/VimbraKeymap.sys.mjs";

const ENABLED_PREF = "vimbra.vim.enabled";
const SEQUENCE_TIMEOUT_MS = 1000;

const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

function isEditable(element) {
  if (!element) {
    return false;
  }
  if (element.isContentEditable) {
    return true;
  }
  switch (element.localName) {
    case "textarea":
    case "select":
      return true;
    case "input":
      return TEXT_INPUT_TYPES.has(element.type);
  }
  return false;
}

/**
 * Browsing-mode vim keys. Listens at the window root in the content process,
 * so it runs before any listener the page registers.
 */
export class VimbraChild extends JSWindowActorChild {
  #pending = "";
  #pendingTimer = null;
  #swallowedKeyUps = new Set();
  #hints = null;

  handleEvent(event) {
    if (event.type == "keyup") {
      if (this.#swallowedKeyUps.delete(event.code)) {
        this.#consume(event);
      }
      return;
    }
    if (this.#hints) {
      const key = keyFromEvent(event);
      if (key) {
        this.#swallow(event);
        this.#hints.handleKey(key);
      }
      return;
    }
    if (
      event.key == "Escape" &&
      !event.isComposing &&
      this.#leaveTextField()
    ) {
      this.#swallow(event);
      return;
    }
    if (event.key == "Escape") {
      // Not consumed: pages use Escape to close their own dialogs.
      this.sendAsyncMessage("Vimbra:Escape");
    }
    if (!this.#shouldHandle(event)) {
      this.#clearPending();
      return;
    }
    const key = keyFromEvent(event);
    if (!key) {
      return;
    }

    const { bindings, prefixes } = VimbraKeymap.current();
    const sequence = this.#pending + key;
    const command = bindings.get(sequence);
    if (prefixes.has(sequence)) {
      this.#swallow(event);
      this.#setPending(sequence, command);
    } else if (command) {
      this.#clearPending();
      this.#swallow(event);
      this.#run(command);
    } else if (this.#pending) {
      this.#clearPending();
      this.handleEvent(event);
    }
  }

  didDestroy() {
    this.#clearPending();
    this.#hints?.close();
  }

  showHints({ newTab }) {
    this.#hints?.close();
    const hints = new VimbraHints(this.contentWindow, {
      newTab,
      onClose: () => {
        if (this.#hints == hints) {
          this.#hints = null;
        }
      },
    });
    if (hints.show()) {
      this.#hints = hints;
    }
  }

  #shouldHandle(event) {
    return (
      Services.prefs.getBoolPref(ENABLED_PREF, true) &&
      !event.isComposing &&
      this.document.designMode != "on" &&
      !isEditable(this.#deepActiveElement())
    );
  }

  /**
   * Blurs the focused text field so browsing keys work again. Returns false
   * when no text field is focused.
   */
  #leaveTextField() {
    const element = this.#deepActiveElement();
    if (
      !Services.prefs.getBoolPref(ENABLED_PREF, true) ||
      !isEditable(element)
    ) {
      return false;
    }
    element.blur();
    return true;
  }

  #deepActiveElement() {
    let element = this.document.activeElement;
    while (element?.openOrClosedShadowRoot?.activeElement) {
      element = element.openOrClosedShadowRoot.activeElement;
    }
    return element;
  }

  #run(name) {
    const command = COMMANDS_BY_NAME.get(name);
    if (command.scope == "content") {
      command.run(this.contentWindow, this);
    } else {
      this.sendAsyncMessage("Vimbra:RunCommand", { name });
    }
  }

  #swallow(event) {
    this.#swallowedKeyUps.add(event.code);
    this.#consume(event);
  }

  #consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  /**
   * Waits for the next key of a sequence. When the sequence so far is also a
   * binding of its own (g and gg), it runs after the timeout, as in vim.
   */
  #setPending(sequence, commandOnTimeout) {
    this.#pending = sequence;
    clearTimeout(this.#pendingTimer);
    this.#pendingTimer = setTimeout(() => {
      this.#clearPending();
      if (commandOnTimeout) {
        this.#run(commandOnTimeout);
      }
    }, SEQUENCE_TIMEOUT_MS);
  }

  #clearPending() {
    this.#pending = "";
    clearTimeout(this.#pendingTimer);
    this.#pendingTimer = null;
  }
}
