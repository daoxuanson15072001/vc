"""AI local (SYS-17): LLM chạy ngay trên máy qua API tương thích OpenAI (Ollama mặc định, MLX-LM / LM Studio cũng được).

Dữ liệu không ra khỏi máy, không tốn phí theo lượt. Chưa cài, máy tắt Ollama hoặc model trả JSON hỏng thì
`structured_call` tự rơi về Claude — không làm hỏng việc đang chạy.
"""

from __future__ import annotations

import json
import threading
import time

import httpx

from ..config import LOCAL_AI_IDLE_SECONDS, LOCAL_EMBED_MODEL, LOCAL_LLM_MODEL, LOCAL_LLM_URL
from . import wiki

TIMEOUT = httpx.Timeout(10.0, read=600.0)   # model lớn nạp vào RAM lần đầu mất vài chục giây
STATUS_TTL = 30                             # giây: không hỏi Ollama mỗi lần gọi

_status: tuple[float, dict] | None = None
_idle_lock = threading.Lock()
_idle_timers: dict[str, threading.Timer] = {}
_active_calls: dict[str, int] = {}


def _base() -> str:
    return LOCAL_LLM_URL.rstrip("/")


def status(fresh: bool = False) -> dict:
    """{ready, url, model, embed_model, models, error} — dùng cho trang trạng thái AI."""
    global _status
    if not fresh and _status and time.time() - _status[0] < STATUS_TTL:
        return _status[1]
    info = {"ready": False, "url": LOCAL_LLM_URL, "model": LOCAL_LLM_MODEL, "embed_model": LOCAL_EMBED_MODEL,
            "models": [], "error": None}
    try:
        res = httpx.get(f"{_base()}/v1/models", timeout=3)
        res.raise_for_status()
        info["models"] = sorted(m["id"] for m in res.json().get("data", []))
        if _has(info["models"], LOCAL_LLM_MODEL):
            info["ready"] = True
        else:
            info["error"] = f"Chưa tải model {LOCAL_LLM_MODEL} (ollama pull {LOCAL_LLM_MODEL})"
    except httpx.HTTPError:
        info["error"] = f"Không kết nối được AI local ở {LOCAL_LLM_URL} (mở app Ollama)"
    _status = (time.time(), info)
    return info


def _has(models: list[str], name: str) -> bool:
    return name in models or (":" not in name and f"{name}:latest" in models)


def ready() -> bool:
    return status()["ready"]


def _mark_down(error: str) -> None:
    global _status
    info = dict(status())
    info.update(ready=False, error=error)
    _status = (time.time(), info)


def _cancel_unload(model: str) -> None:
    """Một lượt mới sắp dùng model: huỷ lịch nhả cũ để không cắt ngang lời gọi đang chạy."""
    with _idle_lock:
        timer = _idle_timers.pop(model, None)
        if timer:
            timer.cancel()


def begin_use(model: str) -> None:
    """Đánh dấu bắt đầu dùng model (kể cả nơi gọi async như chat_local)."""
    _cancel_unload(model)
    with _idle_lock:
        _active_calls[model] = _active_calls.get(model, 0) + 1


def end_use(model: str, embedding: bool = False) -> None:
    """Đánh dấu kết thúc; lời gọi đồng thời cuối cùng mới bắt đầu đếm thời gian rảnh."""
    with _idle_lock:
        left = max(0, _active_calls.get(model, 1) - 1)
        if left:
            _active_calls[model] = left
            return
        _active_calls.pop(model, None)
    _schedule_unload(model, embedding)


def _unload_model(model: str, embedding: bool = False) -> None:
    """Nhả một model khỏi Ollama; endpoint khác Ollama có thể bỏ qua API này."""
    try:
        path = "/api/embed" if embedding else "/api/generate"
        body = {"model": model, "keep_alive": 0}
        if embedding:
            body["input"] = ""
        httpx.post(f"{_base()}{path}", json=body, timeout=10)
    except httpx.HTTPError:
        pass
    finally:
        with _idle_lock:
            _idle_timers.pop(model, None)


def _schedule_unload(model: str, embedding: bool = False) -> None:
    """Đặt lại đồng hồ nhả model sau khi hoàn tất lời gọi cuối cùng."""
    _cancel_unload(model)
    if LOCAL_AI_IDLE_SECONDS < 0:
        return
    if LOCAL_AI_IDLE_SECONDS == 0:
        _unload_model(model, embedding)
        return
    timer = threading.Timer(LOCAL_AI_IDLE_SECONDS, _unload_model, args=(model, embedding))
    timer.daemon = True
    with _idle_lock:
        _idle_timers[model] = timer
    timer.start()


def local_call(system: str, content: str, schema: dict, max_tokens: int = 16000) -> dict:
    """Gọi AI local, trả JSON theo `schema` kèm `usage` (cùng dạng wiki.structured_call)."""
    body = {
        "model": LOCAL_LLM_MODEL,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}],
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "response_format": {"type": "json_schema", "json_schema": {"name": "result", "schema": schema, "strict": True}},
    }
    begin_use(LOCAL_LLM_MODEL)
    try:
        res = httpx.post(f"{_base()}/v1/chat/completions", json=body, timeout=TIMEOUT)
        res.raise_for_status()
        data = res.json()
    finally:
        end_use(LOCAL_LLM_MODEL)
    choice = data["choices"][0]
    if choice.get("finish_reason") == "length":
        raise ValueError("Kết quả AI local quá dài, bị cắt")
    out = json.loads(choice["message"]["content"])
    usage = data.get("usage") or {}
    out["usage"] = {"input_tokens": usage.get("prompt_tokens", 0), "output_tokens": usage.get("completion_tokens", 0),
                    "model": f"local:{LOCAL_LLM_MODEL}"}
    return out


def structured_call(system: str, content: list[dict] | str, schema: dict, engine: str = "local",
                    max_tokens: int = 16000, model: str | None = None, **kwargs) -> dict:
    """Chọn công cụ theo việc: `engine="local"` thử AI local trước, lỗi thì dùng Claude (`model`)."""
    if engine == "local" and isinstance(content, str) and ready():
        try:
            return local_call(system, content, schema, max_tokens)
        except httpx.HTTPError as e:
            _mark_down(f"AI local lỗi: {str(e)[:150]}")
        except (ValueError, KeyError) as e:   # JSON hỏng / bị cắt: lượt này để Claude làm
            print(f"AI local trả kết quả không dùng được, chuyển sang Claude: {e}")
    return wiki.structured_call(system, content, schema, max_tokens=max_tokens, model=model, **kwargs)


def unload_llm() -> None:
    """Nhả model chữ (gemma) khỏi RAM ngay thay vì đợi Ollama tự nhả sau 5 phút — kb/ai_slot.py gọi khi rời bước
    dịch / tinh chế. Máy chủ không phải Ollama (MLX-LM) hay chưa chạy thì bỏ qua."""
    _cancel_unload(LOCAL_LLM_MODEL)
    _unload_model(LOCAL_LLM_MODEL)


def unload_all() -> None:
    """Nhả cả model chữ và embedding, dùng lúc máy chủ dừng."""
    for model, embedding in ((LOCAL_LLM_MODEL, False), (LOCAL_EMBED_MODEL, True)):
        _cancel_unload(model)
        _unload_model(model, embedding)


def embed(texts: list[str], timeout: float | None = None) -> list[list[float]]:
    """Embedding cho tìm theo nghĩa (bge-m3 mặc định). timeout: giây chờ (tìm kiếm cần trả lời nhanh)."""
    begin_use(LOCAL_EMBED_MODEL)
    try:
        res = httpx.post(f"{_base()}/v1/embeddings", json={"model": LOCAL_EMBED_MODEL, "input": texts},
                         timeout=httpx.Timeout(timeout) if timeout else TIMEOUT)
        res.raise_for_status()
        return [d["embedding"] for d in sorted(res.json()["data"], key=lambda d: d["index"])]
    finally:
        end_use(LOCAL_EMBED_MODEL, embedding=True)
