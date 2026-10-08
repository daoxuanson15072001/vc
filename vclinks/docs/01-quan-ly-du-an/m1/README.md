# Mốc M1 — thư mục `docs/01-quan-ly-du-an/m1/`

Phiên bản 0.11 · 05/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- Hồ sơ quản lý mốc M1 (M1a / M1b / M1c, chạy thật 26/10/2026, dời từ 20/10): kế hoạch chia phiên chat và sổ phiên.
- **Kế hoạch** ít đổi sau khi duyệt; **sổ phiên** là tài liệu sống, các phiên code cập nhật hằng ngày.
- Mốc sau (M2, M3, M4) dùng cùng cấu trúc: thư mục `m2/`, `m3/`… cạnh thư mục này.

## Mục lục

- [Danh sách file](#danh-sách-file)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## Danh sách file

| File | Tóm tắt 1 dòng | Phiên bản | Cập nhật | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| [ke-hoach-phien-chat.md](ke-hoach-phien-chat.md) | Kế hoạch code M1 chia 34 phiên chat (+ M1c-11, M1c-12, M1a-08, M1b-19, M1b-20 bổ sung), 18 nhịp, model và điều kiện nâng, trần token, phòng rủi ro driver, đầu vào E1–E8; thời gian đo lại 05/10 (mốc 15/10 nếu đầu vào đúng hạn, 26/10 hạn cuối) | 1.11 | 05/10/2026 | Đã duyệt | E5 chặn "M1b-11" (có lẽ M1b-12); sơ đồ §4 C7/C8 lệch chữ; UAT-SZ-86 ở 2 phiên |
| [so-phien.md](so-phien.md) | Sổ trạng thái 37 phiên: nhịp, model, nâng model, nhánh, commit gộp, lần sửa, việc phát sinh; nhật ký nhịp và % token | 0.24 | 05/10/2026 | Đang áp dụng (tài liệu sống) | Cập nhật trạng thái không tăng phiên bản (ngoại lệ §13) |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.11 | 05/10/2026 09:22 | Claude Code | ke-hoach-phien-chat.md lên 1.11 (M1a-08: ưu tiên lấy nội dung, cửa sổ riêng nick-02) | Chủ dự án 05/10/2026 Q2–Q4 |
| 0.10 | 05/10/2026 08:09 | Claude Code | Kế hoạch lên 1.10 (thêm M1a-08, M1b-19, M1b-20), sổ phiên lên 0.24 | Chủ dự án 05/10/2026 |
| 0.9 | 05/10/2026 05:01 | Claude Code | Kế hoạch lên 1.9 (đo lại thời gian theo thực tế) | Chủ dự án 05/10/2026 |
| 0.8 | 05/10/2026 04:54 | Claude Code | Kế hoạch lên 1.8 (thêm phiên M1c-12), sổ phiên lên 0.23 | Chủ dự án 05/10/2026 |
| 0.7 | 05/10/2026 04:34 | Claude Code | Kế hoạch lên 1.7 (thêm phiên M1c-11) | Chủ dự án 05/10/2026 |
| 0.6 | 04/10/2026 18:35 | Claude Code | Kế hoạch lên 1.4 (gộp đôi nhịp thành đợt từ nhịp 5) | Chủ dự án chốt 04/10/2026 |
| 0.5 | 04/10/2026 15:16 | Claude Code | Kế hoạch lên 1.1 (một chat điều phối mỗi nhịp) | Chủ dự án đồng ý 04/10/2026 15:16 |
| 0.4 | 04/10/2026 14:42 | Claude Code | Kế hoạch đã duyệt, lên 1.0 | Chủ dự án duyệt 04/10/2026 14:42 |
| 0.3 | 04/10/2026 14:38 | Claude Code | Kế hoạch lên v0.6 (dời mốc 26/10, bỏ PR, gác cổng gộp trên máy và đẩy GitLab); sổ phiên v0.3 | Chủ dự án chốt 04/10/2026 |
| 0.2 | 04/10/2026 14:11 | Claude Code | Cập nhật dòng kế hoạch (v0.4: nhịp, model, token, khóa driver) và sổ phiên (v0.2) | Chủ dự án chốt 04/10/2026 |
| 0.1 | 04/10/2026 13:50 | Claude Code | Tạo thư mục `m1/`: chuyển kế hoạch M1 vào, tách sổ phiên | Chủ dự án duyệt 04/10/2026 13:50 |
