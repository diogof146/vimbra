/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const THEME_PREF = "vimbra.theme";
export const PREVIEW_PREF = "vimbra.theme.preview";
export const HOME_URL = "about:vimbra";

const SHEETS = [
  "chrome://browser/content/vimbra/vimbra-tokens.css",
  "chrome://browser/content/vimbra/vimbra-chrome.css",
  "chrome://browser/content/vimbra/vimbra-pages.css",
];

/**
 * The themes the settings picker offers, with the colours its swatches show.
 * The full palettes live in vimbra-tokens.css, keyed by the same ids.
 */
export const THEMES = [
  {
    id: "noite",
    names: { en: "Night", pt: "Noite" },
    swatch: { strip: "#1b1b1b", chrome: "#090909", page: "#0f0f0f", iris: "#2ee6d6" },
  },
  {
    id: "ametista",
    names: { en: "Amethyst", pt: "Ametista" },
    swatch: { strip: "#1d1231", chrome: "#0c0618", page: "#12082a", iris: "#ff4f8b" },
  },
  {
    id: "iris",
    names: { en: "Iris", pt: "Íris" },
    swatch: { strip: "#0d1f22", chrome: "#041012", page: "#071719", iris: "#7cf5e9" },
  },
  {
    id: "brasa",
    names: { en: "Ember", pt: "Brasa" },
    swatch: { strip: "#1f150e", chrome: "#0c0805", page: "#140e09", iris: "#ffb547" },
  },
  {
    id: "cobalto",
    names: { en: "Cobalt", pt: "Cobalto" },
    swatch: { strip: "#0b1022", chrome: "#070a16", page: "#122f7e", iris: "#5b8cff" },
  },
  {
    id: "dia",
    names: { en: "Day", pt: "Dia" },
    swatch: { strip: "#e3dfeb", chrome: "#f4f2f8", page: "#fbfaff", iris: "#2ee6d6" },
  },
  // Follows the system's light or dark setting: Dia or Noite.
  { id: "sistema", names: { en: "System", pt: "Sistema" }, follows: ["dia", "noite"] },
];

const THEME_IDS = new Set(THEMES.map(theme => theme.id));

/**
 * Registers the window actors this module owns. They live here rather than in
 * DesktopActorRegistry so the theme stays one self-contained piece.
 */
function registerActors() {
  ChromeUtils.registerWindowActor("VimbraHome", {
    parent: {
      esModuleURI:
        "moz-src:///browser/components/vimbra/actors/VimbraHomeParent.sys.mjs",
    },
    child: {
      esModuleURI:
        "moz-src:///browser/components/vimbra/actors/VimbraHomeChild.sys.mjs",
      events: {
        VimbraHomeGo: { wantUntrusted: true },
      },
    },
    matches: [`${HOME_URL}*`],
  });
  ChromeUtils.registerWindowActor("VimbraSettings", {
    parent: {
      esModuleURI:
        "moz-src:///browser/components/vimbra/actors/VimbraSettingsParent.sys.mjs",
    },
    child: {
      esModuleURI:
        "moz-src:///browser/components/vimbra/actors/VimbraSettingsChild.sys.mjs",
      events: {
        DOMContentLoaded: {},
        pagehide: {},
      },
    },
    matches: ["about:preferences*", "about:settings*"],
  });
}

function importAboutNewTab() {
  for (const url of [
    "resource:///modules/AboutNewTab.sys.mjs",
    "moz-src:///browser/components/newtab/AboutNewTab.sys.mjs",
  ]) {
    try {
      return ChromeUtils.importESModule(url).AboutNewTab;
    } catch (e) {}
  }
  return null;
}

export const VimbraTheme = {
  /**
   * Runs before the first window shows (browser-before-ui-startup): registers
   * the stylesheets for every process and makes about:vimbra the new tab page.
   */
  init() {
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
      Ci.nsIStyleSheetService
    );
    for (const spec of SHEETS) {
      const uri = Services.io.newURI(spec);
      if (!sss.sheetRegistered(uri, sss.AUTHOR_SHEET)) {
        sss.loadAndRegisterSheet(uri, sss.AUTHOR_SHEET);
      }
    }

    // A hover preview never outlives the settings page that started it.
    Services.prefs.clearUserPref(PREVIEW_PREF);
    if (!THEME_IDS.has(this.current())) {
      Services.prefs.clearUserPref(THEME_PREF);
    }

    registerActors();

    // Defaults only: anything the user has set still wins.
    const defaults = Services.prefs.getDefaultBranch("");
    defaults.setStringPref("browser.startup.homepage", HOME_URL);
    defaults.setBoolPref("browser.tabs.firefox-view", false);
    // Tabs shrink to Firefox's floor (50px, favicon only) before scrolling.
    defaults.setIntPref("browser.tabs.tabMinWidth", 50);
    // Thin overlay scrollbars that widen on hover (Windows 11's own style,
    // and its default), on every platform. Web pages keep their own colours:
    // theming them would be observable and fingerprintable.
    defaults.setIntPref("widget.non-native-theme.scrollbar.style", 5);
    defaults.setBoolPref("widget.non-native-theme.win11.scrollbar.force-overlay-style", true);

    const aboutNewTab = importAboutNewTab();
    if (aboutNewTab) {
      aboutNewTab.newTabURL = HOME_URL;
    } else {
      console.error("Vimbra: AboutNewTab not found; new tabs keep Firefox's page");
    }

    // Like about:newtab, the start page leaves the address bar empty.
    Services.obs.addObserver(win => {
      if (Array.isArray(win.gInitialPages) && !win.gInitialPages.includes(HOME_URL)) {
        win.gInitialPages.push(HOME_URL);
      }
    }, "browser-window-before-show");
  },

  current() {
    return Services.prefs.getStringPref(THEME_PREF, "noite");
  },

  /** Persists a theme. Unknown ids are ignored. */
  set(id) {
    if (!THEME_IDS.has(id)) {
      return false;
    }
    Services.prefs.setStringPref(THEME_PREF, id);
    Services.prefs.clearUserPref(PREVIEW_PREF);
    return true;
  },

  /** Shows a theme without saving it; null ends the preview. */
  preview(id) {
    if (id === null) {
      Services.prefs.clearUserPref(PREVIEW_PREF);
    } else if (THEME_IDS.has(id)) {
      Services.prefs.setStringPref(PREVIEW_PREF, id);
    }
  },
};
