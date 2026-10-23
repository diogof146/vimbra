"use strict";

async function selectedMatchId(browser) {
  return SpecialPowers.spawn(
    browser,
    [],
    () => content.getSelection().anchorNode?.parentElement?.id
  );
}

add_task(async function test_escape_leaves_text_field() {
  await withTestPage(async browser => {
    await SpecialPowers.spawn(browser, [], () =>
      content.document.getElementById("field").focus()
    );
    EventUtils.synthesizeKey("KEY_Escape");
    EventUtils.synthesizeKey("j");
    await waitForScroll(browser, y => y > 0);

    const { seenKeys, fieldValue } = await pageState(browser);
    Assert.equal(fieldValue, "", "j was not typed into the field");
    Assert.equal(seenKeys, "", "Page never received Escape or j");
  });
});

add_task(async function test_o_focuses_address_bar_and_escape_returns() {
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("o");
    await TestUtils.waitForCondition(() => gURLBar.focused);

    EventUtils.synthesizeKey("KEY_Escape");
    if (gURLBar.view.isOpen) {
      EventUtils.synthesizeKey("KEY_Escape");
    }
    await TestUtils.waitForCondition(
      () => Services.focus.focusedElement == browser
    );

    EventUtils.synthesizeKey("j");
    await waitForScroll(browser, y => y > 0);
  });
});

add_task(async function test_H_and_L_go_back_and_forward() {
  await withTestPage(async browser => {
    const second = TEST_PAGE + "?second";
    BrowserTestUtils.startLoadingURIString(browser, second);
    await BrowserTestUtils.browserLoaded(browser, false, second);
    browser.focus();

    // Back and forward may restore from the bfcache, which fires no load.
    EventUtils.synthesizeKey("H", { shiftKey: true });
    await TestUtils.waitForCondition(
      () => browser.currentURI.spec == TEST_PAGE
    );
    browser.focus();

    EventUtils.synthesizeKey("L", { shiftKey: true });
    await TestUtils.waitForCondition(() => browser.currentURI.spec == second);
  });
});

add_task(async function test_slash_search_then_n_and_N() {
  await SpecialPowers.pushPrefEnv({
    set: [["accessibility.typeaheadfind.flashBar", 0]],
  });
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("/");
    const findBar = await gBrowser.getFindBar();
    await TestUtils.waitForCondition(() => !findBar.hidden);

    EventUtils.sendString("needle");
    await TestUtils.waitForCondition(
      async () => (await selectedMatchId(browser)) == "match1"
    );
    EventUtils.synthesizeKey("KEY_Enter");
    await TestUtils.waitForCondition(
      () => Services.focus.focusedElement == browser
    );
    Assert.equal(
      await selectedMatchId(browser),
      "match1",
      "Enter keeps the first match"
    );

    EventUtils.synthesizeKey("n");
    await TestUtils.waitForCondition(
      async () => (await selectedMatchId(browser)) == "match2"
    );
    EventUtils.synthesizeKey("N", { shiftKey: true });
    await TestUtils.waitForCondition(
      async () => (await selectedMatchId(browser)) == "match1"
    );

    EventUtils.synthesizeKey("KEY_Escape");
    await TestUtils.waitForCondition(() => findBar.hidden);
  });
  await SpecialPowers.popPrefEnv();
});
