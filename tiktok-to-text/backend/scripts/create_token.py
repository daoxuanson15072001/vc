#!/usr/bin/env python3
"""Tạo token cho AI kết nối cổng MCP (http://localhost:8000/mcp) thay cho một người dùng.

    cd backend && ../.venv/bin/python scripts/create_token.py email@vcprosperous.com "Claude Desktop"

Token chỉ hiện một lần. Thu hồi ở trang "Kết nối AI" trên web.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import auth  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("email")
    p.add_argument("name", nargs="?", default="AI", help="Tên gợi nhớ, vd Claude Desktop")
    args = p.parse_args()
    auth.ensure_indexes()

    user = auth.users.find_one({"email": args.email.strip().lower(), "active": True})
    if not user:
        print(f"Không tìm thấy tài khoản đang hoạt động: {args.email}")
        return 1
    token, _ = auth.issue_api_token(user, args.name)
    print(f"Token cho {user['email']} ({args.name}):\n\n  {token}\n\nLưu lại ngay — token không hiện lại lần nữa.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
