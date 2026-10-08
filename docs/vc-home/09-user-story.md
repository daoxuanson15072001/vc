# VC Home — Câu chuyện người dùng

Phiên bản 0.1 · 08/10/2026 · Trạng thái: Nháp (chờ duyệt)

## Tóm tắt

- **Tài liệu nói gì:** 12 nhóm câu chuyện VH-E-01…12 (mục tiêu, giai đoạn, thước đo thành công) và 88 câu chuyện người dùng VH-US. Mỗi câu chuyện có vai trò, mong muốn, lý do, ưu tiên, giai đoạn, mã yêu cầu, màn hình và 2–4 tiêu chí nghiệm thu dạng "Cho trước … / Khi … / Thì …".
- **Đánh số:** nhóm thứ n dùng dải (n−1)×20+1 … n×20. Ví dụ VH-E-01 dùng VH-US-001…020, VH-E-07 dùng VH-US-121…140. Số còn trống trong dải để dành cho câu chuyện thêm sau; không dùng lại số đã cấp.
- **Độ phủ:** cả 78 yêu cầu ở README mục 5 đều có ít nhất một câu chuyện (bảng mục 15). Không có yêu cầu nào thiếu câu chuyện.
- **Phân bố:** theo giai đoạn đầu tiên của câu chuyện: A 15, B 23, C 24, D 22, E 3, không giai đoạn 1 (VH-US-207, loại W). Theo ưu tiên: M 51, S 30, C 6, W 1.
- **Câu chữ trong tiêu chí** (thông báo, nhãn nút) lấy đúng từ [06-man-hinh.md](06-man-hinh.md); kiểm thử đối chiếu từng chữ.
- **Vai trò "Đội app"** dùng cho câu chuyện tích hợp (VH-E-11): đội phát triển VClinks, VCwiki và app sau; không phải vai trò trong VC Home.
- **Người duyệt xem kỹ:**
  - VH-E-07 và VH-E-09: luật, ngưỡng 20 người, chặn tự duyệt (VH-BR-12, 17, 25);
  - VH-E-08: thứ tự việc khi nghỉ việc (VH-US-144);
  - thước đo thành công của từng nhóm ở mục 2 (cần chủ dự án đồng ý con số);
  - mục 16: các câu chuyện đề xuất chưa có mã yêu cầu.

## Mục lục

- [1. Cách đọc](#1-cách-đọc)
- [2. Danh sách nhóm câu chuyện](#2-danh-sách-nhóm-câu-chuyện)
- [3. VH-E-01 Đăng nhập một lần và đăng xuất chung](#3-vh-e-01-đăng-nhập-một-lần-và-đăng-xuất-chung)
- [4. VH-E-02 Trang chủ và chuyển app](#4-vh-e-02-trang-chủ-và-chuyển-app)
- [5. VH-E-03 Hồ sơ nhân sự và danh bạ](#5-vh-e-03-hồ-sơ-nhân-sự-và-danh-bạ)
- [6. VH-E-04 Cơ cấu tổ chức](#6-vh-e-04-cơ-cấu-tổ-chức)
- [7. VH-E-05 Nhập và đối chiếu dữ liệu ban đầu](#7-vh-e-05-nhập-và-đối-chiếu-dữ-liệu-ban-đầu)
- [8. VH-E-06 Danh mục app và vai trò app](#8-vh-e-06-danh-mục-app-và-vai-trò-app)
- [9. VH-E-07 Quyền theo luật](#9-vh-e-07-quyền-theo-luật)
- [10. VH-E-08 Vòng đời nhân viên](#10-vh-e-08-vòng-đời-nhân-viên)
- [11. VH-E-09 Xin quyền và duyệt](#11-vh-e-09-xin-quyền-và-duyệt)
- [12. VH-E-10 Rà soát định kỳ](#12-vh-e-10-rà-soát-định-kỳ)
- [13. VH-E-11 Tích hợp app](#13-vh-e-11-tích-hợp-app)
- [14. VH-E-12 Quản trị, nhật ký, báo cáo](#14-vh-e-12-quản-trị-nhật-ký-báo-cáo)
- [15. Độ phủ yêu cầu](#15-độ-phủ-yêu-cầu)
- [16. Đề xuất bổ sung (chưa cấp mã)](#16-đề-xuất-bổ-sung-chưa-cấp-mã)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Cách đọc

**Câu chuyện người dùng** là một câu ngắn "Là {vai trò}, tôi muốn {việc} để {lợi ích}". Nó nói ai cần gì và vì sao, không nói cách làm. Cách làm nằm ở yêu cầu (04) và màn hình (06).

**Tiêu chí nghiệm thu** viết theo mẫu Given / When / Then, tiếng Việt là "Cho trước … / Khi … / Thì …":
- **Cho trước:** tình huống ban đầu, dữ liệu có sẵn.
- **Khi:** người dùng hoặc hệ thống làm gì.
- **Thì:** kết quả phải thấy, đo được.

Câu chuyện chỉ xong khi mọi tiêu chí đạt trên môi trường thử.

**Các cột của bảng câu chuyện:**

| Cột | Nghĩa |
|---|---|
| Mã | VH-US-NNN, theo dải của nhóm |
| Là … tôi muốn … để … | Câu chuyện |
| Ưu tiên | MoSCoW: M bắt buộc, S nên có, C làm nếu còn sức, W không làm lần này (README mục 2). Thường lấy theo yêu cầu chính |
| GĐ | Giai đoạn A–E (README mục 4) |
| Yêu cầu | Mã ở README mục 5 (và mã API ở mục 10 nếu cần) |
| Màn hình | Mã VH-MH ở 06; "—" là câu chuyện không có màn (API, việc nền) |

**Vai trò dùng trong câu chuyện:** Nhân viên, Quản lý (quản lý trực tiếp), Trưởng đơn vị, HC-NS, Quản trị hệ thống, Chủ app, Kiểm soát, Ban giám đốc (định nghĩa ở [02](02-tac-nhan-quy-tac.md) mục 2); thêm Đội app và Nhóm vận hành (người ngoài VC Home nhưng dùng kết quả của VC Home).

**Dữ liệu mẫu dùng trong tiêu chí** (người giả định, sẽ thay bằng bộ dữ liệu thử ở [11-uat.md](11-uat.md)):

| Người | Hồ sơ |
|---|---|
| Nguyễn Thị Lan (VCP-0123) | NVKD, Tổ bán hàng 1, VCparts; quản lý: Trần Văn Bình |
| Trần Văn Bình | Trưởng Tổ bán hàng 1, quản lý của Lan |
| Lê Minh Tú (VCP-0145) | CSKH, Phòng CSKH, VCparts |
| Chị Hoa | NVKD VCparts kiêm CSKH VCservice (ví dụ VH-BR-24) |
| Lê Thu Hà | Trưởng Phòng CSKH VCservice |
| Phạm Quốc Huy | Chủ app VClinks |

## 2. Danh sách nhóm câu chuyện

| Mã | Nhóm | GĐ | Mục tiêu | Thước đo thành công (đề xuất) | Dải mã | Số câu chuyện |
|---|---|---|---|---|---|---|
| VH-E-01 | Đăng nhập một lần và đăng xuất chung | A | Một tài khoản Google công ty vào mọi app; đăng xuất một nơi là ra hết; khoá được ngay | 20/20 ca UAT-SSO đạt; khoá trên VC ID mất quyền ≤ 1 phút, khoá trên Google ≤ 65 phút; 0 tài khoản ngoài hai domain đăng nhập được | 001–020 | 9 |
| VH-E-02 | Trang chủ và chuyển app | A, B | Trang chủ là chỗ bắt đầu ngày làm việc; chuyển app một lần bấm | Sau 1 tháng ≥ 80% lượt mở VClinks, VCwiki đi qua VC Home hoặc thanh chuyển app; trang chủ hiện xong < 2 giây trên 4G; điểm truy cập Lighthouse ≥ 90 trên điện thoại | 021–040 | 8 |
| VH-E-03 | Hồ sơ nhân sự và danh bạ | B | VC People là nguồn sự thật về "ai là ai"; ai cũng tìm được đồng nghiệp | 100% nhân viên đang làm có hồ sơ và vị trí chính trước 20/11/2026; ≤ 2% hồ sơ có đề nghị sửa trong tháng đầu; tìm danh bạ ≤ 1 giây | 041–060 | 9 |
| VH-E-04 | Cơ cấu tổ chức | B | Một cây tổ chức chung cho mọi app; đổi cơ cấu có ngày hiệu lực | Màn nhập cây tổ chức của VClinks, VCwiki chuyển sang chỉ đọc trước 11/12/2026; 100% đơn vị đang hoạt động có trưởng đơn vị; 0 vòng trong cây | 061–080 | 7 |
| VH-E-05 | Nhập và đối chiếu dữ liệu ban đầu | B | Đưa dữ liệu ban đầu vào an toàn, khớp Google Workspace | Lô nhập đầu ghi xong với 0 dòng lỗi trước 20/11/2026; 100% tài khoản Google đang hoạt động khớp hồ sơ hoặc có lý do; chạy thử 1.000 dòng ≤ 30 giây | 081–100 | 5 |
| VH-E-06 | Danh mục app và vai trò app | B, C | Danh mục app và vai trò ở một chỗ; mỗi app có chủ; vai trò nhạy cảm được đánh dấu | VClinks, VCwiki công bố đủ vai trò trước GĐ C; 100% app có ≥ 1 chủ app; app mới vào theo checklist ≤ 5 ngày công | 101–120 | 6 |
| VH-E-07 | Quyền theo luật | C | Quyền mặc định đi theo hồ sơ qua luật; luật lớn được xem trước và duyệt hai người | Sau 1 tháng GĐ C ≥ 90% quyền đang có đến từ luật; tính lại quyền ≤ 5 phút; 0 luật trên 20 người áp mà thiếu người thứ hai | 121–140 | 10 |
| VH-E-08 | Vòng đời nhân viên | C, D | Vào làm có ngay đúng app; chuyển tự đổi quyền; nghỉ tự khoá | 100% người nghỉ mất mọi quyền đúng 00:00 ngày nghỉ; người mới thấy đủ app theo luật ngày đầu; 0 tài khoản người đã nghỉ còn đăng nhập được (đối chiếu hằng tháng) | 141–160 | 7 |
| VH-E-09 | Xin quyền và duyệt | D | Quyền ngoại lệ có người duyệt, có hạn; không ai tự duyệt | ≥ 90% yêu cầu xử lý trong 2 ngày; < 5% yêu cầu tự huỷ; 100% quyền "Được duyệt" có hạn ≤ 365 ngày; 0 trường hợp tự duyệt | 161–180 | 9 |
| VH-E-10 | Rà soát định kỳ | D | Quyền ngoại lệ được trưởng đơn vị xác nhận mỗi quý; không xác nhận thì tự gỡ | Từ đợt thứ hai ≥ 95% dòng xử lý trước hạn; báo cáo kết quả có trong 1 ngày sau khi đóng đợt; 0 trưởng đơn vị tự rà soát quyền của mình | 181–200 | 5 |
| VH-E-11 | Tích hợp app | A–C | Mọi app nhận định danh, hồ sơ, quyền theo một hợp đồng; app không tự giữ cây tổ chức | VClinks, VCwiki đạt 8/8 điểm hợp đồng trước 31/10/2026; 99% sự kiện tới app ≤ 1 phút; 0 sự kiện mất | 201–220 | 7 |
| VH-E-12 | Quản trị, nhật ký, báo cáo | A–D | Mọi thay đổi có dấu vết; lãnh đạo có báo cáo; quản trị có tách nhiệm và cài đặt tập trung | 100% thay đổi hồ sơ, cơ cấu, luật, quyền có dòng nhật ký (kiểm mẫu hằng tháng); cảnh báo vận hành tới nhóm trực ≤ 5 phút; BGĐ tự xem báo cáo không cần nhờ IT | 221–240 | 6 |
| | **Tổng** | | | | | **88** |

## 3. VH-E-01 Đăng nhập một lần và đăng xuất chung

**Mục tiêu:** mọi nhân viên dùng một tài khoản Google công ty để vào mọi app; đăng xuất một nơi là ra hết; tài khoản bị khoá ở đâu cũng mất quyền nhanh. **GĐ:** A (VH-US-007 ở B, VH-US-009 ở D). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-001 | Là nhân viên, tôi muốn đăng nhập VC Home bằng tài khoản Google công ty để không phải nhớ thêm mật khẩu nào | M | A | VH-AUT-01 | VH-MH-01, VH-MH-02 |
| VH-US-002 | Là quản trị hệ thống, tôi muốn chặn mọi tài khoản ngoài hai domain công ty để người ngoài không vào được hệ thống | M | A | VH-AUT-02 | VH-MH-01 |
| VH-US-003 | Là nhân viên, tôi muốn đăng nhập một lần rồi mở VClinks, VCwiki không bị hỏi lại, và phiên giữ đủ một ngày làm việc để làm liền mạch | M | A | VH-AUT-03, VH-AUT-05 | VH-MH-02, VH-MH-21 |
| VH-US-004 | Là nhân viên, tôi muốn đăng xuất ở một nơi là ra khỏi mọi app để dùng máy chung an toàn | M | A | VH-AUT-04 | VH-MH-01 |
| VH-US-005 | Là quản trị hệ thống, tôi muốn khoá ngay một tài khoản nghi bị lộ để chặn truy cập ở mọi app trong vòng 1 phút | M | A | VH-AUT-06 | VH-MH-17 (từ GĐ C; GĐ A dùng lệnh `vc-provisioner disable`) |
| VH-US-006 | Là quản trị hệ thống, tôi muốn tài khoản bị khoá hoặc xoá trên Google tự bị khoá trên VC ID để người nghỉ việc không bị sót | M | A | VH-AUT-07 | VH-MH-14 (từ GĐ B) |
| VH-US-007 | Là nhân viên, tôi muốn lần đăng nhập đầu tự gắn với hồ sơ nhân sự của mình để VC Home biết tôi là ai | M | B | VH-AUT-08 | VH-MH-02, VH-MH-03 |
| VH-US-008 | Là quản trị hệ thống, tôi muốn có đường đăng nhập khẩn cấp khi VC ID hoặc Google hỏng để vẫn xử lý được việc gấp | S | A | VH-AUT-09 | — |
| VH-US-009 | Là nhân viên, tôi muốn xem các phiên đăng nhập của mình và đăng xuất phiên lạ để tự bảo vệ tài khoản | C | D | VH-AUT-10 | VH-MH-03 |

**VH-US-001 — Tiêu chí nghiệm thu**
- Cho trước tôi có tài khoản `@vcprosperous.com` và chưa đăng nhập / Khi tôi mở `home.vcprosperous.com`, bấm "Đăng nhập bằng tài khoản công ty" và chọn tài khoản Google / Thì tôi về trang chủ thấy lưới app của mình, không phải nhập gì ngoài bước của Google.
- Cho trước tôi dùng tài khoản `@vcpart.vn` / Khi đăng nhập như trên / Thì kết quả giống hệt tài khoản `@vcprosperous.com`.
- Cho trước tôi bấm huỷ ở trang Google / Khi trình duyệt quay về VC Home / Thì tôi thấy "Bạn đã huỷ đăng nhập" và nút "Thử lại".

**VH-US-002 — Tiêu chí nghiệm thu**
- Cho trước một Gmail cá nhân / Khi chọn tài khoản đó để đăng nhập / Thì bị từ chối với câu "Tài khoản này không thuộc công ty. Hãy chọn tài khoản @vcprosperous.com hoặc @vcpart.vn." và nút "Chọn tài khoản khác".
- Cho trước giả lập một token có email ngoài hai domain lọt qua VC ID / Khi app nhận token / Thì app từ chối với mã `outside_domain` (lớp chặn thứ ba, VH-BR-02).

**VH-US-003 — Tiêu chí nghiệm thu**
- Cho trước tôi đã đăng nhập VC Home / Khi bấm ô VClinks / Thì vào thẳng `/conversations`, không thấy trang đăng nhập nào.
- Cho trước tôi chưa có phiên / Khi mở thẳng một link sâu của VCwiki / Thì chọn tài khoản Google một lần rồi vào đúng trang đó.
- Cho trước tôi để máy không dùng 12 giờ / Khi mở lại VC Home / Thì phải đăng nhập lại.
- Cho trước tôi dùng liên tục / Khi tròn 7 ngày kể từ lần đăng nhập / Thì phải đăng nhập lại.

**VH-US-004 — Tiêu chí nghiệm thu**
- Cho trước tôi đang mở VC Home, VClinks, VCwiki / Khi bấm "Đăng xuất" ở VClinks và xác nhận "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?" / Thì trong ≤ 10 giây VCwiki và VC Home cũng mất phiên, trình duyệt về `/da-dang-xuat` với tiêu đề "Bạn đã đăng xuất khỏi mọi ứng dụng".
- Cho trước tôi đăng xuất từ VC Home / Khi bấm "Đăng xuất" / Thì không có trang xác nhận và mọi app mất phiên.

**VH-US-005 — Tiêu chí nghiệm thu**
- Cho trước GĐ A, một người đang mở 3 app / Khi quản trị chạy `vc-provisioner disable <email> --reason "…"` / Thì người đó mất phiên ở mọi app trong ≤ 1 phút.
- Cho trước từ GĐ C / Khi quản trị bấm "Khoá tài khoản" ở VH-MH-17 kèm lý do / Thì như trên, và người đó đăng nhập lại thấy "Tài khoản đã bị khoá. Liên hệ quản trị viên."
- Cho trước quản trị không nhập lý do / Khi bấm "Khoá tài khoản" / Thì báo "Nhập lý do (ít nhất 10 ký tự)." và không khoá.
- Cho trước tài khoản đã khoá / Khi xem nhật ký / Thì có dòng ghi người khoá, thời điểm, lý do.

**VH-US-006 — Tiêu chí nghiệm thu**
- Cho trước admin Google khoá một tài khoản / Khi job đồng bộ hằng giờ chạy / Thì trong ≤ 65 phút tài khoản bị khoá trên VC ID, mất phiên ở mọi app, quản trị nhận thông báo.
- Cho trước Google trả danh sách ít hơn 50% lần trước / Khi job chạy / Thì job dừng, không khoá ai và báo quản trị.
- Cho trước tài khoản được mở lại trên Google / Khi job chạy / Thì VC ID không tự mở khoá, chỉ báo quản trị.

**VH-US-007 — Tiêu chí nghiệm thu**
- Cho trước HC-NS đã tạo hồ sơ với email của tôi / Khi tôi đăng nhập lần đầu / Thì tài khoản gắn với hồ sơ, trang chủ hiện thẻ hồ sơ đúng tên, chức danh, đơn vị.
- Cho trước email của tôi chưa có hồ sơ / Khi đăng nhập / Thì trang chủ không có ô app và hiện "Tài khoản chưa có hồ sơ nhân sự, liên hệ HC-NS".
- Cho trước HC-NS đã đổi email của tôi trên hồ sơ trước khi đổi trên Google / Khi tôi đăng nhập bằng email mới / Thì vẫn đúng hồ sơ cũ, không sinh người mới (VH-BR-01).

**VH-US-008 — Tiêu chí nghiệm thu**
- Cho trước Google không trả lời / Khi quản trị dùng tài khoản khẩn cấp có mã TOTP (mã 6 số đổi mỗi 30 giây trên điện thoại) ở realm `master` / Thì vào được màn quản trị VC ID; mỗi lần dùng được ghi nhật ký và báo nhóm quản trị.
- Cho trước VC ID hỏng / Khi bật cờ khẩn cấp ở app (VClinks `AUTH_TOKEN_LOGIN`, VCwiki `AUTH_PASSWORD_LOGIN=admin`) / Thì quản trị app đăng nhập được, người dùng thường vẫn không.

**VH-US-009 — Tiêu chí nghiệm thu**
- Cho trước tôi đăng nhập trên máy tính và điện thoại / Khi mở tab "Phiên đăng nhập" ở "Hồ sơ của tôi" / Thì thấy 2 dòng có thiết bị, IP rút gọn, lần dùng gần nhất; dòng hiện tại có nhãn "Phiên này".
- Cho trước có một phiên lạ / Khi bấm "Đăng xuất phiên này" / Thì phiên đó mất ở mọi app, phiên hiện tại vẫn dùng được, toast "Đã đăng xuất phiên trên {thiết bị}."

## 4. VH-E-02 Trang chủ và chuyển app

**Mục tiêu:** trang chủ là chỗ bắt đầu ngày làm việc: biết mình là ai, mở app được cấp, thấy app có thể xin; trong mỗi app chuyển sang app khác bằng một lần bấm. **GĐ:** A, B (phần sau ở C, D, E). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-021 | Là nhân viên, tôi muốn trang chủ chỉ hiện app tôi được dùng và ghim được app hay dùng lên đầu để mở việc nhanh | M | A | VH-HOM-01 | VH-MH-02 |
| VH-US-022 | Là nhân viên, tôi muốn thấy thẻ hồ sơ ngắn trên trang chủ để biết VC Home ghi tôi là ai và báo sai kịp | M | B | VH-HOM-02 | VH-MH-02 |
| VH-US-023 | Là nhân viên, tôi muốn thấy vai trò của mình trên từng ô app và hạn chuyển tiếp khi đổi vị trí để biết mình vào app với tư cách gì | S | C | VH-HOM-03 | VH-MH-02 |
| VH-US-024 | Là nhân viên, tôi muốn thấy các app tôi có thể xin quyền để tự xin mà không phải hỏi IT | S | D | VH-HOM-04 | VH-MH-02, VH-MH-05 |
| VH-US-025 | Là nhân viên, tôi muốn có nút 9 chấm trong VClinks và VCwiki để chuyển app mà không phải quay về VC Home | S | A | VH-HOM-05 | VH-MH-21 |
| VH-US-026 | Là nhân viên, tôi muốn thấy app "Sắp có" và các liên kết hay dùng (Gmail, Drive, MISA) trên trang chủ để có một chỗ bắt đầu duy nhất | C | A | VH-HOM-06 | VH-MH-02, VH-MH-15 |
| VH-US-027 | Là nhân viên, tôi muốn thấy số việc đang chờ trên ô app để biết app nào cần mở trước | C | E | VH-HOM-07, VH-INT-07 | VH-MH-02, VH-MH-21 |
| VH-US-028 | Là nhân viên, tôi muốn nhận thông báo trong VC Home khi có việc chờ tôi duyệt, quyền sắp hết hạn hay có kết quả yêu cầu để không bỏ lỡ việc | S | D | VH-HOM-08 | Header (ngăn kéo thông báo), VH-MH-04, VH-MH-08 |

**VH-US-021 — Tiêu chí nghiệm thu**
- Cho trước tôi có quyền VClinks, không có quyền VCwiki / Khi mở trang chủ / Thì thấy ô VClinks, không thấy ô VCwiki.
- Cho trước tôi ghim ô VCwiki / Khi tải lại trang / Thì VCwiki đứng đầu lưới.
- Cho trước màn hình điện thoại rộng 390 px / Khi mở trang chủ / Thì lưới 1 cột, không có thanh cuộn ngang.

**VH-US-022 — Tiêu chí nghiệm thu**
- Cho trước hồ sơ của tôi đã có vị trí chính / Khi mở trang chủ / Thì thẻ hiện ảnh, họ tên, chức danh, đơn vị, quản lý trực tiếp đúng với VC People.
- Cho trước tôi có một vị trí kiêm nhiệm / Khi xem thẻ / Thì có thêm dòng "Kiêm: {chức danh} · {đơn vị}".
- Cho trước không tải được hồ sơ / Khi mở trang chủ / Thì thẻ báo "Không tải được hồ sơ." với nút "Thử lại", lưới app vẫn dùng được.

**VH-US-023 — Tiêu chí nghiệm thu**
- Cho trước tôi có vai trò NVKD trong VClinks / Khi xem ô VClinks / Thì có nhãn "VClinks · NVKD".
- Cho trước tôi vừa chuyển từ NVKD sang CSKH, VClinks đặt chuyển tiếp 3 ngày / Khi xem ô / Thì có nhãn "VClinks · NVKD, CSKH" và huy hiệu "Còn 3 ngày".
- Cho trước hết 3 ngày / Khi tải lại trang / Thì nhãn chỉ còn "VClinks · CSKH", huy hiệu biến mất.

**VH-US-024 — Tiêu chí nghiệm thu**
- Cho trước VCgarage đang chạy, có vai trò cho phép xin, và tôi chưa có vai trò nào ở VCgarage / Khi mở trang chủ / Thì VCgarage nằm trong vùng "Có thể xin quyền".
- Cho trước tôi bấm "Xin quyền" trên ô VCgarage / Khi ngăn kéo mở / Thì ô "Ứng dụng" đã chọn sẵn VCgarage.
- Cho trước một app chỉ có vai trò không cho xin / Khi mở trang chủ / Thì app đó không nằm trong vùng này.

**VH-US-025 — Tiêu chí nghiệm thu**
- Cho trước tôi đang ở VClinks / Khi bấm nút 9 chấm / Thì thấy "VC Home" ở đầu, rồi các app tôi có quyền; VClinks có dấu "đang mở".
- Cho trước tôi bấm VCwiki trong danh sách / Khi trang chuyển / Thì vào thẳng VCwiki, không hỏi đăng nhập.
- Cho trước tôi bị bỏ quyền VCwiki / Khi mở lại danh sách sau ≤ 5 phút / Thì không còn VCwiki.

**VH-US-026 — Tiêu chí nghiệm thu**
- Cho trước VCsale có trạng thái "Sắp có" / Khi xem trang chủ / Thì ô VCsale mờ, có chữ "Sắp có", bấm không mở gì.
- Cho trước quản trị đã khai liên kết ngoài Gmail / Khi tôi bấm ô Gmail / Thì Gmail mở ở tab mới.
- Cho trước tôi đang ở VClinks / Khi mở thanh chuyển app / Thì không thấy ô "Sắp có" và liên kết ngoài (chỉ trang chủ có).

**VH-US-027 — Tiêu chí nghiệm thu**
- Cho trước VCwiki trả 5 việc chờ qua API trạng thái (VH-API-09) / Khi mở trang chủ / Thì ô VCwiki có số 5; trên 99 hiện "99+".
- Cho trước một app không trả lời trong 3 giây / Khi mở trang chủ / Thì ô đó không có số, trang không báo lỗi và không chậm hơn.

**VH-US-028 — Tiêu chí nghiệm thu**
- Cho trước một người trong đội gửi yêu cầu quyền / Khi tôi mở VC Home / Thì chuông có số 1 và thông báo "{tên} xin {app} · {vai trò} trong {n} ngày"; bấm vào mở đúng yêu cầu ở hộp duyệt.
- Cho trước quyền của tôi còn 14 ngày / Khi tới ngày đó / Thì tôi nhận thông báo "{app} · {vai trò} hết hạn ngày {dd/mm/yyyy}" dẫn tới nút "Gia hạn".
- Cho trước tôi bấm "Đánh dấu đã đọc tất cả" / Khi xem chuông / Thì số chưa đọc về 0.

## 5. VH-E-03 Hồ sơ nhân sự và danh bạ

**Mục tiêu:** VC People là nguồn sự thật về hồ sơ công việc; mỗi người đang làm có đúng 1 vị trí chính và 1 quản lý; mọi thay đổi có ngày hiệu lực và lịch sử; ai cũng tìm được đồng nghiệp mà thông tin không lộ quá mức. **GĐ:** B. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-041 | Là HC-NS, tôi muốn tạo và sửa hồ sơ nhân sự trên VC Home để mọi app đọc chung một nguồn | M | B | VH-NSU-01 | VH-MH-11 |
| VH-US-042 | Là HC-NS, tôi muốn ghi vị trí chính và các vị trí kiêm nhiệm có từ ngày, đến ngày để quyền và phạm vi trong app tính đúng | M | B | VH-NSU-02 | VH-MH-11 |
| VH-US-043 | Là HC-NS, tôi muốn ghi quản lý trực tiếp cho từng vị trí và được chặn vòng quản lý để luồng duyệt luôn đến đúng người | M | B | VH-NSU-03 | VH-MH-11, VH-MH-07 |
| VH-US-044 | Là HC-NS, tôi muốn mọi thay đổi trạng thái và vị trí có ngày hiệu lực và hẹn trước được để làm theo quyết định đã ký | M | B | VH-NSU-04 | VH-MH-11 |
| VH-US-045 | Là HC-NS, tôi muốn xem lịch sử mọi thay đổi của một hồ sơ để trả lời "ai đổi gì, khi nào, vì sao" | M | B | VH-NSU-05 | VH-MH-11, VH-MH-03 |
| VH-US-046 | Là nhân viên, tôi muốn xem hồ sơ công việc của mình và gửi đề nghị sửa khi sai để dữ liệu đúng mà không phải nhắn riêng HC-NS | M | B | VH-NSU-06 | VH-MH-03 |
| VH-US-047 | Là HC-NS, tôi muốn nhận và xử lý đề nghị sửa hồ sơ ngay trên VC Home để giữ dấu vết và báo kết quả cho người đề nghị | M | B | VH-NSU-06 | VH-MH-11 |
| VH-US-048 | Là nhân viên, tôi muốn tìm đồng nghiệp theo tên, email, SĐT, đơn vị để liên hệ đúng người | S | B | VH-NSU-07 | VH-MH-06 |
| VH-US-049 | Là quản lý, tôi muốn xem hồ sơ công việc đầy đủ của người trong đội, còn người ngoài chỉ thấy thông tin danh bạ, để thông tin không lộ quá mức | M | B | VH-NSU-08 | VH-MH-06, VH-MH-09 |

**VH-US-041 — Tiêu chí nghiệm thu**
- Cho trước tôi là HC-NS của VCparts / Khi thêm nhân viên với mã, họ tên, email công ty và vị trí chính / Thì hồ sơ được tạo và toast "Đã tạo hồ sơ {mã}."
- Cho trước mã nhân viên đã dùng cho một người đã nghỉ / Khi tôi nhập lại mã đó / Thì báo "Mã nhân viên {mã} đã được dùng (kể cả người đã nghỉ). Mã không dùng lại."
- Cho trước email ngoài hai domain công ty / Khi lưu / Thì báo "Email phải thuộc @vcprosperous.com hoặc @vcpart.vn."
- Cho trước tôi chỉ có phạm vi VCparts / Khi mở danh sách nhân sự / Thì không thấy người của VCe.

**VH-US-042 — Tiêu chí nghiệm thu**
- Cho trước chị Hoa là NVKD VCparts / Khi thêm kiêm nhiệm CSKH VCservice từ 01/09/2026 đến 31/12/2026 / Thì hồ sơ có 1 vị trí chính và 1 kiêm nhiệm, mỗi vị trí có quản lý riêng.
- Cho trước chuyển vị trí chính có hiệu lực 01/11/2026 / Khi lưu / Thì vị trí cũ đóng ngày 31/10/2026, vị trí mới mở ngày 01/11/2026, vị trí cũ vẫn xem được trong lịch sử.
- Cho trước tôi tạo vị trí chính thứ hai trùng thời gian / Khi lưu / Thì báo "Nhân viên đang làm phải có đúng 1 vị trí chính."

**VH-US-043 — Tiêu chí nghiệm thu**
- Cho trước Bình quản lý Lan / Khi đặt Lan làm quản lý của Bình / Thì báo "Không chọn được: Nguyễn Thị Lan đang ở dưới quyền của người này (tạo vòng quản lý)."
- Cho trước tôi chọn chính người đó làm quản lý / Khi lưu / Thì báo "Không chọn chính người này làm quản lý."
- Cho trước hồ sơ đã có quản lý / Khi mở sơ đồ tổ chức chế độ "Theo quản lý" / Thì người đó nằm dưới quản lý vừa ghi.

**VH-US-044 — Tiêu chí nghiệm thu**
- Cho trước quyết định ký ngày 20/10 điều chuyển từ 01/11 / Khi tôi lưu với ngày hiệu lực 01/11/2026 / Thì toast "Đã hẹn áp lúc 00:00 ngày 01/11/2026." và hồ sơ có thẻ "Có 1 thay đổi đã hẹn".
- Cho trước tới 00:00 ngày 01/11/2026 giờ Việt Nam / Khi hệ thống chạy / Thì vị trí mới có hiệu lực; thẻ hồ sơ và token lần đăng nhập sau đổi theo.
- Cho trước thay đổi chưa tới ngày / Khi bấm "Huỷ hẹn" và nhập lý do / Thì thay đổi bị bỏ và nhật ký ghi lại.

**VH-US-045 — Tiêu chí nghiệm thu**
- Cho trước hồ sơ đã đổi đơn vị 2 lần / Khi mở tab "Lịch sử" ở VH-MH-11 / Thì thấy 2 dòng có ngày hiệu lực, giá trị trước, giá trị sau, người sửa, lý do.
- Cho trước tôi là nhân viên / Khi mở "Hồ sơ của tôi" tab "Lịch sử thay đổi" / Thì thấy đúng lịch sử hồ sơ của chính mình.

**VH-US-046 — Tiêu chí nghiệm thu**
- Cho trước chức danh của tôi ghi sai / Khi bấm "Đề nghị sửa", chọn "Chức danh", nhập giá trị đúng / Thì toast "Đã gửi đề nghị tới HC-NS." và tab "Đề nghị của tôi" có dòng "Chờ HC-NS".
- Cho trước tôi đã có đề nghị đang chờ cho cùng trường / Khi gửi đề nghị thứ hai / Thì báo "Bạn đã có đề nghị đang chờ cho trường này. Huỷ đề nghị cũ hoặc chờ HC-NS xử lý."
- Cho trước tôi xem hồ sơ của mình / Khi tìm cách sửa trực tiếp / Thì không có ô sửa nào; chỉ có nút "Đề nghị sửa".

**VH-US-047 — Tiêu chí nghiệm thu**
- Cho trước có đề nghị sửa chức danh của Lan / Khi tôi bấm "Áp dụng" / Thì biểu mẫu sửa mở với giá trị đề nghị; lưu xong Lan nhận thông báo "HC-NS đã duyệt đề nghị sửa chức danh".
- Cho trước tôi bấm "Từ chối" mà không nhập lý do / Khi xác nhận / Thì báo "Nhập lý do" và không từ chối.

**VH-US-048 — Tiêu chí nghiệm thu**
- Cho trước tôi gõ "lan nguyen" (không dấu) vào ô tìm ở header / Khi ngừng gõ 300 ms / Thì danh sách gợi ý có "Nguyễn Thị Lan".
- Cho trước tôi lọc đơn vị "Phòng Kinh doanh" có tích "Gồm đơn vị con" / Khi xem danh bạ / Thì thấy cả người ở Tổ bán hàng 1 và Tổ bán hàng 2.
- Cho trước một người đã nghỉ việc / Khi tìm tên người đó / Thì không thấy trong danh bạ.

**VH-US-049 — Tiêu chí nghiệm thu**
- Cho trước tôi là nhân viên thường / Khi mở thẻ một đồng nghiệp / Thì chỉ thấy ảnh, tên, chức danh, đơn vị, email, SĐT công việc, nơi làm việc, quản lý; không thấy mã nhân viên, loại nhân viên, ngày vào.
- Cho trước tôi là quản lý của người đó (trực tiếp hoặc cấp trên) / Khi mở thẻ / Thì thấy thêm khối "Thông tin công việc" và nhật ký ghi một dòng xem hồ sơ C1.
- Cho trước tôi mở thẻ của cấp trên mình / Khi xem / Thì chỉ thấy thông tin danh bạ (VH-BR-23).

## 6. VH-E-04 Cơ cấu tổ chức

**Mục tiêu:** một cây tổ chức chung cho cả tập đoàn và mọi app; danh mục chức danh, chức năng, pháp nhân, nơi làm việc dùng chung; đổi cơ cấu có ngày hiệu lực và không mất lịch sử. **GĐ:** B (đổi tên, chuyển, gộp, ngừng ở C). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-061 | Là HC-NS, tôi muốn dựng cây đơn vị nhiều cấp (tập đoàn, pháp nhân, division, phòng, tổ) để mọi app dùng chung một cơ cấu | M | B | VH-ORG-01 | VH-MH-12 |
| VH-US-062 | Là HC-NS, tôi muốn giữ danh mục chức danh và chức năng để hồ sơ và luật cấp quyền dùng cùng một bộ giá trị | M | B | VH-ORG-02, VH-ORG-03 | VH-MH-13 |
| VH-US-063 | Là HC-NS, tôi muốn ghi danh mục pháp nhân và nơi làm việc để luật, báo cáo và phạm vi theo pháp nhân chạy đúng | S | B | VH-ORG-07 | VH-MH-13 |
| VH-US-064 | Là HC-NS, tôi muốn đặt một trưởng cho mỗi đơn vị để có người rà soát quyền và người duyệt thay khi thiếu quản lý | M | B | VH-ORG-04 | VH-MH-12 |
| VH-US-065 | Là HC-NS, tôi muốn đổi tên và chuyển đơn vị sang đơn vị cha khác có ngày hiệu lực để làm theo quyết định tái cơ cấu | S | C | VH-ORG-05 | VH-MH-12 |
| VH-US-066 | Là HC-NS, tôi muốn gộp hoặc ngừng đơn vị mà không mất lịch sử để cơ cấu gọn mà báo cáo cũ vẫn đúng | S | C | VH-ORG-05 | VH-MH-12 |
| VH-US-067 | Là nhân viên, tôi muốn xem sơ đồ tổ chức theo đơn vị hoặc theo quản lý để hiểu ai phụ trách gì | S | B | VH-ORG-06 | VH-MH-07 |

**VH-US-061 — Tiêu chí nghiệm thu**
- Cho trước đơn vị "Phòng Kinh doanh" / Khi bấm "+ Thêm đơn vị con" loại Tổ / Thì tổ mới hiện ngay dưới phòng trong cây.
- Cho trước một đơn vị loại Tổ / Khi thêm đơn vị con / Thì báo "Tổ / Nhóm không có đơn vị con."
- Cho trước tôi kéo một nút trong cây / Khi thả ra / Thì cây không đổi và có gợi ý "Dùng nút Chuyển đơn vị để đổi đơn vị cha."

**VH-US-062 — Tiêu chí nghiệm thu**
- Cho trước chức năng "CSKH" đã có / Khi thêm chức năng trùng tên / Thì báo "Tên này đã có."
- Cho trước một chức danh còn người dùng / Khi bấm "Ngừng" / Thì người cũ giữ nguyên, còn vị trí mới không chọn được chức danh này.
- Cho trước tôi tìm nút xoá / Khi xem danh mục / Thì không có; chỉ có "Ngừng".

**VH-US-063 — Tiêu chí nghiệm thu**
- Cho trước tôi thêm pháp nhân với mã số thuế 9 số / Khi lưu / Thì báo "Mã số thuế gồm 10 hoặc 13 chữ số."
- Cho trước nơi làm việc "Kho Hà Nội" gán cho một hồ sơ / Khi xem danh bạ và bộ dựng điều kiện của luật / Thì danh bạ hiện nơi làm việc và luật chọn được thuộc tính "Nơi làm việc".

**VH-US-064 — Tiêu chí nghiệm thu**
- Cho trước đơn vị đã có trưởng / Khi đặt trưởng thứ hai / Thì báo "Đơn vị đã có trưởng là {tên}. Bỏ trưởng cũ trước."
- Cho trước một người không có vị trí trong đơn vị hay đơn vị cha trực tiếp / Khi đặt làm trưởng / Thì báo "Trưởng đơn vị phải có vị trí thuộc đơn vị này hoặc đơn vị cha trực tiếp."
- Cho trước đặt trưởng thành công / Khi người đó đăng nhập / Thì menu có "Đội của tôi" (và "Rà soát quyền" từ GĐ D).

**VH-US-065 — Tiêu chí nghiệm thu**
- Cho trước Tổ bán hàng 3 thuộc Phòng KD 1 / Khi "Chuyển đơn vị" sang Phòng KD 2 với ngày hiệu lực 01/12/2026 / Thì màn hiện "{n} người bị ảnh hưởng, quyền theo luật tính lại" và hẹn áp lúc 00:00 ngày 01/12/2026.
- Cho trước tôi chọn đơn vị cha mới là một đơn vị con của chính nó / Khi lưu / Thì báo "Không chuyển được: {tên} là đơn vị con của đơn vị đang chuyển (tạo vòng)."
- Cho trước thay đổi tới ngày hiệu lực / Khi hệ thống áp / Thì app nhận sự kiện `vh.org.unit_changed`.

**VH-US-066 — Tiêu chí nghiệm thu**
- Cho trước Tổ A còn 5 người đang làm / Khi bấm "Ngừng" / Thì báo "Đơn vị còn 5 người đang làm. Chuyển hết người trước khi ngừng."
- Cho trước "Gộp vào…" Tổ B với ngày hiệu lực 01/12/2026 / Khi tới ngày / Thì mọi vị trí ở Tổ A chuyển sang Tổ B, Tổ A thành "Ngừng", lịch sử vẫn ghi tên Tổ A.

**VH-US-067 — Tiêu chí nghiệm thu**
- Cho trước tôi mở sơ đồ tổ chức / Khi bấm nút "Phòng CSKH" / Thì thấy trưởng đơn vị, số người và danh sách người trong phòng.
- Cho trước tôi chuyển sang "Theo quản lý" / Khi tìm tên mình / Thì cây mở tới nút của tôi và tô sáng.
- Cho trước màn hình điện thoại / Khi mở sơ đồ / Thì cây hiện dạng thụt lề, bấm được bằng ngón tay.

## 7. VH-E-05 Nhập và đối chiếu dữ liệu ban đầu

**Mục tiêu:** đưa hồ sơ và cơ cấu ban đầu vào VC People an toàn (chạy thử trước, ghi một lần), khớp với Google Workspace, tận dụng cây tổ chức đang có ở VClinks và VCwiki. **GĐ:** B (đồng bộ tự động ở E). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-081 | Là HC-NS, tôi muốn tải file mẫu và chạy thử file Excel để thấy dòng nào OK, cảnh báo, lỗi trước khi ghi | M | B | VH-IMP-01 | VH-MH-14 |
| VH-US-082 | Là HC-NS, tôi muốn ghi lô đã chạy thử vào hệ thống với một ngày hiệu lực để dữ liệu vào đúng và chỉ một lần | M | B | VH-IMP-01 | VH-MH-14 |
| VH-US-083 | Là quản trị hệ thống, tôi muốn đối chiếu hồ sơ với Google Workspace để thấy ai có Google mà không có hồ sơ và ngược lại | M | B | VH-IMP-02 | VH-MH-14 |
| VH-US-084 | Là HC-NS, tôi muốn lấy cây tổ chức đang có ở VClinks và VCwiki làm điểm khởi đầu để không phải gõ lại từ đầu | S | B | VH-IMP-03 | VH-MH-14 |
| VH-US-085 | Là HC-NS, tôi muốn hồ sơ tự đồng bộ từ phần mềm nhân sự khi công ty có để không phải nhập hai nơi | C | E | VH-IMP-04 | VH-MH-14 |

**VH-US-081 — Tiêu chí nghiệm thu**
- Cho trước tôi chọn loại "Nhân sự và vị trí" / Khi bấm "Tải file mẫu .xlsx" / Thì nhận file có sheet "Hướng dẫn" và sheet danh mục để chọn.
- Cho trước file 312 dòng, trong đó 7 dòng có mã quản lý không tồn tại / Khi tải lên / Thì bảng kết quả ghi "OK 290 · Cảnh báo 15 · Lỗi 7", dòng lỗi có câu "Quản lý "{mã}" không có trong file hoặc hệ thống.", và chưa có gì ghi vào hồ sơ.
- Cho trước file `.xls` hoặc lớn hơn 5 MB / Khi tải lên / Thì báo "Chỉ nhận file .xlsx." hoặc "File vượt quá 5 MB."

**VH-US-082 — Tiêu chí nghiệm thu**
- Cho trước lô còn dòng lỗi / Khi rê chuột lên "Ghi vào hệ thống" / Thì nút khoá với câu "Còn {n} dòng lỗi. Sửa file rồi tải lại."
- Cho trước lô có 0 lỗi, 15 cảnh báo, tôi đã tích "Tôi đã xem 15 cảnh báo" / Khi bấm ghi và xác nhận / Thì toast "Đã ghi {n} dòng. Lô số {mã lô}." và tab "Lịch sử" có lô này với file gốc, file kết quả.
- Cho trước một người có trong hệ thống nhưng không có trong file / Khi ghi lô / Thì người đó không bị đặt nghỉ việc; chỉ có cảnh báo lúc chạy thử.

**VH-US-083 — Tiêu chí nghiệm thu**
- Cho trước 3 tài khoản Google chưa có hồ sơ / Khi bấm "Chạy đối chiếu ngay" / Thì nhóm "Có tài khoản Google, không có hồ sơ" có đúng 3 dòng.
- Cho trước tài khoản Google đã khoá mà hồ sơ còn "Đang làm" / Khi đối chiếu / Thì dòng đó nằm ở nhóm "Google đã khoá, hồ sơ đang làm" và danh sách nhân sự gắn cảnh báo "Lệch Google".
- Cho trước tôi là quản trị hệ thống / Khi mở một dòng đối chiếu / Thì không có nút sửa hồ sơ (VH-BR-17).

**VH-US-084 — Tiêu chí nghiệm thu**
- Cho trước VClinks có cây tổ chức riêng / Khi bấm "Lấy cây từ VClinks" / Thì bảng so sánh hiện cây VClinks cạnh cây VCwiki; VClinks không bị ghi gì.
- Cho trước tôi bấm "Xuất ra file mẫu" / Khi mở file / Thì sheet cơ cấu đã điền sẵn mã, tên, đơn vị cha để tôi sửa rồi nhập lại qua VH-US-081.

**VH-US-085 — Tiêu chí nghiệm thu**
- Cho trước phần mềm nhân sự đã nối (Q-01) / Khi có nhân viên mới ở đó / Thì VC People tạo hồ sơ qua cùng các bước kiểm như nhập Excel; dòng lỗi vào danh sách chờ HC-NS xử lý.
- Cho trước đồng bộ tự động đang bật / Khi HC-NS sửa tay một trường do phần mềm nhân sự quản / Thì màn báo trường đó do nguồn quản và hướng dẫn sửa ở nguồn.

## 8. VH-E-06 Danh mục app và vai trò app

**Mục tiêu:** danh mục app, liên kết ngoài và vai trò của từng app nằm ở một chỗ; mỗi app có chủ; vai trò nhạy cảm được đánh dấu; app mới vào theo một hợp đồng. **GĐ:** B (danh mục), C (vai trò, chủ app, nhạy cảm, chuyển tiếp), E (đưa app mới vào). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-101 | Là quản trị hệ thống, tôi muốn quản lý danh mục app (tên, URL, biểu tượng, trạng thái, thứ tự, liên kết ngoài) để trang chủ và thanh chuyển app luôn đúng | M | A, B | VH-APP-01 | VH-MH-15 |
| VH-US-102 | Là chủ app, tôi muốn khai các vai trò thô mà app tôi nhận để VC Home cấp đúng vai trò và app tự ánh xạ sang quyền chi tiết | M | C | VH-APP-02 | VH-MH-15 |
| VH-US-103 | Là quản trị hệ thống, tôi muốn ghi 1–3 chủ app cho mỗi app để có người chịu trách nhiệm vai trò và duyệt vai trò nhạy cảm | M | C | VH-APP-03 | VH-MH-15 |
| VH-US-104 | Là chủ app, tôi muốn đánh dấu vai trò nhạy cảm để yêu cầu xin vai trò đó luôn qua tay tôi duyệt | M | C | VH-APP-05 | VH-MH-15, VH-MH-05 |
| VH-US-105 | Là quản trị hệ thống, tôi muốn đặt thời gian chuyển tiếp 0–7 ngày cho từng app theo đề nghị của chủ app để người đổi vị trí kịp bàn giao việc | S | C | VH-APP-06 | VH-MH-15 |
| VH-US-106 | Là quản trị hệ thống, tôi muốn đưa app mới vào theo hợp đồng tích hợp có danh sách kiểm để app nào vào cũng an toàn như nhau | S | E | VH-APP-04 | VH-MH-15 |

**VH-US-101 — Tiêu chí nghiệm thu**
- Cho trước GĐ A / Khi sửa `apps.yaml` sai khuôn rồi build / Thì bước kiểm schema dừng build và báo dòng sai; `catalog.json` cũ giữ nguyên.
- Cho trước GĐ B / Khi tôi đổi VCsale từ "Sắp có" sang "Đang chạy" trên màn / Thì trong ≤ 5 phút ô VCsale hết mờ với người có quyền.
- Cho trước tôi nhập URL bắt đầu bằng `http://` / Khi lưu / Thì báo "URL phải bắt đầu bằng https://"
- Cho trước tôi là kiểm soát / Khi mở màn App và vai trò / Thì có nhãn "Chỉ xem" và không có nút ghi nào.

**VH-US-102 — Tiêu chí nghiệm thu**
- Cho trước tôi là chủ app VClinks / Khi thêm vai trò `giam_sat` có mô tả / Thì vai trò hiện trong tab "Vai trò" và chọn được ở luật, ở ngăn xin quyền (nếu bật "Cho phép xin").
- Cho trước tôi là chủ app VClinks / Khi mở app VCwiki / Thì chỉ xem, không sửa được vai trò.
- Cho trước vai trò còn 4 người giữ / Khi bấm "Ngừng vai trò" / Thì báo "Vai trò đang có 4 người giữ và {m} luật dùng. Gỡ quyền hoặc tắt luật trước."

**VH-US-103 — Tiêu chí nghiệm thu**
- Cho trước app chưa có chủ / Khi lưu / Thì báo "Chọn ít nhất 1 chủ app."
- Cho trước app đã có 3 chủ / Khi thêm người thứ tư / Thì báo "Tối đa 3 chủ app."
- Cho trước một người vừa được ghi là chủ app VClinks / Khi đăng nhập / Thì menu có "App và vai trò", "Luật cấp quyền", "Tra cứu quyền", "Nhật ký", "Hộp duyệt", tất cả lọc theo VClinks.

**VH-US-104 — Tiêu chí nghiệm thu**
- Cho trước vai trò `giam_sat` được đánh dấu nhạy cảm / Khi nhân viên chọn vai trò này ở ngăn xin quyền / Thì thấy "Vai trò nhạy cảm: cần thêm chủ app duyệt" và "Người duyệt dự kiến" có 2 bước.
- Cho trước tôi đổi cờ nhạy cảm / Khi lưu / Thì bắt buộc nhập lý do và nhật ký ghi giá trị trước, sau.

**VH-US-105 — Tiêu chí nghiệm thu**
- Cho trước tôi nhập 10 ngày / Khi lưu / Thì báo "Thời gian chuyển tiếp từ 0 đến 7 ngày."
- Cho trước VClinks đặt 3 ngày / Khi một NVKD chuyển sang CSKH / Thì vai trò CSKH có ngay, vai trò NVKD gỡ sau đúng 3 ngày.
- Cho trước tôi là chủ app / Khi mở tab "Thông tin" của app mình / Thì thấy thời gian chuyển tiếp nhưng không sửa được (ma trận 02: chủ app chỉ đọc cấu hình app).

**VH-US-106 — Tiêu chí nghiệm thu**
- Cho trước VCsale mới đạt 6/8 điểm của danh sách kiểm / Khi đổi trạng thái sang "Đang chạy" / Thì không cho, màn hiện 2 điểm còn thiếu.
- Cho trước đủ 8 điểm và "Gửi sự kiện thử" trả mã 2xx / Khi đổi sang "Đang chạy" / Thì VCsale xuất hiện trên trang chủ của người có quyền.

## 9. VH-E-07 Quyền theo luật

**Mục tiêu:** quyền mặc định đi theo hồ sơ qua luật dựa trên thuộc tính, không gán tay từng người; luật được xem trước; luật lớn cần người thứ hai duyệt; quyền ngoại lệ có hạn và gỡ được; ai cũng tra được "ai có quyền gì". **GĐ:** C (hạn dùng ở D). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-121 | Là quản trị hệ thống, tôi muốn viết luật theo thuộc tính hồ sơ (pháp nhân, đơn vị, chức danh, chức năng, loại nhân viên…) để người đúng tự có vai trò app | M | C | VH-ACC-01 | VH-MH-16 |
| VH-US-122 | Là quản trị hệ thống, tôi muốn xem trước ai được thêm, ai mất quyền trước khi áp luật để không cấp hay gỡ nhầm hàng loạt | S | C | VH-ACC-03 | VH-MH-16 |
| VH-US-123 | Là chủ app, tôi muốn luật ảnh hưởng trên 20 người phải có người thứ hai duyệt để một người không tự áp thay đổi lớn | M | C | VH-ACC-01, VH-ACC-03 | VH-MH-16, VH-MH-08 |
| VH-US-124 | Là nhân viên, tôi muốn quyền tự tính lại khi hồ sơ, cơ cấu hoặc luật đổi để không phải xin lại sau mỗi lần điều chuyển | M | C | VH-ACC-02 | VH-MH-04 |
| VH-US-125 | Là quản trị hệ thống, tôi muốn cấp quyền khẩn cấp tối đa 7 ngày có lý do để xử lý việc gấp mà vẫn có dấu vết | S | C | VH-ACC-04 | VH-MH-17 |
| VH-US-126 | Là người giữ quyền ngoại lệ, tôi muốn quyền có hạn, được báo trước khi hết và tự gỡ khi hết hạn để không ai giữ quyền thừa | M | D | VH-ACC-05 | VH-MH-04 |
| VH-US-127 | Là quản trị hệ thống, tôi muốn gỡ một quyền ngoại lệ có lý do để xử lý sai sót hay rủi ro ngay | M | C | VH-ACC-06 | VH-MH-17 |
| VH-US-128 | Là đội app, tôi muốn quyền được đẩy sang VC ID thành nhóm và vai trò trong token để app đọc được ở lần đăng nhập sau | M | C | VH-ACC-07 | VH-MH-17 |
| VH-US-129 | Là kiểm soát, tôi muốn tra "người này có quyền gì" và "ai có vai trò này" để trả lời kiểm toán | M | C | VH-ACC-08 | VH-MH-17 |
| VH-US-130 | Là nhân viên, tôi muốn xem mình có quyền gì, từ đâu, đến khi nào; là quản lý, tôi muốn xem quyền của đội, để biết ai đang dùng gì | M | C | VH-ACC-08, VH-HOM-03 | VH-MH-04, VH-MH-09 |

**VH-US-121 — Tiêu chí nghiệm thu**
- Cho trước luật "Pháp nhân là VCparts và Chức năng là Bán hàng → VClinks · NVKD" / Khi luật được áp / Thì mọi người thoả điều kiện có vai trò NVKD trong VClinks với nguồn "Luật".
- Cho trước chị Hoa kiêm CSKH VCservice và có luật "Pháp nhân là VCservice và Chức năng là CSKH → VClinks · CSKH" / Khi hai luật chạy / Thì chị có NVKD tại VCparts và CSKH tại VCservice (VH-BR-24).
- Cho trước tôi mở danh sách thuộc tính của bộ dựng điều kiện / Khi tìm "email" hoặc "mã nhân viên" / Thì không có (VH-BR-10).

**VH-US-122 — Tiêu chí nghiệm thu**
- Cho trước một luật nháp / Khi bấm "Xem trước" / Thì thấy "+N người được thêm quyền", "−M người mất quyền", "K người không đổi" và danh sách từng nhóm có tên, chức danh, đơn vị.
- Cho trước tôi sửa điều kiện sau khi đã xem trước / Khi rê chuột lên "Áp dụng" / Thì nút khoá với câu "Bấm Xem trước sau lần sửa cuối rồi mới áp dụng."
- Cho trước 1.000 người trong hệ thống / Khi bấm "Xem trước" / Thì có kết quả trong ≤ 10 giây.

**VH-US-123 — Tiêu chí nghiệm thu**
- Cho trước xem trước ra +38 và −4 / Khi nhìn biểu mẫu / Thì có dải "Luật này làm thay đổi quyền của 42 người (trên 20). Cần người thứ hai duyệt trước khi có hiệu lực." và nút "Gửi duyệt" thay cho "Áp dụng".
- Cho trước tôi là người soạn / Khi chọn người duyệt bước hai / Thì danh sách không có tên tôi; mở luật đang chờ thì không có nút "Duyệt và áp dụng".
- Cho trước người duyệt mở luật sau khi hồ sơ đã đổi / Khi bấm "Duyệt và áp dụng" / Thì hệ thống tính lại và hỏi "Số người bị ảnh hưởng đã đổi từ {cũ} thành {mới}. Vẫn áp dụng?" nếu con số khác.
- Cho trước xem trước ra +12 và −3 (15 người) / Khi bấm "Áp dụng" / Thì luật có hiệu lực ngay, không cần người thứ hai, nhật ký vẫn ghi.

**VH-US-124 — Tiêu chí nghiệm thu**
- Cho trước HC-NS chuyển tôi sang chức năng CSKH có hiệu lực hôm nay / Khi lưu / Thì trong ≤ 5 phút tôi có vai trò CSKH theo luật.
- Cho trước đơn vị của tôi được chuyển sang division khác / Khi thay đổi có hiệu lực / Thì quyền của mọi người trong đơn vị được tính lại theo luật của division mới.
- Cho trước một luật bị tắt / Khi tắt có hiệu lực / Thì người chỉ có quyền từ luật đó mất quyền sau thời gian chuyển tiếp của app; người có thêm nguồn "Được duyệt" vẫn giữ quyền (VH-BR-09).

**VH-US-125 — Tiêu chí nghiệm thu**
- Cho trước tôi chọn thời hạn 7 ngày và nhập lý do ≥ 10 ký tự / Khi bấm "Cấp khẩn cấp" / Thì người đó có quyền ngay với nguồn "Khẩn cấp"; quản lý trực tiếp và kiểm soát được báo.
- Cho trước tôi cấp cho chính mình / Khi bấm cấp / Thì báo "Không tự cấp quyền khẩn cấp cho chính bạn."
- Cho trước hết 7 ngày / Khi hệ thống chạy / Thì quyền tự gỡ và người giữ quyền được báo.

**VH-US-126 — Tiêu chí nghiệm thu**
- Cho trước quyền "Được duyệt" hết hạn ngày 31/12/2026 / Khi tới ngày 17/12 và 28/12 / Thì tôi nhận thông báo "{app} · {vai trò} hết hạn ngày 31/12/2026".
- Cho trước tới 00:00 ngày 01/01/2027 / Khi hệ thống chạy / Thì quyền bị gỡ, app nhận `vh.grant.removed`, ô app biến mất nếu tôi không còn vai trò nào ở app đó.
- Cho trước cùng vai trò còn nguồn "Luật" / Khi nguồn "Được duyệt" hết hạn / Thì tôi vẫn giữ vai trò.

**VH-US-127 — Tiêu chí nghiệm thu**
- Cho trước một quyền nguồn "Được duyệt" / Khi bấm "Gỡ" và nhập lý do / Thì quyền gỡ ngay, người giữ quyền nhận thông báo "Đã gỡ {app} · {vai trò}. Lý do: {lý do}".
- Cho trước quyền chỉ có nguồn "Luật" / Khi rê chuột lên "Gỡ" / Thì nút khoá với câu "Quyền này đến từ luật {tên}. Sửa luật hoặc hồ sơ để gỡ."
- Cho trước tôi là chủ app VClinks / Khi tra quyền VCwiki của một người / Thì không có nút "Gỡ".

**VH-US-128 — Tiêu chí nghiệm thu**
- Cho trước một người vừa được cấp VClinks · CSKH / Khi người đó đăng nhập lại VClinks / Thì token có vai trò `cskh` của app `vclinks`.
- Cho trước việc đẩy sang VC ID bị lỗi / Khi quản trị tra cứu người đó / Thì thấy "Lỗi đẩy: {mã}" và nút "Đẩy lại sang VC ID".

**VH-US-129 — Tiêu chí nghiệm thu**
- Cho trước tôi tìm "Nguyễn Thị Lan" ở tab "Theo người" / Khi xem kết quả / Thì thấy mọi quyền với nguồn, luật hoặc yêu cầu gốc, hạn; không có nút gỡ, cấp, khoá.
- Cho trước tôi chọn VClinks · Giám sát ở tab "Theo app" / Khi bấm "Xuất Excel" / Thì tải được danh sách và nhật ký ghi lần xuất.

**VH-US-130 — Tiêu chí nghiệm thu**
- Cho trước tôi có VClinks · NVKD theo luật và VCwiki · Biên tập được duyệt đến 31/12/2026 / Khi mở "Quyền của tôi" / Thì thấy 2 dòng: chip "Luật" với hạn "Không hạn"; chip "Được duyệt" với hạn "31/12/2026".
- Cho trước tôi là quản lý / Khi mở tab "Quyền" ở "Đội của tôi" / Thì thấy quyền của cả cây dưới quyền và không thấy quyền của người ngoài đội.

## 10. VH-E-08 Vòng đời nhân viên

**Mục tiêu:** người mới vào làm có ngay đúng app và vai trò; chuyển vị trí tự đổi quyền, có thời gian chuyển tiếp để bàn giao; nghỉ việc tự khoá, gỡ quyền và báo app bàn giao; nghỉ dài ngày giữ quyền. **GĐ:** C (nghỉ dài ngày, quay lại ở D). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-141 | Là HC-NS, tôi muốn tạo hồ sơ người mới trước ngày vào để ngày đầu người đó đăng nhập là có đúng app và vai trò | M | C | VH-LCM-01 | VH-MH-11, VH-MH-02 |
| VH-US-142 | Là HC-NS, tôi muốn chuyển vị trí và thấy trước quyền sẽ thêm, sẽ gỡ để báo đúng cho người được chuyển và quản lý | M | C | VH-LCM-02 | VH-MH-11 |
| VH-US-143 | Là nhân viên vừa chuyển vị trí, tôi muốn giữ vai trò cũ trong thời gian chuyển tiếp của app để bàn giao khách và việc đang dở | S | C | VH-LCM-02, VH-APP-06 | VH-MH-02, VH-MH-04 |
| VH-US-144 | Là HC-NS, tôi muốn đặt ngày nghỉ việc để đến 00:00 ngày đó tài khoản tự khoá, mọi quyền tự gỡ và app tự bàn giao | M | C | VH-LCM-03 | VH-MH-11 |
| VH-US-145 | Là HC-NS, tôi muốn được báo khi quản lý của ai đó nghỉ việc để gán quản lý mới, còn trong lúc chờ trưởng đơn vị duyệt thay | M | C | VH-LCM-03, VH-NSU-03 | VH-MH-11, VH-MH-08 |
| VH-US-146 | Là HC-NS, tôi muốn ghi nghỉ dài ngày và ngày quay lại để app tạm không chia việc mới mà người đó không mất quyền | S | D | VH-LCM-04 | VH-MH-11, VH-MH-06 |
| VH-US-147 | Là HC-NS, tôi muốn cho người đã nghỉ quay lại làm với đúng mã nhân viên cũ để lịch sử liền mạch | C | D | VH-LCM-05 | VH-MH-11 |

**VH-US-141 — Tiêu chí nghiệm thu**
- Cho trước ngày 25/10 tôi tạo hồ sơ với ngày vào 01/11/2026 / Khi xem hồ sơ / Thì trạng thái là "Sắp vào làm" và người đó chưa có quyền nào.
- Cho trước tới 00:00 ngày 01/11/2026 / Khi người mới đăng nhập lần đầu / Thì tài khoản gắn với hồ sơ, trang chủ có đủ app theo luật, các app nhận `vh.person.joined`.

**VH-US-142 — Tiêu chí nghiệm thu**
- Cho trước tôi mở biểu mẫu "Chuyển vị trí" / Khi chọn đơn vị và chức năng mới / Thì khung "Quyền sẽ thay đổi" hiện dòng "+ …" và "− … (gỡ sau {n} ngày chuyển tiếp)", không có nút sửa quyền (VH-BR-17).
- Cho trước thay đổi có hiệu lực / Khi hệ thống áp / Thì app nhận `vh.person.moved` và người được chuyển nhận thông báo quyền được thêm.

**VH-US-143 — Tiêu chí nghiệm thu**
- Cho trước VClinks đặt chuyển tiếp 3 ngày và tôi chuyển từ NVKD sang CSKH ngày 01/11/2026 / Khi xem trang chủ ngày 01/11 / Thì ô VClinks có "VClinks · NVKD, CSKH" và "Còn 3 ngày".
- Cho trước tới 00:00 ngày 04/11/2026 / Khi tôi đăng nhập lại VClinks / Thì token chỉ còn vai trò `cskh`.

**VH-US-144 — Tiêu chí nghiệm thu**
- Cho trước tôi đặt ngày nghỉ 15/11/2026 cho Lê Minh Tú / Khi bấm lưu / Thì hệ thống hỏi "Đến 00:00 ngày 15/11/2026, Lê Minh Tú bị khoá đăng nhập, gỡ mọi quyền và các app nhận sự kiện nghỉ việc. Tiếp tục?"
- Cho trước tới 00:00 ngày 15/11/2026 / Khi hệ thống chạy / Thì làm đúng thứ tự: khoá VC ID và đăng xuất mọi app; gỡ mọi quyền ở mọi nguồn; gửi `vh.person.left`; đóng các vị trí; hồ sơ thành "Đã nghỉ" (VH-BR-14).
- Cho trước cần khoá gấp trước ngày nghỉ / Khi quản trị dùng "Khoá tài khoản" / Thì tài khoản khoá ngay, ngày nghỉ đã đặt giữ nguyên.

**VH-US-145 — Tiêu chí nghiệm thu**
- Cho trước Trần Văn Bình đang là quản lý của 6 người và nghỉ việc / Khi ngày nghỉ có hiệu lực / Thì 6 hồ sơ có cảnh báo "Thiếu quản lý" và HC-NS nhận thông báo "6 người đang thiếu quản lý trực tiếp".
- Cho trước một trong 6 người gửi yêu cầu quyền / Khi tính người duyệt / Thì bước 1 là trưởng đơn vị của vị trí chính (VH-BR-05), và yêu cầu hiện trong hộp duyệt của trưởng đơn vị.

**VH-US-146 — Tiêu chí nghiệm thu**
- Cho trước chị Hà nghỉ thai sản từ 01/12/2026 đến 31/05/2027 / Khi tôi lưu "Nghỉ dài ngày" không tích "Khoá đăng nhập" / Thì chị giữ mọi quyền, đăng nhập được, app nhận `vh.person.leave_started`, danh bạ hiện "Vắng đến 31/05".
- Cho trước thời gian nghỉ dưới 7 ngày / Khi lưu / Thì báo "Nghỉ dài ngày tính từ 7 ngày trở lên."
- Cho trước tôi bấm "Kết thúc nghỉ dài ngày" / Khi tới ngày quay lại / Thì app nhận `vh.person.returned` và nhãn "Vắng" mất.

**VH-US-147 — Tiêu chí nghiệm thu**
- Cho trước Lê Minh Tú đã nghỉ, mã VCP-0145 / Khi bấm "Cho quay lại làm" với vị trí và ngày vào mới / Thì hồ sơ cũ mở lại với cùng mã, lịch sử cũ giữ nguyên, quyền tính lại theo luật từ ngày vào mới.
- Cho trước anh Tú từng có quyền ngoại lệ trước khi nghỉ / Khi quay lại / Thì quyền ngoại lệ không tự khôi phục; phải xin lại.

## 11. VH-E-09 Xin quyền và duyệt

**Mục tiêu:** ai cần quyền ngoài luật thì tự xin, có lý do và thời hạn; quản lý trực tiếp duyệt, vai trò nhạy cảm thêm chủ app; không ai tự duyệt; yêu cầu không treo mãi; có uỷ quyền khi vắng và gia hạn. **GĐ:** D. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-161 | Là nhân viên, tôi muốn gửi yêu cầu một vai trò app có lý do và thời hạn, biết trước ai duyệt, để được cấp đúng việc cần | M | D | VH-REQ-01 | VH-MH-05, VH-MH-04 |
| VH-US-162 | Là quản lý trực tiếp, tôi muốn duyệt hoặc từ chối yêu cầu của người dưới quyền và rút ngắn thời hạn nếu cần để kiểm soát quyền của đội | M | D | VH-REQ-02 | VH-MH-08 |
| VH-US-163 | Là chủ app, tôi muốn duyệt bước 2 cho vai trò nhạy cảm của app mình để không ai có quyền nhạy cảm mà tôi không biết | M | D | VH-REQ-02, VH-APP-05 | VH-MH-08 |
| VH-US-164 | Là kiểm soát, tôi muốn hệ thống chặn mọi trường hợp tự duyệt để tách nhiệm đúng VH-BR-12 và VH-BR-17 | M | D | VH-REQ-02 | VH-MH-08 |
| VH-US-165 | Là quản lý có đội lớn, tôi muốn duyệt nhiều yêu cầu thường một lần nhưng phải duyệt từng cái với vai trò nhạy cảm để vừa nhanh vừa an toàn | S | D | VH-REQ-02 | VH-MH-08 |
| VH-US-166 | Là người duyệt, tôi muốn uỷ quyền duyệt cho người khác khi đi vắng để yêu cầu của đội không bị tự huỷ | S | D | VH-REQ-03 | VH-MH-08 |
| VH-US-167 | Là người xin quyền, tôi muốn người duyệt được nhắc và yêu cầu quá 7 ngày tự huỷ có báo để yêu cầu không treo mãi | S | D | VH-REQ-04 | VH-MH-08, VH-MH-04 |
| VH-US-168 | Là quản lý, tôi muốn xin quyền thay cho người dưới quyền để người mới có quyền kịp mà không phải tự tìm hiểu hệ thống | C | D | VH-REQ-05 | VH-MH-09, VH-MH-05 |
| VH-US-169 | Là nhân viên, tôi muốn gia hạn quyền sắp hết hạn bằng một nút để công việc không bị gián đoạn | S | D | VH-REQ-06 | VH-MH-04, VH-MH-05 |

**VH-US-161 — Tiêu chí nghiệm thu**
- Cho trước tôi chọn VCwiki · Biên tập, lý do 46 ký tự, thời hạn 90 ngày / Khi bấm "Gửi yêu cầu" / Thì toast "Đã gửi yêu cầu. {tên người duyệt} sẽ nhận thông báo." và tab "Yêu cầu của tôi" có dòng "Chờ bước 1: {tên}".
- Cho trước lý do chỉ có 12 ký tự / Khi bấm gửi / Thì báo "Lý do cần ít nhất 20 ký tự (đang có 12)." và không gửi.
- Cho trước tôi đã có yêu cầu đang chờ cho cùng vai trò / Khi gửi lần nữa / Thì báo "Đã có yêu cầu đang chờ duyệt cho vai trò này (gửi ngày {dd/mm/yyyy})."
- Cho trước tôi chọn một vai trò nhạy cảm / Khi nhìn vùng "Người duyệt dự kiến" / Thì thấy ① quản lý trực tiếp và ② chủ app, cùng dòng "Yêu cầu tự huỷ nếu chưa duyệt xong sau 7 ngày".

**VH-US-162 — Tiêu chí nghiệm thu**
- Cho trước yêu cầu vai trò thường đang chờ tôi / Khi bấm "Duyệt" / Thì người xin có quyền nguồn "Được duyệt" với hạn đã chốt, nhận thông báo "Đã duyệt: {app} · {vai trò} đến {dd/mm/yyyy}".
- Cho trước người xin xin 180 ngày / Khi tôi chọn 30 ngày rồi duyệt / Thì quyền hết hạn sau 30 ngày; chọn dài hơn 180 thì báo "Chỉ rút ngắn được, không kéo dài hơn thời hạn đã xin."
- Cho trước tôi bấm "Từ chối" mà không ghi lý do / Khi xác nhận / Thì báo "Nhập lý do từ chối".

**VH-US-163 — Tiêu chí nghiệm thu**
- Cho trước quản lý đã duyệt bước 1 yêu cầu VClinks · Giám sát / Khi tôi (chủ app VClinks) mở hộp duyệt / Thì yêu cầu ở bước "2 / 2" kèm tên và thời điểm duyệt bước 1.
- Cho trước tôi là chủ app VClinks và tự xin VClinks · Giám sát / Khi bước 1 xong / Thì bước 2 chuyển cho quản trị hệ thống, không vào hộp của tôi.

**VH-US-164 — Tiêu chí nghiệm thu**
- Cho trước quản lý X xin thay cho Y, mà X là quản lý trực tiếp của Y / Khi hệ thống tính người duyệt / Thì bước 1 chuyển lên quản lý của X.
- Cho trước Z đang duyệt thay X và Z gửi yêu cầu cho chính mình mà X là quản lý của Z / Khi yêu cầu vào hàng duyệt / Thì yêu cầu không vào phần duyệt thay của Z mà chuyển lên quản lý của X.
- Cho trước yêu cầu của tôi vì lý do nào đó hiện trong hộp duyệt của tôi / Khi rê chuột lên "Duyệt" / Thì nút khoá với câu "Không duyệt được yêu cầu của chính bạn." và API cũng từ chối.

**VH-US-165 — Tiêu chí nghiệm thu**
- Cho trước tôi chọn 2 yêu cầu vai trò thường / Khi bấm "Duyệt các mục đã chọn" / Thì toast "Đã duyệt 2 yêu cầu."
- Cho trước trong lựa chọn có 1 vai trò nhạy cảm / Khi rê chuột lên "Duyệt các mục đã chọn" / Thì nút khoá với câu "Vai trò nhạy cảm phải duyệt từng yêu cầu."
- Cho trước tôi mở hộp duyệt trên điện thoại rộng dưới 600 px / Khi xem danh sách / Thì không có ô chọn nhiều; duyệt từng thẻ.

**VH-US-166 — Tiêu chí nghiệm thu**
- Cho trước tôi uỷ quyền cho Lê Thu Hà từ 10/11 đến 20/11/2026 / Khi có yêu cầu mới trong khoảng đó / Thì yêu cầu vào hộp của chị Hà với nhãn "Duyệt thay {tên tôi}", và người xin thấy người duyệt dự kiến là chị Hà.
- Cho trước tôi chọn chính mình hoặc khoảng dài hơn 60 ngày / Khi lưu / Thì báo "Không uỷ quyền cho chính bạn." hoặc "Uỷ quyền tối đa 60 ngày mỗi lần."
- Cho trước hết ngày 20/11/2026 / Khi có yêu cầu mới / Thì yêu cầu về lại hộp của tôi.

**VH-US-167 — Tiêu chí nghiệm thu**
- Cho trước yêu cầu gửi ngày 01/11 chưa duyệt / Khi tới ngày 03/11 và 06/11 / Thì người duyệt nhận thông báo nhắc "Yêu cầu của {tên} còn {n} ngày trước khi tự huỷ".
- Cho trước tới ngày 08/11 vẫn chưa duyệt xong / Khi hệ thống chạy / Thì yêu cầu thành "Đã tự huỷ" và người xin nhận "Đã tự huỷ vì quá 7 ngày chưa duyệt xong".

**VH-US-168 — Tiêu chí nghiệm thu**
- Cho trước tôi là quản lý của Lan / Khi bấm "Xin quyền thay" ở "Đội của tôi" / Thì ngăn kéo mở với "Xin cho: Nguyễn Thị Lan".
- Cho trước tôi chọn một người ngoài đội / Khi gửi / Thì báo "Người này không thuộc đội của bạn."
- Cho trước tôi là quản lý trực tiếp của Lan / Khi hệ thống tính người duyệt / Thì bước 1 là quản lý của tôi (không tự duyệt).

**VH-US-169 — Tiêu chí nghiệm thu**
- Cho trước quyền "Được duyệt" còn 20 ngày / Khi bấm "Gia hạn" / Thì ngăn kéo "Gia hạn quyền" mở sẵn app, vai trò, có dòng "Hạn mới tính từ ngày hết hạn cũ."
- Cho trước quyền nguồn "Khẩn cấp" / Khi rê chuột lên "Gia hạn" / Thì nút khoá với câu "Quyền khẩn cấp không gia hạn được. Hãy gửi yêu cầu quyền thường."
- Cho trước yêu cầu gia hạn 90 ngày được duyệt / Khi xem "Quyền của tôi" / Thì hạn mới bằng hạn cũ cộng 90 ngày.

## 12. VH-E-10 Rà soát định kỳ

**Mục tiêu:** mỗi quý trưởng đơn vị xác nhận lại từng quyền ngoại lệ của người trong đơn vị; quyền không được xác nhận trong 14 ngày tự gỡ; kết quả có báo cáo cho kiểm soát. **GĐ:** D. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-181 | Là quản trị hệ thống, tôi muốn mở đợt rà soát quý cho mọi quyền ngoại lệ còn hiệu lực để định kỳ dọn quyền thừa | S | D | VH-REV-01 | VH-MH-18 |
| VH-US-182 | Là trưởng đơn vị, tôi muốn xác nhận giữ hoặc gỡ từng quyền ngoại lệ của đơn vị để chỉ người cần mới giữ quyền | S | D | VH-REV-02 | VH-MH-10 |
| VH-US-183 | Là kiểm soát, tôi muốn quyền của chính trưởng đơn vị do trưởng đơn vị cấp trên rà soát để không ai tự xác nhận quyền mình | S | D | VH-REV-02 | VH-MH-10, VH-MH-18 |
| VH-US-184 | Là quản trị hệ thống, tôi muốn quyền không được xác nhận trong hạn tự gỡ để đợt rà soát có hiệu lực thật | S | D | VH-REV-03 | VH-MH-18 |
| VH-US-185 | Là kiểm soát, tôi muốn theo dõi tiến độ và tải báo cáo kết quả đợt rà soát để làm bằng chứng kiểm soát nội bộ | S | D | VH-REV-01, VH-REV-03 | VH-MH-18 |

**VH-US-181 — Tiêu chí nghiệm thu**
- Cho trước có 120 quyền ngoại lệ còn hiệu lực / Khi bấm "Mở đợt rà soát" / Thì hộp thoại báo sẽ tạo 120 dòng; xác nhận xong mỗi trưởng đơn vị nhận thông báo "Đợt rà soát {tên đợt}: {n} quyền cần bạn xác nhận trước {dd/mm/yyyy}".
- Cho trước đang có một đợt mở / Khi rê chuột lên "Mở đợt rà soát" / Thì nút khoá với câu "Đang có đợt {tên} mở đến {dd/mm/yyyy}."
- Cho trước có quyền mặc định từ luật / Khi tạo đợt / Thì không có dòng nào cho quyền từ luật (VH-BR-16).

**VH-US-182 — Tiêu chí nghiệm thu**
- Cho trước đợt đang mở / Khi tôi bấm "Giữ" 10 dòng, "Gỡ" 2 dòng với lý do "Không còn cần", rồi "Gửi kết quả" / Thì 2 quyền gỡ ngay và người giữ quyền được báo; 10 quyền giữ nguyên hạn cũ; toast "Đã gửi kết quả rà soát."
- Cho trước tôi bấm "Gỡ" mà không chọn lý do / Khi lưu / Thì báo "Chọn lý do gỡ".
- Cho trước tôi dùng điện thoại / Khi mở "Rà soát quyền" / Thì làm được hết bằng thẻ từng dòng, không có thanh cuộn ngang.

**VH-US-183 — Tiêu chí nghiệm thu**
- Cho trước trưởng Phòng KD có một quyền ngoại lệ / Khi đợt mở / Thì dòng đó không ở màn của chính trưởng Phòng KD mà ở màn của trưởng đơn vị cấp trên.
- Cho trước trưởng đơn vị nghỉ việc giữa đợt / Khi quản trị bấm "Chuyển người rà soát" / Thì các dòng của đơn vị chuyển sang trưởng đơn vị cấp trên.

**VH-US-184 — Tiêu chí nghiệm thu**
- Cho trước đợt hạn 14 ngày còn 8 dòng chưa xử lý / Khi hết hạn / Thì 8 quyền tự gỡ; người giữ quyền và trưởng đơn vị nhận thông báo.
- Cho trước tôi bấm "Đóng đợt sớm" / Khi xác nhận "Đóng đợt? {n} quyền chưa xác nhận sẽ tự gỡ ngay." / Thì đợt đóng và các quyền đó gỡ như trên.

**VH-US-185 — Tiêu chí nghiệm thu**
- Cho trước đợt đang mở / Khi tôi (kiểm soát) mở trang đợt / Thì thấy tiến độ từng đơn vị, chỉ xem; không có nút "Nhắc", "Đóng đợt sớm".
- Cho trước đợt đã đóng / Khi bấm "Xuất báo cáo" / Thì nhận file Excel từng dòng: người, app · vai trò, người rà soát, quyết định, lý do, thời điểm; nhật ký ghi lần xuất.

## 13. VH-E-11 Tích hợp app

**Mục tiêu:** mọi app nhận định danh, hồ sơ và quyền từ VC Home theo một hợp đồng: token có claim chuẩn, API đọc danh bạ và cơ cấu, sự kiện có chữ ký, đăng xuất phía máy chủ; app không tự giữ cây tổ chức. **GĐ:** A–C. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-201 | Là đội app, tôi muốn token có bộ claim chuẩn theo giai đoạn (định danh ở A, hồ sơ ở B, vai trò app kèm đơn vị ở C) để app không phải gọi thêm lúc đăng nhập | M | A, B, C | VH-INT-01 | — |
| VH-US-202 | Là đội app, tôi muốn gọi API danh bạ và cơ cấu (nhân viên, chuỗi quản lý, cây đơn vị, danh mục) để bỏ cây tổ chức riêng của app | M | B | VH-INT-02 | — |
| VH-US-203 | Là quản trị hệ thống, tôi muốn cấp token máy cho từng app để app gọi API VC Home an toàn và thu hồi được | M | B | VH-INT-06 | VH-MH-15 |
| VH-US-204 | Là đội app, tôi muốn nhận sự kiện thay đổi (vào làm, chuyển, nghỉ, quyền, đơn vị) có chữ ký và được gửi lại khi lỗi để app tự cập nhật | M | C | VH-INT-03 | VH-MH-15 |
| VH-US-205 | Là đội app, tôi muốn kéo sự kiện từ một mốc khi bị gián đoạn để không mất thay đổi nào | S | C | VH-INT-05 | — |
| VH-US-206 | Là đội app, tôi muốn nhận thông báo đăng xuất phía máy chủ để thu hồi phiên của app khi người dùng đăng xuất hay bị khoá | M | A | VH-INT-04 | — |
| VH-US-207 | Là quản trị hệ thống, tôi muốn ghi lại nhu cầu cấp tài khoản theo chuẩn SCIM cho app mua ngoài để xét ở lần sau | W | — | VH-INT-08 | — |

**VH-US-201 — Tiêu chí nghiệm thu**
- Cho trước GĐ A / Khi đăng nhập / Thì `id_token` có `sub`, `email`, `name`, `picture`, `hd`, `groups`, `sid`.
- Cho trước GĐ B / Khi đăng nhập / Thì token có thêm mã nhân viên, đơn vị, chức danh, chức năng của vị trí chính và không có thông tin ngoài công việc (VH-BR-19).
- Cho trước GĐ C, token không có vai trò nào của app / Khi người đó mở app / Thì app từ chối (mặc định chặn, VH-BR-20); vai trò lạ bị bỏ qua và ghi log.

**VH-US-202 — Tiêu chí nghiệm thu**
- Cho trước app có token máy hợp lệ / Khi gọi VH-API-02 lọc theo một đơn vị có cây con / Thì nhận danh sách nhân viên phân trang của đơn vị đó và các đơn vị con.
- Cho trước gọi VH-API-03 cho một nhân viên / Khi có kết quả / Thì nhận chuỗi quản lý từ quản lý trực tiếp tới người đứng đầu tập đoàn.
- Cho trước gọi không kèm token / Khi gửi yêu cầu / Thì nhận mã 401.

**VH-US-203 — Tiêu chí nghiệm thu**
- Cho trước tôi bấm "Tạo token máy" cho VClinks / Khi token hiện / Thì có nút "Sao chép" và dòng "Lưu token này ngay. Bạn sẽ không xem lại được."; đóng hộp thoại thì không xem lại được.
- Cho trước token đã thu hồi / Khi app gọi API bằng token đó / Thì nhận 401 trong ≤ 1 phút sau khi thu hồi.

**VH-US-204 — Tiêu chí nghiệm thu**
- Cho trước một người nghỉ việc có hiệu lực / Khi VC Home gửi `vh.person.left` / Thì app nhận trong ≤ 1 phút và kiểm được chữ ký.
- Cho trước app trả lỗi 500 / Khi VC Home gửi sự kiện / Thì sự kiện được gửi lại theo nhịp giãn dần và hiện ở mục "sự kiện gửi lỗi 24 giờ qua" trên VH-MH-15.
- Cho trước sự kiện `vh.grant.added` cho một vai trò VCwiki / Khi gửi / Thì chỉ VCwiki nhận, VClinks không nhận.

**VH-US-205 — Tiêu chí nghiệm thu**
- Cho trước app ngừng nhận sự kiện 2 giờ / Khi gọi VH-API-07 với mốc cuối đã nhận / Thì nhận đủ sự kiện trong 2 giờ đó, đúng thứ tự.
- Cho trước app gọi lại với cùng mốc / Khi xử lý / Thì nhận lại đúng các sự kiện đó, mỗi sự kiện có mã riêng để app bỏ qua bản trùng.

**VH-US-206 — Tiêu chí nghiệm thu**
- Cho trước người dùng đăng xuất ở VC Home / Khi VC ID gửi `logout_token` tới `POST /api/auth/backchannel-logout` của app / Thì app thu hồi phiên theo `sid` và trả 200.
- Cho trước `logout_token` bị gửi lại với cùng `jti` / Khi app nhận / Thì app trả 400 và không làm gì thêm.

**VH-US-207 — Tiêu chí nghiệm thu**
- Cho trước giai đoạn A–E / Khi lập kế hoạch / Thì không làm SCIM; yêu cầu VH-INT-08 giữ trạng thái W.
- Cho trước có app mua ngoài cần cấp tài khoản tự động / Khi chủ dự án quyết làm / Thì lập yêu cầu và câu chuyện mới, không dùng lại mã này.

## 14. VH-E-12 Quản trị, nhật ký, báo cáo

**Mục tiêu:** mọi thay đổi có dấu vết không sửa được; lãnh đạo và kiểm soát có báo cáo; vai trò quản trị của chính VC Home có tách nhiệm; con số vận hành đặt trên màn; sự cố được báo sớm. **GĐ:** A–D. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-221 | Là kiểm soát, tôi muốn lọc và xuất nhật ký thao tác theo người, đối tượng, thời gian để trả lời kiểm toán | M | A, B | VH-ADM-01 | VH-MH-19, VH-MH-03, VH-MH-04 |
| VH-US-222 | Là Ban giám đốc, tôi muốn xem báo cáo tổng hợp số người, quyền theo app và kết quả rà soát để nắm tình hình mà không cần nhờ IT | S | C | VH-ADM-02 | VH-MH-17 (tab "Báo cáo tổng hợp") |
| VH-US-223 | Là quản trị hệ thống, tôi muốn gán vai trò quản trị của VC Home (HC-NS, quản trị hệ thống, kiểm soát, Ban giám đốc) như vai trò app và được chặn các cặp xung đột để tách nhiệm | M | B | VH-ADM-03 | VH-MH-15, VH-MH-17 |
| VH-US-224 | Là quản trị hệ thống, tôi muốn bật ngoại lệ tách nhiệm có thời hạn khi thiếu người để vẫn vận hành mà kiểm soát được biết | M | D | VH-ADM-03 | VH-MH-20 |
| VH-US-225 | Là nhóm vận hành, tôi muốn nhận cảnh báo khi VC ID lỗi, đăng nhập lỗi nhiều, gửi sự kiện lỗi hay đồng bộ Google không chạy để xử lý trước khi người dùng phải báo | S | A | VH-ADM-04 | VH-MH-20 |
| VH-US-226 | Là quản trị hệ thống, tôi muốn đặt thời hạn yêu cầu, lịch nhắc, lịch rà soát trên màn Cài đặt để đổi con số mà không cần sửa code | S | D | VH-ADM-05 | VH-MH-20 |

**VH-US-221 — Tiêu chí nghiệm thu**
- Cho trước tôi lọc 30 ngày gần nhất, loại đối tượng "Quyền" / Khi xem bảng / Thì mỗi dòng có người làm, thời điểm, giá trị trước, giá trị sau, lý do; không có nút sửa hay xoá.
- Cho trước tôi bấm "Xuất" / Khi tải xong / Thì nhật ký có thêm một dòng ghi lần xuất của tôi.
- Cho trước tôi là nhân viên thường / Khi mở "Hồ sơ của tôi" tab "Lịch sử thay đổi" / Thì chỉ thấy nhật ký về chính mình; không vào được `/quan-tri/nhat-ky`.
- Cho trước tôi chọn ngày bắt đầu cách hôm nay hơn 24 tháng / Khi lọc / Thì báo "Nhật ký chỉ giữ 24 tháng."

**VH-US-222 — Tiêu chí nghiệm thu**
- Cho trước tôi có vai trò `vchome:bgd` / Khi bấm menu "Báo cáo" / Thì thấy thẻ số và bảng tổng hợp, chỉ xem; không có tab "Theo người", "Theo app".
- Cho trước tôi là trưởng đơn vị / Khi xem báo cáo / Thì số liệu chỉ tính trong đơn vị mình và đơn vị con.

**VH-US-223 — Tiêu chí nghiệm thu**
- Cho trước VC Home có trong danh mục app với các vai trò `hcns`, `qtht`, `kiem_soat`, `bgd` / Khi một người được cấp `vchome:hcns` / Thì menu có nhóm "QUẢN TRỊ" với Nhân sự, Cơ cấu tổ chức, Danh mục, Nhập dữ liệu.
- Cho trước một người đã có `vchome:hcns` / Khi cấp thêm `vchome:qtht` / Thì hệ thống chặn và báo xung đột tách nhiệm (02 mục 6).
- Cho trước HC-NS được giới hạn pháp nhân VCparts / Khi mở màn Nhân sự / Thì chỉ thấy người của VCparts và nhãn "Phạm vi: VCparts".

**VH-US-224 — Tiêu chí nghiệm thu**
- Cho trước một người buộc phải giữ cả HC-NS và quản trị hệ thống / Khi quản trị tạo ngoại lệ 60 ngày có lý do ≥ 10 ký tự / Thì người đó giữ được hai vai trò và kiểm soát nhận thông báo.
- Cho trước ngoại lệ dài hơn 90 ngày / Khi lưu / Thì báo "Ngoại lệ tối đa 90 ngày."
- Cho trước ngoại lệ hết hạn / Khi hệ thống chạy / Thì vai trò được cấp theo ngoại lệ bị gỡ và nhật ký ghi lại.

**VH-US-225 — Tiêu chí nghiệm thu**
- Cho trước VC ID không trả lời 2 lần kiểm liên tiếp (kiểm mỗi phút) / Khi hệ thống giám sát chạy / Thì nhóm vận hành nhận cảnh báo trong ≤ 5 phút.
- Cho trước job đồng bộ Google không chạy quá 2 giờ / Khi kiểm / Thì có cảnh báo.
- Cho trước GĐ D, quản trị bấm "Gửi cảnh báo thử" / Khi gửi / Thì mọi người nhận đã khai trong tab "Thông báo" nhận được.

**VH-US-226 — Tiêu chí nghiệm thu**
- Cho trước tôi đổi thời hạn mặc định từ 90 thành 180 ngày / Khi lưu / Thì ngăn xin quyền mặc định chọn 180 và nhật ký ghi trước 90, sau 180.
- Cho trước tôi nhập thời hạn 400 ngày / Khi lưu / Thì báo "Thời hạn tối đa 365 ngày (VH-BR-09)."
- Cho trước tôi mở tab "Phiên" / Khi xem / Thì thấy 12 giờ và 7 ngày ở chế độ chỉ xem.

## 15. Độ phủ yêu cầu

Bảng dưới liệt kê **mọi** yêu cầu ở README mục 5 (78 mã) và các câu chuyện phủ yêu cầu đó. Bảng sinh từ cột "Yêu cầu" của các bảng câu chuyện ở mục 3–14; sửa câu chuyện thì sinh lại bảng.

| Mã yêu cầu | Tên | Ưu tiên | GĐ | Câu chuyện |
|---|---|---|---|---|
| VH-AUT-01 | Đăng nhập bằng tài khoản Google công ty qua VC ID | M | A | VH-US-001 |
| VH-AUT-02 | Chặn tài khoản ngoài hai domain công ty | M | A | VH-US-002 |
| VH-AUT-03 | Đăng nhập một lần giữa các app | M | A | VH-US-003 |
| VH-AUT-04 | Đăng xuất một nơi là đăng xuất mọi app | M | A | VH-US-004 |
| VH-AUT-05 | Thời hạn phiên: 12 giờ không dùng, tối đa 7 ngày | M | A | VH-US-003 |
| VH-AUT-06 | Khoá tài khoản khẩn cấp | M | A | VH-US-005 |
| VH-AUT-07 | Đồng bộ trạng thái tài khoản Google (bị khoá, bị xoá → khoá) | M | A | VH-US-006 |
| VH-AUT-08 | Gắn tài khoản đăng nhập với hồ sơ nhân sự | M | B | VH-US-007 |
| VH-AUT-09 | Đường đăng nhập khẩn cấp khi VC ID hoặc Google không dùng được | S | A | VH-US-008 |
| VH-AUT-10 | Xem và đăng xuất các phiên của chính mình | C | D | VH-US-009 |
| VH-HOM-01 | Lưới app theo quyền | M | A | VH-US-021 |
| VH-HOM-02 | Thẻ hồ sơ ngắn trên trang chủ | M | B | VH-US-022 |
| VH-HOM-03 | Hiện vai trò trên ô app | S | C | VH-US-023, VH-US-130 |
| VH-HOM-04 | Ô "Có thể xin quyền" | S | D | VH-US-024 |
| VH-HOM-05 | Thanh chuyển app trong từng app | S | A | VH-US-025 |
| VH-HOM-06 | Ô app "Sắp có" và ô liên kết ngoài | C | A | VH-US-026 |
| VH-HOM-07 | Số việc chờ trên ô app | C | E | VH-US-027 |
| VH-HOM-08 | Thông báo trong VC Home | S | D | VH-US-028 |
| VH-NSU-01 | Hồ sơ nhân sự | M | B | VH-US-041 |
| VH-NSU-02 | Vị trí công tác chính và kiêm nhiệm | M | B | VH-US-042 |
| VH-NSU-03 | Quản lý trực tiếp và cây quản lý | M | B | VH-US-043, VH-US-145 |
| VH-NSU-04 | Trạng thái làm việc có ngày hiệu lực | M | B | VH-US-044 |
| VH-NSU-05 | Lịch sử thay đổi hồ sơ | M | B | VH-US-045 |
| VH-NSU-06 | Hồ sơ của tôi và đề nghị sửa | M | B | VH-US-046, VH-US-047 |
| VH-NSU-07 | Danh bạ công ty | S | B | VH-US-048 |
| VH-NSU-08 | Che thông tin theo người xem | M | B | VH-US-049 |
| VH-ORG-01 | Cây đơn vị nhiều cấp | M | B | VH-US-061 |
| VH-ORG-02 | Danh mục chức danh | M | B | VH-US-062 |
| VH-ORG-03 | Danh mục chức năng | M | B | VH-US-062 |
| VH-ORG-04 | Trưởng đơn vị | M | B | VH-US-064 |
| VH-ORG-05 | Đổi cơ cấu có ngày hiệu lực (đổi tên, chuyển, gộp, ngừng) | S | C | VH-US-065, VH-US-066 |
| VH-ORG-06 | Sơ đồ tổ chức | S | B | VH-US-067 |
| VH-ORG-07 | Danh mục pháp nhân và nơi làm việc | S | B | VH-US-063 |
| VH-APP-01 | Danh mục app | M | A (tệp tĩnh), B (quản trị trên màn) | VH-US-101 |
| VH-APP-02 | Vai trò của từng app | M | C | VH-US-102 |
| VH-APP-03 | Chủ app | M | C | VH-US-103 |
| VH-APP-04 | Đưa app mới vào theo hợp đồng tích hợp | S | E | VH-US-106 |
| VH-APP-05 | Vai trò nhạy cảm | M | C | VH-US-104, VH-US-163 |
| VH-APP-06 | Thời gian chuyển tiếp khi chuyển vị trí, đặt riêng từng app | S | C | VH-US-105, VH-US-143 |
| VH-ACC-01 | Luật cấp quyền mặc định theo hồ sơ | M | C | VH-US-121, VH-US-123 |
| VH-ACC-02 | Tính lại quyền khi hồ sơ, cơ cấu hoặc luật đổi | M | C | VH-US-124 |
| VH-ACC-03 | Xem trước tác động của luật | M | C | VH-US-122, VH-US-123 |
| VH-ACC-04 | Cấp quyền khẩn cấp có lý do và hạn tối đa 7 ngày | S | C | VH-US-125 |
| VH-ACC-05 | Quyền có hạn dùng, tự gỡ khi hết hạn | M | D | VH-US-126 |
| VH-ACC-06 | Gỡ quyền | M | C | VH-US-127 |
| VH-ACC-07 | Đẩy quyền sang VC ID (nhóm, vai trò app) | M | C | VH-US-128 |
| VH-ACC-08 | Tra cứu "ai có quyền gì", "người này có quyền gì" | M | C | VH-US-129, VH-US-130 |
| VH-REQ-01 | Gửi yêu cầu quyền | M | D | VH-US-161 |
| VH-REQ-02 | Luồng duyệt: quản lý trực tiếp, thêm chủ app nếu vai trò nhạy cảm | M | D | VH-US-162, VH-US-163, VH-US-164, VH-US-165 |
| VH-REQ-03 | Uỷ quyền duyệt khi vắng | S | D | VH-US-166 |
| VH-REQ-04 | Nhắc duyệt và tự huỷ yêu cầu quá hạn | S | D | VH-US-167 |
| VH-REQ-05 | Quản lý xin quyền thay cho người dưới quyền | C | D | VH-US-168 |
| VH-REQ-06 | Gia hạn quyền sắp hết hạn | S | D | VH-US-169 |
| VH-REV-01 | Mở đợt rà soát định kỳ | S | D | VH-US-181, VH-US-185 |
| VH-REV-02 | Trưởng đơn vị xác nhận hoặc gỡ | S | D | VH-US-182, VH-US-183 |
| VH-REV-03 | Tự gỡ quyền không được xác nhận và báo cáo kết quả | S | D | VH-US-184, VH-US-185 |
| VH-LCM-01 | Vào làm | M | C | VH-US-141 |
| VH-LCM-02 | Chuyển vị trí | M | C | VH-US-142, VH-US-143 |
| VH-LCM-03 | Nghỉ việc theo ngày hiệu lực | M | C | VH-US-144, VH-US-145 |
| VH-LCM-04 | Nghỉ dài ngày và quay lại | S | D | VH-US-146 |
| VH-LCM-05 | Quay lại làm sau khi đã nghỉ | C | D | VH-US-147 |
| VH-INT-01 | Bộ claim chuẩn trong token theo giai đoạn | M | A, B, C | VH-US-201 |
| VH-INT-02 | API danh bạ và cơ cấu cho app | M | B | VH-US-202 |
| VH-INT-03 | Sự kiện thay đổi gửi app (có chữ ký, gửi lại) | M | C | VH-US-204 |
| VH-INT-04 | Đăng xuất phía máy chủ (back-channel) | M | A | VH-US-206 |
| VH-INT-05 | Kéo sự kiện dự phòng | S | C | VH-US-205 |
| VH-INT-06 | Token máy cho app gọi API VC Home | M | B | VH-US-203 |
| VH-INT-07 | API trạng thái app cho ô app | C | E | VH-US-027 |
| VH-INT-08 | Cấp tài khoản theo chuẩn SCIM cho app mua ngoài | W | — | VH-US-207 |
| VH-ADM-01 | Nhật ký thao tác | M | A trở đi | VH-US-221 |
| VH-ADM-02 | Báo cáo truy cập | S | C | VH-US-222 |
| VH-ADM-03 | Vai trò quản trị của chính VC Home | M | B | VH-US-223, VH-US-224 |
| VH-ADM-04 | Cảnh báo vận hành | S | A | VH-US-225 |
| VH-ADM-05 | Cài đặt hệ thống (thời hạn, nhắc, lịch rà soát) | S | D | VH-US-226 |
| VH-IMP-01 | Nhập nhân sự và cơ cấu từ Excel | M | B | VH-US-081, VH-US-082 |
| VH-IMP-02 | Đối chiếu với Google Workspace | M | B | VH-US-083 |
| VH-IMP-03 | Lấy dữ liệu khởi đầu từ cây tổ chức của VClinks và VCwiki | S | B | VH-US-084 |
| VH-IMP-04 | Đồng bộ tự động từ phần mềm nhân sự | C | E | VH-US-085 |

**Kết quả kiểm:**
- 78 / 78 yêu cầu có ít nhất một câu chuyện. **Không có yêu cầu nào thiếu câu chuyện.**
- 88 câu chuyện, mỗi câu chuyện có 2–4 tiêu chí nghiệm thu; không trùng mã; mọi mã nằm đúng dải của nhóm.
- Mọi mã yêu cầu dùng trong câu chuyện đều có trong README mục 5.
- Ghi chú: README mục 5 ghi "Tổng: 75 yêu cầu (M: 44 · S: 25 · C: 5 · W: 1)" nhưng bảng thực có 78 dòng (M 45 · S 25 · C 7 · W 1). Bảng trên theo 78 dòng thực. Xem [06](06-man-hinh.md) mục 9.

**Yêu cầu có nhiều câu chuyện** (vì có nhiều vai trò hoặc nhiều tình huống): .

## 16. Đề xuất bổ sung (chưa cấp mã)

Các câu chuyện dưới đây **chưa có mã yêu cầu** ở README mục 5 nên chưa cấp mã VH-US. Nếu người duyệt đồng ý, cấp mã yêu cầu trước rồi đưa câu chuyện vào dải của nhóm tương ứng.

| # | Nhóm gợi ý | Câu chuyện đề xuất | Căn cứ |
|---|---|---|---|
| 1 | VH-E-10 | Là quản trị hệ thống, tôi muốn mở đợt rà soát luật mỗi nửa năm để chủ app xác nhận luật còn đúng | VH-BR-16 nói "rà soát luật mỗi nửa năm" nhưng chưa có yêu cầu, màn |
| 2 | VH-E-12 | Là Ban giám đốc, tôi muốn có trang "Báo cáo" riêng ngoài nhóm Quản trị để xem nhanh trên điện thoại | Báo cáo tổng hợp đang ghép tạm vào VH-MH-17 (06 mục 9 điểm 2) |
| 3 | VH-E-07 | Là kiểm soát, tôi muốn xem danh sách luật và điều kiện (chỉ đọc) để kiểm vì sao một người có quyền | Ma trận 02 chưa cho kiểm soát xem luật |
| 4 | VH-E-10 | Là trưởng đơn vị, tôi muốn thấy lần dùng app gần nhất của từng quyền khi rà soát để quyết giữ hay gỡ chính xác | Cần app gửi dữ liệu lần dùng gần nhất |
| 5 | VH-E-02 | Là quản lý, tôi muốn nhận thông báo duyệt qua email để không bỏ lỡ khi ít mở VC Home | Giảm yêu cầu tự huỷ (VH-BR-13) |
| 6 | VH-E-03 | Là nhân viên, tôi muốn báo HC-NS khi thấy thông tin của đồng nghiệp trên danh bạ bị sai | Mở rộng VH-NSU-06 cho người khác đề nghị |
| 7 | VH-E-12 | Là quản trị hệ thống, tôi muốn nhận cảnh báo người không đăng nhập 90 ngày mà còn quyền để dọn tài khoản bỏ quên | Đã có chỉ số trong báo cáo VH-MH-17; chưa có cảnh báo chủ động |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 08/10/2026 10:31 | Claude Code (vai BA) | Tạo tài liệu: cách đọc, 12 nhóm câu chuyện có mục tiêu, giai đoạn, thước đo; 88 câu chuyện VH-US kèm tiêu chí "Cho trước / Khi / Thì"; bảng độ phủ 78/78 yêu cầu; 7 đề xuất chưa cấp mã | README bộ tài liệu 0.1 |
