#!/usr/bin/env bash
# Chạy bản build VC Home bằng nginx với đúng cấu hình của container (header bảo mật, CSP), không cần Docker.
# Dùng để chạy e2e như production: scripts/nginx-local.sh [cổng, mặc định 5173]. Dừng: scripts/nginx-local.sh stop
set -euo pipefail
cd "$(dirname "$0")/.."
RUN=.nginx-local
PORT=${1:-5173}
if [[ "${1:-}" == stop ]]; then
  [[ -f $RUN/nginx.pid ]] && kill "$(cat $RUN/nginx.pid)" && echo "Đã dừng nginx"
  exit 0
fi
[[ -d dist ]] || { echo "Chưa có dist/: chạy pnpm build trước"; exit 1; }
mkdir -p "$RUN/conf.d" "$RUN/tmp"
export VC_ID_ISSUER=${VC_ID_ISSUER:-${KC_URL:-http://localhost:8180}/realms/vc}
# Giống 15-vc-env.envsh và 40-vc-config.sh trong ảnh
export VC_ID_ORIGIN=$(printf '%s' "$VC_ID_ISSUER" | sed -E 's#^(https?://[^/]+).*#\1#')
html=$(pwd)/dist
sed "s#/usr/share/nginx/html#$html#g" nginx/40-vc-config.sh | VCHOME_SESSION_CHECK_SECONDS=${VCHOME_SESSION_CHECK_SECONDS:-60} sh >/dev/null
for t in nginx/templates/*.template; do
  sed -e "s#\${VC_ID_ORIGIN}#$VC_ID_ORIGIN#g" -e "s#/usr/share/nginx/html#$html#g" -e "s#/etc/nginx/conf.d/#$(pwd)/$RUN/conf.d/#g" \
    -e "s#listen 8080#listen $PORT#" "$t" > "$RUN/conf.d/$(basename "${t%.template}")"
done
cat > "$RUN/nginx.conf" <<CONF
worker_processes 1;
pid $(pwd)/$RUN/nginx.pid;
error_log $(pwd)/$RUN/error.log warn;
events { worker_connections 256; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log $(pwd)/$RUN/access.log;
  client_body_temp_path $(pwd)/$RUN/tmp; proxy_temp_path $(pwd)/$RUN/tmp; fastcgi_temp_path $(pwd)/$RUN/tmp;
  uwsgi_temp_path $(pwd)/$RUN/tmp; scgi_temp_path $(pwd)/$RUN/tmp;
  include $(pwd)/$RUN/conf.d/default.conf;
}
CONF
nginx -t -c "$(pwd)/$RUN/nginx.conf" -p "$(pwd)/$RUN" 2>&1 | grep -v "^$" | tail -1
nginx -c "$(pwd)/$RUN/nginx.conf" -p "$(pwd)/$RUN"
echo "VC Home (nginx) ở http://localhost:$PORT, VC ID $VC_ID_ISSUER"
