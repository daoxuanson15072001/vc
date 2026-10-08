"""Luồng nền của Xưởng chiến dịch.

Chiến dịch: (SEO) tải trang đối thủ + sitemap → chiến lược + chiến dịch → kế hoạch từng luồng.
Nội dung: viết → kiểm tra tự động → giám khảo chấm → sửa (tối đa N vòng). Bài SEO: dàn ý trước, viết bài sau khi duyệt.
Viết nhanh: cùng vòng viết → kiểm tra → chấm cho một nội dung lẻ (quick.py); giám khảo là tuỳ chọn.
"""

from __future__ import annotations

import re
import threading
import time
import traceback

from bson import ObjectId

from .. import db
from ..config import STUDIO_MAX_ROUNDS, STUDIO_MAX_SITE_URLS, STUDIO_PASS_SCORE, STUDIO_QUICK_MAX_ROUNDS
from ..kb import wiki
from ..kb.pipeline import cards
from . import ai, analyses, campaigns, checks, quick, quick_pieces, scripts, serp
from . import analysis as analysis_mod
from . import marketing_projects


def add_usage(total: dict | None, usage: dict | None) -> dict:
    total = dict(total or {"input_tokens": 0, "output_tokens": 0, "calls": 0})
    if usage:
        total["input_tokens"] += usage["input_tokens"]
        total["output_tokens"] += usage["output_tokens"]
        total["calls"] += 1
        total["model"] = usage["model"]
    return total


def plans_of(camp: dict) -> dict:
    """Kế hoạch theo luồng. Chiến dịch trước khi có 3 luồng lưu kế hoạch video ở `plan`."""
    plans = dict(camp.get("plans") or {})
    if camp.get("plan") and "video" not in plans:
        plans["video"] = camp["plan"]
    return plans


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", db.unaccent(text)).strip("-")[:60] or "chien-dich"


def load_inputs(camp: dict, refs: list[str] | None = None, card_refs: list[str] | None = None) -> dict:
    """Dữ liệu đầy đủ theo ảnh chụp lúc tạo chiến dịch. `refs` / `card_refs` lọc theo mã R… / K…"""
    wanted = [r for r in camp.get("references") or [] if refs is None or r["ref"] in refs]
    by_id = {v["_id"]: v for v in db.videos.find({"_id": {"$in": [r["video_id"] for r in wanted]}}, {"segments": 0})}
    videos = [{"ref": r["ref"], "video": by_id[r["video_id"]], "metrics": r.get("metrics")}
              for r in wanted if r["video_id"] in by_id]
    wanted_cards = [c for c in camp.get("cards", []) if card_refs is None or c["ref"] in card_refs]
    cmap = {c["_id"]: c for c in cards.find({"_id": {"$in": [ObjectId(c["card_id"]) for c in wanted_cards]}})}
    card_docs = [cmap[ObjectId(c["card_id"])] | {"ref": c["ref"]} for c in wanted_cards if ObjectId(c["card_id"]) in cmap]
    return {"videos": videos, "cards": card_docs, "pages": camp.get("competitors") or [],
            "analysis": analysis_mod.load_final(camp.get("analysis_id")),
            "posts": camp.get("social_refs") or [], "authors": camp.get("authors") or [],
            "site_urls": camp.get("site_urls") or []}


class StudioWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="studio", daemon=True)

    def start(self) -> None:
        campaigns.update_many({"status": "generating"}, {"$set": {"status": "queued"}})
        scripts.update_many({"status": "generating"}, {"$set": {"status": "queued"}})
        quick_pieces.update_many({"status": "generating"}, {"$set": {"status": "queued"}})
        analyses.update_many({"status": "generating"}, {"$set": {"status": "queued"}})
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            worked = False
            if wiki.ai_ready():   # chưa có API key: việc nằm chờ ở trạng thái queued
                try:
                    # Viết nhanh trước: người dùng đang ngồi chờ một bài, chiến dịch là việc dài
                    worked = self._quick_next() or self._analysis_next() or self._campaign_next() or self._script_next()
                except Exception:  # noqa: BLE001 — không để luồng nền chết
                    traceback.print_exc()
            if not worked:
                self._stop.wait(2)

    def _run_ai(self, coll, doc_id, fn):
        """Chạy fn(); lỗi tạm thời thì trả việc về hàng đợi. Trả (kết quả, đã_xử_lý)."""
        try:
            return fn(), True
        except wiki.AINotReady as e:
            coll.update_one({"_id": doc_id}, {"$set": {"status": "queued", "error": str(e)}})
            return None, False
        except wiki.AIRetryLater as e:
            coll.update_one({"_id": doc_id}, {"$set": {"status": "queued", "error": f"Thử lại sau: {e}"}})
            time.sleep(30)
            return None, True
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            coll.update_one({"_id": doc_id}, {"$set": {"status": "error", "error": str(e)[:500],
                                                       "updated_at": db.now()}})
            return None, True

    # --- Phân tích dự án (CE-27): một lượt AI, người sửa rồi chốt ---------------------------

    def _analysis_next(self) -> bool:
        a = analyses.find_one_and_update({"status": "queued"}, {"$set": {"status": "generating", "error": None,
                                                                          "stage": "Đọc tài nguyên dự án"}},
                                         sort=[("created_at", 1)], return_document=True)
        if not a:
            return False
        p = marketing_projects.find_one({"_id": a["project_id"]})
        if not p:
            analyses.update_one({"_id": a["_id"]}, {"$set": {"status": "error", "error": "Dự án không còn"}})
            return True
        context = analysis_mod.project_context(p)
        analyses.update_one({"_id": a["_id"]}, {"$set": {"stage": "AI phân tích"}})
        res, handled = self._run_ai(analyses, a["_id"], lambda: analysis_mod.generate(a, context))
        if res is None:
            return handled
        usage = add_usage(a.get("usage"), res.pop("usage", None))
        analyses.update_one({"_id": a["_id"]}, {"$set": {
            "summary": (res.get("summary") or "").strip(),
            "sections": analysis_mod.clean_sections(a["framework"], res.get("sections") or {}, analysis_mod.valid_refs(p)),
            "open_questions": [q for q in res.get("open_questions") or [] if isinstance(q, str) and q.strip()][:20],
            "status": "idle", "stage": None, "error": None, "usage": usage, "updated_at": db.now()}})
        return True

    # --- Chiến dịch: tài liệu SEO, chiến lược, kế hoạch từng luồng -------------------------

    def _fetch_seo_sources(self, camp: dict) -> None:
        cid = camp["_id"]
        pending = [p for p in camp.get("competitors") or [] if p.get("status") == "pending"]
        if pending or (camp["brief"].get("seo") or {}).get("sitemap_url") and not camp.get("sitemap_fetched"):
            campaigns.update_one({"_id": cid}, {"$set": {"stage": "serp"}})
        for p in pending:
            p |= serp.fetch_page(p["url"])
            campaigns.update_one({"_id": cid, "competitors.ref": p["ref"]}, {"$set": {"competitors.$": p}})
        sitemap = (camp["brief"].get("seo") or {}).get("sitemap_url")
        if sitemap and not camp.get("sitemap_fetched"):
            try:
                found, err = serp.fetch_sitemap(sitemap), None
            except Exception as e:  # noqa: BLE001
                found, err = [], f"Không đọc được sitemap: {str(e)[:200]}"
            camp["site_urls"] = list(dict.fromkeys((camp.get("site_urls") or []) + found))[:STUDIO_MAX_SITE_URLS]
            camp["sitemap_fetched"] = True
            campaigns.update_one({"_id": cid}, {"$set": {"site_urls": camp["site_urls"], "sitemap_fetched": True,
                                                         "sitemap_error": err}})

    def _campaign_next(self) -> bool:
        camp = campaigns.find_one_and_update({"status": "queued"}, {"$set": {"status": "generating", "error": None}},
                                             sort=[("created_at", 1)], return_document=True)
        if not camp:
            return False
        cid, flows = camp["_id"], ai.flows_of(camp)
        if "seo" in flows:
            self._fetch_seo_sources(camp)
        inputs = load_inputs(camp)
        if "video" in flows and not inputs["videos"]:
            campaigns.update_one({"_id": cid}, {"$set": {"status": "error", "updated_at": db.now(),
                                                         "error": "Video tham chiếu đã bị xoá khỏi kho"}})
            return True
        usage = camp.get("usage")

        if not camp.get("strategy"):
            campaigns.update_one({"_id": cid}, {"$set": {"stage": "strategy"}})
            res, handled = self._run_ai(campaigns, cid, lambda: ai.generate_strategy(camp, inputs))
            if res is None:
                return handled
            usage = add_usage(usage, res.pop("usage"))
            camp["strategy"] = res
            campaigns.update_one({"_id": cid}, {"$set": {"strategy": res, "usage": usage, "updated_at": db.now()}})

        plans = plans_of(camp)
        for flow in flows:
            if plans.get(flow):
                continue
            campaigns.update_one({"_id": cid}, {"$set": {"stage": f"plan_{flow}"}})
            res, handled = self._run_ai(campaigns, cid, lambda f=flow: ai.generate_plan(f, camp, camp["strategy"], inputs))
            if res is None:
                return handled
            usage = add_usage(usage, res.pop("usage"))
            res["episodes"] = sorted(res["episodes"], key=lambda e: e["no"])
            if flow == "social":   # AI ghi sai mã kênh -> đưa về kênh đầu tiên của brief
                chans = (camp["brief"].get("social") or {}).get("channels") or ["other"]
                for e in res["episodes"]:
                    e["channel"] = e["channel"] if e["channel"] in chans else chans[0]
            plans[flow] = res
            campaigns.update_one({"_id": cid}, {"$set": {f"plans.{flow}": res, "usage": usage, "updated_at": db.now()}})

        campaigns.update_one({"_id": cid}, {"$set": {
            "status": "ready", "stage": None, "error": None, "generated_at": db.now(), "updated_at": db.now()}})
        return True

    # --- Nội dung từng mục -------------------------------------------------------------------

    def _script_next(self) -> bool:
        sc = scripts.find_one_and_update({"status": "queued"}, {"$set": {"status": "generating", "error": None}},
                                         sort=[("created_at", 1)], return_document=True)
        if not sc:
            return False
        sid, flow = sc["_id"], sc.get("flow") or "video"
        sc["flow"] = flow
        camp = campaigns.find_one({"_id": sc["campaign_id"]})
        if not camp or not camp.get("strategy"):
            scripts.update_one({"_id": sid}, {"$set": {"status": "error", "error": "Chiến dịch chưa có chiến lược"}})
            return True
        ep = sc["episode"]
        parent = scripts.find_one({"_id": sc["parent_id"]}) if sc.get("parent_id") else None
        siblings = [s["content"].get("title") or s["content"].get("h1")
                    for s in scripts.find({"parent_id": sc.get("parent_id"), "flow": flow, "_id": {"$ne": sid},
                                           "content": {"$ne": None}}, {"content": 1})] if parent else []
        top = [r["ref"] for r in (camp.get("references") or [])[:3]]
        inputs = load_inputs(camp, (ep.get("refs") or top)[:5] if flow == "video" else None,
                             ep.get("cards") or [] if not parent else None)
        if flow == "video" and not inputs["videos"]:   # mã video tập trích không còn / không hợp lệ
            inputs["videos"] = load_inputs(camp, top, [])["videos"]
        context = ai.piece_context(camp, sc, inputs, parent, siblings)
        usage = sc.get("usage")

        if flow == "seo" and sc.get("step") == "outline":
            scripts.update_one({"_id": sid}, {"$set": {"stage": "Lập dàn ý"}})
            outline, handled = self._run_ai(scripts, sid, lambda: ai.write_piece("outline", context,
                                                                                 feedback=sc.get("feedback") or ""))
            if outline is None:
                return handled
            usage = add_usage(usage, outline.pop("usage"))
            scripts.update_one({"_id": sid}, {"$set": {
                "outline": outline, "usage": usage, "status": "done", "stage": None, "error": None,
                "updated_at": db.now(), "generated_at": db.now()}})
            return True

        rounds, best = [], None
        previous = review = found = None
        for i in range(STUDIO_MAX_ROUNDS):
            scripts.update_one({"_id": sid}, {"$set": {"stage": f"Vòng {i + 1}: viết"}})
            draft, handled = self._run_ai(scripts, sid, lambda: ai.write_piece(
                flow, context, sc.get("outline"), previous, review, found, sc.get("feedback") or ""))
            if draft is None:
                return handled
            usage = add_usage(usage, draft.pop("usage"))
            if flow == "social":
                self._attach_link(draft, sc, camp)
            found = checks.run(flow, draft, sc, camp)
            auto = {"onpage": checks.onpage_score(found)} if flow == "seo" else None
            scripts.update_one({"_id": sid}, {"$set": {"stage": f"Vòng {i + 1}: chấm điểm"}})
            review, handled = self._run_ai(scripts, sid, lambda: ai.judge_piece(flow, context, draft, found, auto))
            if review is None:
                return handled
            usage = add_usage(usage, review.pop("usage"))
            rounds.append({"total": review["total"], "scores": review["scores"], "fixes": review["fixes"]})
            if best is None or review["total"] > best[1]["total"]:
                best = (draft, review, found)
            if review["total"] >= STUDIO_PASS_SCORE:
                break
            previous = draft

        content, review, found = best
        scripts.update_one({"_id": sid}, {"$set": {
            "content": content, "review": review, "checks": found, "score": review["total"], "rounds": rounds,
            "usage": usage, "status": "done", "stage": None, "error": None, "review_status": "draft",
            "updated_at": db.now(), "generated_at": db.now()}})
        return True

    # --- Viết nhanh ---------------------------------------------------------------------------------

    def _quick_next(self) -> bool:
        qp = quick_pieces.find_one_and_update({"status": "queued"}, {"$set": {"status": "generating", "error": None}},
                                              sort=[("created_at", 1)], return_document=True)
        if not qp:
            return False
        qid, t = qp["_id"], quick.TYPES.get(qp["type"])
        if not t:
            quick_pieces.update_one({"_id": qid}, {"$set": {"status": "error", "error": f"Loại không còn: {qp['type']}"}})
            return True
        url = qp["inputs"].get("source_url")
        if url and not qp.get("source_page"):
            quick_pieces.update_one({"_id": qid}, {"$set": {"stage": "Tải bài tham khảo"}})
            qp["source_page"] = {k: v for k, v in serp.fetch_page(url).items() if k != "headings"}
            quick_pieces.update_one({"_id": qid}, {"$set": {"source_page": qp["source_page"]}})
        cards_in = load_inputs({"cards": qp.get("cards") or []})["cards"]
        parent = quick_pieces.find_one({"_id": qp["parent_id"]}) if qp.get("parent_id") else None
        context = quick.context(qp, cards_in, parent)
        rubric, judge = t["rubric"], qp.get("judge", t["judge"])
        usage = qp.get("usage")

        rounds, best = [], None
        review = found = None
        previous = qp.get("content") if qp.get("feedback") else None   # viết lại theo góp ý: sửa trên bản đang có
        for i in range(STUDIO_QUICK_MAX_ROUNDS if judge else 1):
            quick_pieces.update_one({"_id": qid}, {"$set": {"stage": f"Vòng {i + 1}: viết"}})
            draft, handled = self._run_ai(quick_pieces, qid, lambda: quick.write(qp, context, previous, review, found))
            if draft is None:
                return handled
            usage = add_usage(usage, draft.pop("usage"))
            if "link_placement" in draft:
                self._attach_quick_link(draft, qp)
            found = quick.run_checks(qp, draft)
            if not judge:
                best = (draft, None, found)
                break
            auto = {"onpage": checks.onpage_score(found)} if rubric == "seo" else None
            quick_pieces.update_one({"_id": qid}, {"$set": {"stage": f"Vòng {i + 1}: chấm điểm"}})
            review, handled = self._run_ai(quick_pieces, qid,
                                           lambda: ai.judge_piece(rubric, context, draft, found, auto))
            if review is None:
                return handled
            usage = add_usage(usage, review.pop("usage"))
            rounds.append({"total": review["total"], "scores": review["scores"], "fixes": review["fixes"]})
            if best is None or review["total"] > best[1]["total"]:
                best = (draft, review, found)
            if review["total"] >= STUDIO_PASS_SCORE:
                break
            previous = draft

        content, review, found = best
        quick_pieces.update_one({"_id": qid}, {"$set": {
            "content": content, "review": review, "checks": found, "score": review["total"] if review else None,
            "rounds": rounds, "title": quick.title_of(qp["type"], content, qp["inputs"]), "usage": usage,
            "status": "done", "stage": None, "error": None, "updated_at": db.now(), "generated_at": db.now()}})
        return True

    @staticmethod
    def _attach_quick_link(draft: dict, qp: dict) -> None:
        """Như _attach_link: UTM do code gắn. Nhóm Facebook tính nguồn facebook."""
        base = (qp["inputs"].get("link_url") or "").strip()
        if not base or draft.get("link_placement", "").startswith("không"):
            draft["link"] = None
            return
        ch = qp["inputs"].get("channel") or "other"
        draft["link"] = {"url": base, "utm_url": checks.utm_url(base, "fanpage" if ch == "fb_group" else ch,
                                                                "viet-nhanh", f"{ch}-{str(qp['_id'])[-6:]}")}

    @staticmethod
    def _attach_link(draft: dict, sc: dict, camp: dict) -> None:
        """Bài MXH dẫn link: gắn UTM bằng code (AI không tự viết URL)."""
        base = ((camp["brief"].get("social") or {}).get("link_url") or "").strip()
        if not base or draft.get("link_placement", "").startswith("không"):
            draft["link"] = None
            return
        ch = sc["episode"].get("channel") or draft.get("channel") or "other"
        draft["link"] = {"url": base, "utm_url": checks.utm_url(base, ch, slug(camp["name"]), f"{ch}-{sc['episode_no']}")}


worker = StudioWorker()
