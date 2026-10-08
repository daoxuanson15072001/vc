"""Lịch sử phiên bản thẻ VCWIKI (GOV-01, GOV-07 — docs/BA.md mục 16.5).

`card_revisions`: card_id, rev (1, 2, 3…), snapshot (toàn bộ trường nội dung + classification), change_request_id,
reason, author_id, approved_by[], created_at. **Chỉ ghi thêm — không sửa, không xoá** (module này không có lệnh
update / delete nào trên `card_revisions`). Rollback = tạo phiên bản mới mang nội dung bản cũ.

Hàm công khai (luồng F gọi khi duyệt đề xuất — giữ chữ ký ổn định):

- `snapshot(card)` — chụp nội dung thẻ theo `SNAPSHOT_FIELDS`.
- `record_revision(card, author_id, reason, change_request_id=None, approved_by=None, change_kind=None)` — ghi bản
  mới `rev = max + 1`; `change_kind` (minor / major, BA 16.3) ghi thẳng vào bản ghi phiên bản.
- `list_revisions(card_id)`, `get_revision(card_id, rev)`, `diff(card_id, from_rev, to_rev)`.
- `rollback(card, rev, user, reason)` — tạo bản mới mang nội dung bản `rev` + áp nội dung đó vào thẻ.
- `migrate_existing(force=False)` — chuyển thẻ cũ thành bản 1 (cờ `meta` `gov_revisions_v1`).

Giới hạn đợt 1 (luồng C không được sửa `kb/routes.py`): tạo thẻ / sửa / duyệt qua web và MCP **chưa** tự ghi phiên
bản. Thẻ tạo sau lần chuyển dữ liệu chưa có bản nào (`list_revisions` trả rỗng) cho tới khi luồng F nối
`record_revision` vào luồng duyệt (đợt 2). Nội dung sửa trực tiếp chưa có phiên bản được `rollback` ghi lại thành một
bản trước khi quay về, để không mất.
"""

from __future__ import annotations

import difflib
from typing import Any

from bson import ObjectId
from fastapi import HTTPException
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

from .. import db
from . import classify, embeddings

card_revisions = db.db["card_revisions"]
cards = db.db["wiki_cards"]
meta = db.db["meta"]

# Trường nội dung của thẻ được chụp vào snapshot (thay đổi ở đây phải qua điều phối)
SNAPSHOT_FIELDS = ("type", "title", "summary", "body", "key_points", "when_to_use", "example", "evidence",
                   "tags", "categories", "sources", "classification", "owner_unit_id",
                   "level", "division", "process_steps",   # trục phân loại v2 (WK-27)
                   "effective_at", "review_cycle_months")  # kiểm soát tài liệu (BA 16.6); next_review_at tính lại

# Nhãn tiếng Việt cho màn hình so sánh
FIELD_LABELS = {"type": "Loại thẻ", "title": "Tiêu đề", "summary": "Tóm tắt", "body": "Nội dung chi tiết",
                "key_points": "Ý chính", "when_to_use": "Khi nào dùng", "example": "Ví dụ", "evidence": "Căn cứ",
                "tags": "Tag", "categories": "Lĩnh vực", "sources": "Tài liệu nguồn", "classification": "Mức mật",
                "owner_unit_id": "Đơn vị sở hữu", "level": "Cấp độ", "division": "Division",
                "process_steps": "Bước quy trình", "effective_at": "Ngày hiệu lực",
                "review_cycle_months": "Chu kỳ rà soát (tháng)"}

MIGRATION_FLAG = "gov_revisions_v1"
MIGRATION_REASON = "Phiên bản đầu (chuyển dữ liệu v0.10)"
UNVERSIONED_REASON = "Ghi lại nội dung đang có (sửa trực tiếp, chưa có phiên bản) trước khi quay về bản cũ"
_RETRIES = 20


def ensure_indexes() -> None:
    card_revisions.create_index([("card_id", ASCENDING), ("rev", DESCENDING)], unique=True)
    card_revisions.create_index("change_request_id")


# ---------------------------------------------------------------------------
# Ghi phiên bản
# ---------------------------------------------------------------------------

def snapshot(card: dict) -> dict:
    """Nội dung thẻ theo `SNAPSHOT_FIELDS`. Trường thẻ không có thì snapshot cũng không có (rollback gỡ trường đó)."""
    return {f: card[f] for f in SNAPSHOT_FIELDS if f in card}


def _latest_rev(card_id: ObjectId) -> int:
    last = card_revisions.find_one({"card_id": card_id}, {"rev": 1}, sort=[("rev", DESCENDING)])
    return last["rev"] if last else 0


def record_revision(card: dict, author_id: ObjectId | None, reason: str, change_request_id: ObjectId | None = None,
                    approved_by: list[ObjectId] | None = None, change_kind: str | None = None) -> dict:
    """Ghi phiên bản mới `rev = max + 1` với nội dung `snapshot(card)` — `card` là nội dung hiệu lực mới
    (đã hoặc sắp áp vào `wiki_cards`; hàm này không đổi nội dung thẻ).

    Chỉ ghi thêm. Hai lượt ghi cùng lúc cho một thẻ: unique index `card_id + rev` chặn trùng, lượt thua lấy số kế
    tiếp. Sau khi ghi, `wiki_cards.current_revision` và `version` được nâng lên `rev` (dùng `$max` nên không bao giờ
    lùi dù hai lượt hoàn tất lệch thứ tự). `change_kind` (minor / major — BA 16.3) có thì ghi cùng lượt chèn, không
    cập nhật sau (giữ "chỉ ghi thêm"). Trả về bản ghi phiên bản vừa tạo.
    """
    reason = (reason or "").strip()
    if not reason:
        raise HTTPException(400, "Cần ghi lý do cho phiên bản")
    base = {"card_id": card["_id"], "snapshot": snapshot(card), "change_request_id": change_request_id,
            "reason": reason, "author_id": author_id, "approved_by": list(approved_by or [])}
    if change_kind:
        if change_kind not in ("minor", "major"):
            raise ValueError(f"change_kind không hợp lệ: {change_kind}")
        base["change_kind"] = change_kind
    rev = _latest_rev(card["_id"]) + 1
    for _ in range(_RETRIES):
        doc = base | {"rev": rev, "created_at": db.now()}
        try:
            doc["_id"] = card_revisions.insert_one(doc).inserted_id
        except DuplicateKeyError:
            rev = max(rev + 1, _latest_rev(card["_id"]) + 1)
            continue
        cards.update_one({"_id": card["_id"]}, {"$max": {"current_revision": rev, "version": rev}})
        return doc
    raise HTTPException(409, "Thẻ đang được ghi phiên bản cùng lúc, thử lại sau")


# ---------------------------------------------------------------------------
# Đọc
# ---------------------------------------------------------------------------

def list_revisions(card_id: ObjectId) -> list[dict]:
    """Mọi phiên bản của thẻ, mới nhất trước, không kèm snapshot. Thẻ chưa có bản nào → []."""
    return list(card_revisions.find({"card_id": card_id}, {"snapshot": 0}).sort("rev", DESCENDING))


def get_revision(card_id: ObjectId, rev: int) -> dict | None:
    """Một phiên bản (kèm snapshot) hoặc None."""
    return card_revisions.find_one({"card_id": card_id, "rev": rev})


def _as_lines(value: Any) -> list[str] | None:
    """Trường văn bản / danh sách chữ → các dòng để so theo dòng; kiểu khác → None (so nguyên giá trị)."""
    if value is None:
        return []
    if isinstance(value, str):
        return value.splitlines()
    if isinstance(value, list) and all(isinstance(x, str) for x in value):
        return list(value)
    return None


def _line_diff(a: list[str], b: list[str]) -> list[dict]:
    """[{op: equal | delete | insert, text}] theo thứ tự đọc (dòng xoá đứng trước dòng thêm)."""
    out: list[dict] = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal":
            out += [{"op": "equal", "text": t} for t in a[i1:i2]]
            continue
        out += [{"op": "delete", "text": t} for t in a[i1:i2]]
        out += [{"op": "insert", "text": t} for t in b[j1:j2]]
    return out


def diff_snapshots(before: dict, after: dict) -> list[dict]:
    """So từng trường của hai snapshot, chỉ trả trường có thay đổi, theo thứ tự `SNAPSHOT_FIELDS`.

    Trường văn bản / danh sách chữ: `{field, label, kind: "lines", lines: [{op, text}], added, removed}`.
    Trường khác (vd `sources`, `owner_unit_id`): `{field, label, kind: "value", before, after}`.
    """
    out = []
    for f in SNAPSHOT_FIELDS:
        a, b = before.get(f), after.get(f)
        if a == b or (a in (None, "", []) and b in (None, "", [])):
            continue
        la, lb = _as_lines(a), _as_lines(b)
        if la is not None and lb is not None:
            lines = _line_diff(la, lb)
            out.append({"field": f, "label": FIELD_LABELS.get(f, f), "kind": "lines", "lines": lines,
                        "added": sum(x["op"] == "insert" for x in lines),
                        "removed": sum(x["op"] == "delete" for x in lines)})
        else:
            out.append({"field": f, "label": FIELD_LABELS.get(f, f), "kind": "value", "before": a, "after": b})
    return out


def diff(card_id: ObjectId, from_rev: int, to_rev: int) -> dict:
    """So hai phiên bản của thẻ: `{from, to, changes: diff_snapshots(...)}`. Thiếu phiên bản → 404."""
    a, b = get_revision(card_id, from_rev), get_revision(card_id, to_rev)
    missing = [str(r) for r, d in ((from_rev, a), (to_rev, b)) if not d]
    if missing:
        raise HTTPException(404, f"Không tìm thấy phiên bản {', '.join(missing)}")
    return {"from": from_rev, "to": to_rev, "changes": diff_snapshots(a["snapshot"], b["snapshot"])}


def has_unversioned_changes(card: dict) -> bool:
    """Nội dung thẻ khác bản hiệu lực (sửa trực tiếp khi chưa có luồng đề xuất). Thẻ chưa có bản nào → False."""
    if not card.get("current_revision"):
        return False
    cur = get_revision(card["_id"], card["current_revision"])
    return bool(cur) and bool(diff_snapshots(cur["snapshot"], snapshot(card)))


# ---------------------------------------------------------------------------
# Rollback
# ---------------------------------------------------------------------------

def _apply_snapshot(card: dict, snap: dict) -> dict:
    """Đặt nội dung thẻ = snapshot (trường snapshot không có thì gỡ khỏi thẻ). Trả thẻ sau khi áp."""
    from .pipeline import card_search_text   # nhập muộn: pipeline nặng, chỉ cần khi áp nội dung

    new = {k: v for k, v in card.items() if k not in SNAPSHOT_FIELDS} | snap
    upd: dict = {"$set": snap | {"updated_at": db.now(), "search_text": card_search_text(new)}}
    unset = {f: "" for f in SNAPSHOT_FIELDS if f not in snap and f in card}
    # ngày rà soát suy ra từ ngày hiệu lực + chu kỳ của nội dung vừa áp
    if nxt := classify.next_review_at(new.get("effective_at"), new.get("review_cycle_months")):
        upd["$set"]["next_review_at"] = nxt
    elif "next_review_at" in card:
        unset["next_review_at"] = ""
    if unset:
        upd["$unset"] = unset
    cards.update_one({"_id": card["_id"]}, upd)
    embeddings.schedule([card["_id"]])
    return cards.find_one({"_id": card["_id"]})


def rollback(card: dict, rev: int, user: dict, reason: str) -> dict:
    """Quay thẻ về nội dung phiên bản `rev`: tạo **phiên bản mới** (max + 1) mang snapshot của bản `rev` và áp nội
    dung đó vào `wiki_cards`. Không xoá / sửa bản nào. Bắt buộc `reason`. Kiểm tra quyền (`card.rollback`) là việc
    của nơi gọi.

    Nếu thẻ đang có nội dung sửa trực tiếp chưa ghi phiên bản, nội dung đó được ghi thành một bản trước
    (lý do `UNVERSIONED_REASON`) để lịch sử không mất gì.

    Trả `{"card": thẻ sau khi áp, "revision": bản mới}`.
    """
    reason = (reason or "").strip()
    if not reason:
        raise HTTPException(400, "Cần ghi lý do quay về bản cũ")
    target = get_revision(card["_id"], rev)
    if not target:
        raise HTTPException(404, f"Không tìm thấy phiên bản {rev}")
    if has_unversioned_changes(card):
        record_revision(card, user["_id"], UNVERSIONED_REASON)
        card = cards.find_one({"_id": card["_id"]})
    elif rev == card.get("current_revision"):
        raise HTTPException(400, "Thẻ đang ở đúng phiên bản này")
    card = _apply_snapshot(card, target["snapshot"])
    revision = record_revision(card, user["_id"], f"Quay về bản {rev}: {reason}", approved_by=[user["_id"]])
    return {"card": cards.find_one({"_id": card["_id"]}), "revision": revision}


# ---------------------------------------------------------------------------
# Chuyển dữ liệu một lần (BA 16.5 quy tắc 4) — gọi từ lifespan và backend/scripts/migrate_revisions.py
# ---------------------------------------------------------------------------

def migrate_existing(force: bool = False) -> dict | None:
    """Mọi thẻ chưa có `current_revision` → bản 1 (author = `created_by`, lý do `MIGRATION_REASON`,
    người duyệt = `reviewed_by` nếu thẻ đã duyệt). Cờ `meta._id = "gov_revisions_v1"`; đã chạy thì bỏ qua
    (trừ `force`). Chạy lại / chạy chồng không hỏng dữ liệu: bản 1 chèn qua unique index, trùng thì bỏ qua.
    Trả `{"cards": số thẻ được tạo bản 1}` hoặc None khi đã chạy trước đó.
    """
    if not force and meta.find_one({"_id": MIGRATION_FLAG}):
        return None
    ensure_indexes()
    n = 0
    for card in cards.find({"current_revision": {"$exists": False}}):
        approved = [card["reviewed_by"]] if card.get("status") == "approved" and card.get("reviewed_by") else []
        doc = {"card_id": card["_id"], "rev": 1, "snapshot": snapshot(card), "change_request_id": None,
               "reason": MIGRATION_REASON, "author_id": card.get("created_by"), "approved_by": approved,
               "created_at": card.get("updated_at") or card.get("created_at") or db.now()}
        try:
            card_revisions.insert_one(doc)
            n += 1
        except DuplicateKeyError:
            pass                                   # lượt trước đã tạo bản 1, chỉ còn thiếu con trỏ trên thẻ
        latest = _latest_rev(card["_id"])
        cards.update_one({"_id": card["_id"]}, {"$max": {"current_revision": latest, "version": latest}})
    meta.update_one({"_id": MIGRATION_FLAG}, {"$set": {"at": db.now(), "cards": n}}, upsert=True)
    return {"cards": n}
