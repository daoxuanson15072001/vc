"""Dự kiến thời gian hoàn thành tầng 1 (chuyển thành chữ) cho từng nguồn và từng làn.

Mỗi làn chạy tuần tự một nguồn một lúc, nên thời điểm xong của nguồn chờ = phần còn lại của việc đang chạy
+ ước lượng của mọi nguồn xếp trước (đúng thứ tự lấy việc của pipeline: ưu tiên cao trước, rồi nạp trước).

Ước lượng một nguồn = thời gian cố định + tốc độ × khối lượng, khối lượng tuỳ loại:
  - ghi âm / video tải lên: số giây media (ffprobe, lưu vào `media_duration` để khỏi đo lại)
  - video / kênh mạng xã hội: số video (progress.total khi đã biết, link kênh chưa chạy thì lấy giới hạn quét)
  - còn lại: số MB file (link web tính 1)
Có lịch sử: giây mỗi đơn vị = trung vị (thời gian chạy / khối lượng) của các nguồn cùng loại đã xong gần đây
(đã gồm phần cố định). Chưa có lịch sử: thời gian cố định + tốc độ mặc định.
Việc đang chạy nhiều mục (kênh video, PDF nhiều trang…) dùng tốc độ thực tế của chính nó.
"""

from __future__ import annotations

import re
import statistics
import threading
import time
from datetime import datetime, timezone

from . import media
from .pipeline import LANES, documents, raw_dir, sources

MEDIA_KINDS = ("audio", "video_file")
# (giây cố định, giây mỗi đơn vị khối lượng) khi chưa có lịch sử
DEFAULTS = {
    "audio": (8.0, 0.1), "video_file": (10.0, 0.1),   # Whisper trên máy ~10× thời gian thực
    "video": (5.0, 30.0),                              # mỗi video: tải + Whisper
    "pdf": (5.0, 3.0), "image": (8.0, 2.0), "office": (5.0, 2.0),
}
DEFAULT_OTHER = (15.0, 2.0)
SINGLE_VIDEO_RE = re.compile(r"/video/|/photo/|watch\?v=|youtu\.be/|/shorts/[\w-]{6,}|/reels?/|/p/|/status/|fb\.watch", re.I)
MIN_SEC = 3.0
HISTORY = 300
HISTORY_TTL = 60
SCHEDULE_TTL = 3

_lock = threading.Lock()
_rates: tuple[float, dict] = (0.0, {})
_schedule: tuple[float, dict] = (0.0, {})


def _utc(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _file_mb(src: dict) -> float:
    files = src.get("files") or ([src["file"]] if src.get("file") else [])
    return sum(f.get("size") or 0 for f in files) / 1e6


def _media_seconds(src: dict) -> float | None:
    if src.get("media_duration"):
        return src["media_duration"]
    doc = documents.find_one({"source_id": src["_id"], "meta.duration": {"$gt": 0}}, {"meta.duration": 1})
    if doc:
        return doc["meta"]["duration"]
    if not src.get("file"):
        return None
    try:
        dur = media.probe_duration(raw_dir(src["_id"]) / src["file"]["stored_name"])
    except Exception:  # noqa: BLE001 — thiếu ffprobe / file hỏng: rơi về ước lượng theo MB
        dur = None
    if dur:
        sources.update_one({"_id": src["_id"]}, {"$set": {"media_duration": dur}})
    return dur


def _units(src: dict, for_history: bool = False) -> float:
    kind = src["kind"]
    if kind in MEDIA_KINDS:
        sec = _media_seconds(src)
        return sec if sec else _file_mb(src) * 60   # không đo được: coi 1 MB ≈ 1 phút
    if kind == "video":
        total = (src.get("progress") or {}).get("total") or 0
        if for_history:
            return (src.get("progress") or {}).get("processed") or total
        if total:
            return total
        if SINGLE_VIDEO_RE.search(src.get("url") or ""):
            return 1
        return (src.get("options") or {}).get("limit") or 20
    return max(_file_mb(src), 1.0)


def _rates_by_kind() -> dict:
    """{kind: (giây cố định, giây mỗi đơn vị, 'history'|'default')} học từ các nguồn đã xong."""
    global _rates
    at, cached = _rates
    if time.monotonic() - at < HISTORY_TTL:
        return cached
    samples: dict[str, list[float]] = {}
    for s in sources.find({"status": "extracted", "started_at": {"$exists": True}, "finished_at": {"$exists": True}},
                          sort=[("finished_at", -1)], limit=HISTORY):
        took = (_utc(s["finished_at"]) - _utc(s["started_at"])).total_seconds()
        units = _units(s, for_history=True)
        if took <= 0 or not units:
            continue
        samples.setdefault(s["kind"], []).append(took / units)
    rates = {}
    for kind in set(DEFAULTS) | set(samples):
        base, per = DEFAULTS.get(kind, DEFAULT_OTHER)
        if samples.get(kind):
            rates[kind] = (0.0, statistics.median(samples[kind]), "history")
        else:
            rates[kind] = (base, per, "default")
    _rates = (time.monotonic(), rates)
    return rates


def estimate(src: dict) -> tuple[float, str]:
    """Tổng số giây dự kiến để chuyển xong nguồn, kèm cơ sở ước lượng."""
    base, per, basis = _rates_by_kind().get(src["kind"], (*DEFAULT_OTHER, "default"))
    return max(base + per * _units(src), MIN_SEC), basis


def _remaining(src: dict, now: datetime) -> tuple[float, bool, str]:
    """Việc đang chạy: (giây còn lại, đã quá dự kiến chưa, cơ sở)."""
    elapsed = (now - _utc(src.get("started_at") or now)).total_seconds()
    p = src.get("progress") or {}
    if (p.get("total") or 0) >= 2 and p.get("processed"):
        return elapsed / p["processed"] * (p["total"] - p["processed"]), False, "live"
    total, basis = estimate(src)
    return max(total - elapsed, 0), elapsed > total, basis


def schedule() -> dict:
    """{source_id: {...}} cho mọi nguồn đang chạy / đang chờ, cache vài giây vì mỗi dòng danh sách đều hỏi."""
    global _schedule
    with _lock:
        at, cached = _schedule
        if time.monotonic() - at < SCHEDULE_TTL:
            return cached
        now = _now()
        out = {}
        for lane in LANES:
            clock = 0.0
            for src in sources.find({"status": "extracting", "lane": lane}):
                left, overdue, basis = _remaining(src, now)
                clock = max(clock, left)
                out[src["_id"]] = {"lane": lane, "running": True, "position": 0, "start_in": 0,
                                   "finish_in": round(left), "overdue": overdue, "basis": basis}
            for i, src in enumerate(sources.find({"status": "queued", "lane": lane},
                                                 sort=[("priority", -1), ("created_at", 1)]), start=1):
                took, basis = estimate(src)
                out[src["_id"]] = {"lane": lane, "running": False, "position": i, "start_in": round(clock),
                                   "finish_in": round(clock + took), "overdue": False, "basis": basis}
                clock += took
        _schedule = (time.monotonic(), out)
        return out


def invalidate() -> None:
    global _schedule
    _schedule = (0.0, {})


def of(src: dict) -> dict | None:
    return schedule().get(src["_id"])


def lanes(readable: set) -> list[dict]:
    """Tổng quan từng làn: việc đang chạy, số việc chờ, bao lâu nữa làn trống. Nguồn ở kho không xem được chỉ tính số."""
    sched = schedule()
    ids = list(sched)
    rows = {s["_id"]: s for s in sources.find({"_id": {"$in": ids}}, {"title": 1, "kind": 1, "space_id": 1, "file.name": 1,
                                                                      "url": 1, "progress": 1})}
    result = []
    for lane in LANES:
        items = sorted(((sid, e) for sid, e in sched.items() if e["lane"] == lane), key=lambda x: x[1]["position"])
        jobs = []
        for sid, e in items:
            s = rows.get(sid) or {}
            visible = s.get("space_id") in readable
            jobs.append(e | {"id": str(sid) if visible else None, "kind": s.get("kind"),
                             "title": (s.get("title") or (s.get("file") or {}).get("name") or s.get("url")) if visible else None,
                             "progress": s.get("progress") if e["running"] else None})
        result.append({"lane": lane, "running": sum(1 for _, e in items if e["running"]),
                       "queued": sum(1 for _, e in items if not e["running"]),
                       "finish_in": max((e["finish_in"] for _, e in items), default=0), "jobs": jobs})
    return result
