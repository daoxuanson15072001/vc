"""Sửa lỗi QA cổng MCP / kênh yêu cầu (B1–B13, qa3) và phân loại v2 (P1–P12, qa1) — 26/09/2026."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone

import pytest
from bson import ObjectId
from fastapi import HTTPException
from mcp.server.mcpserver.exceptions import ToolError

from app import categories, db, devreq, mcp_server
from app.kb import classify, revisions
from app.kb.pipeline import cards

from .conftest import make_user
from .test_phan_loai_v2 import chain, ctx_for

DESK, CODE = "Claude Desktop", "Claude Code"


@pytest.fixture
def admin(client):
    categories.ensure_indexes()
    devreq.ensure_indexes()
    revisions.ensure_indexes()
    u = make_user("admin", role="admin")
    client.login(u)
    return u


def cat(slug: str) -> dict:
    return categories.categories.find_one({"slug": slug})


# ---------------------------------------------------------------------------
# Kênh yêu cầu phát triển (devreq)
# ---------------------------------------------------------------------------

def test_b1_concurrent_claim_same_user_holds_one(admin):
    for i in range(12):
        devreq.submit(admin, DESK, f"Việc {i}", "x", priority="urgent")
    for _ in range(3):
        barrier, got = threading.Barrier(8), []

        def run():
            barrier.wait()
            got.append(devreq.claim(admin, CODE)["request"]["id"])

        threads = [threading.Thread(target=run) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        held = list(devreq.dev_requests.find({"status": "in_progress", "claimed_by": admin["_id"]}))
        assert len(held) == 1 and set(got) == {str(held[0]["_id"])}
        devreq.update(admin, CODE, got[0], status="done", report={"summary": "xong"})


def test_b1_legacy_duplicates_released_on_startup(admin):
    devreq.dev_requests.drop_index("one_claim_per_user")
    a = devreq.submit(admin, DESK, "A", "x")
    b = devreq.submit(admin, DESK, "B", "x")
    now = db.now()
    for i, r in enumerate((a, b)):
        devreq.dev_requests.update_one({"_id": ObjectId(r["id"])}, {"$set": {
            "status": "in_progress", "claimed_by": admin["_id"], "claimed_at": now + timedelta(seconds=i)}})
    devreq.ensure_indexes()
    assert devreq.get(admin, a["id"])["status"] == "in_progress"
    got_b = devreq.get(admin, b["id"])
    assert got_b["status"] == "new" and got_b["log"][-1]["by"] is None


def test_b2_b3_report_validation(admin):
    req = devreq.submit(admin, DESK, "X", "Y")
    devreq.claim(admin, CODE)
    for bad in ({"changes": "a.py"}, {"summary": 123}, {"summary": ["a"]}, {"summary": "   "}):
        with pytest.raises(HTTPException) as e:
            devreq.update(admin, CODE, req["id"], report=bad)
        assert e.value.status_code == 422 and "summary" in e.value.detail
    with pytest.raises(HTTPException) as e:
        devreq.update(admin, CODE, req["id"], status="done", report="xong")
    assert e.value.status_code == 422
    ctx = ctx_for(admin)
    with pytest.raises(ToolError, match="summary"):
        mcp_server.update_request(ctx, req["id"], report={"summary": 5})
    devreq.update(admin, CODE, req["id"], report={"summary": "Giữa chừng"})   # report không kèm status vẫn được
    assert devreq.get(admin, req["id"])["report"]["summary"] == "Giữa chừng"


def test_b8_list_requests_status(admin):
    open_req = devreq.submit(admin, DESK, "Mở", "x")
    done = devreq.submit(admin, DESK, "Xong", "x", priority="urgent")
    devreq.claim(admin, CODE)
    devreq.update(admin, CODE, done["id"], status="done", report={"summary": "ok"})
    ids = {r["id"] for r in devreq.list_requests(admin, "open, done")["items"]}
    assert ids == {open_req["id"], done["id"]}
    assert devreq.list_requests(admin, "open")["total"] == 1
    with pytest.raises(HTTPException) as e:
        devreq.list_requests(admin, "foo")
    assert e.value.status_code == 400 and "foo" in e.value.detail


def test_b12_system_log_by_is_null(admin):
    req = devreq.submit(admin, DESK, "X", "Y")
    devreq.claim(admin, CODE)
    devreq.dev_requests.update_one({}, {"$set": {"claimed_at": db.now() - timedelta(hours=devreq.CLAIM_TTL_H + 1)}})
    devreq.list_requests(admin)
    log = devreq.get(admin, req["id"])["log"]
    assert log[-1]["by"] is None and log[0]["by"] == str(admin["_id"])


# ---------------------------------------------------------------------------
# MCP: lỗi model nội bộ, cây lĩnh vực, bộ nhớ, read_ba
# ---------------------------------------------------------------------------

def test_b4_validation_errors_are_readable(admin):
    ctx = ctx_for(admin)
    mcp_server.create_category(ctx, "Gốc", slug="goc")
    cases = [
        (lambda: mcp_server.create_category(ctx, "x" * 81, parent_slug="goc"), "name: tối đa 80"),
        (lambda: mcp_server.create_category(ctx, "SN", parent_slug="goc", scope_note="x" * 2001), "scope_note"),
        (lambda: mcp_server.create_category(ctx, "Code", parent_slug="goc", code="1" * 21), "code: tối đa 20"),
        (lambda: mcp_server.update_category(ctx, "goc", name=""), "name: không được rỗng"),
        (lambda: mcp_server.create_card(ctx, "sop", ""), "title: không được rỗng"),
        (lambda: mcp_server.create_card(ctx, "sop", "x" * 201), "title: tối đa 200"),
        (lambda: mcp_server.save_memory(ctx, "memory", "x" * 201, "b"), "title: tối đa 200"),
    ]
    for fn, msg in cases:
        with pytest.raises(ToolError, match=msg):
            fn()
    c = json.loads(mcp_server.create_card(ctx, "sop", "Thẻ"))
    with pytest.raises(ToolError, match="title: không được rỗng"):
        mcp_server.update_card(ctx, c["id"], title="")


def test_b5_blank_category_name(admin, client):
    ctx = ctx_for(admin)
    mcp_server.create_category(ctx, "Gốc", slug="goc")
    for name in ("   ", ""):
        with pytest.raises(ToolError, match="Cần tên nhánh"):
            mcp_server.create_category(ctx, name, parent_slug="goc")
    r = client.post("/api/categories", json={"name": "   "})
    assert r.status_code == 400
    r = client.patch(f"/api/categories/{cat('goc')['_id']}", json={"name": "   "})
    assert r.status_code == 400 and cat("goc")["name"] == "Gốc"
    assert categories.categories.count_documents({"name": ""}) == 0


def test_b9_p2_p3_hidden_parent(admin, client):
    ctx = ctx_for(admin)
    ids = [c["id"] for c in chain(client, ("Một", "mot"), ("Hai", "mot.hai"), ("Ba", "mot.hai.ba"))]
    client.post("/api/categories", json={"name": "Ba riêng", "slug": "mot.hai.rieng", "parent_id": ids[1]})
    # ẩn riêng một nhánh con trước, rồi ẩn nhánh cha
    assert client.patch(f"/api/categories/{cat('mot.hai.rieng')['_id']}", json={"active": False}).status_code == 200
    assert client.patch(f"/api/categories/{ids[1]}", json={"active": False}).status_code == 200
    assert cat("mot.hai.ba")["active"] is False and cat("mot.hai.ba")["hidden_by"] == "mot.hai"
    # P2 / B9: không tạo / hiện nhánh con khi cha ẩn (web + MCP)
    r = client.post("/api/categories", json={"name": "Con", "parent_id": ids[1]})
    assert r.status_code == 400 and "đã ẩn" in r.json()["detail"]
    assert client.patch(f"/api/categories/{ids[2]}", json={"active": True}).status_code == 400
    with pytest.raises(ToolError, match="đã ẩn"):
        mcp_server.create_category(ctx, "Con", parent_slug="mot.hai")
    with pytest.raises(ToolError, match="đã ẩn"):
        mcp_server.create_category(ctx, "Ba", parent_slug="mot.hai")   # tên trùng: không bật lại con
    assert cat("mot.hai.ba")["active"] is False
    # P3: hiện cha -> con ẩn theo cha hiện lại, con ẩn riêng vẫn ẩn
    assert client.patch(f"/api/categories/{ids[1]}", json={"active": True}).status_code == 200
    assert cat("mot.hai.ba")["active"] is True and "hidden_by" not in cat("mot.hai.ba")
    assert cat("mot.hai.rieng")["active"] is False
    # MCP gọi lại tên trùng của nhánh ẩn khi cha hiện -> bật lại
    res = json.loads(mcp_server.create_category(ctx, "ba riêng", parent_slug="mot.hai"))
    assert res["created"] is False and cat("mot.hai.rieng")["active"] is True


def test_p2_legacy_orphan_not_assignable(admin, client):
    chain(client, ("Một", "mot"), ("Hai", "mot.hai"))
    categories.categories.update_one({"slug": "mot"}, {"$set": {"active": False}})   # dữ liệu cũ: con còn hiện
    assert "mot.hai" not in {c["slug"] for c in client.get("/api/categories").json()}
    assert categories.valid_slugs(["mot.hai"]) == []


def test_p1_card_with_hidden_category_still_editable(admin, client):
    ctx = ctx_for(admin)
    chain(client, ("Một", "mot"))
    chain(client, ("Khác", "khac"))
    c = json.loads(mcp_server.create_card(ctx, "sop", "Thẻ", categories=["mot"]))
    client.patch(f"/api/categories/{cat('mot')['_id']}", json={"active": False})
    r = client.patch(f"/api/wiki/cards/{c['id']}", json={"summary": "Mới", "categories": ["mot"]})
    assert r.status_code == 200 and r.json()["categories"] == ["mot"]
    json.loads(mcp_server.update_card(ctx, c["id"], categories=["mot", "khac"]))
    # slug mới thêm vẫn phải còn trong cây
    r = client.patch(f"/api/wiki/cards/{c['id']}", json={"categories": ["mot", "khong-co"]})
    assert r.status_code == 400 and "khong-co" in r.json()["detail"]


def test_b10_save_memory_keeps_unpassed_fields(admin):
    ctx = ctx_for(admin)
    mcp_server.save_memory(ctx, "memory", "Sở thích màu", "Thích xanh", summary="s1", when_to_use="w1",
                           tags=["mau"])
    res = json.loads(mcp_server.save_memory(ctx, "memory", "so thich mau", "Thích đỏ"))
    assert res["action"] == "updated"
    card = cards.find_one({"memory_key": "so-thich-mau"})
    assert (card["body"], card["summary"], card["when_to_use"], card["tags"]) == ("Thích đỏ", "s1", "w1", ["mau"])
    mcp_server.save_memory(ctx, "memory", "so thich mau", "Thích đỏ", summary="")   # truyền "" thì xoá
    assert cards.find_one({"memory_key": "so-thich-mau"})["summary"] == ""


def test_b13_read_ba_blank_params(admin):
    ctx = ctx_for(admin)
    assert "toc" in json.loads(mcp_server.read_ba(ctx, query="   "))
    assert "toc" in json.loads(mcp_server.read_ba(ctx, section="  "))


# ---------------------------------------------------------------------------
# Phân loại v2: lọc nhiều giá trị, kiểm tra ngày / chu kỳ, ngày rà soát, phiên bản
# ---------------------------------------------------------------------------

def test_b6_b7_multi_value_filters(admin, client):
    ctx = ctx_for(admin)
    mcp_server.create_card(ctx, "sop", "QA sop", level="thiet-ke", process_steps=["qt.x.a"])
    mcp_server.create_card(ctx, "kpi", "QA kpi", level="van-hanh", process_steps=["qt.y.b"])
    c = json.loads(mcp_server.create_card(ctx, "checklist", "QA checklist", process_steps=["qt.custom-chain.a"]))
    mcp_server.update_card(ctx, c["id"], status="approved")

    def total(**kw):
        return json.loads(mcp_server.search_cards(ctx, query="QA", **kw))["total"]

    assert total(type="sop, kpi") == 2
    assert total(status="draft, approved") == 3
    assert total(level="thiet-ke, van-hanh") == 2
    assert total(division=" vce , ") == 0 and total(division=" , ") == 3   # chỉ dấu phẩy = không lọc
    assert total(level=",") == 3
    assert total(process_step="qt.x.a, qt.y.b,qt.custom-chain.a") == 3      # B7: không cắt còn 2
    for kw, field in ((dict(type="sop,abc"), "type"), (dict(status="xyz"), "status"),
                      (dict(process_step="qt.x.e"), "process_step")):
        with pytest.raises(ToolError, match=f"Trường {field}"):
            total(**kw)
    assert client.get("/api/wiki/cards", params={"type": "sop, kpi"}).json()["total"] == 2


def test_b11_strict_date_and_cycle(admin, client):
    ctx = ctx_for(admin)
    with pytest.raises(ToolError, match="effective_at"):
        mcp_server.create_card(ctx, "sop", "Rác", effective_at="2026-10-01garbage")
    with pytest.raises(ToolError, match="review_cycle_months"):
        mcp_server.create_card(ctx, "sop", "Bool", review_cycle_months=True)
    assert client.post("/api/wiki/cards", json={"type": "sop", "title": "B", "review_cycle_months": True}
                       ).status_code == 422
    for bad in ("2026-10-01xyz", "20261001", "2026-02-30"):
        with pytest.raises(HTTPException):
            classify.check_effective_at(bad)
    with pytest.raises(HTTPException):
        classify.check_review_cycle(False)
    assert classify.check_effective_at(" 2026-10-01 ").day == 1
    assert classify.check_effective_at("2026-10-01T08:00:00+00:00").hour == 8
    # MCP arg model cũng không đổi true thành 1
    arg_model = mcp_server.mcp._tool_manager.get_tool("create_card").fn_metadata.arg_model
    with pytest.raises(Exception):
        arg_model.model_validate({"type": "sop", "title": "x", "review_cycle_months": True})


def test_p6_next_review_calendar_months():
    d = lambda *a: datetime(*a, tzinfo=timezone.utc)   # noqa: E731
    assert classify.next_review_at(d(2026, 9, 1), 6) == d(2027, 3, 1)
    assert classify.next_review_at(d(2026, 2, 1), 24) == d(2028, 2, 1)
    assert classify.next_review_at(d(2026, 8, 31), 6) == d(2027, 2, 28)
    assert classify.next_review_at(d(2027, 8, 31), 6) == d(2028, 2, 29)
    assert classify.next_review_at(d(2026, 1, 31), 11) == d(2026, 12, 31)
    assert classify.next_review_at(d(2026, 5, 15), 60) == d(2031, 5, 15)


def test_p12_revisions_include_effective_at_and_cycle(admin, client):
    ctx = ctx_for(admin)
    c = json.loads(mcp_server.create_card(ctx, "sop", "Phiên bản"))
    card = cards.find_one({"_id": ObjectId(c["id"])})
    revisions.record_revision(card, admin["_id"], "Bản 1")
    mcp_server.update_card(ctx, c["id"], effective_at="2026-09-01", review_cycle_months=6)
    card = cards.find_one({"_id": card["_id"]})
    assert revisions.has_unversioned_changes(card)
    assert card["next_review_at"].replace(tzinfo=timezone.utc) == datetime(2027, 3, 1, tzinfo=timezone.utc)
    res = revisions.rollback(card, 1, admin, "Bỏ ngày hiệu lực")
    after = res["card"]
    assert not {"effective_at", "review_cycle_months", "next_review_at"} & after.keys()
    # quay lại bản 2 (có ngày) -> next_review_at tính lại
    back = revisions.rollback(after, 2, admin, "Lấy lại")["card"]
    assert back["review_cycle_months"] == 6
    assert back["next_review_at"].replace(tzinfo=timezone.utc) == datetime(2027, 3, 1, tzinfo=timezone.utc)
    labels = {x["label"] for x in revisions.diff(card["_id"], 1, 2)["changes"]}
    assert {"Ngày hiệu lực", "Chu kỳ rà soát (tháng)"} <= labels
