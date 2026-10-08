# QA xác nhận cuối lô thiết kế D1

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Agent QA rà xác nhận lô thiết kế TK1 (D1) ngày 29/09/2026, chỉ đọc canvas "VClinks UI Design" bản `1790650463-d989` (45 artboard), đối chiếu `qa.md` lượt trước và đặc tả 00–06.
- Kết luận: **chốt D1 đạt có điều kiện**. Designer đã xử lý cả 2 lỗi Nghiêm trọng và 23/29 lỗi lượt trước; đã vẽ thêm các màn 0d–0i, 1i–1l, 3a, 3b, 9c, 10f, 10g; dữ liệu mẫu chuyển sang bộ TD.
- Mọi quy tắc then chốt (không gửi khi chưa duyệt, nick "Chưa an toàn", khung gửi OA/Fanpage, chống gửi trùng…) đều **Đạt**; dữ liệu mẫu lượt trước khớp 16/18.
- Lỗi mới: 0 Nghiêm trọng · 8 Trung bình · 10 Nhẹ; lấy mẫu 46 điểm ở màn mới: 34 khớp, 12 lệch.
- Điều kiện chốt: designer sửa #1–#4 và lỗi cũ #10; BA quyết người duyệt xin quyền (PQ-30 với 00 UAT-UI-40), quyền GS ở `/channels`, xung đột KB07/TK0142, lô của MH-UI-04.
- Còn mở: vẽ bổ sung trước khi giao dev màn 8 (MH-OA-01), 9c chế độ sửa, 1k các trạng thái, trang `/me`, tab Thời hạn lưu trữ.
- Người duyệt nên xem kỹ mục "Việc còn lại trước khi dev" (bảng màn đang chặn ca UAT).

## Mục lục

- [Kết luận](#kết-luận)
- [Phủ màn](#phủ-màn)
- [Lỗi QA trước](#lỗi-qa-trước)
- [Quy tắc then chốt](#quy-tắc-then-chốt)
- [Lỗi mới](#lỗi-mới)
- [Việc còn lại trước khi dev](#việc-còn-lại-trước-khi-dev)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Người rà: agent QA. Ngày 29/09/2026. Chỉ đọc canvas, không sửa.
> Canvas: "VClinks UI Design" (https://claude.ai/artifact/8cAKkTjtb94BTCWFoErv1p), bản đang phát hành `1790650463-d989` (bản 14 trở lên), 45 artboard.
> Đối chiếu: `README.md` mục "Lô thiết kế"; `review/tk1/qa.md` (29 lỗi + 18 chỗ lệch dữ liệu); 00 v1.4.1, 01 v1.4.2, 02, 03, 04, 06 (HD-55, HD-56); `review/dac-ta-vong-1/thong-nhat.md`; `du-lieu-kiem-thu.md` v1.2/v1.3 (đang được sửa mốc giờ).

## Kết luận

**Chốt D1: Đạt có điều kiện.**

Designer đã xử lý toàn bộ hai lỗi Nghiêm trọng và 23/29 lỗi của lượt trước. Các màn còn thiếu đã được vẽ: 0d–0i, 1i–1l, 3a, 3b, 9c, 10f, 10g. Dữ liệu đã chuyển sang bộ TD và các màn khớp nhau (Minh xanh, Linh vàng, Tú đỏ từ 07:10, Toàn chưa an toàn → Hải). Cả 9 quy tắc then chốt đều **Đạt**. Không có lỗi mới mức Nghiêm trọng.

**Lỗi mới:** 0 Nghiêm trọng · 8 Trung bình · 10 Nhẹ. Lấy mẫu 46 điểm ở các màn vẽ mới: 34 khớp, 12 lệch.

**Điều kiện chốt.** Phải xong trước khi giao dev các màn liên quan. Không cần một vòng thiết kế lớn nữa.
1. Sửa 3 lỗi Trung bình ảnh hưởng trực tiếp tới ca UAT: #1 người duyệt xin quyền, #2 + #3 menu NVKD và menu tài khoản, #4 trạng thái nick Linh ở 1e.
2. BA quyết 3 điểm đặc tả đang trái nhau hoặc chưa cập nhật:
   - Người duyệt xin quyền: PQ-30 và 00 UAT-UI-40 đang nói khác nhau.
   - 00 §2.2: GS có vào `/channels` không (lỗi cũ #12).
   - Đặc tả dữ liệu: KB07 (T−20′ trên H20) xung đột với TK0142 (tin cuối T−16h48′).
3. Vẽ bổ sung trước khi dev nhận màn tương ứng. Không chặn các màn khác của D1:
   - Màn 8: MH-OA-01 (#6).
   - Màn 9c: chế độ sửa (#7).
   - Màn 1k: các trạng thái (#8).
   - Hồ sơ `/me` của MH-UI-05 (#9).
   - Tab Thời hạn lưu trữ theo 01 R1–R4 (#5).

## Phủ màn

Mọi mục D1 trong README đều có trên canvas và đúng mã MH, trừ những chỗ ghi dưới đây. Bản điện thoại chờ QĐ-01, không tính.

| Mục README (D1) | Mã | Artboard | Kết quả |
|---|---|---|---|
| Khung ứng dụng, đăng nhập, thông báo, trạng thái của tôi, trang lỗi | MH-UI-01, 02, 03, 05, 06 | 0d, 0f, 0g | Có. MH-UI-05 mới vẽ dropdown trạng thái, **chưa vẽ trang `/me`** (#9) |
| (trong dải mã) | MH-UI-04 Tìm kiếm toàn cục | 6 (ghi D2) | **Mơ hồ**: README ghi "MH-UI-01…06" nhưng phần chữ không nhắc tìm kiếm; canvas để D2. BA ghi rõ (#18) |
| Hộp thư, khung chat, ô soạn, panel 360 rút gọn, danh sách | MH-UI-07…10 | 1, 1a, 1b, 1f | Có |
| Không có quyền (4 dạng), xin quyền | MH-PQ-11 | 0e | Có |
| Sale Zalo | MH-SZ-01…06, 08, 12, 13 (+ Tổ của tôi) | 1, 1a, 1b, 1e, 1i, 1j, 1l, 2, 10e | Có. MH-SZ-12a thiếu phần "Nick của tổ" (GS). MH-SZ-12b chưa có bản rút gọn cho sale (#17) |
| Giám sát | QT-SZ-10/11, MH-PQ-04, 07 | 1d, 9a, 9b, 9 | Có |
| CSKH OA | MH-OA-02…07, 18 | 1f, 1c, 1g, 1k, 9c | Có. 1k và 9c còn thiếu trạng thái (#7, #8) |
| Khung gửi Fanpage | 05 §2.2a | 1c (F1–F3) | Có đủ 3 vùng, gồm cả "Hết cửa sổ" |
| Khách đa kênh | MH-DK-01…03, 09, 10 | 3, 3a, 1h, 1f panel, Main panel, 3b | Có |
| Quản trị | MH-PQ-01…03, 05, 06, 08…10, 12…15 | 9, 10, 10a, 10b, 10c, 10d, 10f, 10g, 0h, 0i | Có. Tab Thời hạn lưu trữ mới là khung chờ (#5) |
| Kênh kết nối | MH-OA-01, `/channels` | 8 | **Một phần**: có danh sách kênh; **thiếu luồng MH-OA-01** (#6) |

Menu của các màn D1 đã ẩn mục D2, đúng quy tắc của README.

## Lỗi QA trước

| # cũ | Mức cũ | Nội dung ngắn | Kết quả | Ghi chú |
|---|---|---|---|---|
| 1 | NT | CSKH thấy nút `Nhắn qua Zalo · {nick}` | **Đã sửa** | 1c tách "góc nhìn NVKD giữ nick (Minh)" và "góc nhìn CSKH" (chỉ `Gửi tin mẫu (ZNS)`, `Báo sale phụ trách`) |
| 2 | NT | Nick "Chưa an toàn" chưa có màn khóa | **Đã sửa** | 1i: dải đỏ, ô soạn khóa, `Duyệt lại` mờ kèm tooltip, hộp Duyệt lại. 9a ③ và ④ đã sửa câu |
| 3 | TB | `Thử lại` trên lỗi trích dẫn | **Đã sửa** | 1e: `Mở hội thoại · Bỏ lệnh · Gửi không trích dẫn` |
| 4 | TB | Thẻ lệnh chờ thiếu `Sao chép và bỏ lệnh` | **Đã sửa** | |
| 5 | TB | Hộp `Duyệt lại` chưa vẽ | **Đã sửa** | 1i, đúng câu #6a |
| 6 | TB | Chip SLA `/cskh` sai chữ | **Đã sửa** | `Sắp quá · còn 1 phút`, `Quá hạn 12 phút`, `Ngoài giờ · tính lại lúc 08:00` |
| 7 | TB | Chip khung gửi `/cskh` | **Đã sửa** | `⏱ Còn 18′`, `⏱ Còn 2g05`, `Hết khung`. Riêng 1k còn lệch, xem lỗi mới #10 |
| 8 | TB | Tạm giữ sai thời điểm | **Đã sửa** | Anh Kiên: `Owner chưa trả lời 30′`, ô soạn chỉ còn mẫu giữ khách |
| 9 | TB | Câu chỉ xem | **Đã sửa** | `Bạn chỉ có quyền xem hội thoại này.` + `Tạo ticket để trả lời` + `Báo sale phụ trách` |
| 10 | TB | `Gửi báo giá` khóa với khách có owner | **Một phần** | 1f đã đúng (khóa, tooltip, `Báo sale báo giá`). **1c "OA · Z1 miễn phí · Anh Tuấn · Lan · CSKH" vẫn để `Gửi báo giá` bật** |
| 11 | TB | Mục GĐ2 trên rail | **Đã sửa** | Rail NVKD D1 chỉ còn Hội thoại, Lệnh gửi, Ticket |
| 12 | TB | GS và `/channels` | **Một phần** | Canvas chọn phương án (a): vẽ góc nhìn GS chỉ đọc, phạm vi TỔ. **00 §2.2 vẫn ghi GS `– ⁽¹³⁾`**. BA phải sửa 00 hoặc canvas bỏ khối GS |
| 13 | TB | Khối "Chia hội thoại" ở 9 | **Đã sửa** | Theo DK-47/48, có 4 trạng thái, mã QĐ-06/TS-07 |
| 14 | TB | Thiếu nút `Gọi` | **Đã sửa** | Có ở 1f, 1c, panel 1, 360, 0h, 1l |
| 15 | TB | Owner không thấy đủ SĐT ở Danh bạ | **Đã sửa** | 11 (D2): khách của Minh hiện đủ số |
| 16 | TB | Fanpage "Hết cửa sổ" | **Đã sửa** | F3 có câu chặn và `Chọn kênh khác` |
| 17 | Nhẹ | Chip SLA ngắn | **Đã sửa** | `⏰ 4′`, `Quá 12′` |
| 18 | Nhẹ | Câu hộp lần gửi đầu | **Đã sửa** | 1b đúng câu v1.2 |
| 19 | Nhẹ | Bộ đếm | **Đã sửa** | Thống nhất `{n}/2.000` |
| 20 | Nhẹ | Ẩn `Yêu cầu chia sẻ thông tin` khi đã xác thực | **Đã sửa** | |
| 21 | Nhẹ | Tin > 2.000 thành lỗi gửi | **Đã sửa** | Thay bằng lỗi gửi thật (gọi quá nhanh) + `Gửi lại` |
| 22 | Nhẹ | Z2 tắt phí thiếu dòng cách khác | **Đã sửa** | |
| 23 | Nhẹ | 9a nhãn và trường | **Đã sửa** | `Hoàn tất bàn giao`, Hiệu lực, Thông báo, ô ghi chú |
| 24 | Nhẹ | 9b tab và tên mục #5a | **Một phần** | Đã có tab `Ủy quyền duyệt` và Đăng ký vắng. Tên "Chia bớt khách cho người trực khác" vẫn khác 01 #5a ("Trực nhóm khách"). BA chọn một tên |
| 25 | Nhẹ | 1h câu đối chiếu | **Đã sửa** | Có ca khớp, ca không khớp (còn 1 lần), khóa 24 giờ, viền "Không chia sẻ…" |
| 26 | Nhẹ | Lệnh gửi #3a, #4 | **Đã sửa** | Có Treo, `Đã gửi hôm nay`, "chỉ hiện khi có" |
| 27 | Nhẹ | Màu Bình luận / Email | **Chuyển BA** | Designer giữ màu cũ, lý do "đạt AA", và để ghi chú cho BA. 00 §3.2 [v1.1] vẫn yêu cầu đổi màu. BA chốt |
| 28 | Nhẹ | Rail thiếu "Gợi ý gộp hồ sơ", "Chatbot web" | **Hết hiệu lực** | Cả hai là D2, được ẩn theo quy tắc lô |
| 29 | Nhẹ | Mã câu hỏi, nhãn "chờ BA" | **Một phần** | Còn `CH-1` (1f), `Q20` (2), `Q21` (1a). Còn nhãn "chờ BA": Nhóm theo NVKD và Nhắc {tên} (1d); "Quân đã nhận lúc…" (10c). "Giao cho…" và thông báo gộp đã được 00 v1.4.1 ghi nhận là "chờ đặc tả chi tiết" |

**Dữ liệu mẫu D1–D18 của lượt trước:** đã khớp 16/18. Còn lại:
- **D8** (Nhẹ): 360 ghi cam kết "Giá · bộ côn Hilux · theo BG-2026-0915 · 09:18". Nhưng tin lúc 09:18 chỉ là "em lên báo giá ngay", còn báo giá thì "chưa gửi". Xem lỗi mới #14.
- **D11**: không còn, vì 360 đã bỏ dòng yêu cầu chuyển của Linh.

## Quy tắc then chốt

| Quy tắc | Kết quả | Bằng chứng trên canvas |
|---|---|---|
| Không gửi khi chưa duyệt | **Đạt** | Mọi lối gửi đều có người bấm: Enter/Gửi, hộp lần gửi đầu, `Trả lời thay` luôn hỏi, `Gửi báo giá` ("nghĩa là bạn đã duyệt"), `Duyệt lại`, `Gửi ngay`. 0i: "chỉ tạo nháp, không bao giờ tự gửi tin" |
| Nick "Chưa an toàn" khóa gửi | **Đạt** | 1i (ô soạn khóa, `Duyệt lại` mờ), 9a ①③④, 10b ("kể cả Duyệt lại"), 0e dạng C (tooltip nguyên văn), 8 (đỏ) |
| "Cần duyệt lại" không có "Thử lại" | **Đạt** | 1i ("Không có Thử lại"), 9a ①, 1a #38b |
| CSKH không có lối gửi qua nick cá nhân | **Đạt** | 1c góc nhìn CSKH không có nút Zalo. 1f không có. 0e: "Xem + Trả lời" khóa, tooltip "…chỉ qua Trực thay". 10f: `conv.reply` của CS là "KÊNH (4), TK" |
| SĐT ẩn / owner thấy đủ | **Đạt** | 0h đủ 7 ca (GS bấm Hiện, 60 giây, luôn thấy đủ, trong nội dung tin, R1, QR gọi, các trạng thái khác). Panel 1 và 360 hiện đủ cho Minh. 1f và 1c ẩn với Lan. 1l phân theo người xem |
| Ghi chú nội bộ tách riêng | **Đạt** | 1b segmented `Trả lời khách / Ghi chú nội bộ`. Nhãn "khách không thấy". Ghi chú vẫn dùng được khi nick đỏ, nick chưa an toàn, Z0/Z3, Fanpage F3 |
| Khung gửi OA Z0–Z3 | **Đạt** | 1c: Z1 (3 mức), Z2 (bật phí + hộp xác nhận; tắt phí theo 2 góc nhìn), Z3, Z0, token hết hạn, lỗi nền tảng thắng tính toán |
| Khung gửi Fanpage | **Đạt** | F1 trong 24 giờ, F2 `Chỉ hỗ trợ` / `HUMAN_AGENT`, F3 `Hết cửa sổ` |
| Chống gửi trùng | **Đạt** (còn 1 chỗ Nhẹ) | Kênh extension: 1e đủ SZ-28 a–d, `Sao chép và bỏ lệnh`, `Quá hạn — chưa gửi`. Kênh API: vẫn **chưa minh họa OA-32** (nút Gửi `loading` và khóa khi bấm hai lần). Dev làm theo đặc tả, không cần vẽ thêm |
| Tạm giữ chỉ gửi mẫu giữ khách | **Đạt** | 1c: ô soạn chỉ còn `/giu-khach`, câu "Chỉ gửi được mẫu Giữ khách, không nêu giá". 1f có dòng phụ. 0e dạng C. 9 ghi "owner không đổi" |

## Lỗi mới

Lấy mẫu 46 điểm trên các màn mới (0d 7 · 0e 6 · 0f 2 · 0g 2 · 0h 4 · 0i 2 · 1i 4 · 1j 2 · 1k 4 · 1l 3 · 3a 3 · 3b 1 · 9c 3 · 10f 1 · 10g 2): **34 khớp, 12 lệch**. Điểm khớp nổi bật:
- Mọi câu chữ của 0f (8 câu lỗi) và 0g (404/500/ErrorBoundary/mất mạng, toast Báo Admin).
- 0e: dạng A, B, C, D khớp nguyên văn.
- 0h: câu R1.
- 0i: câu rỗng, trần 3 token, chưa bật cho vị trí.
- 1l: menu chuột phải khớp 7 mục và tooltip nick đỏ.
- 10f: các hàng `outbox.reapprove`, `conv.reply_on_behalf`, `conv.fetch_on_behalf`, `msg.delete`.
- 10g: R1–R11 đúng PQ-46.
- 3b: câu theo người xem DK-16.

Các lỗi dưới đây gồm cả những chỗ phát hiện ở màn cũ khi rà lại.

| # | Mức | Màn | Đặc tả nói | Canvas | Sửa |
|---|---|---|---|---|---|
| 1 | Trung bình | 0e (hộp Xin quyền), 10a (tab Quyền hiệu lực) | 01 **PQ-30**: người duyệt = quản lý gần nhất bao trùm cả người xin và đối tượng. Khác tổ, cùng division thì **GĐ division** (Trịnh Văn Thắng). 00 **UAT-UI-40** lại ghi "Nguyễn Thị Hương" | Minh (HN1) xin quyền hội thoại Garage Hòa Bình của Hải (HN2): `Người duyệt: Hồ Văn Đức (Giám sát Tổ HN2)`. 10a: "duyệt: Hồ Văn Đức" | BA sửa 00 UAT-UI-40 theo PQ-30. Canvas đổi thành `Trịnh Văn Thắng (Giám đốc bán hàng VCparts)` ở cả 0e và 10a |
| 2 | Trung bình | 0d menu mở rộng NVKD | 00 §2.2 ⁽¹⁴⁾, 01 UAT-PQ-06: NVKD **không có nhóm "Quản trị"**. "Yêu cầu quyền của tôi" nằm ở menu tài khoản | Nhóm `QUẢN TRỊ › Quyền tạm thời` hiện trong menu NVKD | Bỏ nhóm Quản trị khỏi menu NVKD. Đưa "Yêu cầu quyền của tôi" vào menu tài khoản |
| 3 | Trung bình | 0i menu tài khoản | 00 §2.1 menu tài khoản: Hồ sơ của tôi `/me`, Token MCP của tôi, Hoạt động của tôi, Yêu cầu quyền của tôi, Phiếu NĐ 13 tôi ghi nhận | `Hoạt động của tôi · Token MCP của tôi · Cài đặt thông báo · Đăng xuất`. Thiếu 3 mục, thừa "Cài đặt thông báo" (đặc tả để ở MH-UI-05 `/me`) | Vẽ đúng 5 mục + Đăng xuất |
| 4 | Trung bình | 1e (dải, popover "Nick của tôi", ô soạn) | TD-NK02 "Linh VCparts" **vàng** (đồng bộ trễ 12′). Màn 8, 10e, 1d cũng vẽ Linh "Chậm", và Hương trả lời thay trên Linh VCparts lúc 09:58 | 1e: "Nick Linh VCparts đang mất kết nối với Zalo từ 09:52" (đỏ). Tooltip nút Gửi lại ghi "nick **Tú** đang mất kết nối" | Dùng Tú VCparts (đỏ từ 07:10, Linh trực thay) làm ví dụ nick đỏ ở 1e. Hoặc ghi rõ đây là biến thể "Linh đỏ" không thuộc bộ TD mặc định. Sửa tooltip cho khớp nick |
| 5 | Trung bình | 10d tab Thời hạn lưu trữ; phiếu Xuất | 01 MH-PQ-13 **đã có** tab `?tab=retention` (R1–R4: bảng Loại dữ liệu / Số ngày / Khi hết hạn / Đang áp dụng từ / Đề xuất chờ duyệt; AD gửi, QS duyệt; câu rỗng, lỗi, toast). Hành động "Thực hiện xuất" có toast `Đã tạo bản xuất cho NĐ13-<số>.`, link hết hạn 24 giờ | Chỉ có 4 dòng `[thời hạn]`, ghi "màn chủ quản /admin/retention chưa có đặc tả". Phiếu Xuất ghi "chi tiết phiếu Xuất – chờ 01" | Vẽ theo R1–R4. Chỉ để trống giá trị số ngày (chờ chủ dự án). Bỏ ghi chú "chưa có đặc tả" và "chờ 01" |
| 6 | Trung bình | 8 Kênh kết nối | 04 **MH-OA-01**: khối Zalo OA trên `/channels` với `Kết nối Zalo OA` (OAuth), `Kết nối lại`, `Ngắt kết nối`, chọn division. Trang `/channels/zalo-oa/:uid` tab Tổng quan và Chi phí: tùy chọn chính sách gửi C5 (bật tin có phí), nhập đơn giá | Chỉ có danh sách kênh với `Cấp lại` / `Cấu hình`. Không có luồng kết nối và trang chi tiết OA. Trong khi đó 1c Z2 lại dựa vào "division đã bật" và "đơn giá nhập ngày 25/09" | Vẽ luồng kết nối và tab Tổng quan + Chi phí (bật phí, đơn giá). Các tab Tin tự động, Chatbot, Tag, Khảo sát là D2, ghi rõ |
| 7 | Trung bình | 9c SLA và giờ làm việc | 04 MH-OA-18: chế độ sửa của GĐ (RangePicker từng thứ, ngày lễ, ma trận InputNumber, `Lưu` → `Đã lưu SLA và giờ làm việc. Áp dụng cho ticket tạo từ …`, lỗi hợp lệ, Drawer Lịch sử). Câu chỉ đọc: `Chỉ giám đốc division sửa được SLA và giờ làm việc.` Có dòng Đổi trả · Khác, bảng phí hậu mãi #5a | Chỉ vẽ góc nhìn GS chỉ đọc. Câu chỉ đọc khác đặc tả. Thiếu dòng Đổi trả/Khác. Bảng phí hậu mãi ghi "ở lô sau" | Vẽ thêm chế độ sửa (GĐ Thắng) có lỗi hợp lệ và Lịch sử. Dùng đúng câu chỉ đọc. BA xác nhận bảng phí hậu mãi thuộc D1 hay D2 (DK-31 dùng nó để miễn lý do) |
| 8 | Trung bình | 1k Ticket của tôi | 04 MH-OA-07: cột `Cập nhật`. Trạng thái rỗng `Bạn không có ticket nào đang mở.`, lỗi `Không tải được danh sách ticket.`. Alert "Bạn đang Vắng" (#7). Modal `Bàn giao` (Người nhận + Ghi chú ≥ 10 ký tự), `Giao cho…` của GS (UAT-OA-43, 108). `Xuất Excel` chỉ cho giám sát | Chỉ có bảng. Thiếu cột Cập nhật, rỗng, lỗi, Alert Vắng, cả hai modal. `Xuất Excel` hiện cho Lan (CSKH) | Vẽ bổ sung. Ẩn Xuất Excel với CSKH, hoặc ghi rõ Lan là trưởng nhóm có quyền xuất |
| 9 | Trung bình | 0d (MH-UI-05) | 00 MH-UI-05: trang `/me` gồm Trạng thái hiện tại, "Nghỉ phép sắp tới" (#9), cài đặt thông báo (#10), "Hội thoại đã tắt thông báo" (#10b). Dải vàng Ngoại tuyến trong ca (UAT-UI-91) | Chỉ có dropdown trạng thái trên header | Vẽ `/me` và dải `Bạn đang Ngoại tuyến nên không được chia khách mới.` + `Chuyển Trực tuyến` |
| 10 | Nhẹ | 1k cột Khung gửi | 00 §3.4a: Z1 còn > 6 giờ → `⏱ {h}h`. `⏱ Còn {h}g{m}` chỉ khi ≤ 6 giờ | TK-0142 `⏱ Còn 31g12`, trong khi TK-0150 cùng bảng ghi `⏱ 30h` | `⏱ 31h` |
| 11 | Nhẹ | 0d hộp thời hạn trạng thái | 00 MH-UI-05 #6: Đi thị trường "Tới lúc nào?" · `1 giờ` / `2 giờ` / `Tới hết giờ làm` / giờ tự chọn (mặc định Tới hết giờ làm). Vắng "Trong bao lâu?" · `30 phút` / `1 giờ` / `Tới hết giờ làm` | "đến khi nào? 2 giờ · Hết buổi · Hết ngày" | Dùng đúng chữ và lựa chọn |
| 12 | Nhẹ | 0d, 10c, 10g (số đếm) | Một bộ số cho cùng thời điểm | Chuông `3` nhưng drawer `Chưa đọc 4`. 10c `Cảnh báo (Mới 3)`, 10g `Cảnh báo (Mới 2)` | Thống nhất số |
| 13 | Nhẹ | 1f thẻ "Khách đã chia sẻ thông tin" | TD-C01a Trần Văn Tuấn `0900 000 101`, Garage Minh Phát ở Thanh Xuân | `SĐT 0900 *** 678, Địa chỉ Long Biên, Hà Nội`, số cũ còn sót. Panel cùng màn ghi Thanh Xuân | `0900 *** 101`, Thanh Xuân |
| 14 | Nhẹ | 3 Customer 360 | DK-49: cam kết chỉ lấy từ tin **đã gửi** có nêu cam kết | "Giá · Bộ côn Hilux · theo BG-2026-0915 · 09:18". Tin 09:18 là "em lên báo giá ngay", báo giá "chưa gửi". Ô Tương tác "Cuối trên Zalo hôm nay 09:32", trong khi tin cuối là 09:55 | Bỏ dòng cam kết giá, hoặc đổi sang tin có giá thật. Sửa 09:32 → 09:55 |
| 15 | Nhẹ | 3a Dòng thời gian | Rê chuột lên giờ: "đủ ngày giờ giây" | Hai sự kiện của nhóm "Thứ Hai, 28/09/2026" có tooltip `29/09/2026 17:20:00`, `29/09/2026 17:12:00` | Đổi thành 28/09 |
| 16 | Nhẹ | 10e ↔ 10d | 01 MH-PQ-13: chặn nạp lại (`ingest_tombstones`) chỉ tạo khi bấm "Thực hiện xóa" | 10e "Bỏ qua 14 bản ghi bị chặn theo NĐ13-0014", nhưng 10d vẫn để NĐ13-0014 ở "Chờ thực hiện" | Đổi phiếu 10d thành "Đã thực hiện", hoặc bỏ dòng ở 10e |
| 17 | Nhẹ | 1e, 10e (MH-SZ-12) | 03 MH-SZ-12a #7: phần "Nick của tổ" cho GS/GĐ. MH-SZ-12b: sale xem bản rút gọn (chỉ nick mình, 3 cột) | Chưa có góc nhìn GS của popover. 10e chỉ ghi chữ "sale chỉ thấy bản rút gọn" | Vẽ hai biến thể nhỏ, hoặc ghi "dev làm theo bảng 03" |
| 18 | Nhẹ | README / 6 | README D1 "MH-UI-01…06" bao cả MH-UI-04 (Tìm kiếm toàn cục) | Canvas 6 ghi MH-UI-04 là D2. Ô Ctrl K có trên header mọi màn D1 | BA sửa README: tách MH-UI-04 sang D2, hoặc ghi rõ D1 chỉ có ô tìm trên header |

**Lệch dữ liệu, không tính là lỗi thiết kế** (canvas theo đúng dữ liệu; bộ dữ liệu đang được sửa):
- **KB07 và TK0142 cùng dùng H20 nhưng trái nhau.**
  - KB07: tin OA của anh Tuấn lúc T−20′ (09:40). 3a và 360 (`⏱ 47h`) vẽ theo mốc này.
  - TK0142: "tin cuối trên H20 lúc T−16h48′", giữ cho Z1 "Còn 31 giờ 12 phút". 1f, 1c và 1k vẽ theo mốc này.
  - BA/QA dữ liệu chọn một: dời KB07 sang hội thoại khác, hoặc tính lại khung gửi của TK0142.
- **Kịch bản Toàn (KB-13 v1.3) có mốc sau giờ mẫu 10:00:** R11 lúc 10:08, gán Hải 10:15. Dữ liệu đang được sửa mốc nên chỉ ghi nhận, chưa coi là lỗi.

## Việc còn lại trước khi dev

**Phải xong để chốt D1** (điều kiện ở Kết luận):
1. Designer sửa #1, #2, #3, #4 và lỗi cũ #10 (khóa `Gửi báo giá` ở 1c Z1 Anh Tuấn/Lan).
2. BA:
   - Thống nhất người duyệt xin quyền (PQ-30 so với 00 UAT-UI-40).
   - Sửa 00 §2.2 cho GS ở `/channels` (lỗi cũ #12).
   - Sửa KB07/TK0142 trong `du-lieu-kiem-thu.md`.
   - Ghi rõ MH-UI-04 thuộc lô nào (#18).

**Màn chưa đủ trạng thái để dev làm / tester viết ca** (vẽ trước khi giao màn đó):

| Màn | Thiếu | Ca UAT bị chặn |
|---|---|---|
| 8 Kênh kết nối (MH-OA-01) | Kết nối OA, trang chi tiết OA, bật tin có phí, đơn giá (#6) | Ca MH-OA-01; tiền điều kiện của UAT-OA Z2 |
| 9c SLA (MH-OA-18) | Chế độ sửa, lỗi hợp lệ, Lịch sử; bảng phí hậu mãi chờ BA (#7) | UAT-OA-131 |
| 1k Ticket của tôi (MH-OA-07) | Rỗng, lỗi, modal Bàn giao / Giao cho…, Alert Vắng (#8) | UAT-OA-43, 108 |
| MH-UI-05 `/me` | Trang hồ sơ, cài đặt thông báo, dải Ngoại tuyến (#9) | UAT-UI-91 và các ca cài đặt thông báo |
| 10d Thời hạn lưu trữ | Bảng R1–R4 và luồng duyệt QS (#5) | Ca retention của 01 |

**Các màn còn lại đủ để giao dev và viết ca:**
- Khung chung: 0d (sau khi sửa #2, #3, #11), 0e (sau #1), 0f, 0g, 0h, 0i.
- Sale Zalo và giám sát: 1, 1a, 1b, 1d, 1e (sau #4), 1i, 1j, 1l, 2.
- CSKH: 1c (sau lỗi cũ #10), 1f, 1g, 1h.
- Khách đa kênh: 3, 3a, 3b.
- Quản trị: 9, 9a, 9b, 10, 10a (sau #1), 10b, 10c, 10e, 10f, 10g.

**Để dev làm theo đặc tả, không cần vẽ thêm:**
- OA-32: chống bấm Gửi hai lần trên kênh API.
- Các nhãn "chờ BA" còn lại: Nhóm theo NVKD và Nhắc {tên} ở 1d; "Quân đã nhận" ở 10c. BA chốt trước khi dev làm hai khối này.
- Mã câu hỏi `CH-1`, `Q20`, `Q21`: đổi sang mã có tiền tố file.
- Màu Bình luận / Email: chờ BA (lỗi cũ #27).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/qa-xac-nhan.md) | — |
