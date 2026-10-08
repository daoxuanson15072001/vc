"""Chọn video tham chiếu trong Kho video và chấm độ viral (BA mục 5.2); chọn thẻ VCWIKI liên quan."""

from __future__ import annotations

import re
import statistics

from .. import db, policy
from ..config import STUDIO_MAX_REFS
from ..kb.pipeline import cards
from ..kb.wiki import AI_CARD_TYPES

CANDIDATES = 400          # số video nhiều lượt xem nhất đem ra chấm trước khi lấy top
REF_PROJECTION = {"segments": 0, "search_text": 0}


def channel_medians(handles) -> dict:
    """Trung vị lượt xem 30 video gần nhất của từng kênh — mốc để biết video nào 'nổ' bất thường."""
    out = {}
    for h in handles:
        views = [v["views"] for v in db.videos.find({"channel_handle": h, "views": {"$gt": 0}}, {"views": 1})
                 .sort("posted_at", -1).limit(30)]
        out[h] = statistics.median(views) if views else None
    return out


def viral_metrics(v: dict, median: float | None) -> dict:
    views = v.get("views") or 0
    likes, comments, shares = (v.get(k) or 0 for k in ("likes", "comments", "shares"))
    if not views:
        return {"outlier": None, "share_rate": 0, "comment_rate": 0, "engagement_rate": 0, "velocity": 0,
                "viral_score": 0}
    outlier = views / median if median else None
    share_rate, comment_rate = shares / views, comments / views
    engagement = (likes + comments + shares) / views
    days = max(1, (db.now() - v["posted_at"]).days) if v.get("posted_at") else None
    # Trọng số: đột biến so với kênh 40 · chia sẻ 25 · tương tác 20 · bình luận 15 (mốc "rất tốt" của TikTok)
    score = (40 * min((outlier or 1) / 5, 1) + 25 * min(share_rate / 0.01, 1)
             + 20 * min(engagement / 0.10, 1) + 15 * min(comment_rate / 0.003, 1))
    return {"outlier": round(outlier, 2) if outlier else None, "share_rate": round(share_rate, 4),
            "comment_rate": round(comment_rate, 4), "engagement_rate": round(engagement, 4),
            "velocity": round(views / days) if days else None, "viral_score": round(score)}


def video_query(q: str | None = None, channel: str | None = None, tag: str | None = None,
                video_ids: list[str] | None = None) -> dict:
    f: dict = {"status": "ok"}
    if video_ids:
        f["_id"] = {"$in": video_ids}
        return f
    if q and q.strip():
        f["search_text"] = db.search_regex(q)
    if channel:
        f["channel_handle"] = channel
    if tag:
        f["tags"] = tag
    return f


def find_references(q: str | None = None, channel: str | None = None, tag: str | None = None,
                    video_ids: list[str] | None = None, limit: int = 12) -> list[dict]:
    """Video đã chuyển chữ khớp bộ lọc, xếp theo viral_score. Chọn tay (video_ids) thì giữ đủ các video đó."""
    f = video_query(q, channel, tag, video_ids)
    rows = list(db.videos.find(f, REF_PROJECTION).sort("views", -1).limit(STUDIO_MAX_REFS if video_ids else CANDIDATES))
    medians = channel_medians({r.get("channel_handle") for r in rows})
    for r in rows:
        r["metrics"] = viral_metrics(r, medians.get(r.get("channel_handle")))
    rows.sort(key=lambda r: r["metrics"]["viral_score"], reverse=True)
    return rows if video_ids else rows[:min(limit, STUDIO_MAX_REFS)]


def ref_out(v: dict) -> dict:
    return {"id": v["_id"], "url": v.get("url"), "channel_handle": v.get("channel_handle"),
            "caption": v.get("caption") or "", "posted_at": v.get("posted_at"), "duration": v.get("duration"),
            "views": v.get("views"), "likes": v.get("likes"), "comments": v.get("comments"),
            "shares": v.get("shares"), "metrics": v.get("metrics") or {},
            "transcript_preview": (v.get("transcript") or "")[:220]}


def find_cards(user: dict, query: str, limit: int = 12) -> list[dict]:
    """Thẻ VCWIKI (kho người dùng xem được, trừ thẻ bị loại) khớp nhiều từ khoá nhất; thẻ đã duyệt được ưu tiên."""
    words = list(dict.fromkeys(w for w in re.findall(r"[a-z0-9]+", db.unaccent(query)) if len(w) >= 4))[:20]
    if not words or limit <= 0:
        return []
    f = policy.visible_filter(user, "card") | {"status": {"$ne": "rejected"},
         "type": {"$nin": list(AI_CARD_TYPES)},   # skill / ghi nhớ của AI không phải tri thức nội dung
         "$or": [{"search_text": {"$regex": re.escape(w)}} for w in words]}
    rows = list(cards.find(f, {"title": 1, "summary": 1, "type": 1, "status": 1, "search_text": 1}).limit(300))
    for r in rows:
        r["_rank"] = sum(w in r["search_text"] for w in words) + (2 if r["status"] == "approved" else 0)
    rows.sort(key=lambda r: r["_rank"], reverse=True)
    return [{"id": str(r["_id"]), "title": r["title"], "summary": r.get("summary", ""), "type": r["type"],
             "status": r["status"]} for r in rows[:limit]]
