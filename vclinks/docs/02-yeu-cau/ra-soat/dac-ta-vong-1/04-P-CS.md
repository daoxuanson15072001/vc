# Góp ý 04 — P-CS (Lan, CSKH)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Lan (P-CS, CSKH) góp ý đặc tả 04 CSKH Zalo OA, vòng 1; file lưu ngày 30/09/2026.
- 24 góp ý: **4 Chặn · 15 Nên sửa · 5 Gợi ý**; kèm 7 câu hỏi và 11 ca UAT đề xuất.
- Khen: thanh đếm ngược khung gửi và việc chặn gửi khi hết khung (MH-OA-03).
- Chặn: CSKH không thấy sale đã nói / hứa gì với khách; hỏi giá chuyển sale không có SLA; MVP chặn Z3 nhưng chưa có tin mẫu ZNS; ô "Đơn VCsales" bắt buộc nên không tạo được ticket khi khách chưa có mã KH.
- Nên sửa: nút báo giám sát, bàn giao ticket khi nghỉ, chống gửi trùng và giữ nháp, trình xem ảnh, hộp thư gộp Fanpage, mở lại ticket, hai đồng hồ SLA / miễn phí dễ nhầm.
- Kết quả xử lý ở [04-xu-ly.md](04-xu-ly.md): 19 đã sửa, 4 hỏi chủ dự án (CH-1, CH-2, CH-3), 1 chuyển file 01 (xem SĐT).
- Còn mở: CSKH đọc được gì về lịch sử khách với sale (CH-1), SLA hỏi giá của sale (CH-2), ZNS lẻ ở MVP (CH-3).

## Mục lục

- [Một ngày của tôi trên VClinks](#một-ngày-của-tôi-trên-vclinks)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Nhìn chung tôi thấy dùng được, và tốt hơn nhiều so với trực trên trang oa.zalo.me như bây giờ. Tôi thích nhất thanh đếm ngược khung gửi (MH-OA-03) và việc hệ thống chặn gửi khi hết khung: tôi không phải tự nhớ khách nhắn từ hôm nào, cũng không sợ bị tính phí mà không biết. Tôi lo nhất ba chuyện. Một: tôi vẫn chưa thấy được **sale đã nói gì, hứa gì** với khách trên Zalo cá nhân. Hai: khách hỏi giá bị chuyển cho sale rồi **không ai trả lời** thì khách quay lại mắng tôi. Ba: ở MVP tôi bị chặn gửi khi hết khung nhưng **chưa có tin mẫu (ZNS)** để báo kết quả bảo hành cho khách.

## Một ngày của tôi trên VClinks

**07:55 — Mở máy.** Vào Hộp thư CSKH (MH-OA-02). Hàng "Chưa nhận 5", "Của tôi 12". Tôi cần biết ngay có bao nhiêu khách **sắp hết 48h miễn phí** và bao nhiêu ticket **quá SLA từ hôm qua**. Bộ lọc có cả hai nhưng nằm trong dropdown, phải bấm 2–3 lần. Mỗi dòng có hai con số giờ (`SLA còn 25′` và `Miễn phí 41h`). Buổi sáng đầu óc chưa tỉnh, tôi dễ nhầm hai số này.

**08:05 — Tin ngoài giờ tối qua.** Có 3 khách nhắn lúc 20:00–22:00, đã nhận tin ngoài giờ (MH-OA-08). SLA hiện `Tạm dừng` và bắt đầu đếm từ 08:00 (UAT-OA-16). Tốt. Tôi bấm "Nhận xử lý" từng dòng. Tôi muốn nhận 3 dòng một lần mà chỉ giám sát mới chọn nhiều được.

**08:20 — Khách hỏi tình trạng đơn.** "Chị ơi đơn má phanh hôm thứ 2 đâu rồi". Khách chưa chia sẻ SĐT, chưa có mã KH. Tôi mở Tạo ticket (MH-OA-05) và chọn loại Tình trạng đơn. Ô "Đơn VCsales" bắt buộc nhưng lại trống vì chưa có mã KH, nên **tôi không tạo được ticket**. Tôi phải bấm Yêu cầu chia sẻ thông tin (MH-OA-04) rồi chờ khách. Khách thì chỉ muốn biết đơn đâu.

**09:30 — Khách của sale Nam.** Khách nhắn OA: "Hôm trước anh Nam hứa đổi miễn phí, sao chưa thấy?". Panel phải (MH-OA-03) chỉ ghi `Owner sale: Nam`. Tôi **không thấy Nam đã hứa gì** trên Zalo cá nhân. Ô soạn ghi `Bạn chỉ xem hội thoại này…` vì chưa có ticket (OA-12). Tôi phải tạo ticket rồi gọi Nam hỏi, trong lúc đó khách đợi.

**10:00–11:30 — Cao điểm.** 20–30 tin mỗi giờ. Quy tắc từ khóa tự mở ticket bảo hành (MH-OA-10). Khách gửi ảnh má phanh chụp tối và mờ. Tôi cần phóng to và xoay ảnh, rồi xin khách chụp lại bằng một mẫu câu. Mạng văn phòng chậm, tôi bấm Gửi hai lần vì chưa thấy tin lên. Tài liệu chưa nói có chống gửi trùng không.

**11:40 — Khách nóng tính.** "Bán hàng lỗi mà gọi không ai nghe, tôi đăng lên group bây giờ". Quy tắc "Khiếu nại gấp" bắt được. Tôi cần **nhờ giám sát Hương vào ngay** mà ticket (MH-OA-06) chỉ có Chờ khách / Chuyển sale / Nhắc việc, không có nút "Báo giám sát".

**14:00 — Khách hỏi giá lẫn bảo hành.** "Má phanh kêu, báo giá luôn bộ mới cho anh". Theo OA-11, hỏi giá thì không mở ticket mà chuyển sale. Một tin có hai việc nên tôi không biết xử lý thế nào.

**15:00 — Khách cũ quá 7 ngày.** Kho vừa xác nhận đổi mới cho ticket #TK-0131, khách im 9 ngày. Banner xám Z3 (MH-OA-04), ô nhập khóa, nút Gửi tin mẫu (ZNS) (MH-OA-12). Nếu chưa có mẫu "Kết quả xử lý yêu cầu" đã duyệt thì tôi **không báo được cho khách**, chỉ còn cách gọi điện. Mà SĐT lại bị ẩn, bấm "Xem" chỉ hiện 10 giây.

**16:30 — Hỏi giá chuyển sale chưa ai trả lời.** Ba hội thoại "Hỏi giá" chuyển cho sale từ sáng, khách nhắn lại "sao không ai trả lời". Hội thoại không có ticket nên không có SLA, cũng không ai cảnh báo. Khách lại mắng OA, tức là mắng tôi.

**17:20 — Cuối ngày.** Mở Ticket của tôi (MH-OA-07): 9 ticket mở, 2 cái ngày mai tôi nghỉ phép. Tôi chỉ chuyển được cho người trong nhóm, và không có chỗ ghi "bàn giao" để người nhận biết đang làm tới đâu. Đóng 4 ticket (modal đóng MH-OA-06), mỗi cái có khảo sát sau 30 phút.

## Góp ý

| # | Màn hình / story / UAT (mã) | Góp ý | Vì sao (tình huống thật) | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-OA-03 panel phải · CS-05 · OA-12 | Tôi chỉ thấy tên owner sale. Tôi không thấy sale đã nói gì, hứa gì với khách trên Zalo cá nhân hay Fanpage. | Mỗi ngày có 5–10 khách mở đầu bằng "anh Nam hứa…". Nếu hỏi lại, khách mắng "nói rồi mà". Nếu trả lời theo ý mình, tôi dễ nói ngược với sale. | Thêm khối "Gần đây với VCparts" trên panel phải: 5 lần liên lạc gần nhất ở mọi kênh (ai, kênh nào, lúc nào, 1 dòng trích). Thêm ghi chú "Sale đã hứa" do sale ghi, hiện nổi trên ticket. Xem bằng quyền đọc theo ticket, không cần xin quyền tạm. | **Chặn** |
| 2 | OA-11 · MH-OA-02 · bước 6 §2.2 | Hỏi giá chuyển cho sale xong thì không có SLA và không ai cảnh báo. Khách chờ cả ngày rồi quay lại mắng OA. | Chiều nào cũng có 2–3 khách "sao không ai báo giá". Sale đi thị trường hoặc nghỉ phép. | Hội thoại chuyển sale vẫn có hạn phản hồi (vd. 30′ trong giờ làm việc). Quá hạn thì báo sale và giám sát sale, và hội thoại tự về hàng "Chưa nhận" của CSKH với nhãn `Sale chưa trả lời 45′`. Cho CSKH gửi một câu giữ khách ("Dạ em đã báo anh Nam, anh chờ em chút ạ"). | **Chặn** |
| 3 | §3.2 Z3 · MH-OA-04 · OA-US-03 (MVP) vs OA-US-07 (GĐ2) | Ở MVP tôi đã bị chặn gửi khi hết 7 ngày, nhưng tin mẫu lẻ tới GĐ2 mới có. Vậy khách Z3 ở MVP tôi báo kết quả bằng cách nào? | Bảo hành thường mất 5–10 ngày. Khi có kết quả thì khách đã im quá 7 ngày. | Đưa MH-OA-12 và ít nhất 2 mẫu "Tiếp nhận yêu cầu" và "Kết quả xử lý yêu cầu" vào MVP. Nếu không kịp thì khối chặn Z3 phải ghi rõ cách khác: nút gọi điện / hiện SĐT cho người xử lý ticket, và nhắc "Khách nhắn lại thì khung mở". | **Chặn** |
| 4 | MH-OA-05 #4 · UAT-OA-35 | Ô "Đơn VCsales" bắt buộc với Tình trạng đơn và Đổi trả. Khách chưa có SĐT, chưa có mã KH thì danh sách trống, nên tôi không tạo được ticket. | Khách hỏi đơn qua OA thường chưa từng chia sẻ SĐT. Họ chỉ gửi ảnh phiếu giao hàng hoặc nói "đơn hôm thứ 2". | Cho chọn "Chưa xác định đơn" và điền sau. Cho tìm đơn theo mã đơn hoặc SĐT khách gõ vào, không chỉ theo mã KH. Ticket vẫn tạo được; khi đóng mới bắt buộc có đơn. | **Chặn** |
| 5 | MH-OA-04 #14 · MH-OA-03 | "Đang được [NV] trả lời" chỉ tính trong hội thoại OA. Sale có thể đang trả lời chính khách đó trên Zalo cá nhân cùng lúc với tôi. | Khách hỏi cả OA lẫn nick sale. Hai người trả lời hai giá hoặc hai hạn khác nhau, khách chụp màn hình gửi lại. | Hiện cảnh báo trên khung chat: `Nam vừa nhắn khách này qua Zalo cá nhân 10′ trước`. Khi tôi mở ticket cho khách của Nam thì Nam nhận thông báo "CSKH Lan đang xử lý #TK-…, anh đừng trả lời chuyện bảo hành". | Nên sửa |
| 6 | OA-11 · MH-OA-05 | Một tin vừa bảo hành vừa hỏi giá thì quy tắc chỉ cho một đường. | "Má phanh kêu, báo giá luôn bộ mới" gặp vài lần mỗi ngày. | Cho mở ticket bảo hành **và** bấm "Báo sale báo giá" trong cùng hội thoại. Sale nhận việc báo giá, tôi giữ ticket. | Nên sửa |
| 7 | MH-OA-04 trạng thái "Không có quyền gửi" · OA-12 | Câu `Bạn chỉ xem hội thoại này. Tạo ticket hoặc chuyển cho người phụ trách để trả lời.` đúng, nhưng tôi phải tự đi tìm nút. | Đây đúng là câu tôi hay hỏi: "Tôi có được trả lời thẳng không?". | Đặt ngay trong khối đó 2 nút: `[Tạo ticket để trả lời]` `[Báo sale phụ trách]`. Tạo ticket xong thì ô soạn mở luôn, không phải tải lại. | Nên sửa |
| 8 | MH-OA-02 #9 #10 | Mỗi dòng có hai đồng hồ (`SLA còn 25′` và `Miễn phí 41h`), dễ nhầm. | Buổi sáng hoặc lúc cao điểm, tôi nhìn thấy "còn 41h" rồi tưởng còn thong thả. | Ghi rõ chữ: `Hạn trả lời: 25′` và `Nhắn miễn phí: 41h`. Có chú giải ngắn khi rê chuột. Thêm hai nút nhanh trên đầu danh sách: `Quá SLA (3)` và `Sắp hết khung (4)`, không giấu trong dropdown. | Nên sửa |
| 9 | MH-OA-02 "Nhận xử lý" | CSKH chỉ nhận từng dòng một, chọn nhiều chỉ giám sát làm được. | 08:00 có 5–10 tin tồn đêm qua, bấm từng cái mất thời gian. | Cho CSKH chọn nhiều → "Nhận xử lý" cho chính mình (không giao cho người khác). | Gợi ý |
| 10 | MH-OA-06 hành động | Không có nút nhờ giám sát khi gặp khách nóng tính hoặc dọa đăng mạng. | Khách dọa "đăng group", đòi gặp quản lý. Tôi cần Hương vào trong vài phút. | Thêm nút `Báo giám sát` (bắt buộc ghi 1 dòng lý do). Giám sát nhận thông báo ngay, ticket tự lên mức Khẩn. Quy tắc "Khiếu nại gấp" cũng nên tự đặt Khẩn và báo giám sát. | Nên sửa |
| 11 | MH-OA-05 #10 tin xác nhận | Câu mặc định "em sẽ phản hồi trước {han_sla}" không rõ là hạn phản hồi (30′) hay hạn xử lý (2 ngày). Nếu hiện "17:30 01/10" thì khách hiểu là xong trước giờ đó. | Khách sẽ giữ đúng câu này để trách: "em hứa hôm nay mà". | Tách hai biến `{han_phan_hoi}` và `{han_xu_ly}`. Câu mặc định chỉ hứa điều chắc chắn: "đã tiếp nhận, em sẽ báo lại anh trong hôm nay". Cho tôi sửa câu trước khi gửi. | Nên sửa |
| 12 | MH-OA-03 #2, thao tác "Xem" SĐT | Tôi là người xử lý ticket mà SĐT vẫn ẩn, bấm Xem thì chỉ hiện 10 giây. | Bảo hành hay phải gọi lại khách. 10 giây không đủ để bấm số, lần nào cũng phải bấm lại. | Người xử lý ticket đang mở là "người phụ trách" nên được xem SĐT của khách đó (vẫn ghi nhật ký một lần mỗi ticket). Thêm nút sao chép SĐT hoặc gọi qua tổng đài nếu có. | Nên sửa |
| 13 | MH-OA-04 Gửi · UAT | Chưa nói gì về mạng chậm: bấm Gửi hai lần có ra hai tin không, mất mạng thì chữ đang gõ có còn không. | Mạng văn phòng giờ cao điểm chậm 5–10 giây. Khách nhận 2 tin giống nhau thì trông rất ẩu. | Khi đang gửi thì khóa nút, bấm lần hai không tạo tin mới. Giữ nháp theo từng hội thoại khi chuyển qua hội thoại khác hoặc tải lại trang. Mất mạng thì hiện `Mất kết nối. Tin chưa gửi, đã giữ nháp.` | Nên sửa |
| 14 | MH-OA-03 ảnh khách gửi · MH-OA-04 #3 | Ảnh khách gửi thường tối và mờ. Tài liệu chưa nói xem ảnh thế nào. Ảnh tôi gửi quá 1 MB thì chỉ báo lỗi. | 1/3 ảnh bảo hành phải xin chụp lại. Ảnh chụp từ điện thoại thường 2–4 MB. | Trình xem ảnh có phóng to, xoay, tải về. Có sẵn mẫu câu "Anh chụp lại giúp em: rõ mã in trên hàng, đủ sáng". Ảnh gửi đi quá 1 MB thì tự giảm dung lượng thay vì báo lỗi. | Nên sửa |
| 15 | MH-OA-06 / MH-OA-07 · OA-13 | Không có cách bàn giao khi tôi nghỉ phép hoặc hết ca. | Ticket xử lý 2–5 ngày. Tôi nghỉ một ngày thì khách hỏi, người khác không biết đang tới đâu. | Nút `Bàn giao` trên Ticket của tôi: chọn các ticket → người nhận → ghi chú tình trạng (bắt buộc). Thêm trạng thái "Vắng mặt" để ticket mới không giao cho tôi. | Nên sửa |
| 16 | MH-OA-06 "Mở lại" tự động | "Tự động khi khách nhắn trong 72h về cùng vấn đề (người xác nhận)" — ai xác nhận, và làm sao biết là cùng vấn đề? | Khách cảm ơn "ok em" sau khi đóng thì cũng là nhắn lại. | Khách nhắn lại trong 72h thì hiện ở hàng của tôi với nút `Mở lại #TK-…` / `Tạo ticket mới` / `Không cần`. Tin "cảm ơn / ok" không tự mở. | Nên sửa |
| 17 | MH-OA-06 "Chờ khách" | Chờ khách thì dừng SLA, nhưng khách im mãi thì ticket treo mãi. | Nhiều khách được xử lý xong rồi không trả lời nữa. | Chờ khách quá N ngày (cấu hình, vd. 3) thì nhắc tôi: "Đóng ticket?" hoặc tự gửi 1 tin hỏi lại nếu còn khung. | Gợi ý |
| 18 | MH-OA-12 · §3.5 bước 4 | Chuyển sang ZNS thì nội dung tôi đang gõ biến mất. Tôi lại phải chọn mẫu mà không biết mẫu nào hợp. | Đang soạn dở thì bị chặn, mất chữ. | Giữ nháp đã gõ (để ghi chú nội bộ hoặc lần sau khung mở). Gợi ý đúng 1–2 mẫu theo loại ticket, xếp đầu danh sách, có câu mô tả "dùng khi…". | Nên sửa |
| 19 | Thông báo lỗi `Liên hệ admin`, `Liên hệ sale admin` (MH-OA-03, 12) | Tôi không biết admin là ai và liên hệ bằng cách nào. | OA mất kết nối lúc 10h sáng thì cả phòng ngồi chờ. | Ghi tên người phụ trách, có nút `Báo admin` gửi thông báo sẵn kèm tên OA và lỗi. Kèm câu "Trong lúc chờ: gọi khách theo SĐT / ghi chú nội bộ". | Gợi ý |
| 20 | §1.3, MH-OA-02 "OA:" · persona trực OA + Fanpage | Tài liệu chỉ nói OA. Tôi trực cả Fanpage. Chưa rõ Hộp thư CSKH có gộp Fanpage không, và ticket có chung không. | Cùng một khách, sáng nhắn Fanpage, chiều nhắn OA về cùng vụ bảo hành. | Hộp thư CSKH lọc theo **kênh** (OA, Fanpage), không chỉ theo OA. Ticket gắn với khách, không gắn với một hội thoại. Tin mới từ kênh khác về cùng khách thì gợi ý gắn vào ticket đang mở. | Nên sửa |
| 21 | MH-OA-03 · UAT-OA-25 | Trả lời trên oa.zalo.me thì hiện `OA (ngoài VClinks)`, tôi không biết ai đã trả lời. | Đồng nghiệp trả lời trên điện thoại qua app OA. | Nếu Zalo không cho biết người gửi thì ghi rõ `Trả lời trên app OA — không rõ người gửi`. Nên có quy định chung là mọi người trả lời qua VClinks (Q-OA-11). | Gợi ý |
| 22 | MH-OA-04 #8 Yêu cầu chia sẻ thông tin | Khách lớn tuổi hoặc chủ gara thấy tin "chia sẻ thông tin" thì sợ lừa và bấm từ chối. Sau 2 lần là không hỏi được nữa. | Khách hay hỏi lại "em lấy số anh làm gì". | Trước nút có mẫu câu giải thích ngắn ("để tra đơn và bảo hành cho anh") gửi kèm. Hết 2 lượt thì gợi ý "xin SĐT bằng tin thường". | Gợi ý |
| 23 | CS-05 tiêu chí chấp nhận | "Chỉ thấy hội thoại gắn ticket được giao" là quá hẹp. Tôi cần **đọc** lịch sử khách để trả lời đúng (xem #1). | Không đọc được chat cũ thì tôi phải hỏi lại khách. Đó là điều tôi sợ nhất. | Sửa tiêu chí: "Gửi tin chỉ trong ticket được giao; **đọc** được lịch sử hội thoại của khách có ticket (mọi kênh, trong phạm vi quyền)". | Nên sửa |
| 24 | UAT phần MH-OA-02/04 | UAT chưa có ca gặp hằng ngày: khách của sale nhắn OA hỏi bảo hành, hỏi giá mà sale không trả lời, mạng chậm bấm gửi hai lần, bàn giao khi nghỉ. | Đây là 4 việc làm tôi mất thời gian nhất. | Thêm các ca ở mục "Kịch bản UAT tôi muốn thêm". | Nên sửa |

## Câu hỏi của tôi

1. **Q-OA-06:** khách đã có sale mà nhắn OA hỏi "đơn đâu", không có từ khóa bảo hành thì không tự mở ticket. Tôi có được tự mở ticket rồi trả lời luôn không, hay phải hỏi sale trước? Tôi muốn công ty chốt một câu rõ ràng.
2. Ở **MVP** (chưa có ticket, chưa có ZNS) thì tôi làm việc trên màn hình nào? Hộp thư CSKH với các hàng Của tôi / Chưa nhận có từ MVP không, hay tới GĐ2 mới có?
3. SLA phản hồi 30′ tính từ lúc khách nhắn hay từ lúc tôi bấm Nhận xử lý? Nếu tôi nhận muộn thì SLA có tính cho tôi không?
4. Hiệu suất nhân viên (MH-OA-17) có tính số lần "Mở lại" và điểm "Chưa hài lòng" cho tôi không, khi lỗi là do hàng hoặc do sale hứa sai? Tôi cần có ô "nguyên nhân không do CSKH".
5. Công ty có cho tin tư vấn có phí (48h–7 ngày) không (Q-OA-05)? Nếu có, ngân sách bao nhiêu và tôi có phải xin phép từng tin không?
6. Ai soạn mẫu "Kết quả xử lý yêu cầu" và bao giờ có? Nếu Zalo từ chối mẫu thì trong 2–3 ngày chờ tôi báo khách bằng cách nào?
7. Khách nhắn cả OA VCparts lẫn OA VCservice về cùng một vụ thì ai xử lý, và có gộp thành một ticket không?

## Kịch bản UAT tôi muốn thêm

| Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|
| Khách có owner sale Nam; Nam đã nhắn khách qua Zalo cá nhân hôm qua "đổi miễn phí" | Khách nhắn OA "anh Nam hứa đổi miễn phí sao chưa thấy"; Lan mở hội thoại | Panel phải hiện lần liên lạc gần nhất của Nam (kênh, giờ, 1 dòng trích) mà Lan không phải xin quyền; ô soạn có nút `Tạo ticket để trả lời` |
| Khách chưa có SĐT và mã KH | Lan tạo ticket Tình trạng đơn, chọn "Chưa xác định đơn" | Ticket tạo được; khi đóng ticket thì hệ thống bắt chọn đơn |
| Khách hỏi giá, chuyển cho owner sale lúc 09:00; sale không trả lời | Chờ 45′ trong giờ làm việc | Sale và giám sát sale nhận cảnh báo; hội thoại hiện ở "Chưa nhận" của CSKH với nhãn `Sale chưa trả lời 45′` |
| Hội thoại Z1, mạng chậm (giả lập trễ 8 giây) | Lan bấm Gửi 2 lần liền | Khách nhận đúng 1 tin; nút Gửi khóa trong lúc gửi |
| Lan đang gõ dở trong hội thoại A | Chuyển sang hội thoại B rồi quay lại A; hoặc tải lại trang | Nháp ở A còn nguyên |
| Ticket #TK-0131 bảo hành, khách im 9 ngày (Z3), có mẫu "Kết quả xử lý yêu cầu" | Lan bấm Gửi tin mẫu (ZNS) từ ticket | Mẫu "Kết quả xử lý yêu cầu" đứng đầu gợi ý; tham số mã ticket điền sẵn; gửi xong ticket có sự kiện |
| Ticket khiếu nại, khách dọa "đăng group" | Lan bấm `Báo giám sát`, ghi lý do | Giám sát nhận thông báo trong ≤ 1 phút; ticket lên mức Khẩn; nhật ký ghi lý do |
| Lan có 9 ticket mở, mai nghỉ phép | Chọn 5 ticket → Bàn giao cho Mai, ghi tình trạng | Mai thấy 5 ticket kèm ghi chú bàn giao; Lan bật "Vắng mặt" thì không nhận ticket mới |
| Ticket đã đóng 2 giờ trước | Khách nhắn "ok cảm ơn em" | Ticket không tự mở lại; Lan thấy tin với các nút Mở lại / Tạo mới / Không cần |
| Khách nhắn Fanpage sáng và OA chiều về cùng vụ bảo hành | Lan mở hội thoại OA | Thấy ticket đang mở từ Fanpage; được gợi ý gắn tin OA vào ticket đó, không tạo ticket thứ hai |
| Khách gửi ảnh 3 MB, tối | Lan mở ảnh, phóng to, xoay; gửi lại khách một ảnh mẫu 2,5 MB | Xem ảnh được; ảnh gửi đi tự giảm dung lượng, khách nhận được |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/04-P-CS.md) | — |
