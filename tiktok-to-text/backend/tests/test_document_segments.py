"""GET /kb/documents/{id}?segments=1: kèm mốc thời gian từng câu của video gốc (db.videos theo documents.key) để FE
đồng bộ chữ với video nhúng. Mặc định không kèm; tài liệu không phải video trả segments rỗng."""

from __future__ import annotations

from app import db
from app.kb.pipeline import documents, sources
from app.spaces import personal_space
from tests.conftest import make_user


def setup(user):
    space = personal_space(user)
    sid = sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "video",
                              "url": "https://www.youtube.com/watch?v=abcdefghijk", "status": "done",
                              "options": {}, "logs": [], "created_at": db.now()}).inserted_id
    db.videos.insert_one({"_id": "abcdefghijk", "url": "https://www.youtube.com/watch?v=abcdefghijk",
                          "segments": [{"start": 0.0, "end": 2.5, "text": "xin chào", "words": [1, 2]},
                                       {"start": 2.5, "end": 5.0, "text": "các bạn"}]})
    video_doc = documents.insert_one({"source_id": sid, "space_id": space["_id"], "key": "abcdefghijk",
                                      "url": "https://www.youtube.com/watch?v=abcdefghijk", "title": "Video",
                                      "text": "xin chào các bạn", "wiki_status": "skipped",
                                      "created_at": db.now()}).inserted_id
    # tài liệu không phải video (không có url): không tra bảng videos
    file_doc = documents.insert_one({"source_id": sid, "space_id": space["_id"], "key": "abcdefghijk-file",
                                     "title": "File", "text": "nội dung", "wiki_status": "skipped",
                                     "created_at": db.now()}).inserted_id
    return video_doc, file_doc


def test_segments_only_when_asked(client):
    user = make_user("a")
    video_doc, file_doc = setup(user)
    client.login(user)

    plain = client.get(f"/api/kb/documents/{video_doc}").json()
    assert "segments" not in plain and plain["text"] == "xin chào các bạn"

    full = client.get(f"/api/kb/documents/{video_doc}?segments=1").json()
    assert full["segments"] == [{"start": 0.0, "end": 2.5, "text": "xin chào"},
                                {"start": 2.5, "end": 5.0, "text": "các bạn"}]   # rút gọn, bỏ trường thừa

    assert client.get(f"/api/kb/documents/{file_doc}?segments=1").json()["segments"] == []


def test_segments_missing_video_and_permission(client):
    owner, other = make_user("a"), make_user("b")
    video_doc, _ = setup(owner)
    db.videos.delete_many({})
    client.login(owner)
    assert client.get(f"/api/kb/documents/{video_doc}?segments=1").json()["segments"] == []
    client.login(other)
    assert client.get(f"/api/kb/documents/{video_doc}?segments=1").status_code in (403, 404)


def test_mcp_get_document_still_works():
    # tham số segments chen vào vị trí thứ hai của kb.get_document từng làm MCP get_document (truyền user theo vị trí) lỗi
    import json
    from app import mcp_server
    from tests.test_phan_loai_v2 import ctx_for
    user = make_user("a")
    video_doc, _ = setup(user)
    res = json.loads(mcp_server.get_document(ctx_for(user), str(video_doc)))
    assert res["text"] == "xin chào các bạn" and "segments" not in res
