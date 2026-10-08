# VClinks

Phiên bản 1.3 · 04/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- README cho dev: VClinks là nền tảng CSKH đa kênh (Zalo cá nhân, Zalo OA, Fanpage, Facebook cá nhân); đặc tả đầy đủ ở `CLAUDE.md`, tài liệu theo `TAI-LIEU.md`.
- **Nâng cấp database cũ** `vczalo`, `vcconnect`: API tự chuyển sang `vclinks` khi `vclinks` còn trống; Docker giữ volume cũ; extension và Dashboard tự chuyển khóa lưu trữ.
- Đang ở **Giai đoạn 1**: extension đọc Zalo Web, bảng ánh xạ có phiên bản và drift, MCP cho Claude, Dashboard đối chiếu đồng bộ.
- **Chạy local:** `bash start_web.sh` khi đã có MongoDB; hoặc Docker (cách A) / chạy dev (cách B); tạo token theo scope `dashboard`, `ingest`, `mcp`.
- **Kiểm thử:** `pnpm test`, `pnpm test:e2e`, `pnpm ci:local`, `pnpm seed:td`, `pnpm typecheck`.
- **Bảo mật GĐ1:** chặn store `e2ee_*`, token, cookie ở 3 tầng; token lưu băm; MongoDB Community không mã hóa at-rest nên cần ổ đã mã hóa; quick tunnel chỉ để thử.

## Mục lục

- [Nâng cấp database cũ (vczalo, vcconnect)](#nâng-cấp-database-cũ-vczalo-vcconnect)
- [Chạy local](#chạy-local)
- [Kiểm thử](#kiểm-thử)
- [Bảo mật (GĐ1)](#bảo-mật-gđ1)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

Nền tảng chăm sóc khách hàng đa kênh của VC Phồn Vinh: Zalo cá nhân, Zalo OA, Fanpage Facebook và Facebook cá nhân trong một hộp thư. **VC Zalo** là phân hệ kênh Zalo cá nhân của VClinks (extension + connector + màn hình sale Zalo). Database và khoá lưu trữ cũ mang tên `vczalo`, `vcconnect` được tự chuyển về `vclinks`. Đặc tả đầy đủ ở [CLAUDE.md](CLAUDE.md), hướng dẫn từng kênh ở [docs/04-ky-thuat/kenh/](docs/04-ky-thuat/kenh/).

## Nâng cấp database cũ (`vczalo`, `vcconnect`)

Dữ liệu cũ được giữ nguyên, không cần thao tác tay:

- **MongoDB:** lần đầu chạy, API tự chuyển mọi collection từ database cũ (`vcconnect`, nếu không có thì `vczalo`) sang `vclinks`, nhưng chỉ khi `vclinks` còn trống. Token cũ vẫn dùng được. Muốn tắt thì đặt `LEGACY_DB_NAMES=""`.
- **Docker:** volume vẫn giữ tên cũ `vczalo_*`, dữ liệu Mongo/MinIO không mất.
- **Extension:** build lại (`pnpm --filter @vclinks/extension build`) rồi bấm Reload trong `chrome://extensions`. Cài đặt API URL, token và trạng thái được tự chuyển sang khóa mới.
- **Dashboard:** token đăng nhập được tự chuyển sang khóa mới, không cần đăng nhập lại.
- Đặt thêm `CREDENTIALS_KEY` trong `.env` (`openssl rand -base64 32`) trước khi kết nối Zalo OA hoặc Fanpage.

Hiện đang ở **Giai đoạn 1**, gồm:

- VClinks Extension đọc IndexedDB của Zalo Web và đẩy về API.
- Bảng ánh xạ trường có đánh số phiên bản, kèm cơ chế phát hiện lệch cấu trúc (drift).
- MCP server cho Claude.
- Dashboard xem hội thoại và đối chiếu đồng bộ.

```
apps/api        NestJS: REST /api + MCP /mcp, MongoDB
apps/web        Dashboard React + Ant Design
apps/extension  Chrome MV3: IndexedDB Zalo Web → REST ingest
packages/shared zod schema, bảng ánh xạ, bộ lọc trường nhạy cảm (dùng chung)
docs/           tài liệu theo vòng đời 01…07 (xem docs/README.md)
```

## Chạy local

> **Tên database:** dữ liệu thật nằm trong `vclinks`. Từ 29/09/2026 dữ liệu được đồng bộ lại từ đầu; dữ liệu cũ của `vcconnect` giữ ở database `vclinkBackup`. Bản đang phục vụ ở `:3000` chạy `node apps/api/dist/main.js` (không `--watch`), xem `docs/06-van-hanh/chrome-driver.md`.

Cần Node 20+, pnpm 9 và Docker.

**Mở nhanh trên máy đã có MongoDB đang chạy:**

```bash
bash start_web.sh            # Dashboard ở http://localhost:5173
```

Script tự cài thư viện nếu thiếu, build gói dùng chung, dùng lại API ở `http://localhost:3000` hoặc build và khởi động API nếu chưa chạy. Mở địa chỉ `Local` được in trong Terminal; nếu cổng `5173` đã dùng, Dashboard tự chọn cổng kế tiếp. Giữ Terminal mở; `Ctrl+C` dừng Dashboard và API do script khởi động. Không cần kích hoạt Python `.venv` hay Docker khi MongoDB đã chạy trực tiếp trên máy.

API mặc định dùng `mongodb://localhost:27017/vclinks`; có thể đổi bằng biến môi trường `MONGO_URI`. Đặt `VCLINKS_API` để dùng một API khác đã chạy. Script nhận các biến môi trường đã export, không tự nạp `.env` dành cho Docker.

**Cài và chạy từng thành phần hoặc chạy cả bộ bằng Docker:**

```bash
pnpm install
cp .env.example .env         # đổi MINIO_ROOT_PASSWORD, MINIO_KMS_SECRET_KEY
pnpm build

# Cách A: tất cả trong Docker. Dashboard ở http://localhost:8080
docker compose up -d
docker compose --profile tunnel up -d            # thêm URL HTTPS công khai (Cloudflare quick tunnel)
docker compose logs tunnel | grep trycloudflare  # lấy URL

# Cách B: chạy dev
pnpm infra:up                # mongo, redis, minio
MONGO_URI=mongodb://localhost:27017/vclinks CORS_ORIGINS=http://localhost:5173 pnpm dev:api
pnpm dev:web                 # http://localhost:5173
```

Đăng nhập Google khi chạy dev (cách B, hoặc `start_web.sh`): API chạy trên máy **không tự đọc `.env`** (file đó viết cho Docker), nên phải nạp các khóa đăng nhập trước khi bật API. Không nạp cả file, vì `MONGO_URI`, `REDIS_URL` trong đó trỏ tới tên máy Docker. Thiếu khóa Google thì màn đăng nhập chỉ còn ô token.

```bash
set -a; eval "$(grep -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|SEED_ADMIN_EMAIL|AUTH_BASE_URL|AUTH_WEB_URL|CORS_ORIGINS|TZ)=' .env)"; set +a
pnpm dev:api
```

`AUTH_BASE_URL` phải là địa chỉ API (`http://localhost:3000`), và Google Cloud Console phải có redirect URI `http://localhost:3000/api/auth/google/callback`; thiếu thì Google báo `redirect_uri_mismatch`. Sau mỗi lần gộp vào `main`, chạy `pnpm install --frozen-lockfile && pnpm --filter "./packages/*" build` trước khi bật API.

Tạo token. Token chỉ hiện một lần. Với cách A, chạy lệnh trong container: `docker compose exec api node dist/scripts/create-token.js ...`.

```bash
MONGO_URI=mongodb://localhost:27017/vclinks pnpm token:create --name "Thọ Anh" --scopes dashboard
MONGO_URI=mongodb://localhost:27017/vclinks pnpm token:create --name "Chrome văn phòng" --scopes ingest
MONGO_URI=mongodb://localhost:27017/vclinks pnpm token:create --name "Claude" --scopes mcp
MONGO_URI=mongodb://localhost:27017/vclinks pnpm token:create --revoke "Chrome văn phòng"
```

Cài extension theo [apps/extension/README.md](apps/extension/README.md): build, bật "Load unpacked" với thư mục `apps/extension/build`, rồi nhập URL API và token `ingest`.

Hoặc chạy extension trong **Chrome driver** riêng (Chrome for Testing, profile riêng, Claude điều khiển được qua CDP): `pnpm driver`. Đây là cách chạy mặc định trên máy chủ dự án, xem [docs/06-van-hanh/chrome-driver.md](docs/06-van-hanh/chrome-driver.md).

Kết nối Claude theo [docs/04-ky-thuat/api/mcp-client-guide.md](docs/04-ky-thuat/api/mcp-client-guide.md).

## Kiểm thử

```bash
pnpm test        # unit test: shared (schema, chặn trường nhạy cảm), extension (reader/sync)
pnpm typecheck
pnpm test:e2e    # e2e của API (REST + MCP → Dashboard) trên MongoDB thật
pnpm ci:local    # = typecheck && test && test:e2e — chạy trước khi báo xong phiên
pnpm seed:td     # nạp bộ dữ liệu kiểm thử TD, chạy lại không sinh trùng
```

**e2e (`apps/api/test/`):** các file `*.e2e-spec.ts` chạy API thật trên cổng ngẫu nhiên (không đụng cổng 3000). Ca mới nên dùng `startE2EApp()` ở `apps/api/test/e2e/helpers.ts`: nó nối MongoDB thật (mặc định `mongodb://localhost:27017`, đổi bằng `E2E_MONGO_URL`), tạo database tạm `vclinks_test_<mã>` và xóa khi xong, không bao giờ chạm database `vclinks`. Ca mẫu: `apps/api/test/e2e/ingest-to-conversation.e2e-spec.ts`. Các ca cũ dùng MongoDB trong bộ nhớ, vẫn chạy trong `pnpm test:e2e`.

**Seed (`tools/seed/`):** `pnpm seed:td` nạp dữ liệu TD ([du-lieu-kiem-thu.md](docs/05-kiem-thu/du-lieu-kiem-thu.md)) qua chính API ingest (cùng schema zod, không ghi thẳng Mongo), mọi bản ghi gắn `raw.seed = "TD"`.
- Mặc định ghi vào database `vclinks_td` (không lẫn dữ liệu thật); đổi bằng `MONGO_URI`. Mốc T đổi bằng `SEED_T` (mặc định `2026-10-06T10:00+07:00`).
- Đợt đầu (M1-00): 7 nick Zalo giả TD-NK02…08, 3 khách, 3 hội thoại, 12 tin mẫu. Nick TD-NK01 là nick thật, không seed. Không seed token, cookie hay khóa.
- Phiên sau thêm dữ liệu: tạo `tools/seed/data/<tên>.js` (hàm nhận T, trả `{ accounts, perAccount }`); file được tự nạp, không sửa file dùng chung.
- `pnpm seed:td --clean` xóa dữ liệu seed (tài khoản theo uid giả; liên hệ, hội thoại, tin chỉ khi có cờ `raw.seed="TD"`), không đụng nick thật.

## Bảo mật (GĐ1)

- Extension chỉ mở các store có trong bảng ánh xạ. Store `e2ee_*`, token, cookie bị chặn ở cả 3 tầng: extension, schema và API.
- Token API chỉ lưu dạng băm sha256 và có thể thu hồi.
- Log không chứa nội dung tin nhắn.
- MinIO tự mã hóa object (SSE-KMS).
- **MongoDB Community không có mã hóa at-rest.** Cần đặt volume trên ổ đã mã hóa (FileVault, LUKS, hoặc disk encryption của cloud), hoặc dùng MongoDB Enterprise/Atlas khi triển khai thật.
- Quick tunnel của Cloudflare chỉ dùng để thử nghiệm. Khi chạy thật, dùng named tunnel với domain riêng, có thể thêm Cloudflare Access.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.3 | 04/10/2026 21:09 | Claude Code · chẩn đoán sự cố | Chạy local: cách nạp khóa Google khi chạy API trên máy, `AUTH_BASE_URL` cổng 3000, redirect URI, cài và build sau gộp | Chủ dự án đồng ý Q1, Q2 04/10/2026 |
| 1.2 | 04/10/2026 15:12 | Claude Code (M1-00) | Mục Kiểm thử: thêm `pnpm test:e2e`, `pnpm ci:local`, `pnpm seed:td`, cách viết ca e2e và thêm dữ liệu seed | `docs/01-quan-ly-du-an/m1/ke-hoach-phien-chat.md` M1-00 |
| 1.1 | 04/10/2026 13:43 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm dòng trạng thái, Tóm tắt, Mục lục | `docs/01-quan-ly-du-an/hoi-to-tai-lieu-md.md` |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 28/09/2026 | — | Bản gốc (xem `git log --follow -- README.md`) | — |
