# Thiết kế — thư mục `docs/03-thiet-ke/`

Phiên bản 0.3 · 07/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- Hồ sơ thiết kế: giao diện, kiến trúc, quyết định kỹ thuật (theo ISO/IEC/IEEE 15289: mô tả thiết kế).
- Thiết kế giao diện hiện nằm trên canvas claude.ai "VClinks UI Design"; file ở đây giữ link và cách đọc canvas.
- Kiến trúc tổng thể hiện mô tả trong `CLAUDE.md` §2–§5 ở gốc repo; bản kiểm kê chức năng và đánh giá khả năng mở rộng ở `kiem-ke-chuc-nang-va-mo-rong.md`.

## Mục lục

- [Danh sách file](#danh-sách-file)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## Danh sách file

| File | Tóm tắt 1 dòng | Phiên bản | Cập nhật | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| [artifacts.md](artifacts.md) | Danh sách 5 artifact claude.ai của VClinks và cách đọc canvas VClinks UI Design | 1.2 | 04/10/2026 | Đang áp dụng |
| [kiem-ke-chuc-nang-va-mo-rong.md](kiem-ke-chuc-nang-va-mo-rong.md) | Kiểm kê toàn bộ chức năng (tài khoản, phân quyền, kênh, hộp thư, nghiệp vụ, AI, quản trị), cấu hình nằm ở UI / ENV / DB / code, chấm điểm mở rộng, 8 đề xuất (1–4 đã làm: phiên đăng nhập, SLA, nhận / giao hội thoại, vai trò tùy chỉnh) | 0.1 | 06/10/2026 | Nháp | 3 artifact BA chỉ được trỏ từ file này, ô Ghi chú trống; canvas còn tên lô D1/D2 |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.3 | 07/10/2026 11:22 | Claude Code (dev002) | Thêm `kiem-ke-chuc-nang-va-mo-rong.md` (0.1; cùng phiên: đề xuất 1–4 đã làm) | Yêu cầu dev002 06/10/2026 |
| 0.2 | 04/10/2026 13:50 | Claude Code | `artifacts.md` lên 1.2 | Chủ dự án duyệt 04/10/2026 13:50 |
| 0.1 | 04/10/2026 13:33 | Claude Code | Tạo file quản lý thư mục khi sắp xếp lại docs/ | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:33 |
