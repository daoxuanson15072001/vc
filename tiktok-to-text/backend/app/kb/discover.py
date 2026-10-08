"""Tìm video theo chủ đề: người dùng gõ một nội dung -> AI tách thành các từ khoá tìm kiếm -> tìm trên TikTok,
YouTube, Google -> người dùng chọn video -> nạp vào Kho tư liệu như link dán tay (tải + chuyển chữ).

Mỗi nền tảng tìm một cách, đều không cần đăng nhập:
- YouTube: ô tìm kiếm của YouTube qua yt-dlp (`ytsearchN:`), có sẵn lượt xem, độ dài, kênh.
- TikTok: TikTok chặn tìm kiếm tự động (trang /search trả rỗng với trình duyệt headless) -> tìm
  `site:tiktok.com` trên DuckDuckGo (gọi lần lượt, gọi dồn dập bị chặn), bị chặn thì Bing Video;
  chỉ giữ link dạng /@kenh/video/<id>.
- Google: có GOOGLE_CSE_KEY + GOOGLE_CSE_ID thì dùng Google Programmable Search (API chính thức); không thì
  Bing Video (Google trang thường bắt captcha). Chỉ giữ link yt-dlp tải được (YouTube, TikTok, Facebook…).
"""

from __future__ import annotations

import html
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs, unquote, urlparse

import yt_dlp
from curl_cffi import requests as cr
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from .. import db, policy
from ..auth import current_user
from ..config import GOOGLE_CSE_ID, GOOGLE_CSE_KEY, MAX_TARGETS
from . import local_ai, wiki
from .adapters import platform_of
from .pipeline import sources

router = APIRouter(prefix="/api/kb/discover")

PLATFORMS = {"tiktok": "TikTok", "youtube": "YouTube", "google": "Google"}
MAX_KEYWORDS = 10
TIMEOUT = 20
TIKTOK_VIDEO = re.compile(r"^https://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+")

KEYWORD_SYSTEM = """Bạn là chuyên viên nghiên cứu nội dung video. Người dùng mô tả điều họ muốn tìm (có thể kèm \
yêu cầu thao tác như "tìm trên YouTube", "lấy 5 video đầu"). Bạn:
1. Tách CHỦ ĐỀ cần tìm (`topic`) khỏi phần yêu cầu thao tác — chỉ giữ nội dung video.
2. Đọc nền tảng người dùng nêu (`platforms`: tiktok / youtube / google; không nêu thì mảng rỗng) và số video họ muốn \
lấy (`max_videos`; không nêu thì 0).
3. Viết các cụm từ khoá để gõ vào ô tìm kiếm, sao cho gom được nhiều video ĐÚNG chủ đề nhất.

Quy tắc từ khoá:
- Viết như người thật gõ tìm kiếm: ngắn (2–7 từ), không dấu câu, không toán tử, KHÔNG chứa chữ "tìm", "YouTube", \
"TikTok", "video", "link".
- Giữ nguyên tên riêng, mã model, mã đời xe / mã sản phẩm (vd "BMW X5 E70") trong phần lớn các cụm — đó là thứ lọc \
video đúng nhất.
- Chủ đề kỹ thuật (sửa chữa, phụ tùng, phần mềm…): thêm 2–3 cụm tiếng Anh dùng ĐÚNG thuật ngữ chuyên ngành \
(vd van nước dàn sưởi = "heater control valve"), vì video hướng dẫn tiếng Anh thường nhiều hơn.
- Từ viết tắt / tiếng lóng người dùng gõ mà bạn không chắc nghĩa: giữ nguyên trong một cụm, các cụm khác dùng tên đầy đủ.
- Phủ nhiều góc: tên gọi khác, triệu chứng / lỗi, cách làm, vị trí. Cụm đầu tiên sát ý người dùng nhất."""

KEYWORD_SCHEMA = {"type": "object", "additionalProperties": False,
                  "required": ["topic", "keywords", "platforms", "max_videos"],
                  "properties": {"topic": {"type": "string"},
                                 "keywords": {"type": "array", "items": {"type": "string"}},
                                 "platforms": {"type": "array", "items": {"type": "string", "enum": list(PLATFORMS)}},
                                 "max_videos": {"type": "integer"}}}

RANK_SYSTEM = """Bạn chấm mức liên quan giữa tiêu đề video và chủ đề người dùng cần tìm, thang 0–10:
10 = đúng chủ đề và đúng đối tượng (đúng xe / đời xe / sản phẩm); 7 = đúng chủ đề, đối tượng gần (đời khác cùng dòng);
4 = cùng lĩnh vực nhưng chủ đề khác; 0 = không liên quan. Tiêu đề có thể là tiếng Anh hoặc tiếng Việt."""

RANK_SCHEMA = {"type": "object", "additionalProperties": False, "required": ["scores"],
               "properties": {"scores": {"type": "array", "items": {
                   "type": "object", "additionalProperties": False, "required": ["index", "score"],
                   "properties": {"index": {"type": "integer"}, "score": {"type": "integer"}}}}}}
MAX_RANKED = 120


# ---------------------------------------------------------------------------
# Từ khoá & chấm độ liên quan
# ---------------------------------------------------------------------------

def _clean_kw(k: str) -> str:
    return re.sub(r"\s+", " ", k).strip(" \"'#.,")


def expand_keywords(query: str, n: int) -> dict:
    """Câu người dùng gõ -> {topic, keywords, platforms, max_videos, engine}. Không có AI thì dùng nguyên câu."""
    try:
        data = local_ai.structured_call(KEYWORD_SYSTEM, f"Người dùng gõ: {query}\n\nViết {n} cụm từ khoá.",
                                        KEYWORD_SCHEMA, max_tokens=2000)
    except wiki.AINotReady:
        return {"topic": query, "keywords": [query], "platforms": [], "max_videos": 0, "engine": None}
    seen: set[str] = set()
    keywords = []
    for k in map(_clean_kw, data["keywords"]):
        if k and k.lower() not in seen:
            seen.add(k.lower())
            keywords.append(k)
    return {"topic": data["topic"].strip() or query, "keywords": keywords[:n] or [query],
            "platforms": [p for p in dict.fromkeys(data["platforms"]) if p in PLATFORMS],
            "max_videos": max(0, min(int(data["max_videos"] or 0), MAX_TARGETS)),
            "engine": data["usage"].get("model")}


def rank(topic: str, items: list[dict]) -> str | None:
    """Gắn `relevance` (0–10) cho từng video theo tiêu đề. Không có AI thì bỏ qua (xếp theo số từ khoá khớp)."""
    batch = items[:MAX_RANKED]
    lines = "\n".join(f"{i}. {(it['title'] or '')[:200]} — kênh {it['channel'] or '?'}" for i, it in enumerate(batch))
    try:
        data = local_ai.structured_call(RANK_SYSTEM, f"Chủ đề cần tìm: {topic}\n\nCác video:\n{lines}\n\n"
                                                     f"Chấm điểm từng video, `index` là số thứ tự ở đầu dòng.",
                                        RANK_SCHEMA, max_tokens=8000)
    except (wiki.AINotReady, wiki.AIRetryLater, ValueError):
        return None
    for s_ in data["scores"]:
        if 0 <= s_["index"] < len(batch):
            batch[s_["index"]]["relevance"] = max(0, min(10, s_["score"]))
    return data["usage"].get("model")


# ---------------------------------------------------------------------------
# Tìm trên từng nền tảng — mỗi hàm trả [{url, title, channel, channel_url, views, duration, thumbnail}]
# ---------------------------------------------------------------------------

def _session() -> cr.Session:
    return cr.Session(impersonate="chrome", timeout=TIMEOUT)


def search_youtube(keyword: str, limit: int) -> list[dict]:
    opts = {"quiet": True, "no_warnings": True, "extract_flat": "in_playlist", "skip_download": True}
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{limit}:{keyword}", download=False)
    out = []
    for e in info.get("entries") or []:
        if not e or not e.get("id"):
            continue
        thumbs = e.get("thumbnails") or []
        channel_url = e.get("channel_url") or e.get("uploader_url") or (
            f"https://www.youtube.com/channel/{e['channel_id']}" if e.get("channel_id") else None)
        out.append({"url": f"https://www.youtube.com/watch?v={e['id']}", "title": e.get("title"),
                    "channel": e.get("channel") or e.get("uploader"), "channel_url": channel_url,
                    "views": e.get("view_count"),
                    "duration": e.get("duration"), "thumbnail": thumbs[-1]["url"] if thumbs else None})
    return out


_ddg_lock = threading.Lock()
_ddg_last = 0.0
DDG_GAP = 1.5   # giây giữa hai lượt tìm DuckDuckGo


class Blocked(RuntimeError):
    pass


def _ddg(query: str) -> list[tuple[str, str]]:
    """DuckDuckGo bản HTML (không cần JS) -> [(link, tiêu đề)]."""
    global _ddg_last
    with _ddg_lock:
        time.sleep(max(0.0, _ddg_last + DDG_GAP - time.time()))
        _ddg_last = time.time()
    res = _session().get("https://html.duckduckgo.com/html/", params={"q": query, "kl": "vn-vi"})
    res.raise_for_status()
    rows = []
    for href, title in re.findall(r'class="result__a" href="([^"]+)"[^>]*>(.*?)</a>', res.text, re.S):
        link = parse_qs(urlparse(html.unescape(href)).query).get("uddg", [html.unescape(href)])[0]
        rows.append((unquote(link), html.unescape(re.sub(r"<[^>]+>", "", title)).strip()))
    if not rows and "anomaly" in res.text:
        raise Blocked("DuckDuckGo tạm chặn vì tìm quá nhiều")
    return rows


def search_tiktok(keyword: str, limit: int) -> list[dict]:
    try:
        rows = [{"url": link.split("?")[0], "title": re.sub(r"\s*\|\s*TikTok$", "", title), "duration": None,
                 "thumbnail": None} for link, title in _ddg(f"site:tiktok.com {keyword}")]
    except Blocked:
        rows = [r | {"url": r["url"].split("?")[0]} for r in _bing_videos(f"{keyword} tiktok")]
    out = []
    for r in rows:
        if TIKTOK_VIDEO.match(r["url"]):
            out.append(r | {"channel": re.search(r"/@([\w.-]+)/", r["url"])[1], "views": None})
    return out[:limit]


def _clock(text: str | None) -> int | None:
    """'1:02:03' / '05:12' -> giây."""
    if not text or not re.fullmatch(r"[\d:]+", text):
        return None
    sec = 0
    for part in text.split(":"):
        sec = sec * 60 + int(part)
    return sec


def _bing_videos(query: str) -> list[dict]:
    res = _session().get("https://www.bing.com/videos/search", params={"q": query, "setlang": "vi"})
    res.raise_for_status()
    rows = []
    for raw in re.findall(r'vrhm="([^"]+)"', res.text):
        try:
            v = json.loads(html.unescape(raw))
        except ValueError:
            continue
        if url := v.get("pgurl") or v.get("murl"):
            # purl chứa link kênh (churl) của video YouTube
            churl = parse_qs(urlparse(html.unescape(v.get("purl") or "")).query).get("churl", [None])[0]
            name = ((v.get("capt") or {}).get("crtnamemore") or "").removesuffix(" video khác").strip() or None
            rows.append({"url": url, "title": v.get("vt"), "channel": name, "channel_url": churl,
                         "duration": _clock(v.get("du")), "thumbnail": v.get("smturl")})
    return rows


def search_google(keyword: str, limit: int) -> list[dict]:
    if GOOGLE_CSE_KEY and GOOGLE_CSE_ID:
        res = _session().get("https://www.googleapis.com/customsearch/v1",
                             params={"key": GOOGLE_CSE_KEY, "cx": GOOGLE_CSE_ID, "q": f"{keyword} video",
                                     "num": min(limit * 2, 10), "hl": "vi"})
        res.raise_for_status()
        rows = [{"url": it["link"], "title": it.get("title"), "channel": it.get("displayLink"),
                 "thumbnail": ((it.get("pagemap") or {}).get("cse_thumbnail") or [{}])[0].get("src")}
                for it in res.json().get("items") or []]
    else:
        rows = _bing_videos(keyword)
    out = []
    for r in rows:
        if r["url"] and platform_of(r["url"]):
            out.append({"views": None, "duration": None} | r)
    return out[:limit]


SEARCHERS = {"tiktok": search_tiktok, "youtube": search_youtube, "google": search_google}


def channel_of(url: str, given: str | None = None) -> str | None:
    """Link kênh chứa video — dùng khi người dùng chọn crawl cả kênh."""
    if m := re.match(r"https://(?:www\.)?tiktok\.com/(@[\w.-]+)/video/", url):
        return f"https://www.tiktok.com/{m[1]}"
    return given if given and given.startswith("http") and platform_of(given) else None


def canonical(url: str) -> str:
    """Một video tìm thấy từ nhiều nơi (YouTube + Google) -> cùng một khoá."""
    u = urlparse(url)
    host = u.netloc.lower().removeprefix("www.").removeprefix("m.")
    if host in ("youtube.com", "youtu.be"):
        vid = parse_qs(u.query).get("v", [None])[0] if host == "youtube.com" else u.path.strip("/")
        if not vid and (m := re.match(r"/shorts/([\w-]{11})", u.path)):
            vid = m[1]
        if vid:
            return f"https://www.youtube.com/watch?v={vid}"
    if host == "tiktok.com":
        return f"https://www.tiktok.com{u.path.rstrip('/')}"
    return url


def search(keywords: list[str], platforms: list[str], per_keyword: int, user: dict, topic: str = "") -> dict:
    """Tìm song song mọi cặp (từ khoá, nền tảng), gộp trùng, AI chấm độ liên quan theo `topic`; video liên quan
    nhất, khớp nhiều từ khoá, đứng cao trong kết quả tìm kiếm lên đầu."""
    jobs = [(k, p) for k in keywords for p in platforms]
    errors: dict[str, str] = {}

    def run(job):
        kw, plat = job
        try:
            return job, SEARCHERS[plat](kw, per_keyword)
        except Exception as e:  # noqa: BLE001 — một nền tảng lỗi vẫn trả kết quả nền tảng khác
            errors.setdefault(plat, str(e)[:200])
            return job, []

    merged: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for (kw, plat), rows in pool.map(run, jobs):
            for pos, r in enumerate(rows):
                key = canonical(r["url"])
                item = merged.setdefault(key, {
                    "url": key, "platform": platform_of(key), "title": r.get("title"), "channel": r.get("channel"),
                    "channel_url": None, "views": None, "duration": None, "thumbnail": None, "keywords": [], "found_on": [], "rank": pos, "relevance": None})
                for f in ("title", "channel", "views", "duration", "thumbnail"):
                    item[f] = item[f] or r.get(f)
                item["channel_url"] = item["channel_url"] or channel_of(key, r.get("channel_url"))
                item["rank"] = min(item["rank"], pos)
                if kw not in item["keywords"]:
                    item["keywords"].append(kw)
                if PLATFORMS[plat] not in item["found_on"]:
                    item["found_on"].append(PLATFORMS[plat])

    items = list(merged.values())
    _mark_known(items, user)
    items.sort(key=lambda x: (-len(x["keywords"]) - len(x["found_on"]), x["rank"], -(x["views"] or 0)))
    ranked_by = rank(topic, items) if topic and items else None
    items.sort(key=lambda x: (-(x["relevance"] if x["relevance"] is not None else -1),
                              -len(x["keywords"]) - len(x["found_on"]), x["rank"], -(x["views"] or 0)))
    return {"items": items, "errors": errors, "ranked_by": ranked_by}


def _mark_known(items: list[dict], user: dict) -> None:
    """Đánh dấu video đã có trong kho (đã chuyển chữ, hoặc đã nạp link) để người dùng khỏi tải lại."""
    urls = [i["url"] for i in items] + [i["channel_url"] for i in items if i["channel_url"]]
    done = {v["url"] for v in db.videos.find({"url": {"$in": urls}, "status": {"$in": ["ok", "no_speech"]}},
                                             {"url": 1})}
    queued = {s["url"] for s in sources.find({"url": {"$in": urls}} | policy.visible_filter(user, "source"), {"url": 1})}
    for i in items:
        i["in_kb"] = "done" if i["url"] in done else "added" if i["url"] in queued else None
        i["channel_in_kb"] = bool(i["channel_url"] and i["channel_url"] in queued)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

class KeywordsIn(BaseModel):
    query: str = Field(min_length=2, max_length=500)
    count: int = Field(6, ge=1, le=MAX_KEYWORDS)


@router.post("/keywords")
def keywords(body: KeywordsIn, _user: dict = Depends(current_user)):
    try:
        return expand_keywords(body.query.strip(), body.count)
    except (wiki.AIRetryLater, ValueError) as e:
        raise HTTPException(503, f"AI chưa phân tích được: {e}") from e


class SearchIn(BaseModel):
    topic: str = Field("", max_length=500)   # chủ đề để AI chấm độ liên quan; rỗng = không chấm
    keywords: list[str]
    platforms: list[str] = list(PLATFORMS)
    per_keyword: int = Field(5, ge=1, le=20)

    @field_validator("keywords")
    @classmethod
    def clean_keywords(cls, v: list[str]) -> list[str]:
        v = list(dict.fromkeys(k.strip() for k in v if k.strip()))
        if not v:
            raise ValueError("Cần ít nhất một từ khoá")
        if len(v) > MAX_KEYWORDS * 2:
            raise ValueError(f"Tối đa {MAX_KEYWORDS * 2} từ khoá mỗi lần tìm")
        return v

    @field_validator("platforms")
    @classmethod
    def clean_platforms(cls, v: list[str]) -> list[str]:
        v = [p for p in dict.fromkeys(v) if p in PLATFORMS]
        if not v:
            raise ValueError("Chọn ít nhất một nền tảng")
        return v


@router.post("/search")
def search_videos(body: SearchIn, user: dict = Depends(current_user)):
    return search(body.keywords, body.platforms, body.per_keyword, user, body.topic.strip()) | {
        "max_links": MAX_TARGETS, "google_via": "Google Search API" if GOOGLE_CSE_KEY and GOOGLE_CSE_ID else "Bing Video"}
