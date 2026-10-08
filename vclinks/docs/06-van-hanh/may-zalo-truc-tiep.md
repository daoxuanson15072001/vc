# Sổ tay vận hành nick Zalo trực tiếp (máy Zalo, zca-js)

Phiên bản 0.1 · 06/10/2026 · Trạng thái: Nháp

## Tóm tắt

- Dành cho người vận hành máy Zalo trên máy 129 khi nick chạy chế độ **"Trực tiếp"** (thư viện zca-js, không có Chrome). Gồm: cách chạy, ý nghĩa trạng thái trên Dashboard, xử lý sự cố, việc không được làm, lệnh kiểm tra nhanh.
- **Danh sách kiểm bảo mật bước P5 (kiểm ngày 06/10/2026): đạt 11/12 mục.** Mục còn lại là chặn mạng ra ngoài của container. Mục này chưa làm vì chế độ Zalo Web và việc tải tệp đính kèm vẫn cần mạng ngoài; xem lại sau bước P6.
- Phiên đăng nhập của nick chỉ nằm trong `session.enc` (mã hóa) trên volume máy Zalo. Test và kiểm thật trên máy 129 không thấy phiên trong log, trong lời gọi API hay trong MongoDB.
- Hai lớp bảo vệ thêm ở P5 có hiệu lực từ lần triển khai máy Zalo tới (sau 10:16 ngày 08/10/2026). Một là lọc câu lỗi của thư viện trước khi báo lên Dashboard. Hai là bước kiểm tên miền của thư viện khi build image.
- Sự cố hay gặp nhất: nick mở Zalo Web ở nơi khác nên kết nối trực tiếp bị ngắt; hoặc Zalo không nhận phiên đã lưu. Cả hai đều xử lý bằng cách quét lại QR.
- Không đổi `ZALO_FARM_SESSION_KEY`, không sao lưu volume máy Zalo ra ngoài, không nâng phiên bản zca-js khi chưa đọc code bản mới.
- Người duyệt xem kỹ mục 4 (việc không được làm) và mục 5 (danh sách kiểm).

## Mục lục

- [1. Cách chạy](#1-cách-chạy)
- [2. Trạng thái trên Dashboard](#2-trạng-thái-trên-dashboard)
- [3. Xử lý sự cố](#3-xử-lý-sự-cố)
- [4. Việc không được làm](#4-việc-không-được-làm)
- [5. Danh sách kiểm bảo mật (P5)](#5-danh-sách-kiểm-bảo-mật-p5)
- [6. Lệnh kiểm tra nhanh](#6-lệnh-kiểm-tra-nhanh)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Cách chạy

- Container `zalo-farm` (trên máy 129 là `vclinks-129-zalo-farm-1`) chạy agent `tools/chrome-driver/farm-agent.js`. Agent chỉ nghe `127.0.0.1:9400`, cần khóa `x-farm-key`, và chỉ API VClinks gọi tới.
- Mỗi nick "Trực tiếp" là một phiên zca-js 2.2.0 bên trong agent (code: `tools/chrome-driver/farm-direct.js`). Tệp của nick nằm trong `/home/vclinks/.vclinks-fleet/farm/<mã chỗ nick>/`, thuộc volume `vclinks-129_zalo-farm`:

| Tệp | Nội dung | Ghi chú |
|---|---|---|
| `session.enc` | Phiên đăng nhập (cookie, imei, userAgent), mã hóa AES-256-GCM bằng `ZALO_FARM_SESSION_KEY` | Quyền 600. Xóa khi ngắt kết nối |
| `cursor.json` | Mã tin mới nhất đã nạp, theo loại (cá nhân, nhóm) | Chỉ có mã tin, dùng để bù tin khi kết nối lại |
| `probe.jsonl` | Dạng dữ liệu của các loại tin (tên trường, kiểu) | Không có giá trị, tối đa 5.000 dòng |
| `../slots.json` | Danh sách chỗ nick, cách kết nối, uid | Không có phiên |

- **Nhận tin:** tin, thu hồi, cảm xúc, "Đã nhận / Đã xem", sự kiện nhóm, "đang soạn tin" đi thẳng tới `/api/ingest/*` theo lô, khoảng 0,3 giây sau khi Zalo nhận. Danh bạ, nhóm, lời mời kết bạn được đọc lúc kết nối và định kỳ.
- **Gửi tin:** agent hỏi `/api/outbox/pending` (chờ tối đa 20 giây mỗi lần), chỉ nhận lệnh có `approvedBy` + `approvedAt`, gửi bằng zca-js rồi báo kết quả.
- **Khởi động lại container:** mỗi nick tự đăng nhập lại bằng `session.enc`, không cần quét QR, rồi bù các tin đến trong lúc tắt. Với Zalo, mỗi lần như vậy vẫn tính là một lần đăng nhập.
- **RAM:** khoảng 115 MB cho cả container khi có một nick trực tiếp. Một nick chạy Chrome tốn khoảng 616 MB.

## 2. Trạng thái trên Dashboard

Xem ở Kênh → mục Máy Zalo.

| Trạng thái | Nghĩa | Làm gì |
|---|---|---|
| Đã kết nối | Phiên đang nghe tin | — |
| Chờ quét mã QR | Chưa có phiên, hoặc Zalo không nhận phiên đã lưu | Người giữ nick quét QR |
| Đã quét, hãy bấm Đăng nhập trên điện thoại | Điện thoại đã quét, chưa xác nhận | Bấm Đăng nhập trên điện thoại |
| Mất phiên, kèm câu "Nick đang mở Zalo Web ở nơi khác…" | Có người mở chat.zalo.me của nick nên Zalo ngắt kết nối trực tiếp (mã 3000 hoặc 3003) | Đóng Zalo Web đó rồi bấm "Quét lại QR". Máy Zalo không tự giành lại phiên |
| Quét nhầm tài khoản Zalo khác | QR được quét bằng một nick khác với nick đã gắn | Máy Zalo tự đăng xuất nick lạ. Quét lại bằng đúng nick |
| Máy Zalo gặp lỗi | Agent không mở được phiên (thiếu khóa phiên, lỗi thư viện) | Xem log (mục 6) |

## 3. Xử lý sự cố

Các dòng log dưới đây đều bắt đầu bằng mã chỗ nick (`zs_…`). Lệnh xem log ở mục 6.

| Dấu hiệu | Dòng log | Nguyên nhân | Cách xử lý |
|---|---|---|---|
| Tin mới không về Hộp thư | `ingest messages failed (HTTP 502), retrying` | API đang tắt hoặc đang triển khai | Không cần làm gì: tin nằm trong hàng đợi của agent (tối đa 5.000 mục mỗi loại) và tự gửi khi API chạy lại. Nếu có `queue full, oldest item dropped` thì tin cũ nhất đã bị bỏ: báo dev |
| Tin không về, nick báo mất phiên | `direct session closed (duplicate_web, code 3000)` | Nick mở Zalo Web ở nơi khác | Như dòng "Mất phiên" ở mục 2 |
| Tin không về, không báo gì rõ | `direct session closed (direct_down, code …)` | Mất kết nối tới Zalo | Agent tự kết nối lại, tối đa 3 lần mỗi giờ. Nếu thấy `restart budget used up for the direct session` thì kiểm mạng máy 129, rồi bấm "Quét lại QR" |
| Nick về "Chờ quét mã QR" sau khi khởi động lại | `saved session refused by Zalo, asking for a QR` | Zalo đã hủy phiên (người giữ nick đăng xuất phiên máy tính trong app, hoặc phiên hết hạn) | Quét QR lại |
| Như trên | `saved session unreadable, asking for a QR` | Khóa `ZALO_FARM_SESSION_KEY` đã đổi, hoặc tệp `session.enc` hỏng | Quét QR lại. Kiểm xem khóa trong `~/vclinks/.env` có bị sửa không |
| Gửi lỗi, Dashboard hiện "Zalo không nhận lệnh (mã …): …" | `outbox <mã lệnh> send_text → failed` | Zalo từ chối, câu sau dấu hai chấm là lời của Zalo | Đọc câu đó: chặn người lạ, nhóm đã giải tán, tệp quá lớn… |
| Gửi lỗi "lỗi bên trong thư viện Zalo (chi tiết không hiện…)" | như trên | Lỗi của zca-js. Câu gốc có thể chứa phiên nên không hiện | Báo dev kèm mã lệnh. Dev xem log agent, không xem phiên |
| Lệnh gửi chờ lâu | (không có) | API đang giữ nhịp gửi để nick không gửi dồn | Không làm gì, lệnh tự đi khi tới lượt |
| Tin cũ hiện "Nội dung cũ, chưa lấy được trước khi chuyển sang kết nối trực tiếp" | — | Nick chuyển từ Zalo Web sang trực tiếp trước khi Zalo Web đọc được nội dung tin đó | Bình thường; zca-js không lấy lại được tin trước lúc đăng nhập |
| "Chuyển sang trực tiếp" báo lỗi | `handover refused by Zalo (…), back to Zalo Web` | Zalo không nhận phiên chuyển sang | Nick vẫn chạy qua Zalo Web, không mất gì. Thử lại sau hoặc giữ Zalo Web |
| Lời mời kết bạn không cập nhật | `received friend requests not read (…)` | Zalo trả lỗi | Tự thử lại sau 30 phút hoặc khi có sự kiện kết bạn |
| Máy Zalo chậm | — | Thiếu RAM, CPU | `docker stats` (mục 6); mức thường ở mục 1 |

## 4. Việc không được làm

- **Không sao chép hay sao lưu volume `vclinks-129_zalo-farm` ra khỏi máy 129**, không gửi tệp `session.enc` cho ai (CLAUDE.md §12.2). Ai có tệp này và khóa là đọc, gửi được tin của nick.
- **Không đổi hay xóa `ZALO_FARM_SESSION_KEY`** trong `~/vclinks/.env`, vì mọi nick trực tiếp sẽ phải quét QR lại. Chỉ đổi khi khóa bị lộ: ngắt từng nick, đổi khóa, rồi quét lại.
- **Không bật log của zca-js** (`logging: true`): log của thư viện in nguyên yêu cầu gửi Zalo.
- **Không nâng phiên bản zca-js khi chưa đọc code bản mới.** Build image tự dừng nếu code thư viện có tên miền không phải của Zalo (`tools/chrome-driver/farm/direct/check-hosts.js`).
- **Không triển khai lại máy Zalo nhiều lần trong ngày** khi đang theo dõi nick: mỗi lần là một lần đăng nhập với Zalo. Kế hoạch giới hạn 3 lần mỗi ngày.
- **Không mở chat.zalo.me của nick trực tiếp ở máy khác**, vì làm vậy sẽ đá kết nối trực tiếp ra.
- **Không gửi hàng loạt.** Nhịp gửi do API giữ.

## 5. Danh sách kiểm bảo mật (P5)

Kiểm ngày 06/10/2026, theo kế hoạch `docs/01-quan-ly-du-an/ke-hoach-zalo-truc-tiep-zca-js.md` (mục 5 và 7).

| # | Mục | Cách kiểm | Kết quả |
|---|---|---|---|
| 1 | Phiên mã hóa AES-256-GCM; sai khóa hoặc đổi một byte là không mở được | Test "session file: AES-256-GCM round trip…" | Đạt |
| 2 | Thư mục quyền 700, tệp quyền 600 | `stat` trên máy 129: `farm/` 700, thư mục nick 700; `session.enc`, `cursor.json`, `probe.jsonl`, `slots.json` 600. Test: thư mục cũ quyền rộng hơn được đóng lại về 700 | Đạt |
| 3 | Khóa phiên chỉ có trong `~/vclinks/.env` | `.env` quyền 600, không vào git (`.gitignore`) và không vào image (`.dockerignore`) | Đạt |
| 4 | Phiên không ra khỏi máy Zalo | Test P5 chạy đủ đường: đăng nhập QR, đăng nhập lại bằng phiên đã lưu, nhận tin, đang soạn, gửi lỗi. Cookie, imei, userAgent và khóa không xuất hiện trong lời gọi API (địa chỉ, header, nội dung), trong log, trong trạng thái trả về API, hay trong tệp cạnh phiên | Đạt |
| 5 | Không có dấu vết phiên trên máy 129 | Log `zalo-farm` và `api` từ lần khởi động 15:11: 0 dòng có từ của phiên. MongoDB `vclinks` (2.816 bản ghi, 52 collection): 0 bản ghi | Đạt |
| 6 | Câu lỗi của thư viện không mang phiên lên API | zca-js có câu lỗi chứa cả ngữ cảnh ("Invalid context {…}", gồm cookie và khóa). Agent đổi câu đó thành câu chung trước khi báo kết quả gửi. Có test | Đạt (chạy thật từ lần triển khai máy Zalo tới) |
| 7 | Xóa phiên khi ngắt kết nối | Ngắt trên Dashboard thì agent xóa `session.enc`, `cursor.json` và cả thư mục nick. Hộp xác nhận nhắc đăng xuất phiên máy tính trong app Zalo | Đạt |
| 8 | Khóa phiên bản thư viện | `zca-js` đúng bản 2.2.0. Lockfile có 31 gói, đều từ npm registry, có mã sha512, không gói nào có script cài. Image cài bằng `npm ci --ignore-scripts`. Test `farm-deps` | Đạt |
| 9 | Đọc code thư viện | Tên miền trong code chỉ của Zalo: `id.zalo.me`, `chat.zalo.me`, `wpa.chat.zalo.me`, `jr.chat.zalo.me`, `zalo.me`, và `developers.zalo.me` (chỉ trong chú thích). Ngoài ra có `registry.npmjs.org` để kiểm bản mới, agent đã tắt việc này. Không dùng `child_process`, `eval`, không đọc biến môi trường. Thư viện chỉ ghi tệp ảnh QR khi không có hàm nhận QR; agent có hàm này và trên máy không có `qr.png`. Log thư viện tắt. Build image chạy `check-hosts.js` | Đạt |
| 10 | Agent chỉ nghe nội bộ | `127.0.0.1:9400`, cần `x-farm-key` | Đạt |
| 11 | Không sao lưu phiên | `~/vclinks/backups` chỉ có bản sao MongoDB. Thư mục volume chỉ root đọc được. Không có lịch chạy tự động (crontab) | Đạt |
| 12 | Container chỉ ra mạng tới Zalo và API | Chưa làm: chế độ Zalo Web (Chrome) và việc tải tệp đính kèm cần mạng ngoài | Chưa (xem lại sau P6) |

## 6. Lệnh kiểm tra nhanh

Chạy trên máy 129. Các lệnh này chỉ đọc, không khởi động lại gì.

```bash
# Log 30 phút gần nhất của một nick
docker logs --since 30m vclinks-129-zalo-farm-1 2>&1 | grep zs_8c589d7135b239fa
# RAM, CPU của máy Zalo
docker stats --no-stream vclinks-129-zalo-farm-1
# Quyền tệp (thư mục 700, tệp 600)
docker exec vclinks-129-zalo-farm-1 sh -c 'cd /home/vclinks/.vclinks-fleet/farm && stat -c "%a %n" . zs_* zs_*/*'
# Số dòng log có dấu vết phiên: phải là 0
docker logs vclinks-129-zalo-farm-1 2>&1 | grep -ciE 'zpw_|cookie|imei|invalid context|z_uuid'
# Tên miền trong code thư viện (có trong image từ lần triển khai máy Zalo tới)
docker exec vclinks-129-zalo-farm-1 node /opt/vclinks/tools/chrome-driver/farm/direct/check-hosts.js
```

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 06/10/2026 15:34 | Claude Code (dev002) | Tạo sổ tay: cách chạy, trạng thái, xử lý sự cố, việc không được làm, danh sách kiểm bảo mật P5 (kiểm trên máy 129), lệnh kiểm tra nhanh | Yêu cầu dev002 06/10/2026: làm P5 phần không cần triển khai máy Zalo |
