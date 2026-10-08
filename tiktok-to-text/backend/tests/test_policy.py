"""Luật quyền (docs/BA.md mục 15.6). Đợt 0: khoá hành vi hiện tại của quyền theo kho + luật cây quản lý.
Luồng B, F, G sửa luật thì sửa / thêm ca ở đây trong cùng merge request."""

from __future__ import annotations

from datetime import timedelta

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app import db, org, policy
from app.spaces import personal_space, spaces
from tests.conftest import grant, make_user, set_org


def shared_space(owner: dict, members: dict[str, dict] | None = None, visibility: str = "private") -> dict:
    doc = {"name": "Kho chung", "description": "", "type": "shared", "owner_id": owner["_id"],
           "visibility": visibility, "created_at": db.now(),
           "members": [{"user_id": owner["_id"], "role": "owner"},
                       *({"user_id": u["_id"], "role": r} for r, u in (members or {}).items())]}
    doc["_id"] = spaces.insert_one(doc).inserted_id
    return doc


# ---------------------------------------------------------------------------
# Quyền theo kho — phải giữ nguyên hành vi cũ (ORG-10)
# ---------------------------------------------------------------------------

def test_personal_space_only_owner():
    a, b = make_user("a"), make_user("b")
    card = {"space_id": personal_space(a)["_id"]}
    assert policy.can(a, "card.write", card)
    assert not policy.can(b, "card.read", card)
    with pytest.raises(HTTPException) as e:
        policy.require(b, "card.write", card, "thẻ")
    assert e.value.status_code == 404          # không lộ sự tồn tại


def test_shared_space_roles():
    owner, ed, viewer, stranger = (make_user(n) for n in ("owner", "ed", "viewer", "stranger"))
    s = shared_space(owner, {"editor": ed})
    spaces.update_one({"_id": s["_id"]}, {"$push": {"members": {"user_id": viewer["_id"], "role": "viewer"}}})
    s = spaces.find_one({"_id": s["_id"]})
    item = {"space_id": s["_id"]}
    assert policy.can(ed, "source.write", item) and not policy.can(ed, "space.manage", s)
    assert policy.can(viewer, "card.read", item) and not policy.can(viewer, "card.write", item)
    with pytest.raises(HTTPException) as e:
        policy.require(viewer, "card.write", item)
    assert e.value.status_code == 403          # xem được nhưng không đủ quyền
    assert policy.can(owner, "space.manage", s)
    assert not policy.can(stranger, "space.read", s)


def test_note_rules():
    """WK-45: xem được nguồn thì đọc + thêm ghi chép; sửa / xoá: tác giả hoặc chủ kho; người ngoài kho 404."""
    owner, ed, viewer, stranger = (make_user(n) for n in ("owner", "ed", "viewer", "stranger"))
    s = shared_space(owner, {"editor": ed, "viewer": viewer})
    item = {"space_id": s["_id"]}
    assert all(policy.can(u, "note.create", item) for u in (owner, ed, viewer))
    assert not policy.can(stranger, "note.read", item)
    mine = {"space_id": s["_id"], "created_by": viewer["_id"]}
    assert policy.can(viewer, "note.edit", mine)                 # tác giả sửa được ghi chép của mình
    assert not policy.can(ed, "note.edit", mine)                 # editor không sửa ghi chép của người khác
    assert policy.can(owner, "note.edit", mine)                  # chủ kho quản lý mọi ghi chép
    with pytest.raises(HTTPException) as e:
        policy.require(ed, "note.edit", mine)
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        policy.require(stranger, "note.edit", {"space_id": s["_id"], "created_by": stranger["_id"]})
    assert e.value.status_code == 404                            # rời kho: không còn thấy cả ghi chép của mình


def test_org_visible_space_is_viewer_for_everyone():
    owner, other = make_user("owner"), make_user("other")
    s = shared_space(owner, visibility="org")
    assert policy.can(other, "card.read", {"space_id": s["_id"]})
    assert not policy.can(other, "card.write", {"space_id": s["_id"]})


def test_visible_filter_matches_readable_spaces():
    a, b = make_user("a"), make_user("b")
    pa, pb = personal_space(a), personal_space(b)
    public = shared_space(b, visibility="org")
    ids = set(policy.visible_filter(a)["space_id"]["$in"])
    assert pa["_id"] in ids and public["_id"] in ids and pb["_id"] not in ids


def test_visible_to_all_is_intersection():
    a, b = make_user("a"), make_user("b")
    s = shared_space(a, {"viewer": b})
    common = set(policy.visible_to_all([a, b])["space_id"]["$in"])
    assert common == {s["_id"]}                # kho cá nhân của từng người bị loại


def test_unknown_action_rejected():
    with pytest.raises(ValueError):
        policy.can(make_user("a"), "card.fly", {})


# ---------------------------------------------------------------------------
# Quản trị
# ---------------------------------------------------------------------------

def test_org_manage_admin_only_and_audit(org_sample):
    admin = make_user("admin", role="admin")
    p = org_sample["people"]
    assert policy.can(admin, "org.manage") and not policy.can(p["tgd"], "org.manage")
    assert not policy.can(p["tp_part_kd"], "audit.read")
    grant(p["tp_part_kd"], "auditor")
    assert policy.can(p["tp_part_kd"], "audit.read")


# ---------------------------------------------------------------------------
# Cây quản lý — học tập
# ---------------------------------------------------------------------------

def test_subordinates_all_levels_and_direct(org_sample):
    p = org_sample["people"]
    ids = set(policy.subordinates(p["gd_garage"]))
    assert ids == {p["tp_garage_kt"]["_id"], p["ks_garage_kt"]["_id"], p["tts_garage_kt"]["_id"]}
    assert set(policy.subordinates(p["gd_garage"], direct_only=True)) == {p["tp_garage_kt"]["_id"]}
    assert policy.subordinates(p["tts_garage_kt"]) == []


def test_assign_only_within_own_tree(org_sample):
    p = org_sample["people"]
    tp = p["tp_part_mkt"]
    assert policy.can(tp, "learn.assign", {"learner_id": p["nv_part_mkt"]["_id"]})
    assert not policy.can(tp, "learn.assign", {"learner_id": p["nv_part_kd"]["_id"]})       # phòng khác
    assert not policy.can(p["tp_part_kd"], "learn.assign", {"learner_id": p["gd_part"]["_id"]})  # cấp trên


def test_functional_manager_can_assign(org_sample):
    p = org_sample["people"]
    learners = set(policy.assignable_learners(p["gd_mkt"]))
    assert learners == {p["tp_part_mkt"]["_id"], p["nv_part_mkt"]["_id"]}


def test_lnd_scope(org_sample):
    p = org_sample["people"]
    lnd = p["hr_lnd"]
    assert policy.can(lnd, "learn.assign", {"learner_id": p["tts_garage_kt"]["_id"]})   # trong VCGARAGE
    assert not policy.can(lnd, "learn.assign", {"learner_id": p["nv_part_kd"]["_id"]})  # ngoài phạm vi
    assert policy.can(lnd, "learn.report") and policy.can(lnd, "learn.author")


def test_result_viewers(org_sample):
    p = org_sample["people"]
    viewers = policy.result_viewers(p["tts_garage_kt"]["_id"])
    expected = {"tts_garage_kt", "ks_garage_kt", "tp_garage_kt", "gd_garage", "tgd", "hr_lnd"}
    assert viewers == {p[n]["_id"] for n in expected}
    assert not policy.can(p["tp_part_kd"], "learn.view_result", {"learner_id": p["tts_garage_kt"]["_id"]})
    # người giao lộ trình (quản lý chuyên môn) xem được bài của lộ trình mình giao
    assert policy.can(p["gd_mkt"], "learn.view_result",
                      {"learner_id": p["nv_part_kd"]["_id"], "assigned_by": p["gd_mkt"]["_id"]})


def test_grade_direct_manager_or_assigner(org_sample):
    p = org_sample["people"]
    learner = {"learner_id": p["tts_garage_kt"]["_id"]}
    assert policy.can(p["ks_garage_kt"], "learn.grade", learner)
    assert not policy.can(p["tp_garage_kt"], "learn.grade", learner)
    assert policy.can(p["tp_garage_kt"], "learn.grade", learner | {"assigned_by": p["tp_garage_kt"]["_id"]})


def test_learn_author(org_sample):
    p = org_sample["people"]
    assert policy.can(p["tp_part_kd"], "learn.author")          # có người dưới quyền
    assert not policy.can(p["nv_part_kd"], "learn.author")
    grant(p["nv_part_kd"], "editor")
    assert policy.can(p["nv_part_kd"], "learn.author")


def test_learn_course_arrange(org_sample):
    """Sắp thứ tự mặc định / đặt thi khoá (BA 17.12 luật 2): chủ nhánh của nút hoặc nút cha, L&D; chuỗi nhánh
    chưa ai làm chủ → quản trị viên."""
    from app import auth
    from app import categories as cat_mod
    p = org_sample["people"]
    nen = cat_mod._insert("Nền", "", None, 0, slug="nen", owner_id=p["gd_garage"]["_id"])
    cat_mod._insert("Lịch", "", nen, 0, slug="nen.lich")
    cat_mod._insert("Tự do", "", None, 1, slug="tu-do")
    res = {"category": "nen.lich"}
    assert policy.can(p["gd_garage"], "learn.course.arrange", res)          # chủ nút cha
    assert not policy.can(p["tp_part_kd"], "learn.course.arrange", res)     # người soạn thường
    assert policy.can(p["hr_lnd"], "learn.course.arrange", res)             # L&D
    admin = auth.create_user("qt@test.local", "qt", "mat-khau-test", "admin")
    assert not policy.can(admin, "learn.course.arrange", res)               # nhánh đã có chủ
    assert policy.can(admin, "learn.course.arrange", {"category": "tu-do"})
    assert not policy.can(p["gd_garage"], "learn.course.arrange", {"category": "tu-do"})


def test_manager_cycle_does_not_hang():
    a, b = make_user("a"), make_user("b")
    set_org(a, [], manager=b)
    set_org(b, [], manager=a)
    assert set(org.subordinate_ids(a["_id"])) == {b["_id"]}
    assert org.manager_chain(a["_id"]) == [b["_id"]]


def test_expired_grant_ignored(org_sample):
    p = org_sample["people"]
    past = db.now() - timedelta(days=2)
    grant(p["nv_part_kd"], "auditor", valid_from=past, valid_to=past + timedelta(days=1))
    assert not policy.can(p["nv_part_kd"], "audit.read")
    grant(p["nv_part_kd"], "auditor", valid_from=past, valid_to=db.now() + timedelta(days=1))
    assert policy.can(p["nv_part_kd"], "audit.read")


# ---------------------------------------------------------------------------
# Mức mật
# ---------------------------------------------------------------------------

def test_inherit_classification_takes_highest():
    assert policy.inherit_classification([{"classification": "C0"}, {"classification": "C2"}]) == "C2"
    assert policy.inherit_classification([{"classification": "C0"}, {}]) == "C1"   # thiếu trường = C1
    assert policy.inherit_classification([]) == "C0"


# ---------------------------------------------------------------------------
# ORG-10 — hàm tiện ích thêm ở luồng B (giữ câu thông báo cũ)
# ---------------------------------------------------------------------------

def test_space_role_members_org_and_none():
    owner, ed, other = make_user("owner"), make_user("ed"), make_user("other")
    s = shared_space(owner, {"editor": ed})
    assert policy.space_role(owner, s) == "owner" and policy.space_role(ed, s) == "editor"
    assert policy.space_role(other, s) is None and policy.space_role(owner, None) is None
    pub = shared_space(owner, {"editor": ed}, visibility="org")
    assert policy.space_role(other, pub) == "viewer" and policy.space_role(ed, pub) == "editor"   # thành viên thắng


def test_load_space_errors_keep_old_messages():
    owner, ed, viewer, stranger = (make_user(n) for n in ("owner", "ed", "viewer", "stranger"))
    s = shared_space(owner, {"editor": ed, "viewer": viewer})
    assert policy.load_space(str(s["_id"]), viewer)["_id"] == s["_id"]           # chuỗi id
    assert policy.load_space(s["_id"], ed, "space.write")["_id"] == s["_id"]     # ObjectId
    cases = [
        ("không-phải-id", owner, "space.read", 404, "Không tìm thấy kho"),
        (None, owner, "space.read", 404, "Không tìm thấy kho"),
        (ObjectId(), owner, "space.read", 404, "Không tìm thấy kho"),           # id đúng dạng, kho không có
        (s["_id"], stranger, "space.read", 404, "Không tìm thấy kho"),           # không lộ kho tồn tại
        (s["_id"], stranger, "space.manage", 404, "Không tìm thấy kho"),
        (s["_id"], viewer, "card.write", 403, "Bạn chỉ có quyền xem kho này"),
        (s["_id"], viewer, "source.write", 403, "Bạn chỉ có quyền xem kho này"),
        (s["_id"], ed, "space.manage", 403, "Chỉ chủ kho được thực hiện"),
    ]
    for sid, u, action, code, msg in cases:
        with pytest.raises(HTTPException) as e:
            policy.load_space(sid, u, action)
        assert (e.value.status_code, e.value.detail) == (code, msg), (sid, u["name"], action)


def test_load_space_custom_what_and_legacy_roles():
    owner, viewer, stranger = make_user("owner"), make_user("viewer"), make_user("stranger")
    s = shared_space(owner, {"viewer": viewer})
    with pytest.raises(HTTPException) as e:
        policy.load_space(s["_id"], stranger, "card.read", "thẻ")
    assert (e.value.status_code, e.value.detail) == (404, "Không tìm thấy thẻ")
    # tên vai trò cũ ("viewer" / "editor" / "owner") vẫn nhận — code cũ + cổng MCP gọi kiểu này
    assert policy.load_space(s["_id"], viewer, "viewer")["_id"] == s["_id"]
    with pytest.raises(HTTPException) as e:
        policy.load_space(s["_id"], viewer, "editor")
    assert (e.value.status_code, e.value.detail) == (403, "Bạn chỉ có quyền xem kho này")
    with pytest.raises(HTTPException) as e:
        policy.load_space(s["_id"], viewer, "owner")
    assert e.value.detail == "Chỉ chủ kho được thực hiện"
    with pytest.raises(ValueError):
        policy.load_space(s["_id"], owner, "org.manage")          # không phải hành động trên kho


def test_spaces_get_space_compat_wrapper():
    from app.spaces import get_space
    owner, viewer = make_user("owner"), make_user("viewer")
    s = shared_space(owner, {"viewer": viewer})
    assert get_space(str(s["_id"]), viewer)["_id"] == s["_id"]
    with pytest.raises(HTTPException) as e:
        get_space(s["_id"], viewer, "editor")
    assert (e.value.status_code, e.value.detail) == (403, "Bạn chỉ có quyền xem kho này")


def test_require_custom_denied_message():
    owner, viewer = make_user("owner"), make_user("viewer")
    s = shared_space(owner, {"viewer": viewer})
    with pytest.raises(HTTPException) as e:
        policy.require(viewer, "card.write", {"space_id": s["_id"]}, "thẻ", denied="Thiếu quyền sửa")
    assert (e.value.status_code, e.value.detail) == (403, "Thiếu quyền sửa")
    with pytest.raises(HTTPException) as e:
        policy.require(viewer, "card.write", {"space_id": s["_id"]}, "thẻ")
    assert e.value.detail == "Bạn không có quyền thực hiện việc này"             # mặc định không đổi


def test_editable_space_ids_and_filters():
    a, b = make_user("a"), make_user("b")
    pa, pb = personal_space(a), personal_space(b)
    shared_b_edit = shared_space(b, {"editor": a})
    shared_b_view = shared_space(b, {"viewer": a})
    public_b = shared_space(b, visibility="org")
    assert set(policy.editable_space_ids(a)) == {pa["_id"], shared_b_edit["_id"]}
    assert set(policy.editable_space_ids(a, among=[pb["_id"], shared_b_edit["_id"], public_b["_id"]])) == \
        {shared_b_edit["_id"]}
    assert policy.editable_space_ids(a, among=[]) == []
    readable = {s["_id"] for s in spaces.find(policy.visible_spaces_filter(a))}
    assert readable == {pa["_id"], shared_b_edit["_id"], shared_b_view["_id"], public_b["_id"]}
    assert set(policy.readable_space_ids(a)) == readable


# ---------------------------------------------------------------------------
# ORG-13 — admin không có ngoại lệ đọc nội dung
# ---------------------------------------------------------------------------

def test_admin_has_no_content_bypass():
    admin, a = make_user("admin", role="admin"), make_user("a")
    pa = personal_space(a)
    item = {"space_id": pa["_id"]}
    for action in ("space.read", "source.read", "document.read", "card.read", "card.write"):
        assert not policy.can(admin, action, item), action
    assert pa["_id"] not in policy.readable_space_ids(admin)
    assert pa["_id"] not in policy.visible_filter(admin)["space_id"]["$in"]
    with pytest.raises(HTTPException) as e:
        policy.load_space(pa["_id"], admin)
    assert e.value.status_code == 404
    assert policy.can(admin, "org.manage")                                       # vẫn quản trị được


def test_chat_read_only_owner():
    admin, a = make_user("admin", role="admin"), make_user("a")
    thread = {"user_id": a["_id"]}
    assert policy.can(a, "chat.read", thread)
    assert not policy.can(admin, "chat.read", thread)
    with pytest.raises(HTTPException) as e:
        policy.require(admin, "chat.read", thread, "cuộc trò chuyện")
    assert (e.value.status_code, e.value.detail) == (404, "Không tìm thấy cuộc trò chuyện")
