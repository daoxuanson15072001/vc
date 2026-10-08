"""Video lỗi trong kênh: "Chạy tiếp tất cả" xếp lấy lại chữ tự động (sau nguồn mới), dừng tự thử sau MAX_AUTO_RETRY
lần lỗi, lưu lịch sử lỗi + nhóm lỗi (kb/video_errors.py, GET /kb/failed-videos). "Lấy lại chữ" thủ công đi trước."""

from __future__ import annotations

import pytest

from app import db
from app.kb import pipeline, redo, video_errors
from app.kb.adapters import video as video_mod
from app.kb.pipeline import documents, sources
from app.spaces import personal_space
from tests.conftest import make_user

ANSI = "\x1b[0;31mERROR:\x1b[0m [TikTok] 123: No video formats found!"


def add(space, user, handle, status="extracted", kind="video", lane="heavy"):
    return sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": kind, "lane": lane,
                               "url": f"https://www.tiktok.com/@{handle}", "title": handle, "status": status,
                               "priority": 0, "logs": [], "options": {"build_wiki": False, "sleep": 0},
                               "created_at": db.now()}).inserted_id


def fail(sid, key, n=1, msg=ANSI):
    for _ in range(n):
        video_errors.record(key, f"https://www.tiktok.com/@k/video/{key}", msg, sid, "scan")


@pytest.fixture
def env(monkeypatch):
    user = make_user("a")
    space = personal_space(user)
    calls = []

    def fake_one(self, url, source, ctx):
        key = url.rsplit("/", 1)[-1]
        calls.append(key)
        if key.startswith("hong"):
            raise RuntimeError("ERROR: unable to download video data: HTTP Error 403: Forbidden")
        db.upsert_video(key, db.video_doc_from_record({"id": key, "url": url, "transcript": "chữ", "status": "OK"})
                        | {"source_id": source["_id"], "transcribed_at": db.now()})
        return db.videos.find_one({"_id": key})

    monkeypatch.setattr(video_mod.VideoAdapter, "_one", fake_one)
    return user, space, calls


def test_record_counts_logs_and_resets(env):
    user, space, _ = env
    x = add(space, user, "x")
    fail(x, "v1", 2)
    v = db.videos.find_one({"_id": "v1"})
    assert v["fail_count"] == 2 and v["error_kind"] == "no_formats" and v["status"] == "error"
    assert "\x1b" not in v["error"] and len(v["fail_log"]) == 2 and v["fail_log"][0]["via"] == "scan"
    db.upsert_video("v1", db.video_doc_from_record({"id": "v1", "transcript": "ok", "status": "OK"}))
    v = db.videos.find_one({"_id": "v1"})
    assert v["fail_count"] == 0 and len(v["fail_log"]) == 2          # lịch sử giữ lại để thống kê
    fail(x, "v1")
    assert db.videos.find_one({"_id": "v1"})["fail_count"] == 0     # đã có chữ: không ghi đè bằng lỗi
    assert video_errors.kind_of("curl: (35) TLS connect error") == "network"
    assert video_errors.kind_of("Join this channel to get access to members-only content") == "members_only"


def test_resume_all_queues_failed_videos_after_new_sources(env, client):
    user, space, calls = env
    done = add(space, user, "xong")
    fail(done, "a1")
    fail(done, "hong1", 2)
    fail(done, "cu", video_errors.MAX_AUTO_RETRY)                    # đã lỗi đủ lần: không tự thử
    stopped = add(space, user, "dung", status="cancelled")            # sắp chạy lại -> tự quét video lỗi của nó
    fail(stopped, "s1")
    pdf = add(space, user, "pdf", status="extracted", kind="pdf", lane="light")
    client.login(user)

    r = client.post("/api/kb/sources/resume-all", json={"dry_run": True}).json()
    assert r["failed_videos"] == 2 and r["failed_exhausted"] == 1 and r["cancelled"] == 1
    assert not redo.jobs.count_documents({})
    client.post("/api/kb/sources/resume-all", json={})
    assert {j["key"] for j in redo.jobs.find({"auto": True})} == {"a1", "hong1"}
    again = client.post("/api/kb/sources/resume-all", json={"dry_run": True}).json()
    assert again["failed_videos"] == 0                                 # đang chờ: không xếp trùng

    # nguồn mới / nguồn chạy tiếp đang chờ -> việc tự động chưa chạy
    assert sources.find_one({"_id": stopped})["status"] == "queued"
    assert not redo.has_work() and not redo.run_next()
    sources.update_one({"_id": stopped}, {"$set": {"status": "extracted"}})
    assert redo.has_work()
    while redo.run_next():
        pass
    assert sorted(calls) == ["a1", "hong1"]
    h = db.videos.find_one({"_id": "hong1"})
    assert h["fail_count"] == 3 and h["error_kind"] == "forbidden" and h["fail_log"][-1]["via"] == "auto"
    assert "dừng tự lấy lại" in " ".join(l["msg"] for l in sources.find_one({"_id": done})["logs"])
    r = client.post("/api/kb/sources/resume-all", json={"dry_run": True}).json()
    assert r["failed_videos"] == 1 and r["failed_exhausted"] == 2      # còn s1 (nguồn "dung" đã xong); hong1 + cu đã đủ lần
    assert sources.find_one({"_id": pdf})["status"] == "extracted"


def test_manual_redo_goes_first(env):
    user, space, calls = env
    x = add(space, user, "x")
    redo.queue(sources.find_one({"_id": x}), [{"key": "tu-dong", "url": "https://www.tiktok.com/@k/video/tu-dong"}],
               None, user, auto=True)
    redo.queue(sources.find_one({"_id": x}), [{"key": "chon", "url": "https://www.tiktok.com/@k/video/chon"}], None, user)
    add(space, user, "moi", status="queued")                          # nguồn mới đang chờ
    assert redo.manual_waiting()
    assert not pipeline.Pipeline()._extract_next("heavy")              # thủ công đi trước nguồn đang chờ
    assert redo.run_next() and calls == ["chon"]
    assert not redo.run_next()                                         # tự động: chờ nguồn mới


def test_failed_videos_list_and_filters(env, client):
    user, space, _ = env
    x = add(space, user, "x")
    fail(x, "f1")
    fail(x, "f2", 3, "curl: (35) TLS connect error")
    add_doc = documents.insert_one({"source_id": x, "space_id": space["_id"], "key": "f3", "title": "có chữ rồi",
                                    "url": "u", "text": "t", "created_at": db.now()})
    fail(x, "f3")                                                      # đã có tài liệu: không tính là video lỗi
    assert add_doc
    other = make_user("b")
    y = add(personal_space(other), other, "y")
    fail(y, "g1")
    client.login(user)

    r = client.get("/api/kb/failed-videos").json()
    assert r["total"] == 2 and {k["kind"]: k["n"] for k in r["kinds"]} == {"no_formats": 1, "network": 1}
    assert r["items"][0]["source_title"] == "x" and r["items"][0]["fail_log"]
    assert [v["key"] for v in client.get("/api/kb/failed-videos?exhausted=true").json()["items"]] == ["f2"]
    assert [v["key"] for v in client.get("/api/kb/failed-videos?error_kind=no_formats").json()["items"]] == ["f1"]
    d = client.get(f"/api/kb/sources/{x}").json()
    f2 = next(v for v in d["failed_videos"] if v["key"] == "f2")
    assert f2["fail_count"] == 3 and d["max_auto_retry"] == 3 and f2["error_label"]


def test_channel_scan_skips_exhausted_videos(env, monkeypatch):
    user, space, calls = env
    x = add(space, user, "kenh", status="queued")
    fail(x, "v2", video_errors.MAX_AUTO_RETRY)
    fail(x, "v3", 1, MEMBERS)                                          # lỗi vĩnh viễn: bỏ qua ngay từ lần đầu

    class FakeYDL:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def extract_info(self, url, download=False):
            return {"id": url, "extractor_key": "TikTokUser",
                    "entries": [{"id": v, "url": f"https://www.tiktok.com/@k/video/{v}"} for v in ("v1", "v2", "v3")]}

    monkeypatch.setattr(video_mod.yt_dlp, "YoutubeDL", FakeYDL)
    assert pipeline.Pipeline()._extract_next("heavy")
    assert calls == ["v1"]
    assert "bỏ qua" in " ".join(l["msg"] for l in sources.find_one({"_id": x})["logs"])


MEMBERS = "ERROR: [youtube] kvrc1Bd1IZs: Join this channel to get access to members-only content like this video"
GONE = "ERROR: [TikTok] 7400: Video not available, status code 10204"


def test_permanent_errors_never_auto_retried(env, client, monkeypatch):
    """Video chỉ dành cho hội viên / đã gỡ: lỗi 1 lần là thôi tự thử (Chạy tiếp tất cả, quét lại kênh)."""
    user, space, calls = env
    done = add(space, user, "xong")
    fail(done, "hoivien", 1, MEMBERS)
    fail(done, "dago", 1, GONE)
    fail(done, "mang", 1, "curl: (35) TLS connect error")
    db.videos.insert_one({"_id": "cu", "source_id": done, "status": "error", "url": "https://www.tiktok.com/@k/video/cu",
                          "error": MEMBERS})                           # dữ liệu cũ: chưa có error_kind / fail_count
    assert video_errors.kind_of("Video unavailable. This content isn't available, try again later") == "forbidden"
    assert video_errors.exhausted("hoivien") and video_errors.exhausted("cu") and not video_errors.exhausted("mang")
    client.login(user)

    r = client.post("/api/kb/sources/resume-all", json={"dry_run": True}).json()
    assert r["failed_videos"] == 1 and r["failed_exhausted"] == 3
    client.post("/api/kb/sources/resume-all", json={})
    assert [j["key"] for j in redo.jobs.find({})] == ["mang"]
    lst = client.get("/api/kb/failed-videos?exhausted=true").json()["items"]
    assert {v["key"] for v in lst} == {"hoivien", "dago", "cu"} and all(v["permanent"] for v in lst)

    # thủ công vẫn được
    assert client.post(f"/api/kb/sources/{done}/retranscribe", json={"video_ids": ["hoivien"]}).json()["queued"] == 1
