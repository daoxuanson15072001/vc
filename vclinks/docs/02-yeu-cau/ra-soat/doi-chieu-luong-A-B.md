# VClinks — Buổi 8: Đối chiếu luồng A (Project) ↔ luồng B (repo), bản trình duyệt

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Đã duyệt 30/09/2026

## Tóm tắt

- Buổi 8: đối chiếu luồng A (Project) với luồng B (repo), BA (Claude) lập ngày 30/09/2026; chủ dự án đã duyệt cùng ngày.
- Khung gộp: luồng B là phần chi tiết của mảnh 1 (M1) trong lộ trình luồng A; tên lộ trình duy nhất là M1–M4 của A.
- Quy tắc xử lý vênh: quyết định chủ dự án đã chốt ở A thắng; B thắng về đặc tả màn hình, UAT, lô thiết kế và số liệu đo thật.
- Kết quả duyệt: D8-02…D8-08 (VC Zalo là phân hệ của VClinks, phạm vi M1a/M1b/M1c, quyền CSKH đọc hội thoại, tự gộp hồ sơ, VCdms là phân hệ VCsales, cách chạy VC Zalo); 29 chỗ vênh còn lại theo cột "BA đề xuất".
- Các mục 1–7 đối chiếu chi tiết theo chủ đề (lộ trình, hệ sinh thái, phân quyền, AI và dữ liệu, 13 QĐ 🔴, ánh xạ giai đoạn và vai), mã vênh V8-01…V8-36.
- Mục 9 rà hiểu nhầm "VC Zalo song song với VClinks": hiểu nhầm chỉ nằm trong tài liệu phân tích và kiến trúc, chưa đi vào sản phẩm; kèm danh sách sửa ở luồng A và B.
- Còn mở tại thời điểm lập: các đề xuất sửa ở mục 9.3, 9.4 ghi "chờ anh duyệt"; rủi ro máy Chrome driver là điểm hỏng đơn (R8-01).

## Mục lục

- [Kết quả duyệt (30/09/2026)](#kết-quả-duyệt-30092026)
- [0. Cách đọc](#0-cách-đọc)
- [1. Lộ trình và phạm vi](#1-lộ-trình-và-phạm-vi)
- [2. Hệ sinh thái và nguồn sự thật](#2-hệ-sinh-thái-và-nguồn-sự-thật)
- [3. Quy tắc và phân quyền (A giữ phân quyền nền theo D8-01)](#3-quy-tắc-và-phân-quyền-a-giữ-phân-quyền-nền-theo-d8-01)
- [4. AI, dữ liệu, phi chức năng](#4-ai-dữ-liệu-phi-chức-năng)
- [5. Câu trả lời cho 13 QĐ 🔴 của luồng B lấy từ quyết định luồng A](#5-câu-trả-lời-cho-13-qđ--của-luồng-b-lấy-từ-quyết-định-luồng-a)
- [6. Ánh xạ giai đoạn B → mảnh A (nếu anh chọn "M1 = MVP của B")](#6-ánh-xạ-giai-đoạn-b--mảnh-a-nếu-anh-chọn-m1--mvp-của-b)
- [7. Ánh xạ vai (A 9 vai chuẩn ↔ B)](#7-ánh-xạ-vai-a-9-vai-chuẩn--b)
- [8. Việc phát hiện thêm (không phải vênh A↔B)](#8-việc-phát-hiện-thêm-không-phải-vênh-ab)
- [9. Rà toàn bộ hiểu nhầm "VC Zalo song song với VClinks" (30/09)](#9-rà-toàn-bộ-hiểu-nhầm-vc-zalo-song-song-với-vclinks-3009)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Ngày: 30/09/2026 · Người lập: BA (Claude) · Trạng thái: **anh đã duyệt 30/09/2026** ("đồng ý cả 4" + D8-02, D8-07, D8-08 theo lời anh). Đã sửa luồng B: `ba/vclinks-ba.md` v0.5, `ba/README.md`, `quyet-dinh-chu-du-an.md`, `README.md`, `CLAUDE.md`.

## Kết quả duyệt (30/09/2026)

| Mã | Quyết định | Nguồn |
|---|---|---|
| D8-02 | VC Zalo là phân hệ của VClinks; huỷ D5-10 | Anh nói 30/09 |
| D8-03 | Phạm vi M1 = M1a (VC Zalo chạy thật) / M1b (tổ chức và khách, nền bảo mật, baseline) / M1c (bán hàng trong chat); Fanpage M2 | Câu 1 |
| D8-04 | CSKH đọc toàn văn hội thoại khách trong đội (trừ gia đình/bạn bè, có nhật ký); khách mới trên kênh chính thức do CSKH trực nhận trước | Câu 2 |
| D8-05 | Tự gộp hồ sơ chỉ khi đủ 3 điều kiện, có hoàn tác | Câu 3 |
| D8-06 | "Ai chăm hội thoại" ở VClinks; "ai hưởng doanh số, đi tuyến" ở VCsales | Câu 4 |
| D8-07 | VCdms là phân hệ của VCsales | Anh nói 30/09 |
| D8-08 | Cách chạy VC Zalo: M1 máy chủ Chrome driver ở công ty cho 10–15 nick; bán ngoài: khách đăng nhập trên trình duyệt của mình (định hướng) | Anh nói 30/09 |

29 chỗ vênh còn lại chạy theo cột "BA đề xuất" (anh không đổi mã nào).

## 0. Cách đọc

**Khung gộp (anh chốt 30/09):** luồng B là phần chi tiết của **mảnh 1 (M1)** trong lộ trình luồng A. Từ nay tên lộ trình duy nhất là M1–M4 của A.

**Quy tắc xử lý vênh** (D8-01 + khung gộp):
1. **Quyết định anh đã chốt ở A (D1-xx…D5-xx) thắng** nội dung BA viết ở B. Chỗ nào hai bên đều là quyết định của anh (ví dụ Q1, Q4 của B) thì anh chọn.
2. **B thắng** về đặc tả màn hình, UAT, lô thiết kế, và các số liệu đã đo thật.
3. BA tự quyết (BA-xx ở A, mặc định đặc tả ở B) không thắng quyết định; bên nào chi tiết hơn thì giữ.

Mã chỗ vênh mới: **V8-01…V8-36** (tiếp V4-xx, V5-xx). Cột "Thắng": **A** / **B** / **Anh chọn**. Cột "Sửa ở B" là việc sẽ làm sau khi anh duyệt.

Mức: 🔴 đổi phạm vi hoặc đổi quyết định lớn · 🟠 đổi quy tắc, con số · 🟢 đổi chữ, bổ sung.

---

## 1. Lộ trình và phạm vi

| Mã | Mức | Luồng A | Luồng B | Thắng | BA đề xuất · Sửa ở B |
|---|---|---|---|---|---|
| V8-01 | 🟢 | M1a/M1b/M2/M3/M4; "D1-xx" là quyết định Buổi 1 | MVP / GĐ2 / GĐ3; "D1/D2" là lô thiết kế | A (tên) | MVP → **M1**; GĐ2 → **M2/M3** theo bảng §6; GĐ3 → **M4**. Lô thiết kế D1/D2 đổi tên **TK1/TK2** để hết nhầm với mã quyết định. Lộ trình riêng kênh Zalo L0–L7 giữ tên |
| V8-02 | 🔴 | M1 hẹp: Zalo cá nhân + OA, hộp thư, lưu lịch sử, hồ sơ + liên kết định danh, nạp ERP, gợi ý AI, baseline. Gán luật, SLA, CSKH, bàn giao ở M2; báo giá ở M3 | MVP rộng: thêm cây tổ chức, owner, chia hội thoại, SLA, bàn giao, ticket CSKH OA, Fanpage, ghi âm → chữ, tìm toàn văn, liên kết mã KH, tra giá + gửi báo giá VCsales, báo cáo cơ bản | **Anh chọn** | **M1 = MVP của B** (đúng khung "B là chi tiết M1"), cộng các việc nền của A ở V8-03. Hệ quả: A Buổi 5 §5.1 phải sửa bảng mảnh sau (việc luồng A). Xem câu hỏi 1 |
| V8-03 | 🔴 | M1 bắt buộc (D5-07, D5-08, D5-09, D5-15, D3-09): thử kỹ thuật connector, cổng mức mật trước AI ngoài (VCL-AI-14), khoá mã hoá theo khách + huỷ khoá (ADM-14, 15), connector và bot chạy 24/7 lưu thô trước, bộ đệm ngoài văn phòng, nạp danh mục ERP ban đầu, baseline 2–4 tuần, `tenant_id`, event store (nhật ký sự kiện chỉ ghi thêm) | Không có các mục này trong §9, §19 | A | Thêm vào §2.2 (nguyên tắc), §9 (phi chức năng) và §19 dòng M1 như "nền M1". Không thêm màn hình mới |
| V8-04 | 🟠 | Gợi ý câu trả lời AI ở **M1** (VCL-AI-01; lộ trình Buổi 1 mảnh 1) | Nháp AI ở **GĐ2** (F7.3, KD-10, SZ-19) | A | Gợi ý AI vào M1, bật **sau** khi cổng mức mật chạy; tin có C3 không có gợi ý (D5-13). Đặc tả SZ-19 giữ nguyên, chỉ đổi mảnh |
| V8-05 | 🔴 | **D5-12:** Zalo cá nhân + Zalo OA ở M1; **Fanpage (Messenger + bình luận) ở M2** | Fanpage thật ở MVP; khung gửi Fanpage đã vẽ ở lô TK1 | **Anh chọn** (D5-12 là quyết định của anh) | Theo D5-12 thì Fanpage sang M2, bản vẽ TK1 giữ để dùng ở M2. Nếu anh muốn kéo lên M1 thì ghi D8-xx sửa D5-12. Xem câu hỏi 1 |
| V8-06 | 🟢 | D2-14 mobile-first cho sale; VCL-INB-09: web điện thoại ở M1, app ở M3 | QĐ-01 chưa chốt, BA đề xuất phương án B (bản tối thiểu ở MVP) | A | Trả lời **QĐ-01 = B** theo D2-14, INB-09. Bỏ "mobile web GĐ2" ở §9 |
| V8-07 | 🟠 | Kênh theo D5-12: chatbot web M2; TikTok, tổng đài có ghi âm M4; FB cá nhân và ZNS **có điều kiện** (sau thử kỹ thuật); không có email | FB cá nhân GĐ2; ZNS GĐ2 (QĐ-03 đề xuất ZNS lẻ lên MVP); email GĐ2 (Q3); chatbot GĐ3; không có tổng đài | A cho kênh A có; B giữ email | Chatbot web → M2. Tổng đài → M4 (thêm vào §16). Email giữ Q3, đặt **M3**. FB cá nhân → "có điều kiện, anh bật sau thử kỹ thuật" (OQ-42). QĐ-03: ZNS lẻ ở M1 được nếu anh chọn, vì D5-12 để ZNS "có điều kiện" |

## 2. Hệ sinh thái và nguồn sự thật

| Mã | Mức | Luồng A | Luồng B | Thắng | BA đề xuất · Sửa ở B |
|---|---|---|---|---|---|
| V8-08 | 🔴 | Báo giá tạo và duyệt trên **DMS** (B1 §1, INT-03, D4-24, T-12); DMS còn là nơi xin duyệt giảm giá, công nợ | **Q4:** báo giá tạo, sửa, chốt trên **VCsales**; VCdms chỉ lo tuyến, ghé thăm | **Anh chọn** (hai quyết định của anh) | Theo **Q4** (chốt sau, khớp hệ đang chạy). **Anh trả lời 30/09: VCdms sẽ nằm trong VCsales** → báo giá, duyệt giảm giá, duyệt công nợ, tuyến, ghé thăm đều ở VCsales (VCdms là phân hệ của VCsales). Sửa ở B: §1.1 gộp dòng VCdms vào VCsales. Luồng A sửa sau: mọi chữ "DMS" đọc là "VCsales (phân hệ VCdms)" |
| V8-09 | 🟠 | Tách vai (B1 §3.1, D2-12): hỏi giá → phiếu CSKH soạn báo giá → sale gửi; hỏi tồn, giá đơn giản sale trả lời (D4-22) | NVKD tự tạo báo giá trên VCsales và gửi (KD-07) | A ở M2, B ở M1 | M1: NVKD tự làm như KD-07. Từ M2 (có phân loại AI → phiếu), phiếu "hỏi giá / báo giá" chuyển CSKH theo D2-12. Ghi chú vào §5.6 |
| V8-10 | 🔴 | **D3-05:** khoá khách là **mã VClinks bất biến**; mã KH ERP là mã ngoài gắn thêm | §1.1 nguyên tắc 2: "Mã KH trong VC ERP là khóa khách hàng"; Q1: khoá liên kết là mã KH VCsales | A | Sửa chữ: mã VClinks là khoá; mã KH VCsales là **khoá liên kết** sang ERP (1–1 mỗi bộ ERP, BR11 giữ). Không đổi Q1 phần còn lại |
| V8-11 | 🔴 | **D4-03:** sau khi nạp ERP, VClinks là nơi đổi người phụ trách khách; không đồng bộ ngược; lệch hiện `erp_owner_mismatch` | **Q1:** VCsales có trường "NV phụ trách" thì owner đọc từ VCsales, VClinks không cho sửa | **Anh chọn** | Theo **D4-03**: nếu theo Q1 thì bàn giao nghỉ việc (GS-05, F12.4) và chuyển khách (F12.5) của chính B không làm được trên VClinks khi VCsales có trường này. Xem câu hỏi 3 |
| V8-12 | 🟠 | VCL-ADM-01: dùng chung **ORG/policy của VCwiki** (vai, đơn vị, nghỉ việc); 9 vai chuẩn (BA-33) | Cây tổ chức, người dùng, vai quản trị ngay trong VClinks (01 MH-PQ-01…03); SSO Google; QĐ-34 đối chiếu Google Directory; bộ vai riêng (nvkd, giam_sat, giam_doc, cskh, sale_admin, ke_toan, nv_thi_truong, marketing, admin, xem) | B (chi tiết hơn) + A (nguyên tắc một điểm kiểm quyền) | M1 dùng cây tổ chức của B; nguồn nhân sự đọc từ ORG VCwiki khi có API (đổi ADM-01 thành "đọc ORG VCwiki, VClinks giữ phân công riêng"). Thêm **bảng ánh xạ vai** §7 vào B §4 |
| V8-13 | 🟢 | Hệ sinh thái 4 mảnh: VC ERP, VC DMS, VClinks, VCwiki | Thêm VCinvoice, VCdms, Content engine VCwiki, 4 bộ ERP (VCsales, VCgarage, VCedu, VCCRM) | B | Giữ B. Luồng A cập nhật sau |

## 3. Quy tắc và phân quyền (A giữ phân quyền nền theo D8-01)

| Mã | Mức | Luồng A | Luồng B | Thắng | BA đề xuất · Sửa ở B |
|---|---|---|---|---|---|
| V8-14 | 🔴 | **D4-10:** CSKH xem hồ sơ **và hội thoại** của khách cả đội mình. **D5-03:** đội khác chỉ tóm tắt, phiếu, cảnh báo | 01 **D3**: CSKH không thấy hội thoại trên nick cá nhân của sale, trừ hội thoại gắn ticket (chỉ đọc). QĐ-05 đề xuất "tóm tắt + Cam kết đã nêu" | A (quyết định của anh) | Trả lời **QĐ-05 = theo D4-10**: CSKH đọc toàn văn hội thoại khách trong đội (rộng hơn cả phương án C). Sửa 01 D3, PQ chú thích (36), 02 MH-DK-09, 04 MH-OA-03. Nếu anh thấy D4-10 quá rộng thì ghi D8-xx sửa D4-10. Xem câu hỏi 2 |
| V8-15 | 🔴 | **D2-11, D4-19:** kênh dùng chung (OA, Fanpage): khách cũ → người phụ trách; khách mới → AI nhận diện đội + địa bàn → vòng tròn **sale** online, 5 phút nhận, tối đa 2 người → hàng chờ chung. CSKH là **chủ phiếu** (tầng 2, D3-02) | CSKH **trực** OA / Fanpage: hộp thư CSKH, trả lời hội thoại chưa phân công; lead giao NVKD theo quy tắc giao lead (05); khách có owner → về owner | **Anh chọn** | Ghép: khách có owner → owner (cả hai giống). Khách mới trên OA: **CSKH trực tiếp nhận trước** (B), giao sale theo quy tắc khu vực (QĐ-48) — vì A chưa có vai "CSKH trực kênh" và sale đi thị trường không trực OA được. Nếu anh giữ D2-11 thì bỏ hộp thư CSKH ở OA. Xem câu hỏi 2 |
| V8-16 | 🔴 | **D1-02:** gộp hồ sơ **chỉ gợi ý**, không tự gộp; nhân viên gộp và tách | BR05, F13.2: **tự gộp** khi trùng SĐT đã xác thực hoặc email; 02 chấm điểm tự gộp (L10, L11); QĐ-57 mở rộng tự gộp | **Anh chọn** (D1-02 là quyết định của anh) | Theo **D1-02**: điểm cao → gợi ý **một chạm**, người bấm; giữ nguyên thang điểm của 02 để xếp gợi ý. QĐ-57 = B. Nếu anh muốn tự gộp khi một phía là danh tính mới (02 L11) thì ghi D8-xx nới D1-02. Xem câu hỏi 2 |
| V8-17 | 🟠 | **D4-13:** sale tự nhận khách chưa ai chăm (bật), giám sát được báo, huỷ được | QĐ-43: NVKD tự nhận hội thoại chưa phân công **tắt** mặc định | A | Trả lời **QĐ-43 = bật** theo D4-13; giám sát huỷ được |
| V8-18 | 🟠 | **D4-20:** không ai trả lời lượt sau 10 phút → người thay tạm trả lời tạm **lượt đó**; "Nghỉ" hoặc vắng 2 giờ làm việc → giữ trọn; người thay tạm do giám sát đặt, xưng tên | TS-07: sale "Vắng" 30′ → **CSKH tạm giữ** (chỉ mẫu Giữ khách, 02 DK-24); "Trực nick" (PQ-44) do người giữ nick / GS đặt | A (số, cơ chế); B (tên màn hình "Trực nick") | "Trực nick" = người thay tạm của A, chạy T-07 = 10′, T-08 = 2 giờ. Bỏ TS-07. CSKH tạm giữ (DK-24) chỉ còn khi owner **chưa có** người thay tạm, thay cho "hàng chờ chung" của A |
| V8-19 | 🟠 | **D4-15:** mọi tin có nội dung: hạn phản hồi 15′ giờ làm việc; bình luận công khai 30′ (quảng cáo đang chạy 15′, T-24) | TS-02 CSKH tin đầu **30′**; TS-05 15′; TS-06 30′ | A | TS-02 = 15′. TS-05, TS-06 giữ (là mốc chuyển việc, không phải hạn phản hồi). Thêm TS bình luận theo T-24 |
| V8-20 | 🟠 | **D4-16:** Zalo cá nhân được **một câu "[Tin tự động]"** mỗi phiên khi sale "Nghỉ", chỉ trong hội thoại riêng (VCL-AI-12, BA-58) | ZR3, BR14: nick cá nhân **không tin tự động** | A | Thêm ngoại lệ vào ZR3, BR14: một câu vắng mặt, không vào nhóm, qua bộ giới hạn nhịp |
| V8-21 | 🟠 | **D4-16:** chatbot web tự phục vụ 24/7 (FAQ, tình trạng đơn sau xác thực, không báo giá); bot kịch bản ngoài giờ ở OA, Fanpage (M2) | QĐ-18: AI web **chỉ gợi ý**, tự trả lời sớm nhất GĐ3; F7.2 chatbot GĐ3 | A | Trả lời QĐ-18 theo D4-16; chatbot web và bot ngoài giờ → M2 |
| V8-22 | 🟠 | T-18: đóng phiên khi phiếu xong và khách im **2 ngày làm việc**; T-19 24 giờ làm việc nếu không có phiếu (D4-18) | TS-13: "Chờ khách" → "Đã xong" sau **7 ngày** (QĐ-49) | A | QĐ-49 = B với số theo T-18, T-19 |
| V8-23 | 🟠 | **D4-13:** không tự thu hồi; khách bị bỏ lâu chỉ cảnh báo giám sát theo T-31 = max(2 × chu kỳ mua, 90 ngày) | F12.8 30/60/90 ngày; QĐ-87 GS thu hồi từ nấc 60 ngày | A (ngưỡng); B (GS thu hồi tay) | Cảnh báo theo T-31; GS **tự tay** thu hồi được (A cho giám sát quyết). Bỏ nấc 30/60 |
| V8-24 | 🟠 | **D4-12, D5-04:** số C3 (công nợ, hạn mức, giá riêng) cho người phụ trách khách, CSKH **đang giữ phiếu**, giám sát, trưởng đội, kế toán, ban giám đốc | 01 chú thích (34): CSKH không thấy công nợ, chỉ đơn, giao hàng, hóa đơn | A | Sửa (34): CSKH giữ ticket mở thấy số C3 của khách đó (hiệu lực khi đọc C3 qua adapter) |
| V8-25 | 🟠 | **D3-14:** ẩn danh ≤ **72 giờ**; **D4-02:** người duyệt là giám sát cấp trên hoặc back office được chỉ định | TS-33 tạm **15 ngày**; PQ-50 GĐ division xác nhận "đúng khách" | A | TS-33 = 72 giờ (pháp chế chỉ được rút ngắn loại riêng). Người duyệt theo D4-02 |
| V8-26 | 🟢 | D2-09: ban giám đốc thấy tất cả, đọc nguyên văn | QĐ-24 đề xuất B: đọc nguyên văn phải chọn lý do, tóm tắt tuần | A (quyền) + B (nhật ký) | Quyền giữ; bước chọn lý do chỉ để ghi nhật ký, không chặn. QĐ-24 = B như thế |
| V8-27 | 🟢 | BA-36: xuất danh sách định danh do trưởng đội duyệt | QĐ-37: xuất kèm SĐT do kiểm soát nội bộ duyệt | Cả hai BA tự quyết | Kèm SĐT → kiểm soát nội bộ (QĐ-37); không SĐT → trưởng đội (BA-36) |
| V8-28 | 🟢 | BA-37: kế toán chỉ soạn nháp, không gửi | PQ-24, QĐ-75: kế toán gửi hóa đơn, mẫu "Thanh toán", ZNS nhắc nợ trên kênh chính thức | B (chi tiết hơn) | Giữ B; luồng A sửa BA-37 sau |

## 4. AI, dữ liệu, phi chức năng

| Mã | Mức | Luồng A | Luồng B | Thắng | BA đề xuất · Sửa ở B |
|---|---|---|---|---|---|
| V8-29 | 🔴 | **D2-15:** C3 không gửi AI ngoài, không qua MCP; AI local cho C3 từ M3 (D5-13) | §1.2: giám đốc hỏi Claude Desktop về "doanh số, công nợ" qua MCP; QĐ-12 mới nêu ẩn SĐT | A | §1.2 thêm nguyên tắc: **C3 không qua MCP, không tới AI ngoài**; ví dụ GD-06 bỏ "công nợ". QĐ-12 = A + cổng mức mật |
| V8-30 | 🟠 | Mô hình dữ liệu Buổi 3: 42 collection (bên khách tổ chức/cá nhân, liên kết định danh 4 trạng thái, phiên, cụm, phiếu, dòng nhu cầu, event store, mã VClinks) | §8 "sơ bộ": CustomerAccount / Contact / ChannelIdentity…; code thật có schema riêng | A (kiến trúc) | §8 ghi rõ "sơ bộ; mô hình chuẩn là Buổi 3 luồng A" + bảng ánh xạ tên thực thể. Không viết lại |
| V8-31 | 🟠 | **D2-14:** 80 người đồng thời; tin vào ≤ 5 s p95; 360 ≤ 3 s. NFR-19…22 (connector 24/7, sau khôi phục, RPO/RTO, C3 trước AI) | §9: ≥ 50 agent; tin vào ≤ 5 s; TS-14: Zalo qua extension ≤ 10 s p90 | A (số); B (số đo Zalo) | §9 lấy số A. Zalo qua extension: mục tiêu 5 s, **ngưỡng chấp nhận M1 10 s p90** (đề xuất, đo ở UAT). Thêm NFR-19…22 |
| V8-32 | 🟠 | **D2-15:** lưu **vĩnh viễn**; xoá chỉ bằng ẩn danh theo yêu cầu | F14.8: thời hạn lưu cấu hình theo loại, hết hạn xóa hoặc ẩn danh | A | F14.8: mặc định **vĩnh viễn** cho tin, hồ sơ; thời hạn chỉ áp cho loại pháp luật buộc (nhật ký…) |
| V8-33 | 🟠 | **D2-17:** đo baseline 2–4 tuần rồi mới chốt chỉ tiêu (OQ-10); KPI: 100% kênh nối, ≥ 90% tin trả lời trong VClinks, trung vị ≤ 15′, 0 tin > 2 giờ… | G1–G6; QĐ-94 đề xuất đặt chỉ tiêu ngay (G2 FRT ≤ 10′…) | A | QĐ-94 = C tới hết baseline, rồi A. Thêm bảng ánh xạ G1–G6 ↔ KPI D2-17 |
| V8-34 | 🟠 | **D2-12, D2-16:** AI phân loại tin → phiếu việc (M2); **D2-13** khách giận, hứa vượt chính sách → cảnh báo giám sát; **D2-07, D2-08, D3-10, D3-11**: KYC 4 khối, CHI, dòng nhu cầu | Không có phân loại AI → phiếu cho hội thoại sale; ticket chỉ tạo tay; không có KYC, CHI, cảm xúc; có phễu (F5.4), nhắc mua lại (F8.4) | A (bổ sung) | Thêm vào §5.4, §5.7 và lộ trình: phân loại AI, cảm xúc, leo thang → M2; dòng nhu cầu → M2; KYC khung M1, đủ ở M3; CHI → M3. Phễu, nhắc mua lại của B giữ |
| V8-35 | 🟠 | **D3-06, D5-10:** VCZALO chỉ là connector; kho VCZALO cũ nhập một lần, chạy song song 2 tuần, cắt khi lệch ≤ 0,1% | §21 câu 3: VCZALO → VCconnect → VClinks đã hợp nhất; connector là extension trong repo; không nhắc kho cũ | Anh chốt 30/09 | **VC Zalo là một phân hệ của VClinks** (kênh Zalo cá nhân: extension, connector, màn hình sale Zalo), không phải hệ riêng có kho riêng. Repo kiểm 30/09 khớp: VC Zalo ghi thẳng vào database `vclinks`; database cũ `vczalo`/`vcconnect` đã được API tự chuyển sang `vclinks` trên cùng máy chủ (`db.service.ts`, `legacy.ts`). → **D5-10 không áp** (không có hai kho để chạy song song); D3-06 đọc là "VC Zalo là connector của VClinks, không giữ kho riêng"; VCL-INT-10, INT-12 đóng. Sửa ở B: §11 đặt tên "Phân hệ VC Zalo (kênh Zalo cá nhân)"; README, CLAUDE.md của repo đang ghi "tên cũ: VCZALO" → sửa thành "VC Zalo là phân hệ" |
| V8-36 | 🟢 | GĐ5-01, BA-46: chưa chắc connector bắt được tin sale gửi từ điện thoại | UAT 29/09: tin gửi từ điện thoại vẫn đồng bộ về (§20); gửi 0,6–1,0 s | B (số đo) | Ghi vào A: GĐ5-01 phần chiều ra = **đã có dữ kiện**; chỉ số "% tin trả lời trong VClinks" đo được ở baseline |

---

## 5. Câu trả lời cho 13 QĐ 🔴 của luồng B lấy từ quyết định luồng A

| QĐ | Trả lời theo A | Căn cứ |
|---|---|---|
| QĐ-01 | B (bản tối thiểu trên điện thoại ở M1) | D2-14, VCL-INB-09 |
| QĐ-05 | CSKH đọc toàn văn hội thoại khách trong đội | D4-10 (chờ câu hỏi 2) |
| QĐ-06 | Phần CSKH gửi thẳng: D5-01 (Zalo của CSKH), D4-23 (trong nhóm); phần ai nhận khách mới trên OA: chờ câu hỏi 2 | D5-01, D4-23, D2-11 |
| QĐ-07 | A (mọi nguồn tính SLA, KPI) | G-16, BA-46 |
| QĐ-12 | A + cổng mức mật; C3 không qua MCP | D2-15, D5-13, VCL-AI-14 |
| QĐ-02, 03, 04, 08, 09, 10, 11, 13 | A không có quyết định tương ứng → vẫn chờ anh | — |

QĐ 🟠, 🟢 trả lời được từ A: QĐ-18 (D4-16), QĐ-24 (V8-26), QĐ-43 (D4-13), QĐ-49 (T-18), QĐ-54 = A (D4-20 xưng tên), QĐ-57 (D1-02), QĐ-87 (D4-13), QĐ-94 (D2-17), TS-02, TS-07, TS-13, TS-33.

## 6. Ánh xạ giai đoạn B → mảnh A (nếu anh chọn "M1 = MVP của B")

| B | A | Nội dung chính |
|---|---|---|
| Đã có + MVP | **M1** | Zalo cá nhân hoàn thiện, Zalo OA, cây tổ chức + phân quyền, owner, chia hội thoại, SLA, bàn giao, ticket CSKH OA, ghi âm → chữ, tìm kiếm, gộp gợi ý, liên kết mã KH, tra giá + gửi báo giá VCsales, báo cáo cơ bản, nhật ký; **cộng nền V8-03, gợi ý AI V8-04** |
| GĐ2 (phần luồng tin, AI, kênh) | **M2** | Fanpage + bình luận (D5-12), chatbot web, bot ngoài giờ, phân loại AI → phiếu, cảm xúc, leo thang, dòng nhu cầu, nhóm Zalo trả lời, ticket nâng cao, NĐ 13 vận hành, xuất dữ liệu |
| GĐ2 (phần tích hợp, 360) | **M3** | Khối thương mại VCsales đủ, C3 qua adapter, CHI, KYC đủ, VCinvoice, VCdms, email, MCP cho nhân viên, app điện thoại |
| GĐ3 | **M4** | Chiến dịch, khảo sát, hội thoại mẫu, deal, TikTok, tổng đài, kênh sàn, tenant không ERP |

## 7. Ánh xạ vai (A 9 vai chuẩn ↔ B)

| A (BA-33) | B | Ghi chú |
|---|---|---|
| `sale` | NVKD | |
| `cskh` | CSKH (+ cờ Trưởng nhóm) | |
| `giam_sat` | Giám sát bán hàng (quản lý tổ) | |
| `truong_doi` | Giám đốc bán hàng / GĐ division | "Đội" của A = "division" của B |
| `ban_giam_doc` | Ban giám đốc (Viewer), kiểm soát nội bộ | |
| `back_office` | Sale admin | |
| `ke_toan` | Kế toán | |
| `ho_tro` | Marketing (NVMK, TMK); bảo hành | |
| `quan_tri_he_thong` | Admin hệ thống | A: không xem nội dung (BA-54) |
| — | NV thị trường (VCdms) | A chưa có; thêm vai thứ 10 hoặc gộp `sale` (QĐ-32 = A: hai vai khác nhau) |

## 8. Việc phát hiện thêm (không phải vênh A↔B)

- Repo: `docs/vclinks-ba.md` đang ở trạng thái **đã xoá**, bản mới nằm ở `docs/02-yeu-cau/vclinks-ba.md` nhưng cả thư mục `docs/02-yeu-cau/` **chưa commit**. Link `../vclinks-ba.md` trong `ba/README.md` và link tương đối trong `vclinks-ba.md` (§11.8: `zalo-web-feature-map.md`, `uat-2026-09-29/…`) đang trỏ sai sau khi dời. Một số ảnh UAT cũng đang ở trạng thái xoá.
- Sổ góp ý `review/so-gop-y.md` được README nhắc nhưng không có trong thư mục.

---

## 9. Rà toàn bộ hiểu nhầm "VC Zalo song song với VClinks" (30/09)

**Sự thật (anh chốt 30/09, đề xuất ghi D8-02):** VC Zalo là **một phân hệ của VClinks**: phân hệ kênh Zalo cá nhân, gồm extension trên Zalo Web (chạy trong Chrome driver), connector, và các màn hình sale Zalo (03, MH-SZ). VC Zalo dùng chung lõi, hộp thư và database `vclinks` của VClinks, không có kho tin riêng, không có đăng nhập riêng.

**Phạm vi đã rà:** 4 lớp tài liệu × 2 luồng, cộng code.

| Lớp | Đã rà |
|---|---|
| Phân tích nghiệp vụ (BA) | A: Buổi 1, 2, 2b, 3, 4, 5, 00 Buổi 5, trạng thái dự án · B: `ba/vclinks-ba.md`, `ba/README.md`, `quyet-dinh-chu-du-an.md` |
| Thiết kế hệ thống | A: Buổi 3 (mô hình dữ liệu), Buổi 5 (lộ trình, kiến trúc, ATAM) · B: `CLAUDE.md` (đặc tả kỹ thuật), `README.md`, `chrome-driver.md`, `mcp-client-guide.md`, `dev-mcp.md`, `zalo-web-*.md` |
| Đặc tả tính năng (màn hình, UAT) | B: `ba/00…07-*.md`, `uat-2026-09-29/README.md` |
| Giao diện thiết kế | Canvas "VClinks UI Design": `canvas.json` + 73 artboard |
| Code | `apps/*/src`, `apps/*/test` (grep) |

### 9.1 Kết quả theo lớp

| Lớp | Chỗ hiểu nhầm | Chỗ đúng | Kết luận |
|---|---|---|---|
| **BA luồng A** | B2: INB-01 "Zalo cá nhân (qua VCZALO)", §9 "VCZALO cho Zalo cá nhân", §10 M1 "chi phí thấp vì VCZALO đang có". 2b: A2 "Connector VCZALO nhận tin", §15.1 câu 6 "connector VCZALO" (dùng như tên connector, nhẹ) | B1: lộ trình mảnh 1 "VC Zalo: tích hợp Zalo cá nhân vào VClinks" | **Mầm hiểu nhầm nằm ở B2**: từ đây VCZALO được viết như một công cụ ngoài có sẵn |
| **Thiết kế hệ thống luồng A** | B3: D3-06 "VCZALO chỉ là connector; kho VCZALO hiện có nhập một lần rồi ngừng ghi"; §9.7 "Nhập kho VCZALO", các bước đẩy song song; VCL-INT-10; E52, E53; `external_ids.system = vczalo`; `company_accounts.connector = vczalo`; OQ-29c; §6.4 khoá "Tin nhập kho VCZALO". B5: **D5-10** (song song 2 tuần, cắt ≤ 0,1%); GĐ5-04; M1a "thử đường đẩy VCZALO"; giai đoạn "Song song VCZALO" T0+5→T0+7; VCL-INT-11 (một dòng), VCL-INT-12; BA-67; E67; S5-05; kịch bản A2 cả bài; A1 chỗ gãy 1; §7.1; §7.4; D5-15 "xong trước song song"; sơ đồ phụ thuộc, đường găng | — | **Nặng.** Cả một nhánh kiến trúc và lộ trình (cắt chuyển, đối soát hai kho) dựng trên giả định sai |
| **BA luồng B** | `vclinks-ba.md` §21 câu 3 "VCZALO → VCconnect → VClinks: đã hợp nhất". `ba/README.md` "Sale dùng VCzalo" không định nghĩa | `vclinks-ba.md` §10, §11 mô tả Zalo cá nhân là một kênh, connector theo hợp đồng C1–C7 | Nhẹ: chỉ sai cách gọi, cấu trúc đúng |
| **Thiết kế hệ thống luồng B** | `CLAUDE.md` §1, `README.md` dòng 3: "VClinks (tên cũ VCZALO, rồi VCconnect)"; README mục "Nâng cấp từ VCZALO / VCconnect"; `mcp-client-guide.md` đặt tên server MCP là `"vczalo"`, biến `VCZALO_AUTH` | CLAUDE.md §2: extension đẩy vào VClinks API qua REST, một database `vclinks` | Trung bình: đọc thành "VClinks là VCZALO đổi tên". Kiến trúc thật đúng (một hệ, một kho) |
| **Đặc tả tính năng luồng B** | Không có chỗ sai | 03 dòng 1 và 22: "VCzalo là **phần Zalo cá nhân của VClinks**: Dashboard + VClinks Extension"; 00 dòng 2166 chỉ là chuyển khoá lưu trữ cũ | **Đúng** |
| **Giao diện thiết kế** | 0 chỗ | Logo, thanh trên, đăng nhập đều là "VClinks" (403 lần). Không có mục menu, đăng nhập hay logo riêng cho VC Zalo. Zalo cá nhân nằm trong "Hội thoại" chung và "Kết nối kênh"; màn Omnichannel ghi "mỗi kênh là một connector cắm vào lõi chung · Zalo cá nhân — Extension trên Zalo Web" | **Đúng.** Chỉ thiếu tên "VC Zalo" ở nơi nào cả; nếu anh muốn phân hệ có tên hiển thị thì là việc thêm |
| **Code** | Chú thích `legacy.ts` (extension, web), `db.service.ts`: "project was renamed VCZALO → VCconnect → VClinks" | Chức năng: chuyển database và khoá lưu trữ cũ về `vclinks`, một hệ | Chỉ chú thích; không đổi hành vi |
| **Em (Claude), sáng 30/09** | V8-35 bản đầu kết luận "VCZALO là tên cũ của repo" | — | Đã sửa |

### 9.2 Vì sao hiểu nhầm lan

1. B1 viết đúng: "VC Zalo: tích hợp Zalo cá nhân vào VClinks".
2. B2 viết "Zalo cá nhân (qua VCZALO)" và "VCZALO đang có", biến VC Zalo thành một công cụ ngoài có sẵn.
3. B3 hỏi anh "VCZALO chỉ là connector?". Câu hỏi đã giả định có kho VCZALO riêng, nên câu trả lời "đúng" của anh (D3-06) bị hiểu thành "có kho cũ phải nhập".
4. B5 dựng cả kế hoạch cắt chuyển, đối soát, giai đoạn song song trên giả định đó (D5-10).
5. Ở repo, README và CLAUDE.md ghi "tên cũ VCZALO", làm người đọc hiểu VClinks là VCZALO đổi tên. Hai cách hiểu sai (A: hệ riêng song song; B: tên cũ) cùng che mất cách hiểu đúng: **phân hệ**.

**Chỗ không bị ảnh hưởng:** đặc tả màn hình, UAT, canvas thiết kế và code đều dựng đúng một hệ, một kho, Zalo cá nhân là một kênh. Nghĩa là hiểu nhầm chỉ nằm trong tài liệu phân tích và kiến trúc, **chưa đi vào sản phẩm**.

### 9.3 Sửa ở luồng A (đề xuất, chờ anh duyệt)

| Loại | Mã | Xử lý |
|---|---|---|
| **Huỷ** | D5-10, GĐ5-04, OQ-29c, VCL-INT-12, BA-67, E67, S5-05, kịch bản A2 Buổi 5, giai đoạn "Song song VCZALO", phần "chạy song song" của E52 | D8-02 huỷ D5-10; các mã phụ thuộc đóng, không cấp lại số |
| **Đọc lại** | D3-06 | "VClinks là kho tin duy nhất; VC Zalo là phân hệ kênh Zalo cá nhân, ghi thẳng vào lõi qua đường ingest chung" |
| **Đọc lại** | VCL-INT-10, E53, BA-19 | Chỉ còn "nhập dữ liệu cũ": chat, cuộc gọi đã lưu trên máy chủ (B1 §6). Database cũ của chính VClinks đã tự chuyển |
| **Đổi tên trường** | `company_accounts.connector = vczalo`; `external_ids.system = vczalo` | `connector = zalo_extension`; bỏ `vczalo` khỏi danh sách hệ ngoài |
| **Đổi chữ** | B2 INB-01, §9, §10; 2b A2, §15.1 | "qua VCZALO" → "qua phân hệ VC Zalo (extension)" |
| **Lộ trình** | Buổi 5 §5.1, §5.2, §7.4 | Bỏ giai đoạn song song, M1 ngắn đi khoảng 2 tuần (đề xuất). Đường găng mới: M1a → M1b → baseline → M2. D5-15 "xong trước song song" → "xong trước khi mở gửi cho cả đội (QĐ-04)". §7.4 giữ việc nối Zalo của VCsoft, VCe từ M1 với lý do BD-1 |
| **Rủi ro mới lộ ra** | D5-08, D5-15, R5-02 | Connector của VC Zalo là **Chrome có đăng nhập Zalo Web trên một máy**. Bộ đệm ngoài văn phòng (D5-15) chỉ đỡ webhook OA, Fanpage, web, **không đỡ Zalo cá nhân**. Máy chạy Chrome driver là điểm hỏng đơn của kênh lớn nhất → thêm R8-01; hỏi anh Hùng nơi đặt Chrome driver, ai trực |
| **Dữ kiện đã có** | GĐ5-01, M1a | UAT 29/09: gửi 0,6–1,0 s; tin gửi từ điện thoại vẫn về. M1a chỉ còn thử thu hồi, mã tin nhóm, giới hạn tần suất |

### 9.4 Sửa ở luồng B (đề xuất, chờ anh duyệt)

| File | Sửa |
|---|---|
| `README.md`, `CLAUDE.md` §1 | Bỏ "tên cũ VCZALO, rồi VCconnect"; ghi "VClinks là nền tảng; **VC Zalo** là phân hệ kênh Zalo cá nhân". Mục "Nâng cấp từ VCZALO / VCconnect" → "Nâng cấp database cũ (`vczalo`, `vcconnect`)" |
| `ba/vclinks-ba.md` | §10 thêm cột "Phân hệ" (Zalo cá nhân = VC Zalo); §11 tiêu đề "Phân hệ VC Zalo (kênh Zalo cá nhân)"; §21 câu 3 ghi D8-02 thay cho "đã hợp nhất" |
| `ba/README.md` | Một dòng định nghĩa VC Zalo như 03 dòng 22 |
| `mcp-client-guide.md` | Tên server MCP `"vczalo"` → `"vclinks"`, biến `VCZALO_AUTH` → `VCLINKS_AUTH` |
| Chú thích code `legacy.ts`, `db.service.ts` | "renamed VCZALO → …" → "database/khóa cũ của phân hệ VC Zalo và bản VCconnect" (chỉ chú thích, không đổi hành vi) |
| Canvas thiết kế | Không phải sửa. Tuỳ anh: có muốn tên "VC Zalo" hiện ở đâu không (ví dụ màn "Kết nối kênh" ghi "Zalo cá nhân · VC Zalo") |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 04/10/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/doi-chieu-luong-A-B.md) | — |
