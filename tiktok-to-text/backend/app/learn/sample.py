"""Khoá đào tạo mẫu cho /learn — "Kỹ năng bán hàng B2B cho NVKD mới" (yêu cầu 6ab889cd…9949de, BA 17.x "Khoá mẫu").

Định nghĩa khoá: `backend/seeds/sample_course_nvkd_b2b.yaml`. Mọi bản ghi khoá mẫu mang `sample_key` → idempotent:
chạy lại không tạo trùng, `reset` xoá sạch để dựng lại.

Các bước (script `scripts/seed_sample_course.py` và cờ khởi động `SEED_SAMPLE_COURSE=1` cùng gọi `run`):
  a) kiểm 16 thẻ: tồn tại · không C3 · đã duyệt · ở kho org — chưa duyệt → mã 2 + link Duyệt hàng loạt, dừng.
  b) dựng: câu hỏi nháp theo thẻ (`generate.draft_questions_for_card`, loại câu theo bảng 17.6), 2 câu tự luận tình
     huống gara, 8 bài học (ghim `current_revision`, diễn giải AI hoặc tóm tắt + ý chính), lộ trình nháp + ma trận đề.
  c) câu hỏi còn nháp → mã 3 + link ngân hàng câu hỏi đã lọc theo khoá, dừng.
  d) phát hành (`paths.publish_path` — ma trận đề phải rút đủ câu), đặt `is_sample` + `open_enroll`, ghi danh người
     chạy + giao danh sách `assign` (hạn = hôm nay + `enroll_days`, 23:59 giờ VN).

KHÔNG có đường nào tự duyệt thẻ / câu hỏi hay nới bốn mắt: dựng đi qua đúng hàm của API (quyền `learn.author`,
`space.write`, chỉ thẻ `approved`), duyệt là người bấm trên web.
"""

from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

import yaml
from bson import ObjectId
from fastapi import HTTPException

from .. import db, policy
from ..config import seed_sample_as, seed_sample_course
from ..auth import users
from ..spaces import spaces
from . import generate
from .models import assignments, attempts, learning_paths, lessons, questions

SEEDS_DIR = Path(__file__).resolve().parents[2] / "seeds"
SEED_FILE = SEEDS_DIR / "sample_course_nvkd_b2b.yaml"      # khoá mẫu đầu tiên (mặc định của load())
VN_TZ = timezone(timedelta(hours=7))
cards = db.db["wiki_cards"]

OK, HARD_ERROR, CARDS_PENDING, QUESTIONS_PENDING = 0, 1, 2, 3
MAX_CARD_DIFFICULTY = 4        # câu sinh theo thẻ ≤ 4; tự luận tình huống gara = 5 (dòng ma trận tự luận rút trúng)


def load(path: Path | str = SEED_FILE) -> dict:
    with open(path, encoding="utf-8") as f:
        course = yaml.safe_load(f)
    n = 0
    for wk in course["weeks"]:
        for ls in wk["lessons"]:
            n += 1
            ls["no"] = n
    return course


def all_courses() -> list[dict]:
    """Mọi khoá mẫu: mỗi file seeds/sample_course_*.yaml một khoá (khoá NVKD B2B trước)."""
    files = sorted(SEEDS_DIR.glob("sample_course_*.yaml"), key=lambda f: (f != SEED_FILE, f.name))
    return [load(f) for f in files]


def find(key: str) -> dict:
    for c in all_courses():
        if c["sample_key"] == key:
            return c
    raise KeyError(f"Không có khoá mẫu {key}")


def graded_ids(course: dict) -> list[str]:
    """Mã thẻ tính điểm theo thứ tự tuần → bài."""
    return [cid for wk in course["weeks"] for ls in wk["lessons"] for cid in ls["cards"]]


def all_lessons(course: dict) -> list[tuple[dict, dict]]:
    return [(wk, ls) for wk in course["weeks"] for ls in wk["lessons"]]


def lesson_label(course: dict, cid: str) -> str:
    for wk, ls in all_lessons(course):
        if cid in ls["cards"]:
            return f"T{wk['week']} · {ls['title']}"
    return "?"


def org_space(course: dict) -> dict | None:
    return spaces.find_one({"name": course["org_space"], "visibility": "org"})


def review_link(ids: list[str], base_url: str = "") -> str:
    return f"{base_url.rstrip('/')}/wiki/review?tab=bulk&ids={','.join(ids)}"


def questions_link(course: dict, base_url: str = "") -> str:
    return f"{base_url.rstrip('/')}/learn/library?tab=questions&sample={course['sample_key']}&status=draft"


def vn_day_end(days: int, start: datetime | None = None) -> datetime:
    """23:59 giờ VN của ngày (hôm nay + days), trả UTC."""
    d = (start or db.now()).astimezone(VN_TZ).date() + timedelta(days=days)
    return datetime(d.year, d.month, d.day, 23, 59, tzinfo=VN_TZ).astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# Bước a — kiểm thẻ (chỉ đọc)
# ---------------------------------------------------------------------------

def check_cards(course: dict) -> dict:
    space = org_space(course)
    rows = []
    for cid in graded_ids(course):
        c = cards.find_one({"_id": ObjectId(cid)}, {"title": 1, "status": 1, "classification": 1, "space_id": 1,
                                                    "level": 1, "current_revision": 1, "type": 1})
        if not c:
            rows.append({"id": cid, "exists": False, "error": "không tìm thấy"})
            continue
        rows.append({"id": cid, "exists": True, "title": c.get("title") or "", "status": c.get("status"),
                     "classification": policy.effective_classification(c), "level": c.get("level"),
                     "rev": c.get("current_revision") or 1, "type": c.get("type"),
                     "in_org_space": bool(space) and c.get("space_id") == space["_id"]})
    missing = [r["id"] for r in rows if not r["exists"]]
    c3 = [r["id"] for r in rows if r.get("classification") == "C3"]
    # Khoá có `require_org_space: true` (khoá NVKD B2B — yêu cầu 9949de): 16 thẻ phải ở kho org. Khoá khác: thẻ ở
    # kho riêng vẫn dùng được — người học đọc qua khoá được giao (C0 / C1, policy.VIA_ASSIGNMENT); C2 thì không
    outside = [r["id"] for r in rows if r["exists"] and not r["in_org_space"]] if course.get("require_org_space") else []
    c2 = [r["id"] for r in rows if r.get("classification") == "C2"]
    pending = [r["id"] for r in rows if r["exists"] and r["status"] != "approved"]
    # thẻ đọc thêm chưa duyệt không chặn seed (bài chỉ bỏ thẻ đó) nhưng đưa luôn vào link duyệt hàng loạt
    reading = [str(c["_id"]) for c in cards.find({"_id": {"$in": [ObjectId(i) for i in course.get("reading_cards") or []]},
                                                 "status": "draft"}, {"_id": 1})]
    return {"rows": rows, "reading_pending": reading, "space_found": bool(space), "missing": missing, "c3": c3 + c2, "outside": outside,
            "pending": pending, "hard_error": bool(missing or c3 or c2 or outside or not space)}


# ---------------------------------------------------------------------------
# Trạng thái (script --dry-run + trang /learn cho quản trị / L&D)
# ---------------------------------------------------------------------------

def sample_path(course: dict) -> dict | None:
    return learning_paths.find_one({"sample_key": course["sample_key"]})


def status(course: dict | None = None) -> dict:
    """Khoá mẫu đang ở bước nào: cards (chờ duyệt thẻ) → build (chưa dựng) → questions (chờ duyệt câu) →
    publish (chưa phát hành) → ready. Chỉ đọc."""
    course = course or load()
    chk = check_cards(course)
    key = course["sample_key"]
    qs = list(questions.find({"sample_key": key}, {"status": 1}))
    p = sample_path(course)
    draft_q = [q for q in qs if q["status"] != "approved"]
    if chk["hard_error"]:
        stage = "error"
    elif chk["pending"]:
        stage = "cards"
    elif not p:
        stage = "build"
    elif draft_q:
        stage = "questions"
    elif p["status"] == "draft":
        stage = "publish"
    else:
        stage = "ready"
    return {"sample_key": key, "title": course["title"], "stage": stage,
            "cards_total": len(chk["rows"]), "cards_pending": len(chk["pending"]), "cards_missing": len(chk["missing"]),
            "questions_total": len(qs), "questions_draft": len(draft_q),
            "review_link": review_link(chk["pending"] + chk["reading_pending"]) if chk["pending"] else None,
            "questions_link": questions_link(course) if draft_q else None,
            "path_id": str(p["_id"]) if p else None, "path_status": p["status"] if p else None}


# ---------------------------------------------------------------------------
# Bước b — dựng câu hỏi, bài học, lộ trình nháp
# ---------------------------------------------------------------------------

# người đọc lấy từ `learner` của từng khoá (seeds/*.yaml) — không viết cứng một đối tượng cho mọi khoá
NARRATIVE_SYSTEM = """Bạn viết phần diễn giải ngắn cho một bài học nội bộ của tập đoàn VC Phồn Vinh, người đọc là
{learner}. CHỈ dựa trên các thẻ tri thức được đưa, không thêm kiến thức ngoài.
Viết tiếng Việt, markdown, 150–300 chữ, xưng hô trung tính (không gọi người đọc bằng chức danh khác với người đọc ở
trên): mở bằng một câu vì sao bài này quan trọng, rồi nối các ý chính của các thẻ thành mạch, kết bằng 1–2 việc làm
ngay trong công việc. Không lặp nguyên văn thẻ, không liệt kê nguồn (hệ thống tự thêm)."""
DEFAULT_LEARNER = "nhân viên của công ty đang học khoá này"


def _cite(cs: list[dict], extra: list[dict]) -> str:
    line = lambda c, tag="": f"- {c.get('title', '')}{tag} — `{c['_id']}` · bản {c.get('current_revision') or 1}"  # noqa: E731
    return "\n".join(["", "---", "**Nguồn trong bài** (thẻ VCWIKI · phiên bản đã ghim):"] +
                     [line(c) for c in cs] + [line(c, " (đọc thêm, không tính điểm)") for c in extra])


def _plain_narrative(title: str, cs: list[dict]) -> str:
    parts = []
    for c in cs:
        parts.append(f"### {c.get('title', '')}\n\n{c.get('summary') or ''}")
        if c.get("key_points"):
            parts.append("\n".join(f"- {k}" for k in c["key_points"]))
    return "\n\n".join(parts)          # tên bài đã là tiêu đề trang — không lặp trong diễn giải


def make_narrative(title: str, cs: list[dict], extra: list[dict], log: Callable[[str], None],
                   learner: str = DEFAULT_LEARNER) -> tuple[str, str]:
    """Diễn giải bài học: AI viết từ thẻ nếu AI sẵn sàng, không thì tóm tắt + ý chính. Luôn kèm mã thẻ + phiên bản.
    Trả (narrative, engine)."""
    text = "\n\n".join(f"<the>\n{generate.card_text(c, 2500)}\n</the>" for c in cs)
    schema = {"type": "object", "properties": {"narrative": {"type": "string"}}, "required": ["narrative"],
              "additionalProperties": False}
    try:
        data, engine = generate.ai_call(NARRATIVE_SYSTEM.format(learner=learner), f"Bài học: {title}\n\n{text}", schema,
                                        lambda: {"narrative": _plain_narrative(title, cs)}, max_tokens=2000)
        body = (data.get("narrative") or "").strip()
        if not body:
            raise ValueError("AI trả diễn giải rỗng")
    except Exception as e:  # noqa: BLE001 — AI không sẵn sàng / lỗi: dùng tóm tắt + ý chính, không chặn seed
        log(f"  · diễn giải “{title}”: {generate.ai_error_message(e)} → dùng tóm tắt + ý chính")
        body, engine = _plain_narrative(title, cs), "summary"
    return body + "\n" + _cite(cs, extra), engine


def _card_questions(course: dict, card: dict, user: dict, log: Callable[[str], None]) -> list[ObjectId]:
    key = course["sample_key"]
    have = [q["_id"] for q in questions.find({"sample_key": key, "sample_role": "practice", "sample_card": card["_id"]},
                                             {"_id": 1}).sort("_id", 1)]
    if have:
        return have
    made = generate.draft_questions_for_card(card, card.get("current_revision") or 1, user,
                                             n=course.get("questions_per_card", 2))
    ids = [q["_id"] for q in made]
    if not ids:
        log(f"  ⚠ AI không trả câu hợp lệ cho thẻ {card['_id']} — soạn tay ở ngân hàng câu hỏi")
        return []
    questions.update_many({"_id": {"$in": ids}}, {
        "$set": {"sample_key": key, "sample_role": "practice", "sample_card": card["_id"]},
        "$min": {"difficulty": MAX_CARD_DIFFICULTY}})
    return ids


def _exam_essays(course: dict, space: dict, user: dict) -> list[ObjectId]:
    from .routes import QuestionIn, create_question
    key = course["sample_key"]
    out = []
    for i, e in enumerate(course["exam"].get("essays") or []):
        q = questions.find_one({"sample_key": key, "sample_role": "exam_essay", "sample_idx": i}, {"_id": 1})
        if not q:
            body = QuestionIn(kind="essay", stem=e["stem"].strip(), rubric=e["rubric"],
                              model_answer=e.get("model_answer", "").strip(),
                              explanation="Tình huống cuối khoá — chấm theo rubric, căn cứ các thẻ trong bài.",
                              card_ids=e["cards"], difficulty=5, bloom="apply", space_id=str(space["_id"]))
            made = create_question(body, user)
            q = {"_id": ObjectId(made["id"])}
            questions.update_one({"_id": q["_id"]}, {"$set": {
                "sample_key": key, "sample_role": "exam_essay", "sample_idx": i, "origin": "seed"}})
        out.append(q["_id"])
    return out


def build(course: dict, user: dict, log: Callable[[str], None] = print, rewrite_narrative: bool = False) -> dict:
    """Bước b (idempotent): câu hỏi nháp, bài học nháp, lộ trình nháp. Thẻ phải đã duyệt (kiểm ở `run`)."""
    from .paths import ExamIn, ModuleIn, PathIn, create_path
    from .routes import LessonIn, create_lesson_record
    key = course["sample_key"]
    space = org_space(course)
    if not policy.can(user, "learn.author"):
        raise HTTPException(403, f"{user.get('email')} chưa có quyền soạn bài học (learn.author): quản trị viên "
                                 "cấp vai trò L&D (hoặc editor) ở trang /org → Phân quyền, rồi chạy lại")
    if not policy.can(user, "space.write", space):
        raise HTTPException(403, f"Người chạy seed cần quyền sửa kho “{course['org_space']}”")

    cmap = {c["_id"]: c for c in cards.find({"_id": {"$in": [ObjectId(i) for i in graded_ids(course)]}})}
    reading = [c for c in cards.find({"_id": {"$in": [ObjectId(i) for i in course.get("reading_cards") or []]},
                                      "status": "approved"})]
    log("Câu hỏi theo thẻ:")
    qids: dict[ObjectId, list[ObjectId]] = {}
    for cid in graded_ids(course):
        card = cmap[ObjectId(cid)]
        qids[card["_id"]] = _card_questions(course, card, user, log)
        log(f"  {cid}  {card.get('type'):<10} {len(qids[card['_id']])} câu")
    essays = _exam_essays(course, space, user)
    log(f"Tự luận tình huống gara: {len(essays)} câu")

    lesson_ids: dict[int, ObjectId] = {}
    items_all = all_lessons(course)
    for wk, ls in items_all:
        cs = [cmap[ObjectId(i)] for i in ls["cards"]]
        extra = reading if ls["no"] == items_all[-1][1]["no"] else []
        practice = [q for c in cs for q in qids[c["_id"]]]
        doc = lessons.find_one({"sample_key": key, "sample_lesson": ls["no"]})
        title = ls["title"]
        if doc:
            if doc["status"] == "draft":      # câu hỏi dựng lại sau --reset một phần: cập nhật danh sách luyện tập
                upd = {"practice_question_ids": practice}
                if rewrite_narrative:         # bài còn nháp: viết lại diễn giải (vd sửa đối tượng người đọc)
                    upd["narrative"], engine = make_narrative(title, cs, extra, log, course.get("learner", DEFAULT_LEARNER))
                    upd["ai.engine"] = engine
                    log(f"  ↻ {title}: viết lại diễn giải ({engine})")
                lessons.update_one({"_id": doc["_id"], "status": "draft"}, {"$set": upd})
            lesson_ids[ls["no"]] = doc["_id"]
            continue
        narrative, engine = make_narrative(title, cs, extra, log, course.get("learner", DEFAULT_LEARNER))
        made = create_lesson_record(LessonIn(
            title=title, objectives=[c.get("title", "")[:200] for c in cs], narrative=narrative,
            items=[{"card_id": str(c["_id"])} for c in cs + extra],
            practice_question_ids=[str(q) for q in practice], space_id=str(space["_id"])), user, legacy_seed=True)
        lid = ObjectId(made["id"])
        lessons.update_one({"_id": lid}, {"$set": {"sample_key": key, "sample_lesson": ls["no"],
                                                   "ai": {"engine": engine, "source": "seed"}}})
        lesson_ids[ls["no"]] = lid
        log(f"  + {title} ({len(cs)} thẻ{' + đọc thêm' if extra else ''}, {len(practice)} câu luyện tập)")

    p = sample_path(course)
    if not p:
        now = db.now().astimezone(VN_TZ)
        ex = course["exam"]
        made = create_path(PathIn(
            title=course["title"], description=course.get("description", "").strip(), period="month",
            year=now.year, month=now.month,
            modules=[ModuleIn(week=wk["week"], title=wk["title"],
                              lesson_ids=[str(lesson_ids[ls["no"]]) for ls in wk["lessons"]]) for wk in course["weeks"]],
            exam=ExamIn(blueprint=ex["blueprint"], duration_min=ex["duration_min"], pass_score=ex["pass_score"],
                        attempts=ex["attempts"], scope="path")), user)
        learning_paths.update_one({"_id": ObjectId(made["id"])}, {"$set": {
            "sample_key": key, "enroll_days": course.get("enroll_days", 28), "audience": course.get("audience"),
            "hours_per_week": course.get("hours_per_week")}})
        p = sample_path(course)
        log(f"Lộ trình nháp: {p['title']} ({len(lesson_ids)} bài, 4 tuần)")
    return {"path_id": p["_id"], "lesson_ids": list(lesson_ids.values()), "essay_ids": essays}


# ---------------------------------------------------------------------------
# Bản xem trước (output/khoa-mau-nvkd-b2b.md) — chỉ đọc
# ---------------------------------------------------------------------------

KIND_VI = {"single": "một đáp án", "multi": "nhiều đáp án", "essay": "tự luận"}


def export_markdown(course: dict) -> str:
    """Tuần → bài → thẻ (mã, tên, nhánh, bậc, phiên bản, loại) + ma trận đề + 2 tự luận + rubric + câu đã sinh."""
    key = course["sample_key"]
    ids = [ObjectId(i) for i in graded_ids(course) + list(course.get("reading_cards") or [])]
    cmap = {c["_id"]: c for c in cards.find({"_id": {"$in": ids}})}
    qs = list(questions.find({"sample_key": key}).sort("_id", 1))
    by_card: dict = {}
    for q in qs:
        if q.get("sample_role") == "practice":
            by_card.setdefault(q["sample_card"], []).append(q)
    st = status(course)
    ex = course["exam"]
    row = lambda c, cid: (f"| `{cid}` | {(c or {}).get('title', '— không có trong DB —')} | "  # noqa: E731
                          f"{', '.join((c or {}).get('categories') or []) or '—'} | {(c or {}).get('level') or '—'} | "
                          f"{(c or {}).get('current_revision') or '—'} | {(c or {}).get('type') or '—'} | "
                          f"{(c or {}).get('status') or '—'} |")
    out = [f"# Khoá mẫu: {course['title']}", "",
           f"`sample_key = {key}` · DB `{db.db.name}` · xuất lúc {db.now().astimezone(VN_TZ):%d/%m/%Y %H:%M} (giờ VN) · "
           f"trạng thái: **{st['stage']}** (thẻ chờ duyệt {st['cards_pending']}, câu {st['questions_total']} — nháp "
           f"{st['questions_draft']})", "", course.get("description", "").strip(), "",
           f"Đối tượng: chức năng `{course['audience']['function']}`, cấp bậc {course['audience']['level']}, mảng "
           f"`{course['audience']['category']}`, division {', '.join(course['audience']['division'])}. "
           f"~{course.get('hours_per_week')} giờ/tuần · hạn {course.get('enroll_days')} ngày kể từ ngày giao / ghi danh.", ""]
    for wk in course["weeks"]:
        out += [f"## Tuần {wk['week']} — {wk['title']}", ""]
        for ls in wk["lessons"]:
            out += [f"### Bài {ls['no']}: {ls['title']}", "",
                    "| Mã thẻ | Tên | Nhánh | Bậc | Bản | Loại | Trạng thái |", "|---|---|---|---|---|---|---|"]
            out += [row(cmap.get(ObjectId(cid)), cid) for cid in ls["cards"]]
            out.append("")
            for cid in ls["cards"]:
                for q in by_card.get(ObjectId(cid), []):
                    out.append(f"- *{KIND_VI[q['kind']]} · độ khó {q.get('difficulty')} · {q['status']}* — {q['stem']}")
                    out += [f"    - {'✓' if o.get('correct') else '○'} {o['text']}" for o in q.get("options") or []]
            if by_card:
                out.append("")
    if course.get("reading_cards"):
        out += ["## Đọc thêm (không tính điểm, gắn vào bài 8)", "",
                "| Mã thẻ | Tên | Nhánh | Bậc | Bản | Loại | Trạng thái |", "|---|---|---|---|---|---|---|"]
        out += [row(cmap.get(ObjectId(cid)), cid) for cid in course["reading_cards"]] + [""]
    out += ["## Thi cuối khoá", "",
            f"{ex['duration_min']} phút · đạt từ {ex['pass_score']}% · {ex['attempts']} lượt · rút câu đã duyệt gắn thẻ "
            "trong khoá (phạm vi `path`).", "", "| Loại câu | Độ khó | Số câu |", "|---|---|---|"]
    out += [f"| {KIND_VI[r['kind']]} | {r.get('difficulty') or 'mọi'} | {r['count']} |" for r in ex["blueprint"]]
    out.append("")
    for i, e in enumerate(ex.get("essays") or [], 1):
        total = sum(r["max"] for r in e["rubric"])
        out += [f"### Tự luận {i} (tổng {total:g} điểm)", "", e["stem"].strip(), "",
                f"Căn cứ: {', '.join(f'`{c}`' for c in e['cards'])}", "", "| Tiêu chí | Điểm | Mức đạt |", "|---|---|---|"]
        out += [f"| {r['criterion']} | {r['max']:g} | {r['descriptor']} |" for r in e["rubric"]]
        out += ["", f"**Đáp án mẫu:** {e.get('model_answer', '').strip()}", ""]
    if not qs:
        out += ["> Câu hỏi luyện tập (2 câu / thẻ, loại theo bảng BA 17.6) chưa sinh — chạy "
                "`seed_sample_course.py` (không --dry-run) để dựng, rồi xuất lại file này.", ""]
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Bước d — phát hành + giao
# ---------------------------------------------------------------------------

def publish_and_assign(course: dict, user: dict, emails: list[str], log: Callable[[str], None] = print) -> dict:
    from .paths import AssignIn, assign_path, enroll_learner, publish_path
    p = sample_path(course)
    if p["status"] == "draft":
        publish_path(str(p["_id"]), user)
        log("✓ Đã phát hành lộ trình (ma trận đề rút đủ câu).")
    learning_paths.update_one({"_id": p["_id"]}, {"$set": {"is_sample": True, "open_enroll": True}})
    p = sample_path(course)
    due = vn_day_end(course.get("enroll_days", 28))
    res = enroll_learner(p, user, due)
    log(f"  · {user['name']}: {'đã ghi danh' if res['created'] else 'đã có trong khoá'}")
    others = [e.strip().lower() for e in emails if e.strip() and e.strip().lower() != user.get("email", "").lower()]
    if others:
        found = {u["email"].lower(): u for u in users.find({"email": {"$in": others}}, {"email": 1, "name": 1})}
        for e in others:
            if e not in found:
                log(f"  ⚠ không có tài khoản {e}")
        if found:
            r = assign_path(str(p["_id"]), AssignIn(learner_ids=[str(u["_id"]) for u in found.values()], due_at=due), user)
            for a in r["assigned"]:
                log(f"  · giao cho {a['name']}")
            for s in r["skipped"]:
                log(f"  · bỏ qua {s['name']}: {s['reason']}")
    return {"path_id": p["_id"], "due_at": due}


def reset(course: dict, log: Callable[[str], None] = print) -> None:
    """Xoá mọi bản ghi khoá mẫu (lộ trình, giao, lượt làm, bài học, câu hỏi) theo sample_key. Thẻ không đụng."""
    key = course["sample_key"]
    p = sample_path(course)
    if p:
        aids = assignments.distinct("_id", {"path_id": p["_id"]})
        n_att = attempts.delete_many({"assignment_id": {"$in": aids}}).deleted_count
        n_as = assignments.delete_many({"path_id": p["_id"]}).deleted_count
        learning_paths.delete_one({"_id": p["_id"]})
        log(f"reset: xoá lộ trình, {n_as} lượt giao, {n_att} lượt thi")
    lids = lessons.distinct("_id", {"sample_key": key})
    n_pr = attempts.delete_many({"lesson_id": {"$in": lids}}).deleted_count
    n_l = lessons.delete_many({"sample_key": key}).deleted_count
    n_q = questions.delete_many({"sample_key": key}).deleted_count
    log(f"reset: xoá {n_l} bài học, {n_q} câu hỏi, {n_pr} lượt luyện tập")


# ---------------------------------------------------------------------------
# Chạy cả chuỗi
# ---------------------------------------------------------------------------

def run(course: dict, user: dict | None, emails: list[str] | None = None, dry_run: bool = False,
        log: Callable[[str], None] = print, base_url: str = "", rewrite_narrative: bool = False) -> tuple[int, dict]:
    """a → b → c → d. Trả (mã thoát, trạng thái). dry_run: chỉ bước a + trạng thái, không ghi gì."""
    chk = check_cards(course)
    if chk["hard_error"]:
        return HARD_ERROR, {"check": chk}
    if chk["pending"]:
        return CARDS_PENDING, {"check": chk, "link": review_link(chk["pending"] + chk["reading_pending"], base_url)}
    if dry_run:
        return OK, {"check": chk, "status": status(course)}
    if user is None:
        raise ValueError("Cần tài khoản chạy seed (learn.author, sửa được kho org)")
    build(course, user, log, rewrite_narrative)
    draft = [str(q["_id"]) for q in questions.find({"sample_key": course["sample_key"], "status": {"$ne": "approved"}},
                                                  {"_id": 1})]
    if draft:
        return QUESTIONS_PENDING, {"check": chk, "questions_draft": draft, "link": questions_link(course, base_url)}
    info = publish_and_assign(course, user, emails or [], log)
    return OK, {"check": chk, **info}


def auto_seed() -> None:
    """Cờ khởi động SEED_SAMPLE_COURSE=1 (bước e): chạy b–d ở luồng nền nếu chưa có khoá mẫu phát hành và điều kiện
    đã đủ; không đủ thì chỉ ghi log. Người chạy: SEED_SAMPLE_AS (email), mặc định quản trị viên đầu tiên."""
    if not seed_sample_course():
        return

    def job():
        tag = "[khoá mẫu]"
        email = seed_sample_as()
        user = users.find_one({"email": email} if email else {"role": "admin", "active": True}, sort=[("_id", 1)])
        if not user:
            print(f"{tag} không có tài khoản chạy seed — bỏ qua")
            return
        for course in all_courses():
            try:
                p = sample_path(course)
                if p and p["status"] != "draft":
                    continue
                code, info = run(course, user, log=lambda m: print(f"{tag} {m}"))
                msg = {OK: "đã phát hành + ghi danh", CARDS_PENDING: f"chờ duyệt {len(info['check']['pending'])} thẻ",
                       QUESTIONS_PENDING: f"chờ duyệt {len(info.get('questions_draft', []))} câu hỏi",
                       HARD_ERROR: "lỗi dữ liệu thẻ (thiếu / C2 / C3 / ngoài kho org)"}[code]
                print(f"{tag} {course['sample_key']}: {msg}")
            except Exception as e:  # noqa: BLE001 — không bao giờ làm hỏng khởi động server
                print(f"{tag} {course['sample_key']} lỗi: {e}")

    threading.Thread(target=job, name="sample-course-seed", daemon=True).start()
