"""R2 — cấp bậc 1–7 trên hồ sơ, category_root của chức năng, bảng ánh xạ cấp bậc → bậc nội dung (ORG-05 phần dữ liệu)."""

from __future__ import annotations

import pytest

from app import categories, org, policy
from app.auth import users

from .conftest import make_user


@pytest.fixture
def world(client):
    categories.ensure_indexes()
    for slug, name in (("bh", "Bán hàng & CSKH"), ("mkt", "Marketing")):
        categories._insert(name, "", None, 0, slug=slug)
    org.org_functions.insert_one({"code": "sales", "name": "Kinh doanh", "active": True})
    admin = make_user("admin", role="admin")
    nv = make_user("nv")
    client.login(admin)
    return {"admin": admin, "nv": nv, "client": client}


def test_level_on_profile_and_me(world):
    c, nv = world["client"], world["nv"]
    r = c.patch(f"/api/org/users/{nv['_id']}", json={"level": 2, "function": "sales"})
    assert r.status_code == 200 and r.json()["org"]["level"] == 2
    assert c.patch(f"/api/org/users/{nv['_id']}", json={"level": 8}).status_code == 422
    assert c.patch(f"/api/org/users/{nv['_id']}", json={"position": "NVKD"}).json()["org"]["level"] == 2  # giữ
    assert c.patch(f"/api/org/users/{nv['_id']}", json={"level": None}).json()["org"]["level"] is None
    f = next(x for x in c.get("/api/org/functions").json() if x["code"] == "sales")
    assert c.patch(f"/api/org/functions/{f['id']}", json={"category_root": "khong-co"}).status_code == 400
    assert c.patch(f"/api/org/functions/{f['id']}", json={"category_root": "bh"}).json()["category_root"] == "bh"
    c.patch(f"/api/org/users/{nv['_id']}", json={"level": 2})
    c.login(users.find_one({"_id": nv["_id"]}))
    me = c.get("/api/org/me").json()
    assert (me["level"], me["level_name"], me["category_root"]) == (2, "Nhân viên", "bh")


def test_level_map_defaults_put_and_policy(world):
    c = world["client"]
    m = c.get("/api/org/level-map").json()
    assert m["levels"]["1"] == {"own": ["nhap-mon"], "other": ["nhap-mon"]}
    assert m["levels"]["6"] == {"own": ["thiet-ke"], "other": ["dieu-hanh"]}
    assert m["names"]["3"] == "Key staff"
    new = m["levels"] | {"2": {"own": ["thuc-thi", "nhap-mon"], "other": ["nhap-mon"]}}
    assert c.put("/api/org/level-map", json={"levels": new}).json()["levels"]["2"]["own"] == ["thuc-thi", "nhap-mon"]
    assert c.put("/api/org/level-map", json={"levels": new | {"2": {"own": ["sep"]}}}).status_code == 400
    assert c.put("/api/org/level-map", json={"levels": {"1": new["1"]}}).status_code == 400    # thiếu cấp
    c.login(world["nv"])
    assert c.put("/api/org/level-map", json={"levels": new}).status_code == 403
    assert c.get("/api/org/level-map").status_code == 200
    # policy: 7 cấp × own / other theo bảng mặc định
    org.org_level_map.delete_many({})
    users.update_one({"_id": world["nv"]["_id"]}, {"$set": {"org.function": "sales"}})
    org.org_functions.update_one({"code": "sales"}, {"$set": {"category_root": "bh"}})
    assert policy.content_levels_for(users.find_one({"_id": world["nv"]["_id"]}), "bh") == []   # chưa có cấp
    for lv, want in org.DEFAULT_LEVEL_MAP.items():
        users.update_one({"_id": world["nv"]["_id"]}, {"$set": {"org.level": lv}})
        u = users.find_one({"_id": world["nv"]["_id"]})
        assert policy.content_levels_for(u, "bh") == want["own"]
        assert policy.content_levels_for(u, "mkt") == want["other"]
        assert policy.content_levels_for(u, None) == want["other"]


def test_import_level_column(world):
    unit = org.org_units.insert_one({"code": "KD", "name": "Kinh doanh", "kind": "department", "parent_id": None,
                                     "path": [], "active": True, "function": "sales", "order": 0}).inserted_id
    head = "email,ho ten,ma don vi,cap bac\n"
    bad = org.import_org(org.parse_table("a.csv", (head + "a@t.vn,A,KD,2\nb@t.vn,B,KD,9\n").encode()), dry_run=False)
    assert bad["counts"]["error"] == 1 and not bad["applied"] and not users.find_one({"email": "a@t.vn"})
    assert "1–7" in next(r for r in bad["rows"] if r["errors"])["errors"][0]
    ok = org.import_org(org.parse_table("a.csv", (head + "a@t.vn,A,KD,2\nb@t.vn,B,KD,\n").encode()), dry_run=False)
    assert ok["applied"] and org.user_org(users.find_one({"email": "a@t.vn"}))["level"] == 2
    assert org.user_org(users.find_one({"email": "b@t.vn"}))["level"] is None
    again = org.import_org(org.parse_table("a.csv", (head + "a@t.vn,A,KD,2\nb@t.vn,B,KD,\n").encode()), dry_run=False)
    assert again["counts"]["unchanged"] == 2 and users.count_documents({"email": {"$in": ["a@t.vn", "b@t.vn"]}}) == 2
    # file mẫu cũ không có cột cấp bậc: giữ cấp bậc đang có
    old = org.import_org(org.parse_table("a.csv", b"email,ho ten,ma don vi\na@t.vn,A,KD\n"), dry_run=False)
    assert old["counts"]["unchanged"] == 1 and org.user_org(users.find_one({"email": "a@t.vn"}))["level"] == 2
    assert unit
