#!/usr/bin/env python3
"""Khoá đào tạo mẫu cho /learn: "Kỹ năng bán hàng B2B cho NVKD mới" — yêu cầu 6ab889cd…9949de.

Vỏ dòng lệnh của `app/learn/sample.py` (định nghĩa khoá: seeds/sample_course_nvkd_b2b.yaml). Idempotent theo
sample_key. Không tự duyệt thẻ / câu hỏi: mọi bước "duyệt" là người bấm trên web, script chỉ KIỂM TRA và DẪN LINK.

    cd backend
    ../.venv/bin/python scripts/seed_sample_course.py --dry-run                 # chỉ kiểm, không ghi gì
    ../.venv/bin/python scripts/seed_sample_course.py                           # dựng / phát hành (chạy lại được)
    ../.venv/bin/python scripts/seed_sample_course.py --assign a@x.com,b@x.com  # giao thêm người
    ../.venv/bin/python scripts/seed_sample_course.py --reset                   # xoá khoá mẫu rồi dựng lại
    ../.venv/bin/python scripts/seed_sample_course.py --export                  # ghi output/khoa-mau-<key>.md
    ../.venv/bin/python scripts/seed_sample_course.py --course nvkd-b2b-v1      # chỉ một khoá (mặc định: mọi khoá)

DB theo biến môi trường MONGO_DB như app (mặc định tiktok_to_text). Người chạy: --as (mặc định
buithoanh@vcprosperous.com) — cần quyền soạn bài học và sửa được kho "Kho video TikTok"; người chạy được ghi danh.
AI: sinh câu hỏi + diễn giải bài bằng Claude (không có thì AI local); LEARN_AI_FAKE=1 chỉ dùng cho DB QA / test.

Mã thoát: 0 = xong (hoặc --dry-run: thẻ đã sẵn sàng) · 1 = lỗi (thiếu thẻ / C3 / ngoài kho org / AI / ma trận đề)
· 2 = còn thẻ chưa duyệt (in link Duyệt hàng loạt) · 3 = còn câu hỏi nháp (in link ngân hàng câu hỏi).
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException  # noqa: E402

from app import db  # noqa: E402
from app.auth import users  # noqa: E402
from app.learn import sample  # noqa: E402

DEFAULT_AS = "buithoanh@vcprosperous.com"
SKIPPED = -1        # khoá mà DB này không có thẻ nào (DB test, DB khác) — không tính vào mã thoát


def print_cards(course: dict, chk: dict) -> None:
    print(f"\nKhoá mẫu: {course['title']}  (sample_key = {course['sample_key']})")
    print(f"Kiểm {len(chk['rows'])} thẻ tính điểm:\n")
    print(f"{'#':>2}  {'mã thẻ':<24}  {'trạng thái':<9}  {'mật':<3}  {'bản':>3}  {'bài học':<32}  tiêu đề")
    for i, r in enumerate(chk["rows"], 1):
        if not r["exists"]:
            print(f"{i:>2}  {r['id']:<24}  {'—':<9}  {'—':<3}  {'—':>3}  {'—':<32}  ✗ {r['error']}")
            continue
        flag = "" if r["status"] == "approved" else "  ← chưa duyệt"
        sp = "" if r["in_org_space"] else "  ← ngoài kho org"
        print(f"{i:>2}  {r['id']:<24}  {r['status']:<9}  {r['classification']:<3}  {r['rev']:>3}  "
              f"{sample.lesson_label(course, r['id']):<32}  {r['title'][:44]}{flag}{sp}")
    print()
    if not chk["space_found"]:
        print(f"✗ Không thấy kho org '{course['org_space']}' trong DB này.")
    if chk["missing"]:
        print(f"✗ {len(chk['missing'])} thẻ không tồn tại: {', '.join(chk['missing'])}")
    if chk["c3"]:
        print(f"✗ {len(chk['c3'])} thẻ mức mật C2 / C3 (người học không đọc được qua khoá): {', '.join(chk['c3'])}")
    if chk["outside"]:
        print(f"✗ {len(chk['outside'])} thẻ không thuộc kho '{course['org_space']}': {', '.join(chk['outside'])}")


def print_status(st: dict) -> None:
    stage = {"build": "chưa dựng bài học / câu hỏi", "questions": "chờ duyệt câu hỏi",
             "publish": "chưa phát hành", "ready": "đã phát hành"}.get(st["stage"], st["stage"])
    print(f"Trạng thái khoá: {stage} · câu hỏi {st['questions_total']} (nháp {st['questions_draft']})"
          + (f" · lộ trình {st['path_id']} ({st['path_status']})" if st["path_id"] else ""))


def main() -> int:
    ap = argparse.ArgumentParser(description="Seed các khoá mẫu cho /learn (seeds/sample_course_*.yaml).")
    ap.add_argument("--dry-run", action="store_true", help="chỉ kiểm 16 thẻ + trạng thái khoá, không ghi DB")
    ap.add_argument("--reset", action="store_true", help="xoá khoá mẫu (lộ trình, giao, lượt làm, bài, câu) rồi dựng lại")
    ap.add_argument("--assign", default="", help="email người học giao thêm, cách nhau dấu phẩy")
    ap.add_argument("--as", dest="as_email", default=os.getenv("SEED_SAMPLE_AS", DEFAULT_AS),
                    help=f"email người chạy (mặc định {DEFAULT_AS})")
    ap.add_argument("--course", default="all", help="sample_key một khoá (vd nvkd-b2b-v1); mặc định mọi khoá mẫu")
    ap.add_argument("--rewrite-narrative", action="store_true",
                    help="viết lại phần diễn giải của các bài khoá mẫu còn nháp (vd sau khi sửa `learner` trong yaml)")
    ap.add_argument("--export", action="store_true",
                    help="chỉ ghi bản xem trước markdown ../output/khoa-mau-<sample_key>.md, không đụng DB")
    ap.add_argument("--base-url", default=os.getenv("APP_BASE_URL", ""),
                    help="tiền tố link (vd http://localhost:8000); mặc định link tương đối")
    args = ap.parse_args()
    if args.dry_run and args.reset:
        ap.error("--dry-run không đi cùng --reset")

    courses = sample.all_courses() if args.course == "all" else [sample.find(args.course)]
    print(f"DB: {db.db.name} · {len(courses)} khoá mẫu")
    if args.export:
        for course in courses:
            out = Path(f"../output/khoa-mau-{course['sample_key']}.md")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(sample.export_markdown(course), encoding="utf-8")
            print(f"✓ Đã ghi {out.resolve()}")
        return 0

    user = users.find_one({"email": args.as_email.lower()})
    if not args.dry_run and not user:
        print(f"✗ Không có tài khoản {args.as_email}")
        return sample.HARD_ERROR
    codes = []
    for course in courses:
        codes.append(run_one(course, user, args))
    if len(courses) > 1:
        label = {0: "thẻ đã đủ" if args.dry_run else "xong", 1: "LỖI", 2: "chờ duyệt thẻ", 3: "chờ duyệt câu hỏi", SKIPPED: "bỏ qua (DB không có thẻ)"}
        print("\n== Tổng kết ==")
        for course, code in zip(courses, codes):
            print(f"  {course['sample_key']:<22} {label[code]}")
    # mã thoát: lỗi > chờ duyệt thẻ > chờ duyệt câu > xong
    return 1 if 1 in codes else 2 if 2 in codes else 3 if 3 in codes else 0


def run_one(course: dict, user: dict | None, args) -> int:
    ids = sample.graded_ids(course)
    assert len(ids) == 16, f"Khoá mẫu {course['sample_key']} phải đúng 16 thẻ tính điểm, đang có {len(ids)}"
    if len(sample.check_cards(course)["missing"]) == len(ids):
        print(f"\n· {course['sample_key']}: DB này không có thẻ nào của khoá — bỏ qua")
        return SKIPPED
    if args.reset:
        sample.reset(course)
    try:
        code, info = sample.run(course, user, [e for e in args.assign.split(",") if e.strip()],
                                dry_run=args.dry_run, base_url=args.base_url,
                                rewrite_narrative=args.rewrite_narrative)
    except HTTPException as e:
        print(f"\n✗ {course['sample_key']} dừng: {e.detail}")
        return sample.HARD_ERROR
    except Exception as e:  # noqa: BLE001 — lỗi AI / dữ liệu: in gọn, không traceback dài
        print(f"\n✗ {course['sample_key']} dừng: {type(e).__name__}: {e}")
        return sample.HARD_ERROR

    print_cards(course, info["check"])
    if code == sample.HARD_ERROR:
        print("→ Lỗi cứng: sửa danh sách thẻ / kho trước khi tiếp tục.")
    elif code == sample.CARDS_PENDING:
        n = len(info["check"]["pending"])
        print(f"→ Còn {n}/{len(ids)} thẻ chưa duyệt. Duyệt hàng loạt tại:\n\n  {info['link']}\n")
        print("  (Tab Duyệt hàng loạt đã lọc sẵn đúng các thẻ này. Tick rồi bấm Duyệt. Số người duyệt tối thiểu = 2")
        print("   thì cần người thứ hai duyệt bước 2.)")
    elif code == sample.QUESTIONS_PENDING:
        print(f"→ Đã dựng bài học + lộ trình nháp. Còn {len(info['questions_draft'])} câu hỏi nháp — duyệt tại:\n")
        print(f"  {info['link']}\n")
        print("  (Ngân hàng câu hỏi đã lọc theo khoá mẫu: đọc từng câu, sửa nếu cần, tick rồi bấm 'Duyệt đã chọn'.")
        print("   Duyệt xong chạy lại lệnh này để phát hành + ghi danh.)")
    elif args.dry_run:
        print("✓ Cả 16 thẻ đã approved, không C2 / C3.")
        print_status(info["status"])
    else:
        print(f"✓ Khoá đã phát hành, mở tự ghi danh. Hạn người được giao: {info['due_at']:%d/%m/%Y %H:%M} UTC.")
        print(f"  Lộ trình: {args.base_url.rstrip('/')}/learn/paths/{info['path_id']} · người học mở /learn")
    return code

if __name__ == "__main__":
    sys.exit(main())
