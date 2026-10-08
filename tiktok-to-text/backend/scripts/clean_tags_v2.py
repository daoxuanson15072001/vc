"""Vệ sinh tag theo Phân loại VCwiki v2 (bảng gộp / đổi tên nguồn / xoá ở app/kb/tags_v2.py).

Mặc định chạy thử: in bảng tag trước → sau (số thẻ / tài liệu / video). --apply mới ghi. Chạy lại an toàn (lần 2 báo 0
thay đổi). Chỉ đổi tag (thẻ: cả search_text); không đổi trạng thái, ngày sửa, không tạo phiên bản thẻ.

Chạy:  cd backend && ../.venv/bin/python scripts/clean_tags_v2.py            # chạy thử
       cd backend && ../.venv/bin/python scripts/clean_tags_v2.py --apply    # ghi (sao lưu DB trước)
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db  # noqa: E402
from app.kb import tags_v2  # noqa: E402


def main() -> None:
    apply = "--apply" in sys.argv
    stats = tags_v2.run(apply=apply)
    print(f"Database: {db.db.name} — {'ĐÃ GHI' if apply else 'chạy thử, chưa ghi (thêm --apply)'}")
    print(f"{'Tag cũ':<28} {'→ Tag mới':<28} {'Thẻ':>6} {'Tài liệu':>9} {'Video':>6}")
    for tag, r in sorted(stats["tags"].items(), key=lambda x: -(x[1]["cards"] + x[1]["documents"] + x[1]["videos"])):
        print(f"{tag:<28} {'→ ' + (r['to'] or '(xoá)'):<28} {r['cards']:>6} {r['documents']:>9} {r['videos']:>6}")
    ch = stats["changed"]
    print(f"Bản ghi đổi: {ch['cards']} thẻ · {ch['documents']} tài liệu · {ch['videos']} video")
    print(f"Thẻ đang có > {tags_v2.MAX_TAGS} tag (chỉ báo, không tự cắt): {stats['cards_over_max']}")


if __name__ == "__main__":
    main()
