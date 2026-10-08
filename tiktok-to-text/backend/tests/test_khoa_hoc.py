"""Khoá học theo cây chủ đề — phần dữ liệu TK-15a (BA 17.12 luật 1–2, LRN-15): bài thuộc đúng một khoá, xếp cuối khoá
khi thêm / đổi khoá, đoán khoá từ thẻ, đổi slug / xoá nhánh kéo theo bài."""

from __future__ import annotations

import pytest
from bson import ObjectId

from tests.training_support import training_subject

from app import categories as cat_mod
from app.learn import courses
from app.learn.models import lessons
from tests.test_learn_api import add_card, shared_space


@pytest.fixture
def w(org_sample, client):
    p = org_sample["people"]
    nen = cat_mod._insert("Nền ngành ô tô", "", None, 0, slug="nen")
    kt = cat_mod._insert("Kỹ thuật ô tô", "", nen, 0, slug="nen.ky-thuat")
    cat_mod._insert("Lịch bảo dưỡng", "", kt, 0, slug="nen.ky-thuat.lich")
    cat_mod._insert("Dịch vụ garage", "", nen, 1, slug="nen.garage")
    space = shared_space(p["tp_part_kd"], [(p["nv_part_kd"], "viewer")])
    client.login(p["tp_part_kd"])
    card = add_card(space, "Thay dầu", categories=["nen.ky-thuat.lich"])

    def lesson(title, category=None, **kw):
        body = {"title": title, "space_id": str(space["_id"]), "items": [{"card_id": str(card["_id"])}]} | kw
        if category is not None:
            body["category"] = category
        r = client.post("/api/learn/lessons", json=body | {"subject_id": training_subject(client)})
        assert r.status_code == 201, r.text
        return r.json()
    return {"p": p, "c": client, "space": space, "card": card, "lesson": lesson}


def test_lesson_joins_course_at_end(w):
    a = w["lesson"]("Bài A", "nen.ky-thuat.lich")
    b = w["lesson"]("Bài B", "nen.ky-thuat.lich")
    other = w["lesson"]("Bài C", "nen.garage")
    loose = w["lesson"]("Bài chưa xếp")
    assert (a["category"], a["seq"], b["seq"]) == ("nen.ky-thuat.lich", 10, 20)
    assert (other["seq"], loose["category"]) == (10, None)
    # nút cha là khoá riêng — không cộng bài của nút con (luật 1)
    assert lessons.count_documents({"category": "nen.ky-thuat"}) == 0


def test_course_must_be_live_branch(w):
    r = w["c"].post("/api/learn/lessons", json={"subject_id": training_subject(w["c"]), "title": "X", "space_id": str(w["space"]["_id"]), "category": "khong-co"})
    assert r.status_code == 400 and "khong-co" in r.text
    cat_mod.set_active(cat_mod.categories.find_one({"slug": "nen.garage"}), False)
    r = w["c"].post("/api/learn/lessons", json={"subject_id": training_subject(w["c"]), "title": "X", "space_id": str(w["space"]["_id"]), "category": "nen.garage"})
    assert r.status_code == 400


def test_move_lesson_goes_last_even_when_published(w):
    c = w["c"]
    a = w["lesson"]("Bài A", "nen.garage")
    w["lesson"]("Bài B", "nen.ky-thuat.lich")
    c.patch(f"/api/learn/lessons/{a['id']}", json={"status": "published"})
    r = c.patch(f"/api/learn/lessons/{a['id']}", json={"category": "nen.ky-thuat.lich"})
    assert r.status_code == 200, r.text
    assert (r.json()["category"], r.json()["seq"], r.json()["status"]) == ("nen.ky-thuat.lich", 20, "published")
    # chọn lại khoá đang ở: giữ chỗ
    assert c.patch(f"/api/learn/lessons/{a['id']}", json={"category": "nen.ky-thuat.lich"}).json()["seq"] == 20
    # về Chưa xếp khoá
    assert c.patch(f"/api/learn/lessons/{a['id']}", json={"category": None}).json()["category"] is None
    # nội dung bài đã phát hành vẫn khoá
    assert c.patch(f"/api/learn/lessons/{a['id']}", json={"title": "Đổi", "category": "nen.garage"}).status_code == 409


def test_only_author_moves_lesson(w):
    a = w["lesson"]("Bài A", "nen.garage")
    w["c"].login(w["p"]["nv_part_kd"])
    assert w["c"].patch(f"/api/learn/lessons/{a['id']}", json={"category": "nen.ky-thuat.lich"}).status_code in (403, 404)


def test_draft_patch_with_category(w):
    a = w["lesson"]("Bài A")
    r = w["c"].patch(f"/api/learn/lessons/{a['id']}", json={"title": "Bài A1", "category": "nen.garage"})
    assert (r.json()["title"], r.json()["category"], r.json()["seq"]) == ("Bài A1", "nen.garage", 10)


def test_guess_category(w):
    s = w["space"]
    c1 = add_card(s, "1", categories=["nen.ky-thuat.lich", "nen.garage"])
    c2 = add_card(s, "2", categories=["nen.garage"])
    c3 = add_card(s, "3", categories=["nen.ky-thuat.lich"])
    none = add_card(s, "4", categories=["khong-co-trong-cay"])
    assert courses.guess_category([c1["_id"], c2["_id"]]) == "nen.garage"                 # nhiều nhất
    assert courses.guess_category([c2["_id"], c3["_id"]]) == "nen.garage"                # hoà → thẻ đầu bài
    assert courses.guess_category([c3["_id"], c2["_id"]]) == "nen.ky-thuat.lich"
    lead = add_card(s, "5", categories=["nen.garage", "nen.ky-thuat.lich"])
    assert courses.guess_category([c3["_id"], lead["_id"], c2["_id"]]) == "nen.garage"    # 2–2 → lĩnh vực chính của thẻ
    assert courses.guess_category([]) is None
    assert courses.guess_category([none["_id"]]) is None
    assert courses.guess_category([]) is None


def test_rename_and_delete_branch_carry_lessons(w):
    a = w["lesson"]("Bài A", "nen.ky-thuat.lich")
    g1 = w["lesson"]("Garage 1", "nen.garage")
    g2 = w["lesson"]("Garage 2", "nen.garage")
    cat_mod.rename_slug(cat_mod.categories.find_one({"slug": "nen.ky-thuat"}), "nen.kt")
    assert lessons.find_one({"title": "Bài A"})["category"] == "nen.kt.lich"
    assert cat_mod.usage(["nen.garage"]) == {"bài học": 2}
    with pytest.raises(Exception):
        cat_mod.remove(cat_mod.categories.find_one({"slug": "nen.garage"}))     # còn bài → cần move_to
    cat_mod.remove(cat_mod.categories.find_one({"slug": "nen.garage"}), move_to="nen.kt.lich")
    got = {r["_id"]: (r["category"], r["seq"]) for r in lessons.find({}, {"category": 1, "seq": 1})}
    assert [got[ObjectId(x["id"])] for x in (a, g1, g2)] == [("nen.kt.lich", 10), ("nen.kt.lich", 20), ("nen.kt.lich", 30)]
