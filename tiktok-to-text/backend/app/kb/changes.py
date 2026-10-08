"""Đề xuất thay đổi thẻ + luồng duyệt (GOV-02, 04…06, 08 — docs/BA.md mục 16.2–16.5, 18.7 quyết định đợt 2).

`change_requests`: kind (create / update / merge / classify / obsolete / rollback), card_id, space_id, base_rev,
proposal {set, unset} (nội dung đề xuất — áp lên thẻ khi duyệt), summary (tóm tắt / lý do), change_kind
(minor / major), novelty {verdict, related [{card_id, rev, score}], reason, engine} (kết quả hiệu lực),
novelty_ai (kết quả gốc của cổng so sánh), novelty_override {verdict, reason, by, at} (người sửa kết quả),
novelty_status (pending / done / skipped), approval_class ("dual" — mọi thẻ 2 bước, v0.12),
approvals [{user_id, step, decision (approve / reject / comment / return / resubmit), comment, at, on_behalf_of}],
status (open / needs_rebase / approved / rejected / withdrawn), step_started_at, due_at, escalate_at, escalated_to,
returned {by, at, step, note} (GOV-13 — người duyệt trả về người đề xuất sửa; không có trường = chưa trả về),
origin (ai / manual / mcp / copy), author_ai (nội dung do AI viết), created_by, target_rev (rollback), obsolete
{reason, replaced_by} (obsolete), created_at, updated_at, decided_at, revision (số phiên bản tạo ra khi duyệt).

Luật duyệt (16.4 v0.12):
- Bước 1: người duyệt được thẻ trong kho (`policy.can(card.review)`) hoặc người duyệt bước 2.
- Bước 2 (`policy.step2_reviewers`) theo `level` của thẻ: nhap-mon / thuc-thi / van-hanh (và thẻ chưa có level) → chủ nhánh tầng 2 của
  `categories[0]` (`categories.owner_id`; chưa gán → quản trị viên); thiet-ke / dieu-hanh → TGĐ (tạm: quản trị viên).
  `rollback`, `obsolete`, `classify` hạ mức mật → chủ sở hữu lĩnh vực (chủ nhánh gần nhất); cổng so sánh ra
  MÂU THUẪN → chủ sở hữu lĩnh vực của thẻ cũ.
- `min_approvers` (meta `gov_settings`, mặc định 2): đặt 1 thì một người đủ điều kiện bước 1 hoặc 2 duyệt xong,
  `approvals[]` vẫn ghi cả hai bước.
- Bốn mắt: tác giả không duyệt bước nào; người bước 2 khác người bước 1. Tác giả (`authors`) = người tạo thẻ + người
  sửa nội dung thẻ nháp trên web (`edited_by`) với đề xuất `create`, người đề xuất với loại khác — không phải người
  bấm gửi duyệt. Nội dung do AI viết (dựng thẻ tự động, AI qua MCP) thì người nạp / chủ token là con mắt thứ hai —
  được duyệt (BA 18.10 điểm 1, chờ quyết).
- Chốt đề xuất nguyên tử (QA C-1): mỗi lượt duyệt / từ chối là một `find_one_and_update` có điều kiện theo `status` +
  lượt duyệt đã có; áp lên thẻ trong khoá theo thẻ (`gov_locks`) và chỉ khi `base_rev` = `current_revision` — lệch thì
  đề xuất về `needs_rebase`, không áp.
- Thẻ lỗi thời không nhận đề xuất sửa / lỗi thời / quay về (409); duyệt lỗi thời thì rút các đề xuất đang mở của thẻ.
- Trả về (GOV-13, DESIGN TK-04d): người duyệt bước hiện tại chọn `return` kèm lý do (bắt buộc) — đề xuất vẫn `open`,
  mang `returned`, rời hộp *Chờ tôi duyệt* (không duyệt / từ chối được, 409) cho tới khi người đề xuất *Gửi lại*
  (`resubmit`): về đúng bước đang duyệt, hạn tính lại, lượt duyệt bước trước giữ nguyên. Người đề xuất vẫn rút được.
- Từ chối bắt buộc lý do. SLA: 3 ngày làm việc mỗi bước (quá → "quá hạn"), 6 ngày → cần chuyển cấp (chưa có việc
  nền nhắc — mới hiện trên hộp duyệt).

Duyệt xong: áp nội dung, `revisions.record_revision` (lý do = tóm tắt đề xuất, tham số `change_kind` ghi vào phiên bản);
thẻ chưa có phiên bản thì ghi bản 1 từ nội dung hiện tại trước (quyết định 18.7.1). Đề xuất khác của cùng thẻ dựng
trên bản cũ chuyển `needs_rebase`.

Cổng so sánh chạy trong worker nền (`worker`), không trong request web; engine heuristic xếp hàng chạy lại khi AI
sẵn sàng. Mặc định `NOVELTY_ENGINE=local` (18.7.2).
"""

from __future__ import annotations

import threading
import time
import traceback
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from .. import db, org, policy
from ..config import NOVELTY_ENGINE_SET
from ..auth import current_user, require_admin, users
from ..spaces import spaces
from . import classify, embeddings, novelty, revisions
from .revisions import SNAPSHOT_FIELDS, cards

change_requests = db.db["change_requests"]
meta = db.db["meta"]
gov_locks = db.db["gov_locks"]          # khoá theo thẻ khi áp đề xuất (_id = card_id)

ChangeKind = Literal["create", "update", "merge", "classify", "obsolete", "rollback"]
ChangeStatus = Literal["open", "needs_rebase", "approved", "rejected", "withdrawn"]
NoveltyVerdict = Literal["new", "duplicate", "supplement", "conflict", "noise"]
Level = Literal["minor", "major"]

SETTINGS_ID = "gov_settings"
DEFAULT_SETTINGS = {"min_approvers": 2, "sla_days": 3, "escalate_days": 6}
TOP_LEVELS = policy.TOP_LEVELS                         # bước 2 = TGĐ (tạm: quản trị viên)
# Trường mà sửa riêng chúng là thay đổi nhỏ (không đổi kết luận — BA 16.3)
MINOR_FIELDS = {"tags", "categories", "level", "division", "process_steps", "classification", "owner_unit_id",
                "effective_at", "review_cycle_months", "next_review_at", "fields", "type"}
EXEMPT_TYPES = {"skill", "memory", "context"}          # bộ nhớ AI (wiki.AI_CARD_TYPES) — không qua duyệt
OPEN = ("open", "needs_rebase")
KIND_LABELS = {"create": "Thẻ mới", "update": "Sửa nội dung", "merge": "Gộp thẻ", "classify": "Phân loại",
               "obsolete": "Lỗi thời", "rollback": "Quay về bản cũ"}
# đề xuất `update` chỉ đổi các trường này → nhãn "Đổi phân loại" (không phải sửa nội dung)
CLASSIFY_FIELDS = {"tags", "categories", "level", "division", "process_steps", "classification", "owner_unit_id"}
EMPTY_VALUES = (None, "", [], {})
RACE_MSG = "Đề xuất vừa được người khác xử lý — tải lại để xem trạng thái mới"
RETURNED_MSG = "Đề xuất đang được trả về người đề xuất sửa — chờ người đề xuất gửi lại rồi mới duyệt / từ chối được"
RETURN_NOTE_MSG = "Cần ghi lý do trả về"
OBSOLETE_MSG = "Thẻ đã lỗi thời — không nhận đề xuất sửa / lỗi thời / quay về bản cũ"

# 18.7.2: cổng so sánh là việc nhiều lượt → AI local trước (trừ khi môi trường đặt khác)
if not NOVELTY_ENGINE_SET:
    novelty.NOVELTY_ENGINE = "local"


def ensure_indexes() -> None:
    change_requests.create_index([("status", ASCENDING), ("due_at", ASCENDING)])
    change_requests.create_index("card_id")
    change_requests.create_index("created_by")
    change_requests.create_index("approvals.user_id")
    change_requests.create_index([("novelty_status", ASCENDING), ("novelty_retry_at", ASCENDING)])


# ---------------------------------------------------------------------------
# Cấu hình
# ---------------------------------------------------------------------------

def settings() -> dict:
    doc = meta.find_one({"_id": SETTINGS_ID}) or {}
    return DEFAULT_SETTINGS | {k: doc[k] for k in DEFAULT_SETTINGS if k in doc}


def min_approvers() -> int:
    return 1 if settings()["min_approvers"] == 1 else 2


def governed(card: dict) -> bool:
    """Thẻ đi qua luồng đề xuất / duyệt (bộ nhớ AI skill / memory / context thì không)."""
    return card.get("type") not in EXEMPT_TYPES


# ---------------------------------------------------------------------------
# Hạn duyệt
# ---------------------------------------------------------------------------

def add_business_days(start: datetime, n: int) -> datetime:
    d = start
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d


def _deadlines(start: datetime) -> dict:
    s = settings()
    return {"step_started_at": start, "due_at": add_business_days(start, s["sla_days"]),
            "escalate_at": add_business_days(start, s["escalate_days"])}


# ---------------------------------------------------------------------------
# Người duyệt
# ---------------------------------------------------------------------------

# Luật chọn người duyệt bước 2 nằm ở policy.py (điểm quyết định quyền duy nhất — ORG-10); tên cũ giữ làm bí danh
_admins = policy.admin_ids
tier2_owner = policy.tier2_owner
category_owner = policy.category_owner
_rank = policy.classification_rank


def step2_rule(ch: dict, card: dict) -> tuple[list[ObjectId], str]:
    """(người duyệt bước 2, nhãn) — xem `policy.step2_reviewers`."""
    return policy.step2_reviewers(card, ch)


def owner_required(ch: dict, card: dict) -> bool:
    """rollback / obsolete / classify hạ mức mật / mâu thuẫn: luôn cần chủ sở hữu lĩnh vực, kể cả khi
    min_approvers = 1 (BA 16.4)."""
    after = apply_preview(card, ch)
    return (ch["kind"] in ("rollback", "obsolete")
            or (ch["kind"] == "classify" and _rank(after.get("classification")) < _rank(card.get("classification")))
            or ((ch.get("novelty") or {}).get("verdict") == "conflict" and bool((ch.get("novelty") or {}).get("related"))))


def authors(ch: dict, card: dict | None = None) -> set:
    """Tác giả nội dung — không ai trong số này duyệt được bước nào (bốn mắt, QA N-1). Đề xuất `create`: người tạo
    thẻ + người sửa nội dung thẻ nháp trên web (`edited_by`), KHÔNG phải người bấm gửi duyệt; loại khác: người đề
    xuất. Nội dung AI viết (`author_ai`) thì người nạp / chủ token không tính (18.10 điểm 1) — người sửa tay vẫn tính."""
    ids: set = set()
    if ch["kind"] == "create":
        if card is None:
            card = cards.find_one({"_id": ch["card_id"]}, {"created_by": 1, "edited_by": 1}) or {}
        ids |= set(card.get("edited_by") or [])
        if not ch.get("author_ai"):
            ids.add(card.get("created_by"))
    elif not ch.get("author_ai"):
        ids.add(ch.get("created_by"))
    ids.discard(None)
    return ids


def _approved(ch: dict, step: int) -> dict | None:
    return next((a for a in ch.get("approvals") or [] if a["step"] == step and a["decision"] == "approve"), None)


def current_step(ch: dict) -> int:
    return 2 if _approved(ch, 1) else 1


def sole_step2(user: dict, ch: dict, card: dict, step2: list[ObjectId]) -> bool:
    """Người này là người duyệt bước 2 duy nhất (không tính tác giả) — không làm bước 1 khi min_approvers = 2."""
    auth = authors(ch, card)
    return user["_id"] in step2 and not [u for u in step2 if u != user["_id"] and u not in auth]


def can_step1(user: dict, card: dict, ch: dict, step2: list[ObjectId]) -> bool:
    if user["_id"] in authors(ch, card):
        return False
    if min_approvers() == 2 and sole_step2(user, ch, card, step2):
        return False          # QA P-2: không hiện ở "Chờ tôi duyệt" bước 1 rồi bấm Duyệt lại bị 409
    return user["_id"] in step2 or policy.can(user, "card.review", card)


def can_step2(user: dict, ch: dict, step2: list[ObjectId], card: dict | None = None) -> bool:
    first = _approved(ch, 1)
    return (user["_id"] in step2 and user["_id"] not in authors(ch, card)
            and (not first or first["user_id"] != user["_id"]))


def can_decide(user: dict, card: dict, ch: dict, step2: list[ObjectId] | None = None) -> bool:
    if ch["status"] != "open" or ch.get("returned"):     # GOV-13: đang trả về → chờ người đề xuất gửi lại
        return False
    step2 = step2 if step2 is not None else step2_rule(ch, card)[0]
    if min_approvers() == 1:
        if user["_id"] in authors(ch, card):
            return False
        if owner_required(ch, card):
            return user["_id"] in step2
        return user["_id"] in step2 or policy.can(user, "card.review", card)
    return can_step1(user, card, ch, step2) if current_step(ch) == 1 else can_step2(user, ch, step2, card)


def suggested_reviewers(card: dict, ch: dict, step2: list[ObjectId], limit: int = 5) -> list[dict]:
    """Gợi ý người duyệt bước hiện tại, ít việc tồn trước (BA 16.4)."""
    auth = authors(ch, card)
    if current_step(ch) == 2 and min_approvers() == 2:
        ids = [u for u in step2 if u not in auth and u != (_approved(ch, 1) or {}).get("user_id")]
    else:
        space = spaces.find_one({"_id": card.get("space_id")}) or {}
        ids = [m["user_id"] for m in space.get("members") or []]
        ids = [u for u in dict.fromkeys(ids + step2) if u not in auth]
    people = [u for u in users.find({"_id": {"$in": ids}, "active": True}, {"name": 1, "role": 1, "org": 1})
              if u["_id"] in step2 or policy.can(u, "card.review", card)]
    load = {r["_id"]: r["n"] for r in change_requests.aggregate([
        {"$match": {"status": "open", "approvals.user_id": {"$in": [p["_id"] for p in people]}}},
        {"$unwind": "$approvals"}, {"$group": {"_id": "$approvals.user_id", "n": {"$sum": 1}}}])}
    people.sort(key=lambda p: (load.get(p["_id"], 0), p["name"]))
    return [{"id": str(p["_id"]), "name": p["name"]} for p in people[:limit]]


# ---------------------------------------------------------------------------
# Nội dung đề xuất
# ---------------------------------------------------------------------------

def apply_preview(card: dict, ch: dict) -> dict:
    """Thẻ sau khi áp đề xuất (không ghi DB)."""
    return policy.card_after_change(card, ch)


def guess_change_kind(proposal: dict) -> str:
    fields = set((proposal.get("set") or {}).keys()) | set(proposal.get("unset") or [])
    return "minor" if fields <= MINOR_FIELDS else "major"


def _default_summary(kind: str, proposal: dict | None) -> str:
    if kind != "update" or not proposal:
        return KIND_LABELS.get(kind, kind)
    fields = [*(proposal.get("set") or {}).keys(), *(proposal.get("unset") or [])]
    labels = [revisions.FIELD_LABELS.get(f, f) for f in fields if f not in ("search_text", "updated_at")]
    return "Sửa: " + ", ".join(dict.fromkeys(labels)) if labels else "Sửa nội dung"


def _empty(field: str, value) -> bool:
    """Giá trị coi như "không có": thiếu trường, rỗng, hoặc mặc định (division = tap-doan)."""
    return value in EMPTY_VALUES or classify.is_default(field, value)


def _only_changes(card: dict, set_: dict, unset: dict | list) -> dict:
    """Bỏ phần giống thẻ hiện tại; trả {set, unset} hoặc {} nếu không có gì đổi. So sánh chuẩn hoá (QA P-3): thiếu
    trường = rỗng = mặc định; `next_review_at` chỉ đi theo khi ngày hiệu lực / chu kỳ đổi."""
    s = {k: v for k, v in set_.items() if k not in ("updated_at", "search_text") and card.get(k) != v
         and not (_empty(k, card.get(k)) and _empty(k, v))}
    u = [k for k in unset if k in card and not _empty(k, card[k])]
    if not {"effective_at", "review_cycle_months"} & (set(s) | set(u)):
        s.pop("next_review_at", None)
        u = [k for k in u if k != "next_review_at"]
    return {"set": s, "unset": u} if s or u else {}


def ensure_not_obsolete(card: dict) -> None:
    if card.get("obsolete"):
        raise HTTPException(409, OBSOLETE_MSG)


def kind_label(ch: dict) -> str:
    """Nhãn loại đề xuất theo thực tế (QA U-2): `update` chỉ đổi tag / phân loại → "Đổi phân loại"."""
    p = ch.get("proposal") or {}
    fields = set(p.get("set") or {}) | set(p.get("unset") or [])
    if ch["kind"] == "update" and fields and fields <= CLASSIFY_FIELDS:
        return "Đổi phân loại"
    return KIND_LABELS.get(ch["kind"], ch["kind"])


def create_change(card: dict, user: dict | None, kind: str, proposal: dict | None = None, summary: str = "",
                  change_kind: str | None = None, origin: str = "manual", author_ai: bool = False,
                  extra: dict | None = None) -> dict:
    now = db.now()
    ch = {"kind": kind, "card_id": card["_id"], "space_id": card.get("space_id"),
          "base_rev": card.get("current_revision"), "proposal": proposal,
          "summary": (summary or "").strip()[:1000] or _default_summary(kind, proposal),
          "change_kind": None if kind in ("create", "obsolete") else (change_kind or guess_change_kind(proposal or {})),
          "novelty": None, "novelty_ai": None, "novelty_override": None,
          "novelty_status": "pending" if kind == "create" else "skipped",
          "approval_class": "dual", "approvals": [], "status": "open", "escalated_to": None,
          "origin": origin, "author_ai": author_ai, "created_by": (user or {}).get("_id") or card.get("created_by"),
          "created_at": now, "updated_at": now, **_deadlines(now)} | (extra or {})
    ch["_id"] = change_requests.insert_one(ch).inserted_id
    return ch


def open_change(card_id: ObjectId, kind: str | None = None) -> dict | None:
    f: dict = {"card_id": card_id, "status": {"$in": list(OPEN)}}
    if kind:
        f["kind"] = kind
    return change_requests.find_one(f, sort=[("created_at", -1)])


def submit_draft(card: dict, user: dict | None, origin: str | None = None, summary: str = "") -> dict:
    """Đưa thẻ nháp vào hộp duyệt (đề xuất `create`, cổng so sánh chạy nền). Đã có đề xuất mở thì trả nó."""
    if card.get("status") == "approved":
        raise HTTPException(400, "Thẻ đã duyệt — sửa nội dung sẽ thành đề xuất sửa")
    if ch := open_change(card["_id"], "create"):
        return ch
    if not governed(card):
        raise HTTPException(400, "Thẻ bộ nhớ AI không qua luồng duyệt")
    origin = origin or card.get("origin") or "manual"
    if card.get("status") == "rejected":
        cards.update_one({"_id": card["_id"]}, {"$set": {"status": "draft", "updated_at": db.now()}})
    # QA N-1: đề xuất `create` thuộc về người tạo thẻ; người bấm gửi (vd người duyệt bấm ✓ Duyệt) ghi ở submitted_by
    return create_change(card, None, "create", summary=summary or "Thẻ mới", origin=origin,
                         author_ai=origin in ("ai", "mcp"), extra={"submitted_by": (user or {}).get("_id")})


def submit_new_cards(card_ids: list, origin: str = "ai") -> None:
    """Thẻ AI (pipeline, tổng hợp cụm) / MCP vừa tạo → đề xuất `create`, cổng so sánh chạy nền (16.7)."""
    for c in cards.find({"_id": {"$in": list(card_ids)}, "status": "draft"}):
        if governed(c):
            submit_draft(c, None, origin)


def propose_update(card: dict, user: dict, set_: dict, unset, summary: str = "", change_kind: str | None = None,
                   origin: str = "manual", kind: str = "update") -> dict:
    """PATCH thẻ approved (web / MCP) → đề xuất sửa (16.7). Nội dung đã được kiểm tra ở kb/routes.py."""
    policy.require(user, "card.propose", card, "thẻ")
    ensure_not_obsolete(card)
    proposal = _only_changes(card, set_, unset)
    if not proposal:
        raise HTTPException(400, "Không có gì thay đổi so với bản hiệu lực")
    if kind == "update" and set(proposal["set"]) | set(proposal["unset"]) <= {"classification", "owner_unit_id",
                                                                              "categories"}:
        kind = "classify"
    if not governed(card) and governed(apply_preview(card, {"proposal": proposal})):
        change_kind = change_kind or "major"   # QA N-2: bộ nhớ AI → loại tri thức — như nội dung mới, không phải sửa nhỏ
    return create_change(card, user, kind, proposal, summary, change_kind, origin, author_ai=origin == "mcp")


def on_draft_edited(card_id: ObjectId) -> None:
    """Thẻ nháp đang chờ duyệt bị sửa → lượt duyệt đã có không còn giá trị, bắt đầu lại bước 1."""
    ch = open_change(card_id, "create")
    if ch and any(a["decision"] == "approve" for a in ch.get("approvals") or []):
        now = db.now()
        kept = [a for a in ch["approvals"] if a["decision"] != "approve"]
        kept.append({"user_id": None, "step": 0, "decision": "comment", "at": now, "on_behalf_of": None,
                     "comment": "Thẻ nháp được sửa sau khi đã có lượt duyệt — duyệt lại từ bước 1"})
        change_requests.update_one({"_id": ch["_id"]}, {"$set": {"approvals": kept, "updated_at": now,
                                                                 "novelty_status": "pending", **_deadlines(now)}})


def _stop_novelty(f: dict) -> None:
    """Đề xuất đã đóng thôi chờ cổng so sánh — hộp duyệt không còn hiện "Đang so sánh…" (QA P-5)."""
    change_requests.update_many(f | {"novelty_status": {"$in": ["pending", "running"]}},
                                {"$set": {"novelty_status": "skipped"}})


def close_open(card_id: ObjectId, reason: str, exclude: ObjectId | None = None, kind: str | None = None) -> int:
    """Hệ thống rút các đề xuất đang mở của thẻ (thẻ bị xoá / lỗi thời / thành bộ nhớ AI), kèm lý do."""
    f: dict = {"card_id": card_id, "status": {"$in": list(OPEN)}}
    if exclude:
        f["_id"] = {"$ne": exclude}
    if kind:
        f["kind"] = kind
    ids = [c["_id"] for c in change_requests.find(f, {"_id": 1})]
    if not ids:
        return 0
    now = db.now()
    change_requests.update_many({"_id": {"$in": ids}, "status": {"$in": list(OPEN)}}, {"$set": {
        "status": "withdrawn", "decided_at": now, "updated_at": now, "withdraw_reason": reason,
        "withdrawn_by_system": True}})
    _stop_novelty({"_id": {"$in": ids}})
    return len(ids)


def on_card_deleted(card_id: ObjectId) -> None:
    close_open(card_id, "Thẻ nháp đã bị xoá")


# ---------------------------------------------------------------------------
# Duyệt
# ---------------------------------------------------------------------------

def _load_card(ch: dict) -> dict:
    card = cards.find_one({"_id": ch["card_id"]})
    if not card:
        raise HTTPException(404, "Thẻ của đề xuất không còn")
    return card


def _stale(ch: dict, card: dict) -> bool:
    return ch["kind"] != "create" and (card.get("current_revision") or None) != (ch.get("base_rev") or None)


def _now_ms() -> datetime:
    """Giờ làm tròn mili giây (Mongo lưu tới ms) — để $pull đúng lượt duyệt vừa ghi khi phải hoàn tác."""
    now = db.now()
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


@contextmanager
def card_lock(card_id: ObjectId, wait: float = 10.0):
    """Khoá theo thẻ khi áp đề xuất (QA C-1): hai đề xuất cùng thẻ không áp chồng lên nhau. Khoá quá 60 giây (tiến
    trình chết giữa chừng) coi như hết hạn."""
    deadline = time.monotonic() + wait
    while True:
        gov_locks.delete_one({"_id": card_id, "at": {"$lt": db.now() - timedelta(seconds=60)}})
        try:
            gov_locks.insert_one({"_id": card_id, "at": db.now()})
            break
        except DuplicateKeyError:
            if time.monotonic() > deadline:
                raise HTTPException(409, "Thẻ đang được áp một đề xuất khác — thử lại sau") from None
            time.sleep(0.02)
    try:
        yield
    finally:
        gov_locks.delete_one({"_id": card_id})


def _entry(user: dict, step: int, decision: str, comment: str, on_behalf_of, at: datetime) -> dict:
    return {"user_id": user["_id"], "step": step, "decision": decision, "comment": comment,
            "on_behalf_of": on_behalf_of, "at": at}


def decide(ch: dict, user: dict, decision: str, comment: str = "", change_kind: str | None = None,
           on_behalf_of: ObjectId | None = None, channel: str = "web") -> dict:
    """Ghi quyết định vào `approvals[]`; đủ người duyệt → áp đề xuất. Trả đề xuất sau khi ghi.

    Mọi lượt ghi là cập nhật có điều kiện (QA C-1): bấm đúp / hai người cùng bấm thì chỉ một lượt được ghi, lượt
    kia nhận 409. Kiểm tra hợp lệ (lý do từ chối…) làm trước khi ghi bất cứ gì (QA P-1)."""
    comment = (comment or "").strip()
    if decision == "approve" and channel != "web":
        raise HTTPException(403, f"Chỉ duyệt trên web (SYS-12) — mở /wiki/review?change={ch['_id']}")
    card = _load_card(ch)
    if decision == "comment":
        if not comment:
            raise HTTPException(400, "Nhận xét trống")
        if not (can_view(user, ch, card)):
            raise HTTPException(404, "Không tìm thấy đề xuất")
        if ch["status"] not in OPEN:
            raise HTTPException(409, "Đề xuất đã đóng — không nhận thêm nhận xét")
        _push(ch, {"user_id": user["_id"], "step": current_step(ch), "decision": "comment", "comment": comment})
        return change_requests.find_one({"_id": ch["_id"]})
    if decision == "reject" and not comment:
        raise HTTPException(400, "Từ chối cần ghi lý do")
    if decision == "return" and not comment:
        raise HTTPException(400, RETURN_NOTE_MSG)
    if ch["status"] == "needs_rebase" or (ch["status"] == "open" and _stale(ch, card)):
        mark_needs_rebase(ch)
        raise HTTPException(409, "Thẻ đã có phiên bản mới hơn bản đề xuất dựng trên — người đề xuất cần cập nhật "
                                 "(rebase) trước khi duyệt")
    if ch["status"] != "open":
        raise HTTPException(409, "Đề xuất đã đóng")
    if ch.get("returned"):
        raise HTTPException(409, RETURNED_MSG)
    if ch["kind"] != "create":
        ensure_not_obsolete(card)
    step2, label = step2_rule(ch, card)
    if user["_id"] in authors(ch, card):
        raise HTTPException(403, "Không tự duyệt nội dung của mình (bốn mắt) — người khác sẽ duyệt")
    single = min_approvers() == 1
    step = current_step(ch)
    if decision == "approve" and step == 1 and not single and sole_step2(user, ch, card, step2):
        raise HTTPException(409, "Bạn là người duyệt bước 2 duy nhất của thẻ này — để người khác duyệt bước 1, "
                                 "hoặc quản trị viên đặt số người duyệt tối thiểu = 1")
    if not can_decide(user, card, ch, step2):
        if current_step(ch) == 2 and (_approved(ch, 1) or {}).get("user_id") == user["_id"]:
            raise HTTPException(403, "Bạn đã duyệt bước 1 — bước 2 cần người khác (bốn mắt)")
        raise HTTPException(403, "Bạn không phải người duyệt của bước này")

    now = _now_ms()
    kind_set = {"change_kind": change_kind} if change_kind and ch["kind"] not in ("create", "obsolete") else {}
    first = _approved(ch, 1)
    # điều kiện: đề xuất vẫn mở, cùng base, lượt duyệt đã có đúng như lúc đọc
    guard: dict = {"_id": ch["_id"], "status": "open", "base_rev": ch.get("base_rev"), "returned": None, "$and": [
        {"approvals": {"$not": {"$elemMatch": {"step": 2, "decision": "approve"}}}},
        ({"approvals": {"$elemMatch": {"step": 1, "decision": "approve", "user_id": first["user_id"]}}} if first
         else {"approvals": {"$not": {"$elemMatch": {"step": 1, "decision": "approve"}}}})]}
    after = ReturnDocument.AFTER

    if decision == "reject":
        res = change_requests.find_one_and_update(guard, {
            "$push": {"approvals": _entry(user, step, "reject", comment, on_behalf_of, now)},
            "$set": {"status": "rejected", "decided_at": now, "updated_at": now}}, return_document=after)
        if not res:
            raise HTTPException(409, RACE_MSG)
        _stop_novelty({"_id": ch["_id"]})
        if ch["kind"] == "create":
            cards.update_one({"_id": card["_id"], "status": "draft"}, {"$set": {
                "status": "rejected", "reviewed_by": user["_id"], "reviewed_at": now, "updated_at": now}})
        return res

    if decision == "return":     # GOV-13: không đóng đề xuất, không tạo phiên bản — người đề xuất sửa rồi gửi lại
        res = change_requests.find_one_and_update(guard, {
            "$push": {"approvals": _entry(user, step, "return", comment, on_behalf_of, now)},
            "$set": {"returned": {"by": user["_id"], "at": now, "step": step, "note": comment},
                     "updated_at": now}}, return_document=after)
        if not res:
            raise HTTPException(409, RACE_MSG)
        return res

    if step == 1 and not single:
        res = change_requests.find_one_and_update(guard, {
            "$push": {"approvals": _entry(user, 1, "approve", comment, on_behalf_of, now)},
            "$set": {"updated_at": now, **kind_set, **_deadlines(now)}}, return_document=after)
        if not res:
            raise HTTPException(409, RACE_MSG)
        return res

    entries = []
    if step == 1:     # min_approvers = 1: bước 2 gộp vào bước 1, vẫn ghi đủ hai bước
        entries.append(_entry(user, 1, "approve", comment, on_behalf_of, now))
        comment = "Gộp bước 2 (số người duyệt tối thiểu = 1)"
    entries.append(_entry(user, 2, "approve", comment, on_behalf_of, now))
    # chốt: chuyển `approved` ngay trong lượt ghi — lượt thứ hai (bấm đúp, gọi đồng thời) không khớp điều kiện
    res = change_requests.find_one_and_update(guard, {
        "$push": {"approvals": {"$each": entries}},
        "$set": {"status": "approved", "decided_at": now, "updated_at": now, "step2_label": label,
                 "step2_ids": list(step2), **kind_set}}, return_document=after)
    if not res:
        raise HTTPException(409, RACE_MSG)
    return _finalize(res, now)


def _undo_final(ch: dict, at: datetime, status: str = "open") -> None:
    """Chốt được lượt ghi nhưng không áp được lên thẻ → gỡ lượt duyệt vừa ghi, trả đề xuất về `status`."""
    change_requests.update_one({"_id": ch["_id"], "status": "approved"}, {
        "$pull": {"approvals": {"at": at, "decision": "approve"}},
        "$set": {"status": status, "decided_at": None, "updated_at": db.now()},
        "$unset": {"step2_label": "", "step2_ids": ""}})


def _push(ch: dict, entry: dict, set_: dict | None = None) -> None:
    now = db.now()
    entry = {"comment": "", "on_behalf_of": None} | entry | {"at": now}
    change_requests.update_one({"_id": ch["_id"]}, {"$push": {"approvals": entry},
                                                    "$set": {"updated_at": now, **(set_ or {})}})


def _approvers(ch: dict) -> list[ObjectId]:
    return list(dict.fromkeys(a["user_id"] for a in ch.get("approvals") or [] if a["decision"] == "approve"))


def _search_text(card: dict) -> str:
    from .pipeline import card_search_text   # nhập muộn: pipeline nhập module này khi thẻ AI được tạo
    return card_search_text(card)


def _finalize(ch: dict, at: datetime) -> dict:
    """Áp đề xuất vừa chốt (status đã là `approved`) lên thẻ, trong khoá theo thẻ. Thẻ đã lên bản khác `base_rev`
    (đề xuất khác vừa áp) → đề xuất về `needs_rebase`, không áp (QA C-1)."""
    with card_lock(ch["card_id"]):
        card = cards.find_one({"_id": ch["card_id"]})
        if not card:
            _undo_final(ch, at)
            raise HTTPException(404, "Thẻ của đề xuất không còn")
        if ch["kind"] != "create" and (_stale(ch, card) or card.get("obsolete")):
            _undo_final(ch, at, "needs_rebase" if not card.get("obsolete") else "open")
            if card.get("obsolete"):
                raise HTTPException(409, OBSOLETE_MSG)
            raise HTTPException(409, "Thẻ vừa lên phiên bản mới (đề xuất khác được duyệt trước) — đề xuất cần cập "
                                     "nhật lên bản mới rồi duyệt lại")
        try:
            return _apply(ch, card)
        except Exception:
            _undo_final(ch, at)
            raise


def _apply(ch: dict, card: dict) -> dict:
    now = db.now()
    approvers = _approvers(ch)
    last = approvers[-1] if approvers else None
    # 18.7.1: thẻ chưa có phiên bản → bản 1 từ nội dung hiện tại; nội dung sửa thẳng chưa ghi → ghi lại trước
    if ch["kind"] != "create":
        if not card.get("current_revision"):
            revisions.record_revision(card, card.get("created_by"),
                                      "Phiên bản đầu (tạo khi duyệt đề xuất đầu tiên)")
        elif revisions.has_unversioned_changes(card):
            revisions.record_revision(card, card.get("created_by"), revisions.UNVERSIONED_REASON)
        card = cards.find_one({"_id": card["_id"]})
    upd: dict = {"updated_at": now, "reviewed_by": last, "reviewed_at": now}
    unset: dict = {}
    if ch["kind"] == "create":
        upd["status"] = "approved"
    elif ch["kind"] == "obsolete":
        upd["obsolete"] = {"at": now, "by": last, "reason": ch["summary"],
                           "replaced_by": (ch.get("obsolete") or {}).get("replaced_by")}
    else:
        p = ch.get("proposal") or {}
        upd |= p.get("set") or {}
        unset = {k: "" for k in p.get("unset") or [] if k in card}
        upd["search_text"] = _search_text(apply_preview(card, ch))
    # chỉ áp khi thẻ vẫn ở đúng bản vừa đọc (trong khoá — chặn cả lượt ghi ngoài luồng đề xuất)
    r = cards.update_one({"_id": card["_id"], "current_revision": card.get("current_revision")},
                         {"$set": upd} | ({"$unset": unset} if unset else {}))
    if not r.matched_count:
        raise HTTPException(409, "Thẻ vừa đổi trong lúc duyệt — thử lại")
    embeddings.schedule([card["_id"]])   # nội dung mới (hoặc chỉ đổi trạng thái: nền tự thấy không cần tính lại)
    card = cards.find_one({"_id": card["_id"]})
    rev = None
    if ch["kind"] != "obsolete":
        reason = ch["summary"] if ch["kind"] != "rollback" else f"Quay về bản {ch.get('target_rev')}: {ch['summary']}"
        # BA 16.3: mức thay đổi ghi vào phiên bản ngay lúc tạo (chỉ ghi thêm)
        r = revisions.record_revision(card, ch.get("created_by"), reason, change_request_id=ch["_id"],
                                      approved_by=approvers, change_kind=ch.get("change_kind"))
        rev = r["rev"]
    change_requests.update_one({"_id": ch["_id"]}, {"$set": {"status": "approved", "decided_at": now,
                                                             "updated_at": now, "revision": rev}})
    _stop_novelty({"_id": ch["_id"]})
    if rev and card.get("status") == "approved" and card.get("level") in QUESTION_LEVELS:
        reviewer = users.find_one({"_id": last}) if last else None
        spawn(lambda: draft_questions(card["_id"], rev, reviewer))
    if rev:   # đề xuất khác dựng trên bản cũ
        change_requests.update_many({"_id": {"$ne": ch["_id"]}, "card_id": card["_id"], "status": "open",
                                     "kind": {"$ne": "create"}},
                                    {"$set": {"status": "needs_rebase", "updated_at": now}})
    if ch["kind"] == "obsolete":   # QA C-3: thẻ lỗi thời — đề xuất khác đang mở không còn ý nghĩa
        close_open(card["_id"], "Hệ thống: thẻ đã lỗi thời (đề xuất lỗi thời được duyệt)", exclude=ch["_id"])
    return change_requests.find_one({"_id": ch["_id"]})


# BA 17.6 v0.12 "sinh khi duyệt": thẻ bậc thực thi / vận hành vừa lên phiên bản mới → AI sinh ≥ 2 câu hỏi nháp.
# Chạy nền (AI local ~3 phút), lỗi gì cũng bỏ qua — không chặn việc duyệt.
QUESTION_LEVELS = ("thuc-thi", "van-hanh")


def spawn(fn) -> None:
    threading.Thread(target=fn, name="gov-questions", daemon=True).start()


def draft_questions(card_id: ObjectId, rev: int, reviewer: dict | None) -> None:
    try:
        import importlib
        generate = importlib.import_module(".generate", "app.learn")   # luồng H (learn/generate.py)
        card = cards.find_one({"_id": card_id})
        if card and reviewer:
            generate.draft_questions_for_card(card, card.get("current_revision") or rev or 1, reviewer, n=2)
    except Exception as e:  # noqa: BLE001 — AINotReady, AIRetryLater, ValueError, HTTPException 400…
        print(f"Sinh câu hỏi khi duyệt thẻ {card_id}: bỏ qua — {str(e)[:200]}")


def mark_needs_rebase(ch: dict) -> None:
    change_requests.update_one({"_id": ch["_id"], "status": "open"},
                               {"$set": {"status": "needs_rebase", "updated_at": db.now()}})


def rebase(ch: dict, user: dict) -> dict:
    """Dựng lại đề xuất trên phiên bản hiệu lực: giữ phần đề xuất, bỏ lượt duyệt cũ, về `open`."""
    if user["_id"] != ch.get("created_by") and not policy.can(user, "card.review", _load_card(ch)):
        raise HTTPException(403, "Chỉ người đề xuất hoặc người duyệt được cập nhật đề xuất")
    if ch["status"] not in OPEN:
        raise HTTPException(409, "Đề xuất đã đóng")
    card = _load_card(ch)
    if ch["kind"] != "create":
        ensure_not_obsolete(card)
    p = ch.get("proposal") or {}
    proposal = _only_changes(card, p.get("set") or {}, p.get("unset") or []) if ch["kind"] != "obsolete" else p
    if ch["kind"] not in ("create", "obsolete") and not proposal:
        raise HTTPException(409, "Bản mới đã có đủ nội dung của đề xuất — nên rút đề xuất")
    now = db.now()
    kept = [a for a in ch.get("approvals") or [] if a["decision"] == "comment"]
    kept.append({"user_id": user["_id"], "step": 0, "decision": "comment", "at": now, "on_behalf_of": None,
                 "comment": f"Cập nhật lên bản {card.get('current_revision')} — duyệt lại từ bước 1"})
    res = change_requests.find_one_and_update({"_id": ch["_id"], "status": {"$in": list(OPEN)}}, {"$set": {
        "status": "open", "base_rev": card.get("current_revision"), "proposal": proposal, "approvals": kept,
        "updated_at": now, **_deadlines(now)}}, return_document=ReturnDocument.AFTER)
    if not res:
        raise HTTPException(409, RACE_MSG)
    return res


def withdraw(ch: dict, user: dict, reason: str = "") -> dict:
    if user["_id"] != ch.get("created_by"):
        raise HTTPException(403, "Chỉ người đề xuất được rút đề xuất")
    if ch["status"] not in OPEN:
        raise HTTPException(409, "Đề xuất đã đóng")
    res = change_requests.find_one_and_update(
        {"_id": ch["_id"], "status": {"$in": list(OPEN)}},
        {"$set": {"status": "withdrawn", "decided_at": db.now(), "updated_at": db.now(), "withdraw_reason": reason}},
        return_document=ReturnDocument.AFTER)
    if not res:
        raise HTTPException(409, RACE_MSG)
    _stop_novelty({"_id": ch["_id"]})
    return res


def can_resubmit(user: dict, ch: dict, card: dict | None = None) -> bool:
    """Người đề xuất (hoặc tác giả nội dung) gửi lại đề xuất đang bị trả về (GOV-13)."""
    if ch["status"] not in OPEN or not ch.get("returned"):
        return False
    return user["_id"] == ch.get("created_by") or user["_id"] in authors(ch, card)


EDITABLE_KINDS = ("update", "classify")     # gửi lại kèm nội dung mới; loại khác chỉ sửa tóm tắt / lý do


def resubmit(ch: dict, user: dict, changes: dict | None = None, summary: str | None = None, note: str = "") -> dict:
    """Gửi lại đề xuất bị trả về (GOV-13, TK-04d): bỏ `returned`, ghi lượt `resubmit`, tính lại hạn bước hiện tại
    (lượt duyệt bước trước giữ nguyên). `changes` (trường như PATCH thẻ) ghi đè từng trường lên nội dung đề xuất cũ
    (trường không nhắc giữ nguyên; đặt lại đúng giá trị bản hiệu lực = bỏ trường đó khỏi đề xuất) — chỉ đề xuất
    `update` / `classify`; thẻ nháp (`create`) thì sửa thẳng thẻ rồi gửi lại. Thẻ đã lên bản khác bản đề xuất
    dựng trên → `needs_rebase` như hiện nay. Cập nhật có điều kiện theo đúng lượt trả về vừa đọc (bấm đúp → 409)."""
    card = _load_card(ch)
    if user["_id"] != ch.get("created_by") and user["_id"] not in authors(ch, card):
        raise HTTPException(403, "Chỉ người đề xuất (hoặc tác giả nội dung) được gửi lại đề xuất")
    if ch["status"] not in OPEN:
        raise HTTPException(409, "Đề xuất đã đóng")
    ret = ch.get("returned")
    if not ret:
        raise HTTPException(409, "Đề xuất không bị trả về — không cần gửi lại")
    note = (note or "").strip()[:4000]
    now = _now_ms()
    upd: dict = {"updated_at": now, **_deadlines(now)}
    if changes is not None:
        if ch["kind"] not in EDITABLE_KINDS:
            raise HTTPException(400, "Loại đề xuất này không sửa nội dung khi gửi lại — thẻ nháp thì sửa thẳng thẻ "
                                     "trong VCWIKI rồi bấm Gửi lại; lỗi thời / quay về bản cũ chỉ sửa được lý do")
        ensure_not_obsolete(card)
        from .routes import CardPatch, normalize_patch   # nhập muộn: routes nhập module này
        allowed = set(CardPatch.model_fields) - {"status", "reason", "change_summary", "change_kind"}
        if bad := sorted(set(changes) - allowed):
            raise HTTPException(400, f"Trường không có: {', '.join(bad)} — trường sửa được: {', '.join(sorted(allowed))}")
        set_, unset = normalize_patch(card, CardPatch(**changes))
        new_keys = set(set_) | set(unset)
        old = ch.get("proposal") or {}
        set_ = {k: v for k, v in (old.get("set") or {}).items() if k not in new_keys} | set_
        unset = [k for k in old.get("unset") or [] if k not in new_keys] + list(unset)
        proposal = _only_changes(card, set_, unset)
        if not proposal:
            raise HTTPException(400, "Không có gì thay đổi so với bản hiệu lực")
        upd["proposal"] = proposal
        if ch.get("change_kind") != "major":    # nội dung mới đụng trường lớn thì thành thay đổi lớn
            upd["change_kind"] = guess_change_kind(proposal)
    if summary is not None and summary.strip():
        upd["summary"] = summary.strip()[:1000]
    if ch["kind"] == "create":
        upd["novelty_status"] = "pending"        # thẻ nháp có thể đã sửa — so sánh lại
    elif ch["status"] == "open" and _stale(ch, card):
        upd["status"] = "needs_rebase"
    entry = {"user_id": user["_id"], "step": current_step(ch), "decision": "resubmit", "on_behalf_of": None,
             "comment": note or "Đã sửa theo góp ý — gửi lại", "at": now}
    res = change_requests.find_one_and_update(
        {"_id": ch["_id"], "status": {"$in": list(OPEN)}, "returned.at": ret["at"]},
        {"$set": upd, "$unset": {"returned": ""}, "$push": {"approvals": entry}},
        return_document=ReturnDocument.AFTER)
    if not res:
        raise HTTPException(409, RACE_MSG)
    return res


def returned_to_me_filter(user: dict) -> dict:
    """Đề xuất của tôi đang bị trả về, chờ tôi sửa rồi gửi lại (`GET /api/me/inbox/counts` → `returned_to_me`)."""
    return {"created_by": user["_id"], "status": {"$in": list(OPEN)}, "returned": {"$ne": None}}


# ---------------------------------------------------------------------------
# Cổng so sánh — worker nền
# ---------------------------------------------------------------------------

RETRY_AFTER = timedelta(minutes=10)


def run_novelty(ch: dict) -> dict | None:
    """Chạy cổng so sánh cho đề xuất `create` (đọc thẻ nháp hiện tại). Kết quả gốc lưu `novelty_ai`; người đã sửa
    kết quả thì giữ kết quả người sửa làm kết quả hiệu lực."""
    card = cards.find_one({"_id": ch["card_id"]})
    proposer = users.find_one({"_id": ch.get("created_by")}) if ch.get("created_by") else None
    if not card or not proposer:
        change_requests.update_one({"_id": ch["_id"]}, {"$set": {"novelty_status": "skipped"}})
        return None
    res = novelty.classify(card, proposer)
    now = db.now()
    upd = {"novelty_ai": res | {"at": now}, "novelty_status": "done", "updated_at": now,
           "novelty_retry_at": now + RETRY_AFTER if res.get("engine") == "heuristic" else None}
    if not ch.get("novelty_override"):
        upd["novelty"] = res
    change_requests.update_one({"_id": ch["_id"]}, {"$set": upd})
    return res


def novelty_next() -> bool:
    """Một việc của worker: đề xuất chờ so sánh, hoặc kết quả heuristic cần chạy lại khi AI đã sẵn sàng."""
    ch = change_requests.find_one_and_update(
        {"novelty_status": "pending", "status": {"$in": list(OPEN)}},
        {"$set": {"novelty_status": "running"}}, sort=[("created_at", 1)])
    if not ch and novelty.ai_available():
        ch = change_requests.find_one_and_update(
            {"novelty_status": "done", "status": {"$in": list(OPEN)}, "novelty_ai.engine": "heuristic",
             "novelty_retry_at": {"$lte": db.now()}},
            {"$set": {"novelty_status": "running"}}, sort=[("created_at", 1)])
    if not ch:
        return False
    try:
        run_novelty(ch)
    except Exception:  # noqa: BLE001 — không để worker chết; thử lại sau
        traceback.print_exc()
        change_requests.update_one({"_id": ch["_id"]}, {"$set": {"novelty_status": "done",
                                                                 "novelty_retry_at": db.now() + RETRY_AFTER}})
    return True


class NoveltyWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="gov-novelty", daemon=True)

    def start(self) -> None:
        change_requests.update_many({"novelty_status": "running"}, {"$set": {"novelty_status": "pending"}})
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                worked = novelty_next()
            except Exception:  # noqa: BLE001
                traceback.print_exc()
                worked = False
            if not worked:
                self._stop.wait(3)


worker = NoveltyWorker()


# ---------------------------------------------------------------------------
# Quyền xem + xuất
# ---------------------------------------------------------------------------

def assigned_reviewer(user: dict, ch: dict, card: dict | None) -> bool:
    """Người được giao duyệt đề xuất này (BA 18.10 điểm 3 — đã quyết 26/09): đề xuất đang mở → người duyệt bước 2
    được chỉ định (`step2_rule`); đề xuất đã đóng → người bước 2 lúc chốt (`step2_ids`) hoặc người đã duyệt / từ
    chối. Người chỉ nhận xét, hay người bước 2 cũ đã không còn được giao, không tính."""
    if not card:
        return False
    if ch["status"] in OPEN:
        return user["_id"] in step2_rule(ch, card)[0]
    return user["_id"] in (ch.get("step2_ids") or []) or any(
        a.get("user_id") == user["_id"] and a.get("decision") in ("approve", "reject")
        for a in ch.get("approvals") or [])


def view_access(user: dict, ch: dict, card: dict | None = None, channel: str = "web") -> str | None:
    """Vì sao xem được đề xuất: "space" (xem được thẻ / người đề xuất), "reviewer" (người duyệt được giao, ở ngoài
    kho — ngoại lệ ORG-13 có ghi nhật ký), None (không xem được → 404)."""
    card = card or cards.find_one({"_id": ch["card_id"]}) or {}
    if user["_id"] == ch.get("created_by") or policy.can(user, "card.read", card, channel):
        return "space"
    return "reviewer" if assigned_reviewer(user, ch, card) else None


def can_view(user: dict, ch: dict, card: dict | None = None) -> bool:
    """Xem được thẻ, hoặc là người đề xuất, hoặc là người được giao duyệt đề xuất này (bước 2 có thể là người
    ngoài kho — chủ nhánh / TGĐ). Người ngoài kho khác → không thấy (404)."""
    return view_access(user, ch, card) is not None


def _names(ids) -> dict:
    ids = [i for i in set(ids) if i]
    return {u["_id"]: u["name"] for u in users.find({"_id": {"$in": ids}}, {"name": 1})} if ids else {}


def _plain(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, list):
        return [_plain(x) for x in v]
    if isinstance(v, dict):
        return {k: _plain(x) for k, x in v.items()}
    return v


def _card_brief(c: dict | None) -> dict | None:
    if not c:
        return None
    return {"id": str(c["_id"]), "title": c.get("title"), "summary": c.get("summary"), "body": c.get("body"),
            "key_points": c.get("key_points") or [], "status": c.get("status"), "type": c.get("type"),
            "categories": c.get("categories") or [], "level": c.get("level"),
            "current_revision": c.get("current_revision")}


def change_out(ch: dict, user: dict, full: bool = False, card: dict | None = None) -> dict:
    card = card if card is not None else (cards.find_one({"_id": ch["card_id"]}) or {})
    if ch["status"] not in OPEN and ch.get("step2_label"):
        step2, label = ch.get("step2_ids") or [], ch["step2_label"]   # người bước 2 lúc chốt (QA P-3)
    else:
        step2, label = step2_rule(ch, card) if card else ([], "")
    now = db.now()
    ret = ch.get("returned") or None
    names = _names([ch.get("created_by"), *[a.get("user_id") for a in ch.get("approvals") or []], *step2,
                    (ret or {}).get("by")])
    o = {("id" if k == "_id" else k): _plain(v) for k, v in ch.items() if k not in ("proposal",)}
    open_ = ch["status"] == "open" and not ret     # đang trả về: hạn duyệt chưa chạy (tính lại khi gửi lại)
    due = ch.get("due_at")
    due = due.replace(tzinfo=now.tzinfo) if due and due.tzinfo is None else due
    esc = ch.get("escalate_at")
    esc = esc.replace(tzinfo=now.tzinfo) if esc and esc.tzinfo is None else esc
    o |= {
        "kind_label": kind_label(ch),
        "card": {"id": str(card["_id"]), "title": card.get("title"), "status": card.get("status"),
                 "type": card.get("type"), "level": card.get("level"), "categories": card.get("categories") or [],
                 "current_revision": card.get("current_revision"), "space_id": str(card.get("space_id"))} if card else None,
        "created_by_name": names.get(ch.get("created_by")),
        "approvals": [_plain(a) | {"user_name": names.get(a.get("user_id"))} for a in ch.get("approvals") or []],
        "step": current_step(ch), "min_approvers": min_approvers(), "step2_label": label,
        "step2_names": [names[u] for u in step2 if u in names],
        "overdue": bool(open_ and due and now > due), "needs_escalation": bool(open_ and esc and now > esc),
        "can_decide": bool(card) and can_decide(user, card, ch, step2),
        "can_withdraw": ch["status"] in OPEN and user["_id"] == ch.get("created_by"),
        "can_rebase": ch["status"] == "needs_rebase" and (
            user["_id"] == ch.get("created_by") or (bool(card) and policy.can(user, "card.review", card))),
        "is_mine": user["_id"] == ch.get("created_by"),
        # GOV-13: trả về người đề xuất sửa — `returned` (ở trên) {by, at, step, note} + tên người trả về
        "returned_by_name": names.get(ret["by"]) if ret else None,
        "can_return": False,
        "can_resubmit": bool(card) and can_resubmit(user, ch, card),
        # QA C-2: người duyệt bước 2 ngoài kho xem đề xuất nhưng không mở được trang thẻ
        "can_open_card": bool(card) and policy.can(user, "card.read", card),
    }
    o["can_override_novelty"] = ch["kind"] == "create" and o["can_decide"]
    o["can_return"] = o["can_decide"]            # trả về: quyền như duyệt bước hiện tại
    if full and card:
        after = apply_preview(card, ch)
        base = card
        if ch["kind"] != "create" and ch.get("base_rev") and ch["status"] not in OPEN:
            base_rev = revisions.get_revision(card["_id"], ch["base_rev"])
            base = base_rev["snapshot"] if base_rev else card
            done = revisions.get_revision(card["_id"], ch.get("revision")) if ch.get("revision") else None
            after = done["snapshot"] if done else after
        o["before"] = None if ch["kind"] == "create" else _plain(revisions.snapshot(base))
        o["after"] = _plain(revisions.snapshot(after))
        o["diff"] = [] if ch["kind"] == "create" else revisions.diff_snapshots(revisions.snapshot(base),
                                                                               revisions.snapshot(after))
        o["proposal_fields"] = sorted({*(ch.get("proposal") or {}).get("set", {}),
                                       *(ch.get("proposal") or {}).get("unset", [])})
        rel = (ch.get("novelty") or {}).get("related") or []
        rel_cards = {c["_id"]: c for c in cards.find({"_id": {"$in": [r["card_id"] for r in rel]}})}
        o["related_cards"] = [_card_brief(rel_cards.get(r["card_id"])) | {"score": r.get("score"), "rev": r.get("rev")}
                              for r in rel if r["card_id"] in rel_cards and policy.can(user, "card.read",
                                                                                      rel_cards[r["card_id"]])]
        o["suggested_reviewers"] = suggested_reviewers(card, ch, step2) if open_ else []
    return o


def inbox(user: dict, limit: int = 300) -> list[dict]:
    """Đề xuất đang mở mà người này duyệt được ở bước hiện tại, hạn gần trước. Đề xuất đang bị trả về (`returned`,
    GOV-13) không vào — `can_decide` loại."""
    out = []
    card_cache: dict = {}
    for ch in change_requests.find({"status": "open"}).sort("due_at", 1).limit(2000):
        card = card_cache.get(ch["card_id"]) or cards.find_one({"_id": ch["card_id"]})
        if not card:
            continue
        card_cache[ch["card_id"]] = card
        if can_decide(user, card, ch):
            out.append((ch, card))
        if len(out) >= limit:
            break
    return out


# ---------------------------------------------------------------------------
# API (mục 8 dòng "Quản trị tri thức")
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/wiki")


def _oid(v: str, what: str = "đề xuất") -> ObjectId:
    try:
        return ObjectId(v)
    except (InvalidId, TypeError):
        raise HTTPException(404, f"Không tìm thấy {what}") from None


def load_change(change_id: str, user: dict, channel: str = "web") -> dict:
    """Đề xuất người này xem được; người duyệt được giao ở ngoài kho → mỗi lần mở ghi `access_log` (ORG-11)."""
    ch = change_requests.find_one({"_id": _oid(change_id)})
    card = cards.find_one({"_id": ch["card_id"]}) if ch else None
    access = view_access(user, ch, card, channel) if ch else None
    if not access:
        raise HTTPException(404, "Không tìm thấy đề xuất")
    if access == "reviewer":
        org.log_access(user, channel, "change.read_as_reviewer", "change_request", ch["_id"],
                       policy.effective_classification(card or {}))
    return ch


def _load_card_for(card_id: str, user: dict, action: str = "card.read") -> dict:
    card = cards.find_one({"_id": _oid(card_id, "thẻ")})
    if not card or card.get("delete_requested"):
        raise HTTPException(404, "Không tìm thấy thẻ")
    policy.require(user, action, card, "thẻ")
    return card


class ChangeIn(BaseModel):
    kind: ChangeKind
    card_id: str
    summary: str = Field("", max_length=1000)
    change_kind: Level | None = None
    rev: int | None = Field(None, ge=1)                    # rollback: phiên bản muốn quay về
    replaced_by: str | None = None                         # obsolete: thẻ thay thế
    changes: dict | None = None                            # update / classify: trường muốn đổi (như PATCH thẻ)


class DecideIn(BaseModel):
    decision: Literal["approve", "reject", "comment", "return"]
    comment: str = Field("", max_length=4000)
    change_kind: Level | None = None


class NoveltyOverrideIn(BaseModel):
    verdict: NoveltyVerdict
    reason: str = Field("", max_length=1000)


class ResubmitIn(BaseModel):
    proposal: dict | None = None                           # trường muốn đổi (như PATCH thẻ) — thay nội dung đề xuất cũ
    summary: str | None = Field(None, max_length=1000)
    note: str = Field("", max_length=4000)                 # lời nhắn cho người duyệt (ghi vào lượt `resubmit`)


class WithdrawIn(BaseModel):
    reason: str = Field("", max_length=1000)


class SettingsIn(BaseModel):
    min_approvers: Literal[1, 2]


class RollbackIn(BaseModel):
    rev: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=1000)


def create_from_api(body: ChangeIn, user: dict, origin: str = "manual") -> dict:
    card = _load_card_for(body.card_id, user)
    changes = body.changes or {}
    to_knowledge = body.kind == "update" and "type" in changes and changes["type"] not in EXEMPT_TYPES
    if not governed(card) and not to_knowledge:   # bộ nhớ AI đổi sang loại tri thức thì đi qua đề xuất (QA N-2)
        raise HTTPException(400, "Thẻ bộ nhớ AI không qua luồng duyệt")
    if body.kind == "create":
        policy.require(user, "card.write", card, "thẻ")
        return submit_draft(card, user, origin if card.get("origin") in (None, "manual") else None, body.summary)
    policy.require(user, "card.propose", card, "thẻ")
    if card.get("status") != "approved":
        raise HTTPException(400, "Thẻ nháp sửa trực tiếp được — đề xuất chỉ dành cho thẻ đã duyệt")
    ensure_not_obsolete(card)          # QA C-3
    if body.kind == "rollback":
        if not body.rev or not body.summary.strip():
            raise HTTPException(400, "Quay về bản cũ cần số phiên bản và lý do")
        target = revisions.get_revision(card["_id"], body.rev)
        if not target:
            raise HTTPException(404, f"Không tìm thấy phiên bản {body.rev}")
        if body.rev == card.get("current_revision") and not revisions.has_unversioned_changes(card):
            raise HTTPException(400, "Thẻ đang ở đúng phiên bản này")
        snap = target["snapshot"]
        proposal = {"set": snap, "unset": [f for f in SNAPSHOT_FIELDS if f not in snap and f in card]}
        return create_change(card, user, "rollback", proposal, body.summary, body.change_kind or "major", origin,
                             author_ai=origin == "mcp", extra={"target_rev": body.rev})
    if body.kind == "obsolete":
        if not body.summary.strip():
            raise HTTPException(400, "Cần ghi lý do thẻ lỗi thời")
        repl = _load_card_for(body.replaced_by, user)["_id"] if body.replaced_by else None
        return create_change(card, user, "obsolete", None, body.summary, None, origin, author_ai=origin == "mcp",
                             extra={"obsolete": {"replaced_by": repl}})
    if body.kind == "merge":
        raise HTTPException(501, "Chưa triển khai đề xuất gộp thẻ (để sau đợt dùng thử)")
    from .routes import CardPatch, normalize_patch   # nhập muộn: routes nhập module này
    allowed = set(CardPatch.model_fields) - {"status", "reason", "change_summary", "change_kind"}
    if bad := sorted(set(changes) - allowed):    # QA P-5: không bỏ im lặng tên trường gõ sai
        raise HTTPException(400, f"Trường không có: {', '.join(bad)} — trường sửa được: {', '.join(sorted(allowed))}")
    patch = CardPatch(**changes)
    set_, unset = normalize_patch(card, patch)
    return propose_update(card, user, set_, unset, body.summary, body.change_kind, origin, body.kind)


@router.get("/review-settings")
def get_settings(user: dict = Depends(current_user)):
    s = settings()
    total = change_requests.count_documents({"novelty_ai": {"$ne": None}})
    changed = change_requests.count_documents({"novelty_override.changed": True})
    return s | {"can_edit": user.get("role") == "admin",
                "novelty_stats": {"total": total, "overridden": changed,
                                  "rate": round(changed / total, 3) if total else None}}


@router.put("/review-settings")
def put_settings(body: SettingsIn, _admin: dict = Depends(require_admin)):
    meta.update_one({"_id": SETTINGS_ID}, {"$set": {"min_approvers": body.min_approvers, "updated_at": db.now()}},
                    upsert=True)
    return settings()


@router.post("/changes", status_code=201)
def post_change(body: ChangeIn, user: dict = Depends(current_user)):
    ch = create_from_api(body, user)
    return change_out(ch, user, full=True)


FILTERED_VERDICTS = ("duplicate", "noise")   # cổng so sánh xếp TRÙNG / NHIỄU — hộp duyệt ẩn mặc định
SCAN_CAP = 3000                                 # số đề xuất tối đa quét để đếm tổng (lọc quyền xem ở tầng ứng dụng)


def _is_filtered(ch: dict) -> bool:
    return ((ch.get("novelty") or {}).get("verdict")) in FILTERED_VERDICTS


@router.get("/changes")
def list_changes(inbox_: int = Query(0, alias="inbox"), mine: int = 0, status: str | None = None,
                 card_id: str | None = None, kind: str | None = None, hide_filtered: int = 0,
                 page: int = Query(1, ge=1), page_size: int = Query(24, ge=1, le=300),
                 limit: int | None = Query(None, ge=1, le=300),
                 user: dict = Depends(current_user)):
    """inbox=1: chờ tôi duyệt (hạn gần trước). mine=1: tôi đề xuất. card_id: đề xuất của một thẻ. status / kind:
    lọc theo trạng thái / loại đề xuất (nhiều giá trị cách nhau bằng dấu phẩy; `returned` = đang bị trả về, GOV-13). hide_filtered=1: bỏ đề xuất cổng
    so sánh xếp TRÙNG / NHIỄU (trả `hidden` = số bị bỏ). Phân trang `page` / `page_size` (tổng đếm thật sau khi lọc
    quyền xem); `limit` cũ = page_size trang 1."""
    if limit:
        page_size = limit
    if inbox_:
        rows = inbox(user, SCAN_CAP)                       # [(đề xuất, thẻ)]
    else:
        f: dict = {}
        if mine:
            f["created_by"] = user["_id"]
        if status:
            sts = status.split(",")
            if "returned" in sts:     # "Cần sửa" (GOV-13): đề xuất đang mở mang `returned`
                rest = [s for s in sts if s != "returned"]
                f["$or"] = [{"status": {"$in": rest}}, {"status": {"$in": list(OPEN)}, "returned": {"$ne": None}}]
            else:
                f["status"] = {"$in": sts}
        if kind:
            f["kind"] = {"$in": kind.split(",")}
        if card_id:
            f["card_id"] = _load_card_for(card_id, user)["_id"]
        card_cache: dict = {}
        rows = []
        for ch in change_requests.find(f).sort("updated_at", -1).limit(SCAN_CAP):
            card = card_cache.get(ch["card_id"])
            if card is None:
                card = card_cache[ch["card_id"]] = cards.find_one({"_id": ch["card_id"]}) or {}
            if can_view(user, ch, card or None):
                rows.append((ch, card or None))
    hidden = 0
    if hide_filtered:
        kept = [r for r in rows if not _is_filtered(r[0])]
        hidden, rows = len(rows) - len(kept), kept
    total = len(rows)
    start = (page - 1) * page_size
    return {"items": [change_out(ch, user, card=card) for ch, card in rows[start:start + page_size]],
            "total": total, "hidden": hidden,
            "page": page, "page_size": page_size}


@router.get("/changes/{change_id}")
def get_change(change_id: str, user: dict = Depends(current_user)):
    return change_out(load_change(change_id, user), user, full=True)


@router.post("/changes/{change_id}/decide")
def decide_change(change_id: str, body: DecideIn, user: dict = Depends(current_user)):
    ch = decide(load_change(change_id, user), user, body.decision, body.comment, body.change_kind)
    return change_out(ch, user, full=True)


@router.post("/changes/{change_id}/rebase")
def rebase_change(change_id: str, user: dict = Depends(current_user)):
    return change_out(rebase(load_change(change_id, user), user), user, full=True)


@router.post("/changes/{change_id}/resubmit")
def resubmit_change(change_id: str, body: ResubmitIn, user: dict = Depends(current_user)):
    """Gửi lại đề xuất bị trả về (GOV-13, DESIGN TK-04d)."""
    return change_out(resubmit(load_change(change_id, user), user, body.proposal, body.summary, body.note), user,
                      full=True)


@router.post("/changes/{change_id}/withdraw")
def withdraw_change(change_id: str, body: WithdrawIn | None = None, user: dict = Depends(current_user)):
    return change_out(withdraw(load_change(change_id, user), user, (body or WithdrawIn()).reason), user, full=True)


@router.post("/changes/{change_id}/novelty")
def override_novelty(change_id: str, body: NoveltyOverrideIn, user: dict = Depends(current_user)):
    """Người duyệt đổi kết quả cổng so sánh (BA 16.2). Kết quả gốc của AI giữ ở `novelty_ai`. Người đề xuất không
    đổi được (QA P-4): MÂU THUẪN đổi người duyệt bước 2 — người đề xuất không tự chọn người duyệt (16.4)."""
    ch = load_change(change_id, user)
    card = _load_card(ch)
    if not can_decide(user, card, ch):
        raise HTTPException(403, "Chỉ người duyệt của bước hiện tại được đổi kết quả cổng so sánh")
    base = ch.get("novelty") or {"related": [], "engine": None}
    ai_verdict = (ch.get("novelty_ai") or {}).get("verdict")
    now = db.now()
    reason = body.reason.strip() or f"Người duyệt đổi kết quả (AI: {ai_verdict or 'chưa có'})"   # không giữ lý do cũ
    change_requests.update_one({"_id": ch["_id"]}, {"$set": {
        "novelty": base | {"verdict": body.verdict, "reason": reason},
        "novelty_override": {"verdict": body.verdict, "reason": body.reason, "by": user["_id"], "at": now,
                             "ai_verdict": ai_verdict, "changed": bool(ai_verdict) and ai_verdict != body.verdict},
        "updated_at": now}})
    return change_out(change_requests.find_one({"_id": ch["_id"]}), user, full=True)


class NoveltyIn(BaseModel):
    card_id: str


@router.post("/novelty", status_code=202)
def queue_novelty(body: NoveltyIn, user: dict = Depends(current_user)):
    """Chạy lại cổng so sánh cho thẻ nháp (xếp hàng worker nền — không chạy trong request)."""
    card = _load_card_for(body.card_id, user, "card.write")
    if not governed(card):     # QA P-5: bộ nhớ AI không vào hộp duyệt
        raise HTTPException(400, "Thẻ bộ nhớ AI không qua luồng duyệt — không chạy cổng so sánh")
    ch = open_change(card["_id"], "create") or submit_draft(card, user)
    change_requests.update_one({"_id": ch["_id"]}, {"$set": {"novelty_status": "pending"}})
    return {"queued": True, "change_id": str(ch["_id"])}


@router.post("/cards/{card_id}/rollback")
def rollback_via_change(card_id: str, body: RollbackIn, user: dict = Depends(current_user)):
    """Quay về bản cũ (quyết định 18.7.1). Thẻ đã duyệt → đề xuất `rollback` do chủ sở hữu lĩnh vực duyệt, trả
    `{change}`; thẻ nháp (sửa trực tiếp được) → quay về ngay như luồng C, trả `{card, revision}`. Router này đăng ký
    trước router luồng C nên thay endpoint cùng đường dẫn; `revisions.rollback` giữ làm hàm nội bộ."""
    card = _load_card_for(card_id, user)
    if card.get("status") != "approved" or not governed(card):
        from . import revision_routes   # nhập muộn: tránh vòng import
        return revision_routes.rollback_card(card_id, revision_routes.RollbackIn(rev=body.rev, reason=body.reason),
                                             user)
    ch = create_from_api(ChangeIn(kind="rollback", card_id=card_id, rev=body.rev, summary=body.reason), user)
    return {"change": change_out(ch, user, full=True)}


def _todo(req: str):
    def handler(_user: dict = Depends(current_user)):
        raise HTTPException(501, f"Chưa triển khai ({req})")
    return handler


router.add_api_route("/reviews/due", _todo("GOV-09"), methods=["GET"], name="gov_get_/reviews/due")
