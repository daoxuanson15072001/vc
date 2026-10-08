#!/bin/zsh
# Build the VClinks extension from this repo and run it in the Chrome driver: a separate
# Chrome for Testing with its own profile and a remote-debugging port, so Claude can
# drive it over CDP and it never touches the owner's everyday Chrome.
#
#   pnpm driver                                  build, then (re)start the driver on VCLINKS_API
#   pnpm driver -- --no-build                    restart with the existing apps/extension/build
#   VCLINKS_TOKEN=<ingest token> pnpm driver     also store the token (first run)
#
# A restart is the only way to update the extension here: Chrome unloads an extension
# that came from --load-extension as soon as it is reloaded (chrome.runtime.reload() or
# the Reload button in chrome://extensions), so never copy a new build into DRIVER_EXT
# while the driver is running. The restart reopens the http(s) tabs that were open.
#
# Env:        VCLINKS_API     API the extension talks to      (default http://localhost:3000)
#             VCLINKS_TOKEN   ingest token to store            (default: keep the stored one)
#             DRIVER_PORT     CDP port                         (default 9333)
#             DRIVER_PROFILE  Chrome profile dir               (default ~/.vclinks-chrome-profile)
#             DRIVER_EXT      unpacked extension copy          (default ~/.vclinks-chrome-ext)
#             DRIVER_URL      first tab                        (default https://chat.zalo.me)
#             DRIVER_NAME     window title prefix, tells the Chrome windows apart in the Dock
#                             menu / Mission Control (default "VClinks · driver chung :<port>")
#             CHROME_BIN      browser binary (default: newest playwright Chromium, then /Applications;
#                             on Linux: newest playwright chromium-linux, then google-chrome)
#             DRIVER_NO_CONFIG=1  skip driver-config at the end (fleet.js configures the profile itself)
#             CHROME_EXTRA_FLAGS  extra Chrome flags, space separated (e.g. for the máy Zalo container)
#
# Several profiles (one Zalo account each) are run by fleet.js, which calls this script with
# DRIVER_PORT/DRIVER_PROFILE/DRIVER_EXT set per profile; see docs/06-van-hanh/chrome-driver.md.
set -e
HERE=${0:A:h}
REPO=${HERE:h:h}
SRC=${SRC:-$REPO/apps/extension/build}
DEV=${DRIVER_EXT:-$HOME/.vclinks-chrome-ext}
PROFILE=${DRIVER_PROFILE:-$HOME/.vclinks-chrome-profile}
PORT=${DRIVER_PORT:-9333}
API=${VCLINKS_API:-http://localhost:3000}
START_URL=${DRIVER_URL:-https://chat.zalo.me}
LOG=${DRIVER_LOG:-$PROFILE/driver.log}
NAME=${DRIVER_NAME:-"VClinks · driver chung :$PORT"}

BUILD=1
for a in "$@"; do
  case "$a" in
    --no-build) BUILD=0 ;;
    -h|--help) sed -n '2,28p' "$0"; exit 0 ;;
    *) echo "unknown flag: $a" >&2; exit 1 ;;
  esac
done

if [ "$BUILD" = 1 ]; then
  (cd "$REPO" && pnpm --filter @vclinks/shared build >/dev/null && pnpm --filter @vclinks/extension build)
fi
[ -f "$SRC/manifest.json" ] || { echo "no build at $SRC" >&2; exit 1; }

# Browser binary: Chrome for Testing from playwright's cache is preferred (npx playwright-core install chromium).
if [ -z "$CHROME_BIN" ] && [ "$(uname)" = Linux ]; then
  for c in "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome(Nn[-1]) /usr/bin/google-chrome /usr/bin/chromium; do
    [ -x "$c" ] && CHROME_BIN="$c" && break
  done
fi
if [ -z "$CHROME_BIN" ]; then
  for c in "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/"Google Chrome for Testing.app"(Nn[-1]) \
           "/Applications/Google Chrome for Testing.app" "/Applications/Google Chrome.app"; do
    [ -d "$c" ] && CHROME_BIN="$c/Contents/MacOS/${c:t:r}" && break
  done
fi
[ -x "$CHROME_BIN" ] || { echo "no Chrome binary; install with: npx playwright-core install chromium" >&2; exit 1; }

# Remember the http(s) tabs of the running driver so the restart can reopen them.
TABS=()
if curl -s --max-time 2 "localhost:$PORT/json/version" >/dev/null 2>&1; then
  TABS=("${(@f)$(curl -s "localhost:$PORT/json" | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const seen = new Set();
      for (const t of JSON.parse(s)) if (t.type === "page" && /^https?:/.test(t.url) && !seen.has(t.url)) { seen.add(t.url); console.log(t.url); }
    });')}")
fi

# Stop the previous driver of this profile (main process only; helpers follow it).
OLD=$(ps -eo pid=,args= | grep -F -- "--user-data-dir=$PROFILE " | grep -v -- "--type=" | grep -v grep | awk '{print $1}')
if [ -n "$OLD" ]; then
  kill $OLD 2>/dev/null || true
  for i in $(seq 1 20); do ps -p $OLD >/dev/null 2>&1 || break; sleep 0.5; done
  ps -p $OLD >/dev/null 2>&1 && kill -9 $OLD 2>/dev/null || true
fi

# Fresh extension copy. It differs from the real build in one way: http://localhost/* is
# granted up front (every port), because chrome.permissions.request() needs a click and
# nobody clicks in the driver. A non-localhost VCLINKS_API origin is added the same way.
mkdir -p "$DEV"
rsync -a --delete "$SRC/" "$DEV/"
API_ORIGIN=$(node -e "console.log(new URL(process.argv[1]).origin + '/*')" "$API")
python3 - "$DEV/manifest.json" "$API_ORIGIN" <<'PY'
import json, sys
p, origin = sys.argv[1], sys.argv[2]
m = json.load(open(p))
hp = m.setdefault('host_permissions', [])
for o in ['http://localhost/*'] + ([origin] if not origin.startswith('http://localhost') else []):
    if o not in hp:
        hp.append(o)
json.dump(m, open(p, 'w'), ensure_ascii=False, indent=2)
PY
echo "extension copy: $DEV (build $(node -e "console.log(require('$DEV/build-id.json').id)"))"

mkdir -p "$PROFILE"
rm -f "$PROFILE/SingletonLock"
# We kill Chrome, so it records a crash and restores the last session on top of
# START_URL and the reopened tabs: duplicate chat.zalo.me tabs, one of them on
# Zalo's "Kích hoạt" screen, and the sender may lock onto that dead tab. Mark the
# exit clean so nothing is restored (the tabs are reopened below anyway).
python3 - "$PROFILE/Default/Preferences" <<'PY' 2>/dev/null || true
import json, sys
p = sys.argv[1]
try:
    d = json.load(open(p))
except Exception:
    sys.exit(0)
d.setdefault('profile', {})['exit_type'] = 'Normal'
d['profile']['exited_cleanly'] = True
json.dump(d, open(p, 'w'))
PY
# Chrome may keep serving a cached copy of the old background.js; drop that cache.
rm -rf "$PROFILE/Default/Service Worker"
# The compiled-JS cache (SQLite in Chrome 148+) is left half-written by the kill above and
# then crashes Chrome for Testing on start (SIGTRAP on a blocking thread, ~2 launches of 3
# with --load-extension; 04/10/2026). It is only a cache, so drop it every restart.
rm -rf "$PROFILE/Default/Code Cache"

# Chrome 148 moved the compiled-JS cache to a SQLite "persistent cache" backend
# (components/persistent_cache), which is what dies with SIGTRAP on a blocking thread when the
# driver restarts or loads chat.zalo.me (04/10/2026). Fall back to the old backend.
nohup "$CHROME_BIN" --user-data-dir="$PROFILE" --remote-debugging-port="$PORT" \
  --disable-features=UsePersistentCacheForCodeCache \
  --disable-extensions-except="$DEV" --load-extension="$DEV" \
  --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling \
  --window-name="$NAME" --window-size=1400,900 --window-position=0,0 --lang=vi ${=CHROME_EXTRA_FLAGS} "$START_URL" > "$LOG" 2>&1 &
disown
# --max-time: a hung Chrome accepts the connection and never answers, which would hang this
# loop (and the caller) instead of failing after 30 s.
for i in $(seq 1 30); do curl -s --max-time 2 "localhost:$PORT/json/version" >/dev/null 2>&1 && break; sleep 1; done
curl -s --max-time 2 "localhost:$PORT/json/version" >/dev/null 2>&1 || { echo "driver did not come up; see $LOG" >&2; exit 1; }
echo "driver up on :$PORT (profile $PROFILE, log $LOG)"

for t in "${TABS[@]}"; do
  [ -n "$t" ] && [ "${t%/}" != "${START_URL%/}" ] && curl -s -X PUT "localhost:$PORT/json/new?$t" >/dev/null && echo "reopened $t"
done

# Safety net: one tab per URL (the extension's sender takes a per-tab lock on chat.zalo.me,
# and a restored duplicate would sit on Zalo's "Kích hoạt" screen).
sleep 3
curl -s "localhost:$PORT/json" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", async () => {
    const seen = new Set();
    for (const t of JSON.parse(s).filter((t) => t.type === "page" && /^https?:/.test(t.url))) {
      const key = t.url.startsWith("https://chat.zalo.me") ? "https://chat.zalo.me" : t.url.replace(/\/$/, "");
      if (seen.has(key)) { await fetch(`http://localhost:${process.argv[1]}/json/close/${t.id}`); console.log("closed duplicate tab", key.slice(0, 40)); }
      else seen.add(key);
    }
  });' "$PORT"

# Point the extension at the API (and store the token when given), then show the state.
[ -n "$DRIVER_NO_CONFIG" ] && exit 0
sleep 2
cd "$REPO" && DRIVER_PORT="$PORT" DRIVER_EXT="$DEV" node "$HERE/driver-config.js" --api "$API"
