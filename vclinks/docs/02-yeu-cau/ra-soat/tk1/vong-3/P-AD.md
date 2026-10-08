# Góp ý thiết kế lượt 3 — P-AD (Quân, admin hệ thống)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Quân (P-AD) góp ý lượt 3 trên canvas bản 11; xem màn 10, 10a–10e, 9a, 8, 1e; đối chiếu 01 v1.2, 00 §2 và góp ý lượt 2.
- Kiểm lại 14 góp ý lượt 2: 12 đã sửa tốt · 2 sửa chưa đủ (đều mức Gợi ý) · 0 chưa sửa; cả 4 Chặn đã sửa đúng đặc tả v1.2.
- Cả 11 màn còn thiếu ở lượt 2 đã được vẽ; chỉ còn thiếu form "+ Thêm người", các tab Vai trò & vị trí / Kênh được gán (10a) và tab Quy tắc cảnh báo (10c).
- Làm thử 6 việc: thấy kênh hỏng 2 cú, tra quyền hiệu lực 4 cú, nghỉ việc đột ngột khoảng 11 cú; khai NVKD mới vẫn phải đoán.
- 5 góp ý mới: **0 Chặn** · 2 Nên sửa (form Thêm người và tab 10a; danh sách chặn nạp lại sau khi xóa NĐ 13) · 3 Gợi ý.
- Còn mở: phiếu Xuất NĐ 13, nút hành động trên dòng cảnh báo, dữ liệu mẫu Laptop Khoa / Chrome driver lệch giữa 8 và 10b.
- Các góp ý còn mở được gom vào `qa.md` (Việc cho designer).

## Mục lục

- [Kiểm lại lượt 2](#kiểm-lại-lượt-2)
- [Làm thử 6 việc](#làm-thử-6-việc)
- [Góp ý mới](#góp-ý-mới)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Bản vẽ: artifact "VClinks UI Design" bản 11 (lượt 3). Màn tôi rà: 10, 10a, 10b, 10c, 10d, 10e (hàng mới "Quản trị của Admin"), 9a Nghỉ việc, 8 Kênh kết nối, 1e Nick mất kết nối / Lệnh gửi. Đối chiếu: 01-phan-quyen.md v1.2, 00-giao-dien-chung.md §2, góp ý lượt 2 của tôi (vong-2-thiet-ke/D1-P-AD.md).

Lần này tôi có hẳn một menu Quản trị 15 mục và đủ các màn mình dùng hằng ngày: người dùng, nhập lô, gán kênh, token & thiết bị, cảnh báo, nhật ký, NĐ 13, cây tổ chức, đồng bộ. Cả 4 lỗi Chặn của lượt 2 đã được sửa đúng đặc tả v1.2. Trang Kênh kết nối giờ có lọc "Có vấn đề", cột thiết bị và màu đỏ/vàng hợp lý. Còn vướng hai chỗ: form "+ Thêm người" chưa vẽ, nên việc khai báo NVKD mới vẫn phải đoán; và phiếu NĐ 13 không cho thấy dữ liệu đã xóa có bị extension nạp lại hay không.

## Kiểm lại lượt 2

| # lượt 2 | Góp ý | Mức cũ | Kết quả | Ghi chú |
|---|---|---|---|---|
| 1 | Chưa có màn quản trị Admin | Chặn | **Đã sửa tốt** | Hàng "D1 · Quản trị của Admin" có 10, 10a–10e. Menu trái theo 00 §2 đủ 15 mục (Kết nối kênh, Đồng bộ, Người dùng, Cây tổ chức, Vai trò & quyền, Gán kênh, Quyền tạm thời, Token & thiết bị, Nhật ký, Cảnh báo, Yêu cầu dữ liệu cá nhân, SLA, Quy tắc chia khách, Thời hạn lưu trữ). Còn thiếu form "+ Thêm người" và các tab Vai trò & vị trí / Kênh được gán của 10a (xem Góp ý mới #1) |
| 2 | Lệnh gửi của người nghỉ + nút Thử lại ở 1e | Chặn | **Đã sửa tốt** | Đặc tả v1.2 (D15, PQ-51) đổi thành "Cần duyệt lại". Bản vẽ khớp: 9a ① ghi "3 lệnh … chuyển Cần duyệt lại; người giữ nick mới bấm Duyệt lại (không có Thử lại)". Ở 1e chỉ còn Mở hội thoại / Bỏ lệnh / Duyệt lại. Tôi đồng ý với cách này: người duyệt mới là người bấm |
| 3 | Bước ① Nghỉ việc chỉ vẽ trạng thái đã xong | Chặn | **Đã sửa tốt** | Có ngày nghỉ, lý do, thu hồi phiên + 2 token MCP, bảng token thiết bị mỗi dòng có radio (Laptop Khoa mặc định Thu hồi ngay; Chrome driver 9333 dùng chung chọn Giữ kèm lý do), "Đơn vị đang làm quản lý", nút Khóa ngay |
| 4 | Nút Bàn giao bị khóa khi chưa thu điện thoại | Chặn | **Đã sửa tốt** | Nút "Bàn giao 96 khách và 1 nick" bấm được. Nick sang Ngân với tag "Chưa an toàn", không ai gửi được cho tới khi xác nhận; "Có thể xác nhận sau ở Gán kênh"; nhắc Admin + GĐ mỗi ngày |
| 5 | Kênh kết nối không có thiết bị | Nên sửa | **Đã sửa tốt** | Cột "Thiết bị / nguồn": Chrome driver 9333 · gọi lần cuối 07:09 |
| 6 | Không có cảnh báo chủ động, chuông | Nên sửa | **Đã sửa tốt** | Chuông có số ở header, 10c MH-PQ-14 có "Kênh đỏ quá 15 phút", "Token sắp hết hạn · báo Admin + GĐ", R11. Trang 8 có lọc "Có vấn đề 5" |
| 7 | Màu đỏ/vàng không nhất quán | Nên sửa | **Đã sửa tốt** | Có dòng quy tắc màu; mất webhook VCedu thành đỏ; nhóm "CÓ VẤN ĐỀ · đỏ lên đầu" |
| 8 | Thiếu đường sang Gán kênh | Nên sửa | **Đã sửa tốt** | Cột "Division · nhóm (mở Gán kênh)" |
| 9 | Tab Đồng bộ trống | Nên sửa | **Đã sửa tốt** | 10e: nick × luồng (IndexedDB / MongoDB / chênh), drift luồng Cảm xúc, bảng ánh xạ v7 → v8 kèm ghi chú Claude, Từ chối / Duyệt v8. Đúng việc "Zalo đổi cấu trúc" của tôi |
| 10 | Cảnh báo "nick vẫn gửi từ điện thoại" không có nút | Nên sửa | **Đã sửa tốt** | Có số tin (2), hướng dẫn "Đổi mật khẩu Zalo ngay hoặc liên hệ Khoa" và nút "Báo GĐ và kiểm soát" |
| 11 | Admin không thấy mọi người nghỉ chưa bàn giao | Nên sửa | **Đã sửa tốt** | 10 có lọc "Nghỉ việc – chưa bàn giao xong 1", "Nick chưa an toàn 1", dòng Khoa "bàn giao còn 21 giờ" |
| 12 | Báo Admin nhận ở đâu, giờ lệch | Gợi ý | **Sửa chưa đủ** | Giờ đã thống nhất 07:10. 10c ghi "người bấm thấy Quân đã nhận lúc …" nhưng còn nhãn "đề xuất – chờ BA", và 1e chưa vẽ dòng "Quân đã nhận" |
| 13 | Token: ai cấp, cần tài khoản nào, hạn mới | Gợi ý | **Sửa chưa đủ** | Có "Cấp bởi Quân 04/07", "cần tài khoản quản trị Page" (VCedu). Chưa có hạn mới sau khi cấp lại, chưa nói tin có mất trong lúc token hết hạn không |
| 14 | Trực thay trùng người, dữ liệu mẫu lệch | Gợi ý | **Đã sửa tốt** | 9b có "Tú đang trực Nick Hà tới 02/10 17:30, trùng 1 ngày"; dữ liệu Ngân trực Minh 13:00–17:30 thống nhất ở 8, 10b, chú giải |

Danh sách "Màn còn thiếu" lượt 2 (11 mục): **đã vẽ cả 11** (menu Admin, PQ-02/03, PQ-15, PQ-06 + Nick chờ xác nhận + "Chưa an toàn", PQ-08 + Ghép thiết bị bằng mã, PQ-14 + chuông, PQ-10, PQ-13, PQ-04 ①, tab Đồng bộ, PQ-01 chế độ sửa). Phần con chưa vẽ: form Thêm người, tab Vai trò & vị trí / Kênh được gán (10a), tab Quy tắc cảnh báo (10c).

**Tổng: 12 đã sửa tốt · 2 sửa chưa đủ (Gợi ý) · 0 chưa sửa. Không còn Chặn cũ.**

## Làm thử 6 việc

| Việc | Màn | Số cú bấm | Vướng |
|---|---|---|---|
| (a) Sáng thấy ngay kênh/nick nào hỏng | Chuông → hoặc Quản trị → Kết nối kênh (8) → "Có vấn đề 5" | **2** (lượt 2: không có đường vào) | Trôi chảy: đỏ lên đầu, có thiết bị, người giữ, nút Báo Tú / Cấp lại / Xác nhận…. Nhỏ: menu ghi "Kết nối kênh", tiêu đề trang ghi "Kênh kết nối" |
| (b) Khai báo NVKD mới vào tổ và gán nick | 10 → + Thêm người → (form) → Lưu → 10b Gán kênh → Nick chờ xác nhận "Xác nhận và gán" → chọn người; máy mới thì "Ghép thiết bị" (mã 6 số, tên, nick, Ghép) | ước **12–15** (lượt 2: không làm được) | Form "+ Thêm người" và tab "Vai trò & vị trí", "Kênh được gán" của 10a **chưa vẽ**, nên tôi không biết chọn đơn vị/vai trò ở đâu, có hỏi "người thứ hai duyệt" (D14) không. Khai 60 người thì 10a nhập lô rất tốt (xem trước Thêm/Đổi/Lỗi/Chờ duyệt, khóa Nhập khi còn lỗi) |
| (c) NVKD nghỉ việc đột ngột | 10 → ⋯ → Nghỉ việc… → ① ngày + lý do (2) → radio thiết bị (0–1) → Khóa ngay → ② Chia đều → ③ người giữ mới (1–2), bỏ tick đăng xuất điện thoại để xác nhận sau → ④ Bàn giao; thêm "Báo GĐ và kiểm soát" nếu nick còn gửi | **~11** | Không vướng. Chờ điện thoại xong tôi vào 10b "Xác nhận đã đăng xuất thiết bị cũ" (+2). Dữ liệu mẫu lệch: 8 ghi "Laptop Khoa (đã thu hồi)" nhưng 10b vẫn liệt kê Laptop Khoa đang dùng, còn nút Thu hồi |
| (d) Vì sao NVKD không thấy khách X | 10 → mở Tú → tab Quyền hiệu lực → gõ tên/SĐT → Kiểm tra | **4** + gõ (lượt 2: không làm được) | Rất tốt: trả lời theo từng quyền "✖ Xem — vì owner Đỗ Mai Linh (HN2)", kèm cách để thấy và nút "Tạo yêu cầu quyền hộ" |
| (e) Token OA/Page sắp hết hạn | Chuông/10c "Token sắp hết hạn" → Xem → 8 → Cấp lại → OAuth → quay về | **3** + đăng nhập Facebook | Dòng cảnh báo 10c chỉ có Xem / Đã xử lý, không có "Cấp lại" ngay. Sau khi cấp lại chưa thấy hạn mới (góp ý cũ #13) |
| (f) Xử lý phiếu NĐ 13 (xóa) | Quản trị → Yêu cầu dữ liệu cá nhân → Chờ xử lý → NĐ13-0014 → (② xác minh, ③ khớp khách do GĐ làm) → ④ gõ lại mã phiếu → Thực hiện xóa → ⑤ gửi biên bản | **5** + gõ mã (phần của Admin) | Luồng 5 bước và tách người xác minh / người thực hiện rõ, Admin không thấy nội dung. Nhưng **không thấy "chặn nạp lại"** (PQ-50, `ingest_tombstones`): sau khi xóa, extension đọc lại IndexedDB của nick và đẩy lên ở lần đồng bộ sau. Chỉ vẽ phiếu Xóa; phiếu Xuất (NĐ13-0013 còn 2 ngày) chưa biết giao file cho khách ra sao |

## Góp ý mới

| # | Màn | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | 10 / 10a | Chưa vẽ form "+ Thêm người" và tab "Vai trò & vị trí", "Kênh được gán" của Chi tiết người dùng | Việc (b) là việc tôi làm hằng tuần; không thấy chỗ chọn đơn vị, vai trò, và hộp "cần người thứ hai duyệt" cho vai trò đọc được chat (D14, PQ-41…43) | Vẽ drawer Thêm người (email @vcprosperous.com, họ tên, vai trò, đơn vị, nick tùy chọn) và tab Vai trò & vị trí có trạng thái "Chờ duyệt – Kiểm soát" khi vai trò nhạy cảm; tab Kênh được gán có "+ Gán nick" dẫn sang 10b | **Nên sửa** |
| 2 | 10d NĐ 13 ④–⑤ | Không hiện danh sách chặn nạp lại sau khi xóa | Extension đồng bộ lại từ IndexedDB: nếu không chặn thì hồ sơ đã xóa quay về và tôi không biết. Tôi phải chứng minh được với khách là đã xóa hẳn | Ở ④ thêm dòng "Chặn nạp lại: 1 SĐT (băm) · 1 hội thoại · 14 tin"; ở ⑤ biên bản ghi số khóa chặn; 10e (Đồng bộ) hiện "Bỏ qua N bản ghi bị chặn theo NĐ13-xxxx" | **Nên sửa** |
| 3 | 10c Cảnh báo | Mỗi dòng chỉ có Xem / Đã xử lý | Cảnh báo token hay kênh đỏ thì việc tiếp theo luôn là một nút ở màn khác, bấm thêm 2–3 lần | Nút hành động theo quy tắc: Token → "Cấp lại"; Kênh đỏ → "Báo người giữ"; R11 → "Mở bàn giao Khoa" | Gợi ý |
| 4 | 8, 10b | Dữ liệu mẫu lệch: Laptop Khoa "đã thu hồi" ở 8 nhưng còn hoạt động ở 10b; Chrome driver 9333 ghi "máy chủ dự án" ở 10b nhưng Nick chờ xác nhận ghi "máy của Tú"; menu "Kết nối kênh" với tiêu đề "Kênh kết nối" | Người xem không biết đâu là trạng thái đúng sau bước ① | Thống nhất: sau khi khóa Khoa, 10b hiện Laptop Khoa ở trạng thái "Đã thu hồi 29/09 (nghỉ việc)"; thống nhất tên máy và tên menu | Gợi ý |
| 5 | 10d | Chỉ vẽ phiếu Xóa, chưa vẽ phiếu Xuất | Phiếu Xuất sắp hết hạn (2 ngày) mà không biết gửi file cho khách qua đâu, có mật khẩu không | Ở ④ của phiếu Xuất: "Tạo file (mã hóa, mật khẩu gửi riêng) · gửi qua kênh khách yêu cầu · hết hạn tải sau 7 ngày" | Gợi ý |

Không có góp ý mới mức Chặn.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-3/P-AD.md) | — |
