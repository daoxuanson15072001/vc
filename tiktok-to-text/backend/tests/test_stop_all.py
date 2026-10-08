"""Ngừng lấy chữ hàng loạt theo bộ lọc đang xem (POST /kb/sources/stop-all)."""

from __future__ import annotations

from app import db
from app.kb import redo
from app.kb.pipeline import sources
from app.spaces import personal_space
from tests.conftest import make_user


def add(space, user, url, status, kind="video"):
    return sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": kind, "lane": "heavy",
                               "url": url, "title": url, "status": status, "priority": 0, "logs": [], "options": {},
                               "created_at": db.now()}).inserted_id


def test_stop_all_by_filter(client):
    user = make_user("a")
    space = personal_space(user)
    run = add(space, user, "https://www.tiktok.com/@chay", "extracting")
    wait = add(space, user, "https://www.tiktok.com/@cho", "queued")
    pdf = add(space, user, "https://example.com/a.pdf", "queued", kind="pdf")
    done = add(space, user, "https://www.tiktok.com/@xong", "extracted")
    redo.queue(sources.find_one({"_id": done}), [{"key": "v1", "url": "https://www.tiktok.com/@xong/video/v1"}], None, user)
    other = make_user("b")
    theirs = add(personal_space(other), other, "https://www.tiktok.com/@nguoikhac", "queued")
    client.login(user)

    body = {"kind": "video"}
    assert client.post("/api/kb/sources/stop-all", json=body | {"dry_run": True}).json() == {"running": 1, "queued": 1, "redo": 1}
    assert sources.find_one({"_id": wait})["status"] == "queued"            # đếm thử không dừng gì
    assert client.post("/api/kb/sources/stop-all", json=body | {"q": "cho"}).json() == {"running": 0, "queued": 1, "redo": 0}
    assert sources.find_one({"_id": run})["status"] == "extracting"         # ô tìm vẫn được áp dụng

    assert client.post("/api/kb/sources/stop-all", json=body).json() == {"running": 1, "queued": 0, "redo": 1}
    assert sources.find_one({"_id": run})["cancel_requested"] is True        # đang chạy: dừng sau mục hiện tại
    assert sources.find_one({"_id": wait})["status"] == "cancelled"
    assert not redo.jobs.count_documents({"status": "queued"})
    assert sources.find_one({"_id": pdf})["status"] == "queued"             # ngoài bộ lọc loại
    assert sources.find_one({"_id": theirs})["status"] == "queued"          # kho người khác


def test_resume_all_by_filter(client):
    user = make_user("a")
    space = personal_space(user)
    stopped = add(space, user, "https://www.tiktok.com/@dung", "cancelled")
    broken = add(space, user, "https://www.tiktok.com/@loi", "error")
    pdf = add(space, user, "https://example.com/a.pdf", "cancelled", kind="pdf")
    client.login(user)

    body = {"kind": "video"}
    counts = lambda r: {k: r.json()[k] for k in ("cancelled", "error")}  # noqa: E731
    assert counts(client.post("/api/kb/sources/resume-all", json=body | {"dry_run": True})) == {"cancelled": 1, "error": 0}
    assert counts(client.post("/api/kb/sources/resume-all", json=body)) == {"cancelled": 1, "error": 0}
    assert sources.find_one({"_id": stopped})["status"] == "queued"
    assert sources.find_one({"_id": broken})["status"] == "error"          # lỗi: chỉ khi lọc trạng thái Lỗi
    assert sources.find_one({"_id": pdf})["status"] == "cancelled"         # ngoài bộ lọc loại
    sources.update_one({"_id": stopped}, {"$set": {"status": "cancelled"}})
    assert counts(client.post("/api/kb/sources/resume-all", json=body | {"status": "error"})) == {"cancelled": 0, "error": 1}
    assert sources.find_one({"_id": stopped})["status"] == "cancelled"     # đang lọc Lỗi: không đụng nguồn Đã dừng
    assert sources.find_one({"_id": broken})["status"] == "queued"
