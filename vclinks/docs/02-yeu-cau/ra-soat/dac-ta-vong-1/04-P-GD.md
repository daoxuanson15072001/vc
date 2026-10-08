# Góp ý 04 — P-GD (Thắng, giám đốc bán hàng)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Thắng (P-GD, giám đốc bán hàng) góp ý đặc tả 04 CSKH Zalo OA (bản nháp 29/09/2026), vòng 1; file lưu ngày 30/09/2026.
- 18 góp ý: **5 Chặn · 10 Nên sửa · 3 Gợi ý**; kèm 10 quyết định cần công ty chốt và 11 ca UAT đề xuất (UAT-OA-GD-01…11).
- Chặn: không có trần chi phí tin; tập khách chiến dịch có thể phình sau khi duyệt; báo cáo không trả lời "OA có giúp bán hàng không"; hỏi giá chuyển sale không có SLA; không có màn hình cấu hình SLA.
- Nên sửa: so sánh kỳ trước, FRT không tính tin tự động, chi phí thực so với ước tính, người duyệt thay khi vắng, báo owner sale khi khách vào chiến dịch hoặc mở ticket.
- Đề xuất của người góp ý: ngân sách chặn cứng ở 100%, tin tư vấn có phí mặc định tắt, hỏi giá thuộc sale có SLA 15 phút, tắt quyền trả lời trên trang OA.
- Kết quả xử lý ở [04-xu-ly.md](04-xu-ly.md): 14 đã sửa (có màn mới MH-OA-18 SLA), 3 hỏi chủ dự án (CH-4, CH-7, CH-2), 1 chuyển file 01 (ủy quyền duyệt).
- Còn mở: trần ngân sách (CH-4), báo cáo "OA ra doanh số" (CH-7), SLA hỏi giá (CH-2) và các quyết định CH-5, CH-6, CH-8…CH-11.

## Mục lục

- [Một tuần của tôi trên VClinks](#một-tuần-của-tôi-trên-vclinks)
- [Góp ý](#góp-ý)
- [Quyết định tôi cần công ty chốt](#quyết-định-tôi-cần-công-ty-chốt)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Tài liệu góp ý: `docs/02-yeu-cau/dac-ta/04-cskh-zalo-oa.md` (bản nháp 29/09/2026). Vai: Thắng, giám đốc bán hàng VCparts, chịu doanh số division, duyệt ngân sách quảng cáo và ZNS.

Phần CSKH (ticket, khung gửi, chặn gửi ngoài khung) viết kỹ, tôi yên tâm là nhân viên không gửi bừa rồi bị Zalo tính phí. Hai lớp duyệt mẫu (nội bộ + Zalo) và "người tạo không tự duyệt" là đúng ý tôi. Nhưng khi đọc bằng mắt người giữ ngân sách, tôi chưa thấy **trần chi phí**: ngân sách tháng không bắt buộc, vượt chỉ cảnh báo cam, ZNS lẻ và ZNS tự động không qua ai. Báo cáo CSKH đo được "phục vụ nhanh hay chậm" nhưng chưa trả lời câu tôi bị Ban giám đốc hỏi: **"OA có giúp bán được hàng không, mỗi đơn tốn bao nhiêu tiền tin?"**. Và chuyện khách của sale nhắn OA hỏi giá vẫn bỏ ngỏ (Q-OA-06). Đây chính là chỗ CSKH và sale sẽ cãi nhau ở cuộc họp thứ Hai.

## Một tuần của tôi trên VClinks

| Mốc | Tôi làm gì | Màn hình | Ra được quyết định không? Mất bao lâu? |
|---|---|---|---|
| **Thứ Hai 08:00**, trước họp giám sát | Xem tuần trước: FRT, % SLA, ticket quá hạn, CSAT, chi phí tin | MH-OA-17 | Có số. Nhưng **không có so sánh với tuần trước** và không có mũi tên tăng/giảm. Tôi phải chọn kỳ hai lần rồi tự so. Khoảng 10 phút, lẽ ra 2 phút |
| Thứ Hai 08:30, họp | Hỏi "tuần qua còn bao nhiêu khách hỏi giá qua OA mà sale chưa trả lời?" | MH-OA-17, MH-OA-02 | **Không trả lời được.** Hỏi giá không mở ticket (OA-11) nên không có SLA, không nằm trong báo cáo CSKH |
| Thứ Hai 08:45, họp | Hỏi "OA tháng này ra bao nhiêu đơn, doanh số bao nhiêu?" | MH-OA-17, MH-OA-14 | **Không trả lời được.** Chỉ chiến dịch có "chuyển đổi"; hội thoại OA thường không nối tới báo giá/đơn VCsales |
| Thứ Ba | Nhận thông báo "chờ duyệt": mẫu ZNS "Nhắc bảo dưỡng", tin chào v4 | MH-OA-11, MH-OA-08 | Duyệt được. Nhưng tôi thường đi thị trường, cần **duyệt trên điện thoại** và cần **người duyệt thay** khi tôi vắng. Tài liệu chưa nói |
| **Thứ Tư**, duyệt chiến dịch | Kế toán gửi "Nhắc thanh toán 02/10", 186 khách | MH-OA-13 (màn duyệt) | Gần đủ: thấy tập khách, chi phí ước tính, 10 khách mẫu. Thiếu: ngân sách còn **sau khi** chạy chiến dịch này, kết quả chiến dịch cùng loại lần trước, danh sách **khách lớn của sale** trong tập. Khoảng 5 phút mỗi chiến dịch |
| Thứ Tư | Quyết định có bật "tin tư vấn có phí" không | MH-OA-01 tab Tổng quan | **Không phải việc của tôi trên màn này**: công tắc thuộc admin, không có hạn mức. Tôi không dám bật |
| Thứ Năm | Xem chi phí tin tháng đến nay so với ngân sách | MH-OA-01 tab Chi phí, MH-OA-17 | Có "chi phí ước tính", không có **chi phí thực theo hóa đơn Zalo**, không tách theo người gửi / mục đích. Không biết tiền đi đâu |
| Thứ Sáu | Đặt SLA cho loại ticket, giờ làm việc lễ 2/9 | (không có màn hình) | **Không làm được.** MH-OA-05 nói "ma trận SLA do giám đốc cấu hình" nhưng không có màn hình cấu hình |
| **Thứ Bảy**, cuối tuần | Xem báo cáo chiến dịch tuần, xuất Excel gửi Ban giám đốc | MH-OA-14, MH-OA-17 | Xuất được. Nhưng số "Thành công" và "Chi phí" cần **ghi nguồn và giờ chốt**, để khi anh Thọ Anh hỏi "khớp VCsales / hóa đơn Zalo không" tôi trả lời được |

## Góp ý

| # | Màn hình / story / UAT (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | §3.4, MH-OA-01 #23, MH-OA-13 #6, OA-16 | **Không có trần chi phí.** "Ngân sách tháng" không bắt buộc. Vượt ngân sách chỉ cảnh báo cam, vẫn gửi duyệt được. ZNS lẻ (MH-OA-12) và ZNS tự động (xác nhận đơn, §2.2 bước 12) không qua ai duyệt, không có hạn mức tổng | Chỉ chặn 1 tin / khách / mẫu / 24h. 5 CSKH + kế toán + NVKD cùng gửi ZNS lẻ thì một tháng có thể vượt ngân sách mà tôi chỉ biết khi Zalo trừ tiền | Ngân sách tháng **bắt buộc** theo OA (hoặc division), chia theo loại: ZNS lẻ / chiến dịch / tự động / tin có phí. 80%: báo giám đốc + kế toán. 100%: **dừng** ZNS lẻ và tin có phí; chiến dịch mới chỉ duyệt được khi giám đốc nâng ngân sách (có nhật ký). Thêm hạn mức ZNS lẻ / người / ngày | **Chặn** |
| 2 | MH-OA-13 "Duyệt và lên lịch", UAT-OA-68 | Tập khách **chốt lại lúc gửi**. Nguồn "theo tag" hoặc "chu kỳ mua lại" có thể **tăng** giữa lúc duyệt và lúc gửi | Tôi duyệt 186 tin, lúc gửi thành 260 tin. Chi phí thực vượt số tôi đã ký | Lúc gửi chỉ được **bớt** khách, không thêm. Hoặc: số tin gửi thực ≤ số đã duyệt (+ ngưỡng cấu hình, mặc định 0%). Vượt → dừng, báo lại người duyệt | **Chặn** |
| 3 | MH-OA-17, OA-US-11, GD-04 | Báo cáo CSKH **không trả lời "OA có giúp bán hàng không"**. Không có: số hội thoại OA "Hỏi giá" → đã chuyển sale → có báo giá VCsales → có đơn → doanh số; chi phí tin / đơn | Đây là câu Ban giám đốc hỏi khi quyết định có đầu tư tiếp OA không. Chỉ có FRT và CSAT thì tôi chỉ bảo vệ được đội CSKH, không bảo vệ được ngân sách | Thêm khối "OA ra doanh số": phễu Hỏi giá → báo giá gửi → đơn (VCsales, ghi giờ lấy) theo OA, theo tháng; doanh số lấy từ VCsales, không tính lại (F10.4). Chi phí tin ÷ số đơn. Nêu rõ **quy tắc tính** (đơn trong N ngày sau hội thoại OA, cùng mã KH) | **Chặn** |
| 4 | OA-11, OA-12, MH-OA-03 "Chuyển cho sale", Q-OA-06 | Khách đã có owner sale nhắn OA hỏi giá: chuyển owner. Nhưng **không có SLA cho sale** trên hội thoại này, không có đường quay về khi sale không trả lời (sale đi thị trường, đang chat nick cá nhân, nghỉ phép) | Khách nhắn kênh chính thức của công ty mà chờ nửa ngày thì mất khách, và mỗi bên đổ cho bên kia. Đây là xung đột CSKH–sale lớn nhất | Hỏi giá chuyển sale có **SLA riêng** (vd. 15 phút trong giờ). Quá hạn: báo giám sát bán hàng; quá hạn gấp đôi: CSKH được gửi **mẫu câu tiếp nhận đã duyệt** ("em đã chuyển anh Nam, anh ấy gọi lại trước …") và chuyển người trực thay. Hỏi giá chờ sale phải nằm trong báo cáo (xem #3, #6) | **Chặn** |
| 5 | MH-OA-05 #6, OA-13, GD-02, Q-OA-07 | Tài liệu nói "ma trận SLA theo loại × ưu tiên do giám đốc cấu hình" nhưng **không có màn hình** cấu hình SLA. Giờ làm việc CSKH lại nằm ở MH-OA-01 do admin sửa | Tôi chịu trách nhiệm SLA nhưng không đặt được. Admin sửa giờ làm việc là sửa luôn cách tính SLA của đội tôi | Thêm màn hình "SLA và giờ làm việc" (có thể thuộc file 01 / 00): ma trận loại ticket × ưu tiên (phản hồi, xử lý), SLA hỏi giá chuyển sale, giờ làm việc, ngày lễ. Giám đốc sửa; admin xem. Mọi thay đổi có nhật ký, **áp dụng từ thời điểm lưu**, không tính lại ticket cũ | **Chặn** |
| 6 | MH-OA-17 | Không có **so sánh kỳ trước** và không có **danh sách việc tồn** để họp | Họp thứ Hai tôi cần 2 phút: tuần này so tuần trước, ai/tổ nào tụt, việc gì còn treo | Mỗi thẻ chỉ số có Δ so với kỳ trước. Thêm khối "Việc tồn cuối kỳ": ticket quá SLA, khách "Chưa hài lòng" chưa xử lý, hỏi giá chờ sale quá SLA. Bấm vào ra danh sách. Có nút "Tuần trước" chọn nhanh | **Nên sửa** |
| 7 | MH-OA-17 #2, UAT-OA-79 | **FRT có tính tin tự động không?** Tin chào, tin ngoài giờ, chatbot trả lời ngay sẽ làm FRT đẹp giả | Số đẹp nhưng sai thì tôi mất uy tín trước Ban giám đốc | Ghi rõ: FRT tính từ tin khách tới **tin đầu tiên do người gửi**; tin tự động không tính. Hiện định nghĩa từng chỉ số trong tooltip "Số này tính thế nào" | **Nên sửa** |
| 8 | §3.4, MH-OA-17 #6, MH-OA-14 | Chỉ có **chi phí ước tính**. Không đối chiếu với hóa đơn ZBS thực, không tách theo người gửi / mục đích | Kế toán trả tiền theo hóa đơn Zalo. Hai số lệch nhau mà không ai giải thích được thì tôi không tin số nào | Cuối tháng kế toán nhập (hoặc đồng bộ nếu có API) **chi phí thực** theo OA; báo cáo hiện ước tính, thực, chênh lệch. Bảng chi phí theo mục đích (xác nhận đơn, nhắc nợ, bảo dưỡng…) và theo người gửi ZNS lẻ | **Nên sửa** |
| 9 | MH-OA-01 #19, OA-05, Q-OA-05 | Công tắc "Cho phép tin tư vấn tính phí" do **admin** bật, không hạn mức | Đây là quyết định chi tiền, không phải cấu hình kỹ thuật | Chỉ giám đốc bật / tắt. Khi bật phải kèm hạn mức tháng (dùng chung ngân sách #1). Admin chỉ xem | **Nên sửa** |
| 10 | MH-OA-13, KT-03, OA-US-09 | Kế toán / giám sát CSKH tạo chiến dịch nhắc nợ, nhắc mua lại cho **khách của sale** mà sale không biết | Đại lý lớn đang được sale đàm phán giãn nợ mà nhận ZNS nhắc nợ thì sale mất mặt, khách giận. Nhắc mua lại trùng với lúc sale vừa nhắn Zalo cá nhân thì khách thấy bị làm phiền | Bước 2 hiện "khách có owner sale: N". Owner sale nhận thông báo khi khách mình có trong chiến dịch, được **xin loại** khách trước giờ gửi (có lý do, giám đốc thấy). Thêm quy tắc "tối đa X tin chăm sóc / khách / 7 ngày, mọi kênh" | **Nên sửa** |
| 11 | MH-OA-06 "Chuyển sale", OA-11 | Ticket bảo hành / khiếu nại của khách có owner: sale chỉ biết khi CSKH bấm "Chuyển sale" | Sale đi gặp khách mà không biết khách đang khiếu nại thì hỏng việc | Mở ticket cho khách có owner → **tự báo owner** (không cần bấm), ticket hiện trong 360 và việc cần làm của sale (chỉ xem) | **Nên sửa** |
| 12 | MH-OA-08, 09, 11, 13, 16, OA-18 | Mọi duyệt đều đổ về giám đốc, **không có người duyệt thay** khi vắng, không có hạn duyệt | Tôi đi công tác 3 ngày thì chiến dịch nhắc nợ đầu tháng trễ, mẫu ZNS trễ thêm 2–3 ngày của Zalo | Ủy quyền duyệt có thời hạn (vd. cho một giám sát hoặc Ban giám đốc), có nhật ký. Chiến dịch chưa duyệt tới giờ gửi → **không gửi**, tự dời, báo người tạo. Duyệt được trên điện thoại (màn duyệt gọn) | **Nên sửa** |
| 13 | UAT-OA-66, MH-OA-13 #9 | Giám đốc tự tạo chiến dịch thì **ai duyệt?** Người duyệt chỉ là "giám đốc division", không phải tôi thì là ai? | Luật "không tự duyệt" đúng nhưng chưa có người duyệt thay thế | Chiến dịch do giám đốc tạo → Ban giám đốc duyệt (hoặc người được ủy quyền #12) | **Nên sửa** |
| 14 | MH-OA-09, OA-08 | Chatbot "Hỏi giá" trả lời mẫu có thể **hứa** thời gian ("em báo giá ngay") không khớp SLA sale | OA là mặt thương hiệu. Bot hứa mà người không làm là mất uy tín công ty, không phải của một sale | Mẫu trả lời được chèn biến `{han_sla}` lấy từ cấu hình SLA (#5). Màn duyệt tin chào / chatbot cho giám đốc có **xem trước trên điện thoại** và **chạy thử toàn luồng** (hiện chỉ ghi ở MH-OA-09) | **Nên sửa** |
| 15 | Q-OA-11, UAT-OA-25, MH-OA-17 | Nhân viên trả lời trên oa.zalo.me thì tin về dưới tên "OA (ngoài VClinks)", **không biết ai trả lời** | SLA, FRT theo nhân viên sẽ sai, và không kiểm soát được nội dung | Báo cáo tách dòng "Trả lời ngoài VClinks: N tin". Tôi đề nghị công ty tắt quyền trả lời trên trang OA (xem phần Quyết định) | **Nên sửa** |
| 16 | MH-OA-14 "Chuyển đổi" | "64 khách thanh toán trong 7 ngày" không có **đối chứng** | Khách đằng nào cũng trả nợ đúng hạn. Không so thì tôi không biết ZNS nhắc nợ có đáng tiền không | Hiện tỷ lệ của nhóm "không gửi được" (không SĐT, từ chối) làm đối chứng thô, hoặc so với tỷ lệ trả đúng hạn tháng trước. Ghi rõ đây là tương quan, không phải nhân quả | **Gợi ý** |
| 17 | MH-OA-17 #8, MH-OA-14 #5 | Xuất Excel chỉ nói "có nút" | Tôi cần gửi Ban giám đốc và tự làm bảng | Excel có sheet tóm tắt + sheet dữ liệu dòng; có **giờ chốt số liệu** và nguồn ("VCsales lấy lúc …") ở đầu file; SĐT ẩn | **Gợi ý** |
| 18 | MH-OA-17 #5 "Hiệu suất nhân viên" | CSKH có thể đóng ticket nhanh cho đẹp số | Có cột "Mở lại" là tốt nhưng chưa đủ | Thêm "% ticket có khảo sát Chưa hài lòng", "% ticket đóng rồi mở lại trong 7 ngày". Không xếp hạng công khai, chỉ giám sát và giám đốc thấy | **Gợi ý** |

**Tổng:** 5 Chặn · 10 Nên sửa · 3 Gợi ý.

## Quyết định tôi cần công ty chốt

| # | Câu hỏi (mã trong tài liệu) | Đề xuất của tôi |
|---|---|---|
| 1 | Ngân sách tin mẫu / tin có phí theo tháng, ai nạp ZBS Account (Q-OA-03) | Ngân sách theo OA, giám đốc division đề xuất, Ban giám đốc duyệt theo quý; kế toán nạp và nhập chi phí thực cuối tháng. Chặn cứng ở 100% (góp ý #1) |
| 2 | Ai duyệt mẫu ZNS nội bộ, ai nộp Zalo (Q-OA-04) | Giám đốc division duyệt nội dung bán hàng; câu chữ về dữ liệu cá nhân và pháp lý do pháp chế xem một lần cho mẫu khung. Sale admin nộp. Có ủy quyền duyệt khi vắng |
| 3 | Có cho tin tư vấn có phí 48h–7 ngày (Q-OA-05) | Mặc định **tắt**. Chỉ bật khi đã có hạn mức tháng, do giám đốc bật |
| 4 | CSKH có trả lời thẳng khách của sale không (Q-OA-06, BA §21 câu 10) | CSKH trả lời thẳng: bảo hành, khiếu nại, tình trạng đơn. **Hỏi giá thuộc sale**, có SLA; sale quá hạn thì CSKH gửi mẫu câu tiếp nhận và chuyển người trực thay (góp ý #4). CSKH **không báo giá** |
| 5 | Giờ làm việc CSKH và SLA theo loại ticket (Q-OA-07, BA §21 câu 6) | Tôi đề xuất để chốt: T2–T7 08:00–17:30; phản hồi 30 phút (khiếu nại 15 phút); xử lý bảo hành 2 ngày làm việc; hỏi giá chuyển sale 15 phút. Giám đốc sửa được trên màn hình SLA (#5) |
| 6 | Có tắt quyền trả lời trên trang chat OA (Q-OA-11) | Có. Chỉ admin giữ quyền trên oa.zalo.me để cấu hình; mọi trả lời đi qua VClinks |
| 7 | **Mới:** đơn phát sinh từ hội thoại OA tính cho ai (KPI) | Doanh số tính cho owner sale (như VCsales), báo cáo OA chỉ **ghi nguồn** "từ OA", không chia doanh số cho CSKH. Cần chốt để hết cãi nhau |
| 8 | **Mới:** ZNS tự động (xác nhận đơn theo sự kiện VCsales) có cần duyệt không | Duyệt **một lần** như "chiến dịch thường trực" có hạn mức tin / tháng; vượt hạn mức thì dừng và báo giám đốc |
| 9 | **Mới:** chiến dịch do giám đốc tạo thì ai duyệt | Ban giám đốc hoặc người được ủy quyền |
| 10 | Dữ liệu nhắc bảo dưỡng lấy từ đâu (Q-OA-09) | VCparts bán phụ tùng cho garage, nhắc bảo dưỡng không phải việc của VCparts. Ưu tiên **nhắc mua lại** theo chu kỳ từ VCsales (đúng Q2 BA §3) |

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Kịch bản | Bước | Kết quả mong đợi |
|---|---|---|---|
| UAT-OA-GD-01 | Chạm 80% ngân sách | Ngân sách tháng 1.000.000 đ; gửi ZNS lẻ tới khi chi phí ước tính đạt 800.000 đ | Giám đốc và kế toán nhận thông báo `Đã dùng 80% ngân sách tin mẫu tháng 10 của OA VCparts` |
| UAT-OA-GD-02 | Chạm 100% ngân sách | Tiếp tục gửi ZNS lẻ, rồi tạo chiến dịch mới | ZNS lẻ bị chặn với lý do ngân sách; chiến dịch không duyệt được cho tới khi giám đốc nâng ngân sách; nâng ngân sách có nhật ký |
| UAT-OA-GD-03 | Tập khách phình sau khi duyệt | Duyệt chiến dịch theo tag 100 khách; trước giờ gửi gắn tag thêm 30 khách | Chỉ gửi ≤ 100 tin; 30 khách mới không nhận, báo cáo ghi lý do `Thêm sau khi duyệt` |
| UAT-OA-GD-04 | Hỏi giá chờ sale quá SLA | Khách có owner Nam nhắn OA "báo giá má phanh Vios"; Nam không trả lời 15 phút trong giờ | Giám sát bán hàng nhận thông báo; 30 phút: CSKH thấy nút gửi mẫu câu tiếp nhận; báo cáo tuần có 1 dòng "Hỏi giá quá SLA" |
| UAT-OA-GD-05 | OA ra đơn | Khách nhắn OA hỏi giá → Nam gửi báo giá VCsales → khách đặt đơn trên VCsales | Báo cáo "OA ra doanh số" +1 báo giá, +1 đơn, doanh số đúng số VCsales, có giờ lấy dữ liệu; doanh số ghi cho Nam |
| UAT-OA-GD-06 | FRT không tính bot | Khách nhắn 09:00, tin chào gửi 09:00, CSKH trả lời 09:12 | FRT = 12 phút, không phải 0 |
| UAT-OA-GD-07 | Sale xin loại khách khỏi chiến dịch nhắc nợ | Kế toán tạo chiến dịch có khách của Nam; Nam bấm "Xin loại" kèm lý do | Giám đốc thấy yêu cầu ở màn duyệt; duyệt xong khách bị loại, lý do ghi trong báo cáo chiến dịch |
| UAT-OA-GD-08 | Duyệt thay khi giám đốc vắng | Giám đốc ủy quyền cho giám sát Hương 3 ngày; kế toán gửi chiến dịch | Hương duyệt được; hết 3 ngày tự mất quyền; nhật ký ghi "duyệt thay cho Thắng" |
| UAT-OA-GD-09 | Chưa duyệt tới giờ gửi | Chiến dịch hẹn 09:00, giám đốc chưa duyệt | 09:00 không gửi; người tạo nhận `Chiến dịch chưa được duyệt, chưa gửi` |
| UAT-OA-GD-10 | Chi phí ước tính và thực | Cuối tháng kế toán nhập chi phí thực từ hóa đơn ZBS | Báo cáo hiện ước tính, thực, chênh lệch theo OA; xuất Excel có giờ chốt |
| UAT-OA-GD-11 | So sánh tuần | Mở MH-OA-17, chọn "Tuần trước" | Mỗi chỉ số có Δ so với tuần liền trước, đúng số khi tự tính lại |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/04-P-GD.md) | — |
