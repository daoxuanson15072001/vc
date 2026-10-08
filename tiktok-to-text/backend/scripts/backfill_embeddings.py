#!/usr/bin/env python3
"""Tính bù embedding cho thẻ VCWIKI (tìm thẻ theo nghĩa — app/kb/embeddings.py). Chạy tay, chạy lại bao nhiêu lần
cũng được: thẻ đã có embedding đúng nội dung + đúng model thì bỏ qua, không gọi AI.

Cần AI local đang chạy và đã tải model embedding (LOCAL_EMBED_MODEL, mặc định bge-m3: `ollama pull bge-m3`).
DB theo biến môi trường MONGO_DB như app (mặc định tiktok_to_text).

    cd backend && ../.venv/bin/python scripts/backfill_embeddings.py --dry-run   # chỉ đếm, không ghi
    cd backend && ../.venv/bin/python scripts/backfill_embeddings.py             # tính phần thiếu / cũ
    cd backend && ../.venv/bin/python scripts/backfill_embeddings.py --force     # tính lại tất cả

Cũng xoá embedding của thẻ đã bị xoá (bỏ bằng --no-prune).
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import db  # noqa: E402
from app.config import LOCAL_EMBED_MODEL, LOCAL_LLM_URL  # noqa: E402
from app.kb import embeddings  # noqa: E402


def plan(force: bool = False) -> tuple[list, int, list]:
    """(id thẻ cần tính, số thẻ đã đúng, id embedding mồ côi)."""
    saved = {r["_id"]: r.get("hash") for r in embeddings.store.find({"model": LOCAL_EMBED_MODEL}, {"hash": 1})}
    todo, ok = [], 0
    for c in embeddings.cards.find({}, embeddings.TEXT_FIELDS):
        if not force and saved.get(c["_id"]) == embeddings.text_hash(c):
            ok += 1
        else:
            todo.append(c["_id"])
    live = set(embeddings.cards.distinct("_id"))
    orphans = [i for i in embeddings.store.distinct("_id") if i not in live]
    return todo, ok, orphans


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--dry-run", action="store_true", help="Chỉ đếm, không gọi AI, không ghi DB")
    p.add_argument("--force", action="store_true", help="Tính lại cả thẻ đã có embedding")
    p.add_argument("--no-prune", action="store_true", help="Giữ embedding của thẻ đã xoá")
    p.add_argument("--batch", type=int, default=64, help="Số thẻ mỗi lượt (mặc định 64)")
    args = p.parse_args()

    print(f"DB {db.db.name} · model {LOCAL_EMBED_MODEL} @ {LOCAL_LLM_URL}")
    todo, ok, orphans = plan(args.force)
    print(f"{ok} thẻ đã có embedding đúng · {len(todo)} thẻ cần tính · {len(orphans)} embedding mồ côi")
    if args.dry_run:
        print("--dry-run: không ghi gì.")
        return 0
    if orphans and not args.no_prune:
        embeddings.store.delete_many({"_id": {"$in": orphans}})
        print(f"Đã xoá {len(orphans)} embedding mồ côi.")
    if not todo:
        return 0
    if not embeddings.ready():
        print(f"AI local chưa sẵn sàng hoặc chưa có model {LOCAL_EMBED_MODEL} (ollama pull {LOCAL_EMBED_MODEL}).")
        return 1
    total = {"embedded": 0, "unchanged": 0, "missing": 0}
    t0 = time.time()
    for start in range(0, len(todo), args.batch):
        res = embeddings.refresh(todo[start:start + args.batch], force=args.force)
        for k in total:
            total[k] += res[k]
        done = min(start + args.batch, len(todo))
        print(f"  {done}/{len(todo)} · đã tính {total['embedded']} · {time.time() - t0:.0f} giây", flush=True)
    print(f"Xong: tính {total['embedded']}, không đổi {total['unchanged']}, thẻ biến mất giữa chừng {total['missing']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
