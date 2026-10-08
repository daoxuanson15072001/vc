"""API VC Content Engine (Kho tư liệu · VCWIKI · Xưởng chiến dịch). Chạy: cd backend && ../.venv/bin/uvicorn app.main:app --port 8000"""

from __future__ import annotations

import io
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timezone
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING

from . import auth, categories, db, guide, inbox, mcp_server, policy, seo, spaces, studio
from .config import EXPORT_LIMIT, FRONTEND_DIST, KB_WORKERS_ON
from .kb import discover as kb_discover
from .kb import graph as kb_graph
from .kb import refine as kb_refine
from . import chat, devreq
from .kb import migrate as kb_migrate
from .kb import local_ai as kb_local_ai
from .kb import note_routes as kb_note_routes
from .kb import notes as kb_notes
from .kb import pipeline as kb_pipeline
from .kb import redo as kb_redo
from .kb import playlists as kb_playlists
from .kb import preview as kb_preview
from .kb import routes as kb_routes
from .kb import social as kb_social
from .kb import synth as kb_synth
from .kb import tags as kb_tags
from .studio.analysis import router as studio_analysis_router
from .studio import facebook as studio_facebook
from .studio.projects import router as studio_projects_router
from .studio import quick_routes as studio_quick_routes
from .studio import routes as studio_routes
from .studio.worker import worker as studio_worker
from .worker import core
# --- ORG ---
from . import org
# --- /ORG ---
# --- GOV ---
from .kb import bulk_review as kb_bulk_review
from .kb import changes as kb_changes
from .kb import revision_routes as kb_revision_routes
from .kb import revisions as kb_revisions
# --- /GOV ---
# --- LRN ---
from .learn import models as learn_models
from .learn import routes as learn_routes
# LRN · H (AI học tập: thiết kế lộ trình, sinh câu hỏi)
from .learn import designer as learn_designer
# LRN · I — lộ trình, giao bài, thi, chấm
from .learn import grading as learn_grading
from .learn import course_api as learn_course_api
from .learn import paths as learn_paths
from .learn import sample as learn_sample
from .learn import training, materials, practical
# --- /LRN ---


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.ensure_indexes()
    auth.ensure_indexes()
    spaces.ensure_indexes()
    categories.ensure_indexes()
    categories.seed_defaults()
    kb_pipeline.ensure_indexes()
    kb_redo.ensure_indexes()
    kb_synth.ensure_indexes()
    kb_notes.ensure_indexes()
    kb_social.ensure_indexes()
    kb_playlists.ensure_indexes()
    kb_graph.ensure_indexes()
    chat.ensure_indexes()
    devreq.ensure_indexes()
    studio.ensure_indexes()
    studio_facebook.ensure_indexes()
    # --- ORG ---
    org.ensure_indexes()
    # --- /ORG ---
    # --- GOV ---
    kb_revisions.ensure_indexes()
    kb_changes.ensure_indexes()
    kb_revisions.migrate_existing()   # một lần: thẻ cũ thành phiên bản 1 (cờ meta gov_revisions_v1)
    # --- /GOV ---
    # --- LRN ---
    learn_models.ensure_indexes()
    learn_sample.auto_seed()          # SEED_SAMPLE_COURSE=1: dựng khoá mẫu /learn nếu đủ điều kiện (luồng nền)
    # --- /LRN ---
    kb_migrate.run()          # một lần: gộp kho video TikTok → Text cũ vào Kho tư liệu
    # Worker nền (pipeline, tổng hợp, xưởng, cổng so sánh). KB_WORKERS=off: chạy API/FE lúc dev mà không nạp AI.
    if KB_WORKERS_ON:
        kb_changes.worker.start()     # cổng so sánh chạy nền cho đề xuất mới (luồng F)
        kb_pipeline.pipeline.start()
        kb_synth.worker.start()
        studio_worker.start()
    else:
        print("[worker] KB_WORKERS=off — bỏ qua pipeline / tổng hợp / xưởng / cổng so sánh (chế độ dev)")
    async with mcp_server.mcp.session_manager.run():
        yield
    if KB_WORKERS_ON:
        kb_pipeline.pipeline.stop()
        kb_synth.worker.stop()
        studio_worker.stop()
        kb_changes.worker.stop()
    # SYS-41: máy chủ dừng thì model Ollama không còn việc — nhả RAM/GPU ngay, không kill daemon dùng chung.
    kb_local_ai.unload_all()


app = FastAPI(title="VC Content Engine API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"], allow_credentials=True)


@app.middleware("http")
async def require_login(request: Request, call_next):
    """Mọi API (trừ đăng nhập / cài đặt lần đầu) đều cần phiên đăng nhập hợp lệ."""
    path = request.url.path
    if path.startswith("/api/") and not path.startswith(auth.PUBLIC_PATHS):
        user = await run_in_threadpool(auth.user_from_request, request)
        if not user:
            return JSONResponse({"detail": "Cần đăng nhập"}, status_code=401)
        request.state.user = user
    return await call_next(request)


app.include_router(auth.router)
app.include_router(guide.router)          # /guide.md, /guide/<id>.md, /api/guide — hướng dẫn cho AI đọc không cần JS
app.include_router(seo.router)            # /robots.txt + 301 link cũ (SEO-01, SEO-03) — không phụ thuộc dist/
app.include_router(spaces.router)
app.include_router(categories.router)
app.include_router(kb_routes.router)
app.include_router(kb_note_routes.router)     # ghi chép theo nguồn / từng tài liệu (WK-45)
app.include_router(kb_preview.router)
app.include_router(kb_playlists.router)
app.include_router(kb_graph.router)
app.include_router(kb_refine.router)
app.include_router(chat.router)
app.include_router(kb_discover.router)
app.include_router(studio_routes.router)
app.include_router(studio_quick_routes.router)
app.include_router(studio_projects_router)
app.include_router(studio_analysis_router)
app.include_router(studio_facebook.router)       # đăng Fanpage / nhóm / trang cá nhân (BA 5.14)
# --- ORG ---
app.include_router(org.router)
# --- /ORG ---
# --- GOV ---
app.include_router(kb_bulk_review.router)       # duyệt hàng loạt thẻ nháp (/wiki/review)
app.include_router(kb_changes.router)          # trước revision_routes: POST /cards/{id}/rollback đi qua đề xuất
app.include_router(kb_revision_routes.router)
# --- /GOV ---
# --- LRN ---
# LRN · H — đăng ký TRƯỚC learn_routes: thay các route 501 `POST /paths/design`, `POST /generate/questions`
app.include_router(learn_designer.router)
app.include_router(learn_routes.router)
# LRN · I — lộ trình, giao bài, thi, chấm
app.include_router(learn_paths.router)
app.include_router(learn_grading.router)
app.include_router(training.router)
app.include_router(materials.router)
app.include_router(practical.router)
app.include_router(learn_course_api.router)         # LRN-15, 17 khoá học theo cây chủ đề (TK-15b)
app.include_router(inbox.router)               # /api/me/inbox/counts — số việc của tôi (SCR-01, SYS-27)
# --- /LRN ---
# Cổng MCP cho AI: http://localhost:8000/mcp — xác thực bằng token API riêng, không dùng cookie đăng nhập
app.router.add_route("/mcp", mcp_server.mcp_endpoint, methods=["GET", "POST", "DELETE"], include_in_schema=False)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

Backend = Literal["auto", "mlx", "faster", "phowhisper"]


class RetranscribeIn(BaseModel):
    language: str = Field("auto", pattern=r"^(auto|[a-z]{2})$")
    backend: Backend = "auto"
    model: str | None = None


class VideoPatch(BaseModel):
    tags: list[str] | None = None
    note: str | None = None
    transcript: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SORT_FIELDS = {"posted_at", "views", "likes", "comments", "shares", "duration", "updated_at", "chars_per_sec"}
LIST_PROJECTION = {"segments": 0, "search_text": 0}


def video_filter(q: str | None, channel: str | None, status: str | None, tag: str | None,
                 date_from: date | None, date_to: date | None) -> dict:
    f: dict = {}
    if q and q.strip():
        f["search_text"] = db.search_regex(q)
    if channel:
        f["channel_handle"] = channel
    if status:
        f["status"] = {"$in": status.split(",")}
    if tag:
        f["tags"] = tag
    if date_from or date_to:
        f["posted_at"] = {}
        if date_from:
            f["posted_at"]["$gte"] = datetime.combine(date_from, time.min, timezone.utc)
        if date_to:
            f["posted_at"]["$lte"] = datetime.combine(date_to, time.max, timezone.utc)
    return f


def video_sort(sort: str, order: str) -> list:
    if sort not in SORT_FIELDS:
        raise HTTPException(400, f"Không sắp xếp được theo '{sort}'")
    return [(sort, DESCENDING if order == "desc" else ASCENDING), ("_id", DESCENDING)]


def get_video_or_404(video_id: str) -> dict:
    video = db.videos.find_one({"_id": video_id})
    if not video:
        raise HTTPException(404, "Không tìm thấy video")
    return video


# ---------------------------------------------------------------------------
# Hệ thống
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    db.client.admin.command("ping")
    return {"ok": True}


@app.get("/api/stats")
def stats(user: dict = Depends(auth.current_user)):
    agg = list(db.videos.aggregate([{"$group": {
        "_id": None,
        "videos": {"$sum": 1},
        "ok": {"$sum": {"$cond": [{"$eq": ["$status", "ok"]}, 1, 0]}},
        "no_speech": {"$sum": {"$cond": [{"$eq": ["$status", "no_speech"]}, 1, 0]}},
        "errors": {"$sum": {"$cond": [{"$eq": ["$status", "error"]}, 1, 0]}},
        "seconds": {"$sum": {"$cond": [{"$ne": ["$status", "error"]}, {"$ifNull": ["$duration", 0]}, 0]}},
        "channels": {"$addToSet": "$channel_handle"},
    }}]))
    s = agg[0] if agg else {"videos": 0, "ok": 0, "no_speech": 0, "errors": 0, "seconds": 0, "channels": []}
    top = db.videos.find({"status": "ok"}, LIST_PROJECTION | {"transcript": 0}).sort("views", -1).limit(5)
    scope = policy.visible_filter(user)
    recent = kb_routes.list_sources(None, None, None, None, None, 1, 5, user)
    return {
        "videos": s["videos"], "ok": s["ok"], "no_speech": s["no_speech"], "errors": s["errors"],
        "seconds": s["seconds"], "channels": len(s["channels"]),
        "sources": kb_pipeline.sources.count_documents(scope),
        "sources_active": kb_pipeline.sources.count_documents(scope | {"status": {"$in": ["queued", "extracting"]}}),
        "cards": kb_pipeline.cards.count_documents(scope),
        "cards_approved": kb_pipeline.cards.count_documents(scope | {"status": "approved"}),
        "top_videos": [db.serialize(v) for v in top],
        "recent_sources": recent["items"],
    }


# ---------------------------------------------------------------------------
# Kho video
# ---------------------------------------------------------------------------

@app.get("/api/videos")
def list_videos(
    q: str | None = None, channel: str | None = None, status: str | None = None, tag: str | None = None,
    date_from: date | None = None, date_to: date | None = None,
    sort: str = "posted_at", order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
):
    f = video_filter(q, channel, status, tag, date_from, date_to)
    cursor = (db.videos.find(f, LIST_PROJECTION).sort(video_sort(sort, order))
              .skip((page - 1) * page_size).limit(page_size))
    items = []
    for v in cursor:
        v = db.serialize(v)
        v["transcript_preview"] = (v.pop("transcript", "") or "")[:220]
        items.append(v)
    return {"items": items, "total": db.videos.count_documents(f), "page": page, "page_size": page_size}


@app.get("/api/videos/{video_id}")
def get_video(video_id: str):
    return db.serialize(get_video_or_404(video_id))


@app.patch("/api/videos/{video_id}")
def patch_video(video_id: str, body: VideoPatch):
    video = get_video_or_404(video_id)
    changes: dict = {}
    if body.tags is not None:
        changes["tags"] = kb_tags.set_video_tags(video, body.tags)   # lan sang tài liệu / thẻ VCWIKI
    if body.note is not None:
        changes["note"] = body.note.strip()
    if body.transcript is not None and body.transcript.strip() != (video.get("transcript") or ""):
        text = body.transcript.strip()
        changes |= {"transcript": text, "edited": True,
                    "chars_per_sec": db.chars_per_sec(text, video.get("duration"))}
        if video.get("status") in ("ok", "no_speech"):
            changes["status"] = "ok" if text else "no_speech"
    if changes:
        changes["updated_at"] = db.now()
        changes["search_text"] = db.build_search_text(video | changes)
        db.videos.update_one({"_id": video_id}, {"$set": changes})
    return db.serialize(get_video_or_404(video_id))


@app.delete("/api/videos/{video_id}", status_code=204)
def delete_video(video_id: str):
    if not db.videos.delete_one({"_id": video_id}).deleted_count:
        raise HTTPException(404, "Không tìm thấy video")
    return Response(status_code=204)


@app.post("/api/videos/{video_id}/retranscribe", status_code=201)
def retranscribe(video_id: str, body: RetranscribeIn | None = None, user: dict = Depends(auth.current_user)):
    """Chuyển chữ lại: xếp một nguồn video vào Kho tư liệu (thay cho lượt quét cũ)."""
    video = get_video_or_404(video_id)
    opts = (body or RetranscribeIn()).model_dump() | {"force": True, "limit": 1}
    src = kb_routes.queue_video_link(video["url"], user, opts)
    return {"source_id": str(src["_id"])}


@app.get("/api/videos/{video_id}/srt")
def video_srt(video_id: str):
    video = get_video_or_404(video_id)
    lines = []
    for i, s in enumerate(video.get("segments") or [], 1):
        lines += [str(i), f"{core.fmt_srt_time(s['start'])} --> {core.fmt_srt_time(s['end'])}", s["text"], ""]
    return Response("\n".join(lines), media_type="application/x-subrip; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{video_id}.srt"'})


@app.get("/api/tags")
def tags():
    # distinct() qua multikey index trả thêm None cho video có tags = [] -> bỏ đi, không thì sorted() lỗi
    return sorted(t for t in db.videos.distinct("tags") if isinstance(t, str))


@app.get("/api/channels")
def channels():
    rows = db.videos.aggregate([
        {"$sort": {"posted_at": -1}},
        {"$group": {
            "_id": "$channel_handle",
            "name": {"$first": "$channel_name"},
            "platform": {"$first": "$platform"},
            "channel_url": {"$first": "$channel_url"},
            "sample_url": {"$first": "$url"},
            "videos": {"$sum": 1},
            "ok": {"$sum": {"$cond": [{"$eq": ["$status", "ok"]}, 1, 0]}},
            "errors": {"$sum": {"$cond": [{"$eq": ["$status", "error"]}, 1, 0]}},
            "views": {"$sum": {"$ifNull": ["$views", 0]}},
            "likes": {"$sum": {"$ifNull": ["$likes", 0]}},
            "avg_views": {"$avg": "$views"},
            "last_posted_at": {"$max": "$posted_at"},
            "last_transcribed_at": {"$max": "$transcribed_at"},
        }},
        {"$sort": {"views": -1}},
    ])
    out = []
    for r in rows:
        handle, sample_url = r.pop("_id"), r.pop("sample_url") or ""
        # video cũ (trước khi lưu platform/channel_url) -> suy ra từ link video
        platform = r.get("platform") or db.detect_platform(sample_url)
        out.append({"handle": handle} | r | {
            "platform": platform,
            "channel_url": r.get("channel_url") or db.channel_url_for(platform, handle),
            "avg_views": round(r["avg_views"] or 0),
        })
    return out


# ---------------------------------------------------------------------------
# Xuất Excel — cùng cột / định dạng với CLI
# ---------------------------------------------------------------------------

STATUS_LABEL = {"ok": "OK", "no_speech": "OK (không có lời nói)"}


@app.get("/api/export.xlsx")
def export_excel(
    q: str | None = None, channel: str | None = None, status: str | None = None, tag: str | None = None,
    date_from: date | None = None, date_to: date | None = None,
    sort: str = "posted_at", order: Literal["asc", "desc"] = "desc",
):
    f = video_filter(q, channel, status, tag, date_from, date_to)
    rows = []
    for v in db.videos.find(f, {"segments": 0}).sort(video_sort(sort, order)).limit(EXPORT_LIMIT):
        rows.append({
            "Kênh": v.get("channel_handle"),
            "Video ID": v["_id"],
            "Link": v.get("url"),
            "Ngày đăng": v["posted_at"].astimezone().strftime("%d/%m/%Y") if v.get("posted_at") else "",
            "Thời lượng (giây)": v.get("duration"),
            "Lượt xem": v.get("views"),
            "Lượt thích": v.get("likes"),
            "Bình luận": v.get("comments"),
            "Chia sẻ": v.get("shares"),
            "Caption": v.get("caption") or "",
            "Nội dung lời nói": v.get("transcript") or "",
            "Trạng thái": STATUS_LABEL.get(v.get("status"), f"LỖI: {v.get('error') or ''}"),
        })
    buf = io.BytesIO()
    core.write_excel(rows, buf)
    buf.seek(0)
    name = f"tiktok_{channel or 'tat-ca'}_{datetime.now():%Y%m%d_%H%M}.xlsx"
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# ---------------------------------------------------------------------------
# Phục vụ bản build FE (npm run build) tại http://localhost:8000
# ---------------------------------------------------------------------------

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
    def api_not_found(path: str):   # API không tồn tại: 404 rõ ràng thay vì 405 của route trang bên dưới
        raise HTTPException(404, "Không có API này")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Không có API này")
        # SEO-02: file tĩnh trong dist → file; khớp dist/routes.json → index.html; lạ → 404 HTML thật
        return seo.spa_response(path)
