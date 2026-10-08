"""Đăng nhập, phiên làm việc (cookie httpOnly) và quản lý người dùng.

Vai trò hệ thống: `admin` (quản lý người dùng) | `member`.
Quyền trên dữ liệu kiến thức nằm ở từng kho — xem spaces.py.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import timedelta
from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from pymongo import ASCENDING

from . import db

users = db.db["users"]
sessions = db.db["sessions"]
api_tokens = db.db["api_tokens"]

SESSION_COOKIE = "vc_session"
SESSION_DAYS = 14
# /api/guide: hướng dẫn sử dụng cho AI đọc không cần JS — nội dung vốn công khai trong bundle FE (app/guide.py)
PUBLIC_PATHS = ("/api/health", "/api/auth/login", "/api/auth/setup", "/api/guide")


def ensure_indexes() -> None:
    users.create_index([("email", ASCENDING)], unique=True)
    sessions.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
    api_tokens.create_index([("user_id", ASCENDING)])


# ---------------------------------------------------------------------------
# Mật khẩu (scrypt — thư viện chuẩn, không cần cài thêm)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
    except ValueError:
        return False
    check = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**14, r=8, p=1)
    return hmac.compare_digest(check.hex(), digest)


# ---------------------------------------------------------------------------
# Phiên làm việc
# ---------------------------------------------------------------------------

def public_user(u: dict) -> dict:
    return {"id": str(u["_id"]), "email": u["email"], "name": u["name"], "role": u["role"],
            "active": u.get("active", True), "created_at": u.get("created_at")}


def user_from_request(request: Request) -> dict | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    s = sessions.find_one({"_id": token, "expires_at": {"$gt": db.now()}})
    if not s:
        return None
    u = users.find_one({"_id": s["user_id"], "active": True})
    return u


def start_session(response: Response, user: dict) -> None:
    token = secrets.token_urlsafe(32)
    sessions.insert_one({"_id": token, "user_id": user["_id"], "created_at": db.now(),
                         "expires_at": db.now() + timedelta(days=SESSION_DAYS)})
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax")


def record_login(user: dict) -> None:
    """SYS-36: ghi thời điểm đăng nhập web thành công. Chỉ gọi ở đăng nhập / tạo tài khoản đầu tiên bằng cookie phiên;
    token MCP không đi qua đây (đã có `last_used_at` của token). Bản ghi cũ thiếu trường = chưa đăng nhập."""
    users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": db.now()}})


def current_user(request: Request) -> dict:
    """Dependency: người dùng đã được middleware gắn vào request."""
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "Cần đăng nhập")
    return user


def require_admin(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Chỉ quản trị viên được thực hiện")
    return user


# ---------------------------------------------------------------------------
# Token API cá nhân — cho AI kết nối qua MCP (Authorization: Bearer <token>)
# Chỉ lưu SHA-256 của token; token gốc hiện đúng một lần lúc tạo.
# ---------------------------------------------------------------------------

TOKEN_PREFIX = "vcmcp_"


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def issue_api_token(user: dict, name: str) -> tuple[str, dict]:
    token = TOKEN_PREFIX + secrets.token_urlsafe(32)
    doc = {"_id": _token_hash(token), "user_id": user["_id"], "name": name.strip() or "AI",
           "hint": token[-4:], "created_at": db.now(), "last_used_at": None}
    api_tokens.insert_one(doc)
    return token, doc


def user_from_api_token(token: str | None) -> dict | None:
    if not token or not token.startswith(TOKEN_PREFIX):
        return None
    t = api_tokens.find_one_and_update({"_id": _token_hash(token)}, {"$set": {"last_used_at": db.now()}})
    if not t:
        return None
    return users.find_one({"_id": t["user_id"], "active": True})


def token_out(t: dict) -> dict:
    return {"id": t["_id"][:16], "name": t["name"], "hint": t["hint"],
            "created_at": t["created_at"], "last_used_at": t.get("last_used_at")}


def lock_user(user_id: ObjectId) -> None:
    """Khoá tài khoản: không đăng nhập được, đăng xuất khỏi mọi thiết bị, thu hồi mọi token API (AI / MCP).
    Dùng chung cho nút Khoá ở màn Quản trị và thủ tục nghỉ việc (ORG-08)."""
    users.update_one({"_id": user_id}, {"$set": {"active": False}})
    sessions.delete_many({"user_id": user_id})
    api_tokens.delete_many({"user_id": user_id})


def org_brief(u: dict) -> dict:
    """Hồ sơ tổ chức rút gọn (ORG-03) kèm theo danh sách người dùng; id dạng chuỗi."""
    o = u.get("org") or {}
    sid = lambda v: str(v) if v else None  # noqa: E731
    return {"unit_ids": [str(x) for x in o.get("unit_ids") or []], "function": o.get("function"),
            "position": o.get("position"), "manager_id": sid(o.get("manager_id")),
            "functional_manager_id": sid(o.get("functional_manager_id")), "level": o.get("level"),
            "status": o.get("status", "active")}


def create_user(email: str, name: str, password: str, role: str = "member") -> dict:
    from .spaces import create_personal_space  # tránh import vòng

    email = email.strip().lower()
    if users.find_one({"email": email}):
        raise HTTPException(409, "Email đã được dùng")
    doc = {"email": email, "name": name.strip(), "password_hash": hash_password(password),
           "role": role, "active": True, "created_at": db.now()}
    doc["_id"] = users.insert_one(doc).inserted_id
    create_personal_space(doc)
    return doc


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str
    password: str


class NewUser(BaseModel):
    email: str
    name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=200)
    role: Literal["admin", "member"] = "member"

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        if not EMAIL_RE.match(v.strip()):
            raise ValueError("Email không hợp lệ")
        return v.strip().lower()


class UserPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    role: Literal["admin", "member"] | None = None
    active: bool | None = None
    password: str | None = Field(None, min_length=8, max_length=200)


class PasswordChange(BaseModel):
    current: str
    new: str = Field(min_length=8, max_length=200)


@router.get("/auth/setup")
def setup_status():
    return {"needs_setup": users.count_documents({}, limit=1) == 0}


def session_user(user: dict) -> dict:
    """Người đang đăng nhập (login / setup / me) = public_user + cờ menu Học tập (`policy.learn_flags`)."""
    from . import policy   # policy.py nhập auth.py — nhập muộn để tránh vòng import
    return public_user(user) | policy.learn_flags(user)


@router.post("/auth/setup", status_code=201)
def setup(body: NewUser, response: Response):
    """Lần chạy đầu: tạo tài khoản quản trị đầu tiên."""
    if users.count_documents({}, limit=1):
        raise HTTPException(409, "Hệ thống đã có tài khoản quản trị")
    user = create_user(body.email, body.name, body.password, role="admin")
    record_login(user)
    start_session(response, user)
    return session_user(user)


@router.post("/auth/login")
def login(body: Credentials, response: Response):
    user = users.find_one({"email": body.email.strip().lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Sai email hoặc mật khẩu")
    if not user.get("active", True):
        raise HTTPException(403, "Tài khoản đã bị khoá")
    record_login(user)
    start_session(response, user)
    return session_user(user)


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response):
    if token := request.cookies.get(SESSION_COOKIE):
        sessions.delete_one({"_id": token})
    response.delete_cookie(SESSION_COOKIE)
    response.status_code = 204
    return response


@router.get("/auth/me")
def me(user: dict = Depends(current_user)):
    return session_user(user)


@router.post("/auth/me/password", status_code=204)
def change_password(body: PasswordChange, user: dict = Depends(current_user)):
    if not verify_password(body.current, user["password_hash"]):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")
    users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(body.new)}})
    return Response(status_code=204)


class TokenIn(BaseModel):
    name: str = Field("AI", min_length=1, max_length=60)


@router.get("/auth/tokens")
def list_tokens(user: dict = Depends(current_user)):
    # token tạm của khung chat trong app (xoá khi lượt xong) không hiện ở đây
    return [token_out(t) for t in api_tokens.find({"user_id": user["_id"], "internal": {"$exists": False}})
            .sort("created_at", -1)]


@router.post("/auth/tokens", status_code=201)
def create_token(body: TokenIn, user: dict = Depends(current_user)):
    token, doc = issue_api_token(user, body.name)
    return token_out(doc) | {"token": token}


@router.delete("/auth/tokens/{token_id}", status_code=204)
def revoke_token(token_id: str, user: dict = Depends(current_user)):
    if len(token_id) != 16 or not api_tokens.delete_one(
            {"user_id": user["_id"], "_id": {"$regex": f"^{re.escape(token_id)}"}}).deleted_count:
        raise HTTPException(404, "Không tìm thấy token")
    return Response(status_code=204)


@router.get("/users")
def list_users(q: str | None = None, unit_id: str | None = None, no_unit: bool = False, limit: int = 200,
               user: dict = Depends(current_user)):
    """Mọi thành viên đều xem được danh sách (để chọn người chia sẻ kho, xem sơ đồ tổ chức).
    Kèm hồ sơ tổ chức rút gọn `org`. `last_login_at` (SYS-36) chỉ trả cho quản trị viên (null = chưa đăng nhập). Lọc: `unit_id` (người thuộc đơn vị, kể cả kiêm nhiệm), `no_unit` (chưa xếp đơn vị)."""
    f: dict = {}
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        f = {"$or": [{"email": rx}, {"name": rx}]}
    if unit_id:
        try:
            f["org.unit_ids"] = ObjectId(unit_id)
        except InvalidId:
            return []
    elif no_unit:
        f["org.unit_ids.0"] = {"$exists": False}
    is_admin = user["role"] == "admin"
    return [public_user(u) | {"org": org_brief(u)} | ({"last_login_at": u.get("last_login_at")} if is_admin else {})
            for u in users.find(f).sort("name", 1).limit(max(1, min(limit, 2000)))]


@router.post("/users", status_code=201)
def add_user(body: NewUser, _admin: dict = Depends(require_admin)):
    return public_user(create_user(body.email, body.name, body.password, body.role))


@router.patch("/users/{user_id}")
def patch_user(user_id: str, body: UserPatch, admin: dict = Depends(require_admin)):
    try:
        oid = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(404, "Không tìm thấy người dùng") from None
    target = users.find_one({"_id": oid})
    if not target:
        raise HTTPException(404, "Không tìm thấy người dùng")
    if oid == admin["_id"] and (body.role == "member" or body.active is False):
        raise HTTPException(400, "Không tự hạ quyền hoặc tự khoá tài khoản của mình")
    changes = body.model_dump(exclude_none=True, exclude={"password"})
    if body.password:
        changes["password_hash"] = hash_password(body.password)
    extra: dict = {}
    if body.active is True and (target.get("org") or {}).get("status") == "left":
        # Mở khoá người đã xử lý nghỉ việc = cho đi làm lại (QA B4): hồ sơ tổ chức về `active`, lần nghỉ việc
        # chuyển vào lịch sử `org_history`. Vai trò đã chuyển cho quản lý không tự trả lại — cấp lại nếu cần.
        changes |= {"org.status": "active"}
        extra = {"$unset": {"org_left": ""},
                 "$push": {"org_history": {"left": target.get("org_left"), "rejoined_at": db.now(),
                                           "rejoined_by": admin["_id"]}}}
    if changes:
        users.update_one({"_id": oid}, {"$set": changes} | extra)
    if body.active is False:
        lock_user(oid)
    elif body.password:
        sessions.delete_many({"user_id": oid})   # đăng xuất khỏi mọi thiết bị
    return public_user(users.find_one({"_id": oid}))
