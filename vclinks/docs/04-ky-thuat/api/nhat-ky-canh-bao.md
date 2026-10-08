# Nhật ký truy cập và cảnh báo bất thường (M1b-07)

Phiên bản 0.1 · 04/10/2026 · Trạng thái: Nháp

## Tóm tắt

- Mô tả cách VClinks cho người có quyền tra "ai xem SĐT, ai xuất, ai đổi quyền, AI đã đọc gì" (đặc tả 01 MH-PQ-10) và tự cảnh báo khi một người lấy dữ liệu khách bất thường (MH-PQ-14, PQ-46).
- Nhật ký là collection `audit_log` đã có; phiên này chỉ **đọc, lọc theo phạm vi `audit.view`** và thêm cảnh báo. Không ai sửa hay xóa được dòng nhật ký.
- Cảnh báo chạy ngay khi một dòng nhật ký được ghi. Đã làm được **R1, R2, R3, R4, R5, R8, R9**. **R6, R7, R10, R11 có trong danh sách nhưng đang tắt**, vì dữ liệu chúng cần chưa được ghi (địa chỉ IP, cờ Sắp nghỉ, token thiết bị, bàn giao nick).
- Quy tắc nhật ký (§12.3): dòng nhật ký chỉ có mã, số đếm, lý do. Hai lớp chặn: dịch vụ ghi sạch, và `sanitizeDetail` bỏ khóa nội dung (`text`, `message`, `phone`…) và che số điện thoại khi ghi, khi hiện, khi xuất.
- Việc còn mở: ghi `mcp.call` kèm `targets[]` và IP (M1b-06 gắn token MCP), `export.create` (chưa có tính năng xuất khách), `customer.view` (M1b-12/13); gửi email và Zalo OA nội bộ cho cảnh báo (Q-PQ-23).
- Người duyệt cần xem kỹ: bảng ngưỡng mặc định ở mục 3 (lấy nguyên từ PQ-46), và việc người bị cảnh báo chỉ nhận một lời nhắc, không thấy cảnh báo về mình.

## Mục lục

- [1. Đọc nhật ký](#1-đọc-nhật-ký)
- [2. Hoạt động của tôi](#2-hoạt-động-của-tôi)
- [3. Quy tắc cảnh báo](#3-quy-tắc-cảnh-báo)
- [4. Route](#4-route)
- [5. Kiểm thử](#5-kiểm-thử)

## 1. Đọc nhật ký

- `GET /api/admin/audit` lọc theo thời gian (tối đa 92 ngày, mặc định 7 ngày), người, chủ thể (Người / AI / Thiết bị / Hệ thống), nhóm hành động, mã đối tượng. Mặc định chỉ nhóm Truy cập dữ liệu, Xuất, Xóa.
- Phạm vi theo `audit.view`: Tập đoàn (Admin, QS) thấy tất cả; Division thấy người trong division; Tổ thấy người trong tổ; người khác chỉ dùng "Hoạt động của tôi".
- Tra theo **một người khác mình** thì ghi `audit.view_person` kèm vai trò và tên người tra; người bị tra thấy ở "Hoạt động của tôi" (PQ-40).
- Tra theo mã khách ra cả dòng có mã đó trong `detail.targets[]` (AI đã đọc, file xuất có khách đó, PQ-47).
- `GET /api/admin/audit/export` xuất xlsx tối đa 50.000 dòng, cần `report.export`; lần xuất ghi `audit.export`. `GET /api/admin/audit/overview` là Tổng quan kiểm soát (đếm theo nhóm, top 10, so kỳ trước).

## 2. Hoạt động của tôi

`GET /api/me/activity`: việc mình đã làm, dòng "<Vai trò> <tên> đã xem nhật ký của bạn (dd/MM/yyyy)", và "AI đã đọc <n> khách, <m> hội thoại" mỗi ngày (từ `mcp.call` có `detail.userId`). Màn hình: `/settings/activity`, mở từ trang Hồ sơ.

## 3. Quy tắc cảnh báo

Mặc định lấy từ PQ-46, lưu đè trong `alert_rules`. Mỗi dòng nhật ký đi qua `AlertsService.evaluate`; vượt ngưỡng thì tạo **một** cảnh báo cho mỗi quy tắc và người trong khoảng chống trùng (ít nhất 1 giờ), chỉ cập nhật số liệu nếu cảnh báo cũ chưa xử lý.

| Mã | Đọc dòng | Điều kiện |
|---|---|---|
| R1 | `phone.reveal` | > 20 lần/giờ hoặc > 60/ngày (GS, GĐ: 40 / 120) |
| R2 | `customer.view` | ≥ 40 hồ sơ khác nhau/24 giờ và > 3 lần mức TB 30 ngày của chính người đó |
| R3 | `export.*` | kèm SĐT, > 500 dòng, > 1 lần/ngày, hoặc ngoài giờ |
| R4 | `mcp.call` | > 200 lần/giờ hoặc > 300 đối tượng/ngày |
| R5 | `login`, `conversation.view`, `mcp.call` | 22:00–06:00 hoặc Chủ nhật (giờ Việt Nam) |
| R8 | `grant.request` | > 3 lần/tuần |
| R9 | `conversation.view` | qua quyền tạm thời hoặc người `quan_sat`, > 50 hội thoại/ngày |

- **Người nhận** theo quy tắc, và phải có `audit.view` bao người đó (GS chỉ nhận cảnh báo của người trong tổ). **Người bị cảnh báo không nhận**; `POST /api/reveal` chỉ trả thêm `warning` khi vượt ngưỡng R1 (UAT-PQ-28).
- Trạng thái Mới / Đã xem / Đã xử lý; "Đã xử lý" cần ghi chú 10–500 ký tự và ghi `alert.handle` (chỉ mã). Người ngoài danh sách nhận gọi vào cảnh báo nhận 404.
- Admin sửa quy tắc (`alert.config` đầy đủ); QS chỉ đề xuất (`alert.propose`); mỗi lần sửa ghi `alert.config` kèm `notifyQuanSat`.
- Chưa có: kênh email / Zalo OA, gom theo giờ (cảnh báo đang hiện ngay trong ứng dụng).

## 4. Route

Khai báo ở `apps/api/src/authz/route-permissions.ts`: `GET /api/admin/audit`, `/export`, `/overview`, `GET /api/me/activity`, `GET /api/admin/alerts`, `POST /api/admin/alerts/:id/seen`, `/handle`, `GET /api/admin/alert-rules`, `PUT /api/admin/alert-rules/:code`, `POST /api/admin/alert-rules/:code/propose`. Giao diện: tab "Nhật ký truy cập" và "Cảnh báo" trong `/admin`.

## 5. Kiểm thử

`apps/api/test/e2e/audit-alerts.e2e-spec.ts` (21 ca): UAT-PQ-28, 86, 87; UAT-PQ-72 phần R5 (R6 chờ IP); UAT-PQ-88 ở mức hình dạng dòng nhật ký; phạm vi GS/GĐ/QS; xuất xlsx; và ca quét toàn bộ `audit_log`, `events`, `alerts` và câu trả lời API để chắc không có nội dung tin hay SĐT đầy đủ. `sanitize.spec.ts` kiểm tra hàm làm sạch.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 04/10/2026 20:19 | Claude Code · M1b-07 | Tạo mới | Phiên M1b-07 |
