"""Vệ sinh tag Phân loại v2 (app/kb/tags_v2.py, scripts/clean_tags_v2.py) và 4 nhánh bổ sung của cây v2 (R3)."""

from __future__ import annotations

from app import categories, db, tree_v2
from app.kb import tags_v2
from app.kb.pipeline import cards, documents


def test_clean_rules():
    assert tags_v2.clean(["Livestream TikTok", "livestream", "the-hoang-work", "tuyen-dung", "", "gmv-max-2-0",
                          "quang-cao-gmv"]) == ["livestream", "nguon-the-hoang-work", "gmv-max"]
    assert tags_v2.clean(["nguon-ben-ngoai", "roi-quang-cao", "bao-ve-roi"]) == ["nguon-ben-ngoai", "roi"]
    # chạy lại trên kết quả không đổi gì
    once = tags_v2.clean(list(tags_v2.RENAME) + list(tags_v2.DROP))
    assert tags_v2.clean(once) == once
    assert not (set(once) & (set(tags_v2.MERGE) | tags_v2.DROP | set(tags_v2.SOURCE_CHANNELS)))


def test_run_idempotent_keeps_status_and_revision():
    now = db.now()
    cid = cards.insert_one({"type": "concept", "title": "Thẻ A", "summary": "", "body": "", "status": "approved",
                            "current_revision": 3, "updated_at": now, "tags": ["koc", "duy-muoi", "dam-phan", "koc"],
                            "search_text": "the a koc"}).inserted_id
    did = documents.insert_one({"title": "Tài liệu", "tags": ["tiktok-ads"]}).inserted_id
    vid = db.videos.insert_one({"video_id": "v1", "tags": ["phi-san"]}).inserted_id
    dry = tags_v2.run()
    assert dry["changed"] == {"cards": 1, "documents": 1, "videos": 1}
    assert cards.find_one({"_id": cid})["tags"] == ["koc", "duy-muoi", "dam-phan", "koc"]   # chạy thử không ghi
    tags_v2.run(apply=True)
    c = cards.find_one({"_id": cid})
    assert c["tags"] == ["affiliate-koc", "nguon-duy-muoi"]
    assert (c["status"], c["current_revision"], c["updated_at"]) == ("approved", 3, now.replace(microsecond=now.microsecond // 1000 * 1000))
    assert "nguon-duy-muoi" in c["search_text"]
    assert documents.find_one({"_id": did})["tags"] == ["quang-cao-tiktok"]
    assert db.videos.find_one({"_id": vid})["tags"] == ["phi-san-tmdt"]
    again = tags_v2.run(apply=True)
    assert again["changed"] == {"cards": 0, "documents": 0, "videos": 0}


def test_tree_r3_nodes():
    categories.ensure_indexes()
    tree_v2.seed()
    get = lambda s: categories.categories.find_one({"slug": s})   # noqa: E731
    p4 = get("mkt.chien-luoc.san-pham-4p")
    assert (p4["code"], p4["level"], p4["name"]) == ("1.1.6", 3, "Sản phẩm & danh mục marketing (4P)")
    assert len(p4["scope_note"].splitlines()) == 4
    k = get("hcns.dao-tao.ky-nang-ca-nhan")
    assert k["name"] == "Kỹ năng làm việc cá nhân" and "tự học" in k["description"]
    kids = list(categories.categories.find({"path": "hcns.dao-tao.ky-nang-ca-nhan"}).sort("order", 1))
    assert [(c["code"], c["slug"].rsplit(".", 1)[1], c["level"]) for c in kids] == [
        ("4.3.3.1", "giao-tiep", 4), ("4.3.3.2", "thoi-gian", 4), ("4.3.3.3", "lam-viec-voi-sep", 4)]
    assert all(len(c["scope_note"].splitlines()) == 4 for c in kids)
    # nạp lại (vd cây đã nạp trước khi có 4 nhánh này) không tạo trùng
    n = categories.categories.count_documents({})
    assert tree_v2.seed()["created"] == 0 and categories.categories.count_documents({}) == n == len(tree_v2.nodes())


def test_scope_notes_from_file_and_manual_edits_kept(monkeypatch):
    """Scope note: file JSON theo mã > viết tay theo slug > tự dựng; seed không xoá bằng chuỗi rỗng và không đè bản sửa
    tay sau lần seed trước."""
    notes = tree_v2.file_scope_notes()
    assert len(notes) >= 240 and all(len(v.splitlines()) == 4 for v in notes.values())
    by_slug = {n["slug"]: n for n in tree_v2.nodes()}
    assert by_slug["bh.san-tmdt"]["scope_note"] == tree_v2.SCOPE_NOTES["bh.san-tmdt"]   # file không có 2.5
    code = {n["code"]: n for n in tree_v2.nodes()}
    for c in ("1.3.2", "3.6.6", "4.3.3.3"):
        assert code[c]["scope_note"] == notes[c]
    categories.ensure_indexes()
    tree_v2.seed()
    get = lambda c: categories.categories.find_one({"code": c, "scheme": "v2"})   # noqa: E731
    assert get("3.6.6")["scope_note"] == notes["3.6.6"]
    # người sửa tay -> seed lại giữ nguyên; mô tả / scope note trống trong seed không xoá giá trị có sẵn
    categories.categories.update_one({"_id": get("1.3.2")["_id"]}, {"$set": {"scope_note": "Gồm: sửa tay"}})
    categories.categories.update_one({"_id": get("0.1.1")["_id"]}, {"$set": {"description": "mô tả tay"}})
    again = tree_v2.seed()
    assert get("1.3.2")["scope_note"] == "Gồm: sửa tay" and again["scope_note_kept"] == 1
    assert get("0.1.1")["description"] == "mô tả tay"
    monkeypatch.setattr(tree_v2, "file_scope_notes", lambda: {})
    tree_v2.seed()
    assert get("3.6.6")["scope_note"] == notes["3.6.6"]      # dữ liệu seed trống không xoá scope note đang có


def test_topic_tags_with_source_prefix_renamed():
    assert tags_v2.clean(["nguon-khach", "nguon-ung-vien", "nguon-ben-ngoai"]) == \
        ["tim-khach", "kenh-tuyen-dung", "nguon-ben-ngoai"]
