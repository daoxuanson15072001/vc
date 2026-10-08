"""Phân tích dự án marketing (BA 5.13, CE-27) — khung 7P đợt đầu, khung khác thêm vào FRAMEWORKS.

  Dự án (mục tiêu, mô tả) + kho tài nguyên (R/S/P/D) + thẻ ghim (K) ──AI──► nháp: mỗi mục có `text` + `evidence` (mã căn cứ)
  người sửa ──► chủ dự án **chốt** (state=final, không sửa nữa) ──► project.analysis_id; chiến dịch / Viết nhanh tạo sau đó
  lưu `analysis_id` và nạp phân tích vào prompt (ai.analysis_text) — đổi phân tích sau không làm lệch căn cứ cũ.
Trường `status` là trạng thái sinh bằng AI (idle / queued / generating / error, dùng chung worker._run_ai);
`state` là vòng đời (draft / final).
"""

from __future__ import annotations

import re
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from .. import db
from ..auth import current_user
from ..config import STUDIO_MODEL
from ..kb.pipeline import cards
from ..kb.routes import names_of, oid, out
from . import ai, analyses, campaigns, quick_pieces
from . import marketing_projects as projects
from .ai import S, STRS, dump, obj
from .projects import load_project

router = APIRouter(prefix="/api/studio/projects/{project_id}/analyses")

FRAMEWORKS = {
    "7p": {
        "label": "7P marketing",
        "sections": [
            ("product", "Sản phẩm (Product)", "Sản phẩm / dịch vụ đang bán, điểm mạnh, điểm yếu, điều khách thật sự mua"),
            ("price", "Giá (Price)", "Mức giá, cách định giá, so với đối thủ, cảm nhận đắt / rẻ của khách"),
            ("place", "Phân phối (Place)", "Khách mua / dùng ở đâu, kênh bán, địa điểm, thuận tiện hay không"),
            ("promotion", "Truyền thông (Promotion)", "Kênh, thông điệp, ưu đãi đang dùng; điều gì hiệu quả, điều gì chưa"),
            ("people", "Con người (People)", "Nhân sự tiếp xúc khách, chuyên môn, thái độ, người đứng tên"),
            ("process", "Quy trình (Process)", "Hành trình khách từ biết → mua → dùng → quay lại; chỗ tắc"),
            ("physical", "Bằng chứng hữu hình (Physical evidence)", "Cơ sở vật chất, hình ảnh, chứng nhận, đánh giá, dấu hiệu tin cậy"),
        ],
    },
}
Framework = Literal[tuple(FRAMEWORKS)]   # type: ignore[valid-type]
REF_RX = re.compile(r"^[RSPDKL]\d+$")
SECTION = obj(text=S, evidence=STRS)


def schema(framework: str) -> dict:
    keys = {k: SECTION for k, _, _ in FRAMEWORKS[framework]["sections"]}
    return obj(summary=S, sections=obj(**keys), open_questions=STRS)


def labels(framework: str) -> dict:
    return {k: label for k, label, _ in FRAMEWORKS[framework]["sections"]}


def blank_sections(framework: str) -> dict:
    return {k: {"text": "", "evidence": []} for k, _, _ in FRAMEWORKS[framework]["sections"]}


# ---------------------------------------------------------------------------
# Bối cảnh + prompt
# ---------------------------------------------------------------------------

SYSTEM = ai.BASE_SYSTEM + """
Bạn đang làm PHÂN TÍCH CHIẾN LƯỢC cho một dự án marketing, không viết nội dung đăng. Chỉ dùng dữ liệu trong bối cảnh; \
điều chưa có dữ liệu thì nói rõ "chưa có dữ liệu" và đưa vào open_questions thay vì bịa. Mỗi mục ghi mã căn cứ \
(R… video, S… trang web, P… bài mẫu, D… tài liệu, K… thẻ VCWIKI) vào `evidence`, chỉ dùng mã có trong bối cảnh."""

BUDGET = {"video": 1500, "url": 2500, "social_post": 2500, "document": 3000}
MAX_CONTEXT_CHARS = 90000


def project_context(p: dict) -> str:
    """Toàn bộ ảnh chụp tài nguyên + thẻ ghim của dự án, cắt theo ngân sách ký tự."""
    head = [("Tên dự án", p.get("name")), ("Mục tiêu", p.get("goal")), ("Mô tả / bối cảnh", p.get("description"))]
    parts = ["<du_an>\n" + "\n".join(f"- {k}: {v}" for k, v in head if v) + "\n</du_an>"]
    total = 0
    for r in p.get("resources") or []:
        text = (r.get("text") or "")[:BUDGET.get(r["kind"], 2000)]
        if total + len(text) > MAX_CONTEXT_CHARS:
            break
        total += len(text)
        meta = {"video": lambda: f'@{r.get("channel_handle")} · {r.get("views")} lượt xem · viral {(r.get("metrics") or {}).get("viral_score")}',
                "url": lambda: f'{r.get("url")} · {r.get("words")} từ · đề mục: {"; ".join((r.get("headings") or [])[:15])}',
                "social_post": lambda: f'kênh {ai.channel_label(r.get("channel"))}' + (f' · {r["url"]}' if r.get("url") else ""),
                "document": lambda: f'tài liệu Kho tư liệu{(" · " + r["url"]) if r.get("url") else ""}'}[r["kind"]]()
        note = f"\nGhi chú người dùng: {r['note']}" if r.get("note") else ""
        parts.append(f'<tai_nguyen ma="{r["ref"]}" loai="{r["kind"]}">\n{r.get("title")}\n{meta}{note}\n{text}\n</tai_nguyen>')
    pins = p.get("cards") or []
    cmap = {c["_id"]: c for c in cards.find({"_id": {"$in": [c["card_id"] for c in pins]}},
                                            {"title": 1, "summary": 1, "body": 1, "type": 1})}
    card_docs = [cmap[c["card_id"]] | {"ref": c["ref"]} for c in pins if c["card_id"] in cmap]
    parts.append(ai.cards_text(card_docs))
    return "\n\n".join(parts)


def task(framework: str, feedback: str = "", previous: dict | None = None) -> str:
    fw = FRAMEWORKS[framework]
    rows = "\n".join(f"- `{k}` — {label}: {hint}" for k, label, hint in fw["sections"])
    parts = [f"Nhiệm vụ: lập phân tích {fw['label']} cho dự án trên. Với từng mục viết 4–10 câu tiếng Việt, cụ thể, có số liệu / "
             f"trích dẫn khi bối cảnh có, nêu cả điểm mạnh lẫn điểm yếu, kết bằng 1–2 hàm ý cho nội dung marketing.\n{rows}\n"
             "`summary`: 5–8 câu tóm tắt định vị và 3 việc nội dung nên tập trung. `open_questions`: câu hỏi cần người dùng "
             "trả lời / dữ liệu còn thiếu."]
    if previous:
        parts.append("<ban_truoc>\n" + dump(previous) + "\n</ban_truoc>\nViết lại toàn bộ trên nền bản trước, giữ phần đã tốt.")
    if feedback.strip():
        parts.append(f"<yeu_cau_cua_nguoi_dung>\n{feedback.strip()}\n</yeu_cau_cua_nguoi_dung>\nƯu tiên làm đúng yêu cầu này.")
    return "\n\n".join(parts)


def generate(a: dict, context: str) -> dict:
    prev = {"summary": a.get("summary"), "sections": a.get("sections")} if any(
        (s.get("text") for s in (a.get("sections") or {}).values())) else None
    return ai.structured_call(SYSTEM, context + "\n\n" + task(a["framework"], a.get("feedback") or "", prev),
                              schema(a["framework"]), max_tokens=16000, model=STUDIO_MODEL)


def valid_refs(p: dict) -> set[str]:
    return {r["ref"] for r in p.get("resources") or []} | {c["ref"] for c in p.get("cards") or []} | \
        {c["ref"] for c in p.get("courses") or []}


def clean_sections(framework: str, raw: dict, allowed: set[str]) -> dict:
    """Chỉ giữ mục thuộc khung, mã căn cứ có thật trong dự án (AI hay bịa mã)."""
    outp = blank_sections(framework)
    for k in outp:
        sec = (raw or {}).get(k) or {}
        ev = [e.strip().upper() for e in (sec.get("evidence") or []) if isinstance(e, str)]
        outp[k] = {"text": (sec.get("text") or "").strip(),
                   "evidence": list(dict.fromkeys(e for e in ev if e in allowed))}
    return outp


# ---------------------------------------------------------------------------
# Đọc phân tích đã chốt (cho chiến dịch / Viết nhanh)
# ---------------------------------------------------------------------------

def load_final(analysis_id) -> dict | None:
    if not analysis_id:
        return None
    return analyses.find_one({"_id": analysis_id, "state": "final"})


def current_of(p: dict | None) -> dict | None:
    return load_final((p or {}).get("analysis_id"))


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

class AnalysisIn(BaseModel):
    framework: Framework = "7p"
    mode: Literal["ai", "blank"] = "ai"
    feedback: str = Field("", max_length=2000)


class SectionIn(BaseModel):
    text: str = Field("", max_length=6000)
    evidence: list[str] = Field([], max_length=30)


class AnalysisPatch(BaseModel):
    summary: str | None = Field(None, max_length=4000)
    sections: dict[str, SectionIn] | None = None
    open_questions: list[str] | None = Field(None, max_length=30)


class RegenerateIn(BaseModel):
    feedback: str = Field("", max_length=2000)


LIST_FIELDS = {"sections": 0, "open_questions": 0, "feedback": 0}


def analysis_out(a: dict, p: dict, full: bool = True) -> dict:
    fw = FRAMEWORKS[a["framework"]]
    extra = {"framework_label": fw["label"], "labels": labels(a["framework"]), "is_current": p.get("analysis_id") == a["_id"],
             "overall": "waiting_ai" if a["status"] == "queued" and not ai_ready() else a["status"]}
    if full:
        people = names_of([u for u in (a.get("created_by"), a.get("finalized_by")) if u])
        extra |= {"created_by_name": people.get(a.get("created_by")), "finalized_by_name": people.get(a.get("finalized_by")),
                  "section_order": [k for k, _, _ in fw["sections"]],
                  "hints": {k: hint for k, _, hint in fw["sections"]}}
    return out(a, extra)


def ai_ready() -> bool:
    from ..kb import wiki
    return wiki.ai_ready()


def load_analysis(p: dict, analysis_id: str) -> dict:
    a = analyses.find_one({"_id": oid(analysis_id, "phân tích"), "project_id": p["_id"]})
    if not a:
        raise HTTPException(404, "Không tìm thấy phân tích")
    return a


def _draft_only(a: dict) -> None:
    if a["state"] == "final":
        raise HTTPException(409, "Phân tích đã chốt — tạo phiên bản mới để sửa")


def _idle(a: dict) -> None:
    if a["status"] in ("queued", "generating"):
        raise HTTPException(409, "AI đang soạn phân tích này")


@router.get("")
def list_analyses(project_id: str, user: dict = Depends(current_user)):
    p = load_project(project_id, user)
    rows = analyses.find({"project_id": p["_id"]}, LIST_FIELDS).sort("version", -1)
    return {"frameworks": {k: v["label"] for k, v in FRAMEWORKS.items()},
            "items": [analysis_out(a, p, full=False) for a in rows]}


@router.post("", status_code=201)
def create_analysis(project_id: str, body: AnalysisIn, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    if body.mode == "ai" and not (p.get("resources") or p.get("cards") or p.get("goal")):
        raise HTTPException(400, "Dự án chưa có mục tiêu, tài nguyên hay thẻ ghim nào để AI phân tích")
    last = analyses.find_one({"project_id": p["_id"], "framework": body.framework}, sort=[("version", -1)])
    now = db.now()
    doc = {"project_id": p["_id"], "space_id": p["space_id"], "framework": body.framework,
           "version": (last["version"] + 1) if last else 1, "state": "draft",
           "status": "queued" if body.mode == "ai" else "idle", "stage": None, "error": None,
           "summary": "", "sections": blank_sections(body.framework), "open_questions": [],
           "feedback": body.feedback.strip(), "usage": None, "created_by": user["_id"], "created_at": now,
           "updated_at": now, "finalized_by": None, "finalized_at": None}
    doc["_id"] = analyses.insert_one(doc).inserted_id
    return analysis_out(doc, p)


@router.get("/{analysis_id}")
def get_analysis(project_id: str, analysis_id: str, user: dict = Depends(current_user)):
    p = load_project(project_id, user)
    return analysis_out(load_analysis(p, analysis_id), p)


@router.patch("/{analysis_id}")
def patch_analysis(project_id: str, analysis_id: str, body: AnalysisPatch, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    a = load_analysis(p, analysis_id)
    _draft_only(a)
    _idle(a)
    changes = {}
    if body.summary is not None:
        changes["summary"] = body.summary.strip()
    if body.open_questions is not None:
        changes["open_questions"] = [q.strip() for q in body.open_questions if q.strip()]
    if body.sections is not None:
        allowed = valid_refs(p)
        keys = set(labels(a["framework"]))
        if bad := set(body.sections) - keys:
            raise HTTPException(400, f"Mục không thuộc khung: {', '.join(sorted(bad))}")
        merged = dict(a["sections"])
        for k, sec in body.sections.items():
            ev = [e.strip().upper() for e in sec.evidence]
            if unknown := [e for e in ev if e not in allowed]:
                raise HTTPException(400, f"Mã căn cứ không có trong dự án: {', '.join(unknown)}")
            merged[k] = {"text": sec.text.strip(), "evidence": list(dict.fromkeys(ev))}
        changes["sections"] = merged
    if changes:
        analyses.update_one({"_id": a["_id"]}, {"$set": changes | {"updated_at": db.now()}})
    return analysis_out(analyses.find_one({"_id": a["_id"]}), p)


@router.post("/{analysis_id}/regenerate")
def regenerate_analysis(project_id: str, analysis_id: str, body: RegenerateIn, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    a = load_analysis(p, analysis_id)
    _draft_only(a)
    _idle(a)
    analyses.update_one({"_id": a["_id"]}, {"$set": {"status": "queued", "error": None, "feedback": body.feedback.strip(),
                                                    "updated_at": db.now()}})
    return analysis_out(analyses.find_one({"_id": a["_id"]}), p)


@router.post("/{analysis_id}/finalize")
def finalize_analysis(project_id: str, analysis_id: str, user: dict = Depends(current_user)):
    """Chốt: không sửa nữa, trở thành phân tích hiện hành của dự án (chiến dịch / bài tạo sau sẽ dùng)."""
    p = load_project(project_id, user, "project.manage")
    a = load_analysis(p, analysis_id)
    _draft_only(a)
    _idle(a)
    if not any(s.get("text") for s in a["sections"].values()):
        raise HTTPException(400, "Phân tích còn trống, chưa chốt được")
    now = db.now()
    analyses.update_one({"_id": a["_id"]}, {"$set": {"state": "final", "finalized_by": user["_id"], "finalized_at": now,
                                                    "updated_at": now}})
    projects.update_one({"_id": p["_id"]}, {"$set": {"analysis_id": a["_id"], "updated_at": now}})
    p["analysis_id"] = a["_id"]
    return analysis_out(analyses.find_one({"_id": a["_id"]}), p)


@router.delete("/{analysis_id}", status_code=204)
def delete_analysis(project_id: str, analysis_id: str, user: dict = Depends(current_user)):
    p = load_project(project_id, user, "project.write")
    a = load_analysis(p, analysis_id)
    _draft_only(a)
    analyses.delete_one({"_id": a["_id"]})
    return Response(status_code=204)
