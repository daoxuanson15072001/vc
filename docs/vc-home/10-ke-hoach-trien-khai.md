# VC Home — Kế hoạch triển khai

Phiên bản 0.3 · 08/10/2026 · Trạng thái: Đã chốt nội dung (chờ có người làm)

## Tóm tắt

- **Tài liệu nói gì:** cách chia 90 yêu cầu thành 4 bản phát hành R1–R4 (GĐ A–D) và một giai đoạn mở rộng R5 (GĐ E). Kèm việc từng tuần, ước lượng giờ, phụ thuộc, đầu vào từ bên ngoài, tiêu chí lên bản, định nghĩa "sẵn sàng" và "xong", ma trận truy vết.
- **Lịch:**

| Bản | GĐ | Ngày lên |
|---|---|---|
| R1 | A: đăng nhập chung | 31/10/2026 |
| R2 | B: hồ sơ và tổ chức | 20/11/2026 |
| R3 | C: quyền theo luật và vòng đời | 11/12/2026 |
| R4 | D: xin quyền, duyệt, rà soát | 22/01/2027 |
| R5 | E: mở rộng | từ 22/02/2027, sau Tết |

- **Khối lượng:** khoảng **485 giờ dev** cho A–D (420 giờ bản đầu, thêm 44 giờ cho 12 yêu cầu nhận ngày 08/10/2026, 6 giờ công cụ kiểm thử, 5 giờ điều kiện vào app ở GĐ A và 8 giờ VClinks chuyển phiên sang cookie).
  - VC Home: 435 giờ.
  - Kế hoạch code từng giai đoạn: GĐ A ở [thiết kế SSO](ky-thuat/thiet-ke-sso-keycloak.md); GĐ B, C, D ở [ky-thuat/ke-hoach-code-gd-b.md](ky-thuat/ke-hoach-code-gd-b.md), [gd-c](ky-thuat/ke-hoach-code-gd-c.md), [gd-d](ky-thuat/ke-hoach-code-gd-d.md).
  - Sửa ở VClinks và VCwiki: 48 giờ.
  - Ước theo cách làm có Claude Code hỗ trợ như thiết kế SSO.
  - Nút thắt thật thường là đầu vào bên ngoài (dữ liệu HC-NS, quyết định, UAT), không phải tốc độ code.
- **Nhân sự (đã chốt, [12](12-cau-hoi-rui-ro.md) mục 4):** 1 dev Platform toàn thời gian từ 02/11, giữ VC ID và VC Home, sau đó Gatekeeper. **Hạn có người: 30/10**; quá hạn thì R1 vẫn lên, R2–R4 dời sang sau Tết (từ 22/02/2027). Dev VClinks và dev VCwiki mỗi người khoảng 3 ngày ở GĐ C; HC-NS khoảng 5 ngày chuẩn bị dữ liệu.
- **Cách giảm rủi ro khi bật quyền theo luật (R3):** chạy **ngầm 1 tuần**. Hệ thống tính quyền nhưng chưa đẩy sang VC ID; so với vai trò đang có ở VClinks, VCwiki; sửa luật cho khớp rồi mới bật.
- **Việc cần làm ngay:**
  - Đổi repo `vc` sang private (chủ repo, ngay).
  - Có người làm VC Home trước 30/10.
  - Chủ dự án ghi tên người giữ vai trò (N3) trước 24/10.
  - HC-NS gửi file Excel theo mẫu trước 30/10.
  - Các câu hỏi Q-01…Q-15 và Q1–Q5 của SSO đã chốt ngày 08/10/2026, không còn chặn.
- **Người duyệt xem kỹ:** mục 2 (phạm vi và lịch), mục 4 (đầu vào bên ngoài), mục 6 (tiêu chí lên bản).

## Mục lục

- [1. Nguyên tắc chia bản](#1-nguyên-tắc-chia-bản)
- [2. Phạm vi, lịch và ước lượng theo bản](#2-phạm-vi-lịch-và-ước-lượng-theo-bản)
- [3. Việc theo tuần](#3-việc-theo-tuần)
- [4. Đầu vào từ bên ngoài](#4-đầu-vào-từ-bên-ngoài)
- [5. Nhân sự và phân công](#5-nhân-sự-và-phân-công)
- [6. Tiêu chí lên bản và chuyển đổi](#6-tiêu-chí-lên-bản-và-chuyển-đổi)
- [7. Định nghĩa sẵn sàng và xong](#7-định-nghĩa-sẵn-sàng-và-xong)
- [8. Ma trận truy vết](#8-ma-trận-truy-vết)
- [9. Theo dõi tiến độ](#9-theo-dõi-tiến-độ)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Nguyên tắc chia bản

1. **Mỗi bản dùng được ngay và có giá trị riêng.** R1 bỏ được mật khẩu VCwiki. R2 lấp đầu vào E4 "danh sách nhân sự" của VClinks. R3 khoá người nghỉ việc tự động.
2. **Phụ thuộc trước, tiện ích sau.** Hồ sơ (B) phải có trước luật (C); luật phải chạy ổn trước khi mở xin ngoại lệ (D).
3. **Không đụng VClinks trước 26/10** (ràng buộc RB-1).
4. **Mọi thay đổi lớn có đường quay lui:** cờ bật/tắt ở từng app, chạy ngầm trước khi bật thật.
5. **Theo quy trình BA → DESIGN → Code → UAT** ở cả repo VC Home mới (`vc-platform`) và hai app.

## 2. Phạm vi, lịch và ước lượng theo bản

### R1: GĐ A, đăng nhập chung (13/10 → 31/10/2026)

- **Phạm vi:**
  - VH-AUT-01…07, 09; VH-HOM-01, 05, 06; VH-APP-01 (tệp tĩnh).
  - VH-INT-01 (claim GĐ A), VH-INT-04; VH-ADM-01 (nhật ký của VC ID), VH-ADM-04.
- **Chi tiết kỹ thuật:** [ky-thuat/thiet-ke-sso-keycloak.md](ky-thuat/thiet-ke-sso-keycloak.md). Có 13 phiên SSO-00 … SSO-12, khoảng **65 giờ** (thêm 5 giờ cho điều kiện vào app, D-BA-37, 38).
- **Thứ tự:** VCwiki chuyển trước (22–24/10), VClinks sau mốc M1 (27–29/10).

### R2: GĐ B, hồ sơ và tổ chức (02/11 → 20/11/2026)

| Gói việc | Yêu cầu | Giờ |
|---|---|---:|
| Khung VC Home API: NestJS + MongoDB, xác thực bằng token VC ID, vai trò của VC Home, ghi nhật ký | VH-ADM-01, VH-ADM-03 | 14 |
| VC People: hồ sơ, vị trí chính và kiêm nhiệm, quản lý, trạng thái, lịch sử, thay đổi hẹn ngày hiệu lực | VH-NSU-01…05 | 24 |
| Cơ cấu: cây đơn vị, trưởng đơn vị, danh mục chức danh, chức năng, pháp nhân, nơi làm việc | VH-ORG-01…04, 06, 07 | 14 |
| Màn người dùng: thẻ hồ sơ trên trang chủ, hồ sơ của tôi và đề nghị sửa, danh bạ có che thông tin, sơ đồ tổ chức, đội của tôi (hồ sơ) | VH-HOM-02, VH-NSU-06…08 | 20 |
| Màn quản trị: nhân sự, cơ cấu, danh mục, nhật ký, app (quản trị trên màn) | VH-APP-01 | 20 |
| Nhập Excel, đối chiếu Google, lấy dữ liệu khởi đầu từ VClinks và VCwiki | VH-IMP-01…03 | 14 |
| Token GĐ B (đồng bộ thuộc tính sang VC ID), gắn tài khoản với hồ sơ, API danh bạ VH-API-01…05, token máy | VH-AUT-08, VH-INT-01, 02, 06 | 10 |
| Yêu cầu nhận thêm: tự sửa tên gọi, ảnh, SĐT (3); gộp mục trùng danh mục (4); hoàn tác lô nhập (3) | VH-NSU-09, VH-ORG-09, VH-IMP-05 | 10 |
| Công cụ kiểm thử trên staging: đồng hồ giả lập cho job hẹn giờ, app giả lập nhận sự kiện `vctest` ([11](11-uat.md) đề xuất 1, 2) | — | 6 |
| Test, UAT, sửa lỗi | — | 10 |
| **Cộng** | | **142** |

R2 có 3 tuần (khoảng 120 giờ của một người). Phần vượt dùng Claude Code bù; nếu vẫn trễ thì VH-ORG-09 và VH-IMP-05 (7 giờ) rời sang tuần đầu R3 trước tiên, không ảnh hưởng tiêu chí lên R2.

### R3: GĐ C, quyền theo luật và vòng đời (23/11 → 11/12/2026)

| Gói việc | Yêu cầu | Giờ |
|---|---|---:|
| Vai trò app, chủ app, vai trò nhạy cảm, thời gian chuyển tiếp | VH-APP-02, 03, 05, 06 | 10 |
| Bộ luật: điều kiện, tính lại, xem trước, duyệt hai người | VH-ACC-01…03 | 26 |
| Quyền: lưu, gỡ, cấp khẩn cấp; đẩy sang VC ID (vai trò app + nhóm); đối chiếu hằng đêm | VH-ACC-04, 06, 07 | 16 |
| Vòng đời: vào làm, chuyển vị trí, nghỉ việc theo ngày hiệu lực (job 00:00); đổi cơ cấu có ngày hiệu lực | VH-LCM-01…03, VH-ORG-05 | 14 |
| Sự kiện: hàng đợi gửi, ký, gửi lại, kéo dự phòng; API quyền VH-API-06, 07 | VH-INT-03, 05 | 16 |
| Màn: quyền của tôi (xem), ô app có vai trò, tra cứu quyền, đội của tôi (quyền), báo cáo truy cập | VH-HOM-03, VH-ACC-08, VH-ADM-02 | 12 |
| Yêu cầu nhận thêm: sự kiện báo trước nghỉ việc, chuyển vị trí (4); sự kiện thử và nút "Gửi thử" (2) | VH-INT-09, VH-INT-10 | 6 |
| Test, UAT, chạy ngầm 1 tuần | — | 12 |
| **Cộng phần VC Home** | | **112** |
| VClinks: ánh xạ vai trò, nhận cây tổ chức, mở bàn giao theo sự kiện (dev VClinks, theo [07](07-tich-hop.md)) | VH-INT-01, 03 | 20 |
| VCwiki: phân hệ ORG chuyển thành bên đọc, ánh xạ vai trò (dev VCwiki, theo [07](07-tich-hop.md)) | VH-INT-01, 03 | 20 |
| **Cộng** | | **152** |

### R4: GĐ D, xin quyền, duyệt, rà soát (14/12/2026 → 22/01/2027)

| Gói việc | Yêu cầu | Giờ |
|---|---|---:|
| Xin quyền, duyệt 1–2 bước, uỷ quyền, nhắc, tự huỷ, xin thay | VH-REQ-01…05, VH-HOM-04 | 26 |
| Hạn dùng, gia hạn, job hết hạn | VH-ACC-05, VH-REQ-06 | 8 |
| Rà soát quý | VH-REV-01…03 | 18 |
| Thông báo trong VC Home | VH-HOM-08 | 10 |
| Nghỉ dài ngày, quay lại làm | VH-LCM-04, 05 | 8 |
| Cài đặt, xem phiên của mình | VH-ADM-05, VH-AUT-10 | 6 |
| Yêu cầu nhận thêm: lịch ngày nghỉ (5); "cho phép xin" (2); tự trả quyền (3); duyệt nhiều yêu cầu (4); rà soát luật nửa năm (6); cảnh báo quyền không dùng (3); dải việc chờ (5) | VH-ORG-08, VH-APP-07, VH-ACC-09, VH-REQ-07, VH-REV-04, VH-ADM-06, VH-HOM-09 | 28 |
| Test, UAT | — | 12 |
| **Cộng phần VC Home** | | **116** |
| VClinks: chuyển phiên từ `localStorage` sang cookie httpOnly + chống CSRF (dev VClinks, D-BA-42) | — | 8 |
| **Cộng** | | **124** |

### R5: GĐ E, mở rộng (từ 22/02/2027)

| Gói việc | Yêu cầu | Ước lượng |
|---|---|---|
| Đưa VCsale vào (tài khoản riêng → VC ID, vai trò, cây tổ chức) | VH-APP-04 | 2–3 tuần, đội VCsale |
| VCgarage, VC AI, VCe, VCinvoice | VH-APP-04 | 1–2 tuần mỗi app, đội của app |
| Số việc chờ trên ô app | VH-HOM-07, VH-INT-07 | 16 giờ VC Home + 4 giờ mỗi app |
| Đồng bộ từ phần mềm nhân sự (nếu Q-01 = có phần mềm) | VH-IMP-04 | 24–40 giờ tuỳ phần mềm |

## 3. Việc theo tuần

| Tuần | Ngày | Việc chính | Mốc |
|---|---|---|---|
| T1 | 13–17/10 | SSO-00 … 03, 05: thử kỹ thuật (có mapper `vh_roles`), hạ tầng, realm, VC Home tĩnh, BA VCwiki | Repo `vc` đã private; mua máy chủ, trỏ DNS theo Q1, Q2 đã chốt |
| T2 | 20–24/10 | SSO-04, 06, 10: bộ đồng bộ Google, VCwiki code, production; bật VCwiki | Tên người giữ vai trò (N3); HC-NS rà danh mục (N2) |
| T3 | 27–31/10 | SSO-08, 09, 11: VClinks code, giao diện, UAT tổng | **R1** · HC-NS gửi Excel · **có dev Platform (N10)** |
| T4 | 02–06/11 | Khung VC Home API; VC People; cơ cấu | Nhập thử Excel lần 1 |
| T5 | 09–13/11 | Màn người dùng, màn quản trị, nhập và đối chiếu; token GĐ B; API danh bạ | Pháp chế duyệt thông báo xử lý dữ liệu |
| T6 | 16–20/11 | Test, UAT, nhập dữ liệu thật | **R2** · ánh xạ vai trò và mã đơn vị đã duyệt |
| T7 | 23–27/11 | Vai trò app, bộ luật, xem trước; luật bản đầu | Chủ dự án và chủ app duyệt luật |
| T8 | 30/11–04/12 | Quyền, đẩy sang VC ID, vòng đời, sự kiện; VClinks, VCwiki nhận sự kiện | **Bắt đầu chạy ngầm** |
| T9 | 07–11/12 | Màn quyền, tra cứu, báo cáo; so khớp chạy ngầm; UAT | **R3** (bật thật nếu chạy ngầm khớp ≥ 98%) |
| T10–T11 | 14–25/12 | Xin quyền, duyệt, uỷ quyền, hạn dùng | — |
| — | 28/12–03/01 | Nghỉ Tết dương lịch, chỉ trực sự cố | — |
| T12–T13 | 04–15/01 | Rà soát quý, thông báo, nghỉ dài ngày, cài đặt | — |
| T14 | 18–22/01 | UAT, sửa lỗi | **R4** |
| — | 01–21/02/2027 | Tết Nguyên đán (khoảng 06/02), không phát hành | — |
| T15 trở đi | từ 22/02/2027 | Mở rộng từng app | **R5** theo từng app |

## 4. Đầu vào từ bên ngoài

Đầu vào của GĐ A (I1–I7) nằm ở thiết kế SSO mục 4.3. Bổ sung cho GĐ B–D:

| Mã | Việc | Ai | Hạn | Chặn |
|---|---|---|---|---|
| N0 | Bật bắt buộc xác thực 2 bước trong Google Admin (2 domain); danh sách loại trừ (hộp thư dùng chung, tài khoản dịch vụ, tài khoản thử) | Chủ dự án (admin Google) | 24/10 | R1 |
| N1 | File Excel nhân sự và cơ cấu theo mẫu VH-IMP-01 | HC-NS | 30/10 | R2 (T4) |
| N2 | HC-NS rà danh mục 10 chức năng khởi tạo (Q-02 đã chốt, [12](12-cau-hoi-rui-ro.md) mục 4.2) | HC-NS | 24/10 | Không chặn (dùng bản khởi tạo nếu chưa rà) |
| N3 | Ghi tên người theo bảng chức vụ ở [12](12-cau-hoi-rui-ro.md) mục 4.3 (Q-07 đã chốt) | Chủ dự án | 24/10 | R2 |
| N4 | Văn bản thông báo xử lý dữ liệu nhân viên (VH-NFR-08) | Pháp chế | 13/11 | R2 |
| N5 | Danh sách người dùng thử UAT theo vai trò (≥ 1 người mỗi vai trò, ở 2 division) | Chủ dự án | 13/11 | R2 |
| N6 | Bảng ánh xạ vai trò VClinks, VCwiki sang vai trò app | Chủ app | 20/11 | R3 |
| N7 | Bảng ánh xạ mã đơn vị cũ của VClinks, VCwiki sang mã đơn vị mới | HC-NS + chủ app | 20/11 | R3 |
| N8 | Bộ luật cấp quyền bản đầu | Chủ dự án + chủ app duyệt | 27/11 | R3 |
| N9 | ~~Chốt Q-03, Q-08, Q-09~~ Đã chốt ngày 08/10/2026 | — | — | Không chặn |
| N10 | Có dev Platform toàn thời gian (RR-02) | Chủ dự án | 30/10 | R2–R4 |
| N11 | Lịch ngày nghỉ năm 2027 của từng pháp nhân (VH-ORG-08) | HC-NS | 11/12 | R4 |

## 5. Nhân sự và phân công

| Người | Việc | Thời gian |
|---|---|---|
| Dev Platform (đã chốt vị trí, cần người trước 30/10) | VC Home API, giao diện, bộ luật, sự kiện, vận hành; quản trị hệ thống chính; sau R4 làm Gatekeeper | Toàn thời gian từ 02/11 |
| Dev002 + Claude Code | GĐ A (thiết kế SSO); phần VClinks ở GĐ C; quản trị hệ thống dự phòng; chủ app VClinks | GĐ A: theo thiết kế SSO; GĐ C: khoảng 3 ngày |
| Dev VCwiki | Phần VCwiki ở GĐ A (SYS-60) và GĐ C | GĐ A: khoảng 2 ngày; GĐ C: khoảng 3 ngày |
| BA | Giữ bộ tài liệu, trả lời câu hỏi, viết ca UAT, nghiệm thu | Bán thời gian |
| HC-NS | Chuẩn bị Excel, duyệt danh mục, kiểm dữ liệu sau nhập, UAT màn quản trị | Khoảng 5 ngày rải trong T3–T6 |
| Quản trị hệ thống | Máy chủ, DNS, Google Admin, vận hành, luật | Bán thời gian |
| Chủ dự án | Chốt câu hỏi, duyệt luật, nghiệm thu bản | Theo mốc |

## 6. Tiêu chí lên bản và chuyển đổi

| Bản | Tiêu chí lên bản (tất cả phải đạt) | Chuyển đổi và quay lui |
|---|---|---|
| R1 | UAT-SSO-01…23 của thiết kế SSO đạt; sao lưu và khôi phục thử đạt; cảnh báo chạy; **Google Admin bắt buộc xác thực 2 bước cho cả 2 domain**; chủ dự án duyệt danh sách loại trừ và danh sách "ai được vào app" do `vc-provisioner report` sinh ra; quy trình nghỉ việc trước GĐ C (thiết kế SSO mục 11.1) đã gửi HC-NS và IT | Cờ ở từng app (thiết kế SSO mục 10) |
| R2 | Các ca UAT của GĐ B trong [11](11-uat.md) đạt; ≥ 98% nhân viên đang làm có hồ sơ đủ; báo cáo đối chiếu Google còn 0 lỗi mức cao; pháp chế duyệt N4 | App chưa dùng dữ liệu VC People; tắt được màn mới mà không ảnh hưởng đăng nhập |
| R3 | Các ca UAT của GĐ C đạt; **chạy ngầm 1 tuần**: quyền tính từ luật khớp ≥ 98% với vai trò đang dùng thật ở VClinks, VCwiki, phần lệch đã được chủ app xác nhận; đối chiếu VC Home ↔ VC ID bằng 0 lệch; diễn tập nghỉ việc trên staging đạt ≤ 1 phút | Cờ `access_push` tắt thì VC ID giữ nhóm mặc định GĐ A; app có cờ dùng vai trò cũ trong 30 ngày đầu (Q-14) |
| R4 | Các ca UAT của GĐ D đạt; thử đủ luồng duyệt 1 và 2 bước với người thật; thông báo tới đúng người | Tắt được việc xin quyền mà không ảnh hưởng quyền theo luật |
| R5 (mỗi app) | Danh sách kiểm của [07](07-tich-hop.md) đạt; chủ app ký | Cờ ở app |

**Truyền thông khi lên bản:**
- Thông báo trước 3 ngày.
- Hướng dẫn 1 trang.
- Tuần đầu có người trực hỗ trợ (RR-12).

## 7. Định nghĩa sẵn sàng và xong

**Một câu chuyện người dùng sẵn sàng để làm khi:**
1. Có mã VH-US, gắn với yêu cầu VH-xxx và màn VH-MH.
2. Tiêu chí nghiệm thu dạng Cho trước / Khi / Thì rõ ràng, kiểm được.
3. Trường dữ liệu có trong [05](05-du-lieu.md); câu chữ giao diện có trong [06](06-man-hinh.md).
4. Phụ thuộc đã xong, hoặc có cách giả lập (mock).
5. Câu hỏi mở liên quan đã chốt, hoặc có đề xuất mặc định được dùng.

**Một câu chuyện xong khi:**
1. Code qua CI: kiểm kiểu, test đơn vị, test đầu cuối, quét bí mật.
2. Có test cho mọi tiêu chí nghiệm thu, kể cả ca từ chối quyền.
3. Thao tác thay đổi dữ liệu có ghi nhật ký (VH-BR-18).
4. Tài liệu đã cập nhật theo quy trình của repo (BA, DESIGN, README thư mục, lịch sử có ngày giờ).
5. Đã lên staging, ca UAT tương ứng đạt.
6. Người khác soát mã; phần đụng xác thực hoặc quyền thì soát kỹ (dùng model mạnh như quy định §15.7 của VClinks).

## 8. Ma trận truy vết

Truy vết chi tiết:
- câu chuyện ↔ yêu cầu: [09](09-user-story.md) mục "Độ phủ yêu cầu";
- quy trình ↔ ca UAT: [11](11-uat.md).

Bảng dưới là truy vết theo phân hệ.

| Phân hệ | Yêu cầu | Màn hình | Quy trình | Nhóm câu chuyện | Bản |
|---|---|---|---|---|---|
| AUT | VH-AUT-01…10 | VH-MH-01, 02, 03, 21 | VH-QT-01, 02, 06 | VH-E-01 | R1 (08: R2; 10: R4) |
| HOM | VH-HOM-01…09 | VH-MH-02, 04, 21 | VH-QT-01 | VH-E-02 | R1–R5 |
| NSU | VH-NSU-01…09 | VH-MH-03, 06, 09, 11 | VH-QT-03…07 | VH-E-03 | R2 |
| ORG | VH-ORG-01…09 | VH-MH-07, 12, 13 | VH-QT-03, 12 | VH-E-04 | R2 (05: R3; 08: R4) |
| APP | VH-APP-01…07 | VH-MH-02, 15 | VH-QT-11 | VH-E-06 | R1–R5 |
| ACC | VH-ACC-01…09 | VH-MH-04, 09, 16, 17 | VH-QT-04, 05, 06, 10 | VH-E-07 | R3 (05, 09: R4) |
| REQ | VH-REQ-01…07 | VH-MH-04, 05, 08 | VH-QT-08 | VH-E-09 | R4 |
| REV | VH-REV-01…04 | VH-MH-10, 18 | VH-QT-09 | VH-E-10 | R4 |
| LCM | VH-LCM-01…05 | VH-MH-09, 11 | VH-QT-04…07 | VH-E-08 | R3, R4 |
| INT | VH-INT-01…10 | VH-MH-15 (cấu hình nhận sự kiện) | VH-QT-11 | VH-E-11 | R1–R3, R5 |
| ADM | VH-ADM-01…06 | VH-MH-17, 19, 20 | — | VH-E-12 | R1–R4 |
| IMP | VH-IMP-01…05 | VH-MH-14 | VH-QT-03 | VH-E-05 | R2, R5 |

## 9. Theo dõi tiến độ

- **Bảng việc:** mỗi câu chuyện VH-US là một việc trên bảng của repo `vc-platform` (GitLab). Nhãn theo bản (R1…R5) và phân hệ.
- **Báo cáo tuần** (≤ 15 dòng, theo CLAUDE.md §15.4 của VClinks):
  - việc xong;
  - việc trễ, lý do;
  - đầu vào bên ngoài đang chờ (bảng mục 4);
  - câu hỏi cần chốt;
  - rủi ro đổi mức.
- **Mốc chính** (R1–R4) thêm vào lộ trình AI trung tâm, làn "Nền tảng", để không trùng sức với GĐ1 của VClinks (AI Hub v0).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.3 | 08/10/2026 13:49 | Claude Code (vai BA trưởng) | R1 thêm điều kiện lên bản (2 bước bắt buộc, duyệt danh sách loại trừ, quy trình nghỉ việc tay); GĐ A 65 giờ; R4 thêm 8 giờ VClinks chuyển phiên sang cookie; tổng khoảng 485 giờ; thêm đầu vào N0; trỏ tới kế hoạch code GĐ B, C, D | Đánh giá bảo mật luồng đăng nhập, người dùng đồng ý 6 điểm vá ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) D-BA-37…42 |
| 0.2 | 08/10/2026 11:31 | Claude Code (vai BA) | Ghi quyết định nhân sự (1 dev Platform từ 02/11, hạn có người 30/10, phương án dời sau Tết); thêm giờ cho 12 yêu cầu mới (R2 +10, R3 +6, R4 +28) và công cụ kiểm thử (R2 +6), tổng khoảng 470 giờ; N2, N3, N9 đổi theo quyết định; thêm N10, N11; cập nhật ma trận truy vết; việc cần làm ngay | [12](12-cau-hoi-rui-ro.md) mục 4, 6; 04 mục 14 |
| 0.1 | 08/10/2026 10:04 | Claude Code (vai BA) | Tạo kế hoạch: nguyên tắc chia bản, phạm vi và giờ theo bản (khoảng 420 giờ A–D), việc theo tuần tới R4, 9 đầu vào bên ngoài, nhân sự, tiêu chí lên bản có chạy ngầm, định nghĩa sẵn sàng và xong, ma trận truy vết | README bộ tài liệu 0.1; thiết kế SSO 0.1 mục 8 |
