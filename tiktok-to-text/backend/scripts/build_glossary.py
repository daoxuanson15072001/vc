"""Bảng thuật ngữ dịch rút từ tài liệu ngành ô tô và thẻ VCWIKI (xem app/kb/glossary.py).

    # rút thuật ngữ (AI local, ~30–60 giây / nguồn; chạy tiếp được, nguồn đã rút thì bỏ qua)
    python scripts/build_glossary.py extract --per-channel 100
    # gộp + xem trước ra CSV, chưa ghi / ghi vào bảng `glossary`
    python scripts/build_glossary.py build
    python scripts/build_glossary.py build --apply
    # job đêm: rút phần mới (tối đa --limit nguồn / --minutes phút) rồi gộp và ghi
    python scripts/build_glossary.py update --limit 150 --minutes 90
    # thêm tay thuật ngữ mảng kho chưa có (CSV: vi,zh,en,ghi_chu; nhiều từ cách nhau " | "), vào thẳng "approved"
    python scripts/build_glossary.py import scripts/data/glossary_dien_tu_o_to.csv

Nguồn: tài liệu Kho tư liệu tiếng Việt thuộc lĩnh vực nganh-o-to hoặc của các kênh sửa xe (video, PDF, bài viết)
và thẻ VCWIKI ngành ô tô chưa bị loại. Mới trước.
"""

import argparse
import csv
import fcntl
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config, db  # noqa: E402
from app.kb import glossary  # noqa: E402

LOCK = config.ROOT_DIR / "output" / "glossary.lock"


def lock():
    """Một lượt rút một lúc (job đêm và chạy tay không tranh nhau AI local); đang có lượt khác thì None."""
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    f = LOCK.open("w")
    try:
        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return None
    return f


def extract(limit: int, per_group: int, minutes: float) -> int:
    todo = list(glossary.sources(limit, per_group))
    kinds = {k: sum(1 for s in todo if s["kind"] == k) for k in ("video", "document", "card")}
    print(f"Cần rút: {len(todo)} nguồn ({kinds['video']} video, {kinds['document']} tài liệu khác, {kinds['card']} thẻ)")
    t0 = time.time()
    n = 0
    for i, src in enumerate(todo, 1):
        if minutes and time.time() - t0 > minutes * 60:
            print(f"Hết {minutes:.0f} phút — dừng, lần sau làm tiếp")
            break
        try:
            terms = glossary.extract_text(src["title"], src["text"])
        except Exception as e:  # noqa: BLE001 — một nguồn lỗi thì bỏ qua, lần sau chạy lại
            print(f"[{i}/{len(todo)}] {src['key']} lỗi: {str(e)[:150]}")
            continue
        glossary.save_raw(src, terms)
        n += 1
        eta = (time.time() - t0) / i * (len(todo) - i) / 60
        print(f"[{i}/{len(todo)}] {src['group']} {src['key']}: {len(terms)} thuật ngữ — còn ~{eta:.0f} phút")
    return n


def build(apply: bool, out: Path, min_videos: int, min_channels: int) -> None:
    entries = glossary.aggregate(min_videos, min_channels)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["vi", "zh", "en", "nghe_nham", "so_video", "so_the", "kenh"])
        for e in entries:
            w.writerow([e["vi"], " | ".join(e["terms"]["zh"]), " | ".join(e["terms"]["en"]), " | ".join(e["heard"]),
                        e["videos"], e["cards"], " ".join(e["channels"])])
    print(f"{glossary.raw.count_documents({})} nguồn đã rút -> {len(entries)} thuật ngữ đủ ngưỡng "
          f"(≥{min_videos} nguồn, thẻ tính x{glossary.CARD_WEIGHT}; ≥{min_channels} kênh; thẻ đã duyệt: đủ). "
          f"Xem trước: {out}")
    if apply:
        print(f"Đã ghi {glossary.save(entries)} mục vào bảng glossary ({config.MONGO_DB})")
    else:
        print("Chưa ghi — thêm --apply để ghi")


def import_csv(path: Path) -> None:
    n = 0
    with path.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            vi = (row.get("vi") or "").strip()
            if not vi:
                continue
            terms = {lang: [x.strip() for x in (row.get(lang) or "").split("|") if x.strip()] for lang in glossary.LANGS}
            glossary.glossary.update_one({"_id": glossary.norm(vi)}, {"$set": {
                "vi": vi, "terms": terms, "note": (row.get("ghi_chu") or "").strip(), "status": "approved",
                "categories": [glossary.CATEGORY], "updated_at": db.now()},
                "$setOnInsert": {"videos": 0, "cards": 0, "channels": [], "heard": []}}, upsert=True)
            n += 1
    glossary._cache = None
    print(f"Đã nạp {n} thuật ngữ (approved) từ {path} vào {config.MONGO_DB}")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    preview = config.ROOT_DIR / "output" / "glossary_preview.csv"
    e = sub.add_parser("extract")
    e.add_argument("--limit", type=int, default=0, help="số nguồn tối đa (0 = tất cả)")
    e.add_argument("--per-channel", type=int, default=0, help="số nguồn tối đa mỗi kênh / nguồn (0 = không giới hạn)")
    e.add_argument("--minutes", type=float, default=0, help="dừng sau bấy nhiêu phút (0 = không giới hạn)")
    u = sub.add_parser("update")
    u.add_argument("--limit", type=int, default=150)
    u.add_argument("--minutes", type=float, default=90)
    for sp in (sub.add_parser("build"), u):
        sp.add_argument("--out", type=Path, default=preview)
        sp.add_argument("--min-videos", type=int, default=glossary.MIN_VIDEOS)
        sp.add_argument("--min-channels", type=int, default=glossary.MIN_CHANNELS)
    sub.choices["build"].add_argument("--apply", action="store_true")
    i = sub.add_parser("import")
    i.add_argument("csv", type=Path)
    a = p.parse_args()
    if a.cmd == "import":
        import_csv(a.csv)
    elif a.cmd == "build":
        build(a.apply, a.out, a.min_videos, a.min_channels)
    else:
        held = lock()
        if not held:
            print("Đang có lượt rút thuật ngữ khác chạy — bỏ qua lần này")
            return
        if a.cmd == "extract":
            extract(a.limit, a.per_channel, a.minutes)
        elif extract(a.limit, 0, a.minutes) or not glossary.glossary.estimated_document_count():
            build(True, a.out, a.min_videos, a.min_channels)
        else:
            print("Không có nguồn mới — giữ nguyên bảng thuật ngữ")


if __name__ == "__main__":
    main()
