# Xử lý góp ý vòng 1 — 02 Khách đa kênh

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA xử lý 52 góp ý vòng 1 (13 Chặn) cho đặc tả 02 Khách đa kênh từ NVKD Minh (18), CSKH Lan (16), sale admin Ngọc (18).
- Đặc tả 02 lên v1.1 (29/09/2026), chỗ sửa đánh dấu `[Mới v1.1]` / `[Sửa v1.1]`.
- Kết quả chính: 50 đã sửa, 1 hỏi chủ dự án, 1 chuyển file khác; 7 góp ý có phần hỏi, 8 có phần chuyển file, 2 có phần không làm.
- 13 Chặn: 12 đã sửa (4 còn một phần chờ chốt ngưỡng/phương án), 1 thành câu hỏi (P-KD #3 → CH-4).
- 7 câu hỏi CH-1…CH-7: CSKH đọc toàn văn chat của sale, ngưỡng owner "Vắng", hạn trả lời của owner, "Xin owner đồng ý" khi nêu giá, hàng "Chờ tạo mã KH", giá niêm yết cho lead, dọn dữ liệu ban đầu; đặc tả chạy theo phương án BA tới khi chốt.
- 14 nhóm việc cho designer, gồm 3 màn mới MH-DK-12, 13, 14; bản mobile chỉ vẽ sau khi chốt 03 Q14. Việc chuyển các file 00, 01, 03–06.
- Còn mở: CH-1…CH-7 và §12 câu 12 (NV phụ trách trên VCsales) từ v1.0; người duyệt nên xem kỹ CH-1 vì có thể phải sửa 01 D3.

## Mục lục

- [Tổng hợp](#tổng-hợp)
- [Sổ xử lý](#sổ-xử-lý)
- [Câu hỏi cho chủ dự án](#câu-hỏi-cho-chủ-dự-án)
- [Việc cho designer](#việc-cho-designer)
- [Việc chuyển file khác](#việc-chuyển-file-khác)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Đặc tả: [`docs/02-yeu-cau/dac-ta/02-khach-da-kenh.md`](../../dac-ta/02-khach-da-kenh.md) v1.1 (29/09/2026). Góp ý: [02-P-KD.md](02-P-KD.md) (NVKD Minh, 18 góp ý, 4 Chặn), [02-P-CS.md](02-P-CS.md) (CSKH Lan, 16 góp ý, 4 Chặn), [02-P-SA.md](02-P-SA.md) (sale admin Ngọc, 18 góp ý, 5 Chặn).
> Nguồn chuẩn đã đối chiếu: BA tổng v0.4 (BR01, BR02, BR05, BR11, BR12, §21), CLAUDE.md §12, **01-phan-quyen.md** (D2, D3, D4, D6, D10, D12, PQ-13, PQ-16…19, PQ-25, PQ-32, `cust.commerce`), 03 v1.1 (SZ-21, SZ-22, §2.6, Q14), 04 v1.1 (OA-09, OA-11, OA-12, CH-1, CH-2).
> Quy ước: **Đã sửa** = sửa trong 02 (mục ghi ở cột cuối, đánh dấu `[Mới v1.1]`/`[Sửa v1.1]` trong file) · **Chuyển designer** · **Hỏi chủ dự án** (CH-n ở cuối) · **Chuyển file khác** · **Không làm** (có lý do). Một góp ý có nhiều phần thì ghi kết quả từng phần.

## Tổng hợp

| Kết quả chính | P-KD | P-CS | P-SA | Cộng |
|---|---|---|---|---|
| Đã sửa (có thể kèm phần Hỏi / Chuyển) | 16 | 16 | 18 | 50 |
| Hỏi chủ dự án | 1 | 0 | 0 | 1 |
| Chuyển file khác | 1 | 0 | 0 | 1 |
| **Cộng góp ý đánh số** | 18 | 16 | 18 | **52** |
| Có phần Hỏi chủ dự án (kể cả dòng trên) | 2 | 3 | 2 | 7 |
| Có phần Chuyển file khác (kể cả dòng trên) | 5 | 2 | 1 | 8 |
| Có phần Không làm | 1 | 0 | 1 | 2 |

13 góp ý mức **Chặn**: 12 đã sửa trong đặc tả (4 trong số đó còn một phần chờ chủ dự án chốt ngưỡng/phương án), 1 chuyển thành câu hỏi (P-KD #3 → CH-4). Câu hỏi và UAT đề xuất của người góp ý có dòng riêng (20 câu hỏi, 3 bộ UAT).

## Sổ xử lý

### P-KD (Minh, NVKD)

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa / lý do |
|---|---|---|---|---|
| P-KD #1 | Chặn | Tin trả lời bằng app Zalo trên điện thoại không bật khóa, không vào "giá đã nêu", không được kiểm tra | Đã sửa (a, b) · Chuyển file khác (c) | Thuật ngữ "Tin gửi ngoài VClinks"; **DK-46** mới; §5.5 "Bật khi"; §5.8 kiểm tra **sau khi gửi** (chỉ cảnh báo, nêu rõ giới hạn); §5.11; kịch bản **B2**; MH-DK-09 #9c; UAT-DK-33, 42. Thống nhất 03 SZ-21 (tin điện thoại = đã trả lời). (c) bản mobile 09A/09B/panel → 00 MH-UI-11 và 03 Q14 (ghi chú đầu §8) |
| P-KD #2 | Chặn | "Owner offline 15 phút" chưa định nghĩa; sale đi thị trường bị mất khách sang CSKH | Đã sửa · Hỏi chủ dự án (ngưỡng) | **DK-47** trạng thái owner (Trực tuyến tính cả hoạt động điện thoại và tin đã gửi; **Đang đi thị trường**; Vắng; Nghỉ phép); **DK-24** sửa: CSKH tạm giữ **không đổi người xử lý**, "Tôi trả lời ngay"; §5.2, §5.2a; kịch bản I; UAT-DK-30 sửa, UAT-DK-34. Ngưỡng 30 phút → **CH-2** |
| P-KD #3 | Chặn | Sale khác "Vẫn gửi" giá cho khách của mình, owner chỉ được báo sau; luật ≥ 3 lần/30 ngày và "số tin mỗi người" khuyến khích giành khách | Hỏi chủ dự án (a, b) · Đã sửa (c, d) | (a, b) "Xin owner đồng ý" (10′ → GS duyệt; người chăm chung được nêu giá) đổi nghiệp vụ DK-31 → **CH-4**; đặc tả ghi sẵn phương án ở DK-31, §5.8, MH-DK-09 #9b, ghi chú kịch bản D, UAT-DK-36, bảng `price_approvals`. (c) ≥ 3 lần chỉ **báo** owner + GS, không tự tạo xung đột (§5.3, DK-34). (d) Drawer MH-DK-11 bỏ "số tin mỗi người", thêm người tạo mã KH, người chăm đầu tiên, doanh số theo người bán, ý kiến hai bên |
| P-KD #4 | Chặn | Lead gộp vào khách cũ có mã KH: không rõ owner nào thắng | Đã sửa | **DK-25** sửa: owner của account đã có mã KH / đã mua luôn giữ, người chăm lead chỉ ghi công lead (05); MH-DK-05 #9 thứ tự mặc định; UAT-DK-35 |
| P-KD #5 | Nên sửa | Owner bị modal "đang có người trả lời" mỗi lần khi CSKH xử lý bảo hành | Đã sửa | §5.5 "Khi người khác gửi": modal chỉ khi cùng loại yêu cầu / cùng một yêu cầu / có điểm lệch; khác loại chỉ banner (DK-27); UAT-DK-63 |
| P-KD #6 | Nên sửa | So giá theo tên hàng báo lệch sai (khác hãng, khác SL); lý do ≥ 10 ký tự chậm | Đã sửa | §5.8: so mã hàng + hãng (+ SL), nhãn "khác hãng/khác SL"; owner lệch giá chính mình chỉ dòng nhắc; lý do chọn nhanh; MH-DK-09 #9, #9a; UAT-DK-41. Giữ "báo giá ERP còn hiệu lực luôn cảnh báo" (an toàn), owner chỉ chọn lý do |
| P-KD #7 | Nên sửa | Owner phải duyệt gợi ý gộp, quá hạn bị báo GS | Đã sửa | §4.6: hàng chính của sale admin; owner trả lời **một chạm trong khung chat** (MH-DK-02 #20); quá hạn báo nhóm SA, không báo GS (DK-09) |
| P-KD #8 | Nên sửa | Tự gộp nhầm vợ chồng (F1); tách 4 bước; lộ công nợ | Đã sửa | Tín hiệu âm **A4** (khác giới tính, chặn tự gộp), **A5**; dòng "Vừa gộp tự động… [Không phải người này]" tách một chạm; khối thương mại thu gọn 24 giờ sau tự gộp (§4.5, DK-06, MH-DK-02 #19); F1 viết lại, F1b; UAT-DK-09 sửa, UAT-DK-62 |
| P-KD #9 | Nên sửa | Thợ của garage mình nhắn nick người khác: không có bước kéo khách về nick owner | Đã sửa · Chuyển file khác (03) | §5.3 "Kéo khách về nick của owner": gửi tin chuyển → nhắc việc cho owner kết bạn, nhờ gửi danh thiếp; khách đã nhắn nick owner → nick kia "Chỉ chăm sóc"; DK-21. Lệnh danh thiếp trên khung chat → 03 |
| P-KD #10 | Nên sửa | Một người thuộc nhiều account (2 xưởng, thợ làm 2 garage) | Đã sửa | **DK-55** account chính + account liên quan; MH-DK-02 #17 "Đang mua cho"; §4.13; kịch bản K; L12; UAT-DK-58 |
| P-KD #11 | Nên sửa | Quá nhiều thông báo có âm | Đã sửa · Chuyển file khác (00) · Chuyển designer | **DK-59** hai mức "Cần làm ngay"/"Để biết", email mặc định tắt (§5.9); UAT-DK-43. Trung tâm thông báo, mục "Tin về khách của tôi", cài đặt → 00 |
| P-KD #12 | Nên sửa | Khách dùng Zalo của vợ để đặt hàng | Đã sửa | **DK-53** người nói thay; kịch bản F3; §4.9, §4.13; MH-DK-07 #3 và "Tin này của…"; UAT-DK-37 |
| P-KD #13 | Nên sửa | Garage đổi chủ, thợ/kế toán nghỉ sang nơi khác | Đã sửa | **DK-54**; §4.13; kịch bản J1, J2; MH-DK-01 hành động "Đổi chủ", "Đánh dấu đã rời", "Chuyển sang account khác"; MH-DK-02 #18; UAT-DK-57 |
| P-KD #14 | Gợi ý | Bằng chứng "đã gọi điện xác nhận" | Đã sửa | §4.9, MH-DK-07 #4 (bắt buộc giờ gọi, SĐT V2+); UAT-DK-50 |
| P-KD #15 | Nên sửa | Panel thiếu "đã hứa/đã báo gần đây", xe của khách, câu hỏi chưa ai trả lời | Đã sửa (cam kết, chưa trả lời) · Chuyển file khác (03: xe) | **DK-49**, §5.11; MH-DK-02 #15, #16. Khối "Xe của khách" (VIN, biển số) thuộc panel bán hàng → 03 |
| P-KD #16 | Gợi ý | Tin trong nhóm Zalo của garage chưa được tính | Đã sửa | **DK-52**, §5.12, kịch bản L; DK-30, DK-43 bổ sung; UAT-DK-59 |
| P-KD #17 | Gợi ý | Cờ "Đang có khiếu nại mở" ở division khác | Chuyển file khác (01) | Phạm vi xem chéo division là của 01 (D10, PQ-12) và BA §21 câu 23. 02 giữ "chỉ có hoạt động" tới khi 01 chốt |
| P-KD #18 | Gợi ý | Chăm chung hết 30 ngày thì sao | Đã sửa · Không làm (phần "không thời hạn") | §5.9, MH-DK-11: báo trước 3 ngày, gia hạn một chạm. Không làm "chăm chung không thời hạn": mất điểm rà soát định kỳ của giám sát |
| P-KD câu hỏi 1 | – | Owner VClinks có phải "NV phụ trách" VCsales, đổi owner có đổi KPI | Hỏi chủ dự án (đã có) | §12 câu 12 / BA §21 câu 7. Bổ sung: "Chuyển owner" tạo việc "Đổi NV phụ trách trên VCsales" ở MH-DK-12 |
| P-KD câu hỏi 2 | – | CSKH tạm giữ mà khách chốt đơn thì đơn của ai | Đã sửa | §5.2a: tạm giữ không đổi owner, không đổi người xử lý; doanh số theo VCsales |
| P-KD câu hỏi 3 | – | Hải gửi tin chuyển, ai theo dõi khách | Đã sửa | §5.3: owner theo dõi (có nhắc việc); người gửi tin chuyển hết trách nhiệm sau khi gửi |
| P-KD câu hỏi 4 | – | Danh sách "khách của tôi đang nhắn nick người khác" | Đã sửa | MH-DK-08 #3a |
| P-KD câu hỏi 5 | – | Nghỉ phép 1 tuần | Đã sửa | DK-47 "Nghỉ phép" → trực thay (01 PQ-32); quay lại khách không đổi owner, có ghi chú bàn giao |
| P-KD câu hỏi 6 | – | Nick giao cho người khác thì owner 200 garage có đổi theo | Đã sửa | DK-21: đổi người giữ nick không đổi owner; owner đổi qua bàn giao khách (01 PQ-17, PQ-33) |
| P-KD câu hỏi 7 | – | GS có xem số lần "Vẫn gửi" và dùng chấm điểm không | Hỏi chủ dự án | Gộp vào **CH-4** |
| P-KD câu hỏi 8 | – | Tin từ điện thoại có giá khác báo giá VCsales | Đã sửa | §5.8 (DK-46): cảnh báo sau gửi cho người gửi; báo owner/người giữ ticket; chỉ báo GS khi nêu giá cho khách người khác |
| P-KD UAT đề xuất | – | UAT-DK-33…41 | Đã sửa | Thành UAT-DK-33, 34, 35, 36, 37, 57, 58, 41, 43 (§11.4) |

### P-CS (Lan, CSKH)

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa / lý do |
|---|---|---|---|---|
| P-CS #1 | Chặn | CSKH không biết sale đã hứa gì; chỉ thấy tóm tắt | Đã sửa (a) · Hỏi chủ dự án (b) | (a) Khối **"Cam kết đã nêu (7 ngày)"** cho mọi người đang xử lý/tham gia, lấy từ `stated_commitments` (dữ liệu DK-32 đã trích): **DK-49**, §5.11, MH-DK-02 #15, MH-DK-01 quyền CS, UAT-DK-38. Nguyên văn chỉ khi có quyền đọc (khớp 01 D3). (b) CSKH đọc toàn văn chat của khách đang xử lý → **CH-1** (§21 câu 10; trùng 04 CH-1) |
| P-CS #2 | Chặn | Hội thoại hỏi giá chuyển owner không có hạn, không ai theo; owner nghỉ thì CSKH giữ khách mà không được nói giá | Đã sửa · Hỏi chủ dự án (ngưỡng, trực bán hàng) | **DK-48** hạn trả lời của owner, tính theo tin trả lời; quá hạn lần 1 báo owner + GS, CSKH tạm giữ, gửi câu giữ khách; lần 2 → người trực bán hàng / GS; hội thoại phụ "Cùng một yêu cầu" dùng chung hạn (§5.2a, §5.7, DK-30); kịch bản I2; UAT-DK-40. Khớp 01 PQ-19 (CSKH không tự nhận). Ngưỡng, vai trò trực bán hàng → **CH-3** |
| P-CS #3 | Chặn | CSKH không có cách xác nhận danh tính khách chưa xác nhận | Đã sửa | **DK-50**: yêu cầu chia sẻ thông tin OA (theo 04 OA-09), đối chiếu mã đơn + SĐT (xác nhận **chỉ trong phạm vi đơn**, không mở công nợ, khóa sau 2 lần sai), nhờ owner xác nhận; mẫu câu (§4.10, MH-DK-09 #4a); kịch bản M; UAT-DK-55 |
| P-CS #4 | Chặn | Owner "Vẫn gửi" cam kết trái ticket nhưng người giữ ticket không được báo; cam kết trong ticket không được kiểm tra | Đã sửa | §5.8: "Vẫn gửi" liên quan ticket → báo người xử lý ticket + ghi chú nội bộ tự động + cập nhật cam kết; cam kết ghi trong ticket tính vào DK-32; kịch bản B dòng 14:20; MH-DK-09 hành động; UAT-DK-39 |
| P-CS #5 | Nên sửa | Mọi số tiền của CSKH đều bật modal | Đã sửa · Chuyển file khác (04, 06) | DK-31, §5.8: không cần lý do khi số khớp hóa đơn/thanh toán hoặc bảng phí hậu mãi; lý do chọn nhanh; UAT-DK-64. Bảng phí hậu mãi → 04; dữ liệu thanh toán/hóa đơn → 06 |
| P-CS #6 | Nên sửa | Banner khóa không nói đang trả lời chuyện gì; modal lặp khi khác việc | Đã sửa | §5.5 banner thêm loại yêu cầu + chủ đề; khác loại chỉ banner (DK-27); MH-DK-09 #2a |
| P-CS #7 | Nên sửa | Trả hội thoại về owner giữa lúc CSKH đang nói | Đã sửa | §5.2a: kết thúc tạm giữ khi owner gửi tin đầu tiên hoặc bấm "Tôi trả lời ngay"; không rút khi CSKH đang gõ; báo CSKH; ghi chú bàn giao điền sẵn (DK-24, MH-DK-09 #5b) |
| P-CS #8 | Nên sửa | §5.4 và kịch bản G mâu thuẫn khi hội thoại đang có người xử lý | Đã sửa | §5.2 ghi chú, §5.4, DK-23: định tuyến theo loại chỉ khi chưa có người xử lý; kịch bản G 09:40 sửa; UAT-DK-60 |
| P-CS #9 | Nên sửa | CSKH chào lead trước có thành owner không; CSKH nêu giá cho lead chưa owner | Đã sửa (owner) · Hỏi chủ dự án (giá) | DK-25: chỉ **NVKD** trả lời đầu tiên mới là owner đề xuất. CSKH gửi giá niêm yết cho lead → **CH-6** (ghi sẵn ở DK-31) |
| P-CS #10 | Nên sửa | CSKH cần đơn/giao hàng/hóa đơn, không cần công nợ | Đã sửa | MH-DK-01 quyền CS: tab Thương mại chỉ Đơn/giao hàng/hóa đơn, khớp 01 `cust.commerce` "Đơn hàng: TK"; UAT-DK-14 sửa |
| P-CS #11 | Nên sửa | Banner ticket không có nút làm tiếp | Đã sửa · Chuyển designer | MH-DK-09 #5: trạng thái ticket, `[Mở ticket]`, `[Gắn tin này vào ticket]`, `[Chuyển hội thoại cho …]` |
| P-CS #12 | Nên sửa | Khách kể lỗi hàng với sale trên Zalo, CSKH phải hỏi lại | Đã sửa · Chuyển file khác (03, 04) | §5.3 "Chiều sale → CSKH": `Chuyển hậu mãi cho CSKH` tạo ticket kèm tin đã chọn (khớp 01 D3); UAT-DK-61. Nút trên khung chat Zalo → 03; nhận ticket → 04 |
| P-CS #13 | Nên sửa | Gắn tay khách của người khác chỉ thành gợi ý, CSKH không có ngữ cảnh khi khiếu nại gấp | Đã sửa | **DK-51** "Tạm gắn để xem" với bằng chứng mạnh (T6, T8): thấy owner, ticket, cam kết; không thấy công nợ (§4.9, MH-DK-07) |
| P-CS #14 | Gợi ý | Dòng không có quyền chỉ báo từ chối | Đã sửa | MH-DK-02 hành động: nút "Hỏi [người xử lý]" (@nhắc nội bộ gắn khách) |
| P-CS #15 | Gợi ý | NVKD "Lan" trùng tên persona CSKH | Đã sửa | Đổi NVKD Lan → **Linh** trong toàn file 02 (ghi ở đầu file) |
| P-CS #16 | Gợi ý | Chưa có câu mẫu khi tạm giữ hội thoại công nợ | Đã sửa | Mẫu `/cong-no-chuyen-owner` + nhắc việc owner (§4.10, §5.2); mẫu `/giu-khach`; UAT-DK-56 |
| P-CS câu hỏi 1 | – | CSKH có được đọc hội thoại của sale | Hỏi chủ dự án | **CH-1** |
| P-CS câu hỏi 2 | – | "Owner online" nghĩa là gì | Đã sửa · Hỏi chủ dự án (ngưỡng) | DK-47; **CH-2** |
| P-CS câu hỏi 3 | – | Có vai trò "trực bán hàng" không | Hỏi chủ dự án | **CH-3** |
| P-CS câu hỏi 4 | – | Hội thoại phụ có tính vào SLA của CSKH khi owner trả lời muộn | Đã sửa | §5.2a: FRT CSKH tính theo tin chuyển/giữ khách; trễ của owner không tính cho CSKH |
| P-CS câu hỏi 5 | – | Đối chiếu mã đơn + SĐT có được chấp nhận | Đã sửa | DK-50 cho phép với phạm vi hẹp (chỉ đơn đó, không công nợ, khóa sau 2 lần sai, nhật ký bằng chứng). Chủ dự án muốn chặt hơn thì bỏ cách 2 mà không ảnh hưởng phần còn lại |
| P-CS câu hỏi 6 | – | Thấy owner đã đọc ghi chú nội bộ tự động chưa | Chuyển file khác (00) | Trạng thái đã đọc của ghi chú nội bộ là thành phần chung của 00 |
| P-CS UAT đề xuất | – | 10 ca | Đã sửa | Thành UAT-DK-38, 39, 40, 30 (sửa), 55, 56, 64, 60, 61 (§11.4) |

### P-SA (Ngọc, sale admin)

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa / lý do |
|---|---|---|---|---|
| P-SA #1 | Chặn | Tự gộp quá dễ (F1 gộp nhầm); SĐT dùng chung chưa đánh dấu | Đã sửa | **DK-06**: chỉ tự gộp khi **một phía là danh tính mới** (≤ 72 giờ, chưa mã KH, chưa owner khác, < 20 tin); **DK-57** tự đánh dấu "Dùng chung nhiều khách" khi SĐT trên ≥ 2 mã KH; khối thương mại thu gọn 24 giờ sau tự gộp; A4, A5; F1 viết lại (§4.2, §4.4, §4.5, L11). UAT-DK-09 sửa, UAT-DK-44 |
| P-SA #2 | Chặn | Hàng theo cặp không xử lý được 150 dòng | Đã sửa · Chuyển designer | MH-DK-04 #8–#14: gom cụm, mở rộng dòng có ảnh hai bên và bằng chứng, lọc nguồn/chiến dịch/"chỉ lead chưa owner", lô ≥ 70 khi cùng owner hoặc cả hai chưa owner, phím tắt. Bằng chứng với SA chỉ dạng "SĐT xuất hiện trong tin [kênh] [giờ]", không hiện nội dung (01 PQ-25). UAT-DK-45 |
| P-SA #3 | Chặn | Không sửa được gộp nhầm cấp account; mã KH "luôn ở lại" có thể giữ nhầm | Đã sửa | **DK-56** "Khôi phục hồ sơ đã gộp" (cùng `_id`, mã KH, owner, người liên hệ, ghi chú; cả sau 30 ngày); "Chuyển người liên hệ sang account khác"; mã KH **đi theo account mà nó được xác nhận** (BR11); mặc định dữ liệu về nơi xuất phát (§4.7 bước 8, §4.8, DK-12, MH-DK-06). UAT-DK-46 |
| P-SA #4 | Chặn | Hàng "Chờ tạo mã KH" chưa có màn hình | Đã sửa · Hỏi chủ dự án (nguồn "chốt đơn", giai đoạn) | **MH-DK-12** (phiếu sale điền: tên pháp lý, MST, địa chỉ giao/xuất HĐ, SĐT V2+, loại khách; kiểm tra trùng; mở VCsales; trả sale; tự rời hàng khi có mã mới), **DK-58**; UAT-DK-51, 52. Nguồn "chốt đơn", khách lẻ, giai đoạn → **CH-5** |
| P-SA #5 | Chặn | Liên kết mã KH từng khách, không thấy MST/địa chỉ | Đã sửa | **MH-DK-13** đối chiếu hàng loạt (MST, địa chỉ, tên pháp lý, NV phụ trách, trạng thái, ngày giao dịch cuối; lô ≥ 90 có SĐT V2+ hoặc MST); MH-DK-10 #6. Phụ thuộc API VCsales (BA §21 câu 8). UAT-DK-53 |
| P-SA #6 | Nên sửa | Không có chỗ soát tự gộp/gắn tay toàn division | Đã sửa | **MH-DK-14** tab Nhật ký hồ sơ (lọc, "Đã soát", Hoàn tác/Tách, bộ đếm); §4.12; UAT-DK-54 |
| P-SA #7 | Nên sửa | Hoàn tác không nói gì về dữ liệu phát sinh sau gộp | Đã sửa | §4.7 bước 6, DK-11, MH-DK-06 chế độ Hoàn tác (danh sách "Thay đổi từ lúc gộp", danh tính gộp sau → thành gợi ý); UAT-DK-47 |
| P-SA #8 | Nên sửa | Tách xong không biết trong thời gian gộp đã lộ gì | Đã sửa | §4.8 bước 9, MH-DK-06 #8a "Trong thời gian gộp" + "Báo giám sát"; owner cả hai hồ sơ được báo |
| P-SA #9 | Nên sửa | "Không đủ căn cứ" bị khóa vĩnh viễn; không có "Nhờ xác minh" | Đã sửa | **DK-60**; MH-DK-05 "Từ chối" sửa chữ; "Nhờ xác minh" ở MH-DK-04/05, trạng thái "Chờ xác minh" không tính hạn; UAT-DK-48 |
| P-SA #10 | Nên sửa | "Dùng chung" chỉ một nghĩa; không có trang quản lý | Đã sửa | §4.2 hai trạng thái "Dùng chung trong account"/"Dùng chung nhiều khách" (+ "Không còn xác thực"); MH-DK-14 tab SĐT dùng chung, liệt kê gộp cũ dựa trên số đó (DK-57) |
| P-SA #11 | Nên sửa | Lead ↔ lead không rõ ai duyệt; đề xuất tự gộp lead V1↔V1 | Đã sửa (người duyệt) · Không làm (tự gộp V1↔V1) | §4.6 thêm dòng lead ↔ lead. Không tự gộp V1↔V1: trái BR05 và L2 (V1 ai cũng gõ được); tải công việc đã giảm nhờ gom cụm + lô ≥ 70 (P-SA #2) |
| P-SA #12 | Nên sửa | SĐT bị nhà mạng cấp lại mà chưa ai bấm "Ngừng dùng" | Đã sửa | Tín hiệu âm **A6** (không hoạt động > 12 tháng, chặn tự gộp), DK-08, DK-14; UAT-DK-49 |
| P-SA #13 | Nên sửa | VCsales có 2 mã một garage; gỡ liên kết; đề xuất của KD vào đâu | Đã sửa | §4.11, DK-16: "Báo trùng trên VCsales" (MH-DK-10 #7 → việc ở MH-DK-12); gỡ liên kết → "Không còn xác thực" + liệt kê gộp đã dựa vào; đề xuất của KD vào MH-DK-13 |
| P-SA #14 | Nên sửa | Không có danh sách việc cập nhật VCsales; SA-04 để GĐ2 | Đã sửa · Hỏi chủ dự án (giai đoạn) | MH-DK-12 tab "Cần cập nhật VCsales" (đổi SĐT/email kèm tin nguồn, đổi NV phụ trách, gộp mã), "Đã cập nhật trên VCsales". Đưa lên MVP → **CH-5** |
| P-SA #15 | Nên sửa | Màn so sánh thiếu ảnh, người liên hệ, dữ liệu VCsales; gợi ý cấp account chưa có bố cục | Đã sửa · Chuyển designer | MH-DK-05 #11–#15 |
| P-SA #16 | Gợi ý | Chia hàng khi 2 SA, SA nghỉ, cột hạn | Đã sửa · Chuyển file khác (01) | MH-DK-04 #12 "Hạn", #13 "Nhận xử lý" khóa 15′, lọc "Của tôi". Trực thay cho SA → 01 (PQ-32 hiện chỉ cho NVKD) |
| P-SA #17 | Gợi ý | Tìm theo MST, địa chỉ; hiện hồ sơ đã gộp | Đã sửa | MH-DK-08 #2, #3b |
| P-SA #18 | Gợi ý | SA bỏ khóa gộp; báo cáo tự gộp theo quy tắc lên MVP | Đã sửa | DK-12, MH-DK-14 "Bỏ khóa gộp"; bộ đếm tuần theo quy tắc ở MH-DK-14 #1. Báo cáo chất lượng danh tính đầy đủ (DK-US-14) vẫn GĐ2 |
| P-SA câu hỏi 1 | – | Chấp nhận luôn qua người duyệt khi hai hồ sơ đã có lịch sử? Tăng bao nhiêu gợi ý | Đã sửa · Hỏi chủ dự án (số liệu) | Chặt hơn BR05 nên áp luôn (L11). Ước lượng khối lượng → **CH-7** |
| P-SA câu hỏi 2 | – | Bao nhiêu SĐT trên VCsales gắn ≥ 2 mã KH | Hỏi chủ dự án | **CH-7** |
| P-SA câu hỏi 3 | – | Đợt dọn dữ liệu ban đầu | Đã sửa · Hỏi chủ dự án (xác nhận) | §4.6 nhãn "Dọn ban đầu" không tính hạn, không báo; **CH-7** |
| P-SA câu hỏi 4 | – | "Chốt đơn" lấy từ đâu; khách lẻ có cần mã KH | Hỏi chủ dự án | **CH-5** (BA §21 câu 14) |
| P-SA câu hỏi 5 | – | Ai sửa "NV phụ trách" trên VCsales khi chuyển owner | Hỏi chủ dự án (đã có) | §12 câu 12 / BA §21 câu 7; tạm thời SA làm theo việc ở MH-DK-12 |
| P-SA câu hỏi 6 | – | Vai trò SA trực thay | Chuyển file khác (01) | Như P-SA #16 |
| P-SA UAT đề xuất | – | UAT-DK-SA-01…08 | Đã sửa | Thành UAT-DK-44, 46, 45, 48, 49, 51, 54, 47 (§11.4) |

## Câu hỏi cho chủ dự án

Tới khi chốt, đặc tả chạy theo **phương án BA đề xuất** (đánh dấu **[Chờ chốt CH-n]** trong 02).

| # | Câu hỏi | Phương án | Đề xuất BA | Nguồn |
|---|---|---|---|---|
| **CH-1** | CSKH có được **đọc toàn văn** hội thoại của sale (kể cả trên nick cá nhân) với khách mình đang xử lý ticket/hội thoại không? (BA §21 câu 10; trùng 04 CH-1) | **A.** Đọc đầy đủ, chỉ đọc, không gửi, trong division, 30 ngày gần nhất, chỉ khi đang giữ ticket/hội thoại của khách đó, mỗi lần mở ghi nhật ký. Cần sửa 01 D3. **B.** Chỉ tóm tắt + khối "Cam kết đã nêu" (giá, hẹn, cam kết đã chuẩn hóa, người, kênh, giờ); nguyên văn qua "Hỏi [NV]" hoặc tin sale chọn khi "Chuyển hậu mãi" | **B** cho MVP (khớp 01 D3, ít lộ dữ liệu hơn theo NĐ 13); xem lại sau UAT nếu CSKH vẫn phải hỏi lại khách | P-CS #1, câu hỏi 1 |
| **CH-2** | Owner thế nào là **"Vắng"** để CSKH tạm giữ? (thay 15 phút ở DK-24 cũ; BR02 "X phút") | Ngưỡng 15 / **30** / 45 phút không có hoạt động trong giờ làm. Hoạt động gồm mở VClinks trên máy tính/điện thoại và **gửi tin từ bất kỳ nguồn nào** (kể cả app Zalo điện thoại). Trạng thái "Đang đi thị trường" do owner bật, tối đa tới hết giờ làm, GS thấy trạng thái | 30 phút; có "Đang đi thị trường"; GS thấy trạng thái nhưng không dùng để chấm điểm | P-KD #2, P-CS câu hỏi 2 |
| **CH-3** | **Hạn trả lời của owner** với hội thoại hỏi giá trên OA/Fanpage/chat web, và có **"người trực bán hàng"** không? (trùng 04 CH-2) | Hạn lần 1: 15 / **30** / 60 phút giờ làm → báo owner + GS, CSKH gửi câu giữ khách. Lần 2 (+30 phút) → **A.** người trực bán hàng theo ngày của tổ (GS chọn) · **B.** giám sát của owner | Lần 1: 30 phút; lần 2: +30 phút; **A** nếu tổ có lịch trực, mặc định **B** khi chưa cấu hình | P-CS #2, câu hỏi 3 |
| **CH-4** | NVKD không phải owner muốn **nêu giá** cho khách đã có owner (DK-31) | **A.** "Xin owner đồng ý": tin chờ, owner một chạm Đồng ý / Để tôi trả lời, 10 phút không phản hồi → GS của owner duyệt; người "chăm chung" được nêu giá. **B.** Giữ như v1.0: "Vẫn gửi" + lý do, owner và GS được báo sau, tạo xung đột owner. Kèm: số lần xin/Vẫn gửi của mỗi người có dùng để đánh giá không | **A** (giá đã nói không rút lại được; khớp nguyên tắc "không gửi khi chưa duyệt" ở mức nghiệp vụ). Số lần chỉ để GS xem, không chấm điểm tự động | P-KD #3, câu hỏi 7 |
| **CH-5** | Hàng **"Chờ tạo mã KH"** và **"Cần cập nhật VCsales"** (MH-DK-12) | (a) Khách vào hàng khi: sale bấm tay · trạng thái phễu "Chốt đơn" · có báo giá VCsales cho khách chưa mã (phụ thuộc §21 câu 14). (b) Khách lẻ mua một lần có bắt buộc mã KH không. (c) Đưa MH-DK-12 (kể cả SA-04, đang GĐ2) lên **MVP** cùng "Đổi SĐT chính" | (a) sale bấm tay + phễu "Chốt đơn"; (b) không bắt buộc, SA đóng việc với lý do "Khách lẻ mua một lần"; (c) MVP | P-SA #4, #14, câu hỏi 4 |
| **CH-6** | CSKH có được gửi **giá niêm yết công khai** cho **lead chưa có owner** không? | **A.** Được, chỉ giá niêm yết, không chiết khấu, rồi chuyển NVKD. **B.** Không, luôn chuyển NVKD | **A** (giờ cao điểm lead chờ lâu thì mất) | P-CS #9 |
| **CH-7** | Dữ liệu cho **đợt dọn dữ liệu ban đầu** | (a) Xin VCsales danh sách SĐT đang gắn ≥ 2 mã KH để đánh dấu "Dùng chung nhiều khách" trước lần gộp đầu. (b) Xác nhận chế độ "Dọn ban đầu" (không hạn 2 ngày, không báo). (c) Ước lượng số gợi ý tăng do L11 (hai hồ sơ đã có lịch sử luôn qua người duyệt) để bố trí SA | Làm cả (a), (b); đo (c) trên dữ liệu thật ở UAT | P-SA câu hỏi 1–3 |

Câu hỏi đã có từ v1.0, vẫn mở: §12 câu 12 (VCsales có "NV phụ trách", ai sửa khi chuyển owner) cho P-KD câu hỏi 1 và P-SA câu hỏi 5.

## Việc cho designer

Canvas lô 02 (theo đặc tả v1.1, mọi chữ lấy đúng như đặc tả):

1. **MH-DK-02 panel 360:** khối "Cam kết đã nêu (7 ngày)" (#15) đặt trên khối thương mại; dòng "Chưa trả lời" (#16); "Đang mua cho" (#17); "Trước đây làm ở…" (#18); dòng "Vừa gộp tự động… [Không phải người này]" (#19); câu hỏi gộp một chạm (#20); nút "Hỏi [NV]" khi dòng không có quyền.
2. **MH-DK-09A banner:** thêm loại yêu cầu + chủ đề, "· từ điện thoại", "trong nhóm…"; banner ticket có trạng thái và 3 nút; banner "Owner chưa trả lời [n]′" cho CSKH; banner "[CSKH] đang tạm giữ" + "Tôi trả lời ngay" cho owner; banner chưa xác nhận có 3 nút xác nhận của CSKH và popover "Đối chiếu mã đơn + SĐT".
3. **MH-DK-09B modal:** lý do chọn nhanh (Radio), nhãn "khác hãng/khác SL", nút "Xin owner đồng ý" (phương án CH-4) và thông báo chờ duyệt phía owner (Đồng ý gửi / Để tôi trả lời); cảnh báo **sau gửi** cho tin từ điện thoại (notification + dòng trên tin, "Gửi đính chính").
4. **Trạng thái owner:** công tắc "Đang đi thị trường" (chọn giờ kết thúc) ở thanh trên (phối hợp 00), chấm trạng thái cạnh tên owner ở danh sách hội thoại.
5. **Thông báo hai mức** và mục "Tin về khách của tôi" (phối hợp 00).
6. **MH-DK-04:** dòng cụm mở rộng được (ảnh hai bên, bằng chứng dạng kênh + giờ), cột Hạn, "Nhận xử lý", lọc chiến dịch/"Chỉ lead chưa owner"/"Chờ xác minh", gợi ý phím tắt.
7. **MH-DK-05:** hàng ảnh đại diện lớn, 3 bằng chứng hiện sẵn, khối người liên hệ của account, dữ liệu VCsales, **bố cục riêng cho "Thêm vào account"**, chữ mới của "Từ chối", nút "Nhờ xác minh".
8. **MH-DK-06:** ba chế độ (Tách · Hoàn tác · Khôi phục · Chuyển người liên hệ), bước "Thay đổi từ lúc gộp", khối "Trong thời gian gộp" + "Báo giám sát".
9. **MH-DK-07:** bằng chứng gọi điện (giờ gọi), "Người nhà / người nói thay", thông báo tạm gắn để xem; menu "Tin này của…" trên tin.
10. **MH-DK-01:** tab Người liên hệ có trạng thái "Đã rời", account liên quan; hành động "Đổi chủ", "Chuyển sang account khác", "Khôi phục hồ sơ này"; tab Thương mại bản CSKH (chỉ đơn/giao hàng/hóa đơn).
11. **MH-DK-08:** "Tìm theo" MST/Địa chỉ, lọc "Khách của tôi đang nhắn nick khác", "Gồm hồ sơ đã gộp".
12. **MH-DK-11:** drawer mới (người tạo mã KH, người chăm đầu tiên, ý kiến hai bên, bỏ "số tin mỗi người"), thông báo gia hạn chăm chung.
13. **Màn mới:** MH-DK-12 (Việc VCsales, drawer phiếu tạo mã), MH-DK-13 (Đối chiếu mã KH hàng loạt), MH-DK-14 (Nhật ký hồ sơ toàn division, SĐT dùng chung).
14. **Mobile:** bản 360–430 px của 09A, 09B, panel 360 theo 00 MH-UI-11, **chỉ vẽ sau khi chốt 03 Q14**.

## Việc chuyển file khác

| File | Việc | Từ góp ý |
|---|---|---|
| **00** giao diện chung | (1) Bố cục mobile cho khung chat, 09A, 09B, panel 360 (MH-UI-11), phụ thuộc 03 Q14. (2) Cài đặt thông báo hai mức "Cần làm ngay"/"Để biết", mục "Tin về khách của tôi", email mặc định tắt (DK-59). (3) Công tắc trạng thái "Đang đi thị trường" và hiển thị trạng thái owner (DK-47). (4) @nhắc nội bộ gắn sẵn khách cho nút "Hỏi [NV]". (5) Trạng thái đã đọc của ghi chú nội bộ tự động | P-KD #1c, #2, #11; P-CS #14, câu hỏi 6 |
| **01** phân quyền | (1) CSKH (và người giữ nick không phải owner) được xem `stated_commitments` dạng chuẩn hóa của khách mình đang xử lý trong division (DK-49); quyết định CH-1 có thể phải sửa D3. (2) Xác nhận "Đơn hàng: TK" của CSKH gồm đơn/giao hàng/hóa đơn của khách đang có ticket/hội thoại với mình. (3) PQ-19 cập nhật: tạm giữ không đổi người xử lý, leo thang theo hạn trả lời của owner (DK-24, DK-48) thay cho "Nhận xử lý" gửi GS; "Đang đi thị trường" tính là trực tuyến ở PQ-16/PQ-19. (4) Quyền hẹp "Tạm gắn để xem" (DK-51). (5) Quyền xem xác nhận "chỉ trong phạm vi một đơn" (DK-50). (6) Cờ "Đang có khiếu nại mở" cho người khác division (D10, §21 câu 23). (7) Trực thay cho sale admin | P-CS #1, #10, #13, #3; P-KD #2, #17; P-SA #16, câu hỏi 6 |
| **03** sale Zalo cá nhân | (1) Trên khung chat Zalo: khóa trả lời và cảnh báo **sau gửi** cho tin gửi từ điện thoại (DK-46), nói rõ với sale "kiểm tra trước khi gửi chỉ có trên VClinks". (2) Nút `Chuyển hậu mãi cho CSKH` (chọn tin + ảnh). (3) Nhắc việc "Kết bạn [khách] bằng nick owner" và lệnh gửi danh thiếp của owner qua nick người khác. (4) Khối "Xe của khách" (VIN, biển số, dòng xe) trên panel bán hàng. (5) Menu "Tin này của…" (DK-53), "Đang mua cho" (DK-55). (6) Tin trong nhóm Zalo đã gắn account (DK-52) | P-KD #1, #9, #12, #15, #16; P-CS #12 |
| **04** CSKH Zalo OA | (1) Bảng phí hậu mãi đã duyệt (miễn lý do ở DK-31). (2) Cam kết trong ticket (hạn xử lý, phương án) ghi vào `stated_commitments`; ticket nhận ghi chú tự động khi sale "Vẫn gửi"/gửi từ điện thoại trái ticket. (3) Ba nút xác nhận danh tính trên OA/Fanpage (DK-50), dùng giới hạn OA-09. (4) OA-11, OA-12 theo DK-24/DK-48 mới (04 CH-2 = CH-3 ở đây; 04 CH-1 = CH-1). (5) Định tuyến theo loại chỉ khi hội thoại chưa có người xử lý (DK-23). (6) Mẫu `/giu-khach`, `/cong-no-chuyen-owner`. (7) Nhận ticket từ "Chuyển hậu mãi cho CSKH" | P-CS #2, #3, #4, #5, #8, #12, #16 |
| **05** marketing, chatbot | (1) DK-25 mới: CSKH, marketing chào lead không thành owner; lead gộp vào khách có mã KH → owner cũ giữ, người chăm lead được ghi công lead. (2) Gợi ý gộp mang `campaignId` để lọc theo chiến dịch ở MH-DK-04 | P-KD #4, P-CS #9, P-SA #2 |
| **06** hóa đơn, công nợ (`06-hoa-don-cong-no.md`) | (1) Dữ liệu hóa đơn/thanh toán để DK-31 miễn lý do khi CSKH nhắc lại số khớp. (2) Phiếu "Chờ tạo mã KH" (MH-DK-12) dùng cùng định nghĩa thông tin xuất hóa đơn (tên pháp lý, MST, địa chỉ xuất HĐ) với 06 | P-CS #5, P-SA #4 |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/02-xu-ly.md) | — |
