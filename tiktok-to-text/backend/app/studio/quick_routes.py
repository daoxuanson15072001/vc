"""API Viết nhanh (Content Engine). Nội dung thuộc một kho (mặc định kho cá nhân) — quyền như chiến dịch."""

from __future__ import annotations

import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from .. import db, policy
from ..auth import current_user
from ..config import STUDIO_PASS_SCORE, STUDIO_QUICK_MAX_ROUNDS
from ..kb import wiki
from ..kb.routes import load, names_of, oid, out, space_names, space_scope
from ..spaces import personal_space
from . import authors, quick, quick_pieces, refs
from .projects import load_project, project_names
from .routes import AUTHOR_SNAPSHOT, assign_project, can_edit, overall

router = APIRouter(prefix="/api/studio/quick")

TypeKey = Literal[tuple(quick.TYPES)]   # type: ignore[valid-type]


class QuickIn(BaseModel):
    type: TypeKey
    space_id: str | None = None
    project_id: str | None = None   # BA 5.13: viết trong dự án -> kho của dự án, thẻ ghim của dự án làm căn cứ
    inputs: dict[str, Any] = {}
    judge: bool | None = None       # None = mặc định của loại
    use_wiki: bool = True
    parent_id: str | None = None    # chuyển thể từ một nội dung Viết nhanh khác


class QuickPatch(BaseModel):
    review_status: Literal["draft", "approved", "rejected"] | None = None
    note: str | None = Field(None, max_length=4000)
    project_id: str | None = None   # gán / bỏ gán dự án (gửi null để bỏ)


class RewriteIn(BaseModel):
    feedback: str = Field("", max_length=2000)


LIST_FIELDS = {"type": 1, "title": 1, "status": 1, "stage": 1, "score": 1, "review_status": 1, "error": 1,
               "space_id": 1, "created_by": 1, "created_at": 1, "updated_at": 1, "parent_id": 1, "inputs.channel": 1,
               "inputs.platform": 1, "project_id": 1}


def piece_out(p: dict, user: dict, full: bool = True) -> dict:
    extra = {"overall": overall(p), "type_label": quick.TYPES.get(p["type"], {}).get("label", p["type"])}
    if full:
        extra |= {"can_edit": can_edit(p["space_id"], user), "text": quick.TYPES[p["type"]]["text"](p["content"])
                  if p.get("content") else None,
                  "project_name": project_names([p.get("project_id")]).get(p.get("project_id")),
                  "created_by_name": names_of([p["created_by"]]).get(p["created_by"]),
                  "space_name": space_names([p["space_id"]]).get(p["space_id"])}
    return out({k: v for k, v in p.items() if k != "source_page"} |
               {"source_page": {k: v for k, v in (p.get("source_page") or {}).items() if k != "text"} or None}, extra)


def _idle(p: dict) -> None:
    if p["status"] in ("queued", "generating"):
        raise HTTPException(409, "Nội dung đang được AI viết")


@router.get("/types")
def quick_types(_user: dict = Depends(current_user)):
    return quick.public_types() | {"ai": wiki.ai_status(), "pass_score": STUDIO_PASS_SCORE,
                                   "max_rounds": STUDIO_QUICK_MAX_ROUNDS}


@router.post("", status_code=201)
def create_quick(body: QuickIn, user: dict = Depends(current_user)):
    project = load_project(body.project_id, user, "project.write") if body.project_id else None
    if project:
        space = policy.load_space(project["space_id"], user, "space.read")
    else:
        space = policy.load_space(body.space_id, user, "space.write") if body.space_id else personal_space(user)
    try:
        inputs = quick.clean_inputs(body.type, body.inputs)
    except ValueError as e:
        raise HTTPException(400, str(e)) from None

    author = None
    if inputs.get("author_id"):
        a = authors.find_one({"_id": oid(inputs["author_id"], "người đứng tên")} | policy.visible_filter(user, "author"))
        if not a:
            raise HTTPException(404, "Không tìm thấy người đứng tên")
        if not a.get("consent"):
            raise HTTPException(400, f"{a['name']} chưa xác nhận đồng ý đứng tên")
        author = {"ref": "A1", "author_id": str(a["_id"])} | {k: a.get(k) for k in AUTHOR_SNAPSHOT}
    elif quick.is_personal(inputs):
        raise HTTPException(400, "Đăng trang cá nhân cần chọn người đứng tên")

    parent = None
    if body.parent_id:
        parent, _ = load(quick_pieces, body.parent_id, user, "space.read", "nội dung gốc")
        if not parent.get("content"):
            raise HTTPException(409, "Nội dung gốc chưa viết xong")

    card_rows = refs.find_cards(user, quick.wiki_query(inputs), limit=8) if body.use_wiki else []
    if project:   # thẻ ghim của dự án đứng trước thẻ tìm được
        pinned = [{"id": str(c["card_id"]), "title": c["title"], "type": c["type"], "status": c["status"]}
                  for c in project.get("cards") or []]
        seen = {c["id"] for c in pinned}
        card_rows = pinned + [c for c in card_rows if c["id"] not in seen]
    now = db.now()
    doc = {"type": body.type, "space_id": space["_id"], "project_id": project["_id"] if project else None,
           "analysis_id": (project or {}).get("analysis_id"),
           "created_by": user["_id"], "inputs": inputs,
           "judge": quick.TYPES[body.type]["judge"] if body.judge is None else body.judge,
           "use_wiki": body.use_wiki, "author": author, "parent_id": parent["_id"] if parent else None,
           "cards": [{"ref": f"K{i}", "card_id": c["id"], "title": c["title"], "type": c["type"], "status": c["status"]}
                     for i, c in enumerate(card_rows, 1)],
           "title": quick.title_of(body.type, None, inputs), "content": None, "review": None, "checks": [],
           "score": None, "rounds": [], "usage": None, "feedback": "", "note": "", "review_status": "draft",
           "status": "queued", "stage": None, "error": None, "created_at": now, "updated_at": now}
    doc["_id"] = quick_pieces.insert_one(doc).inserted_id
    return piece_out(doc, user)


@router.get("")
def list_quick(type: str | None = None, q: str | None = None, mine: bool = False,
               review_status: Literal["draft", "approved", "rejected"] | None = None, project_id: str | None = None,
               status: Literal["queued", "generating", "idle", "error"] | None = None,
               page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
               user: dict = Depends(current_user)):
    f = space_scope(None, user, kind="quick")
    if project_id:   # đợt 1: nội dung vẫn theo quyền kho; dự án chỉ là bộ lọc
        f = {"$and": [f, {"project_id": load_project(project_id, user)["_id"]}]}
    if type:
        f["type"] = type
    if mine:
        f["created_by"] = user["_id"]
    if review_status:
        f["review_status"] = review_status
    if status:   # trạng thái chạy AI — link "Nội dung cần sửa" ở Việc của tôi (?status=error, DESIGN V.9.2)
        f["status"] = status
    if q and q.strip():
        f["title"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    rows = list(quick_pieces.find(f, LIST_FIELDS).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size))
    people = names_of([r["created_by"] for r in rows])
    return {"items": [piece_out(r, user, full=False) | {"created_by_name": people.get(r["created_by"])} for r in rows],
            "total": quick_pieces.count_documents(f)}


@router.get("/{piece_id}")
def get_quick(piece_id: str, user: dict = Depends(current_user)):
    p, _ = load(quick_pieces, piece_id, user, "space.read", "nội dung")
    return piece_out(p, user)


@router.patch("/{piece_id}")
def patch_quick(piece_id: str, body: QuickPatch, user: dict = Depends(current_user)):
    p, _ = load(quick_pieces, piece_id, user, "space.write", "nội dung")
    changes = body.model_dump(exclude_none=True, exclude={"project_id"})
    if "project_id" in body.model_fields_set:
        changes["project_id"] = assign_project(body.project_id, p["space_id"], user)
    if "review_status" in changes:
        if not p.get("content"):
            raise HTTPException(409, "Nội dung chưa viết xong")
        changes |= {"reviewed_by": user["_id"], "reviewed_at": db.now()}
    if changes:
        quick_pieces.update_one({"_id": p["_id"]}, {"$set": changes | {"updated_at": db.now()}})
    return piece_out(quick_pieces.find_one({"_id": p["_id"]}), user)


@router.post("/{piece_id}/rewrite")
def rewrite_quick(piece_id: str, body: RewriteIn, user: dict = Depends(current_user)):
    """Có góp ý: AI sửa trên bản đang có. Không góp ý: viết một bản mới từ đầu. Bản cũ bị thay khi bản mới xong."""
    p, _ = load(quick_pieces, piece_id, user, "space.write", "nội dung")
    _idle(p)
    quick_pieces.update_one({"_id": p["_id"]}, {"$set": {
        "status": "queued", "error": None, "rounds": [], "feedback": body.feedback.strip(), "review_status": "draft",
        "updated_at": db.now()}})
    return piece_out(quick_pieces.find_one({"_id": p["_id"]}), user)


@router.delete("/{piece_id}", status_code=204)
def delete_quick(piece_id: str, user: dict = Depends(current_user)):
    p, _ = load(quick_pieces, piece_id, user, "space.write", "nội dung")
    if p["status"] == "generating":
        raise HTTPException(409, "Nội dung đang được AI viết")
    quick_pieces.delete_one({"_id": p["_id"]})
    return Response(status_code=204)
