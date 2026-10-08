"""Khoá học theo cây chủ đề (LRN-15 — BA 17.12, DESIGN TK-15).

Mỗi nút của cây lĩnh vực là một khoá; bài học thuộc đúng một khoá (`lessons.category`, `null` = *Chưa xếp khoá*) và
xếp trong khoá theo `lessons.seq` (khoá sắp xếp, cách nhau SEQ_STEP để chèn giữa không phải đánh lại cả khoá). Số thứ
tự 1…n người học thấy tính lúc đọc trên các bài người đó xem được — không lưu.

Phần TK-15a: trường + index, gắn / đổi khoá của bài, đoán khoá từ thẻ (dùng chung cho script chuyển dữ liệu
`scripts/chuyen_khoa_hoc.py`). API khoá, sắp thứ tự, thi khoá: TK-15b.
"""

from __future__ import annotations

from collections import Counter

from bson import ObjectId

from .. import categories, db
from .models import DEFAULT_PASS_SCORE, courses, lessons

cards = db.db["wiki_cards"]

SEQ_STEP = 10


def check_course(slug: str | None) -> str | None:
    """Slug khoá người soạn chọn: `None` / rỗng = Chưa xếp khoá; slug cũ của nhánh đổi tên → slug hiện tại; nhánh
    không có trong cây hoặc đã ẩn → 400 (categories.check_slugs)."""
    if slug is None or not slug.strip():
        return None
    return categories.check_slugs([slug])[0]


def next_seq(slug: str | None, exclude: list[ObjectId] | None = None) -> int:
    """`seq` cho bài thêm vào cuối khoá `slug` (không tính các bài `exclude` — bài đang được chuyển vào)."""
    f = {"category": slug, "seq": {"$type": "number"}} | ({"_id": {"$nin": exclude}} if exclude else {})
    last = lessons.find_one(f, {"seq": 1}, sort=[("seq", -1)])
    return (last["seq"] if last else 0) + SEQ_STEP


def append(ids: list[ObjectId], slug: str | None) -> None:
    """Xếp các bài `ids` (đúng thứ tự truyền vào) vào cuối khoá `slug`."""
    start = next_seq(slug, exclude=ids) - SEQ_STEP
    for n, i in enumerate(ids, 1):
        lessons.update_one({"_id": i}, {"$set": {"category": slug, "seq": start + SEQ_STEP * n}})


def course_doc(slug: str | None) -> dict:
    """Cài đặt của khoá (thi khoá, điểm đạt bài); chưa có bản ghi → mặc định."""
    return (courses.find_one({"category": slug}) if slug else None) or {"category": slug, "exam": None,
                                                                          "lesson_pass_score": DEFAULT_PASS_SCORE}


def lesson_pass_score(lesson: dict) -> float:
    """Điểm đạt (%) của kiểm tra sau bài (BA 17.12 luật 4, 6e) — theo khoá của bài, mặc định 70."""
    v = course_doc(lesson.get("category")).get("lesson_pass_score")
    return DEFAULT_PASS_SCORE if v is None else v


def merge_course_docs(slugs: list[str], target: str) -> None:
    """Trước khi gộp các nhánh `slugs` vào `target` (xoá nhánh có move_to): `courses.category` là unique — nút đích
    đã có cài đặt thì giữ của nút đích, bỏ của nút bị xoá; chưa có thì giữ bản đầu tiên (theo thứ tự cây), bỏ phần
    còn lại. Bản giữ lại được SLUG_FIELDS đổi slug sang `target`."""
    rows = list(courses.find({"category": {"$in": slugs}}, {"category": 1}))
    rows.sort(key=lambda r: slugs.index(r["category"]))
    drop = rows if courses.find_one({"category": target}, {"_id": 1}) else rows[1:]
    if drop:
        courses.delete_many({"_id": {"$in": [r["_id"] for r in drop]}})


def move_course_progress(slugs: list[str], target: str) -> None:
    """Đổi khoá trong snapshot tiến độ khi đổi tên / gộp nhánh; slug có dấu chấm nên cập nhật nguyên object."""
    assignments = db.db["assignments"]
    for a in assignments.find({"progress.courses": {"$exists": True}}, {"progress.courses": 1}):
        state = (a.get("progress") or {}).get("courses") or {}
        moved = [state.pop(s) for s in slugs if s in state]
        if not moved:
            continue
        existing = state.get(target) or {}
        combined = {}
        for source in moved:
            combined.update(source)
        combined.update(existing)
        combined["lessons_done"] = list(dict.fromkeys([i for source in moved
                                                       for i in (source.get("lessons_done") or [])]
                                                      + list(existing.get("lessons_done") or [])))
        if not existing.get("done_at") and (done := next((x.get("done_at") for x in moved if x.get("done_at")), None)):
            combined["done_at"] = done
        state[target] = combined
        assignments.update_one({"_id": a["_id"]}, {"$set": {"progress.courses": state}})


def rename_course_progress(pairs: list[tuple[str, str]]) -> None:
    for old, new in pairs:
        move_course_progress([old], new)


def dedupe_course_refs() -> None:
    """Sau khi gộp nhánh, giữ một mục mỗi khoá trong lộ trình và snapshot giao; hợp nhất danh sách bài theo thứ tự."""
    for coll, field in ((db.db["learning_paths"], "courses"), (db.db["assignments"], "plan")):
        for doc in coll.find({field: {"$exists": True}}, {field: 1, "lesson_ids": 1}):
            refs = doc.get(field) or []
            result, by_slug = [], {}
            for row in refs:
                slug = row.get("category")
                if slug not in by_slug:
                    by_slug[slug] = row.copy()
                    result.append(by_slug[slug])
                elif field == "courses" and (row.get("lesson_ids") is None
                                                or by_slug[slug].get("lesson_ids") is None):
                    by_slug[slug]["lesson_ids"] = None
                elif row.get("lesson_ids"):
                    if not isinstance(by_slug[slug].get("lesson_ids"), list):
                        by_slug[slug]["lesson_ids"] = []
                    target_ids = by_slug[slug]["lesson_ids"]
                    target_ids.extend(i for i in row["lesson_ids"] if i not in target_ids)
                    if "required" in row:
                        by_slug[slug]["required"] = by_slug[slug].get("required", True) or row["required"]
            if len(result) != len(refs):
                update = {field: result}
                if field == "plan":
                    update["lesson_ids"] = list(dict.fromkeys(i for row in result for i in row.get("lesson_ids") or []))
                coll.update_one({"_id": doc["_id"]}, {"$set": update})


def guess_category(card_ids: list[ObjectId], card_cats: dict | None = None, depth: dict | None = None) -> str | None:
    """Khoá đoán từ thẻ của bài, xét lần lượt: (1) số thẻ có lĩnh vực đó; (2) số thẻ đặt lĩnh vực đó **đầu tiên**
    (lĩnh vực chính của thẻ); (3) thẻ chứa lĩnh vực đứng càng đầu bài càng ưu tiên (thẻ chính của bài); (4) nút sâu hơn
    (cụ thể hơn); (5) slug theo chữ cái — chạy lần nào cũng ra một kết quả. Rà dữ liệu QA 30/09: thẻ thường gắn 2–5
    lĩnh vực, bài 1–2 thẻ, nên (1) hay hoà — (2), (3) mới phân định. Không thẻ nào có lĩnh vực → None (Chưa xếp
    khoá). Chỉ tính nhánh đang có trong cây. `card_cats` / `depth` truyền sẵn khi chạy hàng loạt (script)."""
    if card_cats is None:
        card_cats = {c["_id"]: c.get("categories") or []
                     for c in cards.find({"_id": {"$in": list(card_ids)}}, {"categories": 1})}
    if depth is None:
        depth = {c["slug"]: len(c.get("path") or []) for c in categories.categories.find({}, {"slug": 1, "path": 1})}
    count: Counter = Counter()
    lead: Counter = Counter()
    first: dict[str, int] = {}
    for i, c in enumerate(dict.fromkeys(card_ids)):
        slugs = [s for s in dict.fromkeys(card_cats.get(c) or []) if s in depth]
        count.update(slugs)
        if slugs:
            lead[slugs[0]] += 1
        for s in slugs:
            first.setdefault(s, i)
    if not count:
        return None
    return min(count, key=lambda s: (-count[s], -lead[s], first[s], -depth[s], s))
