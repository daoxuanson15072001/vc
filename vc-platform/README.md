# vc-platform: VC ID và VC Home

Phiên bản 0.1 · 08/10/2026 · Trạng thái: Đang code GĐ A (môi trường giả lập)

## Tóm tắt

- **Là gì:** mã nguồn nền tảng đăng nhập chung của VC Phồn Vinh: VC ID (Keycloak), VC Home, `vc-provisioner`. Thiết kế và kế hoạch ở `docs/vc-home/` của repo `vc` (thiết kế SSO, kế hoạch code GĐ A–D).
- **Tạm đặt** trong repo `vc`; sau chuyển sang repo riêng `vc-platform` (private) bằng `git subtree split`, giữ lịch sử.
- **Đang có:** cấu hình realm dạng code (`keycloak/realm/`) và công cụ áp `@vc/realm-apply`; theme đăng nhập tiếng Việt; Google giả cho dev; app mẫu làm đúng hợp đồng tích hợp; 10 ca thử kỹ thuật SSO-00 đạt (`docs/thu-nghiem-sso-00.md`).
- **Chưa có:** VC Home SPA (SSO-03), `vc-provisioner` (SSO-04), compose production (SSO-01, SSO-10).
- **Bí mật:** không bao giờ vào git. Production đọc `.env` (mẫu ở `.env.example`); dev dùng `scripts/dev-env.sh` (giá trị giả).

## Mục lục

- [1. Cấu trúc](#1-cấu-trúc)
- [2. Chạy trên máy dev](#2-chạy-trên-máy-dev)
- [3. Lệnh thường dùng](#3-lệnh-thường-dùng)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `keycloak/realm/` | `vc.yaml` (production), `vc.dev.yaml` (dev: nối Google giả, app mẫu), `gia-google.yaml` (Google giả, chỉ dev) |
| `keycloak/apply/` | `@vc/realm-apply`: áp YAML vào Keycloak qua Admin API, áp lại được, có `--dry-run` |
| `keycloak/themes/vc/` | Theme đăng nhập tiếng Việt |
| `tools/app-mau/` | App mẫu theo hợp đồng tích hợp (thiết kế SSO mục 5.2); `src/oidc.ts` là phần đội app chép theo |
| `tools/e2e/` | Ca Playwright chạy với Keycloak local |
| `scripts/` | `kc-local.sh` (Keycloak không cần Docker), `dev-env.sh` |
| `docs/` | Ghi chép thử nghiệm, sổ phiên |

## 2. Chạy trên máy dev

Cần Node 22, pnpm 9, Java 21 (hoặc Docker khi có `compose.dev.yml`).

```bash
pnpm install
scripts/kc-local.sh &          # Keycloak 26.7.5 ở http://localhost:8180, quản trị admin / admin-dev-only
source scripts/dev-env.sh
pnpm realm:apply:dev           # tạo realm gia-google và vc
pnpm app-mau &                 # app mẫu ở http://localhost:4400 (đăng nhập bằng tài khoản Google giả)
pnpm e2e                       # chạy ca SSO-00
```

## 3. Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `pnpm realm:apply -- --file ../realm/vc.yaml --dry-run` | Xem trước thay đổi trên một Keycloak (biến môi trường theo `.env.example`) |
| `pnpm realm:apply -- --file ../realm/vc.yaml --force-secrets` | Áp và gửi lại bí mật Google (khi xoay khoá) |
| `pnpm ci:local` | Kiểm kiểu + test đơn vị |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 08/10/2026 14:53 | Claude Code (SSO-00, SSO-02) | Tạo khung repo: cấu hình realm, công cụ áp, theme, Google giả, app mẫu, ca e2e SSO-00 | Kế hoạch code tổng quan; thiết kế SSO mục 6, 8 |
