"""PDF: trang có lớp chữ đọc bằng pypdf (không cần AI), rồi pdfplumber dựng lại bảng + tiêu đề thành Markdown
(docmd.py, DOC_ENGINE; chưa cài thì giữ chữ pypdf). Trang scan gửi thẳng cho Claude đọc; chưa có AI thì OCR
bằng Tesseract."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Iterator

from ...config import MAX_DOC_CHARS
from .. import ai_text
from . import docmd
from .base import Adapter, Context, ExtractedDoc
from .ocr import ocr_image

MIN_PAGE_CHARS = 40    # trang ít chữ hơn -> coi là trang scan
MAX_OCR_PAGES = 80     # Tesseract chậm: tối đa bấy nhiêu trang
MAX_AI_PAGES = 300     # Claude: tối đa bấy nhiêu trang scan mỗi file


class PdfAdapter(Adapter):
    kind = "pdf"
    label = "File PDF"
    file_exts = (".pdf",)

    def extract(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        path = ctx.raw_dir / source["file"]["stored_name"]
        yield from extract_pdf(path, source.get("title") or path.stem, ctx)


def extract_pdf(path: Path, title: str, ctx: Context) -> Iterator[ExtractedDoc]:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    total = len(reader.pages)
    ctx.log(f"PDF {total} trang")
    pages: list[str] = []
    for page in reader.pages:
        if ctx.cancelled():
            return
        pages.append((page.extract_text() or "").strip())

    scanned = [i for i, t in enumerate(pages, 1) if len(t) < MIN_PAGE_CHARS]
    engines = ["pypdf"] if len(scanned) < total else []
    if layout := docmd.pdf_pages(path, pages, ctx.log, ctx.cancelled, MIN_PAGE_CHARS):
        pages, name = layout
        engines.append(name)
    if scanned:
        ctx.log(f"{len(scanned)} trang scan / ít chữ")
        done = _read_scanned(path, scanned, ctx, engines)
        for i, text in done.items():
            if len(text) > len(pages[i - 1]):
                pages[i - 1] = text

    # Chia phần theo trang để mỗi phần không quá MAX_DOC_CHARS
    start, buf = 1, []
    for i, text in enumerate(pages, 1):
        buf.append(f"[Trang {i}]\n{text}")
        size = sum(len(b) for b in buf)
        if size >= MAX_DOC_CHARS or i == total:
            part = f" (trang {start}–{i})" if total > 1 and (start > 1 or i < total) else ""
            yield ExtractedDoc(key=f"p{start}-{i}", title=f"{title}{part}", text="\n\n".join(buf),
                               engine=" + ".join(engines),
                               meta={"pages": total, "page_from": start, "page_to": i, "scanned_pages": len(scanned)})
            start, buf = i + 1, []


def _read_scanned(path: Path, scanned: list[int], ctx: Context, engines: list[str]) -> dict[int, str]:
    if ai_text.ready():
        try:
            pages = scanned[:MAX_AI_PAGES]
            done = ai_text.read_pdf_pages(path, pages)
            ctx.log(f"Claude đọc {len(done)} trang scan")
            engines.append(ai_text.ENGINE)
            return done
        except Exception as e:  # noqa: BLE001
            ctx.log(f"⚠ Claude không đọc được PDF ({str(e)[:150]}) — dùng Tesseract")
    done = {}
    for i in scanned[:MAX_OCR_PAGES]:
        if ctx.cancelled():
            break
        done[i] = _ocr_page(path, i, ctx.raw_dir)
    ctx.log(f"Đã OCR {len(done)} trang scan (Tesseract)")
    engines.append("tesseract")
    return done


def _ocr_page(pdf: Path, page: int, raw_dir: Path) -> str:
    out_dir = raw_dir / "ocr"
    out_dir.mkdir(exist_ok=True)
    prefix = out_dir / f"page-{page}"
    subprocess.run(["pdftoppm", "-r", "200", "-f", str(page), "-l", str(page), "-png", "-singlefile",
                    str(pdf), str(prefix)], check=True, capture_output=True, timeout=120)
    return ocr_image(prefix.with_suffix(".png"))
