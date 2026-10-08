"""Reranker (cross-encoder bge-reranker-v2-m3) — bước cuối của tìm kiếm hybrid: chấm lại độ liên quan câu hỏi ↔ từng
ứng viên đầu bảng (thẻ / đoạn tài liệu) sau khi đã gộp tìm chữ + tìm theo nghĩa.

Chạy ngay trong tiến trình máy chủ bằng torch + transformers (Apple Silicon: MPS, float16). Ollama không có API rerank.
Model chỉ đọc từ bộ đệm HuggingFace trên máy (không tự tải lúc chạy): tải một lần bằng
    .venv/bin/python -c "from huggingface_hub import snapshot_download as s; s('BAAI/bge-reranker-v2-m3')"
Nạp lười ở lần tìm đầu (~4 giây, ~1,2 GB RAM), rảnh IDLE_UNLOAD giây (1 giờ) thì nhả RAM.
Thiếu torch / model, lỗi, hoặc chấm quá RERANK_TIMEOUT_MS → `score` trả None, nơi gọi giữ nguyên thứ tự hybrid
(kết quả kèm `reranked: false`).

Không chờ GPU: Whisper (worker.TRANSCRIBE_LOCK) và reranker cùng dùng GPU nhưng reranker không lấy khoá đó — lúc
Whisper chạy, chấm chậm hẳn thì hết giờ và trả None; lượt chấm dở vẫn chạy nốt trong luồng riêng, lượt tìm sau thấy
reranker còn bận thì không chờ (trả None ngay khi hết giờ). Lỗi lúc chấm → nghỉ ERROR_PAUSE giây (như tìm theo nghĩa).

Biến môi trường: `RERANK` (`1` mặc định, `0` tắt), `RERANK_MODEL`, `RERANK_TOPN` (30: số ứng viên đầu đem chấm lại),
`RERANK_MIN` (0: thẻ đã rerank mà điểm thấp hơn thì bỏ — 0 = không bỏ thẻ nào), `RERANK_TIMEOUT_MS` (2500).
"""

from __future__ import annotations

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Any

from ..config import RERANK as ENABLED
from ..config import RERANK_MIN as MIN_SCORE  # noqa: F401 — routes.py, eval_search.py đọc rerank.MIN_SCORE
from ..config import RERANK_MODEL as MODEL
from ..config import RERANK_TIMEOUT as TIMEOUT
from ..config import RERANK_TOPN as TOPN  # noqa: F401 — routes.py, eval_search.py đọc rerank.TOPN

MAX_LEN = 384           # token mỗi cặp (câu hỏi + văn bản) — 512 chậm gần gấp rưỡi, thứ hạng gần như không đổi
BATCH = 16
IDLE_UNLOAD = 3600      # giây — nạp lại mất ~4 giây (lượt tìm đầu sau khi nhả chậm hẳn), giữ 1 giờ
DOWN_PAUSE = 300        # lỗi nạp model thì nghỉ bấy nhiêu giây mới thử lại
ERROR_PAUSE = 60        # lỗi lúc chấm thì nghỉ bấy nhiêu giây

_lock = threading.Lock()                # giữ trạng thái model (nạp / nhả)
_busy = threading.Semaphore(1)          # một lượt chấm một lúc; luồng chấm nhả khi xong (kể cả khi nơi gọi đã hết giờ)
_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="rerank")
_DEFAULT = object()
_model: tuple[Any, Any, str] | None = None     # (tokenizer, model, device)
_last_used = 0.0
_down_until = 0.0
_timer: threading.Timer | None = None


def _load():
    global _model, _down_until
    if _model is not None:
        return _model
    if time.time() < _down_until:
        return None
    try:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
    except ImportError as e:
        # Thiếu thư viện thì cài xong phải khởi động lại mới có — nghỉ hẳn, báo một lần cho rõ (không im lặng)
        _down_until = float("inf")
        print(f"Reranker: TẮT — thiếu thư viện {e.name or e} (torch / transformers không có trong .venv). "
              "Tìm kiếm vẫn chạy nhưng không rerank. Cài: .venv/bin/pip install -r backend/requirements-ml.txt "
              "rồi khởi động lại máy chủ")
        return None
    try:
        device = "mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device != "cpu" else torch.float32
        tok = AutoTokenizer.from_pretrained(MODEL, local_files_only=True)
        m = AutoModelForSequenceClassification.from_pretrained(MODEL, local_files_only=True, dtype=dtype)
        _model = (tok, m.to(device).eval(), device)
        print(f"Reranker: đã nạp {MODEL} ({device})")
    except Exception as e:   # noqa: BLE001 — thiếu torch / chưa tải model: tìm kiếm vẫn chạy, không rerank
        _down_until = time.time() + DOWN_PAUSE
        print(f"Reranker: không nạp được {MODEL} — {str(e)[:200]}")
        return None
    return _model


def _unload_if_idle() -> None:
    global _model, _timer
    with _lock:
        if _model is not None and time.time() - _last_used >= IDLE_UNLOAD:
            _model = None
            try:
                import torch
                if torch.backends.mps.is_available():
                    torch.mps.empty_cache()
            except Exception:   # noqa: BLE001
                pass
            _timer = None
            return
    _arm()


def _arm() -> None:
    global _timer
    t = threading.Timer(IDLE_UNLOAD, _unload_if_idle)
    t.daemon = True
    _timer = t
    t.start()


def score(q: str, texts: list[str], timeout: Any = _DEFAULT) -> list[float] | None:
    """Độ liên quan 0–1 (sigmoid) của từng văn bản với câu hỏi `q`. None = không rerank được (tắt, thiếu model, lỗi,
    đang nghỉ sau lỗi, hoặc quá `timeout` giây — mặc định TIMEOUT; None = chờ tới khi xong, dùng cho script đo)."""
    if not ENABLED or not texts or not q.strip() or time.time() < _down_until:
        return None
    wait = TIMEOUT if timeout is _DEFAULT else timeout
    deadline = None if wait is None else time.monotonic() + wait
    if not _busy.acquire(timeout=wait):
        print("Reranker: lượt chấm trước chưa xong (GPU bận?) — trả thứ tự chưa rerank")
        return None
    try:
        fut = _pool.submit(_run, q, list(texts))
    except Exception:   # noqa: BLE001 — pool đã đóng (tắt máy chủ)
        _busy.release()
        return None
    try:
        return fut.result(timeout=None if deadline is None else max(0.0, deadline - time.monotonic()))
    except FutureTimeout:
        print(f"Reranker: quá {wait:.1f} giây — trả thứ tự chưa rerank")
        return None


def _run(q: str, texts: list[str]) -> list[float] | None:
    global _last_used, _down_until
    try:
        with _lock:
            loaded = _load()
            if loaded is None:
                return None
            tok, model, device = loaded
            try:
                import torch
                out: list[float] = []
                with torch.no_grad():
                    for s in range(0, len(texts), BATCH):
                        pairs = [[q, t] for t in texts[s:s + BATCH]]
                        x = tok(pairs, padding=True, truncation=True, max_length=MAX_LEN, return_tensors="pt").to(device)
                        out += torch.sigmoid(model(**x).logits.view(-1).float()).tolist()
            except Exception as e:   # noqa: BLE001
                _down_until = time.time() + ERROR_PAUSE
                print(f"Reranker: lỗi — {str(e)[:200]}")
                return None
            _last_used = time.time()
            if _timer is None:
                _arm()
        return [round(v, 4) for v in out]
    finally:
        _busy.release()
