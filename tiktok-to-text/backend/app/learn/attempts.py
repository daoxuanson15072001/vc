"""Lõi lượt làm bài (LRN-09 — docs/BA.md mục 17.7, 17.8): ảnh chụp đề, chấm tự động, chốt, khoá sau khi chốt.

Dùng chung cho luyện tập (luồng E) và bài thi + chấm tự luận (luồng I). Các hàm ở đây **không** kiểm tra quyền —
tầng API (`learn/routes.py`) kiểm tra trước khi gọi.

Vòng đời một lượt làm (`attempts`):

    build_paper(questions)            ảnh chụp đề (gồm cả đáp án — chỉ lưu DB, không gửi FE)
      └─ new_attempt(...)             bản ghi mới: answers = {}, submitted_at = finalized_at = None
           └─ save_answers(...)       lưu nháp câu trả lời (chưa nộp)            — đã nộp / đã chốt: AttemptLocked
                └─ submit(...)        nộp: chấm tự động trắc nghiệm, tự luận = None chờ chấm
                     └─ finalize(...) chốt điểm (luyện tập: ngay khi nộp; thi: người chấm chốt — luồng I)
                                      sau khi chốt KHÔNG sửa được bất kỳ trường nào (mọi API sửa trả 409)

Định dạng ảnh chụp đề (`paper`) — danh sách theo thứ tự hiển thị, mỗi phần tử:

    {"question_id": ObjectId, "kind": "single" | "multi" | "essay", "stem": str, "max": float,
     "options": [{"key": "a", "text": str, "correct": bool}],       # đã xáo; key theo thứ tự hiển thị
     "explanation": str, "model_answer": str,
     "rubric": [{"criterion": str, "max": float, "descriptor": str}],
     "card_refs": [{"card_id": ObjectId, "rev": int}], "difficulty": int, "bloom": str | None}

Câu trả lời (`answers`): {"<question_id>": "a"} (single) · ["a", "c"] (multi) · "văn bản" (essay).
"""

from __future__ import annotations

import random
from typing import Any

from bson import ObjectId

from .. import db
from .models import attempts

# Điểm tối đa mặc định của một câu trắc nghiệm; câu tự luận = tổng điểm rubric
CHOICE_POINTS = 1.0
SECRET_KEYS = ("correct", "explanation", "model_answer", "descriptor")


class AttemptLocked(Exception):
    """Lượt làm đã nộp / đã chốt nên không sửa được. Tầng API trả 409 với thông điệp này."""


class InvalidAnswer(ValueError):
    """Câu trả lời không khớp đề (câu không có trong đề, phương án không tồn tại, sai kiểu). Tầng API trả 400."""


# ---------------------------------------------------------------------------
# Ảnh chụp đề
# ---------------------------------------------------------------------------

def question_max(q: dict) -> float:
    """Điểm tối đa của một câu: trắc nghiệm = CHOICE_POINTS; tự luận = tổng `max` các tiêu chí rubric."""
    if q["kind"] == "essay":
        return float(sum(float(r.get("max") or 0) for r in q.get("rubric") or []))
    return CHOICE_POINTS


def build_paper(questions: list[dict], shuffle: bool = True, rng: random.Random | None = None) -> list[dict]:
    """Chụp đề từ các bản ghi `questions` (BA 17.8): câu hỏi sửa sau không làm đổi bài đã làm.

    shuffle=True: xáo thứ tự câu và thứ tự phương án (BA 17.7). `rng` để test tái lập được.
    Trả về `paper` (định dạng ở đầu module) — CÓ đáp án đúng; gửi xuống FE phải qua `public_paper`.
    """
    rng = rng or random.Random()
    qs = list(questions)
    if shuffle:
        rng.shuffle(qs)
    paper = []
    for q in qs:
        opts = [{"text": o["text"], "correct": bool(o.get("correct"))} for o in q.get("options") or []]
        if shuffle:
            rng.shuffle(opts)
        paper.append({
            "question_id": q["_id"], "kind": q["kind"], "stem": q["stem"], "max": question_max(q),
            "options": [{"key": chr(ord("a") + i)} | o for i, o in enumerate(opts)],
            "explanation": q.get("explanation") or "", "model_answer": q.get("model_answer") or "",
            "rubric": [{"criterion": r["criterion"], "max": float(r["max"]), "descriptor": r.get("descriptor") or ""}
                       for r in q.get("rubric") or []],
            "card_refs": list(q.get("card_refs") or []), "difficulty": q.get("difficulty"), "bloom": q.get("bloom"),
        })
    return paper


def public_paper(paper: list[dict]) -> list[dict]:
    """Đề gửi người đang làm bài: bỏ đáp án đúng, giải thích, đáp án mẫu, mô tả mức đạt của rubric.
    Còn lại: nội dung câu, phương án (key + text), tiêu chí + điểm tối đa của rubric."""
    out = []
    for p in paper:
        out.append({
            "question_id": str(p["question_id"]), "kind": p["kind"], "stem": p["stem"], "max": p["max"],
            "options": [{"key": o["key"], "text": o["text"]} for o in p["options"]],
            "rubric": [{"criterion": r["criterion"], "max": r["max"]} for r in p["rubric"]],
        })
    return out


def solution(paper: list[dict]) -> list[dict]:
    """Đáp án + giải thích từng câu (chỉ gửi sau khi đã chốt, hoặc cho người soạn / người chấm)."""
    return [{"question_id": str(p["question_id"]), "correct": [o["key"] for o in p["options"] if o["correct"]],
             "explanation": p["explanation"], "model_answer": p["model_answer"], "rubric": p["rubric"],
             "card_refs": [{"card_id": str(r["card_id"]), "rev": r["rev"]} for r in p["card_refs"]]}
            for p in paper]


# ---------------------------------------------------------------------------
# Câu trả lời + chấm tự động
# ---------------------------------------------------------------------------

def normalize_answers(paper: list[dict], answers: dict[str, Any]) -> dict[str, Any]:
    """Kiểm tra + chuẩn hoá câu trả lời theo đề. Bỏ câu trả lời rỗng (null / "" / []). Sai -> InvalidAnswer."""
    items = {str(p["question_id"]): p for p in paper}
    out: dict[str, Any] = {}
    for qid, val in (answers or {}).items():
        p = items.get(qid)
        if not p:
            raise InvalidAnswer("Câu hỏi không có trong đề")
        if val is None:
            continue                  # null = xoá / bỏ trống, cho cả 3 loại câu (QA B9)
        keys = {o["key"] for o in p["options"]}
        if p["kind"] == "essay":
            if not isinstance(val, str):
                raise InvalidAnswer("Câu tự luận cần trả lời bằng văn bản")
            if val.strip():
                out[qid] = val[:20000]
        elif p["kind"] == "single":
            if val == "":
                continue
            if not isinstance(val, str) or val not in keys:
                raise InvalidAnswer("Phương án không hợp lệ")
            out[qid] = val
        else:
            if not isinstance(val, list) or any(v not in keys for v in val):
                raise InvalidAnswer("Phương án không hợp lệ")
            if val:
                out[qid] = sorted(set(val))
    return out


def score_auto(paper: list[dict], answers: dict[str, Any]) -> dict:
    """Chấm tự động (BA 17.6): single / multi đúng hết mới có điểm (đủ điểm tối đa), sai hoặc bỏ trống = 0;
    tự luận `score = None` chờ chấm (AI + người — luồng I).

    Trả về {"items": [{question_id, kind, score, max, is_correct}], "auto_score", "auto_max", "essay_max",
    "pending": số câu tự luận chờ chấm}. `auto_score` / `auto_max` chỉ tính phần trắc nghiệm.
    """
    items, auto, auto_max, essay_max, pending = [], 0.0, 0.0, 0.0, 0
    for p in paper:
        qid = str(p["question_id"])
        a = answers.get(qid)
        if p["kind"] == "essay":
            items.append({"question_id": qid, "kind": "essay", "score": None, "max": p["max"], "is_correct": None})
            essay_max += p["max"]
            pending += 1
            continue
        right = sorted(o["key"] for o in p["options"] if o["correct"])
        given = sorted([a] if isinstance(a, str) else (a or []))
        ok = bool(given) and given == right
        score = p["max"] if ok else 0.0
        items.append({"question_id": qid, "kind": p["kind"], "score": score, "max": p["max"], "is_correct": ok})
        auto += score
        auto_max += p["max"]
    return {"items": items, "auto_score": auto, "auto_max": auto_max, "essay_max": essay_max, "pending": pending}


# ---------------------------------------------------------------------------
# Bản ghi lượt làm
# ---------------------------------------------------------------------------

def new_attempt(learner_id: ObjectId, kind: str, paper: list[dict], assignment_id: ObjectId | None = None,
                **extra) -> dict:
    """Tạo + lưu một lượt làm. kind: "practice" | "exam". extra: trường thêm (vd lesson_id cho luyện tập).
    Trả bản ghi đã lưu (có `_id`)."""
    doc = {"assignment_id": assignment_id, "learner_id": learner_id, "kind": kind, "paper": paper, "answers": {},
           "auto_score": None, "max_score": sum(p["max"] for p in paper), "ai_grading": [], "human_grading": [],
           "feedback": None, "final_score": None, "passed": None, "started_at": db.now(), "submitted_at": None,
           "finalized_by": None, "finalized_at": None, "appeal": None} | extra
    doc["_id"] = attempts.insert_one(doc).inserted_id
    return doc


def ensure_editable(attempt: dict, allow_submitted: bool = False) -> None:
    """Ném AttemptLocked nếu đã chốt (luôn khoá) hoặc đã nộp (trừ khi allow_submitted — vd người chấm ghi điểm)."""
    if attempt.get("finalized_at"):
        raise AttemptLocked("Lượt làm đã chốt — không sửa được")
    if attempt.get("submitted_at") and not allow_submitted:
        raise AttemptLocked("Lượt làm đã nộp — không sửa câu trả lời được")


def _guarded_update(attempt: dict, update: dict, allow_submitted: bool = False) -> dict:
    """Cập nhật có điều kiện ngay trong truy vấn (chống hai yêu cầu chạy chồng vượt qua kiểm tra)."""
    ensure_editable(attempt, allow_submitted)
    cond = {"_id": attempt["_id"], "finalized_at": None} | ({} if allow_submitted else {"submitted_at": None})
    new = attempts.find_one_and_update(cond, {"$set": update}, return_document=True)
    if not new:
        raise AttemptLocked("Lượt làm đã nộp / đã chốt — không sửa được")
    return new


def save_answers(attempt: dict, answers: dict[str, Any], merge: bool = True) -> dict:
    """Lưu nháp câu trả lời (tự lưu khi làm bài). merge=True: gộp vào câu đã lưu. Trả bản ghi mới.
    Đã nộp / đã chốt -> AttemptLocked; sai đề -> InvalidAnswer."""
    clean = normalize_answers(attempt["paper"], answers)
    merged = ({k: v for k, v in attempt.get("answers", {}).items() if k not in answers} | clean) if merge else clean
    return _guarded_update(attempt, {"answers": merged, "saved_at": db.now()})


def submit(attempt: dict, answers: dict[str, Any] | None = None) -> dict:
    """Nộp bài: (gộp `answers` nếu có) + chấm tự động. Ghi `auto_score`, `auto_items`, `submitted_at`.
    Không chốt — luyện tập gọi tiếp `finalize`, bài thi chờ người chấm (luồng I). Trả bản ghi mới."""
    ans = attempt.get("answers", {})
    if answers:
        ans = {k: v for k, v in ans.items() if k not in answers} | normalize_answers(attempt["paper"], answers)
    res = score_auto(attempt["paper"], ans)
    return _guarded_update(attempt, {"answers": ans, "auto_score": res["auto_score"], "auto_max": res["auto_max"],
                                     "auto_items": res["items"], "submitted_at": db.now()})


def finalize(attempt: dict, by: ObjectId | None, final_score: float, passed: bool | None = None,
             extra: dict | None = None) -> dict:
    """Chốt lượt làm (BA 17.8): ghi `final_score`, `passed`, `finalized_by` (None = hệ thống tự chốt, vd luyện
    tập), `finalized_at` + các trường `extra` (vd human_grading, feedback — luồng I). Phải nộp trước.
    Sau khi chốt, mọi hàm ghi ở module này ném AttemptLocked. Trả bản ghi mới."""
    if not attempt.get("submitted_at"):
        raise AttemptLocked("Lượt làm chưa nộp — chưa chốt được")
    return _guarded_update(attempt, (extra or {}) | {"final_score": final_score, "passed": passed,
                                                     "finalized_by": by, "finalized_at": db.now()},
                           allow_submitted=True)


def result(attempt: dict) -> dict:
    """Kết quả gửi người học sau khi chốt: điểm từng câu + đáp án + giải thích. Chưa chốt -> chỉ trạng thái."""
    base = {"id": str(attempt["_id"]), "kind": attempt["kind"], "submitted_at": attempt.get("submitted_at"),
            "finalized_at": attempt.get("finalized_at"), "max_score": attempt.get("max_score"),
            "auto_max": attempt.get("auto_max")}
    if not attempt.get("finalized_at"):
        return base
    return base | {"final_score": attempt.get("final_score"), "passed": attempt.get("passed"),
                   "auto_score": attempt.get("auto_score"), "items": attempt.get("auto_items") or [],
                   "answers": attempt.get("answers") or {}, "solution": solution(attempt["paper"]),
                   "feedback": attempt.get("feedback")}
