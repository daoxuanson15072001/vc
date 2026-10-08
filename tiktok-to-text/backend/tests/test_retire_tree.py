"""LV-01: nhật ký trước ghi, quay lui chính xác, chuyển dở và chặn tham chiếu."""
import importlib.util
from pathlib import Path
import pytest
from bson import json_util
from app import categories, db
from app.kb import retire_tree
from .test_apply_v2 import setup_tree


def fixture_tree():
    setup_tree()
    root = categories._insert("Marketing", "", None, 0, slug="marketing")
    categories._insert("SEO", "", root, 0, slug="marketing.seo")
    hidden = categories._insert("Ẩn riêng", "", root, 0, slug="marketing.copywriting")
    categories.categories.update_one({"_id": hidden["_id"]}, {"$set": {"active": False}})
    v2 = categories.categories.find_one({"slug": "mkt"})
    manual = categories._insert("Tạo tay", "", v2, 0, slug="mkt.tao-tay")
    categories.categories.update_one({"_id": manual["_id"]}, {"$unset": {"scheme": ""}})
    d = db.db.kb_documents.insert_one({"primary_category": "marketing.seo"}).inserted_id
    db.db.kb_sources.insert_one({"categories": ["marketing", "mkt", "marketing.seo"]})
    return d


def snapshot():
    return {c: list(db.db[c].find({}).sort("_id")) for c in retire_tree.FIELDS}


def test_exact_undo_and_idempotence(tmp_path):
    d = fixture_tree()
    before = snapshot()
    journal = tmp_path / "retire.json"
    result = retire_tree.retire(True, journal)
    assert result["applied"] and journal.exists()
    assert "categories" not in db.db.kb_documents.find_one({"_id": d})
    after = snapshot()
    assert retire_tree.undo(journal)["changes"] == len(result["changes"])
    assert snapshot() == after
    assert retire_tree.retire(True)["changes"] == []
    assert retire_tree.undo(journal, True)["applied"]
    assert snapshot() == before
    assert retire_tree.undo(journal, True)["changes"] == 0


def test_journal_failure_never_writes(tmp_path, monkeypatch):
    fixture_tree()
    before = snapshot()
    journal = tmp_path / "exists.json"
    journal.write_text("Giữ nguyên nhật ký cũ")
    with pytest.raises(FileExistsError):
        retire_tree.retire(True, journal)
    assert snapshot() == before
    assert journal.read_text() == "Giữ nguyên nhật ký cũ"
    def fail(_):
        raise OSError("Đĩa lỗi")
    monkeypatch.setattr(retire_tree.os, "fsync", fail)
    with pytest.raises(OSError):
        retire_tree.retire(True, tmp_path / "disk.json")
    assert snapshot() == before


def test_partial_write_can_be_undone(tmp_path, monkeypatch):
    fixture_tree()
    before = snapshot()
    original = retire_tree._write
    calls = 0
    def fail_second(*args):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise ValueError("Giả lập dừng giữa chừng")
        original(*args)
    journal = tmp_path / "partial.json"
    monkeypatch.setattr(retire_tree, "_write", fail_second)
    with pytest.raises(ValueError):
        retire_tree.retire(True, journal)
    assert snapshot() != before and journal.exists()
    monkeypatch.setattr(retire_tree, "_write", original)
    assert retire_tree.undo(journal, True)["changes"] == 1
    assert snapshot() == before


def test_undo_conflict_checks_all_before_writing(tmp_path):
    d = fixture_tree()
    journal = tmp_path / "conflict.json"
    retire_tree.retire(True, journal)
    db.db.kb_documents.update_one({"_id": d}, {"$set": {"primary_category": "mkt"}})
    before = snapshot()
    result = retire_tree.undo(journal, True)
    assert result["errors"] and not result["applied"]
    assert snapshot() == before
    data = json_util.loads(journal.read_text())
    data["database"] = "tiktok_to_text"
    journal.write_text(json_util.dumps(data))
    with pytest.raises(ValueError, match="khác database"):
        retire_tree.undo(journal, True)
    assert snapshot() == before


@pytest.mark.parametrize("coll,doc", [
    ("grants", {"scope": {"category": "marketing"}}),
    ("org_functions", {"category_root": "marketing"}),
    ("lessons", {"category": "marketing"}),
    ("courses", {"category": "marketing"}),
    ("learning_paths", {"courses": [{"category": "marketing"}]}),
    ("assignments", {"plan": [{"category": "marketing"}]}),
    ("change_requests", {"status": "open", "proposal": {"set": {"categories": ["marketing"]}}}),
])
def test_blocks_unhandled_references(tmp_path, coll, doc):
    fixture_tree()
    db.db[coll].insert_one(doc)
    before = snapshot()
    journal = tmp_path / "blocked.json"
    result = retire_tree.retire(True, journal)
    assert not result["applied"] and any(coll in e for e in result["errors"])
    assert snapshot() == before and not journal.exists()


def test_invalid_target_and_unknown_branch_block(tmp_path):
    fixture_tree()
    categories.categories.update_one({"slug": "mkt.digital.seo"}, {"$set": {"active": False}})
    categories._insert("Không có ánh xạ", "", None, 0, slug="nhanh-la")
    before = snapshot()
    result = retire_tree.retire(True, tmp_path / "blocked.json")
    assert len(result["errors"]) == 2 and not result["applied"]
    assert snapshot() == before


def test_cli_defaults_and_production_guard(tmp_path, monkeypatch):
    fixture_tree()
    path = Path(__file__).resolve().parents[1] / "scripts/retire_old_tree.py"
    spec = importlib.util.spec_from_file_location("retire_cli", path)
    cli = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cli)
    monkeypatch.setattr(cli, "OUT", tmp_path)
    before = snapshot()
    assert cli.main([]) == 0 and snapshot() == before
    assert not list(tmp_path.iterdir())
    assert cli.main(["--apply"]) == 0
    journal = next(tmp_path.iterdir())
    assert cli.main(["--undo", str(journal)]) == 0
    assert cli.main(["--undo", str(journal), "--apply"]) == 0
    assert snapshot() == before
    real_db = db.db
    monkeypatch.setattr(db, "db", db.client["tiktok_to_text"])
    assert cli.main(["--apply"]) == 1
    assert cli.main(["--undo", str(journal), "--apply"]) == 1
    monkeypatch.setattr(db, "db", real_db)
    assert snapshot() == before


def test_null_categories_and_missing_v2(tmp_path):
    d = fixture_tree()
    db.db.kb_documents.update_one({"_id": d}, {"$set": {"categories": None}})
    before = snapshot()
    journal = tmp_path / "null.json"
    assert retire_tree.retire(True, journal)["applied"]
    assert db.db.kb_documents.find_one({"_id": d})["categories"] is None
    assert retire_tree.undo(journal, True)["applied"] and snapshot() == before
    categories.categories.delete_many({"scheme": "v2"})
    before = snapshot()
    result = retire_tree.retire(True, tmp_path / "no-v2.json")
    assert not result["applied"] and any("Chưa nạp cây v2" in e for e in result["errors"])
    assert snapshot() == before
