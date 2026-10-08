"""API Kho tư liệu (nạp nguồn, tầng thô) và VCWIKI (thẻ tri thức). Mọi thao tác đều kiểm tra quyền theo kho."""

from __future__ import annotations

import hashlib
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Literal, get_args

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field, StrictInt, ValidationError, field_validator

from .. import categories as cat_mod
from .. import db, policy
from ..auth import current_user, users
from ..config import DEFAULT_VIDEO_LIMIT, MAX_TARGETS, MAX_UPLOAD_MB, RAW_DIR, UPLOAD_LIMIT_MB
from ..spaces import personal_space, spaces
from . import changes as changes_mod
from . import ai_slot, card_search, classify, doc_vectors, embeddings, lexical, rerank, social, synth, tts, wiki
from .adapters import (ADAPTERS, AUDIO_TYPES, accepted_file_exts, detect_file, detect_url, lane_of, normalize_link,
                       platform_of)
from .adapters import google
from . import eta
from . import card_update, langguess, redo, video_errors
from . import tags as tag_mod
from .pipeline import card_search_text, cards, delete_source_data, documents, log, raw_dir, set_priority, sources

router = APIRouter(prefix="/api")

SOURCE_LIST_FIELDS = {"logs": 0}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def oid(value: str, what: str = "dữ liệu") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(404, f"Không tìm thấy {what}") from None


def load(coll, item_id: str, user: dict, action: str, what: str) -> tuple[dict, dict]:
    """Lấy một bản ghi + kho chứa nó, kiểm tra quyền `action` qua policy (vd "card.read", "source.write";
    tên vai trò cũ "viewer" / "editor" vẫn nhận). Không có quyền xem -> 404 "Không tìm thấy <what>"."""
    item = coll.find_one({"_id": oid(item_id, what)})
    if not item or item.get("delete_requested"):
        raise HTTPException(404, f"Không tìm thấy {what}")
    return item, policy.load_space(item["space_id"], user, action, what)


def space_scope(space_id: str | None, user: dict, category: str | None = None, kind: str = "card") -> dict:
    """Điều kiện lọc bản ghi loại `kind`: một kho (kiểm tra quyền xem) hoặc mọi kho xem được (policy.visible_filter)."""
    f = {"space_id": policy.load_space(space_id, user)["_id"]} if space_id else policy.visible_filter(user, kind)
    if category:
        f["categories"] = {"$in": cat_mod.with_descendants(category)}   # lọc nhánh gồm cả nhánh con
    return f


def names_of(ids) -> dict:
    return {u["_id"]: u["name"] for u in users.find({"_id": {"$in": list(set(ids))}}, {"name": 1})}


def space_names(ids) -> dict:
    return {s["_id"]: s["name"] for s in spaces.find({"_id": {"$in": list(set(ids))}}, {"name": 1})}


def out(doc: dict, extra: dict | None = None) -> dict:
    o = {}
    for k, v in doc.items():
        if k in ("search_text", "text"):
            continue
        o["id" if k == "_id" else k] = plain(v)
    return o | (extra or {})


def plain(v):
    """ObjectId -> str, kể cả lồng trong list / dict (vd `sources` của thẻ tổng hợp)."""
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, list):
        return [plain(x) for x in v]
    if isinstance(v, dict):
        return {k: plain(x) for k, x in v.items()}
    return v


def source_out(src: dict, user: dict, people: dict, snames: dict) -> dict:
    stats = {s["_id"]: s["n"] for s in documents.aggregate([
        {"$match": {"source_id": src["_id"]}}, {"$group": {"_id": "$wiki_status", "n": {"$sum": 1}}}])}
    docs_total = sum(stats.values())
    pending = stats.get("pending", 0) + stats.get("processing", 0)
    if src["status"] in ("uploading", "queued", "extracting", "error", "cancelled"):
        overall = src["status"]
    elif pending:
        overall = "building" if wiki.ai_ready() else "waiting_ai"
    elif stats.get("grouping"):
        overall = "synth"            # đang tổng hợp theo cụm chủ đề
    elif stats.get("paused"):
        overall = "refine_paused"    # người dùng ngừng tinh chế (trang Tiến độ tinh chế)
    elif stats.get("skipped") and not stats.get("done"):
        overall = "transcribed"      # chỉ chuyển chữ, không dựng thẻ
    else:
        overall = "done"
    return out(src, {
        "overall": overall,
        "docs": {"total": docs_total, "done": stats.get("done", 0), "pending": pending,
                 "error": stats.get("error", 0), "skipped": stats.get("skipped", 0),
                 "grouping": stats.get("grouping", 0), "paused": stats.get("paused", 0), "card_update": card_update.waiting(src["_id"])},
        "card_count": cards.count_documents({"source_id": src["_id"], "space_id": src["space_id"]}),
        "created_by_name": people.get(src["created_by"]),
        "space_name": snames.get(src["space_id"]),
        "can_edit": policy.can(user, "source.write", src),
        "priority": src.get("priority") or 0,
        "eta": (e := eta.of(src)),
        "queue_position": e["position"] if e and not e["running"] else None,
    })


# ---------------------------------------------------------------------------
# Trạng thái chung
# ---------------------------------------------------------------------------

@router.get("/kb/status")
def kb_status(_user: dict = Depends(current_user)):
    from ..worker import core
    return {
        "ai": wiki.ai_status(),
        "adapters": [{"kind": a.kind, "label": a.label, "exts": list(a.file_exts)} for a in ADAPTERS.values()],
        "file_exts": accepted_file_exts(),
        "max_upload_mb": MAX_UPLOAD_MB,
        "upload_limits": {k: UPLOAD_LIMIT_MB.get(k, MAX_UPLOAD_MB) for k in ADAPTERS},
        "max_links": MAX_TARGETS,
        "audio_types": AUDIO_TYPES,
        # tự nhận: chép đúng tiếng gốc, tiếng nước ngoài có thêm bản dịch tiếng Việt (kb/translate.py)
        "languages": [{"value": "auto", "label": "Tự nhận (giữ tiếng gốc + dịch tiếng Việt)"},
                      {"value": "vi", "label": "Ép tiếng Việt"}, {"value": "en", "label": "Ép tiếng Anh"},
                      {"value": "zh", "label": "Ép tiếng Trung"}],
        "browsers": ["chrome", "safari", "firefox", "edge"],
        "backends": ["auto", "mlx", "faster", "phowhisper"],
        "auto_backend": core.pick_backend("auto"),
        "default_video_limit": DEFAULT_VIDEO_LIMIT,
        "card_types": wiki.CARD_TYPES | wiki.AI_CARD_TYPES,
    }


@router.get("/kb/queue")
def kb_queue(user: dict = Depends(current_user)):
    """Hàng chờ chuyển chữ theo từng làn, kèm dự kiến thời gian xong (giây tính từ lúc hỏi). `ai_job`: việc nặng đang
    giữ chỗ chung và các loại việc tạm dừng chờ nó (kb/ai_slot.py — một lúc chỉ làm một việc)."""
    return {"lanes": eta.lanes(set(policy.readable_space_ids(user))), "ai_job": ai_slot.status()}


@router.get("/kb/detect-language")
def detect_language(url: str, _user: dict = Depends(current_user)):
    """Gợi ý ngôn ngữ lời nói khi dán link kênh / video (kb/langguess.py) — có thể mất vài giây, không có thì null."""
    link = normalize_link(url)
    kind = detect_url(link) if link.startswith(("http://", "https://")) else None
    return {"hint": langguess.for_url(link, kind)}


@router.get("/kb/detect")
def detect(url: str, _user: dict = Depends(current_user)):
    """Nhận diện loại nguồn của một dòng người dùng dán; link Google thì thử luôn quyền truy cập."""
    link = normalize_link(url)
    kind = detect_url(link) if link.startswith(("http://", "https://")) else None
    res = {"url": link, "kind": kind, "platform": platform_of(link) if kind == "video" else None}
    if kind == "google":
        parsed = google.parse(link)
        res |= {"platform": google.LABELS.get(parsed[0]) if parsed else "Google",
                "access": google.check_access(link)}
    return res


# ---------------------------------------------------------------------------
# Nguồn kiến thức
# ---------------------------------------------------------------------------

class SourceOptions(BaseModel):
    limit: int = Field(DEFAULT_VIDEO_LIMIT, ge=0, le=5000)   # số video tối đa khi là kênh / playlist, 0 = tất cả
    language: str = Field("auto", pattern=r"^(auto|[a-z]{2})$")
    cookies_from_browser: Literal["chrome", "safari", "firefox", "edge"] | None = None
    backend: Literal["auto", "mlx", "faster", "phowhisper"] = "auto"
    model: str | None = None
    sleep: float = Field(2.0, ge=0, le=30)      # nghỉ giữa các video của một kênh để không bị chặn
    force: bool = False                         # chuyển chữ lại cả video đã có
    build_wiki: bool | None = None              # None: video mạng xã hội chỉ chuyển chữ, loại khác dựng thẻ
    audio_type: Literal["lecture", "meeting", "interview", "note"] | None = None


def resolve_options(kind: str, options: SourceOptions | dict, previous: dict | None = None) -> dict:
    """Không chọn "Dựng thẻ": giữ lựa chọn cũ của nguồn (khi nạp lại), nguồn mới thì theo loại."""
    opts = options.model_dump() if isinstance(options, BaseModel) else dict(options)
    if opts.get("build_wiki") is None:
        prev = (previous or {}).get("build_wiki")
        opts["build_wiki"] = prev if prev is not None else kind != "video"
    return opts


class LinksIn(BaseModel):
    space_id: str | None = None
    urls: list[str]
    categories: list[str] = []
    tags: list[str] = []
    note: str = Field("", max_length=wiki.NOTE_MAX)   # ghi chú của người nạp (WK-44), đưa vào prompt AI làm gợi ý
    options: SourceOptions = SourceOptions()

    @field_validator("urls")
    @classmethod
    def clean(cls, v: list[str]) -> list[str]:
        v = list(dict.fromkeys(normalize_link(u) for u in v if u.strip() and not u.strip().startswith("#")))
        if not v:
            raise ValueError("Cần ít nhất một link")
        if len(v) > MAX_TARGETS:
            raise ValueError(f"Tối đa {MAX_TARGETS} link mỗi lần")
        bad = [u for u in v if not re.match(r"^https?://", u)]
        if bad:
            raise ValueError(f"Link không hợp lệ: {bad[0]}")
        return v


def new_source(space: dict, user: dict, **fields) -> dict:
    doc = {"space_id": space["_id"], "created_by": user["_id"], "status": "queued", "error": None,
           "logs": [{"at": db.now(), "msg": "Đã lưu thô, chờ xử lý"}], "created_at": db.now(),
           "cancel_requested": False, "lane": lane_of(fields.get("kind", "")), "priority": 0} | fields
    doc["_id"] = sources.insert_one(doc).inserted_id
    return doc


def requeue(src: dict, msg: str, options: dict | None = None) -> None:
    upd = {"status": "queued", "error": None, "cancel_requested": False, "lane": lane_of(src["kind"]),
           "created_at": db.now()}   # xếp cuối hàng đợi, nổi lên đầu danh sách
    if options is not None:
        upd["options"] = options
    sources.update_one({"_id": src["_id"]}, {"$set": upd, "$push": {"logs": {"at": db.now(), "msg": msg}}})


@router.post("/kb/sources/links", status_code=201)
def add_links(body: LinksIn, user: dict = Depends(current_user)):
    """Nạp link: bài viết, video / kênh / playlist, Google Docs / Sheets / Slides / Drive, link file.
    Kênh / video đã có trong kho thì quét lại (lấy video mới) thay vì báo trùng."""
    space = policy.load_space(body.space_id, user, "source.write") if body.space_id else personal_space(user)
    created, duplicates, requeued = [], [], []
    for url in body.urls:
        kind = detect_url(url) or "web"
        g = google.parse(url) if kind == "google" else None
        dup = {"space_id": space["_id"], "google.id": g[1]} if g else {"space_id": space["_id"], "url": url}
        if existing := sources.find_one(dup):
            if existing["kind"] == "video" and existing["status"] not in ("queued", "extracting"):
                requeue(existing, "Nạp lại — quét video mới",
                        resolve_options("video", body.options, existing.get("options")))
                requeued.append(url)
            else:
                duplicates.append(url)
            continue
        created.append(new_source(space, user, kind=kind, url=url, title=None,
                                  platform=platform_of(url) if kind == "video" else None,
                                  google={"type": g[0], "id": g[1]} if g else None,
                                  categories=cat_mod.valid_slugs(body.categories), tags=db.clean_tags(body.tags),
                                  note=body.note.strip(), options=resolve_options(kind, body.options)))
    return {"created": [str(s["_id"]) for s in created], "duplicates": duplicates, "requeued": requeued}


def _stream_to(src, dest: Path, limit: int) -> tuple[int, str] | None:
    """Chép file tải lên xuống đĩa theo từng khúc (không nạp cả file vào RAM). Quá giới hạn -> None."""
    h, size = hashlib.sha256(), 0
    with dest.open("wb") as out:
        while chunk := src.read(1024 * 1024):
            size += len(chunk)
            if size > limit:
                out.close()
                dest.unlink(missing_ok=True)
                return None
            h.update(chunk)
            out.write(chunk)
    return size, h.hexdigest()


def _safe_name(name: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", name)[-120:] or "file"


@router.post("/kb/sources/files", status_code=201)
def add_files(files: list[UploadFile] = File(...), space_id: str | None = Form(None),
              categories: str = Form(""), tags: str = Form(""), note: str = Form(""),
              merge_images: bool = Form(False), build_wiki: Literal["", "true", "false"] = Form(""),
              language: str = Form("auto"), audio_type: str = Form(""),
              user: dict = Depends(current_user)):
    """Tải file lên. Nhiều ảnh + merge_images: gộp thành một nguồn (album) theo đúng thứ tự gửi lên."""
    space = policy.load_space(space_id, user, "source.write") if space_id else personal_space(user)
    if len(note.strip()) > wiki.NOTE_MAX:
        raise HTTPException(422, f"Ghi chú tối đa {wiki.NOTE_MAX} ký tự")
    try:
        opts = SourceOptions(language=language, audio_type=audio_type or None,
                             build_wiki=None if not build_wiki else build_wiki == "true")
    except ValidationError as e:
        raise HTTPException(422, e.errors()[0]["msg"]) from None
    common = {"categories": cat_mod.valid_slugs([c.strip() for c in categories.split(",") if c.strip()]),
              "tags": db.clean_tags(tags.split(",")), "note": note.strip()}
    created, duplicates, rejected = [], [], []
    incoming = RAW_DIR / "_incoming"
    incoming.mkdir(parents=True, exist_ok=True)
    staged: list[dict] = []
    try:
        for f in files:
            name = Path(f.filename or "file").name
            kind = detect_file(name)
            if not kind:
                rejected.append(f"{name}: định dạng chưa hỗ trợ")
                continue
            limit_mb = UPLOAD_LIMIT_MB.get(kind, MAX_UPLOAD_MB)
            tmp = incoming / uuid.uuid4().hex
            res = _stream_to(f.file, tmp, limit_mb * 1024 * 1024)
            if res is None:
                rejected.append(f"{name}: quá {limit_mb} MB")
                continue
            staged.append({"name": name, "kind": kind, "tmp": tmp, "size": res[0], "sha256": res[1],
                           "content_type": f.content_type})

        images = [s for s in staged if s["kind"] == "image"]
        groups = [[s] for s in staged if s["kind"] != "image" or not (merge_images and len(images) > 1)]
        if merge_images and len(images) > 1:
            groups.append(images)
        for group in groups:
            first = group[0]
            album = len(group) > 1
            sha = hashlib.sha256("".join(s["sha256"] for s in group).encode()).hexdigest() if album else first["sha256"]
            if sources.find_one({"space_id": space["_id"], "file.sha256": sha}, {"_id": 1}):
                duplicates.append(first["name"] + (f" (+{len(group) - 1} ảnh)" if album else ""))
                continue
            items = [{"name": s["name"], "stored_name": (f"{i:02d}_" if album else "") + _safe_name(s["name"]),
                      "size": s["size"], "sha256": s["sha256"], "content_type": s["content_type"]}
                     for i, s in enumerate(group, 1)]
            title = Path(first["name"]).stem + (f" (+{len(group) - 1} ảnh)" if album else "")
            src = new_source(space, user, kind=first["kind"], url=None, title=title, status="uploading",
                             file=items[0] | {"sha256": sha, "size": sum(i["size"] for i in items)},
                             files=items if album else None,
                             options=resolve_options(first["kind"], opts), **common)
            rdir = raw_dir(src["_id"])
            rdir.mkdir(parents=True, exist_ok=True)
            for s, item in zip(group, items):
                shutil.move(s.pop("tmp"), rdir / item["stored_name"])   # lưu thô trước, rồi mới xếp hàng
            sources.update_one({"_id": src["_id"]}, {"$set": {"status": "queued"}})
            created.append(str(src["_id"]))
    finally:
        for s in staged:
            if s.get("tmp"):
                Path(s["tmp"]).unlink(missing_ok=True)
    return {"created": created, "duplicates": duplicates, "rejected": rejected}


def source_filter(space_id, kind, q, category, status, user) -> dict:
    """Bộ lọc danh sách nguồn — dùng chung cho danh sách và thao tác hàng loạt theo bộ lọc đang xem."""
    f = space_scope(space_id, user, category, "source") | {"delete_requested": {"$ne": True}}
    if status:
        f["status"] = {"$in": status.split(",")}
    if q:
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        f["$or"] = [{"title": rx}, {"url": rx}, {"file.name": rx}, {"tags": q.strip().lower()}]
    if kind:
        f["kind"] = {"$in": kind.split(",")}
    return f


class StopAllIn(BaseModel):
    space_id: str | None = None
    kind: str | None = None
    q: str | None = None
    category: str | None = None
    status: str | None = None
    mine: bool = False        # chỉ nguồn tôi nạp — như ?mine=1 ở danh sách (link "Nguồn lỗi của tôi", DESIGN V.9.2)
    dry_run: bool = False     # chỉ đếm — hộp xác nhận hiện số trước khi dừng


def _mine(f: dict, body: StopAllIn, user: dict) -> dict:
    return {"$and": [f, {"created_by": user["_id"]}]} if body.mine else f


@router.post("/kb/sources/stop-all")
def stop_all_sources(body: StopAllIn, user: dict = Depends(current_user)):
    """Ngừng lấy chữ mọi nguồn khớp bộ lọc đang xem: đang chờ -> Đã dừng ngay, đang chạy -> dừng sau mục hiện tại,
    hàng chờ lấy lại chữ (kb/redo.py) của các nguồn đó bị huỷ. Nguồn không có quyền sửa được bỏ qua."""
    f = _mine(source_filter(body.space_id or None, body.kind or None, body.q, body.category or None, body.status or None, user),
              body, user)
    redo_ids = set(redo.jobs.distinct("source_id", {"status": "queued"}))
    busy = {"$or": [{"status": {"$in": ["queued", "extracting"]}}, {"_id": {"$in": list(redo_ids)}}]}
    rows = [s for s in sources.find({"$and": [f, busy]},
                                    {"space_id": 1, "status": 1, "cancel_requested": 1})
            if policy.can(user, "source.write", s)]
    running = [s["_id"] for s in rows if s["status"] == "extracting" and not s.get("cancel_requested")]
    queued = [s["_id"] for s in rows if s["status"] == "queued"]
    redo_n = redo.jobs.count_documents({"source_id": {"$in": [s["_id"] for s in rows]}, "status": "queued"})
    res = {"running": len(running), "queued": len(queued), "redo": redo_n}
    if body.dry_run:
        return res
    sources.update_many({"_id": {"$in": queued}, "status": "queued"}, {"$set": {"status": "cancelled"}})
    sources.update_many({"_id": {"$in": running}, "status": "extracting"}, {"$set": {"cancel_requested": True}})
    redo.jobs.delete_many({"source_id": {"$in": [s["_id"] for s in rows]}, "status": "queued"})
    for sid in running + queued:
        log(sid, "⏹ Ngừng lấy chữ (dừng hàng loạt theo bộ lọc)")
    eta.invalidate()
    return res


@router.post("/kb/sources/resume-all")
def resume_all_sources(body: StopAllIn, user: dict = Depends(current_user)):
    """Chạy tiếp mọi nguồn "Đã dừng" khớp bộ lọc đang xem (ngược với stop-all) — như bấm "Xử lý lại" từng nguồn:
    về hàng chờ, giữ thứ tự nạp; kênh chạy tiếp, video đã có được bỏ qua. Nguồn lỗi chỉ được chạy lại khi bộ lọc
    đang chọn trạng thái "Lỗi" (tránh chạy lại hàng loạt link hỏng ngoài ý muốn).
    Kèm lấy lại chữ các video lỗi trong nguồn video / kênh khớp bộ lọc (kể cả kênh đã xong), video lỗi dưới
    MAX_AUTO_RETRY lần và không phải lỗi vĩnh viễn (video chỉ dành cho hội viên, đã gỡ) — việc tự động, chạy sau khi hết nguồn chờ chuyển chữ (kb/redo.py)."""
    picked = [x for x in (body.status or "").split(",") if x in ("cancelled", "error")]
    wanted = picked if body.status else ["cancelled"]   # bộ lọc trạng thái đang chọn; không chọn -> chỉ "Đã dừng"
    f = _mine(source_filter(body.space_id or None, body.kind or None, body.q, body.category or None, None, user), body, user)
    rows = [s for s in sources.find(f | {"status": {"$in": wanted}}, {"space_id": 1, "status": 1})
            if policy.can(user, "source.write", s)]
    ids = [s["_id"] for s in rows]
    # nguồn sắp chạy lại / đang chạy tự quét lại video lỗi của nó -> không xếp thêm
    vf = _mine(source_filter(body.space_id or None, body.kind or None, body.q, body.category or None, body.status or None, user),
               body, user)
    vsrcs = [s for s in sources.find({"$and": [vf, {"kind": "video", "_id": {"$nin": ids},
                                                    "status": {"$nin": ["queued", "extracting"]}}]}, {"space_id": 1})
             if policy.can(user, "source.write", s)]
    vids = [s["_id"] for s in vsrcs]
    busy = {(j["source_id"], j["key"]) for j in redo.jobs.find({"source_id": {"$in": vids}, "status": {"$in": list(redo.ACTIVE)}},
                                                              {"source_id": 1, "key": 1})}
    failed = [v for v in redo.failed_of(vids) if (v["source_id"], v["key"]) not in busy]
    todo = [v for v in failed if not v["stop_reason"]]
    res = {"cancelled": sum(s["status"] == "cancelled" for s in rows), "error": sum(s["status"] == "error" for s in rows),
           "failed_videos": len(todo), "failed_exhausted": len(failed) - len(todo),
           "max_auto_retry": video_errors.MAX_AUTO_RETRY}
    if body.dry_run:
        return res
    by_src: dict = {}
    for v in todo:
        by_src.setdefault(v["source_id"], []).append(v)
    for sid, items in by_src.items():
        redo.queue({"_id": sid}, items, None, user, auto=True)
    sources.update_many({"_id": {"$in": ids}, "status": {"$in": wanted}},
                        {"$set": {"status": "queued", "error": None, "cancel_requested": False},
                         "$push": {"logs": {"at": db.now(), "msg": "▶ Chạy tiếp (hàng loạt theo bộ lọc)"}}})
    eta.invalidate()
    return res


@router.get("/kb/sources")
def list_sources(space_id: str | None = None, kind: str | None = None, q: str | None = None,
                 category: str | None = None, status: str | None = None,
                 page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
                 user: dict = Depends(current_user), mine: int = 0):
    f = source_filter(space_id, None, q, category, status, user)
    if mine:                                       # mine=1: chỉ nguồn do chính người đăng nhập nạp
        f["created_by"] = user["_id"]
    # đếm theo loại trước khi lọc loại -> giao diện hiện số trên từng nút lọc
    kinds = {r["_id"]: r["n"] for r in sources.aggregate([{"$match": f}, {"$group": {"_id": "$kind", "n": {"$sum": 1}}}])}
    if kind:
        f["kind"] = {"$in": kind.split(",")}
    rows = list(sources.find(f, SOURCE_LIST_FIELDS).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size))
    people = names_of(r["created_by"] for r in rows)
    snames = space_names(r["space_id"] for r in rows)
    return {"items": [source_out(r, user, people, snames) for r in rows], "total": sources.count_documents(f),
            "kinds": kinds}


@router.get("/kb/sources/{source_id}")
def get_source(source_id: str, user: dict = Depends(current_user)):
    src, _ = load(sources, source_id, user, "source.read", "nguồn")
    docs = list(documents.find({"source_id": src["_id"]}, {"text": 0}).sort("created_at", 1))
    result = source_out(src, user, names_of([src["created_by"]]), space_names([src["space_id"]]))
    card_tags = tag_mod.card_tags_of([d["_id"] for d in docs])
    from . import note_routes   # nhập muộn: note_routes -> routes
    note_counts = note_routes.notes_mod.count_by_doc(src["_id"])
    result["documents"] = [out(d, {"card_tags": card_tags.get(d["_id"], []), "note_count": note_counts.get(d["_id"], 0)})
                           for d in docs]
    # ghi chép của người dùng trên nguồn + từng tài liệu (WK-45), mới nhất trước; can_note: ai xem được thì ghi được
    result["notes"] = note_routes.notes_of_source(src, user)
    result["can_note"] = policy.can(user, "note.create", src)
    # tag trên các thẻ VCWIKI tinh chế từ nguồn (trừ thẻ bị loại), nhiều thẻ trước — FE dẫn sang /wiki?source_id=&tag=
    result["refined_tags"] = [{"tag": r["_id"], "cards": r["n"]} for r in cards.aggregate([
        {"$match": {"source_id": src["_id"], "status": {"$ne": "rejected"}}}, {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "n": {"$sum": 1}}}, {"$sort": {"n": -1, "_id": 1}}])]
    result["raw_files"] = sorted(str(p.relative_to(raw_dir(src["_id"])))
                                 for p in raw_dir(src["_id"]).rglob("*") if p.is_file())
    if src["kind"] == "video":
        # chọn video để lấy lại chữ: độ dài lời nói, lời nói đã sửa tay, video lỗi chưa có tài liệu, gợi ý ngôn ngữ
        vids = {v["_id"]: v for v in db.videos.aggregate([
            {"$match": {"_id": {"$in": [d.get("key") for d in docs]}}},
            {"$project": {"edited": 1, "speech_chars": {"$strLenCP": {"$ifNull": ["$transcript", ""]}}}}])}
        for d in result["documents"]:
            v = vids.get(d.get("key")) or {}
            d["speech_chars"], d["edited"] = v.get("speech_chars"), bool(v.get("edited"))
        result["failed_videos"] = redo.failed_videos(src)
        result["max_auto_retry"] = video_errors.MAX_AUTO_RETRY
        result["redo"] = redo.stats(src["_id"])
        result["language_hint"] = langguess.for_source(src)
    return result


@router.get("/kb/failed-videos")
def list_failed_videos(space_id: str | None = None, q: str | None = None, category: str | None = None,
                       error_kind: str | None = None, exhausted: bool | None = None,
                       page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                       user: dict = Depends(current_user)):
    """Video lấy chữ lỗi (chưa có tài liệu) của mọi nguồn video / kênh xem được — lọc theo nhóm lỗi, đã lỗi đủ số lần
    hay chưa; kèm đếm theo nhóm lỗi và lịch sử lỗi từng video để tìm chỗ cải tiến."""
    f = source_filter(space_id or None, "video", q, category or None, None, user)
    srcs = {s["_id"]: s for s in sources.find(f, {"title": 1, "url": 1, "space_id": 1})}
    rows = redo.failed_of(list(srcs))
    mx = video_errors.MAX_AUTO_RETRY
    if exhausted is not None:
        rows = [v for v in rows if bool(v["stop_reason"]) == exhausted]
    kinds: dict = {}
    for v in rows:
        k = kinds.setdefault(v["error_kind"], {"kind": v["error_kind"], "label": v["error_label"], "n": 0})
        k["n"] += 1
    if error_kind:
        rows = [v for v in rows if v["error_kind"] == error_kind]
    rows.sort(key=lambda v: (v["last_failed_at"] is None, -(v["last_failed_at"].timestamp() if v["last_failed_at"] else 0)))
    snames = space_names(s["space_id"] for s in srcs.values())
    items = [v | {"source_id": str(v["source_id"]), "source_title": srcs[v["source_id"]].get("title") or srcs[v["source_id"]].get("url"),
                  "space_name": snames.get(srcs[v["source_id"]]["space_id"]), "can_edit": policy.can(user, "source.write", srcs[v["source_id"]])}
             for v in rows[(page - 1) * page_size: page * page_size]]
    return {"items": items, "total": len(rows), "kinds": sorted(kinds.values(), key=lambda k: -k["n"]), "max_auto_retry": mx}


class RetranscribeIn(BaseModel):
    document_ids: list[str] = Field([], max_length=5000)
    video_ids: list[str] = Field([], max_length=5000)            # video lỗi chưa có tài liệu (failed_videos[].key)
    language: str | None = Field(None, pattern=r"^(auto|[a-z]{2})$")   # None = theo nguồn
    save_language: bool = False                                  # dùng ngôn ngữ này cho cả nguồn (lần quét sau)


@router.post("/kb/sources/{source_id}/retranscribe")
def retranscribe_videos(source_id: str, body: RetranscribeIn, user: dict = Depends(current_user)):
    """Lấy lại chữ các video được chọn trong nguồn video / kênh — lần lượt từng video ở làn riêng (kb/redo.py),
    không chờ kênh khác đang chuyển chữ; tài liệu ghi đè tại chỗ, trạng thái nguồn giữ nguyên."""
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    if src["kind"] != "video":
        raise HTTPException(400, "Chỉ lấy lại chữ từng video ở nguồn video / kênh — nguồn khác dùng nút xử lý lại")
    ids = [oid(i, "tài liệu") for i in body.document_ids]
    items = [{"key": d["key"], "url": d["url"], "title": d.get("title")}
             for d in documents.find({"_id": {"$in": ids}, "source_id": src["_id"], "url": {"$nin": [None, ""]}},
                                     {"key": 1, "url": 1, "title": 1})]
    failed = {v["key"]: v for v in redo.failed_videos(src)}
    items += [failed[k] for k in body.video_ids if k in failed]
    if not items:
        raise HTTPException(400, "Chưa chọn video nào của nguồn này")
    if body.save_language and body.language:
        sources.update_one({"_id": src["_id"]}, {"$set": {"options.language": body.language}})
    return {"queued": redo.queue(src, items, body.language, user), "selected": len(items)}


@router.post("/kb/sources/{source_id}/retranscribe/cancel")
def cancel_retranscribe(source_id: str, user: dict = Depends(current_user)):
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    return {"cancelled": redo.cancel(src)}


@router.get("/kb/sources/{source_id}/raw/{path:path}")
def raw_file(source_id: str, path: str, inline: bool = False, user: dict = Depends(current_user)):
    """File thô của nguồn. Mặc định tải về (attachment); `?inline=1` để trình duyệt hiển thị ngay (xem trong app)."""
    src, _ = load(sources, source_id, user, "source.read", "nguồn")
    base = raw_dir(src["_id"]).resolve()
    target = (base / path).resolve()
    if base not in target.parents or not target.is_file():
        raise HTTPException(404, "Không tìm thấy file")
    return FileResponse(target, filename=target.name, content_disposition_type="inline" if inline else "attachment")


@router.post("/kb/sources/{source_id}/retry")
def retry_source(source_id: str, user: dict = Depends(current_user)):
    """Trích xuất lại từ dữ liệu thô (hoặc tải lại link), rồi dựng lại VCWIKI."""
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    if src["status"] in ("queued", "extracting"):
        raise HTTPException(409, "Nguồn đang được xử lý")
    sources.update_one({"_id": src["_id"]}, {"$set": {"status": "queued", "error": None, "cancel_requested": False},
                                             "$push": {"logs": {"at": db.now(), "msg": "Xử lý lại"}}})
    return {"ok": True}


class NoteIn(BaseModel):
    note: str = Field("", max_length=wiki.NOTE_MAX)


@router.put("/kb/sources/{source_id}/note")
def put_source_note(source_id: str, body: NoteIn, user: dict = Depends(current_user)):
    """Sửa "Ghi chú của bạn" trên nguồn (WK-44) — ai sửa được nguồn thì sửa được ghi chú. Ghi chú mới dùng cho lần
    dựng thẻ / tổng hợp sau, thẻ đã dựng không tự đổi."""
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    note = body.note.strip()
    if note != (src.get("note") or ""):
        sources.update_one({"_id": src["_id"]}, {"$set": {"note": note},
                                                 "$push": {"logs": {"at": db.now(), "msg": "Sửa ghi chú của người nạp"}}})
    return {"note": note}


class PriorityIn(BaseModel):
    top: bool = True   # True: lên đầu hàng chờ; False: về mức thường


@router.post("/kb/sources/{source_id}/priority")
def prioritize_source(source_id: str, body: PriorityIn, user: dict = Depends(current_user)):
    """Ưu tiên xử lý trước: nguồn đang chờ lên đầu làn của nó, tài liệu chờ dựng thẻ cũng được làm trước."""
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    priority = set_priority(src, body.top)
    if body.top:   # tài liệu đổi nội dung đang chờ lượt cập nhật thẻ hằng ngày -> cập nhật ngay
        card_update.release({"source_id": src["_id"]})
    eta.invalidate()
    return {"ok": True, "priority": priority, "eta": eta.of(src)}


@router.post("/kb/sources/{source_id}/cancel")
def cancel_source(source_id: str, user: dict = Depends(current_user)):
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    if src["status"] == "queued":
        sources.update_one({"_id": src["_id"]}, {"$set": {"status": "cancelled"}})
    elif src["status"] == "extracting":
        sources.update_one({"_id": src["_id"]}, {"$set": {"cancel_requested": True}})
    else:
        raise HTTPException(409, "Nguồn không ở trạng thái đang chờ / đang trích xuất")
    return {"ok": True}


@router.delete("/kb/sources/{source_id}", status_code=204)
def delete_source(source_id: str, user: dict = Depends(current_user)):
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    if src["status"] == "extracting":
        # đang chuyển chữ: dừng lại, pipeline tự xoá khi dừng xong; nguồn biến khỏi danh sách ngay
        sources.update_one({"_id": src["_id"]}, {"$set": {"cancel_requested": True, "delete_requested": True}})
        return Response(status_code=204)
    for run in synth.runs.find({"source_id": src["_id"], "status": {"$in": list(synth.ACTIVE)}}):
        synth.cancel_run(run)
    delete_source_data(src)
    sources.delete_one({"_id": src["_id"]})
    return Response(status_code=204)


class UrlsIn(BaseModel):
    urls: list[str] = Field(max_length=200)


def _url_keys(url: str) -> list[str]:
    """Các dạng so khớp của một link: nguyên bản, bỏ query / #, bỏ / cuối."""
    base = url.split("#")[0].split("?")[0]
    return list(dict.fromkeys([url, base, base.rstrip("/"), base.rstrip("/") + "/"]))


def semantic_documents(space_id: str | None, q: str, status: str, limit: int, user: dict) -> dict:
    """Tìm tầng thô theo nghĩa (kb/doc_vectors.py, Qdrant): tài liệu có đoạn gần nghĩa với `q`, kèm đoạn khớp.
    `available` = False khi Qdrant / AI local không sẵn sàng (hoặc RAW_SEMANTIC=0)."""
    f = space_scope(space_id, user, kind="document")
    if status.strip():
        f["wiki_status"] = {"$in": [x.strip() for x in status.split(",") if x.strip()]}
    res = doc_vectors.search(f, q, limit)
    if res is None:
        return {"available": False, "items": []}
    # tên nguồn / nền tảng / kho cho thẻ kết quả (FE tìm theo nội dung, WK-35) — 2 truy vấn gọn cho cả trang
    srcs = {s["_id"]: s for s in sources.find({"_id": {"$in": list({d["source_id"] for d in res if d.get("source_id")})}},
                                              {"title": 1, "platform": 1, "kind": 1, "url": 1})}
    snames = space_names(d["space_id"] for d in res if d.get("space_id"))
    items = []
    for d in res:
        s = srcs.get(d.get("source_id")) or {}
        items.append(out(d, {"source_title": s.get("title") or s.get("url"), "source_kind": s.get("kind"),
                             "platform": s.get("platform"), "space_name": snames.get(d.get("space_id"))}))
    return {"available": True, "items": items}


@router.get("/kb/documents/semantic")
def search_documents(q: str = Query(..., min_length=1), space_id: str | None = None, status: str = "",
                     limit: int = Query(20, ge=1, le=100), user: dict = Depends(current_user)):
    return semantic_documents(space_id, q, status, limit, user)


@router.post("/kb/documents/lookup")
def lookup_documents(body: UrlsIn, user: dict = Depends(current_user)):
    """Link nào (trong nội dung thẻ, chat…) là tài liệu / nguồn đã nạp mà mình xem được -> {url: {source_id, document_id}}.
    FE dùng để mở modal nguồn tại chỗ thay vì ra trang ngoài. Link không khớp thì không có trong kết quả."""
    keys = {k: u for u in body.urls for k in _url_keys(u)}
    if not keys:
        return {}
    scope = policy.visible_filter(user, "document")
    found = {}
    for d in documents.find(scope | {"url": {"$in": list(keys)}}, {"url": 1, "source_id": 1}):
        found.setdefault(keys[d["url"]], {"source_id": str(d["source_id"]), "document_id": str(d["_id"])})
    rest = [k for k, u in keys.items() if u not in found]
    if rest:
        for s in sources.find(policy.visible_filter(user, "source") | {"url": {"$in": rest}, "delete_requested": {"$ne": True}},
                              {"url": 1}):
            found.setdefault(keys[s["url"]], {"source_id": str(s["_id"]), "document_id": None})
    return found


@router.get("/kb/documents/{doc_id}")
def get_document(doc_id: str, segments: bool = False, user: dict = Depends(current_user)):
    """segments=1: kèm mốc thời gian từng câu [{start, end, text}] của video gốc (db.videos theo documents.key) —
    FE đồng bộ chữ với video nhúng. Mặc định không kèm cho gọn; tài liệu không phải video -> []."""
    doc, _ = load(documents, doc_id, user, "document.read", "tài liệu")
    result = out(doc) | {"text": doc.get("text", "")}
    if segments:
        v = db.videos.find_one({"_id": doc["key"]}, {"segments": 1}) if doc.get("key") and doc.get("url") else None
        result["segments"] = [{"start": s.get("start"), "end": s.get("end"), "text": s.get("text", "")}
                              for s in (v or {}).get("segments") or []]
    return result


class TagsIn(BaseModel):
    tags: list[str]


@router.put("/kb/documents/{doc_id}/tags")
def put_document_tags(doc_id: str, body: TagsIn, user: dict = Depends(current_user)):
    """Đặt tag cho tài liệu — lan sang thẻ VCWIKI dẫn về nó và video gốc (xem kb/tags.py)."""
    doc, _ = load(documents, doc_id, user, "document.write", "tài liệu")
    return {"tags": tag_mod.set_document_tags(doc, body.tags)}


@router.get("/kb/tags")
def list_tags(space_id: str | None = None, q: str = "", limit: int = Query(100, ge=1, le=500),
              user: dict = Depends(current_user)):
    """Tag đang dùng trên thẻ và tài liệu trong các kho mình xem được."""
    return tag_mod.vocabulary(space_scope(space_id, user), q, limit)


@router.post("/kb/documents/{doc_id}/rebuild")
def rebuild_document(doc_id: str, user: dict = Depends(current_user)):
    doc, _ = load(documents, doc_id, user, "document.write", "tài liệu")
    documents.update_one({"_id": doc["_id"]}, {"$set": {"wiki_status": "pending", "wiki_error": None, "wiki_retry_at": None}})
    return {"ok": True}


@router.post("/kb/sources/{source_id}/build-wiki")
def build_wiki(source_id: str, user: dict = Depends(current_user)):
    """Nguồn đang "chỉ chuyển chữ": bật dựng thẻ VCWIKI cho mọi tài liệu (và cho video quét thêm về sau)."""
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    sources.update_one({"_id": src["_id"]}, {"$set": {"options.build_wiki": True},
                                             "$push": {"logs": {"at": db.now(), "msg": "Bật dựng thẻ VCWIKI"}}})
    n = documents.update_many({"source_id": src["_id"], "wiki_status": "skipped"},
                              {"$set": {"wiki_status": "pending", "wiki_error": None, "wiki_retry_at": None}}).modified_count
    return {"queued": n}


def queue_video_link(url: str, user: dict, options: dict) -> dict:
    """Chuyển chữ lại một video: xếp lại nguồn chứa đúng link đó, không có thì tạo nguồn mới.
    Nguồn đặt ở kho đã có video này nếu người dùng được sửa kho đó, không thì kho cá nhân."""
    space = None
    for d in documents.find({"url": url}, {"space_id": 1}).limit(20):
        if policy.can(user, "source.write", d):
            space = spaces.find_one({"_id": d["space_id"]})
            break
    space = space or personal_space(user)
    wanted = {k: v for k, v in options.items() if k in SourceOptions.model_fields}
    if src := sources.find_one({"space_id": space["_id"], "url": url}):
        if src["status"] in ("queued", "extracting"):
            raise HTTPException(409, "Video đang được xử lý")
        keep = {k: v for k, v in (src.get("options") or {}).items() if k in SourceOptions.model_fields}
        requeue(src, "Chuyển chữ lại", resolve_options("video", SourceOptions(**(keep | wanted))))
        return sources.find_one({"_id": src["_id"]})
    opts = resolve_options("video", SourceOptions(**wanted))
    return new_source(space, user, kind="video", url=url, title=None, platform=platform_of(url), google=None,
                      categories=[], tags=[], note="", options=opts)


# ---------------------------------------------------------------------------
# VCWIKI — thẻ tri thức
# ---------------------------------------------------------------------------

CardType = Literal["framework", "concept", "case_study", "regulation", "insight", "hook", "lesson",
                   "sop", "checklist", "template", "kpi", "skill", "memory", "context"]
Level = Literal["dieu-hanh", "thiet-ke", "van-hanh", "thuc-thi", "nhap-mon"]   # = classify.LEVELS
CardStatus = Literal["draft", "approved", "rejected"]
CARD_STATUSES = get_args(CardStatus)


def _check_values(field: str, vals: list[str], allowed) -> list[str]:
    """Bộ lọc nhiều giá trị: giá trị lạ -> 400 nêu tên trường, không lặng lẽ trả 0 kết quả."""
    if wrong := [v for v in vals if v not in allowed]:
        classify._bad(field, f"{', '.join(wrong)} không hợp lệ — chọn trong {', '.join(allowed)}")
    return vals


class CardIn(BaseModel):
    space_id: str | None = None
    document_id: str | None = None   # tài liệu trong Kho tư liệu mà thẻ được tinh chế từ đó
    type: CardType
    title: str = Field(min_length=1, max_length=200)
    summary: str = ""
    body: str = ""
    key_points: list[str] = []
    when_to_use: str = ""
    example: str = ""
    evidence: str = ""
    categories: list[str] = []
    tags: list[str] = []
    fields: dict[str, str] = {}      # trường tự thêm: tên trường -> giá trị (vd "Hiệu lực": "01/07/2026")
    # phân loại v2 (kb/classify.py) — kiểm tra ở create_card để lỗi nêu đúng tên trường
    level: str | None = None                  # một trong classify.LEVELS
    division: list[str] = []                  # classify.DIVISIONS, rỗng = ["tap-doan"]
    process_steps: list[str] = []             # 0–2, dạng qt.<chuỗi>.<a|b|c|d>
    effective_at: str | None = None           # YYYY-MM-DD
    review_cycle_months: StrictInt | None = None   # strict: true/false không bị đổi thành 1/0


MAX_FIELDS = 30


def clean_fields(fields: dict[str, str]) -> dict[str, str]:
    """Trường tự thêm của thẻ: bỏ khoảng trắng thừa, bỏ trường rỗng, giới hạn độ dài và số trường."""
    out = {}
    for k, v in fields.items():
        k, v = " ".join(str(k).split())[:60], str(v).strip()[:4000]
        if k and v and not k.startswith(("$", ".")) and "." not in k:
            out[k] = v
    if len(out) > MAX_FIELDS:
        raise HTTPException(400, f"Thẻ tối đa {MAX_FIELDS} trường tự thêm")
    return out


class CardPatch(BaseModel):
    type: CardType | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    summary: str | None = None
    body: str | None = None
    key_points: list[str] | None = None
    when_to_use: str | None = None
    example: str | None = None
    evidence: str | None = None
    categories: list[str] | None = None
    tags: list[str] | None = None
    fields: dict[str, str] | None = None   # thay toàn bộ trường tự thêm
    level: str | None = None                 # "" = gỡ
    division: list[str] | None = None        # [] = về mặc định ["tap-doan"]
    process_steps: list[str] | None = None
    effective_at: str | None = None          # "" = gỡ
    review_cycle_months: StrictInt | None = None   # 0 = gỡ
    status: CardStatus | None = None
    # --- GOV (luồng F): lý do loại / nhận xét khi duyệt; tóm tắt + mức thay đổi khi sửa thẻ đã duyệt thành đề xuất
    reason: str | None = Field(None, max_length=1000)
    change_summary: str | None = Field(None, max_length=1000)
    change_kind: Literal["minor", "major"] | None = None


class CopyIn(BaseModel):
    space_id: str


def cards_out(rows: list[dict], user: dict) -> list[dict]:
    people = names_of([r["created_by"] for r in rows] + [r["reviewed_by"] for r in rows if r.get("reviewed_by")])
    snames = space_names(r["space_id"] for r in rows)
    editable = set(policy.editable_space_ids(user, among={r["space_id"] for r in rows}))
    social_stats = social.card_stats([r["_id"] for r in rows], user["_id"])
    return [out(r, classify.defaults(r) | {"created_by_name": people.get(r["created_by"]),
                    "reviewed_by_name": people.get(r.get("reviewed_by")),
                    "space_name": snames.get(r["space_id"]),
                    "can_edit": r["space_id"] in editable,
                    "social": social_stats[r["_id"]]}) for r in rows]


@router.get("/wiki/cards")
def list_cards(space_id: str | None = None, q: str | None = None, type: str | None = None,
               status: str | None = None, tag: str | None = None, source_id: str | None = None,
               category: str | None = None, level: str | None = None, division: str | None = None,
               process_step: str | None = None,
               page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
               user: dict = Depends(current_user), include_ai_memory: bool = False,
               match: str | None = None):
    """level / division / process_step: nhiều giá trị cách dấu phẩy; division=tap-doan khớp cả thẻ cũ.
    match=title: chỉ khớp **tiêu đề** (không dấu, không hoa thường), tiền tố tiêu đề xếp trước rồi tới tiêu đề
    chứa đủ các từ — không chạy tìm theo nghĩa / rerank nên trả trong vài chục ms (ô chọn thẻ căn cứ ở /learn).
    Có q: tìm hybrid (hybrid_page, cách xếp kb/card_search.py) — chữ không dấu chấm BM25F + theo nghĩa
    (kb/embeddings.py), gộp RRF có trọng số, rồi rerank; mỗi thẻ kèm `match` = text / semantic / both,
    `semantic_score`, `text_score`, `rerank_score`. AI local tắt (hoặc SEARCH_SEMANTIC=0) thì chỉ nhánh chữ.
    Có q mà không lọc type: bỏ thẻ bộ nhớ AI (skill / memory / context — WK-22) trừ khi include_ai_memory=true;
    duyệt không q thì vẫn hiện."""
    f = space_scope(space_id, user, category)
    if extra := classify.filters(level, division, process_step):
        f = {"$and": [f, *extra]}
    more: dict = {}
    if types := classify.csv(type):
        more["type"] = {"$in": _check_values("type", types, get_args(CardType))}
    if statuses := classify.csv(status):
        more["status"] = {"$in": _check_values("status", statuses, CARD_STATUSES)}
    if tag:
        more["tags"] = tag
    if source_id:
        more["source_id"] = oid(source_id)
    if q and q.strip() and not types and not include_ai_memory and card_search.RANKING != "v1":
        more["type"] = {"$nin": list(wiki.AI_CARD_TYPES)}
    if more:
        f = {"$and": [f, more]}
    if q and q.strip() and match == "title":
        return title_page(f, q, page, page_size, user)
    if q and q.strip():
        if (semantic := embeddings.semantic_search(f, q)) is not None:
            return hybrid_page(f, q, semantic, page, page_size, user)
        if card_search.RANKING != "v1":
            return ranked_page(card_search.text_only(f, q), q, page, page_size, user, semantic=False,
                               topn=card_search.RERANK_HEAD)
        f = {"$and": [f, {"search_text": db.search_regex(q)}]}
    rows = list(cards.find(f).sort("updated_at", -1).skip((page - 1) * page_size).limit(page_size))
    return {"items": cards_out(rows, user), "total": cards.count_documents(f)}


TITLE_SCAN_MAX = 2000    # match=title: số thẻ khớp chữ (search_text) tối đa đem lọc lại theo tiêu đề


def title_page(f: dict, q: str, page: int, page_size: int, user: dict) -> dict:
    """Tìm theo tiêu đề cho ô chọn thẻ: (1) tiêu đề bắt đầu bằng chuỗi gõ (search_text mở đầu bằng tiêu đề không dấu
    nên regex neo `^` dùng được chỉ mục), (2) tiêu đề chứa đủ mọi từ. Xếp: tiền tố trước, rồi tiêu đề ngắn hơn (khớp
    sát hơn) trước. `match` của từng thẻ = title_prefix / title."""
    qn = db.unaccent(q.strip())
    words = qn.split()
    proj = {"title": 1}
    prefix = [c["_id"] for c in cards.find({"$and": [f, {"search_text": {"$regex": "^" + re.escape(qn)}}]}, proj)
              .limit(TITLE_SCAN_MAX)]
    seen = set(prefix)
    contains = []
    if words:
        for c in cards.find({"$and": [f, {"search_text": db.search_regex(q)}]}, proj).limit(TITLE_SCAN_MAX):
            if c["_id"] in seen:
                continue
            t = db.unaccent(c.get("title") or "")
            if all(w in t for w in words):
                contains.append((len(t), c["_id"]))
    contains.sort()
    order = prefix + [i for _, i in contains]
    kind = {i: "title_prefix" for i in prefix} | {i: "title" for _, i in contains}
    ids = order[(page - 1) * page_size: page * page_size]
    by_id = {c["_id"]: c for c in cards.find({"_id": {"$in": ids}})}
    rows = [by_id[i] for i in ids if i in by_id]
    items = [o | {"match": kind[r["_id"]]} for o, r in zip(cards_out(rows, user), rows)]
    return {"items": items, "total": len(order), "match": "title"}


HYBRID_TEXT_MAX = 1000   # v1: số thẻ khớp chữ tối đa đem gộp thứ hạng
TITLE_WEIGHT = 2.0       # v1: điểm BM25 của tiêu đề nhân thêm bấy nhiêu (khớp tiêu đề mạnh hơn khớp thân bài)
RERANK_CHARS = 800       # nội dung thẻ đem rerank (rerank_text): tiêu đề, tóm tắt, ý chính, khi nào dùng, đầu thân bài
RERANK_FIELDS = {"title": 1, "summary": 1, "key_points": 1, "when_to_use": 1, "body": 1}
CORPUS_TTL = 300         # giây: thống kê df của thẻ (BM25) dựng lại tối đa mỗi bấy nhiêu giây khi thẻ đổi

_corpus: tuple[float, tuple, lexical.Corpus] | None = None


def card_corpus() -> lexical.Corpus:
    """df + độ dài trung bình trên mọi thẻ (IDF của BM25) — dùng chung mọi người, cũ vài phút không sao."""
    global _corpus
    key = (cards.estimated_document_count(),
           (cards.find_one({}, {"updated_at": 1}, sort=[("updated_at", -1)]) or {}).get("updated_at"))
    if _corpus is None or (_corpus[1] != key and time.time() - _corpus[0] > CORPUS_TTL):
        _corpus = (time.time(), key, lexical.Corpus([c.get("search_text") or "" for c in cards.find({}, {"search_text": 1})]))
    return _corpus[2]


def hybrid_page(f: dict, q: str, semantic: list, page: int, page_size: int, user: dict) -> dict:
    """Tìm hybrid: nhánh chữ + thẻ gần nghĩa gộp thứ hạng (v2: kb/card_search.py — BM25F, RRF có trọng số; v1: thẻ
    khớp đủ các từ xếp BM25, RRF đều); rồi reranker (kb/rerank.py) chấm lại các thẻ đầu (v2: card_search.rerank_head,
    v1: RERANK_TOPN) — thẻ đã chấm xếp theo điểm rerank, đứng trên phần còn lại. Reranker không sẵn sàng / quá giờ
    thì giữ thứ tự gộp, `reranked` = False."""
    if card_search.RANKING != "v1":
        fused = card_search.hybrid(f, q, semantic)
        return ranked_page(fused, q, page, page_size, user, semantic=True, topn=card_search.rerank_head(q, fused))
    hits = list(cards.find({"$and": [f, {"search_text": db.search_regex(q)}]}, {"title": 1, "search_text": 1})
                .sort("updated_at", -1).limit(HYBRID_TEXT_MAX))
    corpus = card_corpus()
    lex = {c["_id"]: corpus.score(q, c.get("search_text") or "") + TITLE_WEIGHT * corpus.score(q, c.get("title") or "")
           for c in hits}
    hits.sort(key=lambda c: -lex[c["_id"]])
    fused = [(*x, None) for x in embeddings.fuse([c["_id"] for c in hits], semantic)]
    return ranked_page(fused, q, page, page_size, user, semantic=True)


def ranked_page(fused: list[tuple], q: str, page: int, page_size: int, user: dict, semantic: bool,
                topn: int | None = None) -> dict:
    """[(id, match, semantic_score, text_score)] đã xếp -> rerank `topn` thẻ đầu -> một trang kết quả."""
    fused, reranked = rerank_cards(q, fused, topn)
    chunk = fused[(page - 1) * page_size:page * page_size]
    by_id = {r["_id"]: r for r in cards.find({"_id": {"$in": [x[0] for x in chunk]}})}
    rows = [by_id[x[0]] for x in chunk if x[0] in by_id]
    meta = {x[0]: x for x in chunk}
    items = [c | {"match": meta[r["_id"]][1], "semantic_score": meta[r["_id"]][2], "text_score": meta[r["_id"]][3],
                  "rerank_score": meta[r["_id"]][4], "reranked": reranked}
             for r, c in zip(rows, cards_out(rows, user))]
    return {"items": items, "total": len(fused), "semantic": semantic, "reranked": reranked}


def rerank_text(card: dict) -> str:
    """Nội dung thẻ đem rerank: tiêu đề, tóm tắt, ý chính, khi nào dùng, rồi thân bài — cắt RERANK_CHARS ký tự."""
    parts = [card.get("title") or "", card.get("summary") or "", " ".join(card.get("key_points") or []),
             card.get("when_to_use") or "", card.get("body") or ""]
    return "\n".join(p for p in parts if p)[:RERANK_CHARS]


def rerank_cards(q: str, fused: list[tuple], topn: int | None = None) -> tuple[list[tuple], bool]:
    """[(id, match, semantic_score, text_score)] -> ([(..., rerank_score)], đã rerank?): `topn` (mặc định
    RERANK_TOPN) thẻ đầu xếp lại theo điểm rerank, thẻ dưới RERANK_MIN bị bỏ. Reranker tắt / lỗi / quá giờ -> giữ
    thứ tự, False."""
    topn = min(rerank.TOPN if topn is None else topn, rerank.TOPN)
    head = fused[:topn]
    rows = {r["_id"]: r for r in cards.find({"_id": {"$in": [x[0] for x in head]}}, RERANK_FIELDS)}
    head = [x for x in head if x[0] in rows]
    scores = rerank.score(q, [rerank_text(rows[x[0]]) for x in head]) if head else None
    if scores is None:
        return [(*x, None) for x in fused], False
    ranked = sorted(((*x, sc) for x, sc in zip(head, scores) if sc >= rerank.MIN_SCORE), key=lambda x: -x[-1])
    done = {x[0] for x in head}
    return ranked + [(*x, None) for x in fused[topn:] if x[0] not in done], True


@router.get("/wiki/tags")
def wiki_tags(space_id: str | None = None, user: dict = Depends(current_user)):
    return sorted(t for t in cards.distinct("tags", space_scope(space_id, user)) if isinstance(t, str))


@router.get("/wiki/cards/{card_id}")
def get_card(card_id: str, user: dict = Depends(current_user)):
    card, _ = load(cards, card_id, user, "card.read", "thẻ")
    return cards_out([card], user)[0]


@router.get("/wiki/cards/{card_id}/audio")
def card_audio(card_id: str, voice: Literal["female", "male"] = "female",
               rate: Literal["slow", "normal", "fast"] = "normal", user: dict = Depends(current_user)):
    """Đọc thẻ thành giọng nói tiếng Việt (mp3)."""
    card, _ = load(cards, card_id, user, "card.read", "thẻ")
    if not tts.ready():
        raise HTTPException(503, "Máy chủ chưa cài edge-tts (pip install edge-tts)")
    text = tts.card_text(card)
    if not text:
        raise HTTPException(400, "Thẻ không có nội dung để đọc")
    headers = {"Cache-Control": "private, max-age=86400"}
    path = tts.cache_path(text, voice, rate)
    if path.exists():
        return FileResponse(path, media_type="audio/mpeg", headers=headers)
    return StreamingResponse(tts.stream(text, voice, rate), media_type="audio/mpeg", headers=headers)


@router.post("/wiki/cards", status_code=201)
def create_card(body: CardIn, user: dict = Depends(current_user)):
    link = {"source_id": None, "document_id": None, "source": None}
    tl = None
    if body.document_id:
        tl, _ = load(documents, body.document_id, user, "document.read", "tài liệu")
        src = sources.find_one({"_id": tl["source_id"]}, {"kind": 1, "url": 1}) or {}
        link = {"source_id": tl["source_id"], "document_id": tl["_id"],
                "source": {"kind": src.get("kind"), "title": tl["title"], "url": tl.get("url") or src.get("url")}}
    if body.space_id:
        space = policy.load_space(body.space_id, user, "card.write")
    elif tl and policy.can(user, "card.write", tl):
        space = spaces.find_one({"_id": tl["space_id"]})   # mặc định: cùng kho với tài liệu gốc
    else:
        space = personal_space(user)
    now = db.now()
    doc = body.model_dump(exclude={"space_id", "document_id", *classify.FIELDS}) | link | {
        "tags": tag_mod.inherit(body.tags, [tl["_id"]] if tl else []),
        "categories": cat_mod.check_slugs(body.categories), "fields": clean_fields(body.fields),
        **classify.split(classify.clean(body.model_dump(include=set(classify.FIELDS))))[0],
        "space_id": space["_id"],
        "status": "draft", "origin": "manual", "created_by": user["_id"],
        "refined_by": db.refiner("manual", user["name"], user_id=user["_id"]),
        "created_at": now, "updated_at": now}
    doc["search_text"] = card_search_text(doc)
    doc["_id"] = cards.insert_one(doc).inserted_id
    embeddings.schedule([doc["_id"]])   # tìm theo nghĩa — chạy nền, AI local tắt thì bỏ qua
    if tl:
        mark_document_refined(tl["_id"], by=doc["refined_by"])
    return cards_out([doc], user)[0]


def mark_document_refined(doc_id, summary: str | None = None, by: dict | None = None) -> None:
    """Tài liệu đã được tinh chế vào VCWIKI (bởi người / Claude qua MCP) — pipeline không dựng lại nữa.
    by: db.refiner(...) — ai tinh chế, hiện ở cột "AI tinh chế" trang Tinh chế."""
    upd = {"wiki_status": "done", "wiki_error": None, "wiki_at": db.now(), "claimed_by": None,
           "card_count": cards.count_documents({"document_id": doc_id})}
    if by:
        upd["refined_by"] = by
    if summary is not None:
        upd["summary"] = summary
    documents.update_one({"_id": doc_id}, {"$set": upd})


def normalize_patch(card: dict, body: "CardPatch") -> tuple[dict, dict]:
    """Kiểm tra + chuẩn hoá phần sửa nội dung (không gồm trạng thái) -> ($set, $unset). Dùng chung cho sửa trực tiếp
    thẻ nháp và đề xuất sửa thẻ đã duyệt (kb/changes.py)."""
    changes = body.model_dump(exclude_none=True, exclude={"status", "reason", "change_summary", "change_kind"})
    if "tags" in changes:
        changes["tags"] = db.clean_tags(changes["tags"])
    if "categories" in changes:
        # slug thẻ đang có (kể cả nhánh đã ẩn) được giữ — chỉ kiểm tra slug mới thêm
        changes["categories"] = cat_mod.check_slugs(changes["categories"], keep=card.get("categories") or [])
    cls_set, cls_unset = classify.split(classify.clean(changes, card))
    changes = {k: v for k, v in changes.items() if k not in classify.STORED} | cls_set
    if "fields" in changes:
        changes["fields"] = clean_fields(changes["fields"])
    return changes, {k: v for k, v in cls_unset.items() if k in card}   # chỉ gỡ trường thẻ đang có


@router.patch("/wiki/cards/{card_id}")
def patch_card(card_id: str, body: CardPatch, user: dict = Depends(current_user)):
    return update_card_as(card_id, body, user)


def update_card_as(card_id: str, body: CardPatch, user: dict, channel: str = "web") -> dict:
    """Sửa thẻ (GOV — BA 16.7): thẻ đã duyệt không sửa thẳng — phần sửa thành đề xuất `update` (trả thẻ hiện tại kèm
    `change`); đổi trạng thái thẻ nháp sang approved = gửi / duyệt qua luật duyệt (kb/changes.py). Bộ nhớ AI (skill /
    memory / context) không qua duyệt — xét loại thẻ cả TRƯỚC và SAU khi sửa (QA N-2): thẻ đang hoặc sẽ là loại tri
    thức thì phải qua đề xuất, không bao giờ ra thẻ tri thức approved mà không có đề xuất / phiên bản."""
    card, _ = load(cards, card_id, user, "card.read", "thẻ")
    has_content = bool(body.model_dump(exclude_none=True, exclude={"status", "reason", "change_summary", "change_kind"}))
    governed = changes_mod.governed(card) or changes_mod.governed({"type": body.type or card.get("type")})
    if governed and card.get("status") == "approved":
        if body.status and body.status != "approved":
            raise HTTPException(400, "Thẻ đã duyệt không đổi trạng thái trực tiếp — tạo đề xuất lỗi thời (obsolete)")
        if not has_content:
            return cards_out([card], user)[0]
        set_, unset = normalize_patch(card, body)
        ch = changes_mod.propose_update(card, user, set_, unset, body.change_summary or "", body.change_kind,
                                        "mcp" if channel == "mcp" else "manual")
        return cards_out([card], user)[0] | {"change": changes_mod.change_out(ch, user), "notice": (
            "Thẻ đã duyệt không sửa trực tiếp — đã tạo đề xuất sửa, chờ duyệt")}
    policy.require(user, "card.write", card, "thẻ")
    changes, cls_unset = normalize_patch(card, body)
    if changes or cls_unset:
        edited = any(card.get(k) != v for k, v in changes.items()) or bool(cls_unset)
        changes["updated_at"] = db.now()
        changes["search_text"] = card_search_text(card | changes)
        upd = {"$set": changes} | ({"$unset": cls_unset} if cls_unset else {})
        if edited and channel != "mcp":
            upd["$addToSet"] = {"edited_by": user["_id"]}   # người sửa nội dung nháp cũng là tác giả (QA N-1)
        cards.update_one({"_id": card["_id"]}, upd)
        changes_mod.on_draft_edited(card["_id"])
        embeddings.schedule([card["_id"]])
    before, card = card, cards.find_one({"_id": card["_id"]})    # từ đây xét thẻ SAU khi sửa
    if changes_mod.governed(before) and not changes_mod.governed(card):
        changes_mod.close_open(card["_id"], "Hệ thống: thẻ đổi sang loại bộ nhớ AI — không qua luồng duyệt")
    extra: dict = {}
    status = body.status
    if status and status != card.get("status") and not changes_mod.governed(card):
        cards.update_one({"_id": card["_id"]}, {"$set": {"status": status, "reviewed_by": user["_id"],
                                                         "reviewed_at": db.now()}})
    elif status == "approved" and card.get("status") != "approved":
        ch = changes_mod.submit_draft(card, user, "mcp" if channel == "mcp" and card.get("origin") == "mcp" else None)
        card = cards.find_one({"_id": card["_id"]})
        notice = "Đã gửi duyệt"
        if channel == "mcp":
            notice = "AI không duyệt thẻ (SYS-12) — đã gửi thẻ vào hộp duyệt, người duyệt quyết định"
        elif user["_id"] in changes_mod.authors(ch, card):
            notice = "Đã gửi duyệt — bạn là tác giả nên không tự duyệt (bốn mắt)"
        elif changes_mod.can_decide(user, card, ch):
            ch = changes_mod.decide(ch, user, "approve", body.reason or "")
            notice = "Đã duyệt" if ch["status"] == "approved" else "Đã duyệt bước 1 — chờ người duyệt bước 2"
        else:
            notice = "Đã gửi duyệt — bạn không phải người duyệt của bước này"
        extra = {"change": changes_mod.change_out(ch, user), "notice": notice}
    elif status == "rejected" and card.get("status") != "rejected":
        ch = changes_mod.open_change(card["_id"], "create")
        if ch and user["_id"] != ch.get("created_by"):
            if not (body.reason or "").strip():
                raise HTTPException(400, "Thẻ đang chờ duyệt — loại thẻ cần ghi lý do")
            ch = changes_mod.decide(ch, user, "reject", body.reason)
            extra = {"change": changes_mod.change_out(ch, user)}
        else:   # thẻ chưa gửi duyệt, hoặc chính người gửi tự loại -> rút đề xuất
            if ch:
                changes_mod.withdraw(ch, user, body.reason or "Người gửi tự loại thẻ")
            cards.update_one({"_id": card["_id"]}, {"$set": {"status": "rejected", "reviewed_by": user["_id"],
                                                             "reviewed_at": db.now()}})
    elif status == "draft" and card.get("status") == "rejected":
        cards.update_one({"_id": card["_id"]}, {"$set": {"status": "draft", "updated_at": db.now()}})
    return cards_out([cards.find_one({"_id": card["_id"]})], user)[0] | extra


@router.delete("/wiki/cards/{card_id}", status_code=204)
def delete_card(card_id: str, user: dict = Depends(current_user)):
    card, _ = load(cards, card_id, user, "card.write", "thẻ")
    if changes_mod.governed(card) and card.get("status") == "approved":
        raise HTTPException(409, "Thẻ đã duyệt không xoá được — tạo đề xuất lỗi thời (BA 16.5)")
    cards.delete_one({"_id": card["_id"]})
    embeddings.store.delete_one({"_id": card["_id"]})
    changes_mod.on_card_deleted(card["_id"])
    return Response(status_code=204)


@router.post("/wiki/cards/{card_id}/copy", status_code=201)
def copy_card(card_id: str, body: CopyIn, user: dict = Depends(current_user)):
    """Sao chép thẻ từ kho mình được xem sang kho mình được sửa (vd từ kho chia sẻ về kho cá nhân)."""
    card, _ = load(cards, card_id, user, "card.read", "thẻ")
    target = policy.load_space(body.space_id, user, "card.write")
    now = db.now()
    doc = {k: v for k, v in card.items() if k not in ("_id", "reviewed_by", "reviewed_at", "edited_by")} | {
        "space_id": target["_id"], "status": "draft", "origin": "copy", "copied_from": card["_id"],
        "created_by": user["_id"], "created_at": now, "updated_at": now}
    doc["_id"] = cards.insert_one(doc).inserted_id
    embeddings.schedule([doc["_id"]])
    return cards_out([doc], user)[0]


# ---------------------------------------------------------------------------
# Thảo luận & bình chọn (kb/social.py)
# ---------------------------------------------------------------------------

class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    parent_id: str | None = None        # trả lời bình luận nào (không có: bình luận mới)


class VoteIn(BaseModel):
    stars: int = Field(ge=0, le=5)      # 0 = gỡ lượt chấm


def load_comment(comment_id: str, user: dict) -> tuple[dict, dict]:
    """Bình luận + thẻ chứa nó; người không xem được thẻ thì cũng không thấy bình luận."""
    c = social.comments.find_one({"_id": oid(comment_id, "bình luận"), "deleted": {"$ne": True}})
    if not c:
        raise HTTPException(404, "Không tìm thấy bình luận")
    card, _ = load(cards, str(c["card_id"]), user, "card.read", "bình luận")
    return c, card


@router.get("/wiki/cards/{card_id}/comments")
def list_comments(card_id: str, user: dict = Depends(current_user)):
    """Danh sách phẳng theo thời gian; FE dựng cây trả lời theo `parent_id`.
    Bình luận đã xoá mà còn câu trả lời thì vẫn trả về (ẩn nội dung) để giữ mạch thảo luận."""
    card, space = load(cards, card_id, user, "card.read", "thẻ")
    rows = list(social.comments.find({"card_id": card["_id"]}).sort("created_at", 1))
    parent = {r["_id"]: r.get("parent_id") for r in rows}
    keep = set()
    for r in rows:
        if not r.get("deleted"):     # giữ bình luận còn sống và cả chuỗi bình luận cha của nó
            i = r["_id"]
            while i and i not in keep:
                keep.add(i)
                i = parent.get(i)
    rows = [r for r in rows if r["_id"] in keep]
    people = names_of(r["user_id"] for r in rows)
    stats = social.comment_stats([r["_id"] for r in rows], user["_id"])
    is_editor = policy.can(user, "card.write", space)
    return [{"id": str(r["_id"]), "parent_id": str(r["parent_id"]) if r.get("parent_id") else None,
             "deleted": bool(r.get("deleted")), "body": "" if r.get("deleted") else r["body"],
             "created_at": r["created_at"], "updated_at": r.get("updated_at"),
             "user_id": str(r["user_id"]), "user_name": people.get(r["user_id"]),
             "social": stats[r["_id"]], "is_mine": r["user_id"] == user["_id"],
             "can_delete": not r.get("deleted") and (r["user_id"] == user["_id"] or is_editor)} for r in rows]


@router.post("/wiki/cards/{card_id}/comments", status_code=201)
def add_comment(card_id: str, body: CommentIn, user: dict = Depends(current_user)):
    card, _ = load(cards, card_id, user, "card.read", "thẻ")
    if not body.body.strip():
        raise HTTPException(400, "Bình luận trống")
    parent = None
    if body.parent_id:
        parent = social.comments.find_one({"_id": oid(body.parent_id, "bình luận"), "card_id": card["_id"],
                                           "deleted": {"$ne": True}})
        if not parent:
            raise HTTPException(404, "Bình luận muốn trả lời không còn nữa")
    now = db.now()
    social.comments.insert_one({"card_id": card["_id"], "space_id": card["space_id"], "user_id": user["_id"],
                                "parent_id": parent["_id"] if parent else None,
                                "body": body.body.strip(), "month": social.month_of(now),
                                "created_at": now, "updated_at": None})
    return list_comments(card_id, user)


@router.patch("/wiki/comments/{comment_id}")
def edit_comment(comment_id: str, body: CommentIn, user: dict = Depends(current_user)):
    c, card = load_comment(comment_id, user)
    if c["user_id"] != user["_id"]:
        raise HTTPException(403, "Chỉ người viết được sửa bình luận")
    social.comments.update_one({"_id": c["_id"]}, {"$set": {"body": body.body.strip(), "updated_at": db.now()}})
    return list_comments(str(card["_id"]), user)


@router.delete("/wiki/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: str, user: dict = Depends(current_user)):
    c, card = load_comment(comment_id, user)
    if c["user_id"] != user["_id"] and not policy.can(user, "card.write", card):
        raise HTTPException(403, "Chỉ người viết hoặc người sửa được kho mới xoá được bình luận")
    # Xoá mềm: không còn hiện, không tính vào bảng xếp hạng; sao đã thả cho bình luận vẫn giữ (đã tính tháng đó)
    social.comments.update_one({"_id": c["_id"]}, {"$set": {"deleted": True, "deleted_by": user["_id"],
                                                            "deleted_at": db.now()}})
    return Response(status_code=204)


@router.put("/wiki/cards/{card_id}/vote")
def vote_card(card_id: str, body: VoteIn, user: dict = Depends(current_user)):
    card, _ = load(cards, card_id, user, "card.read", "thẻ")
    social.cast_vote(target="card", target_id=card["_id"], card=card, receiver_id=card["created_by"],
                     giver=user, stars=body.stars)
    return cards_out([card], user)[0]


@router.put("/wiki/comments/{comment_id}/vote")
def vote_comment(comment_id: str, body: VoteIn, user: dict = Depends(current_user)):
    c, card = load_comment(comment_id, user)
    social.cast_vote(target="comment", target_id=c["_id"], card=card, receiver_id=c["user_id"],
                     giver=user, stars=body.stars)
    return list_comments(str(card["_id"]), user)


@router.get("/wiki/leaderboard")
def wiki_leaderboard(month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"), user: dict = Depends(current_user)):
    """Bảng theo dõi tháng: ai nhận nhiều sao nhất là người thắng giải tháng đó (tháng đã kết thúc mới chốt)."""
    current = social.month_of()
    month = month or current
    rows = social.leaderboard(month)
    people = names_of(r["user_id"] for r in rows)
    items = [r | {"user_id": str(r["user_id"]), "name": people.get(r["user_id"]) or "(đã xoá)",
                  "is_me": r["user_id"] == user["_id"]} for r in rows]
    top = items[0]["stars_received"] if items else 0
    return {"month": month, "current_month": current, "closed": month < current,
            "months": social.active_months(), "items": items,
            "leaders": [r["user_id"] for r in items if top and r["stars_received"] == top]}


# ---------------------------------------------------------------------------
# Tổng hợp VCWIKI theo cụm chủ đề (kb/synth.py)
# ---------------------------------------------------------------------------

class SynthIn(BaseModel):
    external: bool | None = None     # gắn tag nguon-ben-ngoai; mặc định: nguồn video mạng xã hội / web


class SynthClusterIn(BaseModel):
    key: str | None = None
    title: str = ""
    category: str | None = None
    doc_ids: list[str] = []
    primary_id: str | None = None
    n_cards: int = Field(1, ge=1, le=synth.MAX_CARDS_PER_CLUSTER)
    note: str = ""


class SynthPlanIn(BaseModel):
    clusters: list[SynthClusterIn]


def synth_out(run: dict, user: dict, full: bool = True) -> dict:
    by_status: dict[str, int] = {}
    for c in run["clusters"]:
        by_status[c["status"]] = by_status.get(c["status"], 0) + 1
    o = {
        "id": str(run["_id"]), "source_id": str(run["source_id"]), "source_title": run.get("source_title"),
        "status": run["status"], "stage": run.get("stage"), "error": run.get("error"), "progress": run.get("progress"),
        "external": run.get("external"), "usage": run.get("usage"), "created_at": run["created_at"],
        "updated_at": run.get("updated_at"), "finished_at": run.get("finished_at"),
        "created_by_name": names_of([run["created_by"]]).get(run["created_by"]),
        "doc_count": len(run["docs"]), "kept_count": sum(1 for d in run["docs"] if d.get("keep")),
        "cluster_count": len(run["clusters"]), "clusters_by_status": by_status,
        "card_count": sum(len(c.get("card_ids") or []) for c in run["clusters"]),
        "can_edit": policy.can(user, "space.write", {"space_id": run["space_id"]}),
    }
    if full:
        ids = [i for c in run["clusters"] for i in c.get("card_ids") or []]
        cmap = {c["_id"]: c for c in cards.find({"_id": {"$in": ids}}, {"title": 1, "status": 1, "type": 1})}
        o["docs"] = [{k: (str(v) if k == "id" else v) for k, v in d.items() if k != "prev_status"} for d in run["docs"]]
        o["clusters"] = [c | {"card_ids": [str(i) for i in c.get("card_ids") or []],
                              "cards": [{"id": str(i), "title": cmap[i]["title"], "status": cmap[i]["status"],
                                         "type": cmap[i]["type"]} for i in c.get("card_ids") or [] if i in cmap]}
                         for c in run["clusters"]]
        o["logs"] = run.get("logs", [])
    return o


def load_run(run_id: str, user: dict, action: str = "space.read") -> dict:
    run = synth.runs.find_one({"_id": oid(run_id, "lượt tổng hợp")})
    if not run:
        raise HTTPException(404, "Không tìm thấy lượt tổng hợp")
    policy.load_space(run["space_id"], user, action)          # lỗi báo "Không tìm thấy kho" như cũ
    return run


@router.post("/kb/sources/{source_id}/synth", status_code=201)
def start_synth(source_id: str, body: SynthIn, user: dict = Depends(current_user)):
    """Tạo lượt tổng hợp cho mọi tài liệu chưa vào VCWIKI của nguồn. Đã có lượt đang chạy thì trả lượt đó."""
    src, _ = load(sources, source_id, user, "source.write", "nguồn")
    active = synth.runs.find_one({"source_id": src["_id"], "status": {"$in": list(synth.ACTIVE)}})
    if active:
        return synth_out(active, user, full=False)
    if src["status"] in ("queued", "extracting"):
        raise HTTPException(409, "Nguồn đang chuyển chữ — đợi xong rồi tổng hợp")
    n = documents.count_documents({"source_id": src["_id"], "wiki_status": {"$in": list(synth.LOCKABLE)}})
    if n < 2:
        raise HTTPException(400, "Cần ít nhất 2 tài liệu chưa vào VCWIKI — tài liệu lẻ hãy dùng \"Dựng thẻ\"")
    external = body.external if body.external is not None else src["kind"] in ("video", "web")
    return synth_out(synth.create_run(src, user, external), user, full=False)


@router.get("/kb/sources/{source_id}/synth")
def list_synth(source_id: str, user: dict = Depends(current_user)):
    src, _ = load(sources, source_id, user, "source.read", "nguồn")
    return [synth_out(r, user, full=False)
            for r in synth.runs.find({"source_id": src["_id"]}, {"logs": 0}).sort("created_at", -1).limit(20)]


@router.get("/wiki/synth/{run_id}")
def get_synth(run_id: str, user: dict = Depends(current_user)):
    return synth_out(load_run(run_id, user), user)


@router.put("/wiki/synth/{run_id}/plan")
def save_synth_plan(run_id: str, body: SynthPlanIn, user: dict = Depends(current_user)):
    """Người duyệt sửa kế hoạch: cụm, tài liệu trong cụm, tài liệu chính, số thẻ. Tài liệu không thuộc cụm nào = bỏ qua."""
    run = load_run(run_id, user, "space.write")
    if run["status"] != "planned":
        raise HTTPException(409, "Chỉ sửa được kế hoạch khi lượt đang chờ duyệt")
    clusters = synth.validate_plan(run, [c.model_dump() for c in body.clusters])
    in_cluster = {i for c in clusters for i in c["doc_ids"]}
    docs = [d | {"keep": str(d["id"]) in in_cluster} for d in run["docs"]]
    synth.runs.update_one({"_id": run["_id"]}, {"$set": {"clusters": clusters, "docs": docs, "updated_at": db.now()}})
    return synth_out(synth.runs.find_one({"_id": run["_id"]}), user)


@router.post("/wiki/synth/{run_id}/start")
def run_synth(run_id: str, user: dict = Depends(current_user)):
    run = load_run(run_id, user, "space.write")
    if run["status"] != "planned":
        raise HTTPException(409, "Lượt không ở bước chờ duyệt kế hoạch")
    pending = sum(1 for c in run["clusters"] if c["status"] == "pending")
    synth.runs.update_one({"_id": run["_id"]}, {"$set": {
        "status": "synthesizing", "progress": {"total": len(run["clusters"]), "done": len(run["clusters"]) - pending},
        "approved_by": user["_id"], "updated_at": db.now()}})
    synth.log(run["_id"], f"{user['name']} duyệt kế hoạch: viết thẻ cho {pending} cụm")
    return synth_out(synth.runs.find_one({"_id": run["_id"]}), user)


@router.post("/wiki/synth/{run_id}/cancel")
def cancel_synth(run_id: str, user: dict = Depends(current_user)):
    run = load_run(run_id, user, "space.write")
    if run["status"] not in synth.ACTIVE:
        raise HTTPException(409, "Lượt đã kết thúc")
    synth.cancel_run(run)
    return synth_out(synth.runs.find_one({"_id": run["_id"]}), user)


@router.post("/wiki/synth/{run_id}/clusters/{key}/retry")
def retry_synth_cluster(run_id: str, key: str, user: dict = Depends(current_user)):
    run = load_run(run_id, user, "space.write")
    idx = next((i for i, c in enumerate(run["clusters"]) if c["key"] == key), None)
    if idx is None or run["clusters"][idx]["status"] != "error":
        raise HTTPException(409, "Chỉ chạy lại được cụm bị lỗi")
    ids = [ObjectId(i) for i in run["clusters"][idx]["doc_ids"]]
    documents.update_many({"_id": {"$in": ids}, "wiki_status": {"$in": list(synth.LOCKABLE)}},
                          {"$set": {"wiki_status": "grouping"}})
    synth.runs.update_one({"_id": run["_id"]}, {"$set": {
        f"clusters.{idx}.status": "pending", f"clusters.{idx}.error": None, "status": "synthesizing",
        "updated_at": db.now()}})
    synth.log(run["_id"], f"Chạy lại cụm \"{run['clusters'][idx]['title']}\"")
    return synth_out(synth.runs.find_one({"_id": run["_id"]}), user)
