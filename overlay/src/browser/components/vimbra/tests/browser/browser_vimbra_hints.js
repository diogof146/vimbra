"use strict";

// file_vimbra.html has three clickable elements, labelled in DOM order:
// s = #field, a = #button, d = #link.

async function clicks(browser) {
  return SpecialPowers.spawn(browser, [], () => content.wrappedJSObject.clicks);
}

add_task(async function test_f_clicks_the_labelled_element() {
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("f");
    EventUtils.synthesizeKey("a");
    await TestUtils.waitForCondition(async () => (await clicks(browser)) == 1);

    const { seenKeys } = await pageState(browser);
    Assert.equal(seenKeys, "", "Page never received the hint keys");
  });
});

add_task(async function test_F_opens_link_in_background_tab() {
  await withTestPage(async browser => {
    const newTab = BrowserTestUtils.waitForNewTab(gBrowser, url =>
      url.endsWith("?opened")
    );
    EventUtils.synthesizeKey("F", { shiftKey: true });
    EventUtils.synthesizeKey("d");
    const tab = await newTab;
    Assert.equal(gBrowser.selectedBrowser, browser, "Current tab stays");
    BrowserTestUtils.removeTab(tab);
  });
});

add_task(async function test_escape_cancels_hints() {
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("f");
    EventUtils.synthesizeKey("KEY_Escape");
    EventUtils.synthesizeKey("j");
    await waitForScroll(browser, y => y > 0);
    Assert.equal(await clicks(browser), 0, "Nothing was clicked");
  });
});

add_task(async function test_f_on_text_field_focuses_it() {
  await withTestPage(async browser => {
    EventUtils.synthesizeKey("f");
    EventUtils.synthesizeKey("s");
    await TestUtils.waitForCondition(() =>
      SpecialPowers.spawn(
        browser,
        [],
        () => content.document.activeElement?.id == "field"
      )
    );
    EventUtils.sendString("jk");
    await TestUtils.waitForCondition(
      async () => (await pageState(browser)).fieldValue == "jk"
    );
  });
});
