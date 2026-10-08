"""SYS-38 / SCR-22.1: CLI lỗi → Ollama trong cùng lượt trò chuyện, giữ quyền và lịch sử."""

from __future__ import annotations

import io
import json
import subprocess
import threading
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app import auth, chat, chat_local, db
from app.kb import ai_slot, local_ai

from .conftest import make_user


class QuietTimer:
    """Không đợi timeout CLI hoặc lịch dọn lượt 60 giây trong test."""

    def __init__(self, *args, **kwargs):
        self.cancelled = False

    def start(self):
        pass

    def cancel(self):
        self.cancelled = True


@pytest.fixture
def setup_chat(monkeypatch, tmp_path):
    monkeypatch.setattr(chat, "AI_FALLBACK", "local")
    monkeypatch.setattr(chat, "CHAT_ACCESS", "admin")
    monkeypatch.setattr(chat, "SANDBOX", tmp_path)
    monkeypatch.setattr(chat, "_slots", nullcontext())
    monkeypatch.setattr(chat, "_runs", {})
    monkeypatch.setattr(chat, "threading", SimpleNamespace(
        Timer=QuietTimer, Thread=threading.Thread, Lock=threading.Lock,
    ))
    monkeypatch.setattr(chat, "_cli_ready", lambda: True)
    local_status = Mock(return_value={"ready": True, "model": "gemma-test", "error": None})
    monkeypatch.setattr(local_ai, "status", local_status)
    hold = Mock(side_effect=lambda *args, **kwargs: nullcontext())
    monkeypatch.setattr(ai_slot, "hold", hold)

    def answer(run, user, prompt, history, context):
        run.text += "Câu trả lời local"
        run.emit({"t": "text", "d": "Câu trả lời local"})
        return {"model": "local:gemma-test", "usage": {"input_tokens": 8, "output_tokens": 5}}

    local_answer = Mock(side_effect=answer)
    monkeypatch.setattr(chat_local, "answer", local_answer)
    cli = Mock(return_value={"is_error": True, "error": "Claude hết quota", "cost_usd": 0.03})
    monkeypatch.setattr(chat, "_run_cli", cli)
    user = make_user("quan-tri-chat", role="admin")
    now = db.now()
    thread = {"user_id": user["_id"], "title": "Kiểm tra dự phòng", "message_count": 0,
              "cost_usd": 0, "claude_session_id": "phien-cu", "created_at": now, "updated_at": now}
    thread["_id"] = chat.threads.insert_one(thread).inserted_id
    return SimpleNamespace(user=user, thread=thread, local=local_answer, cli=cli,
                           status=local_status, hold=hold, sandbox=tmp_path)


def new_turn(setup, text="Câu hỏi hiện tại", context=None):
    # Cùng mốc giờ để kiểm ranh giới lịch sử bằng ObjectId, kể cả Mongo chỉ giữ mili giây.
    now = setup.thread["created_at"]
    base = {"thread_id": setup.thread["_id"], "user_id": setup.user["_id"], "created_at": now}
    chat.messages.insert_one(base | {"role": "user", "content": text, "context": context, "status": "done"})
    mid = chat.messages.insert_one(base | {"role": "assistant", "content": "", "tools": [], "status": "queued"}).inserted_id
    return chat.Run(mid)


def execute(setup, run, prompt="Câu hỏi hiện tại"):
    thread = chat.threads.find_one({"_id": setup.thread["_id"]})
    chat.execute(run, thread, setup.user, prompt, "http://127.0.0.1:8000/mcp")
    return chat.messages.find_one({"_id": run.msg_id})


def assert_cleaned(setup):
    assert auth.api_tokens.count_documents({"internal": "chat"}) == 0
    assert not list(setup.sandbox.glob("mcp-*.json"))


@pytest.mark.parametrize("failure", ["missing", "os_error", "timeout", "is_error"])
def test_cli_khong_hoat_dong_chuyen_local_trong_cung_luot(setup_chat, monkeypatch, failure):
    s = setup_chat
    run = new_turn(s)
    if failure == "missing":
        monkeypatch.setattr(chat, "_cli_ready", lambda: False)
    elif failure == "os_error":
        s.cli.side_effect = OSError("Không chạy được Claude")
    elif failure == "timeout":
        s.cli.side_effect = subprocess.TimeoutExpired("claude", 60)
    message = execute(s, run)
    assert message["status"] == "done" and message["error"] is None
    assert message["content"] == "Câu trả lời local" and message["model"] == "local:gemma-test"
    assert message["usage"]["input_tokens"] == 8
    assert message["cost_usd"] == (0.03 if failure == "is_error" else 0)
    assert chat.messages.count_documents({"thread_id": s.thread["_id"]}) == 2
    s.local.assert_called_once()
    s.hold.assert_called_once()
    assert s.hold.call_args.args == ("tinh_che", "Trò chuyện bằng AI local")
    assert not s.hold.call_args.kwargs["cancelled"]()
    s.status.assert_called_once_with(fresh=True)
    assert s.cli.call_count == (0 if failure == "missing" else 1)
    assert chat.threads.find_one({"_id": s.thread["_id"]})["claude_session_id"] is None
    assert [e["t"] for e in run.events][-1] == "done" and run.done
    assert any(e.get("model") == "local:gemma-test" and "chuyển sang AI local" in e["note"] for e in run.events)
    assert_cleaned(s)


def test_cli_thanh_cong_khong_goi_local_va_don_token(setup_chat):
    s = setup_chat

    def cli_ok(*args):
        assert auth.api_tokens.count_documents({"internal": "chat"}) == 1
        assert len(list(s.sandbox.glob("mcp-*.json"))) == 1
        return {"text": "Câu trả lời Claude", "model": "claude-test", "session_id": "phien-moi", "cost_usd": 0.02}

    s.cli.side_effect = cli_ok
    message = execute(s, new_turn(s))
    assert message["status"] == "done" and message["content"] == "Câu trả lời Claude"
    assert message["model"] == "claude-test"
    assert chat.threads.find_one({"_id": s.thread["_id"]})["claude_session_id"] == "phien-moi"
    s.local.assert_not_called()
    s.status.assert_not_called()
    assert_cleaned(s)


def test_tat_du_phong_giu_loi_cli(setup_chat, monkeypatch):
    s = setup_chat
    monkeypatch.setattr(chat, "AI_FALLBACK", "off")
    message = execute(s, new_turn(s))
    assert message["status"] == "error" and message["error"] == "Claude hết quota"
    s.local.assert_not_called()
    s.status.assert_not_called()
    assert_cleaned(s)


@pytest.mark.parametrize("unavailable", [True, False])
def test_local_chua_san_sang_hoac_loi_khong_goi_lai_cli(setup_chat, unavailable):
    s = setup_chat
    if unavailable:
        s.status.return_value.update(ready=False, error="Chưa tải model")
    else:
        s.local.side_effect = ValueError("Luồng local bị ngắt")
    message = execute(s, new_turn(s))
    assert message["status"] == "error" and "Claude hết quota" in message["error"]
    assert ("Chưa tải model" if unavailable else "Luồng local bị ngắt") in message["error"]
    assert s.local.call_count == (0 if unavailable else 1)
    assert s.cli.call_count == 1
    assert_cleaned(s)


@pytest.mark.parametrize("when", ["queued", "cli", "waiting_local"])
def test_da_dung_khong_khoi_chay_local(setup_chat, when):
    s = setup_chat
    run = new_turn(s)
    if when == "queued":
        run.cancelled = True
    elif when == "cli":
        def cancelled_cli(*args):
            run.cancelled = True
            return {"is_error": True, "error": "CLI bị dừng"}
        s.cli.side_effect = cancelled_cli
    else:
        class CancelWhileWaiting:
            def __enter__(self):
                run.cancelled = True
            def __exit__(self, *args):
                return False
        s.hold.side_effect = lambda *args, **kwargs: CancelWhileWaiting()
    message = execute(s, run)
    assert message["status"] == "error" and message["error"] == "Đã dừng"
    s.local.assert_not_called()
    assert s.cli.call_count == (0 if when == "queued" else 1)
    assert_cleaned(s)


@pytest.mark.parametrize("tool_status", ["running", "done", "error"])
def test_da_goi_cong_cu_khong_tu_lam_lai_bang_local(setup_chat, tool_status):
    s = setup_chat
    run = new_turn(s)

    def cli_with_tool(*args):
        run.tools.append({"id": "tool-1", "name": "create_card", "input": {}, "status": tool_status})
        return {"is_error": True, "error": "CLI lỗi sau công cụ"}

    s.cli.side_effect = cli_with_tool
    message = execute(s, run)
    assert message["status"] == "error" and message["error"] == "CLI lỗi sau công cụ"
    assert message["tools"][0]["status"] == ("error" if tool_status == "running" else tool_status)
    s.local.assert_not_called()
    s.status.assert_not_called()
    assert_cleaned(s)


def test_xoa_chu_cli_do_truoc_khi_phat_chu_local(setup_chat):
    s = setup_chat
    run = new_turn(s)

    def partial_cli(*args):
        run.text = "Chữ Claude còn dở"
        run.emit({"t": "text", "d": run.text})
        return {"is_error": True, "error": "CLI mất kết nối"}

    s.cli.side_effect = partial_cli
    message = execute(s, run)
    assert message["content"] == "Câu trả lời local"
    kinds = [e["t"] for e in run.events]
    reset_at = kinds.index("reset")
    assert run.events[reset_at - 1] == {"t": "text", "d": "Chữ Claude còn dở"}
    assert run.events[reset_at + 2] == {"t": "text", "d": "Câu trả lời local"}
    assert run.events[-1]["message"]["content"] == "Câu trả lời local"


def test_cli_local_cli_giu_lich_su_khong_lap_cau_hien_tai(setup_chat):
    s = setup_chat
    s.cli.return_value = {"text": "Trả lời một", "session_id": "phien-mot", "model": "claude-test"}
    execute(s, new_turn(s, "Câu một", "/wiki"), "Câu một")
    s.cli.return_value = {"is_error": True, "error": "Claude hết quota"}
    execute(s, new_turn(s, "Câu hai"), "Câu hai")
    local_call = s.local.call_args.args
    assert local_call[2] == "Câu hai"
    assert [m["content"] for m in local_call[3]] == ["Câu một", "Trả lời một"]
    assert local_call[4] == "/wiki"
    assert chat.threads.find_one({"_id": s.thread["_id"]})["claude_session_id"] is None

    s.cli.return_value = {"text": "Trả lời ba", "session_id": "phien-ba", "model": "claude-test"}
    execute(s, new_turn(s, "Câu ba"), "Câu ba")
    cmd, prompt = s.cli.call_args.args[1:]
    assert "--resume" not in cmd
    for text in ("Câu một", "Trả lời một", "Câu hai", "Câu trả lời local", "Câu ba"):
        assert prompt.count(text) == 1, prompt
    assert chat.threads.find_one({"_id": s.thread["_id"]})["claude_session_id"] == "phien-ba"
    assert s.local.call_count == 1
    assert_cleaned(s)


def test_mat_phien_cli_thu_lai_voi_lich_su_roi_moi_local(setup_chat):
    s = setup_chat
    run = new_turn(s)
    s.cli.side_effect = [
        {"resume_failed": True, "is_error": True, "error": "Không tìm thấy phiên Claude"},
        {"is_error": True, "error": "Claude hết quota"},
    ]
    message = execute(s, run)
    assert message["status"] == "done"
    assert "--resume" in s.cli.call_args_list[0].args[1]
    assert "--resume" not in s.cli.call_args_list[1].args[1]
    assert s.cli.call_args_list[1].args[2].count("Câu hỏi hiện tại") == 1
    s.local.assert_called_once()
    assert_cleaned(s)


def test_loi_cap_token_khong_chuyen_local(setup_chat, monkeypatch):
    s = setup_chat
    monkeypatch.setattr(auth, "issue_api_token", Mock(side_effect=PermissionError("Không được cấp quyền MCP")))
    message = execute(s, new_turn(s))
    assert message["status"] == "error" and message["error"] == "Không được cấp quyền MCP"
    s.cli.assert_not_called()
    s.local.assert_not_called()


def test_api_thieu_cli_local_san_sang_nhan_tin_nhung_giu_quyen(setup_chat, monkeypatch, client):
    s = setup_chat
    monkeypatch.setattr(chat, "_cli_ready", lambda: False)
    worker = Mock()
    monkeypatch.setattr(chat.threading, "Thread", worker)
    client.login(s.user)
    status = client.get("/api/chat/status")
    assert status.status_code == 200
    assert status.json()["available"] and not status.json()["cli"]
    assert status.json()["local"]["ready"] and status.json()["fallback"]
    url = f"/api/chat/threads/{s.thread['_id']}/messages"
    sent = client.post(url, json={"text": "Xin hướng dẫn"})
    assert sent.status_code == 201, sent.text
    assert sent.json()["assistant_message"]["status"] == "queued"
    worker.return_value.start.assert_called_once()

    other_admin = make_user("quan-tri-khac", role="admin")
    client.login(other_admin)
    assert client.get(f"/api/chat/threads/{s.thread['_id']}").status_code == 404
    assert client.post(url, json={"text": "Không được gửi hộ"}).status_code == 404

    member = make_user("thanh-vien-chat")
    client.login(member)
    status = client.get("/api/chat/status").json()
    assert not status["available"] and not status["allowed"]
    assert client.post("/api/chat/threads", json={}).status_code == 403
    assert client.post(url, json={"text": "Không được chat"}).status_code == 403
    assert chat.messages.count_documents({"thread_id": s.thread["_id"]}) == 2


@pytest.mark.parametrize("fallback_off", [True, False])
def test_api_khong_co_engine_tu_choi_truoc_khi_tao_tin(setup_chat, monkeypatch, client, fallback_off):
    s = setup_chat
    monkeypatch.setattr(chat, "_cli_ready", lambda: False)
    if fallback_off:
        monkeypatch.setattr(chat, "AI_FALLBACK", "off")
    else:
        s.status.return_value.update(ready=False, error="Ollama chưa chạy")
    client.login(s.user)
    assert not client.get("/api/chat/status").json()["available"]
    response = client.post(f"/api/chat/threads/{s.thread['_id']}/messages", json={"text": "Câu hỏi"})
    assert response.status_code == 503
    assert chat.messages.count_documents({}) == 0
    s.local.assert_not_called()


class FakeProcess:
    def __init__(self, events, returncode=0, stderr=""):
        self.stdin = io.StringIO()
        self.stdout = io.StringIO("\n".join(json.dumps(e) for e in events))
        self.stderr = io.StringIO(stderr)
        self.returncode = returncode
        self.kill = Mock()

    def wait(self):
        return self.returncode

    def poll(self):
        return self.returncode


@pytest.mark.parametrize("events,code,error_part", [
    ([], 0, "không trả kết quả hoàn chỉnh"),
    ([{"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Dở"}}}], 0, "không trả kết quả hoàn chỉnh"),
    ([{"type": "result", "result": "  "}], 0, "không trả kết quả hoàn chỉnh"),
    ([{"type": "result", "result": "Có chữ"}], -9, "đã dừng"),
])
def test_cli_exit_thanh_cong_van_can_ket_qua_day_du(monkeypatch, tmp_path, events, code, error_part):
    monkeypatch.setattr(chat, "SANDBOX", tmp_path)
    monkeypatch.setattr(chat, "threading", SimpleNamespace(Timer=QuietTimer, Thread=threading.Thread, Lock=threading.Lock))
    proc = FakeProcess(events, returncode=code)
    monkeypatch.setattr(chat.subprocess, "Popen", Mock(return_value=proc))
    run = chat.Run(None)
    result = chat._run_cli(run, ["claude-gia"], "Câu hỏi")
    assert result["is_error"] and error_part in result["error"]
    assert run.proc is None
    assert all(pipe.closed for pipe in (proc.stdin, proc.stdout, proc.stderr))


def test_cli_doc_ket_qua_cuoi_va_chi_phi(monkeypatch, tmp_path):
    monkeypatch.setattr(chat, "SANDBOX", tmp_path)
    monkeypatch.setattr(chat, "threading", SimpleNamespace(Timer=QuietTimer, Thread=threading.Thread, Lock=threading.Lock))
    proc = FakeProcess([
        {"type": "system", "subtype": "init", "session_id": "phien-khoi-dau", "model": "claude-test"},
        {"type": "result", "result": "Câu trả lời", "session_id": "phien-ket-thuc", "total_cost_usd": 0.04},
    ])
    monkeypatch.setattr(chat.subprocess, "Popen", Mock(return_value=proc))
    result = chat._run_cli(chat.Run(None), ["claude-gia"], "Câu hỏi")
    assert not result["is_error"]
    assert result["session_id"] == "phien-ket-thuc" and result["model"] == "claude-test"
    assert result["text"] == "Câu trả lời" and result["cost_usd"] == 0.04
