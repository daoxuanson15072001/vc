"""API khoá học theo cây chủ đề (LRN-15, 17 — BA 17.12, DESIGN TK-15b).

- `GET /learn/courses`: cây khoá — số bài người xem thấy gắn thẳng vào từng nút, nút nào có thi khoá.
- `GET /learn/courses/{slug}`: một khoá — bài theo thứ tự (số 1…n tính trên bài người xem thấy), cài đặt, kết quả
  kiểm tra sau bài của người xem.
- `PUT /learn/courses/{slug}/order`: sắp thứ tự mặc định (`learn.course.arrange`).
- `PUT /learn/courses/{slug}/settings`: thi khoá (ma trận đề rút từ câu của các bài trong khoá) + điểm đạt bài.
Bắt đầu thi khoá đi theo lộ trình được giao (người chấm tự luận = người giao) — TK-15c.
Tách khỏi `courses.py` vì cần `paths` / `grading` (hai module này import `routes`, `routes` import `courses`).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import categories, db, policy
from ..auth import current_user
from . import courses as cs
from . import grading
from . import paths as lp
from . import routes as lr
from .models import DEFAULT_PASS_SCORE, attempts, courses, lessons

router = APIRouter(prefix="/api/learn")


def _node(slug: str) -> dict:
    node = categories.categories.find_one({"slug": categories.resolve_slug(slug)})
    if not node:
        raise HTTPException(404, "Không tìm thấy khoá học (nhánh cây chủ đề)")
    return node


def course_lessons(user: dict, slug: str, published_only: bool = False) -> list[dict]:
    """Bài của khoá người này xem được, theo thứ tự `seq`."""
    f = {"$and": [lr.lesson_scope(user), {"category": slug}]}
    if published_only:
        f["$and"].append({"status": "published"})
    return list(lessons.find(f).sort([("seq", 1), ("_id", 1)]))


def lesson_results(user: dict, lesson_ids: list) -> dict:
    """Kiểm tra sau bài của người xem: lượt điểm cao nhất đã chốt (BA 17.12 luật 6e) → {lesson_id: {...}}."""
    out: dict = {}
    for a in attempts.find({"learner_id": user["_id"], "kind": "practice", "lesson_id": {"$in": lesson_ids},
                            "finalized_at": {"$ne": None}}, {"lesson_id": 1, "final_score": 1, "auto_max": 1,
                                                             "passed": 1}):
        r = out.setdefault(a["lesson_id"], {"best_pct": None, "passed": False, "attempts": 0})
        mx = a.get("auto_max") or 0
        pct = round(a["final_score"] / mx * 100, 1) if mx else None
        if pct is not None and (r["best_pct"] is None or pct > r["best_pct"]):
            r["best_pct"] = pct
        r["passed"] = r["passed"] or bool(a.get("passed"))
        r["attempts"] += 1
    return out


def settings_out(doc: dict) -> dict:
    return {"exam": lp.exam_view(doc.get("exam")),
            "lesson_pass_score": doc.get("lesson_pass_score", DEFAULT_PASS_SCORE)}


@router.get("/courses")
def list_courses(user: dict = Depends(current_user)):
    rows = lessons.aggregate([{"$match": {"$and": [lr.lesson_scope(user), {"category": {"$type": "string"}}]}},
                              {"$group": {"_id": "$category", "n": {"$sum": 1}}}])
    counts = {r["_id"]: r["n"] for r in rows}
    exams = set(courses.distinct("category", {"exam": {"$ne": None}}))
    out = {"items": [{"category": s, "lesson_count": n, "has_exam": s in exams} for s, n in sorted(counts.items())]}
    if policy.can(user, "learn.author"):
        # Chưa xếp khoá: bài người soạn tự viết (người khác không sửa khoá của bài đó được)
        out["unassigned"] = lessons.count_documents({"created_by": user["_id"],
                                                     "$or": [{"category": None}, {"category": {"$exists": False}}]})
    return out


@router.get("/courses/{slug}")
def get_course(slug: str, user: dict = Depends(current_user)):
    node = _node(slug)
    rows = course_lessons(user, node["slug"])
    res = lesson_results(user, [r["_id"] for r in rows])
    items = []
    for n, r in enumerate(rows, 1):
        o = lr.lesson_out(r, user) | {"no": n, "has_quiz": bool(r.get("practice_question_ids"))}
        if r["_id"] in res:
            o["my_result"] = res[r["_id"]]
        items.append(o)
    label = categories.labels().get(node["slug"], node["name"])
    return {"category": node["slug"], "name": node["name"], "label": label, "description": node.get("description") or "",
            "lessons": items, **settings_out(cs.course_doc(node["slug"])),
            "can_arrange": policy.can(user, "learn.course.arrange", {"category": node["slug"]})}


class OrderIn(BaseModel):
    lesson_ids: list[str] = Field(max_length=500)


@router.put("/courses/{slug}/order")
def order_course(slug: str, body: OrderIn, user: dict = Depends(current_user)):
    """Sắp lại thứ tự mặc định: gửi đủ đúng các bài của khoá mà người sắp xem được; bài người sắp không xem được
    giữ nguyên vị trí (các ô của bài xem được nhận thứ tự mới). Đánh lại seq 10, 20…"""
    node = _node(slug)
    if not policy.can(user, "learn.course.arrange", {"category": node["slug"]}):
        raise HTTPException(403, "Chỉ chủ nhánh (của nút hoặc nút cha) hoặc L&D được sắp thứ tự khoá")
    wanted = lr.oids(body.lesson_ids, "bài học")
    seen = [r["_id"] for r in course_lessons(user, node["slug"])]
    if len(set(wanted)) != len(wanted) or set(wanted) != set(seen):
        raise HTTPException(400, "Danh sách bài phải gồm đủ và đúng các bài của khoá (không trùng, không thiếu, "
                                 "không bài ngoài khoá)")
    full = [r["_id"] for r in lessons.find({"category": node["slug"]}, {"_id": 1}).sort([("seq", 1), ("_id", 1)])]
    it = iter(wanted)
    new = [next(it) if i in set(seen) else i for i in full]
    for k, i in enumerate(new, 1):
        lessons.update_one({"_id": i}, {"$set": {"seq": cs.SEQ_STEP * k}})
    return get_course(node["slug"], user)


class CourseSettingsIn(BaseModel):
    exam: lp.ExamIn | None = None
    lesson_pass_score: float = Field(DEFAULT_PASS_SCORE, ge=0, le=100)


@router.put("/courses/{slug}/settings")
def course_settings(slug: str, body: CourseSettingsIn, user: dict = Depends(current_user)):
    """Thi khoá + điểm đạt bài (BA 17.12 luật 4, 5). Thi khoá rút câu `approved` thuộc các bài **đã phát hành** của
    khoá (câu luyện tập + câu gắn thẻ trong bài); không rút đủ → 400 nêu dòng ma trận."""
    node = _node(slug)
    if not policy.can(user, "learn.course.arrange", {"category": node["slug"]}):
        raise HTTPException(403, "Chỉ chủ nhánh (của nút hoặc nút cha) hoặc L&D được đặt thi khoá")
    exam = None
    if body.exam:
        exam = body.exam.model_dump() | {"scope": "path"}
        published = [r["_id"] for r in lessons.find({"category": node["slug"], "status": "published"}, {"_id": 1})]
        if not published:
            raise HTTPException(400, "Khoá chưa có bài đã phát hành — chưa đặt thi khoá được")
        # chủ nhánh / L&D thường không xem được ngân hàng câu của người soạn: đếm trên mọi câu `approved` thuộc bài
        # đã phát hành của khoá (chỉ trả số lượng, không lộ câu); lúc thi lọc theo thẻ người học xem được (TK-15c)
        try:
            grading.draw(grading._pool(pseudo_path(node["slug"], exam), None), lp.exam_rows(exam))
        except HTTPException as e:
            raise HTTPException(400, e.detail) from None
    courses.update_one({"category": node["slug"]},
                       {"$set": {"exam": exam, "lesson_pass_score": body.lesson_pass_score,
                                 "updated_by": user["_id"], "updated_at": db.now()}}, upsert=True)
    return get_course(node["slug"], user)


def pseudo_path(slug: str, exam: dict) -> dict:
    """Khoá dưới dạng "lộ trình một tuần" để dùng lại máy rút đề của lộ trình (`grading._pool`, `draw`)."""
    ids = [r["_id"] for r in lessons.find({"category": slug, "status": "published"}, {"_id": 1}).sort("seq", 1)]
    return {"exam": exam, "modules": [{"week": 1, "lesson_ids": ids}]}
