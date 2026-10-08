#!/usr/bin/env python3
"""So bản chữ Whisper với phụ đề TikTok cho các video ĐÃ chuyển chữ (không chạy lại Whisper), rồi báo cáo.

    cd backend && ../.venv/bin/python scripts/asr_check.py fetch [--limit 100] [--channel tranmanhungmkt]
    cd backend && ../.venv/bin/python scripts/asr_check.py report [--top 60]

fetch  : lấy phụ đề của từng video Whisper chưa so, lưu kết quả vào videos.subtitle_check.
report : độ khớp trung bình, video lệch nhiều nhất, và các cặp "Whisper nghe → phụ đề ghi" lặp lại
         nhiều lần — đó là danh sách từ cần xử lý (từ vựng cho prompt, sửa sau nhận dạng, hoặc đổi model).
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import yt_dlp  # noqa: E402

from app import db  # noqa: E402
from app.kb import asr_compare  # noqa: E402
from app.kb.adapters.video import platform_of, subtitle_check, VideoAdapter  # noqa: E402


def fetch(args) -> None:
    q = {"status": "ok", "platform": "tiktok", "engine": {"$nin": [None, "subtitles"]},
         "subtitle_check": {"$exists": False}, "transcript": {"$nin": [None, ""]}}
    if args.channel:
        q["channel_handle"] = args.channel.lstrip("@")
    todo = list(db.videos.find(q, {"url": 1, "transcript": 1, "language": 1}).limit(args.limit or 0))
    print(f"{len(todo)} video cần so")
    adapter = VideoAdapter()
    opts = {"quiet": True, "no_warnings": True, "writesubtitles": True, "writeautomaticsub": True}
    for i, v in enumerate(todo, 1):
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(v["url"], download=False)
            sub = adapter._subtitles(info, None, v.get("language") or "vi", platform_of(v["url"]) == "TikTok")
        except Exception as err:  # noqa: BLE001 — một video lỗi thì bỏ qua
            print(f"[{i}/{len(todo)}] {v['_id']} ✗ {str(err)[:150]}")
            continue
        if not sub:
            db.videos.update_one({"_id": v["_id"]}, {"$set": {"subtitle_check": {"lang": None, "checked_at": db.now()}}})
            print(f"[{i}/{len(todo)}] {v['_id']} — không có phụ đề")
        else:
            check = subtitle_check(v["transcript"], sub)
            db.videos.update_one({"_id": v["_id"]}, {"$set": {"subtitle_check": check}})
            print(f"[{i}/{len(todo)}] {v['_id']} khớp {check['agreement']:.0%} · {len(check['diffs'])} chỗ lệch")
        time.sleep(random.uniform(1, 2.5))   # nghỉ giữa các video để TikTok không chặn


def report(args) -> None:
    vids = list(db.videos.find({"subtitle_check.agreement": {"$exists": True}},
                               {"url": 1, "transcript": 1, "subtitle_check": 1, "model": 1}))
    # so lại từ bản chữ + phụ đề đã lưu: đổi cách chuẩn hoá trong asr_compare thì báo cáo cập nhật ngay
    for v in vids:
        sc = v["subtitle_check"]
        sc.update(asr_compare.compare(v.get("transcript") or "", " ".join(x["text"] for x in sc.get("segments", []))))
    if not vids:
        print("Chưa có video nào được so. Chạy: scripts/asr_check.py fetch")
        return
    agree = sorted(v["subtitle_check"]["agreement"] for v in vids)
    total_w = sum(v["subtitle_check"]["words_sub"] for v in vids)
    total_e = sum(v["subtitle_check"]["wer"] * v["subtitle_check"]["words_sub"] for v in vids)
    print(f"{len(vids)} video · khớp trung bình {sum(agree) / len(agree):.1%} · trung vị {agree[len(agree) // 2]:.1%}"
          f" · WER gộp so với phụ đề {total_e / max(total_w, 1):.1%}")
    print("Model:", dict(Counter(v.get("model") for v in vids)))

    print("\nVideo lệch nhiều nhất (nên nghe lại):")
    for v in sorted(vids, key=lambda v: v["subtitle_check"]["agreement"])[:10]:
        print(f"  {v['subtitle_check']['agreement']:.0%}  {v['url']}")

    pairs = Counter((d["whisper"], d["sub"]) for v in vids for d in v["subtitle_check"].get("diffs", []))
    print(f"\nCặp lệch lặp lại (Whisper nghe → phụ đề TikTok ghi), top {args.top}:")
    for (w, s), n in pairs.most_common(args.top):
        if n < 2:
            break
        print(f"  {n:4}×  {w or '∅'!r:28} → {s or '∅'!r}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest="cmd", required=True)
    f = sp.add_parser("fetch")
    f.add_argument("--limit", type=int, default=0)
    f.add_argument("--channel")
    r = sp.add_parser("report")
    r.add_argument("--top", type=int, default=60)
    args = p.parse_args()
    (fetch if args.cmd == "fetch" else report)(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
