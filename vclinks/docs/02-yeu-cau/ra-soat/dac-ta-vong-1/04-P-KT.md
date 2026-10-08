# Góp ý 04 — P-KT (Hà, kế toán)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Hà (P-KT, kế toán) góp ý đặc tả 04 CSKH Zalo OA, vòng 1; file lưu ngày 30/09/2026.
- 20 góp ý: **6 Chặn · 11 Nên sửa · 3 Gợi ý**; kèm 8 câu hỏi và 12 ca UAT đề xuất.
- Vấn đề chính: việc hóa đơn gần như không có (phiếu yêu cầu xuất hóa đơn, gửi hóa đơn qua OA, KT-01, KT-02); file 00, 01, 04 trỏ vòng sang nhau.
- Chặn về nhắc nợ: gửi nhầm người (thợ thay vì kế toán garage), số tiền phải lấy lại lúc gửi, kế toán không đọc được tin khách trả lời ZNS nhắc nợ.
- Nên sửa: loại khách đang tranh chấp khỏi chiến dịch, chống trùng theo nấc nhắc, không gửi nhắc nợ ngoài 08:00–21:00, báo cáo chi phí tin theo tháng / division.
- Kết quả xử lý ở [04-xu-ly.md](04-xu-ly.md): 9 đã sửa, 10 chuyển sang file 06 (hóa đơn, công nợ), 1 hỏi chủ dự án (CH-6, duyệt chiến dịch định kỳ).
- Còn mở: toàn bộ phần hóa đơn và số liệu công nợ chờ file 06; duyệt một lần chiến dịch định kỳ (CH-6).

## Mục lục

- [Một tuần của tôi trên VClinks](#một-tuần-của-tôi-trên-vclinks)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Tôi đọc hết phần ZNS, chiến dịch, báo cáo. Phần nhắc nợ viết khá kỹ: có lọc khách không SĐT, có chốt lại tập khách lúc gửi, có giám đốc duyệt. Nhưng việc chính của tôi là **hóa đơn** thì tài liệu này gần như không có: không có phiếu yêu cầu xuất hóa đơn, không có gửi hóa đơn qua OA, không có story KT-01, KT-02. File 00 ghi `/invoice-requests` "chưa có file", file 01 (D11) lại chỉ sang 04, mà 04 không có. Nhắc nợ thì tôi lo nhất ba chuyện: gửi nhầm người (thợ thay vì kế toán garage), gửi sai số tiền (khách vừa trả một phần), và khách trả lời "đã chuyển rồi" mà tôi không thấy vì tôi không được xem chat.

## Một tuần của tôi trên VClinks

| Mốc | Việc | Màn hình | Chỗ vướng |
|---|---|---|---|
| Thứ 2 đầu tháng, 08:30 | Chốt công nợ tháng trước trên VCsales. Muốn gửi thông báo đối chiếu công nợ cho khoảng 60 đại lý | MH-OA-13 | Mục đích chỉ có "Nhắc thanh toán", không có "Đối chiếu công nợ". Phải chờ giám đốc duyệt, dù mẫu đã duyệt rồi |
| Thứ 2, 10:00 | Khách trả lời ZNS: "số này sai, tôi chuyển 5 triệu hôm 28 rồi" + ảnh UNC | MH-OA-14 (cột Phản hồi) | Tôi không có quyền xem chat (PQ-23). Tin đi vào hàng CSKH. Tôi chỉ thấy con số "Phản hồi 23", không đọc được nội dung. Phải nhắn Zalo hỏi Lan |
| Thứ 3–5 giữa tháng | Xuất hóa đơn cho các đơn đã giao | `/invoice-requests` (không có đặc tả) | Không biết phiếu trông thế nào, ai tạo, có MST, email chưa. Vẫn phải hỏi sale như cũ |
| Thứ 4 | Hóa đơn phát hành, cần gửi khách qua OA. Khách đã quá 7 ngày không nhắn OA (Z3) | MH-OA-12 | Không có mẫu ZNS mục đích "Gửi hóa đơn". Tôi không mở được khung chat nên không biết mở MH-OA-12 từ đâu |
| Thứ 5 | Khách hỏi "hóa đơn tháng 9 đâu" | – | Không có chỗ xem hóa đơn đã gửi tới khách chưa, gửi qua kênh nào (KT-02) |
| Thứ 6 cuối tháng | Tạo chiến dịch nhắc nợ quá hạn | MH-OA-13 bước 2 | Không bỏ tay được khách đang tranh chấp hoặc đã hẹn sale trả. Không chọn được người nhận là kế toán garage |
| Thứ 6, 16:00 | Đối chiếu chi phí ZNS tháng với hóa đơn Zalo | MH-OA-17 | Tôi không có quyền xem báo cáo CSKH. Chi phí chỉ là "ước tính", không có bảng theo tháng / division để hạch toán |

## Góp ý

| # | Màn hình / story / UAT (mã) | Góp ý | Vì sao (tình huống thật) | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | Cả tài liệu; KT-01, F9.11; 00 (`/invoice-requests`); 01 D11 | Không có màn hình phiếu yêu cầu xuất hóa đơn. File 01 chỉ sang 04, file 04 không có, file 00 ghi "chưa có file" | Đây là việc hằng ngày của tôi. Không có phiếu thì tôi vẫn phải đọc Zalo sale chép MST, sai thì xuất lại | Bổ sung đặc tả màn hình "Yêu cầu hóa đơn" (hàng chờ + chi tiết phiếu) vào 04 hoặc một file riêng, có mã MH và UAT | **Chặn** |
| 2 | Phiếu yêu cầu (KT-01) | Phiếu phải có đủ: MST, tên pháp lý, địa chỉ đăng ký, email nhận HĐ, mã đơn VCsales, số tiền, người nhận HĐ, tin gốc / ảnh giấy phép. Thiếu trường nào thì sale không gửi được phiếu | Khách hay gửi tên viết tắt "Gara Minh Phát", còn tên pháp lý là "Công ty TNHH Dịch vụ Ô tô Minh Phát". Sai là phải hủy, xuất thay thế | Trường bắt buộc; kiểm MST đúng 10 hoặc 13 số; so tên với lần xuất trước của cùng MST, lệch thì cảnh báo | **Chặn** |
| 3 | Phiếu yêu cầu, hồ sơ khách (02) | Thông tin xuất HĐ phải lưu theo khách, có lịch sử. Khách đổi MST (đổi từ hộ kinh doanh sang công ty) hoặc đổi địa chỉ thì phiếu mới phải báo "khác lần trước" | Tháng nào cũng có vài garage chuyển từ hộ kinh doanh lên công ty. Sale dùng lại thông tin cũ là xuất sai | Hiện "Thông tin xuất HĐ lần gần nhất" trên phiếu; khác thì tô vàng, bắt người tạo xác nhận | Nên sửa |
| 4 | MH-OA-04, bước 5 §2.2 (chia sẻ thông tin OA) | Tên, địa chỉ khách chia sẻ qua OA là của **người** nhắn, không phải của công ty. Không được tự điền vào thông tin xuất HĐ | Thợ nhắn OA, chia sẻ địa chỉ nhà riêng. Nếu hệ thống điền vào phiếu là tôi xuất sai | Ghi rõ quy tắc: dữ liệu "chia sẻ thông tin" không dùng làm thông tin xuất HĐ | Nên sửa |
| 5 | Phiếu yêu cầu | Cần loại phiếu: Xuất mới / Xuất lại (thay thế) / Điều chỉnh, có liên kết hóa đơn gốc và lý do | Khách báo sai tên sau khi nhận HĐ. Hiện tôi phải tìm lại chat cũ để biết HĐ nào | Thêm trường "Loại" và "Hóa đơn gốc" | Nên sửa |
| 6 | KT-02, F9.9; MH-OA-12; MH-OA-11 (Mục đích) | Không có luồng gửi hóa đơn qua OA. Mục đích mẫu thiếu "Gửi hóa đơn / Thông báo phát hành HĐ". Ngoài khung (Z3) thì gửi bằng gì? | Khách nhắn OA lần cuối lúc đặt hàng, 10 ngày sau mới có HĐ, lúc đó đã Z3 | Thêm mục đích "Hóa đơn" (tham số: số HĐ, ngày, tổng tiền, link tra cứu); nút "Gửi hóa đơn" từ danh sách hóa đơn, tự chọn tin tư vấn hoặc ZNS theo khung | **Chặn** |
| 7 | KT-02 | Cần trạng thái từng hóa đơn: Chưa gửi / Đã gửi (kênh, giờ, người gửi) / Đã nhận / Lỗi. Chưa gửi quá N giờ thì nhắc tôi và owner | Khách hỏi "chưa nhận hóa đơn" là việc hằng tuần. Tôi cần trả lời trong 10 giây, không đi hỏi sale | Danh sách hóa đơn có cột trạng thái gửi; lọc "Chưa gửi > 24h" | Nên sửa |
| 8 | MH-OA-12 §"Mở từ"; PQ-23 | Mọi đường mở MH-OA-12 đều từ khung chat / ô soạn / ticket. Tôi không có quyền xem chat, nên không mở được | Tôi cần nhắc nợ lẻ một khách ngay từ danh sách công nợ | Thêm điểm mở cho kế toán: từ danh sách công nợ, danh sách hóa đơn, phiếu yêu cầu | Nên sửa |
| 9 | MH-OA-12 thành phần 1 (SĐT nhận), OA-15; MH-OA-13 | Nhắc nợ phải tới **người phụ trách thanh toán** của garage (kế toán hoặc chủ), không phải SĐT xác thực OA đầu tiên tìm được | Người nhắn OA thường là thợ. Gửi nhắc nợ 12 triệu cho thợ là lộ công nợ của garage, chủ garage sẽ phàn nàn | Với mục đích Nhắc thanh toán / Hóa đơn: ưu tiên contact có vai trò "Kế toán / Thanh toán" trong hồ sơ (F13.1); không có thì hiện cho tôi chọn, không tự lấy | **Chặn** |
| 10 | MH-OA-13 "Duyệt và lên lịch"; UAT-OA-68 | Chốt lại tập khách lúc gửi là tốt, nhưng **số tiền** cũng phải lấy lại lúc gửi. Khách trả một phần sau khi duyệt thì tin phải ghi số còn lại | Khách nợ 12 triệu, trả 5 triệu sáng nay. 9h nhận ZNS "còn nợ 12 triệu" là khách gọi mắng | Lấy lại công nợ ngay trước khi gửi từng tin; số tiền đổi thì gửi số mới và ghi "Số tiền cập nhật lúc gửi" trong báo cáo | **Chặn** |
| 11 | MH-OA-13 bước 2 (Tập khách) | Không bỏ tay được từng khách. Cần loại khách: đang có ticket khiếu nại mở, sale đã ghi "hẹn trả ngày…", khách vừa báo đã chuyển khoản nhưng VCsales chưa ghi nhận | Khách đang tranh chấp hàng lỗi mà nhận nhắc nợ là mất khách. Tiền chuyển khoản thường 1–2 ngày mới hạch toán | Thêm cột chọn bỏ kèm lý do; tự loại khách có ticket mở và khách có tin "đã chuyển khoản" trong 3 ngày | Nên sửa |
| 12 | MH-OA-14 cột "Phản hồi"; PQ-23 | Khách trả lời ZNS nhắc nợ thì tin về hàng CSKH. Tôi không đọc được, mà đó chính là thông tin tôi cần để đối chiếu | Khách gửi ảnh UNC "chuyển rồi nhé". Lan không biết số nợ (02: CSKH không nói số nợ), tôi không thấy tin | Tin trả lời một ZNS nhắc nợ / hóa đơn trong N ngày → tạo việc cho kế toán, kèm đúng tin đó và ảnh (như tin nguồn của phiếu, PQ-23). Không cần mở cả hội thoại | **Chặn** |
| 13 | OA-16, GD-05, MH-OA-13 | Nhắc nợ là việc định kỳ mỗi tuần. Từ 2 khách là phải chờ giám đốc duyệt, mỗi tuần một lần | Giám đốc đi công tác 3 ngày là chậm thu nợ cả tuần | Giữ việc duyệt, nhưng cho giám đốc duyệt **một lần** chiến dịch định kỳ (mẫu, điều kiện lọc, trần chi phí/tháng). Các lần sau tự chạy, vượt trần hoặc đổi điều kiện mới phải duyệt lại | Nên sửa |
| 14 | MH-OA-13 thành phần 5 ("đã nhận mẫu này 7 ngày") | Nhắc nợ có nhiều nấc: trước hạn 3 ngày, đúng hạn, quá hạn 7 ngày. Quy tắc 7 ngày cùng mẫu sẽ loại mất nấc thứ hai | Khách nhận nhắc trước hạn ngày 1, đến hạn ngày 4 thì bị loại vì "đã nhận 7 ngày qua" | Cho cấu hình N theo mục đích; hoặc tính theo "cùng mẫu + cùng khoản nợ / hạn" | Nên sửa |
| 15 | OA-17 | Mẫu Giao dịch được gửi cả 21:00–08:00. Nhắc thanh toán cũng là Giao dịch, vậy có thể gửi 22h | Khách nhận nhắc nợ lúc 22h sẽ rất khó chịu | Ghi rõ: Nhắc thanh toán, đối chiếu công nợ không gửi ngoài 08:00–21:00, kể cả khi là mẫu Giao dịch | Nên sửa |
| 16 | §3.4, MH-OA-01 tab Chi phí, MH-OA-17 | Chi phí chỉ là "ước tính". Tôi phải hạch toán chi phí ZNS theo tháng, theo division, và đối chiếu với hóa đơn Zalo. Tôi cũng không có quyền xem MH-OA-17 | Cuối tháng Zalo xuất một hóa đơn tổng. Tôi cần chia cho VCparts, VCservice | Báo cáo "Chi phí tin theo tháng": theo OA, division, loại mẫu, người tạo, số tin thành công; cột nhập "Số thực tế theo hóa đơn Zalo" để thấy chênh lệch; xuất Excel; kế toán được xem | Nên sửa |
| 17 | MH-OA-14 "Chuyển đổi", cột "Đã thanh toán" | "64 khách thanh toán" không đủ. Tôi cần: tổng tiền đã nhắc, tổng tiền thu được trong 7 ngày, khách trả đủ / một phần / chưa trả | Giám đốc hỏi "nhắc nợ ZNS thu về bao nhiêu tiền", không hỏi bao nhiêu khách | Thêm số tiền nhắc, số tiền thu, cột "Trả đủ / Một phần / Chưa" | Nên sửa |
| 18 | MH-OA-11 tham số; KT-03 | Tin nhắc nợ nên có số tài khoản và **nội dung chuyển khoản** (mã KH + số đơn) | Khách chuyển khoản ghi "tien hang" là tôi mất nửa ngày đối chiếu | Thêm tham số `{noi_dung_ck}` lấy từ mã KH / số đơn | Gợi ý |
| 19 | MH-OA-12, MH-OA-13 | Owner sale không được báo trước khi khách của mình nhận nhắc nợ | Khách gọi ngay cho Minh "sao công ty đòi nợ tôi", Minh không biết gì | Báo owner khi chiến dịch được duyệt; owner được đề nghị bỏ khách (có lý do), tôi quyết | Gợi ý |
| 20 | MH-OA-13 "Nguồn" | Khách vừa mua VCparts vừa sửa xe VCgarage có thể nhận hai tin nhắc nợ cùng ngày từ hai OA | Khách thấy phiền, tưởng bị đòi trùng | Cảnh báo "khách này có chiến dịch nhắc nợ khác trong 3 ngày" | Gợi ý |

## Câu hỏi của tôi

1. Màn hình phiếu yêu cầu xuất hóa đơn và danh sách hóa đơn sẽ nằm ở file nào? Khi nào tôi được đọc để góp ý?
2. "Công nợ đến hạn" lấy từ VCsales theo hạn của **từng đơn** hay **tổng nợ** của khách? Tin nhắc sẽ ghi số nào?
3. VCsales có biết khoản "khách báo đã chuyển nhưng chưa hạch toán" không? Nếu không, VClinks loại khách đó bằng cách nào?
4. Ai nạp tiền ZBS Account? Hóa đơn VAT của Zalo cho chi phí ZNS xuất cho công ty nào (tập đoàn hay từng division)? (liên quan Q-OA-03)
5. Tôi có được gửi hóa đơn bằng tin tư vấn trong khung (Z1) không, hay chỉ ZNS? PQ-24 nói có, file 04 không nhắc.
6. Khách chỉ nhắn qua nick Zalo cá nhân của sale: tôi tạo nháp gửi hóa đơn cho owner (PQ-24). Nháp đó hiện ở đâu, tôi biết owner đã gửi chưa bằng cách nào?
7. Có cần thêm mục đích "Đối chiếu công nợ" (gửi đầu tháng) tách khỏi "Nhắc thanh toán" không, vì Zalo có thể duyệt khác nhau?
8. Kế toán có được xem báo cáo chiến dịch nhắc nợ do người khác tạo (ví dụ giám sát CSKH tạo thay) không? MH-OA-14 chỉ ghi "người tạo, giám đốc, admin, viewer".

## Kịch bản UAT tôi muốn thêm

| Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|
| Khách nợ 12.000.000 đ, chiến dịch nhắc nợ đã duyệt, hẹn 09:00 | 08:30 khách trả 5.000.000 đ trên VCsales | Tin gửi lúc 09:00 ghi 7.000.000 đ; báo cáo ghi "Số tiền cập nhật lúc gửi" |
| Garage có 2 contact: thợ (SĐT xác thực OA) và kế toán garage (SĐT VCsales, vai trò Thanh toán) | Tạo ZNS nhắc thanh toán lẻ | SĐT nhận mặc định là kế toán garage; không tự chọn thợ |
| Khách nhận ZNS nhắc nợ hôm qua | Khách trả lời OA "chuyển rồi" + ảnh UNC | Kế toán nhận việc "Phản hồi nhắc nợ" kèm đúng tin và ảnh; không thấy phần còn lại của hội thoại |
| Khách đã có HĐ xuất theo MST 0101234567 | Sale tạo phiếu mới với MST 0109876543 | Phiếu hiện cảnh báo "MST khác lần xuất trước", người tạo phải xác nhận |
| HĐ số 0001234 đã gửi khách, khách báo sai tên công ty | Sale tạo phiếu loại "Xuất lại", chọn HĐ gốc | Phiếu có liên kết HĐ gốc và lý do; kế toán thấy cả hai HĐ trong lịch sử khách |
| HĐ phát hành, khách Z3 (quá 7 ngày không nhắn OA) | Kế toán bấm "Gửi hóa đơn" từ danh sách hóa đơn | Hệ thống đề xuất ZNS mẫu "Hóa đơn" với số HĐ, tổng tiền, link tra cứu; gửi xong trạng thái HĐ = Đã gửi (OA, giờ, người gửi) |
| HĐ phát hành 26 giờ trước, chưa gửi | Không ai thao tác | Kế toán và owner nhận nhắc "Hóa đơn … chưa gửi khách" |
| Khách có ticket khiếu nại đang mở | Tạo chiến dịch nhắc nợ quá hạn | Khách bị loại, lý do "Đang có khiếu nại mở" |
| Chiến dịch nhắc nợ định kỳ đã được giám đốc duyệt, trần 2.000.000 đ/tháng | Tuần 3, số tin làm chi phí vượt trần | Chiến dịch dừng chờ duyệt; báo kế toán và giám đốc |
| Nhắc trước hạn đã gửi ngày 01/10 | Ngày 04/10 (đúng hạn) chạy nấc "đúng hạn" | Khách vẫn nhận nấc thứ hai, không bị loại vì "đã nhận mẫu 7 ngày qua" |
| Tháng 10 có 3 chiến dịch và 40 ZNS lẻ ở 2 division | Kế toán mở báo cáo chi phí tháng, nhập số theo hóa đơn Zalo | Thấy chi phí theo division, loại mẫu; hiện chênh lệch ước tính và thực tế; xuất Excel được |
| Mẫu Nhắc thanh toán (Giao dịch) | Hẹn gửi 22:00 | Bị chặn: "Không gửi nhắc thanh toán trong 21:00–08:00" |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/04-P-KT.md) | — |
