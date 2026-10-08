"""Embedding thẻ VCWIKI (bge-m3 qua AI local) — dùng chung cho tìm thẻ theo nghĩa và cổng so sánh (kb/novelty.py).

- Lưu bền trong collection `card_embeddings`: `{_id: card_id, model, hash, marker, dim, vector, embedded_at}`.
  `vector` là float32 dạng nhị phân (4 KB / thẻ với bge-m3), `hash` = sha1 của nội dung đem embed (tiêu đề, tóm tắt,
  ý chính, thân bài), `marker` = `updated_at` của thẻ lúc embed — so nhanh xem thẻ đã đổi chưa mà không đọc nội dung.
- Nhớ thêm trong RAM (`_cache`: card_id -> (hash, marker, vector đã chuẩn hoá)).
- Ghi thẻ (tạo / sửa / duyệt đề xuất / quay về bản cũ / pipeline dựng thẻ) gọi `schedule(ids)`: một luồng nền tính
  lại embedding, AI local tắt thì bỏ qua — KHÔNG bao giờ chặn hay làm hỏng việc ghi thẻ. Thẻ còn thiếu / cũ lúc tìm
  cũng được xếp lịch tính nền; thẻ cũ vẫn dùng vector cũ trong lúc chờ.
- `semantic_search(f, q)` — cosine trong Python (numpy nếu có) trên tập thẻ khớp bộ lọc `f` (đã gồm phạm vi quyền).
  MongoDB community không có `$vectorSearch`; vài nghìn thẻ vẫn nhanh.
- Chạy bù cho thẻ cũ: backend/scripts/backfill_embeddings.py.

Biến môi trường:
- `SEARCH_SEMANTIC`: `1` (mặc định) tìm thẻ theo nghĩa khi AI local có model embedding; `0` chỉ tìm chữ như cũ,
  không tính embedding nền.
- `SEARCH_SEMANTIC_MIN` (mặc định 0,52): độ giống tối thiểu câu hỏi ↔ thẻ. Hiệu chỉnh trên bge-m3: câu hỏi cùng ý
  ≈ 0,53–0,67, khác chủ đề ≤ 0,50. `SEARCH_SEMANTIC_MARGIN` (0,10): chỉ giữ thẻ kém thẻ tốt nhất không quá mức này.
- `SEARCH_SEMANTIC_TOPK` (30): số thẻ tối đa lấy theo nghĩa. `SEARCH_EMBED_TIMEOUT` (8 giây): chờ embedding câu hỏi.
"""

from __future__ import annotations

import hashlib
import threading
import time
from array import array
from collections import OrderedDict
from typing import Any, Iterable

import httpx
from bson import Binary

from .. import db
from ..config import (LOCAL_EMBED_MODEL, SEARCH_EMBED_TIMEOUT, SEARCH_SEMANTIC, SEARCH_SEMANTIC_MARGIN,
                      SEARCH_SEMANTIC_MIN, SEARCH_SEMANTIC_TOPK)
from . import ai_slot, local_ai

try:
    import numpy as np
except ImportError:   # numpy có trong backend/requirements.txt; thiếu thì tính bằng Python thuần
    np = None
    print("Cảnh báo: thiếu numpy — tìm thẻ theo nghĩa tính cosine bằng Python thuần (chậm). "
          "Cài: .venv/bin/pip install -r backend/requirements.txt")

ENABLED = SEARCH_SEMANTIC
MIN_SCORE = SEARCH_SEMANTIC_MIN
MARGIN = SEARCH_SEMANTIC_MARGIN
TOPK = SEARCH_SEMANTIC_TOPK
QUERY_TIMEOUT = SEARCH_EMBED_TIMEOUT
POOL_MAX = 20000          # số thẻ tối đa đem so theo nghĩa trong một lượt tìm
BATCH = 32                # số đoạn văn mỗi lần gọi /v1/embeddings
DOWN_PAUSE = 60           # giây: embedding câu hỏi lỗi thì tạm chỉ tìm chữ, không chờ timeout mỗi lượt
TEXT_CHARS = 2000

# "thread" (mặc định): tính nền; "sync": tính ngay trong lượt gọi (test); "off": không tính (pytest mặc định)
MODE = "thread"

store = db.db["card_embeddings"]
cards = db.db["wiki_cards"]
TEXT_FIELDS = {"title": 1, "summary": 1, "key_points": 1, "body": 1, "updated_at": 1}

_cache: dict[str, tuple[str, Any, Any]] = {}          # card_id -> (hash, marker, vector đã chuẩn hoá)
_queries: OrderedDict[str, Any] = OrderedDict()       # câu hỏi -> vector (LRU)
_down_until = 0.0
_pending: set = set()
_lock = threading.Lock()
_worker: threading.Thread | None = None


# ---------------------------------------------------------------------------
# Nội dung, vector
# ---------------------------------------------------------------------------

def card_text(card: dict) -> str:
    """Nội dung thẻ để so: tiêu đề, tóm tắt, ý chính, thân bài."""
    parts = [card.get("title") or "", card.get("summary") or "", " ".join(card.get("key_points") or []),
             card.get("body") or ""]
    return "\n".join(p for p in parts if p)


def embed_text(card: dict) -> str:
    return card_text(card)[:TEXT_CHARS]


def text_hash(card: dict) -> str:
    return hashlib.sha1(f"{LOCAL_EMBED_MODEL}\n{embed_text(card)}".encode()).hexdigest()


def ready() -> bool:
    """AI local có model embedding (hỏi /v1/models, nhớ 30 giây)."""
    models = local_ai.status().get("models") or []
    return LOCAL_EMBED_MODEL in models or (":" not in LOCAL_EMBED_MODEL and f"{LOCAL_EMBED_MODEL}:latest" in models)


def _norm(vec) -> Any:
    if np is not None:
        v = np.asarray(vec, dtype=np.float32)
        n = float(np.linalg.norm(v))
        return v / n if n else v
    n = sum(x * x for x in vec) ** 0.5
    return [x / n for x in vec] if n else list(vec)


def _pack(vec) -> Binary:
    return Binary(array("f", [float(x) for x in vec]).tobytes())


def _unpack(raw: bytes):
    a = array("f")
    a.frombytes(bytes(raw))
    return _norm(a.tolist() if np is None else a)


def _dot(a, b) -> float:
    if np is not None:
        return float(np.dot(a, b))
    return sum(x * y for x, y in zip(a, b))


def as_list(vec) -> list[float]:
    return vec.tolist() if hasattr(vec, "tolist") else list(vec)


# ---------------------------------------------------------------------------
# Tính + lưu
# ---------------------------------------------------------------------------

def _save(card: dict, h: str, vec) -> Any:
    v = _norm(vec)
    store.replace_one({"_id": card["_id"]}, {
        "model": LOCAL_EMBED_MODEL, "hash": h, "marker": card.get("updated_at"), "dim": len(vec),
        "vector": _pack(vec), "embedded_at": db.now()}, upsert=True)
    _cache[str(card["_id"])] = (h, card.get("updated_at"), v)
    return v


def vectors_for(pool: list[dict]) -> list[Any]:
    """Vector (đã chuẩn hoá) của các thẻ đầy đủ nội dung — RAM, rồi `card_embeddings`, thiếu / cũ thì tính ngay và
    lưu lại. Lỗi AI local ném ra ngoài (httpx.HTTPError…) — nơi gọi tự rơi về tìm chữ."""
    hashes = [text_hash(c) for c in pool]
    out: list[Any] = [None] * len(pool)
    need: list[int] = []
    for i, (c, h) in enumerate(zip(pool, hashes)):
        hit = _cache.get(str(c["_id"]))
        if hit and hit[0] == h:
            out[i] = hit[2]
        else:
            need.append(i)
    if need:
        saved = {r["_id"]: r for r in store.find({"_id": {"$in": [pool[i]["_id"] for i in need]},
                                                   "model": LOCAL_EMBED_MODEL})}
        missing = []
        for i in need:
            r = saved.get(pool[i]["_id"])
            if r and r.get("hash") == hashes[i]:
                out[i] = _unpack(r["vector"])
                _cache[str(pool[i]["_id"])] = (hashes[i], r.get("marker"), out[i])
            else:
                missing.append(i)
        for start in range(0, len(missing), BATCH):
            batch = missing[start:start + BATCH]
            for i, vec in zip(batch, local_ai.embed([embed_text(pool[i]) for i in batch])):
                out[i] = _save(pool[i], hashes[i], vec)
    _trim()
    return out


def refresh(ids: Iterable, force: bool = False) -> dict:
    """Tính lại embedding cho các thẻ (nội dung chưa đổi thì chỉ cập nhật marker, không gọi AI).
    Trả `{embedded, unchanged, missing}`. Dùng cho luồng nền và script chạy bù."""
    ids = list(dict.fromkeys(ids))
    stats = {"embedded": 0, "unchanged": 0, "missing": 0}
    rows = {c["_id"]: c for c in cards.find({"_id": {"$in": ids}}, TEXT_FIELDS)}
    stats["missing"] = len(ids) - len(rows)
    saved = {r["_id"]: r for r in store.find({"_id": {"$in": list(rows)}, "model": LOCAL_EMBED_MODEL},
                                             {"hash": 1, "marker": 1})}
    todo = []
    for cid, c in rows.items():
        h = text_hash(c)
        r = saved.get(cid)
        if not force and r and r.get("hash") == h:
            stats["unchanged"] += 1
            if r.get("marker") != c.get("updated_at"):
                store.update_one({"_id": cid}, {"$set": {"marker": c.get("updated_at")}})
                if (hit := _cache.get(str(cid))) and hit[0] == h:
                    _cache[str(cid)] = (h, c.get("updated_at"), hit[2])
        else:
            todo.append((c, h))
    for start in range(0, len(todo), BATCH):
        batch = todo[start:start + BATCH]
        for (c, h), vec in zip(batch, local_ai.embed([embed_text(c) for c, _ in batch])):
            _save(c, h, vec)
            stats["embedded"] += 1
    _trim()
    return stats


def _trim() -> None:
    if len(_cache) > 50000:
        _cache.clear()


def schedule(ids: Iterable) -> None:
    """Xếp lịch tính lại embedding sau khi ghi thẻ. Không chặn, không ném lỗi — AI local tắt thì thôi (thẻ sẽ được
    tính khi tìm kiếm thấy thiếu, hoặc khi chạy script bù)."""
    global _worker
    if not ENABLED or MODE == "off":
        return
    try:
        ids = [i for i in ids if i is not None]
        if not ids:
            return
        if MODE == "sync":
            if ready():
                refresh(ids)
            return
        with _lock:
            _pending.update(ids)
            if _worker is None or not _worker.is_alive():
                _worker = threading.Thread(target=_drain, name="card-embeddings", daemon=True)
                _worker.start()
    except Exception as e:   # noqa: BLE001 — ghi thẻ không bao giờ hỏng vì embedding
        print(f"Embedding thẻ: không xếp lịch được — {str(e)[:150]}")


def _drain() -> None:
    while True:
        with _lock:
            batch = [_pending.pop() for _ in range(min(BATCH, len(_pending)))]
        if not batch:
            return
        try:
            if not ready():
                with _lock:
                    _pending.clear()
                return
            # vector hoá thẻ dùng chung một chỗ với xử lý thô / tinh chế (kb/ai_slot.py)
            with ai_slot.hold("vector_the", f"{len(batch)} thẻ"):
                refresh(batch)
        except Exception as e:   # noqa: BLE001
            print(f"Embedding thẻ: lỗi, bỏ qua {len(batch)} thẻ — {str(e)[:150]}")
            with _lock:
                _pending.clear()
            return


# ---------------------------------------------------------------------------
# Tìm theo nghĩa
# ---------------------------------------------------------------------------

def _query_vector(q: str):
    key = q.strip().lower()
    if key in _queries:
        _queries.move_to_end(key)
        return _queries[key]
    vec = _norm(local_ai.embed([q.strip()], timeout=QUERY_TIMEOUT)[0])
    _queries[key] = vec
    if len(_queries) > 256:
        _queries.popitem(last=False)
    return vec


def _load(rows: list[dict]) -> tuple[list[tuple[Any, Any]], list]:
    """Vector cho các thẻ `{_id, updated_at}`: [(id, vector)] + danh sách id cần tính (lại) nền."""
    have, stale, need = [], [], []
    for r in rows:
        hit = _cache.get(str(r["_id"]))
        if hit is None:
            need.append(r)
        else:
            have.append((r["_id"], hit[2]))
            if hit[1] != r.get("updated_at"):
                stale.append(r["_id"])
    for start in range(0, len(need), 1000):
        chunk = need[start:start + 1000]
        saved = {s["_id"]: s for s in store.find({"_id": {"$in": [r["_id"] for r in chunk]},
                                                  "model": LOCAL_EMBED_MODEL})}
        for r in chunk:
            s = saved.get(r["_id"])
            if not s:
                stale.append(r["_id"])
                continue
            v = _unpack(s["vector"])
            _cache[str(r["_id"])] = (s.get("hash"), s.get("marker"), v)
            have.append((r["_id"], v))
            if s.get("marker") != r.get("updated_at"):
                stale.append(r["_id"])
    return have, stale


def semantic_search(f: dict, q: str, limit: int | None = None) -> list[tuple[Any, float]] | None:
    """Thẻ khớp bộ lọc `f` (đã gồm phạm vi quyền) gần nghĩa với câu `q`: [(card_id, độ giống)], giảm dần.
    None = không tìm theo nghĩa được (tắt, AI local không sẵn sàng / lỗi) — nơi gọi tìm chữ như cũ."""
    global _down_until
    if not ENABLED or not q or not q.strip() or time.time() < _down_until:
        return None
    try:
        if not ready():
            return None
        qvec = _query_vector(q)
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as e:
        _down_until = time.time() + DOWN_PAUSE
        print(f"Tìm theo nghĩa: embedding lỗi, tạm tìm chữ — {str(e)[:150]}")
        return None
    rows = list(cards.find(f, {"_id": 1, "updated_at": 1}).limit(POOL_MAX))
    have, stale = _load(rows)
    if stale:
        schedule(stale[:500])
    if not have:
        return []
    if np is not None:
        mat = np.stack([v for _, v in have])
        if mat.shape[1] != len(qvec):   # đổi model embedding khác số chiều
            return []
        scores = (mat @ qvec).tolist()
    else:
        scores = [_dot(v, qvec) for _, v in have]
    ranked = sorted(((s, cid) for (cid, _), s in zip(have, scores) if s >= MIN_SCORE), key=lambda x: -x[0])
    if ranked:
        floor = ranked[0][0] - MARGIN
        ranked = [x for x in ranked if x[0] >= floor]
    return [(cid, round(s, 4)) for s, cid in ranked[:limit or TOPK]]


def fuse(text_ids: list, semantic: list[tuple[Any, float]], k: int = 60) -> list[tuple[Any, str, float | None]]:
    """Gộp hai danh sách bằng reciprocal rank fusion: [(card_id, match, độ giống)], match = text / semantic / both.
    Thẻ khớp chữ được cộng thêm một bậc để luôn đứng trên thẻ chỉ gần nghĩa cùng hạng."""
    score: dict[Any, float] = {}
    for rank, cid in enumerate(text_ids):
        score[cid] = score.get(cid, 0) + 1 / (k + rank) + 1e-6
    sims = dict(semantic)
    for rank, (cid, _) in enumerate(semantic):
        score[cid] = score.get(cid, 0) + 1 / (k + rank)
    text_set = set(text_ids)
    order = sorted(score, key=lambda c: -score[c])
    return [(c, "both" if c in text_set and c in sims else "text" if c in text_set else "semantic", sims.get(c))
            for c in order]
