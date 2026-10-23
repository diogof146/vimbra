"use strict";

const TEST_PAGE =
  getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content",
    "https://example.com"
  ) + "file_vimbra.html";

async function pageState(browser) {
  return SpecialPowers.spawn(browser, [], () => ({
    scrollY: content.scrollY,
    seenKeys: content.wrappedJSObject.seenKeys.join(","),
    fieldValue: content.document.getElementById("field").value,
  }));
}

async function withTestPage(task) {
  await BrowserTestUtils.withNewTab(TEST_PAGE, async browser => {
    browser.focus();
    await task(browser);
  });
}

async function waitForScroll(browser, predicate) {
  await TestUtils.waitForCondition(async () =>
    predicate((await pageState(browser)).scrollY)
  );
}

async function waitForSeenKeys(browser, expected) {
  await TestUtils.waitForCondition(
    async () => (await pageState(browser)).seenKeys == expected
  );
}
