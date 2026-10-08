"""Trả về đề xuất (GOV-13 — docs/BA.md mục 16.3, 16.8; DESIGN Phần VIII TK-04d).

Người duyệt bước hiện tại trả đề xuất về người đề xuất sửa (lý do bắt buộc): đề xuất vẫn `open`, mang `returned`, rời
hộp *Chờ tôi duyệt*, không duyệt / từ chối được (409) cho tới khi người đề xuất *Gửi lại* — về đúng bước đang duyệt,
hạn tính lại, lượt duyệt bước trước giữ nguyên."""

from __future__ import annotations

import json
from datetime import timedelta

import pytest

from app import db, mcp_server
from app.kb import changes
from app.kb.changes import change_requests
from app.kb.revisions import cards
from tests.test_changes import as_, ctx_for, decide, new_card, w  # noqa: F401 — fixture kho + cây lĩnh vực dùng chung
from tests.test_changes import indexes  # noqa: F401


def inbox_ids(client, user) -> list[str]:
    r = as_(client, user).get("/api/wiki/changes?inbox=1")
    assert r.status_code == 200, r.text
    return [c["id"] for c in r.json()["items"]]


def counts(client, user) -> dict:
    r = as_(client, user).get("/api/me/inbox/counts")
    assert r.status_code == 200, r.text
    return r.json()


def resubmit(client, user, cid, **body):
    return as_(client, user).post(f"/api/wiki/changes/{cid}/resubmit", json=body)


@pytest.fixture
def proposal(w):  # noqa: F811
    """Đề xuất sửa thẻ vận hành của viewer (bước 1: editor, bước 2: owner2)."""
    card = new_card(w, level="van-hanh")
    ch = changes.propose_update(card, w.viewer, {"body": "Bước 1\nBước 2 (sửa)"}, [], "Sửa bước 2")
    return card, str(ch["_id"])


def test_return_needs_reason_and_reviewer_rights(client, w, proposal):  # noqa: F811
    _card, cid = proposal
    r = decide(client, w.editor, cid, "return")
    assert r.status_code == 400 and r.json()["detail"] == "Cần ghi lý do trả về"
    r = decide(client, w.editor, cid, "return", "   ")
    assert r.status_code == 400
    assert decide(client, w.viewer, cid, "return", "Tự trả").status_code == 403       # bốn mắt: người đề xuất
    assert decide(client, w.owner2, cid, "return", "Chưa tới bước 2").status_code == 403   # chưa tới lượt bước 2
    assert not change_requests.find_one({"_id": changes._oid(cid)}).get("returned")


def test_return_leaves_inbox_blocks_decisions_then_resubmit_back_to_same_step(client, w, proposal):  # noqa: F811
    card, cid = proposal
    assert decide(client, w.editor, cid, comment="Ổn").json()["step"] == 2
    assert cid in inbox_ids(client, w.owner2)

    r = decide(client, w.owner2, cid, "return", "Thiếu số liệu bước 2")
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["status"] == "open" and o["returned"]["step"] == 2 and o["returned"]["note"] == "Thiếu số liệu bước 2"
    assert o["returned_by_name"] == "owner2" and o["can_decide"] is False and o["can_return"] is False
    assert [(a["step"], a["decision"]) for a in o["approvals"]] == [(1, "approve"), (2, "return")]
    assert cards.find_one({"_id": card["_id"]})["current_revision"] == 1           # không tạo phiên bản

    # rời hộp duyệt; không duyệt / từ chối / trả về lần nữa được (409); nhận xét vẫn được
    assert cid not in inbox_ids(client, w.owner2)
    assert counts(client, w.owner2)["review"] == 0
    for decision in ("approve", "reject", "return"):
        r = decide(client, w.owner2, cid, decision, "x")
        assert r.status_code == 409 and "trả về" in r.json()["detail"], (decision, r.text)
    assert decide(client, w.owner2, cid, "comment", "Nhớ ghi nguồn số liệu").status_code == 200

    # người đề xuất: tab Tôi đề xuất + bộ lọc Cần sửa + số việc
    mine = as_(client, w.viewer).get("/api/wiki/changes?mine=1").json()["items"]
    row = next(c for c in mine if c["id"] == cid)
    assert row["returned"]["note"] == "Thiếu số liệu bước 2" and row["can_resubmit"] is True and row["overdue"] is False
    only = as_(client, w.viewer).get("/api/wiki/changes?mine=1&status=returned").json()
    assert [c["id"] for c in only["items"]] == [cid]
    assert counts(client, w.viewer)["returned_to_me"] == 1
    assert counts(client, w.owner2)["returned_to_me"] == 0

    # hạn cũ đã quá → gửi lại tính hạn mới từ lúc gửi
    old = db.now() - timedelta(days=30)
    change_requests.update_one({"_id": changes._oid(cid)}, {"$set": {"step_started_at": old, "due_at": old,
                                                                     "escalate_at": old}})
    assert resubmit(client, w.editor, cid).status_code == 403                    # không phải người đề xuất
    r = resubmit(client, w.viewer, cid, proposal={"body": "Bước 1\nBước 2 (sửa, có số liệu)"},
                 summary="Sửa bước 2 + số liệu", note="Đã thêm số liệu")
    assert r.status_code == 200, r.text
    o = r.json()
    assert o.get("returned") is None and o["status"] == "open" and o["step"] == 2 and o["summary"] == "Sửa bước 2 + số liệu"
    assert [(a["step"], a["decision"]) for a in o["approvals"]][-1] == (2, "resubmit")
    assert o["approvals"][-1]["comment"] == "Đã thêm số liệu"
    doc = change_requests.find_one({"_id": changes._oid(cid)})
    assert "returned" not in doc and doc["due_at"] > db.now() and doc["step_started_at"] > old
    assert doc["proposal"]["set"]["body"] == "Bước 1\nBước 2 (sửa, có số liệu)"
    assert resubmit(client, w.viewer, cid).status_code == 409                    # không còn bị trả về
    assert counts(client, w.viewer)["returned_to_me"] == 0

    # về đúng bước 2 (lượt bước 1 giữ nguyên) → chủ nhánh duyệt xong
    assert cid in inbox_ids(client, w.owner2) and cid not in inbox_ids(client, w.editor)
    r = decide(client, w.owner2, cid)
    assert r.status_code == 200 and r.json()["status"] == "approved", r.text
    assert cards.find_one({"_id": card["_id"]})["body"] == "Bước 1\nBước 2 (sửa, có số liệu)"


def test_return_at_step1_and_four_eyes_kept(client, w, proposal):  # noqa: F811
    _card, cid = proposal
    assert decide(client, w.editor, cid, "return", "Viết rõ hơn").json()["returned"]["step"] == 1
    assert resubmit(client, w.viewer, cid, note="Đã viết lại").status_code == 200
    assert decide(client, w.viewer, cid).status_code == 403                      # người đề xuất vẫn không tự duyệt
    r = decide(client, w.editor, cid)
    assert r.status_code == 200 and r.json()["step"] == 2
    assert decide(client, w.editor, cid).status_code == 403                      # người bước 1 không làm bước 2


def test_withdraw_while_returned(client, w, proposal):  # noqa: F811
    _card, cid = proposal
    decide(client, w.editor, cid, "return", "Chưa rõ")
    r = as_(client, w.viewer).post(f"/api/wiki/changes/{cid}/withdraw", json={"reason": "Bỏ"})
    assert r.status_code == 200 and r.json()["status"] == "withdrawn"
    assert counts(client, w.viewer)["returned_to_me"] == 0
    assert resubmit(client, w.viewer, cid).status_code == 409


def test_resubmit_on_newer_card_revision_needs_rebase(client, w, proposal):  # noqa: F811
    card, cid = proposal
    decide(client, w.editor, cid, "return", "Chưa rõ")
    other = changes.propose_update(card, w.author, {"title": "Tên mới"}, [])
    decide(client, w.editor, str(other["_id"]))
    assert decide(client, w.owner2, str(other["_id"])).json()["status"] == "approved"
    r = resubmit(client, w.viewer, cid, note="Đã sửa")
    assert r.status_code == 200 and r.json()["status"] == "needs_rebase" and r.json().get("returned") is None


def test_resubmit_create_draft_without_proposal(client, w):  # noqa: F811
    draft = new_card(w, status="draft", created_by=w.viewer["_id"])
    ch = changes.submit_draft(draft, w.viewer)
    cid = str(ch["_id"])
    assert decide(client, w.editor, cid, "return", "Thiếu ví dụ").status_code == 200
    r = resubmit(client, w.viewer, cid, proposal={"body": "x"})
    assert r.status_code == 400
    r = resubmit(client, w.viewer, cid, note="Đã thêm ví dụ trong thẻ")
    assert r.status_code == 200 and r.json()["novelty_status"] == "pending"


def test_mcp_return_and_resubmit(client, w, proposal):  # noqa: F811
    _card, cid = proposal
    with pytest.raises(mcp_server.ToolError, match="Cần ghi lý do trả về"):
        mcp_server.review_change(ctx_for(w.editor), cid, "return")
    res = json.loads(mcp_server.review_change(ctx_for(w.editor), cid, "return", "Thiếu nguồn"))
    assert res["status"] == "open" and res["returned"]["note"] == "Thiếu nguồn"
    with pytest.raises(mcp_server.ToolError, match="trả về"):
        mcp_server.review_change(ctx_for(w.editor), cid, "reject", "Không")
    queue = json.loads(mcp_server.list_review_queue(ctx_for(w.editor)))
    assert cid not in [c["id"] for c in queue["items"]]

    with pytest.raises(mcp_server.ToolError):          # không phải của mình
        mcp_server.propose_card_change(ctx_for(w.editor), resubmit_change_id=cid, note="x")
    res = json.loads(mcp_server.propose_card_change(ctx_for(w.viewer), resubmit_change_id=cid,
                                                    changes={"body": "Bước 1\nBước 2 (có nguồn)"}, note="Thêm nguồn"))
    assert res["id"] == cid and res["returned"] is None and res["status"] == "open"
    assert cid in [c["id"] for c in json.loads(mcp_server.list_review_queue(ctx_for(w.editor)))["items"]]


def test_bulk_review_skips_returned_with_own_reason():
    """Duyệt hàng loạt bỏ qua đề xuất đang trả về, lý do riêng (không nhầm "không phải người duyệt")."""
    from app.kb import bulk_review
    ch = {"status": "open", "returned": {"note": "Thiếu nguồn"}, "novelty": {"verdict": "new"}}
    assert bulk_review.assess({"_id": "u"}, {"_id": "c"}, ch, bulk_review.BulkFilter()) == \
        "Đề xuất đã trả về người đề xuất (chờ gửi lại)"
