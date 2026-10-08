# Góp ý thiết kế lô D2 vòng 1 — P-KT (Hà)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý vòng 1 cho lô thiết kế TK2 (D2) của vai P-KT (Hà, kế toán VCparts); canvas bản 20, đối chiếu đặc tả 06 v1.4.3, 04, 01 và D8-02…D8-17.
- Tổng 11 mục: 1 Chặn · 6 Nên sửa · 4 Gợi ý; có bảng làm thử 5 việc.
- Chặn (#1): cùng khách Garage Thành Công nợ 180 triệu, màn Công nợ ghi không nhắc được (owner đang trao đổi, chờ GĐ duyệt tạm hoãn) nhưng bước 2 chiến dịch và màn duyệt lại tính là "Gửi được".
- Nên sửa: các số tiền chưa ghi rõ trước hay sau thuế (phiếu yêu cầu hóa đơn, chi phí ZNS) và một số điểm ở xem trước tin, công nợ, gửi hóa đơn.
- Đánh giá tốt: chi tiết phiếu đủ trường và nút chép theo thứ tự VCinvoice, cảnh báo MST đổi, hộp Phản hồi thanh toán, dải "Sao kê đã ghi tới".
- Không góp ý ngược D8-08, D8-15.

## Mục lục

- [Làm thử 5 việc](#làm-thử-5-việc)
- [Góp ý](#góp-ý)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Người góp ý: Hà, kế toán VCparts (vai P-KT). Đọc canvas "VClinks UI Design" bản 20: artboard 13 Invoice (MH-HD-01…03), 13a InvoiceSend (MH-HD-04…06), 13b Debt (MH-HD-07, 08, 09, 13), 13c DebtAdmin (MH-HD-10…12), 14a Zns (MH-OA-11, 12, 19 chi phí), 14b OaCampaign (MH-OA-13, 14, chiến dịch nhắc thanh toán). Đối chiếu đặc tả 06 v1.4.3, 04 MH-OA-11…19, 01 và D8-02…D8-17 (không góp ý ngược D8-08, D8-15 giờ gửi 10:30).

Câu em hỏi nhiều nhất là "em chỉ cần phiếu, không cần xem chat được không", và bản vẽ trả lời được: chi tiết phiếu có đủ MST, tên, địa chỉ, email, nút chép từng dòng và `Sao chép tất cả` theo thứ tự màn VCinvoice, tin nguồn chỉ là 2 tin sale đính kèm, không có link mở hội thoại. Cảnh báo `Khác lần trước: MST đổi từ 9900000101` nằm ngay đầu phiếu. Hộp Phản hồi thanh toán đưa đúng tin và ảnh UNC cho em, có AI đọc số tiền để tham khảo. Dải "Sao kê đã ghi tới 08:30" và luật chiến dịch chờ sao kê đúng thứ em cần. Chỗ em lo nhất là chiến dịch nhắc nợ: màn Công nợ và màn tạo chiến dịch nói hai điều khác nhau về cùng một khách nợ 180 triệu. Sau đó là mấy con số tiền chưa ghi rõ trước hay sau thuế.

## Làm thử 5 việc

Cú bấm tính từ lúc đang ở menu bên trái. Gõ phím không tính.

| Việc | Màn | Số cú bấm | Vướng |
|---|---|---|---|
| (a) Nhận phiếu YCHD-0123, chép sang VCinvoice, gắn hóa đơn | MH-HD-02 → 03 | 5 (`Yêu cầu hóa đơn` → dòng YCHD-0123 → `Nhận xử lý` → `Sao chép tất cả` → `Gắn hóa đơn` → chọn HĐ khớp đơn → `Gắn hóa đơn`) | Không vướng. Riêng dòng "Tổng 3.200.000 ₫" chưa nói trước hay sau thuế (góp ý #4) |
| (b) Khách hỏi "hóa đơn 0001234 đâu" | MH-HD-06 | 2 (`Hóa đơn` → gõ số HĐ → bấm số HĐ mở lịch sử gửi) | Trên bảng, chip ZNS chỉ ghi `Đã gửi OA (ZNS) · [HH:mm] · Hà Kế toán`, phải mở drawer mới biết khách đã nhận chưa (góp ý #5) |
| (c) Gửi hóa đơn 0001234 cho chị Nga khi OA hết khung | MH-HD-06 → 05 | 2 (`Gửi` → `Gửi hóa đơn`) | Không vướng. Tự chọn ZNS mẫu 312050, hiện người nhận chị Nga, xem trước và chi phí ước tính |
| (d) Thứ Sáu: xác nhận sao kê, tạo chiến dịch nhắc cho khách quá hạn | MH-HD-07 → MH-OA-13 | Khoảng 10 (`Xác nhận đã ghi sao kê` → `Xác nhận` → chọn khách → `Tạo chiến dịch nhắc` → `Tiếp` ×3 → chọn người duyệt → `Gửi duyệt`) | Garage Thành Công 180.000.000 ₫: ở Công nợ là ✖ `Owner đang trao đổi`, sang chiến dịch là `Gửi được` (góp ý #1). Xem trước tin có dòng "Số liệu tính tới" mà mẫu đang dùng chưa có tham số đó (góp ý #2) |
| (e) Khách gửi ảnh UNC 5 triệu, VCsales chưa có khoản | MH-HD-08 | 3 (`Phản hồi thanh toán` → mục Garage Minh Phát → `Xong` sau khi ghi chú), thêm `Gửi mẫu` nếu trả lời khách | Kết quả chọn sẵn `Chưa thấy tiền về` (góp ý #10) |

## Góp ý

| # | Màn | Artboard | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|---|
| 1 | MH-OA-13 (bước 2, màn duyệt), MH-HD-07 | 14b OaCampaign, 13b Debt | Cùng mốc 10:00 29/09, Garage Thành Công (180.000.000 ₫, quá hạn 62 ngày): bảng Công nợ ghi `✖ Owner đang trao đổi (báo giá [HH:mm])` và đang có `Đề nghị tạm hoãn · Khách chiến lược / đang đàm phán · Chờ giám đốc duyệt`. Sang bước 2 chiến dịch (mở từ chính danh sách Công nợ) thì dòng này là `Gửi được`, chỉ ghi "Báo trước owner". Màn duyệt của giám đốc đếm 180.000.000 ₫ vào ô `61–90` của "Tổng tiền đang đòi" và đứng đầu top 20 | Đây là khách chiến lược đang đàm phán, đúng loại khách không được nhắc nhầm. Giám đốc duyệt theo con số 180 triệu, em thì không biết tin sẽ đi hay bị loại lúc gửi. Hai màn phải cùng một kết luận "nhắc được hay không" thì em mới tin được danh sách | Bước 2 và màn duyệt dùng cùng bộ lý do ✖ của MH-HD-07 (HD-30, gồm (g) owner đang trao đổi) tính lúc mở. Khách có đề nghị tạm hoãn đang chờ duyệt hiện chip `Đang chờ GĐ duyệt tạm hoãn` và mặc định không tích. Nếu vẫn giữ luật "(g) loại lúc gửi" thì dòng ghi `Có thể bị loại lúc gửi: owner đang trao đổi` và số tiền đó tách riêng khỏi "Tổng tiền đang đòi" | **Chặn** |
| 2 | MH-OA-13 (#11 Xem trước tin), MH-OA-11 | 14b OaCampaign, 14a Zns | Bước 1 cảnh báo `Mẫu này chưa có tham số {so_lieu_tinh_toi}. Vẫn gửi được…`, và ở màn Mẫu, mẫu 312044 chỉ có `{ten_khach} {so_tien} {han_tt} {noi_dung_ck}`. Nhưng khung "Bước 1 đã chọn" lại liệt kê `{so_qua_han} {so_den_han} {so_lieu_tinh_toi}`, và "Xem trước tin" hiện cả dòng `Số liệu tính tới [mốc sao kê 02/10]` lẫn câu "Nếu quý khách đã thanh toán sau thời điểm này, xin bỏ qua tin này" | Xem trước đang cho em và giám đốc thấy câu bảo vệ mà khách **sẽ không nhận được**. Khách chuyển khoản sáng hôm đó vẫn nhận tin đòi đủ số, không có câu "xin bỏ qua", rồi gọi lên mắng. Mục đích của mốc sao kê (N11) mất tác dụng | Xem trước và khung tóm tắt phải lấy đúng nội dung mẫu đang dùng. Mẫu thiếu tham số thì xem trước ghi rõ `Tin này không có dòng "Số liệu tính tới"`, màn duyệt hiện cùng cảnh báo cho giám đốc | **Nên sửa** |
| 3 | MH-HD-07 | 13b Debt | Chọn Garage Minh Khoa (✖ Chưa có người nhận TT): thanh dưới ghi `Đã chọn 1 (nhắc được 0)` nhưng nút `Nhắc (1 khách)` vẫn xanh, bấm được. Ở biến thể chọn 4 khách thì `Đã chọn 4 (nhắc được 1)`, nút `Nhắc (1 khách)` lại khóa còn `Tạo chiến dịch nhắc (4)` đếm cả 3 khách bị loại | Số trên nút không khớp số nhắc được, em không biết bấm là gửi cho ai | Nút lấy số "nhắc được": `Nhắc (0)` khóa, tooltip lý do; `Tạo chiến dịch nhắc (4 · 1 gửi được)` | **Nên sửa** |
| 4 | MH-HD-01, MH-HD-02, MH-HD-03 | 13 Invoice | Cột "Tổng tiền" của phiếu và dòng `Tổng 3.200.000 ₫ (VCsales)` không ghi là trước thuế hay đã gồm VAT. Khi gắn hóa đơn, VClinks so "Tổng hóa đơn khác tổng đơn trên phiếu" (HD-15), trong khi hóa đơn VCinvoice có tổng trước thuế, thuế, tổng thanh toán (API I1) | Nếu VCsales trả tổng trước thuế thì phiếu nào gắn hóa đơn cũng báo chênh 10%, em sẽ quen bấm bỏ qua và bỏ sót lần chênh thật | Ghi rõ nhãn `Tổng thanh toán (đã gồm VAT)` hoặc hiện hai dòng Tiền hàng / Thuế / Tổng; HD-15 so cùng loại tổng. Thiếu trong đặc tả (06 HD-15 chưa nói so tổng nào) | **Nên sửa** |
| 5 | MH-HD-06 | 13a InvoiceSend | Chip gửi qua ZNS trên bảng chỉ có `Đã gửi OA (ZNS) · [HH:mm] · Hà Kế toán`; chip Zalo thì có `Đã nhận`, `Đã xem`. Trạng thái nhận của ZNS chỉ thấy trong drawer lịch sử gửi. Bộ lọc nhanh không có "Đã gửi, chưa nhận" | "Hóa đơn đã tới khách chưa" là thứ em cần biết nhất. ZNS gửi được mà khách không nhận (số không dùng Zalo) thì em phải mở từng dòng mới biết | Chip ZNS thêm `· Đã nhận` / `· Chưa nhận`, và thêm nút nhanh `Gửi chưa nhận ([n])` | **Nên sửa** |
| 6 | MH-OA-19 | 14a Zns | Ô "Thực (hóa đơn Zalo)" và "Ước tính" (1 tin × 300 đ) không ghi là trước thuế hay đã gồm VAT; chênh lệch `+140.000 ₫ (+4,5%)` | Hóa đơn ZBS của Zalo có VAT. Em nhập số trên hóa đơn (gồm VAT) so với ước tính theo đơn giá chưa VAT thì tháng nào cũng "chênh", giám đốc sẽ hỏi | Ghi nhãn cột `Thực (chưa VAT)` và cho nhập thêm tiền thuế, hoặc quy định đơn giá nhập ở Kênh kết nối là giá đã gồm VAT. Thiếu trong đặc tả 04 MH-OA-19 | **Nên sửa** |
| 7 | MH-OA-13 (bước 2), MH-HD-07, MH-OA-12 | 14b OaCampaign, 13b Debt, 14a Zns | Garage Phú Thịnh hiện ba kiểu người nhận: Công nợ ghi `Anh Thịnh · SĐT ✓` và nhắc được; nhắc lẻ (UAT-OA-114) ghi "chỉ có anh Thịnh (C13), không có vai trò Kế toán / Thanh toán" và bắt `Chọn người nhận`; chiến dịch ghi `Gửi được` với người nhận là chữ giữ chỗ `[người nhận thanh toán · TD-S8]`. Khách này cũng `chưa có owner`, việc báo giám sát thay chỉ ghi ở khung bên phải | Trước khi gửi duyệt em phải chắc từng khách gửi tới đúng kế toán của họ (OA-15). Ba màn nói ba kiểu thì em không biết tin sẽ tới ai | Thống nhất một luật: không có người vai trò "Kế toán / Thanh toán" thì ✖ `Chưa có người nhận TT` ở cả ba màn. Cột Owner của dòng không owner ghi `chưa có · báo GS [tên]` | **Nên sửa** |
| 8 | MH-HD-07 | 13b Debt | Modal `Xác nhận đã ghi sao kê`: giờ mặc định là "bây giờ" (10:00) | Em thường nhập sao kê lúc 8:30 rồi làm việc khác, 10:00 mới bấm. Để mặc định "bây giờ" thì em dễ bấm Xác nhận luôn, mốc ghi 10:00 trong khi khoản về 9:15 chưa vào VCsales, tin nhắc sẽ ghi sai mốc | Để trống ô giờ và bắt nhập, hoặc gợi ý giờ của khoản cuối cùng đã ghi trên VCsales (nếu API có). HD-50(a) đang ghi mặc định giờ hiện tại, đề nghị BA xem lại | Gợi ý |
| 9 | MH-HD-12 | 13c DebtAdmin | Xem trước nạp từ VCsales chỉ có `Trùng người sẵn có (giữ)`; chưa có trường hợp VCsales ghi một người khác người đang đặt trong VClinks | Garage đổi kế toán là chuyện thường. Nếu giữ người cũ im lặng thì tin nhắc nợ đi sai người | Thêm kết quả `Khác người đang đặt` kèm hai lựa chọn Giữ / Thay, mặc định Giữ | Gợi ý |
| 10 | MH-HD-08 | 13b Debt | Khối "Kết quả" chọn sẵn `Chưa thấy tiền về` | Em bấm `Xong` nhanh khi đang xử lý nhiều mục thì ghi nhầm kết quả, owner nhận việc "Chưa thấy tiền về" sai | Không chọn sẵn; `Xong` khóa tới khi chọn kết quả | Gợi ý |
| 11 | MH-OA-19, MH-OA-13 | 14a Zns, 14b OaCampaign | Góc nhìn Hà (kế toán) nhưng đường dẫn trang là `Marketing / Chi phí tin mẫu`, `Marketing / Chiến dịch gửi tin` | Em không làm marketing, tìm menu sẽ lạc | Đặt theo nhóm menu "Chiến dịch & ZNS" như đặc tả 04 MH-OA-19 | Gợi ý |

**Tổng:** 1 Chặn · 6 Nên sửa · 4 Gợi ý.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 04/10/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk2/vong-1/P-KT.md) | — |
