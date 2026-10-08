"""Claude Code CLI làm AI dự phòng khi chưa có ANTHROPIC_API_KEY / hết quota: chạy `claude -p` bằng tài khoản Claude
đăng nhập trên máy (như /chat). Mặc định việc thuần chữ chạy CLI trước, AI local chỉ đỡ khi CLI lỗi
(CLAUDE_CLI_FIRST=off: AI local trước, CLI chỉ nhận việc dài quá context local).

Chỉ nhận việc thuần chữ; trả JSON theo `schema` qua `--json-schema`. Mỗi lúc chạy một lượt để không dồn quota.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path

from ..config import CLAUDE_BIN, CLAUDE_CLI_FALLBACK, CLAUDE_CLI_FIRST, CLAUDE_CLI_TIMEOUT

_lock = threading.Lock()


def ready() -> bool:
    return CLAUDE_CLI_FALLBACK and (Path(CLAUDE_BIN).exists() or bool(shutil.which(CLAUDE_BIN)))


def first() -> bool:
    """Việc thuần chữ chạy CLI trước AI local."""
    return CLAUDE_CLI_FIRST and ready()


def cli_call(system: str, content: str, schema: dict, model: str | None = None) -> dict:
    """Gọi `claude -p`, trả JSON theo `schema` kèm `usage` (cùng dạng wiki.structured_call)."""
    with tempfile.TemporaryDirectory(prefix="kb-cli-") as tmp:   # thư mục trống: không nạp CLAUDE.md / hook của repo
        sys_file = Path(tmp) / "system.txt"
        sys_file.write_text(system, encoding="utf-8")
        cmd = [CLAUDE_BIN, "-p", "--output-format", "json", "--json-schema", json.dumps(schema, ensure_ascii=False),
               "--system-prompt-file", str(sys_file), "--tools", "", "--setting-sources", "project",
               "--no-session-persistence"]
        if model and model.startswith("claude-"):
            cmd += ["--model", model]
        with _lock:
            proc = subprocess.run(cmd, input=content, capture_output=True, text=True, cwd=tmp,
                                  timeout=CLAUDE_CLI_TIMEOUT)
    try:
        res = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude CLI lỗi: {(proc.stderr or proc.stdout)[:200]}") from e
    if res.get("is_error") or not isinstance(res.get("structured_output"), dict):
        raise ValueError(f"Claude CLI lỗi: {str(res.get('result') or res.get('subtype'))[:200]}")
    out = res["structured_output"]
    usage = res.get("usage") or {}
    by_model = res.get("modelUsage") or {}   # CLI dùng thêm Haiku cho việc phụ: model viết là model ra nhiều chữ nhất
    used = max(by_model, key=lambda m: by_model[m].get("outputTokens", 0), default=model or "claude")
    out["usage"] = {"input_tokens": usage.get("input_tokens", 0) + usage.get("cache_read_input_tokens", 0)
                    + usage.get("cache_creation_input_tokens", 0),
                    "output_tokens": usage.get("output_tokens", 0), "model": f"cli:{used}"}
    return out
