# Tài liệu VClinks — thư mục `docs/`

Phiên bản 0.3 · 04/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- `docs/` sắp xếp theo **vòng đời phần mềm** (ISO/IEC/IEEE 12207, 15289): 7 thư mục đánh số, đọc từ quản lý dự án → yêu cầu → thiết kế → kỹ thuật → kiểm thử → vận hành → demo. Chủ dự án duyệt ngày 04/10/2026.
- Mỗi thư mục có `README.md` là file quản lý: danh sách file, tóm tắt 1 dòng, phiên bản, trạng thái, ghi chú (CLAUDE.md §13).
- **Quy chuẩn này bắt buộc cho tài liệu mới** (CLAUDE.md §13): đặt file vào đúng thư mục theo bảng dưới; không tạo file `.md` nằm thẳng trong `docs/` ngoài file này.
- Các điểm tài liệu lệch code được ghi ở cột Ghi chú của README từng thư mục; chủ dự án quyết **không sửa tài liệu theo code** (04/10/2026).
- Tiến độ hồi tố tài liệu md: [01-quan-ly-du-an/hoi-to-tai-lieu-md.md](01-quan-ly-du-an/hoi-to-tai-lieu-md.md).

## Mục lục

- [Quy chuẩn thư mục](#quy-chuẩn-thư-mục)
- [Cây thư mục hiện tại](#cây-thư-mục-hiện-tại)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## Quy chuẩn thư mục

| Thư mục | Loại hồ sơ | Đặt vào đây | Chuẩn tham chiếu | File quản lý |
|---|---|---|---|---|
| [01-quan-ly-du-an/](01-quan-ly-du-an/) | Quản lý dự án | Kế hoạch, lộ trình, chi phí, sổ quyết định chủ dự án, biên bản họp, rủi ro, tiến độ | ISO/IEC/IEEE 15289 (kế hoạch, hồ sơ quyết định) | [README](01-quan-ly-du-an/README.md) |
| [02-yeu-cau/](02-yeu-cau/) | Yêu cầu | BA tổng, đặc tả chức năng `dac-ta/`, personas, hồ sơ rà soát yêu cầu `ra-soat/` | IEEE 29148 | [README](02-yeu-cau/README.md) |
| [03-thiet-ke/](03-thiet-ke/) | Thiết kế | Thiết kế giao diện (link canvas), kiến trúc, quyết định kỹ thuật | ISO/IEC/IEEE 15289 (mô tả thiết kế) | [README](03-thiet-ke/README.md) |
| [04-ky-thuat/](04-ky-thuat/) | Tài liệu kỹ thuật | API `api/`, kết nối kênh `kenh/`, khảo sát nền tảng ngoài (`zalo-web/`…) | ISO/IEC/IEEE 26514 (tài liệu cho người dùng kỹ thuật) | [README](04-ky-thuat/README.md) |
| [05-kiem-thu/](05-kiem-thu/) | Kiểm thử | Dữ liệu kiểm thử, kế hoạch kiểm thử, biên bản UAT `uat/<yyyy-mm-dd>/` | ISO/IEC/IEEE 29119-3 | [README](05-kiem-thu/README.md) |
| [06-van-hanh/](06-van-hanh/) | Vận hành | Cài đặt, triển khai, chạy, sao lưu, xử lý sự cố | ISO/IEC/IEEE 15289 (hướng dẫn vận hành) | [README](06-van-hanh/README.md) |
| [07-demo/](07-demo/) | Demo, đào tạo | Kịch bản và nguồn dựng demo, video, tài liệu đào tạo | — | [README](07-demo/README.md) |

**Quy tắc đặt tên:** thư mục và file viết thường, tiếng Việt không dấu, nối bằng `-`; thư mục cấp 1 có số thứ tự `NN-`; hồ sơ theo đợt dùng ngày `yyyy-mm-dd`. File nhị phân lớn (video) không đưa vào git.

## Cây thư mục hiện tại

```
docs/
├─ README.md                         file này
├─ 01-quan-ly-du-an/                 kế hoạch M1, chi phí, sổ quyết định, hồi tố md
├─ 02-yeu-cau/                       BA tổng, personas
│  ├─ dac-ta/                        đặc tả 00…07
│  └─ ra-soat/                       hồ sơ rà soát (dac-ta-vong-1, tk1, tk2…)
├─ 03-thiet-ke/                      link artifact thiết kế
├─ 04-ky-thuat/
│  ├─ api/                           REST, MCP, MCP dev
│  ├─ kenh/                          Zalo OA, Fanpage, Facebook cá nhân
│  └─ zalo-web/                      khảo sát IndexedDB, selector DOM, bản đồ tính năng
├─ 05-kiem-thu/                      dữ liệu kiểm thử
│  └─ uat/2026-09-29/                biên bản UAT Zalo cá nhân
├─ 06-van-hanh/                      Chrome driver
└─ 07-demo/
   ├─ 03-sale-zalo/                  mô phỏng luồng sale Zalo
   └─ video/                         video demo 3:18
```

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.3 | 04/10/2026 13:33 | Claude Code | Sắp xếp lại `docs/` thành 7 thư mục theo vòng đời; file này thành quy chuẩn thư mục + cây thư mục; danh sách từng file chuyển xuống README của từng thư mục; bỏ mục Mô hình (sơ đồ cấu trúc cũ đã sai) | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:33 |
| 0.2 | 04/10/2026 | Claude Code | Cập nhật sau khi hồi tố `ba/`, `ke-hoach/`, `artifacts.md`; ghi quyết định không sửa tài liệu theo code | Chủ dự án 04/10/2026 |
| 0.1 | 04/10/2026 | Claude Code | Tạo file quản lý thư mục `docs/` | CLAUDE.md §13 |
