# Sổ xử lý góp ý thiết kế D2 vòng 1 — nhóm KH (khách đa kênh)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Sổ xử lý của BA cho góp ý thiết kế TK2 (D2) vòng 1, nhóm KH (khách đa kênh), bước 6 chu trình, ngày 30/09/2026; phạm vi MH-DK-04…08, 11…14 và các artboard Customers, Merge, OwnerConflict, ErpSync.
- Nguồn góp ý: P-SA, P-GS, P-GD, P-KD (P-CS, P-MK, P-KT không có mục thuộc phạm vi).
- 15 mục (1 Chặn, 9 Nên sửa, 5 Gợi ý): 14 Đã sửa, 1 chuyển nhóm khác (P-SA #8); mục Chặn P-SA #1 đã sửa theo phương án BA đề xuất.
- Đặc tả đã sửa: `02-khach-da-kenh.md` v1.4.4 và `du-lieu-kiem-thu.md` v1.4.2; phần BA tự đề xuất gắn nhãn "chờ chủ dự án xác nhận".
- Canvas không đổi khung cắt; đo bằng Playwright sau khi sửa, không có chỗ bị cắt.
- Việc chuyển nhóm khác: Báo cáo 07 (MH-BC-08) và Phân quyền 01.
- Còn mở tại thời điểm lập: 3 câu hỏi chủ dự án KH-Q1…Q3 (cặp bị chặn vì hai mã KH, gộp khi khác owner, chu kỳ đồng bộ VCsales); BA đề xuất phương án A cả ba.

## Mục lục

- [1. Bảng xử lý](#1-bảng-xử-lý)
- [2. Việc chuyển nhóm khác](#2-việc-chuyển-nhóm-khác)
- [3. Câu hỏi cho chủ dự án](#3-câu-hỏi-cho-chủ-dự-án)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Bước 6 chu trình (`specs/README.md`), 30/09/2026. Phạm vi: màn MH-DK-04…08, 11…14; artboard 4 Customers, 4a Merge (+ MergeP2), 4b OwnerConflict, 4c ErpSync. Nguồn góp ý: `P-SA.md`, `P-GS.md`, `P-GD.md`, `P-KD.md` (P-CS, P-MK, P-KT không có mục nào thuộc các màn này). Không làm ngược D8-02…D8-17.
>
> Đặc tả đã sửa: `specs/02-khach-da-kenh.md` **v1.4.4** (chỗ sửa ghi **[v1.4.4·R1]**, dòng Lịch sử v1.4.4) · `specs/du-lieu-kiem-thu.md` **v1.4.2** (ghi **[v1.4.2·R1]**). Phần BA tự đề xuất ghi "(BA đề xuất, chờ chủ dự án xác nhận)" trong đặc tả và nhãn `R1 · BA đề xuất` trên canvas.
> Canvas: không đổi khung cắt, `$preview`, `canvas.json`. Đo bằng Playwright sau khi sửa (chiều cao nội dung / khung): Customers 5161 / 5180 · Merge + MergeP2 9031 / 9080, đường cắt 7300 vẫn nằm giữa hai section (khối cuối "Chuyển người liên hệ" kết thúc 7299, section "Gắn tay" bắt đầu 7309) · OwnerConflict 5670 / 5690 · ErpSync 4552 / 4560. Không có chỗ bị cắt. Merge và MergeP2 giống hệt nhau trừ tiêu đề, khung cắt, `$preview`. Kiểm cân bằng thẻ (html.parser), không emoji, mọi `<button>` có `type="button"`.

## 1. Bảng xử lý

| Mã góp ý | Mức | Kết quả | File đã sửa |
|---|---|---|---|
| P-SA #1 | **Chặn** | **Đã sửa** (BA đề xuất, chờ xác nhận: KH-Q1). Cặp bị chặn vì hai mã KH có hai đường đóng ở MH-DK-05: `Là account liên quan (cùng chủ)` (ghi account liên quan DK-55, đánh dấu SĐT "Dùng chung trong account", gợi ý đóng lý do "Không gộp · account liên quan", không gợi ý lại) và `Báo trùng trên VCsales` (chọn mã chính như MH-DK-10 #7, tạo việc `merge_codes` ở MH-DK-12, gợi ý sang "Chờ VCsales gộp mã", **không tính hạn**, mở lại khi đồng bộ thấy mã đã gộp). `Gộp hồ sơ` vẫn khóa + tooltip (D8-02: thiếu điều kiện tạm thời), tooltip thêm câu chỉ đường. Không thêm lý do vào `Từ chối ▾` như người góp ý đề xuất: đã có nút riêng, tab "Đã từ chối" nhận đúng lý do từ nút đó. Thêm UAT-DK-89, 90; TD biến thể `k04=bao-trung` | 02 §4.6, §4.7 bước 7, MH-DK-04 #1 #11 #12, MH-DK-05 (hành động, trạng thái), §11.6, §12 câu 16 · TD TD-GY1, tham số seed · Customers (lọc "Chờ VCsales gộp mã", dòng mẫu, nhãn tab Đã từ chối) · Merge/MergeP2 (hai nút + tooltip ở màn thật, hộp "Là account liên quan", hộp "Báo trùng", hai thông báo, trạng thái "Chờ VCsales gộp mã", banner "đã xử lý" ghi lý do) |
| P-SA #2 | Nên sửa | **Đã sửa** (BA đề xuất). Hộp xác nhận lô liệt kê từng dòng có ô chọn, bỏ tích thì không làm dòng đó, quá 10 dòng thì cuộn | 02 MH-DK-04 "Gộp các mục đã chọn", MH-DK-13 "Xác nhận các dòng đã chọn" · Customers · ErpSync |
| P-SA #3 | Nên sửa | **Đã sửa** (BA đề xuất, chờ xác nhận: KH-Q2). §4.6 chốt thứ tự: một phía có mã KH / đã mua → SA gộp ngay theo #9 (1), không tạo xung đột (giữ UAT-DK-35); còn lại → nút `Gộp và nhờ [GS/GĐ] chọn owner`, owner tạm theo #9, mục "Gộp hai owner" ở MH-DK-11 hạn 1 ngày làm việc, quá hạn thì owner tạm thành chính thức. Góc nhìn SA ở #9 là chỉ đọc, bỏ tooltip | 02 §4.6, MH-DK-05 #9 + hành động, MH-DK-11 #2 · Merge/MergeP2 (#9 góc nhìn Ngọc) |
| P-SA #4 | Nên sửa | **Đã sửa** (BA đề xuất). Ô `Đã tạo mã KH` + `Kiểm tra và gắn` trong Drawer, tra mã trên VCsales rồi liên kết ngay, không chờ đồng bộ; dưới gợi ý ghi "Đồng bộ VCsales lần cuối [HH:mm]". Chu kỳ đồng bộ chưa có tham số → KH-Q3. UAT-DK-93 | 02 MH-DK-12 #9, hành động · ErpSync |
| P-SA #5 | Nên sửa | **Đã sửa** (BA đề xuất). `Nhận xử lý` khóa dòng 15 phút như MH-DK-04 #13; `Mở VCsales tạo mã` tự nhận; SA khác thấy "Ngọc đang xử lý" | 02 MH-DK-12 #8, hành động · ErpSync (bảng chính, góc nhìn Hạnh) |
| P-SA #6 | Nên sửa | **Đã sửa** (BA đề xuất). Soát lô: chọn nhiều + `Đánh dấu đã soát các dòng đang lọc ([n])`, hỏi xác nhận nêu bộ lọc. Canvas vẽ nút ở hàng lọc và hộp xác nhận; không vẽ thêm cột chọn nhiều trong bảng. UAT-DK-94 | 02 MH-DK-14 #4a, hành động · OwnerConflict |
| P-SA #7 | Nên sửa | **Đã sửa** (BA đề xuất phần "Sao chép"). Số mới có `Hiện` (60 giây, `phone.reveal`, D8-03) và `Sao chép` (cũng ghi `phone.reveal`); tab "Cần cập nhật" vẽ khổ đầy đủ, nút không còn bị cắt; khối #4a dời xuống cạnh "Không tạo mã" / "Thông báo" | 02 MH-DK-12 #10 · ErpSync |
| P-SA #8 | Gợi ý | **Chuyển nhóm khác** (nhóm báo cáo 07, MH-BC-08 / 7a ReportsDetail): thêm "Chờ tạo mã KH", "Owner ≠ NV phụ trách VCsales" vào "Việc cần làm". Kèm việc mới từ nhóm KH: số "Gợi ý gộp quá hạn" không tính gợi ý "Chờ VCsales gộp mã" (02 §4.6 v1.4.4) | – |
| P-SA #9 | Gợi ý | **Đã sửa** (rẻ, nhất quán dữ liệu). Một SĐT một dòng; cột "Ai đánh dấu" ghi đủ nguồn; biến thể UAT-DK-44 ghi chú ngay trên dòng; số trên tab = số dòng (4) | 02 MH-DK-14 #5 · OwnerConflict |
| P-SA #10 | Gợi ý | **Đã sửa** (rẻ). Chọn "Khôi phục hồ sơ cũ" / "Hồ sơ có sẵn" thì ẩn "Tên người liên hệ mới", "Vai trò", thay bằng dòng "Tên, vai trò giữ theo hồ sơ [tên]." | 02 MH-DK-06 #5 · Merge/MergeP2 |
| P-SA #11 | Gợi ý | **Đã sửa** (rẻ). Thanh trên MH-DK-04 (và MH-DK-05) là Ngô Bích Ngọc; bỏ "[bộ lọc thứ ba]": đặc tả #11 ghi `Select` ×3 nhưng chỉ nêu Nguồn, Chiến dịch → sửa thành ×2 | 02 MH-DK-04 #11 · Customers · Merge/MergeP2 |
| P-GS #3 | Nên sửa | **Đã sửa** (BA đề xuất). Góc nhìn Hương: "Tổ" khóa ở Tổ HN1, dòng xung đột trong tổ có `Xử lý` (Drawer như bản của Thắng), mục khác tổ chỉ xem. Bộ TD chưa có xung đột trong tổ → thêm **TD-XD1** (Anh Kiên, owner Linh, nhắn nick Minh 3 lần; Linh bấm "Tạo xung đột owner"; seed `xd=trong-to`, không nạp ở nhóm ca 07). UAT-DK-92 | 02 MH-DK-11 #2, §11.6 · TD §1.1, §4.2, §4.3a, §6.3, seed · OwnerConflict |
| P-GS #9 | Nên sửa | **Đã sửa** (BA đề xuất). #2b "Tôi đã gửi": GS tổ đích thấy yêu cầu chuyển khách mình gửi, bước hiện tại, `Xem` mở Drawer #2a chỉ đọc | 02 MH-DK-11 Ai dùng, #2b, hành động, Quyền · OwnerConflict |
| P-GD #8 | Nên sửa | **Đã sửa** (BA đề xuất). Drawer #2a "Chuyển khách về tổ" có khối "Số liệu" và "Dòng thời gian 7 ngày" như Drawer #4 (số chưa có trong TD để `[..]`; dòng thời gian có TD-H26 khách bỏ quan tâm OA) | 02 MH-DK-11 #2a · OwnerConflict |
| P-KD #3 | Nên sửa | **Đã sửa** (BA đề xuất). Màn thật MH-DK-08 đăng nhập đúng Trần Thùy Linh; tìm theo SĐT, mã KH, MST, VIN, biển số thì **không áp** "Chỉ khách của tôi" (có dòng báo dưới ô tìm); tìm theo tên mà rỗng khi đang bật lọc → "Không có trong khách của bạn." + `Tìm trong tất cả khách` đứng trước `Tạo khách hàng mới`. UAT-DK-91 | 02 MH-DK-08 #3, hành động "Tạo khách hàng mới", trạng thái · Customers |

**Tổng trong phạm vi:** 1 Chặn (đã sửa) · 10 Nên sửa (đã sửa 10) · 4 Gợi ý (đã sửa 3, chuyển nhóm khác 1).

Các mục còn lại của P-GS, P-GD, P-KD thuộc màn ngoài MH-DK-04…08, 11…14 (báo cáo 07, marketing 05, OA 04, hóa đơn 06, sale Zalo 03, tìm kiếm 00): nhóm khác xử lý.

## 2. Việc chuyển nhóm khác

| Nhóm / file | Việc | Nguồn |
|---|---|---|
| Báo cáo (07 MH-BC-08, 7a ReportsDetail) | P-SA #8: thêm "Chờ tạo mã KH [n] (quá 1 ngày [m]) → Việc VCsales" và "Owner ≠ NV phụ trách VCsales [n] → lọc MH-DK-12 #4a" vào "Việc cần làm" của sale admin. Số "Gợi ý gộp quá hạn" không đếm gợi ý "Chờ VCsales gộp mã" | P-SA #8; 02 §4.6 v1.4.4 |
| Phân quyền (01) | Ghi nhận thao tác mới của SA ở 02 v1.4.4: `related_account` (Là account liên quan), tạo việc `merge_codes` từ MH-DK-05; `phone.reveal` có thêm hành động "copy" (MH-DK-12 #10); GS tổ đích xem (chỉ đọc) mục `team_transfer` mình gửi (MH-DK-11 #2b); GS / GĐ không bao giờ có hai nút mới ở MH-DK-05 → ẩn (D8-02) | P-SA #1, #7; P-GS #9 |

## 3. Câu hỏi cho chủ dự án

Tới khi chốt, đặc tả chạy theo phương án BA đề xuất (đã ghi và vẽ, gắn nhãn "chờ chủ dự án xác nhận").

**KH-Q1 — Cặp gợi ý gộp bị chặn vì hai mã KH khác nhau xử lý thế nào?** (P-SA #1, Chặn; TD-GY1 Garage Minh Khoa ↔ Garage Minh Khoa 2)
- **A.** Hai nút riêng ở MH-DK-05: "Là account liên quan (cùng chủ)" (đóng gợi ý, ghi account liên quan, đánh dấu SĐT dùng chung trong account) và "Báo trùng trên VCsales" (tạo việc gộp mã, gợi ý chờ VCsales, không tính hạn, mở lại khi VCsales đã gộp mã).
- **B.** Chỉ thêm lý do "Account liên quan (cùng chủ)" vào "Từ chối ▾"; báo trùng mã làm riêng ở MH-DK-10 / MH-DK-13, gợi ý vẫn tính hạn tới khi SA gỡ một liên kết.
- **BA đề xuất: A.** Sale admin đóng được việc ngay tại chỗ, không có dòng quá hạn mãi; dùng lại các chức năng đã có (DK-55, MH-DK-10 #7, MH-DK-12), không thêm quy tắc mới.

**KH-Q2 — Hai phía khác owner: sale admin gộp trước hay chờ giám sát / giám đốc chọn owner?** (P-SA #3)
- **A.** SA gộp ngay; một phía có mã KH / đã mua thì owner theo quy tắc #9 (1), không tạo xung đột (như UAT-DK-35); trường hợp còn lại dùng owner tạm theo #9, GS (cùng tổ) / GĐ (khác tổ) chọn owner ở MH-DK-11 mục "Gộp hai owner" trong 1 ngày làm việc, quá hạn thì owner tạm thành chính thức.
- **B.** Chưa gộp tới khi GS / GĐ chọn owner; gợi ý ở trạng thái "Chờ chọn owner" (không tính hạn của SA).
- **BA đề xuất: A.** Khách không bị treo hai hồ sơ trong lúc chờ; ai nhận tin luôn rõ (owner tạm); quyền chọn owner vẫn đúng DK-09.

**KH-Q3 — Chu kỳ đồng bộ VCsales (mã KH mới, NV phụ trách) là bao lâu?** (P-SA #4; MH-DK-12 #6, #9)
- **A.** Không cam kết chu kỳ trên giao diện: chỉ hiện "Đồng bộ VCsales lần cuối [HH:mm]"; sale admin nhập mã vừa tạo ở "Đã tạo mã KH" để gắn ngay.
- **B.** Cam kết một chu kỳ cố định (thêm tham số TS mới) và ghi trên giao diện "Đồng bộ mỗi [n] phút"; con số cần đội VCsales cho biết giới hạn API.
- **BA đề xuất: A** cho MVP (không cần con số chưa đo); chuyển sang B khi có số đo API VCsales.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 04/10/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk2/vong-1/xu-ly-KH.md) | — |
