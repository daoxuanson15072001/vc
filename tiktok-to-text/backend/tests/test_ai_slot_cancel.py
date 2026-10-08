"""SYS-38 / SCR-22.1: Dừng trò chuyện khi đang chờ chỗ AI không làm mất khoá của việc khác."""

import builtins
import subprocess
import sys
import threading
import time

import pytest

from app.kb import ai_slot


@pytest.fixture
def isolated_slot(tmp_path, monkeypatch):
    monkeypatch.setattr(ai_slot, "ENABLED", True)
    monkeypatch.setattr(ai_slot, "LOCK_PATH", tmp_path / "slot.lock")
    monkeypatch.setattr(ai_slot, "WAIT_PATH", tmp_path / "slot.wait")
    monkeypatch.setattr(ai_slot, "_holder", None)
    monkeypatch.setattr(ai_slot, "_queue", [])
    monkeypatch.setattr(ai_slot, "_cond", threading.Condition())
    monkeypatch.setattr(ai_slot, "_last_kind", None)
    monkeypatch.setattr(ai_slot, "_leave_hooks", {})
    published = []
    monkeypatch.setattr(ai_slot, "_publish", lambda: published.append(dict(ai_slot._holder) if ai_slot._holder else None))
    return published


def wait_until(predicate):
    until = time.monotonic() + 2
    while not predicate() and time.monotonic() < until:
        time.sleep(0.01)
    assert predicate()


def waiter(cancelled, errors, entered):
    try:
        with ai_slot.hold("tinh_che", cancelled=cancelled.is_set):
            entered.set()
    except RuntimeError as exc:
        errors.append(str(exc))


def test_huy_khi_cho_noi_bo_giu_nguyen_chu_so_huu_va_go_ve(isolated_slot):
    cancelled, entered = threading.Event(), threading.Event()
    errors = []
    worker = threading.Thread(target=waiter, args=(cancelled, errors, entered))
    with ai_slot.hold("tho", "Whisper đang chạy"):
        owner = ai_slot._holder
        worker.start()
        try:
            wait_until(lambda: bool(ai_slot._queue))
            cancelled.set()
            worker.join(1)
            assert not worker.is_alive()
            assert errors == ["Đã dừng"] and not entered.is_set()
            assert ai_slot._queue == []
            assert ai_slot._holder is owner
            assert ai_slot._last_kind == "tho"
            assert not ai_slot.WAIT_PATH.exists()
        finally:
            cancelled.set()
    worker.join(1)
    assert ai_slot._holder is None
    with ai_slot.hold("vector_the"):
        assert ai_slot._holder["kind"] == "vector_the"


@pytest.mark.parametrize("replace_marker", [False, True])
def test_huy_khi_cho_tien_trinh_khac_don_file_va_khong_ghi_de_trang_thai(isolated_slot, monkeypatch, replace_marker):
    code = ("import fcntl,sys; "
            f"f=open({str(ai_slot.LOCK_PATH)!r},'a+'); fcntl.flock(f, fcntl.LOCK_EX); "
            "print('held', flush=True); sys.stdin.read()")
    proc = subprocess.Popen([sys.executable, "-c", code], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    files = []

    def tracked_open(*args, **kwargs):
        file = builtins.open(*args, **kwargs)
        files.append(file)
        return file

    monkeypatch.setattr(ai_slot, "open", tracked_open, raising=False)
    cancelled, entered = threading.Event(), threading.Event()
    errors = []
    worker = threading.Thread(target=waiter, args=(cancelled, errors, entered))
    try:
        assert proc.stdout.readline().strip() == "held"
        worker.start()
        wait_until(ai_slot.WAIT_PATH.exists)
        foreign_marker = f"{proc.pid} tho"
        if replace_marker:
            ai_slot.WAIT_PATH.write_text(foreign_marker)
        cancelled.set()
        worker.join(1)
        assert not worker.is_alive() and proc.poll() is None
        assert errors == ["Đã dừng"] and not entered.is_set()
        assert ai_slot._queue == [] and ai_slot._holder is None
        assert ai_slot._last_kind is None
        assert files and all(file.closed for file in files)
        assert isolated_slot == []  # chưa có flock: không ghi "rảnh" đè tiến trình đang chạy
        if replace_marker:
            assert ai_slot.WAIT_PATH.read_text() == foreign_marker
        else:
            assert not ai_slot.WAIT_PATH.exists()
    finally:
        cancelled.set()
        proc.communicate(timeout=3)
        worker.join(1)
    ai_slot.WAIT_PATH.unlink(missing_ok=True)
    with ai_slot.hold("tho"):
        assert ai_slot._holder["kind"] == "tho"
    assert all(file.closed for file in files)


def test_huy_truoc_khi_xep_hang_khong_tao_tai_nguyen(isolated_slot):
    with pytest.raises(RuntimeError, match="Đã dừng"):
        with ai_slot.hold("tinh_che", cancelled=lambda: True):
            pytest.fail("Không được vào chỗ đã huỷ")
    assert ai_slot._queue == [] and ai_slot._holder is None
    assert not ai_slot.LOCK_PATH.exists() and not ai_slot.WAIT_PATH.exists()
    assert isolated_slot == []
