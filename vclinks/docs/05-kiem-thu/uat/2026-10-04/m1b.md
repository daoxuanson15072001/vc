# Biên bản UAT M1b (phiên M1b-16)

Phiên bản 0.5 · 05/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Đã đối chiếu 169 ca UAT thuộc phạm vi M1b (113 ca phân quyền 01 §7.2, giao diện chung 00, khách 02, hộp thư 03) với bộ dữ liệu TD: **74 Đạt, 0 Trượt, 37 Chờ người thử, 58 Ngoài phạm vi** (sau hai phiên sửa lỗi M1b-17 và M1b-18; lúc đầu 67 / 13 / 31 / 58) (ca đã ghi ⛔ ở sổ phiên hoặc thuộc M1c trở đi, không tính trượt).
- **Ca "không được thấy" (tiêu chí M1 của 01): 29/29 đạt.** Hai ca từng trượt (PQ-27, PQ-108, lỗi L-02: số điện thoại hoặc email gõ trong nội dung tin) đã sửa ở phiên M1b-17 theo phương án mặc định: che mọi dãy giống SĐT và mọi email trong nội dung tin, có nút "Hiện" ghi nhật ký (chủ dự án chưa trả lời, chờ xác nhận). Mọi ca còn lại, gồm ma trận 12 người × 5 kênh, đều đạt bằng test tự động.
- Đã sửa 1 lỗi nhỏ ngay trên nhánh: cuộc gọi MCP thật chưa ghi người dùng và mã hội thoại vào nhật ký, nên "Hoạt động của tôi" và tra theo mã không thấy lượt AI đọc (PQ-88, L-04).
- Phiên M1b-17 đã sửa L-01 (một phần), L-02, L-03, L-05 (một phần), L-06; L-07, L-08 xử lý bằng cách sửa đặc tả khớp giao diện. Phiên bổ sung M1b-18 sửa nốt 3 ca còn trượt: PQ-70 (nút Tạo yêu cầu quyền hộ), PQ-72 (ngăn kéo Phạm vi ảnh hưởng), PQ-82 (token nhóm Đọc, nhắc khóa); nay đạt bằng test tự động (`uat-m1b-18.e2e-spec.ts`), phần giao diện chờ chủ dự án bấm thử.
- 31 ca cần người bấm trên giao diện: checklist 33 dòng ở mục "Checklist cho chủ dự án", mỗi dòng một việc. Có sẵn lệnh dựng môi trường thử riêng (database `vclinks_uat_m1b`, API cổng 3116, web cổng 5176) và liên kết đăng nhập cho 12 người TD; không đụng :3000 và không ghi vào database thật.
- Tiêu chí "mỗi khách có một owner" chưa chốt được: danh mục VCsales mô phỏng có 5 khách mà người phụ trách không khớp người dùng nào; cần file nhân sự thật (E4) và VCsales thật (E5). "Mọi người dùng VCparts đăng nhập được" cần Google thật (E3, dòng CL-28).
- Không đo được trên dữ liệu thật: lệnh sao chép database thật bị chặn nên chưa có số "mở 360 ≤ 3 giây trên dữ liệu thật" (M1b-13). Cần người có quyền chạy lệnh sao chép rồi `pnpm --filter @vclinks/api measure:360`.
- Người duyệt cần xem kỹ: mục Lỗi L-02 (quyết cách che số trong tin), L-07 (giữ thanh menu biểu tượng hay làm đúng đặc tả thu gọn/phím tắt) và bảng ca "không được thấy".

## Mục lục

- [1. Phạm vi và cách chạy](#1-phạm-vi-và-cách-chạy)
- [2. Ca "không được thấy"](#2-ca-không-được-thấy)
- [3. Bảng ca](#3-bảng-ca)
- [4. Checklist cho chủ dự án](#4-checklist-cho-chủ-dự-án)
- [5. Danh sách lỗi](#5-danh-sách-lỗi)
- [6. Tiêu chí xác nhận xong của M1b-16](#6-tiêu-chí-xác-nhận-xong-của-m1b-16)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Phạm vi và cách chạy

**Phạm vi:** phần M1b của các đặc tả: 01 §7.2 (phân quyền), 00 §7.5 và các ca UAT-UI của khung, đăng nhập, Ctrl+K, trang lỗi; 02 §11 (Customer 360, đối chiếu mã KH, bàn giao); 03 UAT-SZ-54, 86, 87; UAT-BC-17. Ca ghi ⛔ ở dòng M1b-01…15 của `docs/01-quan-ly-du-an/m1/so-phien.md`, ca của kênh OA, Fanpage, Facebook cá nhân, báo giá, ticket, chiến dịch, hóa đơn (M1c trở đi) và ca cần Zalo thật trên điện thoại (TT-02) ghi **Ngoài phạm vi**. Số hiệu ca lấy theo nội dung trong đặc tả (số UAT-PQ của `01-phan-quyen.md` và `01-P-AD.md` có chỗ lệch nhau; đã ghi ở M1b-03).

**Cách chạy:**

- Tự động: `pnpm ci:local` (kiểm kiểu, test đơn vị, test e2e API trên database tạm `vclinks_test_<ngẫu nhiên>`, tự xóa sau khi chạy, không đụng database `vclinks`). Kết quả lần chạy cuối: `pnpm ci:local` xanh lần 2 (lần 1 có 1 test đỏ do máy tải nặng, xem L-09): kiểm kiểu, test đơn vị (shared 149, vcsale-client 4, web 71, extension 291, api), e2e API 403/403 test, 43/43 bộ.

- Ca mới viết ở phiên này: `apps/api/test/e2e/uat-m1b-khong-duoc-thay.e2e-spec.ts` (39 test).
- Người bấm: lệnh dựng môi trường thử ở mục 4.

**Bằng chứng viết tắt:**

| Mã | File | Nội dung |
|---|---|---|
| E-AT | `apps/api/test/e2e/authz-td.e2e-spec.ts` | Quyền trên dữ liệu TD (M1b-04/05) |
| E-KT | `apps/api/test/e2e/uat-m1b-khong-duoc-thay.e2e-spec.ts` | Ma trận "không được thấy" 12 người × 5 kênh, đổi tổ, hết hạn quyền, khách khác division, nhật ký chỉ đọc, hiệu năng 5.000 hội thoại (M1b-16, mới) |
| E-MX | `apps/api/src/authz/matrix.spec.ts + authz-routes.e2e-spec.ts` | 1.641 ô ma trận 01 §3, quét route |
| E-ORG | `apps/api/test/e2e/org.e2e-spec.ts, org-td.e2e-spec.ts` | Cây tổ chức, người dùng, nhập lô, khóa, hẹn giờ đổi tổ |
| E-AU | `apps/api/test/e2e/auth.e2e-spec.ts` | Đăng nhập Google (giả lập Google), phiên |
| E-TC | `apps/api/test/e2e/tokens-channel.e2e-spec.ts` | Token MCP, thiết bị gắn nick, thu hồi, nick lạ |
| E-AA | `apps/api/test/e2e/audit-alerts.e2e-spec.ts` | Nhật ký truy cập, cảnh báo R1…R9 |
| E-SH | `apps/api/test/e2e/shell.e2e-spec.ts` | Ctrl+K, /me, trạng thái |
| E-IN | `apps/api/test/e2e/inbox.e2e-spec.ts` | Hộp thư theo phạm vi, SLA |
| E-GR | `apps/api/test/e2e/grants-td.e2e-spec.ts` | Quyền tạm thời, đăng ký vắng, trực thay |
| E-HO | `apps/api/test/e2e/handover-td.e2e-spec.ts` | Khóa ngay, nghỉ việc, bàn giao |
| E-CTD | `apps/api/test/e2e/customers-td.e2e-spec.ts, src/customers/merge-rules.spec.ts` | Mô hình khách, nạp VCsales mock, gộp |
| E-C360 | `apps/api/test/e2e/customer-360.e2e-spec.ts` | Customer 360, dòng thời gian, SĐT theo quyền |
| E-CK | `apps/api/test/e2e/customer-keys.e2e-spec.ts, src/security/gate.spec.ts` | Khóa theo khách, cổng mức mật |
| E-KPI | `apps/api/test/e2e/kpi-baseline.e2e-spec.ts` | Baseline KPI |
| W-WEB | `apps/web/src/utils/nav.test.ts, permissions.test.ts, timeline.test.ts, time.test.ts` | Menu theo vai trò, quyền, dòng thời gian, giờ Việt Nam |

## 2. Ca "không được thấy"

Tiêu chí M1 của 01: "100% ca không được thấy trong UAT §7 đạt". Danh sách dưới là mọi ca mà người dùng KHÔNG được thấy dữ liệu (hội thoại, khách, tin, số điện thoại, token, thiết bị) và thuộc M1b. Bằng chứng nằm ở bảng ca.

| Ca | Kết quả |
|---|---|
| UAT-PQ-02 | Đạt |
| UAT-PQ-04 | Đạt |
| UAT-PQ-06 | Đạt |
| UAT-PQ-08 | Đạt |
| UAT-PQ-15 | Đạt |
| UAT-PQ-16 | Đạt |
| UAT-PQ-17 | Đạt |
| UAT-PQ-19 | Đạt |
| UAT-PQ-20 | Đạt |
| UAT-PQ-22 | Đạt |
| UAT-PQ-23 | Đạt |
| UAT-PQ-27 | Trượt |
| UAT-PQ-32 | Đạt |
| UAT-PQ-35 | Đạt |
| UAT-PQ-39 | Đạt |
| UAT-PQ-47 | Đạt |
| UAT-PQ-50 | Đạt |
| UAT-PQ-51 | Đạt |
| UAT-PQ-56 | Đạt |
| UAT-PQ-61 | Đạt |
| UAT-PQ-66 | Đạt |
| UAT-PQ-71 | Đạt |
| UAT-PQ-85 | Đạt |
| UAT-PQ-91 | Đạt |
| UAT-PQ-108 | Trượt |
| UAT-UI-38 | Đạt |
| UAT-UI-39 | Đạt |
| UAT-DK-14 | Đạt |
| UAT-DK-18 | Đạt |

**Kết quả: 29/29 đạt.** Ma trận tự động trong E-KT kiểm 12 người × 5 hội thoại: người không được xem nhận 403, không lộ tên hay nội dung, không gửi được, không có lệnh nào được tạo, danh bạ nick khác trả rỗng. Hai ca PQ-27 và PQ-108 đạt sau khi sửa L-02 (M1b-17).

## 3. Bảng ca

Cột Giao diện là dòng checklist (mục 4) để người xem phần màn hình.

| Mã ca | Kết quả | Bằng chứng | Ghi chú | Giao diện |
|---|---|---|---|---|
| UAT-PQ-01 | Đạt | E-ORG | Phần lỗi "Tổ bán hàng chỉ đặt dưới Division hoặc Tổ bán hàng." đạt ở API | CL-11 |
| UAT-PQ-02 | Đạt | E-AT |  | CL-01 |
| UAT-PQ-03 | Chờ người thử | E-KT (phần engine, xem PQ-08) | Thông báo "Quyền đã cập nhật cho n người" và kéo thả chưa có test | CL-31 |
| UAT-PQ-04 | Đạt | E-AT |  | CL-03 |
| UAT-PQ-05 | Chờ người thử | E-AU (giả lập Google) | Cần Google thật (E3) | CL-28 |
| UAT-PQ-06 | Đạt | E-AT, W-WEB |  | CL-02 |
| UAT-PQ-07 | Đạt | E-ORG |  | CL-12 |
| UAT-PQ-08 | Đạt | E-KT | Nhật ký ghi `user.update` kèm `detail.change = unit` (M1b-17, L-06); không có `owner.change` |  |
| UAT-PQ-09 | Đạt | E-KT | Tab "Quyền hiệu lực" trên trang người dùng (M1b-17, L-01): ✔/✖ kèm lý do, không hiện nội dung tin |  |
| UAT-PQ-10 | Ngoài phạm vi | — | Vai trò tùy chỉnh chưa làm; M1b-05 chỉ làm màn vai trò chỉ đọc |  |
| UAT-PQ-11 | Chờ người thử | — | Màn /admin/roles chỉ đọc (M1b-05) | CL-32 |
| UAT-PQ-12 | Chờ người thử | — | Gán kênh (MH-PQ-06): chưa có ca tự động riêng | CL-33 |
| UAT-PQ-13 | Chờ người thử | — | Cảnh báo gán chéo division: chưa có ca tự động riêng | CL-33 |
| UAT-PQ-14 | Đạt | E-TC | Marketing không nhận mức "Người giữ nick" |  |
| UAT-PQ-15 | Đạt | E-AT, E-KT, E-IN | Chỉ nick của mình; không thấy hội thoại nick khác (kênh OA/FB: ngoài M1b) | CL-04 |
| UAT-PQ-16 | Đạt | E-AT, E-KT | Link thẳng sang hội thoại nick khác: 403, không lộ tên/nội dung | CL-05 |
| UAT-PQ-17 | Đạt | E-AT, E-KT | Danh sách nick khác: 200 rỗng, gửi: 403, không có lệnh nào được tạo |  |
| UAT-PQ-18 | Ngoài phạm vi | — | Cần điện thoại thật nhận tin (chờ TT-02) |  |
| UAT-PQ-19 | Đạt | E-AT, E-KT |  | CL-07 |
| UAT-PQ-20 | Đạt | E-AT, E-KT |  | CL-08 |
| UAT-PQ-21 | Ngoài phạm vi | — | Nhận hội thoại OA: kênh OA (M2/M4) |  |
| UAT-PQ-22 | Đạt | E-KT | Phần "không được thấy" đạt (VCedu không thấy khách và hội thoại VCparts). Mục "Owner ở division khác … Nhắn nội bộ" chưa làm | CL-09 |
| UAT-PQ-23 | Đạt | E-C360 | Phần M1b: không có khối Công nợ, Báo giá khi không phải owner. Nút "Gửi báo giá" thuộc M1c-02 |  |
| UAT-PQ-24 | Ngoài phạm vi | — | Marketing trả lời lead (M4) |  |
| UAT-PQ-25 | Đạt | E-C360 | Owner thấy SĐT đầy đủ, không có `phone.reveal` | CL-10 |
| UAT-PQ-26 | Đạt | E-AT, E-C360 | Hiện → số đầy đủ, nhật ký không có số; 60 giây tự ẩn là phần giao diện | CL-10 |
| UAT-PQ-27 | Đạt | E-KT | Sau M1b-17 (L-02): Giám sát đọc "0900 *** 950" thay số thật, mail "mi***@example.vn"; nút Hiện ghi `phone.reveal` không kèm số |  |
| UAT-PQ-28 | Đạt | E-AA |  |  |
| UAT-PQ-29 | Ngoài phạm vi | — | Xuất danh sách khách có SĐT (M2) |  |
| UAT-PQ-30 | Đạt | E-AT, E-GR | Người duyệt là Giám đốc bán hàng khác tổ |  |
| UAT-PQ-31 | Ngoài phạm vi | — | Trả lời qua OA (M2/M4) |  |
| UAT-PQ-32 | Đạt | E-KT | Quyền "Xem" hết hạn tự đóng, không có ô soạn; thời hạn tối đa 3 ngày là phần giao diện | CL-15 |
| UAT-PQ-33 | Đạt | E-AT, E-GR | GS không tự duyệt yêu cầu của mình |  |
| UAT-PQ-34 | Đạt | E-GR |  |  |
| UAT-PQ-35 | Đạt | E-GR | Thu hồi → mất quyền ngay; hộp "Bạn không còn quyền xem" là phần giao diện | CL-15 |
| UAT-PQ-36 | Đạt | E-GR | "Trực thay tối đa 30 ngày." |  |
| UAT-PQ-37 | Chờ người thử | E-GR (một phần) | Chỉ thấy tab "Thay đổi vai trò chờ duyệt" | CL-26 |
| UAT-PQ-38 | Ngoài phạm vi | — | Bot web, duyệt phát hành (M4) |  |
| UAT-PQ-39 | Đạt | E-AT, E-KT | Ban giám đốc đọc được, có nhật ký, không có ô soạn và không gửi được | CL-26 |
| UAT-PQ-40 | Đạt | E-ORG, E-HO | Khóa ngay: phiên, token thiết bị, lệnh gửi chờ |  |
| UAT-PQ-41 | Đạt | E-HO | Bàn giao khách và nick, owner đổi ngay |  |
| UAT-PQ-42 | Chờ người thử | E-HO (một phần) | Khách vào "Chưa phân công" của tổ, GS giữ nick tạm: chưa có ca riêng | CL-17 |
| UAT-PQ-44 | Ngoài phạm vi | — | Marketing và lead Fanpage (M4) |  |
| UAT-PQ-45 | Ngoài phạm vi | — | Thẻ lead chatbot web (M4) |  |
| UAT-PQ-46 | Ngoài phạm vi | — | Kế toán, yêu cầu hóa đơn (M5) |  |
| UAT-PQ-47 | Đạt | E-KT, E-C360 | Sale admin không thấy tin trong dòng thời gian (DK-18). Phần sự kiện báo giá, đơn, hóa đơn thuộc M1c |  |
| UAT-PQ-48 | Ngoài phạm vi | — | Vai trò Trợ lý tra cứu (chưa có trong M1) |  |
| UAT-PQ-49 | Ngoài phạm vi | — | Marketing, chiến dịch (M4) |  |
| UAT-PQ-50 | Đạt | E-TC | Token MCP của Minh chỉ thấy nick của Minh, SĐT che, chỉ đọc | CL-14 |
| UAT-PQ-51 | Đạt | E-TC | Thiết bị chỉ đọc/ghi nick được gắn |  |
| UAT-PQ-52 | Đạt | E-TC | Thu hồi → 401 ngay, có người thực hiện |  |
| UAT-PQ-53 | Ngoài phạm vi | — | Nháp đã duyệt qua MCP (M1c-06) |  |
| UAT-PQ-54 | Ngoài phạm vi | — | Nháp AI trên hội thoại (M1c-06) |  |
| UAT-PQ-55 | Ngoài phạm vi | — | Xóa tin khỏi VClinks (M2, NĐ 13) |  |
| UAT-PQ-56 | Đạt | E-AT, E-KT | Admin không đọc được tin nào, vẫn thấy trạng thái kênh | CL-08 |
| UAT-PQ-57 | Ngoài phạm vi | — | Tra khách theo mã cho Admin (MH-PQ-13, giữ ngoài M1 theo kế hoạch §8 câu 4) |  |
| UAT-PQ-58 | Ngoài phạm vi | — | Thu hồi tin: cần điện thoại thật (M1a-06, chờ TT-02) |  |
| UAT-PQ-59 | Ngoài phạm vi | — | Xuất báo cáo (M1c-09) |  |
| UAT-PQ-60 | Đạt | E-AA | Ngăn kéo chi tiết có địa chỉ IP, chỉ Admin và Quan sát thấy (M1b-17, L-03) |  |
| UAT-PQ-61 | Đạt | E-AT, E-KT | GĐ VCparts không thấy người VCedu | CL-03 |
| UAT-PQ-62 | Đạt | E-KT, E-AA | Không có đường xóa/sửa nhật ký (API trả 403/404/405, đặc tả ghi 405) |  |
| UAT-PQ-63 | Đạt | E-ORG | 4 lỗi đúng dòng; nhập file sạch được 56 người | CL-13 |
| UAT-PQ-64 | Ngoài phạm vi | — | Nhập từ Google Workspace Directory (chưa làm) |  |
| UAT-PQ-65 | Đạt | E-ORG, E-AT | Không tự sửa quyền của mình; vai trò nhạy cảm cần người thứ hai |  |
| UAT-PQ-66 | Đạt | E-TC | Admin không tạo/xem token MCP của người khác | CL-14 |
| UAT-PQ-67 | Đạt | E-HO |  |  |
| UAT-PQ-68 | Đạt | E-HO | Nick "Chưa an toàn" tới khi xác nhận |  |
| UAT-PQ-69 | Ngoài phạm vi | — | R11 (gửi từ thiết bị khác sau nghỉ việc): M1b-11 ghi chưa làm |  |
| UAT-PQ-70 | Đạt | E-KT, E-GR | Tra theo mã, tên hoặc SĐT, trả mã + tên viết tắt + ✔/✖ + "Cách thấy" + người duyệt, ghi `permission.explain`. M1b-18: nút "Tạo yêu cầu quyền hộ" (`POST /api/admin/users/:id/grant-request`) tạo yêu cầu chờ duyệt nhân danh người được kiểm tra, không tự cấp quyền, báo người đó, Admin không tự duyệt được | |
| UAT-PQ-71 | Đạt | E-GR | Xin quyền theo SĐT trả cùng một câu dù SĐT có hay không |  |
| UAT-PQ-72 | Đạt | E-AA | R5, R6 đạt (M1b-17). M1b-18: ngăn kéo "Phạm vi ảnh hưởng" (`GET /api/admin/tokens/:id/impact`): số lần gọi, số hội thoại và mã hội thoại, IP, 20 lần gọi gần nhất; không có chuỗi token hay nội dung tin | |
| UAT-PQ-73 | Ngoài phạm vi | — | Phiếu xóa/xuất NĐ 13 (M2) |  |
| UAT-PQ-74 | Ngoài phạm vi | — | Đồng bộ khóa từ Google: M1b-11 ghi chưa làm |  |
| UAT-PQ-75 | Đạt | E-TC | Mã ghép 10 phút, token không ai thấy |  |
| UAT-PQ-76 | Chờ người thử | E-TC (một phần) | Gán mức "Người giữ nick" cho GS: chưa có ca riêng | CL-33 |
| UAT-PQ-77 | Ngoài phạm vi | — | Lời mời kết bạn trực thay: cần Zalo thật (TT-02) |  |
| UAT-PQ-78 | Ngoài phạm vi | — | Hộp "vừa gửi trên nick này": cần điện thoại thật (TT-02) |  |
| UAT-PQ-79 | Chờ người thử | E-GR (một phần) | SĐT ẩn khi trực thay: chưa có ca riêng | CL-16 |
| UAT-PQ-80 | Ngoài phạm vi | — | Gán nick theo thẻ (chưa làm) |  |
| UAT-PQ-81 | Đạt | E-ORG, E-HO |  |  |
| UAT-PQ-82 | Đạt | E-AA | Cờ Sắp nghỉ, Tag, R7 (M1b-17). M1b-18: đặt cờ thì token MCP đang có của người đó hạ xuống nhóm "Đọc" ngay (xóa cache), không tạo được nhóm "Đề xuất"; tới ngày nghỉ dự kiến nhắc GĐ, Admin, QS mỗi ngày một lần (không tự khóa). Xin quyền tạm thời báo QS qua R7 | |
| UAT-PQ-83 | Ngoài phạm vi | — | Doanh số 12 tháng trong bàn giao: M1b-11 ghi chưa làm |  |
| UAT-PQ-84 | Ngoài phạm vi | — | Nhắc 2 giờ, đẩy lên 4 giờ yêu cầu quyền (chưa làm) |  |
| UAT-PQ-85 | Đạt | E-GR | GS nhận thông báo một dòng; không có Thu hồi, có Đề nghị xem lại | CL-15 |
| UAT-PQ-86 | Đạt | E-AA |  |  |
| UAT-PQ-87 | Đạt | E-AA |  |  |
| UAT-PQ-88 | Đạt | E-AA, E-TC | Sau khi sửa L-04: cuộc gọi MCP thật ghi `userId` và `targets` |  |
| UAT-PQ-89 | Ngoài phạm vi | — | Duyệt xuất dữ liệu (M2) |  |
| UAT-PQ-90 | Ngoài phạm vi | — | Lead Fanpage (M4) |  |
| UAT-PQ-91 | Đạt | E-TC | Nick lạ: không ai thấy, từ chối thì xóa dữ liệu |  |
| UAT-PQ-92 | Đạt | E-AA | Tổng quan kiểm soát (overview) |  |
| UAT-PQ-93 | Đạt | E-ORG | Phần dữ liệu: hẹn giờ đổi tổ khác division thành yêu cầu duyệt |  |
| UAT-PQ-94 | Ngoài phạm vi | — | Cấu hình thời hạn lưu (M2) |  |
| UAT-PQ-95 | Đạt | E-HO |  |  |
| UAT-PQ-96 | Ngoài phạm vi | — | Tạm giữ khách khi owner Đi thị trường (M1c) |  |
| UAT-PQ-97 | Đạt | E-SH | Chỉ phần trạng thái Đi thị trường có hạn (M1b-08); khóa ô soạn/tạm giữ ngoài M1b | CL-18 |
| UAT-PQ-98 | Ngoài phạm vi | — | Mẫu tin OA (M2) |  |
| UAT-PQ-99 | Đạt | E-GR |  | CL-16 |
| UAT-PQ-100 | Ngoài phạm vi | — | Chiến dịch, ủy quyền duyệt (M4) |  |
| UAT-PQ-101 | Ngoài phạm vi | — | Chiến dịch (M4) |  |
| UAT-PQ-102 | Ngoài phạm vi | — | Ticket hậu mãi (M1c-03) |  |
| UAT-PQ-103 | Ngoài phạm vi | — | Kế toán, phiếu (M5) |  |
| UAT-PQ-104 | Ngoài phạm vi | — | Mẫu xác nhận đơn (M1c) |  |
| UAT-PQ-105 | Ngoài phạm vi | — | CSKH trả lời thay (OA, M2) |  |
| UAT-PQ-106 | Ngoài phạm vi | — | Lead marketing (M4) |  |
| UAT-PQ-107 | Ngoài phạm vi | — | Cần xem lại gán chéo (chưa làm) |  |
| UAT-PQ-108 | Đạt | E-KT | Cùng gốc PQ-27, đã sửa: tin, trích dẫn và dòng xem trước đều che số / email |  |
| UAT-PQ-109 | Ngoài phạm vi | — | Xoay vòng token Chrome driver (M1a) |  |
| UAT-PQ-110 | Ngoài phạm vi | — | Cấu hình thời hạn lưu nhật ký (M2) |  |
| UAT-PQ-111 | Ngoài phạm vi | — | Cần màn "Tạm gán" chưa có (M1b-05 ghi chưa làm) |  |
| UAT-PQ-112 | Ngoài phạm vi | — | Chặn / hủy kết bạn: cần Zalo thật (TT-02) |  |
| UAT-PQ-113 | Ngoài phạm vi | — | Cần màn chưa có (M1b-05 ghi chưa làm) |  |
| UAT-PQ-114 | Ngoài phạm vi | — | Tìm theo SĐT (M1c-05) |  |
| UAT-UI-01 | Chờ người thử | E-AT, W-WEB (nav.test: 10 vai trò) | Menu đúng theo vai trò ở dạng dữ liệu; hình dạng thật cần mắt người | CL-19 |
| UAT-UI-02 | Chờ người thử | W-WEB | Như UI-01, vai trò Admin | CL-19 |
| UAT-UI-03 | Chờ người thử | — | Đặc tả đã sửa khớp thanh biểu tượng cố định (M1b-17, L-07); người thử xác nhận |  |
| UAT-UI-04 | Chờ người thử | — | Đặc tả đã sửa: không có Alt+M (L-07); người thử xác nhận |  |
| UAT-UI-05 | Chờ người thử | — | Đặc tả đã sửa (L-07); người thử xác nhận |  |
| UAT-UI-06 | Ngoài phạm vi | — | Cần hai tài khoản kênh cùng một người (TD-FB1); môi trường thử chỉ có 1 nick mỗi người |  |
| UAT-UI-07 | Ngoài phạm vi | — | Chuông và đếm thông báo: M1c-07 |  |
| UAT-UI-08 | Chờ người thử | — | Có nút giao diện tối ở thanh bên (không nằm trong menu avatar) | CL-20 |
| UAT-UI-09 | Chờ người thử | E-AU (đăng xuất kết thúc phiên) |  | CL-20 |
| UAT-UI-10 | Chờ người thử | — | Đặc tả đã sửa: tiêu đề "VClinks", "(n)" chỉ khi tab ẩn (L-08); người thử xác nhận |  |
| UAT-UI-11 | Chờ người thử | E-AU (giả lập Google) | Cần Google thật | CL-28 |
| UAT-UI-12 | Chờ người thử | E-AU | Cần Google thật | CL-28 |
| UAT-UI-13 | Chờ người thử | E-AU | Cần Google thật | CL-28 |
| UAT-UI-14 | Chờ người thử | — |  | CL-29 |
| UAT-UI-15 | Chờ người thử | E-AU (token sai) |  | CL-29 |
| UAT-UI-16 | Chờ người thử | E-AU |  | CL-29 |
| UAT-UI-17 | Chờ người thử | E-AU, E-HO (phiên bị khóa → 401) |  | CL-29 |
| UAT-UI-18 | Chờ người thử | E-AU (AUTH_TOKEN_LOGIN) |  | CL-29 |
| UAT-UI-25 | Chờ người thử | E-SH (API) |  | CL-21 |
| UAT-UI-26 | Ngoài phạm vi | — | Tìm tin nhắn: M1c-05 |  |
| UAT-UI-27 | Ngoài phạm vi | — | Nhảy tới tin: M1c-05 |  |
| UAT-UI-28 | Chờ người thử | E-SH, E-KT | Khách ngoài phạm vi: không thấy tên | CL-21 |
| UAT-UI-29 | Chờ người thử | E-SH | SĐT luôn che | CL-21 |
| UAT-UI-30 | Chờ người thử | — |  | CL-21 |
| UAT-UI-38 | Đạt | W-WEB (rolesWithKey), E-AT | Danh sách vai trò trong trang không có quyền | CL-02 |
| UAT-UI-39 | Đạt | E-AT | Hội thoại ngoài phạm vi và hội thoại không tồn tại trả cùng một câu 403 | CL-05 |
| UAT-UI-40 | Đạt | E-AT | Người duyệt là Giám đốc bán hàng; lý do trống bị từ chối | CL-06 |
| UAT-UI-41 | Chờ người thử | — | Trang 404 tại chỗ | CL-22 |
| UAT-UI-42 | Chờ người thử | — | Trang lỗi 500 | CL-22 |
| UAT-UI-67 | Đạt | E-C360 | VCsales tắt: giữ bản cũ, in nghiêng, đúng câu ERR-ERP |  |
| UAT-UI-80 | Chờ người thử | — | Màn hình điện thoại 390×844 | CL-29 |
| UAT-UI-81 | Chờ người thử | — | Giữ nháp khi hết phiên: chưa rõ có làm | CL-29 |
| UAT-UI-121 | Chờ người thử | — | Mất mạng | CL-22 |
| UAT-UI-127 | Chờ người thử | W-WEB (time.test: giờ Việt Nam) | Đổi múi giờ máy sang Tokyo để thử | CL-30 |
| UAT-UI-128 | Ngoài phạm vi | — | Realtime, dải mất kết nối: M1c-07 |  |
| UAT-UI-129 | Chờ người thử | — | Đặc tả đã sửa: chưa có chế độ gọn (L-07); người thử xác nhận |  |
| UAT-UI-130 | Chờ người thử | — | Đặc tả đã sửa: chỉ Ctrl+K, Alt+P, Alt+A (L-07); người thử xác nhận |  |
| UAT-UI-131 | Ngoài phạm vi | E-KT (phần API đạt: 5.000 hội thoại, danh sách ≤ 3 giây) | Phần giao diện (cuộn mượt, danh sách ảo) cần dữ liệu TD-H90 nạp thử, chưa có lệnh nạp |  |
| UAT-DK-13 | Đạt | E-C360 |  | CL-23 |
| UAT-DK-14 | Đạt | E-C360, E-KT | Phần CS và Fanpage thuộc M2/M4 | CL-23 |
| UAT-DK-15 | Đạt | E-C360 | Phần Fanpage thuộc M4 | CL-23 |
| UAT-DK-16 | Ngoài phạm vi | — | Fanpage (M4) |  |
| UAT-DK-17 | Đạt | E-C360, W-WEB |  | CL-23 |
| UAT-DK-18 | Đạt | E-C360 | Người không có quyền chỉ thấy "n tin", không thấy nội dung | CL-23 |
| UAT-DK-25 | Ngoài phạm vi | — | M1b-13 ghi chưa làm |  |
| UAT-DK-26 | Ngoài phạm vi | — | M1b-13 ghi chưa làm |  |
| UAT-DK-27 | Đạt | E-CTD |  | CL-24 |
| UAT-DK-38 | Ngoài phạm vi | — | M1b-13 ghi chưa làm |  |
| UAT-DK-67 | Đạt | E-HO | Chia đều bỏ người Vắng và Nghỉ phép |  |
| UAT-DK-73 | Đạt | E-C360 |  | CL-23 |
| UAT-DK-79 | Đạt | E-C360, W-WEB (timeline) |  | CL-23 |
| UAT-DK-87 | Đạt | E-CTD | GĐ xem không xác nhận được, GS bị từ chối | CL-24 |
| UAT-SZ-54 | Đạt | E-GR | Trực thay: người trực thấy và gửi từ nick được giao | CL-16 |
| UAT-SZ-86 | Ngoài phạm vi | — | Chờ VCsales thật (E5) |  |
| UAT-SZ-87 | Đạt | E-IN | 5′ không chip, 12′ "⏰ 3′", 20′ "Quá 5′" | CL-25 |
| UAT-BC-17 | Ngoài phạm vi | — | Cần driver, nick đỏ (M1a) |  |

## 4. Checklist cho chủ dự án

Mỗi dòng một việc. Đánh dấu Đạt hoặc Trượt rồi ghi chú. Dòng nào thấy khác mô tả thì chụp màn hình gửi lại.

**Chuẩn bị một lần** (nhờ phiên điều phối hoặc làm trong cửa sổ dòng lệnh, ở thư mục `/Users/apple/projects/vclinks-wt/M1b-16`; nhánh `m1/M1b-16-uat-m1b` cho tới khi gộp):

1. `pnpm uat:m1b --reset` — tạo database thử riêng `vclinks_uat_m1b` (không phải database thật), nạp 12 người TD, 4 nick Zalo giả, 1 OA giả, khách mẫu và danh mục VCsales mô phỏng; in ra **12 liên kết đăng nhập**, mỗi người một dòng. Lệnh từ chối chạy nếu trỏ vào database thật (`vclinks`, `vczalo`, `vcconnect`) hoặc không ghi tên database. Liên kết đăng nhập chỉ dùng cho database thử, đừng lưu ra file hay gửi đi.
2. Cửa sổ API: `MONGO_URI=mongodb://localhost:27017/vclinks_uat_m1b AUTHZ_DEFAULT_DIVISION=TD-DV-VCP VCSALE_MODE=mock OUTBOX_DISPATCHER=off PORT=3116 LEGACY_DB_NAMES= node apps/api/dist/main.js`
3. Cửa sổ web: `cd apps/web && VCLINKS_API=http://localhost:3116 npx vite --port 5176 --strictPort`
4. Mở liên kết đăng nhập của từng người trong **cửa sổ ẩn danh riêng** (mỗi người một cửa sổ, để không lẫn phiên). Phiên hết sau 12 giờ không dùng; chạy lại bước 1 để có liên kết mới.
5. Môi trường này không nối Zalo thật: nick là giả, bấm Gửi tin sẽ không tới khách nào. Dashboard :3000 đang chạy dữ liệu thật nên không có 12 người TD; riêng dòng CL-28 (đăng nhập Google) làm trên :3000.
6. Thử lại từ đầu: chạy lại bước 1 (có `--reset`). Các dòng CL-17 và CL-33 làm thay đổi dữ liệu thử.

**Ai là ai:** Quân = Admin · Vinh = Ban giám đốc (kiểm soát) · Thắng = Giám đốc bán hàng VCparts · Hương = Giám sát Tổ HN1 · Đức = Giám sát Tổ HN2 · Minh, Linh = NVKD Tổ HN1 (nick Minh VCparts, Linh VCparts) · Hải = NVKD Tổ HN2 · Thu = CSKH · Ngọc = Sale admin · Lộc = Giám đốc VCedu · Trang = NVKD VCedu.

| Dòng | Đăng nhập bằng | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| CL-01 | Hương (GS Tổ HN1) | Menu Quản trị, tab "Cây tổ chức". | Chỉ có nhánh Tập đoàn, VCparts, Tổ HN1. Không có nút "Thêm đơn vị", "Sửa", "Ngừng", "Nhập từ file". | PQ-02 |
| CL-02 | Minh (NVKD) | Nhìn menu trái. Rồi gõ vào thanh địa chỉ `/admin/audit`. | Menu không có mục "Quản trị". Trang hiện "Bạn không có quyền truy cập trang này" kèm nút "Về Hộp thư". | PQ-06, UI-38 |
| CL-03 | Thắng (Giám đốc VCparts) | Quản trị, tab "Người dùng". Gõ "Trang" vào ô tìm. | Hiện "Không có người dùng nào khớp bộ lọc". Không có nút "+ Thêm người". | PQ-04, PQ-61 |
| CL-04 | Minh | Mở "Tin nhắn". | Chỉ có 3 khách: Chị Hạnh, Anh Tuấn Minh Phát, Kiên. Không có khách của Linh, Hải, Trang. | PQ-15, 16, 17 |
| CL-05 | Minh | Dán vào thanh địa chỉ `http://localhost:5176/conversations/9000000000004%3A9100960` (khách của Hải). Rồi dán `/conversations/zalo%3Akhongco`. | Hai lần hiện giống hệt nhau: "Không tìm thấy hoặc bạn không có quyền xem", có nút "Xin quyền truy cập". Không có chữ "Anh Hòa". | UI-39, PQ-16 |
| CL-06 | Minh | Ở trang vừa mở bấm "Xin quyền truy cập". Để trống Lý do, bấm "Gửi yêu cầu". Rồi nhập lý do, gửi lại. | Lần trống bị chặn. Lần có lý do gửi được, người duyệt là "Trịnh Văn Thắng". | UI-40 |
| CL-07 | Hương, rồi Đức (GS Tổ HN2) | Mở "Tin nhắn". Đức dán thêm `/conversations/9000000000001%3A9101101`. | Hương thấy khách của nick Minh và nick Linh, không thấy khách của Hải. Đức chỉ thấy khách của Hải. Đức mở link nick Minh: không có quyền. | PQ-19 |
| CL-08 | Ngọc (Sale admin), Quân (Admin), Thu (CSKH) | Mở "Tin nhắn". Quân mở thêm "Kênh kết nối". | Ngọc và Quân: danh sách hội thoại trống. Quân vẫn thấy trạng thái các kênh. Thu chỉ thấy kênh OA, không thấy nick bán hàng nào. | PQ-20, PQ-56 |
| CL-09 | Trang (NVKD VCedu) | Mở "Tin nhắn" và "Khách hàng". | Chỉ có "Phụ huynh Lan". Không có khách nào của VCparts. | PQ-22 |
| CL-10 | Minh, rồi Hương | Khách hàng, mở "Garage Minh Phát". | Minh thấy số 0900 000 101 đầy đủ, không có nút "Hiện". Hương thấy "0900 *** 101" và nút "Hiện"; bấm thì hiện số, khoảng 60 giây sau tự ẩn lại. | PQ-25, 26, DK-13 |
| CL-11 | Quân | Quản trị, "Cây tổ chức", "Thêm đơn vị": Tên "Tổ bán hàng HN3", Loại "Tổ bán hàng", Thuộc "Division VCparts", Lưu. Rồi thêm đơn vị khác Loại "Tổ bán hàng" nhưng Thuộc "Nhóm CSKH VCparts". | Lần 1: "Đã thêm đơn vị Tổ bán hàng HN3.". Lần 2 không lưu được, lỗi dưới ô Thuộc: "Tổ bán hàng chỉ đặt dưới Division hoặc Tổ bán hàng." | PQ-01 |
| CL-12 | Quân | Người dùng, mở Linh, thêm vai trò "NVKD" tại "Nhóm CSKH VCparts". | Lỗi "Vai trò NVKD phải đặt ở Tổ bán hàng." và không lưu. | PQ-07 |
| CL-13 | Quân | Người dùng, "Nhập từ file", chọn file `docs/05-kiem-thu/du-lieu-mau/nguoi-dung-vcparts-60-dong-loi.csv`. | Tóm tắt báo 4 lỗi đúng dòng; dòng của Quân báo "Không sửa được quyền của chính bạn."; nút Nhập bị khóa, chưa có gì được ghi. | PQ-63 |
| CL-14 | Minh, rồi Quân | Minh: vào `/settings/tokens`, tạo token tên "Claude Desktop". Quân: Quản trị, tab "Token & thiết bị". | Minh: token hiện đúng một lần, kèm lời nhắc sao chép; đóng rồi không xem lại được. Quân: không thấy chuỗi token của Minh, không có mục "Token MCP cho người dùng". | PQ-50, PQ-66 |
| CL-15 | Ngọc, Thắng, Hương | Ngọc: Quản trị, "Quyền tạm thời", xin xem hội thoại `9000000000001%3A9101101`. Thắng: duyệt. Ngọc mở hội thoại đó. Thắng: thu hồi. | Ngọc chỉ chọn được quyền "Xem", tối đa 3 ngày. Sau duyệt Ngọc đọc được nhưng không có ô soạn. Hương nhận một dòng thông báo. Sau thu hồi Ngọc mất quyền trong 60 giây. | PQ-32, 35, 85 |
| CL-16 | Minh, Hương, Linh | Minh: "Quyền tạm thời", "Đăng ký vắng". Hương: đồng ý và giao Linh trực nick Minh. Linh mở "Tin nhắn". Không bấm gửi tin. | Hiện "Đã giao Trần Thùy Linh trực thay Nguyễn Văn Minh từ … đến …". Linh thấy khách của nick Minh. Minh nhận thông báo. | PQ-99, SZ-54, PQ-79 |
| CL-17 | Thắng | Người dùng, mở Linh, "Nghỉ việc…". Làm theo các bước, chọn Hải nhận khách và nick của Linh, xác nhận. Lưu ý: bước này đổi dữ liệu thử. | Có danh sách thiết bị và lệnh gửi bị giữ. Xong hiện "Đã bàn giao … cho Phạm Văn Hải". Hải thấy khách cũ của Linh; Linh không đăng nhập được nữa; nick báo "Chưa an toàn" tới khi xác nhận. | PQ-42, 67, 68, 95 |
| CL-18 | Minh | Vào `/me`, đổi trạng thái sang "Đi thị trường" có hẹn giờ. | Trạng thái hiện đúng; hết hạn tự về "Trực tuyến". | PQ-97 |
| CL-19 | Minh, Hương, Thắng, Quân, Ngọc, Vinh | Nhìn menu trái của từng người. | Mỗi người chỉ thấy các mục hợp vai trò: NVKD không có Quản trị; Admin có Quản trị, Kênh kết nối, Đồng bộ; không ai thấy mục mình không được dùng. | UI-01, UI-02 |
| CL-20 | Minh | Bấm biểu tượng mặt trăng ở thanh bên rồi bấm F5. Sau đó vào `/me`, bấm "Đăng xuất", rồi bấm nút Back của trình duyệt. | Giao diện tối vẫn giữ sau F5. Sau đăng xuất, Back đưa về trang đăng nhập, không xem lại được dữ liệu cũ. | UI-08, UI-09 |
| CL-21 | Minh, rồi Thắng | Nhấn Ctrl+K. Gõ "a"; gõ "minh phat" không dấu; gõ `0900000960`. | "a": "Nhập ít nhất 2 ký tự để tìm.". Gõ tên không dấu ra đúng khách. Với SĐT 0900000960 (khách của Hải) Minh không mở được hồ sơ và không thấy số đầy đủ; Thắng thấy khách với SĐT dạng ẩn "0900 *** 960". | UI-25, 28, 29, 30 |
| CL-22 | Minh, Quân | Minh: gõ `/khong-co-trang-nay`. Quân: tắt cửa sổ chạy API, mở `/sync`, bật lại API, bấm "Thử lại". Ngắt wifi rồi tải lại một trang. | "Không tìm thấy trang" kèm nút "Về trang chính". "Có lỗi xảy ra" khi API tắt, hết lỗi sau "Thử lại". "Không có kết nối mạng" khi mất wifi. | UI-41, 42, 121 |
| CL-23 | Minh, rồi Hải | Minh: Khách hàng, mở "Garage Minh Phát"; trong "Tin nhắn" mở khách đó, nhấn Alt+P. Hải mở cùng khách (nếu thấy). | Trang Customer 360 có hồ sơ, danh tính, dòng thời gian gộp theo giờ, khối Thương mại (số mô phỏng VCsales, ghi rõ là dữ liệu cũ khi VCsales tắt). Hải (không phải owner) không thấy khối Công nợ và Báo giá. | DK-13…18, 73, 79, UI-67 |
| CL-24 | Thắng, rồi Hương | Thắng: menu "Đối chiếu mã KH". Hương nhìn menu và thử vào `/customers/erp-matching`. | Thắng xem được danh sách nhưng không có nút "Xác nhận". Hương không có mục này, vào thẳng bị chặn. | DK-87, 27 |
| CL-25 | Minh | Mở "Tin nhắn" NGAY sau khi chạy `pnpm uat:m1b --reset` (trong khoảng 3 phút). | Chị Hạnh (5 phút) không có chip; Anh Tuấn Minh Phát (12 phút) có chip "⏰ 3′"; Kiên (20 phút) có chip "Quá 5′". Số phút tăng dần theo đồng hồ. | SZ-87 |
| CL-26 | Vinh (Ban giám đốc) | Mở một hội thoại bất kỳ. Rồi vào Quản trị, "Quyền tạm thời". | Đọc được; không có ô soạn tin, không có nút gửi. Trong "Quyền tạm thời" chỉ có tab "Thay đổi vai trò chờ duyệt". | PQ-37, 39 |
| CL-27 | Hương, rồi Minh | Hương: Quản trị, "Nhật ký truy cập", tra theo tên Minh. Minh: vào `/settings/activity`. | Hương xem được. Minh thấy dòng "Giám sát Nguyễn Thị Hương đã xem nhật ký của bạn". Nhật ký không có số điện thoại đầy đủ hay nội dung tin. | PQ-86, 28 |
| CL-28 | Chủ dự án (tài khoản Google công ty) | Trên Dashboard :3000 (cần cấu hình Google đã xong): mở `/login`, bấm "Đăng nhập bằng Google" bằng tài khoản công ty đã có trong Người dùng; lần khác bằng Gmail ngoài; lần khác bằng email công ty chưa được thêm. | Tài khoản đã thêm vào được, header hiện tên. Gmail ngoài: "Chỉ tài khoản @vcprosperous.com được đăng nhập VClinks. Bạn đang dùng …". Chưa thêm: "Tài khoản … chưa được cấp quyền dùng VClinks. Liên hệ Admin hệ thống để được thêm vào." | PQ-05, UI-11…13 |
| CL-29 | Không cần đăng nhập | Mở `/login`. Bấm "Đăng nhập" khi ô token trống; dán `abc`; thu hẹp cửa sổ dưới 768 px. | "Nhập token"; "Token không hợp lệ hoặc đã bị thu hồi."; khi cửa sổ hẹp chỉ còn nút Google, ẩn ô token. Token chỉ dành cho thiết bị (nếu có): báo "Token hợp lệ nhưng không có quyền "dashboard"." | UI-14…18, 80, 81 |
| CL-30 | Minh | Mở một hội thoại, rê chuột lên giờ của bong bóng tin. | Giờ hiện theo Việt Nam, đủ ngày và giờ. Đổi múi giờ máy (ví dụ Tokyo) rồi tải lại: giờ trong Dashboard không đổi. | UI-127 |
| CL-31 | Thắng | Cây tổ chức: kéo "Tổ HN2" vào dưới "Tổ HN1", xác nhận (mở sẵn cửa sổ của Hương). Chờ tối đa 60 giây. Rồi hoàn nguyên. | Thông báo "Đã chuyển đơn vị. Quyền đã cập nhật cho n người." Hương thấy thêm khách của Hải mà không phải đăng nhập lại; hoàn nguyên thì biến mất. | PQ-03 |
| CL-32 | Thắng | Quản trị, tab "Vai trò & quyền". | Thấy ma trận quyền ở chế độ chỉ đọc, không có nút sửa. | PQ-11 |
| CL-33 | Quân | Quản trị, tab "Gán kênh": chuyển nick Linh cho Minh; gán nick cho Trang (VCedu). Lưu ý: đổi dữ liệu thử. | "Đã chuyển nick Linh VCparts sang Nguyễn Văn Minh." Gán chéo division có cảnh báo "Người này thuộc Division VCedu. Chỉ Admin gán chéo được." | PQ-12, 13, 76 |

## 5. Danh sách lỗi

Quy ước: **Nhỏ** là lỗi rõ ràng, không đụng §12, được sửa ngay trên nhánh. **Lớn** hoặc đụng §12 / nghiệp vụ thì không sửa, chỉ ghi và đề xuất. Phiên gốc theo bản đồ tính năng (`ke-hoach-phien-chat.md` §7).

| Mã | Ca | Mô tả | Phiên gốc | Mức | Xử lý / đề xuất |
|---|---|---|---|---|---|
| L-01 | PQ-09, PQ-70 | Chưa có công cụ "Quyền hiệu lực": Admin chọn một người và một khách / hội thoại để xem ✔/✖ kèm lý do và cách xin quyền. Quyền thực tế vẫn chặn đúng (E-KT). | M1b-03 (tab trên trang người dùng), M1b-04 (engine) | Trung bình, nghiệp vụ | **Đã sửa một phần (M1b-17):** tab "Quyền hiệu lực" + `GET /api/admin/users/:id/effective` (tra theo mã, tên, SĐT; ✔/✖ kèm lý do; "Cách thấy"; nhật ký `permission.explain`). **Phần còn lại đã sửa (M1b-18):** nút "Tạo yêu cầu quyền hộ" (chỉ tạo yêu cầu chờ duyệt, không tự cấp) |
| L-02 | PQ-27, PQ-108 | SĐT và email gõ trong nội dung tin không bị che cho Giám sát hay người không có quyền xem đủ. API che các trường điện thoại (danh bạ, khách, tìm kiếm) nhưng `text` của tin thì để nguyên. Test E-KT `it.failing` đã sẵn (sẽ đỏ khi sửa, lúc đó đổi thành `it`). | M1b-04 (ẩn SĐT phía API), M1b-05 (thành phần "Hiện") | **Lớn**, đụng NĐ 13 (§12.4) | **Đã sửa (M1b-17)** theo phương án mặc định: che mọi dãy giống SĐT Việt Nam và mọi email trong nội dung tin (hội thoại, dòng xem trước, trích dẫn, dòng thời gian 360, MCP `search_messages`), nút Hiện `POST /api/reveal/message`; bộ nhận diện có test đơn vị (che nhầm mã đơn dài chấp nhận được) |
| L-03 | PQ-60, PQ-72 | Nhật ký truy cập không ghi địa chỉ IP, nên ngăn kéo chi tiết không có IP và quy tắc R6 (địa chỉ lạ) chưa làm. | M1b-07 | Trung bình | **Đã sửa (M1b-17):** nhật ký ghi `ip` (CF-Connecting-IP), chỉ Admin và Quan sát thấy; bật R6 (địa chỉ lạ trong 30 ngày, cảnh báo không kèm IP) |
| L-04 | PQ-88 | Cuộc gọi MCP thật ghi `onBehalfOf` nhưng không ghi `userId` và `targets`; "Hoạt động của tôi" lọc theo `userId`, tra theo mã khách đọc `targets`, nên không thấy lượt AI đọc. | M1b-06 (ghi) + M1b-07 (đọc) | Nhỏ | **Đã sửa** ở `apps/api/src/mcp/mcp.tools.ts` (thêm `userId`, `targets` là mã hội thoại), test `tokens-channel.e2e-spec.ts` kiểm. Nhật ký vẫn không chứa nội dung. |
| L-05 | PQ-82 | Chưa có trạng thái "Sắp nghỉ" ở danh sách người dùng và cảnh báo R7 (mở hồ sơ nhiều khi sắp nghỉ). | M1b-03 / M1b-11 | Trung bình | **Đã sửa một phần (M1b-17):** cờ Sắp nghỉ (đặt / bỏ, Tag cam ở danh sách), R7 (ngưỡng 1/4; mọi lần xuất và xin quyền tạm thời). **Phần còn lại đã sửa (M1b-18):** token nhóm "Đọc", nhắc khóa tới ngày |
| L-06 | PQ-08 | Đặc tả ghi nhật ký `user.update` khi đổi tổ, code ghi `user.change_unit`. | M1b-03 | Nhỏ (lệch tên) | **Đã sửa (M1b-17):** ghi `user.update` kèm `detail.change = unit`; bản ghi cũ `user.change_unit` vẫn đọc được (nhãn riêng) |
| L-07 | UI-03, 04, 05, 129, 130 | Menu là thanh biểu tượng cố định: không có "Thu gọn menu", Alt+M, chế độ gọn 1366×768, hộp phím tắt `?`, Alt+G, Alt+D (chỉ có Ctrl+K và Alt+P). | M1b-08 | Nhỏ đến trung bình | **Xử lý bằng đặc tả (M1b-17):** sửa 00 giao diện chung v1.5.2 cho khớp thanh biểu tượng; không sửa code |
| L-08 | UI-10 | Tiêu đề tab chưa có số chưa trả lời "(5) …"; tên menu đang là "Tin nhắn" trong khi đặc tả viết "Hội thoại". | M1b-08 / M1b-09 | Nhỏ | **Xử lý bằng đặc tả (M1b-17):** 00 v1.5.2 ghi tiêu đề "VClinks" và "(n)" khi tab ẩn |
| L-09 | (ổn định test) | Khi máy tải nặng (ba bộ test của ba phiên chạy cùng lúc, thêm API thử) có test đỏ rồi xanh khi chạy riêng: `channels.e2e-spec.ts` (401 thay vì 400) ở lần chạy đầu, `friend-requests.e2e-spec.ts` ca SZ-09 (giữ 30 giây theo đồng hồ) ở lần `ci:local` cuối. | M1a-02 / M1b-06 (channels), M1a-04 (friend-requests) | Nhỏ, test phụ thuộc thời gian | Theo dõi; nếu lặp lại thì cho test dùng đồng hồ giả. |

## 6. Tiêu chí xác nhận xong của M1b-16

- [x] 100% ca "không được thấy" (01 M1) đạt: **đạt 29/29** sau M1b-17 (L-02 sửa theo phương án mặc định, chờ chủ dự án xác nhận).
- [ ] Mọi người dùng VCparts đăng nhập được, mỗi khách có một owner: **chưa chốt được**. Đăng nhập: phần API đạt (E-AU), Google thật cần chủ dự án (CL-28), file nhân sự thật chờ E4. Owner: nạp danh mục mô phỏng gán được 17/23 khách, 5 khách không khớp người dùng nào (E-CTD), cần E4 và E5.
- Các tiêu chí còn mở từ phiên trước, không do phiên này làm: M1b-13 "mở 360 ≤ 3 giây trên dữ liệu thật" (cần bản sao database thật), M1b-06 "thu hồi token thiết bị → extension dừng ≤ 1 phút" (cần driver).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.5 | 05/10/2026 10:23 | Claude Code | Sửa đường dẫn worktree M1b-16 thành `/Users/apple/projects/vclinks-wt/M1b-16` (mục Chuẩn bị một lần) | Chủ dự án chốt commit 05/10/2026 |
| 0.4 | 04/10/2026 23:16 | Agent Sonnet · M1b-18 | PQ-70, 72, 82 từ Trượt sang Đạt (74 Đạt, 0 Trượt); L-01, L-05 xong hết; L-03 ghi thêm ngăn kéo | Phiên M1b-18 |
| 0.3 | 04/10/2026 22:59 | Claude Code · M1b-17 (Agent Sonnet) | Cập nhật kết quả sau sửa lỗi: 71 Đạt, 3 Trượt, 37 Chờ người thử; ca "không được thấy" 29/29; trạng thái L-01…L-08 | Phiên M1b-17 |
| 0.2 | 04/10/2026 22:40 | Claude Code · gác cổng M1b-16 | Mục 4: lệnh `uat:m1b` từ chối cả `vczalo`, `vcconnect` và URI không ghi tên database; nhắc không lưu liên kết đăng nhập | Gác cổng M1b-16 |
| 0.1 | 04/10/2026 22:38 | Claude Code · M1b-16 (Agent Sonnet) | Tạo biên bản UAT M1b: bảng 169 ca, ma trận "không được thấy" tự động, checklist 33 dòng, danh sách lỗi; sửa lỗi L-04 | Phiên M1b-16 |
