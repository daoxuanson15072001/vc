"""AI sinh câu hỏi nháp từ một thẻ VCWIKI (docs/BA.md 17.6, LRN-02 phần AI) — luồng H.

- Loại câu theo `type` của thẻ (bảng v0.12 ở 17.6), chỉ dùng 3 kind có sẵn: single / multi / essay.
- Câu sinh ra ở trạng thái `draft`, `origin = ai`, gắn `card_refs = [{card_id, rev}]`, qua đúng hàm kiểm tra hợp lệ
  của ngân hàng câu hỏi (luồng E: `routes.validate_question`); câu AI trả sai luật bị bỏ, không lưu.
- `draft_questions_for_card(card, rev, user, n=2)` là hàm để luồng F gọi khi duyệt thẻ bậc `thuc-thi` / `van-hanh`
  (17.6 "Sinh khi duyệt thẻ") — H không tự nối vào F.

AI: dùng lại `kb/wiki.structured_call` (Claude, không có thì AI local). Test / e2e thay AI bằng engine giả:
biến môi trường `LEARN_AI_FAKE=1`, hoặc bản ghi `meta {_id: "learn_ai_fake"}` trong DB e2e (tên DB bắt đầu
`tiktok_to_text_e2e`) — không bao giờ có hiệu lực trên DB thật.
"""

from __future__ import annotations

from typing import Callable

from fastapi import HTTPException

from .. import db, policy
from ..config import learn_ai_fake
from ..kb.wiki import AINotReady, AIRetryLater, structured_call  # noqa: F401  (test thay `structured_call`)
from ..spaces import personal_space, spaces
from .models import questions

cards = db.db["wiki_cards"]

# Bảng 17.6 v0.12: type thẻ -> kind lần lượt cho câu 1, 2, 3… (quay vòng) + dạng câu gợi ý cho AI
KIND_BY_TYPE: dict[str, tuple[list[str], str]] = {
    "sop": (["multi", "multi", "essay"], "sắp xếp bước / chọn bước còn thiếu của quy trình; câu tự luận ngắn: "
                                         "viết lại bước còn thiếu"),
    "checklist": (["multi"], "chọn các mục còn thiếu / bắt buộc có trong danh sách kiểm tra"),
    "template": (["essay"], "điền mẫu cho một tình huống cụ thể; rubric chấm theo từng phần của mẫu"),
    "kpi": (["single"], "tính toán từ số liệu cho sẵn trong đề, đáp án là một con số"),
    "framework": (["single", "multi"], "định nghĩa, ghép khái niệm, áp dụng khung vào tình huống"),
    "concept": (["single", "multi"], "định nghĩa, ghép khái niệm, phân biệt khái niệm gần nghĩa"),
    "case_study": (["essay"], "tình huống: bạn quyết thế nào, vì sao"),
    "lesson": (["essay"], "tình huống: bạn quyết thế nào, vì sao"),
    "insight": (["essay"], "tình huống: bạn quyết thế nào, vì sao"),
    "regulation": (["single"], "đúng / sai có nêu mốc hiệu lực"),
}
MAX_N = 6
BLOOMS = ["remember", "understand", "apply", "analyze"]
FAKE_META_ID = "learn_ai_fake"
# BA 15.5 quy tắc 3: C3 không gửi Claude API / không trả qua MCP. `structured_call` tự chọn Claude trước, không ép
# được AI local cho riêng một lời gọi -> chặn hẳn thẻ C3 trước khi gọi AI (QA vòng 2, L1).
C3_BLOCKED = "Thẻ mật C3 không gửi AI ngoài — không sinh câu hỏi bằng AI được (BA 15.5 quy tắc 3); soạn câu tay"


def check_not_c3(card: dict) -> None:
    """Thẻ C3 -> 403 trước khi dựng prompt (mọi đường gọi AI của học tập đều qua đây)."""
    if policy.effective_classification(card) == "C3":
        raise HTTPException(403, C3_BLOCKED)


def kinds_for(card_type: str | None, n: int) -> list[str]:
    """Kind của n câu cho thẻ loại `card_type`; loại không có trong bảng 17.6 -> 400."""
    if card_type not in KIND_BY_TYPE:
        raise HTTPException(400, f"Loại thẻ “{card_type or 'không rõ'}” không sinh câu hỏi (bảng BA 17.6: "
                                 f"{', '.join(KIND_BY_TYPE)})")
    cycle = KIND_BY_TYPE[card_type][0]
    return [cycle[i % len(cycle)] for i in range(n)]


# ---------------------------------------------------------------------------
# Gọi AI (dùng chung với designer.py)
# ---------------------------------------------------------------------------

def fake_ai() -> bool:
    if learn_ai_fake():
        return True
    return db.db.name.startswith("tiktok_to_text_e2e") and bool(db.db["meta"].find_one({"_id": FAKE_META_ID}))


def ai_call(system: str, text: str, schema: dict, fake: Callable[[], dict], max_tokens: int = 4000) -> tuple[dict, str]:
    """Trả (JSON theo schema, engine). Lỗi AI để nguyên (AINotReady / AIRetryLater / ValueError) cho nơi gọi xử lý."""
    if fake_ai():
        return fake(), "fake"
    data = structured_call(system, text, schema, max_tokens=max_tokens)
    usage = data.pop("usage", None) or {}
    return data, usage.get("model") or "ai"


def ai_error_message(e: Exception) -> str:
    if isinstance(e, AINotReady):
        return f"AI chưa sẵn sàng: {e}"
    if isinstance(e, AIRetryLater):
        return f"AI tạm thời không chạy được: {e}"
    return f"AI trả kết quả lỗi: {str(e)[:200]}"


# ---------------------------------------------------------------------------
# Sinh câu hỏi
# ---------------------------------------------------------------------------

SYSTEM = """Bạn soạn câu hỏi kiểm tra cho nhân viên tập đoàn VC Phồn Vinh, CHỈ dựa trên thẻ tri thức được đưa.
Quy tắc:
- Không thêm kiến thức ngoài thẻ, không bịa số liệu (câu tính toán: số liệu cho sẵn ngay trong đề).
- Đúng số câu và đúng loại (kind) theo thứ tự yêu cầu.
- single: 2–6 phương án, đúng 1 phương án correct=true. multi: 2–6 phương án, ít nhất 1 correct=true.
  essay: options rỗng, rubric 1–4 tiêu chí (criterion, max là điểm tối đa > 0, descriptor mô tả mức đạt),
  model_answer là đáp án mẫu.
- explanation: vì sao đáp án đúng, trích ý từ thẻ.
- difficulty 1–5; bloom: remember / understand / apply / analyze. Viết tiếng Việt, ngắn gọn."""


def question_schema() -> dict:
    return {
        "type": "object",
        "properties": {"questions": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": ["single", "multi", "essay"]},
                "stem": {"type": "string"},
                "options": {"type": "array", "items": {
                    "type": "object", "properties": {"text": {"type": "string"}, "correct": {"type": "boolean"}},
                    "required": ["text", "correct"], "additionalProperties": False}},
                "rubric": {"type": "array", "items": {
                    "type": "object",
                    "properties": {"criterion": {"type": "string"}, "max": {"type": "number"},
                                   "descriptor": {"type": "string"}},
                    "required": ["criterion", "max", "descriptor"], "additionalProperties": False}},
                "model_answer": {"type": "string"},
                "explanation": {"type": "string"},
                "difficulty": {"type": "integer"},
                "bloom": {"type": "string", "enum": BLOOMS},
            },
            "required": ["kind", "stem", "options", "rubric", "model_answer", "explanation", "difficulty", "bloom"],
            "additionalProperties": False}}},
        "required": ["questions"],
        "additionalProperties": False,
    }


def card_text(card: dict, limit: int = 3500) -> str:
    """Nội dung thẻ đưa vào prompt (gọn — AI local context 4096 token)."""
    parts = [f"Tiêu đề: {card.get('title', '')}", f"Loại thẻ: {card.get('type')}",
             f"Tóm tắt: {card.get('summary') or ''}"]
    if card.get("key_points"):
        parts.append("Ý chính:\n" + "\n".join(f"- {k}" for k in card["key_points"]))
    for k, label in (("body", "Nội dung"), ("when_to_use", "Khi dùng"), ("example", "Ví dụ")):
        if card.get(k):
            parts.append(f"{label}:\n{card[k]}")
    return "\n".join(parts)[:limit]


def fake_questions(card: dict, kinds: list[str]) -> dict:
    """Engine giả (test / e2e): câu dựng từ tiêu đề + ý chính của thẻ, đúng luật 17.6."""
    title = card.get("title") or "thẻ"
    points = [p for p in card.get("key_points") or [] if p] or [card.get("summary") or title]
    out = []
    for i, kind in enumerate(kinds, 1):
        if kind == "essay":
            out.append({"kind": "essay", "stem": f"Tình huống {i}: áp dụng “{title}” — bạn làm thế nào, vì sao?",
                        "options": [], "rubric": [{"criterion": "Nêu đúng các ý của thẻ", "max": 4,
                                                   "descriptor": "; ".join(points)[:300]}],
                        "model_answer": "; ".join(points), "explanation": f"Theo thẻ “{title}”.",
                        "difficulty": 3, "bloom": "apply"})
        else:
            opts = [{"text": points[0][:300], "correct": True}, {"text": "Không có trong thẻ", "correct": False},
                    {"text": "Làm theo cảm tính", "correct": False}]
            if kind == "multi" and len(points) > 1:
                opts.insert(1, {"text": points[1][:300], "correct": True})
            out.append({"kind": kind, "stem": f"Câu {i}: theo thẻ “{title}”, điều nào đúng?", "options": opts,
                        "rubric": [], "model_answer": "", "explanation": f"Theo thẻ “{title}”.",
                        "difficulty": 2, "bloom": "remember"})
    return {"questions": out}


def question_space(card: dict, user: dict) -> dict:
    """Kho lưu câu nháp: kho của thẻ nếu người này sửa được, không thì kho cá nhân."""
    space = spaces.find_one({"_id": card.get("space_id")})
    if space and policy.can(user, "space.write", space):
        return space
    return personal_space(user)


def clean_question(raw: dict, kind: str) -> dict | None:
    """Chuẩn hoá một câu AI trả, rồi cho qua đúng kiểm tra của ngân hàng câu hỏi (luồng E: model `QuestionIn` —
    chuỗi rỗng / chỉ khoảng trắng bị từ chối, QA B5 — + `validate_question`). Sai luật -> None (bỏ)."""
    from pydantic import ValidationError

    from .routes import QuestionIn, question_fields, validate_question
    q = {"kind": kind, "stem": str(raw.get("stem") or "").strip()[:5000],
         "options": [{"text": str(o.get("text") or "").strip()[:2000], "correct": bool(o.get("correct"))}
                     for o in raw.get("options") or [] if str(o.get("text") or "").strip()][:6],
         "rubric": [{"criterion": str(r.get("criterion") or "").strip()[:500],
                     "max": max(0.0, min(100.0, float(r.get("max") or 0))),
                     "descriptor": str(r.get("descriptor") or "")[:2000]}
                    for r in raw.get("rubric") or [] if str(r.get("criterion") or "").strip()][:20],
         "model_answer": str(raw.get("model_answer") or "")[:10000],
         "explanation": str(raw.get("explanation") or "")[:5000],
         "difficulty": min(5, max(1, int(raw.get("difficulty") or 3))),
         "bloom": raw.get("bloom") if raw.get("bloom") in BLOOMS else None}
    try:
        q = QuestionIn(**q, card_ids=["-"]).model_dump(exclude={"card_ids", "space_id"})
        q = question_fields(q)
        validate_question(q)
    except (ValidationError, HTTPException):
        return None
    return q


def draft_questions_for_card(card: dict, rev: int | None, user: dict, n: int = 2) -> list[dict]:
    """Sinh `n` câu hỏi NHÁP cho một thẻ (đã kiểm tra quyền ở nơi gọi), lưu vào `questions`, trả bản ghi đã lưu.

    Cho luồng F: gọi sau khi thẻ bậc `thuc-thi` / `van-hanh` được duyệt, `user` = người duyệt (người xác nhận câu).
    Lỗi AI -> ném AINotReady / AIRetryLater / ValueError (F nên bắt và bỏ qua, không chặn việc duyệt thẻ).
    Loại thẻ không có trong bảng 17.6 -> HTTPException 400; thẻ C3 -> HTTPException 403 (không gửi AI ngoài)."""
    check_not_c3(card)
    n = max(1, min(MAX_N, n))
    kinds = kinds_for(card.get("type"), n)
    hint = KIND_BY_TYPE[card["type"]][1]
    rev = rev or card.get("current_revision") or 1
    text = (f"Soạn {n} câu hỏi, kind lần lượt: {', '.join(kinds)}. Dạng câu hợp loại thẻ: {hint}.\n\n"
            f"<the>\n{card_text(card)}\n</the>")
    data, engine = ai_call(SYSTEM, text, question_schema(), lambda: fake_questions(card, kinds))
    raw = data.get("questions") or []
    space = question_space(card, user)
    now = db.now()
    out = []
    for i, kind in enumerate(kinds):
        # kind do hệ thống quyết theo bảng 17.6; AI trả kind khác thì vẫn ép theo bảng (câu sai luật bị bỏ)
        q = clean_question(raw[i], kind) if i < len(raw) else None
        if not q:
            continue
        q |= {"card_refs": [{"card_id": card["_id"], "rev": rev}],
              "classification": policy.inherit_classification([card]), "space_id": space["_id"],
              "status": "draft", "origin": "ai", "ai": {"engine": engine, "card_type": card.get("type")},
              "created_by": user["_id"], "approved_by": None, "approved_at": None, "created_at": now,
              "updated_at": now}
        q["_id"] = questions.insert_one(q).inserted_id
        out.append(q)
    return out
