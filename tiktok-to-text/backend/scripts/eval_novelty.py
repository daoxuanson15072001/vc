#!/usr/bin/env python3
"""Đánh giá cổng so sánh (GOV-03) trên bộ mẫu có nhãn, với AI thật đang có (Claude hoặc AI local).

    cd backend && ../.venv/bin/python scripts/eval_novelty.py                 # AI theo cấu hình (auto)
    cd backend && ../.venv/bin/python scripts/eval_novelty.py --engine local  # AI local trước
    cd backend && ../.venv/bin/python scripts/eval_novelty.py --no-embed --only con-01,sup-02 -v

Nạp toàn bộ thẻ đã có của mọi ca vào MỘT database tạm (`tiktok_to_text_eval_novelty_<ngẫu nhiên>`, xoá sau khi
chạy) — ứng viên phải được tìm ra giữa các thẻ của ca khác, giống kho thật. `--isolated`: chỉ đưa thẻ của chính ca.
In ma trận nhầm lẫn, độ chính xác, độ chính xác / độ phủ theo từng loại, tỷ lệ chọn đúng thẻ liên quan, thời gian.
Mục tiêu BA 16.2: tỷ lệ người duyệt phải đổi kết quả < 20% ⇒ độ chính xác ≥ 80%.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import signal
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "tests" / "data" / "novelty_cases.json"


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--engine", choices=["auto", "local"], default=os.getenv("NOVELTY_ENGINE", "auto"))
    p.add_argument("--no-embed", action="store_true", help="chỉ tìm ứng viên theo chữ")
    p.add_argument("--isolated", action="store_true", help="mỗi ca chỉ so với thẻ đã có của chính ca")
    p.add_argument("--only", default="", help="chỉ chạy các ca (id, cách nhau dấu phẩy)")
    p.add_argument("--out", help="ghi kết quả từng ca ra file JSON")
    p.add_argument("-v", "--verbose", action="store_true", help="in lý do của mọi ca, không chỉ ca sai")
    return p.parse_args()


args = parse_args()
os.environ["MONGO_DB"] = f"tiktok_to_text_eval_novelty_{secrets.token_hex(3)}"
os.environ["NOVELTY_ENGINE"] = args.engine
if args.no_embed:
    os.environ["NOVELTY_EMBED"] = "0"

sys.path.insert(0, str(ROOT))
from bson import ObjectId  # noqa: E402

from app import db  # noqa: E402
from app.kb import local_ai, novelty, wiki  # noqa: E402
from app.kb.pipeline import card_search_text, cards  # noqa: E402
from app.spaces import spaces  # noqa: E402

LABELS = list(novelty.VERDICTS)


def load(data: dict) -> tuple[dict, dict]:
    """Nạp thẻ đã có vào DB tạm. Trả (người đánh giá, {(ca, khoá): _id})."""
    user = {"_id": ObjectId(), "name": "Người đánh giá", "role": "member"}
    space = {"_id": ObjectId(), "name": "Kho đánh giá", "type": "shared", "visibility": "private",
             "owner_id": user["_id"], "members": [{"user_id": user["_id"], "role": "owner"}], "created_at": db.now()}
    spaces.insert_one(space)
    ids: dict = {}
    docs = []
    for case in data["cases"]:
        for c in case["existing"]:
            doc = {k: v for k, v in c.items() if k != "key"} | {
                "_id": ObjectId(), "space_id": space["_id"], "status": "approved", "type": "lesson",
                "tags": [], "categories": [], "current_revision": 1, "created_at": db.now(), "updated_at": db.now()}
            doc["search_text"] = card_search_text(doc)
            ids[(case["id"], c["key"])] = doc["_id"]
            docs.append(doc)
    cards.insert_many(docs)
    return user, ids


def main() -> None:
    data = json.loads(CASES.read_text(encoding="utf-8"))
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    todo = [c for c in data["cases"] if not only or c["id"] in only]
    print(f"Database tạm: {db.db.name} · {len(todo)} ca · engine={args.engine} · "
          f"embedding={'tắt' if args.no_embed else ('có' if novelty._embed_ready() else 'không có')} · "
          f"{'riêng từng ca' if args.isolated else 'chung một kho'}")
    ai = wiki.ai_status()
    print(f"Claude: {'sẵn sàng' if wiki.claude_ready() else wiki.claude_off()} · "
          f"AI local: {local_ai.status()['model'] if local_ai.ready() else local_ai.status()['error']} · "
          f"AI dùng được: {ai['ready']}")
    # bị dừng (kill / Ctrl+C) vẫn xoá database tạm
    signal.signal(signal.SIGTERM, signal.default_int_handler)
    user, ids = load(data)
    rows = []
    try:
        for i, case in enumerate(todo, 1):
            t0 = time.time()
            cands = novelty.find_candidates(case["draft"], user)
            if args.isolated:
                own = {ids[(case["id"], c["key"])] for c in case["existing"]}
                cands = [c for c in cands if c["card"]["_id"] in own]
            t1 = time.time()
            res = novelty.classify(case["draft"], user, cands)
            t2 = time.time()
            expect = {ids[(case["id"], k)] for k in case["related"]}
            cand_ids = [c["card"]["_id"] for c in cands]
            got_rel = [r["card_id"] for r in res["related"]]
            row = {"id": case["id"], "label": case["label"], "verdict": res["verdict"], "engine": res["engine"],
                   "reason": res["reason"], "search_s": round(t1 - t0, 2), "ai_s": round(t2 - t1, 2),
                   "cand_hit": (not expect) or bool(expect & set(cand_ids[:10])),
                   "cand_rank": next((j + 1 for j, cid in enumerate(cand_ids) if cid in expect), None),
                   "related_ok": (not expect) or (bool(got_rel) and got_rel[0] in expect),
                   "method": cands[0]["method"] if cands else None}
            rows.append(row)
            mark = "✓" if row["verdict"] == row["label"] else "✗"
            print(f"[{i:2}/{len(todo)}] {mark} {case['id']:7} nhãn={case['label']:10} AI={res['verdict']:10} "
                  f"ứng viên đúng hạng {row['cand_rank'] or '-'} · thẻ liên quan {'đúng' if row['related_ok'] else 'SAI'}"
                  f" · {row['search_s']:.1f}s + {row['ai_s']:.1f}s · {res['engine']}")
            if args.verbose or mark == "✗":
                print(f"          lý do: {res['reason']}")
    except KeyboardInterrupt:
        print("Dừng giữa chừng — báo cáo các ca đã chạy")
    finally:
        db.client.drop_database(db.db.name)
        print(f"Đã xoá database tạm {db.db.name}")
    report(rows)
    if args.out:
        Path(args.out).write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Đã ghi {args.out}")


def report(rows: list[dict]) -> None:
    if not rows:
        return
    n = len(rows)
    ok = sum(r["verdict"] == r["label"] for r in rows)
    conf = Counter((r["label"], r["verdict"]) for r in rows)
    w = 11
    print("\nMa trận nhầm lẫn (hàng = nhãn đúng, cột = AI xếp)")
    print(" " * w + "".join(f"{v:>{w}}" for v in LABELS) + f"{'tổng':>{w}}")
    for lab in LABELS:
        print(f"{lab:<{w}}" + "".join(f"{conf[(lab, v)]:>{w}}" for v in LABELS)
              + f"{sum(conf[(lab, v)] for v in LABELS):>{w}}")
    print(f"\nĐộ chính xác: {ok}/{n} = {ok / n:.0%}  (mục tiêu ≥ 80%)")
    print(f"{'loại':<{w}}{'precision':>{w}}{'recall':>{w}}{'số ca':>{w}}")
    for lab in LABELS:
        tp = conf[(lab, lab)]
        pred = sum(conf[(x, lab)] for x in LABELS)
        real = sum(conf[(lab, x)] for x in LABELS)
        prec = f"{tp / pred:.0%}" if pred else "-"
        rec = f"{tp / real:.0%}" if real else "-"
        print(f"{lab:<{w}}{prec:>{w}}{rec:>{w}}{real:>{w}}")
    need = [r for r in rows if r["label"] in ("duplicate", "supplement", "conflict")]
    if need:
        print(f"\nTìm ứng viên: thẻ đúng nằm trong 10 thẻ gần nhất {sum(r['cand_hit'] for r in need)}/{len(need)}; "
              f"đứng đầu {sum(r['cand_rank'] == 1 for r in need)}/{len(need)} "
              f"(phương pháp: {Counter(r['method'] for r in rows).most_common()})")
        hit = [r for r in need if r["verdict"] == r["label"]]
        if hit:
            print(f"Ca xếp đúng loại có chọn đúng thẻ liên quan: {sum(r['related_ok'] for r in hit)}/{len(hit)}")
    print(f"Thời gian mỗi ca: tìm {sum(r['search_s'] for r in rows) / n:.2f}s · AI {sum(r['ai_s'] for r in rows) / n:.2f}s"
          f" (lâu nhất {max(r['ai_s'] for r in rows):.1f}s) · engine {Counter(r['engine'] for r in rows).most_common()}")


if __name__ == "__main__":
    main()
