"""Xếp hạng tìm thẻ v2 (kb/card_search.py, kb/lexical.py — yêu cầu 6ab85363…e539): tách từ, BM25F nhiều trường,
thứ hạng không phụ thuộc updated_at, RRF có trọng số, thẻ bộ nhớ AI ra khỏi tìm mặc định."""

from __future__ import annotations

import json
from datetime import timedelta
from types import SimpleNamespace

import pytest
from bson import ObjectId

from app import auth, db, mcp_server
from app.kb import card_search, embeddings, lexical
from app.kb.pipeline import cards
from tests.conftest import make_user
from tests.test_semantic_search import fake_embed, new_card, search


def test_tokens_codes_stopwords_bigrams():
    t = lexical.tokens("Nghị định 123/2020/NĐ-CP và vấn đề ô tô, mã 04465-0K240")
    assert {"123/2020/nd-cp", "04465-0k240", "123", "2020", "nd", "cp", "04465", "0k240"} <= set(t)
    assert "va" not in t                                         # từ dừng: bỏ ở âm tiết đơn
    assert {"van_de", "o_to", "o", "to"} <= set(t)               # cặp âm tiết giữ; "ô" không phải từ dừng
    assert lexical.tokens("Giữ chân") == lexical.tokens("giu CHAN")


def _index(docs: dict[str, dict]) -> lexical.FieldIndex:
    idx = lexical.FieldIndex(card_search.WEIGHTS, card_search.B, card_search.STRONG)
    return idx.build((k, 1, v) for k, v in docs.items())


def _loader(docs):
    return lambda keys: [(k, 1, docs[k]) for k in keys]


def test_bm25f_field_weights_and_length_norm():
    filler = " ".join(f"chủ đề {i} khác hẳn" for i in range(3000))
    usual = "Nội dung vừa phải " * 40
    docs = {
        "title": {"title": "Giữ chân nhân viên giỏi", "body": "Lộ trình rõ ràng. " + usual},
        "body": {"title": "Văn hoá công ty", "body": "Muốn giữ chân nhân viên giỏi thì cần lộ trình. " + usual},
        "long": {"title": "Phân loại kho tri thức", "body": ("giữ chân nhân viên " * 20) + filler},
        "none": {"title": "Thay dầu xe", "body": "Nhớt tổng hợp."},
    } | {f"x{i}": {"title": f"Thẻ thường {i}", "summary": "Tóm tắt ngắn.", "body": usual}
         for i in range(30)}                                     # kho thật: thẻ dài bình thường vài trăm từ
    idx = _index(docs)
    hits = idx.search("giữ chân nhân viên", {k: 1 for k in docs}, _loader(docs))
    order = sorted(hits, key=lambda k: -hits[k][0])
    assert order[:2] == ["title", "body"]                        # tiêu đề > nội dung; thẻ rất dài không được lợi
    assert "none" not in hits
    assert hits["title"][1] == pytest.approx(1.0) and hits["body"][1] == 0.0   # phủ ở tiêu đề / tag / tóm tắt
    assert hits["body"][2] == pytest.approx(1.0)


def test_index_rereads_changed_docs():
    docs = {"a": {"title": "Thay dầu xe"}, "b": {"title": "Khiếu nại khách"}}
    idx = _index(docs)
    docs["b"] = {"title": "Thay dầu xe tải"}
    hits = idx.search("dầu xe tải", {"a": 1, "b": 2}, _loader(docs))   # marker b đổi -> đọc lại
    assert max(hits, key=lambda k: hits[k][0]) == "b" and "b" in idx.delta
    docs["a"] = {"title": "Không còn chữ khớp"}
    idx.invalidate(["a"])                                               # đổi mà marker giữ nguyên
    assert "a" not in idx.search("dầu", {"a": 1, "b": 2}, _loader(docs))


def _age(card_id: str, days: int) -> None:
    cards.update_one({"_id": ObjectId(card_id)}, {"$set": {"updated_at": db.now() - timedelta(days=days)}})


@pytest.mark.parametrize("semantic", [False, True])
def test_rank_does_not_depend_on_updated_at(client, monkeypatch, semantic):
    if semantic:
        monkeypatch.setattr(embeddings, "ENABLED", True)
        monkeypatch.setattr(embeddings, "MODE", "sync")
        monkeypatch.setattr(embeddings, "ready", lambda: True)
        monkeypatch.setattr(embeddings, "_down_until", 0.0)
        monkeypatch.setattr(embeddings.local_ai, "embed", fake_embed)
        embeddings._cache.clear()
        embeddings._queries.clear()
    client.login(make_user("a"))
    good = new_card(client, "Giữ chân nhân viên giỏi", "Lộ trình phát triển rõ ràng.")
    mid = new_card(client, "Văn hoá công ty", "Muốn giữ chân nhân viên thì cần lộ trình.")
    weak = new_card(client, "Phân loại kho", "Nhân viên phòng giữ tài liệu.")
    before = [c["id"] for c in search(client, "giữ chân nhân viên")["items"]]
    assert before[0] == good
    _age(good, 400)                       # thẻ khớp nhất thành cũ nhất, thẻ kém nhất mới sửa
    _age(mid, 200)
    cards.update_one({"_id": ObjectId(weak)}, {"$set": {"updated_at": db.now() + timedelta(days=1)}})
    assert [c["id"] for c in search(client, "giữ chân nhân viên")["items"]] == before


def test_text_only_mode_matches_without_every_word(client):
    """SEARCH_SEMANTIC=0 / AI local tắt: không còn bắt buộc đủ mọi từ; xếp theo độ khớp; có text_score."""
    client.login(make_user("a"))
    good = new_card(client, "Giữ chân nhân viên giỏi", "Lộ trình phát triển rõ ràng.")
    new_card(client, "Thay dầu xe tải", "Nhớt xe tải.")
    for i in range(6):                    # "cách", "lâu dài" là từ thường gặp trong kho (idf thấp)
        new_card(client, f"Cách làm việc lâu dài {i}", "Ghi chép hằng ngày.")
    res = search(client, "cách giữ chân nhân viên giỏi lâu dài")
    assert res["semantic"] is False
    assert [c["id"] for c in res["items"]] == [good]
    assert res["items"][0]["match"] == "text" and res["items"][0]["text_score"] > 0


def test_long_query_semantic_first_text_only_after(client, monkeypatch):
    """Câu dài: thẻ chỉ khớp chữ (dù khớp tiêu đề) đứng sau thẻ gần nghĩa."""
    monkeypatch.setattr(embeddings, "ENABLED", True)
    monkeypatch.setattr(embeddings, "MODE", "sync")
    monkeypatch.setattr(embeddings, "ready", lambda: True)
    monkeypatch.setattr(embeddings, "_down_until", 0.0)
    monkeypatch.setattr(embeddings.local_ai, "embed", fake_embed)
    embeddings._cache.clear()
    embeddings._queries.clear()
    client.login(make_user("a"))
    oil = new_card(client, "Chu kỳ thay dầu động cơ", "Dầu tổng hợp thay sau 10.000 km.")
    bike = new_card(client, "Khi nào cần mua xe máy tay ga", "Chọn xe theo nhu cầu đi lại.")
    res = search(client, "khi nào cần mua nhớt cho xe máy tay ga")
    assert [(c["id"], c["match"]) for c in res["items"]] == [(oil, "semantic"), (bike, "text")]
    assert res["items"][0]["semantic_score"] == pytest.approx(1.0) and res["items"][1]["text_score"] > 0


def test_ai_memory_cards_left_out_of_default_search(client):
    admin = make_user("m", role="admin")
    client.login(admin)
    token, _ = auth.issue_api_token(admin, "test")
    ctx = SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "claude-code/test"})
    mem = json.loads(mcp_server.save_memory(ctx, "context", "Phân loại VCwiki v2 — giữ chân nhân viên",
                                            "Quy tắc giữ chân nhân viên, phân loại thẻ."))["id"]
    card = new_card(client, "Giữ chân nhân viên giỏi", "Lộ trình phát triển.")
    assert [c["id"] for c in search(client, "giữ chân nhân viên")["items"]] == [card]
    r = client.get("/api/wiki/cards", params={"q": "giữ chân nhân viên", "include_ai_memory": "true"})
    assert {c["id"] for c in r.json()["items"]} == {card, mem}
    r = client.get("/api/wiki/cards", params={"q": "giữ chân nhân viên", "type": "context"})
    assert [c["id"] for c in r.json()["items"]] == [mem]
    assert {c["id"] for c in client.get("/api/wiki/cards").json()["items"]} == {card, mem}   # duyệt không q: vẫn hiện
    out = json.loads(mcp_server.search_cards(ctx, query="giữ chân nhân viên"))
    assert [c["id"] for c in out["items"]] == [card] and out["items"][0]["text_score"] > 0
    out = json.loads(mcp_server.search_cards(ctx, query="giữ chân nhân viên", include_ai_memory=True))
    assert {c["id"] for c in out["items"]} == {card, mem}
    assert json.loads(mcp_server.recall_memory(ctx, query="giữ chân"))["items"][0]["id"] == mem


def test_ranking_v1_still_available(client, monkeypatch):
    """SEARCH_RANKING=v1: đường lui về cách xếp cũ (regex đủ mọi từ, theo updated_at khi chỉ tìm chữ)."""
    monkeypatch.setattr(card_search, "RANKING", "v1")
    client.login(make_user("a"))
    new_card(client, "Giữ chân nhân viên giỏi", "Lộ trình.")
    assert search(client, "cách giữ chân nhân viên")["items"] == []
    assert len(search(client, "giữ chân nhân viên")["items"]) == 1


def test_rerank_head_keeps_long_query_tail_below():
    fused = [("a", "both", 0.6, 3.0), ("b", "semantic", 0.55, None), ("c", "text", None, 9.0), ("d", "text", None, 8.0)]
    assert card_search.rerank_head("khi nào cần đổi nhớt cho xe máy tay ga", fused) == 2   # câu dài: bỏ đuôi chỉ-chữ
    assert card_search.rerank_head("đổi nhớt", fused) == card_search.RERANK_HEAD
    assert card_search.rerank_head("khi nào cần đổi nhớt cho xe máy", [("c", "text", None, 1.0)]) == 0
