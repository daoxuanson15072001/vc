# Góp ý thiết kế D1 — P-KD (Minh)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Minh (P-KD, NVKD VCparts) góp ý lượt 1 lô thiết kế TK1 (D1); xem màn 1, 1a, 1b, 1c, 2, 3, so với bản đang chạy (ảnh UAT 29/09) và đặc tả 03.
- 20 góp ý: **3 Chặn** (#1–#3) · 13 Nên sửa · 4 Gợi ý (đếm từ bảng, file không ghi tổng).
- Thiết kế nhanh hơn Zalo ở tra giá, gửi báo giá (2 cú) và nhắn khách OA hết cửa sổ; chưa hơn ở việc tìm khách nợ quá hạn.
- Chặn: không có chỗ báo nick mất kết nối; chưa vẽ ô soạn khóa ở giai đoạn thử; tin gửi lỗi không có lý do, thiếu nút Lệnh gửi và trạng thái "Quá hạn — chưa gửi".
- Nên sửa chính: quá nhiều hàng lọc, ô tra giá nằm sai tab, hộp gửi báo giá thiếu bảng chọn và "Nhắc tôi theo dõi", SĐT ở 360 bị che với người phụ trách, chưa có bản điện thoại.
- Ghi 15 chỗ thiết kế lệch đặc tả 03.
- Kết quả xử lý xem `vong-2/P-KD.md`.

## Mục lục

- [Làm thử 5 việc](#làm-thử-5-việc)
- [Góp ý theo màn](#góp-ý-theo-màn)
- [Chỗ thiết kế lệch đặc tả 03](#chỗ-thiết-kế-lệch-đặc-tả-03)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Người góp ý: Minh, NVKD VCparts (vai P-KD). Đọc bản vẽ "VClinks UI Design", các màn 1, 1a, 1b, 1c, 2, 3. Có so với bản đang chạy (ảnh UAT 29/09 `04-khung-chat.png`) và đặc tả `docs/02-yeu-cau/dac-ta/03-sale-zalo-ca-nhan.md`.

Nhìn tổng thể thì em thấy **có lợi hơn Zalo thật**: ghi âm có chữ luôn, báo giá gửi 2 cú bấm thay vì tải PDF rồi đính kèm, danh sách xếp khách sắp quá hạn lên đầu, còn thấy "chị Hà đang trả lời" để hai người khỏi trả lời trùng. Nhưng lần đầu mở màn Hộp thư, mắt em bị kéo đi lung tung: phía trên danh sách có **ba hàng nút lọc**, thêm nút nick, dải "Việc hôm nay" rồi dòng "Sắp theo…", xong mới tới khách đầu tiên. Tiêu đề khung chat cũng dài hai dòng, nhiều chữ. Cái em sợ nhất là **không thấy chỗ nào báo nick Zalo của em đang mất kết nối**. Nếu nick rớt mà em vẫn gõ, tưởng đã gửi cho khách, thì mất khách. Em cũng chưa thấy bản cho điện thoại, mà buổi chiều em chỉ cầm điện thoại.

## Làm thử 5 việc

Cú bấm tính từ lúc đang ở màn Hộp thư. Gõ phím không tính.

| Việc | Các bước trên thiết kế (màn) | Số cú bấm | So với Zalo | Vướng ở đâu |
|---|---|---|---|---|
| (a) Khách gửi ảnh phụ tùng hỏi giá, em trả lời | Bấm hội thoại (1) → bấm ảnh xem lớn (1a) → đóng ảnh (1) → panel phải bấm tab **Báo giá** (2) → gõ mã vào ô "Tra nhanh giá, tồn" → đọc giá, tồn → gõ trả lời → Enter | 4 + Enter | Zalo: xem ảnh, chuyển sang VCsales tìm mã, quay lại Zalo gõ, khoảng 6–8 cú bấm. **Nhanh hơn** | Ô tra giá nằm ở tab "Báo giá", không nằm ở tab "Khách" đang mở sẵn. Em sẽ không nghĩ ra là phải vào tab Báo giá để tra giá. Tra xong cũng không có nút "chèn giá vào ô soạn", phải tự gõ lại con số |
| (b) Gửi báo giá PDF | Ô soạn bấm **Gửi báo giá** (1, màn 1/1b) → hộp thoại màn 2, PDF chọn sẵn → **Gửi qua Zalo** (1) | 2 (nếu đã có báo giá duyệt) | Zalo: tải PDF từ VCsales → mở Zalo → đính kèm → chọn file → gửi, khoảng 6–7 cú bấm. **Nhanh hơn rõ** | Khách có 2 báo giá thì bấm từ ô soạn không biết nó chọn cái nào: hộp thoại không có bảng chọn báo giá. Không thấy "đã gửi mấy lần", sợ gửi trùng. Hộp thoại còn có dòng vàng kiểu kỹ thuật "Nếu VCsales chưa có API…", đọc không hiểu |
| (c) Trả lời trích dẫn một tin cũ | Rê chuột lên tin → bấm ↩ (1) → gõ → Enter | 1 + Enter | **Ngang Zalo** | Tin cũ chưa tải thì phải cuộn lên. Thiết kế chưa có menu chuột phải (MH-SZ-04). Trong nhóm không vừa trích dẫn vừa @tên được (màn 1b ghi là chưa hỗ trợ), mà Zalo làm được |
| (d) Tìm khách **nợ quá hạn** đang nhắn | Không có bộ lọc công nợ. Phải bấm từng hội thoại (1 cú/khách) rồi nhìn khối "Thương mại" ở panel phải, mà khối này còn mờ vì để GĐ2 | ~1 cú × số khách đang nhắn (10–20) | Zalo không làm được. Hiện em phải mở VCsales xem danh sách nợ rồi dò tên trên Zalo. **Chưa hơn** | Dòng hội thoại không có dấu "nợ quá hạn". Nút "Lọc" (trạng thái, người phụ trách, tag, chưa trả lời, có SĐT) không có "Nợ quá hạn". Màn 360 ghi "Công nợ 42,3 tr hạn 05/10" nhưng không có màu nào báo quá hạn |
| (e) Khách nhắn OA đã quá cửa sổ gửi | Bấm hội thoại (1, dòng có chữ xám "Hết cửa sổ 24h") → màn 1c thấy ô soạn khóa → bấm **Nhắn qua Nick …** (1) → gõ → Enter (+ hộp xác nhận lần đầu, 1) | 2–3 + Enter | Zalo: em phải tự tìm khách trong danh bạ nick cá nhân, khoảng 4–5 cú bấm. **Nhanh hơn** | Nút gợi ý nhắn qua "Nick Linh", không phải nick của em (Tú/Minh). Không biết khách đã kết bạn với nick đó chưa. Chữ "Hết cửa sổ 24h" ở dòng danh sách màu xám, nhỏ, dễ bỏ qua |

## Góp ý theo màn

| # | Màn | Góp ý | Vì sao | Đề xuất sửa | Mức |
|---|---|---|---|---|---|
| 1 | 1 Hộp thư (MH-SZ-01), 1a/1b (MH-SZ-03, 05) | Không có chỗ nào báo **nick mất kết nối**: không chấm màu trên avatar nick, không dải vàng/đỏ trên danh sách, không chip nick ở tiêu đề chat, ô soạn không khóa | Nick rớt mà em vẫn gõ, tưởng đã gửi, khách chờ mãi. Đây là nỗi sợ số 1 khi bỏ Zalo điện thoại để dùng VClinks | Vẽ thêm trạng thái "nick đỏ": chấm đỏ 10 px trên avatar nick ở thanh trái; dải đỏ đầu danh sách `Nick Tú đang mất kết nối với Zalo từ 08:40. Tin mới có thể về chậm, chưa gửi được.` + link `Chi tiết`; chip `● Nick Tú` ở tiêu đề chat; nút Gửi và thanh công cụ mờ, dòng ghi chú đỏ. Vẽ cả trạng thái vàng "Chậm" | **Chặn** |
| 2 | 1a, 1b (MH-SZ-03, SZ-14) | Chưa vẽ trạng thái **Giai đoạn thử**: hội thoại ngoài nhóm test thì ô soạn phải khóa | Hiện tại lệnh bị treo "Đang chờ gửi" mãi. Em gõ trả lời khách thật mà không đi, khách chờ | Vẽ ô soạn khóa với chữ `Giai đoạn thử: VClinks chỉ gửi vào nhóm "Kiểm thử vclink". Hãy trả lời khách trên Zalo.` ngay chỗ ô soạn, nền vàng | **Chặn** |
| 3 | 1a (MH-SZ-03 #7, MH-SZ-13) | Tin **Gửi lỗi** chỉ có chữ "Gửi lỗi · Thử lại", không nói lý do. Tiêu đề không có nút ⏳ Lệnh gửi. Danh sách không có chấm ⚠ cho hội thoại có tin lỗi. Chưa có trạng thái "Quá hạn — chưa gửi" | Ảnh UAT đang chạy có cả chục tin "Gửi lỗi", em không biết tại sao, cũng không biết còn hội thoại nào bị lỗi | Dưới bong bóng lỗi thêm 1 dòng lý do bằng tiếng người (ví dụ `Không tìm thấy danh thiếp "Kỹ thuật Tuấn"`). Tiêu đề chat thêm nút `⏳ 2` đỏ. Dòng hội thoại thêm chấm đỏ 8 px + tooltip `Có tin gửi lỗi`. Vẽ bong bóng `Quá hạn — chưa gửi · Thử lại` | **Chặn** |
| 4 | 1 Hộp thư (MH-SZ-01 #4–8) | Phía trên danh sách có quá nhiều nút lọc: 3 hàng segmented (Của tôi/Chưa phân công/Tất cả, Tất cả/Chưa đọc/Chưa trả lời, 6 kênh kể cả Email GĐ2) + nút Nick + dải Việc hôm nay + dòng "Sắp theo". Khách đầu tiên bị đẩy xuống gần giữa màn | Laptop 14 inch cao 900 px, em chỉ thấy được 5–6 khách. Zalo mở ra là thấy khách ngay | NVKD chỉ có "Của tôi" (đúng đặc tả #4) nên **bỏ hàng Của tôi/Chưa phân công/Tất cả** với NVKD. Bỏ nút `Email` khi chưa có. Gộp kênh + nick vào nút `Lọc`. Giữ 1 hàng: `Tất cả · Chưa đọc · Chưa trả lời · Đã ghim`. Dòng "Sắp theo…" chuyển thành tooltip | **Nên sửa** |
| 5 | 1 Hộp thư, 3 Customer 360 | Không lọc được **khách nợ quá hạn**, dòng hội thoại không có dấu nợ | Khách nợ quá hạn nhắn đặt thêm hàng, em cần biết ngay để nhắc nợ khéo trước khi báo giá | Thêm chip đỏ nhỏ `Nợ quá hạn` trên dòng hội thoại (cạnh nhãn nick). Thêm mục `Nợ quá hạn` vào nút Lọc. Ở 360 và panel phải, công nợ quá hạn tô đỏ kèm `quá 5 ngày`. Nếu khối thương mại chưa kịp làm ở MVP thì ít nhất làm cái cờ này | **Nên sửa** |
| 6 | 1 Hộp thư, panel phải (F9.1, KD-06) | Ô **tra nhanh giá, tồn** nằm trong tab "Báo giá" | Khách hỏi giá là việc em làm nhiều nhất trong ngày (80–120 tin), không muốn đổi tab | Đưa ô `Tra giá / tồn (mã OE, tên, dòng xe)` lên đầu tab `Khách`, hoặc thêm nút `Tra giá` trên thanh công cụ ô soạn. Kết quả có nút `Chèn vào tin` để đưa "Má phanh trước Vios 2019 chính hãng 1.450.000 ₫, còn hàng" vào ô soạn | **Nên sửa** |
| 7 | 2 Gửi báo giá (MH-SZ-05i) | Hộp thoại mở thẳng một báo giá, không có **bảng chọn báo giá**, nút `Làm mới`, `Tạo báo giá ↗`, xem trước trang 1, "Đã gửi: n lần" | Bấm từ ô soạn khi khách có 2–3 báo giá thì không biết gửi cái nào. Không biết đã gửi chưa nên dễ gửi trùng, khách tưởng hai giá khác nhau | Làm đúng khung đặc tả: bước ① bảng radio (Số, Ngày, Tổng, Hiệu lực, Trạng thái), dòng nháp/hết hạn mờ + tooltip lý do, chọn sẵn báo giá hợp lệ mới nhất. Cạnh tiêu đề ghi `Đã gửi 1 lần · 09:26` | **Nên sửa** |
| 8 | 2 Gửi báo giá | Thiếu ô **`Nhắc tôi theo dõi sau [3] ngày`** | Gửi báo giá xong quên theo dõi là mất đơn. Ô này có ích cho KPI của em hơn mọi thứ khác | Thêm checkbox, tích sẵn, 3 ngày, ở ngay trên nút Gửi | **Nên sửa** |
| 9 | 2 Gửi báo giá | Dòng vàng "Nếu VCsales chưa có API báo giá: tải PDF… (BA §20)" nằm trong hộp thoại | Đây là ghi chú cho dev. Sale đọc thấy thì rối, tưởng phải tải PDF tay | Bỏ khỏi giao diện, chuyển thành ghi chú bên lề bản vẽ | **Gợi ý** |
| 10 | 2 Gửi báo giá | Nút chính ghi `Gửi qua Zalo`, thiếu câu "Bấm Gửi báo giá nghĩa là bạn đã duyệt", thiếu trạng thái đang tải / lỗi / khách chưa có mã KH / nick đỏ | Em cần biết rõ là gửi từ nick nào. Khi VCsales chậm thì hộp thoại hiện gì? | Chân hộp thoại: `Gửi từ nick Tú. Bấm "Gửi báo giá" nghĩa là bạn đã duyệt.`, nút `Gửi báo giá`. Vẽ thêm 3 trạng thái: `Đang lấy báo giá từ VCsales…`, lỗi có nút `Thử lại`, nút mờ + tooltip `Khách chưa liên kết mã KH VCsales` | **Nên sửa** |
| 11 | 1 Hộp thư, tiêu đề chat (MH-SZ-03) | Tiêu đề chat dài 2–3 dòng: SLA, trạng thái, Chuyển, phụ trách, mã KH, "khách này còn nhắn qua OA hôm qua, Fanpage 12/09", "Xem gộp mọi kênh" | Chiếm chỗ của tin nhắn. Em chỉ cần tên khách, nick, SLA | Dòng 1: tên + chip nick + SLA. Dòng 2: `Garage Minh Phát · KH-00812` (bấm mở 360). Chuyển "khách còn nhắn qua…" và "Người phụ trách" sang tab Khách của panel phải. Nút `Chuyển` gom vào menu `⋯` | **Nên sửa** |
| 12 | 1 Hộp thư, ô soạn | Nút `Trả lời qua [Zalo · Nick Tú]` đặt ngay trên ô soạn, bấm được để đổi kênh | Em sợ bấm nhầm đổi sang OA/Fanpage mà không để ý, khách nhận tin từ chỗ lạ | Mặc định khóa theo kênh khách vừa nhắn, chỉ hiện chữ `Gửi từ Zalo · Nick Tú`. Muốn đổi kênh phải vào menu `⋯` → `Nhắn qua kênh khác`, và khi đổi thì cả ô soạn đổi màu viền | **Nên sửa** |
| 13 | 1, 1b (MH-SZ-05 #15) | Dòng ghi chú dưới ô soạn vẫn là "Tin sẽ được gửi qua tiện ích VClinks trên tab Zalo Web đang mở", cỡ chữ 11 px | Em không hiểu "tiện ích", "tab Zalo Web" là gì. Chữ 11 px trên laptop 14 inch rất khó đọc | Đổi thành `Gửi từ nick Tú · Enter để gửi, Shift+Enter để xuống dòng · gõ / để chèn mẫu câu`, cỡ 12 px | **Nên sửa** |
| 14 | 1, 1a, 2 | Nhiều chữ quan trọng quá nhỏ: nhãn kênh `Zalo/OA` 10 px, `đã xác nhận` 10 px, trạng thái báo giá `Đã duyệt/Nháp` 11 px, `Còn 12′` | Laptop 14 inch, ngồi xa là không đọc được, nhất là chữ SLA mà em cần nhìn nhanh | Chữ có nghĩa (SLA, trạng thái báo giá, nick) tối thiểu 12 px. Nhãn kênh để 11 px nhưng in đậm | **Gợi ý** |
| 15 | 1 Hộp thư, panel phải (MH-SZ-03 #8) | Panel phải 380 px luôn mở, không có nút ẩn | Trên laptop 1366–1440 px, danh sách 340 + panel 380 làm khung chat hẹp, tin dài bị xuống nhiều dòng | Thêm nút `ℹ` ở tiêu đề chat để ẩn/hiện panel, nhớ lựa chọn. Màn dưới 1440 px thì mặc định ẩn | **Nên sửa** |
| 16 | 3 Customer 360 | SĐT bị che `0900 ••• 678`, bấm "Hiện (ghi nhật ký)". Trong khi panel phải ở màn 1 lại hiện đủ | Em là người phụ trách khách này (KD-08 nói phải hiện đủ). Bấm hiện mà bị ghi nhật ký thì cảm giác bị soi | Người phụ trách thì hiện đủ SĐT, không ghi nhật ký. Chỉ che với người không phụ trách. Hai màn phải hiện giống nhau | **Nên sửa** |
| 17 | 3 Customer 360 | Màn nhiều khối (tóm tắt AI, liên hệ, tương tác, dòng thời gian 8 bộ lọc, thương mại, báo giá, hóa đơn, thị trường). Nút `Nhắn tin ▾` nhỏ ở góc | Em mở 360 chủ yếu để xem nợ, đơn, báo giá rồi quay lại nhắn. Các khối GĐ2 mờ làm rối | Đưa khối Công nợ + Báo giá đang mở lên cạnh đầu trang. Khối GĐ2 thu gọn thành một dòng `Sắp có: Hóa đơn, Thị trường`. Nút `Nhắn tin` to, màu chính | **Gợi ý** |
| 18 | 1c OA/Fanpage | Khách OA quá khung tư vấn: nút gợi ý `Nhắn qua Nick Linh`, không phải nick của sale phụ trách, cũng không nói khách đã là bạn Zalo chưa | Em bấm vào thì nhắn bằng nick người khác, khách bị chia | Nút ghi đúng nick của người phụ trách: `Nhắn qua Zalo · Nick Tú (đã là bạn)`. Chưa là bạn thì ghi `Gửi lời mời kết bạn…`. Trên dòng danh sách, "Hết cửa sổ 24h" đổi sang chip đỏ nhạt | **Nên sửa** |
| 19 | Mọi màn D1 | Chưa có bản **điện thoại** cho Hộp thư và Khung chat | Buổi chiều em đi gặp khách, chỉ có điện thoại. Nếu VClinks không dùng được trên điện thoại thì em vẫn phải trả lời trên Zalo, rồi VClinks mất lịch sử | Vẽ thêm 2 màn 390 px: danh sách "Của tôi" và khung chat (ô soạn + Gửi báo giá + chip nick) | **Nên sửa** |
| 20 | 1b Ô soạn | Thanh công cụ 8 biểu tượng không có chữ. Biểu tượng "số tài khoản" và "tin nhắn nhanh" khó đoán | Rê chuột mới biết. Em hay bấm nhầm | Giữ biểu tượng như Zalo nhưng thêm chữ nhỏ dưới 2 nút ít gặp (`STK`, `Mẫu`), hoặc tooltip hiện ngay, không chờ | **Gợi ý** |

## Chỗ thiết kế lệch đặc tả 03

1. **MH-SZ-01 #4:** đặc tả nói NVKD chỉ có "Của tôi". Bản vẽ vẽ cho NVKD (Tú) cả `Chưa phân công (3)` và `Tất cả`.
2. **MH-SZ-01 #5, #8, #3:** đặc tả có `Đã ghim` và bộ lọc `Thẻ:`, và nút `Tạo nhóm`. Bản vẽ thay `Đã ghim` bằng `Chưa trả lời` (story KD-01 cần cái này, nên giữ cả hai), không có bộ lọc Thẻ và nút Tạo nhóm.
3. **MH-SZ-01 trạng thái, MH-SZ-03 #5, MH-SZ-05 trạng thái, SZ-10, SZ-12, MH-SZ-12a:** bản vẽ thiếu hẳn trạng thái nick xanh/vàng/đỏ (chấm, dải, chip, khóa ô soạn).
4. **MH-SZ-03 #6–#8:** trên tiêu đề chat, nút Tìm và Thông tin bị vẽ mờ "D2", còn nút ⏳ Lệnh gửi thì không có. Đặc tả xếp cả ba là Mới trong D1.
5. **MH-SZ-03 #12, SZ-14:** bản vẽ không có dải hay ô soạn khóa cho giai đoạn thử.
6. **MH-SZ-03 #38a, #38b, SZ-11:** thiếu dòng "Duyệt bởi {tên}" và trạng thái "Quá hạn — chưa gửi".
7. **MH-SZ-01 #9k:** thiếu chấm ⚠ "Gửi lỗi" trên dòng hội thoại.
8. **MH-SZ-03 #31:** bản vẽ vẫn ghi `VCLinks giữ bản đã lưu`, đặc tả đã sửa thành `VClinks`.
9. **MH-SZ-04:** không vẽ menu chuột phải (Trả lời, Sao chép, Xem người gửi, Tạo nhắc việc từ tin này).
10. **MH-SZ-05 #15:** dòng ghi chú chưa đổi sang `Gửi từ nick {nick} …` như đặc tả [Sửa].
11. **MH-SZ-05 #12a:** chưa thể hiện việc giữ nháp khi chuyển hội thoại (cần vì SZ-10 cho gõ khi nick đỏ).
12. **MH-SZ-05i:** thiếu bảng chọn báo giá, `Làm mới`, `Tạo báo giá ↗`, xem trước + "Đã gửi n lần", `Nhắc tôi theo dõi sau n ngày`, câu duyệt và trạng thái tải/lỗi/không mã KH/nick đỏ. Có thêm dạng gửi **`Link xem`** mà đặc tả không có (chỉ PDF/Ảnh). Nút ghi `Gửi qua Zalo` thay vì `Gửi báo giá`.
13. **MH-SZ-07:** panel phải của bản vẽ có tab Khách/Báo giá/Việc/Media, không có tab Thành viên/File/Link/Tìm và nút ✕ đóng như đặc tả. Với nhóm (màn 1a) thì chưa có panel.
14. **KD-08 / MH-SZ-07:** đặc tả để công nợ ở panel (có giờ lấy). Bản vẽ để công nợ mờ "GĐ2", còn SĐT ở 360 bị che với chính người phụ trách.
15. **Bố cục chung §5:** đặc tả là danh sách 360 px + panel 340 px, bản vẽ là 340 + 380. Mobile (< 768 px) đặc tả có nhưng bản vẽ D1 chưa có màn nào.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-1/P-KD.md) | — |
