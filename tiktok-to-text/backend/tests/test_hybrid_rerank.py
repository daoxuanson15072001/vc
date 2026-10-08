"""Tìm hybrid thẻ VCWIKI: chữ chấm BM25 (kb/lexical.py) + nghĩa + reranker (kb/rerank.py, giả lập)."""

from __future__ import annotations

import pytest

from app.kb import embeddings, lexical, rerank
from app.kb import routes as kb
from tests.conftest import make_user
from tests.test_semantic_search import fake_embed, new_card, search


def test_terms_unaccented_with_bigrams():
    assert lexical.terms("Giữ chân Nhân viên") == ["giu", "chan", "nhan", "vien", "giu_chan", "chan_nhan", "nhan_vien"]
    sp = lexical.sparse("dầu dầu nhớt")
    assert len(sp["indices"]) == 4 and sp["indices"] == sorted(sp["indices"])
    assert lexical.sparse("!!!") == {"indices": [], "values": []}


def test_bm25_prefers_phrase_and_rare_words():
    corpus = lexical.Corpus(["nhân viên bán hàng", "giữ chân nhân viên giỏi", "chân dung khách hàng viên chức",
                             "nhân sự", "bán hàng online"])
    q = "giữ chân nhân viên"
    phrase = corpus.score(q, "Cách giữ chân nhân viên giỏi")
    scattered = corpus.score(q, "Chân dung nhân sự giữ chức viên chức")
    assert phrase > scattered > 0
    assert corpus.score(q, "không liên quan") == 0


@pytest.fixture
def hybrid_on(monkeypatch):
    monkeypatch.setattr(embeddings, "ENABLED", True)
    monkeypatch.setattr(embeddings, "MODE", "sync")
    monkeypatch.setattr(embeddings, "ready", lambda: True)
    monkeypatch.setattr(embeddings, "_down_until", 0.0)
    monkeypatch.setattr(embeddings.local_ai, "embed", fake_embed)
    monkeypatch.setattr(kb, "_corpus", None)
    embeddings._cache.clear()
    embeddings._queries.clear()


def test_text_hits_ranked_by_relevance_not_recency(client, hybrid_on):
    """Thẻ khớp cụm từ trong tiêu đề đứng trên thẻ mới sửa hơn chỉ chứa rải rác các chữ trong thân bài."""
    client.login(make_user("a"))
    good = new_card(client, "Giữ chân nhân viên giỏi", "Lộ trình phát triển rõ ràng.")
    new_card(client, "Phân loại kho tri thức", "Nhân sự phòng giữ tài liệu; chân trang ghi viên chức.")
    res = search(client, "giữ chân nhân viên")
    assert res["items"][0]["id"] == good
    assert res["items"][0]["rerank_score"] is None                  # reranker tắt trong test: giữ thứ tự hybrid


def test_rerank_reorders_head(client, hybrid_on, monkeypatch):
    client.login(make_user("a"))
    a = new_card(client, "Thay dầu xe con", "Dầu thay sau 5.000 km.")
    b = new_card(client, "Thay dầu xe tải", "Nhớt xe tải thay sau 8.000 km.")
    monkeypatch.setattr(rerank, "score", lambda q, texts: [0.95 if "xe tải" in t else 0.2 for t in texts])
    res = search(client, "đổi nhớt xe tải")
    assert [c["id"] for c in res["items"]][:2] == [b, a]
    assert res["items"][0]["rerank_score"] == 0.95 and res["items"][0]["match"] in ("semantic", "both")


def test_rerank_disabled_or_missing_model_returns_none(monkeypatch):
    monkeypatch.setattr(rerank, "ENABLED", True)
    monkeypatch.setattr(rerank, "MODEL", "khong-co/model-nay")
    monkeypatch.setattr(rerank, "_model", None)
    monkeypatch.setattr(rerank, "_down_until", 0.0)
    assert rerank.score("câu hỏi", ["văn bản"], timeout=None) is None   # nạp (import torch) có thể quá 2,5 giây
    assert rerank._down_until > 0                                   # lỗi thì nghỉ, không thử nạp lại mỗi lượt


def test_reranked_flag_and_min_score(client, hybrid_on, monkeypatch):
    """Kết quả báo reranked; thẻ đã rerank dưới RERANK_MIN bị bỏ; reranker không chạy -> reranked=false, giữ thẻ."""
    client.login(make_user("a"))
    a = new_card(client, "Thay dầu xe con", "Dầu thay sau 5.000 km.")
    b = new_card(client, "Thay dầu xe tải", "Nhớt xe tải thay sau 8.000 km.")
    off = search(client, "đổi nhớt xe tải")
    assert off["reranked"] is False and all(c["reranked"] is False for c in off["items"])
    monkeypatch.setattr(rerank, "score", lambda q, texts: [0.95 if "xe tải" in t else 0.01 for t in texts])
    monkeypatch.setattr(rerank, "MIN_SCORE", 0.05)
    on = search(client, "đổi nhớt xe tải")
    assert on["reranked"] is True and [c["id"] for c in on["items"]] == [b]
    assert a in [c["id"] for c in off["items"]]


def test_rerank_text_includes_when_to_use():
    card = {"title": "T", "summary": "S", "key_points": ["k1"], "when_to_use": "Khi khách hỏi hoá đơn", "body": "B"}
    assert kb.rerank_text(card) == "T\nS\nk1\nKhi khách hỏi hoá đơn\nB"


@pytest.fixture
def fake_model(monkeypatch):
    """Reranker "đã nạp" giả: _run chấm bằng hàm do test đặt (không cần torch)."""
    monkeypatch.setattr(rerank, "ENABLED", True)
    monkeypatch.setattr(rerank, "_down_until", 0.0)

    def install(fn):
        def run(q, texts):
            try:
                return fn(q, texts)
            finally:
                rerank._busy.release()
        monkeypatch.setattr(rerank, "_run", run)
    return install


def test_rerank_timeout_falls_back_fast(fake_model, monkeypatch):
    """GPU bận (Whisper): chấm quá RERANK_TIMEOUT_MS -> None trong ≤ timeout + 0,5 giây; lượt sau khi lượt dở còn
    chạy cũng không chờ quá timeout; chấm xong thì lại dùng được."""
    import threading
    import time as t
    gate = threading.Event()
    fake_model(lambda q, texts: (gate.wait(5), [0.5] * len(texts))[1])
    monkeypatch.setattr(rerank, "TIMEOUT", 0.3)
    t0 = t.monotonic()
    assert rerank.score("câu hỏi", ["a", "b"]) is None
    assert t.monotonic() - t0 < 0.3 + 0.5
    t0 = t.monotonic()
    assert rerank.score("câu hỏi", ["a"]) is None          # lượt trước còn giữ reranker
    assert t.monotonic() - t0 < 0.3 + 0.5
    gate.set()
    fake_model(lambda q, texts: [0.7] * len(texts))
    assert rerank.score("câu hỏi", ["a"], timeout=2) == [0.7]


def test_rerank_error_pauses(monkeypatch):
    """Lỗi lúc chấm -> None và nghỉ ERROR_PAUSE giây (không gọi model mỗi lượt)."""

    class Boom:
        def __call__(self, *a, **k):
            raise RuntimeError("MPS hết bộ nhớ")

    class Tok:
        def __call__(self, *a, **k):
            raise RuntimeError("MPS hết bộ nhớ")

    monkeypatch.setattr(rerank, "ENABLED", True)
    monkeypatch.setattr(rerank, "_down_until", 0.0)
    monkeypatch.setattr(rerank, "_model", (Tok(), Boom(), "cpu"))
    pytest.importorskip("torch")
    assert rerank.score("q", ["a"], timeout=5) is None
    assert rerank._down_until > __import__("time").time() + rerank.ERROR_PAUSE - 5
    assert rerank.score("q", ["a"], timeout=5) is None


def test_rerank_off_keeps_hybrid_order(client, hybrid_on, monkeypatch):
    """RERANK=0 / reranker lỗi / quá giờ: thứ tự và điểm y như bỏ hẳn bước rerank (không đổi hành vi khi tắt)."""
    client.login(make_user("a"))
    for i in range(4):
        new_card(client, f"Thay dầu xe {i}", "Nhớt thay định kỳ.")
    base = search(client, "thay dầu")
    for fn in (lambda q, texts: None, lambda q, texts, **k: None):
        monkeypatch.setattr(rerank, "score", fn)
        again = search(client, "thay dầu")
        assert [(c["id"], c["match"], c["semantic_score"]) for c in again["items"]] == \
               [(c["id"], c["match"], c["semantic_score"]) for c in base["items"]]
        assert again["reranked"] is False
