"""Thư viện bài học báo rõ vì sao (không) soạn được bài (yêu cầu 6ab79386…bd08; BA 15.6, LRN-01).

`policy.learn_author_status` chỉ giải thích — quyền vẫn do `can(user, "learn.author")` quyết."""

from __future__ import annotations

from app import db, policy
from app.auth import users
from tests.conftest import make_user
from tests.test_learn_api import add_card, shared_space

cards = db.db["wiki_cards"]


def test_status_matches_can_for_everyone(org_sample):
    for u in org_sample["people"].values():
        u = users.find_one({"_id": u["_id"]})
        assert policy.learn_author_status(u)["can_author"] == policy.can(u, "learn.author")


def test_member_without_rights_gets_reason(org_sample, client):
    nv = org_sample["people"]["nv_part_kd"]
    client.login(nv)
    r = client.get("/api/learn/lessons").json()
    assert r["can_author"] is False and "approved_cards" not in r
    st = r["author_status"]
    assert st == {"can_author": False, "in_org": True, "has_subordinates": False, "grant_roles": [],
                  "is_admin": False, "org_empty": False}


def test_author_sees_approved_count(org_sample, client):
    tp = org_sample["people"]["tp_part_kd"]
    space = shared_space(tp)
    add_card(space, "Đã duyệt 1")
    add_card(space, "Đã duyệt 2")
    add_card(space, "Nháp", status="draft")
    add_card(space, "Chờ xoá", delete_requested=True)
    add_card(shared_space(org_sample["people"]["tgd"]), "Kho khác")      # không xem được
    client.login(tp)
    r = client.get("/api/learn/lessons").json()
    assert r["can_author"] is True and "author_status" not in r
    assert r["approved_cards"] == 2 and r["few_approved_threshold"] == 20


def test_admin_on_empty_org_follows_guide(client):
    """Cây trống: admin chưa soạn được; tạo Tập đoàn và đứng tên trưởng đơn vị vẫn CHƯA đủ (quyền soạn theo cấp
    dưới trực tiếp hoặc vai trò editor / lnd); cấp vai trò lnd tại /org thì soạn được."""
    admin = make_user("admin", role="admin")
    client.login(admin)
    st = client.get("/api/learn/lessons").json()["author_status"]
    assert st["is_admin"] and st["org_empty"] and not st["in_org"]
    assert client.get("/api/auth/me").json()["can_design"] is False

    unit = client.post("/api/org/units", json={"code": "VCPV", "name": "Tập đoàn", "kind": "group",
                                               "head_id": str(admin["_id"])})
    assert unit.status_code == 201, unit.text
    r = client.get("/api/learn/lessons").json()
    assert r["can_author"] is False and r["author_status"]["org_empty"] is False

    g = client.post("/api/org/grants", json={"user_id": str(admin["_id"]), "role": "lnd"})
    assert g.status_code == 201, g.text
    assert client.get("/api/auth/me").json()["can_design"] is True
    r = client.get("/api/learn/lessons").json()
    assert r["can_author"] is True and r["approved_cards"] == 0
