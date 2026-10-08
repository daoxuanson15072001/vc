# VC Home — Hợp đồng tích hợp cho app

Phiên bản 0.3 · 08/10/2026 · Trạng thái: Đã chốt nội dung (chờ đội phát triển rà)

## Tóm tắt

- **Tài liệu nói gì:** những gì mọi app (VClinks, VCwiki, VCsale, VCgarage, VC AI…) phải làm để nối với VC Home: đọc token đăng nhập, nhận đăng xuất phía máy chủ, gọi API VC Home bằng token máy, nhận sự kiện có chữ ký, và các bước đưa một app vào. Kèm hướng dẫn riêng cho VClinks và VCwiki.
- **Nguyên tắc:** VC Home cấp **vai trò thô**, app giữ **quyền chi tiết** và phạm vi dữ liệu. Không có vai trò thì app **từ chối** (VH-BR-20). App **không sửa** hồ sơ (VH-BR-03).
- **Ba kênh bổ trợ nhau:**
  - **Token** lúc đăng nhập: GĐ A có định danh và nhóm; GĐ B thêm mã nhân viên và đơn vị; GĐ C thêm vai trò app, kể cả đơn vị của từng vai trò (`vh_roles`).
  - **Sự kiện** khi có thay đổi: 9 loại ở README mục 10, ký HMAC, gửi ít nhất một lần, có số thứ tự theo từng người.
  - **API** VH-API-01…09 khi cần dữ liệu đầy đủ hoặc đối chiếu.
- **VClinks:** 10 vai trò app trùng đúng 10 khoá vai trò đang có trong code (`ROLE_KEYS`, `ROLE_MATRIX`). Cây tổ chức và người dùng nhận từ VC People thay cho nhập tay (M1b-03). Nghỉ việc, chuyển tổ mở bàn giao (M1b-11), không tự chuyển khách. Chuyển tiếp 3 ngày.
- **VCwiki:** phân hệ ORG thành bên đọc; `admin` / `member` thành `quan_tri`, `thanh_vien`, thêm `bien_tap`. Vai trò theo lĩnh vực, kho, mức mật vẫn ở VCwiki. Chia sẻ kho theo đơn vị (SYS-35) dùng mã đơn vị VC People.
- **Token máy, MCP, thiết bị của từng app giữ nguyên.**
- **Đã xử lý ngày 08/10/2026:** có sự kiện tạm khoá, mở khoá (`vh.person.locked`, `unlocked`), báo trước nghỉ việc hoặc chuyển vị trí (`vh.person.change_scheduled`), sự kiện thử (`vh.test.ping`) và VH-API-10; Q-14 đã chốt (giữ nhóm mặc định 30 ngày sau R3). Việc còn lại: thử mapper `vh_roles` ở SSO-00.
- **Người duyệt xem kỹ:**
  - mục 2.3 (vai trò trong token) và 2.6 (danh sách kiểm token);
  - mục 6.3–6.5 (chữ ký, gửi lại, thứ tự sự kiện);
  - mục 8.2, 8.3 (ánh xạ đơn vị và vai trò VClinks; chủ VClinks duyệt);
  - mục 9.2, 9.3 (VCwiki; chủ VCwiki duyệt).

## Mục lục

- [1. Nguyên tắc](#1-nguyên-tắc)
- [2. Token đăng nhập và claim](#2-token-đăng-nhập-và-claim)
- [3. Đăng xuất phía máy chủ](#3-đăng-xuất-phía-máy-chủ)
- [4. Token máy cho app gọi API](#4-token-máy-cho-app-gọi-api)
- [5. API cho app](#5-api-cho-app)
- [6. Sự kiện gửi app](#6-sự-kiện-gửi-app)
- [7. Các bước đưa một app vào](#7-các-bước-đưa-một-app-vào)
- [8. Hướng dẫn riêng VClinks](#8-hướng-dẫn-riêng-vclinks)
- [9. Hướng dẫn riêng VCwiki](#9-hướng-dẫn-riêng-vcwiki)
- [10. Ghi chú cho VCsale, VCgarage, VC AI](#10-ghi-chú-cho-vcsale-vcgarage-vc-ai)
- [11. Đề xuất bổ sung (chưa cấp mã)](#11-đề-xuất-bổ-sung-chưa-cấp-mã)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Nguyên tắc

| # | Nguyên tắc | Nghĩa với app |
|---|---|---|
| 1 | **VC Home cấp vai trò thô, app giữ quyền chi tiết** (VH-BR-08, Q-05) | VC Home chỉ nói "người này là NVKD trong VClinks tại Tổ HN1". Khách nào, kênh nào, thẻ nào, mức mật nào là việc của app |
| 2 | **Mặc định chặn** (VH-BR-20, VH-NFR-02) | Từ GĐ C: token không có vai trò app của mình thì từ chối (`app_not_granted`). Vai trò lạ (chưa ánh xạ) thì bỏ qua, ghi log, không suy diễn. App không tự cấp vai trò. Trong thời gian chuyển tiếp làm theo Q-14 |
| 3 | **App không sửa hồ sơ** (VH-BR-03) | Hồ sơ, vị trí, quản lý, cơ cấu chỉ đọc. Màn nhập cây tổ chức, nhập nhân sự của app phải khoá hoặc chỉ đọc khi đã nối. Dữ liệu nghiệp vụ riêng (khách của ai, kho nào, lĩnh vực nào) app vẫn giữ |
| 4 | **Khoá người dùng theo `sub`** (VH-BR-01) | `sub` là khoá kỹ thuật, `employee_code` là khoá nghiệp vụ. Email đổi được, không dùng email làm khoá |
| 5 | **Ba kênh bổ trợ nhau** | Token chỉ đúng lúc đăng nhập. Sự kiện báo thay đổi giữa các lần đăng nhập. API để lấy đầy đủ và đối chiếu hằng đêm. Không kênh nào một mình đủ |
| 6 | **Tối thiểu dữ liệu** (VH-BR-19) | App chỉ nhận mức dữ liệu được duyệt (`C0` hoặc `C1`, [05](05-du-lieu.md) mục 3.7). Không chép thêm; tự áp thời hạn lưu khi người nghỉ |
| 7 | **Giờ** (VH-BR-22) | Thời điểm trong token, API, sự kiện là UTC dạng ISO 8601 có `Z` (token dùng số giây Unix). Ngày lịch là `YYYY-MM-DD` theo giờ Việt Nam. App hiển thị theo `Asia/Ho_Chi_Minh` |
| 8 | **Tương thích về sau** | App bỏ qua trường lạ, loại sự kiện lạ. VC Home không đổi nghĩa trường đã công bố; thay đổi phá vỡ thì ra `/api/v2` hoặc `spec_version` mới, báo trước ít nhất 30 ngày |
| 9 | **Không tin đường truyền** | Mọi thứ app nhận đều kiểm chữ ký: token qua JWKS, sự kiện qua HMAC. Chỉ HTTPS |

---

## 2. Token đăng nhập và claim

### 2.1 Luồng và nơi lấy claim

- App là "app khách" OpenID Connect (OIDC) của VC ID: luồng Authorization Code kèm PKCE S256, đổi `code` ở server ([thiết kế SSO](ky-thuat/thiet-ke-sso-keycloak.md) mục 5.2).
- **JWT** là chuỗi token gồm ba phần (đầu, nội dung, chữ ký). Mỗi trường trong phần nội dung gọi là **claim**.
- App đọc claim từ **`id_token`** đúng một lần lúc đăng nhập, rồi tạo phiên riêng của app. App **không lưu** `id_token`, access token, refresh token.
- Vai trò có thể đổi sau khi đăng nhập: app cập nhật theo sự kiện (mục 2.7), không chờ lần đăng nhập sau.

### 2.2 Claim theo giai đoạn

| Claim | GĐ | Kiểu | Ví dụ | Nguồn | Ghi chú |
|---|---|---|---|---|---|
| `iss` | A | string | `https://id.vcprosperous.com/realms/vc` | VC ID | So khớp tuyệt đối |
| `aud`, `azp` | A | string / mảng | `vclinks` | VC ID | `aud` phải chứa `client_id` của app |
| `sub` | A | string | `6f1c2b7e-…` | VC ID | UUID, không đổi; khoá người dùng |
| `exp`, `iat`, `auth_time` | A | số giây Unix | `1795223820` | VC ID | |
| `nonce` | A | string | | App gửi | Chỉ có trong `id_token` |
| `sid` | A | string | `b2a9…` | VC ID | Mã phiên chung; dùng cho đăng xuất phía máy chủ |
| `email`, `email_verified` | A | string, bool | `hoa.nt@vcpart.vn`, `true` | Google | |
| `name`, `given_name`, `family_name` | A | string | `Nguyễn Thị Hoa` | GĐ A: Google. Từ GĐ B: VC People | Xem mục 11 về cấu hình đồng bộ tên |
| `picture` | A | string | URL ảnh | Google (hoặc ảnh HC-NS đặt, từ GĐ B) | |
| `hd` | A | string | `vcpart.vn` | Google | Domain Workspace |
| `groups` | A | mảng | `["app-vclinks","app-vcwiki"]` | VC ID | GĐ A, B: nhóm mặc định. Từ GĐ C: có nhóm `app-<khoá>` khi có ít nhất một quyền hiệu lực trong app đó (sau thời gian chuyển tiếp Q-14) |
| `employee_code` | B | string | `VCP0123` | VC People | Không có nghĩa là tài khoản chưa gắn hồ sơ |
| `vh_profile` | B | object | xem 2.4 | VC People | Chỉ C0 và mã đơn vị (VH-NFR-07): `unit`, `unit_name`, `division`, `legal_entity`, `title`, `title_name`, `function` của **vị trí chính** |
| `resource_access.<app>.roles` | C | mảng | `["nvkd","cskh"]` | VC Home → VC ID | Chuẩn của Keycloak: vai trò của client. Mỗi app chỉ thấy vai trò của chính mình |
| `vh_roles.<app>` | C | mảng object | `[{"role":"nvkd","unit":"VCP-TBH1"}]` | VC Home → VC ID | Vai trò kèm đơn vị (VH-BR-24). Mỗi app chỉ thấy phần của mình |
| `vh_roles_overflow` | C | bool | `true` | VC ID | Chỉ có khi `vh_roles` quá lớn bị bỏ ra (mục 2.5) |

Cách VC ID có các claim GĐ B, C:
- `vc-provisioner` ghi thuộc tính người dùng trên Keycloak từ VC Home (`employee_code`, `vh_profile`, `vh_roles_<app>`) chậm nhất 5 phút sau khi thay đổi có hiệu lực (VH-NFR-13). Đối chiếu lại hằng đêm (VH-NFR-18).
- Keycloak bản 24 trở lên bắt khai thuộc tính người dùng: các thuộc tính trên khai là **chỉ quản trị sửa**, người dùng không thấy, không sửa.
- `vc-basic` (scope dùng chung) thêm mapper cho `employee_code`, `vh_profile`. Mỗi client có một mapper riêng đọc `vh_roles_<khoá app>` ra claim `vh_roles.<khoá app>` kiểu JSON.
- Mapper "client roles" và mapper `vh_roles` phải bật **"thêm vào ID token"**; mặc định Keycloak chỉ đưa vai trò client vào access token.

### 2.3 Vai trò trong token: `resource_access` và `vh_roles`

| | `resource_access.<app>.roles` | `vh_roles.<app>` |
|---|---|---|
| Dạng | Danh sách khoá vai trò | Danh sách `{role, unit}` |
| Dùng cho | Thư viện chuẩn, kiểm nhanh "có vai trò nào không" | Tính phạm vi dữ liệu theo đơn vị |
| Vai trò không gắn đơn vị (`unit_scoped = false`) | Có | Có, `unit = null` |
| Một vai trò ở hai đơn vị | Một khoá | Hai dòng |
| Quan hệ | Luôn khớp: mọi `role` trong `vh_roles` có trong `resource_access` và ngược lại | |

- Chỉ chứa **quyền hiệu lực**: trạng thái `hieu_luc` hoặc `chuyen_tiep` ([05](05-du-lieu.md) mục 4.2). Quyền đang chuyển tiếp vẫn có trong token tới hết hạn chuyển tiếp.
- Khoá vai trò viết như app công bố (`nvkd`). Cách viết `vclinks:nvkd` chỉ dùng trong tài liệu và giao diện VC Home.
- `unit` là mã đơn vị VC People (mẫu `^[A-Z0-9][A-Z0-9_-]{1,29}$`).

### 2.4 Ví dụ token theo giai đoạn

**GĐ A** — `id_token` VC ID cấp cho VClinks:

```json
{
  "iss": "https://id.vcprosperous.com/realms/vc",
  "aud": "vclinks",
  "azp": "vclinks",
  "sub": "6f1c2b7e-4d1a-4c55-9a0e-2f7d9b1c3e41",
  "iat": 1795223520,
  "exp": 1795223820,
  "auth_time": 1795223510,
  "nonce": "n-7Qw2kLr9",
  "sid": "b2a9c3d4-1e2f-4a5b-8c7d-6e5f4a3b2c1d",
  "email": "hoa.nt@vcpart.vn",
  "email_verified": true,
  "name": "Nguyễn Thị Hoa",
  "given_name": "Hoa",
  "family_name": "Nguyễn Thị",
  "picture": "https://lh3.googleusercontent.com/a/vi-du-anh-hoa",
  "hd": "vcpart.vn",
  "groups": ["app-vclinks", "app-vcwiki"]
}
```

**GĐ B** — thêm định danh nhân sự (các claim GĐ A giữ nguyên, không chép lại):

```json
{
  "employee_code": "VCP0123",
  "vh_profile": {
    "unit": "VCP-TBH1",
    "unit_name": "Tổ bán hàng HN1",
    "division": "VCP",
    "legal_entity": "VCPARTS",
    "title": "NVKD",
    "title_name": "Nhân viên kinh doanh",
    "function": "ban_hang"
  }
}
```

**GĐ C** — thêm vai trò. Chị Hoa là NVKD VCparts kiêm CSKH VCservice (ví dụ của VH-BR-24):

```json
{
  "groups": ["app-vclinks", "app-vcwiki"],
  "resource_access": { "vclinks": { "roles": ["nvkd", "cskh"] } },
  "vh_roles": {
    "vclinks": [
      { "role": "nvkd", "unit": "VCP-TBH1" },
      { "role": "cskh", "unit": "VCS-CSKH" }
    ]
  }
}
```

Token cùng người cấp cho VCwiki chỉ có phần của VCwiki:

```json
{
  "resource_access": { "vcwiki": { "roles": ["thanh_vien", "bien_tap"] } },
  "vh_roles": {
    "vcwiki": [
      { "role": "thanh_vien", "unit": null },
      { "role": "bien_tap", "unit": "VCP-KD" }
    ]
  }
}
```

### 2.5 Kích thước và đường dự phòng

- Mỗi token phải **dưới 4 KB** (giới hạn thường gặp của header và cookie ở proxy, trình duyệt).
- Ước tính: GĐ A khoảng 1,1 KB; GĐ B thêm khoảng 0,3 KB; mỗi dòng `vh_roles` khoảng 40 byte.
- `vc-provisioner` tính trước: nếu phần `vh_roles` của một app vượt 2 KB thì **không ghi** `vh_roles` cho app đó và đặt `vh_roles_overflow = true`. `resource_access` vẫn có.
- App thấy `vh_roles_overflow = true` thì gọi **VH-API-06** với `sub` để lấy danh sách vai trò kèm đơn vị trước khi tạo phiên. Gọi lỗi thì từ chối đăng nhập với `idp_unreachable` (mặc định chặn).

### 2.6 Danh sách kiểm token

Mọi app kiểm đủ các điểm sau lúc đăng nhập. Điểm 1–6 là 6 điểm của VH-NFR-01.

| # | Kiểm | Đạt khi | Sai thì |
|---|---|---|---|
| 1 | Chữ ký | `alg = RS256`; `kid` có trong JWKS (bộ khoá công khai của VC ID tại `{issuer}/protocol/openid-connect/certs`; nhớ đệm, tải lại khi gặp `kid` lạ, tối đa 1 lần mỗi phút); chữ ký đúng. Từ chối `alg = none` và mọi thuật toán HS | Từ chối; log lý do `token_invalid`; người dùng thấy mã `state_invalid` |
| 2 | `iss` | Bằng đúng issuer đã cấu hình | Như trên |
| 3 | `aud` | Chứa `client_id` của app; có nhiều `aud` thì `azp` phải là `client_id` | Như trên |
| 4 | `exp`, `iat` | `exp` chưa qua, `iat` không ở tương lai; lệch đồng hồ cho phép ≤ 60 giây | Như trên |
| 5 | `nonce` | Bằng `nonce` app lưu cùng `state` | Như trên |
| 6 | `email_verified` | `true` | Như trên |
| 7 | Domain | Đuôi `email` và `hd` (nếu có) thuộc `vcprosperous.com`, `vcpart.vn` (VH-BR-02) | `outside_domain` |
| 8 | Nhóm app | Khi bật `OIDC_REQUIRE_APP_GROUP`: `groups` có `app-<khoá>` | `app_not_granted` |
| 9 | Vai trò (GĐ C) | `resource_access.<app>.roles` có ít nhất một vai trò app đã ánh xạ; vai trò lạ bỏ qua và ghi log | `app_not_granted` |
| 10 | Người dùng | Tìm theo `sub`; chưa có thì tìm theo email (GĐ B: theo `employee_code` trước) và gắn `sub` một lần; đã gắn `sub` khác thì từ chối | `identity_conflict` |
| 11 | Trạng thái trong app | Tài khoản không bị app khoá riêng | `locked` |

Mã lỗi dùng chung ở [thiết kế SSO](ky-thuat/thiet-ke-sso-keycloak.md) mục 5.2. App tự đổi sang câu tiếng Việt của mình.

### 2.7 Vai trò đổi sau khi đăng nhập

Phiên của app sống tới 12 giờ không dùng, tối đa 7 ngày. Trong thời gian đó:

| Sự kiện tới | App làm |
|---|---|
| `vh.grant.added` | Thêm vai trò vào bộ nhớ quyền của người đó; có hiệu lực ngay, không cần đăng nhập lại |
| `vh.grant.removed` | Bỏ vai trò ngay. Nếu không còn vai trò nào của app: **thu hồi mọi phiên** của người đó trong app |
| `vh.person.left` | Thu hồi mọi phiên, khoá người dùng trong app (cùng lúc VC ID cũng gửi đăng xuất, mục 3) |

---

## 3. Đăng xuất phía máy chủ

**Đăng xuất phía máy chủ (back-channel logout):** VC ID gọi thẳng server của app để báo "phiên này đã kết thúc", không qua trình duyệt. Yêu cầu VH-INT-04, giai đoạn A. Theo [thiết kế SSO](ky-thuat/thiet-ke-sso-keycloak.md) mục 5.2 điểm 6–8.

| Hạng mục | Yêu cầu |
|---|---|
| Endpoint | `POST /api/auth/backchannel-logout`, công khai (không cần phiên), khai trong client của app trên VC ID, bật "yêu cầu `sid`" |
| Thân | `application/x-www-form-urlencoded`, một trường `logout_token`; giới hạn 16 KB |
| Kiểm `logout_token` | Chữ ký qua JWKS; `iss`; `aud` chứa `client_id`; `iat` trong 5 phút; có claim `events` chứa khoá `http://schemas.openid.net/event/backchannel-logout`; **không có** `nonce`; có `sid` hoặc `sub`; `jti` chưa dùng (lưu 10 phút để chống gửi lại) |
| Đạt | Thu hồi phiên theo `sid`; không có `sid` thì thu hồi mọi phiên theo `sub`. Trả `200`, header `Cache-Control: no-store` |
| Không đạt | Trả `400`, ghi log lý do, không thu hồi gì |
| Thời gian | Phiên mất hiệu lực ≤ 10 giây sau khi người dùng bấm đăng xuất ở bất kỳ app nào (UAT-SSO-07) |
| Phiên của app | Lưu kèm `sid` và `sub` (`idp_sub`); hết hạn sau 12 giờ không dùng và tối đa 7 ngày (VH-AUT-05) |
| Đăng xuất từ app | Thu hồi phiên riêng, rồi chuyển trình duyệt tới `{issuer}/protocol/openid-connect/logout?client_id=<app>&post_logout_redirect_uri=https://home.vcprosperous.com/da-dang-xuat` |

Ví dụ nội dung `logout_token`:

```json
{
  "iss": "https://id.vcprosperous.com/realms/vc",
  "aud": "vclinks",
  "iat": 1795230000,
  "jti": "5c0a3f4e-0b1d-4e7a-9f3c-2d1e0f9a8b7c",
  "sub": "6f1c2b7e-4d1a-4c55-9a0e-2f7d9b1c3e41",
  "sid": "b2a9c3d4-1e2f-4a5b-8c7d-6e5f4a3b2c1d",
  "events": { "http://schemas.openid.net/event/backchannel-logout": {} }
}
```

**Khi nào app nhận đăng xuất phía máy chủ:**
- Người dùng đăng xuất ở VC Home hoặc ở app khác.
- Quản trị hệ thống khoá khẩn cấp (VH-AUT-06): mất phiên ≤ 1 phút.
- Tài khoản Google bị khoá, bị xoá (VH-AUT-07): ≤ 20 phút.
- Từ GĐ C: 00:00 ngày nghỉ việc, VC Home khoá VC ID rồi gọi đăng xuất mọi app trước khi gửi `vh.person.left` (VH-BR-14 bước 1 và 3). App nhận **cả hai**; mỗi cái một mình đã đủ để chặn người đó.

---

## 4. Token máy cho app gọi API

Yêu cầu VH-INT-06, giai đoạn B. Dùng chuẩn OAuth 2.0 **client credentials**: app tự xin token bằng mã và bí mật của chính nó, không có người dùng.

### 4.1 Client máy trên VC ID

| Thiết lập | Giá trị |
|---|---|
| Tên client | `<khoá app>-service`, ví dụ `vclinks-service`, `vcwiki-service` |
| Loại | Confidential, chỉ bật "Service account"; tắt đăng nhập người dùng, implicit, direct access |
| Xác thực client | Bí mật client (xoay 6 tháng một lần, VH-NFR-05). Khuyến nghị dùng `private_key_jwt` (ký bằng khoá riêng của app) khi app làm được |
| Phạm vi được cấp | Quản trị hệ thống gán `vh.people.read`, `vh.grants.read` theo nhu cầu đã duyệt lúc đưa app vào (mục 7) |
| Đích token | Mapper thêm `vchome-api` vào `aud` |
| Thời hạn token | 300 giây (5 phút) |
| Ghi vào | `apps.service_client_id` ([05](05-du-lieu.md) mục 3.7) |

### 4.2 Xin token

```bash
curl -s https://id.vcprosperous.com/realms/vc/protocol/openid-connect/token \
  -d grant_type=client_credentials \
  -d client_id=vclinks-service \
  -d client_secret="$VCHOME_CLIENT_SECRET" \
  -d scope="vh.people.read vh.grants.read"
```

Nội dung access token nhận được:

```json
{
  "iss": "https://id.vcprosperous.com/realms/vc",
  "aud": ["vchome-api"],
  "azp": "vclinks-service",
  "sub": "0d4e…",
  "scope": "vh.people.read vh.grants.read",
  "iat": 1795223520,
  "exp": 1795223820,
  "jti": "b1f2…"
}
```

- App giữ token trong bộ nhớ, dùng lại tới 30 giây trước `exp`, rồi xin mới. Không xin token cho từng lần gọi. Không ghi token vào log.
- Bí mật client chỉ nằm trong biến môi trường hoặc kho bí mật của app, không vào git (VH-NFR-05).

### 4.3 VC Home API kiểm gì

- Chữ ký qua JWKS, `iss`, `exp`, `aud` có `vchome-api`.
- `azp` khớp `apps.service_client_id` của một app đang `live` hoặc đang đưa vào; từ đó biết **app gọi là app nào**.
- `scope` đủ cho API được gọi (bảng dưới).

| API | Scope cần |
|---|---|
| VH-API-01…05 | `vh.people.read` |
| VH-API-06 | `vh.grants.read` |
| VH-API-07 | Sự kiện `vh.person.*`, `vh.org.*` cần `vh.people.read`; `vh.grant.*` cần `vh.grants.read` |
| VH-API-08 | Không cần (công khai) |
| VH-API-09 | Không áp dụng (app cung cấp, mục 5.11) |

---

## 5. API cho app

### 5.1 Quy ước chung

| Hạng mục | Quy ước |
|---|---|
| Địa chỉ gốc | `https://home.vcprosperous.com/api/v1` (tên miền theo thiết kế SSO Q1). VH-API-08 và VH-API-09 không nằm dưới tiền tố này (mục 5.10, 5.11) |
| Xác thực | `Authorization: Bearer <token máy>` (mục 4) |
| Định dạng | JSON UTF-8, tên trường snake_case. Thời điểm UTC ISO 8601 có `Z`; ngày lịch `YYYY-MM-DD` |
| Mức dữ liệu | Trường C1 chỉ trả cho app có `people_data_level = C1`; app `C0` nhận cùng dạng nhưng không có các trường C1 |
| Mã nối | App gửi `X-Correlation-Id` nếu có; VC Home trả lại header này trong mọi phản hồi (VH-NFR-17) |
| Thời gian phản hồi | ≤ 300 ms (p95) (VH-NFR-13) |

**Lỗi** luôn có dạng:

```json
{ "error": { "code": "not_found", "message": "Không tìm thấy nhân viên VCP9999.", "correlation_id": "c-20261121-0812-11ab" } }
```

| HTTP | `code` | Khi nào | App làm |
|---|---|---|---|
| 400 | `bad_request` | Tham số sai | Sửa lời gọi |
| 401 | `invalid_token` | Thiếu token, sai chữ ký, hết hạn | Xin token mới, gọi lại một lần |
| 403 | `insufficient_scope` | Token thiếu scope | Báo quản trị hệ thống; không thử lại |
| 403 | `app_mismatch` | Hỏi quyền của app khác (VH-API-06) | Sửa lời gọi |
| 403 | `data_level_denied` | App mức `C0` gọi phần chỉ dành cho `C1` (VH-API-03, `include=history`) | Xin nâng mức dữ liệu (mục 7) hoặc bỏ lời gọi |
| 404 | `not_found` | Không có nhân viên, đơn vị, `sub` chưa gắn hồ sơ | Coi như không có; không đoán |
| 410 | `cursor_expired` | Con trỏ VH-API-07 cũ hơn 30 ngày | Đồng bộ lại toàn bộ (mục 6.7) |
| 429 | `rate_limited` | Vượt giới hạn | Chờ theo `Retry-After` |
| 5xx | `server_error` | Lỗi VC Home | Thử lại sau, giãn dần; giữ dữ liệu cũ, **không** mở thêm quyền |

### 5.2 Phân trang, giới hạn tần suất, bộ nhớ đệm

**Phân trang theo con trỏ** (cursor: một chuỗi đánh dấu chỗ đang đọc, app chỉ gửi lại nguyên văn):
- Tham số `limit` (mặc định 100, tối đa 500) và `cursor`.
- Phản hồi có `next_cursor`; `null` là hết. Có `as_of`: thời điểm dữ liệu được chụp.

**Giới hạn tần suất:** 600 lượt mỗi phút cho mỗi app (VH-NFR-04). Mọi phản hồi có `X-RateLimit-Limit`, `X-RateLimit-Remaining`; khi vượt trả `429` kèm `Retry-After` (giây).

**Bộ nhớ đệm:**
- **ETag** là "dấu phiên bản" của một phản hồi. Phản hồi một đối tượng hoặc danh mục có `ETag`. App gửi lại trong `If-None-Match`; không đổi thì nhận `304`, không tốn lượt đọc dữ liệu.
- **`changed_since`** (thời điểm UTC) trên các API danh sách: chỉ trả bản ghi đổi sau mốc đó, **kể cả** bản ghi chuyển sang `da_nghi`, đơn vị `ngung`, quyền đã gỡ, để app đối chiếu được.

| Dữ liệu | Cách giữ mới khuyến nghị |
|---|---|
| Một nhân viên | Cập nhật theo sự kiện. Nhớ đệm tối đa 5 phút khi đọc lẻ, dùng ETag |
| Danh sách nhân viên, quyền của app | Theo sự kiện; đối chiếu hằng đêm bằng `changed_since` = `as_of` lần trước trừ 5 phút |
| Cây đơn vị | Theo sự kiện `vh.org.unit_changed`; đối chiếu hằng đêm; ETag |
| Danh mục chức danh, chức năng, pháp nhân | Đọc mỗi ngày một lần với ETag |
| `catalog.json` | Nhớ đệm 5 phút; lỗi thì dùng bản cũ |

### 5.3 VH-API-01 — Lấy một nhân viên

| | |
|---|---|
| Gọi | `GET /api/v1/people/{employee_code}` hoặc `GET /api/v1/people/by-sub/{sub}` |
| Tham số | `include=history` (chỉ app `C1`): thêm các vị trí đã đóng |
| GĐ | B |

```json
{
  "employee_code": "VCP0123",
  "sub": "6f1c2b7e-4d1a-4c55-9a0e-2f7d9b1c3e41",
  "full_name": "Nguyễn Thị Hoa",
  "work_email": "hoa.nt@vcpart.vn",
  "photo_url": "https://lh3.googleusercontent.com/a/vi-du-anh-hoa",
  "work_phone": "02473001123",
  "legal_entity": { "code": "VCPARTS", "name": "Công ty TNHH VCparts (ví dụ)" },
  "primary": {
    "unit": { "code": "VCP-TBH1", "name": "Tổ bán hàng HN1", "type": "to_nhom", "division_code": "VCP" },
    "job_title": { "code": "NVKD", "name": "Nhân viên kinh doanh" },
    "job_function": { "code": "ban_hang", "name": "Bán hàng" }
  },
  "head_of_units": [],
  "status": "dang_lam",
  "employee_type": "chinh_thuc",
  "joined_on": "2024-03-01",
  "left_on": null,
  "leave": null,
  "work_location": { "code": "HN-VP1", "name": "Văn phòng Hà Nội" },
  "manager": { "employee_code": "VCP0045", "sub": "1a2b…", "full_name": "Trần Văn Nam" },
  "is_manager": false,
  "positions": [
    { "kind": "chinh", "unit": "VCP-TBH1", "job_title": "NVKD", "job_function": "ban_hang", "manager": "VCP0045", "start_on": "2024-03-01", "end_on": null },
    { "kind": "kiem_nhiem", "unit": "VCS-CSKH", "job_title": "NV_CSKH", "job_function": "cskh", "manager": "VCS0201", "start_on": "2026-11-01", "end_on": "2027-04-30" }
  ],
  "anonymized": false,
  "updated_at": "2026-11-12T03:41:00Z",
  "rev": 9
}
```

- Từ `status` trở xuống là C1: app `C0` không nhận các trường này.
- `sub` là `null` khi người đó chưa đăng nhập lần nào.
- Hồ sơ đã ẩn danh vẫn trả `200` với `anonymized: true` và các trường C0 đã xoá ([05](05-du-lieu.md) mục 7.2).
- Lỗi: 401, 403, 404, 429.

### 5.4 VH-API-02 — Danh sách nhân viên

| | |
|---|---|
| Gọi | `GET /api/v1/people` |
| Tham số | `unit` (mã đơn vị), `include_sub_units` (`true`/`false`, mặc định `false`), `position_kind` (`chinh` / `all`, mặc định `all`), `function` (mã chức năng, nhiều giá trị cách nhau dấu phẩy), `status` (mặc định `dang_lam,nghi_dai_ngay,tam_khoa`; có `changed_since` thì mặc định mọi trạng thái), `changed_since`, `limit`, `cursor` |
| GĐ | B |

```json
{
  "items": [
    {
      "employee_code": "VCP0123",
      "sub": "6f1c2b7e-4d1a-4c55-9a0e-2f7d9b1c3e41",
      "full_name": "Nguyễn Thị Hoa",
      "work_email": "hoa.nt@vcpart.vn",
      "primary": { "unit": "VCP-TBH1", "job_title": "NVKD", "job_function": "ban_hang" },
      "status": "dang_lam",
      "manager": "VCP0045",
      "updated_at": "2026-11-12T03:41:00Z",
      "rev": 9
    }
  ],
  "next_cursor": "eyJpZCI6IjY3MDVhMWYw…",
  "as_of": "2026-11-21T08:00:00Z"
}
```

- Lọc theo đơn vị xét mọi vị trí đang hiệu lực (chính và kiêm nhiệm), trừ khi `position_kind=chinh`.
- Dạng mỗi dòng là bản rút gọn của VH-API-01 (C1 chỉ cho app `C1`).
- Lỗi: 400, 401, 403, 429.

### 5.5 VH-API-03 — Chuỗi quản lý

| | |
|---|---|
| Gọi | `GET /api/v1/people/{employee_code}/managers` |
| Tham số | `max_levels` (mặc định 10) |
| GĐ | B |
| Mức | C1 (app `C0` nhận `403 data_level_denied`) |

```json
{
  "employee_code": "VCP0123",
  "based_on": "vi_tri_chinh",
  "chain": [
    { "level": 1, "employee_code": "VCP0045", "sub": "1a2b…", "full_name": "Trần Văn Nam", "unit": "VCP-TBH1", "job_title": "GSBH", "status": "dang_lam", "source": "quan_ly_truc_tiep" },
    { "level": 2, "employee_code": "VCP0012", "sub": "3c4d…", "full_name": "Phạm Quốc Bảo", "unit": "VCP", "job_title": "GDBH", "status": "dang_lam", "source": "quan_ly_truc_tiep" }
  ],
  "manager_missing": false
}
```

- Theo vị trí chính. Quản lý trực tiếp đã nghỉ thì dòng đó có `source: "truong_don_vi_tam"` (trưởng đơn vị tạm thay, VH-BR-05) và `manager_missing: true`.
- Lỗi: 401, 403, 404, 429.

### 5.6 VH-API-04 — Cây đơn vị và một đơn vị

| | |
|---|---|
| Gọi | `GET /api/v1/org-units` (cả cây, danh sách phẳng xếp từ gốc xuống) · `GET /api/v1/org-units/{code}` |
| Tham số | Danh sách: `status` (mặc định `hoat_dong`), `changed_since`, `root` (chỉ nhánh dưới một mã). Một đơn vị: `include=children,head` |
| GĐ | B |

```json
{
  "code": "VCP-TBH1",
  "name": "Tổ bán hàng HN1",
  "short_name": "Tổ HN1",
  "type": "to_nhom",
  "parent_code": "VCP-KD",
  "ancestors": ["VCPV", "VCP", "VCP-KD"],
  "division_code": "VCP",
  "legal_entity_code": "VCPARTS",
  "function_code": "ban_hang",
  "head": { "employee_code": "VCP0045", "sub": "1a2b…", "full_name": "Trần Văn Nam" },
  "status": "hoat_dong",
  "effective_from_on": "2024-01-01",
  "effective_to_on": null,
  "merged_into_code": null,
  "member_count": 9,
  "updated_at": "2026-11-05T02:00:00Z",
  "rev": 1
}
```

- Loại đơn vị: `tap_doan`, `division`, `phong`, `to_nhom` ([05](05-du-lieu.md) mục 3.4).
- Lỗi: 400, 401, 403, 404, 429.

### 5.7 VH-API-05 — Danh mục

| | |
|---|---|
| Gọi | `GET /api/v1/catalogs/job-titles` · `GET /api/v1/catalogs/job-functions` · `GET /api/v1/catalogs/legal-entities` · `GET /api/v1/catalogs/work-locations` |
| Tham số | `status` (mặc định `dang_dung`; `all` để lấy cả mục đã ngừng) |
| GĐ | B |

```json
{
  "items": [
    { "code": "NVKD", "name": "Nhân viên kinh doanh", "default_function_code": "ban_hang", "status": "dang_dung" },
    { "code": "GSBH", "name": "Giám sát bán hàng", "default_function_code": "ban_hang", "status": "dang_dung" }
  ],
  "updated_at": "2026-11-05T02:00:00Z"
}
```

- Không phân trang (danh mục nhỏ). Có ETag.
- Nơi làm việc trả kèm trong hồ sơ (`work_location`), không có API riêng.
- Lỗi: 401, 403, 429.

### 5.8 VH-API-06 — Quyền của app gọi

| | |
|---|---|
| Gọi | `GET /api/v1/apps/{app_key}/grants` |
| Tham số | `employee_code`, `sub`, `role`, `unit`, `include_sub_units`, `status` (mặc định `hieu_luc,chuyen_tiep`; có `changed_since` thì gồm cả `het_han`, `da_go`), `changed_since`, `limit`, `cursor` |
| GĐ | C |
| Ràng buộc | `app_key` phải là app của token gọi; khác thì `403 app_mismatch` |

```json
{
  "app": "vclinks",
  "items": [
    {
      "employee_code": "VCP0156",
      "sub": "9e8d…",
      "role": "nvkd",
      "unit": "VCP-TBH1",
      "status": "chuyen_tiep",
      "valid_from": "2023-06-01T00:00:00Z",
      "valid_to": null,
      "transition_until": "2026-12-03T17:00:00Z",
      "sources": ["luat"],
      "updated_at": "2026-11-30T17:00:40Z"
    },
    {
      "employee_code": "VCP0156",
      "sub": "9e8d…",
      "role": "nvkd",
      "unit": "VCP-TBH2",
      "status": "hieu_luc",
      "valid_from": "2026-11-30T17:00:40Z",
      "valid_to": null,
      "transition_until": null,
      "sources": ["luat"],
      "updated_at": "2026-11-30T17:00:40Z"
    }
  ],
  "next_cursor": null,
  "as_of": "2026-12-01T02:00:00Z"
}
```

- Mỗi dòng là một **quyền hiệu lực** (app, vai trò, đơn vị), đã gộp các nguồn. `sources` chỉ nói loại nguồn (`luat`, `yeu_cau`, `khan_cap`), không lộ luật hay yêu cầu cụ thể.
- `valid_to` là hạn xa nhất trong các nguồn; `null` khi có nguồn luật.
- Đây cũng là đường dự phòng khi token có `vh_roles_overflow` (mục 2.5).
- Lỗi: 400, 401, 403, 429.

### 5.9 VH-API-07 — Kéo sự kiện

| | |
|---|---|
| Gọi | `GET /api/v1/events` |
| Tham số | `after` (số thứ tự `app_seq` cuối cùng app đã xử lý; `0` = từ sự kiện cũ nhất còn giữ), `limit` (mặc định 100, tối đa 500), `types` (lọc loại, cách nhau dấu phẩy) |
| GĐ | C |

```json
{
  "items": [
    { "app_seq": 1843, "event": { "id": "01938b10-…", "type": "vh.person.moved", "spec_version": "1", "occurred_at": "2026-11-30T17:00:02Z", "effective_at": "2026-11-30T17:00:00Z", "sequence": 21, "subject": { "employee_code": "VCP0156", "sub": "9e8d…" }, "correlation_id": "c-20261201-0000-a91e", "data": { "…": "…" } } }
  ],
  "next_cursor": "1843",
  "has_more": false
}
```

- Chỉ trả sự kiện gửi cho app gọi, đúng thứ tự `app_seq`, cùng nội dung như khi đẩy (đã lọc theo mức dữ liệu).
- Kéo không đổi trạng thái gửi đẩy. App chống trùng bằng `id` như mục 6.4.
- Giữ 30 ngày. `after` cũ hơn thì `410 cursor_expired`.
- Lỗi: 400, 401, 403, 410, 429.

### 5.10 VH-API-08 — Danh mục app công khai

| | |
|---|---|
| Gọi | `GET https://home.vcprosperous.com/catalog.json` (không có tiền tố `/api/v1`) |
| Xác thực | Không. `Access-Control-Allow-Origin: *`, `Cache-Control: max-age=300` |
| GĐ | A (sinh từ `apps.yaml`). Từ B sinh lại từ collection `apps` mỗi khi đổi, **cùng đường dẫn, cùng dạng** |

Dạng `version: 1` theo [thiết kế SSO](ky-thuat/thiet-ke-sso-keycloak.md) mục 5.2. Từ GĐ B có thể thêm trường `kind` (`sso` / `lien_ket_ngoai`); app đọc tệp phải bỏ qua trường lạ. Không bao giờ có dữ liệu cá nhân trong tệp này.

### 5.11 VH-API-09 — Trạng thái app cho ô app

API này **do app cung cấp**, VC Home gọi. Giai đoạn E, không bắt buộc.

| | |
|---|---|
| Gọi | `GET <apps.status_url>`, mặc định `GET /api/vc-app/status` trên tên miền của app |
| Ai gọi | Trang VC Home trên trình duyệt, bằng access token của chính người dùng (VC ID thêm `aud` của app qua mapper) |
| App kiểm | Như mục 2.6 điểm 1–4 và 7 (không có `nonce`); `aud` có `client_id` của app |
| CORS | App cho phép riêng origin `https://home.vcprosperous.com` ở route này |
| Thời gian | App trả trong 2 giây; VC Home nhớ đệm 60 giây; lỗi thì ô app không hiện số |

```json
{
  "access": "granted",
  "badges": [
    { "key": "cho_duyet", "label": "Chờ duyệt", "count": 3, "url": "/inbox?filter=cho_duyet" }
  ],
  "updated_at": "2027-03-02T02:15:00Z"
}
```

`access` là `granted` hoặc `pending` (đã đăng nhập nhưng app đang chờ cấp quyền chi tiết). Số đếm chỉ tính trong phạm vi của người dùng; không có nội dung, tên khách.

---

### 5.12 VH-API-10 — Danh sách vai trò của chính app gọi

| | |
|---|---|
| Gọi | `GET /api/v1/apps/{app_key}/roles` |
| Ai gọi | Token máy của chính app đó (`<app>-service`), phạm vi `vh.grants.read` |
| GĐ | C |
| Dùng để | App tự kiểm bảng ánh xạ vai trò còn đủ khi chủ app thêm hoặc ngừng vai trò trên VH-MH-15 |

```json
{
  "app": "vclinks",
  "roles": [
    { "role": "nvkd", "name": "Nhân viên kinh doanh", "sensitive": false, "unit_scoped": true, "requestable": true, "status": "dang_dung" },
    { "role": "admin", "name": "Quản trị VClinks", "sensitive": true, "unit_scoped": false, "requestable": false, "status": "dang_dung" }
  ],
  "updated_at": "2026-11-25T03:00:00Z"
}
```

Lỗi: 403 khi token là của app khác.

## 6. Sự kiện gửi app

### 6.1 Danh sách sự kiện

Theo README mục 10. **Luồng** là đơn vị giữ thứ tự (mục 6.5).

| Sự kiện | Khi nào | Luồng | GĐ | Gửi cho |
|---|---|---|---|---|
| `vh.person.joined` | Nhân viên mới có hiệu lực (00:00 ngày vào làm) | `person` | C | Mọi app đăng ký |
| `vh.person.updated` | Đổi tên, tên gọi, email, ảnh, SĐT công việc, loại nhân viên, pháp nhân, nơi làm việc | `person` | C | Mọi app đăng ký |
| `vh.person.moved` | Đổi vị trí chính, thêm hoặc bỏ kiêm nhiệm, đổi quản lý | `person` | C | Mọi app đăng ký |
| `vh.person.leave_started` | Bắt đầu nghỉ dài ngày | `person` | D | Mọi app đăng ký |
| `vh.person.returned` | Kết thúc nghỉ dài ngày | `person` | D | Mọi app đăng ký |
| `vh.person.left` | Nghỉ việc có hiệu lực | `person` | C | Mọi app đăng ký |
| `vh.person.locked` | Tài khoản bị khoá tạm: khoá khẩn cấp (VH-AUT-06), khoá do Google (VH-AUT-07), HC-NS đặt trạng thái tạm khoá | `person` | C | Mọi app đăng ký |
| `vh.person.unlocked` | Mở khoá | `person` | C | Mọi app đăng ký |
| `vh.person.change_scheduled` | HC-NS lưu, đổi ngày hoặc huỷ ngày nghỉ việc hay chuyển vị trí chính trong tương lai (VH-INT-09) | `person` | C | Mọi app đăng ký |
| `vh.test.ping` | Bấm "Gửi thử" ở VH-MH-15 (VH-INT-10); không vào luồng thứ tự | — | C | Chỉ app được thử |
| `vh.grant.added` | Thêm một quyền hiệu lực (app, vai trò, đơn vị) | `grant` của app đó | C | **Chỉ** app của quyền |
| `vh.grant.removed` | Gỡ một quyền hiệu lực | `grant` của app đó | C | **Chỉ** app của quyền |
| `vh.org.unit_changed` | Thêm, đổi tên, chuyển, gộp, ngừng đơn vị; đổi trưởng đơn vị | `org_unit` | C | Mọi app đăng ký |

### 6.2 Phong bì sự kiện

Mọi sự kiện có cùng một lớp vỏ ("phong bì"). Nội dung riêng nằm trong `data`.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | string | Mã sự kiện, UUID v7; khoá chống trùng |
| `type` | string | Loại, ví dụ `vh.person.left` |
| `spec_version` | string | `"1"` |
| `occurred_at` | string | Lúc thay đổi được ghi (UTC) |
| `effective_at` | string | Lúc thay đổi có hiệu lực (UTC). Ví dụ nghỉ việc 01/12/2026 thì `2026-11-30T17:00:00Z` |
| `sequence` | int | Tăng dần trong một luồng của một đối tượng |
| `subject` | object | Người: `{employee_code, sub}` (`sub` có thể `null` khi chưa đăng nhập lần nào). Đơn vị: `{unit_code}` |
| `correlation_id` | string | Mã nối với thao tác gốc (VH-NFR-17) |
| `data` | object | Nội dung riêng (mục 6.6). Trường C1 bị bỏ với app mức `C0` |

Lược đồ JSON (JSON Schema) của phong bì:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://home.vcprosperous.com/schemas/vh-event-1.json",
  "type": "object",
  "required": ["id", "type", "spec_version", "occurred_at", "effective_at", "sequence", "subject", "correlation_id", "data"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "type": { "type": "string", "pattern": "^vh\\.(person|grant|org)\\.[a-z_]+$" },
    "spec_version": { "const": "1" },
    "occurred_at": { "type": "string", "format": "date-time" },
    "effective_at": { "type": "string", "format": "date-time" },
    "sequence": { "type": "integer", "minimum": 1 },
    "subject": {
      "type": "object",
      "properties": {
        "employee_code": { "type": "string" },
        "sub": { "type": ["string", "null"] },
        "unit_code": { "type": "string" }
      },
      "oneOf": [ { "required": ["employee_code"] }, { "required": ["unit_code"] } ]
    },
    "correlation_id": { "type": "string" },
    "data": { "type": "object" }
  },
  "additionalProperties": true
}
```

### 6.3 Cách gửi và chữ ký

| Hạng mục | Quy định |
|---|---|
| Cách gửi | `POST` HTTPS tới `apps.event_webhook_url`, mỗi yêu cầu **một** sự kiện, thân là phong bì JSON |
| Header | `Content-Type: application/json; charset=utf-8` · `X-VH-Event-Id` (= `id`) · `X-VH-Event-Type` · `X-VH-Timestamp` (giây Unix lúc gửi) · `X-VH-Signature` · `X-Correlation-Id` |
| Chữ ký | `X-VH-Signature: sha256=<hex>`, trong đó `<hex>` = HMAC-SHA256 (mã xác thực bằng bí mật chung) của chuỗi `<X-VH-Timestamp>.<thân yêu cầu nguyên byte>` với **bí mật riêng của app** |
| Xoay bí mật | Trong 7 ngày xoay, header có hai giá trị cách nhau dấu phẩy: `sha256=<mới>, sha256=<cũ>`. App chấp nhận nếu khớp một trong các bí mật mình đang giữ |
| App kiểm | Tính lại HMAC trên **thân nguyên byte** (trước khi phân tích JSON), so bằng hàm so sánh thời gian hằng; lệch giờ giữa `X-VH-Timestamp` và đồng hồ app **quá 5 phút thì từ chối** |
| App trả lời | `2xx` trong **5 giây**. Lưu sự kiện rồi xử lý sau, không xử lý lâu trong yêu cầu. Chữ ký sai, giờ lệch: trả `401` |
| Bí mật | VC Home sinh, hiện một lần cho chủ app lúc đưa app vào; lưu mã hoá (VH-NFR-03); app giữ trong kho bí mật |

Mẫu kiểm chữ ký (TypeScript, NestJS cần bật `rawBody` cho route này; VClinks đã làm vậy cho webhook kênh):

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyVhSignature(rawBody: Buffer, ts: string, header: string, secrets: string[]): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (!/^\d+$/.test(ts) || Math.abs(now - Number(ts)) > 300) return false;
  const given = header.split(',').map((s) => s.trim().replace(/^sha256=/, ''));
  return secrets.some((secret) => {
    const expected = createHmac('sha256', secret).update(`${ts}.`).update(rawBody).digest();
    return given.some((g) => {
      const got = Buffer.from(g, 'hex');
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
  });
}
```

Mẫu Python (FastAPI đọc `await request.body()`):

```python
import hashlib, hmac, time

def verify_vh_signature(raw_body: bytes, ts: str, header: str, secrets: list[bytes]) -> bool:
    if not ts.isdigit() or abs(time.time() - int(ts)) > 300:
        return False
    given = [s.strip().removeprefix("sha256=") for s in header.split(",")]
    for secret in secrets:
        expected = hmac.new(secret, ts.encode() + b"." + raw_body, hashlib.sha256).hexdigest()
        if any(hmac.compare_digest(g, expected) for g in given):
            return True
    return False
```

### 6.4 Gửi lại, ít nhất một lần, chống trùng

- **Ít nhất một lần:** một sự kiện có thể tới app **hơn một lần** (ví dụ app đã xử lý nhưng trả lời chậm quá 5 giây). Không bao giờ mất nếu app còn chạy trong 24 giờ.
- **Gửi lại** khi: không kết nối được, quá 5 giây, mã khác `2xx`. Khoảng chờ gấp đôi sau mỗi lần, cộng dao động ngẫu nhiên ±20%, tối đa 4 giờ một lần:

| Lần | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 trở đi |
|---|---|---|---|---|---|---|---|---|---|---|
| Chờ trước lần này | 0 | 1 phút | 2 phút | 4 phút | 8 phút | 16 phút | 32 phút | 64 phút | 128 phút | 4 giờ |

- Tròn **24 giờ** kể từ lần gửi đầu mà chưa được: trạng thái `that_bai`, cảnh báo quản trị hệ thống và chủ app (VH-ADM-04). Sự kiện vẫn lấy được qua VH-API-07 trong 30 ngày.
- **Chống trùng (idempotent: làm nhiều lần cũng như một lần):** app lưu `id` các sự kiện đã nhận ít nhất **7 ngày**; gặp lại `id` cũ thì trả `200` và không làm gì.
- Sự kiện của một app chậm không làm chậm app khác: mỗi app một hàng gửi riêng.

### 6.5 Thứ tự

- `sequence` tăng dần trong **từng luồng của từng đối tượng**:
  - luồng `person` của một người: mọi `vh.person.*`;
  - luồng `grant` của một người trong một app: `vh.grant.*` của app đó;
  - luồng `org_unit` của một đơn vị: `vh.org.unit_changed`.
- Mỗi sự kiện mang **ảnh chụp đầy đủ** trạng thái sau thay đổi của luồng đó (hồ sơ đầy đủ, danh sách vai trò đầy đủ trong app, đơn vị đầy đủ). Vì vậy app chỉ cần một luật:

| Tình huống | App làm |
|---|---|
| `sequence` ≤ số đã áp của luồng đó | Sự kiện cũ tới muộn: bỏ qua, trả `200` |
| `sequence` = số đã áp + 1 | Áp ảnh chụp |
| `sequence` > số đã áp + 1 (có lỗ) | Vẫn áp ảnh chụp (đã đầy đủ). Muốn chắc thì gọi VH-API-01 hoặc VH-API-06 |

- Giữa các luồng khác nhau không có thứ tự chung. Ví dụ `vh.grant.added` có thể tới trước `vh.person.moved` sinh ra nó.

### 6.6 Nội dung từng sự kiện

**Ảnh chụp người** (`person`) dùng chung cho mọi `vh.person.*`:

```json
{
  "employee_code": "VCP0156",
  "sub": "9e8d7c6b-5a49-4f38-a2b1-0c9d8e7f6a5b",
  "full_name": "Lê Văn Minh",
  "work_email": "minh.lv@vcpart.vn",
  "photo_url": "https://lh3.googleusercontent.com/a/vi-du-anh-minh",
  "work_phone": null,
  "legal_entity": "VCPARTS",
  "primary": { "unit": "VCP-TBH2", "division": "VCP", "job_title": "NVKD", "job_function": "ban_hang" },
  "head_of_units": [],
  "status": "dang_lam",
  "employee_type": "chinh_thuc",
  "joined_on": "2023-06-01",
  "left_on": null,
  "leave": null,
  "work_location": "HN-VP1",
  "manager": { "employee_code": "VCP0046", "sub": "5f6e…" },
  "is_manager": false,
  "positions": [
    { "kind": "chinh", "unit": "VCP-TBH2", "job_title": "NVKD", "job_function": "ban_hang", "manager": "VCP0046", "start_on": "2026-12-01", "end_on": null }
  ]
}
```

Từ `status` trở xuống là C1. App mức `C0` nhận ảnh chụp không có các trường đó; sự kiện vòng đời vẫn tới, `effective_at` cho biết lúc có hiệu lực.

**`vh.person.joined`**

```json
{ "person": { "…": "ảnh chụp người" }, "rejoin": false }
```

`rejoin: true` khi người đã nghỉ quay lại làm với mã cũ (VH-LCM-05).

**`vh.person.updated`**

```json
{
  "person": { "…": "ảnh chụp người" },
  "changes": ["full_name", "work_email"],
  "before": { "full_name": "Lê Minh", "work_email": "minh.l@vcpart.vn" }
}
```

`changes` chỉ gồm `full_name`, `work_email`, `photo_url`, `employee_type`. Đổi email: app cập nhật email, **không** tạo người mới (VH-BR-01).

**`vh.person.moved`**

```json
{
  "person": { "…": "ảnh chụp người" },
  "changes": [
    { "op": "close", "position": { "kind": "chinh", "unit": "VCP-TBH1", "job_title": "NVKD", "job_function": "ban_hang", "manager": "VCP0045", "start_on": "2023-06-01", "end_on": "2026-11-30" } },
    { "op": "open", "position": { "kind": "chinh", "unit": "VCP-TBH2", "job_title": "NVKD", "job_function": "ban_hang", "manager": "VCP0046", "start_on": "2026-12-01", "end_on": null } }
  ],
  "primary_changed": true,
  "manager_changed": true,
  "roles_in_transition": [
    { "app": "vclinks", "role": "nvkd", "unit": "VCP-TBH1", "remove_at": "2026-12-04T17:00:00Z" }
  ]
}
```

- `roles_in_transition` (bổ sung 08/10/2026, 04 mục 14.2): các vai trò của **app nhận** đang trong thời gian chuyển tiếp và lúc sẽ gỡ, để app bắt đầu bàn giao ngay.

Vai trò của app đổi theo nằm ở sự kiện `vh.grant.*` riêng. Vai trò cũ còn trong thời gian chuyển tiếp thì VH-API-06 trả `status: "chuyen_tiep"` và `transition_until`.

**`vh.person.leave_started`** và **`vh.person.returned`**

```json
{ "person": { "…": "ảnh chụp người" }, "leave": { "from_on": "2027-02-01", "to_on": "2027-07-31", "lock_login": false } }
```

```json
{ "person": { "…": "ảnh chụp người" }, "leave": { "from_on": "2027-02-01", "to_on": "2027-07-31", "returned_on": "2027-07-20" } }
```

Không bao giờ có lý do nghỉ ([05](05-du-lieu.md) mục 6).

**`vh.person.left`**

```json
{
  "person": { "…": "ảnh chụp người, status = da_nghi" },
  "left_on": "2026-12-01",
  "last_manager": { "employee_code": "VCP0046", "sub": "5f6e…" },
  "last_unit_head": { "employee_code": "VCP0046", "sub": "5f6e…" },
  "last_primary_unit": "VCP-TBH2"
}
```

- Tới sau khi VC ID đã khoá và đăng xuất người đó, và mọi quyền đã gỡ (VH-BR-14). App vẫn nhận `vh.grant.removed` cho từng vai trò.
- `last_manager`, `last_unit_head` để app chọn người nhận bàn giao mặc định; app tự quyết bàn giao.

**`vh.person.locked`** và **`vh.person.unlocked`**

```json
{
  "person": { "…": "ảnh chụp người, status = tam_khoa (hoặc dang_lam khi mở khoá)" },
  "source": "khan_cap",
  "locked_until": null
}
```

- `source`: `khan_cap` (VH-AUT-06), `google` (VH-AUT-07) hoặc `hcns` (trạng thái tạm khoá trên hồ sơ). Không có lý do chi tiết; lý do nằm trong nhật ký của VC Home.
- Khoá: VC ID đã đăng xuất người đó trước khi sự kiện đi. Quyền **không** bị gỡ (khác `vh.person.left`); app chỉ chặn đăng nhập và dừng các việc đang chờ của người đó.
- Mở khoá: app cho đăng nhập lại; không tự khôi phục việc đã dừng.

**`vh.person.change_scheduled`**

```json
{
  "person": { "…": "ảnh chụp người" },
  "kind": "nghi_viec",
  "status": "hen",
  "effective_on": "2026-11-30",
  "new_primary_unit": null,
  "handover_to": { "employee_code": "VCP0046", "sub": "5f6e…" }
}
```

- `kind`: `nghi_viec` · `chuyen_vi_tri`. `status`: `hen` (mới đặt) · `doi_ngay` · `huy`. `new_primary_unit` chỉ có khi `chuyen_vi_tri`.
- `handover_to` tuỳ chọn: người nhận bàn giao do HC-NS hoặc quản lý gợi ý; app tự quyết bàn giao.
- Không có lý do. Đến ngày hiệu lực vẫn có `vh.person.left` hoặc `vh.person.moved` như thường.
- VClinks dùng để bật cờ "Sắp nghỉ" (PQ-82) và nhắc giám sát chuẩn bị bàn giao.

**`vh.test.ping`**

```json
{ "message": "Gửi thử từ VC Home", "sent_by": { "employee_code": "VCP0007" } }
```

- Ký và gửi như sự kiện thật (mục 6.3); không có `sequence`, không tự gửi lại. App chỉ cần trả 2xx; không xử lý nghiệp vụ.

**`vh.grant.added`** và **`vh.grant.removed`**

```json
{
  "app": "vclinks",
  "change": { "op": "removed", "role": "nvkd", "unit": "VCP-TBH1", "reason": "khong_con_thoa_luat" },
  "roles": [
    { "role": "nvkd", "unit": "VCP-TBH2", "status": "hieu_luc", "valid_to": null, "transition_until": null }
  ]
}
```

- `change.op`: `added` · `removed`. `reason` (chỉ khi `removed`): `khong_con_thoa_luat`, `luat_tat`, `het_han`, `ra_soat`, `go_tay`, `nghi_viec`.
- `roles`: **toàn bộ** quyền hiệu lực của người đó trong app sau thay đổi (ảnh chụp của luồng `grant`). Danh sách rỗng nghĩa là người đó không còn vai trò nào: app thu hồi phiên (mục 2.7).

**`vh.org.unit_changed`**

```json
{
  "change": "merged",
  "unit": { "code": "VCP-TBH3", "name": "Tổ bán hàng HN3", "type": "to_nhom", "parent_code": "VCP-KD", "division_code": "VCP", "function_code": "ban_hang", "head": null, "status": "ngung", "effective_to_on": "2027-03-31", "merged_into_code": "VCP-TBH2" },
  "before": { "status": "hoat_dong", "head": "VCP0047" },
  "merged_into_code": "VCP-TBH2",
  "affected_positions": 6
}
```

`change`: `created` · `renamed` · `moved` · `merged` · `deactivated` · `head_changed` · `updated`. Người trong đơn vị bị gộp có sự kiện `vh.person.moved` riêng.

### 6.7 Kéo dự phòng và đối chiếu

| Lúc | App làm |
|---|---|
| Khởi động | Gọi VH-API-07 với `after` = `app_seq` cuối đã xử lý để bù phần lỡ khi app tắt |
| Mỗi 15 phút | Gọi VH-API-07 một lần (rẻ; thường trả rỗng) để bắt sự kiện đã `that_bai` |
| Hằng đêm | Đối chiếu bằng VH-API-02, 04, 06 với `changed_since`; sửa lệch, ghi log số lệch |
| Nhận `410 cursor_expired` | Đồng bộ lại toàn bộ bằng VH-API-02, 04, 06 rồi đặt `after` = `app_seq` mới nhất |

---

## 7. Các bước đưa một app vào

Quy trình VH-QT-11 (bản đầu dùng cho VClinks, VCwiki ở GĐ C; dùng chung cho mọi app từ GĐ E). Mỗi dòng có người làm và cách nghiệm thu. Tiến độ lưu ở `apps.onboarding`.

**Chuẩn bị**

- [ ] **Khai app vào danh mục** (khoá, tên, mô tả, URL, biểu tượng, trạng thái `coming_soon`). Ai: quản trị hệ thống. Kiểm nhận: ô "Sắp có" hiện trên trang chủ và trong `catalog.json`.
- [ ] **Ghi tên 1–3 chủ app** (VH-APP-03). Ai: quản trị hệ thống, chủ dự án duyệt. Kiểm nhận: chủ app đăng nhập thấy app của mình ở màn VH-MH-15.
- [ ] **Khai vai trò app**: khoá, tên, mô tả, nhạy cảm, có gắn đơn vị không (VH-APP-02, 05). Ai: chủ app. Kiểm nhận: danh sách vai trò hiện ở VH-MH-15; mỗi vai trò có mô tả đọc hiểu được.
- [ ] **Viết bảng ánh xạ vai trò app → quyền nội bộ** và lưu trong tài liệu của app. Ai: đội app, chủ app duyệt. Kiểm nhận: mọi vai trò khai ở VC Home có dòng ánh xạ; vai trò lạ có xử lý "bỏ qua và ghi log".
- [ ] **Chọn mức dữ liệu nhân sự** `C0` hoặc `C1`, ghi lý do nếu `C1`. Ai: chủ app, quản trị hệ thống duyệt. Kiểm nhận: `apps.people_data_level` đã đặt; gọi VH-API-01 thấy đúng trường.
- [ ] **Chọn thời gian chuyển tiếp** 0–7 ngày (VH-APP-06). Ai: chủ app. Kiểm nhận: đổi thử vị trí một người thử, quyền cũ còn đúng số ngày.

**Đăng nhập**

- [ ] **Tạo client OIDC** `<khoá>` trên VC ID (confidential, PKCE S256, redirect chính xác, URL đăng xuất phía máy chủ, mapper vai trò và `vh_roles`). Ai: quản trị hệ thống. Kiểm nhận: cấu hình nằm trong `vc.yaml`, CI áp thử không lỗi.
- [ ] **App làm đủ 8 điểm hợp đồng** của thiết kế SSO mục 5.2 và danh sách kiểm token mục 2.6. Ai: đội app. Kiểm nhận: test tự động mỗi ca sai một điểm đều bị từ chối; UAT-SSO-01…06, 13 đạt trên staging.
- [ ] **Đăng xuất phía máy chủ** (mục 3). Ai: đội app. Kiểm nhận: đăng xuất ở VC Home, phiên app mất ≤ 10 giây; gửi lại cùng `logout_token` bị từ chối.
- [ ] **Thanh chuyển app** (VH-MH-21) đọc `catalog.json`. Ai: đội app. Kiểm nhận: nút 9 chấm hiện đúng các app người dùng có.
- [ ] **Mặc định chặn** (VH-BR-20). Ai: đội app. Kiểm nhận: tài khoản thử không có vai trò bị từ chối `app_not_granted`; có vai trò thì vào được.

**Dữ liệu và sự kiện**

- [ ] **Tạo client máy** `<khoá>-service`, cấp scope cần thiết (mục 4). Ai: quản trị hệ thống. Kiểm nhận: app gọi VH-API-01 được; gọi VH-API-06 với khoá app khác bị `403`.
- [ ] **Endpoint nhận sự kiện** HTTPS, kiểm chữ ký, kiểm giờ, chống trùng, trả `2xx` trong 5 giây (mục 6.3, 6.4). Ai: đội app. Kiểm nhận: VC Home gửi sự kiện của người thử: nhận đúng; gửi lại cùng `id`: không xử lý hai lần; chữ ký sai: `401`; giờ lệch 6 phút: `401`.
- [ ] **Xử lý thứ tự và kéo dự phòng** (mục 6.5, 6.7). Ai: đội app. Kiểm nhận: tắt endpoint 1 giờ, bật lại: app tự bù đủ qua VH-API-07; sự kiện cũ tới muộn bị bỏ qua.
- [ ] **Khoá màn sửa hồ sơ, cơ cấu trong app** (VH-BR-03). Ai: đội app. Kiểm nhận: API sửa hồ sơ, cơ cấu trong app trả lỗi "do VC People quản lý"; giao diện chỉ đọc.
- [ ] **Ghi thời hạn lưu dữ liệu người đã nghỉ trong app**. Ai: chủ app, pháp chế xem. Kiểm nhận: tài liệu của app có dòng thời hạn và hành động khi nhận `vh.person.left`.

**Quyền và lên chạy**

- [ ] **Viết luật cấp quyền mặc định, xem trước, duyệt** (VH-ACC-01, 03; VH-BR-25). Ai: quản trị hệ thống soạn, chủ app duyệt. Kiểm nhận: bảng xem trước khớp danh sách người dùng thật của app; người thứ hai đã duyệt nếu trên 20 người.
- [ ] **Đối chiếu người dùng cũ của app với VC People** (với app đã có người dùng). Ai: đội app, HC-NS. Kiểm nhận: báo cáo "có trong app, không có hồ sơ" và "vai trò cũ khác vai trò từ luật" đã được chủ app xử lý.
- [ ] **Bật giám sát**: cảnh báo sự kiện `that_bai`, lỗi đăng nhập. Ai: quản trị hệ thống. Kiểm nhận: diễn tập một sự kiện thất bại, cảnh báo tới đúng người.
- [ ] **Chuyển trạng thái `live`**, chủ app ký biên bản (điều kiện R5 ở [10](10-ke-hoach-trien-khai.md)). Ai: quản trị hệ thống, chủ app. Kiểm nhận: ô app sáng cho đúng người có quyền; người không quyền không thấy ô.
- [ ] (GĐ E, không bắt buộc) **Trạng thái ô app** VH-API-09. Ai: đội app. Kiểm nhận: ô hiện số việc chờ đúng phạm vi người dùng.

---

## 8. Hướng dẫn riêng VClinks

Đọc cùng đặc tả phân quyền của VClinks (`vclinks/docs/02-yeu-cau/dac-ta/01-phan-quyen.md`) và mã dùng chung `vclinks/packages/shared/src/org.ts`, `permissions.ts`. Việc của dev VClinks theo [10](10-ke-hoach-trien-khai.md); quyết định cuối thuộc chủ VClinks.

### 8.1 Thay đổi tổng quan

| Phần | Hôm nay | Sau khi nối (GĐ C) |
|---|---|---|
| Cây tổ chức | Admin tự giữ, nhập lô (M1b-03, MH-PQ-01, MH-PQ-15) | Nhận một chiều từ VC People; màn sửa và nhập lô chỉ đọc |
| Người dùng | Tự tạo khi đăng nhập lần đầu, không vai trò (PQ-10); admin thêm tay | Tạo trước từ sự kiện và API; đăng nhập không có vai trò thì `app_not_granted` (sau Q-14) |
| Vai trò hệ thống (10 vai trò) | Admin gán; vai trò nhạy cảm cần người thứ hai (PQ-42) | Đến từ VC Home qua token, sự kiện, API; VC Home đã duyệt theo VH-BR-12, 25 |
| Phạm vi dữ liệu (TĐ, DV, TỔ, NH, CT…) | VClinks tính từ vai trò + đơn vị | **Không đổi**: VClinks vẫn tính, đơn vị lấy từ `vh_roles[].unit` |
| Nghỉ việc, đổi tổ | Admin bắt đầu bàn giao (M1b-11) | Sự kiện mở bàn giao; người quyết chia khách vẫn là GS / GĐ |
| Gán kênh, quyền tạm thời, trực thay, vai trò tuỳ chỉnh `tc_…`, cờ Sắp nghỉ | VClinks | **Giữ ở VClinks** |
| Token `vcz_`, token thiết bị, token MCP cá nhân, `/mcp`, `/mcp/dev`, ingest, webhook kênh, outbox, agent máy Zalo, `AUTH_TOKEN_LOGIN` | VClinks | **Giữ nguyên** |

Lưu ý tên: collection `access_grants` của VClinks là **quyền tạm thời** (§2.6 đặc tả VClinks), khác hẳn `access_grants` của VC Home (vai trò app). Hai database riêng, không trộn.

### 8.2 Ánh xạ loại đơn vị

VClinks có 8 loại đơn vị (`ORG_UNIT_TYPES` trong `org.ts`). VC People có 4 loại cộng chức năng của đơn vị (`function_code`). VClinks ánh xạ như sau:

| VC People: loại và chức năng | VClinks `OrgUnitType` | Ghi chú |
|---|---|---|
| `tap_doan` (mã `VCPV`) | `goc` | VClinks giữ mã `GOC` (`ROOT_UNIT_CODE`); ánh xạ cố định `VCPV` ↔ `GOC`. Vai trò `admin`, `quan_sat` đặt ở đây |
| `division` | `division` | `divisionId` = mã division |
| `phong` hoặc `to_nhom`, chức năng `ban_hang` | `to_ban_hang` | Phòng kinh doanh có tổ con → tổ cha và tổ con (VClinks cho lồng 1 cấp, `ORG_PARENT_TYPES`). Tổ đặt thẳng dưới division → tổ cấp 1 |
| `phong` hoặc `to_nhom`, chức năng `cskh` | `nhom_cskh` | |
| … chức năng `marketing` | `nhom_marketing` | |
| … chức năng `sale_admin` | `nhom_sale_admin` | |
| … chức năng `ke_toan` | `nhom_ke_toan` | |
| … chức năng `thi_truong` | `nhom_thi_truong` | |
| Đơn vị khác (kỹ thuật, kho, nhân sự, IT, phòng cấp tập đoàn…) hoặc chưa có `function_code` | Không tạo trong VClinks | Không vai trò VClinks nào đặt ở đó. Nếu có quyền VClinks trỏ tới đơn vị này: từ chối quyền đó, báo chủ VClinks (mục 8.4) |

Luật ánh xạ:
- **Mã đơn vị VClinks = mã VC People.** Hai bên cùng quy tắc mã (`unitCodeSchema`), nên `org_units._id` của VClinks dùng thẳng mã VC People.
- **Nhóm ngoài cây bán hàng chỉ một cấp dưới division.** Nếu VC People có `to_nhom` CSKH nằm dưới `phong` CSKH, VClinks gộp vào **đơn vị cao nhất cùng chức năng** trong division (phòng CSKH); `vh_roles[].unit` của tổ con được quy về mã phòng đó. Ghi log `org.collapsed`.
- **Tổ bán hàng tối đa hai tầng.** VC People không có tầng sâu hơn vì `to_nhom` không có con (VH-BR-06).
- **Quản lý đơn vị** (`managerUserId`) = trưởng đơn vị VC People. Luật VClinks `MANAGER_ROLE`: quản lý division phải có `giam_doc_bh`, quản lý tổ phải có `giam_sat_bh`. Trưởng đơn vị chưa có vai trò đó thì VClinks để trống quản lý và báo chủ VClinks; **không tự cấp vai trò**.
- **Ngừng, gộp:** `active = false`; đơn vị gộp thì gán kênh (`channel_access`) đang trao cho đơn vị cũ được liệt kê cho Admin VClinks chuyển tay.

### 8.3 Ánh xạ vai trò

Vai trò app `vclinks:*` ở VC Home **trùng đúng** 10 khoá vai trò của VClinks (`ROLE_KEYS` trong `org.ts`, cũng là khoá của `ROLE_MATRIX` trong `permissions.ts`). Ánh xạ 1–1, không đổi tên.

| Vai trò app VC Home | Khoá `ROLE_MATRIX` | Nhãn VClinks | Phải đặt ở (`ROLE_UNIT_TYPE`) | Nhạy cảm (VH-APP-05) | Phạm vi chính (01-phan-quyen §2.3) | Nguồn cấp gợi ý |
|---|---|---|---|---|---|---|
| `vclinks:admin` | `admin` | Admin hệ thống | `goc` | Có (`SENSITIVE_ROLES`) | Cấu hình; không đọc chat | Chỉ qua yêu cầu (bước 2 chủ app) |
| `vclinks:quan_sat` | `quan_sat` | Ban giám đốc / Kiểm soát | `goc` | Có | TĐ, chỉ đọc | Luật theo chức năng `ban_giam_doc`, đơn vị cố định gốc; hoặc yêu cầu |
| `vclinks:giam_doc_bh` | `giam_doc_bh` | Giám đốc bán hàng | `division` | Có | DV | Luật: chức năng `ban_hang` + là trưởng đơn vị loại `division`, `unit_binding = division_cua_vi_tri` |
| `vclinks:giam_sat_bh` | `giam_sat_bh` | Giám sát bán hàng | `to_ban_hang` | Không | TỔ (gồm tổ con) | Luật: chức năng `ban_hang` + là trưởng đơn vị loại `phong` / `to_nhom` |
| `vclinks:nvkd` | `nvkd` | Nhân viên kinh doanh | `to_ban_hang` | Không | CT, NICK | Luật: chức danh `NVKD`, `theo_vi_tri` |
| `vclinks:cskh` | `cskh` | Nhân viên CSKH | `nhom_cskh` | Không | CT / NH, KÊNH, TK | Luật: chức năng `cskh` |
| `vclinks:marketing` | `marketing` | Nhân viên marketing | `nhom_marketing` | Không | LEAD, KÊNH | Luật: chức năng `marketing` |
| `vclinks:sale_admin` | `sale_admin` | Sale admin | `nhom_sale_admin` | Không | DV (hồ sơ, không chat) | Luật: chức năng `sale_admin` |
| `vclinks:ke_toan` | `ke_toan` | Kế toán | `nhom_ke_toan` | Không | DV (phiếu, hoá đơn) | Luật: chức năng `ke_toan` |
| `vclinks:nv_thi_truong` | `nv_thi_truong` | NV thị trường | `nhom_thi_truong` | Không | TUYẾN | Luật: chức năng `ban_hang` + chức danh "Nhân viên thị trường" (12 mục 4.2) |

- Mọi vai trò `vclinks:*` đều `unit_scoped = true`.
- **Cờ "Trưởng nhóm"** của VClinks (`GROUP_LEAD_ROLES`) = người đó là trưởng đơn vị VC People của đúng đơn vị trong `vh_roles[].unit`. Không có vai trò riêng.
- **Vai trò tuỳ chỉnh `tc_…`** (MH-PQ-05) vẫn do Admin VClinks gắn lên một gán vai trò đến từ VC Home; luôn hẹp hơn hoặc bằng vai trò gốc (NT6), không bao giờ rộng hơn.
- **Hai người duyệt (PQ-42):** vai trò nhạy cảm đến từ VC Home đã qua bước 2 chủ app (VH-BR-12) hoặc luật đã có người thứ hai duyệt (VH-BR-25). VClinks không duyệt lại, chỉ ghi nhật ký `role.*` với nguồn `vchome`. Đề xuất: luật cho vai trò nhạy cảm luôn cần người thứ hai duyệt, kể cả dưới 20 người (mục 11).

### 8.4 Phạm vi dữ liệu từ `vh_roles[].unit`

Mỗi dòng `vh_roles.vclinks` (hoặc dòng VH-API-06) thành một **gán vai trò** (`RoleAssignment`) của VClinks:

| Trường VClinks | Lấy từ |
|---|---|
| `roleKey` | `role` |
| `orgUnitId` | `unit` (sau luật gộp ở mục 8.2) |
| `lead` | Người đó là trưởng đơn vị `unit` |
| `from`, `to` | `valid_from`, `valid_to` (VH-API-06) |
| `customRoleId` | Giữ nguyên nếu Admin VClinks đã gắn |
| Nguồn (trường mới) | `vchome`; gán vai trò nguồn `vchome` không sửa tay được trong VClinks |

- Phạm vi TĐ / DV / TỔ / NH / CT / NICK / KÊNH… vẫn do engine VClinks tính (`canView`, `canSend` §2.9 đặc tả VClinks). VC Home không quyết phạm vi (VH-BR-08).
- **Đơn vị sai loại** (ví dụ `nvkd` tại đơn vị ánh xạ ra `nhom_cskh`): VClinks **từ chối riêng dòng đó**, giữ các dòng khác, ghi `role.vchome_rejected`, báo chủ VClinks. Không tự dời sang đơn vị khác.

### 8.5 Thay nhập tay và tự tạo người dùng bằng đồng bộ

Đề xuất cờ `ORG_SOURCE=local|vchome` (tên cuối do VClinks chốt). Khi `vchome`:

| Màn / API VClinks | Sau khi bật |
|---|---|
| MH-PQ-01 Cây tổ chức; `POST/PATCH /admin/org-units`, `move`, `deactivate`, `reactivate` | Chỉ đọc; API trả `409` mã `managed_by_vchome` |
| MH-PQ-15 Nhập lô; `POST /admin/{org-units,users}/import*` | Tắt. Dữ liệu khởi đầu đi theo VH-IMP-03 (VC Home lấy cây VClinks làm điểm xuất phát) |
| MH-PQ-02, 03: tạo người dùng; sửa họ tên, email, SĐT nội bộ, đơn vị chính; `change-unit`; gán, gỡ 10 vai trò | Chỉ đọc với dữ liệu nguồn `vchome` |
| MH-PQ-03: khoá riêng trong VClinks (`tam_khoa`), "Khóa ngay" | **Giữ**: khoá riêng của app, không ảnh hưởng app khác (thiết kế SSO mục 3.4) |
| Đăng nhập lần đầu tự tạo người dùng không vai trò (PQ-10, `AUTH_SELF_SIGNUP`) | Giữ trong thời gian chuyển tiếp Q-14 (30 ngày sau R3). Sau đó `AUTH_SELF_SIGNUP=0`: người dùng đã được tạo trước từ `vh.person.joined` / `vh.grant.added`; đăng nhập không có vai trò thì `app_not_granted` |

**Ánh xạ trạng thái người dùng:**

| VC People | VClinks `users.status` |
|---|---|
| `chua_vao_lam` | Chưa tạo (hoặc `cho_kich_hoat`) |
| `dang_lam` | `hoat_dong` |
| `nghi_dai_ngay` | `hoat_dong`, kèm cờ vắng (mục 8.6) |
| `tam_khoa` | `tam_khoa` |
| `da_nghi` | `nghi_viec` |

### 8.6 Sự kiện và việc VClinks làm

| Sự kiện | VClinks làm |
|---|---|
| `vh.person.joined` | Tạo người dùng (email, họ tên, `employeeCode`, `idpSub` nếu có), chưa có vai trò cho tới `vh.grant.added` |
| `vh.person.updated` | Cập nhật họ tên, email, SĐT nội bộ (từ `work_phone`) |
| `vh.person.moved` | Cập nhật đơn vị chính. Nếu người đó có khách, nick ở đơn vị cũ: **tạo bàn giao loại `doi_don_vi`** (`handovers.kind`) ở trạng thái chờ, báo GS / GĐ đơn vị cũ. Không tự chuyển khách |
| `vh.grant.added` | Thêm gán vai trò (mục 8.4); có hiệu lực ≤ 60 giây (NT9) |
| `vh.grant.removed` | Gỡ gán vai trò. Nếu bàn giao `doi_don_vi` chưa xong: khách còn lại về "Chưa phân công" của tổ cũ, báo GS và GĐ (giống PQ-34; đề xuất, chủ VClinks chốt). `roles` rỗng: thu hồi mọi phiên |
| `vh.person.left` | Chạy tự động bước ① "Khóa ngay" của PQ-33 với người làm là `vchome`: trạng thái `nghi_viec`, huỷ phiên, thu hồi token MCP cá nhân, quyền tạm thời, trực thay; thu hồi token thiết bị gắn nick người đó giữ (trừ máy "dùng chung"); lệnh gửi đã duyệt chuyển `Cần duyệt lại`. Mở **bàn giao** MH-PQ-04 cho GS / GĐ (người nhận gợi ý từ `last_manager`). **Không tự chia khách**; đồng hồ nhắc 4 giờ, 20 giờ, 24 giờ của PQ-34 chạy như cũ |
| `vh.person.leave_started` | Đặt cờ vắng; nhắc GS tạo trực thay (PQ-32); "Chia đều" khi bàn giao bỏ người này |
| `vh.person.locked` | Đặt trạng thái tạm khoá, huỷ phiên, tạm ngưng token MCP cá nhân; lệnh gửi đã duyệt của người đó chuyển `Cần duyệt lại` (PQ-51); không chia lại khách |
| `vh.person.unlocked` | Bỏ tạm khoá; lệnh `Cần duyệt lại` giữ nguyên chờ người duyệt |
| `vh.person.returned` | Bỏ cờ vắng; nhắc GS kết thúc trực thay |
| `vh.org.unit_changed` | Cập nhật `org_units` theo mục 8.2; gộp, ngừng thì liệt kê gán kênh cần chuyển cho Admin |

**Thời gian chuyển tiếp đề xuất cho VClinks: 3 ngày** (`apps.transition_days = 3`, ví dụ ở VH-BR-11). Trong 3 ngày người chuyển tổ còn cả vai trò cũ để bàn giao khách và nick.

**Cờ "Sắp nghỉ"** (PQ-82, L-05): hiện VC Home chưa có sự kiện báo trước ngày nghỉ. Trong lúc chờ (mục 11), VClinks đọc `left_on` qua VH-API-02 với `changed_since` hằng giờ; thấy ngày nghỉ ở tương lai thì gợi ý GS / GĐ đặt cờ.

### 8.7 Chuyển đổi dữ liệu

1. VC Home lấy cây tổ chức và danh sách người dùng của VClinks làm dữ liệu khởi đầu (VH-IMP-03), **giữ nguyên mã đơn vị**.
2. HC-NS bổ sung hồ sơ tới khi đủ ≥ 98% (01 mục 7, điều kiện 1).
3. Lập bảng ánh xạ mã đơn vị cũ → mới nếu có đơn vị đổi mã (01 mục 7, điều kiện 2; RR-03).
4. Thêm `employeeCode` cho `users` của VClinks theo email.
5. Báo cáo lệch: gán vai trò đang có trong VClinks so với quyền tính từ luật VC Home. Chủ VClinks duyệt bảng ánh xạ vai trò (01 mục 7, điều kiện 3).
6. Chạy song song 1 tuần ở chế độ chỉ đọc (so sánh, không áp) rồi mới bật `ORG_SOURCE=vchome` (RR-03).
7. Quay lui: tắt cờ, dữ liệu VClinks vẫn còn, chỉ thêm trường.

---

## 9. Hướng dẫn riêng VCwiki

Đọc cùng `tiktok-to-text/docs/BA.md` mục 6 (SYS) và mục 15 (ORG). Làm theo quy trình của repo: **BA → DESIGN → Code → UAT**; mã SYS mới lấy số kế tiếp sau SYS-60 do VCwiki cấp.

### 9.1 Thay đổi tổng quan

| Phần | Hôm nay | Sau khi nối (GĐ C) |
|---|---|---|
| Cây đơn vị `org_units` (`group` / `division` / `department` / `team`) | Quản trị VCwiki sửa (ORG-01) | Nhận một chiều từ VC People; sửa tay bị khoá |
| Trục chức năng `org_functions` | Quản trị sửa (ORG-02) | Mã và tên nhận từ VC People; `category_root` vẫn sửa ở VCwiki |
| Hồ sơ tổ chức `users.org` | Quản trị sửa, nhập Excel (ORG-03, 04) | `unit_ids`, `function`, `manager_id`, `position`, `status` nhận từ VC People |
| Nghỉ việc, chuyển phòng (ORG-08) | Quản trị bấm | Chạy theo sự kiện |
| Vai trò hệ thống `admin` / `member` | Quản trị gán | Đến từ VC Home: `quan_tri`, `thanh_vien`, `bien_tap` |
| Vai trò theo lĩnh vực (`grants`), uỷ quyền (ORG-07), kho và thành viên kho, mức mật C0–C3, `allow_user_ids`, cấp bậc, quản lý chuyên môn | VCwiki | **Giữ ở VCwiki** |
| Token `vcmcp_`, cổng MCP, chat Claude | VCwiki | **Giữ nguyên** |

### 9.2 Phân hệ ORG thành bên đọc

| VC People | VCwiki | Ghi chú |
|---|---|---|
| `org_units.code` | `org_units.code` | Khoá nối. `_id` ObjectId của VCwiki giữ nguyên để không phải sửa chỗ đang trỏ tới |
| `type`: `tap_doan` / `division` / `phong` / `to_nhom` | `kind`: `group` / `division` / `department` / `team` | 1–1. Luật đặt cha của VC People chặt hơn (`to_nhom` không có con) |
| `parent_code`, `ancestors` | `parent_id`, `path` | Đổi mã → ObjectId của bản sao |
| `head_person_id` | `head_id` | Tìm người theo `sub`, rồi `employee_code`, rồi email |
| `function_code` | `function` | Qua bảng mã chức năng dưới đây |
| `status` | `active` | `ngung` → `false` |
| `job_functions` | `org_functions.code`, `name` | `category_root` giữ ở VCwiki |
| Vị trí chính + kiêm nhiệm | `users.org.unit_ids` | Phần tử đầu là đơn vị chính |
| Chức năng của vị trí chính | `users.org.function` | |
| Tên chức danh vị trí chính | `users.org.position` | |
| Quản lý trực tiếp | `users.org.manager_id` | Cây quản lý của VCwiki (giao lộ trình, chấm bài) chạy như cũ |
| `people.status` | `users.org.status` (`active` / `left`) và `users.active` | `da_nghi` → `left`, `active = false`; `tam_khoa` → `active = false` |
| (không có) | `functional_manager_id`, `level`, `org_level_map` | **Giữ và sửa ở VCwiki** cho tới khi có quyết định ở mục 11 |

**Bảng mã chức năng** (đề xuất; chốt theo Q-02): VCwiki `sales` → `ban_hang` · `marketing` → `marketing` · `finance` → `ke_toan` · `tech` → `ky_thuat`. Khuyến nghị VCwiki chuyển hẳn sang mã VC People, giữ bảng này một lần để đổi dữ liệu cũ.

**Route bị khoá** khi bật cờ (đề xuất `ORG_SOURCE=vchome`), trả `409` mã `managed_by_vchome`:
- `POST /org/units`, `PATCH /org/units/{id}`;
- `POST /org/functions`, `PATCH /org/functions/{id}` (trừ trường `category_root`);
- `PATCH /org/users/{id}` (trừ `functional_manager_id`, `level`);
- `POST /org/import`;
- `POST /org/users/{id}/offboard` (chạy theo sự kiện; quản trị VCwiki vẫn khoá riêng trong VCwiki được bằng `active=false`).

Tạo, sửa, khoá tài khoản trong màn Người dùng (`POST /users`, `PATCH /users/{id}` đổi `role`) cũng chỉ đọc với tài khoản đã gắn VC ID.

### 9.3 Vai trò

| Vai trò app VC Home | VCwiki | Nhạy cảm | Gắn đơn vị | Ghi chú |
|---|---|---|---|---|
| `vcwiki:quan_tri` | `users.role = admin` | Có | Không | Vẫn **không** tự đọc C1–C3 và kho cá nhân người khác (ORG-13) |
| `vcwiki:thanh_vien` | `users.role = member` | Không | Không | Luật gợi ý: mọi nhân viên đang làm (ứng với nhóm mặc định GĐ A) |
| `vcwiki:bien_tap` | Một dòng `grants` vai trò `editor`, `scope.unit_id` = đơn vị trong `vh_roles[].unit` (gồm đơn vị con), nguồn `vchome` | Không | Có | Dòng `grants` nguồn `vchome` không sửa, không uỷ quyền tiếp được ở VCwiki; gỡ khi có `vh.grant.removed` |

**Ở lại VCwiki** (vai trò theo nghiệp vụ, VC Home không biết):
- `reviewer` (người duyệt theo lĩnh vực), `category_owner` (chủ sở hữu lĩnh vực), `lnd`, `doc_control`, `auditor` với phạm vi lĩnh vực / đơn vị / chức năng;
- uỷ quyền ORG-07;
- chủ kho, thành viên kho (`owner` / `editor` / `viewer`), kho công khai;
- mức mật thẻ, `allow_user_ids`, `min_level`.

Người có `grants` cục bộ mà không còn vai trò VC Home nào cho VCwiki thì không đăng nhập được (mặc định chặn); `grants` cục bộ giữ nguyên để có lại khi được cấp lại.

### 9.4 Chia sẻ kho theo đơn vị (SYS-35)

- `spaces.unit_grants[]` thêm trường `unit_code` (mã VC People). `unit_id` tra từ mã qua bản sao `org_units`.
- Quyền tính lúc truy cập từ `users.org.unit_ids` (đã đồng bộ), nên vào đơn vị thì tự có, rời đơn vị thì tự mất, đúng như SYS-35.
- Đơn vị **gộp** (`vh.org.unit_changed`, `merged`): VCwiki chuyển dòng chia sẻ sang `merged_into_code`, giữ quyền cao hơn nếu trùng, báo chủ kho.
- Đơn vị **ngừng**: giữ dòng, hiện nhãn "Đơn vị đã ngừng", báo chủ kho.

### 9.5 Sự kiện và việc VCwiki làm

| Sự kiện | VCwiki làm |
|---|---|
| `vh.person.joined` | Tạo người dùng trước (email, tên, `employee_code`, `idp_sub` nếu có), `users.org` theo mục 9.2; chưa có vai trò |
| `vh.person.updated` | Cập nhật tên, email |
| `vh.person.moved` | Cập nhật `unit_ids`, `function`, `position`, `manager_id`. Quyền theo đơn vị đổi ngay vì VCwiki tính quyền lúc truy cập (ABAC, mục 15.1 BA VCwiki) |
| `vh.grant.added` / `removed` | Đặt `users.role`; thêm, gỡ dòng `grants` `editor` nguồn `vchome`. `roles` rỗng: thu hồi phiên |
| `vh.person.left` | Chạy ORG-08: khoá, thu hồi phiên và mọi token `vcmcp_`, chuyển vai trò và nhánh đang sở hữu cho quản lý trực tiếp (`last_manager`), giữ tên trong lịch sử |
| `vh.person.leave_started` / `returned` | Không bắt buộc; có thể hiện nhãn vắng ở danh sách người duyệt |
| `vh.person.locked` / `unlocked` | Khoá: thu hồi phiên, tạm ngưng token `vcmcp_` của người đó; mở khoá: bật lại token |
| `vh.org.unit_changed` | Cập nhật bản sao `org_units`; xử lý chia sẻ kho như mục 9.4 |

### 9.6 Chuyển đổi dữ liệu

1. Mô hình ORG của VCwiki là điểm xuất phát của VC People (01 mục 7; Q-06). VC Home lấy cây và hồ sơ của VCwiki (VH-IMP-03) cùng với của VClinks; HC-NS chọn bản đúng khi hai bên lệch.
2. Mã đơn vị VCwiki (ví dụ `VCPART`, `VCPART-MKT`) và mã VClinks có thể khác nhau: chốt **một** bảng ánh xạ mã cũ → mã VC People trước khi bật (RR-03).
3. Đổi `org_units.code`, `org_functions.code`, `spaces.unit_grants` theo bảng; chạy thử trên bản sao database.
4. Bật cờ, chạy song song 1 tuần chỉ đọc, rồi khoá route.

---

## 10. Ghi chú cho VCsale, VCgarage, VC AI

Vào ở GĐ E theo mục 7. Tên vai trò dưới đây chỉ là ví dụ; chủ app khai vai trò thật (VH-APP-02).

| App | Vai trò thô (ví dụ) | Phạm vi dữ liệu | Ghi chú |
|---|---|---|---|
| **VCsale** (ERP phụ tùng) | `ban_hang`, `thu_kho`, `ke_toan`, `quan_ly` | Theo kho, chi nhánh: VC Home cấp vai trò kèm đơn vị; gán người vào **kho** cụ thể vẫn ở VCsale | Luật theo nơi làm việc (Q-12) dùng `work_locations` loại `kho`. MCP của VCsale gắn token với `sub` của người dùng |
| **VCgarage** | `co_van_dich_vu`, `ky_thuat_vien`, `quan_ly_xuong` | Theo xưởng: `work_locations` loại `gara` hoặc đơn vị | Phân việc theo xe, khoang sửa là quyền chi tiết của VCgarage |
| **VC AI** (Gatekeeper và các tác tử) | Theo từng tác tử | AI mang **đúng quyền của người dùng**, không hơn (như D7 của VClinks) | Dùng chung `sub` và vai trò app của VC Home; bỏ bảng `identity_links` (01 mục 7). Gatekeeper có client máy `vcai-service` để đọc VH-API-01, 06. Hành động thay người dùng về sau dùng cơ chế đổi token của Keycloak (RFC 8693, thiết kế SSO mục 14) với phạm vi hẹp |

---

## 11. Đề xuất bổ sung (chưa cấp mã)

**Đã xử lý ngày 08/10/2026** (BA trưởng, người dùng uỷ quyền; [12](12-cau-hoi-rui-ro.md) mục 6): 1, 6, 7 đã xử lý từ trước; 2 → VH-INT-09 (`vh.person.change_scheduled`); 3 → `roles_in_transition` trong `vh.person.moved`; 4 → VH-INT-10 (`vh.test.ping`); 5 → VH-API-10 (mục 5.12); 8 → thêm vào phiên thử kỹ thuật SSO-00; 9, 10 → để sau.

| # | Đề xuất | Lý do | Ai quyết |
|---|---|---|---|
| 1 | ~~Sự kiện tạm khoá / mở khoá~~ | **Đã đưa vào** README mục 10 và mục 6 của file này (`vh.person.locked`, `vh.person.unlocked`) ngày 08/10/2026 | — |
| 2 | Sự kiện **báo trước ngày nghỉ** khi HC-NS đặt `left_on` ở tương lai | VClinks cần cho cờ "Sắp nghỉ" (PQ-82). Hiện phải dò bằng VH-API-02 | BA, chủ VClinks |
| 3 | Báo khi quyền **vào chuyển tiếp** (ví dụ thêm `roles_in_transition` trong một sự kiện) | App bắt đầu bàn giao ngay lúc chuyển, không phải gọi thêm VH-API-06 | BA |
| 4 | Sự kiện thử `vh.app.ping` và nút "Gửi thử" ở màn quản trị app | Kiểm nhận endpoint lúc đưa app vào mà không cần người thử | Trưởng nhóm dev |
| 5 | API đọc danh sách vai trò app của chính mình | App tự kiểm bảng ánh xạ còn đủ khi chủ app thêm vai trò | BA |
| 6 | ~~Luật cho vai trò nhạy cảm luôn cần người thứ hai duyệt~~ | **Đã đưa vào** VH-BR-25 ngày 08/10/2026 | — |
| 7 | ~~Từ GĐ B đổi cách đồng bộ tên của Google sang VC ID~~ | **Đã ghi** vào thiết kế SSO mục 5.1.2 (bản 0.2) ngày 08/10/2026 | — |
| 8 | Phiên thử kỹ thuật cho mapper `vh_roles` kiểu JSON theo từng client trên bản Keycloak đã ghim | Chưa thử ở SSO-00; nếu không được thì dùng mapper kịch bản hoặc chỉ dùng VH-API-06 | Trưởng nhóm dev |
| 9 | Đưa **quản lý chuyên môn** và **cấp bậc** vào VC People | VCwiki đang dùng; tránh hai nơi giữ | Chủ dự án, HC-NS |
| 10 | Gửi sự kiện theo lô khi số app hoặc số thay đổi lớn | Giảm số yêu cầu khi đổi cơ cấu lớn | Trưởng nhóm dev (khi có số đo) |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.3 | 08/10/2026 13:49 | Claude Code (vai BA trưởng) | Khoá theo Google ≤ 20 phút (`vc-provisioner` mỗi 15 phút) | Đánh giá bảo mật luồng đăng nhập, người dùng đồng ý 6 điểm vá ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) D-BA-37…42 |
| 0.2 | 08/10/2026 11:31 | Claude Code (vai BA trưởng) | Thêm sự kiện `vh.person.change_scheduled` (VH-INT-09), `vh.test.ping` (VH-INT-10), trường `roles_in_transition` trong `vh.person.moved`, VH-API-10 (mục 5.12); luật `vclinks:nv_thi_truong` dùng chức năng `ban_hang` + chức danh; ghi xử lý đề xuất mục 11 | Người dùng uỷ quyền chốt toàn bộ câu hỏi và đề xuất ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) mục 4, 6 |
| 0.1 | 08/10/2026 10:16 | Claude Code (vai BA) | Tạo tài liệu: nguyên tắc, claim theo GĐ A/B/C có ví dụ, `resource_access` và `vh_roles`, danh sách kiểm token, đăng xuất phía máy chủ, token máy, VH-API-01…09, 11 loại sự kiện (gồm khoá, mở khoá do BA trưởng thêm sau khi soát) kèm phong bì, chữ ký HMAC, gửi lại, thứ tự, kéo dự phòng; danh sách kiểm đưa app vào; hướng dẫn riêng VClinks, VCwiki; ghi chú VCsale, VCgarage, VC AI; 10 đề xuất | README bộ tài liệu 0.1 |
