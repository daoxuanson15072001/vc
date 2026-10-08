"""Đề xuất dọn hàng chờ tinh chế bằng embedding — tài liệu nào không cần tinh chế nữa:

- `da_co` (đã có trong VCWIKI): phần lớn đoạn của tài liệu (≥ COVER_RATIO) đều gần nghĩa (≥ COVER_SIM) với một thẻ
  đã có. So vector đoạn (Qdrant `doc_chunks`) với vector thẻ (`card_embeddings`) — nhân ma trận numpy trong RAM.
- `trung` (trùng tài liệu khác): phần lớn đoạn (≥ DUP_RATIO) có đoạn gần như y hệt (≥ DUP_SIM) trong MỘT tài liệu
  khác — video đăng lại, bản cắt từ cùng buổi nói. Giữ bản đã tinh chế, không có thì bản dài nhất trong nhóm.

Chỉ ĐỀ XUẤT: `suggest()` không ghi gì. Người duyệt xem danh sách (scripts/suggest_queue_cleanup.py xuất CSV), đánh
dấu dòng đồng ý, rồi `apply()` mới chuyển tài liệu sang `done` (không tạo thẻ, ghi lý do vào `summary`, người tinh
chế = "Dọn hàng chờ"). Tài liệu đang được AI giữ (processing / grouping) không bao giờ bị đụng tới.

Ngưỡng hiệu chỉnh bằng `calibrate()`: tài liệu đã tinh chế so với chính thẻ dựng từ nó (đúng là "đã có") và với thẻ
của tài liệu khác (không liên quan).
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

import numpy as np
from bson import ObjectId

from .. import db
from ..config import (CLEANUP_COVER_RATIO, CLEANUP_COVER_SIM, CLEANUP_DUP_RATIO, CLEANUP_DUP_SIM,
                      LOCAL_EMBED_MODEL)
from . import doc_vectors as dv
from . import embeddings

QUEUE = ("skipped", "pending", "error")
COVER_SIM, COVER_RATIO = CLEANUP_COVER_SIM, CLEANUP_COVER_RATIO
DUP_SIM, DUP_RATIO = CLEANUP_DUP_SIM, CLEANUP_DUP_RATIO
LABEL = "Dọn hàng chờ (embedding)"

documents = dv.documents
cards = embeddings.cards


# ---------------------------------------------------------------------------
# Đọc vector
# ---------------------------------------------------------------------------

def card_matrix(f: dict | None = None) -> tuple[list, np.ndarray]:
    """(id thẻ, ma trận vector đã chuẩn hoá) của các thẻ đã có embedding đúng model (lọc thêm theo `f`)."""
    ids = set(cards.distinct("_id", f or {})) if f else None
    out_ids, vecs = [], []
    for r in embeddings.store.find({"model": LOCAL_EMBED_MODEL}, {"vector": 1}):
        if ids is None or r["_id"] in ids:
            out_ids.append(r["_id"])
            vecs.append(np.asarray(embeddings._unpack(r["vector"]), dtype=np.float32))
    return out_ids, (np.stack(vecs) if vecs else np.zeros((0, 0), dtype=np.float32))


def chunk_vectors(doc_ids: Iterable) -> dict[str, np.ndarray]:
    """{document_id: ma trận vector đoạn (đã chuẩn hoá)} đọc từ Qdrant."""
    doc_ids = [str(i) for i in doc_ids]
    out: dict[str, list] = defaultdict(list)
    for s in range(0, len(doc_ids), 200):
        offset = None
        while True:
            body = {"filter": {"must": [dv._match("document_id", doc_ids[s:s + 200])]}, "limit": 1000,
                    "with_payload": ["document_id", "chunk"], "with_vector": [dv.DENSE]}
            if offset is not None:
                body["offset"] = offset
            res = dv._q("POST", f"/collections/{dv.COLLECTION}/points/scroll", body, ok404=True)
            if not res:
                break
            for p in res["points"]:
                v = p.get("vector") or {}
                v = v.get(dv.DENSE) if isinstance(v, dict) else v
                if v:
                    out[p["payload"]["document_id"]].append((p["payload"].get("chunk", 0), v))
            offset = res.get("next_page_offset")
            if offset is None:
                break
    mats = {}
    for d, rows in out.items():
        m = np.asarray([v for _, v in sorted(rows, key=lambda x: x[0])], dtype=np.float32)
        n = np.linalg.norm(m, axis=1, keepdims=True)
        mats[d] = m / np.where(n == 0, 1, n)
    return mats


# ---------------------------------------------------------------------------
# Đề xuất
# ---------------------------------------------------------------------------

def coverage(chunks: np.ndarray, card_ids: list, card_mat: np.ndarray, top: int = 3) -> dict:
    """Mức tài liệu đã có trong VCWIKI: tỉ lệ đoạn có thẻ gần nghĩa ≥ COVER_SIM + các thẻ khớp nhiều nhất."""
    if not len(card_ids) or not len(chunks):
        return {"ratio": 0.0, "cards": []}
    sims = chunks @ card_mat.T                       # đoạn × thẻ
    best = sims.max(axis=1)
    ratio = float((best >= COVER_SIM).mean())
    arg = sims.argmax(axis=1)
    hits: dict[int, list[float]] = defaultdict(list)
    for k, j in enumerate(arg):
        if best[k] >= COVER_SIM:
            hits[int(j)].append(float(best[k]))
    ranked = sorted(hits.items(), key=lambda x: (-len(x[1]), -max(x[1])))[:top]
    return {"ratio": round(ratio, 3), "max_sim": round(float(best.max()), 4),
            "cards": [{"id": card_ids[j], "chunks": len(v), "sim": round(max(v), 4)} for j, v in ranked]}


def duplicates(doc_id: str, chunks: np.ndarray) -> list[dict]:
    """Tài liệu khác có đoạn gần như y hệt: [{id, ratio, sim}] (ratio = tỉ lệ đoạn của tài liệu này tìm thấy bản sao)."""
    if not len(chunks):
        return []
    searches = [{"query": c.tolist(), "using": dv.DENSE, "limit": 3, "score_threshold": DUP_SIM,
                 "filter": {"must_not": [dv._match("document_id", doc_id)]}, "with_payload": ["document_id"]}
                for c in chunks]
    found: dict[str, list[float]] = defaultdict(list)
    for s in range(0, len(searches), 64):
        res = dv._q("POST", f"/collections/{dv.COLLECTION}/points/query/batch", {"searches": searches[s:s + 64]},
                    ok404=True) or []
        for r in res:
            best: dict[str, float] = {}
            for p in r.get("points") or []:
                o = p["payload"]["document_id"]
                best[o] = max(best.get(o, 0), p["score"])
            for o, sc in best.items():
                found[o].append(sc)
    n = len(chunks)
    return sorted(({"id": o, "ratio": round(len(v) / n, 3), "sim": round(sum(v) / len(v), 4)}
                   for o, v in found.items() if len(v) / n >= DUP_RATIO), key=lambda x: (-x["ratio"], -x["sim"]))


def suggest(f: dict | None = None, limit: int = 0, progress=None) -> list[dict]:
    """Đề xuất cho các tài liệu trong hàng chờ (QUEUE, lọc thêm `f`), mới trước. Không ghi gì.
    Mỗi dòng: {document_id, title, url, status, chars, action: da_co / trung / giu, reason, coverage, duplicate}."""
    q = {"wiki_status": {"$in": list(QUEUE)}} | (f or {})
    docs = list(documents.find(q, {"title": 1, "url": 1, "wiki_status": 1, "chars": 1, "space_id": 1})
                .sort("created_at", -1).limit(limit or 0))
    card_ids, card_mat = card_matrix()
    titles = {c["_id"]: c["title"] for c in cards.find({"_id": {"$in": card_ids}}, {"title": 1})}
    out = []
    for s in range(0, len(docs), 100):
        batch = docs[s:s + 100]
        mats = chunk_vectors(d["_id"] for d in batch)
        for d in batch:
            m = mats.get(str(d["_id"]))
            row = {"document_id": str(d["_id"]), "title": d.get("title"), "url": d.get("url"),
                   "status": d["wiki_status"], "chars": d.get("chars", 0), "action": "giu", "reason": "",
                   "coverage": None, "duplicate": None}
            if m is None:
                row["reason"] = "chưa nạp vào Qdrant"
                out.append(row)
                continue
            cov = coverage(m, card_ids, card_mat)
            cov["cards"] = [c | {"id": str(c["id"]), "title": titles.get(c["id"])} for c in cov["cards"]]
            row["coverage"] = cov
            dups = duplicates(str(d["_id"]), m)
            if dups:
                row["duplicate"] = dups[0]
            out.append(row)
        if progress:
            progress(min(s + 100, len(docs)), len(docs))
    _decide(out)
    return out


def _decide(rows: list[dict]) -> None:
    """Chọn hành động: trùng tài liệu đã tinh chế / bản dài hơn trong hàng chờ -> trung; phủ ≥ COVER_RATIO -> da_co."""
    other = {ObjectId(r["duplicate"]["id"]) for r in rows if r["duplicate"]}
    info = {str(d["_id"]): d for d in documents.find({"_id": {"$in": list(other)}},
                                                        {"title": 1, "wiki_status": 1, "chars": 1})}
    for r in rows:
        dup = r["duplicate"]
        if dup and (o := info.get(dup["id"])):
            dup |= {"title": o.get("title"), "status": o.get("wiki_status")}
            keep_other = o.get("wiki_status") == "done" or (o.get("chars") or 0, dup["id"]) > (r["chars"] or 0,
                                                                                                r["document_id"])
            if keep_other:
                r["action"] = "trung"
                r["reason"] = (f"Trùng {dup['ratio']:.0%} đoạn với tài liệu "
                               f"{'đã tinh chế' if o.get('wiki_status') == 'done' else 'dài hơn trong hàng chờ'}: "
                               f"{o.get('title')}")
                continue
        cov = r["coverage"]
        if cov and cov["ratio"] >= COVER_RATIO and cov["cards"]:
            r["action"] = "da_co"
            r["reason"] = f"{cov['ratio']:.0%} đoạn đã có trong VCWIKI: " + "; ".join(
                c["title"] or c["id"] for c in cov["cards"])


def apply(doc_ids: Iterable, rows: dict[str, dict], user_id=None) -> dict:
    """Chuyển các tài liệu đã được người duyệt chọn sang `done` (không tạo thẻ). Chỉ tài liệu còn ở hàng chờ."""
    from . import routes as kb
    done, skipped = 0, 0
    for i in doc_ids:
        r = rows.get(str(i)) or {}
        oid = ObjectId(str(i))
        if not documents.find_one({"_id": oid, "wiki_status": {"$in": list(QUEUE)}}, {"_id": 1}):
            skipped += 1
            continue
        kb.mark_document_refined(oid, f"[{LABEL}] {r.get('reason') or 'Người duyệt đánh dấu không cần tinh chế'}",
                                 by=db.refiner("manual", LABEL, user_id=user_id))
        done += 1
    return {"done": done, "skipped": skipped}


# ---------------------------------------------------------------------------
# Hiệu chỉnh ngưỡng
# ---------------------------------------------------------------------------

def calibrate(sample: int = 300) -> dict[str, Any]:
    """Phân bố độ giống (mức đoạn) giữa đoạn của tài liệu đã tinh chế và: thẻ dựng từ CHÍNH nó (dương), 20 thẻ
    ngẫu nhiên (âm), thẻ gần nhất không phải của nó (thẻ khác cùng chủ đề) — để chọn COVER_SIM."""
    docs = [d["_id"] for d in documents.aggregate([
        {"$match": {"wiki_status": "done", "card_count": {"$gt": 0}}}, {"$sample": {"size": sample}},
        {"$project": {"_id": 1}}])]
    card_ids, card_mat = card_matrix()
    if not len(card_ids):
        return {"error": "chưa có embedding thẻ"}
    idx = {c: k for k, c in enumerate(card_ids)}
    own: dict[ObjectId, list[int]] = defaultdict(list)
    for c in cards.find({"document_id": {"$in": docs}}, {"document_id": 1}):
        if c["_id"] in idx:
            own[c["document_id"]].append(idx[c["_id"]])
    mats = chunk_vectors(docs)
    pos, neg, rest = [], [], []
    rng = np.random.default_rng(0)
    for d in docs:
        m = mats.get(str(d))
        if m is None or not own.get(d):
            continue
        sims = m @ card_mat.T
        pos += sims[:, own[d]].max(axis=1).tolist()                # mỗi đoạn ↔ thẻ dựng từ chính tài liệu
        mask = np.ones(len(card_ids), bool)
        mask[own[d]] = False
        others = rng.choice(np.flatnonzero(mask), size=min(20, int(mask.sum())), replace=False)
        neg += sims[:, others].max(axis=1).tolist()                 # mỗi đoạn ↔ 20 thẻ ngẫu nhiên
        rest += sims[:, mask].max(axis=1).tolist()                  # mỗi đoạn ↔ thẻ gần nhất không phải của nó
    pct = lambda xs: {p: round(float(np.percentile(xs, p)), 3) for p in (10, 25, 50, 75, 90)} if xs else {}  # noqa: E731
    return {"chunks": len(pos), "own_cards": pct(pos), "random_cards": pct(neg), "nearest_other_card": pct(rest)}
