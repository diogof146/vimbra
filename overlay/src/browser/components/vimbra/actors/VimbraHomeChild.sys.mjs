/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const MAX_QUERY_LENGTH = 2048;

/**
 * Relays a search or address typed on the about:vimbra start page. The page
 * itself runs unprivileged; it dispatches a VimbraHomeGo event whose detail is
 * the text, and the parent decides what to load.
 */
export class VimbraHomeChild extends JSWindowActorChild {
  handleEvent(event) {
    if (event.type != "VimbraHomeGo") {
      return;
    }
    const text = event.detail;
    if (typeof text != "string") {
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) {
      return;
    }
    this.sendAsyncMessage("VimbraHome:Go", { text: trimmed });
  }
}
