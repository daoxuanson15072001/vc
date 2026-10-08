# A2 — Bảng quyết định xếp 1.538 thẻ VCwiki theo cây v2 (26/09/2026)

Chỉ đọc, chưa ghi gì vào app. Ba file kèm theo: `vcwiki_card_decisions_v2.csv` (toàn bộ), `vcwiki_thap_108.csv` (độ tin cậy thấp, cần người quyết), `vcwiki_mau_5pct_70.csv` (70 thẻ ngẫu nhiên để duyệt mẫu).

## Độ phủ

- Kho lúc chạy: **1.546 thẻ** (sáng nay 1.365 — pipeline vẫn nạp thêm trong ngày: +47 thẻ AI agent ở Công nghệ, +27 marketing, +7 thuế…). Đã xếp **1.538**, không trùng, không lỗi định dạng; **8 thẻ** tạo sau lúc đọc chưa có quyết định — script R4 sẽ liệt kê thẻ chưa có dòng trong CSV.
- Quy tắc phạm vi: mỗi thẻ xử lý theo `categories[0]`; số kỳ vọng ở spec mục 12 đếm thẻ ở mọi vị trí category nên lệch — script map (R3) phải đếm lại lúc chạy, không dùng số trong spec.

## Phân bố

| Mảng | Thẻ | Node lớn nhất |
|---|---|---|
| 0 Nền | 92 | 0.3.4 Mở gara 16 · 0.1.3 Bảo dưỡng 29 |
| 1 Marketing | 161 | 1.3.4 Video ngắn 26 · 1.4.3 Kịch bản & hook 25 · 1.1.6 Sản phẩm 4P 3 (node mới) |
| 2 Bán hàng & CSKH | 503 | **2.5 Sàn TMĐT 390** (2.5.4 ads sàn 130, 2.5.5 livestream/KOC 91, 2.5.3 phí & chính sách 67) |
| 3 TCKT | 354 | **3.6 Thuế 197** (3.6.7 kê khai/rủi ro 48, 3.6.6 hộ KD & thuế sàn 47, 3.6.3 TNDN 35) |
| 4 HCNS | 245 | 4.3.3 Kỹ năng cá nhân 113 = tầng 4: .3 Làm việc với sếp 41 · .1 Giao tiếp & ứng xử 33 · .2 Thời gian & hiệu suất 17 · giữ tầng 3 (phát triển bản thân) 22 · 4.4.1 cơ chế lương 20 |
| 5 QLTT | 179 | 5.4 Lãnh đạo 84 · 5.7.3 AI & tự động hoá 49 |
| 6 Mua hàng | 4 | 6.4 kho/đóng gói |

(Số sau khi áp 6 quyết định bên dưới: 139 thẻ cũ ở 4.3.3 → 91 vào 3 node tầng 4, 22 giữ, 9 → 4.1.3 thăng tiến, 12 → 4.6.4 nghỉ việc, 3 → 0.4.1 chọn nghề, 1 → 2.5, 1 → 5.1.4.)

- Bậc: thực thi 616 · điều hành 334 · thiết kế 278 · nhập môn 200 · vận hành 110.
- Loại: đổi 45 thẻ (25 → sop, 15 → checklist, 5 → kpi); hook còn 3.
- Division: tap-doan 855 · vcpart 545 (gần hết là sàn TMĐT) · vcservice 72 · vce+vcservice 40.
- Bước quy trình: 631 thẻ có mã; nhiều nhất qt.san-tmdt.b 223, qt.nhan-su.c 37, qt.dich-vu-xuong.c 25.
- 44 thẻ để ở tầng 2 (27 ở 2.5: lộ trình tổng quan mở shop, bài học chung) — đúng quy tắc không tạo node "Khác".
- Độ tin cậy thấp: **108 (7%)**, mỗi dòng có phương án thay thế trong cột note.

## 6 quyết định — đã chốt 26/09

1. **2.5.4 / 2.5.5 (221 thẻ) — DUYỆT theo đề xuất:** giữ tầng 3 lúc áp CSV; mở tầng 4 sau khi R4 xong (ads: GMV Max / chiến dịch thường / tối ưu; live: kịch bản live / xây đội live / affiliate), AI chạy lại riêng 221 thẻ này.
2. **4.3.3 (139 thẻ) — Thọ Anh chốt mở tầng 4:** 4.3.3.1 Giao tiếp & ứng xử công sở (33) · 4.3.3.2 Quản lý thời gian & hiệu suất cá nhân (17) · 4.3.3.3 Làm việc với sếp (41). 22 thẻ phát triển bản thân/tự học giữ ở 4.3.3. 26 thẻ không thuộc kỹ năng cá nhân đi chỗ đúng: thăng tiến & lộ trình chức danh → 4.1.3 (9), nhảy việc/nghỉ việc → 4.6.4 (12), chọn nghề → 0.4.1 (3), 2.5 (1), 5.1.4 khởi nghiệp (1). 3 node tầng 4 này đưa vào script nạp cây (yêu cầu cây 4 tầng) cùng 1.1.6.
3. **Thêm 1.1.6 "Sản phẩm & danh mục marketing (4P)" — DUYỆT:** 3 thẻ (4P, 5 cấp độ sản phẩm, sản phẩm là gì) chuyển vào; 4 thẻ "marketing là gì" ở lại 1.1 bậc nhập môn.
4. **Node gần trống — ĐỂ SAU** (0.5, 1.5, 2.4, 6.x, 4.7, 5.2/5.3/5.6, 1.3.1 SEO): không làm gì ở đợt này; khi nạp nguồn mới sẽ quay lại.
5. **Dọn dữ liệu — DUYỆT (vào R4):** 11 thẻ summary dính rác XML (`</summary>`, `<parameter …>`, note nhóm G4) làm sạch; xoá thẻ test `6ab4ab6776d151ae7e7a9804`.
6. **Tag gộp bổ sung — DUYỆT (vào R3):** quang-cao-gmv, quang-cao-gmv-max → gmv-max · roi-quang-cao, bao-ve-roi → roi · tiktok-ads → quang-cao-tiktok · koc-kol, tiep-thi-lien-ket, affiliate, koc-tiktok → affiliate-koc · chinh-sach-gia, gia-ban → dinh-gia · tiktok-shop-chinh-sach, chinh-sach-nen-tang → chinh-sach-san · phi-san, phi-san-tiktok-shop, chi-phi-san-tmdt → phi-san-tmdt · tuan-thu-thue → rui-ro-thue. Tag nguồn mới: tien-hoc-marketing, duy-muoi, quang-trung-tv, x-coastie, ra-diesel-tech, origin-ai-agent → nguon-*.

## Chi phí thật

6 agent chạy song song ≈ 30 phút; token thực ≈ 2,6 triệu (tao ước 0,5–0,6M — sai 4 lần: mỗi trang 40 thẻ ≈ 10k token và agent phải đọc lại ngữ cảnh mỗi lượt gọi).

## Bước tiếp

- Mày duyệt 70 thẻ mẫu + quyết 108 thẻ thấp (hoặc giao GĐ chuyên ngành từng mảng).
- Khi yêu cầu code "Cây lĩnh vực 4 tầng…" xong và cây tầng 1–3 đã nạp, tao gửi R3 (script map + vệ sinh tag) và R4 (script áp CSV này) — R4 đọc CSV theo `card_id`, đổi mã node → slug thật, báo thẻ chưa có quyết định.
