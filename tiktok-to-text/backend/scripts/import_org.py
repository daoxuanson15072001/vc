#!/usr/bin/env python3
"""Nhập hồ sơ tổ chức hàng loạt từ Excel / CSV (ORG-04) — cùng logic với màn Cơ cấu tổ chức → Nhập Excel.

Cột (có dòng tiêu đề, có dấu hay không đều được; không có tiêu đề thì theo đúng thứ tự này):
    email, họ tên, mã đơn vị, chức năng, email quản lý, email quản lý chuyên môn, chức danh, cấp bậc (1–7; trống = chưa
    xếp; file không có cột cấp bậc thì giữ cấp bậc đang có)

Mặc định chỉ xem trước (không ghi gì). Thêm --apply để ghi; file còn dòng lỗi thì không ghi dòng nào.
Người chưa có tài khoản được tạo với mật khẩu ngẫu nhiên — in ra đúng một lần, gửi riêng cho từng người.
Chạy lại cùng file không tạo trùng.

    cd backend && ../.venv/bin/python scripts/import_org.py nhan_su.xlsx          # xem trước
    cd backend && ../.venv/bin/python scripts/import_org.py nhan_su.xlsx --apply  # ghi
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import auth, org, spaces  # noqa: E402

ACTION = {"create": "tạo mới", "update": "cập nhật", "unchanged": "giữ nguyên", "error": "LỖI"}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("file", type=Path, help="File .xlsx hoặc .csv")
    p.add_argument("--apply", action="store_true", help="Ghi vào hệ thống (mặc định chỉ xem trước)")
    args = p.parse_args()
    auth.ensure_indexes()
    spaces.ensure_indexes()
    org.ensure_indexes()

    try:
        rows = org.parse_table(args.file.name, args.file.read_bytes())
    except (OSError, ValueError) as e:
        print(f"Không đọc được file: {e}")
        return 1
    if not rows:
        print("File không có dòng dữ liệu nào")
        return 1
    res = org.import_org(rows, dry_run=not args.apply)

    for r in res["rows"]:
        print(f"Dòng {r['row']:>4}  {ACTION[r['action']]:<10}  {r['email']:<36} {r['unit_code']}")
        for e in r["errors"]:
            print(f"            - {e}")
    c = res["counts"]
    print(f"\n{res['total']} dòng: {c['create']} tạo mới · {c['update']} cập nhật · {c['unchanged']} giữ nguyên · "
          f"{c['error']} lỗi")
    if res["created"]:
        print("\nTài khoản mới (mật khẩu chỉ hiện lần này):")
        for u in res["created"]:
            print(f"  {u['email']:<36} {u['password']}   {u['name']}")
    if res["applied"]:
        print("\nĐã ghi vào hệ thống.")
    elif args.apply:
        print("\nKhông ghi gì — sửa các dòng lỗi rồi chạy lại.")
        return 1
    else:
        print("\nMới xem trước, chưa ghi. Thêm --apply để ghi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
