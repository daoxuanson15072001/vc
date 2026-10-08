# Góp ý 06 — P-KD (Minh)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý của P-KD (Minh, nhân viên kinh doanh) cho đặc tả 06 Hóa đơn VAT và công nợ, viết từ phía người bán hàng.
- Đi qua 5 tình huống: khách xin hóa đơn, khách hỏi "hóa đơn đâu", kế toán nhắc nợ đúng lúc đang chốt đơn, khách quá hạn vẫn đặt hàng, buổi chiều chỉ có điện thoại.
- 14 góp ý: 3 Chặn, 7 Nên sửa, 4 Gợi ý.
- Chặn: kế toán nhắc lẻ không báo owner trước và owner không xin giữ lại được; danh sách tự loại khỏi nhắc nợ thiếu ca owner đang có báo giá mở hoặc vừa chat; không có màn nào cho điện thoại.
- Nên sửa: cho tạo phiếu với đơn chưa giao, chip nợ quá hạn trên khung chat, phân vai owner / kế toán khi khách trả lời nhắc nợ, công cụ tự nhắc qua nick, cài đặt "sale nhắc trước", báo owner khi kế toán đã gửi hóa đơn, nút trả lời khách và hối kế toán.
- 6 câu hỏi của NVKD (báo trước bao lâu, bán tiếp cho khách quá hạn, phiếu cho đơn chưa giao, ai trả lời tin OA, có tính KPI, tự nhắc có được ghi nhận) và 8 ca UAT-HD-KD-01…08.
- Kết quả xử lý từng góp ý: xem [06-xu-ly.md](06-xu-ly.md).

## Mục lục

- [Tôi đi qua các tình huống](#tôi-đi-qua-các-tình-huống)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Tôi mừng vì có phiếu yêu cầu hóa đơn. Hôm nay tôi chụp màn hình ảnh giấy phép, gõ lại MST vào Zalo gửi chị Hà, rồi chị Hà nhắn lại hỏi "email gì em", "đơn nào em". Phiếu có tin nguồn, AI tách sẵn, so với lần xuất trước: đúng thứ tôi cần. Panel có dòng "Đang xử lý · Thảo KT" để trả lời khách "hóa đơn đâu em" cũng rất được. Nhưng phần công nợ viết từ phía kế toán. Tôi không được báo khi kế toán nhắc lẻ khách của tôi, không có cách giữ tin nhắc lại khi tôi đang chốt đơn, và tài liệu không tính tới việc buổi chiều tôi chỉ có điện thoại. Ba chỗ đó phải sửa trước khi làm.

## Tôi đi qua các tình huống

| # | Tình huống | Màn hình | Tôi làm gì, bao nhiêu thao tác | Chép tay? | Kế toán hỏi lại? | Thiếu gì |
|---|---|---|---|---|---|---|
| 1 | 14:02, anh Tuấn (Garage Minh Phát) gửi ảnh giấy phép kinh doanh, nhắn "xuất HĐ cho đơn hôm qua nhé" | Chip gợi ý → MH-HD-01 | Nếu đơn hôm qua đã "đã giao" trên VCsales: bấm chip (1), kiểm MST/tên/địa chỉ AI tách, tích "đã kiểm với khách MST mới" (2), tích "đã đối chiếu" (3), "Gửi kế toán" (4). Khoảng 4–5 thao tác, 1 phút | Không, nếu AI đọc đúng ảnh | Có thể: ảnh giấy phép **không có email**, tôi phải hỏi khách rồi quay lại phiếu | (a) Đơn hôm qua thường **chưa giao xong** (xe giao chiều), MH-HD-01 #5 chỉ liệt kê đơn "đã giao" → danh sách rỗng, không gửi được, tôi phải tự nhớ làm lại mai. (b) Không có mẫu câu "hỏi khách phần còn thiếu" |
| 2 | 3 ngày sau, anh Tuấn nhắn "hóa đơn đâu em" | Panel MH-HD-04 | Nhìn panel: "YCHD-0123 · Đang xử lý · Thảo KT · ⏰ quá hạn". Tôi gõ tay trả lời khách, rồi nhắn Zalo riêng hối chị Thảo | Có: gõ tay câu trả lời trạng thái | Không | Không có nút "Hối kế toán" trên phiếu; không có mẫu câu trả lời trạng thái điền sẵn (mã phiếu, ngày dự kiến). Nếu HĐ **đã gửi qua ZNS tới chị Nga** thì tôi chỉ biết khi mở panel, không được báo lúc gửi |
| 3 | 10:00 thứ Sáu, tôi đang báo giá bộ má phanh + đĩa cho anh Tuấn, sắp chốt. 10:05 anh Tuấn nhắn "sao bên em vừa gửi tin đòi nợ anh thế" | Không có | Kế toán bấm "Nhắc (1 khách)" (MH-HD-07). Nhắc lẻ không báo owner (chỉ chiến dịch mới báo, OA-36). Tôi không biết gì, bị khách hỏi bất ngờ, đơn chững lại | – | – | Báo trước cho owner khi nhắc lẻ; cho owner "Giữ lại 2 giờ" khi đang có báo giá / đang chat; khung chat hiện "Kế toán vừa nhắc nợ khách này lúc 09:58 qua ZNS tới chị Nga" |
| 4 | Garage An Khang quá hạn 9 ngày 4 triệu, vẫn nhắn đặt tiếp 2 bộ lọc gió | Khung chat + panel | Phải tự mở tab "Hóa đơn" ở panel mới thấy "Quá hạn: 4.000.000 ₫" chữ đỏ. Không biết có được bán tiếp không, ai quyết | – | – | Cảnh báo ngay trên khung chat / lúc tạo báo giá; quy tắc bán tiếp cho khách quá hạn (hạn mức, ai duyệt) |
| 5 | 15:00, tôi ở garage, chỉ có điện thoại. Anh Tuấn nhắn app Zalo gửi MST xin hóa đơn; một khách khác trả lời tin nhắc nợ trên OA "chuyển rồi em" | App Zalo | Tin Zalo có đồng bộ về VClinks (03 §2.6), nhưng tạo phiếu, gửi hóa đơn, xem công nợ đều là drawer / modal desktop 640–880 px. Tôi chụp màn hình để tối về làm → quay lại cách cũ. Tin OA tôi không đọc được trên điện thoại | Có | Có | Việc "Khách xin hóa đơn chưa tạo phiếu" tự lên danh sách việc khi tôi mở laptop; bản điện thoại tối thiểu cho: tạo phiếu nhanh, gửi hóa đơn, xem nợ |

## Góp ý

| # | Màn/quy tắc (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | §2.4 bước 4, HD-28, MH-HD-07 "Nhắc (1 khách)", 04 OA-36 | Owner chỉ được báo khi khách **nằm trong chiến dịch**. Kế toán nhắc lẻ (MH-OA-12) thì tôi không được báo trước, cũng không có quyền xin giữ lại | Nhắc nợ đúng lúc tôi đang chốt đơn làm khách mất mặt và đổi ý. Khách nghĩ công ty không tin mình. Tôi là người phải xin lỗi | (a) Mọi lần nhắc nợ khách có owner, lẻ hay chiến dịch, đều báo owner trước. (b) Nhắc lẻ vào hàng chờ **2 giờ làm việc** (cấu hình), trong đó owner bấm "Tôi tự nhắc" / "Xin giữ lại" (lý do) / "Đồng ý"; hết giờ không ai bấm thì gửi. (c) Kế toán vẫn gửi ngay được khi chọn "Gấp" kèm lý do, owner vẫn được báo. Thêm vào HD-28, HD-31 và UAT | **Chặn** |
| 2 | HD-30, §2.4 bước 2 | Danh sách "tự loại khỏi nhắc nợ" không có ca **owner đang có báo giá mở / vừa chat với khách trong X giờ / khách vừa đặt đơn mới** | Đây đúng là lúc nhắc nợ phá quan hệ nhất. Kế toán nhìn MH-HD-07 không thấy tôi đang chốt đơn | Thêm (g) "Owner đang trao đổi: có báo giá mở hoặc tin 2 chiều trong 4 giờ gần nhất" → chiến dịch hoãn tin đó tới cuối ngày / hôm sau; nhắc lẻ hiện cảnh báo "Sale {tên} đang trao đổi với khách này". Kế toán thấy lý do, không thấy nội dung chat (giữ N4) | **Chặn** |
| 3 | MH-HD-01, MH-HD-04, MH-HD-05 (toàn file), 03 §2.6 Q14 | Không có màn nào cho điện thoại. Chỉ có dòng "mobile 16 px" ở MH-HD-04 #8 | Chiều nào tôi cũng ở garage. Khách xin hóa đơn, hỏi hóa đơn, trả lời nhắc nợ đúng lúc đó. Không làm được trên điện thoại thì tôi lại chụp màn hình gửi kế toán, đúng việc tài liệu muốn bỏ | (a) Tối thiểu GĐ2: tin "xin hóa đơn" AI nhận ra trên hội thoại mà **tôi trả lời bằng app Zalo** vẫn tạo việc "Khách xin hóa đơn · chưa có phiếu" ở Hộp thư "Của tôi", sáng mở laptop là thấy. (b) Nếu Q14 chọn có mobile: bản điện thoại của MH-HD-01 (1 cột, chỉ đơn + hồ sơ + tin nguồn), "Gửi hóa đơn" từ thông báo, khối công nợ trong 360. Ghi rõ vào tiêu chí KD-17 | **Chặn** |
| 4 | MH-HD-01 #5, HD-03, trạng thái "Rỗng" | Chỉ cho chọn đơn **đã giao**. Khách hay xin hóa đơn ngay khi đặt hoặc lúc hàng đang đi đường | Danh sách rỗng thì "Gửi kế toán" khóa. Tôi phải nhớ mai quay lại tạo phiếu, tin nguồn trôi mất, dễ quên | Cho chọn đơn đã xác nhận nhưng chưa giao, dòng ghi "Chưa giao"; phiếu vào hàng kế toán với nhãn "Chờ giao hàng", kế toán tự quyết khi nào xuất. Hoặc cho "Gửi kế toán" ở trạng thái "Chờ đơn giao", tự chuyển "Chờ kế toán" khi VCsales báo đã giao | **Nên sửa** |
| 5 | Khung chat 03 / 00 MH-UI-07, MH-HD-04 #8 | Nợ quá hạn chỉ thấy khi tôi mở tab "Hóa đơn" ở panel. Không có cảnh báo trên khung chat, cũng không có lúc tạo báo giá / đơn | Khách quen nợ quá hạn vẫn đặt, tôi bán tiếp mà không biết, cuối tháng bị trách. Hoặc tôi biết nhưng không rõ có được bán không | Khách có quá hạn > 0: chip trên đầu khung chat "Quá hạn 4.000.000 ₫ · 9 ngày" (chỉ người có `cust.debt`) và nhắc lại khi tạo báo giá. Ghi rõ quy tắc bán tiếp cho khách quá hạn: VClinks chỉ cảnh báo hay chặn, ai duyệt (theo hạn mức VCsales nếu có) | **Nên sửa** |
| 6 | HD-36, HD-40, §2.4 bước 7–8, 02 DK-22 | Khách trả lời tin nhắc nợ: hội thoại về tôi, bản sao về kế toán, kế toán được gửi mẫu qua OA. **Hai người cùng trả lời được một khách**, không ai thấy người kia đã trả lời chưa | Khách nhận hai câu khác nhau ("em đã nhận" của kế toán, "để em kiểm tra" của tôi) thì mất uy tín. Khách giận ("sao đòi nợ anh") thì kế toán không nên trả lời bằng mẫu | (a) Mục phản hồi hiện "Owner đã trả lời lúc …" / "Kế toán đã gửi mẫu … lúc …" cho cả hai. (b) Tin khách có giọng phàn nàn (AI phân loại) → không cho kế toán gửi mẫu, chuyển "Nhờ owner trả lời". (c) Ghi rõ: về thái độ, quan hệ → owner trả lời; về số tiền, chứng từ → kế toán, owner được xem kết quả | **Nên sửa** |
| 7 | HD-28 ("nhắc lẻ qua nick cá nhân chỉ owner tự gõ"), MH-HD-04 | Tài liệu nói owner tự nhắc qua nick nhưng không có công cụ: không mẫu câu nhắc mềm, không nút ghi nhận "tôi đã nhắc", nên kế toán vẫn nhắc ZNS trùng | Khách quen tôi muốn tự nhắc bằng giọng của mình qua Zalo, không muốn khách nhận ZNS "Kính gửi…" | Trong panel khối Công nợ: nút "Tôi tự nhắc khách" → chèn mẫu `/nhac-no-nhe` vào ô soạn (số lấy lúc gửi, nội dung CK theo HD-34), tôi bấm gửi. Lần gửi đó ghi như một lần nhắc (kênh nick, người gửi) và khách tạm ra khỏi nhắc tự động N ngày | **Nên sửa** |
| 8 | MH-HD-09, HD-29 | Account có cài đặt "Nhắc nợ qua: ZNS kế toán / Sale nhắc" không có. Mọi khách đều đi đường ZNS | Có garage lớn quan hệ lâu năm, chủ garage tự ái khi nhận tin mẫu đòi tiền | Thêm ở MH-HD-09 ô chọn "Cách nhắc nợ: Kế toán gửi tin mẫu (mặc định) / Sale nhắc trước, kế toán nhắc sau {n} ngày nếu chưa trả". Owner đề nghị, kế toán hoặc GS duyệt (như tạm hoãn) | **Nên sửa** |
| 9 | HD-22, HD-19, HD-20, thông báo | Kế toán gửi hóa đơn cho khách của tôi qua OA / ZNS: tôi không được báo, chỉ thấy khi mở panel | Tôi nhận thông báo "Hóa đơn đã phát hành, gửi cho khách" rồi gửi lại lần nữa qua Zalo. Khách nhận hai lần, hoặc tôi trả lời "em chưa gửi" trong khi kế toán đã gửi | Người khác gửi hóa đơn cho khách của tôi → báo owner "Kế toán {tên} đã gửi HĐ {số} qua {kênh} tới {người nhận} lúc {HH:mm}" và thông báo "phát hành, gửi cho khách" cũ tự đóng | **Nên sửa** |
| 10 | MH-HD-04 #2, MH-HD-03 | Khách hỏi "hóa đơn đâu em": tôi thấy trạng thái nhưng phải gõ tay trả lời và nhắn riêng hối kế toán | Mỗi ngày vài khách hỏi. Gõ tay "dạ phiếu em gửi kế toán hôm 29, đang xử lý" là việc lặp lại | (a) Dòng phiếu ở panel có nút "Trả lời khách" chèn mẫu điền sẵn theo trạng thái (Chờ kế toán / Đang xử lý / Đã xuất – đã gửi qua … lúc …). (b) Nút "Hối kế toán" (1 lần / phiếu / ngày) gửi thông báo cho người xử lý, ghi vào hoạt động phiếu | **Nên sửa** |
| 11 | MH-HD-01 #21, #22, HD-06 | Phải tích "đã đối chiếu" cả khi chọn hồ sơ đã lưu, không đổi gì, không có trường AI | Khách quen xin hóa đơn hằng tháng cùng MST. Tích thừa là thêm bước, lâu dần tích theo thói quen, mất ý nghĩa | Chỉ bắt tích #22 khi có trường AI điền hoặc có trường khác hồ sơ đã lưu. Chọn hồ sơ mặc định không đổi → "Gửi kế toán" chỉ cần 2 thao tác (mở phiếu, gửi) | **Gợi ý** |
| 12 | MH-HD-01 #13, HD-03, thiếu thông tin | Phiếu thiếu email / địa chỉ (ảnh giấy phép không có email) thì chỉ khóa nút. Không có cách hỏi khách nhanh | Tôi phải tự soạn câu hỏi khách, rồi nhớ mở lại nháp | Nút "Hỏi khách phần còn thiếu" chèn mẫu vào ô soạn liệt kê đúng trường thiếu ("Anh cho em xin email nhận hóa đơn ạ"); phiếu tự lưu nháp, tin trả lời của khách AI điền tiếp vào nháp và báo tôi | **Gợi ý** |
| 13 | MH-HD-09 #1–#2, panel 360 | Đặt người liên hệ thanh toán chỉ ở tab MH-DK-01 hoặc nút "Chọn" của kế toán. Trong nhóm Zalo với garage, chị kế toán garage hay nhắn, tôi không đặt được ngay từ tin của chị | Tôi biết ai trả tiền ở garage, kế toán thì không. Phải đi sang trang khác thì tôi để mai, rồi quên | Menu trên tin / tên người trong nhóm: "Đặt làm người nhận thanh toán". Người liên hệ chỉ có Zalo (chưa có SĐT V2) vẫn đặt được cho **hóa đơn** và nhắc qua sale; chỉ ZNS mới cần SĐT V2+ | **Gợi ý** |
| 14 | HD-21, UAT-HD-33 | Hóa đơn chưa gửi 48 giờ → báo giám sát. Không phân biệt lỗi do tôi hay do khách chưa phản hồi / kế toán đã gửi email | Tôi sợ bị soi vì chuyện không phải lỗi mình | Trước khi báo giám sát, nhắc tôi lần hai với nút nhanh "Khách lấy bản giấy / Khách đã nhận qua email / Gửi ngay". Thông báo giám sát ghi rõ HĐ đã có thông báo tới owner lúc nào | **Gợi ý** |

## Câu hỏi của tôi

1. Kế toán nhắc lẻ khách của tôi thì tôi có được báo trước không, trước bao lâu? Tôi có quyền giữ lại không, hay chỉ xin?
2. Khách quá hạn vẫn đặt hàng: tôi có được bán tiếp không, ai quyết? VClinks chỉ cảnh báo hay chặn báo giá?
3. Hóa đơn cho đơn chưa giao: tôi gửi phiếu trước được không, hay phải chờ hàng giao?
4. Khi khách trả lời tin nhắc nợ trên OA mà tôi đang ở ngoài, ai trả lời trước? Tôi có đọc được tin OA trên điện thoại không (Q14)?
5. Việc nhắc nợ, phiếu hóa đơn có tính vào chỉ số của tôi (thời gian gửi hóa đơn, số phiếu "Cần bổ sung") không? Giám sát có xem theo từng người không?
6. Tôi tự nhắc khách qua Zalo thì có được ghi nhận là đã nhắc, để kế toán không nhắc thêm không?

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| UAT-HD-KD-01 | K1 owner U-KD1; U-KD1 có báo giá mở với K1 lúc 09:50 | 10:00 U-KT bấm "Nhắc (1 khách)" K1 | U-KD1 nhận thông báo trước khi gửi, có "Tôi tự nhắc / Xin giữ lại / Đồng ý"; U-KT thấy "Sale Nguyễn An đang trao đổi với khách này"; không tin nào đi trước khi hết hàng chờ hoặc U-KD1 đồng ý |
| UAT-HD-KD-02 | K1 trong chiến dịch nhắc đã duyệt, U-KD1 chat 2 chiều với K1 lúc 08:40 | Chiến dịch chạy 09:00 | Tin K1 hoãn, lý do "Owner đang trao đổi"; báo cáo chiến dịch ghi lý do |
| UAT-HD-KD-03 | Đơn DH-4 của K1 đã xác nhận, chưa giao | U-KD1 tạo phiếu từ tin xin hóa đơn | Chọn được DH-4 (ghi "Chưa giao"); phiếu nhãn "Chờ giao hàng"; khi VCsales báo đã giao, phiếu tự vào "Chờ kế toán" |
| UAT-HD-KD-04 | K11 quá hạn 9 ngày | U-KD2 mở hội thoại K11, rồi tạo báo giá | Chip "Quá hạn 4.000.000 ₫ · 9 ngày" trên khung chat; nhắc lại ở bước tạo báo giá |
| UAT-HD-KD-05 | U-KD1 trả lời K1 bằng app Zalo trên điện thoại; K1 gửi MST xin hóa đơn | Hôm sau U-KD1 mở VClinks | Hộp thư "Của tôi" có việc "Khách xin hóa đơn · chưa có phiếu", bấm vào mở MH-HD-01 với tin nguồn đã chọn |
| UAT-HD-KD-06 | U-KT gửi HD-1 qua ZNS tới Chị Nga | – | U-KD1 nhận "Kế toán … đã gửi HĐ 0001234 qua ZNS tới Chị Nga lúc …"; thông báo "phát hành, gửi cho khách" cũ đóng; chip "chưa gửi" biến mất |
| UAT-HD-KD-07 | Chị Nga trả lời ZNS nhắc nợ "sao đòi nợ gắt thế" | U-KT mở mục phản hồi | Nút gửi mẫu bị ẩn, chỉ "Nhờ owner trả lời"; U-KD1 trả lời xong, mục hiện "Owner đã trả lời lúc …" |
| UAT-HD-KD-08 | K1 hỏi "hóa đơn đâu em", YCHD-0123 Đang xử lý quá hạn | U-KD1 bấm "Trả lời khách" rồi "Hối kế toán" | Ô soạn có mẫu trạng thái điền sẵn (không tự gửi); người xử lý nhận thông báo hối; bấm "Hối" lần hai trong ngày bị chặn |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/06-P-KD.md) | — |
