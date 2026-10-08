"""Lấy lại chữ nhiều video trong một nguồn kênh (kb/redo.py, POST /kb/sources/{id}/retranscribe): lần lượt từng video
ở làn riêng, xen kẽ giữa các nguồn, không chờ kênh khác đang chuyển chữ; tài liệu ghi đè tại chỗ, nguồn giữ trạng thái."""

from __future__ import annotations

import pytest

from app import db
from app.kb import langguess, redo
from app.kb.adapters import video as video_mod
from app.kb.pipeline import documents, sources
from app.spaces import personal_space
from tests.conftest import make_user

PROGRESS = {"total": 295, "processed": 34, "ok": 27, "failed": 2, "skipped": 5}


def add_source(space, user, handle: str, status: str = "cancelled"):
    return sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "video", "lane": "heavy",
                               "url": f"https://www.tiktok.com/@{handle}", "status": status, "progress": PROGRESS,
                               "options": {"build_wiki": False, "language": "vi"}, "logs": [], "priority": 0,
                               "created_at": db.now()}).inserted_id


def add_doc(space, sid, key: str):
    return documents.insert_one({"source_id": sid, "space_id": space["_id"], "key": key, "title": f"Video {key}",
                                 "url": f"https://www.tiktok.com/@kenh/video/{key}", "text": "(không có lời nói)",
                                 "meta": {"video_id": key}, "wiki_status": "skipped", "created_at": db.now()}).inserted_id


@pytest.fixture
def env(monkeypatch):
    user = make_user("a")
    space = personal_space(user)
    calls = []

    def fake_one(self, url, source, ctx):
        key = url.rsplit("/", 1)[-1]
        calls.append((key, ctx.options.get("language")))
        if key == "loi":
            raise RuntimeError("tải hỏng")
        db.videos.update_one({"_id": key}, {"$set": {"url": url, "caption": f"Video {key}", "transcript": "xin chào",
                                                     "segments": [{"start": 0, "end": 2, "text": "xin chào"}]}},
                             upsert=True)
        return db.videos.find_one({"_id": key})

    monkeypatch.setattr(video_mod.VideoAdapter, "_one", fake_one)
    monkeypatch.setattr(video_mod.yt_dlp, "YoutubeDL", lambda *a, **k: pytest.fail("không được liệt kê lại kênh"))
    return user, space, calls


def drain():
    while redo.run_next():
        pass


def test_many_videos_one_by_one_in_place(env, client):
    user, space, calls = env
    x = add_source(space, user, "kenh-x")
    docs = [add_doc(space, x, k) for k in ("1", "2", "3")]
    # video lỗi ở lượt quét trước, chưa có tài liệu — vẫn chọn được
    db.upsert_video("9", db.video_doc_from_record({"id": "9", "url": "https://www.tiktok.com/@kenh/video/9",
                                                   "status": "LỖI: bị chặn"}) | {"source_id": x})
    client.login(user)
    detail = client.get(f"/api/kb/sources/{x}").json()
    assert [v["key"] for v in detail["failed_videos"]] == ["9"]

    r = client.post(f"/api/kb/sources/{x}/retranscribe",
                    json={"document_ids": [str(d) for d in docs[:2]], "video_ids": ["9"], "language": "zh",
                          "save_language": True})
    assert r.json() == {"queued": 3, "selected": 3}
    again = client.post(f"/api/kb/sources/{x}/retranscribe", json={"document_ids": [str(docs[0])]}).json()
    assert again["queued"] == 0                                  # đang chờ: không nhân đôi
    st = client.get(f"/api/kb/sources/{x}").json()["redo"]
    assert st["total"] == 3 and st["queued"] == 3 and st["keys"]["1"] == "queued"

    drain()
    assert calls == [("1", "zh"), ("2", "zh"), ("9", "zh")]
    assert all("xin chào" in documents.find_one({"_id": d})["text"] for d in docs[:2])
    assert "xin chào" not in documents.find_one({"_id": docs[2]})["text"]
    assert documents.count_documents({"source_id": x, "key": "9"}) == 1       # video lỗi giờ có tài liệu
    src = sources.find_one({"_id": x})
    assert src["status"] == "cancelled" and src["progress"] == PROGRESS      # nguồn giữ trạng thái / tiến độ
    assert src["options"]["language"] == "zh"                                  # dùng cho cả nguồn
    assert client.get(f"/api/kb/sources/{x}").json()["redo"] is None


def test_round_robin_between_sources_and_skip_busy_channel(env):
    user, space, calls = env
    x = add_source(space, user, "kenh-x")
    z = add_source(space, user, "kenh-z")
    y = add_source(space, user, "kenh-y", status="extracting")   # kênh đang quét cả kênh ở làn nặng
    xs = [{"key": k, "url": f"https://www.tiktok.com/@kenh/video/{k}"} for k in ("x1", "x2", "x3")]
    redo.queue(sources.find_one({"_id": x}), xs, None, user)
    redo.queue(sources.find_one({"_id": y}), [{"key": "y1", "url": "https://www.tiktok.com/@kenh/video/y1"}], None, user)
    redo.queue(sources.find_one({"_id": z}), [{"key": "z1", "url": "https://www.tiktok.com/@kenh/video/z1"}], None, user)
    drain()
    order = [k for k, _ in calls]
    assert order.index("z1") <= 1                     # video lẻ của kênh Z không chờ hết 3 video của X
    assert "y1" not in order                          # kênh Y đang quét: chờ Y xong
    assert calls[0][1] == "vi"                        # không chọn ngôn ngữ -> theo nguồn


def test_error_does_not_block_queue_and_cancel(env, client):
    user, space, calls = env
    x = add_source(space, user, "kenh-x")
    src = sources.find_one({"_id": x})
    redo.queue(src, [{"key": k, "url": f"https://www.tiktok.com/@kenh/video/{k}"} for k in ("loi", "1")], None, user)
    assert redo.run_next() and redo.run_next()
    assert redo.jobs.find_one({"key": "loi"})["status"] == "error"
    assert redo.jobs.find_one({"key": "1"})["status"] == "done"

    redo.queue(src, [{"key": "2", "url": "https://www.tiktok.com/@kenh/video/2"}], None, user)
    client.login(user)
    assert client.post(f"/api/kb/sources/{x}/retranscribe/cancel").json() == {"cancelled": 1}
    assert not redo.run_next()


def test_needs_write_permission(env, client):
    user, space, _ = env
    x = add_source(space, user, "kenh-x")
    d = add_doc(space, x, "1")
    client.login(make_user("b"))
    assert client.post(f"/api/kb/sources/{x}/retranscribe", json={"document_ids": [str(d)]}).status_code in (403, 404)


def test_language_hint_from_captions(env):
    user, space, _ = env
    x = add_source(space, user, "kenh-x")
    for i, cap in enumerate(["奔驰206离线编程 #奔驰维修", "Mercedes offline code，SECOC #奔驰维修", "奔驰改装"]):
        db.videos.insert_one({"_id": f"v{i}", "source_id": x, "caption": cap, "language": "vi", "transcript": "ép"})
    hint = langguess.for_source(sources.find_one({"_id": x}))
    assert hint["language"] == "zh" and hint["differs"] and "ép tiếng việt" in hint["reason"]
    assert langguess.guess_text("Cách thay dầu nhớt") == "vi"
    assert langguess.guess_text("How to change oil") == "en"
