#!/usr/bin/env python3
"""Nạp tầng thô (văn bản tài liệu Kho tư liệu) vào Qdrant để tìm theo nghĩa — app/kb/doc_vectors.py. Chạy lại bao
nhiêu lần cũng được: tài liệu đã nạp đúng nội dung + đúng model thì bỏ qua. Dừng giữa chừng (Ctrl-C, máy ngủ) thì
lần sau chạy tiếp phần còn lại. Job đêm (setup_vector_db.sh -> nightly_vectors.sh) gọi script này mỗi đêm.
Mỗi lượt giữ chỗ chung với máy chủ (app/kb/ai_slot.py): máy chủ đang chuyển chữ / tinh chế thì lượt chờ tới lượt.

Cần Qdrant (setup_vector_db.sh) và AI local có model embedding (ollama pull bge-m3).
DB theo biến môi trường MONGO_DB như app (mặc định tiktok_to_text).

    cd backend && ../.venv/bin/python scripts/index_raw_vectors.py --dry-run     # chỉ đếm
    cd backend && ../.venv/bin/python scripts/index_raw_vectors.py               # nạp phần thiếu / đổi
    cd backend && ../.venv/bin/python scripts/index_raw_vectors.py --until 07:00 # dừng êm lúc 7 giờ sáng

Cũng xoá đoạn của tài liệu đã bị xoá (bỏ bằng --no-prune).
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import db  # noqa: E402
from app.config import LOCAL_EMBED_MODEL, LOCAL_LLM_URL  # noqa: E402
from app.kb import ai_slot, doc_vectors, embeddings  # noqa: E402


def plan(force: bool = False) -> tuple[list, int, list, int]:
    """(id tài liệu cần nạp — mới trước, số tài liệu đã đúng, id tài liệu mồ côi trong Qdrant, tổng ký tự cần nạp)."""
    saved = doc_vectors.indexed()
    todo, ok, chars = [], 0, 0
    live = set()
    for d in doc_vectors.documents.find({}, {"title": 1, "text": 1, "chars": 1}).sort("created_at", -1):
        live.add(str(d["_id"]))
        if not (d.get("text") or "").strip():
            continue
        if not force and saved.get(str(d["_id"])) == doc_vectors.doc_hash(d):
            ok += 1
        else:
            todo.append(d["_id"])
            chars += len(d["text"])
    orphans = [i for i in saved if i not in live]
    return todo, ok, orphans, chars


def deadline(until: str | None) -> datetime | None:
    if not until:
        return None
    h, m = map(int, until.split(":"))
    now = datetime.now()
    t = now.replace(hour=h, minute=m, second=0, microsecond=0)
    return t if t > now else t + timedelta(days=1)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dry-run", action="store_true", help="Chỉ đếm, không gọi AI, không ghi")
    p.add_argument("--force", action="store_true", help="Nạp lại cả tài liệu đã có")
    p.add_argument("--no-prune", action="store_true", help="Giữ đoạn của tài liệu đã xoá")
    p.add_argument("--batch", type=int, default=8, help="Số tài liệu mỗi lượt (mặc định 8)")
    p.add_argument("--limit", type=int, default=0, help="Chỉ nạp tối đa bấy nhiêu tài liệu (0 = hết)")
    p.add_argument("--until", help="HH:MM — tới giờ này thì dừng êm (lần sau chạy tiếp)")
    args = p.parse_args()

    print(f"{datetime.now():%Y-%m-%d %H:%M} · DB {db.db.name} · model {LOCAL_EMBED_MODEL} @ {LOCAL_LLM_URL} · "
          f"Qdrant {doc_vectors.QDRANT_URL}", flush=True)
    if not doc_vectors.up(fresh=True):
        print("Qdrant chưa chạy (bash setup_vector_db.sh, hoặc launchctl kickstart gui/$(id -u)/com.vcpv.qdrant).")
        return 1
    todo, ok, orphans, chars = plan(args.force)
    est = chars / doc_vectors.CHUNK_CHARS * 1.15
    print(f"{ok} tài liệu đã nạp đúng · {len(todo)} tài liệu cần nạp (~{chars:,} ký tự, ~{est:,.0f} đoạn) · "
          f"{len(orphans)} tài liệu mồ côi", flush=True)
    if args.dry_run:
        print("--dry-run: không ghi gì.")
        return 0
    if orphans and not args.no_prune:
        for s in range(0, len(orphans), 500):
            doc_vectors.delete_documents(orphans[s:s + 500])
        print(f"Đã xoá đoạn của {len(orphans)} tài liệu mồ côi.")
    if args.limit:
        todo = todo[:args.limit]
    if not todo:
        return 0
    if not embeddings.ready():
        print(f"AI local chưa sẵn sàng hoặc chưa có model {LOCAL_EMBED_MODEL} (ollama pull {LOCAL_EMBED_MODEL}).")
        return 1
    stop_at = deadline(args.until)
    t0, n_docs, n_chunks, errors = time.time(), 0, 0, 0
    for s in range(0, len(todo), args.batch):
        if stop_at and datetime.now() >= stop_at:
            print(f"Tới {args.until}: dừng, lần sau chạy tiếp {len(todo) - n_docs} tài liệu.")
            break
        docs = list(doc_vectors.documents.find({"_id": {"$in": todo[s:s + args.batch]}}, doc_vectors.DOC_FIELDS))
        try:
            # một lúc chỉ làm một việc (app/kb/ai_slot.py): máy chủ đang chuyển chữ / dựng thẻ thì chờ nó nhả chỗ
            with ai_slot.hold("vector_tho", f"{n_docs}/{len(todo)} tài liệu"):
                n_chunks += doc_vectors.index_documents(docs)
            n_docs += len(docs)
        except Exception as e:   # noqa: BLE001 — một lượt lỗi thì thử lượt sau; lỗi liên tiếp thì dừng
            errors += 1
            print(f"  Lỗi lượt {s // args.batch + 1}: {str(e)[:200]}", flush=True)
            if errors >= 5:
                print("5 lượt lỗi liên tiếp — dừng (AI local / Qdrant có vấn đề).")
                return 1
            time.sleep(10)
            continue
        errors = 0
        el = time.time() - t0
        if (s // args.batch) % 10 == 0 or s + args.batch >= len(todo):
            rate = n_chunks / el if el else 0
            print(f"  {n_docs}/{len(todo)} tài liệu · {n_chunks} đoạn · {el / 60:.0f} phút · {rate:.1f} đoạn/giây",
                  flush=True)
    print(f"Xong: {n_docs} tài liệu, {n_chunks} đoạn trong {(time.time() - t0) / 60:.0f} phút.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
