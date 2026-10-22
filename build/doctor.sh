#!/usr/bin/env bash
# Preflight: can this machine build Firefox/Vimbra? Read-only; changes nothing.
set -u
# rustup installs to ~/.cargo/bin; a shell opened before bootstrap won't have it on PATH yet.
export PATH="$HOME/.cargo/bin:$PATH"
# Same Node 22 keg the Makefile prefers.
for d in /opt/homebrew/opt/node@22/bin /usr/local/opt/node@22/bin; do
  [ -d "$d" ] && export PATH="$d:$PATH" && break
done
fail=0
ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=1; }
warn() { printf '  \033[33mwarn\033[0m  %s\n' "$1"; }

echo "Vimbra build doctor ($(uname -s) $(uname -m))"

# --- disk: source (~3 GB) + objdir + toolchains. Official docs say 30 GB; we want headroom.
root="$(cd "$(dirname "$0")/.." && pwd)"
free_gb=$(df -Pk "$root" | awk 'NR==2 {printf "%d", $4/1048576}')
if [ "$free_gb" -ge 60 ]; then ok "free disk: ${free_gb} GB"; else bad "free disk: ${free_gb} GB (want >= 60)"; fi

# --- core tools
for t in git curl; do
  command -v "$t" >/dev/null && ok "$t" || bad "$t missing"
done

if command -v node >/dev/null; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$major" -lt 22 ]; then
    bad "node $(node -v) (want 22, see .nvmrc)"
  elif [ "$major" -ge 25 ] && [ "$(uname -s)" = Darwin ]; then
    bad "node $(node -v): Surfer's macOS icon step breaks on Node 25+; brew install node@22"
  else
    ok "node $(node -v)"
  fi
else bad "node missing"; fi

if command -v python3 >/dev/null; then
  python3 -c 'import sys; sys.exit(sys.version_info < (3,9))' \
    && ok "python3 $(python3 -V 2>&1 | cut -d' ' -f2)" || bad "python3 too old (want >= 3.9)"
else bad "python3 missing"; fi

# --- Rust: needed for the sidecar; mach bootstrap installs its own for Gecko.
command -v cargo >/dev/null && ok "cargo $(cargo -V | cut -d' ' -f2)" \
  || warn "cargo missing (not needed for the Firefox build; needed for sidecar/)"

# --- platform specifics
case "$(uname -s)" in
  Darwin)
    # Surfer refuses to unpack Firefox's source with macOS's BSD tar.
    command -v gtar >/dev/null && ok "gtar (GNU tar)" || bad "gtar missing: brew install gnu-tar"
    command -v xz >/dev/null && ok "xz" || bad "xz missing"
    # Firefox's docs say "install Xcode", but Command Line Tools' SDK is enough
    # (verified with Firefox 158.0.1).
    if xcodebuild -version >/dev/null 2>&1; then
      ok "$(xcodebuild -version | head -1) (full Xcode)"
    elif xcrun --show-sdk-path >/dev/null 2>&1; then
      ok "macOS SDK from Command Line Tools ($(xcrun --show-sdk-path))"
    else
      bad "no macOS SDK found (install Xcode or Command Line Tools)"
    fi
    ;;
  Linux)
    for t in tar xz; do
      command -v "$t" >/dev/null && ok "$t" || bad "$t missing"
    done
    command -v gcc >/dev/null || command -v clang >/dev/null && ok "C compiler" || bad "no gcc/clang"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    # Surfer unpacks Firefox's source with 7-Zip on Windows.
    command -v 7z >/dev/null && ok "7z (7-Zip)" || bad "7z missing: install 7-Zip and add it to PATH"
    # surfer.json sets windowsUseSymbolicLinks, which needs Developer Mode.
    if MSYS2_ARG_CONV_EXCL='*' reg.exe query \
        'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' \
        /v AllowDevelopmentWithoutDevLicense 2>/dev/null | grep -q 0x1; then
      ok "Developer Mode (symlinks)"
    else
      bad "Developer Mode off: Settings > System > For developers"
    fi
    # engine/ lives inside the repo; long paths break parts of the Windows build.
    if [ ${#root} -le 20 ]; then
      ok "short repo path ($root)"
    else
      warn "long repo path ($root); clone to a short path like C:\\vimbra"
    fi
    ;;
esac

echo
[ "$fail" -eq 0 ] && echo "Ready to build." || { echo "Fix the FAIL items above first."; exit 1; }
