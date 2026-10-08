# Bộ tài liệu VC Home — Cổng nhân viên, hồ sơ nhân sự và quyền truy cập tập trung

Phiên bản 0.3 · 08/10/2026 · Trạng thái: Đã chốt nội dung (chờ đội phát triển rà)

## Tóm tắt

- **Bộ tài liệu nói gì:** yêu cầu nghiệp vụ đầy đủ cho **VC Home**, nơi mọi nhân viên VC Phồn Vinh đăng nhập một lần bằng tài khoản Google công ty. VC Home biết người đó là ai trong công ty (hồ sơ, chức danh, đơn vị, chức năng, quản lý) và được vào những app nào với vai trò gì: VClinks, VCwiki, VCsale, VCgarage, VC AI…
- **Ba phân hệ:**
  - **VC ID:** đăng nhập một lần, chạy trên Keycloak.
  - **VC People:** hồ sơ nhân sự và cơ cấu tổ chức. Đây là nguồn sự thật duy nhất của tập đoàn.
  - **Quyền truy cập:** cấp quyền vào app theo luật, xin và duyệt ngoại lệ, rà soát định kỳ.
- **Nguyên tắc cốt lõi:** VC Home cấp **vai trò thô** trong từng app (ví dụ "VClinks · NVKD"); **app giữ quyền chi tiết** và phạm vi dữ liệu. Hồ sơ nhân sự do HC-NS quản lý; quyền đi theo hồ sơ, không gán tay từng người.
- **5 giai đoạn:**
  - A Đăng nhập chung
  - B Hồ sơ và tổ chức
  - C Quyền theo luật và vòng đời nhân viên
  - D Xin quyền, duyệt, rà soát
  - E Mở rộng sang các app khác
  
  Lịch và khối lượng ở [10-ke-hoach-trien-khai.md](10-ke-hoach-trien-khai.md).
- **Quy mô bộ tài liệu:** 13 file nghiệp vụ và 1 thiết kế kỹ thuật GĐ A, gồm 90 yêu cầu, 26 quy tắc, 12 quy trình, 21 màn hình, 28 collection, 13 sự kiện, 10 API, 100 câu chuyện người dùng, 59 ca UAT. Đã soát chéo toàn bộ mã và liên kết; 36 điểm lệch được BA trưởng chốt ở [12](12-cau-hoi-rui-ro.md) mục 5. Khi hai tài liệu ghi khác nhau thì theo mục đó.
- **Quyết định:** cả 15 câu hỏi, 5 câu của thiết kế SSO và toàn bộ đề xuất bổ sung đã được chốt theo khuyến nghị BA (người dùng uỷ quyền ngày 08/10/2026), ghi ở [12-cau-hoi-rui-ro.md](12-cau-hoi-rui-ro.md) mục 4 và 6. **Việc còn mở** chỉ là đầu vào từ bên ngoài (máy chủ, DNS, Google Admin, file Excel của HC-NS) và người làm VC Home ([10](10-ke-hoach-trien-khai.md) mục 4, 5). Repo `vc` cần đổi sang private ngay (RR-13).
- **Người duyệt xem kỹ:**
  - tác động tới VClinks và VCwiki ([01](01-tam-nhin-pham-vi.md) mục 7);
  - quy tắc nghiệp vụ ([02](02-tac-nhan-quy-tac.md) mục 4);
  - hợp đồng tích hợp ([07](07-tich-hop.md));
  - kế hoạch ([10](10-ke-hoach-trien-khai.md)).

## Mục lục

- [1. Danh sách tài liệu và cách đọc](#1-danh-sách-tài-liệu-và-cách-đọc)
- [2. Quy ước mã](#2-quy-ước-mã)
- [3. Thuật ngữ](#3-thuật-ngữ)
- [4. Giai đoạn và bản phát hành](#4-giai-đoạn-và-bản-phát-hành)
- [5. Danh mục yêu cầu chức năng](#5-danh-mục-yêu-cầu-chức-năng)
- [6. Danh mục quy tắc nghiệp vụ](#6-danh-mục-quy-tắc-nghiệp-vụ)
- [7. Danh mục quy trình](#7-danh-mục-quy-trình)
- [8. Danh mục màn hình](#8-danh-mục-màn-hình)
- [9. Danh mục dữ liệu](#9-danh-mục-dữ-liệu)
- [10. Danh mục sự kiện và API cho app](#10-danh-mục-sự-kiện-và-api-cho-app)
- [11. Danh mục nhóm câu chuyện người dùng](#11-danh-mục-nhóm-câu-chuyện-người-dùng)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Danh sách tài liệu và cách đọc

| File | Nội dung | Ai đọc trước |
|---|---|---|
| [README.md](README.md) | Bản này: khung chung, danh mục mọi mã | Mọi người |
| [01-tam-nhin-pham-vi.md](01-tam-nhin-pham-vi.md) | Bối cảnh, vấn đề, mục tiêu và chỉ số, phạm vi theo giai đoạn, các bên liên quan, giả định, ràng buộc, tác động tới app hiện có | Chủ dự án, trưởng nhóm dev |
| [02-tac-nhan-quy-tac.md](02-tac-nhan-quy-tac.md) | Tác nhân, vai trò trong VC Home, ma trận quyền của VC Home, RACI, quy tắc nghiệp vụ VH-BR | BA, dev, kiểm thử |
| [03-quy-trinh.md](03-quy-trinh.md) | 12 quy trình VH-QT: đăng nhập, vào làm, chuyển vị trí, nghỉ việc, xin quyền, rà soát… | HC-NS, quản lý, dev |
| [04-yeu-cau-chuc-nang.md](04-yeu-cau-chuc-nang.md) | Chi tiết từng yêu cầu VH-xxx-NN, tiêu chí nghiệm thu | Dev, kiểm thử |
| [05-du-lieu.md](05-du-lieu.md) | Mô hình dữ liệu, từ điển dữ liệu, trạng thái, phân loại mức mật, thời hạn lưu | Dev backend |
| [06-man-hinh.md](06-man-hinh.md) | Sơ đồ menu theo vai trò, đặc tả từng màn VH-MH | Dev frontend, thiết kế |
| [07-tich-hop.md](07-tich-hop.md) | Hợp đồng tích hợp cho mọi app: token, API, sự kiện, các bước đưa một app vào; hướng dẫn riêng cho VClinks, VCwiki | Đội của từng app |
| [08-phi-chuc-nang.md](08-phi-chuc-nang.md) | Bảo mật, dữ liệu cá nhân, sẵn sàng, hiệu năng, nhật ký, sao lưu | Dev, vận hành |
| [09-user-story.md](09-user-story.md) | Câu chuyện người dùng theo nhóm VH-E, tiêu chí Given/When/Then | Dev, kiểm thử |
| [10-ke-hoach-trien-khai.md](10-ke-hoach-trien-khai.md) | Giai đoạn, bản phát hành, ước lượng, phụ thuộc, đầu vào ngoài, định nghĩa sẵn sàng và xong, ma trận truy vết | Chủ dự án, trưởng nhóm dev |
| [11-uat.md](11-uat.md) | Kịch bản UAT, dữ liệu thử | Kiểm thử, người dùng thử |
| [12-cau-hoi-rui-ro.md](12-cau-hoi-rui-ro.md) | Quyết định đã chốt, giả định, rủi ro, xử lý đề xuất | Chủ dự án |
| [ky-thuat/thiet-ke-sso-keycloak.md](ky-thuat/thiet-ke-sso-keycloak.md) | Thiết kế kỹ thuật GĐ A: Keycloak, VC Home, thay đổi theo file ở VClinks và VCwiki | Dev |

**Đọc theo vai trò:**

| Vai trò | Đọc theo thứ tự |
|---|---|
| Chủ dự án | README → 01 → 12 → 10 |
| Trưởng nhóm dev | README → 01 → 02 → 04 → 05 → 07 → 10 → `ky-thuat/` |
| Dev frontend | 02 → 06 → 09 |
| Đội app khác | 07 → 02 mục 4 |
| HC-NS, quản lý | 01 → 03 → 06 (các màn của mình) |

## 2. Quy ước mã

| Loại | Mẫu | Ví dụ | Định nghĩa ở |
|---|---|---|---|
| Yêu cầu chức năng | `VH-<PHÂN HỆ>-NN` | `VH-ACC-01` | 04 |
| Quy tắc nghiệp vụ | `VH-BR-NN` | `VH-BR-09` | 02 |
| Quy trình | `VH-QT-NN` | `VH-QT-05` | 03 |
| Màn hình | `VH-MH-NN` | `VH-MH-08` | 06 |
| Yêu cầu phi chức năng | `VH-NFR-NN` | `VH-NFR-03` | 08 |
| Nhóm câu chuyện / câu chuyện | `VH-E-NN` / `VH-US-NNN` | `VH-E-04` / `VH-US-041` | 09 |
| API cho app | `VH-API-NN` | `VH-API-02` | 07 |
| Sự kiện | `vh.<đối tượng>.<việc>` | `vh.person.left` | 07 |
| Ca UAT | `VH-UAT-NN` | `VH-UAT-12` | 11 |
| Câu hỏi / rủi ro | `VH-Q-NN` / `VH-RR-NN` (viết gọn Q-NN, RR-NN) | `Q-06` | 12 |

**Mức ưu tiên (MoSCoW):**
- **M** (Must): bắt buộc trong giai đoạn đó.
- **S** (Should): nên có.
- **C** (Could): làm nếu còn sức.
- **W** (Won't): không làm lần này, ghi để sau.

Không xoá mã đã cấp, không dùng lại mã. Yêu cầu bỏ thì đổi trạng thái thành "Bỏ" kèm lý do.

## 3. Thuật ngữ

| Thuật ngữ | Nghĩa |
|---|---|
| **VC Home** | Cổng nhân viên tại `home.vcprosperous.com`: trang chủ, hồ sơ, danh bạ, quyền, duyệt, quản trị |
| **VC ID** | Máy chủ định danh (Keycloak) tại `id.vcprosperous.com`; lo đăng nhập, phiên, đăng xuất, khoá |
| **VC People** | Phân hệ hồ sơ nhân sự và cơ cấu tổ chức của VC Home; nguồn sự thật về "ai là ai" cho mọi app |
| **App** | Một ứng dụng trong hệ: VClinks, VCwiki, VCsale, VCgarage, VC AI, VCe, VCinvoice… VC Home cũng là một app |
| **Nhân viên** | Người có hồ sơ trên VC People, có mã nhân viên duy nhất toàn tập đoàn |
| **Tài khoản** | Tài khoản đăng nhập trên VC ID, gắn 1–1 với nhân viên; định danh bằng `sub` |
| **Đơn vị** | Một nút trong cây tổ chức: Tập đoàn → Pháp nhân / Division → Phòng → Tổ / Nhóm |
| **Chức danh** | Tên vị trí (Nhân viên kinh doanh, Trưởng phòng CSKH…) |
| **Chức năng** | Mảng việc (Bán hàng, CSKH, Sale admin, Kế toán, Kỹ thuật, Marketing, Nhân sự, IT…); dùng để cấp quyền theo luật |
| **Vị trí công tác** | Bộ (đơn vị, chức danh, chức năng, quản lý trực tiếp, từ ngày, đến ngày). Mỗi nhân viên đang làm có đúng 1 vị trí chính và có thể kiêm nhiệm thêm |
| **Vai trò app** | Vai trò thô mà một app công bố (VClinks: `nvkd`, `cskh`, `giam_sat_bh`…). VC Home cấp vai trò app; app tự ánh xạ sang quyền chi tiết |
| **Quyền (grant)** | Một dòng "nhân viên X có vai trò R trong app A", kèm nguồn (luật / yêu cầu / khẩn cấp), hạn dùng, trạng thái |
| **Luật cấp quyền** | Điều kiện trên hồ sơ (division, đơn vị, chức danh, chức năng, loại nhân viên) → vai trò app. Quyền từ luật gọi là **quyền mặc định** |
| **Quyền ngoại lệ** | Quyền có được qua yêu cầu được duyệt hoặc cấp khẩn cấp; luôn có hạn |
| **Vào làm / Chuyển / Nghỉ** | Ba sự kiện vòng đời nhân viên (tiếng Anh: Joiner / Mover / Leaver) |
| **Rà soát** | Đợt định kỳ trưởng đơn vị xác nhận lại quyền ngoại lệ của người dưới quyền |
| **Chủ app** | Người chịu trách nhiệm một app: khai vai trò app, duyệt yêu cầu vai trò nhạy cảm |
| **Mức mật C0–C3** | Bảng phân loại dữ liệu dùng chung với VClinks và VCwiki (C0 công khai nội bộ → C3 nhạy cảm) |

## 4. Giai đoạn và bản phát hành

| GĐ | Bản | Tên | Mục tiêu một câu | Đích (đề xuất) |
|---|---|---|---|---|
| A | R1 | Đăng nhập chung | Một lần đăng nhập Google vào VC Home, VClinks, VCwiki; đăng xuất và khoá chung | 31/10/2026 |
| B | R2 | Hồ sơ và tổ chức | VC Home biết mỗi người là ai: hồ sơ, đơn vị, chức danh, chức năng, quản lý; app đọc được qua token và API | 20/11/2026 |
| C | R3 | Quyền theo luật và vòng đời | Vào làm có ngay đúng app và vai trò; chuyển vị trí tự đổi quyền; nghỉ việc tự khoá; app nhận sự kiện | 11/12/2026 |
| D | R4 | Xin quyền, duyệt, rà soát | Ngoại lệ có người duyệt, có hạn; rà soát hằng quý; thông báo | 22/01/2027 (trước Tết) |
| E | R5 | Mở rộng | VCsale, VCgarage, VC AI, VCe, VCinvoice vào theo hợp đồng; ô app có số việc chờ; nguồn nhân sự tự động | Q1–Q2/2027 |

## 5. Danh mục yêu cầu chức năng

| Mã | Tên | Ưu tiên | GĐ |
|---|---|---|---|
| **AUT — Đăng nhập và phiên** | | | |
| VH-AUT-01 | Đăng nhập bằng tài khoản Google công ty qua VC ID | M | A |
| VH-AUT-02 | Chặn tài khoản ngoài hai domain công ty | M | A |
| VH-AUT-03 | Đăng nhập một lần giữa các app | M | A |
| VH-AUT-04 | Đăng xuất một nơi là đăng xuất mọi app | M | A |
| VH-AUT-05 | Thời hạn phiên: 12 giờ không dùng, tối đa 7 ngày | M | A |
| VH-AUT-06 | Khoá tài khoản khẩn cấp | M | A |
| VH-AUT-07 | Đồng bộ trạng thái tài khoản Google (bị khoá, bị xoá → khoá) | M | A |
| VH-AUT-08 | Gắn tài khoản đăng nhập với hồ sơ nhân sự | M | B |
| VH-AUT-09 | Đường đăng nhập khẩn cấp khi VC ID hoặc Google không dùng được | S | A |
| VH-AUT-10 | Xem và đăng xuất các phiên của chính mình | C | D |
| **HOM — Trang chủ và chuyển app** | | | |
| VH-HOM-01 | Lưới app theo quyền | M | A |
| VH-HOM-02 | Thẻ hồ sơ ngắn trên trang chủ | M | B |
| VH-HOM-03 | Hiện vai trò trên ô app | S | C |
| VH-HOM-04 | Ô "Có thể xin quyền" | S | D |
| VH-HOM-05 | Thanh chuyển app trong từng app | S | A |
| VH-HOM-06 | Ô app "Sắp có" và ô liên kết ngoài | C | A |
| VH-HOM-07 | Số việc chờ trên ô app | C | E |
| VH-HOM-08 | Thông báo trong VC Home | S | D |
| VH-HOM-09 | Dải "Việc đang chờ bạn" trên trang chủ | C | D |
| **NSU — Hồ sơ nhân sự (VC People)** | | | |
| VH-NSU-01 | Hồ sơ nhân sự | M | B |
| VH-NSU-02 | Vị trí công tác chính và kiêm nhiệm | M | B |
| VH-NSU-03 | Quản lý trực tiếp và cây quản lý | M | B |
| VH-NSU-04 | Trạng thái làm việc có ngày hiệu lực | M | B |
| VH-NSU-05 | Lịch sử thay đổi hồ sơ | M | B |
| VH-NSU-06 | Hồ sơ của tôi và đề nghị sửa | M | B |
| VH-NSU-07 | Danh bạ công ty | S | B |
| VH-NSU-08 | Che thông tin theo người xem | M | B |
| VH-NSU-09 | Nhân viên tự sửa tên gọi, ảnh, SĐT công việc | S | B |
| **ORG — Cơ cấu tổ chức** | | | |
| VH-ORG-01 | Cây đơn vị nhiều cấp | M | B |
| VH-ORG-02 | Danh mục chức danh | M | B |
| VH-ORG-03 | Danh mục chức năng | M | B |
| VH-ORG-04 | Trưởng đơn vị | M | B |
| VH-ORG-05 | Đổi cơ cấu có ngày hiệu lực (đổi tên, chuyển, gộp, ngừng) | S | C |
| VH-ORG-06 | Sơ đồ tổ chức | S | B |
| VH-ORG-07 | Danh mục pháp nhân và nơi làm việc | S | B |
| VH-ORG-08 | Lịch ngày nghỉ của công ty (dừng đồng hồ của yêu cầu và rà soát) | S | D |
| VH-ORG-09 | Gộp mục trùng trong danh mục | S | B |
| **APP — Danh mục app và vai trò app** | | | |
| VH-APP-01 | Danh mục app | M | A (tệp tĩnh), B (quản trị trên màn) |
| VH-APP-02 | Vai trò của từng app | M | C |
| VH-APP-03 | Chủ app | M | C |
| VH-APP-04 | Đưa app mới vào theo hợp đồng tích hợp | S | E |
| VH-APP-05 | Vai trò nhạy cảm | M | C |
| VH-APP-06 | Thời gian chuyển tiếp khi chuyển vị trí, đặt riêng từng app | S | C |
| VH-APP-07 | Vai trò app "cho phép xin" | S | D |
| **ACC — Cấp và gỡ quyền** | | | |
| VH-ACC-01 | Luật cấp quyền mặc định theo hồ sơ | M | C |
| VH-ACC-02 | Tính lại quyền khi hồ sơ, cơ cấu hoặc luật đổi | M | C |
| VH-ACC-03 | Xem trước tác động của luật | M | C |
| VH-ACC-04 | Cấp quyền khẩn cấp có lý do và hạn tối đa 7 ngày | S | C |
| VH-ACC-05 | Quyền có hạn dùng, tự gỡ khi hết hạn | M | D |
| VH-ACC-06 | Gỡ quyền | M | C |
| VH-ACC-07 | Đẩy quyền sang VC ID (nhóm, vai trò app) | M | C |
| VH-ACC-08 | Tra cứu "ai có quyền gì", "người này có quyền gì" | M | C |
| VH-ACC-09 | Người giữ quyền tự trả quyền ngoại lệ | S | D |
| **REQ — Xin quyền và duyệt** | | | |
| VH-REQ-01 | Gửi yêu cầu quyền | M | D |
| VH-REQ-02 | Luồng duyệt: quản lý trực tiếp, thêm chủ app nếu vai trò nhạy cảm | M | D |
| VH-REQ-03 | Uỷ quyền duyệt khi vắng | S | D |
| VH-REQ-04 | Nhắc duyệt và tự huỷ yêu cầu quá hạn | S | D |
| VH-REQ-05 | Quản lý xin quyền thay cho người dưới quyền | C | D |
| VH-REQ-06 | Gia hạn quyền sắp hết hạn | S | D |
| VH-REQ-07 | Duyệt nhiều yêu cầu một lần (không áp cho vai trò nhạy cảm) | S | D |
| **REV — Rà soát định kỳ** | | | |
| VH-REV-01 | Mở đợt rà soát định kỳ | S | D |
| VH-REV-02 | Trưởng đơn vị xác nhận hoặc gỡ | S | D |
| VH-REV-03 | Tự gỡ quyền không được xác nhận và báo cáo kết quả | S | D |
| VH-REV-04 | Rà soát luật nửa năm | S | D |
| **LCM — Vòng đời nhân viên** | | | |
| VH-LCM-01 | Vào làm | M | C |
| VH-LCM-02 | Chuyển vị trí | M | C |
| VH-LCM-03 | Nghỉ việc theo ngày hiệu lực | M | C |
| VH-LCM-04 | Nghỉ dài ngày và quay lại | S | D |
| VH-LCM-05 | Quay lại làm sau khi đã nghỉ | C | D |
| **INT — Tích hợp app** | | | |
| VH-INT-01 | Bộ claim chuẩn trong token theo giai đoạn | M | A, B, C |
| VH-INT-02 | API danh bạ và cơ cấu cho app | M | B |
| VH-INT-03 | Sự kiện thay đổi gửi app (có chữ ký, gửi lại) | M | C |
| VH-INT-04 | Đăng xuất phía máy chủ (back-channel) | M | A |
| VH-INT-05 | Kéo sự kiện dự phòng | S | C |
| VH-INT-06 | Token máy cho app gọi API VC Home | M | B |
| VH-INT-07 | API trạng thái app cho ô app | C | E |
| VH-INT-08 | Cấp tài khoản theo chuẩn SCIM cho app mua ngoài | W | — |
| VH-INT-09 | Sự kiện báo trước nghỉ việc, chuyển vị trí | S | C |
| VH-INT-10 | Sự kiện thử và nút "Gửi thử" | S | C |
| **ADM — Quản trị và nhật ký** | | | |
| VH-ADM-01 | Nhật ký thao tác | M | A trở đi |
| VH-ADM-02 | Báo cáo truy cập | S | C |
| VH-ADM-03 | Vai trò quản trị của chính VC Home | M | B |
| VH-ADM-04 | Cảnh báo vận hành | S | A |
| VH-ADM-05 | Cài đặt hệ thống (thời hạn, nhắc, lịch rà soát) | S | D |
| VH-ADM-06 | Cảnh báo quyền không dùng 90 ngày | S | D |
| **IMP — Nhập và đồng bộ dữ liệu** | | | |
| VH-IMP-01 | Nhập nhân sự và cơ cấu từ Excel | M | B |
| VH-IMP-02 | Đối chiếu với Google Workspace | M | B |
| VH-IMP-03 | Lấy dữ liệu khởi đầu từ cây tổ chức của VClinks và VCwiki | S | B |
| VH-IMP-04 | Đồng bộ tự động từ phần mềm nhân sự | C | E |
| VH-IMP-05 | Hoàn tác lô nhập trong 24 giờ | S | B |

Tổng: 90 yêu cầu (M: 46 · S: 35 · C: 8 · W: 1). 12 yêu cầu cuối mỗi phân hệ (VH-HOM-09, VH-NSU-09, VH-ORG-08, 09, VH-APP-07, VH-ACC-09, VH-REQ-07, VH-REV-04, VH-INT-09, 10, VH-ADM-06, VH-IMP-05) được nhận từ đề xuất bổ sung ngày 08/10/2026 ([12](12-cau-hoi-rui-ro.md) mục 6).

## 6. Danh mục quy tắc nghiệp vụ

Chi tiết và ví dụ ở [02-tac-nhan-quy-tac.md](02-tac-nhan-quy-tac.md) mục 4.

| Mã | Quy tắc (rút gọn) |
|---|---|
| VH-BR-01 | Một nhân viên một tài khoản; khoá nghiệp vụ là mã nhân viên, khoá kỹ thuật là `sub`; email đổi được |
| VH-BR-02 | Chỉ email `@vcprosperous.com`, `@vcpart.vn` của Google Workspace công ty được đăng nhập |
| VH-BR-03 | VC People là nguồn sự thật về hồ sơ và cơ cấu; app không sửa hồ sơ, chỉ đọc |
| VH-BR-04 | Nhân viên đang làm có đúng 1 vị trí chính; 0..n kiêm nhiệm, mỗi vị trí có từ ngày, đến ngày |
| VH-BR-05 | Mỗi nhân viên có đúng 1 quản lý trực tiếp (trừ người đứng đầu tập đoàn); cây quản lý không có vòng |
| VH-BR-06 | Cây đơn vị không có vòng; đơn vị còn người không xoá được, chỉ ngừng; mỗi đơn vị tối đa 1 trưởng |
| VH-BR-07 | Thay đổi hồ sơ, cơ cấu có ngày hiệu lực, áp lúc 00:00 giờ Việt Nam; hẹn trước được |
| VH-BR-08 | Mỗi quyền là một cặp (app, vai trò app); không có quyền "vào app" không vai trò |
| VH-BR-09 | Ba nguồn quyền: luật (không hạn), yêu cầu được duyệt (bắt buộc hạn, mặc định 90 ngày, tối đa 365; vai trò nhạy cảm tối đa 90), khẩn cấp (tối đa 7 ngày) |
| VH-BR-10 | Luật chỉ dựa trên thuộc tính hồ sơ; không viết luật cho một người cụ thể |
| VH-BR-11 | Hồ sơ hoặc luật đổi thì quyền mặc định tính lại ngay; quyền mất bị gỡ sau thời gian chuyển tiếp của app (mặc định 0, tối đa 7 ngày) |
| VH-BR-12 | Không ai tự duyệt cho mình; bước 1 là quản lý trực tiếp; vai trò nhạy cảm cần thêm chủ app |
| VH-BR-13 | Yêu cầu chưa xong sau 7 ngày tự huỷ |
| VH-BR-14 | Nghỉ việc: 00:00 ngày nghỉ thì khoá đăng nhập và đăng xuất mọi app, gỡ mọi quyền, gửi sự kiện để app bàn giao, đóng vị trí; hồ sơ giữ lại theo thời hạn lưu |
| VH-BR-15 | Nghỉ dài ngày: giữ quyền, không khoá; gửi sự kiện "vắng" để app chia việc |
| VH-BR-16 | Rà soát quyền ngoại lệ hằng quý; quá 14 ngày (không tính ngày nghỉ công ty) không xác nhận thì tự gỡ; rà soát luật nửa năm |
| VH-BR-17 | Tách nhiệm: HC-NS không cấp quyền; quản trị hệ thống không sửa hồ sơ nhân sự; chủ app chỉ quản vai trò app của mình; người xin không duyệt |
| VH-BR-18 | Mọi thay đổi hồ sơ, cơ cấu, luật, quyền đều ghi nhật ký (ai, lúc nào, trước/sau, lý do); giữ 24 tháng |
| VH-BR-19 | VC Home chỉ giữ thông tin công việc (mức C0–C1); không lưu CCCD, lương, địa chỉ nhà; token chỉ chứa thông tin công việc |
| VH-BR-20 | App giữ quyền chi tiết; token không có vai trò app thì app phải từ chối (mặc định chặn) |
| VH-BR-21 | Trang chủ hiện app có ít nhất một quyền còn hiệu lực, cộng ô "Sắp có" và ô liên kết ngoài |
| VH-BR-22 | Mọi ngày giờ theo `Asia/Ho_Chi_Minh` |
| VH-BR-23 | Quản lý và trưởng đơn vị xem được hồ sơ công việc và quyền của cả cây dưới quyền |
| VH-BR-24 | Vị trí kiêm nhiệm cũng sinh quyền mặc định như vị trí chính |
| VH-BR-25 | Luật, lô nhập, đổi cơ cấu hay sửa hồ sơ hàng loạt làm thay đổi quyền của từ 21 người trở lên, hoặc luật cấp vai trò nhạy cảm, phải xem trước và có người thứ hai xác nhận (quản trị hệ thống khác, hoặc chủ app của app đó) |
| VH-BR-26 | Có mail công ty chỉ là qua cổng; vào app phải là tài khoản cá nhân đủ điều kiện (bật xác thực 2 bước, không thuộc danh sách loại trừ như hộp thư dùng chung, tài khoản dịch vụ) |

## 7. Danh mục quy trình

| Mã | Quy trình | GĐ |
|---|---|---|
| VH-QT-01 | Đăng nhập và mở app | A |
| VH-QT-02 | Đăng xuất và khoá khẩn cấp | A |
| VH-QT-03 | Nhập dữ liệu nhân sự và cơ cấu ban đầu | B |
| VH-QT-04 | Vào làm | C |
| VH-QT-05 | Chuyển vị trí, thăng chức, kiêm nhiệm | C |
| VH-QT-06 | Nghỉ việc | C |
| VH-QT-07 | Nghỉ dài ngày và quay lại | D |
| VH-QT-08 | Xin và duyệt quyền ngoại lệ | D |
| VH-QT-09 | Rà soát quyền hằng quý | D |
| VH-QT-10 | Thêm hoặc sửa luật cấp quyền | C |
| VH-QT-11 | Đưa một app mới vào VC Home | E (bản đầu ở C cho VClinks, VCwiki) |
| VH-QT-12 | Đổi cơ cấu tổ chức | C |

## 8. Danh mục màn hình

| Mã | Màn | Ai dùng | GĐ |
|---|---|---|---|
| VH-MH-01 | Trang chào (chưa đăng nhập), đã đăng xuất, lỗi | Mọi người | A |
| VH-MH-02 | Trang chủ: thẻ hồ sơ, lưới app | Mọi người | A (lưới), B (thẻ hồ sơ) |
| VH-MH-03 | Hồ sơ của tôi | Mọi người | B |
| VH-MH-04 | Quyền của tôi | Mọi người | C (xem), D (xin, gia hạn) |
| VH-MH-05 | Ngăn gửi yêu cầu quyền | Mọi người | D |
| VH-MH-06 | Danh bạ công ty | Mọi người | B |
| VH-MH-07 | Sơ đồ tổ chức | Mọi người | B |
| VH-MH-08 | Hộp duyệt (có ngăn Uỷ quyền) | Quản lý, trưởng đơn vị (duyệt thay), chủ app, quản trị hệ thống (bước 2 thay), người được uỷ quyền | D |
| VH-MH-09 | Đội của tôi | Quản lý, trưởng đơn vị | B (hồ sơ), C (quyền) |
| VH-MH-10 | Rà soát quyền | Trưởng đơn vị | D |
| VH-MH-11 | Quản trị: Nhân sự (ngăn Tài khoản: khoá, mở khoá, gắn lại — chỉ quản trị hệ thống) | HC-NS, quản trị hệ thống | B |
| VH-MH-12 | Quản trị: Cơ cấu tổ chức | HC-NS | B |
| VH-MH-13 | Quản trị: Danh mục (chức danh, chức năng, pháp nhân, nơi làm việc) | HC-NS | B |
| VH-MH-14 | Quản trị: Nhập dữ liệu và đối chiếu | HC-NS, quản trị hệ thống | B |
| VH-MH-15 | Quản trị: App và vai trò app | Quản trị hệ thống, chủ app, kiểm soát (chỉ đọc) | B (app), C (vai trò) |
| VH-MH-16 | Quản trị: Luật cấp quyền và xem trước | Quản trị hệ thống, chủ app | C |
| VH-MH-17 | Quản trị: Tra cứu quyền và báo cáo | Quản trị hệ thống, kiểm soát, chủ app; BGĐ, trưởng đơn vị, HC-NS xem báo cáo trong phạm vi; ngoại lệ tách nhiệm quản lý ở đây | C |
| VH-MH-18 | Quản trị: Đợt rà soát | Quản trị hệ thống, kiểm soát | D |
| VH-MH-19 | Quản trị: Nhật ký | Quản trị hệ thống, kiểm soát; HC-NS (hồ sơ) và chủ app (app mình) trong phạm vi | B |
| VH-MH-20 | Quản trị: Cài đặt | Quản trị hệ thống | D |
| VH-MH-21 | Thanh chuyển app (thành phần nằm trong từng app) | Mọi người | A |

## 9. Danh mục dữ liệu

Chi tiết ở [05-du-lieu.md](05-du-lieu.md). Tên collection theo quy ước MongoDB của tập đoàn (snake_case, số nhiều).

| Collection | Nội dung | GĐ |
|---|---|---|
| `people` | Nhân viên: mã, họ tên, email công ty, ảnh, pháp nhân, loại nhân viên, trạng thái, ngày vào, ngày nghỉ | B |
| `accounts` | Liên kết nhân viên ↔ tài khoản VC ID (`sub`), lần đăng nhập cuối | B |
| `positions` | Vị trí công tác: nhân viên, đơn vị, chức danh, chức năng, quản lý trực tiếp, chính/kiêm nhiệm, từ ngày, đến ngày | B |
| `org_units` | Đơn vị: mã, tên, loại, đơn vị cha, pháp nhân, trưởng đơn vị, trạng thái, hiệu lực | B |
| `job_titles`, `job_functions`, `legal_entities`, `work_locations` | Danh mục | B |
| `scheduled_changes` | Thay đổi hồ sơ hoặc cơ cấu hẹn ngày hiệu lực | B |
| `apps` | Danh mục app: khoá, tên, URL, biểu tượng, trạng thái, chủ app, thời gian chuyển tiếp, URL nhận sự kiện | A (tệp `catalog.json`), B (collection) |
| `app_roles` | Vai trò app: app, khoá, tên, mô tả, nhạy cảm | C |
| `access_rules` | Luật: điều kiện → (app, vai trò), trạng thái, người duyệt | C |
| `access_grants` | Quyền: nhân viên, app, vai trò, nguồn, luật/yêu cầu gốc, hạn, trạng thái | C |
| `access_requests`, `approval_steps` | Yêu cầu và các bước duyệt | D |
| `delegations` | Uỷ quyền duyệt khi vắng | D |
| `review_campaigns`, `review_items` | Đợt rà soát và từng dòng xác nhận | D |
| `event_outbox`, `event_deliveries` | Sự kiện gửi app và lần gửi | C |
| `audit_log` | Nhật ký của VC Home (ở GĐ A nhật ký đăng nhập nằm trong VC ID) | B |
| `import_batches` | Lô nhập Excel, kết quả đối chiếu | B |
| `notifications` | Thông báo trong VC Home (GĐ C gửi bằng email Gmail công ty) | D |
| `profile_change_requests` | Đề nghị sửa hồ sơ của nhân viên, chờ HC-NS xử lý (VH-NSU-06) | B |
| `system_settings` | Cài đặt hệ thống: giá trị, người sửa, lý do (VH-ADM-05) | B |
| `directory_exclusions` | Tài khoản Google không phải người (hộp thư chung, tài khoản dịch vụ), bỏ qua khi đối chiếu (VH-IMP-02) | B |
| `sod_exceptions` | Ngoại lệ tách nhiệm có thời hạn (02 mục 6) | C |
| `company_holidays` | Ngày nghỉ của công ty, dừng đồng hồ 7 ngày của yêu cầu và 14 ngày của rà soát (VH-ORG-08) | D |

## 10. Danh mục sự kiện và API cho app

Chi tiết ở [07-tich-hop.md](07-tich-hop.md).

| Sự kiện | Khi nào | GĐ |
|---|---|---|
| `vh.person.joined` | Nhân viên mới có hiệu lực | C |
| `vh.person.updated` | Đổi tên, tên gọi, email, ảnh, SĐT công việc, loại nhân viên, pháp nhân, nơi làm việc | C |
| `vh.person.moved` | Đổi vị trí chính, thêm hoặc bỏ kiêm nhiệm, đổi quản lý | C |
| `vh.person.leave_started` / `vh.person.returned` | Bắt đầu, kết thúc nghỉ dài ngày | D |
| `vh.person.left` | Nghỉ việc có hiệu lực | C |
| `vh.person.locked` / `vh.person.unlocked` | Khoá tạm (gồm khoá khẩn cấp VH-AUT-06, khoá do Google) và mở khoá | C |
| `vh.grant.added` / `vh.grant.removed` | Thêm, gỡ vai trò app (gửi cho đúng app đó) | C |
| `vh.org.unit_changed` | Thêm, đổi tên, chuyển, gộp, ngừng đơn vị; đổi trưởng đơn vị | C |
| `vh.person.change_scheduled` | HC-NS lưu ngày nghỉ việc hoặc chuyển vị trí trong tương lai (báo trước, VH-INT-09) | C |
| `vh.test.ping` | Sự kiện thử khi bấm "Gửi thử" (VH-INT-10) | C |

| Mã | API | GĐ |
|---|---|---|
| VH-API-01 | Lấy một nhân viên (theo mã nhân viên hoặc theo `sub`) | B |
| VH-API-02 | Danh sách nhân viên (lọc theo đơn vị có cây con, chức năng, trạng thái, thay đổi từ thời điểm) | B |
| VH-API-03 | Chuỗi quản lý của một nhân viên | B |
| VH-API-04 | Cây đơn vị và một đơn vị | B |
| VH-API-05 | Danh mục chức danh, chức năng, pháp nhân, nơi làm việc | B |
| VH-API-06 | Danh sách quyền của app gọi (ai có vai trò gì trong app này) | C |
| VH-API-07 | Kéo sự kiện từ một mốc (dự phòng khi nhận sự kiện bị gián đoạn) | C |
| VH-API-08 | Danh mục app công khai (`catalog.json`) | A |
| VH-API-09 | Trạng thái app cho ô app (do app cung cấp, VC Home gọi) | E |
| VH-API-10 | Danh sách vai trò app của chính app gọi | C |

VH-API-01…07 và VH-API-10 nằm trên VC Home API với tiền tố `/api/v1`. VH-API-08 là tệp tĩnh `catalog.json` của trang VC Home. VH-API-09 do từng app cung cấp (`GET /api/vc-app/status`).

## 11. Danh mục nhóm câu chuyện người dùng

| Mã | Nhóm | GĐ |
|---|---|---|
| VH-E-01 | Đăng nhập một lần và đăng xuất chung | A |
| VH-E-02 | Trang chủ và chuyển app | A, B |
| VH-E-03 | Hồ sơ nhân sự và danh bạ | B |
| VH-E-04 | Cơ cấu tổ chức | B |
| VH-E-05 | Nhập và đối chiếu dữ liệu ban đầu | B |
| VH-E-06 | Danh mục app và vai trò app | B, C |
| VH-E-07 | Quyền theo luật | C |
| VH-E-08 | Vòng đời nhân viên | C, D |
| VH-E-09 | Xin quyền và duyệt | D |
| VH-E-10 | Rà soát định kỳ | D |
| VH-E-11 | Tích hợp app | A–C |
| VH-E-12 | Quản trị, nhật ký, báo cáo | A–D |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.3 | 08/10/2026 13:49 | Claude Code (vai BA trưởng) | Thêm VH-BR-26 (26 quy tắc); thêm 3 kế hoạch code GĐ B, C, D trong `ky-thuat/` | Đánh giá bảo mật luồng đăng nhập, người dùng đồng ý 6 điểm vá ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) D-BA-37…42 |
| 0.2 | 08/10/2026 11:31 | Claude Code (vai BA trưởng) | Thêm 12 yêu cầu nhận thêm vào sổ mã (tổng 90), collection `company_holidays` (tổng 28), 2 sự kiện `vh.person.change_scheduled`, `vh.test.ping` (tổng 13), VH-API-10; ghi trạng thái: mọi câu hỏi và đề xuất đã chốt, chỉ còn đầu vào bên ngoài | Người dùng uỷ quyền chốt toàn bộ câu hỏi và đề xuất ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) mục 4, 6 |
| 0.1 | 08/10/2026 10:04 → 11:16 | Claude Code (vai BA trưởng, 5 người viết song song) | Tạo bộ tài liệu: khung chung, quy ước mã, thuật ngữ, giai đoạn, danh mục 78 yêu cầu, 25 quy tắc, 12 quy trình, 21 màn hình, dữ liệu, sự kiện, API, 12 nhóm câu chuyện | Yêu cầu người dùng 08/10/2026; thiết kế SSO 0.1; khảo sát Okta, Microsoft Entra, MISA AMIS, Base.vn; đọc code VClinks và VCwiki |
