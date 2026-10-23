import { COMMANDS_BY_NAME } from "moz-src:///browser/components/vimbra/VimbraCommands.sys.mjs";

/**
 * Runs parent-scope commands for VimbraChild, and closes the find bar when
 * Escape is pressed in the page.
 *
 * Messages come from web content processes, which may be compromised. Only a
 * command name is accepted, and only commands the user could trigger by
 * pressing their keys run.
 */
export class VimbraParent extends JSWindowActorParent {
  receiveMessage({ name, data }) {
    const win = this.browsingContext.topChromeWindow;
    if (!win?.gBrowser) {
      return;
    }
    switch (name) {
      case "Vimbra:RunCommand": {
        const command = COMMANDS_BY_NAME.get(data?.name);
        if (command?.scope == "parent") {
          command.run(win);
        }
        break;
      }
      case "Vimbra:Escape":
        win.gBrowser.getCachedFindBar()?.close();
        break;
    }
  }
}
