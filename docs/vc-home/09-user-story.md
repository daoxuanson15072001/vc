# VC Home — Câu chuyện người dùng

Phiên bản 0.4 · 08/10/2026 · Trạng thái: Đã chốt nội dung (chờ đội phát triển rà)

## Tóm tắt

- **Tài liệu nói gì:** 12 nhóm câu chuyện VH-E-01…12 (mục tiêu, giai đoạn, thước đo thành công) và 100 câu chuyện người dùng VH-US. Mỗi câu chuyện có vai trò, mong muốn, lý do, ưu tiên, giai đoạn, mã yêu cầu, màn hình và 2–4 tiêu chí nghiệm thu dạng "Cho trước … / Khi … / Thì …".
- **Đánh số:** nhóm thứ n dùng dải (n−1)×20+1 … n×20. Ví dụ VH-E-01 dùng VH-US-001…020, VH-E-07 dùng VH-US-121…140. Số còn trống trong dải để dành cho câu chuyện thêm sau; không dùng lại số đã cấp.
- **Độ phủ:** cả 90 yêu cầu ở README mục 5 đều có ít nhất một câu chuyện (bảng mục 15). Không có yêu cầu nào thiếu câu chuyện.
- **Phân bố:** theo giai đoạn đầu tiên của câu chuyện: A 15, B 26, C 27, D 28, E 3, không giai đoạn 1 (VH-US-207, loại W). Theo ưu tiên: M 52, S 40, C 7, W 1.
- **Câu chữ trong tiêu chí** (thông báo, nhãn nút, giới hạn) lấy đúng từ [04-yeu-cau-chuc-nang.md](04-yeu-cau-chuc-nang.md) và [06-man-hinh.md](06-man-hinh.md); kiểm thử đối chiếu từng chữ. Chỗ 04 tự lệch nhau thì theo cách 06 mục 9 đã chọn.
- **Vai trò "Đội app"** dùng cho câu chuyện tích hợp (VH-E-11): đội phát triển VClinks, VCwiki và app sau; không phải vai trò trong VC Home.
- **Người duyệt xem kỹ:**
  - VH-E-07 và VH-E-09: luật, ngưỡng 20 người, chặn tự duyệt (VH-BR-12, 17, 25);
  - VH-E-08: thứ tự việc khi nghỉ việc (VH-US-144);
  - thước đo thành công của từng nhóm ở mục 2 (cần chủ dự án đồng ý con số);
  - mục 16: các đề xuất cũ đã xử lý hết ngày 08/10/2026; 12 câu chuyện mới (VH-US-029, 050, 068, 069, 086, 107, 131, 170, 186, 208, 209, 227) ứng với 12 yêu cầu nhận thêm ở 04 mục 14.

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
| VH-E-01 | Đăng nhập một lần và đăng xuất chung | A | Một tài khoản Google công ty vào mọi app; đăng xuất một nơi là ra hết; khoá được ngay | 23/23 ca UAT-SSO đạt; khoá trên VC ID mất quyền ≤ 1 phút, khoá trên Google ≤ 65 phút; 0 tài khoản ngoài hai domain đăng nhập được | 001–020 | 9 |
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
| VH-US-005 | Là quản trị hệ thống, tôi muốn khoá ngay một tài khoản nghi bị lộ để chặn truy cập ở mọi app trong vòng 1 phút | M | A | VH-AUT-06 | VH-MH-11 (ngăn Tài khoản, từ GĐ B), VH-MH-17 (từ GĐ C); GĐ A dùng lệnh `vc-provisioner` |
| VH-US-006 | Là quản trị hệ thống, tôi muốn tài khoản bị khoá hoặc xoá trên Google tự bị khoá trên VC ID để người nghỉ việc không bị sót | M | A | VH-AUT-07 | VH-MH-14 (từ GĐ B), VH-MH-19 |
| VH-US-007 | Là nhân viên, tôi muốn lần đăng nhập đầu tự gắn với hồ sơ nhân sự của mình để VC Home biết tôi là ai | M | B | VH-AUT-08 | VH-MH-02, VH-MH-11 |
| VH-US-008 | Là quản trị hệ thống, tôi muốn có đường đăng nhập khẩn cấp khi VC ID hoặc Google hỏng để vẫn xử lý được việc gấp | S | A | VH-AUT-09 | VH-MH-01; trang đăng nhập của từng app |
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
- Cho trước tôi để máy không dùng 12 giờ / Khi thao tác lại ở VC Home / Thì thấy "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."; bấm "Đăng nhập lại" thì về đúng trang đang xem.
- Cho trước tôi dùng liên tục / Khi tròn 7 ngày kể từ lần đăng nhập Google / Thì phải đăng nhập lại.

**VH-US-004 — Tiêu chí nghiệm thu**
- Cho trước tôi đang mở VC Home, VClinks, VCwiki / Khi bấm "Đăng xuất" ở VClinks và xác nhận "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?" / Thì trong ≤ 10 giây VCwiki và VC Home cũng mất phiên, trình duyệt về `/da-dang-xuat` với tiêu đề "Bạn đã đăng xuất khỏi mọi ứng dụng".
- Cho trước tôi đăng xuất từ VC Home / Khi bấm "Đăng xuất" / Thì không có trang xác nhận và mọi app mất phiên.

**VH-US-005 — Tiêu chí nghiệm thu**
- Cho trước GĐ A, một người đang mở 3 app / Khi quản trị chạy `vc-provisioner disable <email> --reason "…"` / Thì người đó mất phiên ở mọi app trong ≤ 1 phút.
- Cho trước từ GĐ B / Khi quản trị mở ngăn "Tài khoản" ở VH-MH-11, chọn lý do, nhập mô tả rồi bấm "Khoá ngay" / Thì như trên, và người đó đăng nhập lại thấy "Tài khoản đã bị khoá. Liên hệ quản trị viên."
- Cho trước quản trị nhập mô tả dưới 10 ký tự hoặc chọn chính mình / Khi bấm khoá / Thì báo "Nhập lý do khoá (ít nhất 10 ký tự)." hoặc "Không tự khoá tài khoản của chính bạn. Nhờ một quản trị hệ thống khác." và không khoá.
- Cho trước tài khoản còn cờ khoá `google` / Khi quản trị bấm "Mở khoá" / Thì chỉ gỡ cờ khẩn cấp và báo "Đã gỡ khoá khẩn cấp. Tài khoản vẫn bị khoá vì: {lý do còn lại}."

**VH-US-006 — Tiêu chí nghiệm thu**
- Cho trước admin Google khoá một tài khoản / Khi job đồng bộ (mỗi 15 phút) chạy / Thì trong ≤ 20 phút tài khoản bị khoá trên VC ID, mất phiên ở mọi app, nhóm quản trị nhận "[VC ID] Đã khoá {email}: tài khoản Google bị khoá lúc {hh:mm dd/mm}."
- Cho trước Google trả số tài khoản ít hơn 50% lần trước / Khi job chạy / Thì job dừng, không khoá ai, nhóm quản trị nhận "[VC ID] Dừng đồng bộ: Google trả về {n} tài khoản, ít hơn 50% lần trước ({m}). Không khoá ai."
- Cho trước tài khoản được mở lại trên Google / Khi job chạy / Thì VC ID không tự mở khoá, chỉ báo quản trị.

**VH-US-007 — Tiêu chí nghiệm thu**
- Cho trước HC-NS đã tạo hồ sơ với email của tôi / Khi tôi đăng nhập lần đầu / Thì tài khoản gắn với hồ sơ, trang chủ hiện thẻ hồ sơ đúng tên, chức danh, đơn vị.
- Cho trước email của tôi chưa có hồ sơ / Khi đăng nhập / Thì trang chủ không có ô app và hiện "Tài khoản chưa có hồ sơ nhân sự, liên hệ HC-NS".
- Cho trước HC-NS đã đổi email của tôi trên hồ sơ trước khi đổi trên Google / Khi tôi đăng nhập bằng email mới / Thì vẫn đúng hồ sơ cũ (tìm theo `sub`), không sinh người mới (VH-BR-01).
- Cho trước HC-NS mở ngăn "Tài khoản" / Khi tìm nút gắn lại / Thì không có; chỉ quản trị hệ thống gắn lại được, có lý do và nhật ký.

**VH-US-008 — Tiêu chí nghiệm thu**
- Cho trước VC ID không trả lời / Khi người dùng mở trang đăng nhập của app / Thì thấy câu `idp_unreachable`; phiên đang có ở app vẫn dùng tiếp.
- Cho trước VC ID hỏng và quản trị bật cờ khẩn cấp ở app (VClinks `AUTH_TOKEN_LOGIN`, VCwiki `AUTH_PASSWORD_LOGIN=admin`) / Khi một người không phải admin nhập đúng mật khẩu ở VCwiki / Thì bị từ chối với câu "Đăng nhập bằng mật khẩu chỉ dành cho quản trị khi khẩn cấp. Hãy dùng nút Đăng nhập bằng tài khoản công ty."
- Cho trước VC ID hoạt động lại / Khi quản trị kết thúc sự cố / Thì mọi đường khẩn cấp tắt trong ≤ 1 giờ; ai bật, lúc nào, ai đã dùng đều có trong sổ sự cố.

**VH-US-009 — Tiêu chí nghiệm thu**
- Cho trước tôi đăng nhập trên máy tính và điện thoại / Khi mở ngăn "Phiên đăng nhập" ở "Hồ sơ của tôi" / Thì thấy 2 dòng có trình duyệt, IP rút gọn, lần dùng cuối; dòng hiện tại có nhãn "Phiên này".
- Cho trước có một phiên lạ / Khi bấm "Đăng xuất" trên dòng đó và xác nhận "Đăng xuất phiên này? Các app đang mở trên thiết bị đó sẽ phải đăng nhập lại." / Thì phiên đó mất ở mọi app, phiên hiện tại vẫn dùng được.

## 4. VH-E-02 Trang chủ và chuyển app

**Mục tiêu:** trang chủ là chỗ bắt đầu ngày làm việc: biết mình là ai, mở app được cấp, thấy app có thể xin; trong mỗi app chuyển sang app khác bằng một lần bấm. **GĐ:** A, B (phần sau ở C, D, E). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-021 | Là nhân viên, tôi muốn trang chủ chỉ hiện app tôi được dùng và ghim được app hay dùng lên đầu để mở việc nhanh | M | A | VH-HOM-01 | VH-MH-02 |
| VH-US-022 | Là nhân viên, tôi muốn thấy thẻ hồ sơ ngắn trên trang chủ để biết VC Home ghi tôi là ai và báo sai kịp | M | B | VH-HOM-02 | VH-MH-02 |
| VH-US-023 | Là nhân viên, tôi muốn thấy vai trò của mình trên từng ô app và hạn chuyển tiếp khi đổi vị trí để biết mình vào app với tư cách gì | S | C | VH-HOM-03 | VH-MH-02, VH-MH-04 |
| VH-US-024 | Là nhân viên, tôi muốn thấy các app tôi có thể xin quyền để tự xin mà không phải hỏi IT | S | D | VH-HOM-04 | VH-MH-02, VH-MH-05 |
| VH-US-025 | Là nhân viên, tôi muốn có nút 9 chấm trong VClinks và VCwiki để chuyển app mà không phải quay về VC Home | S | A | VH-HOM-05 | VH-MH-21 |
| VH-US-026 | Là nhân viên, tôi muốn thấy app "Sắp có" và các liên kết hay dùng (Gmail, Drive, MISA) trên trang chủ để có một chỗ bắt đầu duy nhất | C | A | VH-HOM-06 | VH-MH-02, VH-MH-15 |
| VH-US-027 | Là nhân viên, tôi muốn thấy số việc đang chờ trên ô app để biết app nào cần mở trước | C | E | VH-HOM-07, VH-INT-07 | VH-MH-02 |
| VH-US-028 | Là nhân viên, tôi muốn nhận thông báo khi có việc chờ tôi duyệt, quyền sắp hết hạn hay có kết quả yêu cầu để không bỏ lỡ việc | S | D | VH-HOM-08 | Header (ngăn kéo thông báo), VH-MH-04, VH-MH-08 |
| VH-US-029 | Là người duyệt, tôi muốn thấy dải "Việc đang chờ bạn" trên trang chủ để xử lý ngay khi mở VC Home | C | D | VH-HOM-09 | VH-MH-02 |

**VH-US-021 — Tiêu chí nghiệm thu**
- Cho trước tôi có quyền VClinks, không có quyền VCwiki / Khi mở trang chủ / Thì thấy ô VClinks, không thấy ô VCwiki; không có ô của chính VC Home.
- Cho trước tôi chọn "Ghim lên đầu" ở menu "⋯" của ô VCwiki / Khi tải lại trang / Thì VCwiki đứng đầu lưới.
- Cho trước màn hình điện thoại rộng 390 px / Khi mở trang chủ / Thì lưới 1 cột, vùng bấm mỗi ô ≥ 44 × 44 px, không có thanh cuộn ngang.

**VH-US-022 — Tiêu chí nghiệm thu**
- Cho trước hồ sơ của tôi đã có vị trí chính / Khi mở trang chủ / Thì thẻ hiện ảnh, tên gọi và họ tên, chức danh · đơn vị, mã nhân viên, email, pháp nhân, quản lý trực tiếp đúng với VC People.
- Cho trước tôi có một vị trí kiêm nhiệm / Khi xem thẻ / Thì có nhãn "+1 kiêm nhiệm"; bấm thì hiện "chức danh · đơn vị" của vị trí đó.
- Cho trước VC Home API lỗi / Khi mở trang chủ / Thì thẻ hiện bản rút gọn từ token kèm "Chưa tải được hồ sơ." và nút "Thử lại"; lưới app vẫn dùng được.

**VH-US-023 — Tiêu chí nghiệm thu**
- Cho trước tôi có vai trò `nvkd` tại Tổ bán hàng 1 trong VClinks / Khi xem ô VClinks / Thì dưới tên app có dòng "NVKD · Tổ BH 1".
- Cho trước tôi vừa chuyển từ NVKD sang CSKH, VClinks đặt chuyển tiếp 3 ngày / Khi xem ô / Thì ô có cả hai vai trò và nhãn cam "Còn 3 ngày".
- Cho trước hết 3 ngày / Khi tải lại trang / Thì chỉ còn vai trò CSKH, nhãn "Còn 3 ngày" biến mất.

**VH-US-024 — Tiêu chí nghiệm thu**
- Cho trước VCgarage đang chạy, có vai trò đang dùng, và tôi chưa có quyền nào ở VCgarage / Khi mở trang chủ / Thì VCgarage nằm trong phần "Có thể xin quyền" với nút "Xin quyền".
- Cho trước tôi bấm "Xin quyền" trên ô VCgarage / Khi ngăn kéo mở / Thì ô "Ứng dụng" đã chọn sẵn VCgarage.
- Cho trước tôi đã có yêu cầu đang chờ cho VCinvoice / Khi xem phần này / Thì ô VCinvoice có nhãn "Đang chờ duyệt" và liên kết xem yêu cầu, không mở form mới.

**VH-US-025 — Tiêu chí nghiệm thu**
- Cho trước tôi đang ở VClinks / Khi bấm nút 9 chấm / Thì thấy "VC Home" ở đầu, rồi các app tôi có quyền cùng thứ tự với trang chủ; VClinks có dấu chọn.
- Cho trước tôi bấm VCwiki trong danh sách / Khi trang chuyển / Thì vào thẳng VCwiki, không hỏi đăng nhập.
- Cho trước VC Home không trả `catalog.json` và app chưa có bản đệm / Khi bấm nút 9 chấm / Thì danh sách chỉ có "VC Home", không có câu báo lỗi cho người dùng.

**VH-US-026 — Tiêu chí nghiệm thu**
- Cho trước VCsale có trạng thái "Sắp có" / Khi xem trang chủ / Thì ô VCsale nằm ở phần "Sắp có", mờ, bấm không mở gì.
- Cho trước quản trị đã khai liên kết ngoài Gmail / Khi tôi bấm ô Gmail / Thì Gmail mở ở tab mới.
- Cho trước quản trị khai liên kết thứ 13 / Khi lưu / Thì báo "Tối đa 12 liên kết ngoài. Bỏ bớt liên kết ít dùng trước."

**VH-US-027 — Tiêu chí nghiệm thu**
- Cho trước VClinks trả `{label: "Hội thoại chờ trả lời", count: 5}` qua API trạng thái (VH-API-09) / Khi mở trang chủ / Thì ô VClinks có số 5; rê chuột thấy nhãn; trên 99 hiện "99+".
- Cho trước một app không trả lời trong 2 giây / Khi mở trang chủ / Thì ô đó không có số, trang không báo lỗi và không chậm hơn.

**VH-US-028 — Tiêu chí nghiệm thu**
- Cho trước một người trong đội gửi yêu cầu quyền / Khi tôi mở VC Home / Thì chuông có số 1 và thông báo "{Họ tên} xin vai trò {vai trò} trong {app}. Hạn duyệt {dd/mm}."; bấm vào mở đúng yêu cầu ở hộp duyệt.
- Cho trước quyền của tôi còn 14 ngày / Khi tới ngày đó / Thì tôi nhận "Vai trò {vai trò} trong {app} hết hạn ngày {dd/mm}." kèm liên kết gia hạn.
- Cho trước GĐ C (chưa có chuông) / Khi có việc cần báo / Thì thông báo gửi qua email Gmail công ty.

**VH-US-029 — Tiêu chí nghiệm thu**
- Cho trước có 2 yêu cầu chờ tôi duyệt / Khi mở trang chủ / Thì thấy dải "Bạn có 2 yêu cầu chờ duyệt."; bấm thì mở VH-MH-08 đã lọc sẵn.
- Cho trước tôi không có việc chờ / Khi mở trang chủ / Thì không có dải.
- Cho trước VC Home API lỗi / Khi mở trang chủ / Thì dải ẩn, lưới app vẫn hiện trong ≤ 1,5 giây.

## 5. VH-E-03 Hồ sơ nhân sự và danh bạ

**Mục tiêu:** VC People là nguồn sự thật về hồ sơ công việc; mỗi người đang làm có đúng 1 vị trí chính và 1 quản lý trực tiếp; mọi thay đổi có ngày hiệu lực và lịch sử; ai cũng tìm được đồng nghiệp mà thông tin không lộ quá mức. **GĐ:** B. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-041 | Là HC-NS, tôi muốn tạo và sửa hồ sơ nhân sự trên VC Home để mọi app đọc chung một nguồn | M | B | VH-NSU-01 | VH-MH-11 |
| VH-US-042 | Là HC-NS, tôi muốn ghi vị trí chính và các vị trí kiêm nhiệm có từ ngày, đến ngày để quyền và phạm vi trong app tính đúng | M | B | VH-NSU-02 | VH-MH-11 |
| VH-US-043 | Là HC-NS, tôi muốn ghi quản lý trực tiếp và được chặn vòng quản lý để luồng duyệt luôn đến đúng người | M | B | VH-NSU-03 | VH-MH-11, VH-MH-07 |
| VH-US-044 | Là HC-NS, tôi muốn đổi trạng thái làm việc bằng thao tác riêng có ngày hiệu lực, hẹn trước được, để làm theo quyết định đã ký | M | B | VH-NSU-04 | VH-MH-11 |
| VH-US-045 | Là HC-NS, tôi muốn xem lịch sử mọi thay đổi của một hồ sơ để trả lời "ai đổi gì, khi nào, vì sao" | M | B | VH-NSU-05 | VH-MH-11, VH-MH-03 |
| VH-US-046 | Là nhân viên, tôi muốn xem hồ sơ công việc của mình và gửi đề nghị sửa khi sai để dữ liệu đúng mà không phải nhắn riêng HC-NS | M | B | VH-NSU-06 | VH-MH-03 |
| VH-US-047 | Là HC-NS, tôi muốn nhận và xử lý đề nghị sửa hồ sơ ngay trên VC Home để giữ dấu vết và báo kết quả cho người đề nghị | M | B | VH-NSU-06 | VH-MH-11 |
| VH-US-048 | Là nhân viên, tôi muốn tìm đồng nghiệp theo tên, email, SĐT, đơn vị để liên hệ đúng người | S | B | VH-NSU-07 | VH-MH-06 |
| VH-US-049 | Là quản lý, tôi muốn xem hồ sơ công việc đầy đủ của người trong đội, còn đồng nghiệp chỉ thấy thông tin danh bạ, để thông tin không lộ quá mức | M | B | VH-NSU-08 | VH-MH-06, VH-MH-09 |
| VH-US-050 | Là nhân viên, tôi muốn tự sửa tên gọi, ảnh và SĐT công việc mà không chờ HC-NS để thông tin của mình luôn đúng | S | B | VH-NSU-09 | VH-MH-03 |

**VH-US-041 — Tiêu chí nghiệm thu**
- Cho trước tôi là HC-NS của VCparts / Khi thêm nhân viên với mã, họ tên, email công ty và vị trí chính / Thì hồ sơ được tạo và toast "Đã tạo hồ sơ {mã}."
- Cho trước mã nhân viên đã dùng cho một người đã nghỉ / Khi tôi nhập lại mã đó / Thì báo "Mã nhân viên {mã} đã dùng cho {họ tên} ({trạng thái}). Mã không được dùng lại."
- Cho trước email ngoài hai domain công ty / Khi lưu / Thì báo "Email phải có đuôi @vcprosperous.com hoặc @vcpart.vn."
- Cho trước tôi chỉ có phạm vi VCparts / Khi mở hồ sơ của người VCe qua đường dẫn / Thì không sửa được và thấy "Bạn chỉ sửa được hồ sơ thuộc VCparts."

**VH-US-042 — Tiêu chí nghiệm thu**
- Cho trước chị Hoa là NVKD VCparts / Khi thêm kiêm nhiệm CSKH VCservice từ 01/09/2026 đến 31/12/2026 / Thì hồ sơ có 1 vị trí chính và 1 kiêm nhiệm.
- Cho trước chuyển vị trí chính có hiệu lực 01/11/2026 / Khi lưu / Thì vị trí cũ đóng ngày 31/10/2026, vị trí mới hiện nhãn "Hẹn 01/11/2026"; vị trí cũ vẫn xem được trong lịch sử.
- Cho trước vị trí chính mới chồng ngày với vị trí đang có / Khi lưu / Thì báo "Nhân viên đang làm phải có đúng 1 vị trí chính. Vị trí chính mới chồng ngày với vị trí tại {đơn vị} từ {dd/mm/yyyy}."

**VH-US-043 — Tiêu chí nghiệm thu**
- Cho trước Bình là cấp trên của Lan / Khi đặt Lan làm quản lý của Bình / Thì báo "Không đặt được: Trần Văn Bình đang là cấp trên của Nguyễn Thị Lan. Đặt thế này sẽ tạo vòng."
- Cho trước tôi chọn chính người đó làm quản lý / Khi lưu / Thì báo "Không chọn chính mình làm quản lý trực tiếp."
- Cho trước chị Hoa có quản lý khác nhau ở vị trí chính và vị trí kiêm nhiệm / Khi mở sơ đồ chế độ "Theo quản lý" / Thì chị chỉ nằm dưới quản lý của vị trí chính (VH-BR-05).

**VH-US-044 — Tiêu chí nghiệm thu**
- Cho trước quyết định ký ngày 20/10 điều chuyển từ 01/11 / Khi tôi lưu với ngày hiệu lực 01/11/2026 / Thì toast "Đã hẹn áp lúc 00:00 ngày 01/11/2026." và hồ sơ có thẻ "Có 1 thay đổi đã hẹn".
- Cho trước tới 00:00 ngày 01/11/2026 giờ Việt Nam / Khi job áp thay đổi chạy / Thì thay đổi có hiệu lực trước 00:05; thẻ hồ sơ và token lần sau đổi theo.
- Cho trước tôi chọn "Tạm khoá" với lý do "Đình chỉ công tác" / Khi lưu với ngày hiệu lực hôm nay / Thì người đó bị đăng xuất mọi app trong ≤ 1 phút, quyền giữ nguyên để mở lại nguyên trạng.
- Cho trước đã có thay đổi hẹn mâu thuẫn / Khi lưu thay đổi mới / Thì hỏi "Đã có thay đổi hẹn ngày {dd/mm/yyyy}: {mô tả}. Thay đổi mới mâu thuẫn với thay đổi này. Huỷ thay đổi cũ và lưu thay đổi mới?"

**VH-US-045 — Tiêu chí nghiệm thu**
- Cho trước hồ sơ đã đổi đơn vị 2 lần / Khi mở ngăn "Lịch sử" ở VH-MH-11 / Thì thấy 2 dòng có ngày hiệu lực, giá trị trước, giá trị sau, người làm, nguồn, lý do.
- Cho trước tôi chọn "Hồ sơ tại ngày…" là một ngày trước lần đổi thứ nhất / Khi xem / Thì hồ sơ và vị trí hiện đúng như ngày đó.
- Cho trước tôi là nhân viên / Khi mở "Hồ sơ của tôi" ngăn "Lịch sử" / Thì thấy đúng lịch sử hồ sơ của chính mình.

**VH-US-046 — Tiêu chí nghiệm thu**
- Cho trước SĐT công việc của tôi ghi sai / Khi bấm "Đề nghị sửa" cạnh trường đó, nhập giá trị đúng và lý do / Thì toast "Đã gửi đề nghị tới HC-NS." và ngăn "Đề nghị của tôi" có dòng "Chờ HC-NS".
- Cho trước tôi đã có đề nghị đang chờ cho cùng trường / Khi gửi đề nghị thứ hai / Thì báo "Bạn đã có đề nghị đang chờ cho trường này (gửi {dd/mm/yyyy}). Huỷ đề nghị cũ nếu muốn gửi lại."
- Cho trước tôi nhập giá trị giống giá trị hiện tại / Khi gửi / Thì báo "Giá trị đề nghị giống giá trị hiện tại."
- Cho trước đơn vị của tôi sai / Khi xem phần vị trí / Thì chỉ có nút "Báo thông tin sai", không có ô sửa.

**VH-US-047 — Tiêu chí nghiệm thu**
- Cho trước có đề nghị sửa SĐT của Lan / Khi tôi bấm "Áp dụng", chọn ngày hiệu lực / Thì hồ sơ đổi, lịch sử ghi nguồn "Đề nghị sửa #{n}", Lan nhận "HC-NS đã áp dụng đề nghị sửa SĐT công việc."
- Cho trước tôi bấm "Từ chối" mà không nhập lý do / Khi xác nhận / Thì không cho từ chối; có lý do thì Lan nhận "HC-NS đã từ chối đề nghị sửa {trường}: {lý do}."
- Cho trước đề nghị do chính tôi (HC-NS) gửi / Khi tôi mở / Thì thấy "Bạn không xử lý được đề nghị của chính mình."

**VH-US-048 — Tiêu chí nghiệm thu**
- Cho trước tôi gõ "lan nguyen" (không dấu) vào ô tìm ở header / Khi ngừng gõ 300 ms / Thì danh sách gợi ý có "Nguyễn Thị Lan".
- Cho trước tôi lọc đơn vị "Phòng Kinh doanh" có tích "Gồm đơn vị con" / Khi xem danh bạ / Thì thấy cả người ở Tổ bán hàng 1 và Tổ bán hàng 2.
- Cho trước chị Hà đang nghỉ dài ngày / Khi tìm tên chị / Thì thẻ có nhãn "Tạm vắng", không ghi lý do, không ghi ngày; người đã nghỉ việc thì không có trong danh bạ.
- Cho trước tìm không ra / Khi xem kết quả / Thì thấy "Không tìm thấy ai khớp '{từ khoá}'. Thử bỏ bớt bộ lọc."

**VH-US-049 — Tiêu chí nghiệm thu**
- Cho trước tôi là nhân viên thường / Khi mở thẻ một đồng nghiệp / Thì chỉ thấy ảnh, họ tên, tên gọi, mã NV, chức danh · đơn vị · chức năng, pháp nhân, email, SĐT công việc; không thấy quản lý, ngày vào, loại nhân viên, nơi làm việc.
- Cho trước tôi là quản lý của người đó (trực tiếp hoặc cấp trên) / Khi mở thẻ / Thì thấy thêm khối "Thông tin công việc" và nhật ký ghi một dòng `person.view_c1`.
- Cho trước tôi mở thẻ của cấp trên mình / Khi xem / Thì chỉ thấy thông tin danh bạ (VH-BR-23).

**VH-US-050 — Tiêu chí nghiệm thu**
- Cho trước tôi ở "Hồ sơ của tôi" / Khi đổi ảnh JPG 1 MB và lưu / Thì trang chủ và danh bạ hiện ảnh mới trong ≤ 1 phút, lịch sử có dòng "Tự sửa ảnh".
- Cho trước tôi nhập SĐT công việc "12345" / Khi lưu / Thì báo "Số điện thoại công việc chưa đúng mẫu: 10 số bắt đầu bằng 0, hoặc số máy lẻ 3–5 số."
- Cho trước tôi muốn đổi chức danh / Khi xem hồ sơ / Thì chỉ có nút "Đề nghị sửa", không sửa trực tiếp được.

## 6. VH-E-04 Cơ cấu tổ chức

**Mục tiêu:** một cây tổ chức chung cho cả tập đoàn và mọi app; danh mục chức danh, chức năng, pháp nhân, nơi làm việc dùng chung; đổi cơ cấu có ngày hiệu lực, có xem trước và không mất lịch sử. **GĐ:** B (đổi cơ cấu có hẹn ngày, gộp ở C). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-061 | Là HC-NS, tôi muốn dựng cây đơn vị nhiều cấp (tập đoàn, pháp nhân, division, phòng, tổ) để mọi app dùng chung một cơ cấu | M | B | VH-ORG-01 | VH-MH-12 |
| VH-US-062 | Là HC-NS, tôi muốn giữ danh mục chức danh và chức năng để hồ sơ và luật cấp quyền dùng cùng một bộ giá trị | M | B | VH-ORG-02, VH-ORG-03 | VH-MH-13 |
| VH-US-063 | Là HC-NS phạm vi toàn tập đoàn, tôi muốn giữ danh mục pháp nhân và nơi làm việc để luật, báo cáo và phạm vi theo pháp nhân chạy đúng | S | B | VH-ORG-07 | VH-MH-13 |
| VH-US-064 | Là HC-NS, tôi muốn đặt một trưởng cho mỗi đơn vị để có người rà soát quyền và người duyệt thay khi thiếu quản lý | M | B | VH-ORG-04 | VH-MH-12 |
| VH-US-065 | Là HC-NS, tôi muốn đổi tên và chuyển đơn vị sang đơn vị cha khác có ngày hiệu lực, xem trước tác động, để làm theo quyết định tái cơ cấu | S | C | VH-ORG-05 | VH-MH-12 |
| VH-US-066 | Là HC-NS, tôi muốn gộp hoặc ngừng đơn vị mà không mất lịch sử để cơ cấu gọn mà báo cáo cũ vẫn đúng | S | C | VH-ORG-05 | VH-MH-12 |
| VH-US-067 | Là nhân viên, tôi muốn xem sơ đồ tổ chức theo đơn vị; là quản lý, tôi muốn xem thêm cây quản lý của đội, để hiểu ai phụ trách gì | S | B | VH-ORG-06 | VH-MH-07 |
| VH-US-068 | Là HC-NS, tôi muốn khai lịch ngày nghỉ của công ty để yêu cầu và rà soát không tự huỷ oan dịp Tết, lễ | S | D | VH-ORG-08 | VH-MH-13 |
| VH-US-069 | Là HC-NS, tôi muốn gộp các mục trùng trong danh mục chức danh, chức năng, nơi làm việc để luật và báo cáo không bị chia nhỏ | S | B | VH-ORG-09 | VH-MH-13 |

**VH-US-061 — Tiêu chí nghiệm thu**
- Cho trước đơn vị "Phòng Kinh doanh" / Khi bấm "+ Thêm đơn vị con" loại Tổ / Thì tổ mới hiện ngay dưới phòng trong cây.
- Cho trước Tổ bán hàng 1 / Khi thêm một Nhóm con, rồi thêm tiếp một Nhóm dưới Nhóm đó / Thì lần đầu được, lần sau báo "Tổ / Nhóm chỉ chứa được Tổ / Nhóm con một cấp." (02 VH-BR-06).
- Cho trước tôi kéo một nút trong cây / Khi thả ra / Thì cây không đổi và có gợi ý "Dùng nút Chuyển đơn vị để đổi đơn vị cha."
- Cho trước mã đơn vị đã dùng / Khi tạo đơn vị mới cùng mã / Thì báo "Mã {mã} đã dùng cho đơn vị {tên} ({trạng thái}). Mã không được dùng lại."

**VH-US-062 — Tiêu chí nghiệm thu**
- Cho trước chức năng "CSKH" đã có / Khi thêm chức năng trùng tên / Thì báo "Chức năng 'CSKH' đã có."
- Cho trước chức danh đang dùng trong 2 luật đang bật / Khi bấm "Ngừng" / Thì báo "Chức danh đang dùng trong 2 luật cấp quyền. Sửa hoặc tắt các luật đó trước."
- Cho trước chức danh đã từng được dùng / Khi bấm "Xoá" / Thì báo "Chức danh đã được dùng, không xoá được. Hãy chuyển sang Ngừng."

**VH-US-063 — Tiêu chí nghiệm thu**
- Cho trước tôi nhập mã số thuế 9 số / Khi lưu pháp nhân / Thì báo "Mã số thuế gồm 10 chữ số, hoặc 10 chữ số, gạch ngang và 3 chữ số."
- Cho trước tôi là HC-NS chỉ phạm vi VCparts / Khi sửa một pháp nhân / Thì báo "Chỉ HC-NS phạm vi toàn tập đoàn sửa được danh mục pháp nhân."
- Cho trước nơi làm việc "Kho Hà Nội" còn 8 nhân viên / Khi bấm "Ngừng" / Thì báo "Nơi làm việc còn 8 nhân viên. Chuyển trước khi ngừng."

**VH-US-064 — Tiêu chí nghiệm thu**
- Cho trước đơn vị đã có trưởng / Khi đặt trưởng mới với ngày hiệu lực 01/11 / Thì trưởng cũ thôi từ 31/10 và hệ thống hỏi "Cập nhật quản lý trực tiếp cho {n} người đang báo cáo trưởng cũ trong đơn vị này?"
- Cho trước người không có vị trí trong đơn vị hay đơn vị cha trực tiếp / Khi đặt làm trưởng / Thì báo "Người được chọn chưa có vị trí trong {đơn vị} hoặc đơn vị cha trực tiếp. Thêm vị trí (chính hoặc kiêm nhiệm) trước."
- Cho trước đặt trưởng thành công / Khi người đó đăng nhập / Thì menu có "Đội của tôi" (và "Rà soát quyền" từ GĐ D).

**VH-US-065 — Tiêu chí nghiệm thu**
- Cho trước Tổ bán hàng 3 thuộc Phòng KD 1 / Khi chọn "Đổi cơ cấu" → "Chuyển" sang Phòng KD 2, ngày 01/12/2026, mà chưa bấm "Xem trước" / Thì không lưu được, báo "Chưa xem trước tác động. Bấm 'Xem trước' trước khi lưu."
- Cho trước đã xem trước (số người bị chuyển, số quyền thêm và mất theo app) / Khi lưu / Thì thay đổi vào danh sách "Thay đổi cơ cấu đang hẹn"; tới 00:00 ngày 01/12/2026 thì app nhận `vh.org.unit_changed` và `vh.person.moved`.
- Cho trước tôi chọn đơn vị cha mới nằm dưới chính đơn vị đang chuyển / Khi lưu / Thì báo "Không chuyển được: {đơn vị đích} đang nằm dưới {đơn vị}. Chuyển thế này sẽ tạo vòng."

**VH-US-066 — Tiêu chí nghiệm thu**
- Cho trước Tổ A còn 5 vị trí và 1 đơn vị con / Khi bấm "Ngừng" / Thì báo "Đơn vị còn 5 vị trí đang hiệu lực và 1 đơn vị con đang hoạt động. Chuyển hết người và đơn vị con trước khi ngừng."
- Cho trước "Gộp" Tổ A vào Tổ B cùng loại, ngày 01/12/2026 / Khi tới ngày / Thì mọi vị trí ở Tổ A chuyển sang Tổ B, Tổ A thành "Ngừng", lịch sử vẫn ghi tên Tổ A.
- Cho trước gộp một Tổ vào một Phòng / Khi lưu / Thì báo "Chỉ gộp được hai đơn vị cùng loại."

**VH-US-067 — Tiêu chí nghiệm thu**
- Cho trước tôi là nhân viên / Khi mở sơ đồ tổ chức và bấm "Phòng CSKH" / Thì thấy trưởng đơn vị, số người và danh sách người (C0); không có nút "Theo quản lý".
- Cho trước tôi là quản lý / Khi chuyển sang "Theo quản lý" / Thì thấy cây quản lý dưới mình; tìm tên một người thì cây mở tới nút đó và tô sáng.
- Cho trước màn hình điện thoại dưới 600 px / Khi mở sơ đồ / Thì cây hiện dạng danh sách lồng nhau.

**VH-US-068 — Tiêu chí nghiệm thu**
- Cho trước lịch nghỉ Tết 05–13/02/2027 / Khi một yêu cầu gửi thứ Sáu 05/02 / Thì đồng hồ tự huỷ bắt đầu đếm từ Chủ nhật 14/02.
- Cho trước một ngày nghỉ chỉ áp cho pháp nhân A / Khi người thuộc pháp nhân B có yêu cầu chờ / Thì đồng hồ của người đó vẫn chạy ngày hôm đó.

**VH-US-069 — Tiêu chí nghiệm thu**
- Cho trước có "NV kinh doanh" và "Nhân viên kinh doanh" / Khi gộp mục thứ nhất vào mục thứ hai / Thì mọi vị trí trỏ tới mục thứ hai, mục cũ ở trạng thái "Đã gộp".
- Cho trước một luật dùng mục cũ / Khi gộp xong / Thì luật trỏ sang mục giữ và không ai bị đổi quyền.

## 7. VH-E-05 Nhập và đối chiếu dữ liệu ban đầu

**Mục tiêu:** đưa hồ sơ và cơ cấu ban đầu vào VC People an toàn (kiểm thử trước, ghi một lần), khớp với Google Workspace, tận dụng cây tổ chức đang có ở VClinks và VCwiki. **GĐ:** B (đồng bộ tự động ở E). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-081 | Là HC-NS, tôi muốn tải mẫu và kiểm thử tệp Excel để thấy dòng nào OK, cảnh báo, lỗi trước khi ghi | M | B | VH-IMP-01 | VH-MH-14 |
| VH-US-082 | Là HC-NS, tôi muốn ghi lô đã kiểm thử vào hệ thống với một ngày hiệu lực để dữ liệu vào đúng và chỉ một lần | M | B | VH-IMP-01 | VH-MH-14 |
| VH-US-083 | Là quản trị hệ thống, tôi muốn đối chiếu hồ sơ với Google Workspace để thấy ai có Google mà không có hồ sơ và ngược lại | M | B | VH-IMP-02 | VH-MH-14 |
| VH-US-084 | Là HC-NS, tôi muốn dùng cây tổ chức đang có ở VClinks và VCwiki làm điểm khởi đầu để không phải gõ lại từ đầu | S | B | VH-IMP-03 | VH-MH-14 |
| VH-US-085 | Là HC-NS, tôi muốn hồ sơ tự đồng bộ từ phần mềm nhân sự khi công ty có để không phải nhập hai nơi | C | E | VH-IMP-04 | VH-MH-14, VH-MH-11 |
| VH-US-086 | Là HC-NS, tôi muốn hoàn tác một lô nhập Excel trong 24 giờ để sửa nhanh khi nhập nhầm | S | B | VH-IMP-05 | VH-MH-14 |

**VH-US-081 — Tiêu chí nghiệm thu**
- Cho trước tôi chọn mẫu "Nhân sự" / Khi bấm "Tải mẫu .xlsx" / Thì nhận tệp có trang Hướng dẫn và danh sách chọn cho cột mã.
- Cho trước tệp 312 dòng, trong đó 7 dòng có quản lý tạo vòng hoặc không tồn tại / Khi tải lên / Thì bảng kết quả ghi "OK 290 · Cảnh báo 15 · Lỗi 7", mỗi dòng lỗi có câu dạng "Dòng {n}: …", và chưa có gì ghi vào hồ sơ.
- Cho trước tệp có cột "CCCD", "Ngày sinh" / Khi kiểm thử / Thì có cảnh báo "Đã bỏ qua cột lạ: CCCD, Ngày sinh. VC Home không lưu các thông tin này." và giá trị các cột đó không được đọc.
- Cho trước tệp `.xls` hoặc quá 2.000 dòng / Khi tải lên / Thì bị từ chối, ví dụ "Tệp quá 5 MB hoặc quá 2.000 dòng. Hãy chia nhỏ."

**VH-US-082 — Tiêu chí nghiệm thu**
- Cho trước lô còn dòng lỗi / Khi rê chuột lên "Ghi thật" / Thì nút khoá với câu "Còn {n} dòng lỗi. Sửa tệp rồi tải lên lại."
- Cho trước lô có 0 lỗi, 15 cảnh báo, tôi đã tích "Đã xem cảnh báo" / Khi bấm "Ghi thật" trong 24 giờ sau khi kiểm và xác nhận / Thì cả lô được ghi, toast "Đã ghi {n} dòng. Lô số {mã lô}." và ngăn "Lịch sử" có lô này với tệp gốc, tệp kết quả.
- Cho trước một người có trong hệ thống nhưng không có trong tệp / Khi ghi lô / Thì người đó không bị đặt nghỉ việc; chỉ được liệt kê lúc kiểm thử.

**VH-US-083 — Tiêu chí nghiệm thu**
- Cho trước 3 tài khoản Google chưa có hồ sơ / Khi bấm "Đối chiếu ngay" / Thì nhóm "có Google, chưa có hồ sơ" có đúng 3 dòng, mỗi dòng có hành động gợi ý.
- Cho trước một dòng là hộp thư dùng chung / Khi quản trị đánh dấu "Không phải người" kèm lý do / Thì tài khoản đó không hiện lại ở các lần đối chiếu sau và không được cấp quyền app.
- Cho trước Google trả số tài khoản ít hơn 50% lần trước / Khi đối chiếu / Thì dừng, giữ kết quả lần trước, báo "Đối chiếu dừng: Google trả {n} tài khoản, ít hơn 50% lần trước ({m}). Giữ kết quả lần trước."
- Cho trước tôi là quản trị hệ thống / Khi mở hồ sơ từ một dòng đối chiếu / Thì chỉ xem, không có nút sửa hồ sơ (VH-BR-17).

**VH-US-084 — Tiêu chí nghiệm thu**
- Cho trước quản trị hệ thống tải tệp xuất của VClinks và VCwiki ở ngăn "Khởi tạo từ app" / Khi hệ thống ghép xong / Thì mỗi đơn vị một dòng: Khớp cả hai, Chỉ có ở VClinks, Chỉ có ở VCwiki hoặc Xung đột; hai app không bị ghi gì.
- Cho trước còn dòng xung đột chưa chọn cách xử lý / Khi bấm "Xuất tệp nhập" / Thì báo "Còn {n} dòng xung đột chưa chọn cách xử lý."
- Cho trước đã xử lý hết / Khi bấm "Xuất tệp nhập" / Thì nhận mẫu cơ cấu và mẫu nhân sự điền sẵn, ô thiếu tô vàng, để nhập lại theo VH-US-081.

**VH-US-085 — Tiêu chí nghiệm thu**
- Cho trước phần mềm nhân sự đã nối (Q-01) / Khi có lô thay đổi nhỏ (≤ 20 người, không đổi cây đơn vị) không lỗi / Thì lô tự ghi; lô lớn hơn, có đổi cơ cấu hoặc có lỗi thì chờ HC-NS xem rồi ghi.
- Cho trước trường do phần mềm nhân sự giữ / Khi HC-NS sửa tay ở VH-MH-11 / Thì báo "Trường {trường} lấy từ phần mềm nhân sự. Hãy sửa ở phần mềm nhân sự."

**VH-US-086 — Tiêu chí nghiệm thu**
- Cho trước lô 50 người áp 2 giờ trước, chưa ai sửa tiếp / Khi bấm "Hoàn tác" / Thì dữ liệu trở về như trước lô và nhật ký có dòng hoàn tác.
- Cho trước một hồ sơ trong lô đã được sửa sau đó / Khi bấm "Hoàn tác" / Thì bị chặn và hồ sơ đó được liệt kê.
- Cho trước lô đã áp 25 giờ trước / Khi mở VH-MH-14 / Thì không còn nút "Hoàn tác".

## 8. VH-E-06 Danh mục app và vai trò app

**Mục tiêu:** danh mục app, liên kết ngoài và vai trò của từng app nằm ở một chỗ; mỗi app có chủ; vai trò nhạy cảm được đánh dấu theo tiêu chí; app mới vào theo một hợp đồng có danh sách kiểm. **GĐ:** B (danh mục), C (vai trò, chủ app, nhạy cảm, chuyển tiếp), E (đưa app mới vào). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-101 | Là quản trị hệ thống, tôi muốn quản lý danh mục app (tên, URL, biểu tượng, trạng thái, thứ tự, liên kết ngoài) để trang chủ và thanh chuyển app luôn đúng | M | A, B | VH-APP-01, VH-API-08 | VH-MH-15 |
| VH-US-102 | Là chủ app, tôi muốn khai các vai trò thô mà app tôi nhận để VC Home cấp đúng vai trò và app tự ánh xạ sang quyền chi tiết | M | C | VH-APP-02 | VH-MH-15 |
| VH-US-103 | Là quản trị hệ thống, tôi muốn ghi 1–3 chủ app cho mỗi app để có người chịu trách nhiệm vai trò và duyệt vai trò nhạy cảm | M | C | VH-APP-03 | VH-MH-15 |
| VH-US-104 | Là chủ app, tôi muốn đánh dấu vai trò nhạy cảm theo tiêu chí để yêu cầu xin vai trò đó luôn qua tay tôi duyệt | M | C | VH-APP-05 | VH-MH-15, VH-MH-05 |
| VH-US-105 | Là quản trị hệ thống, tôi muốn đặt thời gian chuyển tiếp 0–7 ngày cho từng app theo đề nghị của chủ app để người đổi vị trí kịp bàn giao việc | S | C | VH-APP-06 | VH-MH-15 |
| VH-US-106 | Là quản trị hệ thống, tôi muốn đưa app mới vào theo hợp đồng tích hợp có danh sách kiểm 14 mục để app nào vào cũng an toàn như nhau | S | E | VH-APP-04 | VH-MH-15 |
| VH-US-107 | Là chủ app, tôi muốn tắt "cho phép xin" ở vai trò quản trị để vai trò đó chỉ có qua luật hoặc cấp khẩn cấp | S | D | VH-APP-07 | VH-MH-15, VH-MH-05 |

**VH-US-101 — Tiêu chí nghiệm thu**
- Cho trước GĐ A / Khi sửa `apps.yaml` sai khuôn rồi build / Thì bước kiểm schema dừng build; `catalog.json` đang chạy giữ nguyên.
- Cho trước GĐ B / Khi tôi sửa thông tin app trên màn / Thì `catalog.json` sinh lại trong ≤ 1 phút và không chứa dữ liệu cá nhân.
- Cho trước tôi nhập URL bắt đầu bằng `http://` / Khi lưu / Thì báo "URL phải bắt đầu bằng https://."
- Cho trước app "Đang chạy" có 40 người có quyền / Khi chuyển sang "Ngừng" / Thì hỏi "App đang có 40 người có quyền. Chuyển sang Ngừng sẽ ẩn app khỏi trang chủ và thanh chuyển app; quyền cũ cần gỡ ở Tra cứu quyền."

**VH-US-102 — Tiêu chí nghiệm thu**
- Cho trước tôi là chủ app VClinks / Khi thêm vai trò `thu_kho` có mô tả / Thì trong ≤ 1 phút client `vclinks` trên VC ID có client role `thu_kho`, và vai trò chọn được ở luật, ở ngăn xin quyền.
- Cho trước tôi là chủ app VClinks / Khi sửa vai trò của VCwiki qua API / Thì nhận 403 "Bạn chỉ quản vai trò của app mình."
- Cho trước vai trò còn 4 người giữ / Khi bấm "Ngừng vai trò" / Thì báo "Vai trò đang có 4 người giữ và {m} luật dùng. Gỡ quyền và sửa luật trước khi ngừng."

**VH-US-103 — Tiêu chí nghiệm thu**
- Cho trước app đang chạy chỉ còn 1 chủ / Khi bỏ người đó / Thì báo "App đang chạy phải có ít nhất 1 chủ app."
- Cho trước app đã có 3 chủ / Khi thêm người thứ tư / Thì báo "Mỗi app có tối đa 3 chủ app."
- Cho trước một người vừa được ghi là chủ app VClinks / Khi đăng nhập / Thì menu có "App và vai trò", "Luật cấp quyền", "Tra cứu quyền", "Nhật ký", "Báo cáo", "Hộp duyệt", tất cả lọc theo VClinks.

**VH-US-104 — Tiêu chí nghiệm thu**
- Cho trước tôi đánh dấu `giam_doc_bh` là "Nhạy cảm" mà không chọn tiêu chí / Khi lưu / Thì báo "Chọn ít nhất một tiêu chí nhạy cảm."
- Cho trước `giam_doc_bh` đã nhạy cảm / Khi nhân viên chọn vai trò này ở ngăn xin quyền / Thì thấy nhãn "Nhạy cảm, cần chủ app duyệt thêm" và "Người duyệt dự kiến" có 2 bước.
- Cho trước tôi là chủ app / Khi bỏ đánh dấu nhạy cảm / Thì báo "Chỉ quản trị hệ thống bỏ được đánh dấu nhạy cảm."

**VH-US-105 — Tiêu chí nghiệm thu**
- Cho trước tôi nhập 10 ngày / Khi lưu / Thì báo "Thời gian chuyển tiếp từ 0 đến 7 ngày."
- Cho trước VClinks đặt 3 ngày / Khi một NVKD chuyển sang CSKH hiệu lực 01/12 / Thì có `cskh` từ 00:00 01/12, giữ `nvkd` tới hết 03/12, mất `nvkd` lúc 00:00 04/12.
- Cho trước tôi là chủ app / Khi mở ngăn "Thông tin" của app mình / Thì thấy thời gian chuyển tiếp nhưng không sửa được (02 mục 3: chủ app chỉ đọc cấu hình app).

**VH-US-106 — Tiêu chí nghiệm thu**
- Cho trước VCsale mới đạt 12/14 mục danh sách kiểm / Khi chuyển trạng thái sang "Thử nghiệm" / Thì báo "Chưa đạt hợp đồng tích hợp: còn 2 mục chưa xong. Xem danh sách kiểm."
- Cho trước endpoint back-channel của app trả 200 với token sai / Khi "Chạy bộ kiểm" / Thì báo "Endpoint back-channel trả 200 với token sai (mong 400)."
- Cho trước đủ 14 mục / Khi chuyển sang "Thử nghiệm", chạy ổn 2 tuần và chủ app đồng ý / Thì chuyển "Đang chạy"; VCsale xuất hiện trên trang chủ của người có quyền.

**VH-US-107 — Tiêu chí nghiệm thu**
- Cho trước `vclinks:admin` tắt "cho phép xin" / Khi nhân viên mở ngăn xin quyền VClinks / Thì không thấy vai trò này.
- Cho trước link `?app=vclinks&role=admin` / Khi mở / Thì báo "Vai trò này không nhận yêu cầu. Liên hệ chủ app {tên}."

## 9. VH-E-07 Quyền theo luật

**Mục tiêu:** quyền mặc định đi theo hồ sơ qua luật dựa trên thuộc tính, không gán tay từng người; luật được xem trước; luật lớn hoặc cấp vai trò nhạy cảm cần người thứ hai duyệt; quyền ngoại lệ có hạn và gỡ được; tra được "ai có quyền gì". **GĐ:** C (hạn dùng quyền theo yêu cầu ở D). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-121 | Là quản trị hệ thống, tôi muốn viết luật theo thuộc tính hồ sơ (pháp nhân, đơn vị, chức danh, chức năng, loại nhân viên…) để người đúng tự có vai trò app | M | C | VH-ACC-01 | VH-MH-16 |
| VH-US-122 | Là quản trị hệ thống, tôi muốn xem trước ai được thêm, ai mất quyền trước khi áp luật để không cấp hay gỡ nhầm hàng loạt | M | C | VH-ACC-03 | VH-MH-16 |
| VH-US-123 | Là chủ app, tôi muốn luật ảnh hưởng trên 20 người hoặc cấp vai trò nhạy cảm phải có người thứ hai duyệt để một người không tự áp thay đổi lớn | M | C | VH-ACC-01, VH-ACC-03 | VH-MH-16, VH-MH-08 |
| VH-US-124 | Là nhân viên, tôi muốn quyền tự tính lại khi hồ sơ, cơ cấu hoặc luật đổi để không phải xin lại sau mỗi lần điều chuyển | M | C | VH-ACC-02 | VH-MH-04, VH-MH-16 |
| VH-US-125 | Là quản trị hệ thống, tôi muốn cấp quyền khẩn cấp tối đa 7 ngày có lý do để xử lý việc gấp mà vẫn có dấu vết | S | C | VH-ACC-04 | VH-MH-17 |
| VH-US-126 | Là người giữ quyền ngoại lệ, tôi muốn quyền có hạn, được báo trước khi hết và tự kết thúc khi hết hạn để không ai giữ quyền thừa | M | D | VH-ACC-05 | VH-MH-04 |
| VH-US-127 | Là quản trị hệ thống, tôi muốn gỡ quyền ngoại lệ có lý do để xử lý sai sót hay rủi ro ngay | M | C | VH-ACC-06 | VH-MH-17 |
| VH-US-128 | Là đội app, tôi muốn quyền được đẩy sang VC ID thành nhóm và vai trò trong token để app đọc được ở lần đăng nhập sau | M | C | VH-ACC-07 | VH-MH-17 |
| VH-US-129 | Là kiểm soát, tôi muốn tra "người này có quyền gì", "ai có vai trò này", kể cả tại một ngày đã qua, để trả lời kiểm toán | M | C | VH-ACC-08 | VH-MH-17 |
| VH-US-130 | Là nhân viên, tôi muốn xem mình có quyền gì, từ đâu, đến khi nào; là quản lý, tôi muốn xem quyền của đội, để biết ai đang dùng gì | M | C | VH-ACC-08, VH-HOM-03 | VH-MH-04, VH-MH-09 |
| VH-US-131 | Là nhân viên, tôi muốn tự trả quyền ngoại lệ không còn dùng để không giữ quyền thừa | S | D | VH-ACC-09 | VH-MH-04 |

**VH-US-121 — Tiêu chí nghiệm thu**
- Cho trước luật "Pháp nhân thuộc VCparts, Đơn vị thuộc cây Phòng Kinh doanh, Chức năng thuộc Bán hàng → VClinks · nvkd" / Khi luật được áp / Thì mọi vị trí thoả điều kiện có vai trò `nvkd` gắn đơn vị của vị trí đó, nguồn "Luật".
- Cho trước chị Hoa kiêm CSKH VCservice và có luật "Pháp nhân thuộc VCservice, Chức năng thuộc CSKH → VClinks · cskh" / Khi hai luật chạy / Thì chị có `nvkd` tại đơn vị ở VCparts và `cskh` tại đơn vị ở VCservice (VH-BR-24).
- Cho trước tôi mở danh sách thuộc tính của bộ dựng điều kiện / Khi tìm "email" hoặc "mã nhân viên" / Thì không có; gửi qua API thì nhận "Luật không được dùng email hay mã nhân viên. Người cần ngoại lệ hãy gửi yêu cầu quyền."
- Cho trước luật không có điều kiện nào / Khi lưu / Thì báo "Luật phải có ít nhất một điều kiện. Muốn cấp cho mọi người, hãy chọn điều kiện 'Loại nhân viên thuộc' với đủ các loại."

**VH-US-122 — Tiêu chí nghiệm thu**
- Cho trước một luật nháp / Khi bấm "Xem trước" / Thì thấy số người được thêm, số người mất, số người đổi nguồn và danh sách từng nhóm có mã NV, họ tên, đơn vị, quyền thêm hoặc mất.
- Cho trước một người sẽ mất quyền từ luật nhưng còn quyền ngoại lệ cùng vai trò / Khi xem trước / Thì người đó ghi "vẫn giữ nhờ quyền ngoại lệ đến {dd/mm/yyyy}" và không tính vào "Mất".
- Cho trước tôi sửa điều kiện sau khi đã xem trước / Khi rê chuột lên "Áp dụng" / Thì nút khoá với câu "Bấm Xem trước sau lần sửa cuối rồi mới áp dụng."
- Cho trước 1.000 nhân viên / Khi bấm "Xem trước" / Thì có kết quả trong ≤ 10 giây.

**VH-US-123 — Tiêu chí nghiệm thu**
- Cho trước xem trước ra 38 người được thêm và 4 người mất / Khi nhìn biểu mẫu / Thì có dải "Luật này làm thay đổi quyền của 42 người (trên 20). Cần người thứ hai duyệt trước khi có hiệu lực." và nút "Gửi duyệt" thay cho "Áp dụng".
- Cho trước luật cấp `giam_doc_bh` (nhạy cảm) chỉ ảnh hưởng 3 người / Khi xem trước / Thì vẫn phải "Gửi duyệt" với dải "Luật cấp vai trò nhạy cảm. Cần người thứ hai duyệt trước khi có hiệu lực." (VH-BR-25).
- Cho trước tôi là người soạn / Khi mở luật đang chờ và bấm duyệt / Thì báo "Bạn là người soạn luật này nên không duyệt được."
- Cho trước người duyệt mở luật sau khi hồ sơ đã đổi / Khi bấm "Duyệt" / Thì thấy "Số người bị ảnh hưởng đã đổi từ {a} thành {b} kể từ lúc soạn. Xem phần chênh trước khi duyệt." và phải xác nhận lại.

**VH-US-124 — Tiêu chí nghiệm thu**
- Cho trước HC-NS chuyển tôi sang chức năng CSKH có hiệu lực hôm nay / Khi lưu / Thì trong ≤ 5 phút tôi có vai trò CSKH theo luật.
- Cho trước đơn vị của tôi được chuyển sang division khác / Khi thay đổi có hiệu lực / Thì quyền của mọi người trong cây con của đơn vị được tính lại theo luật của division mới.
- Cho trước một luật bị tắt / Khi tắt có hiệu lực / Thì người chỉ có quyền từ luật đó mất quyền sau thời gian chuyển tiếp của app; người có thêm nguồn "Được duyệt" vẫn giữ quyền (VH-BR-09).

**VH-US-125 — Tiêu chí nghiệm thu**
- Cho trước tôi nhập lý do 30 ký tự và để hạn mặc định / Khi bấm "Cấp khẩn cấp" / Thì người đó có quyền ngay, nguồn "Khẩn cấp", hết hạn sau 24 giờ; người nhận, quản lý trực tiếp, chủ app và kiểm soát được báo.
- Cho trước tôi chọn hết hạn sau 8 ngày / Khi lưu / Thì báo "Quyền khẩn cấp tối đa 7 ngày. Cần lâu hơn hãy gửi yêu cầu quyền."
- Cho trước tôi cấp cho chính mình / Khi lưu / Thì báo "Bạn không tự cấp quyền khẩn cấp cho mình được."
- Cho trước tới giờ hết hạn / Khi job hẹn giờ quyền chạy / Thì quyền chuyển "Hết hạn" chậm nhất 15 phút sau giờ hết hạn; không có nút gia hạn.

**VH-US-126 — Tiêu chí nghiệm thu**
- Cho trước quyền "Được duyệt" hạn 31/12/2026 / Khi tới ngày 17/12 và 28/12 / Thì tôi nhận "Vai trò {vai trò} trong {app} hết hạn ngày 31/12." (chép quản lý trực tiếp); từ 17/12 dòng quyền có nhãn "Còn {N} ngày" và nút "Gia hạn".
- Cho trước tới 00:00 ngày 01/01/2027 / Khi job hẹn giờ quyền chạy / Thì quyền "Hết hạn", app nhận `vh.grant.removed`, tôi nhận "Quyền {vai trò} trong {app} đã hết hạn ngày 31/12/2026. Cần dùng tiếp hãy gửi yêu cầu mới."
- Cho trước cùng vai trò còn nguồn "Luật" / Khi nguồn "Được duyệt" hết hạn / Thì tôi vẫn giữ vai trò và app không nhận sự kiện.

**VH-US-127 — Tiêu chí nghiệm thu**
- Cho trước tôi chọn 3 dòng nguồn "Được duyệt" của 2 người / Khi bấm "Gỡ", nhập lý do ≥ 10 ký tự và xác nhận "Gỡ 3 quyền của 2 người? Không hoàn tác được." / Thì quyền gỡ ngay, người giữ quyền và quản lý được báo.
- Cho trước dòng nguồn "Luật" / Khi bấm "Gỡ" / Thì báo "Quyền này đến từ luật {tên luật}. Muốn gỡ, hãy sửa hồ sơ của người này hoặc sửa luật."
- Cho trước tôi là chủ app VClinks / Khi gỡ quyền VCwiki của một người / Thì báo "Bạn chỉ gỡ được quyền trong app mình làm chủ."

**VH-US-128 — Tiêu chí nghiệm thu**
- Cho trước một người vừa được cấp VClinks · cskh / Khi người đó đăng nhập lại VClinks / Thì token có `cskh` trong `resource_access.vclinks.roles` và đơn vị tương ứng trong `vh_roles`; VC ID đổi trong ≤ 1 phút sau khi quyền đổi.
- Cho trước việc đẩy sang VC ID lỗi / Khi quản trị tra cứu người đó / Thì thấy "Lỗi đẩy: {mã}" và nút "Đẩy lại sang VC ID".
- Cho trước một lần đẩy định bỏ quá 50 vai trò mà không khớp thay đổi đã duyệt / Khi bộ đồng bộ chạy / Thì dừng an toàn, không bỏ gì, cảnh báo "Đồng bộ quyền dừng an toàn: định gỡ {n} vai trò ({x}%). Cần quản trị hệ thống xác nhận."

**VH-US-129 — Tiêu chí nghiệm thu**
- Cho trước tôi tìm "Nguyễn Thị Lan" ở ngăn "Theo người" / Khi xem kết quả / Thì thấy mọi quyền với các nguồn (tên luật, mã yêu cầu, lý do khẩn cấp), hạn, trạng thái; không có nút gỡ, cấp, khoá.
- Cho trước tôi chọn "Tại ngày" 01/07/2026 / Khi tra VClinks · giam_doc_bh ở ngăn "Theo app" / Thì thấy những người có vai trò đó đúng vào ngày ấy.
- Cho trước tôi bấm "Tải Excel" / Khi tải xong / Thì tệp đúng cột và bộ lọc đang xem, nhật ký ghi lần tải.

**VH-US-130 — Tiêu chí nghiệm thu**
- Cho trước tôi có VClinks · nvkd theo luật và VClinks · marketing được duyệt đến 31/12/2026 / Khi mở "Quyền của tôi" / Thì thấy 2 dòng: chip "Luật" hạn "Không hạn"; chip "Được duyệt" dùng đến hết 31/12/2026.
- Cho trước tôi là quản lý / Khi mở ngăn "Quyền" ở "Đội của tôi" / Thì thấy quyền của cả cây dưới quyền và không thấy quyền của người ngoài đội.

**VH-US-131 — Tiêu chí nghiệm thu**
- Cho trước tôi có VClinks · marketing nguồn "Được duyệt" / Khi bấm "Trả quyền" và xác nhận / Thì VClinks nhận `vh.grant.removed` trong ≤ 1 phút và quản lý của tôi được báo.
- Cho trước cùng vai trò còn nguồn "Luật" / Khi trả dòng "Được duyệt" / Thì tôi vẫn giữ vai trò, không có `vh.grant.removed`.

## 10. VH-E-08 Vòng đời nhân viên

**Mục tiêu:** người mới vào làm có ngay đúng app và vai trò; chuyển vị trí tự đổi quyền, có thời gian chuyển tiếp để bàn giao; nghỉ việc tự khoá, gỡ quyền và báo app bàn giao; nghỉ dài ngày giữ quyền; người cũ quay lại giữ mã. **GĐ:** C (nghỉ dài ngày tự xử lý và quay lại ở D). **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-141 | Là HC-NS, tôi muốn tạo hồ sơ người mới trước ngày vào để ngày đầu người đó đăng nhập là có đúng app và vai trò | M | C | VH-LCM-01 | VH-MH-11, VH-MH-02 |
| VH-US-142 | Là HC-NS, tôi muốn chuyển vị trí và thấy trước tác động tới quyền để báo đúng cho người được chuyển và quản lý | M | C | VH-LCM-02 | VH-MH-11 |
| VH-US-143 | Là nhân viên vừa chuyển vị trí, tôi muốn giữ vai trò cũ trong thời gian chuyển tiếp của app để bàn giao khách và việc đang dở | S | C | VH-LCM-02, VH-APP-06 | VH-MH-02, VH-MH-04 |
| VH-US-144 | Là HC-NS, tôi muốn đặt ngày nghỉ việc để đến 00:00 ngày đó tài khoản tự khoá, mọi quyền tự gỡ và app tự bàn giao | M | C | VH-LCM-03 | VH-MH-11 |
| VH-US-145 | Là HC-NS, tôi muốn được báo khi quản lý của ai đó nghỉ việc để gán quản lý mới, còn trong lúc chờ trưởng đơn vị duyệt thay | M | C | VH-LCM-03, VH-NSU-03 | VH-MH-11, VH-MH-08 |
| VH-US-146 | Là HC-NS, tôi muốn ghi nghỉ dài ngày và ngày quay lại để app tạm không chia việc mới mà người đó không mất quyền | S | D | VH-LCM-04 | VH-MH-11, VH-MH-06 |
| VH-US-147 | Là HC-NS, tôi muốn nhận lại người đã nghỉ với đúng mã nhân viên cũ để lịch sử liền mạch | C | D | VH-LCM-05 | VH-MH-11 |

**VH-US-141 — Tiêu chí nghiệm thu**
- Cho trước ngày 25/10 tôi tạo hồ sơ với ngày vào 01/11/2026 / Khi lưu / Thì hồ sơ "Chưa vào làm", hiện "Quyền sẽ có từ ngày vào làm", quản lý trực tiếp nhận "{họ tên} vào làm ngày 01/11 ở {đơn vị}. Quyền sẽ có: {danh sách}. …"
- Cho trước người mới đăng nhập trước ngày vào / Khi mở trang chủ / Thì thấy "Hồ sơ của bạn có hiệu lực từ 01/11/2026." và chưa có app.
- Cho trước tới 00:00 ngày 01/11/2026 / Khi người mới đăng nhập lần đầu / Thì tài khoản gắn với hồ sơ, trang chủ có đủ app theo luật, các app nhận `vh.person.joined` và `vh.grant.added`.
- Cho trước 3 ngày trước ngày vào mà email chưa có trên Google / Khi job kiểm chạy / Thì HC-NS và admin Google nhận "Chưa có tài khoản Google cho {email}; nhân viên vào làm ngày 01/11."

**VH-US-142 — Tiêu chí nghiệm thu**
- Cho trước tôi mở biểu mẫu "Chuyển vị trí" / Khi chọn đơn vị và chức năng mới / Thì khung "Tác động tới quyền" hiện quyền thêm, quyền mất kèm số ngày chuyển tiếp từng app (ví dụ "VClinks · nvkd: còn dùng 3 ngày sau ngày hiệu lực"), quyền ngoại lệ giữ nguyên; không có nút sửa quyền (VH-BR-17).
- Cho trước người được chuyển đang là trưởng đơn vị mà vị trí mới không còn hợp lệ / Khi lưu / Thì phải chọn "Bỏ chức trưởng đơn vị {đơn vị}" mới lưu được.
- Cho trước thay đổi có hiệu lực / Khi job áp lúc 00:00 / Thì app nhận `vh.person.moved`; người được chuyển, quản lý cũ và quản lý mới được báo.

**VH-US-143 — Tiêu chí nghiệm thu**
- Cho trước VClinks đặt chuyển tiếp 3 ngày và tôi chuyển từ NVKD sang CSKH ngày 01/11/2026 / Khi xem trang chủ ngày 01/11 / Thì ô VClinks có cả hai vai trò và nhãn "Còn 3 ngày"; "Quyền của tôi" ghi "Chuyển tiếp, gỡ ngày 04/11/2026".
- Cho trước tới 00:00 ngày 04/11/2026 / Khi tôi đăng nhập lại VClinks / Thì token chỉ còn vai trò `cskh`.

**VH-US-144 — Tiêu chí nghiệm thu**
- Cho trước tôi đặt ngày nghỉ 15/11/2026 cho Lê Minh Tú / Khi lưu / Thì màn hiện tác động (số quyền sẽ gỡ theo app, số người đang báo cáo, việc duyệt đang giữ); quản lý trực tiếp được báo ngay và 3 ngày trước: "Lê Minh Tú nghỉ việc từ 15/11. Hãy chuẩn bị bàn giao."
- Cho trước tới 00:00 ngày 15/11/2026 / Khi hệ thống chạy / Thì làm đúng thứ tự: khoá VC ID và đăng xuất mọi app; gỡ mọi quyền ở mọi nguồn; gửi `vh.person.left`; đóng các vị trí, hồ sơ "Đã nghỉ" (VH-BR-14).
- Cho trước ngày nghỉ là hôm nay / Khi lưu / Thì hỏi "Nghỉ việc có hiệu lực ngay: khoá tài khoản, gỡ {n} quyền, đăng xuất mọi app. Tiếp tục?"
- Cho trước ngày nghỉ trước ngày vào / Khi lưu / Thì báo "Ngày nghỉ việc phải sau ngày vào ({dd/mm/yyyy})."

**VH-US-145 — Tiêu chí nghiệm thu**
- Cho trước Trần Văn Bình đang là quản lý của 6 người / Khi HC-NS đặt ngày nghỉ cho Bình / Thì có cảnh báo "Người này đang là trưởng {đơn vị} và quản lý trực tiếp của 6 người. Sau ngày nghỉ, các vị trí này sẽ thiếu quản lý." kèm liên kết "Chuyển người báo cáo".
- Cho trước ngày nghỉ có hiệu lực mà chưa chuyển / Khi xem danh sách nhân sự / Thì 6 hồ sơ có cảnh báo "Thiếu quản lý" và HC-NS nhận "6 vị trí đang thiếu quản lý trực tiếp."
- Cho trước một trong 6 người gửi yêu cầu quyền / Khi hệ thống chọn người duyệt / Thì bước 1 là trưởng đơn vị của vị trí chính (VH-BR-05) và yêu cầu hiện trong hộp duyệt của người đó.

**VH-US-146 — Tiêu chí nghiệm thu**
- Cho trước chị Hà nghỉ dài ngày từ 01/12/2026 đến 31/05/2027 / Khi tôi lưu "Đặt nghỉ dài ngày" với "Khoá đăng nhập" = Không / Thì biểu mẫu không có ô lý do; chị giữ mọi quyền, đăng nhập được; app nhận `vh.person.leave_started`; danh bạ hiện nhãn "Tạm vắng".
- Cho trước thời gian nghỉ dưới 7 ngày / Khi lưu / Thì báo "Nghỉ dài ngày phải từ 7 ngày trở lên. Nghỉ ngắn hơn không cần khai trên VC Home."
- Cho trước 00:00 ngày sau ngày đi làm lại dự kiến / Khi hệ thống chạy / Thì trạng thái về "Đang làm", app nhận `vh.person.returned`, nhãn "Tạm vắng" mất; HC-NS đã được nhắc trước 3 ngày.

**VH-US-147 — Tiêu chí nghiệm thu**
- Cho trước Lê Minh Tú đã nghỉ, mã VCP-0145 / Khi bấm "Nhận lại" với ngày vào lại và vị trí mới / Thì hồ sơ giữ mã và lịch sử cũ, trạng thái "Chưa vào làm"; tới ngày vào thì app nhận `vh.person.joined` có cờ `rehire = true`.
- Cho trước anh Tú từng có quyền ngoại lệ trước khi nghỉ / Khi quay lại / Thì quyền ngoại lệ, yêu cầu và uỷ quyền cũ không tự khôi phục; quyền theo luật tính lại.
- Cho trước ngày vào lại trước ngày nghỉ cũ / Khi lưu / Thì báo "Ngày vào làm lại phải sau ngày nghỉ việc {dd/mm/yyyy}."

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
| VH-US-170 | Là quản lý, tôi muốn duyệt nhiều yêu cầu thường một lần để không mất thời gian khi nhiều người cùng xin | S | D | VH-REQ-07 | VH-MH-08 |

**VH-US-161 — Tiêu chí nghiệm thu**
- Cho trước tôi chọn VClinks · marketing, lý do 46 ký tự, thời hạn 90 ngày / Khi bấm "Gửi yêu cầu" / Thì toast "Đã gửi yêu cầu. {tên người duyệt} sẽ nhận thông báo." và ngăn "Yêu cầu của tôi" có dòng "Chờ duyệt bước 1: {tên}" kèm giờ tự huỷ.
- Cho trước lý do chỉ có 12 ký tự / Khi bấm gửi / Thì báo "Hãy ghi lý do ít nhất 20 ký tự để người duyệt hiểu việc cần làm." và không gửi.
- Cho trước tôi đã có yêu cầu đang chờ cho cùng vai trò / Khi gửi lần nữa / Thì báo "Bạn đã có yêu cầu {mã} đang chờ duyệt cho vai trò này."
- Cho trước tôi chọn VClinks · giam_doc_bh (nhạy cảm) / Khi nhìn "Người duyệt dự kiến" / Thì thấy ① quản lý trực tiếp và ② chủ app, cùng dòng "Yêu cầu tự huỷ nếu chưa duyệt xong sau 7 ngày".

**VH-US-162 — Tiêu chí nghiệm thu**
- Cho trước yêu cầu vai trò thường đang chờ tôi / Khi bấm "Duyệt" / Thì người được cấp có quyền nguồn "Được duyệt" với hạn đã chốt và nhận "Yêu cầu {vai trò} trong {app} đã được duyệt, có hiệu lực tới {dd/mm/yyyy}."
- Cho trước người xin xin 180 ngày / Khi tôi chọn thời hạn dài hơn / Thì báo "Người duyệt chỉ rút ngắn được thời hạn, không kéo dài."; chọn 30 ngày thì quyền hết hạn sau 30 ngày.
- Cho trước tôi bấm "Từ chối" với ý kiến 5 ký tự / Khi xác nhận / Thì báo "Hãy ghi lý do từ chối (ít nhất 10 ký tự)."
- Cho trước yêu cầu đã chuyển sang người khác vì quản lý của người được cấp vừa đổi / Khi tôi bấm duyệt / Thì thấy "Bạn không còn là người duyệt của yêu cầu này. Yêu cầu đã chuyển cho {họ tên}."

**VH-US-163 — Tiêu chí nghiệm thu**
- Cho trước quản lý đã duyệt bước 1 yêu cầu VClinks · giam_doc_bh / Khi tôi (chủ app VClinks) mở hộp duyệt / Thì yêu cầu ở bước "2 / 2" kèm tên và thời điểm duyệt bước 1.
- Cho trước VClinks có 2 chủ app / Khi một chủ app duyệt trước / Thì người kia mở yêu cầu thấy "Yêu cầu này đã được {họ tên} duyệt lúc {HH:mm dd/mm}."
- Cho trước tôi là chủ app VClinks và tự xin VClinks · giam_doc_bh / Khi bước 1 xong / Thì bước 2 chuyển cho quản trị hệ thống, không vào hộp của tôi.

**VH-US-164 — Tiêu chí nghiệm thu**
- Cho trước quản lý X xin thay cho Y, mà X là quản lý trực tiếp của Y / Khi hệ thống chọn người duyệt / Thì bước 1 chuyển lên quản lý trực tiếp của X.
- Cho trước Z được A uỷ quyền và Z là người được cấp của một yêu cầu A đang chờ duyệt / Khi Z mở hộp duyệt / Thì yêu cầu đó không hiện cho Z; vẫn ở hộp của A.
- Cho trước vì lỗi dữ liệu mà yêu cầu của tôi hiện trong hộp duyệt của tôi / Khi rê chuột lên "Duyệt" / Thì nút khoá với câu "Không duyệt được yêu cầu của chính bạn." và API cũng từ chối.

**VH-US-165 — Tiêu chí nghiệm thu**
- Cho trước tôi chọn 2 yêu cầu vai trò thường / Khi bấm "Duyệt các mục đã chọn" / Thì toast "Đã duyệt 2 yêu cầu."
- Cho trước trong lựa chọn có 1 vai trò nhạy cảm / Khi rê chuột lên "Duyệt các mục đã chọn" / Thì nút khoá với câu "Vai trò nhạy cảm phải duyệt từng yêu cầu."
- Cho trước tôi mở hộp duyệt trên điện thoại rộng dưới 600 px / Khi xem danh sách / Thì không có ô chọn nhiều; duyệt từng thẻ.

**VH-US-166 — Tiêu chí nghiệm thu**
- Cho trước tôi uỷ quyền bước 1 cho Lê Thu Hà từ 10/11 đến 20/11/2026 / Khi có yêu cầu mới trong khoảng đó / Thì yêu cầu hiện trong hộp của chị Hà với nhãn "Thay {họ tên tôi}"; tôi vẫn duyệt được; quyết định ghi "Duyệt bởi Lê Thu Hà thay {tôi}".
- Cho trước tôi chọn chính mình hoặc khoảng dài hơn 30 ngày / Khi lưu / Thì báo "Không uỷ quyền cho chính mình được." hoặc "Uỷ quyền tối đa 30 ngày."
- Cho trước chị Hà nghỉ việc giữa chừng / Khi thay đổi có hiệu lực / Thì uỷ quyền tự kết thúc và tôi được báo.

**VH-US-167 — Tiêu chí nghiệm thu**
- Cho trước yêu cầu gửi 15:00 thứ Hai 02/11 chưa duyệt / Khi tới 08:00 ngày 04/11 và 08:00 ngày 07/11 / Thì người duyệt (và người được uỷ nếu có) nhận nhắc "Yêu cầu {mã} của {họ tên} xin {vai trò} trong {app} đang chờ bạn duyệt. Yêu cầu tự huỷ lúc {HH:mm dd/mm}."
- Cho trước tới hạn 7 ngày vẫn chưa duyệt xong / Khi job hẹn giờ chạy / Thì yêu cầu "Tự huỷ"; người gửi và người được cấp nhận "Yêu cầu {mã} đã tự huỷ vì quá 7 ngày chưa duyệt xong. Bạn có thể gửi lại." với nút "Gửi lại".
- Cho trước người duyệt bấm đúng lúc job huỷ / Khi lệnh huỷ ghi trước / Thì người duyệt nhận "Yêu cầu này đã kết thúc (Tự huỷ)."

**VH-US-168 — Tiêu chí nghiệm thu**
- Cho trước tôi là quản lý của Lan / Khi bấm "Xin quyền thay" ở "Đội của tôi" / Thì ngăn kéo mở với "Xin cho người khác: Nguyễn Thị Lan"; gửi xong Lan nhận "{họ tên tôi} đã xin quyền {vai trò} trong {app} cho bạn."
- Cho trước tôi chọn một người ngoài cây dưới quyền / Khi gửi / Thì báo "Bạn chỉ xin quyền thay được cho người trong cây dưới quyền của mình."
- Cho trước yêu cầu do tôi gửi thay / Khi Lan mở "Quyền của tôi" / Thì Lan thấy yêu cầu nhưng không có nút rút; chỉ tôi rút được.

**VH-US-169 — Tiêu chí nghiệm thu**
- Cho trước quyền "Được duyệt" còn 14 ngày / Khi mở "Quyền của tôi" / Thì dòng đó có nút "Gia hạn"; bấm thì ngăn kéo "Gia hạn quyền" mở sẵn app, vai trò, đơn vị và dòng "Hạn mới tính từ ngày hết hạn cũ."
- Cho trước quyền nguồn "Khẩn cấp" hoặc chỉ nguồn "Luật" / Khi xem dòng đó / Thì không có nút "Gia hạn".
- Cho trước yêu cầu gia hạn 90 ngày được duyệt trước hạn cũ / Khi xem "Quyền của tôi" / Thì hạn mới bằng hạn cũ cộng 90 ngày, quyền không bị đứt và app không nhận sự kiện.

**VH-US-170 — Tiêu chí nghiệm thu**
- Cho trước 5 yêu cầu thường chờ tôi / Khi chọn cả 5 và bấm "Duyệt các mục đã chọn" / Thì có 5 dòng quyết định riêng và 5 dòng nhật ký.
- Cho trước một yêu cầu vai trò nhạy cảm / Khi xem hộp duyệt / Thì dòng đó không có ô chọn.
- Cho trước tôi đã chọn 20 mục / Khi chọn mục thứ 21 / Thì ô chọn khoá và hiện "Chọn tối đa 20 yêu cầu mỗi lần."

## 12. VH-E-10 Rà soát định kỳ

**Mục tiêu:** mỗi quý trưởng đơn vị xác nhận lại từng quyền ngoại lệ của người có vị trí chính trong đơn vị mình; quyền không được xác nhận trong 14 ngày tự gỡ; kết quả có biên bản cho kiểm soát. **GĐ:** D. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-181 | Là quản trị hệ thống, tôi muốn mở đợt rà soát quý cho mọi quyền ngoại lệ còn hiệu lực để định kỳ dọn quyền thừa | S | D | VH-REV-01 | VH-MH-18 |
| VH-US-182 | Là trưởng đơn vị, tôi muốn xác nhận giữ hoặc gỡ từng quyền ngoại lệ được giao cho mình để chỉ người cần mới giữ quyền | S | D | VH-REV-02 | VH-MH-10 |
| VH-US-183 | Là kiểm soát, tôi muốn quyền của chính trưởng đơn vị do trưởng đơn vị cấp trên rà soát để không ai tự xác nhận quyền mình | S | D | VH-REV-01, VH-REV-02 | VH-MH-10, VH-MH-18 |
| VH-US-184 | Là quản trị hệ thống, tôi muốn quyền không được xác nhận trong hạn tự gỡ để đợt rà soát có hiệu lực thật | S | D | VH-REV-03 | VH-MH-18 |
| VH-US-185 | Là kiểm soát, tôi muốn theo dõi tiến độ và tải biên bản kết quả đợt rà soát để làm bằng chứng kiểm soát nội bộ | S | D | VH-REV-01, VH-REV-03 | VH-MH-18 |
| VH-US-186 | Là chủ app, tôi muốn rà soát luật của app mình mỗi nửa năm để luật luôn khớp cơ cấu thật | S | D | VH-REV-04 | VH-MH-18, VH-MH-16 |

**VH-US-181 — Tiêu chí nghiệm thu**
- Cho trước tới 08:00 thứ Hai đầu tiên của tháng 1 / Khi lịch chạy / Thì quản trị nhận "Tới kỳ rà soát quý 1/{năm}. Hãy mở đợt."
- Cho trước có 120 quyền ngoại lệ còn hiệu lực / Khi bấm "Mở đợt mới" rồi "Mở đợt" / Thì đợt "Rà soát quyền ngoại lệ quý {q}/{yyyy}" có 120 dòng, hạn 14 ngày; mỗi người rà soát nhận "Đợt rà soát {tên đợt} mở, có {n} quyền cần bạn xác nhận trước {dd/mm}."
- Cho trước đang có một đợt mở / Khi mở đợt mới / Thì báo "Đang có đợt {tên} mở đến {dd/mm}. Đợi đợt đó đóng rồi mới mở đợt mới."
- Cho trước có quyền mặc định từ luật / Khi tạo đợt / Thì không có dòng nào cho quyền từ luật (VH-BR-16).

**VH-US-182 — Tiêu chí nghiệm thu**
- Cho trước đợt đang mở / Khi tôi bấm "Giữ" 10 dòng / Thì quyết định ghi ngay, hạn quyền không đổi.
- Cho trước tôi bấm "Gỡ" 2 dòng với ghi chú "Không còn làm việc này" và xác nhận "Gỡ ngay 2 quyền? Muốn cấp lại phải gửi yêu cầu mới." / Khi xác nhận / Thì 2 quyền gỡ ngay và người giữ quyền được báo.
- Cho trước tôi bấm "Gỡ" với ghi chú dưới 10 ký tự / Khi lưu / Thì báo "Hãy ghi lý do gỡ (ít nhất 10 ký tự)."
- Cho trước một dòng đã "Gỡ" / Khi tôi đổi sang "Giữ" / Thì báo "Quyền đã bị gỡ. Muốn cấp lại hãy gửi yêu cầu mới."

**VH-US-183 — Tiêu chí nghiệm thu**
- Cho trước trưởng Phòng KD có một quyền ngoại lệ / Khi đợt mở / Thì dòng đó giao cho trưởng đơn vị cấp trên, không hiện ở màn của chính trưởng Phòng KD.
- Cho trước người rà soát nghỉ việc giữa đợt / Khi thay đổi có hiệu lực / Thì các dòng chưa quyết chuyển lên trưởng đơn vị cấp trên và người mới được báo.
- Cho trước một dòng không tìm được người rà soát / Khi quản trị mở đợt / Thì dòng hiện "Chưa có người rà soát" và quản trị phải chỉ định một trưởng đơn vị; quản trị không tự quyết thay.

**VH-US-184 — Tiêu chí nghiệm thu**
- Cho trước đợt hết hạn còn 8 dòng chưa quyết / Khi job hẹn giờ chạy / Thì 8 dòng thành "Quá hạn", 8 quyền bị gỡ; người giữ quyền nhận "Quyền {vai trò} trong {app} đã bị gỡ vì không được xác nhận trong đợt {tên đợt}. Cần dùng lại hãy gửi yêu cầu."
- Cho trước mọi dòng đã xử lý xong / Khi job chạy / Thì đợt "Đã đóng" và mọi dòng chỉ đọc; người rà soát mở trang thấy "Đợt rà soát đã hết hạn lúc {HH:mm dd/mm}. Không đổi được quyết định."

**VH-US-185 — Tiêu chí nghiệm thu**
- Cho trước đợt đang mở / Khi tôi (kiểm soát) mở trang đợt / Thì thấy tiến độ theo đơn vị và theo người rà soát, chỉ xem; không có nút mở đợt hay chỉ định.
- Cho trước đợt đã đóng / Khi bấm "Tải PDF" / Thì nhận biên bản gồm tổng Giữ, Gỡ, Quá hạn, tỉ lệ đúng hạn, danh sách quyền đã gỡ, người rà soát để quá hạn; bản PDF lưu kèm đợt, không sửa được; nhật ký ghi lần tải.

**VH-US-186 — Tiêu chí nghiệm thu**
- Cho trước ngày 01/07 / Khi đợt rà soát luật mở / Thì tôi có một dòng cho mỗi luật đang bật của app mình.
- Cho trước tôi không xử lý trong 14 ngày làm việc / Khi quá hạn / Thì quản trị hệ thống và kiểm soát được báo, luật vẫn bật.

## 13. VH-E-11 Tích hợp app

**Mục tiêu:** mọi app nhận định danh, hồ sơ và quyền từ VC Home theo một hợp đồng: token có claim chuẩn, API đọc danh bạ và cơ cấu, sự kiện có chữ ký, đăng xuất phía máy chủ; app không tự giữ cây tổ chức. **GĐ:** A–C. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-201 | Là đội app, tôi muốn token có bộ claim chuẩn theo giai đoạn (định danh ở A, hồ sơ ở B, vai trò app kèm đơn vị ở C) để app không phải gọi thêm lúc đăng nhập | M | A, B, C | VH-INT-01 | — |
| VH-US-202 | Là đội app, tôi muốn gọi API danh bạ và cơ cấu (nhân viên, chuỗi quản lý, cây đơn vị, danh mục) để bỏ cây tổ chức riêng của app | M | B | VH-INT-02 | — |
| VH-US-203 | Là đội app, tôi muốn có client máy riêng với scope hẹp để gọi API VC Home an toàn và bị thu hồi được | M | B | VH-INT-06 | VH-MH-15 |
| VH-US-204 | Là đội app, tôi muốn nhận sự kiện thay đổi (vào làm, chuyển, nghỉ, quyền, đơn vị) có chữ ký và được gửi lại khi lỗi để app tự cập nhật | M | C | VH-INT-03 | VH-MH-15 |
| VH-US-205 | Là đội app, tôi muốn kéo sự kiện từ một mốc khi bị gián đoạn để không mất thay đổi nào | S | C | VH-INT-05 | — |
| VH-US-206 | Là đội app, tôi muốn nhận thông báo đăng xuất phía máy chủ để thu hồi phiên của app khi người dùng đăng xuất hay bị khoá | M | A | VH-INT-04 | VH-MH-15 |
| VH-US-207 | Là quản trị hệ thống, tôi muốn ghi lại nhu cầu cấp tài khoản theo chuẩn SCIM cho app mua ngoài để xét ở lần sau | W | — | VH-INT-08 | — |
| VH-US-208 | Là chủ VClinks, tôi muốn nhận sự kiện báo trước khi HC-NS đặt ngày nghỉ việc hay chuyển vị trí để chuẩn bị bàn giao khách sớm | S | C | VH-INT-09 | — |
| VH-US-209 | Là chủ app, tôi muốn bấm "Gửi thử" khi khai URL nhận sự kiện để biết app nhận và kiểm chữ ký đúng | S | C | VH-INT-10 | VH-MH-15 |

**VH-US-201 — Tiêu chí nghiệm thu**
- Cho trước GĐ A / Khi đăng nhập / Thì `id_token` có 8 claim `sub`, `email`, `email_verified`, `name`, `picture`, `hd`, `groups`, `sid`.
- Cho trước GĐ B, người đã gắn hồ sơ / Khi đăng nhập / Thì token có thêm `employee_code`, `title`, `unit`, `division`, `legal_entity` theo vị trí chính; người chưa gắn hồ sơ thì không có các claim này (không để chuỗi rỗng).
- Cho trước GĐ C / Khi người có `nvkd` ở 2 tổ đăng nhập VClinks / Thì `resource_access.vclinks.roles` chứa `nvkd` đúng 1 lần, `vh_roles.vclinks` có 2 phần tử với 2 mã đơn vị; token của VCwiki không có phần của VClinks.
- Cho trước token không có vai trò nào của app / Khi người đó mở app / Thì app từ chối (mặc định chặn, VH-BR-20).

**VH-US-202 — Tiêu chí nghiệm thu**
- Cho trước app có token máy với scope `vh.people.read` / Khi gọi VH-API-02 lọc một đơn vị có cây con / Thì nhận danh sách nhân viên phân trang bằng con trỏ, mặc định 100, tối đa 500 mỗi trang.
- Cho trước app ở mức dữ liệu C0 / Khi gọi VH-API-01 / Thì không nhận trường C1 (quản lý, ngày vào, loại nhân viên, nơi làm việc, trạng thái).
- Cho trước gọi bằng token của người dùng / Khi gửi yêu cầu / Thì nhận 403 `not_service_token` "API này chỉ nhận token máy của app."

**VH-US-203 — Tiêu chí nghiệm thu**
- Cho trước quản trị đã khai client `vclinks-service` với scope `vh.people.read` trong cấu hình VC ID / Khi app xin token bằng `client_credentials` / Thì nhận token sống 5 phút; VH-MH-15 hiện client và scope đã gán.
- Cho trước app xin scope `vh.grants.read` chưa được gán / Khi xin token / Thì VC ID trả `invalid_scope`.
- Cho trước client bị tắt trong cấu hình / Khi app xin token mới / Thì bị từ chối; token cũ hết hiệu lực chậm nhất sau 5 phút.

**VH-US-204 — Tiêu chí nghiệm thu**
- Cho trước một người nghỉ việc có hiệu lực / Khi VC Home gửi `vh.person.left` / Thì app nhận trong ≤ 1 phút, kiểm được chữ ký `X-VH-Signature` (HMAC-SHA256 trên timestamp và thân).
- Cho trước app trả lỗi 500 / Khi VC Home gửi sự kiện / Thì sự kiện được gửi lại theo nhịp giãn dần trong tối đa 24 giờ và hiện ở "sự kiện gửi lỗi 24 giờ qua" trên VH-MH-15.
- Cho trước sự kiện `vh.grant.added` cho một vai trò VClinks / Khi gửi / Thì chỉ VClinks nhận, VCwiki không nhận.

**VH-US-205 — Tiêu chí nghiệm thu**
- Cho trước app ngừng nhận sự kiện 2 giờ / Khi gọi `GET /api/v1/events?after=<cursor>` với mốc cuối đã nhận / Thì nhận đủ sự kiện trong 2 giờ đó, đúng thứ tự, kèm `next_cursor`.
- Cho trước mốc đã quá 30 ngày / Khi gọi / Thì nhận 410 `cursor_expired` "Mốc đã quá 30 ngày. Hãy đồng bộ lại toàn bộ qua VH-API-02 và VH-API-06 rồi kéo từ mốc mới."

**VH-US-206 — Tiêu chí nghiệm thu**
- Cho trước người dùng đăng xuất ở VC Home / Khi VC ID gửi `logout_token` tới `POST /api/auth/backchannel-logout` của app / Thì app thu hồi phiên theo `sid` và trả 200; mọi app mất phiên trong ≤ 10 giây.
- Cho trước `logout_token` bị gửi lại với cùng `jti` / Khi app nhận / Thì app trả 400 và không làm gì thêm.
- Cho trước app chưa có endpoint đăng xuất phía máy chủ / Khi chuyển app sang "Đang chạy" / Thì bị chặn với câu "App chưa có endpoint đăng xuất phía máy chủ. Xem hợp đồng tích hợp (07)."

**VH-US-207 — Tiêu chí nghiệm thu**
- Cho trước giai đoạn A–E / Khi lập kế hoạch / Thì không làm SCIM; VH-INT-08 giữ ưu tiên W.
- Cho trước công ty mua một app ngoài có SCIM và trên 20 người dùng / Khi chủ dự án quyết làm / Thì lập yêu cầu và câu chuyện mới, không dùng lại mã này.

**VH-US-208 — Tiêu chí nghiệm thu**
- Cho trước ngày 10/11 HC-NS đặt ngày nghỉ 30/11 cho một NVKD / Khi lưu / Thì VClinks nhận `vh.person.change_scheduled` (`kind = nghi_viec`, `status = hen`) trong ≤ 1 phút.
- Cho trước HC-NS huỷ ngày nghỉ đó / Khi lưu / Thì VClinks nhận sự kiện `status = huy`, không có lý do nghỉ.

**VH-US-209 — Tiêu chí nghiệm thu**
- Cho trước app cấu hình đúng bí mật / Khi bấm "Gửi thử" / Thì màn hiện "Đã nhận (200) trong {n} giây".
- Cho trước app dùng sai bí mật / Khi bấm "Gửi thử" / Thì app trả 401 và màn hiện lỗi; số thứ tự sự kiện không tăng.

## 14. VH-E-12 Quản trị, nhật ký, báo cáo

**Mục tiêu:** mọi thay đổi có dấu vết không sửa được; lãnh đạo và kiểm soát có báo cáo; vai trò quản trị của chính VC Home có tách nhiệm; con số vận hành đặt ở một chỗ; sự cố được báo sớm. **GĐ:** A–D. **Thước đo:** xem mục 2.

| Mã | Là … tôi muốn … để … | Ưu tiên | GĐ | Yêu cầu | Màn hình |
|---|---|---|---|---|---|
| VH-US-221 | Là kiểm soát, tôi muốn lọc và tải nhật ký thao tác theo người, đối tượng, thời gian để trả lời kiểm toán | M | A, B | VH-ADM-01 | VH-MH-19, VH-MH-03, VH-MH-04 |
| VH-US-222 | Là Ban giám đốc, tôi muốn xem báo cáo tổng hợp số người, quyền theo app và kết quả rà soát để nắm tình hình mà không cần nhờ IT | S | C | VH-ADM-02 | VH-MH-17 (ngăn "Báo cáo") |
| VH-US-223 | Là quản trị hệ thống, tôi muốn vai trò quản trị của VC Home (HC-NS, quản trị hệ thống, kiểm soát, Ban giám đốc) được cấp như vai trò app và hệ thống chặn cặp xung đột để tách nhiệm | M | B | VH-ADM-03 | VH-MH-15, VH-MH-16, VH-MH-17 |
| VH-US-224 | Là quản trị hệ thống, tôi muốn bật ngoại lệ tách nhiệm có thời hạn khi thiếu người để vẫn vận hành mà kiểm soát được biết | M | C | VH-ADM-03 | VH-MH-17, VH-MH-20 |
| VH-US-225 | Là nhóm vận hành, tôi muốn nhận cảnh báo khi VC ID lỗi, đăng nhập lỗi nhiều, gửi sự kiện lỗi hay đồng bộ Google không chạy để xử lý trước khi người dùng phải báo | S | A | VH-ADM-04 | VH-MH-20 |
| VH-US-226 | Là quản trị hệ thống, tôi muốn đặt thời hạn, lịch nhắc, lịch rà soát trên màn Cài đặt để đổi con số mà không cần sửa code | S | D | VH-ADM-05 | VH-MH-20 |
| VH-US-227 | Là chủ app, tôi muốn được báo hằng tuần về người còn quyền ngoại lệ hoặc nhạy cảm mà 90 ngày không đăng nhập để gỡ kịp | S | D | VH-ADM-06 | VH-MH-17 |

**VH-US-221 — Tiêu chí nghiệm thu**
- Cho trước tôi lọc 30 ngày gần nhất, đối tượng "Quyền" / Khi xem bảng / Thì mỗi dòng có người làm, thời điểm, giá trị trước, giá trị sau, lý do; không có nút sửa hay xoá.
- Cho trước tôi bấm "Tải CSV" / Khi tải xong / Thì nhật ký có thêm một dòng ghi lần tải của tôi; quá 100.000 dòng thì báo "Mỗi lần tải tối đa 100.000 dòng. Hãy thu hẹp bộ lọc."
- Cho trước tôi là nhân viên thường / Khi mở "Hồ sơ của tôi" ngăn "Lịch sử" / Thì chỉ thấy nhật ký về chính mình; mở `/quan-tri/nhat-ky` thì thấy "Bạn không có quyền xem trang này."
- Cho trước tôi chọn ngày bắt đầu cách hôm nay hơn 24 tháng / Khi lọc / Thì báo "Nhật ký chỉ giữ 24 tháng."

**VH-US-222 — Tiêu chí nghiệm thu**
- Cho trước tôi có vai trò `vchome:bgd` / Khi bấm menu "Báo cáo" / Thì thấy số đếm theo app, vai trò, đơn vị và kết quả rà soát; không có danh sách tên và không có ngăn tra cứu.
- Cho trước tôi là trưởng đơn vị / Khi xem báo cáo / Thì số liệu chỉ tính trong đơn vị mình và đơn vị con.
- Cho trước kỳ đã chọn không có dữ liệu / Khi xem / Thì thấy "Không có dữ liệu trong kỳ đã chọn."

**VH-US-223 — Tiêu chí nghiệm thu**
- Cho trước GĐ B, danh sách người giữ 4 vai trò `vchome:*` khai trong cấu hình VC ID dạng code / Khi một người có `vchome:hcns` đăng nhập / Thì menu có nhóm "QUẢN TRỊ" với Nhân sự, Cơ cấu tổ chức, Danh mục, Nhập dữ liệu.
- Cho trước một người đã có `vchome:hcns` / Khi luật hoặc yêu cầu định cấp thêm `vchome:qtht` / Thì quyền đến sau không được tạo, quản trị và kiểm soát được báo "Không cấp được {vai trò}: {họ tên} đang giữ {vai trò khác}. Hai vai trò này không được giữ cùng lúc (VH-BR-17)."
- Cho trước thao tác sẽ làm hệ thống không còn quản trị hệ thống nào / Khi lưu / Thì báo "Không thực hiện được: hệ thống sẽ không còn quản trị hệ thống nào."

**VH-US-224 — Tiêu chí nghiệm thu**
- Cho trước một người buộc phải giữ cả HC-NS và quản trị hệ thống / Khi một quản trị hệ thống **khác** bật ngoại lệ 60 ngày kèm lý do ở VH-MH-17 / Thì người đó giữ được hai vai trò và kiểm soát nhận thông báo.
- Cho trước tôi bật ngoại lệ cho chính mình hoặc dài hơn 90 ngày / Khi lưu / Thì báo "Bạn không tự bật ngoại lệ tách nhiệm cho mình được." hoặc "Ngoại lệ tách nhiệm tối đa 90 ngày."
- Cho trước ngoại lệ hết hạn / Khi hệ thống chạy / Thì quyền đến sau bị gỡ với lý do "hết ngoại lệ tách nhiệm" và người đó được báo.

**VH-US-225 — Tiêu chí nghiệm thu**
- Cho trước VC ID không trả lời 2 lần kiểm liên tiếp (kiểm mỗi phút) / Khi hệ thống giám sát chạy / Thì nhóm Telegram và email vận hành nhận cảnh báo khẩn trong ≤ 5 phút; cùng cảnh báo không gửi lại trước 60 phút.
- Cho trước job đồng bộ Google không chạy quá 2 giờ / Khi kiểm / Thì có cảnh báo.
- Cho trước Telegram và email cùng lỗi / Khi có cảnh báo / Thì VH-MH-20 hiện băng đỏ "Không gửi được cảnh báo từ {HH:mm}. Kiểm tra kênh cảnh báo."

**VH-US-226 — Tiêu chí nghiệm thu**
- Cho trước tôi đổi "Hạn mặc định khi xin" từ 90 thành 180 ngày, có ghi lý do / Khi lưu / Thì ngăn xin quyền mặc định chọn 180 cho yêu cầu mới, nhật ký ghi trước 90, sau 180, kiểm soát được báo.
- Cho trước tôi nhập "Uỷ quyền tối đa" 45 ngày / Khi lưu / Thì báo "Uỷ quyền tối đa phải trong khoảng 1–30."
- Cho trước tôi sửa "Thời hạn đợt" rà soát / Khi lưu / Thì báo "Giá trị này do quy tắc VH-BR-16 đặt. Muốn đổi phải sửa quy tắc."
- Cho trước tôi lưu mà không ghi lý do / Khi bấm "Lưu" / Thì báo "Hãy ghi lý do đổi cài đặt."

**VH-US-227 — Tiêu chí nghiệm thu**
- Cho trước một người có `vclinks:admin` không đăng nhập VClinks 91 ngày / Khi job thứ Hai 08:00 chạy / Thì người đó có trong danh sách gửi tôi.
- Cho trước tôi chọn "Giữ thêm 90 ngày" / Khi tuần sau job chạy / Thì người đó không bị báo lại.

## 15. Độ phủ yêu cầu

Bảng dưới liệt kê **mọi** yêu cầu ở README mục 5 (90 mã, ưu tiên và giai đoạn lấy theo README hiện tại) và các câu chuyện phủ yêu cầu đó. Bảng sinh từ cột "Yêu cầu" của các bảng câu chuyện ở mục 3–14; sửa câu chuyện thì sinh lại bảng.

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
| VH-HOM-09 | Dải "Việc đang chờ bạn" trên trang chủ | C | D | VH-US-029 |
| VH-NSU-01 | Hồ sơ nhân sự | M | B | VH-US-041 |
| VH-NSU-02 | Vị trí công tác chính và kiêm nhiệm | M | B | VH-US-042 |
| VH-NSU-03 | Quản lý trực tiếp và cây quản lý | M | B | VH-US-043, VH-US-145 |
| VH-NSU-04 | Trạng thái làm việc có ngày hiệu lực | M | B | VH-US-044 |
| VH-NSU-05 | Lịch sử thay đổi hồ sơ | M | B | VH-US-045 |
| VH-NSU-06 | Hồ sơ của tôi và đề nghị sửa | M | B | VH-US-046, VH-US-047 |
| VH-NSU-07 | Danh bạ công ty | S | B | VH-US-048 |
| VH-NSU-08 | Che thông tin theo người xem | M | B | VH-US-049 |
| VH-NSU-09 | Nhân viên tự sửa tên gọi, ảnh, SĐT công việc | S | B | VH-US-050 |
| VH-ORG-01 | Cây đơn vị nhiều cấp | M | B | VH-US-061 |
| VH-ORG-02 | Danh mục chức danh | M | B | VH-US-062 |
| VH-ORG-03 | Danh mục chức năng | M | B | VH-US-062 |
| VH-ORG-04 | Trưởng đơn vị | M | B | VH-US-064 |
| VH-ORG-05 | Đổi cơ cấu có ngày hiệu lực (đổi tên, chuyển, gộp, ngừng) | S | C | VH-US-065, VH-US-066 |
| VH-ORG-06 | Sơ đồ tổ chức | S | B | VH-US-067 |
| VH-ORG-07 | Danh mục pháp nhân và nơi làm việc | S | B | VH-US-063 |
| VH-ORG-08 | Lịch ngày nghỉ của công ty (dừng đồng hồ của yêu cầu và rà soát) | S | D | VH-US-068 |
| VH-ORG-09 | Gộp mục trùng trong danh mục | S | B | VH-US-069 |
| VH-APP-01 | Danh mục app | M | A (tệp tĩnh), B (quản trị trên màn) | VH-US-101 |
| VH-APP-02 | Vai trò của từng app | M | C | VH-US-102 |
| VH-APP-03 | Chủ app | M | C | VH-US-103 |
| VH-APP-04 | Đưa app mới vào theo hợp đồng tích hợp | S | E | VH-US-106 |
| VH-APP-05 | Vai trò nhạy cảm | M | C | VH-US-104, VH-US-163 |
| VH-APP-06 | Thời gian chuyển tiếp khi chuyển vị trí, đặt riêng từng app | S | C | VH-US-105, VH-US-143 |
| VH-APP-07 | Vai trò app "cho phép xin" | S | D | VH-US-107 |
| VH-ACC-01 | Luật cấp quyền mặc định theo hồ sơ | M | C | VH-US-121, VH-US-123 |
| VH-ACC-02 | Tính lại quyền khi hồ sơ, cơ cấu hoặc luật đổi | M | C | VH-US-124 |
| VH-ACC-03 | Xem trước tác động của luật | M | C | VH-US-122, VH-US-123 |
| VH-ACC-04 | Cấp quyền khẩn cấp có lý do và hạn tối đa 7 ngày | S | C | VH-US-125 |
| VH-ACC-05 | Quyền có hạn dùng, tự gỡ khi hết hạn | M | D | VH-US-126 |
| VH-ACC-06 | Gỡ quyền | M | C | VH-US-127 |
| VH-ACC-07 | Đẩy quyền sang VC ID (nhóm, vai trò app) | M | C | VH-US-128 |
| VH-ACC-08 | Tra cứu "ai có quyền gì", "người này có quyền gì" | M | C | VH-US-129, VH-US-130 |
| VH-ACC-09 | Người giữ quyền tự trả quyền ngoại lệ | S | D | VH-US-131 |
| VH-REQ-01 | Gửi yêu cầu quyền | M | D | VH-US-161 |
| VH-REQ-02 | Luồng duyệt: quản lý trực tiếp, thêm chủ app nếu vai trò nhạy cảm | M | D | VH-US-162, VH-US-163, VH-US-164, VH-US-165 |
| VH-REQ-03 | Uỷ quyền duyệt khi vắng | S | D | VH-US-166 |
| VH-REQ-04 | Nhắc duyệt và tự huỷ yêu cầu quá hạn | S | D | VH-US-167 |
| VH-REQ-05 | Quản lý xin quyền thay cho người dưới quyền | C | D | VH-US-168 |
| VH-REQ-06 | Gia hạn quyền sắp hết hạn | S | D | VH-US-169 |
| VH-REQ-07 | Duyệt nhiều yêu cầu một lần (không áp cho vai trò nhạy cảm) | S | D | VH-US-170 |
| VH-REV-01 | Mở đợt rà soát định kỳ | S | D | VH-US-181, VH-US-183, VH-US-185 |
| VH-REV-02 | Trưởng đơn vị xác nhận hoặc gỡ | S | D | VH-US-182, VH-US-183 |
| VH-REV-03 | Tự gỡ quyền không được xác nhận và báo cáo kết quả | S | D | VH-US-184, VH-US-185 |
| VH-REV-04 | Rà soát luật nửa năm | S | D | VH-US-186 |
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
| VH-INT-09 | Sự kiện báo trước nghỉ việc, chuyển vị trí | S | C | VH-US-208 |
| VH-INT-10 | Sự kiện thử và nút "Gửi thử" | S | C | VH-US-209 |
| VH-ADM-01 | Nhật ký thao tác | M | A trở đi | VH-US-221 |
| VH-ADM-02 | Báo cáo truy cập | S | C | VH-US-222 |
| VH-ADM-03 | Vai trò quản trị của chính VC Home | M | B | VH-US-223, VH-US-224 |
| VH-ADM-04 | Cảnh báo vận hành | S | A | VH-US-225 |
| VH-ADM-05 | Cài đặt hệ thống (thời hạn, nhắc, lịch rà soát) | S | D | VH-US-226 |
| VH-ADM-06 | Cảnh báo quyền không dùng 90 ngày | S | D | VH-US-227 |
| VH-IMP-01 | Nhập nhân sự và cơ cấu từ Excel | M | B | VH-US-081, VH-US-082 |
| VH-IMP-02 | Đối chiếu với Google Workspace | M | B | VH-US-083 |
| VH-IMP-03 | Lấy dữ liệu khởi đầu từ cây tổ chức của VClinks và VCwiki | S | B | VH-US-084 |
| VH-IMP-04 | Đồng bộ tự động từ phần mềm nhân sự | C | E | VH-US-085 |
| VH-IMP-05 | Hoàn tác lô nhập trong 24 giờ | S | B | VH-US-086 |

**Kết quả kiểm:**
- 90 / 90 yêu cầu có ít nhất một câu chuyện (gồm 12 yêu cầu nhận thêm ngày 08/10/2026). **Không có yêu cầu nào thiếu câu chuyện.**
- 100 câu chuyện, mỗi câu chuyện có 2–4 tiêu chí nghiệm thu; không trùng mã; mọi mã nằm đúng dải của nhóm.
- Mọi mã yêu cầu dùng trong câu chuyện đều có trong README mục 5 (VH-US-101 dẫn thêm VH-API-08 ở README mục 10).

**Yêu cầu có nhiều câu chuyện** (vì có nhiều vai trò hoặc nhiều tình huống): VH-HOM-03 (023, 130), VH-NSU-03 (043, 145), VH-NSU-06 (046, 047), VH-ORG-05 (065, 066), VH-APP-05 (104, 163), VH-APP-06 (105, 143), VH-ACC-01 (121, 123), VH-ACC-03 (122, 123), VH-ACC-08 (129, 130), VH-REQ-02 (162, 163, 164, 165), VH-REV-01 (181, 183, 185), VH-REV-02 (182, 183), VH-REV-03 (184, 185), VH-LCM-02 (142, 143), VH-LCM-03 (144, 145), VH-ADM-03 (223, 224), VH-IMP-01 (081, 082).

## 16. Đề xuất bổ sung (chưa cấp mã)

**Đã xử lý ngày 08/10/2026** ([12](12-cau-hoi-rui-ro.md) mục 6): 1 → nhận (kiểm soát xem luật); 2 → VH-REV-04 (VH-US-186); 3 → VH-HOM-09 (VH-US-029); 4 → gộp VH-HOM-05; 5 → VH-ADM-06 (VH-US-227); 6 → để sau; 7 → VH-REQ-07 (VH-US-170).

Các câu chuyện dưới đây **chưa có mã yêu cầu** ở README mục 5 (hoặc 04 chưa ghi) nên chưa cấp mã VH-US. Nếu người duyệt đồng ý, cấp mã yêu cầu trước rồi đưa câu chuyện vào dải của nhóm tương ứng. Đề xuất đã có ở 04 mục 13 không lặp lại.

| # | Nhóm gợi ý | Câu chuyện đề xuất | Căn cứ |
|---|---|---|---|
| 1 | VH-E-07 | Là kiểm soát, tôi muốn xem danh sách luật và điều kiện (chỉ đọc) để kiểm vì sao một người có quyền | Ma trận 02 chưa cho kiểm soát xem luật; 06 mục 10 đề xuất 1 |
| 2 | VH-E-10 | Là quản trị hệ thống, tôi muốn rà soát luật nửa năm có mã yêu cầu riêng để đo và nghiệm thu được | Đang gộp ở 04 VH-REV-01 bước 10; 04 mục 13 đề xuất 33 còn mở |
| 3 | VH-E-02 | Là người duyệt, tôi muốn thấy dải "Bạn có {n} yêu cầu chờ duyệt." trên trang chủ để xử lý ngay khi mở VC Home | 06 mục 10 đề xuất 3 |
| 4 | VH-E-02 | Là nhân viên, tôi muốn thấy vai trò của mình trong thanh chuyển app để biết đang vào app với tư cách gì | 06 mục 10 đề xuất 4 |
| 5 | VH-E-12 | Là quản trị hệ thống, tôi muốn nhận cảnh báo chủ động về người không đăng nhập 90 ngày mà còn quyền để dọn tài khoản bỏ quên | 04 VH-ADM-02 mới có báo cáo "Không dùng" |
| 6 | VH-E-03 | Là nhân viên, tôi muốn báo HC-NS khi thấy thông tin của đồng nghiệp trên danh bạ bị sai | 04 VH-NSU-06 chỉ cho người đó tự báo |
| 7 | VH-E-09 | Là người duyệt, tôi muốn duyệt hàng loạt có trong 04 VH-REQ-02 (VH-US-165 hiện dựa trên bản giao việc) để kiểm thử có căn cứ | 06 mục 10 đề xuất 2 |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.4 | 08/10/2026 14:31 | Claude Code (vai BA trưởng, soát chéo) | VH-US-068 tiêu chí 1 theo D-BA-45 (Chủ nhật vẫn đếm) | Soát chéo kế hoạch code ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) D-BA-44…48 |
| 0.3 | 08/10/2026 13:49 | Claude Code (vai BA trưởng) | VH-US khoá theo Google: ≤ 20 phút | Đánh giá bảo mật luồng đăng nhập, người dùng đồng ý 6 điểm vá ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) D-BA-37…42 |
| 0.2 | 08/10/2026 11:30 | Claude Code (vai BA) | Thêm 12 câu chuyện cho 12 yêu cầu nhận thêm (VH-US-029, 050, 068, 069, 086, 107, 131, 170, 186, 208, 209, 227), mỗi câu chuyện 2–3 tiêu chí; thêm 12 dòng độ phủ (90/90); cập nhật phân bố; ghi kết quả xử lý mục 16. | Người dùng uỷ quyền chốt toàn bộ câu hỏi và đề xuất ngày 08/10/2026; 04 mục 14; 12 mục 4, 6 |
| 0.1 | 08/10/2026 11:14 | Claude Code (vai BA) | Tạo tài liệu: cách đọc, 12 nhóm câu chuyện có mục tiêu, giai đoạn, thước đo; 88 câu chuyện VH-US kèm tiêu chí "Cho trước / Khi / Thì" đồng bộ câu chữ với 04 và 06; bảng độ phủ 78/78 yêu cầu; 7 đề xuất chưa cấp mã | README bộ tài liệu 0.1 |
