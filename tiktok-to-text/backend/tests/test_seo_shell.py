"""Vỏ SEO phía BE — SEO-01 robots.txt, SEO-02 404 thật, SEO-03 301 link cũ (DESIGN Phần VI mục 3, Phần V mục 9.1).

Máy test có thể chưa build FE (không có `frontend/dist`, `spa()` không được đăng ký) nên phần 404 dựng `dist/` giả
trong `tmp_path` và một app nhỏ có route trang giống hệt `main.py` `spa()`.
"""

from __future__ import annotations

import json
import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import seo

INDEX = "<!doctype html><title>VC Content Engine</title><div id=root></div>"
ROUTES = [
    {"path": "/", "title": "Việc của tôi", "description": "", "public": False},
    {"path": "/kb", "title": "Kho tư liệu", "description": "", "public": False},
    {"path": "/kb/videos", "title": "Video", "description": "", "public": False},
    {"path": "/studio/:id", "title": "Xưởng", "description": "", "public": False},
    {"path": "/learn/lessons/:id", "title": "Bài học", "description": "", "public": False},
    {"path": "/guide", "title": "Hướng dẫn", "description": "", "public": True},
]


def make_dist(tmp_path, routes=ROUTES):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(INDEX, encoding="utf-8")
    (dist / "favicon.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>", encoding="utf-8")
    if routes is not None:
        (dist / "routes.json").write_text(json.dumps(routes, ensure_ascii=False), encoding="utf-8")
    (tmp_path / "bi-mat.txt").write_text("KHONG-DUOC-LO", encoding="utf-8")   # nằm ngoài dist
    return dist


def spa_client(dist) -> TestClient:
    app = FastAPI()
    app.include_router(seo.router)

    @app.get("/{path:path}")
    def spa(path: str):   # giống main.py spa(), chỉ đổi thư mục dist
        return seo.spa_response(path, dist)

    return TestClient(app)


# --- SEO-01 ------------------------------------------------------------------

def test_robots_cong_khai(client):
    r = client.get("/robots.txt")   # không đăng nhập
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    lines = r.text.splitlines()
    assert lines[0] == "User-agent: *"
    for line in ("Allow: /guide", "Allow: /p/", "Allow: /llms.txt", "Allow: /sitemap.xml",
                 "Disallow: /api/", "Disallow: /mcp", "Disallow: /"):
        assert line in lines
    assert lines.index("Allow: /guide") < lines.index("Disallow: /")


# --- SEO-03 ------------------------------------------------------------------

@pytest.mark.parametrize("src,dst", [
    ("/videos?channel=a", "/kb/videos?channel=a"),
    ("/videos", "/kb/videos"),
    ("/channels?q=x&page=2", "/kb/channels?q=x&page=2"),
    ("/jobs", "/kb"),
    ("/jobs/abc", "/kb"),
    ("/jobs/abc/def?x=1", "/kb?x=1"),
    ("/learn/paths", "/learn/library?tab=paths"),
    ("/learn/paths?year=2026", "/learn/library?tab=paths&year=2026"),
])
def test_301_link_cu(client, src, dst):
    r = client.get(src, follow_redirects=False)
    assert r.status_code == 301
    assert r.headers["location"] == dst


# --- Route công khai sẵn có vẫn chạy ------------------------------------------

def test_route_cong_khai_khong_bi_nuot(client):
    assert client.get("/guide.md").status_code == 200
    assert client.get("/mcp").status_code == 401            # MCP vẫn tự xác thực token, không rơi vào spa
    assert client.get("/api/videos").status_code == 401     # API vẫn cần đăng nhập


# --- SEO-02 ------------------------------------------------------------------

@pytest.mark.parametrize("path", ["/", "/kb", "/kb/", "/studio/abc123", "/learn/lessons/x", "/guide"])
def test_trang_hop_le_tra_index(tmp_path, path):
    c = spa_client(make_dist(tmp_path))
    r = c.get(path)
    assert r.status_code == 200
    assert r.text == INDEX


@pytest.mark.parametrize("path", ["/khong-co", "/kb/khong-co/sau", "/studio", "/studio/a/b"])
def test_duong_dan_la_tra_404(tmp_path, path):
    c = spa_client(make_dist(tmp_path))
    r = c.get(path)
    assert r.status_code == 404
    assert "Không tìm thấy trang" in r.text
    assert '<meta name="robots" content="noindex">' in r.text
    assert 'href="/"' in r.text
    assert r.headers["content-type"].startswith("text/html")


def test_khong_co_routes_json_giu_hanh_vi_cu(tmp_path):
    c = spa_client(make_dist(tmp_path, routes=None))
    r = c.get("/khong-co")
    assert r.status_code == 200
    assert r.text == INDEX
    assert seo.is_app_path("/khong-co", tmp_path / "dist") is None


def test_routes_json_doi_thi_doc_lai(tmp_path):
    dist = make_dist(tmp_path)
    assert seo.is_app_path("/moi", dist) is False
    f = dist / "routes.json"
    f.write_text(json.dumps(ROUTES + [{"path": "/moi", "title": "", "description": "", "public": False}]))
    st = f.stat()
    os.utime(f, (st.st_atime, st.st_mtime + 5))
    assert seo.is_app_path("/moi", dist) is True


def test_file_tinh_trong_dist(tmp_path):
    c = spa_client(make_dist(tmp_path))
    r = c.get("/favicon.svg")
    assert r.status_code == 200
    assert "<svg" in r.text
    assert c.get("/routes.json").json()[0]["path"] == "/"


@pytest.mark.parametrize("path", ["/../bi-mat.txt", "/%2e%2e/bi-mat.txt", "/..%2fbi-mat.txt", "/../etc/passwd"])
def test_khong_lo_file_ngoai_dist(tmp_path, path):
    c = spa_client(make_dist(tmp_path))
    r = c.get(path)
    assert "KHONG-DUOC-LO" not in r.text
    assert "root:" not in r.text


def test_spa_response_chan_traversal_truc_tiep(tmp_path):
    dist = make_dist(tmp_path)
    r = seo.spa_response("../bi-mat.txt", dist)
    assert r.status_code == 404
    r = seo.spa_response("../../../../etc/passwd", dist)
    assert r.status_code == 404
