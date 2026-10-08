"""Sinh lại Phụ lục A "Thông số hệ thống" trong docs/BA.md từ code (backend/app/spec.py).

Chạy:  cd backend && ../.venv/bin/python scripts/sync_ba.py          # ghi lại phụ lục nếu lệch
       cd backend && ../.venv/bin/python scripts/sync_ba.py --check  # chỉ kiểm tra, lệch thì thoát mã 1
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import spec  # noqa: E402


def main() -> int:
    check = "--check" in sys.argv[1:]
    if spec.sync_ba(check=check):
        print("docs/BA.md: Phụ lục A đã khớp code")
        return 0
    if check:
        print("docs/BA.md: Phụ lục A lệch code — chạy: cd backend && ../.venv/bin/python scripts/sync_ba.py")
        return 1
    print("docs/BA.md: đã sinh lại Phụ lục A")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
