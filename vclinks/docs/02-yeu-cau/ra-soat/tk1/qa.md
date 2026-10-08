# QA thiết kế lô D1 — bước 7

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

> Người rà: agent QA. Ngày 29/09/2026.
> Canvas: "VClinks UI Design" (https://claude.ai/artifact/8cAKkTjtb94BTCWFoErv1p), bản đang phát hành `1790646865-0fd6` (bản 4 vai lượt 3 đã rà là "bản 11"). Chỉ đọc, không sửa canvas.
> Phạm vi D1: 4 hàng có nhãn "D1" trên canvas: Sale Zalo cá nhân + giám sát (03), CSKH OA + Fanpage (04, 02), Quản trị tổ (01), Quản trị của Admin (01). Cộng khung chung 00, dải công nợ và ghi chú thu nợ của 06.
> Đối chiếu: 00 v1.3, 01 v1.2+, 02 v1.3, 03 v1.2, 04 v1.3, 06 v1.1 (HD-55, HD-56, MH-HD-04), `review/dac-ta-vong-1/thong-nhat.md`, 4 file góp ý lượt 3 (không lặp lại chỗ họ đã nêu, trừ khi đó là quy tắc then chốt hoặc cần để chốt), code `apps/web/src`.
> Lưu ý phạm vi: 00 §2 và các file đặc tả **không có danh sách màn chính thức cho lô D1**. QA lấy theo các hàng D1 của canvas. BA cần chốt danh sách này, xem [Màn D1 thiếu](#màn-d1-thiếu).

## Tóm tắt

**Số lỗi:** 2 Nghiêm trọng · 14 Trung bình · 13 Nhẹ trong bảng lệch đặc tả, cộng 18 chỗ lệch dữ liệu mẫu (6 ở mức Trung bình, ảnh hưởng tới UAT).

**Lấy mẫu:** 66 điểm đối chiếu (nhãn nút, câu thông báo, chip, câu chặn, route/menu, quyền theo vai, trạng thái). 37 điểm khớp, 29 điểm lệch. Phần khớp tốt:
- Toàn bộ câu dải khung gửi OA Z1 (3 mức), Z2 (bật và tắt phí), Z3, Z0 khớp nguyên văn 04 §3.2. Hộp xác nhận "Gửi tin tư vấn có phí?" cũng khớp.
- Câu Fanpage 24 giờ và `HUMAN_AGENT` khớp.
- Chống gửi trùng khớp SZ-28: `Sao chép và bỏ lệnh`, hỏi `Gửi ngay / Bỏ lệnh`, cảnh báo trùng tin điện thoại, `Quá hạn — chưa gửi`.
- Dải trả lời thay / trực thay, nhãn `Gửi bởi … (trả lời thay …)`, `Gửi từ điện thoại`, nick đỏ khóa thanh công cụ và nút Gửi đều khớp.
- Cả 4 nơi trình bày đúng quy tắc `Cần duyệt lại` không có `Thử lại`.
- Câu và nút của Danh tính chưa xác nhận khớp. Chia đều bỏ người Nghỉ phép.
- Phần [Đã có] (thanh công cụ Zalo, nhãn thu hồi, trang Đồng bộ, trạng thái tin) khớp code `ComposerTools.tsx`, `MessageBubble.tsx`, `OutboxBubble.tsx`, `SyncPage.tsx`.

**Nhận định: chưa chốt D1 được.** Cần một lượt hoàn thiện ngắn của designer, không phải làm lại. Việc phải xong trước khi chuyển dev:
1. Hai lỗi Nghiêm trọng (#1, #2): chưa thể hiện được hai quy tắc then chốt. Cụ thể: CSKH không được thấy lối gửi qua nick cá nhân; nick "Chưa an toàn" không gửi được.
2. Thống nhất một bộ dữ liệu mẫu cho khách "Garage Minh Phát / Anh Tuấn" và cho trạng thái Nick Tú (xem mục Dữ liệu mẫu lệch). Nếu không, không viết được ca UAT xuyên màn.
3. Vẽ các màn D1 còn thiếu mà UAT cần ngay. Ít nhất gồm: MH-PQ-11 "Không có quyền", MH-OA-07 Ticket của tôi, Lệnh gửi phạm vi "Tổ của tôi", form Thêm người và các tab của MH-PQ-03, nick "Chưa an toàn" trong khung chat.
4. Sửa chữ của chip SLA và chip khung gửi trên `/cskh` cho đúng một bộ chữ ở 00 §3.4, §3.4a (#6, #7). Dev sẽ chép nguyên chữ trên canvas.
5. BA chốt danh sách màn của lô D1. Hiện D1 và D2 lẫn nhau: Danh bạ (11) ghi D2 nhưng P-KD đã rà như D1; Tìm kiếm (6) ghi D2 nhưng Ctrl K nằm trên header mọi màn D1.

## Mục lục

- [Màn D1 thiếu](#màn-d1-thiếu)
- [Lệch đặc tả](#lệch-đặc-tả)
- [Quy tắc then chốt](#quy-tắc-then-chốt)
- [Dữ liệu mẫu lệch](#dữ-liệu-mẫu-lệch)
- [Sẵn sàng cho UAT](#sẵn-sàng-cho-uat)
- [Việc cho designer (lượt hoàn thiện)](#việc-cho-designer-lượt-hoàn-thiện)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## Màn D1 thiếu

**Màn có trên canvas và mã MH đúng:** 1 (MH-SZ-01/03/05/07), 1a (MH-SZ-03/04), 1b (MH-SZ-05, 05a–h, 06), 1c (MH-OA-03/04), 1d (MH-SZ-01 GS), 1e (MH-SZ-12a, 13), 1f (MH-OA-02/03/04), 1g (MH-OA-05/06), 1h (MH-DK-09A/09B), 2 (MH-SZ-05i), 3 (MH-DK-01), 8 (`/channels`), 9 (MH-PQ-01/02), 9a (MH-PQ-04), 9b (MH-PQ-07), 10 (MH-PQ-02), 10a (MH-PQ-03/15), 10b (MH-PQ-06/08), 10c (MH-PQ-14/10), 10d (MH-PQ-13/01), 10e (MH-SZ-12b).

**Gắn mã chưa đúng hoặc thiếu mã:**
- Màn 8 "Kênh kết nối" ghi `/channels · D1` và "MH-OA-01 · MH-SZ-12b". Nội dung chính là danh sách mọi kênh; theo 00 §2.2, màn này "chưa có màn chung". Cần BA đặt mã cho màn khung (hoặc ghi rõ "khung theo code"). MH-SZ-12b đã có riêng ở 10e.
- Màn 9 ghi "MH-PQ-01/02" nhưng nội dung là góc nhìn giám sát. Bảng "Chia hội thoại" thuộc `/settings/routing`, đặc tả chưa có màn. Khối "SLA và giờ làm việc" thuộc MH-OA-18. Nên tách hoặc ghi mã từng khối.
- Màn 1c ghi "MH-OA-03/04" nhưng có cả biến thể Fanpage. Chủ quản khung gửi Fanpage là 05 §2.2a (thống nhất #22), cần ghi thêm mã 05.

**Màn / trạng thái D1 còn thiếu** (xếp theo mức cần cho UAT):

| # | Màn (mã) | Vì sao thuộc D1 | Mức |
|---|---|---|---|
| M1 | **MH-PQ-11** "Không có quyền" dạng A (trang), B (đối tượng, "Không tìm thấy hoặc bạn không có quyền xem"), C (nút khóa + tooltip), D (mất quyền khi đang mở) | 00 R4, R7, R9 và mọi file 03, 04 trỏ về đây. UAT phân quyền của D1 đều cần | Cao |
| M2 | Khung chat / ô soạn / Lệnh gửi của **nick "Chưa an toàn"** (03 QT-SZ-11 bước 3a: dải đỏ + `Xác nhận đã đăng xuất`; MH-SZ-13 #6a `Duyệt lại` mờ) | Quy tắc then chốt (xem #2) | Cao |
| M3 | **MH-OA-07 Ticket của tôi** (`/tickets`) | Menu Ticket có ở mọi vai D1; P-CS đã nêu từ lượt 1 (L1-6). Màn 5 "Việc cần làm" đang "chưa rà" và vẽ theo góc nhìn sale | Cao |
| M4 | **MH-SZ-13 dạng trang** phạm vi `Tổ của tôi` (cột NVKD, lọc #1a), rỗng `Không có lệnh nào.`, lỗi tải; hộp `Duyệt lại` (#6a); Popconfirm `Bỏ lệnh này? Tin sẽ không được gửi.` | GS và Lệnh gửi là mục menu D1 (00 §2.2); P-GS L2-3 | Cao |
| M5 | **MH-PQ-03**: form `/admin/users/new`, tab "Vai trò & vị trí" (có "Chờ duyệt – Kiểm soát"), tab "Kênh được gán" | P-AD #1; việc hằng tuần của Admin | Cao |
| M6 | MH-UI-03 Trung tâm thông báo (drawer chuông) | Chuông có trên mọi màn D1; các thông báo D1 (Nick kết nối lại, Gửi lỗi, Khách chờ nhận, quá SLA) chưa có chỗ mở | Trung bình |
| M7 | MH-UI-05 Hồ sơ cá nhân / dropdown trạng thái (4 giá trị, hỏi thời hạn khi chọn "Đi thị trường"/"Vắng", cờ Nghỉ phép) | Trạng thái quyết định chia khách và tạm giữ (thống nhất #2). Canvas chỉ vẽ chữ "Trực tuyến" | Trung bình |
| M8 | Ô soạn OA chế độ **tạm giữ** (chỉ `Select` mẫu `/giu-khach`, dòng phụ `Đang tạm giữ khách của {owner}…`), banner 5a `Owner chưa trả lời {n}′` + `Gửi câu giữ khách` (02 MH-DK-09 #5a, 04 MH-OA-04) | P-CS #3 lượt 2 vẫn "sửa chưa đủ"; UAT-OA-142/145 | Trung bình |
| M9 | Fanpage **"Hết cửa sổ" (> 7 ngày)**, chip `Chỉ hỗ trợ`, `Hết cửa sổ` (00 §3.4a, 05 §2.2a) | Khung gửi Fanpage là quy tắc then chốt của lô | Trung bình |
| M10 | MH-PQ-13 phiếu **Xuất** và tab **Thời hạn lưu trữ** (`/privacy-requests?tab=retention`); dòng "chặn nạp lại" | P-AD #2, #5; mục menu Admin D1 | Trung bình |
| M11 | MH-PQ-14 tab **Quy tắc** | Mục menu D1; P-AD lượt 3 ghi chưa vẽ | Nhẹ |
| M12 | MH-OA-18 `/settings/sla` (bảng SLA ticket theo loại × ưu tiên) | Mục menu D1 của GĐ/GS/AD (👁); P-CS L1-17 | Nhẹ |
| M13 | MH-DK-11 Xung đột owner / duyệt yêu cầu chuyển khách dạng trang | Menu "Xung đột owner" đã có trên rail GS ở 1d, 9 nhưng chưa có màn | Nhẹ |
| M14 | MH-UI-01 menu **mở rộng 232 px có chữ** | Mọi màn đang vẽ rail thu gọn; UAT-UI cho nhóm menu và ẩn nhóm theo vai cần bản mở rộng | Nhẹ |
| M15 | MH-UI-02 Đăng nhập (câu bị từ chối có email, thống nhất #28), MH-UI-06 trang lỗi | Đã có trong code, nhưng câu đổi theo v1.2 | Nhẹ |
| M16 | MH-UI-11 bản điện thoại | Chờ QĐ-01 (BA đề xuất phương án B = MVP tối thiểu). Nếu chủ dự án chọn B thì đây thành màn thiếu mức Cao | Chờ QĐ-01 |

**Cần BA xác nhận thuộc D1 hay D2:** MH-SZ-09/10/11 (canvas 11 ghi D2 nhưng lời mời kết bạn và tạo nhóm là việc hằng ngày của NVKD); MH-UI-04 và MH-SZ-14 (canvas 6 ghi D2); MH-SZ-02 menu chuột phải hội thoại; MH-SZ-06 hộp quản lý mẫu câu (chỉ vẽ gợi ý `/`); MH-SZ-08 hộp Thông tin người gửi; MH-DK-07 Gắn tay danh tính; MH-DK-08 Tìm khách (canvas 4 "chưa rà"); MH-OA-12 Gửi tin mẫu lẻ (chờ CH-3).

## Lệch đặc tả

| # | Mức | Màn canvas | Đặc tả (file:mục) nói | Canvas đang | Sửa thế nào |
|---|---|---|---|---|---|
| 1 | **Nghiêm trọng** | 1c (Z2 OA tắt phí, Z3) | 04 MH-OA-04 #13 + 03 QT-SZ-12 bước 1: nút `Nhắn qua Zalo · {nick}` chỉ hiện khi **người xem giữ ≥ 1 nick**; nick là **nick của người bấm**, "không bao giờ gợi ý nick của người khác". CSKH không giữ nick nên không thấy nút | Nút `Nhắn qua Zalo · Nick Tú (đã là bạn)` không ghi vai. Khách Anh Tuấn là khách của Nam, nhưng nút lại ghi nick Tú. Cùng màn có biến thể "CSKH · khách của sale" | Ghi nhãn biến thể "góc nhìn NVKD giữ nick". Thêm biến thể CSKH cho cùng Z2/Z3 (không có nút, chỉ `Gửi tin mẫu (ZNS)`, gọi khách, `Báo sale phụ trách`). Đổi dữ liệu cho người xem khớp nick. (P-CS #1 xếp Nên sửa; QA nâng lên vì đây là quy tắc then chốt) |
| 2 | **Nghiêm trọng** | 9a ③, 10b, 1e | 03 QT-SZ-11 bước 3a; 01 PQ-51; MH-SZ-13 #6a: nick "Chưa an toàn" thì API từ chối **mọi** lệnh, kể cả `Duyệt lại`. Ô soạn và thanh công cụ khóa, có dải đỏ `Nick {nick} chưa an toàn: chưa xác nhận đã đăng xuất Zalo trên thiết bị của {người cũ} (từ {dd/MM}). Chưa gửi được qua nick này.` + `Xác nhận đã đăng xuất`. `Duyệt lại` mờ, tooltip `Nick chưa an toàn, chưa gửi được` | Chỉ có chữ mô tả ở 9a, 10b, 8. Không màn nào vẽ khung chat hay Lệnh gửi của nick này. 9a ③ còn ghi `3 lệnh Cần duyệt lại → Ngân duyệt lại`, như thể Ngân duyệt được ngay trên nick chưa an toàn | Thêm biến thể ở 1e: Ngân mở hội thoại trên Nick Khoa (dải đỏ, ô soạn khóa, `Xác nhận đã đăng xuất`) và thẻ `Cần duyệt lại` có `Duyệt lại` mờ + tooltip. Sửa câu 9a ③: "Ngân duyệt lại sau khi nick an toàn" |
| 3 | Trung bình | 1e Lệnh gửi (thẻ "Gửi lỗi · trích dẫn") | 03 MH-SZ-13 #6: **không** có `Thử lại` trên lỗi mà thử lại chắc chắn hỏng (`replyTarget` → `Gửi không trích dẫn`) | `Bỏ lệnh · Gửi không trích dẫn · Thử lại` | Bỏ `Thử lại`, thêm `Mở hội thoại` |
| 4 | Trung bình | 1e Lệnh gửi (thẻ "Đang chờ gửi · chờ nick kết nối") | 03 MH-SZ-13 #8a; wireframe MH-SZ-13: thẻ lệnh chờ khi nick đỏ có `Sao chép và bỏ lệnh` | Chỉ có `Mở hội thoại · Bỏ lệnh`. Nút chỉ có ở bong bóng và ô soạn | Thêm `Sao chép và bỏ lệnh` vào thẻ lệnh |
| 5 | Trung bình | 1e | 03 MH-SZ-13 #6a: hộp `Duyệt lại` hiện nội dung nguyên văn + `Lệnh này do {người cũ} duyệt lúc {HH:mm dd/MM}. Bạn duyệt lại và gửi từ nick {nick}?` [Hủy] [Duyệt lại] | Chưa vẽ | Vẽ hộp (đây là bước duyệt thay cho `Thử lại`, UAT-SZ-60/83 cần) |
| 6 | Trung bình | 1f danh sách `/cskh` | 00 §3.4 [v1.2] (thống nhất #14): `/cskh` dùng **chip đủ**, **cấm** đích danh các chữ "Hạn trả lời: 25′", "Quá hạn trả lời 12′", "Hạn trả lời: tạm dừng". Phải dùng "Còn {n} phút" / "Sắp quá · còn {n} phút" / "Quá hạn {n} phút" / "Ngoài giờ · tính lại lúc {HH:mm}" | `Hạn trả lời: 1′`, `Quá hạn trả lời 12′`, `Hạn trả lời: tạm dừng` | Đổi đúng chữ 00 §3.4 (dòng Quân: `Sắp quá · còn 1 phút`). Nút nhanh `Quá hạn trả lời 3` giữ nguyên (04 #13) |
| 7 | Trung bình | 1f danh sách | 00 §3.4a, 04 MH-OA-02 #10: chip khung gửi `⏱ {h}h` · `⏱ Còn {h}g{m}` · `⏱ Còn {n}′` · `Có phí` · `Hết khung` · `Bỏ quan tâm`; Fanpage ≤ 2 giờ: `⏱ Còn {n}′` | `Nhắn miễn phí: 41h`, `Nhắn: có phí`, `Nhắn: hết khung`, `Nhắn: còn 1 giờ 50′ trong 24h` | Dùng đúng chip ngắn: `⏱ 41h`, `Có phí`, `Hết khung`, `⏱ Còn 1g50` (Fanpage). Chú giải cuối 1c đã đúng, chỉ danh sách 1f lệch |
| 8 | Trung bình | 1f dòng Gara Hải Đăng | 02 DK-48, MH-DK-09 #5a; 00 §3.4: tạm giữ chỉ khi owner **quá hạn** hoặc Vắng/Ngoại tuyến; nhãn riêng `Owner chưa trả lời {n}′` (Đặc, cam), không dùng chip SLA | Dòng vừa ghi `tạm giữ (DK-24)` vừa ghi `Owner trả lời trong: 18′` (owner chưa quá hạn) | Trước hạn: bỏ chữ "tạm giữ", ghi `Khách của Nam`. Thêm biến thể quá hạn: `Owner chưa trả lời 30′` + chế độ ô soạn mẫu giữ khách (M8) |
| 9 | Trung bình | 1c "CSKH · khách của sale" | Thống nhất #30; 00 MH-UI-08; 04 MH-OA-04 "Không có quyền gửi": đúng một câu `Bạn chỉ có quyền xem hội thoại này.` + `[Tạo ticket để trả lời] [Báo sale phụ trách]` | `Bạn chỉ xem hội thoại này. Khách của Nam (sale). Bạn được ghi chú nội bộ.` | Dùng đúng câu chung; "Khách của Nam" để ở tiêu đề hoặc panel |
| 10 | Trung bình | 1f ô soạn; 1c các biến thể Z1 / Fanpage của Anh Tuấn | 04 MH-OA-04 #6, UAT-OA-146: với khách có owner, `Gửi báo giá` **khóa**, tooltip `Báo giá thuộc khách của Nam` (MH-PQ-11 dạng C); **cạnh đó** có `Báo sale báo giá` | 1f bỏ hẳn nút `Gửi báo giá`. 1c vẫn để `Gửi báo giá` bật | Cả hai màn: nút khóa + tooltip + `Báo sale báo giá` (gộp P-CS #5) |
| 11 | Trung bình | Rail của 1, 1a, 1e, 1f; panel 1 | 00 §2.2 quy tắc menu 3: "Trong UAT MVP, các mục GĐ2–GĐ3 phải không có mặt… nhóm KẾ TOÁN và 'Yêu cầu hóa đơn' là GĐ2" | Rail NVKD và CSKH có `Yêu cầu hóa đơn`. Rail NVKD có `Công nợ` (nhóm KẾ TOÁN). Panel 1 có tab `Hóa đơn 2`, trong khi 360 lại ghi "Hóa đơn VCinvoice: Sắp có (GĐ2)" | Bỏ khỏi bản D1, hoặc ghi rõ "GĐ2, ẩn trong MVP". Giữ dải công nợ theo HD-55 nếu QĐ-15 chọn B |
| 12 | Trung bình | 8 Kênh kết nối | 00 §2.2: "Kết nối kênh" với GS là `– ⁽¹³⁾` (không hiện mục trong Quản trị). GS xem nick của tổ ở popover MH-SZ-12a #7 "Nick của tổ" | Có nút lọc `Tổ của tôi (giám sát)` và quy tắc "Giám sát chỉ thấy nick của tổ và chữ Báo Admin" (P-GS L2-7 dựa vào đây) | BA chọn một: (a) 00 §2.2 cho GS 👁 `/channels` phạm vi TỔ; hoặc (b) canvas bỏ lọc GS và vẽ phần "Nick của tổ" trong popover 12a. Hiện đặc tả và thiết kế trái nhau |
| 13 | Trung bình | 9 "Chia hội thoại" | Thống nhất #2; 02 DK-47/48: "Vắng" tự bật sau 30′ (tham số); owner Vắng/Ngoại tuyến hoặc quá hạn trả lời (15′/30′, QĐ-06) thì CSKH **tạm giữ** hội thoại kênh API; "Đi thị trường" vẫn nhận khách mình | `Người phụ trách offline quá 15 phút → chỉ báo giám sát và người trực thay; hội thoại vẫn của người phụ trách` | Viết lại theo DK-47/48: tách tin vào nick cá nhân (luôn về người giữ nick) và kênh API (tạm giữ). Dùng 4 trạng thái của MH-UI-05. Đổi "§21 câu 5/6" thành mã QĐ/TS mới |
| 14 | Trung bình | 1f, 1c, 3 (mọi chỗ có SĐT) | 00 §3.6 [v1.2], thống nhất #17: nút `Gọi` đặt **ngay cạnh** `Hiện` ở **mọi nơi** có SĐT, cho cả người "luôn hiện": `0912 *** 678 [Hiện] [Gọi]` | Chỉ có `Hiện`. 1c ghi `Gọi khách: 0900 *** 678 Hiện` (chữ "Gọi khách" là nhãn, không phải nút). Panel 1 và 360 của owner không có `Gọi` | Thêm nút `Gọi` (máy tính: hộp QR `tel:` 60 giây) ở panel, 360, khối chặn Z3/Z0 |
| 15 | Trung bình | 11 Danh bạ (ghi D2, nhưng là quy tắc then chốt) | 00 §3.6, thống nhất #10: owner **luôn thấy đủ** SĐT khách của mình | Dòng `Tuấn Nguyễn` gắn `Garage Minh Phát` (khách của Tú) hiện `0900 *** 678`. Cùng bảng, dòng Anh Phát hiện đủ `0900 000 678` | Hiện đủ cho mọi liên hệ gắn khách của Tú. Sửa dữ liệu trùng số (xem Dữ liệu mẫu) |
| 16 | Trung bình | 1c Fanpage | 00 §3.4a; 05 §2.2a: Fanpage có chip `Chỉ hỗ trợ`, `Hết cửa sổ` và vùng chặn "Hết cửa sổ" (> 7 ngày) | Chỉ vẽ "sắp hết 24 giờ" và "chỉ tin hỗ trợ". Chú giải chỉ liệt kê chip OA | Thêm biến thể Hết cửa sổ và 2 chip Fanpage vào chú giải (M9) |
| 17 | Nhẹ | 1 và 1d danh sách | 00 §3.4 chip ngắn: `⏰ {n}′`, `Quá {n}′` | `⏰ chờ 11′ · còn 4′`, `Quá SLA 22′`, `Quá SLA 12′` | `⏰ 4′`, `Quá 22′`. Chữ "chờ 11′" không thuộc chip SLA, bỏ hoặc để ở dòng phụ |
| 18 | Nhẹ | 1b hộp "Lần gửi đầu" | 03 MH-SZ-05 #14 [Sửa v1.2]: `Tin sẽ được gửi từ nick {nick}. Bấm gửi nghĩa là bạn đã duyệt nội dung này. Lần sau sẽ không hỏi lại.` | Vẫn là câu cũ của code: `…qua tiện ích VClinks trên tab Zalo Web đang mở…` (P-KD L1-13) | Đổi câu. Gắn nhãn "Sửa", không để "Đã có" |
| 19 | Nhẹ | 1, 1b, 1c, 1f bộ đếm | 03 MH-SZ-05 #12 ghi `{n}/2.000`; 04 MH-OA-04 #1 và UAT-OA-27 ghi `0/2000` | `82/2000`, `0/2000` | Hai đặc tả lệch nhau. BA chốt một dạng (00 MH-UI-08 #6 làm nguồn); designer theo |
| 20 | Nhẹ | 1f ô soạn | 04 MH-OA-04 #8: `Yêu cầu chia sẻ thông tin` **ẩn khi đã có SĐT xác thực** | Khách Anh Tuấn `✔ đã xác thực` mà nút vẫn hiện | Ẩn nút ở trạng thái này. Vẽ biến thể "hết 2 lượt" (nút tắt + tooltip) nếu muốn |
| 21 | Nhẹ | 1f lỗi "tin dài" | 04 MH-OA-04 #1, UAT-OA-27; SZ-30: ô soạn **chặn** ở 2.000, bộ đếm đỏ, nút Gửi tắt. Tin > 2.000 không thể thành lệnh | Bong bóng `[Tin dài 2.140 ký tự…] Lỗi gửi` + `Sửa tin` | Thay bằng trạng thái ô soạn `2140/2000` đỏ, Gửi tắt. Giữ lỗi phía Zalo cho mã lỗi thật khác |
| 22 | Nhẹ | 1c "Z2 · OA tắt có phí" | 04 §3.2, MH-OA-04: chặn như Z3, nút `Gửi tin mẫu (ZNS)` + dòng cách khác (SĐT `Hiện`, Ghi chú nội bộ, `Khách nhắn lại OA thì khung gửi mở lại ngay.`) | Nút `Tin mẫu (ZNS)`, không có dòng cách khác | Dùng đúng khối chặn của Z3 |
| 23 | Nhẹ | 9a Nghỉ việc | 01 MH-PQ-04: nút cuối `Hoàn tất bàn giao`; bước ② có `Hiệu lực`, `Báo cho người nhận`, `Nhắn khách (qua kênh chính thức)`; người bị loại ghi lý do "Nghỉ phép tới dd/MM"; ③ có ô ghi chú khi tick "Đã thu nick" | Nút `Bàn giao 96 khách và 1 nick`; thiếu #8–#10 và ô ghi chú; ghi "Nghỉ phép · bỏ khỏi chia đều" | Đổi nhãn nút (hoặc BA sửa 01 theo canvas), thêm 3 trường, ô ghi chú, ngày |
| 24 | Nhẹ | 9b Trực thay | 01 MH-PQ-07: tab `Ủy quyền duyệt`; nút `Đăng ký vắng`, `+ Ủy quyền duyệt`; mục #5a tên "Trực nhóm khách" | Không có tab/nút trên. Mục đổi tên "Chia bớt khách cho người trực khác" (theo P-GS lượt 2) | Thêm tab, nút. BA sửa tên #5a trong 01 cho khớp canvas |
| 25 | Nhẹ | 1h | 02 MH-DK-09 hành động 4a: khớp → `Đã xác nhận theo đơn [mã]. Chỉ xem được thông tin đơn này.`; không khớp → `Mã đơn và SĐT không khớp. Còn [n] lần thử.`; 02 MH-DK-02: khối Thương mại viền đỏ "Không chia sẻ với người trong hội thoại này" | Câu khớp khác chữ; chưa vẽ ca không khớp và khóa 24 giờ; không có viền đỏ + câu | Dùng đúng câu; thêm ca không khớp (còn 1 lần) và ca khóa |
| 26 | Nhẹ | 1e Lệnh gửi | 03 MH-SZ-13 #3a, #4: `Chờ xác nhận gửi` chỉ hiện khi có; `Treo {n} phút` trên lệnh lỗi / quá hạn / **cần duyệt lại**; treo lâu nhất lên đầu; wireframe `Đã gửi hôm nay` | `Chờ xác nhận 0` luôn hiện; thẻ `Cần duyệt lại` và lỗi trích dẫn không có `Treo`; `Đã gửi 14` | Sửa theo #3a, #4 |
| 27 | Nhẹ | Chip kênh (mọi màn, lớp `.c-cmt`, `.c-mail`) | 00 §3.2 [v1.1]: designer chọn lại màu, **Bình luận bỏ cam `#C2410C`**, **Email bỏ đỏ `#C5221F`** (trùng màu cảnh báo) | Vẫn dùng `#C2410C` và `#C5221F` | Chọn màu mới, báo BA cập nhật bảng 00 §3.2 |
| 28 | Nhẹ | Rail 1d/9 (GS), 8/10 (AD) | 00 §2.2 quy tắc 4: GS **luôn thấy** "Gợi ý gộp hồ sơ"; AD thấy "Chatbot web" (chỉ `Tắt khẩn cấp`, ⁽¹¹⁾) | Rail GS thiếu "Gợi ý gộp hồ sơ"; rail AD thiếu "Chatbot web" | Thêm mục, hoặc ghi rõ "ẩn vì GĐ/D2" nếu đúng như vậy |
| 29 | Nhẹ | 1f, 3, 9, 1d (nhãn trên canvas) | Thống nhất #26: mã câu hỏi phải có tiền tố file (`CH-DK-`, `CH-OA-`, `Q-SZ-`…); mọi mục "Đề xuất – chờ BA" phải được BA xử lý trước khi chốt lô | Còn `CH-1`, `CH-2`, `§21 câu 5`, `§21 câu 6`. Còn 5 nhãn "chờ BA": Nhắc {tên} + Nhóm theo NVKD, hộp Giao cho…, Thông báo gộp GS (1d), "Quân đã nhận lúc…" (10c) | BA chốt 5 mục "chờ BA" (đưa vào đặc tả hoặc bỏ); designer đổi mã theo tiền tố |

## Quy tắc then chốt

| Quy tắc | Kết quả | Ghi chú |
|---|---|---|
| Không gửi khi chưa duyệt | **Đạt** | Mọi đường gửi trên canvas đều có bước bấm của người: Enter/Gửi, hộp lần gửi đầu ("Bấm gửi nghĩa là bạn đã duyệt"), `Trả lời thay` (luôn hỏi), `Gửi báo giá` ("nghĩa là bạn đã duyệt"), `Đồng ý` kết bạn (duyệt lời chào), `Tạo nhóm`, `Gửi ngay` và `Duyệt lại` (= duyệt lại). Bong bóng và thẻ lệnh ghi `Duyệt bởi {tên} lúc {HH:mm:ss}`. Còn thiếu: chip "Tự động" của tin chào OA (1f) chưa có tooltip "duyệt bởi {tên} lúc …" (00 §3.3a, thống nhất #21). Nhẹ |
| Nick "Chưa an toàn" không gửi được | **Chưa đạt** | Chỉ có mô tả chữ, chưa có màn nào cho thấy chỗ bị khóa; 9a còn gợi ý Ngân "duyệt lại" được. Xem #2, M2 |
| "Cần duyệt lại" không có "Thử lại" | **Đạt** (thiếu hộp) | 1e, 1a (#38b), 9a ①, ③ đều đúng. Thiếu hộp `Duyệt lại` (#5). Dữ liệu mẫu của lệnh này sai nick (xem D4) |
| CSKH không thấy lối gửi qua nick cá nhân | **Chưa đạt** | 1f đúng (không có nút). 1c có `Nhắn qua Zalo · Nick Tú` mà không ghi vai, lại đặt trong bối cảnh khách của Nam. Xem #1 |
| SĐT ẩn theo quyền, owner thấy đủ | **Đạt một phần** | Đạt: panel 1 và 360 hiện đủ cho owner Tú; 1f, 1c, 1h ẩn với CSKH; 360 có chú thích góc nhìn CSKH (Hiện 60 giây, ghi nhật ký); 10c ghi nhật ký "Xem SĐT". Lệch: 11 ẩn số của khách Tú (#15); không nơi nào có `Gọi` (#14); chưa có màn nào cho thấy **GS phải bấm Hiện** (1d không hiện SĐT). Cần một chỗ để viết UAT-UI cho GS |
| Ghi chú nội bộ tách khỏi ô trả lời | **Đạt** | Segmented `Trả lời khách / Ghi chú nội bộ`, nền kem, câu `Không gửi ra kênh · @ để nhắc đồng nghiệp`, `Enter để lưu ghi chú`. Ghi chú trong luồng mang nhãn "Ghi chú nội bộ · khách không thấy". Ghi chú vẫn dùng được khi nick đỏ, Z3, Z0, token hết hạn. 1c có `Chép sang ghi chú nội bộ` khi khung vừa hết |
| Khung gửi OA Z0–Z3 | **Đạt** câu chữ, **lệch** chip | Dải và khối chặn khớp 04 §3.2 nguyên văn; hộp phí khớp; lỗi `-230` thắng tính toán. Chip trên danh sách `/cskh` sai chữ (#7). Z2 tắt phí thiếu dòng cách khác (#22) |
| Khung gửi Fanpage | **Đạt một phần** | Câu 24 giờ và `HUMAN_AGENT` đúng, nút `Gửi tin hỗ trợ`. Thiếu "Hết cửa sổ" và 2 chip (#16) |
| Chống gửi trùng | **Đạt** (thiếu 2 chỗ) | Kênh extension: SZ-28 a–d đủ ở 1e (dải ô soạn, bong bóng, hộp kết nối lại, 30′ → `Quá hạn — chưa gửi`, "GS chỉ thấy trạng thái"). Thiếu `Sao chép và bỏ lệnh` trên thẻ Lệnh gửi (#4). Kênh API: chưa minh họa OA-32 (nút Gửi `loading` + khóa khi bấm hai lần), UAT-OA-91 cần. Góp ý P-KD #4 (luôn hỏi khi đã có tin điện thoại dù < 2 phút) là thay đổi nghiệp vụ, BA quyết |

## Dữ liệu mẫu lệch

Ghi chú của canvas đặt "bộ dữ liệu chung tổ HN1" (Nick Tú đỏ từ 07:10; Minh nghỉ phép, Ngân trực 13:00–17:30; Khoa nghỉ việc 29/09). P-GS xác nhận nhóm màn của giám sát đã khớp. Các chỗ dưới đây vẫn lệch. Ký hiệu **(TB)** là chỗ chặn viết ca UAT xuyên màn.

| # | Chủ đề | Màn A nói | Màn B nói | Đề xuất thống nhất |
|---|---|---|---|---|
| D1 | **(TB)** Nick Tú đỏ từ 07:10 | Chú giải, 1d, 1e, 8, 10c: mất kết nối từ 07:10 | 1: chấm "Nick đang kết nối", hội thoại Anh Phát bình thường lúc 09:32. 1a: tin VClinks gửi `08:44 Đã gửi`, `08:45 Đã xem`. 1e: lệnh danh thiếp lỗi lúc 08:42 "thử 1 lần", lỗi trích dẫn lúc 07:58 (extension phải chạy thì mới trả được các lỗi này) | Ghi rõ 1 và 1a là "trước 07:10" (hôm qua), hoặc đổi giờ các tin/lệnh về trước 07:10 |
| D2 | Số lệnh của Nick Tú | Popover 1e: `Lệnh chờ 2 · Lỗi 1` | Bộ lọc Lệnh gửi: `Đang chờ 1 · Lỗi 2 · Quá hạn 1 · Cần duyệt lại 1` | Một bộ số |
| D3 | Giờ "hiện tại" của 1e | Lỗi 08:42 `Treo 58 phút` → lúc đó là 09:40 | Quá hạn 08:05 `Treo 36 phút` → lúc đó là 08:41; lệnh chờ tạo 09:34 | Chọn một giờ hiện tại (ví dụ 09:40) rồi tính lại cột Treo |
| D4 | **(TB)** Lệnh `Cần duyệt lại` | 1e: `Gara Hoàng Long · Nick Tú · Duyệt bởi Khoa` | 1d: Gara Hoàng Long là khách của Minh (Nick Minh). 9a: 3 lệnh Cần duyệt lại nằm trên **Nick Khoa** chuyển sang Ngân. Khoa không giữ Nick Tú | Đặt lệnh này trên Nick Khoa, trong Lệnh gửi của Ngân, `Duyệt lại` mờ (nick chưa an toàn, #2) |
| D5 | **(TB)** Khách "Garage Minh Phát" và "Anh Tuấn" | 1, 2, 3, 11: Garage Minh Phát · **KH-00812** · owner **Tú** · SĐT 0900 000 678; liên hệ Nguyễn Minh Phát, Trần Văn Hùng, Lê Thị Mai | 1f, 1c, 1g: "Anh Tuấn – **Gara Minh Phát**" · **KH-00873** · sale **Nam** · SĐT 0900 *** 678. 11: "Tuấn Nguyễn / A Tuấn – gara Cầu Giấy" · 0900 *** 678 → Garage Minh Phát. 1d, 10c: "Anh Tuấn – gara Long Biên" là khách của Minh | Tách hẳn: khách CSKH đặt tên khác (ví dụ "Anh Tuấn – Gara Long Biên", KH-00873, owner Nam, SĐT riêng). Một SĐT chỉ thuộc một khách, trừ khi đang minh họa ca trùng số |
| D6 | Công nợ Garage Minh Phát | Tiêu đề chat 1: `Quá hạn 5 ngày · 42,3 tr ₫` | 2, 360: quá hạn **18,2 tr ₫**, tổng nợ 42,3 tr ₫ (P-KD #1) | HD-55 chip = số quá hạn: `Quá hạn 5 ngày · 18,2 tr ₫`. Tổng nợ ghi ở khối Công nợ |
| D7 | **(TB)** Ticket TK-0142 | 1f: tin gốc 16:20 27/09, khách bấm "Bảo hành" 27/09 16:18, `Mới · SLA phản hồi còn 25′` | 1g: tin gốc 10:02 29/09, "10:02 Tạo từ nút chatbot", `Đang xử lý · ✔ 3′` (P-CS #4) | Một bộ giờ và trạng thái; khung gửi 1f (tương tác cuối 16:20 27/09) phải khớp |
| D8 | Cam kết đã nêu (360) | `Giá · 04465-0D250 · 1.450.000 ₫/bộ · hôm nay 09:18`; `Ngày giao · thứ Tư 01/10 · 09:35` | Tin 09:18 (1) không nêu giá; giá 1.450.000 ₫ chỉ có trong ô soạn chưa gửi. Câu "thứ Tư em giao" là lệnh **chưa gửi** lúc 09:34 (1e) | Cam kết chỉ lấy từ tin đã gửi. Đổi giờ/nguồn cho khớp |
| D9 | Quá SLA của tổ | 1d thông báo gộp: `3 hội thoại … Tú 1 · Minh 2` | 1d bộ lọc `Quá SLA 2`; 9: Tú 1, Minh 1 | `2 hội thoại … Tú 1 · Minh 1` |
| D10 | Giờ trả lời thay | 1d: Hương trả lời thay lúc **13:47** | 10c nhật ký: `29/09 08:47 Lê Thu Hương · Trả lời thay` | 13:47 |
| D11 | Yêu cầu chuyển khách của Linh | 360: `Yêu cầu chuyển đang chờ: Đỗ Mai Linh` trên Garage Minh Phát | 9: chỉ có 1 yêu cầu của Linh, cho **Gara Hưng Thịnh** | Thêm dòng thứ hai ở 9, hoặc bỏ ở 360 (liên quan P-GS #3) |
| D12 | Nick trên trang Đồng bộ | 10e: `Nick Ngân · Chậm`, Tin nhắn 48.210 / 48.173 (lệch 37) | 8: Nick Ngân "Đang kết nối" 22.410 / 22.410; **Nick Minh** "Chậm" 31.870 / 31.833 (lệch 37); Nick Tú 48.210 | Đổi thẻ 10e thành Nick Minh với số của 8 |
| D13 | Chrome driver 9333 | 9a, 10b (token): "máy chủ dự án", phục vụ Nick Tú, Minh, Khoa | 10b "Nick chờ xác nhận": "máy của Tú". 8, 10e: Nick Ngân cũng chạy trên driver 9333. 8: Laptop Khoa "đã thu hồi", 10b vẫn đang dùng (P-AD #4) | Một tên máy; token liệt kê đủ nick; Laptop Khoa "Đã thu hồi 29/09" ở cả hai |
| D14 | **(TB)** Tổ HN1 và giám sát | 9, 10d: Tổ HN1 **(7)**, danh sách chỉ 4–5 người | 10: Hương "Tổ HN1". 9: cây ghi Hương giám sát **cả HN1 và HN2**, 9b Hương duyệt đăng ký vắng của Linh (HN2). 10a: "GS HN2 chuyển khách" như một người khác | Chốt Hương giám sát HN1 hay HN1+HN2; khớp số thành viên với danh sách |
| D15 | Số nick của Ngân | 10: Ngân 1 nick, Khoa 1 nick | 10d: Ngân 2 nick (đã nhận Nick Khoa); 10b: Nick Khoa → Ngân lúc 29/09 10:10 | Nếu bàn giao đã chạy (10b) thì 10 ghi Ngân 2, Khoa 0; nếu chưa thì 10b, 10d chưa đổi |
| D16 | Tên Admin | 1f, 1c: "Đã tự báo admin (**Trần Admin**)" | Mọi màn Admin: **Quân (Admin)** | Quân |
| D17 | OA VCservice mất kết nối | 1f: banner `OA "VCservice Garage" đang mất kết nối` | 8: danh sách 9 kênh không có OA VCservice; đỏ chỉ là Nick Tú, Fanpage VCedu, Nick Khoa | Thêm OA VCservice (đỏ) vào 8 và 10c, hoặc đổi tên OA ở 1f |
| D18 | Ngày ở tương lai; lời mời trùng bạn bè | 1c hộp phí: "đơn giá nhập ngày **01/10/2026**" (hôm nay 29/09/2026). 11: `Tuấn Nguyễn` đang chờ đồng ý kết bạn 2 giờ | 11 tab Bạn bè đã có `Tuấn Nguyễn` gắn Garage Minh Phát | Đổi ngày về trước 29/09; bỏ Tuấn Nguyễn khỏi Bạn bè hoặc dùng người khác cho lời mời |

## Sẵn sàng cho UAT

| Màn | Đủ viết UAT? | Còn thiếu để viết ca |
|---|---|---|
| 1 Hộp thư NVKD | Gần đủ | Rỗng "Của tôi", rỗng theo lọc, lỗi tải (00 §6.2); dữ liệu D1, D5, D6 |
| 1a Khung chat | Đủ | Trạng thái chỉ xem (Viewer) trên Zalo: `Bạn chỉ có quyền xem hội thoại này.` |
| 1b Ô soạn | Đủ | Câu #18; bộ đếm #19 |
| 1c Khung gửi OA/Fanpage | Gần đủ | Biến thể CSKH cho Z2/Z3 (#1), Fanpage hết cửa sổ (#16), OA-32 bấm hai lần, mất mạng `Mất kết nối. Tin chưa gửi, đã giữ nháp.` |
| 1d Giám sát | Gần đủ | 3 mục "chờ BA" (#29); toast giao trùng |
| 1e Nick / Lệnh gửi | **Chưa** | Nick Chưa an toàn (#2), hộp Duyệt lại (#5), trang Lệnh gửi phạm vi Tổ (M4), rỗng/lỗi, dữ liệu D1–D4 |
| 1f Hộp thư CSKH | **Chưa** | Chữ chip (#6, #7); rỗng `Bạn không có hội thoại nào cần xử lý.`; lỗi; toast `Hội thoại … vừa được Minh nhận.`; dòng chuyển sang "Của tôi" sau Nhận; tạm giữ quá hạn (#8, M8) |
| 1g Ticket | Gần đủ | Danh sách Ticket của tôi (M3); dữ liệu D7 |
| 1h Danh tính | Gần đủ | Ca không khớp, khóa 24 giờ, trạng thái sau khi khớp (#25) |
| 2 Gửi báo giá | Đủ | Toast lỗi hết hạn `Báo giá BG-… đã hết hạn trên VCsales. Không gửi được.`; danh sách rỗng |
| 3 Customer 360 | Gần đủ | Góc nhìn CSKH mới chỉ là chú thích (được P-CS chấp nhận). Nhãn "Đang có người trực thay" (P-GS L1-13); `Gọi` (#14) |
| 8 Kênh kết nối | Chưa rõ quyền | Chốt GS có vào hay không (#12) |
| 9 / 9a / 9b | Gần đủ | 9a: các trạng thái Đang xử lý lô lớn / Lỗi một phần / toast sau `Khóa ngay` và `Hoàn tất`; hộp "Xác nhận đăng xuất (sau)". 9b: Đăng ký vắng |
| 10 / 10a | **Chưa** | Form Thêm người, tab Vai trò & vị trí, Kênh được gán (M5) |
| 10b | Đủ | Dữ liệu D13, D15 |
| 10c | Gần đủ | Tab Quy tắc (M11) |
| 10d | Gần đủ | Phiếu Xuất, tab Thời hạn lưu trữ, chặn nạp lại (M10) |
| 10e | Đủ | Dữ liệu D12; bản rút gọn cho sale (MH-SZ-12b "Sale xem được chế độ rút gọn") chưa vẽ |
| Toàn lô | **Chưa** | MH-PQ-11 dạng A–D (M1) là điều kiện để viết mọi ca "không có quyền" |

## Việc cho designer (lượt hoàn thiện)

Gom từ bảng lệch ở trên và các góp ý **Nên sửa** còn mở của 4 vai lượt 3. Mục **Gợi ý** của người dùng để BA quyết, liệt kê cuối.

**A. Phải xong để chốt D1**
1. #1: 1c. Ghi vai cho nút `Nhắn qua Zalo · {nick}`. Thêm biến thể CSKH không có nút. Nick trên nút là nick của người xem (gộp P-CS #1).
2. #2, M2: vẽ nick "Chưa an toàn" trong khung chat và trong Lệnh gửi của người giữ mới. Sửa câu 9a ③.
3. Dữ liệu mẫu D1, D4, D5, D7, D14: thống nhất trước, các mục khác sửa theo.
4. M1: MH-PQ-11 bốn dạng, đặt ở một bảng "Trạng thái chung".
5. M3: Ticket của tôi `/tickets` theo góc nhìn CSKH, có SLA xử lý (P-CS L1-6).
6. M4: Lệnh gửi phạm vi "Tổ của tôi" có cột NVKD, gom theo người (P-GS L2-3). Thêm hộp `Duyệt lại` (#5).
7. M5: drawer "+ Thêm người" và tab "Vai trò & vị trí" (trạng thái "Chờ duyệt – Kiểm soát"), "Kênh được gán" có "+ Gán nick" (P-AD #1).
8. #6, #7, #17: chữ chip SLA và chip khung gửi đúng 00 §3.4, §3.4a.
9. #3, #4: thẻ Lệnh gửi (bỏ `Thử lại` ở lỗi trích dẫn; thêm `Sao chép và bỏ lệnh`).
10. #11: bỏ mục GĐ2 khỏi rail và panel của bản D1.

**B. Nên sửa (đặc tả đã rõ)**
11. #8, M8: tạm giữ đúng thời điểm; nhãn `Owner chưa trả lời {n}′`; ô soạn chế độ mẫu giữ khách; biến thể "khách của sale" ở 1c có chip hạn của owner (P-CS #3 lượt 2).
12. #9, #10, #20, #21, #22: khối chỉ xem, nút báo giá khóa + `Báo sale báo giá`, ẩn "Yêu cầu chia sẻ thông tin", tin quá dài, khối chặn Z2 tắt phí.
13. #14, #15: nút `Gọi` cạnh `Hiện`; owner thấy đủ SĐT ở Danh bạ.
14. #16, M9: Fanpage "Hết cửa sổ" và 2 chip.
15. P-KD #1: một mẫu ghi nợ thống nhất `Nợ 42,3 tr · quá hạn 18,2 tr (5 ngày)`; chip ngắn chỉ ghi phần quá hạn (khớp D6).
16. P-KD #2: `+ Tạo khách mới (tên, SĐT lấy từ lời mời)` trong hộp Đồng ý kết bạn; để trống thì ghi `Chưa gắn hồ sơ, gắn sau ở Danh bạ`.
17. P-KD #3: lời mời kết bạn có lời nhắn hiện trong Hộp thư (nhãn `Lời mời kết bạn` + `Đồng ý…`), tối thiểu có badge ở menu Danh bạ (đã có trong 00 §2.2 bảng badge) và trong chuông.
18. P-KD lượt 2 #2 còn mở: Z2 khi OA bật phí cũng có lối Zalo miễn phí (nếu đặc tả cho phép, BA xác nhận); vẽ ca khách chưa là bạn `Gửi lời mời kết bạn…`; chip `Hết khung` theo 00.
19. P-KD L1-13 (#18), L1-20: câu hộp lần gửi đầu; thanh công cụ có chữ (hoặc BA chốt giữ biểu tượng + tooltip như code).
20. P-CS L1-15: nháp nhắn riêng ở 0b không nêu giá cho lead (OA-11, DK-31).
21. P-CS L1-17, M12: bảng SLA ticket theo loại × ưu tiên ở `/settings/sla`.
22. P-GS #3: hộp Bàn giao ở 360 nhắc yêu cầu chuyển đang chờ (`bàn giao sẽ từ chối yêu cầu này` + lựa chọn `Giao cho Linh`).
23. P-GS L1-13: nhãn "Đang có người trực thay" ở khu Phụ trách của 360.
24. P-AD #2, M10: NĐ 13 ④ thêm dòng "Chặn nạp lại: …"; ⑤ biên bản ghi số khóa chặn; 10e hiện "Bỏ qua N bản ghi bị chặn theo NĐ13-xxxx"; phiếu Xuất; tab Thời hạn lưu trữ.
25. #12, #13: sau khi BA chốt, sửa màn 8 (quyền GS) và khối "Chia hội thoại" ở 9.
26. #23–#26, #28: các chỗ Nhẹ ở 9a, 9b, 1h, Lệnh gửi, rail.
27. #27: màu chip Bình luận, Email.
28. M6, M7, M14: drawer thông báo, dropdown trạng thái của tôi, menu mở rộng có chữ.

**C. Gợi ý của người dùng (BA quyết có làm không)**
- P-KD #4: luôn hỏi `Gửi ngay / Bỏ lệnh` khi đã có tin từ điện thoại sau lúc tạo lệnh, không tính mốc 2 phút. Đây là thay đổi SZ-28, BA quyết.
- P-KD #5: `Tạo nhóm với khách này` trong `⋯` khung chat và 360.
- P-KD lượt 2 #9: bản điện thoại, chờ QĐ-01.
- P-CS #2: chip `Chưa xác nhận` trên dòng danh sách + mẫu `/xin-ma-don`. P-CS #3: sau khi khớp đổi chip thành `Đã xác nhận · phạm vi đơn …` (trùng #25). P-CS #6: chip "Có phí" màu riêng hoặc thêm ₫ (đang trùng `#F5B301` với SLA sắp quá).
- P-GS #1: nút `Nhắc {người trực} (trực {owner})` trên mọi dòng quá SLA; thông báo gộp ghi "(đã báo Ngân)". P-GS #2: bước ④ hiện tổng tải từng người nhận, cảnh báo khi vừa nhận nick vừa đang trực thay. P-GS L1-16: danh sách mẫu câu tổ "Chờ duyệt" ở màn 9.
- P-AD #3: nút hành động trên dòng cảnh báo (`Cấp lại`, `Báo người giữ`, `Mở bàn giao Khoa`). P-AD #5: phiếu Xuất (đã gộp ở mục 24). P-AD cũ #12, #13: dòng "Quân đã nhận" ở 1e, hạn token mới sau khi cấp lại.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/qa.md) | — |
