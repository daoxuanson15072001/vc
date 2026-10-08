#!/bin/sh
# Ghi /config.json từ biến môi trường: một ảnh dùng cho staging và production.
set -eu
domains=$(printf '%s' "${COMPANY_DOMAINS:-vcprosperous.com,vcpart.vn}" | sed -E 's/[^,]+/"&"/g')
cat > /usr/share/nginx/html/config.json <<JSON
{
  "authority": "${VC_ID_ISSUER}",
  "clientId": "${VCHOME_CLIENT_ID:-vchome}",
  "supportEmail": "${VCHOME_SUPPORT_EMAIL:-it@vcprosperous.com}",
  "companyDomains": [${domains}],
  "sessionCheckSeconds": ${VCHOME_SESSION_CHECK_SECONDS:-60}
}
JSON
echo "vc-home: config.json cho ${VC_ID_ISSUER}"
