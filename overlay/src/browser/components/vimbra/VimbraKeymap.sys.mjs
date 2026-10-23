import {
  COMMANDS,
  COMMANDS_BY_NAME,
  DEFAULT_LEADERS,
} from "moz-src:///browser/components/vimbra/VimbraCommands.sys.mjs";

const SHARED_DATA_KEY = "Vimbra:keymap";
const RC_PATH_PREF = "vimbra.rc.path";

const EVENT_KEY_NAMES = new Map([
  ["Escape", "Esc"],
  ["Enter", "CR"],
  [" ", "Space"],
  ["Tab", "Tab"],
  ["Backspace", "BS"],
  ["Delete", "Del"],
  ["ArrowUp", "Up"],
  ["ArrowDown", "Down"],
  ["ArrowLeft", "Left"],
  ["ArrowRight", "Right"],
  ["Home", "Home"],
  ["End", "End"],
  ["PageUp", "PageUp"],
  ["PageDown", "PageDown"],
  ["Insert", "Insert"],
]);
for (let i = 1; i <= 12; i++) {
  EVENT_KEY_NAMES.set(`F${i}`, `F${i}`);
}

const NOTATION_KEY_NAMES = new Map([
  ...[...EVENT_KEY_NAMES.values()].map(name => [name.toLowerCase(), name]),
  ["escape", "Esc"],
  ["enter", "CR"],
  ["return", "CR"],
  ["backspace", "BS"],
  ["delete", "Del"],
  ["lt", "lt"],
]);

const MODIFIERS = { C: "ctrl", A: "alt", M: "alt", D: "meta", S: "shift" };

/**
 * Formats one key in canonical vim notation: "j", "G", "<C-d>", "<S-Tab>".
 * Shift is folded into printable characters; letters with other modifiers are
 * lowercase, so <C-D> and <C-d> are the same key.
 */
function formatKey(name, { ctrl, alt, meta, shift }) {
  if (name.length == 1) {
    const isLetter = /[a-z]/i.test(name);
    if (ctrl || alt || meta) {
      name = name.toLowerCase();
      shift &&= isLetter;
    } else {
      if (shift && isLetter) {
        name = name.toUpperCase();
      }
      shift = false;
    }
    if (name == "<") {
      name = "lt";
    }
  }
  const modifiers =
    (ctrl ? "C-" : "") +
    (alt ? "A-" : "") +
    (meta ? "D-" : "") +
    (shift ? "S-" : "");
  return !modifiers && name.length == 1 ? name : `<${modifiers}${name}>`;
}

function parseBracketed(inner, leaders) {
  const lower = inner.toLowerCase();
  if (lower == "leader" || lower == "localleader") {
    return leaders[lower];
  }
  const match = /^((?:[CAMDS]-)*)(.+)$/i.exec(inner);
  if (!match) {
    return null;
  }
  const modifiers = {};
  for (const letter of match[1].replaceAll("-", "")) {
    modifiers[MODIFIERS[letter.toUpperCase()]] = true;
  }
  let name = match[2];
  if (name.length > 1) {
    name = NOTATION_KEY_NAMES.get(name.toLowerCase());
    if (!name) {
      return null;
    }
  }
  return formatKey(name, modifiers);
}

/**
 * Splits vim key notation ("g<C-d>") into canonical keys (["g", "<C-d>"]).
 * <leader> and <localleader> become the keys in `leaders`. Throws on unknown
 * <...> names.
 */
export function parseKeys(text, leaders = DEFAULT_LEADERS) {
  const keys = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] == "<") {
      const end = text.indexOf(">", i + 1);
      const key =
        end == -1 ? null : parseBracketed(text.slice(i + 1, end), leaders);
      if (!key) {
        throw new Error(`invalid key at "${text.slice(i)}" (write < as <lt>)`);
      }
      keys.push(key);
      i = end + 1;
    } else {
      keys.push(formatKey(text[i], {}));
      i++;
    }
  }
  return keys;
}

/**
 * Returns the canonical key for a keydown event, or null for keys that are
 * never bound (modifiers alone, dead keys, IME).
 */
export function keyFromEvent(event) {
  const modifiers = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
  let name = event.key;
  if (EVENT_KEY_NAMES.has(name)) {
    name = EVENT_KEY_NAMES.get(name);
  } else if (name.length != 1) {
    return null;
  } else if (event.altKey) {
    // Option composes characters on macOS (Option+j is "∆"), so use the
    // physical key instead.
    const match = /^(?:Key|Digit)(.)$/.exec(event.code);
    if (match) {
      name = match[1];
    }
  }
  return formatKey(name, modifiers);
}

function parseLeader(value) {
  const keys = value == " " ? ["<Space>"] : parseKeys(value, {});
  if (keys.length != 1 || keys[0].includes("leader")) {
    throw new Error("a leader must be a single key");
  }
  return keys[0];
}

function parseRcLine(line, commandNames, leaders) {
  const leaderMatch =
    /^let\s+(?:g:)?map(local)?leader\s*=\s*(["'])(.+)\2$/.exec(line);
  if (leaderMatch) {
    return {
      leader: {
        [leaderMatch[1] ? "localleader" : "leader"]: parseLeader(leaderMatch[3]),
      },
    };
  }
  const [directive, ...args] = line.split(/\s+/);
  const expectArgs = (count, usage) => {
    if (args.length != count) {
      throw new Error(`usage: ${usage}`);
    }
  };
  switch (directive) {
    case "map": {
      expectArgs(2, "map {keys} {command}");
      if (!commandNames.has(args[1])) {
        throw new Error(`unknown command "${args[1]}"`);
      }
      return {
        mapping: { keys: parseKeys(args[0], leaders).join(""), command: args[1] },
      };
    }
    case "unmap":
      expectArgs(1, "unmap {keys}");
      return { mapping: { keys: parseKeys(args[0], leaders).join("") } };
    case "noremap": {
      expectArgs(2, "noremap {key} {key}");
      const [from, to] = args.map(arg => parseKeys(arg, leaders));
      if (from.length != 1 || to.length != 1) {
        throw new Error("noremap takes one key on each side");
      }
      return { noremap: [from[0], to[0]] };
    }
  }
  throw new Error(`unknown directive "${directive}"`);
}

/**
 * Parses ~/.vimbrarc. Lines are `map {keys} {command}`, `unmap {keys}`,
 * `noremap {key} {key}`, `let mapleader = "{key}"`,
 * `let maplocalleader = "{key}"`, or comments starting with `"`. As in vim, a
 * leader change affects the lines after it. Invalid lines are skipped and
 * reported in `errors`.
 */
export function parseRc(text, commandNames) {
  let leaders = { ...DEFAULT_LEADERS };
  const noremaps = [];
  const mappings = [];
  const errors = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('"')) {
      continue;
    }
    try {
      const { leader, noremap, mapping } = parseRcLine(
        line,
        commandNames,
        leaders
      );
      if (leader) {
        leaders = { ...leaders, ...leader };
      } else if (noremap) {
        noremaps.push(noremap);
      } else {
        mappings.push(mapping);
      }
    } catch (e) {
      errors.push({ line: i + 1, message: e.message });
    }
  }
  return { leaders, noremaps, mappings, errors };
}

function combinations(choices) {
  return choices.reduce(
    (sequences, options) =>
      sequences.flatMap(prefix => options.map(key => prefix + key)),
    [""]
  );
}

/**
 * Resolves default bindings plus ~/.vimbrarc into a map from typed key
 * sequences to command names.
 *
 * `noremap a b` makes typing a act as b, and b stops acting as itself unless
 * something else maps to it, so a swap needs both directions. map/unmap then
 * apply, in file order, to the keys as typed. Default bindings use the
 * leaders the file ends with.
 */
export function buildKeymap(
  commands,
  { leaders = DEFAULT_LEADERS, noremaps = [], mappings = [] } = {}
) {
  const actsAs = new Map(noremaps);
  const typedKeysFor = key => {
    const typed = actsAs.has(key) ? [] : [key];
    for (const [from, to] of actsAs) {
      if (to == key) {
        typed.push(from);
      }
    }
    return typed;
  };

  const bindings = new Map();
  for (const command of commands) {
    for (const keys of command.keys) {
      const parsed = parseKeys(keys, leaders);
      for (const typed of combinations(parsed.map(typedKeysFor))) {
        bindings.set(typed, command.name);
      }
    }
  }
  for (const { keys, command } of mappings) {
    if (command) {
      bindings.set(keys, command);
    } else {
      bindings.delete(keys);
    }
  }

  const prefixes = new Set();
  for (const sequence of bindings.keys()) {
    const keys = parseKeys(sequence);
    for (let i = 1; i < keys.length; i++) {
      prefixes.add(keys.slice(0, i).join(""));
    }
  }
  return { bindings, prefixes };
}

let defaultKeymap = null;

export const VimbraKeymap = {
  rcPath() {
    return (
      Services.prefs.getStringPref(RC_PATH_PREF, "") ||
      PathUtils.join(Services.dirsvc.get("Home", Ci.nsIFile).path, ".vimbrarc")
    );
  },

  /**
   * Reads ~/.vimbrarc and publishes the resolved keymap to every process.
   * Returns the errors found in the file.
   */
  async load() {
    const path = this.rcPath();
    let text = "";
    try {
      text = await IOUtils.readUTF8(path);
    } catch (e) {
      if (e.name != "NotFoundError") {
        console.error(`Vimbra: could not read ${path}`, e);
      }
    }
    const rc = parseRc(text, new Set(COMMANDS_BY_NAME.keys()));
    for (const { line, message } of rc.errors) {
      console.error(`${path}:${line}: ${message}`);
    }
    Services.ppmm.sharedData.set(SHARED_DATA_KEY, buildKeymap(COMMANDS, rc));
    Services.ppmm.sharedData.flush();
    return rc.errors;
  },

  /**
   * The keymap published by load(), or the defaults until it has run.
   */
  current() {
    const sharedData =
      Services.appinfo.processType == Services.appinfo.PROCESS_TYPE_DEFAULT
        ? Services.ppmm.sharedData
        : Services.cpmm.sharedData;
    defaultKeymap ??= buildKeymap(COMMANDS);
    return sharedData.get(SHARED_DATA_KEY) ?? defaultKeymap;
  },
};
