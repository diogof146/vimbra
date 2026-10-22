# Browser Project — Plan & Architecture

Oct 21, 2026 · @Diogo Ferreira

A cross-platform, customization- and privacy-first web browser, built as an overlay on Firefox/Gecko with a vim-style interface and an integrated security pipeline — developed by two engineers in one monorepo.

## Overview

A cross-platform web browser (Windows, Linux, macOS) focused on deep customization and operational security (OPSEC), intended to ship as a real product.

- **Who:** two engineers, one monorepo, reviewing each other's pull requests (PRs).
- **Why:** to learn security in depth, to get a vim- and window-manager-grade browsing experience that doesn't exist elsewhere, and to ship something with genuine value.

## Goals, priorities & threat model

Priorities, in order:

1. **OPSEC first** — minimize what the browser leaks.
2. **Speed on par with Brave** — not noticeably slower to daily-drive.
3. **Customization-first** — the differentiator: vim, splits, keybind-everything, UI theming.
4. **Testability** — every security property must be measurable.

Threat model (realistic, not absolute):

- **Primary:** commercial surveillance and data collection by large companies, browser fingerprinting, and malware.
- **Anonymity:** an ongoing process, layered in over time — not required on day one. A "Tor window" gives strong IP (Internet Protocol) anonymity but is **not** Tor-Browser-grade (see open decisions).
- **Out of scope for now:** nation-state-grade anonymity, and phone / SMS (Short Message Service) verification leaks.

## Architecture

We build on **Firefox / Gecko** as an overlay — a peer to LibreWolf and Zen, not a downstream fork of them. Forking is mandatory: a clean-slate engine would discard years of standards compliance, the sandbox, and fingerprint resistance for zero product gain.

Three layers:

1. **Engine (inherited, barely touched)** — Gecko (C++ and Rust). We inherit Resist Fingerprinting (RFP), the content-process sandbox, and cross-platform windowing.
2. **Chrome / front-end (ours)** — the browser UI, in JavaScript + CSS + XHTML. All customization lives here.
3. **Sidecar (ours)** — a separate privileged process in Rust holding the whole security pipeline.

**Network egress pipeline** — adblock, VPN, encrypted DNS and the intercept proxy are not four features; they are stages of one local proxy the browser routes through:

```
tab → [ intercept / modify ] → [ adblock ] → [ DNS: DoH ] → direct  OR  [ WireGuard ]  OR  [ Tor ] → internet
```

Running this as its own process is also the **privilege boundary**: the sidecar's secrets (certificate keys, tunnel credentials) sit outside the untrusted web-rendering process. This is independent of the monorepo — one repo, several processes at runtime.

## Tech stack

| Layer | Language / tech | Key references |
| --- | --- | --- |
| Engine | Gecko — C++ / Rust (untouched) | mozilla-firefox/firefox |
| Chrome / front-end | JavaScript, CSS, XHTML | Zen (splits), Tridactyl, IdeaVim, Vimput, CodeMirror vim |
| Sidecar | Rust + Tokio (async) | crates below |
| Pentest / dashboard UI (optional) | Local web app (React or Svelte), served by the sidecar | Caido, HTTP Toolkit |
| Browser ↔ sidecar | Local WebSocket or gRPC, versioned command protocol | — |

Sidecar crates:

- **Adblock** — `adblock` (the engine behind Brave's blocker).
- **Intercept proxy** — `hudsucker` (HTTP/S + WebSocket), with `rcgen` for certificate generation.
- **Tor** — `arti-client` (the Tor Project's Rust implementation).
- **VPN** — `boringtun` (Cloudflare's userspace WireGuard, no root).
- **DNS** — `hickory-dns` with the DoH (DNS over HTTPS) / DoT (DNS over TLS) features.
- **TLS (Transport Layer Security)** — `rustls`.
- **Encryption / vault** — `age` / `rage`; encrypted SQLite (SQLCipher).
- **Aliasing** — `reqwest` against a self-hosted SimpleLogin or addy.io API (Application Programming Interface).

## Repository & build

One monorepo. Firefox source is a **build input** (pinned version), never committed — it is gigabytes.

Layout:

- **chrome overlay** — our features + patches to Firefox files (Zen-style `src/`).
- **sidecar** — the Rust Cargo workspace.
- **protocol** — the shared browser ↔ sidecar command / IPC (inter-process communication) spec.
- **config** — the keymap schema.
- **build / CI** — scripts that fetch Firefox and apply our overlay (our own version of Zen's "Surfer" or LibreWolf's patch set + Makefile), plus continuous integration (CI).

Firefox's source moved from Mercurial to Git on GitHub in April 2025, so this is all Git-native.

**First milestone:** clone Zen's or LibreWolf's build scaffolding and confirm it builds and launches a vanilla fork on both machines. Nothing else starts until that works.

## Feature set

Phase tags: **v0** (usable daily driver) · **P1–P3** (later phases) · **—** (integrate, don't build).

| Area | Feature | Notes | Phase |
| --- | --- | --- | --- |
| Customization | Vim modes | modal editing in every text field + browsing mode | v0 → ongoing |
| Customization | In-app splits | tmux-style panes inside one window | v0 |
| Customization | Keybind everything | command registry + rc file + settings UI | v0 |
| Customization | UI theming | token-based, hot-reload | v0 |
| Customization | Command palette | fuzzy search over the command registry | v0 / P1 |
| Customization | Edit-in-Neovim | optional: launch real nvim for a field | Later |
| Privacy | Adblock | `adblock-rust` + uBlock Origin lists | v0 |
| Privacy | Balanced defaults | Brave-like, not Mullvad-maximal | v0 |
| Privacy | Strict anti-fingerprint mode | RFP techniques from Arkenfox / Mullvad / Tor | P3+ |
| Privacy | Containers | per-site identity, ephemeral option | P1 |
| Privacy | URL cleaning | strip tracking params, unwrap redirects | P1 |
| Network | VPN | embedded WireGuard, per-container exits, fail-closed | P1 |
| Network | Encrypted DNS | DoH / DoT; ODoH later | P1 |
| Network | Tor window | `arti-client`; IP-anonymous, not Tor-Browser-grade | P3 |
| Security tooling | Intercept proxy | Burp-style: intercept, repeater, fuzzer, match & replace | P2 |
| Security tooling | Flow dashboard | per-site "what it tried", fed by the proxy | P2 |
| Security tooling | Detect being MITM'd | certificate pinning / change alerts | P2 |
| Identity & services | Email aliasing | SimpleLogin / addy.io; "disposable identity" action | P3 |
| Identity & services | E2EE sync | our own end-to-end-encrypted sync of browser state | P2 / P3 |
| Identity & services | Encrypted vault | client-side-encrypted files, pluggable backend | P3 |
| Don't build | Password manager | integrate Bitwarden / KeePassXC | — |
| Don't build | Mail service | integrate an existing provider | — |
| Don't build | Cloud drive | Cryptomator / Nextcloud / managed E2EE drive | — |

## Developer tools

Firefox's full developer tools come free with the fork — inspector, console, debugger, network, storage — and they're built in web tech, so "better" means extending them, not rebuilding.

- **More readable / intuitive** — restyle the panels with the browser's theming tokens, and tighten layout and typography. A reskin is realistic; a ground-up rewrite is not.
- **Vim keys + command palette** — extend the browser-wide command / keymap registry into the dev tools panels. Keyboard-driven dev tools is a real gap in Chrome and Firefox, and a natural differentiator.
- **More functionality, uniquely ours** — the sidecar already sees all traffic, so the Network panel can do what stock dev tools can't: full HTTPS intercept, a request editor and replayer (repeater), WebSocket editing, history that survives reloads, and the per-site privacy view. The intercept suite and flow dashboard from the feature set live here as panels.

Scope: patch and extend the inherited dev tools (rides the rebase treadmill like the rest of the chrome). Phase: readability + vim keys in v0 / P1; the sidecar-powered panels with the security tooling in P2.

## Vim & keymap system

A vim **emulation** engine built into the browser — not real Neovim embedded.

**Modes** — two top-level modes:

- **Browsing mode** — link hints, scroll, `:` command line, `/` search (active when no field is focused).
- **Text mode** — entered on field focus; contains normal, visual, visual-line, insert, operator-pending and command sub-modes.

**Three subsystems:**

1. **Emulation engine** — modes, operators, motions, text objects, counts, registers, dot-repeat, macros. Reuse, don't rewrite: adapt the vim engine from CodeMirror's vim mode or monaco-vim.
2. **Field attachment** — easy for `<input>` / `<textarea>`; hard for `contenteditable` and sites with their own editors (Google Docs, Monaco), where the fallback is a Vimput-style overlay editor.
3. **Config** — a **named-command / action registry** is the backbone: every browser action is a named command. The `~/.<name>rc` file is a declarative **key → command** map; a settings UI edits the same canonical store; the command palette lists the same registry.

**Scope decisions (deliberate simplifications):**

- Plugins (surround, commentary, and so on) are **built-in native features** — no third-party plugin loading, no vimscript interpreter.
- The config is **keybinds only, for the whole browser** — not just vim mode.
- Authority model: one canonical keymap store the app persists; the rc file is parsed on load, the UI writes both.

**Fork advantage:** as privileged chrome code we intercept keys before the page sees them — a WebExtension cannot do this reliably.

## Security & testing

**Securing the browser itself** (distinct from the privacy features):

- **Secrets at rest** — the intercept certificate authority (CA) key, WireGuard credentials and aliaser tokens live in the OS keychain or an encrypted profile, never plaintext on disk.
- **Our added attack surface** — the intercept proxy + CA, the sidecar's IPC channel, and userscript injection (which must run in an isolated world).
- **Supply chain** — `cargo-audit`, pinned dependencies, and reproducible builds (later); a security-branded browser getting supply-chained is catastrophic.
- **Never weaken Gecko's sandbox** — it is inherited protection, and no convenience feature may loosen it.

**Testing strategy:**

- **OPSEC regression rig** — EFF Cover Your Tracks, BrowserLeaks, an IP / DNS / WebRTC (Web Real-Time Communication) leak harness, and TLS fingerprint (JA3 / JA4) checks.
- **The intercept suite doubles as the test rig** — we watch our own browser's egress through the tool we built.
- **Also** — web-platform compatibility (sites break on forks), fuzzing the proxy and parsers, and a performance harness guarding the "Brave-fast" target.

## Roadmap, shipping & open decisions

**Phases** (order is driven by threat-model priority, not fixed):

1. **v0 — usable daily driver.** A Firefox-based fork that builds and launches, plus the chrome (vim keybinds with a toggle, in-app splits, UI/UX, balanced defaults, adblock). Sidecar bootstrapped as a local proxy running adblock. Bar: not worse than Brave to use.
2. **P1 — network & privacy layer.** VPN, encrypted DNS, containers, URL cleaning.
3. **P2 — security tooling.** Intercept suite, flow dashboard, detect-MITM, E2EE sync.
4. **P3 — identity & anonymity.** Email aliasing + disposable identity, encrypted vault, Tor window, strict anti-fingerprint mode.
5. **Later — shipping machinery.** Auto-updater, code signing + notarization (recurring cost), release channels, package-manager distribution, reproducible builds, a name + logo + domain (cannot ship as "Firefox"), a stated zero / transparent telemetry policy, and a plan for recurring costs.

**Open decisions (next up):**

- **Name** — and therefore `~/.<name>rc`.
- **Base** — confirm the Firefox-direct overlay, and which hardening references to crib (Arkenfox `user.js`, LibreWolf prefs, Mullvad / Tor RFP).
- **IPC transport** — WebSocket vs gRPC.
- **Pentest UI** — in-chrome vs a local web app.
- **Config authority model** — file vs store; settle before building the keymap layer.

## Getting started (day one)

Working name: **Vimbra** (vim + *umbra*) — revisit before launch. This unblocks the repo and `~/.vimbrarc`.

1. **Export this plan into the repo.** Save this doc as Markdown to `docs/ARCHITECTURE.md`. This is what gives Claude Code (and anyone new) the full context — a fresh session has none of the planning conversation.
2. **Create the monorepo.** `git init`, then the skeleton: `overlay/` (chrome + Firefox patches), `sidecar/` (Rust), `protocol/` (the browser ↔ sidecar contract), `docs/`, `build/`.
3. **Get a vanilla fork building and launching.** The long pole — start it first. Clone Zen's `desktop` (Surfer-based) or LibreWolf's `source`, run its bootstrap, and kick off the first build. Expect it heavy: tens of minutes to a couple of hours, and roughly 40 GB free. Today's goal is literally "a vanilla browser window opens." Touch no features until it does.
4. **Scaffold the sidecar in parallel.** While the build churns: `cargo new sidecar`, and stub the smallest possible local proxy (a Tokio listener that just forwards). That is the seed the whole pipeline grows from.

**Moving to Claude Code:** point it at `docs/ARCHITECTURE.md` first, then let it drive steps 2–4 and explain the Firefox source layout, the Surfer / patch flow, and where the chrome lives (`browser.xhtml`) as it goes.

**Done-today bar:** repo + plan-in-repo + a vanilla fork launching + a sidecar skeleton. Features start tomorrow.
