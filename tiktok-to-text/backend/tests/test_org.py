"""Cơ cấu tổ chức — luồng A (docs/BA.md mục 15.2, 15.4, 15.9: ORG-01…04, 06…08, 14)."""

from __future__ import annotations

import io
from datetime import timedelta

import openpyxl
import pytest

from app import auth, db, org
from tests.conftest import add_unit, grant, make_user


def admin_client(client):
    a = make_user("quan_tri", role="admin")
    client.login(a)
    return a


def unit_id(org_sample, code):
    return str(org_sample["units"][code]["_id"])


def uid(org_sample, key):
    return str(org_sample["people"][key]["_id"])


def reload(user):
    return auth.users.find_one({"_id": user["_id"]})


# ---------------------------------------------------------------------------
# ORG-01, 14 — cây đơn vị
# ---------------------------------------------------------------------------

def test_cay_don_vi_moi_nguoi_xem_duoc_kem_so_nguoi(client, org_sample):
    client.login(org_sample["people"]["nv_part_kd"])
    t = client.get("/api/org/tree").json()
    assert [u["code"] for u in t["units"]] == ["VCPV"]
    root = t["units"][0]
    assert root["member_count"] == 2                        # tgd + hr_lnd
    by_code = {c["code"]: c for c in root["children"]}
    assert set(by_code) == {"TD-MKT", "VCPART", "VCGARAGE"}
    kt = next(c for c in by_code["VCGARAGE"]["children"] if c["code"] == "VCGARAGE-KT")
    assert kt["member_count"] == 3 and kt["depth"] == 3 and kt["function"] == "tech"
    assert t["unassigned"] == 0


def test_chi_quan_tri_sua_duoc_don_vi(client, org_sample):
    client.login(org_sample["people"]["tgd"])
    r = client.post("/api/org/units", json={"code": "X", "name": "X", "kind": "group"})
    assert r.status_code == 403
    assert client.patch(f"/api/org/units/{unit_id(org_sample, 'VCPART')}", json={"name": "Y"}).status_code == 403


def test_tao_don_vi_ma_duy_nhat_viet_hoa(client, org_sample):
    admin_client(client)
    r = client.post("/api/org/units", json={"code": "vcpart-kho", "name": "Phòng Kho vận", "kind": "department",
                                            "parent_id": unit_id(org_sample, "VCPART")})
    assert r.status_code == 201, r.text
    u = r.json()
    assert u["code"] == "VCPART-KHO" and u["path"] == [unit_id(org_sample, "VCPV"), unit_id(org_sample, "VCPART")]
    assert u["order"] == 1                                   # xếp sau các phòng đang có (order 0)
    dup = client.post("/api/org/units", json={"code": "VCPART-KHO", "name": "Trùng", "kind": "department",
                                              "parent_id": unit_id(org_sample, "VCPART")})
    assert dup.status_code == 409
    bad = client.post("/api/org/units", json={"code": "Phòng KD", "name": "Sai", "kind": "department",
                                              "parent_id": unit_id(org_sample, "VCPART")})
    assert bad.status_code == 422 and "Mã đơn vị" in bad.text


def test_tao_don_vi_kiem_tra_vi_tri_va_toi_da_4_tang(client, org_sample):
    admin_client(client)
    post = lambda **b: client.post("/api/org/units", json={"name": "N", **b})   # noqa: E731
    assert post(code="GOC", kind="division").status_code == 400                 # gốc phải là Tập đoàn
    assert post(code="PHONG-TD", kind="department", parent_id=unit_id(org_sample, "VCPV")).status_code == 201
    assert post(code="DIV2", kind="division", parent_id=unit_id(org_sample, "VCPART")).status_code == 400
    team = post(code="KT-N1", kind="team", parent_id=unit_id(org_sample, "VCGARAGE-KT"))
    assert team.status_code == 201 and team.json()["depth"] == 4
    r = post(code="KT-N1-A", kind="team", parent_id=team.json()["id"])
    assert r.status_code == 400


def test_doi_cha_cap_nhat_path_ca_nhanh_va_chan_chon_con_chau(client, org_sample):
    admin_client(client)
    team = client.post("/api/org/units", json={"code": "KD-N1", "name": "Nhóm 1", "kind": "team",
                                               "parent_id": unit_id(org_sample, "VCPART-KD")}).json()
    # Chuyển phòng KD VCpart (kèm nhóm con) sang VCgarage
    r = client.patch(f"/api/org/units/{unit_id(org_sample, 'VCPART-KD')}",
                     json={"parent_id": unit_id(org_sample, "VCGARAGE")})
    assert r.status_code == 200, r.text
    assert r.json()["path"] == [unit_id(org_sample, "VCPV"), unit_id(org_sample, "VCGARAGE")]
    t = org.org_units.find_one({"code": "KD-N1"})
    assert [str(x) for x in t["path"]] == [unit_id(org_sample, "VCPV"), unit_id(org_sample, "VCGARAGE"),
                                           unit_id(org_sample, "VCPART-KD")]
    # Không chọn chính nó / con cháu làm cha
    assert client.patch(f"/api/org/units/{unit_id(org_sample, 'VCPART-KD')}",
                        json={"parent_id": team["id"]}).status_code == 400
    assert client.patch(f"/api/org/units/{unit_id(org_sample, 'VCGARAGE')}",
                        json={"parent_id": unit_id(org_sample, "VCGARAGE")}).status_code == 400


def test_an_don_vi_con_nguoi_thi_bi_chan_khong_con_thi_an_ca_nhanh(client, org_sample):
    admin_client(client)
    r = client.patch(f"/api/org/units/{unit_id(org_sample, 'VCPART-KD')}", json={"active": False})
    assert r.status_code == 409 and "2 người" in r.json()["detail"]
    div = client.post("/api/org/units", json={"code": "VCSOFT", "name": "VCsoft", "kind": "division",
                                              "parent_id": unit_id(org_sample, "VCPV")}).json()
    client.post("/api/org/units", json={"code": "VCSOFT-DEV", "name": "Phòng Dev", "kind": "department",
                                        "parent_id": div["id"]})
    assert client.patch(f"/api/org/units/{div['id']}", json={"active": False}).json()["active"] is False
    assert org.org_units.find_one({"code": "VCSOFT-DEV"})["active"] is False
    codes = {u["code"] for u in client.get("/api/org/units").json()}
    assert "VCSOFT" not in codes and "VCSOFT-DEV" not in codes
    assert "VCSOFT-DEV" in {u["code"] for u in client.get("/api/org/units?include_inactive=1").json()}
    # Hiện con khi cha còn ẩn -> báo
    dev = org.org_units.find_one({"code": "VCSOFT-DEV"})
    assert client.patch(f"/api/org/units/{dev['_id']}", json={"active": True}).status_code == 400
    assert client.patch(f"/api/org/units/{div['id']}", json={"active": True}).json()["active"] is True


def test_sap_xep_don_vi(client, org_sample):
    admin_client(client)
    client.patch(f"/api/org/units/{unit_id(org_sample, 'VCGARAGE')}", json={"order": -1})
    kids = client.get("/api/org/tree").json()["units"][0]["children"]
    assert kids[0]["code"] == "VCGARAGE"


# ---------------------------------------------------------------------------
# ORG-02 — chức năng
# ---------------------------------------------------------------------------

def test_danh_muc_chuc_nang(client, org_sample):
    admin_client(client)
    r = client.post("/api/org/functions", json={"code": "Finance", "name": "Tài chính – Kế toán"})
    assert r.status_code == 201 and r.json()["code"] == "finance"
    assert client.post("/api/org/functions", json={"code": "finance", "name": "Trùng"}).status_code == 409
    fid = r.json()["id"]
    assert client.patch(f"/api/org/functions/{fid}", json={"name": "TCKT"}).json()["name"] == "TCKT"
    client.patch(f"/api/org/functions/{fid}", json={"active": False})
    fs = {f["code"]: f for f in client.get("/api/org/functions").json()}
    assert "finance" not in fs and fs["tech"]["people_count"] == 3 and fs["sales"]["unit_count"] == 2
    # Chức năng đã ẩn không gắn được cho người
    r = client.patch(f"/api/org/users/{uid(org_sample, 'tgd')}", json={"function": "finance"})
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# ORG-03 — hồ sơ tổ chức của người
# ---------------------------------------------------------------------------

def test_sua_ho_so_to_chuc(client, org_sample):
    admin_client(client)
    p = org_sample["people"]
    r = client.patch(f"/api/org/users/{uid(org_sample, 'nv_part_kd')}", json={
        "unit_ids": [unit_id(org_sample, "VCPART-MKT"), unit_id(org_sample, "VCPART-KD")],
        "function": "marketing", "position": "Chuyên viên", "manager_id": uid(org_sample, "tp_part_mkt"),
        "functional_manager_id": uid(org_sample, "gd_mkt")})
    assert r.status_code == 200, r.text
    o = org.user_org(reload(p["nv_part_kd"]))
    assert o["unit_ids"] == [org_sample["units"]["VCPART-MKT"]["_id"], org_sample["units"]["VCPART-KD"]["_id"]]
    assert o["manager_id"] == p["tp_part_mkt"]["_id"] and o["position"] == "Chuyên viên" and o["level"] is None
    # Quyền đổi ngay: người dưới quyền của tp_part_mkt có thêm người này
    assert p["nv_part_kd"]["_id"] in org.subordinate_ids(p["tp_part_mkt"]["_id"])
    # Chỉ gửi một trường thì các trường khác giữ nguyên; null = bỏ quản lý
    client.patch(f"/api/org/users/{uid(org_sample, 'nv_part_kd')}", json={"functional_manager_id": None})
    o = org.user_org(reload(p["nv_part_kd"]))
    assert o["functional_manager_id"] is None and o["manager_id"] == p["tp_part_mkt"]["_id"]


def test_chan_vong_quan_ly_va_tu_quan_ly(client, org_sample):
    admin_client(client)
    r = client.patch(f"/api/org/users/{uid(org_sample, 'tgd')}", json={"manager_id": uid(org_sample, "tts_garage_kt")})
    assert r.status_code == 400 and "vòng quản lý" in r.json()["detail"]
    assert "tgd" in r.json()["detail"] and "tts_garage_kt" in r.json()["detail"]
    r = client.patch(f"/api/org/users/{uid(org_sample, 'tgd')}", json={"manager_id": uid(org_sample, "tgd")})
    assert r.status_code == 400 and "chính mình" in r.json()["detail"]
    r = client.patch(f"/api/org/users/{uid(org_sample, 'gd_mkt')}",
                     json={"functional_manager_id": uid(org_sample, "nv_part_mkt")})
    assert r.status_code == 400
    r = client.patch(f"/api/org/users/{uid(org_sample, 'tgd')}", json={"unit_ids": ["khong-phai-id"]})
    assert r.status_code == 400


def test_danh_sach_nguoi_dung_kem_ho_so_to_chuc(client, org_sample):
    client.login(org_sample["people"]["nv_part_kd"])
    rows = client.get(f"/api/users?unit_id={unit_id(org_sample, 'VCGARAGE-KT')}").json()
    assert sorted(r["name"] for r in rows) == ["ks_garage_kt", "tp_garage_kt", "tts_garage_kt"]
    ks = next(r for r in rows if r["name"] == "ks_garage_kt")
    assert ks["org"]["manager_id"] == uid(org_sample, "tp_garage_kt") and ks["org"]["function"] == "tech"
    make_user("moi_vao")
    assert [r["name"] for r in client.get("/api/users?no_unit=1").json()] == ["moi_vao"]


# ---------------------------------------------------------------------------
# ORG-04 — nhập Excel / CSV
# ---------------------------------------------------------------------------

HEADER = "Email,Họ tên,Mã đơn vị,Chức năng,Email quản lý,Email quản lý chuyên môn,Chức danh\n"


def upload(client, content: str | bytes, name: str = "nhan_su.csv", dry_run: bool = True):
    data = content.encode() if isinstance(content, str) else content
    return client.post(f"/api/org/import?dry_run={'true' if dry_run else 'false'}",
                       files={"file": (name, data, "application/octet-stream")})


def test_nhap_xem_truoc_bao_loi_tung_dong_khong_ghi_gi(client, org_sample):
    admin_client(client)
    csv = HEADER + (
        "moi1@test.local,Người Mới 1,VCPART-KD,,tp_part_kd@test.local,,Nhân viên\n"      # đúng
        "email-sai,Sai Email,VCPART-KD,,,,\n"
        "moi2@test.local,Người Mới 2,KHONG-CO,,,,\n"
        "moi3@test.local,Người Mới 3,VCPART-KD,,ai-do@ngoai.vn,,\n"
        "moi4@test.local,Người Mới 4,VCPART-KD,phép thuật,,,\n"
        "moi1@test.local,Trùng,VCPART-KD,,,,\n"
        "tgd@test.local,,VCPV,,nv_part_kd@test.local,,\n")                               # vòng quản lý
    r = upload(client, csv)
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["dry_run"] and not res["applied"] and res["total"] == 7
    rows = {x["row"]: x for x in res["rows"]}
    assert rows[2]["action"] == "create" and rows[2]["function"] == "sales" and not rows[2]["errors"]
    assert "Email không hợp lệ" in rows[3]["errors"]
    assert any("KHONG-CO" in e for e in rows[4]["errors"])
    assert any("không có trong file cũng không có trong hệ thống" in e for e in rows[5]["errors"])
    assert any("phép thuật" in e for e in rows[6]["errors"])
    assert any("trùng với dòng 2" in e for e in rows[7]["errors"])
    assert any("vòng quản lý" in e for e in rows[8]["errors"])
    assert res["counts"]["error"] == 6
    assert not auth.users.find_one({"email": "moi1@test.local"})
    # dry_run=false khi còn lỗi -> không ghi gì
    r = upload(client, csv, dry_run=False)
    assert r.json()["applied"] is False and not auth.users.find_one({"email": "moi1@test.local"})


def test_nhap_that_tao_tai_khoan_va_chay_lai_khong_trung(client, org_sample):
    admin_client(client)
    p = org_sample["people"]
    csv = HEADER + (
        # quản lý nằm ngay trong file (dòng sau), chưa có tài khoản
        "nv.moi@test.local,Nhân Viên Mới,VCGARAGE-KD,,tp.moi@test.local,,Kỹ thuật viên\n"
        "tp.moi@test.local,Trưởng Phòng Mới,VCGARAGE-KD,Kinh doanh,gd_garage@test.local,gd_mkt@test.local,Trưởng phòng\n"
        "ks_garage_kt@test.local,,VCGARAGE-KT,tech,tp_garage_kt@test.local,,Key staff\n")
    res = upload(client, csv, dry_run=False).json()
    assert res["applied"], res
    assert res["counts"] == {"create": 2, "update": 1, "unchanged": 0, "error": 0}
    created = {c["email"]: c for c in res["created"]}
    assert set(created) == {"nv.moi@test.local", "tp.moi@test.local"}
    tp = auth.users.find_one({"email": "tp.moi@test.local"})
    assert auth.verify_password(created["tp.moi@test.local"]["password"], tp["password_hash"])
    nv = auth.users.find_one({"email": "nv.moi@test.local"})
    assert org.user_org(nv)["manager_id"] == tp["_id"] and org.user_org(nv)["function"] == "sales"
    assert org.user_org(tp)["functional_manager_id"] == p["gd_mkt"]["_id"]
    assert org.user_org(reload(p["ks_garage_kt"]))["position"] == "Key staff"
    # Chạy lại cùng file: không tạo trùng, không đổi gì
    again = upload(client, csv, dry_run=False).json()
    assert again["counts"] == {"create": 0, "update": 0, "unchanged": 3, "error": 0} and again["created"] == []
    assert auth.users.count_documents({"email": "nv.moi@test.local"}) == 1


def test_nhap_excel_va_csv_cham_phay_khong_tieu_de(client, org_sample):
    admin_client(client)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["email", "ho ten", "ma don vi", "chuc nang", "email quan ly", "email quan ly chuyen mon", "chuc danh"])
    ws.append(["x1@test.local", "Excel Một", "VCPART-MKT", None, "tp_part_mkt@test.local", None, None])
    buf = io.BytesIO()
    wb.save(buf)
    res = upload(client, buf.getvalue(), "nhan_su.xlsx").json()
    assert res["rows"][0]["action"] == "create" and res["rows"][0]["function"] == "marketing"
    res = upload(client, "x2@test.local;CSV Hai;VCPART-MKT;;;;\n").json()
    assert res["rows"][0]["action"] == "create" and res["rows"][0]["name"] == "CSV Hai"
    assert upload(client, b"abc", "nhan_su.pdf").status_code == 400


def test_nhap_can_quyen_quan_tri(client, org_sample):
    client.login(org_sample["people"]["tgd"])
    assert upload(client, HEADER).status_code == 403


# ---------------------------------------------------------------------------
# ORG-06, 07 — vai trò chức năng, uỷ quyền
# ---------------------------------------------------------------------------

def test_cap_thu_hoi_vai_tro_va_hoi_ai_co_quyen_o_dau(client, org_sample):
    admin_client(client)
    r = client.post("/api/org/grants", json={"user_id": uid(org_sample, "ks_garage_kt"), "role": "reviewer",
                                             "scope": {"unit_id": unit_id(org_sample, "VCGARAGE-KT")}})
    assert r.status_code == 201, r.text
    g = r.json()
    assert g["scope"]["unit"]["code"] == "VCGARAGE-KT" and g["active"]
    assert client.post("/api/org/grants", json={"user_id": uid(org_sample, "ks_garage_kt"), "role": "reviewer",
                                                "scope": {"unit_id": unit_id(org_sample, "VCGARAGE-KT")}}
                       ).status_code == 409
    assert client.post("/api/org/grants", json={"user_id": uid(org_sample, "tgd"), "role": "vua"}).status_code == 422
    client.post("/api/org/grants", json={"user_id": uid(org_sample, "tgd"), "role": "auditor"})
    # Tại phòng Kỹ thuật VCgarage: reviewer của phòng + L&D của VCgarage (cha) + auditor không giới hạn đơn vị
    at_kt = client.get(f"/api/org/grants?unit_id={unit_id(org_sample, 'VCGARAGE-KT')}").json()
    assert sorted(x["role"] for x in at_kt) == ["auditor", "lnd", "reviewer"]
    at_part = client.get(f"/api/org/grants?unit_id={unit_id(org_sample, 'VCPART-KD')}").json()
    assert [x["role"] for x in at_part] == ["auditor"]
    assert [x["role"] for x in client.get(f"/api/org/grants?user_id={uid(org_sample, 'ks_garage_kt')}").json()] == \
        ["reviewer"]
    assert client.delete(f"/api/org/grants/{g['id']}").status_code == 204
    assert not org.active_grants(org_sample["people"]["ks_garage_kt"], "reviewer")
    old = client.get(f"/api/org/grants?user_id={uid(org_sample, 'ks_garage_kt')}&include_inactive=1").json()
    assert old[0]["revoked_at"] and not old[0]["active"]                 # thu hồi không xoá lịch sử


def test_vai_tro_chi_quan_tri_xem_va_cap(client, org_sample):
    client.login(org_sample["people"]["hr_lnd"])
    assert client.get("/api/org/grants").status_code == 403
    assert client.post("/api/org/grants", json={"user_id": uid(org_sample, "tgd"), "role": "lnd"}).status_code == 403


def test_uy_quyen_co_thoi_han_khong_uy_quyen_tiep(client, org_sample):
    p = org_sample["people"]
    g = grant(p["tp_garage_kt"], "reviewer", org_sample["units"]["VCGARAGE-KT"])
    to = (db.now() + timedelta(days=7)).isoformat()
    client.login(p["ks_garage_kt"])                                       # không giữ vai trò -> không thấy
    assert client.post("/api/org/delegations", json={"grant_id": str(g["_id"]), "user_id": uid(org_sample, "tts_garage_kt"),
                                                     "valid_to": to}).status_code == 404
    client.login(p["tp_garage_kt"])
    assert client.post("/api/org/delegations", json={"grant_id": str(g["_id"]),
                                                     "user_id": uid(org_sample, "ks_garage_kt")}).status_code == 422
    r = client.post("/api/org/delegations", json={"grant_id": str(g["_id"]), "user_id": uid(org_sample, "ks_garage_kt"),
                                                  "valid_to": to, "note": "Nghỉ phép"})
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["delegated_from"] == str(g["_id"]) and d["delegated_by"]["name"] == "tp_garage_kt"
    got = org.active_grants(p["ks_garage_kt"], "reviewer")
    assert len(got) == 1 and got[0]["delegated_from"] == g["_id"]
    # Không uỷ quyền tiếp
    client.login(p["ks_garage_kt"])
    r = client.post("/api/org/delegations", json={"grant_id": d["id"], "user_id": uid(org_sample, "tts_garage_kt"),
                                                  "valid_to": to})
    assert r.status_code == 400 and "không uỷ quyền tiếp" in r.json()["detail"]
    me = client.get("/api/org/me").json()
    assert me["grants"][0]["delegated_by"]["name"] == "tp_garage_kt"
    # Hết hạn ở quá khứ -> báo lỗi
    client.login(p["tp_garage_kt"])
    past = (db.now() - timedelta(days=1)).isoformat()
    assert client.post("/api/org/delegations", json={"grant_id": str(g["_id"]), "user_id": uid(org_sample, "ks_garage_kt"),
                                                     "valid_to": past}).status_code == 400
    # Thu hồi vai trò gốc thì uỷ quyền cũng hết
    admin_client(client)
    client.delete(f"/api/org/grants/{g['_id']}")
    assert not org.active_grants(p["ks_garage_kt"], "reviewer")


def test_uy_quyen_tu_het_han(org_sample):
    p = org_sample["people"]
    g = grant(p["tp_garage_kt"], "reviewer")
    org.grants.insert_one({"user_id": p["ks_garage_kt"]["_id"], "role": "reviewer", "scope": g["scope"],
                           "delegated_from": g["_id"], "valid_from": db.now() - timedelta(days=3),
                           "valid_to": db.now() - timedelta(seconds=1), "created_by": None})
    assert not org.active_grants(p["ks_garage_kt"])


# ---------------------------------------------------------------------------
# ORG-08 — nghỉ việc
# ---------------------------------------------------------------------------

def test_nghi_viec_khoa_tai_khoan_chuyen_vai_tro_va_nguoi_duoi_quyen(client, org_sample):
    p = org_sample["people"]
    g = grant(p["tp_garage_kt"], "reviewer", org_sample["units"]["VCGARAGE-KT"])
    token, _ = auth.issue_api_token(p["tp_garage_kt"], "Claude")
    org.org_units.update_one({"_id": org_sample["units"]["VCGARAGE-KT"]["_id"]}, {"$set": {"head_id": p["tp_garage_kt"]["_id"]}})
    client.login(p["tp_garage_kt"])
    assert client.get("/api/org/me").status_code == 200
    leaver_cookie = client.cookies.get(auth.SESSION_COOKIE)

    a = admin_client(client)
    r = client.post(f"/api/org/users/{uid(org_sample, 'tp_garage_kt')}/offboard", json={"note": "Nghỉ việc 30/09"})
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["heir"]["name"] == "gd_garage"
    assert [x["role"] for x in res["grants_transferred"]] == ["reviewer"]
    assert [x["name"] for x in res["reports_moved"]] == ["ks_garage_kt"]
    assert [u["code"] for u in res["units_head_cleared"]] == ["VCGARAGE-KT"]

    leaver = reload(p["tp_garage_kt"])
    assert leaver["active"] is False and org.user_org(leaver)["status"] == "left"
    assert org.user_org(leaver)["unit_ids"] == [org_sample["units"]["VCGARAGE-KT"]["_id"]]      # giữ lịch sử
    assert auth.sessions.count_documents({"user_id": leaver["_id"]}) == 0
    assert auth.user_from_api_token(token) is None
    client.cookies.set(auth.SESSION_COOKIE, leaver_cookie)
    assert client.get("/api/org/me").status_code == 401
    # Vai trò: cũ hết hạn (không xoá), quản lý nhận vai trò cùng phạm vi
    assert org.grants.find_one({"_id": g["_id"]})["revoked_reason"] == "offboard"
    got = org.active_grants(p["gd_garage"], "reviewer")
    assert len(got) == 1 and got[0]["scope"]["unit_id"] == org_sample["units"]["VCGARAGE-KT"]["_id"]
    assert got[0]["transferred_from"] == g["_id"]
    # Người dưới quyền trực tiếp chuyển sang quản lý của người nghỉ
    assert org.user_org(reload(p["ks_garage_kt"]))["manager_id"] == p["gd_garage"]["_id"]
    # Không còn tính vào đơn vị
    client.login(a)
    kt = next(c for c in client.get("/api/org/units").json() if c["code"] == "VCGARAGE-KT")
    assert kt["member_count"] == 2
    assert client.post(f"/api/org/users/{uid(org_sample, 'tp_garage_kt')}/offboard").status_code == 409


def test_nghi_viec_khong_tu_xu_ly_minh_va_chi_quan_tri(client, org_sample):
    a = admin_client(client)
    assert client.post(f"/api/org/users/{a['_id']}/offboard").status_code == 400
    client.login(org_sample["people"]["tgd"])
    assert client.post(f"/api/org/users/{uid(org_sample, 'nv_part_kd')}/offboard").status_code == 403


def test_khoa_tai_khoan_o_man_quan_tri_van_thu_hoi_phien_va_token(client):
    a = admin_client(client)
    u = make_user("bi_khoa")
    token, _ = auth.issue_api_token(u, "AI")
    auth.sessions.insert_one({"_id": "phien-x", "user_id": u["_id"], "created_at": db.now(),
                              "expires_at": db.now() + timedelta(days=1)})
    assert client.patch(f"/api/users/{u['_id']}", json={"active": False}).status_code == 200
    assert auth.sessions.count_documents({"user_id": u["_id"]}) == 0 and auth.user_from_api_token(token) is None
    assert a["role"] == "admin"


@pytest.mark.parametrize("path", ["/api/org/tree", "/api/org/units", "/api/org/functions"])
def test_doc_can_dang_nhap(client, path):
    assert client.get(path).status_code == 401
