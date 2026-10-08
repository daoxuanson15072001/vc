"""Ngừng / chạy tiếp tinh chế trên trang Tiến độ tinh chế (POST /kb/refine/bulk action=pause|resume).
Tài liệu "Đã dừng" không nằm ở hàng Chờ AI: máy chủ lẫn AI bên ngoài (Claude qua MCP claim_documents) đều không nhận."""

from __future__ import annotations

import json

from app import db, mcp_server
from app.kb import wiki
from app.kb.pipeline import Pipeline, documents, sources
from app.spaces import personal_space
from tests.conftest import make_user
from tests.test_changes import ctx_for


def add_doc(space, sid, title, status="pending"):
    return documents.insert_one({"source_id": sid, "space_id": space["_id"], "key": title, "title": title, "text": "x",
                                 "wiki_status": status, "priority": 0, "created_at": db.now()}).inserted_id


def test_pause_and_resume_block_server_and_external_ai(client, monkeypatch):
    user = make_user("a")
    space = personal_space(user)
    sid = sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "pdf", "status": "extracted",
                              "options": {}, "logs": [], "created_at": db.now()}).inserted_id
    a = add_doc(space, sid, "Dầu nhớt")
    b = add_doc(space, sid, "Phanh")
    busy = add_doc(space, sid, "Đang đọc", status="processing")
    client.login(user)

    body = {"action": "pause", "status": "", "q": ""}
    assert client.post("/api/kb/refine/bulk", json=body | {"dry_run": True}).json() == {"count": 2, "processing": 1}
    assert client.post("/api/kb/refine/bulk", json=body | {"q": "phanh"}).json()["changed"] == 1   # theo ô tìm
    assert client.post("/api/kb/refine/bulk", json=body).json()["changed"] == 1
    assert {documents.find_one({"_id": i})["wiki_status"] for i in (a, b)} == {"paused"}
    assert documents.find_one({"_id": busy})["wiki_status"] == "processing"        # đang đọc: làm nốt
    assert client.get("/api/kb/refine/summary").json()["counts"]["paused"] == 2
    assert client.get(f"/api/kb/sources/{sid}").json()["overall"] == "building"         # còn tài liệu đang đọc
    documents.update_one({"_id": busy}, {"$set": {"wiki_status": "done"}})
    assert client.get(f"/api/kb/sources/{sid}").json()["overall"] == "refine_paused"

    # AI bên ngoài không nhận được, máy chủ cũng không
    assert json.loads(mcp_server.claim_documents(ctx_for(user)))["claimed"] == []
    monkeypatch.setattr(wiki, "ai_ready", lambda: True)
    assert not Pipeline()._wiki_next()

    r = client.post("/api/kb/refine/bulk", json={"action": "resume", "status": "", "q": ""}).json()
    assert r["changed"] == 2
    got = json.loads(mcp_server.claim_documents(ctx_for(user)))["claimed"]
    assert len(got) == 1 and got[0]["title"] in ("Dầu nhớt", "Phanh")
