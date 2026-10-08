# Việc VCsales và đồng bộ danh mục khách VCsales

Phiên bản 0.1 · 07/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Tài liệu kỹ thuật cho hai việc đợt 2 của kế hoạch kết nối VCsales (`docs/01-quan-ly-du-an/ke-hoach-ket-noi-vcsales.md`):
  - **C11 – Danh mục VCsales:** nạp khách VCsales vào VClinks, rồi chỉ đọc khách đã đổi, mỗi giờ hoặc khi bấm "Đồng bộ ngay".
  - **C12 – Việc VCsales** (02 MH-DK-12): hàng việc sale admin làm tay trên VCsales, vì VClinks chỉ đọc VCsales (BR12).
- **Nạp danh mục có 3 kiểu:**
  - "Xem trước": chỉ đếm, không ghi.
  - "Nạp toàn bộ": tạo hồ sơ cho mỗi khách, chạy một lần.
  - "Đồng bộ ngay" / tự động mỗi giờ: chỉ đọc khách đổi sau mốc lần trước.
  - Mỗi lúc chỉ một lần chạy. Lần chạy đi ngầm, màn hình tự cập nhật tiến độ.
- **Khách đã xóa trên VCsales** không được tạo hồ sơ; bản chụp của họ được đánh dấu "đã xóa".
- **Mã mới khớp SĐT / MST của một phiếu "Chờ tạo mã KH"** không được tạo hồ sơ thứ hai. Mã đó được giữ lại để sale admin bấm "Gắn mã này" ở đúng việc.
- **Việc VCsales có 4 loại:**
  - Tạo mã KH (tab "Chờ tạo mã KH").
  - Đổi SĐT / email, đổi NV phụ trách, gộp mã trùng (tab "Cần cập nhật VCsales").
- **Lần đồng bộ sau tự xử lý hàng việc:**
  - Đóng việc đã làm trên VCsales.
  - Mở lại việc đã đánh dấu xong mà VCsales vẫn khác.
  - Gợi ý mã mới cho phiếu tạo mã.
- **Đã chạy "Xem trước" trên máy 129** với VCsales dev ngày 07/10/2026: 4.567 khách, chỉ 1 khách đặt được người phụ trách, 3.656 khách có NV phụ trách chưa ghép được. Việc nạp thật chờ dev002 quyết.
- **Người duyệt xem kỹ:** mục 2.3 (giữ mã cho phiếu đang chờ), mục 3.4 (đồng bộ tự đóng / mở lại việc), mục 6 (việc còn mở).

## Mục lục

- [1. Màn hình và quyền](#1-màn-hình-và-quyền)
- [2. Danh mục VCsales (C11)](#2-danh-mục-vcsales-c11)
- [3. Việc VCsales (C12)](#3-việc-vcsales-c12)
- [4. API](#4-api)
- [5. Kiểm thử và chạy thử](#5-kiểm-thử-và-chạy-thử)
- [6. Việc còn mở](#6-việc-còn-mở)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Màn hình và quyền

| Màn | Đường dẫn | Ai thấy | Ai thao tác |
|---|---|---|---|
| Danh mục VCsales | `/customers/erp-catalog` (menu Khách hàng) | Sale admin, Giám đốc bán hàng (`cust.erp_link`) | Sale admin, Giám đốc bán hàng (`cust.import`) |
| Việc VCsales | `/customers/erp-tasks?tab=create\|update` (menu Khách hàng) | Sale admin, Giám đốc bán hàng, Giám sát, NVKD | Sale admin xử lý; NVKD tạo việc và sửa phiếu cho khách mình phụ trách; Giám sát tạo việc đổi NV phụ trách |
| Dòng "Mã KH" ở ngăn khách và trang khách | – | Theo quyền xem khách | "Liên kết mã KH…" (sale admin), "Đưa vào hàng chờ tạo mã" (người phụ trách, sale admin), "Tạo đề xuất cập nhật" (người phụ trách, sale admin) |
| Hộp "Liên kết mã KH" | – | Sale admin | Ô "Trùng" để báo trùng trên VCsales; nút "Đưa vào hàng chờ tạo mã KH" khi VCsales không có khách |
| Đối chiếu mã KH | `/customers/erp-matching` | Như trước | Thêm "Khác ▾ → Đưa vào hàng chờ tạo mã" (sale admin); báo khi danh mục chưa nạp |

- NVKD chỉ thấy việc của khách mình phụ trách và việc mình tạo.
- Giám sát, Giám đốc chỉ xem trong phạm vi của mình (D8-02). Riêng Giám sát được tạo việc đổi NV phụ trách (4a).

## 2. Danh mục VCsales (C11)

### 2.1 Ba kiểu chạy

| Kiểu | Đọc gì | Ghi gì |
|---|---|---|
| Xem trước | Toàn bộ khách | Không ghi hồ sơ; chỉ lưu dòng kết quả vào lịch sử chạy |
| Nạp toàn bộ | Toàn bộ khách | Hồ sơ, mã KH, SĐT / email V3, người phụ trách lần đầu (D8-06); rồi chạy quy tắc gộp |
| Đồng bộ thay đổi | Khách có `updatedAt` sau mốc lần trước, lùi 2 phút để không sót | Như trên, cho khách đã đổi |

- **Mốc đọc** là `updatedAt` lớn nhất đã đọc, không phải giờ máy. Đọc lại khách trong 2 phút lùi là vô hại, vì hồ sơ không đổi thì được đếm "không đổi".
- **Division nhận người phụ trách lần đầu** được chốt ở lần nạp đầu. Thứ tự lấy: division đã chốt, division gửi kèm, `AUTHZ_DEFAULT_DIVISION`, rồi division của người bấm (nếu người đó chỉ thuộc một division).
- **Khóa chạy:** trường `running` trong `erp_sync`. Lần chạy quá 30 phút coi như đã chết (máy khởi động lại giữa chừng).
- **Tự đồng bộ:** mỗi `VCSALE_SYNC_MS` (mặc định 1 giờ; `0` = tắt). Chỉ chạy cho tenant đã nạp toàn bộ ít nhất một lần, và chỉ ở tiến trình chạy việc nền.

### 2.2 Khách đã xóa và khách ngừng giao dịch

- Bridge trả khách đã xóa trong trang đọc thay đổi (`status: 'deleted'`). VClinks không tạo hồ sơ cho họ. Nếu đã có bản chụp thì đánh dấu "đã xóa", và hồ sơ có mã đó hiện "Mã KH … không còn trên VCsales".
- Khách ngừng giao dịch (`inactive`) vẫn được nạp như thường.

### 2.3 Giữ mã cho phiếu đang chờ

Khi sale admin tạo mã trên VCsales cho một khách đang ở hàng "Chờ tạo mã KH", lần đồng bộ sau sẽ thấy một mã mới chưa gắn hồ sơ nào. Nếu nạp như khách mới thì VClinks có hai hồ sơ cho một khách.

Vì vậy, trước khi tạo hồ sơ cho một mã mới, VClinks so SĐT và MST của mã với các phiếu tạo mã đang chờ:

- Khớp thì chỉ lưu bản chụp, đếm vào "mã mới chờ gắn" (`held`).
- Việc tạo mã có gợi ý "Gắn mã này" (mục 3.4).

Nếu sale admin đóng việc thay vì gắn mã, mã đó chỉ được tạo hồ sơ ở lần "Nạp toàn bộ" sau, vì lần đọc thay đổi chỉ đọc lại khi khách đổi trên VCsales.

### 2.4 Kết quả mỗi lần chạy

Lưu 10 lần gần nhất. Mỗi lần ghi các số:

- đã đọc, tạo, cập nhật, không đổi;
- đã xóa trên VCsales, mã chờ gắn;
- đặt người phụ trách, NV phụ trách chưa ghép, lệch người phụ trách;
- tự gộp, gợi ý gộp;
- việc tự xong, việc mở lại, gợi ý mã mới.

Nhật ký ghi `vcsales.<kiểu>` với số đếm, không có dữ liệu khách.

## 3. Việc VCsales (C12)

### 3.1 Loại việc và nơi tạo

| Loại | Tạo ở đâu | Ai tạo | Điều kiện |
|---|---|---|---|
| Tạo mã KH | "Đưa vào hàng chờ tạo mã" (ngăn khách, trang khách, hộp Liên kết mã KH, Đối chiếu mã KH) | Người phụ trách, sale admin | Khách chưa có mã; chưa có phiếu đang chờ; SĐT trên phiếu phải mức V2 trở lên |
| Đổi SĐT / email | "Tạo đề xuất cập nhật" khi khách có SĐT / email V2+ mà mã VCsales chưa có (MH-DK-10 #5, SA-04) | Người phụ trách, sale admin | Khách có mã; VCsales chưa có giá trị đó |
| Đổi NV phụ trách | Lọc 4a "Owner VClinks ≠ NV phụ trách VCsales", nút "Tạo việc đổi NV phụ trách" | Người phụ trách, Giám sát, sale admin | Khách có mã và có người phụ trách |
| Gộp mã | Hộp Liên kết mã KH: tích ≥ 2 mã "Trùng", chọn mã chính | Sale admin (`erp_task.merge_codes`) | Mã phụ không gắn hồ sơ khác; mã chính được liên kết ngay (BR11) |

- **Phiếu tạo mã** (MH-DK-12 #3) gồm: tên pháp lý, loại khách, MST, SĐT (chọn từ điểm liên lạc V2+), địa chỉ giao hàng, địa chỉ xuất hóa đơn, ghi chú.
- Phiếu để trống trường nào thì hàng việc ghi "Thiếu …". MST không bắt buộc với khách lẻ.
- Việc không chép số điện thoại hay email: việc đổi SĐT / email trỏ tới điểm liên lạc của khách. Xóa khách theo NĐ 13 thì không còn số nào trong việc.

### 3.2 Trạng thái

`open` (đang chờ) → `waiting_sale` (trả sale bổ sung) → `open` → `done` (đã xong) hoặc `closed` (không tạo mã). Hàng việc mặc định chỉ hiện việc đang chờ; ô "Hiện cả việc đã xong" thêm việc xong trong 30 ngày.

### 3.3 Sale admin xử lý

| Nút | Việc |
|---|---|
| Nhận xử lý | Giữ dòng 15 phút; sale admin khác thấy "[tên] đang xử lý" và không bấm được |
| Kiểm tra trùng trên VCsales | Tìm trên VCsales theo SĐT, MST, tên; lưu kết quả cho cột "Trùng?" |
| Mở VCsales tạo mã | Mở trang `/customer/create` của VCsales (`VCSALE_WEB_URL`) và tự nhận xử lý. VCsales chưa nhận dữ liệu điền sẵn qua đường link |
| Kiểm tra và gắn / Gắn mã này | Liên kết mã như "Xác nhận" ở MH-DK-10; việc xong ngay, không chờ đồng bộ |
| Thiếu thông tin → trả sale | Chọn trường thiếu; người phụ trách và người tạo phiếu nhận thông báo |
| Không tạo mã | Đóng việc với lý do: khách lẻ mua một lần / trùng khách có sẵn / khác |
| Đã cập nhật trên VCsales (tab 2) | Đánh dấu xong; lần đồng bộ sau so lại |
| Mở khách … trên VCsales ↗ | Trang sửa khách `/customer/:id/edit` (bridge trả `id` của khách) |

Số / email mới của việc đổi SĐT / email hiện ẩn; "Hiện" và "Sao chép" đi qua API hiện số sẵn có, có ghi nhật ký `phone.reveal`.

### 3.4 Sau mỗi lần đồng bộ

- **Phiếu tạo mã đang chờ:** tìm bản chụp có SĐT hoặc MST của phiếu, chưa gắn hồ sơ khác → gợi ý "Gắn mã này" (MH-DK-12 #6).
- **Việc cập nhật đang chờ:** VCsales đã có thay đổi thì việc tự xong (người làm ghi "Đồng bộ VCsales").
  - Đổi SĐT / email: mã có giá trị mới.
  - Đổi NV phụ trách: NV phụ trách VCsales có email của người phụ trách VClinks.
  - Gộp mã: mọi mã phụ đã gộp hoặc đã xóa.
- **Việc sale admin đã đánh dấu xong trước lần đồng bộ này:** VCsales vẫn khác thì việc mở lại, ghi "Đồng bộ lúc … vẫn thấy VCsales chưa đổi", và người đánh dấu nhận thông báo.
- Khách được liên kết mã bằng bất kỳ đường nào thì phiếu tạo mã đang chờ của khách đó tự xong.

## 4. API

| Đường | Quyền ở cổng API | Ghi chú |
|---|---|---|
| `GET /api/customers/erp-sync` | `cust.import` hoặc `cust.erp_link` | Trạng thái, lần chạy đang chạy, 10 lần gần nhất |
| `POST /api/customers/erp-sync` `{kind, division?}` | `cust.import` (DV trở lên) | Trả 202 ngay; 409 khi đang có lần chạy; 400 đọc thay đổi khi chưa nạp lần đầu |
| `GET /api/customers/erp-tasks?tab=&mine=&mismatch=owner&finished=` | `cust.erp_link` / `cust.transfer_request` / `cust.transfer_approve` | Lọc theo phạm vi ở mục 1 |
| `GET /api/customers/erp-tasks/:id` | như trên | |
| `POST /api/customers/erp-tasks` | như trên, thêm `erp_task.merge_codes` | Kiểm người tạo theo từng loại (mục 3.1) |
| `PUT /api/customers/erp-tasks/:id/form` | như GET | Người phụ trách, người tạo phiếu, sale admin |
| `POST …/:id/claim`, `/check`, `/link`, `/return`, `/done`, `/close` | `cust.erp_link` | Trong dịch vụ: chỉ sale admin (Giám đốc chỉ xem, D8-17) |

- `GET /api/customers/:id/360` có thêm `erpTasks` (việc đang chờ của khách) và `erpDiff` (SĐT / email V2+ mã VCsales chưa có, `queued` khi đã có việc).
- `GET /api/customers/erp-matching` có thêm `erpMode` và `catalogSize`.
- Collection mới:
  - `erp_tasks`: việc VCsales, theo tenant.
  - `erp_sync`: trạng thái đồng bộ, khóa `vcsales:<tenant>`.

## 5. Kiểm thử và chạy thử

- **Test tự động** (chạy trên máy 129, 07/10/2026):
  - `apps/api/test/e2e/erp-tasks.e2e-spec.ts`, 15 ca, đều đạt:
    - quyền chạy, xem trước, khóa chạy, nạp toàn bộ, đọc thay đổi có khách xóa;
    - đưa vào hàng chờ, phạm vi xem, nhận xử lý, kiểm trùng, trả sale, gợi ý mã mới không tạo hồ sơ trùng, gắn mã, đóng việc;
    - đề xuất đổi SĐT mở lại rồi tự xong, lọc 4a, báo trùng.
  - `packages/shared/test/erp-tasks.test.ts`: phiếu, MST, loại việc, cờ lọc.
  - Toàn bộ bộ test: API e2e 469, unit 1.770, web 139, shared 207.
- **Chạy "Xem trước" trên máy 129 với VCsales dev** (07/10/2026, mất 4 giây, không ghi hồ sơ):
  - đọc 4.567 khách, sẽ tạo 4.567 hồ sơ;
  - chỉ 1 khách đặt được người phụ trách lần đầu;
  - 3.656 khách có NV phụ trách nhưng chưa ghép được (VCsales thiếu email hoặc người đó chưa có tài khoản VClinks);
  - không có mã nào bị giữ cho phiếu tạo mã.
- **Chưa nạp thật trên 129.** Lý do: nạp bây giờ thì gần như mọi khách là "Chưa phân công", và quy tắc gộp sẽ chạy trên hồ sơ của nick thật. Câu hỏi Q7 ở kế hoạch kết nối.

## 6. Việc còn mở

- **Đoạn trích tin nguồn (MH-DK-12 #7, `sourceMessageIds`):** chưa có chỗ chọn tin khi tạo việc, nên sale admin chưa thấy đoạn trích.
- **Gợi ý gắn mã cho lead đang mở (v1.2):** chưa có, vì VClinks chưa có phân hệ lead (05).
- **Việc đổi NV phụ trách** chưa tự sinh khi duyệt chuyển khách hoặc bàn giao; hiện tạo từ lọc 4a.
- **Chưa có nút "Gỡ liên kết mã KH"** (MH-DK-10). Mã giả của Con Hùng được gỡ bằng script có sao lưu.
- **Mã đang được giữ cho một phiếu đã đóng** chỉ được tạo hồ sơ ở lần "Nạp toàn bộ" sau (mục 2.3).
- **Sale admin chưa nhận thông báo khi có việc mới;** hàng việc tự tải lại mỗi phút.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 07/10/2026 12:12 | Claude Code (dev002) | Tạo tài liệu: danh mục VCsales (xem trước, nạp toàn bộ, đọc thay đổi, khách xóa, giữ mã cho phiếu đang chờ), Việc VCsales (4 loại, trạng thái, xử lý, đồng bộ tự đóng / mở lại), API, kiểm thử, kết quả xem trước trên 129, việc còn mở | Yêu cầu dev002 07/10/2026 ("làm tiếp đợt 2, bắt đầu C11 và C12"); 02 MH-DK-12, DK-58, SA-04, MH-DK-10 |
