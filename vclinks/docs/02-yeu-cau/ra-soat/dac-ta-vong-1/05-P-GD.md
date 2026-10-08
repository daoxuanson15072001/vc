# Góp ý 05 — P-GD (Thắng, giám đốc bán hàng)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Thắng (P-GD, giám đốc bán hàng) góp ý đặc tả 05 Marketing, quảng cáo, chatbot, vòng 1; file lưu ngày 30/09/2026.
- 20 góp ý: **3 Chặn · 15 Nên sửa · 2 Gợi ý**; kèm ý kiến về các quyết định D-MK-1, 2, 3, 6, 7, 8 và đề xuất mới D-MK-9, 10, 11; 11 ca UAT đề xuất.
- Chặn: "Thành đơn" tính mọi đơn của mã KH trong 60 ngày nên chi phí / đơn đẹp giả; không đối chiếu được từng đơn với VCsales; chưa có bảng đối chất marketing và sale theo tổ / NV / chiến dịch.
- Nên sửa: tranh chấp chất lượng lead, tin tự động không tính là liên hệ, khóa số chi phí tháng, xem theo lứa lead, ngân sách so với đã chi, kéo dashboard rút gọn lên MVP.
- Ý kiến chính: chatbot web làm GĐ2 có điều kiện; AI chưa tự trả lời; GĐBH duyệt nội dung chính sách / khuyến mãi.
- Kết quả xử lý ở [05-xu-ly.md](05-xu-ly.md): 17 đã sửa, 3 hỏi chủ dự án (D-MK-9, D-MK-8, D-MK-14).
- Còn mở: quy tắc ghi nhận đơn (D-MK-9), người duyệt khối chính sách (D-MK-8), dashboard rút gọn ở MVP (D-MK-14).

## Mục lục

- [Một tháng của tôi](#một-tháng-của-tôi)
- [Góp ý](#góp-ý)
- [Quyết định tôi cần công ty chốt](#quyết-định-tôi-cần-công-ty-chốt)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Tài liệu đi đúng hướng. Lần đầu tôi thấy lead được nối tới báo giá và đơn VCsales, có CPL và chi phí / đơn trên cùng một màn hình. Nhưng tôi chưa dám cầm MH-MK-10 vào họp ngân sách. Lý do: định nghĩa "Thành đơn" đang tính quá rộng, số chi phí sửa được bất cứ lúc nào, và tôi chưa đối chiếu được từng đơn với VCsales. Cuộc họp cuối tháng giữa marketing và sale cần một bảng "ai làm hỏng lead". Hiện cả hai bên đều chưa có đủ số để đối chất. Chatbot web tôi đồng ý làm, nhưng làm sau khi Hộp thư lead và dashboard đã chạy thật.

## Một tháng của tôi

**Ngày 1–3: duyệt ngân sách quảng cáo tháng mới (ngoài VClinks, nhưng cần số từ VClinks)**
- Mở MH-MK-10, chọn "tháng trước", nhóm theo chiến dịch. Tôi cần biết chiến dịch nào có chi phí / đơn thấp để tăng tiền, chiến dịch nào nên cắt.
- Vướng 1: dòng "Không rõ" có 61 lead, nhiều hơn mọi chiến dịch. Nếu 30–40% lead không rõ nguồn thì tôi không phân bổ được.
- Vướng 2: lead tháng trước tạo ngày 25 mới có 5 ngày để ra đơn, trong khi cửa sổ là 60 ngày. Chi phí / đơn của chiến dịch cuối tháng luôn trông tệ.
- Vướng 3: không có cột "ngân sách dự kiến so với đã chi" và "mục tiêu lead so với thực tế", dù MH-MK-02 đã có hai trường này.
- Mở MH-MK-02 xem chi phí. Chi phí do TMK nhập tay. Tôi không biết số này đã khớp hóa đơn Meta / Zalo Ads và kế toán chưa, trước hay sau VAT.

**Ngày 10–15: "tiền quảng cáo có ra đơn không?"**
- Mở MH-MK-10 kỳ "tháng này". Nhìn thẻ "Chi phí / đơn" và "Báo giá → Đơn". Giữa tháng số này chưa có nghĩa vì đơn chưa kịp về. Tôi cần nhìn theo lứa lead (lead tạo tuần 1 → tới nay ra bao nhiêu đơn).
- Bấm vào số đơn của một chiến dịch → MH-MK-06 đã lọc. Tôi muốn thấy **mã đơn VCsales** và giá trị từng đơn để gọi sale admin kiểm tra. Spec chưa có cột này.
- Ghé MH-MK-08 xem quy tắc giao lead: tổ HCM có đang bị dồn lead không. Chưa có số lead mở theo người để biết chia có đều không.

**Ngày 28–30: họp marketing + sale, hai bên đổ lỗi**
- Marketing (Tùng) nói: "Sale gọi chậm, gọi một lần rồi bỏ." Sale (Hương, Minh) nói: "Lead rác, hỏi giá cho biết."
- Tôi cần trên một bảng, theo tổ và theo NV: số lead nhận, % liên hệ trong SLA, số lần liên hệ trước khi báo Thất bại, % chấm "Kém", lý do thất bại, lead → báo giá → đơn. MH-MK-10 hiện có "Thời gian liên hệ theo NV" và "Lý do thất bại", nhưng hai bảng tách rời, chưa có tỷ lệ chuyển đổi theo tổ / NV.
- Lead chấm "Kém" do sale tự chấm, marketing không có cách phản bác. "Ghi nhận cuộc gọi" do sale tự khai. Tôi không phân xử được bằng số.
- Cuối buổi xuất Excel (MH-MK-10, MH-MK-06) để gửi BGĐ. Tôi muốn số trong file **không đổi** sau khi đã gửi.

## Góp ý

| # | Màn hình / story / UAT (mã) | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | §4.5, MK-16, MH-MK-10 thẻ "Chi phí / đơn", "Giá trị đơn" | "Thành đơn" = **bất kỳ đơn nào** của mã KH trong 60 ngày. Garage cũ mua hàng tuần, bấm quảng cáo một lần là mọi đơn thường lệ trong 60 ngày đều tính cho quảng cáo. | Chi phí / đơn đẹp giả. Tôi sẽ đổ tiền vào chiến dịch chỉ "ăn" đơn của khách vốn đã mua. | (a) Đơn chỉ tính cho lead khi **gắn với báo giá đã gửi trong lead**, hoặc là **đơn đầu tiên** sau khi tạo lead. (b) Nêu rõ tính đơn đầu hay mọi đơn trong 60 ngày, và cho tôi chọn. (c) Tách hẳn trên dashboard: lead **khách mới** / **khách cũ quay lại**, mỗi loại một CPL và chi phí / đơn riêng. | **Chặn** |
| 2 | MH-MK-10, MH-MK-06, UAT-MK-29 | Không đối chiếu được từng đơn với VCsales. Dashboard chỉ có tổng, danh sách lead không có cột mã đơn / mã báo giá VCsales. UAT-MK-29 ghi "khớp 100%" nhưng không nói khớp với báo cáo nào của VCsales. | Câu đầu tiên BGĐ hỏi tôi: "Số này lấy từ đâu, khớp VCsales không?". Không kiểm được thì không ai dùng. | Thêm cột "Mã báo giá", "Mã đơn VCsales", "Giá trị đơn", "Ngày đơn" ở MH-MK-06 và trong file xuất. Thêm dòng "Tổng giá trị đơn gắn lead / Doanh số division cùng kỳ (VCsales)" để thấy tỷ trọng. UAT-MK-29 ghi rõ báo cáo VCsales dùng để so và cách so (theo mã đơn). | **Chặn** |
| 3 | MH-MK-10, §4.3, §4.4 | Chưa có bảng đối chất marketing và sale. Cần một bảng theo **tổ / NV**: lead nhận · % liên hệ trong SLA · số lần liên hệ trung bình trước khi Thất bại · % chấm Kém · lead → báo giá → đơn · giá trị đơn. Và một bảng theo **chiến dịch** với cùng các cột. | Cuộc họp cuối tháng là lý do chính để tôi mở màn hình này. Thiếu bảng này thì cuộc họp vẫn là cảm tính. | Thêm khối "Chất lượng lead và xử lý lead" trên MH-MK-10: nhóm theo Tổ / NV / Chiến dịch, bấm xuống danh sách lead. Quyền xem theo tên NV như dòng 9 hiện tại. | **Chặn** |
| 4 | §4.3 "Chất lượng", MH-MK-07 #5 | Chất lượng lead do sale chấm một mình, không bắt buộc, không có lý do. Marketing không phản bác được. | Sale chấm "Kém" để đẩy lỗi; marketing không có bằng chứng. Hai bên cãi mãi. | Chấm "Kém" bắt buộc chọn lý do (Hỏi cho biết / Sai đối tượng / Ngoài khu vực / Giá thấp hơn được…). Marketing được bấm **"Không đồng ý chấm"** kèm ghi chú → giám sát quyết. Dashboard hiện số lead đang tranh chấp. Lead Thất bại "Không liên lạc được" phải có ≥ 3 lần ghi nhận liên hệ ở ≥ 2 thời điểm khác nhau. | **Nên sửa** |
| 5 | §4.4 SLA, MH-MK-07 "Ghi nhận cuộc gọi" | "Đã liên hệ" dựa vào sale tự bấm Ghi nhận cuộc gọi, không kiểm được. Chưa nói tin tự động (tin chào OA, chatbot, private reply tự động) có dừng đồng hồ không. | Tự khai thì chỉ số SLA không còn đáng tin. Tin tự động mà dừng đồng hồ thì SLA luôn xanh. | Ghi rõ: tin bot / tin tự động **không** tính là liên hệ. Dashboard tách "liên hệ bằng tin" và "liên hệ bằng ghi nhận cuộc gọi" để tôi thấy tỷ lệ. Khi có tổng đài, lấy nhật ký gọi làm bằng chứng (GĐ sau). | **Nên sửa** |
| 6 | §4.4, MK-05, MK-07 | Chưa rõ **ai chịu SLA** trong từng khúc: lead nằm "Chưa phân công", lead bị thu hồi rồi giao người khác, lead ngoài giờ. Người nhận sau cùng chốt đơn thì công ghi cho ai? | Họp tổ sẽ hỏi "trễ này của ai". Thu hồi mà không rõ công thì sale sẽ phản đối tự thu hồi. | Mỗi lead lưu các khúc thời gian theo người chịu: Chưa phân công → GS nhóm; Đã giao → người nhận; ngoài giờ → không tính. Báo cáo SLA theo NV chỉ tính khúc của NV đó. Công đơn ghi cho người nhận cuối; lần thu hồi ghi vào chỉ số của người bị thu hồi. | **Nên sửa** |
| 7 | MH-MK-02 Chi phí, MK-17, Q-MK-5 | Chi phí nhập tay, sửa được bất cứ lúc nào, không ghi trước hay sau VAT, không đối chiếu hóa đơn quảng cáo. | Chi phí sửa sau cuộc họp thì CPL trong file đã gửi BGĐ khác trên màn hình. Không biết VAT thì CPL lệch 8–10%. | (a) Mỗi dòng chi phí ghi "trước VAT". (b) Có thao tác **Khóa số tháng** (TMK đề nghị, GĐBH xác nhận); sau khi khóa, sửa phải mở khóa có lý do và nhật ký. (c) Dashboard hiện "Chi phí đã khóa đến tháng …". (d) Cho đính kèm bảng chi tiết / hóa đơn từ Ads Manager. | **Nên sửa** |
| 8 | MH-MK-10 | Giữa tháng không đọc được "có ra đơn không", vì lead mới chưa kịp ra đơn. | So sánh "tháng này với tháng trước" giữa kỳ luôn sai hướng. Tôi dễ cắt nhầm chiến dịch tốt. | Thêm chế độ xem **theo lứa lead** (lead tạo tuần / tháng X → báo giá, đơn tới hôm nay, sau 7 / 30 / 60 ngày). Ô nào chưa đủ thời gian thì gắn nhãn "Chưa đủ 60 ngày". | **Nên sửa** |
| 9 | MH-MK-10, MH-MK-02 | Thiếu cột ngân sách dự kiến so với đã chi, và mục tiêu lead so với thực tế, dù đã có trong MarketingCampaign. | Đầu tháng tôi duyệt ngân sách theo chiến dịch. Cần thấy chiến dịch nào tiêu vượt, chiến dịch nào không đạt mục tiêu. | Thêm vào bảng theo chiến dịch: "Ngân sách", "Đã chi / Ngân sách (%)", "Mục tiêu lead", "Đạt (%)". Tô màu khi đã chi > 100% hoặc số lead đạt < 50% khi đã qua nửa thời gian chạy. | **Nên sửa** |
| 10 | §4.2, MK-02, MH-MK-10 dòng "Không rõ" | Chưa có mục tiêu hay cảnh báo cho tỷ lệ lead "Không rõ" / "Ước lượng". Lead OA follow phần lớn sẽ là "Ước lượng". | Nếu "Không rõ" + "Ước lượng" > 30% thì dashboard không đủ để phân bổ ngân sách. | Thẻ chỉ số thứ 7: "% lead có nguồn Chính xác" (MK-G3), đỏ khi < 70%. Khi sale tạo lead tay hoặc nhận khách mới, bắt buộc hỏi "Anh/chị biết VCparts qua đâu?" (danh sách chọn). Lead "Ước lượng" không cộng vào CPL chính; hiện thành dòng riêng. | **Nên sửa** |
| 11 | §4.1, §1.2 | Khách xem quảng cáo xong thường gọi hotline hoặc nhắn **Zalo cá nhân của sale**. Các lead này không vào Hộp thư lead nên chiến dịch bị tính thiếu. | Garage VCparts quen nhắn Zalo sale. Nếu bỏ nguồn này, CPL của Zalo Ads và Fanpage bị tính cao hơn thực tế. | Sale bấm "Tạo lead" từ hội thoại Zalo cá nhân (file 03), chọn nguồn và chiến dịch từ danh sách chiến dịch đang chạy. Nguồn này gắn cờ "sale khai" để tách khi xem. Hotline: nhập tay với nguồn "Hotline". | **Nên sửa** |
| 12 | §4.3 "Lead hợp lệ", MK-15 | CPL tính trên "lead hợp lệ" = mọi lead không bị đánh Không hợp lệ, gồm cả lead **chưa có SĐT** (OA follow, Messenger chưa để số). | Lead follow OA rất rẻ nên CPL đẹp nhưng sale không liên hệ được. Hai chiến dịch khác loại bị so như nhau. | Thêm chỉ số "Chi phí / lead liên hệ được" (có SĐT hoặc đang có hội thoại hai chiều). Tách cột "Chưa có SĐT" trong bảng chiến dịch. | **Nên sửa** |
| 13 | §3.6, D-MK-8, MK-10, MH-MK-04 #6 | Kịch bản chatbot có nội dung bảo hành, đổi trả, khuyến mãi mà chỉ TMK duyệt. Bộ kiểm tra chỉ bắt số tiền, không bắt "%", "giảm", "miễn phí", "tặng", "giao trong X giờ". | Chatbot hứa sai thì sale và CSKH phải gánh với khách, không phải marketing. Chatbot nói "giảm 10%" đã là cam kết giá. | Khối có nội dung chính sách hoặc khuyến mãi: **GĐBH duyệt thêm**. Mở rộng bộ lọc sang %, "giảm", "miễn phí", "tặng", "cam kết", "giao trong". Khuyến mãi bắt buộc có ngày hết hạn; quá hạn thì khối tự tắt. Ghi rõ ai chịu trách nhiệm khi bot nói sai: người duyệt phiên bản kịch bản đó. | **Nên sửa** |
| 14 | MH-MK-05 #9 "Thường trả lời trong {n} phút" | Widget hứa với khách "trả lời trong 5 phút", trong khi chưa chốt ai trực livechat (Q-MK-9). | Hứa mà không làm được thì mất uy tín thương hiệu ngay trên website. | Chỉ hiện câu này khi thời gian nhận trung vị 7 ngày gần nhất thật sự ≤ n phút. Nếu không, hiện "Nhân viên sẽ phản hồi sớm". Chốt Q-MK-9 trước khi mở GĐ2. | **Nên sửa** |
| 15 | MH-MK-01 #18 nhập file, UAT-MK-03 | Một ô tích "đã đồng ý" cho cả file là bằng chứng yếu theo NĐ 13. Lead hội chợ, hotline và form Zalo Ads có nguồn đồng ý khác nhau. | Khi thanh tra hoặc khách khiếu nại, tôi phải chứng minh được khách đã đồng ý cho từng người. | Mỗi lần nhập ghi: loại bằng chứng (form Zalo Ads có ô đồng ý / phiếu hội chợ giấy / ghi âm hotline), người chịu trách nhiệm, đính kèm mẫu phiếu hoặc ảnh chụp mẫu form. Bản ghi đồng ý của từng lead trỏ tới lần nhập đó. Pháp chế rà câu chữ trước GĐ MVP. | **Nên sửa** |
| 16 | MK-13, MH-MK-09 | SĐT tách từ bình luận công khai thành lead và được nhắn riêng tự động, nhưng chưa có ghi nhận đồng ý. | Khách tự để số công khai chưa chắc đã là đồng ý cho công ty xử lý dữ liệu theo NĐ 13. | Tin nhắn riêng đầu tiên có câu thông báo xử lý dữ liệu + link chính sách. Lead từ bình luận hiện "Đồng ý: chưa có (nguồn công khai)" ở MH-MK-07. Chờ pháp chế xác nhận. | **Nên sửa** |
| 17 | MH-MK-10 thẻ "Liên hệ trung vị" | Trung vị 4 phút 10 giây che mất các lead bị bỏ quên. MK-G1 (% chưa liên hệ sau 24h) không có trên dashboard. | Chỉ một lead garage lớn bị bỏ 2 ngày đã đủ mất khách. Trung vị không cho tôi thấy điều đó. | Thêm thẻ "Lead chưa liên hệ > 24h" (con số, đỏ khi > 0, bấm ra danh sách) và "% liên hệ trong SLA". | **Nên sửa** |
| 18 | GD-04, §11 lộ trình | Chi phí nhập tay đã ở MVP nhưng dashboard CPL lại ở GĐ2. Ở MVP tôi chỉ có "bảng lead → báo giá". | Tiền quảng cáo đang chi mỗi tháng. Chờ tới GĐ2 là thêm vài kỳ duyệt ngân sách mù. | Kéo lên MVP bản rút gọn của MH-MK-10: bảng theo chiến dịch (lead, hợp lệ, chi phí, CPL, báo giá, đơn, chi phí / đơn) + xuất Excel. Biểu đồ để GĐ2. | **Nên sửa** |
| 19 | MH-MK-08 | Màn hình quy tắc chưa cho thấy kết quả chia: bao nhiêu lead mỗi người nhận, bao nhiêu lead đang mở của mỗi người trong 30 ngày. | Tôi chốt quy tắc nhưng không biết chia có công bằng không. Tranh chấp trong tổ sẽ lên tới tôi. | Thêm tab "Kết quả chia 30 ngày": theo quy tắc × người, gồm lead nhận, lead mở, bị thu hồi, trả lead. | **Gợi ý** |
| 20 | MH-MK-10, GD-03 | Chưa thấy giá trị báo giá đang mở sinh ra từ quảng cáo. | Giữa tháng, báo giá đang mở là dấu hiệu sớm nhất để biết chiến dịch có ra tiền không. | Thêm cột "Báo giá đang mở (giá trị)" theo chiến dịch, đọc từ VCsales, ghi thời điểm lấy. | **Gợi ý** |

**Tổng:** 20 góp ý: **3 Chặn**, **15 Nên sửa**, **2 Gợi ý**.

## Quyết định tôi cần công ty chốt

| # | Vấn đề | Tôi nghiêng về | Vì sao |
|---|---|---|---|
| D-MK-1 | Chatbot / livechat website ở GĐ2 hay GĐ3 | **GĐ2, có điều kiện.** Chỉ mở khi: (1) Hộp thư lead và dashboard MVP đã chạy ổn ít nhất 1 tháng; (2) website VCparts có lượng truy cập đủ lớn (marketing đưa số lượt truy cập / tháng hiện tại); (3) đã chốt người trực livechat (Q-MK-9). Không đủ điều kiện thì bản GĐ2 chỉ làm **form thu lead + đồng ý**, không làm livechat. | Khách garage của VCparts chủ yếu vào qua Zalo, ít qua web. Tôi không muốn tiền dev đổ vào kênh ít lead trước khi đo được kênh chính. Livechat không có người trực còn tệ hơn không có. |
| D-MK-2 | AI trả lời tự động hay chỉ gợi ý | **A + C. Chưa bật B**, kể cả ở GĐ3, cho tới khi có ít nhất 3 tháng dữ liệu câu hỏi thật. Khi bật B phải có chữ ký của cả chủ dự án và GĐBH, và chỉ cho các chủ đề giờ mở cửa, địa chỉ, cách đặt hàng. | Các chủ đề "an toàn" đó làm bằng nút soạn sẵn là đủ. Bảo hành, đổi trả nói sai là thành cam kết với khách, và sale của tôi phải gánh. |
| D-MK-3 | Quyền marketing với lead sau khi giao | **Đồng ý bảng §4.6**, cộng thêm: marketing thấy lý do Kém / Thất bại, số lần và thời điểm liên hệ, và được **phản bác chấm chất lượng** (góp ý #4). Vẫn không xem tin sale nhắn, SĐT vẫn ẩn. | Marketing cần số để tự bảo vệ, sale cần được giữ quan hệ với khách. Có luồng phản bác thì cuộc họp cuối tháng mới có số để đối chất. |
| D-MK-6 | SLA liên hệ lead | 5 phút cho lead web / Messenger đang chat. **15–30 phút** cho lead chỉ có SĐT (form, nhập file) vì sale đang đi thị trường. Tự thu hồi: bật cho lead khách mới, **tắt** cho lead "Khách cũ quay lại". | Một mức 5 phút cho mọi lead thì sale ngoài đường vi phạm liên tục, và chỉ số mất giá trị. Thu hồi khách cũ khỏi owner trái BR09. |
| D-MK-7 | Khối kịch bản có số tiền | **Chặn hẳn**, mở rộng sang % và các chữ khuyến mãi (góp ý #13). | Giá chỉ ở VCsales. |
| D-MK-8 | Ai duyệt kịch bản có nội dung chính sách | **Không đồng ý đề xuất.** Nội dung chính sách hoặc khuyến mãi: TMK soạn, **GĐBH duyệt**. | Hậu quả của chính sách rơi vào đội bán hàng. Thẻ VCwiki đã duyệt vẫn có thể cũ hoặc không hợp với kênh chat. |
| Mới D-MK-9 | Định nghĩa "Thành đơn" và công của đơn | Đơn đầu tiên sau khi tạo lead, hoặc đơn gắn với báo giá đã gửi trong lead. Khách cũ tính riêng. | Góp ý #1. |
| Mới D-MK-10 | Khóa số liệu tháng | Có. TMK đề nghị khóa, GĐBH xác nhận. Sau khi khóa, sửa phải có lý do. | Góp ý #7: số đã báo BGĐ không được tự đổi. |
| Mới D-MK-11 | Cửa sổ Thành đơn cho VCparts | 60 ngày được, nhưng xem được thêm theo lứa lead 7 / 30 / 60 ngày. VCedu tự chốt riêng (Q-MK-7). | Chu kỳ ra đơn phụ tùng thường ngắn. Tôi cần thấy sớm, không chờ đủ 60 ngày. |

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Tên | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| UAT-MK-39 | Garage cũ mua định kỳ bấm quảng cáo | 0900 000 003 (owner Tuấn) có đơn VCsales mỗi tuần | Khách nhắn Fanpage từ ad `…0001`; 60 ngày sau có 8 đơn thường lệ, không có báo giá mới qua lead | Lead "Khách cũ quay lại"; theo định nghĩa đã chốt (D-MK-9), CD1 **không** nhận cả 8 đơn; dashboard tách dòng khách cũ |
| UAT-MK-40 | Đối chiếu từng đơn với VCsales | CD1 có 6 lead Thành đơn | GĐBH xuất Excel lead Thành đơn của CD1; sale admin tra 6 mã đơn trên VCsales | File có mã báo giá, mã đơn, giá trị, ngày; 6/6 mã đơn tồn tại trên VCsales, giá trị khớp tại thời điểm lấy |
| UAT-MK-41 | Sửa chi phí sau khi khóa số tháng | Tháng 10 đã khóa | TMK sửa chi phí ngày 15/10 | Bị chặn, yêu cầu mở khóa; GĐBH mở khóa có lý do; nhật ký ghi số cũ, số mới, người, lý do; dashboard báo "Số tháng 10 đã sửa sau khóa" |
| UAT-MK-42 | Tranh chấp chất lượng lead | Lan chấm Kém lead L-…125, lý do "Hỏi cho biết" | Hà-mk bấm "Không đồng ý chấm" + ghi chú; Phong (GS) xem hội thoại, giữ hoặc đổi | Lead hiện cờ "Đang tranh chấp"; dashboard đếm tranh chấp theo tổ; kết quả GS quyết có nhật ký |
| UAT-MK-43 | Công và SLA khi lead bị thu hồi | Quy tắc HN, SLA 5 phút, tự thu hồi 3× | Lan không liên hệ; phút 15 lead chuyển Tuấn; Tuấn liên hệ phút 17 và ra đơn | Báo cáo SLA: Lan 1 lần quá SLA / bị thu hồi; Tuấn liên hệ trong SLA của khúc mình; công đơn ghi Tuấn |
| UAT-MK-44 | Tin tự động không tính là liên hệ | Chatbot Fanpage chào ngay khi khách nhắn từ quảng cáo | Không sale nào nhắn trong 5 phút | Đồng hồ SLA vẫn chạy; phút 5 báo quá SLA; tin bot không tính là "Đã liên hệ" |
| UAT-MK-45 | Xem theo lứa lead giữa tháng | Lead CD1 tạo 01–07/10 | Ngày 15/10 mở MH-MK-10 chế độ lứa | Lứa 01–07/10 hiện đơn tới ngày 15/10; cột 30 và 60 ngày gắn nhãn "Chưa đủ thời gian" |
| UAT-MK-46 | Lead Zalo cá nhân do sale tạo | Khách nhắn nick Zalo của Minh: "thấy quảng cáo má phanh trên Facebook" | Minh bấm Tạo lead, chọn CD1 | Lead nguồn "Zalo cá nhân · sale khai", tính vào CD1 ở dòng riêng, không trộn vào "Chính xác" |
| UAT-MK-47 | Chatbot hứa khuyến mãi | Kịch bản nháp có câu "Giảm 10% cho khách đặt hôm nay" | NVMK gửi duyệt | Bị chặn hoặc bắt buộc GĐBH duyệt (theo D-MK-7/8); khuyến mãi thiếu ngày hết hạn thì không xuất bản được |
| UAT-MK-48 | Lead ngoài giờ dịp lễ | Lịch nghỉ Tết Dương lịch 01/01 | Khách gửi form 22:00 ngày 31/12 | Hạn SLA = giờ mở cửa ngày làm việc kế tiếp + 30 phút; không báo quá SLA trong ngày lễ; báo cáo SLA không tính khúc nghỉ |
| UAT-MK-49 | Tỷ lệ nguồn Không rõ vượt ngưỡng | 40% lead tháng không có chiến dịch | Mở MH-MK-10 | Thẻ "% lead có nguồn Chính xác" đỏ; bấm ra danh sách lead Không rõ để marketing gắn bù |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/05-P-GD.md) | — |
