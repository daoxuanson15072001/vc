"""Lấy lại chữ từng video trong một nguồn video / kênh (POST /kb/sources/{id}/retranscribe).

Mỗi video được chọn là một việc trong `kb_redo`. Làn "redo" của pipeline làm lần lượt từng video một, xen kẽ giữa
các nguồn (nguồn lâu chưa được phục vụ nhất đi trước) — kênh chờ 295 video không chặn một video lẻ của kênh khác.
Trạng thái / tiến độ của nguồn giữ nguyên; tài liệu được ghi đè tại chỗ.

Hai loại việc:
- thủ công (người dùng chọn video, bấm "Lấy lại chữ"): ưu tiên — kênh đang chuyển chữ nhường sau video hiện tại
  (pipeline.should_yield), nguồn đang chờ chưa được bắt đầu.
- tự động (`auto`, bấm "Chạy tiếp tất cả" ở danh sách nguồn — video lỗi dưới MAX_AUTO_RETRY lần, không phải lỗi
  vĩnh viễn — kb/video_errors.py): chỉ chạy khi không
  còn nguồn nào chờ chuyển chữ (nguồn mới đi trước).
"""

from __future__ import annotations

import traceback
from datetime import timedelta

from pymongo import ASCENDING

from .. import db
from . import ai_slot, video_errors
from .adapters import Context
from .adapters.video import VideoAdapter, video_document
from .pipeline import documents, log, raw_dir, save_document, sources, wants_wiki

jobs = db.db["kb_redo"]
ACTIVE = ("queued", "running")
KEEP_FINISHED = timedelta(days=1)   # việc xong / lỗi giữ lại một ngày để đếm tiến độ "7/12"


def ensure_indexes() -> None:
    jobs.create_index([("source_id", ASCENDING), ("status", ASCENDING), ("created_at", ASCENDING)])
    jobs.create_index([("status", ASCENDING), ("created_at", ASCENDING)])
    # tiến trình trước tắt giữa chừng: việc đang chạy trả lại hàng chờ
    jobs.update_many({"status": "running"}, {"$set": {"status": "queued"}})


def queue(src: dict, items: list[dict], language: str | None, user: dict, auto: bool = False) -> int:
    """items: [{key, url, title}]. Video đang chờ / đang chạy thì bỏ qua (không nhân đôi). Trả số việc mới.
    auto: việc tự động xếp sau nguồn mới; việc thủ công ưu tiên."""
    busy = set(jobs.distinct("key", {"source_id": src["_id"], "status": {"$in": list(ACTIVE)}}))
    now = db.now()
    jobs.delete_many({"source_id": src["_id"], "status": {"$nin": list(ACTIVE)}, "finished_at": {"$lt": now - KEEP_FINISHED}})
    new = [{"source_id": src["_id"], "key": it["key"], "url": it["url"], "title": it.get("title") or it["key"],
            "language": language, "status": "queued", "requested_by": user["_id"], "created_at": now,
            **({"auto": True} if auto else {})}
           for it in {it["key"]: it for it in items}.values() if it["key"] not in busy]
    if new:
        jobs.insert_many(new)
        log(src["_id"], f"Lấy lại chữ: xếp {len(new)} video vào hàng chờ"
                        + (" (tự động — sau các nguồn mới)" if auto else "")
                        + (f" (ngôn ngữ: {language})" if language else ""))
    return len(new)


def cancel(src: dict) -> int:
    """Bỏ các video còn chờ; video đang chạy làm nốt (Whisper không ngắt giữa chừng được)."""
    n = jobs.delete_many({"source_id": src["_id"], "status": "queued"}).deleted_count
    if n:
        log(src["_id"], f"Dừng lấy lại chữ: bỏ {n} video còn chờ")
    return n


def stats(source_id) -> dict | None:
    """Tiến độ lượt lấy lại chữ đang chạy của nguồn: {total, done, failed, queued, running, keys: {key: status}}."""
    active = list(jobs.find({"source_id": source_id, "status": {"$in": list(ACTIVE)}}, {"key": 1, "status": 1, "created_at": 1}))
    if not active:
        return None
    since = min(j["created_at"] for j in active)
    done = jobs.count_documents({"source_id": source_id, "status": "done", "created_at": {"$gte": since}})
    failed = jobs.count_documents({"source_id": source_id, "status": "error", "created_at": {"$gte": since}})
    running = sum(j["status"] == "running" for j in active)
    return {"total": len(active) + done + failed, "done": done, "failed": failed,
            "queued": len(active) - running, "running": running, "keys": {j["key"]: j["status"] for j in active}}


MANUAL = {"auto": {"$ne": True}}


def _sources_waiting() -> bool:
    return bool(sources.count_documents({"status": "queued"}, limit=1))


def manual_waiting(exclude=None) -> bool:
    """Có video lấy lại chữ thủ công đang chờ mà làm được ngay (nguồn không đang quét kênh) — kênh đang chạy nhường."""
    ids = [i for i in jobs.distinct("source_id", {"status": "queued"} | MANUAL) if i != exclude]
    return bool(ids) and bool(sources.count_documents({"_id": {"$in": ids}, "status": {"$ne": "extracting"}}, limit=1))


def has_work() -> bool:
    """Việc thủ công luôn được làm; việc tự động chỉ khi không còn nguồn nào chờ chuyển chữ."""
    if jobs.count_documents({"status": "queued"} | MANUAL, limit=1):
        return True
    return bool(jobs.count_documents({"status": "queued", "auto": True}, limit=1)) and not _sources_waiting()


def _next_job() -> dict | None:
    """Việc thủ công trước, việc tự động chỉ khi không còn nguồn chờ chuyển chữ. Cùng loại: nguồn lâu chưa được phục
    vụ nhất trước, trong nguồn thì video yêu cầu trước làm trước. Bỏ qua nguồn đang quét cả kênh (tránh hai luồng
    cùng ghi một tài liệu)."""
    for which in (MANUAL, {"auto": True}):
        if which is not MANUAL and _sources_waiting():
            return None
        job = _next_of({"status": "queued"} | which)
        if job:
            return job
    return None


def _next_of(f: dict) -> dict | None:
    ids = jobs.distinct("source_id", f)
    if not ids:
        return None
    candidates = list(sources.find({"_id": {"$in": ids}, "status": {"$ne": "extracting"}}, {"redo_served_at": 1}))
    gone = set(ids) - {s["_id"] for s in sources.find({"_id": {"$in": ids}}, {"_id": 1})}
    if gone:   # nguồn đã xoá
        jobs.delete_many({"source_id": {"$in": list(gone)}})
    for s in sorted(candidates, key=lambda s: (s.get("redo_served_at") is not None, s.get("redo_served_at"))):
        job = jobs.find_one_and_update(f | {"source_id": s["_id"]},
                                       {"$set": {"status": "running", "started_at": db.now()}},
                                       sort=[("created_at", 1)], return_document=True)
        if job:
            sources.update_one({"_id": s["_id"]}, {"$set": {"redo_served_at": db.now()}})
            return job
    return None


def run_next() -> bool:
    job = _next_job()
    if not job:
        return False
    src = sources.find_one({"_id": job["source_id"]})
    if not src:
        jobs.delete_one({"_id": job["_id"]})
        return True
    options = (src.get("options") or {}) | ({"language": job["language"]} if job.get("language") else {})
    rdir = raw_dir(src["_id"])
    rdir.mkdir(parents=True, exist_ok=True)
    ctx = Context(raw_dir=rdir, options=options, log=lambda m: log(src["_id"], m), lane="redo", cancelled=lambda: False,
                  defer_translation=ai_slot.ENABLED)
    log(src["_id"], f"Lấy lại chữ: {job['url']}")
    try:
        v = VideoAdapter()._one(job["url"], src, ctx)
        save_document(src, video_document(v), wants_wiki(src))
        jobs.update_one({"_id": job["_id"]}, {"$set": {"status": "done", "finished_at": db.now()}})
    except Exception as e:  # noqa: BLE001 — một video lỗi không chặn hàng chờ
        traceback.print_exc()
        msg = str(e)[:300]
        log(src["_id"], f"  ✗ lấy lại chữ lỗi: {msg}")
        jobs.update_one({"_id": job["_id"]}, {"$set": {"status": "error", "error": msg, "finished_at": db.now()}})
        video_errors.record(job["key"], job["url"], msg, src["_id"], "auto" if job.get("auto") else "redo")
        if why := video_errors.exhausted(job["key"]):
            log(src["_id"], f"  video {job['key']}: {why} — máy dừng tự lấy lại")
    return True


FAILED_FIELDS = {"url": 1, "error": 1, "caption": 1, "source_id": 1, "fail_count": 1, "error_kind": 1,
                 "last_failed_at": 1, "fail_log": 1}


def failed_out(v: dict) -> dict:
    kind = video_errors.kind_of_video(v)
    return {"key": v["_id"], "url": v.get("url"), "error": video_errors.clean(v.get("error")),
            "title": (v.get("caption") or "").strip()[:200] or v["_id"],
            "fail_count": v.get("fail_count") or 0, "error_kind": kind, "error_label": video_errors.LABELS[kind],
            "last_failed_at": v.get("last_failed_at"), "stop_reason": video_errors.stop_reason(v),
            "permanent": kind in video_errors.PERMANENT,
            "fail_log": [{**e, "label": video_errors.LABELS.get(e.get("kind"), "")} for e in reversed(v.get("fail_log") or [])]}


def failed_videos(src: dict) -> list[dict]:
    """Video của nguồn tải / chuyển chữ lỗi và chưa có tài liệu — hiện trong chi tiết nguồn để chọn lấy lại chữ."""
    have = set(documents.distinct("key", {"source_id": src["_id"]}))
    return [failed_out(v) for v in db.videos.find({"source_id": src["_id"], "status": "error"}, FAILED_FIELDS)
            if v["_id"] not in have and v.get("url")]


def failed_of(source_ids: list) -> list[dict]:
    """Video lỗi chưa có tài liệu của nhiều nguồn (kèm source_id) — Chạy tiếp tất cả / danh sách video lỗi."""
    have = {(d["source_id"], d["key"]) for d in documents.find({"source_id": {"$in": source_ids}}, {"source_id": 1, "key": 1})}
    return [failed_out(v) | {"source_id": v["source_id"]}
            for v in db.videos.find({"source_id": {"$in": source_ids}, "status": "error"}, FAILED_FIELDS)
            if (v["source_id"], v["_id"]) not in have and v.get("url")]
