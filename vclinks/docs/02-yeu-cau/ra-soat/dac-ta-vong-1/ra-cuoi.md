# Rà cuối vòng 1 — đối chiếu và sửa lệch giữa 7 đặc tả

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Rà cuối vòng 1 ngày 29/09/2026 (BA trưởng + QA), đối chiếu và sửa lệch giữa các đặc tả 00–06 theo thong-nhat.md, qa.md và 06-xu-ly.md.
- Kết quả: 00–05 lên v1.3, 06 lên v1.2; không đổi nghiệp vụ ngoài bảng chốt.
- 33 chỗ lệch đã sửa (00: 14, 01: 9, 02: 10, 03: 7, 04: 9, 05: 7, 06: 8) và một lượt cập nhật sổ quyết định (11 QĐ mới / gộp, 14 TS mới).
- 765 mã UAT không trùng trong file và giữa file; các kiểm bằng grep đã sạch.
- Còn mở cho chủ dự án: 13 QĐ 🔴 cùng TT-01, TT-02; ba mục đặc tả đang chạy khác BA đề xuất (QĐ-26, QĐ-28, QĐ-81); TS-HD-01 2 giờ hay 4 giờ.
- Cần giao chủ quản: trang Báo cáo chung và màn quy tắc chia khách; cần dữ liệu kiểm thử chung, việc thiết kế và việc dev / đối tác.
- Nhận định: bộ đặc tả đủ để bắt đầu thiết kế và dev MVP, trừ báo cáo hiệu suất và màn quy tắc chia khách.

## Mục lục

- [Cách rà](#cách-rà)
- [Chỗ lệch đã sửa](#chỗ-lệch-đã-sửa)
- [Việc còn mở](#việc-còn-mở)
- [Nhận định](#nhận-định)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Ngày 29/09/2026 · BA trưởng + QA (Claude). Đầu vào: `00` v1.2 … `05` v1.2, `06` v1.1, [thong-nhat.md](thong-nhat.md) (30 dòng + mục Bổ sung), [qa.md](qa.md), [06-xu-ly.md](06-xu-ly.md) (mục "Việc chuyển file khác"), phụ lục "đồng bộ vòng 1b" của từng file, [../../quyet-dinh-chu-du-an.md](../../../01-quan-ly-du-an/quyet-dinh-chu-du-an.md).
> Kết quả: **00–05 → v1.3, 06 → v1.2**, mỗi file có dòng lịch sử "rà cuối vòng 1". Không đổi nghiệp vụ ngoài bảng chốt; chỗ chờ chủ dự án giữ mặc định + mã QĐ / TS. Chưa commit.

## Cách rà

1. Grep 30 dòng bảng chốt và mục Bổ sung trên cả 7 file: `webchat`, `Tạm vắng`, `Thử lại` (cạnh `Cần duyệt lại`), `hủy lệnh` / `outbox.cancelled`, `4.000` / `4000`, `Gửi ngoài VClinks`, `Chưa nhận`, `Hiện số`, `30 giây`, `purple` / tím, route cũ trong bảng "Route cũ đã thay" của 00 §2, câu 403 riêng, `CH-` không tiền tố, 15′ / 30′.
2. Đọc mục "Còn vướng" trong phụ lục của từng file và kiểm lại trên file đích. **Phần lớn "Còn vướng" đã được file đích sửa ở v1.2** (03 SZ-26 / QT-SZ-11 / UAT-SZ-60 không còn khóa "Hoàn tất bàn giao" và không có "Thử lại"; 00 MH-UI-05 đã dùng "Vắng", tham số 30′; 01 đã có `Cần duyệt lại`, `cost.*`, `zns.send_single`, `template.auto_approve`). Các phụ lục chỉ còn ghi chữ cũ nên đã cập nhật lại.
3. Script kiểm: mã UAT trùng (trong file và giữa file), mã màn `MH-*`, quy tắc `HD/OA/MK/SZ/DK/PQ/FP-*`, `QĐ-` / `TS-` / `TT-` được nhắc mà không tồn tại, route ở 01–06 không có trong 00 §2, số cột bảng markdown.

## Chỗ lệch đã sửa

| # | Chỗ lệch | File:mục | Đã sửa thế nào |
|---|---|---|---|
| 1 | Trang mặc định của marketing còn `/reports/marketing` (05 đề nghị xem lại) | 00 §2.3 R3, Q-UI-3; 05 MH-MK-06, MH-MK-10, Phụ lục C.5 | Chốt **`/leads`** (Hộp thư lead) ở R3; 05 ghi MH-MK-06 là trang mặc định, MH-MK-10 không phải |
| 2 | Hạn trả lời owner hỏi giá: 02 [30]′ / +[30]′, 04 15′ / 30′ | 02 §1.3, kịch bản I2, §5.2a, DK-48, UAT-DK-40, Phụ lục E.1 | Thống nhất **15′ lần 1, 30′ lần 2, cả hai tính từ tin khách** (TS-05, TS-06, khớp 04 MH-OA-18); kịch bản I2 đổi giờ 13:55 / 14:10 |
| 3 | Menu "Quyền tạm thời", "Yêu cầu dữ liệu cá nhân", "Đồng bộ" hiện với mọi người ở 01 §5, lệch 00 ⁽¹³⁾ ⁽¹⁴⁾ và UAT-PQ-06 | 01 §5 (bảng menu + ghi chú chung); 00 §2.2 ⁽¹⁴⁾ | 01 xác nhận: người chỉ có quyền "của tôi" **không** có nhóm "Quản trị"; lối vào qua menu tài khoản / chấm nick. 00 bỏ chữ "Lệch 01 §5" |
| 4 | `/admin/retention` "chưa có màn" ở 00, trong khi 01 v1.2 đã đặc tả tab "Thời hạn lưu trữ" của MH-PQ-13 | 00 §2.1, §2.2, bảng route cũ, Q-UI-5; 01 §5 | Route **`/privacy-requests?tab=retention`**, màn chủ quản 01 MH-PQ-13; `/admin/retention` vào bảng "Route cũ đã thay" |
| 5 | Khóa quyền 01 đã có nhưng 00 / 04 / 06 còn ghi "01 chưa có / đang thêm / đề nghị 01 thêm" | 00 §2.2 (Phản hồi thanh toán, Chi phí tin mẫu, Cấu hình hóa đơn, ⁽¹⁰⁾); 04 §1.3, MH-OA-12, MH-OA-14, MH-OA-19; 06 MH-HD-08 | Ghi đúng khóa: `payment_reply.process`, `cost.view`, `cost.edit_actual`, `invoice_settings.edit`, `zns.send_single`, `campaign.report` KT |
| 6 | Khóa công nợ mới của 06 v1.1 chưa có ở 01 | 01 §3.3, chú thích (42), PQ-23 | Thêm `debt.notice.respond` (KD `CT`, GS `TỔ`), `debt.note` (KD, GS, GĐ, KT ghi; SA, QS đọc; CS ✖), `debt.urgent_send`, `statement.confirm` (KT `DV`), `billing_contact.import` (KT, SA `DV`); `debt.hold` thêm GĐ duyệt "Khách chiến lược" / quyết tranh chấp; `report.invoice` thêm GS `TỔ`; `invoice_req.create` KT ✖ chờ HD-CH-10. PQ-23: "Ghi chú thu nợ", lý do "Owner đang trao đổi (giờ)" không phải nội dung chat |
| 7 | "Chia đều" chưa loại người Vắng / Ngoại tuyến / Nghỉ phép ở màn bàn giao (mục Bổ sung) | 01 MH-PQ-04 #6 | Thêm loại trừ + bảng xem trước có lý do (khớp 02 DK-62) |
| 8 | Chip nợ quá hạn trên khung chat (06 HD-55) chưa có ở 00 | 00 MH-UI-07 dải cảnh báo ưu tiên 8 | Thêm dải `warning` "Quá hạn {n} ngày · {số tiền}", CS chỉ "Có công nợ quá hạn", không chặn, nút "Xem công nợ" |
| 9 | Việc "Khách xin hóa đơn · chưa có phiếu" (06 HD-54) chưa có ở "Của tôi" | 00 MH-UI-10 #11, MH-UI-09 #13; 03 MH-SZ-01 #9p | Chip "Xin hóa đơn" + lọc nhanh "Xin hóa đơn chưa có phiếu ({n})"; loại việc 06 ở tab Việc; 03 ghi rõ áp cả tin từ app Zalo (SZ-21) |
| 10 | Thông báo của 06 chưa có ở MH-UI-03 | 00 MH-UI-03 | Thêm "Báo trước nhắc nợ" (Gấp, đẩy điện thoại theo QĐ-01), "Phiếu hóa đơn quá hạn" (gộp), "Tóm tắt tuần công nợ" (GD), "Kế toán đã gửi hóa đơn cho khách của tôi" |
| 11 | "Đặt làm người nhận thanh toán" từ tin / tên trong nhóm chưa có | 00 MH-UI-07 bảng hành động; 02 §4.13a | Thêm hành động (khóa `billing_contact.edit`); 02 thêm luồng tạo người liên hệ từ thành viên nhóm Zalo đã gắn account |
| 12 | Menu "Người nhận thanh toán" (06 MH-HD-12) chưa có ở 00 | 00 §2.1, §2.2; 06 §4.0 | Thêm mục `/debts/billing-contacts` ở nhóm KẾ TOÁN (GD, GS 👁; SA, KT ✓) |
| 13 | Người nhận chỉ có Zalo; "Cách nhắc nợ"; "Ghi chú thu nợ"; báo trước mọi lần nhắc nợ chưa có ở 02 | 02 §4.13a, DK-33, §5.9, MH-DK-01 #19 | SĐT V2+ chỉ bắt buộc cho ZNS, người chỉ có Zalo nhận HĐ và nhắc qua owner; hai trường account đặt ở tab "Hóa đơn & thanh toán"; DK-33 và mức "Cần làm ngay" thêm báo trước nhắc nợ (06 HD-51) |
| 14 | Chip nợ ở báo giá, báo KT + GS khi báo giá lớn, "Tôi tự nhắc khách" + `/nhac-no-nhe` chưa có ở 03 | 03 MH-SZ-05i #10 + hành động, MH-SZ-07 #3, MH-SZ-01 #9o, Q-SZ-21, D55, UAT-SZ-90 | Thêm dải quá hạn không chặn, báo KT + GS khi ≥ TS-HD-08, nút tự nhắc chèn mẫu không tự gửi, ghi một lần nhắc |
| 15 | OA-36, MH-OA-11/12/13/14, OA-29 chưa theo 06 v1.1 | 04 OA-29, OA-36, MH-OA-11 #5, MH-OA-12 #9–#10, MH-OA-13 #7, #10–#12 + hành động, MH-OA-14 #2, #2b, UAT-OA-152, 153, §7 | OA-29 trần riêng theo HD-64 (chờ HD-CH-9 → QĐ-80); OA-36 thay `Xin loại` bằng ba lựa chọn HD-51 cho mục đích thanh toán; tham số `{so_qua_han}` `{so_den_han}` `{so_lieu_tinh_toi}` `{so_tien_nhan}` `{ngay_nhan}` `{con_no}`; nhắc lẻ có mốc sao kê, "Gửi gấp"; chiến dịch 10:30 (TS-HD-09), "Chờ xác nhận sao kê", màn duyệt HD-65, Duyệt khóa tới hết khoảng chờ; báo cáo bỏ mốc "chốt 16:00", cắt kỳ HD-58 |
| 16 | Nút `Nhắn qua Zalo · {nick}` / `Gửi lời mời kết bạn…` ở khối chặn Z2/Z3 (03 QT-SZ-12 lối b) chưa có ở 04 | 04 MH-OA-04 #13 | Thêm, chỉ hiện khi người xem giữ ≥ 1 nick Zalo; hành vi theo 03 |
| 17 | Câu chặn Fanpage: F2′ và F0 chỉ ghi "Chặn như F3", chưa có câu vùng chặn | 05 §2.2a | Viết câu vùng chặn F2′, F0 + nút "Chọn kênh khác"; 00 UAT-UI-60 và MH-UI-08 dùng câu F3 của 05, bỏ câu mẫu tạm |
| 18 | Người duyệt mẫu tự động bình luận / nhắn riêng: 05 dùng `bot.publish` vì "01 chưa có khóa" | 05 MH-MK-09 #10, Phụ lục C.2 | Trỏ `template.auto_approve` (01 PQ-57, GĐ division) |
| 19 | Nhắc lead chưa chia 30′ chưa có mã TS | 05 §4.4, MK-31; sổ QĐ | Thêm **TS-38** |
| 20 | Câu hộp xác nhận lần gửi đầu: 00 còn `{đường gửi}` ("tiện ích… tab"), 03 đã bỏ | 00 MH-UI-08 #9 | Bỏ `{đường gửi}` khỏi câu, giữ ở tooltip dòng #8; đánh 🟡 (code còn) |
| 21 | Nhãn "trực thay" (01 PQ-32 đề nghị biến thể) | 00 §3.3a | Thêm "Gửi bởi {tên} (trực thay {người})" |
| 22 | Câu tạm giữ: 02 có tooltip và dòng sự kiện riêng, khác 00 (nguồn chuẩn câu chữ) | 02 §5.2a, Phụ lục E.3; 00 MH-UI-07 "Dòng sự kiện" | 02 trỏ câu của 00; 00 bổ sung biến thể Vắng / Ngoại tuyến / leo thang lần 2 / ghi chú bàn giao |
| 23 | 06 §4.0 bảng menu ô CS, TT ghi "–", lệch 00 ⁽⁸⁾; "đề nghị 00 sửa" | 06 §4.0; 00 ⁽⁸⁾ | 06 trỏ 00 §2 là nguồn; Hóa đơn CS 👁 (TK), TT 👁 (TUYẾN), Công nợ TT 👁 |
| 24 | Giới hạn tin Zalo 4.000 ở 06 | 06 MH-HD-05 #5 | 2.000 ký tự mọi kênh (00 MH-UI-08 #6, 03 SZ-30) |
| 25 | Màu "Viền tím" cho trạng thái phiếu "Cần bổ sung" (tím trùng chip FB cá nhân) | 06 §2.5 | Không dùng tím, màu theo 00 §3.1 |
| 26 | Tham chiếu hỏng `HD-36c` | 00 MH-UI-07; 06 §8 | Đổi thành HD-01 (tạo phiếu) và HD-36 (c) (gửi kế toán mục thanh toán) |
| 27 | Mã câu hỏi không tiền tố `CH-4`, `CH-6` | 06 (3 chỗ) | Đổi `CH-OA-4`, `CH-OA-6` (thong-nhat #26) |
| 28 | Tên menu cũ "Chiến dịch & ZNS" | 04 MH-OA-11, MH-OA-13 | "Marketing › Mẫu tin ZNS", "Marketing › Chiến dịch gửi tin" (00 §2.1) |
| 29 | MH-MK-12 còn ghi "tab Lead mobile, việc 05 → 00 còn mở" | 05 MH-MK-12 | 00 MH-UI-11 v1.2 đã thêm; sửa câu |
| 30 | Bảng markdown thiếu cột (hiển thị lệch) | 02 kịch bản G (2 dòng); 05 MK-US-20 | Thêm ô trống |
| 31 | 06 §8 và "Việc chuyển file khác" không ghi trạng thái | 06 §8, §9.1 | Ghi "đã làm ở 00–04 v1.3, trừ phần chờ quyết định"; §9.1 ghi mã QĐ tương ứng HD-CH-1…10 |
| 32 | Phụ lục "Còn vướng" ghi việc đã xong | 00, 01, 02 E, 03 G, 04 F, 05 C | Gạch mục đã khớp, ghi chỗ khớp; giữ mục còn mở |
| 33 | Sổ QĐ thiếu 06, số đếm cũ, "chỗ lệch" đã hết | [../../quyet-dinh-chu-du-an.md](../../../01-quan-ly-du-an/quyet-dinh-chu-du-an.md) | HD-CH-1…10 → **QĐ-73…81** (HD-CH-3 gộp vào **QĐ-16**); **QĐ-82** (lead khách cũ khi owner vắng lâu, từ 05 C.6), **QĐ-83** (ai soạn / duyệt bảng phí hậu mãi, từ 04 F.3); **TS-38**, **TS-HD-01…13**; ghi chú TS-05/06/07/08/14 và QĐ-06; bảng "chỗ lệch" gạch 4 dòng đã hết; mục mới "Trạng thái sau rà cuối vòng 1" ghi mặc định đang chạy (khác BA đề xuất ở QĐ-26, QĐ-28, QĐ-81); số đếm 83 QĐ (13 🔴, 52 🟠, 18 🟢), 51 thông số |

**Số chỗ sửa theo file:** 00 — 14 · 01 — 9 · 02 — 10 · 03 — 7 · 04 — 9 · 05 — 7 · 06 — 8 · sổ QĐ — 1 lượt cập nhật (11 QĐ mới / gộp, 14 TS mới).

**Kiểm đã sạch (không phải sửa):** `webchat` chỉ còn trong URL endpoint và ghi chú lịch sử; không còn "Tạm vắng" ngoài ghi chú lịch sử; "Thử lại" không còn trên lệnh `Cần duyệt lại` (00, 01, 03); `outbox.cancelled` chỉ còn ở dòng "thay bằng"; "Gửi ngoài VClinks", "Chưa nhận", "Hiện số", 30 giây cho SĐT đã hết; route cũ (`/zns/*`, `/automation/rules`, `/admin/routing`, `/admin/privacy`, `/customers/erp-link`) chỉ còn trong bảng "Route cũ đã thay" và ghi chú lịch sử; câu 403 riêng đã hết (03, 04 trỏ 01 MH-PQ-11); câu người chỉ xem thống nhất ở 00, 03, 04; OA Z2 không tím.

**Mã UAT:** 765 mã (gồm 3 ca mới UAT-SZ-90, UAT-OA-152, UAT-OA-153; 12 ca kịch bản UAT-DK-01…12 viết dạng tiêu đề; 20 ca hồi quy UAT-SZ-R01…R20), **không trùng** trong file và giữa file (mỗi file một tiền tố; 03 có nhóm hồi quy `UAT-SZ-R01…R20` riêng). Không có mã UAT, màn, quy tắc, QĐ / TS / TT nào được nhắc mà không tồn tại (sau khi sửa dòng 26–27).

## Việc còn mở

### Cần chủ dự án

| Việc | Mã | Ghi chú |
|---|---|---|
| 13 QĐ 🔴 + TT-01 (API VCsales), TT-02 (danh sách kênh, nick test) | QĐ-01…13, TT-01, TT-02 | Không đổi sau rà cuối; đặc tả chạy theo đề xuất |
| Ba mục đặc tả đang chạy **khác** BA đề xuất | QĐ-26 (người duyệt nội dung), QĐ-28 (marketing xem hội thoại trước khi giao), QĐ-81 (kế toán tạo phiếu không tin nguồn) | Anh chọn theo BA đề xuất thì sửa cùng lúc 01 + file liên quan |
| Khoảng chờ báo trước nhắc nợ 2 giờ hay 4 giờ | TS-HD-01 | P-KD, BA 2 giờ; P-GD 4 giờ |
| Chip nợ quá hạn, "Gửi cho kế toán" bản nhanh lên MVP | QĐ-15, QĐ-16 | 00, 03 đã đặc tả, gắn cờ giai đoạn |
| Câu hỏi mới của 06 và rà cuối | QĐ-73…83 | Không có mục 🔴 mới |

### Cần file mới / chủ quản (BA trưởng giao, không tự viết lượt này)

| Việc | Hiện trạng | Đề xuất |
|---|---|---|
| **Trang Báo cáo chung** `/reports` (F10.1 lượng hội thoại, **F10.2 hiệu suất nhân viên**, GS-06) | 00 §2.2 ghi "chưa có chủ quản"; chỉ có tab CSKH (04), Marketing (05), Hóa đơn (06) | File mới `07-bao-cao.md` hoặc giao 00; cần QĐ-07 (tin từ điện thoại tính KPI) và QĐ-53 (doanh số khi trực thay) |
| **Quy tắc chia khách** `/settings/routing` (và ca làm việc cá nhân) | 00 §2.2 "Chưa có màn"; nghiệp vụ ở 02 §5.9a, DK-62 | Giao 02 (chủ quản định tuyến) viết màn MH-DK-15 |
| `/admin/retention` | **Đã có chủ quản** lúc rà: 01 MH-PQ-13 tab "Thời hạn lưu trữ", route đổi `/privacy-requests?tab=retention` | Đóng |
| Trang riêng `/templates`, `/media`, `/tasks` | Tạm dùng hộp MH-SZ-06, tab Việc | Giao 00 hoặc 03 khi lên kế hoạch GĐ2 |
| File dữ liệu kiểm thử chung `du-lieu-kiem-thu.md` (QA U1) và khuôn bảng UAT chung có cột Story / Tiền điều kiện / Dữ liệu (U2, U7) | Mỗi file một bộ dữ liệu riêng; 02 §11.5 đã dùng khuôn mới | BA trưởng lập trước khi QA viết kế hoạch UAT MVP |
| File kênh Fanpage riêng | 05 §2.2a đang ôm khung gửi Fanpage (thong-nhat #22) | Tách khi làm kênh Fanpage |
| UAT cho DK-36 (trả lời công khai bình luận) | 02 chưa có ca | 05 đặc tả kiểm tra trả lời công khai rồi 02 thêm ca |

### Cần thiết kế

- 06 việc designer D1–D14 (MH-HD-12, MH-HD-13 bản 375 px, panel công nợ, màn duyệt chiến dịch nhắc nợ…).
- Chip / dải mới: "Xin hóa đơn", dải nợ quá hạn (00 MH-UI-07 #8, 03 MH-SZ-05i #10), trạng thái chiến dịch "Chờ xác nhận sao kê".
- Màu chờ designer chọn: chip kênh Email, Bình luận, Fanpage (00 §3.2), màu viền "Cần bổ sung" (06), chip "Bình luận" / cửa sổ (05).

### Cần dev / đối tác

- VCsales (TT-01, 06 §9.3 câu 6–7), VCinvoice (I6 / I7 / I9, 06 §9.3 câu 5).
- Kiểm lại chính sách Meta `HUMAN_AGENT` (05 Phụ lục B) và Zalo ZNS / tin có phí (04 ⚠).
- API mới: `POST /outbox/:id/reapprove`, trạng thái `Chờ xác nhận gửi`, lệnh `friend_request` (03 G.4); nguồn "Xe của khách" (03 G.5).
- Pháp chế / kế toán: Q-HD-01, 03, 11, 12 (06 §9.2), QĐ-13.

## Nhận định

**Bộ đặc tả đã đủ để bắt đầu thiết kế và dev MVP**, với các điều kiện sau:

- **Đủ, không còn lệch giữa file:** khung ứng dụng, route / menu, chip, câu chữ (00); quyền và "Không có quyền" (01); định danh, gộp hồ sơ, định tuyến, trạng thái owner, tạm giữ (02); Zalo cá nhân — kênh đã chạy thật (03); CSKH Zalo OA phần MVP (04); lead (05). Các nguồn chuẩn theo chủ đề đã khớp nhau: mỗi chủ đề chỉ đặc tả ở một file, file khác trỏ tới.
- **Vẫn phụ thuộc QĐ 🔴** (đặc tả đã chạy theo mặc định nên thiết kế làm được, nhưng phạm vi MVP có thể đổi): QĐ-01 (điện thoại), QĐ-02 (phạm vi marketing), QĐ-03 (ZNS lẻ), QĐ-04 (mở gửi khách thật), QĐ-05 / QĐ-06 (CSKH và khách của sale), QĐ-08 + **TT-01** (gửi báo giá cần API VCsales — chặn dev phần báo giá).
- **Chưa đủ cho:** báo cáo hiệu suất (F10.1, F10.2) và màn quy tắc chia khách — chưa có chủ quản, cần giao trước khi thiết kế các màn này. 06 (hóa đơn, công nợ) đủ cho thiết kế GĐ2; phần MVP chỉ là bản nhanh MH-HD-01 (QĐ-16).
- **Trước UAT MVP** cần file dữ liệu kiểm thử chung và khuôn UAT chung (U1, U2, U7); không chặn thiết kế và dev.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/ra-cuoi.md) | — |
