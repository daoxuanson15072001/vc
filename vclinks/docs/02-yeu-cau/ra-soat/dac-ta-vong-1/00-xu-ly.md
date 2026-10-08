# Xử lý góp ý vòng 1 — 00 Giao diện chung

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA xử lý 49 góp ý vòng 1 cho đặc tả 00 Giao diện chung từ 3 vai: NVKD Minh (18, 3 Chặn), CSKH Lan (17, 4 Chặn), NV thị trường Dũng (14, 4 Chặn).
- Đặc tả 00 lên v1.1 (29/09/2026), chỗ sửa có nhãn **[v1.1]**.
- Kết quả chính: 43 đã sửa, 4 hỏi chủ dự án, 2 chuyển designer; 8 góp ý có phần phụ chuyển file 01/03/04, 3 phần nhỏ không làm có lý do.
- 11 góp ý Chặn: 9 đã sửa, 2 hỏi chủ dự án (KD #1 mobile ở MVP, TT #2 lưu dữ liệu trên điện thoại), đặc tả đã viết sẵn phương án.
- 8 câu hỏi cho chủ dự án (Q-13 mobile ở MVP, Q-2 phiên điện thoại, Q-14 "Đi thị trường", Q-15 cửa sổ Fanpage, Q-16, Q-17 thẻ tối thiểu khi CSKH tìm SĐT, Q-18, 03 Q11 KPI); đặc tả chạy theo "Mặc định tới khi chốt".
- 9 nhóm việc cho designer (màu và chip, ô soạn và ghi chú, khung chat 1366×768, danh sách, thông báo, trạng thái online, panel phải, mobile, trang lỗi) và việc chuyển các file 01–06.
- Còn mở: các câu hỏi chờ chủ dự án chốt; người duyệt nên xem bảng Câu hỏi cho chủ dự án.

## Mục lục

- [Tổng hợp](#tổng-hợp)
- [Sổ góp ý](#sổ-góp-ý)
- [Câu hỏi cho chủ dự án](#câu-hỏi-cho-chủ-dự-án)
- [Việc cho designer](#việc-cho-designer)
- [Việc chuyển file khác](#việc-chuyển-file-khác)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Đầu vào: [00-P-KD.md](00-P-KD.md) (Minh, NVKD: 18 góp ý, 3 Chặn) · [00-P-CS.md](00-P-CS.md) (Lan, CSKH: 17 góp ý, 4 Chặn) · [00-P-TT.md](00-P-TT.md) (Dũng, NV thị trường: 14 góp ý, 4 Chặn).
> Đặc tả đã sửa: [../../00-giao-dien-chung.md](../../dac-ta/00-giao-dien-chung.md) **v1.1** (29/09/2026). Chỗ sửa trong đặc tả có nhãn **[v1.1]**.
> Nguồn chuẩn đã đối chiếu: BA tổng v0.4, CLAUDE.md §12, **01** (D1–D12, PQ-03, PQ-12, PQ-19, PQ-26, PQ-36–38, MH-PQ-12), **02** (DK-21, DK-22, DK-24, DK-27, DK-28), 03 (SZ-21, SZ-22, SZ-24, Q11, Q14; chỉ đọc), 04 (§3.2 Z0–Z3, MH-OA-02, OA-31; chỉ đọc).

## Tổng hợp

| Kết quả (chính) | Số góp ý | Ghi chú |
|---|---|---|
| Đã sửa | 43 | Gồm 9 / 11 góp ý Chặn (KD #3, CS #4 có thêm một phần hỏi chủ dự án) |
| Hỏi chủ dự án | 4 | KD #1, KD #13, TT #2, TT #5 (đặc tả đã viết sẵn phương án, chạy theo mặc định tới khi chốt) |
| Chuyển designer | 2 | KD #15, CS #17 (ngoài ra 3 góp ý "Đã sửa" có thêm việc cho designer) |
| Chuyển file khác | 0 (chính) | 8 góp ý có phần phụ chuyển 01 / 03 / 04 (cột cuối) |
| Không làm | 0 (chính) | 3 phần nhỏ không làm, có lý do (KD #17 đổi tên menu, TT #3c, CS #17 phần nhắc) |
| **Tổng** | **49** | 11 Chặn: 9 Đã sửa, 2 Hỏi chủ dự án (KD #1 mobile MVP, TT #2 lưu dữ liệu trên điện thoại — đã đặc tả sẵn các phương án) |

## Sổ góp ý

| Nguồn | Mức | Tóm tắt | Kết quả | Chỗ sửa / lý do |
|---|---|---|---|---|
| P-KD #1 | Chặn | Mobile để GĐ2; không "+", không thông báo đẩy, không panel khách | **Hỏi chủ dự án** (Q-13) | MH-UI-11 viết lại với hai phương án (A) mobile rút gọn ở MVP / (B) giữ GĐ2, đánh dấu [A] từng mục; mặc định B; BA đề xuất A. Trùng 03 Q14 |
| P-KD #2 | Chặn | Tin trả lời bằng app Zalo ghi "Gửi ngoài VClinks", không tính KPI, không nói SLA | **Đã sửa** | §3.3a mới: tin của tài khoản kênh công ty gửi ngoài VClinks là **tin phản hồi** (dừng SLA, "Chờ khách", rời "Chưa trả lời", FRT); nhãn **"Gửi từ điện thoại"**; MH-UI-07 nhãn phụ; UAT-UI-93, 116. KPI cá nhân: 03 Q11 (đề xuất BA: tính như tin qua VClinks). Khớp 03 SZ-21, SZ-22; 04 OA-31 |
| P-KD #3 | Chặn | 15 phút thành "Tạm vắng", khách của mình có thể bị chia cho người khác; không tự về Trực tuyến | **Đã sửa** (một phần Hỏi Q-14) | MH-UI-05 viết lại: trạng thái **chỉ** ảnh hưởng chia khách mới, không bao giờ đổi owner; nick cá nhân luôn về người giữ nick (DK-21); kênh chính thức: CSKH **tạm giữ** rồi trả về owner (DK-24); thêm "Đi thị trường"; tự trở lại Trực tuyến khi có thao tác / mở lại trong ca / đầu ca sau; UAT-UI-89, 90, 91. "Đi thị trường" có tính trực tuyến với DK-24: Q-14 |
| P-KD #4 | Nên sửa | "Chưa trả lời" nằm trong "Lọc ▾"; phím chỉ có "chưa đọc kế tiếp" | Đã sửa | MH-UI-10 #3 `[Tất cả | Chưa đọc | Chưa trả lời]`; Alt+U "chưa trả lời gấp nhất" (§7.1); MH-UI-05 #11 "Gửi xong tự mở hội thoại chưa trả lời kế tiếp"; badge menu và R8 đổi sang "chưa trả lời"; UAT-UI-104 |
| P-KD #5 | Nên sửa | Không rõ chế độ ghi chú có tự về "Trả lời khách" | Đã sửa | Bỏ nút gạt chế độ; **khung ghi chú riêng** (MH-UI-08 #1, "Chống gửi nhầm ghi chú"): lưu xong khung tự đóng, con trỏ về ô trả lời khách; hỏi lại khi tin gửi khách có "@nhân viên"; UAT-UI-59, 98, 99 |
| P-KD #6 | Nên sửa | 1366×768 vùng đọc tin quá nhỏ | Đã sửa + designer | §1.8 thêm 1366×768 (≥ 6 bong bóng); §3.7 chế độ gọn khi cao ≤ 800 px; tiêu đề khung chat 2 dòng (MH-UI-07 #3); dòng gợi ý dưới ô soạn rút gọn / ẩn (MH-UI-08 #8) |
| P-KD #7 | Nên sửa | Dòng hội thoại quá nhiều chip; avatar phụ trách thừa ở "Của tôi"; nick hiện ID số | Đã sửa | MH-UI-10 #7: dòng 3 chỉ khi cần chú ý, ẩn avatar ở "Của tôi", chip SLA chỉ khi sắp quá / quá hạn; MH-UI-07 #5 tên nick không bao giờ là ID ("Nick chưa đặt tên"); §8.2 #16; UAT-UI-107 |
| P-KD #8 | Nên sửa | Không tắt được thông báo từng hội thoại | Đã sửa | MH-UI-03 quy tắc "Tắt thông báo một hội thoại" (1 giờ / tới 8:00 / luôn / chỉ khi @tôi); menu "⋯" MH-UI-07 #11 và chuột phải MH-UI-10 #9; loại Gấp không tắt được; UAT-UI-83 |
| P-KD #9 | Nên sửa | Biển số nhiều cách viết; tin "Đang chờ nội dung" không tìm được | Đã sửa | MH-UI-04 #3 chuẩn hóa (bỏ dấu, chấm, gạch, cách; `+84`→`0`; biển xe máy); trạng thái "Còn {n} tin Zalo chưa lấy nội dung…"; UAT-UI-86, 88 |
| P-KD #10 | Nên sửa | Mở hội thoại con trỏ không tự vào ô soạn | Đã sửa | MH-UI-07 "Cuộn và tải": con trỏ tự vào ô soạn (desktop), không mở bàn phím trên điện thoại; UAT-UI-96 |
| P-KD #11 | Nên sửa | ⌥↑/↓ trên Mac khi đang gõ nhảy sang khách khác | Đã sửa | §7.1: Alt+↑/↓, Alt+Shift+↓, Alt+U không có hiệu lực khi ô soạn đang có chữ; dòng hội thoại có "Nháp:" đỏ (MH-UI-10 #7) |
| P-KD #12 | Nên sửa | Gửi lỗi chỉ là toast 5 giây | Đã sửa | §5.4 loại "Lỗi gửi tin": thông báo nổi góc phải **không tự tắt**; ⚠ trên dòng; chấm đỏ menu Hội thoại (§2.2 badge); MH-UI-03 loại "Gửi lỗi"; khớp 03 SZ-24 |
| P-KD #13 | Nên sửa | Trạng thái hợp CSKH hơn; sale có phải bấm "Đã xong" | **Hỏi chủ dự án** (Q-18) | Đã ghi rõ "Đã xong" không bắt buộc, không tính gì (§3.3). Tự chuyển "Chờ khách" lâu ngày sang "Đã xong" là đổi nghiệp vụ trạng thái / báo cáo → Q-18 (đề xuất 7 ngày, theo division) |
| P-KD #14 | Nên sửa | Trên điện thoại tin nhiều dòng thành nhiều tin vụn | Đã sửa | MH-UI-08 bảng hành động: bấm ➤ trên điện thoại, kênh extension, ≥ 2 dòng → hỏi "Gộp thành 1 dòng" / "Vẫn gửi {n} tin"; UAT-UI-77 sửa |
| P-KD #15 | Gợi ý | Fanpage `#3B5998` và Zalo `#0068FF` đều xanh dương | **Chuyển designer** | §3.2 ghi yêu cầu chọn lại màu Fanpage; chip kênh luôn có icon cả cỡ `small`, huy hiệu kênh góc avatar bật mặc định (đã sửa trong đặc tả) |
| P-KD #16 | Gợi ý | Câu kỹ thuật "tiện ích", "tab Zalo Web" hiện mãi | Đã sửa | MH-UI-08 #8 rút gọn "Enter gửi · Shift+Enter xuống dòng · / mẫu câu"; đường gửi vào tooltip nút gửi / hộp xác nhận lần đầu; toast "Đang gửi {nội dung}…"; §8.2 #14, #15 |
| P-KD #17 | Gợi ý | Menu KD nhiều mục; "Gợi ý gộp hồ sơ", "Danh bạ kênh" khó hiểu | Đã sửa (một phần) | §2.2 quy tắc 4: "Gợi ý gộp hồ sơ" với KD chỉ hiện khi có gợi ý; tooltip "Danh bạ kênh". Menu đã tự thu gọn ở 1280–1439 px (1366 thuộc khoảng này). **Không làm** đổi tên "Danh bạ kênh" → "Kết bạn Zalo": trang còn chứa bạn bè và FB cá nhân, 03 dùng tên "Danh bạ" |
| P-KD #18 | Gợi ý | Panel không có ô tra giá / tồn nhanh | Đã sửa | MH-UI-09 #1 thêm tab "Tra hàng" (01 `erp.lookup`, F9.1) dùng chung mọi kênh; chi tiết ô tra ở 03 MH-SZ-07 |
| P-CS #1 | Chặn | CSKH không có "Chưa phân công", không "Nhận hội thoại này"; menu thiếu `/cskh` | **Đã sửa** (+ chuyển 04) | §2.1, §2.2 thêm "Hộp thư CSKH" `/cskh` (menu, route, badge, quy tắc 5: hai chế độ xem của cùng inbox); R3 CS → `/cskh`; MH-UI-10 #2 "Chưa phân công" cho CS theo 01 `conv.view_unassigned` = KÊNH; nút "Nhận" trên dòng (#10), menu chuột phải, MH-UI-07 #8 "Nhận hội thoại này" cho CS; khách có owner: "Của {owner}", chỉ "Xin nhận xử lý" (PQ-19); thông báo gộp "Khách chờ nhận"; UAT-UI-84, 103. Tên thống nhất "Chưa phân công" → 04 đổi "Chưa nhận" |
| P-CS #2 | Chặn | Danh sách, sắp xếp, thông báo không biết cửa sổ gửi | **Đã sửa** | §3.4a mới (OA Z0–Z3 như 04: 0–48h / 48h–7 ngày / > 7 ngày; Fanpage 24h + `HUMAN_AGENT` 7 ngày); UI-TP-17 chip cửa sổ; chip trên dòng chỉ khi sắp hết / có phí / hết (MH-UI-10 #7); nút nhanh "⏱ Sắp hết cửa sổ" (#3b); "Ưu tiên xử lý" tính cửa sổ (#5); loại thông báo "Sắp hết cửa sổ gửi" (Gấp, không tắt được); UAT-UI-85, 105 |
| P-CS #3 | Chặn | Ghi chú và tin gửi khách chỉ khác một nút gạt; từ lần 2 không hỏi | **Đã sửa** | Như KD #5: khung ghi chú riêng viền vàng, dải "🔒 GHI CHÚ NỘI BỘ — KHÁCH KHÔNG THẤY", nút "Lưu ghi chú" vàng có chữ, Enter xuống dòng / Ctrl+Enter lưu; nút gửi có chữ "Gửi"; tin có "@nhân viên" luôn bị hỏi lại; UAT-UI-98, 99 |
| P-CS #4 | Chặn | Tìm SĐT gần như vô dụng vì phạm vi CS hẹp; không nhận `0912.345.678` | **Đã sửa** (một phần Hỏi Q-17) | MH-UI-04: phạm vi CS theo 01 D3 (mọi hội thoại trên kênh chính thức mình trực + ticket), chuẩn hóa SĐT; §1.6 sửa phạm vi CS; UAT-UI-87. "Thẻ tối thiểu" cho khách ngoài phạm vi là ngoại lệ của 01 PQ-03 → Q-17 |
| P-CS #5 | Nên sửa | CS không thấy trạng thái đơn gần nhất | Đã sửa (+ chuyển 01) | MH-UI-09 quyền: CS thấy "Đơn gần nhất" (không công nợ, hạng, giá) với khách gắn ticket của mình, theo 01 `cust.commerce` "Đơn hàng: TK"; UAT-UI-65. Mở rộng cho mọi khách trên kênh trực: chuyển 01 |
| P-CS #6 | Nên sửa | Không biết ai vừa nói chuyện với khách; chip kênh ngoài phạm vi ra 403 | Đã sửa | MH-UI-09 #8b khối "Liên lạc gần đây" (kênh, người, giờ, không nội dung, trong division); dòng ngoài phạm vi khóa với tooltip; UAT-UI-102 |
| P-CS #7 | Nên sửa | Chuông kêu liên tục, SLA bị chìm, không lọc theo loại | Đã sửa | MH-UI-03: tab "Gấp", hai âm (đóng câu hỏi mở 11), gộp "Khách chờ nhận" 5 phút; MH-UI-05 #10a "Tin mới báo khi"; UAT-UI-82, 84 |
| P-CS #8 | Nên sửa | Chip SLA xanh trên mọi dòng, quá dài, không rõ hạn đầu / tiếp | Đã sửa | §3.4: dạng ngắn cho danh sách ("⏰ 3′", "Quá 8′"), không hiện khi còn hạn / tạm dừng; tooltip "Hạn phản hồi đầu / tiếp"; UI-TP-03 |
| P-CS #9 | Nên sửa | Màu kênh trùng màu cảnh báo và trạng thái | Đã sửa (quy tắc) + designer | §3.1 ba kiểu chip Nhạt / Viền / Đặc; §3.2 Email bỏ đỏ, Bình luận bỏ cam, icon luôn có; §3.3 bỏ tím cho "Chờ khách"; mã màu cụ thể do designer chọn |
| P-CS #10 | Nên sửa | "Đang được … trả lời" có ✕, bấm rồi quên | Đã sửa | Theo 02 DK-27, DK-28: dải cấp khách, **bỏ ✕**, có "Tôi xử lý tiếp", tự hết theo khóa; luôn hỏi trước khi gửi, nút gửi đổi chữ khi người giữ khóa là người phụ trách (MH-UI-07 dải 4, MH-UI-08 "Chống trả lời trùng", §7.2); đóng câu hỏi mở 7; UAT-UI-49, 100 |
| P-CS #11 | Nên sửa | Alt+↓ lặp / bỏ sót do danh sách tự sắp lại; không có phím "gấp nhất" | Đã sửa | MH-UI-10 "Thứ tự và cập nhật": đóng băng thứ tự khi duyệt bằng phím (5 giây); Alt+U; UAT-UI-106 |
| P-CS #12 | Nên sửa | Toast gửi lỗi không nói hội thoại nào, dòng không có dấu | Đã sửa | Như KD #12; `ERR-SEND` có tên hội thoại, hướng dẫn, mã tham chiếu (§6.1) |
| P-CS #13 | Nên sửa | Câu lỗi "Liên hệ Admin" không nói ai, trong lúc chờ làm gì | Đã sửa | MH-UI-06 nút "Báo Admin" dùng chung (tự kèm mã, kênh, màn hình); `CH-DOWN` thêm dòng "Trong lúc chờ…"; kênh API mất kết nối: không xếp hàng, giữ nháp (MH-UI-08 vùng chặn; sửa mâu thuẫn với dải ưu tiên 1 cũ); UAT-UI-101 |
| P-CS #14 | Nên sửa | Không rõ @nhắc được ai, người được nhắc có mở được không | Đã sửa (+ chuyển 01, Q-19) | MH-UI-08 "Ai được @nhắc": chỉ gợi ý người xem được hội thoại (01 PQ-03), owner / người phụ trách lên đầu. Tự cấp quyền đọc khi được @: chuyển 01 |
| P-CS #15 | Nên sửa | Hết ca còn hội thoại dở về ai; SLA theo lịch nào, nghỉ trưa | Đã sửa | MH-UI-05 hộp "Còn {n} hội thoại đang xử lý" (Trả về hàng chung / Giữ lại) chỉ cho hội thoại không gắn owner khách; §3.4 SLA theo lịch làm việc division (có nghỉ trưa); dòng sự kiện mới; UAT-UI-92 |
| P-CS #16 | Gợi ý | Danh sách không cho biết hội thoại có nháp | Đã sửa | MH-UI-10 #7 "Nháp: …" chữ đỏ |
| P-CS #17 | Gợi ý | Chip "Mới" / "Đang xử lý" khó phân biệt; muốn "Tôi sẽ quay lại" + nhắc | **Chuyển designer** (phần nhắc: Không làm MVP) | §3.3 đổi sang kiểu Viền có icon, designer chốt màu. "Giữ Đang xử lý + nhắc sau 15′/30′" cần Việc cần làm (GĐ2, `MH-DK`); ghi backlog GĐ2 |
| P-TT #1 | Chặn | Màn thông tin khách trên điện thoại chỉ là phác thảo; desktop thiếu khiếu nại | **Đã sửa** (thuộc phương án A) | MH-UI-11 bảng thành phần #M1–#M8 (khiếu nại mở có nội dung, công nợ + hạn + giờ lấy, 5 tin gần nhất bấm được, ghi chú NVKD, địa chỉ + Chỉ đường, SĐT + gọi); MH-UI-09 #8a "Khiếu nại mở"; UAT-UI-108, 113 |
| P-TT #2 | Chặn | Mất mạng thì trắng trang; muốn tải sẵn khách tuyến | **Hỏi chủ dự án** (Q-16) | Lưu dữ liệu khách trên điện thoại liên quan NĐ 13 → hỏi. Đặc tả sẵn MH-UI-11 #M10 (bản lưu khách đã mở trong 24 giờ, ≤ 30 khách, xóa khi đăng xuất; tải sẵn tuyến GĐ2); UAT-UI-109 |
| P-TT #3 | Chặn | Tin "Đang chờ gửi" không giờ, không hủy, không báo | **Đã sửa** (phần c Không làm) | MH-UI-08 dải cam "Nick {tên} đang tắt…" ngay trên ô nhập (a); MH-UI-07 "Đang chờ gửi từ {HH:mm} · Hủy gửi" (b); chờ > 5 phút thông báo Gấp + rung (d); UAT-UI-94, 95. (c) "Bỏ nếu chưa gửi sau 10 phút" từng tin: **Không làm** — dùng hạn lệnh chờ chung của 03 (Q1) + hủy tay, tránh thêm lựa chọn trên ô soạn |
| P-TT #4 | Chặn | Báo lại NVKD phải chuyển ô soạn sang ghi chú, dễ nhầm | **Đã sửa** | MH-UI-11 #M7 nút "📝 Báo NVKD": sheet riêng, gắn sẵn @owner, 3 mẫu nhanh, không có đường ra khách; khung ghi chú riêng ở MH-UI-08; UAT-UI-111 |
| P-TT #5 | Nên sửa | Phiên 12 giờ; chọn nhầm Gmail; token vô dụng trên điện thoại | **Hỏi chủ dự án** (Q-2, một phần Đã sửa) | MH-UI-02 "Trên điện thoại": ẩn token, `prompt=select_account` + `login_hint` (đã sửa); ghi nhớ điện thoại 30 ngày → Q-2. Đăng nhập một lần từ VCdms: ghi cho tích hợp VCdms GĐ2 (cả hai dùng Google Workspace nên chỉ còn bước chọn tài khoản) |
| P-TT #6 | Nên sửa | Nháp có còn khi tab tự tải lại, phiên hết hạn | Đã sửa | MH-UI-08 #6: nháp còn qua tải lại, mở lại trình duyệt, đăng nhập lại cùng người (7 ngày); xóa khi đăng xuất chủ động (có hỏi); MH-UI-02; UAT-UI-81, 114 |
| P-TT #7 | Nên sửa | Trang mặc định TT là "Của tôi" gần như trống | Đã sửa (GĐ2) | R3 + MH-UI-11 #M9 "Khách tuyến hôm nay" là trang mặc định của TT trên điện thoại khi có dữ liệu VCdms (GĐ2, F9.10–F9.13) |
| P-TT #8 | Nên sửa | Bấm thông báo mở khung chat, phải bấm thêm ⓘ | Đã sửa | MH-UI-03 "Điện thoại": nút "Xem khách" trên dòng thông báo; MH-UI-11 |
| P-TT #9 | Nên sửa | Chữ 11–12 px không đọc được ngoài nắng | Đã sửa | §3.7 mobile: nội dung 15 px, chip ≥ 13 px, số tiền / hạn không dùng `--muted`, công nợ 16 px đậm; §1.8 lượt đọc ngoài trời; UAT-UI-113 |
| P-TT #10 | Nên sửa | Nút ←, ✕ ở góc trên trái, khó với một tay | Đã sửa + designer | MH-UI-11 quy tắc 3: chạm tên khách mở thông tin, ⓘ mép phải, vuốt mép trái quay lại, vuốt xuống đóng; vị trí cụ thể designer vẽ |
| P-TT #11 | Gợi ý | Mẫu câu hay dùng phải gõ "/" | Đã sửa (phần chọn số phút chuyển 03) | MH-UI-11 quy tắc 4: 3 mẫu hay dùng nhất thành chip khi ô trống. Mẫu có nút chọn nhanh 5 / 10 / 15 / 30 phút: chuyển 03 (mẫu câu) |
| P-TT #12 | Nên sửa | Không rõ trang nào chạy trên điện thoại | Đã sửa | MH-UI-11 quy tắc 6 liệt kê trang chạy mobile; "Mở 360 đầy đủ" bản dọc |
| P-TT #13 | Gợi ý | Hiệu năng chỉ đo trên máy văn phòng | Đã sửa | §7.4 thêm mục tiêu điện thoại 4G yếu (≤ 5 giây; bản lưu ≤ 1 giây); UAT-UI-115 |
| P-TT #14 | Gợi ý | Có mạng lại chỉ hiện dải 3 giây | Đã sửa | §6.3 `RT-BACK`: còn tin chưa gửi / lỗi thì để lại thông báo ở chuông; MH-UI-03 loại "Tin chưa gửi do mất mạng"; UAT-UI-110 |

### Kịch bản UAT người dùng đề xuất → mã chính thức

| Đề xuất | Mã trong đặc tả |
|---|---|
| UAT-UI-KD-01 | UAT-UI-93 |
| UAT-UI-KD-02 | UAT-UI-89 |
| UAT-UI-KD-03, KD-04 | UAT-UI-98, 99 (gộp với CS) |
| UAT-UI-KD-05 | Tiêu chí §1.8 (1366×768, ≥ 6 bong bóng); designer kiểm trên canvas |
| UAT-UI-KD-06 | UAT-UI-86 |
| UAT-UI-KD-07 | UAT-UI-104 |
| UAT-UI-KD-08 | UAT-UI-83 |
| UAT-UI-KD-09 | UAT-UI-112 |
| UAT-UI-KD-10 | UAT-UI-117 (gộp với P-CS đề xuất 86) |
| UAT-UI-KD-11 | §7.1 (điều kiện Alt+↑/↓); thêm vào bộ hồi quy phím tắt |
| UAT-UI-80 … 89 (P-CS) | Đánh lại số vì trùng dải: 80→103, 81→105, 82→98, 83→99, 84→87, 85→82, 86→117, 87→100, 88→106, 89→92 |
| UAT-UI-TT-01 … 10 | TT-01→108, TT-02→109, TT-03→115, TT-04→110, TT-05→94, TT-06→111, TT-07→113, TT-08→114, TT-09→112, TT-10→80 + Q-2 |

### Câu hỏi của người dùng → trả lời trong đặc tả

| Câu hỏi | Trả lời |
|---|---|
| KD Q1 (tin từ app Zalo có dừng SLA, có tính đã trả lời) | Có (§3.3a). KPI cá nhân: 03 Q11 |
| KD Q2 (vắng bao lâu thì bị chia khách) | Không bao giờ đổi owner vì vắng (MH-UI-05); kênh chính thức CSKH tạm giữ sau 15 phút rồi trả về (02 DK-24) |
| KD Q3 (đọc trên VClinks có làm khách thấy "Đã xem") | Thuộc 03 (SZ-15, SZ-23) |
| KD Q4 (bắt buộc "Đã xong"?) | Không (§3.3); tự đóng: Q-18 |
| KD Q5, TT Q3 (thông báo trên điện thoại) | Phương án A: có Web Push (MH-UI-03); phương án B: không |
| KD Q6, TT Q5 (SĐT khách của mình) | Owner, người giữ nick, NV thị trường (tuyến) luôn thấy đủ, không bấm "Hiện" (01 D6). Tìm SĐT vẫn ghi `search_phone` để truy vết, không phải cảnh báo |
| CS Q1 (trực ở `/conversations` hay `/cskh`) | `/cskh` là trang trực mặc định; hai trang là hai chế độ xem của cùng inbox (§2.2 quy tắc 5) |
| CS Q2 (bình luận xử lý ở đâu) | Chuyển 05 |
| CS Q3 (@nhắc sale không xem được) | Không gợi ý người không xem được; Q-19 / 01 |
| CS Q4 (SLA đầu hay tiếp; tin tự động) | Tooltip ghi rõ; tin tự động không tính phản hồi (§3.3a, khớp 04 OA-31) |
| CS Q5 (biết "có nhưng ngoài phạm vi") | Q-17 |
| CS Q6 (xem lại tin gửi lỗi trong ca) | Tab "Gấp" + hàng lệnh gửi 03 MH-SZ-13 |
| TT Q1 (tin đi từ nick nào) | Kênh được gán cho chính NV thị trường (01 PQ-26); MH-UI-11 quy tắc 8 |
| TT Q2 (thông báo khách tuyến) | Loại "Khách tuyến nhắn" (GĐ2, bật / tắt được) |
| TT Q4 (báo lại sau ghé ở đâu) | Trên VClinks: "Báo NVKD" (#M7). Check-in VCdms: GĐ2 |
| TT Q6 ("Tạm vắng" có ảnh hưởng) | Không ảnh hưởng khách cũ; dùng "Đi thị trường" |

## Câu hỏi cho chủ dự án

Đánh số theo §9 của đặc tả. Mỗi câu có phương án và đề xuất BA; đặc tả chạy theo "Mặc định tới khi chốt".

| # | Câu hỏi | Phương án | Đề xuất BA | Mặc định tới khi chốt |
|---|---|---|---|---|
| Q-13 | Mobile ở MVP? (trùng 03 Q14) | **(A)** Mobile rút gọn ở MVP: thông báo đẩy, "Của tôi" + "Chưa trả lời", gửi chữ / ảnh / STK / mẫu câu, gọi, 360 rút gọn, "Báo NVKD", xử lý mất mạng · **(B)** Giữ GĐ2; MVP chỉ bảo đảm tin trả lời từ app Zalo được tính và dừng SLA | **A** — 3 vai trò chặn ở cùng điểm; Zalo gửi qua extension nên điện thoại chỉ cần web; tránh số liệu lệch giữa hai nơi | B |
| Q-2 | Thời hạn phiên trên điện thoại | (a) 12 giờ như máy tính · (b) "Ghi nhớ điện thoại này 30 ngày" cho KD, TT, GS, thu hồi được, khóa tài khoản là hủy ngay | (b) | (a) |
| Q-14 | Owner "Đi thị trường" có tính là trực tuyến với 02 DK-24? | (a) Tính như Tạm vắng: sau 15 phút CSKH tạm giữ hội thoại bán hàng trên OA / Fanpage (không nêu giá), owner được báo, về lại owner khi owner trực tuyến · (b) Tính là trực tuyến: owner tự trả lời trên điện thoại | (a) nếu chọn B ở Q-13; (b) nếu chọn A | (a) |
| Q-16 | Lưu bản 360 rút gọn trên điện thoại để xem khi mất mạng? | (a) Không lưu · (b) Lưu khách đã mở trong 24 giờ, ≤ 30 khách, xóa khi đăng xuất, không lưu ảnh / file · (c) (b) + tự tải sẵn "khách tuyến hôm nay" | (b) ở MVP-A, (c) ở GĐ2 cùng VCdms | (a) |
| Q-17 | CSKH tìm đúng đủ SĐT khách ngoài phạm vi có thấy thẻ tối thiểu? (ngoại lệ 01 PQ-03) | (a) Không, giữ PQ-03 · (b) Thẻ: tên, người phụ trách, ticket đang mở, nút "Báo người phụ trách" / "Tạo ticket"; không nội dung, không thương mại; ghi `search_phone` | (b) — khách gọi hotline là việc hằng ngày của CSKH | (a) |
| Q-18 | Tự chuyển "Chờ khách" lâu ngày sang "Đã xong"? | (a) Không · (b) Sau N ngày khách im (mặc định 7), GĐ cấu hình theo division, dòng sự kiện "Tự đóng sau {N} ngày khách không nhắn" | (b) | (a) |
| Q-15 | Ngưỡng cảnh báo cửa sổ Fanpage | "Sắp hết" còn 2 giờ / "rất gấp" 30 phút, hay số khác | 2 giờ / 30 phút, Admin sửa được | 2 giờ / 30 phút |
| (03 Q11) | Tin "Gửi từ điện thoại" có tính vào KPI cá nhân? | (a) Tính như tin qua VClinks, báo cáo tách cột để xem · (b) Chỉ tính tin qua VClinks | (a) — nhãn không mang nghĩa trừ điểm | Chờ 03 |

## Việc cho designer

1. **Màu và chip** (§3.1–§3.3): dựng ba kiểu chip Nhạt (kênh) / Viền (trạng thái, tag) / Đặc (cảnh báo). Chọn lại màu Email (bỏ đỏ), Bình luận (bỏ cam), Fanpage (tách khỏi xanh Zalo), tách OA với Web và với xanh "còn hạn"; trạng thái "Mới" / "Đang xử lý" / "Chờ khách" / "Đã xong" kiểu Viền có icon, không dùng xanh dương / tím. Kiểm tương phản ≥ 4,5:1 cả sáng và tối. Phối hợp 04 đổi màu Z2 (tím).
2. **Ô soạn và ghi chú** (MH-UI-08): nút "🔒 Ghi chú" nền vàng cuối thanh công cụ; khung ghi chú đè trên ô soạn (viền vàng 2 px, dải vàng đặc chữ in đậm, nút "Lưu ghi chú" vàng có chữ); nút gửi có chữ "Gửi"; dải cam "Nick … đang tắt" ngay trên ô nhập; vùng chặn CS "Hội thoại của khách … phụ trách".
3. **Khung chat 1366×768** (MH-UI-07, §3.7): tiêu đề 2 dòng, chế độ gọn (header 48 px, 1 dải cảnh báo), chứng minh ≥ 6 bong bóng; bong bóng "Gửi từ điện thoại", "Đang chờ gửi từ {HH:mm} · Hủy gửi", "Đã hủy"; dải khóa trả lời không có ✕, có "Tôi xử lý tiếp".
4. **Danh sách hội thoại** (MH-UI-10): segmented `[Tất cả | Chưa đọc | Chưa trả lời]`, nút "⏱ Sắp hết cửa sổ", dòng 3 có điều kiện, chip SLA / cửa sổ dạng ngắn, "Nháp:" đỏ, ⚠ gửi lỗi, 🔕, nút "Nhận" khi rê chuột, "Của {owner}"; vẽ cả "Của tôi" và "Chưa phân công".
5. **Thông báo** (MH-UI-03, §5.4): tab "Gấp"; thông báo nổi "Lỗi gửi tin" góc phải không tự tắt; menu "Tắt thông báo ▸".
6. **Trạng thái online** (MH-UI-01 #9, MH-UI-05): thêm "Đi thị trường" (icon xe), hộp chọn thời hạn, dải "Bạn đang Ngoại tuyến…", hộp "Còn {n} hội thoại đang xử lý".
7. **Panel phải** (MH-UI-09): tab "Tra hàng", khối "Khiếu nại mở", "Liên lạc gần đây" (dòng khóa), khối Thương mại rút gọn cho CS (chỉ đơn hàng).
8. **Mobile** (MH-UI-11): vẽ theo phương án A (đánh dấu rõ phần A); màn thông tin khách #M1–#M8 theo thứ tự, sheet "Báo NVKD", chip 3 mẫu câu trên ô soạn, vị trí ⓘ tầm ngón cái, vuốt xuống đóng, dải "Bản lưu lúc …", dòng thông báo có "Xem khách", trang "Khách tuyến hôm nay" (GĐ2). Cỡ chữ theo §3.7 mobile.
9. **Trang lỗi**: nút "Báo Admin" trên MH-UI-06, UI-TP-14, dải `CH-DOWN`.

## Việc chuyển file khác

| File | Việc | Nguồn góp ý |
|---|---|---|
| **01 phân quyền** | (1) Thêm `search_phone` vào danh sách nhật ký bắt buộc PQ-38 (00 ghi mọi lần tìm đủ SĐT). (2) Xem mở rộng `cust.commerce` "Đơn hàng" của CS từ `TK` sang `KÊNH`. (3) Q-19: người được @nhắc có tự được quyền đọc hội thoại không. (4) Q-17: ngoại lệ PQ-03 cho thẻ tối thiểu khi CS tìm đủ SĐT. (5) Thiết bị điện thoại ghi nhớ 30 ngày (Q-2) ở MH-PQ-03 / MH-PQ-08 và PQ-33. (6) Trạng thái "Đi thị trường" và lịch làm việc division (có nghỉ trưa) ở màn "Chia hội thoại & SLA". (7) Người nhận nút "Báo Admin" theo division | CS #4, #5, #14, #15; TT #5; KD #3 |
| **02 khách đa kênh** | (1) DK-24: định nghĩa "owner offline" = không ở "Trực tuyến" quá 15 phút trong giờ làm (Tạm vắng / Đi thị trường / Ngoại tuyến), kèm Q-14. (2) Khối "Liên lạc gần đây" của panel 00 (MH-UI-09 #8b) khớp với "Khách đang hoạt động" của MH-DK. (3) "Mở 360 đầy đủ" có bản dọc cho điện thoại. (4) Dòng sự kiện "tạm giữ / trả về owner". (5) Việc cần làm "nhắc quay lại sau 15′ / 30′" (GĐ2, CS #17). (6) Nhận đặc tả Báo cáo (câu hỏi mở 5) | KD #3; CS #6, #17; TT #12 |
| **03 sale Zalo cá nhân** | (1) Đổi nhãn SZ-22 `Gửi ngoài VClinks · điện thoại` → **"Gửi từ điện thoại"** theo 00 §3.3a; SZ-21 giữ nguyên. (2) 03 Q14 trùng 00 Q-13, chốt chung. (3) Q11 (KPI) giữ ở 03, đề xuất BA ghi ở 00 §3.3a. (4) Tab "Tra hàng" MH-SZ-07 là thành phần dùng chung mọi kênh ở panel 00. (5) Mẫu câu có biến chọn nhanh ("Em tới sau {5/10/15/30} phút"). (6) Hạn lệnh chờ (Q1) dùng cho tin "Đang chờ gửi" của 00, thay lựa chọn hạn từng tin (TT #3c). (7) Thông báo gửi lỗi SZ-24 khớp §5.4 "Lỗi gửi tin" | KD #2, #18; TT #3, #11 |
| **04 CSKH Zalo OA** | (1) Đổi tên hàng "Chưa nhận" → **"Chưa phân công"** (MH-OA-02 #2, #14, UAT-OA-82) cho thống nhất với 00, 01, BA F2.5. (2) Menu: "Hộp thư CSKH" nằm trong nhóm LÀM VIỆC của 00 (thay nhóm "CSKH" đề xuất ở 04 §5); trang mặc định CS là `/cskh`. (3) Đổi màu Z2 "Có phí" khỏi tím (§3.1 00). (4) Tin gửi từ trang quản lý OA: nhãn "Gửi từ trang quản lý OA" (00 §3.3a), báo cáo giữ dòng `Trả lời ngoài VClinks` (OA-31). (5) Thông báo "Tin mới" của hàng chưa phân công dùng loại gộp "Khách chờ nhận" 5 phút của 00. (6) Trên danh sách chuẩn `/conversations` chip khung gửi chỉ hiện khi sắp hết / có phí / hết; `/cskh` giữ dòng khung gửi luôn hiện | CS #1, #2, #7, #9 |
| **05 marketing, chatbot** | (1) Ngưỡng cảnh báo cửa sổ Fanpage (Q-15) và câu chữ vùng `HUMAN_AGENT` / hết cửa sổ cho §3.4a. (2) Bình luận Fanpage xử lý ở `/comments` hay trong danh sách hội thoại (CS Q2). (3) Màu chip "Bình luận" mới. (4) Mã kênh `web_chat` | CS #2, #9; CS Q2 |
| **06-hoa-don-cong-no.md** (sẽ viết) | Kế toán không mở hội thoại (01 D11): gửi hóa đơn / nhắc nợ từ trang Yêu cầu hóa đơn `/invoice-requests`; đặc tả trang này (câu hỏi mở 5); 00 đã bỏ KT khỏi Hội thoại, ô soạn, panel | Khớp 01 (không từ góp ý) |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/00-xu-ly.md) | — |
