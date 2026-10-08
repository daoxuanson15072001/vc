#!/usr/bin/env bash
# Job đêm (launchd com.vcpv.nightly-vectors, cài bằng setup_vector_db.sh): tính embedding cho thẻ VCWIKI còn thiếu,
# cập nhật bảng thuật ngữ dịch từ tài liệu / thẻ ngành ô tô mới (tối đa 90 phút), rồi nạp tầng thô (văn bản tài liệu)
# vào Qdrant — chỉ phần mới / đổi, tới STOP_AT thì dừng êm, đêm sau làm tiếp.
# Chạy tay:  bash nightly_vectors.sh     Log: output/logs/nightly_vectors.log
cd "$(dirname "$0")"
STOP_AT="${STOP_AT:-07:30}"
mkdir -p output/logs
exec >>output/logs/nightly_vectors.log 2>&1
echo "===== $(date '+%Y-%m-%d %H:%M:%S') bắt đầu ====="

caffeinate -i -w $$ &          # máy không ngủ khi job đang chạy

if ! curl -sf http://127.0.0.1:11434/api/version >/dev/null; then
  echo "Ollama chưa chạy — khởi động..."
  open -a Ollama 2>/dev/null || (ollama serve >/dev/null 2>&1 &)
  for _ in $(seq 1 30); do curl -sf http://127.0.0.1:11434/api/version >/dev/null && break; sleep 2; done
fi
if ! curl -sf http://127.0.0.1:6333/readyz >/dev/null; then
  echo "Qdrant chưa chạy — khởi động..."
  launchctl kickstart "gui/$(id -u)/com.vcpv.qdrant" 2>/dev/null
  for _ in $(seq 1 30); do curl -sf http://127.0.0.1:6333/readyz >/dev/null && break; sleep 2; done
fi

cd backend
../.venv/bin/python scripts/backfill_embeddings.py
../.venv/bin/python scripts/build_glossary.py update --limit 150 --minutes 90
../.venv/bin/python scripts/index_raw_vectors.py --until "$STOP_AT"
echo "===== $(date '+%Y-%m-%d %H:%M:%S') kết thúc (mã $?) ====="
