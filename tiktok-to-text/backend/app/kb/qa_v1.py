"""QA v1 kho VCWIKI (26/09/2026, yêu cầu 6ab7d4de…bd27): làm sâu nhánh tầng 4, chuyển nhánh chính, loại thẻ trùng,
gắn cờ thẻ mỏng / cần sửa nội dung. Gọi từ `scripts/apply_qa_v1.py` (chạy thử mặc định, `--apply` mới ghi).

Đầu vào (`scripts/data/`, Claude Desktop rà 1.543 thẻ):
1. `qa_v1_nhanh_tang4_moi.json` — nhánh tầng 4 mới: code, parent_code, parent_slug, slug, name, scope_note.
2. `qa_v1_chuyen_nhanh.csv` — card_id, from_code, to_code, why: đổi nhánh CHÍNH (categories[0]) sang nhánh to_code,
   giữ nhánh phụ (bỏ nhánh phụ trùng nhánh chính mới).
3. `qa_v1_the_trung.csv` — keep_id, drop_id, merge_note: thẻ drop → status `rejected` (không xoá cứng),
   fields.duplicate_of = keep_id, tag `trung-lap`, rút đề xuất đang mở; thẻ keep có merge_note → fields.qa_merge_notes +
   tag `can-gop-noi-dung`. Không sửa nội dung thẻ.
4. `qa_v1_the_mong.csv` — tag `the-mong`.
5. `qa_v1_can_sua_noi_dung.csv` — cặp card_a / card_b: tag `can-sua-noi-dung` cả hai, fields.qa_issue (danh sách
   "Với <id thẻ kia>: <note>").

Nhánh mới: như seed cây v2 (scheme v2, scope_note_seed) — đã có theo slug thì bỏ qua. Mỗi thẻ đổi: gom mọi thay đổi
của thẻ thành MỘT phiên bản theo luật luồng C (BA 16.5), lý do ghép các phần ("QA v1 26/09 — làm sâu / chuyển nhánh",
"QA v1: trùng với <keep_id>", …); thẻ chưa có phiên bản / có sửa trực tiếp chưa ghi thì ghi trước bản chụp nội dung cũ
để quay về được. Snapshot phiên bản không chứa status / fields — quay về bản cũ khôi phục nhánh + tag, không khôi phục
status của thẻ trùng (đặt lại tay). Không đổi updated_at. Chạy lại: thẻ đã đúng thì bỏ qua (0 thay đổi); meta `qa_v1`
ghi lần áp gần nhất.
"""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

from bson import ObjectId
from bson.errors import InvalidId

from .. import categories as cat_mod
from .. import db
from . import changes, revisions, tags_v2
from .pipeline import card_search_text, cards

DATA = Path(__file__).resolve().parents[2] / "scripts" / "data"
FILES = {"nodes": "qa_v1_nhanh_tang4_moi.json", "moves": "qa_v1_chuyen_nhanh.csv", "dups": "qa_v1_the_trung.csv",
         "thin": "qa_v1_the_mong.csv", "fix": "qa_v1_can_sua_noi_dung.csv"}
META_ID = "qa_v1"
MOVE_REASON = "QA v1 26/09 — làm sâu / chuyển nhánh"
PRE_REASON = "Nội dung trước QA v1 26/09"
DUP_TAG, MERGE_TAG, THIN_TAG, FIX_TAG = "trung-lap", "can-gop-noi-dung", "the-mong", "can-sua-noi-dung"


def _csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [{k: (v or "").strip() for k, v in r.items()} for r in csv.DictReader(f)]


def load(data_dir: Path = DATA) -> dict:
    return {"nodes": json.loads((data_dir / FILES["nodes"]).read_text(encoding="utf-8")),
            **{k: _csv(data_dir / FILES[k]) for k in ("moves", "dups", "thin", "fix")}}


def _oid(v: str) -> ObjectId | None:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        return None


def _code_map() -> dict[str, dict]:
    return {c["code"]: c for c in cat_mod.categories.find({"scheme": "v2", "code": {"$ne": None}})}


# ---------------------------------------------------------------------------
# a. Nhánh tầng 4
# ---------------------------------------------------------------------------

def seed_nodes(nodes: list[dict], apply: bool, stats: dict) -> dict[str, dict]:
    """Tạo nhánh mới. Trả bảng mã → nhánh (gồm nhánh sắp tạo khi chạy thử) để bước chuyển thẻ dùng."""
    codes = _code_map()
    for n in nodes:
        code, slug = n["code"].strip(), n["slug"].strip()
        parent = cat_mod.categories.find_one({"slug": n["parent_slug"].strip()})
        if not parent or parent.get("code") != n["parent_code"].strip():
            stats["errors"]["nhanh_cha_khong_co"] += 1
            stats["error_rows"].append((code, "nhanh_cha_khong_co", f"{n['parent_code']} {n['parent_slug']}"))
            continue
        old = cat_mod.categories.find_one({"slug": slug})
        if old:
            if old.get("code") != code:
                stats["errors"]["slug_trung_ma_khac"] += 1
                stats["error_rows"].append((code, "slug_trung_ma_khac", f"{slug} đang là {old.get('code')}"))
                continue
            stats["nodes_existing"] += 1
            codes[code] = old
            continue
        if code in codes:
            stats["errors"]["ma_da_dung"] += 1
            stats["error_rows"].append((code, "ma_da_dung", codes[code]["slug"]))
            continue
        stats["nodes_created"] += 1
        order = int(code.rsplit(".", 1)[-1]) if code.rsplit(".", 1)[-1].isdigit() else 99
        if not apply:
            codes[code] = {"slug": slug, "code": code, "name": n["name"]}
            continue
        doc = cat_mod._insert(n["name"], "", parent, order, slug=slug, code=code, scope_note=n.get("scope_note", ""))
        cat_mod.categories.update_one({"_id": doc["_id"]}, {"$set": {"scheme": "v2",
                                                                     "scope_note_seed": doc["scope_note"]}})
        codes[code] = doc
    return codes


# ---------------------------------------------------------------------------
# b–d. Thẻ
# ---------------------------------------------------------------------------

def _plan(data: dict, codes: dict, stats: dict) -> dict[ObjectId, dict]:
    """Gom thay đổi theo thẻ: {card_id: {"move": slug, "move_level": n, "dup_of": id, "merge_notes": [...],
    "tags": set, "issues": [...], "reasons": [...]}}."""
    plan: dict[ObjectId, dict] = {}
    slug_code = {c["slug"]: code for code, c in codes.items()}

    def entry(cid_str: str, what: str) -> dict | None:
        cid = _oid(cid_str)
        if not cid:
            stats["errors"]["id_sai"] += 1
            stats["error_rows"].append((cid_str, "id_sai", what))
            return None
        return plan.setdefault(cid, {"tags": set(), "merge_notes": [], "issues": [], "reasons": []})

    for r in data["moves"]:
        to = codes.get(r["to_code"])
        if not to:
            stats["errors"]["ma_dich_khong_co"] += 1
            stats["error_rows"].append((r["card_id"], "ma_dich_khong_co", r["to_code"]))
            continue
        if e := entry(r["card_id"], "chuyen_nhanh"):
            e |= {"move": to["slug"], "move_level": r["to_code"].count(".") + 1, "from_code": r["from_code"],
                  "to_code": r["to_code"]}
            e["reasons"].append(MOVE_REASON)
    drops = set()
    for r in data["dups"]:
        if r["keep_id"] == r["drop_id"]:
            stats["errors"]["giu_bo_cung_the"] += 1
            stats["error_rows"].append((r["drop_id"], "giu_bo_cung_the", r.get("cluster", "")))
            continue
        if not _oid(r["keep_id"]):
            stats["errors"]["id_sai"] += 1
            stats["error_rows"].append((r["keep_id"], "id_sai", "the_trung keep"))
            continue
        if (e := entry(r["drop_id"], "the_trung drop")) and r["drop_id"] not in drops:
            drops.add(r["drop_id"])
            e["dup_of"] = r["keep_id"]
            e["tags"].add(DUP_TAG)
            e["reasons"].append(f"QA v1: trùng với {r['keep_id']}")
        if r.get("merge_note") and (e := entry(r["keep_id"], "the_trung keep")):
            if r["merge_note"] not in e["merge_notes"]:
                e["merge_notes"].append(r["merge_note"])
            e["tags"].add(MERGE_TAG)
    for cid in drops & {r["keep_id"] for r in data["dups"]}:
        stats["warnings"].append(f"{cid}: vừa là thẻ giữ vừa là thẻ bỏ trong file thẻ trùng — vẫn bỏ")
    for r in data["thin"]:
        if e := entry(r["card_id"], "the_mong"):
            e["tags"].add(THIN_TAG)
    for r in data["fix"]:
        for me, other in ((r["card_a"], r["card_b"]), (r["card_b"], r["card_a"])):
            if e := entry(me, "can_sua"):
                e["tags"].add(FIX_TAG)
                note = f"Với {other}: {r['note']}"
                if note not in e["issues"]:
                    e["issues"].append(note)
    for e in plan.values():
        if e["merge_notes"]:
            e["reasons"].append("QA v1: cần gộp nội dung thẻ trùng")
        if e["tags"] - {DUP_TAG, MERGE_TAG}:
            e["reasons"].append("QA v1: gắn cờ " + ", ".join(sorted(e["tags"] - {DUP_TAG, MERGE_TAG})))
    stats["_slug_code"] = slug_code
    return plan


def target(card: dict, e: dict) -> tuple[dict, dict]:
    """(trường nội dung cần đổi — vào phiên bản, trường ngoài snapshot — status / fields). Rỗng = đã đúng."""
    content: dict = {}
    other: dict = {}
    cats = list(card.get("categories") or [])
    if e.get("move"):
        new = [e["move"], *[c for c in cats[1:] if c != e["move"]]]
        if new != cats:
            content["categories"] = new
    old_tags = card.get("tags") or []
    if add := [t for t in tags_v2.clean(sorted(e["tags"])) if t not in old_tags]:   # chỉ thêm, không dọn tag cũ
        content["tags"] = [*old_tags, *add]
    fields = dict(card.get("fields") or {})
    if e.get("dup_of"):
        fields["duplicate_of"] = e["dup_of"]
        if card.get("status") != "rejected":
            other["status"] = "rejected"
    if e["merge_notes"]:
        fields["qa_merge_notes"] = list(dict.fromkeys([*(fields.get("qa_merge_notes") or []), *e["merge_notes"]]))
    if e["issues"]:
        fields["qa_issue"] = list(dict.fromkeys([*(fields.get("qa_issue") or []), *e["issues"]]))
    if fields != (card.get("fields") or {}):
        other["fields"] = fields
    return content, other


def _write(card: dict, content: dict, other: dict, reason: str, by: ObjectId | None) -> None:
    if content and (not card.get("current_revision") or revisions.has_unversioned_changes(card)):
        revisions.record_revision(card, by, PRE_REASON)
    new = card | content | other
    cards.update_one({"_id": card["_id"]}, {"$set": content | other | {"search_text": card_search_text(new)}})
    if other.get("status") == "rejected":
        changes.close_open(card["_id"], "Thẻ trùng — loại ở QA v1 26/09")
    if content:
        revisions.record_revision(cards.find_one({"_id": card["_id"]}), by, reason)


def run(apply: bool = False, by: ObjectId | None = None, data: dict | None = None) -> dict:
    data = data or load()
    stats: dict = {"nodes_in_file": len(data["nodes"]), "nodes_created": 0, "nodes_existing": 0,
                   "cards_planned": 0, "updated": 0, "unchanged": 0, "moved_by_level": Counter(),
                   "move_from_mismatch": 0, "rejected_dup": 0, "keep_merge_notes": 0, "tags_added": Counter(),
                   "errors": Counter(), "error_rows": [], "warnings": [], "log": []}
    codes = seed_nodes(data["nodes"], apply, stats)
    plan = _plan(data, codes, stats)
    slug_code = stats.pop("_slug_code")
    stats["cards_planned"] = len(plan)
    found = {c["_id"]: c for c in cards.find({"_id": {"$in": list(plan)}})}
    for cid, e in plan.items():
        card = found.get(cid)
        if not card:
            stats["errors"]["the_khong_co"] += 1
            stats["error_rows"].append((str(cid), "the_khong_co", ""))
            continue
        cur_primary = (card.get("categories") or [None])[0]
        if e.get("move") and cur_primary != e["move"] and slug_code.get(cur_primary) != e["from_code"]:
            stats["move_from_mismatch"] += 1
            stats["warnings"].append(f"{cid}: nhánh chính đang là {slug_code.get(cur_primary) or cur_primary}, "
                                     f"file ghi từ {e['from_code']} — vẫn chuyển sang {e['to_code']}")
        content, other = target(card, e)
        if not content and not other:
            stats["unchanged"] += 1
            stats["log"].append((str(cid), "giu_nguyen", ""))
            continue
        stats["updated"] += 1
        if "categories" in content:
            stats["moved_by_level"][f"tầng {e['move_level']}"] += 1
        if other.get("status") == "rejected":
            stats["rejected_dup"] += 1
        if e["merge_notes"] and (other.get("fields") or {}).get("qa_merge_notes") != (card.get("fields") or {}).get("qa_merge_notes"):
            stats["keep_merge_notes"] += 1
        for t in set(content.get("tags") or []) - set(card.get("tags") or []):
            stats["tags_added"][t] += 1
        reason = " · ".join(dict.fromkeys(e["reasons"])) or MOVE_REASON
        stats["log"].append((str(cid), "cap_nhat", ",".join(sorted([*content, *other])) + f" | {reason}"))
        if apply:
            _write(card, content, other, reason, by)
    if apply:
        now = db.now()
        revisions.meta.update_one({"_id": META_ID}, {
            "$set": {"applied_at": now, "updated": stats["updated"], "nodes_created": stats["nodes_created"]},
            "$setOnInsert": {"first_applied_at": now}, "$inc": {"runs": 1}}, upsert=True)
    return stats
