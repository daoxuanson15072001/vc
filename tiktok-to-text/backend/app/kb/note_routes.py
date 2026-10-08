"""API ghi chép theo nguồn và từng đơn vị (WK-45 — docs/DESIGN.md Phần II mục 12).

- `GET /kb/notes` — màn *Ghi chép* (`/kb/notes`): ghi chép + mục *Khi nạp* (ghi chú của người nạp, WK-44) của các
  kho xem được, lọc theo kho / nguồn / tài liệu / chữ / của tôi / loại, mới nhất trước, phân trang.
- `POST /kb/notes`, `PATCH|DELETE /kb/notes/{id}` — thêm / sửa / xoá. Quyền ở `policy.py`: `note.create` (xem được
  nguồn), `note.edit` (tác giả hoặc chủ kho). Không xem được → 404.
"""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from .. import db, policy
from ..auth import current_user
from . import notes as notes_mod
from .notes import T_MAX, TEXT_MAX, notes
from .pipeline import documents, log, sources
from .routes import load, names_of, oid, space_names

router = APIRouter(prefix="/api")

SOURCE_FIELDS = {"title": 1, "url": 1, "platform": 1, "kind": 1, "space_id": 1, "note": 1, "created_by": 1,
                 "created_at": 1, "file": 1, "delete_requested": 1}
DOC_FIELDS = {"title": 1, "url": 1, "source_id": 1}


def _text(v: str) -> str:
    v = (v or "").strip()
    if not v:
        raise ValueError("Ghi chép không được để trống")
    if len(v) > TEXT_MAX:
        raise ValueError(f"Ghi chép tối đa {TEXT_MAX} ký tự")
    return v


class NoteCreate(BaseModel):
    source_id: str
    doc_id: str | None = None
    text: str = Field(max_length=TEXT_MAX + 200)   # khoảng trắng hai đầu được bỏ trước khi kiểm độ dài thật
    t: int | None = Field(None, ge=0, le=T_MAX)

    @field_validator("text")
    @classmethod
    def _clean(cls, v):
        return _text(v)


class NotePatch(BaseModel):
    text: str | None = Field(None, max_length=TEXT_MAX + 200)
    t: int | None = Field(None, ge=0, le=T_MAX)

    @field_validator("text")
    @classmethod
    def _clean(cls, v):
        return None if v is None else _text(v)


def _source_title(src: dict) -> str:
    return src.get("title") or (src.get("file") or {}).get("name") or src.get("url") or "(không tên)"


def note_out(n: dict, user: dict, src: dict, doc: dict | None, people: dict, snames: dict) -> dict:
    return {"id": str(n["_id"]), "kind": "note", "text": n["text"], "t": n.get("t"),
            "source_id": str(n["source_id"]), "doc_id": str(n["doc_id"]) if n.get("doc_id") else None,
            "space_id": str(n["space_id"]), "space_name": snames.get(n["space_id"]),
            "source_title": _source_title(src), "source_url": src.get("url"), "source_platform": src.get("platform"),
            "source_kind": src.get("kind"),
            "doc_title": (doc or {}).get("title"), "doc_url": (doc or {}).get("url"),
            "created_by": str(n["created_by"]), "author_name": people.get(n["created_by"]),
            "created_at": n["created_at"], "updated_at": n.get("updated_at"),
            "can_edit": policy.can(user, "note.edit", n)}


def intake_out(src: dict, user: dict, people: dict, snames: dict) -> dict:
    """Ghi chú của người nạp (WK-44) hiện như một mục *Khi nạp* — sửa qua `PUT /kb/sources/{id}/note`."""
    return {"id": f"intake:{src['_id']}", "kind": "intake", "text": src.get("note") or "", "t": None,
            "source_id": str(src["_id"]), "doc_id": None,
            "space_id": str(src["space_id"]), "space_name": snames.get(src["space_id"]),
            "source_title": _source_title(src), "source_url": src.get("url"), "source_platform": src.get("platform"),
            "source_kind": src.get("kind"), "doc_title": None, "doc_url": None,
            "created_by": str(src["created_by"]), "author_name": people.get(src["created_by"]),
            "created_at": src["created_at"], "updated_at": None,
            "can_edit": policy.can(user, "source.write", src)}


def outs(rows: list[dict], user: dict) -> list[dict]:
    """Bản ghi `kb_notes` -> dữ liệu trả về, kèm tên nguồn / tài liệu / người viết / kho (tra theo lô)."""
    srcs = {s["_id"]: s for s in sources.find({"_id": {"$in": list({r["source_id"] for r in rows})}}, SOURCE_FIELDS)}
    docs = {d["_id"]: d for d in documents.find({"_id": {"$in": [r["doc_id"] for r in rows if r.get("doc_id")]}},
                                                DOC_FIELDS)}
    people = names_of(r["created_by"] for r in rows)
    snames = space_names(r["space_id"] for r in rows)
    return [note_out(r, user, srcs.get(r["source_id"]) or {}, docs.get(r.get("doc_id")), people, snames)
            for r in rows]


def notes_of_source(src: dict, user: dict) -> list[dict]:
    """Mọi ghi chép của một nguồn (chi tiết nguồn, MCP `get_source`) — mới nhất trước."""
    rows = notes_mod.of_source(src["_id"])
    docs = {d["_id"]: d for d in documents.find({"source_id": src["_id"]}, DOC_FIELDS)}
    people = names_of(r["created_by"] for r in rows)
    snames = space_names([src["space_id"]])
    return [note_out(r, user, src, docs.get(r.get("doc_id")), people, snames) for r in rows]


def load_note(note_id: str, user: dict, action: str = "note.edit") -> dict:
    n = notes.find_one({"_id": oid(note_id, "ghi chép")})
    if not n:
        raise HTTPException(404, "Không tìm thấy ghi chép")
    policy.require(user, action, n, "ghi chép")
    return n


@router.get("/kb/notes")
def list_notes(space_id: str | None = None, source_id: str | None = None, doc_id: str | None = None,
               q: str = "", mine: bool = False, kind: Literal["", "note", "intake"] = "",
               page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
               user: dict = Depends(current_user)):
    """Ghi chép + mục *Khi nạp* trong phạm vi xem được, mới nhất trước. Có `doc_id` thì chỉ ghi chép của tài liệu
    đó (mục *Khi nạp* thuộc cả nguồn nên không hiện)."""
    note_f: dict = {}
    src_f: dict = {"delete_requested": {"$ne": True}, "note": {"$nin": [None, ""]}}
    if doc_id:
        doc, _ = load(documents, doc_id, user, "document.read", "tài liệu")
        if source_id and str(doc["source_id"]) != source_id:
            raise HTTPException(404, "Không tìm thấy tài liệu")
        source_id = str(doc["source_id"])
    if source_id:
        src, _ = load(sources, source_id, user, "source.read", "nguồn")
        note_f["source_id"] = src_f["_id"] = src["_id"]
    elif space_id:
        sid = policy.load_space(space_id, user, "note.read")["_id"]
        note_f["space_id"] = src_f["space_id"] = sid
    else:
        note_f |= policy.visible_filter(user, "note")
        src_f |= policy.visible_filter(user, "source")
    if doc_id:
        note_f["doc_id"] = doc["_id"]
    if q.strip():
        rx = {"$regex": re.escape(q.strip()[:200]), "$options": "i"}
        note_f["text"], src_f["note"] = rx, rx
    if mine:
        note_f["created_by"] = src_f["created_by"] = user["_id"]
    want_notes = kind in ("", "note")
    want_intake = kind in ("", "intake") and not doc_id
    if want_notes and "source_id" not in note_f:   # nguồn đã bấm xoá (đang chờ dọn): ghi chép không hiện
        if gone := [s["_id"] for s in sources.find({"delete_requested": True}, {"_id": 1})]:
            note_f["source_id"] = {"$nin": gone}
    total_notes = notes.count_documents(note_f) if want_notes else 0
    total_intake = sources.count_documents(src_f) if want_intake else 0
    # trộn hai danh sách đã sắp mới nhất trước: lấy đủ `page * page_size` đầu mỗi bên rồi cắt trang
    top = page * page_size
    newest = [("created_at", -1), ("_id", -1)]
    rows = [("note", r) for r in notes.find(note_f).sort(newest).limit(top)] if want_notes else []
    rows += [("intake", s) for s in sources.find(src_f, SOURCE_FIELDS).sort(newest).limit(top)] if want_intake else []
    rows.sort(key=lambda x: x[1]["created_at"], reverse=True)
    rows = rows[(page - 1) * page_size: top]
    note_rows = [r for k, r in rows if k == "note"]
    items = {id(r): o for r, o in zip(note_rows, outs(note_rows, user))}
    intake = [r for k, r in rows if k == "intake"]
    people = names_of(r["created_by"] for r in intake)
    snames = space_names(r["space_id"] for r in intake)
    return {"items": [items[id(r)] if k == "note" else intake_out(r, user, people, snames) for k, r in rows],
            "total": total_notes + total_intake, "page": page, "page_size": page_size}


@router.post("/kb/notes", status_code=201)
def create_note(body: NoteCreate, user: dict = Depends(current_user)):
    src, _ = load(sources, body.source_id, user, "note.create", "nguồn")
    doc = None
    if body.doc_id:
        doc = documents.find_one({"_id": oid(body.doc_id, "tài liệu"), "source_id": src["_id"]}, DOC_FIELDS)
        if not doc:
            raise HTTPException(404, "Không tìm thấy tài liệu")
    now = db.now()
    n = {"space_id": src["space_id"], "source_id": src["_id"], "doc_id": doc["_id"] if doc else None,
         "text": body.text, "t": body.t, "created_by": user["_id"], "created_at": now, "updated_at": now}
    n["_id"] = notes.insert_one(n).inserted_id
    where = f"«{(doc.get('title') or '')[:80]}»" if doc else "cả nguồn"
    log(src["_id"], f"Thêm ghi chép ({where}) — {user.get('name') or ''}".rstrip(" —"))
    return outs([n], user)[0]


@router.patch("/kb/notes/{note_id}")
def update_note(note_id: str, body: NotePatch, user: dict = Depends(current_user)):
    n = load_note(note_id, user)
    upd = {}
    if body.text is not None:
        upd["text"] = body.text
    if "t" in body.model_fields_set:   # gửi t = null -> bỏ mốc thời gian
        upd["t"] = body.t
    if upd:
        notes.update_one({"_id": n["_id"]}, {"$set": upd | {"updated_at": db.now()}})
    return outs([notes.find_one({"_id": n["_id"]})], user)[0]


@router.delete("/kb/notes/{note_id}", status_code=204)
def delete_note(note_id: str, user: dict = Depends(current_user)):
    n = load_note(note_id, user)
    notes.delete_one({"_id": n["_id"]})
    return Response(status_code=204)
