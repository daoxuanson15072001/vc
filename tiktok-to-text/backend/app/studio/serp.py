"""Luồng SEO: tải trang đối thủ (link top Google người dùng dán vào — không tự crawl Google) và sitemap website."""

from __future__ import annotations

import re

import requests
import trafilatura

from ..config import STUDIO_MAX_SITE_URLS
from ..kb.adapters.web import UA

PAGE_CHARS = 15_000
HEADERS = {"User-Agent": UA, "Accept-Language": "vi,en;q=0.8"}


def fetch_page(url: str) -> dict:
    """-> {status, title, words, headings, text} ; lỗi thì {status: 'error', error}."""
    try:
        res = requests.get(url, headers=HEADERS, timeout=30)
        res.raise_for_status()
        html = res.text
        text = trafilatura.extract(html, url=url, output_format="markdown", include_tables=True,
                                   favor_recall=True) or ""
        meta = trafilatura.extract_metadata(html, default_url=url)
    except Exception as e:  # noqa: BLE001 — một trang lỗi không làm hỏng chiến dịch
        return {"status": "error", "error": str(e)[:200]}
    if len(text) < 200:
        return {"status": "error", "error": "Trang gần như không có nội dung (có thể cần JavaScript / đăng nhập)"}
    return {"status": "ok", "title": (meta.title if meta else None) or url, "words": len(re.findall(r"\w+", text)),
            "headings": [h.strip() for h in re.findall(r"^#{1,4}\s.+$", text, re.M)][:60], "text": text[:PAGE_CHARS],
            "error": None}


def fetch_sitemap(url: str, limit: int = STUDIO_MAX_SITE_URLS) -> list[str]:
    """Đọc sitemap.xml (kể cả sitemap index, tối đa 10 sitemap con)."""
    def locs(u: str) -> list[str]:
        res = requests.get(u, headers=HEADERS, timeout=30)
        res.raise_for_status()
        return [x.strip() for x in re.findall(r"<loc>\s*(.*?)\s*</loc>", res.text, re.S)]

    found = locs(url)
    children = [u for u in found if u.lower().split("?")[0].endswith(".xml")]
    urls = [u for u in found if u not in children]
    for child in children[:10]:
        if len(urls) >= limit:
            break
        try:
            urls += locs(child)
        except requests.RequestException:
            continue
    return list(dict.fromkeys(urls))[:limit]
