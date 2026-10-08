"""AI thiết kế lộ trình học theo prompt (docs/BA.md 17.5, LRN-04) + API sinh câu hỏi (17.6, LRN-02 phần AI) — luồng H.

Luồng: form 6 ô + prompt tự do → chọn thẻ ứng viên bằng code → AI xếp thành tuần → bài → thẻ → lưu bản nháp
`learning_paths` (status draft, `ai` giữ prompt + form + bản nháp AI để truy vết) → người thiết kế sửa trên
/learn/design → "Lưu nháp" dựng bài học nháp (`lessons`) + `modules` để luồng I phát hành / giao.

Chọn thẻ (code, không nhờ AI):
1. `approved`, không chờ xoá, không C3, loại thẻ tri thức (`wiki.CARD_TYPES` — thẻ AI skill / memory / context loại);
2. giao phạm vi xem của người thiết kế và MỌI người học (`policy.visible_to_all`, BA 15.7 quy tắc 4);
3. `division` khớp (thẻ `tap-doan` / chưa gắn luôn được);
4. thuộc nhánh bắt buộc (slug lĩnh vực — gồm nhánh con — hoặc chuỗi quy trình `qt.<chuỗi>`), không có thì theo mảng;
5. bậc nội dung (`level`) hợp: bậc người thiết kế chọn > bảng ánh xạ theo cấp bậc trong form (mảng của mình → own,
   mảng khác → other) > `policy.content_levels_for` của người học. Thẻ chưa gắn bậc chỉ dùng khi form cho phép.
Xếp: nhánh bắt buộc → `process_steps` (thẻ không gắn bước trước, rồi a → d) → bậc nhập môn → điều hành → loại thẻ
(concept → framework → sop / checklist → case_study → kpi → còn lại). Tối đa MAX_CANDIDATES thẻ gửi AI (AI local
context 4096 token). Báo thiếu tri thức theo nhánh + bậc bằng code; AI chỉ thêm chủ đề thiếu nó thấy từ prompt.
AI chỉ được trích thẻ trong danh sách (mã k1…kN hoặc card_id) — mã lạ bị bỏ và đếm ở `ai.dropped_ids`.
AI không chạy được (chưa có key, AI local chết, trả JSON lỗi) → nháp dựng bằng code (nhóm thẻ theo tuần),
`ai.engine = "code"`, `ai.no_ai_reason` nêu lý do.
"""

from __future__ import annotations

import math
import re
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import categories as cat_mod
from .. import db, org, policy
from ..auth import current_user, users
from ..kb import classify
from ..kb.wiki import CARD_TYPES
from . import generate
from .models import DEFAULT_PASS_SCORE, learning_paths, lessons
from .routes import lesson_classification, oid, oids, owner_unit, plain, require_author, target_space

router = APIRouter(prefix="/api/learn")

cards = db.db["wiki_cards"]

MAX_CANDIDATES = 40
MAX_BRANCHES = 3
MAX_GAPS = 30
LEVEL_ORDER = ["nhap-mon", "thuc-thi", "van-hanh", "thiet-ke", "dieu-hanh"]
TYPE_ORDER = {"concept": 0, "framework": 1, "sop": 2, "checklist": 2, "case_study": 3, "kpi": 4}
DESIGN_TYPES = list(CARD_TYPES)      # thẻ tri thức; thẻ AI (skill / memory / context) không vào lộ trình
CHAIN_RE = re.compile(r"^qt\.[a-z0-9-]+(\.[a-d])?$")
CARD_PROJ = {"title": 1, "summary": 1, "type": 1, "level": 1, "division": 1, "process_steps": 1, "categories": 1,
             "current_revision": 1, "classification": 1, "space_id": 1}


# ---------------------------------------------------------------------------
# Form 6 ô (BA 17.5)
# ---------------------------------------------------------------------------

class DesignForm(BaseModel):
    # (1) đối tượng
    level: int | None = Field(None, ge=1, le=7, description="Cấp bậc người học 1–7")
    area: str | None = Field(None, max_length=200, description="Mảng của người học: slug gốc cây lĩnh vực")
    division: str | None = None
    content_levels: list[str] = Field(default_factory=list, description="Bậc nội dung người thiết kế chọn (ghi đè)")
    include_unleveled: bool = False
    # (2) mục tiêu
    goal: str = Field("", max_length=1000)
    # (3) thời lượng
    period: Literal["month", "year"] = "month"
    year: int | None = Field(None, ge=2000, le=2100)
    month: int | None = Field(None, ge=1, le=12)
    # (4) giờ học mỗi tuần
    hours_per_week: float | None = Field(None, ge=0, le=60)
    # (5) nhánh bắt buộc
    branches: list[str] = Field(default_factory=list, max_length=MAX_BRANCHES)
    # (6) cách đánh giá
    assessment: str = Field("", max_length=1000)
    pass_score: int | None = Field(None, ge=0, le=100)


class DesignIn(BaseModel):
    prompt: str = Field("", max_length=4000)
    learners: list[str] = Field(default_factory=list, max_length=200)
    form: DesignForm = Field(default_factory=DesignForm)
    title: str | None = Field(None, max_length=200)
    form_in_prompt: bool = False     # true: `prompt` đã gồm phần ghép từ form (trang /learn/design), không ghép lại


def check_form(form: DesignForm) -> DesignForm:
    if form.division and form.division not in classify.DIVISIONS:
        raise HTTPException(400, f"Division “{form.division}” không hợp lệ — chọn trong "
                                 f"{', '.join(classify.DIVISIONS)}")
    if bad := [lv for lv in form.content_levels if lv not in classify.LEVELS]:
        raise HTTPException(400, f"Bậc nội dung không hợp lệ: {', '.join(bad)}")
    branches = [b.strip() for b in dict.fromkeys(form.branches) if b and b.strip()]
    for b in branches:
        if b.startswith("qt."):
            if not CHAIN_RE.match(b):
                raise HTTPException(400, f"Chuỗi quy trình “{b}” sai dạng — qt.<chuỗi> hoặc qt.<chuỗi>.<a|b|c|d>")
        elif not cat_mod.categories.find_one({"slug": b}, {"_id": 1}):
            raise HTTPException(400, f"Nhánh “{b}” không có trong cây lĩnh vực")
    if form.area and not cat_mod.categories.find_one({"slug": form.area}, {"_id": 1}):
        raise HTTPException(400, f"Mảng “{form.area}” không có trong cây lĩnh vực")
    return form.model_copy(update={"branches": branches})


def compose_prompt(form: DesignForm, learner_names: list[str] | None = None) -> str:
    """Ghép form 6 ô thành prompt (trang /learn/design ghép sẵn ở FE; MCP / API không gửi prompt thì dùng hàm này)."""
    lines = []
    who = []
    if form.level:
        who.append(f"cấp {form.level} {org.LEVEL_NAMES.get(form.level, '')}".strip())
    if form.area:
        who.append(f"mảng {form.area}")
    if form.division:
        who.append(f"division {classify.DIVISIONS.get(form.division, form.division)}")
    if learner_names:
        who.append("người học: " + ", ".join(learner_names[:10]))
    if who:
        lines.append("Đối tượng: " + "; ".join(who))
    if form.goal:
        lines.append("Mục tiêu sau kỳ: " + form.goal)
    lines.append("Thời lượng: " + ("1 năm (12 chủ đề tháng)" if form.period == "year" else "1 tháng (4 tuần)"))
    if form.hours_per_week:
        lines.append(f"Số giờ học mỗi tuần: {form.hours_per_week:g}")
    if form.branches:
        lines.append("Nhánh bắt buộc: " + ", ".join(form.branches))
    if form.assessment or form.pass_score is not None:
        lines.append("Đánh giá: " + (form.assessment or "thi cuối kỳ")
                     + (f", điểm đạt {form.pass_score}" if form.pass_score is not None else ""))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Chọn + xếp thẻ
# ---------------------------------------------------------------------------

def card_roots(card: dict) -> set[str]:
    return {s.split(".")[0] for s in card.get("categories") or []}


def level_rule(form: DesignForm, learners: list[dict]):
    """Trả (hàm roots -> tập bậc hợp | None (không lọc), mô tả nguồn bậc)."""
    if form.content_levels:
        fixed = set(form.content_levels)
        return (lambda roots: fixed), "bậc người thiết kế chọn"
    if form.level:
        entry = org.level_map().get(form.level) or {}
        own, other = set(entry.get("own") or []), set(entry.get("other") or [])
        area = form.area

        def by_level(roots: set[str]) -> set[str]:
            if not roots:
                return own | other
            return set().union(*[own if area and r == area else other for r in roots])
        return by_level, f"bảng ánh xạ cấp {form.level} ({org.LEVEL_NAMES.get(form.level)})"
    if learners and any(org.user_org(p)["level"] for p in learners):
        def by_learners(roots: set[str]) -> set[str]:
            out: set[str] = set()
            for p in learners:
                for r in roots or {None}:
                    out |= set(policy.content_levels_for(p, r))
            return out
        return by_learners, "cấp bậc của người học (policy.content_levels_for)"
    return (lambda roots: None), None


def branch_filter(form: DesignForm) -> tuple[dict, list[tuple[str, dict]]]:
    """Điều kiện Mongo cho nhánh bắt buộc (hoặc mảng) + danh sách (nhánh, điều kiện riêng) để xếp theo nhánh."""
    parts = []
    for b in form.branches or ([form.area] if form.area else []):
        if b.startswith("qt."):
            cond = {"process_steps": {"$regex": "^" + re.escape(b) + (r"(\.|$)" if b.count(".") == 1 else "$")}}
        else:
            cond = {"categories": {"$in": cat_mod.with_descendants(b)}}
        parts.append((b, cond))
    return ({"$or": [c for _, c in parts]} if parts else {}), parts


def base_filter(form: DesignForm) -> dict:
    """Điều kiện chung (trừ phạm vi xem, nhánh, bậc)."""
    f: dict = {"status": "approved", "delete_requested": {"$ne": True}, "classification": {"$ne": "C3"},
               "type": {"$in": DESIGN_TYPES}}
    if form.division:
        f["$or"] = [{"division": {"$in": [form.division, "tap-doan"]}}, {"division": {"$exists": False}},
                    {"division": None}, {"division": []}]
    return f


def matches(card: dict, cond: dict) -> bool:
    """Đánh giá lại điều kiện nhánh trên bản ghi thẻ đã lấy về (để biết thẻ thuộc nhánh nào)."""
    if "categories" in cond:
        return bool(set(card.get("categories") or []) & set(cond["categories"]["$in"]))
    rx = re.compile(cond["process_steps"]["$regex"])
    return any(rx.match(s) for s in card.get("process_steps") or [])


def sort_key(card: dict, branch_idx: int) -> tuple:
    steps = [s.rsplit(".", 1)[-1] for s in card.get("process_steps") or []]
    step = min(("abcd".index(s) for s in steps if s in "abcd" and len(s) == 1), default=-1)
    lv = LEVEL_ORDER.index(card["level"]) if card.get("level") in LEVEL_ORDER else len(LEVEL_ORDER)
    return (branch_idx, step, lv, TYPE_ORDER.get(card.get("type"), 5), (card.get("title") or "").lower())


def select_cards(designer: dict, learners: list[dict], form: DesignForm, channel: str = "web") -> dict:
    """Chọn + xếp thẻ ứng viên. Trả {cards (đã xếp, ≤ MAX_CANDIDATES), total, gaps, notes, levels_source}."""
    bfilter, parts = branch_filter(form)
    scope = [policy.visible_filter(designer, "card", channel)]
    if learners:
        scope.append(policy.visible_to_all([designer, *learners], "card"))
    f = {"$and": [*scope, base_filter(form), *([bfilter] if bfilter else [])]}
    rows = list(cards.find(f, CARD_PROJ).limit(2000))
    allowed, source = level_rule(form, learners)
    notes = []
    kept, unleveled = [], 0
    for c in rows:
        ok_levels = allowed(card_roots(c))
        if ok_levels is None:
            kept.append(c)
        elif not c.get("level"):
            unleveled += 1
            if form.include_unleveled:
                kept.append(c)
        elif c["level"] in ok_levels:
            kept.append(c)
    if unleveled:
        notes.append(f"{unleveled} thẻ chưa gắn bậc nội dung — "
                     + ("đã dùng (form cho phép)" if form.include_unleveled else "bị bỏ qua (bật “Dùng cả thẻ chưa gắn "
                                                                                 "bậc” để dùng)"))
    if source is None:
        notes.append("Chưa chọn cấp bậc / bậc nội dung — không lọc theo bậc")
    if learners:
        # thẻ người thiết kế xem được nhưng có người học không xem được: loại (15.7 quy tắc 4), chỉ báo số lượng
        mine = cards.count_documents({"$and": [scope[0], base_filter(form), *([bfilter] if bfilter else [])]})
        if hidden := mine - len(rows):
            notes.append(f"{hidden} thẻ bị loại vì có người học không xem được (quy tắc giao phạm vi xem)")

    def branch_of(c: dict) -> int:
        return next((i for i, (_, cond) in enumerate(parts) if matches(c, cond)), len(parts))
    kept.sort(key=lambda c: sort_key(c, branch_of(c)))
    gaps = find_gaps(kept, parts, allowed)
    if len(kept) > MAX_CANDIDATES:
        notes.append(f"Có {len(kept)} thẻ hợp lệ — gửi AI {MAX_CANDIDATES} thẻ đầu theo thứ tự xếp; thu hẹp nhánh "
                     "để chọn kỹ hơn")
    return {"cards": kept[:MAX_CANDIDATES], "total": len(kept), "gaps": gaps, "notes": notes,
            "levels_source": source}


def node_label(slug: str, cat: dict | None = None) -> str:
    cat = cat or cat_mod.categories.find_one({"slug": slug}, {"name": 1, "code": 1}) or {}
    name = cat.get("name") or slug
    return f"{cat['code']} {name}" if cat.get("code") else name


def find_gaps(kept: list[dict], parts: list[tuple[str, dict]], allowed) -> list[dict]:
    """Thiếu tri thức theo nhánh (node) + bậc (BA 17.5 mục 3). Nhánh lĩnh vực: xét từng nhánh con trực tiếp (lá thì
    chính nó); chuỗi quy trình: từng bước a–d. Mỗi node × mỗi bậc hợp mà không có thẻ nào → một dòng thiếu."""
    gaps: list[dict] = []
    for b, _ in parts:
        if b.startswith("qt."):
            nodes = [(f"{b}.{s}", {"process_steps": {"$regex": "^" + re.escape(f"{b}.{s}") + "$"}},
                      f"{classify.PROCESS_CHAINS.get(b[3:], b)} — bước {s}") for s in "abcd"] \
                if b.count(".") == 1 else [(b, {"process_steps": {"$regex": "^" + re.escape(b) + "$"}}, b)]
            roots: set[str] = set()
        else:
            parent = cat_mod.categories.find_one({"slug": b}, {"_id": 1}) or {}
            children = list(cat_mod.categories.find({"parent_id": parent.get("_id"), "active": True},
                                                    {"slug": 1, "name": 1, "code": 1}).sort("order", 1))
            nodes = [(c["slug"], {"categories": {"$in": cat_mod.with_descendants(c["slug"])}}, node_label(c["slug"], c))
                     for c in children] or [(b, {"categories": {"$in": cat_mod.with_descendants(b)}}, node_label(b))]
            roots = {b.split(".")[0]}
        levels = allowed(roots)
        for slug, cond, label in nodes:
            here = [c for c in kept if matches(c, cond)]
            if levels is None:
                if not here:
                    gaps.append({"node": slug, "topic": label, "level": None, "reason": "chưa có thẻ đã duyệt nào"})
                continue
            have = {c.get("level") for c in here}
            for lv in [x for x in LEVEL_ORDER if x in levels]:
                if lv not in have:
                    gaps.append({"node": slug, "topic": label, "level": lv,
                                 "reason": f"thiếu thẻ bậc {classify.LEVELS[lv].split(' — ')[0]}"})
    for g in gaps:
        g["source"] = "code"
    return gaps[:MAX_GAPS]


# ---------------------------------------------------------------------------
# AI dựng bản nháp
# ---------------------------------------------------------------------------

SYSTEM = """Bạn là chuyên gia L&D của tập đoàn VC Phồn Vinh, thiết kế lộ trình học từ thẻ tri thức VCWIKI đã duyệt.
Quy tắc bắt buộc:
- CHỈ dùng thẻ trong danh sách, trích bằng mã (k1, k2…). Không tự viết kiến thức, không dùng mã khác.
- Giữ thứ tự thẻ trong danh sách (đã xếp theo bước quy trình rồi bậc nội dung) khi chia bài.
- Mỗi bài 1–4 thẻ, có tiêu đề, 1–3 mục tiêu đo được, narrative ngắn nối các thẻ, practice: 1–2 gợi ý câu luyện tập.
- Chủ đề prompt yêu cầu mà không có thẻ: ghi vào gaps {topic, reason} ("thiếu tri thức"), không viết nội dung thay.
- exam: blueprint (ma trận đề ngắn), duration_min, pass_score (0–100).
Trả JSON đúng schema, tiếng Việt, ngắn gọn."""


def plan_schema() -> dict:
    s = {"type": "string"}
    lesson = {"type": "object", "properties": {
        "title": s, "objectives": {"type": "array", "items": s}, "cards": {"type": "array", "items": s},
        "narrative": s, "practice": {"type": "array", "items": s}},
        "required": ["title", "objectives", "cards", "narrative", "practice"], "additionalProperties": False}
    return {"type": "object", "properties": {
        "title": s,
        "weeks": {"type": "array", "items": {"type": "object", "properties": {
            "week": {"type": "integer"}, "lessons": {"type": "array", "items": lesson}},
            "required": ["week", "lessons"], "additionalProperties": False}},
        "exam": {"type": "object", "properties": {"blueprint": s, "duration_min": {"type": "integer"},
                                                  "pass_score": {"type": "integer"}},
                 "required": ["blueprint", "duration_min", "pass_score"], "additionalProperties": False},
        "gaps": {"type": "array", "items": {"type": "object", "properties": {"topic": s, "reason": s},
                                            "required": ["topic", "reason"], "additionalProperties": False}}},
        "required": ["title", "weeks", "exam", "gaps"], "additionalProperties": False}


def units_of(form: DesignForm) -> int:
    return 12 if form.period == "year" else 4


def card_line(code: str, c: dict) -> str:
    steps = ",".join(c.get("process_steps") or []) or "-"
    summary = (c.get("summary") or "").replace("\n", " ")[:90]
    return f"{code} | {c.get('level') or '-'} | {c.get('type')} | {steps} | {c.get('title', '')[:90]} — {summary}"


def code_plan(form: DesignForm, picked: list[dict], title: str) -> dict:
    """Nháp dựng bằng code khi không có AI (và là engine giả cho test / e2e): chia thẻ đã xếp đều cho các tuần."""
    n_units = units_of(form)
    per_unit = max(1, min(3, round((form.hours_per_week or 4) / 2)))
    per_lesson = max(1, min(4, math.ceil(len(picked) / (n_units * per_unit)))) if picked else 1
    groups = [picked[i:i + per_lesson] for i in range(0, len(picked), per_lesson)]
    weeks = [{"week": w + 1, "lessons": []} for w in range(n_units)]
    for i, g in enumerate(groups):
        w = min(n_units - 1, i * n_units // max(1, len(groups)))
        weeks[w]["lessons"].append({
            "title": g[0].get("title") or f"Bài {i + 1}", "objectives": [f"Nắm được: {c.get('title')}" for c in g][:3],
            "cards": [str(c["_id"]) for c in g], "narrative": "", "practice": []})
    return {"title": title, "weeks": weeks,
            "exam": {"blueprint": form.assessment or "Thi cuối kỳ trắc nghiệm theo các thẻ đã học",
                     "duration_min": 45,
                     "pass_score": form.pass_score if form.pass_score is not None else DEFAULT_PASS_SCORE},
            "gaps": []}


def normalize_plan(raw: dict, form: DesignForm, picked: list[dict], codes: dict[str, ObjectId]) -> tuple[dict, list]:
    """Đưa JSON AI về schema BA 17.5 với thẻ thật: mã lạ bị bỏ (trả danh sách), bài không còn thẻ bị bỏ,
    mỗi thẻ chỉ dùng một lần, tuần ngoài 1..N dồn về tuần gần nhất."""
    by_id = {c["_id"]: c for c in picked}
    ids = {str(i): i for i in by_id}
    n_units = units_of(form)
    dropped, used = [], set()
    weeks = {w: [] for w in range(1, n_units + 1)}
    for wk in raw.get("weeks") or []:
        try:
            w = min(n_units, max(1, int(wk.get("week") or 1)))
        except (TypeError, ValueError):
            w = 1
        for les in wk.get("lessons") or []:
            refs = []
            for ref in les.get("cards") or []:
                key = str(ref.get("card_id") if isinstance(ref, dict) else ref).strip()
                cid = codes.get(key.lower()) or ids.get(key)
                if not cid:
                    dropped.append(key[:60])
                    continue
                if cid in used:
                    continue
                used.add(cid)
                refs.append({"card_id": cid, "rev": by_id[cid].get("current_revision") or 1})
            if not refs:
                continue
            weeks[w].append({"title": str(les.get("title") or "Bài học")[:200],
                             "objectives": [str(o)[:300] for o in les.get("objectives") or [] if o][:5],
                             "cards": refs, "narrative": str(les.get("narrative") or "")[:5000],
                             "practice": [str(p)[:500] for p in les.get("practice") or [] if p][:5]})
    exam = raw.get("exam") or {}
    return {"title": str(raw.get("title") or "")[:200],
            "weeks": [{"week": w, "lessons": ls} for w, ls in weeks.items()],
            "exam": {"blueprint": str(exam.get("blueprint") or "")[:2000],
                     "duration_min": int(exam.get("duration_min") or 45),
                     "pass_score": _pass_score(exam.get("pass_score"), form.pass_score)},
            "gaps": [{"topic": str(g.get("topic") or "")[:300], "reason": str(g.get("reason") or "")[:300],
                      "source": "ai"} for g in raw.get("gaps") or [] if g.get("topic")][:MAX_GAPS]}, dropped


def build_draft(designer: dict, learners: list[dict], form: DesignForm, prompt: str, title: str | None,
                channel: str = "web", form_in_prompt: bool = False) -> dict:
    """Chọn thẻ + gọi AI (hoặc nháp bằng code) → bản ghi learning_paths nháp đã lưu."""
    form = check_form(form)
    names = [p["name"] for p in learners]
    head = "" if form_in_prompt and prompt.strip() else compose_prompt(form, names)
    full_prompt = "\n\n".join(x for x in (head, prompt.strip()) if x)
    sel = select_cards(designer, learners, form, channel)
    picked = sel["cards"]
    default_title = title or (form.goal[:120] if form.goal else "Lộ trình học")
    codes = {f"k{i + 1}": c["_id"] for i, c in enumerate(picked)}
    engine, reason = "code", None
    raw = None
    if picked:
        text = (f"{full_prompt}\n\nSố {'tháng' if form.period == 'year' else 'tuần'}: {units_of(form)}.\n"
                "Thẻ được dùng (mã | bậc | loại | bước quy trình | tiêu đề — tóm tắt):\n"
                + "\n".join(card_line(k, c) for k, c in zip(codes, picked)))
        fake = lambda: code_plan(form, picked, default_title)     # noqa: E731
        try:
            raw, engine = generate.ai_call(SYSTEM, text, plan_schema(), fake, max_tokens=4000)
        except Exception as e:   # AI không sẵn sàng / lỗi / JSON hỏng → nháp bằng code, ghi rõ lý do
            reason = generate.ai_error_message(e)
    else:
        reason = "Không có thẻ nào hợp điều kiện — không gọi AI"
    if raw is None:
        raw = code_plan(form, picked, default_title)
    plan, dropped = normalize_plan(raw, form, picked, codes)
    if picked and not any(w["lessons"] for w in plan["weeks"]):
        # AI trả toàn mã lạ / bài rỗng → dựng lại bằng code để người thiết kế còn có cái sửa
        plan, _ = normalize_plan(code_plan(form, picked, default_title), form, picked, codes)
        if engine != "code":
            reason = reason or "AI không trích được thẻ hợp lệ nào — nháp dựng bằng code"
            engine = f"code (AI {engine} trả nháp rỗng)"
    plan["title"] = title or plan["title"] or default_title
    plan["gaps"] = sel["gaps"] + plan["gaps"]
    now = db.now()
    today = now.date()
    doc = {"title": plan["title"], "period": form.period, "year": form.year or today.year,
           "month": (form.month or today.month) if form.period == "month" else None,
           "owner_id": designer["_id"], "owner_unit_id": owner_unit(designer), "parent_path_id": None,
           "required_items": [], "modules": [], "exam": stored_exam(plan["exam"]), "status": "draft",
           "ai": {"prompt": full_prompt, "user_prompt": prompt, "form": form.model_dump(), "engine": engine,
                  "no_ai_reason": reason, "original": plan, "plan": plan, "gaps": plan["gaps"],
                  "notes": sel["notes"], "levels_source": sel["levels_source"], "candidate_total": sel["total"],
                  "candidate_ids": [c["_id"] for c in picked], "dropped_ids": dropped,
                  "learner_ids": [p["_id"] for p in learners], "lesson_ids": [], "channel": channel,
                  "created_at": now},
           "created_by": designer["_id"], "created_at": now, "updated_at": now}
    doc["_id"] = learning_paths.insert_one(doc).inserted_id
    return doc


# ---------------------------------------------------------------------------
# Lưu bản đã sửa → bài học nháp + modules
# ---------------------------------------------------------------------------

class CardRefIn(BaseModel):
    card_id: str


class LessonPlanIn(BaseModel):
    lesson_id: str | None = None     # bài học nháp đã dựng ở lần lưu trước — cập nhật tại chỗ, giữ câu luyện tập
    title: str = Field(min_length=1, max_length=200)
    objectives: list[str] = Field(default_factory=list, max_length=10)
    narrative: str = Field("", max_length=20000)
    practice: list[str] = Field(default_factory=list, max_length=10)
    cards: list[CardRefIn] = Field(min_length=1, max_length=20)


def _pass_score(*candidates) -> int:
    """Điểm đạt (%): giá trị hợp lệ đầu tiên trong `candidates` (AI / form / đã lưu), kẹp 0–100; không có → 70."""
    for v in candidates:
        try:
            if v is not None and v != "":
                return max(0, min(100, int(float(v))))
        except (TypeError, ValueError):
            continue
    return DEFAULT_PASS_SCORE


def stored_exam(plan_exam: dict, current: dict | None = None) -> dict:
    """Bài thi của lộ trình lưu theo BA mục 7: `blueprint` là danh sách dòng ma trận [{category, difficulty, kind,
    count}] (luồng I điền trên màn lộ trình); mô tả chữ của AI / người thiết kế để ở `blueprint_note`. Lưu lại ở màn
    thiết kế không đè ma trận, số lượt thi, phạm vi đề đã điền ở màn lộ trình."""
    cur = current or {}
    rows = cur.get("blueprint") if isinstance(cur.get("blueprint"), list) else []
    return {k: v for k, v in cur.items() if k not in ("blueprint", "blueprint_note")} | {
        "blueprint": rows, "blueprint_note": str(plan_exam.get("blueprint") or "")[:2000],
        "duration_min": plan_exam.get("duration_min") or cur.get("duration_min") or 45,
        "pass_score": _pass_score(plan_exam.get("pass_score"), cur.get("pass_score")),
        "attempts": cur.get("attempts", 1)}


class WeekIn(BaseModel):
    week: int = Field(ge=1, le=12)
    lessons: list[LessonPlanIn] = Field(default_factory=list, max_length=10)


class ExamIn(BaseModel):
    blueprint: str = Field("", max_length=2000)
    duration_min: int = Field(45, ge=1, le=600)
    pass_score: int = Field(DEFAULT_PASS_SCORE, ge=0, le=100)


class PlanIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    weeks: list[WeekIn] = Field(max_length=12)
    exam: ExamIn = Field(default_factory=ExamIn)
    space_id: str | None = None
    # true: ghi đè cả phần đã sửa ở màn Lộ trình (tuần / bài thêm tay, hạn tuần, bài thi đã tắt) — người dùng chọn rõ
    overwrite: bool = False


def load_draft(path_id: str, user: dict) -> dict:
    path = learning_paths.find_one({"_id": oid(path_id, "lộ trình"), "ai": {"$ne": None}})
    if not path or path.get("owner_id") != user["_id"]:
        raise HTTPException(404, "Không tìm thấy bản nháp lộ trình")
    return path


def learners_of(path: dict) -> list[dict]:
    ids = (path.get("ai") or {}).get("learner_ids") or []
    return list(users.find({"_id": {"$in": ids}})) if ids else []


def usable_cards(user: dict, learners: list[dict], ids: list[ObjectId]) -> dict[ObjectId, dict]:
    """Thẻ người thiết kế được đưa vào lộ trình khi sửa tay: đã duyệt, không C3, trong giao phạm vi xem."""
    scope = [policy.visible_to_all([user, *learners])] if learners else []
    f = {"$and": [policy.visible_filter(user, "card"), *scope,
                  {"_id": {"$in": ids}, "status": "approved", "delete_requested": {"$ne": True},
                   "classification": {"$ne": "C3"}}]}
    return {c["_id"]: c for c in cards.find(f, CARD_PROJ)}


def unusable_reason(c: dict) -> str:
    """Vì sao một thẻ người thiết kế xem được lại không dùng được trong lộ trình (QA vòng 2, L12)."""
    if policy.effective_classification(c) == "C3":
        return "mật C3"
    if c.get("status") != "approved":
        return "chưa duyệt"
    if c.get("delete_requested"):
        return "đang chờ xoá"
    return "có người học không xem được"


def unusable_message(user: dict, missing: list[ObjectId]) -> str:
    """Câu lỗi khi lưu: nêu tên thẻ + lý do (thẻ người thiết kế không xem được thì chỉ đếm)."""
    seen = {c["_id"]: c for c in cards.find(policy.visible_filter(user, "card") | {"_id": {"$in": missing}},
                                            {"title": 1, "status": 1, "classification": 1, "delete_requested": 1})}
    parts = [f"“{seen[i].get('title') or i}” ({unusable_reason(seen[i])})" for i in missing if i in seen]
    if hidden := len(missing) - len(parts):
        parts.append(f"{hidden} thẻ không tồn tại hoặc bạn không xem được")
    return f"Có {len(missing)} thẻ không dùng được: " + "; ".join(parts) + " — bỏ thẻ khỏi bài rồi lưu lại"


def merge_modules(old_mods: list[dict], plan_mods: dict[int, list], ai_ids: set, keep: set,
                  overwrite: bool) -> list[dict]:
    """Ghép tuần: bài AI xếp theo bản thiết kế; bài thêm tay ở màn Lộ trình (không thuộc `ai_ids`) giữ nguyên tuần,
    chủ đề + hạn tuần giữ nguyên. `overwrite`: bỏ bài thêm tay / chủ đề / hạn — chỉ giữ bài trong `keep`
    (bắt buộc của khung, không được bỏ)."""
    by_week: dict[int, dict] = {}
    for m in old_mods or []:
        ids = [i for i in m.get("lesson_ids") or [] if i not in ai_ids and (not overwrite or i in keep)]
        cur = by_week.setdefault(m["week"], {"title": "", "due_at": None, "lesson_ids": []})
        cur["lesson_ids"] += ids
        if not overwrite:
            cur["title"] = cur["title"] or m.get("title") or ""
            cur["due_at"] = cur["due_at"] or m.get("due_at")
    out = []
    for wk in sorted(set(by_week) | set(plan_mods)):
        old = by_week.get(wk) or {}
        ids = list(dict.fromkeys([*plan_mods.get(wk, []), *(old.get("lesson_ids") or [])]))
        if ids or old.get("title") or old.get("due_at"):
            out.append({"week": wk, "title": old.get("title") or "", "lesson_ids": ids, "due_at": old.get("due_at")})
    return out


def save_plan(path: dict, body: PlanIn, user: dict) -> tuple[dict, list[str]]:
    """Lưu bản đã sửa ở màn thiết kế. Màn này chỉ quản lý bài học AI (`ai.lesson_ids`) — cập nhật bài nháp tại chỗ
    (giữ câu luyện tập đã gắn), không đè phần đã sửa ở màn Lộ trình (bài / tuần thêm tay, chủ đề + hạn tuần, bài thi
    đã tắt) trừ khi `overwrite`; mục bắt buộc trỏ bài không còn thì bỏ kèm thông báo (QA vòng 2, L2).
    Trả (lộ trình mới, thông báo cho người dùng)."""
    if path["status"] != "draft":
        raise HTTPException(409, "Lộ trình đã phát hành — không sửa bản nháp AI được nữa")
    learners = learners_of(path)
    all_ids = oids([r.card_id for w in body.weeks for ls in w.lessons for r in ls.cards], "thẻ")
    found = usable_cards(user, learners, all_ids)
    if missing := [i for i in all_ids if i not in found]:
        raise HTTPException(400, unusable_message(user, missing))
    ai = path["ai"]
    old_revs = {r["card_id"]: r["rev"] for w in (ai.get("plan") or {}).get("weeks") or []
                for ls in w["lessons"] for r in ls["cards"]}
    space = target_space(user, body.space_id)
    old_ai_ids = list(ai.get("lesson_ids") or [])
    old_ai = {x["_id"]: x for x in lessons.find({"_id": {"$in": old_ai_ids}})}
    edited = bool(ai.get("edited_in_paths_at"))
    now = db.now()
    weeks, plan_mods, lesson_ids, notices = [], {}, [], []
    for w in sorted(body.weeks, key=lambda x: x.week):
        out_lessons, ids = [], []
        for ls in w.lessons:
            refs = [{"card_id": ObjectId(r.card_id), "rev": old_revs.get(ObjectId(r.card_id))
                     or found[ObjectId(r.card_id)].get("current_revision") or 1} for r in ls.cards]
            narrative = ls.narrative
            if ls.practice:
                narrative += "\n\n### Gợi ý luyện tập\n" + "\n".join(f"- {p}" for p in ls.practice)
            content = {"title": ls.title.strip(), "objectives": [o.strip() for o in ls.objectives if o.strip()],
                       "narrative": narrative.strip(), "items": refs, "space_id": space["_id"], "updated_at": now}
            lid = ObjectId(ls.lesson_id) if ls.lesson_id and ObjectId.is_valid(ls.lesson_id) else None
            cur = old_ai.get(lid)
            if cur and cur["status"] == "draft" and cur.get("created_by") == user["_id"] and lid not in lesson_ids:
                # cập nhật tại chỗ: giữ practice_question_ids (câu luyện tập gắn ở Thư viện)
                content["classification"] = lesson_classification(refs, cur.get("practice_question_ids") or [])
                lessons.update_one({"_id": lid, "status": "draft"}, {"$set": content})
            else:
                doc = content | {"practice_question_ids": [], "owner_unit_id": owner_unit(user), "status": "draft",
                                 "created_by": user["_id"],
                                 "classification": policy.inherit_classification([found[r["card_id"]] for r in refs]),
                                 # str: lesson_out (luồng E) trả thẳng trường `ai` ra JSON
                                 "ai": {"path_id": str(path["_id"]), "engine": ai.get("engine")}, "created_at": now}
                lid = lessons.insert_one(doc).inserted_id
            ids.append(lid)
            out_lessons.append({"title": content["title"], "objectives": content["objectives"],
                                "narrative": ls.narrative, "practice": ls.practice, "cards": refs, "lesson_id": lid})
        weeks.append({"week": w.week, "lessons": out_lessons})
        if ids:
            plan_mods[w.week] = ids
            lesson_ids += ids
    # bài AI người thiết kế đã bỏ: xoá (chỉ bài còn nháp, do chính người này tạo)
    gone = [i for i in old_ai_ids if i not in lesson_ids]
    lessons.delete_many({"_id": {"$in": gone}, "status": "draft", "created_by": user["_id"]})
    parent = learning_paths.find_one({"_id": path["parent_path_id"]}, {"required_items": 1}) \
        if path.get("parent_path_id") else None
    keep = set((parent or {}).get("required_items") or [])
    ai_ids = set(old_ai_ids) | set(lesson_ids)
    modules = merge_modules(path.get("modules") or [], plan_mods, ai_ids, keep, body.overwrite)
    manual = [i for m in modules for i in m["lesson_ids"] if i not in ai_ids]
    if manual and not body.overwrite:
        notices.append(f"Giữ {len(manual)} bài thêm ở màn Lộ trình (cùng chủ đề / hạn tuần đã đặt ở đó)")
    final = {i for m in modules for i in m["lesson_ids"]}
    required = [i for i in path.get("required_items") or [] if i in final]
    if dropped := [i for i in path.get("required_items") or [] if i not in final]:
        titles = {x["_id"]: x["title"] for x in lessons.find({"_id": {"$in": dropped}}, {"title": 1})}
        names = [titles.get(i) or (old_ai.get(i) or {}).get("title") for i in dropped]
        names = [n for n in names if n]
        notices.append("Bỏ khỏi mục bắt buộc (bài không còn trong lộ trình): "
                       + (", ".join(names) or f"{len(dropped)} bài đã xoá"))
    plan = {"title": body.title.strip(), "weeks": weeks, "exam": body.exam.model_dump(),
            "gaps": ai.get("gaps") or []}
    upd = {"title": plan["title"], "modules": modules, "required_items": required,
           "ai.plan": plan, "ai.lesson_ids": lesson_ids, "ai.space_id": space["_id"], "ai.saved_at": now,
           "updated_at": now}
    if path.get("exam") or not edited or body.overwrite:
        upd["exam"] = stored_exam(body.exam.model_dump(), path.get("exam"))
    else:
        notices.append("Bài thi đã tắt ở màn Lộ trình — giữ nguyên (chọn “Ghi đè” để bật lại theo bản thiết kế)")
    unset = {}
    if body.overwrite and edited:
        unset["ai.edited_in_paths_at"] = ""
        notices.append("Đã ghi đè phần sửa ở màn Lộ trình theo bản thiết kế")
    new = learning_paths.find_one_and_update({"_id": path["_id"], "status": "draft"},
                                             {"$set": upd} | ({"$unset": unset} if unset else {}),
                                             return_document=True)
    return new or path, notices


# ---------------------------------------------------------------------------
# Trả về cho FE / MCP
# ---------------------------------------------------------------------------

def draft_out(path: dict, user: dict) -> dict:
    ai = path.get("ai") or {}
    plan = ai.get("plan") or {}
    ids = [r["card_id"] for w in plan.get("weeks") or [] for ls in w["lessons"] for r in ls["cards"]]
    cmap = {c["_id"]: c for c in cards.find({"_id": {"$in": ids}}, CARD_PROJ | {"status": 1, "delete_requested": 1})}
    learners = learners_of(path)
    # thẻ không còn dùng được (bỏ duyệt, nâng C3, người học không còn xem được…) — đánh dấu + lý do (L12)
    usable = set(usable_cards(user, learners, ids)) if ids else set()

    def ref_out(r: dict) -> dict:
        c = cmap.get(r["card_id"]) or {}
        bad = r["card_id"] not in usable
        return {"card_id": str(r["card_id"]), "rev": r["rev"], "title": c.get("title"), "type": c.get("type"),
                "level": c.get("level"), "process_steps": c.get("process_steps") or [],
                "current_rev": c.get("current_revision") or 1,
                "outdated": (c.get("current_revision") or 1) != r["rev"], "unavailable": bad,
                "unavailable_reason": (unusable_reason(c) if c else "không còn thẻ") if bad else None,
                "c3": bool(c) and policy.effective_classification(c) == "C3"}

    weeks = [{"week": w["week"], "lessons": [{**{k: plain(v) for k, v in ls.items() if k != "cards"},
                                              "cards": [ref_out(r) for r in ls["cards"]]} for ls in w["lessons"]]}
             for w in plan.get("weeks") or []]
    # bài thi: thời gian / điểm đạt lấy từ lộ trình (màn Lộ trình có thể đã sửa), mô tả đề từ blueprint_note
    exam = dict(plan.get("exam") or {})
    if cur := path.get("exam"):
        exam |= {"blueprint": cur.get("blueprint_note") or exam.get("blueprint") or "",
                 "duration_min": cur.get("duration_min") or exam.get("duration_min"),
                 "pass_score": _pass_score(cur.get("pass_score"), exam.get("pass_score"))}
    ai_ids = set(ai.get("lesson_ids") or [])
    manual = [i for m in path.get("modules") or [] for i in m.get("lesson_ids") or [] if i not in ai_ids]
    return {"id": str(path["_id"]), "title": path["title"], "period": path["period"], "year": path.get("year"),
            "month": path.get("month"), "status": path["status"], "created_at": path.get("created_at"),
            "updated_at": path.get("updated_at"),
            "plan": {"title": plan.get("title"), "weeks": weeks, "exam": exam},
            "exam_on": bool(path.get("exam")),
            "edited_in_paths_at": ai.get("edited_in_paths_at"), "manual_lesson_count": len(manual),
            "gaps": ai.get("gaps") or [], "notes": ai.get("notes") or [], "engine": ai.get("engine"),
            "no_ai": (ai.get("engine") or "").startswith("code"), "no_ai_reason": ai.get("no_ai_reason"),
            "prompt": ai.get("prompt"), "user_prompt": ai.get("user_prompt"), "form": ai.get("form"),
            "levels_source": ai.get("levels_source"), "candidate_total": ai.get("candidate_total"),
            "dropped_ids": ai.get("dropped_ids") or [],
            "learners": [{"id": str(p["_id"]), "name": p["name"]} for p in learners],
            "lesson_ids": [str(i) for i in ai.get("lesson_ids") or []],
            "space_id": plain(ai.get("space_id")), "saved_at": ai.get("saved_at"),
            "modules": [{"week": m["week"], "lesson_ids": [str(i) for i in m["lesson_ids"]]}
                        for m in path.get("modules") or []]}


def resolve_learners(user: dict, ids: list[str]) -> list[dict]:
    if not ids:
        return []
    want = oids(ids, "người học")
    allowed = set(policy.assignable_learners(user))
    if bad := [i for i in want if i not in allowed]:
        raise HTTPException(400, f"{len(bad)} người học không ở trong cây dưới quyền của bạn")
    return list(users.find({"_id": {"$in": want}}))


def design(user: dict, body: DesignIn, channel: str = "web") -> dict:
    require_author(user)
    learners = resolve_learners(user, body.learners)
    path = build_draft(user, learners, body.form, body.prompt, body.title, channel, body.form_in_prompt)
    return draft_out(path, user)


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

@router.post("/paths/design", status_code=201)
def design_path(body: DesignIn, user: dict = Depends(current_user)):
    """AI thiết kế lộ trình NHÁP (LRN-04). Luôn tạo bản nháp — không có AI thì dựng bằng code, `no_ai = true`."""
    return design(user, body)


@router.get("/paths/design/options")
def design_options(user: dict = Depends(current_user)):
    """Dữ liệu cho form 6 ô: cấp bậc, bậc nội dung, division, mảng (gốc cây), chuỗi quy trình, người học chọn được."""
    require_author(user)
    roots = cat_mod.categories.find({"parent_id": None, "active": True}, {"slug": 1, "name": 1, "code": 1}).sort(
        [("scheme", -1), ("order", 1)])
    learners = users.find({"_id": {"$in": policy.assignable_learners(user)}}, {"name": 1, "email": 1, "org": 1})
    return {"levels": {str(k): v for k, v in org.LEVEL_NAMES.items()},
            "content_levels": {k: v.split(" — ")[0] for k, v in classify.LEVELS.items()},
            "level_map": {str(k): v for k, v in org.level_map().items()},
            "divisions": classify.DIVISIONS,
            "areas": [{"slug": c["slug"], "name": node_label(c["slug"], c)} for c in roots],
            "process_chains": classify.PROCESS_CHAINS,
            "learners": [{"id": str(p["_id"]), "name": p["name"], "email": p.get("email"),
                          "level": org.user_org(p)["level"]} for p in learners],
            "me": {"level": org.user_org(user)["level"],
                   "category_root": org.function_category_root(org.user_org(user)["function"])}}


@router.get("/paths/design/drafts")
def my_drafts(user: dict = Depends(current_user)):
    rows = learning_paths.find({"owner_id": user["_id"], "ai": {"$ne": None}},
                               {"title": 1, "status": 1, "period": 1, "year": 1, "month": 1, "updated_at": 1,
                                "ai.engine": 1}).sort("updated_at", -1).limit(30)
    return {"items": [{"id": str(r["_id"]), "title": r["title"], "status": r["status"], "period": r["period"],
                       "year": r.get("year"), "month": r.get("month"), "updated_at": r.get("updated_at"),
                       "engine": (r.get("ai") or {}).get("engine")} for r in rows]}


@router.get("/paths/{path_id}/design")
def get_draft(path_id: str, user: dict = Depends(current_user)):
    return draft_out(load_draft(path_id, user), user)


@router.put("/paths/{path_id}/design")
def put_draft(path_id: str, body: PlanIn, user: dict = Depends(current_user)):
    """Lưu bản nháp đã sửa: ghi `ai.plan`, cập nhật bài học nháp + `modules` (luồng I phát hành / giao).
    Kết quả có `notices`: phần giữ lại / bỏ đi so với màn Lộ trình."""
    require_author(user)
    path, notices = save_plan(load_draft(path_id, user), body, user)
    return draft_out(path, user) | {"notices": notices}


class GenerateIn(BaseModel):
    card_id: str
    n: int = Field(2, ge=1, le=generate.MAX_N)


def generate_for_card(user: dict, card_id: str, n: int = 2, channel: str = "web") -> dict:
    require_author(user)
    card = cards.find_one(policy.visible_filter(user, "card", channel)
                          | {"_id": oid(card_id, "thẻ"), "delete_requested": {"$ne": True}})
    if not card:
        raise HTTPException(404, "Không tìm thấy thẻ")
    generate.check_not_c3(card)          # C3 không gửi Claude, không trả qua MCP (BA 15.5 quy tắc 3)
    if card.get("status") != "approved":
        raise HTTPException(400, "Chỉ sinh câu hỏi từ thẻ đã duyệt")
    try:
        made = generate.draft_questions_for_card(card, card.get("current_revision") or 1, user, n)
    except (generate.AINotReady, generate.AIRetryLater, ValueError) as e:
        raise HTTPException(503, generate.ai_error_message(e)) from None
    from .routes import questions_out
    return {"items": questions_out(made, user), "requested": n, "created": len(made),
            "skipped": n - len(made), "card_type": card.get("type")}


@router.post("/generate/questions", status_code=201)
def generate_questions(body: GenerateIn, user: dict = Depends(current_user)):
    """AI sinh câu hỏi NHÁP cho một thẻ đã duyệt theo loại thẻ (BA 17.6). Người soạn duyệt ở ngân hàng câu hỏi."""
    return generate_for_card(user, body.card_id, body.n)
