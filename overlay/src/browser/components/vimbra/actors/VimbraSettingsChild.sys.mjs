/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const HTML_NS = "http://www.w3.org/1999/xhtml";
const CARD_CLASS = "vimbra-theme-card";
const FIELDS = "moz-input-search, moz-input-text";
// Settings' text fields draw the native focus ring inside their shadow DOM,
// out of reach of Vimbra's style sheets; the lighter fill on focus marks focus.
const FIELD_SHEET = "input:focus-visible { outline: none; }";

const STRINGS = {
  en: {
    title: "Vimbra theme",
    description:
      "Colours for tabs, toolbars, menus and Vimbra's pages. Hover to preview.",
  },
  pt: {
    title: "Tema do Vimbra",
    description:
      "Cores dos separadores, barras, menus e páginas do Vimbra. Passe o rato para pré-visualizar.",
  },
};

/**
 * Adds the Vimbra theme picker to the top of Settings > Appearance.
 * Hovering a swatch previews it across the browser; clicking saves it.
 */
export class VimbraSettingsChild extends JSWindowActorChild {
  handleEvent(event) {
    switch (event.type) {
      case "DOMContentLoaded":
        this.#waitForAppearancePane();
        this.#calmFieldFocusRings();
        break;
      case "pagehide":
        this.#observer?.disconnect();
        this.sendAsyncMessage("VimbraSettings:Preview", { id: null });
        break;
    }
  }

  #observer = null;
  #fieldSheet = null;

  #calmFieldFocusRings() {
    const win = this.contentWindow;
    const doc = this.document;
    const calm = field => {
      const root = field?.shadowRoot;
      if (!root) {
        return;
      }
      if (!this.#fieldSheet) {
        this.#fieldSheet = new win.CSSStyleSheet();
        this.#fieldSheet.replaceSync(FIELD_SHEET);
      }
      if (!root.adoptedStyleSheets.includes(this.#fieldSheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.#fieldSheet];
      }
    };
    // Fields attach their shadow DOM after the page loads, so catch them as
    // they take focus, before the ring is painted (focus is retargeted to
    // the field itself in the light DOM).
    doc.addEventListener(
      "focusin",
      event => calm(event.target.closest?.(FIELDS)),
      true
    );
    for (const field of doc.querySelectorAll(FIELDS)) {
      field.updateComplete?.then(() => calm(field));
      calm(field);
    }
  }

  /** Settings panes render lazily, so wait until Appearance exists. */
  #waitForAppearancePane() {
    const doc = this.document;
    const tryInsert = () => {
      if (doc.querySelector(`.${CARD_CLASS}`)) {
        return true;
      }
      const pane = doc.querySelector(
        'setting-pane[data-category="paneAppearance"] > section'
      );
      if (!pane) {
        return false;
      }
      this.#insertPicker(pane);
      return true;
    };
    if (tryInsert()) {
      return;
    }
    this.#observer = new this.contentWindow.MutationObserver(() => {
      if (tryInsert()) {
        this.#observer.disconnect();
      }
    });
    this.#observer.observe(doc.documentElement, { childList: true, subtree: true });
  }

  async #insertPicker(pane) {
    const doc = this.document;
    const card = doc.createElementNS(HTML_NS, "section");
    card.className = CARD_CLASS;
    // Claim the slot synchronously so a second mutation does not add another.
    const header = pane.querySelector(":scope > moz-page-header");
    pane.insertBefore(card, header ? header.nextSibling : pane.firstChild);

    let state;
    try {
      state = await this.sendQuery("VimbraSettings:Get");
    } catch (e) {
      card.remove();
      return;
    }
    const lang = state.locale.startsWith("pt") ? "pt" : "en";
    const strings = STRINGS[lang];
    const byId = new Map(state.themes.map(theme => [theme.id, theme]));

    const title = doc.createElementNS(HTML_NS, "h2");
    title.textContent = strings.title;
    const description = doc.createElementNS(HTML_NS, "p");
    description.textContent = strings.description;
    const swatches = doc.createElementNS(HTML_NS, "div");
    swatches.className = "vimbra-swatches";
    swatches.setAttribute("role", "group");
    swatches.setAttribute("aria-label", strings.title);

    const bands = swatch => {
      const span = doc.createElementNS(HTML_NS, "span");
      for (const color of [swatch.strip, swatch.chrome, swatch.page]) {
        const band = doc.createElementNS(HTML_NS, "i");
        band.style.background = color;
        span.append(band);
      }
      const eye = doc.createElementNS(HTML_NS, "b");
      eye.style.background = `radial-gradient(circle at 45% 60%, #fff, ${swatch.iris} 45%, color-mix(in srgb, ${swatch.iris} 55%, #000))`;
      span.lastChild.append(eye);
      return span;
    };

    for (const theme of state.themes) {
      const button = doc.createElementNS(HTML_NS, "button");
      button.className = "vimbra-swatch";
      button.type = "button";
      button.dataset.theme = theme.id;
      button.setAttribute("aria-pressed", String(theme.id == state.current));
      const mini = doc.createElementNS(HTML_NS, "span");
      mini.className = "vimbra-mini";
      const parts = theme.follows
        ? theme.follows.map(id => byId.get(id).swatch)
        : [theme.swatch];
      for (const swatch of parts) {
        mini.append(bands(swatch));
      }
      const name = doc.createElementNS(HTML_NS, "span");
      name.className = "vimbra-swatch-name";
      name.textContent = theme.names[lang];
      button.append(mini, name);
      swatches.append(button);
    }

    swatches.addEventListener("mouseover", event => {
      const button = event.target.closest(".vimbra-swatch");
      if (button) {
        this.sendAsyncMessage("VimbraSettings:Preview", { id: button.dataset.theme });
      }
    });
    swatches.addEventListener("mouseleave", () => {
      this.sendAsyncMessage("VimbraSettings:Preview", { id: null });
    });
    swatches.addEventListener("click", event => {
      const button = event.target.closest(".vimbra-swatch");
      if (!button) {
        return;
      }
      this.sendAsyncMessage("VimbraSettings:Set", { id: button.dataset.theme });
      for (const other of swatches.children) {
        other.setAttribute("aria-pressed", String(other == button));
      }
    });

    card.append(title, description, swatches);
  }
}
