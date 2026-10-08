# Nhiệm vụ cho Claude in Chrome: tạo token GitLab để push code qua HTTPS

## Bối cảnh

Project `https://gitlab.com/vcwiki/tiktok-to-text` đã được tạo và đang trống. Máy local cần push 2 nhánh `main` và `develop` lên đó qua HTTPS. GitLab **không nhận mật khẩu tài khoản** khi push qua HTTPS, nên cần một **Personal Access Token (PAT)**.

Người dùng (`buithoanh`) **đã đồng ý** cho bạn tạo token này. Chỉ được tạo **đúng 1 token** với các thông số ghi bên dưới.

## Các bước

### 1. Mở trang tạo token

- Đăng nhập gitlab.com bằng tài khoản `buithoanh`. Nếu sai tài khoản hoặc chưa đăng nhập: dừng lại và hỏi người dùng.
- Vào **Avatar → Edit profile → Access tokens** (hoặc mở thẳng `https://gitlab.com/-/user_settings/personal_access_tokens`).
- Bấm **Add new token**.

### 2. Điền thông số

| Trường | Giá trị |
|---|---|
| Token name | `tiktok-to-text-push-mac` |
| Description (nếu có) | `Push code TIKTIKTOTEXT từ máy Mac` |
| Expiration date | **30 ngày** kể từ hôm nay |
| Scopes | **Chỉ chọn `write_repository`** (đã bao gồm quyền đọc repo) |

- **Không** chọn `api`, `read_api`, `sudo`, `admin_mode` hay bất kỳ scope nào khác.
- Nếu GitLab đòi nhập mật khẩu hoặc mã xác thực 2 lớp: dừng lại để người dùng tự nhập.

Bấm **Create token**.

### 3. Bàn giao token: người dùng tự copy

GitLab chỉ hiện token **một lần duy nhất**, ngay sau khi tạo.

- **Để nguyên màn hình** đang hiện token. Không tải lại trang, không chuyển trang.
- Nhắc người dùng bấm nút copy cạnh token để tự lấy.
- **KHÔNG** đọc, chép, gõ lại hay đưa chuỗi token vào câu trả lời, vào ghi chú hay vào bất kỳ ô nhập nào khác. Token là thông tin bí mật và chỉ người dùng được giữ.

## Giới hạn an toàn

- Chỉ tạo 1 token như trên. Không sửa và không thu hồi các token có sẵn.
- Không đổi cài đặt tài khoản, group, project hay SSH key.
- Gặp điều gì không đúng như mô tả: dừng lại và hỏi người dùng.

## Mẫu kết quả trả về (bắt buộc, KHÔNG chứa token)

```text
=== KẾT QUẢ TẠO TOKEN GITLAB ===
Tài khoản:          <username>
Token name:         <tên token>
Scopes:             <danh sách scope đã chọn>
Hết hạn:            <dd/mm/yyyy>
Token đang hiện:    <CÓ, đang chờ người dùng copy / KHÔNG — lý do>
Ghi chú:            <vấn đề gặp phải, hoặc "không có">
=== HẾT ===
```

## Bước tiếp theo (người dùng tự làm trong terminal)

```bash
cd /Users/apple/TIKTIKTOTEXT && git push -u origin main develop
```

- `Username for 'https://gitlab.com'`: gõ `buithoanh`
- `Password for 'https://buithoanh@gitlab.com'`: **dán token** (khi dán, màn hình không hiện ký tự nào; cứ thế bấm Enter)

Sau đó dán kết quả của lệnh push cho Claude Code để kiểm tra 2 nhánh trên GitLab.

> Lưu ý: máy đang dùng `credential.helper = store`, nên token sẽ được lưu dạng chữ thường trong `~/.git-credentials`. Khi token hết hạn sau 30 ngày, cần tạo token mới theo đúng các bước trên.
