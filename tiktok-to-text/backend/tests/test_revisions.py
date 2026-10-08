"""Lịch sử phiên bản + rollback thẻ VCWIKI (GOV-01, GOV-07 — docs/BA.md mục 16.5)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest import mock

import pytest
from fastapi import HTTPException

from app import db
from app.kb import revisions
from app.kb.revisions import card_revisions, cards
from app.spaces import personal_space, spaces
from tests.conftest import make_user


def new_card(owner: dict, space: dict | None = None, **fields) -> dict:
    now = db.now()
    doc = {"space_id": (space or personal_space(owner))["_id"], "type": "framework", "title": "Chốt đơn",
           "summary": "Tóm tắt", "body": "Dòng 1\nDòng 2\nDòng 3", "key_points": ["Ý A", "Ý B"], "when_to_use": "",
           "example": "", "evidence": "", "tags": ["ban-hang"], "categories": [], "status": "draft",
           "origin": "manual", "created_by": owner["_id"], "created_at": now, "updated_at": now} | fields
    doc["_id"] = cards.insert_one(doc).inserted_id
    return doc


def edit(card: dict, author: dict, reason: str = "Sửa", **changes) -> dict:
    """Mô phỏng luồng F: áp nội dung mới vào thẻ rồi ghi phiên bản."""
    cards.update_one({"_id": card["_id"]}, {"$set": changes})
    card = cards.find_one({"_id": card["_id"]})
    revisions.record_revision(card, author["_id"], reason)
    return cards.find_one({"_id": card["_id"]})


def shared_space(owner: dict, members: list[tuple[dict, str]]) -> dict:
    doc = {"name": "Kho chung", "description": "", "type": "shared", "owner_id": owner["_id"], "visibility": "private",
           "created_at": db.now(), "members": [{"user_id": owner["_id"], "role": "owner"},
                                               *({"user_id": u["_id"], "role": r} for u, r in members)]}
    doc["_id"] = spaces.insert_one(doc).inserted_id
    return doc


@pytest.fixture(autouse=True)
def indexes():
    revisions.ensure_indexes()


# ---------------------------------------------------------------------------
# Hàm lõi
# ---------------------------------------------------------------------------

def test_snapshot_only_content_fields():
    a = make_user("a")
    card = new_card(a, classification="C2")
    snap = revisions.snapshot(card)
    assert set(snap) <= set(revisions.SNAPSHOT_FIELDS)
    assert snap["title"] == "Chốt đơn" and snap["classification"] == "C2"
    assert "status" not in snap and "created_by" not in snap and "sources" not in snap


def test_record_revision_increments_and_updates_card():
    a = make_user("a")
    card = new_card(a)
    r1 = revisions.record_revision(card, a["_id"], "Bản đầu")
    card = edit(card, a, "Thêm ý", key_points=["Ý A", "Ý B", "Ý C"])
    assert r1["rev"] == 1
    assert card["current_revision"] == 2 and card["version"] == 2
    items = revisions.list_revisions(card["_id"])
    assert [r["rev"] for r in items] == [2, 1] and "snapshot" not in items[0]
    assert revisions.get_revision(card["_id"], 2)["snapshot"]["key_points"] == ["Ý A", "Ý B", "Ý C"]
    assert revisions.get_revision(card["_id"], 9) is None


def test_record_revision_requires_reason():
    a = make_user("a")
    with pytest.raises(HTTPException) as e:
        revisions.record_revision(new_card(a), a["_id"], "  ")
    assert e.value.status_code == 400


def test_record_revision_race_takes_next_number():
    """Hai lượt ghi cùng đọc max = 0: lượt sau đụng unique index và lấy số kế tiếp, không ghi đè."""
    a = make_user("a")
    card = new_card(a)
    revisions.record_revision(card, a["_id"], "Lượt 1")
    with mock.patch.object(revisions, "_latest_rev", side_effect=[0, 1]):
        r = revisions.record_revision(card | {"title": "Lượt 2"}, a["_id"], "Lượt 2")
    assert r["rev"] == 2
    assert card_revisions.count_documents({"card_id": card["_id"]}) == 2
    assert revisions.get_revision(card["_id"], 1)["snapshot"]["title"] == "Chốt đơn"
    assert cards.find_one({"_id": card["_id"]})["current_revision"] == 2


def test_current_revision_never_goes_back():
    a = make_user("a")
    card = new_card(a)
    revisions.record_revision(card, a["_id"], "1")
    revisions.record_revision(card, a["_id"], "2")
    cards.update_one({"_id": card["_id"]}, {"$max": {"current_revision": 1}})
    assert cards.find_one({"_id": card["_id"]})["current_revision"] == 2


def test_diff_line_by_line():
    a = make_user("a")
    card = new_card(a)
    revisions.record_revision(card, a["_id"], "1")
    edit(card, a, body="Dòng 1\nDòng 2 đã sửa\nDòng 3", tags=["ban-hang", "chot-don"], type="process")
    d = revisions.diff(card["_id"], 1, 2)
    assert d["from"] == 1 and d["to"] == 2
    by = {c["field"]: c for c in d["changes"]}
    assert set(by) == {"body", "tags", "type"}
    assert by["body"]["kind"] == "lines" and by["body"]["added"] == 1 and by["body"]["removed"] == 1
    assert by["body"]["lines"] == [{"op": "equal", "text": "Dòng 1"}, {"op": "delete", "text": "Dòng 2"},
                                   {"op": "insert", "text": "Dòng 2 đã sửa"}, {"op": "equal", "text": "Dòng 3"}]
    assert [x for x in by["tags"]["lines"] if x["op"] != "equal"] == [{"op": "insert", "text": "chot-don"}]
    assert by["type"]["lines"] == [{"op": "delete", "text": "framework"}, {"op": "insert", "text": "process"}]
    assert by["body"]["label"] == "Nội dung chi tiết"
    assert revisions.diff(card["_id"], 2, 2)["changes"] == []
    with pytest.raises(HTTPException) as e:
        revisions.diff(card["_id"], 1, 7)
    assert e.value.status_code == 404


def test_diff_non_text_field_as_value():
    before = {"sources": [{"title": "A"}]}
    after = {"sources": [{"title": "A"}, {"title": "B"}]}
    [c] = revisions.diff_snapshots(before, after)
    assert c["kind"] == "value" and c["before"] == before["sources"] and c["after"] == after["sources"]
    assert revisions.diff_snapshots({"example": ""}, {}) == []      # rỗng và thiếu coi như nhau


def test_rollback_creates_new_revision_and_keeps_history():
    a = make_user("a")
    card = new_card(a)
    revisions.record_revision(card, a["_id"], "Bản đầu")
    card = edit(card, a, title="Chốt đơn v2", body="Nội dung mới")
    old = list(card_revisions.find({"card_id": card["_id"]}).sort("rev", 1))

    res = revisions.rollback(card, 1, a, "Bản 2 sai số liệu")
    assert res["revision"]["rev"] == 3
    assert res["revision"]["reason"] == "Quay về bản 1: Bản 2 sai số liệu"
    assert res["revision"]["snapshot"] == revisions.get_revision(card["_id"], 1)["snapshot"]
    now = cards.find_one({"_id": card["_id"]})
    assert now["title"] == "Chốt đơn" and now["body"] == "Dòng 1\nDòng 2\nDòng 3"
    assert now["current_revision"] == 3 and now["version"] == 3
    assert "chot don" in now["search_text"]
    # bản cũ giữ nguyên
    assert list(card_revisions.find({"card_id": card["_id"], "rev": {"$lte": 2}}).sort("rev", 1)) == old


def test_rollback_removes_fields_missing_in_old_snapshot():
    a = make_user("a")
    card = new_card(a)
    revisions.record_revision(card, a["_id"], "1")
    edit(card, a, classification="C2")
    revisions.rollback(cards.find_one({"_id": card["_id"]}), 1, a, "Bỏ mức mật")
    assert "classification" not in cards.find_one({"_id": card["_id"]})


def test_rollback_rules():
    a = make_user("a")
    card = new_card(a)
    revisions.record_revision(card, a["_id"], "1")
    card = edit(card, a, title="v2")
    for rev, reason, code in [(1, " ", 400), (5, "lý do", 404), (2, "lý do", 400)]:
        with pytest.raises(HTTPException) as e:
            revisions.rollback(card, rev, a, reason)
        assert e.value.status_code == code
    assert card_revisions.count_documents({"card_id": card["_id"]}) == 2


def test_rollback_keeps_unversioned_direct_edit():
    """Sửa trực tiếp (PATCH, chưa có luồng đề xuất) rồi quay về: nội dung đang có được ghi thành một bản trước."""
    a = make_user("a")
    card = new_card(a)
    revisions.record_revision(card, a["_id"], "1")
    cards.update_one({"_id": card["_id"]}, {"$set": {"title": "Sửa tay chưa có phiên bản"}})
    card = cards.find_one({"_id": card["_id"]})
    assert revisions.has_unversioned_changes(card)
    res = revisions.rollback(card, 1, a, "Quay lại")
    assert res["revision"]["rev"] == 3
    r2 = revisions.get_revision(card["_id"], 2)
    assert r2["snapshot"]["title"] == "Sửa tay chưa có phiên bản" and r2["reason"] == revisions.UNVERSIONED_REASON
    assert cards.find_one({"_id": card["_id"]})["title"] == "Chốt đơn"


def test_module_never_updates_or_deletes_revisions():
    src = Path(revisions.__file__).read_text()
    for op in ("update_one", "update_many", "replace_one", "delete_one", "delete_many", "find_one_and"):
        assert f"card_revisions.{op}" not in src


# ---------------------------------------------------------------------------
# Chuyển dữ liệu
# ---------------------------------------------------------------------------

def test_migrate_existing_idempotent():
    a, b = make_user("a"), make_user("b")
    c1 = new_card(a, status="approved", reviewed_by=b["_id"])
    c2 = new_card(b)
    res = revisions.migrate_existing()
    assert res == {"cards": 2}
    r = revisions.get_revision(c1["_id"], 1)
    assert r["author_id"] == a["_id"] and r["approved_by"] == [b["_id"]]
    assert r["reason"] == "Phiên bản đầu (chuyển dữ liệu v0.10)"
    assert revisions.get_revision(c2["_id"], 1)["approved_by"] == []
    assert cards.find_one({"_id": c1["_id"]})["current_revision"] == 1
    assert db.db["meta"].find_one({"_id": "gov_revisions_v1"})
    # chạy lại: bỏ qua; ép chạy: không tạo trùng
    new_card(a)
    assert revisions.migrate_existing() is None
    assert revisions.migrate_existing(force=True) == {"cards": 1}
    assert card_revisions.count_documents({}) == 3


def test_migrate_recovers_half_done_card():
    """Lượt trước chèn bản 1 nhưng chưa kịp ghi con trỏ lên thẻ."""
    a = make_user("a")
    card = new_card(a)
    card_revisions.insert_one({"card_id": card["_id"], "rev": 1, "snapshot": {}, "reason": "x", "created_at": db.now()})
    assert revisions.migrate_existing() == {"cards": 0}
    assert cards.find_one({"_id": card["_id"]})["current_revision"] == 1
    assert card_revisions.count_documents({}) == 1


def test_migrate_script_runs(tmp_path):
    a = make_user("a")
    new_card(a)
    backend = Path(__file__).resolve().parents[1]
    out = subprocess.run([sys.executable, "scripts/migrate_revisions.py"], cwd=backend, capture_output=True,
                         text=True, env={"MONGO_DB": db.db.name, "PATH": "/usr/bin:/bin"}, check=True)
    assert "1 thẻ" in out.stdout
    out = subprocess.run([sys.executable, "scripts/migrate_revisions.py"], cwd=backend, capture_output=True,
                         text=True, env={"MONGO_DB": db.db.name, "PATH": "/usr/bin:/bin"}, check=True)
    assert "Đã chuyển trước đó" in out.stdout


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

def test_api_list_get_diff(client):
    a = make_user("a")
    card = new_card(a)
    client.login(a)
    cid = str(card["_id"])
    r = client.get(f"/api/wiki/cards/{cid}/revisions").json()
    assert r == {"items": [], "current_revision": None, "can_rollback": True, "has_unversioned_changes": False}
    assert client.get(f"/api/wiki/cards/{cid}/diff").status_code == 404

    revisions.record_revision(card, a["_id"], "Bản đầu")
    edit(card, a, "Bổ sung", body="Dòng 1\nDòng mới")
    r = client.get(f"/api/wiki/cards/{cid}/revisions").json()
    assert [i["rev"] for i in r["items"]] == [2, 1] and r["current_revision"] == 2
    assert r["items"][0]["author_name"] == "a" and r["items"][0]["current"] and not r["items"][1]["current"]
    assert r["items"][0]["card_id"] == cid

    one = client.get(f"/api/wiki/cards/{cid}/revisions/1").json()
    assert one["snapshot"]["body"] == "Dòng 1\nDòng 2\nDòng 3" and one["reason"] == "Bản đầu"
    assert client.get(f"/api/wiki/cards/{cid}/revisions/5").status_code == 404

    d = client.get(f"/api/wiki/cards/{cid}/diff").json()          # mặc định: bản hiệu lực với bản trước
    assert d["from"] == 1 and d["to"] == 2 and [c["field"] for c in d["changes"]] == ["body"]
    d = client.get(f"/api/wiki/cards/{cid}/diff", params={"from": 2, "to": 1}).json()
    assert d["from"] == 2 and d["to"] == 1


def test_api_rollback(client):
    a = make_user("a")
    card = new_card(a)
    revisions.record_revision(card, a["_id"], "Bản đầu")
    edit(card, a, title="Tiêu đề sai")
    client.login(a)
    cid = str(card["_id"])
    assert client.post(f"/api/wiki/cards/{cid}/rollback", json={"rev": 1, "reason": ""}).status_code == 422
    r = client.post(f"/api/wiki/cards/{cid}/rollback", json={"rev": 1, "reason": "Tiêu đề sai"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["card"]["title"] == "Chốt đơn" and body["card"]["current_revision"] == 3
    assert body["revision"]["rev"] == 3 and body["revision"]["author_name"] == "a"
    assert client.get(f"/api/wiki/cards/{cid}").json()["title"] == "Chốt đơn"


def test_api_permissions(client):
    owner, viewer, stranger = make_user("owner"), make_user("viewer"), make_user("stranger")
    space = shared_space(owner, [(viewer, "viewer")])
    card = new_card(owner, space)
    revisions.record_revision(card, owner["_id"], "1")
    edit(card, owner, title="v2")
    cid = str(card["_id"])

    client.login(stranger)
    for method, path in [("GET", f"/api/wiki/cards/{cid}/revisions"), ("GET", f"/api/wiki/cards/{cid}/revisions/1"),
                         ("GET", f"/api/wiki/cards/{cid}/diff"), ("GET", "/api/wiki/cards/khong-hop-le/revisions")]:
        assert client.request(method, path).status_code == 404
    assert client.post(f"/api/wiki/cards/{cid}/rollback", json={"rev": 1, "reason": "x"}).status_code == 404

    client.login(viewer)
    r = client.get(f"/api/wiki/cards/{cid}/revisions").json()
    assert len(r["items"]) == 2 and r["can_rollback"] is False
    assert client.post(f"/api/wiki/cards/{cid}/rollback", json={"rev": 1, "reason": "x"}).status_code == 403
    assert card_revisions.count_documents({"card_id": card["_id"]}) == 2


def test_api_requires_login(client):
    for method, path in [("GET", "/api/wiki/cards/x/revisions"), ("GET", "/api/wiki/cards/x/revisions/1"),
                         ("GET", "/api/wiki/cards/x/diff"), ("POST", "/api/wiki/cards/x/rollback")]:
        assert client.request(method, path).status_code == 401
