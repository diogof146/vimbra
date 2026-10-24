/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  THEMES,
  VimbraTheme,
} from "moz-src:///browser/components/vimbra/VimbraTheme.sys.mjs";

/**
 * Applies theme choices from the settings picker. Ids are checked against
 * THEMES by VimbraTheme, so nothing else can be written to the prefs.
 */
export class VimbraSettingsParent extends JSWindowActorParent {
  receiveMessage({ name, data }) {
    switch (name) {
      case "VimbraSettings:Get":
        return {
          current: VimbraTheme.current(),
          themes: THEMES,
          locale: Services.locale.appLocaleAsBCP47,
        };
      case "VimbraSettings:Set":
        VimbraTheme.set(data?.id);
        break;
      case "VimbraSettings:Preview":
        VimbraTheme.preview(typeof data?.id == "string" ? data.id : null);
        break;
    }
    return undefined;
  }
}
