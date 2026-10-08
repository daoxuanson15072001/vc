#!/usr/bin/env bash
# Cài cơ sở dữ liệu vector Qdrant (tìm tầng thô theo nghĩa — backend/app/kb/doc_vectors.py) + job nạp ban đêm.
#   bash setup_vector_db.sh            cài / cập nhật (chạy lại bao nhiêu lần cũng được)
#   bash setup_vector_db.sh --remove   gỡ hai job launchd (giữ dữ liệu ở data/qdrant)
# - Qdrant chạy thẳng trên máy (không cần Docker), chỉ nghe 127.0.0.1:6333, dữ liệu ở data/qdrant,
#   launchd com.vcpv.qdrant tự bật khi đăng nhập và tự chạy lại nếu tắt.
# - Job đêm launchd com.vcpv.nightly-vectors: NIGHT_AT (mặc định 00:30) mỗi đêm chạy nightly_vectors.sh.
#   Máy ngủ đúng giờ đó thì launchd chạy bù khi máy thức dậy.
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
QDRANT_VERSION="${QDRANT_VERSION:-v1.19.1}"
BIN_DIR="$HOME/.local/qdrant"
AGENTS="$HOME/Library/LaunchAgents"
NIGHT_AT="${NIGHT_AT:-00:30}"
UID_="$(id -u)"

if [[ "$1" == "--remove" ]]; then
  for l in com.vcpv.qdrant com.vcpv.nightly-vectors; do
    launchctl bootout "gui/$UID_/$l" 2>/dev/null || true
    rm -f "$AGENTS/$l.plist"
  done
  echo "Đã gỡ job Qdrant + job đêm (dữ liệu vẫn ở data/qdrant)."
  exit 0
fi

if [[ ! -x "$BIN_DIR/qdrant" ]] || ! "$BIN_DIR/qdrant" --version 2>/dev/null | grep -q "${QDRANT_VERSION#v}"; then
  case "$(uname -m)" in arm64) ARCH=aarch64 ;; *) ARCH=x86_64 ;; esac
  echo "Tải Qdrant $QDRANT_VERSION..."
  mkdir -p "$BIN_DIR"
  curl -fsSL "https://github.com/qdrant/qdrant/releases/download/$QDRANT_VERSION/qdrant-$ARCH-apple-darwin.tar.gz" \
    | tar xz -C "$BIN_DIR"
fi
mkdir -p "$ROOT/data/qdrant" "$ROOT/output/logs" "$AGENTS"

cat >"$AGENTS/com.vcpv.qdrant.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.vcpv.qdrant</string>
  <key>ProgramArguments</key><array><string>$BIN_DIR/qdrant</string></array>
  <key>WorkingDirectory</key><string>$BIN_DIR</string>
  <key>EnvironmentVariables</key><dict>
    <key>QDRANT__STORAGE__STORAGE_PATH</key><string>$ROOT/data/qdrant/storage</string>
    <key>QDRANT__STORAGE__SNAPSHOTS_PATH</key><string>$ROOT/data/qdrant/snapshots</string>
    <key>QDRANT__SERVICE__HOST</key><string>127.0.0.1</string>
    <key>QDRANT__TELEMETRY_DISABLED</key><string>true</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$ROOT/output/logs/qdrant.log</string>
  <key>StandardErrorPath</key><string>$ROOT/output/logs/qdrant.log</string>
</dict></plist>
PLIST

H=$((10#${NIGHT_AT%%:*})); M=$((10#${NIGHT_AT##*:}))
cat >"$AGENTS/com.vcpv.nightly-vectors.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.vcpv.nightly-vectors</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$ROOT/nightly_vectors.sh</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>$H</integer><key>Minute</key><integer>$M</integer></dict>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$ROOT/output/logs/nightly_vectors.log</string>
  <key>StandardErrorPath</key><string>$ROOT/output/logs/nightly_vectors.log</string>
</dict></plist>
PLIST

for l in com.vcpv.qdrant com.vcpv.nightly-vectors; do
  launchctl bootout "gui/$UID_/$l" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_" "$AGENTS/$l.plist"
done
for _ in $(seq 1 20); do curl -sf http://127.0.0.1:6333/readyz >/dev/null && break; sleep 1; done
if curl -sf http://127.0.0.1:6333/readyz >/dev/null; then
  echo "Qdrant đang chạy: http://127.0.0.1:6333 (dashboard: /dashboard) · dữ liệu: data/qdrant"
else
  echo "Qdrant chưa lên — xem output/logs/qdrant.log"
fi
echo "Job đêm: $NIGHT_AT mỗi đêm -> nightly_vectors.sh (log output/logs/nightly_vectors.log)"
echo "Chạy ngay không chờ đêm: launchctl kickstart gui/$UID_/com.vcpv.nightly-vectors"
