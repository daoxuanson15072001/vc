---
name: chot-commit
description: Dùng khi xong một đợt sửa và cần commit. Tăng phiên bản, ghi lịch sử, cập nhật README thư mục một lần duy nhất, rồi commit.
---

# Chốt commit

Quy tắc (CLAUDE.md §13): trong một phiên **chỉ tăng phiên bản và ghi Lịch sử một lần, lúc commit**, dù đã sửa file nhiều lần.

1. **Lấy giờ ngay lúc này** (không ghi giờ trước rồi sửa lại):
   ```bash
   TZ=Asia/Ho_Chi_Minh date '+%d/%m/%Y %H:%M'
   ```
2. **Một script duy nhất** (Python hoặc bash) cho tất cả file `.md` đã sửa và đủ 1.500 ký tự:
   - Tăng số cuối của dòng `Phiên bản x.y · dd/mm/yyyy · Trạng thái` và đổi ngày.
   - Thêm một dòng lên **đầu** bảng `## Lịch sử cập nhật`: `| Phiên bản | dd/mm/yyyy HH:mm | Người / phiên | Thay đổi | Căn cứ |`.
   - Sửa dòng của file đó trong `README.md` thư mục (phiên bản, ngày, trạng thái); nếu thêm file mới thì thêm dòng.
   - Đụng `CLAUDE.md` thì chép nguyên văn sang `AGENTS.md` (chỉ giữ tiêu đề, ghi chú đầu file, bảng lịch sử).
   - Sửa chính tả hay định dạng thì không tăng phiên bản.
3. `git add` đúng các file của đợt này (không `git add -A` bừa), rồi commit dạng `docs: …` / `feat: …` / `chore: …`. Message kết thúc bằng dòng Co-Authored-By theo hướng dẫn của hệ thống.
4. **Push GitLab** chỉ khi đã nối remote **và** đây là phiên gác cổng cuối nhịp. Không bao giờ `--force`.
5. Báo tối đa 5 dòng: mã commit, các file đã sửa, việc còn treo.
