"""QA v1 (app/kb/qa_v1.py): nhánh tầng 4 mới, chuyển nhánh chính, thẻ trùng rejected, cờ thẻ mỏng / cần sửa,
phiên bản + quay về, chạy lại 0 thay đổi, dòng lỗi không dừng cả lô."""

from __future__ import annotations

from bson import ObjectId

from app import categories, db, tree_v2
from app.kb import changes, qa_v1, revisions
from app.kb.pipeline import cards

from .conftest import make_user


def card(slug: str, **kw) -> ObjectId:
    doc = {"type": "concept", "title": "T", "summary": "", "body": "", "key_points": [], "tags": ["cu"],
           "categories": [slug], "status": "approved", "created_at": db.now(), "updated_at": db.now()} | kw
    return cards.insert_one(doc).inserted_id


def by_code(code: str) -> dict:
    return categories.categories.find_one({"code": code, "scheme": "v2"})


def test_full_run_idempotent_and_rollback():
    categories.ensure_indexes()
    revisions.ensure_indexes()
    changes.ensure_indexes()
    tree_v2.seed()
    admin = make_user("admin", role="admin")
    p3, other = by_code("2.5.2"), by_code("1.1")
    new_slug = p3["slug"] + ".thu-nghiem-qa"
    a = card(p3["slug"], categories=[p3["slug"], other["slug"], new_slug], title="Chuyển")
    keep = card(other["slug"], title="Giữ")
    drop = card(other["slug"], title="Bỏ", status="draft")
    ch = changes.submit_draft(cards.find_one({"_id": drop}), None)
    thin = card(other["slug"], title="Mỏng")
    x, y = card(other["slug"], title="X"), card(other["slug"], title="Y")
    data = {
        "nodes": [{"code": "2.5.2.90", "parent_code": "2.5.2", "parent_slug": p3["slug"], "slug": new_slug,
                   "name": "Thử nghiệm QA", "scope_note": "Gồm: …", "cards": 1},
                  {"code": "9.9.9.9", "parent_code": "9.9.9", "parent_slug": "khong.co", "slug": "khong.co.x",
                   "name": "Lỗi", "scope_note": "", "cards": 0}],
        "moves": [{"card_id": str(a), "from_code": "2.5.2", "to_code": "2.5.2.90", "why": "sâu hơn"},
                  {"card_id": str(keep), "from_code": "1.1", "to_code": "9.9.9.9", "why": "mã không có"},
                  {"card_id": "khong-phai-id", "from_code": "1.1", "to_code": "2.5.2.90", "why": ""}],
        "dups": [{"cluster": "1", "keep_id": str(keep), "drop_id": str(drop), "reason": "trùng", "merge_note": "Gộp ví dụ"}],
        "thin": [{"card_id": str(thin)}, {"card_id": str(ObjectId())}],
        "fix": [{"card_a": str(x), "card_b": str(y), "note": "Số liệu ngược nhau"}],
    }

    dry = qa_v1.run(apply=False, by=admin["_id"], data=data)
    assert dry["nodes_created"] == 1 and dry["updated"] == 6
    assert dict(dry["moved_by_level"]) == {"tầng 4": 1} and dry["rejected_dup"] == 1
    assert set(dry["errors"]) == {"nhanh_cha_khong_co", "ma_dich_khong_co", "id_sai", "the_khong_co"}
    assert not categories.categories.find_one({"slug": new_slug})           # chạy thử không ghi
    assert cards.find_one({"_id": a})["categories"][0] == p3["slug"]

    s = qa_v1.run(apply=True, by=admin["_id"], data=data)
    assert s["updated"] == 6 and s["nodes_created"] == 1
    node = categories.categories.find_one({"slug": new_slug})
    assert node["code"] == "2.5.2.90" and node["scheme"] == "v2" and node["scope_note"] == "Gồm: …" and node["level"] == 4
    ca = cards.find_one({"_id": a})
    assert ca["categories"] == [new_slug, other["slug"]] and ca["status"] == "approved"     # bỏ nhánh phụ trùng
    cd = cards.find_one({"_id": drop})
    assert cd["status"] == "rejected" and cd["fields"]["duplicate_of"] == str(keep) and "trung-lap" in cd["tags"]
    assert changes.change_requests.find_one({"_id": ch["_id"]})["status"] == "withdrawn"
    ck = cards.find_one({"_id": keep})
    assert ck["fields"]["qa_merge_notes"] == ["Gộp ví dụ"] and ck["tags"] == ["cu", "can-gop-noi-dung"]
    assert cards.find_one({"_id": thin})["tags"] == ["cu", "the-mong"]
    cx = cards.find_one({"_id": x})
    assert "can-sua-noi-dung" in cx["tags"] and cx["fields"]["qa_issue"] == [f"Với {y}: Số liệu ngược nhau"]

    revs = revisions.list_revisions(a)
    assert [r["reason"] for r in revs][:2] == ["QA v1 26/09 — làm sâu / chuyển nhánh", "Nội dung trước QA v1 26/09"]
    assert revisions.list_revisions(drop)[0]["reason"] == f"QA v1: trùng với {keep}"

    again = qa_v1.run(apply=True, by=admin["_id"], data=data)
    assert again["updated"] == 0 and again["nodes_created"] == 0 and again["nodes_existing"] == 1

    # quay về bản trước QA v1: nhánh cũ trở lại
    pre = next(r["rev"] for r in revs if r["reason"] == "Nội dung trước QA v1 26/09")
    revisions.rollback(cards.find_one({"_id": a}), pre, admin, "Thử quay về")
    assert cards.find_one({"_id": a})["categories"] == [p3["slug"], other["slug"], new_slug]


def test_real_data_files_parse():
    d = qa_v1.load()
    assert len(d["nodes"]) == 65 and len(d["moves"]) == 460 and len(d["dups"]) == 63
    assert len(d["thin"]) == 75 and len(d["fix"]) == 43
    assert all(n["slug"].startswith(n["parent_slug"] + ".") for n in d["nodes"])
