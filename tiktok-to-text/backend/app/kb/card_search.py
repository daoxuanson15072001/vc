"""Xếp hạng tìm thẻ VCWIKI (search_cards web + MCP) — cách xếp v2 (yêu cầu 6ab85363…e539, BA 4.4).

Nhánh chữ: chỉ mục BM25F trong RAM (kb/lexical.py `FieldIndex`) trên các trường của thẻ, trọng số
tiêu đề > tag > tóm tắt > ý chính > khi nào dùng > nội dung; mỗi trường chuẩn hoá độ dài; cặp âm tiết liền nhau là
thưởng khi khớp cả cụm. Thẻ khớp ít nhất một từ của câu hỏi — không còn bắt buộc đủ mọi từ, không xếp theo ngày.
Chỉ mục dựng lần tìm đầu (~1 giây / 1.500 thẻ); thẻ tạo / sửa / duyệt / quay về bản cũ (đổi `updated_at`) được đọc lại
ngay lúc tìm; phần đọc lại nhiều hoặc chỉ mục cũ quá REBUILD_SECS thì dựng lại nền.

Gộp với nhánh nghĩa (kb/embeddings.py) bằng RRF có trọng số: câu ≥ LONG_QUERY âm tiết thì nghĩa : chữ = 2 : 1 và thẻ
chỉ khớp chữ xếp sau mọi thẻ gần nghĩa; câu ngắn 1 : 1. Thẻ chỉ khớp chữ (không gần nghĩa) phải qua cổng độ phủ
(TEXT_ONLY_*). Hoà điểm xếp theo độ giống nghĩa rồi điểm chữ rồi id — không ưu tiên bên chữ, không theo ngày.
Khi không tìm theo nghĩa được (SEARCH_SEMANTIC=0, AI local tắt / lỗi): chỉ nhánh chữ, lấy thẻ phủ ≥ TEXT_COVER.

Biến môi trường: `SEARCH_RANKING` (`v2` mặc định; `v1` = cách xếp cũ: regex đủ mọi từ, BM25 một trường, RRF đều —
đường lui, sẽ bỏ khi v2 chạy ổn).
"""

from __future__ import annotations

import threading
import time
from typing import Any, Iterable

from .. import db
from ..config import SEARCH_RANKING
from . import lexical

RANKING = SEARCH_RANKING

cards = db.db["wiki_cards"]

WEIGHTS = {"title": 3.0, "tags": 2.5, "summary": 2.0, "key_points": 1.5, "when_to_use": 1.2, "body": 1.0}
B = {"title": 0.3, "tags": 0.3, "summary": 0.5, "key_points": 0.6, "when_to_use": 0.5, "body": 0.8}
STRONG = ("title", "tags", "summary")
PROJECTION = {"title": 1, "tags": 1, "summary": 1, "key_points": 1, "when_to_use": 1, "body": 1, "example": 1,
              "fields": 1, "updated_at": 1}

RRF_K = 60
LONG_QUERY = 6            # âm tiết: câu từ bấy nhiêu âm tiết trở lên thì nghĩa nặng hơn chữ
SEMANTIC_WEIGHT_LONG = 2.0
TEXT_TOPK = 300           # số thẻ khớp chữ tốt nhất đem gộp
# Thẻ chỉ khớp chữ (không gần nghĩa) được nhận khi: cả thẻ phủ ≥ TEXT_ONLY_COVER idf các âm tiết câu hỏi VÀ riêng
# tiêu đề / tag / tóm tắt phủ ≥ TEXT_ONLY_STRONG (0 = chỉ cần khớp ít nhất một từ ở đó). Câu dài có ngưỡng riêng.
TEXT_ONLY_COVER, TEXT_ONLY_STRONG = 0.7, 0.4
TEXT_ONLY_COVER_LONG, TEXT_ONLY_STRONG_LONG = 0.5, 0.0
TEXT_COVER = 0.6          # chỉ tìm chữ (nhánh nghĩa tắt): phủ tối thiểu
RERANK_HEAD = 15          # số thẻ đầu đem rerank (≤ RERANK_TOPN): v2 luôn đủ ứng viên nên 30 làm p95 tăng ~50 %.
                          # Đo 27/09: 15 giữ mọi kind trên test trong ±2 điểm so với v1; 20 dev cao hơn chút nhưng
                          # câu dài (dien-dat-khac) trên test tụt 5 điểm MRR
REBUILD_SECS = 1800       # chỉ mục cũ hơn bấy nhiêu giây thì dựng lại nền (bắt cả thay đổi không đổi updated_at)
DELTA_MAX = 200           # số thẻ đọc lại (đổi sau khi dựng) vượt mức này thì dựng lại nền

_index: lexical.FieldIndex | None = None
_built_at = 0.0
_lock = threading.Lock()
_rebuilding = False


def card_fields(c: dict) -> dict[str, str]:
    extra = " ".join(f"{k} {v}" for k, v in (c.get("fields") or {}).items())
    return {"title": c.get("title") or "", "tags": " ".join(c.get("tags") or []), "summary": c.get("summary") or "",
            "key_points": "\n".join(c.get("key_points") or []), "when_to_use": c.get("when_to_use") or "",
            "body": "\n".join(p for p in (c.get("body"), c.get("example"), extra) if p)}


def _items(f: dict) -> Iterable[tuple[Any, Any, dict[str, str]]]:
    for c in cards.find(f, PROJECTION):
        yield c["_id"], c.get("updated_at"), card_fields(c)


def _build() -> lexical.FieldIndex:
    return lexical.FieldIndex(WEIGHTS, B, STRONG).build(_items({}))


def _rebuild_bg() -> None:
    global _index, _built_at, _rebuilding
    try:
        idx, at = _build(), time.time()
        with _lock:
            _index, _built_at = idx, at
    except Exception as e:   # noqa: BLE001 — giữ chỉ mục cũ
        print(f"Chỉ mục chữ thẻ: dựng lại lỗi — {str(e)[:150]}")
    finally:
        _rebuilding = False


def index() -> lexical.FieldIndex:
    global _index, _built_at, _rebuilding
    with _lock:
        if _index is None:
            _index, _built_at = _build(), time.time()
        idx = _index
        stale = len(idx.delta) > max(DELTA_MAX, len(idx) // 20) or time.time() - _built_at > REBUILD_SECS
        if stale and not _rebuilding:
            _rebuilding = True
            threading.Thread(target=_rebuild_bg, name="card-text-index", daemon=True).start()
    return idx


def reset() -> None:
    """Bỏ chỉ mục (test: mỗi test một DB mới)."""
    global _index, _built_at
    with _lock:
        _index, _built_at = None, 0.0


def touch(ids: Iterable) -> None:
    """Thẻ đổi nội dung mà không đổi updated_at (vd tag lan từ tài liệu): lần tìm sau đọc lại."""
    if _index is not None:
        _index.invalidate(list(ids))


def text_search(f: dict, q: str) -> dict[Any, tuple[float, float, float]]:
    """Thẻ khớp bộ lọc `f` chứa ít nhất một từ của câu hỏi -> {id: (điểm BM25F, độ phủ ở tiêu đề / tag / tóm tắt,
    độ phủ cả thẻ)}."""
    allowed = {r["_id"]: r.get("updated_at") for r in cards.find(f, {"updated_at": 1})}
    return index().search(q, allowed, lambda ids: _items({"_id": {"$in": ids}}))


def _order(hits: dict) -> list:
    return sorted(hits, key=lambda i: (-hits[i][0], str(i)))


def text_only(f: dict, q: str) -> list[tuple[Any, str, None, float]]:
    """Khi không tìm theo nghĩa được: thẻ phủ ≥ TEXT_COVER idf câu hỏi, xếp theo BM25F."""
    hits = {k: v for k, v in text_search(f, q).items() if v[2] >= TEXT_COVER}
    return [(i, "text", None, round(hits[i][0], 3)) for i in _order(hits)]


def is_long(q: str) -> bool:
    return len(lexical.syllables(q)) >= LONG_QUERY


def rerank_head(q: str, fused: list[tuple]) -> int:
    """Số thẻ đầu đem rerank: RERANK_HEAD; câu dài thì không gồm phần đuôi chỉ khớp chữ (giữ nó dưới thẻ gần nghĩa).
    Không có thẻ gần nghĩa nào (hay gặp ở câu dài không dấu) -> 0, không rerank, `reranked` = false: đo 27/09 cho rerank
    phần đuôi này làm câu không dấu tụt (MRR test +25 -> +8 điểm so với v1)."""
    if not is_long(q):
        return RERANK_HEAD
    return min(RERANK_HEAD, sum(1 for x in fused if x[1] != "text"))


def hybrid(f: dict, q: str, semantic: list[tuple[Any, float]]) -> list[tuple[Any, str, float | None, float | None]]:
    """Gộp nhánh chữ + nhánh nghĩa -> [(id, match, semantic_score, text_score)] theo thứ tự.

    Câu ngắn: RRF chữ : nghĩa = 1 : 1 trên thẻ gần nghĩa + thẻ chỉ khớp chữ qua cổng. Câu dài: RRF nghĩa : chữ =
    SEMANTIC_WEIGHT_LONG : 1 chỉ trên thẻ gần nghĩa (thứ hạng chữ tính trong nhóm này); thẻ chỉ khớp chữ qua cổng xếp
    SAU mọi thẻ gần nghĩa, theo điểm chữ — chỉ lấp chỗ khi nhánh nghĩa trả ít."""
    hits = text_search(f, q)
    sims = dict(semantic)
    long_ = is_long(q)
    cover, strong = (TEXT_ONLY_COVER_LONG, TEXT_ONLY_STRONG_LONG) if long_ else (TEXT_ONLY_COVER, TEXT_ONLY_STRONG)
    ranked = _order(hits)[:TEXT_TOPK]
    extra = [i for i in ranked if i not in sims and hits[i][2] >= cover and hits[i][1] > 0 and hits[i][1] >= strong]
    text_ids = [i for i in ranked if i in sims] + ([] if long_ else extra)
    text_ids.sort(key=lambda i: (-hits[i][0], str(i)))
    ws = SEMANTIC_WEIGHT_LONG if long_ else 1.0
    score: dict[Any, float] = {}
    for rank, cid in enumerate(text_ids):
        score[cid] = score.get(cid, 0.0) + 1.0 / (RRF_K + rank)
    for rank, (cid, _) in enumerate(semantic):
        score[cid] = score.get(cid, 0.0) + ws / (RRF_K + rank)
    order = sorted(score, key=lambda c: (-score[c], -(sims.get(c) or 0.0), -(hits[c][0] if c in hits else 0.0), str(c)))
    if long_:
        order += extra
    text_set = set(text_ids) | set(extra)
    return [(c, "both" if c in text_set and c in sims else "text" if c in text_set else "semantic", sims.get(c),
             round(hits[c][0], 3) if c in hits else None) for c in order]
