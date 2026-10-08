# P03 — Học tập: lộ trình, giao bài, luyện tập, thi, chấm, phản hồi

> **Ưu tiên:** 3 (lõi, nhiều luật) · **Thời gian:** 75–100 phút (có 2 lần chờ hết giờ thi ~2 phút) · **Dữ liệu:** dựng lại trước khi chạy (`bash start_uat.sh --seed-only`) · **Cần AI:** không

---

## Mục tiêu gói

Chạy trọn vòng học tập, từ phía người học lẫn phía cấp trên:

- **Người học:** nhận lộ trình → đọc bài → luyện tập → thi có giờ → xem kết quả → gửi phản hồi.
- **Cấp trên:** tạo lộ trình → phát hành → giao đúng người trong cây dưới quyền → chấm tự luận → chốt điểm → trả lời phản hồi.
- **Luật quyền:** ai xem được điểm của ai.

## Luật nghiệp vụ cần biết

1. **Menu Học tập** hiện theo quyền:
   - *Thư viện bài học* và *Học tập của tôi*: mọi người.
   - *Thiết kế lộ trình* và *Lộ trình học*: người có người dưới quyền, hoặc có vai trò Biên tập viên / L&D.
   - *Chấm bài*: người có người dưới quyền, L&D, hoặc người đã từng giao lộ trình.
2. **Chỉ giao cho người trong cây dưới quyền** (theo người quản lý trực tiếp, mọi tầng) hoặc trong phạm vi L&D. KS.KT chỉ giao được cho NV.KT và TTS.KT.
3. **Bài học tính "đã học":**
   - bài **có câu luyện tập**: khi đã **nộp một lượt luyện tập**;
   - bài **không có câu luyện tập**: khi đã mở bài.
4. **Bài thi:**
   - đề rút ngẫu nhiên theo ma trận, xáo câu và phương án, có giờ;
   - tự lưu khi trả lời; hết giờ thì **tự nộp**;
   - số lượt thi mặc định 1.
5. **Chấm:**
   - bài **chỉ có trắc nghiệm** tự chốt điểm ngay khi nộp;
   - có tự luận thì chờ người chấm chốt.
   Người học **chỉ thấy điểm sau khi chốt**.
6. **Điểm đạt** là % tổng điểm, mặc định **70**. Đạt khi điểm / điểm tối đa × 100 ≥ 70. Trắc nghiệm: mỗi câu 1 điểm. Tự luận: điểm tối đa bằng tổng rubric (câu hybrid là 10).
7. **Chốt điểm tự luận:**
   - bắt buộc **nhận xét**;
   - điểm người chấm **lệch điểm AI ≥ 20% thang điểm câu** thì bắt buộc ghi lý do. Không có AI thì câu bỏ trống có "điểm AI" = 0 theo luật, nên cho > 2/10 điểm phải ghi lý do.
8. **Ai chốt điểm được:** chỉ người giao lộ trình hoặc quản lý trực tiếp của người học.
9. **Ai xem được bài làm:**
   - xem được: người học, mọi cấp trên trong cây quản lý, người giao, L&D trong phạm vi;
   - **đồng nghiệp ngang cấp không xem được** (báo "Không tìm thấy lượt làm").
10. **Phản hồi:** người học gửi **một lần** cho mỗi bài thi đã chốt; người chấm trả lời một lần.
11. **Đã hết lượt thi** mà vẫn chưa đạt thì lộ trình hiện "Hoàn thành" kèm "Chưa đạt". Đây là luật hiện tại; ghi GÓP Ý nếu thấy không hợp lý.

**Đáp án các câu trắc nghiệm có sẵn** (để chủ động làm đúng / sai):

| Câu hỏi | Đáp án đúng |
|---|---|
| Chữ cái P ở đầu mã lỗi DTC chỉ hệ thống nào? | Động cơ – hộp số (Powertrain) |
| Mã P0300 nghĩa là gì? | Bỏ máy ngẫu nhiên nhiều xi-lanh |
| Số thứ hai của mã DTC là 1 nghĩa là gì? | Mã riêng của hãng |
| Bước đầu tiên của quy trình đọc lỗi OBD? | Tắt máy, cắm đầu đọc vào cổng OBD |
| Những việc nào ĐÚNG khi đọc lỗi OBD? (nhiều đáp án) | Lưu dữ liệu freeze frame + Sửa xong mới xoá lỗi |

## Ca kiểm thử (làm đúng thứ tự)

### H01 — Menu học tập theo quyền
**Tài khoản:** NV.KT, KS.KT, OUTSIDER, HR.LND. Với mỗi người, xem nhóm menu **Học tập**.

**Mong đợi:**
- NV.KT, OUTSIDER: chỉ **Thư viện bài học**, **Học tập của tôi**.
- KS.KT, HR.LND: đủ 5 mục (**Thư viện bài học**, **Thiết kế lộ trình**, **Học tập của tôi**, **Lộ trình học**, **Chấm bài**).
- NV.KT gõ thẳng `/learn/design`: báo lỗi "Chỉ quản lý, biên tập viên (editor) hoặc L&D được soạn bài học và câu hỏi" (hoặc không cho dùng). Không được dựng được lộ trình.

### H02 — Trang Học tập của tôi
**Tài khoản:** NV.KT → **Học tập của tôi**

**Mong đợi:**
- Thống kê: "Lộ trình được giao" = 1.
- Nhóm "Tháng <tháng sau>/<năm>" có thẻ **"[MẪU] Lộ trình KTV mới — OBD cơ bản"**, "giao bởi Hoàng Key Staff KT", tiến độ **"Bài học 0/2"**, hạn cuối tháng đó.
- Tuần 1 "Mã lỗi": Bài 1 có nhãn **bắt buộc**, ghi "luyện tập 3 câu để hoàn thành".
- Tuần 2 "Tình huống": Bài 2.
- Khung "Bài thi cuối kỳ": "3 câu · 10 phút · đạt từ 70% · lượt thi 0/1", nút **Vào thi**.

### H03 — Mở bài không có câu luyện tập thì tính đã học
**Tài khoản:** NV.KT
1. Bấm "Bài 2 — Case hybrid không vào READY".
2. Quay lại Học tập của tôi.

**Mong đợi:**
- Bước 1:
  - Bài hiện mục tiêu, diễn giải, thẻ "Case: xe hybrid…" có nhãn "bản 1", link "Mở trong VCWIKI".
  - Không có nút Luyện tập; có "Bài học chưa có câu luyện tập đã duyệt."
- Bước 2: tiến độ **"Bài học 1/2"**, Bài 2 có ✓, trạng thái **Đang học**.

### H04 — Luyện tập: lưu nháp, làm tiếp, nộp thiếu câu, làm lại
**Tài khoản:** NV.KT
1. Mở "Bài 1 — Đọc mã lỗi OBD" → **✎ Luyện tập (3 câu)**.
2. Chỉ trả lời câu đầu tiên → **Lưu nháp, làm tiếp sau**.
3. Quay lại Học tập của tôi.
4. Mở lại Bài 1.
5. Bấm vào nút đó, trả lời thêm 1 câu (để trống 1 câu) → **Nộp bài**.
6. Hộp xác nhận → OK.
7. Bấm **↻ Làm lại**.
8. Quay lại Học tập của tôi.

**Mong đợi:**
- Bước 3: Bài 1 vẫn chưa ✓.
- Bước 4: nút đổi thành **"✎ Làm tiếp luyện tập"**.
- Bước 5:
  - Có dòng "Đang làm tiếp lượt luyện tập chưa nộp (bắt đầu …)".
  - Câu đầu **vẫn giữ** đáp án đã chọn.
  - Hộp xác nhận "Còn 1 câu chưa trả lời. Vẫn nộp bài?".
- Bước 6:
  - Hiện "Điểm trắc nghiệm" dạng x/3.
  - Mỗi câu có nhãn Đúng / Sai, đáp án đúng có ✓, có "Giải thích:".
  - Kiểm tra điểm khớp với số câu làm đúng theo bảng đáp án.
- Bước 7: bắt đầu lượt mới, không còn đáp án cũ.
- Bước 8: "Bài học 2/2" (Bài 1 đã ✓ vì đã nộp một lượt).
- Mục "Các lần luyện tập của tôi" trong Bài 1 liệt kê các lượt.

### H05 — Thi có giờ, tự lưu, tải lại trang không mất bài, chưa đạt
**Tài khoản:** NV.KT
1. Học tập của tôi → **Vào thi**. Hộp xác nhận "Bắt đầu bài thi? Bạn có 10 phút, hết giờ bài tự nộp." → OK.
2. Trả lời **đúng** câu đầu tiên theo bảng đáp án. Đợi 2–3 giây.
3. Tải lại trang (F5).
4. Trả lời 2 câu còn lại sao cho **tổng đúng 2/3** (cố ý sai 1 câu) → **Nộp bài** → OK.
5. Quay lại Học tập của tôi.

**Mong đợi:**
- Bước 1: trang bài thi có đồng hồ **"Còn 9:5x"** đếm lùi, 3 câu, mỗi câu "1đ".
- Bước 2: dòng trạng thái đổi thành "…lưu tự động … lúc HH:MM:SS".
- Bước 3: đáp án câu 1 **vẫn còn**, đồng hồ **tiếp tục** (không về 10:00).
- Bước 4: vì chỉ có trắc nghiệm nên **chốt ngay**:
  - "Điểm" 2/3, nhãn **Chưa đạt**, " · đạt từ 70%" (2/3 = 66,7% < 70%).
  - Có phần "Phản hồi về kết quả".
- Bước 5:
  - "Kết quả: 2/3 Chưa đạt"; **không còn** nút Vào thi (hết lượt 1/1).
  - Lộ trình hiện trạng thái Hoàn thành kèm Chưa đạt: ghi nhận đúng như luật 11 và ghi GÓP Ý nếu thấy cần.

### H06 — Người học thứ hai thi đạt
**Tài khoản:** TTS.KT
1. Học tập của tôi → Vào thi → OK.
2. Trả lời **đúng cả 3** → Nộp bài → OK.

**Mong đợi:** điểm **3/3**, nhãn **Đạt**. Trang Học tập của tôi ghi "Kết quả: 3/3 Đạt".

### H07 — Đồng nghiệp không xem được bài của nhau; cấp trên xem được
**Tài khoản:** NV.KT → TTS.KT → TP.KT → HR.LND
1. NV.KT: Học tập của tôi → **Xem kết quả** → chép URL (`/learn/attempts/...`) → **URL-THI-NV**.
2. TTS.KT: dán URL-THI-NV.
3. TP.KT: dán URL-THI-NV.
4. HR.LND (L&D phạm vi VCgarage): dán URL-THI-NV.

**Mong đợi:**
- Bước 2: **"Không tìm thấy lượt làm"**. Thấy điểm là **LỖI Nghiêm trọng**.
- Bước 3: xem được, có dòng "Người học: Vũ Nhân Viên KT".
- Bước 4: xem được.

### H08 — Người giao theo dõi tiến độ
**Tài khoản:** KS.KT
1. **Lộ trình học** → mở "[MẪU] Lộ trình KTV mới — OBD cơ bản".
2. **Chấm bài** → tab **Tất cả bài đã nộp**.

**Mong đợi:**
- Bước 1: bảng **"Tiến độ người học"** có 2 dòng. NV.KT có bài thi "2/3 chưa đạt", TTS.KT có "3/3 đạt". Link bài thi mở được trang bài làm.
- Bước 2: có 2 bài đã chốt. Tab **Chờ chấm** không có bài nào (trắc nghiệm tự chốt).

### H09 — Tạo lộ trình: bắt lỗi trước khi phát hành
**Tài khoản:** KS.KT
1. Lộ trình học → **+ Lộ trình mới**. Tên **"Thi tự luận hybrid"**, Kỳ **Tháng**, giữ năm / tháng mặc định → **Tạo bản nháp**.
2. Bấm **Phát hành** ngay (chưa có bài) → OK.
3. **+ Thêm tuần**. Ô "+ Thêm bài học…" chọn **Bài 1 — Đọc mã lỗi OBD**. Thêm tuần 2 với **Bài 2 — Case hybrid…**
4. Tick **Có bài thi**:
   - Thời gian **2** phút; Điểm đạt để nguyên (xác nhận mặc định **70**); Số lượt thi 1; Nguồn câu hỏi "Câu gắn với bài học trong lộ trình".
   - Ma trận dòng 1: Mọi lĩnh vực · Mọi độ khó · **Tự luận** · **5** câu.
5. **Lưu nháp** → **Phát hành** → OK.
6. Sửa dòng 1 thành **Tự luận · 1** câu → **+ Dòng ma trận** → dòng 2: **Một đáp án · 2** câu → **Phát hành** → OK.
7. Tìm ô sửa: tên, tuần, bài.

**Mong đợi:**
- Bước 2: báo lỗi **"Lộ trình cần ít nhất một bài học trước khi phát hành"**.
- Bước 5: báo lỗi có ý "Ma trận đề dòng 1 (… tự luận) cần 5 câu đã duyệt, ngân hàng chỉ có 1". Lộ trình vẫn là Nháp.
- Bước 6: phát hành thành công, trạng thái **Đã phát hành**.
- Bước 7: nội dung bị khoá, không còn ô sửa. Xuất hiện khung **"Giao lộ trình"**.

### H10 — Giao lộ trình: chỉ người trong cây dưới quyền, không giao trùng
**Tài khoản:** KS.KT (trên lộ trình "Thi tự luận hybrid")
1. Xem danh sách **Người** trong khung "Giao lộ trình".
2. Tick cả hai, để trống **Hạn hoàn thành** → **Giao**.
3. Bấm **Giao** lại với cùng người.

**Mong đợi:**
- Bước 1: **chỉ** có Vũ Nhân Viên KT và Đỗ Thực Tập KT. Không có TP.KT, GD.GARAGE, NV.KD hay người ngoài cây.
- Bước 2: "Đã giao 2 người: …". Bảng "Tiến độ người học" có 2 dòng, hạn = tuần cuối / cuối tháng.
- Bước 3: báo "Bỏ qua …: đã được giao lộ trình này" cho cả hai.

### H11 — Hết giờ thì bài tự nộp; chưa chốt thì người học chưa thấy điểm
**Tài khoản:** NV.KT
1. Học tập của tôi → lộ trình "Thi tự luận hybrid" → **Vào thi** → OK. Đồng hồ còn ~2:00.
2. Trả lời 2 câu trắc nghiệm (đúng cả hai).
3. Câu tự luận gõ: "Kiểm tra ắc quy 12V trước tiên vì đây là lỗi phổ biến và kiểm tra rất nhanh."
4. **KHÔNG bấm Nộp.** Chờ tới khi đồng hồ về 0 (khoảng 2 phút), rồi chờ thêm 20–30 giây.
5. Quay lại Học tập của tôi.

**Mong đợi:**
- Bước 4:
  - Bài tự nộp: có câu "Bài đã nộp (hết giờ, hệ thống tự nộp phần đã lưu). Điểm và nhận xét hiện ở đây khi người chấm chốt." và nhãn **"Hết giờ — tự nộp"**.
  - **Không** hiện điểm.
  - Nếu trình duyệt không tự nộp mà vẫn cho sửa sau khi hết giờ là **LỖI**.
- Bước 5: "Đã nộp … — chờ người chấm chốt điểm."

### H12 — Người học thứ hai nộp tay, bỏ trống tự luận
**Tài khoản:** TTS.KT
1. Vào thi lộ trình "Thi tự luận hybrid".
2. Trả lời 2 câu trắc nghiệm, **để trống** tự luận → **Nộp bài**.
3. Hộp xác nhận → OK.

**Mong đợi:**
- Bước 2: hộp xác nhận "Còn 1 câu chưa trả lời. Vẫn nộp bài?".
- Bước 3: bài đã nộp, chờ chấm.

### H13 — Chấm tự luận: kiểm tra bắt buộc, chốt điểm
**Tài khoản:** KS.KT
1. **Chấm bài** → tab **Chờ chấm**.
2. Bấm **Chấm** bài của NV.KT.
3. Nhập điểm câu tự luận **11**, nhận xét "Đúng hướng" → **Chốt điểm** → OK.
4. Sửa điểm thành **8**. Xoá hết nhận xét.
5. Gõ nhận xét: **"Nêu đúng ắc quy 12V; cần giải thích thêm vì sao không kiểm tra pin cao áp trước."** → **Chốt điểm** → OK.
6. Mở lại bài đó.

**Mong đợi:**
- Bước 1: có 2 bài (NV.KT có nhãn "tự nộp"; TTS.KT). Cột Tự luận ghi "1 câu · AI chưa sẵn sàng — người chấm tự chấm".
- Bước 2:
  - "Trắc nghiệm (chấm tự động)" có điểm; bảng rubric 2 tiêu chí (6 + 4 điểm).
  - Ô "Điểm câu …" trống; ô "Nhận xét cho người học (bắt buộc)".
  - Nút **Chốt điểm** bị mờ khi chưa có điểm và nhận xét.
- Bước 3: báo "Câu …: điểm vượt điểm tối đa (10)", hoặc ô không cho nhập quá 10. Không được chốt.
- Bước 4: nút Chốt điểm mờ lại.
- Bước 5:
  - Hộp xác nhận "Chốt điểm? Sau khi chốt không sửa được, người học thấy điểm và nhận xét." → OK.
  - Bài chuyển "Đã chốt điểm". Tổng = 2 + 8 = **10/12** (83%) → **Đạt**.
- Bước 6: chỉ xem, **không** còn form chấm.

### H14 — Luật lệch điểm AI ≥ 20% (câu bỏ trống)
**Tài khoản:** KS.KT → mở bài của TTS.KT (tự luận bỏ trống)
1. Quan sát điểm AI sơ bộ.
2. Nhập điểm tự luận **3**.
3. Nhận xét "Chưa trả lời câu tự luận" → Chốt điểm.
4. Đổi điểm thành **0**, bỏ trống lý do → Chốt điểm → OK.

**Mong đợi:**
- Bước 1: câu ghi "Không trả lời"; điểm theo luật 0.
- Bước 2: xuất hiện ô **"Lý do lệch điểm AI (bắt buộc — lệch từ 20% thang điểm)"**.
- Bước 3: báo lỗi có ý "điểm lệch điểm AI (0) từ 20% thang điểm trở lên — bắt buộc ghi lý do". Không chốt được.
- Bước 4: chốt được. Tổng 2/12 → **Chưa đạt**.
- Nếu ở bước 2 không hiện ô lý do mà vẫn chốt được: ghi kết quả thật và đánh dấu để người phụ trách xem (BA vấn đề mở 17).

### H15 — Người không phải người giao / QL trực tiếp chỉ xem, không chốt
**Tài khoản:** TP.KT, rồi HR.LND
1. Mở bài thi "Thi tự luận hybrid" của NV.KT, qua link ở bảng tiến độ hoặc URL do KS.KT chép.
2. TP.KT: mở **Chấm bài** → Chờ chấm.

**Mong đợi:**
- Bước 1: xem được. Nếu gặp bài chưa chốt thì có câu "Bạn xem được bài làm nhưng không chốt điểm (chỉ người giao lộ trình hoặc quản lý trực tiếp của người học)."
- Bước 2: không có bài của nhóm KS.KT.

### H16 — Người học xem kết quả và gửi phản hồi một lần
**Tài khoản:** NV.KT → KS.KT → NV.KT
1. NV.KT: Học tập của tôi → lộ trình "Thi tự luận hybrid" → **Xem kết quả**.
2. Ô "Phản hồi" gõ "Em nghĩ câu tự luận đáng 9 điểm vì đã nêu lý do." → **Gửi phản hồi**.
3. KS.KT: Chấm bài → Tất cả bài đã nộp.
4. KS.KT mở bài → ô "Trả lời phản hồi": "Giữ 8 điểm — cần nêu thêm lý do không kiểm tra pin cao áp." → **Trả lời**.
5. NV.KT tải lại trang kết quả.

**Mong đợi:**
- Bước 1:
  - Điểm 10/12, **Đạt**.
  - "Nhận xét của người chấm:" đúng câu KS.KT viết.
  - Từng câu có "Bạn trả lời:", "Đáp án mẫu:".
- Bước 2: phản hồi hiện kèm giờ. Ô và nút gửi biến mất: **không gửi được lần 2**.
- Bước 3: bài có nhãn "có phản hồi".
- Bước 5: thấy "Người chấm trả lời: …".

### H17 — Lộ trình năm làm khung, cấp dưới kế thừa không bỏ được mục bắt buộc
**Tài khoản:** TP.KT → KS.KT
1. TP.KT: Lộ trình học → + Lộ trình mới:
   - Tên "Khung năm Kỹ thuật"; Kỳ **Năm (khung)**; Năm = **năm của lộ trình mẫu** (năm của tháng sau).
   - Tạo bản nháp → + Thêm tháng → thêm **Bài 1 — Đọc mã lỗi OBD**, tick **bắt buộc**.
   - Lưu nháp → Phát hành → OK.
2. KS.KT: Lộ trình học → + Lộ trình mới. Tên "Tháng kế thừa khung", Kỳ Tháng, cùng năm; ô **"Kế thừa khung năm"** chọn khung của TP.KT → Tạo bản nháp.
3. Thử bỏ bài có nhãn "bắt buộc của khung". Nếu có ✕ thì bấm, rồi **Lưu nháp**.

**Mong đợi:**
- Bước 2: tuần 1 tự có "Mục bắt buộc của khung" với Bài 1, nhãn **bắt buộc của khung**. Dòng đầu trang ghi "kế thừa khung: Khung năm Kỹ thuật".
- Bước 3: không bỏ được. Hoặc báo "Không được bỏ mục bắt buộc của khung: …".

### H18 — L&D giao bài cho người ngoài kho (đọc bài qua lộ trình)
**Tài khoản:** HR.LND → OUTSIDER
1. HR.LND: **Thư viện bài học** → **+ Bài học mới**.
   - Tên "An toàn xưởng cho nhân sự mới"; Lưu vào kho: **Kho Công khai VCPV**.
   - Thêm thẻ "Nội quy an toàn xưởng cho nhân sự mới".
   - **Phát hành** → **Xác nhận phát hành**.
2. HR.LND: Lộ trình học → + Lộ trình mới "Nhập môn an toàn" (Tháng) → thêm bài vừa tạo, không có bài thi → Lưu nháp → Phát hành → Giao cho **Tạ Người Ngoài**.
3. OUTSIDER: Học tập của tôi → mở bài.
4. OUTSIDER: quay lại Học tập của tôi.

**Mong đợi:**
- Bước 2: danh sách người giao được của HR.LND gồm người trong phạm vi VCgarage và người dưới quyền trực tiếp (OUTSIDER).
- Bước 3: đọc được bài và thẻ.
- Bước 4: tiến độ 1/1. Lộ trình không có thi nên chuyển **Hoàn thành**.

## Kết thúc gói

Viết báo cáo theo mẫu, mã gói **P03**. Ghi rõ điểm số thực tế ở H05, H06, H13, H14.
