#!/usr/bin/env bash
# Môi trường kiểm thử tay (UAT) cho Claude in Chrome — docs/test-claude-extension/00-HUONG-DAN.md
#   bash start_uat.sh           -> BE :8400 + FE http://127.0.0.1:5400, DB tiktok_to_text_uat, KHÔNG có AI
#   bash start_uat.sh --ai      -> như trên nhưng bật AI (Claude theo .env / khoá máy, AI local Ollama)
#   bash start_uat.sh --reset   -> dựng lại dữ liệu mẫu từ đầu (xoá DB UAT) rồi chạy
#   bash start_uat.sh --seed-only -> chỉ dựng lại dữ liệu mẫu rồi thoát (chạy được khi server UAT đang bật;
#                                    mọi người phải đăng nhập lại)
# Không đụng DB thật `tiktok_to_text`, không build lại frontend/dist của bản thật (:8000).
# Mở bằng 127.0.0.1 (không phải localhost) để cookie đăng nhập không đè phiên của bản thật ở localhost:8000.
set -e
cd "$(dirname "$0")"

export MONGO_DB=tiktok_to_text_uat
export RAW_DIR="$PWD/output/uat/raw" MEDIA_DIR="$PWD/output/uat/media" TTS_DIR="$PWD/output/uat/tts"
AI=0
for a in "$@"; do
  case "$a" in
    --ai) AI=1 ;;
    --reset) RESET=1 ;;
    --seed-only) SEED_ONLY=1 ;;
  esac
done
if [[ -n "$SEED_ONLY" ]]; then
  cd backend && exec ../.venv/bin/python scripts/seed_uat.py --reset
fi
if [[ $AI == 0 ]]; then
  export ANTHROPIC_API_KEY= ANTHROPIC_AUTH_TOKEN= LOCAL_LLM_URL=http://127.0.0.1:1
fi

for port in 8400 5400; do
  if pid=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null) && [[ -n "$pid" ]]; then
    echo "Cổng $port đang được tiến trình $pid dùng — tắt nó trước: kill $pid"
    exit 1
  fi
done

# Tự dò mongod.conf (MONGOD_CONF → /usr/local → /opt/homebrew; lý do thứ tự ở lib_mongo.sh)
source ./lib_mongo.sh
ensure_mongo

if [[ -n "$RESET" ]] || ! mongosh --quiet "mongodb://127.0.0.1:27017/$MONGO_DB" --eval 'quit(db.users.countDocuments() ? 0 : 1)' >/dev/null 2>&1; then
  (cd backend && ../.venv/bin/python scripts/seed_uat.py --reset)
fi

[[ -d frontend/node_modules ]] || (cd frontend && npm install)
(cd frontend && API_TARGET=http://127.0.0.1:8400 npx vite --host 127.0.0.1 --port 5400 --strictPort) &
trap 'kill %1 2>/dev/null' EXIT
echo "UAT: http://127.0.0.1:5400   (AI: $([[ $AI == 1 ]] && echo bật || echo tắt) · mật khẩu mọi tài khoản: Test@12345)"
cd backend && ../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8400 --timeout-graceful-shutdown 5
