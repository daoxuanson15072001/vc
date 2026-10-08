# Sổ xử lý góp ý thiết kế D2 vòng 1 — nhóm OAHDBC (04 CSKH OA · 06 Hóa đơn, công nợ · 07 Báo cáo, chia khách)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Sổ xử lý của BA + designer cho góp ý thiết kế TK2 (D2) vòng 1, nhóm OAHDBC (04 CSKH OA, 06 Hóa đơn công nợ, 07 Báo cáo chia khách), ngày 30/09/2026.
- Đặc tả đã sửa: 04 và 06 lên v1.4.4, 07 lên v1.1.3; chỗ sửa đánh dấu `R1`, phần BA đề xuất gắn nhãn `R1 · BA đề xuất`.
- Trong phạm vi: 2 Chặn (P-GD #1, P-KT #1) đều đã sửa; 30 Nên sửa (25 đã sửa, 2 sửa một phần, 1 không sửa); 18 Gợi ý (10 đã sửa, 2 một phần, 5 không sửa).
- Mục 3 liệt kê góp ý rơi vào artboard ngoài phạm vi, chuyển nhóm khác.
- Bản vẽ không đổi khung cắt; đã thu khoảng cách để vừa khung, đo Playwright không có chỗ bị cắt.
- Còn mở tại thời điểm lập: 7 câu hỏi chủ dự án Q1…Q7 (Trả lại bản sửa quy tắc, loại khách chờ tạm hoãn, chiến dịch nuôi lead, MH-HD-13 trên điện thoại, so khớp có dấu, tỷ lệ chốt mẫu số nhỏ, ticket mở lại).
- Cần kế toán / VCsoft xác nhận: tổng VCsales và VCinvoice đã gồm VAT, hóa đơn ZBS nhập số trước thuế, API S3 có trả giờ khoản cuối.

## Mục lục

- [1. Tổng hợp](#1-tổng-hợp)
- [2. Bảng xử lý (mục trong phạm vi)](#2-bảng-xử-lý-mục-trong-phạm-vi)
- [3. Chuyển nhóm khác / việc ngoài file](#3-chuyển-nhóm-khác--việc-ngoài-file)
- [4. Ghi chú bản vẽ](#4-ghi-chú-bản-vẽ)
- [5. Câu hỏi cho chủ dự án](#5-câu-hỏi-cho-chủ-dự-án)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Bước 6 của chu trình (specs/README.md). Người xử lý: BA + designer. Ngày 30/09/2026.
> Phạm vi: đặc tả `04-cskh-zalo-oa.md` (→ v1.4.4), `06-hoa-don-cong-no.md` (→ v1.4.4), `07-bao-cao-va-chia-khach.md` (→ v1.1.3); artboard OaAuto, Zns, OaCampaign (+P2), OaReports, Invoice (+P2), InvoiceSend, Debt (+P2), DebtAdmin, Reports (+P2), ReportsDetail, Routing, RoutingChange.
> Dấu sửa trong đặc tả: **[v1.4.4·R1]** (04, 06), **[v1.1.3·R1]** (07). Trên bản vẽ: nhãn `R1` / `R1 · BA đề xuất`.
> Không làm ngược D8-02…D8-17. Không bịa số: số chưa có trong TD để `[..]` / `[n]`.

## 1. Tổng hợp

| Mức | Trong phạm vi | Đã sửa | Đã sửa một phần | Không sửa | Câu hỏi chủ dự án | Chuyển nhóm khác |
|---|---|---|---|---|---|---|
| Chặn | 2 (P-GD #1, P-KT #1) | 2 | – | – | 2 xác nhận phần BA đề xuất (Q1, Q2) | – |
| Nên sửa | 30 | 25 | 2 (P-GS #6, P-KD #10) | 1 (P-CS #10: chưa vẽ, hết chỗ khung cắt) | 2 (P-KD #6 → Q4, P-MK #7 → Q3) | phần vẽ P-CS #3, #9 trong khung chat |
| Gợi ý | 18 | 10 | 2 (P-CS #11, P-KD #14) | 5 (P-GD #11, P-KT #11, P-CS #12, P-KD #15, P-SA #8) | – | 1 (P-GD #12 dữ liệu) |

Mục của các vai rơi vào artboard **ngoài** phạm vi: liệt kê ở §3.

## 2. Bảng xử lý (mục trong phạm vi)

| Mã góp ý | Mức | Kết quả | File đã sửa |
|---|---|---|---|
| P-GD #1 | Chặn | **Đã sửa.** MH-OA-10: nhãn `Chờ giám đốc bật` (quy tắc mới) / `Có bản sửa chờ giám đốc bật` (quy tắc đang bật) trên dòng; giám đốc có lọc `Chờ tôi bật (n)`, Drawer chỉ đọc đặt bản đang chạy cạnh bản sửa (chỗ đổi tô cam), ô `Thử quy tắc`, nút `Bật bản sửa` / `Bật quy tắc`, `Trả lại` (lý do bắt buộc — BA đề xuất, Q1); toast theo đặc tả + toast bản sửa; thông báo mở thẳng lọc. Ca mới UAT-OA-158 | 04 MH-OA-10; OaAuto |
| P-GD #2 | Nên sửa | **Đã sửa.** §3.6 áp `(n = …)` cho mọi ô tỷ lệ mẫu số < 5: thẻ division 25% (n = 4), thẻ tổ 33% (n = 3), dòng Tổ HN1 33,3% (n = 3), Drawer bản bổ sung MH-BC-09 #6 (n = 1 / 3 / 4) | 07 §3.6; Reports (+P2), ReportsDetail |
| P-GD #3 | Nên sửa | **Đã sửa.** MH-BC-04 #2 thêm dòng `1 nick đang mất kết nối (Tú VCparts), số có thể chưa đúng.` + `Mở kênh mất đồng bộ` | 07 MH-BC-04 #2; Reports (+P2) |
| P-GD #4 | Nên sửa | **Đã sửa (BA đề xuất).** Chip `Đề nghị tính lại chờ duyệt [n]` ở MH-BC-04 #2 mở Drawer lọc sẵn; Drawer có lọc `Đề nghị chờ GĐ duyệt`; dòng chờ duyệt hiện chữ giải trình + `còn [..] giờ tới khi khóa số chụp` | 07 BC-26 (c)(d); Reports (+P2), ReportsDetail |
| P-GD #7 | Nên sửa | **Đã sửa.** Thẻ duyệt nội bộ hiện đủ trường chỉ đọc (Loại + cảnh báo giờ cấm, Mục đích, Dùng khi, nội dung + ánh xạ, Đơn giá / `Chưa có đơn giá`, ghi chú người gửi), nút `Xem trước`; lọc `Duyệt nội bộ: Chờ duyệt (2)` | 04 MH-OA-11; Zns |
| P-GD #11 | Gợi ý | **Không sửa.** 07 MH-BC-04 #1 ghi rõ ẩn thẻ GĐ2 tới khi bật; P-KD #14 đề nghị ngược lại (ẩn chip GĐ2). Giữ đặc tả | – |
| P-GD #13 | Gợi ý | **Đã sửa (BA đề xuất).** DX-0008: số liệu đính kèm thêm `Tổ nhận HN2: khách mới / NVKD [x] · % quá SLA [y]`. Phần "GS tổ nhận ghi ý kiến" không làm (đổi luồng duyệt) | 07 bảng R1 cuối §6; RoutingChange |
| P-GD #14 (P-BGD) | Gợi ý | **Đã sửa (BA đề xuất).** MH-BC-05 #0a thêm mục `Chiến dịch / mẫu / kịch bản chờ bạn duyệt ([n])` + `Mở`, xếp sau bản bổ sung | 07 bảng R1; Reports (+P2) |
| P-GD #15 (P-BGD) | Gợi ý | **Đã sửa.** #2c ghi `(Δ [..])` theo BC-13; so ngân sách chờ QĐ-67 | 07 bảng R1; Reports (+P2) |
| P-KT #1 | Chặn | **Đã sửa.** HD-30 thêm **(k) đề nghị tạm hoãn đang chờ duyệt**; (g) và (k) tính **lúc lập danh sách** ở cả MH-HD-07 và 04 MH-OA-13 (bước 2, màn duyệt). Garage Thành Công: `Đang chờ GĐ duyệt tạm hoãn` + `Owner đang trao đổi` ở Công nợ, bước 2 (ô Gửi khóa), không cộng vào "Tổng tiền đang đòi" (nhóm 61–90 = 0 đ), không ở top 20, có dòng `Không tính: …`; xem trước và thông báo báo trước chuyển sang khách gửi được (Garage Phú Thịnh); báo cáo MH-OA-14 ghi `Loại ở bước 2`. Ca mới UAT-OA-157, UAT-HD-96 | 06 HD-30, MH-HD-07 #4 #5; 04 MH-OA-13 #5 #11; Debt (+P2), OaCampaign (+P2) |
| P-KT #2 | Nên sửa | **Đã sửa.** Khung "Bước 1 đã chọn" ghi đúng tham số 312044 `{ten_khach} {so_tien} {han_tt} {noi_dung_ck}` + dòng thiếu; xem trước và màn duyệt ghi `Tin này không có dòng "Số liệu tính tới"`; áp cả xem trước MH-HD-13 | 04 MH-OA-13 #11; 06 MH-HD-13 #5; OaCampaign (+P2), Debt (+P2) |
| P-KT #3 | Nên sửa | **Đã sửa (gỡ mơ hồ M-3, BA đề xuất).** `Đã chọn {n} · nhắc được {k}`; chọn ≠ 1 → `Nhắc lẻ` khóa + tooltip; 1 khách ✖ Chưa có người nhận TT → nhắc lẻ mở chọn người nhận trước; `Tạo chiến dịch nhắc (4 · 1 nhắc được)` bật khi n ≥ 2 và k ≥ 1. UAT-HD-95 | 06 MH-HD-07 #6; Debt (+P2) |
| P-KT #4 | Nên sửa | **Đã sửa (BA đề xuất).** Nhãn `Tổng thanh toán (gồm VAT)`, cột `Tổng TT (gồm VAT)`; HD-15 so tổng thanh toán với tổng thanh toán HĐ (I1). ⚠ VCsoft xác nhận trường (06 §9.3 câu 8) | 06 HD-15, §9.3; Invoice (+P2) |
| P-KT #5 | Nên sửa | **Đã sửa.** Chip ZNS `… · Đã nhận` / `· Chưa nhận` trên bảng; nút nhanh `Gửi chưa nhận ([n])` | 06 MH-HD-06 #3 #5; InvoiceSend |
| P-KT #6 | Nên sửa | **Đã sửa (BA đề xuất, ⚠ kế toán xác nhận).** Mọi số trên MH-OA-19 là chưa VAT; nhãn `Thực chưa VAT (hóa đơn Zalo)`, ước tính `× đơn giá chưa VAT`, ghi chú trang | 04 MH-OA-19 #2; Zns |
| P-KT #7 | Nên sửa | **Đã sửa.** Một luật: chỉ người vai trò "Kế toán / Thanh toán" (OA-15), không có → ✖ `Chưa có người nhận TT` ở cả MH-HD-07, 04 MH-OA-12, 13. Bản vẽ Công nợ và chiến dịch cùng trạng thái **sau khi nạp TD-S8** (người nhận Phú Thịnh, Thành Công = dòng TD-S8); Anh Đặng Văn Lực → ✖ Chưa có người nhận TT; Garage Minh Phát → ✖ Phản hồi chờ đối chiếu (TD-PH1, khớp bước 2 và MH-HD-08); cột Owner khách không owner `chưa có · báo GS` | 06 MH-HD-07 #4; 04 MH-OA-13 #5; Debt (+P2), OaCampaign (+P2) |
| P-KT #8 | Gợi ý | **Đã sửa (BA đề xuất).** Giờ sao kê không điền sẵn, bắt nhập; gợi ý giờ khoản cuối trên VCsales nếu API có (HD-50 a) | 06 HD-50, MH-HD-07 #10; Debt (+P2) |
| P-KT #9 | Gợi ý | **Đã sửa (BA đề xuất).** Kết quả `Khác người đang đặt` (Giữ / Thay, mặc định Giữ) | 06 MH-HD-12 #5; DebtAdmin |
| P-KT #10 | Gợi ý | **Đã sửa ở đặc tả.** Kết quả không chọn sẵn, `Xong` khóa tới khi chọn. Bản vẽ giữ trạng thái đang xử lý (Hà đã chọn), không đổi | 06 MH-HD-08 #8 |
| P-KT #11 | Gợi ý | **Không sửa bản vẽ.** 00 §2.1 là nguồn menu: các mục nằm ở nhóm MARKETING ("Chiến dịch & ZNS" là tên cũ). Sửa "Mở từ" MH-OA-19 cho khớp 00. Muốn đổi tên nhóm cho kế toán → việc của 00 | 04 MH-OA-19 |
| P-CS #3 | Nên sửa | **Đã sửa ở đặc tả (BA đề xuất)**: dòng trạng thái dưới tin khách `Đã chuyển kế toán đối chiếu · {giờ}` → `Kế toán: {kết quả}`, "Gửi cho kế toán" trong menu tin OA của CSKH, không tạo mục trùng, câu giữ chỗ. **Vẽ → chuyển nhóm** (khung chat OA / hộp thư CSKH không thuộc artboard nhóm này) | 06 MH-HD-08 #12 |
| P-CS #5 | Nên sửa | **Đã sửa (BA đề xuất).** Báo cả người xử lý cuối (Lan); ticket mở lại giao lại Lan, nhãn `Mở lại do khảo sát` trong "Ticket của tôi" | 04 MH-OA-16, UAT-OA-77; OaReports |
| P-CS #6 | Nên sửa | **Đã sửa (BA đề xuất, Q5).** Khớp theo cả từ; tin có dấu so có dấu, tin không dấu so bỏ dấu ("lựa" không khớp "lừa"); số "Chạy 7 ngày" bấm xem tin đã khớp. UAT-OA-159 | 04 MH-OA-10 #4, #8; OaAuto |
| P-CS #7 | Nên sửa | **Đã sửa** cùng P-GD #1 (toast + trạng thái bản sửa) | 04 MH-OA-10; OaAuto |
| P-CS #8 | Nên sửa | **Đã sửa.** Quy tắc mẫu chỉ OA VCparts; ô OA của trưởng nhóm chỉ OA nhóm mình; nhiều OA thì chọn nhóm theo từng OA | 04 MH-OA-10 #3; OaAuto |
| P-CS #9 | Nên sửa | **Đã sửa (BA đề xuất).** Dòng hệ thống `Quy tắc "Từ khóa bảo hành": gắn tag Bảo hành · mở #TK-[..] · chuyển CSKH VCparts`; ticket do quy tắc mở ghi người tạo là quy tắc. Vẽ mẫu ở khối "Dòng hệ thống" của OaAuto; khung chat thật → chuyển nhóm hộp thư CSKH | 04 MH-OA-10; OaAuto |
| P-CS #10 | Nên sửa | **Chưa vẽ.** Đặc tả 04 MH-OA-13 #3–#5 đã đủ (nguồn tag / loại khách / khu vực; loại OA-29, OA-20, cùng mẫu N ngày) nên không sửa đặc tả. Cặp OaCampaign + P2 chỉ còn 18 px trong khung cắt cố định (canvas.json) → cần phiên chính nới khung cắt hoặc thêm artboard để designer vẽ bước 2 nguồn tag cho góc Yến | – |
| P-CS #11 | Gợi ý | **Một phần.** (b) điền `Dùng khi` mẫu 312080 (BA đề xuất). (a) báo trùng 24 giờ ngay khi mở modal: không làm lượt này (đổi quy tắc chặn, để vòng sau) | 04 MH-OA-11; Zns |
| P-CS #12 | Gợi ý | **Không sửa.** Đặc tả D8-08 đã đủ (chỉ xem, ẩn Lưu / Xuất); vẽ góc Yến riêng để vòng sau | – |
| P-CS #13 | Gợi ý | **Đã sửa.** Ô chọn ghi `Mẫu câu (tin tư vấn) · Tiếp nhận bảo hành · v3` | 04 MH-OA-10 #9; OaAuto |
| P-GS #2 | Nên sửa | **Đã sửa.** Biến thể GS dùng đủ bảng GĐ: tách lý do bỏ qua, Đang mở, Đã thành owner, Được bù; dòng Chưa phân công + so tải; Tổ HN1 nhận theo "Còn lại"; Theo quy tắc | 07 MH-RT-05 #3; RoutingChange |
| P-GS #4 | Nên sửa | **Đã sửa (BA đề xuất).** NVKD lưu giải trình → GS nhận thông báo "Để biết"; Drawer lọc `Có giải trình chưa đề nghị`; chip `Giải trình chờ xem [n]` ở MH-BC-03 | 07 BC-26 (a)(c)(d); Reports (+P2), ReportsDetail |
| P-GS #5 | Nên sửa | **Đã sửa.** Nút có chữ `Ghi giải trình`; `Đề nghị tính lại` chỉ ở dòng đã có giải trình, chưa đề nghị; dòng đã đề nghị ghi `đã gửi đề nghị` | 07 BC-26 (b); ReportsDetail |
| P-GS #6 | Nên sửa | **Một phần.** Dòng độ phủ ghi `Tú VCparts mất đồng bộ`. Bộ số "Ngay bây giờ" cho Tổ HN1 → **chuyển nhóm dữ liệu** (TD §6.4) | 07 bảng R1; Reports (+P2) |
| P-GS #7 | Nên sửa | **Đã sửa.** "Trả lời hộ 1" vào tooltip ⓘ cạnh tên GS, không còn chữ ngoài lưới | 07 bảng R1; Reports (+P2) |
| P-GS #10 | Gợi ý | **Đã sửa.** `Tú [..] (Nghỉ phép · Linh trực thay)` | 07 bảng R1; Reports (+P2) |
| P-GS #11 | Gợi ý | **Đã sửa (BA đề xuất).** `tồn từ hôm trước [..]` bấm riêng → danh sách lọc `before=today` | 07 bảng R1; Reports (+P2) |
| P-GS #12 | Gợi ý | **Đã sửa (BA đề xuất).** `Sửa và gửi lại` trên dòng "Đã trả lại", tạo mã mới | 07 bảng R1; RoutingChange |
| P-KD #1 | Nên sửa | **Đã sửa phần của nhóm.** Một cách viết theo 03 MH-SZ-07 #3: `Công nợ: 12.000.000 ₫ · đến hạn 05/10`, `Công nợ: 180.000.000 ₫ · Quá hạn 62 ngày (hạn 29/07)`; bỏ `Quá hạn: 0 ₫` và `(quá hạn 0 ₫)` ở MH-HD-04, MH-HD-13, góc KD Công nợ. Panel InfoPanel → chuyển nhóm | 06 MH-HD-04 #8, MH-HD-13 #3; InvoiceSend, Debt (+P2) |
| P-KD #4 | Nên sửa | **Đã sửa (gỡ M-4, BA đề xuất).** KD có menu Công nợ (00 §2.2 👁), góc nhìn `Khách của tôi`, ẩn nút của kế toán, `Tôi tự nhắc` khi đến hạn / quá hạn, `⋯` Đề nghị tạm hoãn / ghi chú. Trạng thái 403 cũ ("KD không có menu") sửa. UAT-HD-94 | 06 MH-HD-07 trạng thái, quyền; Debt (+P2) |
| P-KD #5 | Nên sửa | **Đã sửa.** Sau khi chọn: `Bạn đã chọn "Xin giữ lại" lúc [HH:mm]` thay dải đếm ngược | 06 MH-HD-13 #7; Debt (+P2) |
| P-KD #6 | Nên sửa | **Câu hỏi chủ dự án (Q4).** Thuộc QĐ-01 (điện thoại) đang chờ; không tự quyết | – |
| P-KD #10 | Nên sửa | **Một phần (Q6).** Thẻ Chốt của KD thêm Tag `tạm` và `(n = 1)` như thẻ tổ / division; không đổi số chính thành "–" vì trái §3.6 và số lứa đủ tuổi chưa có trong TD | 07 bảng R1; Reports (+P2) |
| P-KD #11 | Nên sửa | **Đã sửa (ghi chú góc KD trên Drawer, BA đề xuất).** Cùng thành phần Drawer, chỉ lượt của mình, tag "Về trễ"; không vẽ khung riêng (khung ReportsDetail còn 17 px) | 07 bảng R1; ReportsDetail |
| P-KD #12 | Nên sửa | **Đã sửa.** Góc owner MH-HD-09 thấy đủ `0900 000 103 / 101 / 102` theo 01 PQ-45; vai khác ẩn + `Hiện` | 06 MH-HD-09 quyền; Debt (+P2) |
| P-KD #14 | Gợi ý | **Một phần.** Δ của "% trả lời qua VClinks" màu trung tính. Chip "Báo giá treo" giữ (quy ước bản vẽ: tính năng GĐ2 vẽ kèm nhãn GĐ2) | 07 bảng R1; Reports (+P2) |
| P-KD #15 | Gợi ý | **Không sửa.** KPI-16 "Doanh số VCsales" đã là GĐ2 trong đặc tả; thêm thẻ khi bật GĐ2 | – |
| P-MK #7 | Nên sửa | **Câu hỏi chủ dự án (Q3).** Nuôi lead qua chiến dịch OA / ZNS là quyết định phạm vi | – |
| P-SA #8 | Gợi ý | **Không sửa lượt này.** Định nghĩa số việc VCsales thuộc 02 (nhóm KH); khung ReportsDetail hết chỗ | – |

## 3. Chuyển nhóm khác / việc ngoài file

| Việc | Nơi làm | Góp ý |
|---|---|---|
| Tìm kiếm CSKH phải hiện dòng "Ngoài phạm vi" theo D8-04 (**Chặn**) | Search (00 MH-UI-04) | P-CS #1 |
| Tra hàng góc CSKH; panel Công nợ thống nhất MH-HD-04; Tìm khách, Danh bạ, mã OE | InfoPanel, Customers, Contacts, Search (00, 02, 03) | P-CS #2, P-KD #1 (phần panel), #2, #3, #7, #8, #13, P-GS #13 |
| Lead tranh chấp cho GS (**Chặn**), tên "Tổ HN", Giao lại ẩn; chatbot duyệt; ngân sách; bình luận góc CSKH | MkLeads, MkChatbot, MkSources, FanpageComments (05) | P-GS #1, #8, P-KD #9, P-GD #5, #6, #9, #10, P-CS #4 |
| Xung đột owner trong tổ, Chuyển khách về tổ | OwnerConflict (02) | P-GD #8, P-GS #3, #9 |
| Vẽ dòng trạng thái phản hồi thanh toán và dòng quy tắc tự động **trong khung chat OA thật** (đặc tả đã có: 06 MH-HD-08 #12, 04 MH-OA-10) | Hộp thư CSKH / khung chat OA | P-CS #3, #9 |
| Dữ liệu: số Tổ HN2, HCM1 và 2–3 tuần số chụp (§6.4); bộ số "Ngay bây giờ" 10:00 29/09 Tổ HN1 theo người; xác nhận TD-K13, TD-K15 nằm trong 40 khách có SĐT kế toán của TD-S8 (bản vẽ Công nợ, chiến dịch dùng trạng thái sau khi nạp TD-S8) | `du-lieu-kiem-thu.md` | P-GD #12, P-GS #6, P-KT #7 |
| Nới khung cắt cặp OaCampaign / OaCampaignP2 (còn 18 px) để vẽ bước 2 nguồn tag góc Yến | canvas.json (phiên chính) | P-CS #10 |
| Nếu Q3 chọn B: 00 §2.2 để MK "–" ở "Chiến dịch gửi tin" | 00 | P-MK #7 |

## 4. Ghi chú bản vẽ

- Không đổi khung cắt / `$preview`; mọi artboard vẫn vừa khung (đo Playwright): OaAuto 6806/6814, Zns 7001/7009, OaCampaign+P2 8282/8300, OaReports 4344/4400, Invoice+P2 8523/8570, InvoiceSend 7110/7160, Debt+P2 13382/13440, DebtAdmin 6080/6097, Reports+P2 9503/9520, ReportsDetail 7663/7680, RoutingChange 7564/7584. Đường cắt P2 không cắt qua chữ (Debt 7900, OaCampaign 5260, Invoice 7760, Reports 7650).
- Để vừa khung đã thu khoảng cách giữa các khối (padding / gap tiêu đề mục) ở OaAuto, Debt, Reports, ReportsDetail, RoutingChange; OaAuto gộp khối "GĐ bật / tắt" vào Drawer so sánh, bảng "Không quyền" còn một dòng, toast tắt / xóa ghi thành một dòng chữ.
- Cặp X / XP2 sinh lại từ X, chỉ khác 3 dòng (tiêu đề, khung cắt, `$preview`). Cân bằng thẻ html.parser: 0 lỗi; không thêm ký tự emoji mới; mọi `<button>` có `type="button"`.

## 5. Câu hỏi cho chủ dự án

**Q1 — Giám đốc có nút "Trả lại" bản sửa quy tắc tự động không?** (P-GD #1)
- A: Có `Trả lại` (lý do bắt buộc), người sửa được báo, bản đang chạy giữ nguyên.
- B: Không; giám đốc chỉ `Bật bản sửa` hoặc để đó, nhắn trưởng nhóm ngoài hệ thống.
- **BA đề xuất A** (tránh bản sửa treo mãi; cùng kiểu duyệt nội dung MH-OA-08). Bản vẽ đang theo A.

**Q2 — Khách có đề nghị tạm hoãn đang chờ duyệt: loại khỏi nhắc nợ ngay?** (P-KT #1, HD-30 k)
- A: Loại ngay ở Công nợ, bước 2 và màn duyệt; không cộng vào tổng đang đòi; nhắc lẻ bị chặn khi chờ giám đốc.
- B: Vẫn "Gửi được" nhưng có cảnh báo; giám đốc tự bấm `Loại khách này`.
- **BA đề xuất A** (một kết luận ở mọi màn; khách chiến lược không bị nhắc nhầm). Bản vẽ đang theo A.

**Q3 — Marketing có tạo chiến dịch gửi tin "Nuôi lead" qua OA / ZNS không?** (P-MK #7)
- A: Có, ở GĐ2: thêm người tạo TMK (mục đích Nuôi lead), nguồn tập khách `Từ lead: chiến dịch, trạng thái, ngày tạo`, kênh OA / ZNS / Fanpage.
- B: Chưa; 00 §2.2 để MK "–" ở menu "Chiến dịch gửi tin" tới khi làm (theo D8-02, vai trò không có quyền thì ẩn).
- **BA đề xuất B cho lô hiện tại**, ghi A vào lô sau (cần thêm quy tắc tần suất cho lead chưa mua).

**Q4 — Hộp báo trước nhắc nợ (MH-HD-13) trên điện thoại** (P-KD #6, phụ thuộc QĐ-01)
- A: Khi chốt QĐ-01, đưa MH-HD-13 vào đợt màn điện thoại đầu tiên; tới lúc đó thông báo mở được trên trình duyệt điện thoại (một cột, 3 nút to).
- B: Không làm bản điện thoại; kéo khoảng chờ TS-HD-01 từ 2 lên 4 giờ làm việc.
- **BA đề xuất A** (giữ 2 giờ, owner đi thị trường vẫn chọn được).

**Q5 — Quy tắc tự động so khớp có dấu hay bỏ dấu?** (P-CS #6)
- A: Khớp theo cả từ; tin có dấu so có dấu, chỉ tin không dấu mới so bỏ dấu ("lựa" không khớp "lừa").
- B: Khớp theo cả từ, luôn bỏ dấu (đơn giản hơn nhưng "lựa" vẫn khớp "lừa", "tế" khớp "tệ").
- **BA đề xuất A**. Bản vẽ và UAT-OA-159 đang theo A.

**Q6 — Thẻ "Chốt trong 30 ngày" khi mẫu số nhỏ và lứa chưa đủ 30 ngày** (P-KD #10)
- A: Giữ số, kèm Tag `tạm` và `(n = …)` (§3.6) — đã vẽ.
- B: Số chính hiện "–" / `Chưa đủ 30 ngày`, đưa số của lứa đủ tuổi gần nhất lên làm số chính.
- **BA đề xuất A** (một quy tắc cho mọi ô tỷ lệ; B cần thêm số lứa cũ mà TD chưa có).

**Q7 — Ticket mở lại do khảo sát Chưa hài lòng về ai?** (P-CS #5)
- A: Về người xử lý cuối (nghỉ việc / rời nhóm → Chưa phân công), nhãn `Mở lại do khảo sát`, báo cả người đó và giám sát.
- B: Về Chưa phân công của nhóm, chỉ báo giám sát.
- **BA đề xuất A**. Bản vẽ đang theo A.

**Cần kế toán / VCsoft xác nhận (không phải chủ dự án):** tổng VCsales S1 và VCinvoice I1 đã gồm VAT (06 §9.3 câu 8, P-KT #4); hóa đơn ZBS nhập số trước thuế cho MH-OA-19 (P-KT #6); API S3 có trả giờ khoản cuối để gợi ý mốc sao kê (P-KT #8).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 04/10/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk2/vong-1/xu-ly-OAHDBC.md) | — |
