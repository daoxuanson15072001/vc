"""Luồng I — lộ trình, giao bài, thi, chấm (docs/BA.md mục 17.3–17.8: LRN-03, 05…08, 12) + luật quyền 15.6."""

from __future__ import annotations

from datetime import timedelta

import pytest
from bson import ObjectId

from tests.training_support import training_subject

from app import db
from app.kb.wiki import AINotReady
from app.learn import grading
from app.learn.models import assignments, attempts, questions
from tests.test_learn_api import ESSAY, MULTI, SINGLE, add_card, make_question, shared_space

MONTH = {"title": "Tháng 10 — Bán hàng", "period": "month", "year": 2026, "month": 10}


def fake_ai(p, answer):
    """AI giả: mỗi tiêu chí được 3/4 điểm tối đa."""
    per = [{"criterion": r["criterion"], "score": r["max"] * 0.75, "max": r["max"], "comment": "Khá"}
           for r in p["rubric"]]
    return {"score": sum(x["score"] for x in per), "per_criterion": per, "feedback": "Trả lời khá, thiếu ví dụ",
            "engine": "fake"}


@pytest.fixture(autouse=True)
def no_real_ai(monkeypatch):
    """Không bao giờ gọi AI thật trong test: chấm đồng bộ bằng AI giả."""
    monkeypatch.setattr(grading, "schedule_ai", grading.run_ai_grading)
    monkeypatch.setattr(grading, "ai_call", fake_ai)


@pytest.fixture
def w(org_sample, client):
    """tp_part_kd (quản lý) có kho phòng: nv_part_kd (dưới quyền) + gd_part (cấp trên) xem được.
    Bài học đã phát hành gồm 2 thẻ + câu một đáp án, nhiều đáp án, tự luận (đều đã duyệt)."""
    p = org_sample["people"]
    space = shared_space(p["tp_part_kd"], [(p["nv_part_kd"], "viewer"), (p["gd_part"], "viewer")])
    c1 = add_card(space, "Quy trình chào hàng", categories=["kinh-doanh.chao-hang"])
    c2 = add_card(space, "Xử lý từ chối", categories=["kinh-doanh.tu-choi"])
    client.login(p["tp_part_kd"])
    qs = {"single": make_question(client, SINGLE | {"space_id": str(space["_id"])}, [c1]),
          "multi": make_question(client, MULTI | {"space_id": str(space["_id"])}, [c2]),
          "essay": make_question(client, ESSAY | {"space_id": str(space["_id"])}, [c1])}
    r = client.post("/api/learn/lessons", json={"subject_id": training_subject(client),
        "title": "Bán hàng cơ bản", "space_id": str(space["_id"]),
        "items": [{"card_id": str(c1["_id"])}, {"card_id": str(c2["_id"])}],
        "practice_question_ids": [q["id"] for q in qs.values()]})
    lesson = client.patch(f"/api/learn/lessons/{r.json()['id']}", json={"status": "published"}).json()
    return {"p": p, "u": org_sample["units"], "space": space, "c1": c1, "c2": c2, "qs": qs, "lesson": lesson,
            "client": client}


def make_path(w, exam=None, publish=True, **extra) -> dict:
    c = w["client"]
    body = MONTH | {"modules": [{"week": 1, "lesson_ids": [w["lesson"]["id"]]}]} | extra
    if exam is not None:
        body["exam"] = exam
    r = c.post("/api/learn/paths", json=body)
    assert r.status_code == 201, r.text
    path = r.json()
    if publish:
        r = c.post(f"/api/learn/paths/{path['id']}/publish")
        assert r.status_code == 200, r.text
        path = r.json()
    return path


EXAM = {"blueprint": [{"kind": "single", "count": 1}, {"kind": "essay", "count": 1}], "duration_min": 30,
        "pass_score": 50}


def assign_and_start(w, exam=EXAM):
    c, p = w["client"], w["p"]
    c.login(p["tp_part_kd"])
    path = make_path(w, exam)
    r = c.post(f"/api/learn/paths/{path['id']}/assign", json={"learner_ids": [str(p["nv_part_kd"]["_id"])]})
    assert r.status_code == 200 and len(r.json()["assigned"]) == 1, r.text
    c.login(p["nv_part_kd"])
    asg = c.get("/api/learn/me").json()["months"][0]["items"][0]
    r = c.post(f"/api/learn/assignments/{asg['id']}/attempts", json={"kind": "exam"})
    assert r.status_code == 201, r.text
    return path, asg, r.json()


def answer_all(a: dict, essay_text="Chào, hỏi nhu cầu, đề xuất") -> dict:
    ans = {}
    for q in a["paper"]:
        if q["kind"] == "essay":
            ans[q["question_id"]] = essay_text
        elif q["kind"] == "single":
            ans[q["question_id"]] = next(o["key"] for o in q["options"] if o["text"] == "Đúng")
    return ans


# ---------------------------------------------------------------------------
# Lộ trình (LRN-03)
# ---------------------------------------------------------------------------

def test_path_draft_edit_publish_locks(w):
    c, p = w["client"], w["p"]
    path = make_path(w, publish=False)
    assert path["status"] == "draft" and path["can_edit"] and path["modules"][0]["lessons"][0]["title"] == "Bán hàng cơ bản"
    r = c.patch(f"/api/learn/paths/{path['id']}", json={"title": "Tháng 10 — sửa", "required_items": [w["lesson"]["id"]]})
    assert r.status_code == 200 and r.json()["title"] == "Tháng 10 — sửa"
    # mục bắt buộc phải nằm trong lộ trình
    assert c.patch(f"/api/learn/paths/{path['id']}", json={"modules": []}).status_code == 400
    # lộ trình tháng phải có tháng
    assert c.patch(f"/api/learn/paths/{path['id']}", json={"month": None}).status_code == 400
    # người khác không thấy bản nháp
    c.login(p["tp_part_mkt"])
    assert c.get(f"/api/learn/paths/{path['id']}").status_code == 404
    c.login(p["tp_part_kd"])
    r = c.post(f"/api/learn/paths/{path['id']}/publish")
    assert r.status_code == 200 and r.json()["status"] == "published"
    assert c.patch(f"/api/learn/paths/{path['id']}", json={"title": "x"}).status_code == 409
    # nhân viên không tạo được lộ trình
    c.login(p["nv_part_kd"])
    assert c.post("/api/learn/paths", json=MONTH).status_code == 403


def test_ai_draft_from_designer_opens_and_publishes(w):
    """Bản nháp luồng H dựng (cùng collection, có trường ai, bài học nháp) — mở / sửa / phát hành được."""
    c, p = w["client"], w["p"]
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "Bài AI dựng", "space_id": str(w["space"]["_id"]),
                                            "items": [{"card_id": str(w["c1"]["_id"])}]})
    draft_lesson = r.json()["id"]
    from bson import ObjectId

    from app.learn.models import learning_paths
    pid = learning_paths.insert_one({
        "title": "Nháp AI", "period": "month", "year": 2026, "month": 11, "owner_id": p["tp_part_kd"]["_id"],
        "owner_unit_id": None, "parent_path_id": None, "required_items": [],
        "modules": [{"week": 1, "lesson_ids": [ObjectId(draft_lesson)], "due_at": None}], "exam": None,
        "status": "draft", "ai": {"prompt": "Tháng 11 cho nhóm KD", "plan": {}, "engine": "fake"},
        "created_at": db.now(), "updated_at": db.now()}).inserted_id
    got = c.get(f"/api/learn/paths/{pid}").json()
    assert got["from_ai"] and got["can_edit"] and got["ai"]["prompt"] == "Tháng 11 cho nhóm KD"
    assert c.patch(f"/api/learn/paths/{pid}", json={"title": "Nháp AI đã sửa"}).status_code == 200
    r = c.post(f"/api/learn/paths/{pid}/publish")
    assert r.status_code == 200, r.text
    assert c.get(f"/api/learn/lessons/{draft_lesson}").json()["status"] == "published"   # bài nháp phát hành cùng


def test_month_inherits_year_frame_cannot_drop_required(w):
    c, p = w["client"], w["p"]
    c.login(p["gd_part"])
    year = c.post("/api/learn/paths", json={"title": "Khung 2026", "period": "year", "year": 2026,
                                             "modules": [{"week": 1, "lesson_ids": [w["lesson"]["id"]]}],
                                             "required_items": [w["lesson"]["id"]]}).json()
    assert c.post(f"/api/learn/paths/{year['id']}/publish").status_code == 200
    c.login(p["tp_part_kd"])          # cấp dưới thấy khung đã phát hành của cấp trên
    assert c.get(f"/api/learn/paths/{year['id']}").status_code == 200
    r = c.post("/api/learn/paths", json=MONTH | {"parent_path_id": year["id"]})
    assert r.status_code == 201, r.text
    month = r.json()
    assert month["modules"][0]["lessons"][0]["id"] == w["lesson"]["id"]     # mục bắt buộc của khung điền sẵn
    r = c.patch(f"/api/learn/paths/{month['id']}", json={"modules": [{"week": 1, "lesson_ids": []}]})
    assert r.status_code == 400 and "mục bắt buộc của khung" in r.json()["detail"]
    # người ngoài tuyến quản lý của gd_part không thấy khung
    c.login(p["tp_garage_kt"])
    assert c.get(f"/api/learn/paths/{year['id']}").status_code == 404


# ---------------------------------------------------------------------------
# Giao bài (LRN-05)
# ---------------------------------------------------------------------------

def test_assign_only_within_subtree(w):
    c, p, u = w["client"], w["p"], w["u"]
    path = make_path(w)
    r = c.post(f"/api/learn/paths/{path['id']}/assign", json={"learner_ids": [str(p["nv_part_mkt"]["_id"])]})
    assert r.status_code == 403                       # khác phòng — không thuộc cây dưới quyền
    # giao theo cả division VCpart -> chỉ người trong cây của tp_part_kd (nv_part_kd), không lan sang MKT
    r = c.post(f"/api/learn/paths/{path['id']}/assign", json={"unit_ids": [str(u["VCPART"]["_id"])]})
    assert r.status_code == 200
    assert [x["name"] for x in r.json()["assigned"]] == ["nv_part_kd"]
    # giao lại -> bỏ qua kèm lý do
    r = c.post(f"/api/learn/paths/{path['id']}/assign", json={"functions": ["sales"]})
    assert r.json()["assigned"] == [] and r.json()["skipped"][0]["reason"] == "đã được giao lộ trình này"
    got = c.get(f"/api/learn/paths/{path['id']}").json()
    assert [a["learner_name"] for a in got["assignments"]] == ["nv_part_kd"]
    assert {x["name"] for x in got["assignable"]["people"]} == {"nv_part_kd"}
    # bản nháp không giao được
    draft = make_path(w, publish=False)
    assert c.post(f"/api/learn/paths/{draft['id']}/assign",
                  json={"learner_ids": [str(p["nv_part_kd"]["_id"])]}).status_code == 409


def gd_assigns(w, learners, exam=None) -> dict:
    c, p = w["client"], w["p"]
    c.login(p["gd_part"])
    body = MONTH | {"modules": [{"week": 1, "lesson_ids": [w["lesson"]["id"]]}]} | ({"exam": exam} if exam else {})
    path = c.post("/api/learn/paths", json=body).json()
    assert c.post(f"/api/learn/paths/{path['id']}/publish").status_code == 200
    r = c.post(f"/api/learn/paths/{path['id']}/assign", json={"learner_ids": [str(p[k]["_id"]) for k in learners]})
    return r.json()


def test_assigned_learner_reads_c1_lesson_outside_space(w):
    """Vấn đề mở 33 (đề xuất luồng I): bài C0 / C1 trong lộ trình được giao — người học xem được dù không ở trong kho:
    đọc thẻ trong bài, luyện tập, thi. Người không được giao vẫn không thấy."""
    c, p = w["client"], w["p"]
    lid = w["lesson"]["id"]
    c.login(p["tp_part_mkt"])
    assert c.get(f"/api/learn/lessons/{lid}").status_code == 404
    body = gd_assigns(w, ["tp_part_mkt"], EXAM)
    assert [x["name"] for x in body["assigned"]] == ["tp_part_mkt"]
    c.login(p["tp_part_mkt"])
    lesson = c.get(f"/api/learn/lessons/{lid}").json()
    assert lesson["items"][0]["title"] == "Quy trình chào hàng" and lesson["practice_count"] == 3
    assert c.post(f"/api/learn/lessons/{lid}/practice").status_code == 201
    asg = c.get("/api/learn/me").json()["months"][0]["items"][0]
    assert c.post(f"/api/learn/assignments/{asg['id']}/attempts", json={"kind": "exam"}).status_code == 201
    c.login(p["nv_part_mkt"])                               # đồng nghiệp không được giao
    assert c.get(f"/api/learn/lessons/{lid}").status_code == 404


def test_assign_skips_learner_who_cannot_see_c2_lesson(w):
    from bson import ObjectId

    from app.learn.models import lessons
    lessons.update_one({"_id": ObjectId(w["lesson"]["id"])}, {"$set": {"classification": "C2"}})
    body = gd_assigns(w, ["tp_part_mkt", "nv_part_kd"])
    assert [x["name"] for x in body["assigned"]] == ["nv_part_kd"]         # trong kho: vẫn giao được
    assert body["skipped"][0]["name"] == "tp_part_mkt" and "C2 / C3" in body["skipped"][0]["reason"]


def test_me_groups_by_month_progress_and_due_state(w):
    c, p = w["client"], w["p"]
    path = make_path(w, EXAM)
    soon = db.now() + timedelta(days=1)
    c.post(f"/api/learn/paths/{path['id']}/assign",
           json={"learner_ids": [str(p["nv_part_kd"]["_id"])], "due_at": soon.isoformat()})
    c.login(p["nv_part_kd"])
    me = c.get("/api/learn/me").json()
    assert me["months"][0]["label"] == "Tháng 10/2026"
    item = me["months"][0]["items"][0]
    assert item["due_state"] == "soon" and item["lesson_total"] == 1 and item["lesson_done"] == 0
    assert item["exam"]["question_count"] == 2 and item["exam"]["attempt"] is None
    # đọc bài + luyện tập -> bài học xong
    c.get(f"/api/learn/lessons/{w['lesson']['id']}")
    pr = c.post(f"/api/learn/lessons/{w['lesson']['id']}/practice").json()
    c.post(f"/api/learn/attempts/{pr['id']}/submit", json={"answers": {}})
    item = c.get("/api/learn/me").json()["months"][0]["items"][0]
    assert item["lesson_done"] == 1 and item["status"] == "in_progress"
    assignments.update_one({}, {"$set": {"due_at": db.now() - timedelta(days=1)}})
    assert c.get("/api/learn/me").json()["counts"]["overdue"] == 1


# ---------------------------------------------------------------------------
# Thi (LRN-07)
# ---------------------------------------------------------------------------

def test_exam_from_blueprint_hides_answers_and_resumes(w):
    path, asg, a = assign_and_start(w)
    c = w["client"]
    kinds = sorted(q["kind"] for q in a["paper"])
    assert kinds == ["essay", "single"]                         # đúng ma trận: 1 một đáp án + 1 tự luận
    assert "correct" not in str(a["paper"]) and "model_answer" not in a
    assert a["deadline_at"] and a["duration_min"] == 30 and a["is_learner"]
    again = c.post(f"/api/learn/assignments/{asg['id']}/attempts", json={"kind": "exam"})
    assert again.json()["id"] == a["id"]                        # làm dở -> tiếp tục đúng lượt đó
    assert c.get(f"/api/learn/attempts/{a['id']}").json()["id"] == a["id"]


def test_blueprint_draws_only_approved_not_stale(w):
    c = w["client"]
    questions.update_one({"_id": ObjectId(w["qs"]["single"]["id"])}, {"$set": {"status": "stale"}})
    r = c.post("/api/learn/paths", json=MONTH | {"modules": [{"week": 1, "lesson_ids": [w["lesson"]["id"]]}],
                                                  "exam": EXAM})
    r = c.post(f"/api/learn/paths/{r.json()['id']}/publish")
    assert r.status_code == 400 and "dòng 1" in r.json()["detail"]
    # lọc theo lĩnh vực (gồm nhánh con) + loại
    questions.update_one({"_id": ObjectId(w["qs"]["single"]["id"])}, {"$set": {"status": "approved"}})
    ok = make_path(w, {"blueprint": [{"category": "kinh-doanh.tu-choi", "kind": "multi", "count": 1}]})
    bad = c.post("/api/learn/paths", json=MONTH | {"modules": [{"week": 1, "lesson_ids": [w["lesson"]["id"]]}],
                                                    "exam": {"blueprint": [{"category": "kinh-doanh.tu-choi",
                                                                            "kind": "single", "count": 1}]}}).json()
    assert ok["status"] == "published"
    assert c.post(f"/api/learn/paths/{bad['id']}/publish").status_code == 400


def test_timeout_auto_submits_on_server(w):
    path, asg, a = assign_and_start(w)
    c = w["client"]
    single = next(q for q in a["paper"] if q["kind"] == "single")
    key = next(o["key"] for o in single["options"] if o["text"] == "Đúng")
    assert c.put(f"/api/learn/attempts/{a['id']}/answers", json={"answers": {single["question_id"]: key}}).status_code == 200
    attempts.update_one({}, {"$set": {"deadline_at": db.now() - timedelta(minutes=5)}})
    r = c.put(f"/api/learn/attempts/{a['id']}/answers", json={"answers": {single["question_id"]: key}})
    assert r.status_code == 409 and "hết giờ" in r.json()["detail"].lower()
    doc = attempts.find_one({})
    assert doc["submitted_at"] and doc["auto_submitted"] and doc["auto_score"] == 1.0
    assert doc["ai_status"] == "done"                           # có tự luận -> AI (giả) chấm sơ bộ
    got = c.get(f"/api/learn/attempts/{a['id']}").json()
    assert got["auto_submitted"] and got.get("final_score") is None   # chưa chốt: người học chưa thấy điểm
    # trình duyệt nộp trễ sau khi server đã tự nộp -> không lỗi
    assert c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": {}}).status_code == 200


def test_exam_attempt_limit_and_mcq_only_auto_finalizes(w):
    path, asg, a = assign_and_start(w, {"blueprint": [{"kind": "single", "count": 1}], "duration_min": 10,
                                        "pass_score": 100})
    c = w["client"]
    r = c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": answer_all(a)})
    assert r.json()["finalized_at"] and r.json()["final_score"] == 1.0 and r.json()["passed"] is True
    assert c.post(f"/api/learn/assignments/{asg['id']}/attempts", json={"kind": "exam"}).status_code == 409
    item = c.get("/api/learn/me").json()["months"][0]["items"][0]
    assert item["status"] == "completed" and item["exam"]["result"]["passed"] is True


# ---------------------------------------------------------------------------
# Chấm (LRN-08) + phản hồi (LRN-12)
# ---------------------------------------------------------------------------

def test_ai_then_human_grading_rules(w):
    path, asg, a = assign_and_start(w)
    c, p = w["client"], w["p"]
    r = c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": answer_all(a)})
    assert r.status_code == 200 and r.json()["finalized_at"] is None and "grading" not in r.json()
    essay = next(q for q in a["paper"] if q["kind"] == "essay")
    qid = essay["question_id"]

    c.login(p["tp_part_kd"])
    queue = c.get("/api/learn/grading").json()["items"]
    assert len(queue) == 1 and queue[0]["can_grade"] and queue[0]["ai_status"] == "done"
    # màn Chấm bài lọc theo đơn vị người học và hạn bài giao (SCR-17, UI-3)
    assert queue[0]["learner_unit"] and queue[0]["learner_unit_id"] and "due_at" in queue[0]
    g = c.get(f"/api/learn/attempts/{a['id']}").json()
    assert g["can_grade"] and g["grading"]["ai_grading"][0]["score"] == 3.0          # AI giả: 3/4
    pos = next(i for i, q in enumerate(a["paper"], 1) if q["kind"] == "essay")       # số câu theo vị trí trong đề
    assert g["grading"]["ai_feedback"].startswith(f"Câu {pos}:")
    assert g["grading"]["solution"][0]["correct"] is not None

    url = f"/api/learn/attempts/{a['id']}/finalize"
    r = c.post(url, json={"scores": [{"question_id": qid, "score": 3}], "feedback": "  "})
    assert r.status_code == 400 and "nhận xét" in r.json()["detail"]
    r = c.post(url, json={"scores": [], "feedback": "Tốt"})
    assert r.status_code == 400 and "chưa cho điểm" in r.json()["detail"]
    r = c.post(url, json={"scores": [{"question_id": qid, "score": 5}], "feedback": "Tốt"})
    assert r.status_code == 400                                                      # vượt điểm tối đa 4
    # lệch 3 -> 2.2 = 0.8 = 20% của 4 -> bắt buộc lý do
    r = c.post(url, json={"scores": [{"question_id": qid, "score": 2.2}], "feedback": "Cần thêm ví dụ"})
    assert r.status_code == 400 and "lý do" in r.json()["detail"]
    r = c.post(url, json={"scores": [{"question_id": qid, "score": 1, "reason": "Thiếu bước đề xuất"}],
                          "feedback": "Cần nêu đủ 3 bước"})
    assert r.status_code == 200, r.text
    assert r.json()["final_score"] == 2.0 and r.json()["passed"] is False            # (1 + 1) / 5 = 40% < 50%
    assert c.post(url, json={"scores": [{"question_id": qid, "score": 4}], "feedback": "x"}).status_code == 409
    assert c.get("/api/learn/grading").json()["items"] == []
    assert len(c.get("/api/learn/grading?inbox=0").json()["items"]) == 1
    doc = attempts.find_one({})
    assert doc["human_grading"][0]["ai_score"] == 3.0 and doc["human_grading"][0]["reason"] == "Thiếu bước đề xuất"

    # người học xem kết quả + nhận xét; phản hồi một lần
    c.login(p["nv_part_kd"])
    res = c.get(f"/api/learn/attempts/{a['id']}").json()
    assert res["final_score"] == 2.0 and res["feedback"] == "Cần nêu đủ 3 bước" and "grading" not in res
    assert next(i for i in res["items"] if i["question_id"] == qid)["score"] == 1
    assert c.post(f"/api/learn/attempts/{a['id']}/appeal", json={"text": "Em đã nêu đủ bước"}).status_code == 200
    assert c.post(f"/api/learn/attempts/{a['id']}/appeal", json={"text": "Lần 2"}).status_code == 409
    c.login(p["tp_part_kd"])
    assert c.get("/api/learn/grading?inbox=0").json()["items"][0]["appeal_open"]
    r = c.post(f"/api/learn/attempts/{a['id']}/appeal", json={"answer": "Bước 3 chưa có ví dụ cụ thể"})
    assert r.status_code == 200 and r.json()["appeal"]["answer"] == "Bước 3 chưa có ví dụ cụ thể"


def test_small_deviation_needs_no_reason(w):
    path, asg, a = assign_and_start(w)
    c, p = w["client"], w["p"]
    c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": answer_all(a)})
    qid = next(q for q in a["paper"] if q["kind"] == "essay")["question_id"]
    c.login(p["tp_part_kd"])
    r = c.post(f"/api/learn/attempts/{a['id']}/finalize",
               json={"scores": [{"question_id": qid, "score": 2.5}], "feedback": "Ổn"})   # lệch 0.5 < 0.8
    assert r.status_code == 200, r.text


def test_ai_unavailable_human_still_grades(w, monkeypatch):
    def down(p, answer):
        raise AINotReady("Chưa cấu hình ANTHROPIC_API_KEY")
    monkeypatch.setattr(grading, "ai_call", down)
    path, asg, a = assign_and_start(w)
    c, p = w["client"], w["p"]
    c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": answer_all(a)})
    c.login(p["tp_part_kd"])
    g = c.get(f"/api/learn/attempts/{a['id']}").json()
    assert g["grading"]["ai_status"] == "unavailable" and g["grading"]["ai_grading"] == []
    qid = next(q for q in a["paper"] if q["kind"] == "essay")["question_id"]
    r = c.post(f"/api/learn/attempts/{a['id']}/finalize",
               json={"scores": [{"question_id": qid, "score": 0}], "feedback": "Cần ôn lại"})
    assert r.status_code == 200 and r.json()["passed"] is False                      # 1/5 < 50%


def test_blank_essay_scored_zero_without_ai(w, monkeypatch):
    called = []
    monkeypatch.setattr(grading, "ai_call", lambda p, ans: called.append(1) or fake_ai(p, ans))
    path, asg, a = assign_and_start(w)
    c = w["client"]
    c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": {}})
    doc = attempts.find_one({})
    assert called == [] and doc["ai_grading"][0]["score"] == 0.0 and doc["ai_grading"][0]["engine"] == "rule"


def test_result_viewers_and_graders(w):
    path, asg, a = assign_and_start(w)
    c, p = w["client"], w["p"]
    c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": answer_all(a)})
    qid = next(q for q in a["paper"] if q["kind"] == "essay")["question_id"]
    fin = {"scores": [{"question_id": qid, "score": 3}], "feedback": "Tốt"}
    # đồng nghiệp ngang cấp / người ngoài tuyến: không thấy (404), hàng chờ trống
    for who in ("nv_part_mkt", "tp_part_mkt"):
        c.login(p[who])
        assert c.get(f"/api/learn/attempts/{a['id']}").status_code == 404
        assert c.post(f"/api/learn/attempts/{a['id']}/finalize", json=fin).status_code == 404
        assert c.get("/api/learn/grading?inbox=0").json()["items"] == []
    # cấp trên nhiều tầng (gd_part, tgd): xem được nhưng không chốt (chỉ người giao / quản lý trực tiếp)
    for who in ("gd_part", "tgd"):
        c.login(p[who])
        got = c.get(f"/api/learn/attempts/{a['id']}").json()
        assert "grading" in got and got["can_grade"] is False
        assert c.post(f"/api/learn/attempts/{a['id']}/finalize", json=fin).status_code == 403
        assert c.get("/api/learn/grading").json()["items"] == []
        assert len(c.get("/api/learn/grading?inbox=0").json()["items"]) == 1
    # người học không tự chốt
    c.login(p["nv_part_kd"])
    assert c.post(f"/api/learn/attempts/{a['id']}/finalize", json=fin).status_code == 403
    # người học khác không bắt đầu thi thay
    c.login(p["nv_part_mkt"])
    assert c.post(f"/api/learn/assignments/{asg['id']}/attempts", json={"kind": "exam"}).status_code == 404


def test_mcp_my_assignments(w):
    from app import mcp_server
    path, asg, a = assign_and_start(w)
    out = mcp_server.my_assignments_for(w["p"]["nv_part_kd"])
    assert out["months"][0]["items"][0]["title"] == MONTH["title"]
    assert out["months"][0]["items"][0]["exam"]["attempt"]["id"] == a["id"]


# ---------------------------------------------------------------------------
# Bản nháp do luồng H (AI thiết kế lộ trình) dựng — mở, sửa, phát hành, giao ở màn hình lộ trình
# ---------------------------------------------------------------------------

from tests.test_learn_ai import design, no_ai, world  # noqa: E402,F401 — fixture của luồng H


def test_h_designer_draft_opens_publishes_assigns(world, no_ai):
    cl, c = world["client"], world["c"]
    d = design(world)                                      # POST /learn/paths/design (AI không chạy -> nháp code)
    body = {"title": "Tháng 10 — KD mới", "space_id": str(world["space"]["_id"]),
            "exam": {"blueprint": "10 câu trắc nghiệm", "duration_min": 30, "pass_score": 70},
            "weeks": [{"week": 1, "lessons": [{"title": "Bài chào hàng", "objectives": ["A"],
                                               "cards": [{"card_id": str(c["fw"]["_id"])}]}]}]}
    assert cl.put(f"/api/learn/paths/{d['id']}/design", json=body).status_code == 200
    got = cl.get(f"/api/learn/paths/{d['id']}").json()
    assert got["from_ai"] and got["can_edit"] and got["status"] == "draft"
    assert got["modules"][0]["lessons"][0]["title"] == "Bài chào hàng"
    assert got["exam"]["blueprint"] == [] and got["exam"]["blueprint_note"] == "10 câu trắc nghiệm"
    # ma trận đề của AI chỉ là chữ -> phải điền ma trận (hoặc bỏ bài thi) trước khi phát hành
    r = cl.post(f"/api/learn/paths/{d['id']}/publish")
    assert r.status_code == 400 and "ma trận đề" in r.json()["detail"]
    assert cl.patch(f"/api/learn/paths/{d['id']}", json={"exam": None}).status_code == 200
    r = cl.post(f"/api/learn/paths/{d['id']}/publish")
    assert r.status_code == 200, r.text
    lesson_id = r.json()["modules"][0]["lessons"][0]["id"]
    assert cl.get(f"/api/learn/lessons/{lesson_id}").json()["status"] == "published"   # bài nháp AI phát hành cùng
    r = cl.post(f"/api/learn/paths/{d['id']}/assign", json={"learner_ids": [str(world["p"]["nv_part_kd"]["_id"])]})
    assert [x["name"] for x in r.json()["assigned"]] == ["nv_part_kd"]
    cl.login(world["p"]["nv_part_kd"])
    item = cl.get("/api/learn/me").json()["months"][0]["items"][0]
    assert item["title"] == "Tháng 10 — KD mới" and item["lesson_total"] == 1


# ---------------------------------------------------------------------------
# Sửa lỗi QA vòng 2 (chuỗi Học tập)
# ---------------------------------------------------------------------------

def frame_with_private_lesson(w, classification=None) -> tuple[dict, str]:
    """gd_part dựng bài học trong KHO CÁ NHÂN (cấp dưới không xem được), đưa vào khung năm, đánh bắt buộc, phát hành."""
    from app.spaces import personal_space
    c, p = w["client"], w["p"]
    gd = p["gd_part"]
    card = add_card(personal_space(gd), "Văn hoá tập đoàn")
    c.login(gd)
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "Bài bắt buộc của khung", "space_id": str(personal_space(gd)["_id"]),
                                            "items": [{"card_id": str(card["_id"])}]})
    lid = c.patch(f"/api/learn/lessons/{r.json()['id']}", json={"status": "published"}).json()["id"]
    if classification:
        from bson import ObjectId

        from app.learn.models import lessons
        lessons.update_one({"_id": ObjectId(lid)}, {"$set": {"classification": classification}})
    year = c.post("/api/learn/paths", json={"title": "Khung 2026", "period": "year", "year": 2026,
                                             "modules": [{"week": 1, "lesson_ids": [lid]}], "required_items": [lid]})
    assert year.status_code == 201, year.text
    assert c.post(f"/api/learn/paths/{year.json()['id']}/publish").status_code == 200
    return year.json(), lid


def test_qa2_l3_l11_inherit_frame_with_lesson_outside_my_space(w):
    """L3: bài bắt buộc của khung nằm trong kho riêng của cấp trên — cấp dưới (người soạn) vẫn kế thừa, đọc bài,
    phát hành, giao được (bài C0 / C1). L11: mục bắt buộc của khung vào required_items + nhãn bắt buộc cho người học."""
    c, p = w["client"], w["p"]
    year, lid = frame_with_private_lesson(w)
    c.login(p["nv_part_kd"])                              # nhân viên (không soạn) không mở bài của khung
    assert c.get(f"/api/learn/lessons/{lid}").status_code == 404
    c.login(p["tp_part_kd"])
    lesson = c.get(f"/api/learn/lessons/{lid}").json()
    assert lesson["items"][0]["title"] == "Văn hoá tập đoàn"      # đọc được nội dung thẻ qua khung
    r = c.post("/api/learn/paths", json=MONTH | {"parent_path_id": year["id"]})
    assert r.status_code == 201, r.text
    month = r.json()
    assert month["required_items"] == [lid]                          # L11
    r = c.patch(f"/api/learn/paths/{month['id']}", json={"modules": [
        {"week": 1, "lesson_ids": [lid]}, {"week": 2, "lesson_ids": [w["lesson"]["id"]]}]})
    assert r.status_code == 200, r.text
    assert c.post(f"/api/learn/paths/{month['id']}/publish").status_code == 200
    r = c.post(f"/api/learn/paths/{month['id']}/assign", json={"learner_ids": [str(p["nv_part_kd"]["_id"])]})
    assert [x["name"] for x in r.json()["assigned"]] == ["nv_part_kd"]
    c.login(p["nv_part_kd"])
    mods = c.get("/api/learn/me").json()["months"][0]["items"][0]["modules"]
    req = {x["title"]: x["required"] for m in mods for x in m["lessons"]}
    assert req == {"Bài bắt buộc của khung": True, "Bán hàng cơ bản": False}
    assert c.get(f"/api/learn/lessons/{lid}").status_code == 200


def test_qa2_l3_c2_frame_lesson_error_names_lesson(w):
    """Bài của khung ở mức C2 / C3 vẫn theo kho — lỗi nói rõ bài nào và cách xử lý."""
    c, p = w["client"], w["p"]
    year, lid = frame_with_private_lesson(w, "C2")
    c.login(p["tp_part_kd"])
    r = c.post("/api/learn/paths", json=MONTH | {"parent_path_id": year["id"]})
    assert r.status_code == 400
    assert "“Bài bắt buộc của khung”" in r.json()["detail"] and "C2 / C3" in r.json()["detail"]


def test_qa2_l4_employee_sees_only_assigned_paths_without_ai(w):
    """L4: nhân viên không thấy lộ trình của quản lý khi chưa được giao; được giao thì thấy nhưng không có `ai`
    (prompt, người học). Người tạo + cấp trên của người tạo thấy đủ."""
    from app.learn.models import learning_paths
    c, p = w["client"], w["p"]
    path = make_path(w)
    learning_paths.update_one({"_id": ObjectId(path["id"])}, {"$set": {"ai": {
        "prompt": "Người học: nv_part_kd — yếu kỹ năng chốt đơn", "learner_ids": [p["nv_part_kd"]["_id"]]}}})
    for who in ("nv_part_kd", "nv_part_mkt"):
        c.login(p[who])
        assert c.get("/api/learn/paths").json()["items"] == []
        assert c.get(f"/api/learn/paths/{path['id']}").status_code == 404
    c.login(p["tp_part_kd"])
    assert c.get(f"/api/learn/paths/{path['id']}").json()["ai"]["prompt"].startswith("Người học")
    c.post(f"/api/learn/paths/{path['id']}/assign", json={"learner_ids": [str(p["nv_part_kd"]["_id"])]})
    c.login(p["nv_part_kd"])
    assert [x["id"] for x in c.get("/api/learn/paths").json()["items"]] == [path["id"]]
    got = c.get(f"/api/learn/paths/{path['id']}").json()
    assert got["ai"] is None and "assignments" not in got
    # người soạn cấp dưới thấy khung của cấp trên (để kế thừa) nhưng không thấy prompt / người học của khung
    year, _ = frame_with_private_lesson(w)
    learning_paths.update_one({"_id": ObjectId(year["id"])}, {"$set": {"ai": {"prompt": "Khung"}}})
    assert c.get(f"/api/learn/paths/{year['id']}").json()["ai"]["prompt"] == "Khung"       # gd_part: người tạo
    c.login(p["tp_part_kd"])
    got = c.get(f"/api/learn/paths/{year['id']}").json()
    assert got["title"] == "Khung 2026" and got["ai"] is None


def test_qa2_l5_browser_timeout_submit_marked_auto(w):
    path, asg, a = assign_and_start(w)
    c = w["client"]
    attempts.update_one({}, {"$set": {"deadline_at": db.now() + timedelta(seconds=2)}})
    r = c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": {}, "auto": True})
    assert r.status_code == 200 and r.json()["auto_submitted"] is True
    assert attempts.find_one({})["auto_submitted"] is True


def test_qa2_l5_early_auto_flag_ignored(w):
    path, asg, a = assign_and_start(w)
    c = w["client"]
    r = c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": {}, "auto": True})   # còn ~30 phút
    assert r.status_code == 200 and r.json()["auto_submitted"] is False


def test_qa2_l6_default_due_end_of_day_vietnam():
    from datetime import datetime, timezone

    from app.learn.paths import default_due
    assert default_due({"year": 2026, "month": 10}) == datetime(2026, 10, 31, 16, 59, tzinfo=timezone.utc)
    assert default_due({"year": 2026, "period": "year"}) == datetime(2026, 12, 31, 16, 59, tzinfo=timezone.utc)


def test_qa2_l7_ai_feedback_numbers_by_paper_position_and_c3_not_sent(w, monkeypatch):
    """L7: nhận xét nháp đánh số theo vị trí câu trong đề. Câu tự luận gắn thẻ C3 không gửi AI chấm (15.5)."""
    path, asg, a = assign_and_start(w)
    c = w["client"]
    doc = attempts.find_one({})
    paper = sorted(doc["paper"], key=lambda q: q["kind"] == "essay")          # tự luận thành câu 2
    attempts.update_one({}, {"$set": {"paper": paper}})
    c.post(f"/api/learn/attempts/{a['id']}/submit", json={"answers": answer_all(a)})
    assert attempts.find_one({})["ai_feedback"] == "Câu 2: Trả lời khá, thiếu ví dụ"
    # lượt khác: câu tự luận C3 -> không gọi AI, để trống điểm AI kèm ghi chú
    called = []
    monkeypatch.setattr(grading, "ai_call", lambda p, ans: called.append(1) or fake_ai(p, ans))
    essay = next(q for q in paper if q["kind"] == "essay")
    questions.update_one({"_id": ObjectId(str(essay["question_id"]))}, {"$set": {"classification": "C3"}})
    attempts.update_one({}, {"$set": {"ai_status": "pending", "ai_grading": [], "ai_feedback": None}})
    grading.run_ai_grading(doc["_id"])
    got = attempts.find_one({})
    assert called == [] and got["ai_grading"][0]["score"] is None and "C3" in got["ai_grading"][0]["note"]
    assert got["ai_feedback"] is None
