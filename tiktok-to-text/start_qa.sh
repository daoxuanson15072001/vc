#!/usr/bin/env bash
# Bản QA (kiểm thử trên dữ liệu riêng, không đụng bản thật :8000) — DESIGN Phần I mục 10
#   bash start_qa.sh            -> BE http://127.0.0.1:8300 (phục vụ frontend/dist của cây đang đứng), DB tiktok_to_text_qa, AI tắt
#   bash start_qa.sh --ai       -> như trên nhưng bật AI (Claude theo biến môi trường / CLI, AI local Ollama)
#   bash start_qa.sh --vite     -> thêm FE Vite http://127.0.0.1:5300 (proxy → 8300), không cần / không build frontend/dist
#   bash start_qa.sh --reload   -> BE tự nạp lại khi sửa backend/app
#   MONGO_DB=tiktok_to_text_qa_2 bash start_qa.sh   -> DB QA khác (tên phải có "_qa")
# Từ chối chạy nếu MONGO_DB trỏ DB thật `tiktok_to_text` (hoặc tên không có "_qa"). Không tự nạp code mới theo commit
# (khác start_web.sh): muốn chạy bản mới thì tắt rồi chạy lại. Không build frontend/dist (tránh đè bản build của :8000
# khi chạy ở cây chính) — thiếu dist thì dùng --vite hoặc tự `cd frontend && npm run build` trong worktree.
# Mở bằng 127.0.0.1 (không phải localhost) để cookie đăng nhập không đè phiên của bản thật ở localhost:8000.
set -e
cd "$(dirname "$0")"

PORT=8300
FE_PORT=5300
export MONGO_DB="${MONGO_DB:-tiktok_to_text_qa}"
if [[ "$MONGO_DB" == "tiktok_to_text" || "$MONGO_DB" != *_qa* ]]; then
  echo "TỪ CHỐI: MONGO_DB=$MONGO_DB không phải DB QA (tên phải có \"_qa\", không được là DB thật tiktok_to_text)."
  echo "Bỏ biến MONGO_DB để dùng mặc định tiktok_to_text_qa."
  exit 1
fi
export RAW_DIR="${RAW_DIR:-$PWD/output/qa_raw}" MEDIA_DIR="${MEDIA_DIR:-$PWD/output/qa_media}" TTS_DIR="${TTS_DIR:-$PWD/output/qa_tts}"

AI=0; VITE=0; RELOAD=()
for a in "$@"; do
  case "$a" in
    --ai) AI=1 ;;
    --vite) VITE=1 ;;
    --reload) RELOAD=(--reload --reload-dir app) ;;
    *) echo "Tham số lạ: $a (dùng --ai / --vite / --reload)"; exit 1 ;;
  esac
done
if [[ $AI == 0 ]]; then
  export ANTHROPIC_API_KEY= ANTHROPIC_AUTH_TOKEN= LOCAL_LLM_URL=http://127.0.0.1:1 CLAUDE_CLI_FALLBACK=off
fi

ports=($PORT); [[ $VITE == 1 ]] && ports+=($FE_PORT)
for port in "${ports[@]}"; do
  if pid=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null) && [[ -n "$pid" ]]; then
    echo "Cổng $port đang được tiến trình $pid dùng — tắt nó trước: kill $pid"
    exit 1
  fi
done

# Tự dò mongod.conf (MONGOD_CONF → /usr/local → /opt/homebrew; lý do thứ tự ở lib_mongo.sh)
source ./lib_mongo.sh
ensure_mongo

echo "================ BẢN QA ================"
echo "  Database : $MONGO_DB   (bản thật tiktok_to_text KHÔNG bị đụng)"
echo "  Dữ liệu  : RAW_DIR=$RAW_DIR"
echo "             MEDIA_DIR=$MEDIA_DIR  TTS_DIR=$TTS_DIR"
echo "  AI       : $([[ $AI == 1 ]] && echo bật || echo 'tắt (--ai để bật)')"
echo "  Code     : $(git symbolic-ref --short -q HEAD || echo '(không nhánh)') @ $(git rev-parse --short HEAD) — không tự nạp commit mới"
if [[ $VITE == 1 ]]; then
  [[ -d frontend/node_modules ]] || (cd frontend && npm install)
  (cd frontend && API_TARGET=http://127.0.0.1:$PORT npx vite --host 127.0.0.1 --port $FE_PORT --strictPort) &
  trap 'kill %1 2>/dev/null' EXIT
  echo "  Mở       : http://127.0.0.1:$FE_PORT  (Vite → BE :$PORT)"
elif [[ -f frontend/dist/index.html ]]; then
  echo "  Mở       : http://127.0.0.1:$PORT  (frontend/dist có sẵn — không build lại)"
else
  echo "  Mở       : http://127.0.0.1:$PORT  — CHƯA có frontend/dist: chỉ có API; dùng --vite để có giao diện"
fi
echo "========================================"

cd backend && ../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $PORT --timeout-graceful-shutdown 10 "${RELOAD[@]}"
