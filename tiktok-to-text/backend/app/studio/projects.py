"""Dự án marketing (BA mục 5.13, CE-25 · CE-26 · CE-32) — tầng trên chiến dịch và Viết nhanh.

  Kho (space) ─► Dự án: thành viên + vai trò dự án · kho tài nguyên tham chiếu (R video · S trang web · P bài mẫu ·
  D tài liệu Kho tư liệu) · thẻ VCWIKI ghim (K) · khoá học ghim (L) ─► chiến dịch / Viết nhanh gắn `project_id`.
Đợt 1: khung dự án + tài nguyên + phân quyền. Phân tích 7P, kế hoạch kỳ, lịch đăng: đợt sau (CE-27…31).
"""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from .. import db, policy
from ..auth import current_user, users
from ..config import STUDIO_MAX_REFS
from ..kb.pipeline import cards, documents
from ..kb.wiki import AI_CARD_TYPES
from ..learn.models import learning_paths
from ..kb.routes import names_of, oid, out, plain, space_names
from ..spaces import personal_space
from . import ai, campaigns, quick_pieces, refs, serp
from . import marketing_projects as projects   # collection studio_projects (tên khác module này)

router = APIRouter(prefix="/api/studio/projects")

Role = Literal["owner", "editor", "reviewer", "viewer"]
Kind = Literal["video", "url", "social_post", "document"]
Status = Literal["active", "archived"]

MAX_RESOURCES = 60      # tài nguyên mỗi dự án
MAX_PINS = 40           # thẻ / khoá ghim mỗi loại
PREFIX = {"video": "R", "url": "S", "social_post": "P", "document": "D", "card": "K", "course": "L"}
KIND_LABEL = {"video": "video Kho video", "url": "trang web", "social_post": "bài mẫu", "document": "tài liệu Kho tư liệu"}
ROLE_LABEL = {"owner": "Chủ dự án", "editor": "Biên tập", "reviewer": "Người duyệt", "viewer": "Chỉ xem"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProjectIn(BaseModel):
    space_id: str | None = None
    name: str = Field(min_length=1, max_length=150)
    goal: str = Field("", max_length=2000)
    description: str = Field("", max_length=5000)


class ProjectPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    goal: str | None = Field(None, max_length=2000)
    description: str | None = Field(None, max_length=5000)
    status: Status | None = None


class MemberIn(BaseModel):
    user_id: str | None = None
    email: str | None = Field(None, max_length=200)
    role: Role = "editor"


class MemberRole(BaseModel):
    role: Role


class ResourceIn(BaseModel):
    kind: Kind
    video_id: str | None = Field(None, max_length=40)
    url: str | None = Field(None, max_length=1000)
    document_id: str | None = None
    title: str = Field("", max_length=200)
    channel: str = Field("fanpage", max_length=30)    # bài mẫu: kênh MXH (ai.CHANNELS) — dùng làm P… của chiến dịch
    text: str = Field("", max_length=8000)
    note: str = Field("", max_length=500)

    @field_validator("url")
    @classmethod
    def _url(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        if v and not re.match(r"https?://\S+$", v):
            raise ValueError(f"Link không hợp lệ: {v[:80]}")
        return v or None


class PinIn(BaseModel):
    card_id: str | None = None
    course_id: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_project(project_id, user: dict, action: str = "project.read") -> dict:
    """Dự án theo id + kiểm tra quyền qua policy: không xem được / không có -> 404, thiếu quyền -> 403."""
    p = projects.find_one({"_id": project_id if not isinstance(project_id, str) else oid(project_id, "dự án")})
    if not p:
        raise HTTPException(404, "Không tìm thấy dự án")
    policy.require(user, action, p, "dự án")
    return p


def project_names(ids) -> dict:
    return {p["_id"]: p["name"] for p in projects.find({"_id": {"$in": [i for i in set(ids) if i]}}, {"name": 1})}


def _strip(r: dict) -> dict:
    return {k: v for k, v in r.items() if k != "text"} | {"has_text": bool(r.get("text"))}


def project_out(p: dict, user: dict, full: bool = False, snames: dict | None = None) -> dict:
    snames = snames if snames is not None else space_names([p["space_id"]])
    role = policy.project_role(user, p)
    extra = {"space_name": snames.get(p["space_id"]), "my_role": role,
             "can_edit": policy.can(user, "project.write", p), "can_manage": policy.can(user, "project.manage", p),
             "resource_count": len(p.get("resources") or []), "card_count": len(p.get("cards") or []),
             "course_count": len(p.get("courses") or []), "member_count": len(p.get("members") or [])}
    if not full:
        return out({k: v for k, v in p.items() if k not in ("resources", "cards", "courses", "members", "counters")}, extra)
    people = names_of([m["user_id"] for m in p.get("members", [])] + [p["created_by"]])
    extra |= {"created_by_name": people.get(p["created_by"]),
              "members": [{"user_id": str(m["user_id"]), "name": people.get(m["user_id"]), "role": m["role"],
                           "role_label": ROLE_LABEL[m["role"]]} for m in p.get("members", [])],
              "resources": plain([_strip(r) for r in p.get("resources") or []]),
              "analysis": _current_analysis(p),
              "campaign_count": campaigns.count_documents({"project_id": p["_id"]}),
              "quick_count": quick_pieces.count_documents({"project_id": p["_id"]})}
    return out({k: v for k, v in p.items() if k not in ("resources", "members", "counters")}, extra)


def _current_analysis(p: dict) -> dict | None:
    from . import analyses
    a = analyses.find_one({"_id": p.get("analysis_id")}, {"version": 1, "framework": 1, "finalized_at": 1}) if p.get("analysis_id") else None
    return out(a) if a else None


def next_ref(p: dict, kind: str) -> str:
    """Mã tham chiếu tăng dần theo loại (R1, R2… / S… / P… / D… / K… / L…), không đánh lại khi xoá — giữ căn cứ cũ."""
    n = (p.get("counters") or {}).get(PREFIX[kind], 0) + 1
    projects.update_one({"_id": p["_id"]}, {"$set": {f"counters.{PREFIX[kind]}": n}})
    return f"{PREFIX[kind]}{n}"


def _touch(pid) -> dict:
    projects.update_one({"_id": pid}, {"$set": {"updated_at": db.now()}})
    return projects.find_one({"_id": pid})


def _owners_left(p: dict, without_uid) -> bool:
    return any(m["role"] == "owner" and m["user_id"] != without_uid for m in p.get("members", []))


def resources_of(p: dict | None, kind: str) -> list[dict]:
    return [r for r in (p or {}).get("resources") or [] if r["kind"] == kind]


# ---------------------------------------------------------------------------
# Dự án (CE-25)
# ---------------------------------------------------------------------------

@router.get("")
def list_projects(space_id: str | None = None, q: str | None = None, status: str = "active",
                  user: dict = Depends(current_user)):
    f = policy.visible_projects_filter(user)
    if space_id:
        f = {"$and": [f, {"space_id": policy.load_space(space_id, user)["_id"]}]}
    if status != "all":
        f = {"$and": [f, {"status": status}]}
    if q and q.strip():
        f = {"$and": [f, {"name": {"$regex": re.escape(q.strip()), "$options": "i"}}]}
    rows = list(projects.find(f, {"resources": 0, "cards": 0, "courses": 0}).sort("updated_at", -1))
    snames = space_names([p["space_id"] for p in rows])
    return [project_out(p, user, snames=snames) for p in rows]


@router.post("", status_code=201)
def create_project(body: ProjectIn, user: dict = Depends(current_user)):
    space = policy.load_space(body.space_id, user, "space.write") if body.space_id else personal_space(user)
    now = db.now()
    doc = {"space_id": space["_id"], "name": body.name.strip(), "goal": body.goal.strip(),
           "description": body.description.strip(), "status": "active", "created_by": user["_id"],
           "members": [{"user_id": user["_id"], "role": "owner", "added_at": now}],
           "resources": [], "cards": [], "courses": [], "counters": {}, "analysis_id": None,
           "created_at": now, "updated_at": now}
    doc["_id"] = projects.insert_one(doc).inserted_id
    return project_out(doc, user, full=True)


@router.get("/{project_id}")
def get_project(project_id: str, user: dict = Depends(current_user)):
    return project_out(load_project(project_id, user), user, full=True)


@router.patch("/{project_id}")
def patch_project(project_id: str, body: ProjectPatch, user: dict = Depends(current_user)):
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    p = load_project(project_id, user, "project.manage" if "status" in changes else "project.write")
    changes = {k: v.strip() if isinstance(v, str) else v for k, v in changes.items()}
    if changes:
        projects.update_one({"_id": p["_id"]}, {"$set": changes | {"updated_at": db.now()}})
    return project_out(projects.find_one({"_id": p["_id"]}), user, full=True)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str, user: dict = Depends(current_user)):
    """Xoá cứng chỉ khi chưa có chiến dịch / Viết nhanh nào gắn vào; có rồi thì lưu trữ (`status=archived`)."""
    p = load_project(project_id, user, "project.manage")
    n = campaigns.count_documents({"project_id": p["_id"]}) + quick_pieces.count_documents({"project_id": p["_id"]})
    if n:
        raise HTTPException(409, f"Dự án đang có {n} chiến dịch / nội dung gắn vào — hãy lưu trữ thay vì xoá")
    projects.delete_one({"_id": p["_id"]})
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Thành viên (CE-32)
# ---------------------------------------------------------------------------

@router.post("/{project_id}/members")
def add_member(project_id: str, body: MemberIn, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.manage")
    if body.user_id:
        target = users.find_one({"_id": oid(body.user_id, "người dùng"), "active": True})
    elif body.email:
        target = users.find_one({"email": body.email.strip().lower(), "active": True})
    else:
        raise HTTPException(400, "Cần user_id hoặc email")
    if not target:
        raise HTTPException(404, "Không tìm thấy người dùng")
    if any(m["user_id"] == target["_id"] for m in p["members"]):
        projects.update_one({"_id": p["_id"], "members.user_id": target["_id"]},
                            {"$set": {"members.$.role": body.role, "updated_at": db.now()}})
    else:
        projects.update_one({"_id": p["_id"]}, {"$push": {"members": {"user_id": target["_id"], "role": body.role,
                                                                     "added_at": db.now()}},
                                                "$set": {"updated_at": db.now()}})
    return project_out(projects.find_one({"_id": p["_id"]}), user, full=True)


@router.patch("/{project_id}/members/{user_id}")
def set_member_role(project_id: str, user_id: str, body: MemberRole, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.manage")
    uid = oid(user_id, "thành viên")
    if not any(m["user_id"] == uid for m in p["members"]):
        raise HTTPException(404, "Không tìm thấy thành viên")
    if body.role != "owner" and not _owners_left(p, uid):
        raise HTTPException(400, "Dự án cần ít nhất một chủ dự án")
    projects.update_one({"_id": p["_id"], "members.user_id": uid},
                        {"$set": {"members.$.role": body.role, "updated_at": db.now()}})
    return project_out(projects.find_one({"_id": p["_id"]}), user, full=True)


@router.delete("/{project_id}/members/{user_id}")
def remove_member(project_id: str, user_id: str, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.manage")
    uid = oid(user_id, "thành viên")
    if not any(m["user_id"] == uid for m in p["members"]):
        raise HTTPException(404, "Không tìm thấy thành viên")
    if not _owners_left(p, uid):
        raise HTTPException(400, "Dự án cần ít nhất một chủ dự án")
    projects.update_one({"_id": p["_id"]}, {"$pull": {"members": {"user_id": uid}}, "$set": {"updated_at": db.now()}})
    return project_out(projects.find_one({"_id": p["_id"]}), user, full=True)


# ---------------------------------------------------------------------------
# Kho tài nguyên tham chiếu (CE-26)
# ---------------------------------------------------------------------------

def _dup(p: dict, key: str, value) -> None:
    if any(r.get(key) == value for r in p.get("resources") or []):
        raise HTTPException(409, "Tài nguyên này đã có trong dự án")


def _snapshot(body: ResourceIn, p: dict, user: dict) -> dict:
    """Ảnh chụp nội dung lúc thêm: kho video / tài liệu / trang web đổi sau này không làm lệch căn cứ."""
    if body.kind == "video":
        if not body.video_id:
            raise HTTPException(400, "Thiếu video_id")
        _dup(p, "video_id", body.video_id)
        rows = refs.find_references(video_ids=[body.video_id])
        if not rows:
            raise HTTPException(404, "Video không có trong Kho video hoặc chưa chuyển chữ")
        v = rows[0]
        return {"video_id": v["_id"], "title": (v.get("caption") or "")[:200] or v["_id"]} | \
            {k: w for k, w in refs.ref_out(v).items() if k not in ("id", "caption")} | {"text": v.get("transcript") or ""}
    if body.kind == "url":
        if not body.url:
            raise HTTPException(400, "Thiếu link")
        _dup(p, "url", body.url)
        page = serp.fetch_page(body.url)
        if page["status"] != "ok":
            raise HTTPException(400, f"Không tải được trang: {page['error']}")
        return {"url": body.url, "title": body.title.strip() or page["title"], "words": page["words"],
                "headings": page["headings"], "text": page["text"]}
    if body.kind == "social_post":
        if len(body.text.strip()) < 20:
            raise HTTPException(400, "Bài mẫu cần ít nhất 20 ký tự")
        if body.channel not in ai.CHANNELS:
            raise HTTPException(400, "Kênh không hợp lệ")
        return {"title": body.title.strip() or body.text.strip()[:80], "channel": body.channel,
                "url": body.url, "text": body.text.strip()}
    # document
    if not body.document_id:
        raise HTTPException(400, "Thiếu document_id")
    did = oid(body.document_id, "tài liệu")
    _dup(p, "document_id", did)
    d = documents.find_one({"_id": did} | policy.visible_filter(user, "document"), {"title": 1, "url": 1, "text": 1,
                                                                                    "source_id": 1})
    if not d:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    return {"document_id": d["_id"], "source_id": d.get("source_id"), "title": d.get("title") or "Tài liệu",
            "url": d.get("url"), "text": (d.get("text") or "")[:20000]}


@router.post("/{project_id}/resources")
def add_resource(project_id: str, body: ResourceIn, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    if len(p.get("resources") or []) >= MAX_RESOURCES:
        raise HTTPException(400, f"Mỗi dự án tối đa {MAX_RESOURCES} tài nguyên")
    r = {"ref": next_ref(p, body.kind), "kind": body.kind, "note": body.note.strip(), "added_by": user["_id"],
         "added_at": db.now()} | _snapshot(body, p, user)
    projects.update_one({"_id": p["_id"]}, {"$push": {"resources": r}})
    return project_out(_touch(p["_id"]), user, full=True)


@router.get("/{project_id}/resources/{ref}")
def get_resource(project_id: str, ref: str, user: dict = Depends(current_user)):
    p = load_project(project_id, user)
    r = next((r for r in p.get("resources") or [] if r["ref"] == ref), None)
    if not r:
        raise HTTPException(404, "Không tìm thấy tài nguyên")
    return out(r, {"added_by_name": names_of([r["added_by"]]).get(r["added_by"])}) | {"text": r.get("text") or ""}


@router.delete("/{project_id}/resources/{ref}")
def remove_resource(project_id: str, ref: str, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    if not any(r["ref"] == ref for r in p.get("resources") or []):
        raise HTTPException(404, "Không tìm thấy tài nguyên")
    projects.update_one({"_id": p["_id"]}, {"$pull": {"resources": {"ref": ref}}})
    return project_out(_touch(p["_id"]), user, full=True)


# ---------------------------------------------------------------------------
# Thẻ VCWIKI + khoá học ghim (CE-26)
# ---------------------------------------------------------------------------

@router.post("/{project_id}/cards")
def pin_card(project_id: str, body: PinIn, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    if not body.card_id:
        raise HTTPException(400, "Thiếu card_id")
    cid = oid(body.card_id, "thẻ")
    if any(c["card_id"] == cid for c in p.get("cards") or []):
        raise HTTPException(409, "Thẻ đã ghim")
    if len(p.get("cards") or []) >= MAX_PINS:
        raise HTTPException(400, f"Mỗi dự án ghim tối đa {MAX_PINS} thẻ")
    c = cards.find_one({"_id": cid, "type": {"$nin": list(AI_CARD_TYPES)}} | policy.visible_filter(user, "card"),
                       {"title": 1, "type": 1, "status": 1, "summary": 1})
    if not c:
        raise HTTPException(404, "Không tìm thấy thẻ")
    pin = {"ref": next_ref(p, "card"), "card_id": cid, "title": c["title"], "type": c["type"], "status": c["status"],
           "summary": c.get("summary", ""), "added_by": user["_id"], "added_at": db.now()}
    projects.update_one({"_id": p["_id"]}, {"$push": {"cards": pin}})
    return project_out(_touch(p["_id"]), user, full=True)


@router.delete("/{project_id}/cards/{ref}")
def unpin_card(project_id: str, ref: str, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    if not any(c["ref"] == ref for c in p.get("cards") or []):
        raise HTTPException(404, "Không tìm thấy thẻ ghim")
    projects.update_one({"_id": p["_id"]}, {"$pull": {"cards": {"ref": ref}}})
    return project_out(_touch(p["_id"]), user, full=True)


@router.post("/{project_id}/courses")
def pin_course(project_id: str, body: PinIn, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    if not body.course_id:
        raise HTTPException(400, "Thiếu course_id")
    lid = oid(body.course_id, "khoá học")
    if any(c["course_id"] == lid for c in p.get("courses") or []):
        raise HTTPException(409, "Khoá đã ghim")
    if len(p.get("courses") or []) >= MAX_PINS:
        raise HTTPException(400, f"Mỗi dự án ghim tối đa {MAX_PINS} khoá")
    course = learning_paths.find_one({"_id": lid}, {"title": 1, "description": 1})
    if not course:
        raise HTTPException(404, "Không tìm thấy khoá học")
    pin = {"ref": next_ref(p, "course"), "course_id": lid, "title": course.get("title") or "Khoá học",
           "added_by": user["_id"], "added_at": db.now()}
    projects.update_one({"_id": p["_id"]}, {"$push": {"courses": pin}})
    return project_out(_touch(p["_id"]), user, full=True)


@router.delete("/{project_id}/courses/{ref}")
def unpin_course(project_id: str, ref: str, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    if not any(c["ref"] == ref for c in p.get("courses") or []):
        raise HTTPException(404, "Không tìm thấy khoá ghim")
    projects.update_one({"_id": p["_id"]}, {"$pull": {"courses": {"ref": ref}}})
    return project_out(_touch(p["_id"]), user, full=True)


# ---------------------------------------------------------------------------
# Tìm để thêm (dùng cho tab Tài nguyên / Thẻ học)
# ---------------------------------------------------------------------------

@router.get("/{project_id}/pick/documents")
def pick_documents(project_id: str, q: str = "", limit: int = Query(12, ge=1, le=30),
                   user: dict = Depends(current_user)):
    load_project(project_id, user)
    f = policy.visible_filter(user, "document")
    if q.strip():
        f["title"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    rows = documents.find(f, {"title": 1, "url": 1, "wiki_status": 1, "created_at": 1}).sort("created_at", -1).limit(limit)
    return [out(d) for d in rows]


@router.get("/{project_id}/pick/courses")
def pick_courses(project_id: str, q: str = "", limit: int = Query(12, ge=1, le=30),
                 user: dict = Depends(current_user)):
    load_project(project_id, user)
    f = {"title": {"$regex": re.escape(q.strip()), "$options": "i"}} if q.strip() else {}
    return [out(c) for c in learning_paths.find(f, {"title": 1, "description": 1}).sort("title", 1).limit(limit)]


@router.get("/{project_id}/pick/videos")
def pick_videos(project_id: str, q: str = "", channel: str | None = None, tag: str | None = None,
                limit: int = Query(12, ge=1, le=STUDIO_MAX_REFS), user: dict = Depends(current_user)):
    load_project(project_id, user)
    return [refs.ref_out(r) for r in refs.find_references(q or None, channel, tag, limit=limit)]
