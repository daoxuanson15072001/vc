# Panel thông tin hội thoại và loại tin L5 (M1c-08)

Phiên bản 0.3 · 04/10/2026 · Trạng thái: Nháp

## Tóm tắt

- Mô tả phần M1c-08: panel "Thông tin hội thoại" (MH-SZ-07), hiển thị 4 loại tin L5 (video, vị trí, cuộc gọi, nhắc hẹn), menu chuột phải trên tin, nháp theo hội thoại.
- API mới duy nhất: `GET /api/conversations/:id/shared?kind=media|file|link` dùng chung khóa `conv.view` với `/messages`. **Không thêm ô nào vào 28 ô** của `phan-quyen.md` §4.
- Extension đọc thêm 3 loại (vị trí, cuộc gọi, nhắc hẹn) bằng bảng selector khai báo `MEDIA_SELECTORS`; **chưa có mẫu thật**, nên selector mới chỉ là phỏng đoán và bong bóng loại này vẫn nằm ở "chưa khảo sát" (không lưu, báo drift) cho đến khi chủ dự án gửi mẫu thật và chốt vào `knownBubbles`.
- Việc còn mở: tab Báo giá đã nối với danh sách báo giá của M1c-02 (xem `gui-bao-gia.md`); tab Tìm mới lọc trên tin đã tải, chờ API tìm của M1c-05; "Tạo nhắc việc" mới lưu trên trình duyệt vì module Việc cần làm (file 02) chưa có.
- Người duyệt cần xem kỹ: mục Quyền riêng tư (vị trí, cuộc gọi, Sao chép) và mục Mẫu thật cần thử.

## Mục lục

- [Phạm vi](#phạm-vi)
- [API chia sẻ của hội thoại](#api-chia-sẻ-của-hội-thoại)
- [Nội dung loại tin L5](#nội-dung-loại-tin-l5)
- [Quyền riêng tư](#quyền-riêng-tư)
- [Mẫu thật cần thử](#mẫu-thật-cần-thử)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## Phạm vi

| Hạng mục | Trạng thái |
|---|---|
| Panel (nút ℹ ở tiêu đề chat, hoặc chuột phải → "Xem thông tin hội thoại"): tab Thành viên, Ảnh/Video, File, Link | Đã làm; dùng `/participants` có sẵn và API `/shared` mới |
| Tab Báo giá | Danh sách báo giá của khách đọc từ VCsales, nút Gửi mở hộp Gửi báo giá (M1c-02) |
| Tab Tìm | Lọc trên tin đã tải ở khung chat; chờ API tìm của M1c-05 |
| Tab Khách, Tra hàng | Không làm ở đây: thuộc panel Khách bên phải (M1c-01) |
| Menu chuột phải: Sao chép, Tạo nhắc việc, Xem thông tin hội thoại | Đã làm; Chuyển tiếp và Thu hồi để các GĐ sau |
| Nháp theo hội thoại (D15) | Đã làm, lưu `localStorage` theo người dùng + mã hội thoại, xóa khi gửi; đăng nhập / đăng xuất xóa mọi nháp trên trình duyệt |
| Hiển thị video, vị trí, cuộc gọi, nhắc hẹn | Đã làm trên web; extension đọc 3 loại mới theo phỏng đoán |

## API chia sẻ của hội thoại

`GET /api/conversations/:id/shared?kind=media|file|link&limit=30&before=<ISO>`: tin có ảnh/video, file, hoặc link, mới nhất trước, `hasMore` để tải thêm. Chỉ lấy tin đã có nội dung từ DOM (tin còn là bản mã hóa thì bỏ qua). Khóa quyền `conv.view` đối tượng hội thoại, đúng như `/messages`; nội dung đã niêm phong theo khách (M1b-14) được mở bằng cùng `MessageVault`.

## Nội dung loại tin L5

Lưu trong `messages.content`, qua `POST /api/ingest/message-content` (schema `messageContentItemSchema`):

| Trường | Nội dung |
|---|---|
| `location` | `lat`, `lng` (trong miền hợp lệ), `title`, `address`, `url` (chỉ https) |
| `call` | `outcome` (`missed`, `declined`, `ended`, `unknown`), `video`, `durationSec` |
| `reminder` | `title`, `when` (chữ như trên bong bóng), `at` (mili giây nếu đọc được) |
| `kind` | thêm `location`, `call`, `reminder` |

Danh sách hội thoại hiện `[Vị trí]`, `[Cuộc gọi]`, `[Nhắc hẹn]` làm xem trước khi tin cuối chưa có chữ. Video đã có sẵn (`content.video`).

## Quyền riêng tư

- Vị trí và cuộc gọi là dữ liệu cá nhân: chỉ trả cho người mở được hội thoại (cùng khóa `conv.view`), không có API riêng liệt kê vị trí của khách.
- Log không chứa nội dung tin; code mới không ghi log nội dung.
- "Sao chép" chỉ chép đúng chữ trên bong bóng, tức chữ API đã trả cho người xem (số điện thoại bị che thì vẫn bị che); không gọi nguồn khác để lấy bản đầy đủ.
- Bản đồ không tải ảnh từ bên thứ ba: chỉ có liên kết mở sang trang bản đồ (https). Liên kết trong tin là http thường thì bỏ.
- Nháp và nhắc việc lưu cục bộ trong trình duyệt của người dùng, không gửi lên máy chủ. Cả hai khóa theo người đăng nhập, nên hai người dùng chung máy không thấy của nhau; nháp còn bị xóa hết khi đăng nhập / đăng xuất. Nháp không tạo đường gửi: gửi vẫn qua outbox có duyệt.

## Mẫu thật cần thử

Chủ dự án gửi trong nhóm "Kiểm thử vclink" (không dùng hội thoại khách), sau đó chạy đồng bộ và mở hội thoại trên Dashboard:

1. Vị trí (msgType 17): gửi một vị trí ghim, một vị trí chia sẻ trực tiếp nếu có.
2. Video (msgType 18): gửi một video ngắn; kiểm tra ảnh thu nhỏ và thời lượng.
3. Cuộc gọi: gọi nhỡ, gọi thoại có thời lượng, gọi video (từ điện thoại; Zalo Web không có nút gọi).
4. Nhắc hẹn: tạo một nhắc hẹn trong nhóm.
5. (Nếu có) tin quan trọng / khẩn cấp (C22).

Mỗi loại, nếu Dashboard báo "chưa khảo sát" (drift `dom_selectors`), dùng khung xương trong drift để chốt selector vào `MEDIA_SELECTORS` và `knownBubbles`.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.3 | 04/10/2026 23:27 | Agent Sonnet · M1c-02 | Tab Báo giá nối với `QuotesPanel` (danh sách báo giá, nút Gửi) | Phiên M1c-02 |
| 0.2 | 04/10/2026 23:07 | Claude Code · gác cổng M1c-08 | Nháp và nhắc việc khóa theo người dùng, nháp xóa khi đăng nhập / đăng xuất | Gác cổng M1c-08, CLAUDE.md §12 |
| 0.1 | 04/10/2026 22:56 | Claude Code · M1c-08 | Tạo tài liệu: panel, API `/shared`, nội dung L5, quyền riêng tư, mẫu thật cần thử | Phiên M1c-08, kế hoạch M1 |
