"""Viết nhanh — một nội dung marketing từ một form ngắn, không cần lập chiến dịch (Content Engine, BA mục 5.11).

  loại nội dung (TYPES) + đầu vào ──AI viết──► kiểm tra tự động ──giám khảo (tuỳ chọn, thang 100)──► < ngưỡng thì sửa
  Cùng lõi với Xưởng chiến dịch: structured_call, thẻ VCWIKI làm căn cứ (K…), người đứng tên (A…), giám khảo ai.RUBRICS.

Mỗi loại khai báo: ô nhập (`fields`, giao diện dựng form từ đây), schema đầu ra, nhiệm vụ cho AI, thang chấm, kiểm tra
tự động, cách hiển thị (`sections`) và văn bản để sao chép (`text_of`). Thêm loại mới chỉ cần thêm một mục ở TYPES.
"""

from __future__ import annotations

import re

from ..config import STUDIO_MODEL
from ..kb.wiki import structured_call
from . import ai, checks
from .ai import CHANNELS, I, S, STRS, arr, dump, obj

GROUPS = {
    "social": "Mạng xã hội",
    "video": "Video ngắn",
    "seo": "SEO & website",
    "ads": "Quảng cáo & email",
    "ideas": "Lên ý tưởng",
}

TONES = ["Thân thiện, gần gũi", "Chuyên gia, đáng tin", "Thẳng thắn, thực tế", "Truyền cảm hứng", "Hài hước, bắt trend",
         "Trang trọng, lịch sự"]

# Kênh riêng của Viết nhanh (ngoài ai.CHANNELS): kiểm tra độ dài / hashtag theo quy cách "kênh ngoài khác"
EXTRA_CHANNELS = {"fb_group": "Nhóm Facebook", "zalo": "Zalo (OA / nhóm)"}


def channel_label(ch: str) -> str:
    return EXTRA_CHANNELS.get(ch) or ai.channel_label(ch)


# ---------------------------------------------------------------------------
# Ô nhập
# ---------------------------------------------------------------------------

def f(key: str, label: str, kind: str = "text", **kw) -> dict:
    """kind: text | textarea | select | number | author. required, options, default, placeholder, hint, max, min."""
    return {"key": key, "label": label, "kind": kind, "required": False, "max": 2000} | kw


TOPIC = f("topic", "Chủ đề / nội dung chính", "textarea", required=True, max=3000,
          placeholder="VD: Dấu hiệu má phanh sắp hết và vì sao không nên để đến khi kêu mới thay")
PRODUCT = f("product", "Sản phẩm / thương hiệu", placeholder="VD: VC Garage — bảo dưỡng, sửa chữa ô tô tại Hà Nội")
AUDIENCE = f("audience", "Đối tượng", placeholder="VD: chủ xe gia đình 30–45 tuổi, ít hiểu kỹ thuật")
TONE = f("tone", "Giọng văn", "select", options=TONES, default=TONES[0])
CTA = f("cta", "Lời kêu gọi (CTA)", placeholder="VD: nhắn tin đặt lịch kiểm tra phanh miễn phí")
LINK = f("link_url", "Link muốn dẫn về (tự gắn UTM)", max=500, placeholder="https://…")
SOURCE = f("source", "Tư liệu / ghi chú thêm", "textarea", max=12000,
           hint="Dán số liệu, lời kể thật, bài cũ, lời thoại video… AI chỉ dùng sự thật có ở đây và trong VCWIKI.")
SOURCE_URL = f("source_url", "Link bài tham khảo (tải về làm tư liệu)", max=500, placeholder="https://…")
COMMON = [PRODUCT, AUDIENCE, TONE, CTA, SOURCE, SOURCE_URL]


# ---------------------------------------------------------------------------
# Schema đầu ra bổ sung (loại nào trùng Xưởng chiến dịch thì dùng lại ai.WRITE_SCHEMAS)
# ---------------------------------------------------------------------------

SOURCES = ai.SOURCES

SCHEMA_ZALO = obj(title=S, message=S, cta_button=S, image=S, send_time=S, sources=SOURCES, facts_to_verify=STRS)
SCHEMA_CAPTION = obj(captions=arr(obj(style=S, text=S)), hashtags=STRS, notes=S, facts_to_verify=STRS)
SCHEMA_META = obj(options=arr(obj(meta_title=S, meta_description=S, slug=S, angle=S)), notes=S)
SCHEMA_PRODUCT = obj(
    name=S, tagline=S, short_description=S, long_description=S, benefits=STRS,
    specs=arr(obj(name=S, value=S)), faq=arr(obj(q=S, a=S)), meta_title=S, meta_description=S,
    sources=SOURCES, facts_to_verify=STRS)
SCHEMA_LANDING = obj(
    hero=obj(headline=S, subheadline=S, cta=S, visual=S),
    problem=obj(heading=S, points=STRS),
    benefits=arr(obj(title=S, text=S)),
    how_it_works=arr(obj(step=S, text=S)),
    proof=obj(heading=S, items=STRS),
    offer=obj(heading=S, text=S, cta=S),
    faq=arr(obj(q=S, a=S)),
    final_cta=obj(heading=S, text=S, button=S),
    meta_title=S, meta_description=S, sources=SOURCES, facts_to_verify=STRS)
SCHEMA_FB_ADS = obj(
    variants=arr(obj(angle=S, primary_text=S, headline=S, description=S, cta_button=S, visual=S)),
    targeting=STRS, notes=S, facts_to_verify=STRS)
SCHEMA_GOOGLE_ADS = obj(
    headlines=STRS, descriptions=STRS, paths=STRS,
    sitelinks=arr(obj(text=S, line1=S, line2=S)), callouts=STRS, keywords=STRS, negative_keywords=STRS,
    notes=S, facts_to_verify=STRS)
SCHEMA_EMAIL = obj(
    subject_lines=STRS, preheader=S, body=S, cta=obj(text=S, note=S), ps=S, send_time=S,
    sources=SOURCES, facts_to_verify=STRS)
SCHEMA_IDEAS = obj(ideas=arr(obj(title=S, hook=S, format=S, angle=S, why=S)), notes=S)


# ---------------------------------------------------------------------------
# Kiểm tra tự động (không dùng AI)
# ---------------------------------------------------------------------------

def _len_check(key: str, label: str, items: list[str], lo: int, hi: int) -> dict:
    bad = [f"“{x[:40]}” ({len(x)})" for x in items if not lo <= len(x) <= hi]
    return checks.check(key, label, items and not bad, ", ".join(bad[:3]) or f"{len(items)} mục")


def _count_check(key: str, label: str, items: list, lo: int, hi: int) -> dict:
    return checks.check(key, label, lo <= len(items) <= hi, f"{len(items)}")


def social_checks(c: dict, inputs: dict, author: dict | None) -> list[dict]:
    ch = inputs.get("channel") or "other"
    piece = {"episode": {"channel": ch if ch in CHANNELS else "other", "author": (author or {}).get("ref", "")}}
    return checks.social_checks(c, piece)


def seo_checks(c: dict, inputs: dict, _author) -> list[dict]:
    urls = [u for u in re.split(r"\s+", inputs.get("site_urls") or "") if u.startswith("http")]
    piece = {"outline": None, "episode": {"target_words": int(inputs.get("words") or 0)}}
    camp = {"brief": {"seo": {"landing_url": inputs.get("landing_url") or ""}}, "site_urls": urls}
    return checks.seo_checks(c, piece, camp)


def video_checks(c: dict, _inputs, _author) -> list[dict]:
    return checks.video_checks(c)


def zalo_checks(c: dict, _inputs, _author) -> list[dict]:
    return [_len_check("title", "Tiêu đề ≤ 80 ký tự", [c.get("title") or ""], 1, 80),
            _len_check("message", "Nội dung ≤ 1.000 ký tự (đọc hết trên điện thoại)", [c.get("message") or ""], 1, 1000),
            _len_check("button", "Nút CTA ≤ 30 ký tự", [c.get("cta_button") or ""], 1, 30)]


def caption_checks(c: dict, inputs: dict, _author) -> list[dict]:
    hi = {"TikTok": 150, "Instagram": 300, "Facebook": 300, "YouTube Shorts": 100}.get(inputs.get("platform"), 300)
    return [_count_check("count", "Đủ 5 phương án caption", c.get("captions") or [], 5, 10),
            _len_check("length", f"Caption ≤ {hi} ký tự (hiện trọn không bị cắt)",
                       [x.get("text", "") for x in c.get("captions") or []], 1, hi),
            _count_check("hashtags", "5–15 hashtag gợi ý", c.get("hashtags") or [], 5, 15)]


def meta_checks(c: dict, _inputs, _author) -> list[dict]:
    opts = c.get("options") or []
    return [_count_check("count", "Đủ 5 phương án", opts, 5, 10),
            _len_check("meta_title", "Meta title 30–60 ký tự", [o["meta_title"] for o in opts], 30, 60),
            _len_check("meta_description", "Meta description 70–160 ký tự", [o["meta_description"] for o in opts], 70, 160),
            checks.check("slug", "Slug chữ thường không dấu, nối bằng “-”",
                         opts and all(re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", o["slug"]) for o in opts))]


def product_checks(c: dict, _inputs, _author) -> list[dict]:
    return [_len_check("short", "Mô tả ngắn ≤ 300 ký tự", [c.get("short_description") or ""], 1, 300),
            _count_check("benefits", "3–7 lợi ích", c.get("benefits") or [], 3, 7),
            _len_check("meta_title", "Meta title 30–60 ký tự", [c.get("meta_title") or ""], 30, 60),
            _len_check("meta_description", "Meta description 70–160 ký tự", [c.get("meta_description") or ""], 70, 160)]


def landing_checks(c: dict, _inputs, _author) -> list[dict]:
    hero = c.get("hero") or {}
    return [_len_check("headline", "Tiêu đề chính ≤ 70 ký tự", [hero.get("headline") or ""], 1, 70),
            _count_check("benefits", "3–6 lợi ích", c.get("benefits") or [], 3, 6),
            _count_check("faq", "3–8 câu hỏi thường gặp", c.get("faq") or [], 3, 8),
            _len_check("meta_description", "Meta description 70–160 ký tự", [c.get("meta_description") or ""], 70, 160)]


def fb_ads_checks(c: dict, inputs: dict, _author) -> list[dict]:
    v = c.get("variants") or []
    n = int(inputs.get("variants") or 3)
    return [_count_check("count", f"Đủ {n} biến thể", v, n, n),
            _len_check("hook", "Dòng đầu nội dung chính ≤ 125 ký tự (trước “xem thêm”)",
                       [(x["primary_text"].strip().split("\n") or [""])[0] for x in v], 1, 125),
            _len_check("headline", "Tiêu đề ≤ 40 ký tự", [x["headline"] for x in v], 1, 40),
            _len_check("description", "Mô tả ≤ 30 ký tự", [x["description"] for x in v], 0, 30)]


def google_ads_checks(c: dict, _inputs, _author) -> list[dict]:
    """Giới hạn ký tự của quảng cáo tìm kiếm thích ứng (RSA) — Google chặn cứng khi vượt."""
    sl = c.get("sitelinks") or []
    return [_count_check("headlines_n", "10–15 tiêu đề", c.get("headlines") or [], 10, 15),
            _len_check("headlines", "Tiêu đề ≤ 30 ký tự", c.get("headlines") or [], 1, 30),
            _count_check("descriptions_n", "4 mô tả", c.get("descriptions") or [], 4, 4),
            _len_check("descriptions", "Mô tả ≤ 90 ký tự", c.get("descriptions") or [], 1, 90),
            _len_check("paths", "Đường dẫn hiển thị ≤ 15 ký tự", c.get("paths") or [], 1, 15),
            _len_check("sitelinks", "Tiêu đề liên kết trang web ≤ 25 ký tự", [s["text"] for s in sl], 1, 25),
            _len_check("sitelink_lines", "Mô tả liên kết trang web ≤ 35 ký tự",
                       [x for s in sl for x in (s["line1"], s["line2"])], 1, 35),
            _len_check("callouts", "Chú thích ≤ 25 ký tự", c.get("callouts") or [], 1, 25)]


def email_checks(c: dict, _inputs, _author) -> list[dict]:
    body = c.get("body") or ""
    return [_count_check("subjects_n", "5 dòng tiêu đề để thử A/B", c.get("subject_lines") or [], 5, 5),
            _len_check("subjects", "Tiêu đề ≤ 60 ký tự (không bị cắt trên điện thoại)", c.get("subject_lines") or [], 1, 60),
            _len_check("preheader", "Preheader 40–130 ký tự", [c.get("preheader") or ""], 40, 130),
            checks.check("words", "Thân email 80–400 chữ", 80 <= checks.words(body) <= 400, f"{checks.words(body)} chữ")]


def ideas_checks(c: dict, inputs: dict, _author) -> list[dict]:
    n = int(inputs.get("count") or 10)
    titles = [unaccent_key(i["title"]) for i in c.get("ideas") or []]
    return [_count_check("count", f"Đủ {n} ý tưởng", c.get("ideas") or [], n, n),
            checks.check("unique", "Không trùng ý", len(set(titles)) == len(titles))]


def unaccent_key(text: str) -> str:
    return re.sub(r"\W+", " ", checks.unaccent(text or "")).strip()


# ---------------------------------------------------------------------------
# Văn bản để sao chép
# ---------------------------------------------------------------------------

def _lines(*parts) -> str:
    return "\n".join(p for p in parts if p is not None).strip()


def text_post(c: dict) -> str:
    link = (c.get("link") or {}).get("utm_url") if c.get("link_placement") == "trong bài" else None
    return _lines((c.get("hooks") or [""])[0], "", c.get("body"), "" if link else None, link,
                  "" if c.get("hashtags") else None, " ".join(c.get("hashtags") or []) or None)


def text_video(c: dict) -> str:
    h, e = c.get("hook") or {}, c.get("ending") or {}
    L = [c.get("title"), c.get("logline"), "", f"HOOK: “{h.get('voice')}”", f"  Chữ: {h.get('on_screen_text')}",
         f"  Hình: {h.get('visual')}", ""]
    for s in c.get("scenes") or []:
        L += [f"[{s['start_sec']}s–{s['end_sec']}s] {s['shot']} | {s['visual']}", f"  Lời: {s['voice']}",
              f"  Chữ: {s['on_screen_text']}", f"  Âm thanh: {s['sound']}"]
    L += ["", f"KẾT + CTA: “{e.get('voice')}” — {e.get('on_screen_text')}", "", f"Caption: {c.get('caption')}",
          " ".join(c.get("hashtags") or [])]
    return _lines(*L)


def text_seo(c: dict) -> str:
    faq = [x for q in c.get("faq") or [] for x in (f"**{q['q']}**", "", q["a"], "")]
    return _lines(f"Meta title: {c.get('meta_title')}", f"Meta description: {c.get('meta_description')}",
                  f"Slug: {c.get('slug')}", "", f"# {c.get('h1')}", "", c.get("body"), "",
                  *(["## Câu hỏi thường gặp", "", *faq] if faq else []))


def text_zalo(c: dict) -> str:
    return _lines(c.get("title"), "", c.get("message"), "", f"[Nút] {c.get('cta_button')}")


def text_caption(c: dict) -> str:
    return _lines(*[f"{i}. {x['text']}" for i, x in enumerate(c.get("captions") or [], 1)], "",
                  " ".join(c.get("hashtags") or []))


def text_meta(c: dict) -> str:
    return "\n\n".join(f"{o['meta_title']}\n{o['meta_description']}\n/{o['slug']}" for o in c.get("options") or [])


def text_product(c: dict) -> str:
    return _lines(f"# {c.get('name')}", c.get("tagline"), "", c.get("short_description"), "",
                  *[f"- {b}" for b in c.get("benefits") or []], "", c.get("long_description"), "",
                  *(["## Thông số", *[f"- {s['name']}: {s['value']}" for s in c.get("specs") or []], ""]
                    if c.get("specs") else []),
                  *(["## Câu hỏi thường gặp", *[f"**{q['q']}**\n{q['a']}\n" for q in c.get("faq") or []]]
                    if c.get("faq") else []))


def text_landing(c: dict) -> str:
    h, p, pr, o, fc = (c.get(k) or {} for k in ("hero", "problem", "proof", "offer", "final_cta"))
    return _lines(
        f"# {h.get('headline')}", h.get("subheadline"), f"[Nút] {h.get('cta')}", "",
        f"## {p.get('heading')}", *[f"- {x}" for x in p.get("points") or []], "",
        "## Lợi ích", *[f"- **{b['title']}**: {b['text']}" for b in c.get("benefits") or []], "",
        "## Cách hoạt động", *[f"{i}. **{s['step']}** — {s['text']}" for i, s in enumerate(c.get("how_it_works") or [], 1)],
        "", f"## {pr.get('heading')}", *[f"- {x}" for x in pr.get("items") or []], "",
        f"## {o.get('heading')}", o.get("text"), f"[Nút] {o.get('cta')}", "",
        "## Câu hỏi thường gặp", *[f"**{q['q']}**\n{q['a']}\n" for q in c.get("faq") or []],
        f"## {fc.get('heading')}", fc.get("text"), f"[Nút] {fc.get('button')}")


def text_fb_ads(c: dict) -> str:
    return "\n\n---\n\n".join(
        _lines(f"Biến thể {i} — {v['angle']}", "", v["primary_text"], "", f"Tiêu đề: {v['headline']}",
               f"Mô tả: {v['description']}", f"Nút: {v['cta_button']}", f"Hình: {v['visual']}")
        for i, v in enumerate(c.get("variants") or [], 1))


def text_google_ads(c: dict) -> str:
    return _lines("TIÊU ĐỀ", *c.get("headlines", []), "", "MÔ TẢ", *c.get("descriptions", []), "",
                  "ĐƯỜNG DẪN: /" + "/".join(c.get("paths") or []), "", "LIÊN KẾT TRANG WEB",
                  *[f"- {s['text']} | {s['line1']} | {s['line2']}" for s in c.get("sitelinks") or []], "",
                  "CHÚ THÍCH: " + " · ".join(c.get("callouts") or []), "",
                  "TỪ KHOÁ: " + ", ".join(c.get("keywords") or []),
                  "TỪ KHOÁ PHỦ ĐỊNH: " + ", ".join(c.get("negative_keywords") or []))


def text_email(c: dict) -> str:
    cta = c.get("cta") or {}
    return _lines(f"Tiêu đề: {(c.get('subject_lines') or [''])[0]}", f"Preheader: {c.get('preheader')}", "",
                  c.get("body"), "", f"[Nút] {cta.get('text')}", "" if c.get("ps") else None,
                  f"P.S. {c['ps']}" if c.get("ps") else None)


def text_ideas(c: dict) -> str:
    return "\n\n".join(f"{i}. {x['title']}\n   Mở đầu: {x['hook']}\n   Dạng: {x['format']} · Góc: {x['angle']}"
                       for i, x in enumerate(c.get("ideas") or [], 1))


# ---------------------------------------------------------------------------
# Danh mục loại nội dung
# ---------------------------------------------------------------------------

POST_TASK = ai.WRITE_TASKS["social"].replace("cho mục kế hoạch trên", "theo yêu cầu trên")
SOCIAL_CHANNEL_FIELD = {
    "fb_post": f("channel", "Đăng ở đâu", "select", required=True, default="fanpage",
                 options=[["fanpage", "Fanpage"], ["fb_personal", "Facebook cá nhân"], ["fb_group", "Nhóm Facebook"]]),
    "linkedin_post": f("channel", "Đăng ở đâu", "select", required=True, default="linkedin",
                       options=[["linkedin", "LinkedIn cá nhân"], ["linkedin_page", "Trang LinkedIn công ty"]]),
}
AUTHOR = f("author_id", "Người đứng tên", "author",
           hint="Bắt buộc khi đăng trang cá nhân — AI viết theo giọng và bài mẫu của người này.")
LENGTH = f("length", "Độ dài", "select", options=["Ngắn (3–5 dòng)", "Vừa (8–15 dòng)", "Dài, kể chuyện (20+ dòng)"],
           default="Vừa (8–15 dòng)")

TYPES: dict[str, dict] = {
    # --- Mạng xã hội -----------------------------------------------------------------------------
    "fb_post": {
        "group": "social", "label": "Bài Facebook", "icon": "f",
        "desc": "Fanpage, trang cá nhân hoặc nhóm — 3 mở đầu, gợi ý hình, bình luận đầu, link UTM.",
        "fields": [SOCIAL_CHANNEL_FIELD["fb_post"], AUTHOR, TOPIC, LENGTH, *COMMON[:4], LINK, *COMMON[4:]],
        "schema": ai.WRITE_SCHEMAS["social"], "task": POST_TASK, "rubric": "social", "judge": True,
        "checks": social_checks, "text": text_post, "sections": [{"kind": "post"}],
    },
    "linkedin_post": {
        "group": "social", "label": "Bài LinkedIn", "icon": "in",
        "desc": "Cá nhân hoặc trang công ty — góc chuyên môn, 3–5 hashtag.",
        "fields": [SOCIAL_CHANNEL_FIELD["linkedin_post"], AUTHOR, TOPIC, LENGTH, *COMMON[:4], LINK, *COMMON[4:]],
        "schema": ai.WRITE_SCHEMAS["social"], "task": POST_TASK, "rubric": "social", "judge": True,
        "checks": social_checks, "text": text_post, "sections": [{"kind": "post"}],
    },
    "zalo": {
        "group": "social", "label": "Tin Zalo OA / nhóm Zalo", "icon": "Z",
        "desc": "Tin nhắn ngắn gửi khách quan tâm — tiêu đề, nội dung, nút bấm.",
        "fields": [TOPIC, *COMMON],
        "schema": SCHEMA_ZALO, "rubric": "general", "judge": True, "checks": zalo_checks, "text": text_zalo,
        "task": """Nhiệm vụ: viết TIN NHẮN ZALO (OA hoặc nhóm) gửi người đã quan tâm / là khách.
- title: tiêu đề ≤ 80 ký tự, nêu lợi ích cụ thể. message: ≤ 1.000 ký tự, xưng hô lịch sự gần gũi, đoạn ngắn, có thể dùng \
vài emoji chừng mực; nói rõ khách được gì, làm gì tiếp theo. cta_button: chữ trên nút ≤ 30 ký tự.
- image: ảnh / banner nên kèm. send_time: thời điểm gửi đề xuất kèm lý do.
- Zalo là kênh riêng tư: không spam, không hứa hẹn quá đà.""",
        "sections": [{"kind": "text", "key": "title", "label": "Tiêu đề", "copy": True},
                     {"kind": "text", "key": "message", "label": "Nội dung", "copy": True},
                     {"kind": "fields", "items": [["cta_button", "Nút bấm"], ["image", "Ảnh kèm"],
                                                  ["send_time", "Giờ gửi"]]}],
    },
    "caption": {
        "group": "social", "label": "Caption + hashtag", "icon": "#",
        "desc": "5 phương án caption cho ảnh / video đã có, kèm bộ hashtag.",
        "fields": [f("platform", "Nền tảng", "select", required=True, default="Facebook",
                     options=["Facebook", "Instagram", "TikTok", "YouTube Shorts"]),
                   f("topic", "Ảnh / video nói về gì", "textarea", required=True, max=3000,
                     placeholder="VD: video 30s cảnh thợ thay dầu hộp số tự động cho Mazda CX-5"), *COMMON],
        "schema": SCHEMA_CAPTION, "rubric": "general", "judge": False, "checks": caption_checks, "text": text_caption,
        "task": """Nhiệm vụ: viết 5 phương án CAPTION cho ảnh / video mô tả ở trên, đúng văn hoá nền tảng.
- captions: 5 phương án, mỗi phương án một kiểu (style: câu hỏi / số liệu / kể chuyện / hài hước / lời khuyên…), câu đầu \
phải dừng được người lướt, có câu gợi bình luận hoặc CTA. Độ dài vừa nền tảng (TikTok ≤ 150 ký tự).
- hashtags: 5–15 hashtag xếp từ phổ biến đến ngách, liên quan thật. notes: gợi ý cách dùng.""",
        "sections": [{"kind": "table", "key": "captions", "label": "Phương án caption",
                      "cols": [["style", "Kiểu"], ["text", "Caption", {"count": True}]]},
                     {"kind": "list", "key": "hashtags", "label": "Hashtag", "inline": True},
                     {"kind": "text", "key": "notes", "label": "Ghi chú"}],
    },
    # --- Video ngắn -------------------------------------------------------------------------------
    "short_video": {
        "group": "video", "label": "Kịch bản TikTok / Reels / Shorts", "icon": "▶",
        "desc": "Kịch bản sản xuất theo giây: hook 3 giây, phân cảnh, lời thoại, chữ trên màn hình, caption.",
        "fields": [f("platform", "Nền tảng", "select", default="TikTok",
                     options=["TikTok", "Facebook Reels", "Instagram Reels", "YouTube Shorts"]),
                   f("duration", "Thời lượng", "select", default="45–60 giây",
                     options=["15–20 giây", "30 giây", "45–60 giây", "60–90 giây"]),
                   f("format", "Hình thức", "select", default="AI tự chọn",
                     options=["AI tự chọn", "Nói trước máy (talking head)", "POV", "Kể chuyện", "Danh sách mẹo",
                              "Trước / sau", "Hướng dẫn từng bước", "Phỏng vấn nhanh"]),
                   f("persona", "Người nói / nhân vật", placeholder="VD: anh Hùng, kỹ thuật viên 10 năm, xưng anh – em"),
                   TOPIC, *COMMON],
        "schema": ai.WRITE_SCHEMAS["video"], "rubric": "video", "judge": True, "checks": video_checks,
        "text": text_video, "sections": [{"kind": "video"}],
        "task": ai.WRITE_TASKS["video"].replace("cho mục kế hoạch trên", "theo yêu cầu trên"),
    },
    "video_ideas": {
        "group": "video", "label": "Ý tưởng series video", "icon": "✦",
        "desc": "10–20 ý tưởng video kèm hook 3 giây đầu và hình thức quay.",
        "fields": [f("count", "Số ý tưởng", "number", default=10, min=5, max=20),
                   f("platform", "Nền tảng", "select", default="TikTok",
                     options=["TikTok", "Facebook Reels", "Instagram Reels", "YouTube Shorts"]), TOPIC, *COMMON],
        "schema": SCHEMA_IDEAS, "rubric": "general", "judge": False, "checks": ideas_checks, "text": text_ideas,
        "task": """Nhiệm vụ: đề xuất đúng số Ý TƯỞNG VIDEO NGẮN đã yêu cầu cho chủ đề trên.
- Mỗi ý: tên tập (title), hook = câu nói nguyên văn 3 giây đầu, format (hình thức quay), angle (góc nhìn / insight), why \
(vì sao người xem dừng lại và chia sẻ).
- Đa dạng hình thức và góc; không trùng ý; ưu tiên ý quay được ngay bằng điện thoại. notes: gợi ý thứ tự đăng.""",
        "sections": [{"kind": "table", "key": "ideas", "label": "Ý tưởng",
                      "cols": [["title", "Tên tập"], ["hook", "Hook 3 giây"], ["format", "Hình thức"],
                               ["angle", "Góc"], ["why", "Vì sao hiệu quả"]]},
                     {"kind": "text", "key": "notes", "label": "Ghi chú"}],
    },
    # --- SEO & website ----------------------------------------------------------------------------
    "seo_article": {
        "group": "seo", "label": "Bài blog chuẩn SEO", "icon": "S",
        "desc": "Bài hoàn chỉnh + meta, slug, FAQ, ảnh, JSON-LD; kiểm tra on-page tự động.",
        "fields": [f("keyword", "Từ khoá chính", required=True, max=150, placeholder="VD: dấu hiệu má phanh mòn"),
                   f("secondary", "Từ khoá phụ", placeholder="cách nhau bằng dấu phẩy"),
                   f("intent", "Ý định tìm kiếm", "select", default="Tìm hiểu",
                     options=["Tìm hiểu", "So sánh", "Mua / đặt dịch vụ", "Địa phương (gần tôi)"]),
                   f("words", "Độ dài mục tiêu (chữ)", "select", default="1200",
                     options=[["800", "~800 chữ"], ["1200", "~1.200 chữ"], ["1800", "~1.800 chữ"],
                              ["2500", "~2.500 chữ"]]),
                   f("topic", "Góc viết / ghi chú nội dung", "textarea", max=3000,
                     placeholder="VD: nhấn mạnh an toàn, có bảng giá tham khảo, dẫn về dịch vụ kiểm tra phanh"),
                   f("landing_url", "Trang đích chuyển đổi", max=500, placeholder="https://…"),
                   f("site_urls", "URL có sẵn trên website (cho link nội bộ)", "textarea", max=8000,
                     hint="Mỗi dòng một URL. AI chỉ đặt link nội bộ tới các URL này và trang đích."),
                   *COMMON],
        "schema": ai.WRITE_SCHEMAS["seo"], "rubric": "seo", "judge": True, "checks": seo_checks, "text": text_seo,
        "sections": [{"kind": "seo"}],
        "task": ai.WRITE_TASKS["seo"].replace("theo dàn ý đã duyệt", "theo từ khoá và yêu cầu trên")
        .replace("sau đó các mục ## / ### theo dàn ý", "sau đó các mục ## / ### hợp lý")
        .replace("\n- h1 chứa", "\n- Tự lập dàn ý tốt nhất cho ý định tìm kiếm rồi viết. h1 chứa", 1),
    },
    "meta_tags": {
        "group": "seo", "label": "Meta title & description", "icon": "⌕",
        "desc": "5 phương án meta cho một trang, đúng giới hạn ký tự của Google.",
        "fields": [f("keyword", "Từ khoá chính", required=True, max=150),
                   f("topic", "Trang nói về gì", "textarea", required=True, max=3000), PRODUCT, AUDIENCE, CTA,
                   SOURCE_URL],
        "schema": SCHEMA_META, "rubric": "general", "judge": False, "checks": meta_checks, "text": text_meta,
        "task": """Nhiệm vụ: viết 5 phương án META cho trang ở trên.
- meta_title 30–60 ký tự, từ khoá chính gần đầu; meta_description 120–155 ký tự, nêu lợi ích + lời mời bấm; slug chữ \
thường không dấu nối "-", chứa từ khoá. angle: phương án nhấn vào điều gì. Các phương án khác góc nhau.""",
        "sections": [{"kind": "serp", "key": "options"}],
    },
    "product_desc": {
        "group": "seo", "label": "Mô tả sản phẩm / dịch vụ", "icon": "▣",
        "desc": "Cho website, sàn TMĐT hoặc catalog — lợi ích, thông số, FAQ, meta.",
        "fields": [f("where", "Dùng ở đâu", "select", default="Website",
                     options=["Website", "Shopee / Lazada / TikTok Shop", "Catalog / báo giá", "Fanpage"]),
                   f("topic", "Tên sản phẩm / dịch vụ", required=True, max=300),
                   f("specs", "Thông số, giá, bảo hành… (sự thật để AI dùng)", "textarea", max=6000),
                   AUDIENCE, TONE, CTA, SOURCE, SOURCE_URL],
        "schema": SCHEMA_PRODUCT, "rubric": "general", "judge": True, "checks": product_checks, "text": text_product,
        "task": """Nhiệm vụ: viết MÔ TẢ SẢN PHẨM / DỊCH VỤ bán hàng cho nơi dùng đã chọn.
- tagline 1 câu. short_description ≤ 300 ký tự nói lợi ích chính. benefits 3–7 lợi ích (nói bằng kết quả khách nhận \
được, không liệt kê tính năng khô). long_description: Markdown, có tiêu đề nhỏ, trả lời "vì sao chọn", "phù hợp với ai", \
"dùng / đặt thế nào". specs: CHỈ từ thông số được cung cấp — thiếu thì bỏ trống, không bịa. faq 3–6 câu.
- meta_title 30–60 ký tự, meta_description 70–160 ký tự.""",
        "sections": [{"kind": "fields", "items": [["name", "Tên"], ["tagline", "Tagline"]]},
                     {"kind": "text", "key": "short_description", "label": "Mô tả ngắn", "copy": True},
                     {"kind": "list", "key": "benefits", "label": "Lợi ích"},
                     {"kind": "md", "key": "long_description", "label": "Mô tả chi tiết", "copy": True},
                     {"kind": "table", "key": "specs", "label": "Thông số", "cols": [["name", "Mục"], ["value", "Giá trị"]]},
                     {"kind": "table", "key": "faq", "label": "Câu hỏi thường gặp", "cols": [["q", "Hỏi"], ["a", "Đáp"]]},
                     {"kind": "fields", "items": [["meta_title", "Meta title"], ["meta_description", "Meta description"]]}],
    },
    "landing_page": {
        "group": "seo", "label": "Nội dung landing page", "icon": "▭",
        "desc": "Đủ các khối: hero, vấn đề, lợi ích, cách làm, bằng chứng, ưu đãi, FAQ, CTA cuối.",
        "fields": [f("topic", "Ưu đãi / dịch vụ muốn bán", "textarea", required=True, max=3000),
                   f("offer", "Ưu đãi cụ thể", placeholder="VD: kiểm tra 20 hạng mục miễn phí đến 31/10"),
                   *COMMON],
        "schema": SCHEMA_LANDING, "rubric": "general", "judge": True, "checks": landing_checks, "text": text_landing,
        "task": """Nhiệm vụ: viết NỘI DUNG LANDING PAGE chuyển đổi cho ưu đãi trên, theo từng khối.
- hero: headline ≤ 70 ký tự nêu kết quả khách muốn; subheadline làm rõ cho ai / vì sao tin; cta chữ nút; visual gợi ý \
ảnh đầu trang. problem: nỗi đau khách đang gặp. benefits 3–6 lợi ích. how_it_works 3–4 bước. proof: bằng chứng — CHỈ \
dùng sự thật trong dữ liệu, còn lại ghi "[cần: đánh giá thật / số liệu thật …]". offer: ưu đãi + điều kiện + CTA. faq 3–8 \
câu xử lý băn khoăn (giá, thời gian, bảo hành…). final_cta khép lại.
- meta_title, meta_description (70–160 ký tự).""",
        "sections": [{"kind": "fields", "label": "Hero", "items": [["hero.headline", "Tiêu đề chính"],
                                                                    ["hero.subheadline", "Tiêu đề phụ"],
                                                                    ["hero.cta", "Nút"], ["hero.visual", "Hình"]]},
                     {"kind": "fields", "label": "Vấn đề", "items": [["problem.heading", "Tiêu đề"],
                                                                      ["problem.points", "Ý"]]},
                     {"kind": "table", "key": "benefits", "label": "Lợi ích", "cols": [["title", "Lợi ích"], ["text", "Diễn giải"]]},
                     {"kind": "table", "key": "how_it_works", "label": "Cách hoạt động", "cols": [["step", "Bước"], ["text", "Diễn giải"]]},
                     {"kind": "fields", "label": "Bằng chứng", "items": [["proof.heading", "Tiêu đề"], ["proof.items", "Mục"]]},
                     {"kind": "fields", "label": "Ưu đãi", "items": [["offer.heading", "Tiêu đề"], ["offer.text", "Nội dung"],
                                                                      ["offer.cta", "Nút"]]},
                     {"kind": "table", "key": "faq", "label": "Câu hỏi thường gặp", "cols": [["q", "Hỏi"], ["a", "Đáp"]]},
                     {"kind": "fields", "label": "CTA cuối", "items": [["final_cta.heading", "Tiêu đề"],
                                                                        ["final_cta.text", "Nội dung"],
                                                                        ["final_cta.button", "Nút"]]},
                     {"kind": "fields", "items": [["meta_title", "Meta title"], ["meta_description", "Meta description"]]}],
    },
    # --- Quảng cáo & email ------------------------------------------------------------------------
    "fb_ads": {
        "group": "ads", "label": "Quảng cáo Facebook / Instagram", "icon": "◎",
        "desc": "Nhiều biến thể để thử A/B: nội dung chính, tiêu đề, mô tả, nút, hình.",
        "fields": [f("objective", "Mục tiêu quảng cáo", "select", default="Tin nhắn",
                     options=["Tin nhắn", "Khách tiềm năng (form)", "Lượt truy cập website", "Nhận diện / tiếp cận",
                              "Bán hàng / chuyển đổi"]),
                   f("variants", "Số biến thể", "number", default=3, min=2, max=6),
                   f("topic", "Sản phẩm / ưu đãi quảng cáo", "textarea", required=True, max=3000), *COMMON],
        "schema": SCHEMA_FB_ADS, "rubric": "general", "judge": True, "checks": fb_ads_checks, "text": text_fb_ads,
        "task": """Nhiệm vụ: viết QUẢNG CÁO FACEBOOK / INSTAGRAM, đúng số biến thể yêu cầu, mỗi biến thể một góc (angle: \
nỗi đau / lợi ích / bằng chứng / khan hiếm / câu hỏi…).
- primary_text: dòng đầu ≤ 125 ký tự phải tự đứng được (hiện trước "xem thêm"); toàn bài ngắn gọn, 1 lời mời hành động.
- headline ≤ 40 ký tự; description ≤ 30 ký tự; cta_button chọn từ nút có sẵn của Meta (Gửi tin nhắn, Đăng ký, Tìm hiểu \
thêm, Đặt ngay, Nhận ưu đãi, Gọi ngay…); visual: ảnh / video nên dùng.
- Tuân thủ chính sách quảng cáo Meta: không nhắm vào đặc điểm cá nhân ("Bạn đang bị…"), không hứa hẹn tuyệt đối, không \
trước/sau gây hiểu lầm. targeting: gợi ý nhóm đối tượng / sở thích. notes: nên thử biến thể nào trước.""",
        "sections": [{"kind": "table", "key": "variants", "label": "Biến thể",
                      "cols": [["angle", "Góc"], ["primary_text", "Nội dung chính"],
                               ["headline", "Tiêu đề", {"limit": 40}], ["description", "Mô tả", {"limit": 30}],
                               ["cta_button", "Nút"], ["visual", "Hình"]]},
                     {"kind": "list", "key": "targeting", "label": "Gợi ý nhắm đối tượng"},
                     {"kind": "text", "key": "notes", "label": "Ghi chú"}],
    },
    "google_ads": {
        "group": "ads", "label": "Quảng cáo Google tìm kiếm", "icon": "G",
        "desc": "Bộ RSA: 15 tiêu đề, 4 mô tả, liên kết trang web, chú thích, từ khoá — đúng giới hạn ký tự.",
        "fields": [f("keyword", "Từ khoá / nhóm từ khoá", required=True, max=500),
                   f("topic", "Dịch vụ / ưu đãi quảng cáo", "textarea", required=True, max=3000),
                   f("landing_url", "Trang đích", max=500, placeholder="https://…"), *COMMON],
        "schema": SCHEMA_GOOGLE_ADS, "rubric": "general", "judge": True, "checks": google_ads_checks,
        "text": text_google_ads,
        "task": """Nhiệm vụ: viết bộ QUẢNG CÁO TÌM KIẾM THÍCH ỨNG (RSA) của Google Ads cho từ khoá trên.
- headlines: 15 tiêu đề, MỖI tiêu đề ≤ 30 ký tự (đếm cả dấu cách) — ít nhất 3 tiêu đề chứa từ khoá, có tiêu đề lợi ích, \
ưu đãi, bằng chứng, CTA, địa phương nếu có. Các tiêu đề ghép ngẫu nhiên vẫn phải đọc hợp lý.
- descriptions: 4 mô tả, mỗi mô tả ≤ 90 ký tự. paths: 2 đường dẫn hiển thị, mỗi cái ≤ 15 ký tự, không dấu.
- sitelinks: 4 liên kết trang web (text ≤ 25, line1 / line2 ≤ 35 ký tự). callouts: 4–6 chú thích ≤ 25 ký tự.
- keywords: 10–20 từ khoá nên chạy (ghi kiểu khớp: "cụm từ" hoặc [chính xác]). negative_keywords: 5–15 từ khoá phủ định.
- Không bịa lượng tìm kiếm / giá thầu. notes: gợi ý cài đặt.""",
        "sections": [{"kind": "limited", "key": "headlines", "label": "Tiêu đề", "limit": 30},
                     {"kind": "limited", "key": "descriptions", "label": "Mô tả", "limit": 90},
                     {"kind": "limited", "key": "paths", "label": "Đường dẫn hiển thị", "limit": 15},
                     {"kind": "table", "key": "sitelinks", "label": "Liên kết trang web",
                      "cols": [["text", "Tiêu đề", {"limit": 25}], ["line1", "Dòng 1", {"limit": 35}],
                               ["line2", "Dòng 2", {"limit": 35}]]},
                     {"kind": "limited", "key": "callouts", "label": "Chú thích", "limit": 25},
                     {"kind": "list", "key": "keywords", "label": "Từ khoá", "inline": True},
                     {"kind": "list", "key": "negative_keywords", "label": "Từ khoá phủ định", "inline": True},
                     {"kind": "text", "key": "notes", "label": "Ghi chú"}],
    },
    "email": {
        "group": "ads", "label": "Email marketing", "icon": "✉",
        "desc": "5 tiêu đề thử A/B, preheader, thân email, CTA.",
        "fields": [f("email_type", "Loại email", "select", default="Khuyến mãi / ưu đãi",
                     options=["Khuyến mãi / ưu đãi", "Bản tin định kỳ", "Chăm sóc / nuôi dưỡng", "Chào mừng khách mới",
                              "Mời sự kiện / hội thảo", "Nhắc lịch (bảo dưỡng, gia hạn…)", "Kéo khách cũ quay lại"]),
                   TOPIC, *COMMON],
        "schema": SCHEMA_EMAIL, "rubric": "general", "judge": True, "checks": email_checks, "text": text_email,
        "task": """Nhiệm vụ: viết EMAIL MARKETING đúng loại đã chọn.
- subject_lines: đúng 5 tiêu đề ≤ 60 ký tự, mỗi cái một kiểu (lợi ích / tò mò / cá nhân hoá / khẩn cấp / câu hỏi), \
không viết HOA toàn bộ, không từ dễ vào spam ("miễn phí 100%", "!!!"). preheader 40–130 ký tự bổ sung cho tiêu đề.
- body: Markdown, 80–400 chữ, mở đầu vào thẳng điều người đọc quan tâm, đoạn ngắn, MỘT CTA chính; có thể dùng \
{{ten_khach}} để cá nhân hoá. cta: chữ trên nút + ghi chú dẫn đi đâu. ps: dòng P.S. (có thể để trống). send_time: gợi ý \
giờ gửi.""",
        "sections": [{"kind": "list", "key": "subject_lines", "label": "Tiêu đề (thử A/B)", "count": True},
                     {"kind": "text", "key": "preheader", "label": "Preheader", "copy": True},
                     {"kind": "md", "key": "body", "label": "Thân email", "copy": True},
                     {"kind": "fields", "items": [["cta.text", "Nút CTA"], ["cta.note", "Dẫn tới"], ["ps", "P.S."],
                                                  ["send_time", "Giờ gửi"]]}],
    },
    # --- Lên ý tưởng ------------------------------------------------------------------------------
    "ideas": {
        "group": "ideas", "label": "Ý tưởng & tiêu đề nội dung", "icon": "✎",
        "desc": "10–20 ý tưởng bài / tiêu đề cho mọi kênh, kèm câu mở đầu.",
        "fields": [f("count", "Số ý tưởng", "number", default=10, min=5, max=20),
                   f("platform", "Cho kênh", "select", default="Nhiều kênh",
                     options=["Nhiều kênh", "Facebook", "LinkedIn", "Blog / website", "Email", "TikTok"]),
                   TOPIC, *COMMON],
        "schema": SCHEMA_IDEAS, "rubric": "general", "judge": False, "checks": ideas_checks, "text": text_ideas,
        "task": """Nhiệm vụ: đề xuất đúng số Ý TƯỞNG NỘI DUNG đã yêu cầu cho chủ đề và kênh trên.
- Mỗi ý: title (tiêu đề hấp dẫn, cụ thể), hook (câu mở đầu nguyên văn), format (dạng bài: danh sách, kể chuyện, so sánh, \
hỏi đáp, case study, hậu trường…), angle (góc nhìn / insight), why (vì sao khán giả quan tâm).
- Đa dạng dạng bài và mức độ (giá trị / tương tác / bán hàng); không trùng ý. notes: gợi ý nên làm ý nào trước.""",
        "sections": [{"kind": "table", "key": "ideas", "label": "Ý tưởng",
                      "cols": [["title", "Tiêu đề"], ["hook", "Mở đầu"], ["format", "Dạng"], ["angle", "Góc"],
                               ["why", "Vì sao"]]},
                     {"kind": "text", "key": "notes", "label": "Ghi chú"}],
    },
}

SYSTEM = """Bạn là chuyên gia nội dung marketing digital của tập đoàn VC Phồn Vinh (phụ tùng ô tô, garage, đào tạo nghề \
ô tô, phần mềm quản lý). Bạn viết một nội dung hoàn chỉnh, dùng được ngay, theo yêu cầu và dữ liệu thật được cung cấp: \
tư liệu người dùng dán, trang tham khảo, hồ sơ người đứng tên và thẻ tri thức VCWIKI của công ty.

Nguyên tắc:
- Không bịa số liệu, giá, lời chứng thực, trải nghiệm cá nhân, cam kết (thu nhập, hiệu quả, bảo hành) hay URL. Chỗ cần \
số liệu / chuyện thật mà dữ liệu không có thì ghi rõ "[cần xác minh: …]" hoặc "[cần chuyện thật: …]" và liệt kê ở \
facts_to_verify (nếu schema có).
- Học cách trình bày của bài tham khảo — KHÔNG sao chép câu chữ.
- Trích căn cứ bằng mã: K1… (thẻ VCWIKI), S1 (trang tham khảo), A1 (người đứng tên), G1 (nội dung gốc khi chuyển thể). \
Chỉ dùng mã có trong dữ liệu.
- Viết tiếng Việt tự nhiên, cụ thể, đúng giọng yêu cầu; tránh sáo rỗng kiểu "nâng cao nhận thức", "lan toả giá trị", \
"trong thời đại 4.0".
- Phần mở đầu quyết định tất cả: không mở đầu bằng chào hỏi hay giới thiệu bản thân."""


def public_types() -> dict:
    """Danh mục cho giao diện: nhóm, ô nhập, cách hiển thị, có giám khảo không."""
    keep = ("group", "label", "icon", "desc", "fields", "rubric", "judge", "sections")
    return {"groups": GROUPS, "types": {k: {x: t[x] for x in keep} for k, t in TYPES.items()}}


# ---------------------------------------------------------------------------
# Đầu vào
# ---------------------------------------------------------------------------

def option_values(field: dict) -> list[str]:
    return [o[0] if isinstance(o, list) else o for o in field.get("options") or []]


def clean_inputs(type_key: str, raw: dict) -> dict:
    """Kiểm tra đầu vào theo `fields` của loại -> dict sạch. Sai thì ValueError (câu tiếng Việt)."""
    out = {}
    for fd in TYPES[type_key]["fields"]:
        k, v = fd["key"], raw.get(fd["key"], fd.get("default"))
        if fd["kind"] == "number":
            try:
                v = int(v if v not in (None, "") else fd.get("default") or 0)
            except (TypeError, ValueError):
                raise ValueError(f"{fd['label']}: phải là số") from None
            if not fd.get("min", 0) <= v <= fd["max"]:
                raise ValueError(f"{fd['label']}: từ {fd.get('min', 0)} đến {fd['max']}")
        else:
            v = str(v or "").strip()
            if len(v) > fd["max"]:
                raise ValueError(f"{fd['label']}: tối đa {fd['max']:,} ký tự".replace(",", "."))
            if fd["kind"] == "select" and v and v not in option_values(fd):
                raise ValueError(f"{fd['label']}: giá trị không hợp lệ")
            if k.endswith("url") and v and not re.match(r"https?://\S+$", v):
                raise ValueError(f"{fd['label']}: link không hợp lệ")
        if fd["required"] and v in ("", None):
            raise ValueError(f"{fd['label']}: bắt buộc nhập")
        out[k] = v
    return out


def is_personal(inputs: dict) -> bool:
    return CHANNELS.get(inputs.get("channel") or "", {}).get("personal", False)


def wiki_query(inputs: dict) -> str:
    return " ".join(str(inputs.get(k) or "") for k in ("topic", "keyword", "product", "offer", "audience"))


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

def label_value(type_key: str, fd: dict, v) -> str:
    if fd["kind"] == "select" and isinstance((fd.get("options") or [None])[0], list):
        return dict(fd["options"]).get(v, v)
    return v


def request_text(piece: dict) -> str:
    t, inputs = TYPES[piece["type"]], piece["inputs"]
    rows = [f"- Loại nội dung: {t['label']} ({GROUPS[t['group']]})"]
    for fd in t["fields"]:
        v = inputs.get(fd["key"])
        if v in ("", None) or fd["kind"] == "author" or fd["key"] in ("source", "source_url", "site_urls"):
            continue
        rows.append(f"- {fd['label']}: {label_value(piece['type'], fd, v)}")
    return "<yeu_cau>\n" + "\n".join(rows) + "\n</yeu_cau>"


def context(piece: dict, cards: list[dict], parent: dict | None = None) -> str:
    """Bối cảnh chung cho lượt viết + lượt chấm."""
    inputs = piece["inputs"]
    parts = [request_text(piece), ai.cards_text(cards)]
    if piece.get("analysis_id"):   # bài trong dự án đã chốt phân tích (CE-27)
        from .analysis import load_final
        parts.append(ai.analysis_text(load_final(piece["analysis_id"])))
    if inputs.get("source"):
        parts.append(f"<tu_lieu_nguoi_dung>\n{inputs['source']}\n</tu_lieu_nguoi_dung>")
    page = piece.get("source_page") or {}
    if page.get("status") == "ok":
        parts.append(f'<trang_tham_khao ma="S1" url="{inputs.get("source_url")}">\nTiêu đề: {page.get("title")}\n'
                     f'{(page.get("text") or "")[:8000]}\n</trang_tham_khao>')
    if piece["type"] == "seo_article":
        parts.append(ai.site_text([u for u in re.split(r"\s+", inputs.get("site_urls") or "") if u.startswith("http")]))
        parts.append(f"<trang_dich>{inputs.get('landing_url') or '(chưa có)'}</trang_dich>")
    if piece.get("author"):
        parts.append(ai.authors_text([piece["author"]], samples=True))
    if inputs.get("channel"):
        parts.append(f'<kenh ma="{inputs["channel"]}">{channel_label(inputs["channel"])}</kenh>')
    if parent:
        parts.append(f'<noi_dung_goc ma="G1" loai="{TYPES[parent["type"]]["label"]}">\n'
                     f'{dump(parent.get("content") or {})[:15000]}\n</noi_dung_goc>\n'
                     f'Đây là CHUYỂN THỂ từ nội dung gốc G1 sang "{TYPES[piece["type"]]["label"]}": giữ thông điệp và sự '
                     f'thật, viết lại hoàn toàn cho đúng văn hoá kênh mới — không lặp nguyên văn.')
    return "\n\n".join(x for x in parts if x)


def write(piece: dict, ctx: str, previous: dict | None = None, review: dict | None = None,
          found: list[dict] | None = None) -> dict:
    t = TYPES[piece["type"]]
    parts = [ctx, t["task"]]
    if previous:
        parts.append("<ban_truoc>\n" + dump(previous) + "\n</ban_truoc>\n"
                     + ("<nhan_xet_giam_khao>\n" + dump({k: review[k] for k in ("scores", "fixes", "similarity_risk")})
                        + "\n</nhan_xet_giam_khao>\n" if review else "")
                     + ai.checks_text(found or [])
                     + "\nViết lại toàn bộ, sửa hết các điểm giám khảo và kiểm tra tự động nêu, giữ phần đã tốt.")
    if piece.get("feedback"):
        parts.append(f"<yeu_cau_cua_nguoi_dung>\n{piece['feedback']}\n</yeu_cau_cua_nguoi_dung>\nƯu tiên làm đúng yêu cầu này.")
    big = piece["type"] in ("seo_article", "landing_page")
    return structured_call(SYSTEM, "\n\n".join(parts), t["schema"], max_tokens=32000 if big else 16000,
                           model=STUDIO_MODEL)


def run_checks(piece: dict, content: dict) -> list[dict]:
    return TYPES[piece["type"]]["checks"](content, piece["inputs"], piece.get("author"))


def title_of(type_key: str, c: dict | None, inputs: dict) -> str:
    c = c or {}
    first = lambda xs: (xs or [""])[0]   # noqa: E731
    t = (c.get("title") or c.get("h1") or c.get("name") or (c.get("hero") or {}).get("headline")
         or first(c.get("subject_lines")) or first(c.get("hooks")) or "")
    return (t or inputs.get("topic") or inputs.get("keyword") or TYPES[type_key]["label"]).strip().split("\n")[0][:160]
