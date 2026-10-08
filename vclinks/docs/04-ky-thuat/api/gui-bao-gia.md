# Gửi báo giá VCsales trong khung chat (M1c-02)

Phiên bản 0.3 · 07/10/2026 · Trạng thái: Nháp

## Tóm tắt

- Mô tả phần M1c-02: hộp **Gửi báo giá** (03 MH-SZ-05i), tab **Báo giá** ở panel phải và ở panel thông tin hội thoại, lệnh `send_quote` trên extension (PDF hoặc ảnh, rồi lời nhắn), collection `quote_sends`, dòng thời gian "Đã gửi báo giá số …", và phần công nợ chuyển từ M1c-08 (dòng công nợ thống nhất, chip và lọc "Nợ quá hạn", "Tôi tự nhắc khách").
- **VCsales chỉ đọc** (CLAUDE.md §7): client chỉ có `listQuotes`, `getQuote`, `getQuoteFiles`, `getQuoteCreateUrl` (một đường dẫn, không ghi gì). Từ 07/10/2026 máy 129 đọc VCsales thật qua `vclinks-bridge` (`VCSALE_MODE=http`, thiết kế ở `docs/04-ky-thuat/api/vclinks-bridge.md`); bản mock chỉ còn dùng cho test tự động.
- **Trạng thái báo giá theo VCsales:** thêm `ordered` ("Đã chốt": từ "Chờ đặt hàng" tới "Đã xuất hóa đơn"), vẫn gửi lại được (Q3 của kế hoạch kết nối). Báo giá bị chặn ghi kèm trạng thái gốc của VCsales, ví dụ "Chưa báo giá". VCsales thật chỉ xuất PDF nên hộp ẩn lựa chọn Ảnh.
- **Chặn ở API, không chỉ ở giao diện:** mỗi lần gửi, API đọc lại báo giá từ VCsales rồi từ chối báo giá hết hạn, chưa duyệt, đã hủy, của khách khác, hoặc đã bị sửa từ lúc người dùng xem. Lệnh "Thử lại", "Gửi ngay", "Duyệt lại" cũng kiểm lại.
- **§12.1 giữ nguyên:** lệnh `send_quote` đi qua outbox hiện có, `approvedBy` + `approvedAt` là của người bấm "Gửi báo giá"; nick "Chưa an toàn", nhịp gửi theo nick, danh sách nhóm test (`onlyThreadIds`) vẫn áp dụng. `POST /api/outbox` từ chối `send_quote` làm tay.
- Không thêm ô nào vào 28 ô "chờ điều kiện" của `phan-quyen.md` §4; chỉ dùng các khóa đã có `quote.view`, `quote.send`, `quote.open_erp`, `cust.debt`.
- Việc còn mở: ảnh xem trước trang 1 của PDF, nhắc việc theo dõi (mới lưu số ngày), báo kế toán + giám sát khi báo giá lớn (TS-HD-08), "Gửi yêu cầu liên kết", lịch sử nhắc nợ; nhóm Zalo gắn khách (hiện ánh xạ tay bằng biến môi trường).
- Người duyệt cần xem kỹ: mục Quyền, mục Thử trên Dashboard (checklist cho chủ dự án), mục Việc còn mở.

## Mục lục

- [1. Luồng gửi](#1-luồng-gửi)
- [2. API](#2-api)
- [3. Quyền](#3-quyền)
- [4. Lệnh send_quote trên extension](#4-lệnh-send_quote-trên-extension)
- [5. Công nợ: dòng thống nhất, chip, lọc, tự nhắc](#5-công-nợ-dòng-thống-nhất-chip-lọc-tự-nhắc)
- [6. Cấu hình](#6-cấu-hình)
- [7. Kiểm thử](#7-kiểm-thử)
- [8. Thử trên Dashboard (checklist cho chủ dự án)](#8-thử-trên-dashboard-checklist-cho-chủ-dự-án)
- [9. Việc còn mở](#9-việc-còn-mở)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Luồng gửi

1. Mở hộp từ nút 📄 ở thanh công cụ ô soạn, hoặc nút **Gửi** ở một báo giá trong tab Báo giá. Hộp gọi `GET /api/quotes/by-identity/:uid/:userId`: API đọc VCsales **trực tiếp** mỗi lần (không cache, BR16).
2. Báo giá không hợp lệ bị làm mờ kèm lý do (chữ theo 03 QT-SZ-03). Chọn dạng **File PDF** (mặc định) hoặc **Ảnh** (Ảnh chỉ có khi chạy mock: API trả `forms: ['pdf']` khi đọc VCsales thật), sửa lời nhắn (≤ 1.000 ký tự, mẫu `Dạ {ten_khach}, em gửi báo giá {so_bao_gia}, tổng {tong_tien}, hiệu lực đến {hieu_luc} ạ.`).
3. Bấm **Gửi báo giá** = người dùng duyệt. `POST /api/quotes/send` làm lần lượt: quyền (`quote.send` trên hội thoại), trạng thái nick và nhóm test, đọc lại báo giá, kiểm khách, kiểm phiên bản, lấy PDF hoặc ảnh từ VCsales, lưu file vào kho media có sẵn (GridFS, mã sha256, chỉ tải được khi có token, không có link công khai), rồi tạo lệnh `send_quote` đã duyệt.
4. Extension nhận lệnh, gửi file rồi gửi lời nhắn, kiểm cả hai bằng bong bóng mới. Báo thành công → ghi `quote_sends` (một dòng cho mỗi lệnh, khóa `_id` = mã lệnh nên báo lại không sinh dòng thứ hai).
5. Dòng thời gian khách (loại **Báo giá**) hiện `Đã gửi báo giá số BG-… (8.450.000 ₫)` cho người được mở hội thoại đó (DK-40); danh sách báo giá hiện `Đã gửi n lần`.

Mã lỗi của `POST /api/quotes/send` (message là chữ hiện cho người dùng): 400 sai dữ liệu hoặc nick không gửi được; 403 không có quyền; 404 không thấy báo giá; 409 khách chưa liên kết mã KH hoặc báo giá **vừa được sửa trên VCsales**; 422 hết hạn, chưa duyệt, đã hủy hoặc khác khách; 502 VCsales không xuất được file; 503 VCsales không trả lời.

## 2. API

| Route | Việc |
|---|---|
| `GET /api/quotes/by-identity/:uid/:userId` | Báo giá của khách đang chat (`items[]` có `block` khi không gửi được, `sendCount`, `erpStatusLabel`), dải nợ quá hạn `debt` (chỉ người có `cust.debt`), `createUrl` ("Tạo báo giá ↗", chỉ người có `quote.open_erp`), `forms` (dạng gửi được) |
| `POST /api/quotes/send` | Body `{uid, threadId, no, form, message, version, followUpDays?}`; trả `{sendId, outboxId, no}` |
| `GET /api/conversations/overdue-debt` | Mã hội thoại của khách nợ quá hạn mà người gọi có `cust.debt` (chỉ cờ, không số tiền) |
| `GET /api/conversations?overdueDebt=1` | Lọc danh sách hội thoại theo cờ trên |
| `GET /api/customers/:id/timeline?type=quote` | Dòng "Đã gửi báo giá số …" |

`quote_sends { _id = id lệnh outbox, uid, threadId, customerCode, no, version, total, form, sentBy, sentByName, approvedAt, sentAt, cliMsgIds, followUpDays, followUpAt }`. Không lưu lời nhắn. Nhật ký `quote.send` chỉ ghi số báo giá, dạng gửi và mã lệnh.

## 3. Quyền

- Tuyến vào hội thoại cần `conv.view` (xem) hoặc `canSend` (gửi); sau đó dịch vụ quyết `quote.view`, `quote.send`, `quote.open_erp`, `cust.debt` trên đích của hội thoại. NVKD có `quote.view` / `quote.send` ở phạm vi **CT** (khách của tôi) và **NICK**, đúng ma trận 01; không ô nào bị nới.
- Nhóm Zalo chưa có hồ sơ khách. Biến `QUOTE_THREAD_CUSTOMERS` ánh xạ tay một nhóm tới mã VCsales; **quyền vẫn lấy từ chủ của khách mang mã đó** (không ai được thêm quyền nhờ ánh xạ). ⛔ Chỉ dùng giai đoạn thử: API bỏ qua biến này khi `NODE_ENV=production`.
- Báo giá được đọc lại trên VCsales **cả lúc extension nhận lệnh (claim)**: hết hạn / hủy / bị sửa trong lúc chờ thì lệnh chuyển `failed` kèm lý do, không giao cho extension. `mark_sent` (MCP) không báo gửi được lệnh `send_quote` chưa claim.
- Danh tính khách chưa xác nhận (DK-15) không xem và không gửi được báo giá.
- Không có đường gửi thiếu duyệt: lệnh `send_quote` chỉ do `QuotesService` tạo; `POST /api/outbox` trả 400 "Báo giá chỉ gửi được bằng hộp Gửi báo giá"; hàng chờ chỉ giao cho extension lệnh có `approvedBy` + `approvedAt` (bộ lọc `APPROVED_FILTER` như mọi lệnh).

## 4. Lệnh send_quote trên extension

`apps/extension/src/sender-actions.ts`, hàm `sendQuote`: dùng lại đường gửi file hoặc ảnh có sẵn (`sendFiles`, nút Đính kèm File hoặc Gửi hình ảnh của Zalo, xác nhận bằng bong bóng đúng loại và đúng tên file), nghỉ 1,5 giây, rồi gửi lời nhắn như tin thường. File lỗi → không gửi lời nhắn. File đã gửi mà lời nhắn lỗi → báo lỗi nói rõ "đã gửi file báo giá … đừng gửi lại file" để người dùng xem Zalo trước khi thử lại. Chưa thử trên Zalo thật (xem mục 8).

## 5. Công nợ: dòng thống nhất, chip, lọc, tự nhắc

- **Một dòng chữ** cho panel khách và trang 360 (cùng `CommerceBlock`, hàm `debtLineText`): `Công nợ: {số} ₫ · Quá hạn {n} ngày (hạn {dd/MM}) · VCsales {HH:mm}` chữ đỏ đậm, có ⚠; chưa quá hạn: `· đến hạn {dd/MM}`. Người không có `cust.debt` chỉ thấy "Công nợ quá hạn: Có/Không".
- **Dải nợ quá hạn** đầu hộp Gửi báo giá, **không khóa** nút gửi (N10).
- **Chip và lọc "Nợ quá hạn"** ở danh sách hội thoại: VCsales được hỏi theo lô 100 mã một lần gọi, cờ lưu đệm 15 phút (`DEBT_FLAG_TTL_MS`, BA §6 "công nợ 15 phút"). VCsales sập, hoặc lần kiểm kết nối gần nhất báo mất, thì dùng bản cũ và không gọi.
- **Tôi tự nhắc khách:** nút ở dòng công nợ quá hạn, chỉ **điền** mẫu vào ô soạn (không tự gửi). Chưa có: hỏi khi số tiền trong tin khác VCsales, lịch sử nhắc, ra khỏi nhắc tự động 7 ngày, phím tắt `/nhac-no-nhe` (06 HD-53).

## 6. Cấu hình

| Biến | Việc |
|---|---|
| `VCSALE_MODE` | `mock` (mặc định) có báo giá và PDF giả; `http` đọc VCsales thật qua `vclinks-bridge` |
| `VCSALE_URL`, `VCSALE_TOKEN` | Địa chỉ bridge và khóa API (khóa chỉ nằm trong `.env` của máy chạy, không in ra) |
| `VCSALE_WEB_URL` | Địa chỉ web VCsales cho nút "Tạo báo giá ↗" |
| `VCSALE_PING_MS` | Nhịp kiểm kết nối VCsales, mặc định 300000 (5 phút); `0` tắt (test) |
| `QUOTE_THREAD_CUSTOMERS` | JSON `{"<uid>:<threadId>":"KH-TEST-0101"}` ánh xạ tay nhóm tới mã khách (nhóm test) |
| `DEBT_FLAG_TTL_MS` | Thời gian giữ cờ nợ quá hạn, mặc định 900000 (15 phút) |

## 7. Kiểm thử

- `apps/api/test/e2e/quotes.e2e-spec.ts` (30 ca): UAT-SZ-27 (gửi hợp lệ, PDF lưu được, `quote_sends`, dòng thời gian), 28 (hết hạn), 29 (sửa giữa chừng), 31 (VCsales sập), 86 và 90 phần dải nợ, cờ nợ không gọi VCsales khi đang mất kết nối, các ca chặn (chưa báo giá, đã hủy, khác khách, thiếu duyệt, nick không an toàn, nhóm test, người không có quyền, thử lại sau khi hủy), nhật ký không chứa lời nhắn.
- `packages/vcsale-client/test` (mock báo giá; bản nối thật với máy chủ bridge giả: khóa, trang, 404, 401 không thử lại, 5xx thử lại một lần, quá thời gian không thử lại, nợ theo lô 100 mã, chỉ PDF; không có lời gọi ghi), `packages/shared/test/quote.test.ts` ("Đã chốt" gửi được), `apps/extension/test/sender-actions.test.ts` (PDF, ảnh, không lời nhắn, file lỗi thì không gửi lời nhắn).

## 8. Thử trên Dashboard (checklist cho chủ dự án)

Bản đọc VCsales thật (máy 129, từ 07/10/2026). Agent không gửi tin cho khách thật; chỉ thử trên hội thoại **Con Hùng** (nick của dev002):

1. Trên VCsales dev (`http://192.168.50.10:6969`), dev002 tạo một khách test có SĐT của Con Hùng và một báo giá "Đủ giá" (Q2 của kế hoạch kết nối).
2. Trên VClinks: hội thoại Con Hùng → ngăn Khách → **Liên kết mã KH…** → tìm theo SĐT hoặc mã → Xác nhận (cần quyền xác nhận của Sale admin).
3. Khối Thương mại hiện hạng, doanh số 12 tháng, nợ, báo giá đang mở, kèm giờ lấy.
4. Bấm 📄 **Gửi báo giá**: báo giá test chọn được; chỉ có dạng PDF; báo giá chưa đủ giá mờ, rê chuột thấy trạng thái gốc.
5. Gửi: Con Hùng nhận file PDF đúng mẫu báo giá của VCsales rồi lời nhắn; tab Báo giá hiện "Đã gửi 1 lần".
6. Sửa báo giá trên VCsales rồi gửi bản đang mở: bị chặn "vừa được sửa trên VCsales".
7. Chuyển báo giá sang "Chờ đặt hàng" trên VCsales: nhãn "Đã chốt", vẫn gửi lại được.
8. Quản trị → Cài đặt → **Kết nối VCsales**: tình trạng "Kết nối tốt"; bấm "Kiểm tra ngay".

## 9. Việc còn mở

- VCsales thật: đã nối qua `vclinks-bridge` ngày 07/10/2026. Còn thiếu: ảnh từng trang báo giá (chỉ có PDF); nút "Tạo báo giá ↗" chưa điền sẵn khách vì màn VCsales chưa đọc mã khách từ đường link.
- Ảnh xem trước trang 1 của PDF (MH-SZ-05i #5) chưa làm: hộp hiện số dòng, người lập, số lần đã gửi.
- Nhắc việc theo dõi (F9.8): hộp và `quote_sends` lưu `followUpDays` / `followUpAt`, **chưa có danh sách nhắc** (module Việc cần làm của file 02 chưa có).
- Báo kế toán và giám sát khi báo giá ≥ TS-HD-08 cho khách nợ quá 60 ngày (06 HD-55 b) và "Gửi yêu cầu liên kết cho Sale admin": chưa làm.
- Nhóm Zalo gắn khách (TD-G01): hiện ánh xạ tay bằng biến môi trường.
- Lệnh `send_quote` đang gửi dở (file đã đi, lời nhắn lỗi) chưa có xử lý riêng ngoài thông báo lỗi.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.3 | 07/10/2026 11:22 | Claude Code (dev002) | Đọc VCsales thật qua `vclinks-bridge`: trạng thái `ordered` ("Đã chốt") và trạng thái gốc, chỉ PDF khi chạy thật (`forms`), cờ nợ theo lô 100 mã lưu đệm 15 phút và bỏ qua khi VCsales đang mất kết nối, biến `VCSALE_*`, checklist thử trên Con Hùng | Kế hoạch kết nối VCsales (C1–C4, C6, C8), dev002 duyệt 07/10/2026 |
| 0.2 | 04/10/2026 23:37 | Gác cổng M1c-02 (Opus) | Kiểm lại báo giá lúc claim; QUOTE_THREAD_CUSTOMERS bỏ qua ở production; mark_sent không đi tắt send_quote; cờ Nợ quá hạn lọc theo phạm vi dữ liệu | Soát §12 gác cổng |
| 0.1 | 04/10/2026 23:27 | Agent Sonnet · M1c-02 | Tạo tài liệu: luồng gửi báo giá, API, quyền, lệnh send_quote, công nợ, checklist thử | Phiên M1c-02, kế hoạch M1 |
