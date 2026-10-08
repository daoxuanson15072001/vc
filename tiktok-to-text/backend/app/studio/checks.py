"""Kiểm tra tự động (không dùng AI) chạy trước giám khảo — BA mục 5.7–5.9. Mỗi mục: {key, label, ok, detail}."""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from ..db import unaccent
from .ai import CHANNELS

WORDS_PER_SEC = 3.2       # lời thoại tiếng Việt đọc thoải mái ≈ 2,5–3 từ/giây
HOOK_CHARS = 200          # phần mở đầu trước nút "xem thêm"
PARAGRAPH_CHARS = 350     # đoạn dài hơn khó đọc trên điện thoại
KEYWORD_DENSITY = 0.03    # từ khoá chính chiếm quá 3% số chữ -> coi là nhồi


def check(key: str, label: str, ok: bool, detail: str = "") -> dict:
    return {"key": key, "label": label, "ok": bool(ok), "detail": detail}


def words(text: str) -> int:
    return len(re.findall(r"\w+", text or ""))


def run(flow: str, content: dict, piece: dict, camp: dict) -> list[dict]:
    if flow == "video":
        return video_checks(content)
    if flow == "seo":
        return seo_checks(content, piece, camp)
    return social_checks(content, piece)


def video_checks(c: dict) -> list[dict]:
    voice = " ".join([(c.get("hook") or {}).get("voice", ""), *[s.get("voice", "") for s in c.get("scenes") or []],
                      (c.get("ending") or {}).get("voice", "")])
    dur = c.get("duration_sec") or 0
    rate = words(voice) / dur if dur else 0
    scenes = c.get("scenes") or []
    end = scenes[-1].get("end_sec", 0) if scenes else 0
    tags = len(c.get("hashtags") or [])
    return [
        check("speech_rate", f"Lời thoại đọc kịp thời lượng (≤ {WORDS_PER_SEC} từ/giây)", dur and rate <= WORDS_PER_SEC,
              f"{words(voice)} từ / {dur} giây = {rate:.1f} từ/giây"),
        check("timeline", "Phân cảnh bắt đầu từ 0 và phủ hết thời lượng",
              scenes and scenes[0].get("start_sec") == 0 and abs(end - dur) <= 3, f"cảnh cuối kết thúc ở {end}s"),
        check("caption", "Caption ≤ 150 ký tự", len(c.get("caption") or "") <= 150, f"{len(c.get('caption') or '')} ký tự"),
        check("hashtags", "5–8 hashtag", 5 <= tags <= 8, f"{tags} hashtag"),
    ]


# ---------------------------------------------------------------------------
# Bài SEO
# ---------------------------------------------------------------------------

def norm_url(u: str) -> str:
    return (u or "").strip().split("#")[0].rstrip("/").lower()


def heading_levels(body: str) -> list[int]:
    return [len(m.group(1)) for m in re.finditer(r"^(#{1,6})\s", body or "", re.M)]


def first_paragraph(body: str) -> str:
    for block in re.split(r"\n\s*\n", body or ""):
        b = block.strip()
        if b and not b.startswith(("#", "[ẢNH", "!")):
            return b
    return ""


def seo_checks(c: dict, piece: dict, camp: dict) -> list[dict]:
    body = c.get("body") or ""
    kw = unaccent(c.get("primary_keyword") or "").strip()
    has = lambda text: bool(kw) and kw in unaccent(text or "")   # noqa: E731
    title, desc, slug = c.get("meta_title") or "", c.get("meta_description") or "", c.get("slug") or ""
    levels = heading_levels(body)
    jumps = [f"H{a}→H{b}" for a, b in zip(levels, levels[1:]) if b > a + 1]
    h2s = re.findall(r"^##\s+(.+)$", body, re.M)
    n_words = words(body)
    kw_words = max(1, len(kw.split()))
    density = unaccent(body).count(kw) * kw_words / n_words if kw and n_words else 0
    target = (piece.get("outline") or {}).get("target_words") or piece["episode"].get("target_words") or 0
    images = c.get("images") or []
    seo = camp["brief"].get("seo") or {}
    allowed = {norm_url(u) for u in camp.get("site_urls") or []} | {norm_url(seo.get("landing_url"))}
    links = [lk.get("url") for lk in c.get("internal_links") or [] if lk.get("url")]
    unknown = [u for u in links if norm_url(u) not in allowed]
    out = [
        check("meta_title", "Meta title 30–60 ký tự", 30 <= len(title) <= 60, f"{len(title)} ký tự"),
        check("meta_description", "Meta description 70–160 ký tự", 70 <= len(desc) <= 160, f"{len(desc)} ký tự"),
        check("slug", "Slug chữ thường không dấu, nối bằng “-”, ≤ 75 ký tự",
              bool(re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug)) and len(slug) <= 75, slug),
        check("single_h1", "Chỉ một H1 (thân bài không có dòng #)", 1 not in levels),
        check("heading_order", "Heading không nhảy cấp, bắt đầu bằng H2",
              not jumps and (not levels or levels[0] == 2), ", ".join(jumps)),
        check("kw_title", "Từ khoá chính có trong meta title", has(title)),
        check("kw_h1", "Từ khoá chính có trong H1", has(c.get("h1"))),
        check("kw_slug", "Từ khoá chính có trong slug", bool(kw) and "-".join(re.findall(r"[a-z0-9]+", kw)) in slug),
        check("kw_intro", "Từ khoá chính có trong đoạn mở đầu", has(first_paragraph(body))),
        check("kw_h2", "Từ khoá chính có trong ít nhất một H2", any(has(h) for h in h2s)),
        check("kw_density", f"Không nhồi từ khoá (≤ {KEYWORD_DENSITY:.0%} số chữ)", density <= KEYWORD_DENSITY,
              f"{density:.1%}"),
        check("images_alt", "Có ảnh và mọi ảnh có alt", images and all((i.get("alt") or "").strip() for i in images),
              f"{len(images)} ảnh"),
        check("internal_links", "Ít nhất 2 link nội bộ", len(links) >= 2, f"{len(links)} link"),
    ]
    if allowed - {""}:   # chưa có sitemap / trang đích thì không đối chiếu được
        out.append(check("links_known", "Link nội bộ đều có trong sitemap / trang đích", not unknown,
                         ", ".join(unknown[:3])))
    if target:
        out.append(check("length", "Đủ ≥ 70% độ dài mục tiêu", n_words >= 0.7 * target, f"{n_words}/{target} chữ"))
    return out


def onpage_score(checks: list[dict], max_points: int = 10) -> int:
    return round(max_points * sum(c["ok"] for c in checks) / len(checks)) if checks else 0


# ---------------------------------------------------------------------------
# Bài mạng xã hội
# ---------------------------------------------------------------------------

def social_checks(c: dict, piece: dict) -> list[dict]:
    ch = piece["episode"].get("channel") or c.get("channel")
    spec = CHANNELS.get(ch) or CHANNELS["other"]
    hooks = c.get("hooks") or []
    full = ((hooks[0] if hooks else "") + "\n\n" + (c.get("body") or "")).strip()
    lo, hi = spec["hashtags"]
    tags = len(c.get("hashtags") or [])
    longest = max((len(p) for p in re.split(r"\n\s*\n", c.get("body") or "")), default=0)
    out = [
        check("hooks", "Đủ 3 phương án mở đầu", len(hooks) >= 3, f"{len(hooks)} phương án"),
        check("hook_len", f"Mở đầu ≤ {HOOK_CHARS} ký tự (hiện trước “xem thêm”)",
              hooks and all(len(h) <= HOOK_CHARS for h in hooks), ", ".join(str(len(h)) for h in hooks)),
        check("length", f"Độ dài hợp kênh {spec['label']} (≤ {spec['max_chars']:,} ký tự)".replace(",", "."),
              len(full) <= spec["max_chars"], f"{len(full)} ký tự"),
        check("hashtags", f"{lo}–{hi} hashtag", lo <= tags <= hi, f"{tags} hashtag"),
        check("paragraphs", f"Đoạn ngắn, đọc tốt trên điện thoại (≤ {PARAGRAPH_CHARS} ký tự/đoạn)",
              longest <= PARAGRAPH_CHARS, f"đoạn dài nhất {longest} ký tự"),
        check("no_url_in_body", "Không dán URL trần trong thân bài", not re.search(r"https?://", c.get("body") or "")),
    ]
    if spec["personal"]:
        out.append(check("author", "Có người đứng tên (kênh cá nhân)", bool((c.get("author") or piece["episode"].get("author") or "").strip())))
    return out


def utm_url(url: str, channel: str, campaign_slug: str, content: str) -> str:
    """Gắn UTM để vòng học đo được kênh nào dẫn khách về (BA mục 5.7). Giữ tham số sẵn có của link."""
    parts = urlsplit(url.strip())
    q = [(k, v) for k, v in parse_qsl(parts.query) if not k.startswith("utm_")]
    q += [("utm_source", (CHANNELS.get(channel) or CHANNELS["other"])["utm_source"]), ("utm_medium", "social"),
          ("utm_campaign", campaign_slug), ("utm_content", content)]
    return urlunsplit(parts._replace(query=urlencode(q)))
