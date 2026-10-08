# P06 — VCWIKI: tạo thẻ, phân loại, tìm kiếm, lọc, sao chép, lịch sử, tương tác

> **Ưu tiên:** 6 · **Thời gian:** 40–50 phút · **Dữ liệu:** dựng lại trước khi chạy (`bash start_uat.sh --seed-only`) · **Cần AI:** không

---

## Mục tiêu gói

Kiểm tra phần dùng hằng ngày của VCWIKI:

- tạo / sửa / xoá thẻ nháp với đủ trường phân loại (lĩnh vực 4 tầng, cấp độ, division, bước quy trình, ngày hiệu lực, chu kỳ rà soát);
- tìm không dấu, bộ lọc, cây lĩnh vực, chế độ xem;
- sao chép thẻ sang kho khác;
- lịch sử phiên bản;
- bình luận, chấm sao, danh sách phát.

Phần duyệt đã có ở P01.

## Luật nghiệp vụ cần biết

- Thẻ mới luôn là **Nháp**.
- Chỉ người **Được sửa / Chủ kho** thấy "+ Thẻ mới" với kho đó.
- Thẻ đã duyệt không có nút Xoá (thay bằng đề xuất lỗi thời).
- Lĩnh vực chỉ nhận nhánh có trong cây. **Lọc một nhánh ra cả nhánh con.**
- Bước quy trình tối đa 2.
- Tìm kiếm **không phân biệt dấu**.

## Ca kiểm thử

### W01 — Tạo thẻ đủ trường phân loại
**Tài khoản:** NV.KT → VCWIKI → **+ Thẻ mới**
1. Để trống Tiêu đề.
2. Điền form:
   - Kho: **Kho Kỹ thuật VCgarage**; Loại: **Checklist**; Tiêu đề **"Checklist giao xe cho khách"**.
   - Lĩnh vực: mở bộ chọn, chọn 1 nhánh tầng 3 trong "0.3 Dịch vụ garage" → **Xong**.
   - Cấp độ người đọc: **Thực thi**; Ngày hiệu lực: ngày mai; Rà soát (tháng): 6.
   - Division: tick **VCservice**.
   - Bước quy trình: chọn 3 bước.
3. Bỏ bớt còn 1 bước. Điền:
   - Tóm tắt "5 việc trước khi giao xe".
   - Nội dung (markdown) "- Rửa xe\n- Kiểm tra đèn\n- Giải thích hạng mục đã làm", có dùng **in đậm**.
   - Ý chính 2 dòng; Tag "giao-xe, cskh".
   - Bấm **Tạo thẻ**.

**Mong đợi:**
- Bước 1: nút "Tạo thẻ" bị mờ.
- Bước 2: khi chọn bước thứ 3, báo "Chỉ chọn tối đa 2 bước — bỏ bớt một bước trước khi chọn bước khác".
- Bước 3:
  - "Đã tạo thẻ", ngăn thẻ mở với nhãn **Nháp**, "Viết tay".
  - Nội dung hiện định dạng markdown.
  - Các trường phân loại hiện đúng.

### W02 — Tìm không dấu và các bộ lọc
**Tài khoản:** NV.KT → VCWIKI

Ghi số thẻ ở dòng "… N thẻ" sau mỗi bước:
1. Tìm `ma loi` (không dấu).
2. Xoá tìm. Loại thẻ = **SOP**.
3. Về "Mọi loại". Trạng thái = **Nháp**.
4. Về mặc định. Cấp độ = **Nhập môn**.
5. Division = **VCpart**.
6. Tag chọn **#obd**.
7. Cây lĩnh vực bên trái: bấm "Nền ngành ô tô & sản phẩm VCPV" (tầng 1).
8. Bấm tiếp nhánh con "Kỹ thuật ô tô".
9. Đổi chế độ xem **Lộ trình** ↔ **Lưới**.
10. Tải lại trang.

**Mong đợi:**
- Bước 1: ra "Mã lỗi DTC là gì".
- Bước 2: chỉ thẻ SOP (Quy trình đọc lỗi OBD, [NHÁP] làm mát).
- Bước 3: chỉ thẻ nháp.
- Bước 4: có "Mã lỗi DTC là gì".
- Bước 5: 0 thẻ (NV.KT không xem được kho Kinh doanh), hiện câu trống "Chưa có thẻ nào khớp…".
- Bước 6: 2 thẻ OBD.
- Bước 7: ra **cả thẻ ở nhánh con** (DTC, OBD, phanh, hybrid…).
- Bước 8: thu hẹp.
- Bước 9: chế độ Lộ trình xếp theo bậc "A. Nhập môn → B. Thực thi…". Lưới hiện dạng ô.
- Bước 10: vẫn nhớ chế độ xem vừa chọn.

### W03 — Sửa, loại, về nháp, xoá thẻ nháp
**Tài khoản:** NV.KT, thẻ "Checklist giao xe cho khách" (W01)
1. **Sửa** → đổi tiêu đề thành "Checklist giao xe cho khách (v2)" → **Lưu**.
2. **Loại**.
3. **Về nháp**.
4. **Xoá** → hộp xác nhận "Xoá thẻ này?" → **Cancel**.
5. **Xoá** → OK.
6. Mở thẻ đã duyệt "Mã lỗi DTC là gì".

**Mong đợi:**
- Bước 1: "Đã lưu".
- Bước 2: nhãn Loại. Thẻ chưa gửi duyệt nên không hỏi lý do.
- Bước 3: về Nháp.
- Bước 4: vẫn còn thẻ.
- Bước 5: thẻ biến mất khỏi danh sách.
- Bước 6: **không** có Sửa / Xoá.

### W04 — Sao chép thẻ sang kho khác
**Tài khoản:** NV.KT, thẻ "Mã lỗi DTC là gì"
1. Hàng "Sao chép sang" → chọn kho cá nhân ★ → **Sao chép**.
2. Mở bản sao.

**Mong đợi:**
- Bước 1: tạo bản sao trong kho cá nhân, nhãn **Nháp**, nguồn gốc "Sao chép".
- Bước 2: nội dung giống gốc; thẻ gốc không đổi.

### W05 — Lịch sử phiên bản
**Tài khoản:** NV.KT, thẻ "Thay má phanh: siết đúng lực" → tab **Lịch sử**
1. Xem danh sách bản.
2. **Xem** Bản 1 → **Đóng bản xem**.
3. So sánh bản 1 với bản 2 → **So sánh**.
4. So sánh bản 2 với bản 2.

**Mong đợi:**
- Bước 1: Bản 2 (**Hiệu lực**, lý do "Sửa lực siết theo tài liệu hãng"), Bản 1 ("Bản đầu (dữ liệu UAT)"). Mỗi bản có người viết, "Duyệt: …", ngày.
- Bước 2: vùng "Bản 1 — Thay má phanh…" có nội dung "…30 N·m.".
- Bước 3: vùng "Bản 1 → bản 2" chỉ ra dòng Nội dung chi tiết thay đổi.
- Bước 4: "Hai bản có nội dung giống nhau."

### W06 — Bình luận, chấm sao, bảng bình chọn
**Tài khoản:** NV.KT → TTS.KT → NV.KT
1. NV.KT: thẻ "Checklist bảo dưỡng cấp 10.000 km" → mục **Thảo luận** → gõ "Nên thêm kiểm tra gạt mưa" → **Gửi**.
2. Chấm **4 sao**.
3. TTS.KT: mở cùng thẻ → **Trả lời** bình luận "Đồng ý" → chấm 5 sao.
4. NV.KT: xoá bình luận của mình → hộp xác nhận "Xoá bình luận này?" → OK.
5. **Bình chọn tháng** (menu).

**Mong đợi:**
- Bước 2: dòng "· bạn chấm 4 sao".
- Bước 3: điểm trung bình cập nhật.
- Bước 4: bình luận biến mất; thử xem có xoá được bình luận của TTS.KT không, và ghi lại.
- Bước 5: bảng tháng hiện người nhận sao / người bình luận, có dòng "(bạn)" ở chính mình; các ô thống kê có số.

### W07 — Danh sách phát từ VCWIKI
**Tài khoản:** NV.KT
1. VCWIKI → tìm "obd" → **▶ Lưu thành danh sách phát**. Hộp nhập tên: "Ôn OBD" → OK.
2. Quay lại VCWIKI → mở thẻ "Mã lỗi DTC là gì" → **≡+ Danh sách phát** → tick "Ôn OBD".
3. Trong trang danh sách: dùng ↑ ↓ đổi thứ tự; ✕ bỏ 1 thẻ.
4. Bấm ▶.
5. Menu **Danh sách phát** → xem danh sách → **Xoá danh sách** → OK.

**Mong đợi:**
- Bước 1: mở trang phát "Ôn OBD" với các thẻ vừa lọc, "Thẻ 1/N".
- Bước 2: thẻ được thêm vào danh sách.
- Bước 4: có thể cần mạng để tạo giọng đọc. Nếu báo "Máy chủ chưa tạo được giọng đọc — đang dùng giọng tiếng Việt của trình duyệt" hoặc không đọc được thì ghi **CHẶN (cần mạng / edge-tts)**, không phải lỗi.
- Bước 5: danh sách biến mất; thẻ vẫn còn trong VCWIKI.

### W08 — Bản đồ tri thức
**Tài khoản:** NV.KT → **Bản đồ tri thức**
1. Xem đồ thị.
2. Rê chuột vào nút **✦ AI phân tích chủ đề**.
3. Bấm vào một nút thẻ trên đồ thị.
4. Bỏ tick lớp **Tag**.
5. Bấm **⤓ Xuất Obsidian vault**.

**Mong đợi:**
- Bước 1: có các nút thẻ, lĩnh vực, tag; dòng "N thẻ".
- Bước 2: nút bị mờ, tooltip "AI chưa sẵn sàng (thiếu ANTHROPIC_API_KEY)".
- Bước 3: panel bên hiện tiêu đề, tóm tắt, "Mở thẻ".
- Bước 4: các nút tag biến mất.
- Bước 5: tải file .zip (ghi nhận có tải hay không).
- Chỉ có thẻ NV.KT xem được (không có thẻ kho Kinh doanh).

## Kết thúc gói

Viết báo cáo theo mẫu, mã gói **P06**.
