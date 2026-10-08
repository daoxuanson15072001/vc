# Sổ phiên vc-platform

Phiên bản 0.4 · 08/10/2026 · Trạng thái: Xong B-01…B-03; tiếp theo B-04

## Tóm tắt

- **Sổ này để làm gì:** ghi vết từng phiên code của `vc-platform`: đã làm gì, kiểm thế nào, commit nào, còn gì. Mở phiên mới thì đọc mục 1 và mục 4 trước. Mỗi phiên xong thêm một dòng ở mục 2 (kế hoạch GĐ B mục 9 yêu cầu).
- **Đã xong:** phần GĐ A nằm trong repo này (SSO-00…04), chạy với thông số giả lập: Google giả, Directory giả, bí mật giả. Kiểm: 32 ca e2e, 34 test đơn vị, 16 bước kiểm cụm production. Tài liệu thiết kế đã khớp code (D-BA-49…54).
- **GĐ B đã xong:** **B-01** khung VC Home API: NestJS 10 + MongoDB replica set, `packages/contracts`, bộ chạy job, migration, `/api/health`, `compose.dev.yml` có `mongo` và `api`, nginx `/api/`.
- **B-02 xong:** API kiểm token VC ID, `Viewer` với vai trò từ `resource_access.vchome.roles`, `@Can` theo ma trận 02 mục 3 (184 ca test), nhật ký chỉ thêm (băm, niêm phong ngày, job kiểm chuỗi, tài khoản MongoDB không sửa được nhật ký), client `vc-home-api`, script áp vai trò `vchome`.
- **B-03 xong:** lõi thay đổi có ngày hiệu lực: lưu hẹn ngày hoặc áp ngay, job áp lúc 00:00 giờ Việt Nam, cả nhóm áp hết hoặc không áp gì, hỏi khi mâu thuẫn với thay đổi đang hẹn, thay đổi từ 21 người cần quản trị thứ hai xác nhận; cài đặt hệ thống (`system_settings`, `pnpm settings:set`). Chưa có loại thay đổi thật: các phiên sau đăng ký vào lõi này.
- **Tiếp theo:** **B-04** danh mục, rồi B-05…B-07 (cây đơn vị, hồ sơ, vị trí). Những phiên này không cần đầu vào thật.
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
| B-01 Khung repo, API, MongoDB | Xong | Chưa có lint (ESLint): để phiên sau, `ci:local` hiện là kiểm kiểu + test |
| B-02 Xác thực, `Viewer`, `@Can`, nhật ký | Xong | Người giữ vai trò thật (N3) chưa có: `keycloak/vchome-roles.yaml` đang rỗng |
| B-03 Lõi thay đổi có ngày hiệu lực | Xong | Loại thay đổi thật đăng ký ở B-04…B-09; màn hình hàng chờ xác nhận ở phiên màn quản trị |
| B-04 Danh mục | **Tiếp theo** | |
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
| 08/10/2026 | B-03 | `@vc/contracts/settings.ts` (11 cài đặt, giới hạn, chỉ đọc, câu gợi ý giá trị); `SettingsService` (đọc có cache 30 giây, sửa cần lý do ≥ 10 ký tự, ghi `setting.update` cùng giao dịch), migration `B0003_settings`, `pnpm settings:set`; `common/changes.ts`: giao diện `ChangeHandler` (quyền, schema, khoá mâu thuẫn, kiểm, số người bị ảnh hưởng, áp) và điểm móc sau khi áp; `ChangeService`: gửi (kiểm ngày, quyền theo loại, cảnh báo quá 30 ngày, mâu thuẫn → 409 `hen_xung_dot` câu 06 mục 1.5, `replace_ids` huỷ thay đổi cũ cùng giao dịch, kiểm theo trạng thái tại ngày hiệu lực kể cả thay đổi đang hẹn), áp ngay khi ngày ≤ hôm nay, job `scheduled-changes.apply` mỗi phút (cơ cấu trước người, mỗi nhóm một giao dịch, lỗi → cả nhóm `loi` + cảnh báo #9, chờ quá 15 phút → cảnh báo #9), huỷ, xác nhận và từ chối (VH-BR-25: người gửi không tự xác nhận; lệch > 20% phải xem lại); API `v1/admin/scheduled-changes` | 250 test API (thêm 16): hẹn 01/12 chưa áp lúc 23:59 30/11, đã áp lúc 00:01 01/12; 2 job song song áp 1 lần; lỗi giữa nhóm không để lại gì, cả nhóm `loi`, có cảnh báo; 409 đúng câu, thay thì huỷ cũ; đơn vị tạo cùng ngày áp trước người; 25 người chờ xác nhận, người gửi bị 403, HC-NS bị 403, người khác xác nhận thì áp; lệch 25 → 17 người phải xem lại, lệch sau khi xác nhận thì job đưa về chờ xác nhận; ngưỡng đọc từ cài đặt; huỷ cần quyền theo loại; cài đặt chỉ đọc, ngoài giới hạn, lý do ngắn bị từ chối. `settings:set` chạy thật trên mongod; API dev chạy B0003; e2e 36/36 | (commit này) | Loại thay đổi thật (B-04…B-09); thử lại nhóm `loi` chưa có (huỷ rồi gửi lại) |
| 08/10/2026 | B-02 | `@vc/contracts/permissions.ts` (23 quyền × 8 vai trò, tách nhiệm); API: `TokenVerifier` (`jose`, JWKS, `iss`, `aud` `vchome-api`, lệch 60 giây, từ chối id_token), `ViewerService` (vai trò gán từ token, `hcns@<mã>`, bỏ cặp cấm, gắn hồ sơ qua `accounts` cache 60 giây, điểm móc vai trò suy ra), guard toàn cục `@Public`/`@Can`, `GET /api/v1/me`; `AuditService.record(tx)` (hash, `ip_prefix`, `effective_on`, `source`, `expires_at`), chỉ mục TTL, job `audit.daily-seal` 00:10 và `audit.verify-chain` 00:20 có cảnh báo khẩn; vai trò MongoDB `vchome_api_rw` (B0002) và đăng nhập migration riêng `MONGO_MIGRATE_URL`; client Admin API Keycloak; `vc.yaml`: vai trò và audience `vchome-api` cho `vchome`, client `vc-home-api`; `keycloak/vchome-roles.yaml` + bản dev, script `apply-vchome-roles` (`--check` cho CI) | 234 test API: token sai chữ ký, sai `aud`, hết hạn, id_token → 401; ma trận 184 ca mọi ô "—" → 403; ghi nhật ký lỗi thì thay đổi không lưu; sửa hoặc xoá tay dòng nhật ký thì job kiểm báo lệch; `vchome_api` không `update`, `remove` được `audit_log` (MongoDB có bật xác thực); tệp vai trò có cặp cấm thì đỏ. E2E với Keycloak thật: token của VC Home gọi API qua nginx, đúng vai trò `qtht`, `hcns@VCPARTS` (4 ca); toàn bộ e2e 36/36 | `d3bc0ce` | Vai trò thật (N3); xem nhật ký trên màn ở B-19 |
| 08/10/2026 | B-01 | `packages/contracts` (mã lỗi + câu 06 mục 1.4, ngày giờ VN, JSON Schema cho app, build CJS và ESM); `api/` NestJS 10: cấu hình zod + cờ `FEATURE_*`, `Clock` thật và giả (giả bị chặn ở production), `todayOn`, con trỏ, `withTx` thử lại lỗi tạm, `updateByRev`, hai dạng lỗi, `X-Correlation-Id`, giới hạn thân, migration `B0001_indexes`, bộ chạy job `_job_locks` + `pnpm job:run`, `GET /api/health`; `compose.dev.yml` thêm `mongo` rs0 và `api`; nginx `/api/`; Dockerfile API | 28 test API (Jest, MongoDB replica set trong bộ nhớ): `todayOn` ở 16:59:59Z và 17:00:00Z, migration chạy 2 lần và 2 tiến trình cùng lúc, 2 tiến trình cùng tick job chạy đúng 1 lần; `compose.dev.yml` lên, `/api/health` 200 có `rs0`; qua nginx 200; e2e GĐ A vẫn 32/32 | `1142cb9` | Lint |
| 08/10/2026 | Tài liệu | Ghi quyết định phát sinh khi code GĐ A vào 12 (D-BA-49…54); thiết kế SSO lên 0.6; bỏ mọi chỗ nhắc `keycloak-config-cli` | — | `c1ba2c7` | — |
| 08/10/2026 | SSO-01, SSO-02 | `compose.yml` (PostgreSQL, Keycloak, edge, VC Home, provisioner, realm-apply, backup, cloudflared), `compose.dev.yml`, Dockerfile Keycloak, nginx edge chặn `/admin` và realm `master`, sao lưu 14 + 6 bản, `restore.sh`; theme: trang lỗi sai domain, trang đã đăng xuất; realm chuyển thẳng sang Google | `scripts/thu-production.sh` 16/16 từ con số 0; e2e 32/32 trên `compose.dev.yml` | `3ccf1fb` | Lên máy thật (SSO-10) |
| 08/10/2026 | SSO-03 | VC Home: trang chào, lưới app, ghim, hồ sơ, đã đăng xuất, trang lỗi, câu theo `vc_trang_thai`; phiên chỉ gia hạn khi có thao tác; nginx có CSP; Dockerfile | 14 ca e2e qua nginx, 0 vi phạm CSP, axe; Lighthouse truy cập 100 | `98babfe` | — |
| 08/10/2026 | SSO-04 | `vc-provisioner`: sync, loop, report, disable, enable; quy tắc thuần, an toàn khi Google trả danh sách bất thường | 9 test đơn vị; e2e UAT-SSO-09, 10, 21, 22, 23 | `d93b2e4` | Directory thật (I4) |
| 08/10/2026 | SSO-00, SSO-02 | Keycloak 26.7.5 không cần Docker, realm dạng code, công cụ `@vc/realm-apply`, Google giả, theme tiếng Việt, app mẫu theo hợp đồng mục 5.2 | 10 ca e2e SSO-00; 13 test app mẫu | `819f2fa` | 4 điểm cần Google thật |

### 2.1 Quyết định trong phiên (chưa có ở kế hoạch)

| Phiên | Quyết định | Vì sao |
|---|---|---|
| B-01 | Test API dùng Jest + `@swc/jest` (giữ metadata decorator cho NestJS); các gói khác giữ `node:test` | `tsx`/esbuild không sinh metadata decorator, NestJS cần để tiêm phụ thuộc |
| B-01 | `@vc/contracts` build ra cả CommonJS (API) và ESM (SPA, công cụ) | API NestJS chạy CommonJS; Vite và `tsx` dùng ESM |
| B-01 | Chỉ mục được tạo ở mọi lần khởi động (ngoài `B0001_indexes`) | Phiên sau thêm chỉ mục vẫn được tạo trên máy đã chạy B0001 |
| B-01 | Job chạy đúng một lần mỗi lượt lịch; máy tắt lúc đến giờ thì chạy bù khi bật, job biết lượt của ngày nào; lỗi thì thử lại sau 5 phút | Kế hoạch mục 6.1 yêu cầu chạy lại ra cùng kết quả; tránh chạy lặp mỗi lượt kiểm khi lỗi |
| B-01 | `compose.dev.yml`: `mongo` và `api` dùng mạng của máy như Keycloak | API lấy JWKS ở `localhost:8180`; thành viên replica set là `127.0.0.1:27017` dùng được từ máy dev |
| B-01 | nginx `/api/` trỏ tới upstream đặt bằng biến | nginx vẫn khởi động được khi production chưa có container `api` (B-16) |
| B-02 | Vai trò MongoDB của API đồng bộ bằng cấp thiếu và thu thừa (`grantPrivilegesToRole`, `revokePrivilegesFromRole`), không dùng `updateRole` | Đăng nhập migration có `userAdmin` không được `updateRole` (thử thực tế); lỡ cấp quyền sửa nhật ký thì lần khởi động sau thu lại |
| B-02 | Script áp vai trò `vchome` đăng nhập Admin API bằng tài khoản công cụ `KC_TOOL_*` (quản trị realm `master`), không bằng `vc-home-api` | Tạo vai trò `hcns@<mã>` cần `manage-clients`; kế hoạch chỉ cho `vc-home-api` quyền này từ GĐ C |
| B-02 | Client `vchome` thêm scope `roles` | Không có scope này thì access token không có `resource_access.vchome.roles` |
| B-02 | Mã lỗi mới `idp_unreachable` (503) khi không lấy được khoá của VC ID | Phân biệt "VC ID không trả lời" với "token sai" (401) |
| B-02 | `OIDC_ISSUER` bắt buộc khi `APP_ENV` là `staging` hoặc `production` | Thiếu thì mọi route trả 401; nên chặn ngay lúc khởi động |
| B-03 | Thay đổi chờ xác nhận lần hai nằm ngay trong `scheduled_changes` với trạng thái `cho_xac_nhan` (thêm vào `cho_ap`, `da_ap`, `da_huy`, `loi`) | Cùng kiểm mâu thuẫn, cùng huỷ, cùng nhật ký; không cần bảng thứ hai |
| B-03 | Mâu thuẫn = có thay đổi đang chờ (`cho_ap` hoặc `cho_xac_nhan`) cùng khoá, bất kể ngày. Khoá do từng loại thay đổi định | Loại cần nhiều thay đổi nối tiếp trên cùng hồ sơ (nghỉ dài ngày rồi nghỉ việc, 04 VH-LCM) phải chọn khoá hẹp hơn ở phiên của nó (B-06/B-09) |
| B-03 | Lệch > 20% phát hiện lúc job áp: nhóm quay về `cho_xac_nhan` (nhật ký `scheduled_change.reconfirm`), không chuyển `loi` | VH-BR-25 yêu cầu xác nhận lại, không phải lỗi |
| B-03 | Dòng nhật ký do job áp ghi người làm là hệ thống, kèm `on_behalf_of_person_id` là người gửi | Biết ai quyết định thay đổi dù job áp lúc 00:00 |
| B-03 | Cảnh báo "chờ quá 15 phút" kiểm trước khi áp | Sau khi máy dừng, lần chạy lại áp bù ngay; kiểm sau khi áp thì không bao giờ thấy dòng trễ |
| B-03 | Mỗi cài đặt có `hint` tiếng Việt cho câu lỗi | Câu lỗi của zod là tiếng Anh |

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
pnpm e2e                                       # 36 ca
pnpm ci:local                                  # build contracts, kiểm kiểu, test đơn vị + test API (cần MongoDB, xem ghi chú)
curl localhost:3100/api/health                 # VC Home API (compose.dev.yml có mongo + api)
docker compose -f compose.dev.yml up -d --build api   # sau khi sửa code API: dựng lại container api (chạy migration mới)
scripts/thu-production.sh                      # dựng cụm production thử, 16 bước kiểm; dọn: scripts/thu-production.sh down
```

Ghi chú riêng môi trường cloud này (không đưa vào code):

- quay.io bị chặn: dùng `KEYCLOAK_IMAGE=keycloak/keycloak:26.7.5` (cùng nhà phát hành).
- Container ra mạng qua proxy giải mã TLS: build ảnh Node với `NODE_IMAGE` là bản `node:22-alpine` có CA của proxy (`/root/.ccr/ca-bundle.crt`, biến `NODE_EXTRA_CA_CERTS`). Kho gói Alpine không ra được, nên Dockerfile không dùng `apk add`.
- Maven Central bị giới hạn: `scripts/kc-local.sh` tải Keycloak từ bản sao của Google.
- `mongodb-memory-server` không tải được mongod (fastdl.mongodb.org bị chặn): lấy mongod từ ảnh `mongo:7` (`docker create mongo:7`, `docker cp <id>:/usr/bin/mongod .`) rồi đặt `MONGOMS_SYSTEM_BINARY=<đường dẫn>` trước `pnpm ci:local`. Máy dev bình thường tự tải.
- Docker daemon có thể không tự chạy: `dockerd &` (chạy nền tối đa 2 giờ trong môi trường này).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.4 | 08/10/2026 16:48 | Claude Code (B-03) | Ghi B-03 xong, các quyết định trong phiên; điền commit B-02; lệnh dựng lại container API | Phiên B-03 |
| 0.3 | 08/10/2026 16:33 | Claude Code (B-02) | Ghi B-02 xong và các quyết định trong phiên | Phiên B-02 |
| 0.2 | 08/10/2026 16:17 | Claude Code (B-01) | Ghi B-01 xong; thêm mục 2.1 quyết định trong phiên; ghi chú môi trường cho MongoDB và Docker | Phiên B-01 |
| 0.1 | 08/10/2026 16:02 | Claude Code | Tạo sổ: tiến độ GĐ A, GĐ B; nhật ký 5 phiên đã làm; phần giả lập; cách tiếp tục | Người dùng yêu cầu lưu vết tiến độ trước khi làm tiếp |
