# Kho file và ghi âm thành chữ (M1c-04)

Phiên bản 0.2 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Ảnh, tệp, ghi âm, video trong tin nhắn được **tải về kho công ty** (link Zalo có hạn nên không để nguyên); dòng quản lý nằm ở collection `attachments`, bản chữ ghi âm ở `transcripts`.
- **Kho byte: giữ GridFS (MongoDB), chưa chuyển MinIO.** Lý do ở mục "Quyết định kho". Mọi truy cập byte đi qua một lớp `MediaStore`, nên đổi sang MinIO sau này chỉ sửa một file.
- Ghi âm tự vào hàng đợi chuyển chữ (`asr_jobs`). Worker Python `workers/asr` (faster-whisper, tiếng Việt) lấy việc qua API; chế độ `ASR_MODE=mock` cho test không cần model. Xong thì `messages.text = "[Ghi âm] " + bản chữ`.
- Quyền: file chỉ mở qua API có kiểm phạm vi dữ liệu của tin (cùng luật `conv.view`), link tải ký tên và hết hạn 10 phút, không có đường công khai. Không nới ô nào của `phan-quyen.md` §4. Log không chứa nội dung bản chữ.
- Xóa theo khách (M1b-14): xóa file, bản chữ và byte cùng lúc với hủy khóa.
- Việc còn mở: thử ghi âm thật qua nick test (chủ dự án), máy ASR E8 để dùng model lớn, danh sách máy chủ Zalo CDN thật, quyết định dời MinIO. Người duyệt xem kỹ mục "Quyết định kho" và "Quyền và dữ liệu cá nhân".

## Mục lục

- [Quyết định kho](#quyết-định-kho)
- [Luồng dữ liệu](#luồng-dữ-liệu)
- [create_upload_url và confirm_upload](#create_upload_url-và-confirm_upload)
- [Hàng đợi chuyển chữ và worker](#hàng-đợi-chuyển-chữ-và-worker)
- [Giao diện](#giao-diện)
- [Quyền và dữ liệu cá nhân](#quyền-và-dữ-liệu-cá-nhân)
- [Biến môi trường](#biến-môi-trường)
- [Giới hạn đã biết](#giới-hạn-đã-biết)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## Quyết định kho

| Phương án | Ưu | Nhược |
|---|---|---|
| **Giữ GridFS (chọn)** | Đã chạy (ảnh gửi qua extension, tệp outbox); không thêm dịch vụ nào; mã hóa at-rest theo cách của MongoDB (§12.3) cùng chỗ với dữ liệu khách; xóa theo khách làm trong một nơi; sao lưu chung | Tệp lớn chiếm bộ nhớ database; không có presigned URL gốc |
| Chuyển MinIO | Hợp với tệp lớn, có SSE-KMS tự mã hóa trong `docker-compose.yml` | Thêm dịch vụ chưa chạy ở máy chủ; thêm thư viện S3; phải di chuyển ảnh đã có; phải làm lại xóa theo khách và kiểm quyền |

Chọn GridFS vì ít rủi ro nhất và không làm gãy ảnh đang dùng. "Presigned URL 15 phút" làm bằng chữ ký của API (HMAC), không phụ thuộc kho, nên đổi sang MinIO không đổi giao diện gọi. Giới hạn kích thước một tệp (API đệm trong bộ nhớ): ảnh 20 MB, tệp 50 MB, ghi âm 50 MB, video 64 MB. Dời MinIO khi có tệp lớn hơn hoặc khi hạ tầng có MinIO chạy thật.

## Luồng dữ liệu

1. Extension đẩy nội dung tin (DOM) có `voice.url`, `files[].url`, `video.url`, `images[]`; hoặc ảnh đã tải lên bằng `message-media`.
2. `IngestService` gọi `AttachmentsService.noteMessages` (trước khi mã hóa theo khách): mỗi tệp thành một dòng `attachments` có `_id = ${messageId}#${loại}:${số thứ tự}` (idempotent, ghi lại không sinh trùng). Khách đã bị xóa thì bỏ qua.
3. API tải tệp từ link Zalo **ngay** (nền): chỉ máy chủ trong danh sách cho phép (`ATTACHMENT_FETCH_HOSTS`, mặc định `zdn.vn, zadn.vn, zalo.me, zaloapp.com`), https, tên máy chủ phải trỏ tới địa chỉ công khai (chặn IP nội bộ, kiểm lại ở mỗi lần chuyển hướng), tối đa 3 lần chuyển hướng, có giới hạn kích thước. Link chết (401/403/404/410) thì đánh dấu `expired`; lỗi mạng thử lại tối đa 3 lần (quét lại mỗi 60 giây).
4. Tải xong: byte vào kho (id = sha256, trùng nội dung chỉ lưu một lần), dòng chuyển `stored`, **link Zalo bị xóa khỏi dòng**. File cũ quá hạn link vẫn mở được từ kho.
5. Ghi âm: tạo việc chuyển chữ. Tin nhắn trả về cho Dashboard kèm `attachments[]` (trạng thái, không có byte, không có link).

## create_upload_url và confirm_upload

Dành cho extension / Claude khi có byte trong tay (ví dụ ghi âm đã nghe được). **Nhị phân không đi qua MCP.**

| Bước | Gọi | Kết quả |
|---|---|---|
| 1 | MCP `create_upload_url` hoặc `POST /api/attachments/upload-url` (token ingest/mcp) `{uid, messageId, fileName, mime, size}` | `{uploadId, url, expiresAt}`, hết hạn 15 phút |
| 2 | `PUT <url>` thân nhị phân thô, `Content-Type` không phải JSON (ví dụ `application/octet-stream`); không cần token, chữ ký là thông tin xác thực; dùng một lần; nhiều hơn `size` đã khai báo bị từ chối | `{ok, size}` |
| 3 | MCP `confirm_upload` hoặc `POST /api/attachments/confirm` `{uploadId, checksum}` (sha256 hex) | Khớp: `stored`, ghi âm tự xếp hàng chuyển chữ. Lệch: 400 và dòng chuyển `failed` (xin URL mới) |

## Hàng đợi chuyển chữ và worker

Repo chưa có BullMQ, nên hàng đợi là collection `asr_jobs` (một việc cho mỗi ghi âm, nhận việc bằng khóa thuê 10 phút, thử tối đa 3 lần), theo mẫu worker gợi ý AI chạy trong API. Khi dựng BullMQ thì chuyển nguyên hàm.

| `ASR_MODE` | Hành vi |
|---|---|
| `live` (mặc định) | Việc nằm chờ; worker Python gọi `POST /api/asr/jobs/claim`, `GET /api/asr/jobs/:id/audio`, `POST .../result` hoặc `.../fail` (token scope `ingest`) |
| `mock` | API tự hoàn thành việc với bản chữ cố định ghi rõ là mô phỏng. Chỉ để test và demo, không bật ở máy thật |

Trạng thái hiện trên Dashboard: `queued/running` = "Đang chuyển chữ…", `failed` = nút "Thử lại" (`POST /api/attachments/:id/transcribe`), `done` = bản chữ. Bản chữ rỗng (không nhận ra lời) không đổi nội dung tin. Cách chạy worker: [docs/06-van-hanh/asr-worker.md](../../06-van-hanh/asr-worker.md).

## Giao diện

Bản chữ dưới trình phát; tốc độ 1x / 1.5x / 2x (D36); khi tin đã có bản chữ trong khung phát thì không lặp lại dòng chữ trong bong bóng. Ảnh, tệp, video đã lưu kho mở từ kho ("Mở từ kho công ty"), không dùng link Zalo đã hết hạn.

## Quyền và dữ liệu cá nhân

- `attachments` và `transcripts` nằm trong `CHANNEL_SCOPED` (theo trường `uid`, kèm `threadId` cho quyền mở từng hội thoại): người ngoài phạm vi nhận 404, không phân biệt "không có" với "không được xem".
- `GET /api/attachments/:id/file` (Bearer, quyền `conv.view`) và `GET /api/attachments/:id/link` → link ký tên 10 phút cho `<audio>`/`<video>` (hỗ trợ Range). Link hết hạn hoặc bị sửa: 403. Phản hồi `Cache-Control: private, no-store`, `nosniff`; chỉ ảnh/âm thanh/video mới hiện trực tiếp, loại khác luôn là tải xuống.
- Route công khai duy nhất là hai route có chữ ký (`PUT upload/:token`, `GET dl/:token`), chữ ký mang cả tenant. Khóa ký: `ATTACHMENT_SIGNING_KEY` (hoặc `CREDENTIALS_KEY`); không có khóa thì link chết khi API khởi động lại.
- Xóa theo khách: `POST /api/security/erase` gọi `purgeSubjects`: xóa dòng `attachments`, `asr_jobs`, `transcripts` và byte (trừ khi cùng nội dung còn thuộc dòng khác). Khách đã bị xóa thì không nạp thêm tệp mới và không mở được tệp cũ.
- Log chỉ có id, độ dài, thời gian; không có chữ của bản chữ (worker và API). Bản chữ lưu **dạng rõ** ở `transcripts` (khóa theo khách của M1b-14 chỉ bọc các trường của `messages`; `messages.text` có bản chữ vẫn được mã hóa lại khi `CUSTOMER_ENCRYPTION=1`). Việc bọc `transcripts.text` theo khóa khách là việc nên làm khi bật mã hóa thật (xem câu hỏi mở).
- Không nới ô nào trong 28 ô của `phan-quyen.md` §4: dùng lại `conv.view`.

## Biến môi trường

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `ASR_MODE` | `live` hoặc `mock` | `live` |
| `ATTACHMENT_FETCH_HOSTS` | Máy chủ được phép tải, phân cách bằng dấu phẩy | `zdn.vn,zadn.vn,zalo.me,zaloapp.com` |
| `ATTACHMENT_FETCH_ALLOW_HTTP` | `1` cho phép http (chỉ thử nghiệm) | tắt |
| `ATTACHMENT_FETCH_ALLOW_PRIVATE` | `1` cho phép tải từ IP nội bộ (chỉ thử nghiệm) | tắt |
| `ATTACHMENT_SIGNING_KEY` | Khóa ký link tải / tải lên | `CREDENTIALS_KEY`, nếu không có thì khóa ngẫu nhiên theo tiến trình |
| `ATTACHMENT_SWEEP_MS` | Chu kỳ quét tải lại; `0` tắt | 60000 (0 khi `NODE_ENV=test`) |
| `ATTACHMENTS` | `off` tắt hẳn việc tải về kho | bật |

## Giới hạn đã biết

- Chưa thử với ghi âm thật qua nick test và link Zalo CDN thật: danh sách máy chủ mặc định là suy đoán, cần đối chiếu khi có link thật.
- Tệp đệm trong bộ nhớ API (giới hạn theo loại, ở trên); video lớn hơn 64 MB không lưu (đánh dấu `failed`).
- Hàng đợi chưa phải BullMQ; một worker một lần một việc.
- **M1c-05 đã nối:** sau khi ghi `messages.text`, `AsrService.afterMessageTextChanged` gọi `SearchService.reindex(uid, filter)` (trước khi niêm phong), bản chữ tìm được ngay.
- Bản chữ ghi âm hiện trả nguyên văn như nội dung tin; khi M1b-17 (hàm che SĐT/email chung) gộp, phải che cả bản chữ trong `viewsFor`.
- ⛔ `transcripts.text` lưu rõ: phải bọc khóa khách trước khi bật `CUSTOMER_ENCRYPTION`.
- Token gắn nick chỉ nhận việc chuyển chữ và xác nhận tải lên của nick đó.
- Chưa có tìm kiếm trong bản chữ riêng (M1c-05 tìm trong `messages.text`, đã gồm "[Ghi âm] …").

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 04/10/2026 23:20 | Claude Code · gác cổng M1c-04 | Chặn IP nội bộ khi tải link, nối M1c-05, ghi các việc còn mở (che bản chữ, bọc khóa transcripts) | Gác cổng M1c-04 |
| 0.1 | 04/10/2026 23:02 | Agent Sonnet · M1c-04 | Tạo tài liệu: quyết định kho, luồng, upload URL, hàng đợi ASR, quyền | Phiên M1c-04 |
