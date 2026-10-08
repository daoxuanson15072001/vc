"""R4: áp bảng quyết định A2 (app/kb/apply_v2.py) — đối chiếu mã / tên / enum, ghi phiên bản, rollback, dọn rác XML,
xếp tạm thẻ không có dòng, chạy lại 0 thay đổi."""

from __future__ import annotations

from bson import ObjectId

from app import categories, db, tree_v2
from app.kb import apply_v2, revisions
from app.kb.pipeline import cards

from .conftest import make_user


def card(**kw) -> ObjectId:
    doc = {"type": "concept", "title": "T", "summary": "", "body": "", "key_points": [], "tags": [],
           "categories": ["marketing.seo"], "status": "approved", "created_at": db.now(), "updated_at": db.now()} | kw
    return cards.insert_one(doc).inserted_id


def row(cid, **kw) -> dict:
    return {"card_id": str(cid), "node": "1.1.6", "node_name": "Sản phẩm & danh mục marketing", "secondary_nodes": "",
            "level": "nhap-mon", "type": "framework", "division": "tap-doan", "process_steps": "",
            "tags": "Koc|the-hoang-work", "confidence": "cao", "note": ""} | kw


def setup_tree():
    categories.ensure_indexes()
    tree_v2.seed()


def test_apply_rollback_idempotent():
    setup_tree()
    admin = make_user("admin", role="admin")
    a = card(title="Marketing mix 4P")
    b = card(title="Thẻ thấp", categories=["marketing"])
    junk = card(title="Rác", summary='Tóm tắt thật.</summary>\n<parameter name="key_points">["Ý 1", "Ý 2"]')
    rows = [row(a), row(b, node="2.5.4.1", node_name="GMV Max", level="van-hanh", type="sop", division="vcpart",
                        process_steps="qt.san-tmdt.b", confidence="thap", note="Có thể 2.5.4.4"),
            row(junk, node="1.1", node_name="Chiến lược & thương hiệu")]
    s = apply_v2.run(apply=True, rows=rows, by=admin["_id"])
    assert s["updated"] == 3 and not s["errors"]
    ca, cb, cj = (cards.find_one({"_id": i}) for i in (a, b, junk))
    assert ca["categories"] == ["mkt.chien-luoc.san-pham-4p"] and ca["level"] == "nhap-mon"
    assert ca["type"] == "framework" and ca["tags"] == ["affiliate-koc", "nguon-the-hoang-work"]
    assert "division" not in ca                     # mặc định tap-doan không ghi
    assert cb["categories"] == ["bh.san-tmdt.quang-cao-gmv-max.gmv-max"] and cb["division"] == ["vcpart"]
    assert "xem-lai-phan-loai" in cb["tags"] and cb["fields"]["phan_loai_v2_note"] == "Có thể 2.5.4.4"
    assert cb["status"] == "approved"
    assert cj["summary"] == "Tóm tắt thật." and cj["key_points"] == ["Ý 1", "Ý 2"]
    # phiên bản: bản chụp cũ + bản v2; quay về bản trước = nội dung cũ
    revs = revisions.list_revisions(a)
    assert [r["reason"] for r in revs] == [apply_v2.REASON, apply_v2.PRE_REASON]
    back = revisions.rollback(ca, revs[1]["rev"], admin, "thử")["card"]
    assert back["categories"] == ["marketing.seo"] and back["type"] == "concept" and "level" not in back
    # chạy lại: thẻ a đã bị rollback nên được áp lại, hai thẻ kia giữ nguyên
    again = apply_v2.run(apply=True, rows=rows, by=admin["_id"])
    assert again["updated"] == 1 and again["unchanged"] == 2
    assert apply_v2.run(apply=True, rows=rows)["updated"] == 0


def test_errors_and_name_matching():
    setup_tree()
    a = card()
    rows = [row(a, node="9.9"), row(a, node_name="Kế toán thuế"), row(a, level="sep"), row(a, division="vcx"),
            row(a, process_steps="qt.x.e"), row(a, secondary_nodes="7.7"), row("6ab4ab6776d151ae7e7a0000")]
    s = apply_v2.run(apply=False, rows=rows)
    assert dict(s["errors"]) == {"ma_khong_co": 1, "ten_lech": 1, "enum_level": 1, "enum_division": 1,
                                 "enum_process_steps": 1, "ma_phu_khong_co": 1, "the_khong_con": 1}
    assert cards.find_one({"_id": a})["categories"] == ["marketing.seo"]     # chạy thử không ghi
    assert apply_v2.name_close("HĐLĐ & nội quy", "Hợp đồng lao động & nội quy")
    assert apply_v2.name_close("Vận hành shop", "Vận hành shop (listing, đơn, hoàn huỷ)")
    assert not apply_v2.name_close("GMV Max", "Thuế GTGT")


def test_unsorted_and_test_card():
    setup_tree()
    old = card(title="Chưa có dòng", categories=["ke-toan.thue", "marketing.seo"])
    empty = card(title="Không lĩnh vực", categories=[])
    mem = card(type="context", categories=[])
    test = cards.insert_one({"_id": ObjectId(apply_v2.TEST_CARDS[0]), "type": "framework", "title": "[TEST]",
                             "tags": [], "categories": []}).inserted_id
    s = apply_v2.run(apply=True, rows=[])
    assert {u["card_id"] for u in s["unsorted"]} == {str(old), str(empty)}
    c = cards.find_one({"_id": old})
    assert c["categories"] == ["tckt.thue", "mkt.digital.seo"] and "chua-xep-v2" in c["tags"]
    assert "chua-xep-v2" in cards.find_one({"_id": empty})["tags"]
    assert "chua-xep-v2" not in cards.find_one({"_id": mem})["tags"]
    assert not cards.find_one({"_id": test}) and s["deleted"] == 1
    assert apply_v2.run(apply=True, rows=[])["updated"] == 0
    apply_v2.UNSORTED_CSV.unlink(missing_ok=True)


def test_retire_old_tree(tmp_path):
    setup_tree()
    old = categories._insert("Marketing", "", None, 0, slug="marketing")
    categories._insert("SEO", "", old, 0, slug="marketing.seo")
    kt = categories._insert("Kế toán", "", None, 1, slug="ke-toan")
    categories._insert("Thuế", "", kt, 0, slug="ke-toan.thue")
    v2 = categories.categories.find_one({"slug": "mkt.digital.seo"})
    categories.categories.insert_one({"slug": "mkt.digital.seo.thu-nghiem", "name": "Nhánh tạo tay", "code": "1.3.1.99",
                                      "parent_id": v2["_id"], "path": [*v2["path"], v2["slug"]], "level": 4,
                                      "active": True})          # tạo tay trước khi _insert kế thừa scheme
    docs, srcs = db.db["kb_documents"], db.db["kb_sources"]
    d = docs.insert_one({"categories": ["marketing.seo", "mkt.digital.seo", "ke-toan.thue"],
                         "primary_category": "marketing.seo"}).inserted_id
    s = srcs.insert_one({"categories": ["ke-toan"]}).inserted_id

    dry = apply_v2.retire_old_tree()
    assert not dry["applied"] and not dry["errors"] and dry["by_collection"] == {"kb_documents": 1, "kb_sources": 1, "categories": 5}
    assert docs.find_one({"_id": d})["primary_category"] == "marketing.seo"        # chạy thử không ghi

    card(categories=["marketing.seo"])
    blocked = apply_v2.retire_old_tree(apply=True)
    assert not blocked["applied"] and "wiki_cards.categories còn nhánh cũ" in blocked["errors"][0]
    cards.delete_many({})

    r = apply_v2.retire_old_tree(apply=True, journal_path=tmp_path / "retire.json")
    assert r["applied"] and sorted(r["hide_roots"]) == ["ke-toan", "marketing"]
    assert r["missing_scheme"] == ["mkt.digital.seo.thu-nghiem"]
    doc = docs.find_one({"_id": d})
    assert doc["categories"] == ["mkt.digital.seo", "tckt.thue"] and doc["primary_category"] == "mkt.digital.seo"
    assert srcs.find_one({"_id": s})["categories"] == ["tckt"]
    active = {c["slug"] for c in categories.active_list()}
    assert not active & {"marketing", "marketing.seo", "ke-toan", "ke-toan.thue"} and "mkt" in active
    assert "mkt.digital.seo.thu-nghiem" in {c["slug"] for c in categories.ai_list()}
    again = apply_v2.retire_old_tree(apply=True)
    assert not again["changes"] and not again["hide_roots"] and not again["missing_scheme"]
