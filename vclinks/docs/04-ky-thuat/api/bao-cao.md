# Báo cáo cơ bản: API và màn hình (M1c-09)

Phiên bản 0.2 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Trang `/reports` (menu "Báo cáo") có khung bộ lọc, "Dashboard của tôi" cho nhân viên kinh doanh (NVKD), "Tổng quan" và "Hiệu suất" cho giám sát (GS), giám đốc (GĐ), ban giám đốc (XEM); xuất Excel.
- Số lấy từ bảng `kpi_daily` của job M1b-15 (số lượt chờ, phút chờ), không tính lại khi mở trang; ngày chưa kết thúc thì chưa có số (job chạy sau 01:00).
- Ai thấy gì được quyết **một chỗ** trong `apps/api/src/reports/reports.service.ts`: nick trong phạm vi `report.performance` (tổ, division) cộng nick chính mình giữ; tên từng người chỉ hiện qua phạm vi tổ hoặc division; XEM chỉ thấy theo tổ.
- Không nới ô nào trong 28 ô "chờ điều kiện" của `phan-quyen.md` mục 4.
- File Excel và danh sách lượt chờ không có nội dung tin; tên hiển thị khách bị che nếu giống số điện thoại; mỗi lần xuất ghi `export.report` (chỉ loại file, kỳ, số dòng).
- Việc còn mở: số chụp cuối kỳ, báo giá và doanh số (cần VCsales), độ phủ nick, giải trình và tính lại lượt, yêu cầu xuất cần duyệt khi trên 500 dòng.
- Người duyệt xem kỹ mục 3 (quyền) và mục 5 (chỗ lệch với đặc tả 07).

## Mục lục

- [1. Route](#1-route)
- [2. Dữ liệu](#2-dữ-liệu)
- [3. Ai thấy gì](#3-ai-thấy-gì)
- [4. Màn hình](#4-màn-hình)
- [5. Lệch với đặc tả 07 và việc chưa làm](#5-lệch-với-đặc-tả-07-và-việc-chưa-làm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Route

| Route | Quyền | Việc |
|---|---|---|
| `GET /api/reports/performance?from&to&team&compare` | `report.performance` | Số theo dòng (NVKD, tổ hoặc kênh), tổng, số kỳ trước (compare=1), trung bình tổ cho NVKD |
| `GET /api/reports/performance/turns?...&row&breachedOnly` | `report.performance` | Danh sách lượt chờ (Drawer "Lượt chờ", "Lượt quá SLA"); tối đa 31 ngày, 500 dòng |
| `GET /api/reports/performance/export?...&detail` | `report.export` | File `vclinks_bao-cao-hieu-suat_yyyyMMdd_HHmm.xlsx`: Tóm tắt, Theo NVKD (hoặc Theo tổ), Lượt chờ (khi `detail=1`), Định nghĩa |

Kiểu dữ liệu: `packages/shared/src/reports.ts`. Kỳ tối đa 120 ngày; mặc định 7 ngày kết thúc hôm qua.

## 2. Dữ liệu

- `kpi_daily` (M1b-15) một dòng mỗi nick mỗi ngày. Báo cáo nhóm các dòng theo người giữ nick (`channel_access` mức `giu_nick`) và tổ của người đó (đơn vị loại `to_ban_hang`).
- FRT của dòng tổng là trung vị của mọi lượt (BC-14), tính từ danh sách phút chờ đã lưu, không lấy trung bình các trung vị.
- Danh sách lượt chờ tính lại từ `messages` theo đúng luật của job (`MetricsService.turnDetails`), chỉ đọc id, giờ gửi, người gửi; không đọc nội dung.

## 3. Ai thấy gì

| Người xem | Chế độ | Thấy |
|---|---|---|
| NVKD (phạm vi CT) | `self` | Một dòng "Của tôi" (mọi nick mình giữ) và trung bình tổ không tên, không thứ hạng; không có tab Hiệu suất, không xuất Excel; truy vấn `team=` hay `row=` của người khác bị bỏ qua hoặc trả 403 |
| GS (TO), GĐ (DV) | `nvkd` | Từng NVKD trong tổ hoặc division của mình; chọn tổ ngoài phạm vi thì bỏ qua; xem danh sách lượt chờ; xuất Excel (có thể kèm chi tiết) |
| XEM (TD) | `team` | Chỉ dòng theo tổ; **không** xem danh sách lượt chờ, **không** xuất file chi tiết (BC-12, BC-17) |
| Admin | – | Không có `report.performance`: 403 (số đếm theo kênh BC-20 làm ở phiên sau) |

Danh sách lượt chờ và file chi tiết chỉ lấy nick xem được theo tên (nick mình giữ, phạm vi TO / DV): người xem TD có giữ nick riêng cũng chỉ thấy lượt của nick mình (sửa ở gác cổng). Tên khách che cả chuỗi giống SĐT lẫn địa chỉ email; ô Excel bắt đầu bằng `= + - @` được thêm dấu `'` để không chạy thành công thức.

Cách tính phạm vi: kênh trong `dataScope(u, 'report.performance')` cộng nick mình giữ; mỗi kênh dùng `decide()` để biết quyền đến từ TO / DV (hiện tên) hay TD (gộp theo tổ). Đọc `kpi_daily` bằng `runUnscoped` nhưng luôn kèm danh sách `uid` đã tính ở đây, nên khác hẳn việc bỏ lọc.

## 4. Màn hình

`apps/web/src/pages/reports/`: `ReportsPage` (khung, bộ lọc ghi vào query string, mặc định kỳ theo vai trò), `OverviewTab` (thẻ số, Δ so kỳ trước tô màu theo hướng tốt), `PerformanceTab` (bảng + Drawer), `TurnsDrawer`, `ExportModal`. Hàm kỳ và định dạng số: `apps/web/src/utils/report.ts` (có test).

## 5. Lệch với đặc tả 07 và việc chưa làm

- Trung vị theo "thứ hạng gần nhất" (như M1b-15): với 2 lượt 10′ và 30′ ra 10′, đặc tả UAT-BC-01 mong 20′ (trung bình hai số giữa). Chờ chủ dự án chọn.
- "Ngày làm việc trước" web chỉ bỏ Chủ nhật, chưa theo lịch ngày lễ của division. "Họp tuần" và số chụp chưa có.
- Chưa làm: số chụp cuối kỳ (MH-BC-09), báo giá và doanh số (KPI-13…16, cần VCsales), độ phủ nick (BC-27), giải trình và tính lại lượt (BC-26), nhắc từ bảng, heatmap giờ, nhóm Zalo (QĐ-50), chất lượng dữ liệu, chăm sóc khách, yêu cầu xuất cần duyệt (trên 500 dòng bị từ chối).
- Lượt do GS trả lời thay vẫn tính cho người giữ nick; chưa có cột "Trả lời hộ" (cần `sendSource` theo người gửi).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 04/10/2026 22:16 | Claude Code · gác cổng M1c-09 | Lượt chờ / file chi tiết chỉ từ nick xem được theo tên; che email trong tên khách; chống công thức Excel | Gác cổng M1c-09 |
| 0.1 | 04/10/2026 22:12 | Claude Code · M1c-09 | Tạo tài liệu báo cáo cơ bản | Phiên M1c-09 |
