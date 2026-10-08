"""Chuẩn bị dùng thử (BA 18.10 — đã quyết 26/09): MCP không duyệt, người duyệt ngoài kho có giới hạn + nhật ký,
`change_kind` trong `record_revision`, luật bước 2 / đọc bài qua lộ trình ở policy.py, điểm đạt mặc định 70,
cờ menu Học tập."""

from __future__ import annotations

import json

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app import categories, db, mcp_server, org, policy
from app.kb import changes, revisions
from app.kb.changes import change_requests
from app.kb.revisions import card_revisions
from app.learn import designer, grading, paths
from app.learn.models import DEFAULT_PASS_SCORE, pass_score_of
from tests.conftest import make_user
from tests.test_changes import as_, ctx_for, decide, indexes, new_card, w  # noqa: F401 — fixture dùng lại


# ---------------------------------------------------------------------------
# A2 — MCP review_change không duyệt (SYS-12)
# ---------------------------------------------------------------------------

def test_mcp_review_change_blocks_approve_but_allows_view_comment_reject(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Mới"}, [])
    cid = str(ch["_id"])
    with pytest.raises(mcp_server.ToolError) as e:
        mcp_server.review_change(ctx_for(w.editor), cid, "approve")
    assert f"/wiki/review?change={cid}" in str(e.value) and "SYS-12" in str(e.value)
    assert change_requests.find_one({"_id": ch["_id"]})["approvals"] == []          # không ghi gì
    # người bước 2 cũng không duyệt qua MCP được
    decide(client, w.editor, cid)
    with pytest.raises(mcp_server.ToolError, match="SYS-12"):
        mcp_server.review_change(ctx_for(w.owner2), cid, "approve")
    assert change_requests.find_one({"_id": ch["_id"]})["status"] == "open"

    view = json.loads(mcp_server.review_change(ctx_for(w.editor), cid))
    assert view["diff"][0]["field"] == "title"
    c = json.loads(mcp_server.review_change(ctx_for(w.editor), cid, "comment", "Nên thêm ví dụ"))
    assert c["approvals"][-1]["decision"] == "comment"
    r = json.loads(mcp_server.review_change(ctx_for(w.owner2), cid, "reject", "Sai số liệu"))
    assert r["status"] == "rejected"


def test_decide_refuses_approve_from_non_web_channel(w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Mới"}, [])
    with pytest.raises(HTTPException) as e:
        changes.decide(ch, w.editor, "approve", channel="mcp")
    assert e.value.status_code == 403 and "/wiki/review?change=" in e.value.detail


# ---------------------------------------------------------------------------
# A3 — người duyệt ngoài kho: chỉ đề xuất mình được giao + ghi nhật ký
# ---------------------------------------------------------------------------

def _reviewer_logs(user):
    return list(org.access_log.find({"user_id": user["_id"], "action": "change.read_as_reviewer"}))


def test_outside_reviewer_sees_only_assigned_changes_and_is_logged(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Mới"}, [])
    url = f"/api/wiki/changes/{ch['_id']}"
    stranger = make_user("stranger")

    assert as_(client, w.owner2).get(url).status_code == 200                # chủ nhánh tầng 2 = người bước 2
    logs = _reviewer_logs(w.owner2)
    assert len(logs) == 1 and logs[0]["target"] == {"kind": "change_request", "id": ch["_id"]}
    assert logs[0]["channel"] == "web" and logs[0]["classification"] == "C1"
    as_(client, w.owner2).get(url)
    assert len(_reviewer_logs(w.owner2)) == 2                                # mỗi lần xem một dòng

    assert as_(client, w.editor).get(url).status_code == 200                # trong kho: không ghi nhật ký ngoại lệ
    assert _reviewer_logs(w.editor) == []
    assert as_(client, stranger).get(url).status_code == 404                # người ngoài kho khác
    assert as_(client, w.admin).get(url).status_code == 404                 # admin không phải người bước 2 thẻ này
    ids = [i["id"] for i in as_(client, w.owner2).get("/api/wiki/changes").json()["items"]]
    assert str(ch["_id"]) in ids
    assert as_(client, stranger).get("/api/wiki/changes").json()["items"] == []

    # MCP cũng ghi nhật ký, kênh mcp
    mcp_server.review_change(ctx_for(w.owner2), str(ch["_id"]))
    assert _reviewer_logs(w.owner2)[-1]["channel"] == "mcp"


def test_outside_reviewer_loses_access_when_no_longer_assigned(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Mới"}, [])
    url = f"/api/wiki/changes/{ch['_id']}"
    new_owner = make_user("owner2b")
    categories.categories.update_one({"slug": "bh.b2b"}, {"$set": {"owner_id": new_owner["_id"]}})
    assert as_(client, w.owner2).get(url).status_code == 404                # không còn được giao
    assert as_(client, new_owner).get(url).status_code == 200


def test_outside_reviewer_keeps_access_to_changes_they_decided(client, w):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"title": "Mới"}, [])
    url = f"/api/wiki/changes/{ch['_id']}"
    decide(client, w.editor, str(ch["_id"]))
    assert decide(client, w.owner2, str(ch["_id"])).json()["status"] == "approved"
    assert as_(client, w.owner2).get(url).status_code == 200                # người bước 2 lúc chốt

    # đề xuất bị từ chối ở bước 1 (người bước 2 chưa ra quyết định): người ngoài kho không xem nữa
    ch2 = changes.propose_update(cards_now(card), w.viewer, {"summary": "Khác"}, [])
    decide(client, w.editor, str(ch2["_id"]), "reject", "Không cần")
    assert as_(client, w.owner2).get(f"/api/wiki/changes/{ch2['_id']}").status_code == 404


def cards_now(card):
    return revisions.cards.find_one({"_id": card["_id"]})


# ---------------------------------------------------------------------------
# A4 — change_kind trong record_revision; luật ở policy.py
# ---------------------------------------------------------------------------

def test_record_revision_writes_change_kind_on_insert(w):
    card = new_card(w, status="draft")
    r = revisions.record_revision(card, w.author["_id"], "Bản đầu", change_kind="major")
    assert card_revisions.find_one({"_id": r["_id"]})["change_kind"] == "major"
    r2 = revisions.record_revision(card, w.author["_id"], "Bản hai")
    assert "change_kind" not in card_revisions.find_one({"_id": r2["_id"]})
    with pytest.raises(ValueError):
        revisions.record_revision(card, w.author["_id"], "Bản ba", change_kind="huge")


def test_approved_change_kind_recorded_without_later_update(client, w, monkeypatch):
    card = new_card(w)
    ch = changes.propose_update(card, w.viewer, {"body": "Khác"}, [], change_kind="major")
    calls = []
    orig = card_revisions.update_one
    monkeypatch.setattr(card_revisions, "update_one", lambda *a, **k: calls.append(a) or orig(*a, **k),
                        raising=False)
    decide(client, w.editor, str(ch["_id"]))
    assert decide(client, w.owner2, str(ch["_id"])).json()["status"] == "approved"
    rev = card_revisions.find_one({"card_id": card["_id"], "rev": 2})
    assert rev["change_kind"] == "major" and calls == []                     # chỉ ghi thêm


def test_policy_step2_reviewers_matches_change_rule(w):
    top = new_card(w, level="dieu-hanh")
    ch = changes.propose_update(top, w.viewer, {"title": "Mới"}, [])
    assert policy.step2_reviewers(top, ch) == changes.step2_rule(ch, top) == (
        [w.admin["_id"]], "TGĐ (tạm thời: quản trị viên)")
    normal = new_card(w, level="thuc-thi")
    assert policy.step2_reviewers(normal) == ([w.owner2["_id"]], "Chủ nhánh tầng 2")
    ob = changes.create_change(normal, w.viewer, "obsolete", summary="Hết dùng")
    assert policy.step2_reviewers(normal, ob)[1] == "Chủ sở hữu lĩnh vực"


def test_policy_can_read_via_assignment(w):
    learner = make_user("hoc-vien")
    lessons = db.db["lessons"]
    mk = lambda **f: lessons.insert_one({"title": "B", "status": "published", "space_id": w.space["_id"]} | f).inserted_id
    c1, c2, draft, other = mk(classification="C1"), mk(classification="C2"), mk(status="draft"), mk()
    db.db["assignments"].insert_one({"learner_id": learner["_id"], "lesson_ids": [c1, c2, draft]})
    get = lambda i: lessons.find_one({"_id": i})
    assert policy.can_read_via_assignment(learner, get(c1)) is True
    assert policy.can_read_via_assignment(learner, get(c2)) is False       # C2 vẫn theo kho
    assert policy.can_read_via_assignment(learner, get(draft)) is False
    assert policy.can_read_via_assignment(learner, get(other)) is False    # không được giao
    f = policy.via_assignment_filter(learner)
    assert {x["_id"] for x in lessons.find(f)} == {c1}
    assert policy.via_assignment_filter(make_user("khong-giao")) is None


# ---------------------------------------------------------------------------
# A5 — điểm đạt mặc định 70
# ---------------------------------------------------------------------------

def test_pass_score_defaults_to_70_everywhere():
    assert DEFAULT_PASS_SCORE == 70
    assert pass_score_of(None) == pass_score_of({}) == pass_score_of({"pass_score": None}) == 70
    assert pass_score_of({"pass_score": 0}) == 0
    assert paths.ExamIn(blueprint=[{"count": 1}]).pass_score == 70
    assert paths.exam_view({"blueprint": [{"count": 1}]})["pass_score"] == 70
    assert paths.exam_view({"blueprint": [], "pass_score": None})["pass_score"] == 70
    assert designer.ExamIn().pass_score == 70
    assert designer.stored_exam({})["pass_score"] == 70
    assert designer.stored_exam({"pass_score": None}, {"pass_score": None})["pass_score"] == 70
    assert designer.stored_exam({"pass_score": 80})["pass_score"] == 80
    assert designer._pass_score(None, None) == 70 and designer._pass_score(150) == 100
    assert designer._pass_score("x", 60) == 60
    # lượt thi thiếu pass_score: không coi là 0 (đạt mọi bài) mà là 70
    assert grading.passed_of({"max_score": 10}, 6.9) is False
    assert grading.passed_of({"max_score": 10}, 7) is True


def test_path_created_via_api_without_pass_score_gets_70(org_sample, client):
    client.login(org_sample["people"]["tp_part_kd"])
    r = client.post("/api/learn/paths", json={"title": "T10", "period": "month", "year": 2026, "month": 10,
                                              "exam": {"blueprint": [{"kind": "single", "count": 1}]}})
    assert r.status_code == 201, r.text
    assert r.json()["exam"]["pass_score"] == 70


# ---------------------------------------------------------------------------
# A6 — cờ menu Học tập
# ---------------------------------------------------------------------------

def test_learn_flags_in_auth_me_and_learn_me(org_sample, client):
    p = org_sample["people"]
    client.login(p["nv_part_kd"])                                           # nhân viên thường
    me = client.get("/api/auth/me").json()
    assert me["can_design"] is False and me["can_grade"] is False
    lm = client.get("/api/learn/me").json()
    assert lm["can_design"] is False and lm["can_grade"] is False
    # API vẫn tự chặn như cũ
    assert client.post("/api/learn/paths", json={"title": "X", "period": "month", "year": 2026,
                                                 "month": 10}).status_code == 403

    client.login(p["tp_part_kd"])                                           # quản lý có cấp dưới
    me = client.get("/api/auth/me").json()
    assert me["can_design"] is True and me["can_grade"] is True
    client.login(p["hr_lnd"])                                               # L&D
    assert client.get("/api/auth/me").json()["can_grade"] is True

    # người giao lộ trình (không có cấp dưới trực tiếp) thấy menu Chấm bài
    giver = make_user("nguoi-giao")
    db.db["assignments"].insert_one({"learner_id": ObjectId(), "assigned_by": giver["_id"], "lesson_ids": []})
    assert policy.learn_flags(giver) == {"can_design": False, "can_grade": True}


def test_login_response_has_learn_flags(client):
    from app import auth
    u = auth.create_user("flag@x.test", "Flag", "matkhau-123")
    r = client.post("/api/auth/login", json={"email": "flag@x.test", "password": "matkhau-123"})
    assert r.status_code == 200 and r.json()["can_design"] is False and "can_grade" in r.json()
    assert u["_id"]
