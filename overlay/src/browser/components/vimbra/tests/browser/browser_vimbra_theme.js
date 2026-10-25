"use strict";

const { HOME_URL, PREVIEW_PREF, THEME_PREF, THEMES, VimbraTheme } =
  ChromeUtils.importESModule(
    "moz-src:///browser/components/vimbra/VimbraTheme.sys.mjs"
  );

const SHEETS = ["vimbra-tokens.css", "vimbra-chrome.css", "vimbra-pages.css"];

// The tab strip colour of each theme, from vimbra-tokens.css.
const STRIP = {
  noite: "#1b1b1b",
  ametista: "#1d1231",
  iris: "#0d1f22",
  brasa: "#1f150e",
  cobalto: "#0b1022",
  dia: "#e3dfeb",
};

function token(name, doc = document) {
  return doc.defaultView
    .getComputedStyle(doc.documentElement)
    .getPropertyValue(name)
    .trim();
}

registerCleanupFunction(() => {
  Services.prefs.clearUserPref(THEME_PREF);
  Services.prefs.clearUserPref(PREVIEW_PREF);
});

add_task(async function test_sheets_are_registered() {
  const sss = Cc["@mozilla.org/content/style-sheet-service;1"].getService(
    Ci.nsIStyleSheetService
  );
  for (const name of SHEETS) {
    const uri = Services.io.newURI(`chrome://browser/content/vimbra/${name}`);
    Assert.ok(sss.sheetRegistered(uri, sss.AUTHOR_SHEET), `${name} is registered`);
  }
});

add_task(async function test_theme_pref_switches_live() {
  for (const [id, strip] of Object.entries(STRIP)) {
    Services.prefs.setStringPref(THEME_PREF, id);
    await TestUtils.waitForCondition(
      () => token("--vb-strip") == strip,
      `${id} applies its palette`
    );
  }
  Services.prefs.clearUserPref(THEME_PREF);
  await TestUtils.waitForCondition(() => token("--vb-strip") == STRIP.noite);
});

add_task(async function test_preview_overrides_then_clears() {
  Services.prefs.setStringPref(THEME_PREF, "noite");
  VimbraTheme.preview("brasa");
  await TestUtils.waitForCondition(() => token("--vb-strip") == STRIP.brasa);
  VimbraTheme.preview(null);
  Assert.ok(!Services.prefs.prefHasUserValue(PREVIEW_PREF), "Preview cleared");
  await TestUtils.waitForCondition(() => token("--vb-strip") == STRIP.noite);
  Services.prefs.clearUserPref(THEME_PREF);
});

add_task(async function test_tabs_keep_size_and_still_close() {
  const tab = BrowserTestUtils.addTab(gBrowser, "about:blank");
  await TestUtils.waitForCondition(() => tab.hasAttribute("fadein"));
  const rect = tab.getBoundingClientRect();
  Assert.equal(Math.round(rect.height), 36, "Tabs are 36px tall");
  Assert.lessOrEqual(Math.round(rect.width), 240, "Tabs are at most 240px wide");
  // Firefox removes a tab when its closing max-width transition ends; a theme
  // rule that pins max-width would leave it stuck in the strip.
  const count = gBrowser.tabs.length;
  gBrowser.removeTab(tab, { animate: true });
  await TestUtils.waitForCondition(
    () => gBrowser.tabs.length == count - 1 && !tab.isConnected,
    "An animated close removes the tab"
  );
});

add_task(async function test_unknown_theme_is_ignored() {
  Assert.ok(!VimbraTheme.set("not-a-theme"), "set() refuses unknown ids");
  VimbraTheme.preview("not-a-theme");
  Assert.ok(!Services.prefs.prefHasUserValue(THEME_PREF), "Theme untouched");
  Assert.ok(!Services.prefs.prefHasUserValue(PREVIEW_PREF), "No preview");
  Assert.deepEqual(
    THEMES.map(theme => theme.id),
    ["noite", "ametista", "iris", "brasa", "cobalto", "dia", "sistema"]
  );
});

add_task(async function test_web_pages_cannot_see_the_theme() {
  await BrowserTestUtils.withNewTab(TEST_PAGE, async browser => {
    const seen = await SpecialPowers.spawn(browser, [], () => ({
      token: content
        .getComputedStyle(content.document.documentElement)
        .getPropertyValue("--vb-strip"),
      fonts: [...content.document.fonts].map(font => font.family),
    }));
    Assert.equal(seen.token, "", "No Vimbra tokens in web pages");
    Assert.ok(
      !seen.fonts.some(family => family.includes("Geist")),
      "Web pages cannot detect Vimbra's bundled fonts"
    );
  });
});

add_task(async function test_new_tab_is_the_unprivileged_start_page() {
  Assert.equal(BROWSER_NEW_TAB_URL, HOME_URL, "New tabs open about:vimbra");
  Assert.equal(
    Services.prefs.getDefaultBranch("").getStringPref("browser.startup.homepage"),
    HOME_URL,
    "about:vimbra is the default home page"
  );
  await BrowserTestUtils.withNewTab(HOME_URL, async browser => {
    Assert.equal(gURLBar.value, "", "The address bar stays empty");
    const principal = await SpecialPowers.spawn(browser, [], () => ({
      system: content.document.nodePrincipal.isSystemPrincipal,
      origin: content.document.nodePrincipal.origin,
    }));
    Assert.ok(!principal.system, "about:vimbra has no chrome privileges");
    Assert.equal(principal.origin, HOME_URL);
    if (
      Services.prefs.getBoolPref(
        "browser.tabs.remote.separatePrivilegedContentProcess",
        false
      )
    ) {
      Assert.equal(
        browser.remoteType,
        "privilegedabout",
        "Kept out of web processes, where vimbra.theme is not visible"
      );
    }
    // The page follows the theme live.
    Services.prefs.setStringPref(THEME_PREF, "brasa");
    await TestUtils.waitForCondition(async () =>
      (await SpecialPowers.spawn(browser, [], () =>
        content
          .getComputedStyle(content.document.documentElement)
          .getPropertyValue("--vb-strip")
          .trim()
      )) == STRIP.brasa
    );
    Services.prefs.clearUserPref(THEME_PREF);
  });
});

add_task(async function test_start_page_search_box_loads_addresses() {
  await BrowserTestUtils.withNewTab(HOME_URL, async browser => {
    const loaded = BrowserTestUtils.browserLoaded(browser, false, TEST_PAGE);
    await SpecialPowers.spawn(browser, [TEST_PAGE], url => {
      const input = content.document.getElementById("q");
      input.value = url;
      input.dispatchEvent(
        new content.KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    await loaded;
  });
});

add_task(async function test_start_page_cannot_open_privileged_urls() {
  await BrowserTestUtils.withNewTab(HOME_URL, async browser => {
    const actor =
      browser.browsingContext.currentWindowGlobal.getActor("VimbraHome");
    const loads = [];
    const original = browser.loadURI;
    browser.loadURI = uri => loads.push(uri.spec);
    try {
      for (const text of [
        "about:config",
        "chrome://browser/content/browser.xhtml",
        "javascript:alert(1)",
        "file:///",
      ]) {
        actor.receiveMessage({ name: "VimbraHome:Go", data: { text } });
      }
      actor.receiveMessage({ name: "VimbraHome:Go", data: { text: 42 } });
    } finally {
      browser.loadURI = original;
    }
    Assert.deepEqual(loads, [], "Only http(s) results are ever loaded");
  });
});

add_task(async function test_settings_picker_saves_the_theme() {
  await BrowserTestUtils.withNewTab(
    "about:preferences#appearance",
    async browser => {
      const doc = browser.contentDocument;
      await TestUtils.waitForCondition(
        () => doc.querySelectorAll(".vimbra-theme-card .vimbra-swatch").length,
        "The Vimbra theme picker is added to Appearance"
      );
      const swatches = doc.querySelectorAll(".vimbra-swatch");
      Assert.equal(swatches.length, THEMES.length, "One swatch per theme");
      Assert.equal(
        doc.querySelectorAll(".vimbra-theme-card").length,
        1,
        "The picker is added once"
      );

      doc.querySelector('.vimbra-swatch[data-theme="brasa"]').click();
      await TestUtils.waitForCondition(
        () => VimbraTheme.current() == "brasa",
        "Clicking a swatch saves the theme"
      );
      Assert.equal(
        doc
          .querySelector('.vimbra-swatch[data-theme="brasa"]')
          .getAttribute("aria-pressed"),
        "true"
      );
    }
  );
  Services.prefs.clearUserPref(THEME_PREF);
});
