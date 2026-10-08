"""API lịch sử phiên bản thẻ VCWIKI (GOV-01, GOV-07 — docs/BA.md mục 8 dòng "Quản trị tri thức", 16.5).

- `GET  /api/wiki/cards/{id}/revisions`          danh sách phiên bản (mới nhất trước) + quyền rollback
- `GET  /api/wiki/cards/{id}/revisions/{rev}`    một phiên bản kèm nội dung
- `GET  /api/wiki/cards/{id}/diff?from=&to=`     so hai phiên bản (mặc định: bản hiệu lực với bản ngay trước)
- `POST /api/wiki/cards/{id}/rollback` {rev, reason}  quay về nội dung bản cũ = tạo phiên bản mới

Quyền qua `policy`: xem = `card.read`, quay về = `card.rollback`. Không xem được thẻ → 404.
"""

from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from .. import policy
from ..auth import current_user, users
from . import revisions
from .revisions import cards

router = APIRouter(prefix="/api/wiki")


class RollbackIn(BaseModel):
    rev: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=1000)


def _load_card(card_id: str, user: dict) -> dict:
    try:
        card = cards.find_one({"_id": ObjectId(card_id)})
    except (InvalidId, TypeError):
        card = None
    if not card or card.get("delete_requested"):
        raise HTTPException(404, "Không tìm thấy thẻ")
    policy.require(user, "card.read", card, "thẻ")
    return card


def _plain(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, list):
        return [_plain(x) for x in v]
    if isinstance(v, dict):
        return {k: _plain(x) for k, x in v.items()}
    return v


def _names(ids) -> dict:
    ids = {i for i in ids if i}
    return {u["_id"]: u["name"] for u in users.find({"_id": {"$in": list(ids)}}, {"name": 1})} if ids else {}


def _revision_out(r: dict, names: dict, current: int | None) -> dict:
    o = {("id" if k == "_id" else k): _plain(v) for k, v in r.items()}
    return o | {"author_name": names.get(r.get("author_id")),
                "approved_by_names": [names.get(u) for u in r.get("approved_by") or [] if names.get(u)],
                "current": r["rev"] == current}


@router.get("/cards/{card_id}/revisions")
def list_card_revisions(card_id: str, user: dict = Depends(current_user)):
    card = _load_card(card_id, user)
    rows = revisions.list_revisions(card["_id"])
    names = _names([r.get("author_id") for r in rows] + [u for r in rows for u in r.get("approved_by") or []])
    return {"items": [_revision_out(r, names, card.get("current_revision")) for r in rows],
            "current_revision": card.get("current_revision"),
            "can_rollback": policy.can(user, "card.rollback", card),
            "has_unversioned_changes": revisions.has_unversioned_changes(card)}


@router.get("/cards/{card_id}/revisions/{rev}")
def get_card_revision(card_id: str, rev: int, user: dict = Depends(current_user)):
    card = _load_card(card_id, user)
    r = revisions.get_revision(card["_id"], rev)
    if not r:
        raise HTTPException(404, f"Không tìm thấy phiên bản {rev}")
    return _revision_out(r, _names([r.get("author_id"), *(r.get("approved_by") or [])]), card.get("current_revision"))


@router.get("/cards/{card_id}/diff")
def diff_card_revisions(card_id: str, from_rev: int | None = Query(None, alias="from", ge=1),
                        to_rev: int | None = Query(None, alias="to", ge=1), user: dict = Depends(current_user)):
    card = _load_card(card_id, user)
    to_rev = to_rev or card.get("current_revision")
    if not to_rev:
        raise HTTPException(404, "Thẻ chưa có lịch sử phiên bản")
    from_rev = from_rev or max(to_rev - 1, 1)
    return revisions.diff(card["_id"], from_rev, to_rev)


@router.post("/cards/{card_id}/rollback")
def rollback_card(card_id: str, body: RollbackIn, user: dict = Depends(current_user)):
    card = _load_card(card_id, user)
    policy.require(user, "card.rollback", card, "thẻ")
    res = revisions.rollback(card, body.rev, user, body.reason)
    from .routes import cards_out   # nhập muộn: tránh vòng import khi routes cần tới revisions (luồng F)
    names = _names([user["_id"]])
    return {"card": cards_out([res["card"]], user)[0],
            "revision": _revision_out(res["revision"], names, res["card"].get("current_revision"))}
