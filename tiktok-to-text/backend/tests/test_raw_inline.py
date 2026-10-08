"""Xem file thô ngay trong app: GET /kb/sources/{id}/raw/{path}?inline=1 trả Content-Disposition inline."""

from __future__ import annotations

from app import db
from app.kb import pipeline
from app.kb.pipeline import sources
from app.spaces import personal_space
from tests.conftest import make_user


def setup_source(tmp_path, monkeypatch, user):
    monkeypatch.setattr(pipeline, "RAW_DIR", tmp_path / "raw")
    sid = sources.insert_one({"space_id": personal_space(user)["_id"], "created_by": user["_id"], "kind": "pdf",
                              "lane": "light", "title": "a.pdf", "status": "extracted", "priority": 0, "logs": [],
                              "options": {}, "created_at": db.now()}).inserted_id
    base = pipeline.raw_dir(sid)
    (base / "sub").mkdir(parents=True)
    (base / "a.pdf").write_bytes(b"%PDF-1.4 thu")
    (base / "sub" / "ghi chu.txt").write_text("xin chào", encoding="utf-8")
    (tmp_path / "raw" / "bimat.txt").write_text("không được lộ", encoding="utf-8")
    return sid


def test_raw_inline_vs_attachment(client, tmp_path, monkeypatch):
    user = make_user("a")
    sid = setup_source(tmp_path, monkeypatch, user)
    client.login(user)

    r = client.get(f"/api/kb/sources/{sid}/raw/a.pdf")
    assert r.status_code == 200 and r.content == b"%PDF-1.4 thu"
    assert r.headers["content-disposition"].startswith("attachment")        # mặc định vẫn tải về
    assert r.headers["content-type"] == "application/pdf"

    r = client.get(f"/api/kb/sources/{sid}/raw/a.pdf", params={"inline": 1})
    assert r.status_code == 200
    assert r.headers["content-disposition"].startswith("inline")
    assert 'filename="a.pdf"' in r.headers["content-disposition"]

    r = client.get(f"/api/kb/sources/{sid}/raw/sub/ghi%20chu.txt?inline=1")
    assert r.status_code == 200 and r.text == "xin chào"
    assert r.headers["content-disposition"].startswith("inline")


def test_raw_inline_still_guarded(client, tmp_path, monkeypatch):
    user = make_user("a")
    sid = setup_source(tmp_path, monkeypatch, user)
    client.login(user)
    for path in ("../bimat.txt", "%2E%2E/bimat.txt", "sub/../../bimat.txt", "khong-co.pdf", "sub"):
        r = client.get(f"/api/kb/sources/{sid}/raw/{path}?inline=1")
        assert r.status_code == 404, path
        assert "không được lộ" not in r.text

    other = make_user("b")                                                   # người ngoài kho không xem được
    client.login(other)
    assert client.get(f"/api/kb/sources/{sid}/raw/a.pdf?inline=1").status_code in (403, 404)
