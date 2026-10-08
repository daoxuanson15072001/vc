"""Đề xuất dọn hàng chờ (kb/queue_cleanup.py): Qdrant giả + embedding giả (tests/test_doc_vectors.py)."""

from __future__ import annotations

import pytest

from app.kb import embeddings, queue_cleanup as qc
from app.kb import doc_vectors as dv
from app.kb.pipeline import cards
from app.spaces import personal_space
from tests.conftest import make_user
from tests.test_doc_vectors import add_doc, fake_stack  # noqa: F401 — fixture Qdrant giả + embedding giả


@pytest.fixture
def space():
    return personal_space(make_user("a"))


def add_card(space, title: str, body: str):
    cid = cards.insert_one({"title": title, "body": body, "summary": "", "key_points": [], "space_id": space["_id"],
                            "type": "lesson", "status": "draft"}).inserted_id
    embeddings.refresh([cid])
    return cid


def test_suggest_covered_duplicate_and_keep(space, monkeypatch):
    monkeypatch.setattr(qc, "COVER_SIM", 0.9)
    card = add_card(space, "Thay dầu", "Dầu nhớt thay định kỳ.")
    covered = add_doc(space, "Video dầu", "Dầu nhớt. " * 10)                      # cùng chiều "dầu / nhớt" với thẻ
    done = add_doc(space, "Khiếu nại gốc", "Khách phàn nàn về khiếu nại.", status="done")
    dup = add_doc(space, "Khiếu nại đăng lại", "Khiếu nại phàn nàn của khách.")   # cùng chiều với bản đã tinh chế
    keep = add_doc(space, "Chủ đề mới", "Một chủ đề hoàn toàn khác biệt.")
    busy = add_doc(space, "Đang tổng hợp", "Dầu nhớt.", status="grouping")
    dv.index_documents([covered, done, dup, keep, busy])

    rows = {r["document_id"]: r for r in qc.suggest()}
    assert str(busy["_id"]) not in rows and str(done["_id"]) not in rows          # chỉ hàng chờ skipped/pending/error
    assert rows[str(covered["_id"])]["action"] == "da_co"
    assert rows[str(covered["_id"])]["coverage"]["cards"][0]["id"] == str(card)
    assert rows[str(dup["_id"])]["action"] == "trung"
    assert rows[str(dup["_id"])]["duplicate"]["id"] == str(done["_id"])
    assert rows[str(keep["_id"])]["action"] == "giu"
    assert dv.documents.count_documents({"wiki_status": "done"}) == 1              # suggest không ghi gì

    res = qc.apply([covered["_id"], busy["_id"]], rows)
    assert res == {"done": 1, "skipped": 1}                                         # tài liệu AI đang giữ: bỏ qua
    d = dv.documents.find_one({"_id": covered["_id"]})
    assert d["wiki_status"] == "done" and d["summary"].startswith(f"[{qc.LABEL}]")
    assert d["refined_by"]["label"] == qc.LABEL


def test_duplicate_pair_in_queue_keeps_longer(space):
    short = add_doc(space, "Bản ngắn", "Khiếu nại phàn nàn.")
    long = add_doc(space, "Bản dài", "Khiếu nại phàn nàn khách hàng, bản đầy đủ hơn nhiều.")
    dv.index_documents([short, long])
    rows = {r["document_id"]: r for r in qc.suggest()}
    assert rows[str(short["_id"])]["action"] == "trung"
    assert rows[str(long["_id"])]["action"] == "giu"


def test_not_indexed_is_kept(space):
    d = add_doc(space, "Chưa nạp", "Dầu nhớt.")
    rows = qc.suggest()
    assert rows[0]["document_id"] == str(d["_id"]) and rows[0]["action"] == "giu"
    assert "chưa nạp" in rows[0]["reason"]


def test_calibrate_separates_own_cards(space):
    doc = add_doc(space, "Dầu", "Dầu nhớt thay định kỳ.", status="done")
    dv.documents.update_one({"_id": doc["_id"]}, {"$set": {"card_count": 1}})
    own = add_card(space, "Thay dầu", "Dầu nhớt.")
    cards.update_one({"_id": own}, {"$set": {"document_id": doc["_id"]}})
    add_card(space, "Khiếu nại", "Khách phàn nàn.")
    dv.index_documents([doc])
    res = qc.calibrate()
    assert res["chunks"] == 1 and res["own_cards"][50] > res["random_cards"][50]
