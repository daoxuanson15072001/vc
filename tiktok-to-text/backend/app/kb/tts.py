"""Đọc thẻ VCWIKI thành giọng nói tiếng Việt (giọng neural của Microsoft qua edge-tts).

File mp3 được lưu đệm theo nội dung + giọng: thẻ không đổi thì nghe lại không phải tổng hợp lại."""

from __future__ import annotations

import asyncio
import hashlib
import re
from pathlib import Path

from ..config import TTS_DIR

VOICES = {
    "female": "vi-VN-HoaiMyNeural",   # giọng nữ
    "male": "vi-VN-NamMinhNeural",    # giọng nam
}
RATES = {"slow": "-15%", "normal": "+0%", "fast": "+20%"}


def ready() -> bool:
    try:
        import edge_tts  # noqa: F401
    except ImportError:
        return False
    return True


def plain(text: str) -> str:
    """Bỏ ký hiệu markdown để máy không đọc '#', '*', đường link…"""
    text = re.sub(r"```.*?```", " ", text or "", flags=re.S)
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)            # ảnh
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)          # [chữ](link) -> chữ
    text = re.sub(r"https?://\S+", " ", text)
    text = re.sub(r"^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+", "", text, flags=re.M)
    text = re.sub(r"[*_`~|]+", "", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def sentence(text: str) -> str:
    """Thêm dấu chấm cuối để giọng đọc ngắt nghỉ giữa các phần."""
    text = plain(text)
    return text if not text or text[-1] in ".!?:;…" else text + "."


def card_text(card: dict) -> str:
    parts = [sentence(card.get("title", "")), sentence(card.get("summary", "")), plain(card.get("body", ""))]
    points = [sentence(p) for p in card.get("key_points") or [] if p]
    if points:
        parts.append("Ý chính. " + " ".join(points))
    if card.get("when_to_use"):
        parts.append("Khi nào dùng. " + sentence(card["when_to_use"]))
    if card.get("example"):
        parts.append("Ví dụ. " + sentence(card["example"]))
    return "\n\n".join(p for p in parts if p)


FIRST_PIECE_CHARS = 200   # đoạn đầu ngắn để bắt đầu nghe sớm
PIECE_CHARS = 600         # các đoạn sau
RETRIES = 3
PARALLEL = 4          # số đoạn tổng hợp cùng lúc — edge-tts chỉ nhanh ngang thời lượng tiếng, chạy song song mới kịp nghe liền


def pieces(text: str) -> list[str]:
    """Chia văn bản theo câu: đoạn đầu ~FIRST_PIECE_CHARS, sau đó ~PIECE_CHARS ký tự."""
    out, cur = [], ""
    for sent in re.split(r"(?<=[.!?…:;])\s+|\n+", text):
        sent = sent.strip()
        if not sent:
            continue
        if cur and len(cur) + len(sent) > (PIECE_CHARS if out else FIRST_PIECE_CHARS):
            out.append(cur)
            cur = ""
        cur = f"{cur} {sent}".strip()
    return out + [cur] if cur else out


def cache_path(text: str, voice: str, rate: str) -> Path:
    key = hashlib.sha256(f"{VOICES[voice]}|{RATES[rate]}|{text}".encode()).hexdigest()[:32]
    return TTS_DIR / f"{key}.mp3"


async def stream(text: str, voice: str = "female", rate: str = "normal"):
    """Phát mp3 dần dần: tổng hợp song song nhiều đoạn, trả theo thứ tự; xong hết thì lưu bộ đệm."""
    import edge_tts

    voice_id, rate_val = VOICES[voice], RATES[rate]
    sem = asyncio.Semaphore(PARALLEL)

    async def one(piece: str) -> bytes:
        async with sem:
            for attempt in range(RETRIES):
                try:
                    buf = bytearray()
                    async for chunk in edge_tts.Communicate(piece, voice_id, rate=rate_val).stream():
                        if chunk["type"] == "audio":
                            buf += chunk["data"]
                    return bytes(buf)
                except Exception:   # dịch vụ thỉnh thoảng từ chối khi gọi dồn — chờ rồi thử lại
                    if attempt == RETRIES - 1:
                        raise
                    await asyncio.sleep(1 + attempt * 2)

    tasks = [asyncio.create_task(one(p)) for p in pieces(text)]
    done = bytearray()
    try:
        for t in tasks:
            data = await t
            done += data
            yield data
    finally:
        for t in tasks:
            t.cancel()
    path = cache_path(text, voice, rate)
    TTS_DIR.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_bytes(done)
    tmp.replace(path)
