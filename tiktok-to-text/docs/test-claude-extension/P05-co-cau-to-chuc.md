# P05 — Cơ cấu tổ chức: đơn vị, hồ sơ, nhập Excel, vai trò, uỷ quyền, nghỉ việc

> **Ưu tiên:** 5 · **Thời gian:** 50–70 phút · **Dữ liệu:** dựng lại trước khi chạy (`bash start_uat.sh --seed-only`) · **Cần AI:** không · **Cần người dùng hỗ trợ:** chọn file CSV ở O07, O08

---

## Mục tiêu gói

Kiểm tra màn **Cơ cấu tổ chức** (`/org`). Đây là gốc của mọi luật quyền: giao bài, xem điểm, chấm bài đều tính theo cây quản lý ở đây.

## Luật nghiệp vụ cần biết

1. **Cây đơn vị:**
   - Loại đơn vị: Tập đoàn > Division > Phòng > Nhóm; loại con phải thấp hơn loại cha.
   - Tối đa **4 tầng**. **Mã đơn vị duy nhất**: chữ in hoa không dấu, số, gạch ngang.
   - **Không xoá** đơn vị, chỉ **ẩn**; đơn vị còn người thì không ẩn được. Ẩn cha thì ẩn cả nhánh con.
2. **Hồ sơ người:** đơn vị chính + kiêm nhiệm, chức năng, quản lý trực tiếp, quản lý chuyên môn, chức danh, cấp bậc 1–7. **Không được tạo vòng quản lý.**
3. **Nhập Excel / CSV:**
   - Có bước **Xem trước** báo lỗi từng dòng; **còn một dòng lỗi thì không ghi dòng nào**.
   - Chạy lại cùng file không tạo trùng. Tài khoản mới nhận mật khẩu ngẫu nhiên, **hiện một lần**.
4. **Vai trò chức năng** cấp theo phạm vi (đơn vị / lĩnh vực / chức năng). Thu hồi không xoá mà ghi "Đã thu hồi". Cấp trùng trong cùng khoảng thời gian thì bị chặn.
5. **Uỷ quyền:**
   - Có hạn; người được uỷ quyền **không uỷ quyền tiếp** được.
   - Uỷ quyền trùng thì bị chặn.
6. **Nghỉ việc:**
   - Khoá tài khoản, đăng xuất mọi nơi.
   - Vai trò chuyển cho quản lý trực tiếp; người dưới quyền chuyển sang quản lý của người nghỉ.
   - "Cho đi làm lại" mở khoá nhưng **không tự trả lại vai trò** đã bàn giao.
7. Chỉ **ADMIN** sửa được; người khác chỉ xem sơ đồ và khung "Của tôi".

## Ca kiểm thử

### O01 — Khung "Của tôi" của từng người
**Tài khoản:** KS.KT, rồi OUTSIDER, rồi TGD → **Cơ cấu tổ chức**

**Mong đợi:**
- KS.KT:
  - Đơn vị "Phòng Kỹ thuật VCgarage", Cấp bậc **"3 · Key staff"**.
  - **Quản lý của tôi**: Phạm Trưởng Phòng KT.
  - **Người dưới quyền của tôi**: Vũ Nhân Viên KT, Đỗ Thực Tập KT.
  - Vai trò chức năng: *Người duyệt* (phạm vi Phòng Kỹ thuật VCgarage · lĩnh vực nen.ky-thuat).
- OUTSIDER: quản lý là Mai Đào Tạo, không có người dưới quyền.
- TGD: không có quản lý, người dưới quyền gồm các GĐ, HR.LND, AUDITOR.
- Không ai trong 3 người thấy nút sửa hay các tab quản trị.

### O02 — Sơ đồ và danh sách người theo đơn vị
**Tài khoản:** ADMIN → Cơ cấu tổ chức → tab **Sơ đồ tổ chức**
1. Xem cây.
2. Bấm "Phòng Kỹ thuật VCgarage".

**Mong đợi:**
- Bước 1: cây có Tập đoàn VC Phồn Vinh → Nhân sự tập đoàn, VCgarage → Phòng Kỹ thuật VCgarage, VCpart → Phòng Kinh doanh VCpart. Mỗi dòng có mã, loại, "trưởng: …", số người.
- Bước 2: panel bên phải có 4 người (TP.KT, KS.KT, NV.KT, TTS.KT), mỗi người có chức danh, chức năng, cấp, "quản lý: …", nút **Sửa hồ sơ**, **Nghỉ việc**.

### O03 — Thêm đơn vị: luật loại, tầng, mã
**Tài khoản:** ADMIN
1. Ở dòng "Phòng Kỹ thuật VCgarage" bấm **+ Đơn vị con**. Kiểm tra ô Mã và ô Loại đơn vị.
2. Mã `VCGARAGE-KT-CHANDOAN`, tên "Nhóm Chẩn đoán", loại **Nhóm** → **Thêm**.
3. Xem dòng "Nhóm Chẩn đoán".
4. Ở "VCpart" → + Đơn vị con → mã `VCPART-KD` (trùng), tên "Trùng mã", loại Phòng → Thêm.
5. Ở "VCpart" → + Đơn vị con → mã `VC PART MỚI` (có dấu cách, dấu) → Thêm.
6. **Sửa** "Nhóm Chẩn đoán" → đổi Loại thành **Division** → Lưu.

**Mong đợi:**
- Bước 1: mã điền sẵn "VCGARAGE-KT-"; loại chỉ có Phòng/Nhóm (thấp hơn Phòng).
- Bước 2: tạo xong, nằm dưới Phòng Kỹ thuật.
- Bước 3: **không** có nút "+ Đơn vị con" (Nhóm, tầng 4).
- Bước 4: **"Mã đơn vị VCPART-KD đã được dùng"**.
- Bước 5: báo lỗi mã chỉ gồm chữ in hoa không dấu, số, gạch ngang (hoặc ô tự đổi chữ hoa nhưng vẫn báo lỗi dấu cách / có dấu).
- Bước 6: báo "Division không đặt dưới Phòng được".

### O04 — Ẩn / hiện đơn vị
**Tài khoản:** ADMIN
1. Bấm **Ẩn** ở "Phòng Kỹ thuật VCgarage".
2. Ở "VCpart" → + Đơn vị con: mã `VCPART-THU`, tên "Phòng Thử", loại Phòng → Thêm. Ở "Phòng Thử" → + Đơn vị con: `VCPART-THU-N1`, "Nhóm Thử", Nhóm → Thêm.
3. **Ẩn** "Phòng Thử".
4. Bấm **Hiện** ở "Phòng Thử" → hộp xác nhận → OK.
5. Ẩn "Nhóm Chẩn đoán" (từ O03).

**Mong đợi:**
- Bước 1: báo **"Đơn vị (kể cả nhánh con) còn 4 người đang làm việc — chuyển họ sang đơn vị khác trước khi ẩn"**, không ẩn.
- Bước 3: cả "Phòng Thử" và "Nhóm Thử" có nhãn **Đã ẩn**, không hỏi gì.
- Bước 4: hộp xác nhận "Hiện cả 1 đơn vị con đang ẩn của Phòng Thử? (VCPART-THU-N1)"; OK thì cả hai hiện lại.
- Bước 5: ẩn được (không có người).

### O05 — Sửa hồ sơ người và chặn vòng quản lý
**Tài khoản:** ADMIN, panel "Phòng Kinh doanh VCpart"
1. **Sửa hồ sơ** của Đặng Nhân Viên KD: Chức danh "Nhân viên KD cao cấp", Cấp bậc **3 · Key staff** → **Lưu hồ sơ**.
2. **Sửa hồ sơ** của Bùi Trưởng Phòng KD: Quản lý trực tiếp = **Đặng Nhân Viên KD** → Lưu hồ sơ.
3. Mở ô "Quản lý trực tiếp" khi sửa hồ sơ của một người bất kỳ.

**Mong đợi:**
- Bước 1: "Đã lưu hồ sơ của Đặng Nhân Viên KD"; dòng người hiện "… · cấp 3 · Key staff".
- Bước 2: báo **"Tạo vòng quản lý: …"** (NV.KD đang dưới quyền TP.KD), không lưu.
- Bước 3: danh sách **không** có chính người đó.

### O06 — Tab Chức năng và Cấp bậc
**Tài khoản:** ADMIN
1. Tab **Chức năng** → form "Thêm chức năng": Mã `tech`, Tên "Trùng" → **Thêm chức năng**.
2. Mã `Tài Chính`, Tên "Sai mã" → Thêm.
3. Mã `finance`, Tên "Tài chính – Kế toán" → Thêm → **Sửa** dòng đó → "Mảng tri thức" chọn **Tài chính – Kế toán** (tckt) → Lưu.
4. Tab **Cấp bậc** → hàng Cấp 2, cột "Mảng của mình" tick thêm **Vận hành** → **Hoàn tác**.
5. Tick lại → **Lưu bảng** → tải lại trang.
6. Bỏ tick Vận hành ở Cấp 2 → Lưu bảng (trả lại như cũ).

**Mong đợi:**
- Bước 1: **"Mã chức năng tech đã được dùng"**.
- Bước 2: báo mã chỉ gồm chữ thường không dấu, số, gạch ngang.
- Bước 3: dòng hiện "Tài chính – Kế toán · finance · mảng …".
- Bước 4: ô trở lại như cũ.
- Bước 5: "Đã lưu bảng cấp bậc"; tải lại vẫn giữ.

### O07 — Nhập Excel: file có lỗi thì không ghi gì
**Tài khoản:** ADMIN → tab **Nhập Excel**
1. Bấm link **"Tải file mẫu (CSV)"**: ghi nhận có tải file hay không.
2. **Nhờ người dùng chọn file** `docs/test-claude-extension/data/to-chuc-co-loi.csv` → **Xem trước**.
3. Xem nút **Xác nhận nhập**.
4. Tab Sơ đồ tổ chức → Phòng Kỹ thuật VCgarage.

**Mong đợi:**
- Bước 2:
  - "Xem trước — 9 dòng", đếm "2 tạo mới · 0 cập nhật · 0 giữ nguyên · 7 dòng lỗi" + câu "…còn lỗi thì không ghi dòng nào".
  - Cột **Kết quả** là cột thứ hai.
  - Lỗi từng dòng: "Email không hợp lệ"; "Mã đơn vị KHONG-CO không có (hoặc đã ẩn)"; "Cấp bậc “9” phải là số 1–7…"; "Quản lý khong.co@uat.test không có trong file cũng không có trong hệ thống"; "Email trùng với dòng …"; hai dòng "Tạo vòng quản lý: vong.a… → vong.b… → vong.a…".
- Bước 3: bị mờ.
- Bước 4: **không** có ai tên "Người Hợp Lệ Trong File Lỗi".

### O08 — Nhập Excel: file hợp lệ, mật khẩu hiện một lần, chạy lại không trùng
**Tài khoản:** ADMIN → tab Nhập Excel
1. **Nhờ người dùng chọn file** `docs/test-claude-extension/data/to-chuc-hop-le.csv` → **Xem trước**.
2. **Xác nhận nhập**.
3. Chọn lại đúng file đó → Xem trước.
4. Tab Sơ đồ → Phòng Kỹ thuật VCgarage.
5. Đăng xuất → đăng nhập `ktv.moi1@uat.test` bằng mật khẩu ở bước 2 → Cơ cấu tổ chức.

**Mong đợi:**
- Bước 1: "2 tạo mới", 0 lỗi.
- Bước 2: khung "Đã nhập": "2 tài khoản mới…", câu "Mật khẩu chỉ hiện một lần…", bảng Email / Họ tên / Mật khẩu. **Chép lại mật khẩu của ktv.moi1** cho bước 5 (chỉ dùng trong bản test).
- Bước 3: "0 tạo mới · 0 cập nhật · 2 giữ nguyên".
- Bước 4: có 2 người mới. Trần KTV Mới Hai có chức năng Kỹ thuật (lấy theo phòng), cấp 1, quản lý là Nguyễn KTV Mới Một.
- Bước 5: "Quản lý của tôi" là Hoàng Key Staff KT; "Người dưới quyền" có Trần KTV Mới Hai.

### O09 — Cấp và thu hồi vai trò chức năng
**Tài khoản:** ADMIN → tab **Vai trò chức năng**
1. Lọc Vai trò = Người duyệt.
2. Form "Cấp vai trò": Người = Vũ Nhân Viên KT, Vai trò **Biên tập viên**, Đơn vị = Phòng Kỹ thuật VCgarage, để trống Hết hạn → **Cấp vai trò**.
3. Cấp lại y hệt.
4. Đăng nhập NV.KT: xem menu Học tập.
5. ADMIN: bấm **Thu hồi** ở vai trò vừa cấp → hộp xác nhận → OK → tick "Cả vai trò đã hết hạn / thu hồi".

**Mong đợi:**
- Bước 1: thấy Hoàng Key Staff KT — Người duyệt.
- Bước 2: "Đã cấp Biên tập viên cho Vũ Nhân Viên KT".
- Bước 3: báo "…đã có vai trò này trong phạm vi này (đang hoặc sắp hiệu lực, trùng thời gian)".
- Bước 4: giờ có **Thiết kế lộ trình** và **Lộ trình học** (Biên tập viên là người soạn được).
- Bước 5: "Đã thu hồi"; dòng vẫn còn với nhãn **Đã thu hồi**.

### O10 — Uỷ quyền có hạn, không uỷ quyền tiếp, không trùng
**Tài khoản:** HR.LND → OUTSIDER → HR.LND
1. HR.LND: Cơ cấu tổ chức → khung "Của tôi" → vai trò **Quản lý đào tạo** → **Uỷ quyền**. Người nhận **Tạ Người Ngoài**, "Đến hết ngày" = 7 ngày sau, Ghi chú "Nghỉ phép" → Uỷ quyền.
2. Làm lại y hệt bước 1.
3. OUTSIDER: Cơ cấu tổ chức.
4. OUTSIDER: menu Học tập.
5. HR.LND: Uỷ quyền với "Đến hết ngày" = hôm qua.

**Mong đợi:**
- Bước 1: "Đã uỷ quyền cho Tạ Người Ngoài đến …".
- Bước 2: báo **"Tạ Người Ngoài đã được uỷ quyền vai trò này đến …"**.
- Bước 3: vai trò Quản lý đào tạo có nhãn **"Thay mặt Mai Đào Tạo"**, "· đến …", **không** có nút Uỷ quyền.
- Bước 4: có thêm Thiết kế lộ trình, Lộ trình học.
- Bước 5: báo lỗi ngày kết thúc phải sau hiện tại (hoặc ô ngày không cho chọn).

### O11 — Nghỉ việc và đi làm lại
**Tài khoản:** ADMIN → Sơ đồ tổ chức → Phòng Kỹ thuật VCgarage
1. Ở Hoàng Key Staff KT bấm **Nghỉ việc**. Đọc hộp xác nhận → OK.
2. Đọc panel **"Kết quả xử lý nghỉ việc: Hoàng Key Staff KT"**.
3. Đăng xuất → đăng nhập ks.kt@uat.test.
4. Đăng nhập NV.KT → Cơ cấu tổ chức.
5. ADMIN: ở KS.KT (nhãn **Đã nghỉ**) bấm **Cho đi làm lại** → OK.
6. Tab Vai trò chức năng, lọc người = Hoàng Key Staff KT.
7. ADMIN: bấm Nghỉ việc ở **chính dòng của mình** nếu có (Quản trị UAT không nằm ở phòng này; nếu không tìm thấy nút thì bỏ qua bước này, ghi CHẶN).

**Mong đợi:**
- Bước 1: nội dung hộp xác nhận nói khoá tài khoản, vai trò chuyển cho quản lý trực tiếp, người dưới quyền chuyển sang quản lý của người nghỉ.
- Bước 2:
  - Tài khoản đã khoá, thu hồi token.
  - Người nhận bàn giao: Phạm Trưởng Phòng KT.
  - Vai trò Người duyệt → TP.KT.
  - Người dưới quyền (NV.KT, TTS.KT, KTV mới nếu có) chuyển sang TP.KT.
- Bước 3: **"Tài khoản đã bị khoá"**.
- Bước 4: "Quản lý của tôi" là Phạm Trưởng Phòng KT.
- Bước 5: "Hoàng Key Staff KT đã đi làm lại — kiểm tra lại đơn vị, quản lý, vai trò"; KS.KT đăng nhập lại được.
- Bước 6: vai trò Người duyệt **không** tự trả về (ở TP.KT với nhãn "Nhận bàn giao").
- Bước 7: báo "Không tự xử lý nghỉ việc cho chính mình".

### O12 — Người thường không sửa được tổ chức
**Tài khoản:** TP.KT → Cơ cấu tổ chức

**Mong đợi:** chỉ có tab Sơ đồ tổ chức; bấm vào đơn vị xem được người nhưng **không** có Sửa hồ sơ / Nghỉ việc / + Đơn vị / Ẩn.

## Kết thúc gói

Viết báo cáo theo mẫu, mã gói **P05**.
