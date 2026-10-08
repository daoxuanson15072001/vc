"""Tài liệu -> Markdown giữ bảng và tiêu đề (DOC_ENGINE).

- markitdown (mặc định): Word / PowerPoint qua Microsoft markitdown; PDF đọc bố cục bằng pdfplumber — bảng kẻ ô
  thành bảng Markdown, dòng chữ cỡ lớn thành tiêu đề `#` / `##`, bảng không kẻ ô theo cách dóng cột của markitdown.
- docling: PDF qua IBM docling nếu đã cài (nặng: kéo theo torch + mô hình), không có thì như markitdown.
- legacy: chỉ pypdf / python-docx / python-pptx như trước.

Mọi hàm trả None khi thư viện chưa cài, lỗi hoặc ra rỗng — bộ đọc cũ trong office.py / pdf.py chạy tiếp,
nên kho vẫn chạy khi chưa cài markitdown. Excel giữ openpyxl (đã ra bảng Markdown, có giới hạn dòng / cột).
"""

from __future__ import annotations

import re
import statistics
import unicodedata
from pathlib import Path
from typing import Callable

from ... import config

Log = Callable[[str], None]

MAX_LAYOUT_PAGES = 400    # PDF dài hơn: pdfplumber chậm, chỉ dùng lớp chữ pypdf
HEADING_RATIO = 1.25      # dòng có cỡ chữ >= 1,25 lần cỡ chữ thân bài -> tiêu đề
H1_RATIO = 1.6            # >= 1,6 lần -> tiêu đề cấp 1
MAX_HEADING_LEN = 120
MIN_KEEP_RATIO = 0.8      # bản bố cục phải giữ được >= 80% số chữ của pypdf, không thì dùng pypdf

_converter = None


def engine() -> str:
    return (config.DOC_ENGINE or "markitdown").strip().lower()


def enabled() -> bool:
    return engine() != "legacy"


def _markitdown():
    global _converter
    if _converter is None:
        from markitdown import MarkItDown
        _converter = MarkItDown(enable_plugins=False)
    return _converter


def _convert(path: Path, log: Log) -> str | None:
    if not enabled():
        return None
    try:
        text = _markitdown().convert(str(path)).markdown or ""
    except ImportError:
        return None
    except Exception as e:  # noqa: BLE001
        log(f"⚠ markitdown không đọc được ({str(e)[:150]}) — dùng bộ đọc cũ")
        return None
    return text.strip() or None


# --- Word / PowerPoint ---

IMAGE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
EMPTY_ROW = re.compile(r"^\|(\s*\|)+\s*$")
SEP_ROW = re.compile(r"^\|(\s*:?-+:?\s*\|)+\s*$")


def _images(md: str) -> str:
    """Ảnh nhúng (data URI / tên file trong gói Office) không mở được từ kho — chỉ giữ chỗ đánh dấu."""
    return IMAGE.sub(lambda m: f"[Hình: {m.group(1).strip()}]" if m.group(1).strip() else "[Hình]", md)


def _header_rows(md: str) -> str:
    """Bảng Word không đánh dấu dòng tiêu đề: mammoth để dòng đầu rỗng — đưa dòng dữ liệu đầu lên làm tiêu đề."""
    lines = md.split("\n")
    out, i = [], 0
    while i < len(lines):
        if (EMPTY_ROW.match(lines[i].strip()) and i + 2 < len(lines) and SEP_ROW.match(lines[i + 1].strip())
                and lines[i + 2].strip().startswith("|") and (i == 0 or not lines[i - 1].strip().startswith("|"))):
            out += [lines[i + 2], lines[i + 1]]
            i += 3
            continue
        out.append(lines[i])
        i += 1
    return "\n".join(out)


def _tidy(md: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", md).strip()


def docx(path: Path, log: Log) -> str | None:
    md = _convert(path, log)
    return _tidy(_header_rows(_images(md))) if md else None


SLIDE = re.compile(r"<!-- Slide number: (\d+) -->[ \t]*\n(?:[ \t]*\n)*(?:# (.+)\n)?")
NOTES = re.compile(r"^### Notes:[ \t]*\n(.*?)(?=^## Slide \d|\Z)", re.S | re.M)


def pptx(path: Path, log: Log) -> tuple[str, int] | None:
    """Theo quy ước cũ: mỗi slide `## Slide n: tiêu đề`, ghi chú người trình bày thành trích dẫn."""
    md = _convert(path, log)
    if not md:
        return None
    md = SLIDE.sub(lambda m: f"## Slide {m.group(1)}" + (f": {m.group(2).strip()}" if m.group(2) else "") + "\n\n",
                   _images(md))

    def notes(m: re.Match) -> str:
        text = m.group(1).strip()
        if not text:
            return ""
        rows = text.split("\n")
        return "> Ghi chú người trình bày: " + "\n> ".join(r.strip() for r in rows) + "\n\n"

    md = _tidy(NOTES.sub(notes, md))
    return md, len(re.findall(r"^## Slide \d+", md, re.M))


# --- PDF ---

def _nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", _nfc(s)).strip()


def _letters(s: str) -> int:
    return sum(ch.isalnum() for ch in _nfc(s))


def _cell(v) -> str:
    return re.sub(r"\s+", " ", _nfc(str(v or ""))).replace("|", "\\|").strip()


def _table_md(rows: list[list]) -> str:
    from .office import md_table
    return md_table([[_cell(c) for c in r] for r in rows])


def _inside(line: dict, box: tuple) -> bool:
    x0, top, x1, bottom = box
    mid_y = (line["top"] + line["bottom"]) / 2
    return top - 1 <= mid_y <= bottom + 1 and line["x0"] >= x0 - 2 and line["x1"] <= x1 + 2


def _heading(line: dict, body: float) -> str | None:
    text = _norm(line["text"])
    sizes = [c["size"] for c in line.get("chars", []) if c.get("text", "").strip()]
    if not text or not sizes or len(text) > MAX_HEADING_LEN or not any(ch.isalpha() for ch in text):
        return None
    ratio = statistics.mean(sizes) / body
    if ratio >= H1_RATIO:
        return "# " + text
    if ratio >= HEADING_RATIO:
        return "## " + text
    return None


def _layout(page, form_fn) -> tuple[list[tuple[tuple, str]], dict[str, str], str | None]:
    """pdfplumber đọc một trang -> ([(khung bảng, bảng Markdown)], {dòng chữ: dòng tiêu đề}, bản dóng cột nếu có)."""
    sizes = [c["size"] for c in page.chars if c.get("text", "").strip()]
    if not sizes:
        return [], {}, None
    body = statistics.median(sizes)
    tables = []
    for t in page.find_tables():
        if len(t.rows) >= 2 and len(t.rows[0].cells) >= 2 and (md := _table_md(t.extract())):
            tables.append((t.bbox, md))
    heads: dict[str, str] = {}
    for ln in page.extract_text_lines(return_chars=True):
        if not any(_inside(ln, b) for b, _ in tables) and (h := _heading(ln, body)):
            heads[_norm(ln["text"])] = h
    form = None
    if not tables and form_fn and (f := form_fn(page)) and "|" in f:
        form = f
    return tables, heads, form


def _splice(page, height: float, tables: list[tuple[tuple, str]]) -> str | None:
    """Ghép bảng vào chữ pypdf: giữ thứ tự đọc của pypdf (đúng cả trang 2 cột), bỏ các mẩu chữ nằm trong khung
    bảng và đặt bảng Markdown vào chỗ mẩu đầu tiên. Không đặt được hết bảng (trang xoay…) -> None."""
    out: list[str] = []
    placed: set[int] = set()
    state = {"in": None}

    def visit(text, cm, tm, _font, _size):
        if text.strip("\n") == "":           # xuống dòng: theo mẩu chữ đứng trước
            if state["in"] is None:
                out.append(text)
            return
        x = tm[4] * cm[0] + tm[5] * cm[2] + cm[4]
        top = height - (tm[4] * cm[1] + tm[5] * cm[3] + cm[5])
        hit = next((k for k, (b, _) in enumerate(tables)
                    if b[0] - 2 <= x <= b[2] + 2 and b[1] - 2 <= top <= b[3] + 2), None)
        state["in"] = hit
        if hit is None:
            out.append(text)
        elif hit not in placed:
            placed.add(hit)
            out.append(f"\n\n{tables[hit][1]}\n\n")

    page.extract_text(visitor_text=visit)
    if len(placed) < len(tables):
        return None
    text = "\n".join(line.strip() for line in "".join(out).split("\n"))
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _apply_headings(text: str, heads: dict[str, str]) -> str:
    if not heads:
        return text
    out = []
    for line in text.split("\n"):
        h = heads.get(_norm(line))
        out.append(f"\n{h}\n" if h else line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()


def _form_fn():
    """Bảng không kẻ ô: dùng cách dóng cột theo vị trí chữ của markitdown (hàm nội bộ — thiếu thì bỏ qua)."""
    try:
        from markitdown.converters._pdf_converter import _extract_form_content_from_words
        return _extract_form_content_from_words
    except Exception:  # noqa: BLE001
        return None


def pdf_pages(path: Path, pages: list[str], log: Log, cancelled: Callable[[], bool] = lambda: False,
              min_chars: int = 40) -> tuple[list[str], str] | None:
    """Nhận chữ pypdf từng trang, trả (Markdown từng trang, tên công cụ): bảng kẻ ô ghép vào đúng chỗ trong chữ
    pypdf, dòng chữ cỡ lớn đánh dấu tiêu đề. Trang scan (ít chữ) để nguyên cho bước OCR."""
    if not enabled() or not any(len(p) >= min_chars for p in pages):
        return None
    if len(pages) > MAX_LAYOUT_PAGES:
        log(f"PDF quá {MAX_LAYOUT_PAGES} trang — chỉ lấy lớp chữ (pypdf), không dựng bảng")
        return None
    if engine() == "docling" and (done := _docling(path, pages, log)):
        return done
    try:
        import pdfplumber
        from pypdf import PdfReader
    except ImportError:
        return None
    form_fn = _form_fn()
    out, with_tables = list(pages), 0
    try:
        reader = PdfReader(str(path))
        with pdfplumber.open(str(path)) as pdf:
            for i, page in enumerate(pdf.pages):
                if cancelled():
                    break
                if i >= len(pages) or len(pages[i]) < min_chars:
                    page.close()
                    continue
                try:
                    tables, heads, form = _layout(page, form_fn)
                    md = _splice(reader.pages[i], float(page.height), tables) if tables else form
                except Exception:  # noqa: BLE001 — một trang lỗi bố cục: giữ chữ pypdf
                    md, heads = None, {}
                page.close()
                if md and _letters(md) >= MIN_KEEP_RATIO * _letters(pages[i]):
                    out[i] = _apply_headings(md, heads)
                    with_tables += 1
                else:
                    out[i] = _apply_headings(pages[i], heads)
    except Exception as e:  # noqa: BLE001
        log(f"⚠ pdfplumber không đọc được bố cục ({str(e)[:150]}) — giữ chữ pypdf")
        return None
    if with_tables:
        log(f"{with_tables} trang có bảng")
    return out, "pdfplumber"


def _docling(path: Path, pages: list[str], log: Log) -> tuple[list[str], str] | None:
    try:
        from docling.document_converter import DocumentConverter
    except ImportError:
        log("DOC_ENGINE=docling nhưng chưa cài docling — dùng markitdown / pdfplumber")
        return None
    try:
        doc = DocumentConverter().convert(str(path)).document
        out = [(doc.export_to_markdown(page_no=i) or "").strip() for i in range(1, len(pages) + 1)]
    except Exception as e:  # noqa: BLE001
        log(f"⚠ docling lỗi ({str(e)[:150]}) — dùng markitdown / pdfplumber")
        return None
    # trang docling ra ít chữ hơn hẳn pypdf -> giữ pypdf
    out = [md if _letters(md) >= MIN_KEEP_RATIO * _letters(old) else old for md, old in zip(out, pages)]
    return out, "docling"
