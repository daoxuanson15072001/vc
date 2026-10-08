# Chạy worker chuyển ghi âm thành chữ (ASR)

Phiên bản 0.1 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Worker `workers/asr` đọc ghi âm trong kho công ty và trả bản chữ tiếng Việt (faster-whisper). Mặc định model `small` chạy được trên CPU máy ứng dụng; khi có máy ASR (E8) đổi `ASR_MODEL=large-v3`.
- Đã thử thật một ghi âm tự tạo 9,7 giây (giọng máy, không phải khách): model `small` trên CPU xử lý trong 3,0 giây sau khi tải model (lần đầu tải khoảng 28 giây); bản chữ đúng ý, sai một tên xe.
- Chạy bằng Docker (`--profile asr`) hoặc trực tiếp bằng Python. Cần một token quyền `ingest`.
- Không có ghi âm thật của khách trong lúc thử; thử qua nick test chờ chủ dự án.
- Người duyệt xem kỹ mục "Cách chạy" (token) và "Xử lý sự cố".

## Mục lục

- [Cách chạy](#cách-chạy)
- [Cài đặt model](#cài-đặt-model)
- [Kiểm tra nhanh](#kiểm-tra-nhanh)
- [Xử lý sự cố](#xử-lý-sự-cố)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## Cách chạy

1. API: đặt `ASR_MODE=live` (mặc định). `mock` chỉ để thử, không dùng khi chạy thật.
2. Tạo token cho worker: `pnpm --filter @vclinks/api token:create --name "ASR worker" --scopes ingest`, đặt vào `ASR_API_TOKEN` trong `.env`.
3. Docker: `docker compose --profile asr up -d asr` (model tải lần đầu vào volume `vclinks_asr-models`, không nằm trong image).
4. Hoặc trực tiếp: `python3 -m venv .venv && .venv/bin/pip install -r workers/asr/requirements.txt`, rồi `ASR_API_URL=http://localhost:3000 ASR_API_TOKEN=... .venv/bin/python workers/asr/worker.py` (thêm `--once` để làm hết việc rồi dừng).

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `ASR_API_URL` | Địa chỉ API | `http://localhost:3000` |
| `ASR_API_TOKEN` | Token quyền `ingest` | bắt buộc |
| `ASR_MODEL` | tiny, base, small, medium, large-v3 | `small` |
| `ASR_DEVICE` / `ASR_COMPUTE` | cpu/cuda, int8/float16 | cpu / int8 |
| `ASR_POLL_SEC` | Chu kỳ hỏi việc khi rảnh | 3 |

## Cài đặt model

Model tải từ Hugging Face lần chạy đầu (small khoảng 460 MB, large-v3 khoảng 3 GB). CI không tải model (`pnpm ci:local` chỉ chạy test không cần model; `ASR_MODE=mock` và `ASR_BACKEND=stub`). Cần ffmpeg không bắt buộc (PyAV có sẵn bộ giải mã).

## Kiểm tra nhanh

- Test vòng lặp worker, không cần model: `cd workers/asr && python3 -m unittest test_worker`.
- Thử thật: tạo tiếng nói bằng lệnh `say -v Linh -o a.aiff "..."` rồi đổi sang m4a bằng ffmpeg, đưa vào một tin thử qua `create_upload_url` / `confirm_upload` ([kho-file-va-ghi-am.md](../04-ky-thuat/api/kho-file-va-ghi-am.md)), chạy worker với `--once`.

## Xử lý sự cố

| Dấu hiệu | Cách xử |
|---|---|
| Dashboard mãi "Đang chuyển chữ…" | Worker chưa chạy hoặc sai token; `docker compose logs asr`. Việc bị bỏ dở tự về hàng đợi sau 10 phút |
| "Chưa chuyển được thành chữ" | Đã thất bại 3 lần; bấm "Thử lại" (log worker ghi tên loại lỗi, không ghi nội dung) |
| `TypeError ... metadata_errors` | Sai bản PyAV; dùng `av>=14,<16` như `requirements.txt` |
| Chạy chậm | Dùng model nhỏ hơn (`base`) hoặc đợi máy ASR (E8) |

Log của worker và API chỉ có mã việc, độ dài, thời gian; không bao giờ có chữ của bản chữ (dữ liệu cá nhân, §12).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 04/10/2026 23:02 | Agent Sonnet · M1c-04 | Tạo tài liệu cách chạy worker ASR, thử thật 1 ghi âm tự tạo | Phiên M1c-04 |
