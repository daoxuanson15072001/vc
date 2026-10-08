"""Âm thanh / video: đo thời lượng, tách tiếng, Whisper có mốc thời gian, cắt khung hình theo đổi cảnh.

Dùng chung cho ghi âm tải lên, video tải lên và video mạng xã hội. Whisper luôn đi qua
`worker.transcribe` để lấy khoá GPU chung.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from ..worker import core as worker_core, worker
from . import glossary

PARAGRAPH_SEC = 20          # gộp các câu Whisper thành đoạn ~20 giây, mỗi đoạn một mốc thời gian


def fmt_ts(sec: float) -> str:
    sec = int(sec or 0)
    h, m, s = sec // 3600, sec % 3600 // 60, sec % 60
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def probe_duration(path: Path) -> float | None:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True, timeout=60)
    try:
        return round(float(json.loads(out.stdout)["format"]["duration"]), 2)
    except (ValueError, KeyError, TypeError):
        return None


def has_audio(path: Path) -> bool:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True, timeout=60)
    return bool(out.stdout.strip())


def extract_audio(src: Path, dst: Path) -> Path:
    """Tách tiếng thành m4a mono 64 kbps — nhỏ, đủ cho Whisper và nghe lại."""
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000",
                    "-c:a", "aac", "-b:a", "64k", str(dst)], check=True, capture_output=True, timeout=3600)
    return dst


def transcribe(path: Path, options: dict) -> tuple[list[tuple[float, float, str]], str, str | None]:
    """-> ([(start, end, text)], engine, ngôn ngữ). Mặc định Whisper tự nhận ngôn ngữ và chép đúng tiếng gốc
    (ép tiếng Việt với video tiếng Trung ra chữ Việt sai nghĩa). Chờ khoá GPU nếu Whisper đang bận việc khác."""
    opts = {"backend": options.get("backend") or "auto", "model": options.get("model") or None,
            "language": options.get("language") or "auto"}
    transcriber, _, segs, language = worker.transcribe(path, opts)
    # Whisper tự nhận ra tiếng nước ngoài: nghe lại lượt nữa, đưa thuật ngữ ngành bằng tiếng đó làm ngữ cảnh
    # (vd "编程雷达" thay vì "编雷达"). Không đưa trước vì chưa biết tiếng — thuật ngữ tiếng Trung làm hỏng video
    # tiếng Việt. Chỉ tốn thêm với video tiếng nước ngoài.
    if segs and opts["language"] == "auto" and language not in (None, "vi") and \
            (prompt := glossary.whisper_prompt(language)):
        transcriber, _, again, _ = worker.transcribe(path, opts | {"prompt": prompt, "force_language": language})
        segs = again or segs
    return segs, f"whisper:{transcriber.backend}:{transcriber.model_name}", language


def join(texts, language: str | None = None) -> str:
    """Nối câu: tiếng Trung / Nhật / Thái viết liền, không chèn dấu cách."""
    return ("" if language in worker_core.NO_SPACE_LANGS else " ").join(texts).strip()


def paragraphs(segs: list[tuple[float, float, str]], language: str | None = None) -> list[tuple[float, str]]:
    """Gộp câu ngắn thành đoạn; mỗi đoạn giữ mốc bắt đầu."""
    out: list[tuple[float, str]] = []
    start, buf = None, []
    for s, e, t in segs:
        if start is None:
            start = s
        buf.append(t)
        if e - start >= PARAGRAPH_SEC or t.rstrip().endswith((".", "?", "!", "。", "？", "！")) and e - start >= PARAGRAPH_SEC / 2:
            out.append((start, join(buf, language)))
            start, buf = None, []
    if buf:
        out.append((start or 0.0, join(buf, language)))
    return out


def timeline_markdown(speech: list[tuple[float, str]], screen: list[tuple[float, str]] | None = None) -> str:
    """Trộn lời nói và chữ trên hình theo thời gian: `[12:30] …` / `[12:31] (trên hình) …`."""
    rows = [(t, 0, f"[{fmt_ts(t)}] {text}") for t, text in speech]
    rows += [(t, 1, f"[{fmt_ts(t)}] (trên hình) {text}") for t, text in (screen or []) if text.strip()]
    return "\n\n".join(r for _, _, r in sorted(rows))


def chunks(total: float | None, chunk_sec: int) -> list[tuple[float, float]]:
    if not total or total <= chunk_sec * 1.2:     # dư ít thì không tách thành phần lẻ ngắn
        return [(0.0, float("inf"))]
    out, t = [], 0.0
    while t < total:
        end = t + chunk_sec
        if total - end < chunk_sec * 0.2:
            end = float("inf")
        out.append((t, end))
        t = end
    return out


def keyframes(video: Path, out_dir: Path, max_frames: int = 12) -> list[tuple[float, Path]]:
    """Khung hình tại các điểm đổi cảnh (slide mới, cảnh mới). Ít đổi cảnh thì lấy đều theo thời lượng."""
    out_dir.mkdir(parents=True, exist_ok=True)
    proc = subprocess.run(["ffmpeg", "-v", "info", "-i", str(video), "-vf", "select='gt(scene,0.3)',showinfo",
                           "-vsync", "vfr", "-f", "null", "-"], capture_output=True, text=True, timeout=3600)
    times = [float(m) for m in re.findall(r"pts_time:([\d.]+)", proc.stderr)]
    duration = probe_duration(video) or 0
    if len(times) < 3 and duration:
        n = min(max_frames // 2, max(1, int(duration // 20)))
        times = [duration * (i + 0.5) / n for i in range(n)]
    if len(times) > max_frames:
        step = len(times) / max_frames
        times = [times[int(i * step)] for i in range(max_frames)]
    frames = []
    for t in times:
        path = out_dir / f"frame-{int(t):05d}.jpg"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1",
                        "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", str(path)], capture_output=True, timeout=120)
        if path.exists():
            frames.append((t, path))
    return frames
