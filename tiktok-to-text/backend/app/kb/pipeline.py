"""Luồng xử lý Kho tư liệu, chạy nền:

  nguồn `queued` ──tầng 1: chuyển thành chữ──► tài liệu (kb_documents + data/raw/<id>/text/<khoá>.md)
  tài liệu `pending` ──tầng 2: Claude dựng thẻ──► thẻ VCWIKI (wiki_cards, draft) ──người duyệt──► approved

Tầng 1 chia hai làn để ghi âm 2 tiếng không chặn bài viết / PDF xếp sau:
  - làn nhẹ: bài viết, PDF, ảnh, Google, Office — kiêm luôn tầng 2
  - làn nặng: video mạng xã hội, video tải lên, ghi âm — cần Whisper (khoá GPU chung)
Mọi làn dùng chung một chỗ với dịch / vector hoá / tinh chế (kb/ai_slot.py): một lúc chỉ một việc, theo thứ tự bước
— chép chữ xong cả loạt rồi mới dịch (video tiếng nước ngoài chờ dịch: `translate_pending`), dịch xong mới dựng thẻ.
Trong mỗi làn: nguồn ưu tiên (priority cao) trước, cùng mức thì nạp trước làm trước — xem set_priority.
Nguồn tắt "Dựng thẻ VCWIKI" (options.build_wiki = False) dừng ở tầng 1: tài liệu `skipped`.
Dữ liệu thô (file gốc, HTML, metadata / phụ đề video) nằm trong data/raw/<source_id>/ và không bị sửa.
"""

from __future__ import annotations

import os
import re
import shutil
import socket
import threading
import time
import traceback
from datetime import timedelta
from pathlib import Path

from .. import categories as cat_mod
from .. import db
from ..config import CLAUDE_QUOTA_PAUSE, RAW_DIR
from . import ai_slot, classify, embeddings, local_ai
from . import wiki
from .adapters import ADAPTERS, Context, MoveToHeavyLane, lane_of

sources = db.db["kb_sources"]
documents = db.db["kb_documents"]
cards = db.db["wiki_cards"]

LOG_LIMIT = 300
LANES = ("light", "heavy")
LANE_LABEL = {"light": "Bài viết / file", "heavy": "Video / ghi âm (Whisper)"}


def ensure_indexes() -> None:
    sources.create_index([("space_id", 1), ("created_at", -1)])
    sources.create_index([("status", 1), ("lane", 1), ("priority", -1), ("created_at", 1)])
    sources.create_index([("space_id", 1), ("google.id", 1)])
    documents.create_index([("source_id", 1), ("key", 1)], unique=True)
    documents.create_index([("wiki_status", 1), ("priority", -1), ("created_at", 1)])
    documents.create_index([("wiki_status", 1), ("wiki_at", -1)])
    cards.create_index([("space_id", 1), ("status", 1), ("created_at", -1)])
    documents.create_index("tags")
    documents.create_index("meta.video_id", sparse=True)
    documents.create_index("url", sparse=True)   # FE tra link trong thẻ -> tài liệu (POST /kb/documents/lookup)
    cards.create_index("document_id")
    cards.create_index("sources.document_id")
    cards.create_index("tags")
    cards.create_index([("space_id", 1), ("type", 1), ("memory_key", 1)])
    # nguồn tạo trước khi có làn xử lý
    for kind in ADAPTERS:
        sources.update_many({"kind": kind, "lane": {"$exists": False}}, {"$set": {"lane": lane_of(kind)}})
    # nguồn / tài liệu tạo trước khi có ưu tiên
    sources.update_many({"priority": {"$exists": False}}, {"$set": {"priority": 0}})
    documents.update_many({"priority": {"$exists": False}}, {"$set": {"priority": 0}})


def raw_dir(source_id) -> Path:
    return RAW_DIR / str(source_id)


def text_path(source_id, key: str) -> Path:
    return raw_dir(source_id) / "text" / (re.sub(r"[^\w.-]+", "_", key)[:120] + ".md")


def log(source_id, msg: str) -> None:
    sources.update_one({"_id": source_id}, {"$push": {"logs": {"$each": [{"at": db.now(), "msg": msg}],
                                                               "$slice": -LOG_LIMIT}}})


def wants_wiki(src: dict) -> bool:
    return (src.get("options") or {}).get("build_wiki", True) is not False


def delete_source_data(source: dict, keep_approved: bool = True) -> None:
    """Xoá dữ liệu thô, tài liệu và thẻ nháp. Thẻ đã duyệt được giữ lại (mất liên kết nguồn)."""
    from . import changes   # nhập muộn: changes -> novelty -> pipeline
    from . import notes      # ghi chép của nguồn và từng tài liệu đi theo nguồn (WK-45)
    documents.delete_many({"source_id": source["_id"]})
    notes.delete_for_source(source["_id"])
    gone = {"source_id": source["_id"], "status": {"$ne": "approved"}} if keep_approved else {"source_id": source["_id"]}
    for c in cards.find(gone, {"_id": 1}):
        changes.on_card_deleted(c["_id"])   # đề xuất đang mở của thẻ nháp bị xoá -> rút
    cards.delete_many(gone)
    cards.update_many({"source_id": source["_id"]}, {"$set": {"source_deleted": True}})
    shutil.rmtree(raw_dir(source["_id"]), ignore_errors=True)
    from .preview import drop_cache   # nhập muộn: preview -> pipeline
    drop_cache(source["_id"])        # bản xem trước Office nằm ngoài raw_dir


def queue_position(src: dict) -> int | None:
    """Thứ tự trong hàng chờ của làn (1 = làm ngay sau việc đang chạy). None nếu nguồn không đang chờ."""
    if src.get("status") != "queued":
        return None
    p = src.get("priority") or 0
    return 1 + sources.count_documents({"status": "queued", "lane": src.get("lane"), "_id": {"$ne": src["_id"]}, "$or": [
        {"priority": {"$gt": p}}, {"priority": p, "created_at": {"$lt": src["created_at"]}}]})


def set_priority(src: dict, top: bool) -> int:
    """Đưa nguồn lên đầu hàng (cao hơn mọi nguồn đang chờ / đang chạy ở cả hai làn — ai_slot chỉ cho một việc chuyển
    chữ chạy một lúc), hoặc trả về mức thường. Nguồn đang chạy (kênh), kể cả ở làn kia, nhường sau video hiện tại rồi
    chạy tiếp sau (Context.should_yield). Tài liệu chờ dựng thẻ theo cùng mức."""
    priority = 0
    if top:
        head = sources.find_one({"status": {"$in": ["queued", "extracting"]}, "_id": {"$ne": src["_id"]}},
                                {"priority": 1}, sort=[("priority", -1)])
        priority = max((head or {}).get("priority") or 0, src.get("priority") or 0, 0) + 1
    sources.update_one({"_id": src["_id"]}, {"$set": {"priority": priority}})
    documents.update_many({"source_id": src["_id"]}, {"$set": {"priority": priority}})
    log(src["_id"], "⇡ Ưu tiên xử lý trước" if top else "Bỏ ưu tiên — xếp lại theo thời gian nạp")
    return priority


def card_search_text(c: dict) -> str:
    return db.unaccent(" ".join([c.get("title", ""), c.get("summary", ""), c.get("body", ""),
                                 " ".join(c.get("tags", [])),
                                 " ".join(f"{k} {v}" for k, v in (c.get("fields") or {}).items())]))


def save_document(src: dict, d, build_wiki: bool) -> None:
    """Ghi một tài liệu của tầng 1: bản chữ ra file .md cạnh dữ liệu thô + bản ghi kb_documents.
    Tài liệu mới mang sẵn tag của nguồn và của video gốc (bảng `videos`) — xem kb/tags.py."""
    path = text_path(src["_id"], d.key)
    tags = list(src.get("tags") or [])
    if vid := (d.meta or {}).get("video_id"):
        tags += (db.videos.find_one({"_id": vid}, {"tags": 1}) or {}).get("tags") or []
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(d.text, encoding="utf-8")
    fields = {"space_id": src["space_id"], "title": d.title, "text": d.text, "url": d.url,
              "meta": d.meta, "images": d.images, "chars": len(d.text), "text_engine": d.engine,
              "text_file": str(path.relative_to(raw_dir(src["_id"]))),
              "translate_pending": bool((d.meta or {}).get("translation_pending")),   # chờ bước dịch (ai_slot)
              "priority": src.get("priority") or 0, "updated_at": db.now()}
    old = documents.find_one({"source_id": src["_id"], "key": d.key}, {"text": 1})
    if old and cards.count_documents({"document_id": old["_id"], "status": {"$ne": "rejected"}}, limit=1):
        # đã có thẻ VCWIKI: không dựng lại ngay — nội dung đổi thì chờ lượt cập nhật thẻ hằng ngày (kb/card_update.py)
        if old.get("text") != d.text:
            fields |= {"card_update": "waiting", "text_changed_at": db.now()}
        documents.update_one({"_id": old["_id"]}, {"$set": fields})
        return
    documents.update_one(
        {"source_id": src["_id"], "key": d.key},
        {"$set": fields | {
            # lĩnh vực người nạp chọn — AI sẽ phân loại lại khi dựng thẻ
            "categories": src.get("categories") or [],
            "primary_category": (src.get("categories") or [None])[0],
            "wiki_status": "pending" if build_wiki else "skipped", "wiki_error": None},
         "$setOnInsert": {"created_at": db.now(), "tags": db.clean_tags(tags)}},
        upsert=True,
    )


WORKER = {"host": socket.gethostname(), "pid": os.getpid()}


def worker_alive(w: dict | None) -> bool:
    """Tiến trình đang giữ việc còn sống? (chỉ kiểm được tiến trình trên cùng máy)"""
    if not w or w.get("host") != WORKER["host"] or w.get("pid") == WORKER["pid"]:
        return False
    try:
        os.kill(w["pid"], 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


class Pipeline:
    def __init__(self) -> None:
        self._stop = threading.Event()
        # làn "redo": lấy lại chữ từng video (kb/redo.py) — không xếp sau kênh đang chạy ở làn nặng
        self._threads = [threading.Thread(target=self._loop, args=(lane,), name=f"kb-{lane}", daemon=True)
                         for lane in (*LANES, "redo")]

    def start(self) -> None:
        # việc dở của lần chạy trước -> trả lại hàng chờ; nhưng nếu một tiến trình khác vẫn đang chạy nó
        # (máy chủ cũ chưa tắt hẳn) thì để yên, tránh hai tiến trình cùng tải một kênh
        stale = [s["_id"] for s in sources.find({"status": "extracting"}, {"worker": 1}) if not worker_alive(s.get("worker"))]
        if stale:
            sources.update_many({"_id": {"$in": stale}, "status": "extracting"}, {"$set": {"status": "queued"}})
        documents.update_many({"translating": True}, {"$set": {"translating": False}})
        # tài liệu Claude (qua MCP claim_documents) đang làm thì để yên — hết hạn nhận việc mới tự về hàng chờ
        documents.update_many({"wiki_status": "processing", "claimed_by": None}, {"$set": {"wiki_status": "pending"}})
        for t in self._threads:
            t.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self, lane: str) -> None:
        ticked = 0.0
        while not self._stop.is_set():
            try:
                if lane == "light" and time.monotonic() - ticked > 60:   # cập nhật thẻ hằng ngày (kb/card_update.py)
                    from . import card_update
                    card_update.safe_tick()
                    ticked = time.monotonic()
                worked = False
                if lane == "redo":
                    from . import redo   # nhập muộn: redo -> pipeline
                    if redo.has_work():
                        with ai_slot.hold("tho", "Lấy lại chữ video"):
                            worked = redo.run_next()
                else:
                    if sources.count_documents({"status": "queued", "lane": lane}, limit=1):
                        with ai_slot.hold("tho", LANE_LABEL[lane]):
                            worked = self._extract_next(lane)
                    if not worked and lane == "light" and self._translate_waiting():
                        with ai_slot.hold("dich", "Dịch sang tiếng Việt"):
                            worked = self._translate_next()
                    if not worked and lane == "light" and self._wiki_waiting():
                        with ai_slot.hold("tinh_che", "Dựng thẻ VCWIKI"):
                            worked = self._wiki_next()
            except Exception:  # noqa: BLE001 — không để luồng nền chết
                traceback.print_exc()
                worked = False
            if not worked:
                self._stop.wait(1.5)

    # --- Tầng 1: dữ liệu thô -> bản chữ chuẩn --------------------------------------------

    def _extract_next(self, lane: str) -> bool:
        from . import redo
        if redo.manual_waiting():   # "Lấy lại chữ" thủ công đi trước nguồn đang chờ (kb/redo.py)
            return False
        src = sources.find_one_and_update(
            {"status": "queued", "lane": lane},
            {"$set": {"status": "extracting", "started_at": db.now(), "error": None, "worker": WORKER,
                      "progress": {"total": 0, "processed": 0, "ok": 0, "failed": 0, "skipped": 0}}},
            sort=[("priority", -1), ("created_at", 1)], return_document=True)
        if not src:
            return False
        sid = src["_id"]
        rdir = raw_dir(sid)
        rdir.mkdir(parents=True, exist_ok=True)
        existing = {d["key"] for d in documents.find({"source_id": sid}, {"key": 1})}

        def progress(set_total: int | None = None, **inc) -> None:
            upd: dict = {}
            if set_total is not None:
                upd["$set"] = {"progress.total": set_total}
            if inc:
                upd["$inc"] = {f"progress.{k}": v for k, v in inc.items()}
            if upd:
                sources.update_one({"_id": sid}, upd)

        yield_why: list[str] = []

        def should_yield() -> bool:
            """Nút "Ưu tiên" của nguồn khác (cả làn kia — một lúc chỉ một việc chuyển chữ), "Lấy lại chữ" thủ công
            ở nguồn khác, hoặc có bước đứng trước đang chờ (kb/ai_slot.py): nguồn đang chạy nhường sau mục hiện tại."""
            from . import redo
            mine = (sources.find_one({"_id": sid}, {"priority": 1}) or {}).get("priority") or 0
            same = {} if ai_slot.ENABLED else {"lane": lane}   # tắt ai_slot thì hai làn chạy song song
            if sources.count_documents({"status": "queued", "priority": {"$gt": mine}} | same, limit=1):
                yield_why[:] = ["chờ nguồn ưu tiên xong rồi chạy tiếp"]
                return True
            if redo.manual_waiting(exclude=sid):
                yield_why[:] = ["nhường lượt Lấy lại chữ video được chọn, xong rồi chạy tiếp"]
                return True
            if ai_slot.should_yield():
                yield_why[:] = ["nhường việc khác đang chờ (một lúc chỉ làm một việc), lát nữa chạy tiếp"]
                return True
            return False

        ctx = Context(raw_dir=rdir, options=src.get("options") or {}, log=lambda m: log(sid, m), lane=lane,
                      cancelled=lambda: bool(sources.count_documents({"_id": sid, "cancel_requested": True})),
                      existing_keys=existing, progress=progress, should_yield=should_yield,
                      defer_translation=ai_slot.ENABLED)
        log(sid, f"{'Chạy tiếp' if src.get('yielded_at') else 'Bắt đầu'} chuyển thành chữ ({ADAPTERS[src['kind']].label})")
        ai_slot.set_detail(f"{LANE_LABEL.get(lane, lane)}: {src.get('title') or src.get('url') or ADAPTERS[src['kind']].label}"[:160])
        build = wants_wiki(src)
        count = 0
        try:
            for d in ADAPTERS[src["kind"]].extract(src, ctx):
                if not d.text.strip() and not d.images:
                    log(sid, f"Bỏ qua '{d.title}': không có nội dung")
                    continue
                save_document(src, d, build)
                count += 1
            total = count or documents.count_documents({"source_id": sid})
            # link: lấy tên bài / tên file thật làm tên nguồn (đọc lại — bộ đọc có thể vừa đặt tên, vd tên playlist)
            if total and not (sources.find_one({"_id": sid}, {"title": 1}) or {}).get("title"):
                first = documents.find_one({"source_id": sid}, {"title": 1}, sort=[("created_at", 1)])
                name = first["title"] if total == 1 or src["kind"] != "video" else None
                if name:
                    sources.update_one({"_id": sid}, {"$set": {"title": re.sub(r" \((trang|phần|ảnh) .*\)$", "", name)[:200]}})
            if ctx.yielded and not ctx.cancelled():   # nhường nguồn ưu tiên: về hàng chờ, giữ "chuyển chữ lại"
                opts = src.get("options") or {}
                sources.update_one({"_id": sid}, {"$set": {
                    "status": "queued", "yielded_at": db.now(), "worker": None,
                    **({"options.force_since": opts.get("force_since") or src["started_at"]} if opts.get("force") else {})}})
                log(sid, f"Tạm dừng: {count} tài liệu mới / cập nhật — {(yield_why or ['chạy tiếp sau'])[0]}")
                return self._after_extract(src)
            status = "cancelled" if ctx.cancelled() else ("extracted" if total else "error")
            sources.update_one({"_id": sid}, {"$set": {
                "status": status, "finished_at": db.now(), "cancel_requested": False,
                "options.force": False,   # "chuyển chữ lại" chỉ áp dụng một lần
                "error": None if total or status == "cancelled" else "Không trích được nội dung nào"},
                "$unset": {"options.force_since": "", "yielded_at": ""}})
            log(sid, f"Chuyển chữ xong: {count} tài liệu mới / cập nhật"
                     + ("" if build else " — chỉ chuyển chữ, không dựng thẻ"))
        except MoveToHeavyLane:
            sources.update_one({"_id": sid}, {"$set": {"status": "queued", "lane": "heavy"}})
            log(sid, "Nội dung là âm thanh / video — chuyển sang làn Whisper")
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            sources.update_one({"_id": sid}, {"$set": {"status": "error", "error": str(e)[:500],
                                                       "finished_at": db.now(), "cancel_requested": False}})
            log(sid, f"✗ {str(e)[:300]}")
        return self._after_extract(src)

    @staticmethod
    def _after_extract(src: dict) -> bool:
        if sources.find_one({"_id": src["_id"], "delete_requested": True}, {"_id": 1}):   # bị xoá khi đang chạy
            delete_source_data(src)
            sources.delete_one({"_id": src["_id"]})
        return True

    # --- Dịch: video tiếng nước ngoài đã chép chữ -> thêm bản tiếng Việt -----------------------

    @staticmethod
    def _translate_waiting() -> bool:
        return bool(documents.count_documents({"translate_pending": True, "translating": {"$ne": True}}, limit=1)) \
            and (local_ai.ready() or wiki.ai_ready())

    def _translate_next(self) -> bool:
        """Dịch một video đã chép chữ (Whisper / phụ đề) rồi dựng lại bản chữ của tài liệu — như khi dịch ngay lúc
        chép. Không dịch được (AI lỗi) thì giữ bản gốc, bỏ đánh dấu chờ (dịch lại sau bằng "lấy lại chữ")."""
        from . import translate
        from .adapters.video import translate_caption, video_document   # nhập muộn: adapters -> pipeline
        doc = documents.find_one_and_update({"translate_pending": True, "translating": {"$ne": True}},
                                            {"$set": {"translating": True}},
                                            sort=[("priority", -1), ("created_at", 1)], return_document=True)
        if not doc:
            return False
        vid = (doc.get("meta") or {}).get("video_id")
        v = db.videos.find_one({"_id": vid}) if vid else None
        src = sources.find_one({"_id": doc["source_id"]})
        if not v or not src:
            documents.update_one({"_id": doc["_id"]}, {"$set": {"translate_pending": False, "translating": False}})
            return True
        ai_slot.set_detail(f"Dịch: {doc['title'][:80]}")
        say = lambda m: log(src["_id"], m)  # noqa: E731
        say(f"Dịch sang tiếng Việt: {doc['title'][:80]}")
        segs = [(s["start"], s["end"], s["text"]) for s in v.get("segments") or []]
        tr = translate.translate_segments(segs, v.get("language"), say)
        if tr and (cap := translate_caption(v.get("caption"), v.get("language"), say)):
            tr["caption"] = cap
        db.videos.update_one({"_id": vid}, {"$set": {"translation": tr, "translation_pending": False}})
        if documents.count_documents({"_id": doc["_id"]}, limit=1):   # tài liệu chưa bị xoá trong lúc dịch
            save_document(src, video_document(db.videos.find_one({"_id": vid})), wants_wiki(src))
        documents.update_one({"_id": doc["_id"]}, {"$set": {"translate_pending": False, "translating": False}})
        return True

    # --- Tầng 2: tài liệu -> thẻ VCWIKI ---------------------------------------------------

    @staticmethod
    def _wiki_waiting() -> bool:
        """Có tài liệu chờ dựng thẻ (đã dịch xong nếu cần) và AI dùng được — kiểm nhẹ trước khi xin chỗ."""
        return bool(documents.count_documents({"wiki_status": "pending", "translate_pending": {"$ne": True}, "$or": [
            {"wiki_retry_at": None}, {"wiki_retry_at": {"$lte": db.now()}}]}, limit=1)) and wiki.ai_ready()

    def _wiki_next(self) -> bool:
        if not wiki.ai_ready():
            return False   # tài liệu nằm chờ ở trạng thái pending cho đến khi có API key
        # tài liệu vừa phải chờ (Claude hết quota, quá dài cho AI local) lùi lại, không chặn tài liệu phía sau
        doc = documents.find_one_and_update({"wiki_status": "pending", "translate_pending": {"$ne": True},
                                             "$or": [{"wiki_retry_at": None}, {"wiki_retry_at": {"$lte": db.now()}}]},
                                            {"$set": {"wiki_status": "processing", "wiki_started_at": db.now()}},
                                            sort=[("priority", -1), ("created_at", 1)], return_document=True)
        if not doc:
            return False
        src = sources.find_one({"_id": doc["source_id"]})
        if not src:
            from . import notes
            documents.delete_one({"_id": doc["_id"]})
            notes.delete_for_document(doc["_id"])
            return True
        log(src["_id"], f"Dựng VCWIKI: {doc['title'][:80]}")
        ai_slot.set_detail(f"Dựng thẻ: {doc['title'][:80]}")
        # Claude làm dở qua MCP (partial) / cập nhật thẻ khi nội dung đổi: giữ thẻ đã có (trừ nháp AI sẽ dựng lại),
        # đưa tiêu đề cho AI để không viết trùng
        updating = doc.get("card_update") == "queued"
        kept = [c["title"] for c in cards.find({"document_id": doc["_id"], "status": {"$ne": "rejected"},
                                                 "$nor": [{"origin": "ai", "status": "draft"}]}, {"title": 1})] \
            if doc.get("partial") or updating else []
        try:
            if updating:   # thẻ đã duyệt -> đề xuất sửa vào hộp duyệt (kb/card_update.py)
                from . import card_update
                card_update.propose_updates(doc, src)
            result = wiki.build_cards(doc, src, raw_dir(src["_id"]), existing=kept)
        except wiki.AINotReady as e:
            documents.update_one({"_id": doc["_id"]}, {"$set": {"wiki_status": "pending", "wiki_error": str(e)}})
            return False
        except wiki.AIRetryLater as e:
            wait = CLAUDE_QUOTA_PAUSE if wiki.claude_off() else 60
            documents.update_one({"_id": doc["_id"]}, {"$set": {
                "wiki_status": "pending", "wiki_error": str(e),
                "wiki_retry_at": db.now() + timedelta(seconds=wait)}})
            time.sleep(2)
            return True
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            documents.update_one({"_id": doc["_id"]}, {"$set": {"wiki_status": "error", "wiki_error": str(e)[:500]}})
            log(src["_id"], f"✗ Dựng VCWIKI lỗi: {str(e)[:300]}")
            return True

        from . import changes   # nhập muộn: changes -> novelty -> pipeline
        stale = [c["_id"] for c in cards.find({"document_id": doc["_id"], "status": "draft", "origin": "ai"}, {"_id": 1})]
        cards.delete_many({"_id": {"$in": stale}})   # dựng lại thì thay thẻ nháp AI cũ
        for cid in stale:
            changes.on_card_deleted(cid)
        now = db.now()
        model = result["usage"].get("model") or ""
        by = db.refiner("api", "AI local (Ollama) — thay Claude" if model.startswith("local:") else "Claude API (máy chủ)", model)
        fallback_cats = cat_mod.valid_slugs(result["categories"]) or src.get("categories") or []
        for sug in result["suggested_categories"]:
            cat_mod.record_suggestion(sug["name"], sug["parent_slug"] or None, sug["reason"], doc["_id"])
        new_cards = [classify.ai_card(c) | {
            "tags": db.clean_tags(c["tags"] + (doc.get("tags") or [])),   # thẻ thừa kế tag của tài liệu
            "categories": cat_mod.valid_slugs(c["categories"]) or fallback_cats,
            "space_id": src["space_id"], "source_id": src["_id"], "document_id": doc["_id"],
            "source": {"kind": src["kind"], "title": doc["title"], "url": doc.get("url") or src.get("url")},
            "status": "draft", "origin": "ai", "created_by": src["created_by"], "refined_by": by,
            "created_at": now, "updated_at": now,
        } for c in result["cards"]]
        for c in new_cards:
            c["search_text"] = card_search_text(c)
        if new_cards:
            cards.insert_many(new_cards)
            embeddings.schedule([c["_id"] for c in new_cards])   # tìm theo nghĩa — nền, AI local tắt thì bỏ qua
            changes.submit_new_cards([c["_id"] for c in new_cards], "ai")   # GOV: vào hộp duyệt, cổng so sánh chạy nền
        documents.update_one({"_id": doc["_id"]}, {"$set": {
            "wiki_status": "done", "wiki_error": None, "summary": result["doc_summary"],
            "categories": cat_mod.valid_slugs([result["primary_category"], *result["categories"]])[:4],
            "primary_category": result["primary_category"],
            "relevance": result["relevance"], "card_count": len(new_cards) + len(kept), "ai_usage": result["usage"],
            "wiki_at": now, "refined_by": by, "claimed_by": None, "partial": False, "card_update": None}})
        log(src["_id"], f"→ {len(new_cards)} thẻ (độ hữu ích {result['relevance']}/10)")
        return True


def _release_whisper() -> None:
    from ..worker import worker   # nhập muộn: nạp code Whisper nặng
    worker.release()


# rời bước nào thì nhả model của bước đó khỏi RAM (bước sau dùng model khác)
ai_slot.on_leave("tho", _release_whisper)
ai_slot.on_leave("dich", local_ai.unload_llm)
ai_slot.on_leave("tinh_che", local_ai.unload_llm)

pipeline = Pipeline()
