# VC Home — Tầm nhìn, phạm vi và tác động

Phiên bản 0.2 · 08/10/2026 · Trạng thái: Đã chốt nội dung

## Tóm tắt

- **Vấn đề:**
  - Mỗi app của tập đoàn tự đăng nhập, tự giữ danh sách người dùng và cây tổ chức. Hiện có 3 cây tổ chức lệch nhau (VClinks, VCwiki, VCsale) và 3 cách đăng nhập.
  - Người mới vào làm phải chờ từng app gán quyền.
  - Người nghỉ việc không có gì bảo đảm bị khoá ở mọi app cùng lúc.
- **Tầm nhìn:** *"Một lần đăng nhập, hệ thống biết bạn là ai trong công ty, và bạn có đúng những app cần cho công việc."*
- **Giải pháp:** VC Home gồm ba phân hệ:
  - **VC ID:** đăng nhập một lần qua Google Workspace.
  - **VC People:** hồ sơ nhân sự và cơ cấu tổ chức, nguồn sự thật duy nhất.
  - **Quyền truy cập:** cấp quyền theo luật, xin và duyệt ngoại lệ, rà soát.
- **Chỉ số chính:**
  - Người mới có đủ quyền đúng trong ≤ 1 giờ sau khi hồ sơ có hiệu lực.
  - Người nghỉ việc bị khoá mọi app ≤ 1 phút sau giờ hiệu lực.
  - 0 tài khoản của người đã nghỉ còn hoạt động.
  - ≥ 90% quyền đến từ luật.
- **Phạm vi:** 5 giai đoạn A–E từ 10/2026 đến Q2/2027. GĐ A–D làm VC Home và nối VClinks, VCwiki; GĐ E đưa VCsale, VCgarage, VC AI, VCe, VCinvoice vào.
- **Tác động lớn nhất:** VClinks và VCwiki chuyển từ "tự giữ cây tổ chức và người dùng" sang "đọc từ VC People" (mục 7). Q-06 đã chốt ngày 08/10/2026: VC People thay, app chỉ đọc ([12](12-cau-hoi-rui-ro.md) mục 4).
- **Người duyệt xem kỹ:** mục 3 (chỉ số), mục 4 (phạm vi theo giai đoạn), mục 7 (tác động), mục 8 (học gì từ phần mềm khác).

## Mục lục

- [1. Bối cảnh](#1-bối-cảnh)
- [2. Vấn đề cần giải quyết](#2-vấn-đề-cần-giải-quyết)
- [3. Mục tiêu và chỉ số](#3-mục-tiêu-và-chỉ-số)
- [4. Phạm vi theo giai đoạn](#4-phạm-vi-theo-giai-đoạn)
- [5. Các bên liên quan](#5-các-bên-liên-quan)
- [6. Giả định và ràng buộc](#6-giả-định-và-ràng-buộc)
- [7. Tác động tới hệ thống hiện có](#7-tác-động-tới-hệ-thống-hiện-có)
- [8. Tham khảo phần mềm đang dùng trên thị trường](#8-tham-khảo-phần-mềm-đang-dùng-trên-thị-trường)
- [9. Thế nào là thành công](#9-thế-nào-là-thành-công)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Bối cảnh

- **Tập đoàn VC Phồn Vinh** có nhiều division: VCparts, VCservice, VCe, VCsoft, VCOBD, VCmedia. Nhân viên dùng hai domain email `@vcprosperous.com` và `@vcpart.vn`.
- **Các app tự xây** đang chạy hoặc đang làm:

| App | Việc | Đăng nhập hôm nay | Người dùng và tổ chức hôm nay |
|---|---|---|---|
| VClinks | Chăm sóc khách đa kênh | Google Workspace, tự tạo người dùng chưa có vai trò | Cây tổ chức riêng (8 loại đơn vị), 10 vai trò, khoảng 160 thao tác, nhập lô tay |
| VCwiki (VC Content Engine) | Kho tri thức, học tập, Content Engine | Email + mật khẩu riêng | Phân hệ ORG riêng: cây đơn vị, trục chức năng, cây quản lý, mức mật C0–C3 |
| VCsale | ERP phụ tùng | Tài khoản riêng | Danh sách nhân viên riêng |
| VCgarage, VCe, VCinvoice | Gara, giáo dục, hoá đơn | Riêng từng app | Riêng từng app |
| VC AI (AI Gatekeeper, đang thiết kế) | Một AI làm việc trên mọi app, đúng quyền của người dùng | Chưa có | Cần định danh chung (lộ trình AI trung tâm Q7) |

- **Lộ trình đã có:** lộ trình AI trung tâm (07/10/2026) đã đặt mục tiêu "SSO chung bằng Google Workspace" (Q7) và "danh bạ tổ chức một nguồn" (GĐ3). VC Home là cách thực hiện hai mục tiêu đó.

## 2. Vấn đề cần giải quyết

| # | Vấn đề | Ảnh hưởng hôm nay |
|---|---|---|
| V1 | Mỗi app một cách đăng nhập | Nhân viên nhớ nhiều mật khẩu; VCwiki dùng mật khẩu riêng, không có xác thực 2 bước |
| V2 | Ba cây tổ chức lệch nhau | Báo cáo theo đơn vị không khớp giữa các app; đổi cơ cấu phải sửa ba nơi; VClinks M1b-03 đang chờ "danh sách nhân sự" (đầu vào E4) |
| V3 | Người mới chờ từng app gán quyền | VClinks tự tạo người dùng "chưa có vai trò" rồi chờ admin; mỗi app một admin, một quy trình |
| V4 | Người nghỉ việc không bị khoá đồng bộ | Rủi ro người đã nghỉ vẫn đọc được hội thoại khách, tri thức nội bộ, dữ liệu bán hàng |
| V5 | Quyền gán tay, không hạn, không rà soát | Quyền tích tụ theo thời gian; không trả lời được "ai đang có quyền vào VCsale, vì sao" |
| V6 | App mới phải làm lại từ đầu phần người dùng | Mỗi app tốn 1–2 tuần cho đăng nhập, người dùng, tổ chức |
| V7 | AI trung tâm cần định danh chung | Gatekeeper V1 phải tạm dùng bảng `identity_links` ghép tài khoản giữa các app |

## 3. Mục tiêu và chỉ số

| Mục tiêu | Chỉ số | Hôm nay | Đích | Đo ở |
|---|---|---|---|---|
| Một lần đăng nhập | % app nội bộ đã nối dùng VC ID | 0% | 100% app đã nối (R1: VClinks, VCwiki) | R1 |
| Biết ai là ai | % nhân viên đang làm có hồ sơ đủ (đơn vị, chức danh, chức năng, quản lý) | Chưa có | ≥ 98% | R2 |
| Một cây tổ chức | Số cây tổ chức đang được sửa tay | 3 | 1 (VClinks, VCwiki chỉ đọc) | R3 |
| Vào làm nhanh | Thời gian từ lúc hồ sơ có hiệu lực tới lúc có đủ quyền mặc định | Vài ngày, tuỳ từng admin | ≤ 1 giờ | R3 |
| Nghỉ việc an toàn | Thời gian từ giờ hiệu lực nghỉ việc tới khi mọi app khoá | Không bảo đảm | ≤ 1 phút | R3 |
| Nghỉ việc an toàn | Số tài khoản của người đã nghỉ còn hoạt động (kiểm hằng tháng) | Không đo được | 0 | R3 |
| Quyền theo luật | % quyền đến từ luật | Không đo được | ≥ 90% | R4 |
| Ngoại lệ có kiểm soát | % quyền ngoại lệ có hạn và có người duyệt | 0% | 100% | R4 |
| Duyệt nhanh | % yêu cầu duyệt xong trong 2 ngày làm việc | — | ≥ 80% | R4 |
| Rà soát | % dòng rà soát được xử lý đúng hạn mỗi quý | — | ≥ 95% | R4 |
| Mở rộng | Thời gian đưa một app mới vào | 1–2 tuần mỗi app | ≤ 2 tuần, phần lớn là việc của app | R5 |

## 4. Phạm vi theo giai đoạn

| GĐ / bản | Có gì | Không có gì |
|---|---|---|
| **A / R1 Đăng nhập chung** | VC ID (Keycloak) nối Google; VC Home trang tĩnh: lưới app theo nhóm, hồ sơ cơ bản từ Google, đăng xuất chung; VCwiki và VClinks đăng nhập qua VC ID; khoá khẩn cấp; đồng bộ trạng thái Google; thanh chuyển app | Hồ sơ nhân sự, cơ cấu tổ chức, luật quyền |
| **B / R2 Hồ sơ và tổ chức** | VC Home API; VC People: hồ sơ, vị trí chính và kiêm nhiệm, quản lý trực tiếp, cây đơn vị, chức danh, chức năng, pháp nhân, nơi làm việc, ngày hiệu lực; hồ sơ của tôi, danh bạ, sơ đồ tổ chức; nhập Excel, đối chiếu Google, lấy dữ liệu khởi đầu từ VClinks, VCwiki; token có mã nhân viên, đơn vị, chức danh; API danh bạ cho app | Cấp quyền theo luật (vẫn dùng nhóm mặc định của GĐ A) |
| **C / R3 Quyền theo luật và vòng đời** | Danh mục vai trò app, chủ app, vai trò nhạy cảm; luật cấp quyền và xem trước; tính lại quyền; đẩy quyền sang VC ID; vào làm, chuyển vị trí, nghỉ việc tự động; sự kiện gửi app; VClinks, VCwiki đọc vai trò và cây tổ chức từ VC Home; tra cứu quyền, báo cáo | Xin quyền ngoại lệ (chỉ có cấp khẩn cấp), rà soát |
| **D / R4 Xin quyền, duyệt, rà soát** | Xin quyền, duyệt 1–2 bước, uỷ quyền, nhắc, tự huỷ; quyền có hạn, gia hạn; rà soát quý; nghỉ dài ngày, quay lại làm; thông báo; cài đặt; xem phiên của mình | — |
| **E / R5 Mở rộng** | VCsale, VCgarage, VC AI, VCe, VCinvoice theo hợp đồng tích hợp; số việc chờ trên ô app; đồng bộ tự động từ phần mềm nhân sự (nếu có) | — |

**Ngoài phạm vi toàn dự án:**
- Lương, hợp đồng lao động, chấm công, đánh giá, tuyển dụng. Đây là việc của phần mềm nhân sự, VC Home không làm.
- Quyền chi tiết bên trong app (thao tác, phạm vi dữ liệu). App vẫn giữ.
- Đăng nhập cho khách hàng, đối tác bên ngoài.
- App điện thoại riêng (VC Home dùng được trên trình duyệt điện thoại).
- Bán VC Home cho doanh nghiệp khác. Thiết kế không chặn hướng này, nhưng chưa làm.

## 5. Các bên liên quan

| Bên | Đại diện | Quan tâm | Tham gia |
|---|---|---|---|
| Chủ dự án | Anh Bùi Thọ Anh | Kiểm soát truy cập, nghỉ việc an toàn, nền cho AI trung tâm | Duyệt tài liệu; Q-01…Q-15 đã uỷ quyền BA chốt ngày 08/10/2026 ([12](12-cau-hoi-rui-ro.md) mục 4); ghi tên người giữ vai trò (N3) |
| HC-NS | Trưởng phòng HC-NS từng pháp nhân + 1 chuyên viên (12 mục 4.3) | Ít nhập liệu trùng, hồ sơ đúng, quy trình vào làm và nghỉ việc rõ | Cung cấp dữ liệu, dùng màn quản trị nhân sự |
| IT / quản trị hệ thống | Dev Platform (chính), dev002 (thay) | Vận hành ổn định, ít việc tay, dễ tra cứu | Vận hành VC ID, VC Home; soạn luật |
| Chủ app | VClinks: dev002; VCwiki: dev phụ trách VCwiki; app khác: trưởng nhóm dev của app; người thay: chủ dự án | App nhận đúng người, đúng vai trò, không phá luồng đang chạy | Khai vai trò app, sửa app theo hợp đồng tích hợp |
| Quản lý, trưởng đơn vị | Giám đốc division, trưởng phòng, tổ trưởng | Người của mình có đủ công cụ; duyệt nhanh | Duyệt yêu cầu, rà soát quý |
| Nhân viên | Mọi người | Đăng nhập một lần, có ngay app cần dùng | Người dùng cuối, UAT |
| Kiểm soát nội bộ, kiểm toán | Kế toán trưởng + 1 người kiểm soát nội bộ | Bằng chứng ai có quyền gì, vì sao, từ khi nào | Xem nhật ký, báo cáo |
| Pháp chế | Người phụ trách pháp chế hoặc luật sư tư vấn ngoài | Tuân thủ NĐ 13/2023 và Luật Bảo vệ dữ liệu cá nhân | Duyệt thông báo xử lý dữ liệu nhân viên |
| Đội lộ trình AI (Gatekeeper) | Nhóm Platform | Định danh chung `sub`, vai trò app chuẩn | Dùng token và vai trò của VC Home |

## 6. Giả định và ràng buộc

**Giả định** (sai thì phải xem lại phạm vi):

| Mã | Giả định |
|---|---|
| GĐ-1 | Mọi nhân viên cần dùng app nội bộ đều có tài khoản Google Workspace công ty |
| GĐ-2 | HC-NS cung cấp được file Excel nhân sự và cơ cấu đủ cột ở mục 12 của [04](04-yeu-cau-chuc-nang.md) (VH-IMP-01) trong 1 tuần kể từ khi có mẫu |
| GĐ-3 | Quy mô tới 2027: ≤ 1.000 nhân viên, ≤ 50 app, ≤ 200 đơn vị |
| GĐ-4 | Mã nhân viên duy nhất toàn tập đoàn đã có hoặc sẽ được đặt ở GĐ B (Q-11) |
| GĐ-5 | Có 1 dev Platform làm VC Home toàn thời gian từ 02/11/2026 (đã chốt; hạn có người 30/10, quá hạn thì R2–R4 dời sau Tết, xem [10](10-ke-hoach-trien-khai.md) mục 5); mỗi app có dev sửa phần tích hợp (khoảng 3 ngày công mỗi app ở GĐ C) |
| GĐ-6 | Máy chủ production của VC ID, VC Home đặt tại Việt Nam (thiết kế SSO, Q2) |

**Ràng buộc:**

| Mã | Ràng buộc |
|---|---|
| RB-1 | Không đụng đăng nhập của VClinks trước mốc M1 chạy thật 26/10/2026 |
| RB-2 | Stack của tập đoàn: NestJS + MongoDB + React + Ant Design; giao diện tiếng Việt; giờ `Asia/Ho_Chi_Minh` |
| RB-3 | Tuân thủ NĐ 13/2023/NĐ-CP và Luật Bảo vệ dữ liệu cá nhân (hiệu lực 01/01/2026); VC Home chỉ giữ thông tin công việc (VH-BR-19) |
| RB-4 | Token cho máy (MCP, thiết bị, extension, agent máy Zalo) của các app giữ nguyên |
| RB-5 | Tài liệu theo quy định Markdown §13 của VClinks; mã yêu cầu không dùng lại |

## 7. Tác động tới hệ thống hiện có

| Hệ thống | Hôm nay | Sau VC Home | Từ GĐ | Ai làm |
|---|---|---|---|---|
| **VClinks**: đăng nhập | Google trực tiếp, token `vcs_` | Qua VC ID; giữ phiên `vcs_` | A | Dev VClinks (thiết kế SSO mục 5.4) |
| **VClinks**: cây tổ chức | Tự giữ, nhập lô (M1b-03) | Nhận một chiều từ VC People; màn nhập lô chuyển sang chỉ đọc | C | Dev VClinks + HC-NS |
| **VClinks**: người dùng và vai trò | Tự tạo người dùng không vai trò; admin gán 10 vai trò | Vai trò app đến từ token và sự kiện; VClinks ánh xạ sang vai trò nội bộ; phạm vi dữ liệu tính từ đơn vị của vai trò | C | Dev VClinks |
| **VClinks**: nghỉ việc, chuyển tổ | Admin làm bàn giao (M1b-11) | Sự kiện `vh.person.left` / `vh.person.moved` mở quy trình bàn giao; chủ khách vẫn do VClinks quyết | C | Dev VClinks |
| **VCwiki**: đăng nhập | Email + mật khẩu | Qua VC ID; mật khẩu chỉ còn cho admin khẩn cấp | A | Dev VCwiki (SYS-60) |
| **VCwiki**: phân hệ ORG | Cây đơn vị, trục chức năng, cây quản lý tự giữ | Nhận một chiều từ VC People; sửa tay bị khoá. Mô hình ORG của VCwiki dùng làm điểm xuất phát cho VC People | C | Dev VCwiki |
| **VCwiki**: vai trò | `admin` / `member`, vai trò chức năng theo lĩnh vực | Vai trò thô (`quan_tri`, `bien_tap`, `thanh_vien`) đến từ VC Home; vai trò theo lĩnh vực, kho, mức mật vẫn trong VCwiki | C | Dev VCwiki |
| **VCsale** | Tài khoản riêng | Vào ở GĐ E theo hợp đồng tích hợp | E | Đội VCsale |
| **Google Workspace** | Nơi quản lý email | Vẫn là nơi tạo, khoá tài khoản Google; trạng thái khoá đồng bộ về VC ID | A | Admin Google |
| **Lộ trình AI trung tâm** | Gatekeeper V1 dự kiến dùng `identity_links` | Dùng `sub` và vai trò app của VC Home; bỏ `identity_links` sớm hơn dự kiến | C trở đi | Nhóm Platform |
| **VC Marketing** | Người dùng theo email `@vcprosperous.com` trong VC Content Engine | Theo VCwiki | A, C | Theo VCwiki |

**Điều kiện để VClinks và VCwiki chuyển sang đọc từ VC People:**
1. VC People có ≥ 98% hồ sơ đủ trường.
2. Đã đối chiếu cây tổ chức cũ của hai app với cây mới, có bảng ánh xạ mã đơn vị cũ → mới.
3. Chủ app duyệt bảng ánh xạ vai trò.

## 8. Tham khảo phần mềm đang dùng trên thị trường

| Phần mềm | Họ làm thế nào | VC Home học gì | Không làm theo |
|---|---|---|---|
| Okta (quốc tế) | Hệ thống nhân sự là nguồn sự thật; luật nhóm theo vị trí, phòng ban, nơi làm; tự động vào làm, chuyển, nghỉ | Hồ sơ là nguồn của quyền; luật theo thuộc tính; tự gỡ quyền cũ khi chuyển | Không mua gói trả phí theo đầu người, không dùng dịch vụ đặt ở nước ngoài |
| Microsoft Entra ID | Gán app cho nhóm kèm vai trò app; trang My Apps; gói quyền có xin, duyệt, hạn | Vai trò app trong token; quyền ngoại lệ có hạn; rà soát | Không bắt công ty dùng tài khoản Microsoft |
| MISA AMIS (Việt Nam) | "AMIS Hệ thống" giữ người dùng, cơ cấu và quyền vào ứng dụng; vai trò chi tiết cấp trong từng ứng dụng; cơ cấu các ứng dụng phải đồng bộ với AMIS Hệ thống | Hai tầng: trung tâm cấp vào app, app giữ vai trò chi tiết; một cơ cấu đồng bộ xuống app | Không gán tay từng người |
| Base.vn (Việt Nam) | "Base Account" quản lý tài khoản, quyền vào từng ứng dụng; có App Admin cho từng ứng dụng | Chủ app cho từng app | Không dừng ở gán tay theo nhóm |

Nguồn khảo sát: [Okta Lifecycle Management](https://www.okta.com/products/lifecycle-management/), [Microsoft Learn – gán người dùng và nhóm cho app](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/assign-user-or-group-access-portal), [Microsoft – gói quyền](https://docs.azure.cn/en-us/Entra/id-governance/entitlement-management-suggested-access-packages), [MISA – phân quyền người dùng và vai trò](https://helpact.misa.vn/?p=73499), [MISA – đồng bộ cơ cấu tổ chức](https://helpact.misa.vn/kb/ket-noi-phan-mem-amis-platform-co-cau-to-chuc/), [Base.vn – Base Account](https://help.base.vn/support/solutions/articles/63000286119-base-account-general-introduction-to-the-app-feature-table).

## 9. Thế nào là thành công

Sau R4 (cuối 01/2027), mọi điều sau đều đúng:

1. Nhân viên mới ngày đầu đi làm mở `home.vcprosperous.com`, đăng nhập Google một lần, thấy đúng các app của vị trí mình, mở app nào cũng vào thẳng với đúng vai trò.
2. HC-NS chỉ sửa hồ sơ ở một nơi. Không app nào còn màn nhập cây tổ chức hay nhập nhân sự riêng.
3. Một người nghỉ việc: đúng 00:00 ngày nghỉ, mọi app khoá, VClinks mở bàn giao khách, không ai phải nhớ đi khoá từng app.
4. Kiểm soát nội bộ trả lời được trong 1 phút: "ai đang có quyền vào VCsale, vì sao, từ khi nào, ai duyệt".
5. Một app mới vào VC Home trong ≤ 2 tuần mà không phải viết phần đăng nhập, người dùng, tổ chức.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 08/10/2026 11:31 | Claude Code (vai BA) | Ghi người giữ vai trò theo chức vụ (Q-07), Q-06 đã chốt, giả định GĐ-5 gắn với quyết định nhân sự | [12](12-cau-hoi-rui-ro.md) mục 4 (người dùng uỷ quyền chốt) |
| 0.1 | 08/10/2026 10:04 | Claude Code (vai BA) | Tạo tài liệu: bối cảnh, 7 vấn đề, mục tiêu và chỉ số, phạm vi 5 giai đoạn, bên liên quan, giả định, ràng buộc, tác động tới 11 điểm của hệ thống hiện có, tham khảo 4 phần mềm, tiêu chí thành công | README bộ tài liệu 0.1; lộ trình AI trung tâm 0.1; khảo sát Okta, Microsoft Entra, MISA AMIS, Base.vn |
