# Góp ý 05 — P-KD (Minh, NVKD nhận lead)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Minh (P-KD, NVKD nhận lead) góp ý đặc tả 05 Marketing, quảng cáo, chatbot, vòng 1; file lưu ngày 30/09/2026.
- 18 góp ý: **3 Chặn · 12 Nên sửa · 3 Gợi ý**; kèm 8 câu hỏi và 11 ca UAT đề xuất (UAT-MK-KD-01…11).
- Nhận xét chung: tài liệu viết như thể sale ngồi máy tính cả ngày, trong khi sale gọi và nhắn khách bằng điện thoại, nick Zalo công ty.
- Chặn: không có bản điện thoại cho Hộp thư lead; liên hệ lead qua nick Zalo không nối vào lead; tự thu hồi lead khi đang gọi và chưa rõ ai được tính công.
- Nên sửa: lead đêm cùng hạn 08:30, người nhận phải bấm "Hiện số", lead không có đường liên hệ vẫn chạy SLA, "Đây là khách của tôi", lead rác không tính SLA sale.
- Kết quả xử lý ở [05-xu-ly.md](05-xu-ly.md): 17 đã sửa, 1 hỏi chủ dự án (điện thoại ở MVP, D-MK-12).
- Còn mở: phần điện thoại tối thiểu ở MVP (D-MK-12), mức SLA (D-MK-6), công lead (D-MK-13).

## Mục lục

- [Một ngày nhận lead của tôi](#một-ngày-nhận-lead-của-tôi)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Tôi thích việc lead có nguồn, có nhu cầu, có đồng hồ. Hôm nay marketing ném lead cho tôi qua Zalo, tôi không biết khách hỏi gì, từ đâu. Nhưng tài liệu này viết như thể tôi ngồi trước máy tính cả ngày. Thật ra 9h30 tôi đã chạy xe đi garage, gọi khách bằng điện thoại, nhắn bằng nick Zalo công ty. Nếu hệ thống không thấy những việc đó thì SLA 5 phút sẽ đỏ cả ngày, lead bị thu hồi trong lúc tôi đang gọi, và cuối tháng đơn không được tính cho tôi. Ba chỗ đó phải sửa trước khi làm tiếp.

## Một ngày nhận lead của tôi

Hôm đó là thứ Tư, chiến dịch "Má phanh Vios tháng 10" đang chạy mạnh.

| Giờ | Việc | Màn hình | Tôi làm gì, mất bao lâu | Thiếu gì |
|---|---|---|---|---|
| 21:00 tối qua | Ba khách điền form web, một khách nhắn Fanpage từ quảng cáo | Không | Tôi thấy chuông trên điện thoại nhưng ngoài giờ nên không làm gì | Không biết có nên trả lời không. Nếu trả lời ngay thì có được tính không, hay vẫn tính từ 8h |
| 07:45 | Mở điện thoại trên đường đi làm | Không có màn hình di động | Không mở được Hộp thư lead, vì tài liệu chỉ vẽ desktop 1440 px | Danh sách lead trên điện thoại, bấm là gọi được |
| 08:00 | Mở laptop. "Lead của tôi" có 15 lead: 6 lead đêm qua, 9 lead sáng nay | MH-MK-06 tab "Lead của tôi" | 6 lead đêm qua cùng hạn 08:30. Mỗi cuộc gọi 3–5 phút, nên tôi chỉ gọi kịp khoảng 6–8 khách trong 30 phút | Hạn ngoài giờ không được dồn hết vào cùng một mốc. Tôi cần biết lead nào gọi trước |
| 08:05 | Mở lead đầu tiên, đọc nhu cầu | MH-MK-07 | Đọc "Má phanh trước Vios 2019, cần 2 bộ" rồi bấm "Hiện số". Số chỉ hiện 30 giây, tôi phải chép ra điện thoại | Tôi là người nhận thì phải thấy đủ số và bấm gọi được luôn. Tôi cần biết khách là garage hay khách lẻ, ở khu nào, có gửi ảnh hay VIN không |
| 08:10 | Gọi khách, khách nghe máy, xin Zalo để gửi ảnh và giá | MH-MK-07 "Ghi nhận cuộc gọi" | Ghi nhận mất khoảng 20 giây. Sau đó tôi kết bạn bằng nick Zalo công ty trên điện thoại | Hội thoại Zalo mới có nối với lead không? Báo giá gửi qua Zalo thì lead có lên "Đã báo giá" không? Tài liệu không nói |
| 08:20 | Lead thứ 3 là Gara Minh Phát, khách của tôi. Chủ garage điền bằng số cá nhân | MH-MK-06 | Lead được giao cho Tuấn theo vòng tròn, vì số này chưa có trong hồ sơ | Tôi không có nút "Khách này của tôi". Chỉ có "Trả lead" với lý do sai khu vực hoặc sai division |
| 08:25 | Lead thứ 5 chỉ có tên Facebook, không có SĐT | MH-MK-07 | Tôi không gọi được. Phải trả lời trong Inbox Fanpage, mà khách đã offline | Nên ghi rõ "Liên hệ bằng: nhắn Fanpage" và tính SLA theo tin tôi gửi |
| 08:30 | Lead thứ 7 là follow OA, không có tin nhắn, không có SĐT | MH-MK-06 | Không có cách liên hệ, nhưng đồng hồ vẫn chạy | Lead kiểu này không nên giao cho sale với SLA 5 phút |
| 08:40 | Hai lead rác: một số 0123…, một lead nhắn "bên em bán má phanh giá sỉ" (đối thủ) | MH-MK-06 "Đánh dấu không hợp lệ" | Mất 1 phút mỗi lead | Lead đó vẫn tính vào thời gian liên hệ của tôi. Tôi cũng không biết marketing có thấy tôi trả lại không |
| 08:45 | Hai lead cũ quá SLA, bị thu hồi sang Tuấn trong lúc tôi đang gọi lead khác | MH-MK-06 | Tôi mất lead, không kịp làm gì | Chỉ có "Ghi nhận cuộc gọi", không có "Đang xử lý" hay "Hẹn gọi lại lúc…" |
| 09:30 → 16:30 | Đi 5 garage. Có 6 lead mới trong ngày | Thông báo web | Tôi chỉ có điện thoại. Hai lead quá SLA vì đang nói chuyện với chủ garage | Thông báo trên điện thoại. Bấm gọi rồi ghi kết quả ngay trên điện thoại |
| 11:00 | Lead web hỏi "giá má phanh bao nhiêu", bot không trả lời được, khách bực | MH-MK-07 | Tôi phải xem lại bot hỏi khách những gì, rồi mở VCsales tra giá | Nút "Tra giá / Tạo báo giá" ngay trong chi tiết lead. Khách còn trên web hay đã rời? |
| 17:00 | Chấm chất lượng lead | MH-MK-07 "Chất lượng" | Mỗi lead phải mở lại, khoảng 15 lead mất 10 phút | Chấm nhanh ngay trên dòng trong danh sách. Lý do "Kém" chọn nhanh |
| Cuối tháng | Khách lead ngày 1/10 đặt đơn ngày 20/11 qua Zalo, mã KH mới tạo | Không có | Lead không lên "Thành đơn" vì chưa liên kết mã KH | Không biết ai được tính công: tôi (gọi lần đầu) hay Tuấn (nhận lại sau thu hồi) |

## Góp ý

| # | Màn hình / story / UAT (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-MK-06, MH-MK-07, MK-US-30, MK-05 | Không có đặc tả trên điện thoại cho Hộp thư lead và Chi tiết lead. Thông báo chỉ là thông báo web kèm âm thanh | Buổi chiều tôi đi garage, chỉ có điện thoại. SLA 5 phút mà thông báo chỉ hiện trên laptop thì chắc chắn quá hạn | Có bản điện thoại cho "Lead của tôi" và chi tiết lead. Thông báo đẩy tới điện thoại. Nút gọi dùng `tel:`. Gọi xong hiện ngay hộp "Ghi nhận cuộc gọi" với 4 nút kết quả, một chạm là xong. Thêm tiêu chí "làm trên điện thoại được" vào MK-US-30 và MK-US-31 | **Chặn** |
| 2 | §4.4 "Đã liên hệ", MH-MK-07 "Mở hội thoại", MK-US-31 | Tôi hay liên hệ lead bằng nick Zalo công ty (kết bạn qua SĐT rồi nhắn). Tài liệu chỉ tính "tin gửi qua VClinks" trên kênh gốc của lead hoặc cuộc gọi. Không nói hội thoại Zalo mới có tự nối vào lead không | Nếu không nối được thì lead nằm mãi ở "Đã liên hệ". Báo giá gửi qua Zalo không làm lead lên "Đã báo giá", đơn không tính cho lead. Marketing sẽ nghĩ tôi không làm | Trong chi tiết lead có nút "Nhắn Zalo" (chọn nick của tôi, tìm theo SĐT, tôi tự bấm gửi, theo BR14). Hội thoại Zalo có cùng SĐT với contact của lead thì tự thành điểm chạm của lead. Tin đầu tiên tôi gửi qua Zalo được tính là "Đã liên hệ". Báo giá gửi qua bất kỳ kênh nào của contact đều tính "Đã báo giá" | **Chặn** |
| 3 | §4.4 thu hồi, MK-07, MK-US-34, UAT-MK-20 | Tự thu hồi sau 3 lần SLA (15 phút) khi tôi đang gọi hoặc đang ngồi với khách. Tài liệu cũng không nói ai được tính công khi lead ra đơn sau khi đã chuyển người | Tôi sợ nhất là mất khách và mất KPI. 15 phút là quá ngắn khi đang đi đường. Không rõ ai được tính công thì trong tổ sẽ cãi nhau | (a) Có nút "Tôi đang xử lý, hẹn gọi lúc…" (tối đa 2 giờ, một lần mỗi lead), trong thời gian đó dừng thu hồi và báo giám sát. (b) Người đang ở ca đi thị trường thì SLA mặc định dài hơn, ví dụ 30 phút (cấu hình ở MH-MK-08). (c) Ghi rõ quy tắc: công lead ra đơn tính cho **người nhận lead lúc có báo giá hoặc đơn**. Nếu người cũ đã liên hệ thì giám sát quyết định, có nhật ký. Không để hệ thống tự chia | **Chặn** |
| 4 | §4.4, MK-06, UAT-MK-15 | Mọi lead ngoài giờ cùng hạn "giờ mở cửa + 30 phút". Sáng có 6–10 lead đêm qua thì không ai gọi kịp. Lead sẽ quá SLA hàng loạt rồi bị thu hồi lúc 9h30 | Số liệu "liên hệ trong SLA" của tôi xấu đi vì chuyện không làm được, không phải vì tôi lười | Hạn lead ngoài giờ giãn theo thứ tự: lead thứ n hạn = mở cửa + 30 phút + n × 5 phút. Hoặc chia lead đêm cho nhiều người ngay lúc 8h, không dồn cho người được giao lúc 21h. Sáng mở ra có danh sách "Gọi theo thứ tự này" | **Nên sửa** |
| 5 | MH-MK-06 cột "Khách", MH-MK-07 "Hiện số", MK-14 | Wireframe và bảng đều ẩn SĐT, "Hiện số" chỉ 30 giây và ghi nhật ký. Không nói người nhận lead được thấy số đầy đủ | Lead giao cho tôi để tôi gọi. Bấm hiện số rồi chép sang điện thoại là thêm bước, dễ gọi nhầm số | Người nhận lead và giám sát của tổ thấy đủ SĐT, bấm gọi và sao chép được. Ẩn số chỉ áp cho marketing sau khi giao (§4.6). Ghi rõ trong MH-MK-06 #9 và MH-MK-07 #2 | **Nên sửa** |
| 6 | MH-MK-07, §4.1 | Chi tiết lead thiếu những thứ tôi cần để gọi: khách là garage hay khách lẻ, khu vực, dòng xe/VIN, ảnh khách gửi bot, câu khách hỏi nguyên văn, khách đã mua của công ty chưa (tên người phụ trách cũ nếu có) | Gọi mà không biết khách là garage hay khách lẻ thì tôi báo giá sai chính sách, khách thấy mình không chuyên nghiệp | Khối "Nhu cầu" hiện đủ: biến kịch bản (dòng xe, khu vực, loại khách), ảnh/VIN, câu hỏi nguyên văn của khách. Đầu drawer có dòng "Khách mới / Khách cũ của {tên} / Có thể trùng với {khách}" | **Nên sửa** |
| 7 | §2.1 lead "chưa có SĐT", §4.4, MK-05 | Lead follow OA không có tin nhắn và không có SĐT vẫn được giao cho sale với SLA 5 phút. Lead Fanpage không có SĐT thì chỉ nhắn lại được trong cửa sổ 24h | Tôi không có cách nào liên hệ, nhưng đồng hồ vẫn chạy và số liệu vẫn tính cho tôi | Chỉ giao cho sale khi lead có ít nhất một đường liên hệ (SĐT, hoặc hội thoại còn trong cửa sổ gửi). Lead chỉ có follow thì ở lại "Chờ thông tin" do bot/marketing nuôi. Chi tiết lead ghi rõ "Liên hệ bằng: Gọi / Nhắn Fanpage (còn 18 giờ) / Nhắn OA" | **Nên sửa** |
| 8 | MH-MK-07 "Trả lead", MK-US-32, §4.3 | Trả lead chỉ nhận lý do sai khu vực hoặc sai division. Không có ca lead là **khách của tôi** nhưng bị giao cho người khác, hay lead là **khách của đồng nghiệp** nhưng giao cho tôi | Garage hay dùng số cá nhân của chủ, của thợ, nên hồ sơ chưa gộp. Hai sale cùng gọi một garage là mất mặt và dễ tranh chấp | Thêm "Đây là khách của tôi" / "Đây là khách của {đồng nghiệp}". Nút này gửi yêu cầu gộp hồ sơ và chuyển lead cho giám sát duyệt (theo F12.5, BR05). Trong lúc chờ, cả hai người thấy cờ "Đang tranh chấp", lead không bị thu hồi | **Nên sửa** |
| 9 | MH-MK-06 "Lead của tôi", Inbox "Của tôi" (KD-01) | Lead nằm trong menu Marketing, tách khỏi Inbox "Của tôi". Thông báo 403 ở MH-MK-06 lại nói "lead được giao sẽ hiện trong Hộp thư của bạn". Hai chỗ nói khác nhau | Tôi không muốn mở thêm một màn hình. Việc hằng ngày của tôi ở Inbox "Của tôi" | Lead được giao hiện trong Inbox "Của tôi" với nhãn "Lead" và đồng hồ SLA, xếp theo KD-01 (quá SLA lên đầu). Tab "Lead của tôi" ở MH-MK-06 vẫn giữ để lọc và chấm chất lượng. Sửa lại câu thông báo 403 cho khớp | **Nên sửa** |
| 10 | §4.6, MK-14, MH-MK-10 #9 | §4.6 đã hợp lý: marketing không đọc tin tôi nhắn. Nhưng chưa nói ghi chú cuộc gọi, lý do thất bại tự gõ và "AI tóm tắt" sau khi giao có hiện cho marketing không | Ghi chú cuộc gọi có khi tôi viết "khách chê giá cao hơn chỗ X 50k", là chuyện nội bộ bán hàng | Marketing chỉ thấy lý do dạng chọn sẵn (danh sách §4.3, §MH-MK-07 #4), không thấy ghi chú tự do. Ghi chú cuộc gọi chỉ người nhận, giám sát và giám đốc bán hàng thấy. Ghi rõ vào bảng §4.6 | **Nên sửa** |
| 11 | MH-MK-10 #9 "Thời gian liên hệ theo NV", §4.3 | Lead rác, đối thủ, lead không có đường liên hệ vẫn tính vào thời gian liên hệ và tỷ lệ trong SLA của tôi | Số của tôi xấu vì lead kém, trong khi marketing lại được "bảo vệ chất lượng lead" | Lead đánh "Không hợp lệ" trong vòng 24h thì không tính vào chỉ số SLA của sale. Báo cáo theo NV tách riêng "lead hợp lệ" và "tất cả" | **Nên sửa** |
| 12 | MH-MK-07 "Chất lượng", MK-US-14 | Chấm chất lượng phải mở từng lead. Chỉ có Tốt/TB/Kém, "Kém" không có lý do. Không có story nào cho sale phản hồi chất lượng lead cho marketing | Cuối ngày không ai chấm 15 lead. Marketing cần biết vì sao kém thì mới sửa quảng cáo được | Chấm ngay trên dòng ở MH-MK-06 (3 nút). Chọn "Kém" thì hiện lý do nhanh: hỏi cho biết, sai đối tượng, ngoài khu vực, chỉ so giá. Nhắc chấm khi đổi trạng thái lần đầu. Thêm story KD "chấm và phản hồi chất lượng lead" | **Nên sửa** |
| 13 | §3.5 "Bot không nói giá", MH-MK-05 #9 "Thường trả lời trong {n} phút" | Khách vào từ quảng cáo "má phanh Vios" thì câu đầu tiên là hỏi giá. Bot không trả lời, ngoài giờ khách chờ tới sáng. Ở bất kỳ giờ nào, đầu khung cũng hứa "trả lời trong 5 phút" | Khách thấy hứa 5 phút mà không ai trả lời thì mắng sale lúc tôi gọi. Tôi đồng ý bot không được nói giá | Bot nói rõ: "Giá phụ thuộc đời xe. Nhân viên sẽ gọi báo giá trong giờ làm việc (từ 8h)". Chỉ hiện "Thường trả lời trong …" khi trong giờ và có người online. Chi tiết lead có nút "Tra giá" (F9.1) và "Tạo báo giá" (KD-07) với nhu cầu điền sẵn | **Nên sửa** |
| 14 | §3.1 C5, MK-US-33, MH-MK-07 | Lead web: khách rời trang thì tôi không nhắn được nữa. Chi tiết lead không cho biết khách còn đang ở trên web hay không | Tôi sẽ gõ trả lời vào khung chat web trong khi khách đã đi, mất thời gian vàng | Đầu chi tiết lead có dấu "Khách đang online trên web" / "Đã rời lúc 10:15". Khách đã rời thì nút chính đổi thành "Gọi" / "Nhắn Zalo" | **Nên sửa** |
| 15 | §4.5, MK-16, UAT-MK-23 | Lead khách mới chưa có mã KH thì không lên "Thành đơn" được, phải chờ sale admin liên kết. Tôi không có cách nào nhắc | Đơn đầu của khách mới là đơn tôi cần tính công nhất | Trong chi tiết lead có nút "Yêu cầu liên kết mã KH" gửi sale admin. Khi liên kết xong, hệ thống tự đối chiếu lại đơn trong 60 ngày và báo cho tôi | **Nên sửa** |
| 16 | §2.4 trạng thái, "Không liên lạc được sau 3 lần" | Tài liệu không nói ai đếm 3 lần, cũng không nhắc gọi lại sau lần "Không nghe". Chuyển "Đã liên hệ" sang "Đang tư vấn" phải làm tay | Thêm việc bấm tay. Tôi dễ quên gọi lại lần 2 | "Không nghe" hoặc "Thuê bao" thì tự tạo nhắc gọi lại (sau 2 giờ, rồi sáng hôm sau). Đủ 3 lần thì gợi ý Thất bại, tôi bấm xác nhận. Khách trả lời tin thì tự chuyển "Đang tư vấn" | **Gợi ý** |
| 17 | §4.4 "Theo tải (ít lead mở nhất)", MH-MK-08 | Chia theo tải tính lead mở. Người chăm lead lâu (đang báo giá) bị coi là "tải cao", ít được chia | Người làm kỹ thiệt, người đóng lead nhanh cho xong lại được lợi | Tải chỉ tính lead ở "Đã giao" và "Đã liên hệ", không tính "Đang tư vấn" và "Đã báo giá". Hoặc cho giám đốc bán hàng chọn cách tính | **Gợi ý** |
| 18 | MH-MK-06 #20 thông báo | Chiến dịch lớn một ngày có thể 20–30 thông báo có âm thanh | Tôi sẽ tắt âm thanh, rồi bỏ lỡ lead | Gộp thông báo: "3 lead mới trong 5 phút". Chỉ kêu với lead giao cho tôi, không kêu với lead của tổ | **Gợi ý** |

## Câu hỏi của tôi

1. Lead ra đơn thì doanh số và thưởng tính cho ai: người gọi đầu tiên, người đang giữ lead, hay owner của khách? Có ghi vào KPI trên VCsales không, hay chỉ là số trong VClinks?
2. Lead "Khách cũ quay lại" từ quảng cáo là khách của tôi. Tôi offline quá X phút, đồng nghiệp trả lời thay. Khách và lead vẫn là của tôi phải không? Đồng nghiệp có được tính công không?
3. Trả lời lead lúc 21h (ngoài giờ) có được tính "liên hệ nhanh" không, hay tôi bị ép trả lời đêm vì so sánh với người khác?
4. Khi tôi đi thị trường, trạng thái "online" tính thế nào: theo app trên điện thoại, theo ca, hay tôi tự bật?
5. Tôi có được đánh "Không hợp lệ – Đối thủ" không, hay chỉ marketing? Tôi đánh rồi thì marketing có khôi phục lại và giao lại cho tôi không?
6. Lead web khách chưa đồng ý dữ liệu, chỉ chat ẩn danh rồi gõ SĐT bị che: tôi có được gọi số đó không?
7. Nếu tôi kết bạn Zalo với lead mà lead chưa đồng ý (lead Fanpage hay OA không có ô đồng ý) thì có vi phạm gì không? Ai chịu?
8. Giám sát có thấy danh sách lead tôi để quá SLA trong họp sáng không? Có bị trừ điểm không?

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Tên | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| UAT-MK-KD-01 | Ghi nhận cuộc gọi trên điện thoại | Lead giao Lan; Lan chỉ dùng điện thoại 390 px | Mở thông báo → bấm gọi → quay lại app | Hiện hộp kết quả cuộc gọi; một chạm "Nghe máy" → SLA dừng, trạng thái Đã liên hệ. Tổng thời gian dưới 10 giây |
| UAT-MK-KD-02 | Liên hệ lead qua nick Zalo | Lead web 0900 000 001; nick Zalo của Lan chưa kết bạn | Chi tiết lead → "Nhắn Zalo" → Lan gõ và gửi | Hội thoại Zalo gắn vào contact và lead; lead Đã liên hệ; không có tin nào tự gửi. Báo giá gửi qua Zalo → lead "Đã báo giá" |
| UAT-MK-KD-03 | Hẹn gọi lại, không bị thu hồi | Quy tắc HN: SLA 5 phút, tự thu hồi 3× | Lan bấm "Đang xử lý, hẹn gọi 10:30" ở phút 3 | Tới 10:30 không thu hồi; giám sát thấy hẹn; quá 10:30 mà chưa liên hệ thì quay lại luồng quá SLA |
| UAT-MK-KD-04 | Sáng nhiều lead đêm | 8 lead vào từ 21:00–23:00 thứ Ba, cùng quy tắc | Mở lúc 08:00 thứ Tư | Hạn liên hệ giãn theo thứ tự (hoặc chia cho nhiều người); không lead nào tự thu hồi trước 09:00; danh sách "gọi theo thứ tự" đúng |
| UAT-MK-KD-05 | Lead là khách của tôi dưới số khác | Gara Minh Phát owner Minh; chủ garage điền form bằng số mới 0900 000 007; lead giao Tuấn | Tuấn hoặc Minh bấm "Đây là khách của {Minh}" | Tạo yêu cầu gộp + chuyển tới GS; lead có cờ tranh chấp, không thu hồi; GS duyệt → lead và điểm chạm về Minh, có nhật ký |
| UAT-MK-KD-06 | Công lead sau khi thu hồi | Lead A giao Lan, quá SLA, tự thu hồi sang Tuấn; Tuấn báo giá, ra đơn | Xem báo cáo theo NV và chi tiết lead | Lead Thành đơn ghi công theo quy tắc đã chốt; tiến trình hiện đủ ai gọi, ai báo giá; Lan và Tuấn đều thấy |
| UAT-MK-KD-07 | Lead không có đường liên hệ | Webhook follow OA từ quảng cáo, không tin nhắn, không SĐT | – | Lead ở "Chờ thông tin", không giao sale, không chạy SLA; khi khách chia sẻ SĐT thì mới giao |
| UAT-MK-KD-08 | Người nhận thấy đủ số, marketing không thấy ghi chú | Lead giao Lan, Lan ghi chú cuộc gọi "khách chê giá" | Lan mở chi tiết; Hà-mk mở chi tiết | Lan thấy SĐT đầy đủ, bấm gọi được, không cần "Hiện số". Hà-mk thấy SĐT ẩn, thấy kết quả cuộc gọi dạng chọn sẵn, không thấy ghi chú |
| UAT-MK-KD-09 | Lead rác không làm xấu số của sale | Lan nhận 5 lead, 2 lead đánh Không hợp lệ – Đối thủ trong 1 giờ | Xem MH-MK-10 "Thời gian liên hệ theo NV" | 2 lead rác không tính vào % trong SLA của Lan; CPL không tính 2 lead đó |
| UAT-MK-KD-10 | Lead web khách đã rời trang | Khách gửi form rồi đóng tab | Lan mở chi tiết lead sau 10 phút | Hiện "Đã rời lúc …"; nút chính là Gọi / Nhắn Zalo; tin gõ vào khung web hiện cảnh báo "khách chỉ thấy khi quay lại" |
| UAT-MK-KD-11 | Liên kết mã KH rồi tính đơn | Lead khách mới đã báo giá, chưa có mã KH; VCsales tạo đơn ngày 20 | Lan bấm "Yêu cầu liên kết mã KH"; SA liên kết | Lead tự "Thành đơn" sau khi liên kết; Lan nhận thông báo |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/05-P-KD.md) | — |
