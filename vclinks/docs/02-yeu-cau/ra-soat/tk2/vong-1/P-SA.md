# Góp ý thiết kế lô D2 vòng 1 — P-SA (Ngọc)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý vòng 1 cho lô thiết kế TK2 (D2) của vai P-SA (Ngọc, sale admin VCparts); canvas bản 20, đối chiếu đặc tả 02 v1.4.3, 07 MH-BC-08, 01 và D8-02…D8-17.
- Tổng 11 mục: 1 Chặn · 6 Nên sửa · 4 Gợi ý; có bảng làm thử 5 việc.
- Chặn (#1): cặp hồ sơ bị chặn gộp vì hai mã KH khác nhau nằm trong hàng 30 ngày, đã quá hạn, mà sale admin không có nút nào để xử lý cho xong.
- Nên sửa: các thao tác lô (gộp lô, liên kết lô, soát nhật ký) chưa cho xem trước hoặc làm một lần, cùng một số điểm ở Việc VCsales và Dữ liệu khách.
- Đánh giá tốt: gộp có bằng chứng trong dòng, Hoàn tác 30 ngày, Khôi phục hồ sơ đúng `_id`, tách mặc định trả từng mục về nơi xuất phát, đoạn trích ở Việc VCsales.
- Không góp ý ngược D8-03, D8-12, D8-16, D8-17.

## Mục lục

- [Làm thử 5 việc](#làm-thử-5-việc)
- [Góp ý](#góp-ý)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Người góp ý: Ngọc, sale admin VCparts (vai P-SA). Đọc canvas "VClinks UI Design" bản 20: artboard 4 Customers (MH-DK-04, 08), 4a Merge (MH-DK-05, 06, 07), 4c ErpSync (MH-DK-12, 13), 4b OwnerConflict (phần MH-DK-14 Dữ liệu khách), 7a ReportsDetail (MH-BC-08 Chất lượng dữ liệu). Đối chiếu đặc tả 02 v1.4.3, 07 MH-BC-08, 01 và quyết định D8-02…D8-17 (không góp ý ngược D8-03 bấm "Hiện" SĐT, D8-12 tách hồ sơ bị chặn, D8-16 đoạn trích, D8-17).

Việc chị sợ nhất là gộp nhầm rồi không tách lại được, và chỗ đó bản vẽ làm tốt: có bằng chứng ngay trong dòng (`SĐT xuất hiện trong tin [Zalo · Hải VCparts] 29/09 09:10`), có Hoàn tác trong 30 ngày, có Khôi phục hồ sơ cũ đúng `_id`, và bước 3 Tách mặc định trả từng mục về nơi xuất phát, mã KH khóa đi theo account. Hàng Việc VCsales có đoạn trích đúng thông tin cần nhập, không phải đọc chat. Chỗ vướng lớn nhất là cặp hồ sơ bị chặn vì hai mã KH khác nhau: nằm trong hàng 30 ngày, quá hạn, mà chị không có nút nào để xử lý cho xong. Sau đó là các thao tác lô (gộp lô, liên kết lô, soát nhật ký) chưa cho chị xem trước hoặc làm một lần.

## Làm thử 5 việc

Cú bấm tính từ lúc đang ở trang Khách hàng. Gõ phím không tính.

| Việc | Màn | Số cú bấm | Vướng |
|---|---|---|---|
| (a) Duyệt gợi ý "Chị Phạm Thị Mai ↔ Chị Mai" (80, không chặn) | MH-DK-04 → 05 | 4 (tab `Gợi ý gộp hồ sơ` → `▸` xem bằng chứng → `Xem` → `Gộp hồ sơ`). Muốn so SĐT thì +2 (`Hiện` hai bên) | Không vướng. Lý do chính và 3 dòng bằng chứng hiện ngay trong bảng, trả lời được câu "tại sao hệ thống gợi ý hai hồ sơ này là một" |
| (b) Xử lý cặp "Garage Minh Khoa ↔ Garage Minh Khoa 2" (100 điểm, `Chặn: hai mã KH khác nhau`, quá hạn từ 01/09) | MH-DK-04 → 05 | Không làm xong được. `Gộp hồ sơ` khóa, `Từ chối ▾` chỉ có 3 lý do không đúng trường hợp | Góp ý #1 |
| (c) Gộp tách nhầm Garage An Phú / An Khang (gộp 40 ngày trước) | MH-DK-14 → 06 | 6 (tab `Nhật ký hồ sơ` → lọc Ngày → `Khôi phục hồ sơ này` → `Tiếp tục` ×2 → `Khôi phục hồ sơ`) | Không vướng. Bước "Hồ sơ trả về" cho thấy đúng mã KH-TEST-0802, owner Hải, người liên hệ |
| (d) Tạo mã KH cho Phạm Thị Mai (phiếu đủ) rồi gắn mã | MH-DK-12 | 3 (`Xử lý` → `Mở VCsales tạo mã` → quay lại `Gắn mã này`) nếu đồng bộ đã chạy. Nếu chưa, phải chờ | Không nhập tay được mã vừa tạo (góp ý #4); không khóa dòng khi đang làm (góp ý #5) |
| (e) Soát 23 tự gộp sáng nay | MH-DK-14 | 23 cú tích `Đã soát` + mở rộng dòng nào cần xem | Không soát lô được (góp ý #6) |

## Góp ý

| # | Màn | Artboard | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|---|
| 1 | MH-DK-04, MH-DK-05 | 4 Customers, 4a Merge | Cặp `Garage Minh Khoa ↔ Garage Minh Khoa 2` (100 điểm, `Chặn: hai mã KH khác nhau`) nằm ở tab Đang chờ, tuổi `30 ngày`, hạn `01/09 · quá hạn`. Mở so sánh thì `Gộp hồ sơ` khóa với tooltip "Gỡ một liên kết trước khi gộp", còn `Từ chối ▾` chỉ có `Hai người khác nhau` · `Cùng tổ chức, khác người` · `Không đủ căn cứ`. Không có đường nào đúng cho hai trường hợp thật: (1) hai xưởng cùng chủ, hai pháp nhân (account liên quan, DK-55); (2) VCsales tạo trùng mã, cần `Báo trùng trên VCsales` (MH-DK-10 #7). Cùng cặp này lại hiện ở tab `Đã từ chối` với lý do `Không gộp · account liên quan` (không có trong danh sách lý do), và ở SĐT dùng chung đã đánh dấu 31/08 | Đây đúng là việc "một khách một mã" của chị. Nếu chọn `Hai người khác nhau` thì sai sự thật (cùng một anh Khoa) và khóa gộp vĩnh viễn; chọn `Cùng tổ chức, khác người` thì sinh gợi ý "Thêm vào account" sai. Không chọn thì dòng quá hạn mãi, ngày nào nhóm SA cũng bị báo quá hạn (DK-09), số "Gợi ý gộp quá hạn" trên MH-BC-08 không bao giờ về 0 | Với dòng bị chặn cứng do hai mã KH, thay `Gộp hồ sơ` bằng hai nút: `Là account liên quan (cùng chủ)` → đóng gợi ý, ghi hai account liên quan, đánh dấu SĐT "Trong account … (account liên quan: …)"; `Báo trùng trên VCsales` → mở chọn mã chính như MH-DK-10 #7, tạo việc `merge_codes` ở MH-DK-12, gợi ý chuyển "Chờ VCsales gộp mã", không tính hạn. Thêm lý do "Account liên quan (cùng chủ)" vào `Từ chối ▾` để khớp tab Đã từ chối. Thiếu trong đặc tả MH-DK-04/05 | **Chặn** |
| 2 | MH-DK-04, MH-DK-13 | 4 Customers, 4c ErpSync | Hộp xác nhận lô chỉ có một câu: `Gộp 3 cặp hồ sơ theo giá trị mặc định?`, `Liên kết 12 khách với mã KH đã gợi ý?`. Không liệt kê cặp nào, hồ sơ nào được giữ, khách nào nhận mã nào | Chị hay hỏi "làm lô được không", nhưng làm lô mà không nhìn lại danh sách thì chính là cách gộp nhầm. Liên kết nhầm mã KH là 360 hiện sai công nợ của người khác cho sale | Trong modal liệt kê gọn từng dòng: `[giữ] Phạm Thị Mai ← Chị Mai (Zalo·Hải) · 80`, `Garage Minh Khoa → KH-TEST-0301 · 95 · khớp SĐT V2`, cho bỏ tích từng dòng ngay trong modal. Trên 10 dòng thì cuộn | **Nên sửa** |
| 3 | MH-DK-05 | 4a Merge (#9 góc nhìn Ngọc) | Khi hai phía khác owner, ô `Owner sau gộp` của chị bị khóa với tooltip `[Chỉ GS (cùng tổ) / GĐ (khác tổ) chọn được]`, nhưng bản vẽ không cho biết nút `Gộp hồ sơ` lúc đó bật hay tắt, bấm thì gộp ngay với owner nào, hay chờ giám sát chọn | DK-09 nói SA duyệt gộp, giám sát chọn owner, nhưng thứ tự hai bước chưa có. Chị không biết bấm xong khách đang thuộc ai, sale nào nhận tin | Vẽ rõ: nút đổi chữ thành `Gộp và nhờ [Hương] chọn owner`; sau gộp hồ sơ tạm giữ owner mặc định theo #9, dòng nhật ký MH-DK-14 ghi "Chờ GS chọn owner", giám sát nhận việc. Thiếu trong đặc tả (thứ tự gộp / chọn owner) | **Nên sửa** |
| 4 | MH-DK-12 | 4c ErpSync | Tab `Chờ tạo mã KH`: sau `Mở VCsales tạo mã`, dòng chỉ rời hàng khi đồng bộ định kỳ ra gợi ý `Gắn mã này`. Không có ô nhập mã chị vừa tạo | Chị tạo mã xong là biết mã ngay. Chờ đồng bộ (bản vẽ không ghi bao lâu) thì dòng vẫn nằm đó, chị phải nhớ quay lại, sale vẫn thấy "chưa có mã" và gửi báo giá cho khách chưa mã | Thêm nút `Đã tạo mã: [nhập mã KH]` trong Drawer, kiểm tra mã trên VCsales rồi liên kết như MH-DK-10 "Xác nhận"; ghi rõ chu kỳ đồng bộ dưới gợi ý. Thiếu trong đặc tả | **Nên sửa** |
| 5 | MH-DK-12 | 4c ErpSync | Hàng Việc VCsales không có `Nhận xử lý` như MH-DK-04 #13, chỉ có checkbox `Của tôi` | Division có 2 SA (Hạnh). Hai người cùng bấm `Mở VCsales tạo mã` cho một khách là ra hai mã trùng, đúng thứ chị đang phải dọn | Thêm `Nhận xử lý` khóa dòng 15 phút, người kia thấy "Ngọc đang xử lý", giống MH-DK-04. Thiếu trong đặc tả | **Nên sửa** |
| 6 | MH-DK-14 | 4b OwnerConflict | `Đã soát` chỉ tích từng dòng; bộ đếm ghi "23 tự gộp · 7 gắn tay" mỗi ngày | 30 cú tích mỗi sáng chỉ để đánh dấu những dòng chị đã lướt qua. Thường chị chỉ mở vài dòng nghi ngờ, còn lại soát theo quy tắc | Thêm chọn nhiều + `Đánh dấu đã soát các dòng đang lọc ([n])`, có hỏi xác nhận; lọc `Chưa soát` + Quy tắc để soát theo từng quy tắc. Thiếu trong đặc tả | **Nên sửa** |
| 7 | MH-DK-12 | 4c ErpSync (#4 tab Cần cập nhật) | Dòng việc ghi `Đổi SĐT 0900***501 → 0900***502`, số mới bị ẩn, không có `Hiện` hay nút chép cạnh số mới; chỉ có `Xem đoạn trích`. Bảng tab này vẽ trong khung hẹp, nút `Đã cập nhật trên VC…` bị cắt, cột Khách xuống 4 dòng | Việc này chị phải gõ đủ số mới vào VCsales. Phải mở đoạn trích rồi dò số trong câu chat thì dễ gõ sai một số | Cạnh số mới đặt `Hiện` (60 giây, ghi `phone.reveal` như D8-03) và `Sao chép`; vẽ tab "Cần cập nhật" ở khổ 1440 như tab đầu | **Nên sửa** |
| 8 | MH-BC-08 | 7a ReportsDetail | Tab Chất lượng dữ liệu có 3 thẻ và "Việc cần làm" cho gắn tay, đối chiếu mã, gợi ý gộp quá hạn, nhưng không có số việc VCsales đang chờ (Chờ tạo mã, Cần cập nhật, Chờ sale bổ sung) và số account "Owner VClinks ≠ NV phụ trách VCsales" (con số này chỉ có ở MH-BC-04 của giám đốc) | Chị là người phải làm hết các việc đó. Giám đốc thấy số lệch NV phụ trách trước chị thì chị bị hỏi mà không có số của mình | Thêm vào "Việc cần làm": `Chờ tạo mã KH [n] (quá 1 ngày [m]) → Việc VCsales`, `Owner ≠ NV phụ trách VCsales [n] → lọc #4a`. Thiếu trong đặc tả | Gợi ý |
| 9 | MH-DK-14 | 4b OwnerConflict (tab SĐT dùng chung) | Tab ghi `SĐT dùng chung (4)` nhưng có 5 dòng; `0900 *** 900` xuất hiện hai lần (Ngọc đánh dấu 29/09 và `Tự động: ≥ 2 mã KH`) | Nhìn hai dòng cùng số chị sẽ nghĩ có hai lần đánh dấu, rồi bỏ đánh dấu nhầm một dòng | Một số một dòng; cột "Ai đánh dấu" ghi cả hai nguồn (`Ngọc 29/09 · Tự động: ≥ 2 mã KH`). Nếu đây chỉ là biến thể UAT-DK-44 thì tách ra khỏi bảng chính | Gợi ý |
| 10 | MH-DK-06 | 4a Merge (bước 2, chế độ khôi phục) | Chọn `Khôi phục hồ sơ cũ Garage An Khang` mà ô `Tên người liên hệ mới`, `Vai trò` vẫn hiện (mờ, "Chỉ khi tạo mới") | Làm chị tưởng phải điền gì đó cho hồ sơ khôi phục | Ẩn hai ô này khi chọn khôi phục hoặc hồ sơ có sẵn | Gợi ý |
| 11 | MH-DK-04 | 4 Customers | Góc nhìn Ngọc (SA) nhưng thanh trên hiện người đăng nhập `Nguyễn Văn Minh`; bộ lọc thêm có nhãn chữ `[bộ lọc thứ ba]` | Dễ nhầm đây là màn của NVKD khi đem đi UAT | Đổi thanh trên thành Ngô Bích Ngọc; đặt tên bộ lọc theo đặc tả #11 (Nguồn, Chiến dịch, …) | Gợi ý |

**Tổng:** 1 Chặn · 6 Nên sửa · 4 Gợi ý.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 04/10/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk2/vong-1/P-SA.md) | — |
