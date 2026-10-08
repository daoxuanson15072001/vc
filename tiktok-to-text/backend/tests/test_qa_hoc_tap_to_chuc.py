"""Lỗi QA đợt 2 — Học tập (LRN) + Tổ chức (ORG): B2 (cờ kho cá nhân), B4, B5, B6, B7, B8, B9."""

from __future__ import annotations

from datetime import timedelta
from bson import ObjectId

from tests.training_support import training_subject

from app import auth, db, org
from app.learn.models import attempts
from app.spaces import spaces
from tests.conftest import grant, make_user
from tests.test_learn_api import ESSAY, MULTI, SINGLE, make_lesson, make_question, world  # noqa: F401
from tests.test_org import admin_client, reload, uid, unit_id


# ---------------------------------------------------------------------------
# B5 — chuỗi toàn khoảng trắng bị từ chối, rõ trường
# ---------------------------------------------------------------------------

def test_b5_bai_hoc_cau_hoi_khong_nhan_chuoi_trang(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    card = [str(w["c1"]["_id"])]
    r = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "   ", "items": [{"card_id": card[0]}]})
    assert r.status_code == 422 and "Tên bài học không được để trống" in r.text
    r = c.post("/api/learn/questions", json=SINGLE | {"stem": "  \n ", "card_ids": card})
    assert r.status_code == 422 and "Đề bài không được để trống" in r.text
    opts = [{"text": " ", "correct": True}, {"text": "B"}]
    r = c.post("/api/learn/questions", json=SINGLE | {"options": opts, "card_ids": card})
    assert r.status_code == 422 and "Nội dung phương án không được để trống" in r.text
    r = c.post("/api/learn/questions", json=ESSAY | {"rubric": [{"criterion": "  ", "max": 3}], "card_ids": card})
    assert r.status_code == 422 and "Tiêu chí rubric không được để trống" in r.text
    # khoảng trắng đầu / cuối được bỏ
    q = make_question(c, SINGLE | {"stem": "  Câu có khoảng trắng  ",
                                   "options": [{"text": " Đúng ", "correct": True}, {"text": "Sai"}]}, [w["c1"]])
    assert q["stem"] == "Câu có khoảng trắng" and q["options"][0]["text"] == "Đúng"
    # sửa: cũng chặn
    assert c.patch(f"/api/learn/questions/{q['id']}", json={"stem": "   "}).status_code == 422
    lesson = make_lesson(w, [], publish=False)
    assert c.patch(f"/api/learn/lessons/{lesson['id']}", json={"title": "  "}).status_code == 422


def test_b5_ten_don_vi_chuc_nang_khong_nhan_chuoi_trang(client, org_sample):
    admin_client(client)
    r = client.post("/api/org/units", json={"code": "X2", "name": "   ", "kind": "department",
                                            "parent_id": unit_id(org_sample, "VCPART")})
    assert r.status_code == 422 and "Tên đơn vị không được để trống" in r.text
    r = client.patch(f"/api/org/units/{unit_id(org_sample, 'VCPART')}", json={"name": "  "})
    assert r.status_code == 422
    r = client.post("/api/org/functions", json={"code": "it", "name": " "})
    assert r.status_code == 422 and "Tên chức năng không được để trống" in r.text
    r = client.post("/api/org/units", json={"code": "X3", "name": "  Phòng X3 ", "kind": "department",
                                            "parent_id": unit_id(org_sample, "VCPART")})
    assert r.status_code == 201 and r.json()["name"] == "Phòng X3"


# ---------------------------------------------------------------------------
# B2 — bài học cho biết kho chỉ người soạn xem được
# ---------------------------------------------------------------------------

def test_b2_bai_hoc_bao_kho_ca_nhan_chi_nguoi_soan_xem(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    mine = c.post("/api/learn/lessons", json={"subject_id": training_subject(c), "title": "Bài riêng", "items": [{"card_id": str(w["c1"]["_id"])}]}).json()
    assert mine["space_only_owner"] is True
    assert make_lesson(w, [], publish=False)["space_only_owner"] is False       # kho phòng có nhân viên
    # luật quyền không đổi: phát hành trong kho cá nhân thì nhân viên dưới quyền vẫn không thấy
    assert c.patch(f"/api/learn/lessons/{mine['id']}", json={"status": "published"}).status_code == 200
    c.login(w["p"]["nv_part_kd"])
    assert c.get(f"/api/learn/lessons/{mine['id']}").status_code == 404
    # kho cá nhân đã mở cho cả công ty thì không còn là "chỉ mình tôi"
    spaces.update_one({"type": "personal", "owner_id": w["p"]["tp_part_kd"]["_id"]}, {"$set": {"visibility": "org"}})
    c.login(w["p"]["tp_part_kd"])
    assert c.get(f"/api/learn/lessons/{mine['id']}").json()["space_only_owner"] is False


# ---------------------------------------------------------------------------
# B8 — huỷ giữa lượt luyện tập thì làm tiếp được; B9 — null xoá câu trả lời
# ---------------------------------------------------------------------------

def test_b8_lam_tiep_luot_chua_nop_b9_null_xoa_cau_tra_loi(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    sid = str(w["space"]["_id"])
    qs = [make_question(c, SINGLE | {"space_id": sid}, [w["c1"]]),
          make_question(c, MULTI | {"space_id": sid}, [w["c2"]]),
          make_question(c, ESSAY | {"space_id": sid}, [w["c1"]])]
    lesson = make_lesson(w, qs)
    c.login(w["p"]["nv_part_kd"])
    a = c.post(f"/api/learn/lessons/{lesson['id']}/practice").json()
    assert a["resumed"] is False
    by_q = {p["question_id"]: p for p in a["paper"]}
    multi_key = by_q[qs[1]["id"]]["options"][0]["key"]
    single_key = by_q[qs[0]["id"]]["options"][0]["key"]
    r = c.put(f"/api/learn/attempts/{a['id']}/answers",
              json={"answers": {qs[0]["id"]: single_key, qs[1]["id"]: [multi_key], qs[2]["id"]: "Nháp tự luận"}})
    assert r.status_code == 200 and len(r.json()["answers"]) == 3
    # B9: null xoá câu trả lời cho cả 3 loại câu
    r = c.put(f"/api/learn/attempts/{a['id']}/answers", json={"answers": {qs[1]["id"]: None, qs[2]["id"]: None}})
    assert r.status_code == 200, r.text
    assert r.json()["answers"] == {qs[0]["id"]: single_key}
    r = c.put(f"/api/learn/attempts/{a['id']}/answers", json={"answers": {qs[0]["id"]: None}})
    assert r.status_code == 200 and r.json()["answers"] == {}
    c.put(f"/api/learn/attempts/{a['id']}/answers", json={"answers": {qs[0]["id"]: single_key}})

    # B8: "Huỷ" rồi bấm Luyện tập lại -> làm tiếp đúng lượt đó, giữ câu trả lời, không tạo lượt mới
    again = c.post(f"/api/learn/lessons/{lesson['id']}/practice")
    assert again.status_code == 201
    b = again.json()
    assert b["resumed"] is True and b["id"] == a["id"] and b["answers"] == {qs[0]["id"]: single_key}
    assert [p["question_id"] for p in b["paper"]] == [p["question_id"] for p in a["paper"]]   # cùng đề
    assert attempts.count_documents({"lesson_id": attempts.find_one()["lesson_id"]}) == 1
    # nộp xong thì bấm Luyện tập là lượt mới
    assert c.post(f"/api/learn/attempts/{a['id']}/submit").status_code == 200
    n = c.post(f"/api/learn/lessons/{lesson['id']}/practice").json()
    assert n["resumed"] is False and n["id"] != a["id"]
    # lượt dở của người khác không bị dùng lại
    c.login(w["p"]["tp_part_kd"])
    t = c.post(f"/api/learn/lessons/{lesson['id']}/practice").json()
    assert t["id"] not in (a["id"], n["id"]) and t["resumed"] is False


def test_b8_ban_phat_hanh_ghim_cau_va_legacy_bo_cau_doi(world):
    w, c = world, world["client"]
    c.login(w["p"]["tp_part_kd"])
    sid = str(w["space"]["_id"])
    q1 = make_question(c, SINGLE | {"space_id": sid}, [w["c1"]])
    q2 = make_question(c, MULTI | {"space_id": sid}, [w["c2"]])
    lesson = make_lesson(w, [q1, q2])
    c.login(w["p"]["nv_part_kd"])
    a = c.post(f"/api/learn/lessons/{lesson['id']}/practice").json()
    # TK-16: câu 2 sửa về nháp không đổi pool đã chụp của bài mới phát hành.
    c.login(w["p"]["tp_part_kd"])
    c.patch(f"/api/learn/questions/{q2['id']}", json={"status": "draft"})
    c.login(w["p"]["nv_part_kd"])
    b = c.post(f"/api/learn/lessons/{lesson['id']}/practice").json()
    assert b["id"] == a["id"] and len(b["paper"]) == 2 and b["resumed"] is True
    # Bài legacy chưa có pool giữ luật B8 cũ; dựng đúng trạng thái đó trên DB test.
    db.db.lessons.update_one({'_id': ObjectId(lesson['id'])}, {'$unset': {'_practice_pool': ''}})
    legacy = c.post(f"/api/learn/lessons/{lesson['id']}/practice").json()
    assert legacy["id"] != a["id"] and len(legacy["paper"]) == 1 and legacy["resumed"] is False


# ---------------------------------------------------------------------------
# B4 — mở khoá người đã nghỉ việc = cho đi làm lại
# ---------------------------------------------------------------------------

def test_b4_mo_khoa_nguoi_da_nghi_dua_ve_dang_lam(client, org_sample):
    p = org_sample["people"]
    admin_client(client)
    assert client.post(f"/api/org/users/{uid(org_sample, 'tp_garage_kt')}/offboard").status_code == 200
    left = reload(p["tp_garage_kt"])
    assert org.user_org(left)["status"] == "left" and left["org_left"]

    # nhập Excel khi còn nghỉ: câu báo chỉ đúng chỗ mở lại
    res = org.import_org([(2, {"email": left["email"], "name": "", "unit_code": "VCGARAGE-KT", "function": "",
                               "manager_email": "", "functional_manager_email": "", "position": ""})])
    assert "mở khoá ở màn Người dùng" in res["rows"][0]["errors"][0]

    r = client.patch(f"/api/users/{left['_id']}", json={"active": True})
    assert r.status_code == 200
    back = reload(p["tp_garage_kt"])
    assert back["active"] is True and org.user_org(back)["status"] == "active"
    assert "org_left" not in back and back["org_history"][0]["left"]["at"]      # lần nghỉ việc chuyển vào lịch sử
    assert org.user_org(back)["unit_ids"] == [org_sample["units"]["VCGARAGE-KT"]["_id"]]
    # hết bế tắc: sửa hồ sơ, đặt làm quản lý, cấp vai trò, nhập Excel đều được
    r = client.patch(f"/api/org/users/{left['_id']}", json={"position": "Kỹ sư trưởng"})
    assert r.status_code == 200 and r.json()["org"]["status"] == "active"
    assert client.patch(f"/api/org/users/{uid(org_sample, 'ks_garage_kt')}",
                        json={"manager_id": str(left["_id"])}).status_code == 200
    assert client.post("/api/org/grants", json={"user_id": str(left["_id"]), "role": "reviewer"}).status_code == 201
    res = org.import_org([(2, {"email": left["email"], "name": "", "unit_code": "VCGARAGE-KT", "function": "",
                               "manager_email": "", "functional_manager_email": "", "position": "Kỹ sư trưởng"})])
    assert res["rows"][0]["errors"] == []
    # người đã khoá mà không nghỉ việc: mở khoá không đụng hồ sơ tổ chức
    u = make_user("chi_khoa")
    client.patch(f"/api/users/{u['_id']}", json={"active": False})
    client.patch(f"/api/users/{u['_id']}", json={"active": True})
    assert "org_history" not in reload(u)


def test_b4_nguoi_da_mo_khoa_truoc_ban_sua_van_go_duoc(client, org_sample):
    """Dữ liệu cũ: đã mở khoá (active=true) nhưng vẫn kẹt `left` — bấm mở khoá lần nữa (nút "Cho đi làm lại")."""
    p = org_sample["people"]
    auth.users.update_one({"_id": p["nv_part_kd"]["_id"]}, {"$set": {"org.status": "left", "active": True}})
    admin_client(client)
    assert client.patch(f"/api/users/{p['nv_part_kd']['_id']}", json={"active": True}).status_code == 200
    assert org.user_org(reload(p["nv_part_kd"]))["status"] == "active"


# ---------------------------------------------------------------------------
# B6 — uỷ quyền trùng; B7 — vai trò sắp hiệu lực
# ---------------------------------------------------------------------------

def test_b6_uy_quyen_trung_bi_chan(client, org_sample):
    p = org_sample["people"]
    g = grant(p["tp_garage_kt"], "reviewer", org_sample["units"]["VCGARAGE-KT"])
    body = {"grant_id": str(g["_id"]), "user_id": uid(org_sample, "ks_garage_kt"),
            "valid_to": (db.now() + timedelta(days=7)).isoformat()}
    client.login(p["tp_garage_kt"])
    assert client.post("/api/org/delegations", json=body).status_code == 201
    r = client.post("/api/org/delegations", json=body)
    assert r.status_code == 409 and "đã được uỷ quyền vai trò này" in r.json()["detail"]
    # khoảng sau, không chồng lên -> được
    later = body | {"valid_from": (db.now() + timedelta(days=8)).isoformat(),
                    "valid_to": (db.now() + timedelta(days=10)).isoformat()}
    assert client.post("/api/org/delegations", json=later).status_code == 201
    # người nhận khác -> được
    assert client.post("/api/org/delegations", json=body | {"user_id": uid(org_sample, "tts_garage_kt")}
                       ).status_code == 201
    got = org.active_grants(p["ks_garage_kt"], "reviewer")
    assert len(got) == 1                                    # /org/me không còn 2 dòng giống nhau


def test_b7_vai_tro_sap_hieu_luc(client, org_sample):
    p = org_sample["people"]
    a = admin_client(client)
    start = db.now() + timedelta(days=3)
    r = client.post("/api/org/grants", json={"user_id": uid(org_sample, "ks_garage_kt"), "role": "editor",
                                             "valid_from": start.isoformat()})
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["upcoming"] is True and g["active"] is False
    # danh sách mặc định có vai trò sắp hiệu lực (gắn cờ upcoming)
    rows = client.get(f"/api/org/grants?user_id={uid(org_sample, 'ks_garage_kt')}").json()
    assert [(x["role"], x["upcoming"]) for x in rows] == [("editor", True)]
    # cấp trùng vai trò sắp hiệu lực -> 409 (trước chỉ xét vai trò đang hiệu lực)
    assert client.post("/api/org/grants", json={"user_id": uid(org_sample, "ks_garage_kt"),
                                                "role": "editor"}).status_code == 409
    # uỷ quyền: báo "chưa tới ngày hiệu lực", không phải "đã hết hiệu lực"
    client.login(p["ks_garage_kt"])
    r = client.post("/api/org/delegations", json={"grant_id": g["id"], "user_id": uid(org_sample, "tts_garage_kt"),
                                                  "valid_to": (db.now() + timedelta(days=9)).isoformat()})
    assert r.status_code == 400 and "chưa tới ngày hiệu lực" in r.json()["detail"]
    # thu hồi vai trò sắp hiệu lực được, sau đó không còn trong danh sách mặc định
    client.login(a)
    assert client.delete(f"/api/org/grants/{g['id']}").status_code == 204
    assert client.get(f"/api/org/grants?user_id={uid(org_sample, 'ks_garage_kt')}").json() == []
    old = client.get(f"/api/org/grants?user_id={uid(org_sample, 'ks_garage_kt')}&include_inactive=1").json()
    assert old[0]["revoked_at"] and not old[0]["upcoming"]


def test_b7_nghi_viec_chuyen_ca_vai_tro_sap_hieu_luc(client, org_sample):
    p = org_sample["people"]
    start = db.now() + timedelta(days=5)
    g = grant(p["tp_garage_kt"], "reviewer", org_sample["units"]["VCGARAGE-KT"], valid_from=start)
    admin_client(client)
    res = client.post(f"/api/org/users/{uid(org_sample, 'tp_garage_kt')}/offboard").json()
    assert [x["role"] for x in res["grants_transferred"]] == ["reviewer"]
    assert org.grants.find_one({"_id": g["_id"]})["revoked_reason"] == "offboard"
    new = org.grants.find_one({"transferred_from": g["_id"]})
    assert new["user_id"] == p["gd_garage"]["_id"] and new["valid_from"] >= start - timedelta(seconds=1)


def test_u7_sua_don_vi_tra_ten_truong_don_vi(client, org_sample):
    admin_client(client)
    r = client.patch(f"/api/org/units/{unit_id(org_sample, 'VCPART-KD')}", json={"head_id": uid(org_sample, "tp_part_kd")})
    assert r.status_code == 200 and r.json()["head"]["name"] == "tp_part_kd"
