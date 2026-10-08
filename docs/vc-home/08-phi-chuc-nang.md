# VC Home — Yêu cầu phi chức năng

Phiên bản 0.1 · 08/10/2026 · Trạng thái: Nháp (chờ duyệt)

## Tóm tắt

- **Tài liệu nói gì:** 20 yêu cầu phi chức năng VH-NFR, gồm bảo mật, dữ liệu cá nhân, nhật ký, độ sẵn sàng, hiệu năng, quy mô, trải nghiệm, vận hành, bảo trì và chi phí. Mỗi yêu cầu có con số đo được và giai đoạn áp dụng.
- **Ba yêu cầu nặng ký nhất:**
  - **Mặc định chặn (VH-NFR-02):** thiếu vai trò thì không vào app.
  - **Dữ liệu cá nhân (VH-NFR-07, 08):** chỉ thông tin công việc, máy chủ đặt tại Việt Nam, có thông báo xử lý dữ liệu cho nhân viên.
  - **VC ID sập không làm dừng việc (VH-NFR-10):** phiên đang có ở app vẫn chạy 12 giờ.
- **Con số chính:**
  - Sẵn sàng 99,5% giờ làm việc.
  - Mất dữ liệu tối đa 24 giờ (RPO), khôi phục trong 4 giờ (RTO).
  - Trang chủ tải ≤ 1,5 giây (p95: 95% lượt tải nhanh hơn mức này).
  - Tính lại quyền cả công ty ≤ 5 phút.
  - Sự kiện tới app ≤ 1 phút (p95).
- **Người duyệt xem kỹ:** VH-NFR-07, 08 (dữ liệu cá nhân, cần pháp chế), VH-NFR-10 (sẵn sàng), VH-NFR-20 (chi phí).

## Mục lục

- [1. Bảo mật](#1-bảo-mật)
- [2. Dữ liệu cá nhân và nhật ký](#2-dữ-liệu-cá-nhân-và-nhật-ký)
- [3. Sẵn sàng, sao lưu, hiệu năng, quy mô](#3-sẵn-sàng-sao-lưu-hiệu-năng-quy-mô)
- [4. Trải nghiệm](#4-trải-nghiệm)
- [5. Vận hành, bảo trì, chi phí](#5-vận-hành-bảo-trì-chi-phí)
- [6. Cách kiểm](#6-cách-kiểm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Bảo mật

| Mã | Yêu cầu | Đo bằng | GĐ |
|---|---|---|---|
| VH-NFR-01 | **Xác thực chuẩn.** OpenID Connect (OIDC), luồng Authorization Code kèm PKCE S256. Kiểm `id_token` đủ 6 điểm (chữ ký JWKS, `iss`, `aud`, `exp`, `nonce`, `email_verified`). Xác thực 2 bước bắt buộc trên Google Workspace cho cả 2 domain | Test tự động mọi ca sai; Google Admin báo 100% tài khoản bật 2 bước | A |
| VH-NFR-02 | **Mặc định chặn.** Mọi API của VC Home kiểm quyền ở server theo ma trận [02](02-tac-nhan-quy-tac.md) mục 3. App từ chối token không có vai trò app của mình (VH-BR-20). Giao diện ẩn nút chỉ để tiện dùng, không thay cho kiểm ở server | Test quyền: mỗi vai trò × mỗi API, gọi bằng vai trò không đủ phải ra 403 | A trở đi |
| VH-NFR-03 | **Mã hoá.** TLS 1.2 trở lên ở mọi kết nối ngoài, HSTS. Ổ đĩa máy chủ mã hoá. Bản sao lưu mã hoá trước khi đẩy ra ngoài máy. Bí mật nhận sự kiện của từng app lưu mã hoá (AES-256-GCM) | Quét SSL đạt A; kiểm cấu hình | A |
| VH-NFR-04 | **An toàn ứng dụng web.** Đạt OWASP ASVS mức 2 cho các nhóm xác thực, phiên, kiểm soát truy cập, kiểm đầu vào. Có Content-Security-Policy, chống CSRF cho thao tác ghi, không có chuyển hướng mở, giới hạn tần suất (đăng nhập, API cho app 600 lượt/phút/app) | Rà soát mã theo checklist ASVS trước mỗi bản; quét tự động OWASP ZAP trên staging | B |
| VH-NFR-05 | **Bí mật không vào git.** Client secret, khoá, mật khẩu chỉ nằm trong biến môi trường hoặc kho bí mật. Có `.env.example`. CI quét bí mật. Client secret xoay 6 tháng một lần, khoá ký 1 năm một lần | CI chặn commit có bí mật; lịch xoay ghi trong sổ vận hành | A |
| VH-NFR-06 | **Quản trị được bảo vệ.** Màn quản trị Keycloak nằm ở tên miền riêng, chỉ vào được từ mạng công ty hoặc qua Cloudflare Access. Quyền quản trị của VC Home là vai trò nhạy cảm (VH-APP-05). Có 2 tài khoản quản trị khẩn cấp với TOTP, cất offline | Thử truy cập màn quản trị từ ngoài mạng bị chặn | A |

## 2. Dữ liệu cá nhân và nhật ký

| Mã | Yêu cầu | Đo bằng | GĐ |
|---|---|---|---|
| VH-NFR-07 | **Chỉ thông tin công việc** (VH-BR-19).<br>- Trường C0 (tên, chức danh, đơn vị, email công ty, ảnh, SĐT công việc) hiện trong danh bạ cho mọi nhân viên.<br>- Trường C1 (quản lý, ngày vào, loại nhân viên, nơi làm, trạng thái, lịch sử vị trí) chỉ hiện cho người có phạm vi (VH-BR-23).<br>- Không lưu C2–C3.<br>- Token chỉ chứa C0, mã đơn vị và vai trò của chính app nhận token | Rà soát từ điển dữ liệu [05](05-du-lieu.md): không có trường C2–C3; test che thông tin theo người xem | B |
| VH-NFR-08 | **Tuân thủ NĐ 13/2023 và Luật Bảo vệ dữ liệu cá nhân.**<br>- Máy chủ đặt tại Việt Nam.<br>- Có văn bản thông báo xử lý dữ liệu nhân viên (mục đích: quản lý truy cập, danh bạ nội bộ). Pháp chế duyệt trước R2.<br>- Nhân viên xem được toàn bộ dữ liệu của mình (VH-NSU-06) và đề nghị sửa được.<br>- Hồ sơ người đã nghỉ: giữ 24 tháng rồi ẩn danh các trường C0 (giữ mã nhân viên để nhật ký còn tra được).<br>- Có hồ sơ đánh giá tác động xử lý dữ liệu | Pháp chế ký duyệt; job ẩn danh chạy thử trên staging | B |
| VH-NFR-09 | **Nhật ký không sửa được** (VH-BR-18).<br>- Chỉ ghi thêm, không có API sửa hay xoá.<br>- Mỗi ngày tính mã băm nối chuỗi các dòng để phát hiện sửa ngầm.<br>- Giữ 24 tháng (Q-10).<br>- Xuất được CSV theo khoảng ngày cho kiểm soát.<br>- Đồng hồ máy chủ đồng bộ NTP | Thử sửa trực tiếp trong database thì job kiểm báo lệch; xuất 1 tháng nhật ký ≤ 30 giây | A trở đi |

## 3. Sẵn sàng, sao lưu, hiệu năng, quy mô

| Mã | Yêu cầu | Đo bằng | GĐ |
|---|---|---|---|
| VH-NFR-10 | **Sẵn sàng.**<br>- VC ID và VC Home đạt 99,5% mỗi tháng trong giờ làm việc (07:00–21:00, thứ Hai đến thứ Bảy).<br>- Khi VC ID không chạy: phiên đang có ở mọi app vẫn dùng được tới hết hạn 12 giờ; đăng nhập mới báo lỗi dễ hiểu; đường khẩn cấp ở từng app (VH-AUT-09) bật được trong 10 phút.<br>- Khi VC Home API không chạy: đăng nhập vẫn chạy (VC ID độc lập); quyền đã đẩy sang VC ID vẫn hiệu lực | Giám sát ngoài mỗi phút; báo cáo tháng; diễn tập tắt VC ID trên staging mỗi quý | A |
| VH-NFR-11 | **Sao lưu và khôi phục.**<br>- Mất dữ liệu tối đa 24 giờ (RPO); khôi phục xong trong 4 giờ (RTO).<br>- Sao lưu hằng đêm cả PostgreSQL của Keycloak và MongoDB `vchome`; giữ 14 bản ngày và 6 bản tháng; 1 bản ở ngoài máy.<br>- Khôi phục thử mỗi tháng lên staging | Biên bản khôi phục thử hằng tháng | A (Keycloak), B (MongoDB) |
| VH-NFR-12 | **Hiệu năng giao diện** (đo trên mạng 4G).<br>- Trang chủ tải xong ≤ 1,5 giây (p95).<br>- Danh bạ tìm ra kết quả ≤ 1 giây (p95) với 1.000 người.<br>- Sơ đồ tổ chức 200 đơn vị hiện ≤ 2 giây | Đo bằng Lighthouse và log thời gian phản hồi | B |
| VH-NFR-13 | **Hiệu năng xử lý.**<br>- Đăng nhập lần hai (đã có phiên chung) tới khi vào app ≤ 1 giây.<br>- API cho app ≤ 300 ms (p95).<br>- Tính lại quyền 1 người ≤ 5 giây; cả công ty (1.000 người, 100 luật) ≤ 5 phút.<br>- Quyền mới có trên VC ID ≤ 5 phút sau khi hồ sơ có hiệu lực.<br>- Sự kiện tới app ≤ 1 phút (p95) | Test tải với dữ liệu giả 1.000 người | C |
| VH-NFR-14 | **Quy mô.** Chạy không cần thiết kế lại với 1.000 nhân viên, 50 app, 300 vai trò app, 200 đơn vị, 20.000 quyền, 5 năm nhật ký (ước khoảng 5 triệu dòng) | Test tải; ước dung lượng | C |

## 4. Trải nghiệm

| Mã | Yêu cầu | Đo bằng | GĐ |
|---|---|---|---|
| VH-NFR-15 | **Ngôn ngữ và giao diện.**<br>- Toàn bộ giao diện, thông báo, email bằng tiếng Việt có dấu; ngày dạng `dd/mm/yyyy`, giờ `HH:mm` theo giờ Việt Nam (VH-BR-22).<br>- Giao diện dùng Ant Design, cùng phong cách với VClinks.<br>- Mọi thông báo lỗi nói rõ phải làm gì tiếp và ai hỗ trợ | Rà soát văn bản giao diện trước mỗi bản | A |
| VH-NFR-16 | **Thiết bị và trợ năng.**<br>- Chạy trên 2 bản mới nhất của Chrome, Edge, Safari, Firefox; điện thoại iOS Safari và Android Chrome; dưới 600 px chuyển 1 cột.<br>- Đạt WCAG 2.1 mức AA ở độ tương phản, điều khiển bằng bàn phím, nhãn cho trình đọc màn hình | Lighthouse trợ năng ≥ 90; thử bàn phím các màn chính | A |

## 5. Vận hành, bảo trì, chi phí

| Mã | Yêu cầu | Đo bằng | GĐ |
|---|---|---|---|
| VH-NFR-17 | **Quan sát được.**<br>- Mọi yêu cầu có `correlation_id` xuyên từ VC Home tới app (qua header và sự kiện).<br>- Log dạng JSON, không chứa token, `code`, nội dung nhạy cảm.<br>- Có số đo: lượt đăng nhập thành công và lỗi, số quyền tính lại, sự kiện gửi lỗi, độ trễ.<br>- Cảnh báo theo VH-ADM-04 | Kiểm log mẫu; diễn tập cảnh báo | A |
| VH-NFR-18 | **Toàn vẹn dữ liệu.**<br>- Ràng buộc VH-BR-04, 05, 06 kiểm ở server.<br>- Thay đổi nhiều bản ghi (đổi vị trí kèm tính lại quyền) chạy trong giao dịch hoặc có cơ chế bù.<br>- Job (tính lại quyền, hết hạn, gửi sự kiện) chạy lại nhiều lần vẫn ra cùng kết quả.<br>- Hằng đêm đối chiếu quyền trong VC Home với VC ID và báo lệch | Test chạy job hai lần; báo cáo lệch hằng đêm bằng 0 | C |
| VH-NFR-19 | **Bảo trì.**<br>- Cấu hình Keycloak viết dạng code, có CI áp thử.<br>- Bộ luật quyền và luồng duyệt có test tự động phủ ≥ 80% dòng lệnh.<br>- Tài liệu theo §13; đổi hành vi phải sửa tài liệu trước (quy trình BA → DESIGN → Code → UAT).<br>- Triển khai bằng container, có dev / staging / production; bản mới lên production ngoài giờ, gián đoạn ≤ 5 phút | CI xanh; báo cáo độ phủ test | A |
| VH-NFR-20 | **Chi phí.** Hạ tầng VC ID + VC Home (máy chủ tại Việt Nam, sao lưu ngoài máy, giám sát) không quá 1,5 triệu đồng/tháng tới 1.000 người dùng. Không dùng dịch vụ trả phí theo đầu người | Hoá đơn hằng tháng | A |

## 6. Cách kiểm

| Nhóm | Khi nào kiểm | Ai |
|---|---|---|
| Bảo mật (01–06) | Mỗi bản phát hành; quét tự động hằng tuần trên staging | Dev + quản trị hệ thống; rà soát độc lập trước R3 |
| Dữ liệu cá nhân (07–08) | Trước R2; khi thêm trường mới vào hồ sơ | BA + pháp chế |
| Nhật ký (09) | Mỗi bản phát hành; kiểm chuỗi băm hằng ngày | Kiểm soát |
| Sẵn sàng, sao lưu (10–11) | Hằng tháng (khôi phục thử), hằng quý (diễn tập tắt VC ID) | Quản trị hệ thống |
| Hiệu năng, quy mô (12–14) | Trước R3 với dữ liệu giả 1.000 người | Dev |
| Trải nghiệm (15–16) | UAT mỗi bản | Kiểm thử + người dùng thử |
| Vận hành (17–20) | Mỗi bản; chi phí hằng tháng | Quản trị hệ thống |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 08/10/2026 10:04 | Claude Code (vai BA) | Tạo tài liệu: 20 yêu cầu phi chức năng có con số đo, cách kiểm | README bộ tài liệu 0.1; thiết kế SSO 0.1 mục 5.7, 7, 11 |
