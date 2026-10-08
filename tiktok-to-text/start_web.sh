#!/usr/bin/env bash
# Chạy bản web: bash start_web.sh        -> http://localhost:8000 (BE phục vụ luôn FE đã build)
#               bash start_web.sh --dev  -> BE :8000 + FE Vite :5173 (sửa code FE/BE thấy ngay:
#                                           FE qua Vite HMR, BE tự khởi động lại khi đổi file trong backend/app)
#               bash start_web.sh --reload -> như bản thường (:8000) nhưng BE tự reload khi sửa backend/app
#               bash start_web.sh --no-auto -> bản thường, tắt tự nạp code mới
# Bản thường tự nạp code mới: cứ 10 giây xem commit của nhánh đang chạy (develop); có commit mới
# (vd vừa merge) thì build lại FE nếu frontend/ đổi, cài lại thư viện nếu requirements.txt đổi,
# thử import app — lỗi thì giữ máy chủ cũ — rồi khởi động lại BE (chỉ khi backend/ đổi).
# Chỉ theo commit, không theo file đang sửa dở; đang ở nhánh khác / đang merge thì chờ.
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8000}"   # đổi cổng khi cần chạy thử bản thứ hai

# Cổng $PORT đang bận -> dừng ngay. Nếu để uvicorn tự báo lỗi thì app đã kịp chạy luồng nền
# vài giây và giành việc đang dở của máy chủ cũ.
if pid=$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null) && [[ -n "$pid" ]]; then
  echo "Cổng $PORT đang được tiến trình $pid dùng (máy chủ cũ còn chạy)."
  echo "Tắt nó trước:  kill $pid   (không tắt sau 15 giây thì: kill -9 $pid)"
  exit 1
fi

# Tự dò mongod.conf (MONGOD_CONF → /usr/local → /opt/homebrew; lý do thứ tự ở lib_mongo.sh)
source ./lib_mongo.sh
ensure_mongo

# AI local (Ollama): không bắt buộc — thiếu thì sàng lọc tự dùng Claude
LOCAL_MODEL="${LOCAL_LLM_MODEL:-gemma3:12b}"
if command -v ollama >/dev/null 2>&1; then
  if ! curl -sf http://127.0.0.1:11434/api/version >/dev/null; then
    echo "AI local: Ollama chưa chạy — khởi động..."
    open -a Ollama 2>/dev/null || (ollama serve >/dev/null 2>&1 &)
    for _ in $(seq 1 15); do curl -sf http://127.0.0.1:11434/api/version >/dev/null && break; sleep 1; done
  fi
  if ! ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$LOCAL_MODEL"; then
    echo "AI local: chưa có model $LOCAL_MODEL — tải bằng: ollama pull $LOCAL_MODEL"
  fi
else
  echo "AI local: chưa cài Ollama (brew install --cask ollama-app) — sàng lọc sẽ dùng Claude"
fi

# LibreOffice: không bắt buộc — thiếu thì chỉ không xem trước được Word / PowerPoint / .xls / .ods trong app.
# Dò cùng thứ tự với backend/app/kb/preview.py (soffice_bin): SOFFICE_BIN, soffice / libreoffice trong PATH, bản cài macOS.
if [[ -n "$SOFFICE_BIN" ]]; then
  [[ -f "$SOFFICE_BIN" ]] || echo "Xem trước file: SOFFICE_BIN=$SOFFICE_BIN không tồn tại — chưa xem được Word / PowerPoint / .xls trong app"
elif ! command -v soffice >/dev/null 2>&1 && ! command -v libreoffice >/dev/null 2>&1 \
  && [[ ! -f /Applications/LibreOffice.app/Contents/MacOS/soffice ]]; then
  echo "Xem trước file: chưa cài LibreOffice (brew install --cask libreoffice) — chưa xem được Word / PowerPoint / .xls trong app"
fi

if [[ ! -d frontend/node_modules ]]; then
  (cd frontend && npm install)
fi

UVICORN_ARGS=()
if [[ "$1" == "--dev" || "$1" == "--reload" ]]; then
  # Chỉ theo dõi mã nguồn app/ — tránh reload vì file dữ liệu/log ghi ra ở chỗ khác
  UVICORN_ARGS=(--reload --reload-dir app)
fi

if [[ "$1" == "--dev" ]]; then
  (cd frontend && npx vite --port 5173) &
  trap 'kill %1 2>/dev/null' EXIT
  echo "FE: http://localhost:5173  (BE tự reload khi sửa backend/app)"
else
  (cd frontend && npm run build >/dev/null)
  echo "Mở: http://localhost:$PORT"
fi

if [[ "$1" == "--dev" || "$1" == "--reload" || "$1" == "--no-auto" ]]; then
  cd backend && ../.venv/bin/uvicorn app.main:app --port $PORT --timeout-graceful-shutdown 10 "${UVICORN_ARGS[@]}"
  exit $?
fi

# ---- Tự nạp code mới theo commit ----
set +e
BRANCH=$(git symbolic-ref --short -q HEAD)
REV=$(git rev-parse HEAD)
BE_PID=

log() { echo "[tự nạp $(date +%H:%M:%S)] $*"; }

start_be() {
  (cd backend && exec ../.venv/bin/uvicorn app.main:app --port $PORT --timeout-graceful-shutdown 10) &
  BE_PID=$!
}

stop_be() {
  [[ -z "$BE_PID" ]] && return
  kill -TERM "$BE_PID" 2>/dev/null
  for _ in $(seq 1 30); do kill -0 "$BE_PID" 2>/dev/null || break; sleep 1; done
  kill -0 "$BE_PID" 2>/dev/null && { log "BE chưa tắt sau 30 giây — kill -9"; kill -9 "$BE_PID"; }
  wait "$BE_PID" 2>/dev/null
  BE_PID=
  # chờ nhả cổng
  for _ in $(seq 1 10); do lsof -tiTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 1; done
}

git_busy() {
  local g; g=$(git rev-parse --git-dir)
  [[ -e "$g/MERGE_HEAD" || -d "$g/rebase-merge" || -d "$g/rebase-apply" || -e "$g/index.lock" ]]
}

trap 'stop_be; exit 0' INT TERM

start_be
log "đang theo nhánh ${BRANCH:-(không nhánh)} @ ${REV:0:7}"

while true; do
  sleep 10 & wait $!
  if ! kill -0 "$BE_PID" 2>/dev/null; then
    wait "$BE_PID"; code=$?
    log "BE đã dừng (mã $code) — thoát"
    exit $code
  fi
  [[ -z "$BRANCH" || "$(git symbolic-ref --short -q HEAD)" != "$BRANCH" ]] && continue
  git_busy && continue
  NEW=$(git rev-parse HEAD)
  [[ "$NEW" == "$REV" ]] && continue
  sleep 5   # để lệnh merge / commit ghi xong
  git_busy && continue
  [[ "$(git rev-parse HEAD)" != "$NEW" ]] && continue

  CHANGED=$(git diff --name-only "$REV" "$NEW")
  log "commit mới ${NEW:0:7}: $(git log -1 --format=%s "$NEW" | cut -c1-80)"

  if grep -q '^frontend/' <<<"$CHANGED"; then
    log "build lại FE..."
    if ! (cd frontend && { ! grep -q '^frontend/package' <<<"$CHANGED" || npm install >/dev/null; } && npm run build >/dev/null); then
      log "build FE lỗi — giữ bản cũ, chờ commit sau"; REV=$NEW; continue
    fi
  fi
  if grep -q 'requirements.txt$' <<<"$CHANGED"; then
    log "cài lại thư viện Python..."
    .venv/bin/pip install -q -r backend/requirements.txt || log "cài thư viện lỗi — vẫn thử nạp"
  fi
  if grep -q '^backend/' <<<"$CHANGED"; then
    if ! err=$(cd backend && ../.venv/bin/python -c "import app.main" 2>&1); then
      log "code mới import lỗi — giữ máy chủ cũ:"; echo "$err" | tail -5
      REV=$NEW; continue
    fi
    log "khởi động lại BE..."
    stop_be
    start_be
  fi
  REV=$NEW
  log "đã nạp ${NEW:0:7}"
done
