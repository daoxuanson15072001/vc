"""Ảnh / ảnh chụp màn hình. Nhiều ảnh gộp thành một tài liệu (album) theo đúng thứ tự người nạp.

Claude đọc ảnh là chính (chữ cách điệu, giao diện mạng xã hội, bảng); Tesseract chỉ dùng khi chưa có AI.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

from ...config import MAX_ALBUM_IMAGES
from .. import ai_text
from .base import Adapter, Context, ExtractedDoc
from .ocr import ocr_image

IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif", ".bmp", ".tif", ".tiff")
WIKI_READY_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif")
MAX_WIKI_IMAGES = 6
MAX_WIKI_BYTES = 5 * 1024 * 1024


class ImageAdapter(Adapter):
    kind = "image"
    label = "Hình ảnh"
    file_exts = IMAGE_EXTS

    def match_url(self, url: str) -> bool:
        return url.lower().split("?")[0].endswith(IMAGE_EXTS)

    def extract(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        files = source.get("files") or [source["file"]]
        names = [f["stored_name"] for f in files]
        labels = [f.get("name") or f["stored_name"] for f in files]
        title = source.get("title") or labels[0]
        groups = [range(i, min(i + MAX_ALBUM_IMAGES, len(names))) for i in range(0, len(names), MAX_ALBUM_IMAGES)]
        for g, idx in enumerate(groups, 1):
            if ctx.cancelled():
                return
            paths = [ctx.raw_dir / names[i] for i in idx]
            texts, engine = read_images(paths, ctx)
            if len(names) == 1:
                text = texts[0]
            else:
                text = "\n\n".join(f"## Ảnh {i + 1} — {labels[i]}\n\n{t or '(không có chữ)'}" for i, t in zip(idx, texts))
            suffix = f" (ảnh {idx[0] + 1}–{idx[-1] + 1})" if len(groups) > 1 else ""
            yield ExtractedDoc(
                key="image" if len(groups) == 1 else f"album{g}", title=f"{title}{suffix}", text=text,
                url=source.get("url"), engine=engine,
                images=[wiki_image(ctx.raw_dir, names[i]) for i in list(idx)[:MAX_WIKI_IMAGES]],
                meta={"images": len(idx), "chars": len(text)},
            )


def read_images(paths: list[Path], ctx: Context) -> tuple[list[str], str]:
    if ai_text.ready():
        try:
            texts = ai_text.read_images(paths)
            ctx.log(f"Claude chép chữ {len(paths)} ảnh: {sum(len(t) for t in texts)} ký tự")
            return texts, ai_text.ENGINE
        except Exception as e:  # noqa: BLE001
            ctx.log(f"⚠ Claude không đọc được ảnh ({str(e)[:150]}) — dùng Tesseract")
    texts = [ocr_image(ocr_ready(p)) for p in paths]
    ctx.log(f"OCR (Tesseract) {len(paths)} ảnh: {sum(len(t) for t in texts)} ký tự")
    return texts, "tesseract"


def ocr_ready(path: Path) -> Path:
    """Tesseract không đọc HEIC -> chuyển sang PNG cạnh file gốc."""
    if path.suffix.lower() not in (".heic", ".heif"):
        return path
    out = path.with_suffix(".png")
    if not out.exists():
        _convert(path, out, "PNG")
    return out


def wiki_image(raw_dir: Path, name: str) -> str:
    """Ảnh gửi kèm cho AI dựng thẻ phải là png/jpeg/webp/gif ≤ 5 MB -> tạo bản JPEG thu nhỏ khi cần."""
    path = raw_dir / name
    if path.suffix.lower() in WIKI_READY_EXTS and path.stat().st_size <= MAX_WIKI_BYTES:
        return name
    out = raw_dir / "preview" / (Path(name).stem + ".jpg")
    if not out.exists():
        out.parent.mkdir(exist_ok=True)
        _convert(path, out, "JPEG", max_edge=1568)
    return str(out.relative_to(raw_dir))


def _convert(src: Path, dst: Path, fmt: str, max_edge: int | None = None) -> None:
    from PIL import Image, ImageOps
    ai_text._heif()
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if max_edge:
            im.thumbnail((max_edge, max_edge))
        if fmt == "JPEG" and im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        im.save(dst, fmt, **({"quality": 88} if fmt == "JPEG" else {}))
