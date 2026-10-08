# VC Home — Câu chuyện người dùng

Phiên bản 0.1 · 08/10/2026 · Trạng thái: Nháp (chờ duyệt)

## Tóm tắt

- **Tài liệu nói gì:** 12 nhóm câu chuyện VH-E-01…12 (mục tiêu, giai đoạn, thước đo thành công) và 88 câu chuyện người dùng VH-US. Mỗi câu chuyện có vai trò, mong muốn, lý do, ưu tiên, giai đoạn, mã yêu cầu, màn hình và 2–4 tiêu chí nghiệm thu dạng "Cho trước … / Khi … / Thì …".
- **Đánh số:** nhóm thứ n dùng dải (n−1)×20+1 … n×20. Ví dụ VH-E-01 dùng VH-US-001…020, VH-E-07 dùng VH-US-121…140. Số còn trống trong dải để dành cho câu chuyện thêm sau; không dùng lại số đã cấp.
- **Độ phủ:** cả 78 yêu cầu ở README mục 5 đều có ít nhất một câu chuyện (bảng mục 15). Không có yêu cầu nào thiếu câu chuyện.
- **Phân bố:** GĐ A 15 câu chuyện, B 25, C 24, D 20, E 4 (một câu chuyện có thể thuộc nhiều giai đoạn; con số tính theo giai đoạn đầu). Ưu tiên M 52, S 30, C 5, W 1.
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

