# Tìm kiếm tin nhắn

Phiên bản 0.2 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Một API tìm tin nhắn `GET /api/search/messages` (MH-SZ-14, KD-15, BA I2, I4): từ khóa không dấu, nhiều từ (đủ mọi từ, thứ tự bất kỳ), cụm trong ngoặc kép, và tra theo **SĐT, mã OE, biển số** gõ kiểu nào cũng ra (`0900 123 456`, `0900.123.456`, `+84 900 123 456`; `04465-0D130`; `30A-123.45`). Bản chữ ghi âm nằm sẵn trong `messages.text` ("[Ghi âm] …") nên được tìm như tin thường.
- **Quyền (§12):** đọc qua collection có phạm vi của người dùng (M1b-04), nên không bao giờ trả tin ngoài phạm vi; khóa quyền dùng lại `search.global` (không nới ô nào trong 28 ô của `phan-quyen.md` §4). Có test hai user TD.
- **SĐT (NĐ 13):** kết quả che theo `phoneOn` (`0900 *** 456`); người không có quyền xem đủ SĐT chỉ tra được khi gõ **đủ số** (từ 9 chữ số), để không dò từng chữ số bằng tiền tố. Điểm che SĐT trong nội dung tin là hàm `maskContentForViewer` (`apps/api/src/search/search.service.ts`), tạm che SĐT, chờ thay bằng hàm chung của M1b-17.
- **Nhật ký:** chỉ ghi `search.code` (loại mã, số kết quả) khi tra mã/SĐT; **không ghi câu tìm**.
- **Tốc độ:** trên 100.000 tin (test e2e) mỗi câu 7 đến 21 ms (yêu cầu ≤ 2 giây). Chưa đo trên database thật vì chưa có trên máy này.
- Nhảy tới tin: `/conversations/{id}?msg={msgId}`; API `GET /api/conversations/:id/messages?around=` trả cửa sổ quanh tin (30 tin mới hơn, tin đó, tối đa `limit` tin cũ hơn); Dashboard cuộn tới và tô sáng, có nút "Về tin mới nhất".
- **Việc còn mở:** khi bật mã hóa theo khách (`CUSTOMER_ENCRYPTION=1`) văn bản bị niêm phong nên **không tìm được** (khóa tìm kiếm bị xóa); M1c-04 phải gọi `SearchService.reindex()` khi ghi bản chữ vào tin cũ; tìm theo đuôi SĐT (4 số cuối) chưa hỗ trợ. Người duyệt xem kỹ mục Quyền và SĐT.

## Mục lục

- [Cách tìm](#cách-tìm)
- [Chỉ mục](#chỉ-mục)
- [Quyền và SĐT](#quyền-và-sđt)
- [Nhảy tới tin](#nhảy-tới-tin)
- [Giới hạn đã biết](#giới-hạn-đã-biết)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## Cách tìm

`GET /api/search/messages?q=&uid=&threadId=&from=&to=&page=&limit=` (`limit` ≤ 50, mặc định 20). `uid` có thể là nhiều nick cách nhau dấu phẩy; có `uid` + `threadId` là "tìm trong hội thoại" (M1c-08 gắn vào panel). Dưới 2 ký tự trả 400 "Nhập ít nhất 2 ký tự để tìm.".

| Gõ | Hiểu là |
|---|---|
| `ma phanh vios` | Tin chứa đủ ba từ, không phân biệt dấu, hoa thường, thứ tự bất kỳ. Từ từ 3 ký tự trở lên khớp theo tiền tố ("phan" ra "phanh") |
| `"má phanh"` | Đúng cụm, liền nhau |
| `0900123456`, `0900 123 456`, `+84900123456` | SĐT: cùng một mã gọn, khớp mọi cách viết trong tin |
| `04465-0D130`, `044650d130` | Mã OE |
| `30A-123.45`, `30a12345`, `30A 123 45` | Biển số |

Phản hồi: `items[]` (`conversationId`, `msgId`, `title`, nick, `sentAt`, `snippet` đã che, `marks` = đoạn tô đậm, `voice`), `hasMore`, `tookMs`, `codeKind` (tag gợi ý loại mã), `note`. Mỗi trang mới nhất trước.

## Chỉ mục

- Trường `messages.searchKeys`: các từ không dấu và các mã đã gọn; chỉ mục `{ searchKeys: 1, sentAt: -1 }`. Không dùng chỉ mục `text` của Mongo vì nó không khớp `đ`, tiền tố, dấu phân cách (đã thử).
- Giữ cho khớp với `text`: `IngestService` gọi `SearchService.reindex()` ngay sau khi ghi (3 chỗ); tiến trình quét mỗi 60 giây (`SEARCH_SWEEP_MS`, 0 = tắt) ghi khóa cho tin chưa có, nên dữ liệu cũ tự được lập chỉ mục sau khi nâng cấp.
- **Mỗi kết quả được đối chiếu lại với nội dung hiện tại** của tin: tin đã ẩn danh hoặc sửa mà khóa cũ còn sót thì không hiện (test).

## Quyền và SĐT

- Phạm vi do lớp dữ liệu áp (`CHANNEL_SCOPED`), không phải do code tìm kiếm: người giữ nick A tìm không ra tin nick B dù chỉ định `uid` của B.
- Che SĐT trong đoạn trích: người giữ nick thấy đủ, người khác thấy `0900 *** 456`.
- Tra SĐT ngắn hơn 9 chữ số chỉ chạy trên nick mà người hỏi được xem đủ SĐT; kèm `note` chung (không nói số kết quả bị ẩn).
- Người không được xem đủ SĐT được đối chiếu trên **nội dung đã che** (`matchesForViewer`): một phần số hay email, dù gõ kèm chữ, trong ngoặc kép hay có dấu chấm, đều không ra kết quả. SĐT đủ số (9–12 chữ số) vẫn tìm được nhưng phải khớp nguyên số, không khớp tiền tố. Email trong đoạn trích cũng che (`ga***@example.vn`).
- Xóa / ẩn danh theo khách (M1b-14) và niêm phong khi bật mã hóa xóa luôn `searchKeys`; khi đang bật mã hóa, tiến trình quét gỡ khóa cũ còn sót.

## Nhảy tới tin

Bấm kết quả mở `/conversations/{id}?msg={msgId}`. `ChatPane` gọi `messages?around=` thay cho trang mới nhất, cuộn tin ra giữa và tô sáng 2,4 giây. Nếu còn tin mới hơn ngoài cửa sổ, thanh thông báo có nút "Về tin mới nhất" (bỏ `?msg=`, quay lại trang mới nhất).

## Giới hạn đã biết

- Mỗi câu duyệt tối đa 3.000 ứng viên mới nhất rồi mới lọc; câu quá chung chung có thể không đủ trang xa.
- Khóa mã chỉ có tiền tố, không có hậu tố (4 số cuối SĐT).
- Mã hóa theo khách bật thì không tìm được (xem Tóm tắt).
- Ctrl+K giữ nguyên hai nguồn (khách, liên hệ); thêm dòng "Tìm trong tin nhắn" (hoặc Ctrl+Enter) mở `/search?q=`.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 04/10/2026 23:05 | Claude Code · gác cổng M1c-05 | Chặn dò SĐT/email bằng câu trộn chữ hoặc ngoặc kép (đối chiếu trên nội dung đã che), che email trong đoạn trích, xóa khóa tìm khi ẩn danh / niêm phong | Gác cổng M1c-05, CLAUDE.md §12, NĐ 13 |
| 0.1 | 04/10/2026 22:57 | Agent Sonnet · M1c-05 | Tài liệu mới | Phiên M1c-05 |
