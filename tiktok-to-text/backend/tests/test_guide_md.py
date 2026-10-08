"""Hướng dẫn sử dụng cho AI đọc không cần JS (28/09/2026): /guide.md, /guide/<id>.md, /api/guide; mục `soan-khoa`
là checklist đánh số có ví dụ đã điền + lời nhắn rút gọn; tìm thẻ theo tiêu đề (match=title) cho ô chọn thẻ căn cứ."""

from __future__ import annotations

import time

from app import auth, db, guide
from app.spaces import personal_space

cards = db.db["wiki_cards"]


def test_guide_md_tra_ca_huong_dan_va_tung_muc(client):
    r = client.get("/guide.md")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/markdown")
    text = r.text
    assert text.startswith("# Hướng dẫn sử dụng")
    for s in guide.sections():
        assert f"/guide/{s['id']}.md" in text and s["title"] in text

    r = client.get("/guide/soan-khoa.md")
    assert r.status_code == 200
    md = r.text
    assert md.startswith("# ") and "/guide#soan-khoa" in md
    # checklist cho AI yếu: bước 0 chuẩn bị, ví dụ đã điền, quy tắc viết câu, xử lý tình huống, lời nhắn rút gọn, API
    for needle in ("Bước 0", "GET /api/auth/me", "GET /api/users", "GET /api/categories", "status=approved&category=",
                   "Hội nhập VC Phồn Vinh", "Thẻ nêu:", "q-card-search", "q-save-approve-next", "lesson-publish",
                   "path-publish", "assign-submit", "POST /api/learn/questions", "POST /api/learn/paths",
                   "/assign", "Lời nhắn rút gọn", "```text"):
        assert needle in md, needle
    assert "<…>" not in md.split("### Ví dụ")[1].split("### Quy tắc")[0]   # ví dụ không còn chỗ trống

    assert client.get("/guide/khong-co-muc-nay.md").status_code == 404


def test_api_guide_json(client):
    toc = client.get("/api/guide").json()
    ids = [s["id"] for s in toc["sections"]]
    assert "soan-khoa" in ids and toc["all_md"] == "/guide.md"
    assert all(s["md"] == f"/guide/{s['id']}.md" for s in toc["sections"])
    s = client.get("/api/guide/soan-khoa").json()
    assert s["id"] == "soan-khoa" and s["snippets"] and "Bước" in s["body"]
    assert client.get("/api/guide/xyz").status_code == 404


def test_tim_the_theo_tieu_de_nhanh_va_dung(client):
    u = auth.create_user("nguoi-soan@test.local", "Người soạn", "mat-khau-test", "admin")
    client.login(u)
    sp = personal_space(u)
    titles = ["VCgarage là gì: phần mềm quản lý gara", "VCgarage: bảng giá gói", "Gara nhỏ chọn VCgarage thế nào",
              "Giá trị cốt lõi của VC Phồn Vinh", "Đại tu động cơ: các bước"]
    ids = {}
    for t in titles:
        r = client.post("/api/wiki/cards", json={"space_id": str(sp["_id"]), "type": "concept", "title": t,
                                                 "summary": "giá trị cốt lõi nằm trong thân bài", "body": "VCgarage x"})
        assert r.status_code == 201, r.text
        ids[t] = r.json()["id"]
    cards.update_many({}, {"$set": {"status": "approved"}})
    # nhiều thẻ thân bài nhắc "VCgarage" — tìm theo tiêu đề chỉ lấy thẻ có chữ đó trong tiêu đề, tiền tố xếp trước
    t0 = time.perf_counter()
    r = client.get("/api/wiki/cards", params={"status": "approved", "q": "VCgarage la", "match": "title", "page_size": 12})
    assert r.status_code == 200 and time.perf_counter() - t0 < 1
    got = [c["title"] for c in r.json()["items"]]
    assert got[0] == "VCgarage là gì: phần mềm quản lý gara" and r.json()["items"][0]["match"] == "title_prefix"
    assert set(got) == {"VCgarage là gì: phần mềm quản lý gara"}   # "la" không có trong 2 tiêu đề còn lại
    r = client.get("/api/wiki/cards", params={"status": "approved", "q": "vcgarage", "match": "title"})
    got = [c["title"] for c in r.json()["items"]]
    assert got[:2] == ["VCgarage là gì: phần mềm quản lý gara", "VCgarage: bảng giá gói"] or \
        got[:2] == ["VCgarage: bảng giá gói", "VCgarage là gì: phần mềm quản lý gara"]
    assert got[2] == "Gara nhỏ chọn VCgarage thế nào" and r.json()["total"] == 3
    # "giá trị cốt lõi" chỉ ra thẻ có cụm đó trong tiêu đề — không lẫn thẻ đại tu động cơ (tóm tắt có chữ đó)
    r = client.get("/api/wiki/cards", params={"status": "approved", "q": "giá trị cốt lõi", "match": "title"})
    assert [c["title"] for c in r.json()["items"]] == ["Giá trị cốt lõi của VC Phồn Vinh"]
