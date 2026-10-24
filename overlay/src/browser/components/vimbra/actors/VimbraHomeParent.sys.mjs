/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.sys.mjs",
});

const LOADABLE_SCHEMES = new Set(["http", "https"]);

/**
 * Loads what was typed on the start page, the way the address bar would:
 * an address is opened, anything else goes to the default search engine.
 *
 * Messages come from a content process. Only text is accepted, and only
 * http(s) results load, so the page can never open a privileged URL.
 */
export class VimbraHomeParent extends JSWindowActorParent {
  receiveMessage({ name, data }) {
    if (name != "VimbraHome:Go" || typeof data?.text != "string") {
      return;
    }
    const win = this.browsingContext.topChromeWindow;
    const browser = this.browsingContext.top.embedderElement;
    if (!win?.gBrowser || !browser) {
      return;
    }

    let flags =
      Services.uriFixup.FIXUP_FLAG_ALLOW_KEYWORD_LOOKUP |
      Services.uriFixup.FIXUP_FLAG_FIX_SCHEME_TYPOS;
    if (lazy.PrivateBrowsingUtils.isBrowserPrivate(browser)) {
      flags |= Services.uriFixup.FIXUP_FLAG_PRIVATE_CONTEXT;
    }
    let info;
    try {
      info = Services.uriFixup.getFixupURIInfo(data.text.slice(0, 2048), flags);
    } catch (e) {
      return;
    }
    const uri = info.preferredURI;
    if (!uri || !LOADABLE_SCHEMES.has(uri.scheme)) {
      return;
    }
    browser.loadURI(uri, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
      postData: info.postData,
    });
  }
}
