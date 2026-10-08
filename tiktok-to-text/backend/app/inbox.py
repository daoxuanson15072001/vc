"""Số việc của tôi — `GET /api/me/inbox/counts` (SCR-01 + huy hiệu menu SCR-00; docs/DESIGN.md Phần V mục 9.2).

Chỉ đếm, KHÔNG thêm luật: mỗi con số dùng lại đúng hàm / bộ lọc mà màn đích dùng, để hai nơi không lệch nhau.

| khoá | dùng lại của | màn đích |
| --- | --- | --- |
| `review` | `kb.changes.inbox` (API `GET /wiki/changes?inbox=1`) | `/wiki/review` |
| `learn_due`, `learn_next_due` | bộ lọc việc được giao chưa xong của `learn.paths.my_assignments` | `/learn` |
| `grading` | `learn.grading.grading_filter` + `_can_grade` (API `GET /learn/grading`) | `/learn/grading` |
| `content_fix` | `studio.quick_routes.list_quick` (`space_scope` + `mine`) + trạng thái `error` | `/studio/quick?status=error` |
| `sources_error` | `kb.routes.source_filter` (`GET /kb/sources?status=error&mine=1`) | `/kb?status=error&mine=1` |
| `returned_to_me` | `kb.changes.returned_to_me_filter` (GOV-13 — `GET /wiki/changes?mine=1&status=returned`) | `/wiki/review?tab=mine&status=returned` |
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from . import db
from .auth import current_user
from .kb import changes
from .kb.pipeline import sources
from .kb.routes import source_filter, space_scope
from .learn import grading
from .learn.models import assignments
from .studio import quick_pieces

router = APIRouter(prefix="/api/me", tags=["inbox"])

# Trạng thái bài Viết nhanh nghĩa là "cần sửa": AI viết lỗi (`status` = error) — màn Viết nhanh có nút *Viết lại*.
# Code chưa có khái niệm "bị trả về" (`review_status` chỉ draft / approved / rejected = Loại, không cần sửa).
CONTENT_FIX_STATUS = "error"


def _iso(t: datetime | None) -> str | None:
    if t is None:
        return None
    t = t if t.tzinfo else t.replace(tzinfo=timezone.utc)
    return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def learn_todo_filter(user: dict) -> dict:
    """Việc được giao cho người này mà chưa xong (`my_assignments`: trạng thái khác `completed`)."""
    return {"learner_id": user["_id"], "status": {"$ne": "completed"}}


def content_fix_filter(user: dict) -> dict:
    """Bài Viết nhanh của tôi cần sửa, trong các kho tôi xem được (cùng `space_scope` + `mine` của danh sách Viết nhanh)."""
    return space_scope(None, user, kind="quick") | {"created_by": user["_id"], "status": CONTENT_FIX_STATUS}


def sources_error_filter(user: dict) -> dict:
    """Nguồn do tôi nạp đang lỗi, trong các kho tôi xem được (cùng `source_filter` + `mine=1` của danh sách nguồn)."""
    return source_filter(None, None, None, None, "error", user) | {"created_by": user["_id"]}


@router.get("/inbox/counts")
def inbox_counts(user: dict = Depends(current_user)):
    grading.expire_due({"learner_id": user["_id"]})            # như /learn/me: quá hạn thì đổi trạng thái trước khi đếm
    todo = learn_todo_filter(user)
    nxt = assignments.find_one(todo | {"due_at": {"$ne": None}}, {"due_at": 1}, sort=[("due_at", 1)])
    return {"review": len(changes.inbox(user, changes.SCAN_CAP)),
            "learn_due": assignments.count_documents(todo),
            "learn_next_due": _iso(nxt["due_at"]) if nxt else None,
            "grading": grading.grading_todo_count(user),
            "content_fix": quick_pieces.count_documents(content_fix_filter(user)),
            "sources_error": sources.count_documents(sources_error_filter(user)),
            "returned_to_me": changes.change_requests.count_documents(changes.returned_to_me_filter(user)),
            "updated_at": _iso(db.now())}
