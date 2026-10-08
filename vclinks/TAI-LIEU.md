# Tài liệu dự án VClinks — file quản lý cấp dự án

Phiên bản 0.34 · 07/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- File này là tầng trên cùng trong 3 tầng quản lý tài liệu (CLAUDE.md §13): **file** (lịch sử cuối mỗi file) → **thư mục** (`README.md` của thư mục) → **dự án** (file này).
- `docs/` xếp theo vòng đời phần mềm thành 7 thư mục đánh số (chủ dự án duyệt 04/10/2026); quy chuẩn và quy tắc đặt tên ở [docs/README.md](docs/README.md).
- Quy định tài liệu md (§13): mỗi file từ 1.500 ký tự có **tóm tắt, mục lục, lịch sử** (lịch sử ghi ngày giờ); sơ đồ không bắt buộc, sơ đồ đã có giữ nguyên.
- **Đã hồi tố toàn bộ** 95 file md của dự án (04/10/2026), kể cả 61 hồ sơ rà soát.
- Chủ dự án quyết (04/10/2026): **không sửa nội dung tài liệu cho khớp code**; các chỗ lệch chỉ ghi ở cột Ghi chú của README thư mục.
- Tiến độ hồi tố: [docs/01-quan-ly-du-an/hoi-to-tai-lieu-md.md](docs/01-quan-ly-du-an/hoi-to-tai-lieu-md.md).

## Mục lục

- [Gốc repo](#gốc-repo)
- [docs/](#docs)
- [Ngoài docs/](#ngoài-docs)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## Gốc repo

| File | Tóm tắt nhanh | Phiên bản | Trạng thái |
|---|---|---|---|
| [CLAUDE.md](CLAUDE.md) | Đặc tả dự án cho Claude: bối cảnh, kiến trúc, dữ liệu, kênh, MCP, nguyên tắc bắt buộc, quy định tài liệu md và cấu trúc `docs/` (§13) | 1.13 | Đang áp dụng |
| [AGENTS.md](AGENTS.md) | Bản sao nguyên văn của CLAUDE.md cho Codex và agent khác | 1.13 | Đang áp dụng |
| [README.md](README.md) | README cho dev: nâng cấp database cũ, chạy local, kiểm thử, bảo mật GĐ1 | 1.3 | Đang áp dụng |
| TAI-LIEU.md | File này | 0.6 | Đang áp dụng |

## docs/

Quy chuẩn thư mục: [docs/README.md](docs/README.md).

| Thư mục | Tóm tắt nhanh các file | File quản lý |
|---|---|---|
| [01-quan-ly-du-an/](docs/01-quan-ly-du-an/) | Thư mục `m1/`: kế hoạch code M1 theo 38 phiên chat và sổ phiên; thời gian và chi phí (dự báo lại 05/10/2026 theo số đo M1); sổ quyết định chủ dự án (94 QĐ, 13 TT, 60 TS); danh sách hồi tố md; kế hoạch nháp đa kênh, OA/Fanpage, Zalo cá nhân quét QR, Zalo cá nhân trực tiếp bằng zca-js, kết nối VCsales qua `vclinks-bridge` (chờ duyệt); lộ trình VClinks, VCwiki và AI trung tâm (nháp) | [README](docs/01-quan-ly-du-an/README.md) |
| [02-yeu-cau/](docs/02-yeu-cau/) | BA tổng 0.6.2; 8 đặc tả `dac-ta/00…07` (giao diện chung, phân quyền, khách đa kênh, sale Zalo, CSKH OA, marketing, hóa đơn – công nợ, báo cáo – chia khách); personas; hồ sơ rà soát `ra-soat/` | [README](docs/02-yeu-cau/README.md) |
| [03-thiet-ke/](docs/03-thiet-ke/) | Link 5 artifact claude.ai, cách đọc canvas "VClinks UI Design"; kiểm kê chức năng và đánh giá khả năng mở rộng (06/10/2026) | [README](docs/03-thiet-ke/README.md) |
| [04-ky-thuat/](docs/04-ky-thuat/) | API: REST, MCP cho Claude, MCP dev, phân quyền, mô hình khách, báo cáo cơ bản, gợi ý trả lời AI, tìm tin nhắn, kho file và ghi âm → chữ, gửi báo giá VCsales, thiết kế `vclinks-bridge` (API chỉ đọc VCsales, đã chạy trên máy dev), danh mục và Việc VCsales, phiếu CSKH soạn – NVKD duyệt; kết nối kênh Zalo OA, Fanpage, Facebook cá nhân; khảo sát Zalo Web (IndexedDB, selector DOM, bản đồ tính năng) | [README](docs/04-ky-thuat/README.md) |
| [05-kiem-thu/](docs/05-kiem-thu/) | Bộ dữ liệu kiểm thử chung TD-; biên bản UAT Zalo cá nhân 29/09/2026 (13/13 đạt); biên bản UAT M1b 04/10/2026 (169 ca, checklist cho chủ dự án); kịch bản UAT nhiều người thật 05/10/2026 (khởi tạo → hàng ngày → đột xuất, 5 phiếu vai); bộ test toàn hệ thống 06/10/2026 (160 ca, chạy thật trên hội thoại Con Hùng; mảng kết nối VCsales thật 07/10) | [README](docs/05-kiem-thu/README.md) |
| [06-van-hanh/](docs/06-van-hanh/) | worker chuyển ghi âm thành chữ; Chrome driver dùng chung (CDP 9333) và nhiều nick trên cloud (fleet, watchdog, quét lại QR): cài đặt, khởi động lại, xử lý sự cố; sổ tay nick Zalo trực tiếp (zca-js) và danh sách kiểm bảo mật; tenant, migration, tiến trình connector; đo baseline KPI và xuất CSV | [README](docs/06-van-hanh/README.md) |
| [07-demo/](docs/07-demo/) | Nguồn dựng mô phỏng sale Zalo; kịch bản video demo 3:18 (mp4 không trong git) | [README](docs/07-demo/README.md) |

## Ngoài docs/

| File / thư mục | Tóm tắt nhanh | Trạng thái |
|---|---|---|
| [apps/extension/README.md](apps/extension/README.md) | VClinks Extension (Chrome MV3): build, cài, cấu hình, đồng bộ, bảo mật, drift, cấu trúc mã | 1.1 · Đang áp dụng |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.34 | 07/10/2026 14:55 | Claude Code (dev002) | CLAUDE.md, AGENTS.md lên 1.13 (đăng nhập nhận thêm @vcpart.vn; trước đó bảng còn ghi 1.10) | dev002 07/10/2026 |
| 0.33 | 07/10/2026 14:05 | Claude Code (dev002) | Dòng `01-quan-ly-du-an/`: thêm lộ trình VClinks, VCwiki và AI trung tâm | Yêu cầu dev002 07/10/2026 |
| 0.32 | 07/10/2026 12:12 | Claude Code (dev002) | Dòng `06-van-hanh/`: thêm sổ tay nick Zalo trực tiếp (`may-zalo-truc-tiep.md`); cùng phiên `02-yeu-cau/`: 01-phan-quyen.md 1.5.2, 00-giao-dien-chung.md 1.5.3 (mọi mail công ty đăng nhập được); `03-thiet-ke/`: kiểm kê chức năng và mở rộng (đề xuất 1–4 đã làm); `05-kiem-thu/`: bộ test toàn hệ thống (160 ca); `01-quan-ly-du-an/`: kế hoạch kết nối VCsales (có tiến độ); `04-ky-thuat/`: api/goi-y-ai.md 0.3, api/vclinks-bridge.md, api/gui-bao-gia.md 0.3, api/mo-hinh-khach.md 0.2, api/viec-vcsales.md | Yêu cầu dev002 06/10/2026 (P5; đăng nhập; kiểm kê và bộ test) |
| 0.31 | 06/10/2026 09:40 | Claude Code (dev002) | Dòng `01-quan-ly-du-an/`: thêm kế hoạch Zalo cá nhân trực tiếp bằng zca-js | Yêu cầu dev002 06/10/2026 |
| 0.30 | 05/10/2026 18:17 | Claude Code (dev002) | Dòng `01-quan-ly-du-an/`: thêm 3 kế hoạch nháp (đa kênh, OA/Fanpage, Zalo cá nhân quét QR) | Yêu cầu dev002 05/10/2026 |
| 0.29 | 05/10/2026 09:56 | Claude Code | `05-kiem-thu/`: thêm uat/2026-10-05/kich-ban-nhieu-nguoi.md (kịch bản UAT nhiều người thật, 0.1); README lên 0.7 | Yêu cầu chủ dự án 05/10/2026 |
| 0.28 | 05/10/2026 05:01 | Claude Code | Dòng `01-quan-ly-du-an/`: 38 phiên, chi phí dự báo lại 05/10 | Chủ dự án 05/10/2026 |
| 0.27 | 05/10/2026 00:05 | Agent Opus · M1c-03 | `04-ky-thuat/`: thêm api/phieu-cskh.md (phiếu báo giá / hậu mãi CSKH soạn – NVKD duyệt) | Phiên M1c-03 |
| 0.26 | 04/10/2026 23:27 | Agent Sonnet · M1c-02 | `04-ky-thuat/`: thêm api/gui-bao-gia.md (gửi báo giá, công nợ, checklist thử); panel-thong-tin-l5.md lên 0.3 (nhánh ghi 0.24, gác cổng đánh lại 0.26) | Phiên M1c-02 |
| 0.25 | 04/10/2026 23:16 | Agent Sonnet · M1b-18 | `05-kiem-thu/`: m1b.md lên 0.4; `04-ky-thuat/`: phan-quyen.md lên 0.6 (nhánh ghi 0.22, gác cổng đánh lại 0.25) | Phiên M1b-18 |
| 0.24 | 04/10/2026 22:59 | Agent Sonnet · M1b-17 | `05-kiem-thu/`: m1b.md lên 0.3 (kết quả UAT sau sửa lỗi); `02-yeu-cau/`: 00-giao-dien-chung.md lên 1.5.2 (nhánh ghi 0.21, gác cổng đánh lại 0.24) | Phiên M1b-17 |
| 0.23 | 04/10/2026 23:02 | Agent Sonnet · M1c-04 | `04-ky-thuat/`: thêm kho-file-va-ghi-am.md; `06-van-hanh/`: thêm asr-worker.md (nhánh ghi 0.20, gác cổng đánh lại 0.23) | Phiên M1c-04 |
| 0.22 | 04/10/2026 22:57 | Agent Sonnet · M1c-05 | `04-ky-thuat/`: thêm tim-kiem.md (tìm tin nhắn toàn văn theo quyền) (nhánh ghi 0.21, gác cổng đánh lại 0.22) | Phiên M1c-05 |
| 0.21 | 04/10/2026 22:56 | Agent Sonnet · M1c-08 | `04-ky-thuat/`: thêm api/panel-thong-tin-l5.md (panel thông tin hội thoại, loại tin L5, mẫu thật cần thử) | Phiên M1c-08 |
| 0.20 | 04/10/2026 22:35 | Agent Sonnet · M1b-16 | `05-kiem-thu/`: thêm uat/2026-10-04/m1b.md (UAT M1b, checklist, danh sách lỗi) (nhánh ghi 0.17, gác cổng đánh lại 0.20) | Phiên M1b-16 |
| 0.19 | 04/10/2026 22:32 | Agent Opus · M1c-06 | `04-ky-thuat/`: thêm goi-y-ai.md (gợi ý trả lời AI, cách bật live khi có E8) (nhánh ghi 0.17, gác cổng đánh lại 0.19) | Phiên M1c-06 |
| 0.18 | 04/10/2026 22:09 | Claude Code · M1c-07 | `04-ky-thuat/`: thêm realtime.md (SSE, giám sát SLA) | Phiên M1c-07 |
| 0.17 | 04/10/2026 22:16 | Claude Code · gác cổng M1c-09 | `04-ky-thuat/`: thêm api/bao-cao.md (báo cáo cơ bản: API hiệu suất, lượt chờ, xuất Excel) | Phiên M1c-09 |
| 0.16 | 04/10/2026 22:04 | Agent Sonnet · M1b-13 | `04-ky-thuat/`: thêm customer-360.md (Customer 360, panel khách, dòng thời gian, che SĐT theo quyền) | Phiên M1b-13 |
| 0.15 | 04/10/2026 21:59 | Claude Code · M1b-11 | `04-ky-thuat/`: phan-quyen.md lên 0.5 (nghỉ việc, bàn giao) | Phiên M1b-11 |
| 0.14 | 04/10/2026 20:22 | Claude Code · M1b-12 | `04-ky-thuat/`: thêm mo-hinh-khach.md (mô hình khách, nạp VCsales, quy tắc gộp) | Phiên M1b-12 |
| 0.13 | 04/10/2026 20:32 | Claude Code · M1b-15 | `06-van-hanh/`: thêm kpi-baseline.md (đo baseline KPI) | Kế hoạch M1 §5 M1b-15 |
| 0.12 | 04/10/2026 20:25 | Claude Code · M1b-06 | `04-ky-thuat/`: phan-quyen.md lên 0.3 (gán kênh, token) | Phiên M1b-06 |
| 0.11 | 04/10/2026 20:19 | Claude Code · M1b-07 | `04-ky-thuat/`: thêm nhat-ky-canh-bao.md (nhật ký truy cập, cảnh báo) | Phiên M1b-07 |
| 0.10 | 04/10/2026 19:18 | Claude Code · M1b-05 | `04-ky-thuat/`: phan-quyen.md lên 0.2 (màn hình, thành phần dùng chung) | Phiên M1b-05 |
| 0.9 | 04/10/2026 19:08 | Claude Code · M1b-04 | `04-ky-thuat/`: thêm phan-quyen.md (engine phân quyền) | Phiên M1b-04 |
| 0.8 | 04/10/2026 15:37 | Claude Code · M1b-01 | `06-van-hanh/`: thêm tenant-va-connector.md | Kế hoạch M1 §5 M1b-01 |
| 0.7 | 04/10/2026 13:50 | Claude Code | `01-quan-ly-du-an/`: thêm thư mục con `m1/` (kế hoạch M1 + sổ phiên) | Chủ dự án duyệt 04/10/2026 13:50 |
| 0.6 | 04/10/2026 13:43 | Claude Code | Hồi tố xong `README.md` gốc và `apps/extension/README.md`; ghi nhận hoàn tất hồi tố | Chủ dự án 04/10/2026 13:43 |
| 0.5 | 04/10/2026 13:42 | Claude Code | Ghi nhận đã hồi tố 61 hồ sơ rà soát | Chủ dự án 04/10/2026 13:42 |
| 0.4 | 04/10/2026 13:38 | Claude Code | Bỏ dòng `Claude outputs/`: đã xoá bản nháp cũ `doi-chieu-luong-A-B.md`, thư mục trống | Chủ dự án duyệt xoá 04/10/2026 13:38 |
| 0.3 | 04/10/2026 13:34 | Claude Code | Viết lại theo cấu trúc `docs/` mới (7 thư mục); bỏ mục Mô hình vì sơ đồ vẽ theo cấu trúc cũ đã sai; CLAUDE.md 1.5, AGENTS.md 1.4 | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:34 |
| 0.2 | 04/10/2026 13:23 | Claude Code | CLAUDE.md lên 1.4, AGENTS.md lên 1.3 (§13 bỏ yêu cầu sơ đồ); thêm dòng tóm tắt về quy định mới | Yêu cầu chủ dự án 04/10/2026 13:23 |
| 0.1 | 04/10/2026 | Claude Code | Tạo file quản lý cấp dự án | CLAUDE.md §13 |
