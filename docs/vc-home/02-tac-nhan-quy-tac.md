# VC Home — Tác nhân, vai trò và quy tắc nghiệp vụ

Phiên bản 0.3 · 08/10/2026 · Trạng thái: Đã chốt nội dung (chờ đội phát triển rà)

## Tóm tắt

- **Tài liệu nói gì:** ai dùng VC Home, mỗi vai trò được làm gì trong chính VC Home (ma trận quyền), ai chịu trách nhiệm việc gì (RACI), và 26 quy tắc nghiệp vụ VH-BR áp cho mọi phân hệ.
- **Vai trò của VC Home có hai loại:**
  - **Suy ra từ hồ sơ**, không ai gán tay: Nhân viên, Quản lý trực tiếp, Trưởng đơn vị.
  - **Gán làm vai trò app của chính VC Home** (VC Home cũng là một app trong danh mục): HC-NS, Quản trị hệ thống, Kiểm soát, Ban giám đốc. Chủ app được gán trong danh mục app.
- **Tách nhiệm (VH-BR-17):**
  - HC-NS sửa hồ sơ nhưng không cấp quyền.
  - Quản trị hệ thống cấp quyền nhưng không sửa hồ sơ.
  - Không ai tự duyệt cho mình.
- **Người duyệt xem kỹ:** mục 3 (ma trận quyền), mục 4 (quy tắc VH-BR-09, 11, 14, 16, 17, 19), mục 6 (tách nhiệm).

## Mục lục

- [1. Tác nhân](#1-tác-nhân)
- [2. Vai trò trong VC Home](#2-vai-trò-trong-vc-home)
- [3. Ma trận quyền của VC Home](#3-ma-trận-quyền-của-vc-home)
- [4. Quy tắc nghiệp vụ](#4-quy-tắc-nghiệp-vụ)
- [5. RACI theo quy trình](#5-raci-theo-quy-trình)
- [6. Tách nhiệm](#6-tách-nhiệm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Tác nhân

### 1.1 Con người

| Tác nhân | Là ai | Việc chính trên VC Home |
|---|---|---|
| Nhân viên | Mọi người có hồ sơ đang làm | Đăng nhập, mở app, xem hồ sơ của mình, danh bạ, xin quyền |
| Quản lý trực tiếp | Nhân viên có ít nhất 1 người báo cáo trực tiếp | Duyệt yêu cầu của người dưới quyền, xem đội, xin quyền thay |
| Trưởng đơn vị | Người được đặt làm trưởng của một đơn vị | Rà soát quyền của người có vị trí chính trong đơn vị mình (VH-BR-16); xem đội và tiến độ rà soát của các đơn vị con |
| HC-NS | Nhân sự phụ trách hồ sơ (mỗi pháp nhân / division có thể có người riêng) | Tạo, sửa hồ sơ, vị trí, cơ cấu tổ chức, danh mục; nhập Excel; đặt ngày nghỉ việc |
| Quản trị hệ thống | IT phụ trách VC Home, VC ID | Danh mục app, luật cấp quyền, cấp khẩn cấp, khoá khẩn cấp, cài đặt, đối chiếu Google |
| Chủ app | Người chịu trách nhiệm một app (VClinks: dev002 hoặc người được chỉ định…) | Khai vai trò app, duyệt yêu cầu vai trò nhạy cảm của app mình, cùng duyệt luật của app mình |
| Kiểm soát | Kiểm soát nội bộ, kiểm toán | Xem nhật ký, tra cứu quyền, theo dõi rà soát; chỉ đọc |
| Ban giám đốc | Lãnh đạo tập đoàn | Xem báo cáo tổng hợp (số người, quyền theo app, kết quả rà soát) |
| Admin Google Workspace | Người quản trị Google Admin (hiện là chủ dự án) | Tạo, khoá tài khoản Google, bật xác thực 2 bước; ngoài VC Home |

### 1.2 Hệ thống

| Tác nhân | Vai trò |
|---|---|
| Google Workspace (2 domain) | Xác thực mật khẩu và xác thực 2 bước; nguồn trạng thái tài khoản Google |
| VC ID (Keycloak) | Phiên đăng nhập chung, phát token, đăng xuất phía máy chủ; nhận nhóm và vai trò app từ VC Home |
| VC Home API | Backend của VC Home: VC People, quyền, luật, yêu cầu, rà soát, sự kiện, API cho app (có từ GĐ B) |
| Bộ đồng bộ (`vc-provisioner`) | Job theo lịch: trạng thái Google → VC ID (GĐ A); quyền → VC ID (GĐ C) |
| App | VClinks, VCwiki, VCsale, VCgarage, VC AI…: đọc token, gọi API, nhận sự kiện |
| Phần mềm nhân sự (sau) | Nguồn hồ sơ tự động ở GĐ E nếu công ty có (Q-01) |

## 2. Vai trò trong VC Home

| Vai trò | Mã | Cách có | Phạm vi |
|---|---|---|---|
| Nhân viên | `nhan_vien` | Có hồ sơ trạng thái đang làm hoặc nghỉ dài ngày, và đã gắn tài khoản | Bản thân |
| Quản lý trực tiếp | (suy ra) | Có ít nhất 1 vị trí còn hiệu lực ghi mình là quản lý trực tiếp | Người báo cáo trực tiếp và cả cây dưới (VH-BR-23) |
| Trưởng đơn vị | (suy ra) | Được đặt làm trưởng của đơn vị (VH-ORG-04) | Đơn vị đó và các đơn vị con |
| HC-NS | `vchome:hcns` | Vai trò app của VC Home. GĐ B: quản trị hệ thống gán theo danh sách khởi đầu trên VC ID (Q-07). Từ GĐ C: qua luật; từ GĐ D: thêm qua yêu cầu. Có thể giới hạn theo pháp nhân / division | Pháp nhân / division được gán (mặc định: toàn tập đoàn) |
| Quản trị hệ thống | `vchome:qtht` | Vai trò app nhạy cảm của VC Home | Toàn hệ thống |
| Chủ app | (trong danh mục app) | Quản trị hệ thống ghi tên vào trường "Chủ app" của app (VH-APP-03); một app có thể có 1–3 chủ | App được ghi tên |
| Kiểm soát | `vchome:kiem_soat` | Vai trò app nhạy cảm của VC Home | Toàn hệ thống, chỉ đọc |
| Ban giám đốc | `vchome:bgd` | Vai trò app của VC Home | Báo cáo tổng hợp, chỉ đọc |

Một người có thể giữ nhiều vai trò; quyền là hợp của các vai trò, **trừ** các cặp xung đột ở mục 6.

## 3. Ma trận quyền của VC Home

Ký hiệu:
- ✓ được làm;
- (đ) chỉ đọc;
- (m) chỉ với dữ liệu của mình;
- (p) trong phạm vi của vai trò (mục 2);
- — không được.

| Chức năng | Nhân viên | Quản lý | Trưởng ĐV | HC-NS | Quản trị HT | Chủ app | Kiểm soát | BGĐ |
|---|---|---|---|---|---|---|---|---|
| Đăng nhập, mở app được cấp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Xem hồ sơ của mình | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Đề nghị sửa hồ sơ của mình | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Danh bạ (thông tin C0) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Xem hồ sơ công việc đầy đủ (C1) của người khác | — | (p) | (p) | (p) | (đ) | — | (đ) | — |
| Tạo, sửa hồ sơ, vị trí, đặt ngày nghỉ | — | — | — | (p) | — | — | — | — |
| Sửa cơ cấu tổ chức, danh mục | — | — | — | (p) | — | — | — | — |
| Nhập Excel, đối chiếu Google | — | — | — | (p) | ✓ (đối chiếu) | — | — | — |
| Xem quyền của mình | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Xin quyền cho mình | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Xin quyền thay người dưới quyền | — | (p) | (p) | — | — | — | — | — |
| Duyệt bước 1 (quản lý) | — | (p) | — | — | — | — | — | — |
| Duyệt bước 2 (vai trò nhạy cảm) | — | — | — | — | ✓ (chỉ khi người xin là chủ app của chính app đó, VH-BR-12) | (p) | — | — |
| Xem quyền của người khác | — | (p) | (p) | — | ✓ | (p: app mình) | (đ) | — |
| Rà soát (xác nhận, gỡ) | — | — | (p) | — | — | — | (đ) | — |
| Danh mục app, URL, cấu hình | — | — | — | — | ✓ | (đ: app mình) | (đ) | — |
| Vai trò app | — | — | — | — | ✓ | (p: app mình) | (đ) | — |
| Luật cấp quyền: xem | — | — | — | — | ✓ | (p: app mình) | (đ) | — |
| Luật cấp quyền: soạn | — | — | — | — | ✓ | (p: app mình) | — | — |
| Luật cấp quyền: duyệt bước hai (VH-BR-25) | — | — | — | — | ✓ (không tự duyệt) | (p: app mình) | — | — |
| Cấp quyền khẩn cấp | — | — | — | — | ✓ | — | — | — |
| Gỡ quyền | — | — | (p: qua rà soát) | — | ✓ | (p: app mình) | — | — |
| Khoá tài khoản khẩn cấp | — | — | — | — | ✓ | — | — | — |
| Mở đợt rà soát | — | — | — | — | ✓ | — | — | — |
| Nhật ký | (m) | — | — | (p: hồ sơ) | ✓ | (p: app mình) | (đ) | — |
| Báo cáo tổng hợp | — | — | (p) | (p) | ✓ | (p: app mình) | (đ) | (đ) |
| Cài đặt hệ thống | — | — | — | — | ✓ | — | — | — |

Ghi chú:
- "Quản lý" và "Trưởng đơn vị" là vai trò suy ra. Khi người đó đổi vị trí, phạm vi đổi theo ngay lúc thay đổi có hiệu lực.
- Quản trị hệ thống thấy hồ sơ ở chế độ chỉ đọc để xử lý sự cố; mỗi lần xem hồ sơ người khác đều ghi nhật ký.
- "Duyệt bước 1" chỉ dành cho **quản lý trực tiếp** theo vị trí chính (VH-BR-12), không phải cả cây trên. Ngoại lệ: người xin không có quản lý trực tiếp (quản lý đã nghỉ, VH-BR-05) thì **trưởng đơn vị** của vị trí chính duyệt thay.
- "Khoá tài khoản khẩn cấp" chỉ quản trị hệ thống làm. Riêng HC-NS đặt trạng thái hồ sơ "Tạm khoá" (ví dụ đình chỉ công việc) thì đăng nhập cũng bị khoá, với nguồn khoá `hcns` (VH-NSU-04); đây là thay đổi hồ sơ, không phải khoá khẩn cấp.

## 4. Quy tắc nghiệp vụ

### VH-BR-01 — Một nhân viên, một tài khoản
- **Khoá nghiệp vụ:** mã nhân viên, duy nhất toàn tập đoàn, không dùng lại kể cả sau khi nghỉ.
- **Khoá kỹ thuật:** `sub` của VC ID, không đổi.
- **Email đổi được:** đổi tên, chuyển giữa `@vcpart.vn` và `@vcprosperous.com`. Đổi email không tạo người mới.
- **Lần đăng nhập đầu**, tài khoản được gắn với hồ sơ theo email công ty (VH-AUT-08). Gắn rồi thì không tự đổi; muốn gắn lại phải có quản trị hệ thống làm và ghi nhật ký.
- **Ví dụ:** chị Lan đổi email từ `lan.nt@vcpart.vn` sang `lan.nguyen@vcprosperous.com`; HC-NS sửa email trên hồ sơ trước, lần đăng nhập sau vẫn đúng người.

### VH-BR-02 — Chỉ tài khoản công ty
- Chỉ đăng nhập được khi đuôi email là `vcprosperous.com` hoặc `vcpart.vn`, **và** tài khoản thuộc Google Workspace công ty (claim `hd`).
- Gmail cá nhân, kể cả khi trùng tên với nhân viên, bị chặn ở 3 lớp: Google, VC ID, app.
- Từ GĐ C (khi quyền đi theo hồ sơ): **đăng nhập được chưa chắc vào được app.** Tài khoản công ty chưa có hồ sơ trên VC People chỉ thấy trang chủ trống với dòng "Tài khoản chưa có hồ sơ nhân sự, liên hệ HC-NS" và không có quyền app nào. Xem VH-BR-08 và câu hỏi Q-14 về giai đoạn chuyển tiếp.

### VH-BR-03 — VC People là nguồn sự thật
- Hồ sơ, vị trí, quản lý, cơ cấu tổ chức chỉ sửa trên VC Home.
- App (VClinks, VCwiki…) **chỉ đọc** qua token, API, sự kiện. Màn nhập cây tổ chức hay nhập nhân sự của app phải khoá lại hoặc chuyển sang chỉ đọc khi app đã nối.
- Ngoại lệ: dữ liệu nghiệp vụ riêng của app (khách của ai, kho nào, lĩnh vực tri thức nào) vẫn do app giữ.

### VH-BR-04 — Vị trí chính và kiêm nhiệm
- **Vị trí chính:** nhân viên đang làm có **đúng 1**. Vị trí chính quyết định đơn vị và chức danh hiện trên thẻ hồ sơ và trong token.
- **Kiêm nhiệm:** 0..n vị trí, mỗi vị trí có `từ ngày`, `đến ngày` (có thể trống).
- **Đổi vị trí chính:** đóng vị trí cũ (`đến ngày` = ngày trước ngày hiệu lực) và mở vị trí mới. Không sửa đè vị trí cũ, để giữ lịch sử.

### VH-BR-05 — Quản lý trực tiếp
- Mỗi vị trí ghi 1 quản lý trực tiếp. Người đứng đầu tập đoàn không có quản lý.
- **Quản lý trực tiếp của một nhân viên** là quản lý ghi trên **vị trí chính**. Chỉ người này duyệt yêu cầu bước 1 và nằm trong cây quản lý.
- Quản lý ghi trên vị trí **kiêm nhiệm** chỉ được xem hồ sơ C1 của người đó; không duyệt, không nằm trong cây quản lý.
- **Không cho tạo vòng:** A quản lý B, B quản lý A là không hợp lệ.
- Quản lý trực tiếp nghỉ việc thì các vị trí đang trỏ tới người đó hiện cảnh báo "thiếu quản lý" cho HC-NS. Trong lúc chờ, **trưởng đơn vị** tạm làm quản lý cho việc duyệt.

### VH-BR-06 — Cây đơn vị
- Cây không có vòng. Đơn vị loại Tổ / Nhóm chỉ chứa được Tổ / Nhóm con một cấp (như tổ bán hàng lồng một cấp của VClinks).
- Đơn vị còn vị trí đang hiệu lực thì **không xoá được**, chỉ chuyển sang "Ngừng" sau khi đã chuyển hết người.
- Mỗi đơn vị có tối đa **1 trưởng đơn vị**. Trưởng đơn vị phải có vị trí (chính hoặc kiêm nhiệm) thuộc đơn vị đó hoặc đơn vị cha trực tiếp.

### VH-BR-07 — Ngày hiệu lực
- Thay đổi hồ sơ, vị trí, cơ cấu đều có **ngày hiệu lực**. Thay đổi áp lúc 00:00 (giờ Việt Nam) của ngày đó.
- **Hẹn trước được:** ví dụ quyết định điều chuyển ký ngày 20 có hiệu lực ngày 1 tháng sau.
- **Ngày hiệu lực là hôm nay hoặc đã qua:** áp ngay khi lưu.
- **Nghỉ việc** theo quy tắc riêng VH-BR-14.

### VH-BR-08 — Quyền là cặp (app, vai trò)
- Mỗi quyền là một cặp: nhân viên có vai trò R trong app A.
- Không có quyền "vào app" mà không có vai trò. Muốn cho "vào xem" thì app phải công bố một vai trò kiểu `xem`.
- VC Home **không** quyết phạm vi dữ liệu trong app. Phạm vi do app tính từ đơn vị và vai trò (ví dụ phạm vi Tổ / Division của VClinks).

### VH-BR-09 — Ba nguồn quyền

| Nguồn | Ai tạo | Hạn | Gỡ khi |
|---|---|---|---|
| Luật (quyền mặc định) | Hệ thống, từ luật đã duyệt | Không hạn | Hồ sơ không còn thoả luật (sau thời gian chuyển tiếp VH-BR-11), luật bị tắt, nghỉ việc |
| Yêu cầu được duyệt (ngoại lệ) | Người xin, sau khi đủ người duyệt | Bắt buộc. Mặc định 90 ngày, tối đa 365 ngày; **vai trò nhạy cảm tối đa 90 ngày** | Hết hạn, rà soát không xác nhận, quản trị gỡ, nghỉ việc |
| Khẩn cấp (ngoại lệ) | Quản trị hệ thống, bắt buộc ghi lý do | Tối đa 7 ngày | Hết hạn, quản trị gỡ, nghỉ việc |

Cùng một cặp (app, vai trò) có thể đến từ nhiều nguồn. Quyền còn hiệu lực khi **ít nhất một** nguồn còn hiệu lực.

### VH-BR-10 — Luật chỉ dựa trên thuộc tính
- **Thuộc tính dùng được trong luật:**
  - pháp nhân, division;
  - đơn vị (có hoặc không gồm đơn vị con);
  - chức danh, chức năng;
  - loại nhân viên (chính thức, thử việc, cộng tác viên, thực tập);
  - nơi làm việc;
  - là quản lý (có người dưới quyền) hay không;
  - là trưởng đơn vị hay không.
- **Không** viết luật kiểu "email = …" hay "mã nhân viên = …". Người cần ngoại lệ thì đi đường yêu cầu.

### VH-BR-11 — Tính lại quyền và thời gian chuyển tiếp
- Khi hồ sơ, cơ cấu hoặc luật đổi, quyền mặc định của những người bị ảnh hưởng được tính lại **ngay** (chậm nhất 5 phút).
- Quyền mới có ngay.
- Quyền không còn thoả luật bị gỡ sau **thời gian chuyển tiếp** của app (VH-APP-06): mặc định 0 ngày, tối đa 7 ngày. Ví dụ VClinks đặt 3 ngày để NVKD chuyển sang CSKH kịp bàn giao khách.
- Trong thời gian chuyển tiếp, ô app hiện "Còn N ngày".
- Thay đổi nhập muộn (ngày hiệu lực đã qua): thời gian chuyển tiếp tính từ **lúc áp**, không tính từ ngày hiệu lực, để người dùng không mất quyền đột ngột.

### VH-BR-12 — Duyệt yêu cầu
- **Bước 1:** quản lý trực tiếp (theo vị trí chính) của người được cấp.
- **Bước 2:** chỉ khi vai trò nhạy cảm (VH-APP-05); người duyệt là một trong các chủ app.
- **Không tự duyệt:**
  - người xin trùng người duyệt bước nào thì bước đó chuyển lên quản lý của người duyệt;
  - chủ app xin vai trò nhạy cảm của chính app mình thì bước 2 chuyển cho quản trị hệ thống.
- **Uỷ quyền:** người duyệt vắng có thể uỷ cho người khác trong khoảng thời gian (VH-REQ-03). Người được uỷ không được duyệt cho chính mình.
- **Chuyển người duyệt:**
  - người được cấp đổi vị trí chính khi yêu cầu đang chờ: bước 1 chuyển sang quản lý mới;
  - quản lý đang nghỉ dài ngày mà không uỷ quyền: sau 2 ngày làm việc, bước 1 chuyển cho trưởng đơn vị;
  - người duyệt bước 1 cũng là chủ app duy nhất của app đó: bước 2 chuyển cho quản trị hệ thống.

### VH-BR-13 — Yêu cầu quá hạn
- Yêu cầu chưa duyệt xong sau **7 ngày** tự huỷ và báo người xin.
- Nhắc người duyệt sau 2 ngày và 5 ngày.

### VH-BR-14 — Nghỉ việc
- Đến **00:00 ngày nghỉ việc** (ngày đầu tiên không còn làm; xem Q-13), theo thứ tự:
  1. Khoá tài khoản trên VC ID và đăng xuất mọi app.
  2. Gỡ mọi quyền (mọi nguồn).
  3. Gửi sự kiện `vh.person.left` để app làm bàn giao (VClinks: bàn giao khách M1b-11).
  4. Đóng các vị trí; ai đang trỏ quản lý tới người này thì báo HC-NS.
- **Hồ sơ không xoá:** chuyển trạng thái "Đã nghỉ", giữ theo thời hạn lưu ([05](05-du-lieu.md) mục thời hạn lưu; VH-NFR-08).
- **Khoá gấp trước ngày nghỉ:** dùng VH-AUT-06.
- **Tài khoản Google** do admin Google khoá. Nếu khoá Google trước, VH-AUT-07 cũng khoá VC ID. Bên nào khoá trước thì khoá.

### VH-BR-15 — Nghỉ dài ngày
- Nghỉ dài ngày từ 7 ngày trở lên: **giữ quyền, không khoá tài khoản**. VC Home **không ghi lý do nghỉ** (lý do có thể là dữ liệu sức khoẻ, VH-BR-19), chỉ ghi từ ngày, đến ngày.
- Gửi `vh.person.leave_started` để app không chia việc mới (VClinks đặt người đó "Vắng").
- Hết thời gian nghỉ gửi `vh.person.returned`.
- HC-NS chọn có khoá đăng nhập trong thời gian nghỉ hay không. Mặc định không khoá.

### VH-BR-16 — Rà soát
- **Mỗi quý**, quản trị hệ thống mở đợt rà soát cho mọi **quyền ngoại lệ** còn hiệu lực.
- **Người rà soát:** trưởng đơn vị của vị trí chính của người giữ quyền. Đơn vị không có trưởng thì lên trưởng đơn vị cấp trên gần nhất. Uỷ quyền duyệt (VH-REQ-03) áp cả cho rà soát.
- **Thời hạn:** 14 ngày.
- **Kết quả:** quyền được xác nhận giữ nguyên hạn cũ; quyền bị chọn gỡ hoặc không được xác nhận trong hạn thì **tự gỡ** và báo người giữ quyền.
- Quyền mặc định (từ luật) **không** rà soát từng người; thay vào đó **rà soát luật** mỗi nửa năm (VH-REV-04).
- Ngày nghỉ của công ty (VH-ORG-08) không tính vào 14 ngày.

### VH-BR-17 — Tách nhiệm
Xem bảng xung đột ở mục 6. Hệ thống phải chặn, không chỉ cảnh báo.

### VH-BR-18 — Nhật ký
- **Ghi gì:** mọi tạo, sửa, xoá (mềm) hồ sơ, vị trí, cơ cấu, danh mục, app, vai trò app, luật, quyền, yêu cầu, quyết định duyệt, rà soát; mọi lần xem hồ sơ C1 của người khác; mọi lần khoá hoặc mở khoá.
- **Mỗi dòng nhật ký có:** ai làm, lúc nào, đối tượng, giá trị trước, giá trị sau, lý do (bắt buộc với cấp khẩn cấp, khoá, gỡ tay), địa chỉ IP rút gọn.
- **Giữ 24 tháng** (QĐ-70 VClinks; Q-10). Không ai sửa hay xoá được nhật ký, kể cả quản trị hệ thống.

### VH-BR-19 — Chỉ giữ thông tin công việc
- **VC Home lưu:** mã nhân viên, họ tên, email công ty, ảnh, SĐT công việc, pháp nhân, đơn vị, chức danh, chức năng, quản lý, nơi làm việc, loại nhân viên, ngày vào, ngày nghỉ, trạng thái.
- **Không lưu:** CCCD, ngày sinh, địa chỉ nhà, SĐT cá nhân, lương, hợp đồng, đánh giá. Nếu sau này cần thì phải có quyết định riêng và đánh giá theo Luật Bảo vệ dữ liệu cá nhân.
- **Token** chỉ chứa thông tin công việc (07 mục token).

### VH-BR-20 — App mặc định chặn
- App chỉ cho vào khi token có ít nhất một vai trò app của nó (từ GĐ C).
- Vai trò lạ (app chưa ánh xạ) thì bỏ qua, ghi log, không suy diễn quyền.
- App **không** tự cấp vai trò cho người không có vai trò app. Riêng các app đã có người dùng từ trước, trong giai đoạn chuyển tiếp làm theo Q-14.

### VH-BR-21 — Ô trên trang chủ
- **Trang chủ hiện:**
  - các app người dùng có ít nhất một quyền còn hiệu lực;
  - các app "Sắp có" (ô mờ, không bấm được);
  - các liên kết ngoài do quản trị khai (Gmail, Google Drive, MISA…, mở tab mới, không đăng nhập một lần).
- **Thứ tự:** theo thứ tự quản trị đặt; người dùng ghim được ô hay dùng lên đầu (lưu trên trình duyệt).

### VH-BR-22 — Giờ Việt Nam
Mọi ngày giờ lưu theo UTC, hiển thị và tính hiệu lực theo `Asia/Ho_Chi_Minh`.

### VH-BR-23 — Phạm vi của quản lý
- Quản lý trực tiếp xem được hồ sơ công việc (C1) và quyền của người báo cáo trực tiếp **và cả cây dưới**.
- Trưởng đơn vị xem được của mọi người có vị trí trong đơn vị mình và đơn vị con.
- Không ai xem được hồ sơ C1 của cấp trên hay đồng cấp, trừ HC-NS, kiểm soát và quản trị hệ thống (chỉ đọc, mỗi lần xem ghi nhật ký).

### VH-BR-24 — Kiêm nhiệm sinh quyền
- Luật được đánh giá trên **mọi vị trí còn hiệu lực** (chính và kiêm nhiệm).
- Ví dụ: chị Hoa là NVKD VCparts kiêm CSKH VCservice thì có vai trò NVKD trong VClinks tại VCparts và vai trò CSKH tại VCservice.
- Token ghi đơn vị của từng vai trò (07 mục token) để app tính đúng phạm vi.

### VH-BR-25 — Luật lớn hoặc nhạy cảm phải xem trước và duyệt hai người
- Thêm, sửa hoặc tắt một luật mà làm **thêm hoặc mất quyền của từ 21 người trở lên** thì:
  - người soạn phải xem danh sách người bị ảnh hưởng (VH-ACC-03);
  - người thứ hai (quản trị hệ thống khác, hoặc chủ app của app đó) phải duyệt trước khi luật có hiệu lực.
- Từ 20 người trở xuống, và không phải vai trò nhạy cảm: một người soạn và áp được, vẫn ghi nhật ký.
- **Luật cấp vai trò nhạy cảm** (VH-APP-05) luôn cần người thứ hai duyệt, bất kể bao nhiêu người bị ảnh hưởng (khớp quy định duyệt hai người với vai trò nhạy cảm của VClinks, PQ-42).
- **Thay đổi hàng loạt cũng vậy:** lô nhập Excel, đổi cơ cấu, sửa hồ sơ hàng loạt mà làm thêm hoặc mất quyền của từ 21 người trở lên thì quản trị hệ thống xác nhận lần hai trước khi áp (HC-NS không tự áp, VH-BR-17).
- **Người thứ hai thay thế:** luôn có ít nhất 2 quản trị hệ thống (Q-07). Khi cả hai và chủ app đều vắng quá 2 ngày làm việc, chủ dự án duyệt thay.
- **Lúc áp lệch bản đã duyệt:** khi áp, nếu số người bị ảnh hưởng lệch quá 20% so với bản xem trước đã duyệt thì phải xem trước và duyệt lại.

### VH-BR-26 — Chỉ tài khoản cá nhân, đủ điều kiện mới vào app
- **Có mail công ty chỉ là qua cổng.** Tài khoản Google công ty đăng nhập được VC Home (xem hồ sơ, danh bạ), nhưng **vào app** thì phải đủ điều kiện.
- **Đủ điều kiện ở GĐ A–B** (trước khi quyền đi theo hồ sơ): tài khoản đang hoạt động trên Google, **đã bật xác thực 2 bước**, không nằm trong danh sách loại trừ. `vc-provisioner` cấp và gỡ nhóm app theo điều kiện này (thiết kế SSO mục 5.6).
- **Từ GĐ C:** điều kiện là có hồ sơ VC People "Đang làm" (VH-BR-02); vẫn giữ điều kiện 2 bước và danh sách loại trừ.
- **Danh sách loại trừ** (`directory_exclusions`; GĐ A là tệp `provisioner/loai-tru.yaml` của `vc-platform`): hộp thư dùng chung (`cskh@`, `kho@`…), tài khoản dịch vụ, tài khoản thử, tài khoản chưa rõ chủ. Các tài khoản này **không bao giờ** được vào app nghiệp vụ. Hộp thư chung chuyển thành nhóm thư Google; máy dùng token máy riêng của app.
- Thêm hoặc bỏ một tài khoản khỏi danh sách loại trừ: quản trị hệ thống làm, ghi lý do, ghi nhật ký.

## 5. RACI theo quy trình

Ký hiệu:
- **R:** làm.
- **A:** chịu trách nhiệm cuối.
- **C:** được hỏi ý kiến.
- **I:** được báo.

| Quy trình | Nhân viên | Quản lý | Trưởng ĐV | HC-NS | Quản trị HT | Chủ app | Kiểm soát |
|---|---|---|---|---|---|---|---|
| VH-QT-01 Đăng nhập và mở app | R/A | — | — | — | C (vận hành VC ID) | I | — |
| VH-QT-03 Nhập dữ liệu ban đầu | — | C | C | R/A | R | I | I |
| VH-QT-04 Vào làm | I | C | I | R/A | I | I | — |
| VH-QT-05 Chuyển vị trí | I | C | I | R/A | I | I | — |
| VH-QT-06 Nghỉ việc | I | C | I | R/A | R (khoá gấp nếu cần) | I | I |
| VH-QT-07 Nghỉ dài ngày | I | C | I | R/A | — | I | — |
| VH-QT-08 Xin và duyệt quyền | R | R (bước 1) | — | — | C | R (bước 2) | I |
| VH-QT-09 Rà soát quý | I | C | R | — | A | C | I |
| VH-QT-10 Thêm, sửa luật | — | — | C | C | R/A | R/C | I |
| VH-QT-11 Đưa app mới vào | — | — | — | — | R/A | R | I |
| VH-QT-12 Đổi cơ cấu tổ chức | I | C | C | R/A | I | I | I |
| VH-QT-02 Khoá khẩn cấp | — | C | — | I | R/A | I | I |

## 6. Tách nhiệm

Hệ thống chặn các tổ hợp sau. Nếu một người buộc phải giữ hai vai trò xung đột (công ty nhỏ, thiếu người), quản trị hệ thống bật ngoại lệ có thời hạn, ghi lý do, kiểm soát được báo.

| Không được cùng lúc | Vì sao | Cách chặn |
|---|---|---|
| HC-NS và Quản trị hệ thống | Một người vừa sửa hồ sơ (để thoả luật) vừa sửa luật thì tự cấp được mọi quyền | Không cấp vai trò thứ hai khi đã có vai trò thứ nhất, trừ ngoại lệ có hạn |
| Người xin và người duyệt cùng một yêu cầu | Tự cấp quyền | VH-BR-12 |
| Người soạn luật và người duyệt bước hai của chính luật đó | Tự áp luật lớn | VH-BR-25 |
| Kiểm soát và Quản trị hệ thống | Người bị kiểm tra không tự kiểm tra | Như dòng đầu |
| Người được rà soát và người rà soát | Tự xác nhận quyền của mình | Dòng rà soát của trưởng đơn vị về chính mình chuyển lên trưởng đơn vị cấp trên |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.3 | 08/10/2026 13:49 | Claude Code (vai BA trưởng) | Thêm VH-BR-26: có mail công ty chỉ là qua cổng; vào app phải là tài khoản cá nhân đủ điều kiện (bật 2 bước, không thuộc danh sách loại trừ) | Đánh giá bảo mật luồng đăng nhập, người dùng đồng ý 6 điểm vá ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) D-BA-37…42 |
| 0.2 | 08/10/2026 11:31 | Claude Code (vai BA trưởng) | Sửa VH-BR-09 (vai trò nhạy cảm tối đa 90 ngày), VH-BR-11 (nhập muộn), VH-BR-12 (chuyển người duyệt), VH-BR-16 (đơn vị không có trưởng, uỷ quyền, ngày nghỉ), VH-BR-25 (thay đổi hàng loạt, người duyệt thay, lệch > 20%); ma trận cho kiểm soát xem luật; RACI thêm VH-QT-01 | Người dùng uỷ quyền chốt toàn bộ câu hỏi và đề xuất ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) mục 4, 6 |
| 0.1 | 08/10/2026 10:04 | Claude Code (vai BA) | Tạo tài liệu: tác nhân, vai trò, ma trận quyền, 25 quy tắc, RACI, tách nhiệm | README bộ tài liệu 0.1 |
