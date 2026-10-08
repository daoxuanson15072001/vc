#!/usr/bin/env bash
# Nạp bó dữ liệu do export_du_lieu.sh tạo vào máy chủ đích (DESIGN Phần I mục 12.6, OPS-01, BA SYS-42). Chạy từ thư mục gốc repo
# hoặc bất kỳ đâu; bó dữ liệu = thư mục chứa file script này (hoặc --bo DIR).
#   bash import_du_lieu.sh --kiem-tra            chỉ kiểm checksum + báo sẽ nạp gì, không ghi
#   bash import_du_lieu.sh                       nạp Mongo + Qdrant + file; DB đích phải trống
#   bash import_du_lieu.sh --drop                DB đích đã có dữ liệu: xoá từng collection trước khi nạp
# Tuỳ chọn: --mongo-db TEN (đổi tên DB đích khi bó chỉ có một DB) --khong-file --khong-qdrant --bo DIR
# Biến môi trường như backend/app/config.py: MONGO_URI, RAW_DIR, MEDIA_DIR, TTS_DIR, QDRANT_URL.
# Kết thúc in bảng so số bản ghi / số điểm giữa bó dữ liệu và máy đích.
set -euo pipefail
BO="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(pwd)"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017}"
RAW_DIR="${RAW_DIR:-$ROOT/data/raw}"
MEDIA_DIR="${MEDIA_DIR:-$ROOT/output/media}"
TTS_DIR="${TTS_DIR:-$ROOT/data/tts}"
QDRANT_URL="${QDRANT_URL:-http://127.0.0.1:6333}"; QDRANT_URL="${QDRANT_URL%/}"
PREVIEW_DIR="${PREVIEW_DIR:-$(dirname "$RAW_DIR")/preview}"

KIEM_TRA=0; DROP=0; CO_FILE=1; CO_QDRANT=1; DB_DICH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --kiem-tra) KIEM_TRA=1 ;;
    --drop) DROP=1 ;;
    --khong-file) CO_FILE=0 ;;
    --khong-qdrant) CO_QDRANT=0 ;;
    --mongo-db) DB_DICH="$2"; shift ;;
    --bo) BO="$(cd "$2" && pwd)"; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Tuỳ chọn lạ: $1 (xem --help)"; exit 2 ;;
  esac
  shift
done
for t in mongorestore mongosh curl tar python3; do
  command -v "$t" >/dev/null || { echo "Thiếu lệnh $t"; exit 1; }
done
if command -v sha256sum >/dev/null; then SHA="sha256sum"; else SHA="shasum -a 256"; fi
LOI=0

echo "== Bó dữ liệu: $BO"; [[ -f "$BO/MANIFEST.txt" ]] && head -5 "$BO/MANIFEST.txt" | sed 's/^/   /'
echo "== Kiểm checksum ..."
( cd "$BO" && $SHA -c SHA256SUMS --quiet ) && echo "   checksum khớp" || { echo "   CHECKSUM SAI — dừng"; exit 1; }

# ---------- 1. MongoDB ----------
ARCHS=("$BO"/mongo/*.archive.gz)
if [[ -n "$DB_DICH" && ${#ARCHS[@]} -ne 1 ]]; then echo "--mongo-db chỉ dùng khi bó có đúng một database (bó có ${#ARCHS[@]})"; exit 2; fi
mongosh --quiet "$MONGO_URI" --eval 'db.runCommand({ping:1}).ok' >/dev/null || { echo "MongoDB không trả lời tại $MONGO_URI"; exit 1; }
for a in "${ARCHS[@]}"; do
  [[ -f "$a" ]] || continue
  SRC="$(basename "$a" .archive.gz)"; DST="${DB_DICH:-$SRC}"
  CO_SAN=$(mongosh --quiet "$MONGO_URI/$DST" --eval 'print(db.getCollectionNames().length)')
  echo "== Mongo: $SRC -> $DST (đích hiện có $CO_SAN collection)"
  if [[ "$CO_SAN" != "0" && $DROP == 0 ]]; then
    echo "   DB đích đã có dữ liệu. Thêm --drop để thay, hoặc --mongo-db <tên khác>. Dừng."; exit 1
  fi
  if [[ $KIEM_TRA == 1 ]]; then echo "   (kiểm tra) sẽ mongorestore $(du -h "$a" | cut -f1)"; continue; fi
  OPT=(); [[ $DROP == 1 ]] && OPT+=(--drop)
  mongorestore --uri="$MONGO_URI" --gzip --archive="$a" --nsFrom="$SRC.*" --nsTo="$DST.*" "${OPT[@]}" --quiet
  echo "   so số bản ghi (bó / đích):"
  while IFS=$'\t' read -r c n; do
    m=$(mongosh --quiet "$MONGO_URI/$DST" --eval "print(db.getCollection('$c').countDocuments())")
    if [[ "$n" == "$m" ]]; then printf '   ✓ %-28s %8s\n' "$c" "$n"; else printf '   ✗ %-28s %8s / %-8s\n' "$c" "$n" "$m"; LOI=1; fi
  done < "$BO/mongo/$SRC.counts.txt"
done

# ---------- 2. Qdrant ----------
if [[ $CO_QDRANT == 1 ]] && ls "$BO"/qdrant/*.snapshot >/dev/null 2>&1; then
  if ! curl -sf "$QDRANT_URL/readyz" >/dev/null; then
    echo "== Qdrant không chạy tại $QDRANT_URL — bỏ qua (bật Qdrant rồi chạy lại với --khong-file, hoặc nạp lại bằng index_raw_vectors.py)"; LOI=1
  else
    for s in "$BO"/qdrant/*.snapshot; do
      c="$(basename "$s" .snapshot)"
      N_BO=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["points_count"])' "$BO/qdrant/$c.info.json")
      echo "== Qdrant: $c ($N_BO điểm, $(du -h "$s" | cut -f1))"
      if [[ $KIEM_TRA == 1 ]]; then echo "   (kiểm tra) sẽ upload snapshot, thay collection $c nếu đã có"; continue; fi
      curl -sf -X POST "$QDRANT_URL/collections/$c/snapshots/upload?priority=snapshot&wait=true" \
           -H 'Content-Type: multipart/form-data' -F "snapshot=@$s" >/dev/null || { echo "   upload lỗi"; LOI=1; continue; }
      N_DICH=$(curl -sf "$QDRANT_URL/collections/$c" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["points_count"])')
      if [[ "$N_BO" == "$N_DICH" ]]; then echo "   ✓ $N_DICH điểm"; else echo "   ✗ bó $N_BO / đích $N_DICH điểm"; LOI=1; fi
    done
  fi
fi

# ---------- 3. File ----------
untar_to() {  # untar_to <file tar> <thư mục đích>
  local f="$1" d="$2"
  [[ -f "$f" ]] || return 0
  local n; n=$(tar -tf "$f" | grep -vc '/$' || true)
  echo "== File: $(basename "$f") ($n file) -> $d"
  if [[ $KIEM_TRA == 1 ]]; then echo "   (kiểm tra) hiện có $(find "$d" -type f 2>/dev/null | wc -l | tr -d ' ') file"; return 0; fi
  mkdir -p "$d"; tar -xf "$f" -C "$d"
  echo "   đích có $(find "$d" -type f | wc -l | tr -d ' ') file"
}
if [[ $CO_FILE == 1 ]]; then
  untar_to "$BO/files/raw.tar.gz" "$RAW_DIR"
  untar_to "$BO/files/media.tar" "$MEDIA_DIR"
  untar_to "$BO/files/preview.tar.gz" "$PREVIEW_DIR"
  untar_to "$BO/files/tts.tar.gz" "$TTS_DIR"
fi

echo
if [[ $KIEM_TRA == 1 ]]; then echo "Kiểm tra xong, chưa ghi gì. Bỏ --kiem-tra để nạp thật."
elif [[ $LOI == 0 ]]; then echo "Nạp xong, số liệu khớp. Chạy start_web.sh và đăng nhập bằng tài khoản cũ để xác nhận."
else echo "Nạp xong nhưng có mục lệch (dòng ✗ ở trên) — xem lại trước khi dùng."; exit 1; fi
