"""Gộp dữ liệu TikTok → Text cũ vào Kho tư liệu — chạy một lần lúc khởi động, chạy lại không tạo trùng.

- Mỗi kênh trong bảng `videos` thành một nguồn (loại video) trong kho chung "Kho video TikTok"
  (mọi người trong công ty được xem, như Kho video trước đây).
- Mỗi video đã chuyển chữ thành một tài liệu "chỉ chuyển chữ" — không chạy lại Whisper, không gọi AI.
- Bảng `videos` và `jobs` giữ nguyên: Kho video, xuất Excel và Xưởng chiến dịch vẫn đọc từ `videos`.

Chạy tay: cd backend && ../.venv/bin/python -m app.kb.migrate
"""

from __future__ import annotations

from .. import db
from ..auth import users
from ..spaces import spaces
from .adapters import lane_of
from .adapters.video import PLATFORMS, video_document
from .pipeline import save_document, sources

meta = db.db["meta"]
FLAG = "merge_tiktok_into_kb_v1"
SPACE_NAME = "Kho video TikTok"


def run(force: bool = False) -> dict | None:
    if meta.find_one({"_id": FLAG}) and not force:
        return None
    if not db.videos.estimated_document_count():
        meta.update_one({"_id": FLAG}, {"$set": {"at": db.now(), "sources": 0, "documents": 0}}, upsert=True)
        return None
    owner = users.find_one({"role": "admin", "active": True}, sort=[("created_at", 1)])
    if not owner:
        return None      # chưa có tài khoản quản trị: đợi lần khởi động sau
    space = spaces.find_one({"legacy": "tiktok"}) or _create_space(owner)

    n_src = n_doc = 0
    groups = db.videos.aggregate([
        # video đã đi qua Kho tư liệu (có source_id) thì đã có tài liệu, không chuyển nữa
        {"$match": {"status": {"$in": ["ok", "no_speech"]}, "source_id": {"$exists": False}}},
        {"$group": {"_id": {"platform": "$platform", "handle": "$channel_handle"},
                    "channel_url": {"$first": "$channel_url"}, "sample_url": {"$first": "$url"},
                    "name": {"$first": "$channel_name"}, "first": {"$min": "$created_at"}}},
    ])
    for g in groups:
        handle = g["_id"].get("handle") or ""
        platform = g["_id"].get("platform") or db.detect_platform(g["sample_url"] or "")
        url = g["channel_url"] or db.channel_url_for(platform, handle) or g["sample_url"]
        src = sources.find_one({"space_id": space["_id"], "url": url})
        if not src:
            src = {"space_id": space["_id"], "created_by": owner["_id"], "kind": "video", "url": url,
                   "title": f"{g['name'] or handle} (@{handle})" if handle else None,
                   "platform": PLATFORMS.get(platform, platform), "google": None,
                   "status": "extracted", "error": None, "lane": lane_of("video"), "cancel_requested": False,
                   "categories": [], "tags": [], "note": "", "legacy": "tiktok",
                   "options": {"limit": 0, "language": "vi", "build_wiki": False, "sleep": 2.0, "force": False},
                   "logs": [{"at": db.now(), "msg": "Chuyển từ lượt quét TikTok → Text trước khi gộp vào Kho tư liệu"}],
                   "created_at": g["first"] or db.now(), "finished_at": db.now()}
            src["_id"] = sources.insert_one(src).inserted_id
            n_src += 1
        vf = {"status": {"$in": ["ok", "no_speech"]}, "source_id": {"$exists": False},
              "channel_handle": g["_id"].get("handle")}
        vf["platform"] = g["_id"]["platform"] if g["_id"].get("platform") else {"$in": [None, ""]}
        for v in db.videos.find(vf):
            save_document(src, video_document(v), build_wiki=False)
            n_doc += 1
    result = {"at": db.now(), "space_id": space["_id"], "sources": n_src, "documents": n_doc}
    meta.update_one({"_id": FLAG}, {"$set": result}, upsert=True)
    return result


def _create_space(owner: dict) -> dict:
    doc = {"name": SPACE_NAME, "description": "Video đã chuyển chữ từ các lượt quét TikTok → Text trước khi gộp vào "
                                              "Kho tư liệu. Mọi người trong công ty được xem.",
           "type": "shared", "owner_id": owner["_id"], "visibility": "org", "legacy": "tiktok",
           "members": [{"user_id": owner["_id"], "role": "owner", "added_at": db.now()}], "created_at": db.now()}
    doc["_id"] = spaces.insert_one(doc).inserted_id
    return doc


if __name__ == "__main__":
    print(run(force=True))
