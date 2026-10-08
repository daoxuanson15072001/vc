"""Đề xuất thay đổi + luật duyệt (GOV-02, 04…06, 08 — docs/BA.md mục 16.3–16.5, 16.7, 18.7 quyết định đợt 2)."""

from __future__ import annotations

import json
import threading
from types import SimpleNamespace
from unittest import mock

import pytest
from fastapi import HTTPException

from app import auth, categories, db, mcp_server
from app.kb import changes, revisions
from app.kb.changes import change_requests
from app.kb.revisions import card_revisions, cards
from app.spaces import spaces
from tests.conftest import make_user


@pytest.fixture(autouse=True)
def indexes():
    categories.ensure_indexes()
    revisions.ensure_indexes()
    changes.ensure_indexes()


@pytest.fixture
def w():
    """Kho chung: author (chủ kho), editor (duyệt bước 1), viewer. Cây: bh (cấp 1) › bh.b2b (cấp 2, chủ = owner2)
    › bh.b2b.chot-don (cấp 3). admin: quản trị viên (TGĐ tạm thời)."""
    p = SimpleNamespace(author=make_user("author"), editor=make_user("editor"), viewer=make_user("viewer"),
                        owner2=make_user("owner2"), admin=make_user("admin", role="admin"))
    space = {"name": "Kho KD", "description": "", "type": "shared", "owner_id": p.author["_id"],
             "visibility": "private", "created_at": db.now(),
             "members": [{"user_id": p.author["_id"], "role": "owner"}, {"user_id": p.editor["_id"], "role": "editor"},
                         {"user_id": p.viewer["_id"], "role": "viewer"}]}
    space["_id"] = spaces.insert_one(space).inserted_id
    root = categories._insert("Bán hàng", "", None, 0, slug="bh")
    tier2 = categories._insert("B2B", "", root, 0, slug="bh.b2b", owner_id=p.owner2["_id"])
    categories._insert("Chốt đơn", "", tier2, 0, slug="bh.b2b.chot-don")
    categories._insert("Khác", "", root, 1, slug="bh.khac")          # nhánh tầng 2 chưa có chủ
    p.space = space
    return p


def new_card(w, status="approved", **fields) -> dict:
    now = db.now()
    doc = {"space_id": w.space["_id"], "type": "framework", "title": "Chốt đơn B2B", "summary": "Tóm tắt",
           "body": "Bước 1\nBước 2", "key_points": ["Ý A"], "tags": ["ban-hang"], "categories": ["bh.b2b.chot-don"],
           "status": status, "origin": "manual", "created_by": w.author["_id"], "created_at": now,
           "updated_at": now} | fields
    doc["_id"] = cards.insert_one(doc).inserted_id
    if status == "approved":
        revisions.record_revision(doc, w.author["_id"], "Bản đầu")
    return cards.find_one({"_id": doc["_id"]})


def as_(client, user):
    client.login(user)
    return client


def decide(client, user, cid, decision="approve", comment="", **kw):
    return as_(client, user).post(f"/api/wiki/changes/{cid}/decide",
                                  json={"decision": decision, "comment": comment} | kw)


# ---------------------------------------------------------------------------
# PATCH thẻ đã duyệt -> đề xuất; 2 bước theo level
# ---------------------------------------------------------------------------

def test_patch_approved_card_creates_update_proposal_then_two_steps(client, w):
    card = new_card(w, level="van-hanh")
    cid = str(card["_id"])
    r = as_(client, w.viewer).patch(f"/api/wiki/cards/{cid}", json={"body": "Bước 1\nBước 2 (sửa)",
                                                                     "change_summary": "Sửa bước 2"})
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["body"] == "Bước 1\nBước 2" and res["change"]["kind"] == "update"   # thẻ chưa đổi
    assert "đề xuất" in res["notice"]
    ch_id = res["change"]["id"]
    ch = client.get(f"/api/wiki/changes/{ch_id}").json()
    assert ch["change_kind"] == "major" and ch["step2_label"] == "Chủ nhánh tầng 2" and ch["step2_names"] == ["owner2"]
    assert [d["field"] for d in ch["diff"]] == ["body"]

    # bốn mắt: người đề xuất không tự duyệt
    assert decide(client, w.viewer, ch_id).status_code == 403
    assert decide(client, w.admin, ch_id).status_code == 404          # admin ngoài kho, không phải người duyệt thẻ này
    r = decide(client, w.editor, ch_id, comment="Ổn")
    assert r.status_code == 200 and r.json()["status"] == "open" and r.json()["step"] == 2
    assert decide(client, w.editor, ch_id).status_code == 403          # người bước 1 không làm bước 2
    assert decide(client, w.author, ch_id).status_code == 403          # chủ kho không phải chủ nhánh
    r = decide(client, w.owner2, ch_id, change_kind="minor")           # người duyệt đổi mức thay đổi
    assert r.status_code == 200 and r.json()["status"] == "approved", r.text

    card = cards.find_one({"_id": card["_id"]})
    assert card["body"] == "Bước 1\nBước 2 (sửa)" and card["current_revision"] == 2 and card["status"] == "approved"
    rev = card_revisions.find_one({"card_id": card["_id"], "rev": 2})
    assert rev["reason"] == "Sửa bước 2" and rev["change_kind"] == "minor"
    assert rev["approved_by"] == [w.editor["_id"], w.owner2["_id"]] and rev["author_id"] == w.viewer["_id"]
    appr = change_requests.find_one({"_id": rev["change_request_id"]})["approvals"]
    assert [(a["step"], a["decision"]) for a in appr] == [(1, "approve"), (2, "approve")]


def test_step2_by_level_and_fallback_to_admin(client, w):
    top = new_card(w, level="thiet-ke")
    ch = changes.propose_update(top, w.viewer, {"title": "Mới"}, [])
    assert changes.step2_rule(ch, top) == ([w.admin["_id"]], "TGĐ (tạm thời: quản trị viên)")
    assert decide(client, w.owner2, str(ch["_id"])).status_code == 404   # chủ nhánh không là người duyệt bậc thiết kế

    no_level = new_card(w)                                   # chưa có level -> như van-hanh
    ch2 = changes.propose_update(no_level, w.viewer, {"title": "Mới"}, [])
    assert changes.step2_rule(ch2, no_level)[0] == [w.owner2["_id"]]

    orphan = new_card(w, level="thuc-thi", categories=["bh.khac"])   # nhánh tầng 2 chưa gán chủ -> admin
    ch3 = changes.propose_update(orphan, w.viewer, {"title": "Mới"}, [])
    assert changes.step2_rule(ch3, orphan)[0] == [w.admin["_id"]]

    # hạ level để né TGĐ vẫn cần TGĐ
    ch4 = changes.propose_update(top, w.viewer, {"level": "thuc-thi"}, [])
    assert changes.step2_rule(ch4, top)[0] == [w.admin["_id"]]
    assert ch4["change_kind"] == "minor"


def test_min_approvers_one_single_click(client, w):
    changes.meta.update_one({"_id": changes.SETTINGS_ID}, {"$set": {"min_approvers": 1}}, upsert=True)
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"summary": "Tóm tắt mới"}, [])
    r = decide(client, w.editor, str(ch["_id"]))
    assert r.json()["status"] == "approved"
    appr = r.json()["approvals"]
    assert [(a["step"], a["user_name"]) for a in appr] == [(1, "editor"), (2, "editor")]
    assert cards.find_one({"_id": card["_id"]})["summary"] == "Tóm tắt mới"


def test_settings_api_admin_only(client, w):
    assert as_(client, w.editor).put("/api/wiki/review-settings", json={"min_approvers": 1}).status_code == 403
    assert as_(client, w.admin).put("/api/wiki/review-settings", json={"min_approvers": 1}).json()["min_approvers"] == 1
    assert client.get("/api/wiki/review-settings").json()["min_approvers"] == 1
    assert client.put("/api/wiki/review-settings", json={"min_approvers": 3}).status_code == 422


def test_only_step2_person_cannot_take_step1(client, w):
    card = new_card(w, categories=["bh.khac"])            # bước 2 = admin duy nhất
    ch = changes.propose_update(card, w.viewer, {"title": "X"}, [])
    spaces.update_one({"_id": w.space["_id"]}, {"$push": {"members": {"user_id": w.admin["_id"], "role": "editor"}}})
    r = decide(client, w.admin, str(ch["_id"]))
    assert r.status_code == 409 and "bước 2 duy nhất" in r.json()["detail"]


def test_reject_requires_reason_and_withdraw(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "X"}, [])
    assert decide(client, w.editor, str(ch["_id"]), "reject").status_code == 400
    r = decide(client, w.editor, str(ch["_id"]), "reject", "Sai số liệu")
    assert r.json()["status"] == "rejected"
    ch2 = changes.propose_update(card, w.viewer, {"title": "Y"}, [])
    assert as_(client, w.editor).post(f"/api/wiki/changes/{ch2['_id']}/withdraw").status_code == 403
    assert as_(client, w.viewer).post(f"/api/wiki/changes/{ch2['_id']}/withdraw").json()["status"] == "withdrawn"


def test_needs_rebase_after_other_change_approved(client, w):
    changes.meta.update_one({"_id": changes.SETTINGS_ID}, {"$set": {"min_approvers": 1}}, upsert=True)
    card = new_card(w)
    a = changes.propose_update(card, w.viewer, {"title": "A"}, [])
    b = changes.propose_update(card, w.viewer, {"summary": "B"}, [])
    assert decide(client, w.editor, str(a["_id"])).json()["status"] == "approved"
    assert change_requests.find_one({"_id": b["_id"]})["status"] == "needs_rebase"
    assert decide(client, w.editor, str(b["_id"])).status_code == 409
    r = as_(client, w.viewer).post(f"/api/wiki/changes/{b['_id']}/rebase")
    assert r.json()["status"] == "open" and r.json()["base_rev"] == 2
    assert decide(client, w.editor, str(b["_id"])).json()["status"] == "approved"
    c = cards.find_one({"_id": card["_id"]})
    assert (c["title"], c["summary"], c["current_revision"]) == ("A", "B", 3)


def test_rollback_goes_through_owner_approved_change(client, w):
    changes.meta.update_one({"_id": changes.SETTINGS_ID}, {"$set": {"min_approvers": 1}}, upsert=True)
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Tiêu đề sai"}, [])
    decide(client, w.editor, str(ch["_id"]))
    r = as_(client, w.author).post(f"/api/wiki/cards/{card['_id']}/rollback", json={"rev": 1, "reason": "Sai tiêu đề"})
    assert r.status_code == 200, r.text
    rb = r.json()["change"]
    assert rb["kind"] == "rollback" and rb["step2_label"] == "Chủ sở hữu lĩnh vực"
    assert cards.find_one({"_id": card["_id"]})["title"] == "Tiêu đề sai"      # chưa đổi khi chưa duyệt
    assert decide(client, w.editor, rb["id"]).status_code == 403                 # rollback cần chủ lĩnh vực
    assert decide(client, w.owner2, rb["id"]).json()["status"] == "approved"
    c = cards.find_one({"_id": card["_id"]})
    assert c["title"] == "Chốt đơn B2B" and c["current_revision"] == 3
    assert card_revisions.find_one({"card_id": card["_id"], "rev": 3})["reason"] == "Quay về bản 1: Sai tiêu đề"


def test_draft_approve_button_goes_through_rules(client, w):
    card = new_card(w, status="draft")
    cid = str(card["_id"])
    r = as_(client, w.author).patch(f"/api/wiki/cards/{cid}", json={"status": "approved"}).json()
    assert r["status"] == "draft" and "không tự duyệt" in r["notice"]           # tác giả chỉ gửi duyệt
    ch_id = r["change"]["id"]
    r = as_(client, w.editor).patch(f"/api/wiki/cards/{cid}", json={"status": "approved"}).json()
    assert r["status"] == "draft" and r["change"]["id"] == ch_id and r["change"]["step"] == 2
    inbox = as_(client, w.owner2).get("/api/wiki/changes", params={"inbox": 1}).json()
    assert [i["id"] for i in inbox["items"]] == [ch_id]                          # chủ nhánh ngoài kho vẫn thấy
    assert decide(client, w.owner2, ch_id).json()["status"] == "approved"
    c = cards.find_one({"_id": card["_id"]})
    assert c["status"] == "approved" and c["current_revision"] == 1 and c["reviewed_by"] == w.owner2["_id"]
    rev = card_revisions.find_one({"card_id": card["_id"]})
    assert rev["rev"] == 1 and rev["approved_by"] == [w.editor["_id"], w.owner2["_id"]]


def test_editing_draft_resets_approvals_and_reject_needs_reason(client, w):
    card = new_card(w, status="draft")
    ch = changes.submit_draft(card, w.author)
    decide(client, w.editor, str(ch["_id"]))
    as_(client, w.author).patch(f"/api/wiki/cards/{card['_id']}", json={"title": "Sửa khi đang duyệt"})
    assert changes.current_step(change_requests.find_one({"_id": ch["_id"]})) == 1
    r = as_(client, w.editor).patch(f"/api/wiki/cards/{card['_id']}", json={"status": "rejected"})
    assert r.status_code == 400
    r = as_(client, w.editor).patch(f"/api/wiki/cards/{card['_id']}", json={"status": "rejected", "reason": "Trùng"})
    assert r.json()["status"] == "rejected" and r.json()["change"]["status"] == "rejected"


def test_ai_card_uploader_can_approve(client, w):
    changes.meta.update_one({"_id": changes.SETTINGS_ID}, {"$set": {"min_approvers": 1}}, upsert=True)
    card = new_card(w, status="draft", origin="ai")
    changes.submit_new_cards([card["_id"]])
    ch = changes.open_change(card["_id"], "create")
    assert ch["author_ai"] and ch["novelty_status"] == "pending"
    r = as_(client, w.author).patch(f"/api/wiki/cards/{card['_id']}", json={"status": "approved"}).json()
    assert r["status"] == "approved" and r["notice"] == "Đã duyệt"


def test_approved_card_cannot_be_deleted_or_status_changed(client, w):
    card = new_card(w)
    cid = str(card["_id"])
    assert as_(client, w.author).delete(f"/api/wiki/cards/{cid}").status_code == 409
    assert client.patch(f"/api/wiki/cards/{cid}", json={"status": "draft"}).status_code == 400


def test_first_proposal_on_unversioned_card_creates_rev1(client, w):
    changes.meta.update_one({"_id": changes.SETTINGS_ID}, {"$set": {"min_approvers": 1}}, upsert=True)
    now = db.now()
    cid = cards.insert_one({"space_id": w.space["_id"], "type": "concept", "title": "Cũ", "summary": "", "body": "x",
                            "categories": [], "status": "approved", "created_by": w.author["_id"],
                            "created_at": now, "updated_at": now}).inserted_id
    ch = changes.propose_update(cards.find_one({"_id": cid}), w.viewer, {"title": "Mới"}, [])
    decide(client, w.editor, str(ch["_id"]))
    revs = list(card_revisions.find({"card_id": cid}).sort("rev", 1))
    assert [(r["rev"], r["snapshot"]["title"]) for r in revs] == [(1, "Cũ"), (2, "Mới")]


# ---------------------------------------------------------------------------
# Cổng so sánh (worker nền) + đổi kết quả
# ---------------------------------------------------------------------------

def test_novelty_worker_stores_ai_and_human_results(client, w):
    old = new_card(w, title="Chốt đơn bằng câu hỏi đóng")
    card = new_card(w, status="draft", title="Chốt đơn bằng câu hỏi đóng (bản 2)")
    ch = changes.submit_draft(card, w.author)
    fake = {"verdict": "conflict", "related": [{"card_id": old["_id"], "rev": 1, "score": 0.9}],
            "reason": "Trái thẻ cũ", "engine": "heuristic"}
    with mock.patch.object(changes.novelty, "classify", return_value=fake), \
            mock.patch.object(changes.novelty, "ai_available", return_value=False):
        assert changes.novelty_next() is True
        assert changes.novelty_next() is False             # heuristic chỉ chạy lại khi AI sẵn sàng + tới hạn
    got = change_requests.find_one({"_id": ch["_id"]})
    assert got["novelty"]["verdict"] == "conflict" and got["novelty_ai"]["verdict"] == "conflict"
    assert got["novelty_retry_at"] is not None
    # mâu thuẫn -> bước 2 là chủ lĩnh vực của thẻ cũ
    assert changes.step2_rule(got, card)[1].startswith("Chủ sở hữu lĩnh vực của thẻ cũ")
    detail = as_(client, w.editor).get(f"/api/wiki/changes/{ch['_id']}").json()
    assert detail["related_cards"][0]["title"] == "Chốt đơn bằng câu hỏi đóng"
    r = client.post(f"/api/wiki/changes/{ch['_id']}/novelty", json={"verdict": "supplement", "reason": "Thêm ý"})
    assert r.json()["novelty"]["verdict"] == "supplement" and r.json()["novelty_ai"]["verdict"] == "conflict"
    assert client.get("/api/wiki/review-settings").json()["novelty_stats"] == {"total": 1, "overridden": 1, "rate": 1.0}


def test_novelty_endpoint_queues(client, w):
    card = new_card(w, status="draft")
    r = as_(client, w.author).post("/api/wiki/novelty", json={"card_id": str(card["_id"])})
    assert r.status_code == 202 and change_requests.find_one({"card_id": card["_id"]})["novelty_status"] == "pending"


def test_sla_overdue(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "X"}, [])
    old = db.now().replace(year=2020)
    change_requests.update_one({"_id": ch["_id"]}, {"$set": {"due_at": old, "escalate_at": old}})
    item = as_(client, w.editor).get("/api/wiki/changes", params={"inbox": 1}).json()["items"][0]
    assert item["overdue"] and item["needs_escalation"]
    assert changes.add_business_days(db.now().replace(year=2026, month=9, day=25), 3).day == 30   # T6 + 3 = T4


# ---------------------------------------------------------------------------
# MCP
# ---------------------------------------------------------------------------

def ctx_for(user: dict) -> SimpleNamespace:
    token, _ = auth.issue_api_token(user, "test")
    return SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "claude-code/test"})


def test_mcp_update_card_on_approved_creates_proposal_and_review_tools(client, w):
    card = new_card(w)
    res = json.loads(mcp_server.update_card(ctx_for(w.author), str(card["_id"]), title="Tiêu đề AI"))
    assert res["title"] == "Chốt đơn B2B" and res["change_request"]["kind"] == "update" and "đề xuất" in res["notice"]
    queue = json.loads(mcp_server.list_review_queue(ctx_for(w.editor)))
    assert queue["total"] == 1 and queue["items"][0]["card"]["title"] == "Chốt đơn B2B"
    cid = queue["items"][0]["id"]
    view = json.loads(mcp_server.review_change(ctx_for(w.editor), cid))
    assert view["diff"][0]["field"] == "title"
    # SYS-12 (18.10 điểm 2 — đã quyết 26/09): MCP không duyệt, người bấm Duyệt trên web
    with pytest.raises(mcp_server.ToolError, match=f"/wiki/review\\?change={cid}"):
        mcp_server.review_change(ctx_for(w.editor), cid, "approve")
    assert decide(client, w.editor, cid).json()["step"] == 2
    done = decide(client, w.owner2, cid).json()
    assert done["status"] == "approved" and cards.find_one({"_id": card["_id"]})["title"] == "Tiêu đề AI"

    p = json.loads(mcp_server.propose_card_change(ctx_for(w.viewer), str(card["_id"]), "obsolete",
                                                  summary="Quy trình đã thay"))
    assert p["kind"] == "obsolete" and p["step2_label"] == "Chủ sở hữu lĩnh vực"


def test_mcp_create_card_enters_review_and_ai_cannot_approve(client, w):
    ctx = ctx_for(w.author)
    c = json.loads(mcp_server.create_card(ctx, "concept", "Thẻ AI", space_id=str(w.space["_id"])))
    assert c["change_request"]["kind"] == "create"
    res = json.loads(mcp_server.update_card(ctx, c["id"], status="approved"))
    assert res["status"] == "draft" and "SYS-12" in res["notice"]


# ---------------------------------------------------------------------------
# Sinh câu hỏi khi duyệt (BA 17.6 v0.12 — luồng H cung cấp learn/generate.py)
# ---------------------------------------------------------------------------

def test_approval_triggers_question_drafts_for_execution_levels(client, w):
    import sys
    changes.meta.update_one({"_id": changes.SETTINGS_ID}, {"$set": {"min_approvers": 1}}, upsert=True)
    fake = SimpleNamespace(draft_questions_for_card=mock.Mock(side_effect=ValueError("loại thẻ không có bảng 17.6")))
    with mock.patch.dict(sys.modules, {"app.learn.generate": fake}), \
            mock.patch.object(changes, "spawn", side_effect=lambda fn: fn()):
        for level, expected in [("thuc-thi", 1), ("van-hanh", 1), ("thiet-ke", 0), (None, 0)]:
            fake.draft_questions_for_card.reset_mock()
            card = new_card(w, status="draft", level=level, origin="ai") if level else new_card(w, status="draft",
                                                                                                origin="ai")
            ch = changes.submit_draft(card, None, "ai")
            approver = w.admin if level == "thiet-ke" else w.owner2
            r = decide(client, approver, str(ch["_id"]))
            assert r.json()["status"] == "approved", r.text           # lỗi sinh câu hỏi không chặn việc duyệt
            assert fake.draft_questions_for_card.call_count == expected, level
            if expected:
                args, kw = fake.draft_questions_for_card.call_args
                assert args[0]["_id"] == card["_id"] and args[1] == 1 and args[2]["_id"] == approver["_id"]
                assert kw == {"n": 2}


# ---------------------------------------------------------------------------
# Sửa lỗi QA luồng F (26/09/2026) — N-1, N-2, C-1…C-3, lỗi phụ
# ---------------------------------------------------------------------------

def min1():
    changes.meta.update_one({"_id": changes.SETTINGS_ID}, {"$set": {"min_approvers": 1}}, upsert=True)


def test_n1_four_eyes_by_card_author_not_submitter(client, w):
    """Người duyệt bấm ✓ Duyệt trên thẻ nháp của người khác → ghi là bước 1; tác giả thật không duyệt được."""
    card = new_card(w, status="draft", created_by=w.editor["_id"])      # editor viết thẻ, chưa gửi duyệt
    cid = str(card["_id"])
    r = as_(client, w.author).patch(f"/api/wiki/cards/{cid}", json={"status": "approved"}).json()
    assert r["notice"] == "Đã duyệt bước 1 — chờ người duyệt bước 2", r["notice"]
    ch = change_requests.find_one({"_id": changes._oid(r["change"]["id"])})
    assert ch["created_by"] == w.editor["_id"] and ch["submitted_by"] == w.author["_id"]
    assert ch["approvals"][0]["user_id"] == w.author["_id"]
    # tác giả thật không thấy trong hộp duyệt, không duyệt được bước nào
    assert as_(client, w.editor).get("/api/wiki/changes", params={"inbox": 1}).json()["total"] == 0
    assert decide(client, w.editor, r["change"]["id"]).status_code == 403
    # min_approvers = 1: tác giả vẫn không tự duyệt xong một mình
    min1()
    card2 = new_card(w, status="draft", created_by=w.editor["_id"])
    ch2 = changes.submit_draft(card2, w.author)
    assert ch2["created_by"] == w.editor["_id"]
    assert decide(client, w.editor, str(ch2["_id"])).status_code == 403
    assert decide(client, w.author, str(ch2["_id"])).json()["status"] == "approved"


def test_n1_editor_of_draft_content_is_author(client, w):
    """Người sửa nội dung thẻ nháp trên web cũng là tác giả — không duyệt được thẻ đó."""
    min1()
    card = new_card(w, status="draft")
    cid = str(card["_id"])
    as_(client, w.editor).patch(f"/api/wiki/cards/{cid}", json={"body": "Nội dung editor viết lại"})
    r = client.patch(f"/api/wiki/cards/{cid}", json={"status": "approved"}).json()
    assert r["status"] == "draft" and "không tự duyệt" in r["notice"]
    assert decide(client, w.editor, r["change"]["id"]).status_code == 403
    # lưu lại không đổi gì thì không thành tác giả
    spaces.update_one({"_id": w.space["_id"]}, {"$push": {"members": {"user_id": w.admin["_id"], "role": "editor"}}})
    as_(client, w.admin).patch(f"/api/wiki/cards/{cid}", json={"title": card["title"]})
    assert w.admin["_id"] not in cards.find_one({"_id": card["_id"]}).get("edited_by", [])


def test_n2_ai_memory_card_cannot_become_approved_knowledge(client, w):
    # thẻ bộ nhớ AI đã duyệt → đổi loại sang Quy định = đề xuất, thẻ giữ nguyên
    mem = new_card(w, status="draft", type="memory", title="Ghi nhớ")
    cid = str(mem["_id"])
    assert as_(client, w.author).patch(f"/api/wiki/cards/{cid}", json={"status": "approved"}).json()["status"] == "approved"
    r = client.patch(f"/api/wiki/cards/{cid}", json={"type": "regulation", "title": "Quy định X", "body": "Điều 1"})
    res = r.json()
    assert r.status_code == 200 and res["type"] == "memory" and res["change"]["kind"] == "update"
    assert res["change"]["change_kind"] == "major"
    assert decide(client, w.author, res["change"]["id"]).status_code == 403            # tác giả không tự duyệt
    assert cards.find_one({"_id": mem["_id"]})["type"] == "memory"

    # biến thể một lệnh: thẻ nháp bộ nhớ AI → PATCH type + status=approved → chỉ gửi duyệt
    mem2 = new_card(w, status="draft", type="memory", title="Ghi nhớ 2")
    r = client.patch(f"/api/wiki/cards/{mem2['_id']}", json={"type": "regulation", "status": "approved", "body": "Mới"})
    c = cards.find_one({"_id": mem2["_id"]})
    assert c["type"] == "regulation" and c["status"] == "draft" and "không tự duyệt" in r.json()["notice"]
    assert changes.open_change(mem2["_id"], "create")

    # MCP update_card cùng đường
    mem3 = new_card(w, status="draft", type="skill", title="Skill")
    res = json.loads(mcp_server.update_card(ctx_for(w.author), str(mem3["_id"]), type="sop", status="approved"))
    assert res["status"] == "draft" and cards.find_one({"_id": mem3["_id"]})["type"] == "sop"
    # thẻ tri thức nháp đang chờ duyệt đổi sang bộ nhớ AI → đề xuất create được rút
    ch = changes.open_change(mem3["_id"], "create")
    client.patch(f"/api/wiki/cards/{mem3['_id']}", json={"type": "memory"})
    got = change_requests.find_one({"_id": ch["_id"]})
    assert got["status"] == "withdrawn" and got["withdrawn_by_system"]


def _run_parallel(fns) -> list:
    """Chạy các hàm cùng lúc (rào chắn cho xuất phát đồng thời); lỗi HTTP trả về dạng giá trị."""
    results: list = [None] * len(fns)
    barrier = threading.Barrier(len(fns))

    def run(i, fn):
        barrier.wait()
        try:
            results[i] = fn()
        except HTTPException as e:
            results[i] = e
    threads = [threading.Thread(target=run, args=(i, fn)) for i, fn in enumerate(fns)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def test_c1_double_click_final_approval_makes_one_revision(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Mới"}, [])
    decide(client, w.editor, str(ch["_id"]))
    res = _run_parallel([lambda: changes.decide(change_requests.find_one({"_id": ch["_id"]}), w.owner2, "approve")
                         for _ in range(4)])
    ok = [r for r in res if isinstance(r, dict)]
    assert len(ok) == 1 and ok[0]["status"] == "approved", res
    assert all(isinstance(r, HTTPException) and r.status_code == 409 for r in res if not isinstance(r, dict))
    got = change_requests.find_one({"_id": ch["_id"]})
    assert [a["step"] for a in got["approvals"] if a["decision"] == "approve"] == [1, 2]
    assert card_revisions.count_documents({"card_id": card["_id"]}) == 2
    assert cards.find_one({"_id": card["_id"]})["current_revision"] == 2


def test_c1_two_proposals_same_base_concurrently_second_needs_rebase(client, w):
    card = new_card(w)
    a = changes.propose_update(card, w.viewer, {"body": "Nội dung A"}, [])
    b = changes.propose_update(card, w.viewer, {"body": "Nội dung B"}, [])
    for x in (a, b):
        decide(client, w.editor, str(x["_id"]))
    res = _run_parallel([lambda x=x: changes.decide(change_requests.find_one({"_id": x["_id"]}), w.owner2, "approve")
                         for x in (a, b)])
    ok = [r for r in res if isinstance(r, dict)]
    assert len(ok) == 1, res
    loser = b if ok[0]["_id"] == a["_id"] else a
    got = change_requests.find_one({"_id": loser["_id"]})
    assert got["status"] == "needs_rebase"
    assert [x["step"] for x in got["approvals"] if x["decision"] == "approve"] == [1]    # lượt bước 2 được gỡ
    c = cards.find_one({"_id": card["_id"]})
    assert c["current_revision"] == 2 and c["body"] == ok[0]["proposal"]["set"]["body"]
    assert card_revisions.count_documents({"card_id": card["_id"]}) == 2


def test_c1_concurrent_step1_only_one_recorded(client, w):
    e2 = make_user("editor2")
    spaces.update_one({"_id": w.space["_id"]}, {"$push": {"members": {"user_id": e2["_id"], "role": "editor"}}})
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Mới"}, [])
    res = _run_parallel([lambda u=u: changes.decide(change_requests.find_one({"_id": ch["_id"]}), u, "approve")
                         for u in (w.editor, e2)])
    assert sum(isinstance(r, dict) for r in res) == 1, res
    got = change_requests.find_one({"_id": ch["_id"]})
    assert len([x for x in got["approvals"] if x["step"] == 1]) == 1 and got["status"] == "open"


def test_c2_step2_reviewer_outside_space_gets_content_not_link(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Mới"}, [])
    decide(client, w.editor, str(ch["_id"]))
    o = as_(client, w.owner2).get(f"/api/wiki/changes/{ch['_id']}").json()
    assert o["can_open_card"] is False and o["after"]["title"] == "Mới" and o["before"]["body"] == "Bước 1\nBước 2"
    assert as_(client, w.editor).get(f"/api/wiki/changes/{ch['_id']}").json()["can_open_card"] is True


def test_c3_obsolete_card_blocks_new_proposals_and_closes_open_ones(client, w):
    card = new_card(w)
    cid = str(card["_id"])
    pending = changes.propose_update(card, w.viewer, {"title": "Đang sửa"}, [])
    ob = as_(client, w.viewer).post("/api/wiki/changes", json={"kind": "obsolete", "card_id": cid,
                                                                "summary": "Quy trình đã thay"}).json()
    decide(client, w.editor, ob["id"])
    assert decide(client, w.owner2, ob["id"]).json()["status"] == "approved"
    got = change_requests.find_one({"_id": pending["_id"]})
    assert got["status"] == "withdrawn" and "lỗi thời" in got["withdraw_reason"]
    as_(client, w.viewer)
    assert client.patch(f"/api/wiki/cards/{cid}", json={"title": "Sửa tiếp"}).status_code == 409
    for body in ({"kind": "obsolete", "summary": "Lần nữa"}, {"kind": "rollback", "rev": 1, "summary": "Quay"},
                 {"kind": "update", "changes": {"title": "X"}}):
        r = client.post("/api/wiki/changes", json=body | {"card_id": cid})
        assert r.status_code == 409 and "lỗi thời" in r.json()["detail"], body


def test_minor_bugs_reject_kind_comment_closed_novelty(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "X"}, [], change_kind="minor")
    # P-1: từ chối thiếu lý do không ghi gì
    assert decide(client, w.editor, str(ch["_id"]), "reject", change_kind="major").status_code == 400
    assert change_requests.find_one({"_id": ch["_id"]})["change_kind"] == "minor"
    # nhận xét vào đề xuất đã rút → 409
    as_(client, w.viewer).post(f"/api/wiki/changes/{ch['_id']}/withdraw")
    assert decide(client, w.viewer, str(ch["_id"]), "comment", "Thêm ý").status_code == 409
    # đề xuất create đã đóng thôi "Đang so sánh…"
    draft = new_card(w, status="draft")
    cr = changes.submit_draft(draft, w.author)
    assert cr["novelty_status"] == "pending"
    decide(client, w.editor, str(cr["_id"]), "reject", "Trùng")
    assert change_requests.find_one({"_id": cr["_id"]})["novelty_status"] == "skipped"
    # chạy lại cổng so sánh trên thẻ skill → 400, không lọt hộp duyệt
    skill = new_card(w, status="draft", type="skill")
    assert as_(client, w.author).post("/api/wiki/novelty", json={"card_id": str(skill["_id"])}).status_code == 400
    assert not change_requests.find_one({"card_id": skill["_id"]})


def test_sole_step2_not_in_step1_inbox(client, w):
    card = new_card(w, categories=["bh.khac"])            # bước 2 = admin duy nhất
    spaces.update_one({"_id": w.space["_id"]}, {"$push": {"members": {"user_id": w.admin["_id"], "role": "editor"}}})
    ch = changes.propose_update(card, w.viewer, {"title": "X"}, [])
    ids = [i["id"] for i in as_(client, w.admin).get("/api/wiki/changes", params={"inbox": 1}).json()["items"]]
    assert str(ch["_id"]) not in ids
    decide(client, w.editor, str(ch["_id"]))
    ids = [i["id"] for i in as_(client, w.admin).get("/api/wiki/changes", params={"inbox": 1}).json()["items"]]
    assert str(ch["_id"]) in ids


def test_step2_label_kept_after_approval(client, w):
    card = new_card(w, level="thiet-ke")
    ch = changes.propose_update(card, w.viewer, {"level": "nhap-mon"}, [])     # hạ bậc: vẫn TGĐ duyệt
    decide(client, w.editor, str(ch["_id"]))
    done = decide(client, w.admin, str(ch["_id"])).json()
    assert done["status"] == "approved" and done["step2_label"] == "TGĐ (tạm thời: quản trị viên)"
    assert done["step2_names"] == ["admin"]


def test_proposal_normalizes_defaults_no_fake_fields(client, w):
    """Thẻ cũ lưu division tường minh / next_review_at lệch: gửi lại đúng nội dung → không có gì thay đổi."""
    from datetime import datetime
    card = new_card(w, division=["tap-doan"], effective_at=datetime(2026, 1, 1), review_cycle_months=6,
                    next_review_at=datetime(2026, 7, 15))
    body = {"title": card["title"], "summary": card["summary"], "body": card["body"], "key_points": card["key_points"],
            "when_to_use": "", "example": "", "evidence": "", "categories": card["categories"], "tags": card["tags"],
            "level": "", "division": ["tap-doan"], "process_steps": [], "effective_at": "2026-01-01",
            "review_cycle_months": 6}
    r = as_(client, w.viewer).patch(f"/api/wiki/cards/{card['_id']}", json=body)
    assert r.status_code == 400 and "Không có gì thay đổi" in r.json()["detail"]
    r = client.patch(f"/api/wiki/cards/{card['_id']}", json=body | {"tags": ["ban-hang", "b2b"]})
    ch = r.json()["change"]
    assert ch["kind_label"] == "Đổi phân loại"
    got = change_requests.find_one({"_id": changes._oid(ch["id"])})["proposal"]
    assert got == {"set": {"tags": ["ban-hang", "b2b"]}, "unset": []}


def test_proposer_cannot_override_novelty(client, w):
    card = new_card(w, status="draft")
    ch = changes.submit_draft(card, w.author)
    r = as_(client, w.author).post(f"/api/wiki/changes/{ch['_id']}/novelty", json={"verdict": "conflict"})
    assert r.status_code == 403
    r = as_(client, w.editor).post(f"/api/wiki/changes/{ch['_id']}/novelty", json={"verdict": "supplement"})
    assert r.status_code == 200 and r.json()["novelty"]["reason"].startswith("Người duyệt đổi kết quả")


def test_unknown_change_fields_rejected(client, w):
    card = new_card(w)
    r = as_(client, w.viewer).post("/api/wiki/changes", json={"kind": "update", "card_id": str(card["_id"]),
                                                               "changes": {"bogus_field": 1}})
    assert r.status_code == 400 and "bogus_field" in r.json()["detail"]
    with pytest.raises(Exception, match="bogus_field"):
        mcp_server.propose_card_change(ctx_for(w.viewer), str(card["_id"]), changes={"bogus_field": 1})


def test_list_changes_paging_and_filters(client, w):
    """Hộp duyệt dạng lưới: phân trang đếm tổng thật, lọc trạng thái, ẩn TRÙNG / NHIỄU kèm số bị ẩn."""
    card = new_card(w)
    chs = [changes.propose_update(card, w.viewer, {"title": f"Tên {i}"}, []) for i in range(5)]
    for i in (0, 1):
        change_requests.update_one({"_id": chs[i]["_id"]}, {"$set": {"novelty": {"verdict": "duplicate", "reason": "", "related": []}}})
    # Tôi đề xuất: 5 đề xuất, mỗi trang 2 → 3 trang, trang cuối 1 mục, trang vượt → rỗng nhưng tổng vẫn đúng
    c = as_(client, w.viewer)
    r = c.get("/api/wiki/changes", params={"mine": 1, "page": 1, "page_size": 2}).json()
    assert (r["total"], r["page"], r["page_size"], len(r["items"]), r["hidden"]) == (5, 1, 2, 2, 0)
    r3 = c.get("/api/wiki/changes", params={"mine": 1, "page": 3, "page_size": 2}).json()
    assert r3["total"] == 5 and len(r3["items"]) == 1
    assert c.get("/api/wiki/changes", params={"mine": 1, "page": 9, "page_size": 2}).json()["items"] == []
    ids = {i["id"] for p in (1, 2, 3) for i in c.get("/api/wiki/changes", params={"mine": 1, "page": p, "page_size": 2}).json()["items"]}
    assert ids == {str(ch["_id"]) for ch in chs}                       # ba trang không trùng, không sót
    # `limit` cũ vẫn chạy (= page_size)
    assert len(c.get("/api/wiki/changes", params={"mine": 1, "limit": 3}).json()["items"]) == 3
    # Hộp thư người duyệt: ẩn TRÙNG → 3 hiện, 2 ẩn; không ẩn → 5
    e = as_(client, w.editor)
    r = e.get("/api/wiki/changes", params={"inbox": 1, "hide_filtered": 1, "page_size": 2}).json()
    assert (r["total"], r["hidden"], len(r["items"])) == (3, 2, 2)
    assert e.get("/api/wiki/changes", params={"inbox": 1}).json()["total"] == 5
    # Lọc trạng thái: từ chối 1 → approved/rejected tách nhau
    decide(client, w.editor, str(chs[4]["_id"]), "reject", "Không cần")
    assert e.get("/api/wiki/changes", params={"status": "rejected"}).json()["total"] == 1
    assert e.get("/api/wiki/changes", params={"status": "open,needs_rebase"}).json()["total"] == 4
    assert e.get("/api/wiki/changes", params={"kind": "create"}).json()["total"] == 0
