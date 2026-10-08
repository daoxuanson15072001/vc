"""Cập nhật thẻ VCWIKI khi nội dung tài liệu đổi (kb/card_update.py): gom 1 lần / ngày, nút Ưu tiên làm ngay;
thẻ đã duyệt -> đề xuất sửa chờ duyệt (không sửa thẳng), thẻ nháp AI dựng lại, không viết trùng thẻ đã có."""

from __future__ import annotations

from datetime import datetime

import pytest

from app import db
from app.kb import card_update, changes, embeddings, wiki
from app.kb.adapters.base import ExtractedDoc
from app.kb.pipeline import Pipeline, cards, documents, save_document, sources
from app.spaces import personal_space
from tests.conftest import make_user


@pytest.fixture
def env(monkeypatch):
    user = make_user("a")
    space = personal_space(user)
    sid = sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "video", "lane": "heavy",
                              "url": "https://www.tiktok.com/@kenh", "status": "extracted", "priority": 0,
                              "options": {"build_wiki": True}, "logs": [], "created_at": db.now()}).inserted_id
    src = sources.find_one({"_id": sid})
    save_document(src, ExtractedDoc(key="v1", title="Video 1", text="bản cũ"), True)
    doc = documents.find_one({"source_id": sid})
    documents.update_one({"_id": doc["_id"]}, {"$set": {"wiki_status": "done"}})
    approved = cards.insert_one({"space_id": space["_id"], "source_id": sid, "document_id": doc["_id"], "type": "lesson",
                                 "title": "Thẻ đã duyệt", "summary": "cũ", "body": "nội dung cũ", "key_points": [],
                                 "status": "approved", "origin": "ai", "created_by": user["_id"]}).inserted_id
    draft = cards.insert_one({"space_id": space["_id"], "source_id": sid, "document_id": doc["_id"], "type": "lesson",
                              "title": "Thẻ nháp", "body": "x", "status": "draft", "origin": "ai",
                              "created_by": user["_id"]}).inserted_id
    monkeypatch.setattr(embeddings, "schedule", lambda ids: None)
    return user, src, doc["_id"], approved, draft


def test_changed_text_waits_for_daily_run(env, client):
    user, src, did, _, _ = env
    save_document(src, ExtractedDoc(key="v1", title="Video 1", text="bản cũ"), True)   # chữ không đổi
    assert documents.find_one({"_id": did}).get("card_update") is None
    save_document(src, ExtractedDoc(key="v1", title="Video 1", text="bản mới"), True)
    d = documents.find_one({"_id": did})
    assert d["wiki_status"] == "done" and d["card_update"] == "waiting" and d["text"] == "bản mới"

    assert card_update.tick(datetime(2026, 9, 28, 1, 5)) == 0       # chưa tới giờ (mặc định 07:45, sau job vector đêm)
    assert card_update.tick(datetime(2026, 9, 28, 7, 50)) == 1
    assert documents.find_one({"_id": did})["wiki_status"] == "pending"
    save_document(src, ExtractedDoc(key="v1", title="Video 1", text="bản mới hơn"), True)
    documents.update_one({"_id": did}, {"$set": {"card_update": "waiting"}})
    assert card_update.tick(datetime(2026, 9, 28, 23, 0)) == 0      # mỗi ngày một lần
    client.login(user)                                                # nút Ưu tiên: làm ngay
    assert client.post(f"/api/kb/sources/{src['_id']}/priority", json={"top": True}).status_code == 200
    assert documents.find_one({"_id": did})["card_update"] == "queued"


def test_gio_mac_dinh_sau_job_vector_dem():
    # Nợ kỹ thuật #15: lượt cập nhật thẻ không chạy trùng khung job vector đêm (00:30 → STOP_AT 07:30, nightly_vectors.sh)
    import re
    from pathlib import Path
    stop = re.search(r'STOP_AT="\$\{STOP_AT:-(\d\d:\d\d)\}"', (Path(__file__).parents[2] / "nightly_vectors.sh").read_text()).group(1)
    assert card_update.AT == "07:45" and card_update.AT > stop


def test_update_proposes_for_approved_and_rebuilds_drafts(env, monkeypatch):
    user, src, did, approved, draft = env
    save_document(src, ExtractedDoc(key="v1", title="Video 1", text="bản mới"), True)
    card_update.release()
    seen = {}

    def fake_call(system, content, schema, **kw):
        seen["update"] = content
        return {"changed": True, "reason": "bản mới nói rõ hơn", "summary": "cũ", "body": "nội dung mới",
                "key_points": [], "when_to_use": "", "example": ""}

    def fake_build(doc, source, raw, existing=None):
        seen["existing"] = existing
        return {"cards": [], "doc_summary": "", "relevance": 5, "primary_category": None, "categories": [],
                "suggested_categories": [], "usage": {}}

    monkeypatch.setattr(wiki, "ai_ready", lambda: True)
    monkeypatch.setattr(wiki, "structured_call", fake_call)
    monkeypatch.setattr(wiki, "build_cards", fake_build)
    assert Pipeline()._wiki_next()

    assert cards.find_one({"_id": approved})["body"] == "nội dung cũ"          # không sửa thẳng
    ch = changes.change_requests.find_one({"card_id": approved, "kind": "update"})
    assert ch["origin"] == "ai" and ch["proposal"]["set"] == {"body": "nội dung mới"} and ch["status"] == "open"
    assert "bản mới" in seen["update"] and seen["existing"] == ["Thẻ đã duyệt"]
    assert cards.find_one({"_id": draft}) is None                                # nháp AI dựng lại
    d = documents.find_one({"_id": did})
    assert d["wiki_status"] == "done" and d["card_update"] is None
