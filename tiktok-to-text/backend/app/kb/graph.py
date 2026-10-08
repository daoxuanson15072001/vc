"""Bản đồ tri thức VCWIKI — trực quan hoá kiểu Obsidian (graph view) + AI phân tích chủ đề.

- Đồ thị: nút là thẻ, lĩnh vực, tag, chủ đề AI; cạnh là thẻ ↔ lĩnh vực / tag / thẻ cùng tài liệu gốc,
  lĩnh vực ↔ nhánh cha, và liên kết AI tìm ra giữa các thẻ.
- Bản đồ chủ đề AI (`wiki_topic_maps`): Claude đọc tiêu đề + tóm tắt các thẻ trong phạm vi, gom thành chủ đề
  và chỉ ra cặp thẻ liên quan kèm lý do. Chạy nền (vài chục giây), FE hỏi lại tới khi xong.
  Phạm vi một kho: dùng chung cho mọi người xem kho, cần quyền sửa để chạy lại. Phạm vi "mọi kho": của riêng người chạy.
- Xuất Obsidian vault (.zip): mỗi thẻ một ghi chú markdown có frontmatter, [[liên kết]] tới lĩnh vực, chủ đề, thẻ liên quan.
"""

from __future__ import annotations

import io
import re
import threading
import traceback
import zipfile
from collections import Counter, defaultdict
from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import categories as cat_mod
from .. import db, policy
from ..auth import current_user
from . import wiki
from .pipeline import cards
from .routes import names_of, oid, space_scope

router = APIRouter(prefix="/api")
maps = db.db["wiki_topic_maps"]

MAX_GRAPH_CARDS = 1500        # quá bấy nhiêu thẻ thì chỉ vẽ các thẻ cập nhật gần nhất
MAX_AI_CARDS = 400            # số thẻ tối đa gửi AI mỗi lượt phân tích
MIN_TAG_CARDS = 2             # tag chỉ gắn 1 thẻ không tạo nút (đỡ rối đồ thị)
STALE_AFTER = timedelta(minutes=15)   # lượt phân tích treo quá lâu (máy chủ khởi động lại) -> lỗi
CARD_FIELDS = {"title": 1, "summary": 1, "type": 1, "status": 1, "categories": 1, "tags": 1, "space_id": 1,
               "document_id": 1, "sources": 1, "updated_at": 1}


def ensure_indexes() -> None:
    maps.create_index([("space_id", 1), ("category", 1), ("owner_id", 1), ("created_at", -1)])


# ---------------------------------------------------------------------------
# Phạm vi
# ---------------------------------------------------------------------------

def scope_key(space_id: str | None, category: str | None, user: dict) -> dict:
    """Khoá tìm bản đồ chủ đề: một kho cụ thể thì dùng chung, "mọi kho" thì theo từng người."""
    if space_id:
        return {"space_id": policy.load_space(space_id, user)["_id"], "category": category or "", "owner_id": None}
    return {"space_id": None, "category": category or "", "owner_id": user["_id"]}


def card_filter(space_id: str | None, category: str | None, status: str | None, user: dict) -> dict:
    f = space_scope(space_id, user, category)
    f["status"] = {"$in": status.split(",")} if status else {"$ne": "rejected"}
    return f


def load_cards(f: dict, limit: int) -> tuple[list[dict], int]:
    total = cards.count_documents(f)
    rows = list(cards.find(f, CARD_FIELDS).sort("updated_at", -1).limit(limit))
    return rows, total


def latest_map(key: dict) -> dict | None:
    m = maps.find_one(key, sort=[("created_at", -1)])
    if m and m["status"] == "running" and db.now() - m["created_at"] > STALE_AFTER:
        maps.update_one({"_id": m["_id"]}, {"$set": {"status": "error", "error": "Quá thời gian — hãy chạy lại"}})
        m |= {"status": "error", "error": "Quá thời gian — hãy chạy lại"}
    return m


def map_out(m: dict | None, visible: set, user: dict) -> dict | None:
    if not m:
        return None
    # bản đồ của một kho: người sửa được kho chạy lại; bản đồ "mọi kho": chỉ chủ bản đồ
    can_run = policy.can(user, "space.write", {"space_id": m["space_id"]}) if m["space_id"] \
        else m["owner_id"] == user["_id"]
    return {
        "id": str(m["_id"]), "status": m["status"], "error": m.get("error"), "overview": m.get("overview", ""),
        "created_at": m["created_at"], "finished_at": m.get("finished_at"),
        "created_by_name": names_of([m["created_by"]]).get(m["created_by"]),
        "card_count": m.get("card_count", 0), "usage": m.get("usage"), "can_run": can_run,
        "topics": [{"key": t["key"], "name": t["name"], "description": t["description"],
                    "related": t.get("related", []),
                    "count": sum(1 for c in t["card_ids"] if c in visible)} for t in m.get("topics", [])],
    }


# ---------------------------------------------------------------------------
# Đồ thị
# ---------------------------------------------------------------------------

def doc_ids_of(c: dict) -> list:
    ids = [c["document_id"]] if c.get("document_id") else []
    return ids + [s["document_id"] for s in c.get("sources") or [] if s.get("document_id")]


def build_graph(rows: list[dict], m: dict | None) -> tuple[list[dict], list[dict]]:
    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    ids = {c["_id"] for c in rows}
    topic_of: dict = {}
    if m and m["status"] == "done":
        for t in m.get("topics", []):
            for cid in t["card_ids"]:
                topic_of.setdefault(cid, t["key"])

    full = cat_mod.labels()
    tag_count = Counter(t for c in rows for t in set(c.get("tags") or []))
    by_doc: dict = defaultdict(list)
    for c in rows:
        cid = f"c:{c['_id']}"
        nodes[cid] = {"id": cid, "kind": "card", "label": c["title"], "type": c.get("type"),
                      "status": c.get("status"), "topic": topic_of.get(c["_id"])}
        for slug in c.get("categories") or []:
            if slug in full:
                edges.append({"s": cid, "t": f"k:{slug}", "kind": "category"})
                parts = slug.split(".")
                for i in range(len(parts), 0, -1):          # nút lĩnh vực + chuỗi nhánh cha
                    s = ".".join(parts[:i])
                    if f"k:{s}" in nodes:
                        break
                    nodes[f"k:{s}"] = {"id": f"k:{s}", "kind": "category", "label": full.get(s, s).split(" › ")[-1],
                                       "full": full.get(s, s), "level": i}
                    if i > 1:
                        edges.append({"s": f"k:{s}", "t": f"k:{'.'.join(parts[:i - 1])}", "kind": "parent"})
        for t in set(c.get("tags") or []):
            if tag_count[t] >= MIN_TAG_CARDS:
                nodes.setdefault(f"t:{t}", {"id": f"t:{t}", "kind": "tag", "label": f"#{t}"})
                edges.append({"s": cid, "t": f"t:{t}", "kind": "tag"})
        for d in doc_ids_of(c):
            by_doc[d].append(cid)

    seen = set()
    for group in by_doc.values():          # thẻ cùng tài liệu gốc: nối về thẻ đầu (không dựng cả lưới)
        for other in dict.fromkeys(group[1:]):
            pair = tuple(sorted((group[0], other)))
            if other != group[0] and pair not in seen:
                seen.add(pair)
                edges.append({"s": pair[0], "t": pair[1], "kind": "source"})

    if m and m["status"] == "done":
        for t in m.get("topics", []):
            members = [c for c in t["card_ids"] if c in ids]
            if not members:
                continue
            tid = f"p:{t['key']}"
            nodes[tid] = {"id": tid, "kind": "topic", "label": t["name"], "topic": t["key"]}
            edges += [{"s": f"c:{c}", "t": tid, "kind": "topic"} for c in members]
        for lk in m.get("links", []):
            if lk["a"] in ids and lk["b"] in ids:
                edges.append({"s": f"c:{lk['a']}", "t": f"c:{lk['b']}", "kind": "ai", "reason": lk["reason"]})
    return list(nodes.values()), edges


@router.get("/wiki/graph")
def get_graph(space_id: str | None = None, category: str | None = None, status: str | None = None,
              user: dict = Depends(current_user)):
    rows, total = load_cards(card_filter(space_id, category, status, user), MAX_GRAPH_CARDS)
    m = latest_map(scope_key(space_id, category, user))
    done = maps.find_one(scope_key(space_id, category, user) | {"status": "done"}, sort=[("created_at", -1)])
    nodes, edges = build_graph(rows, done)
    visible = {c["_id"] for c in rows}
    return {"nodes": nodes, "edges": edges, "card_total": total, "truncated": total > len(rows),
            "map": map_out(done, visible, user),
            "run": map_out(m, visible, user) if m and (not done or m["_id"] != done["_id"]) else None,
            "can_analyze": wiki.ai_ready()}


# ---------------------------------------------------------------------------
# AI phân tích chủ đề
# ---------------------------------------------------------------------------

SYSTEM = """Bạn là biên tập viên VCWIKI — kho tri thức nội bộ tập đoàn VC Phồn Vinh (phụ tùng ô tô, garage, \
đào tạo nghề, phần mềm). Người dùng cần một bản đồ chủ đề kiểu Obsidian để nhìn tổng thể kho tri thức.

Đầu vào là danh sách thẻ, mỗi dòng: [số] tiêu đề — tóm tắt (loại; lĩnh vực; tag).

Nhiệm vụ:
1. `topics`: gom thẻ thành 4–15 chủ đề có nghĩa với người làm nghề (không chỉ lặp lại tên lĩnh vực). \
Mỗi thẻ thuộc đúng một chủ đề chính; thẻ lạc lõng gom vào chủ đề "Khác". Tên chủ đề ngắn (2–6 từ), \
`description` 1–2 câu nói chủ đề giải quyết vấn đề gì. `related`: số thứ tự (từ 0) các chủ đề khác có liên hệ chặt.
2. `links`: các cặp thẻ có quan hệ đáng đọc cùng nhau — bổ trợ, ví dụ minh hoạ cho khung lý thuyết, bước trước / sau, \
mâu thuẫn cần đối chiếu — ưu tiên cặp khác chủ đề hoặc khác nguồn. `reason` dưới 15 từ. \
Tối đa khoảng 1,5 lần số thẻ; không nối hai thẻ chỉ vì chung chủ đề.
3. `overview`: 2–4 câu nhận xét tổng thể: kho mạnh ở đâu, còn mỏng / thiếu mảng nào.

Chỉ dùng số thứ tự thẻ có trong danh sách. Viết tiếng Việt."""

SCHEMA = {
    "type": "object",
    "properties": {
        "overview": {"type": "string"},
        "topics": {"type": "array", "items": {
            "type": "object",
            "properties": {"name": {"type": "string"}, "description": {"type": "string"},
                           "cards": {"type": "array", "items": {"type": "integer"}},
                           "related": {"type": "array", "items": {"type": "integer"}}},
            "required": ["name", "description", "cards", "related"], "additionalProperties": False}},
        "links": {"type": "array", "items": {
            "type": "object",
            "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}, "reason": {"type": "string"}},
            "required": ["a", "b", "reason"], "additionalProperties": False}},
    },
    "required": ["overview", "topics", "links"],
    "additionalProperties": False,
}


def card_line(i: int, c: dict, full: dict) -> str:
    cats = ", ".join(full.get(s, s) for s in c.get("categories") or [])
    summary = re.sub(r"\s+", " ", c.get("summary") or "")[:220]
    return f"[{i}] {c['title']} — {summary} ({c.get('type')}; {cats}; {' '.join(c.get('tags') or [])})"


def parse_result(res: dict, rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Chỉ số AI trả về -> ObjectId thẻ; bỏ chỉ số ngoài danh sách, thẻ trùng chủ đề, liên kết lặp."""
    n = len(rows)
    taken: set[int] = set()
    topics = []
    for t in res["topics"]:
        members = [i for i in dict.fromkeys(t["cards"]) if 0 <= i < n and i not in taken]
        taken.update(members)
        topics.append({"name": t["name"].strip()[:80], "description": t["description"].strip()[:400],
                       "card_ids": [rows[i]["_id"] for i in members], "related_idx": t["related"]})
    rest = [i for i in range(n) if i not in taken]
    if rest:
        topics.append({"name": "Khác", "description": "Thẻ chưa xếp vào chủ đề nào.",
                       "card_ids": [rows[i]["_id"] for i in rest], "related_idx": []})
    for i, t in enumerate(topics):
        t["key"] = f"t{i}"
    for t in topics:
        t["related"] = [topics[j]["key"] for j in dict.fromkeys(t.pop("related_idx"))
                        if isinstance(j, int) and 0 <= j < len(topics) and topics[j] is not t]
    topics = [t for t in topics if t["card_ids"]]
    links, seen = [], set()
    for lk in res["links"]:
        a, b = lk["a"], lk["b"]
        if 0 <= a < n and 0 <= b < n and a != b and (pair := (min(a, b), max(a, b))) not in seen:
            seen.add(pair)
            links.append({"a": rows[a]["_id"], "b": rows[b]["_id"], "reason": lk["reason"].strip()[:160]})
    return topics, links


def run_analysis(map_id: ObjectId, rows: list[dict]) -> None:
    try:
        full = cat_mod.labels()
        text = "\n".join(card_line(i, c, full) for i, c in enumerate(rows))
        res = wiki.structured_call(SYSTEM, f"Có {len(rows)} thẻ:\n\n{text}", SCHEMA, max_tokens=32000,
                                   too_long="Kết quả quá dài — hãy thu hẹp phạm vi (chọn kho / lĩnh vực)")
        topics, links = parse_result(res, rows)
        maps.update_one({"_id": map_id}, {"$set": {
            "status": "done", "overview": res["overview"], "topics": topics, "links": links,
            "usage": res.get("usage"), "finished_at": db.now()}})
    except Exception as e:  # noqa: BLE001 — mọi lỗi đều ghi lại cho người dùng thấy
        traceback.print_exc()
        maps.update_one({"_id": map_id}, {"$set": {"status": "error", "error": str(e)[:300] or type(e).__name__,
                                                   "finished_at": db.now()}})


class AnalyzeIn(BaseModel):
    space_id: str | None = None
    category: str | None = None


@router.post("/wiki/graph/analyze", status_code=202)
def analyze(body: AnalyzeIn, user: dict = Depends(current_user)):
    if not wiki.ai_ready():
        raise HTTPException(503, wiki.ai_status()["error"] or "AI chưa sẵn sàng")
    key = scope_key(body.space_id, body.category, user)
    if body.space_id:
        policy.load_space(body.space_id, user, "space.write")   # bản đồ dùng chung của kho: cần quyền sửa
    if (m := latest_map(key)) and m["status"] == "running":
        raise HTTPException(409, "Đang phân tích phạm vi này — chờ xong đã")
    f = card_filter(body.space_id, body.category, None, user)
    f["status"] = "approved"
    rows, _ = load_cards(f, MAX_AI_CARDS)          # ưu tiên thẻ đã duyệt, còn chỗ thì thêm thẻ nháp
    if len(rows) < MAX_AI_CARDS:
        f["status"] = "draft"
        rows += load_cards(f, MAX_AI_CARDS - len(rows))[0]
    if len(rows) < 3:
        raise HTTPException(400, "Cần ít nhất 3 thẻ trong phạm vi để phân tích chủ đề")
    doc = key | {"status": "running", "error": None, "card_count": len(rows), "created_by": user["_id"],
                 "created_at": db.now()}
    doc["_id"] = maps.insert_one(doc).inserted_id
    threading.Thread(target=run_analysis, args=(doc["_id"], rows), name="wiki-topic-map", daemon=True).start()
    return {"id": str(doc["_id"]), "status": "running", "card_count": len(rows)}


# ---------------------------------------------------------------------------
# Xuất Obsidian vault
# ---------------------------------------------------------------------------

BAD_CHARS = re.compile(r'[\\/:*?"<>|#^\[\]\n\r\t]+')


def note_name(title: str, used: set) -> str:
    base = re.sub(r"\s+", " ", BAD_CHARS.sub(" ", title)).strip(" .")[:90].strip() or "Không tên"
    name, n = base, 2
    while name.lower() in used:
        name, n = f"{base} ({n})", n + 1
    used.add(name.lower())
    return name


def yaml_str(s: str) -> str:
    return '"' + (s or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ") + '"'


def card_note(c: dict, cat_notes: dict, topic_note: str | None, related: list, names: dict) -> str:
    fm = ["---", f"vcwiki_id: {c['_id']}", f"type: {c.get('type', '')}", f"status: {c.get('status', '')}",
          f"summary: {yaml_str(c.get('summary', ''))}"]
    if tags := c.get("tags"):
        fm += ["tags:"] + [f"  - {t}" for t in tags]
    if cats := [cat_notes[s] for s in c.get("categories") or [] if s in cat_notes]:
        fm += ["linh_vuc:"] + [f'  - "[[{n}]]"' for n in cats]
    if topic_note:
        fm.append(f'chu_de: "[[{topic_note}]]"')
    if src := c.get("source"):
        fm.append(f"nguon: {yaml_str(src.get('title', ''))}")
        if src.get("url"):
            fm.append(f"nguon_url: {src['url']}")
    fm += [f"cap_nhat: {c['updated_at']:%Y-%m-%d}", "---", ""]
    body = [f"# {c['title']}", ""]
    if c.get("summary"):
        body += [f"> {c['summary']}", ""]
    if c.get("body"):
        body += [c["body"].strip(), ""]
    if kp := c.get("key_points"):
        body += ["## Ý chính", *[f"- {p}" for p in kp], ""]
    for key, label in (("when_to_use", "Khi nào dùng"), ("example", "Ví dụ")):
        if c.get(key):
            body += [f"## {label}", c[key].strip(), ""]
    if c.get("evidence"):
        body += ["## Trích dẫn căn cứ", f"> {c['evidence'].strip()}", ""]
    if related:
        body += ["## Liên quan", *[f"- [[{names[o]}]] — {r}" for o, r in related if o in names], ""]
    return "\n".join(fm + body)


@router.get("/wiki/graph/vault.zip")
def export_vault(space_id: str | None = None, category: str | None = None, status: str | None = None,
                 user: dict = Depends(current_user)):
    f = card_filter(space_id, category, status, user)
    rows = list(cards.find(f, {"search_text": 0}).sort("updated_at", -1).limit(MAX_GRAPH_CARDS * 2))
    if not rows:
        raise HTTPException(404, "Không có thẻ nào trong phạm vi để xuất")
    m = maps.find_one(scope_key(space_id, category, user) | {"status": "done"}, sort=[("created_at", -1)])
    used: set = set()
    names = {c["_id"]: note_name(c["title"], used) for c in rows}

    full = cat_mod.labels()
    used_slugs = {s for c in rows for s in c.get("categories") or [] if s in full}
    used_slugs |= {".".join(s.split(".")[:i]) for s in used_slugs for i in range(1, s.count(".") + 1)}
    cat_notes = {s: note_name(f"LV {full[s].split(' › ')[-1]}", used) for s in sorted(used_slugs)}
    topics = m.get("topics", []) if m else []
    topic_notes = {t["key"]: note_name(f"CĐ {t['name']}", used) for t in topics}
    topic_of = {cid: t["key"] for t in topics for cid in t["card_ids"]}
    related = defaultdict(list)
    for lk in (m.get("links", []) if m else []):
        related[lk["a"]].append((lk["b"], lk["reason"]))
        related[lk["b"]].append((lk["a"], lk["reason"]))

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        root = "VCWIKI"
        for c in rows:
            note = card_note(c, cat_notes, topic_notes.get(topic_of.get(c["_id"])), related[c["_id"]], names)
            z.writestr(f"{root}/Thẻ/{names[c['_id']]}.md", note)
        for s, n in cat_notes.items():
            parent = s.rsplit(".", 1)[0] if "." in s else None
            members = [names[c["_id"]] for c in rows if s in (c.get("categories") or [])]
            children = [cat_notes[x] for x in cat_notes if x.rsplit(".", 1)[0] == s and "." in x]
            lines = [f"# {full[s]}", ""]
            if parent in cat_notes:
                lines += [f"Thuộc: [[{cat_notes[parent]}]]", ""]
            if children:
                lines += ["## Nhánh con", *[f"- [[{x}]]" for x in children], ""]
            if members:
                lines += ["## Thẻ", *[f"- [[{x}]]" for x in members], ""]
            z.writestr(f"{root}/Lĩnh vực/{n}.md", "\n".join(lines))
        for t in topics:
            members = [names[c] for c in t["card_ids"] if c in names]
            lines = [f"# {t['name']}", "", t["description"], ""]
            if rel := [topic_notes[k] for k in t.get("related", []) if k in topic_notes]:
                lines += ["## Chủ đề liên quan", *[f"- [[{x}]]" for x in rel], ""]
            lines += ["## Thẻ", *[f"- [[{x}]]" for x in members], ""]
            z.writestr(f"{root}/Chủ đề/{topic_notes[t['key']]}.md", "\n".join(lines))
        home = ["# VCWIKI — bản đồ tri thức", "", f"Xuất lúc {db.now():%d/%m/%Y %H:%M} · {len(rows)} thẻ.", ""]
        if m:
            home += ["## Nhận xét của AI", m.get("overview", ""), "",
                     "## Chủ đề", *[f"- [[{topic_notes[t['key']]}]] ({len(t['card_ids'])} thẻ)" for t in topics], ""]
        home += ["## Lĩnh vực", *[f"- [[{n}]]" for s, n in cat_notes.items() if "." not in s], "",
                 "Mở thư mục này bằng Obsidian (Open folder as vault) rồi bấm Graph view để xem đồ thị."]
        z.writestr(f"{root}/Trang chủ.md", "\n".join(home))
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
                             headers={"Content-Disposition": 'attachment; filename="vcwiki-obsidian.zip"'})
