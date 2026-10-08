# Mô hình khách và nạp danh mục VCsales

Phiên bản 0.2 · 07/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Thêm mô hình khách ba cấp theo đặc tả 02 §4, §9: **account (tổ chức khách) → người liên hệ → danh tính kênh**. Danh tính kênh là bản ghi `contacts` đã có (`_id = ${uid}:${userId}`), giữ nguyên khóa và tin nhắn.
- 7 collection mới: `customer_accounts`, `customer_contacts`, `contact_points`, `identity_links`, `erp_customers`, `merge_suggestions`, `merge_operations`.
- **VCsales:** từ 07/10/2026 máy 129 đọc VCsales thật qua `vclinks-bridge` (`VCSALE_MODE=http`); bản mock (mã `KH-TEST-xxxx`) chỉ dùng cho test tự động. Dữ liệu ERP vẫn đi qua bản chụp `erp_customers`, không đổi schema.
- **Người phụ trách VCsales ↔ người dùng VClinks** ghép theo email; màn Quản trị → Cài đặt → **Kết nối VCsales** cho thấy ai đã ghép, ai chưa và cách sửa (mục 4).
- **Tự gộp chỉ khi đủ 3 điều kiện D8-05:** trùng SĐT / email / mã KH đã xác thực (T2 V2↔V1 tính khi cùng người phụ trách, QĐ-57 mặc định A), một phía là danh tính mới (≤ 72 giờ, chưa mã KH, < 20 tin), hai phía cùng người phụ trách (owner hoặc người giữ nick) hoặc phía mới chưa ai phụ trách; không bị chặn theo DK-08. Còn lại là gợi ý.
- **Hoàn tác một chạm** trong 30 ngày, trả đúng trạng thái trước và khóa cặp không tự gộp lại.
- **Migration** `migrate:customers`: chỉ chạy trên bản sao, chạy lại không trùng, đếm nguồn trước = sau, `--undo <runId>` xóa đúng bản ghi của lượt.
- Owner khách nối vào engine quyền: `AuthzService.conversationTarget` điền `responsibleIds` (phạm vi CT); `customerScope` lọc danh sách khách trong truy vấn.
- **Người duyệt cần xem kỹ:** §5 (luật D8-05 chặt hơn §4.5 ở điều kiện 3), §7 (ma trận cho GĐ `cust.erp_link` DV nhưng D8-17 chỉ cho xem: đang làm theo D8-17), §8 việc còn mở.

## Mục lục

- [1. Collection và trường](#1-collection-và-trường)
- [2. Giao tiếp với phiên khác](#2-giao-tiếp-với-phiên-khác)
- [3. VCsales client](#3-vcsales-client)
- [4. Nạp danh mục và owner lần đầu](#4-nạp-danh-mục-và-owner-lần-đầu)
- [5. Quy tắc gộp](#5-quy-tắc-gộp)
- [6. Migration và cách lùi](#6-migration-và-cách-lùi)
- [7. API và quyền](#7-api-và-quyền)
- [8. Việc còn mở](#8-việc-còn-mở)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Collection và trường

Mọi collection đều theo tenant (`tenant_id`). Khai báo kiểu: `apps/api/src/customers/customers.types.ts`; kiểu dùng chung: `packages/shared/src/customers.ts`.

| Collection | Khóa | Trường chính |
|---|---|---|
| `customer_accounts` | `ca_<hash>` | `name, type, region, status (active/merged), mergedInto, owners[{division, userId, since, source}], erpLinks[{erp, customerId, status, confirmedBy, confirmedAt}], createdFrom, erasedAt?, erasedBy?` |
| `customer_contacts` | `cc_<hash>` | `accountId, name, orgRole, status, mergedInto, mergeLocks[], gender, isInternal, erasedAt?, erasedBy?` |
| `contact_points` | `cp_<hash>` | `contactId (null = cấp account), accountId, kind (phone/email), value (đã chuẩn hóa), level V0–V3, state (active/retired/shared_account/shared_many/unverified), source, lastActivityAt` |
| `identity_links` | `= contacts._id` | `identityId, uid, userId, channel, contactId, accountId, state (new/auto/confirmed/unconfirmed), linkedBy, linkedAt, firstSeenAt, mergeOpId` |
| `erp_customers` | `vcsales:<mã KH>` | Bản chụp chỉ đọc: `name, phones, emails, taxCode, address, region, salespersonEmail, status, mergedInto, ownerMismatch, raw, hash, fetchedAt` |
| `merge_suggestions` | `ms_<hash cặp>` | `a, b {contactId, accountId}, score, signals[], blocks[], priority, cleanup, status, reviewedBy, reason` |
| `merge_operations` | `mo_<uuid>` | `op (auto_merge/merge/undo/erp_link/import), actor, target, source, signals, before{links, points, contacts, accounts}, undoUntil, undoneAt` |

Khóa sinh từ nguồn (danh tính, mã KH): chạy lại không sinh trùng. Bản ghi `_id` của danh tính, của `contacts` và tin nhắn **không bao giờ đổi** khi gộp / tách.

## 2. Giao tiếp với phiên khác

- **M1b-14 (khóa theo danh tính):** token `SUBJECT_RESOLVER` được cung cấp bởi `CustomerLinksService` (`identityIdsOfAccount`, `accountOfIdentity`). M1b-14 tự ghi `erasedAt` / `erasedBy`; quy tắc gộp bỏ qua hồ sơ đã xóa.
- **M1b-09 (hộp thư "khách của tôi"):** token `CUSTOMER_OWNERSHIP` cũng do `CustomerLinksService` cung cấp (`conversationIdsOf(userId)` = hội thoại 1-1 của khách mình làm owner).
- **M1b-13 (Customer 360):** dùng `GET /api/customers/:id`, `GET /api/customers/by-identity/:uid/:userId`.
- Export shared mới: `identityIdOf`, `splitIdentityId`, `normalizePhone`, `normalizeEmail`, `VERIFY_LEVELS`, `CONTACT_POINT_STATES`, `IDENTITY_LINK_STATES`, `ORG_ROLES`, `ERP_SYSTEMS`, `MERGE_SIGNALS`, `MERGE_BLOCKS`, các kiểu `Customer*`, `ErpMatching*`, `MergeSuggestionView`; `CONTACT_ROLE_LABELS` và tham số `role` của danh sách danh bạ.

## 3. VCsales client

`packages/vcsale-client`: interface `VcsaleClient` (`listCustomers`, `searchCustomers`, `getCustomer`, `getCommerce`, `listQuotes`, `getQuote`, `getQuoteFiles`, `getQuoteCreateUrl`, `getDebtSummaries`, `listSalesStaff`, `getHealth`, `searchProducts`). Không có hàm ghi nào (BR12, có test kiểm tên hàm).

- `MockVcsaleClient`: 23 mã `KH-TEST-xxxx` của dữ liệu kiểm thử, có mã nhiễu `KH-TEST-0388`; dùng cho test tự động.
- `HttpVcsaleClient`: đọc `vclinks-bridge` của VCsales (`docs/04-ky-thuat/api/vclinks-bridge.md`), chỉ GET, header `x-api-key`, chờ tối đa 5 giây, thử lại một lần khi lỗi mạng hoặc 5xx. Tra hàng thật làm ở đợt 2.
- VCsales lỗi → API trả 503 "Không kết nối được VCsales. Thử lại sau ít phút."; sai khóa → "VCsales từ chối kết nối (sai khóa hoặc máy chưa được phép)…".

## 4. Nạp danh mục và owner lần đầu

`POST /api/customers/import` (sale admin, GĐ division):

1. Mỗi mã KH: tìm account đã liên kết mã đó; chưa có thì tạo account + người liên hệ, liên kết "đã xác nhận" (`confirmedBy = import:vcsales`). SĐT / email ERP là V3.
2. Owner lần đầu (D8-06): chỉ ghi khi division chưa có owner. Ghép theo email với `users`: người phụ trách chính trước, rồi các người phụ trách khác còn làm của khách trên VCsales; lấy người đầu tiên có tài khoản VClinks. Không ai khớp → "Chưa phân công" (`ownerUnmatched`). Owner VClinks không nằm trong số người phụ trách VCsales → chỉ đếm và gắn `ownerMismatch`, không ghi ngược.
3. SĐT nằm trên ≥ 2 mã KH → "Dùng chung nhiều khách" (DK-57).
4. Chạy lượt quét: tạo hồ sơ cho danh tính chưa có, rồi áp quy tắc gộp.

Chạy lại: `created = 0`, mọi mã `unchanged`, không thêm bản ghi.

**Màn Kết nối VCsales** (Quản trị → Cài đặt, `GET /api/admin/vcsales`, kế hoạch kết nối C5 + C6):

- Tình trạng kết nối: lần kiểm gần nhất, thời gian trả lời, mất kết nối từ lúc nào. API tự kiểm 5 phút một lần, 30 giây một lần khi đang mất; nút "Kiểm tra ngay".
- Danh sách nhân viên kinh doanh VCsales (lưu đệm 1 ngày, nút "Tải lại từ VCsales") với tình trạng: **Đã ghép**, **Chưa có tài khoản VClinks**, **Thiếu email trên VCsales**, **Email trùng trên VCsales**. Một email dùng chung bởi nhiều nhân viên thì không ghép ai, để khách không về nhầm người.
- Ngày 07/10/2026 trên máy 129: 40 nhân viên, 1 đã ghép, 11 chưa có tài khoản VClinks, 28 thiếu email.

**Đồng bộ theo thay đổi** (màn "Danh mục VCsales": xem trước, nạp toàn bộ, đọc thay đổi mỗi giờ; khách xóa trên VCsales; mã mới giữ cho phiếu "Chờ tạo mã KH") và **Việc VCsales**: `docs/04-ky-thuat/api/viec-vcsales.md`.

## 5. Quy tắc gộp

Hàm thuần `apps/api/src/customers/merge-rules.ts`, test bảng `merge-rules.spec.ts` (27 ca).

- Tín hiệu đã làm: T1–T7, T12, T14, A1, A2, A4, A6. Chưa làm (cần phân tích nội dung tin hoặc giờ khai): T8–T11, T13, T15, T16, G1–G6.
- Chặn (DK-08): dùng chung / ngừng dùng, hai mã KH khác nhau, hai owner khác nhau cùng division, đã từng tách, nhân viên nội bộ, chat web, khác giới tính, SĐT ngủ đông, hồ sơ đã xóa.
- **Điều kiện 3 của D8-05** làm đúng chữ BA: phía mới phải cùng người phụ trách với phía kia (owner, hoặc người giữ nick khi chưa có owner), hoặc chưa ai phụ trách. Vì vậy khách của Linh nhắn nick của Minh (kịch bản D) chỉ ra gợi ý, chặt hơn §4.5.
- Gợi ý lúc dọn ban đầu (hai phía đều có lịch sử) gắn `cleanup = true`, không tính hạn.

## 6. Migration và cách lùi

```
pnpm --filter @vclinks/api build
pnpm --filter @vclinks/api migrate:customers --db vclinks_copy_<ngày> --dry-run
pnpm --filter @vclinks/api migrate:customers --db vclinks_copy_<ngày>
pnpm --filter @vclinks/api migrate:customers --db vclinks_copy_<ngày> --undo <runId>
```

- Chỉ nhận DB `vclinks_copy_*`, `vclinks_m1*`, `vclinks_test_*`; DB thật cần `--allow-real` và quyết định chủ dự án.
- Không sửa `contacts`, `conversations`, `messages`; đếm trước = sau, lệch thì báo lỗi.
- `--undo` từ chối khi hồ sơ của lượt đã được dùng (đã gộp, có owner, có mã KH, có SĐT / danh tính thêm sau); `--force` để bỏ qua.
- Đã thử 04/10/2026 trên bản sao DB thật (`vclinks_copy_m1b12`, đã xóa sau khi thử): 643 danh tính → 643 hồ sơ, chạy lại tạo 0, nguồn 643 / 366 / 11.931 không đổi, lùi xóa đủ 643. DB thật còn 793 `contacts` chưa có `tenant_id` (chưa chạy migrate-tenant trên DB thật), nên không được tạo hồ sơ.

## 7. API và quyền

Khai báo ở `apps/api/src/authz/route-permissions.ts`, nhóm "Customers".

| Route | Quyền | Ghi chú |
|---|---|---|
| `GET /api/customers` | `cust.view` | Lọc trong truy vấn theo `customerScope` (owner, division, kênh trong phạm vi) |
| `GET /api/customers/:id`, `/:id/operations` | `cust.view` | Ngoài phạm vi → 404 "Không tìm thấy hoặc bạn không có quyền xem" |
| `GET /api/customers/by-identity/:uid/:userId` | `cust.view` + kênh | |
| `POST /api/customers/import`, `/sweep` | `cust.import` (DV trở lên) | |
| `GET /api/customers/merge-suggestions`, `POST …/:id/merge`, `…/:id/reject` | `cust.merge` | |
| `POST /api/customers/merge-operations/:id/undo` | `cust.merge` hoặc `cust.split` | Kiểm thêm khách nằm trong phạm vi |
| `GET /api/customers/erp-matching` | `cust.erp_link` | `canConfirm` chỉ đúng với sale admin / admin |
| `POST /api/customers/:id/erp-links` | `cust.erp_link` | Chỉ sale admin xác nhận (DK-16, D8-17); mã đã gắn account khác → 409 (UAT-DK-27) |
| `GET /api/admin/vcsales`, `POST /api/admin/vcsales/ping` | `user.view` hoặc `cust.import` (DV trở lên) | Kết nối VCsales và ghép nhân viên; chỉ đọc |

## 8. Việc còn mở

- Giao diện (trang khách, MH-DK-10 / 13, nút "Không phải người này") làm ở M1b-13.
- SĐT trong hồ sơ khách luôn ẩn qua `PhoneMaskInterceptor` vì điểm liên lạc không gắn kênh; owner thấy đủ (DK-44) cần M1b-13 xử lý.
- Hoàn tác chưa có danh sách "Thay đổi từ lúc gộp" để chọn từng mục (02 §4.7 bước 6): danh tính gộp thêm sau vẫn ở hồ sơ chung.
- Chưa có tách theo danh tính (MH-DK-06), gắn tay (MH-DK-07), account liên quan, việc VCsales (MH-DK-12).
- Nạp danh mục hiện đọc toàn bộ mỗi lần (chưa nạp tăng dần theo `updatedSince`; làm ở đợt 2, C11).
- Chưa có nút gỡ liên kết mã KH. Mã KH không còn trên VCsales thì khối Thương mại báo "Mã KH … không còn trên VCsales" và không hiện số cũ. Ngày 07/10/2026 mã giả `KH-TEST-0101` của Con Hùng được gỡ bằng script có sao lưu (`~/vclinks/backups/20261007-1111-truoc-go-ma-KH-TEST.json` trên máy 129).
- Ghép tay nhân viên thiếu email (Q6 của kế hoạch kết nối).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 07/10/2026 12:12 | Claude Code (dev002) | VCsales thật qua `vclinks-bridge`; owner lần đầu xét mọi người phụ trách VCsales; màn Kết nối VCsales (ghép nhân viên theo email, tình trạng kết nối) và API `admin/vcsales`; mã KH không còn trên VCsales; gỡ mã giả có sao lưu; cùng phiên: trỏ tới đồng bộ danh mục và Việc VCsales | Kế hoạch kết nối VCsales (C3, C5–C7), dev002 duyệt 07/10/2026 |
| 0.1 | 04/10/2026 20:22 | Claude Code · M1b-12 | Tạo tài liệu | Kế hoạch M1 phiên M1b-12 |
