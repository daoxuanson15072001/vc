#!/usr/bin/env bash
# Xuất toàn bộ dữ liệu VC Content Engine để chuyển sang máy chủ khác (DESIGN Phần I mục 12.6, OPS-01, BA SYS-42).
#   bash export_du_lieu.sh                 -> output/migration/<YYYYMMDD-HHMM>/ gồm:
#       mongo/<db>.archive.gz + <db>.counts.txt   (mongodump --gzip, số bản ghi từng collection)
#       qdrant/<collection>.snapshot + .info.json  (snapshot Qdrant, số điểm)
#       files/raw.tar.gz  files/media.tar [files/tts.tar.gz]  (data/raw, output/media, data/tts)
#       MANIFEST.txt  SHA256SUMS  import_du_lieu.sh           (chạy import ở máy đích)
#   MONGO_DB=tiktok_to_text_qa bash export_du_lieu.sh      -> xuất DB khác (mặc định tiktok_to_text)
# Tuỳ chọn:
#   --mongo-tat-ca   dump MỌI database trên mongod này (trừ *_pytest_*, *_e2e*, *_test_*, admin/config/local)
#                    — dùng khi máy chủ còn chứa dự án khác (vclinks, VAPGroup…) cần đi cùng.
#   --khong-file     bỏ data/raw + output/media (chuyển riêng bằng rsync khi quá lớn)
#   --khong-qdrant   bỏ snapshot Qdrant (máy đích nạp lại bằng index_raw_vectors.py, mất nhiều đêm)
#   --tts            kèm data/tts (bộ đệm mp3, dựng lại được; mặc định bỏ)
#   --dich DIR       thư mục đích thay cho output/migration/<giờ>
# Biến môi trường dùng như backend/app/config.py: MONGO_URI, MONGO_DB, RAW_DIR, MEDIA_DIR, TTS_DIR, QDRANT_URL;
# thêm QDRANT_SNAPSHOTS_DIR (mặc định data/qdrant/snapshots — có thì copy thẳng, không thì tải qua HTTP).
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"

MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017}"
MONGO_DB="${MONGO_DB:-tiktok_to_text}"
RAW_DIR="${RAW_DIR:-$ROOT/data/raw}"
MEDIA_DIR="${MEDIA_DIR:-$ROOT/output/media}"
TTS_DIR="${TTS_DIR:-$ROOT/data/tts}"
QDRANT_URL="${QDRANT_URL:-http://127.0.0.1:6333}"; QDRANT_URL="${QDRANT_URL%/}"
QDRANT_SNAPSHOTS_DIR="${QDRANT_SNAPSHOTS_DIR:-$ROOT/data/qdrant/snapshots}"

MONGO_TAT_CA=0; CO_FILE=1; CO_QDRANT=1; CO_TTS=0; OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mongo-tat-ca) MONGO_TAT_CA=1 ;;
    --khong-file) CO_FILE=0 ;;
    --khong-qdrant) CO_QDRANT=0 ;;
    --tts) CO_TTS=1 ;;
    --dich) OUT="$2"; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Tuỳ chọn lạ: $1 (xem --help)"; exit 2 ;;
  esac
  shift
done
NHAN="$(date '+%Y%m%d-%H%M')"
OUT="${OUT:-$ROOT/output/migration/$NHAN}"

for t in mongodump mongosh curl tar python3; do
  command -v "$t" >/dev/null || { echo "Thiếu lệnh $t (mongodump/mongosh: brew install mongodb-database-tools mongosh)"; exit 1; }
done
if command -v sha256sum >/dev/null; then SHA="sha256sum"; else SHA="shasum -a 256"; fi

source ./lib_mongo.sh
ensure_mongo
mkdir -p "$OUT/mongo" "$OUT/qdrant" "$OUT/files"
LOG="$OUT/export.log"; exec > >(tee -a "$LOG") 2>&1
echo "===== $(date '+%d/%m/%Y %H:%M:%S') xuất dữ liệu -> $OUT ====="

# ---------- 1. MongoDB ----------
dump_db() {  # dump một database + đếm bản ghi từng collection
  local db="$1"
  echo "[mongo] dump $db ..."
  mongodump --uri="$MONGO_URI" --db="$db" --gzip --archive="$OUT/mongo/$db.archive.gz" --quiet
  mongosh --quiet "$MONGO_URI/$db" --eval '
    db.getCollectionNames().sort().forEach(c => print(c + "\t" + db.getCollection(c).countDocuments()))' \
    > "$OUT/mongo/$db.counts.txt"
  printf '[mongo] %s: %s collection, %s bản ghi, %s\n' "$db" "$(wc -l < "$OUT/mongo/$db.counts.txt" | tr -d ' ')" \
    "$(awk -F'\t' '{s+=$2} END{print s+0}' "$OUT/mongo/$db.counts.txt")" "$(du -h "$OUT/mongo/$db.archive.gz" | cut -f1)"
}
if [[ $MONGO_TAT_CA == 1 ]]; then
  DBS=$(mongosh --quiet "$MONGO_URI" --eval 'db.adminCommand({listDatabases:1}).databases.map(d=>d.name).join("\n")' \
        | grep -Ev '^(admin|config|local)$|_pytest_|_e2e(_|$)|_test_')
  echo "[mongo] dump toàn bộ: $(echo "$DBS" | wc -l | tr -d ' ') database"
  for d in $DBS; do dump_db "$d"; done
else
  dump_db "$MONGO_DB"
fi

# ---------- 2. Qdrant ----------
if [[ $CO_QDRANT == 1 ]]; then
  if curl -sf "$QDRANT_URL/readyz" >/dev/null; then
    COLLS=$(curl -sf "$QDRANT_URL/collections" | python3 -c 'import sys,json; print("\n".join(c["name"] for c in json.load(sys.stdin)["result"]["collections"]))')
    for c in $COLLS; do
      echo "[qdrant] snapshot $c ..."
      SNAP=$(curl -sf -X POST "$QDRANT_URL/collections/$c/snapshots?wait=true" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["name"])')
      if [[ -f "$QDRANT_SNAPSHOTS_DIR/$c/$SNAP" ]]; then
        cp "$QDRANT_SNAPSHOTS_DIR/$c/$SNAP" "$OUT/qdrant/$c.snapshot"
      else
        curl -sf -o "$OUT/qdrant/$c.snapshot" "$QDRANT_URL/collections/$c/snapshots/$SNAP"
      fi
      curl -sf -X DELETE "$QDRANT_URL/collections/$c/snapshots/$SNAP" >/dev/null || true   # dọn bản tạm trong Qdrant
      curl -sf "$QDRANT_URL/collections/$c" | python3 -c '
import sys,json; r=json.load(sys.stdin)["result"]
json.dump({"collection": sys.argv[1], "points_count": r.get("points_count"), "vectors": r["config"]["params"].get("vectors")}, sys.stdout, ensure_ascii=False, indent=1)' "$c" > "$OUT/qdrant/$c.info.json"
      echo "[qdrant] $c: $(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["points_count"])' "$OUT/qdrant/$c.info.json") điểm, $(du -h "$OUT/qdrant/$c.snapshot" | cut -f1)"
    done
  else
    echo "[qdrant] không chạy tại $QDRANT_URL — bỏ qua (máy đích chạy index_raw_vectors.py để nạp lại)"
  fi
fi

# ---------- 3. File ----------
tar_dir() {  # tar_dir <thư mục> <file đích> [z]
  local src="$1" dst="$2" z="${3:-}"
  if [[ ! -d "$src" ]]; then echo "[file] $src không có — bỏ qua"; return; fi
  echo "[file] $src -> $(basename "$dst") ($(find "$src" -type f | wc -l | tr -d ' ') file, $(du -sh "$src" | cut -f1)) ..."
  tar -C "$src" -c${z}f "$dst" .
}
if [[ $CO_FILE == 1 ]]; then
  tar_dir "$RAW_DIR" "$OUT/files/raw.tar.gz" z
  tar_dir "$MEDIA_DIR" "$OUT/files/media.tar"          # webm/mp4 đã nén, không gzip
  PREVIEW_DIR="${PREVIEW_DIR:-$(dirname "$RAW_DIR")/preview}"
  [[ -d "$PREVIEW_DIR" ]] && tar_dir "$PREVIEW_DIR" "$OUT/files/preview.tar.gz" z
fi
[[ $CO_TTS == 1 ]] && tar_dir "$TTS_DIR" "$OUT/files/tts.tar.gz" z

# ---------- 4. Manifest, checksum, script import ----------
cp "$ROOT/import_du_lieu.sh" "$OUT/import_du_lieu.sh"; chmod +x "$OUT/import_du_lieu.sh"
{
  echo "VC Content Engine — bó dữ liệu chuyển máy chủ"
  echo "Xuất lúc: $(date '+%d/%m/%Y %H:%M:%S (%Z)')   máy: $(hostname)"
  echo "Commit code: $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo '?') ($(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?'))"
  echo "MONGO_URI=$MONGO_URI   MONGO_DB=$MONGO_DB   mongo-tat-ca=$MONGO_TAT_CA"
  echo "RAW_DIR=$RAW_DIR   MEDIA_DIR=$MEDIA_DIR   TTS_DIR=$TTS_DIR   QDRANT_URL=$QDRANT_URL"
  echo
  for f in "$OUT"/mongo/*.counts.txt; do
    [[ -f "$f" ]] || continue
    echo "## MongoDB $(basename "$f" .counts.txt): $(awk -F'\t' '{s+=$2} END{print s+0}' "$f") bản ghi / $(wc -l < "$f" | tr -d ' ') collection"
    sed 's/^/  /' "$f"; echo
  done
  for f in "$OUT"/qdrant/*.info.json; do [[ -f "$f" ]] && { echo "## Qdrant $(basename "$f" .info.json)"; sed 's/^/  /' "$f"; echo; }; done
  echo "## File"
  for f in "$OUT"/files/*; do [[ -f "$f" ]] && printf '  %-16s %6s  %s file\n' "$(basename "$f")" "$(du -h "$f" | cut -f1)" "$(tar -tf "$f" | grep -vc '/$')"; done
  echo; echo "Tổng: $(du -sh "$OUT" | cut -f1)"
} > "$OUT/MANIFEST.txt"
( cd "$OUT" && find . -type f ! -name SHA256SUMS ! -name export.log | sed 's#^\./##' | sort | xargs $SHA > SHA256SUMS )

echo; cat "$OUT/MANIFEST.txt"
echo "===== $(date '+%d/%m/%Y %H:%M:%S') xong ====="
cat <<HD

Bước tiếp (máy đích đã cài theo DESIGN 12.1, MongoDB + Qdrant đang chạy):
  rsync -avP "$OUT/" user@may-dich:/duong-dan/TIKTIKTOTEXT/output/migration/$(basename "$OUT")/
  ssh user@may-dich 'cd /duong-dan/TIKTIKTOTEXT && bash output/migration/$(basename "$OUT")/import_du_lieu.sh --kiem-tra'
  ... rồi bỏ --kiem-tra để nạp thật (thêm --drop nếu DB đích đã có dữ liệu cần thay).
HD
