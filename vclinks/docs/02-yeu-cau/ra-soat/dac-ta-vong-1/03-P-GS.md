# Góp ý 03 — P-GS (Hương, giám sát)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Hương (P-GS, giám sát) góp ý đặc tả 03 Sale Zalo cá nhân bản v1.0, vòng 1; file lưu ngày 30/09/2026.
- 18 góp ý: **5 Chặn · 10 Nên sửa · 3 Gợi ý**; kèm 8 câu hỏi và 13 ca UAT đề xuất (UAT-SZ-GS01…GS13).
- Chặn: giám sát không có cách xem "tổ còn khách nào chưa trả lời" (thiếu lọc Chưa trả lời, Quá SLA, Người phụ trách); chưa định nghĩa "đã trả lời"; giám sát mở hội thoại làm khách thấy "Đã xem".
- Chặn: trả lời thay / trực thay (PQ-16, PQ-32 file 01) chưa có trên màn hình 03; bàn giao nick khi NVKD nghỉ việc bỏ sót nick còn đăng nhập trên điện thoại.
- Nên sửa: nick của tổ, lệnh gửi lỗi của tổ, luồng duyệt mẫu câu tổ, cảnh báo kéo khách sang nick riêng, cảnh báo nick giảm bạn bè, nhóm Zalo chỉ có một nick công ty.
- Kết quả xử lý ở [03-xu-ly.md](03-xu-ly.md): 14 đã sửa, 3 hỏi chủ dự án, 1 chuyển file 01.
- Còn mở: xưng tên khi trả lời thay (Q17), máy công ty hay máy riêng (Q18), cảnh báo giám sát rủi ro nick (Q19), các ngưỡng thời gian (Q13).

## Mục lục

- [Một ngày của tôi trên VClinks](#một-ngày-của-tôi-trên-vclinks)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Tài liệu viết rất kỹ cho NVKD: tôi đọc là hình dung được cả ô soạn, lệnh gửi, báo giá. Nhưng tài liệu tự ghi "Giám sát chỉ nhắc ở chỗ bàn giao / trả lời thay". Nên câu hỏi mỗi sáng của tôi, "tổ còn khách nào chưa trả lời", thì chưa màn hình nào trả lời được. Trả lời thay, trực thay và nghỉ việc đã có quy tắc ở file 01 (PQ-16, PQ-32, PQ-33). Có điều các màn hình của file 03, nơi tôi thật sự gõ và gửi, lại chưa thể hiện những quy tắc đó. Chỗ tôi lo nhất: nick Zalo vẫn nằm trên điện thoại của NVKD. Tài liệu coi như nick chỉ sống trong Chrome driver, nên các ca "NVKD nghỉ việc mà nick còn trên điện thoại" hay "NVKD đọc trên điện thoại nhưng không trả lời" đều bị bỏ sót.

## Một ngày của tôi trên VClinks

| Giờ | Việc của tôi | Màn hình | Thấy / làm được gì | Số thao tác | Vướng |
|---|---|---|---|---|---|
| 07:45 | Xem 7 nick của tổ có nick nào đỏ không | MH-SZ-12a | Chỉ thấy "Nick của tôi", không thấy nick của tổ | Không làm được | Phải hỏi từng bạn hoặc hỏi Admin |
| 07:50 | Hỏi "hôm qua còn khách nào chưa trả lời" | MH-SZ-01, phạm vi `Tất cả` | Thấy toàn bộ hội thoại của tổ, xếp theo giờ. Không có bộ lọc "Chưa trả lời", "Quá SLA" hay "Người phụ trách". `Chưa đọc` thì sai, vì NVKD đọc trên điện thoại là badge mất | 1 lần bấm phạm vi + mở từng hội thoại (vài chục lần) | Không trả lời được câu hỏi |
| 08:05 | Mở thử hội thoại của Minh để xem bạn ấy đã trả lời chưa | MH-SZ-03 | Xem được, nhưng thao tác này có thể làm Zalo mở hội thoại (SZ-15, QT-SZ-01 bước 3): khách thấy "Đã xem", Minh mất badge chưa đọc | 1 | Tôi xem để kiểm tra lại thành ra làm hại Minh |
| 08:15 | Minh báo ốm. Tôi trả lời khách của Minh trên nick "VCparts Minh" | MH-SZ-03, MH-SZ-05 | Theo 03: tôi gửi được, bong bóng ghi "Duyệt bởi Hương". Ô soạn không báo "đang trả lời thay", không có ghi chú nội bộ, không báo Minh. `{ten_nv}` thay bằng tên tôi dù tin đi từ nick Minh | 3–4/tin | Chưa rõ dùng "Trả lời thay" từng tin (PQ-16) hay tạo "Trực thay" cả ngày (PQ-32, file 01). 03 không dẫn tới |
| 08:30 | Xem lời mời kết bạn mới vào nick Minh | MH-SZ-10 | Bộ lọc chỉ có "Tất cả nick của tôi" | Không làm được nếu chưa tạo trực thay | Khách mới chờ cả ngày |
| 10:00 | Xem lệnh gửi lỗi của cả tổ | MH-SZ-13, `Tổ của tôi` | Có phạm vi tổ. Không lọc được theo NVKD, không biết lệnh lỗi đã nằm bao lâu | 2 | Tạm được |
| 11:00 | Duyệt mẫu câu tổ bạn Tú đề xuất (GS-09) | MH-SZ-06 | Có phạm vi "Nhóm", nhưng không có trạng thái "Chờ duyệt" và không có chỗ nào để tôi duyệt | Không làm được | |
| 14:00 | Tú báo nghỉ việc, còn làm 2 tuần | – | 03 không có gì cho giai đoạn báo nghỉ: Tú có thể gửi danh thiếp nick riêng, gửi STK riêng hay hủy kết bạn hàng loạt trên điện thoại mà tôi không biết | – | Rủi ro mất khách lớn nhất nằm ở 2 tuần này |
| 14:30 | Chuẩn bị bàn giao nick và khách của Tú | §2.4 → file 01 MH-PQ-04 | §2.4 chỉ có 3 gạch đầu dòng. Không nhắc tới điện thoại đang giữ nick, lệnh chờ của Tú, nhóm Tú làm trưởng nhóm, lời mời kết bạn đang chờ | – | Mâu thuẫn với PQ-33/34 |
| 16:00 | Tạo nhóm Zalo "Gara Minh Phát – VCparts" cho Minh (khách lớn) | MH-SZ-11 | Làm được. Nhóm do nick NVKD tạo thì công ty không có ai khác trong nhóm | 5–6 | Minh nghỉ việc thì nhóm chỉ còn nick của Minh |
| 17:30 | Xem hiệu suất tổ hôm nay | – (không có trong 03) | Không có số nào. Không biết tin trả lời gửi từ VClinks hay từ điện thoại | – | Cần biết hiệu suất lấy số từ đâu |

## Góp ý

| # | Màn hình / story / UAT (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | §1.2, MH-SZ-01 #4–#9, GS-01 | Giám sát không có cách nhìn "tổ đang có vấn đề gì". Phạm vi `Tất cả` chỉ là một danh sách dài. Không lọc được "Chưa trả lời", "Quá SLA", "Người phụ trách". Dòng hội thoại không ghi ai phụ trách. Sắp xếp theo quá SLA chỉ áp dụng cho "Của tôi". | Đây là câu hỏi đầu tiên mỗi sáng của tôi. Hiện tôi phải mở từng hội thoại. | Với GS, MH-SZ-01 thêm: (a) nút lọc `Chưa trả lời` và `Quá SLA`; (b) Select `Người phụ trách` (chọn nhiều); (c) tag tên NVKD trên mỗi dòng khi xem tổ; (d) một dải tóm tắt trên đầu danh sách: `Chưa trả lời: Minh 3 · Tú 1 · Lan 0`, bấm tên là lọc. Mục tiêu: ≤ 2 lần bấm từ lúc mở VClinks. | **Chặn** |
| 2 | MH-SZ-01 #5 `Chưa đọc`, KD-01, SZ-15 | "Chưa đọc" không dùng để đo được khách chờ. NVKD đọc trên điện thoại (A4) là badge mất, dù chưa trả lời. Tài liệu chưa định nghĩa "đã trả lời". | Nếu chỉ tính tin gửi từ VClinks thì NVKD trả lời trên điện thoại sẽ bị tính oan. Nếu tính theo đã đọc thì bỏ sót khách. | Định nghĩa trong 03: **Chưa trả lời** = tin cuối là của khách, và sau tin đó nick chưa gửi tin nào (từ VClinks **hoặc** từ điện thoại). Thời gian chờ chỉ tính giờ làm việc (F4.3). Tin chỉ có sticker, cảm xúc hay "ok" của khách thì không tính là đang chờ (cần chốt danh sách). | **Chặn** |
| 3 | QT-SZ-01 bước 3, SZ-15, MH-SZ-02 `Đánh dấu đã đọc`, MH-SZ-03 | Giám sát mở hội thoại để kiểm tra thì có thể khiến extension mở hội thoại trên Zalo Web: khách thấy "Đã xem" và badge chưa đọc trên máy NVKD biến mất. | Kiểm tra của tôi lại làm NVKD bỏ sót khách, và khách tưởng đã có người đọc mà không trả lời. | Thêm quy tắc SZ mới: khi người xem **không phải người giữ nick** (GS, GĐ, Viewer), mở hội thoại **không** gửi lệnh fetch và **không** đánh dấu đã đọc. Tin thiếu nội dung thì hiện nút `Lấy nội dung (khách sẽ thấy "Đã xem")` để GS tự quyết. Menu "Đánh dấu đã đọc" chỉ dành cho người giữ nick và người trực thay. | **Chặn** |
| 4 | MH-SZ-03 #38a, MH-SZ-05, MH-SZ-05e `{ten_nv}`, file 01 PQ-16, PQ-32 | Trả lời thay và trực thay đã có ở file 01 nhưng chưa có trên màn hình của 03: ô soạn không có dải "Bạn đang trả lời thay Minh trên nick VCparts Minh"; không có hộp xác nhận khi Minh đang trực tuyến; bong bóng chỉ ghi "Duyệt bởi", chưa ghi "Gửi bởi Hương (trả lời thay)"; không tự thêm ghi chú nội bộ; không báo Minh. Riêng `{ten_nv}` thành "Hương" trong khi tin đi từ nick Minh. | Khách thấy nick Minh mà lời chào lại là "em Hương", dễ hiểu lầm. Minh đi làm lại không biết tôi đã hứa gì với khách. | Đưa PQ-16, PQ-32 vào MH-SZ-03/05: dải vàng trên ô soạn, hộp xác nhận, nhãn bong bóng, ghi chú nội bộ tự động, thông báo cho người giữ nick. Hộp xác nhận hiện luôn câu đã thay biến. Thêm biến `{ten_nguoi_giu_nick}` và mẫu tổ `/traloithay` ("Dạ em là Hương, trưởng nhóm của Minh, hôm nay em hỗ trợ anh ạ"). | **Chặn** |
| 5 | §2.4, SZ-01, file 01 PQ-17/33/34 | Khi NVKD nghỉ việc, §2.4 chỉ nói "nick vẫn ở Chrome driver". Trên thực tế nick còn đăng nhập trên **điện thoại của NVKD**: sau khi bị khóa VClinks, bạn ấy vẫn nhắn khách được. Tài liệu cũng không nói gì về lệnh chờ đã duyệt của người nghỉ ("vẫn chạy"), nhóm do nick đó làm trưởng, lời mời kết bạn đang chờ, và tên nick "VCparts Tú" khi người giữ mới là người khác. | Đây đúng là ca "khách đi theo nick" trong BA §18.2. Khóa VClinks mà không thu nick trên điện thoại thì không giải quyết được. | Thêm vào 03 phần "Bàn giao nick", gồm danh sách việc bắt buộc, Admin/GS tick từng mục: ☐ đã đăng xuất Zalo trên điện thoại cũ và đổi mật khẩu / thu SIM; ☐ lệnh chờ chưa gửi của người nghỉ chuyển `Cần duyệt lại` (người giữ mới bấm), không tự chạy; ☐ lời mời kết bạn chuyển người giữ mới; ☐ đổi tên nick (tùy chọn). Chỉ cho `Hoàn tất bàn giao` khi mục đầu tiên đã tick. §2.4 dẫn đúng tới PQ-33/34. | **Chặn** |
| 6 | SZ-18, MH-SZ-01 "Quyền", Q7, file 01 PQ-13 | 03 viết NVKD chỉ thấy "khách mình phụ trách + nhóm có mình", còn 01 PQ-13 viết người giữ nick thấy **mọi** hội thoại trên nick. Người lạ nhắn nick Minh (chưa có owner) thì ai thấy, ai trả lời? | Nếu làm theo 03, khách lạ nhắn nick Minh sẽ không ai thấy, trong khi trên điện thoại Minh vẫn thấy. | Theo PQ-13: người giữ nick thấy hết hội thoại trên nick. Hội thoại chưa có owner hiện ở "Chưa phân công" của tổ và ở "Của tôi" của người giữ nick. Trả lời Q7: "Của tôi" = khách tôi phụ trách **+** mọi hội thoại trên nick tôi giữ. | **Nên sửa** |
| 7 | MH-SZ-12a, QT-SZ-01 bước 4, SZ-US-01 | Popover chỉ có "Nick của tôi", giám sát không thấy nick của tổ. Nick đỏ chỉ báo Admin. Muốn đăng nhập lại Zalo Web thì phải **quét QR bằng điện thoại giữ nick**, việc này Admin không tự làm được. | 7 giờ sáng tôi cần biết nick nào chết để sắp người. Admin nhận báo xong vẫn phải đi tìm NVKD. | GS có popover `Nick của tổ` (tên nick, người giữ, màu, số khách đang chờ trên nick đó). Nick đỏ > 15 phút trong giờ làm thì báo **người giữ nick + GS + Admin**. Câu hướng dẫn ghi rõ: `Cần {người giữ nick} quét mã QR trên điện thoại`. | **Nên sửa** |
| 8 | MH-SZ-13 #1, #3, SZ-11 | Phạm vi `Tổ của tôi` có rồi, nhưng không lọc được theo NVKD, không thấy lệnh lỗi đã treo bao lâu, và NVKD không xử lý thì không ai nhắc. Lệnh "Quá hạn" của NVKD vắng cứ nằm đó. | Khách tưởng đã được trả lời trong khi tin chưa đi. | Thêm Select `NVKD`, cột `Treo {n} phút`, sắp lỗi cũ nhất lên đầu. Lệnh lỗi hoặc quá hạn chưa xử lý > 30 phút thì báo GS. | **Nên sửa** |
| 9 | MH-SZ-06 #11, GS-09, Q5, file 01 PQ-27 | Có phạm vi "Nhóm" nhưng không có luồng duyệt: không có trạng thái `Chờ duyệt`, không có chỗ GS duyệt, không có thông báo. Chữ "Nhóm" dễ nhầm với nhóm Zalo. | GS-09 là MVP. Tôi cũng sợ ngày nào cũng phải duyệt. | Đổi "Nhóm" thành **"Tổ"**. NVKD bấm `Đề xuất cho tổ`, mẫu ở `Chờ duyệt` (chưa dùng được). GS duyệt/từ chối (có lý do) trong tab `Chờ tôi duyệt` của MH-SZ-06, duyệt được nhiều mẫu một lần. Mẫu cá nhân không cần duyệt, nhưng GS xem được. Trả lời Q5: như trên; STK chỉ Sale admin sửa (giữ đúng MH-SZ-05f). | **Nên sửa** |
| 10 | MH-SZ-05d Danh thiếp, MH-SZ-05f, SZ-16 | Tài liệu không có gì chống NVKD **kéo khách sang nick riêng**: gửi danh thiếp nick cá nhân, gửi STK cá nhân, gửi SĐT riêng, rủ "kết bạn Zalo riêng của em". Việc này làm được trên VClinks và cả trên điện thoại (tin vẫn đồng bộ về). | Đây là rủi ro mất khách thật sự. Ban giám đốc cũng sợ đúng chuyện này. | Cảnh báo **mềm** (không chặn gửi, không đọc hết tin cho GS): khi tin đi ra (từ VClinks hoặc điện thoại) có số tài khoản không nằm trong mẫu STK công ty, có danh thiếp không phải khách hay nick công ty, hoặc có SĐT không phải số công ty, thì tạo mục trong `Cần xem` của GS kèm link tới tin. Hộp danh thiếp hiện câu `Người này không phải khách hay nick công ty. Vẫn gửi?`. | **Nên sửa** |
| 11 | MH-SZ-09 ⋯ `Hủy kết bạn`/`Chặn`, Q8, MH-SZ-12b | NVKD hủy kết bạn, rời nhóm hoặc xóa hội thoại trên điện thoại thì VClinks có số (số bạn bè trong `/sync`) nhưng không ai được báo. | Người sắp nghỉ hay xóa khách trước khi đi. | Số bạn bè hoặc số nhóm của một nick giảm quá ngưỡng (ví dụ > 10 trong 24h) thì báo GS: `Nick VCparts Tú giảm 35 bạn bè trong 24 giờ`, kèm danh sách người bị hủy. Trả lời Q8: chỉ GS trở lên được Chặn / Hủy kết bạn trên VClinks. | **Nên sửa** |
| 12 | MH-SZ-01 #9j, PQ-16 "đang trực tuyến" | "Đang được {NV} trả lời" chỉ biết người đang gõ trên VClinks. Minh gõ trên điện thoại thì hệ thống không biết, nên tôi và Minh có thể trả lời trùng. | Khách nhận hai câu trả lời khác nhau, trông rất thiếu chuyên nghiệp. | Tiêu đề MH-SZ-03 hiện `Tin gần nhất của nick: 08:12 (từ điện thoại)`. Hộp xác nhận trả lời thay coi người giữ nick là "đang hoạt động" nếu nick gửi tin trong 5 phút gần đây, kể cả gửi từ điện thoại. | **Nên sửa** |
| 13 | MH-SZ-11, QT-SZ-06, KD-16 | Nhóm do nick NVKD tạo thì chỉ có một nick công ty. NVKD nghỉ hoặc nick bị khóa là công ty mất nhóm. Nhóm tạo trên điện thoại thì không có "Mục đích" và "Gắn khách". | Nhóm với garage lớn là tài sản bán hàng. | MH-SZ-11 gợi ý sẵn thêm **GS (hoặc nick chung của tổ)** làm thành viên, sau khi tạo thì đặt làm phó nhóm (khi Zalo cho phép). Tab `Nhóm` (MH-SZ-09) có lọc `Chưa gắn khách` và cột `Nick trưởng nhóm`. Lúc bàn giao nick, liệt kê các nhóm nick đó làm trưởng. | **Nên sửa** |
| 14 | MH-SZ-10 #1 `Nick` | Lời mời kết bạn chỉ xem được "nick của tôi". NVKD vắng thì khách mới chờ cả ngày. Lời mời để lâu không ai nhắc. | Khách mới tự tìm đến là khách nóng. | GS có `Tất cả nick của tổ`; người trực thay thấy nick của người vắng. Lời mời chưa xử lý > 4 giờ làm việc thì báo người giữ nick; > 1 ngày thì báo GS. | **Nên sửa** |
| 15 | §7 UAT | Trong 48 ca mới không có ca nào của giám sát: trả lời thay, trực thay, xem mà không đánh dấu đã đọc, nick của tổ, lệnh lỗi của tổ, duyệt mẫu câu tổ, bàn giao nick. | 03 là tài liệu P-GS phải góp ý, mà không có ca để nghiệm thu. | Thêm các ca ở mục "Kịch bản UAT tôi muốn thêm" dưới đây. | **Nên sửa** |
| 16 | §2 "17:30 báo giám sát bàn giao" | NVKD muốn nghỉ phải nhắn riêng cho tôi, rồi tôi vào file 01 tạo trực thay. | Mất 2 bước và dễ quên. Sáng hôm sau khách không có người trả lời. | NVKD có nút `Đăng ký vắng` (từ ngày – đến ngày, đề xuất người trực). GS nhận một thông báo, bấm `Đồng ý` là trực thay có hiệu lực. | **Gợi ý** |
| 17 | Quyền riêng tư NVKD (§1, SZ-01) | Tài liệu không nói NVKD được báo trước rằng mọi tin trên nick công ty (kể cả tin gửi từ điện thoại) được lưu và cấp trên xem được. NVKD cũng không biết ai đã trả lời thay trên nick mình. | Không nói trước thì dễ va chạm: bạn Minh (P-KD) "sợ bị soi từng tin". | Ghi một quy tắc: nick công ty chỉ dùng việc công. Khi NVKD nhận nick, họ xác nhận đã đọc thông báo (lưu lại như BR15). Người giữ nick xem được danh sách "Trả lời thay trên nick tôi". GS xem hội thoại trong tổ thì không cần xin quyền, nhưng không có chức năng "xuất toàn bộ chat của một NVKD". | **Gợi ý** |
| 18 | Hiệu suất (GS-06), bong bóng tin | 03 không ghi nguồn của tin gửi đi: từ VClinks, từ điện thoại, hay GS trả lời thay. | Cuối ngày tôi cần FRT đúng từng người và không muốn đếm oan. Tôi cũng sợ màn hình quản lý có quá nhiều số. | Mỗi tin gửi đi lưu `nguồn gửi` (VClinks / điện thoại / trả lời thay / trực thay) và người gửi thật, để báo cáo F10.2 dùng. Đầu MH-SZ-01 của GS chỉ cần 4 số: `Chưa trả lời · Quá SLA · Lệnh lỗi · Nick đỏ`, bấm vào số nào thì lọc theo số đó. | **Gợi ý** |

**Tổng:** 5 Chặn · 10 Nên sửa · 3 Gợi ý.

## Câu hỏi của tôi

1. Khi NVKD nghỉ ốm một ngày, tôi nên dùng "Trả lời thay" từng tin hay tạo "Trực thay" cả ngày? 03 nên nói rõ khi nào dùng cách nào, và đặt nút vào đâu trong khung chat.
2. Trả lời thay trên nick NVKD thì tôi xưng tên mình hay tên NVKD? Công ty muốn khách biết là người khác đang trả lời hay không? (Việc này ảnh hưởng `{ten_nv}` và mẫu câu.)
3. Điện thoại giữ nick là máy công ty hay máy riêng của NVKD? Nếu là máy riêng thì khi nghỉ việc ai chịu trách nhiệm đăng xuất Zalo và đổi mật khẩu, và VClinks kiểm tra việc đó bằng cách nào?
4. Mỗi NVKD giữ một nick hay có nick dùng chung (popover có "VCparts Hà (dùng chung)")? Nếu dùng chung thì ai là "người giữ nick" theo PQ-17?
5. Tin khách nhắn ngoài giờ làm (tối, Chủ nhật) có tính vào "Chưa trả lời" sáng hôm sau không? Giờ làm việc của tổ do ai cài đặt?
6. Tin NVKD gửi từ điện thoại có được tính là "đã trả lời" trong SLA và hiệu suất không? (Tôi đề nghị có.)
7. Cảnh báo "kéo khách sang nick riêng" (góp ý 10) do tôi xem hay do kiểm soát nội bộ xem? Tôi không muốn tổ nghĩ tôi soi tin.
8. Màn hình "tổ hôm nay" và hiệu suất (GS-01, GS-06) nằm ở file nào? Nếu không nằm trong 03 thì 03 cần dẫn sang file đó.

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Bước | Kết quả mong đợi |
|---|---|---|
| UAT-SZ-GS01 | Khách nhắn nick NVKD A lúc 08:00. A đọc trên điện thoại nhưng không trả lời. 08:20 GS mở MH-SZ-01, lọc `Chưa trả lời` | Hội thoại có trong danh sách, ghi tên A, thời gian chờ 20 phút, dù badge chưa đọc đã mất |
| UAT-SZ-GS02 | Như GS01 nhưng A trả lời từ điện thoại lúc 08:10 | Hội thoại **không** nằm trong `Chưa trả lời`; FRT của A = 10 phút |
| UAT-SZ-GS03 | GS mở một hội thoại của A đang có tin chưa đọc và thiếu nội dung | Trên Zalo, tin khách **không** chuyển "Đã xem"; badge của A còn nguyên; khung chat có nút `Lấy nội dung (khách sẽ thấy "Đã xem")` |
| UAT-SZ-GS04 | A vắng. GS trả lời thay trong hội thoại của A bằng mẫu `/traloithay` | Dải "Bạn đang trả lời thay A trên nick …"; hộp xác nhận hiện câu đã thay biến; bong bóng `Gửi bởi Hương (trả lời thay)`; có ghi chú nội bộ; A nhận thông báo; nhật ký `reply_on_behalf` |
| UAT-SZ-GS05 | A vừa gửi tin từ điện thoại 2 phút trước. GS bấm Gửi trả lời thay | Hộp `A đang trực tuyến và phụ trách hội thoại này. Vẫn trả lời thay?`; Hủy thì không tạo lệnh |
| UAT-SZ-GS06 | GS tạo trực thay A → B trong 1 ngày | B thấy hội thoại và lời mời kết bạn trên nick A, gửi được; tin ghi `trực thay A`; hết hạn thì B mất quyền |
| UAT-SZ-GS07 | Tắt extension của nick A 20 phút trong giờ làm | GS thấy nick A đỏ trong `Nick của tổ`; A và GS nhận thông báo có câu "quét mã QR trên điện thoại" |
| UAT-SZ-GS08 | Tạo lệnh lỗi trên hội thoại của A, để 30 phút | MH-SZ-13 `Tổ của tôi` lọc theo A thấy lệnh `Treo 30 phút`; GS nhận thông báo |
| UAT-SZ-GS09 | NVKD đề xuất mẫu `/khuyenmai` cho tổ | Mẫu ở `Chờ duyệt`, NVKD khác chưa gõ `/khuyenmai` được; GS duyệt thì cả tổ dùng được; GS không duyệt được mẫu do chính mình đề xuất |
| UAT-SZ-GS10 | Từ điện thoại, nick A gửi cho khách một số tài khoản lạ và danh thiếp một nick không phải của công ty | Tin vẫn đồng bộ về; GS có 2 mục trong `Cần xem` kèm link tới tin; tin không bị chặn |
| UAT-SZ-GS11 | Hủy kết bạn 12 người trên nick A trong 1 giờ (nick test) | GS nhận cảnh báo `giảm 12 bạn bè`, kèm danh sách |
| UAT-SZ-GS12 | Bàn giao nick A cho B khi A nghỉ việc, A còn 1 lệnh `Đang chờ gửi` | Không bấm được `Hoàn tất` khi chưa tick "đã đăng xuất điện thoại cũ"; sau bàn giao, lệnh của A chuyển `Cần duyệt lại` và không tự gửi; các nhóm A làm trưởng được liệt kê |
| UAT-SZ-GS13 | Người lạ (chưa có owner) nhắn nick A | Hội thoại hiện ở "Của tôi" của A và ở "Chưa phân công" của tổ |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/03-P-GS.md) | — |
