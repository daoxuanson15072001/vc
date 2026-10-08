# P02 — Phân quyền theo kho và bảo mật dữ liệu

> **Ưu tiên:** 2 (lõi: lộ dữ liệu là lỗi nặng nhất) · **Thời gian:** 45–60 phút · **Dữ liệu:** dựng lại trước khi chạy (`bash start_uat.sh --seed-only`) · **Cần AI:** không

---

## Mục tiêu gói

Kiểm tra mỗi người **chỉ thấy và chỉ làm được** đúng phần quyền của mình. Phạm vi:

- xem thẻ, nguồn, kho;
- sửa và duyệt;
- quản trị viên không tự đọc nội dung người khác;
- người không có quyền nhận "không tìm thấy" thay vì "không có quyền".

## Luật nghiệp vụ cần biết

1. **Ba mức quyền trong kho:**
   - **Chủ kho**: toàn quyền, quản lý thành viên.
   - **Được sửa**: nạp nguồn, tạo / sửa / duyệt thẻ.
   - **Chỉ xem**: xem, và được *đề xuất* sửa thẻ đã duyệt.
2. **Kho cá nhân** chỉ chủ thấy. **Kho công khai trong công ty**: mọi người là "Chỉ xem".
3. **Người không có quyền xem** một kho / thẻ / nguồn / đề xuất phải nhận **404 "Không tìm thấy …"**. Không được lộ tên hay nội dung.
4. **Quản trị viên (ADMIN)** quản lý tài khoản, cây lĩnh vực, tổ chức nhưng **không** tự động đọc được kho người khác. ADMIN không ở trong kho Kỹ thuật / Kinh doanh nên không thấy thẻ ở đó.
5. **Người đã xem được nhưng thiếu quyền làm** nhận 403, ví dụ "Bạn chỉ có quyền xem kho này" hoặc "Chỉ chủ kho được thực hiện".

## Chuẩn bị

Ghi lại 2 địa chỉ, dùng cho các ca sau:
1. Đăng nhập **NV.KT** → VCWIKI → mở thẻ **"Quy trình đọc lỗi bằng máy chẩn đoán OBD"**. Chép URL trên thanh địa chỉ (có `?card=...`) → gọi là **URL-THE-KT**.
2. Đăng nhập **NV.KD** → VCWIKI → mở thẻ **"Chính sách chiết khấu đại lý 2026 (MẬT KINH DOANH)"** → chép URL → **URL-THE-KD**.

## Ca kiểm thử

### Q01 — Người ngoài chỉ thấy kho công khai
**Tài khoản:** OUTSIDER
1. Mở VCWIKI.
2. Mở **Kho & chia sẻ**.
3. Mở **Tổng quan**.

**Mong đợi:**
- Bước 1: danh sách chỉ có **"Nội quy an toàn xưởng cho nhân sự mới"**. Ô chọn kho có kho cá nhân + "Kho Công khai VCPV", **không** có Kho Kỹ thuật / Kinh doanh.
- Bước 2:
  - "Kho của tôi": kho cá nhân ★.
  - "Được chia sẻ với tôi / công khai": "Kho Công khai VCPV" với nhãn **Chỉ xem**, **không** có nút "Rời kho".
- Bước 3: ô "Thẻ VCWIKI" chỉ đếm thẻ OUTSIDER xem được, tức 1 thẻ.

### Q02 — Mở thẳng link thẻ của kho khác
**Tài khoản:** OUTSIDER, rồi NV.KT
1. OUTSIDER dán **URL-THE-KT** vào thanh địa chỉ.
2. OUTSIDER dán **URL-THE-KD**.
3. NV.KT dán **URL-THE-KD**.

**Mong đợi:** cả 3 lần đều báo **"Không tìm thấy thẻ"** (hoặc ngăn thẻ không mở). Không hiện tiêu đề / nội dung thẻ. Thấy nội dung là **LỖI Nghiêm trọng**.

### Q03 — Quản trị viên không đọc được nội dung kho người khác
**Tài khoản:** ADMIN
1. VCWIKI: xem danh sách thẻ.
2. Dán **URL-THE-KT**.
3. Kho & chia sẻ: xem danh sách kho.
4. **Kho tư liệu**: xem danh sách nguồn.

**Mong đợi:**
- Bước 1: chỉ thấy thẻ của kho công khai.
- Bước 2: "Không tìm thấy thẻ".
- Bước 3: không có Kho Kỹ thuật, Kho Kinh doanh, hay kho cá nhân của người khác.
- Bước 4: không có nguồn của người khác.

### Q04 — Người chỉ xem: không sửa / duyệt / xoá được, nhưng đề xuất được
**Tài khoản:** TTS.KT (Chỉ xem trong Kho Kỹ thuật)
1. VCWIKI → mở thẻ nháp **"[NHÁP] Quy trình kiểm tra hệ thống làm mát"**.
2. Mở thẻ đã duyệt **"Mã lỗi DTC là gì"**.
3. Bấm **+ Thẻ mới** → mở ô **Kho**.
4. Bấm **Huỷ**. Vào **Kho tư liệu** → ô **"Lưu vào kho"** trong phần "Nạp vào kho".

**Mong đợi:**
- Bước 1: xem được nội dung, nhưng **không** có Gửi duyệt / ✓ Duyệt / Loại / Sửa / Xoá.
- Bước 2: có **Đề xuất sửa** và **Đề xuất lỗi thời**.
- Bước 3: danh sách kho chỉ có kho cá nhân ★, **không** có Kho Kỹ thuật.
- Bước 4: không có Kho Kỹ thuật.

### Q05 — Kho cá nhân là riêng tư, kể cả với cấp trên và quản trị viên
**Tài khoản:** NV.KT → KS.KT → ADMIN
1. NV.KT: VCWIKI → + Thẻ mới.
   - Kho: kho cá nhân ★; Loại: Bài học; Tiêu đề **"Ghi chú riêng của NV KT"**; Tóm tắt "bí mật".
   - Tạo thẻ.
   - Mở thẻ, chép URL → **URL-RIENG**.
2. KS.KT (quản lý trực tiếp của NV.KT): VCWIKI → tìm "Ghi chú riêng". Rồi dán **URL-RIENG**.
3. ADMIN: làm như bước 2.

**Mong đợi:** KS.KT và ADMIN đều **không** thấy thẻ trong danh sách, và link báo "Không tìm thấy thẻ".

### Q06 — Mời vào kho, đổi quyền, gỡ quyền: hiệu lực ngay
**Tài khoản:** TP.KT (chủ kho Kỹ thuật) ↔ OUTSIDER
1. TP.KT: Kho & chia sẻ → thẻ **Kho Kỹ thuật VCgarage** → **Quản lý**.
2. Ô "Email người được mời": gõ `khong-ton-tai@uat.test`, quyền Chỉ xem → **Mời**.
3. Mời `outsider@uat.test` với quyền **Chỉ xem**.
4. OUTSIDER: VCWIKI.
5. OUTSIDER: dán **URL-THE-KT**.
6. TP.KT: đổi quyền OUTSIDER sang **Được sửa**.
7. OUTSIDER: tải lại Kho & chia sẻ.
8. OUTSIDER: + Thẻ mới → ô Kho.
9. TP.KT: bấm **✕** (Gỡ) cạnh OUTSIDER.
10. OUTSIDER: tải lại VCWIKI.

**Mong đợi:**
- Bước 2: báo **"Không tìm thấy người dùng với email này"**.
- Bước 4: giờ thấy các thẻ **đã duyệt** của Kho Kỹ thuật.
- Bước 5: mở được.
- Bước 7: kho Kỹ thuật có nhãn **Được sửa** và có nút **Nạp nguồn**.
- Bước 8: có Kho Kỹ thuật.
- Bước 10: không còn thấy thẻ của Kho Kỹ thuật.

### Q07 — Người không phải chủ kho không quản lý được kho
**Tài khoản:** KS.KT (Được sửa)
1. Kho & chia sẻ → thẻ Kho Kỹ thuật VCgarage.
2. Nếu có nút **Rời kho**: bấm → hộp xác nhận "Rời khỏi kho này?" → **Cancel**. Không rời thật.

**Mong đợi:**
- Bước 1: **không** có nút "Quản lý"; có "Xem thẻ", "Nạp nguồn", "Rời kho".
- Bước 2: vẫn là thành viên.

### Q08 — Kho công khai và rời kho
**Tài khoản:** TP.KD → NV.KT → NV.KD → TP.KD
1. TP.KD: Kho & chia sẻ → Kho Kinh doanh VCpart → Quản lý → bật ô **"Công khai trong công ty"**.
2. NV.KT: VCWIKI.
3. NV.KT: mở thẻ **"Chính sách chiết khấu đại lý 2026 (MẬT KINH DOANH)"**.
4. NV.KD: Kho & chia sẻ → Kho Kinh doanh → **Rời kho** → OK.
5. NV.KD: tải lại VCWIKI.
6. **Trả lại như cũ:** TP.KD tắt "Công khai trong công ty" và mời lại `nv.kd@uat.test` quyền **Được sửa**.

**Mong đợi:**
- Bước 2: giờ thấy 2 thẻ của Kho Kinh doanh.
- Bước 3: có Đề xuất sửa, **không** có Sửa / Xoá.
- Bước 4: rời được.
- Bước 5: vẫn thấy thẻ kinh doanh (vì kho đang công khai), nhưng chỉ ở mức xem.
- Ghi GÓP Ý nếu thấy việc một thẻ "MẬT KINH DOANH" có thể bị công khai chỉ bằng một ô tick là rủi ro (mức mật C0–C3 chưa áp dụng ở bản này).

### Q09 — Xoá kho: chỉ kho trống, không xoá kho cá nhân
**Tài khoản:** NV.KT
1. Kho & chia sẻ → **+ Kho chia sẻ mới** → tên "Kho thử xoá" → **Tạo kho**.
2. Quản lý → **Xoá kho** → OK.
3. Tạo lại "Kho thử xoá 2" → VCWIKI → + Thẻ mới vào kho này (tiêu đề "Thẻ trong kho thử") → Tạo thẻ → quay lại Kho & chia sẻ → Quản lý → **Xoá kho** → OK.
4. Kiểm tra kho cá nhân ★ khi mở Quản lý.

**Mong đợi:**
- Bước 2: kho biến mất.
- Bước 3: báo **"Kho còn dữ liệu — hãy xoá hoặc chuyển dữ liệu trước"**, kho còn nguyên.
- Bước 4: **không** có nút Xoá kho.

### Q10 — Đề xuất và hộp duyệt không lộ sang người ngoài
**Tài khoản:** NV.KT → OUTSIDER → GD.PART
1. NV.KT: mở "Checklist bảo dưỡng cấp 10.000 km" → Đề xuất sửa → thêm 1 dòng → tóm tắt "Thử quyền" → Gửi đề xuất → mở đề xuất ở Hộp duyệt → chép URL (**URL-DX**).
2. OUTSIDER: dán **URL-DX**.
3. GD.PART (người duyệt bước 2 của nhánh khác): dán **URL-DX**.
4. OUTSIDER: Hộp duyệt → 3 tab.

**Mong đợi:**
- Bước 2, 3: đều báo **"Không tìm thấy đề xuất"**.
- Bước 4: không thấy đề xuất nào của Kho Kỹ thuật.

### Q11 — Trang quản trị chỉ dành cho quản trị viên
**Tài khoản:** NV.KT → ADMIN
1. NV.KT: xem thanh bên.
2. NV.KT: gõ thẳng `http://127.0.0.1:5400/admin`.
3. NV.KT: mở **Cơ cấu tổ chức** (`/org`).
4. ADMIN: mở `/admin` và `/org`.

**Mong đợi:**
- Bước 1: không có nhóm "Quản trị" / mục "Người dùng & lĩnh vực".
- Bước 2: tự chuyển về **Tổng quan**.
- Bước 3: chỉ thấy tab **Sơ đồ tổ chức** và khung "Của tôi", **không** có nút Sửa / + Đơn vị / Nghỉ việc, không có tab Chức năng / Cấp bậc / Vai trò / Nhập Excel.
- Bước 4: thấy đủ.

### Q12 — Phiên đăng nhập
**Tài khoản:** NV.KT
1. Đăng nhập → tải lại trang (F5).
2. Đăng xuất → bấm nút **Quay lại** (Back) của trình duyệt → tải lại.
3. Đăng xuất → gõ thẳng `http://127.0.0.1:5400/wiki`.

**Mong đợi:**
- Bước 1: vẫn đăng nhập.
- Bước 2: về màn **Đăng nhập**, không xem được dữ liệu cũ.
- Bước 3: hiện màn Đăng nhập.

### Q13 — Kết quả học tập không lộ sang đồng nghiệp
**Tài khoản:** NV.KT → TTS.KT
1. NV.KT: **Học tập của tôi** → lộ trình "[MẪU] Lộ trình KTV mới — OBD cơ bản" → mở "Bài 1 — Đọc mã lỗi OBD" → **✎ Luyện tập** → chọn đáp án mọi câu → **Nộp bài**. Chép URL trang kết quả, nếu có dạng `/learn/attempts/...`.
2. NV.KT: quay lại Học tập của tôi → **Vào thi** → OK → làm 3 câu → **Nộp bài** → OK → **Xem kết quả**. Chép URL `/learn/attempts/...` → **URL-BAI-THI**.
3. TTS.KT (đồng nghiệp ngang cấp): dán **URL-BAI-THI**.
4. OUTSIDER: dán **URL-BAI-THI**.
5. TP.KT (cấp trên của người giao): dán **URL-BAI-THI**.

**Mong đợi:**
- Bước 3, 4: báo **"Không tìm thấy lượt làm"**. Thấy điểm của NV.KT là **LỖI Nghiêm trọng**.
- Bước 5: **xem được** bài làm (cấp trên trong cây quản lý).

### Q14 — Nhật ký truy cập khi người duyệt ngoài kho mở đề xuất (kiểm tra có ghi nhận)
**Tài khoản:** GD.GARAGE
1. Mở Hộp duyệt → Chờ tôi duyệt → mở đề xuất "Thử quyền" (từ Q10). Khi đề xuất ở bước 2 GD.GARAGE mới thấy, nên nếu cần hãy nhờ KS.KT duyệt bước 1 trước.
2. Ghi nhận trên giao diện có dấu hiệu nào cho biết lượt xem được ghi nhật ký không.

**Mong đợi:** giao diện hiện **chưa** có màn xem nhật ký truy cập (tính năng ORG-11 chưa làm). Ghi **CHẶN** kèm ghi chú "không có màn hình để kiểm". Đây không phải lỗi.

## Kết thúc gói

- Trả lại các thay đổi quyền ở Q08 như hướng dẫn.
- Viết báo cáo theo mẫu, mã gói **P02**.
