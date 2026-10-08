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
- **Sổ quyết định soát chéo** (mục 5): 29 điểm lệch giữa các tài liệu đã được BA trưởng chốt; khi tài liệu còn ghi khác thì theo mục 5.
- **Người duyệt xem kỹ:** bảng câu hỏi ở mục 1, các rủi ro mức Cao ở mục 3, và mục 5.

## Mục lục

- [1. Câu hỏi cần chốt](#1-câu-hỏi-cần-chốt)
- [2. Giả định](#2-giả-định)
- [3. Rủi ro](#3-rủi-ro)
- [4. Quyết định đã chốt](#4-quyết-định-đã-chốt)
- [5. Quyết định soát chéo của BA trưởng](#5-quyết-định-soát-chéo-của-ba-trưởng)
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

## 5. Quyết định soát chéo của BA trưởng

Bộ tài liệu do nhiều người viết song song. Khi soát chéo ngày 08/10/2026, BA trưởng chốt các điểm lệch dưới đây. **Đoạn nào trong 01–11 hoặc thiết kế SSO còn ghi khác thì theo bảng này.** Chủ dự án có thể đổi bất kỳ dòng nào; khi đổi thì sửa tài liệu theo cột cuối.

| Mã | Điểm lệch | Chốt | Đã sửa ở |
|---|---|---|---|
| D-BA-01 | Loại đơn vị | `tap_doan` · `phap_nhan` (tuỳ chọn) · `division` · `phong` (khối/phòng, lồng được) · `to_nhom` (lồng một cấp như tổ bán hàng VClinks). Pháp nhân còn là danh mục `legal_entities` | 02 VH-BR-06, 05 mục 3.4, 04 VH-ORG-01 |
| D-BA-02 | Trạng thái app | `status`: `live` · `beta` · `coming_soon` · `paused` · `retired`; `kind`: `sso` · `lien_ket_ngoai` | 04 VH-APP-01, 05 mục 3.7 |
| D-BA-03 | Khoá tài khoản | Một tài khoản có thể có **nhiều khoá** cùng lúc (khẩn cấp, Google, HC-NS tạm khoá, nghỉ việc); chỉ mở khi hết mọi khoá | 05 mục 3.2, 04 VH-AUT-06 |
| D-BA-04 | Email | `work_email` (chính, C0) + `secondary_email` (email phụ ở domain kia, C1) + `previous_emails` (lịch sử, C0); cả ba dùng để gắn tài khoản | 05 mục 3.1, 04 VH-NSU-01 |
| D-BA-05 | Quản lý trực tiếp | Là quản lý trên **vị trí chính**; quản lý của vị trí kiêm nhiệm chỉ xem C1, không duyệt, không vào cây quản lý | 02 VH-BR-05 |
| D-BA-06 | Ai xem hồ sơ C1 | Thêm quản trị hệ thống (chỉ đọc, ghi nhật ký) vào ngoại lệ của VH-BR-23 | 02 VH-BR-23 |
| D-BA-07 | Duyệt luật lớn | Người thứ hai là quản trị hệ thống khác **hoặc** chủ app; "lớn" là từ 21 người trở lên; luật cấp vai trò nhạy cảm **luôn** cần người thứ hai | README, 02 VH-BR-25, 05 mục 3.9 |
| D-BA-08 | Ưu tiên xem trước luật | VH-ACC-03 nâng từ S lên M | README mục 5, 04 |
| D-BA-09 | Job hẹn giờ quyền | Có từ GĐ C (khẩn cấp, chuyển tiếp cần); VH-ACC-05 ở GĐ D chỉ thêm phần hạn của quyền theo yêu cầu | 04 mục 6 |
| D-BA-10 | HC-NS ở GĐ B | Quản trị hệ thống gán theo danh sách khởi đầu trên VC ID; GĐ C qua luật, GĐ D thêm qua yêu cầu | 02 mục 2 |
| D-BA-11 | Người duyệt bước 1 | Chỉ quản lý trực tiếp (theo vị trí chính), không phải cả cây trên | 02 ghi chú mục 3 |
| D-BA-12 | Người rà soát | Trưởng đơn vị của vị trí chính của người giữ quyền; trưởng đơn vị cấp trên xem tiến độ | 02 mục 1.1 |
| D-BA-13 | Sự kiện và API thiếu thuộc tính luật | `vh.person.updated` thêm tên gọi, SĐT công việc, pháp nhân, nơi làm việc; `vh.org.unit_changed` thêm đổi trưởng đơn vị; thêm `vh.person.locked` / `unlocked`; VH-API-05 thêm nơi làm việc | README mục 10, 07 mục 5.7, 6 |
| D-BA-14 | Thông báo ở GĐ C | Gửi bằng email Gmail công ty; thông báo trong VC Home từ GĐ D | README mục 9 |
| D-BA-15 | Màn thiếu | VH-MH-17 mở cho BGĐ và trưởng đơn vị (báo cáo trong phạm vi); ngăn Uỷ quyền trong VH-MH-08; ngăn Tài khoản (khoá, mở khoá) trong VH-MH-11 chỉ cho quản trị hệ thống | README mục 8 |
| D-BA-16 | Nơi lưu thiếu | Thêm `profile_change_requests`, `system_settings`, `directory_exclusions`, `sod_exceptions` | README mục 9, 05 mục 3.21 |
| D-BA-17 | Toán tử luật | Có "không thuộc" (danh sách loại trừ) | 05 mục 3.9 |
| D-BA-18 | Thứ tự sự kiện | Giữ thứ tự theo luồng (người; người + app; đơn vị) như 05; app nhận quyền của người chưa biết thì gọi VH-API-01 | 07 |
| D-BA-19 | Hồ sơ người không đến làm | Không xoá; chuyển Đã nghỉ với cờ `khong_vao_lam`, lý do bắt buộc | 04 VH-NSU-01 |
| D-BA-20 | Mã app của VC Home | `vchome` cho khoá app, vai trò và client trên VC ID (bỏ `vc-home`) | Thiết kế SSO, 04 |
| D-BA-21 | Câu xác nhận đăng xuất | "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?" | Thiết kế SSO mục 3.3 |
| D-BA-22 | Làm mới phiên ở VC Home | Chỉ làm mới khi người dùng có thao tác trong 30 phút gần nhất, để giới hạn 12 giờ không dùng còn tác dụng | Thiết kế SSO mục 5.3, 04 VH-AUT-05 |
| D-BA-23 | Phiên của app | Mọi app: hết hạn sau 12 giờ không dùng **và** tối đa 7 ngày (VCwiki phải thêm giới hạn 12 giờ) | Thiết kế SSO mục 5.2, 07 |
| D-BA-24 | Đường khẩn cấp VClinks | Production phải đặt rõ `AUTH_TOKEN_LOGIN=0` (code đang mặc định bật) | Thiết kế SSO mục 5.4 |
| D-BA-25 | HC-NS đặt "Tạm khoá" | Khoá đăng nhập với nguồn `hcns`; khác khoá khẩn cấp của quản trị hệ thống | 02 ghi chú mục 3 |
| D-BA-26 | Khoá tài khoản và token máy | Khi nhận `vh.person.locked`, app tạm ngưng token máy cá nhân của người đó (VClinks token MCP cá nhân, VCwiki `vcmcp_`) | 07 mục 8.6, 9.5 |
| D-BA-27 | Tạo sẵn tài khoản VC ID | Từ GĐ C, VC Home tạo sẵn user trên VC ID khi hồ sơ có hiệu lực, để có `sub` trong `vh.person.joined` và đẩy vai trò trước lần đăng nhập đầu | Thiết kế SSO mục 5.1.2 |
| D-BA-28 | Nghỉ dài ngày | Không ghi lý do nghỉ (có thể là dữ liệu sức khoẻ) | 02 VH-BR-15, 05 |
| D-BA-29 | Token chứa gì | C0, mã đơn vị và vai trò của chính app nhận token | 08 VH-NFR-07 |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 08/10/2026 10:04 | Claude Code (vai BA) | Tạo tài liệu: 15 câu hỏi có đề xuất và hạn, 14 rủi ro | README bộ tài liệu 0.1; câu hỏi người dùng 08/10/2026 |
