"""Gợi ý ngôn ngữ lời nói cho nguồn video / kênh — người dùng vẫn tự chọn, đây chỉ là gợi ý.

Đoán theo chữ viết của caption / tiêu đề: có chữ Hán hoặc dấu câu toàn chiều rộng (，。、) -> tiếng Trung, dấu
tiếng Việt -> tiếng Việt, còn lại chữ La-tinh -> tiếng Anh. Ngôn ngữ Whisper tự nhận chỉ tin khi nguồn để "Tự nhận"
(nguồn ép ngôn ngữ thì bảng `videos` ghi đúng ngôn ngữ bị ép, không phải tiếng thật).
"""

from __future__ import annotations

import re
from collections import Counter

import yt_dlp

from .. import db

LABELS = {"auto": "Tự nhận", "vi": "Tiếng Việt", "en": "Tiếng Anh", "zh": "Tiếng Trung"}
SAMPLE = 5            # số video gần nhất đọc caption
CONFIDENT = 0.6       # tỉ lệ video cùng một tiếng để gợi ý tiếng đó; thấp hơn -> gợi ý "Tự nhận"

HAN = re.compile(r"[一-鿿　-〿，：；！？]")
KANA = re.compile(r"[぀-ヿ]")
HANGUL = re.compile(r"[가-힯]")
VI = re.compile(r"[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]", re.I)
LATIN = re.compile(r"[a-z]{3,}", re.I)
HANDLE = re.compile(r"/@([\w.-]+)")


class _Quiet:
    """yt-dlp in lỗi ra stderr kể cả khi quiet — gợi ý thất bại là chuyện thường, không cần log."""
    def debug(self, msg): pass
    def warning(self, msg): pass
    def error(self, msg): pass


def guess_text(text: str) -> str | None:
    text = text or ""
    if KANA.search(text):
        return "ja"
    if HANGUL.search(text):
        return "ko"
    if len(HAN.findall(text)) >= 2:
        return "zh"
    if VI.search(text):
        return "vi"
    if LATIN.search(text):
        return "en"
    return None


def guess(texts: list[str]) -> tuple[str | None, int, int]:
    """-> (ngôn ngữ chiếm đa số, số caption đồng ý, số caption đoán được)."""
    votes = Counter(g for g in map(guess_text, texts) if g)
    if not votes:
        return None, 0, 0
    lang, n = votes.most_common(1)[0]
    return lang, n, sum(votes.values())


def _hint(texts: list[str], where: str, current: str | None) -> dict | None:
    lang, n, total = guess(texts)
    if not lang:
        return None
    confident = n / total >= CONFIDENT
    value = lang if confident and lang in LABELS else "auto"
    name = LABELS.get(lang, {"ja": "tiếng Nhật", "ko": "tiếng Hàn"}.get(lang, lang))
    reason = f"{n}/{total} caption {where} có vẻ là {name.lower()}"
    if value == "auto":
        reason += " — chưa chắc / không có trong danh sách ép, để Whisper tự nhận"
    if current and current not in ("auto", value) and value != "auto":
        reason = f"Nguồn đang ép {LABELS.get(current, current).lower()}, nhưng {reason}"
    return {"language": value, "label": LABELS[value], "reason": reason, "differs": bool(current) and current != value}


def for_source(src: dict) -> dict | None:
    """Gợi ý từ video đã quét của nguồn (không cần mạng)."""
    current = (src.get("options") or {}).get("language") or "auto"
    f: dict = {"source_id": src["_id"]}
    if not db.videos.count_documents(f, limit=1) and (m := HANDLE.search(src.get("url") or "")):
        f = {"channel_handle": m.group(1)}   # nguồn nạp lại: video còn ghi theo nguồn cũ
    rows = list(db.videos.find(f, {"caption": 1, "language": 1, "transcript": 1}).sort("posted_at", -1).limit(40))
    if current == "auto":   # Whisper tự nhận: tin ngôn ngữ của video có lời nói
        heard = Counter(r["language"] for r in rows if r.get("language") and len(r.get("transcript") or "") > 20)
        if heard:
            lang, n = heard.most_common(1)[0]
            if lang in LABELS and n / sum(heard.values()) >= CONFIDENT:
                return {"language": "auto", "label": LABELS["auto"], "differs": False,
                        "reason": f"Whisper nhận ra {LABELS[lang].lower()} ở {n}/{sum(heard.values())} video"}
    return _hint([r.get("caption") or "" for r in rows], "của nguồn", current)


def for_url(url: str, kind: str | None) -> dict | None:
    """Gợi ý khi dán link kênh / video: kênh đã quét trước -> đọc bảng `videos`; chưa thì đọc caption vài video
    mới nhất qua yt-dlp (một lần thử, không tải video). TikTok hay chặn trang kênh -> không có gợi ý."""
    if kind != "video":
        return None
    if m := HANDLE.search(url):
        caps = [v.get("caption") or "" for v in db.videos.find({"channel_handle": m.group(1)}, {"caption": 1})
                .sort("posted_at", -1).limit(20)]
        if caps and (h := _hint(caps, "đã quét của kênh", None)):
            return h
    opts = {"quiet": True, "no_warnings": True, "extract_flat": "in_playlist", "skip_download": True,
            "playlistend": SAMPLE, "socket_timeout": 10, "logger": _Quiet()}
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception:  # noqa: BLE001 — gợi ý thôi, lỗi thì bỏ qua
        return None
    entries = [e for e in (info.get("entries") or [info]) if e][:SAMPLE]
    texts = [e.get("description") or e.get("title") or "" for e in entries]
    return _hint(texts, f"của {len(entries)} video mới nhất", None)
