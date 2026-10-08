"""Thi + chấm (luồng I — docs/BA.md mục 17.6–17.8, LRN-07, 08, 12).

Vòng đời một lượt thi (dùng lõi `learn/attempts.py` của luồng E):

    POST /assignments/{id}/attempts {kind: exam}
      └─ rút đề theo ma trận (lĩnh vực × độ khó × loại) từ câu `approved` (câu `stale` / nháp không vào đề),
         xáo câu + phương án, `deadline_at` = lúc bắt đầu + duration_min
    PUT /attempts/{id}/answers   tự lưu — quá hạn giờ (+ GRACE giây) thì server tự nộp phần đã lưu, trả 409
    POST /attempts/{id}/submit   nộp: chấm tự động trắc nghiệm
      ├─ không có câu tự luận -> tự chốt (điểm = trắc nghiệm)
      └─ có tự luận -> AI chấm sơ bộ theo rubric chạy nền (`ai_status`: pending -> done / unavailable / error);
         AI không sẵn sàng -> điểm AI để trống, người chấm vẫn chấm được
    POST /attempts/{id}/finalize người chấm (người giao / quản lý trực tiếp — policy "learn.grade") chốt:
         điểm từng câu tự luận, **nhận xét bắt buộc**, lệch điểm AI ≥ 20% thang điểm câu -> **bắt buộc lý do**
    POST /attempts/{id}/appeal   người học phản hồi một lần sau khi chốt; người chấm trả lời (chấm lại: để sau)

Hết giờ được kiểm ở server (không tin đồng hồ trình duyệt): mọi lần đọc / ghi lượt thi, hàng chờ chấm và trang
"Học tập của tôi" đều gọi `expire_due` để tự nộp lượt quá giờ.

Trường thêm ở `attempts` (ngoài BA mục 7 — ghi trong báo cáo cho người điều phối): path_id, deadline_at,
duration_min, pass_score (chụp lúc bắt đầu), auto_submitted, ai_status, ai_error, ai_feedback (nhận xét nháp của
AI), graded_items (điểm từng câu sau khi chốt).
"""

from __future__ import annotations

import random
import threading
from datetime import timedelta
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import db, policy
from ..auth import current_user, users
from . import attempts as att
from . import paths as lp
from . import routes as lr
from .models import assignments, attempts, learning_paths, pass_score_of, questions

router = APIRouter(prefix="/api/learn")

cards = db.db["wiki_cards"]
GRACE = timedelta(seconds=20)       # trễ mạng khi nộp đúng lúc hết giờ
DEVIATION = 0.2                     # lệch điểm AI ≥ 20% thang điểm câu -> bắt buộc lý do (BA 17.7)


# ---------------------------------------------------------------------------
# Ma trận đề
# ---------------------------------------------------------------------------

def _pool(path: dict, owner: dict | None, learner: dict | None = None) -> list[dict]:
    """Câu có thể rút: `approved`, người tạo lộ trình xem được, (phạm vi "path": thuộc bài trong lộ trình),
    và nếu có người học: mọi thẻ căn cứ người học xem được (BA 15.7 quy tắc 4).
    `owner = None` (thi khoá — TK-15b): không lọc theo người đặt; câu thuộc các bài đã phát hành của khoá."""
    exam = path.get("exam") or {}
    f = (policy.visible_filter(owner, "question") if owner is not None else {}) | {"status": "approved"}
    if exam.get("scope", "path") == "path":
        f["_id"] = {"$in": lp.exam_pool_questions(path)}
    qs = list(questions.find(f))
    refs = {r["card_id"] for q in qs for r in q.get("card_refs") or []}
    if learner is not None:
        # thẻ trong bài học C0 / C1 của lộ trình: người được giao đọc được qua bài (vấn đề mở 33)
        opened = list(lp.lessons.find({"_id": {"$in": lp.path_lesson_ids(path)}} | policy.VIA_ASSIGNMENT,
                                      {"items": 1, "practice_question_ids": 1}))
        via = {i["card_id"] for x in opened for i in x.get("items") or []}
        via |= {r["card_id"] for q in questions.find(
            {"_id": {"$in": [q for x in opened for q in x.get("practice_question_ids") or []]}}, {"card_refs": 1})
            for r in q.get("card_refs") or []}
        seen = lr.visible_card_ids(learner, refs) | (refs & via)
        qs = [q for q in qs if all(r["card_id"] in seen for r in q.get("card_refs") or [])]
    cats = {c["_id"]: c.get("categories") or [] for c in cards.find({"_id": {"$in": list(refs)}}, {"categories": 1})}
    for q in qs:
        q["_cats"] = {s for r in q.get("card_refs") or [] for s in cats.get(r["card_id"], [])}
    return qs


def _match(q: dict, row: dict) -> bool:
    if row.get("kind") and q["kind"] != row["kind"]:
        return False
    if row.get("difficulty") and q.get("difficulty") != row["difficulty"]:
        return False
    c = (row.get("category") or "").strip()
    return not c or any(s == c or s.startswith(c + ".") for s in q["_cats"])


def row_label(row: dict) -> str:
    parts = [row.get("category") or "mọi lĩnh vực", f"độ khó {row['difficulty']}" if row.get("difficulty") else
             "mọi độ khó", {"single": "một đáp án", "multi": "nhiều đáp án", "essay": "tự luận"}.get(row.get("kind"),
                                                                                                "mọi loại")]
    return " · ".join(parts)


def draw(pool: list[dict], blueprint: list[dict], rng: random.Random | None = None) -> list[dict]:
    """Rút câu theo từng dòng ma trận, không trùng câu giữa các dòng. Thiếu câu -> 409 nói rõ dòng nào."""
    rng = rng or random.Random()
    used: set = set()
    out: list[dict] = []
    for i, row in enumerate(blueprint, 1):
        cand = [q for q in pool if q["_id"] not in used and _match(q, row)]
        if len(cand) < row["count"]:
            raise HTTPException(409, f"Ma trận đề dòng {i} ({row_label(row)}) cần {row['count']} câu đã duyệt, "
                                     f"ngân hàng chỉ có {len(cand)}")
        pick = rng.sample(cand, row["count"])
        used |= {q["_id"] for q in pick}
        out += pick
    return out


def check_blueprint(path: dict, owner: dict) -> None:
    """Khi phát hành: ma trận đề rút đủ câu từ ngân hàng người tạo xem được (409 -> 400 cho dễ hiểu)."""
    try:
        draw(_pool(path, owner), lp.exam_rows(path["exam"]))
    except HTTPException as e:
        raise HTTPException(400, e.detail) from None


# ---------------------------------------------------------------------------
# Hết giờ + sau khi nộp
# ---------------------------------------------------------------------------

def expire(a: dict) -> dict:
    """Lượt thi quá giờ (+GRACE) chưa nộp -> server tự nộp phần đã lưu. Trả bản ghi mới nhất."""
    dl = lp.aware(a.get("deadline_at"))
    if a.get("kind") != "exam" or a.get("submitted_at") or not dl or db.now() <= dl + GRACE:
        return a
    try:
        a = att.submit(a)
    except att.AttemptLocked:
        return attempts.find_one({"_id": a["_id"]})
    attempts.update_one({"_id": a["_id"]}, {"$set": {"auto_submitted": True}})
    a["auto_submitted"] = True
    return after_submit(a)


def expire_due(extra: dict | None = None) -> None:
    f = {"kind": "exam", "submitted_at": None, "deadline_at": {"$lt": db.now() - GRACE}} | (extra or {})
    for a in attempts.find(f):
        expire(a)


def _record_result(a: dict) -> None:
    """Ghi kết quả lên việc được giao: hoàn thành khi đạt hoặc đã dùng hết lượt thi."""
    asg = assignments.find_one({"_id": a["assignment_id"]})
    if not asg:
        return
    if a.get("training_document_id"):
        return
    if a.get("course"):
        state = (asg.get("progress") or {}).get("courses") or {}
        state.setdefault(a["course"], {})["exam_attempt_id"] = a["_id"]
        assignments.update_one({"_id": asg["_id"]}, {"$set": {"progress.courses": state}})
        lp.recompute_courses(assignments.find_one({"_id": asg["_id"]}))
        return
    path = learning_paths.find_one({"_id": asg["path_id"]}, {"exam": 1}) or {}
    allowed = ((path.get("exam") or {}).get("attempts")) or 1
    used = attempts.count_documents({"assignment_id": asg["_id"], "kind": "exam"})
    status = "completed" if a.get("passed") or used >= allowed else "in_progress"
    assignments.update_one({"_id": asg["_id"]}, {"$set": {"status": status, "progress.exam": {
        "attempt_id": a["_id"], "final_score": a.get("final_score"), "max_score": a.get("max_score"),
        "passed": a.get("passed")}}})


def passed_of(a: dict, score: float) -> bool:
    mx = a.get("max_score") or 0
    return mx > 0 and score / mx * 100 >= float(pass_score_of(a)) - 1e-9


def after_submit(a: dict) -> dict:
    if not any(p["kind"] == "essay" for p in a["paper"]):
        a = att.finalize(a, None, a["auto_score"], passed_of(a, a["auto_score"]),
                         extra={"graded_items": a.get("auto_items") or []})
        _record_result(a)
        return a
    attempts.update_one({"_id": a["_id"]}, {"$set": {"ai_status": "pending"}})
    a["ai_status"] = "pending"
    schedule_ai(a["_id"])
    return a


# ---------------------------------------------------------------------------
# AI chấm sơ bộ tự luận
# ---------------------------------------------------------------------------

AI_SYSTEM = """Bạn là người chấm bài tự luận nội bộ của VC Phồn Vinh. Chấm câu trả lời của người học theo TỪNG \
tiêu chí rubric, đối chiếu đáp án mẫu. Mỗi tiêu chí cho điểm từ 0 tới điểm tối đa của tiêu chí (được lẻ 0,5). \
Nhận xét ngắn cho từng tiêu chí và một nhận xét chung mang tính xây dựng (điểm tốt, điểm cần cải thiện), tiếng Việt. \
Không bịa kiến thức ngoài đáp án mẫu. Đây là điểm sơ bộ — người chấm sẽ xem lại."""

AI_SCHEMA = {
    "type": "object", "additionalProperties": False, "required": ["criteria", "feedback"],
    "properties": {
        "criteria": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["index", "score", "comment"],
            "properties": {"index": {"type": "integer"}, "score": {"type": "number"}, "comment": {"type": "string"}}}},
        "feedback": {"type": "string"}},
}


def ai_call(p: dict, answer: str) -> dict:
    """Gọi AI chấm một câu tự luận (structured_call: Claude, không có thì AI local). Trả
    {score, per_criterion [{criterion, score, max, comment}], feedback, engine}. Test thay hàm này bằng AI giả."""
    from ..kb.wiki import structured_call
    from .generate import fake_ai
    if fake_ai():       # engine giả của test / e2e (LEARN_AI_FAKE=1 hoặc meta learn_ai_fake trong DB e2e)
        per = [{"criterion": r["criterion"], "score": round(r["max"] * 0.8, 2), "max": r["max"],
                "comment": "Đạt phần lớn tiêu chí (AI giả)"} for r in p["rubric"]]
        return {"score": sum(x["score"] for x in per), "per_criterion": per,
                "feedback": "Trả lời đủ ý chính, nên thêm ví dụ cụ thể (AI giả).", "engine": "fake"}
    rubric = "\n".join(f"{i}. {r['criterion']} — tối đa {r['max']} điểm. Mức đạt: {r.get('descriptor') or '—'}"
                       for i, r in enumerate(p["rubric"], 1))
    content = (f"ĐỀ BÀI:\n{p['stem']}\n\nRUBRIC:\n{rubric}\n\nĐÁP ÁN MẪU:\n{p.get('model_answer') or '—'}\n\n"
               f"CÂU TRẢ LỜI CỦA NGƯỜI HỌC:\n{answer}")
    res = structured_call(AI_SYSTEM, content, AI_SCHEMA, max_tokens=3000)
    by_index = {c.get("index"): c for c in res.get("criteria") or []}
    per = []
    for i, r in enumerate(p["rubric"], 1):
        c = by_index.get(i) or {}
        s = max(0.0, min(float(r["max"]), float(c.get("score") or 0)))
        per.append({"criterion": r["criterion"], "score": s, "max": r["max"], "comment": c.get("comment") or ""})
    return {"score": sum(x["score"] for x in per), "per_criterion": per, "feedback": res.get("feedback") or "",
            "engine": (res.get("usage") or {}).get("model")}


def run_ai_grading(attempt_id: ObjectId) -> None:
    """Chấm sơ bộ mọi câu tự luận của một lượt đã nộp. Chỉ ghi khi `ai_status` còn "pending" và chưa chốt."""
    from ..kb.wiki import AINotReady, AIRetryLater
    a = attempts.find_one({"_id": attempt_id})
    if not a or a.get("finalized_at") or a.get("ai_status") != "pending":
        return
    out, status, error = [], "done", None
    # câu gắn thẻ C3 không gửi AI ngoài (BA 15.5 quy tắc 3) — để trống điểm AI, người chấm tự chấm
    qids = [ObjectId(str(p["question_id"])) for p in a["paper"] if p["kind"] == "essay"]
    secret = {str(q["_id"]) for q in questions.find({"_id": {"$in": qids}}, {"classification": 1})
              if policy.effective_classification(q) == "C3"}
    secret |= {str(p["question_id"]) for p in a["paper"] if p.get("classification") == "C3"}
    for p in a["paper"]:
        if p["kind"] != "essay":
            continue
        qid = str(p["question_id"])
        ans = (a.get("answers") or {}).get(qid)
        if qid in secret:
            out.append({"question_id": qid, "score": None, "per_criterion": [], "feedback": "", "engine": "c3",
                        "note": "Câu từ thẻ mật C3 — không gửi AI ngoài, người chấm tự chấm"})
            continue
        if not ans:
            out.append({"question_id": qid, "score": 0.0, "per_criterion": [
                {"criterion": r["criterion"], "score": 0.0, "max": r["max"], "comment": "Không trả lời"}
                for r in p["rubric"]], "feedback": "Không trả lời", "engine": "rule"})
            continue
        try:
            out.append({"question_id": qid} | ai_call(p, ans))
        except (AINotReady, AIRetryLater) as e:
            status, error = "unavailable", str(e)[:300]
            break
        except Exception as e:  # noqa: BLE001 — lỗi AI không được làm hỏng bài thi
            status, error = "error", str(e)[:300]
            break
    if status != "done":
        out = []
    # số câu theo vị trí trong đề (paper), không theo thứ tự trong danh sách câu tự luận (QA vòng 2, L7)
    pos = {str(p["question_id"]): i for i, p in enumerate(a["paper"], 1)}
    draft = "\n".join(f"Câu {pos[g['question_id']]}: {g['feedback']}" for g in out if g.get("feedback")) or None
    attempts.update_one({"_id": attempt_id, "finalized_at": None, "ai_status": "pending"},
                        {"$set": {"ai_grading": out, "ai_status": status, "ai_error": error, "ai_feedback": draft,
                                  "ai_graded_at": db.now()}})


def schedule_ai(attempt_id: ObjectId) -> None:
    """Chạy AI chấm nền (không giữ request web). Test thay bằng chạy đồng bộ."""
    threading.Thread(target=run_ai_grading, args=(attempt_id,), daemon=True).start()


# ---------------------------------------------------------------------------
# Hook cho PUT answers / POST submit (learn/routes.py gọi khi lượt làm là bài thi)
# ---------------------------------------------------------------------------

def exam_save(a: dict, answers: dict, user: dict) -> dict:
    a = expire(a)
    if a.get("submitted_at"):
        raise HTTPException(409, "Đã hết giờ — bài đã tự nộp" if a.get("auto_submitted") else "Bài thi đã nộp")
    return exam_out(lr.locked(att.save_answers, a, answers), user)


AUTO_SLACK = timedelta(seconds=5)       # lệch đồng hồ / độ trễ mạng khi trình duyệt tự nộp lúc hết giờ


def exam_submit(a: dict, answers: dict | None, user: dict, auto: bool = False) -> dict:
    a = expire(a)
    if a.get("submitted_at"):
        if a.get("auto_submitted"):
            return exam_out(a, user)        # trình duyệt nộp trễ sau khi server đã tự nộp
        raise HTTPException(409, "Bài thi đã nộp")
    a = lr.locked(att.submit, a, answers)
    # hết giờ do trình duyệt tự nộp cũng gắn nhãn *tự nộp* (QA vòng 2, L5): nộp sau hạn, hoặc trình duyệt báo
    # tự nộp trong khoảng AUTO_SLACK quanh hạn (cờ `auto` gửi sớm hơn thì không tính — tránh tự gắn nhãn)
    dl, sub = lp.aware(a.get("deadline_at")), lp.aware(a.get("submitted_at"))
    if dl and sub and (sub >= dl or (auto and sub >= dl - AUTO_SLACK)):
        attempts.update_one({"_id": a["_id"]}, {"$set": {"auto_submitted": True}})
        a["auto_submitted"] = True
    return exam_out(after_submit(a), user)


# ---------------------------------------------------------------------------
# Xuất lượt làm
# ---------------------------------------------------------------------------

def _can_grade(user: dict, a: dict, assigned_by) -> bool:
    return a["kind"] == "exam" and policy.can(user, "learn.grade", {"learner_id": a["learner_id"],
                                                                    "assigned_by": assigned_by})


def exam_out(a: dict, user: dict) -> dict:
    o = lr.attempt_out(a)
    asg = assignments.find_one({"_id": a["assignment_id"]}) if a.get("assignment_id") else None
    path = learning_paths.find_one({"_id": asg["path_id"]}, {"title": 1}) if asg else None
    if a.get('training_document_id'):
        path = db.db['learning_documents'].find_one({'_id': a['training_document_id']}, {'title': 1})
    learner = users.find_one({"_id": a["learner_id"]}, {"name": 1}) or {}
    mine = a["learner_id"] == user["_id"]
    o |= {"learner_name": learner.get("name"), "is_learner": mine, "server_now": db.now(),
          "deadline_at": a.get("deadline_at"), "duration_min": a.get("duration_min"),
          "pass_score": a.get("pass_score"), "auto_submitted": bool(a.get("auto_submitted")),
          "path_title": (path or {}).get("title"), "appeal": lr.plain(a.get("appeal")),
          "can_grade": bool(asg) and not a.get("finalized_at") and _can_grade(user, a, asg["assigned_by"])}
    if a.get("finalized_at"):
        o["items"] = a.get("graded_items") or o.get("items") or []
        o["can_answer_appeal"] = bool(asg and a.get("appeal") and not a["appeal"].get("answer")
                                      and _can_grade(user, a, asg["assigned_by"]))
    if not mine and a.get("submitted_at"):
        o["answers"] = a.get("answers") or {}
        o["grading"] = {"solution": att.solution(a["paper"]), "auto_items": a.get("auto_items") or [],
                        "ai_status": a.get("ai_status"), "ai_error": a.get("ai_error"),
                        "ai_grading": a.get("ai_grading") or [], "ai_feedback": a.get("ai_feedback"),
                        "human_grading": lr.plain(a.get("human_grading") or [])}
    return o


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: str, user: dict = Depends(current_user)):
    """Xem một lượt làm (BA 18.7 mục 5): người học, cấp trên trong cây, người giao, L&D trong phạm vi."""
    a = expire(lr.load_attempt(attempt_id, user))
    return exam_out(a, user) if a["kind"] == "exam" else lr.attempt_out(a)


# ---------------------------------------------------------------------------
# Bắt đầu thi (LRN-07)
# ---------------------------------------------------------------------------

class StartIn(BaseModel):
    kind: Literal["exam", "practice"] = "exam"


@router.post("/assignments/{assignment_id}/attempts", status_code=201)
def start_exam(assignment_id: str, body: StartIn | None = None, user: dict = Depends(current_user)):
    asg = assignments.find_one({"_id": lr.oid(assignment_id, "việc được giao"), "learner_id": user["_id"]})
    if not asg:
        raise HTTPException(404, "Không tìm thấy việc được giao")
    if body and body.kind == "practice":
        raise HTTPException(400, "Luyện tập làm ở từng bài học (nút Luyện tập)")
    path = learning_paths.find_one({"_id": asg["path_id"]})
    if not path or not path.get("exam"):
        raise HTTPException(400, "Lộ trình này không có bài thi")
    expire_due({"assignment_id": asg["_id"]})
    cur = attempts.find_one({"assignment_id": asg["_id"], "kind": "exam", "submitted_at": None})
    if cur:
        return exam_out(cur, user)                       # đang làm dở -> tiếp tục, không rút đề mới
    exam = lp.exam_view(path["exam"])
    if not exam["blueprint"]:
        raise HTTPException(400, "Lộ trình chưa có ma trận đề thi")
    if attempts.count_documents({"assignment_id": asg["_id"], "kind": "exam"}) >= exam.get("attempts", 1):
        raise HTTPException(409, "Bạn đã dùng hết lượt thi của lộ trình này")
    owner = users.find_one({"_id": path["owner_id"]})
    qs = draw(_pool(path, owner, user), exam["blueprint"])
    now = db.now()
    a = att.new_attempt(user["_id"], "exam", att.build_paper(qs), assignment_id=asg["_id"], path_id=path["_id"],
                        started_at=now, deadline_at=now + timedelta(minutes=exam["duration_min"]),
                        duration_min=exam["duration_min"], pass_score=pass_score_of(exam), auto_submitted=False,
                        ai_status=None, ai_error=None, ai_feedback=None)
    assignments.update_one({"_id": asg["_id"], "status": "assigned"}, {"$set": {"status": "in_progress"}})
    return exam_out(a, user)


# ---------------------------------------------------------------------------
# Chấm (LRN-08)
# ---------------------------------------------------------------------------

def grading_filter(user: dict, inbox: bool = True) -> dict:
    """Bộ lọc lượt thi của hàng chờ chấm (`GET /learn/grading`) — dùng chung với số đếm ở `/me/inbox/counts`."""
    learners = (set(policy.subordinates(user)) | set(policy.assignable_learners(user))
                | set(assignments.distinct("learner_id", {"assigned_by": user["_id"]})))
    f = {"kind": "exam", "submitted_at": {"$ne": None}, "learner_id": {"$in": list(learners)}}
    if inbox:
        f["finalized_at"] = None
    return f


def grading_todo_count(user: dict) -> int:
    """Số bài thi chờ người này chốt điểm = số dòng `GET /learn/grading?inbox=1` (cùng bộ lọc, cùng kiểm quyền chấm)."""
    expire_due()
    rows = list(attempts.find(grading_filter(user, True), {"learner_id": 1, "assignment_id": 1, "kind": 1}).limit(300))
    asgs = {x["_id"]: x for x in assignments.find({"_id": {"$in": [r["assignment_id"] for r in rows]}},
                                                  {"assigned_by": 1})}
    return sum(1 for r in rows if r["assignment_id"] in asgs and _can_grade(user, r, asgs[r["assignment_id"]]["assigned_by"]))


@router.get("/grading")
def grading_queue(inbox: bool = True, user: dict = Depends(current_user)):
    """inbox=1 (mặc định): bài thi đã nộp chờ mình chốt; inbox=0: mọi bài thi đã nộp mình xem được kết quả."""
    expire_due()
    f = grading_filter(user, inbox)
    rows = list(attempts.find(f, {"answers": 0, "paper.options": 0, "paper.rubric": 0})
                .sort("submitted_at", 1 if inbox else -1).limit(300))
    asgs = {x["_id"]: x for x in assignments.find({"_id": {"$in": [r["assignment_id"] for r in rows]}})}
    paths = {p["_id"]: p["title"] for p in learning_paths.find(
        {"_id": {"$in": [x["path_id"] for x in asgs.values()]}}, {"title": 1})}
    paths.update({p['_id']: p['title'] for p in db.db['learning_documents'].find({'_id': {'$in': [x['path_id'] for x in asgs.values()]}}, {'title': 1})})
    names = lr.names_of([r["learner_id"] for r in rows])
    # Đơn vị chính của người học (bộ lọc / cột Đơn vị ở màn Chấm bài, SCR-17 UI-3)
    first_unit = {u["_id"]: ((u.get("org") or {}).get("unit_ids") or [None])[0]
                  for u in users.find({"_id": {"$in": list({r["learner_id"] for r in rows})}}, {"org.unit_ids": 1})}
    unit_names = {u["_id"]: u.get("name") for u in db.db["org_units"].find(
        {"_id": {"$in": [x for x in first_unit.values() if x]}}, {"name": 1})}
    out = []
    for r in rows:
        asg = asgs.get(r["assignment_id"])
        if not asg:
            continue
        grader = _can_grade(user, r, asg["assigned_by"])
        if inbox and not grader:
            continue
        if not inbox and not policy.can(user, "learn.view_result", {"learner_id": r["learner_id"],
                                                                    "assigned_by": asg["assigned_by"]}):
            continue
        out.append({"id": str(r["_id"]), "learner_name": names.get(r["learner_id"]),
                    "path_title": paths.get(asg["path_id"]), "submitted_at": r["submitted_at"],
                    "learner_unit_id": str(first_unit[r["learner_id"]]) if first_unit.get(r["learner_id"]) else None,
                    "learner_unit": unit_names.get(first_unit.get(r["learner_id"])), "due_at": asg.get("due_at"),
                    "auto_submitted": bool(r.get("auto_submitted")), "auto_score": r.get("auto_score"),
                    "auto_max": r.get("auto_max"), "max_score": r.get("max_score"),
                    "essay_count": sum(1 for p in r["paper"] if p["kind"] == "essay"),
                    "ai_status": r.get("ai_status"), "finalized_at": r.get("finalized_at"),
                    "final_score": r.get("final_score"), "passed": r.get("passed"),
                    "can_grade": grader and not r.get("finalized_at"),
                    "appeal_open": bool(r.get("appeal") and not r["appeal"].get("answer"))})
    return {"items": out}


class ScoreIn(BaseModel):
    question_id: str
    score: float = Field(ge=0)
    reason: str = Field("", max_length=2000)


class FinalizeIn(BaseModel):
    scores: list[ScoreIn] = Field(default_factory=list, max_length=100)
    feedback: str = Field("", max_length=10000)


@router.post("/attempts/{attempt_id}/finalize")
def finalize_attempt(attempt_id: str, body: FinalizeIn, user: dict = Depends(current_user)):
    a = expire(lr.load_attempt(attempt_id, user))
    asg = assignments.find_one({"_id": a.get("assignment_id")}) if a.get("assignment_id") else None
    if a["kind"] != "exam" or not asg:
        raise HTTPException(400, "Chỉ chốt điểm bài thi")
    if not _can_grade(user, a, asg["assigned_by"]):
        raise HTTPException(403, "Chỉ người giao lộ trình hoặc quản lý trực tiếp của người học được chốt điểm")
    if a.get("finalized_at"):
        raise HTTPException(409, "Lượt làm đã chốt — không sửa được")
    if not a.get("submitted_at"):
        raise HTTPException(409, "Người học chưa nộp bài")
    if not body.feedback.strip():
        raise HTTPException(400, "Bắt buộc viết nhận xét cho người học trước khi chốt")
    given = {s.question_id: s for s in body.scores}
    ai = {g["question_id"]: g for g in a.get("ai_grading") or [] if g.get("score") is not None}
    now = db.now()
    human, items = [], []
    auto = {i["question_id"]: i for i in a.get("auto_items") or []}
    for n, p in enumerate(a["paper"], 1):
        qid = str(p["question_id"])
        if p["kind"] != "essay":
            items.append(auto.get(qid) or {"question_id": qid, "kind": p["kind"], "score": 0.0, "max": p["max"],
                                           "is_correct": False})
            continue
        s = given.get(qid)
        if s is None:
            raise HTTPException(400, f"Câu {n}: chưa cho điểm")
        if s.score > p["max"] + 1e-9:
            raise HTTPException(400, f"Câu {n}: điểm vượt điểm tối đa ({p['max']})")
        ai_score = ai.get(qid, {}).get("score")
        if (ai_score is not None and p["max"] > 0 and abs(s.score - ai_score) >= DEVIATION * p["max"] - 1e-9
                and not s.reason.strip()):
            raise HTTPException(400, f"Câu {n}: điểm lệch điểm AI ({ai_score:g}) từ 20% thang điểm trở lên — "
                                     "bắt buộc ghi lý do")
        human.append({"question_id": qid, "score": s.score, "reason": s.reason.strip(), "ai_score": ai_score,
                      "graded_by": user["_id"], "at": now})
        items.append({"question_id": qid, "kind": "essay", "score": s.score, "max": p["max"], "is_correct": None})
    final = float(a.get("auto_score") or 0) + sum(h["score"] for h in human)
    a = lr.locked(att.finalize, a, user["_id"], final, passed_of(a, final),
                  extra={"human_grading": human, "feedback": body.feedback.strip(), "graded_items": items})
    _record_result(a)
    return exam_out(a, user)


# ---------------------------------------------------------------------------
# Phản hồi phiếu (LRN-12 — phần gọn: một phản hồi + trả lời; chấm lại để sau)
# ---------------------------------------------------------------------------

class AppealIn(BaseModel):
    text: str | None = Field(None, max_length=5000)
    answer: str | None = Field(None, max_length=5000)


@router.post("/attempts/{attempt_id}/appeal")
def appeal(attempt_id: str, body: AppealIn, user: dict = Depends(current_user)):
    a = lr.load_attempt(attempt_id, user)
    if a["kind"] != "exam" or not a.get("finalized_at"):
        raise HTTPException(409, "Chỉ gửi phản hồi cho bài thi đã chốt điểm")
    if a["learner_id"] == user["_id"]:
        text = (body.text or "").strip()
        if not text:
            raise HTTPException(400, "Nhập nội dung phản hồi")
        res = attempts.update_one({"_id": a["_id"], "appeal": None},
                                  {"$set": {"appeal": {"text": text, "at": db.now(), "answer": None}}})
        if not res.modified_count:
            raise HTTPException(409, "Mỗi bài thi chỉ gửi phản hồi một lần")
    else:
        asg = assignments.find_one({"_id": a["assignment_id"]}) or {}
        if not _can_grade(user, a, asg.get("assigned_by")):
            raise HTTPException(403, "Chỉ người chấm trả lời phản hồi")
        answer = (body.answer or "").strip()
        if not answer:
            raise HTTPException(400, "Nhập câu trả lời")
        res = attempts.update_one({"_id": a["_id"], "appeal": {"$ne": None}, "appeal.answer": None},
                                  {"$set": {"appeal.answer": answer, "appeal.answered_at": db.now(),
                                            "appeal.answered_by": user["_id"]}})
        if not res.modified_count:
            raise HTTPException(409, "Chưa có phản hồi hoặc đã trả lời")
    return exam_out(attempts.find_one({"_id": a["_id"]}), user)
