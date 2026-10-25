/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export const BRAND = "Vimbra";

const SOURCE_NAME = "vimbra-brand";
const PRE_PATH = "resource://vimbra-brand/{locale}/";

// Terms in toolkit/branding/brandings.ftl that name features Vimbra ships.
// Mozilla's web services (Relay, Monitor, VPN, Pocket…) keep their names:
// they are real third-party products.
const FEATURE_TERMS = new Set([
  "-firefox-suggest-brand-name",
  "-firefox-home-brand-name",
  "-firefoxview-brand-name",
  "-firefoxlabs-brand-name",
  "-screenshots-brand-name",
  "-translations-brand-name",
  "-profiler-brand-name",
]);

/** Every "Firefox" in brand.ftl becomes Vimbra; -vendor-short-name is left alone. */
function rewriteBrand(text) {
  return text.replace(/Mozilla Firefox/g, BRAND).replace(/Firefox/g, BRAND);
}

/** Renames only FEATURE_TERMS, including their attribute and variant lines. */
function rewriteBrandings(text) {
  let current = null;
  return text
    .split("\n")
    .map(line => {
      const entry = line.match(/^(-?[A-Za-z][\w-]*)\s*=/);
      if (entry) {
        current = entry[1];
      } else if (line && !/^\s/.test(line)) {
        current = null;
      }
      return FEATURE_TERMS.has(current) ? line.replace(/Firefox/g, BRAND) : line;
    })
    .join("\n");
}

const RESOURCES = [
  { path: "branding/brand.ftl", base: "resource://app/localization/", rewrite: rewriteBrand },
  {
    path: "toolkit/branding/brandings.ftl",
    base: "resource://gre/localization/",
    rewrite: rewriteBrandings,
  },
];

function read(url) {
  try {
    return Cu.readUTF8URI(Services.io.newURI(url));
  } catch (e) {
    return null;
  }
}

/**
 * Keeps "Firefox" out of the interface in every installed locale. A Vimbra
 * build already ships an en-US brand.ftl saying Vimbra, but other locales
 * carry Mozilla's; this registers a Fluent source, ahead of the app's, with
 * those two files rewritten for each locale.
 */
export const VimbraBrand = {
  init() {
    const registry = L10nRegistry.getInstance();
    const files = [];
    const locales = [];
    for (const locale of registry.getAvailableLocales()) {
      let any = false;
      for (const { path, base, rewrite } of RESOURCES) {
        const text = read(`${base}${locale}/${path}`);
        if (text === null) {
          continue;
        }
        files.push({ path: `resource://vimbra-brand/${locale}/${path}`, source: rewrite(text) });
        any = true;
      }
      if (any) {
        locales.push(locale);
      }
    }
    if (!files.length) {
      return;
    }
    if (registry.hasSource(SOURCE_NAME)) {
      registry.removeSources([SOURCE_NAME]);
    }
    registry.registerSources([
      L10nFileSource.createMock(SOURCE_NAME, "app", locales, PRE_PATH, files),
    ]);
  },
};

export const _testing = { rewriteBrand, rewriteBrandings };
