"""Tag đồng bộ giữa Kho tư liệu và VCWIKI — một bộ từ vựng (db.clean_tags) cho video, tài liệu và thẻ.

- Tài liệu (kb_documents) là đơn vị nhỏ nhất mang tag. Tài liệu mới nhận tag của nguồn và của video gốc.
- Tài liệu → thẻ: thẻ dựng từ tài liệu thừa kế tag của nó; thêm / bớt tag trên tài liệu thì thêm / bớt đúng
  tag đó trên mọi thẻ dẫn về tài liệu (document_id, hoặc trích dẫn trong `sources` của thẻ tổng hợp).
  Tag riêng của thẻ (AI đặt, người sửa) giữ nguyên.
- Thẻ → tài liệu: không chép ngược. Lọc tài liệu theo tag thì tính cả tag của các thẻ dẫn về nó — tính lúc
  truy vấn, không lưu bản sao nên không bao giờ lệch.
- Video: tag thuộc về chính video. Tài liệu chuyển chữ từ video (meta.video_id) luôn cùng tag với bảng
  `videos` và với các tài liệu khác của cùng video (cùng một video nạp ở nhiều kho).
"""

from __future__ import annotations

from .. import db
from . import card_search
from .pipeline import card_search_text, cards, documents


def linked_cards(doc_ids: list) -> dict:
    """Bộ lọc thẻ dẫn về các tài liệu."""
    return {"$or": [{"document_id": {"$in": doc_ids}}, {"sources.document_id": {"$in": doc_ids}}]}


def inherit(card_tags, doc_ids) -> list[str]:
    """Tag cho thẻ mới: tag riêng của thẻ + tag của các tài liệu gốc."""
    tags = list(card_tags or [])
    for d in documents.find({"_id": {"$in": [i for i in doc_ids if i]}}, {"tags": 1}):
        tags += d.get("tags") or []
    return db.clean_tags(tags)


def _delta(old: list[str], new: list[str]) -> tuple[list[str], list[str]]:
    return [t for t in new if t not in old], [t for t in old if t not in new]


def _change(coll, f: dict, added: list[str], removed: list[str]) -> None:
    # $pull và $addToSet cùng một trường không đi chung một lệnh được
    if removed:
        coll.update_many(f, {"$pull": {"tags": {"$in": removed}}})
    if added:
        coll.update_many(f, {"$addToSet": {"tags": {"$each": added}}})


def _change_documents(doc_ids: list, added: list[str], removed: list[str]) -> None:
    if not doc_ids or not (added or removed):
        return
    _change(documents, {"_id": {"$in": doc_ids}}, added, removed)
    _change(cards, linked_cards(doc_ids), added, removed)
    touched = []
    for c in cards.find(linked_cards(doc_ids), {"title": 1, "summary": 1, "body": 1, "tags": 1}):
        cards.update_one({"_id": c["_id"]}, {"$set": {"search_text": card_search_text(c)}})
        touched.append(c["_id"])
    card_search.touch(touched)   # tag đổi, updated_at giữ nguyên -> chỉ mục chữ đọc lại


def _change_video(video_id: str, added: list[str], removed: list[str]) -> None:
    _change(db.videos, {"_id": video_id}, added, removed)
    _change_documents([d["_id"] for d in documents.find({"meta.video_id": video_id}, {"_id": 1})], added, removed)


def set_document_tags(doc: dict, tags) -> list[str]:
    """Đặt tag cho một tài liệu và lan sang thẻ (và video gốc nếu có). Trả về tag mới của tài liệu."""
    new = db.clean_tags(tags)
    added, removed = _delta(doc.get("tags") or [], new)
    if vid := (doc.get("meta") or {}).get("video_id"):
        _change_video(vid, added, removed)
    else:
        _change_documents([doc["_id"]], added, removed)
    return new


def set_video_tags(video: dict, tags) -> list[str]:
    """Đặt tag cho một video (Kho video) và lan sang tài liệu / thẻ của nó. Trả về tag mới."""
    new = db.clean_tags(tags)
    _change_video(video["_id"], *_delta(video.get("tags") or [], new))
    return new


def edit(current: list[str], add=None, remove=None) -> list[str]:
    """Thêm / bớt thay vì ghi đè — AI không lỡ tay xoá tag người khác đã gắn."""
    drop = set(db.clean_tags(remove))
    return [t for t in current or [] if t not in drop] + db.clean_tags(add)


def document_filter(tag: str) -> dict:
    """Tài liệu mang tag, hoặc có thẻ dẫn về mang tag đó."""
    tag = (db.clean_tags([tag]) or [""])[0]
    via = set(cards.distinct("document_id", {"tags": tag})) | set(cards.distinct("sources.document_id", {"tags": tag}))
    via.discard(None)
    return {"$or": [{"tags": tag}, {"_id": {"$in": list(via)}}]}


def card_tags_of(doc_ids: list) -> dict:
    """Tag của các thẻ (chưa bị loại) dẫn về từng tài liệu: {doc_id: [tag, ...]}."""
    wanted = set(doc_ids)
    found: dict = {}
    for c in cards.find(linked_cards(doc_ids) | {"status": {"$ne": "rejected"}},
                        {"tags": 1, "document_id": 1, "sources.document_id": 1}):
        for d in {c.get("document_id"), *(s.get("document_id") for s in c.get("sources") or [])} & wanted:
            found.setdefault(d, set()).update(c.get("tags") or [])
    return {d: sorted(t) for d, t in found.items()}


def vocabulary(scope: dict, query: str = "", limit: int = 100) -> list[dict]:
    """Tag đang dùng trong phạm vi kho, kèm số thẻ / tài liệu — để người và AI dùng lại tag có sẵn."""
    rows: dict = {}
    for coll, key in ((cards, "cards"), (documents, "documents")):
        for r in coll.aggregate([{"$match": scope}, {"$unwind": "$tags"},
                                 {"$group": {"_id": "$tags", "n": {"$sum": 1}}}]):
            if isinstance(r["_id"], str):
                rows.setdefault(r["_id"], {"tag": r["_id"], "cards": 0, "documents": 0})[key] = r["n"]
    q = (db.clean_tags([query]) or [""])[0]
    items = [r for r in rows.values() if q in r["tag"]]
    items.sort(key=lambda r: (-(r["cards"] + r["documents"]), r["tag"]))
    return items[:limit]
