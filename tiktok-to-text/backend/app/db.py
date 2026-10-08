"""Kết nối MongoDB và các hàm dựng document dùng chung cho API, worker và script nhập dữ liệu."""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone

from pymongo import ASCENDING, DESCENDING, MongoClient

from .config import MONGO_DB, MONGO_URI

client = MongoClient(MONGO_URI, tz_aware=True, serverSelectionTimeoutMS=3000)
db = client[MONGO_DB]
videos = db["videos"]
jobs = db["jobs"]


def ensure_indexes() -> None:
    videos.create_index([("channel_handle", ASCENDING)])
    videos.create_index([("status", ASCENDING)])
    videos.create_index([("posted_at", DESCENDING)])
    videos.create_index([("views", DESCENDING)])
    videos.create_index([("tags", ASCENDING)])
    jobs.create_index([("status", ASCENDING), ("created_at", ASCENDING)])


def now() -> datetime:
    return datetime.now(timezone.utc)


def refiner(kind: str, label: str, model: str | None = None, user_id=None) -> dict:
    """Ai tinh chế tài liệu / viết thẻ. kind: api (máy chủ tự dựng bằng Claude API), synth (tổng hợp cụm),
    mcp (Claude Desktop / Claude Code / AI khác qua MCP), manual (người viết tay trên web)."""
    return {"kind": kind, "label": label, "model": model, "user_id": user_id, "at": now()}


def unaccent(text: str) -> str:
    """'Hôm nay Đẹp' -> 'hom nay dep' — để tìm kiếm tiếng Việt không dấu."""
    text = unicodedata.normalize("NFD", text or "").replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in text if unicodedata.category(c) != "Mn").lower()


def clean_tags(tags, limit: int = 30) -> list[str]:
    """Một chuẩn tag cho video, tài liệu và thẻ VCWIKI: 'Dòng Tiền' / '#dong tien' -> 'dong-tien'."""
    cleaned = (re.sub(r"[^a-z0-9]+", "-", unaccent(t)).strip("-") for t in tags or [] if isinstance(t, str))
    return list(dict.fromkeys(t for t in cleaned if t))[:limit]


def build_search_text(doc: dict) -> str:
    return unaccent(" ".join(doc.get(k) or "" for k in ("transcript", "caption", "note")))


def search_regex(q: str) -> dict:
    """Khớp khi chứa đủ mọi từ, không cần liền nhau: 'luong khoan gara' tìm được '... luong khoan cho to tho gara'."""
    words = unaccent(q).split()
    if len(words) <= 1:
        return {"$regex": re.escape(unaccent(q.strip()))}
    return {"$regex": "^" + "".join(f"(?=.*{re.escape(w)})" for w in words), "$options": "s"}


def chars_per_sec(transcript: str, duration) -> float | None:
    if not transcript or not duration:
        return None
    return round(len(transcript) / duration, 1)


PLATFORM_HOSTS = {"tiktok": "tiktok", "youtube": "youtube", "youtu.be": "youtube"}


def detect_platform(url: str, extractor: str | None = None) -> str:
    """'tiktok' | 'youtube' | 'website' (mọi nguồn khác) — theo extractor yt-dlp, không có thì theo tên miền."""
    for key in (extractor or "", url or ""):
        key = key.lower()
        for needle, platform in PLATFORM_HOSTS.items():
            if needle in key:
                return platform
    return "website"


def channel_url_for(platform: str, handle: str, info: dict | None = None) -> str:
    info = info or {}
    if url := info.get("uploader_url") or info.get("channel_url"):
        return url
    if not handle:
        return ""
    return {
        "tiktok": f"https://www.tiktok.com/@{handle}",
        "youtube": f"https://www.youtube.com/@{handle}",
    }.get(platform, "")


def video_doc_from_record(record: dict) -> dict:
    """Chuyển record kiểu CLI ({id, url, channel, info, transcript, status}) sang document `videos`."""
    info = record.get("info") or {}
    transcript = record.get("transcript") or ""
    raw_status = record.get("status") or ""
    if raw_status.startswith("OK"):
        status, error = ("ok" if transcript else "no_speech"), None
    else:
        status, error = "error", raw_status.removeprefix("LỖI:").strip() or raw_status

    posted_at = None
    if info.get("timestamp"):
        posted_at = datetime.fromtimestamp(info["timestamp"], timezone.utc)
    elif (d := info.get("upload_date")) and len(d) == 8:
        posted_at = datetime(int(d[:4]), int(d[4:6]), int(d[6:]), tzinfo=timezone.utc)

    url = info.get("webpage_url") or record.get("url", "")
    platform = detect_platform(url, info.get("extractor_key"))
    # TikTok: uploader là handle; YouTube: uploader là tên hiển thị, handle nằm ở uploader_id ('@kenh')
    handle = (info.get("uploader_id") or "").lstrip("@") if platform == "youtube" else ""
    handle = handle or info.get("uploader") or ""
    if not handle:  # record lỗi không có info -> lấy handle từ link
        m = re.search(r"@([^/?]+)", record.get("url") or record.get("channel") or "")
        handle = m.group(1) if m else (record.get("channel") or "")

    doc = {
        "url": url,
        "platform": platform,
        "channel_handle": handle,
        "channel_url": channel_url_for(platform, handle, info),
        "channel_name": info.get("channel") or handle,
        "posted_at": posted_at,
        "duration": info.get("duration"),
        "views": info.get("view_count"),
        "likes": info.get("like_count"),
        "comments": info.get("comment_count"),
        "shares": info.get("repost_count"),
        "caption": info.get("description") or info.get("title") or "",
        "transcript": transcript,
        "status": status,
        "error": error,
        "chars_per_sec": chars_per_sec(transcript, info.get("duration")),
    }
    if not info:  # video lỗi ngay từ bước tải: đừng ghi đè số liệu cũ bằng None
        doc = {k: v for k, v in doc.items() if v not in (None, "") or k in ("status", "error")}
    return doc


def upsert_video(video_id: str, fields: dict) -> None:
    """Ghi kết quả chuyển chữ, giữ nguyên tags/note người dùng đã nhập."""
    ts = now()
    existing = videos.find_one({"_id": video_id}, {"transcript": 1, "caption": 1, "note": 1}) or {}
    fields = fields | {"updated_at": ts, "edited": False}
    if fields.get("status") in ("ok", "no_speech"):   # lấy chữ được: hết chuỗi lỗi (kb/video_errors.py)
        fields |= {"fail_count": 0, "error_kind": None}
    fields["search_text"] = build_search_text(existing | fields)
    videos.update_one(
        {"_id": video_id},
        {"$set": fields, "$setOnInsert": {"created_at": ts, "tags": [], "note": ""}},
        upsert=True,
    )


def serialize(doc: dict | None) -> dict | None:
    """ObjectId -> str, bỏ trường nội bộ."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "search_text":
            continue
        if k == "_id":
            out["id"] = str(v)
        elif k in ("job_id", "source_id"):
            out[k] = str(v) if v else None
        else:
            out[k] = v
    return out
