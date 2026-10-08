"""API khoá học theo cây chủ đề (DESIGN TK-15b, BA 17.12 luật 1–5, LRN-15, 17): cây khoá, một khoá, sắp thứ tự
mặc định, thi khoá, kiểm tra sau bài đạt / chưa đạt, MCP chỉ đọc."""

from __future__ import annotations

import pytest

from tests.training_support import training_subject

from app import categories as cat_mod
from app import mcp_server
from app.learn.models import courses, lessons
from tests.test_learn_api import SINGLE, add_card, make_question, shared_space


@pytest.fixture
def w(org_sample, client):
    """Nút `nen` (chủ gd_part) › `nen.lich`; tp_part_kd soạn ở kho phòng (nv_part_kd xem)."""
    p = org_sample["people"]
    nen = cat_mod._insert("Nền ngành ô tô", "Môn đầu tiên", None, 0, slug="nen", owner_id=p["gd_part"]["_id"])
    cat_mod._insert("Lịch bảo dưỡng", "", nen, 0, slug="nen.lich")
    space = shared_space(p["tp_part_kd"], [(p["nv_part_kd"], "viewer"), (p["gd_part"], "viewer")])
    card = add_card(space, "Thay dầu", categories=["nen.lich"])
    c = client
    c.login(p["tp_part_kd"])

    def lesson(title, publish=True, quiz=None, category="nen.lich"):
        body = {"title": title, "space_id": str(space["_id"]), "items": [{"card_id": str(card["_id"])}],
                "category": category, "practice_question_ids": [q["id"] for q in quiz or []]}
        r = c.post("/api/learn/lessons", json=body | {"subject_id": training_subject(c)})
        assert r.status_code == 201, r.text
        x = r.json()
        if publish:
            x = c.patch(f"/api/learn/lessons/{x['id']}", json={"status": "published"}).json()
        return x
    return {"p": p, "c": c, "card": card, "lesson": lesson, "space": space}


def test_tree_counts_direct_lessons_only(w):
    w["lesson"]("Nền tảng")
    w["lesson"]("Vận dụng")
    w["lesson"]("Bài nền", category="nen")
    w["lesson"]("Nháp riêng", publish=False)
    w["lesson"]("Chưa xếp", category=None)
    tree = w["c"].get("/api/learn/courses").json()
    assert {i["category"]: i["lesson_count"] for i in tree["items"]} == {"nen": 1, "nen.lich": 3}
    assert tree["unassigned"] == 1
    w["c"].login(w["p"]["nv_part_kd"])                  # người học: không thấy nháp, không có unassigned
    tree = w["c"].get("/api/learn/courses").json()
    assert {i["category"]: i["lesson_count"] for i in tree["items"]} == {"nen": 1, "nen.lich": 2}
    assert "unassigned" not in tree


def test_course_numbering_per_viewer(w):
    w["lesson"]("Bài A")
    w["lesson"]("Nháp", publish=False)
    w["lesson"]("Bài C")
    got = w["c"].get("/api/learn/courses/nen.lich").json()
    assert [(x["no"], x["title"]) for x in got["lessons"]] == [(1, "Bài A"), (2, "Nháp"), (3, "Bài C")]
    assert got["label"] == "Nền ngành ô tô › Lịch bảo dưỡng" and got["lesson_pass_score"] == 70
    assert got["can_arrange"] is False and got["exam"] is None
    w["c"].login(w["p"]["nv_part_kd"])
    got = w["c"].get("/api/learn/courses/nen.lich").json()
    assert [(x["no"], x["title"]) for x in got["lessons"]] == [(1, "Bài A"), (2, "Bài C")]
    assert w["c"].get("/api/learn/courses/khong-co").status_code == 404


def test_order_by_branch_owner(w):
    a, b, d = w["lesson"]("A"), w["lesson"]("B"), w["lesson"]("Nháp", publish=False)
    c = w["c"]
    assert c.put("/api/learn/courses/nen.lich/order", json={"lesson_ids": [b["id"], a["id"]]}).status_code == 403
    c.login(w["p"]["gd_part"])                          # chủ nút cha; không xem được bài nháp của tp
    assert c.put("/api/learn/courses/nen.lich/order", json={"lesson_ids": [b["id"]]}).status_code == 400
    assert c.put("/api/learn/courses/nen.lich/order", json={"lesson_ids": [b["id"], b["id"]]}).status_code == 400
    r = c.put("/api/learn/courses/nen.lich/order", json={"lesson_ids": [b["id"], a["id"]]})
    assert r.status_code == 200, r.text
    assert [x["title"] for x in r.json()["lessons"]] == ["B", "A"]
    # bài người sắp không thấy (nháp) giữ nguyên vị trí cuối
    assert [x["title"] for x in lessons.find({"category": "nen.lich"}).sort("seq", 1)] == ["B", "A", "Nháp"]
    assert d


def test_course_exam_settings(w):
    c = w["c"]
    q = make_question(c, SINGLE, [w["card"]])
    w["lesson"]("Bài có câu", quiz=[q])
    c.login(w["p"]["gd_part"])
    body = {"exam": {"blueprint": [{"count": 1}], "duration_min": 15, "pass_score": 80}, "lesson_pass_score": 60}
    assert c.put("/api/learn/courses/nen/settings", json=body).status_code == 400      # nút chưa có bài phát hành
    r = c.put("/api/learn/courses/nen.lich/settings", json=body | {"exam": {"blueprint": [{"count": 5}]}})
    assert r.status_code == 400 and "dòng 1" in r.text                                   # không đủ câu
    r = c.put("/api/learn/courses/nen.lich/settings", json=body)
    assert r.status_code == 200, r.text
    assert (r.json()["exam"]["pass_score"], r.json()["lesson_pass_score"]) == (80, 60)
    assert courses.find_one({"category": "nen.lich"})["exam"]["scope"] == "path"
    assert c.get("/api/learn/courses").json()["items"][0]["has_exam"] is True
    c.login(w["p"]["tp_part_kd"])
    assert c.put("/api/learn/courses/nen.lich/settings", json=body).status_code == 403


def test_lesson_quiz_pass_mark(w):
    c = w["c"]
    q1, q2 = make_question(c, SINGLE, [w["card"]]), make_question(c, SINGLE, [w["card"]])
    lesson = w["lesson"]("Bài kiểm tra", quiz=[q1, q2])
    c.login(w["p"]["nv_part_kd"])

    def take(right: int):
        a = c.post(f"/api/learn/lessons/{lesson['id']}/practice").json()
        ans = {}
        for k, item in enumerate(a["paper"]):
            want = "Đúng" if k < right else "Sai"
            ans[item["question_id"]] = next(o["key"] for o in item["options"] if o["text"] == want)
        r = c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": ans})
        assert r.status_code == 200, r.text
        return r.json()
    assert take(1)["passed"] is False                       # 50% < 70
    got = c.get("/api/learn/courses/nen.lich").json()["lessons"][0]["my_result"]
    assert got == {"best_pct": 50.0, "passed": False, "attempts": 1}
    assert take(2)["passed"] is True
    got = c.get("/api/learn/courses/nen.lich").json()["lessons"][0]["my_result"]
    assert got == {"best_pct": 100.0, "passed": True, "attempts": 2}
    courses.insert_one({"category": "nen.lich", "exam": None, "lesson_pass_score": 50})
    assert take(1)["passed"] is True                        # điểm đạt bài của khoá 50%


def test_delete_branch_merges_course_settings(w):
    w["lesson"]("Bài nền", category="nen")
    w["lesson"]("Bài lịch")
    courses.insert_one({"category": "nen", "exam": None, "lesson_pass_score": 55})
    courses.insert_one({"category": "nen.lich", "exam": None, "lesson_pass_score": 90})
    cat_mod.remove(cat_mod.categories.find_one({"slug": "nen.lich"}), move_to="nen")
    assert [(r["category"], r["lesson_pass_score"]) for r in courses.find()] == [("nen", 55)]
    assert [x["title"] for x in lessons.find({"category": "nen"}).sort("seq", 1)] == ["Bài nền", "Bài lịch"]


def test_mcp_read_only_tools_hide_c3(w):
    w["lesson"]("Bài thường")
    x = w["lesson"]("Bài mật")
    lessons.update_one({"_id": __import__("bson").ObjectId(x["id"])}, {"$set": {"classification": "C3"}})
    user = w["p"]["tp_part_kd"]
    assert mcp_server.list_courses_for(user)["items"][0]["category"] == "nen.lich"
    got = mcp_server.get_course_for(user, "nen.lich")
    assert [x["title"] for x in got["lessons"]] == ["Bài thường"]
