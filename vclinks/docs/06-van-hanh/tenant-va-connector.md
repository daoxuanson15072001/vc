# Tenant, nhật ký sự kiện và tiến trình connector

Phiên bản 0.1 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Từ phiên M1b-01, **mọi bản ghi có `tenant_id`** (BA §2.2 #10). Dữ liệu hiện có thuộc tenant mặc định `vcpv`. Mỗi token mang tenant của nó; API chỉ đọc và ghi dữ liệu của tenant đó.
- **Dữ liệu cũ chưa có `tenant_id` sẽ bị ẩn** cho tới khi chạy migration. API ghi lỗi `... have no tenant_id ... run the migrate-tenant script` khi khởi động trên database chưa migrate.
- **Migration** `pnpm --filter @vclinks/api migrate:tenant`: chỉ chạy trên bản sao `vclinks_copy_*`; chạy trên `vclinks` thật phải thêm `--allow-real` và **chỉ khi chủ dự án quyết** (CLAUDE.md §15.3).
- Đã thử trên bản sao `vclinks_copy_20261004` (04/10/2026): 24 collection, 16.816 bản ghi trước = sau, gắn `tenant_id` cho 15.127 bản ghi, chạy lại không đổi gì. Bản sao đã xóa.
- **Nhật ký sự kiện** `events`: chỉ ghi thêm. Đọc theo đối tượng: `GET /api/events?kind=account&id=<uid>`. Module khác ghi bằng `EventsService.append()`.
- **Tiến trình connector** (`node dist/connector.js`, cổng 3001): nhận ingest từ extension, webhook kênh API và giao outbox; chạy được khi web/Dashboard tắt.
- **Người duyệt cần xem kỹ:** mục [Chạy migration trên database thật](#chạy-migration-trên-database-thật): sau khi gộp nhánh vào `main`, API trên `vclinks` thật sẽ không thấy dữ liệu cũ cho tới khi migrate.

## Mục lục

- [Tenant](#tenant)
- [Chạy migration trên database thật](#chạy-migration-trên-database-thật)
- [Nhật ký sự kiện](#nhật-ký-sự-kiện)
- [Tiến trình connector](#tiến-trình-connector)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## Tenant

- Tenant của một request lấy từ token (`api_tokens.tenant_id`; token cũ không có trường này thì là `vcpv`). Tạo token cho tenant khác: `pnpm token:create --name ... --scopes ... --tenant <mã>`.
- Code đọc ghi qua `DbService.col()`: mọi truy vấn tự thêm điều kiện `tenant_id`, mọi bản ghi mới tự gắn `tenant_id` (`apps/api/src/db/tenant-collection.ts`).
- Collection dùng chung mọi tenant: `api_tokens`, `field_mappings`, `dev_requests`, trạng thái OAuth một lần, `media.files` / `media.chunks`.
- Việc chạy nền (gửi outbox kênh API, làm mới token Zalo OA) lặp qua từng tenant. Webhook công khai lấy tenant theo tài khoản kênh nhận tin.
- Hai tenant không thể cùng giữ một `uid`: đăng ký trùng trả lỗi 409.

## Chạy migration trên database thật

Chỉ làm khi chủ dự án đồng ý. Các bước:

1. Sao lưu: `mongodump --db vclinks --archive=vclinks-truoc-tenant.archive`.
2. Chạy thử, không ghi: `node apps/api/dist/scripts/migrate-tenant.js --db vclinks --allow-real --dry-run`.
3. Chạy thật: bỏ `--dry-run`. Script in bảng số bản ghi trước / sau từng collection; lệch là báo lỗi (mã thoát 2).
4. Khởi động lại API, mở Dashboard và kiểm tra hội thoại hiện đủ.

| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Gộp code vào `main` mà chưa migrate: Dashboard và extension thấy rỗng, ingest bị lỗi trùng khóa | Cao | Migrate ngay khi gộp, trước khi khởi động lại API |
| Migration dừng giữa chừng | Thấp | Chạy lại được: bản ghi đã có `tenant_id` thì bỏ qua |
| Cần quay lại bản cũ | Thấp | Code cũ bỏ qua trường `tenant_id`, không cần gỡ; hoặc khôi phục từ bản sao lưu bước 1 |

## Nhật ký sự kiện

- Collection `events`: `{ tenant_id, type, subject: { kind, id }, actor, at, data }`. Không có API sửa hay xóa.
- Đang ghi: `ingest.batch` (theo tài khoản, chỉ khi có thay đổi), mọi hành động audit (`outbox.*`, `token.*`, `mapping.*`, `account.*`, `drift.*`), `db.migrate_tenant`.
- `data` chỉ chứa mã và số đếm, không chứa nội dung tin (CLAUDE.md §12.3).
- Đọc: `GET /api/events?kind=<loại>&id=<mã>&type=&before=<ISO>&limit=` (quyền dashboard, tối đa 200 dòng).

## Tiến trình connector

- Chạy riêng: `pnpm --filter @vclinks/api build` rồi `CONNECTOR_PORT=3001 node apps/api/dist/connector.js` (`pnpm --filter @vclinks/api start:connector`).
- Web chạy kèm thì đặt `VCLINKS_ROLE=web` cho tiến trình web, để chỉ connector gửi outbox kênh API và làm mới token Zalo OA (tránh làm hai lần).
- Chạy một tiến trình như trước (`node dist/main.js`) vẫn đủ mọi chức năng.
- Extension và webhook phải trỏ vào cổng của connector thì mới không phụ thuộc web. Việc đổi địa chỉ này làm khi triển khai (chưa làm trong M1b-01).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 04/10/2026 15:37 | Claude Code · M1b-01 | Tạo tài liệu: tenant, migration, nhật ký sự kiện, connector | Kế hoạch M1 §5 M1b-01; chủ dự án trả lời Q1–Q3 ngày 04/10/2026 |
