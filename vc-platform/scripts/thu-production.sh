#!/usr/bin/env bash
# Chạy thử compose.yml trên máy dev với giá trị giả (scripts/local-prod.env) và kiểm tiêu chí SSO-01:
# Keycloak + PostgreSQL chạy, áp realm hai lần không lỗi, edge chặn /admin ở tên miền công khai,
# VC Home nhận đúng cấu hình, sao lưu, khôi phục thử và khôi phục đè đều đạt.
#   scripts/thu-production.sh          dựng và kiểm (giữ cụm chạy để xem)
#   scripts/thu-production.sh down     dừng và xoá cụm thử (kể cả dữ liệu)
set -euo pipefail
cd "$(dirname "$0")/.."
dc() { docker compose --env-file scripts/local-prod.env -f compose.yml -f compose.local.yml "$@"; }
if [[ "${1:-}" == down ]]; then dc --profile tools down -v --remove-orphans; rm -rf .local-prod; exit 0; fi

ok() { printf '  \e[32mĐạt\e[0m  %s\n' "$1"; }
fail() { printf '  \e[31mLỖI\e[0m  %s\n' "$1"; exit 1; }
last() { grep -v '^[[:space:]]*$' | tail -1; }
code() { curl -s -o /dev/null -w '%{http_code}' -H "Host: $1" "http://127.0.0.1:8088$2" || true; }
wait_healthy() {
  for _ in $(seq 1 90); do
    [[ "$(docker inspect -f '{{.State.Health.Status}}' "$(dc ps -q "$1")" 2>/dev/null)" == healthy ]] && return 0
    sleep 2
  done
  dc logs --tail 40 "$1"; fail "$1 không lên sau 3 phút"
}

mkdir -p .local-prod/backups .local-prod/secrets
echo "Dựng cụm (lần đầu build ảnh mất vài phút)…"
dc up -d --build --scale cloudflared=0 --quiet-pull 2>&1 | grep -vE "^\s*$" | tail -3
wait_healthy keycloak && ok "Keycloak + PostgreSQL chạy, /health/ready xanh"

first=$(dc run --rm -T realm-apply 2>&1 | last)
[[ "$first" == "Realm vc: "* ]] && ok "Áp vc.yaml lần đầu: $first" || fail "Áp vc.yaml: $first"
again=$(dc run --rm -T realm-apply 2>&1 | last)
[[ "$again" == *"0 thay đổi"* ]] && ok "Áp vc.yaml lần hai: $again" || fail "Áp lại vẫn có thay đổi: $again"

PUB=id.vc.localhost ADM=id-admin.vc.localhost
iss=$(curl -s -H "Host: $PUB" http://127.0.0.1:8088/realms/vc/.well-known/openid-configuration | sed -E 's/.*"issuer":"([^"]+)".*/\1/')
[[ "$iss" == "http://id.vc.localhost:8088/realms/vc" ]] && ok "id.: discovery realm vc, issuer $iss" || fail "issuer sai: $iss"
[[ "$(code $PUB /admin/master/console/)" == 404 ]] && ok "id.: /admin bị chặn (404)" || fail "id.: /admin không bị chặn"
[[ "$(code $PUB /realms/master/.well-known/openid-configuration)" == 404 ]] && ok "id.: realm master bị chặn (404)" || fail "id.: realm master mở"
[[ "$(code $PUB /)" == 302 ]] && ok "id.: / chuyển về VC Home" || fail "id.: / không chuyển"
[[ "$(code $ADM /admin/master/console/)" == 200 ]] && ok "id-admin.: màn quản trị mở (sau Cloudflare Access)" || fail "id-admin.: không mở được màn quản trị"
curl -s -H "Host: $PUB" http://127.0.0.1:8088/realms/vc/protocol/openid-connect/logout | grep -q "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?" \
  && ok "Theme vc có trong ảnh: trang đăng xuất tiếng Việt" || fail "Trang đăng xuất không có câu tiếng Việt của theme vc"
curl -s -o /dev/null -H "Host: la.example" http://127.0.0.1:8088/ && fail "Tên miền lạ vẫn được trả lời" || ok "Tên miền lạ bị đóng kết nối"

tok=$(curl -s -H "Host: $PUB" -d grant_type=client_credentials -d client_id=vc-provisioner -d client_secret=local-provisioner-secret \
  http://127.0.0.1:8088/realms/vc/protocol/openid-connect/token | grep -c access_token || true)
[[ "$tok" == 1 ]] && ok "vc-provisioner lấy được token máy qua id." || fail "vc-provisioner không lấy được token"
# Chưa có khoá Google (I4): lệnh phải dừng với câu rõ ràng, mã thoát khác 0.
msg=$( (dc run --rm -T provisioner provisioner report 2>&1 || true) | last)
[[ "$msg" == *"I4"* ]] && ok "Ảnh công cụ chạy; provisioner chờ đầu vào I4: $msg" || fail "provisioner: $msg"

cfg=$(curl -s http://127.0.0.1:8089/config.json)
[[ "$cfg" == *'"authority": "http://id.vc.localhost:8088/realms/vc"'* ]] && ok "VC Home: config.json trỏ đúng VC ID" || fail "VC Home config.json: $cfg"
curl -sI http://127.0.0.1:8089/ | grep -qi "connect-src 'self' http://id.vc.localhost:8088" && ok "VC Home: CSP cho phép đúng VC ID" || fail "VC Home: CSP sai"

dc exec -T backup backup.sh | tail -1
latest=$(dc exec -T backup sh -c 'ls -1t /backups/ngay/*.dump | head -1')
out=$(dc exec -T backup restore.sh "$latest" | tail -2 | head -1)
[[ "$out" == *"realm [master, vc]"* ]] && ok "Sao lưu + khôi phục thử: $out" || fail "Khôi phục thử: $out"

dc stop keycloak >/dev/null 2>&1
out=$(dc exec -T backup restore.sh "$latest" --ghi-de | tail -1)
dc start keycloak >/dev/null 2>&1 && wait_healthy keycloak
[[ "$(code $PUB /realms/vc/.well-known/openid-configuration)" == 200 ]] && ok "Khôi phục đè database thật, Keycloak lên lại: $out" || fail "Sau khôi phục đè realm vc không còn"
echo "Xong. VC Home: http://127.0.0.1:8089 · VC ID: http://id.vc.localhost:8088/realms/vc (chưa có admin người; client tạm chỉ dành cho máy)"
echo "Dọn: scripts/thu-production.sh down"
