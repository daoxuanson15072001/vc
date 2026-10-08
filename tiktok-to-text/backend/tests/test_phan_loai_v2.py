"""Phân loại v2 (WK-26, WK-27): cây lĩnh vực 4 cấp, slug đặt tay, scope note, 4 loại thẻ mới, trường level /
division / process_steps, lọc, báo lỗi slug lạ, nạp cây 8 khối."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from app import auth, categories, mcp_server, tree_v2
from app.kb import classify, wiki
from app.kb.pipeline import cards

from .conftest import make_user


@pytest.fixture
def admin(client):
    categories.ensure_indexes()
    u = make_user("admin", role="admin")
    client.login(u)
    return u


def ctx_for(user: dict) -> SimpleNamespace:
    token, _ = auth.issue_api_token(user, "test")
    return SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "claude-code/test"})


def chain(client, *specs) -> list[dict]:
    """Tạo chuỗi nhánh cha → con: specs = (tên, slug)."""
    parent, out = None, []
    for name, slug in specs:
        r = client.post("/api/categories", json={"name": name, "slug": slug, "parent_id": parent})
        assert r.status_code == 201, r.text
        parent = r.json()["id"]
        out.append(r.json())
    return out


def test_tree_four_levels_custom_slug(client, admin):
    made = chain(client, ("Marketing", "mkt"), ("Digital", "mkt.digital"), ("SEO", "mkt.digital.seo"),
                 ("Nghiên cứu từ khoá", "mkt.digital.seo.nghien-cuu-tu-khoa"))
    assert [m["level"] for m in made] == [1, 2, 3, 4]
    r = client.post("/api/categories", json={"name": "Cấp 5", "parent_id": made[-1]["id"]})
    assert r.status_code == 400 and "4 cấp" in r.json()["detail"]
    # slug phải nối sau slug cha, không trùng
    bad = client.post("/api/categories", json={"name": "X", "slug": "khac.x", "parent_id": made[0]["id"]})
    assert bad.status_code == 400
    dup = client.post("/api/categories", json={"name": "Y", "slug": "mkt.digital", "parent_id": made[0]["id"]})
    assert dup.status_code == 409
    # không đặt slug -> sinh từ tên như cũ
    auto = client.post("/api/categories", json={"name": "Quảng cáo trả phí", "parent_id": made[1]["id"]}).json()
    assert auto["slug"] == "mkt.digital.quang-cao-tra-phi"
    # code, scope note, owner
    cid = made[1]["id"]
    r = client.patch(f"/api/categories/{cid}", json={"code": "1.3", "scope_note": "Gồm: SEO\nKhông gồm: sàn → 2.5",
                                                     "owner_id": str(admin["_id"])})
    assert r.status_code == 200
    row = next(c for c in client.get("/api/categories").json() if c["id"] == cid)
    assert row["code"] == "1.3" and row["scope_note"].startswith("Gồm") and row["owner_name"] == "admin"
    # lọc một nhánh ra cả nhánh con tới cấp 4
    assert "mkt.digital.seo.nghien-cuu-tu-khoa" in categories.with_descendants("mkt")


def test_card_v2_fields_web(client, admin):
    chain(client, ("Marketing", "mkt"), ("Digital", "mkt.digital"), ("SEO", "mkt.digital.seo"),
          ("Nghiên cứu từ khoá", "mkt.digital.seo.nghien-cuu-tu-khoa"))
    body = {"type": "sop", "title": "Quy trình nghiên cứu từ khoá",
            "categories": ["mkt.digital.seo.nghien-cuu-tu-khoa"], "level": "thuc-thi",
            "division": ["vcpart", "vcpart"], "process_steps": ["qt.ban-hang-b2b.a"],
            "effective_at": "2026-10-01", "review_cycle_months": 6}
    r = client.post("/api/wiki/cards", json=body)
    assert r.status_code == 201, r.text
    c = r.json()
    assert (c["type"], c["level"], c["division"], c["process_steps"]) == \
        ("sop", "thuc-thi", ["vcpart"], ["qt.ban-hang-b2b.a"])
    assert c["categories"] == ["mkt.digital.seo.nghien-cuu-tu-khoa"]
    assert c["next_review_at"].startswith("2027-04-01")   # cộng 6 tháng lịch (P6)

    for patch, field in [({"level": "sep"}, "level"), ({"division": ["vcx"]}, "division"),
                         ({"process_steps": ["qt.ban-hang.e"]}, "process_steps"),
                         ({"process_steps": ["qt.a.a", "qt.b.b", "qt.c.c"]}, "process_steps"),
                         ({"effective_at": "01/10/2026"}, "effective_at"),
                         ({"categories": ["mkt.khong-co", "mkt"]}, "mkt.khong-co")]:
        r = client.patch(f"/api/wiki/cards/{c['id']}", json=patch)
        assert r.status_code == 400 and field in r.json()["detail"], (patch, r.text)
    r = client.post("/api/wiki/cards", json=body | {"categories": ["seo"]})
    assert r.status_code == 400 and "seo" in r.json()["detail"]

    # gỡ giá trị
    r = client.patch(f"/api/wiki/cards/{c['id']}", json={"level": "", "division": [], "review_cycle_months": 0})
    c2 = r.json()
    assert c2["level"] is None and c2["division"] == ["tap-doan"] and c2["next_review_at"] is None
    for t in ("checklist", "template", "kpi", "hook"):
        assert client.patch(f"/api/wiki/cards/{c['id']}", json={"type": t}).json()["type"] == t


def test_old_cards_defaults_and_filters(client, admin):
    chain(client, ("Marketing", "mkt"))
    old = client.post("/api/wiki/cards", json={"type": "concept", "title": "Thẻ cũ", "categories": ["mkt"]}).json()
    cards.update_one({"_id": __import__("bson").ObjectId(old["id"])},
                     {"$unset": {"level": "", "division": "", "process_steps": ""}})   # như thẻ trước v2
    got = client.get(f"/api/wiki/cards/{old['id']}").json()
    assert (got["level"], got["division"], got["process_steps"]) == (None, ["tap-doan"], [])
    client.post("/api/wiki/cards", json={"type": "kpi", "title": "Tỷ lệ chốt đơn", "categories": ["mkt"],
                                         "level": "van-hanh", "division": ["vcpart"],
                                         "process_steps": ["qt.ban-hang-b2b.b"]})
    client.post("/api/wiki/cards", json={"type": "sop", "title": "Quy trình xưởng", "level": "thuc-thi",
                                         "division": ["vcservice"]})

    def titles(**q):
        return sorted(c["title"] for c in client.get("/api/wiki/cards", params=q).json()["items"])

    assert titles(q="thẻ cũ") == ["Thẻ cũ"]
    assert titles(level="van-hanh") == ["Tỷ lệ chốt đơn"]
    assert titles(division="tap-doan") == ["Thẻ cũ"]
    assert titles(division="vcpart,vcservice") == ["Quy trình xưởng", "Tỷ lệ chốt đơn"]
    assert titles(process_step="qt.ban-hang-b2b.b", category="mkt", type="kpi") == ["Tỷ lệ chốt đơn"]
    assert titles(type="sop,kpi", division="vcservice") == ["Quy trình xưởng"]
    assert client.get("/api/wiki/cards", params={"level": "sep"}).status_code == 400


def test_mcp_card_and_category(client, admin):
    ctx = ctx_for(admin)
    res = json.loads(mcp_server.create_category(ctx, "Marketing", parent_slug=None, slug="mkt", code="1"))
    assert res["slug"] == "mkt" and res["level"] == 1
    json.loads(mcp_server.update_category(ctx, "mkt", scope_note="Gồm: mọi thứ marketing",
                                          owner_email=admin["email"]))
    listed = json.loads(mcp_server.list_categories(ctx, with_scope_note=True))
    assert listed[0]["scope_note"] == "Gồm: mọi thứ marketing" and listed[0]["owner_name"] == "admin"

    c = json.loads(mcp_server.create_card(ctx, "sop", "Mở ca xưởng", categories=["mkt"], level="thuc-thi",
                                          division=["vcservice"], process_steps=["qt.dich-vu-xuong.a"]))
    assert (c["type"], c["level"], c["division"]) == ("sop", "thuc-thi", ["vcservice"])
    got = json.loads(mcp_server.get_card(ctx, c["id"]))
    assert got["level"] == "thuc-thi" and got["process_steps"] == ["qt.dich-vu-xuong.a"]
    with pytest.raises(ToolError, match="level"):
        mcp_server.create_card(ctx, "sop", "Sai", level="thuc_thi")
    with pytest.raises(ToolError, match="mkt.seo"):
        mcp_server.update_card(ctx, c["id"], categories=["mkt.seo"])
    found = json.loads(mcp_server.search_cards(ctx, level="thuc-thi", division="vcservice", type="sop"))
    assert found["total"] == 1 and found["items"][0]["process_steps"] == ["qt.dich-vu-xuong.a"]


def test_seed_tree_v2(admin):
    dry = tree_v2.seed(apply=False)
    assert dry["created"] == len(tree_v2.nodes()) and categories.categories.count_documents({}) == 0
    stats = tree_v2.seed()
    assert stats["by_level"][1] == 8 and stats["by_level"][2] == 47 and stats["by_level"][3] >= 190
    roots = [c["slug"] for c in categories.categories.find({"level": 1}).sort("order", 1)]
    assert roots == ["nen", "mkt", "bh", "tckt", "hcns", "qltt", "mh", "san-pham-vcpv"]
    for c in categories.categories.find({"level": 2}):
        assert c["scope_note"].startswith("Gồm:") and "Không gồm:" in c["scope_note"] and c["code"]
    seo = categories.categories.find_one({"slug": "mkt.digital.seo"})
    assert seo["code"] == "1.3.1" and seo["level"] == 3
    assert categories.categories.count_documents({"path": "mkt.digital.seo", "level": 4}) == 9
    # chạy lại không tạo trùng
    again = tree_v2.seed()
    assert again["created"] == 0 and categories.categories.count_documents({}) == len(tree_v2.nodes())
    # AI chỉ chọn trong cây v2 khi đã nạp; prompt có scope note
    categories._insert("Pháp lý", "cây cũ", None, 99)
    assert "phap-ly" not in [c["slug"] for c in categories.ai_list()]
    tree = categories.prompt_tree()
    assert "  Không gồm: Vận hành xưởng → 0.3; sản phẩm OBD của VCPV → 7" in tree
    assert "Dễ nhầm với: 1.3 Digital — phân biệt" in tree


def test_ai_schema_and_clean():
    schema = wiki.output_schema(["mkt"])
    card = schema["properties"]["cards"]["items"]
    assert {"level", "division", "process_steps"} <= set(card["required"])
    assert set(wiki.CARD_TYPES) >= {"sop", "checklist", "template", "kpi"}
    got = classify.from_ai({"level": "", "division": ["vcx", "vcpart"], "process_steps": ["bịa", "qt.nhan-su.b"]})
    assert got == {"level": None, "division": ["vcpart"], "process_steps": ["qt.nhan-su.b"]}
    assert classify.from_ai({})["division"] == ["tap-doan"]
    # giá trị mặc định không ghi vào DB (snapshot phiên bản không lệch)
    assert classify.ai_card({"title": "x", "level": "", "division": ["tap-doan"], "process_steps": []}) == {"title": "x"}


def test_defaults_not_stored(client, admin):
    c = client.post("/api/wiki/cards", json={"type": "concept", "title": "Mặc định"}).json()
    raw = cards.find_one({"title": "Mặc định"})
    assert not {"level", "division", "process_steps", "next_review_at"} & raw.keys()
    client.patch(f"/api/wiki/cards/{c['id']}", json={"level": "nhap-mon", "division": ["vce"]})
    client.patch(f"/api/wiki/cards/{c['id']}", json={"level": "", "division": []})
    raw = cards.find_one({"title": "Mặc định"})
    assert not {"level", "division"} & raw.keys()
