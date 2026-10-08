# Thiết kế vclinks-bridge: API chỉ đọc VCsales cho VClinks

Phiên bản 0.1 · 07/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- **`vclinks-bridge` là gì:** một ứng dụng NestJS nhỏ, mới, đặt ở `apps/vclinks-bridge` trong repo VCsales. Ứng dụng chỉ đọc DB của VCsales rồi trả JSON cho VClinks.
  - Không có: Kafka, job hẹn giờ, lệnh ghi, middleware của `packages/core`.
  - Kế hoạch tổng: `docs/01-quan-ly-du-an/ke-hoach-ket-noi-vcsales.md`.
- **Cách đọc DB:** một kết nối MongoDB (dùng driver gốc, không dùng Mongoose), đọc 4 DB: `vcsale-sales`, `vcsale`, `vcsale-accounting`, `vcsale-inventory`.
  - Mọi truy vấn đều có danh sách trường cần lấy, giới hạn thời gian 5 giây, và ưu tiên đọc ở máy phụ của bộ nhân bản MongoDB.
  - Phụ tùng hỏi qua dịch vụ wishlist đang chạy, không đọc thẳng DB.
- **12 đường API, đều là GET**, khóa `x-api-key`. Đợt 1 có 10 đường: khách, khối thương mại, báo giá, PDF, nợ, nhân viên. Đợt 2 có 2 đường: tra hàng, giao hàng theo dòng.
- **Dữ liệu thật trên máy dev làm đổi thiết kế (07/10/2026):**
  - Sổ cái chỉ có **4** bút toán tài khoản 131, trong khi có 421 hóa đơn bán còn nợ. Vì vậy nợ được tính **lai**: dùng sổ cái nếu khách có bút toán, không thì tính từ hóa đơn. Mỗi kết quả ghi rõ nguồn.
  - Chỉ **16 / 44** nhân viên có email, nên ghép người phụ trách theo email sẽ thiếu. Quản trị VCsales cần điền email; ghép tay theo tên chưa làm (Q6 của kế hoạch).
  - Không khách nào có MST, không có dữ liệu VIN, nên hai kiểu tra này không thử được trên dev.
- **PDF báo giá** dựng bằng chính mẫu `QUOTATION` đang dùng của VCsales (EJS + Puppeteer), không ghi bộ đếm lượt dùng của mẫu.
- **Đã chạy trên máy dev 07/10/2026:** nhánh `feat/vclinks-api` (commit `c7691101f`, `2a39d3c14`), pm2 `vclinks-bridge-dev` cổng 4050. 43 test hàm thuần đạt, gọi thử từ máy 129 đạt mọi đường, VClinks trên 129 đã đọc VCsales thật. Kết quả ở mục 7, phát hiện ở mục 8.
- **Người duyệt xem kỹ:** mục 5.9 (cách tính nợ), mục 5.6 (đổi trạng thái báo giá), mục 3 (bảo vệ khóa và nhật ký), mục 8 (lỗi của VCsales tìm thấy khi chạy thật).

## Mục lục

- [1. Hình dạng ứng dụng](#1-hình-dạng-ứng-dụng)
- [2. Cấu hình](#2-cấu-hình)
- [3. Lớp chung](#3-lớp-chung)
- [4. Dữ liệu thật trên máy dev](#4-dữ-liệu-thật-trên-máy-dev)
- [5. Các API và cách truy vấn](#5-các-api-và-cách-truy-vấn)
- [6. VClinks gọi thế nào](#6-vclinks-gọi-thế-nào)
- [7. Kiểm thử](#7-kiểm-thử)
- [8. Việc phát sinh](#8-việc-phát-sinh)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Hình dạng ứng dụng

Bản đã làm (đợt 1; `parts/` và giao hàng theo dòng là đợt 2):

```
apps/vclinks-bridge/
├─ package.json            @vcpart/vclinks-bridge · build: tsc -p tsconfig.build.json · start: node --env-file=.env dist/main.js · test: jest
├─ .env.example            chỉ tên biến (mục 2)
├─ README.md               cách chạy, biến môi trường, danh sách API
├─ scripts/                dev-setup.sh (tạo .env và khóa, không in bí mật) · pm2-dev.sh · smoke.sh (gọi thử từ máy VClinks)
└─ src/
   ├─ main.ts              khởi động: cổng PORT, tắt khi nhận tín hiệu, không dùng tiền tố /api
   ├─ app.module.ts        ConfigModule + MongoModule + controller; KHÔNG CoreModule, Kafka, Schedule, Saga
   ├─ controllers.ts       /health, /v1/ping, /v1/customers…, /v1/quotes…, /v1/debts, /v1/staff
   ├─ config/env.ts        đọc và kiểm biến môi trường lúc khởi động (thiếu thì dừng)
   ├─ mongo/               một MongoClient; DbRegistry chỉ mở find / findOne / aggregate / countDocuments, từ chối $out, $merge
   ├─ guard/               access.ts (hàm thuần: IP, khóa, tần suất) · access.guard.ts
   ├─ common/              errors.ts { code, message } · request-log.interceptor.ts · query.ts (con trỏ trang, thoát regex)
   ├─ customers/           customers.service (tìm, theo mã, danh sách) · commerce.service · phone.ts · customer.mapper.ts
   ├─ quotes/              quotes.service · quote-status.ts · quote-pdf-data.ts · quote-pdf.service.ts · part-refs.service.ts · company.ts
   ├─ debts/               debts.service · debt-merge.ts (sổ cái + công nợ phải thu + hóa đơn)
   └─ staff/               staff.service
```

Test jest nằm cạnh file (`*.spec.ts`, 9 file, 43 test).

- **Driver gốc `mongodb`, không dùng Mongoose:** schema Mongoose của VCsales có hook và mặc định có thể chạy ngầm. Driver gốc chỉ làm đúng câu truy vấn mình viết.
- **`DbRegistry` không mở hàm ghi:** code bridge không gọi được `insert`, `update` hay `delete`.
- **Không import `@vcpart/core`:** module đó tự đăng ký ConfigModule, Redis và middleware xác thực. Các hàm thuần cần dùng (chuẩn hóa SĐT, thoát ký tự regex) được chép sang bridge, ghi rõ nguồn.
- **Build:** `tsc -p tsconfig.build.json`, không cần Nest CLI. Chạy bằng `node --env-file=.env dist/main.js` (Node 20).
- **Trên máy dev:** chạy bằng pm2 tên `vclinks-bridge-dev`, **không** thêm vào `ecosystem.config.js` chung, để Jenkins và `pm2 startOrReload` của VCsales không đụng tới.

## 2. Cấu hình

| Biến | Ví dụ trên dev | Ý nghĩa |
|---|---|---|
| `PORT` | `4050` | Cổng nghe |
| `MONGODB_URI` | (chép từ `apps/sales/.env`, không hiện ra) | Một chuỗi kết nối cho cả 4 DB |
| `DB_SALES`, `DB_CORE`, `DB_ACCOUNTING`, `DB_INVENTORY` | `vcsale-sales`, `vcsale`, `vcsale-accounting`, `vcsale-inventory` | Tên DB; máy chính thức đặt khác cũng chạy |
| `WISHLIST_URL` | `http://127.0.0.1:4003` | Dịch vụ wishlist đang chạy: tên, mã phụ tùng cho PDF; tra hàng ở đợt 2 |
| `PURCHASE_URL` | `http://127.0.0.1:4005` | Dịch vụ purchase đang chạy: hãng phụ tùng cho PDF |
| `VCLINKS_API_KEY_SHA256` | `<băm1>[,<băm2>]` | Bản băm sha256 của khóa; 2 giá trị khi đổi khóa |
| `VCLINKS_KEY_NAME` | `vclinks-129` | Tên khóa ghi vào nhật ký |
| `VCLINKS_ALLOWED_IPS` | `127.0.0.1,192.168.50.1` | Máy `.10` thấy máy 129 là `192.168.50.1` (router đổi địa chỉ), nên danh sách IP chỉ chặn máy ngoài dải; khóa là lớp bảo vệ chính |
| `RATE_LIMIT_RPS`, `RATE_LIMIT_BURST` | `10`, `30` | Giới hạn tần suất theo khóa |
| `QUOTE_VALID_DAYS` | `7` | Hạn báo giá (VCsales không lưu) |
| `QUERY_TIMEOUT_MS`, `PDF_TIMEOUT_MS` | `5000`, `20000` | Giới hạn thời gian |

Khóa gốc do script tạo trên máy `.10`. Bản băm ghi vào env của bridge, khóa gốc ghi thẳng vào `~/vclinks/.env` trên máy 129 (`VCSALE_TOKEN`). Không hiện khóa ở đâu cả.

## 3. Lớp chung

- **Thứ tự kiểm cho mọi đường `/v1/*`:**
  1. IP nằm trong danh sách, sai thì trả 403. Dùng địa chỉ của kết nối, không tin header `X-Forwarded-For`.
  2. Khóa `x-api-key` đúng: băm sha256 rồi so sánh kiểu chống dò thời gian; thiếu hoặc sai thì trả 401.
  3. Giới hạn tần suất theo khóa, vượt thì trả 429.
- **Nhật ký mỗi lần gọi:** chỉ ghi `GET <mẫu đường> <mã trạng thái> <ms> key=<tên> n=<số dòng>`.
  - Không ghi giá trị tham số, vì có SĐT và mã khách.
  - Không ghi nội dung trả về, không ghi header.
- **Lỗi:**
  - Trả `{ code, message }` bằng tiếng Việt ngắn, không kèm chi tiết kỹ thuật.
  - Các mã: `NOT_FOUND` (404), `BAD_REQUEST` (400), `UPSTREAM_UNAVAILABLE` (503, khi DB quá hạn hoặc mất kết nối), `PDF_FAILED` (502).
- **Đọc:**
  - Mọi truy vấn có `isDeleted: { $ne: true }`, `maxTimeMS` và danh sách trường cần lấy.
  - Không bao giờ lấy `password`, `deviceTokens`, `purchasePrice`.
  - Đặt `readPreference: secondaryPreferred` để giảm tải máy chính của MongoDB.
- **`GET /health`** (không cần khóa, không trả dữ liệu): `{ ok, version, dbs: { sales, core, accounting, inventory } }` bằng lệnh `ping`.
- **`GET /v1/ping`** (cần khóa): trả như `/health`. VClinks gọi 5 phút một lần để kiểm cả địa chỉ, khóa và CSDL trong một lần gọi.

## 4. Dữ liệu thật trên máy dev

Đếm ngày 07/10/2026, chỉ đếm, không đọc nội dung:

| Mục | Số liệu | Ảnh hưởng thiết kế |
|---|---|---|
| Khách | 4.567; 1.581 có SĐT (1.561 dạng `0xxxxxxxxx`); `phones[]` đều rỗng; **0** khách có MST | Tìm SĐT trên `phone` là chính; tìm MST không thử được trên dev |
| Liên kết kế toán | 4.566 / 4.567 khách có `partnerId`, khớp `partners._id`; không đối tác nào dùng chung | Đi từ khách sang đối tác kế toán được |
| Người phụ trách | 3.904 khách có 1 người; 432 khách có 2; vài khách tới 11 | Trả cả danh sách, chọn người đầu tiên còn làm và có email |
| Báo giá | 1.235: Đủ giá 694, Hoàn tất 419, Đã xuất kho 94, Chờ xuất kho 25, Chờ đặt hàng 2, Đã xuất hóa đơn 1; không trùng mã | Đủ dữ liệu để thử đổi trạng thái |
| Sổ cái 131 | **4** bút toán đã ghi sổ (trên 7.478 bút toán các tài khoản) | Nợ tính theo sổ cái gần như trống trên dev |
| Công nợ phải thu | **2** dòng | Không thử được phần quá hạn theo công nợ phải thu |
| Hóa đơn bán | 421, cả 421 còn nợ, 416 có hạn thanh toán | Là nguồn nợ dùng được trên dev |
| Nhân viên | 44 tài khoản, **16** có email (chức danh NV: 30 người, 9 có email) | Ghép theo email sẽ thiếu nhiều |
| Mẫu PDF | 1 mẫu `QUOTATION` đang dùng (`templateType`, `templateContent`, `pdfOptions`) | Dựng PDF bằng mẫu này |
| Giá / tồn | 17.692 dòng giá (đều `APPROVED`); 4.770 dòng tồn; 4 kho loại `normal` | Đủ để thử tra hàng |

## 5. Các API và cách truy vấn

Tiền tố `/v1`. Kiểu trả về khớp kiểu trong `packages/vcsale-client` của VClinks (mục 6).

### 5.1 Tìm khách: `GET /v1/customers/search?q=&limit=20`

1. **Phân loại `q`:**
   - **SĐT:** bỏ khoảng trắng / chấm / gạch, còn 9–12 chữ số. Chuẩn hóa về `0xxxxxxxxx` bằng `normalizeVnPhone` (chép từ `apps/sales/.../vcspareparts-order-sync/phone.util.ts`).
   - **MST:** 10 chữ số, hoặc 10 chữ số kèm `-` và 3 chữ số.
   - **Mã:** dạng chữ rồi số, ví dụ `CUS001023`.
   - **Còn lại:** tên (từ 3 ký tự).
   - Một chuỗi 10 số bắt đầu bằng 0 vừa có thể là SĐT vừa là MST, nên chạy cả hai.
2. **Truy vấn `vcsale-sales.customers`**, gộp kết quả theo `_id`; khớp chính xác xếp trước, còn lại xếp theo `updatedAt` mới nhất:
   ```js
   { isDeleted: { $ne: true }, $or: [
       { phone: { $in: [local, '84' + core, '+84' + core] } },
       { 'phones.number': { $in: [local, '84' + core, '+84' + core] } },
       { phone: tolerantRegex(core) },          // cho số có dấu cách / chấm / gạch
       { taxCode: { $in: [mst, mstWithDash] } }, // chỉ mục taxCode
       { customerCode: q.toUpperCase() },
       { name: { $regex: escapeRegex(q), $options: 'i' } } ] }
   ```
3. **Bổ sung thông tin:**
   - Tên loại khách: lấy từ `customertypes` (2 dòng, lưu đệm 10 phút).
   - Người phụ trách: lấy từ `vcsale.users`, `_id ∈ data_viewer`, chỉ lấy `fullName`, `email`, `isActive`.
4. **Trả về** `{ items: VcsaleCustomer[] }`, tối đa 20 khách. Một số dùng chung thì trả đủ các khách.
5. **Giới hạn:** tìm tên phân biệt dấu, vì DB không có trường tên đã bỏ dấu.

### 5.2 Khách theo mã: `GET /v1/customers/:code`

- `findOne({ customerCode, isDeleted: { $ne: true } })`. Chưa có chỉ mục `customerCode`, nhưng với 4.567 khách vẫn nhanh; chỉ mục đề xuất ở mục 8.
- `lastTradeAt` = ngày của báo giá "Hoàn tất" hoặc "Đã xuất hóa đơn" mới nhất, dùng chỉ mục `{ customerId: 1, quotationDate: -1 }`.
- **Đổi sang kiểu `VcsaleCustomer`:**
  - `code` = `customerCode`.
  - `type` = tên loại khách.
  - `phones` = `phone` cùng `phones[].number`, đã chuẩn hóa, bỏ trùng.
  - `emails` = `[email]` nếu có.
  - `salespersons` = danh sách `{ name, email, active }`. `salespersonEmail` là người đầu tiên còn làm và có email.
  - `status`: `isActive=false` thì `inactive`, còn lại `active`.
  - `legalName`, `region`, `mergedInto` = null, vì VCsales không có.

### 5.3 Danh sách khách để đồng bộ: `GET /v1/customers?updatedSince=&cursor=&limit=200`

```js
{ $or: [ { updatedAt: { $gt: t } }, { updatedAt: t, _id: { $gt: lastId } } ] }   // sắp { updatedAt: 1, _id: 1 }, tối đa 500
```
- `cursor` = base64 của `updatedAt|_id` dòng cuối.
- Có cả khách đã xóa mềm (`status: 'deleted'`), để VClinks đánh dấu.
- Lệnh ghi thẳng bằng driver gốc của VCsales có thể không đổi `updatedAt`, nên VClinks vẫn nạp lại toàn bộ mỗi tuần một lần.

### 5.4 Khối thương mại: `GET /v1/customers/:code/commerce`

Một lệnh `aggregate` trên `vcsale-sales.quotations`, dùng chỉ mục `{ customerId: 1, quotationDate: -1 }`:
```js
[ { $match: { customerId, isDeleted: { $ne: true } } },
  { $facet: {
      revenue12m: [ { $match: { status: { $in: ['COMPLETED','INVOICED'] }, quotationDate: { $gte: now - 365d } } },
                    { $group: { _id: null, sum: { $sum: '$finalAmount' } } } ],
      openQuotes: [ { $match: { status: 'FULLY_QUOTED', quotationDate: { $gte: now - QUOTE_VALID_DAYS } } },
                    { $sort: { quotationDate: -1 } }, { $limit: 5 } ],
      lastOrder:  [ { $match: { status: { $in: ORDERED } } }, { $sort: { quotationDate: -1 } }, { $limit: 1 } ] } } ]
// ORDERED = ORDER_REQUESTED, ORDERED, GOODS_ARRIVED, WAREHOUSE_REQUESTED, EXPORTED, COMPLETED, INVOICED
```
- Cộng thêm `tier` (tên loại khách), nợ của khách (cách tính ở 5.9) và người phụ trách.
- Trả về theo kiểu `VcsaleCommerce`.

### 5.5 Báo giá của khách: `GET /v1/customers/:code/quotes?limit=20`

1. Lấy báo giá: `quotations.find({ customerId, isDeleted: { $ne: true } }).sort({ quotationDate: -1 }).limit(20)`. Chỉ lấy các trường `quotationCode`, `quotationDate`, `quotedAt`, `status`, `dmsApproval.status`, `finalAmount`, `itemsCount`, `createdBy`, `updatedAt`.
2. Thông tin dòng hàng: `quotationitems.aggregate([{ $match: { quotationId: { $in: ids }, isDeleted: { $ne: true } } }, { $group: { _id: '$quotationId', lastItemAt: { $max: '$updatedAt' }, lines: { $sum: 1 } } }])`, dùng chỉ mục `quotationId`.
3. Tên người lập: `vcsale.users`, theo `createdBy`.
4. **Không lưu đệm.** VClinks luôn đọc mới báo giá (BR16).

### 5.6 Một báo giá: `GET /v1/quotes/:id`

- `:id` là `_id`. Nếu không phải dạng `_id` thì tìm theo `quotationCode` (dev không có mã trùng).
- **Đổi trạng thái:**

  | `status` (+ `dmsApproval.status`) | `status` VClinks | Nhãn | Gửi khách |
  |---|---|---|---|
  | `NOT_QUOTED`, `QUOTE_REQUESTED` | `draft` | Chưa báo giá / Đang chờ báo giá | Không |
  | `FULLY_QUOTED` + `PENDING` | `pending` | Chờ duyệt giảm giá | Không |
  | `FULLY_QUOTED` + `REJECTED` / `RETURNED` / `RECALLED` | `draft` | Giảm giá bị trả lại | Không |
  | `FULLY_QUOTED` + `NOT_REQUIRED` / `APPROVED` / trống | `approved` | Đã báo giá đủ | Có, khi còn hạn |
  | `ORDER_REQUESTED` … `INVOICED` | `ordered` | Chờ đặt hàng, Đã đặt, Hàng đã về, Chờ xuất kho, Đã xuất kho, Hoàn tất, Đã xuất hóa đơn | Có (Q3 của kế hoạch) |
  | `CANCELLED` | `cancelled` | Đã hủy | Không |

  Nhãn lấy đúng theo chữ trên màn hình VCsales khi code.
- **Phiên bản:** `version` = 16 ký tự đầu của sha1 trên chuỗi `updatedAt | lastItemAt | lines | finalAmount | status`.
- **Hạn:** `validUntil` = (`quotedAt` hoặc `quotationDate`) + `QUOTE_VALID_DAYS`.

### 5.7 PDF báo giá: `GET /v1/quotes/:id/pdf`

1. **Mẫu:** `template_pdfs.findOne({ templateType: 'QUOTATION', status: 'ACTIVE', isDeleted: { $ne: true } })`.
2. **Dữ liệu cho mẫu** dựng giống `QuotationExportService.exportToPdf` của VCsales: báo giá, dòng hàng, khách, tổng tiền, thông tin công ty, logo, mã QR, tên người lập. Khi code đọc lại bản gốc để không lệch.
3. **Dựng file:** `ejs.render(templateContent, data)` rồi Puppeteer `page.pdf({ format, margin, printBackground })` theo `pdfOptions` của mẫu.
   - Dùng lại một trình duyệt, tối đa 2 bản dựng cùng lúc, giới hạn 20 giây.
   - Lưu đệm theo `id:version` (20 file, 10 phút).
4. **Không ghi gì:** không tăng `metadata.usageCount` của mẫu, không ghi file tạm vào thư mục của VCsales.
5. **Trả về** `application/pdf`. Bản v1 chưa có ảnh từng trang.

### 5.8 Nhân viên: `GET /v1/staff`

```js
vcsale.users.aggregate([
  { $match: { isDeleted: { $ne: true } } },
  { $lookup: { from: 'positions', localField: 'positionId', foreignField: '_id', as: 'p' } },
  { $project: { fullName: 1, email: 1, isActive: 1, departmentId: 1, employeeId: 1,
                positionCode: { $first: '$p.code' }, positionName: { $first: '$p.name' } } } ])   // không lấy password, phoneNumber, deviceTokens
```
- Tên phòng ban lấy từ `departments`.
- Mỗi người kèm cờ `emailMissing`, `emailDuplicated` (email đã chuyển chữ thường, bỏ khoảng trắng).

### 5.9 Nợ nhiều khách: `GET /v1/debts?codes=A,B,C` (tối đa 100 mã)

1. **Khách:** `customers.find({ customerCode: { $in: codes } }, { customerCode, partnerId })`.
2. **Số dư đầu kỳ:** trong `vcsale-accounting.partner_opening_balances`, lấy dòng mới nhất mỗi đối tác:
   - Điều kiện `{ partnerId: { $in }, accountCode: /^131/ }`, sắp theo `periodStartDate` giảm dần.
   - `seed = openingDebit − openingCredit`, `seedDate = periodStartDate`.
3. **Sổ cái:** `journalentries`, dùng chỉ mục `{ partnerId, account, status, postingDate }`:
   ```js
   [ { $match: { account: /^131/, status: 'POSTED', isDeleted: { $ne: true },
                 $or: [ { partnerId: p1, postingDate: { $gte: seedDate1 } }, …, { partnerId: { $in: partnersWithoutSeed } } ] } },
     { $group: { _id: '$partnerId', n: { $sum: 1 },
                 bal: { $sum: { $cond: [ { $eq: ['$type','DEBIT'] }, { $ifNull: ['$amountBase','$amount'] },
                                         { $multiply: [ -1, { $ifNull: ['$amountBase','$amount'] } ] } ] } } } } ]
   ```
   Tổng nợ theo sổ cái = `seed + bal`. Đối tác có `seed` hoặc `n > 0` mới được xem là "có dữ liệu sổ cái".
4. **Hạn từ công nợ phải thu**, dùng chỉ mục `{ partnerId, status }`:
   ```js
   receivables.aggregate([ { $match: { partnerId: { $in }, status: { $in: ['PENDING','PARTIAL','PARTIALLY_PAID','OVERDUE'] },
                                       remainingAmount: { $gt: 0 }, isDeleted: { $ne: true } } },
     { $group: { _id: '$partnerId',
         overdue:       { $sum: { $cond: [ { $lt: ['$dueDate', now] }, '$remainingAmount', 0 ] } },
         nearestDueAt:  { $min: { $cond: [ { $gte: ['$dueDate', now] }, '$dueDate', null ] } },
         oldestOverdue: { $min: { $cond: [ { $lt: ['$dueDate', now] }, '$dueDate', null ] } } } } ])
   ```
5. **Dự phòng từ hóa đơn**, cho khách không có dữ liệu sổ cái hoặc công nợ phải thu:
   ```js
   invoices.aggregate([ { $match: { customerId: { $in }, status: { $in: ['PENDING','COMPLETED'] },
                                    paymentStatus: { $in: ['UNPAID','PARTIALLY_PAID'] }, remainingAmount: { $gt: 0 }, isDeleted: { $ne: true } } },
     { $unionWith: { coll: 'vatinvoices', pipeline: [ { $match: { customerId: { $in }, status: { $in: ['ISSUED','EXPORTED'] },
                                                                 sourceType: 'STANDALONE', remainingAmount: { $gt: 0 } } } ] } },
     { $group: { _id: '$customerId', total: { $sum: '$remainingAmount' }, overdue: …, nearestDueAt: …, oldestOverdue: … } } ])
   ```
   Cách nhóm `overdue`, `nearestDueAt`, `oldestOverdue` giống bước 4.
6. **Ghép kết quả theo từng mã:**
   - `total` lấy từ sổ cái nếu có, không thì từ hóa đơn.
   - Phần quá hạn lấy từ công nợ phải thu nếu có, không thì từ hóa đơn.
   - Trả `{ code, total, overdue, nearestDueAt, oldestOverdueAt, source: { total: 'gl'|'invoices'|'none', due: 'receivables'|'invoices'|'none' } }`. Mã không có thì `{ code, notFound: true }`.
7. **Giới hạn đã biết:** bút toán 131 thiếu `partnerId` thì màn "Sổ công nợ" của VCsales tra `documents.partnerId` theo `documentId`. Bridge chưa làm bước này; trên dev cả 4 bút toán đều có `partnerId`. Cần đếm lại trên dữ liệu thật trước khi lên chính thức.

### 5.10 Tra hàng (đợt 2): `GET /v1/parts/search?q=&customerCode=&limit=20`

1. **`q` thành danh sách `partNumberId`:**
   - Mã / OE: gọi dịch vụ wishlist `POST /shared/part-numbers/inventory-search-ids { query }`. Đường này biết cả mã thay thế, tối đa 200 kết quả.
   - Tên: `unitprices` theo `snapshot.searchText` (đã bỏ dấu, có chỉ mục) hoặc `partNameNorm`.
   - VIN: chỉ tra đúng nguyên VIN (dev chưa có dữ liệu VIN).
2. **Giá:**
   - `unitprices.find({ partNumberId: { $in }, customerTypeId: { $in: [loại của khách, RETAIL] }, isActive: true, status: 'APPROVED' })`, dùng chỉ mục loại khách × phụ tùng × hãng.
   - Giá = `sellingPrice ?? price`. **Không lấy `purchasePrice`.**
   - Giá niêm yết = giá loại Khách lẻ; giá theo khách = giá loại của khách đó.
3. **Tồn kho:** `vcsale-inventory.inventorystocks.aggregate`, lọc `partNumberId ∈`, nhóm theo phụ tùng × hãng × kho.
   - Tồn thường = `availableQuantity − vatAvailableQuantity`; tồn VAT = `vatAvailableQuantity`.
   - Ghép với `warehouses` đang hoạt động.

### 5.11 Giao hàng theo dòng (đợt 2): `GET /v1/quotes/:id/delivery`

1. Dòng hàng: `quotationitems.find({ quotationId })`, lấy số lượng, `exportedQuantity`, `status`, `isNeedPurchase`, tên và mã phụ tùng.
2. Phiếu xuất: `vcsale-inventory.inventoryexportdetails.find({ quotationItemId: { $in }, exportIsDeleted: { $ne: true }, exportStatus: { $nin: ['CANCELLED','DELETED'] } })`, dùng chỉ mục `quotationItemId`.
3. **Với mỗi dòng:**
   - Đã xuất = tổng `quantity − returnedQuantity` của các phiếu `COMPLETED`.
   - Đang chờ = các phiếu còn nháp.
   - Ghi kèm ngày xuất gần nhất và mã phiếu.
   - Nhãn: "Đã giao đủ", "Giao một phần", "Chờ xuất kho", "Đang mua hàng" (khi `isNeedPurchase`).

## 6. VClinks gọi thế nào

| Hàm trong `packages/vcsale-client` | Đường bridge | Ghi chú |
|---|---|---|
| `searchCustomers(q)` | `/v1/customers/search` | |
| `getCustomer(code)` | `/v1/customers/:code` | |
| `listCustomers({ updatedSince, cursor, limit })` | `/v1/customers` | |
| `getCommerce(code)` | `/v1/customers/:code/commerce` | Lưu đệm 5 phút như hiện nay |
| `listQuotes(code)` | `/v1/customers/:code/quotes` | Không lưu đệm |
| `getQuote(id)` | `/v1/quotes/:id` | Kiểu `VcsaleQuote` thêm `id`, `erpStatus`, `erpStatusLabel`; `status` thêm `ordered` |
| `getQuoteFiles(id, 'pdf')` | `/v1/quotes/:id/pdf` | `'image'` báo "chỉ có PDF"; giao diện ẩn lựa chọn ảnh khi chạy bản thật |
| `getQuoteCreateUrl(code)` | Màn tạo báo giá VCsales | Tạm chưa điền sẵn khách (mục 8) |
| **Mới:** `getDebtSummaries(codes)` | `/v1/debts` | Cờ "Nợ quá hạn" gọi theo lô 100 mã, lưu đệm 15 phút |
| **Mới:** `listSalesStaff()` | `/v1/staff` | Ghép người phụ trách (C5), lưu đệm 1 ngày |
| **Mới:** `getHealth()` | `/v1/ping` | Theo dõi kết nối (C6): 5 phút một lần, 30 giây một lần khi đang mất |
| `searchProducts(q, { customerCode })` | `/v1/parts/search` | Đợt 2 |
| **Mới:** `getQuoteDelivery(id)` | `/v1/quotes/:id/delivery` | Đợt 2 |

- Mọi hàm vẫn tên `get|list|search` và chỉ gọi GET, nên bộ test hiện có của gói vẫn giữ nguyên.
- Lời gọi chờ tối đa 5 giây (PDF 25 giây), thử lại 1 lần khi lỗi mạng hoặc lỗi 5xx. Quá thời gian thì không thử lại, vì đã chờ đủ.
- Lỗi 401 / 403 báo "VCsales từ chối kết nối (sai khóa hoặc máy chưa được phép). Báo quản trị kiểm tra VCSALE_TOKEN.", không thử lại.
- Khi lần kiểm kết nối gần nhất báo mất, cờ Nợ quá hạn và khối Thương mại dùng ngay bản lưu, không gọi VCsales nên không phải chờ. Bấm ↻ thì vẫn gọi thật.
- Tình trạng kết nối và việc ghép nhân viên xem ở Quản trị → Cài đặt → **Kết nối VCsales** (`GET /api/admin/vcsales`).

## 7. Kiểm thử

- **Hàm thuần (jest trong VCsales):** chuẩn hóa SĐT và các biến thể, phân loại `q`, đổi trạng thái báo giá, tính phiên bản, ghép nguồn nợ, đổi khách sang kiểu VClinks, con trỏ trang.
- **Hợp đồng dùng chung:** chưa làm file JSON mẫu dùng chung. Hiện bộ test `vcsale-client` của VClinks giả máy chủ bridge ngay trong `client.test.ts`.
- **Script gọi thử từ máy 129:**
  - `/health`; thiếu khóa trả 401; sai IP trả 403.
  - Tìm theo SĐT khách test; lấy khách theo mã; khối thương mại; danh sách báo giá; PDF (bắt đầu bằng `%PDF`, trên 10 KB).
  - Nợ 3 mã; số nhân viên; duyệt hết danh sách đồng bộ (tổng bằng số khách).
  - Thời gian: 95% lời gọi dưới 500 ms, trừ PDF.
- **So tay với màn VCsales:** 5 khách mẫu, so khối thương mại, nợ và PDF. Chưa làm: cần người dùng được màn VCsales (dev002 hoặc đội VCsales).
- **Kết quả 07/10/2026:**
  - jest trên máy `.10`: 9 file, 43 test đạt.
  - Script gọi thử từ máy 129: mọi đường đạt, kể cả `/v1/ping` (có khóa 200, thiếu khóa 401) và mã không có (404).
  - Thời gian: trung vị 68 ms; nợ 100 mã 51 ms; PDF khoảng 3 giây, 624 KB; duyệt hết 4.567 khách trong 10 trang.
  - Tìm theo SĐT đúng với cả 3 cách viết số.
  - Tắt bridge khoảng 20 giây: VClinks báo mất kết nối sau 5 ms, tìm mã KH trả 503 sau 3 ms, không treo; bật lại tự về.

## 8. Việc phát sinh

- **Email nhân viên:**
  - Chỉ 16 / 44 tài khoản VCsales có email. `/v1/staff` trả 40 nhân viên kinh doanh, 12 người có email. Quản trị VCsales cần điền email công ty cho nhân viên kinh doanh.
  - VClinks (C5) có màn Quản trị → Kết nối VCsales: ghép theo email, liệt kê người chưa ghép được kèm cách sửa. Ngày 07/10: 1 người ghép được, 11 người có email nhưng chưa có tài khoản VClinks, 28 người thiếu email.
  - Ghép tay theo tên chưa làm (Q6 của kế hoạch).
- **Nguồn nợ:**
  - Kế hoạch chốt lấy nợ từ sổ cái, nhưng sổ cái dev mới có 4 bút toán 131. Bridge vì vậy tính lai và ghi rõ nguồn.
  - Khi kế toán ghi sổ đủ, nợ tự chuyển sang sổ cái theo từng khách, không phải sửa code.
  - Cần kế toán / đội VCsales xác nhận trên dữ liệu thật.
- **Chỉ mục đề xuất khi lên chính thức** (đội VCsales thêm; trên dev không thêm vì là thao tác ghi): `customers { customerCode: 1 }`, `customers { updatedAt: 1, _id: 1 }`, `quotations { updatedAt: 1, _id: 1 }`.
- **Link tạo báo giá:** màn tạo báo giá VCsales chưa đọc mã khách từ đường link. Việc nhỏ phía giao diện VCsales (đọc `?customerCode=`), đội VCsales quyết.
- **Ảnh từng trang báo giá:** chưa có ở v1, chỉ gửi PDF.
- **Không thử được trên dev:** tìm theo MST (0 khách có MST), tra theo VIN (chưa có dữ liệu VIN), quá hạn theo công nợ phải thu (2 dòng).
- **Phát hiện khi chạy thật (07/10/2026):**
  - **Lỗi đọc số tiền bằng chữ của VCsales:** 1.080.000 ₫ in ra "Không trăm linh một triệu…". Bridge đã sửa trong bản chép hàm dựng dữ liệu PDF (có test). Cần báo đội VCsales sửa ở `apps/sales`.
  - **Dịch vụ wishlist trên dev đọc nhầm DB `vcsale`** thay vì `vcsale-wishlist`: chỉ 1 / 88 phụ tùng của báo giá mẫu tìm thấy. Bridge lấy tên và mã phụ tùng từ bản chụp trong dòng giá khi wishlist không có, để PDF không bị trống. Cần đội VCsales kiểm cấu hình.
  - **`yarn install` trên dev** cần `--ignore-engines`: gói `sanitize-html` trong `yarn.lock` đòi Node ≥ 22.12, máy chạy Node 20.19. Bridge không dùng gói này.
  - **Máy 129 hiện ra với IP `192.168.50.1`** (router đổi địa chỉ). Lọc IP không phân biệt được máy 129 với máy khác sau router; khóa API là lớp bảo vệ chính.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 07/10/2026 11:22 | Claude Code (dev002) | Tạo thiết kế `vclinks-bridge`: hình dạng ứng dụng, cấu hình, lớp bảo vệ, số liệu thật máy dev, 11 API kèm câu truy vấn, cách VClinks gọi, kiểm thử, việc phát sinh; cùng phiên: cấu trúc theo bản đã làm, `/v1/ping`, kết quả chạy trên máy dev, phát hiện khi chạy thật (lỗi số tiền bằng chữ, wishlist đọc nhầm DB, IP qua router) | Yêu cầu dev002 07/10/2026 ("vclinks-bridge sẽ xây dưới dạng như nào và viết các api nào query ra sao"); đếm dữ liệu và đọc cấu trúc DB máy `.10` (chỉ đọc) |
