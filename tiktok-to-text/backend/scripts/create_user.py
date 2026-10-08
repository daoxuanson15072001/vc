#!/usr/bin/env python3
"""Tạo tài khoản hoặc đặt lại mật khẩu từ dòng lệnh (khi quên mật khẩu quản trị).

    cd backend && ../.venv/bin/python scripts/create_user.py email@vcprosperous.com "Họ tên" --admin
"""

from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import auth, spaces  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("email")
    p.add_argument("name", nargs="?", default="")
    p.add_argument("--admin", action="store_true", help="Cấp quyền quản trị")
    args = p.parse_args()
    auth.ensure_indexes()
    spaces.ensure_indexes()

    password = getpass.getpass("Mật khẩu (tối thiểu 8 ký tự): ")
    if len(password) < 8:
        print("Mật khẩu quá ngắn")
        return 1
    email = args.email.strip().lower()
    user = auth.users.find_one({"email": email})
    if user:
        changes = {"password_hash": auth.hash_password(password), "active": True}
        if args.admin:
            changes["role"] = "admin"
        auth.users.update_one({"_id": user["_id"]}, {"$set": changes})
        auth.sessions.delete_many({"user_id": user["_id"]})
        print(f"Đã đặt lại mật khẩu cho {email}")
    else:
        auth.create_user(email, args.name or email.split("@")[0], password, "admin" if args.admin else "member")
        print(f"Đã tạo tài khoản {email}{' (quản trị)' if args.admin else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
