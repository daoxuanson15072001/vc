"""Script chuyển dữ liệu `scripts/chuyen_khoa_hoc.py` (DESIGN TK-15a): chạy thử không ghi, --apply hai lần như một,
thứ tự theo lộ trình cũ rồi ngày tạo, hoà lĩnh vực, --undo giữ bài người soạn đã sửa."""

from __future__ import annotations

import importlib.util
import sys
from datetime import timedelta
from pathlib import Path

import pytest

from app import categories as cat_mod
from app import db
from app.learn.models import learning_paths, lessons
from tests.test_learn_api import add_card, shared_space

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "chuyen_khoa_hoc.py"


@pytest.fixture
def script():
    spec = importlib.util.spec_from_file_location("chuyen_khoa_hoc", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run(mod, monkeypatch, *args):
    monkeypatch.setattr(sys, "argv", ["chuyen_khoa_hoc.py", *args])
    return mod.main()


@pytest.fixture
def old(org_sample):
    """Dữ liệu kiểu cũ: bài không có category / seq, một lộ trình tuần đã phát hành."""
    p = org_sample["people"]
    nen = cat_mod._insert("Nền", "", None, 0, slug="nen")
    cat_mod._insert("Lịch bảo dưỡng", "", nen, 0, slug="nen.lich")
    cat_mod._insert("Garage", "", nen, 1, slug="nen.garage")
    s = shared_space(p["tp_part_kd"])
    lich = add_card(s, "Lịch", categories=["nen.lich"])
    gara = add_card(s, "Gara", categories=["nen.garage"])
    both = add_card(s, "Cả hai", categories=["nen.lich", "nen.garage"])
    bare = add_card(s, "Không lĩnh vực", categories=[])
    t0 = db.now() - timedelta(days=10)

    def lesson(title, cards_, days):
        doc = {"title": title, "items": [{"card_id": c["_id"], "rev": 1} for c in cards_], "status": "published",
               "space_id": s["_id"], "created_by": p["tp_part_kd"]["_id"], "created_at": t0 + timedelta(days=days),
               "updated_at": t0 + timedelta(days=days)}
        doc["_id"] = lessons.insert_one(doc).inserted_id
        return doc
    L = {
        "moi": lesson("Lịch — mới tạo, không trong lộ trình", [lich], 5),
        "tuan2": lesson("Lịch — tuần 2", [lich, both], 1),
        "tuan1": lesson("Lịch — tuần 1", [lich], 3),
        "gara": lesson("Garage", [gara, gara], 0),
        "hoa": lesson("Hoà", [lich, gara], 2),           # 1–1, mỗi thẻ một lĩnh vực chính → thẻ đầu bài: nen.lich
        "trong": lesson("Không lĩnh vực", [bare], 4),
    }
    learning_paths.insert_one({"title": "T10", "period": "month", "year": 2026, "month": 10, "status": "published",
                               "modules": [{"week": 1, "lesson_ids": [L["tuan1"]["_id"]]},
                                           {"week": 2, "lesson_ids": [L["tuan2"]["_id"]]}]})
    return L


def state():
    return {r["title"]: (r.get("category", "—"), r.get("seq")) for r in lessons.find()}


def test_dry_run_writes_nothing(script, old, monkeypatch, capsys):
    before = state()
    assert run(script, monkeypatch) == 0
    assert state() == before and learning_paths.count_documents({"kind": {"$exists": True}}) == 0
    out = capsys.readouterr().out
    assert "chạy thử" in out and "Chưa xếp khoá" in out and "Hoà số thẻ" in out


def test_apply_twice_same_result(script, old, monkeypatch):
    assert run(script, monkeypatch, "--apply", "--no-backup") == 0
    got = state()
    assert got == {
        "Lịch — tuần 1": ("nen.lich", 10),                      # theo lộ trình: tuần 1 trước tuần 2
        "Lịch — tuần 2": ("nen.lich", 20),
        "Hoà": ("nen.lich", 30),                                 # ngoài lộ trình → theo ngày tạo (ngày 2)
        "Lịch — mới tạo, không trong lộ trình": ("nen.lich", 40),  # (ngày 5)
        "Garage": ("nen.garage", 10),                            # thẻ trùng trong bài chỉ tính một lần
        "Không lĩnh vực": (None, 10),
    }
    assert learning_paths.find_one()["kind"] == "weeks"
    assert run(script, monkeypatch, "--apply", "--no-backup") == 0
    assert state() == got


def test_apply_appends_after_existing_course(script, old, monkeypatch):
    lessons.insert_one({"title": "Bài mới đã có khoá", "category": "nen.lich", "seq": 10, "items": []})
    lessons.insert_one({"title": "Có khoá, thiếu seq", "category": "nen.garage", "items": []})
    run(script, monkeypatch, "--apply", "--no-backup")
    got = state()
    assert got["Bài mới đã có khoá"] == ("nen.lich", 10) and got["Lịch — tuần 1"] == ("nen.lich", 20)
    # bài đã có khoá (người soạn chọn), chỉ thiếu seq: giữ khoá, được đánh số cùng lượt (không ngày tạo → đầu khoá)
    assert (got["Có khoá, thiếu seq"], got["Garage"]) == (("nen.garage", 10), ("nen.garage", 20))


def test_undo_keeps_edited(script, old, monkeypatch, capsys):
    before = state()
    run(script, monkeypatch, "--apply", "--no-backup")
    lessons.update_one({"_id": old["gara"]["_id"]}, {"$set": {"category": "nen.lich", "updated_at": db.now()}})
    assert run(script, monkeypatch, "--undo") == 0
    got = state()
    assert got.pop("Garage")[0] == "nen.lich"
    before.pop("Garage")
    assert got == before
    assert "kind" not in learning_paths.find_one()
    assert "giữ: Garage" in capsys.readouterr().out
