// Writes docs/KEYBINDINGS.md from the command registry.
//
//   node scripts/keybindings.mjs          regenerate the file
//   node scripts/keybindings.mjs --check  fail if the file is out of date

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COMMANDS,
  DEFAULT_LEADERS,
} from "../src/browser/components/vimbra/VimbraCommands.sys.mjs";

const OUTPUT = resolve(import.meta.dirname, "../../docs/KEYBINDINGS.md");

const GROUPS = [
  ["vim", "Vim", "Standard vim bindings."],
  ["vimbra", "Vimbra", "Vimbra's own commands."],
];

const code = text => "`" + text.replaceAll("|", "\\|") + "`";

function table(commands) {
  const rows = commands.map(({ name, description, keys }) => {
    const keyList = keys.length ? keys.map(code).join(", ") : "(unbound)";
    return `| ${keyList} | ${code(name)} | ${description} |`;
  });
  return ["| Keys | Command | Description |", "| --- | --- | --- |", ...rows];
}

function render() {
  const lines = [
    "# Keybindings",
    "",
    "Generated from `overlay/src/browser/components/vimbra/VimbraCommands.sys.mjs`",
    "by `make keybindings`. Do not edit by hand.",
    "",
    "Keys apply while browsing, when no text field is focused. " +
      `${code("<leader>")} is ${code(DEFAULT_LEADERS.leader)} and ` +
      `${code("<localleader>")} is ${code(DEFAULT_LEADERS.localleader)} ` +
      "unless changed in `~/.vimbrarc`.",
  ];
  for (const [group, title, intro] of GROUPS) {
    lines.push("", `## ${title}`, "", intro, "");
    lines.push(...table(COMMANDS.filter(c => c.group == group)));
  }
  lines.push(
    "",
    "## Customizing",
    "",
    "Vimbra reads `~/.vimbrarc` at startup (`%USERPROFILE%\\.vimbrarc` on Windows).",
    "Run `reloadConfig` after editing it. Errors are printed to the Browser Console",
    "with their line numbers, and invalid lines are skipped.",
    "",
    "```vim",
    '" Comments start with a double quote.',
    'let mapleader = "<Space>"     " leader for the lines below',
    'let maplocalleader = ","',
    "map <C-d> scrollHalfPageDown  \" bind keys to a command from the tables above",
    "unmap gt                      \" remove a binding",
    "noremap b q                   \" typing b acts as q",
    "noremap q b",
    "```",
    "",
    "Trailing comments are shown here for explanation only; a comment must be on",
    "its own line.",
    "",
    "- `noremap` takes one key on each side. After `noremap b q`, `b` no longer",
    "  acts as itself unless another `noremap` maps a key to it, so a swap needs",
    "  both lines.",
    "- `map` and `unmap` refer to the keys as typed, after `noremap`.",
    "- Keys use vim notation: `<C-x>` Ctrl, `<A-x>` or `<M-x>` Alt/Option,",
    "  `<D-x>` Cmd, `<S-x>` Shift with special keys, and `<Esc>`, `<CR>`,",
    "  `<Space>`, `<Tab>`, `<BS>`, `<Del>`, `<Up>`, `<Down>`, `<Left>`,",
    "  `<Right>`, `<Home>`, `<End>`, `<PageUp>`, `<PageDown>`, `<F1>`-`<F12>`,",
    "  `<lt>` for `<`.",
    "- When one binding is a prefix of another (`g` and `gg`), the shorter one",
    "  runs after a one-second pause."
  );
  return lines.join("\n") + "\n";
}

const content = render();
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(OUTPUT, "utf8");
  } catch {}
  if (current != content) {
    console.error("docs/KEYBINDINGS.md is out of date. Run: make keybindings");
    process.exit(1);
  }
} else {
  writeFileSync(OUTPUT, content);
  console.log("Wrote docs/KEYBINDINGS.md");
}
