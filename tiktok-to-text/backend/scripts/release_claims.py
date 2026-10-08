#!/usr/bin/env python3
"""Trả về hàng "Chờ AI" các tài liệu mà Claude (qua MCP claim_documents) đã nhận nhưng chưa làm xong.

    cd backend && ../.venv/bin/python scripts/release_claims.py

ai_refine.sh gọi script này khi Claude hết quota, để máy chủ làm tiếp các tài liệu đó (Claude API / AI local).
Tài liệu làm dở (đã có thẻ) được để dành cho Claude làm tiếp trước, máy chủ chỉ lấy sau 6 giờ.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.mcp_server import release_claims  # noqa: E402


def main() -> int:
    print(release_claims({}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
