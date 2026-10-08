"""Cơ cấu tổ chức (ORG — docs/BA.md mục 15): cây đơn vị, chức năng, cây quản lý, vai trò chức năng.

Hai trục:
- Cây đơn vị `org_units`: Tập đoàn (group) → Division → Phòng (department) → Nhóm (team), tối đa 4 tầng.
- Chức năng `org_functions`: Kinh doanh, Marketing, Tài chính – Kế toán… cắt ngang các Division.

Mỗi người (`users.org`): unit_ids (đơn vị chính trước, sau là kiêm nhiệm), function, position,
manager_id (quản lý trực tiếp), functional_manager_id (quản lý chuyên môn), level (cấp bậc 1–7 hoặc null — ORG-05
phần dữ liệu; chưa có luật quyền theo cấp),
status (`active` / `left`).

Vai trò chức năng `grants`: user_id, role, scope {unit_id, category, function}, delegated_from, valid_from, valid_to.
Thu hồi / nghỉ việc không xoá grant — chỉ cho hết hạn (`valid_to` = lúc thu hồi, kèm `revoked_at`, `revoked_by`,
`revoked_reason`); vai trò chuyển cho quản lý khi nghỉ việc ghi `transferred_from`.

Đợt 0 (F0): collection, index, hàm đọc dùng chung. Đợt 1 luồng A: API quản trị ORG-01…04, 06…08 và `GET /tree` (14).
Quyền quản trị hỏi `policy.can(user, "org.manage")`.
"""

from __future__ import annotations

import csv
import io
import re
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Literal

import openpyxl
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field, field_validator
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from . import db
from .auth import current_user, users

org_units = db.db["org_units"]
org_functions = db.db["org_functions"]
org_level_map = db.db["org_level_map"]
grants = db.db["grants"]
access_log = db.db["access_log"]

UnitKind = Literal["group", "division", "department", "team"]
MAX_DEPTH = 4
GrantRole = Literal["editor", "reviewer", "category_owner", "lnd", "doc_control", "auditor"]
GRANT_ROLES: tuple[str, ...] = GrantRole.__args__

# Cấp bậc nhân sự (ORG-05 phần dữ liệu, quyết định 26/09/2026) và ánh xạ sang bậc nội dung của thẻ (Phân loại v2
# mục 11): own = mảng của mình (chức năng chính), other = mảng khác. Chỉ dữ liệu — chưa có luật chặn theo cấp.
LEVEL_NAMES = {1: "Thực tập sinh", 2: "Nhân viên", 3: "Key staff", 4: "Leader", 5: "Trưởng phòng", 6: "Giám đốc",
               7: "Tổng giám đốc"}
CONTENT_LEVELS = ("dieu-hanh", "thiet-ke", "van-hanh", "thuc-thi", "nhap-mon")   # = kb/classify.LEVELS
DEFAULT_LEVEL_MAP = {
    1: {"own": ["nhap-mon"], "other": ["nhap-mon"]},
    2: {"own": ["thuc-thi"], "other": ["nhap-mon"]},
    3: {"own": ["thuc-thi", "van-hanh"], "other": ["nhap-mon"]},
    4: {"own": ["van-hanh"], "other": ["thuc-thi"]},
    5: {"own": ["van-hanh", "thiet-ke"], "other": ["van-hanh"]},
    6: {"own": ["thiet-ke"], "other": ["dieu-hanh"]},
    7: {"own": ["dieu-hanh", "thiet-ke"], "other": ["dieu-hanh"]},
}
LEVEL_MAP_ID = "default"


def ensure_indexes() -> None:
    org_units.create_index("code", unique=True)
    org_units.create_index("parent_id")
    org_units.create_index("path")
    org_functions.create_index("code", unique=True)
    users.create_index("org.unit_ids")
    users.create_index("org.manager_id")
    users.create_index("org.functional_manager_id")
    users.create_index("org.function")
    grants.create_index([("user_id", ASCENDING), ("role", ASCENDING)])
    grants.create_index("scope.unit_id")
    access_log.create_index([("at", ASCENDING)])
    access_log.create_index([("user_id", ASCENDING), ("at", ASCENDING)])
    access_log.create_index([("target.kind", ASCENDING), ("target.id", ASCENDING)])


# ---------------------------------------------------------------------------
# Đọc dữ liệu tổ chức — dùng chung cho policy.py và các phân hệ
# ---------------------------------------------------------------------------

def user_org(user: dict) -> dict:
    """Hồ sơ tổ chức của một người; người chưa được xếp vào tổ chức nhận hồ sơ rỗng."""
    o = user.get("org") or {}
    return {"unit_ids": o.get("unit_ids") or [], "function": o.get("function"), "position": o.get("position"),
            "manager_id": o.get("manager_id"), "functional_manager_id": o.get("functional_manager_id"),
            "level": o.get("level"), "status": o.get("status", "active")}


def unit_and_descendants(unit_id: ObjectId) -> list[ObjectId]:
    """Đơn vị + mọi đơn vị con cháu (`path` chứa mã tổ tiên)."""
    return [unit_id, *(u["_id"] for u in org_units.find({"path": unit_id}, {"_id": 1}))]


def user_unit_scope(user: dict) -> list[ObjectId]:
    """Các đơn vị người này thuộc về (chính + kiêm nhiệm), gồm cả đơn vị con của chúng."""
    out: list[ObjectId] = []
    for uid in user_org(user)["unit_ids"]:
        out.extend(unit_and_descendants(uid))
    return list(dict.fromkeys(out))


def subordinate_ids(user_id: ObjectId, direct_only: bool = False,
                    field: Literal["manager_id", "functional_manager_id"] = "manager_id") -> list[ObjectId]:
    """Người dưới quyền theo cây quản lý (mọi tầng, trừ khi direct_only). Chống vòng lặp bằng tập đã thăm."""
    seen: set[ObjectId] = set()
    frontier = [user_id]
    while frontier:
        rows = users.find({f"org.{field}": {"$in": frontier}, "active": True}, {"_id": 1})
        frontier = [r["_id"] for r in rows if r["_id"] not in seen and r["_id"] != user_id]
        seen.update(frontier)
        if direct_only or field == "functional_manager_id":   # tuyến chức năng chỉ một tầng
            break
    return list(seen)


def manager_chain(user_id: ObjectId, limit: int = 20) -> list[ObjectId]:
    """Các cấp quản lý phía trên theo tuyến hành chính, gần nhất trước."""
    chain: list[ObjectId] = []
    cur = users.find_one({"_id": user_id}, {"org.manager_id": 1})
    while cur and len(chain) < limit:
        mid = (cur.get("org") or {}).get("manager_id")
        if not mid or mid in chain or mid == user_id:
            break
        chain.append(mid)
        cur = users.find_one({"_id": mid}, {"org.manager_id": 1})
    return chain


def active_grants(user: dict, role: str | None = None) -> list[dict]:
    """Vai trò chức năng còn hiệu lực của người (kể cả được uỷ quyền)."""
    t = db.now()
    f = {"user_id": user["_id"],
         "$and": [{"$or": [{"valid_from": None}, {"valid_from": {"$lte": t}}]},
                  {"$or": [{"valid_to": None}, {"valid_to": {"$gt": t}}]}]}
    if role:
        f["role"] = role
    return list(grants.find(f))


def log_access(user: dict, channel: str, action: str, kind: str, target_id, classification: str | None = None) -> None:
    """Nhật ký truy cập (ORG-11). Luồng G quyết định lúc nào gọi."""
    access_log.insert_one({"user_id": user["_id"], "channel": channel, "action": action,
                           "target": {"kind": kind, "id": target_id}, "classification": classification,
                           "at": db.now()})

# ---------------------------------------------------------------------------
# API — hợp đồng chốt ở docs/BA.md mục 8
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/org")

CODE_RE = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)*$")
FUNCTION_CODE_RE = re.compile(r"^[a-z0-9]+(?:[_-][a-z0-9]+)*$")
KIND_RANK = {"group": 0, "division": 1, "department": 2, "team": 3}
KIND_LABEL = {"group": "Tập đoàn", "division": "Division", "department": "Phòng", "team": "Nhóm"}
ACTIVE_PERSON = {"active": True, "org.status": {"$ne": "left"}}


def require_org_admin(user: dict = Depends(current_user)) -> dict:
    from . import policy   # policy.py nhập org.py — nhập muộn để tránh vòng import
    if not policy.can(user, "org.manage"):
        raise HTTPException(403, "Chỉ quản trị viên được sửa cơ cấu tổ chức")
    return user


def _oid(value, what: str, status: int = 404) -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status, f"Không tìm thấy {what}") from None


def _sid(v) -> str | None:
    return str(v) if v else None


def _people(ids) -> dict[ObjectId, dict]:
    ids = [i for i in ids if i]
    return {u["_id"]: {"id": str(u["_id"]), "name": u["name"], "email": u["email"]}
            for u in users.find({"_id": {"$in": ids}}, {"name": 1, "email": 1})} if ids else {}


def _get_unit(unit_id) -> dict:
    u = org_units.find_one({"_id": _oid(unit_id, "đơn vị")})
    if not u:
        raise HTTPException(404, "Không tìm thấy đơn vị")
    return u


def _working(u: dict) -> bool:
    return u.get("active", True) and user_org(u)["status"] != "left"


def _active_user(user_id, what: str = "người dùng") -> dict:
    u = users.find_one({"_id": _oid(user_id, what, 400)})
    if not u:
        raise HTTPException(400, f"Không tìm thấy {what}")
    if not _working(u):
        raise HTTPException(400, f"{u['name']} đã khoá tài khoản hoặc đã nghỉ việc")
    return u


def _not_blank(v: str | None, label: str) -> str | None:
    """Bỏ khoảng trắng đầu / cuối; chỉ toàn khoảng trắng -> lỗi 422 nêu rõ trường (QA B5)."""
    if v is None:
        return None
    v = v.strip()
    if not v:
        raise ValueError(f"{label} không được để trống")
    return v


def _check_function(code: str | None) -> str | None:
    code = (code or "").strip()
    if not code:
        return None
    f = org_functions.find_one({"code": code})
    if not f or not f.get("active", True):
        raise HTTPException(400, f"Chức năng “{code}” không có trong danh mục (hoặc đã ẩn)")
    return code


def _member_counts() -> dict[ObjectId, int]:
    rows = users.aggregate([{"$match": ACTIVE_PERSON}, {"$unwind": "$org.unit_ids"},
                            {"$group": {"_id": "$org.unit_ids", "n": {"$sum": 1}}}])
    return {r["_id"]: r["n"] for r in rows}


def _unit_out(u: dict, counts: dict | None = None, heads: dict | None = None) -> dict:
    return {"id": str(u["_id"]), "code": u["code"], "name": u["name"], "kind": u["kind"],
            "parent_id": _sid(u.get("parent_id")), "path": [str(x) for x in u.get("path") or []],
            "depth": len(u.get("path") or []) + 1, "function": u.get("function"),
            "head_id": _sid(u.get("head_id")), "head": (heads or {}).get(u.get("head_id")),
            "active": u.get("active", True), "order": u.get("order", 0),
            "member_count": (counts or {}).get(u["_id"], 0)}


def _sort_key(u: dict):
    return (u.get("order", 0), u["name"].lower())


# ---------------------------------------------------------------------------
# ORG-01 — cây đơn vị
# ---------------------------------------------------------------------------

class UnitIn(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    kind: UnitKind
    parent_id: str | None = None
    function: str | None = None
    head_id: str | None = None
    order: int | None = None

    @field_validator("code")
    @classmethod
    def check_code(cls, v: str) -> str:
        v = v.strip().upper()
        if not CODE_RE.match(v):
            raise ValueError("Mã đơn vị chỉ gồm chữ in hoa không dấu, chữ số và dấu gạch ngang (vd VCPART-MKT)")
        return v

    @field_validator("name")
    @classmethod
    def check_name(cls, v: str) -> str:
        return _not_blank(v, "Tên đơn vị")


class UnitPatch(BaseModel):
    code: str | None = Field(None, min_length=1, max_length=40)
    name: str | None = Field(None, min_length=1, max_length=120)
    kind: UnitKind | None = None
    parent_id: str | None = None
    function: str | None = None
    head_id: str | None = None
    active: bool | None = None
    order: int | None = None

    @field_validator("code")
    @classmethod
    def check_code(cls, v: str | None) -> str | None:
        return None if v is None else UnitIn.check_code(v)

    @field_validator("name")
    @classmethod
    def check_name(cls, v: str | None) -> str | None:
        return _not_blank(v, "Tên đơn vị")


def _placement(kind: str, parent: dict | None) -> list[ObjectId]:
    """Kiểm tra vị trí của đơn vị loại `kind` dưới `parent`; trả `path` (id tổ tiên, gốc trước)."""
    if parent is None:
        if kind != "group":
            raise HTTPException(400, "Đơn vị gốc phải là Tập đoàn — hãy chọn đơn vị cha")
        return []
    if not parent.get("active", True):
        raise HTTPException(400, f"Đơn vị cha {parent['code']} đang ẩn")
    if KIND_RANK[kind] <= KIND_RANK[parent["kind"]]:
        raise HTTPException(400, f"{KIND_LABEL[kind]} không đặt dưới {KIND_LABEL[parent['kind']]} được")
    path = [*(parent.get("path") or []), parent["_id"]]
    if len(path) + 1 > MAX_DEPTH:
        raise HTTPException(400, f"Cây đơn vị tối đa {MAX_DEPTH} tầng")
    return path


@router.get("/tree")
def tree(include_inactive: bool = False, user: dict = Depends(current_user)):
    """Cây đơn vị (mọi người đăng nhập) + số người đang làm ở từng đơn vị (tính cả kiêm nhiệm)."""
    from . import policy
    f = {} if include_inactive and policy.can(user, "org.manage") else {"active": True}
    rows = list(org_units.find(f))
    counts = _member_counts()
    heads = _people(u.get("head_id") for u in rows)
    nodes = {u["_id"]: _unit_out(u, counts, heads) | {"children": []} for u in rows}
    roots = []
    for u in sorted(rows, key=_sort_key):
        if u.get("parent_id") is None:
            roots.append(nodes[u["_id"]])
        elif u["parent_id"] in nodes:          # cha bị ẩn thì cả nhánh không hiện
            nodes[u["parent_id"]]["children"].append(nodes[u["_id"]])
    unassigned = users.count_documents(ACTIVE_PERSON | {"org.unit_ids.0": {"$exists": False}})
    return {"units": roots, "unassigned": unassigned}


@router.get("/units")
def list_units(include_inactive: bool = False, _user: dict = Depends(current_user)):
    """Danh sách phẳng (để chọn đơn vị), xếp theo thứ tự cây."""
    rows = list(org_units.find({} if include_inactive else {"active": True}))
    counts = _member_counts()
    by_parent: dict = {}
    for u in rows:
        by_parent.setdefault(u.get("parent_id"), []).append(u)
    out: list[dict] = []

    def walk(pid):
        for u in sorted(by_parent.get(pid, []), key=_sort_key):
            out.append(_unit_out(u, counts))
            walk(u["_id"])
    walk(None)
    return out


@router.post("/units", status_code=201)
def create_unit(body: UnitIn, _admin: dict = Depends(require_org_admin)):
    parent = _get_unit(body.parent_id) if body.parent_id else None
    path = _placement(body.kind, parent)
    if org_units.find_one({"code": body.code}, {"_id": 1}):
        raise HTTPException(409, f"Mã đơn vị {body.code} đã được dùng")
    order = body.order
    if order is None:
        last = org_units.find_one({"parent_id": parent["_id"] if parent else None}, sort=[("order", -1)])
        order = (last.get("order", 0) + 1) if last else 0
    doc = {"code": body.code, "name": body.name.strip(), "kind": body.kind,
           "parent_id": parent["_id"] if parent else None, "path": path, "function": _check_function(body.function),
           "head_id": _active_user(body.head_id, "trưởng đơn vị")["_id"] if body.head_id else None,
           "active": True, "order": order, "created_at": db.now()}
    try:
        doc["_id"] = org_units.insert_one(doc).inserted_id
    except DuplicateKeyError:
        raise HTTPException(409, f"Mã đơn vị {body.code} đã được dùng") from None
    return _unit_out(doc, heads=_people([doc["head_id"]]))


@router.patch("/units/{unit_id}")
def update_unit(unit_id: str, body: UnitPatch, _admin: dict = Depends(require_org_admin)):
    """Sửa / ẩn / hiện / sắp xếp / chuyển cha. Không xoá đơn vị — chỉ ẩn (`active=false`)."""
    u = _get_unit(unit_id)
    sets = body.model_dump(exclude_unset=True)
    changes: dict = {}
    for key in ("name", "code", "kind", "active", "order"):
        if key in sets and sets[key] is None:
            raise HTTPException(400, f"Thiếu giá trị cho {key}")
    if "name" in sets:
        changes["name"] = sets["name"].strip()
    if "code" in sets and sets["code"] != u["code"]:
        if org_units.find_one({"code": sets["code"]}, {"_id": 1}):
            raise HTTPException(409, f"Mã đơn vị {sets['code']} đã được dùng")
        changes["code"] = sets["code"]
    if "function" in sets and (sets["function"] or None) != u.get("function"):
        changes["function"] = _check_function(sets["function"])
    if "head_id" in sets:
        changes["head_id"] = _active_user(sets["head_id"], "trưởng đơn vị")["_id"] if sets["head_id"] else None
    if "order" in sets:
        changes["order"] = sets["order"]

    kind = sets.get("kind") or u["kind"]
    moved = "parent_id" in sets and (sets["parent_id"] or None) != _sid(u.get("parent_id"))
    descendants: list[dict] = []
    new_path = None
    if moved or kind != u["kind"]:
        if moved:
            parent = _get_unit(sets["parent_id"]) if sets["parent_id"] else None
            if parent and (parent["_id"] == u["_id"] or u["_id"] in (parent.get("path") or [])):
                raise HTTPException(400, "Không chọn được chính đơn vị này hoặc đơn vị con của nó làm đơn vị cha")
        else:
            parent = org_units.find_one({"_id": u["parent_id"]}) if u.get("parent_id") else None
            if parent:
                parent = parent | {"active": True}      # chỉ đổi loại, không chuyển: cha đang ẩn không cản
        new_path = _placement(kind, parent)
        descendants = list(org_units.find({"path": u["_id"]}))
        base = len(u.get("path") or [])
        deepest = max((len(d["path"]) - base for d in descendants), default=0)
        if len(new_path) + 1 + deepest > MAX_DEPTH:
            raise HTTPException(400, f"Cây đơn vị tối đa {MAX_DEPTH} tầng — nhánh này sâu {deepest + 1} tầng")
        for d in descendants:
            if d.get("parent_id") == u["_id"] and KIND_RANK[d["kind"]] <= KIND_RANK[kind]:
                raise HTTPException(400, f"Đơn vị con {d['code']} ({KIND_LABEL[d['kind']]}) không đặt dưới "
                                         f"{KIND_LABEL[kind]} được")
        changes |= {"kind": kind, "parent_id": parent["_id"] if parent else None, "path": new_path}

    hide = sets.get("active") is False and u.get("active", True)
    if hide:
        branch = unit_and_descendants(u["_id"])
        n = users.count_documents(ACTIVE_PERSON | {"org.unit_ids": {"$in": branch}})
        if n:
            raise HTTPException(409, f"Đơn vị (kể cả nhánh con) còn {n} người đang làm việc — chuyển họ sang đơn vị "
                                     f"khác trước khi ẩn")
    elif sets.get("active") is True and not u.get("active", True):
        parent = org_units.find_one({"_id": u["parent_id"]}) if u.get("parent_id") else None
        if parent and not parent.get("active", True):
            raise HTTPException(400, f"Đơn vị cha {parent['code']} đang ẩn — hiện đơn vị cha trước")
        changes["active"] = True

    if changes:
        try:
            org_units.update_one({"_id": u["_id"]}, {"$set": changes})
        except DuplicateKeyError:
            raise HTTPException(409, "Mã đơn vị đã được dùng") from None
    if new_path is not None and new_path != (u.get("path") or []):
        for d in descendants:                     # cập nhật path cả nhánh con
            tail = d["path"][d["path"].index(u["_id"]):]
            org_units.update_one({"_id": d["_id"]}, {"$set": {"path": [*new_path, *tail]}})
    if hide:                                      # ẩn đơn vị thì ẩn cả nhánh con
        org_units.update_many({"_id": {"$in": unit_and_descendants(u["_id"])}}, {"$set": {"active": False}})
    new = org_units.find_one({"_id": u["_id"]})
    return _unit_out(new, _member_counts(), _people([new.get("head_id")]))     # kèm tên trưởng đơn vị (QA U7)


# ---------------------------------------------------------------------------
# ORG-02 — danh mục chức năng
# ---------------------------------------------------------------------------

class FunctionIn(BaseModel):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=80)

    @field_validator("code")
    @classmethod
    def check_code(cls, v: str) -> str:
        v = v.strip().lower()
        if not FUNCTION_CODE_RE.match(v):
            raise ValueError("Mã chức năng chỉ gồm chữ thường không dấu, chữ số, gạch ngang (vd marketing, tai-chinh)")
        return v

    @field_validator("name")
    @classmethod
    def check_name(cls, v: str) -> str:
        return _not_blank(v, "Tên chức năng")


class FunctionPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    active: bool | None = None
    category_root: str | None = None     # slug gốc cây lĩnh vực = "mảng của mình" của người có chức năng này; "" = gỡ


def _check_category_root(slug: str | None) -> str | None:
    slug = (slug or "").strip()
    if not slug:
        return None
    from .categories import categories
    if not categories.find_one({"slug": slug, "level": 1, "active": True}, {"_id": 1}):
        raise HTTPException(400, f"'{slug}' không phải nhánh gốc (cấp 1) đang dùng của cây lĩnh vực")
    return slug

    @field_validator("name")
    @classmethod
    def check_name(cls, v: str | None) -> str | None:
        return _not_blank(v, "Tên chức năng")


def _function_out(f: dict, people: dict | None = None, units: dict | None = None) -> dict:
    return {"id": str(f["_id"]), "code": f["code"], "name": f["name"], "active": f.get("active", True),
            "category_root": f.get("category_root"),
            "people_count": (people or {}).get(f["code"], 0), "unit_count": (units or {}).get(f["code"], 0)}


@router.get("/functions")
def list_functions(include_inactive: bool = False, _user: dict = Depends(current_user)):
    people = {r["_id"]: r["n"] for r in users.aggregate([
        {"$match": ACTIVE_PERSON | {"org.function": {"$ne": None}}},
        {"$group": {"_id": "$org.function", "n": {"$sum": 1}}}])}
    units = {r["_id"]: r["n"] for r in org_units.aggregate([
        {"$match": {"active": True, "function": {"$ne": None}}}, {"$group": {"_id": "$function", "n": {"$sum": 1}}}])}
    rows = org_functions.find({} if include_inactive else {"active": True}).sort("name", 1)
    return [_function_out(f, people, units) for f in rows]


@router.post("/functions", status_code=201)
def create_function(body: FunctionIn, _admin: dict = Depends(require_org_admin)):
    doc = {"code": body.code, "name": body.name.strip(), "active": True, "created_at": db.now()}
    try:
        doc["_id"] = org_functions.insert_one(doc).inserted_id
    except DuplicateKeyError:
        raise HTTPException(409, f"Mã chức năng {body.code} đã được dùng") from None
    return _function_out(doc)


@router.patch("/functions/{function_id}")
def update_function(function_id: str, body: FunctionPatch, _admin: dict = Depends(require_org_admin)):
    """Mã chức năng không đổi được (đã gắn vào phòng và người) — chỉ đổi tên, ẩn / hiện."""
    f = org_functions.find_one({"_id": _oid(function_id, "chức năng")})
    if not f:
        raise HTTPException(404, "Không tìm thấy chức năng")
    changes = body.model_dump(exclude_none=True)
    if "name" in changes:
        changes["name"] = changes["name"].strip()
    if "category_root" in changes:
        changes["category_root"] = _check_category_root(changes["category_root"])
    if changes:
        org_functions.update_one({"_id": f["_id"]}, {"$set": changes})
    return _function_out(org_functions.find_one({"_id": f["_id"]}))


# ---------------------------------------------------------------------------
# ORG-03 — hồ sơ tổ chức của người
# ---------------------------------------------------------------------------

class OrgProfilePatch(BaseModel):
    unit_ids: list[str] | None = None
    function: str | None = None
    position: str | None = Field(None, max_length=120)
    manager_id: str | None = None
    functional_manager_id: str | None = None
    level: int | None = Field(None, ge=1, le=7)     # cấp bậc 1–7; null = chưa xếp


def cycle_path(user_id: ObjectId, manager_id: ObjectId) -> list[ObjectId] | None:
    """Đặt `manager_id` làm quản lý của `user_id` mà tạo vòng thì trả vòng đó (người → … → người), không thì None."""
    if manager_id == user_id:
        return [user_id, user_id]
    chain = [manager_id, *manager_chain(manager_id, limit=500)]
    if user_id in chain:
        return [user_id, *chain[:chain.index(user_id) + 1]]
    return None


def _profile_out(u: dict) -> dict:
    from .auth import org_brief
    return {"id": str(u["_id"]), "name": u["name"], "email": u["email"], "org": org_brief(u)}


@router.patch("/users/{user_id}")
def update_user_org(user_id: str, body: OrgProfilePatch, _admin: dict = Depends(require_org_admin)):
    """Đơn vị chính (phần tử đầu) + kiêm nhiệm, chức năng, chức danh, quản lý trực tiếp / chuyên môn.
    Chặn vòng quản lý và tự quản lý chính mình. `level`: cấp bậc 1–7 hoặc null (chỉ dữ liệu, chưa có luật theo cấp)."""
    target = users.find_one({"_id": _oid(user_id, "người dùng")})
    if not target:
        raise HTTPException(404, "Không tìm thấy người dùng")
    sets = body.model_dump(exclude_unset=True)
    new = user_org(target)
    if "unit_ids" in sets:
        ids = list(dict.fromkeys(_oid(x, "đơn vị", 400) for x in sets["unit_ids"] or []))
        found = {u["_id"]: u for u in org_units.find({"_id": {"$in": ids}})}
        for i in ids:
            if i not in found:
                raise HTTPException(400, "Không tìm thấy đơn vị")
            if not found[i].get("active", True) and i not in new["unit_ids"]:
                raise HTTPException(400, f"Đơn vị {found[i]['code']} đang ẩn")
        new["unit_ids"] = ids
    if "function" in sets and (sets["function"] or None) != new["function"]:
        new["function"] = _check_function(sets["function"])
    if "position" in sets:
        new["position"] = (sets["position"] or "").strip() or None
    for field, label in (("manager_id", "quản lý trực tiếp"), ("functional_manager_id", "quản lý chuyên môn")):
        if field not in sets:
            continue
        if not sets[field]:
            new[field] = None
            continue
        m = users.find_one({"_id": _oid(sets[field], label, 400)})
        if not m:
            raise HTTPException(400, f"Không tìm thấy {label}")
        if m["_id"] == target["_id"]:
            raise HTTPException(400, "Không tự quản lý chính mình")
        if m["_id"] != new[field] and not _working(m):
            raise HTTPException(400, f"{m['name']} đã khoá tài khoản hoặc đã nghỉ việc")
        if field == "manager_id" and (loop := cycle_path(target["_id"], m["_id"])):
            names = _people(loop)
            raise HTTPException(400, "Tạo vòng quản lý: " + " → ".join(names[i]["name"] for i in loop if i in names))
        if field == "functional_manager_id" and user_org(m)["functional_manager_id"] == target["_id"]:
            raise HTTPException(400, f"Tạo vòng quản lý chuyên môn: {target['name']} đang là quản lý chuyên môn của "
                                     f"{m['name']}")
        new[field] = m["_id"]
    if "level" in sets:
        new["level"] = sets["level"]
    users.update_one({"_id": target["_id"]}, {"$set": {"org": new}})
    return _profile_out(users.find_one({"_id": target["_id"]}))


# ---------------------------------------------------------------------------
# ORG-04 — nhập hàng loạt từ Excel / CSV (dùng chung cho API và scripts/import_org.py)
# ---------------------------------------------------------------------------

IMPORT_COLUMNS = ("email", "name", "unit_code", "function", "manager_email", "functional_manager_email", "position",
                  "level")
IMPORT_HEADERS = {
    "email": "email", "thudientu": "email",
    "hoten": "name", "hovaten": "name", "ten": "name", "name": "name", "fullname": "name",
    "madonvi": "unit_code", "donvi": "unit_code", "unit": "unit_code", "unitcode": "unit_code",
    "chucnang": "function", "function": "function",
    "emailquanly": "manager_email", "emailquanlytructiep": "manager_email", "quanly": "manager_email",
    "quanlytructiep": "manager_email", "manageremail": "manager_email", "manager": "manager_email",
    "emailquanlychuyenmon": "functional_manager_email", "quanlychuyenmon": "functional_manager_email",
    "functionalmanageremail": "functional_manager_email", "functionalmanager": "functional_manager_email",
    "chucdanh": "position", "position": "position", "vitri": "position",
    "capbac": "level", "level": "level", "cap": "level",
}
IMPORT_MAX_ROWS = 5000
IMPORT_MAX_BYTES = 5 * 1024 * 1024


def _norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s or "")).replace("đ", "d").replace("Đ", "D")
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if not unicodedata.combining(c)).lower())


def _cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def parse_table(filename: str, data: bytes) -> list[tuple[int, dict]]:
    """Đọc file mẫu → [(số dòng trong file, {cột: giá trị})]. Có dòng tiêu đề (tiếng Việt / tiếng Anh, có dấu hay
    không đều được) thì theo tiêu đề; không có thì theo thứ tự cột của mẫu. Lỗi định dạng → ValueError."""
    name = (filename or "").lower()
    if name.endswith((".xlsx", ".xlsm")):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            raw = [[_cell(c) for c in r] for r in wb.worksheets[0].iter_rows(values_only=True)]
        except Exception as e:  # noqa: BLE001 — file hỏng / không phải Excel
            raise ValueError(f"Không đọc được file Excel: {e}") from None
    elif name.endswith((".csv", ".txt")):
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValueError("File CSV phải lưu dạng UTF-8 (Excel: Lưu thành → CSV UTF-8)") from None
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        raw = [[_cell(c) for c in r] for r in csv.reader(io.StringIO(text), dialect)]
    else:
        raise ValueError("Chỉ nhận file Excel (.xlsx) hoặc CSV")
    lines = [(i + 1, r) for i, r in enumerate(raw) if any(r)]
    if not lines:
        return []
    header = [IMPORT_HEADERS.get(_norm(c)) for c in lines[0][1]]
    if "email" in header:
        cols, lines = header, lines[1:]
    else:
        cols = list(IMPORT_COLUMNS)
    if len(lines) > IMPORT_MAX_ROWS:
        raise ValueError(f"Tối đa {IMPORT_MAX_ROWS} dòng mỗi lần nhập")
    out = []
    for no, r in lines:
        row = dict.fromkeys(IMPORT_COLUMNS, "")
        for col, val in zip(cols, r):
            if col and not row[col]:
                row[col] = val
        if "level" not in cols:
            row["level"] = None          # file mẫu cũ không có cột cấp bậc: giữ cấp bậc đang có
        out.append((no, row))
    return out


def _parse_level(v) -> tuple[int | None, str | None]:
    """Ô cấp bậc -> (1–7 hoặc None, lỗi). Trống = None."""
    v = str(v or "").strip()
    if not v:
        return None, None
    try:
        n = int(float(v))
    except ValueError:
        n = 0
    if str(n) != v.split(".")[0] or not 1 <= n <= 7:
        return None, f"Cấp bậc “{v}” phải là số 1–7 (" + ", ".join(f"{k} {t}" for k, t in LEVEL_NAMES.items()) + ")"
    return n, None


def import_org(rows: list[tuple[int, dict]], dry_run: bool = True) -> dict:
    """Kiểm tra từng dòng; `dry_run` thì chỉ trả kết quả, không ghi gì. Ghi thật chỉ khi không dòng nào lỗi
    (ghi hết hoặc không ghi gì). Người chưa có tài khoản được tạo với mật khẩu ngẫu nhiên, trả về đúng một lần.
    Chạy lại cùng file không tạo trùng: người đã có (theo email) chỉ được cập nhật hồ sơ tổ chức; đơn vị kiêm nhiệm
    đang có được giữ."""
    from .auth import EMAIL_RE, create_user

    units = {u["code"]: u for u in org_units.find()}
    funcs = [f for f in org_functions.find() if f.get("active", True)]
    func_by = {f["code"].lower(): f["code"] for f in funcs} | {_norm(f["name"]): f["code"] for f in funcs}
    first_row: dict[str, int] = {}                           # email -> số dòng đầu tiên có email đó
    for no, r in rows:
        for k in ("email", "manager_email", "functional_manager_email"):
            r[k] = r[k].strip().lower()
        first_row.setdefault(r["email"], no)
    emails = {e for _, r in rows for e in (r["email"], r["manager_email"], r["functional_manager_email"]) if e}
    known = {u["email"]: u for u in users.find({"email": {"$in": list(emails)}})}
    email_of = {u["_id"]: u["email"] for u in users.find({}, {"email": 1})}
    db_manager = {u["email"]: email_of.get(user_org(u)["manager_id"])
                  for u in users.find({"org.manager_id": {"$ne": None}}, {"email": 1, "org": 1})}
    file_manager = {r["email"]: r["manager_email"] or None for _, r in rows}

    def manager_of(email: str) -> str | None:
        return file_manager[email] if email in file_manager else db_manager.get(email)

    out = []
    for no, r in rows:
        errs: list[str] = []
        email, existing = r["email"], known.get(r["email"])
        if not EMAIL_RE.match(email):
            errs.append("Email không hợp lệ")
        elif first_row[email] != no:
            errs.append(f"Email trùng với dòng {first_row[email]}")
        if existing and not _working(existing):
            errs.append("Tài khoản đang bị khoá hoặc đã nghỉ việc — mở khoá ở màn Người dùng (hoặc “Cho đi làm lại” "
                        "ở màn Cơ cấu tổ chức) trước")
        if not existing and not r["name"]:
            errs.append("Thiếu họ tên cho tài khoản mới")
        code = r["unit_code"].strip().upper()
        unit = units.get(code)
        if not code:
            errs.append("Thiếu mã đơn vị")
        elif not unit or not unit.get("active", True):
            errs.append(f"Mã đơn vị {code} không có (hoặc đã ẩn)")
        function = None
        if r["function"]:
            function = func_by.get(r["function"].strip().lower()) or func_by.get(_norm(r["function"]))
            if not function:
                errs.append(f"Chức năng “{r['function']}” không có trong danh mục")
        elif unit:
            function = unit.get("function")                 # bỏ trống: lấy chức năng của phòng
        for key, label in (("manager_email", "Quản lý"), ("functional_manager_email", "Quản lý chuyên môn")):
            m = r[key]
            if not m or m in first_row and m != email:
                continue
            if m == email:
                errs.append(f"{label}: không tự quản lý chính mình")
            elif not EMAIL_RE.match(m):
                errs.append(f"{label}: email {m} không hợp lệ")
            elif m not in known:
                errs.append(f"{label} {m} không có trong file cũng không có trong hệ thống")
            elif not _working(known[m]):
                errs.append(f"{label} {m} đã khoá tài khoản hoặc đã nghỉ việc")
        if r["manager_email"] and r["manager_email"] != email:
            chain, cur = [email], r["manager_email"]
            while cur and cur not in chain and len(chain) < 1000:
                chain.append(cur)
                cur = manager_of(cur)
            if cur == email:
                errs.append("Tạo vòng quản lý: " + " → ".join([*chain, email]))
        position = r["position"].strip() or None
        keep_level = r.get("level") is None
        level, level_err = (None, None) if keep_level else _parse_level(r["level"])
        if level_err:
            errs.append(level_err)
        if keep_level and existing:
            level = user_org(existing)["level"]
        plan = {"unit_ids": [unit["_id"]] if unit else [], "function": function, "position": position, "level": level,
                "manager_email": r["manager_email"] or None,
                "functional_manager_email": r["functional_manager_email"] or None}
        if errs:
            action = "error"
        elif not existing:
            action = "create"
        else:
            cur_org = user_org(existing)
            plan["unit_ids"] = [unit["_id"], *(x for x in cur_org["unit_ids"][1:] if x != unit["_id"])]
            same = (cur_org["unit_ids"] == plan["unit_ids"] and cur_org["function"] == function
                    and cur_org["position"] == position
                    and email_of.get(cur_org["manager_id"]) == plan["manager_email"]
                    and email_of.get(cur_org["functional_manager_id"]) == plan["functional_manager_email"]
                    and cur_org["level"] == level)
            action = "unchanged" if same else "update"
        out.append({"row": no, "email": email, "name": r["name"] or (existing or {}).get("name", ""),
                    "unit_code": code, "function": function, "manager_email": r["manager_email"],
                    "functional_manager_email": r["functional_manager_email"], "position": position, "level": level,
                    "action": action, "errors": errs, "_plan": plan})

    counts = {k: sum(1 for x in out if x["action"] == k) for k in ("create", "update", "unchanged", "error")}
    result = {"dry_run": dry_run, "applied": False, "total": len(out), "counts": counts, "created": []}
    if not dry_run and out and not counts["error"]:
        for x in out:
            if x["action"] == "create":
                password = secrets.token_urlsafe(9)
                known[x["email"]] = create_user(x["email"], x["name"], password)
                result["created"].append({"email": x["email"], "name": x["name"], "password": password})
        for x in out:
            if x["action"] == "unchanged":
                continue
            p = x["_plan"]
            mid = known[p["manager_email"]]["_id"] if p["manager_email"] else None
            fid = known[p["functional_manager_email"]]["_id"] if p["functional_manager_email"] else None
            users.update_one({"_id": known[x["email"]]["_id"]}, {"$set": {"org": {
                "unit_ids": p["unit_ids"], "function": p["function"], "position": p["position"], "manager_id": mid,
                "functional_manager_id": fid, "level": p["level"], "status": "active"}}})
        result["applied"] = True
    for x in out:
        x.pop("_plan")
    result["rows"] = out
    return result


@router.post("/import")
def import_file(file: UploadFile = File(...), dry_run: bool = True, _admin: dict = Depends(require_org_admin)):
    """Tải Excel / CSV theo mẫu: email, họ tên, mã đơn vị, chức năng, email quản lý, email quản lý chuyên môn,
    chức danh. Mặc định `dry_run=true`: chỉ xem trước, báo lỗi từng dòng, không ghi gì."""
    data = file.file.read(IMPORT_MAX_BYTES + 1)
    if len(data) > IMPORT_MAX_BYTES:
        raise HTTPException(413, "File quá lớn (tối đa 5 MB)")
    try:
        rows = parse_table(file.filename or "", data)
    except ValueError as e:
        raise HTTPException(400, str(e)) from None
    if not rows:
        raise HTTPException(400, "File không có dòng dữ liệu nào")
    return import_org(rows, dry_run=dry_run)


# ---------------------------------------------------------------------------
# ORG-06, 07 — vai trò chức năng và uỷ quyền
# ---------------------------------------------------------------------------

class ScopeIn(BaseModel):
    unit_id: str | None = None
    category: str | None = None
    function: str | None = None


class GrantIn(BaseModel):
    user_id: str
    role: GrantRole
    scope: ScopeIn = ScopeIn()
    valid_from: datetime | None = None
    valid_to: datetime | None = None


class DelegationIn(BaseModel):
    grant_id: str
    user_id: str
    valid_from: datetime | None = None
    valid_to: datetime
    note: str | None = Field(None, max_length=300)


def _aware(t: datetime | None) -> datetime | None:
    return t.replace(tzinfo=timezone.utc) if t and t.tzinfo is None else t


def _valid_now() -> dict:
    t = db.now()
    return {"$and": [{"$or": [{"valid_from": None}, {"valid_from": {"$lte": t}}]},
                     {"$or": [{"valid_to": None}, {"valid_to": {"$gt": t}}]}]}


def _is_valid(g: dict) -> bool:
    t = db.now()
    return (not g.get("valid_from") or g["valid_from"] <= t) and (not g.get("valid_to") or g["valid_to"] > t)


def _not_ended() -> dict:
    """Chưa hết hạn: đang hiệu lực hoặc sắp hiệu lực (ngày bắt đầu ở tương lai)."""
    return {"$or": [{"valid_to": None}, {"valid_to": {"$gt": db.now()}}]}


def _is_upcoming(g: dict) -> bool:
    t = db.now()
    return bool(g.get("valid_from") and g["valid_from"] > t and (not g.get("valid_to") or g["valid_to"] > t))


def _overlaps(vf: datetime | None, vt: datetime | None) -> dict:
    """Bản ghi có khoảng hiệu lực chồng lên [vf, vt) — vf trống = từ bây giờ, vt trống = không thời hạn.
    Dùng chặn cấp / uỷ quyền trùng, kể cả với vai trò sắp hiệu lực (QA B6, B7)."""
    conds = [{"$or": [{"valid_to": None}, {"valid_to": {"$gt": max(vf or db.now(), db.now())}}]}]
    if vt:
        conds.append({"$or": [{"valid_from": None}, {"valid_from": {"$lt": vt}}]})
    return {"$and": conds}


def _day(t: datetime | None) -> str:
    """Ngày hiển thị trong thông báo lỗi, theo giờ Việt Nam."""
    return t.astimezone(timezone(timedelta(hours=7))).strftime("%d/%m/%Y") if t else ""


def _scope_doc(scope: ScopeIn) -> dict:
    from .categories import categories
    unit = _get_unit(scope.unit_id) if scope.unit_id else None
    if scope.category and not categories.find_one({"slug": scope.category}, {"_id": 1}):
        raise HTTPException(400, f"Không tìm thấy lĩnh vực {scope.category}")
    return {"unit_id": unit["_id"] if unit else None, "category": scope.category or None,
            "function": _check_function(scope.function)}


def _grants_out(rows: list[dict]) -> list[dict]:
    src_ids = [r["delegated_from"] for r in rows if r.get("delegated_from")]
    sources = {g["_id"]: g for g in grants.find({"_id": {"$in": src_ids}})} if src_ids else {}
    people = _people({x for r in rows for x in (r["user_id"], r.get("created_by"), r.get("revoked_by"),
                                               (sources.get(r.get("delegated_from")) or {}).get("user_id"))})
    unit_ids = [i for r in rows if (i := (r.get("scope") or {}).get("unit_id"))]
    units = {u["_id"]: u for u in org_units.find({"_id": {"$in": unit_ids}}, {"code": 1, "name": 1})} if unit_ids else {}
    out = []
    for r in rows:
        s = r.get("scope") or {}
        unit = units.get(s.get("unit_id"))
        src = sources.get(r.get("delegated_from"))
        out.append({
            "id": str(r["_id"]), "user": people.get(r["user_id"]), "role": r["role"],
            "scope": {"unit_id": _sid(s.get("unit_id")),
                      "unit": {"code": unit["code"], "name": unit["name"]} if unit else None,
                      "category": s.get("category"), "function": s.get("function")},
            "delegated_from": _sid(r.get("delegated_from")),
            "delegated_by": people.get(src["user_id"]) if src else None,
            "transferred_from": _sid(r.get("transferred_from")),
            "valid_from": r.get("valid_from"), "valid_to": r.get("valid_to"), "note": r.get("note"),
            "created_by": people.get(r.get("created_by")), "created_at": r.get("created_at"),
            "revoked_at": r.get("revoked_at"), "revoked_by": people.get(r.get("revoked_by")),
            "active": _is_valid(r), "upcoming": _is_upcoming(r),
        })
    return out


@router.get("/grants")
def list_grants(user_id: str | None = None, role: str | None = None, unit_id: str | None = None,
                include_inactive: bool = False, _admin: dict = Depends(require_org_admin)):
    """Ai có quyền gì ở đâu. `unit_id`: vai trò có hiệu lực tại đơn vị đó (cấp ở chính nó, ở đơn vị cha,
    hoặc không giới hạn đơn vị). Mặc định: vai trò đang hiệu lực + sắp hiệu lực (`upcoming`, ngày bắt đầu ở tương
    lai); `include_inactive` thêm cả vai trò đã hết hạn / đã thu hồi."""
    f: dict = {} if include_inactive else _not_ended()
    if user_id:
        f["user_id"] = _oid(user_id, "người dùng")
    if role:
        f["role"] = role
    if unit_id:
        u = _get_unit(unit_id)
        f["scope.unit_id"] = {"$in": [*(u.get("path") or []), u["_id"], None]}
    return _grants_out(list(grants.find(f).sort([("role", 1), ("created_at", 1)])))


@router.post("/grants", status_code=201)
def create_grant(body: GrantIn, admin: dict = Depends(require_org_admin)):
    target = _active_user(body.user_id)
    scope = _scope_doc(body.scope)
    vf, vt = _aware(body.valid_from), _aware(body.valid_to)
    if vt and vt <= max(vf or db.now(), db.now()):
        raise HTTPException(400, "Ngày hết hạn phải sau ngày bắt đầu và sau hiện tại")
    if grants.find_one({"user_id": target["_id"], "role": body.role, "scope": scope, "delegated_from": None}
                       | _overlaps(vf, vt), {"_id": 1}):
        raise HTTPException(409, f"{target['name']} đã có vai trò này trong phạm vi này (đang hoặc sắp hiệu lực, "
                                 f"trùng thời gian)")
    doc = {"user_id": target["_id"], "role": body.role, "scope": scope, "delegated_from": None,
           "valid_from": vf, "valid_to": vt, "created_by": admin["_id"], "created_at": db.now()}
    doc["_id"] = grants.insert_one(doc).inserted_id
    return _grants_out([doc])[0]


def _end_grant(g: dict, by: dict, reason: str) -> None:
    """Thu hồi (không xoá — giữ lịch sử): hết hạn ngay, kèm các uỷ quyền cấp từ vai trò này."""
    t = db.now()
    end = {"valid_to": t, "revoked_at": t, "revoked_by": by["_id"], "revoked_reason": reason}
    grants.update_one({"_id": g["_id"]}, {"$set": end})
    grants.update_many({"delegated_from": g["_id"]} | _not_ended(), {"$set": end})


@router.delete("/grants/{grant_id}", status_code=204)
def revoke_grant(grant_id: str, admin: dict = Depends(require_org_admin)):
    g = grants.find_one({"_id": _oid(grant_id, "vai trò")})
    if not g:
        raise HTTPException(404, "Không tìm thấy vai trò")
    if _is_valid(g) or _is_upcoming(g):         # vai trò sắp hiệu lực cũng thu hồi được
        _end_grant(g, admin, "revoke")
    return Response(status_code=204)


@router.post("/delegations", status_code=201)
def delegate(body: DelegationIn, user: dict = Depends(current_user)):
    """Người đang giữ vai trò uỷ quyền cho người khác trong một khoảng thời gian (vd nghỉ phép); tự hết hạn ở
    `valid_to`. Không uỷ quyền tiếp một vai trò đã là uỷ quyền. Quản trị viên uỷ quyền thay được."""
    from . import policy
    g = grants.find_one({"_id": _oid(body.grant_id, "vai trò")})
    if not g or (g["user_id"] != user["_id"] and not policy.can(user, "org.manage")):
        raise HTTPException(404, "Không tìm thấy vai trò")
    if g.get("delegated_from"):
        raise HTTPException(400, "Vai trò này là uỷ quyền — không uỷ quyền tiếp được")
    if _is_upcoming(g):
        raise HTTPException(400, f"Vai trò chưa tới ngày hiệu lực (từ {_day(g['valid_from'])}) — uỷ quyền sau ngày đó")
    if not _is_valid(g):
        raise HTTPException(400, "Vai trò đã hết hiệu lực")
    to = _active_user(body.user_id, "người nhận uỷ quyền")
    if to["_id"] == g["user_id"]:
        raise HTTPException(400, "Không uỷ quyền cho chính mình")
    now = db.now()
    vf, vt = _aware(body.valid_from) or now, _aware(body.valid_to)
    if vt <= vf or vt <= now:
        raise HTTPException(400, "Ngày kết thúc uỷ quyền phải sau ngày bắt đầu và sau hiện tại")
    if g.get("valid_to") and vt > g["valid_to"]:
        raise HTTPException(400, "Uỷ quyền không được dài hơn thời hạn của vai trò gốc")
    # cùng vai trò, cùng người nhận, thời gian chồng nhau -> trùng (QA B6); muốn gia hạn thì thu hồi rồi uỷ quyền lại
    dup = grants.find_one({"delegated_from": g["_id"], "user_id": to["_id"]} | _overlaps(vf, vt))
    if dup:
        raise HTTPException(409, f"{to['name']} đã được uỷ quyền vai trò này đến {_day(dup.get('valid_to'))}")
    doc = {"user_id": to["_id"], "role": g["role"], "scope": g.get("scope") or {}, "delegated_from": g["_id"],
           "valid_from": vf, "valid_to": vt, "created_by": user["_id"], "created_at": now,
           "note": (body.note or "").strip() or None}
    doc["_id"] = grants.insert_one(doc).inserted_id
    return _grants_out([doc])[0]


# ---------------------------------------------------------------------------
# ORG-08 — nghỉ việc
# ---------------------------------------------------------------------------

class OffboardIn(BaseModel):
    note: str | None = Field(None, max_length=300)


@router.post("/users/{user_id}/offboard")
def offboard(user_id: str, body: OffboardIn | None = None, admin: dict = Depends(require_org_admin)):
    """Khoá tài khoản (đăng xuất mọi phiên, thu hồi token API), `org.status = left`; vai trò chuyển cho quản lý
    trực tiếp (quản lý trực tiếp cũng đã nghỉ thì cấp trên gần nhất còn làm việc); người dưới quyền trực tiếp chuyển
    sang quản lý đó. Không xoá gì — vai trò cũ chỉ hết hạn, hồ sơ giữ nguyên đơn vị / tên để tra lịch sử."""
    from .auth import lock_user
    target = users.find_one({"_id": _oid(user_id, "người dùng")})
    if not target:
        raise HTTPException(404, "Không tìm thấy người dùng")
    if target["_id"] == admin["_id"]:
        raise HTTPException(400, "Không tự xử lý nghỉ việc cho chính mình")
    if user_org(target)["status"] == "left":
        raise HTTPException(409, "Người này đã được xử lý nghỉ việc")
    heir = None
    for mid in manager_chain(target["_id"], limit=50):
        m = users.find_one({"_id": mid})
        if m and _working(m):
            heir = m
            break
    now = db.now()
    lock_user(target["_id"])
    users.update_one({"_id": target["_id"]}, {"$set": {
        "org": user_org(target) | {"status": "left", "level": None},
        "org_left": {"at": now, "by": admin["_id"], "note": ((body.note if body else None) or "").strip() or None}}})

    transferred, ended = [], []
    upcoming = list(grants.find({"user_id": target["_id"], "valid_from": {"$gt": now}} | _not_ended()))
    for g in active_grants(target) + upcoming:
        _end_grant(g, admin, "offboard")
        item = _grants_out([g])[0]
        if g.get("delegated_from") or not heir:
            ended.append(item)                       # uỷ quyền nhận từ người khác thì chỉ hết hạn
            continue
        scope = g.get("scope") or {}
        start = max(g.get("valid_from") or now, now)
        dup = grants.find_one({"user_id": heir["_id"], "role": g["role"], "scope": scope, "delegated_from": None}
                              | _overlaps(start, g.get("valid_to")))
        if dup:
            transferred.append(item | {"to": _grants_out([dup])[0], "existing": True})
            continue
        doc = {"user_id": heir["_id"], "role": g["role"], "scope": scope, "delegated_from": None,
               "valid_from": start, "valid_to": g.get("valid_to"), "created_by": admin["_id"], "created_at": now,
               "transferred_from": g["_id"]}
        doc["_id"] = grants.insert_one(doc).inserted_id
        transferred.append(item | {"to": _grants_out([doc])[0], "existing": False})

    reports = list(users.find(ACTIVE_PERSON | {"org.manager_id": target["_id"]}, {"name": 1, "email": 1}))
    users.update_many({"_id": {"$in": [r["_id"] for r in reports]}},
                      {"$set": {"org.manager_id": heir["_id"] if heir else None}})
    fn_reports = list(users.find(ACTIVE_PERSON | {"org.functional_manager_id": target["_id"]}, {"name": 1, "email": 1}))
    users.update_many({"_id": {"$in": [r["_id"] for r in fn_reports]}}, {"$set": {"org.functional_manager_id": None}})
    headed = list(org_units.find({"head_id": target["_id"]}, {"code": 1, "name": 1}))
    org_units.update_many({"head_id": target["_id"]}, {"$set": {"head_id": None}})
    brief = lambda r: {"id": str(r["_id"]), "name": r["name"], "email": r["email"]}  # noqa: E731
    return {
        "user": brief(target), "heir": brief(heir) if heir else None,
        "grants_transferred": transferred, "grants_ended": ended,
        "reports_moved": [brief(r) for r in reports],
        "functional_reports_cleared": [brief(r) for r in fn_reports],
        "units_head_cleared": [{"id": str(u["_id"]), "code": u["code"], "name": u["name"]} for u in headed],
    }


# ---------------------------------------------------------------------------
# ORG-05 (phần dữ liệu) — ánh xạ cấp bậc → bậc nội dung
# ---------------------------------------------------------------------------

@router.get("/level-map")
def get_level_map(_user: dict = Depends(current_user)):
    """Bảng ánh xạ cấp bậc 1–7 → bậc nội dung (own = mảng của mình, other = mảng khác)."""
    return {"names": {str(k): v for k, v in LEVEL_NAMES.items()}, "content_levels": list(CONTENT_LEVELS),
            "levels": {str(k): v for k, v in level_map().items()}}


class LevelMapIn(BaseModel):
    levels: dict[str, dict[str, list[str]]]


@router.put("/level-map")
def put_level_map(body: LevelMapIn, admin: dict = Depends(require_org_admin)):
    """Thay cả bảng: đủ 7 cấp, mỗi cấp own / other là danh sách bậc nội dung hợp lệ."""
    new = {}
    for k in LEVEL_NAMES:
        entry = body.levels.get(str(k))
        if entry is None:
            raise HTTPException(400, f"Thiếu cấp {k} ({LEVEL_NAMES[k]})")
        new[str(k)] = {}
        for side in ("own", "other"):
            vals = list(dict.fromkeys(entry.get(side) or []))
            if bad := [v for v in vals if v not in CONTENT_LEVELS]:
                raise HTTPException(400, f"Cấp {k} · {side}: {', '.join(bad)} không phải bậc nội dung "
                                         f"({', '.join(CONTENT_LEVELS)})")
            new[str(k)][side] = vals
    if extra := set(body.levels) - {str(k) for k in LEVEL_NAMES}:
        raise HTTPException(400, f"Cấp không có: {', '.join(sorted(extra))} (chỉ 1–7)")
    org_level_map.update_one({"_id": LEVEL_MAP_ID}, {"$set": {"levels": new, "updated_at": db.now(),
                                                              "updated_by": admin["_id"]}}, upsert=True)
    return get_level_map(admin)


def level_map() -> dict[int, dict[str, list[str]]]:
    """Bảng đang dùng (đã lưu thì theo bảng lưu, thiếu cấp nào lấy mặc định)."""
    saved = (org_level_map.find_one({"_id": LEVEL_MAP_ID}) or {}).get("levels") or {}
    return {k: saved.get(str(k)) or DEFAULT_LEVEL_MAP[k] for k in LEVEL_NAMES}


def function_category_root(code: str | None) -> str | None:
    if not code:
        return None
    return (org_functions.find_one({"code": code}, {"category_root": 1}) or {}).get("category_root")


# ---------------------------------------------------------------------------
# Nhật ký truy cập — luồng G (ORG-11) làm
# ---------------------------------------------------------------------------

@router.get("/access-log", name="org_get_/access-log")
def access_log_list(_user: dict = Depends(current_user)):
    raise HTTPException(501, "Chưa triển khai (ORG-11)")


@router.get("/me")
def me(user: dict = Depends(current_user)):
    """Đơn vị, người quản lý, người dưới quyền trực tiếp, vai trò chức năng của chính mình (ORG-14)."""
    o = user_org(user)
    ids = [x for x in (o["manager_id"], o["functional_manager_id"]) if x]
    people = {u["_id"]: u for u in users.find({"_id": {"$in": ids}}, {"name": 1, "email": 1})}
    person = lambda i: {"id": str(i), "name": people[i]["name"], "email": people[i]["email"]} if i in people else None
    units = {u["_id"]: u for u in org_units.find({"_id": {"$in": o["unit_ids"]}}, {"name": 1, "code": 1})}
    reports = users.find({"_id": {"$in": subordinate_ids(user["_id"], direct_only=True)}}, {"name": 1, "email": 1})
    return {
        "units": [{"id": str(i), "name": units[i]["name"], "code": units[i]["code"]} for i in o["unit_ids"] if i in units],
        "function": o["function"], "position": o["position"], "level": o["level"],
        "level_name": LEVEL_NAMES.get(o["level"]), "category_root": function_category_root(o["function"]),
        "manager": person(o["manager_id"]) if o["manager_id"] else None,
        "functional_manager": person(o["functional_manager_id"]) if o["functional_manager_id"] else None,
        "direct_reports": [{"id": str(r["_id"]), "name": r["name"], "email": r["email"]} for r in reports],
        "grants": [{"id": g["id"], "role": g["role"], "scope": g["scope"], "delegated_from": g["delegated_from"],
                    "delegated_by": g["delegated_by"], "valid_to": g["valid_to"]}
                   for g in _grants_out(active_grants(user))],
    }
