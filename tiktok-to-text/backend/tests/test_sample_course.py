"""Khoá mẫu /learn (yêu cầu 6ab889cd…9949de): seed a–d, idempotent, reset, không tự duyệt, danh mục + tự ghi danh,
người học ngoài kho học → thi 15 TN + 2 TL → quản lý chốt → Đạt."""

from __future__ import annotations

import pytest
from bson import ObjectId

from app import db
from app.learn import grading, sample
from app.learn.models import assignments, attempts, learning_paths, lessons, questions
from app.spaces import spaces
from tests.conftest import grant, make_user
from tests.test_bulk_review import set_min

cards = db.db["wiki_cards"]
COURSE = sample.load()
LESSON_CARDS = {"6ab4b9d9b1c921b0a784dbff", "6ab4b975b1c921b0a784dbe7"}     # loại `lesson` -> câu tự luận
CHECKLIST = {"6ab4ba06b1c921b0a784dc0b"}


def fake_grade(p, answer):
    per = [{"criterion": r["criterion"], "score": r["max"] * 0.8, "max": r["max"], "comment": "Khá"} for r in p["rubric"]]
    return {"score": sum(x["score"] for x in per), "per_criterion": per, "feedback": "Ổn", "engine": "fake"}


@pytest.fixture(autouse=True)
def fake_ai(monkeypatch):
    monkeypatch.setenv("LEARN_AI_FAKE", "1")
    monkeypatch.setattr(grading, "schedule_ai", grading.run_ai_grading)
    monkeypatch.setattr(grading, "ai_call", fake_grade)


@pytest.fixture
def w():
    """Kho org "Kho video TikTok" của quản trị viên + 17 thẻ đúng mã của khoá (nháp, tác giả là người khác).
    Số người duyệt tối thiểu = 1 như DB thật; bốn mắt vẫn giữ (tác giả không tự duyệt)."""
    set_min(1)
    admin = make_user("Quản trị", "admin@test.local", role="admin")
    author = make_user("Tác giả", "tacgia@test.local")
    learner = make_user("NV kinh doanh", "nv@test.local")
    grant(admin, "lnd")                              # người chạy seed: L&D (learn.author) — admin trơn thì không có
    space = {"name": COURSE["org_space"], "description": "", "type": "shared", "owner_id": admin["_id"],
             "visibility": "org", "created_at": db.now(), "members": [{"user_id": admin["_id"], "role": "owner"}]}
    space["_id"] = spaces.insert_one(space).inserted_id
    for cid in [*sample.graded_ids(COURSE), *COURSE["reading_cards"]]:
        typ = "lesson" if cid in LESSON_CARDS else "checklist" if cid in CHECKLIST else "framework"
        cards.insert_one({"_id": ObjectId(cid), "space_id": space["_id"], "type": typ, "title": f"Thẻ {cid[-4:]}",
                          "summary": f"Tóm tắt {cid[-4:]}", "key_points": ["Ý một", "Ý hai"], "body": "Nội dung",
                          "status": "draft", "origin": "manual", "created_by": author["_id"],
                          "categories": ["bh.ky-nang-b2b"], "created_at": db.now(), "updated_at": db.now()})
    return {"admin": admin, "author": author, "learner": learner, "space": space}


def approve_cards(client, reviewer, ids):
    client.login(reviewer)
    r = client.post("/api/wiki/bulk-review/decide", json={"card_ids": ids, "decision": "approve",
                                                           "include_pending_novelty": True})
    assert r.status_code == 200, r.text
    return r.json()


def approve_questions(client, reviewer):
    client.login(reviewer)
    rows = client.get(f"/api/learn/questions?sample={COURSE['sample_key']}&status=draft&page_size=200").json()["items"]
    for q in rows:
        r = client.patch(f"/api/learn/questions/{q['id']}", json={"status": "approved"})
        assert r.status_code == 200, r.text
    return len(rows)


def counts():
    key = COURSE["sample_key"]
    return (learning_paths.count_documents({"sample_key": key}), lessons.count_documents({"sample_key": key}),
            questions.count_documents({"sample_key": key}), assignments.count_documents({}))


def test_dry_run_pending_cards_writes_nothing(w):
    code, info = sample.run(COURSE, w["admin"], dry_run=True)
    assert code == sample.CARDS_PENDING
    assert len(info["check"]["pending"]) == 16
    assert info["link"].startswith("/wiki/review?tab=bulk&ids=") and all(i in info["link"] for i in sample.graded_ids(COURSE))
    code, _ = sample.run(COURSE, w["admin"])                 # không dry-run cũng dừng ở bước a, không ghi gì
    assert code == sample.CARDS_PENDING
    assert counts() == (0, 0, 0, 0)
    assert cards.count_documents({"status": "approved"}) == 0


def test_hard_errors(w):
    cards.update_one({"_id": ObjectId(sample.graded_ids(COURSE)[0])}, {"$set": {"classification": "C3"}})
    assert sample.run(COURSE, w["admin"], dry_run=True)[0] == sample.HARD_ERROR
    cards.delete_one({"_id": ObjectId(sample.graded_ids(COURSE)[1])})
    code, info = sample.run(COURSE, w["admin"], dry_run=True)
    assert code == sample.HARD_ERROR and info["check"]["missing"] == [sample.graded_ids(COURSE)[1]]


def test_runner_without_learn_author_is_refused(client, w):
    approve_cards(client, w["admin"], [*sample.graded_ids(COURSE), *COURSE["reading_cards"]])
    with pytest.raises(Exception, match="learn.author"):
        sample.run(COURSE, w["author"])
    assert counts() == (0, 0, 0, 0)


def test_author_cannot_approve_own_cards_four_eyes(client, w):
    res = approve_cards(client, w["author"], sample.graded_ids(COURSE))
    assert not res["done"] and cards.count_documents({"status": "approved"}) == 0


def test_full_flow_idempotent_reset(client, w):
    ids = sample.graded_ids(COURSE)
    res = approve_cards(client, w["admin"], [*ids, *COURSE["reading_cards"]])
    assert len(res["done"]) == 17, res["skipped"]

    # b + c: dựng nháp, dừng chờ duyệt câu — không câu nào tự duyệt
    code, info = sample.run(COURSE, w["admin"])
    assert code == sample.QUESTIONS_PENDING
    assert info["link"] == f"/learn/library?tab=questions&sample={COURSE['sample_key']}&status=draft"
    n_path, n_lessons, n_q, _ = counts()
    assert (n_path, n_lessons) == (1, 8) and n_q == 16 * 2 + 2
    assert questions.count_documents({"sample_key": COURSE["sample_key"], "status": "approved"}) == 0
    assert learning_paths.find_one({"sample_key": COURSE["sample_key"]})["status"] == "draft"
    for ls in lessons.find({"sample_key": COURSE["sample_key"]}):
        assert ls["space_id"] == w["space"]["_id"] and ls["items"]
        assert all(i["rev"] >= 1 for i in ls["items"])
        assert all(str(i["card_id"]) in ls["narrative"] for i in ls["items"])      # trích mã thẻ + phiên bản
    last = lessons.find_one({"sample_key": COURSE["sample_key"], "sample_lesson": 8})
    assert ObjectId(COURSE["reading_cards"][0]) in [i["card_id"] for i in last["items"]]
    # câu theo thẻ ≤ độ khó 4; 2 tự luận tình huống gara độ khó 5
    assert questions.count_documents({"sample_key": COURSE["sample_key"], "difficulty": 5}) == 2

    assert sample.run(COURSE, w["admin"])[0] == sample.QUESTIONS_PENDING       # chạy lại: không tạo trùng
    assert counts()[:3] == (1, 8, 34)
    assert sample.status(COURSE)["stage"] == "questions"

    # d: người bấm duyệt câu → phát hành + ghi danh người chạy
    assert approve_questions(client, w["admin"]) == 34
    code, info = sample.run(COURSE, w["admin"])
    assert code == sample.OK
    p = learning_paths.find_one({"sample_key": COURSE["sample_key"]})
    assert p["status"] == "published" and p["is_sample"] and p["open_enroll"]
    assert lessons.count_documents({"sample_key": COURSE["sample_key"], "status": "published"}) == 8
    a = assignments.find_one({"learner_id": w["admin"]["_id"]})
    assert a and a["self_enrolled"]
    assert sample.run(COURSE, w["admin"])[0] == sample.OK                        # lần 2: 1 khoá, 1 lượt giao
    assert counts() == (1, 8, 34, 1)
    assert sample.status(COURSE)["stage"] == "ready"

    sample.reset(COURSE)
    assert counts() == (0, 0, 0, 0)
    assert sample.run(COURSE, w["admin"])[0] == sample.QUESTIONS_PENDING      # dựng lại sạch
    assert counts()[:3] == (1, 8, 34)


def publish_ready(client, w):
    approve_cards(client, w["admin"], [*sample.graded_ids(COURSE), *COURSE["reading_cards"]])
    sample.run(COURSE, w["admin"])
    approve_questions(client, w["admin"])
    assert sample.run(COURSE, w["admin"])[0] == sample.OK
    return learning_paths.find_one({"sample_key": COURSE["sample_key"]})


def test_catalog_admin_sees_pending_sample(client, w):
    client.login(w["admin"])
    r = client.get("/api/learn/catalog").json()
    mine = [x for x in r["samples"] if x["sample_key"] == COURSE["sample_key"]]
    assert r["items"] == [] and len(r["samples"]) == 1            # khoá mẫu khác: DB test không có thẻ → không hiện
    assert mine[0]["stage"] == "cards" and mine[0]["cards_pending"] == 16
    assert mine[0]["review_link"].startswith("/wiki/review?tab=bulk&ids=")
    client.login(w["learner"])
    assert client.get("/api/learn/catalog").json()["samples"] == []               # nhân viên không thấy khối quản trị


def test_learner_enrolls_learns_exam_pass(client, w):
    p = publish_ready(client, w)
    client.login(w["learner"])                       # không là thành viên kho, không có kho cá nhân chung
    cat = client.get("/api/learn/catalog").json()
    assert [i["title"] for i in cat["items"]] == [COURSE["title"]]
    item = cat["items"][0]
    assert item["is_sample"] and item["weeks"] == 4 and item["lesson_count"] == 8 and not item["enrolled"]
    assert item["exam"] == {"question_count": 17, "duration_min": 30, "pass_score": 70}
    r = client.post(f"/api/learn/paths/{p['_id']}/enroll")
    assert r.status_code == 201 and r.json()["created"]
    assert client.post(f"/api/learn/paths/{p['_id']}/enroll").json()["created"] is False
    me = client.get("/api/learn/me").json()
    a = me["months"][0]["items"][0]
    assert a["is_sample"] and a["self_enrolled"] and a["weeks"] == 4 and a["lesson_total"] == 8 and not a["started"]
    first = a["next_lesson_id"]
    assert first == a["modules"][0]["lessons"][0]["id"]

    # học 8 bài + luyện tập
    for m in a["modules"]:
        for ls in m["lessons"]:
            les = client.get(f"/api/learn/lessons/{ls['id']}").json()
            assert all(not it.get("unavailable") for it in les["items"])         # đọc được thẻ qua lộ trình
            att = client.post(f"/api/learn/lessons/{ls['id']}/practice")
            assert att.status_code == 201, att.text
            client.post(f"/api/learn/attempts/{att.json()['id']}/submit", json={"answers": {}})
    a = client.get("/api/learn/me").json()["months"][0]["items"][0]
    assert a["lesson_done"] == 8 and a["next_lesson_id"] is None and a["started"]

    # thi: 15 TN + 2 TL (đúng 2 câu tình huống gara)
    ex = client.post(f"/api/learn/assignments/{a['id']}/attempts", json={"kind": "exam"})
    assert ex.status_code == 201, ex.text
    ex = ex.json()
    kinds = [q["kind"] for q in ex["paper"]]
    assert kinds.count("single") == 8 and kinds.count("multi") == 7 and kinds.count("essay") == 2
    essay_ids = {str(q["_id"]) for q in questions.find({"sample_role": "exam_essay"})}
    assert {q["question_id"] for q in ex["paper"] if q["kind"] == "essay"} == essay_ids
    answers = {}
    for q in ex["paper"]:
        if q["kind"] == "essay":
            answers[q["question_id"]] = "Nghe hết, hỏi lý do thật, đưa giá trị."
            continue
        right = {o["text"] for o in questions.find_one({"_id": ObjectId(q["question_id"])})["options"] if o["correct"]}
        keys = [o["key"] for o in q["options"] if o["text"] in right]
        answers[q["question_id"]] = keys[0] if q["kind"] == "single" else keys
    r = client.post(f"/api/learn/attempts/{ex['id']}/submit", json={"answers": answers})
    assert r.status_code == 200, r.text

    # người tạo khoá (người giao của lượt tự ghi danh) chốt có nhận xét; điểm tự luận = điểm AI gợi ý (8/10)
    client.login(w["admin"])
    r = client.post(f"/api/learn/attempts/{ex['id']}/finalize", json={
        "feedback": "Làm tốt, nhớ hỏi lý do thật trước khi đưa giá trị.",
        "scores": [{"question_id": qid, "score": 8} for qid in essay_ids]})
    assert r.status_code == 200, r.text
    fin = attempts.find_one({"_id": ObjectId(ex["id"])})
    assert fin["finalized_at"] and fin["passed"] is True
