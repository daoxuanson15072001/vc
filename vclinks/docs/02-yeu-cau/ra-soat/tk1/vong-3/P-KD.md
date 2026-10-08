# Góp ý thiết kế lượt 3 — P-KD (Minh)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Minh (P-KD) góp ý lượt 3 trên canvas bản 11; xem màn 1, 1e, 1a, 1b, 2, 3, 1c, 11 Danh bạ, lời mời kết bạn, tạo nhóm.
- Kiểm lại 12 góp ý cũ: 8 đã sửa tốt · 1 sửa chưa đủ · 3 chưa sửa; góp ý Chặn duy nhất của lượt 2 (gửi trùng khi nick đỏ) đã sửa tốt.
- Tiến bộ: "Sao chép và bỏ lệnh", hỏi "Gửi ngay / Bỏ lệnh" khi nick có lại, nút "Nhắn qua Zalo" ở Z3, công nợ 360 lên đầu trang, báo giá khớp giữa các màn.
- Làm thử 5 việc: nhắn khách OA hết khung còn 2 cú (lượt 2 cần 4–5); gửi báo giá 2 cú.
- 5 góp ý mới: **0 Chặn** · 3 Nên sửa (số nợ quá hạn ghi lệch, thiếu "+ Tạo khách mới" khi đồng ý kết bạn, lời mời kết bạn không báo ở Hộp thư) · 2 Gợi ý.
- Còn mở: bản điện thoại (chờ Q14), câu hộp gửi lần đầu còn chữ kỹ thuật, thanh công cụ không có chữ, Z2 OA bật phí chưa có lối nhắn qua Zalo.
- Các góp ý còn mở được gom vào `qa.md` (Việc cho designer).

## Mục lục

- [Kiểm lại lượt 2](#kiểm-lại-lượt-2)
- [Làm thử 5 việc](#làm-thử-5-việc)
- [Góp ý mới](#góp-ý-mới)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Người góp ý: Minh, NVKD VCparts (vai P-KD). Đọc bản vẽ "VClinks UI Design" bản 11: màn 1 Hộp thư NVKD, 1e Nick và Lệnh gửi, 1a Khung chat, 1b Ô soạn, 2 Gửi báo giá, 3 Customer 360, 1c Cửa sổ OA/Fanpage, 11 Danh bạ, lời mời kết bạn, tạo nhóm. Đối chiếu góp ý lượt 2 (`vong-2-thiet-ke/D1-P-KD.md`) và đặc tả 03. Trên bản vẽ NVKD tên "Tú", em đọc như là em.

Chỗ em lo nhất là khách nhận hai tin giống nhau, và chỗ đó đã được xử lý ổn: có nút `Sao chép và bỏ lệnh (1 lệnh chờ)` ngay ở dải đỏ, và khi nick có lại thì VClinks hỏi `Gửi ngay / Bỏ lệnh`, kèm cả tin em đã gửi từ điện thoại. Khách OA hết khung giờ có sẵn nút `Nhắn qua Zalo · Nick Tú (đã là bạn)`. Công nợ ở 360 đã lên đầu trang và khớp với panel, danh sách báo giá giữa các màn cũng đã khớp. Còn thiếu bản điện thoại, thanh công cụ vẫn chỉ có biểu tượng, và ở màn Danh bạ em chưa thấy chỗ tạo hồ sơ cho khách hoàn toàn mới.

## Kiểm lại lượt 2

| # lượt 2 | Tóm tắt | Kết quả | Ghi chú |
|---|---|---|---|
| 1 | **(Chặn)** Nick đỏ: lệnh chờ tự gửi, khách nhận 2 tin trùng | Đã sửa tốt | Màn 1e: ô soạn có `Sao chép nội dung` và `Sao chép và bỏ lệnh (1 lệnh chờ)`. Bong bóng chờ có `Bỏ lệnh · Sao chép và bỏ lệnh`. Nick có lại khi lệnh đã chờ quá 2 phút thì hỏi `Nick Tú đã kết nối lại. Còn 1 tin chờ gửi… Có thể trùng với tin bạn đã gửi từ điện thoại lúc 09:40…` với 2 nút `Gửi ngay / Bỏ lệnh`. Không ai trả lời trong 30 phút thì lệnh thành `Quá hạn — chưa gửi`, không tự gửi. Chỉ còn điểm nhỏ, xem góp ý mới #4 |
| 2 | OA hết khung: thiếu lối tắt "Nhắn qua Zalo"; chip `Hết khung` xám | Sửa chưa đủ | Z3 và Z2 (OA tắt có phí) đã có `Nhắn qua Zalo · Nick Tú (đã là bạn)`: tốt. Còn thiếu 3 chỗ. (1) Z2 khi OA bật có phí chỉ có `Gửi (có phí)`, không có lối Zalo miễn phí. (2) Chưa vẽ trường hợp khách chưa là bạn (`Gửi lời mời kết bạn…`). (3) Chip `Hết khung` trên danh sách vẫn xám, bản vẽ ghi là theo quy ước 00 |
| 3 | Công nợ 360 lệch panel, nằm trong khối mờ GĐ2 | Đã sửa tốt | Đầu trang 360: `Công nợ 42,3 tr ₫ · Quá hạn 5 ngày · VCsales lúc 09:30`. Khối Công nợ ghi rõ `2 khoản · Quá hạn 5 ngày (18,2 tr ₫)` và có ghi chú thu nợ |
| 4 | Lỗi danh thiếp: `Thử lại` chắc chắn hỏng | Đã sửa tốt | Lệnh gửi và khung chat có `Chọn lại danh thiếp`, bỏ `Thử lại` ở lỗi này. Lỗi trích dẫn có `Gửi không trích dẫn` |
| 5 | Lọc khách nợ quá hạn | Đã sửa tốt | Hàng chip lọc có `Thêm lọc: Nợ quá hạn…` |
| 6 | Báo giá lệch giữa các màn | Đã sửa tốt | Hộp thoại, 360 và tab Báo giá cùng một bộ. 360 ghi rõ `BG-0915 Chưa gửi`, `BG-0912 Đã gửi 1 lần · 09:26`, nháp và báo giá hết hạn không tính là đang mở |
| 7 | Nút `Gửi từ [kênh]` sát ô soạn, 1 cú là đổi kênh | Đã sửa tốt | Giờ là chữ `Gửi từ Zalo · Nick Tú`. Muốn đổi kênh phải vào `⋯ → Nhắn qua kênh khác`, viền ô soạn đổi theo màu kênh |
| 8 | `Đang được … trả lời`, `Khách của …` chữ 11 px | Đã sửa tốt | Đã lên 12 px. `Đang được Lê Thu Hương trả lời` là chip vàng có chấm |
| 9 | Bản điện thoại | Chưa sửa | Chú thích bản vẽ vẫn ghi "Chưa vẽ: bản điện thoại (chờ Q14)". Em chưa thấy cả màn 390 px "Lệnh gửi của tôi" |
| L1-13 | Hộp xác nhận lần gửi đầu dùng chữ kỹ thuật | Chưa sửa | Vẫn ghi `qua tiện ích VClinks trên tab Zalo Web đang mở` |
| L1-17 | 360 nhiều khối GĐ2 | Đã sửa tốt | Đã gom về một dòng `Sắp có (GĐ2): Hóa đơn VCinvoice · Thị trường VCdms · Tóm tắt AI` |
| L1-20 | Thanh công cụ không có chữ | Chưa sửa | Vẫn chỉ có biểu tượng, tên nút nằm trong tooltip và aria-label |

**Tổng:** 8 đã sửa tốt · 1 sửa chưa đủ · 3 chưa sửa. Góp ý **Chặn** duy nhất của lượt 2 (#1) đã sửa tốt.

## Làm thử 5 việc

Cú bấm tính từ lúc đang ở màn Hộp thư. Gõ phím không tính.

| Việc | Màn | Số cú bấm | Vướng |
|---|---|---|---|
| (a) Nick đỏ đúng lúc vừa bấm Gửi, sau đó nick có lại | 1e | Nhận ra: 0 (dải đỏ, chip, tin ghi `Đang chờ gửi (chờ nick kết nối)`). Xử lý: 1 (`Sao chép và bỏ lệnh`), dán vào Zalo điện thoại. Nick có lại mà còn lệnh: thêm 1 (`Gửi ngay` hoặc `Bỏ lệnh`). Lượt 2 cần 3 cú và có nguy cơ gửi trùng | Không còn đường gửi trùng nếu lệnh đã chờ quá 2 phút. Nếu nick có lại trước 2 phút thì bản vẽ chưa nói có hỏi hay không (góp ý mới #4) |
| (b) Khách OA hết khung, em nhắn qua Zalo | 1c → 1 | 2 + Enter (bấm hội thoại OA → `Nhắn qua Zalo · Nick Tú` → gõ → Enter), thêm 1 nếu là lần gửi đầu. Lượt 2 cần 4–5 cú | Z3 nhanh rồi. Z2 khi OA bật có phí thì không có nút này, em lại phải vào `⋯` hoặc gửi tin mất phí |
| (c) Đồng ý lời mời kết bạn của khách mới và gắn hồ sơ | 11 | 4 (menu Danh bạ → tab `Lời mời kết bạn` → `Đồng ý…` → `Đồng ý`) nếu VClinks đoán đúng hồ sơ (`Có thể là: Garage Minh Phát`). Nếu phải chọn hồ sơ khác thì +2 | Khách hoàn toàn mới (chưa có hồ sơ nào) thì ô `Gắn vào hồ sơ` không có lựa chọn `+ Tạo khách mới`. Lời mời có câu hỏi giá nhưng đã chờ 2 giờ, và ở Hộp thư không có dấu gì báo cho em (góp ý mới #2, #3) |
| (d) Tạo nhóm Zalo với garage | 1 → 11 | Khoảng 8 (nút `Tạo nhóm` cạnh ô tìm → gõ tên → chọn A Tuấn → chọn gợi ý Lê Thu Hương → Mục đích 2 cú → Gắn khách 2 cú → `Tạo nhóm`) | Chặn thêm người chưa là bạn (`Kỹ thuật Tuấn chưa là bạn của Nick Tú: không thêm được`) và có câu duyệt: tốt. Nhưng em đang ở chat với khách thì phải ra Hộp thư mới tạo nhóm được, rồi chọn lại khách và gắn khách từ đầu (góp ý mới #5) |
| (e) Gửi báo giá | 1 → 2 | 2 (`Gửi báo giá` → `Gửi báo giá`) | Không vướng. Chọn sẵn BG-0915 vì chưa gửi, và thấy BG-0912 đã gửi 1 lần. Riêng dải công nợ trong hộp thoại ghi `Quá hạn 5 ngày · 18,2 tr ₫`, trong khi tiêu đề chat ghi `Quá hạn 5 ngày · 42,3 tr ₫` (góp ý mới #1) |

## Góp ý mới

| # | Màn | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | 1 (tiêu đề chat, panel), 2 | Số nợ quá hạn ghi khác nhau: tiêu đề chat `Quá hạn 5 ngày · 42,3 tr ₫`, hộp báo giá `Quá hạn 5 ngày · 18,2 tr ₫`. 360 mới cho biết 42,3 là tổng nợ, 18,2 là phần quá hạn | Nhìn tiêu đề chat em sẽ hiểu là khách quá hạn 42,3 triệu, rồi nhắc khách sai số. Nói sai số nợ với khách là mất uy tín | Ở mọi chỗ ghi một mẫu thống nhất: `Nợ 42,3 tr · quá hạn 18,2 tr (5 ngày)`. Chip ngắn trên tiêu đề thì chỉ ghi phần quá hạn | **Nên sửa** |
| 2 | 11 (Đồng ý kết bạn) | Ô `Gắn vào hồ sơ` chỉ chọn được hồ sơ có sẵn, không có `+ Tạo khách mới` | Khách mới kết bạn thường là khách mới thật. Nếu không tạo được hồ sơ ngay lúc đồng ý, em sẽ bỏ qua bước gắn và khách thành "chưa gắn hồ sơ" mãi | Thêm dòng cuối trong danh sách: `+ Tạo khách mới (tên, SĐT lấy từ lời mời)`. Để trống thì hiện câu `Chưa gắn hồ sơ, gắn sau ở Danh bạ` | **Nên sửa** |
| 3 | 1 Hộp thư, 11 | Lời mời kết bạn có câu hỏi giá (`cần báo giá má phanh`) đã chờ 2 giờ nhưng chỉ hiện trong Danh bạ → Lời mời. Hộp thư không có dấu gì báo | Em sống ở Hộp thư cả ngày, gần như không mở Danh bạ. Khách hỏi giá mà 2 giờ sau mới trả lời thì coi như mất khách | Có lời nhắn kèm lời mời thì hiện một dòng trong Hộp thư, có nhãn `Lời mời kết bạn` và nút `Đồng ý…`. Hoặc tối thiểu có số đếm trên menu Danh bạ và trong chuông thông báo | **Nên sửa** |
| 4 | 1e (nick kết nối lại) | Hộp hỏi `Gửi ngay / Bỏ lệnh` chỉ hiện khi lệnh đã chờ quá 2 phút | Nếu nick có lại sau 1 phút mà em đã kịp gửi từ điện thoại thì lệnh vẫn tự đi và khách nhận 2 tin | Khi VClinks thấy nick đã gửi tin từ điện thoại vào đúng hội thoại đó sau lúc tạo lệnh thì luôn hỏi, không tính 2 phút | **Gợi ý** |
| 5 | 1a, 3, 11 (Tạo nhóm) | Chỉ tạo nhóm được từ nút `Tạo nhóm` ở Hộp thư, rồi phải chọn lại khách và gắn khách từ đầu | Em hay tạo nhóm ngay lúc đang chat với chủ gara để kéo thêm thợ trưởng và kế toán vào | Thêm `Tạo nhóm với khách này` trong `⋯` của khung chat và ở 360. Mở ra thì điền sẵn khách, người liên hệ đã là bạn, ô Gắn khách và tên nhóm gợi ý. Tạo xong thì mở luôn nhóm mới | **Gợi ý** |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-3/P-KD.md) | — |
