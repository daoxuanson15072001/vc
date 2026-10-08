# Kịch bản UAT nhiều người thật: khởi tạo → việc hàng ngày → việc đột xuất

Phiên bản 0.1 · 05/10/2026 · Trạng thái: Nháp (chờ chủ dự án duyệt)

## Tóm tắt

- Kịch bản cho **một buổi 2 giờ 30 phút**, **5 người thật** đóng **11 vị trí** trên hệ thống thật (`:5173`, tài khoản thử của `pnpm seed:thu`), dùng **nick Zalo thật của chủ dự án** qua Chrome driver và chỉ gửi vào nhóm **"test nhom"**. Người đóng khách nhắn từ Zalo trên điện thoại của mình trong nhóm đó.
- Ba giai đoạn theo đúng thứ tự vận hành thật: **GĐ0 Khởi tạo** (cây tổ chức, thêm người và gán vai trò, gán nick cho sale, khách hàng và người phụ trách) → **GĐ1 Việc hàng ngày** (nhận tin, trả lời, tra hàng, phạm vi thấy của từng vai, báo cáo) → **GĐ2 Việc đột xuất** (xin quyền, vắng và trực thay, trả lời thay, mất kết nối, nghỉ việc và bàn giao nick).
- Mỗi người có **một phiếu vai** (mục 7), mỗi dòng ghi: bấm gì, thấy gì là đạt, đánh Đạt / Trượt, chụp màn hình khi khác mô tả. Người điều phối cầm **kịch bản tổng** (mục 3–6) để hô nhịp, vì bước của người này là bằng chứng cho người kia.
- **Phát hiện khi soạn:** bản hiện tại **chưa có nút "Thêm khách" và "Giao cho…"** (02 DK-62 còn chờ đặc tả). Khách sinh ra từ danh bạ của nick (người phụ trách = người giữ nick) hoặc từ nạp VCsales (người phụ trách theo VCsales). Bước "tạo khách và gắn cho sale" trong kịch bản làm theo cách hiện có và ghi rõ; cần chủ dự án quyết ở mục 9 Q1.
- Chữ khóa ô soạn ngoài danh sách thử vẫn ghi nhóm cũ "Kiểm thử vclink" dù driver đã chuyển sang "test nhom" (`packages/shared/src/health.ts`). Ghi sẵn là lỗi chữ L-01, sửa trước buổi thử.
- Việc chưa làm trong buổi này (để buổi sau): gửi báo giá thật, gợi ý AI (chờ khóa Claude API, E8), kênh OA và Fanpage, hóa đơn, chiến dịch.
- Kết thúc buổi: Admin **gán nick lại cho người giữ thật** rồi mới `pnpm seed:thu --remove`; biên bản và ảnh để trong thư mục này.
- Người duyệt xem kỹ: mục 2.3 (ai đóng vai gì), mục 4.4 (cách gắn khách cho sale hiện có) và mục 9 (5 câu hỏi).

## Mục lục

- [1. Mục đích, phạm vi, luật an toàn](#1-mục-đích-phạm-vi-luật-an-toàn)
- [2. Chuẩn bị trước buổi (người điều phối, 30 phút)](#2-chuẩn-bị-trước-buổi-người-điều-phối-30-phút)
- [3. Lịch buổi thử](#3-lịch-buổi-thử)
- [4. Giai đoạn 0: Khởi tạo hệ thống](#4-giai-đoạn-0-khởi-tạo-hệ-thống)
- [5. Giai đoạn 1: Công việc hàng ngày](#5-giai-đoạn-1-công-việc-hàng-ngày)
- [6. Giai đoạn 2: Việc đột xuất](#6-giai-đoạn-2-việc-đột-xuất)
- [7. Phiếu vai (mỗi người một trang)](#7-phiếu-vai-mỗi-người-một-trang)
- [8. Kết thúc buổi và biên bản](#8-kết-thúc-buổi-và-biên-bản)
- [9. Việc cần chủ dự án quyết](#9-việc-cần-chủ-dự-án-quyết)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Mục đích, phạm vi, luật an toàn

**Mục đích.** Cho người thật, không phải người viết code, thao tác đúng quy trình từ lúc hệ thống trống đến một ngày làm việc có sự cố, để trả lời ba câu: (1) người mới có tự làm theo hướng dẫn được không; (2) mỗi vai có thấy đúng phần của mình và **không** thấy phần của người khác không; (3) chỗ nào giao diện khác đặc tả.

**Phạm vi.** Phân hệ VC Zalo (đặc tả 03), phân quyền (01), khách đa kênh và Customer 360 (02), khung giao diện (00). Lấy các ca đang ghi "chờ thử tay" trong `docs/01-quan-ly-du-an/m1/so-phien.md` và các dòng CL-01…CL-33 của biên bản `docs/05-kiem-thu/uat/2026-10-04/m1b.md` còn chưa bấm. Ngoài phạm vi: Zalo OA, Fanpage, hóa đơn, chiến dịch, gợi ý AI chạy thật, gửi báo giá thật.

**Luật an toàn (đọc to trước buổi):**

1. VClinks chỉ gửi vào hội thoại chủ dự án đã chỉ định trên driver (hiện là nhóm "test nhom"). Ô soạn ở hội thoại khác bị khóa là **đúng chủ đích**, không phải lỗi. Không ai xin mở thêm hội thoại trong buổi.
2. Mỗi vai gửi **tối đa 3 tin** vào nhóm. Không gửi hàng loạt, không gửi ảnh hay file cá nhân.
3. Link đăng nhập trong `tools/seed/out/tai-khoan-thu.md` **không** gửi qua Zalo, email hay chụp màn hình. Người điều phối mở link cho từng người trên máy của họ, mỗi người **một cửa sổ ẩn danh riêng**.
4. Nick Zalo là của chủ dự án. Không ai đổi mật khẩu, không đăng xuất trên điện thoại, không bấm gì trong cửa sổ Chrome driver.
5. Thấy số điện thoại hay nội dung tin của khách thật trong lúc thử thì không chụp, không chép ra ngoài.

## 2. Chuẩn bị trước buổi (người điều phối, 30 phút)

### 2.1 Môi trường

| Bước | Lệnh hoặc việc | Dấu hiệu xong |
|---|---|---|
| 1 | API `:3000` và web `:5173` đang chạy trên máy chủ dự án | Mở `http://localhost:5173/login` thấy trang đăng nhập |
| 2 | Chrome driver đang chạy, nick đã quét QR | Trong Dashboard, chấm trên avatar nick màu xanh; trang **Đồng bộ** không có dòng đỏ |
| 3 | Kiểm tra danh sách gửi: `pnpm driver:config` (xem) | Có `onlyThreadIds` chứa `g615140573867383475` (nhóm "test nhom") |
| 4 | `pnpm seed:thu` | In ra 11 dòng, file `tools/seed/out/tai-khoan-thu.md` có 11 link. Link hết hạn sau 12 giờ không dùng |
| 5 | Sửa chữ khóa ô soạn (L-01, mục Tóm tắt) hoặc chấp nhận chữ cũ và ghi vào biên bản | Chủ dự án quyết |
| 6 | Trên Zalo điện thoại của chủ dự án: thêm Zalo cá nhân của **người đóng khách** (mục 2.3) vào nhóm "test nhom" | Người đó thấy nhóm trên điện thoại |
| 7 | In hoặc mở sẵn phiếu vai (mục 7) cho từng người | Mỗi người cầm một phiếu |

### 2.2 Dữ liệu có sẵn và dữ liệu sẽ sinh ra

- Tài khoản thử: 11 người tên bắt đầu bằng "Thử –", đơn vị `THU-*` (Tổ bán hàng thử A, Tổ bán hàng thử B, Nhóm CSKH thử, Nhóm marketing thử, Nhóm Sale admin thử, Nhóm kế toán thử, Nhóm thị trường thử). Giám sát bán hàng thử là quản lý của Tổ A. **Chưa ai giữ nick**: NVKD thử sẽ chỉ thấy khách sau bước gán nick ở GĐ0.
- Khách: danh bạ và hội thoại của nick thật đã đồng bộ về (gồm nhóm "test nhom"). VCsales đang là **bản mô phỏng** (chưa có API thật), nên khối Thương mại và Đối chiếu mã KH hiện số mô phỏng.
- Trong buổi sẽ sinh ra: 1 người dùng mới ("Thử – NVKD 3"), vài tin nhắn trong nhóm test, vài yêu cầu quyền tạm thời, 1 lần bàn giao nick. Mục 8 ghi cách dọn.

### 2.3 Phân vai: 5 người thật, 11 tài khoản

| Người | Đóng vai (tài khoản thử) | Thêm vai phụ | Cần gì |
|---|---|---|---|
| **P1 Điều phối** (chủ dự án) | Thử – Admin hệ thống | Cầm điện thoại có nick thật, để thử "Gửi từ điện thoại" | Máy tính + điện thoại |
| **P2** | Thử – Giám đốc bán hàng | Thử – Ban giám đốc / Kiểm soát (cửa sổ ẩn danh thứ 2) | Máy tính |
| **P3** | Thử – Giám sát bán hàng (Tổ A) | **Khách**: nhắn từ Zalo cá nhân của mình trong nhóm "test nhom" | Máy tính + điện thoại, đã vào nhóm |
| **P4** | Thử – Nhân viên kinh doanh 1 (Tổ A, **sẽ giữ nick**) | – | Máy tính |
| **P5** | Thử – Nhân viên kinh doanh 2 (Tổ B) | Thử – Nhân viên CSKH; lần lượt Sale admin, Kế toán, Marketing, NV thị trường cho các dòng "không được thấy" | Máy tính, 2 cửa sổ ẩn danh |

Thiếu người thì gộp: P2 kiêm P5. Không gộp P3 với P4, vì hai vai này phải thấy khác nhau cùng lúc.

## 3. Lịch buổi thử

| Giờ | Giai đoạn | Việc chính | Ai làm | Mục |
|---|---|---|---|---|
| 00:00 – 00:10 | Mở đầu | Đọc luật an toàn, phát phiếu, mọi người đăng nhập, chụp menu trái | Tất cả | 4.0 |
| 00:10 – 00:45 | GĐ0 | Cây tổ chức → thêm người, gán vai trò → gán nick → khách hàng và người phụ trách | P1, P2, P3, P4 | 4.1 – 4.5 |
| 00:45 – 01:30 | GĐ1 | Khách nhắn → sale trả lời, tra hàng, mẫu câu → giám sát theo dõi → các vai khác xem phạm vi → báo cáo | Tất cả | 5.1 – 5.9 |
| 01:30 – 02:15 | GĐ2 | Xin quyền ngoài phạm vi → trả lời thay → đăng ký vắng, trực thay → mất kết nối → nghỉ việc, bàn giao nick | Tất cả | 6.1 – 6.8 |
| 02:15 – 02:30 | Kết thúc | Thu phiếu, gán nick lại, dọn dữ liệu thử, chốt lỗi | P1 | 8 |

Nguyên tắc hô nhịp: người điều phối đọc số dòng (ví dụ "K-03"), người làm xong nói "xong", người phải thấy nói "thấy" hoặc "không thấy". Không ai làm trước dòng đang hô.

## 4. Giai đoạn 0: Khởi tạo hệ thống

Mục đích: dựng một tổ bán hàng từ trạng thái "có người, chưa có quyền dùng gì" lên "sale thấy khách của mình và gửi được tin". Đây là việc Admin và Giám đốc làm **một lần** khi đưa người mới vào.

### 4.0 Đăng nhập và nhìn menu trái (10 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| K-01 | Tất cả | Mở link của mình trong cửa sổ ẩn danh | Vào thẳng **Tin nhắn**, góc trên hiện tên "Thử – …" | UI-11 |
| K-02 | Tất cả | Nhìn menu trái, chụp màn hình | Admin: có nhóm QUẢN TRỊ (Kênh kết nối, Đồng bộ, Quản trị), **không** có Tin nhắn của ai. GĐ, GS: Tin nhắn, Lệnh gửi, Báo cáo, Khách hàng, Đối chiếu mã KH, Quản trị. NVKD: Tin nhắn, Lệnh gửi, Khách hàng, Danh bạ; **không** có Quản trị. CSKH: Hàng việc CSKH. Sale admin, Kế toán, Marketing: **không** có Tin nhắn | UI-01, UI-02, PQ-06 |
| K-03 | P5 (NVKD 2) | Gõ `/admin/audit` vào thanh địa chỉ | "Bạn không có quyền truy cập trang này" kèm nút "Về Hộp thư" | UI-38 |

### 4.1 Cây tổ chức (Admin, 5 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| K-04 | P1 Admin | Quản trị → tab **Cây tổ chức**. Mở nhánh Division VCparts | Thấy "Tổ bán hàng thử A" (Quản lý: Thử – Giám sát bán hàng), "Tổ bán hàng thử B" (Quản lý: Chưa có) và các nhóm thử | PQ-02 |
| K-05 | P1 Admin | **Thêm đơn vị**: Tên "Tổ bán hàng thử C", Loại "Tổ bán hàng", Thuộc "Division VCparts" → Lưu | "Đã thêm đơn vị Tổ bán hàng thử C." | PQ-01 |
| K-06 | P1 Admin | Thêm đơn vị khác: Loại "Tổ bán hàng", Thuộc "Nhóm CSKH thử" → Lưu | Không lưu được, lỗi dưới ô Thuộc: "Tổ bán hàng chỉ đặt dưới Division hoặc Tổ bán hàng." | PQ-01 |
| K-07 | P3 GS | Quản trị → Cây tổ chức | Chỉ thấy nhánh Tập đoàn → VCparts → Tổ bán hàng thử A. Không có nút Thêm đơn vị, Sửa, Ngừng | PQ-02 |

### 4.2 Thêm người và gán vai trò (Admin + GĐ, 10 phút)

Cách phân quyền trong VClinks: **quyền đi theo vai trò đặt tại một đơn vị** (ví dụ "NVKD tại Tổ bán hàng thử A"). Một người có thể có nhiều cặp vai trò + đơn vị. Không ai tự thêm quyền cho chính mình.

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| K-08 | P1 Admin | Quản trị → **Người dùng** → **Thêm người**: Họ tên "Thử – NVKD 3", Email công ty `thu-nvkd3@vcprosperous.com`, SĐT nội bộ để trống → Lưu | "Đã thêm người. Thêm vai trò ở tab "Vai trò & vị trí"." Người mới hiện trong danh sách, trạng thái chưa có vai trò | PQ-60 |
| K-09 | P1 Admin | Trong ngăn kéo của NVKD 3: Vai trò "Nhân viên kinh doanh", Đơn vị "Nhóm CSKH thử" → **Thêm vai trò** | Lỗi "Vai trò NVKD phải đặt ở Tổ bán hàng." và không lưu | PQ-07 |
| K-10 | P1 Admin | Đổi Đơn vị thành "Tổ bán hàng thử C" → Thêm vai trò | "Đã lưu. Quyền mới có hiệu lực trong vòng 1 phút." | PQ-07 |
| K-11 | P2 GĐ | Quản trị → Người dùng → tìm "NVKD 3" | Thấy người này (cùng division). Mở ngăn kéo: thêm được vai trò trong VCparts, **không** có nút xóa người | PQ-04, PQ-61 |
| K-12 | P2 GĐ | Tìm "Thử – Admin" | "Không có người dùng nào khớp bộ lọc" (Admin ở gốc Tập đoàn, ngoài division) | PQ-04 |
| K-13 | P1 Admin | Quản trị → **Nhập từ file** → chọn `docs/05-kiem-thu/du-lieu-mau/nguoi-dung-vcparts-60-dong-loi.csv` | Tóm tắt báo 4 lỗi đúng dòng; nút Nhập bị khóa, chưa ghi gì. Bấm Hủy | PQ-63 |
| K-14 | P2 GĐ | Quản trị → tab **Vai trò & quyền** | Ma trận quyền chỉ đọc, không có nút sửa | PQ-11 |
| K-15 | P1 Admin | Quản trị → Người dùng → mở "Thử – Giám sát bán hàng" → xem vai trò | Có "Giám sát bán hàng tại Tổ bán hàng thử A". Thử gạt **Trưởng nhóm** rồi gạt lại (không lưu) | PQ-08 |

### 4.3 Gán nick cho sale (Admin, 5 phút)

Đây là bước làm cho NVKD "có khách": trên kênh Zalo cá nhân, **đúng một người giữ nick** tại một thời điểm; mọi hội thoại trên nick vào "Của tôi" của người đó.

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| K-16 | P1 Admin | Quản trị → tab **Gán kênh** → dòng nick thật (kênh `zalo`), cột Người giữ | Hiện người giữ hiện tại (chủ dự án) hoặc "⚠ chưa gán". Chụp màn hình để cuối buổi **gán lại** | PQ-12 |
| K-17 | P1 Admin | Mở dòng nick → nút gán → Gán cho "Người", chọn "Thử – Nhân viên kinh doanh 1", Mức "Người giữ nick", Lý do "UAT 05/10 gán nick cho sale thử" → Lưu | Thông báo đã chuyển nick sang "Thử – Nhân viên kinh doanh 1". Mức chỉ có một lựa chọn "Người giữ nick" (kênh cá nhân không có "Trực & gửi", "Chỉ xem") | PQ-12, PQ-13 |
| K-18 | P1 Admin | Thử gán tiếp cùng nick cho "Thử – Nhân viên kinh doanh 2" | Hệ thống **đổi người giữ**, không cho hai người giữ cùng lúc (hoặc báo rõ). Ghi lại chữ hiện ra. Rồi gán lại cho NVKD 1 | PQ-17 |
| K-19 | P4 NVKD 1 | Bấm F5 ở Tin nhắn (chờ tối đa 60 giây) | Hộp thư **"Của tôi"** có các hội thoại của nick, trong đó có nhóm "test nhom". Chấm nick trên thanh bên màu xanh | PQ-13, SZ-12 |
| K-20 | P5 NVKD 2 | F5 ở Tin nhắn | Danh sách **trống** (Tổ B chưa có nick, chưa có khách) | PQ-15 |
| K-21 | P3 GS | F5 ở Tin nhắn, chọn phạm vi "Tất cả" | Thấy hội thoại của nick NVKD 1 (tổ A). Cột "Người phụ trách" ghi "Thử – Nhân viên kinh doanh 1" | PQ-19 |

### 4.4 Khách hàng và người phụ trách (GĐ + NVKD, 10 phút)

**Hiện trạng cần biết trước khi bấm.** Bản hiện tại không có nút "Thêm khách" hay "Giao cho…". Khách vào hệ thống bằng hai đường: (a) tự động từ **danh bạ và hội thoại của nick**: ai giữ nick là người phụ trách các khách đó; (b) **nạp từ VCsales** (trang Đối chiếu mã KH): người phụ trách lấy theo nhân viên phụ trách trên VCsales, hiện là số mô phỏng. Muốn "tạo khách mới rồi gắn cho sale" như anh mô tả thì phải làm màn "Thêm khách / Giao cho" (02 DK-62, đang chờ đặc tả). Kịch bản này thử đúng hai đường đang có; câu hỏi làm thêm màn ở mục 9 Q1.

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| K-22 | P4 NVKD 1 | **Khách hàng** → gõ "test" vào ô Tìm theo tên khách | Thấy khách sinh từ danh bạ nick (ví dụ "test that", nhóm "test nhom"). Mở một khách | DK-13 |
| K-23 | P4 NVKD 1 | Trang Customer 360 → tab **Danh tính & kênh** | Có dòng kênh Zalo, nick giữ bởi NVKD 1. Số điện thoại (nếu có) hiện **đầy đủ**, không có nút "Hiện" vì mình là người phụ trách | DK-44, PQ-25 |
| K-24 | P3 GS | Mở cùng khách đó (dán cùng đường dẫn) | Thấy hồ sơ; số điện thoại dạng "0900 *** 101" kèm nút **Hiện**; bấm thì hiện, khoảng 60 giây tự ẩn | PQ-26, DK-13 |
| K-25 | P2 GĐ | Menu **Đối chiếu mã KH** | Có dải "Dữ liệu VCsales hiện là bản mô phỏng…". Có danh sách gợi ý và điểm; GĐ có nút xác nhận liên kết (nếu đã có quyền `cust.erp_link`) hoặc không, **ghi lại** | DK-87 |
| K-26 | P2 GĐ | Chọn 1 khách gợi ý có điểm cao → xác nhận "Liên kết n khách với mã KH đã gợi ý?" | Sau liên kết, mở khách → tab **Thương mại** có mã KH, số mô phỏng ghi rõ là dữ liệu cũ khi VCsales tắt | DK-16, DK-73 |
| K-27 | P5 NVKD 2 | Dán đường dẫn Customer 360 của khách ở K-22 | "Không tìm thấy hoặc bạn không có quyền xem", có nút **Xin quyền truy cập** (chưa bấm, để GĐ2) | UI-39, PQ-16 |
| K-28 | P5 (cửa sổ Sale admin) | Khách hàng → mở cùng khách | Xem được hồ sơ (sale admin quản hồ sơ) nhưng **không** có Tin nhắn trong menu, tab Dòng thời gian báo không có quyền xem nội dung | PQ-20, PQ-56 |

### 4.5 Chốt GĐ0

Người điều phối hỏi từng người: "Vai của anh/chị thấy gì, không thấy gì?" và đối chiếu với bảng K-02. Mọi dòng K đạt thì sang GĐ1. Có dòng trượt mà chặn GĐ1 (ví dụ K-19 không thấy hội thoại) thì dừng, ghi lỗi, không cố làm tiếp.

## 5. Giai đoạn 1: Công việc hàng ngày

Theo "Một ngày làm việc của sale" trong đặc tả 03 §2, rút gọn còn một vòng: khách nhắn → sale xử lý → giám sát theo dõi → các vai khác nhìn phần của mình → báo cáo.

### 5.1 Sáng: sale mở ca (NVKD 1, 5 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| H-01 | P4 | Nhìn chấm trên avatar nick; bấm vào | Chấm xanh; popover ghi nick kết nối, giờ đồng bộ gần nhất | SZ-12 |
| H-02 | P4 | Tin nhắn → bấm lọc **Chưa trả lời** | Danh sách chỉ còn hội thoại khách nhắn mà nick chưa trả lời; chip SLA (⏰ số phút) trên hội thoại chờ lâu | SZ-21, SZ-87 |
| H-03 | P4 | Bấm **Đồng bộ** (nếu thấy trên menu) hoặc nhờ P1 mở `/sync` | Mỗi stream (danh bạ, nhóm, hội thoại, tin) có số bản ghi gốc và số trong DB, không lệch quá vài đơn vị | UAT-SZ-59 |

### 5.2 Khách nhắn, sale trả lời (Khách = P3 trên điện thoại, 10 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| H-04 | P3 (điện thoại) | Trong nhóm "test nhom" nhắn: "Cho hỏi giá lọc gió Vios 2019, có sẵn không?" | – | – |
| H-05 | P4 | Nhìn Tin nhắn, **không** bấm F5 | Trong ≤ 1 phút nhóm "test nhom" nổi lên đầu, có badge chưa đọc; có thông báo nổi hoặc tiếng (nếu đã cho phép trình duyệt) | SZ-15, UI-03 |
| H-06 | P4 | Mở hội thoại. Nếu tin ghi "Đang chờ nội dung" thì bấm **Lấy nội dung** | Hiện hộp xác nhận "Khách sẽ thấy Đã xem…" → đồng ý → nội dung hiện ra trong vài giây; P3 thấy "Đã xem" trên điện thoại | SZ-15 |
| H-07 | P4 | Ô soạn: gõ `/` → chọn mẫu câu chào (hoặc mở **Tin nhắn nhanh** tạo mẫu `/chao` "Chào anh/chị, em là … VCparts") | Mẫu chèn vào ô soạn, sửa được trước khi gửi | MH-SZ-05e |
| H-08 | P4 | Panel phải (Alt+P) → tab **Tra hàng** → gõ "lọc gió" → **Chèn vào tin** | Dòng giá và tồn (mô phỏng) chèn vào ô soạn; gõ thêm "Giá trên đã gồm VAT ạ" → **Gửi** | KD-04, KD-06 |
| H-09 | P4 | Nhìn bong bóng tin vừa gửi | Trạng thái chạy: Đang chờ gửi → Đang gửi → Đã gửi (có thể tới Đã nhận, Đã xem). P3 nhận tin trên điện thoại trong ≤ 15 giây | SZ-24 |
| H-10 | P4 | Bấm biểu tượng **Lệnh gửi** trên đầu khung chat | Danh sách lệnh của hội thoại này có đúng 1 dòng Đã gửi | MH-SZ-13 |
| H-11 | P3 (điện thoại) | Nhắn tiếp: "Gửi em số tài khoản công ty" | – | – |
| H-12 | P4 | Thanh công cụ ô soạn → **Gửi nhanh số tài khoản** → chọn → Gửi | Tin số tài khoản gửi đi; P3 nhận. Đây là tin thứ 2 của NVKD 1 (giới hạn 3) | MH-SZ-05f |
| H-13 | P4 | Chuột phải lên tin "Cho hỏi giá…" → **Tạo nhắc việc từ tin này**, hẹn 10 phút sau → Tạo nhắc việc | Có thông báo khi tới giờ (xem ở mục 5.6) | F9.8 |

### 5.3 Chủ dự án trả lời từ điện thoại (P1, 3 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| H-14 | P1 (điện thoại có nick) | Trong nhóm "test nhom" gõ từ **app Zalo**: "Em gửi báo giá chi tiết sau 30 phút nhé" | – | – |
| H-15 | P4 | Nhìn khung chat | Trong ≤ 1 phút tin hiện bên phải (tin của nick) với nhãn nhỏ **Gửi từ điện thoại**; hội thoại rời khỏi lọc Chưa trả lời | SZ-21, SZ-22, M1a-08 |

### 5.4 Giám sát theo dõi tổ (P3 trên máy tính, 7 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| H-16 | P3 GS | Tin nhắn → phạm vi **Tất cả** | Dải tóm tắt: Chưa trả lời n · Quá SLA n · Lệnh lỗi n. Cột Người phụ trách ghi NVKD 1 | MH-SZ-01 #4b |
| H-17 | P3 GS | Mở nhóm "test nhom" | Đọc được toàn bộ, kể cả tin Gửi từ điện thoại. **Không** có nút Lấy nội dung tự chạy; nếu có tin "Đang chờ nội dung", nút hỏi xác nhận "Khách sẽ thấy Đã xem và NVKD 1 sẽ mất badge…" → bấm **Hủy** | SZ-23 |
| H-18 | P3 GS | Nhìn ô soạn | Có **dải vàng** "Trả lời thay Thử – Nhân viên kinh doanh 1" kèm link "Tạo trực thay…". Chưa gửi gì | MH-SZ-05 #0b |
| H-19 | P3 GS | Menu **Lệnh gửi** → tab Tổ của tôi | Thấy lệnh của NVKD 1 với cột người gửi và trạng thái | SZ-24 |
| H-20 | P3 GS | Chuột phải hội thoại "test nhom" → **Đánh dấu đã đọc** | Hộp hỏi "Khách sẽ thấy Đã xem và người giữ nick sẽ mất badge chưa đọc. Vẫn đánh dấu?" → **Hủy** | SZ-23 |

### 5.5 Các vai khác nhìn phần của mình (P2, P5, 8 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| H-21 | P2 GĐ | Tin nhắn → Tất cả → lọc **Người phụ trách** = NVKD 1 | Thấy hội thoại của nick. Mở được, đọc được, ô soạn có dải vàng trả lời thay | PQ-19 |
| H-22 | P2 (cửa sổ Ban giám đốc) | Tin nhắn → mở "test nhom" | Đọc được. **Không có ô soạn**, không có nút gửi. Quản trị chỉ còn tab "Thay đổi vai trò chờ duyệt" | PQ-37, PQ-39 |
| H-23 | P5 NVKD 2 | Tin nhắn | Vẫn trống. Ctrl+K gõ "test nhom" → không mở được hội thoại của tổ A | PQ-15, UI-29 |
| H-24 | P5 (cửa sổ CSKH) | Menu | Có **Hàng việc CSKH**; không có Tin nhắn của nick bán hàng | PQ-56 |
| H-25 | P5 (lần lượt Sale admin, Kế toán, Marketing, NV thị trường) | Đăng nhập, nhìn menu, thử dán đường dẫn hội thoại "test nhom" | Không có Tin nhắn; dán đường dẫn → "Không tìm thấy hoặc bạn không có quyền xem". Chụp 4 màn | PQ-20, PQ-21 |

### 5.6 Chuyển việc cho CSKH (P4 + P5, 5 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| H-26 | P3 (điện thoại) | Nhắn: "Lọc gió mua tháng trước bị rách mép, bảo hành thế nào?" | – | – |
| H-27 | P4 | Chuột phải tin đó → **Chuyển hậu mãi cho CSKH** → Loại "Bảo hành", ghi chú → **Tạo phiếu** | Thông báo đã tạo phiếu; trên khung chat có chip phiếu | QT-SZ-13 |
| H-28 | P5 (CSKH) | **Hàng việc CSKH** → tab Hậu mãi | Thấy phiếu vừa tạo, có tên khách, nội dung tin, người chuyển NVKD 1 | M1c-03 |
| H-29 | P4 | Khi tới giờ nhắc ở H-13 | Thông báo nhắc việc hiện (chuông hoặc trang Thông báo) | F9.8 |

### 5.7 Tìm kiếm và dọn hộp thư (P4, 4 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| H-30 | P4 | Menu tìm kiếm (`/search`) → gõ "lọc gió" | Ra tin của hôm nay, bấm vào mở đúng chỗ trong hội thoại, từ khóa tô sáng | KD-15, M1c-05 |
| H-31 | P4 | Chuột phải "test nhom" → **Ghim hội thoại**; rồi **Đánh dấu chưa đọc** | Lệnh gửi cho extension, vài giây sau biểu tượng ghim và badge hiện; bỏ ghim lại | QT-SZ-08 |

### 5.8 Báo cáo (P2, P4, 4 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| H-32 | P2 GĐ | **Báo cáo** → Tổng quan, kỳ "Hôm nay" | Ô Lượt chờ, Phản hồi (FRT), % quá SLA, % trả lời qua VClinks có số (ít nhất 1 lượt từ H-04 → H-08). Tab **Hiệu suất** có dòng Tổ A, NVKD 1 | M1c-09 |
| H-33 | P4 NVKD 1 | Báo cáo | Chỉ có "Dashboard của tôi", không có tab Hiệu suất của người khác | PQ-38 |
| H-34 | P3 GS | Báo cáo → Hiệu suất → bấm số Lượt chờ | Ngăn kéo liệt kê lượt, mở được hội thoại | M1c-09 |

### 5.9 Chốt GĐ1

Đếm: NVKD 1 đã gửi 2 tin (H-08, H-12), chủ dự án 1 tin từ điện thoại. Còn 1 lượt gửi của NVKD 1 để dành cho GĐ2 (trực thay dùng người khác gửi).

## 6. Giai đoạn 2: Việc đột xuất

Mỗi tình huống ghi: **chuyện gì xảy ra ngoài đời** → ai làm gì trên VClinks → người khác thấy gì.

### 6.1 Sale tổ khác cần xem một khách (P5, P3, 6 phút)

*Ngoài đời:* khách của tổ A gọi điện cho NVKD 2 ở tổ B hỏi lại giá; NVKD 2 muốn xem hội thoại cũ.

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| D-01 | P5 NVKD 2 | Dán đường dẫn hội thoại "test nhom" → **Xin quyền truy cập** → để trống lý do → Gửi | Bị chặn vì thiếu lý do | UI-40 |
| D-02 | P5 NVKD 2 | Nhập lý do "Khách gọi hỏi lại giá lọc gió, cần xem báo giá cũ" → quyền "Xem", thời hạn 4 giờ → Gửi | "Đã gửi yêu cầu", người duyệt là **Thử – Giám sát bán hàng** (quản lý Tổ A) | PQ-30 |
| D-03 | P3 GS | Quản trị → **Quyền tạm thời** → dòng của NVKD 2 → **Duyệt**; rút thời hạn còn 1 giờ | Duyệt được, không kéo dài hơn mức xin. NVKD 1 nhận một dòng thông báo "…được cấp quyền xem hội thoại của bạn" | PQ-31, PQ-85 |
| D-04 | P5 NVKD 2 | F5 hội thoại (chờ ≤ 60 giây) | Đọc được. **Không có ô soạn** (chỉ Xem). Số điện thoại vẫn che | PQ-32 |
| D-05 | P3 GS | Quyền tạm thời → dòng đó → **Thu hồi** | Trong ≤ 60 giây NVKD 2 mất quyền, F5 thấy lại "Không tìm thấy hoặc bạn không có quyền xem" | PQ-35 |
| D-06 | P5 (cửa sổ Sale admin) | Quản trị → Quyền tạm thời → **Xin quyền theo SĐT / mã KH** → chọn hội thoại "test nhom", lý do ≥ 10 ký tự | Chỉ chọn được quyền "Xem", thời hạn tối đa 3 ngày, người duyệt là **Giám đốc bán hàng** | PQ-32 |
| D-07 | P2 GĐ | Quyền tạm thời → Duyệt yêu cầu của Sale admin; rồi **Thu hồi** | Sale admin đọc được nội dung chat trong lúc có quyền; sau thu hồi mất | PQ-32 |

### 6.2 Giám sát trả lời thay một tin gấp (P3, 3 phút)

*Ngoài đời:* NVKD 1 đang lái xe, khách hỏi gấp.

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| D-08 | P3 (điện thoại) | Nhắn: "Anh ơi 30 phút rồi, báo giá đâu?" | – | – |
| D-09 | P3 GS (máy tính) | Mở "test nhom", ô soạn có dải vàng → gõ "Dạ anh chờ em 10 phút, NVKD 1 đang gửi" → Gửi | Hộp xác nhận **"Trả lời thay Thử – Nhân viên kinh doanh 1?"** hiện đúng nội dung → Đồng ý. Bong bóng ghi "Gửi bởi Thử – Giám sát bán hàng (trả lời thay …)". P3 nhận tin trên điện thoại | SZ-25, QT-SZ-10 |
| D-10 | P4 NVKD 1 | Nhìn khung chat và thông báo | Thấy tin của GS trong hội thoại của mình, có ghi người gửi thật | SZ-22 |

### 6.3 Sale nghỉ nửa ngày: đăng ký vắng và trực thay (P4, P3, P5, 8 phút)

*Ngoài đời:* NVKD 1 ốm, nghỉ từ trưa. Khách không đổi người phụ trách; NVKD 2 trực nick tới hết ngày.

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| D-11 | P4 NVKD 1 | Quản trị không có; vào `/me` → **Yêu cầu quyền của tôi** (hoặc Quản trị → Quyền tạm thời nếu thấy) → **Đăng ký vắng**: Từ bây giờ – Đến cuối ngày, Lý do "Ốm, về nghỉ", Đề xuất người trực "Thử – Nhân viên kinh doanh 2" → Gửi | "Đã gửi đăng ký vắng", chờ GS | PQ-99 |
| D-12 | P3 GS | Quyền tạm thời → dòng "Đăng ký vắng" của NVKD 1 → **Đồng ý** → chọn "Trực nick" = NVKD 2 → Lưu | "Đã giao Thử – Nhân viên kinh doanh 2 trực thay Thử – Nhân viên kinh doanh 1 từ … đến …". NVKD 1 nhận thông báo | PQ-32, SZ-54 |
| D-13 | P5 NVKD 2 | F5 Tin nhắn (≤ 60 giây) | "Của tôi" có hội thoại của nick NVKD 1; ô soạn ghi rõ đang trực thay | PQ-32 |
| D-14 | P5 NVKD 2 | Gõ "Em là NVKD 2 trực thay, báo giá lọc gió 350.000đ có VAT ạ" → Gửi | Gửi được; bong bóng ghi "Gửi bởi Thử – Nhân viên kinh doanh 2 (trực thay …)"; P3 nhận trên điện thoại. **Tin này thay lượt gửi thứ 3 của nick** | SZ-22 |
| D-15 | P4 NVKD 1 | `/me` → Trạng thái → **Nghỉ phép** hiện; thử đổi sang "Đi thị trường" có hẹn giờ | Trạng thái hiện đúng; cờ Nghỉ phép có trong hồ sơ | PQ-97 |
| D-16 | P3 GS | Quyền tạm thời → dòng trực thay → **Kết thúc sớm** | NVKD 2 mất hội thoại trong ≤ 60 giây; NVKD 1 vẫn là người phụ trách, mọi khách còn ở "Của tôi" của NVKD 1 | PQ-32 |

### 6.4 Mất kết nối (P1, P4, 5 phút)

*Ngoài đời:* mạng công ty chập chờn; máy chủ API khởi động lại.

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| D-17 | P4 | Ngắt wifi máy mình, F5 một trang | "Không có kết nối mạng". Bật lại, trang tự hồi hoặc bấm Thử lại | UI-121 |
| D-18 | P1 | Tắt cửa sổ API 30 giây (báo trước cho mọi người). P4 mở `/sync` | "Có lỗi xảy ra" khi API tắt; bật lại API, bấm **Thử lại** hết lỗi; mọi người **không** phải đăng nhập lại | UI-42 |
| D-19 | P1 (tùy chọn, hỏi chủ dự án) | Tắt Chrome driver 1 phút. P4 nhìn chấm nick và ô soạn | Chấm chuyển đỏ; ô soạn báo nick mất kết nối, có nút **Sao chép nội dung**. Bật lại driver, chấm xanh trong ≤ 1 phút | SZ-12, MH-SZ-05 nick đỏ |
| D-20 | P4 | Mở một hội thoại **không** phải "test nhom" (ví dụ "test that" nếu chưa được thêm vào danh sách gửi) | Ô soạn khóa, chữ: "Giai đoạn thử: VClinks chỉ gửi vào nhóm …". Đây là chủ đích. Ghi nhận chữ còn ghi tên nhóm cũ (L-01) | §4.1 CLAUDE.md |

### 6.5 Khách nhắn nội dung rủi ro (P3, P4, 2 phút)

*Ngoài đời:* có người trong nhóm nhắn "Chuyển gấp 5 triệu vào số tài khoản này để giữ hàng".

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| D-21 | P3 (điện thoại) | Nhắn câu trên | – | – |
| D-22 | P4 | **Không** trả lời theo yêu cầu. Chuột phải tin → **Tạo nhắc việc** ghi "Báo GS: tin yêu cầu chuyển khoản"; nói với GS | Quy trình: sale không tự xử lý tin chuyển tiền, OTP, đổi tài khoản. Gợi ý AI (khi bật) sẽ gắn cờ rủi ro và không soạn nháp | §8 CLAUDE.md |

### 6.6 Nhật ký và kiểm soát (P3, P4, P2, 4 phút)

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| D-23 | P3 GS | Quản trị → **Nhật ký truy cập** → tra theo tên NVKD 1 | Thấy các lượt xem hội thoại, xem hồ sơ khách của NVKD 1, không có nội dung tin và số điện thoại đầy đủ | PQ-86 |
| D-24 | P4 NVKD 1 | `/me` → **Hoạt động của tôi** | Có dòng "Giám sát Thử – Giám sát bán hàng đã xem nhật ký của bạn" | PQ-28 |
| D-25 | P2 (Ban giám đốc) | Quản trị → Nhật ký truy cập; → **Cảnh báo** | Đọc được toàn tập đoàn; tab Cảnh báo có hoặc không có dòng (ghi lại), không có nút sửa | BGD-02 |

### 6.7 Nhân viên nghỉ việc: khóa và bàn giao nick (P2, P1, 8 phút)

*Ngoài đời:* NVKD 1 nghỉ việc. Phải khóa tài khoản VClinks, chuyển khách và nick cho NVKD 2, và **thu nick trên điện thoại** (ở đây điện thoại là của chủ dự án nên chỉ "xác nhận" trên giấy).

| Dòng | Ai | Bấm gì | Thấy gì là đạt | Ca |
|---|---|---|---|---|
| D-26 | P2 GĐ | Quản trị → Người dùng → mở "Thử – Nhân viên kinh doanh 1" → **Nghỉ việc…** | Trang bàn giao: bước 1 có nút **Khóa ngay** (lý do ≥ 5 ký tự), hiện số khách, hội thoại đang mở, hạn bàn giao | PQ-42 |
| D-27 | P2 GĐ | Khóa ngay → bước 2: chọn người nhận khách "Thử – Nhân viên kinh doanh 2" → **Xem trước** → Tiếp tục → chọn người giữ nick mới = NVKD 2 → Tiếp tục → **Hoàn tất bàn giao** | "Đã bàn giao … cho Thử – Nhân viên kinh doanh 2". Tóm tắt ghi số lệnh gửi chuyển "Cần duyệt lại" và nick **"Chưa an toàn"** | PQ-67, PQ-68, PQ-95 |
| D-28 | P4 NVKD 1 | F5 | Bị đưa về trang đăng nhập, không vào lại được | PQ-42 |
| D-29 | P5 NVKD 2 | F5 Tin nhắn | Thấy khách cũ của NVKD 1. Ô soạn **không gửi được** vì nick "Chưa an toàn", có chữ nhắc xác nhận đăng xuất | PQ-51 |
| D-30 | P1 Admin | Quản trị → Gán kênh → dòng nick → **Xác nhận đã đăng xuất** (chỉ bấm vì đây là nick của chính chủ dự án) | Tag "Chưa an toàn" biến mất; NVKD 2 gửi được (không gửi thêm, đã đủ 3 tin) | PQ-51 |
| D-31 | P2 GĐ | Quản trị → tab **Thay đổi vai trò chờ duyệt** | Không có hoặc có yêu cầu từ các bước trước; duyệt / từ chối thử một dòng nếu có | PQ-09 |

### 6.8 Chốt GĐ2

Người điều phối hỏi: "Có dòng nào thấy khác chữ trong phiếu?" Gom ảnh chụp theo mã dòng (ví dụ `D-09.png`).

## 7. Phiếu vai (mỗi người một trang)

In từng bảng dưới đây cho người tương ứng. Cột **Kết quả** đánh Đ (đạt) / T (trượt) / B (bỏ, ghi lý do). Thấy khác mô tả thì chụp màn hình đặt tên theo mã dòng.

### 7.1 P1 · Điều phối + Admin hệ thống

Link: dòng "Admin hệ thống" trong `tai-khoan-thu.md`. Điện thoại có nick thật.

| Dòng | Việc của anh | Phải thấy | Kết quả |
|---|---|---|---|
| K-01, K-02 | Đăng nhập, chụp menu | Nhóm QUẢN TRỊ, không có Tin nhắn | |
| K-04 – K-06 | Cây tổ chức: xem; thêm "Tổ bán hàng thử C"; thêm sai chỗ | Lưu được / lỗi "Tổ bán hàng chỉ đặt dưới Division hoặc Tổ bán hàng." | |
| K-08 – K-10 | Thêm "Thử – NVKD 3"; gán sai → gán đúng Tổ C | Lỗi "Vai trò NVKD phải đặt ở Tổ bán hàng." rồi "Đã lưu…" | |
| K-13 | Nhập từ file CSV 60 dòng lỗi | 4 lỗi đúng dòng, nút Nhập khóa | |
| K-15 | Xem vai trò của GS, gạt Trưởng nhóm thử | Có vai trò GS tại Tổ A | |
| K-16 – K-18 | Gán kênh: chụp người giữ cũ; gán nick cho NVKD 1; thử gán NVKD 2 | Thông báo chuyển nick; không hai người giữ | |
| H-14 | Từ điện thoại gửi 1 tin trong "test nhom" | NVKD 1 thấy nhãn "Gửi từ điện thoại" | |
| D-18, D-19 | Tắt API 30 giây; (tùy) tắt driver 1 phút | Màn lỗi rồi hồi; chấm nick đỏ rồi xanh | |
| D-30 | Gán kênh → Xác nhận đã đăng xuất | Hết tag "Chưa an toàn" | |
| Kết | Gán nick lại cho người giữ thật; `pnpm seed:thu --remove` | Mục 8 | |

### 7.2 P2 · Giám đốc bán hàng (+ Ban giám đốc ở cửa sổ 2)

| Dòng | Việc của anh | Phải thấy | Kết quả |
|---|---|---|---|
| K-01, K-02 | Đăng nhập 2 cửa sổ, chụp menu | GĐ: đủ Tin nhắn, Báo cáo, Quản trị. BGĐ: chỉ đọc | |
| K-11, K-12 | Người dùng: tìm "NVKD 3"; tìm "Thử – Admin" | Thấy NVKD 3; Admin không khớp bộ lọc | |
| K-14 | Vai trò & quyền | Chỉ đọc | |
| K-25, K-26 | Đối chiếu mã KH; liên kết 1 khách | Dải "bản mô phỏng"; tab Thương mại có mã KH | |
| H-21, H-22 | Tin nhắn lọc Người phụ trách; BGĐ mở hội thoại | GĐ có dải vàng; BGĐ không có ô soạn | |
| H-32 | Báo cáo Tổng quan, Hiệu suất | Có số của hôm nay | |
| D-06, D-07 | Duyệt rồi thu hồi yêu cầu của Sale admin | Sale admin đọc được rồi mất | |
| D-25 | BGĐ: Nhật ký, Cảnh báo | Đọc toàn tập đoàn | |
| D-26, D-27 | Nghỉ việc NVKD 1 → Khóa ngay → bàn giao khách và nick cho NVKD 2 | "Đã bàn giao…", nick "Chưa an toàn" | |
| D-31 | Thay đổi vai trò chờ duyệt | Xem, duyệt thử | |

### 7.3 P3 · Giám sát bán hàng Tổ A (+ Khách trên điện thoại)

| Dòng | Việc của anh/chị | Phải thấy | Kết quả |
|---|---|---|---|
| K-01, K-02, K-07 | Đăng nhập; Cây tổ chức | Chỉ nhánh Tổ A, không có nút sửa | |
| K-21 | Tin nhắn → Tất cả | Hội thoại của nick NVKD 1 | |
| K-24 | Mở khách của NVKD 1 | SĐT che "*** ", nút Hiện, 60 giây tự ẩn | |
| H-04, H-11, H-26, D-08, D-21 | **Điện thoại**: 5 tin khách theo đúng câu trong kịch bản | NVKD 1 nhận trong ≤ 1 phút | |
| H-16 – H-20 | Tất cả; mở hội thoại không Lấy nội dung; dải vàng; Lệnh gửi; Đánh dấu đã đọc → Hủy | Hộp hỏi về "Đã xem" | |
| H-34 | Báo cáo → Hiệu suất → Lượt chờ | Ngăn kéo lượt | |
| D-03, D-05 | Duyệt (rút hạn) rồi Thu hồi yêu cầu của NVKD 2 | NVKD 2 đọc rồi mất quyền | |
| D-09 | Trả lời thay 1 tin | Hộp "Trả lời thay …?", bong bóng ghi người gửi thật | |
| D-12, D-16 | Đồng ý đăng ký vắng → giao NVKD 2 trực nick; Kết thúc sớm | "Đã giao … trực thay …" | |
| D-23 | Nhật ký truy cập theo NVKD 1 | Không có nội dung tin | |

### 7.4 P4 · Nhân viên kinh doanh 1 (giữ nick)

| Dòng | Việc của anh/chị | Phải thấy | Kết quả |
|---|---|---|---|
| K-01, K-02 | Đăng nhập, chụp menu | Không có Quản trị | |
| K-19 | F5 sau khi Admin gán nick | "Của tôi" có "test nhom", chấm xanh | |
| K-22, K-23 | Khách hàng → mở khách → Danh tính & kênh | SĐT đầy đủ, không nút Hiện | |
| H-01 – H-03 | Chấm nick; lọc Chưa trả lời; Đồng bộ | Số bản ghi khớp | |
| H-05 – H-10 | Nhận tin; Lấy nội dung; `/chao`; Tra hàng → Chèn → **Gửi (tin 1)**; Lệnh gửi | Đã gửi; khách nhận | |
| H-12 | Gửi nhanh số tài khoản **(tin 2)** | Khách nhận | |
| H-13, H-29 | Tạo nhắc việc 10 phút; nhận nhắc | Thông báo | |
| H-15 | Tin từ điện thoại của chủ dự án | Nhãn "Gửi từ điện thoại", rời Chưa trả lời | |
| H-27 | Chuyển hậu mãi cho CSKH → Tạo phiếu | Chip phiếu | |
| H-30, H-31 | Tìm "lọc gió"; Ghim; Đánh dấu chưa đọc | Tô sáng; ghim | |
| H-33 | Báo cáo | Chỉ Dashboard của tôi | |
| D-10 | Thấy tin GS trả lời thay | Ghi người gửi thật | |
| D-11, D-15 | Đăng ký vắng; xem trạng thái Nghỉ phép | "Đã gửi đăng ký vắng" | |
| D-17, D-20 | Ngắt wifi; mở hội thoại ngoài danh sách | "Không có kết nối mạng"; ô soạn khóa | |
| D-22 | Tin chuyển khoản: không trả lời, tạo nhắc việc báo GS | – | |
| D-24 | Hoạt động của tôi | Dòng GS đã xem nhật ký | |
| D-28 | Sau khi bị khóa, F5 | Về trang đăng nhập | |

### 7.5 P5 · Nhân viên kinh doanh 2 (Tổ B) + CSKH + các vai không đọc chat

| Dòng | Việc của anh/chị | Phải thấy | Kết quả |
|---|---|---|---|
| K-01 – K-03 | Đăng nhập; menu; gõ `/admin/audit` | "Bạn không có quyền truy cập trang này" | |
| K-20 | F5 Tin nhắn | Trống | |
| K-27 | Dán đường dẫn khách tổ A | Không có quyền, có nút Xin quyền | |
| K-28 | Cửa sổ Sale admin: mở khách | Thấy hồ sơ, không có Tin nhắn | |
| H-23 | Ctrl+K "test nhom" | Không mở được | |
| H-24, H-25 | CSKH: menu; Sale admin, Kế toán, Marketing, NV thị trường: menu + dán đường dẫn | Không có Tin nhắn; "Không tìm thấy hoặc bạn không có quyền xem" (4 ảnh) | |
| H-28 | CSKH: Hàng việc CSKH → Hậu mãi | Phiếu bảo hành từ NVKD 1 | |
| D-01, D-02, D-04 | Xin quyền (trống → bị chặn; có lý do → gửi); đọc khi được duyệt | Người duyệt là GS Tổ A; không có ô soạn | |
| D-06 | Sale admin: Xin quyền theo SĐT / mã KH | Chỉ "Xem", ≤ 3 ngày, GĐ duyệt | |
| D-13, D-14 | Trực thay: thấy hội thoại nick; **gửi 1 tin (tin 3 của nick)** | Bong bóng ghi "(trực thay …)" | |
| D-29 | Sau bàn giao: thấy khách cũ của NVKD 1 | Ô soạn báo nick "Chưa an toàn" | |

## 8. Kết thúc buổi và biên bản

1. **Gán nick lại.** P1 Admin: Quản trị → Gán kênh → nick → gán cho người giữ thật (theo ảnh chụp ở K-16). Làm **trước** khi gỡ tài khoản thử, nếu không dòng gán kênh trỏ vào người đã xóa và nick hiện "⚠ chưa gán".
2. **Gỡ dữ liệu thử:** `pnpm seed:thu --remove` (xóa 11 người thử, vai trò, phiên đăng nhập, đơn vị `THU-*`). "Thử – NVKD 3" và "Tổ bán hàng thử C" tạo tay trong buổi **không** có nhãn seed: Admin ngừng đơn vị và khóa người này bằng tay, hoặc để lại và ghi vào biên bản.
3. **Tin trong nhóm "test nhom"** để nguyên (nhóm thử).
4. **Biên bản:** tạo `docs/05-kiem-thu/uat/2026-10-05/bien-ban.md` theo mẫu `m1b.md`: bảng ca (mã dòng K/H/D, ca UAT, Đạt/Trượt/Bỏ, người làm), danh sách lỗi `L-xx` (L-01 đã ghi sẵn: chữ khóa ô soạn ghi nhóm cũ), ảnh đặt trong cùng thư mục tên theo mã dòng.
5. Lỗi chặn (không làm tiếp được) → mở yêu cầu qua MCP `vclinks-dev` hoặc giao phiên sửa lỗi theo `so-phien.md`.

## 9. Việc cần chủ dự án quyết

| Mã | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| Q1 | Bước "tạo khách mới và gắn cho sale": làm thêm màn **Thêm khách** và nút **Giao cho…** (02 DK-62) trước buổi thử, hay thử đúng hai đường hiện có (danh bạ nick, nạp VCsales) rồi làm màn này ở phiên sau? | **B**: thử hai đường hiện có; ghi yêu cầu màn "Thêm khách / Giao cho" vào kế hoạch M1 như một phiên bổ sung |
| Q2 | Người đóng khách (P3) phải được thêm vào nhóm "test nhom" bằng Zalo của chủ dự án. Đồng ý thêm 1 người ngoài vào nhóm thử? | **OK**; hoặc dùng người "test that" đã có và thêm mã người đó vào `onlyThreadIds` |
| Q3 | D-19 tắt Chrome driver 1 phút để thử nick đỏ: cho làm trong buổi hay bỏ? | **Bỏ** ở buổi đầu, làm khi chủ dự án ngồi cạnh máy chủ |
| Q4 | Sửa chữ khóa ô soạn (L-01) thành đọc tên hội thoại từ cấu hình driver, trước buổi thử? | **OK**, sửa nhỏ, một phiên Sonnet |
| Q5 | Buổi 2 (sau khi buổi 1 đạt): gửi báo giá thật trong nhóm test, gợi ý AI khi có khóa Claude API, kênh OA. Lên lịch luôn hay chờ kết quả buổi 1? | **Chờ** kết quả buổi 1 |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 05/10/2026 09:56 | Claude Code | Bản đầu: 3 giai đoạn (khởi tạo, hàng ngày, đột xuất), 5 phiếu vai, lịch 2h30, 5 câu hỏi; ghi nhận chưa có màn "Thêm khách / Giao cho" và lỗi chữ L-01 | Yêu cầu chủ dự án 05/10/2026 ("kịch bản có hướng dẫn để phân công cho nhiều người thật, thêm phần khởi tạo") |
