# Góp ý thiết kế lượt 2 — P-AD (Quân, admin hệ thống)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Quân (P-AD, admin hệ thống) góp ý lượt 2 trên canvas bản 8; xem màn 8, 9, 9a, 9b, 1e; đối chiếu 01 v1.1, 00 v1.1 và góp ý vòng 1 của chính mình.
- Canvas mới vẽ phần quản trị từ phía giám sát; 3/5 việc hằng ngày của Admin không làm thử được (khai NVKD mới, tra vì sao NVKD không thấy khách…).
- Liệt kê 11 màn còn thiếu cho MVP: menu Quản trị, MH-PQ-02/03, 15, 06, 08, 14, 10, 13, bước ① của MH-PQ-04, tab Đồng bộ, MH-PQ-01 chế độ sửa.
- 14 góp ý: **4 Chặn** · 7 Nên sửa · 3 Gợi ý (đếm từ bảng, file không ghi tổng).
- Chặn: thiếu màn Admin; lệnh của người nghỉ việc vẫn có "Thử lại" (trái PQ-51); bước ① nghỉ việc chỉ vẽ trạng thái đã xong; nút Bàn giao bị khóa khi chưa thu điện thoại cũ.
- Nên sửa chính: Kênh kết nối thiếu cột thiết bị, cảnh báo chủ động, quy tắc màu đỏ/vàng, đường sang Gán kênh và nội dung tab Đồng bộ.
- Kết quả xử lý xem `vong-3/P-AD.md`.

## Mục lục

- [Làm thử 5 việc](#làm-thử-5-việc)
- [Màn còn thiếu cho MVP](#màn-còn-thiếu-cho-mvp)
- [Góp ý](#góp-ý)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Bản vẽ: artifact "VClinks UI Design" bản 8. Màn tôi rà: 8 Kênh kết nối, 9 Tổ của tôi, 9a Nghỉ việc và bàn giao, 9b Trực thay, 1e Nick mất kết nối / Lệnh gửi. Đối chiếu: 01-phan-quyen.md v1.1, 00-giao-dien-chung.md v1.1, góp ý vòng 1 của tôi (01-P-AD.md).

Trang Kênh kết nối là thứ tôi mở đầu tiên mỗi sáng: chấm xanh/vàng/đỏ, người giữ nick, số "nguồn / đã lưu" và nút "Báo Tú" đúng thứ tôi cần. Màn Nghỉ việc đã đưa vào việc thu nick trên điện thoại và cảnh báo "nick vẫn gửi tin từ điện thoại sau khi nghỉ", đó là nỗi sợ lớn nhất của tôi. Nhưng canvas mới vẽ phần quản trị nhìn từ phía giám sát. Các màn chỉ Admin dùng (người dùng, gán kênh, token & thiết bị, nhật ký, cảnh báo, nhập lô, NĐ 13) chưa có màn nào, nên 3 trong 5 việc hằng ngày của tôi không làm thử được.

## Làm thử 5 việc

| Việc | Màn | Số cú bấm | Vướng |
|---|---|---|---|
| (a) Sáng thấy ngay kênh/nick nào hỏng | 8 Kênh kết nối | 2 (Quản trị → Kênh kết nối), nếu có đường vào | Thanh trái "Quản trị" dẫn tới màn 9 "Tổ của tôi" (góc nhìn GS), trên đó không có lối sang Kênh kết nối. Dòng tóm tắt "6 xanh · 2 vàng · 1 đỏ" tốt, nhưng không lọc được "chỉ kênh có vấn đề". Fanpage VCedu "Mất webhook từ 27/09" đã 2 ngày mà không nổi bật hơn nick "Chậm". Không có cột **thiết bị** (laptop nào / Chrome driver nào đang chạy nick, lần gọi cuối), nên thấy nick đỏ mà không biết phải tới máy nào. Không có chuông/cảnh báo (MH-PQ-14): 2 giờ sáng nick rớt thì vẫn chưa ai biết |
| (b) Khai báo một NVKD mới vào tổ và gán nick | – | **Không làm được** | Không có MH-PQ-02 (danh sách người dùng, "+ Thêm"), MH-PQ-03 (vai trò, đơn vị), MH-PQ-06 (gán nick), MH-PQ-08 (ghép thiết bị bằng mã), MH-PQ-15 (nhập lô). Màn 9 có cây tổ chức nhưng chỉ xem, không có "+ Thêm người" |
| (c) NVKD nghỉ việc đột ngột: thu token thiết bị, lệnh chờ, xác nhận đăng xuất điện thoại | 9 → 9a | Khoảng 9: ⋯ → Nghỉ việc… → Khóa ngay (bước ① **chưa vẽ**, ước 2) → Chia đều (1) → chọn người giữ nick (2) → tick + ghi chú đăng xuất điện thoại (2) → tick quét QR (1) → Bàn giao (1) | Bước ① chỉ vẽ trạng thái "xong": không thấy dòng token thiết bị "Laptop Khoa" với lựa chọn Thu hồi / Giữ, không thấy "đơn vị đang làm quản lý". Lệnh gửi chờ lại **chuyển "Cần duyệt lại"** chứ không hủy như PQ-51, và ở màn 1e lệnh "Cần duyệt lại" của người đã nghỉ vẫn có nút **Thử lại**. Nút Bàn giao bị khóa khi chưa tick "đã thu nick trên điện thoại cũ" (vẽ theo 03, trái với 01): nghỉ đột ngột thì chiều mới thu được máy, trong lúc đó 96 khách chưa được giao ai. Cảnh báo "nick vẫn gửi tin từ điện thoại lúc 10:42" không có nút hành động nào |
| (d) Kiểm tra vì sao NVKD không thấy khách X | – | **Không làm được** | MH-PQ-03 tab "Quyền hiệu lực" với ô tra theo tên/SĐT/mã (PQ-49) chưa có trên canvas. Đây là câu hỏi hỗ trợ tôi nhận nhiều nhất |
| (e) Token OA / Page sắp hết hạn | 8 Kênh kết nối | 2–3 + đăng nhập Facebook/Zalo (Cấp lại → OAuth → quay về) | Thấy được "Token hết hạn sau 5 ngày" và nút "Cấp lại", tốt. Nhưng chỉ thấy khi tự mở trang. Chưa có nhắc trước (14 / 7 / 1 ngày) tới Admin và GĐ division. Không ghi ai cấp lần trước, cần tài khoản quản trị Page/OA nào. Không nói sau khi cấp lại hạn mới là bao lâu, cũng không nói có mất tin trong lúc token hết hạn hay không |

## Màn còn thiếu cho MVP

Các màn dưới đây có trong đặc tả 01 v1.1 nhưng chưa có trên canvas. Tôi cần chúng ngay từ ngày go-live (theo thứ tự ưu tiên):

1. **Menu / trang vào Quản trị cho Admin**: danh mục Kênh kết nối, Người dùng, Cây tổ chức, Gán kênh, Token & thiết bị, Nhật ký, Cảnh báo, Yêu cầu NĐ 13, Cài đặt bảo mật. Hiện "Quản trị" chỉ mở "Tổ của tôi".
2. **MH-PQ-02 Danh sách người dùng** + **MH-PQ-03 Chi tiết người dùng** (vai trò, đơn vị, kênh được gán, tab **Quyền hiệu lực** có tra theo tên/SĐT, tab Nhật ký).
3. **MH-PQ-15 Nhập lô người dùng** (bảng xem trước Thêm / Đổi / Lỗi / Chờ duyệt). Không có màn này thì ngày đầu phải khai 60 người bằng tay.
4. **MH-PQ-06 Gán kênh**, gồm mục **Nick chờ xác nhận** và tag "Chưa an toàn".
5. **MH-PQ-08 Token & thiết bị**, gồm **Ghép thiết bị bằng mã**, Thu hồi có lý do, Xoay vòng / Thu hồi ngay (nghi lộ).
6. **MH-PQ-14 Cảnh báo bất thường**, cùng chuông thông báo ở header (00 MH-UI-01, ghi chú canvas nói chưa vẽ).
7. **MH-PQ-10 Nhật ký truy cập** (lọc theo người, token, IP).
8. **MH-PQ-13 Yêu cầu dữ liệu cá nhân (NĐ 13)**.
9. **MH-PQ-04 bước ①** (khóa tài khoản: token thiết bị, lệnh chờ, đơn vị đang quản lý). Hiện chỉ vẽ trạng thái đã xong.
10. **Tab "Đồng bộ" của Kênh kết nối**: số bản ghi gốc với số đã lưu theo từng stream, drift đang mở, **duyệt bảng ánh xạ trường** do Claude đề xuất. Đây là việc "Zalo đổi cấu trúc" của tôi. Tab có tên nhưng chưa có nội dung.
11. **MH-PQ-01 cây tổ chức ở chế độ sửa của Admin** (thêm/sửa đơn vị, nhập từ file). Màn 9 hiện là bản chỉ xem của GS.

Có thể để sau MVP: MH-PQ-05 ma trận vai trò (bản chỉ xem là đủ), MH-PQ-09 Token MCP của tôi (nếu mặc định tắt tự tạo token).

## Góp ý

| # | Màn | Góp ý | Vì sao | Đề xuất sửa | Mức |
|---|---|---|---|---|---|
| 1 | Toàn canvas (hàng "Quản trị tổ, trực thay, nghỉ việc, kênh") | Chưa có màn quản trị nào của Admin: người dùng, gán kênh, token & thiết bị, nhật ký, cảnh báo, nhập lô, NĐ 13 (xem mục trên) | 3/5 việc thường ngày của tôi không làm thử được, nên chưa duyệt được luồng go-live | Thêm ít nhất các màn 1–9 ở mục "Màn còn thiếu" vào hàng Quản trị trước khi chốt thiết kế D1 | **Chặn** |
| 2 | 9a bước ① và 1e Lệnh gửi | Lệnh gửi người nghỉ việc đã duyệt được chuyển "Cần duyệt lại". Ở 1e, lệnh "Cần duyệt lại · Người duyệt đã nghỉ việc (Huy)" vẫn có nút **Thử lại** | PQ-51 quy định luôn hủy. Có nút Thử lại thì một người khác bấm là gửi đi một câu người đã nghỉ duyệt, không có người duyệt mới: trái nguyên tắc "không gửi khi chưa duyệt" | Bước ① ghi "Đã hủy <n> lệnh gửi của <tên>", không hiện nội dung. Ở 1e trạng thái là "Đã hủy – người duyệt nghỉ việc", chỉ có nút "Mở hội thoại" để người giữ nick mới soạn lại và tự duyệt. Bỏ nút Thử lại | **Chặn** |
| 3 | 9a bước ① | Chỉ vẽ trạng thái đã xong. Không thấy bảng token thiết bị gắn nick (Thu hồi ngay / Giữ – máy công ty), không thấy "Đơn vị đang làm quản lý" | Đây là bước nguy hiểm nhất khi nghỉ đột ngột. Không có dòng thiết bị thì tôi không chắc laptop của Khoa đã bị cắt | Vẽ trạng thái chưa khóa của bước ① theo MH-PQ-04 #2–4c: bảng thiết bị có radio mỗi dòng (mặc định Thu hồi ngay; chỉ Admin chọn Giữ, bắt buộc lý do), chọn quản lý mới cho đơn vị, nút Khóa ngay | **Chặn** |
| 4 | 9a bước ④ | Nút "Bàn giao 96 khách và 1 nick" bị khóa khi chưa tick "đã thu nick trên điện thoại cũ" (ghi chú "vẽ theo 03, chờ BA") | Nghỉ đột ngột thì chiều hoặc hôm sau mới thu được máy. Khóa cả nút nghĩa là 96 khách không ai nhận, trong khi đồng hồ 24 giờ vẫn chạy | Theo 01: cho bàn giao **khách** ngay. Nick chuyển người giữ mới với tag đỏ "Chưa an toàn", nhắc hằng ngày tới Admin + GĐ; Admin/GĐ tick xác nhận sau ở Gán kênh. Nếu BA muốn chặn thì tách thành hai nút "Bàn giao khách" và "Bàn giao nick" | **Chặn** |
| 5 | 8 Kênh kết nối | Không biết nick đang chạy trên **thiết bị nào** (laptop NVKD hay Chrome driver máy chủ), lần gọi cuối, token thiết bị nào. Chỉ ghi "Extension" | Nick đỏ "Cần Tú quét QR" nhưng Zalo Web của nick nằm trên máy nào thì tôi phải đi hỏi. Thiết bị im lặng (R10) cũng không thấy ở đây | Thêm cột hoặc dòng phụ "Thiết bị: Laptop Tú · gọi lần cuối 07:09 · token hết hạn xoay vòng 12/03" và link sang Token & thiết bị | **Nên sửa** |
| 6 | 8 Kênh kết nối, header | Không có cảnh báo chủ động: nick mất kết nối, webhook mất, token sắp hết hạn chỉ thấy khi tự mở trang. Chuông chưa vẽ | Câu hỏi của tôi "nick đăng xuất lúc 2 giờ sáng thì ai biết" vẫn chưa có lời đáp trên bản vẽ. Fanpage VCedu mất webhook 2 ngày | Vẽ chuông + MH-PQ-14. Kênh đỏ quá 15 phút → báo Admin + người giữ nick + GS. Token còn 14/7/1 ngày → báo Admin + GĐ division. Đầu trang Kênh có bộ lọc "Có vấn đề (3)" | **Nên sửa** |
| 7 | 8 Kênh kết nối | Mức đỏ/vàng không nhất quán: "Mất webhook từ 27/09" và "Lệch 912 / 870" của Fanpage VCedu trông như cảnh báo nhẹ, trong khi tóm tắt chỉ có 1 đỏ | Mất webhook là mất tin khách, phải đỏ như nick mất kết nối | Quy tắc: mất kết nối / mất webhook / token hết hạn = đỏ; chậm / lệch số / token ≤ 7 ngày = vàng. Đỏ lên đầu danh sách | **Nên sửa** |
| 8 | 8 Kênh kết nối | Thiếu đường sang gán kênh: cột "Division · nhóm" không bấm được, không có nút "Người dùng kênh" (MH-PQ-06 ghi mở từ /channels) | Đổi người giữ nick là việc tuần nào cũng có | Cho bấm cột Division · nhóm / tên người giữ để mở Gán kênh của kênh đó | **Nên sửa** |
| 9 | 8 Kênh kết nối, tab Đồng bộ | Tab "Đồng bộ (Zalo cá nhân)" chưa có nội dung. "Lệch 37 tin (chi tiết cho Admin)" không mở được đâu | Khi Zalo đổi cấu trúc, tôi phải xem drift và duyệt bảng ánh xạ Claude đề xuất (BA §4.2); nếu không duyệt thì extension ngừng đẩy | Vẽ tab Đồng bộ: theo nick × stream: nguồn / đã lưu / lệch, drift đang mở, bảng ánh xạ "đề xuất" với so sánh cũ → mới và nút Duyệt / Từ chối | **Nên sửa** |
| 10 | 9a bước ③ | Cảnh báo "nick vẫn gửi tin từ điện thoại lúc 10:42 sau khi Đỗ Khoa đã nghỉ" chỉ là dòng chữ | Đây là sự cố đang diễn ra; tôi cần làm gì đó ngay chứ không chỉ đọc | Thêm nút "Báo GĐ và kiểm soát" (tạo cảnh báo R11) và dòng hướng dẫn "Đổi mật khẩu Zalo ngay / liên hệ Khoa". Ghi số tin đã gửi (không nội dung) | **Nên sửa** |
| 11 | 9 Tổ của tôi | Dòng Khoa "Đã khóa · bàn giao chưa xong · Chưa an toàn" tốt. Nhưng không có chỗ nào cho Admin xem **mọi** người nghỉ việc chưa bàn giao xong / nick chưa an toàn trên toàn công ty | Màn 9 là của GS một tổ; tôi quản lý mọi division | Trên MH-PQ-02 thêm bộ lọc "Nghỉ việc – chưa bàn giao xong" và "Nick chưa an toàn", kèm đếm giờ còn lại | **Nên sửa** |
| 12 | 1e Nick của tôi | Nút "Báo Admin" và dòng "Đã báo Admin" không nói tôi nhận ở đâu. Giờ mất kết nối lệch nhau giữa màn 8 (07:10) và 1e (08:40) | NVKD bấm Báo Admin mà tôi không thấy thì họ sẽ gọi điện | Báo Admin = cảnh báo vào MH-PQ-14 + chuông của Admin, hiện "Quân đã nhận lúc …" cho NVKD. Thống nhất mốc thời gian | **Gợi ý** |
| 13 | 8 Kênh kết nối, nút Cấp lại | Không ghi ai cấp token lần trước, cần đăng nhập bằng tài khoản quản trị Page/OA nào, hạn mới sau khi cấp | Cấp lại Page cần người có quyền admin Page trên Facebook; tôi phải biết gọi ai | Rê chuột vào hạn token: "Cấp bởi <người> lúc <ngày> · cần tài khoản quản trị Page". Sau khi cấp: toast "Token mới hết hạn <ngày>" và ghi nhật ký | **Gợi ý** |
| 14 | 9b Trực thay | Duyệt đăng ký vắng của Linh (đề xuất Tú trực 02/10) không cảnh báo Tú đang trực Nick Hà tới 02/10 18:00. Màn 9 ghi Ngân trực Nick Minh tới 18:00, màn 1e ghi Tú trực Minh tới 30/09 | Một người trực 2 nick cùng lúc thì tải tăng gấp đôi; dữ liệu mẫu lệch làm người xem hiểu sai quy tắc | Khi duyệt: "Tú đang trực Nick Hà tới 02/10 18:00, trùng 10 giờ" [Vẫn đồng ý] [Chọn người khác]. Thống nhất dữ liệu mẫu giữa các màn | **Gợi ý** |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-2/P-AD.md) | — |
