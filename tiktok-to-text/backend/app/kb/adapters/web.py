"""Link website bất kỳ: crawl về rồi giữ nội dung chính (bỏ menu, quảng cáo, bình luận).

Link thực chất trỏ tới file (PDF, ảnh, Word, ghi âm, video…) thì chuyển sang bộ đọc tương ứng.
"""

from __future__ import annotations

import mimetypes
import re
from pathlib import Path
from typing import Iterator
from urllib.parse import unquote

import requests
import trafilatura
from curl_cffi import requests as cr

from ...config import MAX_UPLOAD_MB, UPLOAD_LIMIT_MB
from .. import ai_text
from . import reddit
from .base import Adapter, Context, ExtractedDoc, MoveToHeavyLane

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")
MIN_ARTICLE_CHARS = 300
# Mã lỗi tường chặn bot (Akamai, Cloudflare…) hay trả — thử lại bằng dấu vân tay TLS của trình duyệt thật
BOT_BLOCK_CODES = {403, 429, 503}
OFFICE_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
}


class WebAdapter(Adapter):
    kind = "web"
    label = "Link website"

    def match_url(self, url: str) -> bool:
        return url.startswith(("http://", "https://"))

    def extract(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        url = source["url"]
        if reddit.is_post(url):
            yield from reddit.extract(url, source, ctx)
            return
        path, ctype, name = download(url, ctx.raw_dir, ctx)
        yield from route_file(path, ctype, source.get("title") or name, url, ctx)


def download(url: str, raw_dir: Path, ctx: Context, session: requests.Session | None = None,
             headers: dict | None = None) -> tuple[Path, str, str | None]:
    """Tải về đĩa theo từng khúc. -> (đường dẫn, content-type, tên file gợi ý)."""
    http = session or requests
    res = http.get(url, headers={"User-Agent": UA, "Accept-Language": "vi,en;q=0.8"} | (headers or {}),
                   timeout=60, stream=True)
    if session is None and res.status_code in BOT_BLOCK_CODES:
        ctx.log(f"⚠ Trang chặn ({res.status_code}) — thử lại giả lập trình duyệt")
        res.close()
        res = cr.get(url, headers={"Accept-Language": "vi,en;q=0.8"} | (headers or {}),
                     impersonate="chrome", timeout=60, stream=True)
    res.raise_for_status()
    ctype = res.headers.get("content-type", "").split(";")[0].strip().lower()
    name = filename_from(res.headers.get("content-disposition", "")) or _name_from_url(res.url)
    media = ctype.startswith(("audio/", "video/")) or Path(name or "").suffix.lower() in _media_exts()
    limit_mb = UPLOAD_LIMIT_MB["video_file"] if media else MAX_UPLOAD_MB
    ext = Path(name).suffix.lower() if name and Path(name).suffix else (mimetypes.guess_extension(ctype) or "")
    path = raw_dir / ("page.html" if ctype in ("text/html", "application/xhtml+xml") else f"download{ext}")
    size = 0
    with path.open("wb") as f:
        for chunk in res.iter_content(1024 * 1024):
            size += len(chunk)
            if size > limit_mb * 1024 * 1024:
                f.close()
                path.unlink(missing_ok=True)
                raise ValueError(f"Nội dung quá {limit_mb} MB")
            if ctx.cancelled():
                break
            f.write(chunk)
    ctx.log(f"Đã tải {size / 1048576:.1f} MB ({ctype or 'không rõ loại'})")
    return path, ctype, name


def route_file(path: Path, ctype: str, title: str | None, url: str, ctx: Context) -> Iterator[ExtractedDoc]:
    """Chọn bộ đọc theo nội dung thật của file đã tải."""
    from .audio import AUDIO_EXTS, VIDEO_EXTS, media_docs
    from .image import ImageAdapter
    from .office import office_docs
    from .pdf import extract_pdf

    ext = path.suffix.lower()
    head = path.read_bytes()[:5] if path.exists() else b""
    title = title or url
    if ctype == "application/pdf" or head == b"%PDF-":
        ctx.log("Nội dung là file PDF")
        yield from extract_pdf(path, _stem(title), ctx)
    elif ctype.startswith("image/"):
        ctx.log("Nội dung là hình ảnh")
        yield from ImageAdapter().extract({"file": {"stored_name": path.name}, "title": _stem(title), "url": url}, ctx)
    elif ctype in OFFICE_TYPES or ext in OFFICE_TYPES.values():
        if ext not in OFFICE_TYPES.values():
            path = path.rename(path.with_suffix(OFFICE_TYPES[ctype]))
        ctx.log("Nội dung là file Office")
        yield from office_docs(path, _stem(title), url, ctx)
    elif ctype.startswith(("audio/", "video/")) or ext in AUDIO_EXTS + VIDEO_EXTS:
        if ctx.lane != "heavy":
            raise MoveToHeavyLane
        video = ctype.startswith("video/") or ext in VIDEO_EXTS
        ctx.log("Nội dung là " + ("video" if video else "ghi âm"))
        yield from media_docs(path, _stem(title), url, ctx, video=video)
    elif ctype in ("text/plain", "text/markdown"):
        text = path.read_text(encoding="utf-8", errors="replace")
        yield ExtractedDoc(key="text", title=title, text=text, url=url, engine="text")
    else:
        yield from article(path.read_bytes(), url, title if title != url else None, ctx)


def article(body: bytes, url: str, title: str | None, ctx: Context) -> Iterator[ExtractedDoc]:
    html = body.decode("utf-8", errors="replace")
    text = trafilatura.extract(html, url=url, output_format="markdown", include_tables=True,
                               include_links=False, favor_recall=True) or ""
    meta = trafilatura.extract_metadata(html, default_url=url)
    info = {k: getattr(meta, k, None) for k in ("title", "author", "date", "sitename", "description")} if meta else {}
    engine = "trafilatura"
    if len(text) < MIN_ARTICLE_CHARS:
        ctx.log(f"⚠ Chỉ lấy được {len(text)} ký tự nội dung chính")
        if ai_text.ready():
            try:
                res = ai_text.clean_article(trafilatura.html2txt(html) or "", url)
                if len(res["markdown"]) > len(text):
                    text, engine = res["markdown"], ai_text.ENGINE
                    info["title"] = info.get("title") or res["title"]
                    ctx.log(f"Claude tách được {len(text)} ký tự nội dung chính")
            except Exception as e:  # noqa: BLE001
                ctx.log(f"⚠ Claude không tách được nội dung ({str(e)[:150]})")
        if len(text) < MIN_ARTICLE_CHARS:
            ctx.log("⚠ Trang ít nội dung — có thể cần đăng nhập hoặc chạy JavaScript. "
                    "Bài đăng Facebook / LinkedIn: chụp màn hình rồi nạp dạng ảnh")
    ctx.log(f"Trích được {len(text)} ký tự")
    header = [f"# {info.get('title') or title or url}"]
    byline = " · ".join(str(info[k]) for k in ("sitename", "author", "date") if info.get(k))
    if byline:
        header.append(f"> {byline}")
    body_md = "\n\n".join(header) + "\n\n" + text if text else ""
    yield ExtractedDoc(key="page", title=title or info.get("title") or url, text=body_md, url=url, engine=engine,
                       meta={k: v for k, v in info.items() if v})


def filename_from(disposition: str) -> str | None:
    if m := re.search(r"filename\*=UTF-8''([^;]+)", disposition, re.I):
        return unquote(m.group(1).strip().strip('"'))
    if m := re.search(r'filename="?([^";]+)"?', disposition, re.I):
        return m.group(1).strip()
    return None


def _name_from_url(url: str) -> str | None:
    last = unquote(url.split("?")[0].rstrip("/").rsplit("/", 1)[-1])
    return last if "." in last else None


def _stem(name: str) -> str:
    return Path(name).stem if Path(name).suffix and len(Path(name).suffix) <= 5 else name


def _media_exts() -> tuple[str, ...]:
    from .audio import AUDIO_EXTS, VIDEO_EXTS
    return AUDIO_EXTS + VIDEO_EXTS
