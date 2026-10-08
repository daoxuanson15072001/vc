"""API Xưởng chiến dịch. Chiến dịch + người đứng tên thuộc một kho (space) — quyền xem / sửa theo kho như VCWIKI."""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field, field_validator

from .. import db, policy
from ..auth import current_user
from ..config import (STUDIO_MAX_COMPETITORS, STUDIO_MAX_EPISODES, STUDIO_MAX_REFS, STUDIO_MAX_ROUNDS,
                      STUDIO_MAX_SITE_URLS, STUDIO_MAX_SOCIAL_REFS, STUDIO_MODEL, STUDIO_PASS_SCORE)
from ..kb import wiki
from ..kb.routes import load, names_of, oid, out, space_names, space_scope
from ..spaces import personal_space
from . import ai, authors, campaigns, refs, scripts
from .projects import load_project, project_names, resources_of
from .export import campaign_markdown
from .worker import plans_of, slug

router = APIRouter(prefix="/api/studio")

Flow = Literal["video", "seo", "social"]
Channel = Literal["fb_personal", "fanpage", "linkedin", "linkedin_page", "other"]
DERIVED_BASE = 1000   # nội dung nhân bản đánh số từ 1001 để không đụng số mục của kế hoạch


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

def http_url(v: str) -> str:
    v = v.strip()
    if v and not re.match(r"https?://\S+$", v):
        raise ValueError(f"Link không hợp lệ: {v[:80]}")
    return v


class SeoBrief(BaseModel):
    website: str = Field("", max_length=300)
    landing_url: str = Field("", max_length=500)
    keywords: str = Field("", max_length=1000)
    location: str = Field("", max_length=200)
    sitemap_url: str = Field("", max_length=500)
    per_week: int = Field(1, ge=1, le=7)

    check_urls = field_validator("landing_url", "sitemap_url")(http_url)


class SocialBrief(BaseModel):
    channels: list[Channel] = Field([], max_length=5)
    per_week: int = Field(3, ge=1, le=14)
    link_url: str = Field("", max_length=500)

    check_urls = field_validator("link_url")(http_url)


class Brief(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    product: str = Field("", max_length=2000)
    goal: str = Field("", max_length=2000)
    audience: str = Field("", max_length=2000)
    persona: str = Field("", max_length=2000)
    platform: str = Field("TikTok", max_length=100)
    weeks: int = Field(4, ge=1, le=12)
    posts_per_week: int = Field(3, ge=1, le=7)
    video_length: str = Field("45–90 giây", max_length=50)
    cta: str = Field("", max_length=500)
    constraints: str = Field("", max_length=2000)
    notes: str = Field("", max_length=4000)
    seo: SeoBrief = SeoBrief()
    social: SocialBrief = SocialBrief()


class RefSpec(BaseModel):
    video_ids: list[str] = Field([], max_length=STUDIO_MAX_REFS)
    q: str | None = None
    channel: str | None = None
    tag: str | None = None
    limit: int = Field(12, ge=1, le=STUDIO_MAX_REFS)


class SocialRef(BaseModel):
    channel: Channel = "fanpage"
    text: str = Field(min_length=20, max_length=6000)
    url: str = Field("", max_length=500)
    metrics: str = Field("", max_length=300)

    check_urls = field_validator("url")(http_url)


class CampaignIn(BaseModel):
    space_id: str | None = None
    project_id: str | None = None   # BA 5.13: chiến dịch trong dự án nằm ở kho của dự án, tham chiếu lấy từ kho dự án
    flows: list[Flow] = Field(["video"], min_length=1, max_length=3)
    brief: Brief
    references: RefSpec = RefSpec()
    use_wiki: bool = True
    wiki_query: str = ""
    competitor_urls: list[str] = Field([], max_length=STUDIO_MAX_COMPETITORS)
    site_urls: list[str] = Field([], max_length=STUDIO_MAX_SITE_URLS)
    social_refs: list[SocialRef] = Field([], max_length=STUDIO_MAX_SOCIAL_REFS)
    author_ids: list[str] = Field([], max_length=20)

    @field_validator("competitor_urls", "site_urls")
    @classmethod
    def _url_list(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(u for u in (http_url(x) for x in v) if u))


class CampaignPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    project_id: str | None = None   # gán / bỏ gán dự án (gửi null để bỏ)


class RegenerateIn(BaseModel):
    part: Literal["all", "plan"] = "all"


class ScriptsIn(BaseModel):
    flow: Flow = "video"
    episodes: list[int] = Field(min_length=1, max_length=STUDIO_MAX_EPISODES)
    feedback: str = Field("", max_length=2000)


class ScriptPatch(BaseModel):
    review_status: Literal["draft", "approved", "rejected"] | None = None
    note: str | None = Field(None, max_length=4000)


class RewriteIn(BaseModel):
    feedback: str = Field("", max_length=2000)


class RepurposeIn(BaseModel):
    flow: Flow
    channel: Channel | None = None
    count: int = Field(1, ge=1, le=5)
    feedback: str = Field("", max_length=2000)


class AuthorIn(BaseModel):
    space_id: str | None = None
    name: str = Field(min_length=1, max_length=100)
    title: str = Field("", max_length=200)
    expertise: str = Field("", max_length=2000)
    voice: str = Field("", max_length=2000)
    catchphrases: str = Field("", max_length=1000)
    topics_ok: str = Field("", max_length=2000)
    topics_avoid: str = Field("", max_length=2000)
    samples: list[str] = Field([], max_length=5)
    consent: bool = False
    consent_note: str = Field("", max_length=500)

    @field_validator("samples")
    @classmethod
    def _samples(cls, v: list[str]) -> list[str]:
        v = [s.strip() for s in v if s.strip()]
        if any(len(s) > 6000 for s in v):
            raise ValueError("Mỗi bài mẫu tối đa 6.000 ký tự")
        return v


class AuthorPatch(AuthorIn):
    name: str | None = Field(None, min_length=1, max_length=100)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def can_edit(space_id, user: dict) -> bool:
    return policy.can(user, "space.write", {"space_id": space_id})


def overall(doc: dict) -> str:
    return "waiting_ai" if doc["status"] == "queued" and not wiki.ai_ready() else doc["status"]


SCRIPT_SUMMARY = {"episode_no": 1, "flow": 1, "step": 1, "status": 1, "stage": 1, "score": 1, "review_status": 1,
                  "error": 1, "parent_id": 1, "content.title": 1, "content.h1": 1, "outline.h1": 1,
                  "episode.title": 1, "episode.channel": 1, "episode.derived": 1, "updated_at": 1}
HIDDEN_IN_LIST = ("strategy", "plan", "plans", "references", "cards", "competitors", "social_refs", "authors", "site_urls")


def piece_title(s: dict) -> str | None:
    c, o = s.get("content") or {}, s.get("outline") or {}
    return c.get("title") or c.get("h1") or o.get("h1") or (s.get("episode") or {}).get("title")


def script_summaries(campaign_id) -> list[dict]:
    rows = scripts.find({"campaign_id": campaign_id}, SCRIPT_SUMMARY).sort([("flow", 1), ("episode_no", 1)])
    return [out({k: v for k, v in r.items() if k not in ("content", "outline", "episode")},
                {"overall": overall(r), "title": piece_title(r), "channel": (r.get("episode") or {}).get("channel"),
                 "derived": (r.get("episode") or {}).get("derived")}) for r in rows]


def campaign_out(c: dict, user: dict, full: bool = False) -> dict:
    people, snames = names_of([c["created_by"]]), space_names([c["space_id"]])
    plans = plans_of(c)
    extra = {"overall": overall(c), "created_by_name": people.get(c["created_by"]),
             "space_name": snames.get(c["space_id"]), "can_edit": can_edit(c["space_id"], user),
             "project_name": project_names([c.get("project_id")]).get(c.get("project_id")),
             "flows": ai.flows_of(c), "targets": ai.targets_of(c),
             "episode_count": sum(len(p.get("episodes") or []) for p in plans.values()),
             "site_url_count": len(c.get("site_urls") or [])}
    if not full:
        return out({k: v for k, v in c.items() if k not in HIDDEN_IN_LIST}, extra)
    extra |= {"plans": plans, "scripts": script_summaries(c["_id"]),
              "competitors": [{k: v for k, v in p.items() if k != "text"} for p in c.get("competitors") or []],
              "references": c.get("references") or [], "cards": c.get("cards") or [],
              "social_refs": c.get("social_refs") or [], "authors": c.get("authors") or []}
    return out({k: v for k, v in c.items() if k not in ("plan", "plans", "site_urls")}, extra)


def script_out(s: dict, user: dict) -> dict:
    return out(s, {"overall": overall(s), "can_edit": can_edit(s["space_id"], user), "flow": s.get("flow") or "video"})


def new_piece(camp: dict, user: dict, flow: str, no: int, episode: dict, feedback: str, **extra) -> dict:
    return {"campaign_id": camp["_id"], "space_id": camp["space_id"], "flow": flow, "episode_no": no,
            "episode": episode, "step": "outline" if flow == "seo" else None, "outline": None,
            "created_by": user["_id"], "review_status": "draft", "content": None, "review": None, "checks": [],
            "score": None, "rounds": [], "usage": None, "note": "", "status": "queued", "stage": None, "error": None,
            "feedback": feedback.strip(), "created_at": db.now(), "updated_at": db.now()} | extra


# ---------------------------------------------------------------------------
# Trạng thái + xem trước tham chiếu
# ---------------------------------------------------------------------------

@router.get("/status")
def studio_status(_user: dict = Depends(current_user)):
    rubrics = {f: {k: {"label": label, "max": mx, "auto": k in ai.AUTO_SCORED.get(f, ())} for k, (label, mx) in r.items()}
               for f, r in ai.RUBRICS.items()}
    return {"ai": wiki.ai_status() | {"model": STUDIO_MODEL}, "max_refs": STUDIO_MAX_REFS,
            "max_episodes": STUDIO_MAX_EPISODES, "pass_score": STUDIO_PASS_SCORE, "max_rounds": STUDIO_MAX_ROUNDS,
            "max_competitors": STUDIO_MAX_COMPETITORS, "max_social_refs": STUDIO_MAX_SOCIAL_REFS,
            "flows": ai.FLOWS, "channels": {k: {"label": v["label"], "personal": v["personal"]} for k, v in ai.CHANNELS.items()},
            "rubrics": rubrics, "rubric": rubrics["video"]}


@router.get("/references")
def preview_references(q: str | None = None, channel: str | None = None, tag: str | None = None,
                       limit: int = Query(12, ge=1, le=STUDIO_MAX_REFS), _user: dict = Depends(current_user)):
    """Xem trước video tham chiếu sẽ dùng: khớp bộ lọc, đã chuyển chữ, xếp theo viral_score."""
    rows = refs.find_references(q, channel, tag, limit=limit)
    return {"items": [refs.ref_out(r) for r in rows],
            "matched": db.videos.count_documents(refs.video_query(q, channel, tag))}


@router.get("/wiki-cards")
def preview_cards(q: str, limit: int = Query(12, ge=0, le=30), user: dict = Depends(current_user)):
    return refs.find_cards(user, q, limit)


# ---------------------------------------------------------------------------
# Người đứng tên (CE-18)
# ---------------------------------------------------------------------------

def author_out(a: dict, user: dict, snames: dict | None = None) -> dict:
    snames = snames if snames is not None else space_names([a["space_id"]])
    return out(a, {"space_name": snames.get(a["space_id"]), "can_edit": can_edit(a["space_id"], user)})


@router.get("/authors")
def list_authors(space_id: str | None = None, user: dict = Depends(current_user)):
    rows = list(authors.find(space_scope(space_id, user, kind="author")).sort("name", 1))
    snames = space_names([a["space_id"] for a in rows])
    return [author_out(a, user, snames) for a in rows]


@router.post("/authors", status_code=201)
def create_author(body: AuthorIn, user: dict = Depends(current_user)):
    space = policy.load_space(body.space_id, user, "space.write") if body.space_id else personal_space(user)
    doc = body.model_dump(exclude={"space_id"}) | {"space_id": space["_id"], "created_by": user["_id"],
                                                   "created_at": db.now(), "updated_at": db.now()}
    doc["_id"] = authors.insert_one(doc).inserted_id
    return author_out(doc, user)


@router.patch("/authors/{author_id}")
def patch_author(author_id: str, body: AuthorPatch, user: dict = Depends(current_user)):
    a, _ = load(authors, author_id, user, "space.write", "người đứng tên")
    changes = body.model_dump(exclude_unset=True, exclude={"space_id"})
    if changes:
        authors.update_one({"_id": a["_id"]}, {"$set": changes | {"updated_at": db.now()}})
    return author_out(authors.find_one({"_id": a["_id"]}), user)


@router.delete("/authors/{author_id}", status_code=204)
def delete_author(author_id: str, user: dict = Depends(current_user)):
    a, _ = load(authors, author_id, user, "space.write", "người đứng tên")
    authors.delete_one({"_id": a["_id"]})
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Chiến dịch
# ---------------------------------------------------------------------------

AUTHOR_SNAPSHOT = ("name", "title", "expertise", "voice", "catchphrases", "topics_ok", "topics_avoid", "samples", "consent")


@router.post("/campaigns", status_code=201)
def create_campaign(body: CampaignIn, user: dict = Depends(current_user)):
    project = load_project(body.project_id, user, "project.write") if body.project_id else None
    if project:
        space = policy.load_space(project["space_id"], user, "space.read")   # kho của dự án; quyền ghi đã qua dự án
    else:
        space = policy.load_space(body.space_id, user, "space.write") if body.space_id else personal_space(user)
    flows = list(dict.fromkeys(body.flows))
    b = body.brief
    # Kho tài nguyên dự án (CE-26) là mặc định khi form không đưa tham chiếu riêng
    project_videos = [r["video_id"] for r in resources_of(project, "video")]
    competitor_urls = body.competitor_urls or [r["url"] for r in resources_of(project, "url")][:STUDIO_MAX_COMPETITORS]
    social_refs = [p.model_dump() for p in body.social_refs] or [
        {"channel": r.get("channel") or "fanpage", "text": r["text"][:6000], "url": r.get("url") or "", "metrics": ""}
        for r in resources_of(project, "social_post")][:STUDIO_MAX_SOCIAL_REFS]
    videos = []
    if "video" in flows:
        r = body.references
        video_ids = r.video_ids or (project_videos if project_videos else None)
        videos = refs.find_references(r.q, r.channel, r.tag, video_ids=video_ids, limit=r.limit)
        if not videos:
            raise HTTPException(400, "Không có video tham chiếu nào (đã chuyển chữ) khớp lựa chọn")
    if "seo" in flows and not b.seo.keywords.strip():
        raise HTTPException(400, "Luồng bài SEO cần từ khoá hạt giống")
    if "social" in flows and not b.social.channels:
        raise HTTPException(400, "Luồng bài mạng xã hội cần chọn ít nhất một kênh")

    author_rows = []
    if "social" in flows and body.author_ids:
        ids = [oid(i, "người đứng tên") for i in dict.fromkeys(body.author_ids)]
        found = {a["_id"]: a for a in authors.find({"_id": {"$in": ids}} | policy.visible_filter(user, "author"))}
        if len(found) != len(ids):
            raise HTTPException(404, "Không tìm thấy người đứng tên")
        author_rows = [found[i] for i in ids]
        if missing := [a["name"] for a in author_rows if not a.get("consent")]:
            raise HTTPException(400, f"Chưa xác nhận đồng ý đứng tên: {', '.join(missing)}")
    personal = [ai.CHANNELS[c]["label"] for c in b.social.channels if ai.CHANNELS[c]["personal"]]
    if "social" in flows and personal and not author_rows:
        raise HTTPException(400, f"Kênh cá nhân ({', '.join(personal)}) cần ít nhất một người đứng tên")

    brief = b.model_dump()
    wiki_q = body.wiki_query.strip() or " ".join(
        [brief[k] for k in ("name", "product", "goal", "audience")] + ([b.seo.keywords] if "seo" in flows else []))
    card_rows = refs.find_cards(user, wiki_q) if body.use_wiki else []
    if project:   # thẻ ghim của dự án đứng trước thẻ tìm được, không trùng
        pinned = [{"id": str(c["card_id"]), "title": c["title"], "type": c["type"], "status": c["status"]}
                  for c in project.get("cards") or []]
        seen = {c["id"] for c in pinned}
        card_rows = pinned + [c for c in card_rows if c["id"] not in seen]
    per_week = {"video": b.posts_per_week, "seo": b.seo.per_week, "social": b.social.per_week}
    targets = {f: min(b.weeks * per_week[f], STUDIO_MAX_EPISODES) for f in flows}
    now = db.now()
    doc = {
        "space_id": space["_id"], "project_id": project["_id"] if project else None,
        "analysis_id": (project or {}).get("analysis_id"),   # phân tích đã chốt lúc tạo (CE-27) — đổi sau không lệch căn cứ
        "created_by": user["_id"], "name": brief["name"], "brief": brief,
        "flows": flows, "targets": targets, "episodes_target": targets.get("video", 0),
        "reference_filter": body.references.model_dump() if "video" in flows else None,
        # ảnh chụp tham chiếu lúc tạo: kho video thay đổi sau này không làm lệch căn cứ của chiến dịch
        "references": [{"ref": f"R{i}", "video_id": v["_id"]} | {k: w for k, w in refs.ref_out(v).items() if k != "id"}
                       for i, v in enumerate(videos, 1)],
        "cards": [{"ref": f"K{i}", "card_id": c["id"], "title": c["title"], "type": c["type"], "status": c["status"]}
                  for i, c in enumerate(card_rows, 1)],
        "competitors": [{"ref": f"S{i}", "url": u, "status": "pending"}
                        for i, u in enumerate(competitor_urls, 1)] if "seo" in flows else [],
        "site_urls": body.site_urls if "seo" in flows else [], "sitemap_fetched": False,
        "social_refs": [{"ref": f"P{i}"} | p for i, p in enumerate(social_refs, 1)]
        if "social" in flows else [],
        "authors": [{"ref": f"A{i}", "author_id": str(a["_id"])} | {k: a.get(k) for k in AUTHOR_SNAPSHOT}
                    for i, a in enumerate(author_rows, 1)],
        "status": "queued", "stage": None, "error": None, "strategy": None, "plans": {}, "usage": None,
        "created_at": now, "updated_at": now,
    }
    doc["_id"] = campaigns.insert_one(doc).inserted_id
    return campaign_out(doc, user, full=True)


@router.get("/campaigns")
def list_campaigns(space_id: str | None = None, q: str | None = None, project_id: str | None = None,
                   page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
                   user: dict = Depends(current_user)):
    f = space_scope(space_id, user, kind="campaign")
    if project_id:   # đợt 1: chiến dịch vẫn theo quyền kho; dự án chỉ là bộ lọc
        f = {"$and": [f, {"project_id": load_project(project_id, user)["_id"]}]}
    if q and q.strip():
        f["name"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    rows = list(campaigns.find(f, {"strategy": 0, "competitors": 0, "site_urls": 0, "social_refs": 0})
                .sort("created_at", -1).skip((page - 1) * page_size).limit(page_size))
    return {"items": [campaign_out(c, user) for c in rows], "total": campaigns.count_documents(f)}


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str, user: dict = Depends(current_user)):
    camp, _ = load(campaigns, campaign_id, user, "space.read", "chiến dịch")
    return campaign_out(camp, user, full=True)


@router.patch("/campaigns/{campaign_id}")
def patch_campaign(campaign_id: str, body: CampaignPatch, user: dict = Depends(current_user)):
    camp, _ = load(campaigns, campaign_id, user, "space.write", "chiến dịch")
    changes = {}
    if body.name:
        changes["name"] = body.name.strip()
    if "project_id" in body.model_fields_set:
        changes["project_id"] = assign_project(body.project_id, camp["space_id"], user)
    if changes:
        campaigns.update_one({"_id": camp["_id"]}, {"$set": changes | {"updated_at": db.now()}})
    return campaign_out(campaigns.find_one({"_id": camp["_id"]}), user, full=True)


def assign_project(project_id: str | None, space_id, user: dict):
    """Gán chiến dịch / Viết nhanh vào dự án: cần quyền sửa dự án và dự án phải cùng kho. None = bỏ gán."""
    if not project_id:
        return None
    p = load_project(project_id, user, "project.write")
    if p["space_id"] != space_id:
        raise HTTPException(400, "Dự án thuộc kho khác — chỉ gán được vào dự án cùng kho")
    return p["_id"]


@router.post("/campaigns/{campaign_id}/regenerate")
def regenerate_campaign(campaign_id: str, body: RegenerateIn, user: dict = Depends(current_user)):
    """Dựng lại: 'all' = chiến lược + kế hoạch, 'plan' = giữ chiến lược, chỉ lập lại kế hoạch các luồng."""
    camp, _ = load(campaigns, campaign_id, user, "space.write", "chiến dịch")
    if camp["status"] in ("queued", "generating"):
        raise HTTPException(409, "Chiến dịch đang được AI xử lý")
    if body.part == "plan" and not camp.get("strategy"):
        raise HTTPException(400, "Chưa có chiến lược — hãy dựng lại toàn bộ")
    changes = {"status": "queued", "error": None, "plan": None, "plans": {}, "updated_at": db.now()}
    if body.part == "all":
        changes["strategy"] = None
    campaigns.update_one({"_id": camp["_id"]}, {"$set": changes})
    return campaign_out(campaigns.find_one({"_id": camp["_id"]}), user, full=True)


@router.delete("/campaigns/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: str, user: dict = Depends(current_user)):
    camp, _ = load(campaigns, campaign_id, user, "space.write", "chiến dịch")
    scripts.delete_many({"campaign_id": camp["_id"]})
    campaigns.delete_one({"_id": camp["_id"]})
    return Response(status_code=204)


@router.post("/campaigns/{campaign_id}/scripts", status_code=201)
def queue_scripts(campaign_id: str, body: ScriptsIn, user: dict = Depends(current_user)):
    """Xếp hàng viết nội dung cho các mục kế hoạch của một luồng. Mục đã có thì bỏ qua (dùng 'viết lại' để sửa)."""
    camp, _ = load(campaigns, campaign_id, user, "space.write", "chiến dịch")
    episodes = {e["no"]: e for e in (plans_of(camp).get(body.flow) or {}).get("episodes") or []}
    if not episodes:
        raise HTTPException(400, "Chiến dịch chưa có kế hoạch nội dung cho luồng này")
    queued, skipped = [], []
    for no in dict.fromkeys(body.episodes):
        if no not in episodes:
            raise HTTPException(400, f"Không có mục số {no}")
        existing = scripts.find_one({"campaign_id": camp["_id"], "flow": body.flow, "episode_no": no}, {"status": 1})
        if existing and existing["status"] != "error":
            skipped.append(no)
            continue
        if existing:
            scripts.update_one({"_id": existing["_id"]}, {"$set": {
                "episode": episodes[no], "status": "queued", "stage": None, "error": None,
                "feedback": body.feedback.strip(), "updated_at": db.now()}})
        else:
            scripts.insert_one(new_piece(camp, user, body.flow, no, episodes[no], body.feedback))
        queued.append(no)
    return {"queued": queued, "skipped": skipped}


# ---------------------------------------------------------------------------
# Nội dung (kịch bản video / bài SEO / bài MXH)
# ---------------------------------------------------------------------------

@router.get("/scripts/{script_id}")
def get_script(script_id: str, user: dict = Depends(current_user)):
    sc, _ = load(scripts, script_id, user, "space.read", "nội dung")
    return script_out(sc, user)


@router.patch("/scripts/{script_id}")
def patch_script(script_id: str, body: ScriptPatch, user: dict = Depends(current_user)):
    sc, _ = load(scripts, script_id, user, "space.write", "nội dung")
    changes = body.model_dump(exclude_none=True)
    if "review_status" in changes:
        if sc["status"] != "done" or not sc.get("content"):
            raise HTTPException(409, "Nội dung chưa viết xong")
        changes |= {"reviewed_by": user["_id"], "reviewed_at": db.now()}
    if changes:
        scripts.update_one({"_id": sc["_id"]}, {"$set": changes | {"updated_at": db.now()}})
    return script_out(scripts.find_one({"_id": sc["_id"]}), user)


def _idle(sc: dict) -> None:
    if sc["status"] in ("queued", "generating"):
        raise HTTPException(409, "Nội dung đang được AI xử lý")


@router.post("/scripts/{script_id}/rewrite")
def rewrite_script(script_id: str, body: RewriteIn, user: dict = Depends(current_user)):
    """Làm lại bước hiện tại theo góp ý (bài SEO đang ở dàn ý thì lập lại dàn ý). Bản cũ bị thay khi bản mới xong."""
    sc, _ = load(scripts, script_id, user, "space.write", "nội dung")
    _idle(sc)
    scripts.update_one({"_id": sc["_id"]}, {"$set": {"status": "queued", "error": None, "rounds": [],
                                                     "feedback": body.feedback.strip(), "updated_at": db.now()}})
    return script_out(scripts.find_one({"_id": sc["_id"]}), user)


@router.post("/scripts/{script_id}/article")
def write_article(script_id: str, body: RewriteIn, user: dict = Depends(current_user)):
    """Bài SEO: duyệt dàn ý rồi cho AI viết bài (góp ý kèm theo được ưu tiên)."""
    sc, _ = load(scripts, script_id, user, "space.write", "nội dung")
    _idle(sc)
    if sc.get("flow") != "seo" or not sc.get("outline"):
        raise HTTPException(409, "Chỉ bài SEO đã có dàn ý mới viết bài được")
    scripts.update_one({"_id": sc["_id"]}, {"$set": {
        "step": "article", "status": "queued", "error": None, "rounds": [], "feedback": body.feedback.strip(),
        "outline_approved_by": user["_id"], "outline_approved_at": db.now(), "updated_at": db.now()}})
    return script_out(scripts.find_one({"_id": sc["_id"]}), user)


@router.post("/scripts/{script_id}/repurpose", status_code=201)
def repurpose_script(script_id: str, body: RepurposeIn, user: dict = Depends(current_user)):
    """Nhân bản đa kênh (CE-20): từ một nội dung đã viết tạo `count` nội dung con ở luồng khác."""
    sc, _ = load(scripts, script_id, user, "space.write", "nội dung")
    if not (sc.get("content") or sc.get("outline")):
        raise HTTPException(409, "Nội dung gốc chưa viết xong")
    if body.flow == "social" and not body.channel:
        raise HTTPException(400, "Chọn kênh cho bài mạng xã hội")
    camp = campaigns.find_one({"_id": sc["campaign_id"]})
    if body.flow == "social" and ai.CHANNELS[body.channel]["personal"] and not camp.get("authors"):
        raise HTTPException(400, "Kênh cá nhân cần người đứng tên — chiến dịch này chưa có")
    last = scripts.find_one({"campaign_id": camp["_id"], "flow": body.flow}, {"episode_no": 1}, sort=[("episode_no", -1)])
    start = max(DERIVED_BASE, last["episode_no"] if last else 0)
    parent_title = piece_title(sc)
    ep = sc.get("episode") or {}
    ids = []
    for i in range(1, body.count + 1):
        episode = {"no": start + i, "week": ep.get("week"), "day": ep.get("day") or "", "pillar": ep.get("pillar") or "",
                   "title": f"{parent_title} — bản chuyển thể {i}/{body.count}",
                   "derived": {"from_flow": sc.get("flow") or "video", "from_no": sc["episode_no"], "index": i,
                               "count": body.count},
                   "channel": body.channel if body.flow == "social" else None,
                   "author": (camp.get("authors") or [{}])[0].get("ref", "") if body.flow == "social" else ""}
        ids.append(str(scripts.insert_one(new_piece(camp, user, body.flow, start + i, episode, body.feedback,
                                                    parent_id=sc["_id"])).inserted_id))
    return {"created": ids}


@router.delete("/scripts/{script_id}", status_code=204)
def delete_script(script_id: str, user: dict = Depends(current_user)):
    sc, _ = load(scripts, script_id, user, "space.write", "nội dung")
    if sc["status"] == "generating":
        raise HTTPException(409, "Nội dung đang được AI viết")
    scripts.delete_one({"_id": sc["_id"]})
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# Xuất hồ sơ chiến dịch (Markdown)
# ---------------------------------------------------------------------------

@router.get("/campaigns/{campaign_id}/export.md")
def export_campaign(campaign_id: str, user: dict = Depends(current_user)):
    camp, _ = load(campaigns, campaign_id, user, "space.read", "chiến dịch")
    rows = list(scripts.find({"campaign_id": camp["_id"], "review_status": {"$ne": "rejected"}})
                .sort([("flow", 1), ("episode_no", 1)]))
    return Response(campaign_markdown(camp, rows), media_type="text/markdown; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{slug(camp["name"])}.md"'})
