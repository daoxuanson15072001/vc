"""Kênh yêu cầu phát triển Claude Desktop → Claude Code (app/devreq.py)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi import HTTPException

from app import db, devreq

from .conftest import make_user

DESK, CODE = "Claude Desktop", "Claude Code"


@pytest.fixture
def admin():
    devreq.ensure_indexes()
    return make_user("anh", role="admin")


def test_only_admin(admin):
    member = make_user("nv")
    with pytest.raises(HTTPException) as e:
        devreq.submit(member, DESK, "X", "Y")
    assert e.value.status_code == 403


def test_full_cycle_with_question(admin):
    req = devreq.submit(admin, DESK, "Xuất Excel thẻ", "Cần nút xuất", ["Có nút", "File mở được"], "high")
    assert req["status"] == "new" and req["created_via"] == DESK

    got = devreq.claim(admin, CODE)["request"]
    assert got["id"] == req["id"] and got["status"] == "in_progress"
    # đang giữ -> claim lần nữa trả lại chính nó
    assert devreq.claim(admin, CODE)["request"]["id"] == req["id"]

    with pytest.raises(HTTPException):
        devreq.update(admin, CODE, req["id"], status="needs_info")   # thiếu câu hỏi
    devreq.update(admin, CODE, req["id"], status="needs_info", note="Xuất cột nào?", branch="feature/req-1")
    assert devreq.list_requests(admin, "needs_info")["total"] == 1
    assert devreq.claim(admin, CODE)["request"] is None

    devreq.reply(admin, DESK, req["id"], "Tiêu đề + tóm tắt")
    again = devreq.claim(admin, CODE)["request"]
    assert again["id"] == req["id"] and again["branch"] == "feature/req-1"

    with pytest.raises(HTTPException):
        devreq.update(admin, CODE, req["id"], status="done")          # thiếu report
    devreq.update(admin, CODE, req["id"], status="done", commits=["abc123"],
                  report={"summary": "Đã thêm nút", "tests": "pytest ok"})
    final = devreq.get(admin, req["id"])
    assert final["status"] == "done" and final["commits"] == ["abc123"]
    assert final["report"]["summary"] == "Đã thêm nút"
    assert [e["kind"] for e in final["log"]].count("question") == 1
    assert [e["kind"] for e in final["log"]].count("answer") == 1


def test_priority_and_resumed_order(admin):
    low = devreq.submit(admin, DESK, "Thấp", "a", priority="low")
    urgent = devreq.submit(admin, DESK, "Gấp", "b", priority="urgent")
    assert devreq.claim(admin, CODE)["request"]["id"] == urgent["id"]
    devreq.update(admin, CODE, urgent["id"], status="needs_info", note="?")
    devreq.reply(admin, DESK, urgent["id"], "ok")
    other = make_user("anh2", role="admin")
    # yêu cầu làm dở được nhận trước yêu cầu mới
    assert devreq.claim(other, CODE)["request"]["id"] == urgent["id"]
    assert devreq.claim(admin, CODE)["request"]["id"] == low["id"]


def test_not_holder_cannot_update(admin):
    req = devreq.submit(admin, DESK, "X", "Y")
    with pytest.raises(HTTPException) as e:
        devreq.update(admin, CODE, req["id"], note="làm")
    assert e.value.status_code == 409


def test_stale_claim_released(admin):
    req = devreq.submit(admin, DESK, "X", "Y")
    devreq.claim(admin, CODE)
    devreq.dev_requests.update_one({}, {"$set": {"claimed_at": db.now() - timedelta(hours=devreq.CLAIM_TTL_H + 1)}})
    assert devreq.list_requests(admin, "new")["total"] == 1
    other = make_user("anh2", role="admin")
    assert devreq.claim(other, CODE)["request"]["id"] == req["id"]


def test_cancel_and_reopen(admin):
    req = devreq.submit(admin, DESK, "X", "Y")
    devreq.reply(admin, DESK, req["id"], "", cancel=True)
    assert devreq.get(admin, req["id"])["status"] == "cancelled"
    with pytest.raises(HTTPException):
        devreq.reply(admin, DESK, req["id"], "", cancel=True)
    devreq.reply(admin, DESK, req["id"], "Làm lại nhé")
    assert devreq.get(admin, req["id"])["status"] == "new"
    assert devreq.list_requests(admin, "open", mine=True)["total"] == 1
