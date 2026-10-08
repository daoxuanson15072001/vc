"""Hướng dẫn sử dụng (trang /guide) cho AI đọc — nguồn duy nhất là `frontend/src/pages/guide/content.js`.

Trang hướng dẫn là nội dung cho người; trợ lý AI trong app (chat) và AI ngoài (MCP `read_guide`) cũng cần đọc
để trả lời "làm thế nào để…" đúng như giao diện. Không chép sang file thứ hai (sẽ lệch), mà bóc thẳng từ content.js:
mỗi mục là một object { id, title, audience, links, body: `…` }; thân bài là template literal không có ${}.
Mục có thể kèm `snippets: [{ title: '…', text: ['dòng', …].join('\n') }]` (lời nhắn sao chép cho Claude — trang
/guide dựng khung + nút Sao chép): bóc thành [{title, text}] và nối vào cuối `body` để AI đọc được cùng mục.
Đọc lại khi file đổi (mtime).

Bản thuần văn bản cho AI không chạy JS (trang /guide là SPA, fetch chỉ thấy vỏ HTML): `GET /guide.md` (cả hướng dẫn),
`GET /guide/<id>.md` (một mục), `GET /api/guide` (mục lục JSON), `GET /api/guide/<id>` (một mục JSON). Không cần
đăng nhập — nội dung vốn nằm sẵn trong bundle JS công khai.
"""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from .config import ROOT_DIR

router = APIRouter()

GUIDE_PATH = ROOT_DIR / "frontend" / "src" / "pages" / "guide" / "content.js"

_SECTION = re.compile(
    r"\{\s*id: '(?P<id>[^']+)',\s*title: '(?P<title>[^']*)',\s*audience: \[(?P<audience>[^\]]*)\],"
    r"(?:\s*links: \[(?P<links>.*?)\],)?\s*body: `(?P<body>.*?)`,"
    r"(?:\s*snippets: \[(?P<snippets>.*?)\n    \],)?",
    re.S,
)
_STR = re.compile(r"'((?:[^'\\]|\\.)*)'")
_TO = re.compile(r"to: '([^']+)'")
_LABEL = re.compile(r"label: '([^']*)'")

# Trang không có nút mở trong `links` của mục nào, hoặc cần chỉ đúng mục hơn nút mở (đường dẫn + query)
PATH_HINTS = {
    "/wiki?card=": ["khung-the", "tim-doc"],
    "/wiki/review": ["duyet"],
    "/wiki/synth": ["dung-the"],
    "/kb/videos": ["nap-tu-lieu"],
    "/kb/channels": ["nap-tu-lieu"],
    "/learn/lessons": ["hoc-tap"],
    "/learn/attempts": ["hoc-tap"],
    "/learn/library": ["tao-khoa-hoc", "soan-khoa", "hoc-tap"],
    "/learn/paths": ["tao-khoa-hoc"],       # soan-khoa vào theo nút mở trang (xếp sau gợi ý)
    "/learn/design": ["tao-khoa-hoc"],       # soan-khoa vào theo nút mở trang
    "/learn/grading": ["soan-khoa", "tao-khoa-hoc"],
    "/studio/authors": ["viet-nhanh"],
    "/studio/facebook": ["dang-facebook"],
    "/studio/quick": ["viet-nhanh", "dang-facebook"],
    "/studio": ["du-an-marketing", "viet-nhanh"],
    "/org": ["quan-tri"],
    "/chat": ["claude"],
    "/": ["bat-dau"],
}

_cache: tuple[float, list[dict]] | None = None


def _snippets(src: str | None) -> list[dict]:
    """`snippets` của một mục: mỗi phần tử bắt đầu bằng `title:`; chuỗi đầu là tiêu đề, các chuỗi sau là dòng chữ."""
    out = []
    for part in re.split(r"\{\s*title:", src or "")[1:]:
        strs = [m.replace("\\'", "'").replace("\\n", "\n") for m in _STR.findall(part)]
        if strs:
            out.append({"title": strs[0], "text": "\n".join(strs[1:])})
    return out


def sections() -> list[dict]:
    """Mọi mục theo thứ tự trên trang: id, title, audience, links [{to, label}], body (markdown — mục có lời nhắn
    sao chép thì nối thêm các lời nhắn vào cuối), snippets [{title, text}]."""
    global _cache
    mtime = GUIDE_PATH.stat().st_mtime
    if _cache and _cache[0] == mtime:
        return _cache[1]
    text = GUIDE_PATH.read_text(encoding="utf-8")
    out = []
    for m in _SECTION.finditer(text):
        links_src = m.group("links") or ""
        tos, labels = _TO.findall(links_src), _LABEL.findall(links_src)
        snippets = _snippets(m.group("snippets"))
        body = m.group("body").strip()
        if snippets:
            body += "\n\n" + "\n\n".join(f"### {sn['title']}\n\n{sn['text']}" for sn in snippets)
        out.append({
            "id": m.group("id"), "title": m.group("title"),
            "audience": re.findall(r"'([^']+)'", m.group("audience")),
            "links": [{"to": t, "label": labels[i] if i < len(labels) else ""} for i, t in enumerate(tos)],
            "body": body, "snippets": snippets,
        })
    _cache = (mtime, out)
    return out


def toc() -> list[dict]:
    return [{"id": s["id"], "title": s["title"], "audience": s["audience"]} for s in sections()]


def section(key: str) -> dict | None:
    """Theo id (neo #id) hoặc chữ trong tiêu đề (không phân biệt dấu / hoa thường)."""
    from . import db
    key = (key or "").strip().lstrip("#")
    if not key:
        return None
    for s in sections():
        if s["id"] == key:
            return s
    k = db.unaccent(key)
    for s in sections():
        if k and k in db.unaccent(s["title"]):
            return s
    return None


def search(query: str, limit: int = 30) -> list[dict]:
    """Dòng chứa từ khoá (không phân biệt dấu) kèm mục chứa nó."""
    from . import db
    q = db.unaccent((query or "").strip())
    out = []
    if not q:
        return out
    for s in sections():
        for line in s["body"].splitlines():
            if q in db.unaccent(line):
                out.append({"section": s["id"], "title": s["title"], "line": line.strip()})
                if len(out) >= limit:
                    return out
    return out


def for_path(path: str | None, limit: int = 3) -> list[dict]:
    """Mục hướng dẫn liên quan tới trang người dùng đang mở (đường dẫn trong app, có thể kèm query).

    Ứng viên: PATH_HINTS (khớp cả phần query như `/wiki?card=`) và mục có nút mở trang trùng / là tiền tố của đường
    dẫn. Khớp dài hơn xếp trước; bằng nhau thì gợi ý trước nút mở, rồi theo thứ tự trên trang."""
    if not path:
        return []
    raw = path.strip()
    if raw.startswith("http"):
        u = urlsplit(raw)
        raw = u.path + (f"?{u.query}" if u.query else "")
    pathname = raw.split("?", 1)[0].split("#", 1)[0].rstrip("/") or "/"

    def hit(key: str) -> bool:
        if "?" in key:
            return raw.startswith(key)
        return pathname == key or (key != "/" and pathname.startswith(key + "/"))

    secs = sections()
    order = {s["id"]: i for i, s in enumerate(secs)}
    cands: list[tuple[int, int, int, str]] = []   # (-độ dài khớp, 0 gợi ý / 1 nút mở, thứ tự, id)
    for key, ids in PATH_HINTS.items():
        if hit(key):
            cands += [(-len(key), 0, order.get(sid, 999), sid) for sid in ids if sid in order]
    for s in secs:
        for l in s["links"]:
            if hit(l["to"]):
                cands.append((-len(l["to"]), 1, order[s["id"]], s["id"]))
    ids: list[str] = []
    for _, _, _, sid in sorted(cands):
        if sid not in ids:
            ids.append(sid)
    by_id = {s["id"]: s for s in secs}
    return [{"id": sid, "title": by_id[sid]["title"]} for sid in ids[:limit]]


# ---------------------------------------------------------------------------
# Bản Markdown tĩnh + JSON (AI đọc bằng HTTP thuần, không cần chạy JS)
# ---------------------------------------------------------------------------

AUDIENCE_VI = {"all": "Mọi người", "editor": "Người soạn thẻ", "reviewer": "Người duyệt", "learn": "Học tập",
               "admin": "Quản trị viên"}


def section_markdown(s: dict, level: int = 2) -> str:
    """Một mục thành Markdown: tiêu đề (neo /guide#id), nhóm người đọc, thân bài (đã nối lời nhắn sao chép),
    nút mở trang. Thân bài giữ nguyên markdown của content.js."""
    head = "#" * level
    lines = [f"{head} {s['title']}", "",
             f"Neo trong app: /guide#{s['id']} · Bản này: /guide/{s['id']}.md · "
             f"Dành cho: {', '.join(AUDIENCE_VI.get(a, a) for a in s['audience'])}", ""]
    body = s["body"]
    # lời nhắn sao chép đã nối vào body dạng "### Tiêu đề\n\n<chữ>": bọc phần chữ vào khối code để giữ nguyên xuống dòng
    if s.get("snippets"):
        base = body
        for sn in s["snippets"]:
            block = f"### {sn['title']}\n\n{sn['text']}"
            base = base.replace(block, f"### {sn['title']}\n\n```text\n{sn['text']}\n```")
        body = base
    lines += [body, ""]
    if s["links"]:
        lines += ["Mở trang: " + " · ".join(f"[{l['label']}]({l['to']})" for l in s["links"]), ""]
    return "\n".join(lines)


def markdown_all() -> str:
    secs = sections()
    out = ["# Hướng dẫn sử dụng VC Content Engine / VCWIKI", "",
           "Bản thuần văn bản của trang /guide (cùng nguồn `frontend/src/pages/guide/content.js`). "
           "Từng mục: /guide/<id>.md. Mục lục JSON: /api/guide.", "", "## Mục lục", ""]
    out += [f"- [{s['title']}](/guide/{s['id']}.md) — `{s['id']}`" for s in secs]
    out += [""]
    out += [section_markdown(s) for s in secs]
    return "\n".join(out)


def _md(text: str) -> PlainTextResponse:
    return PlainTextResponse(text, media_type="text/markdown; charset=utf-8")


@router.get("/guide.md", include_in_schema=False)
def guide_md():
    return _md(markdown_all())


@router.get("/guide/{section_id}.md", include_in_schema=False)
def guide_section_md(section_id: str):
    s = section(section_id)
    if not s:
        raise HTTPException(404, f"Không có mục '{section_id}' — xem mục lục ở /guide.md")
    return _md(section_markdown(s, level=1))


@router.get("/api/guide")
def guide_toc():
    """Mục lục hướng dẫn: id, tiêu đề, nhóm người đọc, đường .md từng mục."""
    return {"sections": [t | {"md": f"/guide/{t['id']}.md"} for t in toc()], "all_md": "/guide.md"}


@router.get("/api/guide/{section_id}")
def guide_section_json(section_id: str):
    s = section(section_id)
    if not s:
        raise HTTPException(404, f"Không có mục '{section_id}'")
    return {k: s[k] for k in ("id", "title", "audience", "links", "body", "snippets")} | {"md": f"/guide/{s['id']}.md"}
