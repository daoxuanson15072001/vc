#!/usr/bin/env bash
# Biến môi trường cho máy dev và CI (giá trị giả, không phải bí mật thật). Dùng: source scripts/dev-env.sh
export KC_URL=${KC_URL:-http://localhost:8180}
export KC_ADMIN_USER=${KC_ADMIN_USER:-admin}
export KC_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD:-admin-dev-only}
export KC_SSL_REQUIRED=none
export VCHOME_URL=${VCHOME_URL:-http://localhost:5173}
export VCLINKS_URL=${VCLINKS_URL:-http://localhost:3000}
export VCWIKI_URL=${VCWIKI_URL:-http://localhost:8000}
export VCLINKS_CLIENT_SECRET=dev-vclinks-secret
export VCWIKI_CLIENT_SECRET=dev-vcwiki-secret
export PROVISIONER_CLIENT_SECRET=dev-provisioner-secret
export APP_MAU_CLIENT_SECRET=dev-app-mau-secret
export GIA_GOOGLE_SECRET=dev-gia-google-secret
# Google thật chưa dùng ở dev (Google giả thay thế), nhưng vc.yaml đòi biến này
export GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-chua-dung-o-dev}
export GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-chua-dung-o-dev}
