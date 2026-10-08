# Góp ý 01 — P-GS (Hương)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý vòng 1 của Hương (P-GS, giám sát) cho đặc tả 01 Phân quyền, đi qua các ca trực thay, bàn giao, chuyển khách.
- 19 góp ý: 4 Chặn, 12 Nên sửa, 3 Gợi ý; kèm 8 câu hỏi và 14 kịch bản UAT đề xuất.
- Ghi nhận các góp ý của mình ở đặc tả 03 đã được 01 giải quyết (trực thay, trả lời thay, khóa người nghỉ việc).
- Chặn 1 và 3: giám sát không được giữ nick, không chấp nhận kết bạn hay tạo nhóm khi trực thay, mâu thuẫn PQ-34 và §2.5.
- Chặn 2: với khách của chính mình giám sát vẫn phải bấm Hiện SĐT, bị ghi nhật ký và tính vào ngưỡng 20 lần/giờ.
- Chặn 4: bàn giao nick không có bước xác nhận Zalo đã đăng xuất trên điện thoại người nghỉ và đã đổi mật khẩu.
- Nên sửa đáng chú ý: giám sát không tạm khóa được người đang kéo khách đi, không xin chuyển khách về tổ, không xem quy tắc chia khách. Kết quả xử lý: xem [01-xu-ly.md](01-xu-ly.md).

## Mục lục

- [Tôi đi qua các tình huống](#tôi-đi-qua-các-tình-huống)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

File 01 cho tôi yên tâm hơn nhiều so với lúc đọc 03. Trực thay có hiệu lực ngay khi tôi tạo, không phải chờ ai duyệt. Trả lời thay có hộp xác nhận và báo cho người giữ nick. Người nghỉ việc bị khóa trong vòng 1 phút, và nếu quá 24 giờ chưa bàn giao thì khách tự về tổ. Nhưng khi tôi đi qua từng ca thật thì thấy file này viết cho giám sát "chỉ quản lý": ma trận không cho giám sát **giữ nick**, **không cho thấy SĐT khách của chính mình**, và không cho nhận lời mời kết bạn, trong khi tôi vẫn bán hàng hằng ngày và lúc trực thay tôi phải làm đúng việc của NVKD. Chỗ tôi lo thứ hai: tôi không chủ động được ở những ca quan trọng nhất. Tôi không tạm khóa được người đang kéo khách đi. Tôi không xin chuyển được khách của tổ khác về tổ mình. Tôi cũng không xem hay chỉnh được quy tắc chia khách mới của tổ.

**Góp ý 03 đã được 01 giải quyết:**
- #6 (người giữ nick thấy gì): PQ-13 và phạm vi `NICK` đã trả lời đúng như tôi đề xuất.
- #7 (nick của tổ): đã giải quyết một phần. Ma trận cho GS `channel.status = TỔ`, nhưng màn hình chưa có.
- #9 (duyệt mẫu câu tổ): đã giải quyết về quyền (`template.group_manage = TỔ`, PQ-27 không tự duyệt). Luồng màn hình vẫn chưa có.
- #4 (trả lời thay): quy tắc PQ-16 và UAT-PQ-18 đầy đủ. Phần hiển thị thuộc file 03.
- #5 (bàn giao): PQ-33/34 đã lo được khách, nick, nhắc việc và mốc 24 giờ.

**Chưa được giải quyết** (không nhắc lại chi tiết ở đây):
- #5: điện thoại còn giữ nick và lệnh chờ của người nghỉ.
- #3: GS mở hội thoại làm khách thấy "Đã xem".
- #12: không biết người giữ nick đang trực tuyến trên điện thoại.
- #16: NVKD tự đăng ký vắng.

## Tôi đi qua các tình huống

| # | Tình huống | Làm được không | Ai duyệt, bao lâu | Rủi ro NVKD mang khách đi / vướng |
|---|---|---|---|---|
| 1 | **Minh ốm 3 ngày** (báo lúc 07:30). Tôi tạo trực thay cho Bình | Được: MH-PQ-07 → "+ Tạo trực thay", 4 ô, có hiệu lực ngay | Không cần duyệt, khoảng 1 phút | (a) Minh có 200 khách, mà chỉ giao được **một** người trực (không trùng khoảng thời gian), nên tôi không chia được cho Bình và Lan. (b) Bình được `CT` của Minh nên thấy **đầy đủ SĐT, công nợ, doanh số** của 200 khách trong 3 ngày mà không có nhật ký. (c) Minh vẫn đọc và trả lời trên điện thoại, dễ trả lời trùng Bình vì trực thay không có hộp xác nhận như PQ-16. (d) Bình chốt đơn cho khách của Minh thì doanh số tính cho ai? |
| 1b | Tôi tự trực thay Minh | Trên giấy thì được, vì người trực có thể là GS. Nhưng cột GS ở §3.5 ghi `friend.respond` và `group.manage` là ✖ | – | Tôi không nhận được lời mời kết bạn của khách mới vào nick Minh. Tôi cũng không biết mình có phải bấm "Hiện" mỗi lần xem SĐT khách của Minh không (PQ-31 nói quyền tạm thời không cho "luôn hiện", còn PQ-32 lại cho `CT`) |
| 2 | **Tú nộp đơn nghỉ, còn làm 2 tuần** | Không có gì cho giai đoạn này. `user.lock` và `user.offboard` của GS đều là ✖ | Phải nhờ GĐ khóa. Có khóa rồi tôi mới bàn giao được (MH-PQ-04) | Suốt 2 tuần, Tú thấy SĐT của cả 180 khách ở chế độ "luôn hiện", **không có nhật ký**, nên ngồi chép danh sách được. Nếu phát hiện Tú đang kéo khách lúc 21:00, tôi không tự tạm khóa được |
| 2b | Ngày nghỉ: GĐ khóa, tôi chia khách | Được. Có "Chia đều cho nhiều người" | Tôi tự làm trong tổ. Quá 24 giờ thì khách về "Chưa phân công" và nick giao tạm cho tôi | "Chia đều" tính theo **số khách**, không tính doanh số hay khu vực, nên cả tổ sẽ cãi nhau. Nick giao tạm cho tôi nhưng §2.5 không cho vai trò GS nhận mức `giu_nick`, và §3.5 GS không nhận được lời mời kết bạn |
| 3 | **Garage chuyển từ khu HN2 sang khu tổ tôi** | Chỉ xin **xem** được (MH-PQ-11, tối đa 7 ngày) | GĐ duyệt vì khác tổ (PQ-30). Không có hạn duyệt, không nhắc, không có người duyệt thay khi GĐ vắng | Tôi không **xin chuyển** khách về tổ được: `cust.transfer_request` của GS là ✖, chỉ NVKD có. Chị Lan (GS HN2) cũng không được hỏi ý kiến. Muốn nhận khách thì tôi phải nhờ NVKD tổ mình gửi yêu cầu |
| 4 | **CSKH đọc chat khách của tổ tôi** | Hội thoại trên OA/Fanpage: CSKH thấy hết. Hội thoại trên nick NVKD: chỉ khi có ticket, chỉ đọc | Không ai duyệt. Ticket do trưởng nhóm CSKH giao | Tạm ổn, và tôi đồng ý với D3. Có hai điểm: (a) khi có ticket, CSKH đọc được **toàn bộ** lịch sử chat trên nick, kể cả đoạn NVKD mặc cả giá; (b) PQ-19 dồn yêu cầu "Nhận xử lý" của CSKH về tôi mà không có thời hạn. Tôi đang bán hàng thì khách lại chờ thêm |
| 5 | **Marketing giao lead cho tổ** | Được. Lead vào "Chưa phân công" của tổ, tôi chia | Tôi chia tay, hoặc chia theo quy tắc tự động do **GĐ** đặt (`config.sla`, cột GS là ✖) | Tôi không thấy quy tắc chia, cũng không thấy bảng "tháng này mỗi bạn nhận bao nhiêu lead", nên không trả lời được khi tổ hỏi "sao Bình được nhiều lead hơn". Lead nằm ở hàng tổ thì không ai nhắc. Khi lead đã về tổ nhưng chưa có owner, marketing có còn trả lời lead được không (PQ-21)? |
| 6 | **Tôi muốn xem SĐT khách để gọi** | Được, bấm "Hiện" và số hiện 60 giây | Không cần duyệt. Quá 20 lần/giờ thì hệ thống báo GĐ và kiểm soát | Sáng nào tôi cũng gọi 15–25 khách quá hạn của tổ, và trong 60 giây không kịp chép số để bấm gọi trên điện thoại. Tôi sẽ bị báo "bất thường" gần như mỗi ngày. Tệ hơn: **khách của chính tôi** cũng phải bấm Hiện, vì cột GS là "TỔ: Hiện +NK" chứ không có "CT: luôn hiện" |

## Góp ý

| # | Màn/quy tắc (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | §2.5 mức `giu_nick`, §2.1 "GS kiêm NVKD", PQ-34 | Vai trò GS không có trong danh sách được nhận mức `giu_nick`. Nghĩa là giám sát không có nick riêng, trong khi PQ-34 lại giao nick tạm cho GS. Hai chỗ mâu thuẫn nhau. | Tôi vừa bán vừa quản lý, có khách riêng và dùng nick công ty hằng ngày. Không giữ được nick thì tôi không dùng VClinks để bán được. | Thêm `giam_sat_bh` (và `giam_doc_bh`, nếu division cho phép) vào danh sách được nhận `giu_nick`. Khi GS giữ nick, GS có đủ quyền của người giữ nick trên nick đó. | **Chặn** |
| 2 | §3.2 `cust.phone_full` cột GS, §2.1 "phạm vi TỔ đã bao gồm khách của chính mình" | Ô của GS ghi "TỔ: Hiện +NK", nên với **khách của chính tôi** tôi cũng phải bấm Hiện, bị ghi nhật ký và bị tính vào ngưỡng 20 lần/giờ. | NVKD thấy SĐT khách mình mà không cần bấm, còn tôi cũng là owner thì lại phải bấm. Như vậy vừa bất công vừa làm tôi dễ bị báo "bất thường". | Đổi ô GS thành "CT, NICK: luôn hiện · phần còn lại của TỔ: Hiện +NK". Ghi rõ quy tắc: owner và người giữ nick luôn thấy SĐT, **bất kể vai trò**. | **Chặn** |
| 3 | §3.5 `friend.respond`, `group.manage` cột GS (✖); PQ-32; PQ-34 | Khi GS trực thay hoặc giữ nick tạm, GS không chấp nhận được lời mời kết bạn, không tạo được nhóm. §2.5 nói người giữ nick "chấp nhận lời mời kết bạn; tạo nhóm", nên ma trận và §2.5 mâu thuẫn nhau. | Lời mời kết bạn là khách mới tự tìm đến. Trong 3 ngày NVKD vắng mà không ai nhận thì mất khách. | Quy tắc chung: mọi quyền gắn với **nick** (`friend.respond`, `group.manage`, `msg.recall` tin của nick) đi theo phạm vi `NICK`, tức người giữ nick và người trực thay, **không phụ thuộc cột vai trò**. Sửa ô GS thành "NICK". | **Chặn** |
| 4 | MH-PQ-04 bước ③, PQ-17, PQ-33 | Bàn giao nick chỉ đổi người giữ nick trên VClinks. Không có bước nào xác nhận Zalo đã được đăng xuất trên **điện thoại của người nghỉ** và mật khẩu đã được đổi. Chữ "Admin xác nhận chuyển thiết bị" ở PQ-17 không có trên màn hình. | Đây là đường mất khách lớn nhất (đã nêu ở 03 #5). File 01 là nguồn chuẩn về bàn giao nên phải có ở đây. | Bước ③ thêm checklist bắt buộc cho mỗi nick: ☐ đã đăng xuất Zalo trên điện thoại cũ và đổi mật khẩu / thu SIM (người xác nhận, giờ); ☐ lệnh gửi chưa chạy của người nghỉ chuyển sang `Cần duyệt lại`. Chỉ bật `Hoàn tất bàn giao` khi đã tick cả hai. Thêm UAT. | **Chặn** |
| 5 | §3.6 `user.lock` cột GS (✖), MH-PQ-02 | GS không tạm khóa được người trong tổ, kể cả khi đang có sự cố, ví dụ NVKD gửi danh thiếp nick riêng cho hàng loạt khách lúc tối. | GĐ không phải lúc nào cũng có mặt. Mỗi giờ chậm trễ là thêm khách bị kéo đi. | Cho GS **Tạm khóa khẩn** người trong tổ, lý do bắt buộc. GĐ nhận thông báo ngay và là người duy nhất mở khóa. Khi tạm khóa, hệ thống hỏi luôn "Tạo trực thay cho <tên>?", vì hiện nay tạm khóa thì "nick giữ nguyên" và không ai trả lời nick đó. | **Nên sửa** |
| 6 | PQ-33, MH-PQ-02 trạng thái người dùng | Không có trạng thái "**Sắp nghỉ**" cho giai đoạn báo trước. Suốt thời gian này NVKD vẫn thấy toàn bộ SĐT ở chế độ "luôn hiện", không có nhật ký. | Người sắp nghỉ chép danh sách khách mà không để lại dấu vết. BGĐ cũng lo đúng chuyện này. | GS hoặc GĐ đặt cờ "Sắp nghỉ (ngày nghỉ dự kiến)". Khi có cờ: SĐT của người đó chuyển sang "Hiện +NK", ngưỡng cảnh báo thấp hơn (ví dụ 5 lần/giờ), và GS thấy nhật ký xem SĐT hằng ngày của họ. Đến ngày dự kiến thì nhắc GĐ khóa. | **Nên sửa** |
| 7 | MH-PQ-07 #4–#6, PQ-32 | Mỗi người vắng chỉ có **một** người trực trong một khoảng thời gian, và người trực nhận **toàn bộ** `CT` + `NICK`. | Minh có 200 khách, dồn hết cho một người trong 3 ngày là quá tải. Tổ cũng thấy không công bằng khi chỉ một người gánh. | Cho chọn nhiều người trực: một người giữ **nick** (trả lời mọi tin trên nick Minh), các người khác nhận **nhóm khách** theo khu vực hoặc tag. Hoặc tối thiểu cho 2 người trực cùng khoảng thời gian, người thứ hai chỉ trả lời. | **Nên sửa** |
| 8 | PQ-32 so với PQ-31, §3.2 | Trực thay trao `CT` nên người trực thấy đầy đủ SĐT, công nợ, doanh số của mọi khách người vắng mà không có nhật ký. Trong khi đó PQ-31 nói quyền tạm thời không bao giờ cho "luôn hiện". | NVKD nhận trực thay có thể chép khách của đồng nghiệp. NVKD vắng cũng không yên tâm khi giao khách cho người khác. | Trực thay: người trực xem SĐT theo dạng "Hiện +NK". Khối doanh số và hạng khách chỉ hiện khi đang mở hội thoại của khách đó, không có danh sách tổng hợp. Khi quay lại, người vắng xem được "Trong lúc tôi vắng: ai trực, đã trả lời bao nhiêu khách, đã hiện SĐT bao nhiêu lần". | **Nên sửa** |
| 9 | PQ-32, PQ-16 | Trực thay chưa có các thứ mà trả lời thay đã có: không có hộp xác nhận khi người vắng vẫn đang trả lời, không có ghi chú nội bộ tự động, không báo người vắng. | Minh ốm nhưng vẫn cầm điện thoại. Bình và Minh trả lời cùng một khách, hai câu khác nhau. | Áp PQ-16 cho trực thay: nếu nick vừa gửi tin trong 5 phút gần nhất (kể cả từ điện thoại) thì hiện hộp xác nhận. Mỗi hội thoại có tin trực thay thì tự thêm ghi chú nội bộ. Cuối mỗi ngày gửi người vắng một bản tóm tắt. | **Nên sửa** |
| 10 | Trực thay, trả lời thay, bàn giao; báo cáo `report.performance` | File không nói **doanh số, báo giá và đơn** phát sinh trong lúc trực thay hoặc sau khi trả lời thay được tính cho ai. | Đây là chuyện tranh chấp số 1 trong tổ. Không có quy tắc thì mỗi lần trực thay là một lần cãi nhau. | Chốt quy tắc: đơn và doanh số tính cho **owner** của khách. Trực thay chỉ tính vào "số tin trả lời / FRT" của người trực. Báo cáo hiệu suất có cột "Trả lời hộ" riêng. Đưa quy tắc này vào câu hỏi mở nếu cần chủ dự án chốt. | **Nên sửa** |
| 11 | MH-PQ-04 #6 "Chia đều cho nhiều người" | Chia đều theo **số khách**. Không xem trước được doanh số 12 tháng, hạng hay khu vực của phần mỗi người nhận. | 30 khách hạng A khác xa 30 khách vãng lai. Tổ sẽ nói tôi chia thiên vị. | Thêm cách chia "Theo khu vực / tag" và "Cân theo doanh số 12 tháng". Bảng xem trước có cột: số khách, tổng doanh số, số khách hạng A của từng người nhận. Sửa tay từng dòng được trước khi hoàn tất. | **Nên sửa** |
| 12 | §3.2 `cust.transfer_request` cột GS (✖), `cust.handover` (17), PQ-30 | Khách chuyển vùng sang khu của tổ tôi: tôi chỉ xin **xem** được, không xin **chuyển** được. GS tổ đang giữ khách không được hỏi ý kiến, và GĐ duyệt một mình. | Chuyển khách giữa hai tổ là việc giữa hai giám sát. Không có luồng chính thức thì sẽ thành tranh chấp ngoài hệ thống. | Cho GS gửi "Yêu cầu chuyển khách về tổ" (lý do + khu vực mới). GS tổ nguồn bấm Đồng ý hoặc Phản đối kèm lý do, rồi GĐ chốt. Nếu hai GS cùng đồng ý và GĐ đã bật "tự duyệt khi 2 GS đồng ý" thì khách được chuyển luôn. | **Nên sửa** |
| 13 | MH-PQ-07, PQ-30, MH-PQ-11 #5 | Yêu cầu quyền tạm thời không có hạn duyệt, không có nhắc việc, không có người duyệt thay khi GĐ hay GS nghỉ phép. Người duyệt đi vắng là yêu cầu nằm đó. | Khách chuyển vùng gọi tới mà phải chờ GĐ cả ngày. Tôi cũng không muốn mở VClinks ra là thấy yêu cầu tồn từ hôm qua. | Yêu cầu chờ quá 2 giờ làm việc thì nhắc người duyệt, quá 4 giờ thì chuyển lên cấp trên. Thêm "Người duyệt thay" gắn vào trực thay của GS/GĐ. Tab "Chờ tôi duyệt" gom thành một thông báo mỗi buổi, không bắn từng yêu cầu một. | **Nên sửa** |
| 14 | MH-PQ-07 tab "Tất cả trong phạm vi", `grant.revoke` "TỔ (do mình duyệt)" | Người ngoài tổ được GĐ cho xem khách của tổ tôi (SA, KT, NVKD tổ khác, Admin hỗ trợ kỹ thuật) thì tôi không được báo, và không chắc có thấy trong tab đó không. | Tôi chịu trách nhiệm khách của tổ, nên cần biết ai đang xem khách của tổ mình. | Mọi quyền tạm thời mà **đối tượng** thuộc tổ tôi đều hiện trong tab "Tất cả trong phạm vi" và báo cho tôi một dòng. Tôi không thu hồi được quyền do GĐ duyệt, nhưng bấm được "Báo GĐ xem lại". | **Gợi ý** |
| 15 | PQ-37, MH-PQ-12 | Số chỉ hiện trong 60 giây, và ngưỡng 20 lần/giờ tính chung cho mọi vai trò. Không có nút gọi. | Mỗi sáng GS gọi 15–25 khách quá hạn. Hiện 60 giây rồi chép tay sang điện thoại thì dễ gọi nhầm, lại hay chạm ngưỡng. | Thêm nút `Gọi` (mở `tel:` trên điện thoại). Bấm Gọi được ghi nhật ký như một lần Hiện nhưng không làm lộ số lên màn hình. Ngưỡng cấu hình **theo vai trò** (GS mặc định 40/giờ). Cảnh báo gửi GĐ trước, sau đó mới tới kiểm soát. | **Nên sửa** |
| 16 | PQ-22, `config.sla` cột GS (✖), `lead.route` | Lead giao về tổ nằm ở "Chưa phân công" mà không có hạn. GS không xem được quy tắc chia tự động, không có bảng lead đã chia cho từng NVKD. Chưa rõ marketing còn trả lời lead được không khi lead đang ở hàng của tổ. | "Chia khách mới công bằng" là việc chính của tôi. Lead nguội sau vài giờ. Nếu marketing và NVKD cùng trả lời một lead thì trùng. | GS **xem** được quy tắc chia của tổ (sửa được nếu GĐ cho phép). Có bảng "Lead / khách mới đã chia tháng này theo NVKD". Lead nằm ở hàng tổ quá 30 phút làm việc thì báo GS. Định nghĩa rõ: lead đã giao cho tổ thì **không còn** là "Lead chưa giao", marketing chỉ đọc, không gửi. | **Nên sửa** |
| 17 | PQ-19, D4 | Yêu cầu "Nhận xử lý" của CSKH đều dồn về GS của owner, không có thời hạn và không có mặc định nào khi GS không trả lời. | Tôi đang gọi khách hoặc đang ở gara thì khách OA chờ thêm. Mỗi ngày tôi sẽ có thêm vài yêu cầu phải duyệt. | GS đặt cho tổ: "Cho CSKH tự nhận khi quá SLA X phút và owner không trả lời". Yêu cầu chờ GS quá 15 phút thì tự chuyển cho người trực thay (nếu có), không có người trực thay thì cho CSKH nhận. Owner nhận thông báo. | **Nên sửa** |
| 18 | D3, `TK` §2.3 | Ticket mở ra thì CSKH đọc được **toàn bộ** lịch sử chat trên nick NVKD, kể cả đoạn mặc cả giá và chiết khấu riêng. NVKD không biết CSKH đã đọc. | Quyền riêng tư của NVKD: họ sợ bị người ngoài tổ soi, và giá riêng cho khách là thông tin nhạy cảm. | Mặc định CSKH thấy chat trên nick trong **30 ngày trước ticket**, muốn xem xa hơn thì bấm "Xem thêm" (có nhật ký). NVKD owner thấy dòng "CSKH <tên> đã mở hội thoại này lúc …" trong ghi chú hệ thống. | **Gợi ý** |
| 19 | `audit.view` cột GS (24), NVKD "Hoạt động của tôi" | GS xem được nhật ký thao tác của cả tổ, gồm giờ đăng nhập và những lần xem SĐT. Không có quy tắc nào nói NVKD được báo trước hay được xem ai đã tra nhật ký của mình. | Tôi không muốn tổ nghĩ tôi theo dõi từng người. Minh (P-KD) sợ nhất là bị soi. | Ghi quy tắc: việc GS tra nhật ký của một người cũng được ghi nhật ký. Người đó thấy trong "Hoạt động của tôi" dòng "Giám sát đã xem nhật ký của bạn (ngày)". Trang đầu MH-PQ-10 của GS mặc định chỉ hiện cảnh báo (vượt ngưỡng Hiện SĐT, xuất, trả lời thay), không hiện toàn bộ. | **Gợi ý** |

**Tổng:** 4 Chặn · 12 Nên sửa · 3 Gợi ý (19 góp ý).

## Câu hỏi của tôi

1. Giám sát có được giữ nick Zalo riêng để bán hàng không? Nếu không thì tôi bán hàng bằng gì? Nếu có thì một người có thể vừa giữ nick của mình vừa giữ tạm nick của người nghỉ (PQ-34) không?
2. Doanh số, báo giá và đơn phát sinh khi Bình trực thay Minh thì tính cho ai? Còn khách mới kết bạn vào nick Minh trong 3 ngày Minh vắng thì owner là ai?
3. Khi Minh đang được trực thay, Minh có còn quyền trên VClinks không (Minh ốm nhưng vẫn muốn xem)? Hay Minh bị "tạm tắt" để tránh trả lời trùng?
4. Giữa trả lời thay (từng tin) và trực thay (cả ngày), công ty muốn giám sát dùng cách nào khi NVKD nghỉ nửa ngày? File 01 nên có một dòng hướng dẫn chọn.
5. Người có thời gian báo nghỉ việc (2–4 tuần) thì có được đặt chế độ hạn chế ("Sắp nghỉ") không, hay phải đợi đến ngày cuối mới khóa?
6. Khách chuyển vùng giữa hai tổ: công ty muốn GĐ quyết một mình hay hai giám sát thỏa thuận trước? Nếu hai GS không đồng ý với nhau thì sao?
7. Quy tắc chia khách mới và lead của tổ do GĐ đặt cho cả division hay từng tổ được đặt riêng? GS có được xem không?
8. Ngưỡng 20 lần hiện SĐT mỗi giờ có áp dụng cho giám sát không? Công việc hằng ngày của GS là gọi khách của cả tổ.

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Bước | Kết quả mong đợi |
|---|---|---|
| UAT-PQ-GS01 | U-AD gán U-GS1 làm người giữ nick Z3 "Zalo Hùng – VCparts 03"; U-GS1 là owner khách K7 | Gán được; U-GS1 thấy SĐT K7 đầy đủ, không có nút "Hiện", không có `phone.reveal`; SĐT khách của U-KD1 vẫn dạng ẩn + "Hiện" |
| UAT-PQ-GS02 | U-GS1 tạo trực thay U-KD1 → chính U-GS1; khách lạ gửi lời mời kết bạn vào Z1 | U-GS1 thấy lời mời trong danh sách, chấp nhận được; nhật ký ghi `trực thay Nguyễn An` |
| UAT-PQ-GS03 | Trực thay U-KD1 → U-KD2. U-KD1 gửi tin từ điện thoại vào H1 lúc 09:00; 09:02 U-KD2 bấm Gửi trên H1 | Hộp "Nguyễn An vừa gửi tin trên nick này 2 phút trước. Vẫn gửi?"; gửi xong có ghi chú nội bộ; cuối ngày U-KD1 nhận tóm tắt trực thay |
| UAT-PQ-GS04 | Trực thay U-KD1 → U-KD2; U-KD2 mở H1 | SĐT K1 dạng ẩn + "Hiện"; bấm Hiện có `phone.reveal` via `trực thay`; U-KD2 không có danh sách/xuất khách của U-KD1 |
| UAT-PQ-GS05 | Tạo 2 trực thay cùng khoảng cho U-KD1: U-KD2 giữ nick, U-GS1 nhận nhóm khách tag "Long Biên" | Lưu được; mỗi người chỉ thấy phần được giao (trừ người giữ nick thấy mọi hội thoại trên Z1) |
| UAT-PQ-GS06 | U-GS1 tạm khóa khẩn U-KD2, lý do "Gửi danh thiếp nick riêng cho khách" | U-KD2 bị đăng xuất ≤ 60 giây; U-GD nhận thông báo; U-GS1 được hỏi "Tạo trực thay cho Lê Bình?"; U-GS1 không có nút "Mở khóa" |
| UAT-PQ-GS07 | U-GS1 đặt cờ "Sắp nghỉ" cho U-KD2 (ngày dự kiến +14) | U-KD2 thấy SĐT K3, K5 dạng ẩn + "Hiện"; bấm Hiện 6 lần/giờ → U-GS1 và U-GD nhận cảnh báo |
| UAT-PQ-GS08 | Bàn giao U-KD4, bước ③ Z5, chưa tick "đã đăng xuất điện thoại cũ"; U-KD4 còn 1 lệnh `Đang chờ gửi` | Nút `Hoàn tất bàn giao` khóa; tick xong → hoàn tất; lệnh của U-KD4 chuyển `Cần duyệt lại`, không tự gửi |
| UAT-PQ-GS09 | Bàn giao 3 khách K8–K10 "Chia đều" cho U-KD3 và U-GS2 | Bảng xem trước có số khách + tổng doanh số 12 tháng từng người; sửa tay được một dòng trước khi hoàn tất |
| UAT-PQ-GS10 | U-GS1 gửi "Yêu cầu chuyển khách về tổ" K2 (khách của U-KD3, Tổ HN2) | U-GS2 nhận yêu cầu, bấm Đồng ý; U-GD duyệt; K2 về "Chưa phân công" Tổ HN1; U-KD3 mất quyền với H3 ≤ 60 giây |
| UAT-PQ-GS11 | U-KD2 xin xem H3; U-GD không duyệt trong 4 giờ làm việc | U-GD nhận nhắc sau 2 giờ; sau 4 giờ yêu cầu chuyển tới người duyệt thay / cấp trên |
| UAT-PQ-GS12 | U-MK giao K4 cho Tổ HN1; không ai chia trong 30 phút làm việc; U-MK (PQ-21 bật) thử gửi trên H6 | U-GS1 nhận nhắc; U-MK đọc được H6 nhưng ô soạn khóa, tooltip "Lead đã giao cho Tổ HN1" |
| UAT-PQ-GS13 | U-SA được U-GD cho xem H1 (khách tổ HN1) 1 ngày | U-GS1 nhận thông báo và thấy dòng này trong "Tất cả trong phạm vi" |
| UAT-PQ-GS14 | U-GS1 mở MH-PQ-10 lọc người = U-KD1 | U-KD1 thấy trong "Hoạt động của tôi" dòng "Giám sát Trần Văn Hùng đã xem nhật ký của bạn" |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/01-P-GS.md) | — |
