# Thống nhất giữa các đặc tả — sau QA vòng 1

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA trưởng chốt ngày 29/09/2026 cách thống nhất 30 mâu thuẫn mà qa.md §1 nêu; mọi file 00–06 sửa theo bảng này.
- Nguyên tắc chọn bên: nguyên tắc bắt buộc thắng mọi thứ; mỗi chủ đề có một file nguồn chuẩn (00 route, màu, câu chữ; 01 quyền; 02 định danh, định tuyến; 04 khung gửi OA, ZNS; 05 Fanpage; 06 hóa đơn, công nợ).
- Mã câu hỏi chờ chốt thêm tiền tố file (`CH-DK-`, `CH-OA-`, `Q-SZ-`, `HD-CH-`…).
- Chốt tiêu biểu: mã kênh `web_chat`; một bảng trạng thái owner ở 00 MH-UI-05; CSKH tạm giữ chỉ gửi mẫu giữ khách đã duyệt; trang "Không có quyền" theo 01 MH-PQ-11; 00 §2 là nguồn route duy nhất.
- Mục còn chờ chủ dự án, đang chạy theo mặc định: người duyệt chatbot (D-MK-8), marketing trả lời bình luận / nhắn riêng (PQ-21), lead từ Zalo cá nhân (QĐ-09).
- Bổ sung 4 điểm từ góp ý thiết kế lượt 2: bàn giao khi nghỉ việc, "Chia đều" bỏ người vắng, chống gửi trùng khi nick mất kết nối, giới hạn tin 2.000 ký tự.

## Mục lục

- [Nguyên tắc chọn bên](#nguyên-tắc-chọn-bên)
- [Bảng chốt (theo số dòng của qa-vong-1 §1)](#bảng-chốt-theo-số-dòng-của-qa-vong-1-1)
- [Bổ sung ngoài bảng QA (từ góp ý thiết kế lượt 2)](#bổ-sung-ngoài-bảng-qa-từ-góp-ý-thiết-kế-lượt-2)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Ngày 29/09/2026. BA trưởng chốt cách thống nhất cho 30 mâu thuẫn trong [qa.md](qa.md) §1. Mọi file 00–06 sửa theo bảng này. Mục ghi **Chờ chủ dự án** thì viết theo mặc định ghi ở đây và gắn mã quyết định trong [../../quyet-dinh-chu-du-an.md](../../../01-quan-ly-du-an/quyet-dinh-chu-du-an.md).

## Nguyên tắc chọn bên

1. Nguyên tắc bắt buộc (CLAUDE.md §12, BA §2.2, §7) thắng mọi thứ.
2. **Nguồn chuẩn theo chủ đề**, file khác chỉ trỏ tới, không chép lại:
   - **00**: route và menu (§2), màu, chip, câu chữ chung, mã lỗi `ERR-*`, bố cục, nhãn bong bóng.
   - **01**: quyền, khóa quyền, trang/hộp "Không có quyền" (MH-PQ-11), câu đăng nhập bị từ chối.
   - **02**: định danh, gộp hồ sơ, định tuyến, trạng thái owner và tạm giữ.
   - **04**: khung gửi Zalo OA (Z0–Z3), ZNS.
   - **05**: khung gửi Fanpage (24h, `HUMAN_AGENT`) và câu chặn — 05 là chủ quản Fanpage cho tới khi có file kênh riêng.
   - **06**: hóa đơn, yêu cầu xuất hóa đơn, công nợ.
3. Mã câu hỏi chờ chốt thêm tiền tố file: `CH-DK-`, `CH-OA-`, `Q-SZ-`, `Q-UI-`, `Q-PQ-`, `Q-MK-`, `HD-CH-`.

## Bảng chốt (theo số dòng của qa-vong-1 §1)

| # | Chủ đề | Chốt | File phải sửa |
|---|---|---|---|
| 1 | Mã kênh chatbot web | **`web_chat`**, tiền tố uid `web_` | 05 (4 chỗ), bỏ việc "02 đổi sang webchat"; 00 đóng câu hỏi |
| 2 | Trạng thái người dùng/owner | **Một bảng duy nhất ở 00 MH-UI-05**: `Trực tuyến` · `Đi thị trường` · `Vắng` · `Ngoại tuyến`; "Nghỉ phép" là cờ lấy từ trực thay, không phải trạng thái online. Ngữ nghĩa theo 02: **Đi thị trường** = vẫn nhận tin của khách mình (hạn trả lời chạy), không nhận hội thoại mới chưa có owner; **Vắng** tự bật sau một tham số (mặc định 30′, chờ QĐ-06/TS-07), tính cả tin gửi từ điện thoại. Lead: không giao cho người Vắng/Ngoại tuyến; người Đi thị trường **có** nhận lead (SLA theo 05) | 00, 02, 04 (OA-11 bỏ "15′", trỏ DK-47), 05 (MK-04, MK-05) |
| 3 | CSKH tạm giữ hội thoại bán hàng | Theo **02**: khi owner Vắng hoặc quá hạn trả lời, CSKH tạm giữ và **chỉ được gửi mẫu giữ khách đã duyệt, không nêu giá**; owner không đổi | 01 (PQ-19, chú thích (4) của `conv.reply`), 00 (UAT-UI-97 giữ ca owner Trực tuyến thì chặn) |
| 4 | Không có quyền | Theo **01 MH-PQ-11**: gộp 403/404 đối tượng ("Không tìm thấy hoặc bạn không có quyền xem"). 00 MH-UI-06 chỉ giữ 404 trang, 500, lỗi giao diện, mất mạng và trỏ 403 sang MH-PQ-11 | 00 (MH-UI-06, UAT-UI-38…40), 03 (MH-SZ-03, UAT-SZ-12), 04 (MH-OA-03) |
| 5 | Route và menu | **00 §2 là nguồn duy nhất**; gom mọi route của 01–06. Chọn: `/campaigns` (ZNS nằm dưới: `/campaigns/zns-templates`, `/campaigns/costs`), `/automations`, `/settings/sla` (thay `/admin/routing` cho SLA; quy tắc chia khách `/settings/routing`), `/customers/merge-suggestions`, `/privacy-requests`, `/settings/tokens`, `/settings/activity`, `/leads`, `/leads/rules`, `/ads/sources`, `/ads/campaigns`, `/content/vcwiki`, `/invoice-requests`, `/invoices`, `/debts`, `/payment-replies`, mục **Lệnh gửi** `/outbox`. Trang mặc định Sale admin: `/customers/erp-matching` (MH-DK-13) | 00 (gom), 01–06 (đổi route cho khớp, chỉ trỏ 00 §2) |
| 6 | Ai thấy menu | **01 thắng**; 00 §2.2 sửa cột vai trò theo khóa quyền; chỉ đọc ghi 👁 | 00 |
| 7 | Ai duyệt, xuất bản chatbot | **Chờ chủ dự án (QĐ về D-MK-8)**. Mặc định tới khi chốt: theo 01 — **giám đốc division** xuất bản; trưởng marketing soạn và đề xuất | 05 (bỏ câu "khớp OA-18"), 04 OA-18 giữ, 01 giữ |
| 8 | Marketing trả lời bình luận / nhắn riêng | Mặc định theo **01 PQ-21**: không gửi, Admin bật theo kênh. 05 MH-MK-09 thêm điều kiện và câu khóa theo MH-PQ-11 dạng C. Chờ chủ dự án nếu muốn đổi | 05, 02 §5.10 |
| 9 | Lệnh chờ khi người duyệt nghỉ/bị khóa | Theo **03**: chuyển **`Cần duyệt lại`**, không tự chạy; **không có nút "Thử lại"**; chỉ người đang giữ nick (hoặc trực thay) duyệt lại; mã sự kiện `outbox.needs_reapproval` | 01 (PQ-33, PQ-51, D15), 03 giữ, 00 (màn Lệnh gửi) |
| 10 | Owner xem SĐT | Owner **luôn thấy đủ** SĐT khách của mình, không nút Hiện, không ghi nhật ký mỗi lần; người khác bấm "Hiện" theo 00 §3.6 | 02 (UAT-DK-13 viết lại + ca GS riêng) |
| 11 | Nhãn tin gửi ngoài VClinks | Nhãn hiển thị theo **00**: "Gửi từ điện thoại"; kênh API: "Gửi từ trang quản lý OA" / "Gửi từ Meta Business Suite". Mã dữ liệu `sendSource = ngoai_vclinks` | 03 (SZ-22), 02 §1.3, 04 (thêm nhãn bong bóng) |
| 12 | Màu chip kênh | Theo **00 §3.2**; 02 xóa cột màu, trỏ 00. Biến thể "chip + tên tài khoản kênh" do 00 định nghĩa | 02, 00 |
| 13 | Màu vùng khung gửi OA | Theo **00** (không tím; Z2 dùng chip cảnh báo kiểu đặc theo 00) | 04 §3.2 |
| 14 | Chip SLA và khung gửi | Một bộ chữ ở **00** (chip ngắn trên danh sách; biến thể "chip đủ" cho `/cskh` nếu cần). Ngưỡng "sắp quá": **còn ≤ 25% hạn** (tham số) | 03 (MH-SZ-01 #9l), 04 (MH-OA-02 #9–#10, bộ lọc), 00 thêm biến thể |
| 15 | Giờ làm việc tính SLA | **Lịch làm việc của division** (00, 04) | 03 SZ-21 (h) |
| 16 | Nút nhận việc | Hội thoại: **"Nhận"** / **"Nhận hội thoại này"**, hàng **"Chưa phân công"**. Ticket và gợi ý gộp giữ "Nhận xử lý" | 04 (MH-OA-02 #14, UAT-OA-13, UAT-OA-82) |
| 17 | Nút xem SĐT | **"Hiện"**, **60 giây**, thành phần dùng chung `<MaskedContact>`; nút "Gọi" cạnh "Hiện" theo 01 PQ-37 | 05 (MH-MK-07 #2), 00 (thêm "Gọi") |
| 18 | Quyền của giám sát CSKH, sale admin, kế toán ở 04 | **01 thêm khóa**: `zns.send_single`, `cost.view`, `cost.edit_actual`, `conv.reply_on_behalf` cho giám sát CSKH trong phạm vi CSKH. Tới khi 01 thêm, dev theo 01 | 01, 04 trỏ khóa |
| 19 | Ai gửi qua nick người khác | Trỏ **01 D2**: người giữ nick, người trực thay, GS/GĐ trả lời thay | 02 §5.1 #2 |
| 20 | Lead từ Zalo cá nhân | 01 PQ-20 bổ sung: lead không nhất thiết từ kênh marketing; marketing chỉ thấy `lead.card` (chờ QĐ-09) | 01 |
| 21 | Tin tự động theo quy tắc/mẫu | Quy tắc chung ở **01**: mọi tin tự động dùng **mẫu đã duyệt**; `approvedBy` = người duyệt mẫu, `approvedAt` = lúc duyệt phiên bản; người bật quy tắc không tự duyệt mẫu (PQ-27) | 01 (thêm quy tắc), 04 MH-OA-10, 05 MH-MK-09 trỏ quy tắc |
| 22 | Chủ quản khung gửi Fanpage | **05** đặc tả đủ 24h, `HUMAN_AGENT` 7 ngày, câu chặn, ngưỡng cảnh báo (chờ TS) | 05, 00 trỏ 05, 04 bỏ Q-OA-19 |
| 23 | Yêu cầu hóa đơn | **06** là chủ quản | 00 §2.2, 01 D11 trỏ 06 |
| 24 | Nhãn trả lời thay | Theo 00: "Gửi bởi {tên} (trả lời thay {người})" | 01 PQ-16 |
| 25 | Kích thước inbox | Theo 00 (344/320 px, panel 320 px) | 02 §8 |
| 26 | Mã câu hỏi trùng | Thêm tiền tố file (xem Nguyên tắc 3) | 02, 04, 03, 00 |
| 27 | Tên vùng OA | "Ba vùng thời gian (Z1–Z3) + trạng thái Z0 bỏ quan tâm" | 04 §8.3, BA tổng |
| 28 | Câu đăng nhập bị từ chối | Giữ câu của **00** (có email) | 01 (PQ-10, UAT-PQ-05, UAT-PQ-40) |
| 29 | Câu lỗi mạng | 01 trỏ `ERR-NET` của 00 | 01 |
| 30 | Câu người chỉ xem | Một câu ở 00 MH-UI-08: **"Bạn chỉ có quyền xem hội thoại này."** | 03, 04 trỏ 00 |

## Bổ sung ngoài bảng QA (từ góp ý thiết kế lượt 2)

- **Nghỉ việc:** bàn giao khách **không bị khóa** bởi việc chưa thu điện thoại; owner đổi ngay. Chỉ nick bị đánh dấu **"Chưa an toàn"** và không ai gửi qua nick đó cho tới khi có người xác nhận đã đăng xuất Zalo trên điện thoại/thiết bị cũ (01 là nguồn chuẩn; 03 QT-SZ-11 sửa theo).
- **"Chia đều"** không chia cho người Vắng, Ngoại tuyến, hoặc đang có cờ Nghỉ phép; nút "Nhắc" gửi cho người đang trực thay nếu owner nghỉ phép (03, 02).
- **Chống gửi trùng khi nick mất kết nối** (Chặn, góp ý thiết kế lượt 2 P-KD): khi nick đỏ, lệnh đang chờ có nút **"Sao chép và bỏ lệnh"** (để sale gửi tạm trên điện thoại). Khi nick kết nối lại, lệnh chờ quá 2 phút **không tự gửi**: hiện hỏi "Gửi ngay / Bỏ lệnh" cho người đã bấm gửi; không ai trả lời trong thời hạn lệnh (30′) thì thành "Quá hạn — chưa gửi". Nếu đã có tin "Gửi từ điện thoại" trong hội thoại sau lúc tạo lệnh, cảnh báo "Có thể trùng với tin bạn đã gửi từ điện thoại" (03, 00).
- **Giới hạn độ dài tin**: theo API hiện tại **2.000 ký tự**; ô soạn đếm và chặn ở 2.000 (00 MH-UI-08, 03) cho tới khi API đổi.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/thong-nhat.md) | — |
