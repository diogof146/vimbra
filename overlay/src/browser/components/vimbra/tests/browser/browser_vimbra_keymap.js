"use strict";

const { buildKeymap, parseKeys, parseRc, VimbraKeymap } =
  ChromeUtils.importESModule(
    "moz-src:///browser/components/vimbra/VimbraKeymap.sys.mjs"
  );
const { COMMANDS, COMMANDS_BY_NAME } = ChromeUtils.importESModule(
  "moz-src:///browser/components/vimbra/VimbraCommands.sys.mjs"
);

const COMMAND_NAMES = new Set(COMMANDS_BY_NAME.keys());

function keymapFromRc(text) {
  return buildKeymap(COMMANDS, parseRc(text, COMMAND_NAMES));
}

add_task(function test_parse_keys() {
  Assert.deepEqual(parseKeys("gg"), ["g", "g"]);
  Assert.deepEqual(parseKeys("<C-D>"), ["<C-d>"], "Ctrl letters fold case");
  Assert.deepEqual(parseKeys("<c-s-d>"), ["<C-S-d>"]);
  Assert.deepEqual(parseKeys("<S-a>"), ["A"], "Shift folds into letters");
  Assert.deepEqual(parseKeys("<lt><esc><s-tab>"), ["<lt>", "<Esc>", "<S-Tab>"]);
  Assert.deepEqual(parseKeys("<leader>h"), ["<Space>", "h"]);
  Assert.deepEqual(parseKeys("<LocalLeader>x"), [",", "x"]);
  Assert.throws(() => parseKeys("<nope>"), /invalid key/);
  Assert.throws(() => parseKeys("a<b"), /invalid key/);
});

add_task(function test_parse_rc() {
  const rc = parseRc(
    [
      '" a comment',
      'let mapleader = ","',
      "map <leader>x scrollDown",
      "let mapleader = ' '",
      "unmap <leader>1",
      "noremap b q",
      "map j noSuchCommand",
      "noremap ab c",
      "bogus line",
    ].join("\n"),
    COMMAND_NAMES
  );
  Assert.deepEqual(rc.mappings, [
    { keys: ",x", command: "scrollDown" },
    { keys: "<Space>1" },
  ]);
  Assert.deepEqual(rc.noremaps, [["b", "q"]]);
  Assert.deepEqual(rc.leaders, { leader: "<Space>", localleader: "," });
  Assert.deepEqual(
    rc.errors.map(e => e.line),
    [7, 8, 9],
    "Invalid lines are reported by line number"
  );
});

add_task(function test_noremap_swap() {
  const { bindings } = keymapFromRc("noremap j k\nnoremap k j");
  Assert.equal(bindings.get("j"), "scrollUp");
  Assert.equal(bindings.get("k"), "scrollDown");
});

add_task(function test_one_way_noremap_hides_the_target_key() {
  const { bindings } = keymapFromRc("noremap h j");
  Assert.equal(bindings.get("h"), "scrollDown");
  Assert.equal(bindings.get("j"), "scrollDown");
  Assert.ok(
    ![...bindings.values()].includes("scrollLeft"),
    "Nothing types h any more"
  );
});

add_task(function test_leader_applies_to_defaults() {
  const { bindings, prefixes } = keymapFromRc('let mapleader = ","');
  Assert.equal(bindings.get(",1"), "goToTab1");
  Assert.ok(prefixes.has(","));
  Assert.ok(!bindings.has("<Space>1"));
});

add_task(async function test_vimbrarc_is_loaded() {
  const path = PathUtils.join(PathUtils.tempDir, "vimbrarc-test");
  await IOUtils.writeUTF8(path, "unmap j\nmap x scrollToBottom\n");
  await SpecialPowers.pushPrefEnv({ set: [["vimbra.rc.path", path]] });
  Assert.deepEqual(await VimbraKeymap.load(), [], "No errors in the file");

  await withTestPage(async browser => {
    EventUtils.synthesizeKey("j");
    await waitForSeenKeys(browser, "j");
    Assert.equal((await pageState(browser)).scrollY, 0, "j is unmapped");

    EventUtils.synthesizeKey("x");
    await waitForScroll(browser, y => y > 1000);
  });

  await SpecialPowers.popPrefEnv();
  await VimbraKeymap.load();
  await IOUtils.remove(path);
});
