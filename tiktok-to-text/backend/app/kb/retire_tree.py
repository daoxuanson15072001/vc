"""LV-01: chuyển cây cũ có nhật ký trước khi ghi, chạy lại và quay lui an toàn."""
from __future__ import annotations

import os
from collections import Counter
from pathlib import Path

from bson import ObjectId, json_util

from .. import categories, db
from .apply_v2 import OLD_MAP, v2_codes

FIELDS = {"kb_documents": {"categories", "primary_category"}, "kb_sources": {"categories"},
          "categories": {"scheme", "active", "hidden_by"}}


def allow_write() -> None:
    if db.db.name not in {"tiktok_to_text_qa", "tiktok_to_text_uat"} and not db.db.name.startswith("tiktok_to_text_pytest_"):
        raise ValueError("Chỉ ghi trên DB QA / UAT; không chuyển dữ liệu thật")


def _state(doc: dict, fields: set[str]) -> dict:
    return {k: doc[k] for k in fields if k in doc}


def _entry(coll: str, doc: dict, after: dict, fields: set[str]) -> dict:
    return {"collection": coll, "_id": doc["_id"], "fields": sorted(fields),
            "before": _state(doc, fields), "after": after}


def plan() -> dict:
    rows = list(categories.categories.find({}))
    roots = {c["slug"] for c in rows if c.get("scheme") == "v2" and not c.get("path")}
    root_of = lambda c: (c.get("path") or [c["slug"]])[0]
    old = [c for c in rows if root_of(c) not in roots]
    old_slugs = [c["slug"] for c in old]
    codes = v2_codes()
    live = {c["slug"] for c in categories.active_list()}
    slug_map, errors, changes = {}, [], []
    if not roots:
        errors.append("Chưa nạp cây v2 (scripts/seed_tree_v2.py)")
    for c in old:
        target = codes.get(OLD_MAP.get(c["slug"]))
        if not target or root_of(target) not in roots or target["slug"] not in live:
            errors.append(f"Nhánh cũ {c['slug']} chưa có đích v2 đang hiện trong OLD_MAP")
        else:
            slug_map[c["slug"]] = target["slug"]
    for coll, field, extra in categories.SLUG_FIELDS:
        if coll in {"kb_documents", "kb_sources"}:
            continue
        n = db.db[coll].count_documents({**extra, field.replace(".$[]", ""): {"$in": old_slugs}})
        if n:
            errors.append(f"{n} bản ghi {coll}.{field} còn nhánh cũ — xử lý trước khi giải tán")
    missing = [c["slug"] for c in rows if root_of(c) in roots and c.get("scheme") != "v2"]
    hide = [c["slug"] for c in old if not c.get("path") and c.get("active", True)]
    for coll in ("kb_documents", "kb_sources"):
        fields = FIELDS[coll]
        query = {"$or": [{k: {"$in": old_slugs}} for k in fields]}
        for doc in db.db[coll].find(query):
            after = _state(doc, fields)
            if isinstance(doc.get("categories"), list):
                after["categories"] = list(dict.fromkeys(slug_map.get(s, s) for s in doc["categories"]))
            if "primary_category" in doc:
                after["primary_category"] = slug_map.get(doc["primary_category"], doc["primary_category"])
            if after != _state(doc, fields):
                changes.append(_entry(coll, doc, after, fields))
    for c in rows:
        fields = FIELDS["categories"]
        after = _state(c, fields)
        if c["slug"] in missing:
            after["scheme"] = "v2"
        if root_of(c) in hide and (not c.get("path") or c.get("active", True)):
            after["active"] = False
            if c.get("path"):
                after["hidden_by"] = root_of(c)
            else:
                after.pop("hidden_by", None)
        if after != _state(c, fields):
            changes.append(_entry("categories", c, after, fields))
    return {"old_nodes": len(old), "missing_scheme": missing, "hide_roots": hide, "changes": changes,
            "by_collection": dict(Counter(c["collection"] for c in changes)), "errors": errors, "applied": False}


def _matches(doc: dict | None, entry: dict, state: dict) -> bool:
    return doc is not None and _state(doc, set(entry["fields"])) == state


def _write(entry: dict, before: dict, after: dict) -> None:
    query = {"_id": entry["_id"]}
    for k in entry["fields"]:
        # $exists phân biệt null với trường thiếu; $eq so khớp nguyên mảng.
        query[k] = {"$exists": k in before, **({"$eq": before[k]} if k in before else {})}
    update = {}
    if after:
        update["$set"] = after
    unset = {k: "" for k in entry["fields"] if k not in after}
    if unset:
        update["$unset"] = unset
    if db.db[entry["collection"]].update_one(query, update).matched_count != 1:
        raise ValueError(f"Dữ liệu đã đổi: {entry['collection']}/{entry['_id']}; dùng nhật ký để phục hồi")


def retire(apply: bool = False, journal_path: Path | None = None) -> dict:
    result = plan()
    if not apply or result["errors"]:
        return result
    allow_write()
    if not result["changes"]:
        result["applied"] = True
        return result
    if journal_path is None:
        raise ValueError("Cần đường dẫn nhật ký trước khi ghi")
    # Tạm dừng worker / người sửa cây trước khi vận hành; kiểm trước mọi bản rồi CAS từng bản.
    for e in result["changes"]:
        if not _matches(db.db[e["collection"]].find_one({"_id": e["_id"]}), e, e["before"]):
            raise ValueError("Dữ liệu đổi trong lúc lập kế hoạch; chạy thử lại")
    journal_path = Path(journal_path)
    journal_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": 1, "database": db.db.name, "changes": result["changes"]}
    # Không ghi đè nhật ký cũ. Đĩa lỗi thì không có lần ghi MongoDB nào.
    with journal_path.open("x", encoding="utf-8") as f:
        f.write(json_util.dumps(payload, ensure_ascii=False, indent=2))
        f.flush()
        os.fsync(f.fileno())
    directory = os.open(journal_path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)
    for entry in result["changes"]:
        _write(entry, entry["before"], entry["after"])
    result.update(applied=True, journal_path=str(journal_path))
    return result


def undo(journal_path: Path, apply: bool = False) -> dict:
    data = json_util.loads(Path(journal_path).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("version") != 1 or data.get("database") != db.db.name:
        raise ValueError("Nhật ký không hợp lệ hoặc khác database")
    entries = data.get("changes")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Nhật ký không có danh sách thay đổi")
    pending, conflicts, seen = [], [], set()
    for e in entries:
        if not isinstance(e, dict) or e.get("collection") not in FIELDS or not isinstance(e.get("_id"), ObjectId):
            raise ValueError("Bản ghi nhật ký không hợp lệ")
        fields = e.get("fields")
        if not isinstance(fields, list) or not fields or set(fields) != FIELDS[e["collection"]]:
            raise ValueError("Trường phục hồi ngoài phạm vi LV-01")
        if any(not isinstance(e.get(k), dict) or not set(e[k]).issubset(fields) for k in ("before", "after")):
            raise ValueError("Trạng thái trước / sau không hợp lệ")
        key = (e["collection"], e["_id"])
        if key in seen:
            raise ValueError("Nhật ký trùng bản ghi")
        seen.add(key)
        current = db.db[e["collection"]].find_one({"_id": e["_id"]})
        if _matches(current, e, e["before"]):
            continue
        if _matches(current, e, e["after"]):
            pending.append(e)
        else:
            conflicts.append(f"{e['collection']}/{e['_id']} đã đổi hoặc bị xoá")
    result = {"changes": len(pending), "errors": conflicts, "applied": False}
    if apply and not conflicts:
        allow_write()
        for e in reversed(pending):
            _write(e, e["after"], e["before"])
        result["applied"] = True
    return result
