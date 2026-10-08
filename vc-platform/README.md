# vc-platform: VC ID và VC Home

Phiên bản 0.5 · 08/10/2026 · Trạng thái: Đang code GĐ A (môi trường giả lập)

## Tóm tắt

- **Là gì:** mã nguồn nền tảng đăng nhập chung của VC Phồn Vinh: VC ID (Keycloak), VC Home, `vc-provisioner`. Thiết kế và kế hoạch ở `docs/vc-home/` của repo `vc` (thiết kế SSO, kế hoạch code GĐ A–D).
- **Tạm đặt** trong repo `vc`; sau chuyển sang repo riêng `vc-platform` (private) bằng `git subtree split`, giữ lịch sử.
- **Đang có:** cấu hình realm dạng code (`keycloak/realm/`) và công cụ áp `@vc/realm-apply`; theme đăng nhập tiếng Việt; Google giả cho dev; app mẫu làm đúng hợp đồng tích hợp; 10 ca thử kỹ thuật SSO-00 đạt (`docs/thu-nghiem-sso-00.md`); `vc-provisioner` chạy với Directory giả, đạt UAT-SSO-09, 10, 21, 22, 23; VC Home (trang chào, lưới app, hồ sơ, đăng xuất, trang lỗi) chạy sau nginx có CSP, đạt UAT-SSO-01, 04, 07, 08, 20 và Lighthouse truy cập 100 trên điện thoại; cụm production bằng Docker Compose (edge chặn `/admin`, sao lưu và khôi phục) đạt 16 bước kiểm của `scripts/thu-production.sh`.
- **Chưa có:** lên máy chủ thật (SSO-10, cần I1, I2, I5); tích hợp VClinks, VCwiki (SSO-05 đến SSO-08).
- **Chờ đầu vào thật:** Google OAuth client (I3), tài khoản dịch vụ Directory (I4), thông tin hai Workspace (I6). Khi có thì chỉ đổi biến môi trường, không đổi code.
- **Bí mật:** không bao giờ vào git. Production đọc `.env` (mẫu ở `.env.example`); dev dùng `scripts/dev-env.sh` (giá trị giả).

## Mục lục

- [1. Cấu trúc](#1-cấu-trúc)
- [2. Chạy trên máy dev](#2-chạy-trên-máy-dev)
- [3. Lệnh thường dùng](#3-lệnh-thường-dùng)
- [4. Production](#4-production)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `keycloak/realm/` | `vc.yaml` (production), `vc.dev.yaml` (dev: nối Google giả, app mẫu), `gia-google.yaml` (Google giả, chỉ dev) |
| `keycloak/apply/` | `@vc/realm-apply`: áp YAML vào Keycloak qua Admin API, áp lại được, có `--dry-run` |
| `keycloak/themes/vc/` | Theme đăng nhập tiếng Việt |
| `packages/contracts/` | `@vc/contracts`: mã lỗi và câu chuẩn, ngày giờ Việt Nam, schema zod, JSON Schema gửi đội app (GĐ B) |
| `api/` | VC Home API (GĐ B): NestJS 10 + MongoDB replica set, bộ chạy job, `GET /api/health` |
| `home/` | VC Home: React + antd + Vite + `oidc-client-ts`; `apps.yaml` sinh `catalog.json` (kiểm schema); `nginx/` và `Dockerfile` cho container |
| `provisioner/` | `vc-provisioner`: đối chiếu Google Directory với VC ID, cấp hoặc gỡ nhóm app, khoá theo Google, khoá khẩn cấp; `fixtures/` là Directory giả cho dev |
| `tools/app-mau/` | App mẫu theo hợp đồng tích hợp (thiết kế SSO mục 5.2); `src/oidc.ts` là phần đội app chép theo |
| `tools/e2e/` | Ca Playwright chạy với Keycloak local |
| `compose.yml` | Production: PostgreSQL, Keycloak, edge (nginx trước Keycloak), VC Home, vc-provisioner, sao lưu, cloudflared |
| `compose.dev.yml` | Máy dev có Docker: Keycloak + PostgreSQL ở cổng 8180 (thay `kc-local.sh`) |
| `compose.local.yml` | Chạy thử `compose.yml` trên máy dev (mở cổng localhost, không có cloudflared) |
| `keycloak/Dockerfile` | Keycloak ghim bản, build sẵn với PostgreSQL, health, metrics, theme `vc` |
| `edge/` | nginx trước Keycloak: `id.` chỉ mở `/realms/`, `/resources/` (không `/admin`, không realm `master`); `id-admin.` mở màn quản trị |
| `backup/` | Sao lưu `pg_dump` hằng đêm (14 bản ngày, 6 bản tháng, rclone ra ngoài máy), `restore.sh` khôi phục thử hoặc ghi đè |
| `config/` | `loai-tru.yaml`: danh sách loại trừ (I9) cho vc-provisioner |
| `scripts/` | `kc-local.sh` (Keycloak không cần Docker), `dev-env.sh`, `thu-production.sh` (kiểm cụm production trên máy dev), `vc-tool.sh` (điểm vào ảnh công cụ) |
| `docs/` | `so-phien.md`: **tiến độ và nhật ký từng phiên, đọc trước khi làm tiếp**; ghi chép thử nghiệm |

## 2. Chạy trên máy dev

Cần Node 22, pnpm 9, và Docker (hoặc Java 21 nếu không có Docker).

```bash
pnpm install
docker compose -f compose.dev.yml up -d   # Keycloak 26.7.5 + PostgreSQL ở http://localhost:8180, quản trị admin / admin-dev-only
# không có Docker: scripts/kc-local.sh &  (Keycloak chạy bằng Java, database tệp)
source scripts/dev-env.sh
pnpm realm:apply:dev           # tạo realm gia-google và vc
pnpm app-mau &                 # app mẫu ở http://localhost:4400 (đăng nhập bằng tài khoản Google giả)
pnpm home &                    # VC Home ở http://localhost:5173 (Vite, sửa code thấy ngay)
# GĐ B: compose.dev.yml đã có MongoDB và VC Home API ở http://localhost:3100/api/health
#       (chạy API từ mã nguồn: docker compose -f compose.dev.yml stop api && pnpm api)
pnpm e2e                       # chạy ca SSO-00, vc-provisioner, VC Home
```

## 3. Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `pnpm realm:apply --file ../realm/vc.yaml --dry-run` | Xem trước thay đổi trên một Keycloak (biến môi trường theo `.env.example`) |
| `pnpm realm:apply --file ../realm/vc.yaml --force-secrets` | Áp và gửi lại bí mật Google (khi xoay khoá) |
| `pnpm provisioner report` | Ai được vào app, nhóm theo trạng thái, và việc lượt đồng bộ sau sẽ làm (I9) |
| `pnpm provisioner sync` | Chạy thử một lượt đồng bộ (không đổi gì); thêm `--apply` để làm thật |
| `pnpm provisioner disable <email> --reason "…"` | Khoá khẩn cấp: khoá VC ID và đăng xuất khỏi mọi app |
| `pnpm provisioner enable <email>` | Gỡ khoá khẩn cấp; còn khoá theo Google thì vẫn khoá (thêm `--also-google` khi quản trị đã xác nhận) |
| `pnpm home:nginx` | Build VC Home và chạy bằng nginx với header như production (CSP) ở cổng 5173; `pnpm e2e` dùng luôn bản này. Dừng: `home/scripts/nginx-local.sh stop` |
| `pnpm job:run <tên>` | Chạy ngay một job của VC Home API (không tên: liệt kê); cần `pnpm --filter @vc/api build` trước |
| `pnpm ci:local` | Build `contracts`, kiểm kiểu, test đơn vị và test API (MongoDB trong bộ nhớ) |

## 4. Production

Chạy thử toàn bộ cụm production trên máy dev (giá trị giả, kiểm tiêu chí SSO-01): `scripts/thu-production.sh`, dọn bằng `scripts/thu-production.sh down`.

**Lên máy chủ I1** (thiết kế SSO mục 7):

1. Cài Docker; clone repo; `cp .env.example .env && chmod 600 .env`, điền bí mật (`openssl rand -base64 36`); `mkdir -m 700 secrets`, đặt `secrets/google-directory.json` (I4) và `secrets/rclone.conf` nếu lưu ngoài máy.
2. `docker compose up -d --build`, đợi `docker compose ps` báo `keycloak` healthy.
3. Áp cấu hình realm: `docker compose run --rm realm-apply realm-apply --file /app/keycloak/realm/vc.yaml --dry-run` để xem trước, rồi `docker compose run --rm realm-apply`.
4. Trên Cloudflare (I2): tunnel trỏ `id.` và `id-admin.` tới `http://edge:8080`, `home.` tới `http://home:8080`; đặt Cloudflare Access cho `id-admin.` (chỉ nhóm quản trị).
5. Client tạm `vc-bootstrap` chỉ dành cho máy, không đăng nhập màn quản trị được. Dùng nó với `docker compose exec keycloak /opt/keycloak/bin/kcadm.sh` để tạo 2 admin khẩn cấp ở realm `master` (I5), rồi họ đăng nhập `id-admin.` và bật TOTP. Sau đó tạo client máy `vc-realm-apply` thay `vc-bootstrap`, đổi `KC_ADMIN_CLIENT_ID`, `KC_ADMIN_CLIENT_SECRET` trong `.env`, xoá client tạm.
6. vc-provisioner chạy thử 1 tuần (`PROVISIONER_MODE` trống, chỉ ghi log); `docker compose run --rm provisioner provisioner report` gửi chủ dự án duyệt (I9); duyệt xong đặt `PROVISIONER_MODE=apply`, `docker compose up -d provisioner`.

**Sao lưu:** container `backup` chạy lúc 2 giờ sáng; tệp ở `backups/ngay`, `backups/thang`; mốc `backups/lan-cuoi-thanh-cong` cho giám sát (cảnh báo khi quá 26 giờ). Sao lưu ngay: `docker compose exec backup backup.sh`. Mỗi tháng khôi phục thử: `docker compose exec backup restore.sh /backups/ngay/<tệp>.dump` (khôi phục vào database tạm, đếm realm và user, xoá). Khôi phục thật: `docker compose stop keycloak`, `docker compose exec backup restore.sh <tệp> --ghi-de`, `docker compose start keycloak`.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.5 | 08/10/2026 16:17 | Claude Code (B-01) | Thêm `api/`, `packages/contracts/`; lệnh `pnpm api`, `pnpm job:run`; `ci:local` gồm test API | Kế hoạch GĐ B phiên B-01 |
| 0.4 | 08/10/2026 15:48 | Claude Code (SSO-01, SSO-02) | Thêm compose production, compose dev, Dockerfile Keycloak, edge, sao lưu và khôi phục, `scripts/thu-production.sh`; theme: trang lỗi sai domain có nút chọn tài khoản khác, trang đã đăng xuất có link về VC Home; realm chuyển thẳng sang Google | Thiết kế SSO mục 5.1.6, 5.7, 7 |
| 0.3 | 08/10/2026 15:27 | Claude Code (SSO-03) | Thêm VC Home, cấu hình nginx, Dockerfile; ca e2e VC Home; lệnh `pnpm home`, `pnpm home:nginx` | Thiết kế SSO mục 5.3; 06 VH-MH-01, 02, 03 |
| 0.2 | 08/10/2026 15:01 | Claude Code (SSO-04) | Thêm `vc-provisioner` và ca e2e của nó; lệnh `pnpm provisioner` | Thiết kế SSO mục 5.6; D-BA-37, 39, 40 |
| 0.1 | 08/10/2026 14:53 | Claude Code (SSO-00, SSO-02) | Tạo khung repo: cấu hình realm, công cụ áp, theme, Google giả, app mẫu, ca e2e SSO-00 | Kế hoạch code tổng quan; thiết kế SSO mục 6, 8 |
