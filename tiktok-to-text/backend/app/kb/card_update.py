"""Cập nhật thẻ VCWIKI khi nội dung tài liệu gốc đổi (vd lấy lại chữ video) — gom 1 lần / ngày, không làm riêng rẽ.

- `pipeline.save_document`: tài liệu đã có thẻ mà chữ đổi -> `card_update = "waiting"` (không đưa về hàng chờ ngay).
- Mỗi ngày lúc CARD_UPDATE_AT (giờ máy chủ, mặc định 07:45) `tick()` thả mọi tài liệu đang chờ vào hàng dựng thẻ
  (`wiki_status = pending`, `card_update = "queued"`). Nút "Ưu tiên xử lý trước" của nguồn thả ngay (`release`).
  07:45 = sau khi job vector đêm (nightly_vectors.sh, 00:30 → dừng êm STOP_AT 07:30) xong: trước đây mặc định 01:00
  rơi giữa job đêm, cả hai xin chỗ ai_slot nên lượt cập nhật thẻ (tinh_che) vẫn phải chờ vector_tho (ưu tiên cao hơn),
  chen vào giữa các lượt vector thì đổi qua lại gemma ↔ bge-m3. Đổi STOP_AT thì đặt CARD_UPDATE_AT sau giờ đó.
- `pipeline._wiki_next` gặp tài liệu `card_update = "queued"`: thẻ đã duyệt -> AI viết đề xuất sửa vào hộp duyệt
  (`propose_updates`, không sửa thẳng); thẻ nháp AI -> dựng lại như thường, AI được báo các thẻ đã có để không viết trùng.
"""

from __future__ import annotations

import traceback
from datetime import datetime

from pymongo.errors import DuplicateKeyError

from .. import db
from ..config import CARD_UPDATE_AT
from . import wiki
from .pipeline import cards, documents, log

AT = CARD_UPDATE_AT   # mặc định 07:45, sau STOP_AT 07:30 của job vector đêm — xem docstring
state = db.db["kb_jobs"]
CONTENT = ("summary", "body", "key_points", "when_to_use", "example")   # AI chỉ đề xuất sửa phần nội dung, giữ tiêu đề

SYSTEM = """Bạn là biên tập viên VCWIKI. Một thẻ tri thức ĐÃ DUYỆT được viết từ một tài liệu; bản chữ của tài liệu
vừa được chuyển lại (vd chuyển chữ lại video). Đọc bản chữ MỚI và so với thẻ:
- Chỉ đề xuất sửa khi bản mới cho thấy thẻ sai, thiếu ý quan trọng, hoặc có chi tiết cụ thể hơn đáng giữ.
- Không sửa câu chữ cho hay hơn, không đổi văn phong; phần không cần sửa thì giữ NGUYÊN VĂN như thẻ hiện tại.
- Không có gì đáng sửa -> changed = false.
Trả lời bằng tiếng Việt."""

SCHEMA = {
    "type": "object",
    "properties": {
        "changed": {"type": "boolean"},
        "reason": {"type": "string", "description": "Vì sao cần sửa (1-2 câu) — người duyệt đọc"},
        "summary": {"type": "string"},
        "body": {"type": "string"},
        "key_points": {"type": "array", "items": {"type": "string"}},
        "when_to_use": {"type": "string"},
        "example": {"type": "string"},
    },
    "required": ["changed", "reason", *CONTENT],
    "additionalProperties": False,
}


def release(f: dict | None = None) -> int:
    """Thả tài liệu đang chờ cập nhật thẻ vào hàng dựng thẻ (lọc thêm theo `f`, vd {"source_id": …})."""
    return documents.update_many((f or {}) | {"card_update": "waiting"}, {"$set": {
        "card_update": "queued", "wiki_status": "pending", "wiki_error": None, "wiki_retry_at": None}}).modified_count


def tick(now: datetime | None = None) -> int:
    """Gọi thường xuyên (luồng nền): qua giờ CARD_UPDATE_AT mà hôm nay chưa chạy -> thả một lượt. Trả số tài liệu."""
    now = now or datetime.now()
    h, m = (int(x) for x in AT.split(":"))
    today = now.strftime("%Y-%m-%d")
    if (now.hour, now.minute) < (h, m):
        return 0
    try:   # đánh dấu "hôm nay đã chạy" nguyên tử — hai tiến trình không thả hai lần
        res = state.update_one({"_id": "card_update", "last_day": {"$ne": today}},
                               {"$set": {"last_day": today, "ran_at": db.now()}}, upsert=True)
    except DuplicateKeyError:
        return 0   # hôm nay đã chạy
    if not (res.modified_count or res.upserted_id):
        return 0
    return release()


def waiting(source_id) -> int:
    return documents.count_documents({"source_id": source_id, "card_update": "waiting"})


def propose_updates(doc: dict, src: dict) -> int:
    """Thẻ đã duyệt của tài liệu -> đề xuất sửa (origin "ai") vào hộp duyệt. Đề xuất AI cũ còn mở của thẻ được rút
    (bản chữ mới hơn). Trả số đề xuất tạo mới. Lỗi AI để nguyên cho pipeline xử lý (thử lại sau)."""
    from . import changes   # nhập muộn: changes -> novelty -> pipeline
    n = 0
    for card in cards.find({"document_id": doc["_id"], "status": "approved", "obsolete": {"$ne": True}}):
        current = {k: card.get(k) or ([] if k == "key_points" else "") for k in CONTENT}
        content = (f"<the_hien_tai>\nTiêu đề: {card['title']}\n"
                   + "\n".join(f"{k}: {v}" for k, v in current.items())
                   + f"\n</the_hien_tai>\n\n<ban_chu_moi>\n{doc['text']}\n</ban_chu_moi>")
        res = wiki.structured_call(SYSTEM, content, SCHEMA, max_tokens=8000)
        if not res.get("changed"):
            continue
        proposal = changes._only_changes(card, {k: res[k] for k in CONTENT}, [])
        if not proposal:
            continue
        changes.change_requests.update_many(
            {"card_id": card["_id"], "kind": "update", "origin": "ai", "status": {"$in": list(changes.OPEN)}},
            {"$set": {"status": "withdrawn", "decided_at": db.now(), "updated_at": db.now(),
                      "withdraw_reason": "Có đề xuất mới hơn từ bản chữ mới", "withdrawn_by_system": True}})
        changes.create_change(card, None, "update", proposal,
                              f"Nguồn đã chuyển chữ lại — {res.get('reason') or 'cập nhật theo bản chữ mới'}",
                              origin="ai", author_ai=True)
        n += 1
    if n:
        log(src["_id"], f"→ {n} đề xuất sửa thẻ đã duyệt (chờ duyệt): {doc['title'][:80]}")
    return n


def safe_tick() -> None:
    try:
        tick()
    except Exception:  # noqa: BLE001 — không để luồng nền chết
        traceback.print_exc()
