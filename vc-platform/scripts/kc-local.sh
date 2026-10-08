#!/usr/bin/env bash
# Chạy Keycloak trên máy dev KHÔNG cần Docker (dùng khi máy không có Docker; có Docker thì dùng compose.dev.yml).
# Lần đầu tải bản ghim từ Maven Central và kiểm SHA-1; theme "vc" được gắn bằng liên kết mềm để sửa là thấy ngay.
set -euo pipefail
KC_VERSION=26.7.5
KC_SHA1=b68fda2bccc3db641008cfefeeab5fdbe78221a0
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.kc-local"
KC_HOME="$DIR/keycloak-$KC_VERSION"
MIRRORS="https://maven-central.storage-download.googleapis.com/maven2 https://repo1.maven.org/maven2"

if [ ! -x "$KC_HOME/bin/kc.sh" ]; then
  mkdir -p "$DIR"
  for m in $MIRRORS; do
    curl -fsSL -o "$DIR/kc.tar.gz" "$m/org/keycloak/keycloak-quarkus-dist/$KC_VERSION/keycloak-quarkus-dist-$KC_VERSION.tar.gz" || continue
    [ "$(sha1sum "$DIR/kc.tar.gz" | cut -d' ' -f1)" = "$KC_SHA1" ] && break
    echo "Sai SHA-1 khi tải từ $m, thử nguồn khác" >&2; rm -f "$DIR/kc.tar.gz"
  done
  [ -f "$DIR/kc.tar.gz" ] || { echo "Không tải được Keycloak $KC_VERSION" >&2; exit 1; }
  tar xzf "$DIR/kc.tar.gz" -C "$DIR" && rm "$DIR/kc.tar.gz"
fi
ln -sfn "$ROOT/keycloak/themes/vc" "$KC_HOME/themes/vc"

export KC_BOOTSTRAP_ADMIN_USERNAME="${KC_ADMIN_USER:-admin}"
export KC_BOOTSTRAP_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin-dev-only}"
exec "$KC_HOME/bin/kc.sh" start-dev --http-port="${KC_PORT:-8180}" --http-management-port="${KC_MGMT_PORT:-9100}" --health-enabled=true
