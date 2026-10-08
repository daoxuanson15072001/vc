#!/bin/sh
# Một lần sao lưu database keycloak. Biến: PGHOST, PGUSER, PGPASSWORD, PGDATABASE (chuẩn của PostgreSQL),
# BACKUP_DIR, BACKUP_KEEP_DAILY (14), BACKUP_KEEP_MONTHLY (6), BACKUP_RCLONE_REMOTE (vd "s3:vc-backup/vc-id").
set -eu
dir=${BACKUP_DIR:-/backups}
keep_daily=${BACKUP_KEEP_DAILY:-14}
keep_monthly=${BACKUP_KEEP_MONTHLY:-6}
mkdir -p "$dir/ngay" "$dir/thang"

file="$dir/ngay/${PGDATABASE:-keycloak}-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges --file="$file.tmp"
# Tệp đọc lại được mới tính là bản sao lưu.
pg_restore --list "$file.tmp" >/dev/null
mv "$file.tmp" "$file"

# Bản đầu tiên của mỗi tháng giữ thêm ở thư mục tháng.
month=$(date +%Y%m)
if ! ls "$dir/thang/" 2>/dev/null | grep -q -- "-$month"; then
  cp "$file" "$dir/thang/"
fi

prune() { ls -1t "$1"/*.dump 2>/dev/null | tail -n +"$(( $2 + 1 ))" | xargs -r rm -f; }
prune "$dir/ngay" "$keep_daily"
prune "$dir/thang" "$keep_monthly"

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  rclone copy --no-traverse "$file" "$BACKUP_RCLONE_REMOTE/ngay/"
  rclone copy --no-traverse "$dir/thang" "$BACKUP_RCLONE_REMOTE/thang/"
fi

# Giám sát đọc mốc này: không có bản mới trong 26 giờ thì cảnh báo (thiết kế SSO mục 11).
date -u +%Y-%m-%dT%H:%M:%SZ > "$dir/lan-cuoi-thanh-cong"
echo "vc-backup: $(basename "$file") $(du -h "$file" | cut -f1)"
