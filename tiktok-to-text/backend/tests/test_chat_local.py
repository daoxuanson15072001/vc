"""SYS-38 / SCR-22.1: luồng HTTP local, dừng và ngân sách lịch sử; không gọi model thật."""

import asyncio
import json
import time
from types import SimpleNamespace

import httpx
import pytest

from app import chat_local


@pytest.fixture(autouse=True)
def isolate_stream(monkeypatch):
    async def empty_ground(*args, **kwargs):
        return []
    monkeypatch.setattr(chat_local.chat_local_tools, "ground", empty_ground)


def make_run():
    events = []
    return SimpleNamespace(cancelled=False, text="", events=events, emit=events.append)


def event(text=None, finish=None, **extra):
    data = {"choices": [{"index": 0, "delta": {"content": text}, "finish_reason": finish}], **extra}
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode()


class Chunks(httpx.AsyncByteStream):
    def __init__(self, chunks):
        self.chunks = chunks
        self.closed = False

    async def __aiter__(self):
        for chunk in self.chunks:
            yield chunk

    async def aclose(self):
        self.closed = True


@pytest.fixture
def transport(monkeypatch):
    original = httpx.AsyncClient
    requests = []

    def install(stream, status=200, on_request=None):
        async def handle(request):
            requests.append(request)
            if on_request:
                on_request()
            return httpx.Response(status, stream=stream)

        mock = httpx.MockTransport(handle)
        monkeypatch.setattr(chat_local.httpx, "AsyncClient", lambda **kwargs: original(transport=mock, **kwargs))
        return requests

    return install


def test_stream_text_and_usage(transport):
    run = make_run()
    stream = Chunks([b": keepalive\n\n", event("Chào "), event("bạn"), event(finish="stop"),
                     b'data: {"choices":[],"usage":{"prompt_tokens":80,"completion_tokens":3}}\n\n',
                     b"data: [DONE]\n\n"])
    requests = transport(stream)
    result = chat_local.answer(run, {"name": "An"}, "Chào", [], None)
    assert run.text == result["text"] == "Chào bạn"
    assert run.events == [{"t": "text", "d": "Chào "}, {"t": "text", "d": "bạn"}]
    assert result["model"] == f"local:{chat_local.LOCAL_LLM_MODEL}"
    assert result["cost_usd"] == 0 and result["usage"]["input_tokens"] == 80
    body = json.loads(requests[0].content)
    assert requests[0].url.path == "/v1/chat/completions"
    assert body["stream"] and body["stream_options"] == {"include_usage": True}
    assert "tools" not in body and "response_format" not in body
    assert stream.closed


@pytest.mark.parametrize("chunks,match", [
    ([event("Dở dang")], "bị ngắt"),
    ([event("Dở dang"), event(finish="stop")], "bị ngắt"),
    ([event("Dở dang"), b"data: [DONE]\n\n"], "bị ngắt"),
    ([event(finish="stop"), b"data: [DONE]\n\n"], "không trả nội dung"),
    ([event("Bị cắt", finish="length")], "bị cắt"),
    ([b"data: hong-json\n\n"], "không hợp lệ"),
    ([b"data: \n\n"], "không hợp lệ"),
    ([b"data: {}\n\n"], "bị ngắt"),
    (['data: {"error":{"message":"model không còn"}}\n\n'.encode()], "model không còn"),
    ([b'data: {"choices":[{"delta":{"tool_calls":[{}]}}]}\n\n'], "công cụ"),
])
def test_invalid_or_incomplete_stream_is_error(transport, chunks, match):
    stream = Chunks(chunks)
    transport(stream)
    with pytest.raises(ValueError, match=match):
        chat_local.answer(make_run(), {}, "Hỏi", [], None)
    assert stream.closed


def test_http_error_is_not_empty_success(transport):
    transport(Chunks([b"Model chua tai"]), status=404)
    with pytest.raises(httpx.HTTPStatusError):
        chat_local.answer(make_run(), {}, "Hỏi", [], None)


@pytest.mark.parametrize("partial", [False, True])
def test_cancel_closes_request_even_without_next_token(monkeypatch, transport, partial):
    run = make_run()

    class Waiting(Chunks):
        async def __aiter__(self):
            if partial:
                yield event("Đã viết")
            await asyncio.sleep(10)
            yield event(finish="stop")

    stream = Waiting([])
    monkeypatch.setattr(chat_local, "CANCEL_INTERVAL", 0.005)
    transport(stream, on_request=lambda: asyncio.get_running_loop().call_later(0.03, setattr, run, "cancelled", True))
    started = time.monotonic()
    with pytest.raises(RuntimeError, match="Đã dừng"):
        chat_local.answer(run, {}, "Hỏi", [], None)
    assert time.monotonic() - started < 1
    assert stream.closed
    assert run.text == ("Đã viết" if partial else "")


def test_total_timeout_closes_request(monkeypatch, transport):
    class Waiting(Chunks):
        async def __aiter__(self):
            await asyncio.sleep(10)
            yield event("Quá muộn")

    stream = Waiting([])
    transport(stream)
    monkeypatch.setattr(chat_local, "CHAT_TIMEOUT", 0.03)
    started = time.monotonic()
    with pytest.raises(RuntimeError, match="quá thời gian"):
        chat_local.answer(make_run(), {}, "Hỏi", [], None)
    assert time.monotonic() - started < 1
    assert stream.closed


def test_cancel_before_request_does_not_open_client(monkeypatch):
    run = make_run()
    run.cancelled = True
    monkeypatch.setattr(chat_local.httpx, "AsyncClient", lambda **kw: pytest.fail("không được gọi local sau dừng"))
    with pytest.raises(RuntimeError, match="Đã dừng"):
        chat_local.answer(run, {}, "Hỏi", [], None)


def test_history_keeps_recent_complete_pairs_within_budget(monkeypatch):
    monkeypatch.setattr(chat_local, "LOCAL_LLM_CTX", 2000)
    history = [{"role": "assistant", "content": "lẻ"},
               {"role": "user", "content": "cũ" * 3000}, {"role": "assistant", "content": "cũ"},
               {"role": "user", "content": "câu trước"}, {"role": "assistant", "content": "đáp trước"},
               {"role": "user", "content": "chưa có đáp"}]
    body = chat_local._request({}, "câu hiện tại", history, None)
    assert [(row["role"], row["content"]) for row in body["messages"][1:]] == [
        ("user", "câu trước"), ("assistant", "đáp trước"), ("user", "câu hiện tại")]
    assert sum(chat_local._tokens(row["content"]) for row in body["messages"]) + body["max_tokens"] + 128 <= 2000
    assert body["max_tokens"] == 500


def test_current_question_is_never_silently_truncated():
    with pytest.raises(ValueError, match="Câu hỏi quá dài"):
        chat_local._request({}, "x" * (chat_local.LOCAL_LLM_CTX * 3), [], None)


def test_context_restored_and_guide_excerpt_bounded(monkeypatch):
    seen = []
    monkeypatch.setattr(chat_local.guide, "sections", lambda: [{"id": "tim-doc", "title": "Tìm đọc", "body": "a" * 5000}])
    monkeypatch.setattr(chat_local.guide, "for_path", lambda context: seen.append(context) or [{"id": "tim-doc", "title": "Tìm đọc"}])
    history = [{"role": "user", "content": "Tóm tắt", "context": "/wiki?card=123 (Tên thẻ)"},
               {"role": "assistant", "content": "Chưa có nội dung"}]
    body = chat_local._request({}, "Trang này dùng thế nào?", history, None)
    system = body["messages"][0]["content"]
    assert seen == ["/wiki?card=123"]
    assert "/wiki?card=123 (Tên thẻ)" in system
    excerpt = system[system.index("\n\n<HƯỚNG_DẪN_CÔNG_KHAI>"):]
    assert len(excerpt) <= chat_local.GUIDE_CHARS
    assert "Trích đoạn" in excerpt and "/guide#tim-doc" in excerpt
    assert "công cụ đọc dữ liệu" in system and "chưa tạo, sửa, duyệt hoặc xoá" in system
    assert sum(chat_local._tokens(row["content"]) for row in body["messages"]) + body["max_tokens"] + 128 <= chat_local.LOCAL_LLM_CTX


def test_prompt_tokens_detect_local_context_truncation(transport):
    transport(Chunks([event("Đã bị cắt đầu vào"), event(finish="stop", usage={
        "prompt_tokens": chat_local.LOCAL_LLM_CTX, "completion_tokens": 10}), b"data: [DONE]\n\n"]))
    with pytest.raises(ValueError, match="ngữ cảnh"):
        chat_local.answer(make_run(), {}, "Hỏi", [], None)
