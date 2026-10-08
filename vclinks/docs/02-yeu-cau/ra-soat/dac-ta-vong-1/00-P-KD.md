# Góp ý 00 — P-KD (Minh)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý vòng 1 của Minh (P-KD, NVKD) cho đặc tả 00 Giao diện chung, theo một ngày làm việc (sáng laptop, chiều đi garage) và có đếm thao tác.
- 18 góp ý: 3 Chặn, 11 Nên sửa, 4 Gợi ý; kèm 6 câu hỏi và 11 kịch bản UAT đề xuất.
- Khen: Ctrl+K tìm theo mã OE, VIN, biển số; panel phải xem công nợ; thông báo kèm tiếng.
- Chặn 1: điện thoại để GĐ2, MVP không có nút "+", thông báo đẩy hay panel khách.
- Chặn 2: tin trả lời bằng app Zalo bị gắn "Gửi ngoài VClinks", không tính KPI, không rõ có dừng SLA không.
- Chặn 3: rời VClinks 15 phút thành "Tạm vắng", khách có thể bị chia cho người khác trong lúc đang đi chăm khách.
- Còn lại: màn hình chật, nhiều chip, thiếu phím nhảy sang "khách chưa trả lời kế tiếp". Kết quả xử lý: xem [00-xu-ly.md](00-xu-ly.md).

## Mục lục

- [Một ngày của tôi](#một-ngày-của-tôi)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Buổi sáng ngồi laptop thì khung mới này hơn Zalo: có Ctrl+K tìm được theo mã OE, VIN, biển số, có panel bên phải xem công nợ, có thông báo kèm tiếng. Nhưng tài liệu vẫn coi tôi là người ngồi bàn cả ngày. Điện thoại (MH-UI-11) để tới GĐ2. Tin tôi trả lời bằng app Zalo thì ghi "Gửi ngoài VClinks" và **không tính KPI**. Rời laptop 15 phút là tôi thành "Tạm vắng", lâu hơn nữa thì khách của tôi có thể bị chia cho người khác. Tức là buổi chiều tôi đi garage làm việc thật thì hệ thống lại coi như tôi bỏ việc. Ba chỗ đó phải sửa trước. Phần còn lại chủ yếu là màn hình hơi chật và nhiều chip, và chưa có cách nhảy sang "khách chưa trả lời kế tiếp".

## Một ngày của tôi

| Giờ | Tôi làm gì | Màn hình | Cảm nhận |
|---|---|---|---|
| 07:45 | Mở laptop 1366×768, đăng nhập Google. Vào thẳng "Hội thoại · Của tôi". | MH-UI-02, R3, MH-UI-10 | Tốt, khỏi dán token. Nhưng tài liệu chỉ thử ở 1440×900 và 1280×800. Laptop sale công ty phần lớn là 1366×768. Header 56 px, tiêu đề chat 3 dòng, ô soạn có thêm dòng Segmented, dòng công cụ và 2 dòng chú thích. Tôi ước vùng đọc tin chỉ còn khoảng 1/3 màn hình. |
| 07:50 | Nhìn danh sách xem ai chờ mình. | MH-UI-10 #2, #4, #5, #7 | Mỗi dòng giờ có 3 hàng: chip kênh, tên, giờ / chip thẻ, trích tin, tên nick, badge / chip trạng thái, chip SLA, avatar phụ trách. Trong "Của tôi" thì avatar phụ trách lúc nào cũng là tôi, thừa. Ảnh đang chạy còn hiện "Zalo 476214826876503713" trên mọi dòng, tôi không đọc được số đó. Lọc "Chưa trả lời" lại nằm tít trong "Lọc ▾". |
| 08:00 | Trả lời lần lượt 10 khách nhắn đêm qua. | MH-UI-07, MH-UI-08, §7.1 | Alt+Shift+↓ chỉ nhảy sang hội thoại **chưa đọc**. Nhiều khách tôi đã đọc trên điện thoại tối qua rồi nên không còn chưa đọc. Phím tôi cần là "khách chưa trả lời kế tiếp", mà không có. |
| 08:30 | Chị Hương ghi chú "@Minh gọi lại khách". Chuông kêu, bấm vào là tới đúng chỗ. | MH-UI-03, UAT-UI-22 | Rất tốt, khỏi nhắn Zalo riêng. |
| 09:00 | Viết ghi chú nội bộ "khách này hay ép giá, đừng giảm quá 5%" rồi quay sang trả lời khách. | MH-UI-08 #1, Alt+G | Hơi sợ. Tài liệu không nói sau khi lưu ghi chú hay khi đổi hội thoại thì ô soạn có tự về "Trả lời khách" không. Nhầm một lần là khách đọc được ghi chú nội bộ, hoặc tin trả lời của tôi bị lưu thành ghi chú và khách chờ mãi. |
| 09:30 | Khách gọi điện: "xe 30G 123.45 hôm trước em báo giá gì?". Ctrl+K, gõ biển số. | MH-UI-04 | Zalo không làm được, đây là chỗ đáng tiền nhất. Nhưng khách viết biển số đủ kiểu ("30g12345", "30G-123.45", "30 G1 123.45"), và tin "Đang chờ nội dung" thì không tìm được. |
| 10:00 | Để VClinks ở tab sau, sang VCsales làm báo giá. Tiếng "ting" kêu, thông báo hệ điều hành hiện tên khách. | MH-UI-03 | Tốt. Nhưng nhóm nội bộ "VCparts HN" cũng kêu liên tục, không thấy chỗ tắt tiếng riêng một hội thoại. |
| 10:40 | Gửi xong một tin, chuyển sang khách khác. Tin trước bị lỗi. | MH-UI-03 loại "Gửi lỗi", §5.4 | Có thông báo "Gửi lỗi" kèm tiếng, được. Nhưng toast lỗi chỉ hiện 5 giây ở giữa trên, lẫn với các toast "Đã…" khác. |
| 11:30 | Ra xe đi garage. Laptop gập lại. | MH-UI-05 quy tắc online | Sau 15 phút tôi bị "Tạm vắng", sau đó là "Ngoại tuyến". Khách cũ nhắn thì "sau X phút chia theo quy tắc chung", nghĩa là khách của tôi có thể sang tay người khác trong lúc tôi đang ngồi với khách. |
| 14:00 | Ngồi ở garage, khách khác nhắn hỏi giá. Mở VClinks trên điện thoại. | MH-UI-11 | MVP "giữ như hiện có": một cột, không có thanh tab, không có nút "+" (không gửi STK, ảnh), không có thông báo đẩy trên điện thoại. Rốt cuộc tôi mở app Zalo trả lời cho nhanh. |
| 14:05 | Trả lời bằng app Zalo. | MH-UI-07 nhãn "Gửi ngoài VClinks", câu hỏi mở 12 | Tin đó ghi "Gửi ngoài VClinks", **không tính KPI**. SLA có dừng không, hội thoại có sang "Chờ khách" không, tài liệu không nói. Tôi sợ nhất bị giám sát nhắc sai. |
| 17:00 | Về văn phòng, mở laptop lại. | MH-UI-05 | Trạng thái cứ ở "Ngoại tuyến" (đổi tay thì giữ nguyên), tôi phải nhớ tự chuyển lại "Trực tuyến". Không nhớ thì hết giờ không được chia khách mới. |

### Đếm thao tác

| Việc | Laptop VClinks (theo đặc tả) | Zalo | Ghi chú |
|---|---|---|---|
| Trả lời tin mới nhất | Bấm thông báo (1) → bấm vào ô soạn (2) → gõ → Enter (3) | 2 (bấm thông báo → gõ → Enter) | Tài liệu không nói mở hội thoại thì con trỏ tự vào ô soạn. Tự vào thì bằng Zalo. |
| Sang khách chưa trả lời kế tiếp | "Lọc ▾" (1) → tích "Chưa trả lời" (2) → đóng (3) → bấm dòng (4); lần sau thì 1 cú bấm dòng | Không làm được, phải dò bằng mắt | Không có phím tắt. Alt+Shift+↓ là chưa **đọc**, không phải chưa **trả lời**. |
| Tìm khách theo biển số | Ctrl+K (1) → gõ → ↓ (2) → Enter (3) | Không làm được | Tốt, miễn là khớp mọi cách viết biển số. |
| Trả lời trên điện thoại ở garage | Mở trình duyệt → vào VClinks (1–2) → có thể phải đăng nhập lại do phiên 12 giờ (3–5) → bấm hội thoại (6) → bấm ô (7) → gõ → ➤ (8) | 3 (bấm thông báo → gõ → gửi) | Không có thông báo đẩy nên không biết khi nào cần mở. Gấp gần 3 lần Zalo, nên tôi sẽ dùng Zalo. |

## Góp ý

| # | Màn/mục (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-UI-11, §8.3 #5 | Mobile để GĐ2, MVP "giữ như hiện có": không có nút "+" (STK, ảnh, mẫu câu), không có thông báo đẩy, không có panel khách. | Từ 11h30 tôi chỉ có điện thoại. Nếu nửa ngày tôi vẫn ở Zalo thì hai nơi lệch nhau, báo cáo của tôi sai. | Đưa vào MVP tối thiểu: danh sách "Của tôi" + chưa trả lời, đọc tin, gửi chữ, gõ `/` mẫu câu, nút "+" có STK và ảnh, nút ⓘ xem công nợ. Có thông báo đẩy (hoặc "Thêm vào màn hình chính" để nhận thông báo), bấm vào là mở đúng hội thoại. Phiên trên điện thoại giữ lâu, không bắt đăng nhập lại mỗi ngày. | **Chặn** |
| 2 | MH-UI-07 nhãn "Gửi ngoài VClinks", §3.3, §3.4, câu hỏi mở 12 | Tin tôi trả lời bằng app Zalo có nhãn "Gửi ngoài VClinks", đề xuất **KPI chỉ tính tin gửi qua VClinks**. Không nói tin đó có dừng SLA, có chuyển hội thoại sang "Chờ khách" không. | Công ty chưa cho tôi cách tốt trên điện thoại (xem #1) nên tôi buộc phải dùng Zalo. Giờ lại tính là tôi không trả lời, và giám sát thấy "Quá hạn" đỏ trong khi khách đã có câu trả lời. | Tin từ nick công ty, dù gửi từ đâu, đều **tính là đã phản hồi**: dừng SLA, chuyển "Chờ khách". Nhãn đổi thành "Gửi từ điện thoại" cho nhẹ nhàng. Báo cáo có thể tách cột "qua VClinks / qua Zalo" để xem, nhưng không trừ điểm. | **Chặn** |
| 3 | MH-UI-05 quy tắc online, câu hỏi mở 6 | 15 phút không chạm VClinks → "Tạm vắng"; ngoài ca hoặc đóng tab 2 phút → "Ngoại tuyến"; khách cũ nhắn lúc tôi vắng thì "sau X phút chia theo quy tắc chung". Đổi tay "Ngoại tuyến" thì giữ tới khi tôi đổi lại. | Đi garage là việc chính của sale. Khách do tôi chăm mà bị chia cho người khác lúc tôi đang gặp khách, vừa mất khách vừa mất doanh số. Chiều về quên bật lại "Trực tuyến" thì không được chia khách mới. | Khách **đã có người phụ trách** thì không bao giờ tự chia lại chỉ vì tôi vắng. Chỉ báo cho giám sát "Minh vắng, khách X chờ 30 phút", để giám sát quyết định. Tôi đang dùng VClinks trên điện thoại thì tính là "Trực tuyến". Mở lại VClinks trong ca thì tự về "Trực tuyến" (hoặc hỏi một lần). | **Chặn** |
| 4 | MH-UI-10 #4, §7.1 Alt+Shift+↓ | "Chưa trả lời" nằm trong "Lọc ▾". Phím tắt chỉ có "chưa đọc kế tiếp". | Việc tôi làm cả sáng là trả lời hết khách đang chờ. Chưa đọc với chưa trả lời khác nhau, vì tôi đọc trên điện thoại rồi. | Đưa "Chưa trả lời" ra thành nút ngang hàng với "Chưa đọc": `[Tất cả | Chưa đọc | Chưa trả lời]`. Thêm phím "khách chưa trả lời kế tiếp". Có tùy chọn "Gửi xong tự mở khách đang chờ kế tiếp". | **Nên sửa** |
| 5 | MH-UI-08 #1, Alt+G | Không nói chế độ "Ghi chú nội bộ" có tự về "Trả lời khách" sau khi lưu hay khi đổi hội thoại không. | Ghi chú kiểu "khách hay ép giá" mà lọt ra khách thì mất khách. Ngược lại, tin trả lời bị lưu nhầm thành ghi chú thì khách chờ mãi. | Lưu ghi chú xong và đổi hội thoại thì **luôn về "Trả lời khách"**. Ở chế độ trả lời mà gõ "@tên đồng nghiệp" thì hỏi "Bạn đang nhắn cho khách. Chuyển thành ghi chú nội bộ?". Ô ghi chú có viền vàng đậm cả khung, nhìn là biết. | **Nên sửa** |
| 6 | §1.8, §3.7, MH-UI-07, MH-UI-08 | Chỉ kiểm ở 1440×900 và 1280×800. Laptop 1366×768 thì phần chữ cố định trên dưới (header, tiêu đề chat 3 dòng, dải cảnh báo, Segmented, thanh công cụ, 2 dòng chú thích) chiếm gần hết chiều cao. | Laptop của sale phần lớn là 1366×768. Vùng đọc tin nhỏ thì phải cuộn liên tục, mệt hơn Zalo. | Thêm 1366×768 vào môi trường kiểm và UAT: vùng tin nhắn phải hiện được ít nhất 6 bong bóng. Gộp tiêu đề chat còn 2 dòng. Dòng chú thích dưới ô soạn chỉ hiện ở vài lần đầu, sau đó ẩn vào tooltip. | **Nên sửa** |
| 7 | MH-UI-10 #7 dòng 2–3; ảnh UAT 04 | Dòng hội thoại quá nhiều thứ. Trong "Của tôi" vẫn hiện avatar phụ trách (luôn là tôi). Chip SLA xanh "Còn 12 phút" hiện ở mọi dòng. Tên nick đang hiện thành dãy số "Zalo 476214826876503713". | Tôi cần liếc là biết ai chờ lâu. Rối quá thì mất tác dụng, và mỗi màn chỉ còn 7–8 khách thay vì 11. | "Của tôi": ẩn avatar phụ trách. Chip SLA chỉ hiện khi **sắp quá / quá hạn**, còn hạn thì không hiện. Tên nick hiện bằng tên đặt ("VCparts Sale 01"), không bao giờ hiện ID. Dòng 3 chỉ có khi có điều cần chú ý. | **Nên sửa** |
| 8 | MH-UI-03, MH-UI-07 #11 | Không có "Tắt thông báo hội thoại này" (Zalo có). Chỉ tắt được theo loại thông báo. | Tôi ở 5–6 nhóm nội bộ và nhóm với garage, nói cả ngày. Kêu liên tục thì tôi tắt tiếng luôn, rồi lỡ tin khách. | Thêm vào "⋯" và menu chuột phải: "Tắt thông báo 1 giờ / tới 8h sáng / luôn". Nhóm nội bộ mặc định chỉ báo khi có @tôi. | **Nên sửa** |
| 9 | MH-UI-04 #3, #6 | Nhận dạng biển số chỉ có dạng `29A-123.45` / `29A12345`. Không nói tin "Đang chờ nội dung" có tìm được không. | Khách gõ biển số đủ kiểu, xe máy còn có dạng `29-B1 123.45`. Không ra kết quả thì tôi lại nghĩ khách chưa từng nhắn. | Bỏ dấu, gạch, chấm, khoảng trắng, không phân biệt hoa thường khi so biển số và VIN. Nếu còn tin chưa lấy nội dung thì ghi dưới kết quả: "Còn {n} tin chưa lấy nội dung nên có thể thiếu kết quả." | **Nên sửa** |
| 10 | MH-UI-07 mở hội thoại, MH-UI-03 bấm thông báo | Không nói mở hội thoại thì con trỏ có tự vào ô soạn không. | Trên Zalo bấm vào là gõ luôn. Mỗi lần phải bấm thêm vào ô, một ngày vài trăm lần. | Mở hội thoại (bấm dòng, bấm thông báo, Alt+↓) thì con trỏ tự vào ô soạn. Thêm vào UAT-UI-53. | **Nên sửa** |
| 11 | §7.1 Alt+↑/↓, Alt+G, Alt+D | Trên máy Mac, Option+↑/↓ trong ô nhập là lệnh di chuyển con trỏ. Tài liệu chỉ nói chặn ký tự đặc biệt, không nói tới trường hợp này. | Đang gõ dở mà lỡ tay là nhảy sang khách khác, nháp của khách cũ nằm lại (ô soạn giữ nháp theo hội thoại). Gửi nhầm khách thì mất uy tín. | Khi ô soạn đang có chữ, Alt+↑/↓ không đổi hội thoại, hoặc hiện "Bạn đang soạn dở cho {tên}. Vẫn chuyển?". Khi đổi hội thoại mà còn nháp thì dòng đó có chữ "Nháp" màu đỏ như Zalo. | **Nên sửa** |
| 12 | §5.4 toast lỗi, MH-UI-03 "Gửi lỗi" | Gửi lỗi chỉ là toast đỏ 5 giây giữa trên, lẫn với các toast "Đã…". | Sáng nay lỗi mà tôi không để ý (xem 10:40). Khách chờ. | Gửi lỗi dùng thông báo nổi góc phải, **không tự tắt** tới khi tôi bấm "Mở hội thoại" hoặc ✕. Dòng hội thoại có ⚠ đỏ, và mục Hội thoại trên menu có chấm đỏ tới khi xử lý xong. | **Nên sửa** |
| 13 | §3.3, MH-UI-07 #10, Alt+D | Trạng thái Mới / Đang xử lý / Chờ khách / Đã xong hợp với CSKH hơn. Không rõ sale có phải bấm "Đã xong" từng khách không. | Khách sỉ nói chuyện cả tháng, không có "xong". Bắt bấm thì tôi thêm việc. Không bấm thì danh sách "Của tôi" đầy mãi. | Với Zalo cá nhân của sale: tự sang "Chờ khách" khi tôi trả lời, tự ẩn khỏi "cần xử lý" sau N ngày khách im. Nút "Đã xong" để tùy, không bắt buộc. | **Nên sửa** |
| 14 | UAT-UI-77, MH-UI-08 #8 | Trên điện thoại Enter là xuống dòng, mà nhiều dòng thì mỗi dòng thành một tin riêng. | Trên điện thoại tôi hay xuống dòng. Khách nhận 3–4 tin vụn. | Chưa gửi được một tin nhiều dòng thì trên điện thoại hỏi rõ trước khi gửi: "Tin có 3 dòng sẽ thành 3 tin. Gộp thành 1 dòng?" · "Gộp" / "Vẫn gửi 3 tin". | **Nên sửa** |
| 15 | §3.2 chip kênh | Zalo `#0068FF` và Fanpage `#3B5998` đều là xanh dương. Ở chip 11 px, liếc nhanh trên điện thoại ngoài nắng khó phân biệt. OA xanh lá, FB tím thì dễ. | Tôi chủ yếu dùng Zalo, thỉnh thoảng có khách Fanpage. Nhầm kênh thì trả lời sai giọng. | Giữ chữ trên chip. Cho Fanpage màu khác hẳn xanh dương, hoặc luôn có icon Messenger ngay cả ở cỡ `small`. Huy hiệu kênh ở góc avatar thì bật mặc định. | **Gợi ý** |
| 16 | MH-UI-08 #8, toast "Đã duyệt: … Tiện ích VClinks sẽ gửi trên Zalo Web." | Câu kỹ thuật ("tiện ích", "tab Zalo Web đang mở") hiện mãi dưới ô soạn và sau mỗi lần gửi. | Tôi không biết tab Zalo Web ở đâu (máy driver), đọc xong chỉ thêm lo. | Dưới ô soạn chỉ còn "Enter gửi · Shift+Enter xuống dòng · / mẫu câu". Toast gửi rút thành "Đang gửi…", gửi xong thì im, chỉ báo khi lỗi. | **Gợi ý** |
| 17 | §2.2 menu KD, UAT-UI-01 | KD thấy 7–8 mục: Việc cần làm, Yêu cầu hóa đơn, Khách hàng, Danh bạ kênh, Gợi ý gộp hồ sơ, Báo cáo, Mẫu câu, Thư viện media. | Tôi dùng Hội thoại 95% thời gian. "Gợi ý gộp hồ sơ" với "Danh bạ kênh" tôi không hiểu khác "Khách hàng" chỗ nào. | Laptop 1366 mặc định thu gọn menu. "Gợi ý gộp hồ sơ" chỉ hiện khi có gợi ý (badge). "Danh bạ kênh" đổi thành "Kết bạn Zalo". | **Gợi ý** |
| 18 | MH-UI-09 khối Thương mại | Có công nợ, báo giá mở, đơn gần nhất, nhưng không có ô tra giá / tồn nhanh. | Hỏi giá, tồn là việc tôi làm nhiều nhất trong khung chat. | Thêm ô "Tra hàng (mã OE, tên)" trên đầu panel, có kết quả giá theo khách + tồn, nút "Chèn vào tin". (Đã góp ở 03, nhắc lại vì panel chung nằm ở đây.) | **Gợi ý** |

## Câu hỏi của tôi

1. Tin tôi trả lời bằng app Zalo có dừng SLA và có tính là tôi đã trả lời trong báo cáo của chị Hương không? Nếu không, tôi phải làm gì khi đi đường?
2. Khách đã do tôi phụ trách mà tôi "Tạm vắng" hoặc "Ngoại tuyến" thì bao lâu sẽ bị chia cho người khác? Ai quyết định số phút đó? Tôi có được báo trước không?
3. Đọc tin trên VClinks có làm khách thấy "Đã xem" trên Zalo không? Có làm mất số chưa đọc trên app Zalo điện thoại của tôi không?
4. Tôi có bắt buộc bấm "Đã xong" cho từng khách không? Nếu không bấm thì có bị tính gì không?
5. Trên điện thoại có nhận thông báo khi khách nhắn không, hay phải tự mở trình duyệt để xem?
6. Bấm "Hiện" SĐT hay tìm SĐT đều ghi nhật ký. Khách của tôi thì tôi thấy SĐT luôn, đúng không? Tìm SĐT khách của tôi có bị ghi `search_phone` không?

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| UAT-UI-KD-01 | DL-01 phụ trách hội thoại nhóm DL-10, chip SLA đang chạy | Từ app Zalo điện thoại của nick công ty, trả lời vào nhóm | ≤ 1 phút tin hiện trên VClinks là tin của nick, nhãn "Gửi từ điện thoại". Chip SLA biến mất, trạng thái "Chờ khách". Không có thông báo quá SLA cho GS. |
| UAT-UI-KD-02 | DL-01 "Trực tuyến", phụ trách DL-08 | Không chạm VClinks 40 phút; khách DL-08 nhắn | DL-08 vẫn do DL-01 phụ trách. DL-01 nhận thông báo. GS chỉ nhận cảnh báo nếu quá SLA, không có phân công lại tự động. |
| UAT-UI-KD-03 | Chế độ "Ghi chú nội bộ" | Lưu ghi chú; đổi sang hội thoại khác rồi quay lại | Cả hai lần ô soạn đều ở "Trả lời khách". |
| UAT-UI-KD-04 | Chế độ "Trả lời khách" | Gõ "@Trần Thị Bình duyệt giá giúp em", Enter | Hỏi "Bạn đang nhắn cho khách. Chuyển thành ghi chú nội bộ?"; chưa gửi gì ra Zalo. |
| UAT-UI-KD-05 | Cửa sổ 1366×768, menu thu gọn, panel phải hiện | Mở hội thoại DL-10 | Thấy ít nhất 6 bong bóng; không có cuộn ngang; ô soạn không che tin cuối. |
| UAT-UI-KD-06 | Có tin chứa "30G-123.45" | Ctrl+K lần lượt gõ `30g12345`, `30G 123 45`, `30g-123.45` | Cả 3 lần đều ra tin đó, nhãn "Nhận dạng: Biển số". |
| UAT-UI-KD-07 | Có 3 hội thoại "Chưa trả lời" (khách nhắn cuối), đã đọc hết | Bấm "Chưa trả lời"; trả lời hội thoại đầu, Enter; nhấn phím "chưa trả lời kế tiếp" | Danh sách chỉ còn 3 hội thoại đó, chờ lâu nhất lên đầu. Sau khi gửi, mở hội thoại kế, con trỏ ở ô soạn. |
| UAT-UI-KD-08 | Nhóm nội bộ đã "Tắt thông báo · luôn" | Đồng nghiệp nhắn nhóm; sau đó nhắn "@Minh" | Lần 1 không có tiếng, không có thông báo (badge vẫn tăng). Lần 2 có thông báo. |
| UAT-UI-KD-09 | Điện thoại 390×844, đã đăng nhập hôm trước | Khách DL-10 nhắn; bấm thông báo trên điện thoại; gõ `/baohanh`; bấm "+" → STK; gửi | Thông báo điện thoại hiện tên hội thoại; bấm vào mở đúng hội thoại, không phải đăng nhập lại. Mẫu câu và STK gửi được. Tổng ≤ 5 thao tác. |
| UAT-UI-KD-10 | Tin gửi lỗi khi DL-01 đang ở hội thoại khác | Chờ 30 giây, không bấm gì | Thông báo nổi "Tin gửi {tên} bị lỗi" vẫn còn; dòng hội thoại có ⚠; menu Hội thoại có chấm đỏ. |
| UAT-UI-KD-11 | Đang gõ dở trong ô soạn hội thoại A (macOS) | Nhấn Option+↓ | Không chuyển hội thoại (hoặc hỏi xác nhận); con trỏ không nhảy sang khách khác. |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/00-P-KD.md) | — |
