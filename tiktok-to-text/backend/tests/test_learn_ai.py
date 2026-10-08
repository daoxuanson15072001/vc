"""Luồng H — AI học tập (docs/BA.md 17.5 LRN-04, 17.6 LRN-02 phần AI). AI luôn là AI giả (mock structured_call)."""

from __future__ import annotations

import pytest
from bson import ObjectId

from tests.training_support import training_subject

from app import categories as cat_mod
from app import db, org
from app.kb.wiki import AINotReady
from app.learn import designer, generate
from app.learn.models import learning_paths, lessons, questions
from app.spaces import personal_space
from tests.test_learn_api import add_card, shared_space

cards = db.db["wiki_cards"]


@pytest.fixture
def no_ai(monkeypatch):
    """AI không chạy được (không key, AI local chết)."""
    def boom(*a, **k):
        raise AINotReady("Chưa cấu hình ANTHROPIC_API_KEY")
    monkeypatch.setattr(generate, "structured_call", boom)


@pytest.fixture
def ai(monkeypatch):
    """AI giả: trả `ai.reply` (dict hoặc hàm (system, text) -> dict), ghi lại prompt đã gửi."""
    state = {"reply": None, "calls": []}

    def fake(system, text, schema, max_tokens=4000, **kw):
        state["calls"].append(text)
        r = state["reply"]
        return (r(system, text) if callable(r) else r) | {"usage": {"model": "gia-lap"}}
    monkeypatch.setattr(generate, "structured_call", fake)
    return state


@pytest.fixture
def world(org_sample, client):
    """Cây lĩnh vực nhỏ: bh (Bán hàng) › bh.chao-hang, bh.tu-choi; mkt. tp_part_kd thiết kế cho nv_part_kd (Key staff).
    Kho phòng: tp chủ, nv xem."""
    p = org_sample["people"]
    bh = cat_mod._insert("Bán hàng", "", None, 0, slug="bh")
    cat_mod._insert("Chào hàng", "", bh, 0, slug="bh.chao-hang", code="4.1.1")
    cat_mod._insert("Xử lý từ chối", "", bh, 1, slug="bh.tu-choi", code="4.1.2")
    cat_mod._insert("Marketing", "", None, 1, slug="mkt")
    org.org_functions.update_one({"code": "sales"}, {"$set": {"category_root": "bh"}})
    space = shared_space(p["tp_part_kd"], [(p["nv_part_kd"], "viewer")])

    def card(title, **kw):
        base = {"categories": ["bh.chao-hang"], "level": "thuc-thi", "division": ["vcpart"], "process_steps": []}
        return add_card(kw.pop("space", space), title, **(base | kw))

    c = {
        "sop_b": card("SOP chào hàng", type="sop", process_steps=["qt.ban-hang-b2b.b"]),
        "vh_a": card("Phân việc chào hàng", level="van-hanh", process_steps=["qt.ban-hang-b2b.a"]),
        "fw": card("Khung chào hàng", type="framework"),
        "concept_b": card("Khái niệm nhu cầu", process_steps=["qt.ban-hang-b2b.b"], current_revision=3),
        "tap_doan": card("Văn hoá chào hỏi", division=["tap-doan"], type="case_study"),
        # bị loại:
        "dieu_hanh": card("Đo hiệu quả chào hàng", level="dieu-hanh"),
        "garage": card("Chào hàng garage", division=["vcservice"]),
        "skill": card("Kỹ năng AI", type="skill"),
        "draft": card("Thẻ nháp", status="draft"),
        "c3": card("Thẻ mật", classification="C3"),
        "unleveled": card("Thẻ chưa gắn bậc", level=None),
        "hidden": card("Thẻ riêng của TP", space=personal_space(p["tp_part_kd"])),
    }
    return {"p": p, "space": space, "c": c, "client": client}


FORM = {"level": 3, "area": "bh", "division": "vcpart", "branches": ["bh"], "goal": "Chào hàng đúng quy trình",
        "hours_per_week": 4, "assessment": "Thi cuối tháng 10 câu", "pass_score": 80}


def ids(*cs):
    return [str(c["_id"]) for c in cs]


def design(w, form=None, learners=True, prompt="Tháng 10 cho nhóm KD mới", status=201, **extra):
    c = w["client"]
    c.login(w["p"]["tp_part_kd"])
    body = {"prompt": prompt, "form": form or FORM,
            "learners": [str(w["p"]["nv_part_kd"]["_id"])] if learners else []} | extra
    r = c.post("/api/learn/paths/design", json=body)
    assert r.status_code == status, r.text
    return r.json()


def all_cards(draft):
    return [x["card_id"] for wk in draft["plan"]["weeks"] for ls in wk["lessons"] for x in ls["cards"]]


# ---------------------------------------------------------------------------
# Chọn + xếp thẻ
# ---------------------------------------------------------------------------

def test_select_filters_and_order(world):
    w, c = world, world["c"]
    sel = designer.select_cards(w["p"]["tp_part_kd"], [w["p"]["nv_part_kd"]],
                                designer.check_form(designer.DesignForm(**FORM)))
    # cấp 3 (Key staff) mảng của mình (bh) → thực thi + vận hành; division vcpart + tap-doan
    # xếp: không gắn bước trước, rồi bước a → b; cùng vị trí: bậc rồi loại (concept → framework → sop → case_study)
    assert [x["title"] for x in sel["cards"]] == [
        "Khung chào hàng", "Văn hoá chào hỏi", "Phân việc chào hàng", "Khái niệm nhu cầu", "SOP chào hàng"]
    got = {x["_id"] for x in sel["cards"]}
    for bad in ("dieu_hanh", "garage", "skill", "draft", "c3", "unleveled", "hidden"):
        assert c[bad]["_id"] not in got, bad
    assert any("chưa gắn bậc" in n for n in sel["notes"])
    assert any("người học không xem được" in n for n in sel["notes"])
    assert sel["levels_source"].startswith("bảng ánh xạ cấp 3")


def test_select_include_unleveled_and_designer_levels(world):
    w = world
    form = designer.DesignForm(**(FORM | {"include_unleveled": True, "content_levels": ["dieu-hanh"]}))
    sel = designer.select_cards(w["p"]["tp_part_kd"], [w["p"]["nv_part_kd"]], designer.check_form(form))
    assert {x["title"] for x in sel["cards"]} == {"Đo hiệu quả chào hàng", "Thẻ chưa gắn bậc"}


def test_levels_from_learner_profile(world):
    """Không chọn cấp trong form → lấy cấp bậc người học qua policy.content_levels_for (mảng = category_root)."""
    w = world
    db.db["users"].update_one({"_id": w["p"]["nv_part_kd"]["_id"]}, {"$set": {"org.level": 2}})
    nv = db.db["users"].find_one({"_id": w["p"]["nv_part_kd"]["_id"]})
    form = designer.DesignForm(division="vcpart", branches=["bh"])
    sel = designer.select_cards(w["p"]["tp_part_kd"], [nv], designer.check_form(form))
    assert {x["level"] for x in sel["cards"]} == {"thuc-thi"}          # cấp 2 own = thực thi
    assert "policy.content_levels_for" in sel["levels_source"]


def test_gaps_by_node_and_level(world):
    w = world
    sel = designer.select_cards(w["p"]["tp_part_kd"], [], designer.check_form(designer.DesignForm(**FORM)))
    gaps = [(g["node"], g["level"]) for g in sel["gaps"]]
    assert gaps == [("bh.tu-choi", "thuc-thi"), ("bh.tu-choi", "van-hanh")]
    assert sel["gaps"][0]["topic"] == "4.1.2 Xử lý từ chối" and "Thực thi" in sel["gaps"][0]["reason"]
    # chuỗi quy trình: thiếu bước c, d
    form = designer.DesignForm(**(FORM | {"branches": ["qt.ban-hang-b2b"], "content_levels": ["thuc-thi"]}))
    sel = designer.select_cards(w["p"]["tp_part_kd"], [], designer.check_form(form))
    assert [(g["node"], g["level"]) for g in sel["gaps"]] == [
        ("qt.ban-hang-b2b.a", "thuc-thi"), ("qt.ban-hang-b2b.c", "thuc-thi"), ("qt.ban-hang-b2b.d", "thuc-thi")]


def test_form_validation(world):
    design(world, FORM | {"branches": ["khong-co"]}, status=400)
    design(world, FORM | {"division": "abc"}, status=400)


# ---------------------------------------------------------------------------
# AI dựng nháp
# ---------------------------------------------------------------------------

def test_design_with_ai_drops_unknown_ids(world, ai):
    w, c = world, world["c"]
    ai["reply"] = {"title": "Chào hàng tháng 10", "weeks": [
        {"week": 1, "lessons": [{"title": "Nền tảng", "objectives": ["Hiểu khung"], "cards": ["k1", "k2", "k99"],
                                 "narrative": "Nối thẻ", "practice": ["Câu hỏi khung"]}]},
        {"week": 2, "lessons": [{"title": "Bịa", "objectives": [], "cards": [str(ObjectId()), str(c["hidden"]["_id"])],
                                 "narrative": "", "practice": []},
                                {"title": "Thực hành", "objectives": [], "cards": ["K4", str(c["sop_b"]["_id"])],
                                 "narrative": "", "practice": []}]},
        {"week": 9, "lessons": [{"title": "Tuần lạ", "objectives": [], "cards": ["k3"], "narrative": "",
                                 "practice": []}]}],
        "exam": {"blueprint": "10 câu", "duration_min": 30, "pass_score": 80},
        "gaps": [{"topic": "Đàm phán giá", "reason": "không có thẻ"}]}
    d = design(w)
    assert d["status"] == "draft" and d["engine"] == "gia-lap" and not d["no_ai"]
    assert d["title"] == "Chào hàng tháng 10"
    # chỉ thẻ trong danh sách ứng viên: k99, id bịa, thẻ người học không xem được bị bỏ; bài rỗng bị bỏ
    assert all_cards(d) == ids(c["fw"], c["tap_doan"], c["concept_b"], c["sop_b"], c["vh_a"])
    assert len(d["dropped_ids"]) == 3
    weeks = {wk["week"]: [ls["title"] for ls in wk["lessons"]] for wk in d["plan"]["weeks"]}
    assert weeks == {1: ["Nền tảng"], 2: ["Thực hành"], 3: [], 4: ["Tuần lạ"]}       # tuần 9 dồn về tuần 4
    revs = {x["card_id"]: x["rev"] for wk in d["plan"]["weeks"] for ls in wk["lessons"] for x in ls["cards"]}
    assert revs[str(c["concept_b"]["_id"])] == 3
    assert [g["source"] for g in d["gaps"]] == ["code", "code", "ai"]
    # prompt gửi AI: form ghép + prompt tự do + thẻ rút gọn có mã, không có thẻ bị loại
    sent = ai["calls"][0]
    assert "Mục tiêu sau kỳ: Chào hàng đúng quy trình" in sent and "Tháng 10 cho nhóm KD mới" in sent
    assert "k1 | thuc-thi | framework" in sent and "Thẻ riêng của TP" not in sent and "Kỹ năng AI" not in sent
    saved = learning_paths.find_one({"_id": ObjectId(d["id"])})
    assert saved["ai"]["prompt"].endswith("Tháng 10 cho nhóm KD mới") and saved["ai"]["original"]["weeks"]
    assert saved["owner_id"] == w["p"]["tp_part_kd"]["_id"] and saved["period"] == "month"


def test_design_without_ai_builds_code_draft(world, no_ai):
    w = world
    d = design(w, learners=False)
    assert d["no_ai"] and d["engine"] == "code" and "ANTHROPIC_API_KEY" in d["no_ai_reason"]
    assert len(all_cards(d)) == 6 and d["plan"]["exam"]["pass_score"] == 80
    assert len(d["plan"]["weeks"]) == 4


def test_design_permissions(world, no_ai):
    w, cl = world, world["client"]
    cl.login(w["p"]["nv_part_kd"])          # không có người dưới quyền
    assert cl.post("/api/learn/paths/design", json={"form": FORM}).status_code == 403
    cl.login(w["p"]["tp_part_kd"])          # người học ngoài cây dưới quyền
    r = cl.post("/api/learn/paths/design", json={"form": FORM, "learners": [str(w["p"]["nv_part_mkt"]["_id"])]})
    assert r.status_code == 400
    d = design(w)
    cl.login(w["p"]["gd_part"])             # người khác không xem / sửa bản nháp
    assert cl.get(f"/api/learn/paths/{d['id']}/design").status_code == 404


# ---------------------------------------------------------------------------
# Sửa + lưu nháp
# ---------------------------------------------------------------------------

def test_save_plan_materializes_lessons(world, no_ai):
    w, c, cl = world, world["c"], world["client"]
    d = design(w)
    body = {"title": "Lộ trình đã sửa", "space_id": str(w["space"]["_id"]),
            "exam": {"blueprint": "20 câu", "duration_min": 40, "pass_score": 75},
            "weeks": [{"week": 1, "lessons": [{"title": "Bài 1", "objectives": ["A"], "practice": ["Gợi ý 1"],
                                               "cards": [{"card_id": str(c["concept_b"]["_id"])},
                                                         {"card_id": str(c["fw"]["_id"])}]}]},
                      {"week": 2, "lessons": []}]}
    r = cl.put(f"/api/learn/paths/{d['id']}/design", json=body)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["title"] == "Lộ trình đã sửa" and len(out["lesson_ids"]) == 1
    assert [m["week"] for m in out["modules"]] == [1]
    les = lessons.find_one({"_id": ObjectId(out["lesson_ids"][0])})
    assert les["status"] == "draft" and les["space_id"] == w["space"]["_id"]
    assert [(i["card_id"], i["rev"]) for i in les["items"]] == [(c["concept_b"]["_id"], 3), (c["fw"]["_id"], 1)]
    assert "Gợi ý 1" in les["narrative"]
    assert cl.get("/api/learn/lessons").status_code == 200          # thư viện bài học (luồng E) đọc được bài nháp
    path = learning_paths.find_one({"_id": ObjectId(d["id"])})
    assert path["exam"]["pass_score"] == 75 and path["modules"][0]["lesson_ids"] == [les["_id"]]
    # lưu lại: bài nháp cũ được thay
    cl.put(f"/api/learn/paths/{d['id']}/design", json=body)
    assert lessons.count_documents({}) == 1
    # thẻ người học không xem được / thẻ C3 → 400
    for bad in ("hidden", "c3"):
        body["weeks"][0]["lessons"][0]["cards"] = [{"card_id": str(c[bad]["_id"])}]
        assert cl.put(f"/api/learn/paths/{d['id']}/design", json=body).status_code == 400
    # đã phát hành (luồng I) → 409
    learning_paths.update_one({"_id": ObjectId(d["id"])}, {"$set": {"status": "published"}})
    body["weeks"][0]["lessons"][0]["cards"] = [{"card_id": str(c["fw"]["_id"])}]
    assert cl.put(f"/api/learn/paths/{d['id']}/design", json=body).status_code == 409


# ---------------------------------------------------------------------------
# Sinh câu hỏi theo loại thẻ (17.6)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("card_type,kinds", [
    ("sop", ["multi", "multi", "essay"]), ("checklist", ["multi", "multi", "multi"]),
    ("template", ["essay"] * 3), ("kpi", ["single"] * 3), ("framework", ["single", "multi", "single"]),
    ("concept", ["single", "multi", "single"]), ("case_study", ["essay"] * 3), ("lesson", ["essay"] * 3),
    ("insight", ["essay"] * 3), ("regulation", ["single"] * 3)])
def test_kinds_by_card_type(card_type, kinds):
    assert generate.kinds_for(card_type, 3) == kinds


def good(kind):
    if kind == "essay":
        return {"kind": "essay", "stem": "Tình huống?", "options": [], "model_answer": "Mẫu", "explanation": "",
                "rubric": [{"criterion": "Đủ ý", "max": 5, "descriptor": "3 ý"}], "difficulty": 3, "bloom": "apply"}
    return {"kind": kind, "stem": f"Câu {kind}?", "rubric": [], "model_answer": "", "explanation": "Vì thẻ",
            "options": [{"text": "Đúng", "correct": True}, {"text": "Sai", "correct": False}], "difficulty": 9,
            "bloom": "remember"}


def test_generate_questions_for_card(world, ai):
    w, c, cl = world, world["c"], world["client"]
    bad_single = good("single") | {"options": [{"text": "A", "correct": True}, {"text": "B", "correct": True}]}
    ai["reply"] = {"questions": [good("multi"), good("single") | {"kind": "essay"}, bad_single]}
    cl.login(w["p"]["tp_part_kd"])
    r = cl.post("/api/learn/generate/questions", json={"card_id": str(c["sop_b"]["_id"]), "n": 3})
    assert r.status_code == 201, r.text
    out = r.json()
    # sop → multi, multi, essay; câu 2 AI trả sai kind → ép multi (hợp lệ); câu 3 ép essay nhưng không có rubric → bỏ
    assert out["created"] == 2 and out["skipped"] == 1
    assert [q["kind"] for q in out["items"]] == ["multi", "multi"]
    q = questions.find_one({"_id": ObjectId(out["items"][0]["id"])})
    assert q["status"] == "draft" and q["origin"] == "ai" and q["difficulty"] == 5
    assert q["card_refs"] == [{"card_id": c["sop_b"]["_id"], "rev": 1}] and q["space_id"] == w["space"]["_id"]
    assert "kind lần lượt: multi, multi, essay" in ai["calls"][0] and "SOP chào hàng" in ai["calls"][0]


def test_generate_rejects(world, no_ai):
    w, c, cl = world, world["c"], world["client"]
    cl.login(w["p"]["tp_part_kd"])
    post = lambda card: cl.post("/api/learn/generate/questions", json={"card_id": str(card["_id"])})  # noqa: E731
    r = post(c["fw"])
    assert r.status_code == 503 and "AI chưa sẵn sàng" in r.json()["detail"]
    assert post(c["skill"]).status_code == 400          # loại thẻ không có trong bảng 17.6
    assert post(c["draft"]).status_code == 400          # chưa duyệt
    cl.login(w["p"]["nv_part_kd"])
    assert post(c["fw"]).status_code == 403             # không phải người soạn


def test_draft_questions_for_card_function(world, ai):
    """Hàm cho luồng F gọi khi duyệt thẻ bậc thực thi / vận hành: ≥ 2 câu nháp gắn card_id + phiên bản."""
    w, c = world, world["c"]
    ai["reply"] = lambda s, t: {"questions": [good("essay"), good("essay")]}
    made = generate.draft_questions_for_card(c["tap_doan"], 2, w["p"]["tp_part_kd"])
    assert len(made) == 2 and all(q["card_refs"] == [{"card_id": c["tap_doan"]["_id"], "rev": 2}] for q in made)
    assert {q["kind"] for q in made} == {"essay"}


def test_clean_question_uses_bank_validators():
    """Câu AI trả phải qua đúng kiểm tra của ngân hàng câu hỏi (QuestionIn + validate_question)."""
    assert generate.clean_question(good("single"), "single")["difficulty"] == 5
    assert generate.clean_question(good("single") | {"stem": "   "}, "single") is None          # đề trống
    one_opt = good("multi") | {"options": [{"text": "A", "correct": True}, {"text": "  ", "correct": False}]}
    assert generate.clean_question(one_opt, "multi") is None                                      # còn 1 phương án
    no_max = good("essay") | {"rubric": [{"criterion": "Đủ ý", "max": 0, "descriptor": ""}]}
    assert generate.clean_question(no_max, "essay") is None                                       # tổng điểm 0


def test_design_save_keeps_path_blueprint_rows():
    """Nháp của H lưu mô tả đề ở blueprint_note, blueprint là danh sách; lưu lại ở màn thiết kế không đè ma trận
    luồng I đã điền (BA mục 7)."""
    from app.learn.designer import stored_exam
    first = stored_exam({"blueprint": "20 câu trắc nghiệm + 2 tự luận", "duration_min": 40, "pass_score": 80})
    assert first["blueprint"] == [] and first["blueprint_note"].startswith("20 câu") and first["attempts"] == 1
    rows = [{"category": "bh", "difficulty": 2, "kind": "single", "count": 5}]
    cur = first | {"blueprint": rows, "attempts": 2, "scope": "bank"}
    again = stored_exam({"blueprint": "sửa mô tả", "duration_min": 30, "pass_score": 70}, cur)
    assert again["blueprint"] == rows and again["attempts"] == 2 and again["scope"] == "bank"
    assert again["blueprint_note"] == "sửa mô tả" and again["duration_min"] == 30


# ---------------------------------------------------------------------------
# Sửa lỗi QA vòng 2 (chuỗi Học tập)
# ---------------------------------------------------------------------------

def test_qa2_l1_c3_card_never_sent_to_ai(world, ai):
    """L1: thẻ C3 — web, MCP và hàm cho luồng F đều chặn TRƯỚC khi gọi AI (BA 15.5 quy tắc 3)."""
    from types import SimpleNamespace

    from fastapi import HTTPException
    from mcp.server.mcpserver.exceptions import ToolError

    from app import auth, mcp_server
    w, cl = world, world["client"]
    secret = add_card(w["space"], "Bảng giá mật", type="kpi", classification="C3")
    ai["reply"] = {"questions": [good("single")]}
    cl.login(w["p"]["tp_part_kd"])
    r = cl.post("/api/learn/generate/questions", json={"card_id": str(secret["_id"]), "n": 1})
    assert r.status_code == 403 and "C3" in r.json()["detail"]
    token, _ = auth.issue_api_token(w["p"]["tp_part_kd"], "test")
    ctx = SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "claude-code/test"})
    with pytest.raises(ToolError, match="C3"):
        mcp_server.generate_questions(ctx, str(secret["_id"]), 1)
    with pytest.raises(HTTPException) as e:
        generate.draft_questions_for_card(secret, 1, w["p"]["tp_part_kd"])
    assert e.value.status_code == 403
    assert ai["calls"] == [] and questions.count_documents({}) == 0
    # thẻ thường vẫn sinh được
    assert cl.post("/api/learn/generate/questions", json={"card_id": str(world["c"]["fw"]["_id"]), "n": 1}
                   ).status_code == 201


def test_qa2_l12_card_turns_c3_after_draft(world, no_ai):
    """L12: thẻ đổi sang C3 sau khi dựng nháp → nháp đánh dấu không dùng được + lý do; lưu báo tên thẻ; nút AI ẩn."""
    w, c, cl = world, world["c"], world["client"]
    d = design(w)
    fw = next(x for wk in d["plan"]["weeks"] for ls in wk["lessons"] for x in ls["cards"]
              if x["card_id"] == str(c["fw"]["_id"]))
    assert fw["unavailable"] is False and fw["c3"] is False
    cards.update_one({"_id": c["fw"]["_id"]}, {"$set": {"classification": "C3"}})
    got = cl.get(f"/api/learn/paths/{d['id']}/design").json()
    fw = next(x for wk in got["plan"]["weeks"] for ls in wk["lessons"] for x in ls["cards"]
              if x["card_id"] == str(c["fw"]["_id"]))
    assert fw["unavailable"] and fw["unavailable_reason"] == "mật C3" and fw["c3"]
    body = {"title": "X", "weeks": [{"week": 1, "lessons": [{"title": "B", "cards": [{"card_id": str(c["fw"]["_id"])}]}]}]}
    r = cl.put(f"/api/learn/paths/{d['id']}/design", json=body)
    assert r.status_code == 400 and "“Khung chào hàng” (mật C3)" in r.json()["detail"]


def test_qa2_l2_design_save_keeps_paths_edits(world, no_ai):
    """L2: sửa ở màn Lộ trình (tuần thêm tay, hạn tuần, thời gian / điểm đạt, mục bắt buộc, câu luyện tập gắn vào
    bài nháp) rồi Lưu nháp lại ở màn thiết kế → không mất; bài nháp cập nhật tại chỗ; ghi đè chỉ khi chọn rõ."""
    w, c, cl = world, world["c"], world["client"]
    d = design(w)
    body = {"title": "Tháng 10", "space_id": str(w["space"]["_id"]),
            "exam": {"blueprint": "10 câu trắc nghiệm", "duration_min": 45, "pass_score": 70},
            "weeks": [{"week": 1, "lessons": [{"title": "Bài AI", "cards": [{"card_id": str(c["fw"]["_id"])}]}]}]}
    out = cl.put(f"/api/learn/paths/{d['id']}/design", json=body).json()
    ai_lesson = out["lesson_ids"][0]
    assert out["edited_in_paths_at"] is None and out["notices"] == []
    # câu luyện tập gắn vào bài nháp ở Thư viện
    lessons.update_one({"_id": ObjectId(ai_lesson)}, {"$set": {"practice_question_ids": [ObjectId()]}})
    # bài thêm tay (đã phát hành trong thư viện)
    r = cl.post("/api/learn/lessons", json={"subject_id": training_subject(cl), "title": "Bài thêm tay", "space_id": str(w["space"]["_id"]),
                                             "items": [{"card_id": str(c["sop_b"]["_id"])}]})
    manual = cl.patch(f"/api/learn/lessons/{r.json()['id']}", json={"status": "published"}).json()["id"]
    due = "2026-10-10T16:59:00+00:00"
    r = cl.patch(f"/api/learn/paths/{d['id']}", json={
        "modules": [{"week": 1, "title": "Mở đầu", "lesson_ids": [ai_lesson], "due_at": due},
                    {"week": 5, "lesson_ids": [manual]}],
        "required_items": [ai_lesson, manual],
        "exam": {"blueprint": [{"kind": "single", "count": 1}], "duration_min": 20, "pass_score": 50}})
    assert r.status_code == 200, r.text
    assert r.json()["exam"]["blueprint_note"] == "10 câu trắc nghiệm"       # L8: không mất mô tả đề của AI
    # màn thiết kế mở lại: thấy cảnh báo + thời gian / điểm đạt đang có ở lộ trình
    got = cl.get(f"/api/learn/paths/{d['id']}/design").json()
    assert got["edited_in_paths_at"] and got["manual_lesson_count"] == 1
    assert got["plan"]["exam"]["duration_min"] == 20 and got["plan"]["exam"]["pass_score"] == 50
    assert got["plan"]["weeks"][0]["lessons"][0]["lesson_id"] == ai_lesson
    # Lưu nháp lại (FE gửi lesson_id + exam đang hiện) → giữ mọi phần sửa ở màn Lộ trình
    body["exam"] = got["plan"]["exam"]
    body["weeks"][0]["lessons"][0] |= {"lesson_id": ai_lesson, "title": "Bài AI đã sửa"}
    out = cl.put(f"/api/learn/paths/{d['id']}/design", json=body).json()
    assert out["lesson_ids"] == [ai_lesson] and any("Giữ 1 bài" in n for n in out["notices"])
    p = learning_paths.find_one({"_id": ObjectId(d["id"])})
    assert [(m["week"], m["title"], [str(i) for i in m["lesson_ids"]]) for m in p["modules"]] == [
        (1, "Mở đầu", [ai_lesson]), (5, "", [manual])]
    assert p["modules"][0]["due_at"] is not None
    assert [str(i) for i in p["required_items"]] == [ai_lesson, manual]
    assert (p["exam"]["duration_min"], p["exam"]["pass_score"], p["exam"]["blueprint"]) == (
        20, 50, [{"category": None, "difficulty": None, "kind": "single", "count": 1}])
    les = lessons.find_one({"_id": ObjectId(ai_lesson)})
    assert les["title"] == "Bài AI đã sửa" and len(les["practice_question_ids"]) == 1     # tại chỗ, giữ câu
    # bỏ bài AI (thay bằng bài mới) → mục bắt buộc trỏ bài không còn bị bỏ kèm thông báo
    body["weeks"][0]["lessons"] = [{"title": "Bài mới", "cards": [{"card_id": str(c["concept_b"]["_id"])}]}]
    out = cl.put(f"/api/learn/paths/{d['id']}/design", json=body).json()
    assert any("Bỏ khỏi mục bắt buộc" in n and "Bài AI đã sửa" in n for n in out["notices"])
    assert lessons.find_one({"_id": ObjectId(ai_lesson)}) is None
    p = learning_paths.find_one({"_id": ObjectId(d["id"])})
    assert [str(i) for i in p["required_items"]] == [manual]
    # ghi đè rõ ràng → bỏ tuần / bài thêm tay + hạn tuần, xoá cờ đã sửa; phát hành không vướng mục bắt buộc
    out = cl.put(f"/api/learn/paths/{d['id']}/design", json=body | {"overwrite": True}).json()
    assert any("ghi đè" in n for n in out["notices"]) and out["edited_in_paths_at"] is None
    p = learning_paths.find_one({"_id": ObjectId(d["id"])})
    assert [m["week"] for m in p["modules"]] == [1] and p["modules"][0]["due_at"] is None
    assert p["required_items"] == []
    assert cl.patch(f"/api/learn/paths/{d['id']}", json={"exam": None}).status_code == 200    # chưa có ngân hàng câu
    r = cl.post(f"/api/learn/paths/{d['id']}/publish")
    assert r.status_code == 200, r.text


def test_qa2_l13_mcp_design_path_error_in_vietnamese():
    from pydantic import ValidationError

    from app.mcp_server import _design_error
    with pytest.raises(ValidationError) as e:
        designer.DesignForm(level=9, pass_score=120)
    msg = _design_error(e.value)
    assert "level (cấp bậc người học): phải từ 1 đến 7" in msg and "pass_score (điểm đạt %)" in msg
    assert "pydantic" not in msg and "Input should" not in msg
