#!/usr/bin/env bash
# Cài đặt 1 lần: bash setup.sh
# bash setup.sh --no-ml : bỏ torch + transformers (backend/requirements-ml.txt, ~1 GB) — tìm kiếm chạy nhưng không rerank
set -e
cd "$(dirname "$0")"
ML=1
[[ "$1" == "--no-ml" ]] && ML=0

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Chưa có ffmpeg. Trên Mac chạy: brew install ffmpeg" && exit 1
fi

# Mac Apple Silicon: dùng Python arm64 native (tránh bản x86 chạy qua Rosetta)
APPLE_SILICON=0
if [[ "$(uname -s)" == "Darwin" && "$(sysctl -n hw.optional.arm64 2>/dev/null)" == "1" ]]; then
  APPLE_SILICON=1
fi
PY=python3
if [[ $APPLE_SILICON == 1 && -x /opt/homebrew/bin/python3 ]]; then
  PY="arch -arm64 /opt/homebrew/bin/python3"
fi

rm -rf .venv
$PY -m venv .venv
source .venv/bin/activate
PIP="python -m pip"
[[ $APPLE_SILICON == 1 ]] && PIP="arch -arm64 python -m pip"
$PIP install --upgrade pip
$PIP install -r requirements.txt
$PIP install -r backend/requirements.txt   # bản web (FastAPI + MongoDB)
if [[ $ML == 1 ]]; then
  $PIP install -r backend/requirements-ml.txt   # reranker tìm kiếm (torch + transformers)
else
  echo "Bỏ qua backend/requirements-ml.txt (--no-ml): tìm kiếm sẽ không rerank"
fi

if [[ $APPLE_SILICON == 1 ]]; then
  $PIP install mlx-whisper
else
  $PIP install faster-whisper
fi

echo
echo "✓ Cài xong. Chạy thử:"
echo "  source .venv/bin/activate"
echo "  python tiktok_to_text.py @tenkenh --limit 3"
echo "Bản web:  bash start_web.sh   (cần MongoDB + Node.js)"
