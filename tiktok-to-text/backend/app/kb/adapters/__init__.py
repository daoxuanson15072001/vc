"""Danh sách loại nguồn. Thứ tự quan trọng khi tự nhận diện link: Google trước, video, ảnh, website sau cùng."""

from __future__ import annotations

from pathlib import Path

from .audio import AUDIO_TYPES, AudioAdapter, VideoFileAdapter  # noqa: F401
from .base import Adapter, Context, ExtractedDoc, MoveToHeavyLane  # noqa: F401
from .google import GoogleAdapter
from .image import ImageAdapter
from .office import OfficeAdapter
from .pdf import PdfAdapter
from .video import VideoAdapter, platform_of  # noqa: F401
from .web import WebAdapter

ADAPTERS: dict[str, Adapter] = {a.kind: a for a in (
    VideoAdapter(), GoogleAdapter(), PdfAdapter(), ImageAdapter(), OfficeAdapter(), AudioAdapter(),
    VideoFileAdapter(), WebAdapter())}
__all__ = ["ADAPTERS", "AUDIO_TYPES", "Adapter", "Context", "ExtractedDoc", "MoveToHeavyLane", "accepted_file_exts",
           "detect_file", "detect_url", "lane_of", "normalize_link", "platform_of"]

URL_ORDER = ("google", "video", "image", "web")   # link .pdf / .docx / .mp3 đi qua "web" và được nhận ra khi tải


def normalize_link(text: str) -> str:
    """'@kenh' hoặc 'kenh' kiểu TikTok -> link kênh TikTok (giống lượt quét cũ); link giữ nguyên."""
    text = text.strip()
    if text.startswith(("http://", "https://")):
        return text
    if text.startswith("@") or text.startswith("www."):
        return f"https://www.tiktok.com/{text}" if text.startswith("@") else f"https://{text}"
    return text


def detect_url(url: str) -> str | None:
    return next((k for k in URL_ORDER if ADAPTERS[k].match_url(url)), None)


def detect_file(filename: str) -> str | None:
    ext = Path(filename).suffix.lower()
    return next((a.kind for a in ADAPTERS.values() if ext in a.file_exts), None)


def accepted_file_exts() -> list[str]:
    return sorted({e for a in ADAPTERS.values() for e in a.file_exts})


def lane_of(kind: str) -> str:
    return ADAPTERS[kind].lane if kind in ADAPTERS else "light"
