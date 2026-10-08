"""TK-15c: lộ trình dạng chuỗi khoá, chụp bài khi giao, thứ tự học và thi sau khoá."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId

from tests.training_support import training_subject

from app import categories as cat_mod
from app.learn.models import assignments, courses, learning_paths, lessons
from tests.test_learn_paths import w


def course_setup(w):
    p = w["p"]
    root = cat_mod._insert("Kỹ thuật", "", None, 0, slug="tk15c", owner_id=p["gd_part"]["_id"])
    one = cat_mod._insert("Khoá một", "", root, 0, slug="tk15c.one")
    two = cat_mod._insert("Khoá hai", "", root, 1, slug="tk15c.two")
    lesson_a, lesson_b = w["lesson"], None
    c = w["client"]
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "Bài hai", "space_id": str(w["space"]["_id"]),
                  "items": [{"card_id": str(w["c1"]["_id"])}], "category": two["slug"]})
    assert r.status_code == 201, r.text
    lesson_b = c.patch(f"/api/learn/lessons/{r.json()['id']}", json={"status": "published"}).json()
    lessons.update_one({"_id": ObjectId(lesson_a["id"])},
                       {"$set": {"category": one["slug"], "seq": 10, "practice_question_ids": []}})
    lessons.update_one({"_id": ObjectId(lesson_b["id"])},
                       {"$set": {"practice_question_ids": []}})
    return one, two, lesson_a, lesson_b


def make_course_path(w, courses_):
    c = w["client"]
    r = c.post("/api/learn/paths", json={"title": "Khoá chuỗi", "kind": "courses", "courses": courses_})
    assert r.status_code == 201, r.text
    return r.json()


def test_courses_path_validation_and_copy(w):
    one, two, a, b = course_setup(w)
    c = w["client"]
    assert c.post("/api/learn/paths", json={"title": "Rỗng", "kind": "courses"}).status_code == 400
    path = make_course_path(w, [{"category": one["slug"], "days": 4, "lesson_ids": [a["id"]]},
                                {"category": two["slug"], "days": 5, "lesson_ids": [b["id"]]}])
    assert path["kind"] == "courses" and len(path["courses"]) == 2
    assert c.patch(f"/api/learn/paths/{path['id']}", json={"parent_path_id": "000000000000000000000000"}).status_code == 400
    assert c.patch(f"/api/learn/paths/{path['id']}", json={"courses": [
        {"category": one["slug"], "days": 4}, {"category": one["slug"], "days": 2}]}).status_code == 400
    assert c.post(f"/api/learn/paths/{path['id']}/copy").status_code == 201


def test_assign_snapshots_course_plan_and_blocks_next_course(w):
    one, two, a, b = course_setup(w)
    c, p = w["client"], w["p"]
    path = make_course_path(w, [{"category": one["slug"], "days": 4}, {"category": two["slug"], "days": 5}])
    pub = c.post(f"/api/learn/paths/{path['id']}/publish")
    assert pub.status_code == 200, pub.text
    c.post(f"/api/learn/paths/{path['id']}/assign", json={"learner_ids": [str(p["nv_part_kd"]["_id"])]})
    c.login(p["nv_part_kd"])
    view = c.get("/api/learn/me").json()["months"][0]["items"][0]
    asg = assignments.find_one({"_id": ObjectId(view["id"])})
    assert [x["category"] for x in asg["plan"]] == [one["slug"], two["slug"]]
    assert len(asg["plan"][0]["lesson_ids"]) == len(asg["plan"][1]["lesson_ids"]) == 1
    assert c.get(f"/api/learn/lessons/{b['id']}").status_code == 409
    assert c.get(f"/api/learn/lessons/{a['id']}").status_code == 200
    assert c.get(f"/api/learn/lessons/{b['id']}").status_code == 200


def test_course_exam_completes_required_course(w):
    one, _, a, _ = course_setup(w)
    c, p = w["client"], w["p"]
    exam = {"blueprint": [{"kind": "single", "count": 1}], "duration_min": 10, "pass_score": 50, "attempts": 1}
    courses.insert_one({"category": one["slug"], "exam": exam, "lesson_pass_score": 70})
    path = make_course_path(w, [{"category": one["slug"], "days": 4, "lesson_ids": [a["id"]]}])
    assert c.post(f"/api/learn/paths/{path['id']}/publish").status_code == 200
    c.post(f"/api/learn/paths/{path['id']}/assign", json={"learner_ids": [str(p["nv_part_kd"]["_id"])]})
    c.login(p["nv_part_kd"])
    view = c.get("/api/learn/me").json()["months"][0]["items"][0]
    c.get(f"/api/learn/lessons/{a['id']}")
    start = c.post(f"/api/learn/courses/{one['slug']}/exam/start", params={"assignment_id": view["id"]})
    assert start.status_code == 201, start.text
    ans = {q["question_id"]: next(o["key"] for o in q["options"] if o["text"] == "Đúng")
           for q in start.json()["paper"]}
    c.post(f"/api/learn/attempts/{start.json()['id']}/submit", json={"answers": ans})
    assert assignments.find_one({"_id": ObjectId(view["id"])})["status"] == "completed"


def test_course_slug_rename_and_merge_follow_path_plan_and_progress(w):
    one, two, a, b = course_setup(w)
    c, p = w["client"], w["p"]
    path = make_course_path(w, [{"category": one["slug"], "days": 3, "lesson_ids": [a["id"]]},
                                {"category": two["slug"], "days": 4, "lesson_ids": [b["id"]]}])
    c.post(f"/api/learn/paths/{path['id']}/publish")
    c.post(f"/api/learn/paths/{path['id']}/assign", json={"learner_ids": [str(p["nv_part_kd"]["_id"])]})
    asg = assignments.find_one({"path_id": ObjectId(path["id"])})
    assignments.update_one({"_id": asg["_id"]}, {"$set": {"progress.courses": {
        one["slug"]: {"lessons_done": [ObjectId(a["id"])], "done_at": datetime.now(timezone.utc)},
        two["slug"]: {"lessons_done": [ObjectId(b["id"])], "done_at": datetime.now(timezone.utc)}}}})
    cat_mod.remove(one, move_to=two["slug"])
    path_now = learning_paths.find_one({"_id": ObjectId(path["id"])})
    asg_now = assignments.find_one({"_id": asg["_id"]})
    assert [x["category"] for x in path_now["courses"]] == [two["slug"]]
    assert [x["category"] for x in asg_now["plan"]] == [two["slug"]]
    assert asg_now["progress"]["courses"][two["slug"]]["done_at"]
    assert len(asg_now["plan"][0]["lesson_ids"]) == 2
