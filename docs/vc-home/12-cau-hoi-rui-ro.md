# VC Home — Quyết định, giả định và rủi ro

Phiên bản 0.2 · 08/10/2026 · Trạng thái: Đã chốt (người dùng uỷ quyền BA)

## Tóm tắt

- **Tài liệu nói gì:** 15 câu hỏi nghiệp vụ (Q-01…15), 5 câu hỏi của thiết kế SSO, việc chốt người làm và việc repo public; 14 rủi ro (VH-RR) và cách giảm; sổ quyết định soát chéo; kết quả xử lý mọi đề xuất bổ sung.
- **Trạng thái:** ngày 08/10/2026 người dùng uỷ quyền BA chốt tất cả theo khuyến nghị. **Không còn câu hỏi mở** (mục 4). Chủ dự án vẫn đổi được dòng nào thì sửa tài liệu theo cột cuối của mục 4.
- **Các quyết định chính:**
  - Q-01: Excel của HC-NS làm dữ liệu khởi đầu; phần mềm nhân sự (nếu có) nối ở GĐ E.
  - Q-02: dùng 10 chức năng khởi tạo ở 04 VH-ORG-03; chức danh lấy từ dữ liệu thật.
  - Q-05: VC Home cấp vai trò thô, app giữ quyền chi tiết.
  - Q-06: VC People thay cây tổ chức của VClinks, VCwiki; app chỉ đọc.
  - Q-07: giữ vai trò theo chức vụ, mỗi vai trò 2 người (mục 4.3).
  - Nhân sự: 1 dev Platform toàn thời gian từ 02/11/2026; hạn có người 30/10, quá hạn thì R2–R4 dời sau Tết.
  - Repo `vc` đổi sang private ngay; không đưa bí mật, IP, dữ liệu nhân sự vào repo.
- **Đề xuất bổ sung** (mục 6): 89 đề xuất ở 7 tài liệu đã xử lý hết. Sinh ra 12 yêu cầu mới, 8 để sau, 2 không làm.
- **Việc còn lại chỉ là đầu vào, không phải quyết định:** tên người giữ vai trò (N3), file Excel (N1), văn bản pháp chế (N4), người làm VC Home.
- **Rủi ro lớn nhất:**
  - RR-01: dữ liệu nhân sự đầu vào không đủ hoặc không sạch.
  - RR-02: chưa có dev làm VC Home toàn thời gian.
  - RR-13: repo đang public.
- **Sổ quyết định soát chéo** (mục 5): 36 điểm lệch giữa các tài liệu đã được BA trưởng chốt; khi tài liệu còn ghi khác thì theo mục 5.
- **Người duyệt xem kỹ:** mục 4 (quyết định), mục 6 (đề xuất để sau và không làm), các rủi ro mức Cao ở mục 3.

## Mục lục

- [1. Câu hỏi đã cân nhắc](#1-câu-hỏi-đã-cân-nhắc)
- [2. Giả định](#2-giả-định)
- [3. Rủi ro](#3-rủi-ro)
- [4. Quyết định đã chốt](#4-quyết-định-đã-chốt)
- [5. Quyết định soát chéo của BA trưởng](#5-quyết-định-soát-chéo-của-ba-trưởng)
- [6. Xử lý các đề xuất bổ sung](#6-xử-lý-các-đề-xuất-bổ-sung)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Câu hỏi đã cân nhắc

**Đã chốt hết ngày 08/10/2026** (mục 4). Bảng dưới giữ lại để biết các phương án đã cân nhắc; cột "Đề xuất" là bản đã chọn, trừ Q-07 và Q-11 chốt chi tiết hơn ở mục 4.

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

**Liên quan tới thiết kế SSO** (có trong [ky-thuat/thiet-ke-sso-keycloak.md](ky-thuat/thiet-ke-sso-keycloak.md) mục 4.1, đã chốt ở mục 4):
- Q1: tên miền.
- Q2: máy chủ tại Việt Nam.
- Q3: ai thấy app nào ở GĐ A.
- Q4: VCwiki tự tạo tài khoản.
- Q5: thời hạn phiên.


## 2. Giả định

Xem [01-tam-nhin-pham-vi.md](01-tam-nhin-pham-vi.md) mục 6 (GĐ-1 … GĐ-6). Giả định nào sai thì BA cập nhật phạm vi, kế hoạch và báo chủ dự án trong 1 ngày.

## 3. Rủi ro

| Mã | Rủi ro | Khả năng | Ảnh hưởng | Cách giảm | Người theo dõi |
|---|---|---|---|---|---|
| VH-RR-01 | Dữ liệu nhân sự đầu vào thiếu hoặc sai (thiếu quản lý, sai đơn vị, trùng email) | Cao | Cao: luật cấp sai quyền | Nhập thử trước (VH-IMP-01); đối chiếu Google (VH-IMP-02); chỉ bật luật khi ≥ 98% hồ sơ đủ (01 mục 3); HC-NS duyệt báo cáo lỗi | HC-NS |
| VH-RR-02 | Không có dev làm VC Home toàn thời gian (2 dev hiện dồn cho M1 và lộ trình AI) | Cao | Cao: trễ cả lộ trình | Đã chốt (mục 4): 1 dev Platform toàn thời gian từ 02/11. Hạn có người 30/10; quá hạn thì R1 vẫn lên, R2–R4 dời sang sau Tết (từ 22/02/2027) | Chủ dự án |
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
| VH-RR-13 | Repo `vc` đang public chứa tài liệu và code | Cao | Cao | Đã chốt (mục 4): chủ repo đổi sang private ngay trên GitHub (Settings → General → Danger Zone → Change visibility → Private). Không đưa bí mật, IP, tên máy chủ, file nhân sự vào repo; dài hạn dùng repo `vc-platform` private | Chủ dự án |
| VH-RR-14 | Lệch giữa quyền trong VC Home và VC ID (đẩy lỗi) | Thấp | Trung bình | Đẩy lại có thử lại; đối chiếu hằng đêm báo lệch (VH-NFR-18) | Dev |

## 4. Quyết định đã chốt

Ngày 08/10/2026 người dùng (chủ dự án) uỷ quyền cho BA trưởng chốt toàn bộ câu hỏi theo khuyến nghị. Bảng dưới là bản chốt. Chủ dự án vẫn có thể đổi bất kỳ dòng nào; khi đổi thì sửa các tài liệu ở cột cuối.

### 4.1 Bảng quyết định

| Mã | Chốt | Ngày | Người chốt | Tài liệu phải sửa |
|---|---|---|---|---|
| Q-01 | **B.** Excel của HC-NS là dữ liệu khởi đầu (VH-IMP-01); HC-NS là người cập nhật duy nhất trên VC People từ R2. Nếu công ty đã dùng phần mềm nhân sự (MISA AMIS…) thì nối tự động ở GĐ E (VH-IMP-04), không chờ | 08/10/2026 | BA trưởng (uỷ quyền) | Không cần sửa (đúng mặc định); 10 mục 4 N1 |
| Q-02 | **B.** Dùng danh mục khởi tạo 10 chức năng ở [04](04-yeu-cau-chuc-nang.md) VH-ORG-03 (mục 4.2 dưới đây); chức danh lấy từ dữ liệu thật khi nhập thử, gộp mục trùng bằng VH-ORG-09. HC-NS chỉ còn việc rà bản đầu trước 24/10, không còn là câu hỏi | 08/10/2026 | BA trưởng (uỷ quyền) | 07 mục 8.3 (NV thị trường); 10 mục 4 N2 |
| Q-03 | **B.** Quản lý trực tiếp duyệt; thêm chủ app khi vai trò nhạy cảm (VH-BR-12) | 08/10/2026 | BA trưởng (uỷ quyền) | Không cần sửa |
| Q-04 | Thiết kế hỗ trợ đủ kiêm nhiệm nhiều division, pháp nhân (VH-BR-04, 24). Kiểm thử coi như **phổ biến**; HC-NS báo con số thật sau lần nhập thử, không chặn | 08/10/2026 | BA trưởng (uỷ quyền) | 11: giữ các ca kiêm nhiệm |
| Q-05 | **A.** VC Home cấp vai trò thô; app giữ quyền chi tiết | 08/10/2026 | BA trưởng (uỷ quyền) | Không cần sửa |
| Q-06 | **A.** VC People thay cây tổ chức và danh sách người dùng của VClinks, VCwiki; app chỉ đọc. Chuyển theo RR-03: bảng ánh xạ mã đơn vị, chạy song song chỉ đọc 1 tuần, cờ bật/tắt ở từng app | 08/10/2026 | BA trưởng (uỷ quyền) | 01 mục 7; 07 |
| Q-07 | Giữ vai trò **theo chức vụ**, mỗi vai trò 2 người (mục 4.3 dưới đây). Chủ dự án chỉ còn ghi tên người vào danh sách (N3), không còn là câu hỏi | 08/10/2026 | BA trưởng (uỷ quyền) | 01 mục 5; 10 mục 4 N3, mục 5 |
| Q-08 | 90 ngày mặc định, tối đa 365; vai trò nhạy cảm tối đa 90 ngày (VH-BR-09) | 08/10/2026 | BA trưởng (uỷ quyền) | Đã sửa 02 VH-BR-09 |
| Q-09 | Quý cho quyền ngoại lệ (VH-REV-01); nửa năm cho luật (VH-REV-04) | 08/10/2026 | BA trưởng (uỷ quyền) | Đã thêm VH-REV-04 (04 mục 14) |
| Q-10 | Giữ 24 tháng trong hệ thống; xuất bản lưu trữ ra ngoài hằng năm, giữ 5 năm (cho kiểm toán) | 08/10/2026 | BA trưởng (uỷ quyền) | 05 mục 9 đề xuất 4 |
| Q-11 | Dùng mã nhân viên hiện có nếu duy nhất toàn tập đoàn; trùng giữa pháp nhân thì thêm tiền tố mã pháp nhân; người chưa có mã thì VC Home cấp theo mẫu `<mã pháp nhân><4 số>`. Bước nhập kiểm trùng | 08/10/2026 | BA trưởng (uỷ quyền) | 04 VH-IMP-01 (kiểm trùng đã có) |
| Q-12 | **Có.** "Nơi làm việc" là thuộc tính luật (VH-BR-10) và có trong VH-API-05 | 08/10/2026 | BA trưởng (uỷ quyền) | Không cần sửa |
| Q-13 | **A.** Khoá lúc 00:00 ngày đầu tiên không còn làm (VH-BR-14); khoá gấp trước bằng VH-AUT-06 khi cần | 08/10/2026 | BA trưởng (uỷ quyền) | Không cần sửa |
| Q-14 | **A** trong 30 ngày đầu sau R3 (giữ nhóm mặc định của GĐ A); sau đó vẫn vào trang chủ nhưng không vào app tới khi HC-NS tạo hồ sơ (VH-BR-02) | 08/10/2026 | BA trưởng (uỷ quyền) | Không cần sửa |
| Q-15 | **Có.** Ô "Liên kết" mở tab mới, không đăng nhập một lần (VH-BR-21; `apps.kind = lien_ket_ngoai`) | 08/10/2026 | BA trưởng (uỷ quyền) | Không cần sửa |
| SSO Q1 | `id.vcprosperous.com` (VC ID), `home.vcprosperous.com` (VC Home), `id-admin.vcprosperous.com` (màn quản trị Keycloak, chỉ mở cho IP công ty hoặc VPN) | 08/10/2026 | BA trưởng (uỷ quyền) | Thiết kế SSO mục 4.1 |
| SSO Q2 | Một máy ảo tại Việt Nam, 2 vCPU / 4 GB RAM / 40 GB SSD, Ubuntu 24.04, không đặt trên máy 129; sao lưu hằng đêm ra nơi khác | 08/10/2026 | BA trưởng (uỷ quyền) | Thiết kế SSO mục 4.1; 01 GĐ-6 |
| SSO Q3 | GĐ A: mọi tài khoản công ty thấy cả VClinks và VCwiki (nhóm mặc định); quyền bên trong app giữ như hiện nay | 08/10/2026 | BA trưởng (uỷ quyền) | Thiết kế SSO mục 4.1 |
| SSO Q4 | **Có.** VCwiki tự tạo tài khoản ở lần đăng nhập đầu qua VC ID, vai trò `member`, chỉ thấy kho công khai; tắt đăng ký bằng mật khẩu | 08/10/2026 | BA trưởng (uỷ quyền) | Thiết kế SSO mục 4.1 |
| SSO Q5 | Phiên VC ID và phiên app: hết sau 12 giờ không dùng, tối đa 7 ngày (VCwiki giảm từ 14 xuống 7 ngày) | 08/10/2026 | BA trưởng (uỷ quyền) | Thiết kế SSO mục 4.1; 07 |
| Nhân sự | **1 dev Platform toàn thời gian từ 02/11/2026**, giữ VC ID + VC Home, sau đó Gatekeeper của lộ trình AI. Ưu tiên điều chuyển nội bộ; không có thì tuyển 1 dev fullstack NestJS + React (≥ 3 năm, biết OIDC là lợi thế) hoặc thuê hợp đồng 4 tháng (11/2026–02/2027). Dev002 làm GĐ A như kế hoạch. **Hạn có người: 30/10.** Quá hạn thì R1 vẫn lên (dùng được độc lập); R2–R4 dời sang sau Tết (từ 22/02/2027), giữ nguyên thứ tự | 08/10/2026 | BA trưởng (uỷ quyền) | 10 mục 5; 01 GĐ-5; RR-02 |
| Repo public | Đổi repo `vc` sang **private ngay** (chủ repo làm trên GitHub). Từ giờ không đưa tên máy chủ, IP, bí mật, file dữ liệu nhân sự vào repo; dữ liệu nhập Excel chỉ để trên máy chủ. Dài hạn tách code nền tảng sang repo `vc-platform` private | 08/10/2026 | BA trưởng (uỷ quyền) | RR-13; README |

### 4.2 Danh mục chức năng bản đầu (Q-02)

- Dùng đúng 10 chức năng ở [04](04-yeu-cau-chuc-nang.md) VH-ORG-03: `ban_hang`, `cskh`, `sale_admin`, `ke_toan`, `ky_thuat`, `kho`, `marketing`, `nhan_su`, `it`, `ban_giam_doc`.
- Nhân viên thị trường thuộc chức năng `ban_hang`; luật cấp `vclinks:nv_thi_truong` dựa vào chức danh "Nhân viên thị trường", không tạo chức năng `thi_truong` riêng.
- Chức danh không đặt trước: lấy từ file Excel thật ở lần nhập thử (N1); trùng tên thì gộp bằng VH-ORG-09.
- Cần thêm chức năng thì HC-NS thêm trên VH-MH-13, không phải sửa tài liệu.

### 4.3 Người giữ vai trò (Q-07)

Gán theo chức vụ để khi người đổi việc thì vai trò đi theo chức vụ. Chủ dự án ghi tên cụ thể vào danh sách N3 ([10](10-ke-hoach-trien-khai.md) mục 4) trước 24/10.

| Vai trò | Người chính | Người thay | Ghi chú |
|---|---|---|---|
| HC-NS (`vchome:hcns`) | Trưởng phòng HC-NS của từng pháp nhân | 1 chuyên viên HC-NS cùng pháp nhân | Phạm vi theo pháp nhân |
| Quản trị hệ thống (`vchome:qtht`) | Dev Platform (người làm VC Home) | Dev002 | Không được kiêm HC-NS hay kiểm soát (02 mục 6) |
| Kiểm soát (`vchome:kiem_soat`) | Kế toán trưởng | 1 người kiểm soát nội bộ hoặc kế toán tổng hợp | Chỉ xem; không kiêm quản trị hệ thống |
| Ban giám đốc (`vchome:bgd`) | Các thành viên ban giám đốc | — | Cấp tự động theo chức năng `ban_giam_doc` |
| Chủ app VClinks | Dev002 | Chủ dự án | |
| Chủ app VCwiki | Dev phụ trách VCwiki | Chủ dự án | |
| Chủ app sau này (VCsale, VCgarage…) | Trưởng nhóm dev của app | Chủ dự án | Khai khi đưa app vào (VH-QT-11) |
| Pháp chế | Người phụ trách pháp chế, hoặc luật sư tư vấn ngoài | — | Duyệt thông báo xử lý dữ liệu (N4) |

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
| D-BA-30 | Quản trị hệ thống ở bước 2 | Duyệt bước 2 thay chủ app khi người xin là chủ app của chính app đó | 02 ma trận mục 3 |
| D-BA-31 | Tên nút trên hồ sơ | "Không nhận việc" (người mới không đến), "Nhận lại" (người đã nghỉ quay lại), "Đặt ngày nghỉ việc" | 04 VH-NSU-01, 04, VH-LCM-05 |
| D-BA-32 | Nhãn nguồn quyền | "Luật", "Được duyệt", "Khẩn cấp" | 04 VH-HOM-03; 06; 09 |
| D-BA-33 | Danh bạ khi nghỉ dài ngày | Hiện "Tạm vắng", không ghi ngày | 04 VH-LCM-04 |
| D-BA-34 | Nơi xem báo cáo | Mọi người xem báo cáo (BGĐ, trưởng đơn vị, HC-NS, chủ app, kiểm soát) vào VH-MH-17 trong phạm vi của mình; VH-MH-09 chỉ tóm tắt đội | README mục 8, 04 VH-ADM-02 |
| D-BA-35 | Người dùng các màn quản trị | VH-MH-08 thêm trưởng đơn vị, quản trị hệ thống, người được uỷ quyền; VH-MH-15 thêm kiểm soát (chỉ đọc); VH-MH-19 thêm HC-NS và chủ app trong phạm vi; ngoại lệ tách nhiệm quản lý ở VH-MH-17 | README mục 8 |
| D-BA-36 | App `beta` | Được xin quyền như app `live` | 04 VH-REQ-01 |

## 6. Xử lý các đề xuất bổ sung

Ngày 08/10/2026 BA trưởng xử lý hết các đề xuất "Mở" ở cuối từng tài liệu (người dùng uỷ quyền). Không còn đề xuất nào mở. Chi tiết từng dòng nằm ở ghi chú "Đã xử lý ngày 08/10/2026" của mục tương ứng.

**Tổng hợp theo nơi đề xuất:**

| Nơi | Số đề xuất | Đã xử lý từ trước | Nhận (mã mới hoặc gộp) | Để sau | Không làm |
|---|---:|---:|---:|---:|---:|
| [03](03-quy-trinh.md) mục 15 | 19 | 4 | 15 | 0 | 0 |
| [04](04-yeu-cau-chuc-nang.md) mục 13 | 34 | 15 | 16 | 2 | 1 |
| [05](05-du-lieu.md) mục 9 | 5 | 1 | 2 | 2 | 0 |
| [06](06-man-hinh.md) mục 10 | 8 | 0 | 6 | 1 | 1 |
| [07](07-tich-hop.md) mục 11 | 10 | 3 | 5 | 2 | 0 |
| [09](09-user-story.md) mục 16 | 7 | 0 | 6 | 1 | 0 |
| [11](11-uat.md) đề xuất | 6 | 3 | 3 | 0 | 0 |
| **Cộng** | **89** | **26** | **53** | **8** | **2** |

Nhiều đề xuất trùng nhau giữa các tài liệu (ví dụ "báo trước ngày nghỉ việc" có ở 03, 04 và 07). Sau khi gộp, phần nhận sinh ra **12 yêu cầu mới** ở [04](04-yeu-cau-chuc-nang.md) mục 14.1 và **11 yêu cầu được bổ sung** ở mục 14.2.

**12 yêu cầu mới:**

| Mã | Tên | Ưu tiên | GĐ | Câu chuyện |
|---|---|---|---|---|
| VH-HOM-09 | Dải "Việc đang chờ bạn" trên trang chủ | C | D | VH-US-029 |
| VH-NSU-09 | Nhân viên tự sửa tên gọi, ảnh, SĐT công việc | S | B | VH-US-050 |
| VH-ORG-08 | Lịch ngày nghỉ của công ty | S | D | VH-US-068 |
| VH-ORG-09 | Gộp mục trùng trong danh mục | S | B | VH-US-069 |
| VH-IMP-05 | Hoàn tác lô nhập trong 24 giờ | S | B | VH-US-086 |
| VH-APP-07 | Vai trò app "cho phép xin" | S | D | VH-US-107 |
| VH-ACC-09 | Người giữ quyền tự trả quyền ngoại lệ | S | D | VH-US-131 |
| VH-REQ-07 | Duyệt nhiều yêu cầu một lần | S | D | VH-US-170 |
| VH-REV-04 | Rà soát luật nửa năm | S | D | VH-US-186 |
| VH-INT-09 | Sự kiện báo trước nghỉ việc, chuyển vị trí | S | C | VH-US-208 |
| VH-INT-10 | Sự kiện thử và nút "Gửi thử" | S | C | VH-US-209 |
| VH-ADM-06 | Cảnh báo quyền không dùng 90 ngày | S | D | VH-US-227 |

**Quy tắc được sửa theo đề xuất:** VH-BR-09 (vai trò nhạy cảm tối đa 90 ngày), VH-BR-11 (nhập muộn), VH-BR-12 (chuyển người duyệt khi đổi quản lý, quản lý vắng, chủ app duy nhất), VH-BR-16 (đơn vị không có trưởng, uỷ quyền, ngày nghỉ), VH-BR-25 (ngưỡng 21 người, thay đổi hàng loạt, người duyệt thay, lệch > 20% thì duyệt lại). Ma trận quyền ở [02](02-tac-nhan-quy-tac.md) mục 3 cho kiểm soát xem luật.

**Để sau (8):**

| Đề xuất | Nơi | Vì sao chưa làm | Xem lại khi |
|---|---|---|---|
| Vai trò phó đơn vị hoặc tạm quyền trưởng đơn vị có thời hạn | 04 #7 | Uỷ quyền và quy tắc chuyển người duyệt (VH-BR-12, 16) đủ dùng cho GĐ D | GĐ E |
| Thời gian chuyển tiếp riêng cho từng vai trò | 04 #13 | Chưa có số đo; mức app đủ dùng | Sau 1 tháng chạy R3 |
| Cấp bậc (1–7) và quản lý chuyên môn trong VC People | 05 #2, 07 #9 | VCwiki đang giữ; đưa vào làm phình GĐ B | GĐ E |
| Xem "cơ cấu tại một ngày" | 05 #3 | Nhật ký đủ dựng lại khi kiểm toán hỏi | GĐ E |
| Đồng nghiệp bấm "Báo sai thông tin" trên danh bạ | 06 #7, 09 #6 | Chưa biết có nhiều sai không; đo số đề nghị sửa sau R2 | Sau R2 |
| Gửi sự kiện theo lô | 07 #10 | Số app và số thay đổi còn nhỏ | Khi ≥ 20 app hoặc một lần đổi cơ cấu > 200 người |

**Không làm (2):**
- Màn "Tài khoản" riêng cho quản trị hệ thống (04 #15): ngăn Tài khoản trong VH-MH-11 đủ dùng (D-BA-15).
- Chế độ "Xem như người dùng" (06 #8): rủi ro riêng tư; dùng tra cứu quyền VH-ACC-08 để trả lời "vì sao tôi không thấy app X".

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 08/10/2026 10:04 | Claude Code (vai BA) | Tạo tài liệu: 15 câu hỏi có đề xuất và hạn, 14 rủi ro | README bộ tài liệu 0.1; câu hỏi người dùng 08/10/2026 |
| 0.2 | 08/10/2026 11:31 | Claude Code (vai BA) | Chốt toàn bộ Q-01…Q-15, SSO Q1–Q5, người làm VC Home, repo public (mục 4, thêm 4.2 danh mục chức năng, 4.3 người giữ vai trò); đổi mục 1 thành "đã cân nhắc"; thêm mục 6 xử lý 89 đề xuất bổ sung; cập nhật RR-02, RR-13 và tóm tắt | Người dùng uỷ quyền BA chốt ngày 08/10/2026 ("không cần phải t quyết định nữa") |
