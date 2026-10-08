"""Kiểm thử đầu-cuối nguồn video tiếng nước ngoài trên DB / thư mục riêng, không đụng bản đang chạy.

Chạy (từ thư mục backend):
    MONGO_DB=tiktok_to_text_test_ngoaingu RAW_DIR=/tmp/nn/raw MEDIA_DIR=/tmp/nn/media \
        ../.venv/bin/python scripts/test_nguon_ngoai_ngu.py https://www.tiktok.com/@zhihua33 --limit 3

Đạt khi mỗi video: (1) tự nhận ngôn ngữ khác tiếng Việt, (2) bản chữ đúng ngôn ngữ gốc (chữ Hán với tiếng Trung),
(3) có bản dịch tiếng Việt đủ câu, (4) DB lưu cả `segments` gốc lẫn `translation`, tài liệu có cả hai phần.
"""

import argparse
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config  # noqa: E402

if config.MONGO_DB == "tiktok_to_text":
    sys.exit("Đặt MONGO_DB sang DB thử nghiệm, không chạy trên DB thật")

from app import db  # noqa: E402
from app.kb.adapters.base import Context  # noqa: E402
from app.kb.adapters.video import VideoAdapter  # noqa: E402
from app.kb.translate import leaks_source  # noqa: E402

HAN = re.compile(r"[一-鿿]")
VI = re.compile(r"[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]", re.I)


def check(v: dict, doc) -> list[tuple[str, bool, str]]:
    lang = v.get("language")
    segs = v.get("segments") or []
    tr = v.get("translation") or {}
    tsegs = tr.get("segments") or []
    src = "".join(s["text"] for s in segs)
    vi = " ".join(s["text"] for s in tsegs)
    han = len(HAN.findall(src)) / max(len(src), 1)
    filled = sum(1 for s in tsegs if s["text"].strip())
    leaked = [s["text"] for s in tsegs if leaks_source(s["text"])]
    if not segs:   # chỉ có nhạc: không có gì để nhận / dịch, câu bịa của Whisper phải bị lọc hết
        return [("Không có lời nói (câu bịa đã lọc)", not tsegs and "nguyên bản" not in doc.text,
                 f"language={lang}")]
    return [
        ("1. Tự nhận ngôn ngữ", bool(lang) and lang not in ("auto", "vi"), f"language={lang}"),
        ("2. Bản chữ đúng ngôn ngữ gốc", bool(segs) and (han > 0.5 if lang in ("zh", "yue") else not VI.search(src)),
         f"{len(segs)} câu, chữ Hán {han:.0%}: {src[:60]!r}"),
        ("3. Dịch sang tiếng Việt", bool(tsegs) and filled == len(segs) and bool(VI.search(vi)) and not leaked,
         f"{filled}/{len(segs)} câu, {len(leaked)} câu sót chữ gốc ({tr.get('engine')}): "
         f"{(leaked[0] if leaked else vi)[:80]!r}"),
        ("4. Lưu gốc + bản dịch", bool(segs) and bool(tsegs) and "nguyên bản" in doc.text
         and "dịch tiếng Việt" in doc.text and doc.meta.get("translated"),
         f"caption_vi={tr.get('caption')!r}"[:120]),
    ]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("url")
    p.add_argument("--limit", type=int, default=3)
    a = p.parse_args()
    raw = config.RAW_DIR / "test_ngoai_ngu"
    raw.mkdir(parents=True, exist_ok=True)
    source = {"_id": "test-ngoai-ngu", "url": a.url}
    db.db["kb_sources"].update_one({"_id": source["_id"]}, {"$set": source}, upsert=True)
    ctx = Context(raw_dir=raw, options={"limit": a.limit, "language": "auto", "force": True, "sleep": 1},
                  log=print, cancelled=lambda: False)
    passed = total = 0
    for doc in VideoAdapter().extract(source, ctx):
        v = db.videos.find_one({"_id": doc.meta["video_id"]})
        print(f"\n=== {v['_id']} {v.get('url')}")
        for name, ok, detail in check(v, doc):
            total += 1
            passed += ok
            print(f"  [{'ĐẠT' if ok else 'TRƯỢT'}] {name} — {detail}")
        out = raw / f"{v['_id']}.md"
        out.write_text(doc.text, encoding="utf-8")
        print(f"  tài liệu: {out}")
    print(f"\nTổng: {passed}/{total} tiêu chí đạt")
    sys.exit(0 if total and passed == total else 1)


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    main()
