"""SYS-39 SCR-22.2: AI local đọc qua MCP, quyền kho và vòng lựa chọn công cụ."""
import asyncio
import json
from types import SimpleNamespace

import httpx
import pytest

from app import auth, chat_local, chat_local_tools as tools
from .conftest import make_user
from .test_org13_admin import setup  # noqa: F401 — dữ liệu kho riêng thật của fixture


def run():
    events = []
    return SimpleNamespace(cancelled=False, text="", tools=[], events=events, emit=events.append)


@pytest.fixture
def token():
    user = make_user("local-reader")
    value, document = auth.issue_api_token(user, "test-local")
    yield value, user
    auth.api_tokens.delete_one({"_id": document["_id"]})


def test_catalog_only_declared_read_tools():
    assert "read_guide" in tools.registry() and "get_card" in tools.registry()
    assert "create_card" not in tools.registry() and "delete_category" not in tools.registry()
    assert "ctx" not in tools.catalog() and "authorization" not in tools.catalog()


@pytest.mark.parametrize("name,arguments", [
    ("create_card", {}), ("delete_category", {}), ("find", {"collection": "users"}),
    ("get_card", {"ctx": "admin", "card_id": "123"}), ("whoami", {"token": "admin"}),
    ("whoami", []),
])
def test_changeless_gateway_blocks_write_and_forged_context(token, name, arguments):
    r = run()
    with pytest.raises(ValueError):
        asyncio.run(tools.call(r, name, arguments, token[0], "Hỏi"))
    assert r.tools == []


def test_invalid_parameters_report_tool_error(token):
    r = run()
    result = asyncio.run(tools.call(r, "get_card", {}, token[0], "Hỏi"))
    assert "error" in json.loads(result) and r.tools[0]["status"] == "error"


@pytest.mark.parametrize("owner", [False, True])
def test_get_card_uses_same_private_space_permission(client, setup, owner):
    user = setup["an"] if owner else setup["admin"]
    token, document = auth.issue_api_token(user, "test-local")
    try:
        r = run()
        result = asyncio.run(tools.call(r, "get_card", {"card_id": setup["cards"][0]}, token, "Đọc thẻ"))
        assert ("Bí mật riêng của An" in result) == owner
        assert r.tools[0]["status"] == ("done" if owner else "error")
    finally:
        auth.api_tokens.delete_one({"_id": document["_id"]})


def test_revoked_token_cannot_read(token):
    value, _ = token
    auth.api_tokens.delete_one({"_id": auth._token_hash(value)})
    result = asyncio.run(tools.call(run(), "whoami", {}, value, "Hỏi"))
    assert "Token không hợp lệ" in result


def test_video_question_reads_correct_guide_without_page(token):
    r = run()
    async def done(results):
        return {"tool": "", "arguments": {}}
    results = asyncio.run(tools.ground(r, token[1], "tao them vi deo vao de chuyen doi du lieu nhu the nao", None, done))
    assert r.tools[0]["name"] == "read_guide"
    assert r.tools[0]["input"] == {"section": "nap-tu-lieu"}
    assert "/guide#nap-tu-lieu" in results[0]["result"]
    assert "video" in results[0]["result"].lower()
    assert auth.api_tokens.count_documents({"internal": "chat"}) == 0


def test_loop_repetition_and_cleanup(token, monkeypatch):
    monkeypatch.setattr(tools, "guide_seed", lambda *a: None)
    r = run()
    async def repeated(results):
        return {"tool": "whoami", "arguments": {}}
    results = asyncio.run(tools.ground(r, token[1], "Tôi là ai", None, repeated))
    assert len(r.tools) == 1 and "lặp lại" in results[-1]["error"]
    assert auth.api_tokens.count_documents({"internal": "chat"}) == 0


def test_cancelled_plan_cleans_token(token):
    r = run()
    async def cancelled(results):
        raise asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(tools.ground(r, token[1], "Tìm video", None, cancelled))
    assert auth.api_tokens.count_documents({"internal": "chat"}) == 0


def test_tool_selection_then_streams_grounded_answer(token, monkeypatch):
    requests = []
    decisions = iter([{"tool": "list_spaces", "arguments": {}}, {"tool": "", "arguments": {}}])
    original = httpx.AsyncClient
    async def respond(request):
        body = json.loads(request.content)
        requests.append(body)
        if not body["stream"]:
            return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {
                "content": json.dumps(next(decisions))}}]})
        text = "Vào Kho tư liệu để thêm video. [Hướng dẫn](/guide#nap-tu-lieu)."
        stream = ('data: ' + json.dumps({"choices": [{"delta": {"content": text}, "finish_reason": "stop"}]})
                  + '\n\ndata: [DONE]\n\n')
        return httpx.Response(200, text=stream)
    monkeypatch.setattr(chat_local.httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(respond), **kw))
    r = run()
    result = chat_local.answer(r, token[1], "Thêm video để chuyển chữ như thế nào?", [], "/learn")
    assert [t["name"] for t in r.tools] == ["read_guide", "list_spaces"]
    assert "/guide#nap-tu-lieu" in result["text"]
    assert all(e["d"].startswith("Vào Kho") for e in r.events if e["t"] == "text")
    assert "nap-tu-lieu" in requests[-1]["messages"][0]["content"]
    assert auth.api_tokens.count_documents({"internal": "chat"}) == 0
    assert all(sum(chat_local._tokens(m["content"]) for m in b["messages"]) + b["max_tokens"] + 128
               <= chat_local.LOCAL_LLM_CTX for b in requests)


@pytest.mark.skipif(__import__('os').getenv('LOCAL_LIVE_TEST') != '1', reason='Chỉ chạy khi thử model Ollama thật')
def test_live_video_question_uses_public_guide(token):
    r = run()
    result = chat_local.answer(r, token[1], 'tao them vi deo vao de chuyen doi du lieu nhu the nao', [], '/learn')
    print('\nCÔNG CỤ:', [(t['name'], t['input']) for t in r.tools])
    print('TRẢ LỜI:', result['text'])
    assert '/guide#nap-tu-lieu' in result['text']
    assert 'không có thông tin' not in result['text'].lower()
    assert any(t['name'] == 'read_guide' and t['status'] == 'done' for t in r.tools)
    assert auth.api_tokens.count_documents({'internal': 'chat'}) == 0


def test_maximum_tool_rounds(token, monkeypatch):
    monkeypatch.setattr(tools, 'guide_seed', lambda *a: None)
    r = run()
    async def distinct(results):
        return {'tool': 'read_guide', 'arguments': {'query': f'câu hỏi {len(results)}'}}
    asyncio.run(tools.ground(r, token[1], 'Tìm hướng dẫn', None, distinct))
    assert len(r.tools) == tools.MAX_CALLS
    assert auth.api_tokens.count_documents({'internal': 'chat'}) == 0


def test_fit_rejects_question_when_catalog_exceeds_context(monkeypatch):
    monkeypatch.setattr(chat_local, 'LOCAL_LLM_CTX', 1000)
    body = {'messages': [{'role': 'system', 'content': 'S'}, {'role': 'user', 'content': 'Q' * 2000}], 'max_tokens': 250}
    with pytest.raises(ValueError, match='quá dài'):
        chat_local._fit(body, [], planning=True)


def test_cancel_planner_closes_http_and_revokes_token(token, monkeypatch):
    r = run()
    original = httpx.AsyncClient
    async def waiting(request):
        asyncio.get_running_loop().call_later(.03, setattr, r, 'cancelled', True)
        await asyncio.sleep(10)
        return httpx.Response(200, json={})
    monkeypatch.setattr(chat_local.httpx, 'AsyncClient', lambda **kw: original(transport=httpx.MockTransport(waiting), **kw))
    monkeypatch.setattr(chat_local, 'CANCEL_INTERVAL', .005)
    with pytest.raises(RuntimeError, match='Đã dừng'):
        chat_local.answer(r, token[1], 'Tìm video', [], None)
    assert auth.api_tokens.count_documents({'internal': 'chat'}) == 0


def test_document_compaction_prioritizes_speech_over_metadata():
    speech = "[01:29] Assign who executes and supervises.\n[04:37] Estimate budget."
    data = {"id": "doc", "title": "5W2H", "meta": {"noise": "X" * 7000},
            "text": "Caption " * 1000 + "\n## Lời nói\n" + speech,
            "next_offset": None, "total_chars": 7300}
    value = json.loads(tools.compact(json.dumps(data, ensure_ascii=False), "Tổng hợp nguồn", 2200))
    assert speech in value["text"]
    assert value["id"] == "doc" and value["next_offset"] is None
    assert "meta" not in value
    assert tools.guide_seed("Tổng hợp nguồn 5W2H trên youtube", "/kb") is None
