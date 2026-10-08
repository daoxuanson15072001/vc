"""Viết nhanh — Content Engine (studio/quick.py, studio/quick_routes.py). AI luôn là AI giả."""

from __future__ import annotations

import pytest

from app.studio import ai, quick, quick_pieces, worker
from tests.conftest import make_user

USAGE = {"input_tokens": 10, "output_tokens": 20, "model": "fake"}

POST = {"channel": "fanpage", "author": "", "title": "Má phanh", "body": "Đoạn một.\n\nĐoạn hai — nhắn tin để đặt lịch.",
        "hooks": ["Phanh kêu ken két là đã muộn.", "3 dấu hiệu má phanh sắp hết.", "Anh thợ nói thật về phanh."],
        "cta": "Nhắn tin", "hashtags": ["#VCGarage"], "visual": {"type": "ảnh đơn", "description": "má phanh mòn", "slides": []},
        "first_comment": "Đặt lịch tại đây", "link_placement": "bình luận đầu", "best_time": "20:00",
        "sources": {"refs": [], "cards": [], "notes": ""}, "facts_to_verify": []}

GOOGLE = {"headlines": ["Kiểm tra phanh miễn phí"] * 12 + ["Tiêu đề này dài quá ba mươi ký tự rồi đấy"],
          "descriptions": ["Mô tả ngắn gọn."] * 4, "paths": ["phanh", "kiem-tra"],
          "sitelinks": [{"text": "Bảng giá", "line1": "Giá rõ ràng", "line2": "Không phát sinh"}] * 4,
          "callouts": ["Miễn phí kiểm tra"] * 4, "keywords": ["\"thay má phanh\""], "negative_keywords": ["tự làm"],
          "notes": "", "facts_to_verify": []}


def judge(total_scores: dict):
    return lambda *a, **k: {"scores": total_scores, "strengths": ["tốt"], "fixes": ["sửa x"], "similarity_risk": "thấp",
                            "verdict": "ổn", "usage": USAGE}


@pytest.fixture
def user():
    return make_user("Người viết")


@pytest.fixture
def ai_on(monkeypatch):
    monkeypatch.setattr(worker.wiki, "ai_ready", lambda: True)


def test_danh_muc_loai_co_du_4_nhom(client, user):
    client.login(user)
    res = client.get("/api/studio/quick/types").json()
    groups = {t["group"] for t in res["types"].values()}
    assert {"social", "video", "seo", "ads"} <= groups
    for key in ("fb_post", "linkedin_post", "zalo", "short_video", "seo_article", "fb_ads", "google_ads", "email"):
        assert key in res["types"], key
        assert all("schema" not in t and "task" not in t for t in res["types"].values())


def test_kiem_tra_dau_vao(client, user):
    client.login(user)
    r = client.post("/api/studio/quick", json={"type": "seo_article", "inputs": {"topic": "phanh"}})
    assert r.status_code == 400 and "Từ khoá chính" in r.json()["detail"]
    r = client.post("/api/studio/quick", json={"type": "fb_post", "inputs": {"topic": "x", "channel": "tiktok"}})
    assert r.status_code == 400 and "không hợp lệ" in r.json()["detail"]
    r = client.post("/api/studio/quick", json={"type": "fb_ads", "inputs": {"topic": "x", "variants": 50}})
    assert r.status_code == 400
    r = client.post("/api/studio/quick", json={"type": "fb_post", "inputs": {"topic": "x", "link_url": "abc"}})
    assert r.status_code == 400 and "link" in r.json()["detail"]


def test_trang_ca_nhan_bat_buoc_nguoi_dung_ten_da_dong_y(client, user):
    client.login(user)
    r = client.post("/api/studio/quick", json={"type": "fb_post", "inputs": {"topic": "x", "channel": "fb_personal"}})
    assert r.status_code == 400 and "người đứng tên" in r.json()["detail"]
    a = client.post("/api/studio/authors", json={"name": "Anh Hùng", "consent": False}).json()
    r = client.post("/api/studio/quick", json={"type": "fb_post",
                                               "inputs": {"topic": "x", "channel": "fb_personal", "author_id": a["id"]}})
    assert r.status_code == 400 and "đồng ý" in r.json()["detail"]
    client.patch(f"/api/studio/authors/{a['id']}", json={"consent": True})
    r = client.post("/api/studio/quick", json={"type": "fb_post",
                                               "inputs": {"topic": "x", "channel": "fb_personal", "author_id": a["id"]}})
    assert r.status_code == 201 and r.json()["author"]["name"] == "Anh Hùng"


def test_tao_danh_sach_duyet_xoa_va_quyen(client, user):
    client.login(user)
    p = client.post("/api/studio/quick", json={"type": "email", "inputs": {"topic": "Nhắc bảo dưỡng 10.000 km"}}).json()
    assert p["status"] == "queued" and p["judge"] is True and p["title"] == "Nhắc bảo dưỡng 10.000 km"
    assert p["inputs"]["email_type"] == "Khuyến mãi / ưu đãi"   # mặc định của ô chọn
    lst = client.get("/api/studio/quick", params={"type": "email"}).json()
    assert lst["total"] == 1 and lst["items"][0]["type_label"] == "Email marketing"
    assert client.patch(f"/api/studio/quick/{p['id']}", json={"review_status": "approved"}).status_code == 409

    other = make_user("Người khác")
    client.login(other)
    assert client.get(f"/api/studio/quick/{p['id']}").status_code == 404   # kho cá nhân của người khác
    assert client.get("/api/studio/quick").json()["total"] == 0

    client.login(user)
    assert client.delete(f"/api/studio/quick/{p['id']}").status_code == 204
    assert client.get("/api/studio/quick").json()["total"] == 0


def test_worker_viet_cham_sua_va_gan_utm(client, user, ai_on, monkeypatch):
    client.login(user)
    p = client.post("/api/studio/quick", json={"type": "fb_post", "inputs": {
        "topic": "Dấu hiệu má phanh mòn", "channel": "fb_group", "link_url": "https://vcgarage.vn/phanh?ref=x"}}).json()
    calls = []

    def write(system, content, schema, **k):
        calls.append(content)
        return POST | {"usage": USAGE}
    monkeypatch.setattr(quick, "structured_call", write)
    scores = iter([{"hook": 10, "value": 10, "voice": 10, "engagement": 10, "readability": 5, "cta": 5, "safety": 5},
                   {"hook": 25, "value": 20, "voice": 15, "engagement": 15, "readability": 10, "cta": 10, "safety": 5}])
    monkeypatch.setattr(ai, "structured_call", lambda *a, **k: judge(next(scores))())

    assert worker.StudioWorker()._quick_next()
    got = client.get(f"/api/studio/quick/{p['id']}").json()
    assert got["status"] == "done" and got["score"] == 100 and [r["total"] for r in got["rounds"]] == [55, 100]
    assert "<ban_truoc>" in calls[1] and "Nhóm Facebook" in calls[0]
    assert got["content"]["link"]["utm_url"].startswith("https://vcgarage.vn/phanh?ref=x&utm_source=facebook")
    assert got["text"].startswith("Phanh kêu ken két")
    assert {c["key"] for c in got["checks"]} >= {"hooks", "hashtags", "no_url_in_body"}

    # Viết lại theo góp ý: sửa trên bản đang có
    client.post(f"/api/studio/quick/{p['id']}/rewrite", json={"feedback": "ngắn hơn"})
    scores = iter([{"hook": 25, "value": 20, "voice": 15, "engagement": 15, "readability": 10, "cta": 10, "safety": 5}])
    assert worker.StudioWorker()._quick_next()
    assert "ngắn hơn" in calls[-1] and "<ban_truoc>" in calls[-1]


def test_khong_giam_khao_va_kiem_tra_gioi_han_google_ads(client, user, ai_on, monkeypatch):
    client.login(user)
    p = client.post("/api/studio/quick", json={"type": "google_ads", "judge": False,
                                               "inputs": {"keyword": "thay má phanh", "topic": "Dịch vụ phanh"}}).json()
    monkeypatch.setattr(quick, "structured_call", lambda *a, **k: GOOGLE | {"usage": USAGE})
    monkeypatch.setattr(ai, "structured_call", lambda *a, **k: pytest.fail("không được gọi giám khảo"))
    assert worker.StudioWorker()._quick_next()
    got = client.get(f"/api/studio/quick/{p['id']}").json()
    by = {c["key"]: c for c in got["checks"]}
    assert got["score"] is None and got["review"] is None
    assert not by["headlines"]["ok"] and "Tiêu đề này dài" in by["headlines"]["detail"]
    assert by["descriptions"]["ok"] and by["headlines_n"]["ok"]
    assert "TIÊU ĐỀ" in got["text"]


def test_chuyen_the_dua_noi_dung_goc_vao_prompt(client, user, ai_on, monkeypatch):
    client.login(user)
    src = client.post("/api/studio/quick", json={"type": "fb_post", "judge": False, "inputs": {"topic": "Má phanh"}}).json()
    monkeypatch.setattr(quick, "structured_call", lambda *a, **k: POST | {"usage": USAGE})
    worker.StudioWorker()._quick_next()
    assert client.post("/api/studio/quick", json={"type": "zalo", "parent_id": "0" * 24,
                                                  "inputs": {"topic": "x"}}).status_code == 404
    child = client.post("/api/studio/quick", json={"type": "zalo", "judge": False, "parent_id": src["id"],
                                                   "inputs": {"topic": "Má phanh"}}).json()
    seen = []
    monkeypatch.setattr(quick, "structured_call", lambda s, c, *a, **k: seen.append(c) or {
        "title": "Kiểm tra phanh", "message": "Nội dung", "cta_button": "Đặt lịch", "image": "", "send_time": "",
        "sources": {"refs": ["G1"], "cards": [], "notes": ""}, "facts_to_verify": [], "usage": USAGE})
    worker.StudioWorker()._quick_next()
    assert '<noi_dung_goc ma="G1" loai="Bài Facebook">' in seen[0] and "Phanh kêu ken két" in seen[0]
    assert client.get(f"/api/studio/quick/{child['id']}").json()["title"] == "Kiểm tra phanh"


@pytest.mark.parametrize("key", list(quick.TYPES))
def test_moi_loai_co_task_text_va_checks_chay_duoc_voi_noi_dung_rong(key):
    t = quick.TYPES[key]
    assert t["task"].startswith("Nhiệm vụ") and t["group"] in quick.GROUPS and t["rubric"] in ai.RUBRICS
    inputs = quick.clean_inputs(key, {"topic": "x", "keyword": "y"})
    assert isinstance(t["text"]({}), str)
    assert isinstance(t["checks"]({}, inputs, None), list)
