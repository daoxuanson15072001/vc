# Góp ý thiết kế D1 — P-CS (Lan)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Lan (P-CS, CSKH trực Zalo OA và Fanpage) góp ý lượt 1 lô thiết kế TK1 (D1) ngày 29/09/2026; xem màn 1, 1c, 0a, 0b, 3, 9; đối chiếu đặc tả 04 và BA §18.4.
- 19 góp ý: **6 Chặn** (#1, #2, #4, #5, #7, #12) · 10 Nên sửa · 3 Gợi ý.
- Vấn đề lớn nhất: cửa sổ gửi OA vẽ sai đặc tả 04 §3.2 (khung ~3 giờ, khóa ô soạn sau 3 ngày, thiếu vùng Z2 có phí và Z0 bỏ quan tâm).
- Thiếu luồng ticket: không tạo ticket trong khung chat, chưa có MH-OA-05/06/07, mã `T-1042` lệch quy ước `TK-`.
- Thiếu Hộp thư CSKH (MH-OA-02), trạng thái token OA hết hạn và gửi lỗi, và chỗ báo CSKH được trả lời hay chỉ xem (OA-12).
- Làm thử 5 việc: chỉ việc bình luận Fanpage làm trọn (7 cú); các việc liên quan ticket không làm trọn được.
- Việc mở chờ chủ dự án: nếu ZNS để GĐ2 thì trong D1 CSKH xử lý khách hết khung bằng đường nào. Kết quả xử lý xem `vong-2/P-CS.md`.

## Mục lục

- [Làm thử 5 việc](#làm-thử-5-việc)
- [Góp ý theo màn](#góp-ý-theo-màn)
- [Chỗ thiết kế lệch đặc tả 04](#chỗ-thiết-kế-lệch-đặc-tả-04)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Người góp ý: Lan, CSKH trực Zalo OA và Fanpage (vai P-CS). Ngày 29/09/2026.
> Bản vẽ: artifact "VClinks UI Design" (lô D1). Màn đã xem: 1 Hộp thư đa kênh, 1c Khung chat OA/Fanpage, 0a Kênh Zalo OA, 0b Fanpage bình luận, 3 Customer 360, 9 Quản trị.
> Đối chiếu: `docs/02-yeu-cau/dac-ta/04-cskh-zalo-oa.md` (MH-OA-xx, OA-xx, §3.2), `docs/vclinks-ba.md` §18.4 (CS-01…CS-08).

Nhìn tổng thể thì hộp thư một chỗ cho mọi kênh là thứ tôi cần: thấy được "Phụ trách: Nguyễn Văn Tú", thấy "Lê Thu Hà đang trả lời…", thấy chip SLA đỏ. Bình luận Fanpage có SĐT tự ẩn và nhắn riêng ngay trong màn là rất sát việc hằng ngày. Nhưng với Zalo OA, **bản vẽ đang tính cửa sổ gửi sai so với đặc tả 04**: có chỗ ghi "khung tư vấn còn 2 giờ 58′", có chỗ khóa ô soạn khi khách mới im 3 ngày. Nếu làm theo bản vẽ, tôi sẽ bỏ khách oan hoặc gửi ZNS mất tiền không cần thiết. Việc chính của tôi là **ticket** (bảo hành, khiếu nại), mà trong khung chat không có chỗ nào tạo ticket, không có hàng "Ticket của tôi". Trạng thái lỗi (token OA hết hạn, gửi lỗi, khách bỏ quan tâm) gần như chưa vẽ.

## Làm thử 5 việc

| Việc | Các bước (màn) | Số cú bấm | Vướng ở đâu |
|---|---|---|---|
| (a) Khách OA hỏi bảo hành, còn 30 phút cửa sổ miễn phí | Màn 1: bấm chip "OA" (1) → tìm dòng khách, bấm mở (1) → đọc dải cửa sổ gửi → gõ trả lời, Gửi (1) → muốn mở ticket bảo hành: không có nút trong khung chat, phải bấm "Mở Customer 360" (1) → "Mở ticket" (1) → form ticket chưa vẽ (≥ 2) | ≥ 7 | Danh sách chỉ sắp theo SLA, không sắp/lọc theo "cửa sổ sắp hết", nên khách còn 30 phút có thể nằm dưới. Theo bản vẽ, dải chỉ chuyển vàng ở mức dưới 1 giờ; đặc tả yêu cầu đỏ khi còn ≤ 30 phút. Tạo ticket phải rời khung chat. |
| (b) Khách OA nhắn lại sau 3 ngày | Nếu khách nhắn lại thì cửa sổ mở lại, trả lời bình thường (3 cú bấm). Nếu tôi cần chủ động nhắn khách đã im 3 ngày: mở hội thoại (2) → 1c/0a ghi "Ngoài khung tư vấn. Ô soạn khoá. Chỉ gửi được ZNS", nút ZNS là GĐ2 → chỉ còn nút "Nhắn qua Nick Linh" | 3 rồi bế tắc | Đặc tả 04 §3.2: 3 ngày là vùng **Z2 (có phí)**, không phải hết khung. Bản vẽ khóa sai. Bản vẽ không có trường hợp "khách nhắn lại → dải chuyển xanh ngay" (UAT-OA-19). Nút "Nhắn qua Nick Linh" đẩy tôi sang nick cá nhân của sale. |
| (c) Khách của sale Minh nhắn OA khiếu nại giao thiếu hàng | Màn 1: dòng khách không có dấu "khiếu nại", không ghi tên sale → mở hội thoại (1) → đầu khung thấy "Phụ trách: …" → xem đơn ở panel phải tab Khách (1) → không biết tôi được trả lời thẳng hay phải chuyển → mở 360 (1) → "Mở ticket" (1) → form chưa vẽ (≥ 2) → báo Minh: không thấy nút, phải @ trong ghi chú nội bộ (2) | ≥ 8 | Dòng hội thoại không có nhãn loại yêu cầu và tên sale phụ trách. Không có chỗ nào nói rõ "bạn được trả lời" hay "chỉ xem" (OA-12). Không có nút "Chuyển cho sale" hay "Báo sale phụ trách" gắn với ticket. |
| (d) Bình luận Fanpage có SĐT | Thanh kênh: Page VCP (1) → tab Bình luận (1) → chọn bài/quảng cáo (1) → bình luận đã tự ẩn, bấm "Nhắn riêng" (1) → sửa nháp, Gửi (1) → "lưu vào hồ sơ mới" (1) → "Nhận xử lý" (1) | 7 | Tốt nhất trong 5 việc. Còn vướng 3 chỗ. (1) Bấm "lưu vào hồ sơ mới" có thể tạo trùng: hệ thống không kiểm SĐT đã có hồ sơ chưa. (2) Không có hạn nhắn riêng cụ thể, chỉ ghi "trong thời hạn Meta cho phép". (3) Nếu bình luận là lời chê hoặc khiếu nại công khai thì không có đường tạo ticket. |
| (e) Mở ticket bảo hành từ một tin nhắn | Khung chat: rê chuột lên tin thì không có mục "Tạo ticket từ tin này" → mở 360 (1) → "Mở ticket" (1) → form (chưa vẽ) → quay lại chat (1) | ≥ 5, không làm trọn được | Thiếu hẳn MH-OA-05 (modal tạo ticket), khối "Ticket" ở panel phải (MH-OA-03 #13), MH-OA-06 chi tiết ticket, MH-OA-07 Ticket của tôi. Mã ticket trên 360 là `T-1042`, đặc tả dùng `TK-xxxx`. |

## Góp ý theo màn

| # | Màn | Góp ý | Vì sao | Đề xuất sửa (cụ thể) | Mức |
|---|---|---|---|---|---|
| 1 | 1c, 0a, 1, 3 | Cửa sổ gửi OA đang vẽ theo một "khung tư vấn" khoảng 3 giờ ("còn 2 giờ 58′", "Khung tư vấn đến 11:40" tính từ 08:40). Ở 360 lại ghi "Cửa sổ OA còn mở · 19 giờ". Ba màn ba con số. | Đặc tả 04 §3.2: T = tương tác cuối của khách; 0–48h miễn phí, 48h–7 ngày có phí, quá 7 ngày chỉ ZNS. Tôi sẽ tưởng hết khung trong khi còn 45 giờ miễn phí. | Vẽ lại dải cửa sổ theo 6 vùng Z1 / Z1 sắp hết / Z1 rất gấp / Z2 / Z3 / Z0, dùng đúng câu chữ ở §3.2 (vd `Còn 31 giờ 12 phút để trả lời miễn phí`). Chip trong danh sách dùng chữ ngắn MH-OA-02 #10: `Miễn phí 41h`, `Sắp hết 2h`, `Có phí`, `Hết khung`, `Bỏ quan tâm`. | **Chặn** |
| 2 | 1c (ô "OA · ngoài khung tư vấn"), 0a | Khách Ngọc Trâm "3 ngày chưa nhắn" bị khóa ô soạn, chỉ cho ZNS. | Theo đặc tả, 3 ngày là Z2. Nếu OA bật "Cho phép tin tư vấn tính phí" thì bấm Gửi phải mở hộp xác nhận chi phí; nếu OA tắt thì chặn kèm câu hướng dẫn. Không có vùng Z2, tôi mất lựa chọn rẻ hơn ZNS. | Thêm ô mẫu Z2 (tím): dòng tuyến gửi `· Tin tư vấn · CÓ PHÍ ~ … đ`, nút `Gửi (có phí)`, hộp xác nhận `Gửi tin tư vấn có phí?` với 3 nút [Gửi (có phí)] [Dùng tin mẫu (ZNS)] [Hủy] (MH-OA-04). Vẽ thêm biến thể "OA tắt có phí". | **Chặn** |
| 3 | 1c, 1 | Màu dải: xanh / vàng dưới 1 giờ / đỏ đã hết (ghi "đề xuất – chờ BA"). | Đặc tả đã chốt: xanh > 6h, cam ≤ 6h, đỏ ≤ 30 phút, tím có phí, xám hết khung, đỏ bỏ quan tâm. Chỉ đổi màu khi còn 1 giờ thì tôi biết quá muộn, vì cuối ca tôi phải biết trước những khách sẽ hết trong đêm. | Dùng ngưỡng 6h / 30′ như đặc tả. Thêm banner nhắc ở vùng "sắp hết". Bỏ nhãn "đề xuất – chờ BA". | **Nên sửa** |
| 4 | 1 Hộp thư | Chưa có chế độ "Hộp thư CSKH" (MH-OA-02). Chưa có hàng "Chờ khách", chưa có bộ lọc Loại (Bảo hành / Khiếu nại / Tình trạng đơn), SLA, Khung gửi. Dòng hội thoại không có mã và loại ticket. Sắp xếp không có "cửa sổ sắp hết trước". | Mở ca tôi phải thấy ngay: khách nào khiếu nại, khách nào sắp hết cửa sổ, ticket nào sắp quá SLA. Hiện tôi phải mở từng hội thoại. | Thêm segmented `Của tôi · Chưa nhận · Chờ khách · Tất cả` và bộ lọc `Loại`, `SLA`, `Khung gửi`, `Tag`. Mỗi dòng có `#TK-0142 BH` và 2 chip (SLA + khung gửi). Thêm mục sắp xếp "Cửa sổ sắp hết trước". | **Chặn** |
| 5 | 1c, 0a (khung chat OA) | Không có nút "+ Tạo ticket", không có mục "Tạo ticket từ tin này" trên menu `⋯` của tin, panel phải không có khối Ticket (loại, trạng thái, SLA, người xử lý). | Ticket là việc chính của CSKH (CS-04, CS-05, OA-11). Đi vòng sang 360 thì rời khung chat và mất ngữ cảnh tin gốc. | Vẽ MH-OA-05 (modal tạo ticket có tin gốc điền sẵn, loại, đơn VCsales, người xử lý, "Gửi tin xác nhận cho khách") và khối Ticket ở panel phải. Vẽ MH-OA-06 dạng drawer. | **Chặn** |
| 6 | Thiếu màn | Không có màn "Ticket của tôi" (MH-OA-07). Màn "5 Việc cần làm" đang ghi "chưa rà". | Không có hàng ticket thì không biết hôm nay còn bao nhiêu bảo hành chưa đóng, ticket nào đang "Chờ khách". | Thêm màn Ticket của tôi, hoặc thêm tab Ticket vào màn 5, có cột SLA xử lý và trạng thái. Nút Đóng ticket phải bắt nhập kết quả. | **Nên sửa** |
| 7 | 1, 1c, 0a | Không có trạng thái **token OA hết hạn / cần kết nối lại** trong hộp thư và khung chat. Page EDU chỉ có chấm đỏ "!" trên thanh kênh, không có chữ giải thích. | Tôi gõ xong mới biết không gửi được, khách chờ. Đặc tả MH-OA-02 và MH-OA-03 đã có câu chữ và ô soạn phải khóa. | Vẽ banner vàng đầu danh sách `OA "…" đang mất kết nối. Tin vẫn nhận được… chưa gửi được. Đã báo admin.` và banner đỏ trên khung chat + ô soạn khóa. Rê chuột lên "!" thì hiện lý do. | **Chặn** |
| 8 | 1c, 0a | Không có trạng thái **gửi lỗi**: bong bóng `Lỗi gửi` + lý do tiếng Việt, nút `Gửi lại`, nút `Gửi bằng tin mẫu (ZNS)` khi Zalo báo hết khung (-230). | Zalo có thể báo hết khung sớm hơn VClinks tính. Tôi cần biết tin nào không tới khách. | Vẽ 1 bong bóng lỗi mẫu cho mỗi nhóm lỗi: hết khung, token, quá dài. Kèm dòng hệ thống `Zalo báo hết khung`. | **Nên sửa** |
| 9 | 1c, 0a | Thiếu vùng **Z0 khách bỏ quan tâm OA**: dòng hệ thống, tag `Đã bỏ quan tâm OA`, ô soạn khóa. | Khách giận thường bỏ quan tâm. Tôi cần biết để gọi điện, không ngồi chờ. | Thêm ô mẫu Z0 vào 1c, dùng câu ở §3.2. | **Nên sửa** |
| 10 | 1c, 0a | Hết khung chỉ có "Gửi ZNS · GĐ2" và "Nhắn qua Nick Linh". 0a còn gợi ý "kéo khách từ nick cá nhân sang OA". | Trong D1 tôi bế tắc: không có đường nào hợp lệ để báo khách về bảo hành. "Nhắn qua Nick Linh" là nhắn bằng nick của sale, tôi không có quyền và dễ trùng lời với sale. | Nếu ZNS để GĐ2 thì D1 ghi rõ việc cần làm thay thế: `Tạo nhắc việc gọi điện` + hiện SĐT (có ghi nhật ký). Đổi "Nhắn qua Nick Linh" thành "Nhờ sale phụ trách nhắn" (tạo nhắc việc cho sale, không tự mở nick của họ). | **Nên sửa** |
| 11 | 0a (ô soạn OA) | Nút không hỗ trợ (`@ Nhắc tên`, `Trả lời trích dẫn`) vẽ xám kèm chú thích. Thiếu `Tin nút`, `Ghi chú nội bộ`, `Tin mẫu (ZNS)` trong thanh công cụ, và thiếu bộ đếm `0/2000`. | MH-OA-03 #12: ẩn hẳn, không hiện nút mờ. Nút xám làm tôi tưởng hỏng. Ghi chú nội bộ là cách tôi nhắn sale "khách này đang khiếu nại". | Ẩn nút không hỗ trợ. Thanh công cụ theo đúng wireframe MH-OA-04. Thêm đếm ký tự. Đổi nhãn "Gửi ZNS" thành "Tin mẫu (ZNS)". | **Nên sửa** |
| 12 | 1, 1c, 0a | Không có chỗ báo rõ **tôi được trả lời thẳng hay chỉ xem** (OA-12). Khách của sale có phụ trách vẫn hiện ô soạn đầy đủ. | Nỗi sợ số 1 của tôi là trả lời trùng hoặc mâu thuẫn với sale. | Khi không có quyền gửi, thay ô soạn bằng câu `Bạn chỉ xem hội thoại này. Tạo ticket hoặc chuyển cho người phụ trách để trả lời.` Khi có ticket được giao thì ghi nhỏ "Bạn trả lời trong phạm vi ticket #TK-…". | **Chặn** |
| 13 | 1, 0a | Dòng hội thoại OA không ghi **sale phụ trách**. Panel phải của 0a có "Khách này trên kênh khác" nhưng không có dòng Phụ trách. | Câu tôi hỏi nhiều nhất: "Khách này đang do ai chăm?" | Thêm `Phụ trách: Minh` vào dòng (chữ nhỏ) và vào đầu panel phải của 0a, như màn 1 đã làm cho Zalo. | **Nên sửa** |
| 14 | 3 Customer 360 | Có "Mở ticket" và dòng thời gian có ticket, nhưng thiếu khối **Ticket đang mở** (loại, SLA, người xử lý). Thiếu cách xem nhanh **sale đã hứa gì** (ghi chú nội bộ và tin gần nhất của sale). Mã ticket `T-1042` khác đặc tả `TK-xxxx`. | Khách hay mắng vì phải kể lại. Tôi cần thấy lời hứa của sale trong 1 cú bấm. | Thêm khối "Ticket đang mở" cạnh "Báo giá đang mở". Thêm bộ lọc dòng thời gian "Lời hứa / ghi chú của sale" hoặc ghim ghi chú. Thống nhất mã `TK-`. | **Nên sửa** |
| 15 | 0b Fanpage bình luận | "Lưu vào hồ sơ mới" không kiểm SĐT đã có hồ sơ chưa. "Nhận xử lý" không nói ai nhận (CSKH hay sale). Không có hạn nhắn riêng cụ thể. Không có nút tạo ticket cho bình luận chê hoặc khiếu nại. | Dễ sinh hồ sơ trùng (sale admin phải gộp lại). Lead hỏi giá thuộc sale, khiếu nại thuộc tôi. Hết hạn nhắn riêng là mất khách. | Đổi thành `Khớp hồ sơ: Garage X (SĐT trùng)` / `Tạo hồ sơ mới`. Tách 2 nút `Chuyển sale` và `Tạo ticket`. Ghi `Nhắn riêng được đến 06/10 09:05`. Thêm bộ lọc "Chưa trả lời" (CS-02). | **Nên sửa** |
| 16 | 1 (dòng Fanpage Hương Trần) | Dòng ghi "Hết cửa sổ 24h", nhưng 1c cho thấy vẫn gửi được bằng tag Hỗ trợ viên đến 04/10. | Đọc ở danh sách, tôi tưởng hết đường và bỏ qua khách. | Chip ghi `Hết 24h · còn tag HV 5 ngày` (màu tím, không phải xám). | **Gợi ý** |
| 17 | 9 Quản trị | SLA chỉ có "phản hồi đầu tiên" theo kênh. Không có SLA xử lý ticket theo loại × ưu tiên, chưa có dòng "tạm dừng khi Chờ khách". Nhóm "CSKH VCparts" đang gập, không thấy ca trực, người online. | OA-13: SLA ticket tính theo giờ làm việc và dừng khi Chờ khách. Nếu không vẽ, tôi bị tính quá hạn khi đang chờ khách gửi ảnh. | Thêm bảng "SLA ticket" (Loại × Ưu tiên → phản hồi / xử lý). Thêm ô tích "Tạm dừng khi Chờ khách". Mở nhánh CSKH, hiện danh sách người, trạng thái online và ca trực như tổ NVKD. | **Nên sửa** |
| 18 | 9 Quản trị (chia theo loại yêu cầu) | "Bảo hành, khiếu nại → CSKH qua ticket · báo người phụ trách". Trong D1 thì phải chờ NVKD bấm "Chuyển CSKH". | Với OA, khách thường vào thẳng hàng của tôi qua nút chatbot "Bảo hành" (OA-11). Nếu phải chờ sale chuyển thì khiếu nại nằm trong chat của sale, đúng nỗi khổ BA §18.4 nêu. | Ghi rõ: tin OA có ý định Bảo hành / Khiếu nại / Tình trạng đơn (nút chatbot) thì vào thẳng hàng CSKH ngay trong D1. Chỉ Zalo cá nhân mới cần sale bấm "Chuyển CSKH". | **Gợi ý** |
| 19 | 0a | Thẻ "Khách đồng ý chia sẻ thông tin" hiện SĐT đầy đủ `0900 000 123`. | OA-10: SĐT hiển thị ẩn với người không phụ trách, xem đầy đủ phải ghi nhật ký. | Ẩn `0900 *** 123` + nút "Xem" như 360 đã làm. | **Gợi ý** |

**Tổng:** 19 góp ý. **Chặn** 6 (#1, #2, #4, #5, #7, #12) · **Nên sửa** 10 · **Gợi ý** 3.

## Chỗ thiết kế lệch đặc tả 04

1. **Cửa sổ gửi (§3.2, OA-05):** bản vẽ dùng "khung tư vấn" khoảng 3 giờ và khóa ô soạn sau 3 ngày. Đặc tả: 0–48h miễn phí, 48h–7 ngày có phí (tùy OA bật, phải xác nhận chi phí), quá 7 ngày chỉ ZNS, và thêm vùng Z0 bỏ quan tâm. Bản vẽ thiếu hẳn Z2 và Z0.
2. **Ngưỡng và màu:** bản vẽ dùng vàng dưới 1 giờ, đỏ khi đã hết. Đặc tả: cam ≤ 6h, đỏ ≤ 30′, tím Z2, xám Z3, đỏ Z0. Câu chữ banner cũng khác câu chữ chính xác ở §3.2.
3. **MH-OA-02 Hộp thư CSKH:** chưa vẽ. Hộp thư chung thiếu hàng "Chưa nhận / Chờ khách", thiếu bộ lọc Loại / SLA / Khung gửi, thiếu mã ticket trên dòng, thiếu sắp xếp "SLA gần nhất trước" theo ticket.
4. **MH-OA-03:** thiếu khối Ticket và khối "Khung gửi" (T, T+48h, T+7 ngày) ở panel phải, thiếu trạng thái quan tâm / bỏ quan tâm, thiếu nhãn `Tin tự động · …` đồng bộ (0a có "Tin chào tự động · Bot" nhưng chưa theo mẫu nhãn). Nút không hỗ trợ đang vẽ xám, đặc tả yêu cầu ẩn hẳn (#12).
5. **MH-OA-04:** thiếu Tin nút, Ghi chú nội bộ, đếm `0/2000`, dòng tuyến gửi kèm loại tin và phí, hộp xác nhận Z2, khối chặn Z3/Z0 kèm nút `Gửi tin mẫu (ZNS)`, trạng thái "Không có quyền gửi". Bản vẽ gọi nút là "Gửi ZNS", đặc tả gọi `Tin mẫu (ZNS)`.
6. **MH-OA-05 / 06 / 07 (ticket):** chưa có màn nào. 360 có nút "Mở ticket" nhưng không có form. Mã `T-1042` lệch quy ước `TK-xxxx`.
7. **Trạng thái lỗi:** thiếu token OA hết hạn (banner vàng ở hộp thư, banner đỏ ở khung chat, ô soạn khóa), OA đã ngắt, tin `Lỗi gửi` + `Gửi lại` / `Gửi bằng tin mẫu (ZNS)`, và "Khung gửi vừa hết lúc … Tin chưa được gửi."
8. **OA-10:** 0a hiện SĐT xác thực đầy đủ, trong khi đặc tả yêu cầu hiện dạng ẩn và ghi nhật ký khi xem.
9. **OA-12 (quyền gửi của CSKH):** bản vẽ không thể hiện CSKH chỉ được gửi trong hội thoại có ticket giao cho mình hoặc hội thoại chưa có sale phụ trách. Admin ghi "CSKH thấy hội thoại gắn ticket được giao", thiếu vế "hàng CSKH chưa có owner sale".
10. **OA-13 (SLA ticket):** màn Quản trị chỉ có SLA phản hồi đầu tiên theo kênh. Thiếu SLA xử lý theo loại × ưu tiên và thiếu quy tắc tạm dừng khi "Chờ khách".
11. **Hết khung trong D1:** đặc tả đưa ZNS lẻ (MH-OA-12) vào phạm vi kênh OA. Bản vẽ ghi ZNS là GĐ2, còn nút thay thế "Nhắn qua Nick Linh" không có trong đặc tả. Cần chủ dự án chốt: nếu ZNS để GĐ2 thì trong D1, CSKH xử lý khách hết khung bằng đường nào.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-1/P-CS.md) | — |
