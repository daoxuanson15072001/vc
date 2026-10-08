"""Ghi chép theo nguồn và từng đơn vị (WK-45 — docs/BA.md mục 4.5, DESIGN Phần II mục 12).

Mỗi nguồn (kênh, album, thư mục…) và mỗi tài liệu trong nguồn (một video, một file…) có nhiều ghi chép của người
dùng: `kb_notes {space_id, source_id, doc_id (None = cả nguồn), text, t (giây, video / ghi âm), created_by,
created_at, updated_at}`. "Ghi chú của người nạp" (WK-44, `kb_sources.note`) giữ nguyên chỗ cũ — màn ghi chép hiện
nó như một mục loại *Khi nạp*.

Module này chỉ giữ dữ liệu (không kiểm quyền — quyền ở `policy.py`, API ở `kb/note_routes.py`) để `wiki.py`,
`synth.py`, `pipeline.py`, MCP dùng được mà không vòng import.
"""

from __future__ import annotations

from .. import db

notes = db.db["kb_notes"]

TEXT_MAX = 2000      # một ghi chép, như ghi chú của người nạp (wiki.NOTE_MAX)
T_MAX = 24 * 3600    # mốc thời gian tối đa (giây)
PROMPT_LIMIT = 200   # số ghi chép tối đa đọc cho một prompt (còn cắt theo số ký tự ở wiki.user_notes_block)


def ensure_indexes() -> None:
    notes.create_index([("space_id", 1), ("created_at", -1)])
    notes.create_index([("source_id", 1), ("doc_id", 1), ("created_at", -1)])
    notes.create_index([("created_by", 1), ("created_at", -1)])


def for_prompt(source_id, doc_ids=()) -> list[dict]:
    """Ghi chép cả nguồn + ghi chép của các tài liệu `doc_ids`, mới nhất trước."""
    return list(notes.find({"source_id": source_id, "$or": [{"doc_id": None}, {"doc_id": {"$in": list(doc_ids)}}]},
                           {"doc_id": 1, "text": 1, "t": 1, "created_at": 1})
                .sort([("created_at", -1), ("_id", -1)]).limit(PROMPT_LIMIT))


def of_source(source_id, limit: int = 500) -> list[dict]:
    return list(notes.find({"source_id": source_id}).sort([("created_at", -1), ("_id", -1)]).limit(limit))


def count_by_doc(source_id) -> dict:
    """{doc_id | None: số ghi chép} của một nguồn (None = ghi chép cả nguồn)."""
    return {r["_id"]: r["n"] for r in notes.aggregate([
        {"$match": {"source_id": source_id}}, {"$group": {"_id": "$doc_id", "n": {"$sum": 1}}}])}


def delete_for_source(source_id) -> int:
    return notes.delete_many({"source_id": source_id}).deleted_count


def delete_for_document(doc_id) -> int:
    return notes.delete_many({"doc_id": doc_id}).deleted_count
