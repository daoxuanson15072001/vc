# Góp ý thiết kế lượt 3 — P-CS (Lan)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Lan (P-CS) góp ý lượt 3 ngày 29/09/2026 trên canvas bản 11; xem màn 1f, 1h, 1c, 1g, 3 (thêm 0b, 5, 9); đối chiếu 04 và 02 (DK-48, DK-49, DK-50).
- Kiểm lại 16 góp ý cũ: 12 đã sửa tốt · 4 sửa chưa đủ (L1-6, L1-15, L1-17, #3) · 0 chưa sửa; cả 3 Chặn (cam kết, danh tính, số cửa sổ OA) đã sửa tốt.
- Đã có khối "Cam kết đã nêu", banner "Danh tính chưa xác nhận" có đối chiếu mã đơn + SĐT, số giờ cửa sổ OA khớp giữa các màn.
- Làm thử 5 việc: cả 5 việc làm trọn (2–5 cú).
- 6 góp ý mới: **0 Chặn** · 1 Nên sửa (nút "Nhắn qua Zalo · Nick Tú" ở 1c không ghi vai nào thấy) · 5 Gợi ý.
- Còn mở: Ticket của tôi cho CSKH, bảng SLA ticket, nháp nhắn riêng ở 0b còn nêu giá, trạng thái tạm giữ quá hạn, dữ liệu mẫu TK-0142 lệch giữa 1f và 1g.
- Các góp ý còn mở được gom vào `qa.md` (Việc cho designer).

## Mục lục

- [Kiểm lại lượt 2](#kiểm-lại-lượt-2)
- [Làm thử 5 việc](#làm-thử-5-việc)
- [Góp ý mới](#góp-ý-mới)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Người góp ý: Lan, CSKH trực Zalo OA và Fanpage (vai P-CS). Ngày 29/09/2026.
> Bản vẽ: artifact "VClinks UI Design" bản 11. Màn đã xem: 1f Hộp thư CSKH, 1h Danh tính chưa xác nhận và cam kết đã nêu, 1c Cửa sổ gửi OA / Fanpage, 1g Ticket, 3 Customer 360. Để kiểm góp ý cũ, tôi xem thêm 0b Bình luận Fanpage, 5 Việc cần làm và 9 Quản trị.
> Đối chiếu: `04-cskh-zalo-oa.md`, `02-khach-da-kenh.md` (DK-48, DK-49, DK-50).

Lượt này tôi đã dám làm việc thật. Mở hội thoại là thấy ngay khối "Cam kết đã nêu" nên biết sale đã hứa gì. Khách lạ hỏi đơn thì có banner vàng chặn lại, có nút đối chiếu mã đơn + SĐT, và có bước kiểm tra chặn luôn tin có số công nợ. Số giờ còn lại của cửa sổ OA giờ đã khớp giữa đầu khung chat, panel và 360. Còn vài chỗ nhỏ: ở 1c tôi vẫn thấy nút nhắn qua nick cá nhân của sale, chưa vẽ lúc owner quá hạn thì tôi được gửi câu giữ khách, và dữ liệu mẫu của ticket giữa 1f và 1g lệch nhau.

## Kiểm lại lượt 2

| # cũ | Góp ý lượt 2 (tóm tắt) | Mức cũ | Kết quả | Ghi chú |
|---|---|---|---|---|
| L1-1 | Số cửa sổ OA lệch giữa các màn (1f: 5 giờ 40 / panel ~47 giờ / 360: 19 giờ) | Chặn | **Đã sửa tốt** | 1f đầu khung ghi `Còn 5 giờ 40 phút`. Panel "Khung gửi" ghi tương tác cuối 16:20 27/09, miễn phí tới 16:20 29/09, khớp với 5 giờ 40. 360 ghi `⏱ Còn 5g40 miễn phí`. Các biến thể ở 1c dùng số khác vì là trạng thái minh họa, tôi chấp nhận được. |
| L1-6 | Thiếu "Ticket của tôi" cho CSKH, kèm SLA xử lý | Nên sửa | **Sửa chưa đủ** | Mã ticket ở màn 5 đã đổi sang `TK-`. Màn vẫn ghi "chưa rà", vẫn vẽ theo góc nhìn sale (TU), và vẫn chưa có danh sách ticket của CSKH. |
| L1-8 | Thiếu lỗi "Zalo báo hết khung" và lỗi "quá dài" | Nên sửa | **Đã sửa tốt** | 1c có `Zalo báo hết khung… (Zalo báo -230)` kèm `Gửi bằng tin mẫu (ZNS)`, có biến thể "Khung gửi vừa hết lúc 10:02. Chữ đang gõ được giữ làm nháp". 1f có lỗi tin dài 2.140 ký tự với nút `Sửa tin`. |
| L1-14 | 360 thiếu "sale đã hứa gì" | Nên sửa | **Đã sửa tốt** | 360 có khối "Cam kết đã nêu (7 ngày)" với 4 dòng và dòng "Chưa trả lời". |
| L1-15 | 0b: kiểm trùng hồ sơ, hạn nhắn riêng, chuyển sale, tạo ticket, không báo giá | Nên sửa | **Sửa chưa đủ** | Đã có "khớp hồ sơ: Garage Minh Khoa (SĐT trùng) · Tạo hồ sơ mới", "Nhắn riêng được đến 06/10 09:05", `Chuyển sale`, `Tạo ticket`. Còn thiếu: nháp nhắn riêng vẫn là "combo bảo dưỡng … bên em là…", tức vẫn gợi ý tôi nêu giá cho lead (OA-11, DK-31). |
| L1-17 | Quản trị: bảng SLA ticket theo loại × ưu tiên | Nên sửa | **Sửa chưa đủ** | Không đổi so với lượt 2, vẫn chỉ có dòng trỏ `/settings/sla · MH-OA-18`. |
| 1 | Chưa có khối **"Cam kết đã nêu"** | **Chặn** | **Đã sửa tốt** | Khối có ở 1f (đặt trên khối Ticket), 1h và 360. Mỗi dòng có loại, mặt hàng, giá trị, chip kênh, người, giờ và nhãn "điện thoại", ví dụ `Cam kết đổi–trả · Đổi mới má phanh nếu kêu, miễn phí · Zalo Nam · 26/09 14:20 · điện thoại`. Có ghi chú "Chỉ dòng chuẩn hóa; toàn văn chờ chốt CH-DK-1", nên tôi biết giới hạn của khối này. |
| 2 | Chưa có banner **"Danh tính chưa xác nhận"** | **Chặn** | **Đã sửa tốt** | Màn 1h riêng có đủ: banner vàng "Không nói công nợ, đơn hàng, giá riêng cho tới khi xác nhận"; nút `Đối chiếu mã đơn + SĐT` và `Nhờ owner xác nhận`; ghi chú vì sao nút OA bị ẩn. Khi khớp VCsales thì ghi "Đã xác nhận trong phạm vi đơn DH-TEST-221". Không khớp 2 lần thì khóa 24 giờ. Khối thương mại thu gọn, công nợ ẩn. Bước kiểm tra trước khi gửi chặn tin có "12.000.000 ₫", không có "Vẫn gửi", có `Dùng mẫu chuyển owner`. Còn một chi tiết nhỏ (góp ý mới #3). |
| 3 | Chưa có hạn trả lời của owner và trạng thái tạm giữ | Nên sửa | **Sửa chưa đủ** | Dòng Gara Hải Đăng trên 1f đã có `tạm giữ (DK-24)`, `Owner trả lời trong: 18′` và câu "Quá hạn thì bạn được gửi câu giữ khách (không nêu giá)". Chưa vẽ trạng thái quá hạn (`Owner chưa trả lời 30′`), cũng chưa vẽ ô soạn ở chế độ "Câu giữ khách". Biến thể "khách của sale" ở 1c chưa có chip hạn của owner. |
| 4 | 360 chưa có góc nhìn CSKH | Nên sửa | **Đã sửa tốt** | Có chú thích "Góc nhìn CSKH: ẩn doanh số, hạng, giá chính sách; công nợ chỉ 'Có công nợ quá hạn: Có'; SĐT ẩn, bấm Hiện (60 giây, ghi nhật ký)". Đúng với phương án chú thích tôi đã đề xuất. |
| 5 | Chưa vẽ hàng Chưa nhận | Nên sửa | **Đã sửa tốt** | Tab `Chưa phân công 5` có ô chọn, `chờ 14 phút`, và `Nhận` / `Chuyển cho sale` đưa ra ngoài dòng. Chưa có toast báo trùng khi người khác vừa nhận trước (ghi ở việc (d)). |
| 6 | Z2 "OA tắt có phí" ghi hai câu ngược nhau | Nên sửa | **Đã sửa tốt** | Nay ghi `Đã hết 48 giờ miễn phí. OA không gửi tin có phí.` |
| 7 | Chưa có "Tạo ticket từ tin này" | Gợi ý | **Đã sửa tốt** | Menu của tin trên 1f có `Tạo ticket từ tin này`, `Gắn vào ticket đang mở`, `Sao chép`. |
| 8 | Mã ticket ba kiểu | Gợi ý | **Đã sửa tốt** | Mọi màn dùng `TK-xxxx`. Chỉ còn khác ở chỗ có hoặc không có dấu `#`, không ảnh hưởng việc tìm. |
| 9 | 1g ghi ticket tạo theo quy tắc từ khóa (GĐ2) | Gợi ý | **Đã sửa tốt** | Nay ghi `Tạo từ nút chatbot "Bảo hành"`. |
| 10 | Nút `Gửi báo giá` sáng với khách có owner | Gợi ý | **Đã sửa tốt** trên 1f | Ô soạn 1f thay bằng `Báo sale báo giá`. Các biến thể Z1 ở 1c vẫn còn `Gửi báo giá` (góp ý mới #5). |

**Tổng:** 16 góp ý cũ, gồm 6 góp ý lượt 1 còn treo và 10 góp ý mới của lượt 2. **Đã sửa tốt 12** · **Sửa chưa đủ 4** (L1-6, L1-15, L1-17, #3) · **Chưa sửa 0**. Cả 3 góp ý Chặn (cam kết, danh tính, số cửa sổ OA) đều đã sửa tốt.

## Làm thử 5 việc

| Việc | Các bước (màn) | Số cú bấm | Lượt 2 | Vướng ở đâu |
|---|---|---|---|---|
| (a) Khách chưa xác nhận hỏi tình trạng đơn | 1h: mở hội thoại (1), thấy banner vàng → gõ câu xin mã đơn + SĐT, `Gửi` (1) → khách gửi `DH-TEST-221, 0900 000 301` → `Đối chiếu mã đơn + SĐT` (1) → nhập, `Đối chiếu` (1) → "Khớp VCsales", khối thương mại hiện "Đang giao · GHN · dự kiến 30/09" → gõ trả lời, `Gửi` (1) | 5 | Không làm được (chưa có banner) | Làm trọn và an toàn: gõ nhầm số công nợ là bị chặn. Có hai vướng nhỏ. Thứ nhất, tôi phải tự gõ câu xin mã đơn, chưa có mẫu câu sẵn. Thứ hai, sau khi khớp thì đầu khung vẫn ghi "Danh tính chưa xác nhận", nên tôi không chắc mình đã được nói tới đâu (góp ý mới #3). Trên danh sách 1f cũng chưa có dấu hiệu cho biết dòng nào chưa xác nhận (góp ý mới #2). |
| (b) Khách của sale khiếu nại, cần biết sale đã hứa gì | 1f: bấm dòng có "Phụ trách sale: Nam" (1) → đọc khối "Cam kết đã nêu" ở panel, không cần bấm: "Đổi mới má phanh nếu kêu, miễn phí · Zalo Nam · 26/09 · điện thoại" → `Tạo ticket để trả lời` (1) → chọn Khiếu nại (1) → `Tạo ticket` (1) → gõ trả lời đúng lời sale đã hứa, `Gửi` (1) | 5 | 5, nhưng không biết sale hứa gì | Đây là điều tôi mong nhất và nay đã có. Vì chỉ có dòng chuẩn hóa, tôi không thấy nguyên văn, nhưng nhiêu đó đủ để không nói ngược sale. |
| (c) Khách OA ở vùng có phí | 1c: mở (1) → dải Z2 "Tin tư vấn sẽ tính phí — còn 4 ngày 3 giờ" → gõ, `Gửi (có phí)` (1) → hộp xác nhận `Gửi (có phí)` (1). Nếu OA tắt có phí: `Tin mẫu (ZNS)` (1) → chọn mẫu (1, chưa vẽ) → gửi (1) | 3 / khoảng 4 | 3 | Luồng rõ. Nhưng ở biến thể OA tắt có phí và Z3 có nút `Nhắn qua Zalo · Nick Tú (đã là bạn)`. Nếu tôi (CSKH) cũng thấy nút này thì đây là đường nhắn qua nick cá nhân của sale mà lượt 1 đã bỏ (góp ý mới #1). Hộp chọn mẫu ZNS vẫn chưa vẽ vì còn chờ CH-3. |
| (d) Nhận khách mới ở "Chưa phân công" | 1f: tab `Chưa phân công 5` (1) → dòng Anh Quân "Bán hàng · chưa có owner · chờ 14 phút" → `Chuyển cho sale` (1), xong. Với dòng Hậu mãi: `Nhận` (1) → mở (1) → trả lời, `Gửi` (1) | 2 (bán hàng) / 4 (hậu mãi) | Khoảng 4, phải đoán | Làm được. Khách hỏi giá thì chuyển sale chỉ mất 1 cú bấm. Chưa vẽ toast khi người khác nhận trước ("#TK-… vừa được Minh nhận") và chưa vẽ cảnh sau khi nhận thì dòng chuyển sang "Của tôi". |
| (e) Mở ticket bảo hành | 1f: `⋯` trên tin "Má phanh mới lắp bị kêu" (1) → `Tạo ticket từ tin này` (1) → modal 1g có sẵn tin gốc và cảnh báo "đang có #TK-0138, gắn vào" → chọn Bảo hành (1) → `Tạo ticket` (1). Nếu dùng nút `+ Tạo ticket` ở đầu khung thì 3 cú | 4 (chọn đúng tin) / 3 | 3 | Làm trọn và gắn đúng tin gốc. Vướng: dữ liệu mẫu giữa 1f và 1g lệch nhau. 1g ghi tin gốc lúc 10:02 29/09, trong khi 1f ghi 16:20 27/09. Panel 1f ghi ticket "Mới · SLA phản hồi còn 25′", còn drawer 1g ghi "Đang xử lý · SLA phản hồi ✔ 3′" (góp ý mới #4). |

## Góp ý mới

| # | Màn | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | 1c (Z2 OA tắt có phí, Z3) | Có nút `Nhắn qua Zalo · Nick Tú (đã là bạn)`, nhưng không ghi vai nào thấy nút này. | Lượt 1 đã bỏ nút "Nhắn qua Nick Linh" cho CSKH. Nếu nút quay lại trên màn tôi dùng, tôi sẽ tưởng mình được nhắn khách qua nick cá nhân của sale. | Ghi rõ nút chỉ hiện cho sale chủ nick. Với CSKH thì thay bằng `Báo sale phụ trách`, như biến thể "khách của sale". | Nên sửa |
| 2 | 1f danh sách | Dòng khách chưa xác nhận danh tính (ví dụ "0900 *** 431 · Đơn giao thiếu hàng") không có chip nào. | Đầu ca tôi lọc nhanh các dòng hỏi đơn. Nếu biết trước dòng nào chưa xác nhận thì tôi mở ra với câu xin mã đơn sẵn sàng. | Thêm chip xám `Chưa xác nhận` trên dòng, và thêm mẫu câu `/xin-ma-don` trong Mẫu câu. | Gợi ý |
| 3 | 1h | Sau khi đối chiếu khớp, đầu khung vẫn ghi `Danh tính chưa xác nhận` và banner vàng vẫn còn. | Tôi không biết mình đã được nói trong phạm vi nào. | Sau khi khớp, đổi chip thành `Đã xác nhận · phạm vi đơn DH-TEST-221` và thu banner lại thành một dòng. | Gợi ý |
| 4 | 1f, 1g | Dữ liệu mẫu của #TK-0142 lệch nhau: giờ tin gốc (10:02 29/09 và 16:20 27/09), trạng thái (Mới và Đang xử lý), SLA phản hồi (còn 25′ và ✔ 3′). | Người code sẽ không biết panel lấy trạng thái nào, và UAT sẽ vấp ở chỗ này. | Thống nhất một bộ dữ liệu: panel 1f ghi `Đang xử lý · SLA phản hồi ✔`. | Gợi ý |
| 5 | 1c (Z1, Fanpage) | Các biến thể của Anh Tuấn (khách của Nam) vẫn có nút `Gửi báo giá`. 1f đã đổi thành `Báo sale báo giá`. | Hai màn khác nhau nên người code sẽ phân vân. | Ở 1c dùng đúng thanh công cụ của 1f, hoặc ghi rõ các biến thể này là góc nhìn sale. | Gợi ý |
| 6 | 1f, chú giải | Chip "Có phí" (vàng đặc `#f5b301`) trùng màu với chip "SLA sắp quá". Lượt 2 chip này dùng màu mâm xôi. | Hai chip này đứng cạnh nhau trên cùng một dòng. May là có chữ "Hạn trả lời" / "Nhắn" đứng trước, nên chưa đến mức nhầm. | Cho chip "Có phí" một màu riêng, hoặc thêm biểu tượng ₫. | Gợi ý |

**Tổng góp ý mới:** 6. **Chặn** 0 · **Nên sửa** 1 (#1) · **Gợi ý** 5 (#2–#6).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-3/P-CS.md) | — |
