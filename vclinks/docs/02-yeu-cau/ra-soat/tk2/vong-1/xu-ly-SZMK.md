# Sổ xử lý góp ý thiết kế vòng 1 lô D2 — nhóm SZMK

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Sổ xử lý của BA cho góp ý thiết kế TK2 (D2) vòng 1, nhóm SZMK (03 Sale Zalo cá nhân, 05 Marketing), ngày 30/09/2026.
- Đặc tả đã sửa: 03 và 05 từ v1.4.3 lên v1.4.4, chỗ sửa ghi `[v1.4.4·R1]`; trên bản vẽ gắn nhãn `R1`.
- Bảng xử lý 34 dòng; cả 2 mục Chặn (P-CS #1 tìm kiếm ngoài phạm vi, P-GS #1 phân xử lead tranh chấp) đã sửa; các mục Gợi ý tốn công nhiều thì không sửa, có ghi lý do.
- Kiểm bản vẽ: 10 file sạch thẻ, không bị cắt; riêng MkChatbot khối cuối chỉ cách mốc cắt 6390 là 3 px.
- Còn mở tại thời điểm lập: 3 câu hỏi chủ dự án (CSKH chèn giá từ Tra hàng, SLA bình luận Fanpage, duyệt ngân sách quảng cáo) và danh sách mục BA tự thêm chờ xác nhận.
- Mục 4 liệt kê việc chuyển nhóm khác (00, 06, 04).

## Mục lục

- [1. Bảng xử lý](#1-bảng-xử-lý)
- [2. Kiểm tra bản vẽ](#2-kiểm-tra-bản-vẽ)
- [3. Câu hỏi cho chủ dự án](#3-câu-hỏi-cho-chủ-dự-án)
- [4. Việc chuyển nhóm khác](#4-việc-chuyển-nhóm-khác)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Ngày 30/09/2026. Phạm vi: đặc tả `03-sale-zalo-ca-nhan.md` (v1.4.3 → **v1.4.4**), `05-marketing-quang-cao-chatbot.md` (v1.4.3 → **v1.4.4**); artboard InfoPanel, Contacts, Search, MkSources, MkChatbot + P2, MkLeads + P2, FanpageComments, MkDashboard. Chỗ sửa trong đặc tả ghi **[v1.4.4·R1]**, trên bản vẽ gắn nhãn `R1`. Phần BA tự thêm ghi "(BA đề xuất, chờ chủ dự án xác nhận)". Không làm ngược D8-02…D8-17.
>
> Đã đọc cả 7 file góp ý. P-SA và P-KT không có mục nào thuộc phạm vi nhóm này.

## 1. Bảng xử lý

| Mã góp ý | Mức | Kết quả | File đã sửa |
|---|---|---|---|
| P-GS #1 | Chặn | **Đã sửa.** 05 MH-MK-07 thêm #26 "Phân xử tranh chấp" (GS: `Giữ "{mức}"` / `Đổi thành…`; tranh chấp Không hợp lệ: `Khôi phục` / `Giữ Không hợp lệ`; lý do bắt buộc; nhật ký; báo người nhận lead và NVMK; quá 2 ngày làm việc thì chuyển GĐBH) và #23a "Duyệt yêu cầu chuyển lead" (`Duyệt chuyển` / `Từ chối` + lý do), cộng 2 dòng thao tác và dòng Quyền. Quy tắc lấy từ §4.3 và MK-US-40, câu chữ là BA đề xuất. MH-MK-06 #1: tab Tranh chấp có Tag `Đang tranh chấp · còn {n} ngày`. Bản vẽ: khối #26 (góc Hương) đặt dưới #19, khối #23a (góc GS Đức, UAT-MK-57) nằm cuối hàng "Nhắn Zalo", Tag hạn ở bảng tab Tranh chấp | 05; MkLeads, MkLeadsP2 |
| P-GS #8 | Nên sửa | **Đã sửa.** "Tổ HN" / "Tổ HCM" → `Tổ HN1` / `Tổ HCM1` ở 05 (MH-MK-08 wireframe, MH-MK-10 wireframe, §10.1, UAT) và trên bản vẽ (10 + 2 chỗ). Select `Giao cho tổ` ghi `Tổ HN1 · Minh, Linh, Tú (Nghỉ phép)`, `Tổ HN2 · Hải`, `Tổ HCM1 · Phương, Khôi (Ngoại tuyến)` | 05; MkLeads, MkLeadsP2 |
| P-GS #13 | Gợi ý | **Đã sửa** (rẻ, trong phạm vi). (1) Hộp Hủy kết bạn có ô `Lý do *`, báo người giữ nick mức "Để biết" (BA đề xuất). (2) Tooltip nút Đồng ý / Từ chối khóa với GS có link `Trực thay nick này…` | 03 MH-SZ-09 #9, MH-SZ-10 #1; Contacts |
| P-GS #2, #3, #4, #5, #6, #7, #9, #10, #11, #12 | – | Chuyển nhóm khác (Reports, ReportsDetail, RoutingChange, OwnerConflict; đặc tả 07, 02) | – |
| P-CS #1 | Chặn | **Đã sửa.** Thẻ "CSKH · phạm vi kênh trực": Lan tìm `0900000601` ra nhóm KHÁCH HÀNG có dòng khóa `Garage Hưng Thịnh · Ngoài phạm vi · Minh (Tổ HN1)`, tooltip `Khách của Minh. Bạn không có quyền xem hồ sơ này.`, nút `Xin quyền truy cập`; HỘI THOẠI, TIN NHẮN không có dòng; QĐ-30 chỉ còn phần "ticket đang mở". Ví dụ của Minh cũng ghi `Hải (Tổ HN2)` theo UAT-UI-28. 03 MH-SZ-14 Quyền ghi rõ áp cho CSKH. Đổi chỗ 2 section để artboard không cao thêm | 03; Search |
| P-CS #2 | Nên sửa | **Đã sửa + câu hỏi.** 03 MH-SZ-07 #2a thêm góc nhìn CSKH (BA đề xuất): `Giá lẻ` + Tag `Khách của {owner} có giá riêng`, dòng nhắc DK-31, tin có giá khi gửi đi qua kiểm tra DK-31. Bản vẽ thêm panel "2b · Tra hàng · góc nhìn CSKH (Lan, OA)". Có nên cho CSKH "chèn không kèm giá" hay không: câu hỏi 1 | 03; InfoPanel |
| P-CS #4 | Nên sửa | **Đã sửa + câu hỏi.** Màn chính MH-MK-09 đổi sang góc Lan (CSKH, FP1 mức Trực & gửi): các nút trả lời bật, ô soạn đang gõ; dòng giải thích: trả lời xong thì bình luận rời "Chưa xử lý". Góc Tùng (banner PQ-21, nút khóa + tooltip) chuyển xuống biến thể UAT-MK-79. Không bịa giờ tương đối (bộ TD không có giờ bình luận). Hạn trả lời bình luận: câu hỏi 2 | 05 MH-MK-09 #2; FanpageComments |
| P-CS #3 | Nên sửa | **Chuyển nhóm khác.** Dòng trạng thái "Đã chuyển kế toán đối chiếu" trong khung chat OA và `Gửi cho kế toán` trong menu tin OA thuộc 06 MH-HD-08 / 04 (artboard Debt, khung chat OA), không thuộc SZMK | – |
| P-CS #5–#13 | – | Chuyển nhóm khác (OaAuto, Zns, OaCampaign, OaReports; đặc tả 04) | – |
| P-KD #1 | Nên sửa | **Đã sửa phần InfoPanel.** Dòng công nợ ở panel đã đúng mẫu 03 #3. Thêm panel "3b" có đủ ba dạng: quá hạn `Công nợ: 180.000.000 ₫ · Quá hạn 62 ngày (hạn 29/07) · VCsales 10:00` (đỏ, ⚠; TD-K15, hạn = T−62 ngày theo UAT-SZ-86), trong hạn, và CSKH `Có công nợ quá hạn: Có`. **Chuyển nhóm** phần InvoiceSend (#8, #13: `Còn nợ …`, `Quá hạn: 0 ₫`) và Debt P2 (MH-HD-13 #3) | InfoPanel |
| P-KD #2 | Nên sửa | **Đã sửa.** Panel chính bỏ dòng `…còn 12.000.000 ₫` và nút `Tôi tự nhắc khách` (TD-CN1 trong hạn, chưa có báo trước). Panel 3b vẽ `Kế toán sẽ nhắc lúc 12:00 · còn 2 giờ Xem` giống 13a InvoiceSend (C). 03 MH-SZ-07 #3 ghi đúng chữ 06 #15, #16 và việc hai thành phần này loại trừ nhau | 03; InfoPanel |
| P-KD #7 | Nên sửa | **Đã sửa.** 03 MH-SZ-10 #6a `Gắn vào hồ sơ` (BA đề xuất): điền sẵn gợi ý "Có thể là…", có `+ Tạo khách mới`, để trống thì chưa gắn; toast xong có thêm `Gắn hồ sơ`. Bản vẽ đã thêm vào hộp Đồng ý; popconfirm Từ chối chuyển sang cột trái để artboard không cao thêm | 03; Contacts |
| P-KD #8 | Nên sửa | **Chuyển nhóm khác (00).** Quy tắc nhận dạng mã OE / mã KH nằm ở 00 MH-UI-04 #3. Bản vẽ Search giữ nhãn "còn lệch" tới khi 00 bổ sung | – |
| P-KD #9 | Nên sửa | **Đã sửa phần ẩn:** bỏ nút `Giao lại` khỏi hàng nút của Linh (D8-02). **Không sửa phần xếp lại / gộp `⋯`:** hàng 1 đã là Ghi nhận cuộc gọi · Nhắn Zalo · Tra giá · Tạo báo giá theo wireframe 05; gộp `⋯` là đổi bố cục, để vòng sau nếu vẫn thấy rối | MkLeads, MkLeadsP2 |
| P-KD #13 | Gợi ý | Không sửa: cần thêm cột Nick và quy tắc cho tab Bạn bè, không rẻ. Để lại | – |
| P-KD #3, #4, #5, #6, #10, #11, #12, #14, #15 | – | Chuyển nhóm khác (Customers, Debt, Reports; đặc tả 02, 06, 07) | – |
| P-MK #1 | Nên sửa | **Đã sửa.** 05 MH-MK-10 #2a lọc `Chiến dịch` (BA đề xuất), áp cho thẻ, phễu, #9, #10. #10 tách ba nhóm màu Kém / Thất bại / Không hợp lệ. Bản vẽ: thêm Select, chú giải và màu | 05; MkDashboard |
| P-MK #2 | Nên sửa | **Đã sửa.** 05 MH-MK-02 #22a nút `Nhập chi phí từ file` ở danh sách chiến dịch (BA đề xuất); nút trong tab chỉ nhận dòng của chiến dịch đó; toast có link `Xem {k} dòng chưa khớp` | 05; MkSources |
| P-MK #3 | Nên sửa | **Đã sửa.** MK-08 "Chỉ đọc": bỏ `+ Thêm quy tắc` mờ, thêm dòng đầu trang + nút `Gửi đề xuất` (D8-02). MK-10: bỏ lựa chọn "NV" mờ và nút `Làm mới VCsales` mờ với NVMK (ẩn). Gỡ vênh MK-08: bảng thao tác đổi thành `Gửi đề xuất: GS, TMK, NVMK` cho khớp dòng Quyền (BA đề xuất) | 05; MkLeads, MkLeadsP2, MkDashboard |
| P-MK #4 | Nên sửa | **Đã sửa.** Xem trước áp #9a: URL có `phanh_vios_t10` thì mở từ B1; nhật ký ghi `Bắt đầu: B1 (khớp MK-2026-10-PHANH-VIOS theo #9a)`. Dòng thông báo dữ liệu vẫn hiện trước tin bot đầu tiên, dạng dòng hệ thống (BA đề xuất, giữ đúng NĐ 13). `Thử` có Select `Nguồn giả lập`. Sửa wireframe 5a | 05 MH-MK-04, 05; MkChatbot, MkChatbotP2 |
| P-MK #5 | Nên sửa | **Đã sửa** (BA gỡ, đề xuất). #13 đổi thành "Chờ khách trả lời (phút)", thuộc khối Hỏi / Nút; hết giờ thì vào khối hệ thống "Khách im lặng" (bot kết thúc phiên). Khối Chuyển người không có ô riêng: ghi `Chờ nhân viên nhận: 2 phút theo cấu hình widget` + link MH-MK-03 #18 | 05; MkChatbot, MkChatbotP2 |
| P-MK #6 | Nên sửa | **Đã sửa.** Toast `Đã nhập 3 lead (1 khách cũ giao thẳng owner). 1 dòng trùng trong file đã bỏ.`; đặc tả MK-01 dùng câu mới và tách hai nhãn trùng `Trùng dòng {n}` / `Trùng lead {mã}` | 05; MkSources |
| P-MK #7 | Nên sửa | **Chuyển nhóm khác** (04 MH-OA-13, 00 §2.2; artboard OaCampaign). Việc này là GĐ2 | – |
| P-MK #8 | Gợi ý | Không sửa: thao tác lô mới, cần đặc tả. Để lại | – |
| P-MK #9 | Gợi ý | Không sửa: đặc tả chưa nói sau khi tắt khẩn cấp khách còn chat được với nhân viên hay không, nên không tự viết câu này. Để lại | – |
| P-MK #10 | Gợi ý | Không sửa: cần thêm thẻ số liệu mà bộ TD không có. Để lại | – |
| P-MK #11 | Gợi ý | **Đã sửa.** 05 MH-MK-09 #3a link `Gắn vào chiến dịch…` (chỉ NVMK, TMK; BA đề xuất); ghi chú ở biến thể góc Tùng | 05; FanpageComments |
| P-MK #12 | Gợi ý | **Đã sửa.** Chú thích ô Kỳ: ca UAT-MK-48 chạy sau 31/10, tại mốc T thì là T09/2026 | MkSources |
| P-GD #5 | Nên sửa | **Đã sửa.** Màn duyệt v5 có khối `Khác so với v4 đang chạy` (Thêm Ưu đãi tháng 10 · Sửa B2 thẻ v5 → v6), ghi chú gửi duyệt, ý kiến Nhung, `Kiểm tra: 0 lỗi` (BA đề xuất). Hai toast xếp cạnh nhau để giữ chiều cao | 05 MH-MK-04; MkChatbot, MkChatbotP2 |
| P-GD #6 | Nên sửa | **Đã sửa.** MH-MK-03 thêm thao tác `Trả lại` (lý do bắt buộc) và khối "Thay đổi so với bản đang chạy (v3)", Câu đồng ý đổi thì tô đỏ (BA đề xuất) | 05; MkChatbot, MkChatbotP2 |
| P-GD #9 | Nên sửa | **Câu hỏi chủ dự án** (câu 3): duyệt ngân sách là quyết định nghiệp vụ lớn | – |
| P-GD #10 | Gợi ý | Không sửa: cần tổng tiền đã khóa, bộ TD không có. Để lại | – |
| P-GD #1–#4, #7, #8, #11–#15 | – | Chuyển nhóm khác (OaAuto, Reports, Zns, OwnerConflict, RoutingChange) | – |
| P-SA, P-KT (mọi mục) | – | Không thuộc phạm vi SZMK | – |

## 2. Kiểm tra bản vẽ

- Cân bằng thẻ (html.parser): 10 file đều sạch, không có emoji, mọi `<button>` có `type="button"`.
- Chiều cao (Playwright, 1440 px): InfoPanel 2943/3000, Contacts 5737/5740, Search 5000/5044, MkSources 7067/7090, FanpageComments 2878/2890, MkDashboard 4115/4170. Không file nào bị cắt.
- Cặp X/XP2: nội dung bên trong hai file giống hệt (diff chỉ khác tiêu đề, khung cắt và `$preview`). MkLeads: tổng chiều cao vẫn 10540, phần MK-08 lùi 7 px, không phần tử nào nằm vắt qua mốc cắt 7710. MkChatbot: tổng vẫn 9890. Khối "Đang tải · Lỗi" của MK-04 kết thúc ở 6387, **cách mốc cắt 6390 chỉ 3 px**. Nếu vòng sau thêm nội dung phía trên thì phải đo lại.
- Không đổi khung cắt, `$preview`, `canvas.json`. Chưa publish.

## 3. Câu hỏi cho chủ dự án

1. **CSKH chèn giá từ tab Tra hàng (P-CS #2).** CSKH gần như luôn mở khách có owner NVKD, nên chỉ thấy giá lẻ.
   - A. Giữ một nút `Chèn vào tin` kèm giá lẻ. Khi gửi, kiểm tra DK-31: hỏi lý do và báo owner.
   - B. Với CSKH, `Chèn vào tin` mặc định chỉ chèn tên, mã, tồn, không kèm giá. Có thêm `Chèn kèm giá lẻ`, dùng thì đi qua kiểm tra DK-31.
   - **BA đề xuất B.** CSKH ít khi cần nêu giá, và B tránh báo lệch giá với sale ngay từ bước chèn.
2. **Hạn trả lời bình luận Fanpage (P-CS #4).** Đặc tả 05 chưa có.
   - A. MVP không có SLA. Thẻ bình luận chỉ hiện thời gian chờ tương đối (`{n} phút trước`) và menu có badge số Chưa xử lý.
   - B. Có SLA theo giờ làm việc, chip như 00 §3.4, quá hạn thì báo giám sát CSKH. Con số là đề xuất, chưa đo (ví dụ 60 phút).
   - **BA đề xuất A cho MVP,** đo thời gian trả lời thật 1 tháng rồi mới đặt SLA (B).
3. **Duyệt ngân sách chiến dịch quảng cáo (P-GD #9).**
   - A. Chiến dịch có ngân sách trên ngưỡng (TS mới) ở trạng thái `Chờ GĐBH duyệt ngân sách` trước khi thành `Đang chạy`.
   - B. Không chặn. Chỉ báo GĐBH khi tạo chiến dịch và khi `Đã chi` ≥ 80% ngân sách.
   - **BA đề xuất B cho MVP.** Tiền chi thật chạy trên Ads Manager, ngoài VClinks, nên VClinks không chặn được việc chi. A chỉ có ý nghĩa khi có quy trình duyệt ngân sách bên ngoài đi kèm.

**Các mục BA tự thêm, cần chủ dự án xác nhận (không phải câu hỏi mở):** 05 MH-MK-07 #26, #23a (câu chữ, cách báo); MH-MK-08 NVMK được `Gửi đề xuất`; MH-MK-10 #2a và cách tách ba nhóm lý do; MH-MK-02 #22a; MH-MK-04 #13 "Chờ khách trả lời" + khối "Khách im lặng" (bot kết thúc phiên); MH-MK-04 khối khác biệt khi duyệt; MH-MK-03 `Trả lại` + khối thay đổi; MH-MK-05 dòng thông báo dữ liệu khi mở từ khối khác B0; MH-MK-09 #3a; 03 MH-SZ-07 #2a (góc CSKH); MH-SZ-10 #6a; MH-SZ-09 lý do hủy kết bạn + báo người giữ nick; link `Trực thay nick này…`.

## 4. Việc chuyển nhóm khác

- **00 (MH-UI-04 #3):** thêm quy tắc nhận dạng mã OE và mã KH, gợi ý `Tìm theo mã OE` / `Tra hàng mã này` (P-KD #8).
- **06 / artboard InvoiceSend, Debt P2:** viết dòng công nợ theo mẫu 03 #3, bỏ `Quá hạn: 0 ₫` (P-KD #1, các phần ngoài InfoPanel).
- **06 MH-HD-08, 04 / artboard Debt, khung chat OA:** dòng trạng thái "Đã chuyển kế toán đối chiếu" trong khung chat OA, `Gửi cho kế toán` trong menu tin OA (P-CS #3).
- **04 MH-OA-13, 00 §2.2 / artboard OaCampaign:** nguồn tập khách "Từ lead" cho TMK, hoặc đổi quyền menu MK (P-MK #7).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 04/10/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk2/vong-1/xu-ly-SZMK.md) | — |
