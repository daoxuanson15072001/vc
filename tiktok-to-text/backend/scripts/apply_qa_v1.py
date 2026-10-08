"""QA v1 kho VCWIKI (26/09): nhánh tầng 4 mới, chuyển nhánh chính, loại thẻ trùng, gắn cờ — logic ở app/kb/qa_v1.py.

Điều kiện trước: đã chạy R3 (seed_tree_v2, clean_tags_v2) và R4 (apply_card_decisions) trên cùng database.
Mặc định chạy thử: in số nhánh tạo, thẻ chuyển theo tầng đích, thẻ bỏ / giữ, tag gắn, dòng lỗi. --apply mới ghi
(sao lưu DB trước: mongodump). Chạy lại báo 0 thay đổi. Log từng thẻ ghi ra output/qa_v1/.

Chạy:  cd backend && ../.venv/bin/python scripts/apply_qa_v1.py            # chạy thử
       cd backend && ../.venv/bin/python scripts/apply_qa_v1.py --apply    # ghi
"""

from __future__ import annotations

import csv
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import auth, categories, db  # noqa: E402
from app.kb import qa_v1  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "output" / "qa_v1"


def main() -> None:
    apply = "--apply" in sys.argv
    categories.ensure_indexes()
    admin = auth.users.find_one({"role": "admin", "active": {"$ne": False}}, sort=[("created_at", 1)])
    s = qa_v1.run(apply=apply, by=admin["_id"] if admin else None)
    print(f"Database: {db.db.name} — {'ĐÃ GHI' if apply else 'chạy thử, chưa ghi (thêm --apply)'}")
    print(f"Nhánh tầng 4 trong file: {s['nodes_in_file']} · tạo mới: {s['nodes_created']} · đã có: {s['nodes_existing']}")
    print(f"Thẻ trong các file: {s['cards_planned']} · cập nhật: {s['updated']} · đã đúng: {s['unchanged']}")
    print("Chuyển nhánh chính theo tầng đích:", dict(s["moved_by_level"]) or "không có",
          f"· nhánh chính lệch from_code: {s['move_from_mismatch']}")
    print(f"Thẻ trùng chuyển rejected: {s['rejected_dup']} · thẻ giữ nhận ghi chú gộp: {s['keep_merge_notes']}")
    print("Tag gắn thêm:", dict(s["tags_added"]) or "không có")
    print("\nLỗi theo loại (dòng lỗi bỏ qua):", dict(s["errors"]) or "không có")
    for key, kind, detail in s["error_rows"][:60]:
        print(f"  {key} {kind} {detail}")
    print(f"\nCảnh báo: {len(s['warnings'])}")
    for w in s["warnings"][:15]:
        print("  " + w)
    OUT.mkdir(parents=True, exist_ok=True)
    log = OUT / f"{'apply' if apply else 'dry'}-{db.db.name}-{datetime.now():%Y%m%d-%H%M%S}.csv"
    with open(log, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["card_id", "ket_qua", "chi_tiet"])
        w.writerows(s["log"])
        w.writerows((k, "loi_" + kind, d) for k, kind, d in s["error_rows"])
        w.writerows(("", "canh_bao", x) for x in s["warnings"])
    print(f"\nLog: {log}")


if __name__ == "__main__":
    main()
