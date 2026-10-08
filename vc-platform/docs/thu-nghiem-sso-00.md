# Thử kỹ thuật SSO-00: Keycloak với Google giả

Phiên bản 0.1 · 08/10/2026 · Trạng thái: Đã chạy, chờ kiểm lại phần Google thật

## Tóm tắt

- **Làm gì:** chạy Keycloak trên máy dev, nối realm `vc` với một "Google giả" (realm `gia-google`), rồi kiểm các điểm SSO-00 của thiết kế SSO mục 8 bằng 10 ca Playwright (`tools/e2e/tests/sso00.spec.ts`) và một app mẫu làm đúng hợp đồng tích hợp mục 5.2 (`tools/app-mau`).
- **Kết quả:** 10/10 ca đạt. Áp cấu hình realm lần hai không đổi gì (áp lại được).
- **Bản ghim:** Keycloak **26.7.5** (Quarkus 3.33.4, Java 21). Tải từ Maven Central (bản sao của Google), kiểm SHA-1 `b68fda2bccc3db641008cfefeeab5fdbe78221a0`.
- **Hai thay đổi so với thiết kế:**
  - Không dùng `keycloak-config-cli` (Maven Central không có bản mới, GitHub bị chặn ở máy làm việc). Thay bằng công cụ nhỏ `@vc/realm-apply` trong `keycloak/apply`, gọi Admin API, áp lại được.
  - Lớp chặn domain ở VC ID dùng **bộ lọc claim `hd`** của chỗ nối Google. Cách kiểm email bằng "user profile" **không chặn được**: tài khoản Gmail vẫn được tạo user.
- **Chờ kiểm với Google thật** (cần đầu vào I3, I6): Google nhận 2 hosted domain; `id` của Directory trùng `sub` của Google; mapper `google-user-attribute-mapper` lấy `hd`; bộ lọc claim chạy với loại nhà cung cấp `google`.
- **Người duyệt xem kỹ:** mục 3 (lớp chặn domain), mục 4 (việc còn lại).

## Mục lục

- [1. Cách chạy lại](#1-cách-chạy-lại)
- [2. Kết quả từng điểm](#2-kết-quả-từng-điểm)
- [3. Lớp chặn domain](#3-lớp-chặn-domain)
- [4. Việc còn lại với Google thật](#4-việc-còn-lại-với-google-thật)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Cách chạy lại

```bash
cd vc-platform
pnpm install
scripts/kc-local.sh                 # tải Keycloak 26.7.5 (lần đầu), chạy ở http://localhost:8180
source scripts/dev-env.sh
pnpm realm:apply:dev                # áp gia-google, rồi vc + vc.dev
pnpm --filter @vc/app-mau start &   # app mẫu ở http://localhost:4400
pnpm --filter @vc/e2e test:e2e      # 10 ca SSO-00 (PW_CHROMIUM_PATH nếu cần)
```

Tài khoản thử của Google giả nằm ở `keycloak/realm/gia-google.yaml` (mật khẩu chung, chỉ dùng ở dev).

## 2. Kết quả từng điểm

| Điểm (thiết kế SSO mục 8) | Ca kiểm | Kết quả |
|---|---|---|
| (1) Google nhận 2 hosted domain | Chỉ kiểm được với Google thật | Chờ I3, I6 |
| (2) `kc_idp_hint` bỏ qua trang Keycloak | Mở app → trang đăng nhập Google giả ngay | Đạt |
| (3) Claim `groups`, `hd`, `sid` | Token có `sub`, `email`, `email_verified`, `hd`, `groups` (không đường dẫn đầy đủ), `sid`, `vc_trang_thai` | Đạt |
| (4) Back-channel tới endpoint thử | Quản trị đăng xuất user → app mẫu nhận `logout_token`, huỷ phiên theo `sid`; đăng xuất từ app hiện trang xác nhận "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?" | Đạt |
| (5) `jose` trong VClinks | Chưa làm (không đụng VClinks trước 26/10); `jose` 5 chạy tốt trong app mẫu Node 22 | Làm ở SSO-08 |
| (6) `PyJWKClient` trong VCwiki | PyJWT 2.15.1 tải JWKS realm `vc` và kiểm chữ ký token | Đạt |
| (7) Mapper `vh_roles` JSON theo client | Thuộc tính nhiều giá trị `vh_roles_<app>`, mỗi giá trị một JSON → claim `vh_roles` là mảng `{role, unit}` | Đạt |
| (8) Tạo sẵn user có liên kết Google | Tạo user có `federatedIdentities` → đăng nhập vào thẳng user đó, không tạo user thứ hai | Đạt với Google giả; chờ kiểm `id` Directory = `sub` Google |
| Không nhóm mặc định (D-BA-37) | Lần đầu chưa có nhóm → app trả `app_not_granted` | Đạt |
| Nhật ký `LOGIN` theo client (VH-ADM-06) | `GET /admin/realms/vc/events?type=LOGIN&client=app-mau` có `clientId` | Đạt |

## 3. Lớp chặn domain

- **Đã thử và bỏ:** kiểm email bằng "user profile" (mẫu email chỉ nhận 2 domain, email chỉ quản trị sửa). Kết quả: trang "Cập nhật thông tin tài khoản" hiện ra không có lỗi, bấm "Gửi" là user Gmail được tạo. App vẫn chặn (`outside_domain`) nhưng VC ID có rác.
- **Đang dùng:** chỗ nối Google bật "lọc theo claim" (`filteredByClaim`, `claimFilterName: hd`, `claimFilterValue: ^(vcprosperous\.com|vcpart\.vn)$`). Token không có `hd` đúng bị từ chối **trước khi tạo user**. Câu hiện ra đã đổi thành "Tài khoản này không thuộc công ty. Hãy chọn tài khoản @vcprosperous.com hoặc @vcpart.vn." (`federatedIdentityUnmatchedEssentialClaimMessage` trong theme `vc`).
- **Ba lớp chặn ở production:** `hostedDomain` của Google → bộ lọc claim `hd` ở VC ID → app kiểm domain lần nữa (mục 5.2 điểm 3).

## 4. Việc còn lại với Google thật

Khi có I3 (OAuth client "VC ID" trên Google Cloud) và I6:

1. Áp `vc.yaml` không kèm `vc.dev.yaml` lên một Keycloak thử, đăng nhập bằng một tài khoản mỗi domain và một Gmail.
2. Kiểm `hostedDomain: vcprosperous.com,vcpart.vn`; không nhận nhiều domain thì để trống và dựa vào bộ lọc claim.
3. Kiểm mapper `google-user-attribute-mapper` (`jsonField: hd`) ghi được `hd` và bộ lọc claim chạy với nhà cung cấp `google`.
4. So `id` của Directory API với `sub` Google của cùng tài khoản (điểm 8).

Ước tính 1 giờ.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 08/10/2026 14:52 | Claude Code (SSO-00) | Chạy thử Keycloak 26.7.5 với Google giả: 10/10 ca đạt; bỏ kiểm email bằng user profile, dùng bộ lọc claim `hd`; thay keycloak-config-cli bằng `@vc/realm-apply` | Thiết kế SSO mục 8 (SSO-00); người dùng yêu cầu giả lập để code 08/10/2026 |
