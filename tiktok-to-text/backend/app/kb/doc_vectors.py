"""Tìm trong tầng thô (Kho tư liệu) — văn bản tài liệu cắt thành đoạn, lưu ở Qdrant, tìm hybrid + rerank.

Thẻ VCWIKI tìm trong Python (kb/embeddings.py + kb/lexical.py, vài nghìn thẻ). Tầng thô lớn hơn nhiều (hàng chục nghìn
đoạn) nên dùng cơ sở dữ liệu vector riêng: Qdrant chạy trên máy (setup_vector_db.sh), gọi qua REST bằng httpx.

- Cắt: mỗi tài liệu thành đoạn ~CHUNK_CHARS ký tự, gối nhau OVERLAP ký tự, ưu tiên cắt ở ranh giới đoạn / câu.
- Collection `doc_chunks`: mỗi đoạn một point, id = uuid5(document_id:chunk), hai vector có tên: `dense` (bge-m3 của
  tiêu đề + đoạn) và `lexical` (vector thưa từ khoá không dấu, kb/lexical.py; Qdrant tự nhân IDF -> BM25).
  Payload: document_id, source_id, space_id, chunk, chunks, start (vị trí ký tự — get_document offset), text (đoạn),
  hash (sha1 model + cấu trúc + tiêu đề + văn bản, lặp ở mọi đoạn). Qdrant là nơi duy nhất giữ trạng thái đã nạp:
  so hash của đoạn 0 với tài liệu để biết tài liệu nào cần nạp (lại).
- Nạp: chạy nền ban đêm (scripts/index_raw_vectors.py qua launchd) — không nạp ngay lúc chuyển chữ để khỏi tranh
  GPU với pipeline ban ngày. Tài liệu mới nhất có thể chưa tìm được tới đêm.
- Tìm: `search(f, q)` — xem docstring; kết quả luôn lọc lại bằng MongoDB với bộ lọc `f` (phạm vi quyền, trạng
  thái…) nên point mồ côi / payload cũ không bao giờ làm lộ tài liệu.

Biến môi trường:
- `QDRANT_URL` (mặc định http://127.0.0.1:6333). `RAW_SEMANTIC`: `0` tắt hẳn tìm tầng thô.
- `RAW_SEMANTIC_MIN` (0,50): độ giống nghĩa tối thiểu câu hỏi ↔ đoạn (nhánh vector nghĩa — thang cosine, chỉ áp cho
  nhánh này, không áp lên điểm RRF).
- `RAW_HYBRID` (1): `0` -> chỉ nhánh nghĩa. `RAW_RRF_DENSE` / `RAW_RRF_SPARSE` (1 / 1): trọng số RRF hai nhánh.
- `RAW_RERANK_MIN` (0,005): tài liệu đã rerank mà điểm thấp hơn thì bỏ. Reranker: kb/rerank.py (`RERANK`, `RERANK_TOPN`).
"""

from __future__ import annotations

import hashlib
import re
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Iterable

import httpx
from bson import ObjectId

from .. import db
from ..config import (LOCAL_EMBED_MODEL, QDRANT_URL, RAW_HYBRID, RAW_RERANK_DOCS, RAW_RERANK_MIN, RAW_RRF_DENSE,
                      RAW_RRF_SPARSE, RAW_SEMANTIC, RAW_SEMANTIC_MIN)
from . import embeddings, lexical, local_ai, rerank

ENABLED = RAW_SEMANTIC
MIN_SCORE = RAW_SEMANTIC_MIN
COLLECTION = "doc_chunks"
SCHEMA = 2                 # đổi cấu trúc point (2: thêm vector thưa) -> hash đổi -> tài liệu tự được nạp lại
DENSE, SPARSE = "dense", "lexical"   # vector nghĩa (bge-m3) + vector thưa từ khoá (kb/lexical.py)
RERANK_MIN = RAW_RERANK_MIN   # tài liệu đã rerank mà điểm thấp hơn thì bỏ — đo 27/09: dưới 0,005 toàn lạc đề, tài liệu đúng ý hầu hết > 0,05
RERANK_DOCS = RAW_RERANK_DOCS   # số tài liệu đầu đem rerank (mỗi tài liệu 1 đoạn) — đo 27/09: 10
                                                        # ngang 20 về chất lượng, ~1 giây thay vì ~3 giây (M4, MPS)
HYBRID = RAW_HYBRID           # 0: chỉ nhánh nghĩa (như trước khi có tìm lai)
W_DENSE = RAW_RRF_DENSE       # trọng số RRF nhánh nghĩa / nhánh từ khoá (mức tài liệu)
W_SPARSE = RAW_RRF_SPARSE
RRF_K = 60
CHUNK_CHARS = 1500
OVERLAP = 200
BATCH = 16                 # số đoạn mỗi lần gọi /v1/embeddings
STATUS_TTL = 30            # giây: nhớ Qdrant sống / chết
NS = uuid.UUID("6f1c6f0e-4a8b-4c52-9d1e-2b7f0c9e5a31")

documents = db.db["kb_documents"]
DOC_FIELDS = {"title": 1, "text": 1, "source_id": 1, "space_id": 1}

_up: tuple[float, bool] | None = None
_sparse: tuple[float, bool] | None = None
_http = httpx.Client(timeout=httpx.Timeout(10.0, read=120.0))
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="raw-search")   # hai nhánh tìm song song


# ---------------------------------------------------------------------------
# Qdrant
# ---------------------------------------------------------------------------

def _q(method: str, path: str, body: dict | None = None, ok404: bool = False) -> Any:
    res = _http.request(method, f"{QDRANT_URL}{path}", json=body)
    if ok404 and res.status_code == 404:
        return None
    res.raise_for_status()
    return res.json().get("result")


def up(fresh: bool = False) -> bool:
    """Qdrant đang chạy (nhớ STATUS_TTL giây)."""
    global _up
    if not fresh and _up and time.time() - _up[0] < STATUS_TTL:
        return _up[1]
    try:
        _http.get(f"{QDRANT_URL}/readyz", timeout=2).raise_for_status()
        ok = True
    except httpx.HTTPError:
        ok = False
    _up = (time.time(), ok)
    return ok


def ensure_collection(dim: int) -> None:
    """Tạo collection + chỉ mục payload nếu chưa có. Đã có mà khác cấu trúc (đổi model -> khác số chiều, bản cũ
    chưa có vector thưa) thì xoá tạo lại — lần nạp sau nạp lại từ đầu."""
    info = _q("GET", f"/collections/{COLLECTION}", ok404=True)
    if info is not None:
        params = info["config"]["params"]
        dense = (params.get("vectors") or {}).get(DENSE) or {}
        if dense.get("size") == dim and SPARSE in (params.get("sparse_vectors") or {}):
            return
        _q("DELETE", f"/collections/{COLLECTION}")
    _q("PUT", f"/collections/{COLLECTION}", {
        "vectors": {DENSE: {"size": dim, "distance": "Cosine", "on_disk": True}},
        "sparse_vectors": {SPARSE: {"modifier": "idf"}},   # Qdrant tự tính IDF trên toàn collection (BM25)
        "on_disk_payload": True,
    })
    for field in ("document_id", "source_id", "space_id"):
        _q("PUT", f"/collections/{COLLECTION}/index?wait=true", {"field_name": field, "field_schema": "keyword"})
    _q("PUT", f"/collections/{COLLECTION}/index?wait=true", {"field_name": "chunk", "field_schema": "integer"})


def _match(key: str, value) -> dict:
    if isinstance(value, (list, tuple, set)):
        return {"key": key, "match": {"any": [str(v) for v in value]}}
    return {"key": key, "match": {"value": str(value)}}


def delete_documents(ids: Iterable) -> None:
    ids = [str(i) for i in ids]
    if ids:
        _q("POST", f"/collections/{COLLECTION}/points/delete?wait=true", {"filter": {"must": [_match("document_id", ids)]}},
           ok404=True)


def indexed() -> dict[str, str]:
    """{document_id: hash} của mọi tài liệu đã nạp (đọc đoạn 0)."""
    out: dict[str, str] = {}
    offset = None
    while True:
        body = {"filter": {"must": [{"key": "chunk", "match": {"value": 0}}]}, "limit": 2000,
                "with_payload": ["document_id", "hash"], "with_vector": False}
        if offset is not None:
            body["offset"] = offset
        res = _q("POST", f"/collections/{COLLECTION}/points/scroll", body, ok404=True)
        if not res:
            return out
        for p in res["points"]:
            out[p["payload"]["document_id"]] = p["payload"].get("hash")
        offset = res.get("next_page_offset")
        if offset is None:
            return out


# ---------------------------------------------------------------------------
# Cắt đoạn, nạp
# ---------------------------------------------------------------------------

_BREAKS = ("\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ")


def split(text: str, size: int = CHUNK_CHARS, overlap: int = OVERLAP) -> list[tuple[int, str]]:
    """[(vị trí bắt đầu, đoạn)]: ~`size` ký tự, gối nhau ~`overlap`, cắt ở ranh giới đoạn / câu / từ khi được."""
    text = text or ""
    out: list[tuple[int, str]] = []
    start, n = 0, len(text)
    while start < n:
        end = min(start + size, n)
        if end < n:
            lo = start + size * 3 // 5
            for sep in _BREAKS:
                cut = text.rfind(sep, lo, end)
                if cut != -1:
                    end = cut + len(sep)
                    break
        piece = text[start:end]
        if piece.strip():
            out.append((start, piece.strip()))
        if end >= n:
            break
        nxt = max(end - overlap, start + 1)
        sp = text.find(" ", nxt, end)   # bắt đầu đoạn sau ở đầu một từ
        start = sp + 1 if sp != -1 else nxt
    return out


def doc_hash(doc: dict) -> str:
    return hashlib.sha1(f"{LOCAL_EMBED_MODEL}\n{CHUNK_CHARS}\n{SCHEMA}\n{doc.get('title') or ''}\n{doc.get('text') or ''}"
                        .encode()).hexdigest()


def point_id(doc_id, i: int) -> str:
    return str(uuid.uuid5(NS, f"{doc_id}:{i}"))


def _vectors(dense: list[float], doc: dict, piece: str) -> dict:
    sp = lexical.sparse(f"{doc.get('title') or ''}\n{piece}")
    return {DENSE: dense, SPARSE: sp} if sp["indices"] else {DENSE: dense}   # Qdrant không nhận vector thưa rỗng


def index_documents(docs: list[dict]) -> int:
    """Nạp (lại) các tài liệu `{_id, title, text, source_id, space_id}`: embed mọi đoạn trước, rồi mới xoá đoạn cũ +
    ghi đoạn mới của từng tài liệu — lỗi giữa chừng không để lại tài liệu nạp dở (hash đoạn 0 đã mới mà thiếu đoạn).
    Trả số đoạn đã ghi. Lỗi AI local / Qdrant ném ra ngoài (script tự dừng / ghi log)."""
    jobs: list[tuple[int, str]] = []   # (vị trí tài liệu trong docs, nội dung đem embed)
    parts = []
    for k, d in enumerate(docs):
        p = split(d.get("text") or "")
        parts.append(p)
        title = (d.get("title") or "").strip()
        jobs += [(k, f"{title}\n{piece}" if title else piece) for _, piece in p]
    vecs: list[list[float]] = []
    for s in range(0, len(jobs), BATCH):
        vecs += local_ai.embed([t for _, t in jobs[s:s + BATCH]])
    if vecs:
        ensure_collection(len(vecs[0]))
    delete_documents([d["_id"] for d in docs])   # tài liệu nay rỗng (0 đoạn) cũng xoá đoạn cũ
    written, pos = 0, 0
    for d, p in zip(docs, parts):
        h = doc_hash(d)
        points = [{"id": point_id(d["_id"], i), "vector": _vectors(vecs[pos + i], d, piece),
                   "payload": {"document_id": str(d["_id"]), "source_id": str(d.get("source_id")),
                               "space_id": str(d.get("space_id")), "chunk": i, "chunks": len(p),
                               "start": start, "text": piece, "hash": h}}
                  for i, (start, piece) in enumerate(p)]
        pos += len(p)
        for s in reversed(range(0, len(points), 256)):   # đoạn 0 (mang hash "đã nạp") ghi sau cùng
            _q("PUT", f"/collections/{COLLECTION}/points?wait=true", {"points": points[s:s + 256]})
        written += len(points)
    return written


# ---------------------------------------------------------------------------
# Tìm
# ---------------------------------------------------------------------------

def _space_filter(f: dict) -> dict | None:
    """Đẩy điều kiện kho của bộ lọc Mongo sang Qdrant (để lấy đủ kết quả); lọc lại bằng Mongo vẫn là chốt chặn."""
    sp = f.get("space_id")
    if isinstance(sp, dict) and "$in" in sp:
        return {"must": [_match("space_id", sp["$in"])]}
    if isinstance(sp, ObjectId):
        return {"must": [_match("space_id", sp)]}
    return None


def _branch(query: dict, flt: dict | None, n: int) -> list[dict]:
    """Một nhánh tìm (dense hoặc vector thưa), gom theo tài liệu: [{id, hits: [{score, payload}]}] theo thứ hạng."""
    body = {"group_by": "document_id", "limit": n, "group_size": 3, "with_payload": ["start", "text"]} | query
    if flt is not None:
        body["filter"] = flt
    res = _q("POST", f"/collections/{COLLECTION}/points/query/groups", body, ok404=True)
    return [g for g in (res or {}).get("groups") or [] if ObjectId.is_valid(str(g["id"]))]


def has_sparse(fresh: bool = False) -> bool:
    """Collection có vector thưa (bản cũ chỉ có dense -> tìm như trước khi có hybrid). Nhớ STATUS_TTL giây."""
    global _sparse
    if not fresh and _sparse and time.time() - _sparse[0] < STATUS_TTL:
        return _sparse[1]
    try:
        info = _q("GET", f"/collections/{COLLECTION}", ok404=True) or {}
        ok = SPARSE in ((info.get("config") or {}).get("params", {}).get("sparse_vectors") or {})
    except (httpx.HTTPError, KeyError, ValueError, TypeError, AttributeError):
        ok = False
    _sparse = (time.time(), ok)
    return ok


def fuse(branches: dict[str, list[dict]], weights: dict[str, float],
         k: int = RRF_K) -> list[tuple[str, float, str, list[dict]]]:
    """Gộp các nhánh ở mức TÀI LIỆU bằng reciprocal rank fusion có trọng số: Σ w / (k + hạng). Trả
    [(document_id, điểm RRF, match dense / sparse / both, passages)] — passages gộp đoạn của các nhánh (trùng đoạn thì gộp), mỗi đoạn kèm `match`
    (dense / sparse / both), `semantic_score` (cosine), `text_score` (BM25 Qdrant); đoạn khớp cả hai nhánh đứng trước,
    rồi theo hạng tốt nhất trong nhánh."""
    score: dict[str, float] = {}
    seen: dict[str, set] = {}
    passages: dict[str, dict[int, dict]] = {}
    for name, groups in branches.items():
        w = weights.get(name, 1.0)
        key = "semantic_score" if name == "dense" else "text_score"
        for rank, g in enumerate(groups):
            did = str(g["id"])
            score[did] = score.get(did, 0.0) + w / (k + rank + 1)
            seen.setdefault(did, set()).add(name)
            ps = passages.setdefault(did, {})
            for order, h in enumerate(g["hits"]):
                start = h["payload"].get("start", 0)
                p = ps.setdefault(start, {"start": start, "match": name, "semantic_score": None, "text_score": None,
                                          "rerank_score": None, "text": h["payload"].get("text") or "", "_o": order})
                if p["match"] != name:
                    p["match"] = "both"
                p[key] = round(h["score"], 4)
                p["_o"] = min(p["_o"], order)
    out = []
    for did, sc in sorted(score.items(), key=lambda x: -x[1]):
        ps = sorted(passages[did].values(), key=lambda p: (p["match"] != "both", p["_o"]))[:3]
        out.append((did, round(sc, 6), "both" if len(seen[did]) > 1 else next(iter(seen[did])),
                    [{k: v for k, v in p.items() if k != "_o"} for p in ps]))
    return out


def search(f: dict, q: str, limit: int = 20, keep: dict | None = None) -> list[dict] | None:
    """Tìm lai trong tầng thô: nhánh nghĩa (dense bge-m3, cosine ≥ RAW_SEMANTIC_MIN) và nhánh từ khoá (vector thưa BM25,
    IDF do Qdrant tính) chạy song song, mỗi nhánh gom theo tài liệu; gộp RRF có trọng số ở mức tài liệu (`fuse`);
    lọc lại bằng bộ lọc Mongo `f` (phạm vi quyền, trạng thái… — Qdrant không bao giờ quyết định quyền); rồi reranker
    chấm lại RERANK_DOCS tài liệu đầu (kb/rerank.py).

    Mỗi tài liệu kèm `score` (RRF), `match` (dense / sparse / both), `semantic_score` (cosine tốt nhất), `text_score`
    (BM25 tốt nhất), `rerank_score` (0–1, None nếu không rerank được), `reranked` và `passages` [{start, match,
    semantic_score, text_score, rerank_score, time, text}] (tối đa 3 đoạn; đoạn đầu là đoạn đem rerank; `time` = giây
    của mốc [mm:ss] gần nhất trong chữ video / ghi âm — `passage_time`, None nếu văn bản không có mốc).
    RAW_HYBRID=0 hoặc collection chưa có vector thưa -> chỉ nhánh nghĩa (như trước khi có tìm lai); AI local tắt ->
    chỉ nhánh từ khoá. None = không tìm được (tắt, Qdrant không chạy, lỗi)."""
    if not ENABLED or not q or not q.strip() or not up():
        return None
    sparse_ok = has_sparse()
    queries: dict[str, dict] = {}
    try:
        if embeddings.ready():
            queries["dense"] = {"query": embeddings.as_list(embeddings._query_vector(q)), "using": DENSE,
                                "score_threshold": MIN_SCORE}
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as e:
        print(f"Tìm tầng thô: embedding câu hỏi lỗi, chỉ tìm từ khoá — {str(e)[:150]}")
    if sparse_ok and (HYBRID or "dense" not in queries) and (qs := lexical.query_sparse(q))["indices"]:
        queries["sparse"] = {"query": qs, "using": SPARSE}
    if not queries:
        return None
    flt = _space_filter(f)
    n = min(max(limit * 3, 30), 300)
    try:
        if len(queries) == 1:
            branches = {k: _branch(v, flt, n) for k, v in queries.items()}
        else:
            futs = {k: _pool.submit(_branch, v, flt, n) for k, v in queries.items()}
            branches = {k: fu.result() for k, fu in futs.items()}
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as e:
        print(f"Tìm tầng thô: Qdrant lỗi — {str(e)[:150]}")
        return None
    fused = fuse(branches, {"dense": W_DENSE, "sparse": W_SPARSE})
    if not fused:
        return []
    fields = keep or {"title": 1, "url": 1, "key": 1, "source_id": 1, "space_id": 1, "chars": 1, "wiki_status": 1,
                      "card_count": 1, "summary": 1, "categories": 1, "tags": 1, "created_at": 1}
    rows = {d["_id"]: d for d in documents.find({"$and": [f, {"_id": {"$in": [ObjectId(x[0]) for x in fused]}}]},
                                                 fields | {"title": 1})}
    found = []
    for did, sc, match, ps in fused:
        if d := rows.get(ObjectId(did)):
            found.append((d | {"score": sc, "match": match,
                               "semantic_score": max((p["semantic_score"] for p in ps if p["semantic_score"] is not None),
                                                     default=None),
                               "text_score": max((p["text_score"] for p in ps if p["text_score"] is not None),
                                                 default=None)}, ps))
    reranked = _rerank(q, found)
    found = found[:limit]
    texts = {d["_id"]: d.get("text") or "" for d in documents.find({"_id": {"$in": [d["_id"] for d, _ in found]}},
                                                                   {"text": 1})} if found else {}
    return [d | {"rerank_score": ps[0]["rerank_score"], "reranked": reranked,
                 "passages": [p | {"time": passage_time(texts.get(d["_id"], ""), p["start"], len(p["text"])),
                                   "text": _snip(p["text"])} for p in ps]} for d, ps in found]


_MARK = re.compile(r"^[ \t]*\[(?:(\d{1,3}):)?(\d{1,2}):(\d{2})\]", re.M)   # [mm:ss] / [h:mm:ss] đầu dòng (kb/media.fmt_ts)
_HEADING = re.compile(r"^#", re.M)


def time_marks(text: str) -> list[tuple[int, int]]:
    """[(vị trí ký tự, giây)] của các mốc thời gian đầu dòng trong văn bản tài liệu (chữ video / ghi âm)."""
    return [(m.start(), int(m[1] or 0) * 3600 + int(m[2]) * 60 + int(m[3])) for m in _MARK.finditer(text or "")]


def passage_time(text: str, start: int, length: int = CHUNK_CHARS) -> int | None:
    """Giây của đoạn khớp bắt đầu ở ký tự `start` (dài `length`): mốc cuối cùng đứng trước / tại đầu đoạn; không có
    (đoạn trước mốc đầu tiên, hoặc mốc trước đó thuộc mục khác — cách một dòng tiêu đề `#`) thì mốc đầu tiên trong đoạn.
    Văn bản không có mốc -> None. FE tua video tới giây này."""
    if not text or "[" not in text:
        return None
    marks = time_marks(text)
    if not marks:
        return None
    s = start + (len(text[start:start + length]) - len(text[start:start + length].lstrip()))   # bỏ khoảng trắng đầu đoạn
    before = [(pos, sec) for pos, sec in marks if pos <= s]
    if before:
        pos, sec = before[-1]
        if not _HEADING.search(text, pos, s + 1):
            return sec
    inside = next((sec for pos, sec in marks if s < pos < start + max(length, 1)), None)
    return inside if inside is not None else (before[-1][1] if before else None)


def _rerank(q: str, found: list[tuple[dict, list[dict]]]) -> bool:
    """Chấm lại (tại chỗ) RERANK_DOCS tài liệu đầu bằng đoạn tốt nhất của mỗi tài liệu.
    Tài liệu đã chấm xếp theo điểm rerank, đứng trên phần còn lại (giữ thứ tự RRF). Không rerank được (tắt, lỗi, quá
    RERANK_TIMEOUT_MS) thì giữ nguyên, trả False."""
    head = found[:RERANK_DOCS]
    pairs = [(k, ps[0]) for k, (_, ps) in enumerate(head)]   # 1 đoạn tốt nhất (RRF) / tài liệu: ~1 giây cho 20 cặp
    scores = rerank.score(q, [f"{(head[k][0].get('title') or '').strip()}\n{p['text']}" for k, p in pairs])
    if scores is None:
        return False
    for (_, p), sc in zip(pairs, scores):
        p["rerank_score"] = sc
    head.sort(key=lambda x: -x[1][0]["rerank_score"])
    found[:len(head)] = [x for x in head if x[1][0]["rerank_score"] >= RERANK_MIN]
    return True


def _snip(text: str, n: int = 500) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= n else text[:n].rsplit(" ", 1)[0] + "…"
