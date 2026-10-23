const SCROLL_STEP = 60;

const KEYMAP_URI = "moz-src:///browser/components/vimbra/VimbraKeymap.sys.mjs";

export const DEFAULT_LEADERS = { leader: "<Space>", localleader: "," };

function scrollBy(win, delta) {
  win.scrollBy({ ...delta, behavior: "smooth" });
}

function scrollTo(win, position) {
  win.scrollTo({ ...position, behavior: "smooth" });
}

const hookedFindBars = new WeakSet();
const slashSearches = new WeakSet();

/**
 * Opens the find bar for a vim-style search: Enter closes it and returns
 * focus to the page, where n and N move between matches. Find bars opened
 * other ways keep Firefox's Enter (find next).
 */
async function startSlashSearch(win) {
  const findBar = await win.gBrowser.getFindBar();
  if (!hookedFindBars.has(findBar)) {
    hookedFindBars.add(findBar);
    findBar.addEventListener("findbarclose", () =>
      slashSearches.delete(findBar)
    );
    findBar.getElement("findbar-textbox").addEventListener(
      "keypress",
      event => {
        if (
          event.key != "Enter" ||
          event.shiftKey ||
          event.getModifierState("Accel") ||
          !slashSearches.has(findBar)
        ) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        win.gBrowser.selectedBrowser.focus();
      },
      { capture: true }
    );
  }
  slashSearches.add(findBar);
  findBar.startFind(findBar.FIND_NORMAL);
}

const hookedUrlbars = new WeakSet();

/**
 * Focuses the address bar. Escape with no suggestions open leaves it and
 * returns focus to the page.
 */
function openLocation(win) {
  const urlbar = win.gURLBar;
  if (!hookedUrlbars.has(urlbar)) {
    hookedUrlbars.add(urlbar);
    urlbar.inputField.addEventListener(
      "keydown",
      event => {
        if (event.key != "Escape" || urlbar.view.isOpen) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        urlbar.handleRevert();
        win.gBrowser.selectedBrowser.focus();
      },
      { capture: true }
    );
  }
  win.openLocation();
}

async function findAgain(win, findPrevious) {
  const findBar = await win.gBrowser.getFindBar();
  findBar.onFindAgainCommand(findPrevious);
}

/**
 * Every Vimbra command, and its default keys in vim key notation.
 *
 * scope: "content" commands run in the page's process and receive the window
 *        of the focused frame and its VimbraChild actor. "parent" commands run
 *        in the browser process and receive the browser window.
 * group: "vim" for standard vim bindings, "vimbra" for Vimbra's own commands.
 *        Sets the section in docs/KEYBINDINGS.md.
 */
export const COMMANDS = [
  {
    name: "scrollDown",
    description: "Scroll down",
    group: "vim",
    scope: "content",
    keys: ["j"],
    run: win => scrollBy(win, { top: SCROLL_STEP }),
  },
  {
    name: "scrollUp",
    description: "Scroll up",
    group: "vim",
    scope: "content",
    keys: ["k"],
    run: win => scrollBy(win, { top: -SCROLL_STEP }),
  },
  {
    name: "scrollLeft",
    description: "Scroll left",
    group: "vim",
    scope: "content",
    keys: ["h"],
    run: win => scrollBy(win, { left: -SCROLL_STEP }),
  },
  {
    name: "scrollRight",
    description: "Scroll right",
    group: "vim",
    scope: "content",
    keys: ["l"],
    run: win => scrollBy(win, { left: SCROLL_STEP }),
  },
  {
    name: "scrollToTop",
    description: "Scroll to the top",
    group: "vim",
    scope: "content",
    keys: ["gg"],
    run: win => scrollTo(win, { top: 0 }),
  },
  {
    name: "scrollToBottom",
    description: "Scroll to the bottom",
    group: "vim",
    scope: "content",
    keys: ["G"],
    run: win =>
      scrollTo(win, { top: win.document.documentElement.scrollHeight }),
  },
  {
    name: "nextTab",
    description: "Go to the next tab",
    group: "vim",
    scope: "parent",
    keys: ["gt"],
    run: win => win.gBrowser.tabContainer.advanceSelectedTab(1, true),
  },
  {
    name: "previousTab",
    description: "Go to the previous tab",
    group: "vim",
    scope: "parent",
    keys: ["gT"],
    run: win => win.gBrowser.tabContainer.advanceSelectedTab(-1, true),
  },
  {
    name: "search",
    description: "Search the page; Enter returns to the page",
    group: "vim",
    scope: "parent",
    keys: ["/"],
    run: win => startSlashSearch(win),
  },
  {
    name: "searchNext",
    description: "Go to the next search match",
    group: "vim",
    scope: "parent",
    keys: ["n"],
    run: win => findAgain(win, false),
  },
  {
    name: "searchPrevious",
    description: "Go to the previous search match",
    group: "vim",
    scope: "parent",
    keys: ["N"],
    run: win => findAgain(win, true),
  },
  {
    name: "scrollHalfPageDown",
    description: "Scroll down half a page",
    group: "vimbra",
    scope: "content",
    keys: ["<C-j>"],
    run: win => scrollBy(win, { top: win.innerHeight / 2 }),
  },
  {
    name: "scrollHalfPageUp",
    description: "Scroll up half a page",
    group: "vimbra",
    scope: "content",
    keys: ["<C-k>"],
    run: win => scrollBy(win, { top: -win.innerHeight / 2 }),
  },
  {
    name: "scrollHalfPageLeft",
    description: "Scroll left half a page",
    group: "vimbra",
    scope: "content",
    keys: ["<C-h>"],
    run: win => scrollBy(win, { left: -win.innerWidth / 2 }),
  },
  {
    name: "scrollHalfPageRight",
    description: "Scroll right half a page",
    group: "vimbra",
    scope: "content",
    keys: ["<C-l>"],
    run: win => scrollBy(win, { left: win.innerWidth / 2 }),
  },
  {
    name: "followLink",
    description: "Label clickable elements; typing a label clicks it",
    group: "vimbra",
    scope: "content",
    keys: ["f"],
    run: (win, actor) => actor.showHints({ newTab: false }),
  },
  {
    name: "followLinkInNewTab",
    description: "Like followLink, but opens links in a new tab",
    group: "vimbra",
    scope: "content",
    keys: ["F"],
    run: (win, actor) => actor.showHints({ newTab: true }),
  },
  {
    name: "openLocation",
    description: "Focus the address bar",
    group: "vimbra",
    scope: "parent",
    keys: ["o"],
    run: win => openLocation(win),
  },
  {
    name: "goBack",
    description: "Go back in the tab's history",
    group: "vimbra",
    scope: "parent",
    keys: ["H", "<leader>b"],
    run: win => win.BrowserCommands.back(),
  },
  {
    name: "goForward",
    description: "Go forward in the tab's history",
    group: "vimbra",
    scope: "parent",
    keys: ["L"],
    run: win => win.BrowserCommands.forward(),
  },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({
    name: `goToTab${n}`,
    description: `Go to tab ${n}`,
    group: "vimbra",
    scope: "parent",
    keys: [`<leader>${n}`],
    run: win => win.gBrowser.selectTabAtIndex(n - 1),
  })),
  {
    name: "newTab",
    description: "Open a new tab",
    group: "vimbra",
    scope: "parent",
    keys: ["<leader>t"],
    run: win => win.BrowserCommands.openTab(),
  },
  {
    name: "closeTab",
    description: "Close the current tab",
    group: "vimbra",
    scope: "parent",
    keys: [],
    run: win => win.gBrowser.removeTab(win.gBrowser.selectedTab),
  },
  {
    name: "showHistory",
    description: "Toggle the history sidebar",
    group: "vimbra",
    scope: "parent",
    keys: ["<leader>h"],
    run: win => win.SidebarController.toggle("viewHistorySidebar"),
  },
  {
    name: "showAllTabs",
    description: "List all tabs",
    group: "vimbra",
    scope: "parent",
    keys: ["<leader>ft"],
    run: win => win.gTabsPanel.showAllTabsPanel(),
  },
  {
    name: "reloadConfig",
    description: "Reload ~/.vimbrarc",
    group: "vimbra",
    scope: "parent",
    keys: [],
    run: () => ChromeUtils.importESModule(KEYMAP_URI).VimbraKeymap.load(),
  },
];

export const COMMANDS_BY_NAME = new Map(COMMANDS.map(c => [c.name, c]));
