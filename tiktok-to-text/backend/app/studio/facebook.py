"""Đăng bài mạng xã hội lên Facebook (Content Engine, BA 5.14 — CE-21 đợt 1).

  Đích đăng (`studio_fb_targets`, theo kho):
    page     Fanpage — Page access token, đăng thẳng qua Graph API (`POST /{page}/feed`), hẹn giờ bằng
             `scheduled_publish_time` của Facebook (máy mình không cần chạy lúc đến giờ).
    group    Nhóm — Facebook đóng Groups API từ 04/2024: đăng hỗ trợ (chép bài → mở nhóm → dán link bài đã đăng).
    profile  Trang cá nhân — Facebook bỏ quyền đăng thay người dùng từ 2018: cũng đăng hỗ trợ như nhóm.

  Nội dung đăng được: Viết nhanh "Bài Facebook" và bài MXH của chiến dịch, đã duyệt. Mỗi lần đăng thêm một mục vào
  `publications[]` của nội dung; đăng xong ghi `published_url`, `published_at`.

Token không bao giờ trả ra API. Kết nối bằng token người dùng (Graph API Explorer, quyền pages_show_list,
pages_manage_posts, pages_read_engagement) thì lấy hết Fanpage người đó quản trị; có FB_APP_ID + FB_APP_SECRET thì
đổi sang token dài hạn trước để Page token không hết hạn.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Literal
from urllib.parse import quote, urlparse

import requests
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator

from .. import db, policy
from ..auth import current_user
from ..config import FB_APP_ID, FB_APP_SECRET, FB_GRAPH_URL, FB_GRAPH_VERSION
from ..kb.routes import load, oid, out, space_names, space_scope
from ..spaces import personal_space
from . import quick, quick_pieces, scripts

targets = db.db["studio_fb_targets"]
router = APIRouter(prefix="/api/studio/facebook")

KINDS = {"page": "Fanpage", "group": "Nhóm Facebook", "profile": "Trang cá nhân"}
FB_HOSTS = ("facebook.com", "fb.com", "fb.me", "fb.watch")
MAX_MESSAGE = 63_206                  # giới hạn ký tự bài đăng của Facebook
SCHEDULE_MIN = timedelta(minutes=10)  # Graph API: hẹn giờ từ 10 phút tới 30 ngày
SCHEDULE_MAX = timedelta(days=30)


def ensure_indexes() -> None:
    targets.create_index([("space_id", 1), ("kind", 1), ("name", 1)])
    targets.create_index([("space_id", 1), ("fb_id", 1)])


# ---------------------------------------------------------------------------
# Graph API
# ---------------------------------------------------------------------------

class FacebookError(Exception):
    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code = code


def _explain(err: dict) -> str:
    code, sub = err.get("code"), err.get("error_subcode")
    msg = err.get("error_user_msg") or err.get("message") or "lỗi không rõ"
    if code == 190:
        return "Token Facebook hết hạn hoặc đã bị thu hồi — kết nối lại Fanpage"
    if code in (10, 200) or (isinstance(code, int) and 200 <= code < 300):
        return f"Token thiếu quyền (cần pages_manage_posts, pages_read_engagement; người cấp phải là quản trị Fanpage): {msg}"
    if code == 368:
        return f"Facebook tạm chặn đăng bài (nghi spam): {msg}"
    if code == 100 and sub == 33:
        return "Không tìm thấy Fanpage hoặc token không truy cập được Fanpage này"
    return f"Facebook báo lỗi ({code}): {msg}"


def graph(method: str, path: str, token: str | None = None, **params) -> dict:
    """Gọi Graph API; lỗi (mạng / Facebook trả `error`) -> FacebookError câu tiếng Việt."""
    url = f"{FB_GRAPH_URL}/{FB_GRAPH_VERSION}/{path.lstrip('/')}"
    if token:
        params["access_token"] = token
    try:
        res = requests.request(method, url, params=params if method == "GET" else None,
                               data=params if method != "GET" else None, timeout=30)
        body = res.json()
    except requests.RequestException as e:
        raise FacebookError(f"Không kết nối được Facebook: {e}") from None
    except ValueError:
        raise FacebookError(f"Facebook trả về dữ liệu lạ (HTTP {res.status_code})") from None
    if isinstance(body, dict) and body.get("error"):
        raise FacebookError(_explain(body["error"]), body["error"].get("code"))
    return body


def long_lived(token: str) -> str | None:
    """Đổi token người dùng ngắn hạn -> dài hạn (~60 ngày); Page token lấy từ token dài hạn không hết hạn."""
    if not (FB_APP_ID and FB_APP_SECRET):
        return None
    res = graph("GET", "oauth/access_token", grant_type="fb_exchange_token", client_id=FB_APP_ID,
                client_secret=FB_APP_SECRET, fb_exchange_token=token)
    return res.get("access_token")


def pages_of_token(token: str) -> tuple[list[dict], str]:
    """-> ([{fb_id, name, url, token}], token_kind). token_kind: page / user_long / user_short."""
    me = graph("GET", "me", token, fields="id,name,link", metadata=1)
    if (me.get("metadata") or {}).get("type") == "page":
        return [{"fb_id": me["id"], "name": me.get("name") or me["id"],
                 "url": me.get("link") or f"https://www.facebook.com/{me['id']}", "token": token}], "page"
    user_token, kind = token, "user_short"
    if lt := long_lived(token):
        user_token, kind = lt, "user_long"
    res = graph("GET", "me/accounts", user_token, fields="id,name,link,access_token", limit=100)
    pages = [{"fb_id": p["id"], "name": p.get("name") or p["id"],
              "url": p.get("link") or f"https://www.facebook.com/{p['id']}", "token": p["access_token"]}
             for p in res.get("data") or [] if p.get("access_token")]
    if not pages:
        raise FacebookError("Tài khoản này không quản trị Fanpage nào, hoặc token thiếu quyền pages_show_list")
    return pages, kind


def post_url(post_id: str) -> str:
    return f"https://www.facebook.com/{post_id}"


# ---------------------------------------------------------------------------
# Đích đăng
# ---------------------------------------------------------------------------

def fb_url(v: str | None, required: bool = False) -> str:
    v = (v or "").strip()
    if not v:
        if required:
            raise ValueError("Cần link Facebook")
        return ""
    host = (urlparse(v).hostname or "").lower()
    if not re.match(r"https?://\S+$", v) or not any(host == h or host.endswith("." + h) for h in FB_HOSTS):
        raise ValueError(f"Link phải là link Facebook: {v[:80]}")
    return v


class PagesIn(BaseModel):
    space_id: str | None = None
    token: str = Field(min_length=20, max_length=2000)


class TargetIn(BaseModel):
    space_id: str | None = None
    kind: Literal["group", "profile"]
    name: str = Field(min_length=1, max_length=200)
    url: str = Field("", max_length=500)

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        return fb_url(v)


class TargetPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    url: str | None = Field(None, max_length=500)

    @field_validator("url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        return None if v is None else fb_url(v)


def target_out(t: dict, user: dict, snames: dict | None = None) -> dict:
    snames = snames if snames is not None else space_names([t["space_id"]])
    return out({k: v for k, v in t.items() if k != "token"},
               {"kind_label": KINDS[t["kind"]], "mode": "api" if t["kind"] == "page" else "manual",
                "space_name": snames.get(t["space_id"]),
                "can_edit": policy.can(user, "space.write", {"space_id": t["space_id"]})})


def _space_for_write(space_id: str | None, user: dict) -> dict:
    return policy.load_space(space_id, user, "space.write") if space_id else personal_space(user)


@router.get("/status")
def fb_status(_user: dict = Depends(current_user)):
    return {"graph_version": FB_GRAPH_VERSION, "app_configured": bool(FB_APP_ID and FB_APP_SECRET), "kinds": KINDS}


@router.get("/targets")
def list_targets(space_id: str | None = None, user: dict = Depends(current_user)):
    rows = list(targets.find(space_scope(space_id, user, kind="fb_target")).sort([("kind", 1), ("name", 1)]))
    snames = space_names([t["space_id"] for t in rows])
    return [target_out(t, user, snames) for t in rows]


@router.post("/targets/pages", status_code=201)
def connect_pages(body: PagesIn, user: dict = Depends(current_user)):
    """Dán token (người dùng hoặc Fanpage) -> thêm / cập nhật mọi Fanpage token truy cập được vào kho."""
    space = _space_for_write(body.space_id, user)
    try:
        pages, kind = pages_of_token(body.token.strip())
    except FacebookError as e:
        raise HTTPException(400, str(e)) from None
    now, saved = db.now(), []
    for p in pages:
        doc = {"space_id": space["_id"], "kind": "page", "fb_id": p["fb_id"], "name": p["name"], "url": p["url"],
               "token": p["token"], "token_kind": kind, "status": "ok", "error": None, "checked_at": now,
               "updated_at": now}
        targets.update_one({"space_id": space["_id"], "kind": "page", "fb_id": p["fb_id"]},
                           {"$set": doc, "$setOnInsert": {"created_by": user["_id"], "created_at": now}}, upsert=True)
        saved.append(targets.find_one({"space_id": space["_id"], "kind": "page", "fb_id": p["fb_id"]}))
    return [target_out(t, user) for t in saved]


@router.post("/targets", status_code=201)
def create_target(body: TargetIn, user: dict = Depends(current_user)):
    if body.kind == "group" and not body.url:
        raise HTTPException(400, "Nhóm cần link nhóm Facebook để mở khi đăng")
    space = _space_for_write(body.space_id, user)
    now = db.now()
    doc = {"space_id": space["_id"], "kind": body.kind, "fb_id": None, "name": body.name.strip(), "url": body.url,
           "status": "ok", "error": None, "created_by": user["_id"], "created_at": now, "updated_at": now}
    doc["_id"] = targets.insert_one(doc).inserted_id
    return target_out(doc, user)


@router.patch("/targets/{target_id}")
def patch_target(target_id: str, body: TargetPatch, user: dict = Depends(current_user)):
    t, _ = load(targets, target_id, user, "space.write", "kênh Facebook")
    changes = body.model_dump(exclude_none=True)
    if t["kind"] == "group" and changes.get("url") == "":
        raise HTTPException(400, "Nhóm cần link nhóm Facebook để mở khi đăng")
    if changes:
        targets.update_one({"_id": t["_id"]}, {"$set": changes | {"updated_at": db.now()}})
    return target_out(targets.find_one({"_id": t["_id"]}), user)


@router.delete("/targets/{target_id}", status_code=204)
def delete_target(target_id: str, user: dict = Depends(current_user)):
    t, _ = load(targets, target_id, user, "space.write", "kênh Facebook")
    targets.delete_one({"_id": t["_id"]})   # bài đã đăng giữ bản chụp tên kênh trong publications[]
    return Response(status_code=204)


@router.post("/targets/{target_id}/check")
def check_target(target_id: str, user: dict = Depends(current_user)):
    """Fanpage: thử token còn dùng được không (đọc tên trang)."""
    t, _ = load(targets, target_id, user, "space.write", "kênh Facebook")
    if t["kind"] != "page":
        raise HTTPException(400, "Chỉ Fanpage mới kết nối bằng token")
    try:
        me = graph("GET", t["fb_id"], t["token"], fields="id,name")
        changes = {"status": "ok", "error": None, "name": me.get("name") or t["name"]}
    except FacebookError as e:
        changes = {"status": "error", "error": str(e)}
    targets.update_one({"_id": t["_id"]}, {"$set": changes | {"checked_at": db.now()}})
    return target_out(targets.find_one({"_id": t["_id"]}), user)


# ---------------------------------------------------------------------------
# Đăng bài
# ---------------------------------------------------------------------------

Source = Literal["quick", "script"]
COLLECTIONS = {"quick": quick_pieces, "script": scripts}


class PublishIn(BaseModel):
    source: Source
    id: str
    target_id: str
    message: str = Field(min_length=1, max_length=MAX_MESSAGE)
    link: str = Field("", max_length=1000)
    first_comment: str = Field("", max_length=8000)
    scheduled_at: datetime | None = None

    @field_validator("link")
    @classmethod
    def _link(cls, v: str) -> str:
        v = v.strip()
        if v and not re.match(r"https?://\S+$", v):
            raise ValueError(f"Link không hợp lệ: {v[:80]}")
        return v


class PublicationIn(BaseModel):
    source: Source
    id: str
    publication_id: str


class ConfirmIn(PublicationIn):
    url: str = Field(min_length=1, max_length=500)

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        return fb_url(v, required=True)


def load_piece(source: str, piece_id: str, user: dict, action: str = "space.write") -> dict:
    p, _ = load(COLLECTIONS[source], piece_id, user, action, "nội dung")
    return p


def publishable(source: str, p: dict) -> None:
    if source == "quick" and p.get("type") != "fb_post":
        raise HTTPException(400, "Chỉ bài Facebook của Viết nhanh mới đăng được")
    if source == "script" and (p.get("flow") or "video") != "social":
        raise HTTPException(400, "Chỉ bài mạng xã hội của chiến dịch mới đăng được")
    if not p.get("content"):
        raise HTTPException(409, "Nội dung chưa viết xong")
    if p.get("review_status") != "approved":
        raise HTTPException(409, "Duyệt nội dung trước khi đăng")


def draft_of(p: dict) -> dict:
    """Bài soạn sẵn để đăng: chữ (mở đầu 1 + thân + hashtag), link UTM, bình luận đầu."""
    c = p.get("content") or {}
    link = (c.get("link") or {}).get("utm_url") or ""
    text = quick.text_post(c)
    return {"message": text, "link": link if link and link not in text else "",
            "first_comment": c.get("first_comment") or ""}


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _set_publication(coll, p: dict, pub_id, fields: dict, piece_fields: dict | None = None) -> None:
    coll.update_one({"_id": p["_id"], "publications.id": pub_id},
                    {"$set": {f"publications.$.{k}": v for k, v in fields.items()} | (piece_fields or {})
                     | {"updated_at": db.now()}})


def publications_of(coll, p: dict) -> list[dict]:
    return [out(x) for x in (coll.find_one({"_id": p["_id"]}, {"publications": 1}).get("publications") or [])]


@router.get("/draft")
def get_draft(source: Source, id: str, user: dict = Depends(current_user)):
    p = load_piece(source, id, user, "space.read")
    return draft_of(p) | {"publications": [out(x) for x in p.get("publications") or []]}


@router.post("/publish")
def publish(body: PublishIn, user: dict = Depends(current_user)):
    coll = COLLECTIONS[body.source]
    p = load_piece(body.source, body.id, user)
    publishable(body.source, p)
    t, _ = load(targets, body.target_id, user, "space.write", "kênh Facebook")
    now = db.now()
    when = _as_utc(body.scheduled_at) if body.scheduled_at else None
    if when and t["kind"] == "page" and not (now + SCHEDULE_MIN <= when <= now + SCHEDULE_MAX):
        raise HTTPException(400, "Hẹn giờ đăng Fanpage phải cách bây giờ từ 10 phút đến 30 ngày")
    pub = {"id": ObjectId(), "target_id": t["_id"], "target_kind": t["kind"], "target_name": t["name"],
           "mode": "api" if t["kind"] == "page" else "manual", "message": body.message, "link": body.link,
           "first_comment": body.first_comment, "scheduled_at": when, "status": None, "post_id": None, "url": None,
           "error": None, "warning": None, "by": user["_id"], "at": now}
    extra: dict = {}
    if t["kind"] == "page":
        params = {"message": body.message} | ({"link": body.link} if body.link else {})
        if when:
            params |= {"published": "false", "scheduled_publish_time": int(when.timestamp())}
        try:
            res = graph("POST", f"{t['fb_id']}/feed", t["token"], **params)
        except FacebookError as e:
            pub |= {"status": "error", "error": str(e)}
            coll.update_one({"_id": p["_id"]}, {"$push": {"publications": pub}})
            if e.code == 190:
                targets.update_one({"_id": t["_id"]}, {"$set": {"status": "error", "error": str(e), "checked_at": now}})
            raise HTTPException(400, str(e)) from None
        pub |= {"status": "scheduled" if when else "published", "post_id": res.get("id"),
                "url": post_url(res["id"]) if res.get("id") else None}
        if body.first_comment and not when and res.get("id"):
            try:
                graph("POST", f"{res['id']}/comments", t["token"], message=body.first_comment)
            except FacebookError as e:
                pub["warning"] = f"Đã đăng bài nhưng chưa đăng được bình luận đầu: {e}"
        piece_fields = ({"published_url": pub["url"], "published_at": now} if not when
                        else {"scheduled_at": when})
    else:
        pub["status"] = "manual"   # chờ người đăng dán link bài đã đăng
        piece_fields = {}
        extra = {"open_url": t.get("url") or "https://www.facebook.com/",
                 "share_url": f"https://www.facebook.com/sharer/sharer.php?u={quote(body.link, safe='')}"
                 if body.link else None}
    coll.update_one({"_id": p["_id"]}, {"$push": {"publications": pub},
                                        "$set": piece_fields | {"updated_at": db.now()}})
    return {"publication": out(pub), "publications": publications_of(coll, p)} | extra


def _find_pub(p: dict, pub_id: str) -> dict:
    pid = oid(pub_id, "lần đăng")
    pub = next((x for x in p.get("publications") or [] if x["id"] == pid), None)
    if not pub:
        raise HTTPException(404, "Không tìm thấy lần đăng")
    return pub


@router.post("/publications/confirm")
def confirm_publication(body: ConfirmIn, user: dict = Depends(current_user)):
    """Đăng hỗ trợ (nhóm / trang cá nhân): dán link bài đã đăng -> ghi nhận đã đăng."""
    coll = COLLECTIONS[body.source]
    p = load_piece(body.source, body.id, user)
    pub = _find_pub(p, body.publication_id)
    if pub["status"] not in ("manual", "published"):
        raise HTTPException(409, "Lần đăng này không chờ xác nhận")
    now = db.now()
    _set_publication(coll, p, pub["id"], {"status": "published", "url": body.url, "confirmed_at": now},
                     {"published_url": body.url, "published_at": now})
    return {"publications": publications_of(coll, p)}


@router.post("/publications/cancel")
def cancel_publication(body: PublicationIn, user: dict = Depends(current_user)):
    """Bỏ lần đăng hỗ trợ chưa xác nhận, hoặc huỷ bài Fanpage đang hẹn giờ (xoá bài hẹn trên Facebook)."""
    coll = COLLECTIONS[body.source]
    p = load_piece(body.source, body.id, user)
    pub = _find_pub(p, body.publication_id)
    if pub["status"] == "scheduled":
        t = targets.find_one({"_id": pub["target_id"]})
        if not t:
            raise HTTPException(409, "Kênh Facebook đã bị xoá — huỷ bài hẹn giờ trực tiếp trên Facebook")
        try:
            graph("DELETE", pub["post_id"], t["token"])
        except FacebookError as e:
            raise HTTPException(400, str(e)) from None
    elif pub["status"] != "manual":
        raise HTTPException(409, "Chỉ huỷ được lần đăng đang chờ xác nhận hoặc đang hẹn giờ")
    _set_publication(coll, p, pub["id"], {"status": "cancelled", "cancelled_at": db.now()},
                     {"scheduled_at": None} if pub["status"] == "scheduled" else None)
    return {"publications": publications_of(coll, p)}


@router.post("/publications/refresh")
def refresh_publications(source: Source, id: str, user: dict = Depends(current_user)):
    """Bài Fanpage hẹn giờ: hỏi Facebook đã lên chưa, lên rồi thì ghi đã đăng."""
    coll = COLLECTIONS[source]
    p = load_piece(source, id, user, "space.read")
    for pub in p.get("publications") or []:
        if pub["status"] != "scheduled":
            continue
        t = targets.find_one({"_id": pub["target_id"]})
        if not t:
            continue
        try:
            res = graph("GET", pub["post_id"], t["token"], fields="is_published,permalink_url")
        except FacebookError as e:
            _set_publication(coll, p, pub["id"], {"warning": str(e)})
            continue
        if res.get("is_published"):
            url = res.get("permalink_url") or pub["url"]
            _set_publication(coll, p, pub["id"], {"status": "published", "url": url, "warning": None},
                             {"published_url": url, "published_at": pub["scheduled_at"] or db.now()})
    return {"publications": publications_of(coll, p)}
