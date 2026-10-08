#!/usr/bin/env python3
"""Chuyển dữ liệu học tập sang mô hình khoá học theo cây chủ đề (LRN-15…17 — BA 17.12, DESIGN TK-15a).

Ba việc, không xoá gì:
  1. Bài học chưa có khoá (`lessons.category`): gắn khoá = lĩnh vực xuất hiện nhiều nhất trong thẻ của bài (hoà → lĩnh
     vực chính của thẻ → thẻ đầu bài → nút sâu hơn → chữ cái — courses.guess_category); không thẻ nào có lĩnh vực → null (Chưa xếp khoá, người soạn tự chọn).
  2. Bài chưa có `seq`: trong mỗi khoá xếp theo vị trí trong lộ trình đã phát hành gần nhất có bài (tuần, thứ tự
     trong tuần), còn lại theo ngày tạo; đánh 10, 20… nối sau bài đã có trong khoá.
  3. Lộ trình chưa có `kind` → `kind = "weeks"` (kiểu cũ). `modules`, bài đã giao, lượt làm không đụng.
Bản ghi script sửa mang `migrated.khoa_hoc` (giờ chạy) để quay lui. Chạy lại lần hai không đổi gì.

    cd backend
    ../.venv/bin/python scripts/chuyen_khoa_hoc.py            # chạy thử: chỉ đọc, in báo cáo
    ../.venv/bin/python scripts/chuyen_khoa_hoc.py --apply    # mongodump lessons + learning_paths rồi ghi
    ../.venv/bin/python scripts/chuyen_khoa_hoc.py --undo     # gỡ category / seq / kind do script ghi

Thứ tự: DB QA (:8300, tiktok_to_text_qa) → UAT (:8400) → DB thật (người chủ repo chạy). DB theo MONGO_DB.
Quay lui hoàn toàn: mongorestore --drop --nsInclude='<db>.lessons' --nsInclude='<db>.learning_paths' <thư mục dump>.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import categories  # noqa: E402
from app.config import MONGO_URI, ROOT_DIR  # noqa: E402
from app.db import db  # noqa: E402
from app.learn import courses  # noqa: E402

MARK = "migrated.khoa_hoc"
SHOW = 20            # số dòng liệt kê tối đa mỗi nhóm trong báo cáo


def backup(stamp: datetime) -> Path:
    """mongodump hai collection sẽ ghi; lỗi → dừng (không ghi gì)."""
    out = ROOT_DIR / "output" / "backup" / f"khoa-hoc-{stamp:%Y%m%d-%H%M%S}"
    for coll in ("lessons", "learning_paths"):
        subprocess.run(["mongodump", f"--uri={MONGO_URI}", f"--db={db.name}", f"--collection={coll}", f"--out={out}"],
                       check=True, capture_output=True)
    return out


def positions() -> dict:
    """Bài → khoá sắp xếp theo lộ trình đã phát hành gần nhất chứa bài: (−năm, −tháng, tuần, vị trí trong tuần)."""
    pos: dict = {}
    rows = db.learning_paths.find({"status": {"$in": ["published", "closed"]}}, {"year": 1, "month": 1, "modules": 1})
    for p in rows:
        recency = (-(p.get("year") or 0), -(p.get("month") or 0))
        for m in p.get("modules") or []:
            for i, lid in enumerate(m.get("lesson_ids") or []):
                key = (*recency, m.get("week") or 0, i)
                if lid not in pos or key < pos[lid]:
                    pos[lid] = key
    return pos


def plan() -> tuple[dict, list, list]:
    """(khoá → [bài theo thứ tự sẽ ghi], [bài chỉ thiếu seq], [bài hoà lĩnh vực]) — chỉ bài còn thiếu trường."""
    todo = list(db.lessons.find({"$or": [{"category": {"$exists": False}}, {"seq": {"$exists": False}}]},
                                {"title": 1, "items.card_id": 1, "created_at": 1, "category": 1}))
    ids = {i["card_id"] for r in todo for i in r.get("items") or []}
    card_cats = {c["_id"]: c.get("categories") or [] for c in db.wiki_cards.find({"_id": {"$in": list(ids)}},
                                                                                 {"categories": 1})}
    depth = {c["slug"]: len(c.get("path") or []) for c in categories.categories.find({}, {"slug": 1, "path": 1})}
    pos = positions()
    by_course: dict = defaultdict(list)
    ties = []
    for r in todo:
        if "category" in r:
            slug = r["category"]                        # đã có khoá (người soạn chọn), chỉ thiếu seq
        else:
            cids = [i["card_id"] for i in r.get("items") or []]
            slug = courses.guess_category(cids, card_cats, depth)
            counts = defaultdict(int)
            for c in dict.fromkeys(cids):
                for s in dict.fromkeys(card_cats.get(c) or []):
                    if s in depth:
                        counts[s] += 1
            top = [s for s, n in counts.items() if n == max(counts.values(), default=0)]
            if len(top) > 1:
                ties.append((r, slug, top))
        by_course[slug].append(r)
    far = (1, 0, 0, 0)                                  # không nằm trong lộ trình nào → sau, theo ngày tạo
    for rows in by_course.values():
        rows.sort(key=lambda r: (pos.get(r["_id"], far), r.get("created_at") or datetime.min.replace(tzinfo=timezone.utc),
                                 r["_id"]))
    return by_course, todo, ties


def apply(by_course: dict, stamp: datetime) -> tuple[int, int]:
    n = 0
    for slug, rows in by_course.items():
        start = courses.next_seq(slug) - courses.SEQ_STEP
        for k, r in enumerate(rows, 1):
            upd = {"seq": start + courses.SEQ_STEP * k, MARK: stamp}
            q = {"_id": r["_id"], "seq": {"$exists": False}}
            if "category" not in r:
                upd["category"] = slug
                upd["migrated.khoa_hoc_set_category"] = True
                q["category"] = {"$exists": False}
            n += db.lessons.update_one(q, {"$set": upd}).modified_count
    p = db.learning_paths.update_many({"kind": {"$exists": False}}, {"$set": {"kind": "weeks", MARK: stamp}})
    return n, p.modified_count


def undo() -> None:
    """Gỡ trường do script ghi. Bài người soạn đã đổi khoá sau khi chuyển (khoá khác lúc script gắn — không
    biết được lúc gắn là gì nên dựa vào `updated_at` > giờ chạy) được giữ và liệt kê."""
    kept = []
    for r in db.lessons.find({MARK: {"$exists": True}}):
        stamp = r["migrated"]["khoa_hoc"]
        if (r.get("updated_at") or stamp) > stamp:
            kept.append(r)
            continue
        unset = {"seq": "", "migrated.khoa_hoc": "", "migrated.khoa_hoc_set_category": ""}
        if r["migrated"].get("khoa_hoc_set_category"):
            unset["category"] = ""
        db.lessons.update_one({"_id": r["_id"]}, {"$unset": unset})
    db.lessons.update_many({"migrated": {}}, {"$unset": {"migrated": ""}})
    p = db.learning_paths.update_many({MARK: {"$exists": True}, "kind": "weeks"},
                                      {"$unset": {"kind": "", "migrated.khoa_hoc": ""}})
    db.learning_paths.update_many({"migrated": {}}, {"$unset": {"migrated": ""}})
    print(f"✓ Đã gỡ trường ở bài học (giữ lại {len(kept)} bài đã sửa sau khi chuyển), {p.modified_count} lộ trình")
    for r in kept[:SHOW]:
        print(f"  giữ: {r['title']} — khoá {r.get('category')}")


def report(by_course: dict, todo: list, ties: list, total: int) -> None:
    labels = categories.labels()
    guessed = sum(len(v) for k, v in by_course.items() if k)
    print(f"Bài học: {total} · cần chuyển: {len(todo)} · sẽ có khoá: {guessed} · "
          f"Chưa xếp khoá: {len(by_course.get(None, []))}")
    for slug in sorted((s for s in by_course if s), key=lambda s: labels.get(s, s)):
        rows = by_course[slug]
        print(f"  {labels.get(slug, slug)}  [{slug}] — {len(rows)} bài")
        for k, r in enumerate(rows[:SHOW], 1):
            print(f"      {k}. {r['title']}")
    if none := by_course.get(None):
        print(f"Chưa xếp khoá (không thẻ nào có lĩnh vực) — {len(none)} bài:")
        for r in none[:SHOW]:
            print(f"      · {r['title']}")
    if ties:
        print(f"Hoà số thẻ — đã chọn theo lĩnh vực chính của thẻ, thẻ đầu bài (nên kiểm lại) — {len(ties)} bài:")
        for r, slug, top in ties[:SHOW]:
            print(f"      · {r['title']}: chọn {slug} trong {', '.join(top)}")
    print(f"Lộ trình gắn kind=weeks (kiểu cũ): {db.learning_paths.count_documents({'kind': {'$exists': False}})}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--apply", action="store_true", help="sao lưu rồi ghi (mặc định chỉ đọc)")
    g.add_argument("--undo", action="store_true", help="gỡ category / seq / kind do script ghi")
    ap.add_argument("--no-backup", action="store_true", help="bỏ mongodump (chỉ dùng trong test)")
    args = ap.parse_args()
    mode = "ghi thật" if args.apply else "quay lui" if args.undo else "chạy thử — không ghi"
    print(f"DB: {db.name}  ({mode})")
    if args.undo:
        undo()
        return 0
    by_course, todo, ties = plan()
    report(by_course, todo, ties, db.lessons.count_documents({}))
    if not args.apply:
        print("Chưa ghi gì. Chạy lại với --apply để ghi.")
        return 0
    stamp = datetime.now(timezone.utc)
    if not args.no_backup:
        try:
            print(f"Sao lưu: {backup(stamp)}")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"✗ Sao lưu lỗi, không ghi gì: {e}")
            return 1
    n, p = apply(by_course, stamp)
    print(f"✓ Đã ghi {n} bài học, {p} lộ trình (kind=weeks)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
