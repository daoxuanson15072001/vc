"""API Học tập luồng E (docs/BA.md mục 17 — LRN-01, LRN-02 phần tạo tay, LRN-09 luyện tập) + luật quyền 15.6."""

from __future__ import annotations

import pytest

from tests.training_support import training_subject

from app import db
from app.learn.models import attempts, lessons
from app.spaces import personal_space, spaces

cards = db.db["wiki_cards"]


def shared_space(owner: dict, members: list[tuple[dict, str]] | None = None, visibility: str = "private") -> dict:
    doc = {"name": "Kho phòng", "description": "", "type": "shared", "owner_id": owner["_id"],
           "visibility": visibility, "created_at": db.now(),
           "members": [{"user_id": owner["_id"], "role": "owner"},
                       *({"user_id": u["_id"], "role": r} for u, r in members or [])]}
    doc["_id"] = spaces.insert_one(doc).inserted_id
    return doc


def add_card(space: dict, title: str, status: str = "approved", **extra) -> dict:
    doc = {"space_id": space["_id"], "type": "concept", "title": title, "summary": f"Tóm tắt {title}",
           "body": f"Nội dung **{title}**", "key_points": ["Ý 1"], "status": status, "created_by": space["owner_id"],
           "created_at": db.now(), "updated_at": db.now()} | extra
    doc["_id"] = cards.insert_one(doc).inserted_id
    return doc


SINGLE = {"kind": "single", "stem": "Câu một đáp án?", "explanation": "Vì thẻ nói vậy", "difficulty": 2,
          "bloom": "remember", "options": [{"text": "Đúng", "correct": True}, {"text": "Sai", "correct": False}]}
MULTI = {"kind": "multi", "stem": "Câu nhiều đáp án?", "options": [
    {"text": "A đúng", "correct": True}, {"text": "B sai"}, {"text": "C đúng", "correct": True}]}
ESSAY = {"kind": "essay", "stem": "Xử lý tình huống?", "model_answer": "Đáp án mẫu",
         "rubric": [{"criterion": "Nêu đủ bước", "max": 4, "descriptor": "3 bước"}]}


@pytest.fixture
def world(org_sample, client):
    """tp_part_kd (quản lý) có kho phòng; nv_part_kd (dưới quyền) là thành viên xem; nv_part_mkt khác phòng."""
    p = org_sample["people"]
    space = shared_space(p["tp_part_kd"], [(p["nv_part_kd"], "viewer")])
    c1, c2 = add_card(space, "Quy trình chào hàng"), add_card(space, "Xử lý từ chối", current_revision=3)
    return {"p": p, "space": space, "c1": c1, "c2": c2, "client": client}


def make_question(client, body: dict, cards_: list[dict], approve: bool = True) -> dict:
    r = client.post("/api/learn/questions", json=body | {"card_ids": [str(c["_id"]) for c in cards_]})
    assert r.status_code == 201, r.text
    q = r.json()
    if approve:
        q = client.patch(f"/api/learn/questions/{q['id']}", json={"status": "approved"}).json()
    return q


def make_lesson(w, questions_: list[dict], publish: bool = True) -> dict:
    c = w["client"]
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c),
        "title": "Bán hàng cơ bản", "objectives": ["Biết chào hàng"], "narrative": "## Diễn giải\nĐọc kỹ.",
        "space_id": str(w["space"]["_id"]), "items": [{"card_id": str(w["c1"]["_id"])}, {"card_id": str(w["c2"]["_id"])}],
        "practice_question_ids": [q["id"] for q in questions_]})
    assert r.status_code == 201, r.text
    lesson = r.json()
    if publish:
        lesson = c.patch(f"/api/learn/lessons/{lesson['id']}", json={"status": "published"}).json()
        assert lesson["status"] == "published"
    return lesson


# ---------------------------------------------------------------------------
# Bài học
# ---------------------------------------------------------------------------

def test_lesson_pins_revision_and_classification(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    db.db["card_revisions"].insert_one({"card_id": w["c2"]["_id"], "rev": 3, "snapshot": {
        "title": "Xử lý từ chối (bản 3)", "body": "Nội dung bản 3", "classification": "C2"}})
    cards.update_one({"_id": w["c2"]["_id"]}, {"$set": {"classification": "C2"}})
    lesson = make_lesson(w, [], publish=False)
    assert [(i["title"], i["rev"]) for i in lesson["items"]] == [("Quy trình chào hàng", 1),
                                                                  ("Xử lý từ chối (bản 3)", 3)]
    assert lesson["items"][0]["pinned_rev_missing"] and not lesson["items"][1]["pinned_rev_missing"]
    assert lesson["classification"] == "C2"                   # mức cao nhất của thẻ trong bài
    assert lesson["status"] == "draft" and lesson["can_edit"] and lesson["space_id"] == str(w["space"]["_id"])
    # thẻ lên bản mới: bài học vẫn hiện đúng bản đã ghim, kèm cờ lệch phiên bản
    cards.update_one({"_id": w["c2"]["_id"]}, {"$set": {"current_revision": 4, "title": "Bản 4"}})
    got = c.get(f"/api/learn/lessons/{lesson['id']}").json()
    assert got["items"][1]["title"] == "Xử lý từ chối (bản 3)" and got["items"][1]["outdated"]


def test_lesson_default_personal_space(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "Bài riêng", "items": [{"card_id": str(w["c1"]["_id"])}]})
    assert r.status_code == 201
    assert r.json()["space_id"] == str(personal_space(w["p"]["tp_part_kd"])["_id"])


def test_cannot_use_invisible_or_unapproved_cards(world):
    w, c = world, world["client"]
    other = add_card(personal_space(w["p"]["tp_part_mkt"]), "Thẻ phòng khác")
    draft = add_card(w["space"], "Thẻ nháp", status="draft")
    c.login(w["p"]["tp_part_kd"])
    for bad in (other, draft):
        r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "X", "items": [{"card_id": str(bad["_id"])}]})
        assert r.status_code == 400, r.text
        assert "đã duyệt mà bạn xem được" in r.json()["detail"]
    r = c.post("/api/learn/questions", json=SINGLE | {"card_ids": [str(other["_id"])]})
    assert r.status_code == 400
    assert lessons.count_documents({}) == 0


def test_only_authors_create(world):
    w, c = world, world["client"]
    c.login(w["p"]["nv_part_kd"])                             # nhân viên không có người dưới quyền, không vai trò
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "X", "items": [{"card_id": str(w["c1"]["_id"])}]})
    assert r.status_code == 403
    assert c.post("/api/learn/questions", json=SINGLE | {"card_ids": [str(w["c1"]["_id"])]}).status_code == 403
    assert c.get("/api/learn/questions").status_code == 403    # ngân hàng câu hỏi có đáp án
    c.login(w["p"]["tp_part_kd"])
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "X", "items": [{"card_id": str(w["c1"]["_id"])}],
                                           "space_id": str(personal_space(w["p"]["nv_part_kd"])["_id"])})
    assert r.status_code == 404                                # kho người khác: không lộ


def test_published_lesson_locked_and_visibility(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    draft = make_lesson(w, [], publish=False)
    c.login(w["p"]["nv_part_kd"])
    assert c.get(f"/api/learn/lessons/{draft['id']}").status_code == 404      # bản nháp chỉ người soạn thấy
    assert c.get("/api/learn/lessons").json()["items"] == []
    c.login(w["p"]["tp_part_kd"])
    pub = c.patch(f"/api/learn/lessons/{draft['id']}", json={"status": "published"}).json()
    assert pub["published_at"] and not pub["can_edit"]
    r = c.patch(f"/api/learn/lessons/{draft['id']}", json={"title": "Đổi tên"})
    assert r.status_code == 409 and "bản sao" in r.json()["detail"]
    c.login(w["p"]["nv_part_kd"])
    got = c.get(f"/api/learn/lessons/{draft['id']}").json()
    assert got["title"] == "Bán hàng cơ bản" and len(got["items"]) == 2 and not got["can_edit"]
    assert [x["id"] for x in c.get("/api/learn/lessons").json()["items"]] == [draft["id"]]
    c.login(w["p"]["nv_part_mkt"])                                             # khác phòng, không ở kho
    assert c.get(f"/api/learn/lessons/{draft['id']}").status_code == 404


def test_lesson_hides_cards_viewer_cannot_see(world):
    """Người soạn đưa thẻ kho cá nhân vào bài ở kho phòng: người học không đọc được thẻ đó qua bài học."""
    w, c = world, world["client"]
    private = add_card(personal_space(w["p"]["tp_part_kd"]), "Ghi chú riêng")
    c.login(w["p"]["tp_part_kd"])
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "Bài", "space_id": str(w["space"]["_id"]),
                                           "items": [{"card_id": str(w["c1"]["_id"])},
                                                     {"card_id": str(private["_id"])}]})
    lid = r.json()["id"]
    c.patch(f"/api/learn/lessons/{lid}", json={"status": "published"})
    c.login(w["p"]["nv_part_kd"])
    items = c.get(f"/api/learn/lessons/{lid}").json()["items"]
    assert items[0]["title"] == "Quy trình chào hàng"
    assert items[1] == {"card_id": str(private["_id"]), "rev": 1, "unavailable": True}


# ---------------------------------------------------------------------------
# Ngân hàng câu hỏi
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("body,msg", [
    (SINGLE | {"options": [{"text": "A", "correct": True}, {"text": "B", "correct": True}]}, "đúng 1"),
    (SINGLE | {"options": [{"text": "A", "correct": False}, {"text": "B"}]}, "đúng 1"),
    (SINGLE | {"options": [{"text": "A", "correct": True}]}, "2–6"),
    (MULTI | {"options": [{"text": "A"}, {"text": "B"}]}, "ít nhất 1"),
    (ESSAY | {"rubric": []}, "rubric"),
    (ESSAY | {"rubric": [{"criterion": "X", "max": 0}]}, "lớn hơn 0"),
])
def test_question_validation(world, body, msg):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    r = c.post("/api/learn/questions", json=body | {"card_ids": [str(w["c1"]["_id"])]})
    assert r.status_code == 400 and msg in r.json()["detail"], r.text


def test_question_validation_schema(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    cid = [str(w["c1"]["_id"])]
    assert c.post("/api/learn/questions", json=SINGLE | {"card_ids": cid, "difficulty": 6}).status_code == 422
    assert c.post("/api/learn/questions", json=SINGLE | {"card_ids": []}).status_code == 422
    seven = [{"text": str(i), "correct": i == 0} for i in range(7)]
    assert c.post("/api/learn/questions", json=SINGLE | {"card_ids": cid, "options": seven}).status_code == 422


def test_question_crud_filter_approve(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    q1 = make_question(c, SINGLE | {"space_id": str(w["space"]["_id"])}, [w["c1"]], approve=False)
    assert q1["status"] == "draft" and q1["card_refs"][0]["rev"] == 1 and q1["card_refs"][0]["title"]
    q2 = make_question(c, ESSAY, [w["c2"]])
    assert q2["status"] == "approved" and q2["approved_by_name"] == "tp_part_kd" and q2["max"] == 4
    assert q2["card_refs"][0]["rev"] == 3 and q2["options"] == []
    ls = lambda **kw: [x["id"] for x in c.get("/api/learn/questions", params=kw).json()["items"]]  # noqa: E731
    assert ls(card_id=str(w["c1"]["_id"])) == [q1["id"]]
    assert ls(status="approved") == [q2["id"]]
    assert ls(kind="essay") == [q2["id"]]
    assert ls(difficulty=2) == [q1["id"]]
    # sửa nội dung câu đã duyệt -> quay về nháp
    r = c.patch(f"/api/learn/questions/{q2['id']}", json={"stem": "Đề mới?"}).json()
    assert r["status"] == "draft" and r["approved_by"] is None and r["stem"] == "Đề mới?"
    # đổi loại phải hợp lệ
    assert c.patch(f"/api/learn/questions/{q1['id']}", json={"kind": "essay"}).status_code == 400
    # người khác phòng (cũng là quản lý) không thấy câu trong kho không phải của mình
    c.login(w["p"]["tp_part_mkt"])
    assert c.get("/api/learn/questions").json()["items"] == []
    assert c.patch(f"/api/learn/questions/{q1['id']}", json={"status": "approved"}).status_code == 404


# ---------------------------------------------------------------------------
# Luyện tập (lượt làm bài)
# ---------------------------------------------------------------------------

def test_practice_flow(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    qs = [make_question(c, SINGLE | {"space_id": str(w["space"]["_id"])}, [w["c1"]]),
          make_question(c, MULTI | {"space_id": str(w["space"]["_id"])}, [w["c2"]]),
          make_question(c, ESSAY, [w["c1"]]),
          make_question(c, SINGLE | {"stem": "Câu nháp?"}, [w["c1"]], approve=False)]
    lesson = make_lesson(w, qs, publish=False)
    assert c.patch(f"/api/learn/lessons/{lesson['id']}", json={"status": "published"}).status_code == 400
    assert c.patch(f"/api/learn/lessons/{lesson['id']}", json={"practice_question_ids": [q['id'] for q in qs[:3]]}).status_code == 200
    lesson = c.patch(f"/api/learn/lessons/{lesson['id']}", json={"status": "published"}).json()
    c.login(w["p"]["nv_part_kd"])
    assert c.get(f"/api/learn/lessons/{lesson['id']}").json()["practice_count"] == 3   # câu nháp không vào
    r = c.post(f"/api/learn/lessons/{lesson['id']}/practice")
    assert r.status_code == 201, r.text
    a = r.json()
    assert len(a["paper"]) == 3 and "final_score" not in a and a["answers"] == {}
    for secret in ("correct", "explanation", "model_answer", "descriptor", "Vì thẻ nói vậy", "Đáp án mẫu"):
        assert secret not in r.text, secret                      # đề không lộ đáp án
    stored = attempts.find_one()
    assert stored["kind"] == "practice" and stored["assignment_id"] is None
    assert str(stored["lesson_id"]) == lesson["id"] and stored["learner_id"] == w["p"]["nv_part_kd"]["_id"]

    by_q = {p["question_id"]: p for p in a["paper"]}
    single = by_q[qs[0]["id"]]
    right = next(o["key"] for o in single["options"] if o["text"] == "Đúng")
    multi = by_q[qs[1]["id"]]
    wrong_multi = [next(o["key"] for o in multi["options"] if o["text"] == "A đúng")]
    r = c.put(f"/api/learn/attempts/{a['id']}/answers", json={"answers": {qs[0]["id"]: right}})
    assert r.status_code == 200 and r.json()["answers"] == {qs[0]["id"]: right}
    assert c.put(f"/api/learn/attempts/{a['id']}/answers",
                 json={"answers": {qs[0]["id"]: "z"}}).status_code == 400
    r = c.post(f"/api/learn/attempts/{a['id']}/submit",
               json={"answers": {qs[1]["id"]: wrong_multi, qs[2]["id"]: "Bài làm tự luận"}})
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["final_score"] == 1 and res["auto_max"] == 2 and res["finalized_at"]
    sol = {s["question_id"]: s for s in res["solution"]}
    assert sol[qs[0]["id"]]["correct"] == [right] and sol[qs[0]["id"]]["explanation"] == "Vì thẻ nói vậy"
    assert sol[qs[2]["id"]]["model_answer"] == "Đáp án mẫu"
    # đã chốt: không sửa được
    assert c.put(f"/api/learn/attempts/{a['id']}/answers", json={"answers": {}}).status_code == 409
    assert c.post(f"/api/learn/attempts/{a['id']}/submit").status_code == 409
    # làm lại được nhiều lần; lịch sử hiện trong bài học
    assert c.post(f"/api/learn/lessons/{lesson['id']}/practice").status_code == 201
    mine = c.get(f"/api/learn/lessons/{lesson['id']}").json()["my_attempts"]
    assert len(mine) == 2 and mine[1]["final_score"] == 1

    # người khác phòng không xem / sửa được lượt làm; quản lý xem được nhưng không làm thay
    c.login(w["p"]["nv_part_mkt"])
    assert c.put(f"/api/learn/attempts/{a['id']}/answers", json={"answers": {}}).status_code == 404
    assert c.post(f"/api/learn/lessons/{lesson['id']}/practice").status_code == 404
    c.login(w["p"]["tp_part_kd"])
    assert c.post(f"/api/learn/attempts/{mine[0]['id']}/submit").status_code == 403


def test_attempt_view_rule(world):
    """Xem lượt làm theo policy learn.view_result: bản thân + cấp trên; đồng nghiệp / phòng khác không."""
    from app.learn.routes import attempt_viewers_ok
    from app.learn import attempts as att
    p = world["p"]
    a = att.new_attempt(p["nv_part_kd"]["_id"], "practice", [], lesson_id=None)
    assert attempt_viewers_ok(p["nv_part_kd"], a)
    assert attempt_viewers_ok(p["tp_part_kd"], a) and attempt_viewers_ok(p["gd_part"], a)
    assert not attempt_viewers_ok(p["nv_part_mkt"], a) and not attempt_viewers_ok(p["tp_part_mkt"], a)


def test_practice_needs_approved_questions(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    lesson = make_lesson(w, [])
    r = c.post(f"/api/learn/lessons/{lesson['id']}/practice")
    assert r.status_code == 400 and "chưa có câu luyện tập" in r.json()["detail"]


def test_lessons_category_tree_filter_and_counts(world):
    """Thư viện bài học chia cây lĩnh vực như VCWIKI: lĩnh vực của bài = lĩnh vực các thẻ trong bài (gồm nhánh con)."""
    from app import categories as cat_mod
    for slug, parent in (("bh", None), ("bh.chot", "bh"), ("tc", None)):
        cat_mod.categories.insert_one({"slug": slug, "name": slug, "path": [parent] if parent else [],
                                       "level": 2 if parent else 1, "active": True})
    p, c = world["p"], world["client"]
    space = world["space"]
    chot = add_card(space, "Chốt đơn", categories=["bh.chot"])
    tien = add_card(space, "Dòng tiền", categories=["tc"])
    c.login(p["tp_part_kd"])
    for title, card in (("Bài chốt đơn", chot), ("Bài dòng tiền", tien)):
        r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": title, "space_id": str(space["_id"]),
                                               "items": [{"card_id": str(card["_id"])}]})
        assert r.status_code == 201, r.text
    r = c.get("/api/learn/lessons").json()
    assert r["category_counts"] == {"bh.chot": 1, "bh": 1, "tc": 1}
    assert [x["title"] for x in c.get("/api/learn/lessons?category=bh").json()["items"]] == ["Bài chốt đơn"]
    assert [x["title"] for x in c.get("/api/learn/lessons?category=tc").json()["items"]] == ["Bài dòng tiền"]
    only = c.get("/api/learn/lessons?category=bh.chot").json()
    assert only["total"] == 1 and only["category_counts"]["tc"] == 1       # số đếm không bị lọc theo nhánh đang chọn
    # Ngân hàng câu hỏi lọc cùng cây (UI-3 SCR-16): câu hỏi thuộc nhánh = dẫn về thẻ trong nhánh
    make_question(c, SINGLE, [chot])
    make_question(c, SINGLE, [tien])
    qs = lambda cat: c.get(f"/api/learn/questions?category={cat}").json()   # noqa: E731
    assert qs("bh")["total"] == 1 and qs("tc")["total"] == 1 and qs("bh.chot")["total"] == 1
    assert c.get("/api/learn/questions").json()["total"] >= 2
