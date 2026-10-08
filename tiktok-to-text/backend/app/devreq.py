"""Kênh yêu cầu phát triển: Claude Desktop gửi yêu cầu tính năng → Claude Code nhận, làm, báo cáo ngược lại.

Cả hai phía đi qua MCP của app (tool *_request trong mcp_server.py), dữ liệu ở collection `dev_requests` —
tách khỏi thẻ VCWIKI vì yêu cầu có vòng đời (trạng thái, người nhận, hỏi–đáp) chứ không phải tri thức.

Vòng đời: new → in_progress → (needs_info → new) → done | rejected; người gửi huỷ được bằng cancelled.
Chỉ quản trị viên dùng kênh này: yêu cầu dẫn tới sửa code của app.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from . import db

dev_requests = db.db["dev_requests"]

Priority = Literal["low", "normal", "high", "urgent"]
Status = Literal["new", "in_progress", "needs_info", "done", "rejected", "cancelled"]
PRIORITY_RANK = {"low": 0, "normal": 1, "high": 2, "urgent": 3}
OPEN = ("new", "in_progress", "needs_info")
CLOSED = ("done", "rejected", "cancelled")
CLAIM_TTL_H = 3      # nhận việc mà 3 giờ không cập nhật -> tự về hàng chờ (phiên Claude Code chết giữa chừng)
LOG_MAX = 200
STATUSES = ("new", "in_progress", "needs_info", "done", "rejected", "cancelled")   # = Status


def ensure_indexes() -> None:
    dev_requests.create_index([("status", 1), ("priority_rank", -1), ("created_at", 1)])
    dev_requests.create_index([("created_by", 1), ("updated_at", -1)])
    # mỗi người giữ tối đa MỘT yêu cầu in_progress — khoá ở DB nên claim đồng thời không nhận thêm
    release_extra_claims()
    dev_requests.create_index("claimed_by", name="one_claim_per_user", unique=True,
                              partialFilterExpression={"status": "in_progress"})


def _system_entry(text: str) -> dict:
    return {"at": db.now(), "by": None, "by_name": "hệ thống", "via": "server", "kind": "status", "text": text}


def release_extra_claims() -> int:
    """Dữ liệu cũ (trước khi có khoá) có người giữ > 1 yêu cầu: giữ yêu cầu nhận sớm nhất, nhả phần còn lại."""
    n = 0
    for g in dev_requests.aggregate([
            {"$match": {"status": "in_progress"}}, {"$sort": {"claimed_at": 1, "_id": 1}},
            {"$group": {"_id": "$claimed_by", "ids": {"$push": "$_id"}}}, {"$match": {"ids.1": {"$exists": True}}}]):
        n += dev_requests.update_many(
            {"_id": {"$in": g["ids"][1:]}},
            {"$set": {"status": "new", "claimed_by": None},
             "$push": {"log": _system_entry("Người nhận đang giữ yêu cầu khác — trả về hàng chờ")}}).modified_count
    return n


def _admin(user: dict) -> None:
    if user.get("role") != "admin":
        raise HTTPException(403, "Chỉ quản trị viên dùng kênh yêu cầu phát triển")


def _load(request_id: str) -> dict:
    try:
        doc = dev_requests.find_one({"_id": ObjectId(request_id)})
    except (InvalidId, TypeError):
        doc = None
    if not doc:
        raise HTTPException(404, "Không tìm thấy yêu cầu")
    return doc


def _entry(user: dict, via: str, kind: str, text: str) -> dict:
    return {"at": db.now(), "by": user["_id"], "by_name": user.get("name"), "via": via, "kind": kind,
            "text": text.strip()}


def out(doc: dict, full: bool = True) -> dict:
    res = {k: v for k, v in doc.items() if k not in ("_id", "priority_rank")}
    res["id"] = str(doc["_id"])
    for k in ("created_by", "claimed_by"):
        if res.get(k):
            res[k] = str(res[k])
    if full:
        res["log"] = [e | {"by": str(e["by"]) if e.get("by") else None} for e in doc.get("log", [])]
    else:
        for k in ("description", "log", "report", "acceptance"):
            res.pop(k, None)
        last = (doc.get("log") or [None])[-1]
        res["last_log"] = last and {"at": last["at"], "kind": last["kind"], "text": last["text"][:300]}
    return res


def release_stale() -> int:
    """Yêu cầu nhận quá CLAIM_TTL_H giờ không cập nhật -> về hàng chờ, giữ nhánh / nhật ký để phiên sau làm tiếp."""
    cutoff = db.now() - timedelta(hours=CLAIM_TTL_H)
    return dev_requests.update_many(
        {"status": "in_progress", "claimed_at": {"$lt": cutoff}},
        {"$set": {"status": "new", "resumed": True, "claimed_by": None},
         "$push": {"log": _system_entry(f"Quá {CLAIM_TTL_H} giờ không cập nhật — trả về hàng chờ")}}).modified_count


def submit(user: dict, via: str, title: str, description: str, acceptance: list[str] | None = None,
           priority: Priority = "normal", spec_ref: str | None = None) -> dict:
    _admin(user)
    if not title.strip() or not description.strip():
        raise HTTPException(422, "Cần title và description")
    now = db.now()
    doc = {"title": title.strip()[:200], "description": description.strip(),
           "acceptance": [a.strip() for a in acceptance or [] if a.strip()],
           "priority": priority, "priority_rank": PRIORITY_RANK[priority], "spec_ref": spec_ref,
           "status": "new", "resumed": False, "created_by": user["_id"], "created_by_name": user.get("name"),
           "created_via": via, "created_at": now, "updated_at": now,
           "claimed_by": None, "claimed_at": None, "claimed_via": None,
           "branch": None, "commits": [], "report": None,
           "log": [_entry(user, via, "status", "Tạo yêu cầu")]}
    doc["_id"] = dev_requests.insert_one(doc).inserted_id
    return out(doc)


def list_requests(user: dict, status: str = "", mine: bool = False, limit: int = 20) -> dict:
    """status: danh sách cách dấu phẩy, "" = mọi trạng thái, "open" = new,in_progress,needs_info."""
    _admin(user)
    wanted = _statuses(status)
    release_stale()
    f: dict = {}
    if wanted:
        f["status"] = {"$in": wanted}
    if mine:
        f["created_by"] = user["_id"]
    rows = dev_requests.find(f).sort("updated_at", -1).limit(min(max(limit, 1), 100))
    return {"total": dev_requests.count_documents(f), "items": [out(r, full=False) for r in rows]}


def _statuses(status: str) -> list[str]:
    """Chuỗi trạng thái cách dấu phẩy -> danh sách; "open" mở rộng ở mọi vị trí; trạng thái lạ -> 400."""
    wanted = [s.strip() for s in (status or "").split(",") if s.strip()]
    if wrong := [s for s in wanted if s != "open" and s not in STATUSES]:
        raise HTTPException(400, f"Trạng thái không hợp lệ: {', '.join(wrong)} — chọn trong open, {', '.join(STATUSES)}")
    return list(dict.fromkeys(s for w in wanted for s in (OPEN if w == "open" else (w,))))


def get(user: dict, request_id: str) -> dict:
    _admin(user)
    return out(_load(request_id))


def claim(user: dict, via: str) -> dict:
    """Nhận MỘT yêu cầu. Đang giữ yêu cầu chưa xong thì trả lại chính nó (làm xong mới nhận tiếp).
    Thứ tự: làm dở (resumed) trước, rồi ưu tiên cao, rồi cũ trước."""
    _admin(user)
    release_stale()
    for _ in range(5):
        now = db.now()
        held = dev_requests.find_one_and_update(
            {"status": "in_progress", "claimed_by": user["_id"]}, {"$set": {"claimed_at": now}},
            return_document=True)
        if held:
            return {"request": out(held), "note": "Bạn đang giữ yêu cầu này — làm xong / báo cáo rồi mới nhận tiếp."}
        try:
            doc = dev_requests.find_one_and_update(
                {"status": "new"},
                {"$set": {"status": "in_progress", "claimed_by": user["_id"], "claimed_at": now,
                          "claimed_via": via, "updated_at": now},
                 "$push": {"log": _entry(user, via, "status", "Nhận việc")}},
                sort=[("resumed", -1), ("priority_rank", -1), ("created_at", 1)], return_document=True)
        except DuplicateKeyError:   # phiên khác của cùng người vừa nhận xong -> vòng sau trả lại yêu cầu đó
            continue
        return {"request": doc and out(doc), "queue_left": dev_requests.count_documents({"status": "new"})}
    raise HTTPException(409, "Phiên khác của bạn đang nhận việc — gọi lại claim_request")


def update(user: dict, via: str, request_id: str, status: Literal["in_progress", "needs_info", "done", "rejected"]
           | None = None, note: str = "", branch: str | None = None, commits: list[str] | None = None,
           report: dict | None = None) -> dict:
    """Người đang giữ yêu cầu ghi tiến độ / hỏi lại (needs_info, note = câu hỏi) / báo cáo kết thúc (done, rejected)."""
    _admin(user)
    doc = _load(request_id)
    if doc["status"] != "in_progress" or doc.get("claimed_by") != user["_id"]:
        raise HTTPException(409, f"Yêu cầu đang ở trạng thái {doc['status']} và không do bạn giữ — "
                                 "nhận bằng claim_request trước")
    if status == "needs_info" and not note.strip():
        raise HTTPException(422, "needs_info cần note là câu hỏi cho người gửi")
    if status in ("done", "rejected") and not report:
        raise HTTPException(422, "Kết thúc (done / rejected) cần report có summary")
    if report is not None and not isinstance(report, dict):
        raise HTTPException(422, "report phải là object {summary, changes, tests, verify, followups}")
    if report and not (isinstance(report.get("summary"), str) and report["summary"].strip()):
        raise HTTPException(422, "report cần summary là chuỗi không rỗng (tóm tắt kết quả)")
    now = db.now()
    upd: dict = {"updated_at": now, "claimed_at": now}
    push = []
    if note.strip():
        push.append(_entry(user, via, "question" if status == "needs_info" else "note", note))
    if branch:
        upd["branch"] = branch.strip()
    if report:
        upd["report"] = report | {"at": now, "by_name": user.get("name"), "via": via}
        push.append(_entry(user, via, "report", report["summary"]))
    if status and status != "in_progress":
        upd["status"] = status
        push.append(_entry(user, via, "status", {"needs_info": "Cần người gửi trả lời",
                                                 "done": "Hoàn thành", "rejected": "Từ chối"}[status]))
        if status in ("needs_info", *CLOSED):
            upd["claimed_by"] = None
    ops: dict = {"$set": upd}
    if push:
        ops["$push"] = {"log": {"$each": push, "$slice": -LOG_MAX}}
    if commits:
        ops["$addToSet"] = {"commits": {"$each": [c.strip() for c in commits if c.strip()]}}
    dev_requests.update_one({"_id": doc["_id"]}, ops)
    return out(_load(request_id), full=False)


def reply(user: dict, via: str, request_id: str, text: str, cancel: bool = False) -> dict:
    """Người gửi trả lời câu hỏi (needs_info -> về hàng chờ, được nhận trước), bổ sung ý, hoặc huỷ yêu cầu."""
    _admin(user)
    doc = _load(request_id)
    if not text.strip() and not cancel:
        raise HTTPException(422, "Cần text")
    now = db.now()
    upd: dict = {"updated_at": now}
    push = [_entry(user, via, "answer", text)] if text.strip() else []
    if cancel:
        if doc["status"] in CLOSED:
            raise HTTPException(409, f"Yêu cầu đã {doc['status']}")
        upd |= {"status": "cancelled", "claimed_by": None}
        push.append(_entry(user, via, "status", "Người gửi huỷ"))
    elif doc["status"] in ("needs_info", *CLOSED):   # trả lời câu hỏi, hoặc ý mới trên yêu cầu đã đóng -> mở lại
        upd |= {"status": "new", "resumed": True}
        push.append(_entry(user, via, "status", "Đã trả lời — về hàng chờ" if doc["status"] == "needs_info"
                           else "Mở lại"))
    dev_requests.update_one({"_id": doc["_id"]}, {"$set": upd, "$push": {"log": {"$each": push, "$slice": -LOG_MAX}}})
    return out(_load(request_id), full=False)
