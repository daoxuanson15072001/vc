"""Video lỗi khi lấy chữ: đếm số lần lỗi, lưu lịch sử lỗi, phân loại lỗi (để tìm chỗ cải tiến).

- `fail_count`: số lần lỗi liên tiếp — lấy chữ được thì về 0 (db.upsert_video). Từ MAX_AUTO_RETRY lần trở lên thì
  máy không tự thử lại nữa (quét lại kênh, "Chạy tiếp tất cả"); người dùng vẫn chọn "Lấy lại chữ" thủ công được.
- `fail_log`: các lần lỗi gần nhất {at, error, kind, via} — via: scan (quét kênh), redo (lấy lại chữ thủ công),
  auto (lấy lại tự động khi bấm "Chạy tiếp tất cả"). Giữ cả sau khi lấy chữ được để thống kê.
- Lỗi vĩnh viễn (PERMANENT: video chỉ dành cho hội viên kênh, video đã gỡ / riêng tư, video bán hàng TikTok Shop
  bị ẩn link tải): thử lại cũng không được nên
  máy không tự thử lại ngay từ lần lỗi đầu; người dùng vẫn lấy lại thủ công được.
"""

from __future__ import annotations

import re

from .. import db
from ..config import VIDEO_MAX_AUTO_RETRY

MAX_AUTO_RETRY = VIDEO_MAX_AUTO_RETRY
LOG_KEEP = 20
DONE = ("ok", "no_speech")

# nhóm lỗi, theo thứ tự so khớp — nhãn hiện ở giao diện
KINDS = {
    "members_only": ("Chỉ dành cho hội viên kênh", r"members-only|Join this channel"),
    # bị chặn tạm thời trước "unavailable": YouTube báo "Video unavailable ... try again later" khi đang chặn
    "forbidden": ("Bị chặn (HTTP 403 / 429)", r"HTTP Error 40[34]|HTTP Error 429|Forbidden|Too Many Requests"
                                               r"|try again later|rate.?limit"),
    "unavailable": ("Video đã gỡ / riêng tư", r"Video (not |un)available|private video|has been removed|"
                                               r"video has been deleted|This video is private"),
    # video bán hàng (clip livestream, gắn giỏ TikTok Shop): trang web để trống playAddr — cookie đăng nhập cũng không
    # lấy được; adapter video đọc cờ isECVideo / nhãn "ecom_hiddenwm…" rồi báo lỗi này thay cho "No video formats found"
    "tiktok_shop": ("Video TikTok Shop — TikTok không cho tải", r"TikTok Shop|ecom_hiddenwm"),
    "no_formats": ("Không lấy được dữ liệu tải", r"No video formats found|Requested format is not available"
                                                  r"|Unable to extract universal data"),
    "network": ("Mạng chập chờn / bị ngắt", r"bytes read|TLS connect|timed out|Timeout|Connection (reset|aborted|broken)"
                                             r"|Recv failure|HTTPSConnectionPool|curl: \(\d+\)"),
    "file_missing": ("Tải xong nhưng không thấy file", r"Không tìm thấy file đã tải"),
    "whisper": ("Lỗi chuyển chữ (Whisper)", r"whisper|transcrib"),
}
OTHER = "other"
PERMANENT = frozenset({"members_only", "unavailable", "tiktok_shop"})   # thử lại cũng không được -> không tự thử lại lần nào
LABELS = {k: v[0] for k, v in KINDS.items()} | {OTHER: "Lỗi khác"}
_ANSI = re.compile(r"\x1b\[[0-9;]*m")


def clean(msg: str) -> str:
    return _ANSI.sub("", str(msg or "")).strip()[:300]


def kind_of(msg: str) -> str:
    for k, (_, rx) in KINDS.items():
        if re.search(rx, msg or "", re.I):
            return k
    return OTHER


def record(vid: str, url: str, msg: str, source_id, via: str) -> None:
    """Ghi một lần lỗi của video. Video đã có chữ (ở nguồn khác / lượt trước) thì giữ nguyên, không đếm."""
    if not vid or db.videos.count_documents({"_id": vid, "status": {"$in": list(DONE)}}):
        return
    msg, now = clean(msg), db.now()
    kind = kind_of(msg)
    db.upsert_video(vid, db.video_doc_from_record({"id": vid, "url": url, "status": f"LỖI: {msg}"})
                    | {"source_id": source_id, "transcribed_at": now, "error_kind": kind, "last_failed_at": now})
    db.videos.update_one({"_id": vid}, {"$inc": {"fail_count": 1}, "$push": {"fail_log": {
        "$each": [{"at": now, "error": msg, "kind": kind, "via": via}], "$slice": -LOG_KEEP}}})


def kind_of_video(v: dict) -> str:
    return v.get("error_kind") or kind_of(v.get("error") or "")   # dữ liệu cũ chưa có error_kind


def stop_reason(v: dict) -> str | None:
    """Vì sao máy không tự thử lại video lỗi này nữa (None = còn tự thử): lỗi vĩnh viễn hoặc đã lỗi đủ số lần."""
    kind = kind_of_video(v)
    if kind in PERMANENT:
        return f"{LABELS[kind].lower()} — không tự thử lại"
    if (v.get("fail_count") or 0) >= MAX_AUTO_RETRY:
        return f"đã lỗi {MAX_AUTO_RETRY} lần"
    return None


def exhausted(vid: str) -> str | None:
    """Video đang lỗi mà máy không tự thử lại nữa -> lý do; còn tự thử -> None."""
    v = db.videos.find_one({"_id": vid, "status": "error"}, {"fail_count": 1, "error_kind": 1, "error": 1}) if vid else None
    return stop_reason(v) if v else None
