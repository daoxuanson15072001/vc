# Phiếu báo giá / hậu mãi: CSKH soạn ⇄ NVKD duyệt (M1c-03)

Phiên bản 0.1 · 05/10/2026 · Trạng thái: Nháp

## Tóm tắt

- NVKD chọn ≤ 10 tin (kèm ảnh, ghi âm) trong khung chat nick cá nhân rồi bấm "Chuyển CSKH soạn báo giá" hoặc "Chuyển hậu mãi cho CSKH". Hệ thống tạo phiếu `TK-…` vào **hàng việc** Bán hàng / Hậu mãi; không gửi gì cho khách.
- CSKH nhận phiếu, gắn **báo giá đã duyệt, còn hiệu lực** trên VCsales (chỉ đọc), soạn lời nhắn, rồi "Chuyển NVKD duyệt". CSKH **không có đường gửi** qua nick: không route, không lệnh outbox, không tool MCP, không extension (có test).
- Người giữ nick (hoặc người đang trực nick) bấm **Duyệt & gửi**: báo giá đi qua `QuotesService.send` (lệnh `send_quote`, QuoteGate kiểm lại lúc extension nhận), lời nhắn đơn thuần đi qua `OutboxService.create`; `approvedBy` / `approvedAt` là người bấm.
- Máy trạng thái D9-02 nằm ở `packages/shared/src/workitem.ts`, test phủ mọi chuyển và mọi chuyển cấm.
- **Giả định thay E6/E7 (cần chủ dự án xem):** giao diện MH-SZ-15 làm theo chữ đặc tả và kiểu màn hiện có (chưa có thiết kế); T-36 = 2 lần trả lại, nhắc 10′, báo giám sát 20′ (đặt bằng biến môi trường); giá tham khảo C3 không dùng; `onlyThreadIds` giữ nguyên.
- **Chưa làm:** giám sát "Duyệt & gửi thay" sau 20′ (ô `workitem.approve` GS/GĐ đang "chờ điều kiện on_behalf", không nới); AI trích nhu cầu (tắt); AI tự tạo phiếu (M2); ghi chú nội bộ tự động trong hội thoại; dòng thời gian 360 "CSKH soạn, NVKD duyệt"; lọc nhanh "Chờ tôi duyệt" trong hộp thư.
- **Người duyệt cần xem kỹ:** mục 4 (CSKH chỉ đọc tin được chọn, không đọc cả hội thoại, khác D9-04) và mục 6 (các giả định).

## Mục lục

- [1. Thành phần](#1-thành-phần)
- [2. Máy trạng thái](#2-máy-trạng-thái)
- [3. API](#3-api)
- [4. Quyền và §12](#4-quyền-và-12)
- [5. Nhắc, báo giám sát, theo dõi lệnh gửi](#5-nhắc-báo-giám-sát-theo-dõi-lệnh-gửi)
- [6. Giả định thay đầu vào còn thiếu (E6, E7)](#6-giả-định-thay-đầu-vào-còn-thiếu-e6-e7)
- [7. Kiểm thử](#7-kiểm-thử)
- [8. Việc chưa làm](#8-việc-chưa-làm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Thành phần

| File | Việc |
|---|---|
| `packages/shared/src/workitem.ts` | Trạng thái, sự kiện, `workitemTransition`, nhãn tiếng Việt, schema zod, kiểu trả về |
| `apps/api/src/workitems/workitems.service.ts` | Tạo phiếu, chia vòng tròn theo hàng việc, chuyển trạng thái, Duyệt & gửi, theo dõi lệnh gửi, quét nhắc / báo giám sát |
| `apps/api/src/workitems/workitems.controller.ts` | Route `/api/workitems…` |
| `apps/api/src/authz/route-permissions.ts` | Khóa quyền từng route (nhóm "Phiếu CSKH soạn – NVKD duyệt") |
| `apps/web/src/components/workitems/` | Hộp tạo phiếu, thanh chọn tin, chip phiếu, panel phiếu, hook API |
| `apps/web/src/pages/WorkitemsPage.tsx` | `/approvals` (khay "Chờ tôi duyệt"), `/workitems` (Bán hàng, Hậu mãi, Cấu hình hàng việc) |
| `apps/web/src/components/chat/ChatPane.tsx`, `MessageMenu.tsx` | Chuột phải tin → 2 mục chuyển CSKH; chế độ chọn tin; chip trên tiêu đề |

Collection mới (theo tenant): `work_items`, `workitem_queues` (`<division>:<ban_hang|hau_mai>` → danh sách người, con trỏ vòng tròn), `workitem_counters` (số `TK-`).

## 2. Máy trạng thái

`Mới` → `CSKH đang xử lý` → `Chờ NVKD duyệt` ⇄ `Trả lại CSKH` → (Duyệt & gửi) `Đã gửi khách` → `Chờ khách` (báo giá) / bước CSKH đã chọn cho hậu mãi (`Chờ hãng`, `CSKH đang xử lý`, `Xong`) → `Xong` (kết quả bắt buộc).

| Sự kiện | Từ | Tới | Ai |
|---|---|---|---|
| `start` | Mới, Trả lại | CSKH đang xử lý | CSKH giữ phiếu |
| `submit` | CSKH đang xử lý, Trả lại | Chờ NVKD duyệt | CSKH (`workitem.submit` TK); cần lời nhắn, báo giá (phiếu báo giá), hạn hẹn nếu chọn Chờ hãng |
| `return` | Chờ NVKD duyệt | Trả lại | `workitem.return`; lý do bắt buộc |
| `approve` | Chờ NVKD duyệt | Đã gửi khách | `workitem.approve` NICK + `canSend` |
| `sent` | Đã gửi khách | Chờ khách / Chờ hãng / CSKH đang xử lý / Xong | hệ thống, khi lệnh outbox `sent` |
| `send_failed` | Đã gửi khách | Chờ NVKD duyệt | hệ thống, khi lệnh bị **Bỏ** |
| `self_reply` | Mới, CSKH đang xử lý, Trả lại, Chờ NVKD duyệt | Xong ("NVKD tự xử lý") | `workitem.return` |
| `wait_vendor` / `vendor_back` | CSKH đang xử lý ⇄ Chờ hãng | | CSKH (chỉ hậu mãi; hạn hẹn bắt buộc) |
| `close` | CSKH đang xử lý, Chờ khách, Chờ hãng | Xong | CSKH; kết quả theo loại phiếu |

Lệnh gửi `failed` / `expired` **không** đưa phiếu về chờ duyệt (xử lý Thử lại / Bỏ lệnh ở "Lệnh gửi") để một câu trả lời không bao giờ có hai lệnh. Mỗi chuyển ghi `history` (người, lúc, lý do mã, kết quả) đủ cho KPI-31…33.

## 3. API

| Route | Khóa ở route | Việc |
|---|---|---|
| `GET /api/workitems?view=approvals\|queue\|conversation\|mine` | một trong `ticket.view`, `ticket.create`, `workitem.*` | Danh sách; service lọc từng phiếu |
| `GET /api/workitems/counts` | như trên | Số chờ tôi duyệt, số quá 10′, số theo hàng việc |
| `GET/PUT /api/workitems/queues` | `workitem.queue_config` (xem / đủ) | Cấu hình hàng việc; thành viên phải là CSKH của division |
| `POST /api/workitems` | `ticket.create` trên hội thoại | Tạo phiếu từ tin đã chọn |
| `GET /api/workitems/:id` | như danh sách | Chi tiết: tin nguồn đã che, báo giá đọc lại từ VCsales, nút được bấm |
| `GET /api/workitems/:id/quotes` | `quote.view` | Báo giá đã duyệt, còn hiệu lực để CSKH gắn |
| `PATCH /api/workitems/:id` | `ticket.resolve` | CSKH sửa lời nhắn, gắn / bỏ báo giá, bước sau khi gửi, hạn hẹn |
| `POST /:id/start`, `wait-vendor`, `vendor-back`, `close` | `ticket.resolve` | |
| `POST /:id/submit` | `workitem.submit` | |
| `POST /:id/return`, `self-reply` | `workitem.return` | |
| `POST /:id/approve` | `workitem.approve` | **Đường gửi duy nhất** |
| `POST /:id/assign` | `ticket.assign` | Giám sát CSKH chia lại |

## 4. Quyền và §12

- Không nới ô nào của ma trận (28 ô "chờ điều kiện" giữ nguyên). CS `orders_only` vẫn đóng: CSKH **không** mở được hội thoại; chỉ đọc đúng các tin được chọn vào phiếu (đọc qua phiếu, không qua phạm vi kênh). Đây là cách hẹp hơn D9-04 (CSKH đọc toàn văn); mở D9-04 cần quyết định riêng.
- SĐT, email trong tin nguồn che bằng `maskContactsInText` khi người xem không thấy SĐT đầy đủ trên nick đó (`phoneOn`); người giữ nick thấy đủ.
- Người duyệt = người đang trực nick (nếu có trực thay hiệu lực) hoặc người giữ nick (PQ-119); khay "Chờ tôi duyệt" chỉ hiện phiếu của người duyệt hiện tại (UAT-PQ-122). Duyệt & gửi kiểm `workitem.approve` (NICK) và `canSend` (nick Chưa an toàn → khóa).
- Nhật ký `workitem.*` chỉ có mã phiếu, trạng thái, mã lý do, số tin; không có nội dung tin, lời nhắn, ghi chú. Tiêu đề thông báo không chứa nội dung tin.

## 5. Nhắc, báo giám sát, theo dõi lệnh gửi

- Job mỗi `WORKITEM_SWEEP_MS` (mặc định 60 000 ms; `WORKITEM_JOBS=off` để tắt): (a) phiếu `Đã gửi khách` theo trạng thái lệnh outbox; (b) phiếu `Chờ NVKD duyệt` quá `WORKITEM_REMIND_MIN` (10) phút làm việc → nhắc người duyệt; quá `WORKITEM_ESCALATE_MIN` (20) → báo giám sát bán hàng của nick và giám sát CSKH, phiếu hiện ở khay của giám sát. Phút làm việc theo lịch division (`slaConfigFor`).
- Trả lại lần thứ `WORKITEM_MAX_RETURNS + 1` (mặc định lần 3) → báo giám sát bán hàng của người trả lại và giám sát CSKH, kèm danh sách lý do (không kèm ghi chú). Người duyệt không phải owner → owner nhận "Để biết".
- Thông báo dùng `NotificationsService` (đẩy SSE của M1c-07); Dashboard tải lại danh sách phiếu khi có thông báo.

## 6. Giả định thay đầu vào còn thiếu (E6, E7)

| Đầu vào | Đang làm | Sửa khi có |
|---|---|---|
| E6: thiết kế MH-SZ-15 (khay, chip, panel) | Bố cục theo bảng thành phần MH-SZ-15 / MH-OA-20, dùng antd và kiểu màn hiện có | Thay giao diện `components/workitems/*`, `WorkitemsPage.tsx`; API không đổi |
| E7: T-36 (§21 câu 28) | 2 lần (đề xuất BA), biến `WORKITEM_MAX_RETURNS` | Đổi biến môi trường |
| E7: nhắc 10′, giám sát 20′ (D4-21) | `WORKITEM_REMIND_MIN`, `WORKITEM_ESCALATE_MIN` | Đổi biến môi trường |
| E7: giá tham khảo C3 (câu 31) | Không hiện, không dùng | — |
| QĐ-04 (bỏ `onlyThreadIds`) | Giữ nguyên: Duyệt & gửi vẫn qua `assertCanSend`, chỉ gửi được vào nhóm test | — |
| "AI trích nhu cầu" (M1c-06, E8) | Nút khóa; `WORKITEM_AI_EXTRACT=1` mới hiện bật (chưa nối) | Nối worker suggest |
| Hạn gửi khách (T-14) | Mặc định 90′ từ lúc tạo | — |

## 7. Kiểm thử

- `packages/shared/test/workitem.test.ts`: mọi cạnh cho phép, mọi bộ (trạng thái, sự kiện, đích) bị cấm, chỉ `approve` tới `Đã gửi khách`, không sự kiện CSKH nào gửi.
- `apps/api/test/e2e/workitems.e2e-spec.ts`: UAT-SZ-93, 94, 95, 96, 98 (phần làm được không cần Zalo), UAT-PQ-119 (phần M1c-03: chỉ tin được chọn, SĐT che, hội thoại vẫn đóng), UAT-PQ-121 (CSKH: approve 403, `POST /outbox` 403, `POST /quotes/send` 403, `canSend` false kể cả giám sát CSKH, chỉ một route gửi), UAT-PQ-122 (khay ở người trực thay, `approvedBy` = người trực, `sendSource = truc_thay`), nhắc 10′ / giám sát 20′, lệnh bị bỏ quay lại chờ duyệt, giám sát CSKH chia lại.
- Phía extension đóng vai bằng `claim` + `result`; VCsales là mock. Chưa thử tay trên trình duyệt, chưa gửi thật vào nhóm test.

## 8. Việc chưa làm

- Giám sát / GĐ "Duyệt & gửi thay" (UAT-SZ-97): chờ mở điều kiện `on_behalf` của `workitem.approve`; hiện giám sát thấy phiếu quá 20′ và Trả lại được.
- CSKH đọc toàn văn hội thoại (D9-04, UAT-PQ-119 bản đầy đủ, UAT-PQ-120): chưa mở.
- Ghi chú nội bộ tự động trong hội thoại, dòng thời gian 360 "CSKH {tên} soạn, {người} duyệt", bộ lọc nhanh "Chờ tôi duyệt" trong hộp thư, menu `⋯` tiêu đề, tự nhận phiếu từ hàng việc, giám sát CSKH đề xuất cấu hình hàng việc (chế độ propose), cờ "Chờ tạo mã KH" báo Sale admin.
- Phiếu trên kênh chính thức (CSKH gửi thẳng, 04 MH-OA-20 #9): thuộc phần OA.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 05/10/2026 00:05 | Agent Opus · M1c-03 | Tạo tài liệu: máy trạng thái, API, quyền §12, nhắc / giám sát, giả định thay E6/E7, kiểm thử | Phiên M1c-03 |
