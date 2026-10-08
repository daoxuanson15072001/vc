# Vận hành — thư mục `docs/06-van-hanh/`

Phiên bản 0.11 · 07/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- Hướng dẫn chạy, cài đặt, khởi động lại và xử lý sự cố khi vận hành VClinks.
- Hiện có Chrome driver dùng chung (máy thu / gửi Zalo mặc định), sổ tay nick Zalo trực tiếp (zca-js) và hướng dẫn tenant, migration, tiến trình connector. Sau này thêm: triển khai, sao lưu, giám sát.
- Cách chạy local cho dev xem `README.md` ở gốc repo.

## Mục lục

- [Danh sách file](#danh-sách-file)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## Danh sách file

| File | Tóm tắt 1 dòng | Phiên bản | Cập nhật | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| [chrome-driver.md](chrome-driver.md) | Chrome driver dùng chung (CDP 9333), nhiều nick (fleet + watchdog) và máy Zalo (quét QR trên Dashboard): cài đặt, chạy trên cloud, quét lại QR, khóa driver, xử lý sự cố; máy Zalo trực tiếp (zca-js) nhận và gửi | 1.11 | 07/10/2026 | Đang áp dụng | Khớp code; chưa nói `DRIVER_EXT_ID`, `uat.js`, `uat-toolbar.js` |
| [may-zalo-truc-tiep.md](may-zalo-truc-tiep.md) | Sổ tay vận hành nick Zalo trực tiếp (zca-js): cách chạy, trạng thái, xử lý sự cố, việc không được làm, danh sách kiểm bảo mật P5 (11/12 đạt) | 0.1 | 06/10/2026 | Nháp | P5 của kế hoạch zca-js; kiểm trên máy 129 |
| [tenant-va-connector.md](tenant-va-connector.md) | tenant_id, migration (chỉ chạy bản sao, bản thật do chủ dự án quyết), nhật ký sự kiện, tiến trình connector | 0.1 | 04/10/2026 | Chờ duyệt | M1b-01 |
| [asr-worker.md](asr-worker.md) | Chạy worker chuyển ghi âm thành chữ (faster-whisper): Docker hoặc Python, model, kiểm tra nhanh, sự cố | 0.1 | 04/10/2026 | Chờ duyệt | M1c-04; thử thật 1 ghi âm tự tạo |
| [kpi-baseline.md](kpi-baseline.md) | Job KPI hằng ngày (FRT, % quá SLA, tin quá 2 giờ, % qua VClinks, % đăng nhập), lệnh tính lại, xuất CSV | 0.1 | 04/10/2026 | Chờ duyệt | M1b-15; mẫu CSV ở mau/ |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.11 | 07/10/2026 16:33 | Claude Code (dev002) | chrome-driver.md lên 1.11 (người giữ nick tự ngắt nick của mình) | dev002 07/10/2026 |
| 0.10 | 07/10/2026 14:48 | Claude Code (dev002) | chrome-driver.md lên 1.10 (máy 129 nhận tối đa 12 nick) | dev002 07/10/2026 |
| 0.9 | 06/10/2026 11:25 | Claude Code (dev002) | chrome-driver.md lên 1.9 (máy Zalo trực tiếp: nhận tin vào Hộp thư, gửi tin đã duyệt); cùng phiên thêm may-zalo-truc-tiep.md (sổ tay nick trực tiếp, 0.1) | Yêu cầu dev002 06/10/2026 |
| 0.8 | 06/10/2026 08:58 | Claude Code (dev002) | chrome-driver.md lên 1.8 (công tắc lấy nội dung tin chưa đọc) | Yêu cầu dev002 06/10/2026 |
| 0.7 | 05/10/2026 19:02 | Claude Code (dev002) | chrome-driver.md lên 1.7 (mục Máy Zalo) | Yêu cầu dev002 05/10/2026 |
| 0.6 | 05/10/2026 09:22 | Claude Code | chrome-driver.md lên 1.6 (cửa sổ lấy nội dung riêng nick-02, tên cửa sổ) | Chủ dự án 05/10/2026 Q4 |
| 0.5 | 05/10/2026 08:20 | Claude Code | chrome-driver.md lên 1.5 (danh sách gửi chủ dự án chỉ định) | Chủ dự án 05/10/2026 |
| 0.4 | 04/10/2026 23:02 | Agent Sonnet · M1c-04 | Thêm asr-worker.md | Phiên M1c-04 |
| 0.3 | 04/10/2026 20:32 | Claude Code · M1b-15 | Thêm kpi-baseline.md | Kế hoạch M1 §5 M1b-15 |
| 0.2 | 04/10/2026 15:37 | Claude Code · M1b-01 | Thêm tenant-va-connector.md | Kế hoạch M1 §5 M1b-01 |
| 0.1 | 04/10/2026 13:33 | Claude Code | Tạo file quản lý thư mục khi sắp xếp lại docs/ | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:33 |
