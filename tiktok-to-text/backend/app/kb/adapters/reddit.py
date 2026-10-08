"""Bài đăng Reddit: đọc qua API JSON công khai (trang HTML của Reddit chỉ là khung JavaScript, không có nội dung).

Được bộ đọc website gọi. Bài chữ -> nội dung bài + cây bình luận. Bài video -> thêm lời nói qua bộ đọc video (làn nặng).
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Iterator
from urllib.parse import urlsplit

import requests

from .base import Context, ExtractedDoc, MoveToHeavyLane

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")
POST = re.compile(r"^https?://(?:[\w-]+\.)?reddit\.com/(?:r|user|u)/[^/]+/(?:comments|s)/\w+|^https?://redd\.it/\w+", re.I)
MAX_COMMENTS = 200


def is_post(url: str) -> bool:
    return bool(POST.match(url or ""))


def extract(url: str, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
    post, comments = _fetch(url)
    # bài vừa có chữ vừa có video: chỉ lấy lời nói khi người dùng chọn nguồn loại "Video"
    has_video = post.get("is_video") or any(m.get("e") == "RedditVideo" for m in (post.get("media_metadata") or {}).values())
    video = has_video and (not (post.get("selftext") or "").strip() or source.get("kind") == "video")
    if video and ctx.lane != "heavy":
        raise MoveToHeavyLane
    link = "https://www.reddit.com" + post["permalink"]
    lines = [f"- {post.get('subreddit_name_prefixed')} · u/{post.get('author')}"
             + (f" · Đăng {_date(post['created_utc'])}" if post.get("created_utc") else ""),
             f"- Điểm: {post.get('score', 0)} · Bình luận: {post.get('num_comments', 0)}",
             f"- Link: {link}"]
    if post.get("url") and not post["url"].startswith(link) and not post.get("is_self"):
        lines.append(f"- Liên kết trong bài: {post['url']}")
    body = (post.get("selftext") or "").strip()
    tree = _comments(comments)
    text = "\n\n".join([f"# {post['title']}", "\n".join(lines), f"## Nội dung\n\n{body or '(không có chữ)'}",
                        f"## Bình luận\n\n{tree or '(chưa có)'}"])
    ctx.log(f"Reddit: bài {len(body)} ký tự, {tree.count('**u/')} bình luận")
    yield ExtractedDoc(key="page", title=post["title"][:200], text=text, url=link, engine="reddit-json",
                       meta={"platform": "Reddit", "subreddit": post.get("subreddit"), "author": post.get("author"),
                             "score": post.get("score"), "comments": post.get("num_comments")})
    if video:
        from .video import VideoAdapter
        yield from VideoAdapter().extract_videos(source | {"url": link}, ctx)


def _fetch(url: str) -> tuple[dict, list]:
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "en,vi;q=0.8"})
    s.cookies.set("over18", "1", domain=".reddit.com")
    s.get("https://old.reddit.com/", timeout=30)   # lấy cookie loid: không có thì API trả 403
    if "/s/" in url or "redd.it" in url:            # link chia sẻ / link ngắn -> link bài đầy đủ
        url = s.get(url, timeout=30).url
    parts = urlsplit(url)
    res = s.get(f"https://www.reddit.com{parts.path.rstrip('/')}/.json", params={"raw_json": 1, "limit": MAX_COMMENTS},
                timeout=60)
    if "json" not in res.headers.get("content-type", ""):
        raise ValueError(f"Reddit không trả dữ liệu (HTTP {res.status_code}) — có thể bị chặn IP hoặc bài riêng tư")
    data = res.json()
    if isinstance(data, dict) and data.get("error"):
        raise ValueError(f"Reddit từ chối: {data.get('reason') or data.get('error')}")
    return data[0]["data"]["children"][0]["data"], data[1]["data"]["children"]


def _comments(children: list, depth: int = 0) -> str:
    out = []
    for c in children:
        d = c.get("data") or {}
        if c.get("kind") != "t1" or d.get("body") in (None, "[deleted]", "[removed]"):
            continue
        quote = "> " * depth
        head = f"**u/{d.get('author')}** · {d.get('score', 0)} điểm"
        block = "\n".join(quote + ln if ln.strip() else quote.rstrip() for ln in [head, ""] + d["body"].strip().splitlines())
        out.append(block)
        if isinstance(d.get("replies"), dict):
            if sub := _comments(d["replies"]["data"]["children"], depth + 1):
                out.append(sub)
    return "\n\n".join(out)


def _date(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%d/%m/%Y")
