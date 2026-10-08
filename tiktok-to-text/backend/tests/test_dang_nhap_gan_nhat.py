"""SYS-36 — ghi và hiện lần đăng nhập web gần nhất (`users.last_login_at`); chỉ quản trị viên xem được."""

from __future__ import annotations

from app import auth
from tests.conftest import make_user


def _login(client, email, password="mat-khau-test"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_dang_nhap_web_ghi_thoi_diem(client):
    an = make_user("an")
    assert "last_login_at" not in auth.users.find_one({"_id": an["_id"]})   # chưa đăng nhập: thiếu trường
    assert _login(client, an["email"]).status_code == 200
    t1 = auth.users.find_one({"_id": an["_id"]})["last_login_at"]
    assert t1 is not None
    assert _login(client, an["email"]).status_code == 200
    assert auth.users.find_one({"_id": an["_id"]})["last_login_at"] >= t1


def test_dang_nhap_sai_khong_ghi(client):
    an = make_user("an")
    assert _login(client, an["email"], "sai-mat-khau").status_code == 401
    assert "last_login_at" not in auth.users.find_one({"_id": an["_id"]})


def test_token_mcp_khong_tinh_la_dang_nhap():
    an = make_user("an")
    token, _ = auth.issue_api_token(an, "AI")
    assert auth.user_from_api_token(token)["_id"] == an["_id"]
    assert "last_login_at" not in auth.users.find_one({"_id": an["_id"]})


def test_chi_quan_tri_thay_truong(client):
    admin, an, binh = make_user("admin", role="admin"), make_user("an"), make_user("binh")
    _login(client, an["email"])
    client.cookies.clear()

    client.login(admin)
    rows = {u["email"]: u for u in client.get("/api/users").json()}
    assert rows[an["email"]]["last_login_at"] is not None
    assert rows[binh["email"]]["last_login_at"] is None          # chưa đăng nhập lần nào

    client.cookies.clear()
    client.login(binh)
    assert all("last_login_at" not in u for u in client.get("/api/users").json())
    assert "last_login_at" not in client.get("/api/auth/me").json()
