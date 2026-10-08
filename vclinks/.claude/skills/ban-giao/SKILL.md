---
name: ban-giao
description: Dùng khi chủ dự án nói "bàn giao" hoặc "mở chat mới", hoặc khi hội thoại đã dài/bị nén (CLAUDE.md §15.8). Viết prompt bàn giao để dán sang chat mới.
---

# Bàn giao sang chat mới

Viết **một khối văn bản ≤ 25 dòng** để chủ dự án dán vào chat mới. Không chép lại nội dung tài liệu, chỉ trỏ đường dẫn. Tiếng Việt dễ hiểu.

Khung:

```
Mục tiêu: <1 câu>
Đã xong: <việc> (commit <mã>) ...
Đang dở: <việc, đang ở bước nào, file nào>
Đã chốt trong buổi: <quyết định> ...
Câu hỏi còn mở: Q1 … (đề xuất mặc định: …) ...
Đọc đầu tiên: <đường dẫn>:<dòng đầu>-<dòng cuối> ...
Model nên dùng: Sonnet | Opus (lý do 1 câu)
Việc đầu tiên của chat mới: <1 câu>
```

Cách làm:
- Lấy mã commit bằng `git log --oneline -5`; việc dở bằng `git status -sb`.
- Chỉ ghi quyết định **đã chốt**, không ghi các phương án đã bỏ.
- Dòng "Đọc đầu tiên" phải trỏ tới đoạn cụ thể (số dòng), không trỏ nguyên file dài.
- Kết thúc bằng khối đó; không thêm lời dẫn dài.
