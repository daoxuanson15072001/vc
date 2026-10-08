# VC Home — Quyết định cần chốt, giả định và rủi ro

Phiên bản 0.1 · 08/10/2026 · Trạng thái: Nháp (chờ duyệt)

## Tóm tắt

- **Tài liệu nói gì:** 15 câu hỏi cần chủ dự án và các bên chốt (VH-Q). Mỗi câu có phương án, đề xuất mặc định, hạn chốt và giai đoạn bị chặn. Kèm 14 rủi ro (VH-RR) và cách giảm.
- **Cách trả lời:** theo mã, ví dụ `Q-01: AMIS · Q-06: OK`. Câu nào không trả lời trước hạn thì làm theo đề xuất (giống CLAUDE.md §15.2 của VClinks).
- **Năm câu chặn GĐ B, cần chốt trước 24/10/2026:**
  - Q-01: dữ liệu nhân sự ở đâu.
  - Q-02: danh mục chức danh, chức năng.
  - Q-05: vai trò thô hay chi tiết.
  - Q-06: VC People thay cây tổ chức của VClinks và VCwiki.
  - Q-07: ai giữ vai trò HC-NS, quản trị, kiểm soát, chủ app.
- **Rủi ro lớn nhất:**
  - RR-01: dữ liệu nhân sự đầu vào không đủ hoặc không sạch.
  - RR-02: thiếu dev làm VC Home toàn thời gian.
  - RR-03: hai app phải đổi mô hình tổ chức đang chạy.
- **Người duyệt xem kỹ:** bảng câu hỏi ở mục 1 và các rủi ro mức Cao ở mục 3.

## Mục lục

- [1. Câu hỏi cần chốt](#1-câu-hỏi-cần-chốt)
- [2. Giả định](#2-giả-định)
- [3. Rủi ro](#3-rủi-ro)
- [4. Quyết định đã chốt](#4-quyết-định-đã-chốt)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Câu hỏi cần chốt

| Mã | Câu hỏi | Phương án | Đề xuất | Ai chốt | Hạn | Chặn |
|---|---|---|---|---|---|---|
| Q-01 | Dữ liệu nhân sự hiện nằm ở đâu, ai cập nhật? | A: MISA AMIS (phân hệ nhân sự) · B: Excel của HC-NS · C: Google Workspace (trường thông tin nhân viên) · D: nơi khác | Lấy B làm dữ liệu khởi đầu (nhập Excel, VH-IMP-01). Nếu công ty dùng A thì GĐ E nối tự động (VH-IMP-04). HC-NS là người cập nhật | Chủ dự án + HC-NS | 17/10 | B |
| Q-02 | Đã có danh mục chức danh và chức năng chuẩn của tập đoàn chưa? | A: có, gửi file · B: chưa, BA đề xuất bản đầu rồi HC-NS duyệt | B: bản đầu gồm khoảng 10 chức năng (Bán hàng, CSKH, Sale admin, Kế toán, Kỹ thuật dịch vụ, Kho, Marketing, Nhân sự, IT, Ban giám đốc) và chức danh lấy từ dữ liệu thật | HC-NS | 24/10 | B |
| Q-03 | Quyền ngoại lệ do ai duyệt? | A: chỉ quản lý trực tiếp · B: quản lý, thêm chủ app nếu vai trò nhạy cảm · C: luôn cả hai | B (VH-BR-12) | Chủ dự án | 20/11 | D |
| Q-04 | Kiêm nhiệm giữa nhiều division hoặc pháp nhân có phổ biến không? | A: hiếm · B: phổ biến | Thiết kế hỗ trợ đủ (VH-BR-04, 24). Cần con số để ưu tiên kiểm thử | HC-NS | 24/10 | B |
| Q-05 | Có đồng ý "VC Home cấp vai trò thô, app giữ quyền chi tiết" không? | A: đồng ý · B: muốn quản lý cả quyền chi tiết ở trung tâm | A. Phương án B làm trung tâm phình to, app mất tự chủ, và mỗi lần app đổi quyền đều phải sửa VC Home | Chủ dự án | 17/10 | B, C |
| Q-06 | VC People thay cây tổ chức và danh sách người dùng tự giữ của VClinks và VCwiki? | A: thay (app chỉ đọc) · B: song song, đồng bộ hai chiều · C: giữ như cũ | A. Hai chiều dễ lệch, khó biết bên nào đúng. Lấy mô hình ORG của VCwiki làm điểm xuất phát | Chủ dự án + chủ hai app | 24/10 | C |
| Q-07 | Ai giữ các vai trò? | Ghi tên: HC-NS (theo pháp nhân), quản trị hệ thống (2 người), kiểm soát, ban giám đốc, chủ app của từng app | Mỗi vai trò ít nhất 2 người để có người thay. Chủ app VClinks: dev002 | Chủ dự án | 24/10 | B |
| Q-08 | Hạn mặc định của quyền ngoại lệ? | 30 · 90 · 180 ngày | 90 ngày, tối đa 365 (VH-BR-09) | Chủ dự án | 20/11 | D |
| Q-09 | Rà soát theo quý hay nửa năm? | Quý · nửa năm | Quý cho quyền ngoại lệ; nửa năm cho luật (VH-BR-16) | Chủ dự án + kiểm soát | 20/11 | D |
| Q-10 | Thời hạn lưu nhật ký? | 24 tháng · 5 năm | 24 tháng như QĐ-70 của VClinks. Nếu kiểm toán cần 5 năm thì xuất bản lưu trữ ra ngoài hằng năm | Kiểm soát + pháp chế | 20/11 | C |
| Q-11 | Mã nhân viên: đã có quy tắc duy nhất toàn tập đoàn chưa? | A: có (ví dụ `VCP0123`) · B: mỗi pháp nhân một kiểu · C: chưa có | Nếu B thì thêm tiền tố pháp nhân để duy nhất. Nếu C thì VC Home cấp theo mẫu `<mã pháp nhân><4 số>` | HC-NS | 17/10 | B |
| Q-12 | Có cần cấp quyền theo nơi làm việc (chi nhánh, kho, gara) không? | Có · không | Có, đưa "nơi làm việc" vào thuộc tính luật (VH-BR-10). VCgarage và VCsale theo kho sẽ cần | Chủ dự án | 24/10 | C |
| Q-13 | Nghỉ việc: khoá lúc nào? | A: 00:00 ngày đầu tiên không còn làm · B: 18:00 ngày làm cuối | A (VH-BR-14). Nhân viên nhạy cảm có thể khoá gấp trước bằng VH-AUT-06 | Chủ dự án + HC-NS | 24/10 | C |
| Q-14 | Tài khoản công ty có trên Google nhưng chưa có hồ sơ (từ GĐ C, khi quyền đi theo hồ sơ) thì sao? | A: vào được trang chủ nhưng không có app · B: chặn đăng nhập | A trong 30 ngày đầu sau R3 (thời gian chuyển tiếp: vẫn giữ nhóm mặc định của GĐ A để không ai mất việc); sau đó chặn vào app tới khi HC-NS tạo hồ sơ (VH-BR-02) | Chủ dự án | 20/11 | C |
| Q-15 | Trang chủ có hiện liên kết ngoài (Gmail, Google Drive, MISA, website công ty) không? | Có · không | Có, ô "Liên kết" mở tab mới, không đăng nhập một lần (VH-BR-21) | Chủ dự án | 13/11 | B |

**Liên quan tới thiết kế SSO** (đã có trong [ky-thuat/thiet-ke-sso-keycloak.md](ky-thuat/thiet-ke-sso-keycloak.md) mục 4.1, chưa chốt):
- Q1: tên miền.
- Q2: máy chủ tại Việt Nam.
- Q3: ai thấy app nào ở GĐ A.
- Q4: VCwiki tự tạo tài khoản.
- Q5: thời hạn phiên.

Chủ dự án chốt chung với bảng trên.

## 2. Giả định

Xem [01-tam-nhin-pham-vi.md](01-tam-nhin-pham-vi.md) mục 6 (GĐ-1 … GĐ-6). Giả định nào sai thì BA cập nhật phạm vi, kế hoạch và báo chủ dự án trong 1 ngày.

## 3. Rủi ro

| Mã | Rủi ro | Khả năng | Ảnh hưởng | Cách giảm | Người theo dõi |
|---|---|---|---|---|---|
| VH-RR-01 | Dữ liệu nhân sự đầu vào thiếu hoặc sai (thiếu quản lý, sai đơn vị, trùng email) | Cao | Cao: luật cấp sai quyền | Nhập thử trước (VH-IMP-01); đối chiếu Google (VH-IMP-02); chỉ bật luật khi ≥ 98% hồ sơ đủ (01 mục 3); HC-NS duyệt báo cáo lỗi | HC-NS |
| VH-RR-02 | Không có dev làm VC Home toàn thời gian (2 dev hiện dồn cho M1 và lộ trình AI) | Cao | Cao: trễ cả lộ trình | Chốt nhân sự trước GĐ B; nếu không có thì làm GĐ A, B rồi dừng, C, D dời sang Q1/2027 | Chủ dự án |
| VH-RR-03 | VClinks, VCwiki phải đổi mô hình tổ chức đang chạy, dễ phá luồng | Trung bình | Cao | Bảng ánh xạ mã đơn vị cũ → mới; chạy song song chế độ chỉ đọc 1 tuần trước khi khoá màn sửa; cờ bật/tắt ở từng app | Chủ app |
| VH-RR-04 | Luật viết sai làm nhiều người mất quyền cùng lúc | Trung bình | Cao | Xem trước bắt buộc, duyệt hai người khi > 20 người (VH-BR-25); thời gian chuyển tiếp; nhật ký và hoàn tác luật | Quản trị hệ thống |
| VH-RR-05 | Cơ cấu tổ chức đổi thường xuyên, HC-NS không kịp cập nhật | Trung bình | Trung bình | Ngày hiệu lực hẹn trước; nhắc HC-NS các vị trí thiếu quản lý; báo cáo hồ sơ chưa đủ hằng tuần | HC-NS |
| VH-RR-06 | Quản lý không duyệt kịp, người dùng thiếu công cụ | Trung bình | Trung bình | Nhắc ngày 2 và 5; uỷ quyền; ít ngoại lệ nhờ luật tốt (đích ≥ 90% quyền từ luật) | Quản lý |
| VH-RR-07 | VC ID là điểm hỏng đơn | Thấp | Cao | Phiên app giữ 12 giờ; đường khẩn cấp; sao lưu và khôi phục thử hằng tháng (VH-NFR-10, 11) | Quản trị hệ thống |
| VH-RR-08 | Sự kiện gửi app bị mất hoặc sai thứ tự | Thấp | Trung bình | Gửi ít nhất một lần, có số thứ tự theo người, kéo dự phòng (VH-INT-05), đối chiếu hằng đêm | Dev |
| VH-RR-09 | Vướng pháp lý dữ liệu cá nhân nhân viên | Thấp | Cao | Chỉ thông tin công việc; máy chủ tại Việt Nam; thông báo xử lý dữ liệu do pháp chế duyệt trước R2 (VH-NFR-08) | Pháp chế |
| VH-RR-10 | Hai Workspace Google riêng làm đồng bộ phức tạp | Trung bình | Thấp | Thiết kế SSO I6; bộ đồng bộ chạy theo từng Workspace | Quản trị hệ thống |
| VH-RR-11 | Phạm vi phình: muốn thêm chấm công, lương, đánh giá vào VC Home | Cao | Trung bình | Ngoài phạm vi ([01](01-tam-nhin-pham-vi.md) mục 4); việc mới vào danh sách chờ, chủ dự án duyệt | BA |
| VH-RR-12 | Người dùng quen đăng nhập riêng từng app, gọi hỗ trợ nhiều tuần đầu | Trung bình | Thấp | Hướng dẫn 1 trang; thông báo trước 3 ngày; tuần đầu có người trực hỗ trợ | Quản trị hệ thống |
| VH-RR-13 | Repo `vc` đang public chứa tài liệu và code | Cao | Cao | Đổi sang private trước khi đưa thêm thông tin hạ tầng; dài hạn dùng repo `vc-platform` private trên GitLab | Chủ dự án |
| VH-RR-14 | Lệch giữa quyền trong VC Home và VC ID (đẩy lỗi) | Thấp | Trung bình | Đẩy lại có thử lại; đối chiếu hằng đêm báo lệch (VH-NFR-18) | Dev |

## 4. Quyết định đã chốt

Chưa có. Khi chủ dự án trả lời, chuyển câu từ mục 1 xuống đây. Mỗi dòng gồm:
- mã câu hỏi;
- câu trả lời;
- ngày chốt;
- người chốt;
- tài liệu và mục phải sửa theo.

| Mã | Chốt | Ngày | Người chốt | Tài liệu phải sửa |
|---|---|---|---|---|

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 08/10/2026 10:04 | Claude Code (vai BA) | Tạo tài liệu: 15 câu hỏi có đề xuất và hạn, 14 rủi ro | README bộ tài liệu 0.1; câu hỏi người dùng 08/10/2026 |
