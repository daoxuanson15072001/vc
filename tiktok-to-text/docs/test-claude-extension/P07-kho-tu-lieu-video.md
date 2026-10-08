# P07 — Kho tư liệu: nạp nguồn, chi tiết nguồn, kho video, kênh

> **Ưu tiên:** 7 · **Thời gian:** 40–50 phút · **Dữ liệu:** dựng lại trước khi chạy (`bash start_uat.sh --seed-only`) · **Cần AI:** không · **Cần người dùng hỗ trợ:** chọn file ở K03, K04; kiểm tra file tải về ở K08

---

## Mục tiêu gói

Kiểm tra **Kho tư liệu**: nạp nguồn, xem nhận dạng link, xử lý file không cần mạng (PDF chữ, ảnh), chi tiết nguồn (tài liệu, dữ liệu thô, nhật ký, tag, xoá), và tab **Video** / **Kênh** với 4 video mẫu.

**Không có mạng / AI** nên:
- link web / video sẽ lỗi hoặc chờ: chỉ kiểm tra phần nhận dạng link và thông báo;
- tài liệu cần dựng thẻ sẽ ở **"Chờ cấu hình AI"**. Đều là đúng.

## Luật nghiệp vụ cần biết

- Lưu thô trước, xử lý sau; nguồn đi qua các trạng thái Chờ xử lý → Đang chuyển thành chữ → Đã chuyển chữ / Chờ cấu hình AI / Hoàn tất / Lỗi.
- Tuỳ chọn "Chỉ chuyển thành chữ, không dựng thẻ" → tài liệu "Chỉ chuyển chữ".
- Nạp trùng thì bỏ qua và báo "Đã có trong kho".
- Người Chỉ xem không nạp được vào kho đó.
- Xoá nguồn xoá dữ liệu thô và thẻ nháp; **thẻ đã duyệt giữ lại**.

## Ca kiểm thử

### K01 — Trang Kho tư liệu khi không có AI
**Tài khoản:** NV.KT → **Kho tư liệu**

**Mong đợi:**
- Có khung vàng **"AI chưa sẵn sàng: …"**, nói rõ nguồn vẫn được chuyển thành chữ, bước dựng thẻ tự chạy khi có khoá.
- Có 3 tab Nguồn / Video / Kênh.
- Có khung "Nạp vào kho".
- Danh sách nguồn trống với câu hướng dẫn.

### K02 — Nhận dạng link khi dán
**Tài khoản:** NV.KT, ô "Link cần nạp". Dán 5 dòng:
```
https://www.tiktok.com/@garage_tips
https://vnexpress.net/oto-xe-may
day khong phai link
https://docs.google.com/document/d/abc123/edit
# dong ghi chu
```
Chờ 1–2 giây.

**Mong đợi:**
- Mỗi dòng hiện loại nhận dạng:
  - TikTok: ▶ Video MXH, gợi ý "kênh / playlist".
  - Bài viết / link.
  - Dòng chữ thường: **"Không phải link"**.
  - Google: nhãn quyền truy cập, vd "✗ Không tìm thấy" hoặc "Chưa kiểm tra được quyền" khi không có mạng.
  - Dòng `#` bị bỏ qua.
- Xuất hiện ô "Video tối đa / kênh", "Cookie trình duyệt", "Ngôn ngữ lời nói".
- Bộ đếm cuối có dạng "N nguồn · M dòng không nạp được".
- **Không bấm Nạp**. Xoá hết nội dung ô.

### K03 — Nạp file PDF, dựng thẻ → Chờ cấu hình AI
**Tài khoản:** NV.KT
1. Bấm **⤒ Chọn file**. **Nhờ người dùng chọn** `docs/test-claude-extension/data/tai-lieu-ac-quy.pdf`.
2. "Lưu vào kho": **Kho Kỹ thuật VCgarage**; Tag `ac-quy`; "Dựng thẻ VCWIKI": **Dựng thẻ VCWIKI cho tất cả** → **Nạp vào kho**.
3. Chờ tối đa 30 giây (danh sách tự làm mới).
4. Bấm vào nguồn để mở ngăn "Chi tiết nguồn".

**Mong đợi:**
- Bước 2: "✓ Đã nạp 1 nguồn."
- Bước 3: nguồn "tai-lieu-ac-quy" đi từ Chờ xử lý → **Chờ cấu hình AI**.
- Bước 4:
  - Mục **Tài liệu (1)**: "… ký tự · chuyển chữ bằng pypdf", nhãn **Chờ AI**. "Xem chữ" hiện đúng nội dung (Quy trinh kiem tra ac quy 12V…).
  - **Dữ liệu thô** có file PDF tải được.
  - **Nhật ký** có "Đã lưu thô, chờ xử lý", "Bắt đầu chuyển thành chữ…".
  - URL có `?source=`.

### K04 — Nạp 2 ảnh gộp, chỉ chuyển chữ; nạp trùng
**Tài khoản:** NV.KT
1. **Nhờ người dùng chọn** 2 file `anh-1.png` và `anh-2.png` (thư mục `docs/test-claude-extension/data/`).
2. Xem các ô tuỳ chọn.
3. Để tick gộp ảnh, "Dựng thẻ VCWIKI": **Chỉ chuyển thành chữ, không dựng thẻ**, kho: kho cá nhân ★ → **Nạp vào kho**.
4. Chờ xử lý xong.
5. Nạp lại đúng 2 ảnh đó, cùng tuỳ chọn.

**Mong đợi:**
- Bước 2: có ô **"Gộp 2 ảnh thành 1 tài liệu"** (đã tick).
- Bước 4:
  - Có **một** nguồn "anh-1 (+1 ảnh)", trạng thái **Đã chuyển chữ**, nhãn "chỉ chuyển chữ".
  - Tài liệu nhãn **Chỉ chuyển chữ**, bằng "OCR Tesseract". Chữ OCR có thể sai dấu, chấp nhận; nếu trống hẳn thì ghi lại.
  - Ngăn chi tiết có album 2 ảnh.
- Bước 5: báo **"Đã có trong kho, bỏ qua: anh-1 (+1 ảnh)"** (hoặc tương tự), không tạo nguồn mới.

### K05 — Bộ lọc nguồn và tag tài liệu
**Tài khoản:** NV.KT
1. Chip loại nguồn: "📄 PDF" → "🖼 Ảnh chụp" → "Tất cả".
2. Ô tìm: `ac-quy`.
3. Mở nguồn PDF → ô "+ thêm tag, Enter" của tài liệu: thêm `pin-12v` → Enter. Bỏ tag đó bằng ×.
4. KS.KT: Kho tư liệu.
5. TTS.KT: Kho tư liệu.

**Mong đợi:**
- Bước 1: số trên chip khớp số nguồn.
- Bước 2: ra nguồn PDF.
- Bước 3: tag thêm / bỏ ngay.
- Bước 4: thấy nguồn PDF (cùng kho), **không** thấy nguồn ảnh (kho cá nhân NV.KT).
- Bước 5: thấy nguồn PDF nhưng mở ra **không** có nút Dừng / Xử lý lại / Xoá; ô "Lưu vào kho" của TTS.KT không có Kho Kỹ thuật.

### K06 — Xử lý lại, ưu tiên, xoá nguồn
**Tài khoản:** NV.KT, nguồn PDF
1. Bấm **Xử lý lại từ dữ liệu thô**. Chờ.
2. Nếu có nút **⇡ Ưu tiên xử lý trước**, bấm.
3. **Xoá nguồn** → hộp xác nhận "Xoá nguồn, dữ liệu thô và thẻ nháp? (thẻ đã duyệt được giữ lại)" → Cancel.
4. **Xoá nguồn** → OK.

**Mong đợi:**
- Bước 1: nhật ký thêm "Xử lý lại"; nguồn chạy lại và về Chờ cấu hình AI.
- Bước 2: nhật ký "⇡ Ưu tiên xử lý trước".
- Bước 3: không xoá.
- Bước 4: ngăn đóng, nguồn biến mất.

### K07 — Link lỗi khi không có mạng (tuỳ máy)
**Tài khoản:** NV.KT
1. Dán `https://example.com/khong-ton-tai-uat` → Dựng thẻ: Chỉ chuyển thành chữ → kho cá nhân → Nạp.
2. Chờ tối đa 60 giây, mở nguồn.

**Mong đợi:**
- Nếu máy có mạng: có thể ra "Đã chuyển chữ" hoặc Lỗi (trang 404).
- Nếu không: **Lỗi**, nhật ký có dòng "✗ …" nói rõ lý do.
- Nút **Xử lý lại từ dữ liệu thô** có mặt.
- Không trang trắng.

### K08 — Tab Video
**Tài khoản:** NV.KT → tab **Video**
1. Xem danh sách.
2. Tìm `chan doan` (không dấu).
3. Kênh = @phutung_pro.
4. Trạng thái = Lỗi. Sau đó **Xóa lọc**.
5. Sắp theo **Lượt xem**, Giảm dần.
6. Mở video "Mẹo đọc lỗi OBD".
7. Thêm tag `obd` (Enter). Ghi chú "hook tốt" → **Lưu ghi chú**.
8. **Sửa** lời nói, thêm chữ " (đã sửa)" → **Lưu lời nói**.
9. Bấm **Tải SRT** và **⭳ Xuất Excel**. **Nhờ người dùng** mở file Excel kiểm tra có đủ cột và 4 dòng.
10. Mở video "Video bị lỗi" → **Xóa khỏi kho** → OK.

**Mong đợi:**
- Bước 1: "4 video", có cột Ngày đăng / Xem / Thích / BL / Chia sẻ / Dài / Trạng thái.
- Bước 2: ra "Mẹo đọc lỗi OBD".
- Bước 3: 2 video.
- Bước 4: 1 video; Xóa lọc thì đủ 4.
- Bước 5: video 980.000 xem đứng đầu. URL giữ bộ lọc (tải lại vẫn còn).
- Bước 6: ngăn "Chi tiết video": số liệu, tab Lời nói / Phụ đề / Caption, link "Mở trên TikTok ↗".
- Bước 7: "Đã thêm tag", "Đã lưu".
- Bước 8: nhãn **Đã sửa tay**.
- Bước 9: tải được file `.srt` và `.xlsx`.
- Bước 10: còn 3 video.

### K09 — Tab Kênh và Tổng quan
**Tài khoản:** NV.KT
1. Tab **Kênh**.
2. Bấm tên kênh @garage_tips.
3. Menu **Tổng quan**.

**Mong đợi:**
- Bước 1: 2 kênh (garage_tips, phutung_pro) với số video, tổng xem, TB xem/video.
- Bước 2: chuyển sang tab Video lọc theo kênh đó.
- Bước 3:
  - Ô "Video trong kho" khớp tab Video.
  - "Nguồn tri thức" đếm nguồn trong kho NV.KT xem được.
  - "Thẻ VCWIKI" có "N đã duyệt".
  - "Nguồn nạp gần đây" và "Nhiều lượt xem nhất" có dữ liệu.

## Kết thúc gói

Viết báo cáo theo mẫu, mã gói **P07**.
