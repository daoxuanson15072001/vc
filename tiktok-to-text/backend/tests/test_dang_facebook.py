"""Đăng Facebook (studio/facebook.py, BA 5.14). Graph API luôn là giả — không gọi Facebook thật."""

from __future__ import annotations

from datetime import timedelta

import pytest
from bson import ObjectId

from app import db
from app.spaces import personal_space
from app.studio import facebook, quick_pieces, scripts
from tests.conftest import make_user
from tests.test_viet_nhanh import POST

PAGE_TOKEN, USER_TOKEN = "EAAPAGE" + "x" * 30, "EAAUSER" + "y" * 30


class FakeGraph:
    """Thay requests.request trong facebook.py: ghi lại lời gọi, trả lời theo (method, path)."""

    def __init__(self):
        self.calls, self.fail = [], {}

    def __call__(self, method, url, params=None, data=None, timeout=None):
        path = url.split(f"/{facebook.FB_GRAPH_VERSION}/", 1)[1]
        args = params or data or {}
        self.calls.append((method, path, dict(args)))
        if (method, path) in self.fail:
            return Resp({"error": self.fail[(method, path)]})
        tok = args.get("access_token")
        if path == "me":
            if tok == PAGE_TOKEN:
                return Resp({"id": "111", "name": "VC Garage", "metadata": {"type": "page"}})
            return Resp({"id": "9", "name": "Thọ Anh", "metadata": {"type": "user"}})
        if path == "me/accounts":
            return Resp({"data": [{"id": "111", "name": "VC Garage", "access_token": "PT111"},
                                  {"id": "222", "name": "VCparts", "access_token": "PT222", "link": "https://fb.com/vcparts"}]})
        if path.endswith("/feed"):
            return Resp({"id": f"{path.split('/')[0]}_555"})
        if path.endswith("/comments"):
            return Resp({"id": "c1"})
        if method == "GET" and path == "111_555":
            return Resp({"is_published": True, "permalink_url": "https://www.facebook.com/vcgarage/posts/555"})
        return Resp({"success": True, "id": path.split("/")[0], "name": "VC Garage"})


class Resp:
    def __init__(self, body, status=200):
        self.body, self.status_code = body, status

    def json(self):
        return self.body


@pytest.fixture
def fb(monkeypatch):
    g = FakeGraph()
    monkeypatch.setattr(facebook.requests, "request", g)
    return g


@pytest.fixture
def user():
    return make_user("Người đăng")


def approved_piece(client, channel="fanpage", review="approved") -> dict:
    p = client.post("/api/studio/quick", json={"type": "fb_post", "inputs": {"topic": "Má phanh", "channel": channel}}).json()
    content = POST | {"link": {"url": "https://vcgarage.vn", "utm_url": "https://vcgarage.vn?utm_source=facebook"}}
    quick_pieces.update_one({"_id": ObjectId(p["id"])},
                            {"$set": {"content": content, "status": "done", "review_status": review}})
    return p


def page_target(client) -> dict:
    return client.post("/api/studio/facebook/targets/pages", json={"token": PAGE_TOKEN}).json()[0]


def test_ket_noi_fanpage_bang_page_token_khong_lo_token(client, user, fb):
    client.login(user)
    rows = client.post("/api/studio/facebook/targets/pages", json={"token": PAGE_TOKEN}).json()
    assert [(r["name"], r["fb_id"], r["kind"], r["mode"], r["token_kind"]) for r in rows] == [
        ("VC Garage", "111", "page", "api", "page")]
    assert "token" not in rows[0]
    listed = client.get("/api/studio/facebook/targets").json()
    assert len(listed) == 1 and "token" not in listed[0]
    # kết nối lại cùng Fanpage -> cập nhật, không nhân đôi
    client.post("/api/studio/facebook/targets/pages", json={"token": PAGE_TOKEN})
    assert facebook.targets.count_documents({}) == 1


def test_token_nguoi_dung_lay_moi_fanpage_va_doi_dai_han(client, user, fb, monkeypatch):
    client.login(user)
    monkeypatch.setattr(facebook, "FB_APP_ID", "app")
    monkeypatch.setattr(facebook, "FB_APP_SECRET", "secret")
    fb_exchange = lambda *a, **k: Resp({"access_token": "LONG"})   # noqa: E731
    orig = fb.__call__

    def call(method, url, params=None, data=None, timeout=None):
        if url.endswith("oauth/access_token"):
            fb.calls.append((method, "oauth/access_token", dict(params)))
            return fb_exchange()
        return orig(method, url, params=params, data=data, timeout=timeout)
    monkeypatch.setattr(facebook.requests, "request", call)
    rows = client.post("/api/studio/facebook/targets/pages", json={"token": USER_TOKEN}).json()
    assert {r["name"] for r in rows} == {"VC Garage", "VCparts"} and {r["token_kind"] for r in rows} == {"user_long"}
    accounts = [c for c in fb.calls if c[1] == "me/accounts"][0]
    assert accounts[2]["access_token"] == "LONG"
    assert facebook.targets.find_one({"fb_id": "222"})["token"] == "PT222"


def test_token_loi_bao_tieng_viet(client, user, fb):
    client.login(user)
    fb.fail[("GET", "me")] = {"code": 190, "message": "Session has expired"}
    r = client.post("/api/studio/facebook/targets/pages", json={"token": PAGE_TOKEN})
    assert r.status_code == 400 and "hết hạn" in r.json()["detail"]


def test_nhom_va_trang_ca_nhan_khai_bao_tay(client, user):
    client.login(user)
    r = client.post("/api/studio/facebook/targets", json={"kind": "group", "name": "Hội chủ xe"})
    assert r.status_code == 400 and "link nhóm" in r.json()["detail"]
    r = client.post("/api/studio/facebook/targets", json={"kind": "group", "name": "Hội chủ xe", "url": "https://google.com/x"})
    assert r.status_code == 422
    g = client.post("/api/studio/facebook/targets",
                    json={"kind": "group", "name": "Hội chủ xe", "url": "https://www.facebook.com/groups/hoichuxe"}).json()
    assert g["mode"] == "manual" and g["kind_label"] == "Nhóm Facebook"
    pr = client.post("/api/studio/facebook/targets", json={"kind": "profile", "name": "Thọ Anh"})
    assert pr.status_code == 201
    r = client.patch(f"/api/studio/facebook/targets/{g['id']}", json={"name": "Hội chủ xe HN"})
    assert r.json()["name"] == "Hội chủ xe HN"
    assert client.delete(f"/api/studio/facebook/targets/{g['id']}").status_code == 204


def test_quyen_kenh_theo_kho(client, user, fb):
    client.login(user)
    t = page_target(client)
    other = make_user("Người ngoài")
    client.login(other)
    assert client.get("/api/studio/facebook/targets").json() == []
    assert client.delete(f"/api/studio/facebook/targets/{t['id']}").status_code == 404


def test_dang_fanpage_ngay_kem_binh_luan_dau(client, user, fb):
    client.login(user)
    t, p = page_target(client), approved_piece(client)
    d = client.get("/api/studio/facebook/draft", params={"source": "quick", "id": p["id"]}).json()
    assert d["message"].startswith(POST["hooks"][0]) and "#VCGarage" in d["message"]
    assert d["link"] == "https://vcgarage.vn?utm_source=facebook" and d["first_comment"] == "Đặt lịch tại đây"
    r = client.post("/api/studio/facebook/publish", json={"source": "quick", "id": p["id"], "target_id": t["id"],
                                                         "message": d["message"], "link": d["link"],
                                                         "first_comment": d["first_comment"]})
    assert r.status_code == 200, r.text
    pub = r.json()["publication"]
    assert pub["status"] == "published" and pub["url"] == "https://www.facebook.com/111_555"
    feed = [c for c in fb.calls if c[1] == "111/feed"][0]
    assert feed[0] == "POST" and feed[2]["access_token"] == PAGE_TOKEN and feed[2]["link"] == d["link"]
    assert any(c[1] == "111_555/comments" for c in fb.calls)
    piece = client.get(f"/api/studio/quick/{p['id']}").json()
    assert piece["published_url"] == pub["url"] and len(piece["publications"]) == 1


def test_chua_duyet_hoac_sai_loai_khong_dang(client, user, fb):
    client.login(user)
    t = page_target(client)
    p = approved_piece(client, review="draft")
    body = {"source": "quick", "id": p["id"], "target_id": t["id"], "message": "x"}
    r = client.post("/api/studio/facebook/publish", json=body)
    assert r.status_code == 409 and "Duyệt" in r.json()["detail"]
    e = client.post("/api/studio/quick", json={"type": "email", "inputs": {"topic": "x"}}).json()
    r = client.post("/api/studio/facebook/publish", json=body | {"id": e["id"]})
    assert r.status_code == 400
    assert not any(c[1].endswith("/feed") for c in fb.calls)


def test_hen_gio_fanpage_huy_va_lam_moi(client, user, fb):
    client.login(user)
    t, p = page_target(client), approved_piece(client)
    base = {"source": "quick", "id": p["id"], "target_id": t["id"], "message": "Bài hẹn giờ", "first_comment": "cmt"}
    r = client.post("/api/studio/facebook/publish", json=base | {"scheduled_at": (db.now() + timedelta(minutes=2)).isoformat()})
    assert r.status_code == 400 and "10 phút" in r.json()["detail"]
    when = db.now() + timedelta(days=2)
    pub = client.post("/api/studio/facebook/publish", json=base | {"scheduled_at": when.isoformat()}).json()["publication"]
    feed = [c for c in fb.calls if c[1] == "111/feed"][-1][2]
    assert pub["status"] == "scheduled" and feed["published"] == "false"
    assert feed["scheduled_publish_time"] == int(when.timestamp())
    assert not any(c[1].endswith("/comments") for c in fb.calls)   # bình luận đầu chỉ khi đăng ngay
    # làm mới: Facebook báo đã lên -> ghi đã đăng
    pubs = client.post("/api/studio/facebook/publications/refresh", params={"source": "quick", "id": p["id"]}).json()
    assert pubs["publications"][0]["status"] == "published"
    assert pubs["publications"][0]["url"] == "https://www.facebook.com/vcgarage/posts/555"
    # hẹn giờ khác rồi huỷ -> xoá bài hẹn trên Facebook
    pub2 = client.post("/api/studio/facebook/publish", json=base | {"scheduled_at": when.isoformat()}).json()["publication"]
    r = client.post("/api/studio/facebook/publications/cancel",
                    json={"source": "quick", "id": p["id"], "publication_id": pub2["id"]})
    assert r.json()["publications"][1]["status"] == "cancelled" and ("DELETE", "111_555", {"access_token": PAGE_TOKEN}) in fb.calls


def test_loi_dang_ghi_lai_va_danh_dau_token_hong(client, user, fb):
    client.login(user)
    t, p = page_target(client), approved_piece(client)
    fb.fail[("POST", "111/feed")] = {"code": 190, "message": "expired"}
    r = client.post("/api/studio/facebook/publish", json={"source": "quick", "id": p["id"], "target_id": t["id"], "message": "x"})
    assert r.status_code == 400 and "kết nối lại" in r.json()["detail"]
    piece = client.get(f"/api/studio/quick/{p['id']}").json()
    assert piece["publications"][0]["status"] == "error" and not piece.get("published_url")
    assert client.get("/api/studio/facebook/targets").json()[0]["status"] == "error"


def test_dang_ho_tro_nhom_xac_nhan_link(client, user):
    client.login(user)
    g = client.post("/api/studio/facebook/targets",
                    json={"kind": "group", "name": "Hội chủ xe", "url": "https://www.facebook.com/groups/hoichuxe"}).json()
    p = approved_piece(client, channel="fb_group")
    r = client.post("/api/studio/facebook/publish", json={"source": "quick", "id": p["id"], "target_id": g["id"],
                                                         "message": "Bài nhóm", "link": "https://vcgarage.vn/a?b=1"}).json()
    assert r["publication"]["status"] == "manual" and r["open_url"] == "https://www.facebook.com/groups/hoichuxe"
    assert r["share_url"].endswith("u=https%3A%2F%2Fvcgarage.vn%2Fa%3Fb%3D1")
    pid = r["publication"]["id"]
    bad = client.post("/api/studio/facebook/publications/confirm",
                      json={"source": "quick", "id": p["id"], "publication_id": pid, "url": "https://example.com/x"})
    assert bad.status_code == 422
    ok = client.post("/api/studio/facebook/publications/confirm",
                     json={"source": "quick", "id": p["id"], "publication_id": pid,
                           "url": "https://www.facebook.com/groups/hoichuxe/posts/123"}).json()
    assert ok["publications"][0]["status"] == "published"
    assert client.get(f"/api/studio/quick/{p['id']}").json()["published_url"].endswith("/posts/123")


def test_bai_mxh_chien_dich_dang_duoc(client, user, fb):
    client.login(user)
    t = page_target(client)
    space = personal_space(user)
    sid = scripts.insert_one({"campaign_id": None, "space_id": space["_id"], "flow": "social", "episode_no": 1,
                              "episode": {"channel": "fanpage", "title": "x"}, "content": POST, "status": "done",
                              "review_status": "approved", "created_by": user["_id"]}).inserted_id
    r = client.post("/api/studio/facebook/publish", json={"source": "script", "id": str(sid), "target_id": t["id"],
                                                         "message": "Bài chiến dịch"})
    assert r.status_code == 200 and scripts.find_one({"_id": sid})["published_url"]
    vid = scripts.insert_one({"space_id": space["_id"], "flow": "video", "content": {"x": 1}, "status": "done",
                              "review_status": "approved"}).inserted_id
    r = client.post("/api/studio/facebook/publish", json={"source": "script", "id": str(vid), "target_id": t["id"],
                                                         "message": "x"})
    assert r.status_code == 400
