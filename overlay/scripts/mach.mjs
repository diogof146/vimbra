// Runs mach in engine/ with the flags a Vimbra dev build needs.
//
//   node scripts/mach.mjs run [mach run args]
//   node scripts/mach.mjs test [test paths and mach test args]

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const overlay = resolve(import.meta.dirname, "..");
const engine = resolve(overlay, "engine");
const src = resolve(overlay, "src");

// src/ files are symlinked into engine/. Unpackaged builds only let the macOS
// content sandbox read engine/ and the objdir, so allow src/ as well.
const sandboxPref = `security.sandbox.content.mac.testing_read_path1=${src}`;

const DEFAULT_TESTS = ["browser/components/vimbra", "--headless"];

const [command, ...rest] = process.argv.slice(2);
let args;
switch (command) {
  case "run":
    // -purgecaches: the profile's startup cache keeps compiled copies of JS
    // modules, so edits are ignored without it.
    args = ["run", "--setpref", sandboxPref, ...rest, "-purgecaches"];
    break;
  case "test":
    args = [
      "test",
      ...(rest.length ? rest : DEFAULT_TESTS),
      `--setpref=${sandboxPref}`,
    ];
    break;
  default:
    console.error("usage: node scripts/mach.mjs run|test [args]");
    process.exit(2);
}

const [bin, binArgs] =
  process.platform == "win32" ? ["sh", ["./mach", ...args]] : ["./mach", args];
const result = spawnSync(bin, binArgs, { cwd: engine, stdio: "inherit" });
process.exit(result.status ?? 1);
