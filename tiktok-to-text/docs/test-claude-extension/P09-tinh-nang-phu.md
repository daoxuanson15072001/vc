# P09 — Tính năng phụ, điều hướng, giao diện

> **Ưu tiên:** 9 (đơn giản, làm sau) · **Thời gian:** 30–40 phút · **Dữ liệu:** dùng tiếp dữ liệu hiện có, không bắt buộc dựng lại · **Cần AI:** không

---

## Mục tiêu gói

Rà nhanh các màn hình còn lại:
- Xưởng chiến dịch và Người đứng tên, ở phần không cần AI;
- Tiến độ tinh chế, Tìm video theo chủ đề, Trò chuyện Claude, nút "Hỏi Claude";
- điều hướng, tiêu đề trang, đường dẫn cũ, màn hình hẹp.

Không có AI nên nhiều nút sẽ báo "Chờ cấu hình AI". Đó là **đúng**; chỉ ghi lỗi khi thông báo sai, khó hiểu, hoặc trang vỡ.

## Ca kiểm thử

### X01 — Điều hướng và tiêu đề trang
**Tài khoản:** NV.KT
1. Lần lượt bấm từng mục trên thanh bên.
2. Gõ các địa chỉ: `/videos`, `/channels`, `/jobs`, `/khong-co-trang-nay`.

**Mong đợi:**
- Bước 1: mỗi mục mở trang có tiêu đề (h1) khớp tên mục (riêng "Người dùng & lĩnh vực" → "Quản trị"). Tab trình duyệt đổi tên theo trang. Không trang nào trắng hay báo lỗi đỏ.
- Bước 2:
  - `/videos` → Kho tư liệu tab Video.
  - `/channels` → tab Kênh.
  - `/jobs` → Kho tư liệu.
  - Địa chỉ lạ → Tổng quan.

### X02 — Xưởng chiến dịch khi không có AI
**Tài khoản:** NV.KT → **Xưởng chiến dịch**
1. Xem trang.
2. **+ Chiến dịch mới**. Để trống tên.
3. Tên "Chiến dịch thử OBD"; Lưu vào kho: Kho Kỹ thuật VCgarage; chỉ tick luồng **① Video ngắn**; Sản phẩm "Dịch vụ đọc lỗi OBD"; Số tuần 2.
4. Phần Video tham chiếu: tick 2 video.
5. Bấm **Lập chiến dịch**.
6. Tick thêm luồng **② Bài website chuẩn SEO**, không nhập từ khoá.
7. Bỏ tick ②, bấm Lập chiến dịch.
8. Trong trang chiến dịch, bấm **Xoá** → hộp xác nhận → OK.

**Mong đợi:**
- Bước 1: khung "AI chưa sẵn sàng: …" nói chiến dịch vẫn được lưu và tự chạy khi có khoá.
- Bước 2: dòng "Còn thiếu: nhập tên chiến dịch…", nút Lập chiến dịch mờ.
- Bước 4: dòng "N video khớp · dùng 2 video".
- Bước 6: dòng "Còn thiếu" nêu từ khoá hạt giống SEO.
- Bước 7: mở trang chiến dịch, trạng thái **Chờ cấu hình AI**, có các tab Chiến lược / Chiến dịch / Video ngắn / Tham chiếu. Tab Tham chiếu có 2 video.
- Bước 8: chiến dịch biến mất khỏi danh sách.

### X03 — Người đứng tên
**Tài khoản:** NV.KT → **Người đứng tên**
1. **+ Người đứng tên**: Họ tên "Anh Thử", Chức danh "Kỹ thuật trưởng", Giọng "thân thiện, xưng anh", 1 bài mẫu ngắn; tick "đã đồng ý…" → Lưu.
2. **Sửa** → bỏ tick đồng ý → Lưu.
3. **Xoá** → hộp xác nhận → OK.

**Mong đợi:**
- Bước 1: thẻ hồ sơ có nhãn **Đã đồng ý**, "1 bài mẫu".
- Bước 2: nhãn **Chưa đồng ý**.
- Bước 3: hồ sơ biến mất.

### X04 — Tiến độ tinh chế
**Tài khoản:** NV.KT → **Tiến độ tinh chế**
1. Xem trang.
2. Bấm từng tab.
3. **● Theo dõi trực tiếp**.

**Mong đợi:**
- Bước 1: khung "AI chưa sẵn sàng…". Các ô số liệu (Đã vào VCWIKI, Hàng chờ AI, Lỗi AI, Tốc độ, Thẻ nháp chờ duyệt). Ô "Thẻ nháp chờ duyệt" bấm được sang VCWIKI lọc nháp.
- Bước 2: tab Hàng chờ AI, Lỗi, Đang tổng hợp, Chỉ chuyển chữ, Đã vào VCWIKI, Tất cả: không lỗi. Bảng rỗng có câu "Không có tài liệu…".
- Bước 3: trang "Tinh chế — trực tiếp", trạng thái kết nối "Trực tiếp · …".

### X05 — Tìm video theo chủ đề (cần mạng)
**Tài khoản:** NV.KT → **Tìm video theo chủ đề**
1. Nhập "a" → **✦ Phân tích từ khoá**.
2. Nhập "cách đọc lỗi OBD xe ô tô" → Phân tích từ khoá.
3. Bấm **⌕ Tìm video**.

**Mong đợi:**
- Bước 1: bị chặn (tối thiểu 2 ký tự).
- Bước 2: vẫn chạy khi không có AI. Hiện "— chưa có AI, dùng nguyên câu bạn gõ…", có 1 từ khoá.
- Bước 3: nếu có mạng thì ra kết quả. Nếu không có mạng thì ghi **CHẶN (cần mạng)**; chỉ lỗi nếu trang vỡ / thông báo khó hiểu.

### X06 — Trò chuyện Claude và nút "Hỏi Claude"
**Tài khoản:** NV.KT
1. Ở trang VCWIKI bấm nút nổi **✺ Hỏi Claude**.
2. Gõ "Xin chào" → Gửi.

**Mong đợi:**
- Bước 1: mở trang Trò chuyện, có màn chào "Trò chuyện với Claude" và 4 gợi ý.
- Bước 2: nếu máy chủ chưa cài Claude Code CLI thì báo rõ "Máy chủ chưa cài Claude Code CLI…". Chấp nhận. Nếu trả lời được thì ghi ĐẠT.
- Ghi nhận: ADMIN có ô "Của mọi người" hay không, và nếu có thì có đọc được hội thoại người khác không. Theo luật mới thì **không được**.

### X07 — Màn hình hẹp (điện thoại)
**Tài khoản:** NV.KT
1. Thu cửa sổ trình duyệt còn khoảng 390 px chiều ngang (hoặc dùng chế độ thiết bị di động nếu có).
2. Mở lần lượt: Tổng quan, VCWIKI (mở một thẻ), Hộp duyệt, Học tập của tôi, một bài học, Kho tư liệu.

**Mong đợi:**
- Không có thanh cuộn ngang toàn trang.
- Chữ không bị cắt mất; nút bấm được; ngăn chi tiết thẻ đóng được.
- Nút "Hỏi Claude" không che nút quan trọng.
- Ghi GÓP Ý cho từng chỗ khó dùng.

### X08 — Rà chính tả và thuật ngữ
Trong lúc làm các ca trên, ghi lại mọi chỗ:
- chữ tiếng Anh lẫn vào giao diện;
- lỗi chính tả;
- cùng một thứ gọi hai tên khác nhau (vd "Kho tư liệu" / "Kho tri thức", "Loại" / "Từ chối");
- thông báo lỗi dạng kỹ thuật (mã lỗi, "undefined", "[object Object]", "Lỗi 500").

## Kết thúc gói

Viết báo cáo theo mẫu, mã gói **P09**.
