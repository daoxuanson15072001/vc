# Nhiệm vụ cho Claude in Chrome: tạo repo GitLab cho dự án TikTok → Text

## Bối cảnh

Dự án `TIKTIKTOTEXT` (công cụ TikTok → Text + VCWIKI của VC Phồn Vinh) đã có repo git trên máy với 2 nhánh:

- `main`: bản đã hoàn thành, dùng để chạy
- `develop`: nhánh phát triển tính năng mới

Code chưa có nơi lưu trên GitLab. Nhiệm vụ của bạn là **tạo một project trống trên GitLab** rồi **báo lại thông tin** theo mẫu ở cuối file. Việc push code sẽ làm ở bước sau, từ máy local, không làm trên trình duyệt.

## Các bước

### 1. Xác định GitLab đang dùng

- Mở tab GitLab mà người dùng đang đăng nhập: có thể là `gitlab.com` hoặc GitLab nội bộ của công ty.
- Nếu chưa đăng nhập ở đâu, hoặc không rõ dùng GitLab nào: **dừng lại và hỏi người dùng**. Không tự đăng ký tài khoản mới.
- Ghi lại tên đăng nhập (username) đang dùng.

### 2. Chọn nơi đặt project (namespace)

- Nếu người dùng có group công ty (ví dụ tên chứa `vc`, `vcprosperous`, `phonvinh`), **hỏi người dùng** muốn đặt project trong group đó hay trong tài khoản cá nhân.
- Nếu không có group nào, đặt trong tài khoản cá nhân.

### 3. Tạo project trống

Vào **New project → Create blank project** và điền:

| Trường | Giá trị |
|---|---|
| Project name | `tiktok-to-text` |
| Project slug | `tiktok-to-text` |
| Visibility | **Private** |
| Initialize repository with a README | **BỎ CHỌN** (bắt buộc: repo phải trống để push lịch sử có sẵn mà không bị xung đột) |
| SAST / các tuỳ chọn khác | Bỏ chọn hết |

Bấm **Create project**.

- Nếu đã có project trùng tên: **không xoá, không ghi đè**. Mở project đó, xem nó có trống không (có trang "The repository for this project is empty" hay không) rồi báo lại.

### 4. Lấy thông tin để push

Trên trang project vừa tạo:

- Bấm nút **Code / Clone** và ghi lại **cả 2 URL**: SSH (`git@…`) và HTTPS (`https://…`).
- Ghi lại link trang project.

### 5. Kiểm tra SSH key (chỉ xem, không sửa)

- Vào **Avatar → Preferences / Edit profile → SSH Keys**.
- Chỉ báo **có hay không có** key, kèm **tiêu đề (title)** và **ngày hết hạn** của từng key nếu có.
- **Không** sao chép nội dung key, không thêm key, không xoá key.

## Giới hạn an toàn

- KHÔNG tạo Personal Access Token / Deploy Token, KHÔNG nhập hay đọc mật khẩu.
- KHÔNG xoá, đổi tên hoặc chuyển bất kỳ project / group nào có sẵn.
- KHÔNG đổi cài đặt tài khoản, group, protected branches hay CI/CD.
- Gặp xác thực 2 lớp, CAPTCHA hoặc màn hình yêu cầu mật khẩu: dừng lại để người dùng tự thao tác.
- Có điều gì chưa rõ: hỏi người dùng, không tự đoán.

## Mẫu kết quả trả về (bắt buộc)

Trả về **đúng khối dưới đây**, điền giá trị thật; mục nào không làm được thì ghi `KHÔNG` kèm lý do ngắn. Người dùng sẽ dán nguyên khối này cho Claude Code để push code.

```text
=== KẾT QUẢ TẠO REPO GITLAB ===
GitLab host:        <vd: gitlab.com hoặc gitlab.congty.vn>
Username:           <username đang đăng nhập>
Namespace:          <cá nhân / tên group>
Project URL:        <https://.../tiktok-to-text>
Clone SSH:          <git@...:.../tiktok-to-text.git>
Clone HTTPS:        <https://.../tiktok-to-text.git>
Visibility:         <Private / Internal / Public>
Repo trống:         <CÓ / KHÔNG — nếu KHÔNG, ghi đang có gì>
Default branch:     <main / chưa có>
SSH key trên GitLab:<CÓ: title1 (hết hạn …), title2 … / KHÔNG>
Ghi chú:            <vấn đề gặp phải, hoặc "không có">
=== HẾT ===
```

## Bước tiếp theo (Claude Code làm, sau khi có kết quả trên)

1. `git remote add origin <Clone SSH>`. Nếu máy chưa có SSH key khớp với GitLab thì dùng `Clone HTTPS`.
2. `git push -u origin main develop`
3. Kiểm tra lại trên GitLab: có đủ 2 nhánh `main` và `develop`, và `main` là nhánh mặc định.
