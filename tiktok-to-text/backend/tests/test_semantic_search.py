"""Tìm thẻ theo nghĩa (kb/embeddings.py): embedding giả lập, không cần Ollama.

Embedding giả: mỗi nhóm từ cùng nghĩa là một chiều — "dầu / nhớt" (chiều 0), "khiếu nại / phàn nàn" (chiều 1);
câu không thuộc nhóm nào có một chiều riêng theo nội dung (không giống câu nào khác)."""

from __future__ import annotations

import json
import zlib
from types import SimpleNamespace

import httpx
import pytest
from bson import ObjectId

from app import auth, db, mcp_server
from app.kb import embeddings
from app.kb.pipeline import card_search_text, cards
from app.spaces import personal_space
from tests.conftest import make_user

GROUPS = [("dầu", "nhớt"), ("khiếu nại", "phàn nàn")]
calls: list[list[str]] = []


def fake_embed(texts, timeout=None):
    calls.append(list(texts))
    out = []
    for t in texts:
        t = t.lower()
        vec = [float(sum(t.count(w) for w in g)) for g in GROUPS]
        own = [0.0] * 64
        if not any(vec):
            own[zlib.crc32(t.encode()) % 64] = 1.0
        out.append(vec + own)
    return out


@pytest.fixture(autouse=True)
def semantic_on(monkeypatch):
    monkeypatch.setattr(embeddings, "ENABLED", True)
    monkeypatch.setattr(embeddings, "MODE", "sync")
    monkeypatch.setattr(embeddings, "ready", lambda: True)
    monkeypatch.setattr(embeddings, "_down_until", 0.0)
    monkeypatch.setattr(embeddings.local_ai, "embed", fake_embed)
    embeddings._cache.clear()
    embeddings._queries.clear()
    calls.clear()


def new_card(client, title: str, body: str = "", **extra) -> str:
    r = client.post("/api/wiki/cards", json={"type": "lesson", "title": title, "body": body} | extra)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def search(client, q: str) -> dict:
    r = client.get("/api/wiki/cards", params={"q": q})
    assert r.status_code == 200, r.text
    return r.json()


def test_semantic_match_without_shared_words(client):
    """Câu hỏi không chung chữ nào với thẻ vẫn tìm ra thẻ cùng nghĩa; thẻ khác nghĩa không lọt vào."""
    a = make_user("a")
    client.login(a)
    oil = new_card(client, "Chu kỳ thay dầu động cơ", "Dầu tổng hợp thay sau 10.000 km.")
    new_card(client, "Quy trình xử lý khiếu nại", "Phản hồi khách trong 24 giờ.")
    assert embeddings.store.count_documents({}) == 2                 # embedding tính ngay khi tạo thẻ
    res = search(client, "bao lâu đổi nhớt")
    assert res["semantic"] is True
    assert [(c["id"], c["match"]) for c in res["items"]] == [(oil, "semantic")]
    assert res["items"][0]["semantic_score"] == pytest.approx(1.0)
    assert res["total"] == 1


def test_keyword_hits_rank_first_and_marked_both(client):
    a = make_user("a")
    client.login(a)
    complaint = new_card(client, "Xử lý khiếu nại", "Ghi nhận phàn nàn của khách.")
    text_only = new_card(client, "Mẫu biên bản", "Biên bản khiếu nại mẫu số 3.")        # chữ khớp, nghĩa gần
    other = new_card(client, "Giờ làm việc", "Từ 8 giờ tới 17 giờ.")
    res = search(client, "khiếu nại")
    got = {c["id"]: c["match"] for c in res["items"]}
    assert got == {complaint: "both", text_only: "both"}
    assert other not in got
    res = search(client, "biên bản")                                     # chỉ khớp chữ
    assert [(c["id"], c["match"]) for c in res["items"]] == [(text_only, "text")]


def test_permissions_respected(client):
    """Thẻ kho cá nhân người khác không hiện dù rất gần nghĩa — cả web lẫn MCP search_cards."""
    a, b = make_user("a"), make_user("b")
    client.login(b)
    hidden = new_card(client, "Nhớt cho xe tải", "Đổi dầu mỗi 8.000 km.")
    client.login(a)
    mine = new_card(client, "Dầu hộp số", "Kiểm tra dầu hộp số.")
    res = search(client, "nhớt")
    ids = [c["id"] for c in res["items"]]
    assert mine in ids and hidden not in ids
    token, _ = auth.issue_api_token(a, "test")
    ctx = SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "claude-code/test"})
    out = json.loads(mcp_server.search_cards(ctx, query="nhớt"))
    assert [(c["id"], c["match"]) for c in out["items"]] == [(mine, "semantic")]


def test_fallback_when_local_ai_down(client, monkeypatch):
    """AI local không sẵn sàng / embedding lỗi: ghi thẻ vẫn chạy, chỉ còn nhánh chữ (semantic=false, match=text)."""
    a = make_user("a")
    client.login(a)

    def broken(_texts, timeout=None):
        raise httpx.ConnectError("tắt Ollama")

    monkeypatch.setattr(embeddings.local_ai, "embed", broken)
    oil = new_card(client, "Chu kỳ thay dầu", "Dầu tổng hợp.")                      # không hỏng vì embedding lỗi
    assert embeddings.store.count_documents({}) == 0
    res = search(client, "thay dầu")
    assert res["semantic"] is False and [c["id"] for c in res["items"]] == [oil]
    assert res["items"][0]["match"] == "text" and res["items"][0]["text_score"] > 0
    assert search(client, "nhớt")["items"] == []                                   # không chung chữ: không thấy
    monkeypatch.setattr(embeddings.local_ai, "embed", fake_embed)
    assert not search(client, "nhớt")["semantic"]                               # lỗi vừa rồi: tạm nghỉ 60 giây
    monkeypatch.setattr(embeddings, "_down_until", 0.0)
    monkeypatch.setattr(embeddings, "ready", lambda: False)
    assert not search(client, "nhớt")["semantic"]
    monkeypatch.setattr(embeddings, "ENABLED", False)
    monkeypatch.setattr(embeddings, "ready", lambda: True)
    assert not search(client, "nhớt")["semantic"]


def test_embedding_refreshed_on_update(client):
    a = make_user("a")
    client.login(a)
    cid = new_card(client, "Ghi chú", "Chu kỳ đổi dầu động cơ.")
    before = embeddings.store.find_one({"_id": ObjectId(cid)})
    assert [c["id"] for c in search(client, "nhớt")["items"]] == [cid]
    r = client.patch(f"/api/wiki/cards/{cid}", json={"body": "Cách xử lý khách phàn nàn."})
    assert r.status_code == 200, r.text
    after = embeddings.store.find_one({"_id": ObjectId(cid)})
    assert after["hash"] != before["hash"] and after["marker"] != before["marker"]
    assert search(client, "nhớt")["items"] == []
    assert [c["id"] for c in search(client, "khiếu nại")["items"]] == [cid]
    n = sum(len(c) for c in calls)
    client.patch(f"/api/wiki/cards/{cid}", json={"tags": ["cskh"]})                # nội dung embed không đổi
    assert sum(len(c) for c in calls) == n
    assert client.delete(f"/api/wiki/cards/{cid}").status_code == 204
    assert embeddings.store.count_documents({}) == 0


def test_missing_embeddings_filled_by_search_and_refresh(client):
    """Thẻ ghi ngoài luồng (vd script cũ) chưa có embedding: lượt tìm xếp lịch tính, lượt sau thấy; refresh
    (script chạy bù) không tính lại thẻ đã có."""
    a = make_user("a")
    client.login(a)
    doc = {"space_id": personal_space(a)["_id"], "title": "Nhớt máy", "summary": "", "body": "", "key_points": [],
           "tags": [], "categories": [], "status": "draft", "type": "lesson", "created_by": a["_id"],
           "created_at": db.now(), "updated_at": db.now()}
    doc["search_text"] = card_search_text(doc)
    cid = cards.insert_one(doc).inserted_id
    assert search(client, "dầu")["items"] == []
    assert [c["id"] for c in search(client, "dầu")["items"]] == [str(cid)]
    assert embeddings.refresh([cid]) == {"embedded": 0, "unchanged": 1, "missing": 0}
    assert embeddings.refresh([cid], force=True)["embedded"] == 1


def test_fuse_prefers_keyword_hits():
    t, s1, s2 = ObjectId(), ObjectId(), ObjectId()
    fused = embeddings.fuse([t, s1], [(s2, 0.9), (s1, 0.8)])
    assert [(c, m) for c, m, _ in fused] == [(s1, "both"), (t, "text"), (s2, "semantic")]


def test_pure_python_math(monkeypatch):
    monkeypatch.setattr(embeddings, "np", None)
    v = embeddings._unpack(embeddings._pack([3.0, 4.0]))
    assert v == pytest.approx([0.6, 0.8]) and embeddings._dot(v, v) == pytest.approx(1.0)
