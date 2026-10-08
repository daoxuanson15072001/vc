"""Nạp cây lĩnh vực v2 (8 khối × 4 tầng, app/tree_v2.py) vào database đang cấu hình (MONGO_DB).

Mặc định chỉ chạy thử (đếm nhánh sẽ tạo / cập nhật); thêm --apply mới ghi. Chạy lại an toàn: nhánh đã có theo slug thì
cập nhật tên, mã, mô tả, scope note. Không xoá / sửa nhánh cũ và không đụng thẻ — chuyển thẻ sang cây mới là việc riêng.
Nạp xong, AI dựng thẻ chỉ chọn lĩnh vực trong cây v2 (categories.ai_list).

Chạy:  cd backend && ../.venv/bin/python scripts/seed_tree_v2.py            # chạy thử
       cd backend && MONGO_DB=<db> ../.venv/bin/python scripts/seed_tree_v2.py --apply
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import categories, db, tree_v2  # noqa: E402


def main() -> None:
    apply = "--apply" in sys.argv
    categories.ensure_indexes()
    stats = tree_v2.seed(apply=apply)
    print(f"Database: {db.db.name} — {'ĐÃ GHI' if apply else 'chạy thử, chưa ghi (thêm --apply)'}")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
