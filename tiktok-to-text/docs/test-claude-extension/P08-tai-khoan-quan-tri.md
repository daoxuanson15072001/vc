# P08 — Tài khoản, quản trị người dùng, cây lĩnh vực, Kết nối AI

> **Ưu tiên:** 8 · **Thời gian:** 35–45 phút · **Dữ liệu:** dựng lại trước khi chạy (`bash start_uat.sh --seed-only`) · **Cần AI:** không

---

## Mục tiêu gói

Kiểm tra:
- đăng nhập / đăng xuất / đổi mật khẩu;
- quản trị viên quản lý tài khoản (tạo, đổi vai trò, khoá, mở khoá, đặt lại mật khẩu);
- cây lĩnh vực 4 tầng (thêm, sửa, gán chủ nhánh, ẩn / hiện);
- trang Kết nối AI (tạo / thu hồi token).

## Luật nghiệp vụ cần biết

- Sai thông tin đăng nhập báo chung **"Sai email hoặc mật khẩu"**; tài khoản khoá báo **"Tài khoản đã bị khoá"**.
- Mật khẩu ≥ 8 ký tự.
- Khoá tài khoản hoặc đặt lại mật khẩu thì người đó bị **đăng xuất khỏi mọi nơi**.
- Quản trị viên **không tự hạ quyền, không tự khoá** mình.
- Cây lĩnh vực tối đa **4 tầng**. Slug phải là `<slug cha>.<chữ-thường-không-dấu>` và không trùng. Ẩn cha thì ẩn cả con.
- Token AI dạng `vcmcp_…` **chỉ hiện một lần**; chỉ lưu dạng băm; thu hồi được.

## Ca kiểm thử

### A01 — Đăng nhập sai / đúng
1. Ở màn Đăng nhập: `nv.kt@uat.test` + mật khẩu `sai-mat-khau` → Đăng nhập.
2. `khongco@uat.test` + `Test@12345`.
3. `NV.KT@UAT.TEST` (chữ hoa) + `Test@12345`.

**Mong đợi:**
- Bước 1, 2: cùng một thông báo **"Sai email hoặc mật khẩu"**. Không lộ email có tồn tại hay không.
- Bước 3: ghi nhận vào được hay không. Nên vào được; nếu không thì ghi GÓP Ý.
- Tab trình duyệt có tiêu đề "Đăng nhập · VC Content Engine".

### A02 — Đổi mật khẩu (rồi trả lại)
**Tài khoản:** OUTSIDER
1. Bấm tên ở góc dưới trái → **Đổi mật khẩu**.
2. Mật khẩu hiện tại `sai-sai-sai`, mới `MoiMoi@123` → Lưu.
3. Mật khẩu hiện tại `Test@12345`, mới `1234` → Lưu.
4. Hiện tại `Test@12345`, mới `MoiMoi@123` → Lưu.
5. Đăng xuất → đăng nhập bằng `MoiMoi@123`.
6. **Trả lại:** đổi mật khẩu từ `MoiMoi@123` về `Test@12345`.

**Mong đợi:**
- Bước 2: "Mật khẩu hiện tại không đúng".
- Bước 3: trình duyệt / hệ thống chặn (≥ 8 ký tự).
- Bước 4: "Đã đổi mật khẩu".
- Bước 5: vào được.

### A03 — Quản trị viên tạo tài khoản
**Tài khoản:** ADMIN → **Người dùng & lĩnh vực** → tab **Người dùng**
1. Form "Tạo tài khoản": Họ tên "Người Test Mới", Email `nguoi.moi@uat.test`, Mật khẩu ban đầu `Test@12345`, Vai trò Thành viên → **Tạo tài khoản**.
2. Tạo lại đúng email đó.
3. Email `khong-hop-le` → Tạo.
4. Đăng nhập `nguoi.moi@uat.test` → Kho & chia sẻ.

**Mong đợi:**
- Bước 1: "Đã tạo nguoi.moi@uat.test"; dòng mới trong danh sách.
- Bước 2: **"Email đã được dùng"**.
- Bước 3: báo email không hợp lệ.
- Bước 4: có sẵn một kho cá nhân ★.

### A04 — Khoá / mở khoá / đặt lại mật khẩu, bị đăng xuất khỏi mọi nơi
**Tài khoản:** ADMIN, với người `nguoi.moi@uat.test`
1. Bấm **Khoá**.
2. Đăng xuất ADMIN → đăng nhập `nguoi.moi@uat.test` / `Test@12345`.
3. ADMIN: **Mở khoá**. Người mới đăng nhập lại.
4. ADMIN: **Đặt lại MK** → hộp nhập "Mật khẩu mới cho nguoi.moi@uat.test (≥ 8 ký tự)" → gõ `abc` → OK.
5. Làm lại, gõ `DatLai@2026` → OK.
6. Đăng nhập người mới bằng `Test@12345`, rồi bằng `DatLai@2026`.

**Mong đợi:**
- Bước 1: nhãn **Đã khoá**, không hỏi xác nhận.
- Bước 2: **"Tài khoản đã bị khoá"**.
- Bước 3: vào được.
- Bước 4: báo "Mật khẩu: cần ít nhất 8 ký tự".
- Bước 5: "Đã đặt lại mật khẩu".
- Bước 6: mật khẩu cũ báo sai; mật khẩu mới vào được.

### A05 — Tự bảo vệ quản trị viên; đổi vai trò
**Tài khoản:** ADMIN
1. Xem dòng của chính mình.
2. Đổi vai trò `nguoi.moi@uat.test` thành **Quản trị**.
3. Đăng nhập người đó → xem menu.
4. ADMIN đổi lại **Thành viên**.

**Mong đợi:**
- Bước 1: ô vai trò bị khoá, **không** có nút Khoá / Đặt lại MK.
- Bước 2: "Đã đổi vai trò".
- Bước 3: có nhóm "Quản trị".

### A06 — Cây lĩnh vực: thêm, luật slug, 4 tầng
**Tài khoản:** ADMIN → tab **Lĩnh vực**
1. **+ Lĩnh vực cấp 1**: Tên "Khối Thử UAT", Slug `thu-uat`, Mã `9` → Thêm.
2. Ở "Khối Thử UAT" → **+ Nhánh con**: Tên "Nhánh A", Slug `sai.slug` → Thêm.
3. Để trống slug → Thêm.
4. Tạo tiếp "Nhánh A" dưới "Khối Thử UAT" lần nữa (để trống slug).
5. Tạo tầng 3 dưới "Nhánh A", rồi tầng 4 dưới tầng 3. Xem dòng tầng 4.
6. Tên chỉ gồm dấu cách → Thêm.
7. Slug `thu-uat` cho một lĩnh vực cấp 1 mới.

**Mong đợi:**
- Bước 1: tạo được, dòng hiện "9 Khối Thử UAT · thu-uat".
- Bước 2: báo slug không hợp lệ, phải dạng `thu-uat.<ten-khong-dau>`.
- Bước 3: slug tự sinh `thu-uat.nhanh-a`.
- Bước 4: slug tự thêm hậu tố `-2`.
- Bước 5: **không** có "+ Nhánh con" ở tầng 4.
- Bước 6: "Tên lĩnh vực không được để trống".
- Bước 7: **"Slug 'thu-uat' đã có trong cây"**.

### A07 — Sửa lĩnh vực, gán chủ nhánh, ẩn / hiện dây chuyền
**Tài khoản:** ADMIN
1. **Sửa** "Nhánh A": đổi tên "Nhánh A (đổi tên)", Mô tả "Mô tả thử", **Chủ nhánh** = Phạm Trưởng Phòng KT, Scope note "Gồm: thử" → Lưu.
2. **Ẩn** "Khối Thử UAT".
3. **Hiện** lại "Khối Thử UAT".
4. Mở VCWIKI → + Thẻ mới → bộ chọn Lĩnh vực, tìm "Khối Thử" khi đang ẩn và khi đã hiện.

**Mong đợi:**
- Bước 1:
  - Dòng hiện tên mới, "· chủ nhánh Phạm Trưởng Phòng KT", "· scope note ✓".
  - Slug **không đổi**.
- Bước 2: cả nhánh con có nhãn **Đã ẩn**; nhánh con hiện chữ "Cha đang ẩn" thay cho nút Hiện.
- Bước 3: các nhánh con ẩn theo cha hiện lại.
- Bước 4: nhánh ẩn không có trong bộ chọn.

### A08 — Đề xuất lĩnh vực của AI
**Tài khoản:** ADMIN, tab Lĩnh vực → khung **"AI đề xuất lĩnh vực mới"**

**Mong đợi:** "Chưa có đề xuất." (không có AI nên không có đề xuất). Ghi ĐẠT nếu khung hiển thị đúng.

### A09 — Kết nối AI: token
**Tài khoản:** NV.KT → **Kết nối AI**
1. Xem trang.
2. Tên token "Thử UAT" → **+ Tạo token**.
3. Tải lại trang.
4. **Thu hồi** → hộp xác nhận `Thu hồi token "Thử UAT"? …` → OK.
5. ADMIN: Người dùng → Khoá NV.KT → Mở khoá.

**Mong đợi:**
- Bước 1: có "Địa chỉ cổng MCP", phần "Cách kết nối" (lệnh Claude Code, cấu hình Claude Desktop), bảng "AI làm được gì".
- Bước 2: hiện "Token mới — sao chép ngay, sẽ không hiện lại:" và chuỗi bắt đầu `vcmcp_`. **Không chép token vào báo cáo**, chỉ ghi "có hiện".
- Bước 3: token **không** hiện lại. Bảng "Token của tôi" có dòng Thử UAT, đuôi "…xxxx", "Chưa dùng".
- Bước 4: dòng biến mất.
- Bước 5: nếu NV.KT có token khác, token bị thu hồi (tạo 1 token trước khi khoá để kiểm). Ghi nhận.

## Kết thúc gói

- Đảm bảo `nguoi.moi@uat.test` là Thành viên và mọi mật khẩu tài khoản mẫu vẫn là `Test@12345`.
- Viết báo cáo theo mẫu, mã gói **P08**.
