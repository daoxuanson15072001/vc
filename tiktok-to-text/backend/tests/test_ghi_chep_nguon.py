"""Ghi chép theo nguồn và từng đơn vị (BA WK-45): nhiều ghi chép trên cả nguồn và trên từng tài liệu (một video, một
file), mốc thời gian cho video; màn quản lý /kb/notes lọc theo kho / nguồn / tài liệu / chữ / của tôi / loại; quyền
xem được thì ghi, sửa / xoá của người khác chỉ chủ kho; xoá nguồn xoá ghi chép; AI nhận khối *Ghi chép của người dùng*."""

from __future__ import annotations

import pytest
from bson import ObjectId

from app import db
from app.kb import notes as notes_mod
from app.kb import synth, wiki
from app.kb.pipeline import delete_source_data, documents, sources
from app.spaces import spaces
from tests.conftest import make_user


@pytest.fixture
def team():
    owner, editor, viewer, outsider = (make_user(n) for n in ("owner", "editor", "viewer", "outsider"))
    space = {"name": "Kho chung", "description": "", "type": "shared", "owner_id": owner["_id"],
             "visibility": "private", "created_at": db.now(),
             "members": [{"user_id": owner["_id"], "role": "owner"}, {"user_id": editor["_id"], "role": "editor"},
                         {"user_id": viewer["_id"], "role": "viewer"}]}
    space["_id"] = spaces.insert_one(space).inserted_id
    return {"owner": owner, "editor": editor, "viewer": viewer, "outsider": outsider, "space": space}


def add_channel(space, user, n_docs=3, note="", title="Kênh phụ tùng"):
    sid = sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "video", "lane": "heavy",
                              "url": "https://www.tiktok.com/@kenh", "title": title, "platform": "tiktok",
                              "status": "extracted", "priority": 0, "logs": [], "options": {}, "categories": [],
                              "tags": [], "note": note, "created_at": db.now()}).inserted_id
    dids = [documents.insert_one({"source_id": sid, "space_id": space["_id"], "key": f"v{i}", "title": f"Video {i}",
                                  "url": f"https://www.tiktok.com/@kenh/video/{i}", "text": "chữ", "meta": {},
                                  "wiki_status": "done", "created_at": db.now()}).inserted_id
            for i in range(n_docs)]
    return sid, dids


def test_create_list_edit_delete(client, team):
    sid, dids = add_channel(team["space"], team["owner"], note="Kênh mẫu cho đội TikTok")
    client.login(team["editor"])
    r = client.post("/api/kb/notes", json={"source_id": str(sid), "text": "  Cả kênh hay phần hook  "})
    assert r.status_code == 201, r.text
    whole = r.json()
    assert whole["text"] == "Cả kênh hay phần hook" and whole["doc_id"] is None and whole["can_edit"]
    r = client.post("/api/kb/notes", json={"source_id": str(sid), "doc_id": str(dids[1]), "text": "Đoạn giá", "t": 83})
    assert r.status_code == 201, r.text
    one = r.json()
    assert one["doc_title"] == "Video 1" and one["t"] == 83 and one["source_platform"] == "tiktok"
    assert one["author_name"] == "editor"
    assert sources.find_one({"_id": sid})["logs"][-1]["msg"].startswith("Thêm ghi chép («Video 1»)")

    # chi tiết nguồn: danh sách ghi chép + số ghi chép từng tài liệu
    s = client.get(f"/api/kb/sources/{sid}").json()
    assert [n["id"] for n in s["notes"]] == [one["id"], whole["id"]]
    assert [d["note_count"] for d in s["documents"]] == [0, 1, 0]
    assert s["can_note"]

    # màn ghi chép: mục Khi nạp (ghi chú của người nạp) + 2 ghi chép
    items = client.get("/api/kb/notes").json()
    assert items["total"] == 3
    assert {i["kind"] for i in items["items"]} == {"note", "intake"}
    intake = next(i for i in items["items"] if i["kind"] == "intake")
    assert intake["text"] == "Kênh mẫu cho đội TikTok" and intake["id"] == f"intake:{sid}"
    assert intake["can_edit"]   # editor sửa được nguồn -> sửa được ghi chú khi nạp (PUT /kb/sources/{id}/note)

    r = client.patch(f"/api/kb/notes/{one['id']}", json={"text": "Đoạn bảng giá", "t": None})
    assert r.status_code == 200 and r.json()["text"] == "Đoạn bảng giá" and r.json()["t"] is None
    assert client.patch(f"/api/kb/notes/{one['id']}", json={"text": "   "}).status_code == 422
    assert client.delete(f"/api/kb/notes/{one['id']}").status_code == 204
    assert client.get("/api/kb/notes", params={"kind": "note"}).json()["total"] == 1


def test_length_and_validation(client, team):
    sid, dids = add_channel(team["space"], team["owner"])
    other, _ = add_channel(team["space"], team["owner"], title="Kênh khác")
    client.login(team["owner"])
    assert client.post("/api/kb/notes", json={"source_id": str(sid), "text": "x" * (notes_mod.TEXT_MAX + 1)}).status_code == 422
    assert client.post("/api/kb/notes", json={"source_id": str(sid), "text": ""}).status_code == 422
    assert client.post("/api/kb/notes", json={"source_id": str(sid), "text": "ok", "t": -1}).status_code == 422
    # tài liệu phải thuộc đúng nguồn
    assert client.post("/api/kb/notes", json={"source_id": str(other), "doc_id": str(dids[0]), "text": "x"}).status_code == 404
    assert client.post("/api/kb/notes", json={"source_id": str(sid), "text": "x" * notes_mod.TEXT_MAX}).status_code == 201
    assert not notes_mod.notes.count_documents({"text": ""})


def test_permissions(client, team):
    sid, dids = add_channel(team["space"], team["owner"])
    client.login(team["viewer"])   # người chỉ xem vẫn ghi chép được
    r = client.post("/api/kb/notes", json={"source_id": str(sid), "doc_id": str(dids[0]), "text": "của người xem"})
    assert r.status_code == 201
    viewer_note = r.json()["id"]
    client.login(team["editor"])
    r = client.post("/api/kb/notes", json={"source_id": str(sid), "text": "của editor"})
    editor_note = r.json()["id"]
    listed = {i["id"]: i for i in client.get("/api/kb/notes").json()["items"]}
    assert listed[editor_note]["can_edit"] and not listed[viewer_note]["can_edit"]
    assert client.patch(f"/api/kb/notes/{viewer_note}", json={"text": "sửa hộ"}).status_code == 403
    assert client.delete(f"/api/kb/notes/{viewer_note}").status_code == 403

    client.login(team["viewer"])
    assert client.patch(f"/api/kb/notes/{editor_note}", json={"text": "sửa hộ"}).status_code == 403
    assert client.patch(f"/api/kb/notes/{viewer_note}", json={"text": "của tôi, sửa lại"}).status_code == 200

    client.login(team["outsider"])
    assert client.get("/api/kb/notes").json()["total"] == 0
    assert client.get("/api/kb/notes", params={"source_id": str(sid)}).status_code == 404
    assert client.post("/api/kb/notes", json={"source_id": str(sid), "text": "lạ"}).status_code == 404
    assert client.patch(f"/api/kb/notes/{viewer_note}", json={"text": "lạ"}).status_code == 404
    assert client.delete(f"/api/kb/notes/{editor_note}").status_code == 404

    client.login(team["owner"])   # chủ kho quản lý mọi ghi chép
    assert client.delete(f"/api/kb/notes/{viewer_note}").status_code == 204
    assert client.delete(f"/api/kb/notes/{str(ObjectId())}").status_code == 404


def test_list_filters(client, team):
    sid, dids = add_channel(team["space"], team["owner"], note="thích kênh")
    other, odids = add_channel(team["space"], team["owner"], title="Kênh khác")
    client.login(team["owner"])
    for body in ({"source_id": str(sid), "text": "Nguồn: hook 3 giây"},
                 {"source_id": str(sid), "doc_id": str(dids[0]), "text": "Video 0: bảng giá dầu"},
                 {"source_id": str(other), "doc_id": str(odids[2]), "text": "Kênh khác: giá lốp"}):
        assert client.post("/api/kb/notes", json=body).status_code == 201
    client.login(team["viewer"])
    assert client.post("/api/kb/notes", json={"source_id": str(sid), "text": "Người xem: HOOK hay"}).status_code == 201

    def ids(**params):
        return [i["text"] for i in client.get("/api/kb/notes", params=params).json()["items"]]

    assert len(ids()) == 5                                               # 4 ghi chép + 1 mục Khi nạp
    assert ids(source_id=str(sid)) == ["Người xem: HOOK hay", "Video 0: bảng giá dầu", "Nguồn: hook 3 giây", "thích kênh"]
    assert ids(source_id=str(sid), doc_id=str(dids[0])) == ["Video 0: bảng giá dầu"]
    assert ids(doc_id=str(odids[2])) == ["Kênh khác: giá lốp"]
    assert ids(q="hook") == ["Người xem: HOOK hay", "Nguồn: hook 3 giây"]   # không phân biệt hoa thường
    assert ids(q="giá", source_id=str(other)) == ["Kênh khác: giá lốp"]
    assert ids(mine=1) == ["Người xem: HOOK hay"]
    assert ids(kind="intake") == ["thích kênh"]
    assert len(ids(kind="note")) == 4
    assert len(ids(space_id=str(team["space"]["_id"]))) == 5
    page2 = client.get("/api/kb/notes", params={"page_size": 2, "page": 3}).json()
    assert page2["total"] == 5 and len(page2["items"]) == 1
    assert client.get("/api/kb/notes", params={"doc_id": str(odids[2]), "source_id": str(sid)}).status_code == 404


def test_pagination_merges_intake_in_time_order(client, team):
    client.login(team["owner"])
    sid, _ = add_channel(team["space"], team["owner"], note="ghi chú khi nạp")
    for i in range(3):
        client.post("/api/kb/notes", json={"source_id": str(sid), "text": f"ghi chép {i}"})
    texts = []
    for page in (1, 2):
        texts += [i["text"] for i in client.get("/api/kb/notes", params={"page": page, "page_size": 2}).json()["items"]]
    assert texts == ["ghi chép 2", "ghi chép 1", "ghi chép 0", "ghi chú khi nạp"]


def test_delete_source_removes_notes(client, team):
    sid, dids = add_channel(team["space"], team["owner"])
    client.login(team["owner"])
    client.post("/api/kb/notes", json={"source_id": str(sid), "text": "cả nguồn"})
    client.post("/api/kb/notes", json={"source_id": str(sid), "doc_id": str(dids[0]), "text": "một video"})
    assert notes_mod.notes.count_documents({"source_id": sid}) == 2
    assert client.delete(f"/api/kb/sources/{sid}").status_code == 204
    assert notes_mod.notes.count_documents({"source_id": sid}) == 0
    assert notes_mod.delete_for_document(dids[0]) == 0


def test_delete_source_data_cascade_direct(team):
    sid, dids = add_channel(team["space"], team["owner"])
    notes_mod.notes.insert_one({"space_id": team["space"]["_id"], "source_id": sid, "doc_id": dids[1], "text": "x",
                                "t": None, "created_by": team["owner"]["_id"], "created_at": db.now()})
    delete_source_data(sources.find_one({"_id": sid}))
    assert not notes_mod.notes.count_documents({})


def capture_call(monkeypatch) -> list:
    calls = []

    def fake(system, content, schema, **kw):
        calls.append((system, content))
        return {"doc_summary": "", "relevance": 5, "primary_category": None, "categories": [],
                "suggested_categories": [], "cards": [], "usage": None}
    monkeypatch.setattr(wiki, "ai_ready", lambda: True)
    monkeypatch.setattr(wiki, "structured_call", fake)
    return calls


def test_build_cards_prompt_includes_user_notes(client, team, monkeypatch, tmp_path):
    sid, dids = add_channel(team["space"], team["owner"], note="Ghi chú khi nạp")
    client.login(team["viewer"])
    client.post("/api/kb/notes", json={"source_id": str(sid), "text": "Cả kênh: chú ý giá"})
    client.post("/api/kb/notes", json={"source_id": str(sid), "doc_id": str(dids[0]), "text": "Video 0 đoạn cuối", "t": 75})
    client.post("/api/kb/notes", json={"source_id": str(sid), "doc_id": str(dids[1]), "text": "Chỉ của video 1"})
    calls = capture_call(monkeypatch)
    wiki.build_cards(documents.find_one({"_id": dids[0]}), sources.find_one({"_id": sid}), tmp_path)
    text = calls[-1][1][-1]["text"]
    assert "Ghi chép của người dùng" in text and "không chép vào thẻ" in text
    assert "<ghi_chu_nguoi_nap>\nGhi chú khi nạp\n</ghi_chu_nguoi_nap>" in text
    block = text[text.index("<ghi_chep_nguoi_dung>"):text.index("</ghi_chep_nguoi_dung>")]
    assert "- [tài liệu này · 01:15] Video 0 đoạn cuối" in block and "- [cả nguồn] Cả kênh: chú ý giá" in block
    assert block.index("Video 0 đoạn cuối") < block.index("Cả kênh")        # mới nhất trước
    assert "Chỉ của video 1" not in text                                     # ghi chép tài liệu khác không vào
    assert text.index("</ghi_chep_nguoi_dung>") < text.index("<tai_lieu>")


def test_user_notes_block_capped():
    many = [{"doc_id": None, "text": "y" * 1500, "t": None} for _ in range(10)]
    block = wiki.user_notes_block({"note": "a" * wiki.NOTE_MAX}, notes=many)
    assert len(block) < wiki.USER_NOTES_MAX + len(wiki.USER_NOTES_GUARD) + 200
    assert wiki.user_notes_block({}, notes=[]) == ""
    assert wiki.user_notes_block(None) == ""


def test_synth_and_mcp_include_doc_notes(client, team):
    sid, dids = add_channel(team["space"], team["owner"])
    client.login(team["owner"])
    client.post("/api/kb/notes", json={"source_id": str(sid), "doc_id": str(dids[2]), "text": "Video 2: mẹo thay lọc"})
    client.post("/api/kb/notes", json={"source_id": str(sid), "text": "Cả kênh: giọng miền Nam"})
    run_docs = [{"id": d, "title": f"Video {i}"} for i, d in enumerate(dids)]
    block = synth.note_of({"source_id": sid}, run_docs)
    assert "- [tài liệu «Video 2»] Video 2: mẹo thay lọc" in block and "[cả nguồn] Cả kênh" in block
    assert "Video 2: mẹo" not in synth.note_of({"source_id": sid}, run_docs[:1])

    from app import mcp_server
    documents.update_one({"_id": dids[2]}, {"$set": {"wiki_status": "processing"}})
    out = mcp_server._claim_out(documents.find_one({"_id": dids[2]}))
    assert [(n["scope"], n["text"]) for n in out["notes"]] == [("source", "Cả kênh: giọng miền Nam"),
                                                               ("document", "Video 2: mẹo thay lọc")]
