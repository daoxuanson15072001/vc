"""Nợ kỹ thuật #14 (DESIGN Phần I mục 13): biến môi trường chỉ đọc ở app/config.py.

Ngoại lệ có chủ ý: chép os.environ để truyền cho tiến trình con (chat.py → claude CLI, kb/adapters/ocr.py → tesseract).
"""

import re
from pathlib import Path

from app import config

APP = Path(__file__).resolve().parents[1] / "app"
READ = re.compile(r"\bos\.(getenv|environ)\b")
ALLOWED = {
    "config.py": None,                                        # nơi đọc duy nhất
    "chat.py": "os.environ.items()",                          # môi trường cho claude CLI (lọc CLAUDECODE*)
    "kb/adapters/ocr.py": 'os.environ | {"TESSDATA_PREFIX"',  # môi trường cho tesseract
}


def test_chi_config_doc_bien_moi_truong():
    lech = []
    for f in sorted(APP.rglob("*.py")):
        rel = f.relative_to(APP).as_posix()
        for no, line in enumerate(f.read_text().splitlines(), 1):
            if not READ.search(line):
                continue
            if rel in ALLOWED and (ALLOWED[rel] is None or ALLOWED[rel] in line):
                continue
            lech.append(f"{rel}:{no}: {line.strip()}")
    assert not lech, "Đọc biến môi trường ngoài app/config.py — chuyển vào config:\n" + "\n".join(lech)


def test_mac_dinh_khong_doi(monkeypatch):
    # vài giá trị mặc định tiêu biểu giữ nguyên sau khi gom (conftest đặt CLAUDE_CLI_FALLBACK=off cho test)
    assert config.CARD_UPDATE_AT == "07:45"
    assert config.CHAT_ACCESS == "all" and config.CHAT_MAX_PARALLEL == 2 and config.CHAT_TIMEOUT == 900
    assert config.RERANK_TIMEOUT == 2.5 and config.RERANK_TOPN == 30
    assert config.QDRANT_URL == "http://127.0.0.1:6333" and config.RAW_RERANK_DOCS == 10
    assert config.CLAUDE_CLI_FALLBACK is False and config.CLAUDE_CLI_FIRST is True
    # hàm đọc lúc gọi
    monkeypatch.setenv("MCP_ALLOWED_HOSTS", " a.vn, ,b.vn")
    assert config.mcp_allowed_hosts() == ["a.vn", "b.vn"]
    monkeypatch.setenv("LEARN_AI_FAKE", "1")
    assert config.learn_ai_fake()
