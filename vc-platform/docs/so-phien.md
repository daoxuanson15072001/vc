# Sổ phiên vc-platform

Phiên bản 0.1 · 08/10/2026 · Trạng thái: Đang làm GĐ B, phiên B-01

## Tóm tắt

- **Sổ này để làm gì:** ghi vết từng phiên code của `vc-platform`: đã làm gì, kiểm thế nào, commit nào, còn gì. Mở phiên mới thì đọc mục 1 và mục 4 trước. Mỗi phiên xong thêm một dòng ở mục 2 (kế hoạch GĐ B mục 9 yêu cầu).
- **Đã xong:** phần GĐ A nằm trong repo này (SSO-00…04), chạy với thông số giả lập: Google giả, Directory giả, bí mật giả. Kiểm: 32 ca e2e, 34 test đơn vị, 16 bước kiểm cụm production. Tài liệu thiết kế đã khớp code (D-BA-49…54).
- **Đang làm:** GĐ B, phiên **B-01**: khung VC Home API (NestJS + MongoDB replica set).
- **Tiếp theo:** B-02…B-07 (xác thực, lõi thay đổi có ngày hiệu lực, danh mục, cây đơn vị, hồ sơ, vị trí). Những phiên này không cần đầu vào thật.
- **Không làm ở repo này:** SSO-05…09 sửa VClinks và VCwiki ở repo của từng app; VClinks chỉ sau mốc M1 26/10 (RB-1).
- **Chặn ở phía người:** SSO-10 lên production cần I1, I2, I5; thử với Google thật cần I3, I4, I6; nạp dữ liệu nhân sự thật cần N1, N4.

## Mục lục

- [1. Tiến độ tổng](#1-tiến-độ-tổng)
- [2. Nhật ký phiên](#2-nhật-ký-phiên)
- [3. Phần đang giả lập](#3-phần-đang-giả-lập)
- [4. Cách tiếp tục khi mở phiên mới](#4-cách-tiếp-tục-khi-mở-phiên-mới)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Tiến độ tổng

Kế hoạch: GĐ A ở [thiết kế SSO](../../docs/vc-home/ky-thuat/thiet-ke-sso-keycloak.md) mục 8; GĐ B ở [kế hoạch GĐ B](../../docs/vc-home/ky-thuat/ke-hoach-code-gd-b.md) mục 9.

**GĐ A (R1, 65 giờ)**

| Phiên | Trạng thái | Ghi chú |
|---|---|---|
| SSO-00 Thử kỹ thuật | Xong (giả lập) | 10/10 ca; còn 4 điểm chỉ kiểm được với Google thật (I3) |
| SSO-01 Hạ tầng | Xong | Compose production, compose dev, sao lưu và khôi phục |
| SSO-02 Realm và theme | Xong (giả lập) | Đăng nhập bằng Google thật chờ I3 |
| SSO-03 VC Home | Xong | Lighthouse truy cập 100 trên điện thoại |
| SSO-04 `vc-provisioner` | Xong (giả lập) | Directory thật chờ I4; báo cáo I9 chờ dữ liệu thật |
| SSO-05…07 VCwiki | Chưa | Repo `tiktok-to-text`, ngoài repo này |
| SSO-08, 09 VClinks | Chưa | Repo VClinks, sau 26/10 |
| SSO-10 Production | Chờ I1, I2, I5 | Làm theo README mục 4; `scripts/thu-production.sh` đã kiểm trên máy dev |
| SSO-11 UAT, SSO-12 Dọn | Chưa | Sau SSO-07, SSO-09 |

**GĐ B (R2, 142 giờ)**

| Phiên | Trạng thái | Ghi chú |
|---|---|---|
| B-01 Khung repo, API, MongoDB | **Đang làm** | |
| B-02 Xác thực, `Viewer`, `@Can`, nhật ký | Chưa | |
| B-03 Lõi thay đổi có ngày hiệu lực | Chưa | |
| B-04 Danh mục | Chưa | |
| B-05 Cây đơn vị và trưởng đơn vị | Chưa | |
| B-06 Hồ sơ nhân viên | Chưa | |
| B-07 Vị trí công tác và quản lý | Chưa | |
| B-08 Tài khoản, khoá, đồng bộ VC ID | Chưa | Dùng Keycloak dev |
| B-09…B-15 | Chưa | B-13 cần tệp Excel mẫu (tự tạo); B-15 dùng Google giả |
| B-16 Lên production chế độ quản trị | Chưa | Cần N12 (máy 4 vCPU / 8 GB), N3 |
| B-17…B-24 | Chưa | |
| B-25 UAT, lên R2 | Chưa | Cần N4, N5 |

## 2. Nhật ký phiên

Mới nhất trên cùng.

| Ngày | Phiên | Đã làm | Kiểm | Commit | Còn lại |
|---|---|---|---|---|---|
| 08/10/2026 | Tài liệu | Ghi quyết định phát sinh khi code GĐ A vào 12 (D-BA-49…54); thiết kế SSO lên 0.6; bỏ mọi chỗ nhắc `keycloak-config-cli` | — | `c1ba2c7` | — |
| 08/10/2026 | SSO-01, SSO-02 | `compose.yml` (PostgreSQL, Keycloak, edge, VC Home, provisioner, realm-apply, backup, cloudflared), `compose.dev.yml`, Dockerfile Keycloak, nginx edge chặn `/admin` và realm `master`, sao lưu 14 + 6 bản, `restore.sh`; theme: trang lỗi sai domain, trang đã đăng xuất; realm chuyển thẳng sang Google | `scripts/thu-production.sh` 16/16 từ con số 0; e2e 32/32 trên `compose.dev.yml` | `3ccf1fb` | Lên máy thật (SSO-10) |
| 08/10/2026 | SSO-03 | VC Home: trang chào, lưới app, ghim, hồ sơ, đã đăng xuất, trang lỗi, câu theo `vc_trang_thai`; phiên chỉ gia hạn khi có thao tác; nginx có CSP; Dockerfile | 14 ca e2e qua nginx, 0 vi phạm CSP, axe; Lighthouse truy cập 100 | `98babfe` | — |
| 08/10/2026 | SSO-04 | `vc-provisioner`: sync, loop, report, disable, enable; quy tắc thuần, an toàn khi Google trả danh sách bất thường | 9 test đơn vị; e2e UAT-SSO-09, 10, 21, 22, 23 | `d93b2e4` | Directory thật (I4) |
| 08/10/2026 | SSO-00, SSO-02 | Keycloak 26.7.5 không cần Docker, realm dạng code, công cụ `@vc/realm-apply`, Google giả, theme tiếng Việt, app mẫu theo hợp đồng mục 5.2 | 10 ca e2e SSO-00; 13 test app mẫu | `819f2fa` | 4 điểm cần Google thật |

## 3. Phần đang giả lập

| Thứ | Đang dùng | Khi có thật | Đầu vào |
|---|---|---|---|
| Google đăng nhập | Realm `gia-google` trên Keycloak dev (`keycloak/realm/gia-google.yaml`), 8 tài khoản thử, mật khẩu `Thu@123456` | Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; áp `vc.yaml` không kèm `vc.dev.yaml`; kiểm 4 điểm ở `docs/thu-nghiem-sso-00.md` | I3, I6 |
| Google Directory | `provisioner/fixtures/directory.dev.json` | Khoá tài khoản dịch vụ vào `secrets/google-directory.json`, `GOOGLE_ADMIN_SUBJECT` | I4 |
| Danh sách loại trừ | `provisioner/fixtures/loai-tru.dev.yaml`; production `config/loai-tru.yaml` đang rỗng | Điền theo danh sách duyệt | I9 |
| Bí mật | `scripts/dev-env.sh`, `scripts/local-prod.env` (giá trị giả) | `.env` trên máy chủ, quyền 600 | I1 |
| Tên miền | `localhost`, `*.vc.localhost` | `id.`, `id-admin.`, `home.vcprosperous.com` qua Cloudflare tunnel | I2 |
| Dữ liệu nhân sự (GĐ B) | Sẽ dùng dữ liệu tự sinh | Tệp Excel của HC-NS sau khi pháp chế duyệt | N1, N4 |

## 4. Cách tiếp tục khi mở phiên mới

Môi trường cloud là tạm: mỗi lần mở phiên mới phải dựng lại.

```bash
cd vc-platform && pnpm install
# Docker có thể chưa chạy: chạy `dockerd` ở nền rồi đợi `docker ps` trả lời.
docker compose -f compose.dev.yml up -d        # Keycloak + PostgreSQL ở :8180 (không có Docker: scripts/kc-local.sh &)
source scripts/dev-env.sh && pnpm realm:apply:dev
pnpm app-mau &                                 # :4400
pnpm home:nginx                                # VC Home qua nginx ở :5173 (cần nginx; không có thì pnpm home &)
pnpm e2e                                       # 32 ca
pnpm ci:local                                  # kiểm kiểu + test đơn vị
scripts/thu-production.sh                      # dựng cụm production thử, 16 bước kiểm; dọn: scripts/thu-production.sh down
```

Ghi chú riêng môi trường cloud này (không đưa vào code):

- quay.io bị chặn: dùng `KEYCLOAK_IMAGE=keycloak/keycloak:26.7.5` (cùng nhà phát hành).
- Container ra mạng qua proxy giải mã TLS: build ảnh Node với `NODE_IMAGE` là bản `node:22-alpine` có CA của proxy (`/root/.ccr/ca-bundle.crt`, biến `NODE_EXTRA_CA_CERTS`). Kho gói Alpine không ra được, nên Dockerfile không dùng `apk add`.
- Maven Central bị giới hạn: `scripts/kc-local.sh` tải Keycloak từ bản sao của Google.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 08/10/2026 16:02 | Claude Code | Tạo sổ: tiến độ GĐ A, GĐ B; nhật ký 5 phiên đã làm; phần giả lập; cách tiếp tục | Người dùng yêu cầu lưu vết tiến độ trước khi làm tiếp |
