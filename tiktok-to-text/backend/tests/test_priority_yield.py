"""Nút "Ưu tiên": kênh đang chuyển chữ ở làn nặng nhường sau video hiện tại, nguồn ưu tiên chạy ngay,
xong thì kênh chạy tiếp — video đã làm được bỏ qua (kể cả khi kênh đang "chuyển chữ lại" cả kênh)."""

from __future__ import annotations

import pytest

from app import db
from app.kb import pipeline
from app.kb.adapters import video as video_mod
from app.kb.pipeline import documents, sources
from app.spaces import personal_space
from tests.conftest import make_user

CHANNELS = {"https://www.tiktok.com/@kenh-x": ["x1", "x2", "x3"], "https://www.tiktok.com/@kenh-p": ["p1"]}


class FakeYDL:
    def __init__(self, *a, **k):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def extract_info(self, url, download=False):
        return {"id": url, "extractor_key": "TikTokUser",
                "entries": [{"id": v, "url": f"https://www.tiktok.com/@k/video/{v}"} for v in CHANNELS[url]]}


@pytest.fixture
def env(monkeypatch):
    user = make_user("a")
    space = personal_space(user)
    done = []

    def add(url, force=False):
        return sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "video",
                                   "lane": "heavy", "url": url, "status": "queued", "priority": 0, "logs": [],
                                   "options": {"build_wiki": False, "limit": 0, "sleep": 0, "force": force},
                                   "created_at": db.now()}).inserted_id

    monkeypatch.setattr(video_mod.yt_dlp, "YoutubeDL", FakeYDL)
    return user, add, done, monkeypatch


def fake_one_factory(done, on_first=None):
    def fake_one(self, url, source, ctx):
        vid = url.rsplit("/", 1)[-1]
        done.append(vid)
        if on_first and len(done) == 1:
            on_first()
        db.upsert_video(vid, db.video_doc_from_record({"id": vid, "url": url, "transcript": "chữ", "status": "OK"})
                        | {"transcribed_at": db.now()})
        return db.videos.find_one({"_id": vid})
    return fake_one


@pytest.mark.parametrize("force", [False, True])
def test_priority_preempts_running_channel(env, client, force):
    user, add, done, monkeypatch = env
    x = add("https://www.tiktok.com/@kenh-x", force=force)
    sources.update_one({"_id": x}, {"$set": {"priority": 3}})   # kênh X từng được ưu tiên -> nhận việc trước
    p = add("https://www.tiktok.com/@kenh-p")
    client.login(user)
    # người dùng bấm Ưu tiên nguồn P trong lúc kênh X đang chuyển chữ video đầu tiên
    press = lambda: client.post(f"/api/kb/sources/{p}/priority", json={"top": True})  # noqa: E731
    monkeypatch.setattr(video_mod.VideoAdapter, "_one", fake_one_factory(done, press))
    run = pipeline.Pipeline()

    assert run._extract_next("heavy")
    assert done == ["x1"]                                               # nhường sau video hiện tại
    xs = sources.find_one({"_id": x})
    assert xs["status"] == "queued" and "Tạm nhường" in " ".join(l["msg"] for l in xs["logs"])
    assert sources.find_one({"_id": p})["priority"] > xs["priority"]

    assert run._extract_next("heavy")                                   # nguồn ưu tiên chạy ngay
    assert done == ["x1", "p1"] and sources.find_one({"_id": p})["status"] == "extracted"

    assert run._extract_next("heavy")                                   # kênh X chạy tiếp, không làm lại x1
    assert done == ["x1", "p1", "x2", "x3"]
    xs = sources.find_one({"_id": x})
    assert xs["status"] == "extracted" and "force_since" not in xs["options"] and not xs["options"]["force"]
    assert documents.count_documents({"source_id": x}) == 3


def test_priority_preempts_channel_across_lanes(env, client):
    """Một lúc chỉ một việc chuyển chữ (ai_slot): bấm Ưu tiên một PDF (làn nhẹ) thì kênh ở làn nặng cũng nhường."""
    user, add, done, monkeypatch = env
    x = add("https://www.tiktok.com/@kenh-x")
    space = personal_space(user)
    pdf = sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "pdf", "lane": "light",
                              "url": "https://example.com/a.pdf", "status": "queued", "priority": 0, "logs": [],
                              "options": {}, "created_at": db.now()}).inserted_id
    client.login(user)
    press = lambda: client.post(f"/api/kb/sources/{pdf}/priority", json={"top": True})  # noqa: E731
    monkeypatch.setattr(video_mod.VideoAdapter, "_one", fake_one_factory(done, press))
    monkeypatch.setattr(pipeline.ai_slot, "ENABLED", True)
    assert pipeline.Pipeline()._extract_next("heavy")
    assert done == ["x1"] and sources.find_one({"_id": x})["status"] == "queued"


def test_manual_redo_preempts_running_channel(env, client):
    user, add, done, monkeypatch = env
    from app.kb import redo
    x = add("https://www.tiktok.com/@kenh-x")
    other = add("https://www.tiktok.com/@kenh-p")
    sources.update_one({"_id": other}, {"$set": {"status": "extracted"}})
    pick = lambda: redo.queue(sources.find_one({"_id": other}),  # noqa: E731
                              [{"key": "p9", "url": "https://www.tiktok.com/@k/video/p9"}], None, user)
    monkeypatch.setattr(video_mod.VideoAdapter, "_one", fake_one_factory(done, pick))
    assert pipeline.Pipeline()._extract_next("heavy")
    xs = sources.find_one({"_id": x})
    assert done == ["x1"] and xs["status"] == "queued" and "Lấy lại chữ" in xs["logs"][-1]["msg"]
