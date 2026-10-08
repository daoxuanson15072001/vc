# Góp ý 06 — P-KT (Hà)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý của P-KT (Hà, kế toán) cho đặc tả 06 Hóa đơn VAT và công nợ, chạy thử một tháng thật (01/10–31/10).
- Đánh giá lại lo ngại vòng 04: phần lớn đã giải quyết; giải quyết một phần ở #3, #7, #10, #17, H7; #13 (duyệt một lần chiến dịch định kỳ) chưa giải quyết.
- 15 góp ý: 3 Chặn, 9 Nên sửa, 3 Gợi ý.
- Chặn: chưa có cách nạp người liên hệ thanh toán cho khách hiện có (ngày đầu không nhắc nợ được ai); hồ sơ xuất HĐ đổi hoặc ngừng dùng thì phiếu đang mở và HĐ chưa gửi không bị báo; tiền khách vừa chuyển mà kế toán chưa nhập sao kê thì tin nhắc vẫn đòi đủ.
- Nên sửa: báo cáo thu nợ chưa khớp được VCsales, chưa rõ ai chịu trách nhiệm gửi HĐ, quy tắc phản hồi thanh toán bắt quá rộng, thiếu kết quả đối chiếu công nợ, đồng hồ hạn vẫn chạy khi ERP mất kết nối, không thấy đơn đã giao chưa có HĐ.
- Chọn phương án HD-CH-1…8 (HD-CH-5 muốn gửi HĐ hàng loạt từ GĐ2; HD-CH-7 email lỗi phải tính "Chưa gửi") và đề xuất 12 ca UAT.
- Kết quả xử lý từng góp ý: xem [06-xu-ly.md](06-xu-ly.md).

## Mục lục

- [Lo ngại ở góp ý 04 → 06 đã giải quyết chưa](#lo-ngại-ở-góp-ý-04--06-đã-giải-quyết-chưa)
- [Một tháng của tôi](#một-tháng-của-tôi)
- [Góp ý](#góp-ý)
- [Tôi nghiêng về (HD-CH-1…8)](#tôi-nghiêng-về-hd-ch-18)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Lần này tôi thấy việc của mình đã có chỗ: có phiếu yêu cầu đủ MST, tên, địa chỉ, email, có so với lần xuất trước, có danh sách hóa đơn biết đã gửi chưa, có hộp "Phản hồi thanh toán" mà tôi không phải đọc chat. Phần lớn 20 góp ý ở vòng 04 đã có lời giải cụ thể, có mã quy tắc và ca UAT. Còn lại ba lỗ hổng lớn khi tôi chạy thử một tháng thật. Thứ nhất, ngày đầu dùng thì chưa khách nào có "người liên hệ thanh toán", nên không nhắc nợ được ai. Thứ hai, khách đổi MST khi phiếu cũ đang xử lý thì không ai báo tôi. Thứ ba, tiền khách chuyển sáng nay mà tôi chưa kịp ghi lên VCsales thì tin nhắc nợ vẫn đòi đủ. Báo cáo thu nợ cuối tháng cũng chưa khớp được với VCsales vì cách tính khác nhau.

### Lo ngại ở góp ý 04 → 06 đã giải quyết chưa

| Lo ngại (04-P-KT) | 06 giải quyết ở | Đánh giá |
|---|---|---|
| #1 Không có màn phiếu yêu cầu xuất HĐ | MH-HD-01, 02, 03 | **Đã giải quyết** |
| #2 Trường bắt buộc, kiểm MST, so tên với lần trước | HD-03, HD-04, HD-05, HD-06 | **Đã giải quyết**. Số định danh 12 số vẫn chờ Q-HD-01 |
| #3 Hồ sơ xuất HĐ có lịch sử, báo "khác lần trước" | HD-10, MH-HD-09 | **Giải quyết một phần**: phiếu mới thì được cảnh báo, còn phiếu đang mở và HĐ chưa gửi làm theo hồ sơ cũ thì không (góp ý #2) |
| #4 Thông tin chia sẻ OA không dùng để xuất HĐ | HD-08, UAT-HD-06 | **Đã giải quyết** |
| #5 Loại phiếu Xuất mới / Thay thế / Điều chỉnh | HD-14, §2.3 | **Đã giải quyết** |
| #6, H5 Gửi HĐ qua OA, ZNS mẫu "Hóa đơn", tin tư vấn Z1 | MH-HD-05, HD-19, HD-20 | **Đã giải quyết** |
| #7 Trạng thái gửi từng HĐ, nhắc khi chưa gửi | MH-HD-06, HD-21, HD-22 | **Giải quyết một phần**: chưa rõ ai chịu trách nhiệm gửi (góp ý #6) |
| #8 Kế toán mở gửi tin mẫu từ danh sách, không qua chat | MH-HD-05, 07, 08 | **Đã giải quyết** |
| #9 Nhắc nợ tới người phụ trách thanh toán, không tới thợ | HD-29, MH-HD-09 | **Quy tắc thì đúng**, nhưng chưa có cách nạp người nhận cho số khách hiện có (góp ý #1) |
| #10 Số tiền lấy lại lúc gửi | HD-33, UAT-HD-38 | **Giải quyết một phần**: đúng với khoản đã ghi trên VCsales, chưa đúng với khoản khách vừa chuyển mà tôi chưa ghi (góp ý #3) |
| #11 Loại khách tranh chấp, hẹn trả, báo đã chuyển | HD-30, HD-31 | **Đã giải quyết** |
| #12, H3 Phản hồi nhắc nợ tới tay kế toán | MH-HD-08, HD-36…HD-39 | **Đã giải quyết**. Quy tắc (a) bắt quá rộng (góp ý #7) |
| #13 Duyệt một lần cho chiến dịch định kỳ | Chờ CH-6 của 04 | **Chưa giải quyết**. Đối chiếu công nợ đầu tháng vẫn phải chờ giám đốc duyệt mỗi tháng |
| #14, #15, #19, #20 Nấc nhắc, giờ gửi, báo owner, trùng OA | 04 OA-29, OA-17, OA-36; 06 HD-32 | **Đã giải quyết** |
| #16 Chi phí ZNS theo tháng, division | 04 MH-OA-19 | **Đã giải quyết** ở 04 (không kiểm lại ở đây) |
| #17 Báo cáo nhắc nợ bằng tiền | MH-HD-10 | **Giải quyết một phần**: có số tiền nhưng cách tính chưa khớp được với VCsales (góp ý #4) |
| #18 `{noi_dung_ck}` | HD-34 | **Đã giải quyết**, định dạng chờ Q-HD-07 |
| H2 Tin ghi tổng hay từng khoản | HD-27, HD-CH-2 | Đã thành câu hỏi, tôi chọn ở dưới |
| H6 Nháp gửi HĐ cho owner, biết owner đã gửi chưa | HD-23, MH-HD-06 "Chờ owner gửi" | **Đã giải quyết** |
| H7 Tách mục đích "Đối chiếu công nợ" | HD-35 | **Giải quyết một phần**: khách trả lời đối chiếu thì chưa có kết quả phù hợp (góp ý #8) |

## Một tháng của tôi

| Mốc | Việc | Màn hình | Làm được? · số thao tác · số liệu · có phải đọc chat |
|---|---|---|---|
| 01/10, 08:00 | 40 phiếu yêu cầu xuất HĐ dồn về (đơn giao cuối tháng 9) | MH-HD-02 | Chọn cả 40 → "Nhận xử lý (40)": 2 thao tác, tốt. Nhưng hạn 1 ngày làm việc nên chiều nay cả 40 phiếu chip đỏ, trưởng nhóm nhận 40 thông báo (góp ý #13) |
| 01/10, 08:30–17:00 | Lập 40 HĐ trên VCinvoice | MH-HD-03 → VCinvoice | Mỗi phiếu mở drawer, bấm "Sao chép tất cả" hoặc ⧉ 4–5 trường, dán sang VCinvoice. Ở M2 thì "Mở VCinvoice" chỉ về trang chủ, nên 40 phiếu × 5 lần dán ≈ 200 lần dán. Hàng hóa, thuế suất, hình thức thanh toán không có trên phiếu, tôi vẫn phải mở đơn VCsales. Tự gắn HĐ chỉ chạy khi tôi nhớ ghi mã đơn lên HĐ (góp ý #5). Không phải đọc chat, tốt |
| 01/10 | Đối chiếu công nợ đầu tháng cho 60 đại lý | MH-HD-07 → "Đối chiếu công nợ đầu tháng" → 04 MH-OA-13 | Làm được, nhưng vẫn chờ giám đốc duyệt (CH-6 của 04). Khách trả lời "số dư sai" hay "xác nhận đúng" thì MH-HD-08 không có kết quả tương ứng (góp ý #8) |
| 02/10 | Gửi 40 HĐ cho khách | MH-HD-06 "Chưa gửi" → "Gửi" → MH-HD-05 | Gửi từng HĐ: khoảng 3 thao tác/HĐ, tức 120 lần bấm. Có 15 khách chỉ nhắn nick sale nên tôi tạo 15 nháp và chờ owner gửi. Owner và tôi cùng nhận nhắc "chưa gửi", nên ai cũng nghĩ người kia sẽ gửi (góp ý #6) |
| 03/10 | Garage Minh Phát báo đã lên công ty từ 01/09, MST mới. HĐ 0001234 xuất theo MST cũ; phiếu YCHD-0130 đang ở tay tôi với hồ sơ cũ | MH-HD-06 → "Tạo phiếu thay thế" · MH-HD-09 | Tạo phiếu thay thế: làm được, có cảnh báo MST. Nhưng sale đổi hồ sơ sang MST mới thì **YCHD-0130 tôi đang làm không có cảnh báo gì**, và HĐ 0001240 đã phát hành theo MST cũ nhưng chưa gửi vẫn gửi được (góp ý #2) |
| 15/10, 08:00 | Nhắc nợ 60 garage quá hạn | MH-HD-07 | Ngày đầu dùng thì cả 60 dòng "✖ Chưa có người nhận TT". Tôi phải bấm "Chọn" rồi đặt người nhận từng khách, mà tôi không biết SĐT kế toán garage. **Không nhắc được ai** (góp ý #1) |
| 15/10, 09:00 | Chiến dịch gửi. Garage Phú Thịnh chuyển 2 triệu lúc 07:45, tôi chưa nhập sao kê lên VCsales | 04 MH-OA-13, HD-33 | Tin lấy lại số từ VCsales nhưng VCsales chưa có khoản đó, nên khách vẫn nhận "còn nợ đủ". Khách gọi mắng (góp ý #3) |
| 15/10 | Garage An Khang trả 3/5 triệu hôm qua (đã ghi VCsales) | HD-33 | Tin ghi số còn lại 2 triệu. **Khớp**, tốt |
| 15/10 | Garage Hoàng Long: SĐT OA là của thợ | HD-29, MH-HD-09 | Không tự gửi cho thợ, tốt. Nhưng trước đó phải đặt người nhận khác (góp ý #1) |
| 15–17/10 | Khách trả lời: UNC, "chuyển rồi", "đặt thêm 2 bộ má phanh" | MH-HD-08 | UNC và "chuyển rồi" vào đúng hộp, AI đọc số tiền, tôi so với VCsales: khoảng 4 thao tác/mục, **không đọc chat**, tốt. Tin đặt hàng cũng thành "Phản hồi thanh toán" (quy tắc 7 ngày), tôi đọc cả tin bán hàng không liên quan (góp ý #7) |
| 22/10, 08:00–12:00 | VCinvoice mất kết nối cả buổi sáng | MH-HD-03, 05, 06 | Không gắn HĐ được (M2), không gửi HĐ được (đúng, tôi đồng ý không gửi bản cũ). Nhưng đồng hồ hạn phiếu và nhắc "chưa gửi 24 giờ" vẫn chạy: chiều nay sẽ có nhắc giả cho owner, trưởng nhóm và cả tôi (góp ý #9) |
| 31/10, 16:00 | Đối chiếu báo cáo thu nợ với VCsales | MH-HD-10 | "Thu trong 7 ngày 1,12 tỷ" không so được với tổng thu tháng trên VCsales. Khoản nhắc 28/10 thu 03/11 tính vào kỳ nào? Tôi ghi sao kê ngày 31 vào sáng 01/11 thì con số chốt 16:00 30/10 sai. Excel không có số chứng từ VCsales để dò (góp ý #4) |
| Cả tháng | Đơn đã giao mà sale quên tạo phiếu | – | Không có chỗ nào cho tôi thấy "đơn đã giao, chưa có HĐ, chưa có phiếu" (góp ý #10) |

## Góp ý

| # | Màn/quy tắc (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-HD-09, MH-HD-07 #5, HD-29 | Chưa có cách **nạp người liên hệ thanh toán cho số khách hiện có**. Đặt từng khách bằng modal, mà người biết SĐT kế toán garage là sale, không phải tôi | Ngày đầu dùng cả 60 garage đều "✖ Chưa có người nhận TT", nên tháng đầu không nhắc nợ được ai qua VClinks | (a) Nhập hàng loạt: lấy từ VCsales S8 hoặc file Excel (mã KH, tên, SĐT, email), xem trước rồi xác nhận. (b) Nút "Nhờ owner bổ sung ({n})" trên MH-HD-07: tạo việc cho từng owner kèm danh sách khách của họ. (c) Gợi ý một bấm "Dùng chủ garage làm người nhận" khi account có người liên hệ vai trò Chủ và SĐT V2+. (d) Người khác đổi người nhận thanh toán thì báo tôi | **Chặn** |
| 2 | HD-05, HD-10, MH-HD-09 "Ngừng dùng", MH-HD-03 #3, HD-17 | Cảnh báo "khác lần trước" chỉ chạy lúc **tạo phiếu mới**. Khi hồ sơ đổi hoặc bị "Ngừng dùng", các phiếu đang mở dùng hồ sơ cũ và các HĐ đã phát hành theo MST cũ mà chưa gửi thì không bị báo | Khách báo đổi MST ngày 03/10, trong khi YCHD-0130 đang ở tay tôi với hồ sơ cũ. Tôi xuất sai rồi lại phải thay thế thêm một hóa đơn | Hồ sơ có phiên bản mới hoặc chuyển "Ngừng dùng" thì: mọi phiếu Chờ kế toán / Đang xử lý / Cần bổ sung dùng hồ sơ đó hiện dải đỏ "Hồ sơ xuất HĐ vừa đổi lúc {giờ} bởi {người}: {trường}" và báo người đang xử lý; HĐ chưa gửi có MST cũ → MH-HD-05 cảnh báo "MST trên hóa đơn khác hồ sơ hiện tại", bắt xác nhận | **Chặn** |
| 3 | HD-33, N5, 04 OA-28, MH-HD-07 | Lấy lại số lúc gửi chỉ đúng khi tiền **đã ghi trên VCsales**. Tiền khách chuyển sáng nay mà tôi chưa nhập sao kê thì VClinks không biết | Chiến dịch 09:00, khách chuyển 07:45, tôi nhập sao kê lúc 10:00. Khách nhận "còn nợ đủ" là đúng chuyện tôi sợ nhất | (a) Trước giờ gửi chiến dịch nhắc nợ, hệ thống hỏi kế toán "Đã ghi sao kê ngân hàng tới {giờ}?". Chưa xác nhận trong ngày gửi thì chiến dịch chờ, báo kế toán, không tự gửi. (b) Giờ gửi mặc định của chiến dịch nhắc nợ đặt sau giờ nhập sao kê (cấu hình ở MH-HD-11, ví dụ 10:30). (c) Mẫu nhắc nợ có câu cố định "Số liệu tính tới {giờ lấy số}. Nếu quý khách đã thanh toán sau thời điểm này, xin bỏ qua tin này." | **Chặn** |
| 4 | MH-HD-10 tab Thu nợ #5, #6; 04 MH-OA-14 | "Thu trong 7 ngày" không khớp được với số liệu nào trên VCsales. Thiếu quy tắc cắt kỳ và thiếu danh sách chi tiết để dò | Giám đốc hỏi "nhắc nợ thu về bao nhiêu", tôi phải chứng minh con số bằng chứng từ VCsales. Hạch toán sao kê trễ một ngày là số "chốt 16:00" sai | (a) Ghi rõ: khoản thu tính vào kỳ **của lần nhắc** hay **của ngày thu**, và chọn được. (b) Cửa sổ 7 / 14 / 30 ngày chọn được. (c) Sheet chi tiết theo từng khoản: mã KH, mã khoản, ngày nhắc, số nhắc lúc gửi, ngày thu, số thu, **số chứng từ VCsales**. (d) Dòng đối chiếu "Tổng thu VCsales trong kỳ / trong đó của khách đã nhắc / của khách không nhắc". (e) Nút "Tính lại" và ghi rõ lần tính. 04 MH-OA-14 "Đã thanh toán" dùng cùng định nghĩa | **Nên sửa** |
| 5 | MH-HD-03 #4, #10; HD-16; §2.2 M2 | Ở M2, phiếu chỉ có thông tin người mua. Tự gắn HĐ chỉ chạy khi HĐ trên VCinvoice **có mã đơn**, mà đặc tả không nói tôi phải ghi mã đơn ở đâu | Đầu tháng 40 phiếu, mỗi phiếu dán 5 trường. Chỉ cần quên ghi mã đơn là HĐ không tự gắn, lại phải gắn tay | (a) Nút "Sao chép tất cả" chép thêm dòng "Mã đơn: …; Mã phiếu: YCHD-…" theo đúng thứ tự ô trên VCinvoice. (b) Nói rõ VCinvoice khớp theo trường nào (mã đơn hay mã phiếu trong ghi chú); hỏi VCsoft ngay ở §9.3. (c) Ưu tiên API I6 (link sâu điền sẵn) kể cả ở M2, vì nó rẻ hơn M1 mà bỏ được 200 lần dán. (d) Phiếu hiện thêm "Hình thức thanh toán" (TM / CK) và dòng "Hàng hóa lấy theo đơn VCsales" để tôi khỏi mở VCsales | **Nên sửa** |
| 6 | HD-21, §2.2 bước 8–11, MH-HD-06 | Chưa rõ **ai chịu trách nhiệm gửi** một HĐ: người tạo, owner hay kế toán đều nhận nhắc | Tháng nào cũng có HĐ "tưởng người kia gửi rồi". Khách hỏi thì cả hai đều không biết | Mỗi HĐ có một "Người gửi phụ trách" hiện trên MH-HD-06: mặc định là owner khi khách chỉ có nick cá nhân, là kế toán khi gửi được qua kênh chính thức (cấu hình theo division). Nhắc HD-21 gửi người phụ trách trước, người kia chỉ nhận ở mốc 2N | **Nên sửa** |
| 7 | HD-36 (a), HD-37 | Quy tắc (a) coi **mọi tin** của danh tính đã nhận nhắc nợ trong 7 ngày là phản hồi thanh toán | Chị Nga nhắn "cho chị đặt thêm 2 bộ má phanh" hai ngày sau nhắc nợ. Tin bán hàng lọt vào hộp của tôi, vừa thành việc thừa, vừa trái ý "kế toán không đọc chat" | (a) chỉ tạo mục khi tin tới trong **2 giờ đầu** sau tin mẫu, hoặc khi AI xếp tin vào "Công nợ – hóa đơn" / có ảnh chứng từ. Tin khác trong 7 ngày thì không tạo mục. Kết quả "Không phải thanh toán" dùng để AI học | **Nên sửa** |
| 8 | HD-35, HD-39, MH-HD-08 #8 | Khách trả lời **đối chiếu công nợ đầu tháng** mà kết quả chỉ có "Đã ghi nhận / Chưa thấy tiền / Lệch / Không phải thanh toán" | Đối chiếu công nợ thì cái tôi cần là khách **xác nhận** hay **không đồng ý** số dư, kèm lý do. Cuối năm kiểm toán sẽ hỏi | Mục nguồn "Đối chiếu công nợ" có kết quả riêng: "Khách xác nhận số dư" · "Khách không đồng ý: {số khách báo}" · "Chưa trả lời". MH-HD-07 có cột "Đối chiếu kỳ {MM/yyyy}" và lọc "Chưa xác nhận". Xuất Excel danh sách xác nhận (người xác nhận, kênh, giờ, ảnh). Tin xác nhận qua chat có đủ làm chứng từ không thì ⚠ tôi không chắc, cần pháp chế trả lời | **Nên sửa** |
| 9 | HD-13, HD-21, HD-41, MH-HD-03 trạng thái "VCinvoice không phản hồi" | Khi VCinvoice / VCsales mất kết nối, **đồng hồ hạn và nhắc vẫn chạy** | Mất kết nối một buổi sáng thì buổi chiều có loạt nhắc giả "chưa gửi", "phiếu quá hạn" cho owner, giám sát và trưởng nhóm. Lần sau mọi người sẽ bỏ qua nhắc thật | Trong thời gian hệ thống ghi nhận ERP không phản hồi thì tạm dừng tính giờ HD-13, HD-21 cho việc phụ thuộc ERP đó; ghi "Tạm dừng do VCinvoice mất kết nối {từ–đến}" vào Hoạt động. Ở M2, cho kế toán "Đánh dấu đã phát hành, chờ khớp" (nhập số HĐ) để sale biết HĐ đã có; khi kết nối lại, hệ thống đối chiếu với I1 và báo lệch | **Nên sửa** |
| 10 | MH-HD-02, MH-HD-06; HD-01; Q-HD-03 | Luồng chỉ chạy khi có người **xin** hóa đơn. Tôi không thấy "đơn đã giao mà chưa có HĐ và chưa có phiếu". Kế toán cũng không được tạo phiếu | Sale quên, khách không đòi thì đơn nằm đó. Thời hạn xuất HĐ tính từ lúc giao hàng hay lúc khách xin: ⚠ tôi lo ở đây nhưng không khẳng định, cần pháp chế trả lời Q-HD-03 | Thêm tab "Đơn chưa có HĐ" (VCsales S1): cột ngày giao, số ngày từ lúc giao, owner, nút "Nhờ owner tạo phiếu". Cho kế toán tạo phiếu **không có tin nguồn** từ tab này khi khách có hồ sơ xuất HĐ mặc định (ghi chú nguồn bắt buộc, ví dụ "Xuất gộp tháng theo thỏa thuận"). MH-HD-02 có cột "Ngày giao sớm nhất" và sắp xếp được theo cột này | **Nên sửa** |
| 11 | MH-HD-09 #4, HD-10 | Được "Sửa" MST trong cùng một hồ sơ, và sale đổi hồ sơ "Mặc định" mà không ai báo tôi | MST khác tức là pháp nhân khác. Sửa MST trong cùng hồ sơ làm lịch sử "hồ sơ nào dùng cho HĐ nào" không còn đúng | Khóa MST sau khi hồ sơ đã dùng cho ≥ 1 HĐ; muốn đổi MST thì tạo hồ sơ mới. Đổi "Mặc định", "Ngừng dùng" hoặc sửa tên / địa chỉ thì báo kế toán division | **Nên sửa** |
| 12 | HD-40, MH-HD-08 #10 | Mẫu trả lời thanh toán chưa có **tham số số tiền, ngày** | "Đã nhận thanh toán" mà không ghi số thì khách lại hỏi "nhận bao nhiêu, còn bao nhiêu" | Mẫu loại "Thanh toán" có `{so_tien_nhan}` `{ngay_nhan}` `{con_no}` lấy từ VCsales lúc gửi (không gõ tay), giống HD-34 | **Nên sửa** |
| 13 | HD-13, MH-HD-11 #1 | Hạn 1 ngày làm việc tính đều cho mọi phiếu. Đầu tháng 40 phiếu dồn về là cả loạt quá hạn cùng lúc | Trưởng nhóm nhận 40 thông báo quá hạn, không biết phiếu nào gấp thật | Gộp báo quá hạn thành một thông báo mỗi ngày ("{n} phiếu quá hạn"). Cho cấu hình hạn riêng cho 3 ngày làm việc đầu tháng. Ưu tiên theo ngày giao (góp ý #10) | **Gợi ý** |
| 14 | HD-17, MH-HD-05 trạng thái "VCinvoice không phản hồi" | Tôi đồng ý không gửi bản lưu. Nhưng hiện tại phải nhớ quay lại gửi từng HĐ | Mất kết nối cả buổi, 20 HĐ chờ gửi, tới chiều quên mất vài cái | Nút "Gửi khi VCinvoice có lại": lưu lệnh do tôi bấm. Khi kết nối lại, hệ thống kiểm trạng thái (HD-17) rồi mới gửi; HĐ đổi trạng thái thì hủy lệnh và báo tôi. Người duyệt vẫn là người bấm, giờ gửi vẫn trong 08:00–21:00 | **Gợi ý** |
| 15 | MH-HD-08 #2, HD-36 (b) | Mục "AI phát hiện" và mục từ nhắc nợ nằm chung một danh sách | Buổi sáng tôi cần xử lý trước những khách trả lời nhắc nợ (khách đang chờ) | Thêm lọc theo nguồn và sắp xếp: phản hồi nhắc nợ / đối chiếu lên trước, "AI phát hiện" sau | **Gợi ý** |

## Tôi nghiêng về (HD-CH-1…8)

| Câu | Tôi chọn | Vì sao |
|---|---|---|
| **HD-CH-1** Mức tích hợp VCinvoice | **B (M2)**, làm sẵn C | Tôi quen lập HĐ trên VCinvoice rồi, chỉ cần khỏi gõ lại và khỏi gắn tay. Điều kiện: phải chốt VCinvoice khớp HĐ theo trường nào (góp ý #5). Nếu VCsoft làm được thì xin thêm I6 (link sâu điền sẵn) trước I7 |
| **HD-CH-2** Tin nhắc ghi tổng hay từng khoản | **A** (tổng đến hạn + số khoản + hạn sớm nhất) | Mỗi khoản một tin thì khách tưởng bị đòi nhiều lần. Kèm câu "số liệu tính tới {giờ}" (góp ý #3). Nếu VCsales có link đối chiếu thì gắn link để khách tự xem từng khoản |
| **HD-CH-3** Bản nhanh "Gửi cho kế toán" lên MVP | **A** | Bỏ được ảnh chụp màn hình gửi qua Zalo ngay từ bây giờ. Xin giữ trong bản nhanh: trường bắt buộc (HD-03), "Gắn hóa đơn" kiểu M3, và cảnh báo "MST khác lần trước" dựa trên phiếu đã có trong VClinks. Sai MST là lỗi tôi gặp nhiều nhất |
| **HD-CH-4** Kế toán gõ tin tự do về thanh toán | **A**, với điều kiện mẫu có tham số số tiền (góp ý #12) | Tôi không muốn thành người chat với khách. Có mẫu tốt thì ít phải "Nhờ owner" |
| **HD-CH-5** Gửi HĐ hàng loạt | **B, sớm hơn đề xuất** (từ GĐ2, không chờ CH-6 của 04) | Đầu tháng 40 HĐ, gửi từng cái mất khoảng 120 lần bấm. Chỉ qua kênh chính thức, mẫu "Hóa đơn" đã duyệt, tôi xem danh sách rồi bấm một lần, không qua nick cá nhân. Hóa đơn là việc giao dịch, không phải quảng cáo |
| **HD-CH-6** Nguồn tra MST | Đồng ý đề xuất: VCinvoice, rồi VCsales master data; không cào trang tra cứu | Có tra thì tốt, không có vẫn làm được nhờ cảnh báo "khác lần trước" |
| **HD-CH-7** Email VCinvoice tính là đã gửi | **Đồng ý tính**, nhưng email **lỗi / bị trả về** thì tính là "Chưa gửi" và vẫn nhắc; MH-HD-06 hiện riêng chip "Email VCinvoice" | Nhiều garage không đọc email. Email gửi được thì không cần nhắc, nhưng email lỗi thì phải có người gửi qua chat |
| **HD-CH-8** VClinks tự gửi email | **Đồng ý để GĐ3** | Email VCinvoice đã đủ cho tôi |

## Kịch bản UAT tôi muốn thêm

| Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|
| 60 khách có công nợ, chưa khách nào có người liên hệ thanh toán; VCsales S8 có SĐT kế toán của 40 khách | U-KT nhập người nhận từ VCsales, xem trước, xác nhận; bấm "Nhờ owner bổ sung (20)" | 40 khách chuyển sang "✔" (SĐT V2+); 20 owner nhận việc kèm danh sách khách; người nhận không có vai trò Thợ / Kỹ thuật |
| YCHD-0130 "Đang xử lý" (U-KT) dùng hồ sơ K1-HS1; HĐ 0001240 đã phát hành theo MST 0101234567, chưa gửi | U-KD1 thêm hồ sơ K1-HS2 và "Ngừng dùng" K1-HS1 | YCHD-0130 hiện dải đỏ "Hồ sơ xuất HĐ vừa đổi…", U-KT nhận thông báo; mở MH-HD-05 cho 0001240 thì có cảnh báo "MST trên hóa đơn khác hồ sơ hiện tại" và phải xác nhận mới gửi |
| K1-HS2 đã dùng cho 1 HĐ | U-KD1 sửa MST của K1-HS2 | Không cho sửa MST; gợi ý "Tạo hồ sơ mới"; U-KT nhận thông báo khi đổi hồ sơ Mặc định |
| Chiến dịch nhắc nợ hẹn 09:00; kế toán chưa xác nhận đã ghi sao kê hôm nay | Tới 09:00 | Chiến dịch chờ, U-KT nhận "Xác nhận đã ghi sao kê tới {giờ} để gửi chiến dịch"; không tin nào đi. Xác nhận xong mới gửi, tin có câu "Số liệu tính tới {giờ}" |
| Chị Nga nhận ZNS nhắc nợ hôm qua | Hôm nay Chị Nga nhắn OA "cho chị đặt thêm 2 bộ má phanh" (không ảnh, không từ khóa thanh toán) | Không tạo mục "Phản hồi thanh toán"; hội thoại đi theo định tuyến bình thường |
| Đã gửi ZNS "Đối chiếu công nợ" kỳ 09/2026 cho K1 | Khách trả lời "số dư đúng rồi em" | Mục phản hồi nguồn "Đối chiếu công nợ"; kết quả chọn được "Khách xác nhận số dư"; MH-HD-07 cột "Đối chiếu 09/2026: Đã xác nhận"; có trong Excel danh sách xác nhận |
| VCinvoice mất kết nối 08:00–12:00; 5 phiếu Đang xử lý; 3 HĐ phát hành 23 giờ làm việc trước, chưa gửi | 12:00 kết nối lại; chờ tới 17:00 | Không có nhắc HD-21 / quá hạn HD-13 nào tính phần 08:00–12:00; Hoạt động của phiếu ghi "Tạm dừng do VCinvoice mất kết nối 08:00–12:00" |
| M2; U-KT lập HĐ trên VCinvoice cho YCHD-0123 bằng "Sao chép tất cả" | VCinvoice đồng bộ | Chuỗi chép có "Mã đơn" / "Mã phiếu"; HĐ tự gắn vào YCHD-0123 trong ≤ 15 phút |
| Tháng 10: nhắc K1 ngày 28/10 12.000.000 ₫; K1 trả 12.000.000 ₫ ngày 03/11 | U-KT mở MH-HD-10 kỳ tháng 10, rồi tháng 11 | Khoản thu được tính theo quy tắc cắt kỳ đã chọn, chỉ ở một kỳ; sheet chi tiết có số chứng từ VCsales; tổng "của khách đã nhắc" + "của khách không nhắc" = tổng thu VCsales trong kỳ |
| K2 chỉ nhắn nick U-KD3; HD cho DH-3 phát hành | Không ai thao tác 24 giờ làm việc | MH-HD-06 "Người gửi phụ trách: Trần Cường"; chỉ U-KD3 nhận nhắc ở mốc 24 giờ; U-KT nhận thêm ở mốc 48 giờ |
| Đơn DH-2026-0480 giao 20/09, chưa có phiếu, chưa có HĐ | U-KT mở tab "Đơn chưa có HĐ" | Thấy DH-2026-0480 "đã giao 10 ngày"; "Nhờ owner tạo phiếu" tạo việc cho owner; hoặc U-KT tạo phiếu với ghi chú nguồn bắt buộc |
| Phản hồi của K1 xác định "Đã ghi nhận trên VCsales" 5.000.000 ₫ | U-KT "Gửi mẫu" → "Đã nhận thanh toán" | Xem trước có "{so_tien_nhan} = 5.000.000 ₫, còn nợ 7.000.000 ₫" lấy từ VCsales lúc gửi; không ô nào cho gõ tay số tiền |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/06-P-KT.md) | — |
