#!/usr/bin/env python3
"""Sửa nguồn gốc thẻ bị lần chuyển dữ liệu v0.10 ghi nhầm (27/09/2026).

Thẻ AI bóc từ tài liệu trước v0.10 bị ghi `origin = manual`, `created_by` = người nạp → luật bốn mắt coi người nạp là
tác giả, không cho họ duyệt. Script đổi `origin → ai` (+ `author_ai` trên đề xuất `create` đang mở) cho ĐÚNG các thẻ:
nháp, có tài liệu gốc (`document_id`), chưa ai sửa tay (`edited_by` rỗng), bản 1 ghi "Phiên bản đầu (chuyển dữ liệu
v0.10)". Mỗi thẻ sửa có trường `origin_fix` ghi lý do. Không đụng luật duyệt.

    cd backend
    python scripts/fix_origin_v010.py            # chỉ đếm, không ghi
    python scripts/fix_origin_v010.py --apply    # ghi
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.db import db  # noqa: E402

MIGRATION_REASON = "Phiên bản đầu (chuyển dữ liệu v0.10)"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--apply", action="store_true", help="ghi vào DB (mặc định chỉ đếm)")
    ap.add_argument("--email", default="buithoanh@vcprosperous.com", help="người nạp bị ghi nhầm là tác giả")
    args = ap.parse_args()

    u = db.users.find_one({"email": args.email.lower()})
    if not u:
        print(f"Không có tài khoản {args.email}")
        return 1
    q = {"origin": "manual", "created_by": u["_id"], "document_id": {"$ne": None},
         "edited_by": {"$in": [None, []]}, "status": "draft"}
    ids = [c["_id"] for c in db.wiki_cards.find(q, {"_id": 1})
           if (db.card_revisions.find_one({"card_id": c["_id"], "rev": 1}) or {}).get("reason", "").startswith(MIGRATION_REASON)]
    print(f"DB {db.name}: {len(ids)} thẻ nháp AI bóc từ tài liệu bị ghi nhầm 'viết tay' / tác giả {u['name']}")
    if not args.apply:
        print("Chưa ghi gì. Chạy lại với --apply để sửa.")
        return 0
    note = {"by": u["name"], "why": "AI bóc từ tài liệu trước v0.10, chuyển dữ liệu ghi nhầm manual",
            "from": "manual", "at": datetime.now(timezone.utc)}
    r1 = db.wiki_cards.update_many({"_id": {"$in": ids}}, {"$set": {"origin": "ai", "origin_fix": note}})
    r2 = db.change_requests.update_many({"card_id": {"$in": ids}, "kind": "create", "status": "open"},
                                        {"$set": {"origin": "ai", "author_ai": True}})
    print(f"✓ Đã sửa {r1.modified_count} thẻ, {r2.modified_count} đề xuất duyệt đang mở")
    return 0


if __name__ == "__main__":
    sys.exit(main())
