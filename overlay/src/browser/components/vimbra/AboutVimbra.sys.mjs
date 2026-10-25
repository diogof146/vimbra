/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PAGE_URL = "chrome://browser/content/vimbra/home.html";

/**
 * about:vimbra, the start page. The page is served from chrome:// but runs
 * with an ordinary content principal for about:vimbra, so it has no more power
 * than a web page.
 *
 * It loads in the privileged-about process, like about:newtab, rather than a
 * web process: web processes never receive non-static prefs such as
 * vimbra.theme, so the page could not follow the theme there. No website ever
 * shares that process.
 */
export class AboutVimbra {
  QueryInterface = ChromeUtils.generateQI(["nsIAboutModule"]);

  newChannel(uri, loadInfo) {
    const channel = Services.io.newChannelFromURIWithLoadInfo(
      Services.io.newURI(PAGE_URL),
      loadInfo
    );
    channel.originalURI = uri;
    channel.owner = Services.scriptSecurityManager.createContentPrincipal(
      uri,
      loadInfo.originAttributes
    );
    return channel;
  }

  getURIFlags() {
    return (
      Ci.nsIAboutModule.URI_SAFE_FOR_UNTRUSTED_CONTENT |
      Ci.nsIAboutModule.ALLOW_SCRIPT |
      Ci.nsIAboutModule.URI_MUST_LOAD_IN_CHILD |
      Ci.nsIAboutModule.URI_CAN_LOAD_IN_PRIVILEGEDABOUT_PROCESS |
      Ci.nsIAboutModule.HIDE_FROM_ABOUTABOUT
    );
  }

  getChromeURI() {
    return Services.io.newURI(PAGE_URL);
  }
}
