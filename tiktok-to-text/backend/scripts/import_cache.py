#!/usr/bin/env python3
"""Nhập kết quả cũ của CLI (output/cache/*.json + output/srt/*.srt) vào MongoDB.

    cd backend && ../.venv/bin/python scripts/import_cache.py [--out ../output]

Chạy lại nhiều lần không tạo trùng (upsert theo video ID); tags/ghi chú đã nhập trên web được giữ nguyên.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import db  # noqa: E402
from app.config import ROOT_DIR  # noqa: E402

SRT_TIME = re.compile(r"(\d+):(\d+):(\d+),(\d+) --> (\d+):(\d+):(\d+),(\d+)")


def parse_srt(path: Path) -> list[dict]:
    segs = []
    for block in path.read_text(encoding="utf-8").strip().split("\n\n"):
        lines = block.strip().splitlines()
        if len(lines) < 3 or not (m := SRT_TIME.match(lines[1])):
            continue
        n = [int(x) for x in m.groups()]
        start = n[0] * 3600 + n[1] * 60 + n[2] + n[3] / 1000
        end = n[4] * 3600 + n[5] * 60 + n[6] + n[7] / 1000
        segs.append({"start": round(start, 2), "end": round(end, 2), "text": " ".join(lines[2:])})
    return segs


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", default=str(ROOT_DIR / "output"), help="Thư mục output của CLI")
    args = p.parse_args()
    out = Path(args.out)
    files = sorted((out / "cache").glob("*.json"))
    if not files:
        print(f"Không có file nào trong {out / 'cache'}")
        return 1

    db.ensure_indexes()
    counts = {"ok": 0, "no_speech": 0, "error": 0}
    for f in files:
        record = json.loads(f.read_text(encoding="utf-8"))
        vid = str(record["id"])
        doc = db.video_doc_from_record(record)
        srt = out / "srt" / f"{vid}.srt"
        if doc["status"] != "error":
            doc["segments"] = parse_srt(srt) if srt.exists() else []
            doc["transcribed_at"] = datetime.fromtimestamp(f.stat().st_mtime, timezone.utc)
            doc["engine"] = "cli"
        db.upsert_video(vid, doc)
        counts[doc["status"]] += 1

    print(f"Đã nhập {len(files)} video: {counts['ok']} OK, {counts['no_speech']} không lời nói, "
          f"{counts['error']} lỗi → MongoDB {db.db.name}.videos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
