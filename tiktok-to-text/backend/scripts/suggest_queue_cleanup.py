#!/usr/bin/env python3
"""Đề xuất dọn hàng chờ tinh chế (app/kb/queue_cleanup.py): tài liệu đã có trong VCWIKI / trùng tài liệu khác.
Cần Qdrant đã nạp tầng thô (scripts/index_raw_vectors.py) và embedding thẻ (scripts/backfill_embeddings.py).

    cd backend && ../.venv/bin/python scripts/suggest_queue_cleanup.py --calibrate      # xem phân bố để chọn ngưỡng
    cd backend && ../.venv/bin/python scripts/suggest_queue_cleanup.py                  # xuất CSV đề xuất, không ghi DB
    cd backend && ../.venv/bin/python scripts/suggest_queue_cleanup.py --apply FILE.csv # áp dòng có cột dong_y = x

CSV mặc định ở output/queue_cleanup_<ngày giờ>.csv (mở bằng Excel / Google Sheets). Người duyệt gõ `x` vào cột
`dong_y` ở những dòng đồng ý, lưu lại (vẫn CSV UTF-8), rồi chạy --apply: tài liệu chuyển sang "đã tinh chế" (không
tạo thẻ), lý do ghi vào tóm tắt tài liệu. Tài liệu đã rời hàng chờ từ lúc xuất CSV thì bỏ qua.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import db  # noqa: E402
from app.config import ROOT_DIR  # noqa: E402
from app.kb import doc_vectors, queue_cleanup as qc  # noqa: E402

COLUMNS = ["dong_y", "action", "reason", "title", "status", "chars", "url", "coverage_ratio", "max_card_sim",
           "cards", "duplicate_of", "duplicate_ratio", "document_id"]


def to_row(r: dict) -> dict:
    cov, dup = r.get("coverage") or {}, r.get("duplicate") or {}
    return {"dong_y": "", "action": r["action"], "reason": r["reason"], "title": r["title"], "status": r["status"],
            "chars": r["chars"], "url": r["url"] or "", "coverage_ratio": cov.get("ratio", ""),
            "max_card_sim": cov.get("max_sim", ""),
            "cards": " | ".join(f"{c['title']} ({c['sim']}, {c['id']})" for c in cov.get("cards") or []),
            "duplicate_of": f"{dup.get('title')} ({dup.get('status')}, {dup.get('id')})" if dup else "",
            "duplicate_ratio": dup.get("ratio", ""), "document_id": r["document_id"]}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--calibrate", action="store_true", help="In phân bố độ giống để chọn ngưỡng, không đề xuất")
    p.add_argument("--apply", metavar="CSV", help="Áp các dòng có cột dong_y khác rỗng")
    p.add_argument("--limit", type=int, default=0, help="Chỉ xét bấy nhiêu tài liệu mới nhất (0 = hết)")
    p.add_argument("--out", help="Đường dẫn CSV (mặc định output/queue_cleanup_<ngày giờ>.csv)")
    args = p.parse_args()

    print(f"DB {db.db.name} · Qdrant {doc_vectors.QDRANT_URL} · ngưỡng: phủ {qc.COVER_SIM}/{qc.COVER_RATIO:.0%}, "
          f"trùng {qc.DUP_SIM}/{qc.DUP_RATIO:.0%}", flush=True)
    if args.apply:
        with open(args.apply, encoding="utf-8-sig", newline="") as fh:
            rows = {r["document_id"]: r for r in csv.DictReader(fh)}
        chosen = [i for i, r in rows.items() if (r.get("dong_y") or "").strip()]
        print(f"{len(chosen)} / {len(rows)} dòng được đánh dấu đồng ý.")
        print(qc.apply(chosen, rows))
        return 0
    if not doc_vectors.up(fresh=True):
        print("Qdrant chưa chạy.")
        return 1
    if args.calibrate:
        print(json.dumps(qc.calibrate(), ensure_ascii=False, indent=2))
        return 0
    res = qc.suggest(limit=args.limit, progress=lambda n, t: print(f"  {n}/{t}", flush=True))
    out = Path(args.out or ROOT_DIR / "output" / f"queue_cleanup_{datetime.now():%Y%m%d_%H%M}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    order = {"trung": 0, "da_co": 1, "giu": 2}
    with open(out, "w", encoding="utf-8-sig", newline="") as fh:   # utf-8-sig: Excel đọc đúng tiếng Việt
        w = csv.DictWriter(fh, COLUMNS)
        w.writeheader()
        for r in sorted(res, key=lambda r: (order[r["action"]], -(r["coverage"] or {}).get("ratio", 0))):
            w.writerow(to_row(r))
    n = Counter(r["action"] for r in res)
    print(f"{len(res)} tài liệu: trùng {n['trung']} · đã có trong VCWIKI {n['da_co']} · giữ lại {n['giu']} "
          f"(chưa nạp Qdrant: {sum(1 for r in res if r['coverage'] is None)})")
    print(f"CSV: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
