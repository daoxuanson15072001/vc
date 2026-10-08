#!/bin/sh
# Chạy backup.sh mỗi ngày lúc BACKUP_HOUR giờ (giờ Việt Nam, mặc định 2 giờ sáng). Lỗi thì ghi log và gửi cảnh báo
# (ALERT_WEBHOOK_URL), lần sau vẫn chạy.
set -u
hour=${BACKUP_HOUR:-2}
echo "vc-backup: sao lưu hằng ngày lúc ${hour}:00, giữ ${BACKUP_KEEP_DAILY:-14} bản ngày, ${BACKUP_KEEP_MONTHLY:-6} bản tháng"
while true; do
  h=$(date +%H); m=$(date +%M); s=$(date +%S)
  now=$(( ${h#0} * 3600 + ${m#0} * 60 + ${s#0} ))
  wait=$(( (hour * 3600 - now + 86400) % 86400 ))
  [ "$wait" -eq 0 ] && wait=86400
  sleep "$wait"
  if ! backup.sh; then
    echo "vc-backup: LỖI sao lưu lúc $(date '+%H:%M %d/%m/%Y')" >&2
    if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
      wget -qO- --header 'content-type: application/json' --post-data '{"text":"VC ID: sao lưu đêm nay lỗi, xem log container backup."}' "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
  fi
done
