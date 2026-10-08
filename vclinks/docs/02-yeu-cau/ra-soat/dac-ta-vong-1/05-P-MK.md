# Góp ý 05 — P-MK (Tùng, marketing)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Tùng (P-MK, marketing) góp ý đặc tả 05 Marketing, quảng cáo, chatbot, vòng 1; file lưu ngày 30/09/2026.
- 24 góp ý: **5 Chặn · 14 Nên sửa · 5 Gợi ý**; kèm ý kiến về D-MK-1, 2, 3, 4 câu hỏi thêm và 13 ca UAT đề xuất.
- Chặn: khách bấm quảng cáo rồi nhắn Zalo cá nhân sale thì quảng cáo mất công; "Thành đơn" cần mã KH và báo giá ngoài VClinks không được tính; NVMK không được xuất Excel; chỉ TMK nhập chi phí; UAT-MK-31 lệch giai đoạn với trình dựng chatbot.
- Nên sửa: hai chiến dịch OA chạy trùng, follow OA chưa có SĐT tính là lead hợp lệ, chất lượng lead không bắt buộc, lead nằm im, gắn ad_id từng cái, hẹn giờ khuyến mãi.
- Ý kiến chính: tách phần chào + nút + thu SĐT cho Fanpage vào MVP; AI theo A + C; marketing cần xem tiến trình lead và quyền phản đối.
- Kết quả xử lý ở [05-xu-ly.md](05-xu-ly.md): 22 đã sửa, 2 hỏi chủ dự án (D-MK-1, D-MK-7).
- Còn mở: chatbot Fanpage ở MVP (D-MK-1), số tiền / khuyến mãi trong chatbot (D-MK-7), tự tạo lead từ Zalo cá nhân (D-MK-15).

## Mục lục

- [Một tuần của tôi trên VClinks](#một-tuần-của-tôi-trên-vclinks)
- [Góp ý](#góp-ý)
- [Câu hỏi của tôi](#câu-hỏi-của-tôi)
- [Kịch bản UAT tôi muốn thêm](#kịch-bản-uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Đọc xong tôi thấy đây là lần đầu có người hiểu việc của marketing: Hộp thư lead, gắn ad_id, đồng hồ SLA, phễu tới đơn VCsales đều đúng thứ tôi cần. Ba chỗ làm tôi lo nhất. Một: số "ra đơn" phụ thuộc hoàn toàn vào việc sale có bấm đúng nút không (gửi báo giá qua VClinks, ghi nhận cuộc gọi, liên kết mã KH). Sale không làm thì báo cáo của tôi sai mà tôi không biết. Hai: khách bấm quảng cáo rồi nhắn thẳng Zalo cá nhân của sale thì quảng cáo mất công. Ba: tôi là người làm báo cáo tuần nhưng lại không được nhập chi phí, không được xuất Excel. Phần chatbot có nháp, xem trước, gửi duyệt là tốt; chỉ thiếu hẹn giờ cho khuyến mãi và đang chặn cả chữ "giảm 50k".

## Một tuần của tôi trên VClinks

**Thứ Hai 8:30 — lên chiến dịch "Má phanh Vios tháng 10"**
1. MH-MK-02: "+ Tạo chiến dịch", điền mã, tên, kênh, thời gian, ngân sách. Mã UTM tự sinh. Khoảng 8 thao tác, ổn.
2. Sang Meta Ads Manager tạo 1 chiến dịch, 2 nhóm, 6 quảng cáo (3 mẫu video × 2 tệp). Quay lại MH-MK-02 để gắn. **Vướng:** lúc này quảng cáo chưa chạy nên chưa có ad_id nào trong danh sách gợi ý. Tôi phải chép tay 6 ad_id từ Ads Manager, mỗi cái mở một Modal. Tổng khoảng 25 thao tác. Tuần sau tôi nhân bản quảng cáo để thử mẫu mới thì lại ra ad_id mới và phải gắn tiếp.
3. Tab "Link UTM": tạo link cho quảng cáo traffic về web. Ổn, 4 thao tác.
4. Zalo Ads: tạo quảng cáo tăng người quan tâm OA. MH-MK-02 **không có gì để gắn** (không có ad_id, link OA có tham số thì "cần kiểm tra lại"). Tôi chỉ biết chiến dịch sẽ được gắn kiểu "Ước lượng". Đang chạy song song chiến dịch OA của VCedu thì không rõ follow được tính cho ai.
5. MH-MK-01: kiểm luồng "Tin nhắn từ quảng cáo" đang bật. Tôi xem được nhưng không bật/tắt được (chỉ TMK). Chấp nhận được.

**Thứ Hai 10:00 — cập nhật chatbot cho khuyến mãi "Giảm 10% má phanh tới 31/10"**
6. MH-MK-04: mở kịch bản, sửa khối B0 thêm nút "Ưu đãi tháng 10", thêm khối Tin nói về khuyến mãi. Gõ "giảm 50k cho đơn từ 500k" → **bị cảnh báo giá (MK-10), nếu chốt D-MK-7 là chặn thì không xuất bản được.**
7. "Thử" → xem luồng. MH-MK-05 xem trên điện thoại, ngoài giờ. Tốt.
8. "Gửi duyệt" → chờ TMK. **Vướng:** không đặt được giờ xuất bản 00:00 ngày 01/10 và tự gỡ lúc 23:59 ngày 31/10. Tôi phải nhờ TMK bấm xuất bản đúng giờ, rồi nhớ gỡ.
9. Muốn chatbot Fanpage chào khác nhau theo quảng cáo (quảng cáo má phanh thì hỏi đời xe, quảng cáo VCedu thì hỏi khóa học). Khối "Điều kiện" chỉ có biến / giờ / SĐT / khách cũ, **không có điều kiện theo chiến dịch / ad_id / ref**.

**Thứ Ba – Thứ Năm — theo dõi lead**
10. MH-MK-06 mỗi sáng: tab "Quá SLA", "Chưa phân công". Ổn, 1–2 thao tác.
11. **Vướng:** không có chỗ xem "đã giao hơn 2 ngày mà vẫn Đã liên hệ / Đang tư vấn, không cập nhật gì". Đồng hồ SLA chỉ đo lần chạm đầu. Sau đó lead nằm im tôi không thấy.
12. MH-MK-09 bình luận: phần lớn bình luận là "giá bao nhiêu", "ib em" không có SĐT. Tự nhắn riêng chỉ bật cho bình luận **có SĐT**. Tôi vẫn phải bấm tay từng bình luận.
13. Sale Tuấn chấm 5 lead "Kém". Tôi mở MH-MK-07: thấy nguồn, điểm chạm, phần chat với bot. Không thấy sale đã hỏi gì, gọi mấy lần. Không đủ để cãi.
14. Một khách bấm quảng cáo Messenger thứ Hai, thứ Năm nhắn thẳng Zalo cá nhân của Lan (số in trên video). VClinks không tạo lead, không gắn quảng cáo. Đơn thứ Sáu tính vào "khách tự nhiên" của Lan.

**Thứ Sáu 15:00 — báo cáo tuần cho anh Thắng**
15. MH-MK-02: nhập chi phí → **không làm được, chỉ TMK**. Tôi phải nhắn TMK số tiền từ Ads Manager.
16. MH-MK-10: đổi thời gian thành "tuần này". **Không có nhanh "tuần này / tuần trước"**. Lead tạo tuần này mà đơn thường về sau 1–2 tuần, nên tỷ lệ ra đơn luôn thấp. Không có nhãn "chưa đủ thời gian".
17. "Xuất Excel" → **nút không có với NVMK**. Tôi phải chụp màn hình dán vào slide.
18. Anh Thắng hỏi "khớp VCsales không?". Có dòng "lấy lúc 11:45" là tốt. Nhưng tôi không biết bao nhiêu lead có đơn mà chưa liên kết mã KH nên không tính được.

## Góp ý

| # | Màn hình / story / UAT (mã) | Góp ý | Vì sao (tình huống thật) | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | §4.1, §4.2, MK-03, MK-US-13 | Khách bấm quảng cáo rồi nhắn **Zalo cá nhân của sale** thì quảng cáo mất công. Zalo cá nhân không nằm trong danh sách tạo lead; hồ sơ Messenger (chỉ PSID, chưa có SĐT) và Zalo (có SĐT) không gộp được. | Video phanh Vios có in số Zalo của tổ. Khách xem quảng cáo thứ Hai, thứ Năm nhắn Zalo Lan, thứ Sáu ra đơn 3 triệu. Báo cáo ghi quảng cáo 0 đơn. Tôi sẽ bị cắt ngân sách oan. | (1) Tin **đầu tiên** của người mới tới Zalo cá nhân sale cũng tạo lead (nguồn "Zalo cá nhân · Không rõ"), không cần sale bấm. (2) Sale / NVMK có nút "Khách biết qua…" chọn chiến dịch → nguồn "Khách tự khai", tách dòng như "Ước lượng". (3) Khi gộp hồ sơ PSID ↔ SĐT về sau (file 02), lead Zalo trong 30 ngày tự nhận điểm chạm quảng cáo trước đó. | **Chặn** |
| 2 | §4.5, MK-16, MH-MK-10, UAT-MK-23 | "Thành đơn" chỉ bật khi lead **đã liên kết mã KH**. Khách mới từ quảng cáo gần như chưa có mã KH. "Đã báo giá" chỉ bật khi báo giá gửi **qua VClinks**. | Sale quen gửi PDF báo giá từ VCsales qua Zalo điện thoại. Sale admin tạo mã KH sau 2–3 ngày. Kết quả: phễu "Báo giá → Đơn" thấp giả, CPL/đơn cao giả. | (1) Dashboard hiện rõ số "Lead có đơn nhưng chưa liên kết mã KH" / "Lead chưa có mã KH" để tôi đi nhắc. (2) Khi sale admin tạo mã KH mới, VClinks gợi ý liên kết với lead mở cùng SĐT (người duyệt). (3) Đối chiếu lại lùi 60 ngày mỗi khi liên kết. | **Chặn** |
| 3 | MH-MK-10 #12, MH-MK-06 #18, §4.6 | NVMK **không được xuất Excel**, kể cả báo cáo tổng không có SĐT. | Người làm báo cáo tuần là tôi, không phải TMK. Chụp màn hình thì anh Thắng không lọc lại được. | NVMK xuất được bảng tổng MH-MK-10 (không có dữ liệu cá nhân). Xuất danh sách lead có SĐT ẩn vẫn để TMK. | **Chặn** |
| 4 | MK-17, MH-MK-02 #22–23, MK-US-15 | Chỉ TMK nhập chi phí. | Tôi là người mở Ads Manager hằng ngày. TMK không có thời gian nhập 3 chiến dịch × 7 ngày. Không có chi phí thì CPL "–" cả tuần. | NVMK nhập / nhập file chi phí; TMK **khóa kỳ** (khóa tuần / tháng) sau khi đối soát. Sửa sau khóa mới cần TMK. Vẫn giữ nhật ký. | **Chặn** |
| 5 | §2.2, §11 MVP, UAT-MK-31, MK-US-09 | Không khớp giai đoạn: UAT-MK-31 (MVP) mong "chatbot Fanpage chào theo kịch bản", nhưng trình dựng kịch bản (MH-MK-04) ở GĐ2. | Quảng cáo Click-to-Messenger chạy cả tối và cuối tuần. Không có lời chào + nút hỏi đời xe thì khách hỏi xong không ai trả lời tới sáng, bỏ đi. Đang đốt tiền. | MVP có tối thiểu **lời chào + tối đa 3 nút + thu SĐT** cho Fanpage theo kịch bản đã duyệt (cấu hình đơn giản, chưa cần kéo thả). Trình dựng đầy đủ để GĐ2. | **Chặn** |
| 6 | §2.1, §4.2 (cửa sổ thời gian), MK-02 | Chưa có quy tắc khi **hai chiến dịch OA chạy trùng thời gian**. "Ước lượng" gắn cho chiến dịch nào? | Tháng 10 VCparts chạy OA follow, VCedu cũng chạy. Nếu dùng chung OA thì số follow bị chia sai, không so được. | Ghi rõ: trùng thời gian → gắn "Ước lượng – nhiều chiến dịch", không tự chia; hoặc cho TMK đặt tỷ lệ chia. Ưu tiên kiểm tra sớm link / QR OA có tham số (Q-MK-3) vì đây là gốc vấn đề. | Nên sửa |
| 7 | §4.1, MK-US-06, MH-MK-10 CPL | **Follow OA "chưa có SĐT" được tính là lead hợp lệ** → CPL chiến dịch OA đẹp giả, không so được với Fanpage. | 1 follow giá 3.000 đ, 1 tin nhắn Messenger giá 40.000 đ. Anh Thắng nhìn CPL sẽ dồn tiền sang OA follow. | Tách loại "Người quan tâm" (chưa liên hệ được) khỏi "Lead hợp lệ". Chỉ thành lead hợp lệ khi có SĐT hoặc đã có hội thoại hai chiều. Dashboard hiện cả hai cột. | Nên sửa |
| 8 | §4.3, MH-MK-07 #5, MK-US-13 | Chất lượng lead **không bắt buộc**; sale chấm "Kém" không cần lý do; sale đánh "Không hợp lệ" thì lead ra khỏi CPL mà tôi không được báo. | Tranh cãi "lead rác" tuần nào cũng có. Không có lý do thì không sửa được tệp quảng cáo. Sale đánh bừa "Không hợp lệ" cho nhẹ KPI thì CPL của tôi tăng. | (1) Bắt buộc chấm chất lượng khi chuyển Thất bại / sau 3 ngày giao. (2) "Kém" phải chọn lý do (sai nhu cầu, ngoài khu vực, chỉ hỏi giá, không có xe…). (3) Sale đánh "Không hợp lệ" → NVMK nhận thông báo, có nút "Phản đối" kèm lý do → GS quyết. | Nên sửa |
| 9 | §4.6, D-MK-3, MH-MK-07 | Sau khi giao, tôi không thấy **sale đã làm gì**: số lần gọi, kết quả gọi, lần cập nhật cuối. | Muốn biết lead "Kém" thật hay sale gọi 1 lần không nghe rồi bỏ. Không cần đọc tin sale nhắn. | Cho NVMK xem **Tiến trình** đầy đủ trừ nội dung tin: số lần liên hệ, kênh, kết quả gọi, thời điểm hoạt động cuối, lý do thất bại + ghi chú. | Nên sửa |
| 10 | MH-MK-06 tab nhanh | Không có tab / lọc **lead nằm im** sau lần chạm đầu. | Lead "Đã liên hệ" 5 ngày không đổi trạng thái là mất khách, nhưng SLA đã xanh nên không ai thấy. | Thêm tab "Không cập nhật > N ngày" (N cấu hình, mặc định 3) và dòng tương ứng trong Dashboard. Báo GS như quá SLA. | Nên sửa |
| 11 | MK-05, "Đã liên hệ" | "Đã liên hệ" chỉ tính tin gửi qua VClinks hoặc nút "Ghi nhận cuộc gọi". Sale gọi bằng điện thoại riêng mà quên bấm → SLA đỏ, số liệu thời gian liên hệ sai. | Sale gọi xong là chuyển khách khác, ít ai quay lại bấm nút. Báo cáo "liên hệ trung vị" sẽ vô nghĩa. | Dashboard hiện "% lead liên hệ không có ghi nhận" để thấy mức tin cậy; nhắc sale bấm (thông báo 1 lần khi lead đỏ). Nếu có tổng đài / VCdms ghi cuộc gọi thì đọc về (câu hỏi cho chủ dự án). | Nên sửa |
| 12 | MH-MK-02 #15, MK-US-03 | Gắn ad_id **từng cái một**, và chỉ gợi ý ad_id đã thấy trong webhook. | Một chiến dịch có 6–20 quảng cáo, nhân bản mỗi tuần. Gắn tay dễ sót, sót thì lead về "Không rõ". | (1) Dán nhiều ad_id một lần (mỗi dòng một mã). (2) Chọn nhiều dòng trong cảnh báo "quảng cáo chưa gắn" → gắn một chạm. (3) Khi có Marketing API: gắn theo **ID chiến dịch / nhóm Meta**, ad mới tự vào. | Nên sửa |
| 13 | D-MK-7, MK-10, MH-MK-04 #6 | Chặn mọi số tiền trong bot thì **không viết được khuyến mãi** ("giảm 50k", "freeship đơn từ 500k"). | Mỗi tháng có 1–2 chương trình. Chatbot không nói được ưu đãi thì quảng cáo và bot nói hai giọng. | Chặn **giá sản phẩm** và tồn kho; cho phép câu khuyến mãi khi khối có nhãn "Khuyến mãi" + thời hạn, TMK duyệt (có thể thêm GĐBH). Cảnh báo, không chặn cứng. | Nên sửa |
| 14 | MH-MK-04, MK-US-09 | Không **hẹn giờ xuất bản** và **tự hết hạn** cho khối / kịch bản khuyến mãi. | Khuyến mãi bắt đầu 00:00 thứ Hai, hết 23:59 ngày 31. Không ai thức để bấm. Quên gỡ thì bot hứa ưu đãi đã hết → khách mắng sale. | "Hiệu lực từ – đến" trên phiên bản hoặc trên khối; hết hạn tự về phiên bản trước; ghi nhật ký. | Nên sửa |
| 15 | MH-MK-04 #9 (Điều kiện) | Điều kiện trong kịch bản không có **chiến dịch / ad_id / ref / UTM**. | Quảng cáo má phanh thì bot hỏi đời xe; quảng cáo VCedu thì hỏi khóa học. Chào chung một câu làm khách phải bấm thêm, tụt tỷ lệ để lại SĐT. | Thêm điều kiện "Nguồn: chiến dịch / quảng cáo / ref / utm_campaign" và "Điểm bắt đầu theo chiến dịch". | Nên sửa |
| 16 | MH-MK-04 quyền, MK-10 | Chỉ TMK duyệt. Không nói nếu TMK vắng thì sao, duyệt trong bao lâu. | Công ty có thể chưa có trưởng marketing riêng cho từng division (Q-MK-1). TMK nghỉ phép thì kịch bản khuyến mãi kẹt. | Cho cấu hình người duyệt thay (GĐBH hoặc người được ủy quyền tạm, file 01); thông báo nhắc duyệt sau 4 giờ làm việc. | Nên sửa |
| 17 | §3.3, MH-MK-05 #13–17 | Form web bắt buộc **Họ tên + SĐT + tích ô + bấm Gửi**. Mỗi bước bớt đi vài % khách. | Khách lướt điện thoại trên đường, chỉ muốn để số. Họ tên hay bị gõ "a", "anh". | (1) Chỉ SĐT bắt buộc, họ tên tùy chọn (sale hỏi khi gọi). (2) Nhờ pháp chế xem có dùng được **một nút "Đồng ý và gửi"** kèm câu đồng ý ngay trên nút (vẫn là hành động chủ động, không đánh sẵn) thay cho ô tích + nút. Giữ nguyên bản ghi đồng ý. | Nên sửa |
| 18 | MH-MK-10 #2, công thức | Không có nhanh "Tuần này / Tuần trước"; tỷ lệ ra đơn của lead mới luôn thấp vì đơn về chậm, không có nhãn cảnh báo. | Báo cáo thứ Sáu cho lead tạo thứ Hai–Thứ Sáu: 0 đơn là bình thường nhưng anh Thắng sẽ hỏi. | Thêm nhanh theo tuần (T2–CN). Cột đơn ghi "đang theo dõi, còn X ngày trong cửa sổ 60 ngày"; có chế độ xem theo **nhóm lead tạo** (cohort) theo tuần. | Nên sửa |
| 19 | MH-MK-02 #23, §5.2, Q-MK-5 | Chi phí nhập từ Ads Manager chưa nói **trước hay sau thuế** và đơn vị tiền. | Hóa đơn Meta có thuế; tài khoản quảng cáo có khi để USD. Mỗi người nhập một kiểu thì CPL tháng này không so được tháng trước. | Chốt một quy ước (ví dụ: chi phí trước thuế, VND) và ghi ngay dưới ô nhập. Nhập file nhận cột ID chiến dịch / ID quảng cáo Meta, tự khớp chiến dịch nội bộ qua ad_id đã gắn. | Nên sửa |
| 20 | MH-MK-09 #10 | Tự nhắn riêng chỉ cho bình luận **có SĐT**. | 80% bình luận quảng cáo là "giá?", "ib", "còn không shop". Đây mới là chỗ tốn công nhất. | Thêm "Tự nhắn riêng theo từ khóa" (giá, ib, inbox, còn không…) với mẫu đã duyệt, một lần / bình luận, vẫn trên kênh chính thức. | Gợi ý |
| 21 | §2.3, §3 | Website của division có thể đã có **form liên hệ riêng** (không phải widget). Lead từ đó không vào VClinks. | vcparts.vn đang có form "Yêu cầu báo giá". Nếu không nối thì vẫn phải tải email về nhập tay. | Cung cấp cách đẩy form có sẵn vào Hộp thư lead (ví dụ đoạn mã gửi form + UTM), cùng yêu cầu đồng ý NĐ 13. | Gợi ý |
| 22 | MH-MK-06 #20, thông báo | Chỉ có thông báo từng lead. | Tôi không ngồi canh Hộp thư lead cả ngày. | Bản tin 8:00 mỗi sáng cho NVMK: lead hôm qua theo chiến dịch, số chưa liên hệ > 24h, số lead "Kém" mới. | Gợi ý |
| 23 | Lead Ads, file Zalo Ads (MH-MK-01 #18) | Bằng chứng đồng ý của lead từ form Facebook / Zalo Ads chỉ là một ô tích chung khi nhập file. | Khi khách khiếu nại "sao có số tôi", mình cần chỉ ra form nào, câu đồng ý gì. | Lưu thêm tên form, id form, thời điểm điền, link chính sách trong form vào bản ghi đồng ý của từng lead. | Gợi ý |
| 24 | MK-US-18, MH-MK-02 #21 | Link m.me có ref và QR là tốt. Chưa có mẫu tin nhắn soạn sẵn. | Khách quét QR hội chợ mở Messenger trống, không biết gõ gì. | Nếu nền tảng cho phép, kèm câu mở đầu soạn sẵn theo chiến dịch (cần kiểm tra lại chính sách Meta). | Gợi ý |

**Tổng: 24 góp ý — Chặn 5 · Nên sửa 14 · Gợi ý 5.**

## Câu hỏi của tôi

**D-MK-1 (chatbot web GĐ2, AI GĐ3):** Tôi đồng ý kéo widget website lên GĐ2. Nhưng tách riêng phần **chào + nút + thu SĐT cho Fanpage** vào MVP (góp ý 5), vì quảng cáo Messenger đang chạy ngay từ MVP. Không có nó thì MVP chỉ đo được mà không giữ được khách ngoài giờ.

**D-MK-2 (AI tự trả lời hay chỉ gợi ý):** Tôi nghiêng về **A + C** như đề xuất. Tôi không muốn chịu trách nhiệm khi bot tự nói sai chính sách bảo hành. Điều tôi cần hơn AI là: kịch bản nút đủ linh hoạt (điều kiện theo chiến dịch, hẹn giờ khuyến mãi) và có câu hỏi thường gặp dạng nút lấy từ VCwiki. Thí điểm B ở GĐ3 thì tôi muốn chỉ bật **ngoài giờ** trước.

**D-MK-3 (quyền marketing sau khi giao):** Đồng ý ẩn SĐT, không đọc tin sale nhắn, không đổi trạng thái. Nhưng xin thêm: (1) xem **tiến trình** không có nội dung tin (số lần gọi, kết quả, hoạt động cuối); (2) lý do thất bại + ghi chú đầy đủ; (3) **quyền phản đối** khi sale đánh "Không hợp lệ" / "Kém"; (4) TMK được xem hội thoại của một lead cụ thể khi có tranh chấp, có GS đồng ý và ghi nhật ký. Không có những thứ này thì D-MK-3 bảo vệ được sale nhưng không giải quyết được tranh cãi chất lượng lead.

**Câu hỏi thêm:**
- Tin nhắn đầu tiên của người lạ vào Zalo cá nhân của sale có tạo lead không? Nếu không, quảng cáo có số Zalo sale sẽ luôn bị báo cáo thấp.
- NVMK có được nhập chi phí không, nếu TMK khóa kỳ sau đối soát?
- Công ty có trưởng marketing riêng từng division không (Q-MK-1)? Nếu không thì ai duyệt kịch bản của tôi?
- Cửa sổ "Thành đơn" 60 ngày: đếm từ lúc tạo lead hay từ báo giá? Khách garage hay hỏi giá tháng này, mua tháng sau.

## Kịch bản UAT tôi muốn thêm

| Mã đề xuất | Tên | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|---|
| UAT-MK-39 | Quảng cáo Messenger → 3 ngày sau nhắn Zalo cá nhân sale | Khách bấm ad `…0001`, chat Fanpage không để SĐT | Thứ Năm khách nhắn Zalo cá nhân Lan từ 0900 000 007, Lan gửi SĐT vào hồ sơ; GS gộp hồ sơ PSID ↔ Zalo | Lead có cả hai điểm chạm; báo cáo tính công cho CD1 (điểm chạm đầu); nếu chưa gộp thì lead Zalo có nguồn "Không rõ" và gợi ý gộp |
| UAT-MK-40 | Sale tự khai nguồn | Lead Zalo cá nhân nguồn "Không rõ" | Lan chọn "Khách biết qua…" → CD1 | Nguồn "Khách tự khai", tách dòng trên Dashboard, nhật ký ghi |
| UAT-MK-41 | Đơn về khi lead chưa có mã KH | Lead khách mới, VCsales có đơn nhưng chưa liên kết mã KH | Sale admin liên kết mã KH sau 5 ngày | Lead tự "Thành đơn"; trước đó Dashboard đếm lead ở mục "Có thể có đơn, chưa liên kết" |
| UAT-MK-42 | Sale gửi báo giá ngoài VClinks | Lead Đang tư vấn | Sale gửi PDF từ VCsales qua Zalo điện thoại, không qua VClinks | Lead **không** tự Đã báo giá; Dashboard hiện rõ; khi đơn về vẫn thành "Thành đơn" |
| UAT-MK-43 | Sale đánh Không hợp lệ, marketing phản đối | Lead CD1 giao Tuấn | Tuấn đánh "Không hợp lệ – Khác"; Hà-mk bấm Phản đối | Hà-mk nhận thông báo; GS nhận phản đối; GS quyết, lead về trạng thái đúng, CPL cập nhật |
| UAT-MK-44 | Hai chiến dịch OA chạy trùng | CD2 VCparts và một chiến dịch OA VCedu cùng 01–15/10, cùng OA | Webhook follow không tham số | Nguồn "Ước lượng – nhiều chiến dịch", không tự tính cho một bên |
| UAT-MK-45 | Khuyến mãi hẹn giờ | Kịch bản v5 có khối "Ưu đãi tháng 10" hiệu lực 01/10 00:00 – 31/10 23:59 | Giả lập thời gian 30/09 23:59, 01/10 00:01, 01/11 00:01 | Khối chỉ hiện trong khoảng hiệu lực; hết hạn tự tắt; nhật ký ghi |
| UAT-MK-46 | Câu khuyến mãi có số tiền | Khối nhãn "Khuyến mãi" | Gõ "Giảm 50k đơn từ 500k" | Cảnh báo, TMK xác nhận thì xuất bản được; khối Tin thường có "Giá 350k" vẫn bị chặn |
| UAT-MK-47 | NVMK nhập chi phí, TMK khóa kỳ | Tuần 40 chưa khóa | Hà-mk nhập file chi phí 7 ngày; TMK khóa tuần; Hà-mk sửa lại | Nhập được; sau khóa thì Hà-mk không sửa được, thông báo đúng chữ; CPL cập nhật |
| UAT-MK-48 | NVMK xuất báo cáo tổng | Dashboard tuần 40 | Hà-mk bấm Xuất Excel trên MH-MK-10 | Tải được, không có SĐT / tên khách; nhật ký ghi; xuất danh sách lead ở MH-MK-06 vẫn bị ẩn nút |
| UAT-MK-49 | Lead nằm im | Lead Đã liên hệ 4 ngày không cập nhật | Mở MH-MK-06 | Lead ở tab "Không cập nhật > 3 ngày"; GS nhận nhắc |
| UAT-MK-50 | Follow OA không tính lead hợp lệ | 10 follow, 2 chia sẻ SĐT | Xem Dashboard CD2 | Người quan tâm 10, lead hợp lệ 2; CPL tính trên 2 |
| UAT-MK-51 | Bot Fanpage chào theo chiến dịch | Kịch bản có điều kiện theo ad_id | Webhook referral ad CD1 và ad CD3 | Mỗi khách nhận lời chào / nút đúng chiến dịch |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:39 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:39 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/05-P-MK.md) | — |
