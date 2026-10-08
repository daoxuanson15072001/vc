"""Danh sách phát thẻ VCWIKI — gom thẻ để nghe (giọng đọc) và đọc lần lượt, giống playlist YouTube.

- Mỗi danh sách thuộc một người; chỉ người đó sửa được.
- 'private': chỉ chủ xem. 'public': mọi người đăng nhập đều xem / phát được.
- Người xem chỉ thấy những thẻ họ có quyền đọc (theo kho); thẻ đã xoá hoặc ngoài quyền bị ẩn.
"""

from __future__ import annotations

from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING

from .. import db, policy
from ..auth import current_user
from .pipeline import cards
from .routes import load, names_of, oid, space_names

router = APIRouter(prefix="/api")
playlists = db.db["wiki_playlists"]

MAX_ITEMS = 1000   # WK-40, BA 0.48 (Q8): khớp TIMELINE_MAX ở frontend/src/pages/wiki/state.js
Visibility = Literal["private", "public"]
CARD_FIELDS = {"title": 1, "summary": 1, "type": 1, "status": 1, "space_id": 1, "updated_at": 1}


def ensure_indexes() -> None:
    playlists.create_index([("owner_id", ASCENDING), ("updated_at", DESCENDING)])
    playlists.create_index([("visibility", ASCENDING), ("updated_at", DESCENDING)])


class PlaylistIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field("", max_length=2000)
    visibility: Visibility = "private"
    card_ids: list[str] = Field(default_factory=list, max_length=MAX_ITEMS)


class PlaylistPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = Field(None, max_length=2000)
    visibility: Visibility | None = None
    card_ids: list[str] | None = Field(None, max_length=MAX_ITEMS)   # thứ tự mới / bỏ bớt thẻ


class ItemIn(BaseModel):
    card_id: str


def get_playlist(pid: str, user: dict, edit: bool = False) -> dict:
    p = playlists.find_one({"_id": oid(pid, "danh sách")})
    mine = bool(p) and p["owner_id"] == user["_id"]
    if not p or not (mine or p.get("visibility") == "public"):
        raise HTTPException(404, "Không tìm thấy danh sách")
    if edit and not mine:
        raise HTTPException(403, "Chỉ người tạo danh sách được sửa")
    return p


def readable_card_ids(ids: list[str], user: dict) -> list[ObjectId]:
    """Giữ thứ tự, bỏ trùng; chỉ thẻ tồn tại và người dùng đọc được."""
    wanted = list(dict.fromkeys(oid(i, "thẻ") for i in ids))
    ok = {c["_id"] for c in cards.find({"_id": {"$in": wanted}} | policy.visible_filter(user), {"_id": 1})}
    missing = [str(i) for i in wanted if i not in ok]
    if missing:
        raise HTTPException(404, f"Không tìm thấy thẻ {missing[0]}")
    return wanted


def summary_out(p: dict, user: dict, owners: dict, first: dict) -> dict:
    ids = [i["card_id"] for i in p.get("items", [])]
    cover = next((first[i] for i in ids if i in first), None)
    return {"id": str(p["_id"]), "name": p["name"], "description": p.get("description", ""),
            "visibility": p.get("visibility", "private"), "count": len(ids),
            "owner_name": owners.get(p["owner_id"]), "can_edit": p["owner_id"] == user["_id"],
            "cover_title": cover, "created_at": p["created_at"], "updated_at": p["updated_at"]}


def summaries(rows: list[dict], user: dict, card_id: ObjectId | None = None) -> list[dict]:
    owners = names_of(p["owner_id"] for p in rows)
    first_ids = [p["items"][0]["card_id"] for p in rows if p.get("items")]
    first = {c["_id"]: c["title"] for c in cards.find({"_id": {"$in": first_ids}}, {"title": 1})}
    out = []
    for p in rows:
        o = summary_out(p, user, owners, first)
        if card_id:
            o["has_card"] = any(i["card_id"] == card_id for i in p.get("items", []))
        out.append(o)
    return out


def detail(p: dict, user: dict) -> dict:
    ids = [i["card_id"] for i in p.get("items", [])]
    found = {c["_id"]: c for c in cards.find({"_id": {"$in": ids}} | policy.visible_filter(user),
                                             CARD_FIELDS)}
    snames = space_names(c["space_id"] for c in found.values())
    items = [{"id": str(c["_id"]), "title": c["title"], "summary": c.get("summary", ""), "type": c.get("type"),
              "status": c.get("status"), "space_name": snames.get(c["space_id"]), "updated_at": c.get("updated_at")}
             for c in (found.get(i) for i in ids) if c]
    return summaries([p], user)[0] | {"items": items, "hidden": len(ids) - len(items)}


@router.get("/playlists")
def list_playlists(scope: Literal["mine", "public"] = "mine", card_id: str | None = None,
                   user: dict = Depends(current_user)):
    """mine: danh sách của tôi (kèm has_card nếu truyền card_id). public: danh sách công khai của người khác."""
    f = {"owner_id": user["_id"]} if scope == "mine" else {"visibility": "public", "owner_id": {"$ne": user["_id"]}}
    rows = list(playlists.find(f).sort("updated_at", DESCENDING).limit(200))
    return summaries(rows, user, oid(card_id, "thẻ") if card_id else None)


@router.post("/playlists", status_code=201)
def create_playlist(body: PlaylistIn, user: dict = Depends(current_user)):
    now = db.now()
    items = [{"card_id": i, "added_at": now} for i in readable_card_ids(body.card_ids, user)]
    p = {"owner_id": user["_id"], "name": body.name.strip(), "description": body.description.strip(),
         "visibility": body.visibility, "items": items, "created_at": now, "updated_at": now}
    p["_id"] = playlists.insert_one(p).inserted_id
    return detail(p, user)


@router.get("/playlists/{pid}")
def get_one(pid: str, user: dict = Depends(current_user)):
    return detail(get_playlist(pid, user), user)


@router.patch("/playlists/{pid}")
def patch_playlist(pid: str, body: PlaylistPatch, user: dict = Depends(current_user)):
    p = get_playlist(pid, user, edit=True)
    changes: dict = {k: v.strip() if isinstance(v, str) else v
                     for k, v in body.model_dump(exclude_none=True, exclude={"card_ids"}).items()}
    if body.card_ids is not None:
        # chỉ sắp xếp lại / bỏ bớt thẻ đã có — thêm thẻ mới đi qua /items để kiểm tra quyền đọc
        added = {i["card_id"]: i["added_at"] for i in p.get("items", [])}
        order = list(dict.fromkeys(oid(i, "thẻ") for i in body.card_ids))
        if any(i not in added for i in order):
            raise HTTPException(400, "Danh sách thẻ chỉ được sắp xếp lại hoặc bỏ bớt")
        # thẻ người sửa không còn quyền đọc (bị ẩn khỏi màn hình) vẫn giữ nguyên ở cuối
        visible = {c["_id"] for c in cards.find({"_id": {"$in": list(added)}} | policy.visible_filter(user), {"_id": 1})}
        order += [i for i in added if i not in visible and i not in order]
        changes["items"] = [{"card_id": i, "added_at": added[i]} for i in order]
    changes["updated_at"] = db.now()
    playlists.update_one({"_id": p["_id"]}, {"$set": changes})
    return detail(playlists.find_one({"_id": p["_id"]}), user)


@router.delete("/playlists/{pid}", status_code=204)
def delete_playlist(pid: str, user: dict = Depends(current_user)):
    playlists.delete_one({"_id": get_playlist(pid, user, edit=True)["_id"]})


@router.post("/playlists/{pid}/items")
def add_item(pid: str, body: ItemIn, user: dict = Depends(current_user)):
    p = get_playlist(pid, user, edit=True)
    card, _ = load(cards, body.card_id, user, "card.read", "thẻ")
    if any(i["card_id"] == card["_id"] for i in p.get("items", [])):
        return {"ok": True, "added": False}
    if len(p.get("items", [])) >= MAX_ITEMS:
        raise HTTPException(400, f"Mỗi danh sách tối đa {MAX_ITEMS} thẻ")
    now = db.now()
    playlists.update_one({"_id": p["_id"], "items.card_id": {"$ne": card["_id"]}},
                         {"$push": {"items": {"card_id": card["_id"], "added_at": now}}, "$set": {"updated_at": now}})
    return {"ok": True, "added": True}


@router.delete("/playlists/{pid}/items/{card_id}", status_code=204)
def remove_item(pid: str, card_id: str, user: dict = Depends(current_user)):
    p = get_playlist(pid, user, edit=True)
    playlists.update_one({"_id": p["_id"]}, {"$pull": {"items": {"card_id": oid(card_id, "thẻ")}},
                                             "$set": {"updated_at": db.now()}})
