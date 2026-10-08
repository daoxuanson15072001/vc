# Bộ test phần mềm cho Claude in Chrome

Bộ prompt để giao cho **Claude in Chrome** kiểm thử thủ công VC Content Engine / VCWIKI. Mỗi lần chạy một gói, mỗi gói gồm nhiều ca có bước bấm cụ thể và kết quả mong đợi.

## 1. Cách dùng nhanh (4 bước)

1. **Bật môi trường test** (tách hẳn khỏi bản thật):
   ```bash
   bash start_uat.sh
   ```
   - BE chạy cổng 8400, FE ở **http://127.0.0.1:5400**, database `tiktok_to_text_uat`.
   - Mặc định **không có AI**.
   - Lần đầu tự dựng dữ liệu mẫu.
   - Không đụng DB thật, không build lại FE của bản :8000.
2. **Dựng lại dữ liệu trước mỗi gói**, để các gói không ảnh hưởng nhau. Chạy trong terminal khác, không cần tắt server:
   ```bash
   bash start_uat.sh --seed-only
   ```
3. Mở file **`bo-test.html`** (thư mục này) bằng Chrome → bấm **Copy prompt** ở gói cần chạy → mở Claude in Chrome trên tab `http://127.0.0.1:5400` → dán.
   - Prompt đã ghép sẵn *PHẦN CHUNG* (môi trường, tài khoản, quy tắc, mẫu báo cáo) và *gói test*.
   - Không mở được HTML thì copy `_chung.md` + file gói.
4. Claude in Chrome trả **báo cáo theo mẫu**. Dán báo cáo đó cho Claude Code ("sửa các lỗi trong báo cáo P01") hoặc gửi qua kênh yêu cầu phát triển.

> Dùng **127.0.0.1**, không dùng `localhost`, để đăng nhập ở bản test không đè phiên của bản thật ở `localhost:8000`.

## 2. Thứ tự chạy: lõi / phức tạp trước, đơn giản sau

| Gói | Nội dung | Số ca | Thời gian | Ghi chú |
|---|---|---|---|---|
| **P01** | Duyệt tri thức 2 bước: đề xuất, bốn mắt, người duyệt ngoài kho, cần cập nhật, quay về bản cũ, lỗi thời | 18 | 60–90' | Lõi nhất |
| **P02** | Phân quyền theo kho, bảo mật: 404 thay vì lộ dữ liệu, admin không đọc kho người khác, điểm thi không lộ | 14 | 45–60' | Lỗi ở đây là nghiêm trọng |
| **P03** | Học tập: lộ trình, giao bài trong cây, luyện tập, thi có giờ / tự nộp, chấm tự luận, phản hồi, khung năm | 18 | 75–100' | Có 2 lần chờ hết giờ thi |
| **P04** | Soạn bài học, ngân hàng câu hỏi, ghim phiên bản thẻ, thiết kế lộ trình (không AI) | 12 | 60–75' | |
| **P05** | Cơ cấu tổ chức: đơn vị, hồ sơ, nhập Excel, vai trò, uỷ quyền, nghỉ việc | 12 | 50–70' | Cần người chọn file CSV |
| **P06** | VCWIKI: tạo thẻ, phân loại, tìm / lọc, sao chép, lịch sử, bình luận, danh sách phát, bản đồ | 8 | 40–50' | |
| **P07** | Kho tư liệu: nạp link / file, chi tiết nguồn, kho video, kênh, xuất Excel | 9 | 40–50' | Cần người chọn file |
| **P08** | Đăng nhập, đổi mật khẩu, quản trị người dùng, cây lĩnh vực, token Kết nối AI | 9 | 35–45' | |
| **P09** | Tính năng phụ: Xưởng chiến dịch (không AI), Người đứng tên, Tiến độ tinh chế, điều hướng, màn hẹp | 8 | 30–40' | Không cần dựng lại dữ liệu |
| **P10** | Các bước AI thật: dựng thẻ, cổng so sánh, sinh câu hỏi, thiết kế lộ trình, chấm AI, chat | 9 | 45–60' | `bash start_uat.sh --ai --reset`, **tốn phí API** |

Gói dài (P01, P03) có thể tách: dán prompt rồi dặn thêm "chỉ chạy các ca D01–D09", lần sau "chạy D10–D18". Ca sau dùng dữ liệu của ca trước, nên **không** dựng lại dữ liệu giữa hai nửa.

## 3. Dữ liệu mẫu có sẵn

`backend/scripts/seed_uat.py` dựng, chi tiết xem `_chung.md`:
- **13 tài khoản** theo vai trò, mật khẩu chung `Test@12345`: quản trị, TGĐ, GĐ, trưởng phòng, key staff, nhân viên, thực tập sinh, L&D, kiểm toán, người ngoài.
- Cây tổ chức 2 division, cây quản lý nhiều tầng.
- Cây lĩnh vực v2 đủ 4 tầng; chủ nhánh "Kỹ thuật ô tô" là GĐ Garage.
- 3 kho (riêng tư / riêng tư khác division / công khai) với đủ 3 mức quyền.
- 12 thẻ VCWIKI: đã duyệt đủ các bậc, 1 thẻ có 2 phiên bản, 2 thẻ nháp.
- 6 câu hỏi, 2 bài học, 1 lộ trình đã giao, 4 video mẫu.

File dùng khi test (thư mục `data/`): `to-chuc-hop-le.csv`, `to-chuc-co-loi.csv` (P05), `tai-lieu-ac-quy.pdf`, `anh-1.png`, `anh-2.png` (P07, P10).

## 4. Giới hạn của Claude in Chrome cần biết

- **Không tự chọn file** trên máy: đến bước tải file, nó sẽ dừng và nhờ anh chọn.
- **Hộp thoại xác nhận / nhập chữ** nay là khung trong trang có nút mang tên hành động, Claude in Chrome tự bấm được. Chỗ nào còn hộp thoại của trình duyệt, nó sẽ ghi vào báo cáo.
- **File tải về** (Excel, SRT, zip): nó chỉ biết đã bấm tải. Nội dung file cần anh mở kiểm.
- Trình duyệt chỉ giữ **một phiên đăng nhập**, nên mỗi lần đổi vai trò phải đăng xuất / đăng nhập. Các gói đã ghi rõ tài khoản từng bước.
- Toast hiện 8 giây (lỗi 12 giây) và xem lại được ở nút 🔔 Thông báo.

## 5. Bảo trì bộ test

- Sửa nội dung gói: sửa `P*.md` hoặc `_chung.md`, rồi chạy `python3 docs/test-claude-extension/build_html.py` để sinh lại `bo-test.html`.
- Thêm gói mới: tạo `P11-ten-goi.md` theo mẫu các gói có sẵn (đầu file: `# P11 — Tên`, dòng `> Ưu tiên …`), rồi build lại.
- Đổi dữ liệu mẫu: sửa `backend/scripts/seed_uat.py`, và cập nhật bảng tài khoản / thẻ trong `_chung.md` cho khớp.
- Tính năng đổi luật (BA đổi): cập nhật mục "Luật nghiệp vụ cần biết" và "Mong đợi" của gói liên quan. Ca mong đợi sai sẽ làm Claude in Chrome báo lỗi giả.
