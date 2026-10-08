#!/usr/bin/env bash
# Start the local dashboard and reuse an API when one is already running.
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

for tool in node pnpm curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Thiếu $tool. VClinks cần Node.js 20+, pnpm 9 và curl." >&2
    exit 1
  fi
done
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo "VClinks cần Node.js 20 trở lên." >&2
  exit 1
fi

if [[ ! -x apps/web/node_modules/.bin/vite || ! -x packages/shared/node_modules/.bin/tsup || ! -x apps/api/node_modules/.bin/tsc ]]; then
  echo "Đang cài thư viện của VClinks..."
  pnpm install --frozen-lockfile --store-dir "$REPO_DIR/node_modules/.pnpm-store"
fi
pnpm --filter @vclinks/shared build

export VCLINKS_API="${VCLINKS_API:-http://localhost:3000}"
VCLINKS_API="${VCLINKS_API%/}"
API_PID=""
WEB_PID=""

cleanup() {
  # Only stop processes started by this invocation, never an existing API.
  if [[ -n "$WEB_PID" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
  fi
  if [[ -n "$API_PID" ]]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

api_ready() {
  curl --fail --silent --max-time 2 "$VCLINKS_API/api/health" >/dev/null 2>&1
}

if api_ready; then
  echo "Dùng API đang chạy tại $VCLINKS_API."
else
  if [[ "$VCLINKS_API" != "http://localhost:3000" && "$VCLINKS_API" != "http://127.0.0.1:3000" ]]; then
    echo "Không kết nối được API đã cấu hình. Hãy khởi động API rồi chạy lại." >&2
    exit 1
  fi
  echo "Đang build và khởi động API; cần MongoDB đang chạy."
  pnpm --filter @vclinks/api build
  # The root .env targets Docker; native startup uses exported environment variables.
  MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/vclinks}" PORT=3000 \
    node apps/api/dist/main.js &
  API_PID=$!
  for ((attempt = 0; attempt < 40; attempt++)); do
    if ! kill -0 "$API_PID" 2>/dev/null; then
      echo "API không khởi động được. Xem lỗi phía trên và kiểm tra MongoDB/cổng 3000." >&2
      exit 1
    fi
    if api_ready; then
      break
    fi
    sleep 1
  done
  if ! api_ready; then
    echo "API chưa sẵn sàng. Kiểm tra MongoDB và biến MONGO_URI rồi chạy lại." >&2
    exit 1
  fi
fi

# VCLINKS_WEB_HOST=0.0.0.0 exposes the dashboard to the LAN; default stays local-only.
WEB_HOST="${VCLINKS_WEB_HOST:-localhost}"
echo "Mở địa chỉ Local hiển thị bên dưới (mặc định http://localhost:5173). Nhấn Ctrl+C để dừng."
if [[ "$WEB_HOST" != "localhost" && "$WEB_HOST" != "127.0.0.1" ]]; then
  echo "Máy khác cùng mạng LAN/wifi mở địa chỉ Network hiển thị bên dưới."
fi
# Run Vite directly so cleanup owns its PID; Vite picks the next port if occupied.
node apps/web/node_modules/vite/bin/vite.js apps/web --host "$WEB_HOST" --port 5173 &
WEB_PID=$!
wait "$WEB_PID"
