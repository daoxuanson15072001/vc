# Realtime và giám sát SLA

Phiên bản 0.2 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Dashboard nhận tin mới, lệnh gửi lỗi, nick mất kết nối và thông báo qua **một luồng SSE** `GET /api/realtime/stream` (SSE là kênh một chiều máy chủ → trình duyệt, chạy trên HTTP thường). Chọn SSE vì Dashboard chỉ cần nhận, không cần gửi lên, và hạ tầng hiện có không có WebSocket.
- **Bảo mật (§12):** luồng bắt buộc đăng nhập (Bearer, đọc bằng `fetch` chứ không bằng `EventSource` để không đưa token lên URL). Mỗi sự kiện được lọc theo **phạm vi `conv.view` của người nhận** (engine phân quyền có sẵn, không nới ô nào trong 28 ô chờ điều kiện): người chỉ giữ nick A không nhận gì về nick B.
- Sự kiện chỉ mang mã (`type`, `id`, `uid`, `threadId`, `kind`), không có nội dung tin, không có tên khách. Thông báo trình duyệt hiện "tên hội thoại: có tin mới".
- Sự kiện đi qua bộ sưu tập `realtime_events` (tự xóa sau 1 giờ), mỗi tiến trình có người đang nghe quét 1 giây/lần. Nhờ vậy tin vào ở tiến trình connector vẫn tới Dashboard ở tiến trình web. Độ trễ thực đo ≤ 2 giây (yêu cầu ≤ 5 giây).
- **Giám sát SLA:** mỗi 60 giây, hội thoại quá hạn SLA (tính theo phút làm việc của division) báo **giám sát của người giữ nick** (nick chính thức: của người được giao); một lần cho mỗi lượt chờ; **ngoài giờ làm việc không báo**, quá hạn lúc nghỉ thì báo khi mở ca.
- Việc còn mở: câu hỏi cho chủ dự án ở sổ phiên (đường truyền khi chạy nhiều bản API, báo tin cho người không giữ nick). Người duyệt xem kỹ mục Lọc theo quyền.

## Mục lục

- [Luồng và sự kiện](#luồng-và-sự-kiện)
- [Lọc theo quyền](#lọc-theo-quyền)
- [Giám sát SLA](#giám-sát-sla)
- [Phía trình duyệt](#phía-trình-duyệt)
- [Cấu hình](#cấu-hình)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## Luồng và sự kiện

| Sự kiện | Khi nào | Trường |
|---|---|---|
| `message.new` | Tin khách vào (gửi trong 15 phút gần nhất, không phải tin của nick; nạp lại lịch sử cũ không báo) | `uid`, `threadId`, `id = uid:threadId` |
| `command.failed` | Lệnh gửi ghi kết quả lỗi | `uid`, `threadId`, `id` = mã lệnh |
| `account.red` / `account.ok` | Nick mất / lấy lại phiên Zalo | `uid` |
| `notification` | Có thông báo mới cho người dùng (gồm `sla_breach`) | `id` = mã thông báo, `kind`; chỉ gửi đúng người nhận |

Mã nguồn: `apps/api/src/realtime/` (`realtime.service.ts`, `realtime.controller.ts`, `sla-monitor.service.ts`); kiểu dùng chung `packages/shared/src/realtime.ts`.

## Lọc theo quyền

- Người nhận có phạm vi dữ liệu `conv.view` (cả kênh, hoặc từng hội thoại được cấp tạm) mới thấy sự kiện `uid`/`threadId` đó; nick đang "chờ xác nhận" bị ẩn với mọi người; người đã khóa không nhận gì. Phạm vi lưu đệm 15 giây mỗi kết nối.
- Kết nối đang mở tự kiểm lại token mỗi 15 giây (`REALTIME_RECHECK_MS`): phiên bị thu hồi (khóa, nghỉ việc, đăng xuất) thì luồng bị đóng; người đã khóa cũng không nhận thông báo cá nhân.
- Nhiều tiến trình (`VCLINKS_ROLE=web` / `connector`) cùng ghi: tiến trình đọc lùi 3 giây sau con trỏ và bỏ sự kiện đã gửi, để không lỡ sự kiện cùng một giây.
- `notification` có `userId` đích: chỉ người đó nhận.
- Token cũ không gắn người dùng chỉ vào được khi `AUTHZ_LEGACY_TOKENS=1`; còn lại 403. Route khai báo `SIGNED_IN` trong `route-permissions.ts`.
- Test: `apps/api/test/e2e/realtime.e2e-spec.ts` (NVKD kia không nhận sự kiện nick của người này, GĐ nhận, không có nội dung tin trên luồng).

## Giám sát SLA

- Nguồn: `conversations.slaDueAt` do M1b-09 tính theo lịch làm việc của division (`sla_settings`).
- Người nhận: giám sát của người giữ nick (`supervisorOf`), nếu không có thì quản lý gần nhất trên chuỗi tổ chức. Tiêu đề thông báo: "Có hội thoại quá N phút chưa trả lời", liên kết mở thẳng hội thoại, không có nội dung tin.
- Quét theo con trỏ, sắp theo `slaDueAt` (có chỉ mục), tối đa 500 thông báo mỗi lượt; hội thoại chưa báo được (division ngoài giờ, không có người nhận) không chặn các hội thoại khác.
- Chống lặp: ghi `slaNotifiedSince` = mốc chờ bắt đầu; trả lời xong rồi khách nhắn lại thì là lượt chờ mới, báo lại được.
- Chưa làm: thông báo cho giám sát khi lệnh lỗi treo quá 30 phút (D26), nhắc nhiều cấp (giám sát rồi giám đốc), nhóm chat.

## Phía trình duyệt

- `apps/web/src/components/layout/RealtimeBridge.tsx` gắn trong khung ứng dụng: làm mới danh sách hội thoại, tin, lệnh gửi, nick, chuông; tự nối lại (3 giây, gấp đôi tới 30 giây) và tải lại một lần sau khi nối lại.
- Âm báo, thông báo trình duyệt và số chưa đọc trên tiêu đề tab (`(3) VClinks`) chỉ cho tin của **nick mình giữ**; thông báo SLA luôn có âm khi tab ở nền.

## Cấu hình

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `REALTIME_POLL_MS` | 1000 | Chu kỳ quét sự kiện của tiến trình đang có người nghe |
| `REALTIME_RECHECK_MS` | 15000 | Chu kỳ kiểm lại token của kết nối đang mở |
| `SLA_MONITOR_MS` | 60000 | Chu kỳ quét SLA |
| `SLA_MONITOR` | bật | `off` để tắt giám sát |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 04/10/2026 22:15 | Claude Code · gác cổng M1c-07 | Kiểm lại token trên luồng đang mở, đọc lùi chống lỡ sự kiện nhiều tiến trình, quét SLA theo con trỏ có chỉ mục | Gác cổng M1c-07 |
| 0.1 | 04/10/2026 22:09 | Claude Code · M1c-07 | Tạo mới | Phiên M1c-07 |
