# Góp ý 00 — P-CS (Lan)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý vòng 1 của Lan (P-CS, CSKH) cho đặc tả 00 Giao diện chung, đi qua một ca trực thật 20 hội thoại OA/Fanpage xen kẽ.
- 17 góp ý: 4 Chặn, 11 Nên sửa, 2 Gợi ý; kèm 6 câu hỏi và 10 kịch bản UAT đề xuất.
- Khen: giữ nháp theo từng hội thoại, Alt+↓ sang hội thoại kế tiếp, hộp hỏi lại khi người khác vừa trả lời khách.
- Chặn 1–2: CSKH không thấy hàng "Chưa phân công", không có lệnh nhận hội thoại, không rõ trực ở `/conversations` hay `/cskh`; danh sách và thông báo không báo **cửa sổ gửi** OA/Fanpage.
- Chặn 3–4: ghi chú nội bộ chỉ khác tin gửi khách bằng nút gạt, dễ gửi nhầm cho khách; tìm theo SĐT trả về rỗng vì phạm vi xem của CSKH quá hẹp.
- Nên sửa đáng chú ý: màu kênh trùng màu cảnh báo; CSKH không thấy đơn gần nhất; panel thiếu "ai vừa nói chuyện với khách".
- Kết quả xử lý: xem [00-xu-ly.md](00-xu-ly.md). Hồ sơ đã đóng, lưu trữ.

## Mục lục

- [Một ca trực của tôi](#một-ca-trực-của-tôi)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Khung chung nhìn gọn và quen tay: danh sách bên trái, chat ở giữa, thông tin khách bên phải giống Zalo. Tôi rất thích ba thứ: giữ nháp theo từng hội thoại, Alt+↓ để sang hội thoại kế tiếp, và hộp hỏi lại khi người khác vừa trả lời khách. Nhưng khi đặt vào một ca trực thật (20 hội thoại cùng lúc, OA và Fanpage xen kẽ), tôi vấp bốn chỗ lớn. Một: danh sách chuẩn không cho CSKH thấy hàng "Chưa phân công", nên tôi không biết nhận khách mới ở đâu. Hai: danh sách và thông báo không nói gì về **cửa sổ gửi**, trong khi đó là nỗi sợ số một của tôi. Ba: ghi chú nội bộ và tin gửi khách chỉ khác nhau một nút gạt, rất dễ gửi nhầm câu nói xấu khách cho chính khách. Bốn: tìm theo SĐT gần như vô dụng với tôi vì phạm vi xem của CSKH quá hẹp. Màu kênh cũng chưa ổn: màu cam, đỏ, tím vừa dùng cho kênh vừa dùng cho cảnh báo.

## Một ca trực của tôi

**07:55 — Đăng nhập (MH-UI-02, MH-UI-01).** Theo R3 tôi vào thẳng `/conversations?view=mine`. Menu của tôi có 10 mục (Hội thoại, Bình luận, Việc cần làm, Ticket, Khách hàng, Chiến dịch & ZNS, Tự động hóa, Báo cáo, Mẫu câu, Thư viện media) nhưng **không có "Hộp thư CSKH"** (`/cskh`) mà file 04 mô tả. Tôi không biết mình nên trực ở `/conversations` hay `/cskh`.

**08:00 — Nhận khách tồn đêm qua (MH-UI-10).** Theo bảng thành phần #2, chế độ "Chưa phân công" chỉ dành cho GS, GD, KD. CSKH chỉ có "Của tôi". Tôi không thấy 6 khách nhắn OA lúc 21h tối qua, trừ khi giám sát phân công. Menu "Phụ trách ▾" trên tiêu đề (MH-UI-07 #8) cũng chỉ cho **KD** "Nhận hội thoại này".

**08:30 — Cao điểm đầu (MH-UI-10, MH-UI-03).** 12 hội thoại "Của tôi". Dòng 3 của mỗi hội thoại có chip trạng thái, chip SLA, avatar. Chỗ nào cũng xanh "Còn 25 phút", "Còn 1 giờ 10 phút". Mắt tôi chỉ cần biết cái nào **đỏ hoặc vàng**. Còn cửa sổ gửi OA (48h miễn phí / 7 ngày) và Fanpage (24h) thì **không có trên dòng nào**. Muốn biết phải mở từng hội thoại xem dải cảnh báo.

**09:15 — Chuông kêu liên tục (MH-UI-03).** Mỗi hội thoại của tôi có tin là một tiếng "ting" và một dòng thông báo. 20 hội thoại thì chuông kêu cả buổi. Tin mới đã có badge ở danh sách rồi. Thông báo "Sắp quá SLA" lẫn giữa hàng chục dòng "Tin mới", tôi không lọc được theo loại trong Drawer (chỉ có Tất cả / Chưa đọc / @Nhắc tôi).

**10:00 — Khách nóng tính trên Fanpage (MH-UI-07, MH-UI-08).** "Shop làm ăn kiểu gì, 3 ngày chưa thấy hàng". Tôi muốn nhắn sale Nam. Tôi bấm Alt+G, gõ "@Nam khách này nóng, anh gọi giúp em". Lưu xong, ô soạn **giữ chế độ nào**? Tài liệu không nói. Lần sau tôi gõ tin trả lời khách mà ô vẫn đang ở chế độ ghi chú thì khách không nhận được gì. Ngược lại, nếu tôi quên bấm Alt+G mà gõ "@Nam khách này nóng" rồi Enter thì câu đó đi thẳng tới khách. Lần gửi đầu có hộp xác nhận, nhưng từ lần thứ hai thì không hỏi nữa.

**10:20 — Chuyển giữa hội thoại (MH-UI-10, §7.1).** Alt+↓ rất tiện. Nhưng danh sách sắp theo "Ưu tiên xử lý" và tự nhảy khi có tin mới, nên Alt+↓ lúc thì bỏ qua một hội thoại, lúc thì quay lại hội thoại vừa xem. Tôi cần một phím "sang hội thoại **gấp nhất**" chứ không phải "hội thoại bên dưới".

**11:00 — Khách gọi hotline, đọc SĐT (MH-UI-04).** Tôi bấm Ctrl+K, dán `0912.345.678`. Nếu khách không có ticket giao cho tôi thì kết quả là "Không tìm thấy kết quả … trong phạm vi bạn được xem". Tôi không biết khách này có tồn tại không, ai phụ trách, có ticket nào đang mở không. Trong khi đó khách đang chờ trên điện thoại.

**11:30 — Hai người cùng trả lời (MH-UI-07 dải ưu tiên 4).** Dải "Đang được Minh trả lời" có nút ✕ ẩn 5 phút. Tôi bấm ✕ cho đỡ vướng, rồi quên luôn là Minh đang ở đó.

**13:30 — Gửi lỗi khi đã sang hội thoại khác (MH-UI-07 trạng thái gửi, §5.4).** Mạng chậm. Tin gửi hội thoại A bị lỗi trong lúc tôi đang ở hội thoại B. Toast đỏ hiện 5 giây ở B với câu "Không gửi được tin", không nói tin nào, hội thoại nào, làm gì tiếp. Dòng của A trong danh sách không có dấu hiệu gì.

**14:30 — Khách hỏi đơn (MH-UI-09).** Panel phải của CSKH **không có khối Thương mại**, nên không có "Đơn gần nhất: DH-2026-0456 · Đang giao". Việc hằng ngày của tôi là trả lời "đơn đâu rồi" mà tôi không thấy trạng thái đơn.

**16:00 — Khách sắp hết 24h Fanpage (MH-UI-07 dải ưu tiên 3).** Chỉ khi mở đúng hội thoại tôi mới thấy "Còn 20 phút để trả lời trong …". Không có thông báo, không có chế độ lọc "Sắp hết cửa sổ gửi".

**17:25 — Cuối ca (MH-UI-05).** Tôi chuyển "Ngoại tuyến". Còn 3 hội thoại "Đang xử lý" chưa xong. Tài liệu không nói khi tôi ngoại tuyến thì các hội thoại "Của tôi" có được chia cho ca sau không.

## Góp ý

| # | Màn/mục (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-UI-10 #2 · MH-UI-07 #8 · §2.2 menu · 04 MH-OA-02 | CSKH không có chế độ "Chưa phân công" và không có lệnh "Nhận hội thoại này". Menu cũng không có "Hộp thư CSKH" (`/cskh`) mà file 04 dùng. Tôi không biết nhận khách mới ở đâu. | Đầu ca có 5–10 khách tồn từ tối qua. Nếu phải chờ giám sát phân công thì khách chờ thêm 30 phút. | Chốt **một** chỗ trực cho CSKH. Nếu là `/conversations`: cho CS thấy "Chưa phân công" (tên thống nhất với "Chưa nhận" của 04) trong phạm vi kênh OA/Fanpage mình trực. Thêm nút "Nhận" ngay trên dòng (rê chuột) và phím tắt; "Nhận hội thoại này" mở cho cả CS. Nếu giữ `/cskh`, đưa nó vào cây menu §2 và bảng route. | **Chặn** |
| 2 | MH-UI-10 dòng 3 · MH-UI-03 loại thông báo · #5 Sắp xếp | Danh sách, sắp xếp và thông báo chỉ biết SLA, không biết **cửa sổ gửi** (OA 48h/7 ngày, Fanpage 24h). Tôi chỉ thấy cửa sổ khi đã mở hội thoại. | Lỡ cửa sổ là không nhắn lại được khách, hoặc bị tính phí. Đây là điều tôi sợ nhất. | Thêm vào khung chung: (a) chip cửa sổ trên dòng 3, **chỉ hiện khi sắp hết** (vd. "Còn 40′ nhắn được"); (b) loại thông báo "Sắp hết cửa sổ gửi" (người phụ trách, không tắt được); (c) "Ưu tiên xử lý" xếp cả hội thoại sắp hết cửa sổ; (d) bộ lọc nhanh "Sắp hết cửa sổ". Kênh nào không có cửa sổ (Zalo cá nhân) thì không hiện. | **Chặn** |
| 3 | MH-UI-08 #1 · ghi chú nội bộ MH-UI-07 | Chế độ "Ghi chú nội bộ" chỉ khác bằng nút gạt, màu nền ô nhập và chữ trên nút. Chưa nói sau khi lưu ghi chú thì ô soạn **ở lại** chế độ ghi chú hay **về** "Trả lời khách". Gõ nhầm chế độ thì câu nội bộ đi thẳng tới khách, và từ lần gửi thứ hai trở đi không còn hộp xác nhận. | Lúc 20 hội thoại, tôi gõ rất nhanh. Câu "@Nam khách này khó tính" mà tới tay khách là mất khách, lên group bóc phốt. | (a) Lưu ghi chú xong thì **tự về** "Trả lời khách". Chế độ không giữ khi chuyển hội thoại. (b) Ở chế độ trả lời khách, nếu tin có `@tên đồng nghiệp` (kênh 1-1 OA/Fanpage không có @) thì hỏi: "Tin này có @{tên}. Bạn muốn lưu thành ghi chú nội bộ?" [Lưu ghi chú] [Vẫn gửi khách]. (c) Nút gửi ghi rõ chữ "Gửi khách" / "Lưu ghi chú", không chỉ icon. (d) Viền ô nhập ở chế độ ghi chú dày, có dải chữ "🔒 Khách không thấy" ngay trên ô. | **Chặn** |
| 4 | MH-UI-04 · Quyền · §1.6 phạm vi CS | Phạm vi CS là "hội thoại gắn ticket được giao". Vì vậy khi khách gọi hotline đọc SĐT, tìm kiếm trả về rỗng. Tôi không phân biệt được "khách chưa từng liên hệ" với "khách có nhưng tôi không được xem". | Khách gọi hotline hỏi bảo hành hoặc đơn mỗi ngày. Tôi phải biết ngay khách là ai, ai phụ trách, có ticket nào đang mở. | Khi tìm **đúng đủ SĐT** (đã ghi nhật ký `search_phone`), CS thấy một **thẻ tối thiểu**: tên khách, kênh đã liên kết, người phụ trách, ticket đang mở, **không** có nội dung chat hay thương mại. Có nút "Tạo ticket" / "Báo người phụ trách". Nhận dạng SĐT phải chấp nhận dấu chấm, cách, gạch (`0912.345.678`, `+84 912 345 678`). | **Chặn** |
| 5 | MH-UI-09 Quyền (CS không có khối Thương mại) | CS không thấy trạng thái đơn gần nhất, trong khi "hỏi tình trạng đơn" là việc chính của tôi. | "Đơn má phanh hôm thứ 2 đâu rồi em?" gặp hàng chục lần một ngày. | Tách khối Thương mại: CS thấy "Đơn gần nhất" (số đơn, ngày, trạng thái giao, mã vận đơn) và báo giá đang mở (chỉ số và trạng thái), **không** thấy công nợ, hạng, giá. | Nên sửa |
| 6 | MH-UI-09 panel rút gọn | Panel không có "ai vừa nói chuyện với khách, ở kênh nào". Chip "Kênh: [Zalo][OA][Fanpage]" bấm được nhưng CS mở hội thoại Zalo cá nhân của sale sẽ ra 403. | Khách mở đầu bằng "hôm qua anh Nam nói…". Tôi cần biết trước khi trả lời để không nói ngược sale. | Thêm khối "Liên lạc gần đây" (3 dòng: kênh, người, giờ, không cần nội dung). Chip kênh ngoài phạm vi thì hiện nhưng khóa, tooltip "Hội thoại của {Nam} — bạn không xem được". | Nên sửa |
| 7 | MH-UI-03 thông báo · MH-UI-05 #10 | Mỗi tin mới của hội thoại mình phụ trách là một thông báo có âm thanh. Trực 20 hội thoại thì chuông kêu liên tục, và thông báo SLA bị chìm. Drawer không lọc được theo loại. | Sau một giờ tôi sẽ tắt hết âm thanh, rồi lỡ luôn thông báo "Quá SLA". | (a) Tuỳ chọn "Tin mới: chỉ báo khi tôi đang ở trang khác / hội thoại chờ > {n} phút". (b) Hai mức âm: nhẹ cho tin mới, rõ cho SLA và cửa sổ gửi (trả lời câu hỏi mở 11: đồng ý hai âm khác nhau). (c) Tab lọc thứ tư "Gấp" (SLA, cửa sổ gửi, gửi lỗi). (d) Nếu có "Chưa phân công" cho CS thì báo **số khách đang chờ nhận** một lần mỗi 5 phút, không báo từng tin. | Nên sửa |
| 8 | §3.4 SLA · UI-TP-03 · MH-UI-10 dòng 3 | Chip SLA xanh "Còn {n} phút" hiện trên mọi dòng, gây nhiễu. Chip "Sắp quá · còn 3 phút" quá dài cho cột 344 px khi dòng còn phải chứa trạng thái, người phụ trách và (theo #2) cửa sổ gửi. Chip cũng không nói đang là hạn phản hồi đầu hay phản hồi tiếp theo. | Tôi cần nhìn lướt 20 dòng trong 2 giây, chỉ tìm màu vàng và đỏ. | Trên **danh sách**: chỉ hiện chip SLA khi Sắp quá / Quá hạn, dạng ngắn "⏰ 3′" / "Quá 8′". Trên tiêu đề khung chat giữ đủ chữ. Tooltip ghi rõ "Hạn phản hồi đầu" / "Hạn phản hồi tiếp". | Nên sửa |
| 9 | §3.2 màu kênh vs §3.1 quy tắc màu · 04 §3.2 màu cửa sổ | Quy tắc nói vàng và đỏ chỉ dành cho cảnh báo, nhưng chip "Email" màu đỏ `#C5221F` và "Bình luận" màu cam `#C2410C`. Tím `#6B4FBB` của FB trùng tím "Chờ khách" và tím Z2 (có phí) của 04. Xanh lá OA `#087A4D` gần xanh ngọc Web `#0E7C86` và gần chip SLA "Còn hạn" xanh lá. Fanpage `#3B5998` và Zalo `#0068FF` vẫn đều là xanh dương. | Trực OA + Fanpage + Bình luận cùng lúc, tôi nhìn chip "Bình luận" cam mà tưởng "sắp quá hạn". | Chip kênh dùng **kiểu viền/nhạt** (chữ màu, nền nhạt) để tách khỏi chip cảnh báo dạng nền đặc. Đổi Email khỏi đỏ, Bình luận khỏi cam. Tránh tím cho trạng thái hội thoại. Luôn có icon kênh ở cỡ `small` trên danh sách (không chỉ ở cỡ `default`), để phân biệt bằng hình chứ không chỉ bằng màu. | Nên sửa |
| 10 | MH-UI-07 dải ưu tiên 4 · MH-UI-08 chống trùng · câu hỏi mở 7 | "Đang được … trả lời" có nút ✕ ẩn 5 phút. Bấm cho đỡ vướng rồi quên. Tôi **không** muốn khóa, nhưng cần nhắc chắc hơn. | Hai người trả lời hai câu khác nhau, khách chụp màn hình gửi lại. | Trả lời câu hỏi mở 7: **cảnh báo, không khóa**. Bỏ nút ✕. Dải tự hết khi người kia ngừng gõ 30 giây. Nếu người kia là **người phụ trách** và tôi không phải thì nút gửi đổi thành "Gửi (đang có {tên} trả lời)" và luôn hỏi lại, kể cả khi đã xác nhận lần đầu. | Nên sửa |
| 11 | MH-UI-10 Alt+↓ · §7.1 · "Thứ tự và cập nhật" | Alt+↓ đi theo thứ tự danh sách, mà danh sách tự sắp lại khi có tin mới, nên có khi bỏ sót hoặc lặp. Không có phím "sang hội thoại gấp nhất". | Mỗi lần chuyển mất thêm 2–3 giây dò tìm. Với 20 hội thoại, cả ca mất rất nhiều thời gian. | Thêm phím (vd. Alt+U) "Mở hội thoại gấp nhất" theo thứ tự Ưu tiên xử lý (quá SLA / sắp hết cửa sổ → sắp quá → chưa trả lời). Khi đang dùng Alt+↓, giữ **thứ tự đóng băng** tới lúc người dùng dừng 5 giây. | Nên sửa |
| 12 | MH-UI-07 trạng thái gửi · §5.4 toast · §6.1 `ERR-SEND` | Gửi lỗi khi tôi đã sang hội thoại khác thì chỉ có toast 5 giây "Không gửi được tin", không nói hội thoại nào, lý do gì, làm gì tiếp. Dòng hội thoại trên danh sách không có dấu gì. | Mạng văn phòng chậm, chuyện này xảy ra vài lần mỗi ca. Khách tưởng mình bị bơ. | Toast lỗi gửi ghi tên hội thoại và có nút "Mở". Dòng danh sách có icon đỏ "Gửi lỗi" tới khi gửi lại thành công. `ERR-SEND` có câu hướng dẫn: "Không gửi được tin tới {tên}. Bấm Thử lại; nếu vẫn lỗi, chép nội dung và báo Admin (mã {requestId})." | Nên sửa |
| 13 | §6.1 lỗi chuẩn · MH-UI-06 · MH-UI-02 | Nhiều câu kết thúc bằng "Liên hệ Admin hệ thống" / "thử lại sau ít phút" mà không nói Admin là ai và **trong lúc chờ tôi làm gì với khách**. | Kênh OA lỗi lúc 10h thì cả phòng ngồi chờ, khách thì vẫn nhắn. | Câu có tên hoặc nhóm phụ trách và nút "Báo Admin" (tự kèm mã tham chiếu, kênh, màn hình). Lỗi kênh (`CH-DOWN`) thêm dòng "Trong lúc chờ: ghi chú nội bộ để không quên, tin gửi sẽ nằm chờ". Nói rõ tin gõ lúc kênh lỗi có được giữ lại để gửi sau không. | Nên sửa |
| 14 | MH-UI-08 ghi chú @nhắc · MH-UI-03 @Nhắc | Chưa rõ tôi @nhắc được những ai (sale khác division? sale không có quyền xem hội thoại OA?) và người được nhắc có mở được hội thoại không. | Tôi @Nam vì khách của Nam. Nếu Nam bấm thông báo ra 403 thì vô ích. | Danh sách @ gợi ý người phụ trách khách lên đầu. Người được @ có quyền **đọc** hội thoại đó (ghi nhật ký). Nếu người được nhắc không xem được thì báo ngay lúc tôi gõ: "{tên} không xem được hội thoại này. Vẫn nhắc?". | Nên sửa |
| 15 | MH-UI-05 trạng thái online · ca làm việc | Khi tôi hết ca hoặc chuyển "Ngoại tuyến", chưa rõ các hội thoại "Của tôi" đang dở và khách nhắn tiếp sẽ về ai. SLA dùng "giờ làm việc" của division hay ca của người phụ trách? Giờ nghỉ trưa 12:00–13:30 có dừng SLA không? | Cuối ca còn 3–5 hội thoại dở. Ca sau không biết thì khách chờ tới sáng mai. | Khi chuyển Ngoại tuyến mà còn hội thoại dở: hỏi "Còn {n} hội thoại đang xử lý. Trả về hàng chung / Giữ lại?". Ghi rõ SLA theo lịch nào, có dừng giờ trưa không. | Nên sửa |
| 16 | MH-UI-10 #7 dòng hội thoại · MH-UI-08 #6 giữ nháp | Nháp được giữ theo hội thoại (rất tốt), nhưng danh sách không cho biết hội thoại nào đang có nháp dở. | Tôi gõ dở câu trả lời, bị gọi đi, quay lại quên mất. | Dòng 2 hiện "Nháp: …" chữ đỏ như Zalo khi có nháp chưa gửi. | Gợi ý |
| 17 | §3.3 trạng thái · chip "Mới" `blue` vs "Đang xử lý" `cyan` | Xanh dương và xanh ngọc rất khó phân biệt trên chip 11 px, lại trùng tông với chip Zalo. "Chờ khách" tự bật khi tôi vừa nhắn "dạ em kiểm tra", sau đó SLA biến mất nên tôi dễ quên quay lại. | Khách hỏi tồn kho, tôi nhắn "em kiểm tra" rồi quên vì hội thoại đã thành "Chờ khách". | Đổi màu hai chip cho khác hẳn nhau (vd. "Mới" viền đậm, "Đang xử lý" nền xám). Khi gửi tin, cho chọn nhanh "Chờ khách" / "Tôi sẽ quay lại" (giữ Đang xử lý, đặt nhắc sau 15′/30′). | Gợi ý |

## Câu hỏi của tôi

1. CSKH trực ở đâu: `/conversations` (khung chung) hay `/cskh` (Hộp thư CSKH của 04)? Nếu cả hai, tin OA/Fanpage chưa ai nhận hiện ở chỗ nào và ai nhận thông báo "Tin mới" của chúng? (Hiện ghi "chưa phân công → GS của division".)
2. Hàng Bình luận Fanpage: tôi xử lý ở trang `/comments` hay ngay trong danh sách hội thoại (có chip "Bình luận")? Tôi không muốn phải trông hai nơi.
3. Khi tôi @nhắc một sale không có quyền xem hội thoại OA, sale đó có tự được quyền đọc hội thoại không?
4. Chip SLA đang tính hạn phản hồi **đầu tiên** hay **tiếp theo**? Tin nội bộ ghi chú không tính là phản hồi — vậy tin tự động (tin chào, chatbot) có tính không?
5. Khi tôi tìm SĐT mà không thấy, tôi có được biết "khách có trong hệ thống nhưng ngoài phạm vi" để báo người phụ trách không, hay tuyệt đối không được biết?
6. Toast lỗi tự mất sau 5 giây — có chỗ nào xem lại danh sách tin gửi lỗi trong ca không?

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| UAT-UI-80 | DL-05 (CS) trực OA; 3 hội thoại OA mới chưa ai nhận | Mở trang trực, chọn hàng chưa nhận, bấm "Nhận" trên dòng đầu | Thấy đủ 3 hội thoại; nhận xong dòng chuyển sang "Của tôi", ≤ 3 thao tác; người khác thấy dòng biến mất ≤ 5 giây |
| UAT-UI-81 | DL-05, 1 hội thoại Fanpage còn 20′ hết cửa sổ 24h, 1 hội thoại OA còn 25′ hết 48h miễn phí | Ở danh sách "Của tôi", sắp "Ưu tiên xử lý" | Hai hội thoại có chip cửa sổ, đứng trên các hội thoại chỉ "còn hạn SLA"; có thông báo "Sắp hết cửa sổ gửi" |
| UAT-UI-82 | DL-05 ở chế độ "Trả lời khách", hội thoại OA 1-1 | Gõ "@Nguyễn Văn An khách này khó tính", Enter | Hệ thống hỏi có muốn lưu thành ghi chú nội bộ; chọn "Lưu ghi chú" → không có tin nào tới khách |
| UAT-UI-83 | DL-05 vừa lưu ghi chú nội bộ | Gõ "Dạ em kiểm tra ngay ạ", Enter | Ô soạn đã tự về "Trả lời khách"; tin tới khách |
| UAT-UI-84 | DL-05; khách DL-09 không có ticket giao cho DL-05 | Ctrl+K, dán `0987.654.321` | Nhận dạng "SĐT"; thấy thẻ tối thiểu (tên, người phụ trách, ticket mở) không có nội dung chat; nhật ký có `search_phone` |
| UAT-UI-85 | DL-05 có 20 hội thoại "Của tôi"; giả lập 30 tin mới trong 5 phút, 1 hội thoại sang "Sắp quá" | Mở chuông, chọn tab "Gấp" | Tab "Gấp" chỉ có thông báo SLA; âm thanh SLA khác âm tin mới |
| UAT-UI-86 | DL-05 gửi tin ở hội thoại A, ngắt mạng API ngay sau đó, chuyển sang hội thoại B | Quan sát | Toast có tên hội thoại A và nút "Mở"; dòng A trên danh sách có dấu "Gửi lỗi"; bấm Thử lại ở A gửi đúng một tin |
| UAT-UI-87 | DL-05 và một CS khác cùng mở một hội thoại; người kia đang gõ | DL-05 gõ và Enter | Dải "Đang được … trả lời" không có nút ✕; DL-05 luôn gặp hộp hỏi lại trước khi gửi |
| UAT-UI-88 | DL-05 ở hội thoại 1/20, danh sách sắp "Ưu tiên xử lý"; có tin mới liên tục | Nhấn Alt+↓ 5 lần trong 10 giây | Mở lần lượt 5 hội thoại khác nhau, không lặp, không bỏ sót |
| UAT-UI-89 | DL-05 có 3 hội thoại "Đang xử lý" lúc 17:30 | Chuyển "Ngoại tuyến" | Hộp hỏi xử lý 3 hội thoại dở; chọn "Trả về hàng chung" → hội thoại về hàng chưa nhận của ca sau |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/00-P-CS.md) | — |
