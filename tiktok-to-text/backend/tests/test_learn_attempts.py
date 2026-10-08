"""Lõi lượt làm bài (LRN-09 — docs/BA.md mục 17.7, 17.8): ảnh chụp đề, chấm tự động, khoá sau khi chốt."""

from __future__ import annotations

import random

import pytest
from bson import ObjectId

from app.learn import attempts as att
from app.learn.models import attempts


def q_single():
    return {"_id": ObjectId(), "kind": "single", "stem": "Mã lỗi P0300 là gì?", "explanation": "Theo thẻ OBD",
            "options": [{"text": "Bỏ máy ngẫu nhiên", "correct": True}, {"text": "Hỏng bơm xăng", "correct": False},
                        {"text": "Lỗi cảm biến oxy", "correct": False}],
            "card_refs": [{"card_id": ObjectId(), "rev": 1}], "difficulty": 2, "bloom": "remember"}


def q_multi():
    return {"_id": ObjectId(), "kind": "multi", "stem": "Chọn các bước chẩn đoán",
            "options": [{"text": "Đọc mã lỗi", "correct": True}, {"text": "Xoá lỗi ngay", "correct": False},
                        {"text": "Xem dữ liệu đóng băng", "correct": True}], "card_refs": []}


def q_essay():
    return {"_id": ObjectId(), "kind": "essay", "stem": "Tình huống khách báo đèn check", "model_answer": "Mẫu",
            "rubric": [{"criterion": "Hỏi triệu chứng", "max": 2, "descriptor": "Đủ 3 câu hỏi"},
                       {"criterion": "Đề xuất bước", "max": 3, "descriptor": "Đúng thứ tự"}], "card_refs": []}


def key_of(paper_item, text):
    return next(o["key"] for o in paper_item["options"] if o["text"] == text)


def test_build_paper_snapshot_and_shuffle():
    qs = [q_single(), q_multi(), q_essay()]
    paper = att.build_paper(qs, rng=random.Random(1))
    assert {p["question_id"] for p in paper} == {q["_id"] for q in qs}
    single = next(p for p in paper if p["kind"] == "single")
    assert [o["key"] for o in single["options"]] == ["a", "b", "c"]          # key theo thứ tự hiển thị
    assert sum(o["correct"] for o in single["options"]) == 1
    essay = next(p for p in paper if p["kind"] == "essay")
    assert essay["max"] == 5 and essay["options"] == []
    # không xáo -> giữ nguyên thứ tự
    fixed = att.build_paper(qs, shuffle=False)
    assert [p["question_id"] for p in fixed] == [q["_id"] for q in qs]
    assert [o["text"] for o in fixed[0]["options"]] == [o["text"] for o in qs[0]["options"]]
    # xáo thật sự: qua nhiều lần xáo phải gặp thứ tự phương án khác
    orders = {tuple(o["text"] for o in att.build_paper([qs[0]], rng=random.Random(i))[0]["options"])
              for i in range(20)}
    assert len(orders) > 1


def test_public_paper_hides_answers():
    paper = att.build_paper([q_single(), q_multi(), q_essay()])
    pub = att.public_paper(paper)
    text = repr(pub)
    for secret in ("correct", "explanation", "model_answer", "descriptor", "Theo thẻ OBD", "Đủ 3 câu hỏi", "Mẫu"):
        assert secret not in text, secret
    essay = next(p for p in pub if p["kind"] == "essay")
    assert essay["rubric"] == [{"criterion": "Hỏi triệu chứng", "max": 2.0}, {"criterion": "Đề xuất bước", "max": 3.0}]


def test_score_auto_all_or_nothing():
    s, m, e = q_single(), q_multi(), q_essay()
    paper = att.build_paper([s, m, e], shuffle=False)
    ps, pm, pe = paper
    right = {str(s["_id"]): key_of(ps, "Bỏ máy ngẫu nhiên"),
             str(m["_id"]): [key_of(pm, "Đọc mã lỗi"), key_of(pm, "Xem dữ liệu đóng băng")],
             str(e["_id"]): "Trả lời"}
    r = att.score_auto(paper, right)
    assert r["auto_score"] == 2 and r["auto_max"] == 2 and r["essay_max"] == 5 and r["pending"] == 1
    assert [i["score"] for i in r["items"]] == [1, 1, None]
    # nhiều đáp án: thiếu 1 phương án đúng -> 0 điểm; bỏ trống -> 0
    partial = right | {str(m["_id"]): [key_of(pm, "Đọc mã lỗi")]}
    assert att.score_auto(paper, partial)["auto_score"] == 1
    assert att.score_auto(paper, {})["auto_score"] == 0


def test_normalize_answers_rejects_invalid():
    s, e = q_single(), q_essay()
    paper = att.build_paper([s, e], shuffle=False)
    with pytest.raises(att.InvalidAnswer):
        att.normalize_answers(paper, {str(ObjectId()): "a"})
    with pytest.raises(att.InvalidAnswer):
        att.normalize_answers(paper, {str(s["_id"]): "z"})
    with pytest.raises(att.InvalidAnswer):
        att.normalize_answers(paper, {str(e["_id"]): ["a"]})
    assert att.normalize_answers(paper, {str(s["_id"]): "", str(e["_id"]): "  "}) == {}


def test_lifecycle_and_lock_after_finalize():
    learner = ObjectId()
    s = q_single()
    a = att.new_attempt(learner, "practice", att.build_paper([s]), lesson_id=ObjectId())
    assert a["assignment_id"] is None and a["max_score"] == 1 and a["submitted_at"] is None
    with pytest.raises(att.AttemptLocked):
        att.finalize(a, None, 0)                                         # chưa nộp thì chưa chốt
    key = key_of(a["paper"][0], "Bỏ máy ngẫu nhiên")
    a = att.save_answers(a, {str(s["_id"]): key})
    assert a["answers"] == {str(s["_id"]): key}
    a = att.submit(a)
    assert a["auto_score"] == 1 and a["submitted_at"]
    with pytest.raises(att.AttemptLocked):
        att.save_answers(a, {str(s["_id"]): "b"})                        # đã nộp: không sửa câu trả lời
    a = att.finalize(a, None, a["auto_score"])
    assert a["final_score"] == 1 and a["finalized_at"]
    for fn in (lambda: att.save_answers(a, {}), lambda: att.submit(a), lambda: att.finalize(a, None, 0)):
        with pytest.raises(att.AttemptLocked):
            fn()
    # bản ghi cũ trong tay (chưa thấy finalized_at) cũng không ghi đè được — điều kiện nằm trong truy vấn
    stale = a | {"finalized_at": None}
    with pytest.raises(att.AttemptLocked):
        att.finalize(stale, None, 0)
    assert attempts.find_one({"_id": a["_id"]})["final_score"] == 1
    res = att.result(a)
    assert res["solution"][0]["correct"] == [key] and res["solution"][0]["explanation"] == "Theo thẻ OBD"
