"""Cấu hình pytest dùng chung (docs/BA.md mục 18.1).

- Mỗi lượt chạy dùng database riêng `tiktok_to_text_pytest_<E2E_SLOT>` (mặc định slot 0), xoá sạch trước mỗi test —
  không đụng dữ liệu thật, các agent chạy song song không đụng nhau.
- Fixture `org_sample`: cây tổ chức mẫu 1 Tập đoàn · 2 Division · 5 phòng · 12 người (BA mục 15.2).
- Không chạy lifespan của app (worker nền, MCP) — test gọi thẳng hàm, hoặc dùng `client` cho API.

Chạy: cd backend && ../.venv/bin/python -m pytest
"""

from __future__ import annotations

import os
import secrets
from datetime import timedelta

SLOT = os.getenv("E2E_SLOT", "0")
os.environ["MONGO_DB"] = f"tiktok_to_text_pytest_{SLOT}"
os.environ.setdefault("ANTHROPIC_API_KEY", "")
os.environ["CLAUDE_CLI_FALLBACK"] = "off"   # test không gọi `claude -p` thật (tốn quota tài khoản)

import pytest  # noqa: E402

from app import auth, db, org  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    assert db.db.name.startswith("tiktok_to_text_pytest_"), "Không bao giờ chạy test trên DB thật"
    db.client.drop_database(db.db.name)
    auth.ensure_indexes()
    org.ensure_indexes()
    yield


@pytest.fixture(autouse=True)
def no_semantic_search(monkeypatch):
    """Mặc định tìm thẻ chỉ theo chữ, không tính embedding nền (máy dev có thể đang chạy Ollama thật) —
    test tìm theo nghĩa tự bật (tests/test_semantic_search.py)."""
    from app.kb import card_search, embeddings, rerank
    card_search.reset()                             # chỉ mục chữ thẻ trong RAM: mỗi test một DB mới
    monkeypatch.setattr(embeddings, "ENABLED", False)
    monkeypatch.setattr(embeddings, "MODE", "off")
    monkeypatch.setattr(rerank, "ENABLED", False)   # không nạp model reranker thật trong test


def make_user(name: str, email: str | None = None, role: str = "member") -> dict:
    return auth.create_user(email or f"{name}@test.local", name, "mat-khau-test", role)


def set_org(user: dict, unit_ids: list, manager: dict | None = None, function: str | None = None,
            functional_manager: dict | None = None, position: str | None = None) -> dict:
    o = {"unit_ids": unit_ids, "function": function, "position": position,
         "manager_id": manager["_id"] if manager else None,
         "functional_manager_id": functional_manager["_id"] if functional_manager else None,
         "level": None, "status": "active"}
    auth.users.update_one({"_id": user["_id"]}, {"$set": {"org": o}})
    return auth.users.find_one({"_id": user["_id"]})


def add_unit(code: str, name: str, kind: str, parent: dict | None = None, function: str | None = None) -> dict:
    doc = {"code": code, "name": name, "kind": kind, "parent_id": parent["_id"] if parent else None,
           "path": [*(parent["path"] if parent else []), *([parent["_id"]] if parent else [])],
           "function": function, "head_id": None, "active": True, "order": 0}
    doc["_id"] = org.org_units.insert_one(doc).inserted_id
    return doc


def grant(user: dict, role: str, unit: dict | None = None, category: str | None = None,
          valid_from=None, valid_to=None) -> dict:
    doc = {"user_id": user["_id"], "role": role,
           "scope": {"unit_id": unit["_id"] if unit else None, "category": category, "function": None},
           "delegated_from": None, "valid_from": valid_from, "valid_to": valid_to, "created_by": None}
    doc["_id"] = org.grants.insert_one(doc).inserted_id
    return doc


@pytest.fixture
def org_sample():
    """Tập đoàn
         ├─ TD-MKT  Marketing tập đoàn (marketing)
         ├─ VCPART  ─ VCPART-KD (sales) · VCPART-MKT (marketing)
         └─ VCGARAGE ─ VCGARAGE-KT (tech) · VCGARAGE-KD (sales)
    Tuyến quản lý: tgd → gd_mkt, gd_part, gd_garage, hr_lnd; gd_part → tp_part_kd → nv_part_kd;
    gd_part → tp_part_mkt → nv_part_mkt (hai người này có quản lý chuyên môn gd_mkt);
    gd_garage → tp_garage_kt → ks_garage_kt → tts_garage_kt. hr_lnd có vai trò L&D phạm vi VCGARAGE.
    """
    for code, name in [("sales", "Kinh doanh"), ("marketing", "Marketing"), ("tech", "Kỹ thuật"),
                       ("hr", "Nhân sự")]:
        org.org_functions.insert_one({"code": code, "name": name, "active": True})
    u = {}
    u["VCPV"] = add_unit("VCPV", "Tập đoàn VC Phồn Vinh", "group")
    u["TD-MKT"] = add_unit("TD-MKT", "Marketing tập đoàn", "department", u["VCPV"], "marketing")
    u["VCPART"] = add_unit("VCPART", "VCpart", "division", u["VCPV"])
    u["VCPART-KD"] = add_unit("VCPART-KD", "Phòng Kinh doanh VCpart", "department", u["VCPART"], "sales")
    u["VCPART-MKT"] = add_unit("VCPART-MKT", "Phòng Marketing VCpart", "department", u["VCPART"], "marketing")
    u["VCGARAGE"] = add_unit("VCGARAGE", "VCgarage", "division", u["VCPV"])
    u["VCGARAGE-KT"] = add_unit("VCGARAGE-KT", "Phòng Kỹ thuật VCgarage", "department", u["VCGARAGE"], "tech")
    u["VCGARAGE-KD"] = add_unit("VCGARAGE-KD", "Phòng Kinh doanh VCgarage", "department", u["VCGARAGE"], "sales")

    p = {}
    p["tgd"] = set_org(make_user("tgd"), [u["VCPV"]["_id"]])
    p["gd_mkt"] = set_org(make_user("gd_mkt"), [u["TD-MKT"]["_id"]], p["tgd"], "marketing")
    p["gd_part"] = set_org(make_user("gd_part"), [u["VCPART"]["_id"]], p["tgd"])
    p["tp_part_kd"] = set_org(make_user("tp_part_kd"), [u["VCPART-KD"]["_id"]], p["gd_part"], "sales")
    p["nv_part_kd"] = set_org(make_user("nv_part_kd"), [u["VCPART-KD"]["_id"]], p["tp_part_kd"], "sales")
    p["tp_part_mkt"] = set_org(make_user("tp_part_mkt"), [u["VCPART-MKT"]["_id"]], p["gd_part"], "marketing",
                               p["gd_mkt"])
    p["nv_part_mkt"] = set_org(make_user("nv_part_mkt"), [u["VCPART-MKT"]["_id"]], p["tp_part_mkt"], "marketing",
                               p["gd_mkt"])
    p["gd_garage"] = set_org(make_user("gd_garage"), [u["VCGARAGE"]["_id"]], p["tgd"])
    p["tp_garage_kt"] = set_org(make_user("tp_garage_kt"), [u["VCGARAGE-KT"]["_id"]], p["gd_garage"], "tech")
    p["ks_garage_kt"] = set_org(make_user("ks_garage_kt"), [u["VCGARAGE-KT"]["_id"]], p["tp_garage_kt"], "tech")
    p["tts_garage_kt"] = set_org(make_user("tts_garage_kt"), [u["VCGARAGE-KT"]["_id"]], p["ks_garage_kt"], "tech")
    p["hr_lnd"] = set_org(make_user("hr_lnd"), [u["VCPV"]["_id"]], p["tgd"], "hr")
    grant(p["hr_lnd"], "lnd", u["VCGARAGE"])
    return {"units": u, "people": p}


@pytest.fixture
def client():
    """TestClient không chạy lifespan (không bật worker nền). `client.login(user)` gắn cookie phiên."""
    from fastapi.testclient import TestClient

    from app.main import app

    c = TestClient(app)

    def login(user: dict) -> None:
        token = secrets.token_urlsafe(16)
        auth.sessions.insert_one({"_id": token, "user_id": user["_id"], "created_at": db.now(),
                                  "expires_at": db.now() + timedelta(days=1)})
        c.cookies.set(auth.SESSION_COOKIE, token)

    c.login = login
    return c
