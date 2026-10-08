# Góp ý 00 — P-TT (Dũng)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý vòng 1 của Dũng (P-TT, NV thị trường) cho đặc tả 00 Giao diện chung, tập trung màn điện thoại MH-UI-11 trong một buổi đi tuyến.
- 14 góp ý: 4 Chặn, 7 Nên sửa, 3 Gợi ý; kèm 6 câu hỏi và 10 kịch bản UAT đề xuất.
- Khen: thanh tab dưới và nút ⓘ mở thông tin khách vừa tầm ngón cái.
- Chặn 1–2: màn thông tin khách trên điện thoại mới là phác thảo (thiếu hạn công nợ, địa chỉ, ghi chú NVKD); mất mạng thì không xem được gì, không tải sẵn khách trên tuyến.
- Chặn 3: nhắn khi nick công ty đang tắt thì tin chỉ ghi "Đang chờ gửi", không có giờ, không hủy được, không báo khi đi hay lỗi.
- Chặn 4: báo lại cho NVKD chỉ có cách chuyển sang ghi chú nội bộ, chung nút gửi với tin cho khách, dễ nhầm.
- Kết quả xử lý: xem [00-xu-ly.md](00-xu-ly.md). Hồ sơ đã đóng, lưu trữ.

## Mục lục

- [Một buổi đi tuyến của tôi](#một-buổi-đi-tuyến-của-tôi)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Tôi đọc kỹ phần điện thoại (MH-UI-11) và mấy màn tôi sẽ đụng tới khi đi tuyến. Thanh tab ở dưới và nút ⓘ mở thông tin khách là đúng ý tôi: ngón cái với tới, khỏi phải lục menu. Nhưng cả tài liệu vẫn viết cho người ngồi máy tính ở văn phòng, mạng công ty. Còn tôi đứng ngoài nắng trước cửa garage, một tay cầm mũ bảo hiểm, 4G lúc có lúc mất. Ba chỗ làm tôi chưa dám bỏ Zalo riêng: xem khách khi mất mạng thì không thấy gì, tin hẹn giờ không biết đã tới khách chưa, và sau khi ghé xong không có chỗ báo lại cho NVKD trên điện thoại.

## Một buổi đi tuyến của tôi

| Giờ | Tôi làm gì | Màn hình | Thấy thế nào |
|---|---|---|---|
| 07:15 | Ở nhà mở VClinks trên điện thoại, xem hôm nay 10 garage nào. Đăng nhập Google, trình duyệt lại hiện Gmail cá nhân trước, phải chọn tài khoản khác. Xong lại mở VCdms, đăng nhập thêm lần nữa. | MH-UI-02 | Mệt. Tài liệu ghi phiên hết sau 12 giờ không dùng, tức là sáng nào cũng phải đăng nhập lại. |
| 07:20 | Muốn xem danh sách khách tuyến hôm nay. Trang mặc định của tôi là "Hội thoại · Của tôi" (R3). Tôi ít khi là người phụ trách hội thoại, nên danh sách gần như trống. | MH-UI-10, R3 | Không có chỗ nào ghi "khách tuyến hôm nay". Phải vào tab "Khách" rồi gõ tên từng garage. |
| 08:30 | Đỗ xe trước Garage Minh Phát. Mở 360: tab Khách → gõ "minh phat" → bấm → ⓘ. Trời nắng, chip "Đang xử lý", "Còn 12'" chữ 11 px gần như không đọc được. | MH-UI-11, MH-UI-09 | Công nợ thì thấy ngay, tốt. Nhưng "Khiếu nại mở: 0" và "5 tin gần nhất…" không nói hiện ra sao, bấm vào đâu. |
| 08:32 | Trong hẻm mất sóng, bấm lại thì trắng trang. | §6.3 NET-OFF | Tài liệu nói "nội dung đã tải vẫn xem được", nhưng nếu tôi chưa mở khách đó lúc có mạng thì chẳng có gì. |
| 10:10 | Garage Hòa An nhắn hỏi mấy giờ tôi tới. Mở hội thoại, gõ "15 phút nữa em tới", bấm ➤. Lần đầu hiện hộp xác nhận, bấm "Gửi". Bong bóng hiện "Đang chờ gửi". | MH-UI-08, MH-UI-07 | Tôi lên xe đi luôn. Không biết tin tới khách chưa. Nếu nó nằm chờ 30 phút mới đi thì khách nghĩ tôi nói dối. |
| 10:12 | Đang gõ thì mất sóng, nút gửi mờ đi. | §6.3, MH-UI-08 | Tốt vì chữ không mất. Nhưng có mạng lại thì tôi phải nhớ mở ra bấm gửi, mà lúc đó đang chạy xe. |
| 11:00 | Ghé xong Minh Phát. Anh Tuấn phàn nàn má phanh giao thiếu 2 bộ, hẹn thứ 6 lấy thêm. Tôi muốn báo lại anh An (NVKD). | MH-UI-08 "Ghi chú nội bộ" | Chỉ có cách mở hội thoại, chuyển "Trả lời khách" sang "Ghi chú nội bộ" rồi gõ. Nút chuyển nhỏ, nằm sát ô soạn. Tôi sợ bấm nhầm là gửi thẳng cho khách câu "khách này khó đòi nợ". |
| 14:00 | Điện thoại rung, là thông báo VClinks. Bấm vào thì mở khung chat, bấm ⓘ mới thấy khách. | MH-UI-03 | Tôi cần xem khách trước, đọc tin sau. |
| 17:00 | Cuối ngày muốn xem mấy tin mình gửi hôm nay đã đi hết chưa. | – | Không có chỗ xem. |

**Đếm thao tác** (theo đặc tả hiện tại, điện thoại 390 px):

| Việc | Đường đi | Số lần bấm |
|---|---|---|
| Mở 360 khách từ thông báo | Chuông → dòng thông báo → khung chat → ⓘ | 4 (nếu mở từ thông báo của điện thoại thì 3) |
| Nhắn "15 phút nữa em tới" | Tab Hội thoại → 🔍 → gõ tên → bấm hội thoại → bấm ô soạn → gõ 20 ký tự → ➤ (+ "Gửi" lần đầu) | 5–6 lần bấm, gõ tay 2 lần |
| Xem công nợ khách (chưa mở gì) | Tab Khách → ô tìm → gõ tên → bấm khách | 3 lần bấm + gõ tên. Từ khung chat: 1 (ⓘ) |

## Góp ý

| # | Màn/mục (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-UI-11 (thông tin khách), MH-UI-09, TT-02 | Màn thông tin khách trên điện thoại mới là phác thảo. "Khiếu nại mở: 0" chỉ có số, "5 tin gần nhất…" không nói hiện gì. Thiếu hạn công nợ, giờ lấy số VCsales, địa chỉ, ghi chú của NVKD. Bản máy tính (MH-UI-09) thì lại không có dòng khiếu nại. | Tôi có 30 giây trước khi bước vào garage. Nếu khách đang khiếu nại mà tôi không biết nội dung thì vào là bị mắng. Số công nợ không ghi giờ lấy thì tôi không dám nhắc nợ. | Viết đủ bảng thành phần cho màn này, theo thứ tự từ trên xuống: (1) khiếu nại mở, ghi rõ nội dung 1 dòng và ngày; (2) công nợ + hạn + "VCsales · 08:14"; (3) 5 tin gần nhất, mỗi tin 1 dòng, bấm vào mở khung chat đúng chỗ; (4) ghi chú gần nhất của NVKD; (5) địa chỉ + nút "Chỉ đường". Ẩn tag, chip phễu, danh sách kênh trên điện thoại. | **Chặn** |
| 2 | §6.3 NET-OFF, MH-UI-11 | Mất mạng thì chỉ xem được thứ đã tải. Không có cách tải sẵn thông tin khách trên tuyến. | Hẻm, tầng hầm, garage mái tôn đều mất sóng. Đúng lúc cần xem khách thì trắng trang. | Có nút "Tải sẵn khách tuyến hôm nay" (hoặc tự tải khi mở app lúc có mạng): lưu bản 360 rút gọn ở mục #1. Khi mất mạng thì hiện bản lưu kèm dòng "Bản lưu lúc 07:20, chưa cập nhật". | **Chặn** |
| 3 | MH-UI-08 (vùng chặn "Extension không trực tuyến"), MH-UI-07 (trạng thái gửi), TT-04 | Tôi nhắn từ điện thoại mà nick công ty đang tắt thì tin vẫn nhận, chỉ ghi "Đang chờ gửi". Không có giờ, không có cách hủy, không có gì báo khi tin đi hoặc lỗi. | Tin hẹn giờ như "15 phút nữa em tới" mà tới khách sau 40 phút thì hỏng việc. Tôi đang chạy xe, không mở ra canh được. | (a) Trước khi bấm gửi, nếu nick không trực tuyến thì hiện to ngay trên ô soạn: "Nick {tên} đang tắt, tin sẽ chờ". (b) Tin đang chờ có nút "Hủy tin này". (c) Cho tôi chọn "Bỏ nếu chưa gửi được sau 10 phút". (d) Tin gửi lỗi, hoặc chờ quá 5 phút, thì báo về chuông và rung điện thoại. | **Chặn** |
| 4 | MH-UI-08 #1 "Trả lời khách / Ghi chú nội bộ", TT-03 | Trên điện thoại, cách duy nhất để báo lại cho NVKD là chuyển ô soạn sang "Ghi chú nội bộ". Chỉ khác màu nền, và dùng chung nút ➤ với tin gửi khách. | Màn nhỏ, bấm một tay, đứng ngoài nắng rất dễ nhầm. Ghi chú kiểu "khách khó đòi nợ" mà lỡ gửi cho khách là mất khách. | Trên điện thoại, tách hẳn nút "Báo lại cho NVKD" ra màn thông tin khách (ô chữ riêng, gắn sẵn @NVKD phụ trách, có mẫu nhanh: "Đã ghé", "Khách khiếu nại", "Hẹn lấy hàng"). Nếu vẫn dùng ô soạn thì chế độ ghi chú phải có dải vàng to "KHÁCH KHÔNG THẤY" và nút "Lưu ghi chú" có chữ, khác hẳn nút ➤. | **Chặn** |
| 5 | MH-UI-02, §9 câu hỏi 2 | Phiên hết sau 12 giờ không dùng. Trên điện thoại, đăng nhập Google hay chọn nhầm Gmail cá nhân. Ô "Dán token" thì trên điện thoại không dùng được. | Tôi đã phải đăng nhập VCdms. Sáng nào cũng thêm một lần đăng nhập nữa thì tôi sẽ không mở VClinks. | Trên điện thoại riêng thì giữ đăng nhập lâu (ví dụ 30 ngày), khóa lại bằng vân tay hoặc mã của máy nếu cần. Nút Google gợi ý sẵn tài khoản @vcprosperous.com. Ẩn phần token trên điện thoại. Mở từ VCdms thì đăng nhập luôn, không hỏi lại. | **Nên sửa** |
| 6 | MH-UI-08 #6, §6.3, phiên hết hạn | Nháp chỉ ghi "giữ khi chuyển hội thoại". Chưa nói nháp có còn không khi trình duyệt điện thoại tự tải lại tab, khi phiên hết hạn phải đăng nhập lại, hoặc khi tôi chuyển sang VCdms rồi quay về. | Điện thoại hay tự tải lại tab khi tôi mở app khác. Gõ dở một tin dài mà mất là tôi bỏ luôn. | Ghi rõ: nháp còn sau khi tải lại trang, đăng nhập lại và mở lại trình duyệt. Có mạng lại thì hiện nhắc "Bạn có 1 tin chưa gửi cho {khách}" và nút "Gửi ngay". | **Nên sửa** |
| 7 | R3, MH-UI-10 #2, MH-UI-11 thanh tab | Trang mặc định của TT là "Hội thoại · Của tôi". Nhưng khách là của NVKD, còn tôi phụ trách theo tuyến, nên "Của tôi" gần như trống. | Việc đầu tiên mỗi sáng của tôi là xem "hôm nay ghé ai", không phải đọc tin. | Với TT, trang mặc định trên điện thoại là "Khách tuyến hôm nay" (lấy từ VCdms): mỗi dòng có tên, địa chỉ, chấm đỏ nếu có khiếu nại hoặc nợ quá hạn, bấm vào mở thẳng màn thông tin khách. Thêm chế độ xem "Khách trên tuyến" trong danh sách hội thoại. | **Nên sửa** |
| 8 | MH-UI-03 (bấm vào thông báo) | Bấm thông báo chỉ mở hội thoại. Muốn xem khách thì phải bấm thêm ⓘ. | Tôi mở thông báo để biết khách là ai, đang cần gì, rồi mới đọc tin. | Trên điện thoại, dòng thông báo có thêm nút nhỏ "Xem khách" mở thẳng màn thông tin khách. Như vậy chỉ còn 2 lần bấm thay vì 4. | **Nên sửa** |
| 9 | §3.7 chữ, UI-TP-01 chip 11 px, §3.5 giờ 12 px, MH-UI-11 quy tắc 7 | Quy tắc "chữ ≥ 14 px" chỉ áp cho nội dung. Chip trạng thái, SLA, kênh, giờ, chữ phụ vẫn 11–12 px. | Đứng ngoài nắng, màn chỉnh sáng tối đa, chữ 11 px xám nhạt trên nền trắng là không đọc được. | Trên điện thoại: chip và chữ phụ tối thiểu 13 px, chữ phụ không dùng xám nhạt `--muted` cho số tiền và hạn. Số công nợ in đậm 16 px. Thêm bước UAT đọc ngoài trời. | **Nên sửa** |
| 10 | MH-UI-11 (header, nút ←, ✕), MH-UI-07 #1 | Nút quay lại ← và nút ✕ đóng thông tin khách đều ở góc trên bên trái. Chuông và 🔍 ở góc trên bên phải. | Cầm máy một tay (6,1 inch), ngón cái không với tới góc trên. Tôi phải dùng tay kia, mà tay kia đang cầm mũ hoặc sổ. | Cho vuốt từ mép trái để quay lại, vuốt xuống để đóng thông tin khách. Nút ⓘ để ở dưới, cạnh ô soạn, hoặc chạm vào tên khách trên tiêu đề để mở. | **Nên sửa** |
| 11 | MH-UI-08 (mẫu câu trên điện thoại), MH-UI-11 quy tắc 4 | Trên điện thoại, mẫu câu nằm trong nút "+" hoặc phải gõ "/". Gõ "/" trên bàn phím điện thoại phải đổi sang bàn phím ký hiệu. | Ngày nào tôi cũng nhắn 10 lần "Em đang tới, khoảng … phút nữa", "Em tới rồi, anh ra giúp em". | Hiện 3 mẫu hay dùng nhất thành nút bấm ngay trên ô soạn khi ô còn trống. Mẫu "Em tới sau {n} phút" có sẵn nút chọn 5 / 10 / 15 / 30. | **Gợi ý** |
| 12 | MH-UI-11 quy tắc 6 | "Trang này dùng trên máy tính" áp cho "bảng lớn", nhưng không ghi trang nào. Tôi sợ "Khách hàng", "Việc", "Mở 360 đầy đủ" cũng rơi vào đó. | Nếu bấm "Mở 360 đầy đủ" mà ra "hãy dùng máy tính" thì nút đó vô dụng với tôi. | Liệt kê rõ các trang phải chạy trên điện thoại cho TT: Hội thoại, Khách (tìm và xem), thông tin khách, Việc, Thông báo. "Mở 360 đầy đủ" trên điện thoại mở bản dọc, không ra trang chặn. | **Nên sửa** |
| 13 | §7.4 hiệu năng | Mục tiêu "≤ 3 giây" chỉ đo trên máy văn phòng, mạng công ty. | 4G ở ngoại thành chậm. Nếu 15 giây mới ra thì tôi gọi điện hỏi NVKD cho nhanh. | Thêm mục tiêu cho điện thoại tầm trung, mạng 4G yếu: mở thông tin khách ≤ 5 giây; mở lại lần hai (đã có bản lưu) ≤ 1 giây. | **Gợi ý** |
| 14 | §6.3 RT-BACK, MH-UI-07 | Có mạng lại thì chỉ hiện "Đã kết nối lại" trong 3 giây. Không nói gì về tin tôi gửi hỏng hay tin đang chờ lúc mất mạng. | Lúc đó tôi đang chạy xe, không nhìn thấy dải 3 giây. | Có mạng lại mà còn tin chưa gửi hoặc tin lỗi thì để lại một dòng trong chuông ("1 tin chưa gửi cho Garage Hòa An"), không biến mất sau 3 giây. | **Gợi ý** |

## Câu hỏi của tôi

1. Tôi nhắn khách thì tin đi từ nick nào? Nick Zalo của NVKD phụ trách, nick chung của VCdms, hay OA? Khách có biết đó là Dũng không (dòng "Gửi bởi Dũng" chỉ bên mình thấy)?
2. Garage trên tuyến của tôi nhắn tin thì tôi có nhận thông báo không? Hay chỉ NVKD nhận (MH-UI-03 ghi "Tin mới" gửi cho người phụ trách)? Tôi chỉ muốn nhận tin của khách mà hôm nay tôi ghé.
3. Trên điện thoại, khi tôi đang mở VCdms hoặc tắt màn hình thì VClinks có rung, có kêu không? Hay chỉ báo khi tôi đang mở tab VClinks?
4. Báo lại sau ghé thăm (TT-03) làm trên VCdms hay trên VClinks? Nếu làm trên VCdms thì bao lâu ghi chú đó hiện ra trong thông tin khách để NVKD thấy?
5. Nút 📞 gọi khách mỗi lần bấm đều ghi nhật ký. Vậy tôi có được xem SĐT đầy đủ của khách trên tuyến không, hay phải bấm "Hiện" mỗi lần?
6. Tôi đang ở trạng thái "Tạm vắng" (15 phút không chạm) thì có bị ảnh hưởng gì không? Đi tuyến thì cả buổi tôi không chạm vào VClinks.

## Kịch bản UAT tôi muốn thêm

Làm trên **điện thoại thật** (1 máy Android tầm trung màn 6,1–6,5 inch, 1 iPhone màn 6,1 inch), không chỉ DevTools.

| Mã đề xuất | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| UAT-UI-TT-01 | Điện thoại thật 360×800, đăng nhập TT, khách DL-08 trong tuyến | Từ trang mặc định, mở thông tin khách DL-08. Đếm số lần bấm, bấm bằng ngón cái tay phải, không dùng tay kia | ≤ 3 lần bấm; thấy khiếu nại mở, công nợ + hạn + giờ lấy, 5 tin gần nhất mà không phải cuộn quá 1 lần |
| UAT-UI-TT-02 | Như trên, mạng có | Mở thông tin khách DL-08, rồi bật chế độ máy bay, đóng và mở lại trình duyệt, mở lại khách | Vẫn thấy bản lưu, có dòng "Bản lưu lúc {HH:mm}"; không trắng trang |
| UAT-UI-TT-03 | Chrome DevTools giả lập mạng "Slow 3G" trên điện thoại thật | Mở thông tin khách chưa tải trước đó | Hiện khung chờ ngay; có số liệu ≤ 5 giây; sau 10 giây có "Đang tải lâu hơn bình thường…" |
| UAT-UI-TT-04 | Hội thoại nhóm DL-10 | Gõ "UAT TT 04 hẹn 15 phút", bật chế độ máy bay giữa lúc gõ, bấm ➤, tắt chế độ máy bay sau 1 phút | Chữ không mất; khi mất mạng nút gửi khóa; có mạng lại thì có nhắc "1 tin chưa gửi"; gửi thành công hiện "Đã gửi" |
| UAT-UI-TT-05 | Nick Zalo của nhóm DL-10 tắt tiện ích | Gửi "UAT TT 05" từ điện thoại | Trước khi gửi có cảnh báo nick đang tắt; tin "Đang chờ gửi" có nút "Hủy"; bấm "Hủy" thì tin không bao giờ tới Zalo |
| UAT-UI-TT-06 | Hội thoại nhóm DL-10, điện thoại 390 px | Chuyển sang ghi chú nội bộ, gõ "UAT TT 06 nội bộ", lưu | Ghi chú không xuất hiện trên Zalo; nhìn màn hình phân biệt rõ đang ở chế độ ghi chú (dải "Khách không thấy"); NVKD phụ trách nhận thông báo @nhắc |
| UAT-UI-TT-07 | Điện thoại thật, độ sáng tối đa, đứng ngoài trời nắng buổi trưa | Đọc chip trạng thái, SLA, số công nợ, giờ lấy VCsales trên màn thông tin khách | Người thử đọc đúng cả 4 thông tin, cầm máy cách mắt 30 cm |
| UAT-UI-TT-08 | Gõ dở tin 2 dòng trong hội thoại DL-10 | Chuyển sang app khác 10 phút cho trình duyệt tự tải lại tab; hoặc để phiên hết hạn rồi đăng nhập lại | Quay về đúng hội thoại, nháp còn nguyên |
| UAT-UI-TT-09 | Điện thoại khóa màn hình, đã cho phép thông báo | Khách trong tuyến nhắn tin | Điện thoại rung/kêu, thông báo không có nội dung tin; bấm "Xem khách" mở thẳng màn thông tin khách |
| UAT-UI-TT-10 | Đăng nhập VClinks trên điện thoại, không dùng 24 giờ | Mở lại | Theo quyết định ở góp ý #5: không phải đăng nhập lại (hoặc chỉ mở khóa bằng vân tay) |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/00-P-TT.md) | — |
