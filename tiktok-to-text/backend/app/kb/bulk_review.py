"""Duyệt hàng loạt thẻ nháp trên /wiki/review (yêu cầu 6ab76de3…d817e mục B — anh Thọ Anh đồng ý trực tiếp 26/09).

Chỉ cho người bấm trên web (không mở qua MCP). Không có luật duyệt riêng: mỗi thẻ đi đúng đường duyệt đơn lẻ —
`changes.submit_draft` (đưa thẻ nháp vào hộp duyệt như nút "Gửi duyệt", đã có đề xuất mở thì dùng lại) rồi
`changes.decide` (bốn mắt, `min_approvers`, chốt nguyên tử, ghi phiên bản). Người không duyệt được thẻ nào thì thẻ đó
bị bỏ qua kèm lý do, không tạo đề xuất.

Phạm vi: thẻ trong kho mình xem được (`policy.visible_filter`). Người duyệt bước 2 ở ngoài kho vẫn duyệt từng thẻ
trong hộp duyệt (mỗi lần mở ghi access_log — BA 18.10 điểm 3), không duyệt hàng loạt thẻ mình không xem được.

Mặc định loại khỏi lựa chọn (bật từng ô để gộp vào):
- thẻ tag `xem-lai-phan-loai` (độ tin cậy phân loại thấp) và `chua-xep-v2` (chưa xếp cây v2) — apply_v2;
- đề xuất có kết quả cổng so sánh NHIỄU (`noise`) / TRÙNG (`duplicate`);
- thẻ chưa có kết quả cổng so sánh (chưa gửi duyệt, hoặc đang chờ worker) — chỉ khi DUYỆT; từ chối không cần chờ.
"""

from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import db
from ..auth import current_user
from . import classify
from . import changes as gov
from .apply_v2 import LOW_TAG, UNSORTED_TAG
from .revisions import cards

router = APIRouter(prefix="/api/wiki")

MAX_PER_CALL = 200          # mỗi lượt bấm; nhiều hơn thì bấm tiếp (giao diện tự chạy từng lượt)
PREVIEW_LIMIT = 500
SKIP_VERDICTS = ("noise", "duplicate")


class BulkFilter(BaseModel):
    category: str | None = None           # nhánh, gồm nhánh con
    level: str | None = None              # nhiều giá trị cách dấu phẩy (như /wiki/cards)
    division: str | None = None
    type: str | None = None
    space_id: str | None = None
    q: str | None = None
    ids: str | None = None                # giới hạn đúng một danh sách mã thẻ (cách dấu phẩy) — vd link khoá mẫu /learn
    include_low_confidence: bool = False  # gộp thẻ tag xem-lai-phan-loai
    include_unsorted: bool = False        # gộp thẻ tag chua-xep-v2
    include_noise_duplicate: bool = False
    include_pending_novelty: bool = False


class BulkDecideIn(BulkFilter):
    card_ids: list[str] = Field(min_length=1, max_length=MAX_PER_CALL)
    decision: str = Field(pattern="^(approve|reject)$")
    comment: str = Field("", max_length=4000)


def _card_filter(user: dict, f: BulkFilter) -> dict:
    from .routes import space_scope   # tránh vòng import (routes nạp nhiều module kb)
    q = space_scope(f.space_id, user, f.category)
    conds: list[dict] = [q, {"status": "draft", "delete_requested": {"$ne": True},
                             "type": {"$nin": list(gov.EXEMPT_TYPES)}}]
    conds += classify.filters(f.level, f.division)
    if types := classify.csv(f.type):
        conds.append({"type": {"$in": types}})
    if f.ids and f.ids.strip():
        try:
            oids = [ObjectId(x) for x in f.ids.split(",") if x.strip()]
        except (InvalidId, TypeError):
            raise HTTPException(400, "Danh sách mã thẻ (ids) không hợp lệ") from None
        conds.append({"_id": {"$in": oids}})
    skip_tags = [t for t, inc in ((LOW_TAG, f.include_low_confidence), (UNSORTED_TAG, f.include_unsorted)) if not inc]
    if skip_tags:
        conds.append({"tags": {"$nin": skip_tags}})
    if f.q and f.q.strip():
        conds.append({"search_text": db.search_regex(f.q)})
    return {"$and": conds}


def _pseudo_create(card: dict) -> dict:
    """Đề xuất `create` như `submit_draft` sẽ tạo — chỉ để hỏi `can_decide` trước khi tạo thật."""
    origin = card.get("origin") or "manual"
    return {"kind": "create", "card_id": card["_id"], "status": "open", "approvals": [], "proposal": None,
            "novelty": None, "author_ai": origin in ("ai", "mcp"), "created_by": card.get("created_by")}


def _verdict(ch: dict | None) -> str | None:
    return ((ch or {}).get("novelty") or {}).get("verdict")


def assess(user: dict, card: dict, ch: dict | None, f: BulkFilter, decision: str = "approve") -> str | None:
    """Lý do bỏ qua thẻ (None = làm được)."""
    if ch and ch.get("status") == "needs_rebase":
        return "Đề xuất cần cập nhật (rebase)"
    if ch and ch.get("returned"):
        return "Đề xuất đã trả về người đề xuất (chờ gửi lại)"     # GOV-13
    v = _verdict(ch)
    if v in SKIP_VERDICTS and not f.include_noise_duplicate:
        return "Cổng so sánh xếp " + ("NHIỄU" if v == "noise" else "TRÙNG")
    if decision == "approve" and not v and not f.include_pending_novelty:
        return "Chưa có kết quả cổng so sánh"
    if not gov.can_decide(user, card, ch or _pseudo_create(card)):
        if user["_id"] in gov.authors(ch or _pseudo_create(card), card):
            return "Bạn là tác giả (bốn mắt)"
        return "Bạn không phải người duyệt của thẻ này"
    return None


def _open_creates(card_ids: list[ObjectId]) -> dict[ObjectId, dict]:
    out: dict = {}
    for ch in gov.change_requests.find({"card_id": {"$in": card_ids}, "kind": "create",
                                        "status": {"$in": list(gov.OPEN)}}).sort("created_at", 1):
        out[ch["card_id"]] = ch
    return out


@router.post("/bulk-review/preview")
def preview(body: BulkFilter, user: dict = Depends(current_user)):
    """Thẻ nháp khớp bộ lọc: làm được / bị bỏ qua (theo lý do). Trả tối đa PREVIEW_LIMIT thẻ để chọn."""
    f = _card_filter(user, body)
    total = cards.count_documents(f)
    rows = list(cards.find(f, {"search_text": 0, "text": 0}).sort("created_at", 1).limit(PREVIEW_LIMIT))
    chs = _open_creates([c["_id"] for c in rows])
    items, skipped = [], {}
    for c in rows:
        ch = chs.get(c["_id"])
        reason = assess(user, c, ch, body)
        if reason:
            skipped[reason] = skipped.get(reason, 0) + 1
        items.append({"id": str(c["_id"]), "title": c.get("title") or "", "type": c.get("type"),
                      "level": c.get("level"), "division": c.get("division") or [classify.DEFAULT_DIVISION[0]],
                      "categories": c.get("categories") or [], "tags": c.get("tags") or [],
                      "verdict": _verdict(ch), "change_id": str(ch["_id"]) if ch else None, "skip": reason})
    tag_excluded = {}
    if not body.include_low_confidence or not body.include_unsorted:
        loose = body.model_copy(update={"include_low_confidence": True, "include_unsorted": True})
        base = _card_filter(user, loose)
        for tag, inc in ((LOW_TAG, body.include_low_confidence), (UNSORTED_TAG, body.include_unsorted)):
            if not inc:
                tag_excluded[tag] = cards.count_documents({"$and": [base, {"tags": tag}]})
    return {"total": total, "shown": len(items), "items": items, "skipped": skipped, "tag_excluded": tag_excluded,
            "min_approvers": gov.min_approvers(), "max_per_call": MAX_PER_CALL}


@router.post("/bulk-review/decide")
def bulk_decide(body: BulkDecideIn, user: dict = Depends(current_user)):
    """Duyệt / từ chối các thẻ đã chọn, từng thẻ một qua `changes.decide` (kênh web). Thẻ không còn khớp bộ lọc
    (đã duyệt, bị loại theo tag / cổng so sánh, không xem được) hoặc mình không duyệt được thì bỏ qua kèm lý do."""
    comment = body.comment.strip()
    if body.decision == "reject" and not comment:
        raise HTTPException(400, "Từ chối cần ghi lý do (một nhận xét chung cho cả lượt)")
    try:
        ids = list(dict.fromkeys(ObjectId(x) for x in body.card_ids))
    except (InvalidId, TypeError):
        raise HTTPException(400, "Mã thẻ không hợp lệ") from None
    f = _card_filter(user, body)
    found = {c["_id"]: c for c in cards.find({"$and": [f, {"_id": {"$in": ids}}]})}
    chs = _open_creates(list(found))
    done, skipped = [], []
    for cid in ids:
        card = found.get(cid)
        if not card:
            skipped.append({"id": str(cid), "reason": "Không còn là thẻ nháp khớp bộ lọc"})
            continue
        ch = chs.get(cid)
        if reason := assess(user, card, ch, body, body.decision):
            skipped.append({"id": str(cid), "title": card.get("title"), "reason": reason})
            continue
        try:
            ch = ch or gov.submit_draft(card, user)
            res = gov.decide(ch, user, body.decision, comment or "Duyệt hàng loạt", channel="web")
        except HTTPException as e:
            skipped.append({"id": str(cid), "title": card.get("title"), "reason": str(e.detail)})
            continue
        done.append({"id": str(cid), "title": card.get("title"), "status": res["status"],
                     "revision": res.get("revision")})
    return {"done": done, "skipped": skipped, "min_approvers": gov.min_approvers()}
