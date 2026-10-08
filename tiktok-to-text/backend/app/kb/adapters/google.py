"""Link Google Docs / Sheets / Slides / file Drive — đọc qua link xuất công khai, không cần AI.

Chỉ đọc được tài liệu chia sẻ "Bất kỳ ai có đường liên kết". Tài liệu riêng tư: báo rõ cách mở quyền.
"""

from __future__ import annotations

import re
from typing import Iterator

import requests

from .base import Adapter, Context, ExtractedDoc
from .office import xlsx_docs, split_doc
from .web import UA, download, filename_from, route_file

PATTERNS = [
    (re.compile(r"docs\.google\.com/(document|spreadsheets|presentation)/(?:u/\d+/)?d/([\w-]{10,})"), None),
    (re.compile(r"drive\.google\.com/file/(?:u/\d+/)?d/([\w-]{10,})"), "file"),
    (re.compile(r"drive\.google\.com/(?:open|uc)\?(?:[^#]*&)?id=([\w-]{10,})"), "file"),
    (re.compile(r"drive\.google\.com/drive/(?:u/\d+/)?folders/([\w-]{10,})"), "folder"),
]
LABELS = {"document": "Google Docs", "spreadsheets": "Google Sheets", "presentation": "Google Slides",
          "file": "Google Drive", "folder": "Thư mục Drive"}
PRIVATE_MSG = ("Tài liệu chưa chia sẻ công khai. Mở tài liệu → Chia sẻ → Quyền truy cập chung: "
               "“Bất kỳ ai có đường liên kết” (Người xem), rồi bấm Xử lý lại")


def parse(url: str) -> tuple[str, str] | None:
    """-> (loại, mã file) hoặc None nếu không phải link Google Docs / Drive."""
    for rx, gtype in PATTERNS:
        if m := rx.search(url):
            return (gtype, m.group(1)) if gtype else (m.group(1), m.group(2))
    return None


def is_google(url: str) -> bool:
    return bool(re.match(r"https?://(docs|drive)\.google\.com/", url, re.I))


def export_url(gtype: str, gid: str, fmt: str = "") -> str:
    return {
        "document": f"https://docs.google.com/document/d/{gid}/export?format={fmt or 'md'}",
        "spreadsheets": f"https://docs.google.com/spreadsheets/d/{gid}/export?format=xlsx",
        "presentation": f"https://docs.google.com/presentation/d/{gid}/export/pdf",
        "file": f"https://drive.usercontent.google.com/download?id={gid}&export=download&confirm=t",
    }[gtype]


def check_access(url: str) -> str:
    """public | private | not_found | unsupported | unknown — gọi thử link xuất, không tải hết nội dung."""
    parsed = parse(url)
    if not parsed or parsed[0] == "folder":
        return "unsupported"
    try:
        res = requests.get(export_url(*parsed), headers={"User-Agent": UA}, timeout=10, stream=True)
        res.close()
    except requests.RequestException:
        return "unknown"
    if _is_login(res):
        return "private"
    if res.status_code == 404:
        return "not_found"
    return "public" if res.ok else "unknown"


def _is_login(res: requests.Response) -> bool:
    return (res.status_code in (401, 403) or "accounts.google.com" in res.url or "ServiceLogin" in res.url
            or any("accounts.google.com" in (r.headers.get("location") or "") for r in res.history))


class GoogleAdapter(Adapter):
    kind = "google"
    label = "Google Docs / Sheets / Slides / Drive"

    def match_url(self, url: str) -> bool:
        return is_google(url)

    def extract(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        parsed = parse(source["url"])
        if not parsed:
            raise ValueError("Loại link Google này chưa hỗ trợ (chỉ Docs, Sheets, Slides, file Drive)")
        gtype, gid = parsed
        if gtype == "folder":
            raise ValueError("Chưa nạp được cả thư mục Drive — hãy dán link từng file")
        ctx.log(f"{LABELS[gtype]} · mã {gid}")
        url = source["url"]
        if gtype == "document":
            yield from self._doc(gid, url, source.get("title"), ctx)
            return

        session = requests.Session()
        try:
            path, ctype, name = download(export_url(gtype, gid), ctx.raw_dir, ctx, session=session)
        except requests.HTTPError as e:
            raise ValueError(PRIVATE_MSG if _is_login(e.response) else f"Google trả lỗi {e.response.status_code}") from None
        if gtype == "file" and ctype == "text/html":
            path, ctype, name = self._confirm_large(path, session, ctx) or (path, ctype, name)
        if ctype == "text/html" and "accounts.google" in path.read_text(errors="ignore")[:20000]:
            raise ValueError(PRIVATE_MSG)
        title = source.get("title") or _title(name) or LABELS[gtype]
        if gtype == "spreadsheets":
            yield from xlsx_docs(path.rename(path.with_name("sheet.xlsx")), title, url, ctx, "google-export:xlsx")
        elif gtype == "presentation":
            for d in route_file(path.rename(path.with_name("slides.pdf")), "application/pdf", title, url, ctx):
                d.engine = "google-export:pdf + " + d.engine
                yield d
        else:
            yield from route_file(path, ctype, name or title, url, ctx)

    def _doc(self, gid: str, url: str, title: str | None, ctx: Context) -> Iterator[ExtractedDoc]:
        res = requests.get(export_url("document", gid, "md"), headers={"User-Agent": UA}, timeout=60)
        if _is_login(res):
            raise ValueError(PRIVATE_MSG)
        ctype = res.headers.get("content-type", "")
        if res.ok and "html" not in ctype:
            text, engine = clean_markdown(res.content.decode("utf-8", errors="replace")), "google-export:md"
            (ctx.raw_dir / "document.md").write_bytes(res.content)
        else:   # bản cũ không xuất được Markdown -> xuất HTML rồi lấy nội dung chính
            ctx.log("Không xuất được Markdown — thử HTML")
            res = requests.get(export_url("document", gid, "html"), headers={"User-Agent": UA}, timeout=60)
            if _is_login(res):
                raise ValueError(PRIVATE_MSG)
            res.raise_for_status()
            import trafilatura
            (ctx.raw_dir / "document.html").write_bytes(res.content)
            text = trafilatura.extract(res.text, output_format="markdown", include_tables=True,
                                       favor_recall=True) or ""
            engine = "google-export:html + trafilatura"
        title = title or _title(filename_from(res.headers.get("content-disposition", ""))) or "Google Docs"
        ctx.log(f"Lấy được {len(text)} ký tự")
        yield from split_doc("doc", title, text, url, engine)

    def _confirm_large(self, page, session: requests.Session, ctx: Context):
        """File Drive lớn: Google chèn trang 'không quét được virus' — gửi lại form xác nhận."""
        html = page.read_text(errors="ignore")
        if 'name="uuid"' not in html and "download-form" not in html:
            return None
        fields = dict(re.findall(r'name="(\w+)"\s+value="([^"]*)"', html))
        action = (re.search(r'action="([^"]+)"', html) or [None, "https://drive.usercontent.google.com/download"])[1]
        ctx.log("File Drive lớn — xác nhận tải")
        page.unlink(missing_ok=True)
        from urllib.parse import urlencode
        return download(f"{action.replace('&amp;', '&')}?{urlencode(fields)}", ctx.raw_dir, ctx, session=session)


def clean_markdown(md: str) -> str:
    """Markdown xuất từ Google Docs nhúng ảnh dạng base64 ở cuối — bỏ đi, chỉ giữ chỗ đánh dấu [Hình]."""
    md = re.sub(r"^\[image\d+\]:\s*<?data:image/[^\n]*$", "", md, flags=re.M)
    md = re.sub(r"!\[[^\]]*\]\[image\d+\]", "[Hình]", md)
    md = re.sub(r"!\[[^\]]*\]\(data:image/[^)]*\)", "[Hình]", md)
    return re.sub(r"\n{3,}", "\n\n", md).strip()


def _title(name: str | None) -> str | None:
    if not name:
        return None
    return re.sub(r"\.(md|html|xlsx|pdf|docx|pptx)$", "", name, flags=re.I)
