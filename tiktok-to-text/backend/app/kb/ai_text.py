"""Tầng chữ bằng Claude: chép nguyên văn ảnh, trang PDF scan, khung hình video và bài viết khó lấy.

Khác với bước dựng thẻ (wiki.py): ở đây chỉ CHÉP LẠI, không tóm tắt, không diễn giải. Bộ đọc gọi các
hàm này khi AI sẵn sàng, còn không thì tự quay về Tesseract — nên kho vẫn chạy khi chưa có khoá API.
"""

from __future__ import annotations

import base64
import io
from pathlib import Path

from pypdf import PdfReader, PdfWriter

from ..config import TEXT_MODEL
from . import wiki

MAX_EDGE = 1568             # cạnh dài tối đa Claude đọc hiệu quả; ảnh lớn hơn được thu nhỏ
IMAGES_PER_CALL = 10
PDF_PAGES_PER_CALL = 20
ENGINE = f"claude:{TEXT_MODEL}"

SYSTEM = """Bạn là công cụ chép chữ cho kho tri thức nội bộ. Nhiệm vụ duy nhất: chép lại NGUYÊN VĂN nội dung \
trong tài liệu được gửi, thành Markdown.

Quy tắc:
- Giữ đúng ngôn ngữ gốc, không dịch, không tóm tắt, không thêm nhận xét hay lời dẫn.
- Giữ cấu trúc: tiêu đề dùng #, danh sách dùng -, bảng dùng bảng Markdown, giữ thứ tự đọc tự nhiên.
- Bỏ phần giao diện không thuộc nội dung: thanh trạng thái điện thoại, nút thích / chia sẻ, menu, quảng cáo.
- Chữ không đọc được ghi [không rõ]. Không đoán số liệu.
- Hình minh hoạ, biểu đồ không có chữ: mô tả ngắn trong ngoặc vuông, vd [Biểu đồ cột: doanh thu 2024–2026 tăng dần]."""

FRAME_HINT = """Đây là các khung hình cắt từ một video. Với mỗi khung: chép nguyên văn chữ xuất hiện trên màn hình \
(slide, chữ chèn, bảng). Nếu khung không có chữ, mô tả trong một câu ngắn điều đang diễn ra (thao tác, vật thể) \
trong ngoặc vuông. Khung chỉ có người nói, không có gì đáng chú ý: trả chuỗi rỗng."""


def ready() -> bool:
    """Chỉ Claude đọc được ảnh / PDF scan: Claude không dùng được thì bộ đọc dùng Tesseract, không chờ."""
    return wiki.claude_ready()


def _heif() -> None:
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
    except ImportError:
        pass


def image_block(path: Path) -> dict:
    """Ảnh -> content block base64, thu nhỏ về MAX_EDGE, chuyển JPEG (HEIC, WebP… đều đọc được)."""
    from PIL import Image, ImageOps
    _heif()
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        im.thumbnail((MAX_EDGE, MAX_EDGE))
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=88)
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                        "data": base64.standard_b64encode(buf.getvalue()).decode()}}


def _items_schema(key: str) -> dict:
    return {"type": "object", "additionalProperties": False, "required": [key],
            "properties": {key: {"type": "array", "items": {
                "type": "object", "additionalProperties": False, "required": ["index", "markdown"],
                "properties": {"index": {"type": "integer"}, "markdown": {"type": "string"}}}}}}


def read_images(paths: list[Path], hint: str = "", on_usage=None) -> list[str]:
    """Chép chữ từng ảnh. Trả list cùng thứ tự `paths`."""
    out: list[str] = [""] * len(paths)
    for start in range(0, len(paths), IMAGES_PER_CALL):
        batch = paths[start:start + IMAGES_PER_CALL]
        content: list[dict] = []
        for i, p in enumerate(batch, 1):
            content += [{"type": "text", "text": f"Ảnh {i}:"}, image_block(p)]
        task = f"Chép chữ của {len(batch)} ảnh trên. Trả về mỗi ảnh một mục, `index` là số thứ tự ảnh (bắt đầu từ 1)."
        content.append({"type": "text", "text": f"{hint}\n\n{task}".strip()})
        data = wiki.structured_call(SYSTEM, content, _items_schema("images"), model=TEXT_MODEL,
                                    too_long="Ảnh quá nhiều chữ, bị cắt — hãy chia nhỏ")
        if on_usage:
            on_usage(data["usage"])
        for item in data["images"]:
            if 1 <= item["index"] <= len(batch):
                out[start + item["index"] - 1] = item["markdown"].strip()
    return out


def read_frames(paths: list[Path], on_usage=None) -> list[str]:
    return read_images(paths, FRAME_HINT, on_usage)


def read_pdf_pages(pdf: Path, pages: list[int], on_usage=None) -> dict[int, str]:
    """Gửi thẳng các trang PDF (đánh số từ 1) cho Claude — Claude đọc PDF trực tiếp, kể cả trang scan."""
    reader = PdfReader(str(pdf))
    result: dict[int, str] = {}
    for start in range(0, len(pages), PDF_PAGES_PER_CALL):
        batch = pages[start:start + PDF_PAGES_PER_CALL]
        writer = PdfWriter()
        for n in batch:
            writer.add_page(reader.pages[n - 1])
        buf = io.BytesIO()
        writer.write(buf)
        content = [
            {"type": "document", "source": {"type": "base64", "media_type": "application/pdf",
                                            "data": base64.standard_b64encode(buf.getvalue()).decode()}},
            {"type": "text", "text": f"Chép chữ từng trang của tệp PDF trên ({len(batch)} trang). Mỗi trang một mục, "
                                     "`index` là số thứ tự trang trong tệp này (bắt đầu từ 1)."},
        ]
        data = wiki.structured_call(SYSTEM, content, _items_schema("pages"), max_tokens=32000, model=TEXT_MODEL,
                                    too_long="Trang PDF quá nhiều chữ, bị cắt")
        if on_usage:
            on_usage(data["usage"])
        for item in data["pages"]:
            if 1 <= item["index"] <= len(batch):
                result[batch[item["index"] - 1]] = item["markdown"].strip()
    return result


def clean_article(page_text: str, url: str, on_usage=None) -> dict:
    """Trang web mà trafilatura lấy được quá ít: đưa chữ thô của cả trang cho Claude tách phần nội dung chính."""
    content = (f"Link: {url}\n\nDưới đây là toàn bộ chữ của một trang web (đã bỏ mã HTML), gồm cả menu, quảng cáo, "
               f"bình luận. Chép lại NGUYÊN VĂN phần nội dung chính của bài (tiêu đề, các đoạn, bảng), bỏ mọi phần "
               f"khác. Trang không có bài viết nào (trang đăng nhập, trang lỗi): trả `markdown` rỗng.\n\n"
               f"<trang>\n{page_text[:150_000]}\n</trang>")
    schema = {"type": "object", "additionalProperties": False, "required": ["title", "markdown"],
              "properties": {"title": {"type": "string"}, "markdown": {"type": "string"}}}
    data = wiki.structured_call(SYSTEM, content, schema, max_tokens=32000, model=TEXT_MODEL)
    if on_usage:
        on_usage(data["usage"])
    return data
