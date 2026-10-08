"""API Học tập (tiền tố /api/learn — hợp đồng docs/BA.md mục 8).

Luồng E (đợt 1): bài học (LRN-01), ngân hàng câu hỏi tạo tay (LRN-02), lượt làm bài luyện tập (LRN-09).
Luồng I (đợt 2): lộ trình + giao bài + Học tập của tôi ở `learn/paths.py`; thi + chấm ở `learn/grading.py`
(hai router riêng, đăng ký trong main.py). Các endpoint còn lại trả 501 cho tới khi luồng H, L triển khai.

Quyền (BA 15.6) — mọi câu hỏi quyền đi qua `policy.py`:
- Soạn bài học / câu hỏi: `policy.can(user, "learn.author")`, chỉ từ thẻ **đã duyệt** người soạn xem được
  (`policy.visible_filter(user, "card")`).
- Xem bài học: `policy.visible_filter(user, "lesson")` (theo kho của bài học; luồng G thêm mức mật). Bản nháp chỉ
  người soạn thấy. Nội dung thẻ trong bài chỉ hiện nếu người xem cũng xem được thẻ đó (không lộ thẻ qua bài học).
- Ngân hàng câu hỏi (có đáp án) chỉ người soạn xem: `learn.author` + `policy.visible_filter(user, "question")`.
- Xem lượt làm: `policy.can(user, "learn.view_result", {"learner_id": …})`; chỉ chính người học ghi câu trả lời / nộp.
"""

from __future__ import annotations

import re
from typing import Any, Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from .. import categories, db, org, policy
from ..auth import current_user, users
from ..spaces import personal_space, spaces
from . import attempts as att
from . import courses
from .models import Bloom, attempts, lessons, questions

router = APIRouter(prefix="/api/learn")

cards = db.db["wiki_cards"]
card_revisions = db.db["card_revisions"]      # luồng C ghi (kb/revisions.py) — ở đây chỉ đọc

# Trường nội dung thẻ hiện trong bài học (tập con của kb/revisions.SNAPSHOT_FIELDS)
CARD_FIELDS = ("type", "title", "summary", "body", "key_points", "when_to_use", "example", "evidence", "tags",
               "categories")
MAX_ITEMS = 50
MAX_PRACTICE = 50


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def oid(value: str, what: str = "dữ liệu") -> ObjectId:
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(404, f"Không tìm thấy {what}") from None


def oids(values: list[str], what: str) -> list[ObjectId]:
    out = []
    for v in values:
        try:
            o = ObjectId(v)
        except (InvalidId, TypeError):
            raise HTTPException(400, f"Mã {what} không hợp lệ: {v}") from None
        if o not in out:
            out.append(o)
    return out


def plain(v):
    if isinstance(v, ObjectId):
        return str(v)
    if isinstance(v, list):
        return [plain(x) for x in v]
    if isinstance(v, dict):
        return {k: plain(x) for k, x in v.items()}
    return v


def names_of(ids) -> dict:
    return {u["_id"]: u["name"] for u in users.find({"_id": {"$in": [i for i in set(ids) if i]}}, {"name": 1})}


def require_author(user: dict) -> None:
    if not policy.can(user, "learn.author"):
        raise HTTPException(403, "Chỉ quản lý, biên tập viên (editor) hoặc L&D được soạn bài học và câu hỏi")


def target_space(user: dict, space_id: str | None) -> dict:
    """Kho lưu bài học / câu hỏi: kho được chọn mà người soạn sửa được, mặc định kho cá nhân."""
    if not space_id:
        return personal_space(user)
    space = spaces.find_one({"_id": oid(space_id, "kho")})
    if not space or not policy.can(user, "space.read", space):
        raise HTTPException(404, "Không tìm thấy kho")
    if not policy.can(user, "space.write", space):
        raise HTTPException(403, "Bạn chỉ có quyền xem kho này")
    return space


def not_blank(v: str | None, label: str) -> str | None:
    """Bỏ khoảng trắng đầu / cuối; chỉ toàn khoảng trắng -> lỗi 422 nêu rõ trường (QA B5)."""
    if v is None:
        return None
    v = v.strip()
    if not v:
        raise ValueError(f"{label} không được để trống")
    return v


def owner_unit(user: dict) -> ObjectId | None:
    units = org.user_org(user)["unit_ids"]
    return units[0] if units else None


def pin_cards(user: dict, card_ids: list[ObjectId], keep: dict[ObjectId, int] | None = None) -> tuple[list, list]:
    """Ghim phiên bản các thẻ (giữ thứ tự). Chỉ thẻ `approved` mà người soạn xem được (BA 15.6).
    keep: phiên bản đã ghim trước đó (sửa bản nháp không tự đổi phiên bản thẻ đã có trong bài).
    Trả (items [{card_id, rev}], bản ghi thẻ)."""
    f = policy.visible_filter(user, "card") | {"_id": {"$in": card_ids}, "status": "approved",
                                                 "delete_requested": {"$ne": True}}
    found = {c["_id"]: c for c in cards.find(f)}
    if len(found) != len(card_ids):
        raise HTTPException(400, "Chỉ dùng được thẻ VCWIKI đã duyệt mà bạn xem được "
                                 f"({len(card_ids) - len(found)} thẻ không hợp lệ)")
    keep = keep or {}
    items = [{"card_id": i, "rev": keep.get(i) or found[i].get("current_revision") or 1} for i in card_ids]
    return items, [found[i] for i in card_ids]


def visible_card_ids(user: dict, ids) -> set[ObjectId]:
    ids = list(set(ids))
    if not ids:
        return set()
    f = policy.visible_filter(user, "card") | {"_id": {"$in": ids}, "delete_requested": {"$ne": True}}
    return {c["_id"] for c in cards.find(f, {"_id": 1})}


# ---------------------------------------------------------------------------
# Bài học (LRN-01)
# ---------------------------------------------------------------------------

class LessonItemIn(BaseModel):
    card_id: str


class LessonIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    objectives: list[str] = Field(default_factory=list, max_length=20)
    narrative: str = Field("", max_length=50000)
    items: list[LessonItemIn] = Field(default_factory=list, max_length=MAX_ITEMS)
    practice_question_ids: list[str] = Field(default_factory=list, max_length=MAX_PRACTICE)
    space_id: str | None = None
    subject_id: str | None = None
    curriculum_id: str | None = None
    audience: str = Field('', max_length=3000)
    current_level: str = Field('', max_length=3000)
    entry: str = Field('', max_length=10000)
    outcome: str = Field('', max_length=10000)
    materials: list[dict] = Field(default_factory=list, max_length=50)
    category: str | None = Field(None, max_length=200)   # khoá (nút cây) — LRN-15; trống = Chưa xếp khoá

    @field_validator("title")
    @classmethod
    def check_title(cls, v: str) -> str:
        return not_blank(v, "Tên bài học")


class LessonPatch(BaseModel):
    revision: int | None = Field(None, ge=1)
    title: str | None = Field(None, min_length=1, max_length=200)
    objectives: list[str] | None = Field(None, max_length=20)
    narrative: str | None = Field(None, max_length=50000)
    items: list[LessonItemIn] | None = Field(None, max_length=MAX_ITEMS)
    practice_question_ids: list[str] | None = Field(None, max_length=MAX_PRACTICE)
    status: Literal["draft", "published"] | None = None
    subject_id: str | None = None
    audience: str | None = Field(None, max_length=3000)
    current_level: str | None = Field(None, max_length=3000)
    entry: str | None = Field(None, max_length=10000)
    outcome: str | None = Field(None, max_length=10000)
    materials: list[dict] | None = Field(None, max_length=50)
    category: str | None = Field(None, max_length=200)   # đổi khoá (gửi null = Chưa xếp khoá); bài xếp cuối khoá mới

    @field_validator("title")
    @classmethod
    def check_title(cls, v: str | None) -> str | None:
        return not_blank(v, "Tên bài học")


# Đọc bài học qua lộ trình (vấn đề mở 33): luật nằm ở policy.py (`via_assignment_filter`, `can_read_via_assignment`)
def lesson_scope(user: dict) -> dict:
    """Bài học người này xem được: theo kho (policy) + bản nháp chỉ người soạn thấy; thêm bài C0 / C1 đã phát hành
    trong lộ trình được giao (vấn đề mở 33) và trong khung năm của cấp trên (người soạn kế thừa khung)."""
    by_space = {"$and": [policy.visible_filter(user, "lesson"),
                         {"$or": [{"status": {"$ne": "draft"}}, {"created_by": user["_id"]}]}]}
    via = policy.via_assignment_filter(user)
    return {"$or": [by_space, via]} if via else by_space


def lesson_card_ids(user: dict, lesson: dict, ids) -> set[ObjectId]:
    """Thẻ người này đọc được TRONG bài học: thẻ mình xem được; bài đọc được qua lộ trình
    (`policy.can_read_via_assignment`) thì mọi thẻ của bài."""
    if policy.can_read_via_assignment(user, lesson):
        return set(ids)
    return visible_card_ids(user, ids)


def load_lesson(lesson_id: str, user: dict) -> dict:
    lesson = lessons.find_one({"_id": oid(lesson_id, "bài học")} | lesson_scope(user))
    if not lesson:
        raise HTTPException(404, "Không tìm thấy bài học")
    return lesson


def can_edit_lesson(user: dict, lesson: dict) -> bool:
    return (lesson["status"] == "draft" and lesson["created_by"] == user["_id"]
            and policy.can(user, "learn.author") and policy.can(user, "space.write", lesson))


def check_practice_questions(user: dict, ids: list[str]) -> list[dict]:
    qids = oids(ids, "câu hỏi")
    found = {q["_id"]: q for q in questions.find(policy.visible_filter(user, "question") | {"_id": {"$in": qids}})}
    if len(found) != len(qids):
        raise HTTPException(400, "Có câu hỏi không tồn tại hoặc bạn không xem được")
    return [found[i] for i in qids]


def lesson_content(user: dict, body: dict, keep: dict | None = None) -> dict:
    """Kiểm tra + dựng phần nội dung bài học từ dữ liệu người soạn gửi (items, câu luyện tập, mức mật)."""
    out = {}
    if "title" in body and re.match(r'^\s*Bài\s+\d+\b', body['title'], re.I):
        raise HTTPException(400, 'Tên bài không chứa số thứ tự Bài 1 / Bài 2')
    for key in ('audience', 'current_level', 'entry', 'outcome'):
        if key in body: out[key] = body[key]
    if 'subject_id' in body:
        from .training import subject
        out['subject_id'] = subject(body['subject_id'], user)['_id']
    if 'materials' in body:
        from .materials import validate_materials
        out['materials'] = validate_materials(body['materials'], user)
        card_materials = [m for m in out['materials'] if m['kind'] == 'card']
        existing = out.get('items', [])
        out['items'] = existing + [{'card_id': m['card_id'], 'rev': m['rev']} for m in card_materials if m['card_id'] not in {p['card_id'] for p in existing}]
    if "title" in body:
        out["title"] = body["title"].strip()
    if "objectives" in body:
        out["objectives"] = [o.strip() for o in body["objectives"] if o and o.strip()]
    if "narrative" in body:
        out["narrative"] = body["narrative"]
    if "items" in body:
        out["items"], _ = pin_cards(user, oids([i["card_id"] for i in body["items"]], "thẻ"), keep)
    if "practice_question_ids" in body:
        out["practice_question_ids"] = [q["_id"] for q in check_practice_questions(user, body["practice_question_ids"])]
    if 'materials' in out:
        existing = out.get('items', [])
        out['items'] = existing + [{'card_id': m['card_id'], 'rev': m['rev']} for m in out['materials'] if m['kind'] == 'card' and m['card_id'] not in {p['card_id'] for p in existing}]
    return out


def lesson_classification(items: list[dict], qids: list[ObjectId]) -> str:
    """Mức mật bài học = cao nhất của các thẻ trong bài + thẻ căn cứ của câu luyện tập (BA 15.5 quy tắc 1)."""
    docs = list(cards.find({"_id": {"$in": [i["card_id"] for i in items]}}, {"classification": 1}))
    docs += list(questions.find({"_id": {"$in": qids}}, {"classification": 1}))
    return policy.inherit_classification(docs)


def pinned_card(pin: dict, card: dict | None) -> dict:
    """Nội dung thẻ đúng phiên bản đã ghim (card_revisions của luồng C); chưa có bản ghi phiên bản -> nội dung
    hiện tại + cờ `pinned_rev_missing`."""
    base = {"card_id": str(pin["card_id"]), "rev": pin["rev"]}
    if not card:
        return base | {"unavailable": True}
    current = card.get("current_revision") or 1
    rev = card_revisions.find_one({"card_id": pin["card_id"], "rev": pin["rev"]})
    src = (rev or {}).get("snapshot") or card
    content = {k: plain(src.get(k)) for k in CARD_FIELDS if src.get(k) not in (None, "", [])}
    return base | content | {"current_rev": current, "outdated": current != pin["rev"],
                             "pinned_rev_missing": rev is None}


def usable_practice(user: dict, lesson: dict) -> list[dict]:
    """Câu luyện tập người này làm được: `approved`, thuộc bài học, và mọi thẻ căn cứ người này xem được."""
    qs = lesson.get("_practice_pool") if "_practice_pool" in lesson else list(questions.find({"_id": {"$in": lesson.get("practice_question_ids") or []}, "status": "approved"}))
    seen = lesson_card_ids(user, lesson, [r["card_id"] for q in qs for r in q.get("card_refs") or []])
    order = {q: i for i, q in enumerate(lesson.get("practice_question_ids") or [])}
    ok = [q for q in qs if q["_id"] in order and all(r["card_id"] in seen for r in q.get("card_refs") or [])]
    return sorted(ok, key=lambda q: order[q["_id"]])


def only_owner_sees(space: dict | None) -> bool:
    """Kho cá nhân chưa chia sẻ (riêng tư, không thêm thành viên): chỉ chủ kho xem được. Bài học phát hành ở đây
    thì người khác (kể cả nhân viên dưới quyền) không thấy — FE cảnh báo trước khi phát hành (QA B2)."""
    return bool(space) and space.get("type") == "personal" and space.get("visibility", "private") != "org" \
        and len(space.get("members") or []) <= 1 and not space.get("unit_grants")   # SYS-35: đã chia sẻ cho đơn vị


def lesson_out(lesson: dict, user: dict, full: bool = False) -> dict:
    people = names_of([lesson["created_by"]])
    space = spaces.find_one({"_id": lesson["space_id"]}, {"name": 1, "type": 1, "visibility": 1, "members": 1})
    o = {"id": str(lesson["_id"]), "title": lesson["title"], "objectives": lesson.get("objectives") or [],
         "status": lesson["status"], "classification": policy.effective_classification(lesson),
         "space_id": str(lesson["space_id"]), "space_name": (space or {}).get("name"),
         "space_only_owner": only_owner_sees(space),
         "owner_unit_id": plain(lesson.get("owner_unit_id")), "created_by": str(lesson["created_by"]),
         "created_by_name": people.get(lesson["created_by"]), "created_at": lesson.get("created_at"),
         "updated_at": lesson.get("updated_at"), "published_at": lesson.get("published_at"),
         "item_count": len(lesson.get("items") or []),
         "category": lesson.get("category"), "seq": lesson.get("seq"), "revision": lesson.get("revision", 1),
         "subject_id": plain(lesson.get('subject_id')), "audience": lesson.get('audience', ''),
         "current_level": lesson.get('current_level', ''), "entry": lesson.get('entry', ''), "outcome": lesson.get('outcome', ''),
         "practice_question_ids": [str(q) for q in lesson.get("practice_question_ids") or []],
         "version": lesson.get("version", 1), "source_id": plain(lesson.get("source_id")),
         "can_copy": bool(lesson.get("subject_id")) and policy.can(user, "learn.author") and policy.can(user, "space.write", lesson),
         "can_edit": can_edit_lesson(user, lesson), "ai": lesson.get("ai")}
    if not full:
        return o
    from .materials import materials_out
    o['materials'] = materials_out(lesson.get('materials', []), user)
    pins = lesson.get("items") or []
    seen = lesson_card_ids(user, lesson, [p["card_id"] for p in pins])
    cmap = {c["_id"]: c for c in cards.find({"_id": {"$in": list(seen)}})}
    mine = attempts.find({"learner_id": user["_id"], "lesson_id": lesson["_id"], "kind": "practice"},
                         {"paper": 0}).sort("started_at", -1).limit(20)
    return o | {"narrative": lesson.get("narrative") or "",
                "items": [pinned_card(p, cmap.get(p["card_id"])) for p in pins],
                "practice_count": len(usable_practice(user, lesson)),
                "my_attempts": [{"id": str(a["_id"]), "started_at": a["started_at"],
                                 "submitted_at": a.get("submitted_at"), "final_score": a.get("final_score"),
                                 "max_score": a.get("max_score"), "auto_max": a.get("auto_max")} for a in mine]}


def lesson_category_counts(f: dict) -> dict[str, int]:
    """Số bài học theo lĩnh vực (gồm nhánh con) — lĩnh vực của bài = lĩnh vực của các thẻ trong bài. Cho cây lĩnh vực
    ở Thư viện bài học, đếm trên đúng bộ lọc đang xem (trừ lĩnh vực)."""
    rows = list(lessons.find(f, {"items.card_id": 1}))
    ids = {i["card_id"] for r in rows for i in r.get("items") or []}
    card_cats = {c["_id"]: c.get("categories") or [] for c in cards.find({"_id": {"$in": list(ids)}}, {"categories": 1})}
    paths = {c["slug"]: c.get("path") or [] for c in categories.categories.find({}, {"slug": 1, "path": 1})}
    counts: dict[str, int] = {}
    for r in rows:
        slugs = {s for i in r.get("items") or [] for s in card_cats.get(i["card_id"], [])}
        for s in slugs | {a for s in slugs for a in paths.get(s, [])}:
            counts[s] = counts.get(s, 0) + 1
    return counts


@router.get("/lessons")
def list_lessons(q: str | None = None, status: str | None = None, card_id: str | None = None,
                 category: str | None = None, course: str | None = None, subject_id: str | None = None, mine: bool = False, page: int = Query(1, ge=1),
                 page_size: int = Query(50, ge=1, le=100), user: dict = Depends(current_user)):
    f = lesson_scope(user)
    if subject_id: f['subject_id'] = oid(subject_id, 'môn')
    if course is not None:
        if course == "unassigned":
            f = {"$and": [f, {"created_by": user["_id"]},
                           {"$or": [{"category": None}, {"category": {"$exists": False}}]}]}
        else:
            slug = courses.check_course(course)
            f = {"$and": [f, {"category": slug}]}
    if q and q.strip():
        f["title"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    if status:
        f["status"] = {"$in": status.split(",")}
    if card_id:
        f["items.card_id"] = oid(card_id, "thẻ")
    if mine:
        f["created_by"] = user["_id"]
    counts = lesson_category_counts(f)
    if category:
        # bài học thuộc nhánh X (gồm nhánh con) = có ít nhất một thẻ gắn lĩnh vực trong nhánh
        in_cat = cards.distinct("_id", {"categories": {"$in": categories.with_descendants(category)}})
        f = {"$and": [f, {"items.card_id": {"$in": in_cat}}]}
    rows = list(lessons.find(f).sort("updated_at", -1).skip((page - 1) * page_size).limit(page_size))
    out = {"items": [lesson_out(r, user) for r in rows], "total": lessons.count_documents(f), "category_counts": counts}
    return out | author_help(user)


# Dưới ngưỡng này thư viện cảnh báo "ít thẻ đã duyệt" cho người soạn
FEW_APPROVED_CARDS = 20


def author_help(user: dict) -> dict:
    """`can_author` (policy.can — nguồn quyết định quyền duy nhất) + lý do khi không soạn được (`author_status`),
    hoặc số thẻ đã duyệt người soạn dùng được (`approved_cards` — cùng điều kiện với pin_cards) để thư viện cảnh báo
    khi quá ít."""
    if not policy.can(user, "learn.author"):
        return {"can_author": False, "author_status": policy.learn_author_status(user)}
    f = policy.visible_filter(user, "card") | {"status": "approved", "delete_requested": {"$ne": True}}
    return {"can_author": True, "approved_cards": cards.count_documents(f, limit=FEW_APPROVED_CARDS),
            "few_approved_threshold": FEW_APPROVED_CARDS}


@router.post("/lessons", status_code=201)
def create_lesson(body: LessonIn, user: dict = Depends(current_user)):
    return create_lesson_record(body, user)


def create_lesson_record(body: LessonIn, user: dict, legacy_seed: bool = False):
    require_author(user)
    space = target_space(user, body.space_id)
    from .training import documents, load, editable
    curriculum = None
    content_body = body.model_dump(exclude={"space_id", "category", "curriculum_id"})
    if body.curriculum_id:
        curriculum = load(documents, body.curriculum_id, user)
        editable(curriculum, user)
        if curriculum['kind'] != 'curriculum': raise HTTPException(400, 'Chỉ tạo bài từ giáo trình')
        content_body |= {'subject_id': str(curriculum['subject_id']), 'audience': curriculum.get('audience', '')}
    if not content_body.get('subject_id'):
        if not legacy_seed:
            raise HTTPException(400, 'Tạo bài bắt buộc chọn môn học')
        content_body.pop('subject_id', None)
    category = courses.check_course(body.category)
    content = lesson_content(user, content_body)
    now = db.now()
    doc = {"title": "", "objectives": [], "narrative": "", "items": [], "practice_question_ids": []} | content | {
        "space_id": space["_id"], "owner_unit_id": owner_unit(user), "status": "draft",
        "created_by": user["_id"], "ai": None, "created_at": now, "updated_at": now, "revision": 1,
        "category": category, "seq": courses.next_seq(category)}
    doc["classification"] = policy.inherit_classification([{'classification': lesson_classification(doc["items"], doc["practice_question_ids"])}, *doc.get('materials', [])])
    doc["_id"] = lessons.insert_one(doc).inserted_id
    if curriculum:
        result = documents.update_one({'_id': curriculum['_id'], 'revision': curriculum['revision'], 'status': 'draft'},
            {'$push': {'lesson_ids': doc['_id']}, '$inc': {'revision': 1}, '$set': {'updated_at': db.now()}})
        if not result.modified_count:
            lessons.delete_one({'_id': doc['_id'], 'status': 'draft'})
            raise HTTPException(409, 'Giáo trình vừa thay đổi; nội dung soạn vẫn còn, hãy lưu lại')
    return lesson_out(doc, user, full=True)


@router.get("/lessons/{lesson_id}")
def get_lesson(lesson_id: str, user: dict = Depends(current_user)):
    lesson = load_lesson(lesson_id, user)
    if lesson["status"] != "draft":
        from .paths import mark_opened      # luồng I: tiến độ bài học trong lộ trình được giao
        mark_opened(user, lesson["_id"])
    return lesson_out(lesson, user, full=True)


@router.patch("/lessons/{lesson_id}")
def patch_lesson(lesson_id: str, body: LessonPatch, user: dict = Depends(current_user)):
    lesson = load_lesson(lesson_id, user)
    move = "category" in body.model_fields_set
    changes = body.model_dump(exclude_none=True)
    changes.pop("category", None)
    expected_revision = changes.pop("revision", lesson.get("revision"))
    if move and not changes:
        # Chỉ đổi khoá: xếp bài, không phải nội dung — bài đã phát hành vẫn đổi được (TK-15a)
        return move_lesson(user, lesson, body.category)
    if lesson["status"] != "draft":
        raise HTTPException(409, "Bài học đã phát hành — nội dung bị khoá. Tạo bản sao để sửa")
    if not can_edit_lesson(user, lesson):
        raise HTTPException(403, "Chỉ người soạn bài học này được sửa")
    status = changes.pop("status", None)
    upd = lesson_content(user, changes, keep={i["card_id"]: i["rev"] for i in lesson.get("items") or []})
    merged = lesson | upd
    if 'subject_id' in upd and upd['subject_id'] != lesson.get('subject_id'):
        from .training import documents
        if documents.count_documents({'lesson_ids': lesson['_id']}):
            raise HTTPException(409, 'Bài đang dùng trong giáo trình; tạo bản sao để đổi môn')
    if status == "published":
        if not merged.get('subject_id'):
            raise HTTPException(400, 'Bài học cần môn trước khi phát hành')
        if not merged["items"] and not merged.get('materials'):
            raise HTTPException(400, "Bài học cần ít nhất một học liệu trước khi phát hành")
        if merged.get('materials'):
            from .materials import validate_materials
            validate_materials([{k: v for k, v in m.items() if k != 'sha256'} for m in plain(merged['materials'])], user)
        qs = check_practice_questions(user, [str(i) for i in merged['practice_question_ids']])
        if any(q['status'] != 'approved' for q in qs):
            raise HTTPException(400, 'Câu kiểm tra phải được duyệt trước khi phát hành bài')
        pin_cards(user, [i["card_id"] for i in merged["items"]], {i["card_id"]: i["rev"] for i in merged["items"]})
        upd |= {"status": "published", "published_at": db.now(), "published_by": user["_id"], "_practice_pool": qs}
    upd["classification"] = policy.inherit_classification([{'classification': lesson_classification(merged["items"], merged["practice_question_ids"])}, *merged.get('materials', [])])
    upd["updated_at"] = db.now()
    if move and (slug := courses.check_course(body.category)) != lesson.get("category"):
        upd |= {"category": slug, "seq": courses.next_seq(slug)}
    # Điều kiện status = draft ngay trong truy vấn: hai yêu cầu chạy chồng không sửa được bài vừa phát hành
    new = lessons.find_one_and_update({"_id": lesson["_id"], "status": "draft", "revision": expected_revision}, {"$set": upd, "$inc": {"revision": 1}}, return_document=True)
    if not new:
        raise HTTPException(409, "Dữ liệu vừa thay đổi hoặc đã phát hành — tải lại trước khi sửa")
    return lesson_out(new, user, full=True)


def move_lesson(user: dict, lesson: dict, slug: str | None) -> dict:
    """Đổi khoá của bài (LRN-15, BA 17.12 luật 2): bài xếp cuối khoá mới; chọn lại khoá đang ở thì giữ nguyên chỗ.
    Người soạn bài (có quyền soạn + sửa được kho) — đổi được cả khi bài đã phát hành."""
    if not (lesson["created_by"] == user["_id"] and policy.can(user, "learn.author")
            and policy.can(user, "space.write", lesson)):
        raise HTTPException(403, "Chỉ người soạn bài học này được đổi khoá")
    slug = courses.check_course(slug)
    if slug != lesson.get("category") or lesson.get("seq") is None:
        lessons.update_one({"_id": lesson["_id"]}, {"$set": {"category": slug, "seq": courses.next_seq(slug),
                                                             "updated_at": db.now()}})
    return lesson_out(lessons.find_one({"_id": lesson["_id"]}), user, full=True)


# ---------------------------------------------------------------------------
# Ngân hàng câu hỏi (LRN-02 — phần tạo tay)
# ---------------------------------------------------------------------------

class OptionIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    correct: bool = False

    @field_validator("text")
    @classmethod
    def check_text(cls, v: str) -> str:
        return not_blank(v, "Nội dung phương án")


class RubricIn(BaseModel):
    criterion: str = Field(min_length=1, max_length=500)
    max: float = Field(ge=0, le=100)
    descriptor: str = Field("", max_length=2000)

    @field_validator("criterion")
    @classmethod
    def check_criterion(cls, v: str) -> str:
        return not_blank(v, "Tiêu chí rubric")


class QuestionIn(BaseModel):
    kind: Literal["single", "multi", "essay"]
    stem: str = Field(min_length=1, max_length=5000)
    options: list[OptionIn] = Field(default_factory=list, max_length=6)
    rubric: list[RubricIn] = Field(default_factory=list, max_length=20)
    model_answer: str = Field("", max_length=10000)
    explanation: str = Field("", max_length=5000)
    card_ids: list[str] = Field(min_length=1, max_length=10)
    difficulty: int = Field(3, ge=1, le=5)
    bloom: Bloom | None = None
    space_id: str | None = None

    @field_validator("stem")
    @classmethod
    def check_stem(cls, v: str) -> str:
        return not_blank(v, "Đề bài")


class QuestionPatch(BaseModel):
    kind: Literal["single", "multi", "essay"] | None = None
    stem: str | None = Field(None, min_length=1, max_length=5000)
    options: list[OptionIn] | None = Field(None, max_length=6)
    rubric: list[RubricIn] | None = Field(None, max_length=20)
    model_answer: str | None = Field(None, max_length=10000)
    explanation: str | None = Field(None, max_length=5000)
    card_ids: list[str] | None = Field(None, min_length=1, max_length=10)
    difficulty: int | None = Field(None, ge=1, le=5)
    bloom: Bloom | None = None
    status: Literal["draft", "approved"] | None = None

    @field_validator("stem")
    @classmethod
    def check_stem(cls, v: str | None) -> str | None:
        return not_blank(v, "Đề bài")


def validate_question(q: dict) -> None:
    """Luật BA 17.6: trắc nghiệm 2–6 phương án, một đáp án = đúng 1 phương án đúng, nhiều đáp án ≥ 1;
    tự luận có rubric ≥ 1 tiêu chí, tổng điểm > 0. Sai -> 400."""
    if q["kind"] in ("single", "multi"):
        opts = q.get("options") or []
        if not 2 <= len(opts) <= 6:
            raise HTTPException(400, "Câu trắc nghiệm cần 2–6 phương án")
        n = sum(1 for o in opts if o.get("correct"))
        if q["kind"] == "single" and n != 1:
            raise HTTPException(400, "Câu một đáp án phải có đúng 1 phương án đúng")
        if q["kind"] == "multi" and n < 1:
            raise HTTPException(400, "Câu nhiều đáp án cần ít nhất 1 phương án đúng")
    else:
        rubric = q.get("rubric") or []
        if not rubric:
            raise HTTPException(400, "Câu tự luận cần rubric ít nhất 1 tiêu chí")
        if sum(float(r.get("max") or 0) for r in rubric) <= 0:
            raise HTTPException(400, "Tổng điểm rubric phải lớn hơn 0")


def question_fields(q: dict) -> dict:
    """Chuẩn hoá theo loại: tự luận không có phương án; trắc nghiệm không có rubric."""
    if q["kind"] == "essay":
        q["options"] = []
    else:
        q["rubric"] = []
    q["stem"] = q["stem"].strip()
    return q


def load_question(question_id: str, user: dict) -> dict:
    q = questions.find_one({"_id": oid(question_id, "câu hỏi")} | policy.visible_filter(user, "question"))
    if not q:
        raise HTTPException(404, "Không tìm thấy câu hỏi")
    return q


def can_edit_question(user: dict, q: dict) -> bool:
    return policy.can(user, "learn.author") and policy.can(user, "space.write", q)


def questions_out(rows: list[dict], user: dict) -> list[dict]:
    people = names_of([r["created_by"] for r in rows] + [r.get("approved_by") for r in rows])
    ctitles = {c["_id"]: c["title"] for c in cards.find(
        {"_id": {"$in": list({ref["card_id"] for r in rows for ref in r.get("card_refs") or []})}}, {"title": 1})}
    author = policy.can(user, "learn.author")
    out = []
    for r in rows:
        o = {k: plain(v) for k, v in r.items() if k != "_id"}
        o |= {"id": str(r["_id"]), "classification": policy.effective_classification(r),
              "created_by_name": people.get(r["created_by"]), "approved_by_name": people.get(r.get("approved_by")),
              "card_refs": [{"card_id": str(c["card_id"]), "rev": c["rev"], "title": ctitles.get(c["card_id"])}
                            for c in r.get("card_refs") or []],
              "max": att.question_max(r),
              "can_edit": author and policy.can(user, "space.write", r)}
        out.append(o)
    return out


@router.get("/questions")
def list_questions(card_id: str | None = None, status: str | None = None, kind: str | None = None,
                   difficulty: int | None = Query(None, ge=1, le=5), q: str | None = None, ids: str | None = None,
                   sample: str | None = None, category: str | None = None,
                   page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                   user: dict = Depends(current_user)):
    require_author(user)     # ngân hàng câu hỏi có đáp án — chỉ người soạn xem
    f = policy.visible_filter(user, "question")
    if card_id:
        f["card_refs.card_id"] = oid(card_id, "thẻ")
    if status:
        f["status"] = {"$in": status.split(",")}
    if kind:
        f["kind"] = {"$in": kind.split(",")}
    if difficulty:
        f["difficulty"] = difficulty
    if q and q.strip():
        f["stem"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    if ids:
        f["_id"] = {"$in": oids([i for i in ids.split(",") if i], "câu hỏi")}
    if sample:
        f["sample_key"] = sample          # câu hỏi của khoá mẫu (learn/sample.py) — link từ seed / trang /learn
    if category:
        # câu hỏi thuộc nhánh X (gồm nhánh con) = dẫn về ít nhất một thẻ gắn lĩnh vực trong nhánh — như lọc bài học
        in_cat = cards.distinct("_id", {"categories": {"$in": categories.with_descendants(category)}})
        f = {"$and": [f, {"card_refs.card_id": {"$in": in_cat}}]}
    rows = list(questions.find(f).sort("updated_at", -1).skip((page - 1) * page_size).limit(page_size))
    return {"items": questions_out(rows, user), "total": questions.count_documents(f)}


@router.post("/questions", status_code=201)
def create_question(body: QuestionIn, user: dict = Depends(current_user)):
    require_author(user)
    space = target_space(user, body.space_id)
    doc = question_fields(body.model_dump(exclude={"space_id", "card_ids"}))
    validate_question(doc)
    refs, used = pin_cards(user, oids(body.card_ids, "thẻ"))
    now = db.now()
    doc |= {"card_refs": refs, "classification": policy.inherit_classification(used), "space_id": space["_id"],
            "status": "draft", "origin": "manual", "created_by": user["_id"], "approved_by": None,
            "approved_at": None, "created_at": now, "updated_at": now}
    doc["_id"] = questions.insert_one(doc).inserted_id
    return questions_out([doc], user)[0]


@router.patch("/questions/{question_id}")
def patch_question(question_id: str, body: QuestionPatch, user: dict = Depends(current_user)):
    require_author(user)
    q = load_question(question_id, user)
    if not can_edit_question(user, q):
        raise HTTPException(403, "Bạn chỉ có quyền xem câu hỏi này")
    changes = body.model_dump(exclude_none=True)
    status = changes.pop("status", None)
    card_ids = changes.pop("card_ids", None)
    merged = question_fields(q | changes)
    validate_question(merged)
    upd = {k: merged[k] for k in (*changes, "options", "rubric", "stem")}
    if card_ids is not None:
        # thẻ đã có trong câu giữ phiên bản đã ghim; thẻ mới ghim phiên bản hiện tại
        upd["card_refs"], used = pin_cards(user, oids(card_ids, "thẻ"),
                                           {r["card_id"]: r["rev"] for r in q.get("card_refs") or []})
        upd["classification"] = policy.inherit_classification(used)
    changed = any(upd[k] != q.get(k) for k in upd if k != "classification")
    if status == "approved":
        upd |= {"status": "approved", "approved_by": user["_id"], "approved_at": db.now()}
    elif status == "draft" or (changed and q.get("status") == "approved"):
        # sửa nội dung câu đã duyệt -> quay về nháp, cần duyệt lại
        upd |= {"status": "draft", "approved_by": None, "approved_at": None}
    upd["updated_at"] = db.now()
    questions.update_one({"_id": q["_id"]}, {"$set": upd})
    return questions_out([questions.find_one({"_id": q["_id"]})], user)[0]


# ---------------------------------------------------------------------------
# Lượt làm bài — luyện tập (LRN-09; bài thi: luồng I)
# ---------------------------------------------------------------------------

def attempt_viewers_ok(user: dict, a: dict) -> bool:
    assigned_by = None
    if a.get("assignment_id"):
        assigned_by = (db.db["assignments"].find_one({"_id": a["assignment_id"]}, {"assigned_by": 1}) or {}).get(
            "assigned_by")
    return policy.can(user, "learn.view_result", {"learner_id": a["learner_id"], "assigned_by": assigned_by})


def load_attempt(attempt_id: str, user: dict, write: bool = False) -> dict:
    """Không xem được -> 404 (không lộ lượt làm tồn tại); xem được mà không phải người học -> 403 khi ghi."""
    a = attempts.find_one({"_id": oid(attempt_id, "lượt làm")})
    if not a or not attempt_viewers_ok(user, a):
        raise HTTPException(404, "Không tìm thấy lượt làm")
    if write and a["learner_id"] != user["_id"]:
        raise HTTPException(403, "Chỉ người làm bài được sửa câu trả lời / nộp bài")
    return a


def attempt_out(a: dict) -> dict:
    """Lượt làm gửi FE: đề không có đáp án; đã chốt thì kèm kết quả + đáp án + giải thích."""
    return att.result(a) | {"lesson_id": plain(a.get("lesson_id")), "assignment_id": plain(a.get("assignment_id")),
                            "started_at": a["started_at"], "paper": att.public_paper(a["paper"]),
                            "answers": a.get("answers") or {}}


def practice_passed(a: dict) -> bool | None:
    """Đạt kiểm tra sau bài? Không có phần tự chấm (chỉ tự luận) → None (không xét đạt)."""
    mx = a.get("auto_max") or 0
    if mx <= 0:
        return None
    lesson = lessons.find_one({"_id": a.get("lesson_id")}, {"category": 1}) or {}
    return a["auto_score"] / mx * 100 >= float(courses.lesson_pass_score(lesson)) - 1e-9


def locked(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except att.AttemptLocked as e:
        raise HTTPException(409, str(e)) from None
    except att.InvalidAnswer as e:
        raise HTTPException(400, str(e)) from None


@router.post("/lessons/{lesson_id}/practice", status_code=201)
def start_practice(lesson_id: str, user: dict = Depends(current_user)):
    """Người học tự luyện tập câu `approved` của bài học (không cần được giao); làm lại được nhiều lần.
    Còn lượt chưa nộp của bài này (vd bấm Huỷ giữa chừng) thì làm tiếp lượt đó — giữ câu trả lời đã lưu nháp —
    thay vì tạo lượt mới (QA B8); bộ câu luyện tập đã đổi thì tạo lượt mới. Trả thêm `resumed`."""
    lesson = load_lesson(lesson_id, user)
    from .paths import assert_lesson_unlocked
    assert_lesson_unlocked(user, lesson["_id"])
    qs = usable_practice(user, lesson)
    if not qs:
        raise HTTPException(400, "Bài học chưa có câu luyện tập đã duyệt")
    pending = attempts.find_one({"learner_id": user["_id"], "lesson_id": lesson["_id"], "kind": "practice",
                                 "submitted_at": None}, sort=[("started_at", -1)])
    if pending and {p["question_id"] for p in pending["paper"]} == {q["_id"] for q in qs}:
        return attempt_out(pending) | {"resumed": True}
    a = att.new_attempt(user["_id"], "practice", att.build_paper(qs), assignment_id=None, lesson_id=lesson["_id"])
    return attempt_out(a) | {"resumed": False}


class AnswersIn(BaseModel):
    answers: dict[str, Any] = Field(default_factory=dict)
    auto: bool = False          # trình duyệt tự nộp khi hết giờ (bài thi) — server gắn nhãn *tự nộp*


@router.put("/attempts/{attempt_id}/answers")
def put_answers(attempt_id: str, body: AnswersIn, user: dict = Depends(current_user)):
    a = load_attempt(attempt_id, user, write=True)
    if a.get("kind") == "practice" and a.get("lesson_id"):
        from .paths import assert_lesson_unlocked
        assert_lesson_unlocked(user, a["lesson_id"])
    if a["kind"] == "exam":
        from .grading import exam_save       # luồng I: bài thi kiểm giờ ở server
        return exam_save(a, body.answers, user)
    return attempt_out(locked(att.save_answers, a, body.answers))


@router.post("/attempts/{attempt_id}/submit")
def submit_attempt(attempt_id: str, body: AnswersIn | None = Body(None), user: dict = Depends(current_user)):
    a = load_attempt(attempt_id, user, write=True)
    if a.get("kind") == "practice" and a.get("lesson_id"):
        from .paths import assert_lesson_unlocked
        assert_lesson_unlocked(user, a["lesson_id"])
    if a["kind"] == "exam":
        from .grading import exam_submit     # luồng I: hết giờ, tự chốt / AI chấm sơ bộ
        return exam_submit(a, body.answers if body else None, user, auto=bool(body and body.auto))
    a = locked(att.submit, a, body.answers if body else None)
    if a["kind"] == "practice":
        # luyện tập = kiểm tra sau bài (BA 17.12 luật 4, 6e): tự chốt ngay, điểm = phần trắc nghiệm; tự luận không
        # chấm, xem đáp án mẫu + rubric. Đạt khi điểm / điểm tự chấm tối đa ≥ điểm đạt bài của khoá (mặc định 70)
        a = locked(att.finalize, a, None, a["auto_score"], practice_passed(a))
        from .paths import recompute_courses
        for assignment in db.db["assignments"].find({"learner_id": user["_id"], "lesson_ids": a.get("lesson_id")}):
            recompute_courses(assignment)
    return attempt_out(a)


# ---------------------------------------------------------------------------
# Chưa triển khai (luồng H, L). Lộ trình, giao bài, thi, chấm (luồng I): learn/paths.py, learn/grading.py
# ---------------------------------------------------------------------------

def _todo(req: str):
    def handler(_user: dict = Depends(current_user)):
        raise HTTPException(501, f"Chưa triển khai ({req})")
    return handler


for _method, _path, _req in [
    ("POST", "/generate/questions", "LRN-02"),
    ("POST", "/paths/design", "LRN-04"),
    ("GET", "/reports", "LRN-10"),
]:
    router.add_api_route(_path, _todo(_req), methods=[_method], name=f"learn_{_method.lower()}_{_path}")


@router.delete('/lessons/{lesson_id}')
def delete_lesson(lesson_id: str, user: dict = Depends(current_user)):
    lesson = load_lesson(lesson_id, user)
    if not can_edit_lesson(user, lesson):
        raise HTTPException(403, 'Chỉ xoá bản nháp của mình còn quyền sửa kho')
    from .training import documents
    from .practical import tasks
    from .models import assignments, learning_paths
    if (documents.count_documents({'$or': [{'lesson_ids': lesson['_id']}, {'sessions.lesson_ids': lesson['_id']}]})
        or assignments.count_documents({'lesson_ids': lesson['_id']})
        or learning_paths.count_documents({'$or': [{'modules.lesson_ids': lesson['_id']}, {'courses.lesson_ids': lesson['_id']}]})
        or lessons.count_documents({'source_id': lesson['_id']}) or attempts.count_documents({'lesson_id': lesson['_id']}) or tasks.count_documents({'lesson_id': lesson['_id']})):
        raise HTTPException(409, 'Bài đang được dùng / đã có kết quả; không thể xoá')
    lessons.delete_one({'_id': lesson['_id'], 'status': 'draft'})
    return {'deleted': True}


@router.post('/lessons/{lesson_id}/copy', status_code=201)
def copy_lesson(lesson_id: str, user: dict = Depends(current_user)):
    lesson = load_lesson(lesson_id, user); require_author(user)
    if not lesson.get('subject_id'):
        raise HTTPException(409, 'Bài kiểu cũ chưa có môn; cần phân loại tường minh trước')
    body = {k: plain(lesson[k]) for k in ('title', 'objectives', 'narrative', 'subject_id', 'space_id', 'audience', 'current_level', 'entry', 'outcome', 'practice_question_ids', 'category') if k in lesson}
    body['items'] = [{'card_id': str(p['card_id'])} for p in lesson.get('items', [])]
    body['materials'] = [{k: v for k, v in m.items() if k != 'sha256'} for m in plain(lesson.get('materials', []))]
    made = create_lesson_record(LessonIn(**body), user)
    new = lessons.find_one_and_update({'_id': oid(made['id'])}, {'$set': {'source_id': lesson['_id'], 'version': lesson.get('version', 1) + 1}}, return_document=True)
    return lesson_out(new, user, full=True)
