# P10 — Các tính năng cần AI (chạy khi bật AI)

> **Ưu tiên:** 10 (chạy sau cùng, **tốn phí Claude API**) · **Thời gian:** 45–60 phút · **Dữ liệu:** dựng lại, rồi chạy môi trường **có AI**: tắt bản UAT đang chạy, chạy `bash start_uat.sh --ai --reset` · **Cần AI:** có (Claude API và / hoặc Ollama)

---

## Mục tiêu gói

Kiểm tra các bước AI làm thật: dựng thẻ từ tài liệu, cổng so sánh, sinh câu hỏi, AI thiết kế lộ trình, AI chấm sơ bộ tự luận, phân tích bản đồ tri thức, Xưởng chiến dịch.

Mục tiêu **không phải** chấm độ hay của AI, mà là:
1. luồng chạy trọn không kẹt;
2. AI **chỉ dùng thẻ / tài liệu người đó xem được**;
3. kết quả AI luôn ở dạng **nháp**, chờ người duyệt;
4. thông báo tiến độ / lỗi rõ ràng.

## Luật nghiệp vụ cần biết

- AI đề xuất, **người quyết**. Thẻ AI tạo là *Nháp* và vẫn phải qua 2 bước duyệt. Câu hỏi AI sinh là *Nháp*.
- AI thiết kế lộ trình chỉ dùng thẻ đã duyệt mà người thiết kế **và mọi người học** đều xem được; mọi bài ghi mã thẻ + phiên bản; chủ đề không có thẻ thì ghi "thiếu tri thức", **không tự viết nội dung**.
- Chấm tự luận: điểm AI là sơ bộ. Người chấm lệch ≥ 20% thang điểm câu phải ghi lý do.

## Ca kiểm thử

### I01 — Trạng thái AI
**Tài khoản:** NV.KT → Kho tư liệu

**Mong đợi:** **không** còn khung "AI chưa sẵn sàng", hoặc hiện "Đang chạy bằng AI local (…)" nếu chỉ có Ollama. Ghi lại khung hiện gì.

### I02 — Dựng thẻ từ tài liệu PDF
**Tài khoản:** NV.KT
1. Nạp `docs/test-claude-extension/data/tai-lieu-ac-quy.pdf` (nhờ người dùng chọn file) vào **Kho Kỹ thuật VCgarage**, Dựng thẻ: **cho tất cả**.
2. Chờ tới khi nguồn **Hoàn tất** (tối đa ~3 phút).
3. Bấm "Xem tất cả thẻ →" ở mục "Tinh chế ra".

**Mong đợi:**
- Bước 2: tài liệu có nhãn "Đã vào VCWIKI", "hữu ích x/10", "n thẻ".
- Bước 3:
  - Các thẻ **Nháp**, nguồn gốc "AI tạo", có lĩnh vực trong cây, có trích dẫn căn cứ từ tài liệu.
  - Nội dung **không bịa** ngoài tài liệu (tài liệu chỉ nói 3 bước đo điện áp ắc quy).
- Hộp duyệt của KS.KT có đề xuất "Thẻ mới" cho các thẻ này, với kết quả cổng so sánh do AI xếp (không còn "Luật đơn giản").

### I03 — Cổng so sánh bắt trùng
**Tài khoản:** NV.KT → KS.KT
1. NV.KT: tạo thẻ tay gần như chép lại "Mã lỗi DTC là gì" (tiêu đề "DTC là gì", tóm tắt / nội dung chép lại) → Gửi duyệt.
2. Chờ ~1 phút → mở đề xuất.
3. KS.KT: Hộp duyệt → Chờ tôi duyệt.

**Mong đợi:**
- Bước 2: kết quả **TRÙNG** (hoặc BỔ SUNG), có lý do và "Thẻ gần: Mã lỗi DTC là gì (0.xx)". Hộp duyệt hiện hai nội dung cạnh nhau.
- Bước 3: nếu TRÙNG thì đề xuất bị ẩn, có dòng "…TRÙNG / NHIỄU đang ẩn. Hiện".

### I04 — Sinh câu hỏi bằng AI
**Tài khoản:** KS.KT → Thiết kế lộ trình → "AI sinh câu hỏi cho một thẻ"
1. Chọn "Quy trình đọc lỗi bằng máy chẩn đoán OBD" (SOP), 3 câu → AI sinh câu hỏi.
2. Làm lại với "Case: xe hybrid…" (case study), 2 câu.
3. Mở Ngân hàng câu hỏi.

**Mong đợi:**
- Bước 1: "Đã tạo N câu nháp…". Câu loại **Nhiều đáp án** (theo luật SOP → nhiều đáp án).
- Bước 2: câu **Tự luận** có rubric.
- Bước 3: các câu mới là **Nháp**, "Căn cứ: <thẻ> (bản N)". Nội dung đúng với thẻ.

### I05 — AI thiết kế lộ trình
**Tài khoản:** KS.KT → Thiết kế lộ trình
1. Người học NV.KT + TTS.KT; mục tiêu "Đọc lỗi OBD và xử lý xe hybrid"; tháng sau; nhánh bắt buộc `nen.ky-thuat` → AI dựng lộ trình nháp.
2. Lặp lại, nhưng thêm vào ô Prompt: "Thêm 1 tuần về chiến lược bán hàng B2B cho đại lý".

**Mong đợi:**
- Bước 1:
  - Nhãn "AI: <model>". Mỗi bài có thẻ kèm "bản N".
  - **Không** có thẻ kho Kinh doanh, **không** có thẻ nháp.
  - Có "Lý do:" và danh sách "Thiếu tri thức" hợp lý.
- Bước 2: AI **không** đưa thẻ chiết khấu / B2B (người học không xem được). Phần B2B nằm ở **"Thiếu tri thức"**, không bịa nội dung.

### I06 — AI chấm sơ bộ tự luận và luật lệch 20%
**Tài khoản:** KS.KT → NV.KT → KS.KT
1. KS.KT tạo lộ trình có bài thi 1 câu tự luận (như P03-H09, thời gian 5 phút), phát hành, giao NV.KT.
2. NV.KT làm bài, trả lời đầy đủ ý "kiểm tra ắc quy 12V trước vì phổ biến, kiểm tra nhanh" → Nộp.
3. KS.KT: Chấm bài → chờ cột Tự luận thành "AI đã chấm sơ bộ" → mở bài.
4. Đổi điểm lệch ≥ 2 điểm so với điểm AI, không ghi lý do → Chốt.
5. Ghi lý do → bấm "Chèn nhận xét nháp của AI" → sửa nhận xét → Chốt điểm.

**Mong đợi:**
- Bước 3: bảng rubric có cột **AI** với điểm từng tiêu chí, "Điểm AI sơ bộ: x/10". Ô điểm điền sẵn điểm AI. Có link "Chèn nhận xét nháp của AI".
- Bước 4: báo phải ghi lý do.
- Bước 5: chốt được. Người học thấy điểm người chấm, không phải điểm AI nếu khác.

### I07 — Bản đồ tri thức: AI phân tích chủ đề
**Tài khoản:** NV.KT → Bản đồ tri thức
1. Bấm **✦ AI phân tích chủ đề** → chờ.

**Mong đợi:** có "Chủ đề AI" gom các thẻ; bật lớp "Chủ đề AI", "Liên kết AI" thì thấy trên đồ thị. Chỉ gồm thẻ NV.KT xem được.

### I08 — Xưởng chiến dịch chạy thật (tuỳ chọn, tốn nhiều token)
**Tài khoản:** NV.KT
1. Tạo chiến dịch luồng ① Video ngắn, 1 tuần, 2 video tham chiếu, tick "Dùng thẻ VCWIKI liên quan".
2. Chờ tới "Sẵn sàng".
3. Tab Video ngắn → chọn 1 tập → **✎ Viết kịch bản** → chờ → mở kịch bản.

**Mong đợi:**
- Bước 2: tab Chiến lược / Chiến dịch có nội dung.
- Bước 3: kịch bản có điểm x/100, nút ✓ Duyệt / Loại / Viết lại.
- Tab Tham chiếu có thẻ VCWIKI dùng làm căn cứ: chỉ thẻ **đã duyệt**, không có thẻ lỗi thời.

### I09 — Trò chuyện Claude dùng đúng quyền (nếu máy chủ có Claude Code CLI)
**Tài khoản:** NV.KT → Trò chuyện Claude
1. Hỏi "Tìm cho tôi thẻ về chính sách chiết khấu đại lý".
2. Hỏi "Tóm tắt thẻ Mã lỗi DTC".

**Mong đợi:**
- Bước 1: Claude **không** tìm thấy / không trả nội dung thẻ kho Kinh doanh. Trả được là **LỖI Nghiêm trọng**.
- Bước 2: trả lời đúng nội dung thẻ.

## Kết thúc gói

- Viết báo cáo theo mẫu, mã gói **P10**.
- Ghi thêm thời gian chờ thực tế của từng bước AI.
- Sau khi xong, tắt bản có AI và chạy lại `bash start_uat.sh` (không AI) cho các gói khác.
