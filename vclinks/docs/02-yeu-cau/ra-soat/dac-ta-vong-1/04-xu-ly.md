# Xử lý góp ý vòng 1 — 04 CSKH Zalo OA

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA xử lý 62 góp ý vòng 1 cho đặc tả 04 CSKH Zalo OA (P-CS 24, P-KT 20, P-GD 18) ngày 29/09/2026; đặc tả lên **v1.1**.
- Kết quả: **42 đã sửa · 8 hỏi chủ dự án · 12 chuyển file khác** (06: 10, 01: 2) · 0 không làm (một phần P-CS #17 không làm, có lý do).
- Nguyên tắc lọc: giữ mọi nguyên tắc bắt buộc; góp ý đổi nghiệp vụ, phạm vi, chi phí thì hỏi chủ dự án và ghi [Chờ chốt CH-n] trong đặc tả; hóa đơn và công nợ chuyển sang `06-hoa-don-cong-no.md`.
- Màn hình mới: MH-OA-18 SLA và giờ làm việc, MH-OA-19 Chi phí tin mẫu; quy tắc mới OA-26…OA-36 (báo giám sát, chống gửi trùng, số liệu lấy lúc gửi, báo owner…).
- 11 câu hỏi cho chủ dự án CH-1…CH-11 (lịch sử khách với sale, SLA hỏi giá, ZNS lẻ ở MVP, trần ngân sách, tin có phí, duyệt chiến dịch định kỳ, báo cáo doanh số OA, tắt trả lời trên trang OA, SLA, nhắc bảo dưỡng, người duyệt mẫu ZNS).
- 11 việc cho designer (D1–D11) và việc cho file 00, 01, 06.
- Người duyệt nên xem kỹ: CH-1 (CSKH đọc chat của sale), CH-2 (SLA hỏi giá), CH-4 (trần ngân sách có ngoại lệ ZNS giao dịch tự động).

## Mục lục

- [Bảng xử lý](#bảng-xử-lý)
- [Câu hỏi cho chủ dự án](#câu-hỏi-cho-chủ-dự-án)
- [Việc cho designer](#việc-cho-designer)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Đặc tả: `docs/02-yeu-cau/dac-ta/04-cskh-zalo-oa.md` (nay là **v1.1**) · Góp ý: `04-P-CS.md` (Lan, CSKH), `04-P-KT.md` (Hà, kế toán), `04-P-GD.md` (Thắng, giám đốc bán hàng) · BA xử lý ngày 29/09/2026 theo bước 3 của `docs/02-yeu-cau/README.md`.
>
> **Nguyên tắc lọc đã áp:** (1) Không bỏ nguyên tắc bắt buộc: không gửi khi chưa duyệt, không gửi hàng loạt qua nick cá nhân, VClinks chỉ đọc VC ERP, token mã hóa. (2) Góp ý đổi nghiệp vụ, phạm vi, giai đoạn, chi phí hoặc đụng BA §21 → **Hỏi chủ dự án** (mục CH-n ở dưới); trong đặc tả chỗ đó ghi **[Chờ chốt CH-n]** kèm cách chạy tạm. (3) Chỗ 01 / 02 đã chốt thì 04 căn theo (không tính là quyết định mới). (4) **Hóa đơn, phiếu yêu cầu xuất hóa đơn, gửi hóa đơn, số liệu công nợ** → `06-hoa-don-cong-no.md` (file mới, sẽ viết). 04 chỉ giữ **cơ chế gửi ZNS / chiến dịch** (ai nhận, giờ gửi, số liệu lấy lúc gửi, loại khách) mà 06 dùng lại.
>
> **Tổng:** 62 góp ý · **Đã sửa 42** · **Hỏi chủ dự án 8** · **Chuyển file khác 12** (06: 10, 01: 2) · Chuyển designer 0 (làm chính; 11 việc designer đi kèm các dòng Đã sửa, xem cuối file) · Không làm 0 (một phần của P-CS #17 không làm, có lý do).

## Bảng xử lý

| Nguồn | Mức | Tóm tắt góp ý | Kết quả | Chỗ sửa hoặc lý do |
|---|---|---|---|---|
| P-CS #1 | Chặn | CSKH không thấy sale đã nói / hứa gì với khách trên Zalo cá nhân, Fanpage | **Hỏi chủ dự án** (CH-1) | Đọc nội dung chat của sale đụng 01 D3 và BA §21 câu 10. Phần đã chốt thì đã sửa: MH-OA-03 #17 khối "Gần đây với khách" (5 lần liên lạc mọi kênh, dòng tóm tắt theo DK-40, không cần xin quyền tạm), #18 cảnh báo người khác vừa nhắn khách; MH-OA-04 #15 kiểm tra mâu thuẫn DK-32. Trích nội dung / "cam kết đã nêu" / ghi chú "Sale đã hứa": chờ CH-1 |
| P-CS #2 | Chặn | Hỏi giá chuyển sale không có SLA, không ai cảnh báo, khách quay lại mắng OA | **Hỏi chủ dự án** (CH-2) | SLA cho sale là nghiệp vụ mới của bên bán hàng, gắn Q-OA-06 và §21 câu 10. Đã đồng bộ phần 02 đã có: OA-11 và §2.2 bước 6 áp DK-24 (owner vắng > 15′ → CSKH tạm giữ, gửi câu tiếp nhận, không nêu giá); mẫu câu "Giữ khách chờ sale" (MH-OA-04 #5); ô SLA hỏi giá ở MH-OA-18 #5 và khối việc tồn MH-OA-17 #2a để sẵn, khóa tới khi chốt |
| P-CS #3 | Chặn | MVP đã chặn gửi Z3 nhưng tin mẫu lẻ tới GĐ2 mới có → không báo được kết quả bảo hành | **Hỏi chủ dự án** (CH-3) | Đổi giai đoạn. Đã sửa phần không phụ thuộc: §3.5 bước 5 và MH-OA-04 #13 ghi cách khác khi chưa có mẫu (SĐT + Hiện, ghi chú nội bộ, "khách nhắn lại thì khung mở"); UAT-OA-96. Chặn Z3 **giữ nguyên** (BA §2.2.4: chặn, không chỉ cảnh báo) |
| P-CS #4 | Chặn | Ô "Đơn VCsales" bắt buộc; khách chưa có SĐT / mã KH thì không tạo được ticket | **Đã sửa** | MH-OA-05 #4: thêm "Chưa xác định đơn", tìm đơn theo mã đơn / SĐT khách gõ (⚠ API VCsales, Q-OA-20), nhãn `Thiếu đơn`; MH-OA-06 bắt chọn đơn khi đóng. UAT-OA-35 (sửa kết quả), 98, 99, 107 |
| P-CS #5 | Nên sửa | "Đang được NV trả lời" chỉ tính trong OA; sale có thể đang trả lời cùng khách qua Zalo cá nhân | **Đã sửa** | MH-OA-03 #18 và MH-OA-04 #14 tính trên mọi danh tính của account (DK-27), không hiện nội dung; báo owner khi CSKH mở ticket (OA-36, DK-33). UAT-OA-87, 100 |
| P-CS #6 | Nên sửa | Một tin vừa bảo hành vừa hỏi giá, quy tắc chỉ cho một đường | **Đã sửa** | OA-11 (tin hai ý: ticket hậu mãi + `Báo sale báo giá`); hành động ở MH-OA-03 và MH-OA-06; owner được mời tham gia với quyền báo giá (DK-31), CSKH giữ ticket. UAT-OA-90 |
| P-CS #7 | Nên sửa | Khối "Bạn chỉ xem hội thoại này" không có nút | **Đã sửa** | MH-OA-04 wireframe, trạng thái "Không có quyền gửi", hành động `Tạo ticket để trả lời` (ô soạn mở ngay) và `Báo sale phụ trách`. UAT-OA-95 |
| P-CS #8 | Nên sửa | Hai đồng hồ (SLA, miễn phí) trên một dòng dễ nhầm; bộ lọc giấu trong dropdown | **Đã sửa** | MH-OA-02 #9, #10 (chữ `Hạn trả lời:` / `Nhắn miễn phí:`, hai dòng riêng, tooltip), #13 nút nhanh `Quá hạn trả lời (n)`, `Sắp hết khung miễn phí (n)`. UAT-OA-83, 84. Kèm việc designer D1 |
| P-CS #9 | Gợi ý | CSKH chỉ nhận từng dòng | **Đã sửa** | MH-OA-02 #14 + hành động: CSKH chọn nhiều ở hàng Chưa nhận, chỉ nhận cho mình. UAT-OA-82 |
| P-CS #10 | Nên sửa | Không có nút nhờ giám sát khi khách nóng tính | **Đã sửa** | OA-26; MH-OA-06 `Báo giám sát` (lý do bắt buộc, lên Khẩn); MH-OA-10 #6 hành động "Báo giám sát", quy tắc mẫu "Khiếu nại gấp" bật sẵn. UAT-OA-103, 111 |
| P-CS #11 | Nên sửa | `{han_sla}` trong tin xác nhận không rõ hạn phản hồi hay hạn xử lý, khách giữ làm lời hứa | **Đã sửa** | MH-OA-05 #10: tách `{han_phan_hoi}`, `{han_xu_ly}`; câu mặc định chỉ hứa "báo lại trong hôm nay"; sửa được trước khi gửi. UAT-OA-101 |
| P-CS #12 | Nên sửa | Người xử lý ticket vẫn bị ẩn SĐT, "Xem" chỉ 10 giây | **Chuyển file khác (01)** | Ai được "luôn hiện" là quyền (01 D6, MH-PQ-12). 04 đã căn theo 01: hiện 60 giây + `Sao chép` (MH-OA-03 #2, UAT-OA-89). Đề nghị 01 xét cho "người xử lý ticket đang mở" vào nhóm luôn hiện với khách đó, ghi nhật ký một lần / ticket |
| P-CS #13 | Nên sửa | Mạng chậm bấm Gửi hai lần; mất mạng mất chữ | **Đã sửa** | OA-32; MH-OA-04 #12 (khóa chống trùng), #16 nháp theo hội thoại (theo 00 MH-UI-08), hành động và trạng thái mất mạng. UAT-OA-91, 92, 93; story OA-US-13 |
| P-CS #14 | Nên sửa | Không có trình xem ảnh; ảnh > 1 MB chỉ báo lỗi | **Đã sửa** | MH-OA-03 #19 trình xem ảnh (phóng to, xoay, tải về); MH-OA-04 #3 tự giảm dung lượng; mẫu câu "Xin chụp lại ảnh" (#5). UAT-OA-88, 94. Kèm việc designer D2 |
| P-CS #15 | Nên sửa | Không có cách bàn giao khi nghỉ phép / hết ca | **Đã sửa** | MH-OA-07 #6 `Bàn giao` (ghi chú bắt buộc, người trong nhóm), #7; MH-OA-06 nút Bàn giao; "Vắng mặt" dùng trạng thái "Tạm vắng / Ngoại tuyến" của 00 MH-UI-05. UAT-OA-108; story OA-US-15 |
| P-CS #16 | Nên sửa | "Mở lại tự động khi cùng vấn đề" không rõ ai xác nhận; tin "ok cảm ơn" cũng mở lại | **Đã sửa** | OA-33: không tự mở lại; hộp `Mở lại` / `Tạo ticket mới` / `Không cần` (MH-OA-06 #11). UAT-OA-104 |
| P-CS #17 | Gợi ý | Chờ khách mãi thì ticket treo | **Đã sửa** (một phần) | OA-35: quá 3 ngày làm việc nhắc người xử lý "Đóng ticket?". **Không làm** phần "tự gửi tin hỏi lại": tin tự động chỉ gồm các loại ở OA-01 (BR07). UAT-OA-105 |
| P-CS #18 | Nên sửa | Chuyển sang ZNS mất chữ đang gõ; không biết chọn mẫu nào | **Đã sửa** | §3.5 bước 4 (giữ nháp, chép sang ghi chú); MH-OA-11 #9 "Dùng khi…", #10 gợi ý theo loại ticket; MH-OA-12 #3, #8. UAT-OA-112 |
| P-CS #19 | Gợi ý | "Liên hệ admin / sale admin" không biết là ai | **Đã sửa** | Câu chữ có tên người phụ trách + nút `Báo admin` / `Báo lại admin` / `Báo sale admin` và cách làm trong lúc chờ: MH-OA-02 trạng thái token, MH-OA-03 trạng thái, MH-OA-12 trạng thái, UAT-OA-09 |
| P-CS #20 | Nên sửa | Hộp thư chỉ nói OA, CSKH trực cả Fanpage; ticket nên gắn với khách | **Đã sửa** | §1.2; MH-OA-02 #12 lọc theo kênh; OA-34 ticket gắn account, gợi ý gắn tin kênh khác vào ticket đang mở (DK-30); MH-OA-05 hành động. UAT-OA-85, 102. Khung gửi riêng Fanpage: Q-OA-19 |
| P-CS #21 | Gợi ý | Tin trả lời trên app OA hiện "OA (ngoài VClinks)", không biết ai | **Đã sửa** | UAT-OA-25 câu chữ `Trả lời trên trang / app OA — không rõ người gửi`; OA-31 và MH-OA-17 #2b tách dòng. Tắt quyền trả lời trên trang OA: CH-8 |
| P-CS #22 | Gợi ý | Khách sợ lừa khi thấy "chia sẻ thông tin"; hết 2 lượt thì bí | **Đã sửa** | MH-OA-04 #8: câu giải thích gửi kèm (bật sẵn), hết lượt gợi ý xin SĐT bằng tin thường (SĐT tự gõ chỉ V1, không tự gộp). UAT-OA-97 |
| P-CS #23 | Nên sửa | CS-05 "chỉ thấy hội thoại gắn ticket" quá hẹp, cần đọc lịch sử khách | **Hỏi chủ dự án** (CH-1) | Cùng câu với P-CS #1. CS-05 (§6.1) đã ghi tiêu chí phần đã chốt (gửi theo OA-12, thấy tóm tắt 5 lần liên lạc) và phần chờ CH-1 |
| P-CS #24 | Nên sửa | UAT thiếu ca hằng ngày | **Đã sửa** | Thêm 10 / 11 ca đề xuất (UAT-OA-86, 98, 91, 92, 112, 103, 108, 104, 102, 88 + 94); ca "hỏi giá sale không trả lời" chờ CH-2 |
| P-KT #1 | Chặn | Không có màn hình phiếu yêu cầu xuất hóa đơn; 00, 01, 04 trỏ vòng | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết). 04 ghi ngoài phạm vi (§1.2), §8.3 L9 đề nghị 00 và 01 D11 trỏ sang 06 |
| P-KT #2 | Chặn | Phiếu phải đủ MST, tên pháp lý, địa chỉ, email, mã đơn…; kiểm MST, so tên lần trước | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết) |
| P-KT #3 | Nên sửa | Thông tin xuất HĐ lưu theo khách có lịch sử, đổi MST thì cảnh báo | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết); nơi lưu trên hồ sơ account phối hợp 02 |
| P-KT #4 | Nên sửa | Tên, địa chỉ chia sẻ qua OA là của người nhắn, không dùng làm thông tin xuất HĐ | **Đã sửa** | OA-27; §2.2 bước 5. 06 sẽ áp khi viết phiếu |
| P-KT #5 | Nên sửa | Loại phiếu Xuất mới / Xuất lại / Điều chỉnh, liên kết HĐ gốc | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết) |
| P-KT #6 | Chặn | Không có luồng gửi hóa đơn qua OA, thiếu mục đích mẫu "Hóa đơn", ngoài khung gửi bằng gì | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết). 04 chỉ thêm mục đích "Hóa đơn *(06)*", "Đối chiếu công nợ *(06)*" vào MH-OA-11 #5 để 06 dùng cơ chế MH-OA-12 (Z1 tin tư vấn, Z3 ZNS) |
| P-KT #7 | Nên sửa | Trạng thái gửi từng hóa đơn, nhắc khi chưa gửi > 24h | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết) |
| P-KT #8 | Nên sửa | Kế toán không mở được MH-OA-12 vì không xem chat | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết): điểm mở từ danh sách công nợ / hóa đơn / phiếu. 04 đã ghi điểm mở này ở MH-OA-12 "Route" |
| P-KT #9 | Chặn | Nhắc nợ phải tới người phụ trách thanh toán của garage, không phải thợ đang nhắn OA | **Đã sửa** | OA-15 (người nhận theo mục đích mẫu); MH-OA-12 #1 (bắt chọn khi không có người liên hệ vai trò thanh toán); MH-OA-13 #5 loại `Chưa có người nhận thanh toán`. UAT-OA-113, 114 |
| P-KT #10 | Chặn | Số tiền phải lấy lại lúc gửi (khách trả một phần sau khi duyệt) | **Đã sửa** | OA-28 (tham số VCsales lấy lại trước từng tin, báo cáo ghi `Số liệu cập nhật lúc gửi`); MH-OA-13 hành động Duyệt; MH-OA-12 hành động Gửi. UAT-OA-116 |
| P-KT #11 | Nên sửa | Không bỏ tay được khách; cần loại khách đang khiếu nại, vừa báo đã chuyển khoản | **Đã sửa** | MH-OA-13 #5 (loại ticket Khiếu nại mở; nhắc thanh toán: loại khách có hội thoại "Công nợ – hóa đơn" trong 3 ngày), #5a bỏ tay kèm lý do. UAT-OA-118, 119. Nhận biết "đã chuyển khoản nhưng VCsales chưa ghi": thêm ở 06 |
| P-KT #12 | Chặn | Khách trả lời ZNS nhắc nợ về hàng CSKH, kế toán không đọc được | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết): việc "Phản hồi nhắc nợ" kèm đúng tin + ảnh (theo mẫu PQ-23; quyền báo 01). 04 đã sửa phần định tuyến: tin trả lời ZNS nhắc thanh toán gắn loại "Công nợ – hóa đơn" → owner, CSKH tạm giữ không nói số nợ (§2.2 bước 6, DK-22) |
| P-KT #13 | Nên sửa | Chiến dịch nhắc nợ định kỳ phải chờ giám đốc duyệt mỗi tuần | **Hỏi chủ dự án** (CH-6) | Đổi cách duyệt chi phí (GD-05). Tới khi chốt: duyệt từng lần (OA-16) |
| P-KT #14 | Nên sửa | Quy tắc "đã nhận mẫu 7 ngày" loại mất nấc nhắc thứ hai | **Đã sửa** | OA-29 (chống trùng theo mẫu + đối tượng, N theo mục đích); MH-OA-13 #5. UAT-OA-120 |
| P-KT #15 | Nên sửa | Nhắc thanh toán là mẫu Giao dịch nên có thể gửi 22h | **Đã sửa** | OA-17 (ngoại lệ chỉ cho xác nhận / trạng thái đơn; áp cả gửi lẻ); MH-OA-12 hành động "Gửi ngoài giờ". UAT-OA-115 |
| P-KT #16 | Nên sửa | Chi phí chỉ ước tính; cần theo tháng, division, đối chiếu hóa đơn Zalo; kế toán không xem được | **Đã sửa** | §3.4; màn mới **MH-OA-19 Chi phí tin mẫu** (ước tính / thực / chênh lệch, theo OA, division, mục đích, loại gửi, người gửi; kế toán nhập thực, xuất Excel). UAT-OA-135…138; story OA-US-17. Quyền `cost.view`, `cost.edit_actual` báo 01 |
| P-KT #17 | Nên sửa | Báo cáo nhắc nợ cần số tiền nhắc / thu, trả đủ / một phần | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết): số liệu công nợ. MH-OA-14 #2 ghi trỏ sang 06 |
| P-KT #18 | Gợi ý | Tham số `{noi_dung_ck}` (mã KH + số đơn) trong tin nhắc nợ | **Chuyển file khác** | Chuyển 06-hoa-don-cong-no.md (file mới, sẽ viết) |
| P-KT #19 | Gợi ý | Owner sale không được báo trước khi khách nhận nhắc nợ | **Đã sửa** | OA-36 (báo owner khi chiến dịch gửi duyệt, `Xin loại`); MH-OA-13 #11, #12. UAT-OA-122 |
| P-KT #20 | Gợi ý | Khách có thể nhận hai tin nhắc nợ cùng ngày từ hai OA | **Đã sửa** | OA-29 (cảnh báo chiến dịch cùng mục đích từ OA khác trong 3 ngày; tần suất tối đa mọi OA). UAT-OA-123 |
| P-GD #1 | Chặn | Không có trần chi phí; ngân sách không bắt buộc, vượt chỉ cảnh báo; ZNS lẻ / tự động không qua ai | **Hỏi chủ dự án** (CH-4) | Quyết định chi phí. Đặc tả ghi [Chờ chốt CH-4] ở §3.4, MH-OA-01 #23, MH-OA-13 #6, MH-OA-19 #5, kèm cách chạy tạm (cảnh báo 80%) |
| P-GD #2 | Chặn | Tập khách có thể phình giữa lúc duyệt và lúc gửi | **Đã sửa** | OA-28 (chỉ bớt, không thêm; số tin ≤ số đã duyệt); MH-OA-13 hành động Duyệt; MH-OA-14 dòng "Loại lúc gửi". UAT-OA-117; story OA-US-18 |
| P-GD #3 | Chặn | Báo cáo không trả lời "OA có giúp bán hàng không", chi phí tin / đơn | **Hỏi chủ dự án** (CH-7) | Báo cáo mới, cần quy tắc gán đơn và KPI (quyết định mới của P-GD). MH-OA-17 ghi [Chờ chốt CH-7] |
| P-GD #4 | Chặn | Hỏi giá chuyển sale không có SLA, không có đường quay về | **Hỏi chủ dự án** (CH-2) | Cùng câu với P-CS #2 |
| P-GD #5 | Chặn | Không có màn hình cấu hình SLA; giờ làm việc lại do admin sửa | **Đã sửa** | Màn mới **MH-OA-18 SLA và giờ làm việc** (giám đốc sửa, admin xem, áp dụng từ lúc lưu, lịch sử); MH-OA-01 #20 chỉ đọc; OA-13; §8.3 L10 (căn theo 01 `config.sla`). UAT-OA-131…134; story OA-US-16 |
| P-GD #6 | Nên sửa | Báo cáo không có so sánh kỳ trước, không có danh sách việc tồn | **Đã sửa** | MH-OA-17 #1 nút `Tuần trước` / `Tháng trước`, #2 Δ kỳ trước, #2a "Việc tồn cuối kỳ". UAT-OA-128 |
| P-GD #7 | Nên sửa | FRT có tính tin tự động không | **Đã sửa** | OA-31 (FRT tới tin đầu tiên do người gửi, tooltip "Số này tính thế nào"); MH-OA-17 #2. UAT-OA-127 |
| P-GD #8 | Nên sửa | Chỉ có chi phí ước tính; không tách theo mục đích / người gửi | **Đã sửa** | MH-OA-19 (cùng P-KT #16) |
| P-GD #9 | Nên sửa | Công tắc tin tư vấn có phí do admin bật, không hạn mức | **Đã sửa** | MH-OA-01 #19, hành động, quyền: chỉ giám đốc bật / tắt, admin xem, ghi nhật ký. Có dùng hay không: CH-5; hạn mức: CH-4 |
| P-GD #10 | Nên sửa | Chiến dịch cho khách của sale mà sale không biết; không có trần tin chăm sóc / khách | **Đã sửa** | OA-36 (báo owner, `Xin loại`); OA-29 (tối đa 2 tin chăm sóc / account / 7 ngày mọi OA, cấu hình được); MH-OA-13 bước 2 "có owner sale: n". UAT-OA-122, 123; story OA-US-19 |
| P-GD #11 | Nên sửa | Sale chỉ biết khách khiếu nại khi CSKH bấm "Chuyển sale" | **Đã sửa** | OA-36 (tự báo owner khi mở / đóng ticket, theo DK-33); MH-OA-05 #11 và hành động; nút cũ đổi tên "Báo sale". UAT-OA-100 |
| P-GD #12 | Nên sửa | Không có người duyệt thay, không có hạn duyệt, không duyệt được trên điện thoại | **Chuyển file khác** (01) | Ủy quyền duyệt có thời hạn là quyền → 01 (mở rộng MH-PQ-07). Đã sửa trong 04: OA-30 chưa duyệt tới giờ thì không gửi (UAT-OA-121); màn duyệt dùng được trên điện thoại (MH-OA-09 hành động, MH-OA-13 #11; UAT-OA-110, 124) + việc designer D7 |
| P-GD #13 | Nên sửa | Giám đốc tự tạo chiến dịch thì ai duyệt | **Đã sửa** | Căn theo 01 PQ-27 / chú thích (21): giám đốc khác cùng division hoặc Ban giám đốc. OA-16, MH-OA-13 #9, UAT-OA-66 (sửa kết quả) |
| P-GD #14 | Nên sửa | Chatbot có thể hứa thời gian không khớp SLA; màn duyệt cần xem trước điện thoại, chạy thử | **Đã sửa** | MH-OA-09 #3 (biến `{han_phan_hoi}` từ MH-OA-18, cảnh báo cụm thời gian cố định), hành động màn duyệt. UAT-OA-109, 110 |
| P-GD #15 | Nên sửa | Trả lời trên oa.zalo.me không biết ai; đề nghị tắt quyền đó | **Đã sửa** | OA-31, MH-OA-17 #2b dòng "Trả lời ngoài VClinks", không gán nhân viên. UAT-OA-129. Chính sách tắt quyền: CH-8 |
| P-GD #16 | Gợi ý | "Chuyển đổi" không có đối chứng | **Đã sửa** | MH-OA-14 #2a đối chứng thô (nhóm không gửi được), luôn ghi "tương quan, không phải nhân quả". UAT-OA-125 |
| P-GD #17 | Gợi ý | Excel cần sheet tóm tắt, giờ chốt, nguồn, SĐT ẩn | **Đã sửa** | MH-OA-14 #2b, #5; MH-OA-17 #8; MH-OA-19 #6. UAT-OA-125, 137 |
| P-GD #18 | Gợi ý | Cần % Chưa hài lòng, % mở lại 7 ngày; không xếp hạng công khai | **Đã sửa** | MH-OA-17 #5 (thêm cột, tách "Không do CSKH"; chỉ giám sát và giám đốc thấy); MH-OA-06 #9. UAT-OA-106, 130 |

### Câu hỏi của người dùng trong góp ý

| Nguồn | Câu hỏi | Trả lời / xử lý |
|---|---|---|
| P-CS H1 | Khách có sale hỏi "đơn đâu", CSKH tự mở ticket rồi trả lời được không? | Được: "Tình trạng đơn" là Hậu mãi → CSKH (DK-22, OA-11); owner được báo tự động (OA-36). Phần hỏi giá: CH-2 |
| P-CS H2 | MVP làm trên màn nào? Hộp thư CSKH có từ MVP không? | Giai đoạn từng màn hiện chưa đủ rõ → gộp vào CH-3 (phạm vi MVP của CSKH OA) |
| P-CS H3 | SLA tính từ lúc khách nhắn hay lúc bấm nhận? | OA-13: hạn phản hồi tính từ tin khách đầu tiên chưa được trả lời. Hiệu suất cá nhân tính từ lúc nhận hay không: CH-9 |
| P-CS H4 | Hiệu suất có tính "Mở lại", "Chưa hài lòng" do lỗi hàng / sale hứa sai? | Đã sửa: cờ "Nguyên nhân không do CSKH" (MH-OA-06 #9), tách ở MH-OA-17 #5 |
| P-CS H5 | Có cho tin tư vấn có phí không, ngân sách, xin phép từng tin? | CH-5, CH-4. Nếu bật: người gửi xác nhận chi phí từng tin (OA-05), không cần xin phép riêng |
| P-CS H6 | Ai soạn mẫu "Kết quả xử lý yêu cầu", bao giờ có; Zalo từ chối thì làm sao? | Sale admin soạn, giám đốc duyệt (OA-18; người duyệt: CH-11); thời điểm: CH-3; trong lúc chờ: §3.5 bước 5 |
| P-CS H7 | Khách nhắn cả OA VCparts lẫn OA VCservice cùng vụ? | OA-34: mỗi division một ticket (DK-20), hai ticket liên kết, không gộp |
| P-KT H1 | Phiếu hóa đơn, danh sách hóa đơn ở file nào? | 06-hoa-don-cong-no.md (file mới, sẽ viết); kế toán góp ý ở vòng đặc tả của 06 |
| P-KT H2 | Công nợ đến hạn theo từng đơn hay tổng nợ? | Chuyển 06 (phụ thuộc API VCsales, BA §21 câu 8) |
| P-KT H3 | VCsales có biết "khách báo đã chuyển nhưng chưa hạch toán"? | Chuyển 06. 04 tạm loại theo hội thoại loại "Công nợ – hóa đơn" trong 3 ngày (MH-OA-13 #5) |
| P-KT H4 | Ai nạp ZBS Account, hóa đơn Zalo xuất cho pháp nhân nào? | Gộp CH-4 |
| P-KT H5 | Gửi hóa đơn bằng tin tư vấn trong khung (Z1) được không? | PQ-24 cho phép; luồng chi tiết ở 06 |
| P-KT H6 | Nháp gửi hóa đơn cho owner hiện ở đâu, biết owner gửi chưa? | Chuyển 06 (theo 01 PQ-24) |
| P-KT H7 | Tách mục đích "Đối chiếu công nợ" khỏi "Nhắc thanh toán"? | Đã thêm mục đích vào MH-OA-11 #5, luồng ở 06 |
| P-KT H8 | Kế toán xem báo cáo chiến dịch nhắc nợ do người khác tạo? | Đã sửa: MH-OA-14 quyền. UAT-OA-126 |
| P-GD QĐ1 | Ngân sách, ai nạp ZBS (Q-OA-03) | CH-4 |
| P-GD QĐ2 | Ai duyệt mẫu ZNS, ai nộp (Q-OA-04) | CH-11 |
| P-GD QĐ3 | Tin tư vấn có phí (Q-OA-05) | CH-5 |
| P-GD QĐ4 | CSKH trả lời thẳng khách của sale (Q-OA-06, §21 câu 10) | CH-2 |
| P-GD QĐ5 | Giờ làm việc, SLA (Q-OA-07, §21 câu 6) | CH-9 |
| P-GD QĐ6 | Tắt quyền trả lời trên trang OA (Q-OA-11) | CH-8 |
| P-GD QĐ7 | Đơn từ hội thoại OA tính KPI cho ai | CH-7 |
| P-GD QĐ8 | ZNS tự động có cần duyệt | CH-6 |
| P-GD QĐ9 | Chiến dịch do giám đốc tạo thì ai duyệt | Đã chốt ở 01 PQ-27, 04 đã căn theo (P-GD #13) |
| P-GD QĐ10 | Nguồn nhắc bảo dưỡng (Q-OA-09) | CH-10 |

## Câu hỏi cho chủ dự án

1. **CH-1 — CSKH đọc được gì về lịch sử khách với sale?** (P-CS #1, #23; 01 D3; BA §21 câu 10; Q-OA-13). Mỗi ngày CSKH gặp 5–10 khách mở đầu bằng "anh Nam hứa…" mà không thấy sale đã nói gì.
   - A. Giữ 01 D3: CSKH chỉ thấy dòng tóm tắt (ai, kênh, lúc nào), đọc toàn văn chỉ khi hội thoại gắn ticket của mình hoặc xin quyền tạm.
   - B. CSKH có ticket đang mở với khách được **đọc** (không gửi) toàn bộ hội thoại của account trên mọi kênh trong 30 ngày, ghi nhật ký.
   - C. Như A, thêm khối **"Cam kết đã nêu 7 ngày"** trích tự động theo DK-32 (giá, hẹn giao, đổi / trả, kèm kênh, người, giờ, một dòng trích) và ghi chú **"Sale đã hứa"** do sale ghi, ghim trên ticket và 360; toàn văn vẫn qua quyền tạm.
   - **BA đề xuất C.** CSKH có đủ thông tin để trả lời đúng mà không mở toàn bộ chat nick cá nhân. Dữ liệu cam kết đã có sẵn cho DK-32.

2. **CH-2 — Khách của sale nhắn OA hỏi giá: SLA của sale và khi nào CSKH được trả lời?** (P-CS #2, P-GD #4; Q-OA-06, Q-OA-14; BA §21 câu 10). Đây là chỗ CSKH và sale dễ đổ lỗi cho nhau nhất.
   - A. (P-GD đề xuất) CSKH trả lời thẳng hậu mãi (bảo hành, khiếu nại, tình trạng đơn). Hỏi giá thuộc sale, có **SLA 15′** trong giờ làm. Quá hạn thì báo giám sát bán hàng. Quá gấp đôi hạn thì CSKH gửi mẫu câu tiếp nhận đã duyệt (không nêu giá) và hội thoại chuyển người trực thay. Hỏi giá chờ sale có trong báo cáo.
   - B. Chỉ theo DK-24 như hiện nay (owner vắng > 15′ thì CSKH tạm giữ). Owner đang trực tuyến mà không trả lời thì không có SLA.
   - C. Mọi hỏi giá trên OA vào hàng CSKH trước. CSKH mời sale vào, không có SLA riêng cho sale.
   - **BA đề xuất A** (khớp đề xuất L6 của 02: CSKH trả lời hậu mãi, không nêu giá). Hạn: P-CS đề nghị 30′, P-GD đề nghị 15′. BA đề xuất 15′, cho giám đốc sửa ở MH-OA-18.

3. **CH-3 — Đưa gửi tin mẫu lẻ lên MVP?** (P-CS #3, H2, H6; Q-OA-15). MVP đã chặn gửi Z3, nhưng tới GĐ2 mới có ZNS lẻ. Bảo hành thường mất 5–10 ngày nên khi có kết quả thì khách đã sang Z3.
   - A. Kéo MH-OA-12 (gửi lẻ), phần đồng bộ mẫu của MH-OA-11 và 2 mẫu "Tiếp nhận yêu cầu", "Kết quả xử lý yêu cầu" lên MVP. Sale admin nộp mẫu cho Zalo ngay (Zalo duyệt khoảng 2–3 ngày ⚠). Hộp thư CSKH (MH-OA-02) và ticket (MH-OA-05…07) cũng ghi rõ là MVP.
   - B. Giữ GĐ2. Ở MVP, khi Z3 thì chỉ gọi điện và ghi chú (đã có trong đặc tả, §3.5 bước 5).
   - C. Nới chặn Z3 ở MVP. **Không nên:** trái BA §2.2.4 và có rủi ro bị Zalo từ chối hoặc tính phí.
   - **BA đề xuất A.** Chi phí phát sinh nhỏ (chỉ gửi lẻ, 2 mẫu), và bỏ được chỗ vướng lớn nhất của CSKH.

4. **CH-4 — Ngân sách tin: bắt buộc và có trần cứng không?** (P-GD #1, QĐ1; P-KT H4; Q-OA-03, Q-OA-16).
   - A. (P-GD đề xuất) Ngân sách tháng **bắt buộc** theo OA, chia theo loại (ZNS lẻ, chiến dịch, tự động, tin có phí). Tới 80% thì báo giám đốc và kế toán. Tới 100% thì **dừng** ZNS lẻ và tin có phí; chiến dịch mới chỉ duyệt được khi giám đốc nâng ngân sách (có nhật ký). Có hạn mức ZNS lẻ theo người mỗi ngày.
   - B. Ngân sách bắt buộc nhưng chỉ cảnh báo, không chặn.
   - C. Giữ như hiện nay (không bắt buộc, cảnh báo 80%).
   - **BA đề xuất A, có một ngoại lệ:** ZNS **Giao dịch tự động** (xác nhận / trạng thái đơn) không dừng ở 100%, chỉ báo giám đốc, để khách không mất tin về đơn. Cần chốt thêm: ai nạp ZBS Account, và hóa đơn VAT của Zalo xuất cho tập đoàn hay cho từng division.

5. **CH-5 — Có dùng tin tư vấn có phí (48h–7 ngày) không?** (Q-OA-05, P-GD QĐ3, P-CS H5).
   - A. Mặc định tắt. Giám đốc division bật khi đã có hạn mức tháng (CH-4). Người gửi xác nhận chi phí từng tin.
   - B. Luôn tắt, không làm Z2 có phí. Hết 48h thì dùng ZNS.
   - C. Bật sẵn cho mọi OA.
   - **BA đề xuất A.** Đặc tả đã chuyển công tắc này sang cho giám đốc.

6. **CH-6 — Chiến dịch định kỳ và ZNS tự động có được duyệt một lần không?** (P-KT #13, P-GD QĐ8; Q-OA-17).
   - A. Giám đốc duyệt **một lần** một "chiến dịch thường trực" gồm mẫu, điều kiện lọc, lịch lặp và trần số tin / chi phí mỗi tháng. Các lần sau tự chạy. Đổi điều kiện hoặc vượt trần thì dừng và phải duyệt lại. Mỗi lần chạy vẫn áp OA-28 (không thêm khách ngoài điều kiện, số liệu lấy lúc gửi).
   - B. Duyệt từng lần như hiện nay.
   - C. ZNS tự động (xác nhận đơn) không cần duyệt, chiến dịch định kỳ duyệt từng lần.
   - **BA đề xuất A.** Vẫn giữ nguyên tắc có người duyệt nội dung và chi phí, và nhắc nợ không bị chậm cả tuần khi giám đốc đi công tác.

7. **CH-7 — Có làm báo cáo "OA ra doanh số" không, và đơn tính cho ai?** (P-GD #3, QĐ7; Q-OA-18).
   - A. Làm phễu theo OA và theo tháng: hội thoại "Bán hàng" → báo giá VCsales đã gửi → đơn VCsales → doanh số, và chi phí tin chia cho số đơn. Quy tắc gán: đơn cùng mã KH trong 14 ngày sau hội thoại OA (cấu hình được). Doanh số **ghi cho owner** như VCsales; OA chỉ ghi nguồn "từ OA", không chia cho CSKH. Số liệu chỉ đọc từ VCsales, có giờ lấy.
   - B. Chỉ đếm số hỏi giá, số chuyển sale và thời gian sale trả lời, không nối với đơn.
   - C. Để GĐ3.
   - **BA đề xuất A, làm ở GĐ2.** Cần API đơn của VCsales (BA §21 câu 8).

8. **CH-8 — Có tắt quyền trả lời trên trang / app OA không?** (Q-OA-11, P-GD #15, QĐ6, P-CS #21).
   - A. Tắt. Chỉ admin giữ quyền trên oa.zalo.me để cấu hình; mọi trả lời đi qua VClinks.
   - B. Giữ quyền. Báo cáo tách riêng dòng "Trả lời ngoài VClinks" (đã có trong đặc tả).
   - **BA đề xuất A.** Nếu không tắt thì SLA, FRT và kiểm soát nội dung đều sai.

9. **CH-9 — Giờ làm việc, mức SLA và cách tính cho cá nhân** (Q-OA-07, BA §21 câu 6, P-GD QĐ5, P-CS H3).
   - A. (P-GD đề xuất) T2–T7 08:00–17:30. Phản hồi 30′, khiếu nại 15′. Xử lý bảo hành 2 ngày làm việc. Hỏi giá chuyển sale 15′. Hạn của đội tính từ tin khách; hiệu suất cá nhân tính từ lúc nhận xử lý.
   - B. Như A, nhưng hiệu suất cá nhân cũng tính từ tin khách (CSKH chịu cả thời gian chờ nhận).
   - **BA đề xuất A.** Giám đốc sửa được trên MH-OA-18.

10. **CH-10 — Có giữ "Nhắc bảo dưỡng" cho OA VCparts không?** (Q-OA-09, P-GD QĐ10).
    - A. Bỏ nhắc bảo dưỡng ở OA VCparts, ưu tiên nhắc mua lại theo chu kỳ từ VCsales (BA Q2). Nhắc bảo dưỡng chỉ giữ cho OA VCservice khi có dữ liệu VCgarage.
    - B. Giữ cả hai cho mọi OA.
    - **BA đề xuất A.**

11. **CH-11 — Ai duyệt nội dung mẫu ZNS nội bộ, ai nộp mẫu cho Zalo?** (Q-OA-04, P-GD QĐ2).
    - A. (P-GD đề xuất) Giám đốc division duyệt nội dung bán hàng. Pháp chế xem một lần các câu về dữ liệu cá nhân và pháp lý trong mẫu khung. Sale admin nộp mẫu cho Zalo. Có người duyệt thay khi vắng (theo 01).
    - B. Một người chung của tập đoàn (marketing hoặc pháp chế) duyệt mọi mẫu.
    - **BA đề xuất A.**

## Việc cho designer

| # | Màn | Việc |
|---|---|---|
| D1 | MH-OA-02 Hộp thư CSKH | Tách hai nhãn "Hạn trả lời" và "Nhắn miễn phí" thành hai dòng, dùng icon và màu khác nhau để nhìn lướt không lẫn. Thêm hàng nút nhanh `Quá hạn trả lời (n)`, `Sắp hết khung miễn phí (n)` và bộ lọc Kênh. Thêm ô chọn đầu dòng và nút `Nhận xử lý (n đã chọn)` |
| D2 | MH-OA-03 Khung chat | Panel phải có khối "Gần đây với khách" (5 dòng tóm tắt; chừa chỗ cho "Cam kết đã nêu" nếu CH-1 chọn C). Cảnh báo `Nam vừa nhắn khách này…` trên ô soạn. Trình xem ảnh có phóng to, xoay, tải về |
| D3 | MH-OA-04 Ô soạn | Khối "Bạn chỉ xem" có hai nút. Khối chặn Z3 có dòng cách khác (SĐT + Hiện, Ghi chú nội bộ). Trạng thái mất mạng / giữ nháp. Thông báo "ảnh đã được giảm dung lượng" |
| D4 | MH-OA-05 Tạo ticket | Ô Đơn có tìm theo mã đơn / SĐT và ô tích "Chưa xác định đơn". Tin xác nhận sửa được. Dòng "Owner … sẽ được thông báo". Cảnh báo ticket đang mở từ kênh khác |
| D5 | MH-OA-06 / 07 Ticket | Nút `Báo giám sát` (modal lý do), `Báo sale báo giá`, `Bàn giao` (modal chọn người nhận + ghi chú). Modal đóng có ô tích "Không do CSKH" và chọn đơn khi thiếu. Hộp "Khách nhắn lại sau khi đóng" với 3 nút. Nhãn `Thiếu đơn` |
| D6 | MH-OA-12 Gửi tin mẫu lẻ | Chọn người nhận theo vai trò (Kế toán / Thanh toán). Nhóm mẫu "Gợi ý" kèm câu "Dùng khi…". Dòng báo đã giữ nháp |
| D7 | MH-OA-13 Chiến dịch + màn duyệt | Bước 2: bảng khách có cột bỏ tích và lý do, các dòng lý do loại mới, "có owner sale: n". **Màn duyệt một cột, dùng được trên điện thoại** (375 px): ngân sách còn sau chiến dịch, kết quả lần trước, yêu cầu `Xin loại` của owner. Nút `Xin loại` cho owner (thông báo, 360) |
| D8 | MH-OA-09 / 08 / 16 màn duyệt | Khung xem trước trên điện thoại và `Chạy thử toàn luồng` trong màn duyệt của giám đốc |
| D9 | MH-OA-14, MH-OA-17 báo cáo | Dòng giờ chốt số liệu và nguồn; đối chứng thô kèm chú thích. MH-OA-17: Δ kỳ trước trên từng thẻ, tooltip "Số này tính thế nào", khối "Việc tồn cuối kỳ", các cột mới của bảng hiệu suất |
| D10 | MH-OA-18 SLA và giờ làm việc (mới) | Thiết kế theo wireframe: giờ theo thứ, ngày lễ, ma trận loại × ưu tiên (mỗi ô hai giá trị), ô hỏi giá bị khóa, lịch sử thay đổi |
| D11 | MH-OA-19 Chi phí tin mẫu (mới) | Ba thẻ ước tính / thực / chênh lệch. Bảng theo OA có ô nhập chi phí thực. Ba bảng theo mục đích, loại gửi, người gửi. Chỗ cho ngân sách (chờ CH-4) |

**Việc cho file khác (không phải designer):** 06 viết mới (P-KT #1–3, 5–8, 12, 17, 18; H1–H3, H5, H6). 01: xét cho người xử lý ticket "luôn hiện" SĐT (P-CS #12); thêm ủy quyền duyệt có thời hạn (P-GD #12); thêm quyền `cost.view`, `cost.edit_actual` cho kế toán (MH-OA-19); cho kế toán xem báo cáo chiến dịch nhắc thanh toán (MH-OA-14); D11 trỏ sang 06. 00: sửa `/invoice-requests` trỏ sang 06.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/04-xu-ly.md) | — |
