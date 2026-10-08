# P04 — Soạn bài học, ngân hàng câu hỏi, thiết kế lộ trình

> **Ưu tiên:** 4 · **Thời gian:** 60–75 phút · **Dữ liệu:** dựng lại trước khi chạy (`bash start_uat.sh --seed-only`) · **Cần AI:** không (các ca AI chỉ kiểm tra hệ thống báo đúng khi không có AI; chạy AI thật ở gói P10)

---

## Mục tiêu gói

Kiểm tra phía **người soạn**:

- câu hỏi ba loại và luật hợp lệ;
- bài học dựng từ thẻ đã duyệt, **ghim đúng phiên bản thẻ**;
- phát hành thì khoá, sửa bằng bản sao;
- trang **Thiết kế lộ trình** (form 6 ô) dựng nháp khi không có AI, lưu nháp, sửa tiếp ở màn Lộ trình học.

## Luật nghiệp vụ cần biết

1. Chỉ **người soạn** (có người dưới quyền, Biên tập viên, L&D) thấy tab **Ngân hàng câu hỏi** và nút **+ Bài học mới**.
2. **Câu hỏi:**
   - trắc nghiệm có **2–6 phương án**;
   - câu *một đáp án* có **đúng 1** phương án đúng; câu *nhiều đáp án* có ≥ 1;
   - câu tự luận cần **rubric ≥ 1 tiêu chí**, tổng điểm > 0;
   - mỗi câu gắn **≥ 1 thẻ đã duyệt**.
   Câu mới là *Nháp*; chỉ câu **Đã duyệt** mới vào luyện tập / thi. Sửa nội dung câu đã duyệt thì câu về nháp.
3. **Bài học:**
   - chỉ dùng **thẻ đã duyệt** mà người soạn xem được; lưu là **ghim phiên bản thẻ** lúc đó;
   - bản nháp chỉ người soạn thấy;
   - **Phát hành** thì khoá nội dung, muốn sửa phải **Tạo bản sao**;
   - bài lưu ở kho cá nhân thì chỉ mình xem, có cảnh báo.
4. **Thiết kế lộ trình:**
   - chỉ dùng thẻ **đã duyệt**, không phải C3, mà **người thiết kế và mọi người học đều xem được**;
   - không có AI thì dựng nháp bằng code, nhãn **"Không có AI — nháp dựng bằng code"**;
   - báo **"Thiếu tri thức"** theo nhánh + bậc;
   - điểm đạt mặc định **70**.

## Ca kiểm thử

### S01 — Người không phải người soạn chỉ xem bài đã phát hành
**Tài khoản:** NV.KT → **Thư viện bài học**

**Mong đợi:**
- **Không** có tab "Ngân hàng câu hỏi", **không** có "+ Bài học mới".
- Thấy 2 bài đã phát hành: "Bài 1 — Đọc mã lỗi OBD", "Bài 2 — Case hybrid không vào READY". Mỗi thẻ bài hiện số thẻ, số câu luyện tập, kho, người soạn.

### S02 — Luật hợp lệ của câu hỏi
**Tài khoản:** KS.KT → Thư viện bài học → tab **Ngân hàng câu hỏi** → **+ Câu hỏi mới**

Mỗi bước dưới đây là một lần thử độc lập: bấm **Lưu nháp** và ghi thông báo. Sau mỗi lần thử, sửa lại cho đúng rồi thử bước kế tiếp.

1. **Loại Một đáp án**, đề "Đèn check engine sáng liên tục nghĩa là gì?"; chỉ điền **1** phương án; gắn thẻ căn cứ "Mã lỗi DTC là gì".
2. Điền 3 phương án, đánh dấu **2** phương án đúng. Ô chọn là radio nên có thể không cho chọn 2; nếu vậy ghi "UI chặn".
3. Đổi **Loại** sang **Nhiều đáp án**, bỏ hết đánh dấu đúng.
4. Đổi sang **Tự luận**, xoá hết dòng rubric (nếu được), hoặc để điểm tối đa = 0.
5. Đề bài chỉ gồm dấu cách.
6. Không gắn thẻ căn cứ nào.
7. Loại Một đáp án, bấm **+ Phương án** tới khi đủ 6.
8. Sửa cho hợp lệ: 4 phương án, 1 đúng ("Có lỗi đang tồn tại, cần đọc mã"), thẻ căn cứ "Mã lỗi DTC là gì", Độ khó 2, Mức nhận thức "Hiểu". Bấm **Lưu nháp**.
9. Bấm **Duyệt** trên dòng câu đó.
10. Bấm **Sửa** câu đã duyệt, đổi chữ trong đề → lưu.

**Mong đợi:**
- Bước 1: "Câu trắc nghiệm cần 2–6 phương án".
- Bước 2: "Câu một đáp án phải có đúng 1 phương án đúng", hoặc UI chặn.
- Bước 3: "Câu nhiều đáp án cần ít nhất 1 phương án đúng".
- Bước 4: "Câu tự luận cần rubric ít nhất 1 tiêu chí" hoặc "Tổng điểm rubric phải lớn hơn 0".
- Bước 5: "Đề bài không được để trống".
- Bước 6: báo lỗi, không lưu. Ghi nguyên văn; nếu thông báo là **tiếng Anh** thì ghi LỖI Nhẹ.
- Bước 7: nút "+ Phương án" biến mất khi đủ 6.
- Bước 8: câu hiện trong ngân hàng với nhãn **Nháp**, "Một đáp án · Độ khó 2 · Hiểu", "Căn cứ: Mã lỗi DTC là gì (bản 1)".
- Bước 9: nhãn **Đã duyệt**, "duyệt: Hoàng Key Staff KT".
- Bước 10: form có câu "Câu đã duyệt: sửa nội dung sẽ đưa câu về nháp, cần duyệt lại." Sau khi lưu, câu về **Nháp**.

### S03 — Ô chọn thẻ chỉ có thẻ đã duyệt mình xem được
**Tài khoản:** KS.KT, form câu hỏi hoặc bài học mới, ô "Thẻ căn cứ" / "Thêm thẻ đã duyệt"
1. Gõ "làm mát" (thẻ đang **nháp**).
2. Gõ "chiết khấu" (thẻ của **Kho Kinh doanh**, KS.KT không xem được).
3. Gõ "ma loi" (không dấu).

**Mong đợi:**
- Bước 1, 2: đều "Không có thẻ đã duyệt nào khớp."
- Bước 3: tìm ra "Mã lỗi DTC là gì".

### S04 — Tạo bài học, bản nháp riêng tư, phát hành có xác nhận
**Tài khoản:** KS.KT → Thư viện bài học → **+ Bài học mới**
1. Kiểm tra ô **"Lưu vào kho"** mặc định.
2. Tên **"Bài 3 — Phanh và lực siết"**. Mục tiêu 2 dòng. Thêm thẻ "Thay má phanh: siết đúng lực" và "Checklist bảo dưỡng cấp 10.000 km". Dùng ↑ ↓ đổi thứ tự. Tick 1 câu luyện tập đã duyệt. Viết Diễn giải có **in đậm** → bấm **Xem trước**.
3. **Lưu nháp**.
4. NV.KT: Thư viện bài học.
5. KS.KT: **Sửa** bài nháp → **Phát hành**.
6. Bấm **Xác nhận phát hành**.
7. Mở bài vừa phát hành.

**Mong đợi:**
- Bước 1: mặc định là **kho chia sẻ** (Kho Kỹ thuật VCgarage), không phải kho cá nhân.
- Bước 2: Diễn giải hiện định dạng đậm.
- Bước 3: bài có nhãn **Nháp**, "2 thẻ", "1 câu luyện tập".
- Bước 4: **không** thấy "Bài 3".
- Bước 5: hộp xác nhận **trong trang**: "Phát hành bài học? Sau khi phát hành nội dung bị khoá — muốn sửa phải tạo bản sao." với nút "Xác nhận phát hành" / "Quay lại".
- Bước 6: chuyển sang trang bài, nhãn **Đã phát hành**.
- Bước 7: thẻ "Thay má phanh…" có nhãn **"bản 2"** (bản hiệu lực lúc soạn).

### S05 — Bài ở kho cá nhân có cảnh báo; tên toàn dấu cách bị chặn
**Tài khoản:** KS.KT → + Bài học mới
1. Tên chỉ gồm dấu cách, thêm 1 thẻ → **Lưu nháp**.
2. Tên "Bài riêng", đổi "Lưu vào kho" sang kho cá nhân ★.
3. Bấm **Phát hành**.
4. Bấm **Quay lại** (không phát hành).

**Mong đợi:**
- Bước 1: báo **"Tên bài học không được để trống"**.
- Bước 2: hiện gợi ý "Kho cá nhân — chỉ bạn xem được bài học này…".
- Bước 3: hộp xác nhận có thêm cảnh báo "Bài trong kho cá nhân — chỉ bạn xem được…", nút đổi thành **"Vẫn phát hành (chỉ mình tôi xem)"**.
- Bước 4: bài vẫn chưa phát hành.

### S06 — Bài đã phát hành bị khoá, sửa bằng bản sao
**Tài khoản:** KS.KT
1. Thư viện: "Bài 1 — Đọc mã lỗi OBD".
2. Bấm **Tạo bản sao**.
3. Đổi tên thành "Bài 1 (bản 2026)" → Lưu nháp.

**Mong đợi:**
- Bước 1: **không** có nút Sửa, chỉ có **Tạo bản sao**.
- Bước 2: form tiêu đề "Bản sao của “Bài 1 — Đọc mã lỗi OBD”", tên gợi ý "… (bản sao)", giữ nguyên thẻ và câu luyện tập.
- Bước 3: bản sao là Nháp; bài gốc không đổi.

### S07 — Bài học ghim phiên bản thẻ khi thẻ lên bản mới
**Tài khoản:** NV.KT → KS.KT → GD.GARAGE → NV.KT
1. NV.KT: VCWIKI → "Thay má phanh: siết đúng lực" → **Đề xuất sửa** → thêm câu "Kiểm tra lại sau 50 km." → tóm tắt "Thêm kiểm tra lại" → Gửi đề xuất.
2. KS.KT duyệt bước 1 (Hộp duyệt). GD.GARAGE duyệt bước 2. Thẻ lên **bản 3**.
3. NV.KT (hoặc KS.KT): mở "Bài 3 — Phanh và lực siết" (từ S04).

**Mong đợi:**
- Bước 3:
  - Thẻ trong bài vẫn hiện nội dung **bản 2** (không có câu "Kiểm tra lại sau 50 km"), nhãn "bản 2".
  - Kèm cảnh báo **"thẻ đã có bản 3"**.
- Việc bài tự chuyển "Cần cập nhật" và báo người soạn **chưa làm** (LRN-11). Không ghi lỗi nếu không có, chỉ ghi nhận.

### S08 — Thiết kế lộ trình khi không có AI
**Tài khoản:** KS.KT → **Thiết kế lộ trình**
1. Điền form:
   - **1. Đối tượng:** để Cấp bậc theo hồ sơ; tick người học **Vũ Nhân Viên KT** và **Đỗ Thực Tập KT**. Danh sách người học chỉ có 2 người này.
   - **2. Mục tiêu:** "Đọc và xử lý đúng mã lỗi OBD trong 15 phút".
   - **3. Thời lượng:** Lộ trình tháng, tháng sau.
   - **4.** Giờ học mỗi tuần: 3.
   - **5. Nhánh bắt buộc:** `nen.ky-thuat`.
   - **6.** Cách đánh giá: "thi cuối tháng 10 câu".
   - Xem ô **Điểm đạt (%)**.
2. Đọc ô **"Prompt gửi AI"**.
3. Sửa tay 1 chữ trong ô prompt.
4. Bấm **AI dựng lộ trình nháp**.
5. Kiểm tra các thẻ trong nháp.

**Mong đợi:**
- Bước 1: Điểm đạt mặc định **70**.
- Bước 2: tự ghép các dòng "Đối tượng: …", "Mục tiêu sau kỳ: …", "Thời lượng: tháng …", "Số giờ học mỗi tuần: 3", "Nhánh bắt buộc: nen.ky-thuat", "Đánh giá: …, điểm đạt 70".
- Bước 3: xuất hiện link **"Ghép lại từ form"**.
- Bước 4:
  - Hiện "Bản nháp lộ trình" với nhãn **"Không có AI — nháp dựng bằng code"**, dòng "Lý do: AI chưa sẵn sàng: …".
  - Các tuần có bài, mỗi bài có thẻ kèm "· bản N · <bậc> · <loại>".
  - Có khung **"Thiếu tri thức (N)"** (có thể 0).
- Bước 5: chỉ có thẻ **đã duyệt** của Kho Kỹ thuật (không có thẻ "[NHÁP]…", không có thẻ Kho Kinh doanh), và chỉ thẻ thuộc nhánh Kỹ thuật ô tô.

### S09 — Bắt lỗi form thiết kế
**Tài khoản:** KS.KT, trang Thiết kế lộ trình → **+ Lộ trình mới**
1. Nhánh bắt buộc: `abc-khong-co` → AI dựng lộ trình nháp.
2. Nhánh bắt buộc: `qt.sai dang` → dựng.

**Mong đợi:**
- Bước 1: "Nhánh “abc-khong-co” không có trong cây lĩnh vực".
- Bước 2: báo sai dạng chuỗi quy trình (ghi nguyên văn).

### S10 — Lưu nháp thiết kế → sửa tiếp ở màn Lộ trình học → quay lại thiết kế
**Tài khoản:** KS.KT (tiếp S08, mở lại bản nháp qua ô "Mở bản nháp đã có" nếu cần)
1. Sửa **Tên lộ trình** thành "OBD tháng sau (AI nháp)". Đổi tên 1 bài. Bỏ 1 thẻ bằng ✕ "Bỏ thẻ".
2. Ô "Lưu bài học vào kho": chọn **Kho Kỹ thuật VCgarage** → **Lưu nháp**.
3. Vào **Lộ trình học**.
4. Mở lộ trình → thêm 1 tuần với "Bài 2 — Case hybrid…" → tick Có bài thi, ma trận Một đáp án · 2 → **Lưu nháp**.
5. Quay lại **Thiết kế lộ trình** → ô "Mở bản nháp đã có" → chọn lộ trình này.
6. Bấm **Lưu nháp** (không tick ghi đè).

**Mong đợi:**
- Bước 2: "Đã lưu nháp: N bài học nháp." và link "Bài học nháp: #1 #2…".
- Bước 3: lộ trình có nhãn **Nháp**, **AI dựng**.
- Bước 5: có ghi chú **"Lộ trình đã được sửa ở màn Lộ trình lúc …"** và ô tick **"Ghi đè theo bản thiết kế…"**.
- Bước 6: thông báo có ý "Giữ 1 bài thêm ở màn Lộ trình…". Tuần / bài thêm tay **không** bị mất: mở lại màn Lộ trình để kiểm.

### S11 — Sinh câu hỏi bằng AI khi không có AI
**Tài khoản:** KS.KT, Thiết kế lộ trình → khung **"AI sinh câu hỏi cho một thẻ"**
1. Chọn thẻ "Quy trình đọc lỗi bằng máy chẩn đoán OBD", Số câu 2 → **AI sinh câu hỏi**.

**Mong đợi:** báo lỗi rõ ràng có ý "AI chưa sẵn sàng: …". Không treo, không trang trắng, không tạo câu rác.

### S12 — Lộ trình tay: điểm đạt mặc định 70, mục bắt buộc phải nằm trong lộ trình
**Tài khoản:** KS.KT → Lộ trình học → + Lộ trình mới
1. Tên "Kiểm tra mặc định", Tháng → Tạo bản nháp.
2. Tick **Có bài thi**.
3. Thêm tuần + Bài 1, tick **bắt buộc**, rồi bấm **✕ Bỏ bài** ở chính bài đó → Lưu nháp.
4. Tên lộ trình để toàn dấu cách → Lưu nháp.

**Mong đợi:**
- Bước 2: Thời gian 30, **Điểm đạt 70**, Số lượt thi 1, ma trận mặc định 1 dòng.
- Bước 3: lưu được; mục bắt buộc cũng bị bỏ theo. Nếu báo "Mục bắt buộc phải nằm trong lộ trình…" cũng ĐẠT.
- Bước 4: phải bị chặn hoặc báo lỗi. Nếu **lưu được lộ trình không tên** thì ghi LỖI Trung bình (nghi vấn đã biết).

## Kết thúc gói

Viết báo cáo theo mẫu, mã gói **P04**.
