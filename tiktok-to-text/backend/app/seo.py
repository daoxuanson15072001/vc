"""Vỏ SEO phía BE (DESIGN Phần VI mục 3, Phần V mục 9.1 — đợt UI-1).

- SEO-01 `GET /robots.txt`: công khai (middleware `require_login` chỉ chặn `/api/*`), cho bot vào các trang công khai
  (`/guide`, `/p/`, `/llms.txt`, `/sitemap.xml`), chặn API, MCP và mọi trang sau đăng nhập.
- SEO-03 301 cho link cũ: `/videos` → `/kb/videos`, `/channels` → `/kb/channels`, `/jobs`, `/jobs/*` → `/kb`,
  `/learn/paths` → `/learn/library?tab=paths`, giữ query
  query. `Navigate` phía FE vẫn giữ làm dự phòng khi chạy vite dev.
- SEO-02 404 thật: `spa_response()` cho route trang cuối cùng (`main.py` `spa()`): file tĩnh trong `dist/` → trả
  file; đường dẫn khớp mẫu trong `dist/routes.json` (build FE xuất từ `frontend/src/routes.js`) → `index.html`;
  còn lại → 404 kèm HTML ngắn. Thiếu `routes.json` (bản build cũ) → giữ hành vi cũ (200 `index.html`) + cảnh báo log.

Router này không phụ thuộc `dist/`: robots và 301 chạy cả khi chưa build FE.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse, RedirectResponse, Response

from .config import FRONTEND_DIST

logger = logging.getLogger(__name__)

router = APIRouter(include_in_schema=False)

# ---------------------------------------------------------------------------
# SEO-01 robots.txt
# ---------------------------------------------------------------------------

# Allow cụ thể đặt trước `Disallow: /` — bot đọc theo luật dài nhất / đầu tiên đều hiểu đúng
ROBOTS_TXT = """User-agent: *
Allow: /guide
Allow: /p/
Allow: /llms.txt
Allow: /sitemap.xml
Disallow: /api/
Disallow: /mcp
Disallow: /
"""


@router.get("/robots.txt")
def robots_txt():
    return PlainTextResponse(ROBOTS_TXT)


# ---------------------------------------------------------------------------
# SEO-03 301 cho link cũ (giữ query)
# ---------------------------------------------------------------------------

def _moved(request: Request, target: str) -> RedirectResponse:
    q = request.url.query
    if q:
        target = f"{target}{'&' if '?' in target else '?'}{q}"
    return RedirectResponse(target, status_code=301)


@router.get("/videos")
def old_videos(request: Request):
    return _moved(request, "/kb/videos")


@router.get("/channels")
def old_channels(request: Request):
    return _moved(request, "/kb/channels")


@router.get("/jobs")
@router.get("/jobs/{rest:path}")
def old_jobs(request: Request, rest: str = ""):
    return _moved(request, "/kb")


@router.get("/learn/paths")
def old_learn_paths(request: Request):
    return _moved(request, "/learn/library?tab=paths")


# ---------------------------------------------------------------------------
# SEO-02 404 thật: đối chiếu đường dẫn với dist/routes.json
# ---------------------------------------------------------------------------

_cache: dict = {"file": None, "mtime": None, "patterns": []}
_warned = {"missing": False}


def _compile(route_path: str) -> re.Pattern:
    """Mẫu react-router (`/studio/:id`) → regex khớp nguyên đường dẫn, cho phép `/` cuối."""
    parts = []
    for seg in route_path.strip("/").split("/"):
        if not seg:
            continue
        if seg == "*":                       # splat của react-router: khớp phần còn lại
            parts.append(".*")
        elif seg.startswith(":"):
            parts.append("[^/]+")
        else:
            parts.append(re.escape(seg))
    body = "/".join(parts)
    return re.compile(f"^/{body}/?$" if body else r"^/$")


def load_patterns(dist: Path | None = None) -> list[re.Pattern] | None:
    """Danh sách regex từ `routes.json` (cache theo mtime). None khi không có file hoặc file hỏng."""
    f = (dist or FRONTEND_DIST) / "routes.json"
    try:
        mtime = f.stat().st_mtime
    except OSError:
        return None
    if _cache["file"] == f and _cache["mtime"] == mtime:
        return _cache["patterns"]
    try:
        rows = json.loads(f.read_text(encoding="utf-8"))
        patterns = [_compile(r["path"]) for r in rows if isinstance(r, dict) and isinstance(r.get("path"), str)]
    except (OSError, ValueError) as e:
        logger.warning("routes.json đọc lỗi (%s) — tạm trả index.html cho mọi đường dẫn", e)
        return None
    _cache.update(file=f, mtime=mtime, patterns=patterns)
    return patterns


def is_app_path(path: str, dist: Path | None = None) -> bool | None:
    """True: đường dẫn là trang của app; False: không có trang này; None: không có routes.json (không biết)."""
    patterns = load_patterns(dist)
    if patterns is None:
        return None
    p = "/" + path.lstrip("/")
    return any(rx.match(p) for rx in patterns)


NOT_FOUND_HTML = """<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Không tìm thấy trang · VC Content Engine</title>
<style>
:root { --bg: #ffffff; --text: #1f2328; --muted: #57606a; --primary: #c81e4a; color-scheme: light dark; }
@media (prefers-color-scheme: dark) { :root { --bg: #16181d; --text: #e6e8eb; --muted: #a0a7b1; --primary: #ff5c80; } }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text);
  font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 32rem; padding: 2rem 1rem; text-align: center; }
h1 { margin: 0 0 .5rem; font-size: 1.75rem; }
p { margin: 0 0 1.5rem; color: var(--muted); }
a { color: var(--primary); font-weight: 600; }
a:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
</style>
</head>
<body>
<main>
<h1>Không tìm thấy trang</h1>
<p>Đường dẫn này không có trong VC Content Engine — có thể trang đã đổi chỗ hoặc gõ nhầm địa chỉ.</p>
<a href="/">Về trang đầu</a>
</main>
</body>
</html>
"""


def not_found_page() -> HTMLResponse:
    return HTMLResponse(NOT_FOUND_HTML, status_code=404)


def _static_file(dist: Path, path: str) -> Path | None:
    """File thật trong dist (favicon, og.png, routes.json…); chặn path traversal bằng resolve + kiểm nằm trong dist."""
    if not path:
        return None
    root = dist.resolve()
    try:
        f = (root / path).resolve()
    except (OSError, ValueError):
        return None
    if f != root and root in f.parents and f.is_file():
        return f
    return None


def spa_response(path: str, dist: Path | None = None) -> Response:
    """Route trang cuối cùng: file tĩnh → file; trang app → index.html; lạ → 404; thiếu routes.json → index.html."""
    dist = dist or FRONTEND_DIST
    f = _static_file(dist, path)
    if f:
        return FileResponse(f)
    known = is_app_path(path, dist)
    if known is False:
        return not_found_page()
    if known is None and not _warned["missing"]:
        _warned["missing"] = True
        logger.warning("Không thấy %s — bản build FE cũ, mọi đường dẫn lạ vẫn trả 200 (SEO-02 chưa bật)",
                       dist / "routes.json")
    return FileResponse(dist / "index.html")
