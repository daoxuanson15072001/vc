#!/usr/bin/env python3
"""Đo chất lượng tìm kiếm VCWIKI (search_cards) và Kho tư liệu (search_documents) trên bộ câu hỏi chuẩn
tests/data/search_golden.json — CE-11, SYS-22 (đo trước khi làm tiếp), theo mẫu scripts/eval_novelty.py (GOV-03).

    cd backend && ../.venv/bin/python scripts/eval_search.py                          # DB QA mặc định, mọi chế độ
    cd backend && ../.venv/bin/python scripts/eval_search.py --db tiktok_to_text --label that   # DB thật (chỉ đọc)
    cd backend && ../.venv/bin/python scripts/eval_search.py --modes cards-hybrid-rerank --only kt-q1-dai -v
    cd backend && ../.venv/bin/python scripts/eval_search.py --embed-missing          # thẻ chưa có embedding: tính trong RAM
    cd backend && ../.venv/bin/python scripts/eval_search.py --check                  # chỉ kiểm bộ ca
    cd backend && ../.venv/bin/python scripts/eval_search.py --import cau_hoi.csv [--dry-run]
    cd backend && ../.venv/bin/python scripts/eval_search.py --compare a.json b.json

CHỈ ĐỌC: không ghi MongoDB, không ghi Qdrant (embedding nền tắt — `embeddings.MODE = "off"`). `--embed-missing` tính
vector thẻ thiếu / cũ bằng AI local rồi giữ trong RAM của lượt chạy + bộ đệm file output/eval/card-vectors-<db>.npz.
`--import` chỉ ghi file search_golden.json.

Gọi đúng hàm API / MCP đang dùng (`routes.list_cards` = search_cards, `routes.semantic_documents` = search_documents),
với một người dùng (mặc định anh Thọ Anh), status mặc định như MCP (không lọc). Chế độ = bật / tắt từng bước bằng
đúng cờ trong code (xem MODES). Kết quả: output/eval/search-<ngày-giờ>-<nhãn>.md + .json.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import subprocess
import sys
import time
from collections import Counter, defaultdict
from contextlib import ExitStack
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
GOLDEN = ROOT / "tests" / "data" / "search_golden.json"
DEFAULT_DB = "tiktok_to_text_qa_v1"
DEFAULT_USER = "buithoanh@vcprosperous.com"

if __name__ == "__main__":
    # app/config.py đọc MONGO_DB lúc import -> chọn DB trước khi import app
    _argv = sys.argv[1:]
    _db = next((a.split("=", 1)[1] for a in _argv if a.startswith("--db=")), None)
    if "--db" in _argv and _argv.index("--db") + 1 < len(_argv):
        _db = _argv[_argv.index("--db") + 1]
    os.environ["MONGO_DB"] = _db or os.getenv("MONGO_DB") or DEFAULT_DB
    sys.path.insert(0, str(ROOT))

from bson import ObjectId  # noqa: E402
from fastapi import HTTPException  # noqa: E402

from app import auth, db  # noqa: E402
from app.config import LOCAL_EMBED_MODEL, ROOT_DIR  # noqa: E402
from app.kb import card_search, doc_vectors, embeddings, lexical, local_ai, rerank  # noqa: E402
from app.kb import routes as kb  # noqa: E402

try:
    import numpy as np
except ImportError:   # --embed-missing cần numpy để lưu bộ đệm; phần còn lại chạy không cần
    np = None

OUT_DIR = ROOT_DIR / "output" / "eval"
KINDS = ["dien-dat-khac", "tu-khoa-ngan", "so-hieu-ma-ten-rieng", "khong-dau-viet-tat", "ghep-dieu-kien", "tinh-che",
         "khong-co-dap-an"]
SOURCES = ["ai_seed", "kiem_thu_2609", "nhan_vien"]
TARGETS = ["cards", "documents"]
SPLITS = ["dev", "test"]
BLOCKS = ["nen", "mkt", "bh", "tckt", "hcns", "qltt", "mh"]   # 7 khối cây v2 (BA 4.3)
FILTER_KEYS = {"cards": {"category", "level", "division", "process_step", "type"}, "documents": {"status"}}
COPY_WARN = 0.70                                          # câu hỏi trùng ≥ 70% âm tiết với tiêu đề thẻ đích
COPY_EXEMPT = {"tu-khoa-ngan", "so-hieu-ma-ten-rieng"}   # từ khoá / tên riêng vốn nằm trong tiêu đề
MEMORY_TYPES = {"skill", "memory", "context"}             # thẻ bộ nhớ AI (save_memory)
WATCH_TITLE = "phan loai vcwiki v2"                       # thẻ context hay lọt top 5 (kiểm thử tay 26/09)
K = 10
CARD_PAGE = 20      # page_size mặc định của MCP search_cards
DOC_LIMIT = 10      # limit mặc định của MCP search_documents
PASSAGE_WINDOW = doc_vectors.CHUNK_CHARS

CARD_MIN_GRID = [0.44, 0.48, 0.50, 0.52, 0.54, 0.56, 0.58, 0.60]
CARD_MARGIN_GRID = [0.06, 0.08, 0.10, 0.12, 0.15, 1.0]   # 1.0 = không cắt tương đối
RAW_MIN_GRID = [0.40, 0.45, 0.50, 0.55, 0.60]
RAW_RERANK_GRID = [0.0, 0.005, 0.02, 0.05]
RAW_RRF_GRID = [(1.0, 0.5), (1.0, 1.0), (1.0, 1.5), (1.0, 2.0), (1.0, 3.0), (0.0, 1.0)]   # (nghĩa, từ khoá)
CARD_RERANK_MIN_GRID = [0.0, 0.005, 0.01, 0.02, 0.05, 0.1]
CARD_RERANK_HEAD_GRID = [10, 15, 20, 30]   # card_search.RERANK_HEAD (≤ RERANK_TOPN)


# ---------------------------------------------------------------------------
# Chế độ đo — mỗi chế độ bật / tắt từng bước bằng cờ có sẵn trong code (không viết lại logic tìm)
# ---------------------------------------------------------------------------

@dataclass
class Mode:
    name: str
    target: str
    note: str
    patch: Callable[[ExitStack], None] | None = None
    needs: set = field(default_factory=set)     # embed / rerank / qdrant
    ready: bool = True                           # False = chỗ cắm cho việc sau, chưa chạy được


def _set(stack: ExitStack, obj, attr: str, value) -> None:
    stack.enter_context(mock.patch.object(obj, attr, value))


def _old_rerank_text(card: dict) -> str:
    return embeddings.card_text(card)[:kb.RERANK_CHARS]


def _no_text(stack: ExitStack) -> None:
    """Nhánh chữ của search_cards không khớp gì (regex không bao giờ khớp) -> chỉ còn nhánh nghĩa."""
    _set(stack, db, "search_regex", lambda q: {"$regex": "(?!)"})


def _v1(stack: ExitStack) -> None:
    """Cách xếp cũ của search_cards (trước việc B): regex đủ mọi từ, BM25 một trường, RRF đều, không bỏ thẻ bộ nhớ AI."""
    _set(stack, card_search, "RANKING", "v1")


MODES: dict[str, Mode] = {m.name: m for m in [
    Mode("cards-text", "cards", "v1, SEARCH_SEMANTIC=0: chỉ tìm chữ — regex đủ mọi từ (không dấu), xếp theo updated_at",
         lambda s: (_v1(s), _set(s, embeddings, "ENABLED", False))),
    Mode("cards-semantic", "cards", "chỉ nhánh nghĩa (bge-m3, MIN / MARGIN / TOPK), RERANK=0 — nhánh chữ tắt khi đo",
         lambda s: (_v1(s), _no_text(s), _set(s, rerank, "ENABLED", False)), {"embed"}),
    Mode("cards-hybrid", "cards", "v1: chữ BM25 + nghĩa, gộp RRF, RERANK=0",
         lambda s: (_v1(s), _set(s, rerank, "ENABLED", False)), {"embed"}),
    Mode("cards-hybrid-rerank", "cards", "v1 (trước việc B): chữ BM25 + nghĩa, RRF, rerank RERANK_TOPN thẻ đầu",
         _v1, {"embed", "rerank"}),
    # Việc B (6ab85363…e539): cách xếp v2 — kb/card_search.py
    Mode("cards-text-v2", "cards", "v2, SEARCH_SEMANTIC=0: chỉ nhánh chữ BM25F (phủ ≥ TEXT_COVER), rerank",
         lambda s: _set(s, embeddings, "ENABLED", False), {"rerank"}),
    Mode("cards-hybrid-v2-norerank", "cards", "v2: chữ BM25F + nghĩa, RRF có trọng số, RERANK=0",
         lambda s: _set(s, rerank, "ENABLED", False), {"embed"}),
    Mode("cards-hybrid-v2", "cards", "HIỆN TẠI (v2): chữ BM25F + nghĩa, RRF có trọng số, bỏ thẻ bộ nhớ AI, rerank",
         None, {"embed", "rerank"}),
    Mode("cards-hybrid-rerank-cu", "cards", "v1 + rerank trên văn bản cũ (trước việc C: không có 'khi nào dùng')",
         lambda s: (_v1(s), _set(s, kb, "rerank_text", _old_rerank_text)), {"embed", "rerank"}),
    Mode("documents-dense", "documents", "RAW_HYBRID=0: chỉ vector nghĩa Qdrant (dense ≥ RAW_SEMANTIC_MIN), RERANK=0",
         lambda s: (_set(s, doc_vectors, "HYBRID", False), _set(s, rerank, "ENABLED", False)), {"embed", "qdrant"}),
    Mode("documents-dense-rerank", "documents", "RAW_HYBRID=0 + rerank (việc C trên nhánh nghĩa)",
         lambda s: _set(s, doc_vectors, "HYBRID", False), {"embed", "rerank", "qdrant"}),
    Mode("documents-lexical", "documents", "chỉ từ khoá (vector thưa BM25 Qdrant) — như khi AI local tắt, RERANK=0",
         lambda s: (_set(s, embeddings, "ready", lambda: False), _set(s, rerank, "ENABLED", False)), {"qdrant"}),
    Mode("documents-hybrid", "documents", "dense + từ khoá chạy riêng, gộp RRF mức tài liệu (việc D), RERANK=0",
         lambda s: _set(s, rerank, "ENABLED", False), {"embed", "qdrant"}),
    Mode("documents-current", "documents", "HIỆN TẠI: documents-hybrid + rerank RERANK_DOCS tài liệu đầu, bỏ tài liệu "
         "rerank < RAW_RERANK_MIN", None, {"embed", "rerank", "qdrant"}),
    # Việc C / D / E (reranker, tìm lai tầng thô, gắn ngữ cảnh) thêm chế độ documents-* mới ở đây.
]}
DEFAULT_MODES = [m.name for m in MODES.values() if m.ready]


def pipeline_steps() -> dict:
    """Các bước tìm đang chạy, đọc từ hằng số / biến môi trường trong code (để báo cáo không lệch code)."""
    return {
        "search_cards": [
            "Bộ lọc Mongo: phạm vi quyền (policy.visible_filter — kênh MCP dùng chung bộ lọc web) + type / status / "
            "category / level / division / process_step; MCP không truyền status -> mọi trạng thái, kể cả rejected. "
            f"Cách xếp SEARCH_RANKING={card_search.RANKING}. v2: có q mà không lọc type -> bỏ thẻ bộ nhớ AI "
            "(skill / memory / context), trừ include_ai_memory=true.",
            f"Nhánh nghĩa (kb/embeddings.py): {LOCAL_EMBED_MODEL} cosine trên mọi thẻ khớp lọc (≤ "
            f"{embeddings.POOL_MAX}), giữ ≥ SEARCH_SEMANTIC_MIN={embeddings.MIN_SCORE}, cắt tương đối "
            f"SEARCH_SEMANTIC_MARGIN={embeddings.MARGIN} so với thẻ tốt nhất, tối đa SEARCH_SEMANTIC_TOPK="
            f"{embeddings.TOPK}.",
            "Nhánh chữ v2 (kb/card_search.py): chỉ mục BM25F trong RAM (kb/lexical.py FieldIndex; âm tiết trừ từ dừng "
            f"+ cặp âm tiết + mã liền), trọng số trường {card_search.WEIGHTS}, b theo trường {card_search.B}; thẻ chứa "
            f"≥ 1 từ của câu hỏi, lấy {card_search.TEXT_TOPK} thẻ điểm cao nhất. Thẻ chỉ khớp chữ chỉ nhận khi khớp ở "
            f"{'/'.join(card_search.STRONG)} phủ ≥ {card_search.TEXT_ONLY_COVER} idf câu hỏi (câu dài ≥ "
            f"{card_search.TEXT_ONLY_COVER_LONG}).",
            f"Gộp v2: RRF k={card_search.RRF_K} có trọng số — câu ≥ {card_search.LONG_QUERY} âm tiết nghĩa : chữ = "
            f"{card_search.SEMANTIC_WEIGHT_LONG:g} : 1, câu ngắn 1 : 1; hoà điểm theo độ giống nghĩa, điểm chữ, id.",
            f"Rerank (kb/rerank.py): {rerank.MODEL}, RERANK={'1' if rerank.ENABLED else '0'}, chấm lại "
            f"RERANK_TOPN={rerank.TOPN} thẻ đầu (v2: card_search.rerank_head — {card_search.RERANK_HEAD}, câu dài không "
            f"gồm đuôi chỉ khớp chữ; {kb.RERANK_CHARS} ký tự đầu: tiêu đề, tóm tắt, ý chính, khi nào dùng, thân bài); "
            "thẻ đã chấm xếp theo điểm, đứng trên phần còn lại; bỏ thẻ đã chấm có điểm < RERANK_MIN="
            f"{rerank.MIN_SCORE}{' (không bỏ thẻ nào)' if not rerank.MIN_SCORE else ''}; quá RERANK_TIMEOUT_MS="
            f"{int(rerank.TIMEOUT * 1000)} -> giữ thứ tự gộp, reranked=false.",
            "Nhánh nghĩa không chạy được (SEARCH_SEMANTIC=0, AI local tắt / lỗi): v2 chỉ nhánh chữ BM25F, thẻ phủ ≥ "
            f"{card_search.TEXT_COVER} idf câu hỏi, rồi rerank nếu có; v1 regex đủ mọi từ, xếp theo updated_at.",
            f"v1 (chế độ cards-text / cards-hybrid / cards-hybrid-rerank): regex đủ mọi từ, tối đa {kb.HYBRID_TEXT_MAX} "
            f"thẻ, BM25 search_text + tiêu đề × {kb.TITLE_WEIGHT}, RRF k=60 đều, thẻ khớp chữ +1e-6.",
        ],
        "search_documents": [
            f"Qdrant `{doc_vectors.COLLECTION}` (đoạn ~{doc_vectors.CHUNK_CHARS} ký tự, gối {doc_vectors.OVERLAP}): "
            f"nhánh dense {LOCAL_EMBED_MODEL} (score_threshold RAW_SEMANTIC_MIN={doc_vectors.MIN_SCORE}) và nhánh "
            "từ khoá vector thưa BM25 (IDF do Qdrant tính) chạy song song, mỗi nhánh gom theo tài liệu (3 đoạn); "
            f"RAW_HYBRID={'1' if doc_vectors.HYBRID else '0'}; gộp RRF mức tài liệu trong Python (k={doc_vectors.RRF_K}, "
            f"trọng số nghĩa {doc_vectors.W_DENSE} : từ khoá {doc_vectors.W_SPARSE}).",
            "Lọc lại bằng Mongo (phạm vi quyền, wiki_status nếu có).",
            f"Rerank {rerank.MODEL}: {doc_vectors.RERANK_DOCS} tài liệu đầu, mỗi tài liệu 1 đoạn tốt nhất; bỏ tài "
            f"liệu có điểm rerank < RAW_RERANK_MIN={doc_vectors.RERANK_MIN}.",
            "AI local tắt -> chỉ nhánh từ khoá; Qdrant tắt / RAW_SEMANTIC=0 -> available=false.",
        ],
    }


def config_snapshot() -> dict:
    return {"SEARCH_SEMANTIC": embeddings.ENABLED, "SEARCH_SEMANTIC_MIN": embeddings.MIN_SCORE,
            "SEARCH_SEMANTIC_MARGIN": embeddings.MARGIN, "SEARCH_SEMANTIC_TOPK": embeddings.TOPK,
            "RERANK": rerank.ENABLED, "RERANK_MODEL": rerank.MODEL, "RERANK_TOPN": rerank.TOPN,
            "RERANK_MIN": rerank.MIN_SCORE, "RERANK_TIMEOUT_MS": int(rerank.TIMEOUT * 1000),
            "RAW_SEMANTIC": doc_vectors.ENABLED, "RAW_SEMANTIC_MIN": doc_vectors.MIN_SCORE,
            "RAW_RERANK_MIN": doc_vectors.RERANK_MIN, "RERANK_DOCS": doc_vectors.RERANK_DOCS,
            "RAW_HYBRID": doc_vectors.HYBRID, "RAW_RRF_DENSE": doc_vectors.W_DENSE,
            "RAW_RRF_SPARSE": doc_vectors.W_SPARSE, "LOCAL_EMBED_MODEL": LOCAL_EMBED_MODEL,
            "SEARCH_RANKING": card_search.RANKING, "TEXT_TOPK": card_search.TEXT_TOPK,
            "TEXT_ONLY_COVER": card_search.TEXT_ONLY_COVER, "TEXT_ONLY_COVER_LONG": card_search.TEXT_ONLY_COVER_LONG,
            "TEXT_COVER": card_search.TEXT_COVER, "LONG_QUERY": card_search.LONG_QUERY,
            "RERANK_HEAD": card_search.RERANK_HEAD, "SEMANTIC_WEIGHT_LONG": card_search.SEMANTIC_WEIGHT_LONG,
            "HYBRID_TEXT_MAX": kb.HYBRID_TEXT_MAX, "TITLE_WEIGHT": kb.TITLE_WEIGHT, "RERANK_CHARS": kb.RERANK_CHARS,
            "card_page_size": CARD_PAGE, "doc_limit": DOC_LIMIT}


# ---------------------------------------------------------------------------
# Bộ ca
# ---------------------------------------------------------------------------

def norm_title(s: str) -> str:
    """Chuẩn hoá để khớp tiêu đề: không dấu, chữ thường, bỏ dấu câu / ngoặc kép."""
    return " ".join(re.sub(r"[^a-z0-9]+", " ", db.unaccent(s or "")).split())


def load_golden(path: Path = GOLDEN) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    for c in data["cases"]:
        for e in c.get("expected") or []:
            e.setdefault("id", e.get("document_id"))
    return data


def expected_of(case: dict) -> dict[str, int]:
    """{id thẻ / tài liệu: grade} — grade 2 đúng trọng tâm, 1 liên quan, 0 đã chấm lạc đề."""
    return {str(e.get("id") or e.get("document_id")): int(e["grade"]) for e in case.get("expected") or []}


def copy_ratio(query: str, title: str) -> float:
    q = lexical.syllables(query)
    t = set(lexical.syllables(title))
    return sum(w in t for w in q) / len(q) if q else 0.0


def _card_filter(filters: dict, user: dict) -> dict:
    """Bộ lọc giống list_cards (để kiểm thẻ đích thoả filters của ca ghep-dieu-kien)."""
    from app.kb import classify
    f = kb.space_scope(None, user, filters.get("category"))
    parts = [f, *classify.filters(filters.get("level"), filters.get("division"), filters.get("process_step"))]
    if types := classify.csv(filters.get("type")):
        parts.append({"type": {"$in": types}})
    return {"$and": parts}


def check_golden(data: dict, user: dict | None = None) -> dict:
    """Kiểm bộ ca: đếm theo target / kind / split / source / khối, id đích tồn tại, thẻ rejected, bộ lọc,
    chép tiêu đề. Trả {counts, errors, warnings, copy}."""
    cases = data["cases"]
    errors, warnings, copy = [], [], []
    seen = Counter(c["id"] for c in cases)
    errors += [f"id ca trùng: {i}" for i, n in seen.items() if n > 1]
    card_ids = {ObjectId(i) for c in cases if c["target"] == "cards" for i in expected_of(c) if ObjectId.is_valid(i)}
    doc_ids = {ObjectId(i) for c in cases if c["target"] == "documents" for i in expected_of(c) if ObjectId.is_valid(i)}
    cards = {c["_id"]: c for c in kb.cards.find({"_id": {"$in": list(card_ids)}},
                                                {"title": 1, "status": 1, "fields": 1, "categories": 1})}
    docs = {d["_id"]: d for d in kb.documents.find({"_id": {"$in": list(doc_ids)}}, {"title": 1})}
    for c in cases:
        where = f"{c['id']}:"
        if c.get("target") not in TARGETS:
            errors.append(f"{where} target lạ {c.get('target')}")
            continue
        for k, allowed in (("kind", KINDS), ("source", SOURCES), ("split", SPLITS)):
            if c.get(k) not in allowed:
                errors.append(f"{where} {k} lạ {c.get(k)}")
        if bad := set(c.get("filters") or {}) - FILTER_KEYS[c["target"]]:
            errors.append(f"{where} bộ lọc không hỗ trợ cho {c['target']}: {sorted(bad)}")
        exp = expected_of(c)
        if c.get("kind") == "khong-co-dap-an" and any(g > 0 for g in exp.values()):
            errors.append(f"{where} khong-co-dap-an mà có thẻ / tài liệu đúng")
        if c.get("kind") != "khong-co-dap-an" and not any(g > 0 for g in exp.values()):
            errors.append(f"{where} không có đáp án nào (grade ≥ 1)")
        pool = cards if c["target"] == "cards" else docs
        for i, g in exp.items():
            row = pool.get(ObjectId(i)) if ObjectId.is_valid(i) else None
            if row is None:
                errors.append(f"{where} id đích không tồn tại: {i}")
                continue
            if c["target"] == "cards" and row.get("status") == "rejected" and g > 0:
                dup = (row.get("fields") or {}).get("duplicate_of")
                warnings.append(f"{where} thẻ đích {i} đã bị loại" + (f" (trùng -> {dup})" if dup else ""))
            if g == 2 and c.get("kind") not in COPY_EXEMPT:
                r = copy_ratio(c["query"], row.get("title") or "")
                if r >= COPY_WARN:
                    copy.append(f"{where} câu hỏi trùng {r:.0%} âm tiết với tiêu đề \"{row.get('title')}\"")
        if user and c["target"] == "cards" and c.get("filters"):
            ok = {x["_id"] for x in kb.cards.find({"$and": [_card_filter(c["filters"], user),
                                                           {"_id": {"$in": [ObjectId(i) for i in exp]}}]}, {"_id": 1})}
            miss = [i for i, g in exp.items() if g > 0 and ObjectId(i) not in ok]
            if miss:
                errors.append(f"{where} thẻ đích không thoả bộ lọc {c['filters']}: {miss}")
    counts = {k: dict(Counter(f"{c['target']}/{c.get(k)}" for c in cases)) for k in ("kind", "split", "source", "block")}
    counts["target"] = dict(Counter(c["target"] for c in cases))
    counts["kind_total"] = dict(Counter(c.get("kind") for c in cases))
    counts["kind_split"] = dict(Counter(f"{c.get('kind')}/{c.get('split')}" for c in cases))
    counts["total"] = len(cases)
    return {"counts": counts, "errors": errors, "warnings": warnings, "copy": copy}


def block_of(target: str, ids: list[str]) -> str | None:
    """Khối (tầng 1 cây v2) của các đích grade 2 — lĩnh vực chính của thẻ / thẻ dẫn về tài liệu."""
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    if target == "cards":
        rows = kb.cards.find({"_id": {"$in": oids}}, {"categories": 1})
    else:
        rows = kb.cards.find({"document_id": {"$in": oids}}, {"categories": 1})
    tops = Counter(((r.get("categories") or [""])[0] or "").split(".")[0] for r in rows)
    tops.pop("", None)
    return next((b for b, _ in tops.most_common() if b in BLOCKS), None)


# ---------------------------------------------------------------------------
# Nhập câu hỏi từ CSV (scripts/data/search_golden_template.csv)
# ---------------------------------------------------------------------------

_titles: dict[str, list[tuple[str, dict]]] = {}


def _in_order(words: list[str], title: str) -> bool:
    it = iter(title.split())
    return all(w in it for w in words)


def resolve(target: str, token: str) -> tuple[str | None, str]:
    """Tiêu đề (hoặc đầu tiêu đề) / id -> (id, cách khớp). Khớp lần lượt: đầu tiêu đề -> chứa trong tiêu đề -> đủ
    từ theo thứ tự (tiêu đề chèn thêm chữ). Thẻ rejected trùng (fields.duplicate_of) -> thẻ giữ lại.
    Khớp nhiều: ưu tiên thẻ chưa bị loại; vẫn nhiều -> None + ghi chú để người nhập sửa."""
    token = token.strip()
    coll = kb.cards if target == "cards" else kb.documents
    fields = {"title": 1, "status": 1, "fields": 1}
    if ObjectId.is_valid(token):
        row = coll.find_one({"_id": ObjectId(token)}, fields)
        return _kept(target, row, "id") if row else (None, "id không tồn tại")
    key = norm_title(token)
    if not key:
        return None, "rỗng"
    if target not in _titles:
        _titles[target] = [(norm_title(r.get("title")), r) for r in coll.find({}, fields)]
    rows = _titles[target]
    found, how = [], ""
    for how, hit in (("đầu tiêu đề", lambda t: t.startswith(key)), ("chứa trong tiêu đề", lambda t: key in t),
                     ("đủ từ theo thứ tự", lambda t: _in_order(key.split(), t))):
        if found := [r for t, r in rows if hit(t)]:
            break
    if not found:
        return None, "không khớp"
    if target == "cards" and len(found) > 1:
        live = [r for r in found if r.get("status") != "rejected"]
        found = live or found
    if len(found) > 1:
        return None, f"khớp {len(found)} ({how}): " + "; ".join(f"{r['_id']} {r.get('title')}" for r in found[:5])
    return _kept(target, found[0], how)


def _kept(target: str, row: dict, how: str) -> tuple[str, str]:
    """Thẻ bị loại vì trùng (fields.duplicate_of) -> thẻ giữ lại."""
    if target == "cards" and row.get("status") == "rejected":
        dup = (row.get("fields") or {}).get("duplicate_of")
        if dup and ObjectId.is_valid(dup) and kb.cards.count_documents({"_id": ObjectId(dup)}):
            return dup, f"{how}; thẻ {row['_id']} bị loại vì trùng, lấy thẻ giữ lại"
    return str(row["_id"]), how


def parse_filters(s: str) -> dict:
    out = {}
    for part in re.split(r"[;\n]", s or ""):
        if "=" in part:
            k, v = part.split("=", 1)
            if k.strip() and v.strip():
                out[k.strip()] = v.strip()
    return out


def import_csv(path: Path, golden: Path = GOLDEN, dry_run: bool = False) -> dict:
    """Thêm / thay (cùng id) ca từ CSV vào bộ ca. Trả {added, replaced, problems}."""
    data = load_golden(golden) if golden.exists() else {"description": "", "cases": []}
    by_id = {c["id"]: k for k, c in enumerate(data["cases"])}
    problems, added, replaced = [], [], []
    with path.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))
    for n, r in enumerate(rows, 2):
        cid = (r.get("id") or "").strip()
        query = (r.get("query") or "").strip()
        if not cid or not query:
            problems.append(f"dòng {n}: thiếu id hoặc query — bỏ qua")
            continue
        target = (r.get("target") or "cards").strip()
        kind = (r.get("kind") or "dien-dat-khac").strip()
        expected, bad = [], False
        for grade, col in ((2, "expected_2"), (1, "expected_1"), (0, "expected_0")):
            for token in [t for t in (r.get(col) or "").split("|") if t.strip()]:
                rid, how = resolve(target, token)
                if rid is None:
                    problems.append(f"dòng {n} ({cid}) {col} \"{token.strip()}\": {how}")
                    bad = bad or grade > 0
                    continue
                if how not in ("id", "đầu tiêu đề"):
                    problems.append(f"dòng {n} ({cid}) {col} \"{token.strip()}\": {how} -> {rid}")
                if any(e["id"] == rid for e in expected):
                    continue
                key = "id" if target == "cards" else "document_id"
                row = (kb.cards if target == "cards" else kb.documents).find_one({"_id": ObjectId(rid)}, {"title": 1})
                expected.append({key: rid, "grade": grade, "title": (row or {}).get("title")}
                                | ({"id": rid} if key != "id" else {}))
        case = {"id": cid, "query": query, "target": target, "kind": kind,
                "source": (r.get("source") or "nhan_vien").strip(), "split": (r.get("split") or "").strip(),
                "filters": parse_filters(r.get("filters") or ""), "expected": expected,
                "note": (r.get("note") or "").strip()}
        if bad:
            case["note"] = (case["note"] + " · CHƯA ĐỦ NHÃN: có dòng expected không khớp").strip(" ·")
        if not case["split"]:   # chia dev / test cân theo kind
            cnt = Counter(c["split"] for c in data["cases"] if c.get("kind") == kind and c["id"] != cid)
            case["split"] = "dev" if cnt["dev"] <= cnt["test"] else "test"
        case["block"] = block_of(target, [e["id"] for e in expected if e["grade"] == 2])
        for e in case["expected"]:
            if target == "documents":
                e.pop("id", None)
        if cid in by_id:
            data["cases"][by_id[cid]] = case
            replaced.append(cid)
        else:
            by_id[cid] = len(data["cases"])
            data["cases"].append(case)
            added.append(cid)
    if not dry_run:
        write_golden(data, golden)
    return {"added": added, "replaced": replaced, "problems": problems}


def write_golden(data: dict, path: Path = GOLDEN) -> None:
    for c in data["cases"]:
        for e in c.get("expected") or []:
            if "document_id" in e:
                e.pop("id", None)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Sức khoẻ chỉ mục, vector thẻ thiếu
# ---------------------------------------------------------------------------

def index_health() -> dict:
    """Thẻ thiếu embedding / lệch hash (nội dung đổi sau khi embed), tài liệu chưa có đoạn / lệch hash trong Qdrant."""
    saved = {r["_id"]: r.get("hash") for r in embeddings.store.find({"model": LOCAL_EMBED_MODEL}, {"hash": 1})}
    n = missing = stale = 0
    live_missing = 0
    ids = set()
    for c in kb.cards.find({}, embeddings.TEXT_FIELDS | {"status": 1}):
        n += 1
        ids.add(c["_id"])
        h = saved.get(c["_id"])
        if h is None:
            missing += 1
            live_missing += c.get("status") != "rejected"
        elif h != embeddings.text_hash(c):
            stale += 1
    out = {"cards": {"total": n, "missing_embedding": missing, "missing_not_rejected": live_missing,
                     "stale_hash": stale, "orphan_embeddings": len(set(saved) - ids), "model": LOCAL_EMBED_MODEL}}
    docs = {"total": kb.documents.estimated_document_count()}
    if not doc_vectors.up(fresh=True):
        docs["qdrant"] = "không chạy"
        out["documents"] = docs
        return out
    try:
        indexed = doc_vectors.indexed()
    except Exception as e:   # noqa: BLE001
        docs["qdrant"] = f"lỗi: {str(e)[:150]}"
        out["documents"] = docs
        return out
    empty = no_chunks = stale_d = 0
    mongo_ids = set()
    for d in kb.documents.find({}, doc_vectors.DOC_FIELDS):
        sid = str(d["_id"])
        mongo_ids.add(sid)
        if not (d.get("text") or "").strip():
            empty += 1
            continue
        h = indexed.get(sid)
        if h is None:
            no_chunks += 1
        elif h != doc_vectors.doc_hash(d):
            stale_d += 1
    docs |= {"empty_text": empty, "no_chunks": no_chunks, "stale_hash": stale_d, "indexed_docs": len(indexed),
             "orphan_in_qdrant": len(set(indexed) - mongo_ids)}
    out["documents"] = docs
    return out


def fill_missing_vectors(cache_path: Path) -> dict:
    """Thẻ thiếu embedding / lệch hash: lấy từ bộ đệm file hoặc tính bằng AI local, nạp vào RAM (embeddings._cache)
    như luồng nền của máy chủ sẽ làm — KHÔNG ghi card_embeddings."""
    if np is None:
        raise SystemExit("--embed-missing cần numpy")
    saved = {r["_id"]: r.get("hash") for r in embeddings.store.find({"model": LOCAL_EMBED_MODEL}, {"hash": 1})}
    need = [c for c in kb.cards.find({}, embeddings.TEXT_FIELDS) if saved.get(c["_id"]) != embeddings.text_hash(c)]
    disk: dict[str, tuple[str, list]] = {}
    if cache_path.exists():
        z = np.load(cache_path, allow_pickle=False)
        disk = {i: (h, v) for i, h, v in zip(z["ids"].tolist(), z["hashes"].tolist(), z["vecs"])}
    todo = []
    from_disk = 0
    for c in need:
        h = embeddings.text_hash(c)
        hit = disk.get(str(c["_id"]))
        if hit and hit[0] == h:
            embeddings._cache[str(c["_id"])] = (h, c.get("updated_at"), embeddings._norm(hit[1]))
            from_disk += 1
        else:
            todo.append((c, h))
    t0 = time.time()
    for s in range(0, len(todo), embeddings.BATCH):
        batch = todo[s:s + embeddings.BATCH]
        for (c, h), vec in zip(batch, local_ai.embed([embeddings.embed_text(c) for c, _ in batch])):
            embeddings._cache[str(c["_id"])] = (h, c.get("updated_at"), embeddings._norm(vec))
            disk[str(c["_id"])] = (h, vec)
        print(f"\r  embedding thẻ: {min(s + embeddings.BATCH, len(todo))}/{len(todo)}", end="", flush=True)
    if todo:
        print()
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        ids = list(disk)
        np.savez(cache_path, ids=np.array(ids), hashes=np.array([disk[i][0] for i in ids]),
                 vecs=np.array([np.asarray(disk[i][1], dtype=np.float32) for i in ids]))
    return {"need": len(need), "from_file": from_disk, "embedded": len(todo), "seconds": round(time.time() - t0, 1)}


# ---------------------------------------------------------------------------
# Chạy, chấm
# ---------------------------------------------------------------------------

def mode_ready(mode: Mode) -> str | None:
    """None = chạy được; chuỗi = lý do bỏ qua (thiếu AI local / reranker / Qdrant)."""
    if not mode.ready:
        return "chưa có (chỗ cắm cho việc sau)"
    if "embed" in mode.needs and (not embeddings.ENABLED or not embeddings.ready()):
        return f"AI local chưa có model embedding {LOCAL_EMBED_MODEL} (hoặc SEARCH_SEMANTIC=0)"
    if "rerank" in mode.needs and rerank.score("thử", ["thử"], timeout=None) is None:
        return f"không nạp được reranker {rerank.MODEL} (hoặc RERANK=0)"
    if "qdrant" in mode.needs and (not doc_vectors.ENABLED or not doc_vectors.up(fresh=True)):
        return "Qdrant không chạy (hoặc RAW_SEMANTIC=0)"
    return None


def search(case: dict, user: dict) -> tuple[list[dict], float, str | None]:
    """Gọi đúng hàm API / MCP. Trả (kết quả gọn, mili giây, lỗi)."""
    f = case.get("filters") or {}
    t0 = time.perf_counter()
    try:
        if case["target"] == "cards":
            res = kb.list_cards(None, case["query"], f.get("type"), None, None, None, f.get("category"),
                                f.get("level"), f.get("division"), f.get("process_step"), 1, CARD_PAGE, user)
            ms = (time.perf_counter() - t0) * 1000
            return [{"id": c["id"], "title": c.get("title"), "type": c.get("type"), "status": c.get("status"),
                     "match": c.get("match"), "semantic_score": c.get("semantic_score"),
                     "text_score": c.get("text_score"), "rerank_score": c.get("rerank_score"),
                     "reranked": c.get("reranked")} for c in res["items"]], ms, None
        res = kb.semantic_documents(None, case["query"], f.get("status", ""), DOC_LIMIT, user)
        if not res["available"] and doc_vectors.up(fresh=True):
            # up() nhớ "Qdrant chết" 30 giây sau một lần readyz chậm -> kiểm lại ngay, thử lại một lần
            t0 = time.perf_counter()
            res = kb.semantic_documents(None, case["query"], f.get("status", ""), DOC_LIMIT, user)
        ms = (time.perf_counter() - t0) * 1000
        if not res["available"]:
            return [], ms, "không tìm tầng thô được (available=false)"
        return [{"id": d["id"], "title": d.get("title"), "score": d.get("score"), "rerank_score": d.get("rerank_score"),
                 "reranked": d.get("reranked"),
                 "starts": [p["start"] for p in d.get("passages") or []]} for d in res["items"]], ms, None
    except HTTPException as e:
        return [], (time.perf_counter() - t0) * 1000, f"HTTP {e.status_code}: {e.detail}"


def score(case: dict, hits: list[dict]) -> dict:
    grades = expected_of(case)
    ids = [h["id"] for h in hits]
    top = ids[:K]
    m: dict = {"n": len(ids), "empty": not ids}
    rel = {i for i, g in grades.items() if g >= 1}
    if rel:
        focus = {i for i, g in grades.items() if g == 2} or rel
        m["r5"] = len(rel & set(ids[:5])) / len(rel)
        m["r10"] = len(rel & set(top)) / len(rel)
        m["mrr"] = next((1 / (k + 1) for k, i in enumerate(top) if i in focus), 0.0)
        dcg = sum((2 ** grades.get(i, 0) - 1) / math.log2(k + 2) for k, i in enumerate(top))
        ideal = sorted((g for g in grades.values() if g > 0), reverse=True)[:K]
        m["ndcg"] = dcg / sum((2 ** g - 1) / math.log2(k + 2) for k, g in enumerate(ideal))
        m["p5_on"] = sum(grades.get(i) == 2 for i in ids[:5])
        m["hit1"] = bool(ids[:1]) and ids[0] in focus
        m["hit3"] = bool(focus & set(ids[:3]))
        m["kept2"] = sum(grades.get(i) == 2 for i in ids)
        m["n2"] = sum(g == 2 for g in grades.values())
    m["off10"] = sum(grades.get(i) == 0 for i in top)
    m["unjudged5"] = [i for i in ids[:5] if i not in grades]
    m["outside"] = sum(i not in grades or grades[i] == 0 for i in ids)
    if case["target"] == "cards":
        m["mem5"] = sum(h.get("type") in MEMORY_TYPES for h in hits[:5])
        m["watch5"] = any(norm_title(h.get("title")).startswith(WATCH_TITLE) for h in hits[:5])
        m["rejected5"] = sum(h.get("status") == "rejected" for h in hits[:5])
    else:
        want = [e for e in case.get("expected") or [] if e.get("start") is not None and e["grade"] > 0]
        if want:
            by = {h["id"]: h.get("starts") or [] for h in hits[:K]}
            m["passage"] = any(abs(s - e["start"]) < PASSAGE_WINDOW for e in want for s in by.get(str(e["id"]), []))
    return m


def pct(xs: list[float], p: float) -> float | None:
    if not xs:
        return None
    xs = sorted(xs)
    return round(xs[min(len(xs) - 1, max(0, math.ceil(p * len(xs)) - 1))], 1)


def summarize(rows: list[dict]) -> dict:
    """Chỉ số gộp của một nhóm ca (rows: {case meta, m, ms})."""
    if not rows:
        return {"cases": 0}
    ans = [r for r in rows if "r5" in r["m"]]
    none = [r for r in rows if r["kind"] == "khong-co-dap-an"]
    avg = (lambda key: round(sum(r["m"][key] for r in ans) / len(ans), 3) if ans else None)
    out = {"cases": len(rows), "answerable": len(ans), "R@5": avg("r5"), "R@10": avg("r10"), "MRR@10": avg("mrr"),
           "nDCG@10": avg("ndcg"),
           "top5_on_target": f"{sum(r['m']['p5_on'] for r in ans)}/{5 * len(ans)}" if ans else None,
           "empty_rate": round(sum(r["m"]["empty"] for r in rows) / len(rows), 3),
           "none_answered": f"{sum(r['m']['n'] > 0 for r in none)}/{len(none)}" if none else None,
           "hit@1": f"{sum(r['m']['hit1'] for r in ans)}/{len(ans)}" if ans else None,
           "hit@3": f"{sum(r['m']['hit3'] for r in ans)}/{len(ans)}" if ans else None,
           "p50_ms": pct([r["ms"] for r in rows], 0.5), "p95_ms": pct([r["ms"] for r in rows], 0.95),
           "off_top10": sum(r["m"]["off10"] for r in rows),
           "kept2": f"{sum(r['m']['kept2'] for r in ans)}/{sum(r['m']['n2'] for r in ans)}" if ans else None,
           "outside": sum(r["m"]["outside"] for r in rows), "errors": sum(bool(r.get("error")) for r in rows),
           "rerank_miss": sum(r.get("reranked") is False for r in rows)}
    if any("mem5" in r["m"] for r in rows):
        out |= {"memory_top5": sum(r["m"]["mem5"] for r in rows),
                "watch_top5": f"{sum(r['m']['watch5'] for r in rows)}/{len(rows)}",
                "rejected_top5": sum(r["m"]["rejected5"] for r in rows)}
    ps = [r for r in rows if "passage" in r["m"]]
    if ps:
        out["passage_hit"] = f"{sum(r['m']['passage'] for r in ps)}/{len(ps)}"
    return out


def groups(rows: list[dict]) -> dict:
    out = {}
    for key in ("kind", "split", "source", "block"):
        buckets = defaultdict(list)
        for r in rows:
            buckets[r.get(key) or "-"].append(r)
        out[key] = {k: summarize(v) for k, v in sorted(buckets.items())}
    return out


def run_mode(mode: Mode, cases: list[dict], user: dict, verbose: bool = False) -> list[dict]:
    rows = []
    with ExitStack() as stack:
        if mode.patch:
            mode.patch(stack)
        for case in cases:
            hits, ms, err = search(case, user)
            m = score(case, hits)
            grades = expected_of(case)
            rows.append({"id": case["id"], "query": case["query"], "kind": case.get("kind"), "split": case.get("split"),
                         "source": case.get("source"), "block": case.get("block"), "ms": round(ms, 1), "error": err,
                         "reranked": hits[0].get("reranked") if hits and rerank.ENABLED else None,
                         "m": m, "top": [h | {"grade": grades.get(h["id"])} for h in hits[:K]]})
            if verbose or err:
                shown = ", ".join(f"{h['grade'] if h['grade'] is not None else '?'}" for h in rows[-1]["top"])
                print(f"  {case['id']:14} nDCG={m.get('ndcg', 0):.2f} n={m['n']:2} [{shown}] {ms:.0f}ms"
                      + (f" LỖI {err}" if err else ""))
    return rows


def warm(cases: list[dict]) -> None:
    """Nạp trước vector câu hỏi + reranker để độ trễ đo được là của bước tìm (không tính embedding câu hỏi)."""
    if embeddings.ENABLED and embeddings.ready():
        for c in cases:
            try:
                embeddings._query_vector(c["query"])
            except Exception:   # noqa: BLE001 — lỗi embedding: semantic_search tự xử lý khi chạy thật
                pass
    rerank.score("thử", ["thử"], timeout=None)


# ---------------------------------------------------------------------------
# Hiệu chỉnh ngưỡng (đề xuất theo dev, báo số trên test — KHÔNG đổi mặc định)
# ---------------------------------------------------------------------------

class RerankMemo:
    """Nhớ điểm rerank theo (câu hỏi, văn bản) trong lúc quét lưới ngưỡng — cùng cặp thì cùng điểm."""

    def __init__(self):
        self.orig = rerank.score
        self.memo: dict = {}

    def __call__(self, q: str, texts: list[str], timeout=None):
        miss = [t for t in dict.fromkeys(texts) if (q, t) not in self.memo]
        if miss:
            got = self.orig(q, miss, timeout=None)   # quét lưới đo chất lượng: chờ chấm xong, không tính quá giờ
            if got is None:
                return None
            self.memo.update({(q, t): s for t, s in zip(miss, got)})
        return [self.memo[(q, t)] for t in texts]


def _grid_row(rows: list[dict]) -> dict:
    out = {}
    for sp in SPLITS:
        s = summarize([r for r in rows if r["split"] == sp])
        out[sp] = {k: s.get(k) for k in ("nDCG@10", "R@10", "MRR@10", "top5_on_target", "none_answered", "kept2",
                                         "outside", "empty_rate", "errors")}
    return out


def calibrate(cases: list[dict], user: dict, modes: list[str], memo: RerankMemo) -> dict:
    out: dict = {}
    cc = [c for c in cases if c["target"] == "cards"]
    dc = [c for c in cases if c["target"] == "documents"]
    with mock.patch.object(rerank, "score", memo):
        for name in ("cards-semantic", "cards-hybrid-rerank", "cards-hybrid-v2"):
            if name not in modes or not cc:
                continue
            grid = []
            for mn in CARD_MIN_GRID:
                for mg in CARD_MARGIN_GRID:
                    with mock.patch.object(embeddings, "MIN_SCORE", mn), mock.patch.object(embeddings, "MARGIN", mg):
                        grid.append({"SEARCH_SEMANTIC_MIN": mn, "SEARCH_SEMANTIC_MARGIN": mg}
                                    | _grid_row(run_mode(MODES[name], cc, user)))
                print(f"  hiệu chỉnh {name}: MIN={mn} xong")
            out[name] = grid
        if "cards-hybrid-v2" in modes and cc:   # việc C + B: ngưỡng rerank thẻ + số thẻ đem chấm lại (v2)
            grid = []
            for mn in CARD_RERANK_MIN_GRID:
                for tn in CARD_RERANK_HEAD_GRID:
                    with mock.patch.object(rerank, "MIN_SCORE", mn), mock.patch.object(card_search, "RERANK_HEAD", tn):
                        grid.append({"RERANK_MIN": mn, "RERANK_HEAD": tn}
                                    | _grid_row(run_mode(MODES["cards-hybrid-v2"], cc, user)))
            print("  hiệu chỉnh cards-hybrid-v2 (RERANK_MIN / RERANK_HEAD) xong")
            out["cards-hybrid-v2 · rerank"] = grid
        for name, grid_keys in (("documents-dense", [(mn, doc_vectors.RERANK_MIN) for mn in RAW_MIN_GRID]),
                                ("documents-current", [(mn, rm) for mn in RAW_MIN_GRID for rm in RAW_RERANK_GRID])):
            if name not in modes or not dc:
                continue
            grid = []
            for mn, rm in grid_keys:
                with mock.patch.object(doc_vectors, "MIN_SCORE", mn), mock.patch.object(doc_vectors, "RERANK_MIN", rm):
                    grid.append({"RAW_SEMANTIC_MIN": mn, "RAW_RERANK_MIN": rm} | _grid_row(run_mode(MODES[name], dc, user)))
            print(f"  hiệu chỉnh {name} xong")
            out[name] = grid
        for name in ("documents-hybrid", "documents-current"):   # việc D: trọng số RRF hai nhánh
            if name not in modes or not dc:
                continue
            grid = []
            for wd, ws in RAW_RRF_GRID:
                with mock.patch.object(doc_vectors, "W_DENSE", wd), mock.patch.object(doc_vectors, "W_SPARSE", ws):
                    grid.append({"RAW_RRF_DENSE": wd, "RAW_RRF_SPARSE": ws} | _grid_row(run_mode(MODES[name], dc, user)))
            print(f"  hiệu chỉnh {name} (trọng số RRF) xong")
            out[f"{name} · rrf"] = grid
    out["recommend"] = recommend(out)
    return out


def _is_default(row: dict) -> bool:
    return all(abs(row[k] - v) < 1e-9 for k, v in (("SEARCH_SEMANTIC_MIN", embeddings.MIN_SCORE),
                                                   ("SEARCH_SEMANTIC_MARGIN", embeddings.MARGIN),
                                                   ("RAW_SEMANTIC_MIN", doc_vectors.MIN_SCORE),
                                                   ("RAW_RERANK_MIN", doc_vectors.RERANK_MIN),
                                                   ("RERANK_MIN", rerank.MIN_SCORE),
                                                   ("RAW_RRF_DENSE", doc_vectors.W_DENSE),
                                                   ("RAW_RRF_SPARSE", doc_vectors.W_SPARSE),
                                                   ("RERANK_TOPN", rerank.TOPN),
                                                   ("RERANK_HEAD", card_search.RERANK_HEAD)) if k in row)


def recommend(cal: dict) -> dict:
    """Chọn theo nDCG@10 trên dev (hoà thì gần mặc định hơn); báo số test của lựa chọn và của mặc định."""
    out = {}
    for name, grid in cal.items():
        if not isinstance(grid, list) or not grid:
            continue
        keys = [k for k in grid[0] if k.isupper()]
        default = next((r for r in grid if _is_default(r)), None)
        base = default or grid[0]

        def dist(r):
            return sum(abs(r[k] - base[k]) for k in keys)
        clean = [r for r in grid if not r["dev"]["errors"] and not r["test"]["errors"]] or grid   # bỏ dòng lỗi tìm
        best = max(clean, key=lambda r: ((r["dev"]["nDCG@10"] or 0), -dist(r)))
        out[name] = {"params": {k: best[k] for k in keys}, "dev": best["dev"], "test": best["test"],
                     "default": {k: base[k] for k in keys} if default else None,
                     "default_dev": default["dev"] if default else None,
                     "default_test": default["test"] if default else None}
    return out


# ---------------------------------------------------------------------------
# Báo cáo
# ---------------------------------------------------------------------------

MAIN_COLS = ["cases", "R@5", "R@10", "MRR@10", "nDCG@10", "top5_on_target", "empty_rate", "none_answered", "p50_ms",
             "p95_ms", "rerank_miss"]
CARD_COLS = ["memory_top5", "watch_top5", "rejected_top5", "off_top10"]


def _fmt(v) -> str:
    if v is None:
        return "–"
    if isinstance(v, float):
        return f"{v:.3f}".rstrip("0").rstrip(".") if v < 10 else f"{v:.0f}"
    return str(v)


def _table(head: list[str], rows: list[list]) -> list[str]:
    return ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)] + ["| " + " | ".join(_fmt(x) for x in r) + " |"
                                                                          for r in rows]


def git_rev() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True,
                              timeout=5).stdout.strip()
    except Exception:   # noqa: BLE001
        return "?"


def kiem_thu_2609(rows: list[dict]) -> dict:
    """Đối chiếu kiểm thử tay 26/09: chỗ top 5 đúng ý (câu dài 10/40, từ khoá 9/40), thẻ Phân loại v2 lọt top 5
    ở 7/8 câu dài."""
    kt = [r for r in rows if r["source"] == "kiem_thu_2609"]
    long_ = [r for r in kt if r["kind"] == "dien-dat-khac"]
    short = [r for r in kt if r["kind"] == "tu-khoa-ngan"]
    return {"long_top5_on_target": f"{sum(r['m'].get('p5_on', 0) for r in long_)}/{5 * len(long_)}",
            "short_top5_on_target": f"{sum(r['m'].get('p5_on', 0) for r in short)}/{5 * len(short)}",
            "long_watch_top5": f"{sum(r['m'].get('watch5', False) for r in long_)}/{len(long_)}",
            "short_watch_top5": f"{sum(r['m'].get('watch5', False) for r in short)}/{len(short)}"}


def render_md(rep: dict) -> str:
    L = [f"# Đo chất lượng tìm kiếm — {rep['label']}", "",
         f"- Thời điểm: {rep['created_at']} · DB `{rep['db']}` · người tìm: {rep['user']} · code `{rep['git']}`",
         f"- Bộ ca: {rep['golden']['counts']['total']} ca ({rep['golden']['counts']['target']}) — "
         f"`backend/tests/data/search_golden.json`",
         "- Độ trễ: thời gian gọi hàm tìm (đã nạp sẵn vector câu hỏi + reranker, không tính embedding câu hỏi).",
         f"- Vector thẻ thiếu: {rep.get('embed_missing') or 'dùng card_embeddings như máy chủ (không tính thêm)'}", ""]
    L += ["## Các bước tìm đang chạy (đọc từ code)", ""]
    for tool, steps in rep["steps"].items():
        L.append(f"**{tool}**")
        L += [f"{k}. {s}" for k, s in enumerate(steps, 1)]
        L.append("")
    L += ["## Chế độ đo", ""]
    L += _table(["chế độ", "đích", "cách bật / tắt", "trạng thái"],
                [[n, MODES[n].target, MODES[n].note, m.get("skipped") or "đã chạy"] for n, m in rep["modes"].items()])
    L += ["", "## Bảng số nền", "",
          "R@k = tỷ lệ thẻ / tài liệu có nhãn (grade ≥ 1) lọt top k; MRR@10 theo đích grade 2; nDCG@10 lợi ích 2^grade − 1; "
          "top5_on_target = số chỗ top 5 là đúng ý (grade 2) / 5 × số ca có đáp án; none_answered = ca "
          "khong-co-dap-an vẫn ra kết quả; empty_rate = tỷ lệ ca không ra gì.", ""]
    ran = {n: m for n, m in rep["modes"].items() if "summary" in m}
    L += _table(["chế độ"] + MAIN_COLS, [[n] + [m["summary"].get(c) for c in MAIN_COLS] for n, m in ran.items()])
    cards_ran = {n: m for n, m in ran.items() if MODES[n].target == "cards"}
    if cards_ran:
        L += ["", "Thẻ bộ nhớ AI (skill / memory / context) lọt top 5 (số chỗ), thẻ \"Phân loại VCwiki v2\" lọt top 5 "
              "(số ca), thẻ rejected lọt top 5 (số chỗ), thẻ đã chấm lạc đề lọt top 10:", ""]
        L += _table(["chế độ"] + CARD_COLS, [[n] + [m["summary"].get(c) for c in CARD_COLS] for n, m in cards_ran.items()])
    for key, title in (("kind", "loại câu hỏi"), ("split", "split"), ("source", "nguồn ca"), ("block", "khối")):
        L += ["", f"### Theo {title} (nDCG@10 · R@10 · top5 đúng ý · không đáp án vẫn trả)", ""]
        vals = sorted({v for m in ran.values() for v in m["groups"][key]})
        rows = []
        for n, m in ran.items():
            g = m["groups"][key]
            rows.append([n] + [" · ".join(_fmt(g[v].get(c)) for c in ("nDCG@10", "R@10", "top5_on_target",
                                                                       "none_answered")) if v in g else "" for v in vals])
        L += _table(["chế độ"] + vals, rows)
    kt = {n: m["kiem_thu_2609"] for n, m in cards_ran.items() if m.get("kiem_thu_2609")}
    if kt:
        L += ["", "## Đối chiếu kiểm thử tay 26/09", "",
              "26/09 (search_cards trên máy chủ lúc đó): chỗ top 5 đúng ý câu dài 10/40, từ khoá 9/40; thẻ "
              "\"Phân loại VCwiki v2\" lọt top 5 ở 7/8 câu dài.", ""]
        L += _table(["chế độ", "câu dài top5 đúng ý", "từ khoá top5 đúng ý", "Phân loại v2 top5 (câu dài)",
                     "Phân loại v2 top5 (từ khoá)"],
                    [[n, v["long_top5_on_target"], v["short_top5_on_target"], v["long_watch_top5"], v["short_watch_top5"]]
                     for n, v in kt.items()])
    h = rep.get("health")
    if h:
        L += ["", "## Sức khoẻ chỉ mục", ""]
        c = h["cards"]
        L.append(f"- Thẻ: {c['total']} · thiếu embedding {c['missing_embedding']} (chưa bị loại: "
                 f"{c['missing_not_rejected']}) · lệch hash (nội dung đổi sau khi embed) {c['stale_hash']} · "
                 f"embedding mồ côi {c['orphan_embeddings']} · model {c['model']}")
        d = h["documents"]
        if "qdrant" in d:
            L.append(f"- Tài liệu: {d['total']} · Qdrant {d['qdrant']}")
        else:
            L.append(f"- Tài liệu: {d['total']} · văn bản rỗng {d['empty_text']} · chưa có đoạn trong Qdrant "
                     f"{d['no_chunks']} · lệch hash {d['stale_hash']} · Qdrant có {d['indexed_docs']} tài liệu, "
                     f"{d['orphan_in_qdrant']} không có trong DB này")
    g = rep["golden"]
    L += ["", "## Kiểm bộ ca", "", f"- Theo loại: {g['counts']['kind_total']}", f"- Theo nguồn: {g['counts']['source']}",
          f"- Theo khối: {g['counts']['block']}", f"- Theo split: {g['counts']['split']}",
          f"- Lỗi: {len(g['errors'])} · cảnh báo: {len(g['warnings'])} · cảnh báo chép tiêu đề: {len(g['copy'])}"]
    L += [f"  - {x}" for x in (g["errors"] + g["warnings"] + g["copy"])[:40]]
    cal = rep.get("calibration")
    if cal:
        L += ["", "## Hiệu chỉnh ngưỡng (chọn theo nDCG@10 trên dev, báo test — mặc định trong code KHÔNG đổi)", ""]
        for name, r in cal.get("recommend", {}).items():
            L.append(f"- **{name}**: đề xuất {r['params']} — dev nDCG@10 {_fmt(r['dev']['nDCG@10'])}, test nDCG@10 "
                     f"{_fmt(r['test']['nDCG@10'])} (R@10 {_fmt(r['test']['R@10'])}, không đáp án vẫn trả "
                     f"{_fmt(r['test']['none_answered'])}); mặc định {r['default']} — dev "
                     f"{_fmt((r['default_dev'] or {}).get('nDCG@10'))}, test {_fmt((r['default_test'] or {}).get('nDCG@10'))}")
        for name, grid in cal.items():
            if not isinstance(grid, list):
                continue
            keys = [k for k in grid[0] if k.isupper()]
            L += ["", f"### {name}", "", "kept2 = số cặp (ca, thẻ / tài liệu đúng ý) còn trong kết quả; outside = số "
                  "kết quả ngoài nhãn (chưa chấm hoặc lạc đề).", ""]
            cols = ["nDCG@10", "R@10", "top5_on_target", "none_answered", "kept2", "outside"]
            L += _table(keys + [f"{sp} {c}" for sp in SPLITS for c in cols],
                        [[r[k] for k in keys] + [r[sp][c] for sp in SPLITS for c in cols] for r in grid])
    un = rep.get("unjudged")
    if un:
        L += ["", "## Thẻ / tài liệu chưa chấm lọt top 5 (để chấm bổ sung)", ""]
        for name, items in un.items():
            L.append(f"**{name}**")
            L += [f"- {x['case']} \"{x['query']}\" → #{x['rank']} {x['id']} {x['title']}" for x in items[:150]]
            if len(items) > 150:
                L.append(f"- … còn {len(items) - 150} (xem file .json)")
            L.append("")
    return "\n".join(L) + "\n"


def unjudged(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        for k, h in enumerate(r["top"][:5], 1):
            if h["grade"] is None:
                out.append({"case": r["id"], "query": r["query"], "rank": k, "id": h["id"], "title": h.get("title")})
    return out


def compare(a: Path, b: Path) -> str:
    ra, rb = (json.loads(p.read_text(encoding="utf-8")) for p in (a, b))
    L = [f"So sánh {a.name} (A) → {b.name} (B)", ""]
    cols = ["R@5", "R@10", "MRR@10", "nDCG@10", "empty_rate", "p50_ms", "p95_ms"]
    rows = []
    for name in dict.fromkeys(list(ra["modes"]) + list(rb["modes"])):
        sa = ra["modes"].get(name, {}).get("summary")
        sb = rb["modes"].get(name, {}).get("summary")
        if not sa or not sb:
            continue
        rows.append([name] + [f"{_fmt(sa.get(c))} → {_fmt(sb.get(c))} ({_delta(sa.get(c), sb.get(c))})" for c in cols]
                    + [f"{sa.get('top5_on_target')} → {sb.get('top5_on_target')}",
                       f"{sa.get('none_answered')} → {sb.get('none_answered')}"])
        for kind in dict.fromkeys(list(ra["modes"][name]["groups"]["kind"]) + list(rb["modes"][name]["groups"]["kind"])):
            ga = ra["modes"][name]["groups"]["kind"].get(kind, {})
            gb = rb["modes"][name]["groups"]["kind"].get(kind, {})
            rows.append([f"  {name} · {kind}"] + [f"{_fmt(ga.get(c))} → {_fmt(gb.get(c))} ({_delta(ga.get(c), gb.get(c))})"
                                                 for c in cols] + [f"{ga.get('top5_on_target')} → {gb.get('top5_on_target')}",
                                                                   f"{ga.get('none_answered')} → {gb.get('none_answered')}"])
    L += _table(["chế độ"] + cols + ["top5 đúng ý", "không đáp án vẫn trả"], rows)
    return "\n".join(L)


def _delta(a, b) -> str:
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return "–"
    return f"{b - a:+.3f}".rstrip("0").rstrip(".")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def parse_args(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--db", help=f"database MongoDB (mặc định biến MONGO_DB hoặc {DEFAULT_DB})")
    p.add_argument("--user", default=DEFAULT_USER, help="email người tìm (phạm vi quyền)")
    p.add_argument("--modes", default=",".join(DEFAULT_MODES), help=f"chế độ, cách dấu phẩy: {', '.join(MODES)}")
    p.add_argument("--only", default="", help="chỉ các ca (id, cách dấu phẩy)")
    p.add_argument("--split", choices=SPLITS, help="chỉ một split")
    p.add_argument("--label", default="nen", help="nhãn tên file báo cáo")
    p.add_argument("--golden", default=str(GOLDEN), help="file bộ ca")
    p.add_argument("--embed-missing", action="store_true", help="thẻ thiếu / lệch embedding: tính trong RAM (không ghi DB)")
    p.add_argument("--no-calibrate", action="store_true", help="bỏ quét lưới ngưỡng")
    p.add_argument("--no-health", action="store_true", help="bỏ đếm sức khoẻ chỉ mục")
    p.add_argument("--check", action="store_true", help="chỉ kiểm bộ ca")
    p.add_argument("--import", dest="import_csv", metavar="CSV", help="thêm câu hỏi từ CSV (mẫu scripts/data/search_golden_template.csv)")
    p.add_argument("--dry-run", action="store_true", help="--import: chỉ in, không ghi")
    p.add_argument("--compare", nargs=2, metavar=("A.json", "B.json"), help="in chênh lệch hai lần đo")
    p.add_argument("-v", "--verbose", action="store_true")
    return p.parse_args(argv)


def main(argv=None) -> None:
    args = parse_args(argv)
    if args.compare:
        print(compare(Path(args.compare[0]), Path(args.compare[1])))
        return
    golden = Path(args.golden)
    if args.import_csv:
        res = import_csv(Path(args.import_csv), golden, args.dry_run)
        print(f"Thêm {len(res['added'])} ca, thay {len(res['replaced'])} ca{' (chạy thử, chưa ghi)' if args.dry_run else ''}")
        for x in res["problems"]:
            print(f"  ! {x}")
        return
    embeddings.MODE = "off"   # chỉ đọc: không tính / ghi embedding nền khi thấy thẻ thiếu
    user = auth.users.find_one({"email": args.user})
    if not user:
        raise SystemExit(f"Không có người dùng {args.user} trong DB {db.db.name}")
    data = load_golden(golden)
    check = check_golden(data, user)
    print(f"DB {db.db.name} · bộ ca {check['counts']['total']} · lỗi {len(check['errors'])} · cảnh báo "
          f"{len(check['warnings'])} · chép tiêu đề {len(check['copy'])}")
    for x in check["errors"] + check["warnings"] + check["copy"]:
        print(f"  ! {x}")
    if args.check:
        print(json.dumps(check["counts"], ensure_ascii=False, indent=1))
        return
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    cases = [c for c in data["cases"] if (not only or c["id"] in only) and (not args.split or c["split"] == args.split)]
    rep = {"label": args.label, "created_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "db": db.db.name,
           "user": f"{user.get('name')} <{args.user}>", "git": git_rev(), "config": config_snapshot(),
           "steps": pipeline_steps(), "golden": check, "modes": {}}
    if not args.no_health:
        print("Đếm sức khoẻ chỉ mục…")
        rep["health"] = index_health()
    if args.embed_missing:
        rep["embed_missing"] = fill_missing_vectors(OUT_DIR / f"card-vectors-{db.db.name}.npz")
        print(f"Vector thẻ thiếu: {rep['embed_missing']}")
    warm(cases)
    names = [n.strip() for n in args.modes.split(",") if n.strip()]
    for n in names:
        if n not in MODES:
            raise SystemExit(f"Chế độ lạ: {n} (có: {', '.join(MODES)})")
    rep["unjudged"] = {}
    for n in names:
        mode = MODES[n]
        todo = [c for c in cases if c["target"] == mode.target]
        if skip := mode_ready(mode):
            rep["modes"][n] = {"skipped": skip}
            print(f"[{n}] bỏ qua — {skip}")
            continue
        print(f"[{n}] {len(todo)} ca")
        rows = run_mode(mode, todo, user, args.verbose)
        entry = {"summary": summarize(rows), "groups": groups(rows), "cases": rows}
        if mode.target == "cards":
            entry["kiem_thu_2609"] = kiem_thu_2609(rows)
        rep["modes"][n] = entry
        rep["unjudged"][n] = unjudged(rows)
        s = entry["summary"]
        print(f"  nDCG@10 {_fmt(s.get('nDCG@10'))} · R@10 {_fmt(s.get('R@10'))} · MRR {_fmt(s.get('MRR@10'))} · top5 "
              f"đúng ý {s.get('top5_on_target')} · không đáp án vẫn trả {s.get('none_answered')} · p50 {s.get('p50_ms')} ms")
    if not args.no_calibrate:
        print("Quét lưới ngưỡng…")
        rep["calibration"] = calibrate(cases, user, [n for n in names if "summary" in rep["modes"].get(n, {})],
                                       RerankMemo())
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = OUT_DIR / f"search-{datetime.now().strftime('%Y%m%d-%H%M')}-{re.sub(r'[^A-Za-z0-9_-]+', '-', args.label)}"
    stem.with_suffix(".json").write_text(json.dumps(rep, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    stem.with_suffix(".md").write_text(render_md(rep), encoding="utf-8")
    print(f"Đã ghi {stem}.md + .json")


if __name__ == "__main__":
    main()
