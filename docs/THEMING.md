# Theming

Vimbra's look is token-based and switches live. It lives in
`overlay/src/browser/components/vimbra/`.

## Themes

The `vimbra.theme` pref picks one of seven themes. Each takes its palette from the owl
mark and tints the owl's iris.

| Id | Name | Look |
| --- | --- | --- |
| `noite` | Night | Default. Near-black, cyan accent |
| `ametista` | Amethyst | Deep violet, pink accent |
| `iris` | Iris | Dark teal, cyan accent |
| `brasa` | Ember | Warm dark, amber accent |
| `cobalto` | Cobalt | Navy, cobalt accent; the start page gets a blurred cobalt backdrop with grain |
| `dia` | Day | Light, violet accent |
| `sistema` | System | `dia` or `noite`, following the OS |

People pick a theme in Settings > Appearance. Hovering a swatch previews it across the
browser (`vimbra.theme.preview`), and clicking it saves it.

## How it works

`VimbraTheme.init()` runs at `browser-before-ui-startup` (see `vimbra.manifest`). It
does five things:

- It registers three author style sheets with `nsIStyleSheetService`, so every
  process gets them.
- It makes `about:vimbra` the new tab page and the default home page.
- It registers the `VimbraHome` and `VimbraSettings` window actors.
- It leaves the address bar empty on the start page.
- It clears any leftover preview.

| File | What it styles |
| --- | --- |
| `themes/vimbra-tokens.css` | The `--vb-*` tokens for each theme, bundled fonts, and the mapping of Firefox's design-system tokens onto ours |
| `themes/vimbra-chrome.css` | Browser window: tab strip, toolbar, address bar and results, menus, panels, find bar, sidebar |
| `themes/vimbra-pages.css` | Settings, Add-ons, the Library window and dialogs, plus the settings theme picker |
| `content/home.html` | `about:vimbra`, the owl start page |

Themes switch without a restart. The sheets select their palette with
`@media -moz-pref("vimbra.theme", "<id>")`, and Gecko re-evaluates those queries
when the pref changes.

Every rule sits inside `@-moz-document` blocks that list Vimbra's own documents.
That keeps web pages unstyled: they cannot see the tokens, and they cannot detect
the bundled Geist fonts. `browser_vimbra_theme.js` tests both.

## The start page

`about:vimbra` (`AboutVimbra.sys.mjs`, registered in `components.conf`) runs with a
plain content principal in the privileged-about process, the same process as
`about:newtab`.

- **Why that process:** web processes never receive non-static prefs such as
  `vimbra.theme`.
- **Fonts:** the page cannot read `chrome://` files, so it uses the system font.
- **Search:** pressing Enter in its box sends the text to `VimbraHomeParent`. The
  parent resolves it the way the address bar does and only ever loads `http(s)`
  results.

## Branding

The build's icons (`overlay/configs/branding/vimbra/`) are rendered from the owl SVG:
`logo*.png`, `firefox.ico`, `firefox64.ico`, `logo-mac.png` (on a dark rounded square),
`content/about-logo*`, `about.png`, and the wordmarks drawn from the real Vimbra wordmark.

- **Names:** `VimbraBrand.sys.mjs` registers a Fluent source, at
  `browser-before-ui-startup`, that rewrites `branding/brand.ftl` and
  `toolkit/branding/brandings.ftl` for every installed locale: Firefox becomes Vimbra in
  the brand terms and in the names of features Vimbra ships (Labs, Suggest, Home, View,
  Screenshots, Translations, Profiler). Mozilla's web services (Relay, Monitor, VPN,
  Pocket) keep their names; the Relay option is hidden in Settings.
- **Logos and Kit:** `jar.mn` overrides the Firefox logos and the fox (Kit)
  illustrations used outside the branding package with `icons/owl.svg`, or
  `icons/owl-concerned.svg` where Kit looks worried.

## Scrollbars

Thin overlay scrollbars that widen on hover (Windows 11's style) on every platform, set as
default prefs. In Vimbra's own surfaces the thumb takes the theme accent; web pages keep
their own colours, because theming them would be observable by sites.

## Window controls

Window controls stay native: traffic lights on macOS, caption buttons on Windows,
GTK buttons on Linux. Only their colours and hover states follow the theme.

## Adding a theme

1. Add a block for it in `vimbra-tokens.css`, under both `vimbra.theme` and
   `vimbra.theme.preview`.
2. Add it to `THEMES` in `VimbraTheme.sys.mjs`, with its swatch colours.
3. Add its tab strip colour to `STRIP` in `tests/browser/browser_vimbra_theme.js`.
