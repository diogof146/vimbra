"use strict";

const { BRAND, _testing } = ChromeUtils.importESModule(
  "moz-src:///browser/components/vimbra/VimbraBrand.sys.mjs"
);

add_task(function test_brand_terms_are_rewritten() {
  const out = _testing.rewriteBrand(
    "-brand-short-name = Firefox\n    .gender = masculine\n-brand-full-name = Mozilla Firefox\n-vendor-short-name = Mozilla\n"
  );
  Assert.ok(out.includes(`-brand-short-name = ${BRAND}\n    .gender = masculine`));
  Assert.ok(out.includes(`-brand-full-name = ${BRAND}`));
  Assert.ok(out.includes("-vendor-short-name = Mozilla"), "The vendor is untouched");
});

add_task(function test_only_feature_terms_are_renamed() {
  const out = _testing.rewriteBrandings(
    [
      "-firefoxlabs-brand-name = Firefox Labs",
      "-firefox-suggest-brand-name =",
      "    { $case ->",
      "       *[nom] Firefox Suggest",
      "    }",
      "-relay-brand-name = Firefox Relay",
    ].join("\n")
  );
  Assert.ok(out.includes(`-firefoxlabs-brand-name = ${BRAND} Labs`));
  Assert.ok(out.includes(`*[nom] ${BRAND} Suggest`), "Multi-line terms too");
  Assert.ok(out.includes("-relay-brand-name = Firefox Relay"), "Mozilla services keep their names");
});

add_task(async function test_interface_says_vimbra() {
  const l10n = new Localization(
    ["branding/brand.ftl", "toolkit/branding/brandings.ftl", "browser/preferences/preferences.ftl"],
    true
  );
  const about = l10n.formatValueSync("pane-about-firefox-title");
  Assert.ok(about.includes(BRAND), `About entry names Vimbra: ${about}`);
  Assert.ok(!/Firefox/.test(about));
  const labs = l10n.formatValueSync("settings-pane-labs-title2");
  Assert.ok(labs && !/Firefox/.test(labs), `Labs entry has no Firefox: ${labs}`);
});
