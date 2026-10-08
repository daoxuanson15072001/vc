# Xử lý góp ý vòng 1 — 01 Phân quyền

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA xử lý 53 góp ý vòng 1 (16 Chặn) cho đặc tả 01 Phân quyền từ 3 vai: Admin (18 · 5 Chặn), giám sát (19 · 4 Chặn), ban giám đốc / kiểm soát (16 · 7 Chặn).
- Đặc tả 01 lên v1.1 (29/09/2026); mâu thuẫn giữa vai ưu tiên nguyên tắc bắt buộc, đổi nghiệp vụ thì thành câu hỏi Q-PQ.
- Kết quả: 40 đã sửa (15 Chặn), 5 sửa một phần kèm hỏi / chuyển file (1 Chặn), 6 hỏi chủ dự án, 1 chuyển file khác, 1 không làm.
- Không còn Chặn để nguyên; P-BGD #5 (dữ liệu khách qua Claude) đã ghi vào đặc tả, phần pháp lý là Q-PQ-18, phải chốt trước khi mở MCP cho người ngoài nhóm dự án.
- UAT sau v1.1: 94 kịch bản, không trùng mã; UAT đề xuất của người dùng đã đối chiếu sang mã chính thức.
- 14 câu hỏi cho chủ dự án (Q-PQ-05…23: đọc nguyên văn chat, lưu nhật ký, token MCP, đổi tổ, xuất kèm SĐT, hạn NĐ 13, token thiết bị trên máy cá nhân…).
- 12 việc cho designer, gồm 3 màn mới MH-PQ-13 Yêu cầu dữ liệu cá nhân, MH-PQ-14 Cảnh báo, MH-PQ-15 Nhập lô người dùng; việc chuyển các file 00, 02–06.
- Còn mở: các câu Q-PQ chờ chủ dự án và pháp chế chốt; người duyệt nên xem kỹ Q-PQ-18.

## Mục lục

- [Sổ xử lý](#sổ-xử-lý)
- [Đối chiếu mã UAT đề xuất → mã chính thức](#đối-chiếu-mã-uat-đề-xuất--mã-chính-thức)
- [Câu hỏi cho chủ dự án](#câu-hỏi-cho-chủ-dự-án)
- [Việc cho designer](#việc-cho-designer)
- [Việc chuyển file khác](#việc-chuyển-file-khác)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Đặc tả: `docs/02-yeu-cau/dac-ta/01-phan-quyen.md` → **v1.1 (29/09/2026)**. Góp ý: `01-P-AD.md` (18 · 5 Chặn), `01-P-GS.md` (19 · 4 Chặn), `01-P-BGD.md` (16 · 7 Chặn). Tổng **53 góp ý, 16 Chặn**.
> Quy tắc lọc: README bước 3. Mâu thuẫn giữa vai → ưu tiên nguyên tắc bắt buộc (CLAUDE.md §12, BA §7), rồi vai trực tiếp dùng màn hình. Đổi nghiệp vụ / phạm vi → câu hỏi cho chủ dự án (Q-PQ-xx không tự chốt).

**Tổng hợp kết quả**

| Kết quả | Số góp ý | Trong đó Chặn |
|---|---|---|
| Đã sửa (kể cả dòng "Đã sửa + Hỏi" khi đặc tả đã đủ, chỉ còn chốt tham số) | 40 | 15 |
| Đã sửa một phần + Hỏi chủ dự án / Chuyển file khác | 5 | 1 |
| Hỏi chủ dự án | 6 | 0 |
| Chuyển file khác | 1 | 0 |
| Không làm | 1 | 0 |
| **Cộng** | **53** | **16** |

Không còn góp ý mức Chặn nào để nguyên: 15 Chặn đã sửa trong đặc tả (một số còn chốt tham số ở Q-PQ-12…23); 1 Chặn (P-BGD #5 dữ liệu qua Claude) đã ghi vào đặc tả, phần pháp lý là Q-PQ-18 — phải chốt trước khi mở MCP cho người ngoài nhóm dự án.

## Sổ xử lý

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa / lý do |
|---|---|---|---|---|
| P-AD #1 | Chặn | Không nhập lô người + vai trò + đơn vị + trưởng nhóm + nick; Google tạo người không vai trò | Đã sửa | MH-PQ-15 mới (file CSV/xlsx mẫu, tải hiện trạng, xem trước Thêm/Đổi/Lỗi theo dòng, còn lỗi không ghi, Google Workspace có bảng ánh xạ); MH-PQ-01 #10 cho để trống quản lý; MH-PQ-02 nút "Nhập từ file"; khóa `user.import`; PQ-US-15; UAT-PQ-63, 64 |
| P-AD #2 | Chặn | Admin tự gán `quan_sat`/GĐ cho mình, tạo người rồi gán nick | Đã sửa + Hỏi | PQ-41 (không sửa quyền chính mình, cả qua nhập lô), PQ-42 (vai trò nhạy cảm, gán chéo division, người giữ nick của tài khoản < 7 ngày → người thứ hai duyệt; QS được báo mọi thay đổi do Admin), NT6, D14, MH-PQ-03 #13–14, MH-PQ-07 tab mới; người duyệt khi chỉ có 1 Admin → **Q-PQ-17**; UAT-PQ-65 |
| P-AD #3 | Chặn | Khóa nghỉ việc bỏ sót token thiết bị, lệnh gửi chờ, nick trên điện thoại, đơn vị đang quản lý | Đã sửa | PQ-33, PQ-51, `canDispatch` §2.9, MH-PQ-04 #4a–4c, #11a; D15; UAT-PQ-67, 68, 69 |
| P-AD #4 | Chặn | "Quyền hiệu lực" chỉ dùng được khi có link; không nói cần gì để thấy | Đã sửa | PQ-49; MH-PQ-03 #9–10b (tra theo tên / mã KH / SĐT, tên viết tắt, "Cách thấy", "Tạo yêu cầu quyền hộ", "Quyền đổi lần cuối"); khóa `permission.explain`; PQ-US-19; UAT-PQ-70 |
| P-AD #5 | Chặn | Không có màn hình phiếu NĐ 13; xác nhận bằng tên khách không đủ; dữ liệu đồng bộ lại | Đã sửa + Hỏi | PQ-50, MH-PQ-13 mới, `privacy_requests`, `ingest_tombstones`, §2.10; PQ-08 / chú thích (19) xác nhận bằng mã phiếu; hạn, chứng từ giữ lại, VCwiki → **Q-PQ-20**; UAT-PQ-57 (sửa), 73 |
| P-AD #6 | Nên sửa | HR khóa Google nhưng VClinks không biết | Hỏi chủ dự án | Đổi phạm vi tích hợp → **Q-PQ-12** (cập nhật phương án, BA đề xuất đối chiếu chiều khóa mỗi giờ); UAT-PQ-74 ghi "Chờ Q-PQ-12" |
| P-AD #7 | Nên sửa | Chép tay token thiết bị; xoay vòng âm thầm; không tách thu hồi ngay | Đã sửa | PQ-52 (mã ghép 6 số, tự xoay vòng, "Thu hồi ngay (nghi lộ)"), R10; §2.7; MH-PQ-08 #2a; UAT-PQ-75. Phần hiển thị mã trong extension → chuyển file 03 |
| P-AD #8 | Nên sửa | Token lộ: không lọc nhật ký theo token/IP, chủ token không được báo | Đã sửa | §2.7 lý do thu hồi + báo chủ token; MH-PQ-08 #11, Drawer tổng hợp, "Thu hồi mọi token của <người>"; MH-PQ-10 #6a, 6b; UAT-PQ-72 |
| P-AD #9 | Nên sửa | Chỉ một loại cảnh báo; thiếu xuất, MCP, ngoài giờ, IP lạ… | Đã sửa | PQ-46 bộ R1–R11, MH-PQ-14 mới, `alert_rules`/`alerts`; UAT-PQ-87 |
| P-AD #10 | Nên sửa | Nhật ký xuất không có bộ lọc và danh sách khách | Đã sửa | PQ-47 (lưu bộ lọc, mã khách, mã băm file; tra theo mã khách ra lần xuất); MH-PQ-10 #6, #8; UAT-PQ-89 |
| P-AD #11 | Nên sửa | Tự tạo token MCP mặc định Bật, trái NT2; gán chéo không hạn | Đã sửa | PQ-43 mặc định tắt, bật theo division / vai trò; MH-PQ-08 #1; PQ-56 gán chéo có "Đến ngày" ≤ 90 ngày; MH-PQ-06 #12; L4. Chính sách token phạm vi rộng vẫn ở **Q-PQ-09** |
| P-AD #12 | Nên sửa | Chuyển tổ không hỏi nick, quản lý, trực thay, ngày hiệu lực | Đã sửa | PQ-54, MH-PQ-03 "Đổi đơn vị" (trình hướng dẫn 5 bước, hẹn giờ); mặc định khách đi / ở vẫn là **Q-PQ-11**; UAT-PQ-93 |
| P-AD #13 | Nên sửa | Không xin quyền được khi chỉ có SĐT | Đã sửa | PQ-49, MH-PQ-07 #6a (không lộ khách có tồn tại, không lộ tên người duyệt — khác đề xuất gốc để giữ NT8); UAT-PQ-71 |
| P-AD #14 | Nên sửa | Không có soát quyền định kỳ | Đã sửa | PQ-56, MH-PQ-02 "Soát quyền", khóa `access.review` (gộp với P-BGD #12) |
| P-AD #15 | Nên sửa | "Nick chờ Admin xác nhận" có trong §2.10 nhưng không có màn hình | Đã sửa | PQ-52 (d), MH-PQ-06 #10 + nút Xác nhận / Từ chối và xóa, khóa `channel.confirm`; UAT-PQ-91 |
| P-AD #16 | Gợi ý | Không có màn hình thời hạn lưu, báo cáo đã xóa | Đã sửa (tối thiểu) + Chuyển designer | PQ-55, `retention_settings`, `config.retention` Admin đề xuất – QS duyệt; báo cáo trong Tổng quan kiểm soát; màn hình cấu hình giao designer; UAT-PQ-94 |
| P-AD #17 | Gợi ý | Không nhắc trước hạn 24 giờ bàn giao | Đã sửa | PQ-34 nhắc ở 4 giờ và 20 giờ; MH-PQ-02 bộ lọc "Nghỉ việc – chưa bàn giao xong" |
| P-AD #18 | Gợi ý | Tab Nhật ký không có thao tác tác động lên người đó | Đã sửa | MH-PQ-03 #12 `Segmented` "Do người này làm / Tác động lên người này" |
| P-GS #1 | Chặn | GS không nhận `giu_nick`, mâu thuẫn PQ-34 | Đã sửa | §2.5 (GS nhận `giu_nick`; GĐ khi division bật), PQ-44, D13, L16; UAT-PQ-76 |
| P-GS #2 | Chặn | GS phải bấm "Hiện" cả với khách của chính mình | Đã sửa | Ma trận `cust.phone_full` GĐ/GS "CT, NICK: luôn hiện", PQ-45, MH-PQ-12 #5; UAT-PQ-76 |
| P-GS #3 | Chặn | Trực thay / giữ nick tạm không nhận lời mời kết bạn, tạo nhóm | Đã sửa | PQ-44, `canUseNickRight` §2.9, ma trận `friend.respond`, `group.manage`, `msg.recall` ô GĐ/GS/TT = NICK, chú thích (10), (22); UAT-PQ-77 |
| P-GS #4 | Chặn | Bàn giao nick không xác nhận đăng xuất điện thoại, lệnh chờ | Đã sửa | PQ-51, MH-PQ-04 #11a. **Khác đề xuất:** không khóa nút "Hoàn tất bàn giao" (P-GS) mà cho hoàn tất với nick "Chưa an toàn" + nhắc hằng ngày (P-BGD #6) — để người giữ mới vẫn trả lời được khách; lệnh chờ **hủy** (không "Cần duyệt lại") vì người duyệt đã nghỉ; UAT-PQ-67, 68 |
| P-GS #5 | Nên sửa | GS không tạm khóa được người trong tổ khi có sự cố | Đã sửa | PQ-53, ma trận `user.lock` GS "TỔ: chỉ tạm khóa khẩn" (28), MH-PQ-02 menu [⋯]; UAT-PQ-81, UAT-PQ-43 (sửa) |
| P-GS #6 | Nên sửa | Không có trạng thái "Sắp nghỉ" | Đã sửa một phần + Hỏi | Cờ "Sắp nghỉ" (`user.pre_leave`, PQ-45, R7, token chỉ Đọc); chuyển SĐT khách của chính họ sang "Hiện +NK" → **Q-PQ-15**; UAT-PQ-82 |
| P-GS #7 | Nên sửa | Chỉ một người trực, nhận toàn bộ | Đã sửa | §2.6, PQ-32 (Trực nick + tối đa 3 người Trực nhóm khách), MH-PQ-07 #5, 5a; UAT-PQ-80 |
| P-GS #8 | Nên sửa | Trực thay thấy đầy đủ SĐT, công nợ, doanh số không nhật ký | Đã sửa | PQ-32 (SĐT "Hiện +NK", khối thương mại chỉ trong panel, không xuất, tóm tắt cho người vắng); UAT-PQ-79 |
| P-GS #9 | Nên sửa | Trực thay thiếu hộp xác nhận, ghi chú, báo người vắng | Đã sửa | PQ-32 (hộp xác nhận 5 phút / đang trực tuyến, ghi chú nội bộ, tóm tắt 18:00); UI khung chat → file 03; UAT-PQ-78 |
| P-GS #10 | Nên sửa | Doanh số khi trực thay / trả lời thay tính cho ai | Hỏi chủ dự án | Nghiệp vụ tính thưởng → **Q-PQ-16** |
| P-GS #11 | Nên sửa | Chia đều theo số khách, không xem được doanh số | Đã sửa | PQ-33, MH-PQ-04 #6 (thêm "Theo khu vực / tag", bảng xem trước doanh số 12 tháng, hạng A, sửa tay); UAT-PQ-83 |
| P-GS #12 | Nên sửa | GS không xin chuyển khách về tổ được | Đã sửa một phần + Chuyển file khác (02) | Ma trận `cust.transfer_request` GS "Về tổ mình" (27), L15; bước lấy ý kiến GS tổ nguồn, "tự duyệt khi 2 GS đồng ý" → file 02. UAT đề xuất GS10 chuyển file 02 |
| P-GS #13 | Nên sửa | Yêu cầu quyền tạm thời không có hạn duyệt, người duyệt thay | Đã sửa | §2.6 (nhắc 2 giờ, chuyển 4 giờ, người duyệt thay theo trực thay, gom thông báo mỗi buổi); MH-PQ-07 thao tác mới; UAT-PQ-84 |
| P-GS #14 | Gợi ý | GS không được báo khi người ngoài được xem khách tổ mình | Đã sửa | §2.6 gạch cuối, MH-PQ-07 "Đề nghị xem lại"; UAT-PQ-85 |
| P-GS #15 | Nên sửa | Không có nút Gọi; ngưỡng chung cho mọi vai trò | Đã sửa | PQ-37 nút "Gọi", MH-PQ-12 #6; R1 ngưỡng theo vai trò (GS, GĐ 40/giờ); UAT-PQ-28 (sửa) |
| P-GS #16 | Nên sửa | Lead ở hàng tổ không hạn; GS không xem quy tắc chia; marketing còn trả lời? | Đã sửa một phần + Chuyển file khác (03, 05) | PQ-21, PQ-22 (lead giao tổ không còn "Lead chưa giao", marketing chỉ đọc), `config.sla` GS "Xem: TỔ"; UAT-PQ-90. Nhắc 30 phút, bảng lead đã chia theo NVKD → file 03 / 05 |
| P-GS #17 | Nên sửa | Yêu cầu "Nhận xử lý" của CSKH dồn về GS không hạn | Chuyển file khác (04) + Hỏi | Luồng CSKH thuộc file 04; ghi vào **Q-PQ-01** (phương án GS đặt "CSKH tự nhận khi quá SLA", chuyển sau 15 phút) |
| P-GS #18 | Gợi ý | CSKH đọc toàn bộ lịch sử chat trên nick khi có ticket | Đã sửa | Chú thích (1) §3.1: mặc định 30 ngày trước ticket, "Xem thêm" có nhật ký, owner thấy ghi chú hệ thống |
| P-GS #19 | Gợi ý | GS tra nhật ký của NVKD không để lại dấu | Đã sửa | PQ-40 (`audit.view_person`, người bị tra thấy trong "Hoạt động của tôi"; GS mặc định vào tab Cảnh báo), chú thích (24); UAT-PQ-86 |
| P-BGD #1 | Chặn | Chỉ một loại cảnh báo, không áp cho owner | Đã sửa | PQ-46 R1–R11 (R2 mở hồ sơ tính cả khách của mình; R3 xuất; R4 MCP; R5 ngoài giờ; R6 IP mới; R7 sắp nghỉ; R8 xin quyền nhiều), MH-PQ-14, PQ-US-13; R "danh thiếp / nhiều SĐT gửi ra" (f) chưa làm — cần nhận diện nội dung tin, ghi cho vòng sau; UAT-PQ-87 |
| P-BGD #2 | Chặn | `mcp.call` không ghi đối tượng | Đã sửa | PQ-47, §3.8, `audit_log.targets[]`, MH-PQ-10 #8, MH-PQ-09 "AI đã đọc…"; QS / YC qua MCP tính như `conversation.view`; UAT-PQ-88 |
| P-BGD #3 | Chặn | Admin tạo hộ token MCP cho người khác | Đã sửa | PQ-43, §2.7, MH-PQ-08 #2 (bỏ loại "Token MCP cho người dùng"), `token.manage`, NT6, L14; UAT-PQ-66 |
| P-BGD #4 | Nên sửa | Token của vai trò rộng như token NVKD | Hỏi chủ dự án | **Q-PQ-09** cập nhật phương án (BA đề xuất: 30 ngày, người thứ hai duyệt, giới hạn khối lượng); QS không nhận nguyên văn chat qua MCP → **Q-PQ-05** |
| P-BGD #5 | Chặn | Dữ liệu khách đi qua Claude = chuyển ra nước ngoài | Đã sửa một phần + Hỏi | Ghi rõ ở §3.8, L13 (mâu thuẫn BA §1 nguyên tắc 4); quyết định pháp lý và các biện pháp tạm → **Q-PQ-18** (chủ dự án + pháp chế), chốt trước khi mở MCP ngoài nhóm dự án |
| P-BGD #6 | Chặn | Khóa VClinks không làm mất nick trên điện thoại | Đã sửa | PQ-51 (xác nhận đăng xuất, "Chưa an toàn", nhắc GĐ + Admin + QS, cảnh báo R11 tin gửi từ thiết bị khác), MH-PQ-04 #11a, MH-PQ-06 #11; quy định "nick chỉ đăng nhập trên thiết bị đã khai báo" → **Q-PQ-22**; UAT-PQ-68, 69 |
| P-BGD #7 | Chặn | GĐ tự xuất cả division kèm SĐT | Đã sửa + Hỏi | PQ-48, ma trận `cust.export_phone`, `export.approve`, chú thích (18), link 24 giờ, mã xuất trên mọi trang; người duyệt và trần dòng → **Q-PQ-19**; UAT-PQ-29 (sửa), 89 |
| P-BGD #8 | Chặn | NĐ 13 chưa có màn hình, hạn, xác minh; CSKH không tạo được phiếu | Đã sửa + Hỏi | PQ-50, MH-PQ-13, khóa `privacy.intake` cho mọi vai trò tiếp xúc khách, xác minh, hạn đếm ngược, danh sách chặn, phần giữ theo luật, biên bản, sổ cho QS; số ngày, chứng từ, VCwiki → **Q-PQ-20**; UAT-PQ-73 |
| P-BGD #9 | Nên sửa | QS đọc chat không cần lý do, không ai rà | Hỏi chủ dự án | Chính là câu Q-PQ-05 (BGĐ có đọc chat, điều kiện gì) → **Q-PQ-05** cập nhật phương án A/B/C, BA đề xuất B. Cảnh báo R9 đã có; UAT đề xuất BGD-69 treo tới khi chốt |
| P-BGD #10 | Nên sửa | Chưa có văn bản thông báo nhân viên; hội thoại gia đình bị đọc | Hỏi chủ dự án | Quy định nội bộ và phạm vi dữ liệu → **Q-PQ-21**; UAT đề xuất BGD-72 treo tới khi chốt |
| P-BGD #11 | Nên sửa | Không có Báo cáo kiểm soát tổng hợp | Đã sửa + Chuyển designer | MH-PQ-10 #6c, 6d tab "Tổng quan kiểm soát"; UAT-PQ-92; bố cục giao designer |
| P-BGD #12 | Nên sửa | Không rà soát quyền định kỳ | Đã sửa | PQ-56 (quý; chéo division và token rộng hằng tháng; quá 14 ngày báo QS), MH-PQ-02 "Soát quyền" |
| P-BGD #13 | Nên sửa | Nhật ký vẫn nằm trong tay Admin | Hỏi chủ dự án | Hạ tầng lưu trữ độc lập → **Q-PQ-23** (a) |
| P-BGD #14 | Nên sửa | Khóa phụ thuộc người nhớ bấm; không có cờ "Đã nộp đơn" | Đã sửa một phần + Hỏi | Cờ "Sắp nghỉ" (PQ-45, R7, token chỉ Đọc, yêu cầu quyền báo QS); đồng bộ Google → **Q-PQ-12** |
| P-BGD #15 | Gợi ý | Đổi thời hạn lưu phải QS duyệt, có báo cáo | Đã sửa | PQ-55, `config.retention` (Admin đề xuất, QS duyệt, 7 ngày); UAT-PQ-94 |
| P-BGD #16 | Gợi ý | Báo cáo chi phí AI theo người / division | Không làm | Không thuộc phân quyền; là báo cáo vận hành AI (BA tổng §F10 / worker suggest). Đề xuất đưa vào backlog báo cáo khi làm GĐ5 |

**Câu hỏi của người góp ý đã được trả lời trong v1.1** (không cần hỏi lại): P-AD Q1 (công ty thu máy / đổi mật khẩu ngoài hệ thống, VClinks ghi người xác nhận; không chặn hoàn tất mà gắn "Chưa an toàn"), Q3 (Admin chỉ thấy mã hồ sơ + số đếm, GĐ xác nhận đúng khách — PQ-50), Q6 (Admin luôn được báo khi GĐ khóa — PQ-33); P-GS Q1 (GS giữ được nick riêng và nick tạm — PQ-44), Q3 (người vắng vẫn giữ quyền, chống trùng bằng hộp xác nhận — PQ-32), Q4 (hướng dẫn chọn trả lời thay / trực thay — PQ-32), Q5 (cờ "Sắp nghỉ" — PQ-45), Q8 (ngưỡng theo vai trò — R1). Còn lại đã đưa vào Q-PQ-xx bên dưới hoặc chuyển file khác.

## Đối chiếu mã UAT đề xuất → mã chính thức

| Đề xuất | Chính thức | Ghi chú |
|---|---|---|
| P-AD UAT-PQ-63 | UAT-PQ-63 | Thêm dòng của chính người nhập |
| P-AD UAT-PQ-64 | UAT-PQ-65 | Gộp gán chéo division |
| P-AD UAT-PQ-65 | UAT-PQ-67 | Gộp phần lệnh chờ của P-GS GS08 |
| P-AD UAT-PQ-66 | UAT-PQ-70 | – |
| P-AD UAT-PQ-67 | UAT-PQ-72 | Gộp P-BGD UAT-PQ-66 |
| P-AD UAT-PQ-68 | UAT-PQ-73 | Gộp P-BGD UAT-PQ-68 |
| P-AD UAT-PQ-69 | UAT-PQ-74 | Gộp P-BGD UAT-PQ-71; chờ Q-PQ-12 |
| P-AD UAT-PQ-70 | UAT-PQ-71 | Không lộ tên người duyệt với người xin |
| P-AD UAT-PQ-71 | UAT-PQ-75 | – |
| P-GS GS01 | UAT-PQ-76 | – |
| P-GS GS02 | UAT-PQ-77 | – |
| P-GS GS03 | UAT-PQ-78 | – |
| P-GS GS04 | UAT-PQ-79 | – |
| P-GS GS05 | UAT-PQ-80 | – |
| P-GS GS06 | UAT-PQ-81 | – |
| P-GS GS07 | UAT-PQ-82 | Phần ẩn SĐT chờ Q-PQ-15 |
| P-GS GS08 | UAT-PQ-67, 68 | Lệnh chờ bị hủy (không "Cần duyệt lại"); không khóa Hoàn tất |
| P-GS GS09 | UAT-PQ-83 | – |
| P-GS GS10 | – | Chuyển file 02 |
| P-GS GS11 | UAT-PQ-84 | – |
| P-GS GS12 | UAT-PQ-90 | Phần nhắc 30 phút chuyển file 03 / 05 |
| P-GS GS13 | UAT-PQ-85 | – |
| P-GS GS14 | UAT-PQ-86 | – |
| P-BGD UAT-PQ-63 | UAT-PQ-87 | – |
| P-BGD UAT-PQ-64 | UAT-PQ-88 | – |
| P-BGD UAT-PQ-65 | UAT-PQ-66 | – |
| P-BGD UAT-PQ-66 | UAT-PQ-72 | Gộp |
| P-BGD UAT-PQ-67 | UAT-PQ-89 | Người duyệt chờ Q-PQ-19 |
| P-BGD UAT-PQ-68 | UAT-PQ-73 | Gộp |
| P-BGD UAT-PQ-69 | – | Chờ Q-PQ-05 |
| P-BGD UAT-PQ-70 | UAT-PQ-68 | Gộp |
| P-BGD UAT-PQ-71 | UAT-PQ-74 | Gộp |
| P-BGD UAT-PQ-72 | – | Chờ Q-PQ-21 |
| P-BGD UAT-PQ-73 | UAT-PQ-92 | – |
| (BA thêm) | UAT-PQ-64, 69, 91, 93, 94 | Google ánh xạ; tin gửi từ thiết bị khác; nick chờ xác nhận; đổi đơn vị; thời hạn lưu |

UAT cũ đã sửa theo v1.1: UAT-PQ-28, 29, 37, 43, 50, 54, 57. Tổng: 94 kịch bản, không trùng mã.

## Câu hỏi cho chủ dự án

Chi tiết phương án ở §9 của đặc tả. Mỗi câu: phương án + đề xuất BA.

| Mã | Câu hỏi | Phương án | BA đề xuất | Từ góp ý |
|---|---|---|---|---|
| Q-PQ-05 (cập nhật) | BGĐ / kiểm soát đọc nguyên văn chat với điều kiện gì; ai rà việc đọc của QS; token QS có trả nguyên văn không | A đọc tự do có nhật ký · B nguyên văn cần lý do + mã vụ việc, tóm tắt tuần gửi Chủ tịch, MCP chỉ tóm tắt · C không đọc nguyên văn | B | BGD #4, #9 |
| Q-PQ-07 (cập nhật) | Thời hạn lưu nhật ký; số liệu mặc định R1–R11 | A 24 tháng mọi loại · B 24 tháng, riêng NĐ 13 / xuất kèm SĐT / xóa 5 năm | B, pháp chế xác nhận | BGD Q-PQ-07 |
| Q-PQ-09 (cập nhật) | Token MCP cho vai trò phạm vi `DV`/`TĐ` | A như NVKD · B 30 ngày + người thứ hai duyệt + giới hạn 300 khách/ngày · C không cấp ở MVP | B, sau Q-PQ-18 | BGD #4 |
| Q-PQ-11 (cập nhật) | Đổi tổ: khách đi theo người hay ở lại | A hỏi, mặc định đi theo · B mặc định ở lại, GĐ chọn đi theo có lý do · C luôn ở lại | B | AD #12, BGD |
| Q-PQ-12 (cập nhật) | Đồng bộ chiều khóa từ Google Workspace | A tay · B đối chiếu mỗi giờ, tự tạm khóa · C đồng bộ hai chiều | B | AD #6, BGD #14 |
| Q-PQ-15 | SĐT khách của chính owner so với phát hiện rò rỉ | A luôn hiện, phát hiện qua R2–R4 · B như A + "Sắp nghỉ" chuyển sang Hiện +NK · C owner cũng bấm Hiện | B | GS #2, #6; BGD #1 |
| Q-PQ-16 | Doanh số khi trực thay / trả lời thay; owner của khách mới vào nick người vắng | A tính owner, cột "Trả lời hộ" · B chia tỉ lệ · C người chốt đơn | A | GS #10 |
| Q-PQ-17 | Người thứ hai duyệt vai trò nhạy cảm khi chỉ có một Admin | A GĐ/chéo division → QS; admin/QS → Chủ tịch · B mọi thứ → Chủ tịch · C hai Admin | A | AD #2, AD Q2 |
| Q-PQ-18 | Dữ liệu qua Claude có là chuyển dữ liệu ra nước ngoài (NĐ 13), cần hồ sơ gì | Hỏi chủ dự án + pháp chế; tạm: MCP chỉ nhóm dự án, SĐT ẩn qua MCP với mọi vai trò, viết tắt tên khách lẻ | Chốt trước khi mở MCP / gợi ý AI rộng | BGD #5 |
| Q-PQ-19 | Ai duyệt xuất kèm SĐT; trần dòng không cần duyệt | A QS, 500 dòng · B GĐ khác hoặc QS, 2.000 dòng · C Chủ tịch | A | BGD #7 |
| Q-PQ-20 | Hạn xử lý NĐ 13; chứng từ phải giữ; bản VCwiki có phải xóa | Pháp chế (số ngày), kế toán (chứng từ); VCwiki: xóa bản thô, giữ thẻ đã tinh chế | Tạm 15 ngày | AD #5, AD Q4, BGD #8 |
| Q-PQ-21 | Văn bản quy định nick công ty có chữ ký; ẩn hội thoại `gia_dinh_ban_be` | A ẩn, cần quyền tạm thời · B chỉ lưu metadata · C như khách | Có văn bản; A | BGD #10 |
| Q-PQ-22 | Token thiết bị trên máy cá nhân của NVKD | A chỉ máy công ty · B cho phép, ghép mã, thu hồi khi nghỉ · C tự do | B rồi tiến tới A | AD Q5, BGD #6 |
| Q-PQ-23 | Kho nhật ký độc lập; kênh cảnh báo ngoài giờ | (a) bucket do kiểm soát giữ khóa / mã băm qua email · (b) email + Zalo OA nội bộ cho R4, R6, R11 | (a) bucket; (b) như trên | BGD #13, AD Q7, Q8 |

## Việc cho designer

1. **MH-PQ-13 Yêu cầu dữ liệu cá nhân** (mới): danh sách + chi tiết 5 bước (ghi nhận → xác minh → khớp khách → thực hiện → biên bản), đồng hồ hạn, hai góc nhìn AD (chỉ mã + số đếm) và GĐ (có tên); điểm vào "Ghi nhận yêu cầu dữ liệu cá nhân" từ menu ⋯ của hội thoại / hồ sơ.
2. **MH-PQ-14 Cảnh báo** (mới): danh sách cảnh báo có trạng thái, modal "Đã xử lý"; tab Quy tắc dạng bảng sửa tại chỗ.
3. **MH-PQ-15 Nhập lô người dùng** (mới): chọn nguồn, bảng ánh xạ Google, bảng xem trước Thêm / Đổi (cũ → mới) / Lỗi / Chờ duyệt, trạng thái khóa nút Nhập.
4. **MH-PQ-04**: bước ① thêm bảng token thiết bị, lệnh gửi chờ, đơn vị đang quản lý; bước ② bảng xem trước doanh số; bước ③ ô xác nhận đăng xuất điện thoại (không có ô mật khẩu) và Tag "Chưa an toàn".
5. **MH-PQ-03**: tab "Quyền hiệu lực" tra theo tên / SĐT, nhiều kết quả, "Cách thấy", "Tạo yêu cầu quyền hộ", dòng "Quyền đổi lần cuối"; trang của chính mình ở chế độ chỉ đọc; Tag "Chờ duyệt" trên dòng vai trò; trình hướng dẫn "Đổi đơn vị" 5 bước có hẹn giờ; tab Nhật ký có `Segmented`.
6. **MH-PQ-02**: menu [⋯] thêm "Tạm khóa khẩn", "Đặt cờ Sắp nghỉ"; Tag "Sắp nghỉ"; ngăn "Soát quyền"; nút "Nhập từ file".
7. **MH-PQ-06**: khu "Nick chờ xác nhận"; Tag đỏ "Chưa an toàn" + nút xác nhận; ô "Đến ngày" khi gán chéo.
8. **MH-PQ-07**: modal Trực thay hai phần (Trực nick, Trực nhóm khách tối đa 3 dòng); modal "Xin quyền theo SĐT / mã KH"; tab "Thay đổi vai trò chờ duyệt"; nút "Đề nghị xem lại".
9. **MH-PQ-08**: bỏ loại "Token MCP cho người dùng"; ô bật tự tạo theo division / vai trò; modal "Ghép thiết bị"; modal thu hồi có lý do; Drawer "Phạm vi ảnh hưởng"; tách "Xoay vòng" và "Thu hồi ngay (nghi lộ)".
10. **MH-PQ-10**: bộ lọc Token, IP; Drawer hiện `targets[]`; tab "Tổng quan kiểm soát" (thẻ số liệu + bảng top 10, xuất PDF).
11. **MH-PQ-12**: nút "Gọi" (mobile `tel:`, máy tính hộp QR 60 giây).
12. **Cài đặt bảo mật**: bảng thời hạn lưu (đề xuất → chờ QS duyệt → áp dụng sau 7 ngày, "Chạy thử").

## Việc chuyển file khác

| File | Việc | Từ góp ý |
|---|---|---|
| 00 Giao diện chung | Menu "Quản trị" thêm "Cảnh báo", "Yêu cầu dữ liệu cá nhân"; chuông thông báo nhận cảnh báo R*, nhắc phiếu NĐ 13, nhắc nick "Chưa an toàn"; `<MaskedContact>` thêm nút "Gọi"; menu ⋯ hội thoại / hồ sơ có "Ghi nhận yêu cầu dữ liệu cá nhân" | AD #9, GS #15, BGD #1, #8 |
| 02 Khách đa kênh | Luồng GS "Yêu cầu chuyển khách về tổ" (GS tổ nguồn đồng ý / phản đối, GĐ chốt, tùy chọn tự duyệt khi hai GS đồng ý; UAT đề xuất GS10); quy tắc chia khách theo tổ, GS xem được; mặc định đổi tổ theo Q-PQ-11 | GS #12, #16, Q6, Q7 |
| 03 Sale Zalo cá nhân | Hộp xác nhận trực thay và ghi chú hệ thống trên khung chat; tóm tắt trực thay 18:00; nhắc lead ở hàng tổ quá 30 phút và bảng "lead / khách mới đã chia tháng này theo NVKD"; extension: hiện mã ghép 6 số, nhận xoay vòng tự động; outbox: hủy lệnh khi người duyệt bị khóa (`canDispatch`); phát hiện tin gửi từ điện thoại (tin `fromUid = '0'` không khớp outbox) cho R11; owner của khách mới kết bạn vào nick khi người giữ vắng (theo Q-PQ-16) | GS #9, #16, AD #3, #7, BGD #6 |
| 04 CSKH Zalo OA | "Nhận xử lý" khi quá SLA: GS đặt cho tổ, tự chuyển sau 15 phút (Q-PQ-01); CSKH mở hội thoại nick qua ticket: mặc định 30 ngày trước ticket, ghi chú hệ thống cho owner; điểm ghi nhận yêu cầu NĐ 13 từ OA / tổng đài | GS #17, #18, BGD #8 |
| 05 Marketing, chatbot | Lead giao cho tổ: marketing chỉ đọc, ô soạn khóa "Lead đã giao cho <tổ>"; nhắc lead chưa chia | GS #16 |
| 06 Hóa đơn, công nợ | Danh sách chứng từ phải giữ khi xóa theo NĐ 13 (hóa đơn, phiếu yêu cầu xuất HĐ, tin nguồn đính phiếu) và cách ẩn khỏi màn hình kinh doanh; kế toán được ghi nhận yêu cầu NĐ 13 (`privacy.intake`) | BGD #8, Q-PQ-20 |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/01-xu-ly.md) | — |
