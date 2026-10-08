# VC Content Engine — quy ước làm việc

- Quy trình bắt buộc: **BA → DESIGN → Code → UAT** (chi tiết `docs/DESIGN.md` Phần 0).
  - Trước khi code: đọc mục BA theo mã yêu cầu (`docs/BA.md`) và mục DESIGN liên quan. Chưa có mục DESIGN thì viết theo mẫu Phần 0 mục 0.6 trong cùng nhánh.
  - Commit nhắc mã BA + mã DESIGN (ví dụ `SCR-03 WK-35: …`). Xong thì đổi nhãn DESIGN sang *Đã làm @commit* và cập nhật trạng thái trong BA, thêm ca UAT.
  - Code lệch DESIGN: sửa DESIGN trước. BA lệch code đang chạy: viết lại BA theo code, phần muốn khác ghi là *Đích* / backlog.
  - Yêu cầu chỉnh sửa: trước khi code, phân loại (sửa lỗi / đổi hành vi / đổi cách làm / code lệch tài liệu) và báo cho người yêu cầu, rồi đi theo DESIGN Phần 0 mục 0.8. Không xoá mục cũ, không tái sử dụng mã; đụng dữ liệu thì phải có cách chuyển dữ liệu và cách quay lui.
  - Nhánh / worktree: đầu phiên chạy `bash ra_nhanh.sh --ngan`, có nhánh «bỏ quên?» thì báo anh. Merge xong xoá worktree + nhánh; trước khi merge kiểm số phiên bản BA / DESIGN trên `develop` (DESIGN 0.8.4).
- Giao diện: dùng token + component + mẫu trang ở DESIGN Phần V; tuân hợp đồng AI agent (AIX) và SEO ở Phần VI.
- Tài liệu, giao diện, commit viết tiếng Việt.
