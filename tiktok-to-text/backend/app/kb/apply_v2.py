"""Áp bảng quyết định A2 (Claude Desktop đọc 1.538 thẻ, 26/09/2026) lên thẻ VCWIKI: cây v2 + 5 trục phân loại.

Đầu vào: `scripts/data/vcwiki_card_decisions_v2.csv` (UTF-8 BOM) — card_id · node (mã hiển thị, vd 4.3.3.3) ·
node_name · secondary_nodes · level · type · division · process_steps · tags · confidence · note (cột old_* chỉ để
đối chiếu). Gọi từ `scripts/apply_card_decisions.py` (chạy thử mặc định, `--apply` mới ghi).

Mỗi thẻ đổi: ghi phiên bản theo luật luồng C (BA 16.5) — phiên bản mang nội dung MỚI, lý do `REASON`; nếu thẻ chưa
có phiên bản nào hoặc đang có sửa trực tiếp chưa ghi phiên bản (vd tag vừa dọn ở R3) thì ghi trước một bản chụp nội
dung cũ (`PRE_REASON`) — quay về bản ngay trước = lĩnh vực / loại / tag cũ. Không đổi status, không đổi updated_at
(danh sách thẻ sắp theo updated_at không bị xáo). Chạy lại: thẻ đã đúng bảng thì bỏ qua (0 thay đổi).
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

from bson import ObjectId
from bson.errors import InvalidId

from .. import categories as cat_mod
from .. import db
from . import classify, embeddings, revisions, tags_v2
from .pipeline import card_search_text, cards
from .wiki import AI_CARD_TYPES, CARD_TYPES

CSV_PATH = Path(__file__).resolve().parents[2] / "scripts" / "data" / "vcwiki_card_decisions_v2.csv"
UNSORTED_CSV = Path(__file__).resolve().parents[2] / "scripts" / "data" / "chua_co_dong.csv"
REASON = "Xếp theo cây v2 (A2 26/09)"
PRE_REASON = "Nội dung trước khi xếp theo cây v2"
LOW_TAG = "xem-lai-phan-loai"        # độ tin cậy thấp: giám đốc chuyên ngành lọc sửa sau
UNSORTED_TAG = "chua-xep-v2"         # thẻ không có dòng trong bảng: xếp tạm theo cây cũ, chờ AI xếp lại
NOTE_FIELD = "phan_loai_v2_note"     # fields.<...>: phương án thay thế của thẻ độ tin cậy thấp
TEST_CARDS = ["6ab4ab6776d151ae7e7a9804"]   # "[TEST] Skill: Checklist 3 bước trước khi gửi email" — xoá
CONTENT = ("summary", "body", "when_to_use", "example", "evidence")
NAME_MIN_OVERLAP = 0.5

# Nhánh cây cũ -> mã cây v2 (Phân loại v2 mục 12: giữ / gộp / tách / giải tán; tách lấy nhánh chính, tới tầng 2–3)
OLD_MAP = {
    "marketing": "1", "marketing.chien-luoc-thuong-hieu": "1.1", "marketing.tam-ly-khach-hang": "1.2.3",
    "marketing.chan-dung-khach-hang": "1.2.1", "marketing.nghien-cuu-thi-truong-doi-thu": "1.2.4",
    "marketing.seo": "1.3.1", "marketing.quang-cao-tra-phi": "1.3.2", "marketing.video-ngan-tiktok": "1.3.4",
    "marketing.noi-dung-mang-xa-hoi": "1.3.3", "marketing.copywriting": "1.4.2",
    "ban-hang-cskh": "2", "ban-hang-cskh.ky-nang-ban-hang": "2.2", "ban-hang-cskh.dam-phan": "2.3.3",
    "ban-hang-cskh.cham-soc-khach-hang": "2.6", "ban-hang-cskh.kenh-phan-phoi": "2.5",
    "tai-chinh": "3", "tai-chinh.ngan-sach-ke-hoach": "3.1", "tai-chinh.quan-tri-dong-tien": "3.2",
    "tai-chinh.phan-tich-tai-chinh": "3.3", "tai-chinh.dau-tu-huy-dong-von": "3.4",
    "ke-toan": "3", "ke-toan.ke-toan-tai-chinh": "3.5", "ke-toan.ke-toan-quan-tri": "3.3", "ke-toan.thue": "3.6",
    "ke-toan.chung-tu-quy-trinh": "3.7",
    "nhan-su-quan-tri": "4", "nhan-su-quan-tri.tuyen-dung": "4.2", "nhan-su-quan-tri.dao-tao-phat-trien": "4.3",
    "nhan-su-quan-tri.lanh-dao-quan-ly-doi-ngu": "5.4", "nhan-su-quan-tri.van-hoa-doanh-nghiep": "5.5",
    "nganh-o-to": "0", "nganh-o-to.ky-thuat-o-to": "0.1", "nganh-o-to.phu-tung": "0.2",
    "nganh-o-to.dich-vu-garage": "0.3", "nganh-o-to.huong-nghiep-nganh-o-to": "0.4",
    "cong-nghe-chuyen-doi-so": "5.7", "cong-nghe-chuyen-doi-so.ai-tu-dong-hoa": "5.7.3",
    "cong-nghe-chuyen-doi-so.phan-mem-quan-tri": "5.7.1", "cong-nghe-chuyen-doi-so.du-lieu-phan-tich": "5.7.2",
    "phap-ly": "5.6.4", "phap-ly.hop-dong": "2.3.4", "phap-ly.so-huu-tri-tue": "1.1.3", "phap-ly.quy-dinh-nganh": "3.6",
}


def _norm_tokens(name: str) -> set[str]:
    s = db.unaccent(re.sub(r"\(.*?\)", " ", name or ""))
    return {w for w in re.sub(r"[^a-z0-9]+", " ", s).split() if w not in {"va", "cho", "voi"}}


def name_close(csv_name: str, db_name: str) -> bool:
    """Tên trong bảng có thể viết tắt / bỏ phần ngoặc so với tên trong cây. Chấp nhận khi trùng phần lớn từ
    (hệ số chồng lấp ≥ 0.5) hoặc gần giống theo ký tự; khác hẳn = dấu hiệu mã node sai."""
    a, b = _norm_tokens(csv_name), _norm_tokens(db_name)
    if not a or not b:
        return False
    if len(a & b) / min(len(a), len(b)) >= NAME_MIN_OVERLAP:
        return True
    return SequenceMatcher(None, " ".join(sorted(a)), " ".join(sorted(b))).ratio() >= 0.75


def load_rows(path: Path = CSV_PATH) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def _split(v: str) -> list[str]:
    return [x.strip() for x in (v or "").split("|") if x.strip()]


SPILL_RE = re.compile(r"</?(?:[a-z_]+:)?(?:summary|parameter|invoke|function_calls)\b")
PARAM_RE = re.compile(r'<parameter name="(\w+)">(.*?)(?=</parameter>|<parameter |</?(?:[a-z_]+:)?invoke|$)', re.S)


def split_spill(text: str) -> tuple[str, dict]:
    """Nội dung bị AI gọi tool lỗi làm tràn: '…tóm tắt.</summary><parameter name="key_points">[…]'.
    -> (phần trước chỗ tràn, {tên trường: giá trị tràn}). Không có rác -> (text, {})."""
    m = SPILL_RE.search(text)
    if not m:
        return text, {}
    return text[:m.start()].rstrip(), {k: v.strip() for k, v in PARAM_RE.findall(text[m.start():])}


def _as_list(v: str) -> list[str]:
    try:
        got = json.loads(v)
    except ValueError:
        got = [x.strip("-• ").strip() for x in v.splitlines()]
    return [str(x).strip() for x in got if str(x).strip()] if isinstance(got, list) else []


def _content_fix(card: dict) -> dict:
    """Dọn rác XML (nhóm G4): cắt phần tràn khỏi trường bị dính; phần tràn thuộc trường khác (key_points, body…)
    đưa về đúng trường nếu trường đó đang trống. Bản gốc còn trong phiên bản trước."""
    fix: dict = {}
    spilled: dict = {}
    for k in CONTENT:
        if isinstance(card.get(k), str):
            head, extra = split_spill(card[k])
            if head != card[k]:
                fix[k] = head
                spilled |= extra
    kp = card.get("key_points") or []
    if any(isinstance(x, str) and SPILL_RE.search(x) for x in kp):
        fix["key_points"] = [h for h in (split_spill(x)[0] if isinstance(x, str) else x for x in kp) if h]
    for k, v in spilled.items():
        if k == "key_points" and not (fix.get("key_points", kp)):
            fix["key_points"] = _as_list(v)
        elif k in CONTENT and not (fix.get(k, card.get(k)) or "").strip():
            fix[k] = v
    return fix


def v2_codes() -> dict[str, dict]:
    return {c["code"]: c for c in cat_mod.categories.find({"scheme": "v2", "active": True, "code": {"$ne": None}})}


def target_for(row: dict, card: dict, codes: dict) -> tuple[dict | None, list[tuple[str, str]], list[str]]:
    """-> (nội dung đích của thẻ, lỗi [(loại, chi tiết)], cảnh báo). Có lỗi thì không ghi thẻ này."""
    errs: list[tuple[str, str]] = []
    warns: list[str] = []
    node = codes.get(row["node"].strip())
    if not node:
        errs.append(("ma_khong_co", row["node"]))
    elif row.get("node_name") and node["name"] != row["node_name"].strip():
        if name_close(row["node_name"], node["name"]):
            warns.append(f"tên viết khác: '{row['node_name']}' ~ '{node['name']}'")
        else:
            errs.append(("ten_lech", f"{row['node']}: '{row['node_name']}' ≠ '{node['name']}'"))
    secondary = []
    for code in _split(row.get("secondary_nodes")):
        if code in codes:
            secondary.append(codes[code]["slug"])
        else:
            errs.append(("ma_phu_khong_co", code))
    level = row.get("level", "").strip() or None
    if level and level not in classify.LEVELS:
        errs.append(("enum_level", level))
    typ = row.get("type", "").strip() or card.get("type")
    if typ not in CARD_TYPES:
        errs.append(("enum_type", typ))
    divs = _split(row.get("division"))
    if bad := [d for d in divs if d not in classify.DIVISIONS]:
        errs.append(("enum_division", ",".join(bad)))
    steps = _split(row.get("process_steps"))
    if bad := [s for s in steps if not classify.PROCESS_STEP_RE.match(s)]:
        errs.append(("enum_process_steps", ",".join(bad)))
    elif len(steps) > classify.MAX_PROCESS_STEPS:
        errs.append(("enum_process_steps", f"{len(steps)} bước > {classify.MAX_PROCESS_STEPS}"))
    if errs:
        return None, errs, warns
    low = row.get("confidence", "").strip().lower() in ("thap", "thấp")
    tags = tags_v2.clean(_split(row.get("tags")) + ([LOW_TAG] if low else []))
    fields = dict(card.get("fields") or {})
    if low and row.get("note", "").strip():
        fields[NOTE_FIELD] = row["note"].strip()
    cats = list(dict.fromkeys([node["slug"], *secondary]))
    target = {"categories": cats, "type": typ, "tags": tags, "fields": fields,
              "level": level, "division": divs or list(classify.DEFAULT_DIVISION), "process_steps": steps}
    return target, errs, warns


def mapped_target(card: dict, codes: dict) -> dict | None:
    """Thẻ không có dòng trong bảng: xếp tạm theo cây cũ (OLD_MAP) + tag chua-xep-v2. Đã ở cây v2 thì bỏ qua."""
    old = card.get("categories") or []
    by_code = {c: codes[c]["slug"] for c in codes}
    if old and old[0] in {c["slug"] for c in codes.values()}:
        return None
    new = [by_code[OLD_MAP[s]] for s in old if OLD_MAP.get(s) in by_code]
    return {"categories": list(dict.fromkeys(new))[:3], "tags": tags_v2.clean((card.get("tags") or []) + [UNSORTED_TAG])}


def diff(card: dict, target: dict) -> dict:
    """Trường cần đổi (so với giá trị đọc ra, thẻ cũ thiếu trường coi như mặc định)."""
    cur = card | classify.defaults(card)
    out = {k: v for k, v in target.items() if cur.get(k) != v}
    return out | _content_fix(card)


def _write(card: dict, changes: dict, by: ObjectId | None) -> None:
    if not card.get("current_revision") or revisions.has_unversioned_changes(card):
        revisions.record_revision(card, by, PRE_REASON)
    cls_set, cls_unset = classify.split({k: v for k, v in changes.items() if k in classify.STORED})
    plain = {k: v for k, v in changes.items() if k not in classify.STORED}
    new = card | plain | cls_set
    for k in cls_unset:
        new.pop(k, None)
    upd: dict = {"$set": plain | cls_set | {"search_text": card_search_text(new)}}
    if unset := {k: "" for k in cls_unset if k in card}:
        upd["$unset"] = unset
    cards.update_one({"_id": card["_id"]}, upd)
    embeddings.schedule([card["_id"]])
    revisions.record_revision(cards.find_one({"_id": card["_id"]}), by, REASON)


def run(apply: bool = False, rows: list[dict] | None = None, by: ObjectId | None = None) -> dict:
    rows = load_rows() if rows is None else rows
    codes = v2_codes()
    stats: dict = {"rows": len(rows), "updated": 0, "unchanged": 0, "errors": Counter(), "error_rows": [],
                   "warnings": [], "by_node": Counter(), "by_level": Counter(), "by_division": Counter(),
                   "low_confidence": 0, "deleted": 0, "unsorted": [], "xml_cleaned": 0, "log": []}
    if not codes:
        stats["errors"]["cay_v2_chua_nap"] += 1
        return stats
    seen = set()
    for row in rows:
        cid = row["card_id"].strip()
        seen.add(cid)
        try:
            card = cards.find_one({"_id": ObjectId(cid)})
        except (InvalidId, TypeError):
            card = None
        if not card:
            stats["errors"]["the_khong_con"] += 1
            stats["error_rows"].append((cid, "the_khong_con", ""))
            continue
        if cid in TEST_CARDS:
            continue
        target, errs, warns = target_for(row, card, codes)
        stats["warnings"] += [f"{cid}: {w}" for w in warns]
        if errs:
            for kind, detail in errs:
                stats["errors"][kind] += 1
                stats["error_rows"].append((cid, kind, detail))
            stats["log"].append((cid, "loi", "; ".join(f"{k}: {d}" for k, d in errs)))
            continue
        stats["by_node"][row["node"]] += 1
        stats["by_level"][target["level"] or "(trống)"] += 1
        for d in target["division"]:
            stats["by_division"][d] += 1
        stats["low_confidence"] += LOW_TAG in target["tags"]
        changes = diff(card, target)
        if not changes:
            stats["unchanged"] += 1
            stats["log"].append((cid, "giu_nguyen", ""))
            continue
        stats["xml_cleaned"] += bool(set(changes) & {*CONTENT, "key_points"})
        stats["updated"] += 1
        stats["log"].append((cid, "cap_nhat", ",".join(sorted(changes))))
        if apply:
            _write(card, changes, by)
    # thẻ trong DB không có dòng trong bảng
    for card in cards.find({"_id": {"$nin": [ObjectId(i) for i in seen if ObjectId.is_valid(i)]}}):
        cid = str(card["_id"])
        if cid in TEST_CARDS or card.get("type") in AI_CARD_TYPES:
            continue
        target = mapped_target(card, codes)
        if target is None:
            continue
        changes = diff(card, target)
        stats["unsorted"].append({"card_id": cid, "title": card.get("title", ""),
                                  "old_categories": "|".join(card.get("categories") or []),
                                  "new_categories": "|".join(target["categories"])})
        if changes:
            stats["updated"] += 1
            stats["log"].append((cid, "xep_tam", ",".join(sorted(changes))))
            if apply:
                _write(card, changes, by)
        else:
            stats["unchanged"] += 1
    # xoá thẻ test
    for cid in TEST_CARDS:
        if cards.count_documents({"_id": ObjectId(cid)}):
            stats["deleted"] += 1
            stats["log"].append((cid, "xoa", "thẻ test"))
            if apply:
                cards.delete_one({"_id": ObjectId(cid)})
    if apply and stats["unsorted"]:
        with open(UNSORTED_CSV, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["card_id", "title", "old_categories", "new_categories"])
            w.writeheader()
            w.writerows(stats["unsorted"])
    return stats


# Giữ điểm gọi cũ; logic nhật ký / quay lui nằm riêng để không trộn với chuyển phiên bản thẻ.
def retire_old_tree(apply: bool = False, journal_path: Path | None = None) -> dict:
    from .retire_tree import retire
    return retire(apply=apply, journal_path=journal_path)
