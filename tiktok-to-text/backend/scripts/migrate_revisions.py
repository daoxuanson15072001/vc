#!/usr/bin/env python3
"""Chuyển thẻ VCWIKI cũ thành phiên bản 1 (GOV-01 — docs/BA.md mục 16.5 quy tắc 4). Chạy một lần.

Mọi thẻ chưa có `current_revision` được ghi bản 1 vào `card_revisions` (tác giả = người tạo thẻ, lý do
"Phiên bản đầu (chuyển dữ liệu v0.10)"). Cờ `meta._id = "gov_revisions_v1"`; chạy lại không tạo trùng.
App cũng tự gọi lúc khởi động (khối GOV trong app/main.py). Logic nằm ở `app.kb.revisions.migrate_existing`.

    cd backend && ../.venv/bin/python scripts/migrate_revisions.py           # bỏ qua nếu đã chạy
    cd backend && ../.venv/bin/python scripts/migrate_revisions.py --force   # quét lại thẻ chưa có phiên bản
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.kb import revisions  # noqa: E402


def run(force: bool = False) -> dict | None:
    return revisions.migrate_existing(force=force)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--force", action="store_true", help="Chạy lại dù cờ đã đặt (thẻ tạo sau lần chuyển trước)")
    args = p.parse_args()
    res = run(force=args.force)
    if res is None:
        print(f"Đã chuyển trước đó (cờ meta {revisions.MIGRATION_FLAG}). Dùng --force để quét lại.")
    else:
        print(f"Đã tạo phiên bản 1 cho {res['cards']} thẻ.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
