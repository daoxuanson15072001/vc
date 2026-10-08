"""LV-01: chạy thử giải tán cây cũ; --apply chỉ ghi QA / UAT; --undo NHAT_KY quay lui.

Chạy từ backend, ví dụ:
 MONGO_DB=tiktok_to_text_qa ../../.venv/bin/python scripts/retire_old_tree.py
 Thêm --apply để chuyển; --undo <nhật-ký> để kiểm quay lui, thêm --apply mới phục hồi.
Dừng worker và việc sửa cây khi vận hành. Không chạy chuyển dữ liệu thật.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db  # noqa: E402
from app.kb import retire_tree  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "output"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Chuyển cây cũ có nhật ký, quay lui kiểm xung đột")
    parser.add_argument("--apply", action="store_true", help="Ghi trên DB QA / UAT")
    parser.add_argument("--undo", type=Path, help="Nhật ký cần phục hồi (mặc định chỉ kiểm)")
    args = parser.parse_args(argv)
    journal = OUT / f"retire_old_tree_{db.db.name}_{datetime.now():%Y%m%d_%H%M%S}_{uuid4().hex[:8]}.json"
    try:
        if args.apply:
            retire_tree.allow_write()
        if args.undo:
            stats = retire_tree.undo(args.undo, apply=args.apply)
            print(f"Database: {db.db.name} — quay lui {stats['changes']} bản ghi")
        else:
            # Báo đường dẫn trước khi ghi: kể cả ghi dở / đĩa lỗi vẫn biết nơi phục hồi.
            if args.apply:
                print(f"Nhật ký trước khi ghi: {journal}", flush=True)
            stats = retire_tree.retire(apply=args.apply, journal_path=journal)
            print(f"Database: {db.db.name} — {stats['old_nodes']} nhánh cũ")
            print(f"Ẩn gốc: {', '.join(stats['hide_roots']) or '—'}")
            print(f"Gắn scheme v2: {len(stats['missing_scheme'])}; đổi bản ghi: {stats['by_collection']}")
        print("ĐÃ GHI" if stats["applied"] else "Chạy thử / bị chặn, chưa ghi")
        for error in stats["errors"]:
            print(f"LỖI: {error}")
        return 1 if stats["errors"] else 0
    except (ValueError, OSError) as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
