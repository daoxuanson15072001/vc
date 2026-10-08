# P01 — Duyệt tri thức 2 bước (đề xuất, bốn mắt, phiên bản)

> **Ưu tiên:** 1 (lõi, phức tạp nhất) · **Thời gian:** 60–90 phút · **Dữ liệu:** dựng lại trước khi chạy (`bash start_uat.sh --seed-only`) · **Cần AI:** không

---

## Mục tiêu gói

Kiểm tra toàn bộ vòng đời một thẻ VCWIKI:

- nháp → gửi duyệt → duyệt bước 1 → duyệt bước 2 → thành phiên bản;
- đề xuất sửa thẻ đã duyệt, quay về bản cũ, cho lỗi thời;
- các luật an toàn: bốn mắt, chọn người duyệt bước 2 theo bậc thẻ, người duyệt ngoài kho chỉ thấy việc được giao, cần cập nhật khi thẻ đã lên bản mới.

## Luật nghiệp vụ cần biết (để phán ĐẠT / LỖI)

1. **Thẻ đã duyệt không bao giờ bị sửa trực tiếp.** Mọi thay đổi là một *đề xuất*. Thẻ giữ nguyên nội dung tới khi đề xuất được duyệt đủ bước, rồi lên *bản* mới.
2. **Hai bước duyệt** (cài đặt "Số người duyệt tối thiểu" = 2, mặc định):
   - **Bước 1:** người có quyền **Được sửa** hoặc **Chủ kho** trong kho chứa thẻ, và không phải tác giả.
   - **Bước 2** chọn theo bậc thẻ:
     - Bậc *Nhập môn / Thực thi / Vận hành*: **chủ nhánh tầng 2** của lĩnh vực đầu tiên. Thẻ kỹ thuật là GD.GARAGE. Nhánh chưa có chủ thì là ADMIN.
     - Bậc *Thiết kế / Điều hành*: **TGĐ, tạm thời là ADMIN**.
   - **Quay về bản cũ, lỗi thời:** bước 2 là **chủ sở hữu lĩnh vực** (chủ nhánh gần nhất).
3. **Bốn mắt:**
   - Tác giả không duyệt được bước nào. Tác giả là người tạo thẻ, người đã sửa nội dung thẻ nháp, và người đề xuất.
   - Người đã duyệt bước 1 không duyệt được bước 2.
4. **Người duyệt bước 2 ở ngoài kho** (GD.GARAGE, ADMIN không ở trong kho Kỹ thuật):
   - Chỉ thấy đề xuất **mình được giao**. Nội dung thẻ hiện ngay trong đề xuất; tên thẻ không phải link.
   - Mở thẻ trong VCWIKI thì báo không tìm thấy.
   - Đề xuất không được giao cho họ: báo **"Không tìm thấy đề xuất"**.
5. Hai đề xuất dựng trên cùng một bản: đề xuất được duyệt trước làm đề xuất còn lại chuyển **"Cần cập nhật"**.
6. **Từ chối** bắt buộc có lý do. **Thẻ lỗi thời** không nhận đề xuất sửa, lỗi thời hay quay về.

**Nhãn trên giao diện (để tìm đúng chỗ bấm):**
- Menu **Hộp duyệt** (nhóm "Duyệt tri thức") có 3 tab: **Chờ tôi duyệt (N)** · **Tôi đề xuất** · **Gần đây**.
- Trong chi tiết đề xuất: ô **"Nhận xét / lý do"**, các nút **✓ Duyệt** · **Từ chối** · **Nhận xét** · **Rút đề xuất** · **Cập nhật lên bản mới**, và dòng "Bước 1: … · Bước 2: … · Đang ở Bước X/2".
- Ngăn chi tiết thẻ bên phải ở trang **VCWIKI**:
  - tab **Nội dung** / **Lịch sử**;
  - thẻ nháp có nút **Gửi duyệt**, **✓ Duyệt**, **Loại**, **Sửa**, **Xoá**;
  - thẻ đã duyệt có nút **Đề xuất sửa**, **Đề xuất lỗi thời**;
  - khung **"Trạng thái duyệt"** hiện kết quả sau khi bấm.
- Tìm thẻ bằng ô **"Tìm trong thẻ — gõ không dấu cũng được"** ở trang VCWIKI, rồi bấm vào thẻ để mở ngăn chi tiết.

## Ca kiểm thử (làm đúng thứ tự)

### D01 — Tác giả gửi duyệt, không tự duyệt được
**Tài khoản:** NV.KT
1. VCWIKI → tìm "làm mát" → mở thẻ **"[NHÁP] Quy trình kiểm tra hệ thống làm mát"**. Thẻ có nhãn *Nháp*.
2. Bấm **Gửi duyệt**.
3. Mở **Hộp duyệt** → tab **Tôi đề xuất** → bấm vào đề xuất vừa tạo.

**Mong đợi:**
- Bước 2: khung "Trạng thái duyệt" có dòng "Đã gửi duyệt — cổng so sánh đang chạy nền" và "Đang chờ duyệt: bước 1/2".
- Bước 3:
  - Đề xuất có nhãn **Thẻ mới** và **Bước 1/2**.
  - Dòng các bước ghi **Bước 2: Chủ nhánh tầng 2 (Lê Giám Đốc Garage)**.
  - Có chữ **"Bạn không phải người duyệt của bước này (không tự duyệt đề xuất của mình)"** và **không** có nút ✓ Duyệt.
- Phần "Cổng so sánh" có kết quả (vd MỚI) kèm ghi chú "Luật đơn giản (tạm — sẽ chạy lại khi AI sẵn sàng)", hoặc đang "Đang so sánh…". Chấp nhận cả hai.
- Ghi lại URL của đề xuất (dạng `/wiki/review?change=...`) để dùng ở D05.

### D02 — Người duyệt bước 1 (trong kho)
**Tài khoản:** KS.KT
1. Hộp duyệt → **Chờ tôi duyệt**. Số trong ngoặc ≥ 1. Mở đề xuất "[NHÁP] Quy trình kiểm tra hệ thống làm mát".
2. Gõ nhận xét "Nội dung ổn, chuyển bước 2" → bấm **✓ Duyệt**.

**Mong đợi:**
- Thông báo "Đã ghi duyệt".
- Nhãn đổi thành **Bước 2/2**.
- Mục "Lượt duyệt và nhận xét" có dòng KS.KT · Bước 1 · Duyệt.
- KS.KT **không còn** nút ✓ Duyệt cho đề xuất này, và đề xuất biến khỏi tab "Chờ tôi duyệt" (tải lại trang để chắc).

### D03 — Chủ kho không phải người duyệt bước 2
**Tài khoản:** TP.KT
1. Hộp duyệt → **Chờ tôi duyệt**.
2. Tab **Gần đây** → mở đề xuất "[NHÁP] Quy trình kiểm tra hệ thống làm mát".

**Mong đợi:**
- Bước 1: đề xuất này **không** có trong "Chờ tôi duyệt", vì bước 2 chỉ dành cho GD.GARAGE.
- Bước 2: xem được, nhưng không có nút ✓ Duyệt.

### D04 — Người duyệt bước 2 ở ngoài kho
**Tài khoản:** GD.GARAGE
1. Hộp duyệt → **Chờ tôi duyệt** → mở đề xuất.
2. Kiểm tra:
   - có câu "Bạn duyệt thẻ này nhưng không ở trong kho chứa thẻ — nội dung thẻ nằm ngay trong đề xuất bên dưới";
   - tên thẻ ở đầu **không** phải link;
   - nội dung thẻ hiện đầy đủ bên dưới.
3. Bấm **✓ Duyệt**.
4. Vào **VCWIKI** → tìm "làm mát".

**Mong đợi:**
- Bước 3: báo "Đã ghi duyệt", đề xuất có nhãn **Đã duyệt** và dòng **"Đã thành bản 1 của thẻ."**
- Bước 4: GD.GARAGE **không** thấy thẻ này, vì không ở trong kho. Trong danh sách chỉ có thẻ "Nội quy an toàn xưởng cho nhân sự mới" của kho công khai.

### D05 — Người ngoài kho không xem được đề xuất không được giao
**Tài khoản:** TP.KD (kho khác, không liên quan)
1. Dán URL đề xuất đã ghi ở D01 vào thanh địa chỉ.

**Mong đợi:** báo **"Không tìm thấy đề xuất"**. Không lộ tên hay nội dung thẻ. Nếu thấy nội dung là **LỖI Nghiêm trọng**.

### D06 — Kết quả phía tác giả
**Tài khoản:** NV.KT
1. VCWIKI → mở lại thẻ "[NHÁP] Quy trình kiểm tra hệ thống làm mát" (tiêu đề vẫn có chữ [NHÁP] vì là tên thẻ).
2. Tab **Lịch sử**.

**Mong đợi:**
- Nhãn trạng thái **Đã duyệt**, có "Bản 1".
- Nút **Đề xuất sửa**, **Đề xuất lỗi thời** thay cho Sửa / Xoá.
- Tab Lịch sử có "Bản 1" với nhãn **Hiệu lực**, dòng "Duyệt: Hoàng Key Staff KT, Lê Giám Đốc Garage" (hoặc tương đương).

### D07 — Từ chối bắt buộc có lý do
**Tài khoản:** KS.KT, rồi NV.KT, rồi KS.KT
1. KS.KT: VCWIKI → mở thẻ **"[NHÁP] Khách gara ưu tiên báo giá rõ trước khi sửa"** (tác giả KS.KT) → **Gửi duyệt**. Ghi lại dòng "Bước 2: …" trong đề xuất; mong đợi là Quản trị viên, vì nhánh chưa có chủ.
2. Đăng xuất → NV.KT → Hộp duyệt → Chờ tôi duyệt → mở đề xuất đó.
3. Để trống ô "Nhận xét / lý do" → bấm **Từ chối**.
4. Gõ lý do "Chưa có số liệu chứng minh" → **Từ chối**.
5. Đăng xuất → KS.KT → mở lại thẻ.

**Mong đợi:**
- Bước 3: báo **"Từ chối cần ghi lý do"**, đề xuất vẫn mở.
- Bước 4: "Đã từ chối", nhãn **Từ chối**, lý do hiện trong lịch sử nhận xét.
- Bước 5: thẻ có nhãn **Loại** và nút **Về nháp**.

### D08 — Người sửa thẻ nháp trở thành tác giả, lượt duyệt cũ bị huỷ
**Tài khoản:** NV.KT → KS.KT → NV.KT → KS.KT
1. NV.KT: VCWIKI → **+ Thẻ mới**.
   - Kho: **Kho Kỹ thuật VCgarage**; Loại thẻ: SOP; Tiêu đề: **"Kiểm tra lốp trước chuyến đi xa"**.
   - Lĩnh vực: chọn nhánh bất kỳ trong "0.1 Kỹ thuật ô tô".
   - Cấp độ người đọc: Thực thi; Tóm tắt: "3 bước kiểm tra lốp"; Nội dung: "1. Áp suất 2. Gai lốp 3. Vết nứt".
   - Bấm **Tạo thẻ** → **Gửi duyệt**.
2. KS.KT: Hộp duyệt → duyệt **bước 1** đề xuất này.
3. NV.KT: mở thẻ → **Sửa** → thêm vào nội dung dòng "4. Lốp dự phòng" → **Lưu**.
4. KS.KT: Hộp duyệt → Gần đây → mở đề xuất.
5. Thử tình huống ngược: KS.KT mở thẻ → **Sửa** → sửa một chữ trong Tóm tắt → **Lưu**. Rồi vào Hộp duyệt mở lại đề xuất.

**Mong đợi:**
- Bước 3: lượt duyệt bước 1 bị xoá.
- Bước 4:
  - Có nhận xét của "Hệ thống": "Thẻ nháp được sửa sau khi đã có lượt duyệt — duyệt lại từ bước 1".
  - Đề xuất quay về **Bước 1/2** và nằm lại trong "Chờ tôi duyệt" của KS.KT.
- Bước 5: KS.KT đã sửa nội dung nên thành tác giả. Không còn nút ✓ Duyệt, có chữ "Bạn không phải người duyệt của bước này…". TP.KT sẽ là người duyệt bước 1 được. Không cần duyệt tiếp.

### D09 — Đề xuất sửa thẻ đã duyệt (người chỉ xem cũng đề xuất được) + đổi mức thay đổi
**Tài khoản:** TTS.KT → KS.KT → GD.GARAGE → TTS.KT
1. TTS.KT (quyền Chỉ xem): VCWIKI → mở **"Checklist bảo dưỡng cấp 10.000 km"** → **Đề xuất sửa**.
2. Bấm **Gửi đề xuất** ngay, không sửa gì.
3. Thêm dòng "- Kiểm tra gạt mưa" vào nội dung.
   - "Tóm tắt thay đổi": "Bổ sung hạng mục gạt mưa".
   - "Mức thay đổi": **Lớn (major)**.
   - Bấm **Gửi đề xuất**.
4. Kiểm tra nội dung thẻ trong ngăn chi tiết.
5. KS.KT: Hộp duyệt → mở đề xuất → phần "So sánh thay đổi" → ô **Mức thay đổi** chọn **Nhỏ (minor)** → ✓ Duyệt.
6. GD.GARAGE: Hộp duyệt → ✓ Duyệt.
7. TTS.KT: mở lại thẻ → tab **Lịch sử** → chọn "So sánh bản" 1 với bản 2 → **So sánh**.

**Mong đợi:**
- Bước 2: báo **"Không có gì thay đổi so với bản hiệu lực"**, không tạo đề xuất.
- Bước 3: thông báo "Thẻ đã duyệt không sửa trực tiếp — đã tạo đề xuất sửa, chờ duyệt".
- Bước 4: nội dung thẻ **vẫn như cũ**, chưa có gạt mưa. Khung trạng thái có "Đề xuất «Bổ sung hạng mục gạt mưa» (Sửa nội dung): bước 1/2".
- Bước 5: đề xuất có dòng "Thay đổi" chỉ ra trường Nội dung chi tiết.
- Bước 6: "Đã thành bản 2 của thẻ".
- Bước 7:
  - Có Bản 2, lý do "Bổ sung hạng mục gạt mưa".
  - Phần so sánh hiện dòng gạt mưa được thêm.
  - Nội dung thẻ giờ đã có gạt mưa.

### D10 — Cần cập nhật khi thẻ đã lên bản mới (rebase)
**Tài khoản:** NV.KT, TTS.KT, KS.KT, GD.GARAGE
1. NV.KT: mở **"Case: xe hybrid báo lỗi hệ thống, không vào READY"** → Đề xuất sửa → sửa Tóm tắt thành "Ắc quy 12V yếu làm xe hybrid không vào READY" → tóm tắt thay đổi "Sửa tóm tắt" → Gửi đề xuất.
2. TTS.KT: cùng thẻ → Đề xuất sửa → thêm câu cuối nội dung "Đo ắc quy bằng đồng hồ vạn năng." → tóm tắt thay đổi "Thêm cách đo" → Gửi đề xuất.
3. KS.KT duyệt bước 1 đề xuất **của NV.KT**. GD.GARAGE duyệt bước 2 đề xuất đó.
4. TTS.KT: Hộp duyệt → **Tôi đề xuất** → mở đề xuất "Thêm cách đo".
5. TTS.KT bấm **Cập nhật lên bản mới**.

**Mong đợi:**
- Bước 4: nhãn **Cần cập nhật**, câu "Thẻ đã có phiên bản mới hơn bản đề xuất dựng trên." và nút **Cập nhật lên bản mới**. Đề xuất không còn trong "Chờ tôi duyệt" của KS.KT.
- Bước 5: "Đã cập nhật lên bản mới", nhận xét "Cập nhật lên bản N — duyệt lại từ bước 1", đề xuất về **Bước 1/2**.
- Duyệt tiếp là tuỳ chọn; nếu duyệt xong thì thẻ có cả hai thay đổi.

### D11 — Quay về bản cũ (rollback) qua đề xuất
**Tài khoản:** NV.KT → KS.KT → GD.GARAGE
1. NV.KT: mở **"Thay má phanh: siết đúng lực"** → tab **Lịch sử**. Có Bản 1 và Bản 2 (Hiệu lực).
2. Bấm **Xem** ở Bản 1: nội dung là "Siết bu-lông cùm phanh 30 N·m."
3. Bấm **Quay về bản này** ở Bản 1. Hộp nhập chữ hỏi lý do: gõ "Tài liệu hãng mới xác nhận 30 N·m" → OK.
4. Mở Hộp duyệt → Tôi đề xuất → mở đề xuất.
5. KS.KT duyệt bước 1 → GD.GARAGE duyệt bước 2.
6. NV.KT mở lại thẻ → Lịch sử.

**Mong đợi:**
- Bước 3: thông báo "Đã tạo đề xuất quay về bản 1 — chờ chủ sở hữu lĩnh vực duyệt". Thẻ **chưa** đổi.
- Bước 4: nhãn **Quay về bản cũ**, mặc định Thay đổi lớn, bước 2 là **Chủ sở hữu lĩnh vực** (Lê Giám Đốc Garage).
- Bước 6:
  - Có **Bản 3** (Hiệu lực), lý do bắt đầu bằng "Quay về bản 1: …".
  - Nội dung thẻ là "Siết bu-lông cùm phanh 30 N·m."
  - Bản 1, 2 vẫn còn, không bị xoá.

### D12 — Thẻ bậc Thiết kế cần TGĐ (ADMIN) duyệt bước 2
**Tài khoản:** NV.KT → GD.GARAGE → KS.KT → ADMIN
1. NV.KT: mở **"Khung mở rộng chuỗi xưởng dịch vụ"** → Đề xuất sửa → đổi "≥ 85%" thành "≥ 80%" trong nội dung → tóm tắt "Hạ ngưỡng công suất" → Gửi đề xuất.
2. Mở đề xuất (Tôi đề xuất) và xem dòng "Bước 2: …".
3. GD.GARAGE: Hộp duyệt → Chờ tôi duyệt.
4. KS.KT: duyệt bước 1.
5. ADMIN: Hộp duyệt → Chờ tôi duyệt → mở đề xuất → ✓ Duyệt.
6. ADMIN: VCWIKI → tìm "chuỗi xưởng".

**Mong đợi:**
- Bước 2: **"TGĐ (tạm thời: quản trị viên)"**.
- Bước 3: **không** có đề xuất này.
- Bước 5: có câu "Bạn duyệt thẻ này nhưng không ở trong kho chứa thẻ…"; sau khi duyệt, "Đã thành bản 2 của thẻ".
- Bước 6: ADMIN **không** thấy thẻ, vì quản trị viên không tự đọc nội dung kho người khác.

### D13 — Lỗi thời: đề xuất, duyệt, rồi bị khoá sửa
**Tài khoản:** TP.KT → KS.KT → ADMIN → NV.KT
1. TP.KT: mở **"KPI năng suất kỹ thuật viên"** → **Đề xuất lỗi thời**. Hộp nhập lý do: "Thay bằng KPI mới năm 2027" → OK.
2. KS.KT duyệt bước 1. ADMIN duyệt bước 2; nhánh "0.3 Dịch vụ garage" chưa có chủ nên là quản trị viên.
3. NV.KT: mở thẻ KPI.
4. NV.KT: tab Lịch sử → bấm **Quay về bản này** trên một bản bất kỳ (nếu có nút), gõ lý do "thử".

**Mong đợi:**
- Bước 1: "Đã tạo đề xuất lỗi thời — chờ duyệt". Đề xuất có nhãn **Lỗi thời** và câu "Thẻ sẽ được đánh dấu lỗi thời…".
- Bước 3: thẻ có nhãn **Lỗi thời** kèm lý do; **không còn** nút Đề xuất sửa / Đề xuất lỗi thời.
- Bước 4: báo lỗi **"Thẻ đã lỗi thời — không nhận đề xuất sửa / lỗi thời / quay về bản cũ"**. Nếu không có nút để bấm thì ghi ĐẠT kèm ghi chú "không có nút".

### D14 — Đổi kết quả cổng so sánh + đề xuất TRÙNG bị ẩn
**Tài khoản:** NV.KT → KS.KT
1. NV.KT: + Thẻ mới trong Kho Kỹ thuật.
   - Loại Khái niệm; tiêu đề **"Mã lỗi DTC là gì (bản trùng)"**.
   - Lĩnh vực giống thẻ "Mã lỗi DTC là gì"; Cấp độ Nhập môn.
   - Tóm tắt: chép y tóm tắt của thẻ gốc.
   - Tạo thẻ → **Gửi duyệt**.
2. NV.KT mở đề xuất (Tôi đề xuất).
3. KS.KT: Hộp duyệt → Chờ tôi duyệt → mở đề xuất → phần "Cổng so sánh" → ô **Đổi kết quả** chọn **TRÙNG**. Trước đó gõ lý do vào ô "Nhận xét / lý do": "Trùng thẻ DTC có sẵn".
4. KS.KT tải lại tab **Chờ tôi duyệt**.

**Mong đợi:**
- Bước 2: NV.KT **không** thấy ô "Đổi kết quả", vì chỉ người duyệt bước hiện tại được đổi.
- Bước 3: "Đã đổi kết quả", nhãn **TRÙNG**, dòng "· người sửa kết quả (AI: …)".
- Bước 4: đề xuất bị ẩn khỏi danh sách, có dòng "1 đề xuất cổng so sánh xếp TRÙNG / NHIỄU đang ẩn. **Hiện**". Bấm **Hiện** thì thấy lại.

### D15 — Nhận xét và rút đề xuất
**Tài khoản:** NV.KT
1. Mở đề xuất "Mã lỗi DTC là gì (bản trùng)" (Tôi đề xuất).
2. Bấm **Nhận xét** khi ô trống.
3. Gõ "Tôi rút vì trùng" → **Nhận xét**.
4. Gõ lý do "Trùng thẻ có sẵn" → **Rút đề xuất**.
5. Sau đó gõ nhận xét mới → **Nhận xét**.

**Mong đợi:**
- Bước 2: báo "Nhận xét trống".
- Bước 3: "Đã ghi nhận xét".
- Bước 4: "Đã rút đề xuất", nhãn **Đã rút**.
- Bước 5: bị từ chối với thông báo có ý "Đề xuất đã đóng — không nhận thêm nhận xét". Nếu ô nhập / nút đã bị ẩn thì ghi ĐẠT.

### D16 — Chế độ 1 người duyệt (dùng thử) — PHẢI trả lại cài đặt
**Tài khoản:** KS.KT → ADMIN → NV.KT → KS.KT → ADMIN
1. KS.KT: Hộp duyệt → ô **Số người duyệt tối thiểu** ở góc phải.
2. ADMIN: Hộp duyệt → đổi **Số người duyệt tối thiểu** thành **1 (dùng thử)**.
3. NV.KT: + Thẻ mới trong Kho Kỹ thuật, tiêu đề "Kiểm tra dầu phanh", lĩnh vực trong "0.1 Kỹ thuật ô tô", Cấp độ Thực thi → Tạo thẻ → Gửi duyệt.
4. KS.KT: mở đề xuất.
5. KS.KT bấm ✓ Duyệt.
6. **Bắt buộc:** ADMIN đổi lại **Số người duyệt tối thiểu = 2 (bước 1 + bước 2)** rồi tải lại trang để chắc đã lưu.

**Mong đợi:**
- Bước 1: ô bị khoá, vì chỉ quản trị viên được sửa.
- Bước 4: có câu "Dùng thử: 1 người duyệt là xong (bước 2 gộp vào bước 1)." và nhãn **Chờ 1 người duyệt**.
- Bước 5: đề xuất **Đã duyệt** ngay, "Đã thành bản 1 của thẻ". Lịch sử duyệt có dòng "Gộp bước 2 (số người duyệt tối thiểu = 1)".

### D17 — Duyệt thẳng từ ngăn thẻ, không qua Hộp duyệt
**Tài khoản:** NV.KT → TP.KT
1. NV.KT: + Thẻ mới "Vệ sinh cảm biến MAF" trong Kho Kỹ thuật, lĩnh vực trong "0.1 Kỹ thuật ô tô", Cấp độ Thực thi → **Tạo thẻ** (không gửi duyệt).
2. NV.KT bấm **✓ Duyệt** ngay trên thẻ của mình.
3. TP.KT: VCWIKI → mở thẻ đó → bấm **✓ Duyệt** trong ngăn thẻ.

**Mong đợi:**
- Bước 2: khung trạng thái báo "Đã gửi duyệt — bạn là tác giả nên không tự duyệt (bốn mắt)".
- Bước 3: "Đã duyệt bước 1 — chờ người duyệt bước 2". Khung trạng thái có "bước 2/2 — Chủ nhánh tầng 2".

### D18 — Bấm nhanh hai lần không tạo hai lượt duyệt
**Tài khoản:** GD.GARAGE
1. Hộp duyệt → mở đề xuất của thẻ "Vệ sinh cảm biến MAF" (bước 2).
2. Bấm **✓ Duyệt** hai lần thật nhanh liên tiếp.

**Mong đợi:**
- Chỉ **một** lượt duyệt bước 2 được ghi, thẻ lên Bản 1.
- Nếu hiện lỗi thì chỉ là "Đề xuất vừa được người khác xử lý — tải lại để xem trạng thái mới". Không có trang lỗi.

## Kết thúc gói

- Xác nhận "Số người duyệt tối thiểu" đang là **2**.
- Viết báo cáo theo mẫu ở PHẦN CHUNG, mã gói **P01**.
