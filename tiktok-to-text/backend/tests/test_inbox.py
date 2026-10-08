"""API số việc của tôi `GET /api/me/inbox/counts` (SCR-01 SYS-27 — docs/DESIGN.md Phần V mục 9.2).

Mỗi con số phải bằng đúng số dòng màn đích hiện ra với cùng bộ lọc: test dựng dữ liệu rồi so với API danh sách."""

from __future__ import annotations

from datetime import timedelta

import pytest

from app import db
from app.kb.pipeline import sources
from app.learn.models import assignments, attempts
from app.spaces import personal_space
from app.studio import quick_pieces
from tests.conftest import make_user
# fixture + hàm dựng dữ liệu học tập dùng chung với test lộ trình (AI chấm giả tự bật ở đó)
from tests.test_learn_paths import answer_all, assign_and_start, fake_ai, no_real_ai, w  # noqa: F401

KEYS = {"review", "learn_due", "learn_next_due", "grading", "content_fix", "sources_error", "returned_to_me",
        "updated_at"}


def counts(client, user) -> dict:
    client.login(user)
    r = client.get("/api/me/inbox/counts")
    assert r.status_code == 200, r.text
    return r.json()


def add_source(space, user, status, url="https://www.tiktok.com/@a"):
    return sources.insert_one({"space_id": space["_id"], "created_by": user["_id"], "kind": "video", "lane": "heavy",
                               "url": url, "title": url, "status": status, "priority": 0, "logs": [], "options": {},
                               "created_at": db.now()}).inserted_id


def add_piece(space, user, status="done", review_status="draft"):
    return quick_pieces.insert_one({"space_id": space["_id"], "created_by": user["_id"], "type": "post", "title": "Bài",
                                    "status": status, "review_status": review_status, "error": None,
                                    "created_at": db.now(), "updated_at": db.now()}).inserted_id


def test_requires_login(client):
    assert client.get("/api/me/inbox/counts").status_code == 401


def test_empty_user_gets_zeros_and_contract_keys(client):
    r = counts(client, make_user("trong"))
    assert set(r) == KEYS
    assert [r[k] for k in ("review", "learn_due", "grading", "content_fix", "sources_error")] == [0] * 5
    assert r["learn_next_due"] is None and r["updated_at"].endswith("Z")


def test_learn_due_matches_learn_me_and_next_due(client, w):  # noqa: F811
    p = w["p"]
    assign_and_start(w)                                        # giao 1 lộ trình cho nv_part_kd
    nv = p["nv_part_kd"]
    r = counts(client, nv)
    me = client.get("/api/learn/me").json()
    open_items = [i for m in me["months"] for i in m["items"] if i["status"] != "completed"]
    assert r["learn_due"] == len(open_items) == 1
    due = min(i["due_at"] for i in open_items if i["due_at"])          # JSON: chuỗi ISO
    assert r["learn_next_due"][:19] == due[:19]
    # xong việc -> không còn đếm, hạn gần nhất về null
    assignments.update_many({"learner_id": nv["_id"]}, {"$set": {"status": "completed"}})
    r = counts(client, nv)
    assert r["learn_due"] == 0 and r["learn_next_due"] is None
    # người khác không bị đếm hộ
    assert counts(client, p["tp_part_mkt"])["learn_due"] == 0


def test_grading_matches_grading_queue_and_needs_permission(client, w):  # noqa: F811
    p = w["p"]
    path, asg, a = assign_and_start(w)
    client.login(p["nv_part_kd"])
    assert client.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": answer_all(a)}).status_code == 200

    r = counts(client, p["tp_part_kd"])                        # người giao bài = người chấm
    queue = client.get("/api/learn/grading").json()["items"]
    assert r["grading"] == len([i for i in queue if i["can_grade"]]) == 1
    # chính người học (không có quyền chấm) và người ngoài tuyến: 0, khớp hàng chờ của họ
    for other in (p["nv_part_kd"], p["tp_part_mkt"]):
        got = counts(client, other)["grading"]
        assert got == len(client.get("/api/learn/grading").json()["items"]) == 0
    # chấm xong -> hết đếm
    attempts.update_many({}, {"$set": {"finalized_at": db.now()}})
    assert counts(client, p["tp_part_kd"])["grading"] == 0


def test_sources_error_only_mine_and_other_user_does_not_see(client):
    a, b = make_user("a"), make_user("b")
    sa, sb = personal_space(a), personal_space(b)
    add_source(sa, a, "error", "https://x/1")
    add_source(sa, a, "error", "https://x/2")
    add_source(sa, a, "extracted", "https://x/3")
    add_source(sb, b, "error", "https://x/4")
    assert counts(client, a)["sources_error"] == 2
    assert counts(client, b)["sources_error"] == 1             # không thấy nguồn lỗi của a
    # người khác nạp vào kho chung của tôi: không tính là "nguồn tôi nạp"
    sources.insert_one({"space_id": sa["_id"], "created_by": b["_id"], "kind": "video", "url": "https://x/5",
                        "title": "x5", "status": "error", "created_at": db.now()})
    assert counts(client, a)["sources_error"] == 2
    # nguồn đã yêu cầu xoá không tính (cùng source_filter)
    sources.update_one({"url": "https://x/1"}, {"$set": {"delete_requested": True}})
    assert counts(client, a)["sources_error"] == 1


def test_kb_sources_mine_param(client):
    a, b = make_user("a"), make_user("b")
    shared = {"name": "Kho chung", "type": "shared", "owner_id": a["_id"], "visibility": "org", "created_at": db.now(),
              "members": [{"user_id": a["_id"], "role": "owner"}]}
    from app.spaces import spaces
    shared["_id"] = spaces.insert_one(shared).inserted_id
    add_source(shared, a, "error", "https://x/a")
    add_source(shared, b, "error", "https://x/b")
    add_source(shared, a, "extracted", "https://x/c")
    client.login(a)
    assert client.get("/api/kb/sources").json()["total"] == 3                      # không truyền: như cũ
    assert client.get("/api/kb/sources", params={"mine": 0}).json()["total"] == 3
    mine = client.get("/api/kb/sources", params={"mine": 1}).json()
    assert mine["total"] == 2 and {i["url"] for i in mine["items"]} == {"https://x/a", "https://x/c"}
    both = client.get("/api/kb/sources", params={"mine": 1, "status": "error"}).json()
    assert both["total"] == 1 and both["items"][0]["url"] == "https://x/a"
    assert counts(client, a)["sources_error"] == both["total"]                     # số đếm = màn đích
    # Thao tác hàng loạt ở màn đích (?status=error&mine=1) chỉ chạm nguồn của tôi
    dry = lambda **kw: client.post("/api/kb/sources/resume-all", json={"status": "error", "dry_run": True, **kw}).json()
    assert dry(mine=True)["error"] == 1 and dry()["error"] == 2


def test_content_fix_counts_my_error_pieces_only(client):
    a, b = make_user("a"), make_user("b")
    sa, sb = personal_space(a), personal_space(b)
    add_piece(sa, a, status="error")
    add_piece(sa, a, status="done")
    add_piece(sa, a, status="error", review_status="rejected")
    add_piece(sb, b, status="error")
    r = counts(client, a)
    listed = client.get("/api/studio/quick", params={"mine": True}).json()["items"]
    assert r["content_fix"] == len([i for i in listed if i["status"] == "error"]) == 2
    # link đích /studio/quick?status=error (danh sách mặc định "Của tôi") ra đúng số này
    linked = client.get("/api/studio/quick", params={"mine": True, "status": "error"}).json()
    assert linked["total"] == r["content_fix"] and all(i["status"] == "error" for i in linked["items"])
    assert counts(client, b)["content_fix"] == 1


def test_review_matches_wiki_changes_inbox(client, w):  # noqa: F811
    """Đề xuất sửa thẻ chờ duyệt: số `review` của mỗi người = `total` của `GET /wiki/changes?inbox=1`."""
    p = w["p"]
    c1 = w["c1"]
    client.login(p["nv_part_kd"])                              # viewer kho -> đề xuất sửa thẻ
    r = client.patch(f"/api/wiki/cards/{c1['_id']}", json={"body": "Nội dung sửa", "change_summary": "Sửa"})
    assert r.status_code == 200, r.text
    seen = 0
    for name, user in p.items():
        client.login(user)
        listed = client.get("/api/wiki/changes", params={"inbox": 1}).json()["total"]
        assert counts(client, user)["review"] == listed, name
        seen += listed
    assert seen >= 1                                           # có ít nhất một người được giao duyệt
