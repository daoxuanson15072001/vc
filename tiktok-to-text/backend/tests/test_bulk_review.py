"""Duyệt hàng loạt thẻ nháp (yêu cầu 6ab76de3…d817e mục B): lọc, loại mặc định, bốn mắt, min_approvers, phiên bản."""

from __future__ import annotations

from app.kb import changes
from app.kb.apply_v2 import LOW_TAG, UNSORTED_TAG
from app.kb.changes import change_requests
from app.kb.revisions import card_revisions, cards
from app.spaces import spaces
from tests.test_changes import as_, indexes, new_card, w  # noqa: F401 — fixture dùng chung

PENDING_OK = {"include_pending_novelty": True}


def set_min(n: int) -> None:
    changes.meta.update_one({"_id": changes.SETTINGS_ID}, {"$set": {"min_approvers": n}}, upsert=True)


def drafts(w, n: int, **fields) -> list[dict]:
    return [new_card(w, status="draft", title=f"Thẻ {i}", **fields) for i in range(n)]


def preview(client, user, **body):
    r = as_(client, user).post("/api/wiki/bulk-review/preview", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def bulk(client, user, ids, decision="approve", comment="", **body):
    return as_(client, user).post("/api/wiki/bulk-review/decide", json={
        "card_ids": [str(c["_id"]) for c in ids], "decision": decision, "comment": comment} | body)


def test_single_approver_approves_each_with_revision(client, w):
    set_min(1)
    cs = drafts(w, 3, level="nhap-mon")
    r = bulk(client, w.editor, cs, **PENDING_OK)
    assert r.status_code == 200, r.text
    res = r.json()
    assert len(res["done"]) == 3 and not res["skipped"]
    for c in cs:
        assert cards.find_one({"_id": c["_id"]})["status"] == "approved"
        assert card_revisions.count_documents({"card_id": c["_id"]}) == 1
        ch = change_requests.find_one({"card_id": c["_id"], "kind": "create"})
        assert ch["status"] == "approved" and [a["step"] for a in ch["approvals"]] == [1, 2]
        assert all(a["user_id"] == w.editor["_id"] for a in ch["approvals"])


def test_author_and_outsider_skipped_no_change_created(client, w):
    set_min(1)
    cs = drafts(w, 2)
    res = bulk(client, w.author, cs, **PENDING_OK).json()          # người tạo thẻ: bốn mắt
    assert not res["done"] and {s["reason"] for s in res["skipped"]} == {"Bạn là tác giả (bốn mắt)"}
    res = bulk(client, w.viewer, cs, **PENDING_OK).json()          # chỉ xem kho, không phải người duyệt
    assert not res["done"] and {s["reason"] for s in res["skipped"]} == {"Bạn không phải người duyệt của thẻ này"}
    assert change_requests.count_documents({}) == 0
    assert cards.count_documents({"status": "draft"}) == 2


def test_default_exclusions(client, w):
    set_min(1)
    ok = new_card(w, status="draft", title="Ổn")
    low = new_card(w, status="draft", title="Tin cậy thấp", tags=[LOW_TAG])
    uns = new_card(w, status="draft", title="Chưa xếp", tags=[UNSORTED_TAG])
    noise = new_card(w, status="draft", title="Nhiễu")
    ch = changes.submit_draft(noise, None)
    change_requests.update_one({"_id": ch["_id"]}, {"$set": {"novelty": {"verdict": "noise"}, "novelty_status": "done"}})

    p = preview(client, w.editor)
    titles = {i["title"]: i["skip"] for i in p["items"]}
    assert set(titles) == {"Ổn", "Nhiễu"}                               # tag loại khỏi danh sách
    assert p["tag_excluded"] == {LOW_TAG: 1, UNSORTED_TAG: 1}
    assert titles["Nhiễu"] == "Cổng so sánh xếp NHIỄU"
    assert titles["Ổn"] == "Chưa có kết quả cổng so sánh"               # duyệt cần kết quả cổng so sánh

    # gửi kèm cả thẻ bị loại: server tự kiểm lại, chỉ duyệt thẻ hợp lệ
    res = bulk(client, w.editor, [ok, low, uns, noise], **PENDING_OK).json()
    assert [d["title"] for d in res["done"]] == ["Ổn"]
    assert cards.find_one({"_id": low["_id"]})["status"] == "draft"
    assert cards.find_one({"_id": noise["_id"]})["status"] == "draft"

    p = preview(client, w.editor, include_low_confidence=True, include_unsorted=True, include_noise_duplicate=True,
                **PENDING_OK)
    assert {i["title"] for i in p["items"] if not i["skip"]} == {"Tin cậy thấp", "Chưa xếp", "Nhiễu"}


def test_filters_branch_with_children_and_level(client, w):
    set_min(1)
    a = new_card(w, status="draft", title="Chốt đơn nhập môn", categories=["bh.b2b.chot-don"], level="nhap-mon")
    new_card(w, status="draft", title="Chốt đơn điều hành", categories=["bh.b2b.chot-don"], level="dieu-hanh")
    new_card(w, status="draft", title="Nhánh khác", categories=["bh.khac"], level="nhap-mon")
    p = preview(client, w.editor, category="bh.b2b", level="nhap-mon,thuc-thi", **PENDING_OK)
    assert [i["id"] for i in p["items"]] == [str(a["_id"])]
    # thẻ ngoài bộ lọc gửi lên thì bỏ qua
    other = cards.find_one({"title": "Nhánh khác"})
    res = bulk(client, w.editor, [a, other], category="bh.b2b", level="nhap-mon", **PENDING_OK).json()
    assert len(res["done"]) == 1 and res["skipped"][0]["reason"] == "Không còn là thẻ nháp khớp bộ lọc"


def test_two_approvers_keeps_four_eyes(client, w):
    set_min(2)
    # duyệt hàng loạt chỉ trên thẻ trong kho mình xem được — người duyệt bước 2 ngoài kho duyệt từng thẻ (có access_log)
    spaces.update_one({"_id": w.space["_id"]}, {"$push": {"members": {"user_id": w.owner2["_id"], "role": "viewer"}}})
    (c,) = drafts(w, 1, level="van-hanh")                             # bước 2 = chủ nhánh tầng 2 (owner2)
    res = bulk(client, w.editor, [c], **PENDING_OK).json()
    assert res["done"][0]["status"] == "open"                          # mới xong bước 1
    assert cards.find_one({"_id": c["_id"]})["status"] == "draft"
    res = bulk(client, w.editor, [c], **PENDING_OK).json()             # người bước 1 không làm tiếp bước 2
    assert not res["done"]
    res = bulk(client, w.owner2, [c], **PENDING_OK).json()
    assert res["done"][0]["status"] == "approved"
    assert cards.find_one({"_id": c["_id"]})["status"] == "approved"
    assert card_revisions.count_documents({"card_id": c["_id"]}) == 1


def test_reject_needs_comment_and_no_novelty_wait(client, w):
    set_min(1)
    cs = drafts(w, 2)
    assert bulk(client, w.editor, cs, "reject").status_code == 400
    res = bulk(client, w.editor, cs, "reject", "Trùng nội dung cũ").json()
    assert len(res["done"]) == 2
    assert {c["status"] for c in cards.find({"_id": {"$in": [x["_id"] for x in cs]}})} == {"rejected"}
    ch = change_requests.find_one({"card_id": cs[0]["_id"]})
    assert ch["approvals"][-1]["comment"] == "Trùng nội dung cũ"


def test_ids_filter_limits_to_listed_cards(client, w):
    """Link lọc sẵn (vd khoá mẫu /learn): ids= giới hạn đúng danh sách mã thẻ; ids sai định dạng -> 400."""
    set_min(1)
    cs = drafts(w, 3, level="nhap-mon")
    pick = ",".join(str(cs[i]["_id"]) for i in (0, 2))
    p = preview(client, w.editor, ids=pick, **PENDING_OK)
    assert {i["id"] for i in p["items"]} == {str(cs[0]["_id"]), str(cs[2]["_id"])}
    # decide cũng bị giới hạn theo ids: gửi cả thẻ ngoài danh sách thì bỏ qua
    res = as_(client, w.editor).post("/api/wiki/bulk-review/decide", json={
        "card_ids": [str(c["_id"]) for c in cs], "decision": "approve", "comment": "",
        "ids": pick, "include_pending_novelty": True}).json()
    assert {d["id"] for d in res["done"]} == {str(cs[0]["_id"]), str(cs[2]["_id"])}
    assert res["skipped"][0]["reason"] == "Không còn là thẻ nháp khớp bộ lọc"
    r = as_(client, w.editor).post("/api/wiki/bulk-review/preview", json={"ids": "khong-phai-objectid"})
    assert r.status_code == 400


def test_web_session_only(w):
    """Không mở qua MCP / token API: REST chỉ nhận phiên đăng nhập web (cookie)."""
    from fastapi.testclient import TestClient

    from app.main import app
    r = TestClient(app).post("/api/wiki/bulk-review/decide", headers={"Authorization": "Bearer vcmcp_bat-ky"},
                             json={"card_ids": ["0" * 24], "decision": "approve"})
    assert r.status_code == 401
