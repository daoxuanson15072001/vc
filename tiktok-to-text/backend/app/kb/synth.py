"""Tổng hợp VCWIKI theo cụm chủ đề — dành cho nguồn nhiều tài liệu ngắn, lặp ý (kênh video).

Thay vì dựng thẻ cho từng tài liệu (tầng 2 của pipeline), một lượt tổng hợp chạy 4 bước:

  1. sàng lọc  — AI chấm độ hữu ích, tóm tắt 1 dòng, lĩnh vực, chủ đề cho từng tài liệu (theo lô)
  2. gom cụm   — AI nhóm tài liệu đáng giữ thành cụm chủ đề                        → trạng thái `planned`
  3. người sửa kế hoạch: đổi tên / lĩnh vực / số thẻ, chuyển tài liệu giữa các cụm, bỏ / khôi phục tài liệu
  4. viết thẻ  — mỗi cụm 1–3 thẻ, mỗi thẻ dẫn nhiều tài liệu nguồn (`sources`)     → thẻ nháp chờ duyệt

Trong lúc tổng hợp, tài liệu ở trạng thái `grouping` để tầng 2 không dựng thẻ trùng.
"""

from __future__ import annotations

import threading
import time
import traceback
import uuid

from bson import ObjectId

from .. import categories as cat_mod
from .. import db
from ..config import LOCAL_LLM_MODEL, MAX_DOC_CHARS, SYNTH_TRIAGE_MODEL, TRIAGE_ENGINE
from . import ai_slot, classify, embeddings, local_ai
from . import tags as tag_mod
from . import wiki
from .pipeline import card_search_text, cards, documents, sources

runs = db.db["wiki_synth_runs"]

TRIAGE_BATCH = 12             # số tài liệu mỗi lần gọi AI ở bước sàng lọc
TRIAGE_DOC_CHARS = 8000       # sàng lọc chỉ cần nắm ý chính; bước viết thẻ đọc toàn văn
KEEP_MIN = 4                  # độ hữu ích dưới ngưỡng này: đề xuất bỏ qua
CLUSTER_GROUP_MAX = 150       # quá bấy nhiêu tài liệu thì gom cụm riêng theo từng lĩnh vực cấp 1
MAX_CARDS_PER_CLUSTER = 3
LOG_LIMIT = 300
ACTIVE = ("queued", "triaging", "clustering", "planned", "synthesizing")
LOCKABLE = ("skipped", "pending", "error")   # tài liệu chưa vào VCWIKI


def ensure_indexes() -> None:
    runs.create_index([("source_id", 1), ("created_at", -1)])
    runs.create_index("status")
    cards.create_index("sources.document_id")


def log(run_id, msg: str) -> None:
    runs.update_one({"_id": run_id}, {"$push": {"logs": {"$each": [{"at": db.now(), "msg": msg}], "$slice": -LOG_LIMIT}},
                                      "$set": {"updated_at": db.now()}})


def add_usage(total: dict | None, usage: dict | None) -> dict:
    total = dict(total or {"input_tokens": 0, "output_tokens": 0, "calls": 0})
    if usage:
        total["input_tokens"] += usage["input_tokens"]
        total["output_tokens"] += usage["output_tokens"]
        total["calls"] += 1
        total["model"] = usage["model"]
    return total


def new_key() -> str:
    return uuid.uuid4().hex[:8]


# ---------------------------------------------------------------------------
# Tạo / huỷ lượt — gọi từ API
# ---------------------------------------------------------------------------

def create_run(src: dict, user: dict, external: bool) -> dict:
    docs = list(documents.find({"source_id": src["_id"], "wiki_status": {"$in": list(LOCKABLE)}},
                               {"text": 0}).sort("created_at", 1))
    now = db.now()
    run = {
        "space_id": src["space_id"], "source_id": src["_id"], "source_kind": src["kind"],
        "source_title": src.get("title") or src.get("url") or "", "created_by": user["_id"],
        "external": external, "status": "queued", "stage": None, "error": None,
        "progress": {"total": len(docs), "done": 0},
        "docs": [{"id": d["_id"], "title": d["title"], "url": d.get("url"), "chars": d.get("chars", 0),
                  "views": (d.get("meta") or {}).get("views"), "prev_status": d["wiki_status"],
                  "relevance": None, "summary": "", "category": None, "topics": [], "keep": None, "reason": ""}
                 for d in docs],
        "clusters": [], "usage": None, "logs": [], "created_at": now, "updated_at": now,
    }
    run["_id"] = runs.insert_one(run).inserted_id
    documents.update_many({"_id": {"$in": [d["_id"] for d in docs]}}, {"$set": {"wiki_status": "grouping"}})
    log(run["_id"], f"Bắt đầu tổng hợp {len(docs)} tài liệu")
    return run


def release_docs(run: dict, doc_ids=None) -> None:
    """Trả tài liệu còn khoá về trạng thái trước khi tổng hợp."""
    for d in run["docs"]:
        if doc_ids is None or d["id"] in doc_ids:
            documents.update_one({"_id": d["id"], "wiki_status": "grouping"}, {"$set": {"wiki_status": d["prev_status"]}})


def cancel_run(run: dict) -> None:
    runs.update_one({"_id": run["_id"]}, {"$set": {"status": "cancelled", "stage": None, "updated_at": db.now()}})
    release_docs(run)
    log(run["_id"], "Đã huỷ lượt tổng hợp — tài liệu chưa xử lý trả về hàng chờ")


def validate_plan(run: dict, clusters: list[dict]) -> list[dict]:
    """Kế hoạch người dùng gửi lên: mỗi tài liệu thuộc tối đa một cụm, cụm rỗng bị bỏ. Trả về cụm đã chuẩn hoá."""
    known = {str(d["id"]) for d in run["docs"]}
    old = {c["key"]: c for c in run["clusters"]}
    seen: set[str] = set()
    out = []
    for c in clusters:
        ids = [i for i in dict.fromkeys(c.get("doc_ids") or []) if i in known and i not in seen]
        if not ids:
            continue
        seen.update(ids)
        prev = old.get(c.get("key") or "") or {}
        if prev.get("status") == "done":   # cụm đã viết thẻ: giữ nguyên
            out.append(prev)
            continue
        cats = cat_mod.valid_slugs([c.get("category") or ""])
        out.append({
            "key": prev.get("key") or new_key(),
            "title": (c.get("title") or "").strip()[:200] or "Cụm chưa đặt tên",
            "category": cats[0] if cats else None,
            "doc_ids": ids,
            "primary_id": c.get("primary_id") if c.get("primary_id") in ids else ids[0],
            "n_cards": max(1, min(MAX_CARDS_PER_CLUSTER, int(c.get("n_cards") or 1))),
            "note": (c.get("note") or "").strip()[:500],
            "status": "pending", "card_ids": [], "error": None,
        })
    return out


# ---------------------------------------------------------------------------
# Prompt & schema
# ---------------------------------------------------------------------------

SYSTEM_BASE = """Bạn là biên tập viên của VCWIKI — kho kiến thức nội bộ của tập đoàn VC Phồn Vinh \
(phụ tùng ô tô, garage, đào tạo nghề ô tô, phần mềm). Kho phục vụ mọi khối: marketing, bán hàng, \
tài chính, kế toán, nhân sự, kỹ thuật.

Cây lĩnh vực (mã: tên đầy đủ — mô tả):
{tree}"""

TRIAGE_TASK = """

Nhiệm vụ: SÀNG LỌC từng tài liệu (thường là bản chuyển giọng nói của video ngắn, có thể sai chính tả) \
trước khi tổng hợp vào VCWIKI.
- `relevance` 0–10: giá trị làm kiến thức áp dụng được cho doanh nghiệp. Dưới 4: than thở, giải trí, \
quan điểm không có phương pháp, mẹo đã bị chính bình luận phản bác, nội dung quá ít.
- `summary`: một câu tiếng Việt nêu ý chính rút ra được (không kể lại video).
- `category`: mã lĩnh vực cụ thể nhất trong cây.
- `topics`: 2–4 cụm từ chủ đề ngắn, chữ thường (vd "b2b", "kpi marketing", "công cụ research").
- `reason`: nếu relevance < 4, lý do ngắn; ngược lại để trống.
Trả về đúng một mục cho mỗi tài liệu, giữ nguyên `index`."""

CLUSTER_TASK = """

Nhiệm vụ: GOM CỤM các tài liệu đã sàng lọc thành cụm chủ đề để tổng hợp thành thẻ VCWIKI.
- Mỗi cụm là một chủ đề đủ hẹp để viết 1–3 thẻ tri thức; tài liệu nói cùng một ý / bổ sung cho nhau thì chung cụm.
- Mỗi tài liệu nằm trong đúng một cụm. Tài liệu lẻ không hợp cụm nào vẫn được làm cụm riêng.
- Cụm nên có 1–15 tài liệu; chủ đề lớn hơn thì tách.
- `primary_index`: tài liệu giàu nội dung nhất của cụm.
- `n_cards`: 1–3, số thẻ nên viết (ít ý khác biệt thì 1).
- `title`: tên chủ đề ngắn, nói thẳng nội dung. `note`: gợi ý ngắn cho người viết thẻ (góc nhìn, điểm cần lưu ý)."""

SYNTH_TASK = """

Nhiệm vụ: TỔNG HỢP một cụm tài liệu cùng chủ đề thành thẻ tri thức VCWIKI. Nhiều tài liệu thường nhắc lại \
cùng ý — gộp lại thành thẻ đầy đủ hơn từng tài liệu riêng lẻ.

Loại thẻ:
{types}

Quy tắc:
- Chỉ ghi điều có trong tài liệu. Không thêm kiến thức ngoài, không bịa số liệu. Suy luận của bạn (nếu có) \
ghi rõ "*Nhận xét biên tập: …*" ở cuối `body`.
- Mỗi thẻ một ý, đọc riêng vẫn hiểu và áp dụng được. Tiêu đề nói thẳng nội dung.
- `summary` 1–2 câu. `body` markdown (gạch đầu dòng, bước đánh số). `key_points` 3–5 ý.
- `when_to_use`: tình huống cụ thể trong công việc của VC Phồn Vinh.
- `example`: nếu tài liệu có ví dụ thì dùng; có thể thêm ví dụ áp vào phụ tùng / garage / đào tạo nghề nhưng \
phải mở đầu "Ví dụ áp dụng (biên tập):" và không đặt ra con số.
- Ý kiến bình luận, số liệu chưa kiểm chứng (lương, thuế, thị phần…) phải ghi rõ là ý kiến / chưa kiểm chứng.
- `sources`: mọi tài liệu đã dùng cho thẻ, mỗi mục gồm `index`, `quote` (trích nguyên văn < 300 ký tự) và \
`timestamp` (mốc [mm:ss] gần nhất trong tài liệu, không có thì chuỗi rỗng). `evidence` là trích dẫn tiêu biểu nhất.
- `categories` 1–3 mã trong cây. `tags` 2–5 từ khoá chữ thường nối gạch ngang.
{rules}
- Không viết thẻ trùng ý với thẻ đã có trong VCWIKI (danh sách bên dưới nếu có); ý đã có thì bỏ qua.
- Không đủ nội dung giá trị: trả `cards` rỗng và nêu lý do ở `note`."""


def note_of(run: dict, docs=()) -> str:
    """Khối "Ghi chép của người dùng" (WK-44 ghi chú của người nạp + WK-45 ghi chép cả nguồn và của các tài liệu
    `docs` — mục trong `run["docs"]` có id, title) — kèm vào sàng lọc, gom cụm, viết thẻ; không có -> ""."""
    src = sources.find_one({"_id": run["source_id"]}, {"note": 1})
    return wiki.user_notes_block(src, [d["id"] for d in docs], {d["id"]: d.get("title") or "" for d in docs})


def system_prompt(task: str, **extra) -> str:
    return SYSTEM_BASE.format(tree=cat_mod.prompt_tree()) + task.format(**extra)


def triage_schema(slugs: list[str]) -> dict:
    item = {"type": "object", "properties": {
        "index": {"type": "integer"}, "relevance": {"type": "integer"}, "summary": {"type": "string"},
        "category": {"type": "string", "enum": slugs}, "topics": {"type": "array", "items": {"type": "string"}},
        "reason": {"type": "string"}},
        "required": ["index", "relevance", "summary", "category", "topics", "reason"], "additionalProperties": False}
    return {"type": "object", "properties": {"items": {"type": "array", "items": item}},
            "required": ["items"], "additionalProperties": False}


def cluster_schema(slugs: list[str]) -> dict:
    c = {"type": "object", "properties": {
        "title": {"type": "string"}, "category": {"type": "string", "enum": slugs},
        "doc_indexes": {"type": "array", "items": {"type": "integer"}}, "primary_index": {"type": "integer"},
        "n_cards": {"type": "integer"}, "note": {"type": "string"}},
        "required": ["title", "category", "doc_indexes", "primary_index", "n_cards", "note"], "additionalProperties": False}
    return {"type": "object", "properties": {"clusters": {"type": "array", "items": c}},
            "required": ["clusters"], "additionalProperties": False}


def synth_schema(slugs: list[str]) -> dict:
    src = {"type": "object", "properties": {"index": {"type": "integer"}, "quote": {"type": "string"},
                                            "timestamp": {"type": "string"}},
           "required": ["index", "quote", "timestamp"], "additionalProperties": False}
    card = {"type": "object", "properties": {
        "type": {"type": "string", "enum": list(wiki.CARD_TYPES)}, "title": {"type": "string"},
        "summary": {"type": "string"}, "body": {"type": "string"},
        "key_points": {"type": "array", "items": {"type": "string"}}, "when_to_use": {"type": "string"},
        "example": {"type": "string"}, "evidence": {"type": "string"},
        "categories": {"type": "array", "items": {"type": "string", "enum": slugs}},
        "tags": {"type": "array", "items": {"type": "string"}}, "sources": {"type": "array", "items": src},
        **classify.ai_schema_props()},
        "required": ["type", "title", "summary", "body", "key_points", "when_to_use", "example", "evidence",
                     "categories", "tags", "sources", *classify.ai_schema_props()], "additionalProperties": False}
    return {"type": "object", "properties": {"cards": {"type": "array", "items": card}, "note": {"type": "string"}},
            "required": ["cards", "note"], "additionalProperties": False}


def doc_line(i: int, d: dict) -> str:
    views = f"{d['views']:,} lượt xem".replace(",", ".") if d.get("views") else ""
    return " | ".join(x for x in [f"D{i}", d.get("category") or "", f"hữu ích {d.get('relevance')}", views,
                                  d["title"][:120], d.get("summary") or "", ", ".join(d.get("topics") or [])] if x)


# ---------------------------------------------------------------------------
# Luồng nền
# ---------------------------------------------------------------------------

class Stop(Exception):
    """Lượt bị huỷ / AI tạm chưa dùng được — dừng xử lý lượt này ở vòng hiện tại."""


class SynthWorker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="kb-synth", daemon=True)

    def start(self) -> None:
        runs.update_many({"status": {"$in": ["triaging", "clustering"]}}, {"$set": {"status": "queued"}})
        runs.update_many({"clusters.status": "running"}, {"$set": {"clusters.$[c].status": "pending"}},
                         array_filters=[{"c.status": "running"}])
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            worked = False
            if wiki.ai_ready():
                try:   # tinh chế dùng chung một chỗ với xử lý thô / vector hoá (kb/ai_slot.py)
                    if runs.count_documents({"status": "queued"}, limit=1):
                        with ai_slot.hold("tinh_che", "Tổng hợp theo cụm: sàng lọc"):
                            worked = self._plan_next()
                    if not worked and runs.count_documents({"status": "synthesizing"}, limit=1):
                        with ai_slot.hold("tinh_che", "Tổng hợp theo cụm: viết thẻ"):
                            worked = self._synth_next()
                except Exception:  # noqa: BLE001 — không để luồng nền chết
                    traceback.print_exc()
            if not worked:
                self._stop.wait(2)

    def _ai(self, run_id, fn):
        """Gọi AI; lượt bị huỷ giữa chừng thì bỏ kết quả. Lỗi tạm thời → Stop (vòng sau thử lại)."""
        try:
            res = fn()
        except wiki.AINotReady as e:
            runs.update_one({"_id": run_id}, {"$set": {"error": str(e)}})
            raise Stop from e
        except wiki.AIRetryLater as e:
            log(run_id, f"⚠ AI bận, thử lại sau 30 giây: {e}")
            time.sleep(30)
            raise Stop from e
        run = runs.find_one({"_id": run_id}, {"status": 1, "usage": 1})
        if not run or run["status"] == "cancelled":
            raise Stop
        runs.update_one({"_id": run_id}, {"$set": {"usage": add_usage(run.get("usage"), res.pop("usage", None)),
                                                   "error": None}})
        return res

    # --- Bước 1 + 2: sàng lọc, gom cụm → kế hoạch chờ người duyệt --------------------------

    def _plan_next(self) -> bool:
        run = runs.find_one_and_update({"status": "queued"}, {"$set": {"status": "triaging", "stage": "triage"}},
                                       sort=[("created_at", 1)], return_document=True)
        if not run:
            return False
        rid = run["_id"]
        try:
            self._triage(run)
            run = runs.find_one({"_id": rid})
            runs.update_one({"_id": rid}, {"$set": {"status": "clustering", "stage": "cluster"}})
            self._cluster(run)
        except Stop:
            runs.update_one({"_id": rid, "status": {"$in": ["triaging", "clustering"]}}, {"$set": {"status": "queued"}})
            return True
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            runs.update_one({"_id": rid}, {"$set": {"status": "error", "error": str(e)[:500]}})
            log(rid, f"✗ {str(e)[:300]}")
            release_docs(run)
        return True

    def _triage(self, run: dict) -> None:
        rid = run["_id"]
        todo = [(i, d) for i, d in enumerate(run["docs"]) if d["relevance"] is None]
        done = len(run["docs"]) - len(todo)
        runs.update_one({"_id": rid}, {"$set": {"progress": {"total": len(run["docs"]), "done": done}}})
        if todo:
            log(rid, f"Sàng lọc {len(todo)} tài liệu")
        slugs = [c["slug"] for c in cat_mod.ai_list()]
        system = system_prompt(TRIAGE_TASK)
        for start in range(0, len(todo), TRIAGE_BATCH):
            if start and ai_slot.should_yield():   # giữ chỗ quá lâu, việc khác đang chờ: lưu dở, lượt sau làm tiếp
                log(rid, "Tạm nhường việc khác đang chờ (một lúc chỉ làm một việc) — lát nữa sàng lọc tiếp")
                raise Stop
            batch = todo[start:start + TRIAGE_BATCH]
            texts = {d["_id"]: d.get("text", "") for d in documents.find({"_id": {"$in": [d["id"] for _, d in batch]}},
                                                                         {"text": 1})}
            parts = []
            for i, d in batch:
                text = texts.get(d["id"], "")
                cut = " (đã rút gọn cho bước sàng lọc)" if len(text) > TRIAGE_DOC_CHARS else ""
                parts.append(f'<tai_lieu index="{i}" tieu_de="{d["title"][:150]}"{cut}>\n'
                             f"{text[:TRIAGE_DOC_CHARS]}\n</tai_lieu>")
            note = note_of(run, [d for _, d in batch])
            body = "\n\n".join(([note] if note else []) + parts)
            res = self._ai(rid, lambda: local_ai.structured_call(system, body, triage_schema(slugs),
                                                                 engine=TRIAGE_ENGINE, max_tokens=8000,
                                                                 model=SYNTH_TRIAGE_MODEL))
            got = {it["index"]: it for it in res["items"]}
            upd = {}
            for i, _ in batch:
                it = got.get(i)
                if not it:   # AI bỏ sót: giữ lại để người duyệt quyết định
                    it = {"relevance": KEEP_MIN, "summary": "", "category": None, "topics": [], "reason": "AI không chấm"}
                rel = max(0, min(10, it["relevance"]))
                upd.update({f"docs.{i}.relevance": rel, f"docs.{i}.summary": it["summary"],
                            f"docs.{i}.category": it["category"], f"docs.{i}.topics": it["topics"][:4],
                            f"docs.{i}.keep": rel >= KEEP_MIN, f"docs.{i}.reason": it["reason"] if rel < KEEP_MIN else ""})
            done += len(batch)
            runs.update_one({"_id": rid}, {"$set": upd | {"progress.done": done}})
        kept = sum(1 for d in runs.find_one({"_id": rid})["docs"] if d["keep"])
        log(rid, f"Sàng lọc xong: giữ {kept}, đề xuất bỏ {len(run['docs']) - kept}")

    def _cluster(self, run: dict) -> None:
        rid = run["_id"]
        kept = [(i, d) for i, d in enumerate(run["docs"]) if d["keep"]]
        if not kept:
            runs.update_one({"_id": rid}, {"$set": {"status": "planned", "stage": None, "clusters": []}})
            log(rid, "Không còn tài liệu nào đáng giữ — xem lại danh sách bỏ qua")
            return
        groups: dict[str, list] = {}
        if len(kept) > CLUSTER_GROUP_MAX:   # nguồn lớn: gom cụm trong từng lĩnh vực cấp 1
            for i, d in kept:
                groups.setdefault((d["category"] or "khac").split(".")[0], []).append((i, d))
        else:
            groups["all"] = kept
        runs.update_one({"_id": rid}, {"$set": {"progress": {"total": len(groups), "done": 0}}})
        log(rid, f"Gom cụm {len(kept)} tài liệu" + (f" theo {len(groups)} lĩnh vực" if len(groups) > 1 else ""))
        slugs = [c["slug"] for c in cat_mod.ai_list()]
        system = system_prompt(CLUSTER_TASK)
        clusters: list[dict] = []
        for n, items in enumerate(groups.values(), 1):
            lines = "\n".join(doc_line(i, d) for i, d in items)
            note = note_of(run, [d for _, d in items])
            res = self._ai(rid, lambda: wiki.structured_call(system, (f"{note}\n\n" if note else "")
                                                             + f"Danh sách tài liệu:\n{lines}",
                                                             cluster_schema(slugs), max_tokens=32000))
            valid = {i for i, _ in items}
            used: set[int] = set()
            for c in res["clusters"]:
                idx = [i for i in dict.fromkeys(c["doc_indexes"]) if i in valid and i not in used]
                if not idx:
                    continue
                used.update(idx)
                primary = c["primary_index"] if c["primary_index"] in idx else idx[0]
                clusters.append({"key": new_key(), "title": c["title"][:200], "category": c["category"],
                                 "doc_ids": [str(run["docs"][i]["id"]) for i in idx],
                                 "primary_id": str(run["docs"][primary]["id"]),
                                 "n_cards": max(1, min(MAX_CARDS_PER_CLUSTER, c["n_cards"])), "note": c["note"][:500],
                                 "status": "pending", "card_ids": [], "error": None})
            missed = [i for i in valid if i not in used]
            if missed:   # AI bỏ sót tài liệu: gom vào một cụm để người duyệt sắp xếp lại
                clusters.append({"key": new_key(), "title": "Chưa phân cụm", "category": None,
                                 "doc_ids": [str(run["docs"][i]["id"]) for i in missed],
                                 "primary_id": str(run["docs"][missed[0]]["id"]), "n_cards": 1,
                                 "note": "AI chưa xếp các tài liệu này vào cụm nào — hãy chuyển sang cụm phù hợp",
                                 "status": "pending", "card_ids": [], "error": None})
            runs.update_one({"_id": rid}, {"$set": {"progress.done": n}})
        runs.update_one({"_id": rid}, {"$set": {"clusters": clusters, "status": "planned", "stage": None}})
        log(rid, f"Đề xuất {len(clusters)} cụm, khoảng {sum(c['n_cards'] for c in clusters)} thẻ — chờ người duyệt kế hoạch")

    # --- Bước 4: viết thẻ từng cụm ----------------------------------------------------------

    def _synth_next(self) -> bool:
        run = runs.find_one({"status": "synthesizing"}, sort=[("updated_at", 1)])
        if not run:
            return False
        rid = run["_id"]
        idx = next((i for i, c in enumerate(run["clusters"]) if c["status"] == "pending"), None)
        if idx is None:
            self._finish(run)
            return True
        cluster = run["clusters"][idx]
        runs.update_one({"_id": rid}, {"$set": {f"clusters.{idx}.status": "running", "stage": cluster["title"]}})
        ai_slot.set_detail(f"Tổng hợp theo cụm: {cluster['title'][:80]}")
        try:
            ids = self._write_cards(run, cluster)
        except Stop:
            runs.update_one({"_id": rid, f"clusters.{idx}.status": "running"},
                            {"$set": {f"clusters.{idx}.status": "pending"}})
            return True
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            runs.update_one({"_id": rid}, {"$set": {f"clusters.{idx}.status": "error",
                                                    f"clusters.{idx}.error": str(e)[:500]}})
            log(rid, f"✗ Cụm \"{cluster['title']}\": {str(e)[:300]}")
            return True
        done = sum(1 for c in run["clusters"] if c["status"] == "done") + 1
        runs.update_one({"_id": rid}, {"$set": {f"clusters.{idx}.status": "done", f"clusters.{idx}.card_ids": ids,
                                                f"clusters.{idx}.error": None, "progress.done": done}})
        log(rid, f"→ \"{cluster['title']}\": {len(ids)} thẻ")
        return True

    def _write_cards(self, run: dict, cluster: dict) -> list[ObjectId]:
        rid = run["_id"]
        by_id = {str(d["id"]): d for d in run["docs"]}
        members = [by_id[i] for i in cluster["doc_ids"] if i in by_id]
        # tài liệu chính trước, còn lại theo độ hữu ích — nếu quá dài thì phần cuối không đưa vào (có ghi log)
        members.sort(key=lambda d: (str(d["id"]) != cluster["primary_id"], -(d["relevance"] or 0)))
        texts = {d["_id"]: d for d in documents.find({"_id": {"$in": [m["id"] for m in members]}}, {"text": 1, "title": 1})}
        parts, used, total = [], [], 0
        for n, m in enumerate(members):
            text = (texts.get(m["id"]) or {}).get("text", "")
            if used and total + len(text) > MAX_DOC_CHARS:
                log(rid, f"⚠ Cụm \"{cluster['title']}\" quá dài: bỏ bớt {len(members) - n} tài liệu ít hữu ích — nên tách cụm")
                break
            total += len(text)
            used.append(m)
            parts.append(f'<tai_lieu index="{len(used) - 1}" tieu_de="{m["title"][:150]}">\n{text}\n</tai_lieu>')

        cats = [cluster["category"]] if cluster.get("category") else []
        existing = list(cards.find({"space_id": run["space_id"], "status": {"$ne": "rejected"},
                                    "type": {"$in": list(wiki.CARD_TYPES)},
                                    **({"categories": {"$in": cat_mod.with_descendants(cats[0])}} if cats else {})},
                                   {"title": 1}).limit(80))
        header = [f"Chủ đề cụm: {cluster['title']}", f"Số thẻ tối đa: {cluster['n_cards']}"]
        if cluster.get("note"):
            header.append(f"Ghi chú của người duyệt / AI gom cụm: {cluster['note']}")
        if note := note_of(run, used):
            header.append(note)
        if run.get("source_kind") in ("video", "audio", "video_file"):
            header.append("Tài liệu là bản chuyển giọng nói, có thể sai chính tả tên riêng — hiệu đính khi chắc chắn, "
                          "không chắc thì ghi nguyên văn.")
        if existing:
            header.append("Thẻ đã có trong VCWIKI (không viết trùng):\n" + "\n".join(f"- {c['title']}" for c in existing))
        slugs = [c["slug"] for c in cat_mod.ai_list()]
        system = system_prompt(SYNTH_TASK, types="\n".join(f"- {k}: {v}" for k, v in wiki.CARD_TYPES.items()),
                               rules=classify.AI_RULES)
        res = self._ai(rid, lambda: wiki.structured_call(system, "\n".join(header) + "\n\n" + "\n\n".join(parts),
                                                         synth_schema(slugs), max_tokens=32000))

        src = sources.find_one({"_id": run["source_id"]}, {"kind": 1, "url": 1}) or {}
        primary = next((m for m in used if str(m["id"]) == cluster["primary_id"]), used[0])
        extra_tags = ["nguon-ben-ngoai"] if run.get("external") else []
        now = db.now()
        model = (res.get("usage") or {}).get("model") or ""
        by = db.refiner("synth", "Tổng hợp cụm (AI local — thay Claude)" if model.startswith("local:") else "Tổng hợp cụm",
                        model or None)
        new_cards = []
        for c in res["cards"][:cluster["n_cards"]]:
            refs = []
            for s in c["sources"]:
                if 0 <= s["index"] < len(used) and all(r["document_id"] != used[s["index"]]["id"] for r in refs):
                    m = used[s["index"]]
                    refs.append({"document_id": m["id"], "title": m["title"], "url": m.get("url"),
                                 "quote": s["quote"][:400], "timestamp": s["timestamp"][:12]})
            # tag AI đặt + tag các tài liệu được trích dẫn (xem kb/tags.py)
            tags = tag_mod.inherit(db.clean_tags(c["tags"])[:6] + extra_tags,
                                   [r["document_id"] for r in refs] or [primary["id"]])
            card = {k: c[k] for k in ("type", "title", "summary", "body", "key_points", "when_to_use", "example",
                                      "evidence")} | classify.split(classify.from_ai(c))[0] | {
                "categories": cat_mod.valid_slugs(c["categories"]) or cats, "tags": tags, "sources": refs,
                "space_id": run["space_id"], "source_id": run["source_id"], "document_id": primary["id"],
                "source": {"kind": src.get("kind"), "title": primary["title"], "url": primary.get("url") or src.get("url")},
                "status": "draft", "origin": "ai", "synth_run_id": rid, "created_by": run["created_by"],
                "refined_by": by, "created_at": now, "updated_at": now}
            card["search_text"] = card_search_text(card)
            new_cards.append(card)
        if runs.find_one({"_id": rid}, {"status": 1})["status"] != "synthesizing":
            raise Stop
        if new_cards:
            cards.insert_many(new_cards)
            embeddings.schedule([c["_id"] for c in new_cards])   # tìm theo nghĩa — nền
            from . import changes   # nhập muộn: changes -> novelty -> pipeline
            changes.submit_new_cards([c["_id"] for c in new_cards], "ai")   # GOV: vào hộp duyệt, cổng so sánh chạy nền
        elif res.get("note"):
            log(rid, f"Cụm \"{cluster['title']}\" không tạo thẻ: {res['note'][:300]}")
        ids = [c["_id"] for c in new_cards]
        summary = f"Tổng hợp vào cụm \"{cluster['title']}\" ({len(ids)} thẻ)"
        for m in members:
            documents.update_one({"_id": m["id"]}, {"$set": {
                "wiki_status": "done", "wiki_error": None, "wiki_at": now, "summary": m.get("summary") or summary,
                "relevance": m.get("relevance"), "categories": cat_mod.valid_slugs([m.get("category") or ""]) or cats,
                "primary_category": m.get("category"), "refined_by": by,
                "card_count": cards.count_documents({"sources.document_id": m["id"]})}})
        return ids

    def _finish(self, run: dict) -> None:
        rid = run["_id"]
        in_cluster = {i for c in run["clusters"] for i in c["doc_ids"]}
        failed = {i for c in run["clusters"] if c["status"] == "error" for i in c["doc_ids"]}
        now = db.now()
        for d in run["docs"]:
            if str(d["id"]) not in in_cluster:   # người duyệt / AI bỏ qua: đánh dấu đã xem, ghi lý do
                documents.update_one({"_id": d["id"], "wiki_status": "grouping"}, {"$set": {
                    "wiki_status": "done", "wiki_error": None, "wiki_at": now, "card_count": 0,
                    "refined_by": db.refiner("synth", "Sàng lọc tổng hợp (bỏ qua)",
                                              LOCAL_LLM_MODEL if TRIAGE_ENGINE == "local" else SYNTH_TRIAGE_MODEL),
                    "relevance": d.get("relevance"), "summary": f"Bỏ qua khi tổng hợp: {d.get('reason') or 'không đưa vào cụm nào'}"}})
        release_docs(run, {ObjectId(i) for i in failed})
        n_cards = sum(len(c["card_ids"]) for c in run["clusters"])
        runs.update_one({"_id": rid}, {"$set": {"status": "done", "stage": None, "finished_at": now}})
        log(rid, f"Hoàn tất: {n_cards} thẻ nháp từ {len(run['clusters'])} cụm"
                 + (f" · {len({c['key'] for c in run['clusters'] if c['status'] == 'error'})} cụm lỗi" if failed else ""))


worker = SynthWorker()
