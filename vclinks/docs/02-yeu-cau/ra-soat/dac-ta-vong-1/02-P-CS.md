# Góp ý 02 — P-CS (Lan)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý vòng 1 của Lan (P-CS, CSKH) cho đặc tả 02 Khách đa kênh, đi qua các kịch bản bảo hành, hỏi giá, tạm giữ hội thoại.
- 16 góp ý: 4 Chặn, 9 Nên sửa, 3 Gợi ý; kèm 6 câu hỏi và 10 kịch bản UAT đề xuất.
- Ghi nhận nhiều lo ngại ở góp ý 04 đã được 02 giải quyết (04 #5, #6, #7, #20).
- Chặn 1: CSKH vẫn không đọc được sale đã hứa gì với khách (chỉ thấy hội thoại gắn ticket).
- Chặn 2: hội thoại hỏi giá ở tay owner "online" mà không trả lời thì không có hạn, không ai cảnh báo.
- Chặn 3–4: khách chưa xác nhận hỏi đơn/bảo hành thì CSKH không có cách tự xác nhận; owner "Vẫn gửi" cam kết trái ticket thì người giữ ticket không được báo.
- Kết quả xử lý: xem [02-xu-ly.md](02-xu-ly.md). Hồ sơ đã đóng, lưu trữ.

## Mục lục

- [Tôi đi qua các kịch bản](#tôi-đi-qua-các-kịch-bản)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Đọc file 02 tôi thấy nhẹ người hơn file 04 nhiều. Giờ tôi biết khách đang ở kênh nào, ai đang trả lời, và sale nhận được thông báo khi tôi nhận ca bảo hành. Nhiều lo ngại ở góp ý 04 đã được giải quyết. **#5** (sale trả lời cùng lúc trên Zalo) có khóa trả lời cấp contact (DK-27), banner 09A và thông báo cho owner (DK-33). **#6** (một tin vừa bảo hành vừa hỏi giá) có §5.4 và DK-US-07: tôi giữ ca, mời owner vào hoặc gom "Cùng một yêu cầu". **#20** (Fanpage và OA) có DK-22 áp chung cho OA, Fanpage và chat web, thêm banner "Khách có ticket … do [NV] xử lý". **#7** (có được trả lời thẳng không) thì bảng §5.2 trả lời rõ.

Còn hai lo ngại lớn nhất ở 04 vẫn **chưa** được giải quyết. Thứ nhất (04 #1, #23): tôi vẫn **không đọc được sale đã hứa gì**. Quyền CS ở MH-DK-01 chỉ cho xem dòng thời gian của hội thoại gắn ticket, các dòng khác chỉ là tóm tắt. Thứ hai (04 #2): khách hỏi giá được chuyển cho sale rồi **không ai theo tiếp**. DK-24 chỉ lo trường hợp owner offline, không lo trường hợp owner "online mà không trả lời". Ngoài ra DK-15 đặt ra một chỗ bí mới: khách chưa xác nhận hỏi đơn hoặc bảo hành thì tôi không có cách nào tự xác nhận khách.

## Tôi đi qua các kịch bản

**Kịch bản B (tôi là "Thu"). Khách của Minh nhắn OA về bảo hành trong lúc Minh đang báo giá trên Zalo.**
- 14:05: hội thoại về tay tôi, Minh được báo. Tốt.
- 14:06: banner xanh ghi "Khách đang được Minh trả lời trên Zalo · 4 phút trước (báo giá bộ côn)". Phần "(báo giá bộ côn)" có trong kịch bản nhưng **không có** trong đặc tả banner MH-DK-09 #2. Thiếu nó thì tôi không biết Minh đang nói chuyện gì.
- 14:08: tôi mở ticket. Khách nói "bơm nước lấy tuần trước". Tôi cần biết đơn nào, giá bao nhiêu, Minh có dặn gì lúc bán. Tab Thương mại bị ẩn với CS, còn hội thoại Zalo của Minh thì tôi chỉ thấy dòng tóm tắt. Tôi đành hỏi lại khách số hóa đơn, đúng việc khách ghét nhất.
- 14:10: khách hỏi giá côn, tôi gửi tin chuyển. Nếu 30 phút sau Minh vẫn chưa gửi giá thì sao? Theo DK-30, hội thoại phụ của tôi chỉ tạm dừng SLA **khi hội thoại chính đã được trả lời**. Trước lúc đó, không có ai được nhắc cả.
- 14:20: Minh hứa "đổi mới luôn" và bấm "Vẫn gửi (ghi lý do)". Theo DK-33 thì **owner** được báo, còn **tôi**, người đang giữ ticket, không được báo gì. Mười phút sau tôi nhắn khách "bên em đang kiểm tra lỗi, 3–5 ngày có kết quả". Khách chụp hai tin gửi lại. Đây đúng là tình huống tôi sợ nhất.

**Khách hỏi "giá bao nhiêu" trên OA.**
- Ngoài giờ (20:00): khách nhận tin ngoài giờ, sáng mai hội thoại vào hàng của owner. Được.
- Trong giờ, sale đi thị trường, app vẫn "online" trên điện thoại nhưng không trả lời: theo §5.2 hội thoại vẫn nằm ở owner. Tôi không tạm giữ được, và cũng không ai cảnh báo. Khách nhắn lần hai "sao im thế" vào OA, người đọc là tôi.
- Owner offline hơn 15 phút: tôi tạm giữ, chào và ghi nhận, không nêu giá. Owner online lại thì hội thoại "trả về owner". Nếu owner online lại mà vẫn không trả lời thì hội thoại quay về chỗ cũ, không ai chịu trách nhiệm. Còn nếu owner nghỉ phép cả ngày thì tôi giữ khách mà không được nói giá, và cũng không có ai trực bán hàng thay.
- Khách chưa có owner (lead) hỏi giá trên OA: được chia tự động cho NVKD. Nhưng nếu tôi là người trả lời trước ("dạ anh chờ em chút"), DK-25 có biến tôi thành owner đề xuất không? Tôi là CSKH, không bán hàng.

**Khách chưa xác nhận hỏi công nợ hoặc đơn (DK-15).**
- Khách nhắn Fanpage: "anh là Khoa bên garage Minh Khoa, còn nợ bao nhiêu, đơn hôm trước đâu rồi". Tôi thấy banner vàng và khối thương mại viền đỏ. Tôi biết **không được nói**, nhưng đặc tả không cho tôi **cách xác nhận** khách. Trong kịch bản E, Lan (NVKD) xác nhận bằng cách nhắn qua nick Zalo của mình. Tôi không giữ nick Zalo nào. Khách chỉ có Fanpage, hoặc chỉ có Zalo trên nick của sale. Tôi không có mẫu câu để giải thích cho khách, cũng không có nút "gửi yêu cầu chia sẻ thông tin OA" hay "hỏi mã đơn để đối chiếu".
- Với câu hỏi công nợ, chuyển cho owner là hợp lý. Nhưng với câu hỏi **đơn đâu, bảo hành** (hậu mãi, về tay tôi), nếu không có đường xác nhận thì tôi kẹt hoàn toàn.

**Kịch bản G, 09:21.** Tôi gửi "anh Minh đang báo giá anh qua Zalo" rồi hội thoại Messenger chuyển sang "Chờ khách". Tôi yên tâm. Nhưng 09:40 cùng khách nhắn OA về chuyển khoản, người xử lý đổi thành Minh. Nếu hội thoại OA đó đang có ticket bảo hành của tôi thì sao? §5.4 nói giữ người xử lý hiện tại, còn kịch bản G lại nói người xử lý là Minh. Tôi không biết cái nào đúng.

**Kịch bản H.** Khách của hai division không liên quan nhiều tới tôi. Chỉ báo "có hoạt động" không kèm nội dung là đủ.

## Góp ý

| # | Màn/quy tắc/kịch bản (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-DK-01 Quyền CS · MH-DK-02 · DK-40 · KH-01 · (04 #1, #23 chưa giải quyết) | CS chỉ đọc được dòng thời gian của hội thoại gắn ticket. Hội thoại Zalo của sale chỉ hiện "3 tin · bạn không có quyền xem nội dung". Tôi vẫn không biết sale đã hứa gì. | Mỗi ngày có 5–10 khách mở đầu bằng "anh Minh hứa…". Nếu hỏi lại, khách nói "nói rồi mà". Nếu không hỏi, tôi dễ nói ngược với sale. KH-01 ("không phải kể lại") trượt ngay với CSKH. | (a) Thêm khối **"Cam kết đã nêu (7 ngày)"** trên panel của mọi người đang xử lý contact, lấy từ chính dữ liệu DK-32 đã trích: giá, ngày hẹn, cam kết đổi/trả, báo giá đã gửi. Mỗi dòng có người, kênh, giờ và 1 câu trích. (b) Khi tôi đang xử lý hội thoại hoặc ticket của contact, cho tôi **đọc** (không gửi) hội thoại của contact đó trong division, trong 30 ngày, có ghi nhật ký. | **Chặn** |
| 2 | §5.2 Bán hàng · DK-24 · DK-30 · (04 #2 chưa giải quyết) | Hội thoại bán hàng trên kênh chung ở tay owner "online" mà không trả lời thì không có hạn, không ai cảnh báo. Hội thoại phụ "Cùng một yêu cầu" cũng không ai theo khi hội thoại chính chưa được trả lời. Owner nghỉ phép hoặc offline lâu thì tôi giữ khách mà không được nói giá, và không có người thay. | Chiều nào cũng có 2–3 khách nhắn "sao không ai báo giá". Sale đi thị trường vẫn "online" trên điện thoại. Khách quay lại mắng OA, tức là mắng tôi. | (a) Hội thoại bán hàng trên kênh chung có **hạn phản hồi của owner** (vd. 30′ trong giờ làm), tính theo **tin trả lời**, không tính theo trạng thái online. (b) Quá hạn thì báo owner và giám sát, hội thoại hiện ở hàng của tôi với nhãn `Owner chưa trả lời 35′`, có nút gửi câu giữ khách. (c) Quá hạn lần hai, hoặc owner vắng mặt hoặc nghỉ phép, thì chuyển cho **người trực bán hàng** hoặc giám sát, không để ở CSKH. (d) Hội thoại phụ "Cùng một yêu cầu" dùng chung hạn này. | **Chặn** |
| 3 | DK-15 · §4.10 · MH-DK-09 #4 · §5.2 cột "Chưa xác nhận" | Hậu mãi của danh tính chưa xác nhận về tay CSKH, nhưng tôi không được nói về đơn và không có cách tự xác nhận. Cách "hỏi lại qua kênh đã xác thực" chỉ dùng được với người giữ nick Zalo. | Khách hỏi "đơn đâu", "bảo hành sao" trên Fanpage rất thường gặp, và khách Fanpage luôn là V1. Nếu tôi chỉ nói "em chưa xác nhận được anh" thì khách bỏ đi hoặc nổi nóng. | Cho CSKH các cách xác nhận ngay trong banner: `[Gửi yêu cầu chia sẻ thông tin OA]` (nếu khách có OA), `[Đối chiếu mã đơn + SĐT]` (khách đọc mã đơn và SĐT, khớp ERP thì coi là "NV xác nhận" với phạm vi **chỉ đơn đó**, không mở công nợ), `[Nhờ owner xác nhận]` (báo owner hỏi qua Zalo). Kèm mẫu câu lịch sự: "Để bảo mật thông tin đơn của anh, em xin phép đối chiếu mã đơn và SĐT đặt hàng ạ." | **Chặn** |
| 4 | DK-32 · DK-33 · Kịch bản B 14:20 · MH-DK-09 "Vẫn gửi" | Owner bấm "Vẫn gửi" cam kết trái với ticket đang mở ("đổi mới luôn") thì chỉ owner được báo. **Người giữ ticket không được báo.** Chiều ngược lại, khi tôi hứa hạn xử lý trong ticket, sale có thấy không? | Hai người hứa hai kiểu với cùng một khách trong 10 phút. Khách chụp màn hình, tôi mất uy tín. | "Vẫn gửi" có điểm lệch liên quan ticket thì **báo ngay người xử lý ticket**, tự thêm ghi chú nội bộ vào ticket ("Minh đã hứa đổi mới qua Zalo 14:20, lý do: …") và đưa vào khối Cam kết đã nêu (#1). Cam kết tôi ghi trong ticket (hạn xử lý, phương án) cũng tính là "cam kết đã nêu" để DK-32 kiểm tra tin của sale. | **Chặn** |
| 5 | DK-31 · DK-32 · MH-DK-09B | Mọi con số có "đ" trong tin của CS đều bật modal và bắt lý do. Hậu mãi có nhiều số không phải báo giá: phí đổi hàng, phí vận chuyển, số tiền khách đã chuyển, giá trên hóa đơn khách hỏi lại, giá niêm yết công khai. | Nếu ngày nào tôi cũng phải gõ lý do chục lần, tôi sẽ gõ "abcdefghij" cho qua, và cảnh báo mất tác dụng. | Phân biệt: số khớp **hóa đơn hoặc thanh toán** của khách, và phí trong **bảng phí hậu mãi** được duyệt thì không bắt lý do. Lý do có danh sách chọn nhanh: "Giá niêm yết công khai", "Phí bảo hành/vận chuyển theo quy định", "Owner nhờ báo", "Khác (ghi rõ)". Giá linh kiện mới vẫn cảnh báo như hiện nay. | Nên sửa |
| 6 | DK-27 · MH-DK-09 #2 · #10 | Banner khóa không nói **người kia đang trả lời chuyện gì**, và mỗi lần gửi trong ticket bảo hành của tôi đều có thể bật modal "Đang có người trả lời". | Minh báo giá, tôi làm bảo hành: hai việc khác nhau, không phải trả lời trùng. Modal lặp lại làm chậm tôi giờ cao điểm. | Banner ghi thêm loại yêu cầu và chủ đề (như kịch bản B: "(báo giá bộ côn)"). Khóa của người khác **khác loại yêu cầu** với hội thoại của tôi (hoặc tôi đang giữ ticket) thì chỉ hiện banner, không bật modal. | Nên sửa |
| 7 | §5.2 cột "Owner offline" · DK-24 "owner online → trả về owner" | Chưa rõ việc trả về owner diễn ra thế nào: tự động giữa lúc tôi đang nói với khách, hay owner phải bấm nhận. Tôi có được báo không. | Nếu hội thoại tự biến khỏi hàng của tôi giữa câu thì khách bị bỏ lửng, không ai biết đang tới đâu. | Trả về chỉ khi owner **bấm Nhận**, hoặc khi owner gửi tin đầu tiên. Tôi nhận thông báo "Minh đã nhận lại hội thoại". Lúc trả về có ô ghi chú bàn giao 1 dòng (tự điền: "Đã chào, khách hỏi X, chưa nêu giá"). | Nên sửa |
| 8 | §5.4 vs Kịch bản G 09:40 · DK-23 | §5.4 nói hội thoại nhiều yêu cầu thì giữ người xử lý hiện tại, còn kịch bản G lại đổi người xử lý OA sang Minh khi tin là công nợ. Hội thoại OA là **một luồng dài** với khách, nên loại yêu cầu đổi liên tục. | Đang giữ ticket bảo hành mà khách gửi ủy nhiệm chi, hội thoại có bị lấy khỏi tôi không? | Ghi rõ: định tuyến theo loại chỉ áp khi hội thoại **chưa có người xử lý**, hoặc khi đã "Đã xong" rồi khách nhắn lại. Đang có người xử lý thì chỉ mời người đúng loại vào làm **người tham gia**. Sửa kịch bản G cho khớp. | Nên sửa |
| 9 | DK-25 · §5.2 "Khách chưa có owner" | Chưa rõ CSKH trả lời lead trước (chào, xin thông tin) có thành owner đề xuất không. CSKH có được nêu giá cho khách **chưa có owner** không (DK-31 chỉ nói khách đã có owner). | Giờ cao điểm tôi hay chào lead trước để khách khỏi chờ. | DK-25 chỉ tính **NVKD** trả lời đầu tiên. CSKH chào hoặc ghi nhận lead thì không thành owner. Nêu rõ CSKH với lead chưa owner: được gửi giá niêm yết công khai, không chiết khấu, rồi chuyển NVKD theo F4.1. | Nên sửa |
| 10 | MH-DK-01 Quyền CS "ẩn tab Thương mại" | Với hậu mãi, tôi cần **đơn, ngày giao, mặt hàng, hóa đơn** của khách. Tôi không cần công nợ hay giá chính sách, nhưng tab Thương mại bị ẩn hết. | Không thấy đơn gần nhất thì tôi phải hỏi khách "anh mua hôm nào, mã gì". | CS thấy phần **Đơn / giao hàng / hóa đơn** (không có số tiền nợ, hạng, giá chính sách). Công nợ chỉ hiện "Có quá hạn: Có/Không" như hiện nay. Thống nhất với ô "Đơn VCsales" của 04. | Nên sửa |
| 11 | MH-DK-09 #5 banner "Khách có ticket [mã] do [NV] xử lý" | Banner có nhưng không có nút làm gì tiếp. | Khách nhắn Fanpage về vụ đang có ticket bên OA do Mai giữ. Tôi phải tự tìm ticket, rồi nhắn Mai. | Thêm nút `[Mở ticket]`, `[Gắn tin này vào ticket]`, `[Chuyển hội thoại cho Mai]`. Trả lời trong ticket của người khác thì Mai được báo. | Nên sửa |
| 12 | Chiều sale → CSKH (thiếu trong §5.3) | Đặc tả lo khách hậu mãi nhắn OA, nhưng không nói khi khách kể lỗi hàng với **sale trên Zalo cá nhân** thì sao. | Khách quen hay kể "bơm nước bị rò" với sale. Sale nhắn tôi qua Zalo nội bộ, tôi lại hỏi khách từ đầu. | Trên khung chat của sale có nút `Chuyển hậu mãi cho CSKH`: tạo ticket, chọn đoạn tin làm mô tả, kèm ảnh khách gửi. Tôi nhận ticket có ngữ cảnh mà không cần đọc nick sale. Sale vẫn là người nhắn khách, hoặc gợi ý khách nhắn OA. | Nên sửa |
| 13 | DK-17 · DK-09 · MH-DK-07 | Khách Fanpage khiếu nại, tôi biết là khách của Minh (khách gửi mã đơn), nhưng gắn tay vào khách người khác chỉ thành gợi ý chờ duyệt. Trong lúc chờ, tôi không có ngữ cảnh, không có banner owner. | Khiếu nại cần trả lời trong 30′, còn gợi ý có hạn 2 ngày làm việc. | Có bằng chứng mạnh (mã đơn khớp ERP, T8) thì **tạm gắn để xem**: hiện owner, ticket, cam kết đã nêu cho tôi ngay. Gộp chính thức vẫn chờ duyệt. Owner được báo. | Nên sửa |
| 14 | MH-DK-02 dòng hoạt động không có quyền | Bấm dòng Zalo·Minh thì chỉ báo "Bạn không có quyền mở hội thoại này". | Tôi cần một lối đi tiếp chứ không chỉ một câu từ chối. | Kèm nút `[Hỏi Minh]`: gửi Minh một @nhắc nội bộ gắn sẵn khách và câu hỏi. Minh trả lời thì hiện ngay trên panel của tôi. | Gợi ý |
| 15 | §3 dữ liệu giả, UAT | Trong dữ liệu giả, **Lan là NVKD**, còn CSKH là Thu. Persona CSKH lại tên Lan. | Lúc UAT và góp ý thiết kế, người đọc dễ nhầm "Lan" là ai. | Đổi tên NVKD Lan ở §3 (vd. "Linh"), hoặc đổi persona. | Gợi ý |
| 16 | DK-15 · kịch bản E 20:31 · §5.2 Công nợ | Khi tôi tạm giữ hội thoại công nợ (owner offline), chưa có câu mẫu để trả lời. | Khách hỏi "anh còn nợ bao nhiêu", tôi không được nói số, và câu tự nghĩ dễ nghe như né tránh. | Thêm mẫu `/cong-no-chuyen-owner`: "Dạ số công nợ anh Minh phụ trách sẽ gửi anh bản đối chiếu, em đã báo anh Minh, hẹn anh trong hôm nay ạ." Hệ thống tạo nhắc việc cho owner. | Gợi ý |

## Câu hỏi của tôi

1. **§12 câu 2:** công ty có chốt là CSKH được trả lời trực tiếp khách của sale về hậu mãi không? Nếu có, tôi có được **đọc** hội thoại của sale với khách đó không (góp ý #1)? Chỉ được trả lời mà không được đọc thì tôi vẫn phải hỏi lại khách.
2. "Owner online" nghĩa là gì: đang mở VClinks trên máy tính, trên điện thoại, hay mới thao tác trong X phút? Sale đi thị trường mở app nhưng không trả lời thì có tính là online không?
3. Có vai trò **"trực bán hàng"** theo ca, hay người thay khi owner nghỉ phép không? Nếu không có thì khách hỏi giá lúc owner nghỉ phép sẽ chờ tới bao giờ?
4. Hội thoại phụ "Cùng một yêu cầu" (do tôi giữ) có tính vào SLA và báo cáo của tôi không khi hội thoại chính (của sale) trả lời muộn?
5. Đối chiếu "mã đơn + SĐT" để xác nhận khách cho câu hỏi hậu mãi có được công ty chấp nhận không, hay bắt buộc khách phải chia sẻ thông tin OA?
6. Tin ghi chú nội bộ tự động (kịch bản B 14:11) Minh nhận được thì tôi có thấy Minh đã đọc chưa?

## Kịch bản UAT tôi muốn thêm

| Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|
| Garage Tuấn Phát, owner Minh. Minh đã nhắn Zalo hôm qua "bơm nước lỗi em đổi mới miễn phí" | Tuấn nhắn OA "anh Minh hứa đổi miễn phí sao chưa thấy"; Thu (CS) mở hội thoại | Panel của Thu có khối "Cam kết đã nêu": "Đổi mới miễn phí · Zalo·Minh · hôm qua HH:mm" + câu trích. Thu không phải xin quyền |
| Ticket BH-TEST-001 do Thu giữ | Minh gõ "Bơm nước em đổi mới luôn" → 09B → "Vẫn gửi" có lý do | Thu nhận thông báo ≤ 5 giây; ticket có ghi chú nội bộ tự động kèm lý do; khối Cam kết đã nêu cập nhật |
| Khách của Minh hỏi giá trên OA lúc 10:00; Minh online nhưng không trả lời | Chờ 30′ trong giờ làm | Minh và Quang nhận cảnh báo; hội thoại hiện ở hàng của Thu với nhãn "Owner chưa trả lời 30′"; Thu gửi được câu giữ khách mà không bị hỏi lý do |
| Như trên, Minh vẫn không trả lời thêm 30′ (hoặc Minh đang "Nghỉ phép") | – | Hội thoại chuyển cho người trực bán hàng hoặc giám sát, không ở lại CSKH; Thu được báo ai đã nhận |
| Thu tạm giữ hội thoại bán hàng (Minh offline 16′), đang gõ dở | Minh online lại | Hội thoại **không** tự rời hàng của Thu tới khi Minh bấm Nhận; Thu nhận thông báo "Minh đã nhận lại"; ghi chú bàn giao hiện cho Minh |
| Danh tính Fanpage V1 tự xưng "Khoa garage Minh Khoa", có ứng viên ≥ 70 | Khách hỏi "đơn hôm trước đâu rồi"; Thu bấm "Đối chiếu mã đơn + SĐT", khách đọc mã đơn DH-TEST và SĐT đúng | Thu xem được trạng thái **đơn đó**; công nợ vẫn ẩn; nhật ký ghi bằng chứng |
| Như trên, khách hỏi "anh còn nợ bao nhiêu" | Thu gõ số tiền bất kỳ → Gửi | Bị cảnh báo DK-15; gợi ý mẫu `/cong-no-chuyen-owner`; owner nhận nhắc việc |
| Khách chuyển khoản; Thu trả lời "Dạ em đã thấy anh chuyển 8.200.000đ" | Bấm Gửi | Không bật modal nêu giá (số khớp thanh toán ERP) |
| Hội thoại OA do Thu giữ, có ticket bảo hành mở | Khách gửi ảnh ủy nhiệm chi (loại Công nợ) | Người xử lý vẫn là Thu; Minh được mời làm người tham gia và được báo |
| Tuấn kể lỗi bơm nước với Minh trên Zalo | Minh bấm "Chuyển hậu mãi cho CSKH", chọn 3 tin + ảnh | Ticket mới ở hàng CSKH có đủ 3 tin + ảnh làm mô tả; Thu không cần mở nick của Minh |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/02-P-CS.md) | — |
