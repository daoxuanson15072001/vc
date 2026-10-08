# Scene list: (chapter, title, board, box[x,y,w,h] in board px or None, screen code, lot, who, subtitle)
# A board name of None + mock text = D9 illustration (not on canvas).
S = []
def sc(ch, t, board, box, code, lot, who, sub, mock=None, view=None):
    S.append(dict(ch=ch, t=t, board=board, box=box, code=code, lot=lot, who=who, sub=sub, mock=mock, view=view))

C = "07:45 · Mở VClinks"
sc(C, "Giới thiệu", "AppFrame", None, "MH-UI-01", "TK1", None,
   "Đây là mô phỏng một ngày làm việc của nhân viên kinh doanh trên kênh Zalo cá nhân của VClinks, ghép từ đặc tả 03 và canvas thiết kế. Nhân vật chính là chị Linh, nhân viên kinh doanh VCparts, dùng nick Zalo công ty Linh VCparts.")
sc(C, "Menu trái theo vai trò", "AppFrame", [60, 50, 260, 700], "MH-UI-01", "TK1", None,
   "Bên trái là menu theo vai trò. Nhân viên kinh doanh thấy Tin nhắn, Lệnh gửi, Danh bạ và Việc cần làm. Mục nào thuộc lô sau thì bị ẩn ở bản MVP.")
sc(C, "Kiểm tra nick của tôi", "NickStates", [540, 100, 470, 170], "MH-SZ-12a", "TK1", "Linh",
   "Việc đầu tiên: bấm chấm trạng thái nick. Nick Minh xanh, nick Linh vàng vì đồng bộ trễ 12 phút, nick Tú đỏ từ 7 giờ 10. Nick đỏ quá 5 phút thì bấm Báo Admin, không chờ.")
sc(C, "Thông báo", "AppFrame", [340, 66, 400, 500], "MH-UI-03", "TK1", None,
   "Chuông thông báo gom các việc cần làm ngay: hội thoại quá SLA, giám sát nhắc tên, nick mất kết nối, được giao trực thay. Bấm một dòng là mở đúng chỗ cần xử lý.")
sc(C, "Trạng thái của tôi", "AppFrame", [745, 60, 380, 560], "MH-UI-05", "TK1", None,
   "Góc phải trên là trạng thái của tôi: trực tuyến, vắng, đi thị trường, kèm thời hạn. Trạng thái này ảnh hưởng tới việc chia khách và người nhận lời nhắc.")

C = "07:50 · Hộp thư Của tôi"
sc(C, "Ba cột làm việc", "Main", None, "MH-SZ-01", "TK1", None,
   "Hộp thư có ba cột: danh sách hội thoại, khung chat, và panel thông tin bên phải. Của tôi gồm khách tôi phụ trách và mọi hội thoại trên nick tôi giữ.")
sc(C, "Lọc Chưa trả lời", "Main", [60, 90, 365, 660], "MH-SZ-01", "TK1", "Linh",
   "Chị Linh lọc Chưa trả lời, không dùng Chưa đọc. Khách đã đọc trên điện thoại mà chưa trả lời vẫn nằm ở đây, khách chờ lâu nhất đứng đầu, kèm chip Quá 25 phút và chip nợ quá hạn.")
sc(C, "Lấy nội dung tin đang chờ", "Main", [60, 90, 365, 120], "MH-SZ-01 #11", "TK1", "Linh",
   "Tin chỉ có thông tin gốc mà chưa có nội dung thì hiện Đang chờ nội dung. Chị bấm Lấy nội dung một lần, xác nhận rằng khách sẽ thấy Đã xem như khi mở trên điện thoại. Extension mở lần lượt tối đa 20 hội thoại.")
sc(C, "Mở hội thoại", "Main", [425, 40, 680, 120], "MH-SZ-03", "TK1", None,
   "Mở hội thoại anh Tuấn, Garage Minh Phát. Tiêu đề có chip nick đang dùng, chip Quá 25 phút, trạng thái xử lý và nút mở 360 của khách.")
sc(C, "Ghi âm, ghi chú nội bộ", "Main", [470, 330, 620, 280], "MH-SZ-03", "TK1", None,
   "Ghi âm hiện kèm bản chữ đã chuyển. Ghi chú nội bộ màu vàng chỉ người trong công ty thấy, khách không thấy. Ở đây giám sát Hương nhắc Linh gửi báo giá đã duyệt.")
sc(C, "Các loại tin", "ChatZalo", [880, 60, 550, 700], "MH-SZ-03", "TK1", None,
   "Khung chat hiển thị đủ loại tin của Zalo: chữ, ảnh, album, file, ghi âm, danh thiếp, trích dẫn, bình chọn, tin thu hồi. Bảng bên phải ghi loại nào đã có, loại nào mới.")
sc(C, "Tin trong nhóm", "ChatZalo", [150, 40, 700, 700], "MH-SZ-03", "TK1", None,
   "Trong nhóm, mỗi tin ghi tên người gửi. Album lướt được, ghi âm nghe được và có chữ, file được lưu vào kho công ty, tin thu hồi vẫn giữ bản lưu cho người có quyền.")
sc(C, "Trạng thái tin của mình", "ChatZalo", [880, 790, 550, 420], "MH-SZ-03", "TK1", None,
   "Tin mình gửi đi qua các trạng thái: Đang chờ gửi, Đang gửi, Đã gửi, rồi Đã nhận, Đã xem theo Zalo. Mục tiêu từ lúc bấm tới lúc tin hiện trên Zalo không quá 2 giây.")
sc(C, "Thao tác trên một tin", "ChatZalo", [150, 1230, 700, 260], "MH-SZ-04", "TK1", None,
   "Rê chuột lên một tin để trả lời trích dẫn, sao chép, ghim, hoặc chuột phải để chuyển hậu mãi cho chăm sóc khách hàng.")

C = "08:00 · Lời mời kết bạn và danh bạ"
sc(C, "Lời mời kết bạn", "Contacts", [30, 3010, 790, 520], "MH-SZ-10", "TK2", "Linh",
   "Vào Danh bạ, tab Lời mời kết bạn. Mỗi dòng có ảnh, tên Zalo, lời chào, nguồn, thời gian chờ và nick nhận. Có hồ sơ trùng số điện thoại thì hiện gợi ý khách có sẵn.")
sc(C, "Hộp Đồng ý kết bạn", "Contacts", [845, 3015, 580, 500], "MH-SZ-10", "TK2", "Linh",
   "Bấm Đồng ý mở một hộp: tên gợi nhớ như A Tuấn – Minh Phát, tích Gửi lời chào bằng mẫu chào, nội dung đã thay biến hiện nguyên văn. Bấm Đồng ý là duyệt cả hai lệnh. Không có nút đồng ý tất cả, hai lệnh kết bạn cách nhau ít nhất 30 giây.")
sc(C, "Từ chối", "Contacts", [60, 3570, 700, 140], "MH-SZ-10", "TK2", None,
   "Từ chối thì có hộp xác nhận trước khi tạo lệnh từ chối. Lời mời đã xử lý trên điện thoại sẽ tự biến khỏi danh sách.")
sc(C, "Bảng bạn bè", "Contacts", [40, 90, 1390, 640], "MH-SZ-09", "TK2", None,
   "Tab Bạn bè: chọn nick, tìm theo tên hoặc số, lọc vai trò và tình trạng gắn hồ sơ. Mỗi dòng có tên Zalo, tên gợi nhớ, số điện thoại theo quyền, khách VClinks đã gắn và lần nhắn gần nhất.")
sc(C, "Sửa tên gợi nhớ, gắn hồ sơ", "Contacts", [30, 1375, 1390, 420], "MH-SZ-09", "TK2", "Linh",
   "Sửa tên gợi nhớ bằng bút chì rồi Enter, chọn chỉ lưu trong VClinks hay đổi cả trên Zalo. Nút Gắn hồ sơ khách tìm khách theo tên, số hoặc mã khách hàng để nối người bạn Zalo với hồ sơ khách.")
sc(C, "Tab Nhóm", "Contacts", [30, 1070, 1390, 280], "MH-SZ-09", "TK2", None,
   "Tab Nhóm liệt kê các nhóm của nick: số thành viên, vai trò của nick, mục đích nhóm, khách đã gắn, và số nick công ty trong nhóm để không mất nhóm khi một nick nghỉ.")
sc(C, "Quyền trên danh bạ", "Contacts", [30, 2200, 1390, 520], "MH-SZ-09", "TK2", None,
   "Người trực thay thấy danh bạ của nick mình trực. Giám sát xem danh bạ nick của tổ ở chế độ chỉ xem. Người không có quyền chỉ thấy số điện thoại bị che.")

C = "08:15 · Trả lời khách hỏi hàng"
sc(C, "Ô soạn và thanh công cụ", "Composer", [20, 120, 460, 430], "MH-SZ-05", "TK1", None,
   "Thanh công cụ của ô soạn giữ đúng thứ tự bản đang chạy: sticker, ảnh, file, danh thiếp, số tài khoản, mẫu câu, gửi báo giá. Nút bình chọn và nhắc tên chỉ có trong nhóm.")
sc(C, "Mẫu câu gõ /", "Composer", [490, 120, 460, 420], "MH-SZ-05", "TK1", "Linh",
   "Gõ dấu gạch chéo và phím tắt, ví dụ chào, để chèn mẫu câu. Biến tên khách và tên nhân viên được thay khi chèn. Mẫu có số phút thì chọn nhanh 5, 10, 15 hoặc 30.")
sc(C, "Tra hàng ở panel phải", "Main", [1105, 220, 330, 520], "MH-SZ-07 #2a", "TK1", "Linh",
   "Khách hỏi má phanh Vios 2019. Chị tra ở tab Tra hàng: mã, giá theo hạng khách, tồn theo kho. Bấm Chèn vào tin để đưa dòng hàng vào ô soạn. Dữ liệu chỉ đọc từ VCsales.")
sc(C, "Panel thông tin hội thoại", "InfoPanel", [1100, 50, 340, 940], "MH-SZ-07", "TK2", None,
   "Panel thông tin còn có thẻ khách: công nợ, xe của khách, lead đang mở, việc cần làm. Các tab gồm Tra hàng, Khách, Báo giá, Việc, Thành viên, Media và Tìm.")
sc(C, "Tra hàng chi tiết", "InfoPanel", [20, 1045, 345, 700], "MH-SZ-07 #2a", "TK2", None,
   "Bản chi tiết của tab Tra hàng: giá theo hạng khách, tồn theo kho, hàng thay thế, thời điểm lấy dữ liệu VCsales, và các trạng thái đang tải, lỗi, không có quyền.")
sc(C, "Trả lời trích dẫn, nhắc tên", "Composer", [20, 565, 460, 470], "MH-SZ-05", "TK1", None,
   "Trả lời trích dẫn: rê lên tin, bấm Trả lời, thanh Trả lời tên khách hiện trên ô soạn, Esc để hủy. Trong nhóm bấm @ để nhắc tên thành viên.")
sc(C, "Gửi lần đầu là bước duyệt", "Composer", [490, 565, 460, 470], "MH-SZ-05", "TK1", "Linh",
   "Lần gửi đầu tiên hiện hộp Gửi tin qua Zalo cá nhân. Bấm Gửi chính là duyệt: lệnh ghi người bấm và giờ bấm. Không có đường nào gửi tin mà thiếu người duyệt.")
sc(C, "Ghi chú nội bộ", "Composer", [958, 565, 470, 470], "MH-SZ-05", "TK1", None,
   "Chuyển sang tab Ghi chú nội bộ để nhắn đồng nghiệp ngay trong luồng chat. Khách không thấy, và ghi chú không bao giờ đi ra Zalo.")
sc(C, "Tin nhắn nhanh", "ZaloDialogs", [485, 115, 505, 990], "MH-SZ-06", "TK1", None,
   "Hộp Tin nhắn nhanh quản lý mẫu câu cá nhân và mẫu của tổ: bảo hành, giữ khách, mẫu có biến, số tài khoản công ty. Mẫu tổ do giám sát duyệt.")

C = "09:00 · Gửi báo giá VCsales"
sc(C, "Hộp Gửi báo giá", "SendQuote", [100, 80, 770, 840], "MH-SZ-05i", "TK1", "Linh",
   "Khách gửi số khung và ảnh phụ tùng. Báo giá được tạo và duyệt trên VCsales. Chị bấm Gửi báo giá: chọn báo giá, xem trước trang đầu, chọn dạng File PDF hoặc Ảnh, sửa lời nhắn có biến số báo giá và tổng tiền.")
sc(C, "Bấm Gửi báo giá", "SendQuote", [890, 520, 530, 110], "MH-SZ-05i", "TK1", None,
   "Bấm Gửi báo giá, VClinks lấy lại bản mới nhất trên VCsales rồi tạo lệnh gửi file kèm lời nhắn. Có thể tích Nhắc tôi theo dõi sau 3 ngày.")
sc(C, "Các lỗi của hộp báo giá", "SendQuote", [890, 70, 530, 450], "MH-SZ-05i", "TK1", None,
   "Các trường hợp lỗi: VCsales không trả lời, khách chưa liên kết mã khách hàng, báo giá hết hạn hoặc chưa duyệt, nick đỏ. Mỗi trường hợp có câu giải thích và nút xử lý tiếp.")
sc(C, "Tab Báo giá", "InfoPanel", [1075, 1045, 355, 900], "MH-SZ-07 #9", "TK2", None,
   "Tab Báo giá ở panel phải liệt kê báo giá VCsales của khách, có nút Gửi ở từng dòng. Khách chưa liên kết mã thì có nút gửi yêu cầu liên kết cho Sale admin.")
sc(C, "Ghi nhận trên hồ sơ 360", "Customer360", [430, 240, 620, 330], "MH-DK-03", "TK1", None,
   "Gửi xong, dòng thời gian 360 ghi Đã gửi báo giá kèm tổng tiền, phễu chuyển sang Đã báo giá, và báo giá hiện ở mục Báo giá đang mở.")

C = "D9 · CSKH soạn, NVKD duyệt"
sc(C, "Chuyển CSKH soạn báo giá", None, None, "MH-SZ-04 #8b", "D9", "Linh",
   "Khách hỏi giá phức tạp, nhiều mã, cần tra số khung. Chị chuột phải một tin, chọn Chuyển CSKH soạn báo giá, chọn tối đa 10 tin, ghi chú cho chăm sóc khách hàng, đặt hạn, rồi bấm Tạo phiếu. Không có gì gửi ra Zalo.",
   mock="Chuột phải một tin → Chuyển CSKH soạn báo giá\n\nChế độ chọn tin:  ☑ 3 tin (kèm ảnh, ghi âm)   Đã chọn 3/10 · [Tiếp tục] [Hủy]\n\n┌ Chuyển CSKH soạn báo giá ───────────────────────────┐\n│ Tin đã chọn (3)                                      │\n│ Ghi chú cho CSKH: khách quen, theo giá đại lý cấp 2  │\n│ ☑ Cho AI trích nhu cầu                               │\n│ Hạn cần gửi khách: 90 phút                           │\n│                               [Hủy]  [Tạo phiếu]     │\n└──────────────────────────────────────────────────────┘\nKết quả: phiếu TK-… loại Báo giá, ghi chú nội bộ, chip trên khung chat.\nM2: AI tự nhận ra \"Hỏi giá\" và tạo phiếu kèm đề xuất báo giá.")
sc(C, "Khay Chờ tôi duyệt", None, None, "MH-SZ-15", "D9", None,
   "Khi chăm sóc khách hàng soạn xong, chị nhận thông báo Cần làm ngay. Khay Chờ tôi duyệt liệt kê phiếu báo giá và phiếu bảo hành, ai soạn, chờ bao lâu. Quá 10 phút có badge đỏ, quá 20 phút có cảnh báo.",
   mock="┌ Chờ tôi duyệt (3) ────────────────────────────────────────────────┐\n│ ● Garage Minh Phát · Báo giá BG-2026-0950 · 8.390.000 đ   Lan · 6′  │\n│ ● Garage Phúc Lộc · Bảo hành TK-0161 · \"Tiếp nhận\"        Thu · 14′ ⚠│\n│ ○ Anh Kiên · Báo giá (trả lại 1 lần) · đang ở CSKH         Lan · –   │\n└────────────────────────────────────────────────────────────────────┘\nKhung chat:  [Phiếu báo giá TK-0160 · Chờ bạn duyệt ▸]")
sc(C, "Panel phiếu: duyệt hoặc trả lại", None, None, "MH-SZ-15", "D9", "Linh",
   "Mở phiếu: tin nguồn, đề xuất của AI và bản chăm sóc khách hàng sửa, báo giá đã duyệt kèm PDF, lời nhắn sửa được. Duyệt và gửi là duyệt lệnh gửi. Trả lại phải chọn lý do. Tôi tự trả lời thì đóng phiếu. Không ai bấm thì phút 10 nhắc, phút 20 báo giám sát.",
   mock="Panel phiếu TK-0160\n  Tin nguồn (3) · Đề xuất AI → bản CSKH sửa (2 dòng đổi)\n  BG-2026-0950 · Đã duyệt · 8.390.000 đ · còn 7 ngày   [Xem PDF]\n  Lời nhắn: [Dạ anh Tuấn, em gửi báo giá … ✎]\n  Lịch sử: 09:05 AI tạo · 09:12 Lan nhận · 09:31 Lan chuyển duyệt\n\n  [Tôi tự trả lời]      [Trả lại]      [Duyệt & gửi]\n\nTrả lại → lý do bắt buộc: Sai mã · Sai số lượng · Giá chưa đúng chính sách · Thiếu hàng thay thế · Lời nhắn chưa ổn · Khác\nNick đỏ hoặc Chưa an toàn → Duyệt & gửi bị khóa.")
sc(C, "Chuyển hậu mãi cho CSKH", "ChatZalo", [150, 1230, 700, 260], "MH-SZ-04 #8", "TK1", None,
   "Khách kể lỗi hàng thì chuột phải tin, chọn Chuyển hậu mãi cho CSKH, chọn tin, chọn loại bảo hành, đổi trả hay khiếu nại, rồi Tạo ticket. Chăm sóc khách hàng soạn câu trả lời, nhân viên kinh doanh duyệt và gửi qua nick.")

C = "10:30 · Tạo nhóm với garage"
sc(C, "Tạo nhóm Zalo", "Contacts", [20, 4760, 1400, 700], "MH-SZ-11", "TK2", "Linh",
   "Garage cần kỹ thuật tư vấn. Chị bấm Tạo nhóm: chọn nick, đặt tên Garage Minh Phát – VCparts, chọn chủ garage và kỹ thuật từ danh bạ của nick. Nên giữ tích thêm nick của giám sát để công ty không mất nhóm.")
sc(C, "Thành viên nhóm", "InfoPanel", [370, 1045, 345, 700], "MH-SZ-07", "TK2", None,
   "Trong nhóm, tab Thành viên cho thêm hoặc xóa thành viên khi nick là trưởng hoặc phó nhóm. Mọi thao tác có xác nhận và ghi nhật ký.")
sc(C, "Bình chọn, nhắc tên", "Composer", [130, 380, 320, 150], "MH-SZ-05h", "TK1", None,
   "Trong nhóm có thêm nút tạo bình chọn với ít nhất hai lựa chọn, và nút @ để nhắc tên kỹ thuật.")

C = "11:30 · Trả lời trên điện thoại"
sc(C, "Tin gửi từ điện thoại", "Main", [740, 400, 360, 70], "MH-SZ-03", "TK1", "Linh",
   "Ra ngoài gặp garage, chị trả lời bằng app Zalo trên điện thoại. Tin đó về VClinks với nhãn Gửi từ điện thoại, hội thoại rời khỏi Chưa trả lời. Kiểm tra mâu thuẫn giá chạy sau khi gửi.")
sc(C, "Nick có lại: không gửi trùng", "NickStates", [395, 550, 600, 260], "MH-SZ-05", "TK1", None,
   "Nick rớt khi đang gõ dở: bấm Sao chép nội dung để gửi tạm trên điện thoại. Nick xanh lại, VClinks thấy tin giống nháp và hỏi có xóa nháp không. Lệnh chờ quá 2 phút không tự gửi mà hỏi Gửi ngay hay Bỏ lệnh.")

C = "14:00 · Tìm tin cũ"
sc(C, "Tìm nhanh Ctrl K", "Search", [380, 230, 640, 560], "MH-UI-04", "TK1", "Linh",
   "Khách hỏi lại đơn tháng trước. Chị bấm Ctrl K, gõ tên hoặc mã OE. Hộp tìm nhanh chia nhóm khách hàng, hội thoại, tin nhắn. Enter mở kết quả đầu, Ctrl Enter mở trang kết quả đầy đủ.")
sc(C, "Trang kết quả", "Search", [60, 1220, 1340, 420], "MH-SZ-14", "TK2", None,
   "Trang kết quả lọc theo kênh, nick, người gửi, khoảng thời gian; đoạn trích tô đậm từ khóa. Bấm một dòng là mở hội thoại, cuộn tới tin đó và nháy sáng. Kết quả ngoài quyền không hiện.")
sc(C, "Trạng thái tìm kiếm", "Search", [20, 2170, 1400, 1000], "MH-SZ-14", "TK2", None,
   "Các trạng thái: chưa gõ thì hiện tìm gần đây, gõ chưa đủ ký tự, đang tìm chậm, khách ngoài phạm vi chỉ hiện tên và người phụ trách, rỗng kèm tin chưa lấy nội dung.")
sc(C, "Tìm trong hội thoại", "InfoPanel", [20, 2005, 345, 660], "MH-SZ-07 #10", "TK2", None,
   "Trong khung chat, biểu tượng kính lúp mở tab Tìm ở panel phải để tìm trong riêng hội thoại đó, lọc người gửi và khoảng ngày.")

C = "16:00 · Khi lệnh gửi lỗi"
sc(C, "Thông báo lỗi và bong bóng", "ChatZalo", [470, 1265, 380, 220], "MH-SZ-03", "TK1", None,
   "Tin gửi khách lỗi, ví dụ vì trên Zalo có nháp gõ dở. Trong 10 giây có thông báo nổi kèm tiếng, badge đỏ ở Lệnh gửi, bong bóng viền đỏ Gửi lỗi. Rê chuột thấy câu giải thích dễ hiểu và cách xử lý.")
sc(C, "Lệnh gửi của tôi", "NickStates", [1005, 55, 430, 520], "MH-SZ-13", "TK1", "Linh",
   "Mục Lệnh gửi liệt kê lệnh lỗi, lệnh quá hạn, thời gian treo. Xử lý nguyên nhân rồi Thử lại, đây là duyệt lại với người bấm mới. Hoặc Bỏ lệnh. Tin trích dẫn bị trôi xa thì có nút Gửi không trích dẫn.")
sc(C, "Nick đỏ trong ô soạn", "NickStates", [395, 230, 400, 330], "MH-SZ-05", "TK1", None,
   "Khi nick đỏ, ô soạn hiện dải cảnh báo và nút Sao chép nội dung. Nick vàng thì vẫn gửi được nhưng tin có thể về chậm.")

C = "17:15 · Ghim, đánh dấu, phân loại"
sc(C, "Menu chuột phải", "ZaloDialogs", [90, 115, 385, 850], "MH-SZ-02", "TK1", "Linh",
   "Cuối ngày chị chuột phải hội thoại: ghim 3 hội thoại cần theo dõi mai, đánh dấu chưa đọc một hội thoại chưa xong. Lệnh chạy trên Zalo thật, badge đổi ở cả hai nơi.")
sc(C, "Thông tin người gửi", "ZaloDialogs", [1010, 115, 420, 900], "MH-SZ-08", "TK1", None,
   "Bấm tên người gửi mở hộp thông tin: tên Zalo, tên gợi nhớ, số điện thoại theo quyền, khách VClinks đã gắn và nhóm chung.")

C = "Giám sát: trả lời thay, trực thay"
sc(C, "Tổ của tôi", "Admin", [375, 120, 610, 620], "MH-PQ-02", "TK1", "Hương",
   "Chị Hương là giám sát tổ HN1. Trang Tổ của tôi cho thấy từng nhân viên: trạng thái, nick, số hội thoại đang xử lý, chưa trả lời, quá SLA, kèm yêu cầu chuyển khách chờ duyệt.")
sc(C, "Hộp thư theo nhân viên", "Supervisor", [60, 180, 365, 620], "MH-SZ-01 GS", "TK1", "Hương",
   "Ở hộp thư, giám sát xem theo tổ, nhóm theo nhân viên: Minh 2 chờ, Linh 1 chờ. Mở hội thoại của tổ không làm khách thấy Đã xem. Có nút Nhắc người đang phụ trách.")
sc(C, "Trả lời thay", "Supervisor", [440, 330, 650, 520], "MH-SZ-05 #0b", "TK1", "Hương",
   "Khách gấp, chị trả lời thay. Ô soạn có dải vàng báo đang trả lời thay trên nick của người khác. Hộp xác nhận luôn hiện, kèm cảnh báo nếu người giữ nick đang hoạt động. Bong bóng ghi Gửi bởi Hương, trả lời thay.")
sc(C, "Trực thay", "Cover", [95, 120, 1330, 420], "MH-PQ-07", "TK1", "Hương",
   "Minh nghỉ phép, chị tạo Trực thay Minh sang Linh tới hết thời hạn. Khách không đổi người phụ trách. Người trực được làm như người giữ nick, hết hạn thì tự thu hồi.")
sc(C, "Dải trực thay", "Supervisor", [1125, 90, 305, 160], "MH-SZ-05 #0b", "TK1", "Linh",
   "Khi Linh mở hội thoại của Minh, ô soạn có dải xanh Bạn đang trực thay Minh. Tin ghi Gửi bởi Linh, trực thay Minh. 18 giờ, Minh nhận tóm tắt việc đã làm thay.")
sc(C, "Lệnh gửi của tổ", "OutboxTeam", None, "MH-SZ-13", "TK1", "Hương",
   "Lệnh gửi, phạm vi Tổ của tôi: nhóm theo nhân viên, cột Treo bao nhiêu phút. Lệnh lỗi chưa xử lý quá 30 phút thì giám sát được báo.")

C = "Nghỉ việc và nick chưa an toàn"
sc(C, "Bốn bước nghỉ việc", "Offboard", None, "MH-PQ-04", "TK1", None,
   "Khi nhân viên nghỉ việc: khóa tài khoản, bàn giao khách, bàn giao nick, xác nhận. Lệnh chưa chạy của người nghỉ chuyển Cần duyệt lại, không tự chạy.")
sc(C, "Bàn giao nick", "Offboard", [765, 150, 665, 330], "QT-SZ-11", "TK1", None,
   "Bước bàn giao nick: tích đã đăng xuất Zalo trên điện thoại cũ, việc này làm ngoài VClinks. Chưa tích thì nick bị đánh dấu Chưa an toàn.")
sc(C, "Nick chưa an toàn", "ChuaAnToan", [400, 110, 600, 90], "QT-SZ-11 3a", "TK1", None,
   "Trên nick chưa an toàn, ô soạn và thanh công cụ bị khóa bằng dải đỏ. Không ai gửi được qua nick này cho tới khi Admin, giám đốc hoặc người giữ mới bấm Xác nhận đã đăng xuất.")
sc(C, "Duyệt lại lệnh cũ", "ChuaAnToan", [1003, 50, 430, 520], "MH-SZ-13", "TK1", None,
   "Lệnh Cần duyệt lại không có nút Thử lại. Người giữ nick mới xem nội dung rồi bấm Duyệt lại hoặc Bỏ lệnh, sau khi nick đã an toàn.")

C = "Đồng bộ và khách đa kênh"
sc(C, "Đối chiếu đồng bộ", "Sync", None, "MH-SZ-12b", "TK1", None,
   "Admin xem trang Đồng bộ: số bản ghi trong IndexedDB của Zalo Web so với MongoDB theo từng luồng. Khi Zalo đổi cấu trúc dữ liệu, extension dừng đẩy, báo lệch, Claude đề xuất bảng ánh xạ mới để người duyệt.")
sc(C, "Hồ sơ khách 360", "Customer360", None, "MH-DK-01", "TK1", None,
   "Bấm Mở 360 từ khung chat để xem khách trên mọi kênh: cam kết đã nêu 7 ngày, người liên hệ, dòng thời gian hợp nhất, báo giá đang mở, ticket, công nợ.")
sc(C, "Dòng thời gian hợp nhất", "Timeline", None, "MH-DK-03", "TK1", None,
   "Dòng thời gian gom tin Zalo, OA, Fanpage, bình luận, email và sự kiện VCsales theo ngày, lọc được theo kênh.")
sc(C, "Danh tính chưa xác nhận", "Identity", None, "MH-DK-09", "TK1", None,
   "Người nhắn chưa chắc là khách nào thì hiện Danh tính chưa xác nhận. Trước khi gửi thông tin nhạy cảm như công nợ, VClinks nhắc đối chiếu mã đơn và số điện thoại.")
sc(C, "Việc cần làm", "Tasks", None, "Tasks", "TK1", None,
   "Trang Việc cần làm gom nhắc việc theo dõi báo giá, ticket, lời nhắc của giám sát, chia theo Quá hạn và Hôm nay.")
sc(C, "Kết thúc", "Main", None, "MH-SZ-01", "TK1", None,
   "Tóm lại: mọi tin gửi qua Zalo đều do người bấm và được ghi lại người duyệt, giờ duyệt. Extension kiểm tra trên Zalo trước khi báo thành công. Hết phần mô phỏng.")
