#!/bin/sh
# Điểm vào của ảnh công cụ (provisioner/Dockerfile):
#   vc realm-apply --file /app/keycloak/realm/vc.yaml [--dry-run]
#   vc provisioner sync|loop|report|disable|enable …
set -eu
cmd=${1:-}
[ $# -gt 0 ] && shift
case "$cmd" in
  realm-apply) cd /app/keycloak/apply && exec node_modules/.bin/tsx src/cli.ts "$@" ;;
  provisioner) cd /app/provisioner && exec node_modules/.bin/tsx src/cli.ts "$@" ;;
  *) echo "Lệnh: vc realm-apply … | vc provisioner …" >&2; exit 2 ;;
esac
