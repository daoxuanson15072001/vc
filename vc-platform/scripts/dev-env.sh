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
# vc-provisioner ở dev: Directory giả từ tệp, nhóm app mặc định gồm cả app mẫu
export DIRECTORY_MODE=file
export DIRECTORY_FILE=${DIRECTORY_FILE:-fixtures/directory.dev.json}
export EXCLUSIONS_FILE=${EXCLUSIONS_FILE:-fixtures/loai-tru.dev.yaml}
export DEFAULT_APP_GROUPS=app-vclinks,app-vcwiki,app-app-mau
export PROVISIONER_STATE_FILE=${PROVISIONER_STATE_FILE:-/tmp/vc-provisioner-state.dev.json}
# VC Home ở dev: thêm ô App mẫu vào catalog.json
export CATALOG_EXTRA_FILES=${CATALOG_EXTRA_FILES:-apps.dev.yaml}
