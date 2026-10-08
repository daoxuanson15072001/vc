"""Bảng thuật ngữ dịch (BA: collection `glossary`) rút từ chính lời thợ Việt trong Kho tư liệu và thẻ VCWIKI.

Hai bước, chạy bằng scripts/build_glossary.py (job đêm chạy `update`: rút phần mới rồi gộp):
1. rút: mỗi nguồn tiếng Việt ngành ô tô — tài liệu Kho tư liệu (lĩnh vực nganh-o-to hoặc kênh sửa xe: video,
   PDF, bài viết) và thẻ VCWIKI chưa bị loại — AI local liệt kê thuật ngữ kỹ thuật, cách viết chuẩn, chữ máy đã
   nghe (có khi nhầm) và từ tương đương tiếng Trung / Anh. Lưu thô theo nguồn ở `glossary_raw`; nguồn sửa sau
   lần rút (updated_at mới hơn) thì rút lại.
2. gộp: thuật ngữ gặp ở nhiều nguồn / nhiều kênh vào `glossary` (status "auto"). Thẻ đã biên tập đáng tin hơn lời
   nói: mỗi thẻ tính bằng THẺ_NẶNG nguồn, thẻ đã duyệt thì một thẻ là đủ. Người sửa / duyệt được ("approved" /
   "rejected"), gộp lại không ghi đè bản người đã sửa.

Khi dịch, `hints` tìm thuật ngữ ngoại ngữ có trong lô câu và đưa kèm cách gọi của thợ Việt; `whisper_prompt`
đưa thuật ngữ tiếng gốc cho Whisper nghe sát hơn.
"""

from __future__ import annotations

import re
import time
from collections import Counter, defaultdict

from .. import db
from . import local_ai

glossary = db.db["glossary"]
raw = db.db["glossary_raw"]
documents = db.db["kb_documents"]
cards = db.db["wiki_cards"]

CATEGORY = "nganh-o-to"
# kênh sửa xe đã nạp trước khi có cây lĩnh vực: tài liệu của chúng có thể chưa gắn nganh-o-to
AUTO_CHANNELS = ("chinhphuocautogarage", "xeyeu.vlog", "carplusautoservice", "trunganh_garage", "gocgara",
                 "autotechhopsotudong", "ccmfast5251", "ccmfastgarage", "vcpartsphutungoto")
CARD_WEIGHT = 2             # một thẻ VCWIKI tính bằng bấy nhiêu nguồn lời nói
CARD_GROUP = "vcwiki"

LANGS = ("zh", "en")
MAX_CHARS = 5000            # chữ mỗi video gửi AI local (context 4k token)
MIN_VIDEOS, MIN_CHANNELS = 3, 2
MAX_HINTS = 20
CACHE_TTL = 300

SYSTEM = """Bạn lập bảng thuật ngữ sửa chữa ô tô cho người dịch. Đọc nội dung tiếng Việt (lời thợ nói chép bằng máy \
nên có chỗ nghe nhầm, hoặc bài viết / thẻ kiến thức), chỉ lấy thuật ngữ kỹ thuật CÓ TRONG nội dung: tên chi tiết / \
cụm cụ thể, triệu chứng, thao tác sửa cụ thể, tên máy / phần mềm. Không lấy từ chung chung, tên người, gara, giá \
tiền, mã xe trần. Mỗi thuật ngữ:
- vi: cách thợ Việt gọi, viết chuẩn chính tả (sửa lỗi máy nghe nhầm nếu có)
- heard: đúng chữ như trong nội dung nếu khác vi, không thì rỗng
- zh: tên tiếng Trung giản thể thợ Trung Quốc hay dùng, chỉ chữ Hán (không pinyin)
- en: tên tiếng Anh chuẩn ngành
Tối đa 15 thuật ngữ, quan trọng trước."""
# từ chung chung AI hay đưa vào dù đã dặn
GENERIC = {"lỗi", "hỏng", "hỏng hóc", "bộ phận", "chi tiết", "thao tác", "dụng cụ", "thay thế", "thay mới", "kiểm tra",
           "vệ sinh", "sửa chữa", "bảo dưỡng", "xe", "ô tô", "xe ô tô", "phụ tùng", "hệ thống", "phần mềm",
           "phần mềm chẩn đoán", "máy chuyên dụng", "chi phí", "khách hàng", "gara", "thợ", "tháo", "lắp",
           "lắp lại", "tháo lắp", "tháo ra", "lắp vào", "thay", "đo", "test", "sửa", "chạy thử"}

SCHEMA = {"type": "object", "additionalProperties": False, "required": ["terms"],
          "properties": {"terms": {"type": "array", "items": {
              "type": "object", "additionalProperties": False, "required": ["vi", "heard", "zh", "en"],
              "properties": {"vi": {"type": "string"}, "heard": {"type": "string"},
                             "zh": {"type": "string"}, "en": {"type": "string"}}}}}}

PARENS = re.compile(r"\s*[(（][^()（）]*[)）]")

_cache: tuple[float, dict] | None = None


def norm(vi: str) -> str:
    return re.sub(r"\s+", " ", vi.strip().lower())


def extract_text(title: str, text: str) -> list[dict]:
    """Một nguồn -> thuật ngữ có thật trong chữ của nguồn (AI hay chép lại ví dụ / từ trong lời dặn)."""
    body = (text or "")[:MAX_CHARS]
    data = local_ai.structured_call(SYSTEM, f"Tiêu đề: {(title or '')[:200]}\n\nNội dung:\n{body}",
                                    SCHEMA, engine="local", max_tokens=1200)
    spoken = norm(body)
    out = []
    for t in data["terms"][:15]:
        t = {k: PARENS.sub("", t[k]).strip() for k in ("vi", "heard", "zh", "en")}   # bỏ pinyin / chú thích
        if 2 <= len(t["vi"]) <= 60 and _grounded(t, spoken):
            out.append(t)
    return out


def extract(v: dict) -> list[dict]:
    """Một video (bảng videos) -> thuật ngữ."""
    return extract_text(v.get("caption") or "", v.get("transcript") or "")


def _grounded(t: dict, spoken: str) -> bool:
    return norm(t["vi"]) not in GENERIC and any(x and norm(x) in spoken for x in (t["vi"], t.get("heard")))


def _card_text(c: dict) -> str:
    parts = [c.get("title"), c.get("summary"), c.get("body"), "\n".join(c.get("key_points") or []),
             c.get("when_to_use"), c.get("example")]
    return "\n\n".join(str(x) for x in parts if x)


def sources(limit: int = 0, per_group: int = 0):
    """Nguồn cần rút (chưa rút / sửa sau lần rút), mới trước: {key, kind, group, approved, title, text}.
    Video trong Kho tư liệu dùng khoá = id video để khớp lượt rút cũ theo bảng videos."""
    done = {r["_id"]: r.get("at") for r in raw.find({}, {"at": 1})}
    fresh = lambda key, updated: key not in done or (updated and done[key] and updated > done[key])  # noqa: E731
    count: Counter = Counter()
    n = 0
    q = {"$or": [{"categories": {"$regex": f"^{CATEGORY}"}}, {"meta.channel_handle": {"$in": list(AUTO_CHANNELS)}}],
         "meta.language": {"$in": ["vi", None]}, "chars": {"$gte": 200}}
    for d in documents.find(q, {"title": 1, "text": 1, "meta": 1, "source_id": 1, "updated_at": 1}).sort("_id", -1):
        meta = d.get("meta") or {}
        key = meta.get("video_id") or f"doc:{d['_id']}"
        group = meta.get("channel_handle") or f"src:{d.get('source_id')}"
        if not fresh(key, d.get("updated_at")) or (per_group and count[group] >= per_group):
            continue
        count[group] += 1
        yield {"key": key, "kind": "video" if meta.get("video_id") else "document", "group": group,
               "approved": False, "title": d.get("title") or "", "text": d.get("text") or ""}
        n += 1
        if limit and n >= limit:
            return
    cq = {"categories": {"$regex": f"^{CATEGORY}"}, "status": {"$ne": "rejected"}}
    for c in cards.find(cq).sort("_id", -1):
        key = f"card:{c['_id']}"
        if not fresh(key, c.get("updated_at")):
            continue
        yield {"key": key, "kind": "card", "group": CARD_GROUP, "approved": c.get("status") == "approved",
               "title": c.get("title") or "", "text": _card_text(c)}
        n += 1
        if limit and n >= limit:
            return


def save_raw(src: dict, terms: list[dict]) -> None:
    raw.update_one({"_id": src["key"]}, {"$set": {"channel": src["group"], "kind": src["kind"], "terms": terms,
                                                  "approved": src["approved"], "grounded": True, "at": db.now()}},
                   upsert=True)


def aggregate(min_videos: int = MIN_VIDEOS, min_channels: int = MIN_CHANNELS) -> list[dict]:
    """`glossary_raw` -> mục bảng thuật ngữ đủ ngưỡng (chưa ghi). min_videos tính theo trọng số nguồn."""
    groups: dict[str, dict] = defaultdict(lambda: {"weight": 0, "sources": set(), "cards": 0, "approved": False,
                                                  "channels": set(), "vi": Counter(), "heard": Counter(),
                                                  "zh": Counter(), "en": Counter()})
    # lượt rút cũ (theo bảng videos, chưa lọc lúc rút): đối chiếu lời nói ở đây
    legacy = raw.distinct("_id", {"grounded": {"$ne": True}})
    spoken = {v["_id"]: norm(v.get("transcript") or "")
              for v in db.videos.find({"_id": {"$in": legacy}}, {"transcript": 1})} if legacy else {}
    rejected = {f"card:{c['_id']}" for c in cards.find({"status": "rejected"}, {"_id": 1})}
    for r in raw.find({"_id": {"$nin": list(rejected)}}, {"channel": 1, "terms": 1, "kind": 1, "approved": 1,
                                                          "grounded": 1}):
        card = r.get("kind") == "card"
        for t in r.get("terms") or []:
            key = norm(t["vi"])
            if not r.get("grounded") and not _grounded(t, spoken.get(r["_id"], "")):
                continue
            g = groups[key]
            if r["_id"] in g["sources"]:
                continue
            g["sources"].add(r["_id"])
            g["weight"] += CARD_WEIGHT if card else 1
            g["cards"] += card
            g["approved"] |= bool(r.get("approved"))
            g["channels"].add(r.get("channel"))
            g["vi"][t["vi"].strip()] += 1
            for k in ("heard", "zh", "en"):
                if t.get(k) and (k != "heard" or norm(t[k]) != norm(t["vi"])):
                    g[k][t[k].strip()] += 1
    out = []
    for key, g in groups.items():
        if not g["approved"] and (g["weight"] < min_videos or len(g["channels"]) < min_channels):
            continue
        out.append({"_id": key, "vi": g["vi"].most_common(1)[0][0],
                    "heard": [h for h, _ in g["heard"].most_common(5)],
                    "terms": {lang: [x for i, (x, n) in enumerate(g[lang].most_common(2)) if i == 0 or n >= 2]
                              for lang in LANGS},
                    "videos": len(g["sources"]) - g["cards"], "cards": g["cards"],
                    "channels": sorted(c for c in g["channels"] if c), "categories": [CATEGORY]})
    out.sort(key=lambda e: -(e["videos"] + CARD_WEIGHT * e["cards"]))
    return out


def save(entries: list[dict]) -> int:
    """Ghi bảng thuật ngữ; mục người đã sửa / duyệt / loại (status khác "auto") chỉ cập nhật số đếm."""
    global _cache
    n = 0
    for e in entries:
        counts = {"videos": e["videos"], "cards": e.get("cards", 0), "channels": e["channels"], "heard": e["heard"],
                  "updated_at": db.now()}
        cur = glossary.find_one({"_id": e["_id"]}, {"status": 1})
        if cur and cur.get("status") != "auto":
            glossary.update_one({"_id": e["_id"]}, {"$set": counts})
        else:
            glossary.update_one({"_id": e["_id"]}, {"$set": e | counts | {"status": "auto"}}, upsert=True)
        n += 1
    _cache = None
    return n


def _index() -> dict[str, list[tuple[str, dict]]]:
    """{lang: [(thuật ngữ ngoại ngữ, mục)]}, dài trước để "盲点雷达" thắng "雷达"."""
    global _cache
    if _cache and time.time() - _cache[0] < CACHE_TTL:
        return _cache[1]
    idx: dict[str, list] = {lang: [] for lang in LANGS}
    for e in glossary.find({"status": {"$ne": "rejected"}}, {"vi": 1, "terms": 1, "videos": 1, "status": 1}):
        for lang in LANGS:
            for term in (e.get("terms") or {}).get(lang) or []:
                if len(term) >= (2 if lang == "zh" else 3):
                    idx[lang].append((term, e))
    for lang in idx:
        idx[lang].sort(key=lambda p: (-len(p[0]), -(p[1].get("status") == "approved"), -p[1].get("videos", 0)))
    _cache = (time.time(), idx)
    return idx


def _found(term: str, text: str, lang: str) -> bool:
    if lang == "zh":
        return term in text
    return re.search(rf"(?<!\w){re.escape(term.lower())}(?!\w)", text.lower()) is not None


def hints(texts: list[str], language: str | None) -> list[tuple[str, str]]:
    """Thuật ngữ ngoại ngữ có trong các câu -> [(thuật ngữ, cách thợ Việt gọi)], tối đa MAX_HINTS."""
    lang = "zh" if language in ("zh", "yue") else language
    if lang not in LANGS:
        return []
    try:
        idx = _index().get(lang) or []
    except Exception:  # noqa: BLE001 — không có bảng thuật ngữ thì dịch như cũ
        return []
    text, out, seen = "\n".join(texts), [], set()
    for term, e in idx:
        if e["_id"] in seen or not _found(term, text, lang):
            continue
        # "雷达" đã nằm trong "盲点雷达" vừa lấy thì bỏ
        if lang == "zh" and any(term in t for t, _ in out):
            continue
        out.append((term, e["vi"]))
        seen.add(e["_id"])
        if len(out) >= MAX_HINTS:
            break
    return out


def whisper_prompt(language: str | None, limit: int = 40) -> str | None:
    """Thuật ngữ tiếng gốc hay gặp, đưa Whisper làm ngữ cảnh (initial prompt) để nghe đúng từ chuyên ngành."""
    lang = "zh" if language in ("zh", "yue") else language
    if lang not in LANGS:
        return None
    try:
        idx = _index().get(lang) or []
    except Exception:  # noqa: BLE001
        return None
    rank: dict[str, tuple] = {}   # người đã duyệt trước, rồi thuật ngữ gặp ở nhiều video
    for t, e in idx:
        rank[t] = max(rank.get(t, (0, 0)), (e.get("status") == "approved", e.get("videos", 0)))
    terms = sorted(rank, key=lambda t: rank[t], reverse=True)[:limit]
    if not terms:
        return None
    return ("、" if lang == "zh" else ", ").join(terms)
