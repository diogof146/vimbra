# Keybindings

Generated from `overlay/src/browser/components/vimbra/VimbraCommands.sys.mjs`
by `make keybindings`. Do not edit by hand.

Keys apply while browsing, when no text field is focused. `<leader>` is `<Space>` and `<localleader>` is `,` unless changed in `~/.vimbrarc`.

## Vim

Standard vim bindings.

| Keys | Command | Description |
| --- | --- | --- |
| `j` | `scrollDown` | Scroll down |
| `k` | `scrollUp` | Scroll up |
| `h` | `scrollLeft` | Scroll left |
| `l` | `scrollRight` | Scroll right |
| `gg` | `scrollToTop` | Scroll to the top |
| `G` | `scrollToBottom` | Scroll to the bottom |
| `gt` | `nextTab` | Go to the next tab |
| `gT` | `previousTab` | Go to the previous tab |
| `/` | `search` | Search the page; Enter returns to the page |
| `n` | `searchNext` | Go to the next search match |
| `N` | `searchPrevious` | Go to the previous search match |

## Vimbra

Vimbra's own commands.

| Keys | Command | Description |
| --- | --- | --- |
| `<C-j>` | `scrollHalfPageDown` | Scroll down half a page |
| `<C-k>` | `scrollHalfPageUp` | Scroll up half a page |
| `<C-h>` | `scrollHalfPageLeft` | Scroll left half a page |
| `<C-l>` | `scrollHalfPageRight` | Scroll right half a page |
| `f` | `followLink` | Label clickable elements; typing a label clicks it |
| `F` | `followLinkInNewTab` | Like followLink, but opens links in a new tab |
| `o` | `openLocation` | Focus the address bar |
| `H`, `<leader>b` | `goBack` | Go back in the tab's history |
| `L` | `goForward` | Go forward in the tab's history |
| `<leader>1` | `goToTab1` | Go to tab 1 |
| `<leader>2` | `goToTab2` | Go to tab 2 |
| `<leader>3` | `goToTab3` | Go to tab 3 |
| `<leader>4` | `goToTab4` | Go to tab 4 |
| `<leader>5` | `goToTab5` | Go to tab 5 |
| `<leader>6` | `goToTab6` | Go to tab 6 |
| `<leader>7` | `goToTab7` | Go to tab 7 |
| `<leader>8` | `goToTab8` | Go to tab 8 |
| `<leader>9` | `goToTab9` | Go to tab 9 |
| `<leader>t` | `newTab` | Open a new tab |
| (unbound) | `closeTab` | Close the current tab |
| `<leader>h` | `showHistory` | Toggle the history sidebar |
| `<leader>ft` | `showAllTabs` | List all tabs |
| (unbound) | `reloadConfig` | Reload ~/.vimbrarc |

## Customizing

Vimbra reads `~/.vimbrarc` at startup (`%USERPROFILE%\.vimbrarc` on Windows).
Run `reloadConfig` after editing it. Errors are printed to the Browser Console
with their line numbers, and invalid lines are skipped.

```vim
" Comments start with a double quote.
let mapleader = "<Space>"     " leader for the lines below
let maplocalleader = ","
map <C-d> scrollHalfPageDown  " bind keys to a command from the tables above
unmap gt                      " remove a binding
noremap b q                   " typing b acts as q
noremap q b
```

Trailing comments are shown here for explanation only; a comment must be on
its own line.

- `noremap` takes one key on each side. After `noremap b q`, `b` no longer
  acts as itself unless another `noremap` maps a key to it, so a swap needs
  both lines.
- `map` and `unmap` refer to the keys as typed, after `noremap`.
- Keys use vim notation: `<C-x>` Ctrl, `<A-x>` or `<M-x>` Alt/Option,
  `<D-x>` Cmd, `<S-x>` Shift with special keys, and `<Esc>`, `<CR>`,
  `<Space>`, `<Tab>`, `<BS>`, `<Del>`, `<Up>`, `<Down>`, `<Left>`,
  `<Right>`, `<Home>`, `<End>`, `<PageUp>`, `<PageDown>`, `<F1>`-`<F12>`,
  `<lt>` for `<`.
- When one binding is a prefix of another (`g` and `gg`), the shorter one
  runs after a one-second pause.
