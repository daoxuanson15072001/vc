# Góp ý thiết kế lượt 2 — P-CS (Lan)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Lan (P-CS) góp ý lượt 2 ngày 29/09/2026 trên canvas bản 8; xem màn 1f, 1c, 1g, 3, 0b (thêm 5, 9); đối chiếu 04 v1.1, 02 v1.1, 00 v1.1.
- Kiểm lại 19 góp ý lượt 1: 13 đã sửa tốt · 5 sửa chưa đủ (#1, #6, #8, #14, #17) · 1 chưa sửa (#15). Cả 6 Chặn cũ đã sửa, riêng #1 còn lệch số giờ ở 1f và 360.
- Thay đổi lớn: có Hộp thư CSKH riêng, cửa sổ OA vẽ đúng 6 vùng §3.2, có modal tạo ticket và drawer ticket.
- Làm thử 6 việc: các việc ticket nay làm trọn (3–6 cú); bình luận Fanpage còn 6 cú nhưng các vướng cũ vẫn còn.
- 10 góp ý mới: **2 Chặn** (khối "Cam kết đã nêu", trạng thái "Danh tính chưa xác nhận") · 4 Nên sửa · 4 Gợi ý.
- Còn mở: Ticket của tôi cho CSKH, lỗi "Zalo báo hết khung", bảng SLA ticket, hàng Chưa nhận, trạng thái tạm giữ.
- Kết quả xử lý xem `vong-3/P-CS.md`.

## Mục lục

- [Kiểm lại góp ý lượt 1](#kiểm-lại-góp-ý-lượt-1)
- [Làm thử 6 việc](#làm-thử-6-việc)
- [Góp ý mới](#góp-ý-mới)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Người góp ý: Lan, CSKH trực Zalo OA và Fanpage (vai P-CS). Ngày 29/09/2026.
> Bản vẽ: artifact "VClinks UI Design" bản 8. Màn đã xem: 1f Hộp thư CSKH + khung chat OA, 1c Cửa sổ gửi OA Z0–Z3 và Fanpage, 1g Ticket, 3 Customer 360, 0b Bình luận Fanpage (xem thêm 5 Việc cần làm, 9 Quản trị để kiểm góp ý cũ).
> Đối chiếu: `04-cskh-zalo-oa.md` v1.1, `02-khach-da-kenh.md` v1.1 (DK-48, DK-49, DK-50), `00-giao-dien-chung.md` v1.1.

Lượt này thay đổi lớn: có hẳn Hộp thư CSKH riêng, cửa sổ gửi OA vẽ đúng 6 vùng theo §3.2, và có modal tạo ticket, drawer ticket. Từ nay tôi tạo ticket, trả lời khách của sale và xử lý hết khung mà không phải rời khung chat. Còn hai chỗ tôi chưa dám làm việc thật: không thấy **sale đã hứa gì với khách** (khối "Cam kết đã nêu" chưa có ở đâu) và không có đường **xác nhận danh tính** khi khách lạ hỏi đơn, nên tôi dễ nói ngược sale hoặc lộ thông tin đơn cho nhầm người.

## Kiểm lại góp ý lượt 1

| # cũ | Góp ý lượt 1 (tóm tắt) | Mức cũ | Kết quả | Ghi chú |
|---|---|---|---|---|
| 1 | Cửa sổ gửi OA tính sai (khung ~3 giờ, ba màn ba con số) | Chặn | **Sửa chưa đủ** | 1c đã đúng: 0–48h miễn phí, 48h–7 ngày có phí, quá 7 ngày ZNS, câu chữ đúng §3.2. Nhưng ở 1f vẫn lệch số: đầu khung ghi `Còn 5 giờ 40 phút để trả lời miễn phí`, còn panel "Khung gửi" ghi tương tác cuối 10:02 29/09, miễn phí tới 10:02 01/10, tức là còn ~47 giờ. Customer 360 vẫn ghi `Cửa sổ OA còn mở · 19 giờ`. Hai con số khác nhau thì tôi không biết tin con số nào. |
| 2 | Thiếu vùng Z2 có phí, khóa sai ô soạn khi khách im 3 ngày | Chặn | **Đã sửa tốt** | Có Z2, nút `Gửi (có phí)`, hộp xác nhận 3 nút, biến thể OA tắt có phí. Còn một lỗi câu chữ ở biến thể OA tắt (góp ý mới #6). |
| 3 | Màu và ngưỡng: vàng dưới 1 giờ | Nên sửa | **Đã sửa tốt** | Cam ≤ 6h, đỏ ≤ 30′, mâm xôi cho có phí, xám cho hết khung. Có nút nhanh "Sắp hết khung miễn phí". Tôi thấy hợp lý khi màu có phí đổi từ tím sang mâm xôi vì tím đã là màu của FB cá nhân. |
| 4 | Chưa có Hộp thư CSKH (hàng, bộ lọc, mã ticket trên dòng) | Chặn | **Đã sửa tốt** | Có hàng Của tôi / Chưa nhận / Chờ khách (không có "Tất cả" vì tôi không phải giám sát, đúng đặc tả), bộ lọc Loại / SLA / Khung gửi / Tag, mỗi dòng có mã ticket và hai chip "Hạn trả lời" và "Nhắn miễn phí" tách riêng. Hàng Chưa nhận chưa được vẽ (góp ý mới #5). |
| 5 | Không tạo được ticket trong khung chat | Chặn | **Đã sửa tốt** | Có nút `+ Tạo ticket` ở đầu khung và ở panel, có modal MH-OA-05 điền sẵn tin gốc, có cảnh báo "Khách đang có ticket #TK-0138, gắn vào", có drawer MH-OA-06. Chưa vẽ mục "Tạo ticket từ tin này" trên menu của từng tin (góp ý mới #7). |
| 6 | Thiếu màn "Ticket của tôi" | Nên sửa | **Sửa chưa đủ** | Màn 5 đã có tab Ticket và thẻ ticket (bắt nhập kết quả khi đóng), nhưng màn vẫn ghi "chưa rà", đang vẽ theo góc nhìn sale (TU), mã ticket vẫn là `T-1042`. Chưa có danh sách ticket của CSKH kèm cột SLA xử lý. |
| 7 | Thiếu trạng thái token OA hết hạn | Chặn | **Đã sửa tốt** | Có banner vàng ở hộp thư, có vùng chặn trên khung chat, có nút `Báo lại admin`, câu chữ đúng đặc tả. |
| 8 | Thiếu trạng thái gửi lỗi | Nên sửa | **Sửa chưa đủ** | Mới có một bong bóng lỗi (gọi quá nhanh, `Gửi lại`). Chưa có lỗi "Zalo báo hết khung" kèm nút `Gửi bằng tin mẫu (ZNS)`, chưa có lỗi "quá dài". Lỗi hết khung là lỗi tôi hay gặp nhất. |
| 9 | Thiếu vùng Z0 khách bỏ quan tâm | Nên sửa | **Đã sửa tốt** | Có vùng Z0, tag, gọi khách, ghi chú nội bộ vẫn dùng được. |
| 10 | Hết khung thì bế tắc, nút "Nhắn qua Nick Linh" | Nên sửa | **Đã sửa tốt** | Nút "Nhắn qua Nick Linh" đã bỏ. Z3 có `Gửi tin mẫu (ZNS)` và `Gọi khách: 0900 *** 678 Hiện`. Khách của sale có `Báo sale phụ trách`. ZNS vẫn chờ CH-3. |
| 11 | Thanh công cụ OA: nút xám, thiếu Tin nút / Ghi chú / ZNS / bộ đếm | Nên sửa | **Đã sửa tốt** | Nút không hỗ trợ đã ẩn, có đủ Tin nút, Yêu cầu chia sẻ thông tin, Tin mẫu (ZNS), Ghi chú nội bộ ở cuối, bộ đếm `0/2000`. |
| 12 | Không biết mình được trả lời hay chỉ xem | Chặn | **Đã sửa tốt** | Có biến thể `Bạn chỉ xem hội thoại này. Khách của Nam (sale). Bạn được ghi chú nội bộ.` kèm `Tạo ticket để trả lời` và `Báo sale phụ trách`. Có thêm dòng cảnh báo "Nam vừa nhắn khách này qua Zalo cá nhân 10′ trước". |
| 13 | Dòng hội thoại không ghi sale phụ trách | Nên sửa | **Đã sửa tốt** | Có "Phụ trách sale: Nam" trên dòng và ở panel. |
| 14 | 360 thiếu Ticket đang mở, thiếu "sale đã hứa gì", mã `T-` | Nên sửa | **Sửa chưa đủ** | Đã có khối "Ticket đang mở", mã đã đổi sang `TK-1042`. Vẫn chưa có chỗ nào cho thấy sale đã hứa gì. Đặc tả v1.1 đã có khối "Cam kết đã nêu" nhưng bản vẽ chưa vẽ (góp ý mới #1). |
| 15 | 0b: lưu hồ sơ không kiểm trùng, "Nhận xử lý" không rõ ai, không có hạn nhắn riêng, không tạo ticket | Nên sửa | **Chưa sửa** | Vẫn ghi `lưu vào hồ sơ mới`, `trong thời hạn Meta cho phép`, chỉ có một nút `Nhận xử lý`, không có `Chuyển sale` hay `Tạo ticket`, không có lọc "Chưa trả lời". Thêm một điểm: nháp nhắn riêng đang báo giá combo ("combo bảo dưỡng … bên em là…"), trong khi CSKH không được nêu giá với lead hỏi giá (OA-11, DK-31). Màn vẫn gắn nhãn D2. |
| 16 | Dòng Fanpage ghi "Hết cửa sổ 24h" | Gợi ý | **Đã sửa tốt** | Nay ghi `Hết cửa sổ 24h · chỉ tin hỗ trợ`. 1c có vùng "Chỉ tin hỗ trợ — còn 5 ngày". |
| 17 | Quản trị: thiếu SLA ticket, tạm dừng khi Chờ khách, nhóm CSKH | Nên sửa | **Sửa chưa đủ** | Nhóm CSKH đã mở (Lan, Mai, Thu). Trên danh sách đã có `Hạn trả lời: tạm dừng`. Bảng SLA ticket theo loại × ưu tiên mới chỉ có dòng trỏ "MH-OA-18", chưa vẽ. |
| 18 | Tin bảo hành qua OA phải vào thẳng hàng CSKH | Gợi ý | **Đã sửa tốt** | Quản trị ghi "Nút chatbot OA 'Bảo hành' vào thẳng hàng CSKH". Khung chat có dòng "Khách bấm: Bảo hành". |
| 19 | 0a hiện SĐT đầy đủ | Gợi ý | **Đã sửa tốt** | 1f hiện `0900 *** 678 Hiện`. 0a đã đánh dấu là bản cũ. |

**Tổng:** 19 góp ý cũ. **Đã sửa tốt 13** · **Sửa chưa đủ 5** (#1, #6, #8, #14, #17) · **Chưa sửa 1** (#15). Cả 6 góp ý Chặn cũ đã sửa, riêng #1 còn lệch số ở 1f và 360.

## Làm thử 6 việc

| Việc | Các bước (màn) | Số cú bấm | Lượt 1 | Vướng ở đâu |
|---|---|---|---|---|
| (a) Khách OA hỏi bảo hành, còn 30 phút cửa sổ miễn phí | 1f mở sẵn Hộp thư CSKH → bấm `Sắp hết khung miễn phí` (1) → bấm dòng có chip đỏ `⏱ Còn 18′` (1) → dải đỏ "Còn 18 phút để trả lời miễn phí" → `+ Tạo ticket` (1) → chọn Bảo hành (1), gõ tiêu đề, giữ "Gửi tin xác nhận cho khách" → `Tạo ticket` (1): khách nhận tin xác nhận ngay trong khung → gõ trả lời, `Gửi` (1) | 6 | ≥ 7, không làm trọn | Làm trọn được. Việc tạo ticket có gửi tin xác nhận nên kịp giữ khung. Vướng: đầu khung và panel "Khung gửi" ghi hai con số khác nhau (góp ý cũ #1). Chưa vẽ trường hợp khung hết đúng lúc tôi đang gõ ("Khung gửi vừa hết lúc…"). |
| (b) Khách OA nhắn lại sau 3 ngày | Khách nhắn lại: dòng lên đầu, khung gửi mở lại (1c ghi "Khách nhắn lại OA thì khung gửi mở lại ngay") → mở (1) → trả lời, `Gửi` (1). Nếu tôi chủ động nhắn khách đã im 3 ngày: mở (1) → dải mâm xôi Z2 → gõ, `Gửi (có phí)` (1) → hộp xác nhận `Gửi (có phí)` (1). OA tắt có phí: `Tin mẫu (ZNS)` (1) → chọn mẫu (chưa vẽ) | 2 (khách nhắn) / 3 (có phí) | 3 rồi bế tắc | Hết bế tắc. Nếu tin khách nhắn lại liên quan ticket đã đóng thì có hộp `Mở lại #TK-0142 / Tạo ticket mới / Không cần`, rất đúng việc. Vướng nhỏ: biến thể "OA tắt có phí" vẫn ghi "Tin tư vấn sẽ tính phí — còn 4 ngày 3 giờ" (góp ý mới #6). |
| (c) Khách của sale Minh khiếu nại giao thiếu qua OA | Dòng có "Phụ trách sale: …" → mở (1) → thấy `Bạn chỉ xem hội thoại này. Khách của … (sale)` → `Tạo ticket để trả lời` (1) → chọn Khiếu nại (1) → `Tạo ticket` (1), "Owner sale sẽ được thông báo tự động" → trả lời, `Gửi` (1) | 5 | ≥ 8 | Nhanh hơn nhiều, không phải @ sale bằng tay. Vướng lớn: trước khi trả lời tôi **không biết sale đã hứa gì** (giao bù ngày nào, đổi hay trả tiền). Chỉ có dòng "Nam vừa nhắn khách này qua Zalo cá nhân 10′ trước", nội dung chờ CH-1, và không có khối "Cam kết đã nêu" (góp ý mới #1). |
| (d) Bình luận Fanpage có SĐT | Thanh trái `Bình luận` (1) → chọn quảng cáo (1) → bình luận đã tự ẩn → `Nhắn riêng` (1) → sửa nháp, `Gửi` (1) → `lưu vào hồ sơ mới` (1) → `Nhận xử lý` (1) | 6 | 7 | Bớt một cú vì có mục Bình luận trên thanh trái. Ba điểm vướng cũ vẫn còn (góp ý cũ #15). Đây là lead hỏi giá, lẽ ra phải chuyển sale, nhưng màn chỉ cho tôi `Nhận xử lý` và nháp có sẵn câu báo giá. |
| (e) Mở ticket bảo hành từ một tin nhắn | Khung chat 1f → `+ Tạo ticket` ở đầu khung (1) → modal có sẵn tin gốc, cảnh báo ticket trùng → chọn Bảo hành (1) → `Tạo ticket` (1) → khối Ticket ở panel cập nhật | 3 | ≥ 5, không làm trọn | Làm trọn được. Vướng: nút ở đầu khung tự lấy tin nào làm tin gốc? Khách nhắn 3 tin, tin bảo hành nằm giữa thì tôi cần chọn đúng tin. Menu "Tạo ticket từ tin này" trên từng tin được nhắc ở 1g nhưng chưa vẽ (góp ý mới #7). |
| (f) **Mới:** nhận khách mới trong hàng chưa phân công | Thông báo "n khách đang chờ nhận" (00, chưa vẽ trên 1f) hoặc bấm `Chưa nhận 5` (1) → rê chuột vào dòng, `Nhận xử lý` (1) → dòng chuyển sang Của tôi, mở (1) → trả lời, `Gửi` (1) | 4 (ước tính) | – | Hàng Chưa nhận chưa được vẽ, nên tôi đang đoán. Trên 1f, ô chọn và nút `Nhận xử lý (2 đã chọn)` lại hiện ở hàng **Của tôi**, trong khi đặc tả chỉ cho hiện ở hàng Chưa nhận. Dòng "Chị Lan Anh · Chưa có ticket · Chưa có sale" nằm trong Của tôi, nên tôi không biết khách này đã là của tôi hay chưa. Nếu khách mới hỏi giá thì nút `Chuyển cho sale` đang giấu trong menu `⋯` (góp ý mới #5). |

## Góp ý mới

| # | Màn | Góp ý | Vì sao | Đề xuất sửa | Mức |
|---|---|---|---|---|---|
| 1 | 1f panel phải, 3 Customer 360 | Chưa có khối **"Cam kết đã nêu (7 ngày)"** ở bất kỳ màn nào (DK-49, MH-DK-02 #15, DK-US-19). | Khách khiếu nại qua OA hay mở đầu bằng "anh Minh hứa đổi miễn phí sao chưa thấy". Không thấy lời sale đã hứa thì tôi dễ nói ngược, khách mắng và sale giận. Đây là nỗi sợ số 1 của tôi, và đặc tả đã hứa là tôi không cần xin quyền để xem. | Vẽ khối "Cam kết đã nêu" ở panel 1f, đặt trên khối Ticket, và thêm vào 360: tối đa 5 dòng gồm loại (Giá / Ngày giao / Cam kết đổi–trả…), mặt hàng, giá trị, người, chip kênh, giờ, nhãn "điện thoại" / "Ticket TK-…". Vẽ một dòng mẫu như UAT-DK-38: `Cam kết đổi–trả · Đổi mới bơm nước, miễn phí · Zalo·Minh · hôm qua 14:20`. | **Chặn** |
| 2 | 1f (khung chat Fanpage / OA), 3 | Chưa có trạng thái **"Danh tính chưa xác nhận"** và ba nút xác nhận (DK-50, Kịch bản M 02). | Dòng Quân Nguyễn (Page, "Đơn của mình tới đâu rồi shop", nhãn Thiếu đơn) đúng là trường hợp này. Không có banner thì tôi sẽ đọc tình trạng đơn, thậm chí công nợ, cho một người chưa chắc là khách. | Vẽ banner vàng `Danh tính chưa xác nhận` với các nút `Gửi yêu cầu chia sẻ thông tin OA` (ẩn khi chưa có danh tính OA), `Đối chiếu mã đơn + SĐT` (mở ô nhập, khớp VCsales thì ghi "Đã xác nhận trong phạm vi đơn DH-…"), `Nhờ owner xác nhận`. Khi chưa xác nhận thì khối thương mại thu gọn, công nợ ẩn. | **Chặn** |
| 3 | 1c (biến thể "khách của sale"), 1f | Chưa có **hạn trả lời của owner** và trạng thái **tạm giữ** (DK-48, OA-11). | Khách hỏi giá trên OA, sale đi thị trường không trả lời. Tôi thấy "Bạn chỉ xem" nhưng không biết sale còn bao lâu nữa phải trả lời, cũng không biết khi nào tôi được gửi câu giữ khách. | Trên dòng và đầu khung, thêm chip `Owner trả lời trong: 18′` và khi quá hạn thì `Owner chưa trả lời 30′`. Khi quá hạn, ô soạn mở ở chế độ "Câu giữ khách (không nêu giá)", có mẫu câu sẵn. Ghi chú CH-3. | **Nên sửa** |
| 4 | 3 Customer 360 | Mới có góc nhìn của sale (TU). Chưa có góc nhìn CSKH: tôi chỉ được xem Đơn / giao hàng / hóa đơn, công nợ chỉ hiện "Có / Không" (MH-DK-01, quyền CS). | Nếu 360 cho tôi thấy "Công nợ 42,3 tr ₫" thì sớm muộn tôi sẽ đọc số đó cho khách, sai quy định. | Vẽ thêm một biến thể 360 cho CSKH (hoặc chú thích trên màn): ẩn doanh số, hạng, giá chính sách; công nợ chỉ hiện `Có công nợ quá hạn: Có`; SĐT ẩn kèm nút "Xem" có ghi nhật ký. | **Nên sửa** |
| 5 | 1f (hàng Chưa nhận) | Hàng Chưa nhận chưa được vẽ. Ô chọn và nút `Nhận xử lý (n đã chọn)` đang hiện ở hàng Của tôi. Dòng "Chưa có sale" nằm lẫn trong Của tôi. | Nhận khách mới là việc đầu ca. Tôi cần thấy khách đã chờ bao lâu, ai vừa nhận trước tôi, và khách hỏi giá thì chuyển sale ngay. | Vẽ hàng Chưa nhận: có ô chọn, nút `Nhận xử lý` hiện khi rê chuột, dòng "Chờ 14 phút", toast khi bị trùng `#TK-0142 vừa được Minh nhận.`. Bỏ ô chọn ở hàng Của tôi. Với dòng loại Bán hàng, đưa nút `Chuyển cho sale` ra ngoài. | **Nên sửa** |
| 6 | 1c (Z2, OA tắt có phí) | Dải trên cùng vẫn ghi "Tin tư vấn sẽ tính phí — còn 4 ngày 3 giờ trước khi không gửi được", ngay bên dưới lại ghi "OA không cho phép tin có phí". | Hai câu ngược nhau. Tôi sẽ tưởng còn gửi được trong 4 ngày. | Khi OA tắt có phí, dải chỉ ghi `Đã hết 48 giờ miễn phí. OA không gửi tin có phí.`, màu xám như Z3. | **Nên sửa** |
| 7 | 1f khung chat, 1g | Mục "Tạo ticket từ tin này" trên menu `⋯` của từng tin chưa được vẽ. Chưa rõ nút `+ Tạo ticket` ở đầu khung lấy tin nào làm tin gốc. | Khách hay nhắn 3–4 tin liền nhau. Nếu gắn sai tin gốc thì người khác đọc ticket sẽ hiểu sai. | Vẽ menu của tin có mục `Tạo ticket từ tin này` và `Gắn vào ticket đang mở`. Trong modal, cho đổi tin gốc (chọn nhiều tin). | Gợi ý |
| 8 | 1g, 3, 5 | Mã ticket có ba kiểu: `#TK-0142` (1f, 1g), `TK-1042` (360), `T-1042`, `T-1039` (5 Việc cần làm). | Khách đọc mã ticket qua điện thoại, tôi tìm theo mã. Mã lệch là tìm không ra. | Thống nhất một dạng `TK-xxxx` trên mọi màn. | Gợi ý |
| 9 | 1g (Hoạt động của ticket) | Dòng "Tạo từ tin của khách (quy tắc 'Từ khóa bảo hành')", trong khi Quản trị ghi tự phân loại theo từ khóa là GĐ2. | Tôi không biết trong D1 ticket có tự mở hay không, nên không biết sáng ra có phải tự rà tin bảo hành hay không. | D1 ghi `Tạo từ nút chatbot "Bảo hành"` hoặc `Lan tạo`. Để ví dụ từ khóa sang D2. | Gợi ý |
| 10 | 1f ô soạn | Nút `Gửi báo giá` vẫn bấm được với khách có owner (Nam), trong khi CSKH không được gửi báo giá cho khách đã có owner (DK-31, UAT-OA-90). | Nút sáng thì tôi tưởng mình được gửi. | Với khách đã có owner, làm mờ nút, rê chuột hiện `Khách của Nam. Dùng "Báo sale báo giá".`. Hoặc thay luôn bằng nút `Báo sale báo giá`. | Gợi ý |

**Tổng góp ý mới:** 10. **Chặn** 2 (#1, #2) · **Nên sửa** 4 (#3, #4, #5, #6) · **Gợi ý** 4 (#7–#10).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-2/P-CS.md) | — |
