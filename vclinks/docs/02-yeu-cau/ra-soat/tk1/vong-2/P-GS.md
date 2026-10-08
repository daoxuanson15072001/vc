# Góp ý thiết kế lượt 2 — P-GS (Hương)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Hương (P-GS) góp ý lượt 2 ngày 29/09/2026 trên canvas bản 8; xem màn 1d, 1e, 9, 9a, 9b, 8, 3.
- Kiểm lại 17 góp ý lượt 1: 12 đã sửa tốt · 3 sửa chưa đủ · 2 chưa sửa; cả 5 Chặn lượt 1 đã sửa tốt.
- Cải thiện chính: dải tóm tắt tổ cho giám sát, trả lời thay / trực thay / nghỉ việc tách bạch, bỏ quy tắc "offline 15 phút".
- Làm thử 6 việc: nhắc 9 hội thoại quá SLA còn khoảng 10 cú (lượt 1 khoảng 45); chia 5 khách khoảng 10 cú.
- 7 góp ý mới: **0 Chặn** · 4 Nên sửa · 3 Gợi ý; chủ yếu "Chia đều" chia cho người đang nghỉ, tổ của Khoa lệch HN1/HN2, lệnh "Cần duyệt lại" còn "Thử lại", nút Nhắc chưa gửi người trực thay.
- Còn mở: danh sách Chưa phân công, Lệnh gửi phạm vi Tổ, hộp bàn giao ở 360, duyệt mẫu câu, Báo cáo; dữ liệu mẫu giữa các màn còn lệch.
- Kết quả xử lý xem `vong-3/P-GS.md`.

## Mục lục

- [Kiểm lại góp ý lượt 1](#kiểm-lại-góp-ý-lượt-1)
- [Làm thử 6 việc](#làm-thử-6-việc)
- [Góp ý mới](#góp-ý-mới)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Người góp ý: Hương, giám sát bán hàng, trưởng tổ 7 NVKD (vai P-GS). Bản vẽ: canvas "VClinks UI Design" bản 8, 29/09/2026. Màn đã xem: 1d Hộp thư giám sát, 1e Nick / Lệnh gửi, 9 Tổ của tôi, 9a Nghỉ việc, 9b Trực thay, 8 Kênh kết nối, 3 Customer 360.

Lượt này bản vẽ đã nhìn bằng mắt giám sát: sáng mở máy, dải `Chưa trả lời 9 · Quá SLA 2 · Lệnh lỗi 1 · Nick đỏ 1` cùng dòng "Tú 4 · Minh 3 · Ngân 2" cho tôi biết tổ có vấn đề gì trong chưa tới 1 phút. Trả lời thay, trực thay và nghỉ việc giờ đã là ba việc tách bạch, đúng như tôi vẫn làm ngoài đời. Quy tắc "offline 15 phút thì chia cho người khác" đã bỏ, và màn nghỉ việc có bước thu nick trên điện thoại cũ, đây là hai chỗ làm tôi yên tâm nhất. Những chỗ còn lại chủ yếu là số liệu mẫu giữa các màn chưa khớp nhau, và vài màn phụ chưa vẽ (Chưa phân công, Lệnh gửi của tổ, Báo cáo, duyệt mẫu câu).

## Kiểm lại góp ý lượt 1

| # cũ | Góp ý lượt 1 (tóm tắt) | Mức cũ | Kết quả | Ghi chú |
|---|---|---|---|---|
| 1 | Hộp thư thiếu góc nhìn giám sát (dải tóm tắt tổ, lọc Quá SLA, nhóm theo NVKD) | Chặn | **Đã sửa tốt** | Màn 1d có đủ: dải 4 con số bấm được, tab `Quá SLA 2`, dòng "Chưa trả lời: Tú 4 · Minh 3 · Ngân 2", ô "Nhóm theo NVKD", lọc `Người phụ trách: Tổ HN1 (7)` |
| 2 | Trả lời thay không khác gì tin thường | Chặn | **Đã sửa tốt** | Có dải vàng "Bạn đang trả lời thay Phạm Minh trên nick Nick Minh", hộp xác nhận hiện đúng nội dung, nhãn "Gửi bởi Hương (trả lời thay Minh)" và ghi chú nội bộ tự động. Có thêm link "Tạo trực thay cho Minh…", rất tiện |
| 3 | Nghỉ phép đang làm bằng "bàn giao có thời hạn", cần Trực thay | Chặn | **Đã sửa tốt** | Menu ⋯ tách "Đặt người trực thay… · Bàn giao khách… · Nghỉ việc…". Màn 9b ghi rõ "không đổi người phụ trách". Dòng Minh hiện `Nghỉ ốm hôm nay · Ngân trực thay tới 18:00` |
| 4 | Luồng nghỉ việc chưa vẽ, thiếu nick, chia nhiều người, xem trước, xác nhận | Chặn | **Đã sửa tốt** | Màn 9a đủ 4 bước theo MH-PQ-04, có khóa (GS thấy "Đề nghị khóa"), chia đều / theo khu vực / chọn từng khách kèm tải của người nhận, thu nick trên điện thoại, đếm ngược 24 giờ, nút ghi rõ số "Bàn giao 96 khách và 1 nick". Còn 2 lỗi nhỏ, xem góp ý mới #1 và #2 |
| 5 | "Owner offline 15 phút → chia cho người khác" | Chặn | **Đã sửa tốt** | Giờ là "chỉ báo giám sát và người trực thay; hội thoại vẫn của người phụ trách". Có thêm dòng "Tin vào nick cá nhân luôn về người giữ nick" |
| 6 | Chia khách chưa phân công từng cái một, hộp "Chuyển" chưa vẽ | Nên sửa | **Sửa chưa đủ** | Đã có hộp "Giao cho…" chọn nhiều hội thoại, hiện tải, khu vực, trạng thái nghỉ, lý do chọn nhanh. Nhưng **danh sách "Chưa phân công" vẫn chưa vẽ**: không thấy ô chọn trên dòng, nguồn khách (OA/Fanpage/quảng cáo), khu vực, đã chờ bao lâu |
| 7 | Kênh kết nối không cho biết nick nào của tổ tôi mất kết nối, ai giữ | Nên sửa | **Sửa chưa đủ** | Đã có Xanh/Vàng/Đỏ, "Người giữ", "Mất kết nối từ 07:10", nút "Báo Tú", câu kỹ thuật chuyển vào "chi tiết cho Admin". Còn thiếu lọc "Tổ của tôi" (màn vẫn vẽ bằng mắt Tú, lẫn cả token OA/Fanpage của Admin) |
| 8 | Chip SLA thiếu trạng thái ngoài giờ; dòng không ghi ai phụ trách | Nên sửa | **Đã sửa tốt** | Có chip `Ngoài giờ · tính lại lúc 08:00`; nhóm theo NVKD cho biết ai phụ trách. Nhóm Zalo có tính SLA không thì đặc tả vẫn để Q12, tôi chấp nhận chờ |
| 9 | Không thấy tôi nhận thông báo quá SLA ở đâu | Nên sửa | **Đã sửa tốt** | Thông báo gộp "3 hội thoại của tổ vừa quá SLA · Tú 1 · Minh 2", bấm mở lọc, chọn tần suất Ngay / Gộp 15 phút (đang "chờ BA") |
| 10 | GS sửa được quy tắc chia khách cả division bằng 1 nút | Nên sửa | **Đã sửa tốt** | "Bạn là giám sát: chỉ xem. Giám đốc bán hàng sửa quy tắc và SLA" + nút "Đề xuất thay đổi cho GĐ"; có bảng tỉnh/quận → tổ. Form đề xuất chưa vẽ, chấp nhận được |
| 11 | Yêu cầu chuyển khách chỉ có link "Duyệt" | Nên sửa | **Đã sửa tốt** | Có lý do của Linh, lần nhắn cuối hai bên, báo giá/đơn gần nhất, khu vực, nút "Từ chối (ghi lý do)" / "Duyệt" |
| 12 | Số trong bảng tổ không bấm được; nghỉ phép không ghi ai trực | Nên sửa | **Đã sửa tốt** | "Số nào cũng bấm được, mở Hộp thư đã lọc", thêm cột Chưa trả lời, dòng Minh ghi người trực. Cột bỏ rơi 30 ngày để GĐ2 |
| 13 | Customer 360: nút Bàn giao không có xác nhận; không thấy yêu cầu chuyển / trực thay | Nên sửa | **Sửa chưa đủ** | Đã có nhãn "Yêu cầu chuyển đang chờ: Đỗ Mai Linh" và chấm online người phụ trách. Nút đổi thành "Bàn giao…" nhưng **hộp bàn giao chưa vẽ**; chưa có nhãn khi khách đang có người trực thay |
| 14 | Nhắc NVKD phải gõ ghi chú tay | Gợi ý | **Đã sửa tốt** | Có nút "Nhắc Tú" trên dòng quá SLA và "Nhắc Minh" trên tiêu đề khung chat (chờ BA) |
| 15 | "Chưa phân công" với nick cá nhân nghĩa là gì | Gợi ý | **Đã sửa tốt** | Có câu giải thích (dạng chú thích khi rê chuột lên tab). Nên để chữ nhỏ ngay dưới tab cho người mới, nhưng không cản việc |
| 16 | Chưa vẽ chỗ duyệt mẫu câu của tổ | Gợi ý | **Chưa sửa** | Không thấy danh sách "Chờ duyệt" mẫu câu ở màn 9 |
| 17 | Báo cáo vẽ theo mắt GĐ, số không bấm được | Gợi ý | **Chưa sửa** | Màn 7 vẫn ghi "chưa rà" |

**Tổng:** 12 đã sửa tốt · 3 sửa chưa đủ · 2 chưa sửa. Cả 5 góp ý mức Chặn của lượt 1 đều đã sửa tốt.

## Làm thử 6 việc

| Việc | Các bước (màn) | Số cú bấm | Lượt 1 | Còn vướng |
|---|---|---|---|---|
| (a) Tìm hội thoại quá SLA của tổ và nhắc NVKD | Hộp thư giám sát (1d) mặc định tổ → bấm `Quá SLA 2` trên dải → danh sách đã nhóm theo NVKD → bấm "Nhắc Tú" ngay trên dòng | **2 cú cho hội thoại đầu, +1 cú mỗi hội thoại sau**; 9 hội thoại ≈ 10 cú | ≈ 45 cú | Khi Minh đang được Ngân trực thay, "Nhắc" vẫn gửi cho Minh đang nghỉ ốm (góp ý mới #4) |
| (b) Chia 5 khách mới ở "Chưa phân công" | Tab `Chưa phân công` (1) → tích 5 dòng (5) → "Giao cho…" (1) → chọn Ngân (1) → chọn lý do "Chia đều" (1) → "Giao 5 hội thoại" (1) | **≈ 10 cú** (chia cho 2 người thì ≈ 14) | ≈ 25 cú | Ô tích trên dòng và thông tin dòng (nguồn, khu vực, đã chờ bao lâu) chưa vẽ, nên phần "tích 5 dòng" là tôi đoán |
| (c) Trả lời thay khách của NVKD nghỉ ốm (Minh) | Dải thứ hai bấm "Minh 3" (1) → mở hội thoại Anh Tuấn (1) → gõ → Gửi (1) → hộp xác nhận "Trả lời thay" (1) | **4 cú + gõ** | ≈ 5 cú, không có dấu hiệu trả lời thay | Không vướng. Mở hội thoại không làm mất badge của Minh, khách không thấy "Đã xem"; đúng điều tôi lo |
| (d) Bàn giao toàn bộ khách của NVKD nghỉ việc (Đỗ Khoa) | Quản trị (1) → tổ trong cây (1) → dòng Khoa "Tiếp tục bàn giao" (1) (khóa đã do GĐ làm) → ② chọn "Chia đều" (1) → sửa tay bớt khách của Minh đang ốm (≈2) → ③ chọn người giữ nick mới (1) → tích "Đã thu nick trên điện thoại cũ" và "Đã quét lại QR" (2) → ④ "Bàn giao 96 khách và 1 nick" (1) | **≈ 10 cú** | ≈ 10 cú nhưng thiếu nick, xem trước, xác nhận | "Chia đều" tự chia cho cả Minh đang nghỉ ốm (góp ý mới #1). Màn ghi Khoa thuộc tổ HN2 nhưng người nhận lại là người HN1 (góp ý mới #2). 3 lệnh "Cần duyệt lại" không rõ ai duyệt (góp ý mới #3) |
| (e) Sửa quy tắc chia khách | Quản trị (1) → khối "Chia hội thoại" chỉ đọc → "Đề xuất thay đổi cho GĐ" (1) → (form chưa vẽ) | **2 cú + form** | 3 cú, sửa thẳng được | Đúng quyền: tôi chỉ đề xuất, GĐ sửa. Chưa thấy form đề xuất và tôi biết GĐ đã duyệt hay chưa ở đâu |
| (f) **Mới:** Đặt trực thay 3 ngày cho NVKD nghỉ phép | Cách 1: Quản trị (1) → ⋯ dòng NVKD (1) → "Đặt người trực thay…" (1) → người vắng điền sẵn → chọn người trực (2) → gõ ô "Từ – Đến" → gõ lý do → "Tạo trực thay" (1). Cách 2: NVKD tự đăng ký vắng → tôi vào tab "Chờ tôi duyệt" bấm "Đồng ý = tạo trực thay" | **Cách 1 ≈ 6 cú + gõ ngày giờ; cách 2: 2 cú** | (không có) | Ô "Từ – Đến" là một ô gõ tay `29/09/2026 13:00 → …`, gõ 3 ngày dễ sai. Mục "Trực nhóm khách (tối đa 3 dòng)" tôi không hiểu ngay là gì (góp ý mới #5). Cách 2 rất tốt |

## Góp ý mới

| # | Màn | Góp ý | Vì sao | Đề xuất sửa | Mức |
|---|---|---|---|---|---|
| 1 | 9a Nghỉ việc (bước ② Bàn giao khách) | "Chia đều" tự chia 32 khách cho Phạm Minh dù dòng Minh ghi "nghỉ ốm hôm nay" | Khách hạng A của người nghỉ việc dồn sang người đang vắng, không ai trả lời. Trong vài ngày đầu là lúc dễ mất khách nhất | Mặc định **bỏ khỏi danh sách chia** người đang vắng hoặc đang được trực thay; nếu tôi vẫn thêm vào thì hiện cảnh báo vàng "Minh đang nghỉ ốm, khách sẽ do Ngân trực thay trả lời". Hiện thêm số khách hạng A mỗi người nhận để tôi cân lại | Nên sửa |
| 2 | 9 Tổ của tôi / 9a Nghỉ việc | Đỗ Khoa nằm trong bảng tổ HN1 của tôi, nhưng màn 9a ghi "NVKD, Tổ HN2", và "Người nhận (trong tổ HN2)" lại là Ngân, Tú, Minh của HN1 | Theo đặc tả, GS chỉ bàn giao được trong tổ mình, sang tổ khác phải GĐ duyệt. Số liệu lệch làm tôi không biết mình tự làm được hay phải chờ GĐ | Thống nhất một tổ trên cả hai màn. Đầu màn 9a ghi rõ: "Bạn làm được: bước ②, ③ · Bước ① do GĐ/Admin" và khi chọn người ngoài tổ thì báo "Cần GĐ duyệt" | Nên sửa |
| 3 | 9a Nghỉ việc / 1e Lệnh gửi | Lệnh "Cần duyệt lại" (do người đã nghỉ duyệt) hiện trong hàng Lệnh gửi của Tú với nút "Thử lại"; màn nghỉ việc chỉ ghi "3 lệnh Cần duyệt lại", không nói ai xử lý. Phạm vi "Tổ của tôi" của Lệnh gửi chỉ là một dòng chữ, chưa vẽ | Đặc tả (SZ-26) nói lệnh của người nghỉ không tự chạy. Nếu chỉ bấm "Thử lại" là gửi thì lệnh của người đã nghỉ vẫn đi ra. Sáng 10:00 tôi cần xem lệnh treo của cả tổ theo từng NVKD (MH-SZ-13) | Lệnh "Cần duyệt lại" dùng nút **"Xem và duyệt lại"** (mở nội dung, người duyệt mới là người bấm), không dùng "Thử lại". Ở bước ③ ghi rõ "3 lệnh chuyển cho {người giữ nick mới} duyệt lại". Vẽ Lệnh gửi phạm vi "Tổ của tôi" có cột NVKD và "Treo {n} phút" | Nên sửa |
| 4 | 1d Hộp thư giám sát | Dòng Minh ghi "Ngân trực thay từ 13:00", nhưng nút trên hội thoại của Minh vẫn là "Nhắc Minh" | Nhắc người đang nghỉ ốm thì không ai làm; sau 13:00 người phải trả lời là Ngân | Khi có trực thay đang hiệu lực, nút đổi thành "Nhắc Ngân (trực thay Minh)"; thông báo quá SLA cũng gửi cho người trực | Nên sửa |
| 5 | 9b Trực thay (form Tạo trực thay) | Ô "Từ – Đến" là một ô gõ tay; mục "Trực nhóm khách (tùy chọn, tối đa 3 dòng) · Nguyễn Văn Tú · Khu vực: Đống Đa · 41 khách" khó hiểu | Nghỉ phép 3 ngày thì tôi cần chọn nhanh, không gõ giờ. Tôi không biết "trực nhóm khách" là chia nick cho 2 người hay chỉ chia khách | Dùng chọn khoảng ngày có nút nhanh "Hôm nay · 3 ngày · Đến hết tuần", giờ mặc định theo giờ làm việc (8:00–17:30). Đổi tên mục thành "Chia bớt khách cho người trực khác (tùy chọn)" kèm một câu giải thích. Dưới form hiện "Minh đang có 9 hội thoại mở, 3 chưa trả lời sẽ hiện trong hộp thư của Ngân" | Gợi ý |
| 6 | 1d, 1e, 9, 9b | Số liệu mẫu giữa các màn không khớp: người trực của Minh là Ngân (1d, 9, 9b) nhưng màn 1e ghi Tú "trực thay Minh tới 30/09"; hạn trực thay 29/09 18:00 (9b) và 30/09 18:00 (1d); nick Tú mất kết nối từ 07:10 (1d, 8) và 08:40 (1e) | Khi duyệt bản vẽ, giám sát sẽ hỏi "rốt cuộc ai trực, đến bao giờ". Những chi tiết này chính là thứ tôi dùng để quyết định | Rà lại một bộ dữ liệu mẫu chung cho tổ HN1 (ai nghỉ, ai trực, đến bao giờ, nick nào đỏ từ mấy giờ) và dùng cho mọi màn | Gợi ý |
| 7 | 8 Kênh kết nối | Màn vẫn vẽ theo mắt Tú, lẫn cả trạng thái token OA/Fanpage và nút "Cấp lại" của Admin | Tôi chỉ cần nick của tổ mình; thấy nút "Cấp lại" token là thừa và dễ bấm nhầm | Thêm lọc mặc định "Tổ của tôi" khi người xem là GS; nút "Cấp lại", "Cấu hình" chỉ hiện với Admin/GĐ (tôi thấy chữ "Báo Admin") | Gợi ý |

**Tổng góp ý mới:** 7 — 0 Chặn · 4 Nên sửa · 3 Gợi ý.

**Chặn còn lại:** không có. Tất cả 5 góp ý Chặn của lượt 1 đã sửa tốt, lượt này không có góp ý mới nào ở mức Chặn.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-2/P-GS.md) | — |
