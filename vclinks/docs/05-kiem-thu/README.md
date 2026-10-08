# Kiểm thử — thư mục `docs/05-kiem-thu/`

Phiên bản 0.9 · 07/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- Hồ sơ kiểm thử (theo ISO/IEC/IEEE 29119-3): dữ liệu kiểm thử dùng chung và biên bản UAT.
- Ca UAT nằm trong từng đặc tả `02-yeu-cau/dac-ta/00…07`; dữ liệu cho các ca đó ở `du-lieu-kiem-thu.md` (mã TD-).
- Mỗi đợt UAT là một thư mục `uat/<yyyy-mm-dd>/` có `README.md` là biên bản, kèm ảnh và kết quả thô.

## Mục lục

- [Danh sách file](#danh-sách-file)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## Danh sách file

| File | Tóm tắt 1 dòng | Phiên bản | Cập nhật | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| [du-lieu-kiem-thu.md](du-lieu-kiem-thu.md) | Bộ dữ liệu kiểm thử chung TD-: người dùng, kênh, khách, chứng từ, kịch bản, dùng cho UAT 00–07 | TD- | 1.6 | 04/10/2026 | Đang áp dụng | Đầu file ghi "00–06" dù 07 đã dùng từ v1.4; bảng §8.4 thiếu cột 07; TD-DH8 đứng trước TD-DH7 |
| [du-lieu-mau/](du-lieu-mau/) | File CSV mẫu cho nhập lô: cây tổ chức TD, người dùng TD, file 60 dòng có lỗi cho UAT-PQ-63 (dùng với `pnpm seed:org`) | – | 04/10/2026 | Đang áp dụng | Dữ liệu thử, không phải file nhân sự thật (chờ E4) |
| [2026-09-29/README.md](uat/2026-09-29/README.md) | Biên bản UAT kênh Zalo cá nhân 29/09/2026: 13/13 đạt, độ trễ gửi 0,6–1 s, thanh công cụ lượt 1–2 | 1.1 | 04/10/2026 | Đã nghiệm thu | `ket-qua.json` được nhắc nhưng không có (chỉ có `ket-qua-toolbar.json`); thiếu nhiều ảnh được nhắc tới; còn dùng tên DB cũ `vcconnect` |
| [2026-10-04/m1b.md](uat/2026-10-04/m1b.md) | Biên bản UAT M1b (phiên M1b-16): 169 ca, 29/29 ca "không được thấy" đạt, checklist 33 dòng cho chủ dự án, danh sách lỗi; lệnh `pnpm uat:m1b` dựng môi trường thử | 0.5 | 05/10/2026 | Chờ duyệt | Chờ chủ dự án thử checklist và xác nhận cách che SĐT trong tin (L-02, đã sửa theo mặc định); 3 ca PQ-70, 72, 82 đã sửa ở M1b-18 |
| [2026-10-05/kich-ban-nhieu-nguoi.md](uat/2026-10-05/kich-ban-nhieu-nguoi.md) | Kịch bản UAT nhiều người thật trên hệ thống thật: khởi tạo (cây tổ chức, vai trò, gán nick, khách) → việc hàng ngày → việc đột xuất; 5 phiếu vai, lịch 2h30, 5 câu hỏi | 0.1 | 05/10/2026 | Nháp | Chưa có màn "Thêm khách / Giao cho" (Q1); chữ khóa ô soạn ghi nhóm cũ (L-01) |
| [2026-10-06/bo-test-toan-he-thong.md](uat/2026-10-06/bo-test-toan-he-thong.md) | Bộ test toàn hệ thống 161 ca / 14 mảng (có nhận / giao hội thoại, 7 ca vai trò tùy chỉnh, 25 ca kết nối VCsales thật 07/10), kết quả chạy thật trên hội thoại Con Hùng 06/10/2026 (5 lệnh gửi đạt), 10 lỗi (8 đã sửa, 1 chờ mã workspace, 1 không phải lỗi), việc cần làm tiếp | 0.1 | 07/10/2026 | Nháp | Chỉ gửi vào Con Hùng; VS-04, VS-06 chờ khách test trên VCsales dev |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.9 | 07/10/2026 16:33 | Claude Code (dev002) | Thêm bộ test toàn hệ thống uat/2026-10-06/bo-test-toan-he-thong.md (0.1; cùng phiên: kết quả sửa lỗi, ca nhận / giao hội thoại, 7 ca vai trò tùy chỉnh, 15 ca kết nối VCsales); chuyển 3 dòng lịch sử 0.8, 0.6, 0.5 bị lạc trong bảng file về đúng mục này; 10 ca danh mục và Việc VCsales; ca KN-06a người giữ nick tự ngắt nick của mình | Yêu cầu dev002 06/10/2026 |
| 0.8 | 05/10/2026 10:23 | Claude Code | Dòng uat/2026-10-04/m1b.md lên 0.5 (sửa đường dẫn worktree) | Chốt commit 05/10/2026 |
| 0.7 | 05/10/2026 09:56 | Claude Code | Thêm kịch bản UAT nhiều người thật uat/2026-10-05/kich-ban-nhieu-nguoi.md (0.1) | Yêu cầu chủ dự án 05/10/2026 |
| 0.6 | 04/10/2026 23:16 | Agent Sonnet · M1b-18 | Dòng uat/2026-10-04/m1b.md lên 0.4 (3 ca còn trượt đã đạt) | Phiên M1b-18 |
| 0.5 | 04/10/2026 22:59 | Agent Sonnet · M1b-17 | Dòng uat/2026-10-04/m1b.md lên 0.3 (kết quả sau sửa lỗi UAT) | Phiên M1b-17 |
| 0.4 | 04/10/2026 22:40 | Claude Code · gác cổng M1b-16 | Dòng uat/2026-10-04/m1b.md lên 0.2 | Gác cổng M1b-16 |
| 0.3 | 04/10/2026 22:35 | Agent Sonnet · M1b-16 | Thêm biên bản UAT M1b (uat/2026-10-04/m1b.md) | Phiên M1b-16 |
| 0.2 | 04/10/2026 18:18 | Claude Code · M1b-03 | Thêm thư mục du-lieu-mau (CSV mẫu nhập lô) | Phiên M1b-03 |
| 0.1 | 04/10/2026 13:33 | Claude Code | Tạo file quản lý thư mục khi sắp xếp lại docs/ | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:33 |
