# Đo baseline KPI (job KPI hằng ngày, xuất CSV)

Phiên bản 0.1 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Mỗi đêm hệ thống tính số đo "trước khi dùng VClinks" cho từng tài khoản kênh: số lượt chờ trả lời, thời gian trả lời đầu (FRT), % quá hạn SLA, % chờ quá 15 phút, số tin chờ quá 2 giờ, % trả lời bằng VClinks, % người đăng nhập.
- Số tính thẳng từ bảng tin nhắn, nên hội thoại cũ **không cần backfill**; chạy lại bao nhiêu lần cũng không sinh trùng (mỗi nick mỗi ngày một dòng `kpi_daily`).
- Chủ dự án lấy file CSV qua `GET /api/metrics/kpi/export?from=&to=` hoặc xem file mẫu `docs/06-van-hanh/mau/kpi-baseline-mau.csv`. CSV không có nội dung tin và không có số điện thoại.
- Số liệu lọc theo phạm vi quyền ngay trong truy vấn; tỉ lệ đăng nhập chỉ hiện cho phạm vi toàn công ty.
- Còn mở: NVKD (phạm vi "khách của tôi") chưa thấy số của mình cho tới khi M1b-12 có dữ liệu owner; chỉ tiêu G1–G6 chờ chủ dự án (Q-BC-19); màn báo cáo là M1c-09.
- Người duyệt xem kỹ mục "Cách tính" (định nghĩa lượt chờ) vì mọi số đều dựa vào đó.

## Mục lục

- [Cách tính](#cách-tính)
- [Chạy job và lệnh tính lại](#chạy-job-và-lệnh-tính-lại)
- [Lấy số và CSV](#lấy-số-và-csv)
- [Giới hạn đã biết](#giới-hạn-đã-biết)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## Cách tính

- **Lượt chờ:** bắt đầu ở tin khách đầu tiên sau tin cuối của tài khoản; kết thúc ở tin kế tiếp của tài khoản (giờ gửi thật, kể cả tin gửi từ điện thoại). Nhiều tin khách liên tiếp chỉ là một lượt. Chỉ hội thoại 1-1; nhóm chờ QĐ-50. Lượt thuộc ngày (giờ Việt Nam) nó bắt đầu.
- **Thời gian chờ:** phút **trong giờ làm việc** của division (bảng `sla_settings`, mặc định T2–T6 + sáng T7). Lượt chưa trả lời tính tới lúc chạy job.
- **FRT:** trung vị và P90 của mọi lượt đã trả lời trong khoảng chọn (không lấy trung bình các ngày).
- **% quá SLA:** lượt chờ lâu hơn SLA (mặc định 15 phút) ÷ số lượt. **% quá 15 phút** dùng ngưỡng cố định 15 phút cho mọi nơi (G1). **Quá 2 giờ:** chờ hơn 120 phút làm việc.
- **% qua VClinks:** lượt mà tin trả lời trùng `cliMsgId` với lệnh đã gửi từ hàng lệnh gửi ÷ lượt đã trả lời; phần còn lại là "từ điện thoại".
- **% đăng nhập:** người có dòng `login` trong `audit_log` trong ngày ÷ người dùng đang hoạt động; chỉ toàn công ty.

## Chạy job và lệnh tính lại

- Job tự chạy sau 01:00 giờ Việt Nam mỗi ngày, tính lại 3 ngày gần nhất (để bắt tin về trễ). Tắt bằng `KPI_JOB=off`.
- Tính một khoảng ngày cũ (chỉ chạy trên bản sao hoặc DB thử trước): `pnpm --filter @vclinks/api kpi:baseline --from 2026-09-01 --to 2026-10-03`. Cần `MONGO_URI`. Lệnh in số ngày, số nick, số lượt, không in nội dung.
- Mỗi lần chạy ghi một sự kiện `kpi.computed` vào nhật ký sự kiện (chỉ đếm số). Truy vấn `audit_log` giới hạn từng ngày, theo chỉ mục `at`.

## Lấy số và CSV

- `GET /api/metrics/kpi?from=yyyy-mm-dd&to=yyyy-mm-dd&by=day|account|day_account`: cần quyền `report.performance`.
- `GET /api/metrics/kpi/export`: CSV, cần thêm `report.export`. Tối đa 120 ngày một lần.
- Ô văn bản bắt đầu bằng `=`, `+`, `-`, `@` được chèn dấu nháy để bảng tính không chạy thành công thức.

## Giới hạn đã biết

- Ngày cũ tính theo cấu hình giờ làm việc hiện tại, không theo cấu hình lúc đó.
- Chưa có chia theo người chịu lượt (cần owner của M1b-12) và chưa có KPI về báo giá, hồ sơ khách.
- Chưa tách tin tự động khỏi tin trả lời của người.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 04/10/2026 20:32 | Claude Code · M1b-15 | Tạo tài liệu | Kế hoạch M1 §5 M1b-15 |
