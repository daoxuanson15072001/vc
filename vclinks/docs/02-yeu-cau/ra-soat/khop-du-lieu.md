# Khớp 7 đặc tả với bộ dữ liệu kiểm thử chung (TD)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Khớp 7 đặc tả 00–06 (và sau đó 07) với bộ dữ liệu kiểm thử chung TD, QA/BA thực hiện ngày 29/09/2026.
- Kết quả: 767/767 ca UAT đã gắn cột Dữ liệu (TD); 67 ca chờ TT-02; đặc tả 00–05 lên v1.4, 06 lên v1.3.
- Mục 2 ghi phần bổ sung vào bộ chung (TD v1.1) và cách xử lý mã trùng giữa các file.
- Mục 3 nêu 15 xung đột C-01…C-15; mục 4 ghi đã xử lý gần hết (TD lên v1.2), chỉ còn C-13 kiểm khi chạy.
- Mục 5 khớp thiết kế lô D1 (TD lên v1.3); mục 6 xử lý sau vòng 1 của 07 và QA xác nhận D1 (TD v1.3.1, v1.4).
- Không còn việc mở của 07 với TD; việc `personas.md` (P-BGD bỏ tên thật) vẫn ngoài phạm vi.

## Mục lục

- [1. Tổng hợp](#1-tổng-hợp)
- [2. Bộ chung đã bổ sung (du-lieu-kiem-thu.md v1.1, đánh dấu [v1.1])](#2-bộ-chung-đã-bổ-sung-du-lieu-kiem-thumd-v11-đánh-dấu-v11)
- [3. Xung đột còn lại (cần chốt)](#3-xung-đột-còn-lại-cần-chốt)
- [4. Kết quả xử lý xung đột (29/09/2026, lượt "dọn dữ liệu + trỏ 07")](#4-kết-quả-xử-lý-xung-đột-29092026-lượt-dọn-dữ-liệu--trỏ-07)
- [5. Khớp thiết kế lô D1 (29/09/2026, TD lên v1.3)](#5-khớp-thiết-kế-lô-d1-29092026-td-lên-v13)
- [6. Sau vòng 1 của 07 và QA xác nhận D1 (29/09/2026)](#6-sau-vòng-1-của-07-và-qa-xác-nhận-d1-29092026)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> 29/09/2026 · QA/BA · Căn cứ: [../du-lieu-kiem-thu.md](../../05-kiem-thu/du-lieu-kiem-thu.md) §8, §9 (đã nâng lên v1.1).
> Kết quả: 00–05 lên **v1.4**, 06 lên **v1.3**. Mọi ca UAT có cột **Dữ liệu (TD)**. Bảng dữ liệu riêng của từng file đã thay bằng dòng trỏ về bộ chung, kèm bảng đối chiếu mã cũ → TD (giữ một phiên bản) và mục "Dữ liệu đặc thù của file này". Nghiệp vụ không đổi, trừ các chỉnh mà §9 yêu cầu.

## 1. Tổng hợp

| File | Số ca UAT đã gắn TD | Tên / mã đã đổi (chính) | Ca chờ TT-02 | Ghi chú |
|---|---|---|---|---|
| 00 giao diện chung | **131 / 131** (cột "Dữ liệu" → "Dữ liệu (TD)", mã TD đầu ô) | DL-01…15 → TD (bảng đối chiếu ở §1.7); An → Minh, Bình → Hương, Cường → Thắng, Dung → Lan, Hằng → Hà, Vũ Minh Khoa → Tùng, Ngô Thu Trang → Ngọc; `0912 345 678` → `0900 000 101`, `0987 654 321` → `0900 000 960`; KH-00123 → KH-TEST-0101; BG-2026-00123 → BG-2026-0915; công nợ 12.500.000 → 12.000.000 đ; "Garage Khánh Linh" → "Garage Hưng Thịnh"; lead "Anh Hùng" → chị Mai / Khách mới A | 60, 93, 101, 116, 119, 122; nhánh 1-1 của 19, 20, 21 (**9**) | UAT-UI-65 kỳ vọng → TD-DH3 `DH-2026-0480` "Đã xác nhận"; UAT-UI-12 dùng TD-U-OUT; UAT-UI-39 lấy id hội thoại TD-K12 từ Hải |
| 01 phân quyền | **115 / 115** (UAT-PQ-43 tách 43a / 43b) | §7.1 U-/K-/H-/Z- → TD; **nick Z1/Z2/Z3/Z4/Z5/Z9 → TD-NK01/02/06/04/05/08**; DEV1/5 → TD-TB1/5; K1…K11 → TD-K01, K16, K09, K02, K20, K13, K14, K18a…c, K19; H1/H2/H6/H8/H9 → TD-H01/H20/H30/H22/H12; T1 → TD-TK0131; U-CT Hải → Đạt, Giang → Thắng, Trần Văn Hùng → Hương, Lan (GS) → Đức, Nguyễn An → Minh, Lê Bình → Linh, Trần Cường → Hải, Đỗ Khoa → Toàn, Dũng VCe → Trang, Phạm Hà → Lan, Hoa → Thu, Vũ Sơn → Ngọc, Nga → Hạnh, Thảo → Hà, Tú (TT) → Dũng; VCe → VCedu | 18, 34, 58, 77, 78, 112 (**6**) | UAT-PQ-76 = TD-K14 + TD-NK06; 40, 43, 95 dùng Toàn; ca NĐ 13 dùng TD-K23 (không xóa TD-K13); ca hai division dùng TD-K08 |
| 02 khách đa kênh | **85 / 85** (84 cũ + ca mới UAT-DK-83 cho TD-KB11) | "Garage Tuấn Phát" → "Garage Minh Phát" (55 chỗ); Quang → Hương, Dũng → Đức, Hòa → Thắng; kịch bản H: VCsoft / OA VCgarage / `GR-TEST-0701` → VCedu / TD-OA2 / `HV-TEST-0702`; `BH-TEST-001` → TD-TK0145; `BG-TEST-015` → `BG-2026-0915`; `@example.com` → `@example.vn`; `sales@` → `sales.uat@`; QC-TEST-01/02/03 → TD-CD1 / TD-CD5 / TD-CD6 | 33, 42 (**2**) | UAT-DK-67 người nghỉ việc = Toàn; UAT-DK-66 dùng TD-K12 thay Hưng Thịnh (owner Minh) |
| 03 sale Zalo cá nhân | **110 / 110** (90 ca + 20 hồi quy R01–R20) | U-SZ-A/B/GS/AD → TD-U-KD1/KD2/GS1/AD; K-SZ-1/2 → TD-K01/K12; NVKD Lan / "VCparts Lan" → Linh / "Linh VCparts"; trực thay Minh → Linh; "Gara" → "Garage"; KH00123 → KH-TEST-0101; "A Tuấn – gara Cầu Giấy" → "A Tuấn – Minh Phát"; TD-BG1 12.450.000 → 8.450.000 đ; `BG-2026-0930` (nháp) → `BG-2026-0932` (TD-BG8) | 16, 35–41, 75, 81, 82, 89; 49, 50, 53, 55, 58, 62, 63, 71, 76–78, 88 (**24**) | "Vcparts Tú" thật giữ nguyên; UAT-SZ-10 chạy bằng điện thoại chủ dự án; 01, 12, 54, 60, 61, 79, 84 ghi "chờ 01 có code"; UAT-SZ-86 → TD-K15, UAT-SZ-90 → TD-K11 + TD-BG6 |
| 04 CSKH Zalo OA | **153 / 153** | Nam (NVKD) → Minh; "Minh (CSKH)", Mai (CSKH) → Thu; Hương (giám sát CSKH) → Yến; GĐ Hải → Thắng; OA VCservice → TD-OA2 VCedu; KH00873 → KH-TEST-0101; ticket, SLA → TD-TK0131/0139/0142 và mốc T; UAT-OA-76, 78 ghi rõ "ticket của hội thoại đang ở vùng Z1/Z3"; ngày lễ → 01/01/2027 | 01–11, 25, 33, 57–60, 69, 71, 73, 74 (**21**, phần lớn có đường tạm bằng giả lập) | Không có bảng dữ liệu riêng; đã thêm đoạn trỏ ở §7 và dữ liệu đặc thù; `Z0–Z3` chỉ còn nghĩa vùng khung gửi |
| 05 marketing | **80 / 80** | GĐBH Minh → Thắng; Hương-tmk → Nhung; Hà-mk → Tùng; GS Phong → Hương; Lan / "Lan VCparts" → Linh / "Linh VCparts"; Tuấn (NVKD) → Hải; HCM Hùng → Khôi, Mai → Phương; VCedu Ngọc → Trang; `ĐH-` → `DH-`; `L-2026-000130` (MK-77) → `000133` | 01, 40, 54 (**3**) | §10.1 trỏ về bộ chung; lead TD-L04…L06, TD-CD4 mới |
| 06 hóa đơn, công nợ | **93 / 93** | K1-C → TD-C01a…c (Hùng `0900 000 102`, Nga `0900 000 103`); MST `0101234567`/`0109876543` → `9900000101`/`9900000102`; K11 → TD-K10b; K12 → TD-K03; K20 → TD-K15; T1/T2, "Tổ Hương / Tổ Cường" → Tổ HN1 / HN2; Thảo → Hà; Kế toán VCe → Loan; Z1/Z4 (nick) → TD-NK01/NK04; ngày tuyệt đối → mốc T | 79, 92 (**2**) | TD-PHD1 chỉ gồm TD-DH2 (TD-DH1 đã có TD-HD1) |
| **Tổng** | **767 / 767** | | **67** | |

## 2. Bộ chung đã bổ sung (du-lieu-kiem-thu.md v1.1, đánh dấu [v1.1])

- Người dùng: TD-U-CHUA (`moi.uat@`, chưa được thêm; 00), TD-U-KT2 Tống Thị Xuân (kế toán thứ hai; 06).
- Hội thoại: TD-H16, H17 (06), TD-H33…H39 (01), TD-H90 (5.000 hội thoại, hiệu năng; 00).
- Chứng từ: TD-BG6 (K11; 03), TD-BG7 (K01 hết hạn; 04), TD-BG8 (nháp; 03); TD-TK0128, TK0138 (04); TD-ZNS5, ZNS6 (04); TD-CD4 (OA VCedu; 05), TD-CD5, CD6 (02); TD-L04…L06 và nhóm nhận lead "VCparts HN" (05); TD-MC8…MC13 (03, 04).
- Account: MST TD-K16, K10b, K13; email TD-K01; tag "Long Biên" cho TD-K07; danh tính OA1 cho C08a.
- Ngoại lệ email `@gmail.com` cho UAT-DK-76; TD-KB11 sửa màn MH-DK-05 → MH-DK-06; §8.5 thêm danh sách ca "Chờ TT-02" thực tế.
- Trùng mã giữa đề xuất của các file đã xử lý: `TD-BG6` (03 ↔ 04) → 04 dùng **TD-BG7**; `TD-MC8` (03 ↔ 04) → 04 dùng **TD-MC13**; `TD-CD4` (02 ↔ 05) → 02 dùng **TD-CD5, TD-CD6**.

## 3. Xung đột còn lại (cần chốt)

| # | Xung đột | File | Đề xuất |
|---|---|---|---|
| C-01 | TD-TK0131 thuộc Lan trong bộ chung, nhưng 01 cần Thu giữ (UAT-PQ-20, 102, 104, 105). Hiện 01 ghi "đổi người xử lý sang Thu trước ca" | 01, 04 | Thêm ticket riêng của TD-K09 giao Thu, hoặc giữ bước tiền điều kiện |
| C-02 | Hạn trả lời owner 15′ (01) và 30′ (02) | 01, 02 | Chờ QĐ-06 / TS-05 |
| C-03 | UAT-DK-67 cần 6 khách của người nghỉ việc; TD chỉ có 3 khách của Toàn (TD-K18a…c), 3 khách còn lại là của Hải | 02 | Thêm 3 khách của Toàn vào TD, hoặc sửa ca còn 3 khách |
| C-04 | UAT-DK-44 cần TD-K10a/b **chưa gộp**; UAT-DK-46 cần mốc gộp T−40 ngày. Seed mặc định là đã gộp | 02 | Script nạp (§10.2) hỗ trợ hai biến thể |
| C-05 | Nhóm nhận lead "VCparts HN" có Hải (tổ HN2, GS Đức) nhưng người phân xử là Hương (UAT-MK-20, 43, 44, 50, 55, 56, 58, 78) | 05 | Chấp nhận nhóm lead liên tổ do Hương giám sát, hoặc đổi Hải → Minh ở các ca chia lead |
| C-06 | UAT-OA-14 cần một người dùng thấy cả OA1 và OA2; đang tạm dùng TD-U-QS | 04 | Chốt TD-U-QS có vào `/cskh` được không, hoặc gán thêm OA2 cho một CSKH |
| C-07 | UAT-OA-41: chưa rõ giám sát CSKH (Yến) có được nhận ticket không; UAT-OA-32: CSKH không gửi được báo giá cho khách có owner nên ca giao cho Minh | 04 | BA 04 xác nhận |
| C-08 | Lịch làm việc có nghỉ trưa (TS-01: 08:00–12:00, 13:30–17:30) khác TD §2.2 (08:00–17:30) | 02 | Thống nhất khi chốt TS-01 |
| C-09 | TD-HS1 "xuất lần cuối T−45 ngày" mâu thuẫn TD-HD1 phát hành T−3 ngày; TD chưa nói TD-HD1 theo MST nào | 06, TD | Sửa TD-HS1 thành "xuất lần cuối T−3 ngày (TD-HD1)" hoặc cho TD-HD1 theo TD-HS2 |
| C-10 | TD-KB12: chị Nga nhắn TD-H01; 06 cho anh Tuấn gửi MST trên Zalo (giữ anh Tuấn) | 06, TD | Sửa tin mẫu KB-12 cho khớp 06 |
| C-11 | UAT-UI-06 cần 2 tài khoản kênh của Minh: đang dùng TD-NK01 + TD-FB1; nếu bắt buộc 2 nick Zalo thì phải gán thêm nick cho Minh | 00 | BA 00 xác nhận |
| C-12 | Wireframe 03 (MH-SZ-05i, 07, 09, 13) cho TD-K01 nhắn nick "Linh VCparts", owner Linh; TD: owner Minh trên NK01. Panel MH-SZ-07 ghi TD-K01 "Quá hạn 5 ngày" trong khi TD-CN1 trong hạn. Wireframe MH-DK-12 (02) ghi Hòa Bình owner Minh | 03, 02 | Sửa hình minh họa ở vòng thiết kế |
| C-13 | Mặc định TD §7 (trực thay Tú → Linh, NK02 vàng, NK03 đỏ) khác giả định cũ của 01 (không trực thay, mọi nick an toàn) — chưa thấy ca hỏng | 01 | Kiểm lại khi chạy |
| C-14 | UAT-PQ-51, 75, 91, 109 thao tác token của TD-TB1 (Chrome driver thật dùng chung) | 01 | Chạy ngoài giờ gửi, cấp lại token sau ca |
| C-15 | Đề xuất thêm vào danh sách chờ TT-02: UAT-SZ-64, 69 | 03 | Chủ dự án / QA lead quyết |

Chưa làm: `personas.md` (P-BGD bỏ tên thật) theo §9 — ngoài phạm vi lần này.

## 4. Kết quả xử lý xung đột (29/09/2026, lượt "dọn dữ liệu + trỏ 07")

TD lên **v1.2**; 00–06 thêm dòng lịch sử **v1.4.1** "dọn dữ liệu + trỏ 07". File 07 không sửa (đang góp ý).

| # | Xung đột | Đã xử lý |
|---|---|---|
| C-01 | TD-TK0131 của Lan, 01 cần Thu | **Đã xử lý.** TD §5.5 thêm **TD-TK0133** (TD-K09, bảo hành lần 2, giao Thu từ đầu, gắn TD-H35). 01 UAT-PQ-20, 102, 104, 105 dùng TD-TK0133; bỏ bước "đổi người xử lý sang Thu" |
| C-02 | Hạn trả lời owner 15′ / 30′ | **Đã xử lý** theo TS-05 / TS-06: **15′ lần 1, 30′ lần 2**. 01 (§7 dữ liệu, PQ-19 leo thang lần 2), TD §7 và TD-KB09 (T+3h55′ lần 1, T+4h10′ lần 2). 02 đã đúng từ v1.3 |
| C-03 | UAT-DK-67 cần 6 khách của Toàn | **Đã xử lý.** TD thêm **TD-K18d…f** (`0900 000 024…026`, NK05, owner Toàn), chỉ nạp ở nhóm ca 02 (`variant=dk67`) để 01 vẫn bàn giao 3 khách. 02 UAT-DK-67 dùng TD-K18a…f |
| C-04 | UAT-DK-44 / 46 cần K10a/b chưa gộp / gộp T−40 | **Đã xử lý.** TD KB-11 và §10.2: biến thể seed `k10=gop` (mặc định) / `da-tach` (DK-44) / `gop-T-40` (DK-46) |
| C-05 | Nhóm lead "VCparts HN" trộn tổ | **Đã xử lý.** Nhóm = **Linh + Minh** (cùng HN1, GS Hương). 05 dữ liệu đặc thù và UAT-MK-20, 43, 56, 58, 78 đổi Hải → Minh; TD §5.6 sửa theo |
| C-06 | UAT-OA-14 cần người thấy OA1 + OA2 | **Đã xử lý.** Yến (TD-U-GSCS) được gán thêm TD-OA2 mức Chỉ xem (Admin gán chéo); 04 UAT-OA-14 dùng Yến thay TD-U-QS |
| C-07 | Giám sát CSKH nhận ticket; OA-32 | **Đã xử lý (BA xác nhận).** Giám sát CSKH nhận được ticket như thành viên nhóm (ghi ở 04 UAT-OA-41); UAT-OA-32 giữ Minh (CSKH không gửi báo giá khách có owner) |
| C-08 | Nghỉ trưa (02) ≠ TD | **Đã xử lý.** Theo TS-01 (08:00–17:30, không nghỉ trưa): 02 §3 dữ liệu đặc thù sửa; UAT-DK-40, 72 không phụ thuộc nghỉ trưa. TD §7 ghi rõ |
| C-09 | TD-HS1 T−45 ≠ TD-HD1 T−3 | **Đã xử lý.** TD-HD1 theo TD-HS1; TD-HS1 xuất lần cuối **T−3 ngày** (TD-HD1), lần trước T−45 (HĐ 0001102). 06 §1.6, UAT-HD-04, MH-HD-01, MH-HD-03 đổi 15/08 → 26/09/2026 · HĐ 0001234 |
| C-10 | KB-12: chị Nga vs anh Tuấn | **Đã xử lý.** TD-KB12: anh Tuấn nhắn TD-H01 lúc T−5′ (câu của 06 UAT-HD-01) + ảnh GPKD lúc T−4′ |
| C-11 | UAT-UI-06 hai tài khoản kênh của Minh | **Đã xử lý (BA xác nhận).** Giữ TD-NK01 + TD-FB1; ghi chú ở 00 UAT-UI-06 |
| C-12 | Wireframe 03, 02 lệch TD | **Đã xử lý.** 03 MH-SZ-05i, 07, 09, 13 (và 14): nick "Minh VCparts", phụ trách Minh, công nợ 12.000.000 ₫ trong hạn (hạn 05/10). 02 MH-DK-12: dòng Hòa Bình / Minh → Garage Phú Lâm (HCM) / Phương (khách chưa có mã KH). Canvas thiết kế sửa theo ở vòng thiết kế |
| C-13 | Mặc định §7 khác giả định cũ của 01 | **Ghi nhận, kiểm khi chạy.** TD §7 và 01 §7 ghi: ca cần khác mặc định phải ghi trong Tiền điều kiện |
| C-14 | Token TD-TB1 (driver thật) | **Đã xử lý.** TD §3.4: chạy ngoài giờ gửi, báo các phiên khác, cấp lại token và thử gửi vào TD-G01 sau ca |
| C-15 | UAT-SZ-64, 69 → chờ TT-02 | **Đã xử lý (QA quyết).** Cả hai ghi "Chờ TT-02" ở 03 và TD §8.5 (SZ-69: chỉ bước trả lời thật) |
| Thêm 1 | NVKD Tú chưa có khách | **Đã xử lý.** TD thêm **TD-K25** Garage Phúc Lộc (anh Ninh Văn Phúc `0900 000 071`, `KH-TEST-0071`) và **TD-K26** anh Mai Văn Quý (khách lẻ, `0900 000 072`, `KH-TEST-0072`), owner Tú; hội thoại Zalo qua TD-NK03: **TD-H40** (K25, chưa trả lời, Linh trả lời thay ở KB-14), **TD-H41** (K26, đã xong) |
| Thêm 2 | TD-H20 (tin cuối T−16h48′) ↔ TD-TK0142 (khách nhắn T−5′) | **Cùng khách, cùng hội thoại** (TK0142 nằm trên TD-H20). **Sửa mốc:** tin cuối của anh Tuấn trên TD-H20 giữ T−16h48′ (khung gửi Z1); TD-TK0142 được Yến **mở lại lúc T−5′** sau cuộc gọi hotline, SLA 30′ tính từ lúc mở lại (04 "Mở lại: SLA mới") → vẫn "còn 25 phút" lúc T, quá hạn T+26′. 04 UAT-OA-15 sửa câu theo; UAT-OA-42, 84 giữ nguyên |

**Còn lại:** C-13 (kiểm khi chạy). Việc `personas.md` (P-BGD bỏ tên thật) vẫn ngoài phạm vi.

## 5. Khớp thiết kế lô D1 (29/09/2026, TD lên v1.3)

Chỉ sửa `du-lieu-kiem-thu.md`; đặc tả 00–07 không đổi. Đánh dấu **[v1.3]**.

| # | Vấn đề | Đã xử lý trong TD |
|---|---|---|
| D1-01 | NK03 đỏ từ 07:10 nhưng tin anh Phúc (TD-K25) lúc 09:40 vẫn về, Linh trả lời được | NK03 **đỏ 07:10 → T+30′ (10:30)**, không phải 09:30 như gợi ý, vì 07 (UAT-BC-17, TD-BC-K, BC-49) cần NK03 đỏ lúc T = 10:00. Anh Phúc nhắn 07:50 và 09:40 khi nick đỏ → hai tin về VClinks lúc 10:30, giữ giờ gửi thật (02 DK-38, 07 BC-24); tin 10:32 về ngay; Linh trả lời thay 10:35. KB-14 viết lại thành bảng mốc có cột Minh / Tú / NK01 / NK03; §3.1, §3.3 (TD-H40), §7 và §10.2 (`nk03=ket-noi-lai`) sửa theo |
| D1-02 | KB-14 Minh ốm 08:15: chưa rõ màn nào đã có cờ Nghỉ phép | Biến thể seed `minh=om` (mặc định Minh Trực tuyến). Từ 08:15 Minh mang cờ Nghỉ phép, NK01 vẫn xanh. §6.3 mới: mốc "hiện tại" cho 20 kịch bản và cho từng màn D1 (1, 1a/1b, 1e, 1d/9/9b, 1c/1f/1g, 3, MH-DK-04/05, 8/10e) |
| D1-03 | Thiếu dữ liệu để vẽ | **TD-MC14** `/khuyenmai` (Tú đề xuất) và **TD-MC15** `/hen-giao` (Linh đề xuất), cả hai Tổ HN1 · Chờ duyệt → `Chờ tôi duyệt (2)` của Hương; TD-MC4 ghi rõ phạm vi Công ty (không vào tab của Hương). TD-MC6 phím tắt `/stktn`. TD-K03: MST `9900000301`, địa chỉ giả; TD-K04 địa chỉ xưởng 2. **TD-GY1** (K03 ↔ K04 / `KH-TEST-0302`: 100 điểm = T1 + T14, bị chặn vì hai mã KH, 3 dòng bằng chứng; biến thể `k04=da-xu-ly\|cho-duyet`). **TD-GY2** cụm 3 hồ sơ chị Mai (80 + 80; số tin 5 + 1 + 2 = **8**), hội thoại mới **TD-H42** (WEB1, biến thể A3 của KB-01, `k02=cum`). Mã mới: tiền tố `TD-GY` |
| D1-04 | Rà mốc T các kịch bản khác | (a) **KB-13:** NK05 ghi "Xanh" (§3.1) nhưng lệnh của Toàn lúc T−10′ đang chờ vì "nick đỏ" → thêm NK05 đỏ từ T−15′; sau T+30′ NK05 đỏ (máy đã thu hồi), `Duyệt lại` chỉ mở sau khi hết "Chưa an toàn". (b) **KB-09 biến thể Vắng:** "Vắng từ T−40′ (không hoạt động 40′)" trái TS-07 (Vắng sau 30′) → thao tác cuối T−40′, Vắng từ T−10′. (c) **KB-01:** NK02 vàng (trễ 12′) nhưng tin T−1h08′ coi như về ngay → về T−56′, giữ giờ gửi thật. (d) **KB-05:** "T′ (20:30)" trong khi T′ = 20:00 → T′+30′…+32′. (e) KB-09 "Đi thị trường" và KB-02…12, 20 (Minh tự thao tác) không chạy cùng ngày với `minh=om`; nhóm lead "VCparts HN" chỉ còn Linh khi Minh nghỉ. (f) KB-14 bước "Linh trả lời TD-H01 qua NK01": NK01 là nick driver thật chỉ gửi TD-G01 → ghi rõ là giả lập, gửi thật dùng TD-G01 (03 UAT-SZ-54) |

**Việc cho BA / designer:** (1) Câu nhãn "tin về trễ" trên **bong bóng chat** chưa có trong 00/03 (07 chỉ có `Về trễ {x}` trong Drawer "Lượt chờ"). (2) Wireframe 03 MH-SZ-06 dùng `/stkvcb` Vietcombank (tên ngân hàng thật) → nên đổi theo TD-MC6 `/stktn`. (3) Canvas D1 vẽ theo §6.3; tên ngoài bộ TD (Ngân, Khoa, Nam…) đổi theo mục "Dữ liệu mẫu lệch" của `tk1/qa.md`.

## 6. Sau vòng 1 của 07 và QA xác nhận D1 (29/09/2026)

### 6.1 Đã xử lý (TD lên v1.3.1)

| # | Vấn đề | Đã xử lý |
|---|---|---|
| D1-05 | TD-KB07 tin OA anh Tuấn T−20′ trên TD-H20 trái TD-TK0142 (tin cuối trên TD-H20 T−16h48′, giữ Z1 "Còn 31 giờ 12 phút"; không có tin khách mới lúc T−5′) — `review/tk1/qa-xac-nhan.md` "Lệch dữ liệu" | **Giữ TD-TK0142** (đã khớp TD-H20). Dời cả bốn mốc TD-KB07 về **T−1 ngày** cùng giờ (09:00–09:40 hôm qua); dải "4 kênh trong 1 giờ (09:00–09:40)" của 02 UAT-DK-11 giữ nguyên. Designer vẽ lại 3a / 360 (`⏱ 47h` theo T−20′ không còn đúng: khung Z1 của TD-H20 theo T−16h48′) |

### 6.2 Dữ liệu 07 — đã xử lý (TD v1.4, 07 v1.1.1; 29/09/2026)

| # | Nguồn | Việc | Ghi chú | Kết quả |
|---|---|---|---|---|
| 07-TD-1 | `dac-ta-vong-1/07-xu-ly.md` "Việc chuyển file khác" dòng TD; 07 §8.1, §10 | Gộp **TD-BC-S, V, T (quý Q2/2026), R, C, K** của 07 v1.1 §8.1 (và TD-BC-*, TD-RT-*, TD-RT-K1…K5 dải SĐT `0900 000 991…995` còn thiếu) vào `du-lieu-kiem-thu.md` §4–§6 | Chưa gộp: TD hiện chỉ có 1 lần nhắc `TD-BC-` | **Đã xử lý (TD v1.4).** TD §6.4 mới nhận toàn bộ 07 v1.1 §8.1: TD-BC-L, P, Q, M, N, A, S, V, T (Quý BC = quý liền trước quý chứa T), R, C, K; TD-RT v3/v2, TD-RT-H; TD-RT-K1…K5 ở §4.4 (dải `0900 000 991…995` ghi vào §1.2); tiền tố `TD-BC-`, `TD-RT-` ở §1.1; kịch bản TD-KB21; §8.4 ánh xạ TD ↔ UAT-BC / UAT-RT. Mã giữ nguyên; 07 §8.1 thay bằng bảng trỏ, "Seed §8.1" → "Seed TD §6.4" (07 v1.1.1) |
| 07-TD-2 | như trên | Mở rộng khoảng dành cho nhóm ca BC tới **T−29 … T−12** (trước T−16); không nạp tin mẫu khác vào khoảng đó | Kiểm các kịch bản đang dùng T−16…T−12 | **Đã xử lý.** TD §1.3 và §6.4: khoảng **T−29 … T−12 ngày** chỉ dành cho nhóm ca BC. Rà: trong khoảng chỉ có dữ liệu không phải tin (TD-GY1 Ngọc xử lý T−29, hạn nợ TD-CN3 T−20, đơn TD-DH6 T−29/−22/−15 = TD-BC-A); không kịch bản nào dùng T−16…T−12. TD-RT-H (T−30…T−2) chỉ nạp ở nhóm ca RT (`nhom=rt`, §7, §10.2). Ngày tuyệt đối của 07 (lễ 02/09, 04/09, 08/09, tháng 06/07) đổi sang mốc T (T−27, T−25, T−21, tháng T−3 / T−2) |
| 07-TD-3 | như trên | Số báo giá mới `BG-2026-0601…0610`, `0721…0730` (TD-BC-R), `0740…0747` (TD-BC-C): **kiểm trùng §5.1** trước khi gộp | – | **Đã xử lý, không trùng.** §5.1 thêm TD-BC-Q1…Q3 (`0701…0703`), TD-BC-R (`0601…0610`, `0721…0730`), TD-BC-C (`0740…0747`); không trùng `0456, 0801, 0802, 0870, 0915, 0930, 0932, 0940`. Đơn `DH-2026-0702` = **TD-DH8** mới (§5.2), không trùng |
| 07-TD-4 | như trên | Tổ giả lập **"Tổ ĐN1"** cho UAT-RT-22 (07-P-GD #11, RT-22) | Thêm vào cây tổ chức TD, không có nick thật | **Đã xử lý.** **TD-DV-DN1** Tổ ĐN1 (chưa có GS, GĐ Thắng quản) với **TD-U-KD8 Kha Văn Sang**, **TD-U-KD9 Lục Thị Diệp** (tên không trùng người / khách nào trong TD và đặc tả), không nick, không khách, chỉ ở biến thể seed `to-dn1` (§2.1, §2.2, §10.2); 07 UAT-RT-22 trỏ mã mới |
| 07-TD-5 | 03 SZ-21 (k), SZ-22 v1.4.2; 07 BC-24 | Tin về trễ cần cả `sentAt` và `ingestedAt` trong seed (ví dụ D1-01 anh Phúc 07:50 / 09:40 về 10:30) | Ghi rõ cột "Về VClinks lúc" trong bảng tin của TD | **Đã xử lý.** §6.2 thêm quy ước "Tin về trễ": mốc = giờ gửi thật, cột **Về VClinks lúc** = `ingestedAt`, seed ghi cả hai; cột thêm vào bảng KB-01 (T−1h08′ → T−56′), KB-14 (07:50, 09:40 → 10:30), TD-BC-S (§6.4, 10:00/10:05 → 10:40); §10.2 dòng "Hội thoại, tin" ghi `ingestedAt` |

**Kèm theo (07 §11):** mọi Q-BC-xx đã gắn mã của `../../01-quan-ly-du-an/quyet-dinh-chu-du-an.md` (QĐ-84…94; câu trùng nghĩa QĐ-07, 48, 49, 50, 53, TT-01, TS-BC-08, 09). Không còn việc mở của 07 với TD.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/khop-du-lieu.md) | — |
