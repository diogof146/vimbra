"use strict";

add_task(async function test_j_and_k_scroll_before_page_sees_them() {
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("j");
    await waitForScroll(browser, y => y > 0);
    const afterJ = (await pageState(browser)).scrollY;

    EventUtils.synthesizeKey("k");
    await waitForScroll(browser, y => y < afterJ);

    const { seenKeys } = await pageState(browser);
    Assert.equal(seenKeys, "", "Page never received j or k");
  });
});

add_task(async function test_gg_and_G_jump_to_top_and_bottom() {
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("G", { shiftKey: true });
    await waitForScroll(browser, y => y > 1000);

    EventUtils.synthesizeKey("g");
    EventUtils.synthesizeKey("g");
    await waitForScroll(browser, y => y == 0);

    const { seenKeys } = await pageState(browser);
    Assert.equal(seenKeys, "", "Page never received G or g");
  });
});

add_task(async function test_ctrl_j_scrolls_half_page() {
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("j", { ctrlKey: true });
    await waitForScroll(browser, y => y > 0);

    const { seenKeys } = await pageState(browser);
    Assert.equal(seenKeys, "", "Page never received Ctrl+J");
  });
});

add_task(async function test_typing_in_text_field_is_untouched() {
  await withTestPage(async browser => {
    await SpecialPowers.spawn(browser, [], () =>
      content.document.getElementById("field").focus()
    );
    EventUtils.sendString("jk");

    await TestUtils.waitForCondition(
      async () => (await pageState(browser)).fieldValue == "jk"
    );
    const { scrollY, seenKeys } = await pageState(browser);
    Assert.equal(scrollY, 0, "Typing did not scroll");
    Assert.equal(seenKeys, "j,k", "Page received the typed keys");
  });
});

add_task(async function test_pref_disables_vim_keys() {
  await SpecialPowers.pushPrefEnv({ set: [["vimbra.vim.enabled", false]] });
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("j");
    await waitForSeenKeys(browser, "j");
    Assert.equal((await pageState(browser)).scrollY, 0, "j did not scroll");
  });
  await SpecialPowers.popPrefEnv();
});

add_task(async function test_tab_commands_run_in_parent() {
  const firstTab = gBrowser.selectedTab;
  const pageTab = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    TEST_PAGE
  );
  gBrowser.selectedBrowser.focus();

  EventUtils.synthesizeKey("g");
  EventUtils.synthesizeKey("T", { shiftKey: true });
  await TestUtils.waitForCondition(() => gBrowser.selectedTab == firstTab);

  gBrowser.selectedTab = pageTab;
  gBrowser.selectedBrowser.focus();
  EventUtils.synthesizeKey(" ");
  EventUtils.synthesizeKey("1");
  await TestUtils.waitForCondition(() => gBrowser.selectedTab == firstTab);

  BrowserTestUtils.removeTab(pageTab);
});
