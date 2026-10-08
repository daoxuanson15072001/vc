"""Cổng so sánh (GOV-03 — docs/BA.md mục 16.2): thẻ nháp có phải tri thức mới không.

Hai bước, đều là hàm thuần (chỉ đọc DB, không ghi gì):

1. `find_candidates(draft, user)` — tìm tối đa 10 thẻ gần nhất trong phạm vi người đề xuất xem được
   (`policy.visible_filter`). Có embedding AI local (bge-m3) thì tìm theo nghĩa, không thì tìm chữ không dấu
   (chấm điểm trùng từ / cụm hai từ).
2. `classify(draft, user)` — AI xếp một trong 5 loại MỚI / TRÙNG / BỔ SUNG / MÂU THUẪN / NHIỄU, nêu lý do và thẻ
   liên quan. Trả đúng dạng `change_requests.novelty`. Không có AI (hoặc AI lỗi) thì dùng luật đơn giản,
   `engine="heuristic"` — luồng gọi có thể chạy lại khi AI sẵn sàng.

Đợt 1: chỉ phần lõi, chưa nối vào pipeline / endpoint `POST /api/wiki/novelty` (luồng F nối).
Biến môi trường:
- `NOVELTY_ENGINE`: `auto` (mặc định — như dựng thẻ: Claude, hết quota / không có key thì AI local) hoặc `local`
  (AI local trước, lỗi thì Claude — hợp với việc nhiều lượt, dữ liệu không rời máy).
- `NOVELTY_EMBED`: `1` (mặc định) dùng embedding khi AI local có model embedding; `0` chỉ tìm chữ.
"""

from __future__ import annotations

import math
import re
from typing import Any

import httpx

from .. import db, policy
from .. import config
from ..config import LOCAL_LLM_CTX
from . import embeddings, local_ai, wiki
from .pipeline import cards

VERDICTS = ("new", "duplicate", "supplement", "conflict", "noise")
VERDICT_LABELS = {"new": "MỚI", "duplicate": "TRÙNG", "supplement": "BỔ SUNG", "conflict": "MÂU THUẪN",
                  "noise": "NHIỄU"}

NOVELTY_ENGINE = config.NOVELTY_ENGINE   # changes.py đặt "local" nếu môi trường không khai báo
USE_EMBED = config.NOVELTY_EMBED

POOL_MAX = 2000          # số thẻ tối đa đọc lên để chấm điểm chữ
EMBED_POOL = 400         # số thẻ tối đa đem so theo nghĩa (thẻ nhiều hơn: lấy các thẻ điểm chữ cao nhất)
# Ngưỡng độ giống theo nghĩa (bge-m3) để một thẻ được đưa cho AI so. Thẻ dưới ngưỡng chỉ "cùng lĩnh vực"; đưa vào thì
# model nhỏ hay xếp nhầm MỚI thành BỔ SUNG. Bộ mẫu: ca MỚI có thẻ gần nhất ≤ 0,69, ca TRÙNG / BỔ SUNG / MÂU THUẪN ≥ 0,72.
# Cần hiệu chỉnh lại khi có dữ liệu người duyệt đổi kết quả (BA 16.2). Chỉ áp dụng khi tìm theo embedding.
EMBED_RELATED_MIN = config.NOVELTY_EMBED_MIN
DUP_TEXT_SCORE = 0.6    # heuristic: điểm trùng chữ từ mức này coi là TRÙNG
DUP_EMBED_SCORE = 0.93   # heuristic: độ giống theo nghĩa từ mức này (kèm điểm chữ ≥ 0,35) coi là TRÙNG
CARD_FIELDS = {"title": 1, "summary": 1, "body": 1, "key_points": 1, "tags": 1, "categories": 1, "status": 1,
               "type": 1, "space_id": 1, "current_revision": 1, "version": 1, "updated_at": 1}

# Từ quá phổ biến trong tiếng Việt (đã bỏ dấu) — không dùng để chấm điểm trùng
STOPWORDS = set("""
va cua la cho cac nhung mot co khong duoc trong voi de khi thi nay do se da dang tu ra vao len nhu theo tai ve
hon rat cung bi boi neu hay hoac moi nhieu it can phai nen lai con nao gi ai minh ban toi chung ta ho no
cai viec nguoi lam khac tren duoi sau truoc giua bang qua den nhat them tung moi deu chi van dung roi luc
the nhu vay vi sao tai thanh mat nhung neu ma o nua sang
""".split())

_embed_cache = embeddings._cache   # nhớ RAM dùng chung với tìm theo nghĩa


# ---------------------------------------------------------------------------
# Tìm ứng viên
# ---------------------------------------------------------------------------

card_text = embeddings.card_text   # tiêu đề, tóm tắt, ý chính, thân bài


def _tokens(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", db.unaccent(text)) if w not in STOPWORDS and len(w) > 1]


def _features(text: str) -> set[str]:
    """Từ đơn + cụm hai từ liền nhau (tiếng Việt ghép từ theo âm tiết: 'phu tung', 'dong tien')."""
    words = _tokens(text)
    return set(words) | {f"{a} {b}" for a, b in zip(words, words[1:])}


def text_score(a: set[str], b: set[str]) -> float:
    """Độ trùng hai tập đặc trưng (cosine trên tập): 1 = y hệt, 0 = không chung từ nào."""
    if not a or not b:
        return 0.0
    return len(a & b) / math.sqrt(len(a) * len(b))


def _keywords(draft: dict, limit: int = 15) -> list[str]:
    """Từ khoá từ tiêu đề + tóm tắt để lọc sơ bộ khi kho quá nhiều thẻ."""
    words = _tokens(f"{draft.get('title') or ''} {draft.get('summary') or ''}")
    return sorted(set(words), key=len, reverse=True)[:limit]


def _embed_ready() -> bool:
    return USE_EMBED and embeddings.ready()


def _embed_text(card: dict) -> str:
    return embeddings.embed_text(card)


def _cosine(a, b) -> float:
    """Vector đã chuẩn hoá (embeddings._norm) nên cosine = tích vô hướng."""
    return embeddings._dot(embeddings._norm(a), embeddings._norm(b))


def _card_vectors(pool: list[dict]) -> list:
    """Embedding của các thẻ — lưu bền trong `card_embeddings` + nhớ RAM theo nội dung (kb/embeddings.py)."""
    return embeddings.vectors_for(pool)


def rev_of(card: dict) -> int:
    """Phiên bản hiệu lực của thẻ; thẻ chưa chuyển sang lịch sử phiên bản coi là bản 1 (BA 16.5 quy tắc 4)."""
    return int(card.get("current_revision") or card.get("version") or 1)


def find_candidates(draft: dict, user: dict, limit: int = 10, include_drafts: bool = False) -> list[dict]:
    """Thẻ gần nhất với `draft` mà `user` xem được: `[{card, score, method, text_score}]`, điểm giảm dần.

    - Chỉ thẻ `approved` (thêm `draft` khi `include_drafts`), bỏ thẻ lỗi thời và bỏ chính thẻ nháp (`draft["_id"]`).
    - `method`: `embedding` (score = độ giống theo nghĩa, cosine bge-m3) hoặc `text` (score = độ trùng từ).
    - `text_score` luôn có — dùng cho luật heuristic.
    """
    statuses = ["approved", "draft"] if include_drafts else ["approved"]
    f: dict[str, Any] = policy.visible_filter(user) | {"status": {"$in": statuses},
                                                       "obsolete": {"$in": [None, False]}}
    if draft.get("_id") is not None:
        f["_id"] = {"$ne": draft["_id"]}
    if cards.count_documents(f) > POOL_MAX and (kw := _keywords(draft)):
        f["search_text"] = {"$regex": "|".join(re.escape(w) for w in kw)}
    pool = list(cards.find(f, CARD_FIELDS).limit(POOL_MAX))
    if not pool:
        return []

    feats = _features(card_text(draft))
    scored = sorted(((text_score(feats, _features(card_text(c))), c) for c in pool),
                    key=lambda x: x[0], reverse=True)
    if _embed_ready():
        try:
            top = scored[:EMBED_POOL]
            qvec = local_ai.embed([_embed_text(draft)])[0]
            vecs = _card_vectors([c for _, c in top])
            ranked = sorted(((_cosine(qvec, v), ts, c) for v, (ts, c) in zip(vecs, top)),
                            key=lambda x: x[0], reverse=True)
            return [{"card": c, "score": round(s, 4), "method": "embedding", "text_score": round(ts, 4)}
                    for s, ts, c in ranked[:limit]]
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
            print(f"Cổng so sánh: embedding lỗi, tìm theo chữ — {str(e)[:150]}")
    return [{"card": c, "score": round(s, 4), "method": "text", "text_score": round(s, 4)}
            for s, c in scored[:limit] if s > 0]


# ---------------------------------------------------------------------------
# Xếp loại
# ---------------------------------------------------------------------------

SYSTEM = """Bạn là người gác cổng của VCWIKI — kho tri thức nội bộ tập đoàn VC Phồn Vinh (phụ tùng ô tô, garage, \
đào tạo nghề ô tô, phần mềm; các khối kinh doanh, marketing, tài chính, kế toán, nhân sự, kỹ thuật).
Một THẺ NHÁP sắp được đưa vào kho. Hãy so nó với các THẺ ĐÃ CÓ (đánh số [1], [2]…) và xếp đúng MỘT loại:

- noise (NHIỄU): thẻ nháp không có giá trị tri thức cho doanh nghiệp — chào hỏi, quảng cáo / khuyến mãi không \
kèm bài học, lịch họp, thông báo hành chính nhất thời, chuyện cá nhân, câu chung chung ai cũng biết, không áp dụng \
được. Xét loại này TRƯỚC, không cần so với thẻ đã có.
- duplicate (TRÙNG): một thẻ đã có nói CÙNG ý, cùng số liệu / bước / kết luận; thẻ nháp chỉ diễn đạt lại, \
không thêm gì đáng kể.
- supplement (BỔ SUNG): cùng chủ đề với một thẻ đã có, KHÔNG trái với thẻ đó, nhưng thêm chi tiết mới có giá trị: \
số liệu, bước, ví dụ, điều kiện áp dụng, ngoại lệ, nguyên nhân.
- conflict (MÂU THUẪN): thẻ nháp nói NGƯỢC hoặc KHÁC một thẻ đã có về cùng một việc trong cùng điều kiện — khác \
con số, khác thời hạn, khác mức giá / chiết khấu, khác thứ tự bước, khuyên điều thẻ cũ cấm (hoặc ngược lại). Hai \
điều không thể cùng đúng. Chỉ cần MỘT điểm trái nhau là mâu thuẫn, dù thẻ nháp có thêm chi tiết khác.
- new (MỚI): không thẻ đã có nào nói ý này. Cùng lĩnh vực / chủ đề rộng nhưng khác ý cụ thể vẫn là MỚI.

Cách phân biệt:
- So từng con số, thời hạn, điều kiện, bước làm. Khác nhau mà cùng điều kiện → conflict; thêm cái thẻ cũ chưa \
nói → supplement; giống hết → duplicate.
- Điều kiện khác nhau (loại xe khác, nhóm khách khác, kênh khác) nên không trái nhau → supplement hoặc new, \
không phải conflict.
- Chỉ chọn thẻ đã có thật sự liên quan; new / noise thường không có thẻ liên quan.

Trả lời: `reason` bằng tiếng Việt, 1–2 câu, nêu tên thẻ liên quan và điểm giống / khác / trái nhau; `related` là \
số thứ tự các thẻ đã có liên quan (duplicate / supplement / conflict bắt buộc có ít nhất một, thẻ liên quan nhất \
đứng đầu); `verdict` là một trong: new, duplicate, supplement, conflict, noise."""

DRAFT_CHARS = 1500       # giới hạn độ dài thẻ nháp đưa cho AI
CAND_CHARS = 600         # giới hạn mỗi thẻ đã có


def output_schema(n_candidates: int) -> dict:
    verdicts = list(VERDICTS) if n_candidates else ["new", "noise"]
    return {
        "type": "object",
        "properties": {
            "reason": {"type": "string", "description": "Lý do ngắn, tiếng Việt, nêu tên thẻ liên quan"},
            "related": {"type": "array", "items": {"type": "integer", "minimum": 1, "maximum": max(n_candidates, 1)},
                        "description": "Số thứ tự thẻ đã có liên quan, liên quan nhất đứng đầu"},
            "verdict": {"type": "string", "enum": verdicts},
        },
        "required": ["reason", "related", "verdict"],
        "additionalProperties": False,
    }


def _clip(text: str, n: int) -> str:
    text = re.sub(r"\n{3,}", "\n\n", (text or "").strip())
    return text if len(text) <= n else text[:n].rstrip() + "…"


def _card_block(card: dict, n: int) -> str:
    lines = [f"Tiêu đề: {card.get('title') or '(không tiêu đề)'}"]
    if card.get("summary"):
        lines.append(f"Tóm tắt: {card['summary']}")
    if card.get("key_points"):
        lines.append("Ý chính: " + "; ".join(card["key_points"]))
    if card.get("body"):
        lines.append(f"Nội dung: {card['body']}")
    return _clip("\n".join(lines), n)


def _prompt_budget() -> int:
    """Số ký tự tối đa cho phần nội dung, để vừa context AI local (~3 ký tự / token, chừa chỗ cho câu trả lời)."""
    return max(3000, int(LOCAL_LLM_CTX * 3 * 0.7) - len(SYSTEM) - 600)


def build_prompt(draft: dict, candidates: list[dict]) -> tuple[str, int]:
    """Nội dung gửi AI + số thẻ đã có thực sự đưa vào (thẻ cuối bị bỏ nếu vượt độ dài cho phép)."""
    head = f"<the_nhap>\n{_card_block(draft, DRAFT_CHARS)}\n</the_nhap>"
    budget = _prompt_budget() - len(head)
    per = max(250, min(CAND_CHARS, budget // max(len(candidates), 1) - 20))
    blocks: list[str] = []
    for i, cand in enumerate(candidates, 1):
        block = f"[{i}]\n{_card_block(cand['card'], per)}"
        if sum(len(b) + 2 for b in blocks) + len(block) > budget:
            break
        blocks.append(block)
    body = "\n\n".join(blocks) if blocks else "(không có thẻ nào gần)"
    return f"{head}\n\n<the_da_co>\n{body}\n</the_da_co>", len(blocks)


def ai_available() -> bool:
    if NOVELTY_ENGINE == "local" and local_ai.ready():
        return True
    return wiki.ai_ready()


def _call_ai(system: str, content: str, schema: dict) -> dict:
    if NOVELTY_ENGINE == "local":
        return local_ai.structured_call(system, content, schema, engine="local", max_tokens=600)
    return wiki.structured_call(system, content, schema, max_tokens=600)


def _engine_name(usage: dict) -> str:
    model = (usage or {}).get("model") or "?"
    return model if model.startswith("local:") else f"claude:{model}"


def _related(candidates: list[dict], idx: list[int] | None = None) -> list[dict]:
    chosen = [candidates[i] for i in idx] if idx is not None else candidates
    return [{"card_id": c["card"]["_id"], "rev": rev_of(c["card"]), "score": c["score"]} for c in chosen]


def _title(c: dict) -> str:
    return f"«{c['card'].get('title') or '(không tiêu đề)'}»"


def heuristic(draft: dict, candidates: list[dict], note: str = "chưa có AI để so sánh sâu") -> dict:
    """Luật đơn giản khi không có AI: trùng chữ cao → TRÙNG, không có ứng viên → MỚI, còn lại → MỚI (cần người xem)."""
    base = {"engine": "heuristic"}
    if not card_text(draft).strip():
        return base | {"verdict": "noise", "related": [], "reason": "Thẻ nháp không có nội dung."}
    if not candidates:
        return base | {"verdict": "new", "related": [],
                       "reason": f"Không có thẻ nào gần trong phạm vi bạn xem được ({note})."}
    top = candidates[0]
    dup = top["text_score"] >= DUP_TEXT_SCORE or (
        top["method"] == "embedding" and top["score"] >= DUP_EMBED_SCORE and top["text_score"] >= 0.35)
    if dup:
        return base | {"verdict": "duplicate", "related": _related(candidates, [0]),
                       "reason": f"Nội dung gần như trùng thẻ {_title(top)} (điểm trùng {top['text_score']:.2f}; "
                                 f"{note})."}
    return base | {"verdict": "new", "related": _related(candidates[:3]),
                   "reason": f"Tạm xếp MỚI — {note}; thẻ gần nhất: {_title(top)} (điểm {top['score']:.2f}), "
                             f"người duyệt cần xem có phải BỔ SUNG / MÂU THUẪN không."}


def classify(draft: dict, user: dict, candidates: list | None = None) -> dict:
    """Xếp loại thẻ nháp theo BA 16.2. Trả đúng dạng `change_requests.novelty`:
    `{verdict, related: [{card_id, rev, score}], reason, engine}`; engine `claude:<model>` / `local:<model>` /
    `heuristic`. `candidates` = kết quả `find_candidates` (None thì tự tìm). Không ghi DB.
    Thẻ tìm theo embedding có độ giống dưới `EMBED_RELATED_MIN` không đưa cho AI so."""
    if candidates is None:
        candidates = find_candidates(draft, user)
    if not card_text(draft).strip():
        return heuristic(draft, candidates)
    if not ai_available():
        return heuristic(draft, candidates)

    comparable = [c for c in candidates if c["method"] != "embedding" or c["score"] >= EMBED_RELATED_MIN]
    content, n = build_prompt(draft, comparable)
    shown = comparable[:n]
    try:
        res = _call_ai(SYSTEM, content, output_schema(n))
    except (wiki.AINotReady, wiki.AIRetryLater, ValueError, KeyError, httpx.HTTPError) as e:
        return heuristic(draft, candidates, f"AI lỗi: {str(e)[:120]}")

    verdict = res.get("verdict")
    if verdict not in VERDICTS:
        return heuristic(draft, candidates, f"AI trả kết quả không hợp lệ: {verdict!r}")
    idx = list(dict.fromkeys(i - 1 for i in res.get("related") or [] if isinstance(i, int) and 1 <= i <= n))
    if verdict in ("duplicate", "supplement", "conflict") and not idx:
        if not shown:
            verdict = "new"   # AI nói giống thẻ cũ nhưng không có thẻ nào để so
        else:
            idx = [0]
    return {"verdict": verdict, "related": _related(shown, idx), "reason": (res.get("reason") or "").strip(),
            "engine": _engine_name(res.get("usage") or {})}
