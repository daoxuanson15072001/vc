"""Áp bảng quyết định A2 (scripts/data/vcwiki_card_decisions_v2.csv) lên thẻ VCWIKI — logic ở app/kb/apply_v2.py.

Điều kiện trước: cây v2 đã nạp (scripts/seed_tree_v2.py --apply) có đủ mã trong bảng; nên chạy clean_tags_v2 trước.
Mặc định chạy thử: in số thẻ theo node / bậc / division, dòng lỗi theo loại, cảnh báo tên, thẻ không có dòng. --apply
mới ghi (sao lưu DB trước: mongodump). Chạy lại báo 0 thay đổi. Log từng thẻ ghi ra output/r4/.

Chạy:  cd backend && ../.venv/bin/python scripts/apply_card_decisions.py            # chạy thử
       cd backend && ../.venv/bin/python scripts/apply_card_decisions.py --apply    # ghi
"""

from __future__ import annotations

import csv
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import auth, db  # noqa: E402
from app.kb import apply_v2  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "output" / "r4"


def main() -> None:
    apply = "--apply" in sys.argv
    admin = auth.users.find_one({"role": "admin", "active": {"$ne": False}}, sort=[("created_at", 1)])
    s = apply_v2.run(apply=apply, by=admin["_id"] if admin else None)
    print(f"Database: {db.db.name} — {'ĐÃ GHI' if apply else 'chạy thử, chưa ghi (thêm --apply)'}")
    print(f"Dòng trong bảng: {s['rows']} · cập nhật: {s['updated']} · giữ nguyên: {s['unchanged']} · "
          f"xoá thẻ test: {s['deleted']} · dọn rác XML: {s['xml_cleaned']} · độ tin cậy thấp: {s['low_confidence']}")
    print("\nLỗi theo loại (dòng lỗi không ghi):", dict(s["errors"]) or "không có")
    for cid, kind, detail in s["error_rows"][:40]:
        print(f"  {cid} {kind} {detail}")
    print(f"\nCảnh báo tên nhánh viết khác (vẫn áp): {len(s['warnings'])}")
    for w in s["warnings"][:8]:
        print("  " + w)
    print("\nSố thẻ theo node:")
    for code, n in sorted(s["by_node"].items(), key=lambda x: [int(p) for p in x[0].split(".")]):
        print(f"  {code:<10} {n}")
    print("\nTheo cấp độ:", dict(s["by_level"]))
    print("Theo division:", dict(s["by_division"]))
    print(f"\nThẻ không có dòng trong bảng, xếp tạm + tag {apply_v2.UNSORTED_TAG}: {len(s['unsorted'])}")
    for u in s["unsorted"]:
        print(f"  {u['card_id']} [{u['old_categories']}] → [{u['new_categories']}] {u['title'][:60]}")
    OUT.mkdir(parents=True, exist_ok=True)
    log = OUT / f"{'apply' if apply else 'dry'}-{db.db.name}-{datetime.now():%Y%m%d-%H%M%S}.csv"
    with open(log, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["card_id", "ket_qua", "chi_tiet"])
        w.writerows(s["log"])
    print(f"\nLog: {log}" + (f" · danh sách chưa xếp: {apply_v2.UNSORTED_CSV}" if apply and s["unsorted"] else ""))


if __name__ == "__main__":
    main()
