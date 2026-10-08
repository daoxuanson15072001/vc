# Góp ý 03 — P-KD (Minh, NVKD)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Minh (P-KD, NVKD) góp ý đặc tả 03 Sale Zalo cá nhân bản v1.0, vòng 1; file lưu ngày 30/09/2026.
- 25 góp ý: **7 Chặn · 13 Nên sửa · 5 Gợi ý**; kèm 9 câu hỏi và 13 ca UAT đề xuất.
- Nhận xét chung: buổi sáng VClinks hơn Zalo (mẫu câu, STK, tìm theo mã OE), nhưng chưa bỏ được Zalo điện thoại vì chiều đi thị trường.
- Chặn: không có gì về dùng VClinks trên điện thoại; không rõ tin trả lời từ app Zalo hiện ra sao, có tính "đã trả lời" không; cần lọc "Chưa trả lời" thay "Chưa đọc".
- Chặn: phải bấm từng khách "Đang chờ nội dung"; panel không có ô tra giá / tồn; tin nhiều dòng thành nhiều tin vụn; gửi lỗi không có thông báo nổi.
- Kết quả xử lý ở [03-xu-ly.md](03-xu-ly.md): 16 đã sửa, 8 hỏi chủ dự án, 1 không làm (thả 👍, giới hạn kỹ thuật).
- Còn mở: giao diện điện thoại (Q14), tin nhiều dòng (Q9), tự lấy nội dung trước (Q15), xóa nháp trên Zalo (Q16), báo giá khách chưa có mã KH (Q20).

## Mục lục

- [Một ngày của tôi trên VClinks](#một-ngày-của-tôi-trên-vclinks)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Tôi đọc hết rồi. Ngồi bàn buổi sáng thì cái này hơn Zalo thật: có mẫu câu `/`, có số tài khoản bấm là ra, tìm tin cũ theo mã OE thì Zalo chịu. Nhưng tôi **chưa bỏ Zalo điện thoại được**. Từ 11h tôi ra đường, chỉ có điện thoại. Tài liệu gần như không nói tôi dùng VClinks trên điện thoại thế nào. Nó cũng không nói tin tôi trả lời trên điện thoại hiện lên VClinks ra sao. Còn ba chỗ nữa: tra giá/tồn chưa có chỗ làm, khách nhắn tới không có gì báo, gửi lỗi mà tôi đang ở hội thoại khác thì không biết. Sửa mấy chỗ đó thì buổi sáng tôi làm trên VClinks, buổi chiều vẫn phải cầm điện thoại.

## Một ngày của tôi trên VClinks

| Giờ | Tôi làm gì | Màn hình | So với làm thẳng trên Zalo |
|---|---|---|---|
| 07:30 | Mở laptop, nhìn chấm nick. Xanh thì yên tâm. | MH-SZ-12a | Nhanh ngang. Zalo điện thoại thì lúc nào cũng "xanh", nên tôi không quen phải để ý cái này. |
| 07:35 | Bấm "Chưa đọc". Đêm qua 15 khách nhắn, nhưng 5 khách tôi đã đọc và trả lời trên điện thoại lúc 22h. Tôi cần biết **khách nào chưa được trả lời**, không phải khách nào chưa đọc. | MH-SZ-01 | **Chậm hơn.** Đọc trên điện thoại là mất badge, nên lọc "Chưa đọc" bỏ sót khách đã đọc mà chưa trả lời. Tài liệu không có lọc "Chưa trả lời". |
| 07:40 | Mở từng khách thì nhiều dòng ghi "Đang chờ nội dung". Bấm vào lại phải chờ extension mở Zalo Web. | MH-SZ-01 #9g, MH-SZ-03 #9 | **Chậm hơn nhiều.** 15 khách, mỗi khách chờ vài giây rồi mới đọc được. Trên Zalo đọc được ngay. |
| 08:00 | 2 lời mời kết bạn. Đồng ý → xác nhận → chờ → đặt tên gợi nhớ → nhắn chào. | MH-SZ-10, 09 | Chậm hơn Zalo khoảng 3 bước. Được cái có gợi ý "Có thể là Gara Minh Phát", Zalo không có. |
| 09:00–11:00 | Cao điểm. Khách hỏi "má phanh Vios 2019 còn không". Tôi cần tra giá, tồn ngay. Tài liệu ghi "tra giá VCsales ở panel phải" nhưng panel MH-SZ-07 **không có ô tra hàng**. | MH-SZ-07 | Không hơn. Vẫn phải mở VCsales tab khác như trước. |
| 09:30 | Khách gửi VIN + 6 ảnh. Tôi làm báo giá trên VCsales rồi quay lại "Gửi báo giá". Khách mới chưa có mã KH nên nút mờ, phải "Gửi yêu cầu" cho Sale admin. | MH-SZ-05i | Với khách quen: **nhanh hơn**, không phải tải PDF về rồi kéo vào. Với khách mới: **chậm hơn**, chờ Ngọc liên kết mã KH. |
| 10:00 | Báo giá nhanh 4 dòng gõ tay, Shift+Enter. Khách nhận 4 tin vụn. | MH-SZ-05 #15, SZ-US-08 | **Tệ hơn Zalo.** Khách garage đọc 4 tin rời thì hỏi lại, trông không chuyên nghiệp. |
| 10:15 | Gửi 1 tin rồi sang khách khác. Tin đó lỗi vì "đang có nháp trên Zalo". Tôi không biết, vì bong bóng đỏ nằm ở hội thoại tôi đã rời. | MH-SZ-03 #38, MH-SZ-13 | **Nguy hiểm.** Tôi tưởng đã trả lời. Trên Zalo gửi là đi, không có kiểu này. |
| 11:00 | Khách chuyển khoản: bấm 🏛 → chọn STK → Gửi. | MH-SZ-05f | **Nhanh hơn Zalo.** Rất thích. |
| 11:30–14:00 | Ra ngoài, lái xe đi gặp garage. Chỉ có điện thoại, trả lời bằng app Zalo. | (không có màn hình) | Tài liệu không nói gì về điện thoại. Tôi không biết chiều về tin mình trả lời trưa có hiện đúng không, có bị tính "chưa trả lời" không. |
| 14:00 | Khách hỏi lại đơn tháng trước. Tìm theo mã OE. | MH-SZ-14 | **Nhanh hơn Zalo nhiều.** Tốt nhất tài liệu. |
| 15:00 | Khách gửi MST + địa chỉ đòi hóa đơn. | (không có) | Không có gì. KD-17 để GĐ2. Tôi vẫn chụp màn hình gửi Hà kế toán qua Zalo. |
| 15:30 | Khách gửi ghi âm 2 phút lúc tôi đang ngồi với khách khác. | MH-SZ-03 #24 | Nếu có bản chữ thì hơn Zalo. Tài liệu ghi "Một phần". |
| 16:00 | Lập nhóm "Gara Minh Phát – VCparts" với chủ gara + anh kỹ thuật. Anh kỹ thuật chưa là bạn của nick. | MH-SZ-11 | Không làm được nếu chỉ chọn từ bạn bè. Trên điện thoại tôi thêm bằng SĐT. |
| 16:30 | Chuyển ảnh phụ tùng khách gửi vào nhóm kho hỏi hàng. | MH-SZ-04 | Không có "Chuyển tiếp" (GĐ2–3). Phải tải ảnh về rồi gửi lại. Chậm hơn Zalo. |
| 17:15 | Ghim 3 khách mai theo dõi. | MH-SZ-02 | Ngang Zalo. |
| 20:00–22:00 | Khách nhắn tối, tôi trả lời trên điện thoại. | – | Như cũ. |

## Góp ý

| # | Màn hình / story / UAT | Góp ý | Vì sao (tình huống thật) | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | Toàn tài liệu, §2, KD-02 | Không có một dòng nào về dùng VClinks trên điện thoại. Chỉ ghi "Mobile < 768 px: một cột, có nút quay lại". | Từ 11h tôi chỉ có điện thoại. Nếu VClinks chỉ dùng được trên laptop thì nửa ngày tôi vẫn ở Zalo, và hai nơi sẽ lệch nhau. | Thêm mục "Sale trên điện thoại": tối thiểu đọc danh sách, đọc tin, trả lời chữ, gửi mẫu câu, gửi STK, xem Lệnh gửi. Nếu để GĐ2 thì ghi rõ trong lúc chờ thì tôi làm thế nào (dùng app Zalo, và VClinks xử lý tin đó ra sao, xem #2). | **Chặn** |
| 2 | MH-SZ-01, MH-SZ-03, KD-01 | Tài liệu không nói tin tôi trả lời bằng app Zalo trên điện thoại hiện ra sao trên VClinks: hiện là "Bạn" hay tên tôi, có tính là "đã trả lời" không. | Trưa và tối tôi trả lời bằng điện thoại. Nếu VClinks vẫn đếm khách đó là chưa trả lời hoặc quá SLA thì giám sát sẽ nhắc tôi sai. Tôi sợ nhất bị soi sai. | Ghi rõ: tin gửi từ điện thoại hiện như tin của nick, có nhãn nhỏ "từ điện thoại", về VClinks trong ≤ 1 phút, và **tính là đã trả lời**. Thêm UAT (xem phía dưới). | **Chặn** |
| 3 | MH-SZ-01 #5, KD-01 | Chỉ có lọc "Chưa đọc". Tôi cần lọc **"Chưa trả lời"**, tức là khách nhắn cuối cùng. | Đọc trên điện thoại là mất badge. Sáng ra "Chưa đọc" trống trơn nhưng vẫn có 5 khách chờ tôi. | Thêm `Chưa trả lời` vào nhóm lọc, đặt cạnh `Chưa đọc`. Mỗi dòng hiện "chờ 2 giờ". Sắp xếp theo thời gian khách chờ lâu nhất. | **Chặn** |
| 4 | MH-SZ-03 #35, SZ-15, QT-SZ-01 bước 3 | Sáng mở ra, nhiều khách chỉ hiện "Đang chờ nội dung". Phải bấm vào từng khách rồi chờ. | 15–20 khách nhắn đêm, mỗi khách chờ vài giây thì mất 2–3 phút chỉ để đọc. Trên Zalo lướt 30 giây là xong. | Tự lấy nội dung trước cho hội thoại "Của tôi" có tin mới. Nếu làm vậy sẽ lộ "đã xem" với khách thì cho tôi bật/tắt, hoặc lấy lúc tôi rê chuột vào dòng. Ít nhất có nút "Lấy nội dung tất cả tin chưa đọc". | **Chặn** |
| 5 | MH-SZ-07, KD-06, luồng §2.1 bước G | Sơ đồ ghi "Tra VCsales ở panel phải", nhưng panel không có tab/ô tra giá, tồn. Tab "Khách" chỉ có công nợ. | Tôi hỏi giá, tồn 50 lần/ngày. Đây là lý do chính tôi mở VClinks thay Zalo. | Thêm tab/ô **"Tra hàng"** trong panel: gõ tên, mã OE, dòng xe → giá theo khách này + tồn. Có nút "Chèn vào tin" để khỏi gõ lại giá. | **Chặn** |
| 6 | MH-SZ-05 #15, SZ-US-08, Q9 | Nhiều dòng thì mỗi dòng thành một tin riêng. | Báo giá nhanh 4 món, địa chỉ giao hàng, hướng dẫn chuyển khoản đều là nhiều dòng. Khách nhận 4–5 tin vụn, trông như spam. Tôi sẽ quay lại Zalo để gõ. | Sửa E2 (một tin nhiều dòng) **trước khi** mở gửi cho khách thật (Q10). Chưa sửa được thì chặn Shift+Enter và báo rõ, đừng tách ngầm. | **Chặn** |
| 7 | MH-SZ-03 #38, MH-SZ-13, SZ-US-02 | Gửi lỗi chỉ hiện ở bong bóng đỏ trong hội thoại đó. Nút "Lệnh gửi" nằm trong menu avatar. | Giờ cao điểm tôi gửi xong là sang khách khác ngay. Lỗi mà không có gì kéo tôi lại thì tôi tưởng đã trả lời. Khách chờ rồi bỏ đi. | Lỗi thì bật **thông báo nổi** (toast góc màn hình + tiếng) có nút "Mở hội thoại". Badge đỏ trên thanh điều hướng bên trái, không giấu trong menu avatar. Dòng hội thoại có ⚠ (#9k đã có, giữ). | **Chặn** |
| 8 | MH-SZ-01, §2.1 bước C | Sơ đồ ghi "badge chưa đọc + thông báo" nhưng không màn hình nào đặc tả thông báo. Không nói có tiếng, có thông báo desktop không. | Tôi hay để VClinks ở tab sau, đang làm báo giá trên VCsales. Zalo có tiếng "ting". VClinks im thì tôi trả lời chậm hơn trên Zalo. | Đặc tả thông báo: tiếng + thông báo desktop khi khách "Của tôi" nhắn. Số chưa đọc trên tiêu đề tab trình duyệt. Tắt được theo hội thoại (nhóm ồn). | **Nên sửa** |
| 9 | QT-SZ-01, §2.1 bước B | Tin về "vài giây đến 1 phút". | Khách gọi điện hỏi "em nhận ảnh chưa" mà VClinks chưa có ảnh thì tôi phải mở điện thoại. 1 phút là quá lâu so với Zalo. | Đặt mục tiêu tin về ≤ 10 giây khi nick xanh, và có UAT đo như đo tốc độ gửi. | **Nên sửa** |
| 10 | Bảng dịch lỗi QT-SZ-02 (`inputBusy`), UAT-SZ-18 | Gặp nháp trên Zalo thì bảo tôi "nhờ Admin xóa nháp". | Nháp đó không phải của tôi, tôi cũng không vào được máy driver. Chờ anh Quân thì khách chờ 30 phút. | Cho nút **"Xóa nháp trên Zalo rồi gửi"** ngay trong tooltip lỗi. Tôi bấm tức là tôi duyệt. Có hộp xác nhận hiện nội dung nháp sẽ bị xóa. | **Nên sửa** |
| 11 | Bảng dịch lỗi `replyTarget` | "Tin bạn trả lời đã trôi quá xa… nhờ Admin cuộn tới tin rồi Thử lại". | Khách hỏi lại tin từ hôm qua là chuyện hằng ngày. Nhờ Admin cuộn thì vô lý. | Tự gửi lại **không trích dẫn** nhưng chèn 1 dòng trích tay ("Về tin: …"), sau khi hỏi tôi 1 lần. Hoặc extension tự cuộn tìm. | **Nên sửa** |
| 12 | SZ-10, MH-SZ-05 trạng thái Nick đỏ | Nick đỏ thì khóa nút Gửi. Câu báo "Tin sẽ gửi được khi nick kết nối lại". | Khách đang chờ giá, tôi không chờ được. Tôi sẽ cầm điện thoại trả lời. Nhưng câu báo không nói vậy, và nháp VClinks sẽ nằm đó, lát kết nối lại tôi lỡ tay gửi trùng. | Câu báo: `Nick {nick} mất kết nối. Trả lời tạm trên Zalo điện thoại, đã báo Admin.` Có nút "Sao chép nội dung" để dán sang Zalo. Khi nick xanh lại, nếu thấy tin giống nháp đã gửi từ điện thoại thì hỏi "Xóa nháp này?". | **Nên sửa** |
| 13 | QT-SZ-03, MH-SZ-05 #9, UAT-SZ-30 | Khách chưa liên kết mã KH thì nút Gửi báo giá mờ, phải chờ Sale admin. | Khách mới hỏi giá là khách quan trọng nhất. Chờ Ngọc liên kết mã KH có khi hết nửa ngày, khách đã mua chỗ khác. | Cho chọn báo giá theo **số báo giá** tôi vừa tạo trên VCsales (gõ số BG). Việc liên kết mã KH làm sau. Hoặc nút "Tạo báo giá" tự gắn khách mới vào mã KH tạm. | **Nên sửa** |
| 14 | MH-SZ-05i | Hộp gửi báo giá có 4 bước (chọn, xem trước, dạng gửi, lời nhắn). | Khách quen: tôi chỉ muốn "gửi báo giá mới nhất" trong 2 cú bấm. | Mặc định chọn sẵn báo giá hợp lệ mới nhất (đã ghi) **và** con trỏ đặt ở nút Gửi. Enter là gửi. Không bắt tôi xem lại mọi thứ. | **Gợi ý** |
| 15 | MH-SZ-07 tab Khách, KD-08 | Panel có công nợ nhưng không có **lần mua gần nhất**, không có **ai đang chăm** khi khách là nhóm. KD-08 để GĐ2. | Khách hỏi "như lần trước" là tôi phải biết lần trước mua gì, giá bao nhiêu. Công nợ thì phải có trước khi báo giá cho khách nợ nhiều. | Đưa "3 đơn gần nhất (ngày, tổng, món chính)" lên MVP cùng công nợ. Công nợ có cảnh báo màu khi quá hạn. | **Nên sửa** |
| 16 | MH-SZ-04 #6 Chuyển tiếp (GĐ2–3) | Chuyển tiếp để tận GĐ2–3. | Ngày nào tôi cũng chuyển ảnh phụ tùng hỏng của khách vào nhóm kho/kỹ thuật để hỏi. Không có thì phải tải ảnh về rồi gửi lại, 5 bước. | Đưa "Chuyển tiếp tới **một** hội thoại" lên MVP. Một đích mỗi lần thì vẫn đúng quy tắc không gửi hàng loạt. | **Nên sửa** |
| 17 | MH-SZ-03, KD-13 | Không thấy ghi chú nội bộ và @giám sát trong khung chat, dù KD-13 là MVP. | Khách xin giảm giá, tôi cần hỏi chị Hương ngay trong hội thoại. Giờ tôi phải nhắn Zalo riêng cho chị. | Thêm chế độ "Ghi chú nội bộ" ở ô soạn (màu vàng, không gửi ra Zalo), @giám sát được. | **Nên sửa** |
| 18 | §2 dòng 15:00, KD-17 | Khách đòi hóa đơn: tài liệu không có gì, KD-17 để GĐ2. | Chiều nào cũng có 3–5 khách đòi hóa đơn. Tôi đang chép MST gửi chị Hà bằng tay. | Trước GĐ2: có ít nhất mục chuột phải "Gửi cho kế toán" trên tin, tạo việc cho kế toán có link tới tin. | **Nên sửa** |
| 19 | MH-SZ-11 #4 | Chỉ chọn thành viên từ bạn bè của nick. | Anh kỹ thuật bên gara thường chưa kết bạn với nick công ty. Trên điện thoại tôi thêm bằng SĐT hoặc lấy từ nhóm khác. | Cho thêm theo SĐT / người trong nhóm chung. Nếu Zalo không cho thì nói rõ trong hộp: "Người chưa là bạn: kết bạn trước". | **Nên sửa** |
| 20 | MH-SZ-03 #24, KD-05 | Ghi âm "Một phần". Không nói ghi âm dài xử lý thế nào, không có tua nhanh. | Garage hay gửi ghi âm 1–3 phút, nói lẫn mã phụ tùng. | Bản chữ hiện ngay dưới trình phát, có nút 1.5x/2x. Ghi âm dài thì hiện "Đang chuyển chữ…" chứ không để trống. | **Nên sửa** |
| 21 | MH-SZ-01, file 02 | Khách nhắn cả 2 nick (nick tôi và nick dùng chung) thì thành 2 hội thoại rời, tôi không biết. | Garage có lưu cả 2 nick, hôm nhắn nick này, hôm nhắn nick kia. Tôi trả lời một bên thì bên kia vẫn "chưa trả lời", hoặc 2 người cùng trả lời. | Trên tiêu đề hiện "Khách này cũng nhắn nick {nick khác} (2 tin chưa trả lời)" + link. Trả lời một bên thì bên kia hiện gợi ý đã xử lý. | **Nên sửa** |
| 22 | MH-SZ-04 #2 (thả cảm xúc ẩn) | Tôi dùng 👍 để báo "đã nhận" cả chục lần một ngày. | Khách gửi ảnh chuyển khoản, tôi chỉ cần thả 👍. Không có thì phải gõ "Dạ em nhận rồi ạ". | Khi driver bấm được thì mở lại, ưu tiên sớm. Trước đó có mẫu câu `/ok` sẵn. | **Gợi ý** |
| 23 | Toast "Đã duyệt: … Tiện ích VClinks sẽ gửi trên Zalo Web." (05a–05i, 10, 11) | Câu dài, chữ "tiện ích", "Zalo Web" tôi không cần biết. | Mỗi lần gửi ảnh lại hiện một câu dài, rất rối mắt. | Rút thành `Đang gửi 3 ảnh…`, xong thì im. Chỉ báo khi lỗi. | **Gợi ý** |
| 24 | MH-SZ-10 | Đồng ý kết bạn → xác nhận → chờ → toast → bấm "Đặt tên gợi nhớ" → bấm "Nhắn chào". | Khách mới cần được chào ngay. Mỗi lời mời mất 5–6 bước. | Một hộp: `Đồng ý kết bạn` + ô tên gợi nhớ + tích "Gửi lời chào /chao" → một nút. Vẫn là tôi bấm, vẫn đúng nhịp 30 giây. | **Gợi ý** |
| 25 | MH-SZ-03 ảnh (#23), MH-SZ-07 Media | Khách gửi 10 ảnh liền. Không có "tải hết" hay "xem liền mạch". | Ảnh xe, ảnh phụ tùng, ảnh tem, tôi cần lướt nhanh rồi gửi cho kỹ thuật. | Khi xem lớn thì lướt trái/phải được cả album. Có nút "Tải tất cả". | **Gợi ý** |

## Câu hỏi của tôi

1. Tin tôi trả lời trên app Zalo điện thoại có tính là "đã trả lời" trong báo cáo của giám sát không? Có hiện là tôi gửi không?
2. Nếu tôi đọc tin trên VClinks mà chưa trả lời, khách có thấy "Đã xem" không? Tôi sợ khách thấy "đã xem" mà không trả lời thì giận.
3. Nick dùng chung (VCparts Hà) thì "Của tôi" là khách nào? Hai người cùng gõ một khách thì ai thắng? (Q7)
4. Khi nào tôi được trả lời khách thật trên VClinks (bỏ "Giai đoạn thử")? Trong lúc thử thì có cần mở VClinks không, hay cứ làm trên Zalo?
5. Khi tôi nghỉ phép, người trả lời thay dùng đúng nick của tôi. Khi tôi quay lại, khách có tự về "Của tôi" không, hay phải xin giám sát?
6. Giám sát có đọc được mọi tin tôi nhắn với khách không, kể cả nhóm chat riêng tôi với gara? Tôi cần biết trước.
7. Mẫu câu cá nhân của tôi có bị người khác thấy/sửa không? Nếu tôi nghỉ việc thì mẫu đó mất hay ở lại?
8. 20 lời mời kết bạn/ngày tính cả lời mời tôi đồng ý trên điện thoại không?
9. Báo giá gửi dạng "Ảnh" thì khách xem trên điện thoại có đọc được chữ không? Tôi thấy khách gara thích ảnh hơn PDF.

## Kịch bản UAT tôi muốn thêm

| Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|
| Nick test xanh. Khách test nhắn 1 tin vào nick. | Trả lời khách bằng app Zalo trên **điện thoại** của nick. Mở VClinks. | ≤ 1 phút tin trả lời hiện trong khung chat là tin của nick, có nhãn "từ điện thoại". Hội thoại **không** còn trong lọc "Chưa trả lời". |
| 3 khách nhắn đêm qua. 1 khách đã được đọc (không trả lời) trên điện thoại. | Sáng mở `Của tôi`, bấm `Chưa trả lời`. | Cả 3 khách đều có. Khách chờ lâu nhất đứng đầu, hiện "chờ {n} giờ". |
| 10 hội thoại "Của tôi" có tin mới qua đêm. | Mở danh sách, lướt từng hội thoại. | Không hội thoại nào còn "Đang chờ nội dung" quá 5 giây. Đọc hết 10 hội thoại trong ≤ 1 phút. |
| Nhóm test, ô soạn Zalo trên driver có nháp. | Gửi tin từ VClinks rồi chuyển ngay sang hội thoại khác. | ≤ 10 giây có toast lỗi nổi + tiếng, có nút "Mở hội thoại". Badge đỏ trên thanh điều hướng trái. |
| Như trên. | Bấm "Xóa nháp trên Zalo rồi gửi" → xác nhận. | Nháp bị xóa, tin đi đúng 1 lần. Nhật ký ghi tôi là người duyệt. |
| Nhóm test. | Gõ 4 dòng bằng Shift+Enter → Gửi. | Trên Zalo là **một** tin 4 dòng (hoặc chặn, báo rõ, nếu E2 chưa xong). |
| Khách test có mã KH. | Trong panel phải gõ "má phanh vios 2019" ở ô Tra hàng → "Chèn vào tin" → Gửi. | Kết quả ≤ 2 giây có giá theo khách + tồn. Tin gửi đi đúng giá. Cả việc làm trong ≤ 30 giây. |
| Khách test nhắn cả 2 nick test. | Mở hội thoại ở nick 1. | Tiêu đề hiện "Khách này cũng nhắn nick 2" + link. |
| VClinks mở ở tab sau (đang xem VCsales). | Khách test nhắn 1 tin. | Có tiếng + thông báo desktop ≤ 10 giây. Tiêu đề tab hiện số chưa đọc. |
| Nick test chuyển đỏ khi tôi đang gõ dở. | Nhìn ô soạn, bấm "Sao chép nội dung", gửi trên Zalo điện thoại. Nick xanh lại. | Câu báo bảo tôi trả lời trên điện thoại. Khi xanh lại, VClinks hỏi xóa nháp đã gửi, không gửi trùng. |
| Mở trên điện thoại (màn hình 390 px). | Đọc danh sách, mở 1 khách, gõ `/chao`, gửi. Mở "Lệnh gửi". | Làm được hết bằng một tay, không cuộn ngang. Tin đi ≤ 2 giây. |
| Nhóm test có tin khách gửi hôm qua (đã trôi xa trên Zalo Web). | Bấm Trả lời tin đó → Gửi. | Không bắt nhờ Admin. Hoặc gửi được có trích dẫn, hoặc hỏi tôi "Gửi không trích dẫn?" rồi gửi. |
| Khách test gửi album 10 ảnh. | Mở ảnh đầu, lướt sang phải. | Xem liền 10 ảnh. "Tải tất cả" tải đủ 10. |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/03-P-KD.md) | — |
