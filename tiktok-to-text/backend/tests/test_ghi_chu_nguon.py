"""Ghi chú của người nạp trên nguồn Kho tư liệu (BA WK-44): lưu khi nạp, sửa sau trong chi tiết nguồn, giới hạn
2000 ký tự, quyền như sửa nguồn, và đưa vào prompt AI làm gợi ý phân loại (không phải nội dung tài liệu)."""

from __future__ import annotations

import pytest
from bson import ObjectId

from app import db
from app.kb import synth, wiki
from app.kb.pipeline import documents, sources
from app.spaces import personal_space, spaces
from tests.conftest import make_user


def add_source(space, user, note=""):
    return sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "web", "lane": "light",
                               "url": "https://example.com/bai-viet", "title": "Bài viết", "status": "extracted",
                               "priority": 0, "logs": [], "options": {}, "categories": [], "tags": [], "note": note,
                               "created_at": db.now()}).inserted_id


@pytest.fixture
def team():
    owner, editor, viewer, outsider = (make_user(n) for n in ("owner", "editor", "viewer", "outsider"))
    space = {"name": "Kho chung", "description": "", "type": "shared", "owner_id": owner["_id"],
             "visibility": "private", "created_at": db.now(),
             "members": [{"user_id": owner["_id"], "role": "owner"}, {"user_id": editor["_id"], "role": "editor"},
                         {"user_id": viewer["_id"], "role": "viewer"}]}
    space["_id"] = spaces.insert_one(space).inserted_id
    return {"owner": owner, "editor": editor, "viewer": viewer, "outsider": outsider, "space": space}


def test_add_links_stores_note_and_limits_length(client):
    user = make_user("a")
    client.login(user)
    r = client.post("/api/kb/sources/links", json={"urls": ["https://example.com/a"], "note": "  thích phần hook mở đầu  "})
    assert r.status_code == 201, r.text
    src = sources.find_one({"_id": ObjectId(r.json()["created"][0])})
    assert src["note"] == "thích phần hook mở đầu"
    assert client.get(f"/api/kb/sources/{src['_id']}").json()["note"] == "thích phần hook mở đầu"

    r = client.post("/api/kb/sources/links", json={"urls": ["https://example.com/b"], "note": "x" * (wiki.NOTE_MAX + 1)})
    assert r.status_code == 422
    assert not sources.find_one({"url": "https://example.com/b"})


def test_add_files_note_too_long_rejected(client):
    user = make_user("a")
    client.login(user)
    r = client.post("/api/kb/sources/files", data={"note": "x" * (wiki.NOTE_MAX + 1)},
                    files=[("files", ("a.pdf", b"%PDF-1.4\n", "application/pdf"))])
    assert r.status_code == 422
    assert "2000" in r.json()["detail"]
    assert not sources.count_documents({})


def test_put_note_permissions(client, team):
    sid = add_source(team["space"], team["owner"], note="cũ")
    url = f"/api/kb/sources/{sid}/note"
    client.login(team["editor"])   # ai sửa được nguồn (editor trở lên) thì sửa được ghi chú
    r = client.put(url, json={"note": "  áp cho kênh TikTok phụ tùng "})
    assert r.status_code == 200 and r.json() == {"note": "áp cho kênh TikTok phụ tùng"}
    src = sources.find_one({"_id": sid})
    assert src["note"] == "áp cho kênh TikTok phụ tùng"
    assert src["logs"][-1]["msg"] == "Sửa ghi chú của người nạp"

    assert client.put(url, json={"note": "x" * (wiki.NOTE_MAX + 1)}).status_code == 422
    client.login(team["viewer"])
    assert client.put(url, json={"note": "người xem"}).status_code == 403
    assert client.get(f"/api/kb/sources/{sid}").json()["note"] == "áp cho kênh TikTok phụ tùng"   # người xem vẫn đọc được
    client.login(team["outsider"])
    assert client.put(url, json={"note": "người ngoài"}).status_code == 404
    assert sources.find_one({"_id": sid})["note"] == "áp cho kênh TikTok phụ tùng"

    client.login(team["owner"])
    assert client.put(url, json={"note": ""}).json() == {"note": ""}   # chuỗi rỗng = xoá ghi chú


def capture_call(monkeypatch) -> list:
    calls = []

    def fake(system, content, schema, **kw):
        calls.append((system, content))
        return {"doc_summary": "", "relevance": 5, "primary_category": None, "categories": [],
                "suggested_categories": [], "cards": [], "usage": None}
    monkeypatch.setattr(wiki, "ai_ready", lambda: True)
    monkeypatch.setattr(wiki, "structured_call", fake)
    return calls


def test_build_cards_prompt_includes_note(monkeypatch, tmp_path):
    calls = capture_call(monkeypatch)
    doc = {"title": "Bài viết", "text": "Nội dung tài liệu.", "images": []}
    wiki.build_cards(doc, {"kind": "web", "note": "Thích phần định giá theo giờ công"}, tmp_path)
    system, content = calls[-1]
    text = content[-1]["text"]
    assert "Ghi chú của người nạp" in text
    assert "<ghi_chu_nguoi_nap>\nThích phần định giá theo giờ công\n</ghi_chu_nguoi_nap>" in text
    assert "không chép vào thẻ" in text
    assert text.index("<ghi_chu_nguoi_nap>") < text.index("<tai_lieu>")   # tách khỏi nội dung tài liệu
    assert "Ghi chú của người nạp" in system                              # quy tắc chung trong system prompt

    wiki.build_cards(doc, {"kind": "web", "note": "   "}, tmp_path)       # không có ghi chú: không có khối
    assert "<ghi_chu_nguoi_nap>" not in calls[-1][1][-1]["text"]


def test_uploader_note_cut_to_limit():
    block = wiki.uploader_note({"note": "a" * (wiki.NOTE_MAX + 50)})
    assert "a" * wiki.NOTE_MAX in block and "a" * (wiki.NOTE_MAX + 1) not in block
    assert wiki.uploader_note(None) == "" and wiki.uploader_note({}) == ""


def test_synth_and_mcp_expose_note():
    user = make_user("a")
    space = personal_space(user)
    sid = add_source(space, user, note="Chú ý bảng giá dịch vụ")
    assert "Chú ý bảng giá dịch vụ" in synth.note_of({"source_id": sid})
    assert synth.note_of({"source_id": add_source(space, user)}) == ""

    from app import mcp_server
    did = documents.insert_one({"source_id": sid, "space_id": space["_id"], "title": "T", "text": "x",
                                "wiki_status": "processing", "created_at": db.now()}).inserted_id
    assert mcp_server._claim_out(documents.find_one({"_id": did}))["source_note"] == "Chú ý bảng giá dịch vụ"
