"""Liên kết tra cứu gắn nhánh lĩnh vực (`links`: [{label, url, note}]) — vd web tra mã phụ tùng các hãng VCPV
phân phối. Các web này chặn nhúng iframe nên trang VCWIKI lọc nhánh chỉ hiện nút mở tab mới. Sửa qua API
(PATCH /api/categories/{id}) và MCP (create_category / update_category; list_categories trả links)."""

from __future__ import annotations

import json

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from app import categories, mcp_server

from .conftest import make_user
from .test_linh_vuc_crud import ctx_for, row

LINK = {"label": "Tra mã Febi", "url": "https://partsfinder.bilsteingroup.com", "note": "Catalog Febi / Blue Print"}


@pytest.fixture
def member(client):
    categories.ensure_indexes()
    u = make_user("thuong")
    client.login(u)
    return u


def test_links_web_create_patch_clear(client, member):
    r = client.post("/api/categories", json={"name": "Phụ tùng", "links": [LINK]})
    assert r.status_code == 201, r.text
    cat = r.json()
    assert row(client, cat["slug"])["links"] == [LINK]

    # khoảng trắng thừa ở tên / ghi chú bị gọn; không gửi links thì giữ nguyên
    two = [{"label": "  Tra mã   Mahle ", "url": " https://catalog.mahle.com/ ", "note": ""}, LINK]
    assert client.patch(f"/api/categories/{cat['id']}", json={"links": two}).status_code == 200
    assert client.patch(f"/api/categories/{cat['id']}", json={"description": "x"}).status_code == 200
    got = row(client, cat["slug"])["links"]
    assert got[0] == {"label": "Tra mã Mahle", "url": "https://catalog.mahle.com/", "note": ""} and got[1] == LINK

    assert client.patch(f"/api/categories/{cat['id']}", json={"links": []}).status_code == 200   # [] = xoá hết
    assert row(client, cat["slug"])["links"] == []


@pytest.mark.parametrize("bad", [
    {"label": "A", "url": "ftp://x.com"},                    # không phải http(s)
    {"label": "A", "url": "tramaphutung.com"},               # thiếu scheme
    {"label": "A", "url": "https://localhost"},              # thiếu tên miền
    {"label": "A", "url": "javascript:alert(1)"},
    {"label": "", "url": "https://x.com"},                   # tên rỗng
    {"label": "A" * 81, "url": "https://x.com"},             # tên quá dài
    {"label": "A", "url": "https://x.com", "note": "n" * 201},
])
def test_links_validate(client, member, bad):
    cat = client.post("/api/categories", json={"name": "Kiểm tra"}).json()
    assert client.patch(f"/api/categories/{cat['id']}", json={"links": [bad]}).status_code == 422
    assert client.post("/api/categories", json={"name": "Khác", "links": [bad]}).status_code == 422


def test_links_max(client, member):
    cat = client.post("/api/categories", json={"name": "Nhiều link"}).json()
    many = [{"label": f"L{i}", "url": f"https://site{i}.com"} for i in range(categories.LINKS_MAX + 1)]
    assert client.patch(f"/api/categories/{cat['id']}", json={"links": many}).status_code == 422
    assert client.patch(f"/api/categories/{cat['id']}", json={"links": many[:-1]}).status_code == 200


def test_links_mcp(client, member):
    ctx = ctx_for(member)
    res = json.loads(mcp_server.create_category(ctx, "Phụ tùng châu Âu", slug="pt-eu", links=[LINK]))
    assert res["created"]
    json.loads(mcp_server.create_category(ctx, "Không link", parent_slug="pt-eu"))

    listed = {c["slug"]: c for c in json.loads(mcp_server.list_categories(ctx, root="pt-eu"))}
    assert listed["pt-eu"]["links"] == [LINK]
    assert "links" not in listed["pt-eu.khong-link"]        # nhánh không có link thì không kèm trường

    lemforder = {"label": "Lemförder", "url": "https://www.zf.com/aftermarket", "note": ""}
    out = json.loads(mcp_server.update_category(ctx, "pt-eu", links=[LINK, lemforder]))
    assert out["links"] == [LINK, lemforder]
    out = json.loads(mcp_server.update_category(ctx, "pt-eu", description="Giữ link"))   # không truyền links -> giữ
    assert len(out["links"]) == 2

    with pytest.raises(ToolError, match="http"):
        mcp_server.update_category(ctx, "pt-eu", links=[{"label": "Sai", "url": "tramaphutung.com"}])
    with pytest.raises(ToolError, match="tối đa 80 ký tự"):
        mcp_server.update_category(ctx, "pt-eu", links=[{"label": "x" * 81, "url": "https://x.com"}])
    with pytest.raises(ToolError, match="tối đa 20 mục"):
        mcp_server.update_category(ctx, "pt-eu", links=[{"label": "a", "url": "https://x.com"}] * 21)
    assert len(json.loads(mcp_server.update_category(ctx, "pt-eu"))["links"]) == 2   # lỗi thì không ghi

    assert json.loads(mcp_server.update_category(ctx, "pt-eu", links=[]))["links"] == []
    assert "links" not in json.loads(mcp_server.list_categories(ctx, root="pt-eu"))[0]
