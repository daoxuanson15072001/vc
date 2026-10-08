"""Bộ đo chất lượng tìm kiếm (scripts/eval_search.py): chấm điểm, chế độ đo bật / tắt đúng bước của hàm tìm thật,
nhập CSV, kiểm bộ ca, so sánh hai lần đo. Kho nhỏ + embedding giả (tests/test_semantic_search.py), Qdrant giả
(tests/test_doc_vectors.py) — không cần Ollama / Qdrant / reranker thật."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest
from bson import ObjectId

from app.kb import doc_vectors as dv
from app.kb import embeddings, rerank
from app.kb import routes as kb
from app.spaces import personal_space
from tests.conftest import make_user
from tests.test_doc_vectors import FakeQdrant, add_doc
from tests.test_semantic_search import fake_embed, new_card

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("eval_search", ROOT / "scripts" / "eval_search.py")
ev = importlib.util.module_from_spec(_spec)
sys.modules["eval_search"] = ev   # dataclass cần module có trong sys.modules
_spec.loader.exec_module(ev)


@pytest.fixture
def semantic_on(monkeypatch):
    monkeypatch.setattr(embeddings, "ENABLED", True)
    monkeypatch.setattr(embeddings, "MODE", "sync")
    monkeypatch.setattr(embeddings, "ready", lambda: True)
    monkeypatch.setattr(embeddings, "_down_until", 0.0)
    monkeypatch.setattr(embeddings.local_ai, "embed", fake_embed)
    monkeypatch.setattr(kb, "_corpus", None)
    embeddings._cache.clear()
    embeddings._queries.clear()


@pytest.fixture
def kho(client, semantic_on):
    """Người dùng + 3 thẻ: dầu (khớp nghĩa "nhớt"), khiếu nại, thẻ context bộ nhớ AI."""
    user = make_user("a")
    client.login(user)
    ids = {"dau": new_card(client, "Chu kỳ thay dầu động cơ", "Dầu tổng hợp thay sau 10.000 km."),
           "kn": new_card(client, "Quy trình xử lý khiếu nại", "Phản hồi khách trong 24 giờ."),
           "mem": new_card(client, "Phân loại VCwiki v2 — quyết định 26/09/2026", "Dầu nhớt, khiếu nại: bảy khối.",
                           type="context")}
    embeddings.MODE = "off"   # như script: không tính embedding nền trong lúc đo
    return user, ids


def case(q, exp, kind="dien-dat-khac", target="cards", **kw):
    return {"id": kw.pop("id", q[:10]), "query": q, "target": target, "kind": kind, "source": "ai_seed",
            "split": kw.pop("split", "dev"), "filters": kw.pop("filters", {}),
            "expected": [{"id": i, "grade": g} for i, g in exp]} | kw


# ---------------------------------------------------------------------------
# Chấm điểm
# ---------------------------------------------------------------------------

def test_score_graded_metrics():
    c = case("q", [("a", 2), ("b", 1), ("z", 0)])
    m = ev.score(c, [{"id": x, "type": "lesson", "status": "draft", "title": x} for x in ["z", "b", "x", "a"]])
    assert m["r5"] == 1.0 and m["r10"] == 1.0
    assert m["mrr"] == pytest.approx(1 / 4)                 # MRR theo đích grade 2
    assert 0 < m["ndcg"] < 1
    assert m["p5_on"] == 1 and m["off10"] == 1 and m["unjudged5"] == ["x"] and m["outside"] == 2
    none = ev.score(case("q", [], kind="khong-co-dap-an"), [])
    assert none["empty"] and "r5" not in none
    s = ev.summarize([{"kind": "dien-dat-khac", "m": m, "ms": 10.0}, {"kind": "khong-co-dap-an", "m": none, "ms": 30.0}])
    assert s["none_answered"] == "0/1" and s["top5_on_target"] == "1/5" and s["p95_ms"] == 30.0


def test_memory_and_watch_card_counted():
    hits = [{"id": "m", "type": "context", "status": "draft", "title": "Phân loại VCwiki v2 — quyết định"},
            {"id": "r", "type": "lesson", "status": "rejected", "title": "x"}]
    m = ev.score(case("q", [("a", 2)]), hits)
    assert m["mem5"] == 1 and m["watch5"] and m["rejected5"] == 1


# ---------------------------------------------------------------------------
# Chế độ đo gọi đúng hàm tìm thật, bật / tắt đúng bước
# ---------------------------------------------------------------------------

def test_card_modes_toggle_real_search_steps(kho, monkeypatch):
    user, ids = kho
    c = case("bao lâu đổi nhớt", [(ids["dau"], 2)])
    kw = case("khiếu nại", [(ids["kn"], 2)])
    run = lambda name, cs: {r["id"]: r for r in ev.run_mode(ev.MODES[name], cs, user)}   # noqa: E731

    text = run("cards-text", [c, kw])
    assert text[c["id"]]["m"]["empty"]                                     # chỉ chữ: không chung chữ -> rỗng
    assert [h["id"] for h in text[kw["id"]]["top"]] == [ids["mem"], ids["kn"]]   # chỉ chữ: xếp theo updated_at
    sem = run("cards-semantic", [c, kw])
    assert sem[c["id"]]["top"][0]["id"] == ids["dau"] and sem[c["id"]]["top"][0]["match"] == "semantic"
    assert all(h["match"] == "semantic" for r in sem.values() for h in r["top"])   # nhánh chữ tắt khi đo
    hyb = run("cards-hybrid", [kw])
    assert hyb[kw["id"]]["top"][0]["match"] in ("text", "both") and hyb[kw["id"]]["top"][0]["rerank_score"] is None

    monkeypatch.setattr(rerank, "score", lambda q, texts: [0.9 if "Phân loại" in t else 0.1 for t in texts])
    cur = run("cards-hybrid-rerank", [kw])
    assert cur[kw["id"]]["top"][0]["id"] == ids["mem"]                     # reranker (giả) đẩy thẻ context lên đầu
    assert cur[kw["id"]]["m"]["mem5"] == 1 and cur[kw["id"]]["m"]["watch5"]
    assert embeddings.store.count_documents({}) == 3                       # đo không ghi thêm embedding
    assert embeddings.ENABLED and rerank.ENABLED is False                  # chế độ trả lại cờ sau khi chạy


def test_mode_ready_reports_missing_dependencies(monkeypatch):
    monkeypatch.setattr(embeddings, "ENABLED", True)
    monkeypatch.setattr(embeddings, "ready", lambda: False)
    assert "embedding" in ev.mode_ready(ev.MODES["cards-hybrid"])
    assert ev.mode_ready(ev.MODES["cards-text"]) is None
    assert "embedding" in ev.mode_ready(ev.MODES["cards-hybrid-v2"])
    monkeypatch.setattr(embeddings, "ready", lambda: True)
    assert "reranker" in ev.mode_ready(ev.MODES["cards-hybrid-rerank"])   # conftest tắt reranker


def test_document_modes_send_right_branches_to_qdrant(semantic_on, monkeypatch):
    fake = FakeQdrant()
    monkeypatch.setattr(dv, "_q", fake)
    monkeypatch.setattr(dv, "up", lambda fresh=False: True)
    monkeypatch.setattr(dv, "ENABLED", True)
    monkeypatch.setattr(dv, "HYBRID", True)
    monkeypatch.setattr(dv, "_sparse", None)
    monkeypatch.setattr(dv.local_ai, "embed", fake_embed)
    user = make_user("a")
    oil = add_doc(personal_space(user), "Bảo dưỡng", "Nhớt tổng hợp dùng được lâu hơn nhớt khoáng.")
    add_doc(personal_space(user), "Khách hàng", "Xử lý phàn nàn của khách trong 24 giờ.")
    dv.index_documents(list(dv.documents.find({})))
    sent = []
    orig = fake.__call__
    monkeypatch.setattr(dv, "_q", lambda m, p, b=None, ok404=False: (sent.append(b), orig(m, p, b, ok404))[1])

    def branches(name):
        sent.clear()
        rows = ev.run_mode(ev.MODES[name], [case("đổi dầu nhớt", [(str(oil["_id"]), 2)], target="documents")], user)
        return rows[0], sorted({b["using"] for b in sent if b and "using" in b})   # mỗi nhánh một truy vấn riêng

    row, used = branches("documents-dense")
    assert used == [dv.DENSE] and row["top"][0]["id"] == str(oil["_id"])
    assert branches("documents-lexical")[1] == [dv.SPARSE]
    assert branches("documents-hybrid")[1] == [dv.DENSE, dv.SPARSE]


# ---------------------------------------------------------------------------
# Vector thẻ thiếu: tính trong RAM, không ghi DB
# ---------------------------------------------------------------------------

def test_fill_missing_vectors_in_memory_only(kho, tmp_path, monkeypatch):
    user, ids = kho
    embeddings.store.delete_one({"_id": ObjectId(ids["dau"])})
    embeddings._cache.clear()
    assert ev.index_health()["cards"]["missing_embedding"] == 1
    got = ev.fill_missing_vectors(tmp_path / "v.npz")
    assert got["need"] == 1 and got["embedded"] == 1 and (tmp_path / "v.npz").exists()
    assert embeddings.store.count_documents({}) == 2                       # không ghi card_embeddings
    res = kb.list_cards(None, "bao lâu đổi nhớt", None, None, None, None, None, None, None, None, 1, 20, user)
    assert res["items"][0]["id"] == ids["dau"]
    embeddings._cache.clear()
    monkeypatch.setattr(embeddings.local_ai, "embed", lambda *a, **k: pytest.fail("phải lấy từ bộ đệm file"))
    assert ev.fill_missing_vectors(tmp_path / "v.npz")["from_file"] == 1


# ---------------------------------------------------------------------------
# Nhập CSV, kiểm bộ ca, so sánh
# ---------------------------------------------------------------------------

def test_import_csv_resolves_titles_and_duplicates(kho, tmp_path):
    user, ids = kho
    dup = new_card_raw(user, "Xử lý khiếu nại bản trùng", status="rejected", fields={"duplicate_of": ids["kn"]})
    golden = tmp_path / "g.json"
    golden.write_text(json.dumps({"description": "", "cases": []}))
    src = tmp_path / "a.csv"
    src.write_text("id,query,target,kind,source,split,filters,expected_2,expected_1,expected_0,note\n"
                   "n1,khách phàn nàn thì làm gì,cards,dien-dat-khac,,,,\"Quy trình xử lý khiếu nại\",\"chu ky thay dau\","
                   ",hỏi thật\n"
                   f"n2,khiếu nại,cards,tu-khoa-ngan,,,type=lesson,\"{dup}\",\"Không có thẻ này\",,\n", encoding="utf-8")
    res = ev.import_csv(src, golden)
    assert res["added"] == ["n1", "n2"]
    assert any("Không có thẻ này" in p and "không khớp" in p for p in res["problems"])
    cases = {c["id"]: c for c in json.loads(golden.read_text())["cases"]}
    idg = lambda c: [(e["id"], e["grade"]) for e in cases[c]["expected"]]   # noqa: E731
    assert idg("n1") == [(ids["kn"], 2), (ids["dau"], 1)]
    assert cases["n1"]["expected"][0]["title"] == "Quy trình xử lý khiếu nại"
    assert cases["n1"]["source"] == "nhan_vien" and cases["n1"]["split"] == "dev"
    assert idg("n2") == [(ids["kn"], 2)]                                  # thẻ bị loại vì trùng -> thẻ giữ lại
    assert cases["n2"]["filters"] == {"type": "lesson"} and cases["n2"]["split"] == "dev"
    assert "CHƯA ĐỦ NHÃN" in cases["n2"]["note"] and "CHƯA ĐỦ NHÃN" not in cases["n1"]["note"]
    ev.import_csv(src, golden)                                            # nhập lại: thay, không nhân đôi
    assert len(json.loads(golden.read_text())["cases"]) == 2


def new_card_raw(user, title, **extra) -> str:
    from app.kb.pipeline import card_search_text
    doc = {"_id": ObjectId(), "space_id": personal_space(user)["_id"], "type": "lesson", "title": title, "body": "",
           "status": "draft", "tags": [], "categories": [], "created_by": user["_id"], "created_at": None,
           "updated_at": None} | extra
    doc["search_text"] = card_search_text(doc)
    kb.cards.insert_one(doc)
    return str(doc["_id"])


def test_check_golden_flags_problems(kho):
    user, ids = kho
    data = {"cases": [
        case("chu kỳ thay dầu động cơ", [(ids["dau"], 2)], id="copy"),
        case("thay dầu", [(ids["dau"], 2)], kind="tu-khoa-ngan", id="kw"),                 # từ khoá: miễn cảnh báo
        case("x", [(str(ObjectId()), 2)], id="missing"),
        case("x", [(ids["dau"], 2)], kind="ghep-dieu-kien", filters={"type": "context"}, id="filter"),
        case("x", [(ids["dau"], 2)], kind="khong-co-dap-an", id="none")]}
    res = ev.check_golden(data, user)
    assert len(res["copy"]) == 1 and res["copy"][0].startswith("copy:")
    errs = " ".join(res["errors"])
    assert "missing: id đích không tồn tại" in errs and "filter: thẻ đích không thoả" in errs
    assert "none: khong-co-dap-an" in errs


def test_compare_prints_deltas(tmp_path):
    def rep(v):
        s = {"R@5": v, "R@10": v, "MRR@10": v, "nDCG@10": v, "empty_rate": 0.0, "p50_ms": 5.0, "p95_ms": 9.0,
             "top5_on_target": "1/5", "none_answered": "0/1"}
        return {"modes": {"cards-hybrid": {"summary": s, "groups": {"kind": {"tinh-che": s}}}}}
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    a.write_text(json.dumps(rep(0.5)))
    b.write_text(json.dumps(rep(0.75)))
    out = ev.compare(a, b)
    assert "0.5 → 0.75 (+0.25)" in out and "cards-hybrid · tinh-che" in out


def test_golden_file_meets_acceptance_counts():
    """Bộ ca thật: ≥ 80 ca (thẻ ≥ 60, tầng thô ≥ 20), mỗi kind ≥ 10 (khong-co-dap-an ≥ 5), đủ dev / test, đủ 7 khối,
    không chép tiêu đề (tiêu đề lưu kèm trong expected)."""
    data = ev.load_golden()
    cases = data["cases"]
    by_target = {t: [c for c in cases if c["target"] == t] for t in ev.TARGETS}
    assert len(cases) >= 80 and len(by_target["cards"]) >= 60 and len(by_target["documents"]) >= 20
    for kind in ev.KINDS:
        n = sum(c["kind"] == kind for c in cases)
        assert n >= (5 if kind == "khong-co-dap-an" else 10), kind
        splits = {c["split"] for c in cases if c["kind"] == kind}
        assert splits == {"dev", "test"}, kind
    assert {c.get("block") for c in cases} >= set(ev.BLOCKS)
    assert len({c["id"] for c in cases}) == len(cases)
    for c in cases:
        assert c["source"] in ev.SOURCES and c["split"] in ev.SPLITS
        if c["kind"] in ev.COPY_EXEMPT:
            continue
        for e in c["expected"]:
            if e["grade"] == 2 and e.get("title"):
                assert ev.copy_ratio(c["query"], e["title"]) < ev.COPY_WARN, (c["id"], e["title"])


def test_recommend_skips_error_rows_and_prefers_default_on_tie():
    def row(mn, mg, dev, err=0):
        s = {"nDCG@10": dev, "errors": err}
        return {"SEARCH_SEMANTIC_MIN": mn, "SEARCH_SEMANTIC_MARGIN": mg, "dev": s, "test": dict(s)}
    grid = [row(0.44, 1.0, 0.9, err=3), row(0.48, 0.10, 0.7), row(0.52, 0.10, 0.7), row(0.60, 0.10, 0.5)]
    rec = ev.recommend({"cards-semantic": grid})["cards-semantic"]
    assert rec["params"] == {"SEARCH_SEMANTIC_MIN": 0.52, "SEARCH_SEMANTIC_MARGIN": 0.10}   # dòng lỗi bị bỏ, hoà -> mặc định
    assert rec["default"] == rec["params"]
