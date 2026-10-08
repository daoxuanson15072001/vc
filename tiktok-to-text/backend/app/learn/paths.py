"""Lộ trình học + giao bài + "Học tập của tôi" (luồng I — docs/BA.md mục 17.2–17.4, LRN-03, 05, 06).

Lộ trình (`learning_paths`) — năm (khung) hoặc tháng (kế thừa khung qua `parent_path_id`):
    draft ──(sửa: tuần → bài học, mục bắt buộc, ma trận đề)──► published (khoá nội dung) ──► giao (assignments)
Bản nháp do AI dựng (luồng H, `learn/designer.py`) cùng collection, cùng schema, có trường `ai` — màn hình này mở,
sửa, phát hành được như bản tạo tay.

Quyền (BA 15.6):
- Tạo / sửa lộ trình: `policy.can(user, "learn.author")`; chỉ người tạo (`owner_id`) sửa, chỉ khi còn nháp.
- Xem lộ trình: người tạo; người soạn (`learn.author`) xem thêm lộ trình đã phát hành của các cấp quản lý phía trên
  (để kế thừa khung / giao lại); người học xem lộ trình được giao cho mình. Trường `ai` (prompt, form, người học
  AI được nhắc tới) chỉ người tạo, cấp quản lý của người tạo và L&D thấy (QA vòng 2, L4).
- Kế thừa khung: bài học C0 / C1 đã phát hành trong khung năm của cấp trên mở cho người soạn cấp dưới dù không ở
  trong kho (`policy.frame_lesson_ids` — cấp trên phát hành khung = giao nội dung khung cho cấp dưới, BA 17.4);
  bài C2 / C3 vẫn theo kho (QA vòng 2, L3).
- Giao: chỉ cho người trong `policy.assignable_learners(user)` (cây dưới quyền, tuyến chức năng, phạm vi L&D) —
  giao theo người / đơn vị / chức năng đều lọc qua tập này. Người được giao xem được bài học C0 / C1 của lộ trình dù
  không ở trong kho (vấn đề mở 33 — đề xuất của luồng I); bài C2 / C3 thì người học phải xem được theo kho (BA 15.7
  quy tắc 4), không thì bỏ qua người đó kèm lý do.

Trường thêm ngoài BA mục 7 (ghi trong báo cáo cho người điều phối):
- `learning_paths`: description, exam.scope ("path" = câu hỏi gắn thẻ / câu luyện tập của bài trong lộ trình;
  "bank" = cả ngân hàng người tạo xem được), created_at, updated_at, published_at, published_by.
- `assignments`: lesson_ids (bài của lộ trình lúc giao), year, month, created_at, progress {opened [lesson_id],
  exam {attempt_id, final_score, max_score, passed}}.
"""

from __future__ import annotations

import calendar
import re
from datetime import datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import categories, db, org, policy
from ..auth import current_user, users
from . import routes as lr
from .models import DEFAULT_PASS_SCORE, assignments, attempts, courses as course_docs, learning_paths, lessons, pass_score_of, questions

router = APIRouter(prefix="/api/learn")

SOON_DAYS = 3          # nhắc trước hạn 3 ngày (LRN-05) — hiển thị "sắp hạn"
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")     # hạn "hết ngày" tính theo giờ Việt Nam


# ---------------------------------------------------------------------------
# Schema vào
# ---------------------------------------------------------------------------

class ModuleIn(BaseModel):
    week: int = Field(ge=1, le=53)
    title: str = Field("", max_length=200)
    lesson_ids: list[str] = Field(default_factory=list, max_length=20)
    due_at: datetime | None = None


class CourseIn(BaseModel):
    category: str = Field(min_length=1, max_length=200)
    days: int = Field(ge=1, le=365)
    required: bool = True
    lesson_ids: list[str] | None = Field(None, max_length=500)


class BlueprintRow(BaseModel):
    category: str | None = Field(None, max_length=200)     # slug lĩnh vực (gồm nhánh con); trống = mọi lĩnh vực
    difficulty: int | None = Field(None, ge=1, le=5)
    kind: Literal["single", "multi", "essay"] | None = None
    count: int = Field(ge=1, le=100)


class ExamIn(BaseModel):
    blueprint: list[BlueprintRow] = Field(min_length=1, max_length=20)
    duration_min: int = Field(30, ge=1, le=600)
    pass_score: float = Field(DEFAULT_PASS_SCORE, ge=0, le=100)   # % tổng điểm (BA 17.7)
    attempts: int = Field(1, ge=1, le=5)
    scope: Literal["path", "bank"] = "path"


class PathIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field("", max_length=5000)
    kind: Literal["weeks", "courses"] = "weeks"
    period: Literal["year", "month"] = "month"
    year: int = Field(default_factory=lambda: db.now().year, ge=2020, le=2100)
    month: int | None = Field(None, ge=1, le=12)
    parent_path_id: str | None = None
    modules: list[ModuleIn] = Field(default_factory=list, max_length=60)
    courses: list[CourseIn] = Field(default_factory=list, max_length=30)
    required_items: list[str] = Field(default_factory=list, max_length=100)
    exam: ExamIn | None = None


class PathPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=5000)
    period: Literal["year", "month"] | None = None
    year: int | None = Field(None, ge=2020, le=2100)
    month: int | None = Field(None, ge=1, le=12)
    parent_path_id: str | None = None
    modules: list[ModuleIn] | None = Field(None, max_length=60)
    kind: Literal["weeks", "courses"] | None = None
    courses: list[CourseIn] | None = Field(None, max_length=30)
    required_items: list[str] | None = Field(None, max_length=100)
    exam: ExamIn | None = None


class AssignIn(BaseModel):
    learner_ids: list[str] = Field(default_factory=list, max_length=500)
    unit_ids: list[str] = Field(default_factory=list, max_length=50)
    functions: list[str] = Field(default_factory=list, max_length=50)
    due_at: datetime | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def aware(t: datetime | None) -> datetime | None:
    if t is None:
        return None
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def exam_rows(exam: dict | None) -> list[dict]:
    """Các dòng ma trận đề (BA mục 7: blueprint [{category, difficulty, kind, count}]). Mô tả chữ của AI nằm ở
    `blueprint_note`; dữ liệu cũ còn `blueprint` dạng chữ thì coi như chưa có ma trận (điền trước khi phát hành)."""
    bp = (exam or {}).get("blueprint")
    return [r for r in bp if isinstance(r, dict) and r.get("count")] if isinstance(bp, list) else []


def exam_view(exam: dict | None) -> dict | None:
    if not exam:
        return None
    bp = exam.get("blueprint")
    return {"blueprint": exam_rows(exam), "blueprint_note": exam.get("blueprint_note") or (bp if isinstance(bp, str) else ""),
            "duration_min": exam.get("duration_min") or 30, "pass_score": pass_score_of(exam),
            "attempts": exam.get("attempts") or 1, "scope": exam.get("scope") or "path"}


def path_lesson_ids(path: dict) -> list[ObjectId]:
    if path.get("kind") == "courses":
        out: list[ObjectId] = []
        for course in path.get("courses") or []:
            ids = course.get("lesson_ids")
            if ids is None:
                ids = [r["_id"] for r in lessons.find({"category": course["category"]}, {"_id": 1})
                       .sort([("seq", 1), ("_id", 1)])]
            out.extend(i for i in ids if i not in out)
        return out
    out: list[ObjectId] = []
    for m in path.get("modules") or []:
        for lid in m.get("lesson_ids") or []:
            if lid not in out:
                out.append(lid)
    return out


def path_scope(user: dict) -> dict:
    """Lộ trình người này xem được: của mình; lộ trình được giao cho mình; người soạn xem thêm lộ trình đã phát hành
    của các cấp quản lý phía trên (khung để kế thừa / giao lại). Nhân viên không thấy lộ trình không giao cho mình."""
    ors: list[dict] = [{"owner_id": user["_id"]}]
    mine = assignments.distinct("path_id", {"learner_id": user["_id"]})
    if mine:
        ors.append({"_id": {"$in": mine}, "status": {"$in": ["published", "closed"]}})
    if policy.can(user, "learn.author"):
        ors.append({"status": {"$in": ["published", "closed"]}, "owner_id": {"$in": org.manager_chain(user["_id"])}})
    return {"$or": ors}


def sees_design(user: dict, p: dict) -> bool:
    """Ai xem được phần thiết kế AI (`ai`: prompt, form, người học): người tạo, cấp quản lý của người tạo, L&D."""
    if p.get("owner_id") == user["_id"]:
        return True
    if p.get("owner_id") and user["_id"] in org.manager_chain(p["owner_id"]):
        return True
    return bool(org.active_grants(user, "lnd"))


def load_path(path_id: str, user: dict) -> dict:
    p = learning_paths.find_one({"_id": lr.oid(path_id, "lộ trình")} | path_scope(user))
    if not p:
        raise HTTPException(404, "Không tìm thấy lộ trình")
    return p


def default_due(path: dict) -> datetime:
    """Hạn mặc định: hạn tuần cuối nếu có, không thì cuối tháng (lộ trình tháng) / cuối năm."""
    dues = [aware(m["due_at"]) for m in path.get("modules") or [] if m.get("due_at")]
    if dues:
        return max(dues)
    y, m = path["year"], path.get("month") or 12
    # 23:59 giờ VN (16:59 UTC) — không phải 23:59 UTC = 6:59 sáng hôm sau giờ VN (QA vòng 2, L6)
    return datetime(y, m, calendar.monthrange(y, m)[1], 23, 59, tzinfo=VN_TZ).astimezone(timezone.utc)


def due_state(due_at: datetime | None, status: str) -> str:
    if status == "completed":
        return "done"
    if not due_at:
        return "ok"
    left = aware(due_at) - db.now()
    return "overdue" if left.total_seconds() < 0 else "soon" if left <= timedelta(days=SOON_DAYS) else "ok"


def check_structure(user: dict, doc: dict) -> None:
    """Luật nội dung lộ trình: kỳ hợp lệ, bài học tồn tại + mình xem được, mục bắt buộc nằm trong lộ trình,
    kế thừa khung không bỏ mục bắt buộc của khung (BA 17.4). Sai -> 400."""
    if doc.get("kind", "weeks") == "courses":
        rows = doc.get("courses") or []
        if not 1 <= len(rows) <= 30:
            raise HTTPException(400, "Lộ trình chuỗi khoá cần từ 1 đến 30 khoá")
        slugs = [lr_course["category"] for lr_course in rows]
        if len(set(slugs)) != len(slugs):
            raise HTTPException(400, "Một khoá chỉ được xuất hiện một lần trong lộ trình")
        if doc.get("parent_path_id"):
            raise HTTPException(400, "Lộ trình chuỗi khoá không kế thừa khung")
        if doc.get("exam"):
            raise HTTPException(400, "Thi được đặt riêng cho từng khoá, không đặt ở lộ trình")
        from . import courses as cs
        normalized = []
        for item in rows:
            slug = cs.check_course(item.get("category"))
            if slug is None:
                raise HTTPException(400, "Khoá trong lộ trình phải thuộc một nhánh đang hoạt động")
            row = item | {"category": slug}
            if item.get("lesson_ids") is not None:
                ids = item["lesson_ids"]
                if len(ids) != len(set(ids)):
                    raise HTTPException(400, f"Danh sách bài của khoá {slug} không được có bài trùng")
                found = list(lessons.find({"_id": {"$in": ids}, "category": slug} | lr.lesson_scope(user), {"_id": 1}))
                if len(found) != len(set(ids)):
                    raise HTTPException(400, f"Danh sách bài của khoá {slug} chỉ được gồm bài xem được thuộc khoá đó")
            normalized.append(row)
        doc["courses"] = normalized
        doc["modules"] = []
        doc["required_items"] = []
        return
    if doc["period"] == "month" and not doc.get("month"):
        raise HTTPException(400, "Lộ trình tháng cần chọn tháng")
    if doc["period"] == "year":
        doc["month"] = None
    ids = path_lesson_ids(doc)
    parent = None
    if doc.get("parent_path_id"):
        parent = learning_paths.find_one({"_id": doc["parent_path_id"]} | path_scope(user))
        if not parent or parent["status"] == "draft" or parent["period"] != "year":
            raise HTTPException(400, "Khung kế thừa phải là lộ trình năm đã phát hành")
        if doc["period"] != "month" or doc["year"] != parent["year"]:
            raise HTTPException(400, "Chỉ lộ trình tháng cùng năm mới kế thừa được khung năm")
    if ids:
        found = {x["_id"] for x in lessons.find({"_id": {"$in": ids}} | lr.lesson_scope(user), {"_id": 1})}
        if bad := [i for i in ids if i not in found]:
            # bài của khung (người kế thừa biết tên): nói rõ bài nào + cách xử lý; bài khác chỉ báo số lượng
            frame = set(path_lesson_ids(parent) + list(parent.get("required_items") or [])) if parent else set()
            named = [x["title"] for x in lessons.find({"_id": {"$in": [i for i in bad if i in frame]}}, {"title": 1})]
            if named:
                raise HTTPException(400, "Bài học của khung ở mức mật C2 / C3, trong kho bạn không xem được: "
                                         + ", ".join(f"“{t}”" for t in named) + " — nhờ người tạo khung thêm bạn vào "
                                         "kho của bài (hoặc hạ mức mật), rồi tạo lại")
            raise HTTPException(400, f"Có {len(bad)} bài học không tồn tại hoặc bạn không xem được")
    if parent:
        lost = [i for i in parent.get("required_items") or [] if i not in ids]
        if lost:
            names = [x["title"] for x in lessons.find({"_id": {"$in": lost}}, {"title": 1})]
            raise HTTPException(400, "Không được bỏ mục bắt buộc của khung: " + ", ".join(names))
    missing = [i for i in doc.get("required_items") or [] if i not in ids]
    if missing:
        names = [x["title"] for x in lessons.find({"_id": {"$in": missing}}, {"title": 1})]
        raise HTTPException(400, "Mục bắt buộc phải nằm trong lộ trình — bỏ đánh dấu bắt buộc hoặc thêm lại bài: "
                                 + (", ".join(names) or f"{len(missing)} bài không còn"))


def build_doc(user: dict, body: dict) -> dict:
    """Chuẩn hoá dữ liệu người dùng gửi (id chuỗi -> ObjectId)."""
    out = dict(body)
    if "title" in out:
        out["title"] = out["title"].strip()
    if "modules" in out:
        mods = []
        for m in sorted(out["modules"], key=lambda m: m["week"]):
            mods.append({"week": m["week"], "title": (m.get("title") or "").strip(),
                         "lesson_ids": lr.oids(m.get("lesson_ids") or [], "bài học"), "due_at": m.get("due_at")})
        out["modules"] = mods
    if "courses" in out and out["courses"] is not None:
        out["courses"] = [{**c, "lesson_ids": (lr.oids(c["lesson_ids"], "bài học")
                                                   if c.get("lesson_ids") is not None else None)}
                          for c in out["courses"]]
    if "required_items" in out:
        out["required_items"] = lr.oids(out["required_items"] or [], "bài học")
    if "parent_path_id" in out:
        out["parent_path_id"] = lr.oid(out["parent_path_id"], "khung") if out["parent_path_id"] else None
    return out


def lesson_briefs(ids) -> dict:
    rows = lessons.find({"_id": {"$in": list(ids)}}, {"title": 1, "status": 1, "practice_question_ids": 1,
                                                      "created_by": 1})
    return {r["_id"]: r for r in rows}


def path_out(p: dict, user: dict, full: bool = False) -> dict:
    people = lr.names_of([p.get("owner_id")])
    ids = path_lesson_ids(p)
    o = {"id": str(p["_id"]), "title": p["title"], "description": p.get("description") or "",
         "kind": p.get("kind", "weeks"),
         "period": p["period"], "year": p["year"], "month": p.get("month"), "status": p["status"],
         "owner_id": lr.plain(p.get("owner_id")), "owner_name": people.get(p.get("owner_id")),
         "parent_path_id": lr.plain(p.get("parent_path_id")), "lesson_count": len(ids),
         "has_exam": bool(p.get("exam")), "from_ai": bool(p.get("ai")), "created_at": p.get("created_at"),
         "updated_at": p.get("updated_at"), "published_at": p.get("published_at"),
         "can_edit": p["status"] == "draft" and p.get("owner_id") == user["_id"],
         "can_copy": p.get("status") in {"published", "closed"} and policy.can(user, "learn.author"),
         "assigned_count": assignments.count_documents({"path_id": p["_id"]})}
    if not full:
        return o
    if p.get("kind") == "courses":
        citems = []
        for course in p.get("courses") or []:
            lesson_ids = course.get("lesson_ids")
            citems.append({"category": course["category"], "days": course["days"],
                           "required": course.get("required", True),
                           "lesson_ids": [str(i) for i in lesson_ids] if lesson_ids is not None else None})
        o |= {"courses": citems, "modules": [], "required_items": [], "parent": None,
              "exam": None, "ai": lr.plain(p.get("ai")) if sees_design(user, p) else None}
        if p.get("status") != "draft" and policy.can(user, "learn.author"):
            o["assignments"] = assignments_of_path(p, user)
            o["assignable"] = assignable_out(user)
        return o
    briefs = lesson_briefs(ids + list(p.get("required_items") or []))
    parent = learning_paths.find_one({"_id": p["parent_path_id"]}) if p.get("parent_path_id") else None
    lesson = lambda i: {"id": str(i), "title": (briefs.get(i) or {}).get("title", "(bài học không còn)"),  # noqa: E731
                        "status": (briefs.get(i) or {}).get("status")}
    o |= {"modules": [{"week": m["week"], "title": m.get("title") or "", "due_at": m.get("due_at"),
                       "lessons": [lesson(i) for i in m.get("lesson_ids") or []]} for m in p.get("modules") or []],
          "required_items": [str(i) for i in p.get("required_items") or []],
          "parent": parent and {"id": str(parent["_id"]), "title": parent["title"],
                                "required_items": [lesson(i) for i in parent.get("required_items") or []]},
          "exam": exam_view(p.get("exam")),
          "ai": lr.plain(p.get("ai")) if sees_design(user, p) else None}
    if p.get("status") != "draft" and policy.can(user, "learn.author"):
        o["assignments"] = assignments_of_path(p, user)
        o["assignable"] = assignable_out(user)
    return o


def assignable_out(user: dict) -> dict:
    """Người + đơn vị + chức năng mình giao được (để chọn trên màn hình)."""
    ids = policy.assignable_learners(user)
    rows = list(users.find({"_id": {"$in": ids}, "active": True}, {"name": 1, "email": 1, "org": 1}).sort("name", 1))
    unit_ids = {u for r in rows for u in org.user_org(r)["unit_ids"]}
    units = {u["_id"]: u for u in org.org_units.find({"_id": {"$in": list(unit_ids)}}, {"name": 1, "code": 1})}
    funcs = {r_["code"]: r_["name"] for r_ in org.org_functions.find({}, {"code": 1, "name": 1})}
    return {"people": [{"id": str(r["_id"]), "name": r["name"], "email": r.get("email"),
                        "units": [units[u]["name"] for u in org.user_org(r)["unit_ids"] if u in units],
                        "function": org.user_org(r)["function"]} for r in rows],
            "units": [{"id": str(u["_id"]), "name": u["name"], "code": u.get("code")} for u in units.values()],
            "functions": [{"code": c, "name": funcs.get(c, c)}
                          for c in sorted({org.user_org(r)["function"] for r in rows} - {None})]}


def assignments_of_path(p: dict, user: dict) -> list[dict]:
    rows = list(assignments.find({"path_id": p["_id"]}).sort("created_at", 1))
    rows = [r for r in rows if policy.can(user, "learn.view_result", {"learner_id": r["learner_id"],
                                                                      "assigned_by": r["assigned_by"]})]
    names = lr.names_of([r["learner_id"] for r in rows] + [r["assigned_by"] for r in rows])
    return [{"id": str(r["_id"]), "learner_id": str(r["learner_id"]), "learner_name": names.get(r["learner_id"]),
             "assigned_by_name": names.get(r["assigned_by"]), "due_at": r.get("due_at"), "status": r["status"],
             "due_state": due_state(r.get("due_at"), r["status"]),
             "exam": lr.plain((r.get("progress") or {}).get("exam"))} for r in rows]


# ---------------------------------------------------------------------------
# Lộ trình (LRN-03)
# ---------------------------------------------------------------------------

@router.get("/paths")
def list_paths(status: str | None = None, period: str | None = None, year: int | None = None, mine: bool = False,
               q: str | None = None, user: dict = Depends(current_user)):
    f = path_scope(user)
    if status:
        f["status"] = {"$in": status.split(",")}
    if period:
        f["period"] = period
    if year:
        f["year"] = year
    if mine:
        f["owner_id"] = user["_id"]
    if q and q.strip():
        f["title"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    rows = list(learning_paths.find(f).sort([("year", -1), ("month", -1), ("updated_at", -1)]).limit(200))
    return {"items": [path_out(r, user) for r in rows], "can_author": policy.can(user, "learn.author")}


@router.post("/paths", status_code=201)
def create_path(body: PathIn, user: dict = Depends(current_user)):
    lr.require_author(user)
    doc = build_doc(user, body.model_dump())
    if doc.get("kind") == "weeks":
        doc.pop("courses", None)
    if doc.get("exam"):
        doc["exam"] = body.exam.model_dump()
    parent = learning_paths.find_one({"_id": doc["parent_path_id"]} | path_scope(user)) \
        if doc.get("parent_path_id") else None
    if parent and parent.get("required_items"):
        if not doc["modules"]:
            # kế thừa khung: bắt đầu bằng các mục bắt buộc của khung ở tuần 1
            doc["modules"] = [{"week": 1, "title": "Mục bắt buộc của khung",
                               "lesson_ids": list(parent["required_items"]), "due_at": None}]
        # mục bắt buộc của khung là mục bắt buộc của lộ trình tháng (QA vòng 2, L11)
        doc["required_items"] = list(dict.fromkeys([*parent["required_items"], *doc.get("required_items", [])]))
    check_structure(user, doc)
    now = db.now()
    doc |= {"owner_id": user["_id"], "owner_unit_id": lr.owner_unit(user), "status": "draft", "ai": None,
            "created_at": now, "updated_at": now}
    doc["_id"] = learning_paths.insert_one(doc).inserted_id
    return path_out(doc, user, full=True)


@router.get("/paths/{path_id}")
def get_path(path_id: str, user: dict = Depends(current_user)):
    return path_out(load_path(path_id, user), user, full=True)


def editable_path(path_id: str, user: dict) -> dict:
    p = load_path(path_id, user)
    if p["status"] != "draft":
        raise HTTPException(409, "Lộ trình đã phát hành — nội dung bị khoá")
    if p.get("owner_id") != user["_id"]:
        raise HTTPException(403, "Chỉ người tạo lộ trình được sửa")
    return p


@router.patch("/paths/{path_id}")
def patch_path(path_id: str, body: PathPatch, user: dict = Depends(current_user)):
    p = editable_path(path_id, user)
    changes = body.model_dump(exclude_unset=True)
    if "exam" in changes and body.exam is not None:
        # màn Lộ trình không sửa mô tả đề của AI — giữ `blueprint_note` (QA vòng 2, L8)
        changes["exam"] = body.exam.model_dump() | {
            "blueprint_note": ((p.get("exam") or {}).get("blueprint_note") or "")}
    for k in ("title", "period", "year"):
        if k in changes and changes[k] is None:
            changes.pop(k)
    upd = build_doc(user, changes)
    merged = p | upd
    if "kind" in upd and upd["kind"] != p.get("kind", "weeks"):
        raise HTTPException(400, "Không thể đổi loại lộ trình sau khi tạo")
    if merged.get("kind") == "weeks":
        merged.pop("courses", None)
    check_structure(user, merged)
    if merged["period"] == "year":
        upd["month"] = None
    upd["updated_at"] = db.now()
    if p.get("ai"):
        # bản nháp AI đã sửa ở màn Lộ trình: màn thiết kế (luồng H) không đè phần này nữa (QA vòng 2, L2)
        upd["ai.edited_in_paths_at"] = upd["updated_at"]
    new = learning_paths.find_one_and_update({"_id": p["_id"], "status": "draft"}, {"$set": upd},
                                             return_document=True)
    if not new:
        raise HTTPException(409, "Lộ trình đã phát hành — nội dung bị khoá")
    return path_out(new, user, full=True)


@router.post("/paths/{path_id}/publish")
def publish_path(path_id: str, user: dict = Depends(current_user)):
    """Phát hành = khoá nội dung. Bài học nháp của chính người tạo trong lộ trình (vd do AI dựng) được phát hành
    cùng; bài nháp của người khác không có ở đây (không xem được). Ma trận đề phải rút đủ câu."""
    p = editable_path(path_id, user)
    check_structure(user, p)
    if p.get("kind") == "courses":
        omitted = []
        for course in p.get("courses") or []:
            ids = course.get("lesson_ids")
            f = {"category": course["category"]}
            if ids is not None:
                f["_id"] = {"$in": ids}
            published = list(lessons.find(f | {"status": "published"}, {"_id": 1}))
            if not published:
                raise HTTPException(400, f"Khoá {course['category']} cần ít nhất một bài đã phát hành")
            drafts = lessons.find(f | {"status": "draft"}, {"title": 1})
            omitted.extend(r["title"] for r in drafts)
        new = learning_paths.find_one_and_update(
            {"_id": p["_id"], "status": "draft"},
            {"$set": {"courses": p["courses"], "status": "published", "published_at": db.now(),
                      "published_by": user["_id"], "updated_at": db.now()}}, return_document=True)
        if not new:
            raise HTTPException(409, "Lộ trình đã phát hành")
        return path_out(new, user, full=True) | {"omitted_drafts": omitted}
    ids = path_lesson_ids(p)
    if not ids:
        raise HTTPException(400, "Lộ trình cần ít nhất một bài học trước khi phát hành")
    briefs = lesson_briefs(ids)
    for lid in ids:
        lesson = lessons.find_one({"_id": lid})
        if lesson["status"] == "draft":
            if not lesson.get("items"):
                raise HTTPException(400, f"Bài học '{lesson['title']}' chưa có thẻ — chưa phát hành được")
            lr.pin_cards(user, [i["card_id"] for i in lesson["items"]], {i["card_id"]: i["rev"] for i in lesson["items"]})
    if p.get("exam"):
        if not exam_rows(p["exam"]):
            raise HTTPException(400, "Bài thi cần ma trận đề (lĩnh vực × độ khó × loại câu × số câu) trước khi phát hành")
        from . import grading
        grading.check_blueprint(p, user)
    for lid, b in briefs.items():
        if b["status"] == "draft":
            lessons.update_one({"_id": lid, "status": "draft"}, {"$set": {
                "status": "published", "published_at": db.now(), "published_by": user["_id"], "updated_at": db.now()}})
    new = learning_paths.find_one_and_update(
        {"_id": p["_id"], "status": "draft"},
        {"$set": {"status": "published", "published_at": db.now(), "published_by": user["_id"],
                  "updated_at": db.now()}}, return_document=True)
    if not new:
        raise HTTPException(409, "Lộ trình đã phát hành")
    return path_out(new, user, full=True)


@router.post("/paths/{path_id}/copy", status_code=201)
def copy_path(path_id: str, user: dict = Depends(current_user)):
    """Sao chép lộ trình xem được thành bản nháp độc lập của người gọi (BA 17.12 luật 6d)."""
    lr.require_author(user)
    source = load_path(path_id, user)
    doc = {k: v for k, v in source.items() if k not in {"_id", "owner_id", "owner_unit_id", "status", "ai",
                                                          "created_at", "updated_at", "published_at",
                                                          "published_by"}}
    doc["title"] = f"Bản sao: {source['title']}"
    doc["parent_path_id"] = None
    doc["owner_id"] = user["_id"]
    doc["owner_unit_id"] = lr.owner_unit(user)
    doc["status"] = "draft"
    doc["ai"] = None
    doc["created_at"] = doc["updated_at"] = db.now()
    check_structure(user, doc)
    doc["_id"] = learning_paths.insert_one(doc).inserted_id
    return path_out(doc, user, full=True)


# ---------------------------------------------------------------------------
# Giao bài (LRN-05)
# ---------------------------------------------------------------------------

@router.post("/paths/{path_id}/assign")
def assign_path(path_id: str, body: AssignIn, user: dict = Depends(current_user)):
    p = load_path(path_id, user)
    if p["status"] != "published":
        raise HTTPException(409, "Chỉ giao được lộ trình đã phát hành")
    allowed = set(policy.assignable_learners(user))
    wanted: list[ObjectId] = []
    for lid in lr.oids(body.learner_ids, "người học"):
        if lid not in allowed:
            raise HTTPException(403, "Chỉ giao được cho người trong cây dưới quyền của bạn")
        wanted.append(lid)
    if body.unit_ids:
        scope = [u for uid in lr.oids(body.unit_ids, "đơn vị") for u in org.unit_and_descendants(uid)]
        wanted += [u["_id"] for u in users.find({"org.unit_ids": {"$in": scope}, "active": True}, {"_id": 1})
                   if u["_id"] in allowed]
    if body.functions:
        wanted += [u["_id"] for u in users.find({"org.function": {"$in": body.functions}, "active": True}, {"_id": 1})
                   if u["_id"] in allowed]
    wanted = list(dict.fromkeys(wanted))
    if not wanted:
        raise HTTPException(400, "Không có ai trong cây dưới quyền của bạn khớp lựa chọn")
    due = aware(body.due_at) or default_due(p)
    created = db.now()
    ids = path_lesson_ids(p)
    names = lr.names_of(wanted)
    done, skipped = [], []
    for lid in wanted:
        learner = users.find_one({"_id": lid})
        if p.get("kind") == "courses":
            plan, total_days = [], 0
            unavailable = 0
            progress_courses = {}
            for item in p.get("courses") or []:
                total_days += int(item.get("days", 1))
                item_ids = item.get("lesson_ids")
                if item_ids is None:
                    item_ids = [r["_id"] for r in lessons.find({"category": item["category"],
                                                               "status": "published"}, {"_id": 1})
                                .sort([("seq", 1), ("_id", 1)])]
                else:
                    item_ids = [r["_id"] for r in lessons.find({"_id": {"$in": item_ids},
                                                               "category": item["category"],
                                                               "status": "published"}, {"_id": 1})]
                    by_id = {r["_id"]: r for r in lessons.find({"_id": {"$in": item_ids}}, {"_id": 1})}
                    item_ids = [i for i in (item.get("lesson_ids") or []) if i in by_id]
                visible = list(lessons.find({"_id": {"$in": item_ids},
                                             "$or": [lr.lesson_scope(learner), policy.VIA_ASSIGNMENT]},
                                            {"_id": 1}))
                if len(visible) != len(item_ids):
                    unavailable += len(item_ids) - len(visible)
                    continue
                plan.append({"category": item["category"], "lesson_ids": item_ids,
                             "due_at": created + timedelta(days=total_days),
                             "required": item.get("required", True)})
                prior = next((old for old in assignments.find({"learner_id": lid, "_id": {"$ne": p["_id"]}},
                                                              {"progress.courses": 1})
                              if (old.get("progress") or {}).get("courses", {}).get(item["category"], {}).get("done_at")),
                             None)
                if prior:
                    progress_courses[item["category"]] = {"lessons_done": item_ids, "done_at": created,
                                                            "completed_elsewhere": True}
            if unavailable:
                skipped.append({"learner_id": str(lid), "name": names.get(lid),
                                "reason": f"không xem được {unavailable} bài học đã phát hành mức mật C2 / C3"})
                continue
            if not any(plan):
                skipped.append({"learner_id": str(lid), "name": names.get(lid),
                                "reason": "lộ trình không có bài đã phát hành người học xem được"})
                continue
            assignment_due = plan[-1]["due_at"]
            doc = {"path_id": p["_id"], "learner_id": lid, "assigned_by": user["_id"],
                   "due_at": aware(body.due_at) or assignment_due, "status": "assigned",
                   "progress": {"opened": [], "exam": None, "courses": progress_courses},
                   "lesson_ids": [i for c in plan for i in c["lesson_ids"]], "plan": plan,
                   "year": p["year"], "month": p.get("month"), "created_at": created}
            res = assignments.update_one({"path_id": p["_id"], "learner_id": lid}, {"$setOnInsert": doc}, upsert=True)
            if res.upserted_id:
                done.append({"learner_id": str(lid), "name": names.get(lid)})
            else:
                skipped.append({"learner_id": str(lid), "name": names.get(lid), "reason": "đã được giao lộ trình này"})
            continue
        # bài C0 / C1 mở cho người được giao dù không ở trong kho (vấn đề mở 33); bài C2 / C3 phải xem được theo kho
        seen = lessons.count_documents({"_id": {"$in": ids}, "$or": [lr.lesson_scope(learner), policy.VIA_ASSIGNMENT]})
        if seen != len(ids):
            skipped.append({"learner_id": str(lid), "name": names.get(lid),
                            "reason": f"không xem được {len(ids) - seen} bài học mức mật C2 / C3 (chưa vào kho của bài)"})
            continue
        doc = {"path_id": p["_id"], "learner_id": lid, "assigned_by": user["_id"], "due_at": due,
               "status": "assigned", "progress": {"opened": [], "exam": None}, "lesson_ids": ids,
               "year": p["year"], "month": p.get("month"), "created_at": db.now()}
        res = assignments.update_one({"path_id": p["_id"], "learner_id": lid}, {"$setOnInsert": doc}, upsert=True)
        if res.upserted_id:
            done.append({"learner_id": str(lid), "name": names.get(lid)})
        else:
            skipped.append({"learner_id": str(lid), "name": names.get(lid), "reason": "đã được giao lộ trình này"})
    return {"assigned": done, "skipped": skipped, "due_at": due}


@router.post("/courses/{slug}/exam/start", status_code=201)
def start_course_exam(slug: str, assignment_id: str, user: dict = Depends(current_user)):
    """Thi khoá trong lộ trình được giao; người chấm tự luận là người giao (TK-15c)."""
    node = categories.categories.find_one({"slug": categories.resolve_slug(slug)})
    if not node:
        raise HTTPException(404, "Không tìm thấy khoá học")
    aid = lr.oid(assignment_id, "việc được giao")
    asg = assignments.find_one({"_id": aid, "learner_id": user["_id"]})
    if not asg:
        raise HTTPException(404, "Không tìm thấy việc được giao")
    path = learning_paths.find_one({"_id": asg["path_id"]}) or {}
    if path.get("kind") != "courses":
        raise HTTPException(400, "Thi khoá chỉ dùng trong lộ trình dạng chuỗi khoá")
    plan = asg.get("plan") or []
    at = next((i for i, c in enumerate(plan) if c["category"] == node["slug"]), None)
    if at is None:
        raise HTTPException(400, "Khoá này không thuộc lộ trình được giao")
    asg = recompute_courses(asg)
    state = (asg.get("progress") or {}).get("courses") or {}
    if at and not (state.get(plan[at - 1]["category"]) or {}).get("done_at"):
        raise HTTPException(409, f"Cần hoàn thành khoá {plan[at - 1]['category']} trước")
    course_plan = plan[at]
    if not all(_course_lesson_done(asg, i) for i in course_plan.get("lesson_ids") or []):
        raise HTTPException(409, "Cần đạt kiểm tra của mọi bài trong khoá trước khi thi")
    from . import grading, attempts as att
    config = (course_docs.find_one({"category": node["slug"]}) or {}).get("exam")
    if not config:
        raise HTTPException(400, "Khoá này chưa đặt thi cuối khoá")
    existing = attempts.find_one({"assignment_id": aid, "course": node["slug"], "kind": "exam",
                                  "submitted_at": None}, sort=[("started_at", -1)])
    if existing:
        return grading.exam_out(existing, user)
    limit = int(config.get("attempts") or 1)
    if attempts.count_documents({"assignment_id": aid, "course": node["slug"], "kind": "exam"}) >= limit:
        raise HTTPException(409, "Bạn đã dùng hết lượt thi khoá này")
    exam = exam_view(config)
    pseudo = {"exam": config, "modules": [{"week": 1, "lesson_ids": course_plan.get("lesson_ids") or []}]}
    pool = grading._pool(pseudo, None, user)
    try:
        paper = att.build_paper(grading.draw(pool, exam["blueprint"]))
    except HTTPException as e:
        raise HTTPException(400, e.detail) from None
    now = db.now()
    attempt = att.new_attempt(user["_id"], "exam", paper, assignment_id=aid, path_id=path["_id"],
                              started_at=now, deadline_at=now + timedelta(minutes=exam["duration_min"]),
                              duration_min=exam["duration_min"], pass_score=exam["pass_score"],
                              auto_submitted=False, ai_status=None, ai_error=None, ai_feedback=None)
    attempts.update_one({"_id": attempt["_id"]}, {"$set": {"course": node["slug"]}})
    assignments.update_one({"_id": aid, "status": "assigned"}, {"$set": {"status": "in_progress"}})
    return grading.exam_out(attempts.find_one({"_id": attempt["_id"]}), user)


# ---------------------------------------------------------------------------
# Danh mục tự ghi danh — khoá mở (`open_enroll`), gồm khoá mẫu (`is_sample`, learn/sample.py)
# ---------------------------------------------------------------------------

def path_weeks(p: dict) -> int:
    if p.get("kind") == "courses":
        return len(p.get("courses") or [])
    return len({m["week"] for m in p.get("modules") or []})


def enroll_learner(p: dict, learner: dict, due: datetime | None = None) -> dict:
    """Ghi danh `learner` vào lộ trình mở. Người giao (`assigned_by`) = người tạo lộ trình: người đó chấm bài, người
    học không tự chấm mình. Idempotent: đã có thì trả bản ghi cũ. Bài C2 / C3 người học không xem được → 403."""
    ids = path_lesson_ids(p)
    seen = lessons.count_documents({"_id": {"$in": ids}, "$or": [lr.lesson_scope(learner), policy.VIA_ASSIGNMENT]})
    if seen != len(ids):
        raise HTTPException(403, "Khoá này có bài học mức mật bạn không xem được — nhờ L&D giao trực tiếp")
    due = due or datetime.now(VN_TZ).replace(hour=23, minute=59, second=0, microsecond=0).astimezone(timezone.utc) \
        + timedelta(days=p.get("enroll_days") or 7 * max(1, path_weeks(p)))
    doc = {"path_id": p["_id"], "learner_id": learner["_id"], "assigned_by": p["owner_id"], "self_enrolled": True,
           "due_at": due, "status": "assigned", "progress": {"opened": [], "exam": None}, "lesson_ids": ids,
           "year": p["year"], "month": p.get("month"), "created_at": db.now()}
    res = assignments.update_one({"path_id": p["_id"], "learner_id": learner["_id"]}, {"$setOnInsert": doc},
                                 upsert=True)
    a = assignments.find_one({"path_id": p["_id"], "learner_id": learner["_id"]})
    return {"created": bool(res.upserted_id), "assignment": a}


@router.get("/catalog")
def catalog(user: dict = Depends(current_user)):
    """Khoá mở cho mọi người tự ghi danh (đã phát hành, `open_enroll`). Người soạn thấy thêm trạng thái khoá mẫu khi
    khoá mẫu chưa sẵn sàng ("chờ duyệt N thẻ, M câu" + link tới hộp duyệt)."""
    rows = list(learning_paths.find({"status": "published", "open_enroll": True}).sort("published_at", -1).limit(50))
    mine = {a["path_id"]: a for a in assignments.find({"learner_id": user["_id"], "path_id": {"$in": [r["_id"] for r in rows]}},
                                                     {"path_id": 1, "status": 1})}
    items = []
    for p in rows:
        ex = exam_view(p.get("exam"))
        a = mine.get(p["_id"])
        items.append({"id": str(p["_id"]), "title": p["title"], "description": p.get("description") or "",
                      "is_sample": bool(p.get("is_sample")), "weeks": path_weeks(p),
                      "lesson_count": len(path_lesson_ids(p)), "hours_per_week": p.get("hours_per_week"),
                      "enroll_days": p.get("enroll_days"),
                      "exam": ex and {"question_count": sum(r["count"] for r in ex["blueprint"]),
                                      "duration_min": ex["duration_min"], "pass_score": ex["pass_score"]},
                      "enrolled": bool(a), "assignment_id": str(a["_id"]) if a else None})
    out = {"items": items, "samples": []}
    if policy.can(user, "learn.author"):
        from . import sample
        try:
            # khoá mẫu mà DB này không có thẻ nào (DB test, DB khác) thì không hiện
            out["samples"] = [st for st in (sample.status(c) for c in sample.all_courses())
                              if st["stage"] != "ready" and st["cards_missing"] < st["cards_total"]]
        except (OSError, KeyError):
            pass
    return out


@router.post("/paths/{path_id}/enroll", status_code=201)
def enroll(path_id: str, user: dict = Depends(current_user)):
    p = learning_paths.find_one({"_id": lr.oid(path_id, "khoá học"), "status": "published", "open_enroll": True})
    if not p:
        raise HTTPException(404, "Không tìm thấy khoá mở ghi danh")
    res = enroll_learner(p, user)
    return {"created": res["created"], "assignment_id": str(res["assignment"]["_id"])}


# ---------------------------------------------------------------------------
# Học tập của tôi (LRN-06)
# ---------------------------------------------------------------------------

def _course_lesson_done(a: dict, lesson_id: ObjectId, brief: dict | None = None) -> bool:
    brief = brief or lessons.find_one({"_id": lesson_id}, {"practice_question_ids": 1}) or {}
    if brief.get("practice_question_ids"):
        return attempts.count_documents({"assignment_id": None, "learner_id": a["learner_id"],
                                         "lesson_id": lesson_id, "kind": "practice", "passed": True,
                                         "finalized_at": {"$ne": None}}) > 0
    return lesson_id in ((a.get("progress") or {}).get("opened") or [])


def recompute_courses(a: dict) -> dict:
    """Cập nhật tiến độ chuỗi khoá từ lượt đạt bài, mở bài và thi khoá đã chốt."""
    path = learning_paths.find_one({"_id": a.get("path_id")})
    if not path or path.get("kind") != "courses":
        return a
    state = (a.get("progress") or {}).get("courses") or {}
    for item in a.get("plan") or []:
        slug, ids = item["category"], item.get("lesson_ids") or []
        st = state.setdefault(slug, {"lessons_done": []})
        if st.get("completed_elsewhere"):
            continue
        done = [i for i in ids if _course_lesson_done(a, i)]
        st["lessons_done"] = done
        if len(done) == len(ids):
            exam_cfg = (course_docs.find_one({"category": slug}) or {}).get("exam")
            passed_exam = not exam_cfg or attempts.count_documents({"assignment_id": a["_id"], "kind": "exam",
                                                                    "course": slug, "passed": True,
                                                                    "finalized_at": {"$ne": None}}) > 0
            if passed_exam:
                st.setdefault("done_at", db.now())
                if exam_cfg:
                    ex = attempts.find_one({"assignment_id": a["_id"], "kind": "exam", "course": slug,
                                            "passed": True, "finalized_at": {"$ne": None}},
                                           sort=[("finalized_at", 1)], projection={"_id": 1})
                    st["exam_attempt_id"] = ex["_id"] if ex else None
            else:
                st.pop("done_at", None)
        else:
            st.pop("done_at", None)
    required = [c["category"] for c in path.get("courses") or [] if c.get("required", True)]
    complete = all((state.get(s) or {}).get("done_at") for s in required)
    updates = {"progress.courses": state}
    if complete:
        updates["status"] = "completed"
    elif a.get("status") == "completed":
        updates["status"] = "in_progress"
    assignments.update_one({"_id": a["_id"]}, {"$set": updates})
    return assignments.find_one({"_id": a["_id"]}) or a


def course_lesson_unlocked(a: dict, lesson_id: ObjectId) -> tuple[bool, str | None]:
    path = learning_paths.find_one({"_id": a.get("path_id")})
    if not path or path.get("kind") != "courses":
        return True, None
    plan = a.get("plan") or []
    for ci, item in enumerate(plan):
        ids = item.get("lesson_ids") or []
        if lesson_id not in ids:
            continue
        state = (a.get("progress") or {}).get("courses") or {}
        if ci and not (state.get(plan[ci - 1]["category"]) or {}).get("done_at"):
            return False, plan[ci - 1]["category"]
        for prior in ids[:ids.index(lesson_id)]:
            if not _course_lesson_done(a, prior):
                lesson = lessons.find_one({"_id": prior}, {"title": 1}) or {}
                return False, lesson.get("title", "bài trước")
        return True, None
    return True, None


def assert_lesson_unlocked(user: dict, lesson_id: ObjectId) -> None:
    for a in assignments.find({"learner_id": user["_id"], "lesson_ids": lesson_id}):
        path = learning_paths.find_one({"_id": a["path_id"]})
        if path and path.get("kind") == "courses":
            a = recompute_courses(a)
            ok, before = course_lesson_unlocked(a, lesson_id)
            if not ok:
                raise HTTPException(409, f"Chưa tới lượt học — cần hoàn thành {before} trước")


def mark_opened(user: dict, lesson_id: ObjectId) -> None:
    """Người học mở bài học nằm trong lộ trình được giao -> ghi tiến độ (gọi từ GET bài học)."""
    assert_lesson_unlocked(user, lesson_id)
    assignments.update_many({"learner_id": user["_id"], "lesson_ids": lesson_id},
                            {"$addToSet": {"progress.opened": lesson_id}})
    assignments.update_many({"learner_id": user["_id"], "lesson_ids": lesson_id, "status": "assigned"},
                            {"$set": {"status": "in_progress"}})
    for a in assignments.find({"learner_id": user["_id"], "lesson_ids": lesson_id}):
        recompute_courses(a)


def assignment_view(a: dict, path: dict | None, practiced: set, names: dict) -> dict:
    path = path or {}
    ids = a.get("lesson_ids") or []
    if path.get("kind") == "courses":
        a = recompute_courses(a)
        state = (a.get("progress") or {}).get("courses") or {}
        visible = lesson_briefs(ids)
        active = None
        course_views = []
        for i, item in enumerate(a.get("plan") or []):
            slug, lesson_ids = item["category"], item.get("lesson_ids") or []
            st = state.get(slug) or {}
            done = bool(st.get("done_at"))
            if active is None and not done:
                active = slug
            lesson_views = []
            for n, lid in enumerate(lesson_ids):
                brief = visible.get(lid) or {}
                lesson_views.append({"id": str(lid), "title": brief.get("title", "(bài học không còn)"),
                                     "done": lid in (st.get("lessons_done") or []),
                                     "unlocked": (active == slug and all(x in (st.get("lessons_done") or [])
                                                                          for x in lesson_ids[:n]))})
            cfg = (course_docs.find_one({"category": slug}) or {}).get("exam")
            exam_view_for_course = None
            if cfg:
                exam_attempts = list(attempts.find({"assignment_id": a["_id"], "course": slug, "kind": "exam"},
                                                   {"paper": 0, "answers": 0}).sort("started_at", -1))
                latest = exam_attempts[0] if exam_attempts else None
                exam_view_for_course = {"duration_min": cfg.get("duration_min"),
                                        "pass_score": pass_score_of(cfg),
                                        "attempts_allowed": cfg.get("attempts", 1),
                                        "attempts_used": len(exam_attempts),
                                        "attempt": latest and {"id": str(latest["_id"]),
                                                               "submitted_at": latest.get("submitted_at"),
                                                               "finalized_at": latest.get("finalized_at"),
                                                               "passed": latest.get("passed")}}
            course_views.append({"category": slug, "days": item.get("days"), "required": item.get("required", True),
                                 "due_at": item.get("due_at"), "done": done, "unlocked": active == slug,
                                 "lessons": lesson_views,
                                 "exam": exam_view_for_course})
        return {"id": str(a["_id"]), "path_id": str(a["path_id"]), "title": path.get("title", "(lộ trình không còn)"),
                "kind": "courses", "courses": course_views, "lesson_total": len(ids),
                "lesson_done": sum(1 for x in ids if any(x in (s.get("lessons_done") or []) for s in state.values())),
                "next_lesson_id": next((str(x["id"]) for c in course_views if c["unlocked"]
                                        for x in c["lessons"] if x["unlocked"] and not x["done"]), None),
                "description": path.get("description") or "", "due_at": a.get("due_at"), "status": a["status"],
                "due_state": due_state(a.get("due_at"), a["status"]),
                "assigned_by_name": names.get(a["assigned_by"]), "started": bool((a.get("progress") or {}).get("opened"))}
    briefs = lesson_briefs(ids)
    opened = set((a.get("progress") or {}).get("opened") or [])
    required = set(path.get("required_items") or [])
    if path.get("parent_path_id"):      # bắt buộc của khung năm cũng là bắt buộc của lộ trình tháng kế thừa
        parent = learning_paths.find_one({"_id": path["parent_path_id"]}, {"required_items": 1}) or {}
        required |= set(parent.get("required_items") or [])

    def done(i):
        b = briefs.get(i) or {}
        return i in practiced or (i in opened and not b.get("practice_question_ids"))

    mods = [{"week": m["week"], "title": m.get("title") or "", "due_at": m.get("due_at"),
             "lessons": [{"id": str(i), "title": (briefs.get(i) or {}).get("title", "(bài học không còn)"),
                          "done": done(i), "required": i in required,
                          "practice_count": len((briefs.get(i) or {}).get("practice_question_ids") or [])}
                         for i in m.get("lesson_ids") or []]} for m in path.get("modules") or []]
    exam = exam_view(path.get("exam"))
    ex = (a.get("progress") or {}).get("exam")
    cur = attempts.find_one({"assignment_id": a["_id"], "kind": "exam"}, sort=[("started_at", -1)],
                            projection={"paper": 0, "answers": 0})
    used = attempts.count_documents({"assignment_id": a["_id"], "kind": "exam"})
    nxt = next((i for m in path.get("modules") or [] for i in m.get("lesson_ids") or [] if not done(i)), None)
    return {"id": str(a["_id"]), "path_id": str(a["path_id"]), "title": path.get("title", "(lộ trình không còn)"),
            "is_sample": bool(path.get("is_sample")), "self_enrolled": bool(a.get("self_enrolled")),
            "weeks": path_weeks(path), "started": bool(opened) or a["status"] != "assigned",
            "next_lesson_id": str(nxt) if nxt else None,
            "description": path.get("description") or "", "period": path.get("period"), "year": a.get("year"),
            "month": a.get("month"), "due_at": a.get("due_at"), "status": a["status"],
            "due_state": due_state(a.get("due_at"), a["status"]), "assigned_by_name": names.get(a["assigned_by"]),
            "modules": mods, "lesson_total": len(ids), "lesson_done": sum(1 for i in ids if done(i)),
            "exam": exam and {
                "duration_min": exam["duration_min"], "pass_score": exam["pass_score"],
                "question_count": sum(r["count"] for r in exam["blueprint"]), "attempts_allowed": exam["attempts"],
                "attempts_used": used,
                "attempt": cur and {"id": str(cur["_id"]), "started_at": cur["started_at"],
                                    "deadline_at": cur.get("deadline_at"), "submitted_at": cur.get("submitted_at"),
                                    "finalized_at": cur.get("finalized_at"),
                                    "final_score": cur.get("final_score") if cur.get("finalized_at") else None,
                                    "max_score": cur.get("max_score"),
                                    "passed": cur.get("passed") if cur.get("finalized_at") else None},
                "result": lr.plain(ex)}}


def my_assignments(user: dict) -> dict:
    """Việc được giao của một người, gộp theo tháng (lộ trình năm: nhóm "Cả năm"). Dùng cho web + MCP."""
    from . import grading
    grading.expire_due({"learner_id": user["_id"]})
    rows = list(assignments.find({"learner_id": user["_id"], "training_document_id": {"$exists": False}}).sort([("due_at", 1)]))
    for a in rows:
        recompute_courses(a)
    rows = [assignments.find_one({"_id": a["_id"]}) or a for a in rows]
    paths = {p["_id"]: p for p in learning_paths.find({"_id": {"$in": [r["path_id"] for r in rows]}})}
    lesson_ids = {i for r in rows for i in r.get("lesson_ids") or []}
    practiced = set(attempts.distinct("lesson_id", {"learner_id": user["_id"], "kind": "practice",
                                                    "lesson_id": {"$in": list(lesson_ids)},
                                                    "finalized_at": {"$ne": None}}))
    names = lr.names_of([r["assigned_by"] for r in rows])
    groups: dict = {}
    for r in rows:
        v = assignment_view(r, paths.get(r["path_id"]), practiced, names)
        if (paths.get(r["path_id"], {}).get("kind") != "courses" and r["status"] != "completed"
                and not v["exam"] and v["lesson_total"]
                and v["lesson_done"] == v["lesson_total"]):
            assignments.update_one({"_id": r["_id"]}, {"$set": {"status": "completed"}})   # không có bài thi
            v["status"], v["due_state"] = "completed", "done"
        key = f"{r.get('year')}-{r['month']:02d}" if r.get("month") else f"{r.get('year')}-00"
        label = f"Tháng {r['month']}/{r.get('year')}" if r.get("month") else f"Cả năm {r.get('year')}"
        groups.setdefault(key, {"key": key, "label": label, "items": []})["items"].append(v)
    months = [groups[k] for k in sorted(groups, reverse=True)]
    flat = [v for g in months for v in g["items"]]
    return {"months": months, "counts": {
        "total": len(flat), "completed": sum(1 for v in flat if v["status"] == "completed"),
        "overdue": sum(1 for v in flat if v["due_state"] == "overdue"),
        "soon": sum(1 for v in flat if v["due_state"] == "soon")}}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return my_assignments(user) | policy.learn_flags(user)   # cờ menu (A6) — API vẫn tự kiểm quyền


def exam_pool_questions(path: dict) -> list[ObjectId]:
    """Câu hỏi thuộc phạm vi "path" của lộ trình: câu luyện tập của các bài + câu gắn thẻ có trong các bài."""
    ids = path_lesson_ids(path)
    rows = list(lessons.find({"_id": {"$in": ids}}, {"items": 1, "practice_question_ids": 1}))
    qids = {q for r in rows for q in r.get("practice_question_ids") or []}
    card_ids = [i["card_id"] for r in rows for i in r.get("items") or []]
    qids |= {q["_id"] for q in questions.find({"card_refs.card_id": {"$in": card_ids}}, {"_id": 1})}
    return list(qids)
