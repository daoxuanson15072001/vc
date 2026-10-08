"""SYS-35 — chia sẻ kho theo đơn vị (docs/BA.md SYS-35, DESIGN SCR-19.1).

Chủ kho (và quản trị viên) cấp quyền Xem / Sửa cho một đơn vị ORG, tuỳ chọn gồm đơn vị con. Quyền tính lại ở mỗi lần
truy cập theo đơn vị hiện tại của người dùng; vừa mời riêng vừa qua đơn vị thì lấy quyền cao hơn; quyền Quản lý không
cấp theo đơn vị; người không có quyền nhận "không tìm thấy" (mục 6.2).
"""

from __future__ import annotations

import pytest
from bson import ObjectId

from app import db, policy
from app.auth import users
from app.spaces import spaces
from tests.conftest import make_user, set_org

SECRET = "Bí quyết chẩn đoán hộp số"


def fresh(user: dict) -> dict:
    return users.find_one({"_id": user["_id"]})


@pytest.fixture
def kho(client, org_sample):
    """Kho riêng của gd_part (VCPART) có một nguồn + tài liệu + thẻ."""
    u, p = org_sample["units"], org_sample["people"]
    owner = p["gd_part"]
    client.login(owner)
    r = client.post("/api/spaces", json={"name": "Kho kỹ thuật chung"})
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    r = client.post("/api/kb/sources/links", json={"space_id": sid, "urls": ["https://example.com/bi-quyet"]})
    assert r.status_code == 201, r.text
    src_id = r.json()["created"][0]
    doc = {"source_id": ObjectId(src_id), "space_id": ObjectId(sid), "title": f"{SECRET} — tài liệu", "text": SECRET,
           "wiki_status": "pending", "chars": len(SECRET), "created_at": db.now()}
    doc_id = str(db.db["kb_documents"].insert_one(doc).inserted_id)
    r = client.post("/api/wiki/cards", json={"space_id": sid, "type": "concept", "title": f"{SECRET} — thẻ",
                                             "summary": SECRET})
    assert r.status_code == 201, r.text
    return {"units": u, "people": p, "owner": owner, "sid": sid, "source": src_id, "doc": doc_id,
            "card": r.json()["id"]}


def share(client, k, unit: str, role: str = "viewer", children: bool = False, who: dict | None = None):
    client.login(who or k["owner"])
    return client.post(f"/api/spaces/{k['sid']}/units",
                       json={"unit_id": str(k["units"][unit]["_id"]), "role": role, "include_children": children})


def sees(client, user: dict, k) -> bool:
    """Người này thấy kho + dữ liệu trong kho qua mọi đường (kho, danh sách kho, thẻ, nguồn, tài liệu, tìm kiếm)."""
    client.login(user)
    one = client.get(f"/api/spaces/{k['sid']}").status_code
    listed = k["sid"] in {s["id"] for s in client.get("/api/spaces").json()}
    card = client.get(f"/api/wiki/cards/{k['card']}").status_code
    source = client.get(f"/api/kb/sources/{k['source']}").status_code
    document = client.get(f"/api/kb/documents/{k['doc']}").status_code
    found = k["card"] in {c["id"] for c in client.get("/api/wiki/cards", params={"q": "chan doan hop so"}).json()["items"]}
    in_sources = k["source"] in {s["id"] for s in client.get("/api/kb/sources").json()["items"]}
    got = (one == 200, listed, card == 200, source == 200, document == 200, found, in_sources)
    assert len(set(got)) == 1, f"các đường không nhất quán: {got}"
    if not got[0]:
        assert (one, card, source, document) == (404, 404, 404, 404)   # không lộ sự tồn tại
    return got[0]


def edits(client, user: dict, k) -> int:
    client.login(user)
    return client.patch(f"/api/wiki/cards/{k['card']}", json={"title": f"{SECRET} — sửa"}).status_code


# ---------------------------------------------------------------------------
# Thấy / sửa theo quyền đơn vị
# ---------------------------------------------------------------------------

def test_unit_members_see_by_role_outsiders_do_not(client, kho):
    p = kho["people"]
    assert not sees(client, p["nv_part_kd"], kho)
    r = share(client, kho, "VCPART-KD", "viewer")
    assert r.status_code == 201, r.text
    row = r.json()[0]
    assert (row["unit_name"], row["role"], row["include_children"], row["member_count"]) == \
        ("Phòng Kinh doanh VCpart", "viewer", False, 2)
    assert row["granted_by"]["name"] == "gd_part"
    for who in ("tp_part_kd", "nv_part_kd"):
        assert sees(client, p[who], kho)
        assert edits(client, p[who], kho) == 403            # Xem: xem được, sửa bị từ chối
    client.login(p["nv_part_kd"])
    assert client.get(f"/api/spaces/{kho['sid']}").json()["my_role"] == "viewer"
    for who in ("nv_part_mkt", "tp_garage_kt", "gd_mkt"):  # ngoài đơn vị
        assert not sees(client, p[who], kho)
        assert edits(client, p[who], kho) == 404
    # đổi sang Sửa
    client.login(kho["owner"])
    r = client.patch(f"/api/spaces/{kho['sid']}/units/{kho['units']['VCPART-KD']['_id']}", json={"role": "editor"})
    assert r.status_code == 200 and r.json()[0]["role"] == "editor"
    assert edits(client, p["nv_part_kd"], kho) == 200


def test_include_children(client, kho):
    p = kho["people"]
    assert share(client, kho, "VCPART", "viewer").status_code == 201
    assert sees(client, p["gd_part"], kho)                       # chủ kho
    assert not sees(client, p["nv_part_kd"], kho)               # đơn vị con: chưa gồm
    client.login(kho["owner"])
    r = client.patch(f"/api/spaces/{kho['sid']}/units/{kho['units']['VCPART']['_id']}", json={"include_children": True})
    assert r.status_code == 200
    assert r.json()[0]["member_count"] == 5                     # gd_part + 2 KD + 2 MKT
    for who in ("nv_part_kd", "tp_part_mkt", "nv_part_mkt"):
        assert sees(client, p[who], kho)
    assert not sees(client, p["tp_garage_kt"], kho)            # division khác
    assert not sees(client, p["tgd"], kho)                     # đơn vị cha không được tính


def test_higher_of_personal_invite_and_unit(client, kho):
    p = kho["people"]
    client.login(kho["owner"])
    r = client.post(f"/api/spaces/{kho['sid']}/members", json={"email": "nv_part_kd@test.local", "role": "viewer"})
    assert r.status_code == 200, r.text
    assert edits(client, p["nv_part_kd"], kho) == 403
    assert share(client, kho, "VCPART-KD", "editor").status_code == 201
    assert edits(client, p["nv_part_kd"], kho) == 200            # đơn vị cao hơn
    # ngược lại: mời riêng Sửa, đơn vị chỉ Xem -> vẫn Sửa
    client.login(kho["owner"])
    client.patch(f"/api/spaces/{kho['sid']}/units/{kho['units']['VCPART-KD']['_id']}", json={"role": "viewer"})
    client.patch(f"/api/spaces/{kho['sid']}/members/{p['nv_part_kd']['_id']}", json={"role": "editor"})
    assert edits(client, p["nv_part_kd"], kho) == 200
    assert policy.space_role(fresh(p["nv_part_kd"]), spaces.find_one({"_id": ObjectId(kho["sid"])})) == "editor"


def test_moving_unit_gains_and_loses_access(client, kho):
    p, u = kho["people"], kho["units"]
    assert share(client, kho, "VCPART-KD", "viewer").status_code == 201
    assert sees(client, p["nv_part_kd"], kho)
    set_org(p["nv_part_kd"], [u["VCGARAGE-KD"]["_id"]])          # chuyển đơn vị -> mất quyền
    assert not sees(client, p["nv_part_kd"], kho)
    set_org(p["tp_garage_kt"], [u["VCPART-KD"]["_id"]])          # vào đơn vị -> tự có quyền
    assert sees(client, p["tp_garage_kt"], kho)
    # người đã nghỉ không còn quyền qua đơn vị
    users.update_one({"_id": p["tp_garage_kt"]["_id"]}, {"$set": {"org.status": "left"}})
    assert not sees(client, p["tp_garage_kt"], kho)


def test_remove_unit_revokes_immediately(client, kho):
    p = kho["people"]
    assert share(client, kho, "VCPART-KD", "editor").status_code == 201
    assert edits(client, p["nv_part_kd"], kho) == 200
    client.login(kho["owner"])
    r = client.delete(f"/api/spaces/{kho['sid']}/units/{kho['units']['VCPART-KD']['_id']}")
    assert r.status_code == 200 and r.json() == []
    assert not sees(client, p["nv_part_kd"], kho)
    assert edits(client, p["nv_part_kd"], kho) == 404
    # gỡ lần nữa -> 404
    client.login(kho["owner"])
    assert client.delete(f"/api/spaces/{kho['sid']}/units/{kho['units']['VCPART-KD']['_id']}").status_code == 404


# ---------------------------------------------------------------------------
# Ai được cấp, cấp gì
# ---------------------------------------------------------------------------

def test_only_owner_or_admin_can_share(client, kho):
    p, u = kho["people"], kho["units"]
    # người ngoài kho -> 404 (không lộ kho)
    assert share(client, kho, "VCPART-KD", who=p["tp_garage_kt"]).status_code == 404
    client.login(p["tp_garage_kt"])
    assert client.get(f"/api/spaces/{kho['sid']}/units").status_code == 404
    # người Sửa qua đơn vị: xem được kho nhưng không cấp được -> 403
    assert share(client, kho, "VCPART-KD", "editor").status_code == 201
    r = share(client, kho, "VCGARAGE", who=p["nv_part_kd"])
    assert r.status_code == 403
    client.login(p["nv_part_kd"])
    assert client.delete(f"/api/spaces/{kho['sid']}/units/{u['VCPART-KD']['_id']}").status_code == 403
    assert client.get(f"/api/spaces/{kho['sid']}").json()["can_share_units"] is False
    # quản trị viên cấp được, nhưng không vì thế mà đọc được nội dung kho (ORG-13)
    admin = make_user("quan_tri", role="admin")
    r = share(client, kho, "VCGARAGE-KT", who=admin)
    assert r.status_code == 201, r.text
    assert {x["unit_code"] for x in r.json()} == {"VCPART-KD", "VCGARAGE-KT"}
    assert client.get(f"/api/spaces/{kho['sid']}/units").status_code == 200
    assert client.get(f"/api/spaces/{kho['sid']}").status_code == 404
    assert client.get(f"/api/wiki/cards/{kho['card']}").status_code == 404
    assert sees(client, p["ks_garage_kt"], kho)


def test_owner_role_not_grantable_and_validation(client, kho):
    r = share(client, kho, "VCPART-KD", "owner")
    assert r.status_code == 422
    assert share(client, kho, "VCPART-KD", "viewer").status_code == 201
    assert share(client, kho, "VCPART-KD", "editor").status_code == 409     # đã chia sẻ -> đổi ở hàng đơn vị
    client.login(kho["owner"])
    unit = kho["units"]["VCPART-KD"]["_id"]
    assert client.patch(f"/api/spaces/{kho['sid']}/units/{unit}", json={"role": "owner"}).status_code == 422
    assert client.post(f"/api/spaces/{kho['sid']}/units", json={"unit_id": "khong-phai-id"}).status_code == 404
    assert client.post(f"/api/spaces/{kho['sid']}/units", json={"unit_id": str(ObjectId())}).status_code == 404
    assert client.patch(f"/api/spaces/{kho['sid']}/units/{ObjectId()}", json={"role": "viewer"}).status_code == 404
    # kho không tồn tại / id sai -> 404
    assert client.get(f"/api/spaces/{ObjectId()}/units").status_code == 404
    assert client.get("/api/spaces/xyz/units").status_code == 404
    # đơn vị không bao giờ thành chủ kho
    nv = fresh(kho["people"]["nv_part_kd"])
    assert not policy.can(nv, "space.manage", spaces.find_one({"_id": ObjectId(kho["sid"])}))


def test_legacy_space_without_unit_grants(client, org_sample):
    """Bản ghi kho cũ không có `unit_grants` coi như [] — không cần chuyển dữ liệu."""
    p = org_sample["people"]
    doc = {"name": "Kho cũ", "description": "", "type": "shared", "owner_id": p["tgd"]["_id"],
           "visibility": "private", "created_at": db.now(),
           "members": [{"user_id": p["tgd"]["_id"], "role": "owner", "added_at": db.now()}]}
    sid = spaces.insert_one(doc).inserted_id
    client.login(p["tgd"])
    r = client.get(f"/api/spaces/{sid}")
    assert r.status_code == 200 and r.json()["unit_grants"] == [] and r.json()["can_share_units"] is True
    client.login(p["gd_part"])
    assert client.get(f"/api/spaces/{sid}").status_code == 404
    assert policy.space_role(p["gd_part"], doc) is None


def test_editable_space_ids_include_unit_editor(client, kho):
    p = kho["people"]
    assert share(client, kho, "VCPART-MKT", "editor").status_code == 201
    nv = fresh(p["nv_part_mkt"])
    assert ObjectId(kho["sid"]) in policy.editable_space_ids(nv)
    assert ObjectId(kho["sid"]) in policy.readable_space_ids(nv)
    tp = make_user("ngoai")
    assert ObjectId(kho["sid"]) not in policy.readable_space_ids(tp)
