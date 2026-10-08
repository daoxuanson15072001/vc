"""Cây lĩnh vực là dữ liệu dùng chung: mọi người dùng thêm / sửa / ẩn / xoá nhánh (kèm nhánh con; còn dữ liệu thì chuyển) — trên web (/wiki, /admin)
và qua MCP (create_category / update_category / delete_category). Gán chủ nhánh (người duyệt thẻ) vẫn chỉ admin."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from app import auth, categories, db, mcp_server

from .conftest import make_user


@pytest.fixture
def member(client):
    categories.ensure_indexes()
    u = make_user("thuong")
    client.login(u)
    return u


def ctx_for(user: dict) -> SimpleNamespace:
    token, _ = auth.issue_api_token(user, "test")
    return SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "claude-code/test"})


def row(client, slug: str) -> dict:
    return next(c for c in client.get("/api/categories", params={"include_inactive": "true"}).json()
                if c["slug"] == slug)


def test_member_crud_web(client, member):
    r = client.post("/api/categories", json={"name": "Vận hành kho"})
    assert r.status_code == 201, r.text
    root = r.json()
    child = client.post("/api/categories", json={"name": "Kiểm kê", "parent_id": root["id"]}).json()
    assert child["slug"] == "van-hanh-kho.kiem-ke"
    assert categories.categories.find_one({"slug": child["slug"]})["created_by"] == member["_id"]

    r = client.patch(f"/api/categories/{child['id']}", json={"name": "Kiểm kê định kỳ", "code": "9.1"})
    assert r.status_code == 200 and r.json()["slug"] == "van-hanh-kho.kiem-ke-dinh-ky"   # slug theo tên mới
    child["slug"] = r.json()["slug"]
    c = row(client, child["slug"])
    assert (c["name"], c["code"]) == ("Kiểm kê định kỳ", "9.1")
    assert categories.categories.find_one({"slug": child["slug"]})["updated_by"] == member["_id"]

    assert client.patch(f"/api/categories/{root['id']}", json={"active": False}).status_code == 200
    assert not row(client, child["slug"])["active"]          # ẩn cha kéo theo con
    assert client.patch(f"/api/categories/{root['id']}", json={"active": True}).status_code == 200

    # cả nhánh rỗng -> xoá cha kéo theo con
    r = client.delete(f"/api/categories/{root['id']}")
    assert r.status_code == 200 and r.json()["deleted"] == [root["slug"], child["slug"]]
    assert not categories.categories.find_one({"slug": {"$in": [root["slug"], child["slug"]]}})


def test_delete_blocked_while_used(client, member):
    cat = client.post("/api/categories", json={"name": "Đang dùng"}).json()
    db.db["wiki_cards"].insert_one({"title": "t", "categories": [cat["slug"]]})
    db.db["kb_documents"].insert_one({"title": "d", "primary_category": cat["slug"]})
    r = client.delete(f"/api/categories/{cat['id']}")
    assert r.status_code == 409
    assert "1 thẻ" in r.json()["detail"] and "1 tài liệu" in r.json()["detail"]
    assert categories.categories.find_one({"slug": cat["slug"]})


def test_delete_top_level_moves_data(client, member):
    """Xoá nhóm cấp 1 còn dữ liệu: chuyển mọi thẻ / tài liệu / nguồn / lộ trình ở cả nhánh con sang nhánh đích."""
    root = client.post("/api/categories", json={"name": "Nhóm cũ"}).json()
    child = client.post("/api/categories", json={"name": "Con", "parent_id": root["id"]}).json()
    dest = client.post("/api/categories", json={"name": "Nhóm mới"}).json()
    d = db.db
    c1 = d["wiki_cards"].insert_one({"title": "a", "categories": [child["slug"], "khac", root["slug"]]}).inserted_id
    c2 = d["wiki_cards"].insert_one({"title": "b", "categories": [dest["slug"], child["slug"]]}).inserted_id
    doc = d["kb_documents"].insert_one({"title": "d", "categories": [root["slug"]], "primary_category": child["slug"]}).inserted_id
    lp = d["learning_paths"].insert_one({"ai": {"form": {"area": root["slug"], "branches": [child["slug"]]}}}).inserted_id

    r = client.delete(f"/api/categories/{root['id']}")
    assert r.status_code == 409 and "move_to" in r.json()["detail"] and "2 thẻ" in r.json()["detail"]
    assert client.delete(f"/api/categories/{root['id']}", params={"move_to": child["slug"]}).status_code == 400
    assert client.delete(f"/api/categories/{root['id']}", params={"move_to": "khong-co"}).status_code == 400

    r = client.delete(f"/api/categories/{root['id']}", params={"move_to": dest["slug"]})
    assert r.status_code == 200, r.text
    assert r.json()["moved_to"] == dest["slug"] and r.json()["moved"]["thẻ"] == 2
    assert not categories.categories.find_one({"slug": {"$in": [root["slug"], child["slug"]]}})
    assert d["wiki_cards"].find_one({"_id": c1})["categories"] == [dest["slug"], "khac"]   # gộp trùng, giữ thứ tự
    assert d["wiki_cards"].find_one({"_id": c2})["categories"] == [dest["slug"]]
    got = d["kb_documents"].find_one({"_id": doc})
    assert got["categories"] == [dest["slug"]] and got["primary_category"] == dest["slug"]
    assert d["learning_paths"].find_one({"_id": lp})["ai"]["form"] == {"area": dest["slug"], "branches": [dest["slug"]]}


def test_delete_blocked_by_grant(client, member):
    root = client.post("/api/categories", json={"name": "Có quyền"}).json()
    dest = client.post("/api/categories", json={"name": "Đích"}).json()
    db.db["grants"].insert_one({"scope": {"category": root["slug"]}})
    r = client.delete(f"/api/categories/{root['id']}", params={"move_to": dest["slug"]})
    assert r.status_code == 409 and "phạm vi quyền" in r.json()["detail"]
    assert categories.categories.find_one({"slug": root["slug"]})


def test_owner_only_admin(client, member):
    admin = make_user("admin", role="admin")
    cat = client.post("/api/categories", json={"name": "Có chủ"}).json()
    # thành viên không tự gán chủ nhánh (chủ nhánh duyệt thẻ trong nhánh)
    r = client.patch(f"/api/categories/{cat['id']}", json={"owner_id": str(member["_id"])})
    assert r.status_code == 403
    assert client.post("/api/categories", json={"name": "Y", "owner_id": str(member["_id"])}).status_code == 403
    client.login(admin)
    assert client.patch(f"/api/categories/{cat['id']}", json={"owner_id": str(member["_id"])}).status_code == 200
    # form web gửi lại owner_id sẵn có khi thành viên sửa tên -> không bị chặn
    client.login(member)
    r = client.patch(f"/api/categories/{cat['id']}", json={"name": "Có chủ 2", "owner_id": str(member["_id"])})
    assert r.status_code == 200, r.text


def test_member_crud_mcp(client, member):
    ctx = ctx_for(member)
    res = json.loads(mcp_server.create_category(ctx, "Pháp chế nội bộ", slug="phap-che"))
    assert res["created"] and res["slug"] == "phap-che"
    json.loads(mcp_server.create_category(ctx, "Hợp đồng mẫu", parent_slug="phap-che"))
    out = json.loads(mcp_server.update_category(ctx, "phap-che", description="Quy định nội bộ", order=5))
    assert out["description"] == "Quy định nội bộ" and out["order"] == 5
    assert json.loads(mcp_server.update_category(ctx, "phap-che.hop-dong-mau", active=False))["active"] is False
    with pytest.raises(ToolError, match="Chỉ quản trị viên được gán chủ nhánh"):
        mcp_server.update_category(ctx, "phap-che", owner_email=member["email"])
    db.db["wiki_cards"].insert_one({"title": "t", "categories": ["phap-che.hop-dong-mau"]})
    with pytest.raises(ToolError, match="move_to"):
        mcp_server.delete_category(ctx, "phap-che")
    json.loads(mcp_server.create_category(ctx, "Pháp lý mới", slug="phap-ly-moi"))
    out = json.loads(mcp_server.delete_category(ctx, "phap-che", move_to="phap-ly-moi"))
    assert out["deleted"] and out["deleted_slugs"] == ["phap-che", "phap-che.hop-dong-mau"] and out["moved"] == {"thẻ": 1}
    assert db.db["wiki_cards"].find_one({"title": "t"})["categories"] == ["phap-ly-moi"]
    with pytest.raises(ToolError, match="Không có nhánh"):
        mcp_server.delete_category(ctx, "phap-che")


def test_rename_moves_slug_and_data(client, member):
    """Đổi tên nhánh -> slug (link /wiki?category=…) đổi theo; nhánh con + dữ liệu gắn slug cũ chuyển theo;
    slug cũ vẫn tra ra nhánh (lọc thẻ, gán thẻ, MCP)."""
    root = client.post("/api/categories", json={"name": "Sản phẩm", "slug": "san-pham"}).json()
    child = client.post("/api/categories", json={"name": "VCgarage", "parent_id": root["id"]}).json()
    leaf = client.post("/api/categories", json={"name": "Báo giá", "parent_id": child["id"]}).json()
    assert leaf["slug"] == "san-pham.vcgarage.bao-gia"
    d = db.db
    card = d["wiki_cards"].insert_one({"title": "t", "categories": ["khac", "san-pham.vcgarage.bao-gia"]}).inserted_id
    doc = d["kb_documents"].insert_one({"categories": ["san-pham.vcgarage"], "primary_category": "san-pham.vcgarage"}).inserted_id
    fn = d["org_functions"].insert_one({"code": "x", "category_root": "san-pham.vcgarage"}).inserted_id
    grant = d["grants"].insert_one({"scope": {"category": "san-pham.vcgarage.bao-gia"}}).inserted_id
    lp = d["learning_paths"].insert_one({"ai": {"form": {"area": "san-pham.vcgarage", "branches": ["san-pham.vcgarage.bao-gia"]}},
                                         "exam": {"blueprint": [{"category": "san-pham.vcgarage", "count": 2},
                                                                {"category": "khac", "count": 1}]}}).inserted_id
    ch_open = d["change_requests"].insert_one({"status": "open", "proposal": {"set": {"categories": ["san-pham.vcgarage"]}}}).inserted_id
    ch_done = d["change_requests"].insert_one({"status": "approved", "proposal": {"set": {"categories": ["san-pham.vcgarage"]}}}).inserted_id
    client.patch(f"/api/categories/{leaf['id']}", json={"active": False})

    r = client.patch(f"/api/categories/{child['id']}", json={"name": "VCgarage & VCsale"})
    assert r.status_code == 200 and r.json()["slug"] == "san-pham.vcgarage-vcsale"
    new_leaf = categories.categories.find_one({"_id": categories.categories.find_one({"slug": "san-pham.vcgarage-vcsale.bao-gia"})["_id"]})
    assert new_leaf["path"] == ["san-pham", "san-pham.vcgarage-vcsale"] and not new_leaf["active"]
    assert new_leaf["old_slugs"] == ["san-pham.vcgarage.bao-gia"]
    assert row(client, "san-pham.vcgarage-vcsale")["old_slugs"] == ["san-pham.vcgarage"]

    assert d["wiki_cards"].find_one({"_id": card})["categories"] == ["khac", "san-pham.vcgarage-vcsale.bao-gia"]
    assert d["kb_documents"].find_one({"_id": doc}, {"_id": 0}) == {"categories": ["san-pham.vcgarage-vcsale"],
                                                                   "primary_category": "san-pham.vcgarage-vcsale"}
    assert d["org_functions"].find_one({"_id": fn})["category_root"] == "san-pham.vcgarage-vcsale"
    assert d["grants"].find_one({"_id": grant})["scope"]["category"] == "san-pham.vcgarage-vcsale.bao-gia"
    p = d["learning_paths"].find_one({"_id": lp})
    assert p["ai"]["form"] == {"area": "san-pham.vcgarage-vcsale", "branches": ["san-pham.vcgarage-vcsale.bao-gia"]}
    assert [b["category"] for b in p["exam"]["blueprint"]] == ["san-pham.vcgarage-vcsale", "khac"]
    assert d["change_requests"].find_one({"_id": ch_open})["proposal"]["set"]["categories"] == ["san-pham.vcgarage-vcsale"]
    assert d["change_requests"].find_one({"_id": ch_done})["proposal"]["set"]["categories"] == ["san-pham.vcgarage"]

    # slug cũ vẫn dùng được
    assert set(categories.with_descendants("san-pham.vcgarage")) == {"san-pham.vcgarage-vcsale", "san-pham.vcgarage-vcsale.bao-gia"}
    assert categories.valid_slugs(["san-pham.vcgarage"]) == ["san-pham.vcgarage-vcsale"]

    # slug đặt tay; trùng nhánh khác -> 409; đổi về tên cũ -> slug cũ dùng lại được, bỏ khỏi old_slugs
    other = client.post("/api/categories", json={"name": "Khác", "parent_id": root["id"]}).json()
    assert client.patch(f"/api/categories/{child['id']}", json={"slug": other["slug"]}).status_code == 409
    assert client.patch(f"/api/categories/{child['id']}", json={"slug": "vcgarage"}).status_code == 400   # thiếu slug cha
    r = client.patch(f"/api/categories/{child['id']}", json={"name": "VCgarage"})
    assert r.json()["slug"] == "san-pham.vcgarage"
    assert row(client, "san-pham.vcgarage")["old_slugs"] == ["san-pham.vcgarage-vcsale"]
    assert d["wiki_cards"].find_one({"_id": card})["categories"] == ["khac", "san-pham.vcgarage.bao-gia"]

    # sửa mô tả / tên y nguyên không đổi slug
    assert client.patch(f"/api/categories/{child['id']}", json={"name": "VCgarage", "description": "x"}).json()["slug"] == "san-pham.vcgarage"


def test_rename_mcp(client, member):
    ctx = ctx_for(member)
    mcp_server.create_category(ctx, "Pháp chế", slug="phap-che")
    out = json.loads(mcp_server.update_category(ctx, "phap-che", name="Pháp chế nội bộ"))
    assert out["slug"] == "phap-che-noi-bo"
    out = json.loads(mcp_server.update_category(ctx, "phap-che", new_slug="phap-luat"))   # slug cũ vẫn tra ra
    assert (out["slug"], out["name"]) == ("phap-luat", "Pháp chế nội bộ")


def test_reseed_v2_keeps_renamed_branch(client, member):
    """Chạy lại seed cây v2 sau khi đổi tên nhánh: không tạo lại nhánh slug cũ, giữ tên người đã đổi."""
    from app import tree_v2

    tree_v2.seed()
    n = next(x for x in tree_v2.nodes() if x["slug"].count(".") == 1 and
             any(k["parent_slug"] == x["slug"] for k in tree_v2.nodes()))
    c = categories.categories.find_one({"slug": n["slug"]})
    kids = categories.categories.count_documents({"path": n["slug"]})
    new = client.patch(f"/api/categories/{c['_id']}", json={"name": "Tên mới đặt tay"}).json()["slug"]
    total = categories.categories.count_documents({})
    stats = tree_v2.seed()
    assert stats["created"] == 0 and categories.categories.count_documents({}) == total
    assert not categories.categories.find_one({"slug": n["slug"]})
    got = categories.categories.find_one({"slug": new})
    assert got["name"] == "Tên mới đặt tay" and categories.categories.count_documents({"path": new}) == kids


def test_child_inherits_scheme(client, member):
    root = client.post("/api/categories", json={"name": "Khối thử v2"}).json()
    categories.categories.update_one({"slug": root["slug"]}, {"$set": {"scheme": "v2"}})
    child = client.post("/api/categories", json={"name": "Nhánh con", "parent_id": root["id"]}).json()
    assert categories.categories.find_one({"slug": child["slug"]})["scheme"] == "v2"
    assert child["slug"] in {c["slug"] for c in categories.ai_list()}
