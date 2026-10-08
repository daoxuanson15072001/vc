# Xử lý góp ý vòng 1 — 03 Sale Zalo cá nhân

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA (Claude) xử lý 43 góp ý vòng 1 cho đặc tả 03 Sale Zalo cá nhân (P-KD 25, P-GS 18); đặc tả lên **v1.1** (29/09/2026).
- Kết quả chính: **30 đã sửa · 11 hỏi chủ dự án · 1 chuyển file khác · 1 không làm**.
- 12 góp ý Chặn: 9 đã sửa trong đặc tả; còn mở KD-1 (mobile, Q14), KD-6 (tin nhiều dòng, Q9); KD-4 sửa một phần, phần tự lấy trước chờ Q15.
- Không bỏ nguyên tắc nào: không gửi khi chưa duyệt, không gửi hàng loạt, không giữ mật khẩu / phiên, không giải mã.
- Quy tắc mới trong đặc tả: SZ-21 (định nghĩa "đã trả lời"), SZ-22 (nguồn gửi), SZ-23 (người không giữ nick xem không đánh dấu đã đọc), SZ-24 (thông báo lỗi gửi), SZ-25 / QT-SZ-10 (trả lời thay), SZ-26 / QT-SZ-11 (bàn giao nick).
- 14 câu hỏi cho chủ dự án (Q8, Q9, Q11–Q22), mỗi câu có phương án và đề xuất BA; 14 việc cho designer; việc chuyển sang file 00, 01, 02, 06, báo cáo và BA tổng.
- Người duyệt nên xem kỹ: Q11 (KPI có tính tin gửi từ điện thoại), Q14 (mobile ở MVP), Q18–Q19 (thu nick và giám sát rủi ro nick).

## Mục lục

- [Tổng hợp](#tổng-hợp)
- [Sổ góp ý](#sổ-góp-ý)
- [Câu hỏi cho chủ dự án](#câu-hỏi-cho-chủ-dự-án)
- [Việc cho designer](#việc-cho-designer)
- [Việc chuyển file khác](#việc-chuyển-file-khác)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

| | |
|---|---|
| **Đặc tả** | [../../03-sale-zalo-ca-nhan.md](../../dac-ta/03-sale-zalo-ca-nhan.md) v1.0 → **v1.1** (29/09/2026) |
| **Góp ý** | [03-P-KD.md](03-P-KD.md) (Minh, NVKD: 25 góp ý, 7 Chặn) · [03-P-GS.md](03-P-GS.md) (Hương, giám sát: 18 góp ý, 5 Chặn) |
| **Người xử lý** | BA (Claude), bước 3 của quy trình [README](../../README.md) |
| **Căn cứ đối chiếu** | vclinks-ba.md v0.4 (§2.2, §5.5, §7, §11.3, §11.7 ZR1–ZR10, §18.1–18.2, §19, §21) · CLAUDE.md §12 · chrome-driver.md · 00 (MH-UI-03, 07, 08, 11) · 01 (PQ-13, 16, 17, 27, 31–35, MH-PQ-04, 07) · 02 (DK-21, DK-30) |

## Tổng hợp

| Kết quả (chính) | P-KD | P-GS | Cộng |
|---|---|---|---|
| Đã sửa (nhiều mục kèm việc cho designer) | 16 | 14 | **30** |
| Hỏi chủ dự án | 8 | 3 | **11** |
| Chuyển file khác | 0 | 1 | **1** |
| Không làm | 1 | 0 | **1** |
| **Cộng** | 25 | 18 | **43** |

**Góp ý mức Chặn (12):** 9 đã sửa xong trong đặc tả (KD-2, KD-3, KD-5, KD-7, GS-1…GS-5; GS-4, GS-5 còn một phần chờ Q17, Q18). Còn mở, chờ chủ dự án: **KD-1** (mobile, Q14), **KD-6** (tin nhiều dòng, Q9); **KD-4** đã sửa một phần (nút lấy nội dung), phần "tự lấy trước" chờ Q15.

**Quyết định lọc:** không bỏ nguyên tắc nào. Không gửi khi chưa duyệt (mọi lệnh mới — lời chào khi kết bạn, gửi không trích dẫn, lệnh `Cần duyệt lại` — đều do người bấm). Không gửi hàng loạt (lấy nội dung hàng loạt là thao tác **đọc**, tuần tự, có nhịp, do người bấm theo ZR4). Không giữ mật khẩu / phiên (thu nick trên điện thoại làm ngoài hệ thống, VClinks chỉ ghi người xác nhận). Không giải mã.

## Sổ góp ý

### P-KD (Minh, NVKD)

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa hoặc lý do |
|---|---|---|---|---|
| KD-1 | Chặn | Không có gì về dùng VClinks trên điện thoại | Hỏi chủ dự án (Q14) · Đã sửa phần tạm | Có làm mobile ở MVP là đổi giai đoạn (BA §19: mobile web GĐ2). Đã thêm §2.6 "Sale trên điện thoại": trong lúc chờ dùng app Zalo, tin về VClinks ≤ 1 phút, tính đã trả lời, sao chép nội dung khi nick đỏ. UAT-SZ-72 chạy khi Q14 chốt có |
| KD-2 | Chặn | Tin trả lời từ app Zalo hiện ra sao, có tính "đã trả lời" | Đã sửa | SZ-21 (định nghĩa), SZ-22 (nguồn gửi), §2.6, §2.7, MH-SZ-03 #38c nhãn `Gửi ngoài VClinks · điện thoại`, SZ-US-12, UAT-SZ-50, 62. Phần KPI: Q11 |
| KD-3 | Chặn | Cần lọc "Chưa trả lời", không phải "Chưa đọc" | Đã sửa · Chuyển designer | MH-SZ-01 #5 (`Chưa trả lời` trước `Chưa đọc`, sắp chờ lâu nhất), #9l chip `chờ {n}`, §2 dòng 07:50, SZ-US-11, UAT-SZ-63 |
| KD-4 | Chặn | Sáng phải bấm từng khách "Đang chờ nội dung" | Đã sửa (một phần) · Hỏi chủ dự án (Q15) | Nút `Lấy nội dung {n} hội thoại` cho người giữ nick, có xác nhận "khách sẽ thấy Đã xem", tuần tự có nhịp (QT-SZ-01 bước 3a, MH-SZ-01 #11, D25, UAT-SZ-64). Đúng ZR4 vì người bấm. Tự lấy trước không cần bấm = đổi ZR4 → Q15 |
| KD-5 | Chặn | Panel không có ô tra giá/tồn | Đã sửa · Chuyển designer | MH-SZ-07 #2a tab `Tra hàng` + `Chèn vào tin`, luồng §2.1, KD-06 → tab Tra hàng, D30, UAT-SZ-68. Phạm vi dữ liệu phụ thuộc API VCsales (BA §21 câu 8) |
| KD-6 | Chặn | Nhiều dòng thành nhiều tin vụn | Hỏi chủ dự án (Q9) | Đổi giai đoạn E2 (SZ-US-08 GĐ2). Hiện đã **không** tách ngầm (ghi chú dưới ô soạn). Đề xuất BA: sửa E2 là điều kiện bỏ `onlyThreadIds` (Q10). Ghi chú ở MH-SZ-05, UAT-SZ-67 |
| KD-7 | Chặn | Gửi lỗi chỉ hiện bong bóng đỏ ở hội thoại đã rời | Đã sửa · Chuyển designer · Chuyển file 00 | SZ-24 (thông báo nổi không tự đóng + tiếng + thông báo trình duyệt + badge `Lệnh gửi` trên thanh điều hướng trái + ⚠ dòng), QT-SZ-09 bước 0, MH-SZ-13 "Mở từ", SZ-US-13, D26, UAT-SZ-65. Mục thanh điều hướng thuộc file 00 |
| KD-8 | Nên sửa | Không đặc tả thông báo tin mới (tiếng, desktop, tiêu đề tab) | Đã sửa | Dẫn 00 MH-UI-03 và R8 trong MH-SZ-01 "Thông báo tin mới"; thêm `Tắt thông báo VClinks` theo hội thoại (MH-SZ-02 #7, MH-SZ-07 #2); UAT-SZ-70 |
| KD-9 | Nên sửa | Tin về "vài giây đến 1 phút" là chậm; muốn ≤ 10 giây | Hỏi chủ dự án (Q13) | Con số chưa chốt, còn phụ thuộc nhịp đồng bộ extension. Đã ghi mục tiêu tạm ≤ 10 giây ❓ (QT-SZ-01 bước 5, luồng §2.1) và ca đo UAT-SZ-70 |
| KD-10 | Nên sửa | Nút "Xóa nháp trên Zalo rồi gửi" thay vì nhờ Admin | Hỏi chủ dự án (Q16) | Đổi quy tắc ZR6 (không ghi đè nháp). Đã ghi chờ Q16 ở bảng dịch lỗi QT-SZ-02; UAT-SZ-66 chạy khi chốt có |
| KD-11 | Nên sửa | `replyTarget` bắt nhờ Admin cuộn | Đã sửa | Bảng dịch lỗi QT-SZ-02: extension tự cuộn tìm; không thấy → `Gửi không trích dẫn` (lệnh mới, người bấm duyệt, dòng `Về tin: "…"`). MH-SZ-13 #4a, D33, UAT-SZ-73 |
| KD-12 | Nên sửa | Nick đỏ: câu báo không bảo trả lời trên điện thoại, dễ gửi trùng | Đã sửa · Chuyển designer | MH-SZ-05 trạng thái Nick đỏ (câu mới, `Sao chép nội dung`, hỏi xóa nháp khi thấy tin điện thoại giống nháp), §2.6 bước 6, D34, UAT-SZ-71. Nháp không bao giờ tự gửi |
| KD-13 | Nên sửa | Khách mới chưa có mã KH phải chờ Sale admin mới gửi được báo giá | Hỏi chủ dự án (Q20) | Đổi nghiệp vụ BR11/BR17 và phụ thuộc BA §21 câu 14. Giữ luồng "Gửi yêu cầu liên kết"; ghi chú ở MH-SZ-05i |
| KD-14 | Gợi ý | Gửi báo giá khách quen trong 2 cú bấm | Đã sửa | MH-SZ-05i #9: báo giá hợp lệ chọn sẵn + focus nút `Gửi báo giá`, Enter gửi |
| KD-15 | Nên sửa | Panel thiếu "lần mua gần nhất"; công nợ không cảnh báo quá hạn | Hỏi chủ dự án (Q21) | "3 đơn gần nhất" thuộc KD-08 (GĐ2) → đổi giai đoạn. Cảnh báo công nợ quá hạn đã ghi ❓ ở MH-SZ-07 #3 (phụ thuộc API VCsales trả hạn nợ); chuyển file 06 |
| KD-16 | Nên sửa | Đưa "Chuyển tiếp tới một hội thoại" lên MVP | Hỏi chủ dự án (Q21) | Đổi giai đoạn (E11 GĐ2–3). Một đích đúng BR14. Ghi chờ Q21 ở MH-SZ-04 #6 |
| KD-17 | Nên sửa | Không thấy ghi chú nội bộ / @giám sát | Đã sửa | MH-SZ-05 #0 và wireframe theo 00 MH-UI-08 (KD-13 MVP), MH-SZ-03 #38d, §6.1 thêm KD-13 |
| KD-18 | Nên sửa | Khách đòi hóa đơn: không có gì trước GĐ2 | Hỏi chủ dự án (Q22) · Chuyển file 06 | KD-17 là GĐ2; làm bản tạm là đổi giai đoạn. Nội dung phiếu yêu cầu thuộc file 06 (PQ-23) |
| KD-19 | Nên sửa | Tạo nhóm chỉ chọn được bạn bè | Đã sửa | QT-SZ-06 bước 2 (chữ rõ khi người chưa là bạn; thêm bằng SĐT ❓ khảo sát), MH-SZ-11 #4, D38 |
| KD-20 | Nên sửa | Ghi âm: bản chữ, tua nhanh, trạng thái đang chuyển | Đã sửa · Chuyển designer | MH-SZ-03 #24 (bản chữ dưới trình phát, 1x/1.5x/2x, `Đang chuyển chữ…`, lỗi + Thử lại), D36 |
| KD-21 | Nên sửa | Khách nhắn cả 2 nick thành 2 hội thoại rời | Đã sửa · Chuyển file 02 | MH-SZ-03 #4b chip `Khách này cũng nhắn …` theo DK-30, DK-43 của file 02; UAT-SZ-69. File 02 xác nhận chip hiện cả khi không "cùng một yêu cầu" |
| KD-22 | Gợi ý | Thả 👍 thay "đã nhận" | Không làm (tạm) | Giới hạn kỹ thuật: bảng cảm xúc của Zalo bỏ qua sự kiện giả lập, nút giữ ẩn (TC10). Thay bằng mẫu công ty `/nhan` (MH-SZ-04 #2). Mở lại khi driver bấm được bằng chuột thật |
| KD-23 | Gợi ý | Toast "Đã duyệt: … Tiện ích VClinks sẽ gửi trên Zalo Web" dài, rối | Đã sửa · Chuyển designer | Ghi chú "[Sửa v1.1] Toast sau khi duyệt" ở MH-SZ-05: `Đang gửi {nhãn}…`, xong thì im, lỗi theo SZ-24; D35 |
| KD-24 | Gợi ý | Kết bạn mất 5–6 bước | Đã sửa · Chuyển designer | QT-SZ-04 bước 3–4, MH-SZ-10 #6: một hộp Đồng ý + tên gợi nhớ + lời chào (nội dung hiện nguyên văn, người bấm duyệt; kết bạn lỗi thì không gửi chào); UAT-SZ-75 |
| KD-25 | Gợi ý | Album 10 ảnh: không lướt liền, không tải hết | Đã sửa | MH-SZ-03 #23, D36, UAT-SZ-74 |

**Câu hỏi của P-KD** — đã trả lời trong đặc tả §2.7 "Giải đáp nhanh" (1 đã xem từ điện thoại; 2 "Đã xem"; 3 nick dùng chung; 4 bỏ giai đoạn thử; 5 quay lại sau nghỉ phép; 6 giám sát xem tin; 7 mẫu cá nhân; 8 giới hạn 20 lời mời; 9 báo giá dạng ảnh — kèm bước kiểm trên điện thoại ở UAT-SZ-27). Câu 1 phần KPI → Q11; câu 4 → Q10.

**Kịch bản UAT của P-KD** → UAT-SZ-62…74 (ca "mobile" = 72, "xóa nháp" = 66 chạy có điều kiện). Ca "10 hội thoại qua đêm ≤ 1 phút" sửa thành đo qua nút `Lấy nội dung` (UAT-SZ-64). Thêm UAT-SZ-75 cho hộp kết bạn mới.

### P-GS (Hương, giám sát)

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa hoặc lý do |
|---|---|---|---|---|
| GS-1 | Chặn | Không có cách nhìn "tổ đang có vấn đề gì": thiếu lọc Chưa trả lời / Quá SLA / Người phụ trách | Đã sửa · Chuyển designer | MH-SZ-01 #4 (`Quá SLA`), #4a `Người phụ trách`, #4b dải 4 số, #4c `Chưa trả lời: Minh 3 · …`, #9m tên người phụ trách; §2.5; SZ-US-14; D27; UAT-SZ-49 |
| GS-2 | Chặn | Chưa định nghĩa "đã trả lời"; "Chưa đọc" không đo được khách chờ | Đã sửa · Hỏi chủ dự án (Q11, Q12) | **SZ-21** (tin nick mọi nguồn, lệnh chưa gửi không tính, thời gian chờ từ tin đầu chờ, đọc không ảnh hưởng, cảm xúc không tính, `Không cần trả lời`, giờ làm việc, DK-30). Sticker/"ok" và nhóm: Q12; KPI: Q11 |
| GS-3 | Chặn | Giám sát mở hội thoại làm khách thấy "Đã xem", NVKD mất badge | Đã sửa · Chuyển designer | **SZ-23**, SZ-15 sửa, QT-SZ-01 bước 3, MH-SZ-03 #9a (nút lấy nội dung có xác nhận, chỉ GS/GĐ), MH-SZ-02 xác nhận khi đánh dấu đã đọc; SZ-US-15; D24; UAT-SZ-51 |
| GS-4 | Chặn | Trả lời thay / trực thay chưa có trên màn hình 03; `{ten_nv}` thành tên GS dù gửi từ nick NVKD | Đã sửa · Chuyển designer · Hỏi chủ dự án (Q17) | **QT-SZ-10**, **SZ-25**, MH-SZ-05 #0b dải vàng/xanh, #14 luôn xác nhận, MH-SZ-03 #38a nhãn, ghi chú tự động, thông báo; biến `{ten_nguoi_giu_nick}`, mẫu `/traloithay` (MH-SZ-05e); §2.4 hướng dẫn khi nào dùng cách nào; UAT-SZ-52, 53, 54. Xưng tên ai: Q17 |
| GS-5 | Chặn | Nghỉ việc: nick còn trên điện thoại; lệnh chờ, nhóm, lời mời chưa xử lý | Đã sửa · Chuyển file 01 · Hỏi chủ dự án (Q18) | §2.4 viết lại, **QT-SZ-11**, **SZ-26** (lệnh → `Cần duyệt lại`; checklist thu nick trên điện thoại — ngoài hệ thống, VClinks không giữ mật khẩu; khóa `Hoàn tất` — khớp PQ-17; liệt kê lời mời, nhóm làm trưởng; PQ-34), MH-SZ-03 #38b, MH-SZ-13 #3a; UAT-SZ-60. Checklist nằm trong MH-PQ-04 ③ → file 01. Máy công ty hay riêng: Q18 |
| GS-6 | Nên sửa | 03 ("khách mình + nhóm") mâu thuẫn 01 PQ-13 ("người giữ nick thấy mọi hội thoại trên nick") | Đã sửa | SZ-18 viết lại theo PQ-13, MH-SZ-01 Quyền, #9n `Khách của {owner}`, §2.7; Q7 đóng; UAT-SZ-01 sửa, UAT-SZ-61 |
| GS-7 | Nên sửa | GS không thấy nick của tổ; nick đỏ chỉ báo Admin; cần người giữ nick quét QR | Đã sửa · Chuyển designer | MH-SZ-12a #7 `Nick của tổ`, #8; QT-SZ-01 bước 4 (báo người giữ nick + GS + Admin, câu "quét mã QR"); bỏ "(dùng chung)" ở wireframe; SZ-US-18; D31; UAT-SZ-55. Ngưỡng 15 phút: Q13 |
| GS-8 | Nên sửa | Lệnh gửi của tổ: không lọc NVKD, không biết treo bao lâu, không ai nhắc | Đã sửa | MH-SZ-13 #1a `NVKD`, #4 `Treo {n} phút`, sắp treo lâu nhất; QT-SZ-09 thông báo GS; UAT-SZ-56. Ngưỡng 30 phút: Q13 |
| GS-9 | Nên sửa | Mẫu câu "Nhóm" không có luồng duyệt | Đã sửa · Chuyển designer | MH-SZ-06: "Nhóm" → "Tổ", #13 `Đề xuất cho tổ`, #14 tab `Chờ tôi duyệt` (duyệt nhiều, từ chối có lý do, PQ-27), mẫu cá nhân GS xem chỉ đọc; Q5 đóng; D32; UAT-SZ-57 |
| GS-10 | Nên sửa | Chống NVKD kéo khách sang nick riêng (STK, danh thiếp, SĐT lạ) | Hỏi chủ dự án (Q19) | Tính năng giám sát mới, ảnh hưởng quyền riêng tư nhân viên và ai xem (chính P-GS hỏi lại ở câu 7). UAT-SZ-58 chạy khi chốt có |
| GS-11 | Nên sửa | Cảnh báo nick giảm bạn bè / nhóm bất thường | Hỏi chủ dự án (Q19, Q8) | Cùng nhóm câu hỏi giám sát; ngưỡng chưa có. Quyền Chặn/Hủy kết bạn: Q8 (đề xuất chỉ GS trở lên). UAT-SZ-59 có điều kiện |
| GS-12 | Nên sửa | "Đang được … trả lời" không biết NVKD đang trả lời trên điện thoại | Đã sửa | MH-SZ-03 #4c `Tin gần nhất của nick: {HH:mm} · từ điện thoại`; QT-SZ-10 bước 2: "đang hoạt động" tính cả tin từ điện thoại trong 5 phút ❓ (Q13); UAT-SZ-53 |
| GS-13 | Nên sửa | Nhóm chỉ có một nick công ty; nhóm tạo trên điện thoại thiếu mục đích/khách | Đã sửa · Chuyển designer | QT-SZ-06 bước 2a, MH-SZ-11 #4a (gợi ý thêm nick GS/nick tổ, phó nhóm ❓), MH-SZ-09 #10 (lọc `Chưa gắn khách`, `Chỉ 1 nick công ty`, cột `Nick trưởng nhóm`, sửa mục đích trên dòng), QT-SZ-11 liệt kê nhóm làm trưởng; D37 (GĐ2 cùng D12) |
| GS-14 | Nên sửa | Lời mời kết bạn: GS không xem được nick tổ, không ai nhắc | Đã sửa | MH-SZ-10 #1 (`Tất cả nick của tổ` cho GS xem; trực thay xử lý), #1a chip chờ + nhắc người giữ nick / GS; ngưỡng Q13 |
| GS-15 | Nên sửa | 48 ca UAT không có ca nào của giám sát | Đã sửa | §7.3 "Giám sát": UAT-SZ-49…61 (= GS01…GS13; 58, 59 có điều kiện Q19); §7.1 ghi cần 2 tài khoản và điện thoại test |
| GS-16 | Gợi ý | NVKD có nút "Đăng ký vắng", GS bấm Đồng ý là có trực thay | Chuyển file 01 | Trực thay do MH-PQ-07 quản lý; thêm yêu cầu từ NVKD vào luồng quyền tạm thời của file 01 |
| GS-17 | Gợi ý | Báo trước cho NVKD về việc lưu/xem tin trên nick công ty; người giữ nick xem ai đã trả lời thay | Hỏi chủ dự án (Q19) · Đã sửa phần xem lại | Văn bản xác nhận khi nhận nick là chính sách nhân sự → Q19. Đã sửa: §2.7 nói rõ ai xem được gì; MH-SZ-13 #1 `Người khác gửi trên nick tôi`; QT-SZ-10 bước 5 |
| GS-18 | Gợi ý | Lưu nguồn gửi để đo FRT đúng; đầu MH-SZ-01 chỉ 4 số | Đã sửa · Chuyển file khác (báo cáo) | **SZ-22** `sendSource`, `actualSender`; MH-SZ-01 #4b đúng 4 số `Chưa trả lời · Quá SLA · Lệnh lỗi · Nick đỏ`; D23. Màn hình báo cáo F10.2 chưa có file |

**Câu hỏi của P-GS**

| # | Trả lời / nơi xử lý |
|---|---|
| 1 Trả lời thay hay trực thay, nút ở đâu | §2.4 bảng + hướng dẫn; dải vàng có link `Tạo trực thay…` (MH-SZ-05 #0b) |
| 2 Xưng tên mình hay tên NVKD | Q17 (đề xuất: tên người gửi thật + mẫu `/traloithay`) |
| 3 Điện thoại công ty hay riêng, ai đăng xuất | Q18; quy trình trong QT-SZ-11 |
| 4 Nick dùng chung, ai là người giữ nick | Không có nick dùng chung: PQ-17, SZ-18, MH-SZ-12a |
| 5 Tin ngoài giờ, ai cài giờ làm việc | SZ-21 (h), §2.7: vẫn ở "Chưa trả lời", SLA tính từ đầu giờ làm việc kế tiếp; GĐ bán hàng cấu hình (BA §4, F4.3) |
| 6 Tin từ điện thoại tính đã trả lời trong SLA, hiệu suất | SLA: có (SZ-21). Hiệu suất: Q11 |
| 7 Cảnh báo kéo khách do ai xem | Q19 |
| 8 Màn hình "tổ hôm nay", hiệu suất ở file nào | "Tổ hôm nay" = MH-SZ-01 phạm vi Tất cả + #4b/#4c (file này). Hiệu suất GS-06: chưa có file → "Việc chuyển file khác" |

## Câu hỏi cho chủ dự án

Mã Q trùng với §10 của đặc tả.

**Q8. NVKD có được Chặn / Hủy kết bạn trên nick công ty không?**
- A. NVKD được, có xác nhận và nhật ký.
- B. Chỉ GS trở lên; NVKD cần thì nhờ GS.
- C. NVKD chỉ chặn người lạ chưa gắn khách (spam); hủy kết bạn / chặn khách đã gắn chỉ GS trở lên.
- **Đề xuất BA: B** (P-GS đồng ý; giảm rủi ro người sắp nghỉ xóa khách). Nếu spam nhiều thì C.

**Q9. Tin nhiều dòng (E2) — P-KD xếp mức Chặn.**
- A. Giữ "mỗi dòng một tin" (có ghi chú rõ) tới GĐ2.
- B. Sửa E2 (một tin nhiều dòng) và coi là điều kiện trước khi bỏ `onlyThreadIds` (Q10).
- C. Trong lúc chưa sửa: chặn Shift+Enter trên kênh Zalo (chỉ một dòng), báo rõ.
- **Đề xuất BA: B**, dùng C nếu E2 không kịp trước ngày mở gửi khách thật.

**Q11. Tin nick gửi từ điện thoại có tính vào chỉ số hiệu suất (FRT, % quá SLA — F10.2) không?** File 00 Q12 đang đề xuất "KPI chỉ tính tin gửi qua VClinks".
- A. Tính mọi nguồn cho cả lọc, SLA và KPI; thêm chỉ số riêng "% tin trả lời qua VClinks" để theo dõi việc chuyển sang VClinks.
- B. Lọc "Chưa trả lời" và SLA tính mọi nguồn; KPI hiệu suất chỉ tính tin qua VClinks.
- C. Chỉ tính tin qua VClinks cho cả SLA (BA không khuyên: báo quá SLA sai, giám sát nhắc sai người).
- **Đề xuất BA: A.** Cả NVKD và GS cùng đề nghị; B làm hai con số FRT khác nhau cho cùng một hội thoại. File 00 Q12 cần sửa theo.

**Q12. Tin khách chỉ có sticker / "ok" / "cảm ơn", và hội thoại nhóm, có tính "Chưa trả lời" / SLA không?**
- A. Mọi tin khách đều tính chờ; NVKD/GS bấm `Không cần trả lời` (đã có trong v1.1).
- B. Tự bỏ qua khi tin cuối của khách (sau tin của nick) chỉ là sticker hoặc nằm trong danh sách câu ngắn cấu hình được ("ok", "vâng", "cảm ơn", "👍").
- Nhóm: (N1) không tính SLA cho nhóm; (N2) chỉ tính nhóm đã gắn khách, tin của nick công ty khác hoặc nhân viên nội bộ trong nhóm tính là đã trả lời; (N3) tính mọi nhóm.
- **Đề xuất BA: A + B** (B với danh sách do GĐ cấu hình) và **N2**.

**Q13. Chốt các ngưỡng mới (đã ghi ❓ trong đặc tả).**

| Ngưỡng | Đề xuất BA | Chỗ dùng |
|---|---|---|
| Tin khách về VClinks khi nick xanh | ≤ 10 giây (p90); file 00 đang ghi ≤ 5 giây → cần thống nhất, đo thực tế trước | QT-SZ-01 b5, UAT-SZ-70 |
| Nick đỏ tự báo người giữ nick + GS + Admin | > 15 phút trong giờ làm | QT-SZ-01 b4, MH-SZ-12a #8 |
| Lệnh lỗi / quá hạn chưa xử lý báo GS | > 30 phút trong giờ làm | QT-SZ-09 |
| Lời mời kết bạn chưa xử lý | > 4 giờ làm việc báo người giữ nick; > 1 ngày làm việc báo GS | MH-SZ-10 #1a |
| Người giữ nick "đang hoạt động" (hộp xác nhận trả lời thay) | Trực tuyến VClinks hoặc nick gửi tin trong 5 phút | QT-SZ-10 b2 |
| Lấy nội dung hàng loạt | Nhịp 3 giây, tối đa 20 hội thoại / lần | QT-SZ-01 b3a |

- A. Chấp nhận như bảng. B. Chỉnh từng con số. **Đề xuất BA: A**, xem lại sau 2 tuần chạy thật.

**Q14. Giao diện VClinks trên điện thoại cho NVKD — MVP hay GĐ2?** (P-KD mức Chặn; BA §19 xếp mobile web GĐ2; 00 MH-UI-11 đã đặc tả.)
- A. Giữ GĐ2. Trong lúc chờ, NVKD dùng app Zalo; tin về VClinks và tính đã trả lời (§2.6 đã quy định).
- B. MVP phần tối thiểu của MH-UI-11 cho NVKD: danh sách "Chưa trả lời", đọc hội thoại, trả lời chữ, mẫu câu `/`, số tài khoản, `Lệnh gửi` và thông báo lỗi. Phần còn lại GĐ2.
- C. MVP đầy đủ MH-UI-11.
- **Đề xuất BA: B** nếu còn chỗ trong MVP (trang Hội thoại đã có bố cục một cột; tránh cảnh sáng làm VClinks, chiều làm Zalo). Nếu MVP chật thì A: đặc tả đã bảo đảm không đếm sai tin trả lời từ điện thoại.

**Q15. Tự lấy nội dung trước (không cần bấm) cho "Của tôi"?** (liên quan ZR4)
- A. Không; người giữ nick bấm `Lấy nội dung {n} hội thoại` (đã có trong v1.1).
- B. Có, theo công tắc cá nhân của người giữ nick (mặc định tắt), khi nick xanh và trong giờ làm việc.
- C. Lấy khi người giữ nick rê chuột trên dòng ≥ 1 giây.
- **Đề xuất BA: A** cho MVP (khách thấy "Đã xem" chỉ khi nhân viên chủ động); xem lại B sau khi đo thời gian bấm nút thực tế. C dễ làm lộ "Đã xem" ngoài ý muốn.

**Q16. Cho sale bấm "Xóa nháp trên Zalo rồi gửi"?** (đổi ZR6)
- A. Giữ ZR6: sale nhờ Admin xóa nháp trên driver.
- B. Nút trong tooltip lỗi và Hàng lệnh gửi: hộp xác nhận hiện **nguyên văn nháp sẽ bị xóa**; bấm = duyệt xóa + gửi; nhật ký lưu nội dung nháp đã xóa.
- C. Extension tự xóa nháp cũ hơn N phút khi không ai thao tác.
- **Đề xuất BA: B** (vẫn do người bấm, có dấu vết; theo ZR8 không ai gõ tay trên driver nên nháp thường là dư thừa). Không chọn C (tự động xóa nội dung).

**Q17. Trả lời thay / trực thay: xưng tên ai? Công ty có muốn khách biết người khác đang trả lời?**
- A. Xưng tên người gửi thật: `{ten_nv}` = người gửi thật, mẫu tổ `/traloithay` giới thiệu "em là {ten_nv}, trưởng nhóm của {ten_nguoi_giu_nick}".
- B. Xưng tên người giữ nick (khách không biết đổi người).
- C. Không xưng tên trong mẫu khi trả lời thay.
- **Đề xuất BA: A** (không mạo danh; đúng BA F3.2; khớp nhãn "trả lời thay" trong VClinks). Đặc tả v1.1 đang viết theo A.

**Q18. Điện thoại giữ nick là máy công ty hay máy riêng? Ai thu nick khi nghỉ việc?**
- A. Máy và SIM công ty; thu lại khi nghỉ việc.
- B. Máy riêng, SIM/số điện thoại đăng ký Zalo là của công ty; khi nghỉ việc công ty đổi mật khẩu Zalo và đăng xuất thiết bị cũ ngay tại buổi bàn giao.
- C. Máy riêng, số riêng (không đạt BR08, BA không khuyên).
- Người chịu trách nhiệm: GS của tổ làm cùng HC-NS; Admin VClinks xác nhận trên checklist (PQ-17).
- **Đề xuất BA: A**, tối thiểu B. VClinks chỉ ghi người xác nhận và ghi chú; không giữ mật khẩu.

**Q19. Có làm các cảnh báo giám sát rủi ro nick và bản xác nhận của NVKD không? Ai xem?**
- A. Không làm; dựa vào quy trình bàn giao (QT-SZ-11) và việc GS được xem hội thoại tổ.
- B. Cảnh báo mềm, không chặn gửi, không đọc hộ toàn bộ tin: (1) nick giảm bạn bè/nhóm vượt ngưỡng trong 24 giờ; (2) tin nick gửi (mọi nguồn) có số tài khoản không thuộc mẫu STK công ty; (3) danh thiếp không phải khách hay nick công ty. Người xem: GS + GĐ. Kèm bản "nick công ty chỉ dùng việc công", NVKD xác nhận khi nhận nick (lưu như BR15).
- C. Như B nhưng chỉ kiểm soát nội bộ / GĐ xem, GS không thấy (P-GS không muốn tổ nghĩ mình soi tin).
- **Đề xuất BA: B, làm ở GĐ2**; bản xác nhận khi nhận nick làm ngay ở MVP (chi phí thấp, giảm va chạm P-KD lo "bị soi").

**Q20. Khách mới chưa có mã KH: gửi báo giá thế nào?** (BA §21 câu 14)
- A. Giữ bắt buộc liên kết mã KH trước (Sale admin), như v1.0.
- B. Cho gửi theo **số báo giá** VCsales: VClinks tra báo giá theo số, chỉ khi người lập báo giá = người gửi và báo giá đã duyệt, còn hiệu lực; liên kết mã KH làm sau, có nhắc Sale admin.
- C. VCsales tạo mã KH tạm khi tạo báo giá cho khách mới.
- **Đề xuất BA: B** nếu API VCsales tra được theo số báo giá; nếu không thì C (cần VCsales hỗ trợ).

**Q21. Đưa lên MVP: "Chuyển tiếp tới một hội thoại" (E11) và khối "3 đơn gần nhất" + cảnh báo công nợ quá hạn (KD-08)?**
- A. Giữ lộ trình: chuyển tiếp GĐ2–3, KD-08 GĐ2.
- B. Chuyển tiếp **một đích** lên MVP (vẫn đúng BR14); KD-08 giữ GĐ2, riêng cảnh báo công nợ quá hạn lên MVP nếu API trả hạn nợ.
- C. Cả hai lên MVP.
- **Đề xuất BA: B.** Chuyển tiếp ảnh sang nhóm kho/kỹ thuật là việc hằng ngày; "3 đơn gần nhất" phụ thuộc API đơn hàng VCsales (BA §21 câu 8).

**Q22. Trước GĐ2 có làm tạm "Gửi cho kế toán" từ một tin (khách đòi hóa đơn)?**
- A. Chờ GĐ2 (F9.11, KD-17).
- B. MVP bản tối giản: chuột phải tin → `Gửi cho kế toán` → phiếu yêu cầu mang tối đa 10 tin nguồn (PQ-23), kế toán xử lý tay trên VCinvoice.
- C. Dùng nhắc việc giao cho kế toán kèm link tin (kế toán không có `conv.view` nên không mở được tin — không khả thi theo 01).
- **Đề xuất BA: B**, đặc tả trong file 06.

## Việc cho designer

Vẽ theo đặc tả v1.1; mỗi mục ghi chỗ đặc tả.

1. **MH-SZ-01, góc nhìn GS:** phạm vi có `Quá SLA {n}`; Select `Người phụ trách`; dải 4 số `Chưa trả lời · Quá SLA · Lệnh lỗi · Nick đỏ` (bấm được, số 0 xám); dòng `Chưa trả lời: Minh 3 · Tú 4`; dòng hội thoại có chip `chờ {n}` (xám/cam/đỏ) và tên người phụ trách (#4–#4c, #9l, #9m, #9n). Mục tiêu ≤ 2 lần bấm.
2. **MH-SZ-01, NVKD:** Segmented `Tất cả / Chưa trả lời / Chưa đọc / Đã ghim`; dải `{n} hội thoại đang chờ nội dung` + `Lấy nội dung`, trạng thái tiến độ + Dừng (#5, #11); hộp xác nhận QT-SZ-01 3a.
3. **Thông báo lỗi gửi (SZ-24):** thông báo nổi góc phải trên, không tự đóng, xếp chồng 3, nút `Mở hội thoại` / `Lệnh gửi`; mục `Lệnh gửi` có badge trên thanh điều hướng trái (phối hợp file 00).
4. **MH-SZ-03:** dải #9a cho người không giữ nick + hộp xác nhận lấy nội dung; chip #4b `Khách này cũng nhắn …`; dòng #4c `Tin gần nhất của nick …`; nhãn nguồn #38c (`Gửi ngoài VClinks · điện thoại`), #38a trả lời thay / trực thay, #38b `Cần duyệt lại`; khối ghi chú nội bộ #38d; ghi âm #24 (bản chữ, tốc độ, đang chuyển chữ); xem ảnh lướt album + `Tải tất cả` #23.
5. **MH-SZ-05:** Segmented `Trả lời khách | Ghi chú nội bộ` (#0); dải vàng trả lời thay / dải xanh trực thay (#0b); hộp xác nhận trả lời thay hiện câu đã thay biến + dòng "đang hoạt động"; trạng thái Nick đỏ có `Sao chép nội dung` và hộp "Xóa nháp đã gửi từ điện thoại?"; toast rút gọn `Đang gửi …`.
6. **MH-SZ-07:** tab `Tra hàng` đầu tiên (ô tìm, chip mã OE gợi ý, dòng kết quả giá theo khách + tồn theo kho + thời điểm lấy, `Chèn vào tin`); tab Khách: công nợ quá hạn tô đỏ.
7. **MH-SZ-06:** phạm vi `Tổ`; tag `Chờ duyệt`; nút `Đề xuất cho tổ`; tab `Chờ tôi duyệt` có chọn nhiều, Duyệt / Từ chối (lý do).
8. **MH-SZ-10:** hộp Đồng ý kết bạn một bước (tên gợi nhớ + lời chào có nội dung đã thay biến); chip `Chờ {n} giờ`; lựa chọn `Tất cả nick của tổ` cho GS.
9. **MH-SZ-11 / MH-SZ-09 tab Nhóm (GĐ2):** checkbox gợi ý thêm nick GS/nick tổ; câu người chưa là bạn; lọc `Chưa gắn khách`, `Chỉ 1 nick công ty`, cột `Nick trưởng nhóm`.
10. **MH-SZ-12a:** phần `Nick của tổ` (người giữ nick, số khách chờ, câu quét QR, `Báo {người giữ nick}`); bỏ "(dùng chung)", hiện `(trực thay … tới …)`.
11. **MH-SZ-13:** phạm vi `Người khác gửi trên nick tôi`; Select `NVKD`; `Treo {n} phút`; trạng thái `Cần duyệt lại`; nút `Gửi không trích dẫn`.
12. **MH-SZ-02:** mục `Không cần trả lời`, `Tắt/Bật thông báo VClinks`; hộp xác nhận đánh dấu đã đọc cho người không giữ nick.
13. **Checklist bàn giao nick** trong MH-PQ-04 bước ③ (vẽ cùng designer file 01; nội dung ở QT-SZ-11).
14. **Mobile** (chỉ khi Q14 chọn B hoặc C): danh sách `Chưa trả lời`, khung chat, ô soạn với mẫu câu và STK, `Lệnh gửi`, thông báo lỗi — theo 00 MH-UI-11.

## Việc chuyển file khác

| File | Việc | Từ góp ý |
|---|---|---|
| **00** Giao diện chung | (1) Thêm mục **`Lệnh gửi`** có badge đỏ trên thanh điều hướng trái (thay cho mục trong menu avatar). (2) Loại thông báo "Gửi lỗi": thông báo nổi không tự đóng, âm riêng, không tắt được; thêm người giữ nick làm người nhận khi lệnh trả lời thay/trực thay lỗi. (3) Nhãn bong bóng `Gửi ngoài VClinks · điện thoại` (tách theo `syncFromMobile`). (4) Sửa Q12 của 00 theo Q11 (định nghĩa SZ-21). (5) Đưa "Chưa trả lời" từ popover `Lọc` lên Segmented cạnh "Chưa đọc", dẫn định nghĩa SZ-21 cho mọi kênh. (6) `Tắt thông báo VClinks` theo hội thoại. (7) Chuẩn toast sau duyệt `Đang gửi {nhãn}…`. (8) Thống nhất mục tiêu thời gian tin về (≤ 5 giây ở 00 và ≤ 10 giây ở 03, Q13). | KD-7, KD-8, KD-23, KD-2, KD-3, GS-18 |
| **01** Phân quyền | (1) MH-PQ-04 bước ③: checklist "Đã thu nick trên điện thoại cũ" (bắt buộc, có ghi chú), "Đã quét lại QR", danh sách lời mời / nhóm làm trưởng / hội thoại chưa trả lời; khóa `Hoàn tất bàn giao` tới khi tick (khớp PQ-17). (2) Quy tắc PQ mới: khi khóa nghỉ việc, lệnh outbox chưa gửi của người đó chuyển `Cần duyệt lại` (SZ-26). (3) Nhật ký PQ-38 thêm `conversation.fetch_on_behalf`, `channel_access.handover`. (4) Ghi chú ma trận `conv.label`: người không giữ nick đánh dấu đã đọc phải xác nhận (SZ-23). (5) MH-PQ-07: NVKD gửi "Đăng ký vắng" (từ – đến, đề xuất người trực), GS bấm Đồng ý = tạo trực thay. (6) GS xem (chỉ đọc) mẫu câu cá nhân của tổ. (7) Quyền Chặn/Hủy kết bạn theo Q8. | GS-5, GS-3, GS-16, GS-9, GS-11 |
| **02** Khách đa kênh | Chip `Khách này cũng nhắn {kênh·nick khác} ({n} tin chưa trả lời)` hiện cả khi không thuộc "Cùng một yêu cầu" (DK-30), trong 24 giờ; khối "3 đơn gần nhất" của 360 nếu Q21 chọn C. | KD-21, KD-15 |
| **06** Hóa đơn, công nợ (sẽ viết) | Luồng `Gửi cho kế toán` từ một tin (phiếu yêu cầu + tin nguồn, PQ-23) nếu Q22 chọn B; cảnh báo công nợ quá hạn trong panel khung chat (dữ liệu hạn nợ từ VCsales). | KD-18, KD-15 |
| **Báo cáo** (chưa có file) | Hiệu suất NVKD GS-06 / F10.2 dùng SZ-21 (FRT, quá SLA) và SZ-22 (`sendSource`); đề xuất mở file `07-bao-cao.md` hoặc giao vào 00/02. | GS-18, câu hỏi 8 của P-GS |
| **BA tổng** (vclinks-ba.md) | L11: định nghĩa "đã trả lời" vào F4.3 / BR mới. L12: làm rõ ZR4 (chỉ người giữ nick / trực thay làm mở hội thoại trên Zalo Web). L13: bổ sung F11.4 (thu nick trên điện thoại, lệnh chờ `Cần duyệt lại`). | GS-2, GS-3, GS-5 |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/03-xu-ly.md) | — |
