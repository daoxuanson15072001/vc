# Góp ý 06 — P-GD (Thắng)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý của P-GD (Thắng, giám đốc bán hàng VCparts) cho đặc tả 06 Hóa đơn VAT và công nợ v1.0 (29/09/2026), đọc bằng mắt người chịu tỷ lệ thu hồi nợ theo tổ.
- Đi qua một quý (tháng 10 đến 31/12): họp tuần xem tuổi nợ, khách lớn quá hạn đang đàm phán đơn mới, duyệt chiến dịch nhắc nợ, đối chiếu cuối quý với VCsales.
- 14 góp ý: 5 Chặn, 6 Nên sửa, 3 Gợi ý.
- Chặn: thiếu báo cáo tuổi nợ theo tổ / NVKD; không lưu số cuối kỳ để so tháng, quý; không có dòng số khớp VCsales; không có luồng "khách nợ quá hạn vẫn đặt hàng"; tạm hoãn nhắc cho khách chiến lược do kế toán quyết một mình.
- Nên sửa: màn duyệt chiến dịch nhắc nợ thiếu số tiền và rủi ro, owner không có thời hạn xin loại, chưa rõ nhắc nợ có tính vào trần 2 tin / 7 ngày, thu nợ chưa chia theo tổ / owner / chi phí, thiếu mốc kỳ quý, Excel chưa ghi nguồn và giờ.
- Chọn phương án cho HD-CH-1…8 (phần lớn đồng ý BA; HD-CH-5 chọn B nếu tính vào ngân sách ZNS và có hạn mức ngày) và đề xuất 7 ca UAT-HD-GD-1…7.
- Kết quả xử lý từng góp ý: xem [06-xu-ly.md](06-xu-ly.md).

## Mục lục

- [Một quý của tôi](#một-quý-của-tôi)
- [Góp ý](#góp-ý)
- [Tôi nghiêng về (HD-CH-1…8)](#tôi-nghiêng-về-hd-ch-18)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Tài liệu góp ý: `docs/02-yeu-cau/dac-ta/06-hoa-don-cong-no.md` (v1.0, 29/09/2026). Vai: Thắng, giám đốc bán hàng VCparts, chịu doanh số và cả tỷ lệ thu hồi nợ của division, duyệt chiến dịch và ngân sách ZNS. Phần tôi đọc kỹ: MH-HD-07, MH-HD-10, MH-HD-11, HD-26…HD-35, HD-CH-1…8, và chỗ nối với 04 (MH-OA-13, OA-16, OA-28, OA-29, OA-36, MH-OA-19).

Phần kế toán viết rất kỹ. Nhắc đúng người thanh toán, lấy lại số lúc gửi, tự loại khách đang khiếu nại hoặc đã báo chuyển khoản: đúng những chỗ trước đây làm khách giận. Tôi yên tâm là kế toán sẽ không nhắc nhầm thợ hay nhắc khách vừa trả tiền. Nhưng đọc bằng mắt người chịu **tỷ lệ thu hồi nợ theo tổ**, tôi chưa thấy ba thứ. Thứ nhất là **tuổi nợ theo tổ / NVKD**: danh sách công nợ dừng ở nấc "> 30 ngày", còn báo cáo chỉ đo "đã nhắc, thu trong 7 ngày". Thứ hai là **luồng khi khách nợ quá hạn vẫn đặt hàng**, lúc sale muốn chốt đơn còn kế toán muốn đòi tiền. Tài liệu im lặng ở đúng chỗ hai bên hay cãi nhau nhất. Thứ ba: **tạm hoãn nhắc cho khách chiến lược** đang do kế toán quyết một mình. Muốn lấy số của VClinks đi họp quý thì tôi cần một dòng khớp với VCsales, và cần lưu lại số cuối tháng để so quý.

## Một quý của tôi

| Mốc | Tôi làm gì | Màn hình | Ra được quyết định không? Kiểm soát được chi phí và rủi ro mất khách không? |
|---|---|---|---|
| **Tuần đầu tháng 10, thứ Hai 08:00**, trước họp giám sát | Xem tuổi nợ theo tổ và NVKD: tổ nào có nợ > 60 ngày tăng, NVKD nào có khách quá hạn nhiều | MH-HD-07, MH-HD-10 | **Không.** MH-HD-07 là danh sách theo khách, có lọc Owner nhưng không có tổng theo tổ hay NVKD. Nấc dừng ở "> 30". MH-HD-10 tab Thu nợ không chia theo tổ hay owner. Tôi sẽ phải xuất Excel rồi tự làm pivot, tức là vẫn lấy báo cáo tuổi nợ trên VCsales như cũ |
| Thứ Hai 08:30, họp | Hỏi "so với đầu tháng trước, nợ > 60 ngày của tổ chị Hương tăng hay giảm?" | MH-HD-10 | **Không.** VClinks chỉ lưu tạm công nợ 15 phút, không lưu số cuối tháng. Không có kỳ trước nên không so được |
| **Giữa tháng 10** | Garage Thành Công (khách lớn) nợ quá hạn 60 ngày, khoảng 180 triệu, đang đàm phán đơn 400 triệu với anh Minh. Kế toán đưa khách vào chiến dịch nhắc nợ | MH-HD-07, 04 MH-OA-13, MH-HD-04 | **Rủi ro mất khách.** Minh chỉ được báo và "Xin loại" (OA-36). Minh có thể "Đề nghị tạm hoãn", nhưng kế toán duyệt hay từ chối một mình, tôi không được hỏi. Không có chỗ ghi "đang đàm phán, cam kết trả 50% khi ký đơn" để cả kế toán và sale cùng thấy. Khi Minh gửi báo giá 400 triệu, không có gì nhắc anh ấy là khách đang nợ quá hạn 60 ngày |
| Giữa tháng 10 | Cần quyết: cho khách đặt tiếp hay không, với điều kiện gì | (không có) | **Không có luồng.** Quyết định cho nợ thêm nằm ở VCsales, tôi chấp nhận. Nhưng VClinks là nơi sale và kế toán nói chuyện với khách, vậy mà không ghi lại được thỏa thuận thu nợ |
| **Cuối tháng 10** | Kế toán gửi chiến dịch "Nhắc thanh toán" 200 khách để tôi duyệt | 04 MH-OA-13 (màn duyệt) | **Gần đủ.** Có tập khách, chi phí ước tính, danh sách bị loại kèm lý do. **Thiếu:** tổng tiền đang đòi, top khách theo số nợ, khách đang đàm phán đơn, khách nào owner chưa trả lời thông báo, và kết quả lần nhắc trước (thu được bao nhiêu tiền trên mỗi đồng ZNS) |
| Cuối tháng 10 | Chiến dịch nhắc nợ bị chặn vì khách đã nhận 2 tin mẫu tuần đó (tin nhắc bảo dưỡng của marketing) | 04 OA-29 | **Không rõ.** Tài liệu không nói nhắc nợ có tính vào trần 2 tin / 7 ngày không. Nếu có tính thì tin marketing sẽ lấy mất lượt nhắc nợ |
| **Tháng 11–12** | Đối chiếu công nợ đầu tháng, duyệt lại chiến dịch định kỳ | MH-HD-07, 04 CH-6 | Mỗi tháng phải duyệt lại vì CH-6 chưa chốt. Việc này chấp nhận được |
| **Cuối quý (31/12)** | Đối chiếu MH-HD-10 với báo cáo công nợ và thu tiền của VCsales, xuất Excel gửi anh Thọ Anh | MH-HD-10 | **Chưa khớp được.** "Thu trong 7 ngày" là con số riêng của VClinks, chỉ tính các khoản đã nhắc. Không có dòng "Tổng công nợ cuối kỳ theo VCsales" và "Tổng thu trong kỳ theo VCsales" để tôi chỉ vào mà nói "khớp". Mốc kỳ chỉ có "Tháng này" và "Tháng trước", không có "Quý" |

## Góp ý

| # | Màn / quy tắc (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-HD-07 #2, MH-HD-10, MH-HD-11 #7 | **Không có báo cáo tuổi nợ theo tổ và NVKD.** Nấc chỉ có "≤ 3 / hôm nay / 1–7 / > 7 / > 30". Lọc Owner chỉ lọc, không cho tổng | Tôi chịu tỷ lệ thu hồi theo tổ. Họp tuần tôi cần biết ai đang để nợ xấu tăng, chứ không cần danh sách 200 khách | Thêm tab "Tuổi nợ" ở MH-HD-10: hàng là tổ, mở ra từng NVKD (owner); cột là các nhóm tuổi **Trong hạn · 1–30 · 31–60 · 61–90 · > 90**, ghi cả tiền lẫn số khách, kèm cột % quá hạn > 60. Bấm vào ô thì mở MH-HD-07 đã lọc sẵn. Nhóm tuổi lấy **giống cách VCsales chia** (hỏi VCsoft), cấu hình ở MH-HD-11 #7 | **Chặn** |
| 2 | MH-HD-10, HD-26, §7.2 S2/S3 | **Không lưu số cuối kỳ**, nên không so được tháng trước hay quý trước | Câu tôi bị Ban giám đốc hỏi luôn có dạng "so với quý trước thế nào". Cache 15 phút không trả lời được | Chụp tuổi nợ theo khách, tổ, owner vào **cuối ngày làm việc cuối tháng** (ErpSnapshot, chỉ để báo cáo, không dùng để gửi). Nếu VCsales có sẵn API số dư theo kỳ (S6) thì dùng API đó. Báo cáo hiện Δ so với kỳ trước. Ghi rõ "Số chụp lúc {giờ} {ngày} từ VCsales" | **Chặn** |
| 3 | MH-HD-10 #2, #5, HD-47 | **Số của VClinks chưa có dòng khớp với VCsales.** "Thu trong 7 ngày" chỉ là số tương quan của riêng VClinks | Tôi sợ nhất cảnh hai báo cáo lệch nhau trong cuộc họp quý | Thêm khối "Đối chiếu VCsales" ở đầu tab Thu nợ: Tổng công nợ cuối kỳ · Tổng quá hạn · Tổng thu trong kỳ, **lấy nguyên từ VCsales, không tính lại**. Tách riêng "trong đó thu từ khách đã được nhắc qua VClinks". Mỗi thẻ có tooltip "Số này tính thế nào". Thêm UAT so với báo cáo VCsales (xem mục cuối) | **Chặn** |
| 4 | §2.4, HD-26…HD-31, MH-HD-04 | **Không có luồng "khách nợ quá hạn vẫn đặt hàng"**, là chỗ kế toán và sale va nhau nhiều nhất | Sale gửi báo giá lớn cho khách quá hạn 60 ngày mà không biết. Kế toán nhắc nợ đúng hôm sale chốt đơn. Hai bên đều làm đúng việc mình, và công ty mất khách | (a) Khi owner mở hội thoại hoặc **gửi báo giá** (F9.6) cho khách quá hạn ≥ N ngày (cấu hình, mặc định 30): hiện chip "Quá hạn {n} ngày · {số tiền}", không chặn gửi. (b) Thêm "**Ghi chú thu nợ**" dùng chung trên account (owner, kế toán, GS, GD đọc và ghi; không phải chat), ví dụ "Cam kết trả 50% khi ký đơn DH-…, hạn 15/11". Ghi chú này hiện ở MH-HD-07 và MH-HD-04. (c) Khách quá hạn > 60 ngày có báo giá mới > X triệu → báo kế toán và GS. Quyết định cho nợ thêm vẫn làm trên VCsales (N2) | **Chặn** |
| 5 | HD-31, MH-HD-07 #7, #9, UAT-HD-40 | **Tạm hoãn nhắc cho khách chiến lược do kế toán quyết một mình**, tối đa 60 ngày. Kế toán từ chối đề nghị của owner thì chuyện dừng ở đó | Khách lớn đang đàm phán là quyết định kinh doanh, không phải việc sổ sách. Ngược lại, tôi cũng không muốn sale lấy cớ "đang đàm phán" để hoãn mãi | Thêm lý do "**Khách chiến lược / đang đàm phán**": owner hoặc GS đề nghị, **GD duyệt** (kế toán được báo và thấy lý do), tối đa 30 ngày, gia hạn thì GD duyệt lại. Kế toán từ chối đề nghị của owner → owner "Chuyển giám đốc quyết". MH-HD-10 có danh sách "Đang tạm hoãn" theo tổ: số khách, số tiền, người duyệt, ngày hết hạn. Tạm hoãn không dừng tuổi nợ | **Chặn** |
| 6 | 04 MH-OA-13 màn duyệt, HD-28, OA-36 | **Màn duyệt chiến dịch nhắc nợ 200 khách thiếu số tiền và rủi ro** | Tôi duyệt theo số tiền đang đòi và theo khách lớn, không duyệt theo số tin | Khi mục đích là "Nhắc thanh toán" hoặc "Đối chiếu công nợ", màn duyệt hiện thêm: tổng tiền đang đòi, chia theo nhóm tuổi; top 20 khách theo số nợ kèm owner; khách có ghi chú thu nợ (#4); **khách mà owner chưa phản hồi thông báo**; kết quả chiến dịch nhắc nợ lần trước (tiền thu / chi phí ZNS). Nút "Loại khách này" ngay trên màn duyệt | **Nên sửa** |
| 7 | HD-31 bước 4 §2.4, 04 OA-36 | Owner "được báo trước" nhưng **không có thời hạn xin loại**. Chiến dịch có thể được duyệt ngay sau khi gửi | Minh đi thị trường cả ngày thì chưa kịp xem thông báo, khách đã nhận ZNS | Chiến dịch nhắc nợ chỉ duyệt được sau khi owner đã có **≥ 4 giờ làm việc** để xin loại (cấu hình ở MH-HD-11). Người duyệt thấy "Owner đã xem / chưa xem" | **Nên sửa** |
| 8 | 04 OA-29, HD-30 (f) | **Chưa rõ nhắc nợ có tính vào trần "2 tin mẫu / 7 ngày" không** | Nếu có tính thì tin nhắc bảo dưỡng của marketing sẽ lấy mất lượt nhắc nợ. Nếu không tính thì khách có thể nhận 4 tin một tuần | Nhắc thanh toán và đối chiếu công nợ tính **trần riêng** (ví dụ 1 tin / khoản / 7 ngày, OA-29 theo khoản). Bước chọn khách cảnh báo khi khách vừa nhận tin marketing trong 3 ngày. Ghi rõ luật này ở cả 04 và 06 | **Nên sửa** |
| 9 | MH-HD-10 #5 | Tab Thu nợ **không chia theo tổ, owner, kênh chi phí** | Tôi cần biết đồng tiền ZNS nào đáng chi và tổ nào thu tốt | Thêm bảng theo tổ/owner: đã nhắc (tiền), thu trong 7/30 ngày, chi phí ZNS (lấy từ MH-OA-19), **tiền thu / 1.000 ₫ chi phí tin**. Thêm nhóm đối chứng thô: khách đến hạn nhưng không nhắc (bị loại, không có SĐT) | **Nên sửa** |
| 10 | MH-HD-10 #1 | Mốc kỳ chỉ có "Tháng này" và "Tháng trước" | Họp quý và báo cáo Ban giám đốc đi theo quý | Thêm "Quý này", "Quý trước", "Từ đầu năm", và nút "So với kỳ trước" trên mọi thẻ | **Nên sửa** |
| 11 | MH-HD-10 #6, UI-TP-09 | Xuất Excel **chưa ghi nguồn và giờ chốt trong file** | Excel được chuyển tiếp, người đọc không biết số lấy lúc nào | Sheet Tóm tắt ghi "VCsales lấy {giờ} · VCinvoice lấy {giờ} · số chụp cuối kỳ {ngày}", ghi định nghĩa từng chỉ số, và dòng đối chiếu VCsales (#3) | **Nên sửa** |
| 12 | MH-HD-07 wireframe, #4 | Danh sách công nợ **chưa có cột Tổ và chưa có cột "Ghi chú thu nợ / Tạm hoãn do ai duyệt"** | Khi mở từ tuổi nợ của một tổ (#1) tôi cần thấy lý do ngay trên dòng | Thêm cột Tổ, cột Ghi chú thu nợ (#4, rút gọn), cột Người duyệt tạm hoãn. GD thấy nút "Tạm hoãn (khách chiến lược)" (#5) | **Gợi ý** |
| 13 | §1.1 chỉ số thành công | Chỉ số chỉ đo hóa đơn và "không nhắc nhầm người", **không có chỉ số thu nợ** | Không đo thì sau 3 tháng không biết VClinks có giúp thu nợ không | Thêm: % nợ quá hạn > 60 ngày theo tổ giảm so với quý trước khi chạy; % khách chiến lược bị nhắc nợ ngoài ý owner = 0; số lần kế toán và sale "đụng nhau" (nhắc nợ trong 3 ngày quanh lúc gửi báo giá lớn) | **Gợi ý** |
| 14 | HD-21, HD-23 (thông báo cho giám sát) | GD không nhận thông báo lẻ, đúng ý tôi. Nhưng tôi cần **một bản tóm tắt tuần** | Tôi không muốn thêm chuông báo, chỉ cần một bản tóm tắt đọc trước họp | Thư hoặc thông báo sáng thứ Hai: Δ quá hạn > 60 theo tổ, danh sách tạm hoãn sắp hết hạn, chiến dịch chờ duyệt, số lần "báo gửi nhầm người" | **Gợi ý** |

## Tôi nghiêng về (HD-CH-1…8)

| Câu | Tôi chọn | Lý do của người giữ doanh số và thu nợ |
|---|---|---|
| **HD-CH-1** Mức tích hợp VCinvoice | **B (M2)**, làm C trước để chạy ngay | Đồng ý với BA. Không đòi M1: API ghi tốn công VCsoft mà không giúp gì cho thu nợ |
| **HD-CH-2** Nhắc tổng hay từng khoản | **A**, nhưng tin phải có **cả số quá hạn** lẫn số đến hạn, và hạn sớm nhất | Mỗi khoản một tin thì khách thấy như bị đòi nhiều lần, lại tốn tiền. Có tách quá hạn thì khách biết khoản nào gấp |
| **HD-CH-3** Bản nhanh lên MVP | **A** | Rẻ, bớt việc sale chụp màn hình. Đơn ra nhanh thì hóa đơn ra nhanh, hóa đơn ra nhanh thì khách trả nhanh |
| **HD-CH-4** Kế toán gõ tự do | **A** trong GĐ2 | Chỉ cho gửi mẫu thì kế toán không lỡ lời với khách của sale. Sau 1 tháng tôi muốn xem số lần "Nhờ owner trả lời" và owner trả lời mất bao lâu rồi mới quyết B |
| **HD-CH-5** Gửi hóa đơn hàng loạt | **B**, với điều kiện: chỉ qua kênh chính thức, mẫu đã duyệt, người bấm gửi, **tính vào ngân sách ZNS** và có hạn mức ngày | Tôi không muốn duyệt 30 hóa đơn mỗi ngày. Gửi hóa đơn là giao dịch, không phải chiến dịch. Chi phí kiểm bằng ngân sách (04 CH-4), không kiểm bằng việc tôi bấm duyệt. Nếu CH-4 chưa có trần thì tạm dùng A |
| **HD-CH-6** Nguồn tra MST | **VCsales master data trước, VCinvoice sau**, không dùng nguồn ngoài | Đồng ý với BA là không cào trang ngoài. Thêm VCsales vì đó là nguồn sự thật về khách (N2) |
| **HD-CH-7** Email VCinvoice tính là đã gửi | **Đồng ý BA**: tính là đã gửi, không ghi ngược | Để khỏi nhắc hóa đơn hai lần làm phiền khách |
| **HD-CH-8** VClinks gửi email | **Đồng ý BA**: để GĐ3 | Không ảnh hưởng thu nợ |

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| UAT-HD-GD-1 Tuổi nợ khớp VCsales | Cuối tháng 10, VCparts có 3 tổ; báo cáo tuổi nợ VCsales cùng ngày | U-GD mở MH-HD-10 tab Tuổi nợ, kỳ "Tháng trước", xuất Excel | Tổng từng nhóm tuổi theo tổ **bằng** báo cáo VCsales (sai lệch 0 ₫); có dòng "Số chụp 17:30 31/10 từ VCsales"; bấm ô "Tổ Hương · 61–90" ra MH-HD-07 đã lọc đúng khách |
| UAT-HD-GD-2 So quý | Có số chụp cuối tháng 7, 8, 9, 10, 11, 12 | U-GD chọn "Quý này" và "So với kỳ trước" | Mọi thẻ có Δ so với Q3; quá hạn > 60 theo tổ có mũi tên tăng/giảm |
| UAT-HD-GD-3 Khách quá hạn vẫn đặt hàng | Garage Thành Công quá hạn 62 ngày, 180 triệu; owner U-KD1 | U-KD1 gửi báo giá 400 triệu | Chip "Quá hạn 62 ngày · 180.000.000 ₫" trên khung chat, **không chặn gửi**; U-KT và GS nhận thông báo "Báo giá mới 400.000.000 ₫ cho khách quá hạn > 60 ngày" |
| UAT-HD-GD-4 Tạm hoãn khách chiến lược | Như trên | U-KD1 ghi "Ghi chú thu nợ: cam kết trả 50% khi ký đơn, hạn 15/11" và đề nghị tạm hoãn, lý do "Khách chiến lược / đang đàm phán", tới 15/11 | Đề nghị về **U-GD**, không về U-KT; U-GD duyệt; U-KT nhận thông báo và thấy ghi chú; khách bị loại khỏi chiến dịch với lý do "Tạm hoãn tới 15/11 (GD duyệt)"; tuổi nợ vẫn tăng; ngày 16/11 tự bỏ tạm hoãn, báo U-KT và U-KD1 |
| UAT-HD-GD-5 Kế toán từ chối, chuyển giám đốc | U-KD1 đề nghị tạm hoãn "Hẹn trả", U-KT từ chối có lý do | U-KD1 bấm "Chuyển giám đốc quyết" | U-GD nhận việc với lý do của cả hai bên; quyết định được ghi nhật ký |
| UAT-HD-GD-6 Duyệt chiến dịch 200 khách | Kế toán tạo "Nhắc thanh toán" 200 khách; 5 khách có ghi chú thu nợ; 12 owner chưa xem thông báo; chưa đủ 4 giờ làm việc | U-GD mở màn duyệt | Nút "Duyệt" khóa, tooltip "Owner còn {thời gian} để xin loại"; màn hiện tổng tiền đang đòi theo nhóm tuổi, top 20 khách, 5 khách có ghi chú, 12 owner chưa xem, chi phí ước tính và ngân sách còn lại, kết quả lần nhắc trước (tiền thu / chi phí) |
| UAT-HD-GD-7 Nhắc nợ và trần tin marketing | Khách K1 vừa nhận 2 tin marketing trong 7 ngày | Chiến dịch nhắc nợ có K1 | K1 **không** bị loại vì trần marketing (trần riêng cho nhắc nợ); màn chọn khách cảnh báo "Vừa nhận tin marketing {ngày}" |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/06-P-GD.md) | — |
