"""Một lúc chỉ làm một việc nặng (app/kb/ai_slot.py): các luồng / tiến trình lần lượt giữ chỗ, việc dài nhường
khi có việc khác chờ, trạng thái báo được "đang làm A — B tạm dừng"."""

import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

from app import db
from app.kb import ai_slot, pipeline


@pytest.fixture(autouse=True)
def lock_path(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_slot, "ENABLED", True)
    monkeypatch.setattr(ai_slot, "LOCK_PATH", tmp_path / "slot.lock")
    monkeypatch.setattr(ai_slot, "WAIT_PATH", tmp_path / "slot.wait")
    return tmp_path / "slot.lock"


def test_moi_luc_chi_mot_viec():
    active, peak, order = [0], [0], []
    guard = threading.Lock()

    def job(kind):
        with ai_slot.hold(kind):
            with guard:
                active[0] += 1
                peak[0] = max(peak[0], active[0])
                order.append(kind)
            time.sleep(0.05)
            with guard:
                active[0] -= 1

    threads = [threading.Thread(target=job, args=(k,)) for k in ai_slot.KINDS]
    for t in threads:
        t.start()
    for t in threads:
        t.join(5)
    assert peak[0] == 1
    assert sorted(order) == sorted(ai_slot.KINDS)


def test_goi_long_cung_luong_khong_ket():
    with ai_slot.hold("tinh_che"):
        with ai_slot.hold("vector_the"):
            pass
    assert ai_slot._holder is None


def test_trang_thai_dang_lam_va_tam_dung():
    now = db.now()
    pipeline.documents.insert_one({"wiki_status": "pending", "title": "x", "created_at": now, "priority": 0})
    pipeline.sources.insert_one({"status": "queued", "lane": "heavy", "created_at": now})
    assert ai_slot.status()["running"] is None
    with ai_slot.hold("tho", "Video / ghi âm (Whisper): kênh A"):
        st = ai_slot.status()
        assert st["running"]["kind"] == "tho" and "kênh A" in st["running"]["detail"]
        assert [p["kind"] for p in st["paused"]] == ["tinh_che"]   # việc đang chạy không tính là tạm dừng
    assert ai_slot.status()["running"] is None


def test_nhuong_khi_buoc_dung_truoc_cho():
    with ai_slot.hold("tinh_che"):
        assert not ai_slot.should_yield()   # chưa ai chờ
        waiter = threading.Thread(target=_hold_once, args=("tho",))
        waiter.start()
        for _ in range(100):
            if ai_slot._queue:
                break
            time.sleep(0.02)
        assert ai_slot.should_yield()
    waiter.join(2)
    assert not waiter.is_alive()


def test_buoc_sau_khong_bat_buoc_truoc_nhuong():
    with ai_slot.hold("tho"):
        waiter = threading.Thread(target=_hold_once, args=("tinh_che",))
        waiter.start()
        time.sleep(0.1)
        assert not ai_slot.should_yield()   # Whisper chép tiếp cả loạt, tinh chế đợi
    waiter.join(2)


def test_cho_trong_thi_buoc_dung_truoc_lam_truoc():
    order = []
    started = []

    def job(kind):
        started.append(kind)
        with ai_slot.hold(kind):
            order.append(kind)

    with ai_slot.hold("vector_the"):
        threads = []
        for k in ("vector_the", "tinh_che", "dich", "tho"):   # xếp hàng ngược thứ tự bước
            t = threading.Thread(target=job, args=(k,))
            t.start()
            threads.append(t)
            while len(ai_slot._queue) < len(threads):
                time.sleep(0.01)
    for t in threads:
        t.join(5)
    assert order == ["tho", "dich", "tinh_che", "vector_the"]


def test_roi_buoc_thi_nha_model(monkeypatch):
    calls = []
    monkeypatch.setattr(ai_slot, "_leave_hooks", {"tho": [lambda: calls.append("whisper")]})
    monkeypatch.setattr(ai_slot, "_last_kind", None)
    with ai_slot.hold("tho"):
        pass
    with ai_slot.hold("tho"):
        pass
    assert calls == []            # vẫn bước chép chữ: giữ model
    with ai_slot.hold("dich"):
        assert calls == ["whisper"]


def _hold_once(kind):
    with ai_slot.hold(kind):
        pass


def test_giua_hai_tien_trinh(lock_path):
    """Tiến trình khác (job đêm) đang giữ chỗ -> máy chủ chờ tới khi nó nhả."""
    code = (f"import fcntl,time; f=open({str(lock_path)!r},'a+'); fcntl.flock(f, fcntl.LOCK_EX); "
            "print('held', flush=True); time.sleep(0.6)")
    proc = subprocess.Popen([sys.executable, "-c", code], stdout=subprocess.PIPE, text=True)
    assert proc.stdout.readline().strip() == "held"
    t0 = time.monotonic()
    with ai_slot.hold("tho"):
        waited = time.monotonic() - t0
    proc.wait(5)
    assert waited >= 0.3
    assert not Path(ai_slot.WAIT_PATH).exists()   # dấu "đang chờ" được dọn sau khi lấy được chỗ


def test_tat_thi_khong_khoa(monkeypatch):
    monkeypatch.setattr(ai_slot, "ENABLED", False)
    with ai_slot.hold("tho"):
        assert ai_slot._holder is None
    assert ai_slot.status()["running"] is None


def _video_with_pending_translation(tmp_path, monkeypatch):
    from app.kb.adapters.video import video_document
    monkeypatch.setattr(pipeline, "RAW_DIR", tmp_path / "raw")
    sid = pipeline.sources.insert_one({"kind": "video", "space_id": "s1", "status": "extracted", "lane": "heavy",
                                       "options": {"build_wiki": True}, "created_at": db.now(), "priority": 0}).inserted_id
    db.videos.insert_one({"_id": "v1", "url": "https://www.tiktok.com/@x/video/1", "caption": "สวัสดี",
                          "language": "th", "segments": [{"start": 0, "end": 2, "text": "สวัสดีครับ"}],
                          "transcript": "สวัสดีครับ", "translation": None, "translation_pending": True})
    src = pipeline.sources.find_one({"_id": sid})
    pipeline.save_document(src, video_document(db.videos.find_one({"_id": "v1"})), True)
    return sid


def test_tai_lieu_cho_dich_chua_dung_the(tmp_path, monkeypatch):
    _video_with_pending_translation(tmp_path, monkeypatch)
    doc = pipeline.documents.find_one({})
    assert doc["translate_pending"] is True and doc["wiki_status"] == "pending"
    monkeypatch.setattr(pipeline.wiki, "ai_ready", lambda: True)
    assert not pipeline.Pipeline._wiki_waiting()          # chờ dịch xong mới tinh chế
    assert ai_slot.pending()["dich"] == 1 and ai_slot.pending()["tinh_che"] == 0


def test_buoc_dich_them_ban_tieng_viet(tmp_path, monkeypatch):
    from app.kb import translate
    _video_with_pending_translation(tmp_path, monkeypatch)
    monkeypatch.setattr(translate, "translate_segments", lambda segs, lang, log: {
        "lang": "vi", "source_lang": lang, "engine": "test",
        "segments": [{"start": 0, "end": 2, "text": "Xin chào"}], "text": "Xin chào"})
    monkeypatch.setattr(translate, "translate_texts", lambda texts, lang: (["Xin chào (caption)"], "test"))
    assert pipeline.pipeline._translate_next()
    doc = pipeline.documents.find_one({})
    assert doc["translate_pending"] is False and not doc["translating"]
    assert "Xin chào" in doc["text"] and "dịch tiếng Việt" in doc["text"]
    assert db.videos.find_one({"_id": "v1"})["translation_pending"] is False
    monkeypatch.setattr(pipeline.wiki, "ai_ready", lambda: True)
    assert pipeline.Pipeline._wiki_waiting()
    assert not pipeline.pipeline._translate_next()       # hết việc dịch
