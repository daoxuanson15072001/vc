# Thiết kế lô D2 — ghi chú bàn giao (29–30/09/2026)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Ghi chú bàn giao của designer cho lô thiết kế TK2 (D2), 29–30/09/2026, trên canvas "VClinks UI Design" bản 20.
- Khối lượng: đã vẽ 64/66 màn trong đặc tả trên 31 artboard (24 file chính + 7 phần 2); 2 màn điện thoại chưa vẽ, chờ QĐ-01.
- Mục 2 liệt kê 32 chỗ đặc tả mâu thuẫn hoặc mơ hồ theo nhóm (00/03, 02, 05, 06, 07, 04); designer đã chọn một phía và gắn nhãn trên bản vẽ.
- Chủ dự án chốt D8-02…D8-17 ngày 30/09/2026 cho các chỗ vênh cần quyết; các mục còn lại BA tự xử lý theo đặc tả chuyên trách bản mới hơn và `du-lieu-kiem-thu.md`.
- Sau vòng góp ý 1, chủ dự án chốt thêm D8-18…D8-30 (đồng ý đề xuất BA ở 12 câu, riêng D8-26 nuôi lead làm ngay ở lô D2); đã áp vào đặc tả 00–07, TD và canvas bản 24.
- Mục 3 liệt kê các QĐ / TS / TT đang chờ có mặt trên bản vẽ D2.
- Còn mở: TS-39, TS-40 (trần tin nuôi lead) chờ chủ dự án chốt số; cần kiểm chính sách Zalo về quảng cáo qua ZNS; chưa vẽ MH-MK-07 #27 và MH-OA-14 #2c.

## Mục lục

- [1. Khối lượng](#1-khối-lượng)
- [2. Chỗ đặc tả mâu thuẫn / mơ hồ cần BA sửa (designer đã chọn một phía và gắn nhãn)](#2-chỗ-đặc-tả-mâu-thuẫn--mơ-hồ-cần-ba-sửa-designer-đã-chọn-một-phía-và-gắn-nhãn)
- [3. QĐ / TS đang chờ có trên bản vẽ D2](#3-qđ--ts-đang-chờ-có-trên-bản-vẽ-d2)
- [4. Chủ dự án đã chốt (30/09/2026) — D8-02…D8-17](#4-chủ-dự-án-đã-chốt-30092026--d8-02d8-17)
- [5. Chủ dự án chốt sau vòng góp ý 1 (30/09/2026) — D8-18…D8-30](#5-chủ-dự-án-chốt-sau-vòng-góp-ý-1-30092026--d8-18d8-30)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Canvas: "VClinks UI Design" — https://claude.ai/artifact/8cAKkTjtb94BTCWFoErv1p (bản 20). Nguồn sự thật: đặc tả `docs/ba/00…07` (D8-01). Dữ liệu: `du-lieu-kiem-thu.md` v1.3+. Số không có trong TD để `[..]`; câu chữ không có trong đặc tả gắn nhãn "câu chữ BA đề xuất". Artboard cao hơn 8000 px được cắt thành "phần 2" đặt ngay bên dưới.

## 1. Khối lượng

| Nhóm | Màn trong đặc tả (D2) | Đã vẽ | Artboard | Không vẽ |
|---|---|---|---|---|
| 03 Sale Zalo | MH-SZ-07, 09, 10, 11, 14 | 5 | 1m InfoPanel, 11 Contacts, 6 Search (kèm MH-UI-04) | – |
| 02 Khách đa kênh | MH-DK-04…08, 11…14 | 9 | 4 Customers, 4a Merge (+P2), 4b OwnerConflict, 4c ErpSync | – |
| 05 Marketing | MH-MK-01…12 | 11 | 12 MkSources, 12a MkChatbot (+P2), 12b MkLeads (+P2), 12c FanpageComments, 12d MkDashboard | MK-12 (điện thoại, QĐ-01) |
| 06 Hóa đơn, công nợ | MH-HD-01…13 | 13 | 13 Invoice (+P2), 13a InvoiceSend, 13b Debt (+P2), 13c DebtAdmin | Phần điện thoại của HD-13 (QĐ-01) |
| 07 Báo cáo, chia khách | MH-BC-01…09, MH-RT-01…06 | 15 | 7 Reports (+P2), 7a ReportsDetail, 15 Routing, 15a RoutingChange | – |
| 04 CSKH OA | MH-OA-08…17, 19 | 11 | 14 OaAuto, 14a Zns, 14b OaCampaign (+P2), 14c OaReports | – |
| **Tổng** | **66** | **64** | **31 artboard** (24 file chính + 7 phần 2; tính cả 6 Search "D1/D2" và 14 OaAuto — sửa theo QA-19) | 2 (điện thoại) |

Còn lại ngoài D2: bản điện thoại (MH-UI-11, MK-12, HD-13, duyệt trên điện thoại) chờ QĐ-01; artboard cũ "5 Việc cần làm /tasks" và "0c TikTok Shop" chưa có đặc tả; việc nhỏ D1 trong `ba/README.md` (3a mốc KB07, 10e bản rút gọn cho sale, mã câu hỏi cũ trên canvas).

Chu trình tiếp theo (theo `ba/README.md`): bước 5 agent người dùng từng vai góp ý thiết kế D2 → bước 6 BA lọc → bước 7 QA.

## 2. Chỗ đặc tả mâu thuẫn / mơ hồ cần BA sửa (designer đã chọn một phía và gắn nhãn)

**00 / 03 — Tìm kiếm**
1. Câu thiếu ký tự, câu rỗng, câu lỗi khác nhau giữa 00 MH-UI-04 và 03 MH-SZ-14 (có/không nút "Thử lại").
2. Khoảng ngày mặc định: 00 "Tất cả", 03 "12 tháng gần nhất" (đã vẽ theo 00).
3. Chưa có quy tắc nhận dạng mã OE / mã KH; chưa rõ D1 có trang `/search` không; nhiều từ khóa khớp tất cả hay một (giả định: tất cả).

**03 — Danh bạ, lời mời, tạo nhóm**
4. Toast v1.1 ("Đang kết bạn với…", "Đang tạo nhóm…") chưa thay trong bảng màn 10, 11.
5. Wireframe 09 ẩn SĐT với owner, trái 01 PQ-45 (đã vẽ owner thấy đủ).
6. Wireframe 09/10 dùng tên không có trong TD (Hiệp Lễ, Mai Phạm); anh Tuấn vừa là bạn vừa gửi lời mời.
7. Thiếu câu chữ: tooltip khóa Chặn/Hủy kết bạn, dải nick đỏ màn 09, xác nhận Chặn/Hủy.

**02 — Gộp hồ sơ, xung đột, VCsales**
8. TD-GY2: #9 nói hồ sơ bị chặn tách dòng riêng, TD vẫn giữ "Cụm 3 hồ sơ"; mức SĐT (b) V1 hay V2 (câu hỏi mở 12.10).
9. SA thấy đủ SĐT (MH-DK-05) ↔ DK-44 v1.2 bắt SA bấm "Hiện" (đã vẽ theo DK-44).
10. 01 PQ-03 ẩn khách ngoài phạm vi khỏi kết quả tìm ↔ MH-DK-08 #6 hiện tên và owner (đã vẽ theo 02).
11. Quyền MH-DK-13: 00 §2.2 cho GĐ ✓ GS –; đặc tả chỉ ghi SA, KD.
12. Mẫu dữ liệu không có trong TD: KH-TEST-0388 "Gara Khoa Minh"; dòng 10:04 MH-DK-14 trái KB-10; số 0900 000 301 / 900 lệch loại "dùng chung".
13. SA không được xem câu tin (01 PQ-25) nhưng MH-DK-12 ghi "kèm tin nguồn".

**05 — Marketing**
14. Nút duyệt với người không có quyền: dạng C (05) ↔ "không có nút" (01 UAT-PQ-38, UAT-MK-12 tự mâu thuẫn); Xuất Excel NVMK cùng kiểu.
15. Tooltip tự duyệt khác chữ giữa 05 và 01; quyền "Tắt khẩn cấp" 05 ↔ 01.
16. Ngưỡng màu SLA lead 50% (05 #14) ↔ 25% (00 §3.4).
17. TD-L-A: nguồn Fanpage (TD §5.6) ↔ WEB1 (UAT-MK-23/54/61); BG-2026-0456 650.000 ↔ 1.240.000.
18. Ngày CD1 01–31/10 "Đang chạy" trước mốc 29/09; MH-MK-08 đặt quy tắc VCedu trong division VCparts; kỳ mặc định MH-MK-10 "Tuần này" ↔ 30 ngày.

**06 — Hóa đơn, công nợ**
19. Mốc giờ wireframe (14:02–14:30) ↔ TD-KB12 (09:55–10:00); "26 giờ trước" không khớp giờ làm việc.
20. HĐ 0001240: wireframe gán Garage Phú Thịnh ↔ §1.6 gán TD-K01.
21. Wireframe MH-HD-04 hiện đồng thời các dòng loại trừ nhau (tạm hoãn / kế toán sẽ nhắc / tôi tự nhắc).

**07 — Báo cáo, chia khách**
22. MH-BC-01 #1 cho KD tab "Hiệu suất" ↔ MH-BC-06 cấm KD (đã ẩn).
23. "Không người chịu = 0" hiện trên wireframe ↔ #3 chỉ hiện khi > 0.
24. Khối "Kiểm soát dữ liệu" ở MH-BC-04 được 05 #2b nhắc nhưng không có trong bảng MH-BC-04.
25. UAT-BC-48 G5 = 10/11 nhưng TD có thêm 4 tài khoản VCedu; "Tỷ lệ chốt" ↔ KPI-14 "Chốt trong 30 ngày"; một số ô MH-BC-04 designer tự suy từ TD — cần BA xác nhận.
26. 00 §2.2 không đủ cột cho XEM, SA, AD (menu báo cáo do designer tự đặt); 4 route báo cáo mới chưa có trong 00 §2.

**04 — CSKH OA**
27. 00 §2.2 ẩn "Kết nối kênh" với CS ⁽¹³⁾ nhưng MH-OA-08/09/15/16 cho giám sát CSKH soạn ở đó.
28. OA-US-05 ghi MH-OA-08 là MVP ↔ README xếp D2.
29. Câu mẫu chatbot trong wireframe hứa thời gian cố định, vi phạm quy tắc #3 (đã thay bằng `{han_phan_hoi}`).
30. Tự động hóa: 00 cho CS chỉ xem ↔ 01 cho trưởng nhóm CS sửa; chi phí tin: 00 chỉ xem ↔ 01/04 403.
31. UAT-OA-135/136 tổng chi phí không khớp quyền division; "đơn giá nhập 01/10/2026" sau mốc T.
32. Khảo sát 4 nút ↔ CSAT thang 1–5 chưa có quy đổi; UAT-OA-122 "Xin loại" ↔ v1.3 bỏ với mục đích thanh toán; lịch gửi 09:00 ↔ mặc định 10:30.

## 3. QĐ / TS đang chờ có trên bản vẽ D2

QĐ-01 (điện thoại) · QĐ-02 (chatbot/web MVP) · QĐ-03 (ZNS lẻ) · QĐ-08 (khách chưa mã KH) · QĐ-09, QĐ-10 (lead) · QĐ-13 (NĐ 13) · QĐ-14 (MH-DK-12 vào MVP) · QĐ-15 (hạn nợ VCsales, 3 đơn gần nhất) · QĐ-16, 73, 76–79, 81 (hóa đơn) · QĐ-17, 19, 60, 67 (OA) · QĐ-26 (người duyệt nội dung) · QĐ-27, 28, 29, 40, 52, 61, 62 (marketing) · QĐ-30 (CSKH tìm SĐT) · QĐ-31, 53, 65 (danh bạ) · QĐ-46, 57, 58, 66 (gộp, xung đột) · QĐ-84–87, 91–94 (báo cáo) · QĐ-86 (gộp quy tắc giao lead với chia khách) · TS-09, 18, 21, 26, 38, TS-BC-08, TS-HD-01/09/10 · TT-01, 02, 09, 13.

## 4. Chủ dự án đã chốt (30/09/2026) — D8-02…D8-17

| Mã | Chỗ vênh (mục 2) | Quyết định | Ghi chú |
|---|---|---|---|
| D8-02 | 14 | Nút thiếu quyền: vai trò không bao giờ có quyền thì **ẩn**; có quyền nhưng thiếu điều kiện tạm thời (tự duyệt bản mình, chưa đủ dữ liệu) thì **khóa + tooltip** | Áp cho mọi màn |
| D8-03 | 9 | Sale admin xem SĐT khi gộp: **phải bấm "Hiện"**, ghi nhật ký | Theo DK-44; sửa MH-DK-05 |
| D8-04 | 10 | Tìm ra khách ngoài phạm vi: **hiện tên + owner, khóa chi tiết**, có "Xin quyền truy cập" | Theo 02; sửa 01 PQ-03 |
| D8-05 | 22 | KD **không** thấy tab "Hiệu suất"; chỉ "Dashboard của tôi" | Sửa MH-BC-01 #1 |
| D8-06 | 27 | Giám sát CSKH **vào được "Kết nối kênh", chỉ các tab nội dung** (tin chào, menu, tag, khảo sát); kết nối/token chỉ Admin; GĐ duyệt trước khi bật | Sửa 00 §2.2 ⁽¹³⁾ |
| D8-07 | 30a | Quy tắc tự động OA: **trưởng nhóm CSKH tạo/sửa, GĐ bật** | Theo 01; sửa 00 |
| D8-08 | 30b | Chi phí tin mẫu ZNS: **trưởng nhóm CSKH xem được (chỉ xem)** | Khác đề xuất BA; theo 00; sửa 01, 04, UAT-OA-138 |
| D8-09 | 15 | "Tắt khẩn cấp" chatbot web: **mọi người marketing** được bấm | Khác đề xuất BA; theo ma trận 01; sửa 05. BA đề nghị: mọi lần tắt ghi nhật ký + báo TMK, GĐBH ngay |
| D8-10 | 16 | Chip SLA lead "Sắp quá" khi **còn 25% thời gian** | Theo 00 §3.4; sửa 05 #14 |
| D8-11 | 2, 3 | Tìm tin nhắn: mặc định **tất cả thời gian**, nhiều từ **khớp đủ mọi từ** | Theo 00; sửa 03 MH-SZ-14 |
| D8-12 | 8 | Cụm gợi ý gộp có hồ sơ bị chặn: **tách hồ sơ bị chặn ra dòng riêng**, gộp phần còn lại | Theo MH-DK-04 #9; sửa TD-GY2 |
| D8-13 | 28 | Tin chào Zalo OA (MH-OA-08): **MVP** | Sửa README lô D1/D2 |
| D8-14 | 32a | Khảo sát hài lòng: **5 mức 1–5 sao** | Sửa MH-OA-16 |
| D8-15 | 32b | Chiến dịch nhắc thanh toán: sale **không được "Xin loại"**, giờ gửi mặc định **10:30** | Theo v1.3; sửa UAT-OA-122, câu "gửi lúc 09:00" |
| D8-16 | 13 | Sale admin ở việc VCsales: **chỉ xem đoạn trích chứa thông tin cần nhập** (tên, MST, địa chỉ), không đọc cả hội thoại, có nhật ký | Sửa 01 PQ-25 (ngoại lệ) và 02 MH-DK-12 |
| D8-17 | 11 | Đối chiếu mã KH hàng loạt: **GĐ division chỉ xem**, giám sát không vào | Theo 00 §2.2; sửa 02 MH-DK-13 |

**BA tự xử lý, không cần chủ dự án** (câu chữ, dữ liệu mẫu, thiếu dòng trong bảng): mục 1, 4, 5 (theo 01 PQ-45: owner thấy đủ SĐT), 6, 7, 12, 17, 18, 19, 20, 21, 23, 24, 25, 26, 29, 31. Nguyên tắc: câu chữ lấy theo đặc tả chuyên trách bản mới hơn; dữ liệu theo `du-lieu-kiem-thu.md`, sửa wireframe cho khớp TD; thiếu thì bổ sung vào bảng đặc tả.

**Việc tiếp theo:** (1) sửa các file đặc tả 00–07, README, TD theo D8-02…17 và phần BA tự xử lý; (2) sửa canvas cho khớp (các chỗ đang gắn nhãn vênh); (3) vòng góp ý theo vai + QA lô D2.

## 5. Chủ dự án chốt sau vòng góp ý 1 (30/09/2026) — D8-18…D8-30

Chủ dự án đồng ý đề xuất BA ở 12 câu, riêng câu 9 chọn **làm ngay**.

| Mã | Câu hỏi (nguồn) | Quyết định |
|---|---|---|
| D8-18 | KH-Q1 (xu-ly-KH) | Cặp bị chặn vì hai mã KH: hai nút riêng "Là account liên quan (cùng chủ)" và "Báo trùng trên VCsales" |
| D8-19 | KH-Q2 | Hai phía khác owner: SA gộp ngay; owner theo #9 (1) nếu có mã KH/đã mua, còn lại owner tạm, GS/GĐ chọn ở MH-DK-11 trong 1 ngày làm việc, quá hạn thì owner tạm thành chính thức |
| D8-20 | KH-Q3 | MVP: chỉ hiện "Đồng bộ VCsales lần cuối [HH:mm]"; SA nhập tay mã vừa tạo vào ô "Đã tạo mã KH" |
| D8-21 | SZMK câu 1 | CSKH `Chèn vào tin` mặc định tên, mã, tồn; nút riêng `Chèn kèm giá lẻ` qua kiểm tra DK-31 |
| D8-22 | SZMK câu 2 | Bình luận Fanpage: MVP chưa đặt SLA, chỉ hiện thời gian chờ + badge; đo 1 tháng rồi đặt |
| D8-23 | SZMK câu 3 | Ngân sách chiến dịch quảng cáo: không chặn; báo GĐBH khi tạo và khi đã chi ≥ 80% |
| D8-24 | OAHDBC Q1 | GĐ có nút "Trả lại" bản sửa quy tắc tự động |
| D8-25 | OAHDBC Q2 | Khách đang chờ duyệt tạm hoãn bị loại ngay khỏi nhắc nợ |
| D8-26 | OAHDBC Q3 | **Làm ngay ở lô D2:** marketing tạo chiến dịch **nuôi lead** qua OA / ZNS (nguồn tập khách "Từ lead"); menu "Chiến dịch gửi tin" giữ cho MK |
| D8-27 | OAHDBC Q4 | Hộp báo trước nhắc nợ (MH-HD-13) vào đợt màn điện thoại đầu tiên khi chốt QĐ-01; giữ khoảng chờ 2 giờ |
| D8-28 | OAHDBC Q5 | Quy tắc tự động khớp theo cả từ; tin có dấu so có dấu |
| D8-29 | OAHDBC Q6 | "Chốt trong 30 ngày" mẫu số nhỏ: giữ số, kèm "tạm" và (n = …) |
| D8-30 | OAHDBC Q7 | Ticket mở lại do khảo sát giao về người xử lý cuối |

**Đã áp (30/09, canvas bản 24):** D8-18…30 ghi vào đặc tả 00–07 và TD, nhãn trên canvas đổi sang D8-xx. D8-21/22/23 viết mới vào 03/05 và vẽ thêm. D8-26: 04 MH-OA-13 thêm mục đích "Nuôi lead" (quy tắc OA-44, UAT-OA-160…162), 05 MH-MK-07 #27, 00 chú thích ⁽¹⁸⁾, 01 quyền `campaign.*` cho MK (chỉ Nuôi lead), TD thêm TD-L-G…N; canvas OaCampaign phần 2 vẽ góc nhìn Tùng tạo chiến dịch Nuôi lead.
**Chờ chủ dự án chốt số:** TS-39 (trần tin nuôi lead: 1 tin/7 ngày, tối đa 4 tin/60 ngày — đề xuất), TS-40 (loại lead đã giao sale trong 7 ngày — đề xuất). Cần kiểm tra chính sách Zalo về nội dung quảng cáo qua ZNS. Chưa vẽ: MH-MK-07 #27, MH-OA-14 #2c.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk2/ghi-chu.md) | — |
