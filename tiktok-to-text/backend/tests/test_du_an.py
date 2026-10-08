"""Dự án marketing (BA 5.13 — CE-25 dự án, CE-26 tài nguyên + thẻ ghim, CE-32 phân quyền hai lớp kho + dự án)."""

from __future__ import annotations

from bson import ObjectId

from app import db
from app.kb.pipeline import cards, documents
from app.spaces import spaces
from app.studio import campaigns, marketing_projects, quick_pieces

from .conftest import make_user


def _space(client, owner, name="Kho VCS"):
    client.login(owner)
    return client.post("/api/spaces", json={"name": name}).json()


def _add_space_member(space_id, user, role):
    spaces.update_one({"_id": ObjectId(space_id)}, {"$push": {"members": {"user_id": user["_id"], "role": role,
                                                                           "added_at": db.now()}}})


def _project(client, user, space_id, name="Marketing xưởng VCS"):
    client.login(user)
    r = client.post("/api/studio/projects", json={"space_id": space_id, "name": name, "goal": "Tăng khách sửa xe"})
    assert r.status_code == 201, r.text
    return r.json()


def _video(vid="7000000000000000001", handle="kenh_a"):
    now = db.now()
    db.videos.insert_one({"_id": vid, "url": f"https://www.tiktok.com/@{handle}/video/{vid}", "channel_handle": handle,
                         "channel_name": handle, "posted_at": now, "duration": 60, "views": 150000, "likes": 15000,
                         "comments": 5, "shares": 2, "caption": "Mẹo bảo dưỡng xe", "transcript": "Bảo dưỡng xe định kỳ",
                         "status": "ok", "tags": [], "segments": [], "created_at": now, "updated_at": now,
                         "search_text": "meo bao duong xe"})
    return vid


def test_crud_du_an(client):
    owner = make_user("owner")
    sp = _space(client, owner)
    p = _project(client, owner, sp["id"])
    assert p["my_role"] == "owner" and p["can_manage"] and p["members"][0]["role"] == "owner"
    assert p["space_name"] == "Kho VCS" and p["resources"] == [] and p["campaign_count"] == 0

    rows = client.get("/api/studio/projects").json()
    assert [r["id"] for r in rows] == [p["id"]] and "resources" not in rows[0]

    r = client.patch(f"/api/studio/projects/{p['id']}", json={"name": "  Marketing VCS Q4  ", "goal": "Khách mới"})
    assert r.status_code == 200 and r.json()["name"] == "Marketing VCS Q4" and r.json()["goal"] == "Khách mới"

    # lưu trữ -> không còn trong danh sách mặc định, vẫn ở status=all
    assert client.patch(f"/api/studio/projects/{p['id']}", json={"status": "archived"}).json()["status"] == "archived"
    assert client.get("/api/studio/projects").json() == []
    assert len(client.get("/api/studio/projects", params={"status": "all"}).json()) == 1

    assert client.delete(f"/api/studio/projects/{p['id']}").status_code == 204
    assert client.get(f"/api/studio/projects/{p['id']}").status_code == 404


def test_phan_quyen_hai_lop(client):
    owner, editor, viewer, outsider, guest = (make_user(n) for n in ("owner", "editor", "viewer", "outsider", "guest"))
    sp = _space(client, owner)
    _add_space_member(sp["id"], editor, "editor")
    _add_space_member(sp["id"], viewer, "viewer")
    p = _project(client, owner, sp["id"])
    pid = p["id"]
    post = {"kind": "social_post", "channel": "fanpage", "text": "Bài mẫu về bảo dưỡng xe định kỳ"}

    # Người ngoài kho, ngoài dự án: không thấy gì (404, không lộ 403)
    client.login(outsider)
    assert client.get("/api/studio/projects").json() == []
    assert client.get(f"/api/studio/projects/{pid}").status_code == 404
    assert client.post(f"/api/studio/projects/{pid}/resources", json=post).status_code == 404
    assert client.post("/api/studio/projects", json={"space_id": sp["id"], "name": "Lậu"}).status_code == 404

    # Viewer kho: xem được, không thêm tài nguyên
    client.login(viewer)
    got = client.get(f"/api/studio/projects/{pid}").json()
    assert got["my_role"] == "viewer" and not got["can_edit"]
    assert client.post(f"/api/studio/projects/{pid}/resources", json=post).status_code == 403
    assert client.post("/api/studio/projects", json={"space_id": sp["id"], "name": "Của viewer"}).status_code == 403

    # Editor kho: tạo dự án (thành owner của dự án đó), thêm tài nguyên vào dự án người khác, không quản lý thành viên
    client.login(editor)
    mine = client.post("/api/studio/projects", json={"space_id": sp["id"], "name": "Dự án của editor"}).json()
    assert mine["my_role"] == "owner"
    assert client.post(f"/api/studio/projects/{pid}/resources", json=post).status_code == 200
    assert client.post(f"/api/studio/projects/{pid}/members", json={"email": guest["email"]}).status_code == 403
    assert client.patch(f"/api/studio/projects/{pid}", json={"status": "archived"}).status_code == 403
    assert client.delete(f"/api/studio/projects/{pid}").status_code == 403

    # Chủ dự án mời người ngoài kho làm reviewer: xem được dự án, không thêm tài nguyên; nâng lên editor thì được
    client.login(owner)
    r = client.post(f"/api/studio/projects/{pid}/members", json={"email": guest["email"], "role": "reviewer"})
    assert r.status_code == 200 and {m["role"] for m in r.json()["members"]} == {"owner", "reviewer"}
    client.login(guest)
    got = client.get(f"/api/studio/projects/{pid}").json()
    assert got["my_role"] == "reviewer" and not got["can_edit"]
    assert [x["id"] for x in client.get("/api/studio/projects").json()] == [pid]   # thấy qua tư cách thành viên
    assert client.post(f"/api/studio/projects/{pid}/resources", json=post).status_code == 403
    client.login(owner)
    client.patch(f"/api/studio/projects/{pid}/members/{str(guest['_id'])}", json={"role": "editor"})
    client.login(guest)
    assert client.post(f"/api/studio/projects/{pid}/resources", json=post | {"text": "Bài mẫu thứ hai về bảo dưỡng xe"}).status_code == 200

    # Không được bỏ chủ dự án cuối cùng
    client.login(owner)
    me = str(owner["_id"])
    assert client.patch(f"/api/studio/projects/{pid}/members/{me}", json={"role": "editor"}).status_code == 400
    assert client.delete(f"/api/studio/projects/{pid}/members/{me}").status_code == 400
    client.patch(f"/api/studio/projects/{pid}/members/{str(guest['_id'])}", json={"role": "owner"})
    assert client.delete(f"/api/studio/projects/{pid}/members/{me}").status_code == 200
    # Vẫn là owner kho -> vẫn quản lý được dự án
    assert client.get(f"/api/studio/projects/{pid}").json()["my_role"] == "owner"


def test_kho_tai_nguyen_va_the_ghim(client):
    owner = make_user("owner")
    sp = _space(client, owner)
    p = _project(client, owner, sp["id"])
    pid = p["id"]
    url = f"/api/studio/projects/{pid}"

    # Bài mẫu P1, video R1, tài liệu D1, thẻ K1 — mã theo loại, ảnh chụp nội dung, text không trả trong danh sách
    r = client.post(f"{url}/resources", json={"kind": "social_post", "channel": "fanpage", "text": "Bài mẫu 1 về bảo dưỡng xe định kỳ",
                                              "note": "giọng hay"})
    assert r.status_code == 200 and r.json()["resources"][0]["ref"] == "P1"
    assert r.json()["resources"][0]["has_text"] and "text" not in r.json()["resources"][0]

    vid = _video()
    r = client.post(f"{url}/resources", json={"kind": "video", "video_id": vid})
    assert r.status_code == 200
    v = next(x for x in r.json()["resources"] if x["kind"] == "video")
    assert v["ref"] == "R1" and v["video_id"] == vid and "viral_score" in v["metrics"]
    assert client.post(f"{url}/resources", json={"kind": "video", "video_id": vid}).status_code == 409
    assert client.post(f"{url}/resources", json={"kind": "video", "video_id": "999"}).status_code == 404

    did = documents.insert_one({"space_id": ObjectId(sp["id"]), "title": "Quy trình bảo dưỡng", "text": "Bước 1…",
                                "wiki_status": "pending", "created_at": db.now()}).inserted_id
    r = client.post(f"{url}/resources", json={"kind": "document", "document_id": str(did)})
    assert r.status_code == 200 and any(x["ref"] == "D1" and x["title"] == "Quy trình bảo dưỡng" for x in r.json()["resources"])
    assert client.post(f"{url}/resources", json={"kind": "document", "document_id": str(ObjectId())}).status_code == 404

    # Tài liệu kho khác không thêm được (không xem được -> 404)
    other = make_user("other")
    sp2 = _space(client, other, "Kho khác")
    hidden = documents.insert_one({"space_id": ObjectId(sp2["id"]), "title": "Kín", "text": "x", "created_at": db.now()}).inserted_id
    client.login(owner)
    assert client.post(f"{url}/resources", json={"kind": "document", "document_id": str(hidden)}).status_code == 404

    # Xem một tài nguyên có text; xoá P1 rồi thêm bài mới -> P2 (không đánh lại mã)
    assert client.get(f"{url}/resources/P1").json()["text"] == "Bài mẫu 1 về bảo dưỡng xe định kỳ"
    assert client.delete(f"{url}/resources/P1").status_code == 200
    r = client.post(f"{url}/resources", json={"kind": "social_post", "text": "Bài mẫu 2 về thay dầu động cơ"})
    assert [x["ref"] for x in r.json()["resources"] if x["kind"] == "social_post"] == ["P2"]
    assert client.get(f"{url}/resources/P1").status_code == 404

    cid = cards.insert_one({"space_id": ObjectId(sp["id"]), "type": "lesson", "title": "Bài học chốt đơn",
                            "summary": "Tóm tắt", "status": "approved", "search_text": "bai hoc chot don",
                            "created_at": db.now(), "updated_at": db.now()}).inserted_id
    r = client.post(f"{url}/cards", json={"card_id": str(cid)})
    assert r.status_code == 200 and r.json()["cards"][0]["ref"] == "K1" and r.json()["cards"][0]["title"] == "Bài học chốt đơn"
    assert client.post(f"{url}/cards", json={"card_id": str(cid)}).status_code == 409
    assert client.delete(f"{url}/cards/K1").status_code == 200
    assert client.get(url).json()["cards"] == []
    assert client.get(f"{url}/pick/documents", params={"q": "bảo dưỡng"}).json()[0]["title"] == "Quy trình bảo dưỡng"
    assert [x["id"] for x in client.get(f"{url}/pick/videos").json()] == [vid]


def test_chien_dich_va_viet_nhanh_trong_du_an(client):
    owner = make_user("owner")
    sp = _space(client, owner)
    p = _project(client, owner, sp["id"])
    pid, url = p["id"], f"/api/studio/projects/{p['id']}"
    vid = _video()
    client.post(f"{url}/resources", json={"kind": "video", "video_id": vid})
    client.post(f"{url}/resources", json={"kind": "social_post", "channel": "fanpage", "text": "Bài mẫu dự án về bảo dưỡng mùa mưa"})
    cid = cards.insert_one({"space_id": ObjectId(sp["id"]), "type": "lesson", "title": "Thẻ ghim", "summary": "",
                            "status": "approved", "search_text": "the ghim", "created_at": db.now(),
                            "updated_at": db.now()}).inserted_id
    client.post(f"{url}/cards", json={"card_id": str(cid)})

    # Chiến dịch trong dự án: kho = kho dự án, video / bài mẫu lấy từ kho dự án khi form để trống, thẻ ghim đứng đầu
    brief = {"name": "Chiến dịch Q4", "product": "Bảo dưỡng", "goal": "Khách mới", "audience": "Chủ xe",
             "weeks": 1, "posts_per_week": 1, "social": {"channels": ["fanpage"], "per_week": 1}}
    r = client.post("/api/studio/campaigns", json={"project_id": pid, "flows": ["video", "social"], "brief": brief,
                                                   "references": {"q": "", "channel": "", "tag": "", "limit": 12}})
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["project_id"] == pid and c["project_name"] == "Marketing xưởng VCS" and c["space_id"] == sp["id"]
    assert [x["video_id"] for x in c["references"]] == [vid]
    assert c["social_refs"][0]["text"] == "Bài mẫu dự án về bảo dưỡng mùa mưa" and c["social_refs"][0]["channel"] == "fanpage" and c["cards"][0]["title"] == "Thẻ ghim"
    assert client.get("/api/studio/campaigns", params={"project_id": pid}).json()["total"] == 1
    assert client.get(url).json()["campaign_count"] == 1

    # Có chiến dịch gắn vào -> không xoá cứng được; bỏ gán rồi xoá được
    assert client.delete(url).status_code == 409
    r = client.patch(f"/api/studio/campaigns/{c['id']}", json={"project_id": None})
    assert r.status_code == 200 and r.json()["project_id"] is None
    assert client.patch(f"/api/studio/campaigns/{c['id']}", json={"project_id": pid}).json()["project_id"] == pid

    # Gán vào dự án kho khác -> 400
    other = _space(client, owner, "Kho khác")
    p2 = _project(client, owner, other["id"], "Dự án kho khác")
    assert client.patch(f"/api/studio/campaigns/{c['id']}", json={"project_id": p2["id"]}).status_code == 400

    # Viết nhanh trong dự án
    r = client.post("/api/studio/quick", json={"project_id": pid, "type": "ideas", "inputs": {"topic": "Bảo dưỡng mùa mưa"},
                                               "use_wiki": True})
    assert r.status_code == 201, r.text
    q = r.json()
    assert q["project_id"] == pid and q["project_name"] == "Marketing xưởng VCS" and q["cards"][0]["title"] == "Thẻ ghim"
    assert client.get("/api/studio/quick", params={"project_id": pid}).json()["total"] == 1
    assert client.patch(f"/api/studio/quick/{q['id']}", json={"project_id": None}).json()["project_id"] is None
    assert client.get(url).json()["quick_count"] == 0

    client.patch(f"/api/studio/campaigns/{c['id']}", json={"project_id": None})
    assert client.delete(url).status_code == 204
    assert campaigns.count_documents({}) == 1 and quick_pieces.count_documents({}) == 1
    assert marketing_projects.count_documents({}) == 1   # còn dự án kho khác
