"""Tiến độ tinh chế: tài liệu thô (Kho tư liệu) → thẻ VCWIKI do AI dựng (tầng 2 của pipeline).

- /kb/refine/summary: đếm tài liệu theo wiki_status, số xong mỗi ngày, token AI đã dùng, dự kiến xong hàng chờ.
- /kb/refine/documents: danh sách tài liệu theo trạng thái (hàng chờ ưu tiên cao trước, như worker lấy việc).
- /kb/refine/live + /kb/refine/stream (SSE): ảnh chụp chi tiết việc AI đang làm — tài liệu đang đọc, lượt tổng hợp,
  nguồn đang chuyển chữ, số xong theo phút, nhật ký gần đây. Stream chỉ gửi khi ảnh chụp đổi.
- /kb/refine/bulk: thao tác hàng loạt — đưa vào hàng chờ AI, bỏ qua, ưu tiên. Chỉ áp dụng ở kho mình có quyền sửa;
  tài liệu `processing` / `grouping` đang bị AI giữ nên không đụng tới.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
from datetime import timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel

from .. import db, policy
from ..auth import current_user
from . import synth, wiki
from .pipeline import cards, documents, sources
from .adapters import ADAPTERS
from .routes import oid, out, space_names, space_scope, synth_out

router = APIRouter(prefix="/api")

STATUSES = ("pending", "processing", "grouping", "done", "error", "skipped", "paused")   # paused: người dùng ngừng tinh chế
TZ = "Asia/Ho_Chi_Minh"
DAYS = 14
RATE_SAMPLE = 30          # ước tốc độ AI từ N tài liệu xong gần nhất
RATE_IDLE = timedelta(minutes=30)


def editable_space_ids(user: dict) -> list:
    return policy.editable_space_ids(user)


def doc_filter(space_id: str | None, user: dict, status: str = "", q: str = "") -> dict:
    f = space_scope(space_id, user, kind="document")
    wanted = [s for s in status.split(",") if s in STATUSES]
    if wanted:
        f["wiki_status"] = {"$in": wanted}
    if q.strip():
        f["title"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    return f


@router.get("/kb/refine/summary")
def refine_summary(space_id: str | None = None, user: dict = Depends(current_user)):
    scope = space_scope(space_id, user)
    counts = {s["_id"]: s["n"] for s in documents.aggregate([
        {"$match": scope}, {"$group": {"_id": "$wiki_status", "n": {"$sum": 1}}}])}
    counts = {s: counts.get(s, 0) for s in STATUSES}

    since = db.now() - timedelta(days=DAYS)
    per_day = {r["_id"]: r for r in documents.aggregate([
        {"$match": scope | {"wiki_status": "done", "wiki_at": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$wiki_at", "timezone": TZ}},
                    "docs": {"$sum": 1}, "cards": {"$sum": {"$ifNull": ["$card_count", 0]}},
                    "input_tokens": {"$sum": {"$ifNull": ["$ai_usage.input_tokens", 0]}},
                    "output_tokens": {"$sum": {"$ifNull": ["$ai_usage.output_tokens", 0]}}}}])}

    # tốc độ hiện tại: chỉ tính khi AI vừa làm xong gần đây, tránh ước theo một đợt chạy từ hôm qua
    recent = [d["wiki_at"] for d in documents.find(scope | {"wiki_status": "done", "wiki_at": {"$ne": None}},
                                                   {"wiki_at": 1}).sort("wiki_at", -1).limit(RATE_SAMPLE)]
    per_hour = None
    if len(recent) >= 3 and db.now() - _aware(recent[0]) < RATE_IDLE:
        span = (_aware(recent[0]) - _aware(recent[-1])).total_seconds()
        per_hour = round((len(recent) - 1) / span * 3600, 1) if span > 0 else None
    queue = counts["pending"] + counts["processing"]

    # lượt tổng hợp theo cụm: đang chạy + vài lượt vừa xong
    active = list(synth.runs.find(scope | {"status": {"$in": list(synth.ACTIVE)}}, {"logs": 0}).sort("created_at", -1))
    done = list(synth.runs.find(scope | {"status": {"$nin": list(synth.ACTIVE)}}, {"logs": 0})
                .sort("created_at", -1).limit(5))
    processing = list(documents.find(scope | {"wiki_status": "processing"}, {"title": 1, "source_id": 1, "chars": 1}))
    return {
        "ai": wiki.ai_status(),
        "counts": counts,
        "total": sum(counts.values()),
        "per_day": [{"day": r["_id"], **{k: v for k, v in r.items() if k != "_id"}}
                    for r in sorted(per_day.values(), key=lambda r: r["_id"])],
        "rate_per_hour": per_hour,
        "eta_seconds": round(queue / per_hour * 3600) if per_hour and queue else None,
        "processing": [out(d) for d in processing],
        "synth_runs": [synth_out(r, user, full=False) for r in active + done],
        "draft_cards": cards.count_documents(scope | {"status": "draft", "origin": "ai"}),
        "can_edit": bool(editable_space_ids(user)),
    }


def _aware(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get("/kb/refine/documents")
def refine_documents(status: str = "", q: str = "", space_id: str | None = None,
                     page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
                     user: dict = Depends(current_user)):
    f = doc_filter(space_id, user, status, q)
    # hàng chờ: đúng thứ tự worker lấy việc; còn lại: mới xử lý / mới nạp trước
    queue_view = bool(status) and set(status.split(",")) <= {"pending", "processing"}
    sort = [("priority", -1), ("created_at", 1)] if queue_view else [("wiki_at", -1), ("created_at", -1)]
    keep = {"title": 1, "url": 1, "source_id": 1, "space_id": 1, "chars": 1, "wiki_status": 1, "wiki_error": 1,
            "wiki_at": 1, "card_count": 1, "relevance": 1, "priority": 1, "created_at": 1, "ai_usage": 1,
            "refined_by": 1}
    rows = list(documents.find(f, keep).sort(sort).skip((page - 1) * page_size).limit(page_size))
    srcs = {s["_id"]: s for s in sources.find({"_id": {"$in": list({r["source_id"] for r in rows})}},
                                              {"title": 1, "kind": 1, "url": 1, "file.name": 1})}
    snames = space_names(r["space_id"] for r in rows)
    editable = set(editable_space_ids(user))
    items = []
    for r in rows:
        s = srcs.get(r["source_id"]) or {}
        by = r.get("refined_by") or ({"kind": "api", "label": "Claude API (máy chủ)",
                                      "model": r["ai_usage"].get("model")} if r.get("ai_usage") else None)
        items.append(out(r, {"refined_by": by and {k: by.get(k) for k in ("kind", "label", "model")}, "source": {"id": str(r["source_id"]), "kind": s.get("kind"),
                                        "title": s.get("title") or (s.get("file") or {}).get("name") or s.get("url")},
                             "space_name": snames.get(r["space_id"]), "can_edit": r["space_id"] in editable}))
    return {"total": documents.count_documents(f), "items": items}


class BulkIn(BaseModel):
    action: Literal["queue", "skip", "top", "untop", "pause", "resume"]
    ids: list[str] | None = None      # bỏ trống = mọi tài liệu khớp bộ lọc (status / space_id / q)
    status: str = ""
    space_id: str | None = None
    q: str = ""
    dry_run: bool = False             # chỉ đếm — hộp xác nhận hiện số trước khi làm


# trạng thái được phép chuyển theo từng thao tác. pause / resume: ngừng / chạy tiếp tinh chế — tài liệu "Đã dừng"
# không nằm ở hàng Chờ AI nên cả máy chủ lẫn AI bên ngoài (Claude qua MCP claim_documents) đều không nhận
FROM = {"queue": ["error", "skipped", "done", "paused"], "skip": ["pending", "error", "paused"],
        "top": ["pending", "error", "skipped", "paused"], "untop": ["pending", "error", "skipped", "paused"],
        "pause": ["pending"], "resume": ["paused"]}


@router.post("/kb/refine/bulk")
def refine_bulk(body: BulkIn, user: dict = Depends(current_user)):
    if body.ids is not None:
        if not body.ids:
            raise HTTPException(400, "Chưa chọn tài liệu nào")
        f = space_scope(body.space_id, user, kind="document") | {"_id": {"$in": [oid(i, "tài liệu") for i in body.ids]}}
    else:
        f = doc_filter(body.space_id, user, body.status, body.q)
    allowed = FROM[body.action]
    st = f.get("wiki_status", {}).get("$in")
    f["wiki_status"] = {"$in": [s for s in st if s in allowed] if st else allowed}
    f = {"$and": [f, {"space_id": {"$in": editable_space_ids(user)}}]}
    if body.dry_run:
        # pause: tài liệu AI (máy chủ / Claude bên ngoài) đang đọc dở không ngắt được — làm nốt rồi mới dừng
        busy = documents.count_documents({"$and": [f["$and"][0] | {"wiki_status": "processing"}, f["$and"][1]]}) \
            if body.action == "pause" and body.ids is None else 0
        return {"count": documents.count_documents(f), "processing": busy}

    if body.action in ("queue", "resume"):
        # dựng lại tài liệu đã xong: worker thay thẻ nháp AI cũ, thẻ đã duyệt giữ nguyên
        upd = {"$set": {"wiki_status": "pending", "wiki_error": None, "wiki_retry_at": None}}
    elif body.action == "skip":
        upd = {"$set": {"wiki_status": "skipped"}}
    elif body.action == "pause":
        upd = {"$set": {"wiki_status": "paused", "paused_at": db.now()}}
    elif body.action == "top":
        head = documents.find_one({"wiki_status": "pending"}, {"priority": 1}, sort=[("priority", -1)])
        upd = {"$set": {"priority": max((head or {}).get("priority") or 0, 0) + 1}}
    else:
        upd = {"$set": {"priority": 0}}
    return {"changed": documents.update_many(f, upd).modified_count}


# ---------------------------------------------------------------------------
# Theo dõi trực tiếp
# ---------------------------------------------------------------------------

LIVE_MINUTES = 60
FEED_SINCE = timedelta(hours=6)
FEED_LIMIT = 60


def _feed(coll, scope: dict, since, kind: str, title_of) -> list[dict]:
    """Dòng nhật ký gần đây của các nguồn / lượt tổng hợp (mảng `logs` trong từng bản ghi)."""
    rows = coll.aggregate([
        {"$match": scope | {"logs.at": {"$gte": since}}},
        {"$project": {"title": 1, "source_title": 1, "url": 1, "file.name": 1, "logs": {"$slice": ["$logs", -40]}}},
        {"$unwind": "$logs"}, {"$match": {"logs.at": {"$gte": since}}},
        {"$sort": {"logs.at": -1}}, {"$limit": FEED_LIMIT}])
    return [{"at": r["logs"]["at"], "msg": r["logs"]["msg"], "kind": kind, "ref": str(r["_id"]), "title": title_of(r)}
            for r in rows]


def live_snapshot(space_id: str | None, user: dict) -> dict:
    scope = space_scope(space_id, user)
    now = db.now()
    counts = {s["_id"]: s["n"] for s in documents.aggregate([
        {"$match": scope}, {"$group": {"_id": "$wiki_status", "n": {"$sum": 1}}}])}

    since = now - timedelta(minutes=LIVE_MINUTES)
    per_minute = [{"minute": r["_id"], "docs": r["docs"], "cards": r["cards"]} for r in documents.aggregate([
        {"$match": scope | {"wiki_status": "done", "wiki_at": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%dT%H:%M", "date": "$wiki_at", "timezone": TZ}},
                    "docs": {"$sum": 1}, "cards": {"$sum": {"$ifNull": ["$card_count", 0]}}}},
        {"$sort": {"_id": 1}}])]

    src_titles = {}

    def src_title(sid):
        if sid not in src_titles:
            s = sources.find_one({"_id": sid}, {"title": 1, "url": 1, "file.name": 1}) or {}
            src_titles[sid] = s.get("title") or (s.get("file") or {}).get("name") or s.get("url")
        return src_titles[sid]

    processing = [out(d, {"source_title": src_title(d["source_id"])}) for d in documents.find(
        scope | {"wiki_status": "processing"}, {"title": 1, "source_id": 1, "chars": 1, "wiki_started_at": 1})]

    runs = []
    for r in synth.runs.find(scope | {"status": {"$in": list(synth.ACTIVE)}},
                             {"logs": {"$slice": -6}}).sort("created_at", -1):
        runs.append(synth_out(r, user, full=False) | {
            "logs": r.get("logs", []),
            "clusters": [{"title": c.get("title"), "status": c.get("status")} for c in r.get("clusters", [])][:60]})

    extracting = [out(s, {"kind_label": ADAPTERS[s["kind"]].label if s.get("kind") in ADAPTERS else s.get("kind")})
                  for s in sources.find(scope | {"status": {"$in": ["extracting", "queued"]}},
                                        {"title": 1, "url": 1, "file.name": 1, "kind": 1, "lane": 1, "status": 1,
                                         "progress": 1, "started_at": 1, "priority": 1, "created_at": 1})
                  .sort([("status", 1), ("priority", -1), ("created_at", 1)]).limit(20)]

    recent = []
    for d in documents.find(scope | {"wiki_status": "done", "wiki_at": {"$ne": None}},
                            {"title": 1, "source_id": 1, "card_count": 1, "relevance": 1, "ai_usage": 1,
                             "wiki_at": 1, "wiki_started_at": 1, "chars": 1}).sort("wiki_at", -1).limit(20):
        took = None
        if d.get("wiki_started_at") and _aware(d["wiki_started_at"]) <= _aware(d["wiki_at"]):
            took = round((_aware(d["wiki_at"]) - _aware(d["wiki_started_at"])).total_seconds())
        recent.append(out(d, {"source_title": src_title(d["source_id"]), "took_seconds": took}))

    feed_since = now - FEED_SINCE
    feed = sorted(
        _feed(sources, scope, feed_since, "source",
              lambda r: r.get("title") or (r.get("file") or {}).get("name") or r.get("url"))
        + _feed(synth.runs, scope, feed_since, "synth", lambda r: r.get("source_title")),
        key=lambda x: x["at"], reverse=True)[:FEED_LIMIT]

    return {
        "at": now,
        "ai": wiki.ai_status(),
        "counts": {k: counts.get(k, 0) for k in STATUSES},
        "done_last_hour": sum(m["docs"] for m in per_minute),
        "per_minute": per_minute,
        "processing": processing,
        "synth_runs": runs,
        "extracting": extracting,
        "recent": recent,
        "feed": feed,
    }


def _json(o) -> str:
    return json.dumps(o, default=lambda v: _aware(v).isoformat() if hasattr(v, "isoformat") else str(v),
                      ensure_ascii=False)


@router.get("/kb/refine/live")
def refine_live(space_id: str | None = None, user: dict = Depends(current_user)):
    return json.loads(_json(live_snapshot(space_id, user)))


@router.get("/kb/refine/stream")
async def refine_stream(request: Request, space_id: str | None = None, user: dict = Depends(current_user)):
    """Server-Sent Events: gửi ảnh chụp mỗi khi đổi (hỏi DB 2 giây/lần), giữ kết nối bằng ping 15 giây/lần."""
    space_scope(space_id, user)   # kiểm tra quyền ngay, lỗi thì trả 404 thay vì mở stream

    async def events():
        last, idle = None, 0
        while not await request.is_disconnected():
            snap = await run_in_threadpool(live_snapshot, space_id, user)
            body = _json({k: v for k, v in snap.items() if k != "at"})
            digest = hashlib.md5(body.encode()).hexdigest()
            if digest != last:
                last, idle = digest, 0
                yield f"data: {_json(snap)}\n\n"
            else:
                idle += 1
                if idle % 8 == 0:
                    yield ": ping\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
