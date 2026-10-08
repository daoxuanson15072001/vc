"""Kho (space): dữ liệu và API quản lý kho.

- Kho cá nhân: mỗi người dùng có sẵn một kho, chỉ mình thấy — trừ khi tự chia sẻ.
- Kho chia sẻ: tạo thêm để làm chung với người khác.
- Quyền trong kho: owner (quản lý thành viên) > editor (nạp nguồn, sửa / duyệt thẻ) > viewer (chỉ xem).
- visibility = "org": mọi người trong công ty được xem (như viewer) mà không cần mời.
- unit_grants (SYS-35): chia sẻ cho một đơn vị ORG, quyền viewer / editor, tuỳ chọn gồm đơn vị con —
  `[{unit_id, role, include_children, granted_by, at}]`. Bản ghi cũ thiếu trường coi như `[]` (không cần chuyển dữ liệu).

Mọi quyết định quyền (vai trò trong kho, lọc kho xem được, tra kho + kiểm tra quyền) nằm ở `policy.py` (ORG-10).
Module này chỉ giữ dữ liệu: `policy` đọc collection `spaces` ở đây, các route bên dưới hỏi lại `policy`.
"""

from __future__ import annotations

from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from . import db
from .auth import current_user, public_user, users

spaces = db.db["spaces"]

Role = Literal["owner", "editor", "viewer"]


def ensure_indexes() -> None:
    spaces.create_index("members.user_id")
    spaces.create_index("visibility")
    spaces.create_index("unit_grants.unit_id")


def create_personal_space(user: dict) -> dict:
    doc = {"name": f"Kho của {user['name']}", "description": "", "type": "personal",
           "owner_id": user["_id"], "visibility": "private",
           "members": [{"user_id": user["_id"], "role": "owner", "added_at": db.now()}],
           "created_at": db.now()}
    doc["_id"] = spaces.insert_one(doc).inserted_id
    return doc


def personal_space(user: dict) -> dict:
    s = spaces.find_one({"type": "personal", "owner_id": user["_id"]})
    return s or create_personal_space(user)


def unit_grants_out(space: dict) -> list[dict]:
    """Các đơn vị được chia sẻ kho, kèm tên đơn vị + số người hiện có quyền qua hàng này (người đang làm ở đơn vị,
    cộng đơn vị con cháu khi `include_children`)."""
    rows = space.get("unit_grants") or []
    if not rows:
        return []
    units = {u["_id"]: u for u in org_units.find({"_id": {"$in": [g["unit_id"] for g in rows]}},
                                                  {"name": 1, "code": 1, "active": 1})}
    people = {u["_id"]: u for u in users.find({"_id": {"$in": [g.get("granted_by") for g in rows]}}, {"name": 1})}
    out = []
    for g in rows:
        scope = org.unit_and_descendants(g["unit_id"]) if g.get("include_children") else [g["unit_id"]]
        u = units.get(g["unit_id"]) or {}
        by = people.get(g.get("granted_by"))
        out.append({"unit_id": str(g["unit_id"]), "unit_name": u.get("name", "(đơn vị đã xoá)"),
                    "unit_code": u.get("code"), "unit_active": u.get("active", True) if u else False,
                    "role": g["role"], "include_children": bool(g.get("include_children")),
                    "member_count": users.count_documents(org.ACTIVE_PERSON | {"org.unit_ids": {"$in": scope}}),
                    "granted_by": {"id": str(by["_id"]), "name": by["name"]} if by else None, "at": g.get("at")})
    return out


def space_summary(space: dict, user: dict) -> dict:
    ids = [m["user_id"] for m in space.get("members", [])]
    people = {u["_id"]: u for u in users.find({"_id": {"$in": ids}})}
    return {
        "id": str(space["_id"]),
        "name": space["name"],
        "description": space.get("description", ""),
        "type": space["type"],
        "visibility": space.get("visibility", "private"),
        "owner": public_user(people[space["owner_id"]]) if space["owner_id"] in people else None,
        "my_role": policy.space_role(user, space),
        "can_share_units": policy.can_share_space_units(user, space),
        "members": [{"user": public_user(people[m["user_id"]]), "role": m["role"]}
                    for m in space.get("members", []) if m["user_id"] in people],
        "unit_grants": unit_grants_out(space),
        "counts": {
            "sources": db.db["kb_sources"].count_documents({"space_id": space["_id"]}),
            "cards": db.db["wiki_cards"].count_documents({"space_id": space["_id"]}),
        },
        "created_at": space.get("created_at"),
    }


# ---------------------------------------------------------------------------
# Tương thích: code cũ / code luồng khác đang viết song song vẫn gọi được — code mới gọi thẳng `policy`
# ---------------------------------------------------------------------------

# policy.py đọc collection `spaces` ở trên (policy -> dữ liệu kho); import sau phần dữ liệu để không vòng khi nạp.
from . import org, policy  # noqa: E402
from .org import org_units  # noqa: E402


def get_space(space_id, user: dict, need: Role = "viewer") -> dict:
    """= policy.load_space: 404 khi không có quyền xem (không lộ kho tồn tại), 403 khi thiếu quyền."""
    return policy.load_space(space_id, user, need)


def readable_space_ids(user: dict) -> list[ObjectId]:
    return policy.readable_space_ids(user)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/spaces")


class SpaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field("", max_length=500)
    visibility: Literal["private", "org"] = "private"


class SpacePatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    visibility: Literal["private", "org"] | None = None


class MemberIn(BaseModel):
    email: str
    role: Role = "viewer"


class MemberRole(BaseModel):
    role: Role


# SYS-35: quyền cấp theo đơn vị chỉ Xem / Sửa (quyền Quản lý không cấp theo đơn vị -> 422)
UnitRole = Literal["viewer", "editor"]


class UnitGrantIn(BaseModel):
    unit_id: str
    role: UnitRole = "viewer"
    include_children: bool = False


class UnitGrantPatch(BaseModel):
    role: UnitRole | None = None
    include_children: bool | None = None


@router.get("")
def list_spaces(user: dict = Depends(current_user)):
    personal_space(user)  # đảm bảo luôn có kho cá nhân
    rows = [space_summary(s, user) for s in spaces.find(policy.visible_spaces_filter(user))]
    order = {"personal": 0, "shared": 1}
    # Kho của tôi trước, rồi kho được chia sẻ / công khai
    rows.sort(key=lambda s: (s["owner"]["id"] != str(user["_id"]) if s["owner"] else True,
                             order[s["type"]], s["name"].lower()))
    return rows


@router.post("", status_code=201)
def create_space(body: SpaceCreate, user: dict = Depends(current_user)):
    doc = body.model_dump() | {"type": "shared", "owner_id": user["_id"], "created_at": db.now(),
                               "members": [{"user_id": user["_id"], "role": "owner", "added_at": db.now()}]}
    doc["_id"] = spaces.insert_one(doc).inserted_id
    return space_summary(doc, user)


@router.get("/{space_id}")
def get_one(space_id: str, user: dict = Depends(current_user)):
    return space_summary(policy.load_space(space_id, user), user)


@router.patch("/{space_id}")
def patch_space(space_id: str, body: SpacePatch, user: dict = Depends(current_user)):
    space = policy.load_space(space_id, user, "space.manage")
    changes = body.model_dump(exclude_none=True)
    if changes:
        spaces.update_one({"_id": space["_id"]}, {"$set": changes})
    return space_summary(spaces.find_one({"_id": space["_id"]}), user)


@router.delete("/{space_id}", status_code=204)
def delete_space(space_id: str, user: dict = Depends(current_user)):
    space = policy.load_space(space_id, user, "space.manage")
    if space["type"] == "personal":
        raise HTTPException(400, "Không xoá được kho cá nhân")
    if db.db["kb_sources"].count_documents({"space_id": space["_id"]}, limit=1) or \
            db.db["wiki_cards"].count_documents({"space_id": space["_id"]}, limit=1):
        raise HTTPException(409, "Kho còn dữ liệu — hãy xoá hoặc chuyển dữ liệu trước")
    spaces.delete_one({"_id": space["_id"]})
    return Response(status_code=204)


@router.post("/{space_id}/members")
def add_member(space_id: str, body: MemberIn, user: dict = Depends(current_user)):
    space = policy.load_space(space_id, user, "space.manage")
    target = users.find_one({"email": body.email.strip().lower(), "active": True})
    if not target:
        raise HTTPException(404, "Không tìm thấy người dùng với email này")
    if target["_id"] == space["owner_id"]:
        raise HTTPException(400, "Người này là chủ kho")
    spaces.update_one({"_id": space["_id"]}, {"$pull": {"members": {"user_id": target["_id"]}}})
    spaces.update_one({"_id": space["_id"]},
                      {"$push": {"members": {"user_id": target["_id"], "role": body.role, "added_at": db.now()}}})
    return space_summary(spaces.find_one({"_id": space["_id"]}), user)


@router.patch("/{space_id}/members/{user_id}")
def set_member_role(space_id: str, user_id: str, body: MemberRole, user: dict = Depends(current_user)):
    space = policy.load_space(space_id, user, "space.manage")
    uid = _member_oid(space, user_id)
    if body.role == "owner":
        raise HTTPException(400, "Mỗi kho chỉ có một chủ kho")
    spaces.update_one({"_id": space["_id"], "members.user_id": uid}, {"$set": {"members.$.role": body.role}})
    return space_summary(spaces.find_one({"_id": space["_id"]}), user)


@router.delete("/{space_id}/members/{user_id}")
def remove_member(space_id: str, user_id: str, user: dict = Depends(current_user)):
    space = policy.load_space(space_id, user)
    uid = _member_oid(space, user_id)
    # Chủ kho gỡ người khác; thành viên được tự rời kho
    if uid != user["_id"] and not policy.can(user, "space.manage", space):
        raise HTTPException(403, "Chỉ chủ kho được thực hiện")
    spaces.update_one({"_id": space["_id"]}, {"$pull": {"members": {"user_id": uid}}})
    return {"ok": True}


def _member_oid(space: dict, user_id: str) -> ObjectId:
    try:
        uid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(404, "Không tìm thấy thành viên") from None
    if uid == space["owner_id"]:
        raise HTTPException(400, "Không đổi được quyền của chủ kho")
    if not any(m["user_id"] == uid for m in space.get("members", [])):
        raise HTTPException(404, "Không tìm thấy thành viên")
    return uid


# ---------------------------------------------------------------------------
# SYS-35 — chia sẻ kho theo đơn vị (chủ kho + quản trị viên)
# ---------------------------------------------------------------------------

def _space_for_units(space_id: str, user: dict) -> dict:
    """Kho để cấp quyền theo đơn vị: chủ kho hoặc quản trị viên. Người không xem được kho (và không phải quản trị
    viên) -> 404 "không tìm thấy"; xem được mà không phải chủ kho -> 403."""
    try:
        oid = ObjectId(space_id)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Không tìm thấy kho") from None
    space = spaces.find_one({"_id": oid})
    if not space or not (policy.can_share_space_units(user, space) or policy.can(user, "space.read", space)):
        raise HTTPException(404, "Không tìm thấy kho")
    if not policy.can_share_space_units(user, space):
        raise HTTPException(403, "Chỉ chủ kho hoặc quản trị viên được chia sẻ kho cho đơn vị")
    return space


def _unit_oid(unit_id: str) -> ObjectId:
    try:
        return ObjectId(unit_id)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Không tìm thấy đơn vị") from None


def _granted(space: dict, unit_oid: ObjectId) -> bool:
    return any(g["unit_id"] == unit_oid for g in space.get("unit_grants") or [])


@router.get("/{space_id}/units")
def list_unit_grants(space_id: str, user: dict = Depends(current_user)):
    return unit_grants_out(_space_for_units(space_id, user))


@router.post("/{space_id}/units", status_code=201)
def add_unit_grant(space_id: str, body: UnitGrantIn, user: dict = Depends(current_user)):
    space = _space_for_units(space_id, user)
    uid = _unit_oid(body.unit_id)
    if not org_units.find_one({"_id": uid, "active": {"$ne": False}}):
        raise HTTPException(404, "Không tìm thấy đơn vị")
    if _granted(space, uid):
        raise HTTPException(409, "Đơn vị này đã được chia sẻ kho — đổi quyền ở hàng đơn vị")
    spaces.update_one({"_id": space["_id"]}, {"$push": {"unit_grants": {
        "unit_id": uid, "role": body.role, "include_children": body.include_children,
        "granted_by": user["_id"], "at": db.now()}}})
    return unit_grants_out(spaces.find_one({"_id": space["_id"]}))


@router.patch("/{space_id}/units/{unit_id}")
def patch_unit_grant(space_id: str, unit_id: str, body: UnitGrantPatch, user: dict = Depends(current_user)):
    space = _space_for_units(space_id, user)
    uid = _unit_oid(unit_id)
    if not _granted(space, uid):
        raise HTTPException(404, "Đơn vị này chưa được chia sẻ kho")
    changes = {f"unit_grants.$.{k}": v for k, v in body.model_dump(exclude_none=True).items()}
    if changes:
        changes |= {"unit_grants.$.granted_by": user["_id"], "unit_grants.$.at": db.now()}
        spaces.update_one({"_id": space["_id"], "unit_grants.unit_id": uid}, {"$set": changes})
    return unit_grants_out(spaces.find_one({"_id": space["_id"]}))


@router.delete("/{space_id}/units/{unit_id}")
def remove_unit_grant(space_id: str, unit_id: str, user: dict = Depends(current_user)):
    """Gỡ đơn vị: người chỉ có quyền qua đơn vị mất quyền ngay (quyền tính lại ở mỗi lần truy cập)."""
    space = _space_for_units(space_id, user)
    uid = _unit_oid(unit_id)
    if not _granted(space, uid):
        raise HTTPException(404, "Đơn vị này chưa được chia sẻ kho")
    spaces.update_one({"_id": space["_id"]}, {"$pull": {"unit_grants": {"unit_id": uid}}})
    return unit_grants_out(spaces.find_one({"_id": space["_id"]}))
