"""Hợp đồng API đợt 0 (docs/BA.md mục 8): các endpoint mới tồn tại, cần đăng nhập, trả 501 cho tới khi luồng phụ
trách triển khai. Luồng nào triển khai endpoint thì bỏ nó khỏi STUBS và viết test thật."""

from __future__ import annotations

import pytest

from app import org
from tests.conftest import make_user

STUBS = [
    ("GET", "/api/org/access-log"),
    ("GET", "/api/wiki/reviews/due"),   # GOV-09 (luồng K); /api/wiki/changes/*, /api/wiki/novelty: luồng F
    ("GET", "/api/learn/reports"),
]


@pytest.mark.parametrize("method,path", STUBS)
def test_stub_requires_login_then_501(client, method, path):
    assert client.request(method, path).status_code == 401
    client.login(make_user("u"))
    r = client.request(method, path)
    assert r.status_code == 501, r.text
    assert "Chưa triển khai" in r.json()["detail"]


def test_org_me(client, org_sample):
    p = org_sample["people"]
    client.login(p["tp_part_mkt"])
    me = client.get("/api/org/me").json()
    assert [u["code"] for u in me["units"]] == ["VCPART-MKT"]
    assert me["manager"]["name"] == "gd_part" and me["functional_manager"]["name"] == "gd_mkt"
    assert [r["name"] for r in me["direct_reports"]] == ["nv_part_mkt"]
    assert me["function"] == "marketing" and me["level"] is None


def test_org_me_without_org_profile(client):
    client.login(make_user("moi"))
    me = client.get("/api/org/me").json()
    assert me == {"units": [], "function": None, "position": None, "level": None, "level_name": None,
                  "category_root": None, "manager": None, "functional_manager": None, "direct_reports": [],
                  "grants": []}     # level_name, category_root: ORG-05 phần dữ liệu (v0.12, R2)


def test_indexes_created():
    org.ensure_indexes()
    from app.kb import changes, revisions
    from app.learn import models
    revisions.ensure_indexes()
    changes.ensure_indexes()
    models.ensure_indexes()
    assert "code_1" in org.org_units.index_information()
    assert revisions.card_revisions.index_information()["card_id_1_rev_-1"]["unique"]
    assert models.assignments.index_information()["path_id_1_learner_id_1"]["unique"]
