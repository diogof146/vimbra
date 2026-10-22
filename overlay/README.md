# overlay

Vimbra's changes to Firefox, managed with [Surfer](https://github.com/zen-browser/surfer).
Surfer resolves `src/`, `configs/` and `engine/` relative to the current directory, so
Surfer commands run from `overlay/`. The root `Makefile` does this automatically.

## Layout

| Path | Contents | In git |
| --- | --- | --- |
| `surfer.json` | Product name, app ID, pinned Firefox version, Vimbra version | yes |
| `package.json` | Pinned Surfer version | yes |
| `configs/` | Build settings (mozconfig) per OS, and branding assets | yes |
| `src/` | Vimbra source files and patches, mirroring the Firefox tree | yes |
| `engine/` | Firefox source and build output | no |
| `.surfer/` | Surfer cache and per-machine settings | no |

## How `src/` is applied

`surfer import` processes `src/`:

- `.patch` files are applied to `engine/` with `git apply`.
- All other files are symlinked to the same path in `engine/` (copied on Windows).

`surfer export <path>` turns an edited Firefox file in `engine/` into a patch in `src/`,
by diffing against the stock Firefox commit that `surfer download` creates in `engine/.git`.

## Build

Requires Node 22 (`.nvmrc`). On macOS, `brew install node@22`; the `Makefile` uses it
automatically. Node 25+ breaks Surfer's macOS icon step.

```sh
make deps        # install Surfer
make download    # fetch Firefox source into engine/
make bootstrap   # install toolchains (once per machine)
make import      # apply src/ to engine/
make build
make run
```

UI-only changes (JS, CSS, XHTML) rebuild faster with `make build-ui`.

Each `make` target runs the npm script of the same name in `overlay/package.json`
(`make run` is `npm run start`), so `cd overlay && npm run <script>` is equivalent.

## Windows

Build from the MozillaBuild shell, following Firefox's
[Windows build guide](https://firefox-source-docs.mozilla.org/setup/windows_build.html).

- Clone to a short path such as `C:\vimbra`.
- Install Node 22, Git for Windows and 7-Zip (`7z` must be on `PATH`).
- Enable Developer Mode (Settings > System > For developers) so Surfer can symlink
  `src/` into `engine/`.
- Add the antivirus exclusions listed in Firefox's guide.
- If `make` is unavailable, use the npm scripts directly.

## Updating Firefox

```sh
make update   # replace engine/ with the latest release, update surfer.json
make import
make build
```

Patches that no longer apply to the new version must be fixed by hand.
