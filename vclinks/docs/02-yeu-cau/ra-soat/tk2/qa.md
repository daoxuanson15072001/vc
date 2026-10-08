# QA thiết kế lô D2 — bước 7 chu trình (vòng 1)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- QA vòng 1 (bước 7 chu trình) cho lô thiết kế TK2 (D2), ngày 30/09/2026; agent QA chỉ đọc, đối chiếu 31 board với đặc tả 00–07, TD, D8-02…D8-17 và ba sổ xử lý.
- Kết luận: **Đạt có điều kiện**; 0 lỗi Nghiêm trọng · 8 Trung bình · 12 Nhẹ (QA-01…QA-20).
- Phủ màn 64/66 (thiếu 2 màn điện thoại chờ QĐ-01); cả 5 mục Chặn trong ba sổ xử lý đã có trên bản vẽ; D8-02…D8-17 áp đúng.
- Lỗi chính: menu thu gọn của khung app sai vai, thiếu mục, không nhất quán (QA-01…03); chữ bị cắt trong thẻ (QA-05, QA-06); nhãn Search lỗi thời (QA-07); vênh quyền MH-MK-11 chưa có quyết định (QA-08).
- Bảng 16 quy tắc then chốt: 2 quy tắc "Không" (khung app theo vai; nhãn lệch còn sót), 2 quy tắc "Đạt có ngoại lệ", còn lại Đạt.
- Điều kiện chốt lô: sửa khung app, 2 chỗ chữ bị cắt, nhãn Search, ghi câu hỏi hoặc quyết định cho MH-MK-11; lỗi Nhẹ làm cùng đợt hoặc để dev.
- Người duyệt nên xem kỹ mục 2 (bảng lỗi) và cách kiểm ở mục 4 (Playwright, so menu 61 khung với 00 §2.2, đối chiếu dữ liệu với TD).

## Mục lục

- [1. Kết luận](#1-kết-luận)
- [2. Bảng lỗi](#2-bảng-lỗi)
- [3. Quy tắc then chốt](#3-quy-tắc-then-chốt)
- [4. Cách kiểm](#4-cách-kiểm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Ngày 30/09/2026. Người làm: agent QA, **chỉ đọc**; không sửa artboard, đặc tả, `canvas.json`.
> Đầu vào: 31 board có "D2" trong tiêu đề ở `canvas/project/` (24 file chính + 7 file phần 2); đặc tả `specs/00…07`, `du-lieu-kiem-thu.md`; quyết định `specs/_ghi-chu-D2.md` §4 (D8-02…17); sổ xử lý `review/tk2/vong-1/xu-ly-KH.md`, `xu-ly-OAHDBC.md`, `xu-ly-SZMK.md`.
> Lưu ý thời điểm: `00-giao-dien-chung.md` và `01-phan-quyen.md` được sửa lúc 01:52, **sau** mọi artboard (artboard mới nhất 01:43). QA đối chiếu với bản 01:52; chỗ lệch do đặc tả mới hơn bản vẽ ghi ở QA-07.

## 1. Kết luận

**Đạt có điều kiện.**

- 0 lỗi Nghiêm trọng · 8 lỗi Trung bình · 12 lỗi Nhẹ.
- Phủ màn đủ: 64/66 màn D2 có trên canvas, có ô đen mã MH; 2 màn còn thiếu là bản điện thoại chờ QĐ-01.
- Cả 5 mục **Chặn** trong ba sổ xử lý đã có trên bản vẽ.
- D8-02…D8-17 được áp đúng ở nút, dữ liệu và câu chữ trên các màn.
- Kỹ thuật: 7 đường cắt phần 1 / phần 2 đều rơi vào khoảng trống, không chữ nào bị cắt ở biên khung, không tràn ngang trang, không chồng chữ thật.
- Điều kiện để chốt lô:
  1. Sửa khung app: menu thu gọn theo vai và avatar chữ tắt (QA-01…03, QA-04).
  2. Sửa 2 chỗ chữ bị cắt trong thẻ (QA-05, QA-06).
  3. Cập nhật nhãn Search theo 00 v1.4.4·R1 (QA-07).
  4. Ghi câu hỏi hoặc quyết định cho vênh quyền MH-MK-11 (QA-08).

  Các lỗi Nhẹ làm cùng đợt hoặc để dev.

## 2. Bảng lỗi

Mức: **Nghiêm trọng** (sai nghiệp vụ / quyền, UAT sẽ fail) · **Trung bình** (sai quy tắc chung, dễ làm dev hiểu sai, chữ quan trọng không đọc được) · **Nhẹ** (câu chữ, trình bày, nhãn lỗi thời).

| Mã | Mức | Artboard | Mô tả | Đề xuất sửa | Nhóm đặc tả |
|---|---|---|---|---|---|
| QA-01 | Trung bình | 12c FanpageComments; 4 Customers (màn SA); 4a Merge | Menu thu gọn hiện mục mà vai **không bao giờ có** (00 §2.2 cột "–"; theo D8-02 và quy tắc menu 2 phải ẩn). Lan (CSKH) mang nguyên menu marketing: có "Quy tắc giao lead", "Mẫu tin ZNS", "Quảng cáo", "Nội dung VCwiki", nhưng thiếu "Hộp thư CSKH", "Ticket", "Khách hàng". Ngọc (SA) có "Lệnh gửi", "Ticket", "Danh bạ kênh". | Lấy menu theo cột vai ở 00 §2.2: CSKH theo Lan ở Zns / OaAuto; SA theo ErpSync (bỏ Lệnh gửi, Ticket, Danh bạ kênh) | 00 §2.2 · 05 MH-MK-09 · 02 |
| QA-02 | Trung bình | 11 Contacts; 1m InfoPanel; 4 Customers, 4a Merge (SA); 4c ErpSync; 4b OwnerConflict (GĐ) | Màn đang mở không có mục menu của chính nó, hoặc tô sáng sai mục. Contacts: thanh chỉ có Hội thoại, Lệnh gửi, Ticket; không có "Danh bạ kênh", không mục nào tô sáng, dù chú thích ghi "mở từ biểu tượng Danh bạ dưới Tin nhắn". InfoPanel: không mục nào tô sáng. Gợi ý gộp (SA): không có mục "Gợi ý gộp hồ sơ", đang tô "Khách hàng". ErpSync: không có "Việc VCsales", "Đối chiếu mã KH". OwnerConflict (Thắng): không có "Xung đột owner". | Thêm mục của màn vào thanh và tô sáng đúng mục (00 MH-UI-01 #2 `aria-current`). Riêng Contacts / InfoPanel: vẽ biểu tượng Danh bạ trên thanh như chú thích 03 | 00 §2.2, MH-UI-01 · 03 MH-SZ-09 · 02 |
| QA-03 | Trung bình | Mọi board có khung app (tổng 61 khung) | Menu thu gọn thiếu mục mà vai có quyền. Cùng một người lại có menu khác nhau giữa các artboard. Hà (KT): Debt có "Chiến dịch gửi tin" nhưng không có "Chi phí tin mẫu"; Invoice / InvoiceSend thiếu cả hai; Zns thiếu "Phản hồi thanh toán", "Người nhận thanh toán". Minh / Linh (KD): Customers, Search, Reports thiếu "Hóa đơn"; Debt thiếu "Lệnh gửi"; MkLeads (Linh) thiếu "Yêu cầu hóa đơn", "Danh bạ kênh", "Hóa đơn", "Công nợ". Thắng (GĐ): mỗi board một bộ, thiếu 15–21 mục (Routing có "Xung đột owner", Reports không có). "Thư viện media" thiếu ở gần như mọi khung. Chi tiết từng khung: `qa/frames.py` | Dựng một menu mẫu cho mỗi người (Minh, Linh, Hương, Thắng, Ngọc, Hà, Lan, Yến, Tùng, Nhung, Vinh, Quân) theo 00 §2.2, dùng lại ở mọi artboard. Mục có điều kiện (⁽³⁾ ⁽⁶⁾ ⁽⁷⁾ ⁽¹⁰⁾) theo trạng thái TD của màn | 00 §2.2 |
| QA-04 | Nhẹ | 12b MkLeads (khung GĐ, dòng 400); 15 Routing, 15a RoutingChange (khung GS) | Avatar chữ tắt không theo quy ước canvas (chữ đầu họ + chữ đầu tên). Trịnh Văn Thắng là "TT" ở MkLeads, trong khi 6 board khác dùng "TH". Nguyễn Thị Hương là "HG" ở Routing, RoutingChange, trong khi Reports, ReportsDetail dùng "NH" | Đổi thành "TH" và "NH" | 00 UI-TP-04 |
| QA-05 | Trung bình | 14a Zns — MH-OA-19 màn chính (Hà, y ≈ 5640–5700) | Bảng "Theo OA" bị cắt ở mép dưới thẻ. Dòng duy nhất "OA VCparts" chỉ hiện nửa trên: ô nhập "Thực chưa VAT" 3.240.000, ô "[số HĐ]", "Hà · 02/11" bị cắt. Đây là dòng kế toán nhập liệu của màn | Nới chiều cao thẻ bảng hoặc bỏ `overflow: hidden` / chiều cao cố định của thẻ | 04 MH-OA-19 |
| QA-06 | Trung bình | 14b OaCampaign — MH-OA-13 bước 2 (Hà, y ≈ 700–1100) | Cột cuối "Lý do bỏ" bị cắt ngang ở mép phải bảng trên cả 5 dòng: tiêu đề, Select "Khi bỏ…", chữ "loại tự động" chỉ còn 55/63 px | Thu hẹp các cột trước, cho bảng cuộn ngang trong thẻ hoặc xuống dòng. Nhớ khung cắt cặp OaCampaign còn 18 px (sổ OAHDBC P-CS #10) | 04 MH-OA-13 · 06 HD-30 |
| QA-07 | Trung bình | 6 Search | Nhãn đã lỗi thời so với 00 v1.4.4·R1 (sửa 01:52): 00 MH-UI-04 #3 **đã có** quy tắc nhận dạng Mã KH, Mã OE (chuỗi 5-5, Tag `Tìm theo SĐT` / `Tìm theo mã OE`, mã là một từ khi khớp đủ mọi từ). Bản vẽ vẫn ghi "Còn lệch: … nhận dạng mã OE / mã KH" (dòng cuối board) và "00 #3 chưa có quy tắc nhận dạng mã OE" (mục Nhận dạng), chưa vẽ Tag đổi loại. Ngoài ra còn 2 chỗ lệch chưa ai quyết: "bảng hay List" và Ctrl+Enter (00: mở tab mới; board: ô lọc hội thoại Ctrl+Enter = mở `/search`) | Vẽ ví dụ `04465-02220` với Tag đổi loại và nhận dạng Mã KH. Bỏ phần "nhận dạng" khỏi nhãn "Còn lệch". Hai chỗ còn lại: BA ghi thành câu hỏi có mã (không để nhãn trôi) | 00 MH-UI-04 · 03 MH-SZ-14 |
| QA-08 | Trung bình | 12d MkDashboard (MH-MK-11, khối Không có quyền) | Nhãn "mâu thuẫn MH-MK-11 ghi CSKH được xem; 00 §2.2 … CS –" vẫn còn. Không thuộc D8-02…17, sổ SZMK cũng chưa ghi câu hỏi. Đặc tả vẫn vênh: 05 MH-MK-11 "Quyền: Xem: NVMK, TMK, KD, CSKH" ↔ 00 §2.2 hàng "Nội dung VCwiki" CS "–" | BA chốt một phía (theo nguyên tắc "nguồn menu là 00" hoặc sửa 00) rồi bỏ nhãn; nếu là nghiệp vụ thì ghi câu hỏi chủ dự án | 00 §2.2 · 05 MH-MK-11 |
| QA-09 | Nhẹ | MkDashboard, MkLeads, MkSources, OaCampaign, OwnerConflict, Zns | Đơn vị tiền "đ" thay vì "₫" (00 §3.5: "12.000.000 ₫"). Cùng khoản nợ Garage Thành Công ghi "180.000.000 đ" ở OaCampaign nhưng "180.000.000 ₫" ở Debt, InfoPanel, InvoiceSend | Thay toàn bộ "đ" sau số bằng "₫" | 00 §3.5 |
| QA-10 | Nhẹ | 13b Debt — MH-HD-08 Drawer (dòng "Công nợ · VCsales 09:55") | "Còn nợ 12.000.000 ₫ · đến hạn 05/10/2026" khác cách viết thống nhất theo 03 MH-SZ-07 #3 ("Công nợ: 12.000.000 ₫ · đến hạn 05/10"); mọi chỗ khác đã theo | Đổi theo mẫu 03 #3 | 06 MH-HD-08 · 03 MH-SZ-07 #3 |
| QA-11 | Nhẹ | 12d MkDashboard (y ≈ 1153) | Đoạn chú thích dưới bảng MH-MK-10 bị cắt dòng thứ 3 ("… Số CD1 theo TD §5.6; còn lại [..]") | Nới chiều cao khối hoặc rút gọn chú thích | 05 MH-MK-10 |
| QA-12 | Nhẹ | 14a Zns — biến thể "Viewer · UAT-OA-135" | Cột "Người nhập" bị cắt ngang ("Hà · 02/11", "Loan · 02/1…"); tiêu đề chỉ còn "Người nhậ" | Thu hẹp cột "Số hóa đơn Zalo" hoặc cho cuộn ngang | 04 MH-OA-19 |
| QA-13 | Nhẹ | 4b OwnerConflict — trạng thái "Đang tải" MH-DK-14 (y ≈ 5457) | Tiêu đề cột "Người…" của bảng skeleton bị cắt ở mép thẻ | Bớt cột hoặc thu chữ | 02 MH-DK-14 |
| QA-14 | Nhẹ | 7 Reports (MH-BC-03), 7a ReportsDetail (khung Hương) | Thanh tab của GS chỉ có Tổng quan · Hiệu suất · Chăm sóc khách. 00 §2.2 cho GS ✓ (tổ) ở "Marketing" và "Hóa đơn và thu nợ"; 07 MH-BC-01 #1 hiện tab theo khóa | Thêm hai tab, hoặc BA sửa 00 nếu GS không có `report.source` / `report.invoice` | 07 MH-BC-01 · 00 §2.2 |
| QA-15 | Nhẹ | 15a RoutingChange (MH-RT-05 #6 lịch sử) | Nhãn "lệch với khác biệt thật v2 → v3 trong TD nên để [lý do]": chỗ vênh dữ liệu còn để nhãn | BA bổ sung lý do v2, v3 vào TD §6.4, hoặc ghi rõ `[lý do]` là số chưa có trong TD rồi bỏ chữ "lệch" | 07 · TD §6.4 |
| QA-16 | Nhẹ | 12b MkLeads (dòng "Mã lead của TD-L-A…") | Ghi chú "TD §4.1 cần sửa 'Fanpage CD1'" đã lỗi thời: TD v1.4.1 đã sửa nguồn TD-L-A = WEB1 | Bỏ vế "cần sửa" | 05 · TD |
| QA-17 | Nhẹ | 14 OaAuto; 15 Routing | Chữ trên chip kênh khác 00 §3.2: "Zalo OA" (chuẩn "OA"), "Chat web" (chuẩn "Web"). Màu đúng | Đổi chữ chip | 00 §3.2 |
| QA-18 | Nhẹ | 4c ErpSync | D8-17 chỉ vẽ phía "GS không vào" (MH-PQ-11 A); chưa có biến thể GĐ division **chỉ xem** MH-DK-13 (ẩn nút xác nhận / chọn dòng) | Thêm một biến thể nhỏ góc Thắng | 02 MH-DK-13 |
| QA-19 | Nhẹ | canvas.json · specs/README.md · _ghi-chu-D2.md | README / ghi chú ghi "29 artboard (22 + 7)"; canvas có 31 board D2 (24 + 7, tính cả 6 Search "D1/D2" và 14 OaAuto). Tiêu đề 14 OaAuto vẫn ghi "· D2" dù MH-OA-08 đã lên MVP (D8-13) | Sửa số trong README / ghi chú. Tiêu đề OaAuto ghi "MH-OA-08 MVP · 09/10 D2" | README |
| QA-20 | Nhẹ | 14b OaCampaign (+P2), 12a MkChatbot (+P2) | Rủi ro, chưa phải lỗi: OaCampaign còn 18 px trong khung cắt, nên P-CS #10 (Nên sửa) chưa vẽ được. Khối cuối trước đường cắt 6390 của MkChatbot chỉ cách mốc 3 px | Phiên chính nới khung cắt trước vòng sửa sau; đo lại đường cắt sau mỗi lần thêm nội dung | canvas.json |

## 3. Quy tắc then chốt

| # | Quy tắc | Kết quả | Ghi chú |
|---|---|---|---|
| 1 | Phủ màn D2 theo README "Lô thiết kế" (trừ điện thoại QĐ-01) | **Đạt** | Có ô đen mã MH cho: MH-SZ-07, 09, 10, 11, 14 · MH-UI-04 · MH-DK-04…08, 11…14 · MH-MK-01…11 · MH-HD-01…13 (HD-13 bản máy tính) · MH-BC-01…09 · MH-RT-01…06 · MH-OA-08…17, 19. Thiếu đúng 2 màn điện thoại (MH-MK-12, phần điện thoại HD-13) |
| 2 | Ô đen mã MH trên mọi màn | **Đạt** | Chip nền `#081c36` (lớp `.an` + nền đen, `.mh`, `.mhc`) ở cả 24 file chính |
| 3 | D8-02 nút thiếu quyền: ẩn / khóa + tooltip | **Đạt** (ở nút) | Mọi nút khóa là thiếu điều kiện tạm thời: tự duyệt, chưa đủ dữ liệu, GS chưa trực thay nick, cặp gộp bị chặn (tooltip chỉ đường), quá 5 ngày làm việc, chưa đủ trường. Nút vai không có quyền đều ẩn: Giao lại (MkLeads), Duyệt và xuất bản (Tùng), nút kế toán ở góc KD Công nợ, Lưu / Xuất ở Chi phí tin (Yến). Menu thì chưa theo quy tắc: xem dòng 11 |
| 4 | D8-03 SA bấm "Hiện" SĐT khi gộp | **Đạt** | Merge: SA thấy `0900 *** 301` + `Hiện`, ghi `phone.reveal`; owner (Linh, Minh) thấy đủ |
| 5 | D8-04 khách ngoài phạm vi: tên + owner, khóa, "Xin quyền truy cập" | **Đạt** | Customers #6 (Minh → Garage Hòa Bình · Hải); Search KD (Hòa Bình · Hải (Tổ HN2)) và CSKH (Lan → Garage Hưng Thịnh · Minh (Tổ HN1), tooltip đúng câu 00 #4; không có dòng HỘI THOẠI / TIN NHẮN) |
| 6 | D8-16 SA chỉ xem đoạn trích ở Việc VCsales | **Đạt** | ErpSync "Xem đoạn trích", ghi nhật ký, không mở cả hội thoại |
| 7 | D8-17 Đối chiếu mã KH: GĐ chỉ xem, GS không vào | **Đạt** | GS: MH-PQ-11 A đúng câu. Thiếu biến thể GĐ chỉ xem (QA-18, Nhẹ) |
| 8 | D8-05…D8-15 (tab Hiệu suất KD, Kết nối kênh cho giám sát CSKH, tự động hóa, chi phí ZNS, tắt khẩn cấp, SLA lead 25%, tìm tin mọi thời gian + khớp đủ từ, tách hồ sơ bị chặn, tin chào MVP, khảo sát 5 sao, không "Xin loại" với nhắc thanh toán + 10:30) | **Đạt** | Không còn "50%" ở lead, "12 tháng" ở tìm tin hay "4 nút" ở khảo sát. "Xin loại" và "09:00" chỉ còn ở chiến dịch mục đích khác (Nhắc mua lại), đúng D8-15 |
| 9 | Màu chip SLA theo 00 §3.4 | **Đạt** | Sắp quá: vàng đặc `#f5b301`, chữ tối. Quá hạn: đỏ đặc `#c4281c`, chữ trắng. Còn hạn: xanh lá nhạt. Tạm dừng / Chờ khách / Chờ chia: xám. Chip ngắn `12′` đúng dạng |
| 10 | Màu chip kênh theo 00 §3.2 (kiểu Nhạt) | **Đạt** | Zalo `#0068ff` (chữ `#0052cc`), OA `#087a4d`, Fanpage `#3b5998`, Bình luận `#c2410c`, Email `#c5221f`, Web `#0e7c86`, đều có icon. Chữ chip lệch 2 chỗ (QA-17, Nhẹ) |
| 11 | Khung app: người đăng nhập, avatar chữ tắt, menu theo vai (00 §2.2) | **Không** | Người đăng nhập khớp "Góc nhìn" và TD ở mọi khung. Avatar sai 2 người (QA-04). Menu sai vai / thiếu mục / không nhất quán (QA-01…03) |
| 12 | Nhãn "lệch / vênh / mâu thuẫn" còn sót sau khi đã quyết | **Không** | Search: nhãn OE đã được 00 v1.4.4 xử lý (QA-07). MkLeads, RoutingChange: nhãn lỗi thời / dữ liệu (QA-15, 16). MkDashboard: vênh chưa có quyết định (QA-08). "chênh lệch" ở Reports, Zns, Debt là thuật ngữ nghiệp vụ, không tính |
| 13 | Cùng khách / số tiền / mã / giờ khớp nhau và khớp `du-lieu-kiem-thu.md` | **Đạt** | KH-TEST-0030 / 0101 / 0301 / 0802 / 0901 / 0003 cùng tên ở mọi board. CN1 12.000.000 hạn 05/10 (T+6), CN3 12.500.000 quá 20, CN4 4.000.000 quá 45, CN5 180.000.000 quá 62 (hạn 29/07), CN6 1.800.000 quá 120 khớp TD. DH-2026-0456/0461/0470/0480/1180, BG-2026-0456 (650.000, WEB1), YCHD-0121/0123 khớp TD. Tên wireframe cũ (Hiệp Lễ, Mai Phạm, Gara Khoa Minh / KH-TEST-0388) nay đều có trong TD (FP1 "Mai Phạm", TD-K27) |
| 14 | Cách viết công nợ thống nhất (03 MH-SZ-07 #3) | **Đạt có ngoại lệ** | InfoPanel, InvoiceSend, Debt (góc KD, MH-HD-13) đúng mẫu `Công nợ: … ₫ · đến hạn dd/MM` / `· Quá hạn n ngày (hạn dd/MM)`; không còn `Quá hạn: 0 ₫`. Ngoại lệ: QA-10 (dòng Drawer HD-08) và đơn vị "đ" (QA-09) |
| 15 | Mục **Chặn** trong sổ xử lý có trên bản vẽ | **Đạt (5/5)** | KH P-SA #1: Merge có 2 nút "Là account liên quan", "Báo trùng trên VCsales" + tooltip chỉ đường; Customers có lọc "Chờ VCsales gộp mã". OAHDBC P-GD #1: OaAuto có "Chờ giám đốc bật" / "Có bản sửa chờ giám đốc bật", lọc "Chờ tôi bật (2)", "Bật bản sửa", "Trả lại". P-KT #1: Garage Thành Công "Chờ GĐ duyệt tạm hoãn" + "Owner đang trao đổi" ở Debt, "Đang chờ GĐ duyệt tạm hoãn" + dòng "Không tính: …" ở OaCampaign. SZMK P-GS #1: MkLeads có #26 Phân xử tranh chấp, #23a, Tag "Đang tranh chấp · còn [n] ngày". P-CS #1: Search góc Lan có dòng "Ngoài phạm vi" |
| 16 | Kỹ thuật: chữ cắt ở biên khung / đường cắt, chồng chữ, tràn ngang | **Đạt có ngoại lệ** | Chiều cao `canvas.json` = `$preview` = khung ở cả 31 file; nội dung vừa khung. 7 đường cắt (Debt 7900, Invoice 7760, Merge 7300, MkChatbot 6390, MkLeads 7710, OaCampaign 5260, Reports 7650) không cắt qua chữ; ảnh ghép hai phía khớp. Cặp X / XP2 chỉ khác 3 dòng. Không tràn ngang trang. Các cặp chữ "chồng" máy báo đều là chữ ẩn ngoài màn (left −9999) hoặc giờ xuống dòng, không chồng thật. Ngoại lệ: chữ bị cắt **trong thẻ** (QA-05, 06, 11, 12, 13) |

## 4. Cách kiểm

- Ảnh: Python Playwright, Chromium, viewport 1440, `full_page`, đã xóa dòng `<script src="./support.js">`. Mỗi board chụp hai ảnh:
  - ảnh có khung: `qa/<Board>_frame.png`;
  - ảnh bỏ khung để đo nội dung: `qa/<Board>_unclip.png`.

  Các file phần 2 chụp riêng: `qa/<Board>P2_frame.png`.
- Chữ bị cắt: lấy từng đoạn chữ bằng `Range.getClientRects`, so với tổ tiên có `overflow` khác `visible` và với đường cắt (chiều cao file X) / đáy khung (X + XP2). Chồng chữ: giao nhau > 3 px giữa hai đoạn chữ, loại trường hợp phía trên có nền đục (popover, modal).
- Khung app: tách `nav[aria-label="Điều hướng chính"]` và nút "Menu tài khoản" của 61 khung. So từng khung với cột vai ở 00 §2.2 (mục có chú thích điều kiện thì không bắt buộc). Script: `qa/frames.py`.
- Chip: đọc `getComputedStyle` của `span.ch` và `.sla`.
- Dữ liệu: trích chữ từng board (`qa/txt/*.txt`) rồi đối chiếu mã KH, số tiền, mã chứng từ với `du-lieu-kiem-thu.md`.
- Script và ảnh: `scratchpad/qa/` (`run2.py`, `p2.py`, `frames.py`, `chips.py`, `sla.py`, `res2.json`, `z_*.png`).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 04/10/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk2/qa.md) | — |
