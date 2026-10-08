"""Ghi âm và video tự tải lên: Whisper chép lời có mốc thời gian; video thêm chữ trên hình từ khung hình chính.

File dài được chia mỗi 30 phút một tài liệu (khoá `t0`, `t1800`…) để AI dựng thẻ không quá tải.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

from ...config import AUDIO_CHUNK_SEC
from .. import ai_text, media, translate
from .base import Adapter, Context, ExtractedDoc
from .ocr import ocr_image

AUDIO_EXTS = (".mp3", ".m4a", ".wav", ".ogg", ".oga", ".opus", ".aac", ".flac", ".amr", ".wma", ".aiff", ".aif",
              ".caf", ".3gp")
VIDEO_EXTS = (".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi")
AUDIO_TYPES = {
    "lecture": "Bài giảng / hội thảo",
    "meeting": "Cuộc họp",
    "interview": "Phỏng vấn",
    "note": "Ghi chú giọng nói",
}
MAX_WIKI_FRAMES = 6


class AudioAdapter(Adapter):
    kind = "audio"
    label = "Ghi âm"
    file_exts = AUDIO_EXTS
    lane = "heavy"

    def extract(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        path = ctx.raw_dir / source["file"]["stored_name"]
        yield from media_docs(path, source.get("title") or path.stem, source.get("url"), ctx, video=False)


class VideoFileAdapter(Adapter):
    kind = "video_file"
    label = "Video tải lên"
    file_exts = VIDEO_EXTS
    lane = "heavy"

    def extract(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        path = ctx.raw_dir / source["file"]["stored_name"]
        yield from media_docs(path, source.get("title") or path.stem, source.get("url"), ctx, video=True)


def media_docs(path: Path, title: str, url: str | None, ctx: Context, video: bool) -> Iterator[ExtractedDoc]:
    duration = media.probe_duration(path)
    ctx.log(f"Thời lượng {media.fmt_ts(duration or 0)}")

    # 1. Lời nói
    segs, engines, language, translated = [], [], None, []
    if media.has_audio(path):
        audio = path
        if video:   # tách tiếng ra file nhỏ: Whisper đọc nhanh hơn, giữ lại để nghe
            audio = media.extract_audio(path, ctx.raw_dir / "audio.m4a")
        if ctx.cancelled():
            return
        ctx.log("Đang chuyển giọng nói thành chữ (Whisper)…")
        segs, engine, language = media.transcribe(audio, ctx.options)
        engines.append(engine)
        ctx.log(f"Whisper xong: {len(segs)} câu ({translate.lang_name(language)})")
        _save_transcript(ctx.raw_dir, segs)
        # nói tiếng nước ngoài: giữ nguyên bản, bản dịch tiếng Việt là một mục riêng trong tài liệu
        if tr := translate.translate_segments(segs, language, ctx.log):
            translated = [(s["start"], s["end"], s["text"]) for s in tr["segments"]]
            _save_transcript(ctx.raw_dir, translated, suffix=".vi")
    else:
        ctx.log("File không có tiếng")

    # 2. Chữ trên hình (chỉ video)
    screen: list[tuple[float, str]] = []
    frames: list[tuple[float, Path]] = []
    if video and not ctx.cancelled():
        frames = media.keyframes(path, ctx.raw_dir / "frames")
        ctx.log(f"Cắt {len(frames)} khung hình chính")
        texts, engine = read_screen([p for _, p in frames], ctx)
        if engine:
            engines.append(engine)
        screen = [(t, txt) for (t, _), txt in zip(frames, texts) if txt.strip()]

    if not segs and not screen:
        ctx.log("Không có lời nói hay chữ trên hình")
        return

    speech = media.paragraphs(segs, language)
    speech_vi = media.paragraphs(translated)
    parts = media.chunks(duration, AUDIO_CHUNK_SEC)
    for a, b in parts:
        in_range = lambda t: a <= t < b  # noqa: E731
        text = media.timeline_markdown([p for p in speech if in_range(p[0])], [s for s in screen if in_range(s[0])])
        if not text:
            continue
        if vi := media.timeline_markdown([p for p in speech_vi if in_range(p[0])]):
            text = (f"## Nguyên bản ({translate.lang_name(language)})\n\n{text}\n\n"
                    f"## Bản dịch tiếng Việt\n\n{vi}")
        end = min(b, duration or b)
        suffix = f" ({media.fmt_ts(a)}–{media.fmt_ts(end)})" if len(parts) > 1 else ""
        images = [str(p.relative_to(ctx.raw_dir)) for t, p in frames if in_range(t)][:MAX_WIKI_FRAMES]
        yield ExtractedDoc(
            key=f"t{int(a)}", title=f"{title}{suffix}", text=text, url=url, images=images,
            engine=" + ".join(engines),
            meta={"duration": duration, "start": a, "end": None if end == float("inf") else end,
                  "segments": sum(1 for s in segs if in_range(s[0])), "frames": len(images),
                  "audio_type": ctx.options.get("audio_type") or None,
                  "language": language, "translated": bool(translated)},
        )


def read_screen(paths: list[Path], ctx: Context) -> tuple[list[str], str]:
    """Chữ trên khung hình: Claude đọc; chưa có AI hoặc lỗi thì Tesseract."""
    if not paths:
        return [], ""
    if ai_text.ready():
        try:
            texts = ai_text.read_frames(paths)
            ctx.log(f"Claude đọc chữ trên {len(paths)} khung hình")
            return texts, ai_text.ENGINE
        except Exception as e:  # noqa: BLE001 — khung hình là phần phụ, lỗi thì dùng OCR
            ctx.log(f"⚠ Claude không đọc được khung hình ({str(e)[:120]}) — dùng Tesseract")
    texts = []
    for p in paths:
        try:
            t = ocr_image(p)
        except Exception:  # noqa: BLE001
            t = ""
        texts.append(t if len(t) >= 15 else "")   # OCR trên cảnh thường ra ký tự rác ngắn
    return texts, "tesseract"


def _save_transcript(raw_dir: Path, segs: list[tuple[float, float, str]], suffix: str = "") -> None:
    from ...worker import core
    core.write_srt(segs, raw_dir / f"transcript{suffix}.srt")
    (raw_dir / f"segments{suffix}.json").write_text(
        json.dumps([{"start": round(s, 2), "end": round(e, 2), "text": t} for s, e, t in segs], ensure_ascii=False),
        encoding="utf-8")
