#!/usr/bin/env python3
"""Dựng môi trường kiểm thử tay (UAT) cho Claude in Chrome — docs/test-claude-extension/.

Tạo database riêng `tiktok_to_text_uat` (không bao giờ đụng DB thật) gồm: tài khoản theo từng vai trò (cùng một mật
khẩu), cây tổ chức, vai trò chức năng, cây lĩnh vực v2 + chủ nhánh, 3 kho, thẻ VCWIKI đã duyệt / nháp, câu hỏi, bài
học, một lộ trình đã giao, video mẫu. Dữ liệu đi qua API thật (TestClient) ở chỗ có thể, để đúng luật như khi bấm.

Chạy:  cd backend && ../.venv/bin/python scripts/seed_uat.py --reset     # xoá sạch DB UAT rồi dựng lại
       bash start_uat.sh                                                   # BE :8400 + FE http://127.0.0.1:5400

Chạy lại không có --reset: dừng nếu DB đã có dữ liệu (tránh dựng chồng).
"""

from __future__ import annotations

import os
import secrets
import sys
from datetime import timedelta
from pathlib import Path

DB_NAME = os.environ.setdefault("MONGO_DB", "tiktok_to_text_uat")
if not DB_NAME.endswith("_uat"):
    sys.exit(f"Từ chối: MONGO_DB={DB_NAME} — script chỉ ghi vào database có đuôi _uat")
ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("RAW_DIR", str(ROOT / "output" / "uat" / "raw"))
os.environ.setdefault("MEDIA_DIR", str(ROOT / "output" / "uat" / "media"))
os.environ.setdefault("TTS_DIR", str(ROOT / "output" / "uat" / "tts"))
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["LOCAL_LLM_URL"] = "http://127.0.0.1:1"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app import auth, categories, db, org, spaces, tree_v2  # noqa: E402
from app.kb import changes as kb_changes, revisions  # noqa: E402
from app.kb.pipeline import card_search_text, cards  # noqa: E402
from app.learn import models as learn_models  # noqa: E402

PASSWORD = "Test@12345"

# [khoá, email, họ tên, chức danh, mã đơn vị, người quản lý, chức năng, cấp bậc, vai trò hệ thống]
PEOPLE = [
    ("admin", "admin@uat.test", "Quản trị UAT", "Quản trị hệ thống", "VCPV", None, None, None, "admin"),
    ("tgd", "tgd@uat.test", "Trần Tổng Giám", "Tổng giám đốc", "VCPV", None, None, 7, "member"),
    ("gd_garage", "gd.garage@uat.test", "Lê Giám Đốc Garage", "Giám đốc VCgarage", "VCGARAGE", "tgd", "tech", 6,
     "member"),
    ("tp_kt", "tp.kt@uat.test", "Phạm Trưởng Phòng KT", "Trưởng phòng Kỹ thuật", "VCGARAGE-KT", "gd_garage", "tech", 5,
     "member"),
    ("ks_kt", "ks.kt@uat.test", "Hoàng Key Staff KT", "KTV chính", "VCGARAGE-KT", "tp_kt", "tech", 3, "member"),
    ("nv_kt", "nv.kt@uat.test", "Vũ Nhân Viên KT", "Kỹ thuật viên", "VCGARAGE-KT", "ks_kt", "tech", 2, "member"),
    ("tts_kt", "tts.kt@uat.test", "Đỗ Thực Tập KT", "Thực tập sinh kỹ thuật", "VCGARAGE-KT", "ks_kt", "tech", 1,
     "member"),
    ("gd_part", "gd.part@uat.test", "Ngô Giám Đốc Part", "Giám đốc VCpart", "VCPART", "tgd", "sales", 6, "member"),
    ("tp_kd", "tp.kd@uat.test", "Bùi Trưởng Phòng KD", "Trưởng phòng Kinh doanh", "VCPART-KD", "gd_part", "sales", 5,
     "member"),
    ("nv_kd", "nv.kd@uat.test", "Đặng Nhân Viên KD", "Nhân viên kinh doanh", "VCPART-KD", "tp_kd", "sales", 2,
     "member"),
    ("hr_lnd", "hr.lnd@uat.test", "Mai Đào Tạo", "Chuyên viên L&D", "TD-HR", "tgd", "hr", 4, "member"),
    ("auditor", "auditor@uat.test", "Lý Kiểm Toán", "Kiểm soát nội bộ", "TD-HR", "tgd", "hr", 4, "member"),
    ("outsider", "outsider@uat.test", "Tạ Người Ngoài", "Nhân viên (không thuộc kho nào)", "TD-HR", "hr_lnd", "hr", 2,
     "member"),
]

UNITS = [  # mã, tên, loại, mã cha, chức năng
    ("VCPV", "Tập đoàn VC Phồn Vinh", "group", None, None),
    ("TD-HR", "Nhân sự tập đoàn", "department", "VCPV", "hr"),
    ("VCGARAGE", "VCgarage", "division", "VCPV", None),
    ("VCGARAGE-KT", "Phòng Kỹ thuật VCgarage", "department", "VCGARAGE", "tech"),
    ("VCPART", "VCpart", "division", "VCPV", None),
    ("VCPART-KD", "Phòng Kinh doanh VCpart", "department", "VCPART", "sales"),
]

FUNCTIONS = [("tech", "Kỹ thuật", "nen"), ("sales", "Kinh doanh", "bh"), ("marketing", "Marketing", "mkt"),
             ("hr", "Nhân sự", None)]


def ensure_indexes() -> None:
    """Giống phần không chạy nền của lifespan (app/main.py)."""
    from app import chat, devreq
    from app.kb import graph, pipeline, playlists, social, synth
    from app import studio

    db.ensure_indexes()
    auth.ensure_indexes()
    spaces.ensure_indexes()
    categories.ensure_indexes()
    categories.seed_defaults()
    pipeline.ensure_indexes()
    synth.ensure_indexes()
    social.ensure_indexes()
    playlists.ensure_indexes()
    graph.ensure_indexes()
    chat.ensure_indexes()
    devreq.ensure_indexes()
    studio.ensure_indexes()
    org.ensure_indexes()
    revisions.ensure_indexes()
    kb_changes.ensure_indexes()
    learn_models.ensure_indexes()
    db.db["meta"].update_one({"_id": "gov_revisions_v1"}, {"$set": {"done": True}}, upsert=True)


class Api:
    """TestClient đăng nhập lần lượt từng người (gắn cookie phiên), báo lỗi rõ khi API từ chối."""

    def __init__(self):
        from app.main import app
        self.c = TestClient(app)

    def as_(self, user: dict) -> "Api":
        token = secrets.token_urlsafe(16)
        auth.sessions.insert_one({"_id": token, "user_id": user["_id"], "created_at": db.now(),
                                  "expires_at": db.now() + timedelta(hours=1)})
        self.c.cookies.set(auth.SESSION_COOKIE, token)
        return self

    def call(self, method: str, url: str, **kw) -> dict:
        r = self.c.request(method, url, **kw)
        if r.status_code >= 300:
            raise SystemExit(f"{method} {url} -> {r.status_code}: {r.text}")
        return r.json() if r.content else {}


def seed_org(p_ids: dict) -> dict:
    for code, name, root in FUNCTIONS:
        org.org_functions.insert_one({"code": code, "name": name, "active": True, "category_root": root})
    unit = {}
    for i, (code, name, kind, parent, fn) in enumerate(UNITS):
        par = unit.get(parent)
        doc = {"code": code, "name": name, "kind": kind, "parent_id": par["_id"] if par else None,
               "path": [*(par["path"] if par else []), *([par["_id"]] if par else [])], "function": fn,
               "head_id": None, "active": True, "order": i}
        doc["_id"] = org.org_units.insert_one(doc).inserted_id
        unit[code] = doc
    for key, _e, _n, position, ucode, mgr, fn, level, _r in PEOPLE:
        auth.users.update_one({"_id": p_ids[key]}, {"$set": {"org": {
            "unit_ids": [unit[ucode]["_id"]], "function": fn, "position": position,
            "manager_id": p_ids[mgr] if mgr else None, "functional_manager_id": None, "level": level,
            "status": "active"}}})
    heads = {"VCPV": "tgd", "VCGARAGE": "gd_garage", "VCGARAGE-KT": "tp_kt", "VCPART": "gd_part",
             "VCPART-KD": "tp_kd"}
    for code, key in heads.items():
        org.org_units.update_one({"_id": unit[code]["_id"]}, {"$set": {"head_id": p_ids[key]}})

    def grant(key, role, unit_code=None, category=None):
        org.grants.insert_one({"user_id": p_ids[key], "role": role,
                               "scope": {"unit_id": unit[unit_code]["_id"] if unit_code else None,
                                         "category": category, "function": None},
                               "delegated_from": None, "valid_from": None, "valid_to": None, "created_by": None,
                               "created_at": db.now()})
    grant("hr_lnd", "lnd", "VCGARAGE")
    grant("auditor", "auditor")
    grant("ks_kt", "reviewer", "VCGARAGE-KT", "nen.ky-thuat")
    grant("gd_garage", "category_owner", "VCGARAGE", "nen.ky-thuat")
    return unit


def seed_spaces(p: dict) -> dict:
    def space(name, desc, owner, members, visibility="private"):
        doc = {"name": name, "description": desc, "type": "shared", "owner_id": p[owner]["_id"],
               "visibility": visibility, "created_at": db.now(),
               "members": [{"user_id": p[owner]["_id"], "role": "owner", "added_at": db.now()}]
               + [{"user_id": p[k]["_id"], "role": r, "added_at": db.now()} for k, r in members]}
        doc["_id"] = spaces.spaces.insert_one(doc).inserted_id
        return doc
    return {
        "kt": space("Kho Kỹ thuật VCgarage", "Tri thức kỹ thuật xưởng — kho chính để test duyệt và học tập", "tp_kt",
                    [("ks_kt", "editor"), ("nv_kt", "editor"), ("tts_kt", "viewer")]),
        "kd": space("Kho Kinh doanh VCpart", "Tri thức bán hàng — người ngoài VCpart không được thấy", "tp_kd",
                    [("nv_kd", "editor")]),
        "pub": space("Kho Công khai VCPV", "Công khai trong công ty — mọi tài khoản đều xem được", "hr_lnd",
                     [], visibility="org"),
    }


def first_child(slug: str) -> str:
    c = categories.categories.find_one({"parent_slug": slug}, sort=[("order", 1)]) or \
        categories.categories.find_one({"slug": {"$regex": f"^{slug}\\.[^.]+$"}}, sort=[("order", 1)])
    return c["slug"] if c else slug


def approved(space: dict, author: dict, reviewers: list[dict], **fields) -> dict:
    """Thẻ đã duyệt kèm phiên bản 1 (như thẻ cũ được chuyển thành bản 1 — BA 16.5 quy tắc 4)."""
    now = db.now()
    doc = {"space_id": space["_id"], "type": "framework", "summary": "", "body": "", "key_points": [], "tags": [],
           "categories": [], "fields": {}, "when_to_use": "", "example": "", "evidence": [], "status": "approved",
           "origin": "manual", "created_by": author["_id"], "source_id": None, "document_id": None, "source": None,
           "created_at": now, "updated_at": now, "approved_at": now} | fields
    doc["search_text"] = card_search_text(doc)
    doc["_id"] = cards.insert_one(doc).inserted_id
    revisions.record_revision(doc, author["_id"], "Bản đầu (dữ liệu UAT)", approved_by=[r["_id"] for r in reviewers])
    return cards.find_one({"_id": doc["_id"]})


def seed_cards(p: dict, s: dict) -> dict:
    kt3 = first_child("nen.ky-thuat")                       # tầng 3 đầu tiên của Kỹ thuật ô tô
    obd = next((c["slug"] for c in categories.categories.find({"slug": {"$regex": r"^nen\.ky-thuat\.[^.]+$"}})
                if "chan-doan" in c["slug"]), kt3)
    rv = [p["ks_kt"], p["gd_garage"]]
    c = {}
    c["dtc"] = approved(s["kt"], p["nv_kt"], rv, type="concept", level="nhap-mon", division=["vcservice"],
                        title="Mã lỗi DTC là gì", categories=[obd], tags=["obd", "chan-doan"],
                        summary="DTC (Diagnostic Trouble Code) là mã lỗi 5 ký tự do ECU lưu khi phát hiện bất thường.",
                        body="Mã DTC gồm 5 ký tự: chữ cái đầu chỉ hệ thống (P động cơ – hộp số, B thân xe, C gầm, "
                             "U mạng giao tiếp); số thứ hai 0 là mã chuẩn SAE, 1 là mã riêng hãng; ba số cuối chỉ lỗi "
                             "cụ thể. Ví dụ P0300: bỏ máy ngẫu nhiên nhiều xi-lanh.",
                        key_points=["P = Powertrain, B = Body, C = Chassis, U = Network",
                                    "Số thứ hai: 0 chuẩn SAE, 1 riêng hãng", "P0300 = bỏ máy ngẫu nhiên"])
    c["obd_sop"] = approved(s["kt"], p["nv_kt"], rv, type="sop", level="thuc-thi", division=["vcservice"],
                            title="Quy trình đọc lỗi bằng máy chẩn đoán OBD", categories=[obd], tags=["obd"],
                            summary="5 bước đọc và xử lý mã lỗi bằng máy chẩn đoán OBD-II tại xưởng.",
                            body="1. Tắt máy, cắm đầu đọc vào cổng OBD dưới taplo.\n2. Bật khoá ON, không nổ máy.\n"
                                 "3. Đọc mã lỗi và dữ liệu đóng băng (freeze frame).\n4. Ghi mã vào phiếu, tra "
                                 "nguyên nhân theo tài liệu hãng.\n5. Sửa xong mới xoá lỗi, chạy thử và đọc lại.",
                            key_points=["Không xoá lỗi trước khi sửa", "Luôn lưu freeze frame"], process_steps=[])
    c["bd10k"] = approved(s["kt"], p["ks_kt"], [p["tp_kt"], p["gd_garage"]], type="checklist", level="thuc-thi",
                          division=["vcservice"], title="Checklist bảo dưỡng cấp 10.000 km", categories=[kt3],
                          tags=["bao-duong"], summary="Các hạng mục bắt buộc kiểm tra ở mốc 10.000 km.",
                          body="- Thay dầu máy + lọc dầu\n- Kiểm tra lọc gió động cơ\n- Kiểm tra má phanh\n"
                               "- Đảo lốp, kiểm tra áp suất\n- Kiểm tra nước làm mát, dầu phanh")
    c["hybrid"] = approved(s["kt"], p["ks_kt"], [p["tp_kt"], p["gd_garage"]], type="case_study", level="van-hanh",
                           division=["vcservice"], title="Case: xe hybrid báo lỗi hệ thống, không vào READY",
                           categories=[kt3], tags=["hybrid"],
                           summary="Xe hybrid không vào READY do ắc quy 12V yếu, không phải lỗi pin cao áp.",
                           body="Khách báo xe không vào READY, đèn lỗi hệ thống hybrid. KTV kiểm tra pin cao áp trước "
                                "mất 2 giờ. Nguyên nhân thật: ắc quy 12V còn 10,9V. Bài học: kiểm tra ắc quy 12V "
                                "trước tiên với mọi lỗi khởi động xe hybrid.")
    c["kpi"] = approved(s["kt"], p["tp_kt"], [p["ks_kt"], p["admin"]], type="kpi", level="van-hanh",
                        division=["vcservice"], title="KPI năng suất kỹ thuật viên", categories=["nen.garage"],
                        tags=["kpi"], summary="Năng suất KTV = giờ công tính tiền / giờ có mặt.",
                        body="Công thức: giờ công tính tiền cho khách ÷ giờ KTV có mặt tại xưởng × 100%. Nguồn số: "
                             "phiếu sửa chữa + chấm công. Tần suất: tuần. Ngưỡng tốt ≥ 80%.")
    c["chien_luoc"] = approved(s["kt"], p["tp_kt"], [p["ks_kt"], p["admin"]], type="framework", level="thiet-ke",
                               division=["vcservice"], title="Khung mở rộng chuỗi xưởng dịch vụ",
                               categories=["nen.garage"], tags=["chien-luoc"],
                               summary="Ba điều kiện trước khi mở thêm một xưởng: công suất, nhân sự, dòng tiền.",
                               body="Chỉ mở xưởng mới khi: (1) xưởng hiện tại chạy ≥ 85% công suất 6 tháng liền; "
                                    "(2) có sẵn trưởng xưởng đã đào tạo; (3) dòng tiền đủ 12 tháng vận hành.")
    # thẻ có 2 phiên bản — để test Lịch sử / so sánh / quay về
    c["phanh"] = approved(s["kt"], p["nv_kt"], rv, type="lesson", level="thuc-thi", division=["vcservice"],
                          title="Thay má phanh: siết đúng lực", categories=[kt3], tags=["phanh"],
                          summary="Siết bu-lông cùm phanh theo lực hãng quy định.",
                          body="Siết bu-lông cùm phanh 30 N·m.")
    new = {"body": "Siết bu-lông cùm phanh theo lực hãng quy định (thường 25–35 N·m), dùng cờ-lê lực.",
           "updated_at": db.now()}
    cards.update_one({"_id": c["phanh"]["_id"]}, {"$set": new})
    revisions.record_revision(cards.find_one({"_id": c["phanh"]["_id"]}), p["nv_kt"]["_id"],
                              "Sửa lực siết theo tài liệu hãng", approved_by=[p["ks_kt"]["_id"], p["gd_garage"]["_id"]],
                              change_kind="major")
    # kho KD VCpart — người ngoài VCpart không được thấy
    c["b2b"] = approved(s["kd"], p["nv_kd"], [p["tp_kd"], p["admin"]], type="framework", level="thuc-thi",
                        division=["vcpart"], title="Quy trình chốt đơn đại lý B2B", categories=["bh.ky-nang-b2b"],
                        tags=["b2b"], summary="4 bước chốt đơn với đại lý phụ tùng.",
                        body="1. Hỏi nhu cầu tồn kho.\n2. Đề xuất gói hàng theo mùa.\n3. Chốt chiết khấu theo "
                             "bậc.\n4. Hẹn lịch giao.")
    c["gia"] = approved(s["kd"], p["tp_kd"], [p["nv_kd"], p["admin"]], type="regulation", level="van-hanh",
                        division=["vcpart"], title="Chính sách chiết khấu đại lý 2026 (MẬT KINH DOANH)",
                        categories=["bh.gia-dam-phan"], tags=["chiet-khau"],
                        summary="Bậc chiết khấu theo doanh số quý.", body="Bậc 1: 5% · Bậc 2: 8% · Bậc 3: 12%.")
    # kho công khai
    c["noi_quy"] = approved(s["pub"], p["hr_lnd"], [p["tgd"], p["admin"]], type="regulation", level="nhap-mon",
                            division=["tap-doan"], title="Nội quy an toàn xưởng cho nhân sự mới",
                            categories=["nen.garage"], tags=["an-toan"],
                            summary="5 quy định an toàn bắt buộc khi vào xưởng.",
                            body="Mang giày bảo hộ; không đứng dưới xe đang nâng khi chưa khoá chốt; không hút "
                                 "thuốc; dụng cụ trả về đúng chỗ; báo ngay khi có tai nạn.")
    return c


def seed_drafts(api: Api, p: dict, s: dict, c: dict) -> None:
    """Thẻ nháp tạo qua API (đúng luật tạo thẻ)."""
    kt = str(s["kt"]["_id"])
    api.as_(p["nv_kt"]).call("POST", "/api/wiki/cards", json={
        "space_id": kt, "type": "sop", "title": "[NHÁP] Quy trình kiểm tra hệ thống làm mát",
        "summary": "Các bước kiểm tra rò rỉ và áp suất hệ thống làm mát.",
        "body": "1. Để máy nguội.\n2. Kiểm tra mức nước.\n3. Bơm áp kiểm tra rò rỉ 1,1 bar trong 10 phút.",
        "categories": c["obd_sop"]["categories"], "tags": ["lam-mat"], "level": "thuc-thi", "division": ["vcservice"]})
    api.as_(p["ks_kt"]).call("POST", "/api/wiki/cards", json={
        "space_id": kt, "type": "insight", "title": "[NHÁP] Khách gara ưu tiên báo giá rõ trước khi sửa",
        "summary": "Khách quay lại nhiều hơn khi được báo giá chi tiết trước.",
        "body": "Quan sát 3 tháng: xưởng gửi báo giá từng hạng mục qua Zalo trước khi sửa có tỷ lệ khách quay lại "
                "cao hơn.", "categories": ["nen.garage"], "tags": ["cskh"], "level": "van-hanh"})


def seed_learning(api: Api, p: dict, s: dict, c: dict) -> None:
    kt = str(s["kt"]["_id"])
    a = api.as_(p["ks_kt"])
    qids = []

    def q(card, **body):
        r = a.call("POST", "/api/learn/questions", json={"card_ids": [str(c[card]["_id"])], "space_id": kt} | body)
        a.call("PATCH", f"/api/learn/questions/{r['id']}", json={"status": "approved"})
        qids.append(r["id"])
        return r["id"]
    q("dtc", kind="single", stem="Chữ cái P ở đầu mã lỗi DTC chỉ hệ thống nào?", difficulty=1, bloom="remember",
      options=[{"text": "Động cơ – hộp số (Powertrain)", "correct": True}, {"text": "Thân xe"}, {"text": "Gầm xe"},
               {"text": "Mạng giao tiếp"}], explanation="P = Powertrain (thẻ Mã lỗi DTC là gì).")
    q("dtc", kind="single", stem="Mã P0300 nghĩa là gì?", difficulty=2, bloom="understand",
      options=[{"text": "Bỏ máy ngẫu nhiên nhiều xi-lanh", "correct": True}, {"text": "Hỏng cảm biến oxy"},
               {"text": "Ắc quy yếu"}], explanation="P0300 = misfire ngẫu nhiên.")
    q("dtc", kind="single", stem="Số thứ hai của mã DTC là 1 nghĩa là gì?", difficulty=2, bloom="remember",
      options=[{"text": "Mã riêng của hãng", "correct": True}, {"text": "Mã chuẩn SAE"},
               {"text": "Lỗi nghiêm trọng"}], explanation="0 chuẩn SAE, 1 riêng hãng.")
    q("obd_sop", kind="multi", stem="Những việc nào ĐÚNG khi đọc lỗi OBD?", difficulty=3, bloom="apply",
      options=[{"text": "Lưu dữ liệu freeze frame", "correct": True},
               {"text": "Sửa xong mới xoá lỗi", "correct": True}, {"text": "Xoá lỗi ngay khi đọc được"},
               {"text": "Nổ máy trước khi cắm đầu đọc"}], explanation="Theo quy trình 5 bước.")
    q("obd_sop", kind="single", stem="Bước đầu tiên của quy trình đọc lỗi OBD?", difficulty=1, bloom="remember",
      options=[{"text": "Tắt máy, cắm đầu đọc vào cổng OBD", "correct": True}, {"text": "Xoá lỗi"},
               {"text": "Chạy thử xe"}])
    q("hybrid", kind="essay", stem="Xe hybrid của khách không vào READY. Bạn kiểm tra gì đầu tiên, vì sao?",
      difficulty=3, bloom="analyze", model_answer="Kiểm tra ắc quy 12V trước, vì ắc quy 12V yếu là nguyên nhân phổ "
      "biến và kiểm tra nhanh; tránh mất thời gian vào pin cao áp.",
      rubric=[{"criterion": "Nêu đúng: kiểm tra ắc quy 12V trước", "max": 6, "descriptor": "Nêu rõ ắc quy 12V"},
              {"criterion": "Giải thích lý do", "max": 4, "descriptor": "Nhanh, phổ biến, tránh tốn thời gian"}])

    lesson = a.call("POST", "/api/learn/lessons", json={
        "title": "Bài 1 — Đọc mã lỗi OBD", "space_id": kt,
        "objectives": ["Hiểu cấu trúc mã DTC", "Làm đúng quy trình đọc lỗi"],
        "narrative": "Bài mở đầu cho KTV mới: đọc hiểu mã lỗi và quy trình đọc lỗi tại xưởng.",
        "items": [{"card_id": str(c["dtc"]["_id"])}, {"card_id": str(c["obd_sop"]["_id"])}],
        "practice_question_ids": qids[:3]})
    a.call("PATCH", f"/api/learn/lessons/{lesson['id']}", json={"status": "published"})
    lesson2 = a.call("POST", "/api/learn/lessons", json={
        "title": "Bài 2 — Case hybrid không vào READY", "space_id": kt,
        "objectives": ["Biết thứ tự kiểm tra lỗi khởi động xe hybrid"], "narrative": "Đọc case và trả lời.",
        "items": [{"card_id": str(c["hybrid"]["_id"])}], "practice_question_ids": []})
    a.call("PATCH", f"/api/learn/lessons/{lesson2['id']}", json={"status": "published"})

    now = db.now()
    month = now.month % 12 + 1
    year = now.year + (1 if now.month == 12 else 0)
    path = a.call("POST", "/api/learn/paths", json={
        "title": "[MẪU] Lộ trình KTV mới — OBD cơ bản", "description": "Lộ trình dựng sẵn để test phía người học.",
        "period": "month", "year": year, "month": month,
        "modules": [{"week": 1, "title": "Mã lỗi", "lesson_ids": [lesson["id"]]},
                    {"week": 2, "title": "Tình huống", "lesson_ids": [lesson2["id"]]}],
        "required_items": [lesson["id"]],
        "exam": {"blueprint": [{"category": "nen.ky-thuat", "kind": "single", "count": 3}], "duration_min": 10,
                 "pass_score": 70, "attempts": 1}})
    a.call("POST", f"/api/learn/paths/{path['id']}/publish")
    a.call("POST", f"/api/learn/paths/{path['id']}/assign",
           json={"learner_ids": [str(p["nv_kt"]["_id"]), str(p["tts_kt"]["_id"])]})


def seed_videos() -> None:
    now = db.now()

    def v(vid, handle, caption, transcript, views, status, posted):
        from datetime import datetime
        return {"_id": vid, "url": f"https://www.tiktok.com/@{handle}/video/{vid}", "channel_handle": handle,
                "channel_name": handle.upper(), "posted_at": datetime.fromisoformat(posted), "duration": 60,
                "views": views, "likes": views // 10, "comments": 5, "shares": 2, "caption": caption,
                "transcript": transcript, "status": status,
                "error": "Không tải được video" if status == "error" else None,
                "chars_per_sec": round(len(transcript) / 60, 1) if transcript else None,
                "segments": [{"start": 0, "end": 5, "text": transcript[:40]}] if transcript else [], "tags": [],
                "note": "", "edited": False, "created_at": now, "updated_at": now, "transcribed_at": now,
                "engine": "mlx", "model": "uat",
                "search_text": db.build_search_text({"transcript": transcript, "caption": caption})}
    db.db["videos"].insert_many([
        v("7100000000000000001", "garage_tips", "Mẹo đọc lỗi OBD", "Hôm nay mình hướng dẫn đọc mã lỗi P0300 bằng máy "
          "chẩn đoán", 150000, "ok", "2026-09-01"),
        v("7100000000000000002", "garage_tips", "Nhạc nền chill", "", 42000, "no_speech", "2026-09-05"),
        v("7100000000000000003", "phutung_pro", "Review phụ tùng", "Phụ tùng chính hãng giúp xe bền hơn và tiết kiệm "
          "chi phí", 980000, "ok", "2026-09-10"),
        v("7100000000000000004", "phutung_pro", "Video bị lỗi", "", 0, "error", "2026-09-12"),
    ])


def main() -> int:
    import logging
    logging.disable(logging.INFO)                         # bỏ log từng request của TestClient
    reset = "--reset" in sys.argv
    names = db.client.list_database_names()
    if DB_NAME in names and db.db["users"].estimated_document_count():
        if not reset:
            print(f"Database {DB_NAME} đã có dữ liệu — thêm --reset để xoá và dựng lại")
            return 1
    db.client.drop_database(DB_NAME)
    ensure_indexes()

    # cây lĩnh vực v2 + chủ nhánh tầng 2
    tree_v2.seed(apply=True)
    p = {}
    for key, email, name, *_rest, role in PEOPLE:
        p[key] = auth.create_user(email, name, PASSWORD, role)
    ids = {k: u["_id"] for k, u in p.items()}
    categories.categories.update_one({"slug": "nen.ky-thuat"}, {"$set": {"owner_id": ids["gd_garage"]}})
    categories.categories.update_one({"slug": "bh.ky-nang-b2b"}, {"$set": {"owner_id": ids["gd_part"]}})
    seed_org(ids)
    p = {k: auth.users.find_one({"_id": i}) for k, i in ids.items()}
    s = seed_spaces(p)
    c = seed_cards(p, s)
    api = Api()
    seed_drafts(api, p, s, c)
    seed_learning(api, p, s, c)
    seed_videos()
    auth.sessions.delete_many({})                         # bỏ phiên của script, người test tự đăng nhập

    print(f"Đã dựng database {DB_NAME}. Mật khẩu mọi tài khoản: {PASSWORD}")
    for key, email, name, position, ucode, *_ in PEOPLE:
        print(f"  {email:<22} {name:<22} {position} ({ucode})")
    print(f"Thẻ: {cards.count_documents({})} · Lộ trình mẫu đã giao cho nv.kt, tts.kt")
    print("Chạy: bash start_uat.sh  -> mở http://127.0.0.1:5400")
    return 0


if __name__ == "__main__":
    sys.exit(main())
