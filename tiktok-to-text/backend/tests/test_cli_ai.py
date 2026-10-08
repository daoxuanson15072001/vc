"""Claude Code CLI làm AI dự phòng khi chưa có ANTHROPIC_API_KEY (kb/cli_ai.py, wiki._fallback)."""

import pytest

from app.kb import cli_ai, local_ai, wiki

SCHEMA = {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]}


@pytest.fixture
def cli(monkeypatch):
    calls = []

    def fake(system, content, schema, model=None):
        calls.append((system, content, model))
        return {"text": "cli", "usage": {"input_tokens": 1, "output_tokens": 1, "model": "cli:claude-opus-5"}}

    monkeypatch.setattr(cli_ai, "ready", lambda: True)
    monkeypatch.setattr(cli_ai, "cli_call", fake)
    return calls


def test_long_job_goes_to_cli_instead_of_waiting(cli, monkeypatch):
    monkeypatch.setattr(cli_ai, "CLAUDE_CLI_FIRST", False)
    monkeypatch.setattr(local_ai, "ready", lambda: True)
    monkeypatch.setattr(local_ai, "local_call", lambda *a, **k: pytest.fail("việc dài không được đưa sang AI local"))
    out = wiki.structured_call("sys", "x" * (wiki.LOCAL_LLM_CTX * 3), SCHEMA, model="claude-opus-5")
    assert out["text"] == "cli" and cli[0][2] == "claude-opus-5"


def test_cli_first_for_short_job(cli, monkeypatch):
    monkeypatch.setattr(local_ai, "ready", lambda: True)
    monkeypatch.setattr(local_ai, "local_call", lambda *a, **k: pytest.fail("CLI chạy trước AI local"))
    assert wiki.structured_call("sys", "ngắn", SCHEMA)["text"] == "cli"
    assert wiki.ai_status()["cli"] == {"ready": True, "first": True}


def test_cli_error_falls_back_to_local(monkeypatch):
    monkeypatch.setattr(cli_ai, "ready", lambda: True)
    monkeypatch.setattr(cli_ai, "cli_call", lambda *a, **k: (_ for _ in ()).throw(ValueError("hết lượt")))
    monkeypatch.setattr(local_ai, "ready", lambda: True)
    monkeypatch.setattr(local_ai, "local_call", lambda *a, **k: {"text": "local", "usage": {"input_tokens": 5}})
    assert wiki.structured_call("sys", "ngắn", SCHEMA)["text"] == "local"


def test_cli_first_off_keeps_short_job_local(cli, monkeypatch):
    monkeypatch.setattr(cli_ai, "CLAUDE_CLI_FIRST", False)
    monkeypatch.setattr(local_ai, "ready", lambda: True)
    monkeypatch.setattr(local_ai, "local_call", lambda *a, **k: {"text": "local", "usage": {"input_tokens": 5}})
    assert wiki.structured_call("sys", "ngắn", SCHEMA)["text"] == "local" and not cli


def test_cli_when_local_down(cli, monkeypatch):
    monkeypatch.setattr(local_ai, "ready", lambda: False)
    assert wiki.ai_ready()
    assert wiki.structured_call("sys", "ngắn", SCHEMA)["text"] == "cli"


def test_cli_error_retries_later(monkeypatch):
    monkeypatch.setattr(local_ai, "ready", lambda: False)
    monkeypatch.setattr(cli_ai, "ready", lambda: True)

    def boom(*a, **k):
        raise ValueError("hết lượt")

    monkeypatch.setattr(cli_ai, "cli_call", boom)
    calls = []
    monkeypatch.setattr(cli_ai, "cli_call", lambda *a, **k: calls.append(1) or boom())
    with pytest.raises(wiki.AIRetryLater, match="Claude CLI lỗi"):
        wiki.structured_call("sys", "ngắn", SCHEMA)
    assert len(calls) == 1   # CLI lỗi một lần là đủ, không gọi lại ở nhánh AI local chưa sẵn sàng


def test_images_still_wait_for_api(cli, monkeypatch):
    content = [{"type": "image", "source": {}}, {"type": "text", "text": "a"}]
    with pytest.raises(wiki.AIRetryLater, match="ảnh"):
        wiki.structured_call("sys", content, SCHEMA)
    assert not cli
