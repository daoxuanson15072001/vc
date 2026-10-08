# Góp ý thiết kế lượt 3 — P-GS (Hương)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Hương (P-GS, trưởng tổ HN1) góp ý lượt 3 ngày 29/09/2026 trên canvas bản 11; xem màn 1d, 1e, 9, 9a, 9b, 8, 3.
- Kiểm lại 11 góp ý cũ: 7 đã sửa tốt · 2 sửa chưa đủ · 2 chưa sửa; không còn góp ý cũ mức Chặn.
- Dữ liệu mẫu giữa các màn đã khớp; "Chia đều" bỏ người đang nghỉ; lệnh "Cần duyệt lại" không còn "Thử lại".
- Làm thử 6 việc: bàn giao khách của người nghỉ việc khoảng 8 cú (lượt 2 khoảng 10); trả lời thay và đặt trực thay không vướng.
- 3 góp ý mới: **0 Chặn** · 1 Nên sửa (hộp Bàn giao ở 360 phải nhắc yêu cầu chuyển đang chờ) · 2 Gợi ý.
- Còn mở: Lệnh gửi phạm vi "Tổ của tôi", nhãn "Đang có người trực thay" ở 360, duyệt mẫu câu của tổ, Báo cáo theo góc nhìn GS.
- Các góp ý còn mở được gom vào `qa.md` (Việc cho designer).

## Mục lục

- [Kiểm lại lượt 2](#kiểm-lại-lượt-2)
- [Làm thử 6 việc](#làm-thử-6-việc)
- [Góp ý mới](#góp-ý-mới)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Người góp ý: Hương, giám sát bán hàng, trưởng tổ HN1 (vai P-GS). Bản vẽ: canvas "VClinks UI Design" bản 11, 29/09/2026. Màn đã xem: 1d Hộp thư giám sát, 1e Nick / Lệnh gửi, 9 Tổ của tôi, 9a Nghỉ việc, 9b Trực thay, 8 Kênh kết nối, 3 Customer 360.

Lượt này các màn đã khớp nhau: ai nghỉ, ai trực, đến mấy giờ, nick nào đỏ từ lúc nào đều giống nhau ở mọi màn, nên tôi đọc bản vẽ mà không phải dò lại. Hai chỗ tôi lo nhất ở lượt 2 đã được xử lý: "Chia đều" không còn dồn khách cho người đang nghỉ, và lệnh do người đã nghỉ việc duyệt giờ phải có người duyệt lại, không bấm "Thử lại" được. Những chỗ còn thiếu là Lệnh gửi theo phạm vi "Tổ của tôi" (vẫn chỉ là một dòng chữ) và vài chi tiết nhỏ quanh bàn giao.

## Kiểm lại lượt 2

| # | Góp ý (tóm tắt) | Mức cũ | Kết quả | Ghi chú |
|---|---|---|---|---|
| L2-1 | 9a: "Chia đều" chia khách cho Minh đang nghỉ | Nên sửa | **Đã sửa tốt** | Dòng Minh hiện 0 khách, ghi "Nghỉ phép · bỏ khỏi chia đều" kèm câu "Chia đều bỏ người Vắng, Ngoại tuyến, có cờ Nghỉ phép". Đã có cột Hạng A và Tải của từng người nhận |
| L2-2 | 9 / 9a: tên tổ của Khoa lệch (HN1 và HN2); GS làm được bước nào | Nên sửa | **Đã sửa tốt** | Hai màn đều ghi Tổ HN1, người nhận là "Người nhận (Tổ HN1)". Đầu màn 9a ghi "Giám sát chỉ bước ②, ③ sau khi đã khóa"; ở bước ② ghi "sang tổ khác cần GĐ duyệt" |
| L2-3 | Lệnh "Cần duyệt lại" không được có "Thử lại"; Lệnh gửi phạm vi "Tổ của tôi" | Nên sửa | **Sửa chưa đủ** | Phần nút đã đúng: 1e dùng "Duyệt lại", ghi "Chỉ người đang giữ nick duyệt lại; không có Thử lại". Bước ③ ghi "3 lệnh Cần duyệt lại → Ngân duyệt lại". Nhưng **Lệnh gửi phạm vi "Tổ của tôi" vẫn chỉ là dòng chữ "Phạm vi khác: Tổ của tôi (giám sát)"**: không có cột NVKD, không gom theo người, nên sáng 10:00 tôi vẫn chưa thấy mình sẽ rà lệnh treo của cả tổ ra sao |
| L2-4 | 1d: nút Nhắc phải gửi cho người trực thay | Nên sửa | **Đã sửa tốt** | Tiêu đề khung chat hội thoại của Minh hiện "Nhắc Ngân (trực thay Minh)". Màn 9 ghi quy tắc "Nút Nhắc gửi cho người trực thay khi người phụ trách có cờ Nghỉ phép". Còn một chỗ nhỏ, xem góp ý mới #1 |
| L2-5 | 9b: ô "Từ – Đến" gõ tay; "Trực nhóm khách" khó hiểu | Gợi ý | **Đã sửa tốt** | Có nút nhanh "Hôm nay · 3 ngày · Đến hết tuần", giờ mặc định 8:00–17:30. Mục đổi tên thành "Chia bớt khách cho người trực khác" kèm câu giải thích. Dưới form có "Minh đang có 9 hội thoại mở, 3 chưa trả lời sẽ hiện trong hộp thư của Ngân". Có thêm cảnh báo trùng lịch khi Tú đang trực nick Hà, rất có ích |
| L2-6 | Dữ liệu mẫu giữa các màn không khớp | Gợi ý | **Đã sửa tốt** | Có bộ dữ liệu chung ở ghi chú: Nick Tú đỏ từ 07:10; Minh nghỉ phép, Ngân trực 13:00–17:30 ngày 29/09; Khoa (HN1) nghỉ việc 29/09. Tôi dò ở 1d, 1e, 8, 9, 9a, 9b đều khớp |
| L2-7 (L1-7) | 8 Kênh kết nối: lọc "Tổ của tôi"; GS không thấy "Cấp lại" | Gợi ý | **Đã sửa tốt** | Có nút lọc "Tổ của tôi (giám sát)" và quy tắc "Giám sát chỉ thấy nick của tổ và chữ Báo Admin, không có Cấp lại / Cấu hình". Màn vẫn vẽ bằng mắt Admin, nhưng quy tắc đã ghi rõ nên tôi chấp nhận |
| L1-6 | Danh sách "Chưa phân công" chưa vẽ | Nên sửa | **Đã sửa tốt** | 1d có "Chưa phân công (3) · chọn nhiều": ô tích trên dòng, nguồn (Quảng cáo / OA / Fanpage), khu vực, đã chờ bao lâu. Hộp "Giao cho…" ghi Minh "Nghỉ phép · không nhận khách mới" |
| L1-13 | 3 Customer 360: hộp Bàn giao chưa vẽ; không có nhãn khi khách đang có người trực thay | Nên sửa | **Sửa chưa đủ** | Hộp Bàn giao đã vẽ: người nhận trong tổ, lý do bắt buộc, liệt kê hội thoại / nhắc việc / báo giá đi theo khách, ghi "sang tổ khác cần GĐ duyệt". **Chưa có nhãn "Đang có người trực thay"** ở khu Phụ trách (ví dụ khách của Minh hôm nay) |
| L1-16 | Duyệt mẫu câu của tổ | Gợi ý | **Chưa sửa** | 1b chỉ ghi "phạm vi mẫu Tổ có duyệt"; màn 9 chưa có danh sách "Chờ duyệt" |
| L1-17 | Báo cáo vẽ theo mắt GĐ | Gợi ý | **Chưa sửa** | Màn 7 vẫn "chủ quản chờ BA" |

**Tổng:** 7 đã sửa tốt · 2 sửa chưa đủ · 2 chưa sửa. Không còn góp ý cũ nào ở mức Chặn.

## Làm thử 6 việc

| Việc | Các bước (màn) | Số cú bấm | Lượt 2 | Còn vướng |
|---|---|---|---|---|
| (a) Tìm hội thoại quá SLA của tổ và nhắc NVKD | 1d mặc định Tổ HN1 → bấm `Quá SLA 2` (1) → dòng Quân Nguyễn: "Nhắc Tú" ngay trên dòng (1) → dòng Anh Tuấn (Minh): mở hội thoại (1) → "Nhắc Ngân (trực thay Minh)" (1) | **4 cú cho 2 hội thoại** | 2 cú + 1 mỗi hội thoại, nhưng nhắc nhầm Minh | Nhắc đã đúng người. Dòng của Minh trong danh sách không có nút Nhắc nên phải mở hội thoại, thêm 1 cú (góp ý mới #1) |
| (b) Chia khách mới ở "Chưa phân công" | Tab `Chưa phân công 3` (1) → tích dòng (3 dòng đã tích sẵn trong bản vẽ; với 5 khách ≈ 5) → "Giao cho…" (1) → chọn Ngân (1) → lý do "Chia đều" (1) → "Giao 3 hội thoại" (1) | **≈ 8 cú cho 3 khách, ≈ 10 cho 5** | ≈ 10 (phần tích dòng phải đoán) | Không vướng. Thấy đủ nguồn, khu vực, thời gian chờ để quyết |
| (c) Trả lời thay khách của Minh đang nghỉ | Dải "Minh 3" (1) → mở Anh Tuấn (1) → gõ → Gửi (1) → hộp "Trả lời thay Phạm Minh?" (1) | **4 cú + gõ** | 4 cú + gõ | Không vướng. Có thêm biến thể dải xanh "Bạn đang trực thay…" cho Ngân, đúng như thực tế |
| (d) Bàn giao toàn bộ khách của Khoa nghỉ việc | Quản trị (1) → Tổ HN1 (1) → dòng Khoa "Tiếp tục bàn giao" (1) → ② "Chia đều" (1), Minh tự bị bỏ, không phải sửa tay → ③ người giữ nick mới (1) → tích "Đã đăng xuất điện thoại cũ" và "Đã quét lại QR" (2) → ④ "Bàn giao 96 khách và 1 nick" (1) | **≈ 8 cú** | ≈ 10 cú | Chia đều đang chia theo số khách (48/48), không theo tải: Ngân nhận 48 khách + nick Khoa + đang trực Minh (góp ý mới #2) |
| (e) Sửa quy tắc chia khách | Quản trị (1) → "Đề xuất thay đổi cho GĐ" (1) → form chưa vẽ | **2 cú + form** | 2 cú + form | Đúng quyền. Form đề xuất và nơi xem GĐ đã duyệt chưa vẫn chưa vẽ; tôi chấp nhận chờ |
| (f) Đặt trực thay 3 ngày cho NVKD nghỉ phép | Cách 1: 9b "+ Tạo trực thay" (1) → người vắng (1) → người trực (1) → nút "3 ngày" (1) → gõ lý do → "Tạo trực thay" (1). Cách 2: tab "Chờ tôi duyệt" → "Vẫn đồng ý" / "Chọn người khác" | **Cách 1: 5 cú + gõ lý do; cách 2: 1–2 cú** | 6 cú + gõ ngày giờ | Không vướng. Cảnh báo "Tú đang trực Nick Hà tới 02/10, trùng 1 ngày" giúp tôi tránh giao trùng |

## Góp ý mới

| # | Màn | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | 1d Hộp thư giám sát | Dòng quá SLA của Tú có nút "Nhắc Tú" ngay trên dòng, còn dòng quá SLA của Minh (Anh Tuấn) không có, phải mở hội thoại mới thấy "Nhắc Ngân (trực thay Minh)". Thông báo gộp "Tú 1 · Minh 2" không nói phần của Minh có báo cho Ngân không | Sáng rà quá SLA tôi muốn nhắc hết từ danh sách, không mở từng hội thoại. Nếu thông báo quá SLA của Minh chỉ đến Minh thì hôm nay không ai nhận | Đặt nút "Nhắc Ngân (trực Minh)" trên mọi dòng quá SLA, kể cả khi có trực thay. Thông báo gộp ghi "Minh 2 (đã báo Ngân)" | Gợi ý |
| 2 | 9a Nghỉ việc (bước ②, ③) | "Chia đều" chia 48/48 theo số khách, trong khi Ngân còn nhận nick Khoa ở bước ③ và đang trực thay Minh; Tú đang xử lý 14, Ngân 6 | Ngày đầu sau bàn giao, Ngân phải trả lời khách của 3 người (của mình, của Khoa, của Minh). Khách hạng A của Khoa dễ bị chờ lâu | Bước ④ hiện tổng tải của từng người nhận sau bàn giao (khách, hội thoại mở, nick đang giữ / đang trực) và cảnh báo vàng khi một người vừa nhận nick vừa đang trực thay | Gợi ý |
| 3 | 3 Customer 360 (hộp Bàn giao) | Khách đang có "Yêu cầu chuyển đang chờ: Đỗ Mai Linh", nhưng hộp Bàn giao không nhắc tới yêu cầu này | Nếu tôi bàn giao cho Ngân mà yêu cầu của Linh vẫn treo, lát sau tôi hoặc GĐ bấm "Duyệt" là khách đổi chủ hai lần | Trong hộp Bàn giao hiện dòng "Có yêu cầu chuyển của Linh đang chờ: bàn giao sẽ từ chối yêu cầu này" kèm lựa chọn "Giao cho Linh" | Nên sửa |

**Tổng góp ý mới:** 3 — 0 Chặn · 1 Nên sửa · 2 Gợi ý.

**Chặn còn lại:** không có.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-3/P-GS.md) | — |
