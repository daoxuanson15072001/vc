#!/bin/sh
# Khôi phục một bản sao lưu.
#   restore.sh <tệp.dump>                  khôi phục thử vào database keycloak_khoi_phuc rồi đếm realm, user (mỗi tháng một lần)
#   restore.sh <tệp.dump> --ghi-de         ghi đè database keycloak thật; PHẢI dừng Keycloak trước:
#                                          docker compose stop keycloak && docker compose run --rm backup restore.sh … --ghi-de
set -eu
file=${1:?Cách dùng: restore.sh <tệp.dump> [--ghi-de]}
mode=${2:-thu}
[ -f "$file" ] || { echo "Không có tệp $file" >&2; exit 1; }
pg_restore --list "$file" >/dev/null

if [ "$mode" = "--ghi-de" ]; then
  target=${PGDATABASE:-keycloak}
  if [ "$(psql -d postgres -tAc "select count(*) from pg_stat_activity where datname = '$target' and pid <> pg_backend_pid()")" != "0" ]; then
    echo "Database $target đang có kết nối: dừng Keycloak trước (docker compose stop keycloak)." >&2
    exit 1
  fi
  dropdb --if-exists "$target"
  createdb "$target"
else
  target=keycloak_khoi_phuc
  dropdb --if-exists "$target"
  createdb "$target"
fi

pg_restore --no-owner --no-privileges --exit-on-error --dbname="$target" "$file"
realms=$(psql -d "$target" -tAc "select string_agg(name, ', ' order by name) from realm")
users=$(psql -d "$target" -tAc "select count(*) from user_entity")
echo "vc-backup: đã khôi phục $(basename "$file") vào $target: realm [$realms], $users user."
if [ "$mode" != "--ghi-de" ]; then
  dropdb "$target"
  echo "vc-backup: khôi phục thử đạt, đã xoá $target."
fi
