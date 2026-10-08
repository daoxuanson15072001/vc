"""Một lúc chỉ làm một việc nặng — các loại việc dùng chung một "chỗ" (slot) trên máy, theo thứ tự bước:

  tho         xử lý thô: chuyển nguồn thành chữ (Whisper, đọc file, crawl) — pipeline làn nhẹ / nặng / lấy lại chữ
  dich        dịch lời nói tiếng nước ngoài sang tiếng Việt (gemma) — tách khỏi Whisper, chạy sau cả loạt
  vector_tho  vector hoá tầng thô vào Qdrant — job đêm scripts/index_raw_vectors.py (tiến trình riêng)
  tinh_che    tinh chế: dựng thẻ VCWIKI, tổng hợp theo cụm (sàng lọc bằng AI local)
  vector_the  vector hoá thẻ VCWIKI (card_embeddings, bge-m3)

Máy chỉ có 24 GB: Whisper, gemma3:12b và bge-m3 cùng nạp một lúc là tràn RAM, đẩy sang swap. Mỗi việc giữ chỗ cho
một đơn vị (một nguồn, một tài liệu, một lượt vector), xong thì nhả. Chỗ trống thì bước đứng trước trong danh sách
trên được làm trước (cùng bước: chờ trước làm trước) — Whisper chép xong cả loạt rồi mới tới dịch, dịch xong mới
tới tinh chế. Việc dài (kênh nhiều video, sàng lọc nhiều tài liệu) có bước đứng trước đang chờ thì nhường giữa chừng
rồi chạy tiếp sau (should_yield). Rời một bước thì nhả model của bước đó (on_leave: Whisper, gemma).

Trong tiến trình: khoá có hàng đợi. Giữa các tiến trình (máy chủ ↔ job đêm): flock trên file cạnh data/, tiến trình
chết thì hệ điều hành tự nhả. Trạng thái (đang làm gì, ai đang chờ) ghi vào kb_jobs/_id "ai_slot" để giao diện báo
"đang làm A — B, C, D tạm dừng" (status()). AI_ONE_JOB=off: tắt, các việc chạy song song như cũ.
"""

from __future__ import annotations

import fcntl
import itertools
import os
import threading
import time
from contextlib import contextmanager
from collections.abc import Callable
from pathlib import Path

from .. import db
from ..config import AI_ONE_JOB, AI_SLOT_LOCK, RAW_DIR

KINDS = {   # theo thứ tự ưu tiên
    "tho": "Xử lý thô (chuyển thành chữ)",
    "dich": "Dịch sang tiếng Việt",
    "vector_tho": "Vector hoá tầng thô",
    "tinh_che": "Tinh chế (dựng thẻ VCWIKI)",
    "vector_the": "Vector hoá thẻ VCWIKI",
}
ENABLED = AI_ONE_JOB
RANK = {k: i for i, k in enumerate(KINDS)}
# mỗi database một khoá: máy chủ và job đêm cùng DB tranh nhau, bộ test (DB riêng) không đụng máy chủ thật
LOCK_PATH = Path(AI_SLOT_LOCK if AI_SLOT_LOCK is not None else RAW_DIR.parent / f"ai_slot-{db.db.name}.lock")
WAIT_PATH = LOCK_PATH.with_suffix(".wait")   # tiến trình khác đang chờ: "<pid> <kind>"

state = db.db["kb_jobs"]
_cond = threading.Condition()
_tickets = itertools.count()
_queue: list[tuple[int, str]] = []   # (vé, loại việc) đang chờ trong tiến trình này
_holder: dict | None = None          # {kind, detail, since, thread}
_last_kind: str | None = None        # bước vừa giữ chỗ gần nhất — đổi bước thì gọi on_leave của bước cũ
_leave_hooks: dict[str, list] = {}
CANCEL_POLL = 0.1                    # chờ có ngủ, vẫn phản hồi nút Dừng khi chưa lấy được chỗ


def on_leave(kind: str, fn) -> None:
    """Đăng ký việc dọn khi chuyển từ bước `kind` sang bước khác (vd nhả model Whisper / gemma khỏi RAM)."""
    _leave_hooks.setdefault(kind, []).append(fn)


def _key(entry: tuple[int, str]) -> tuple[int, int]:
    return RANK.get(entry[1], len(RANK)), entry[0]


# ---------------------------------------------------------------------------
# Giữ chỗ
# ---------------------------------------------------------------------------

def _check_cancelled(cancelled: Callable[[], bool] | None) -> None:
    if cancelled and cancelled():
        raise RuntimeError("Đã dừng")


@contextmanager
def hold(kind: str, detail: str = "", cancelled: Callable[[], bool] | None = None):
    """Chờ và giữ chỗ; gọi lồng cùng luồng không chờ lại. Cờ huỷ tuỳ chọn áp dụng cả lúc đang chờ."""
    global _holder, _last_kind
    _check_cancelled(cancelled)
    if not ENABLED or (_holder and _holder["thread"] == threading.get_ident()):
        yield
        return
    ticket = next(_tickets)
    with _cond:
        _queue.append((ticket, kind))
        try:
            while _holder is not None or min(_queue, key=_key)[0] != ticket:
                _check_cancelled(cancelled)
                _cond.wait(timeout=CANCEL_POLL if cancelled else None)
            _check_cancelled(cancelled)
        except BaseException:
            _queue.remove((ticket, kind))
            _cond.notify_all()
            raise
        _queue.remove((ticket, kind))
        _holder = {"kind": kind, "detail": detail, "since": db.now(), "thread": threading.get_ident()}
        left = _last_kind if _last_kind != kind else None
    lock = None
    try:
        for fn in _leave_hooks.get(left, []) if left else []:
            _check_cancelled(cancelled)
            try:
                fn()
            except Exception as e:  # noqa: BLE001 — dọn không được thì thôi
                print(f"ai_slot: dọn sau bước {left} lỗi — {str(e)[:150]}")
        lock = _lock_file(kind, cancelled=cancelled)
        _check_cancelled(cancelled)
        _last_kind = kind
        _publish()
        yield
    finally:
        with _cond:
            _holder = None
            if lock:
                # Chưa giữ flock thì không ghi rảnh: trạng thái này có thể thuộc tiến trình khác.
                _publish()
                try:
                    fcntl.flock(lock, fcntl.LOCK_UN)
                finally:
                    lock.close()
            _cond.notify_all()


def set_detail(detail: str) -> None:
    """Đổi dòng mô tả việc đang giữ chỗ (vd tên tài liệu đang dựng thẻ)."""
    if _holder and _holder["thread"] == threading.get_ident():
        _holder["detail"] = detail
        _publish()


def should_yield() -> bool:
    """Có bước đứng trước (ưu tiên hơn) đang chờ chỗ → việc đang giữ nên nhường (lưu dở, chạy tiếp sau)."""
    if not ENABLED or not _holder:
        return False
    mine = RANK.get(_holder["kind"], len(RANK))
    foreign = _foreign_waiter()
    return any(RANK.get(k, len(RANK)) < mine for _, k in list(_queue)) or \
        (foreign is not None and RANK.get(foreign, len(RANK)) < mine)


def _foreign_waiter() -> str | None:
    """Loại việc của tiến trình khác đang chờ chỗ (còn sống), không có thì None."""
    try:
        pid, kind = WAIT_PATH.read_text().split()
        if int(pid) != os.getpid():
            os.kill(int(pid), 0)
            return kind
    except (OSError, ValueError):
        pass
    return None


def _lock_file(kind: str, cancelled: Callable[[], bool] | None = None):
    """flock giữa các tiến trình; người gọi có cờ huỷ chờ từng nhịp ngắn thay vì khoá vô hạn."""
    _check_cancelled(cancelled)
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    f = open(LOCK_PATH, "a+")  # noqa: SIM115 — giữ mở suốt lúc giữ chỗ
    marker = f"{os.getpid()} {kind}"
    waiting = False
    try:
        for _ in range(20):
            _check_cancelled(cancelled)
            other = _foreign_waiter()
            if other is None or RANK.get(other, len(RANK)) > RANK.get(kind, len(RANK)):
                break
            if cancelled:
                until = time.monotonic() + 0.25
                while time.monotonic() < until:
                    _check_cancelled(cancelled)
                    time.sleep(min(CANCEL_POLL, max(0, until - time.monotonic())))
            else:
                time.sleep(0.25)
        _check_cancelled(cancelled)
        try:
            fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return f
        except BlockingIOError:
            pass
        waiting = True
        WAIT_PATH.write_text(marker)
        if cancelled is None:
            fcntl.flock(f, fcntl.LOCK_EX)
            return f
        while True:
            _check_cancelled(cancelled)
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return f
            except BlockingIOError:
                time.sleep(CANCEL_POLL)
    except BaseException:
        f.close()
        raise
    finally:
        if waiting:
            try:
                if WAIT_PATH.read_text() == marker:
                    WAIT_PATH.unlink()
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Trạng thái cho giao diện
# ---------------------------------------------------------------------------

def _publish() -> None:
    try:
        h = _holder
        state.update_one({"_id": "ai_slot"}, {"$set": {
            "kind": h["kind"] if h else None, "detail": h["detail"] if h else "", "since": h["since"] if h else None,
            "pid": os.getpid(), "updated_at": db.now()}}, upsert=True)
    except Exception as e:  # noqa: BLE001 — ghi trạng thái hỏng không được làm hỏng việc
        print(f"ai_slot: không ghi được trạng thái — {str(e)[:150]}")


def _alive(pid) -> bool:
    try:
        os.kill(int(pid), 0)
    except ProcessLookupError:
        return False
    except (PermissionError, TypeError, ValueError):
        return True
    return True


def pending() -> dict[str, int]:
    """Số việc đang chờ của từng loại (ước lượng, để báo người dùng)."""
    from . import embeddings, pipeline, redo, synth   # nhập muộn: các module này nhập ai_slot
    now = db.now()
    tinh_che = pipeline.documents.count_documents({"wiki_status": "pending", "translate_pending": {"$ne": True}, "$or": [
        {"wiki_retry_at": None}, {"wiki_retry_at": {"$lte": now}}]})
    tinh_che += synth.runs.count_documents({"status": {"$in": ["queued", "synthesizing"]}})
    return {
        "tho": pipeline.sources.count_documents({"status": "queued"}) + redo.jobs.count_documents({"status": "queued"}),
        "dich": pipeline.documents.count_documents({"translate_pending": True}),
        "vector_tho": 1 if _foreign_waiter() == "vector_tho" else 0,
        "tinh_che": tinh_che,
        "vector_the": len(embeddings._pending),
    }


def status() -> dict:
    """{enabled, running: {kind, label, detail, since, seconds} | None, paused: [{kind, label, waiting}]}.
    `paused`: các loại việc khác đang có việc chờ — tạm dừng tới khi việc đang chạy nhả chỗ."""
    doc = state.find_one({"_id": "ai_slot"}) or {}
    running = None
    if ENABLED and doc.get("kind") and _alive(doc.get("pid")):
        since = doc.get("since")
        running = {"kind": doc["kind"], "label": KINDS.get(doc["kind"], doc["kind"]), "detail": doc.get("detail") or "",
                   "since": since, "seconds": int((db.now() - since).total_seconds()) if since else None}
    counts = pending()
    paused = [{"kind": k, "label": KINDS[k], "waiting": counts.get(k, 0)}
              for k in KINDS if counts.get(k) and (not running or k != running["kind"])] if running else []
    return {"enabled": ENABLED, "order": list(KINDS.values()), "running": running, "paused": paused}

