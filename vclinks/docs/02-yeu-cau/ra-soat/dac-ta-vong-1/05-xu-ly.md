# Xử lý góp ý vòng 1 — 05 Marketing, quảng cáo, chatbot

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA xử lý 62 góp ý vòng 1 cho đặc tả 05 Marketing, quảng cáo, chatbot (P-MK 24, P-KD 18, P-GD 20) ngày 29/09/2026; đặc tả lên **v1.1**.
- Kết quả: **56 đã sửa · 6 hỏi chủ dự án**; không góp ý nào "Không làm" toàn bộ (phần nhỏ không làm: MK#24, MK#12, MK#6).
- 11 góp ý Chặn: 8 đã sửa; 3 chờ chủ dự án (MK#5 và KD#1 về giai đoạn, GD#1 về định nghĩa ghi nhận đơn), đặc tả đã viết sẵn phương án đề xuất.
- Ca UAT đề xuất được ánh xạ sang mã chính thức UAT-MK-39…69; tổng 69 ca.
- 18 câu hỏi cho chủ dự án: các quyết định D-MK-1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, pháp chế (Q-MK-14), API VCsales (Q-MK-15), tổng đài, quy ước chi phí, người duyệt khi không có TMK.
- 11 việc cho designer (có màn mới MH-MK-12 trên điện thoại) và việc chuyển sang file 00, 01, 02, 03, 04, BA tổng.
- Người duyệt nên xem kỹ: D-MK-9 (quy tắc ghi nhận đơn), D-MK-12 (điện thoại ở MVP), D-MK-15 (tự tạo lead từ Zalo cá nhân).

## Mục lục

- [Tổng hợp](#tổng-hợp)
- [Sổ xử lý](#sổ-xử-lý)
- [Câu hỏi cho chủ dự án](#câu-hỏi-cho-chủ-dự-án)
- [Việc cho designer](#việc-cho-designer)
- [Việc chuyển file khác](#việc-chuyển-file-khác)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Ngày: 29/09/2026 · Người xử lý: BA · Bước 3 của quy trình `docs/02-yeu-cau/README.md`
> Đầu vào: `05-P-MK.md` (Tùng, marketing: 24 góp ý, 5 Chặn), `05-P-KD.md` (Minh, NVKD nhận lead: 18 góp ý, 3 Chặn), `05-P-GD.md` (Thắng, giám đốc bán hàng: 20 góp ý, 3 Chặn).
> Đầu ra: `docs/02-yeu-cau/dac-ta/05-marketing-quang-cao-chatbot.md` **v1.1**. Trong đặc tả, chỗ sửa có ghi `(v1.1)` và mã góp ý `[MK#n]`, `[KD#n]`, `[GD#n]`.

## Tổng hợp

| Nguồn | Tổng | Chặn | Đã sửa | Hỏi chủ dự án | Chuyển designer | Chuyển file khác | Không làm |
|---|---|---|---|---|---|---|---|
| P-MK | 24 | 5 | 22 | 2 | – | – | – |
| P-KD | 18 | 3 | 17 | 1 | – | – | – |
| P-GD | 20 | 3 | 17 | 3 | – | – | – |
| **Cộng** | **62** | **11** | **56** | **6** | – | – | – |

Ghi chú cách đếm:
- Mỗi góp ý tính **một** kết quả chính. Nhiều góp ý "Đã sửa" vẫn có phần phụ chờ chủ dự án (ghi "chờ D-MK-…") hoặc có việc phải làm tiếp ở file khác / cho designer; các việc đó liệt kê ở ba mục cuối.
- "Hỏi chủ dự án" = góp ý đổi nghiệp vụ, phạm vi hoặc giai đoạn (README: không tự sửa). Đặc tả **vẫn viết phương án đề xuất** để designer và QA làm tiếp.
- Không có góp ý nào "Không làm" toàn bộ. Phần nhỏ không làm: câu soạn sẵn trong link m.me (MK#24, chờ kiểm tra chính sách Meta), gắn chi phí theo ID chiến dịch Meta (MK#12, GĐ3 khi có API), tỷ lệ chia tay giữa hai chiến dịch OA (MK#6, số chia tay không kiểm được).
- **11 góp ý Chặn:** 8 đã sửa trong đặc tả; 3 còn chờ chủ dự án (MK#5 và KD#1 là giai đoạn, GD#1 là định nghĩa ghi nhận đơn), đều đã có phương án đề xuất viết sẵn trong đặc tả.

## Sổ xử lý

### P-MK (Tùng, marketing)

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa hoặc lý do |
|---|---|---|---|---|
| P-MK #1 | Chặn | Khách bấm quảng cáo rồi nhắn nick Zalo cá nhân sale: không có lead, quảng cáo mất công | Đã sửa | §2.3b mới (tin đầu người lạ tạo lead nguồn "Zalo cá nhân", người nhận = người giữ nick, không tự thu hồi, không gửi gì tự động); "Khách biết qua…" → độ tin cậy `Khách tự khai`, tách dòng; gộp hồ sơ → lead nhận điểm chạm quảng cáo ≤ 30 ngày làm điểm chạm đầu (§4.2, khớp DK-13); MK-21; MH-MK-08 #17; MK-US-22; UAT-MK-39, 40. Chờ D-MK-15 xác nhận bật mặc định |
| P-MK #2 | Chặn | "Thành đơn" cần mã KH; báo giá gửi ngoài VClinks không làm lead lên "Đã báo giá" | Đã sửa | §4.5: "Đã báo giá" tính QuoteShare mọi kênh **và** báo giá VCsales của mã KH tạo trong lúc lead mở (nhãn "ngoài VClinks"); §4.5.1 A7 "Chưa liên kết mã KH" + "Có thể có đơn" (tra SĐT, chỉ đọc) + "Yêu cầu liên kết mã KH" + gợi ý liên kết khi sale admin tạo mã KH mới; A8 đối chiếu lại; MH-MK-06 tab, MH-MK-07 #13; UAT-MK-41, 42 |
| P-MK #3 | Chặn | NVMK không được xuất Excel báo cáo tổng | Đã sửa | §4.6 dòng "Xuất báo cáo tổng"; MH-MK-10 #12 và Quyền: NVMK xuất được (không dữ liệu cá nhân); danh sách lead MH-MK-06 vẫn chỉ TMK, GĐBH; UAT-MK-49 |
| P-MK #4 | Chặn | Chỉ TMK nhập chi phí | Đã sửa | §5.2, MK-17, MH-MK-02 (#23–25, thao tác Khóa / Mở khóa kỳ): NVMK, TMK nhập khi kỳ chưa khóa; TMK khóa kỳ sau đối soát; mở khóa cần GĐBH có lý do; bản chụp lúc khóa; `AdSpendPeriod`, `ReportSnapshot`; UAT-MK-48. Người khóa / mở khóa chờ D-MK-10 |
| P-MK #5 | Chặn | UAT-MK-31 (MVP) cần chatbot Fanpage chào theo kịch bản, nhưng trình dựng ở GĐ2 | Hỏi chủ dự án | Đổi giai đoạn → D-MK-1. Đã sửa lệch cho nhất quán: MVP có **tin chào + ngoài giờ Fanpage theo mẫu đã duyệt (F7.1, khuôn MH-OA-08 file 04)**; "tối đa 3 nút + hỏi SĐT" là đề xuất chờ D-MK-1; UAT-MK-31 chỉ đòi tin chào; kịch bản theo chiến dịch chuyển UAT-MK-52 (GĐ2); §2.2 sơ đồ, §11 |
| P-MK #6 | Nên sửa | Hai chiến dịch OA chạy trùng, "Ước lượng" gắn cho ai | Đã sửa | §2.1, §4.2: `Ước lượng – nhiều chiến dịch`, không tự chia, không vào CPL; không làm tỷ lệ chia tay (không kiểm được); Q-MK-3 nhấn cần kiểm tra link / QR OA có tham số trước; UAT-MK-45 |
| P-MK #7 | Nên sửa | Follow OA chưa có SĐT tính là lead hợp lệ → CPL OA đẹp giả | Đã sửa | Trạng thái mới `Chờ thông tin` (§2.1, §2.4, §4.1, MK-22); lead hợp lệ = liên hệ được và không Không hợp lệ (§4.3); cột "Quan tâm" và "Chi phí / người quan tâm" (§5.2, MH-MK-10 #8); UAT-MK-51 |
| P-MK #8 | Nên sửa | Chất lượng không bắt buộc, Kém không lý do, sale đánh Không hợp lệ không báo marketing | Đã sửa | §4.3: bắt buộc chấm khi đóng lead + nhắc sau 3 ngày; lý do Kém bắt buộc; sale đánh Kém / Không hợp lệ → NVMK được báo, "Không đồng ý" trong 5 ngày làm việc → GS quyết (MK-23); MH-MK-06, 07; UAT-MK-43. Quyền phản bác chờ D-MK-3 |
| P-MK #9 | Nên sửa | Marketing không thấy sale đã làm gì sau khi giao | Đã sửa | §4.6 dòng "Tiến trình không có nội dung"; MH-MK-07 #12 (số lần liên hệ, kết quả gọi, hoạt động cuối, hẹn, giao / thu hồi; không ghi chú, không nội dung tin); MK-US-25. Cần file 01 mở rộng `lead.card`; chờ D-MK-3 |
| P-MK #10 | Nên sửa | Không thấy lead nằm im sau lần chạm đầu | Đã sửa | MH-MK-06 #1 tab "Không cập nhật > N ngày" (N = 3, cấu hình MH-MK-08 #18), GS nhận nhắc; MK-US-26; UAT-MK-50 |
| P-MK #11 | Nên sửa | Sale gọi bằng điện thoại riêng quên bấm → SLA sai | Đã sửa | §4.4 "Đã liên hệ": tin người gửi trên mọi kênh của contact (kể cả Zalo gửi từ điện thoại, đồng bộ về) + một nhắc khi lead đỏ; dashboard tách liên hệ bằng tin / ghi nhận gọi (MH-MK-10 #9). Nhật ký tổng đài: Q-MK-13 |
| P-MK #12 | Nên sửa | Gắn ad_id từng cái một | Đã sửa | §5.1; MH-MK-02 #5 (chọn nhiều trong cảnh báo), #15 (dán nhiều mã), thao tác "Gắn nhiều ad_id"; MK-US-27. Gắn theo ID chiến dịch Meta: GĐ3 khi có Marketing API |
| P-MK #13 | Nên sửa | Chặn mọi số tiền → không viết được khuyến mãi | Hỏi chủ dự án | Mâu thuẫn với P-GD (chặn hẳn, mở rộng sang %) → D-MK-7. Đặc tả viết phương án đề xuất: giá sản phẩm luôn chặn; câu khuyến mãi chung được khi nhãn Khuyến mãi + hiệu lực + GĐBH duyệt (§3.5, MH-MK-04 #6, #9b); UAT-MK-11, 47 |
| P-MK #14 | Nên sửa | Không hẹn giờ xuất bản, không tự hết hạn khuyến mãi | Đã sửa | §3.5; MH-MK-04 #9c (hiệu lực khối), #17 (hẹn xuất bản, quay về phiên bản trước), thao tác "Khối khuyến mãi hết hiệu lực"; MK-27; `BotFlowVersion`; MK-US-28; UAT-MK-46 |
| P-MK #15 | Nên sửa | Điều kiện kịch bản không có chiến dịch / ad_id / ref / UTM | Đã sửa | MH-MK-04 #9 (điều kiện nguồn), #9a (điểm bắt đầu theo nguồn); MK-US-29; UAT-MK-52 (GĐ2) |
| P-MK #16 | Nên sửa | TMK vắng thì ai duyệt, duyệt trong bao lâu | Đã sửa | MH-MK-04 Quyền: duyệt thay theo ủy quyền tạm (file 01), không có TMK → GĐBH (Q-MK-1); #18 nhắc sau 4 giờ làm việc |
| P-MK #17 | Nên sửa | Form bắt buộc họ tên + ô tích + nút | Đã sửa | §3.3, MH-MK-03 #12, MH-MK-05 #13: chỉ SĐT bắt buộc, họ tên tùy chọn. Một nút "Đồng ý và gửi": chờ pháp chế Q-MK-14a, tới đó giữ ô tích |
| P-MK #18 | Nên sửa | Không có "tuần này / tuần trước"; tỷ lệ ra đơn lead mới luôn thấp, không có nhãn | Đã sửa | MH-MK-10 #2 (Tuần này / Tuần trước), #4a (xem theo lứa lead, nhãn "Chưa đủ n ngày"), #5a (nhắc cửa sổ); UAT-MK-65. Cửa sổ tính từ lúc tạo lead (trả lời câu hỏi của P-MK; chờ D-MK-11) |
| P-MK #19 | Nên sửa | Chi phí trước hay sau thuế, đơn vị tiền; nhập file khớp ad_id | Đã sửa | §5.2 quy ước VND trước VAT, USD nhập số quy đổi + tỷ giá; file chi phí tự khớp qua ad_id; MH-MK-02 #23, #23a. Xác nhận quy ước: Q-MK-5 |
| P-MK #20 | Gợi ý | Tự nhắn riêng bình luận theo từ khóa ("giá", "ib") | Đã sửa | MH-MK-09 #10a (TMK bật, mẫu đã duyệt, một lần / bình luận, chỉ Fanpage; mặc định tắt). Nằm trong BR07 (kịch bản đã duyệt trên kênh chính thức) |
| P-MK #21 | Gợi ý | Form liên hệ có sẵn của website không vào VClinks | Đã sửa | §3.2 "Nối form có sẵn" (`VClinksChat.submitLead` / `/api/public/webchat/forms`, bắt buộc bản ghi đồng ý); MH-MK-03 #23a; GĐ2 |
| P-MK #22 | Gợi ý | Bản tin 8:00 cho NVMK | Đã sửa | MH-MK-06 #21 (không có tên, SĐT khách; tắt được) |
| P-MK #23 | Gợi ý | Bằng chứng đồng ý của Lead Ads / Zalo Ads chỉ là một ô tích chung | Đã sửa | MH-MK-01 #18a–d; `Consent` thêm nguồn, form_id, tên form, thời điểm điền; `LeadImport`; MK-US-21 (gộp với GD#15) |
| P-MK #24 | Gợi ý | m.me / QR chưa có câu mở đầu soạn sẵn | Đã sửa (một phần) | §2.2: nút "Bắt đầu" + tin chào theo `ref`; câu soạn sẵn trong link: chưa làm, Phụ lục B cần kiểm tra chính sách Meta |

### P-KD (Minh, NVKD nhận lead)

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa hoặc lý do |
|---|---|---|---|---|
| P-KD #1 | Chặn | Không có bản điện thoại; thông báo chỉ trên web | Hỏi chủ dự án | BA tổng xếp mobile web GĐ2 → D-MK-12. Đã đặc tả **phần tối thiểu** MH-MK-12 (danh sách "Cần gọi", `tel:`, hộp kết quả một chạm tự mở khi quay lại, Web Push PWA, công tắc "Đi thị trường"); MK-US-30, 31; UAT-MK-53. Nếu để GĐ2: MVP dùng SLA 30 phút "Đi thị trường" |
| P-KD #2 | Chặn | Liên hệ lead bằng nick Zalo công ty không nối vào lead, không tính Đã liên hệ / Đã báo giá | Đã sửa | §4.4 "Đã liên hệ" = tin người gửi trên mọi kênh của contact (kể cả nick Zalo, kể cả tin gửi từ điện thoại đồng bộ về); §4.5 báo giá mọi kênh; MH-MK-07 #20 "Nhắn Zalo" (nick của tôi, tìm SĐT, người tự gửi, BR14); MK-US-37; UAT-MK-54 |
| P-KD #3 | Chặn | Tự thu hồi khi đang gọi / đi thị trường; không rõ ai được tính công | Đã sửa | §4.4: "Hẹn liên hệ lúc…" (≤ 2 giờ, một lần, không thu hồi trong hạn, MK-24); SLA theo loại lead + "Đi thị trường" 30 phút; không tự thu hồi lead khách cũ / Zalo cá nhân / có hẹn / tranh chấp (MK-07); quy tắc công lead đề xuất (MK-25). MH-MK-07 #19, MH-MK-08 #9, #11a; UAT-MK-55, 58, 68. Mức SLA chờ D-MK-6; công chờ D-MK-13 |
| P-KD #4 | Nên sửa | Lead đêm cùng hạn 08:30, không ai gọi kịp | Đã sửa | §4.4 "Lead ngoài giờ": xếp hàng, chia lúc mở cửa cho người online, hạn giãn 5 phút / lead; "Gọi theo thứ tự này"; MK-06; MH-MK-08 #10; UAT-MK-15 (sửa), 56 |
| P-KD #5 | Nên sửa | Người nhận lead phải bấm "Hiện số" 30 giây | Đã sửa | §4.6 "Sale nhận lead", MH-MK-06 #9, MH-MK-07 #2: người nhận thấy đủ số, `tel:`, sao chép (khớp file 01 `cust.phone_full` CT luôn hiện); GS "Hiện" có nhật ký như file 01; UAT-MK-59 |
| P-KD #6 | Nên sửa | Chi tiết lead thiếu loại khách, khu vực, dòng xe / VIN, ảnh, câu nguyên văn, khách mới / cũ của ai | Đã sửa | MH-MK-07 wireframe, #11, #16 |
| P-KD #7 | Nên sửa | Lead không có đường liên hệ vẫn giao với SLA 5 phút | Đã sửa | §4.1 "Lead liên hệ được", `Chờ thông tin`, MK-22; MH-MK-07 #18 "Liên hệ bằng: …"; UAT-MK-51 |
| P-KD #8 | Nên sửa | Không có "Đây là khách của tôi / của đồng nghiệp" | Đã sửa | §4.4 cuối; MH-MK-07 #23 (gợi ý gộp DK-17 + yêu cầu chuyển F12.5 + cờ tranh chấp, không thu hồi); MK-US-39, 40; UAT-MK-57 |
| P-KD #9 | Nên sửa | Lead tách khỏi Inbox "Của tôi"; câu 403 nói khác | Đã sửa | §4.4 "Lead hiện ở đâu với sale" (chip Lead + SLA trong Hội thoại "Của tôi"; lead không hội thoại vào Việc cần làm); MH-MK-06 câu 403 sửa. Phần danh sách hội thoại và Việc cần làm chuyển file 00, 02 |
| P-KD #10 | Nên sửa | Ghi chú cuộc gọi, lý do tự gõ, AI tóm tắt có hiện cho marketing không | Đã sửa | §4.6: marketing chỉ thấy lý do dạng chọn sẵn; ghi chú tự do và AI tóm tắt sau giao chỉ người nhận, GS, GĐBH; `LeadCallLog`; UAT-MK-24 (sửa), 59 |
| P-KD #11 | Nên sửa | Lead rác vẫn tính vào SLA của sale | Đã sửa | §4.3: Không hợp lệ trong 24 giờ không tính SLA sale; báo cáo tách hợp lệ / tất cả; MK-26; MH-MK-10 #9; UAT-MK-60 |
| P-KD #12 | Nên sửa | Chấm chất lượng phải mở từng lead; Kém không có lý do; không có story | Đã sửa | MH-MK-06 #18a (3 nút trên dòng), §4.3 lý do Kém, nhắc chấm; MK-US-36 mới |
| P-KD #13 | Nên sửa | Khách hỏi giá, bot im; widget hứa "trả lời trong 5 phút" mọi lúc; thiếu nút Tra giá / Tạo báo giá | Đã sửa | §3.5 khối B1 nói rõ giá theo đời xe, báo trong giờ; MH-MK-03 #23b và MH-MK-05 #9: câu hứa chỉ hiện khi trong giờ, có người online, trung vị 7 ngày ≤ n (gộp GD#14); MH-MK-07 #21 Tra giá / Tạo báo giá |
| P-KD #14 | Nên sửa | Không biết khách web còn online | Đã sửa | MH-MK-07 #17 (online / đã rời, đổi nút chính, cảnh báo khi gõ); UAT-MK-61 |
| P-KD #15 | Nên sửa | Không nhắc được sale admin liên kết mã KH | Đã sửa | §4.5.1 A7, A8; MH-MK-07 #13 và thao tác "Yêu cầu liên kết mã KH" → hàng "Chờ liên kết mã KH"; UAT-MK-41 |
| P-KD #16 | Gợi ý | Tự nhắc gọi lại, gợi ý Thất bại sau 3 lần, tự chuyển Đang tư vấn | Đã sửa | §2.4 "Tự chuyển trạng thái"; MH-MK-07 #7 |
| P-KD #17 | Gợi ý | Chia theo tải phạt người chăm lead kỹ | Đã sửa | §4.4 bước 4; MH-MK-08 #7 (mặc định chỉ đếm Đã giao + Đã liên hệ, GĐBH đổi được) |
| P-KD #18 | Gợi ý | 20–30 thông báo có âm thanh mỗi ngày | Đã sửa | MH-MK-06 #20 (âm thanh chỉ lead của mình; gộp khi ≥ 3 lead / 5 phút) |

### P-GD (Thắng, giám đốc bán hàng)

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa hoặc lý do |
|---|---|---|---|---|
| P-GD #1 | Chặn | "Thành đơn" tính mọi đơn của mã KH trong 60 ngày → chi phí / đơn đẹp giả | Hỏi chủ dự án | Định nghĩa đo lường đổi nghiệp vụ → D-MK-9. Đặc tả đã viết phương án đề xuất đầy đủ: §4.1 loại lead khách mới / cũ; §4.5.1 A1–A10 (đơn gắn báo giá của lead; khách mới thêm đơn đầu tiên; khách cũ chỉ đơn gắn báo giá; cửa sổ 60 ngày; một đơn một lead; công theo điểm chạm đầu, khớp DK-13); MK-16; MH-MK-10 #4c; `LeadOrder`; UAT-MK-62 |
| P-GD #2 | Chặn | Không đối chiếu được từng đơn với VCsales | Đã sửa | MH-MK-06 #18 (cột file xuất), #18b (cột Báo giá · Đơn); MH-MK-07 #13; MH-MK-10 #8a (tỷ trọng doanh số division); MK-28; UAT-MK-29 (ghi rõ so theo mã đơn với báo cáo danh sách đơn VCsales), UAT-MK-63. API cần có: Q-MK-15 |
| P-GD #3 | Chặn | Chưa có bảng đối chất marketing ↔ sale theo tổ / NV / chiến dịch | Đã sửa | MH-MK-10 #9 khối "Xử lý lead" (lead nhận, % trong SLA theo khúc, số lần liên hệ trước Thất bại, % Kém, tranh chấp, bị thu hồi, lead → BG → đơn, giá trị, tin / gọi); quyền xem tên NV; MK-US-41; UAT-MK-69 |
| P-GD #4 | Nên sửa | Chất lượng do sale chấm một mình, marketing không phản bác; "Không liên lạc được" dễ dãi | Đã sửa | §4.3 (lý do Kém, "Không đồng ý" → GS, đếm tranh chấp); §2.4 và MH-MK-07 #4 (≥ 3 lần, ≥ 2 thời điểm cách ≥ 2 giờ); UAT-MK-44. Phản bác chờ D-MK-3 |
| P-GD #5 | Nên sửa | Ghi nhận cuộc gọi tự khai; tin tự động có dừng đồng hồ không | Đã sửa | §4.4 "Đã liên hệ": tin bot / tự động không tính; dashboard tách tin / gọi; MK-05; UAT-MK-64. Tổng đài: Q-MK-13 |
| P-GD #6 | Nên sửa | Ai chịu SLA từng khúc; công khi thu hồi | Đã sửa | §4.4 "Khúc SLA theo người chịu" (`LeadSlaSegment`), MK-26; công lead đề xuất (MK-25, chờ D-MK-13); UAT-MK-58 |
| P-GD #7 | Nên sửa | Chi phí sửa bất cứ lúc nào, không rõ VAT, không đối soát | Đã sửa | §5.2 (trước VAT, khóa kỳ, mở khóa có lý do, "đã khóa đến", đính kèm hóa đơn, bản chụp lúc khóa); MH-MK-02 #22–25; MH-MK-10 #4b; UAT-MK-48. Ai khóa / mở: D-MK-10 |
| P-GD #8 | Nên sửa | Giữa tháng không đọc được "có ra đơn không" | Đã sửa | MH-MK-10 #4a xem theo lứa lead 7 / 30 / 60 ngày, nhãn "Chưa đủ thời gian"; UAT-MK-65 |
| P-GD #9 | Nên sửa | Thiếu ngân sách vs đã chi, mục tiêu vs thực tế | Đã sửa | MH-MK-02 #4 (cột, tô màu), MH-MK-10 #8 |
| P-GD #10 | Nên sửa | Không có cảnh báo tỷ lệ "Không rõ" / "Ước lượng"; sale tạo lead phải hỏi nguồn | Đã sửa | §4.2 thẻ "% nguồn Chính xác" (đỏ < 70%), dòng con không vào CPL chính; §2.3b bắt buộc "Khách biết qua…" khi tạo lead tay / hotline; MH-MK-10 #5; UAT-MK-67 |
| P-GD #11 | Nên sửa | Khách nhắn Zalo cá nhân sale / gọi hotline không vào Hộp thư lead | Đã sửa | §2.3b (sale "Tạo lead" từ hội thoại Zalo cá nhân, nguồn "Khách tự khai"; Hotline nhập tay); MH-MK-07 #22; UAT-MK-40 |
| P-GD #12 | Nên sửa | CPL tính cả lead chưa có SĐT | Đã sửa | §4.1 lead liên hệ được; §4.3 lead hợp lệ; §5.2 "Chi phí / lead liên hệ được"; MH-MK-10 #8 cột Quan tâm (gộp MK#7) |
| P-GD #13 | Nên sửa | Nội dung chính sách / khuyến mãi chỉ TMK duyệt; bộ lọc chỉ bắt số tiền | Hỏi chủ dự án | Ai duyệt → D-MK-8 (đề xuất BA: GĐBH duyệt khối nhãn Chính sách / Khuyến mãi, khớp OA-18 file 04). Phần không cần chốt đã sửa: bộ lọc mở rộng (%, giảm, miễn phí, tặng, cam kết, giao trong), khuyến mãi bắt buộc hạn, người duyệt chịu trách nhiệm (§3.5, MK-10, MH-MK-04 #6, #9b, #9c, thao tác duyệt 2 bước); UAT-MK-47 |
| P-GD #14 | Nên sửa | Widget hứa "trả lời trong 5 phút" khi chưa có người trực | Đã sửa | MH-MK-03 #23b, MH-MK-05 #9 (chỉ hiện khi trung vị 7 ngày ≤ n và có người online); Q-MK-9 ghi "phải chốt trước GĐ2" |
| P-GD #15 | Nên sửa | Một ô tích đồng ý cho cả file nhập là bằng chứng yếu | Đã sửa | MH-MK-01 #18a–d (loại bằng chứng, người chịu trách nhiệm, mẫu phiếu), `LeadImport`, `Consent.import_id`; pháp chế rà: Q-MK-14d |
| P-GD #16 | Nên sửa | SĐT từ bình luận công khai thành lead và nhắn riêng khi chưa có đồng ý | Đã sửa | §2.2, MK-13, MH-MK-09 #10b (tin nhắn riêng đầu luôn kèm thông báo + link chính sách; lead ghi "Đồng ý: chưa có (nguồn công khai)"); pháp chế: Q-MK-14b |
| P-GD #17 | Nên sửa | Trung vị che lead bị bỏ quên; MK-G1 không có trên dashboard | Đã sửa | MH-MK-10 #5 thẻ "Chưa liên hệ > 24h" (đỏ khi > 0) và "Liên hệ trong SLA" |
| P-GD #18 | Nên sửa | Chi phí nhập ở MVP nhưng CPL ở GĐ2 | Hỏi chủ dự án | Đổi giai đoạn GD-04 → D-MK-14. Đặc tả ghi phạm vi bản rút gọn đề xuất (MH-MK-10 "Giai đoạn", §11, MK-US-16, 41, GD-04) |
| P-GD #19 | Gợi ý | Quy tắc giao lead không cho thấy kết quả chia | Đã sửa | MH-MK-08 #20 tab "Kết quả chia 30 ngày" |
| P-GD #20 | Gợi ý | Thiếu giá trị báo giá đang mở theo chiến dịch | Đã sửa | MH-MK-10 #8 cột "Báo giá đang mở (số · giá trị)", GĐ2, đọc VCsales |

### Quyết định D-MK và câu hỏi người góp ý đã nêu

| Nguồn | Nội dung | Kết quả |
|---|---|---|
| P-MK, P-GD | Ý kiến về D-MK-1, 2, 3, 6, 7, 8 và đề xuất D-MK-9, 10, 11 | Không tự chốt. Gộp vào §12.1 đặc tả (cột "Ý kiến vòng 1") và câu hỏi 1–15 dưới đây |
| P-MK câu hỏi | Tin người lạ vào Zalo sale có tạo lead? NVMK nhập chi phí? Ai duyệt khi không có TMK? Cửa sổ 60 ngày tính từ đâu? | Có (§2.3b, chờ D-MK-15); có (MK-17, chờ D-MK-10); GĐBH (Q-MK-1); từ lúc tạo lead (§4.5.1 A1, chờ D-MK-11) |
| P-KD câu 1 | Công đơn cho ai; có vào KPI VCsales? | Đề xuất MK-25; KPI / thưởng: D-MK-13; VClinks không ghi VCsales (BR12) |
| P-KD câu 2 | Đồng nghiệp trả lời thay khi owner offline có được công? | Không; khách và lead vẫn của owner (§4.4 "Công lead", DK-24, BR09) |
| P-KD câu 3 | Trả lời lead lúc 21h có tính không, có bị ép trả lời đêm? | Tính "Đã liên hệ", thời gian 0 giờ làm việc; không bắt buộc, SLA không tính khúc ngoài giờ (§4.4) |
| P-KD câu 4 | "Online" khi đi thị trường tính thế nào? | Trạng thái "Đi thị trường" NV tự bật hoặc theo ca (§4.4, MH-MK-12 #7); chờ D-MK-6 |
| P-KD câu 5 | Sale có được đánh "Không hợp lệ – Đối thủ"? Marketing khôi phục? | Có; marketing "Không đồng ý" → GS quyết (§4.3) |
| P-KD câu 6 | SĐT bị che trong chat web có được gọi? | Không; số che không ai xem đầy đủ (§3.3) |
| P-KD câu 7 | Kết bạn Zalo với lead chưa có ô đồng ý có vi phạm? | Hỏi pháp chế: Q-MK-14c |
| P-KD câu 8 | GS có thấy lead quá SLA trong họp sáng? Có trừ điểm? | Có: tab Quá SLA, khối Xử lý lead. Trừ điểm là chính sách nhân sự, ngoài phạm vi VClinks |

### Ánh xạ UAT đề xuất → mã chính thức

| Mã đề xuất | Mã chính thức | | Mã đề xuất | Mã chính thức |
|---|---|---|---|---|
| MK UAT-39 | UAT-MK-39 | | KD UAT-01 | UAT-MK-53 |
| MK UAT-40, GD UAT-46 | UAT-MK-40 | | KD UAT-02 | UAT-MK-54 |
| MK UAT-41, KD UAT-11 | UAT-MK-41 | | KD UAT-03 | UAT-MK-55 |
| MK UAT-42 | UAT-MK-42 | | KD UAT-04 | UAT-MK-56 |
| MK UAT-43 | UAT-MK-43 | | KD UAT-05 | UAT-MK-57 |
| GD UAT-42 | UAT-MK-44 | | KD UAT-06, GD UAT-43 | UAT-MK-58 |
| MK UAT-44 | UAT-MK-45 | | KD UAT-08 | UAT-MK-59 |
| MK UAT-45 | UAT-MK-46 | | KD UAT-09 | UAT-MK-60 |
| MK UAT-46, GD UAT-47 | UAT-MK-47 | | KD UAT-10 | UAT-MK-61 |
| MK UAT-47, GD UAT-41 | UAT-MK-48 | | GD UAT-39 | UAT-MK-62 |
| MK UAT-48 | UAT-MK-49 | | GD UAT-40 | UAT-MK-63 |
| MK UAT-49 | UAT-MK-50 | | GD UAT-44 | UAT-MK-64 |
| MK UAT-50, KD UAT-07 | UAT-MK-51 | | GD UAT-45 | UAT-MK-65 |
| MK UAT-51 | UAT-MK-52 | | GD UAT-48 | UAT-MK-66 |
| (BA) không thu hồi khách cũ / Zalo cá nhân | UAT-MK-68 | | GD UAT-49 | UAT-MK-67 |
| (BA) bảng Xử lý lead, GD#3 | UAT-MK-69 | | | |

Ca v1.0 đã sửa kết quả mong đợi: UAT-MK-06, 11, 15, 20, 21, 23, 24, 29, 31. Tổng: 69 ca.

## Câu hỏi cho chủ dự án

Mỗi câu có phương án và đề xuất BA. Đề xuất đã viết sẵn trong đặc tả v1.1 để designer làm tiếp; chủ dự án chọn khác thì BA sửa lại.

1. **D-MK-9 · Quy tắc ghi nhận đơn cho quảng cáo** (GD#1 Chặn, MK#2)
   - A. Mọi đơn của mã KH trong 60 ngày (v1.0). Đơn giản, nhưng garage cũ mua định kỳ làm chi phí / đơn đẹp giả.
   - B. Chỉ đơn gắn báo giá của lead. Chặt nhất, nhưng phụ thuộc VCsales có liên kết đơn ↔ báo giá; khách mới đặt thẳng không qua báo giá sẽ bị bỏ sót.
   - C. **Đơn gắn báo giá của lead (mọi đơn) + khách mới thêm đơn đầu tiên trong cửa sổ; khách cũ chỉ đơn gắn báo giá; một đơn một lead; tách khách mới / cũ trên dashboard; công cho chiến dịch = điểm chạm đầu của lead (khớp DK-13).**
   - **Đề xuất: C** (§4.5.1). Cần VCsales trả mã báo giá trên đơn (câu 15).
2. **D-MK-11 · Cửa sổ ghi nhận đơn** (GD D-MK-11, MK câu hỏi, Q-MK-7)
   - A. 60 ngày từ lúc tạo lead. B. 60 ngày từ lúc báo giá. C. Theo division.
   - **Đề xuất: 60 ngày từ lúc tạo lead, cấu hình theo division (VCedu 90 ngày), kèm xem lứa lead 7 / 30 / 60 ngày.**
3. **D-MK-15 · Tin đầu của người lạ vào nick Zalo cá nhân của sale tự tạo lead** (MK#1 Chặn, GD#11)
   - A. Không; sale tự bấm "Tạo lead". B. **Có, tự tạo; sale gắn "Khách biết qua…"; gộp hồ sơ thì nhận lại điểm chạm quảng cáo; bật / tắt theo division.**
   - **Đề xuất: B**, mặc định bật. Không gửi gì tự động qua nick (BR14); marketing chỉ thấy thẻ lead.
4. **D-MK-1 · Giai đoạn chatbot web và phần chào Fanpage ở MVP** (MK#5 Chặn)
   - A. Widget + kịch bản GĐ2 (v1.0). B. GĐ3 như BA tổng. C. **GĐ2 có điều kiện** (Hộp thư lead chạy ổn ≥ 1 tháng, có số lượt truy cập, đã chốt người trực; thiếu thì chỉ form + đồng ý).
   - Phần Fanpage MVP: (i) chỉ tin chào + ngoài giờ theo mẫu (F7.1, như OA ở file 04); (ii) **(i) + tối đa 3 nút trả lời nhanh + hỏi SĐT dạng cấu hình, không trình dựng**.
   - **Đề xuất: C cho widget; (ii) cho Fanpage MVP.**
5. **D-MK-12 · Điện thoại cho sale nhận lead ở MVP hay GĐ2** (KD#1 Chặn)
   - A. GĐ2 như BA tổng; MVP dùng trạng thái "Đi thị trường" SLA 30 phút. B. **MH-MK-12 tối thiểu ở MVP** (danh sách "Cần gọi", `tel:`, hộp kết quả một chạm, Web Push, công tắc "Đi thị trường"); mobile còn lại GĐ2.
   - **Đề xuất: B.** Rủi ro: Web Push trên iPhone cần cài web lên màn hình chính (iOS 16.4+).
6. **D-MK-6 · SLA liên hệ lead** (KD#3 Chặn, GD D-MK-6)
   - A. 5 phút mọi lead (v1.0). B. **Theo loại: 5 phút khách đang chat, 15 phút lead chỉ có SĐT, 30 phút khi người nhận "Đi thị trường"; hẹn liên hệ ≤ 2 giờ, một lần; không tự thu hồi khách cũ, lead Zalo cá nhân, lead có hẹn, lead tranh chấp; lead đêm chia lúc mở cửa, giãn 5 phút / lead.**
   - "Đi thị trường" do NV tự bật hay theo ca F4.4? **Đề xuất: cả hai, có nhật ký.**
   - **Đề xuất: B.**
7. **D-MK-13 · Công lead khi lead đổi người; có dùng cho KPI / thưởng** (KD#3, GD#6)
   - A. Người gọi đầu tiên. B. Người giữ lead cuối. C. **Người giữ lead lúc có báo giá đầu tiên (không có báo giá: lúc có đơn); GS điều chỉnh một lần có lý do.**
   - KPI / thưởng: số này chỉ nằm trong VClinks, không ghi VCsales. Công ty có dùng số này cho KPI không?
   - **Đề xuất: C; dùng làm số tham khảo cho họp tổ, chưa gắn thưởng cho tới khi chạy thật một quý.**
8. **D-MK-3 · Quyền marketing với lead sau khi giao** (MK#8, MK#9, GD#4)
   - Cả ba vai trò đồng ý: ẩn SĐT, không đọc tin sale, không đổi trạng thái; **cộng** tiến trình không nội dung, lý do dạng chọn sẵn, quyền "Không đồng ý" với Kém / Không hợp lệ (GS quyết).
   - Còn lệch: marketing có xem hội thoại **trước khi giao** (bot, form, bình luận) không? File 01 PQ-20: không. 05 v1.0: có.
   - TMK xem hội thoại lead đang tranh chấp? A. Không. B. **Có, khi GS đồng ý, quyền tạm thời 24 giờ, có nhật ký.**
   - **Đề xuất: bảng §4.6 v1.1; marketing xem phần trước khi giao (sửa file 01 PQ-20); B cho tranh chấp.**
9. **D-MK-10 · Nhập và khóa chi phí quảng cáo** (MK#4 Chặn, GD#7)
   - A. Chỉ TMK nhập (v1.0). B. NVMK nhập, TMK khóa kỳ. C. NVMK nhập, TMK đề nghị khóa, GĐBH xác nhận.
   - **Đề xuất: B + mở khóa cần GĐBH duyệt có lý do**; VND trước VAT; bản chụp báo cáo lúc khóa để số đã báo BGĐ không đổi.
10. **D-MK-14 · Kéo bản rút gọn Dashboard lên MVP** (GD#18)
    - A. Giữ GĐ2 (MVP chỉ bảng lead → báo giá). B. **MVP: bảng theo chiến dịch (lead, hợp lệ, chi phí, CPL, báo giá, đơn, chi phí / đơn, tách khách mới / cũ) + khối Xử lý lead dạng bảng + xuất Excel; biểu đồ, lứa lead, bản chụp để GĐ2.**
    - **Đề xuất: B.** Không có B thì D-MK-10 (nhập chi phí ở MVP) chưa dùng được.
11. **D-MK-7 · Số tiền và khuyến mãi trong kịch bản chatbot** (MK#13, GD#13)
    - A. Chặn hẳn mọi số tiền, %, chữ khuyến mãi (P-GD). B. Chỉ cảnh báo. C. **Giá sản phẩm / tồn / chiết khấu riêng luôn chặn; câu khuyến mãi chung được khi khối có nhãn Khuyến mãi + hiệu lực bắt buộc + GĐBH duyệt.**
    - **Đề xuất: C.** Bộ lọc mở rộng như P-GD.
12. **D-MK-8 · Ai duyệt kịch bản có nội dung chính sách / khuyến mãi** (GD#13)
    - A. TMK (v1.0). B. **TMK duyệt kịch bản; khối nhãn Chính sách / Khuyến mãi GĐBH duyệt thêm; người duyệt phiên bản chịu trách nhiệm nội dung; duyệt thay theo ủy quyền tạm khi vắng.**
    - **Đề xuất: B** (khớp OA-18 file 04: giám đốc division duyệt nội dung chatbot OA).
13. **D-MK-2 · AI trên website trả lời tự động hay chỉ gợi ý**
    - Cả ba vai trò: A + C. P-GD: chưa bật B cho tới khi có ≥ 3 tháng dữ liệu, chủ dự án + GĐBH ký; P-MK: B nếu có thì ngoài giờ trước.
    - **Đề xuất: A + C; B sớm nhất GĐ3 với các điều kiện trên, chủ đề đầu: giờ mở cửa, địa chỉ, cách đặt hàng.**
14. **Pháp chế (Q-MK-14)** (MK#17, GD#15, GD#16, KD câu 7)
    - (a) Một nút "Đồng ý và gửi" có câu đồng ý trên nút có thay được ô tích? (b) SĐT tự để công khai trong bình luận có xử lý thành lead được với thông báo trong tin nhắn riêng đầu? (c) Sale kết bạn Zalo / gọi lead Fanpage, OA chưa có ô đồng ý: có vi phạm, ai chịu? (d) Rà câu chữ đồng ý trước MVP.
    - **Đề xuất: giữ ô tích tới khi pháp chế trả lời; (b), (c) giữ thông báo + link chính sách ở tin đầu tiên.**
15. **VCsales API cho đối chiếu (Q-MK-15, bổ sung câu 13 BA tổng)** (GD#2, MK#2)
    - Cần: danh sách báo giá theo mã KH; đơn kèm mã báo giá lập ra đơn; tìm mã KH theo SĐT; doanh số division theo kỳ; tên báo cáo danh sách đơn để sale admin đối chiếu (UAT-MK-29).
    - **Đề xuất:** nếu chưa có liên kết đơn ↔ báo giá thì D-MK-9 tạm chạy quy tắc "khách mới: đơn đầu tiên; khách cũ: không tính" và ghi rõ trên dashboard.
16. **Tổng đài / nhật ký cuộc gọi (Q-MK-13)** (MK#11, GD#5): công ty có tổng đài hoặc VCdms ghi cuộc gọi không? **Đề xuất:** nếu có, đọc về làm bằng chứng "Đã liên hệ" ở GĐ3; trước đó tách "liên hệ bằng tin / bằng ghi nhận gọi" trên dashboard.
17. **Quy ước chi phí (Q-MK-5)** (MK#19, GD#7): xác nhận VND, trước VAT; tài khoản USD nhập số quy đổi + tỷ giá. **Đề xuất: đồng ý quy ước này.**
18. **Người duyệt khi division không có trưởng marketing (Q-MK-1)** (MK#16): **Đề xuất: GĐBH duyệt thay.**

## Việc cho designer

Thiết kế theo đặc tả v1.1. Các thay đổi giao diện:

1. **MH-MK-06 Hộp thư lead:** tab mới (Không cập nhật > N ngày, Chờ thông tin, Tranh chấp, Chưa liên kết mã KH có dòng con "Có thể có đơn"); cột Chất lượng 3 nút trên dòng + Popover lý do Kém; cột "Báo giá · Đơn (VCsales)" ẩn / hiện; SLA hiện "(tin) / (gọi)", "hẹn HH:mm"; NVMK giao cho **tổ**; thông báo gộp; bản tin 08:00.
2. **MH-MK-07 Chi tiết lead:** dòng khách mới / cũ của ai; badge khách web online / đã rời; "Liên hệ bằng"; hàng nút mới (Hẹn liên hệ, Nhắn Zalo, Tra giá, Tạo báo giá, Khách biết qua…, Đây là khách của…, Không đồng ý); khối Nhu cầu đủ trường + ảnh; khối Tiến trình có dòng tổng; khối Báo giá & đơn có mã KH, "Yêu cầu liên kết mã KH", mã đơn, cửa sổ còn n ngày; góc nhìn NVMK (ẩn ghi chú, không nút Hiện).
3. **MH-MK-12 mới (điện thoại):** danh sách "Cần gọi / Hẹn / Tất cả", nút Gọi, Drawer "Kết quả cuộc gọi" 4 nút lớn, công tắc "Đi thị trường", trạng thái mất mạng, nhắc bật thông báo; theo MH-UI-11 (vùng bấm 44 px).
4. **MH-MK-10 Dashboard:** 8 thẻ (thêm Liên hệ trong SLA, Chưa liên hệ > 24h, % nguồn Chính xác); nhanh Tuần này / Tuần trước; Segmented "Theo kỳ / Theo lứa lead", "Hiện tại / Bản chụp lúc khóa", "Loại khách"; bảng chiến dịch có Ngân sách, Đã chi %, Lead / Mục tiêu, Quan tâm, Báo giá đang mở, dòng con; khối **Xử lý lead** (nhóm theo Tổ / NV / Chiến dịch); dòng tỷ trọng doanh số; bản rút gọn MVP (nếu D-MK-14).
5. **MH-MK-02 Chiến dịch:** Modal dán nhiều ad_id; chọn nhiều trong cảnh báo; tab Chi phí có "Đã khóa đến", Khóa kỳ / Mở khóa kỳ, tiền tệ + tỷ giá, dòng chữ "VND, trước VAT"; cột Lead / Mục tiêu, Chi phí / Ngân sách.
6. **MH-MK-04 Trình dựng:** nhãn khối Chính sách / Khuyến mãi; hiệu lực khối; điều kiện theo nguồn và bảng "Điểm bắt đầu theo nguồn"; Modal duyệt có hẹn xuất bản; trạng thái "Chờ GĐBH duyệt" và màn duyệt của GĐBH (chỉ khối có nhãn).
7. **MH-MK-08 Quy tắc giao lead:** 3 ô SLA theo loại lead; ngoài giờ + giãn mỗi lead; hẹn tối đa; tab "Cài đặt division" (tạo lead từ nick cá nhân, N ngày không cập nhật, cửa sổ ghi nhận, cách tính tải); tab "Kết quả chia 30 ngày".
8. **MH-MK-01:** Modal nhập file thêm bằng chứng đồng ý, người chịu trách nhiệm, upload mẫu phiếu.
9. **MH-MK-03 / MH-MK-05:** Họ tên tùy chọn; câu "Thường trả lời trong …" có điều kiện; mục "Nối form có sẵn"; lời cảm ơn trong / ngoài giờ.
10. **MH-MK-09:** cấu hình "Tự nhắn riêng theo từ khóa"; dòng thông báo dữ liệu không gỡ được trong mẫu nhắn riêng.
11. **Panel phải khung chat Zalo cá nhân** (phối hợp file 03): khối "Lead đang mở" có "Khách biết qua…", "Không phải lead", đồng hồ SLA.

## Việc chuyển file khác

| File | Việc | Nguồn góp ý |
|---|---|---|
| **00** giao diện chung | (1) Thêm menu **"Hộp thư lead" `/leads`** vào nhóm MARKETING (00 §2.1, §2.2 chưa có); ghi route MH-MK theo 05 v1.1: `/ads/sources`, `/ads/campaigns`, `/chatbot/...`, `/leads`, `/leads/:id`, `/leads/rules`, `/comments`, `/reports/marketing`, `/content/vcwiki` (mục NỘI DUNG mới). (2) Làm rõ `/campaigns` là chiến dịch **gửi tin**, khác chiến dịch marketing gắn nguồn. (3) Danh sách hội thoại: chip `Lead` + đồng hồ SLA lead, xếp quá SLA lên đầu trong "Của tôi". (4) MH-UI-11: thêm tab "Lead" ở thanh tab dưới, Web Push (PWA), công tắc "Đi thị trường" ở header. (5) Thông báo: gộp nhiều lead, âm thanh chỉ việc của mình, bản tin sáng | KD#1, KD#9, KD#18, MK#22 |
| **01** phân quyền | (1) Mở rộng `lead.card` (PQ-20): tiến trình không nội dung, lý do dạng chọn sẵn, mã báo giá / mã đơn, ngày đơn; ghi chú tự do chỉ người nhận, GS, GĐBH. (2) Quyết D-MK-3: marketing xem hội thoại **trước khi giao** (sửa PQ-20) và TMK xem hội thoại lead tranh chấp bằng quyền tạm thời 24 giờ có GS đồng ý. (3) Quyền mới: `lead.dispute` (NVMK, TMK "Không đồng ý"; GS quyết), `ads.spend` (NVMK, TMK nhập), `ads.spend_lock` (TMK), `ads.spend_unlock` (GĐBH), `report.export` báo cáo tổng cho MK. (4) Duyệt thay kịch bản khi TMK vắng (quyền tạm thời); bước duyệt GĐBH cho khối chính sách / khuyến mãi. (5) Xác nhận "Marketing giao thẳng NVKD" (PQ-22) là cờ GĐBH bật | MK#3, MK#4, MK#8, MK#9, MK#16, KD#10, GD#4, GD#7 |
| **02** khách đa kênh | (1) Đổi mã kênh `web_chat` → **`webchat`** (theo 00; 05 v1.1 đã đổi). (2) Khi gộp hồ sơ: gọi xét lại **điểm chạm đầu của lead** đang mở (≤ 30 ngày trước lead), phân biệt với "Nguồn khách" DK-13. (3) "Đây là khách của tôi / của {đồng nghiệp}" từ lead → gợi ý gộp (DK-17) + yêu cầu chuyển (F12.5), cờ tranh chấp. (4) Hàng "Chờ liên kết mã KH" nhận "Yêu cầu liên kết mã KH" từ lead; gợi ý liên kết lead mở khi sale admin tạo mã KH mới trùng SĐT. (5) "Việc cần làm" có loại việc "Liên hệ lead" cho lead không có hội thoại | MK#1, MK#2, KD#8, KD#9, KD#15 |
| **03** sale Zalo cá nhân | (1) Tin đầu của người lạ tới nick tạo lead (MK-21), người nhận = người giữ nick, không tự thu hồi. (2) Panel phải: khối "Lead đang mở" với "Khách biết qua…", "Không phải lead", "Tạo lead" trên hội thoại có sẵn. (3) Luồng "Nhắn Zalo" từ Chi tiết lead: chọn nick của tôi, tìm SĐT, gửi lời mời kết bạn, mở hội thoại; người tự gửi (BR14). (4) Tin sale gửi từ điện thoại (đồng bộ về) tính "Đã liên hệ" | MK#1, KD#2, GD#11 |
| **04** CSKH Zalo OA | (1) Tin chào / ngoài giờ Fanpage MVP dùng khuôn MH-OA-08 (nếu chốt D-MK-1). (2) Đồng bộ quy tắc duyệt nội dung chính sách / khuyến mãi của chatbot (OA-18 ↔ D-MK-8). (3) Follow OA không tin, không SĐT → lead `Chờ thông tin` | MK#5, MK#7, GD#13 |
| **BA tổng** `vclinks-ba.md` | Khi chủ dự án chốt: D-MK-1 (§19: chatbot web GĐ2, tin chào Fanpage MVP), D-MK-12 (§19: phần mobile tối thiểu cho lead ở MVP), D-MK-14 (GD-04 bản rút gọn MVP), D-MK-5 (kênh `webchat`); §21 câu 13 bổ sung các điểm của Q-MK-15 | MK#5, KD#1, GD#18, GD#2 |
| **06** hóa đơn, công nợ | Không có việc chuyển. Giá trị đơn gắn lead là số VCsales, không phải doanh số kế toán (F10.4) | – |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/05-xu-ly.md) | — |
