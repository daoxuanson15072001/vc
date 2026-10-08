# API quản trị: cây tổ chức, người dùng, nhập lô

Phiên bản 0.2 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Mô tả các route `/api/admin/*` của phiên M1b-03: cây tổ chức (division → tổ → tổ con), người dùng kèm gán vai trò, nhập lô từ file CSV/Excel.
- Nguồn đặc tả: `docs/02-yeu-cau/dac-ta/01-phan-quyen.md` (§2.1, §2.2, §2.8, MH-PQ-01, 02, 03, 15, PQ-41, PQ-42).
- Chưa có engine phân quyền (M1b-04): mọi route chỉ cần scope `dashboard`. Việc "ai được gọi route nào" thêm ở M1b-04; hiện chỉ có luật dữ liệu và luật PQ-41 (không tự sửa quyền của mình).
- Vai trò nhạy cảm (`admin`, `quan_sat`, `giam_doc_bh`) và gán chéo division không có hiệu lực ngay: tạo yêu cầu `role_change_requests`, người thứ hai duyệt (PQ-42).
- Chưa làm: thông báo cho `quan_sat`, gán nick và kênh (cột `nick_giu`, `kenh_chinh_thuc` chỉ cảnh báo vàng), nhập từ Google Workspace, bàn giao nghỉ việc đầy đủ (MH-PQ-04), tab "Quyền hiệu lực".
- File nhân sự thật của VCparts (E4) chưa có: toàn bộ thử bằng dữ liệu TD ở `docs/05-kiem-thu/du-lieu-mau/`.
- Người duyệt cần xem kỹ: quy tắc nhập lô (mục 4) và cách xử lý "người duyệt cấp tập đoàn" khi chưa chốt Q-PQ-17 (mục 3).

## Mục lục

- [1. Dữ liệu](#1-dữ-liệu)
- [2. Route](#2-route)
- [3. Quy tắc](#3-quy-tắc)
- [4. Nhập lô từ file](#4-nhập-lô-từ-file)
- [5. Nạp dữ liệu TD](#5-nạp-dữ-liệu-td)
- [6. Điểm lệch và việc chưa làm](#6-điểm-lệch-và-việc-chưa-làm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Dữ liệu

| Collection | Ghi chú |
|---|---|
| `org_units` | `_id = code` (mã đơn vị, chữ hoa), `type`, `name`, `parentId`, `divisionId`, `managerUserId`, `active`. Đơn vị gốc `GOC` tự tạo ở lần đọc đầu. Không xóa: "Ngừng" đặt `active=false`, khôi phục được |
| `role_assignments` | `_id = userId:roleKey:orgUnitId`; một người có nhiều dòng. Cờ Trưởng nhóm là `org_units.managerUserId` |
| `role_change_requests` | Yêu cầu chờ người thứ hai duyệt: `change`, `approverRule` (`quan_sat` hoặc `nguoi_duyet_tap_doan`), `status` |
| `scheduled_changes` | Lệnh "Đổi đơn vị" hẹn giờ; tiến trình API quét 30 giây một lần |
| `users` (mở rộng) | thêm `primaryOrgUnitId`, `lockReason`, `lockedBy`, `leftAt`, `createdAt`, `createdBy` |

Mã dùng chung nằm ở `packages/shared/src/org.ts`: loại đơn vị và luật đặt cha–con, 10 vai trò và loại đơn vị mỗi vai trò phải ở, câu thông báo lỗi đúng đặc tả.

## 2. Route

| Route | Việc |
|---|---|
| `GET /admin/meta` | Loại đơn vị, vai trò (cho form) |
| `GET/POST /admin/org-units`, `PATCH /admin/org-units/:id` | Danh sách phẳng kèm số thành viên và tên quản lý; thêm; đổi tên, quản lý |
| `POST /admin/org-units/:id/move` | Đổi cha, trả số người bị ảnh hưởng |
| `POST /admin/org-units/:id/deactivate` / `reactivate` | Ngừng (bị chặn khi còn thành viên hoặc đơn vị con đang chạy) / khôi phục |
| `GET /admin/org-units/:id/members` | Thành viên của đơn vị |
| `GET /admin/users`, `GET/PATCH /admin/users/:id`, `POST /admin/users` | Danh sách (lọc không dấu theo tên, email, đơn vị gồm cả nhánh con, vai trò, trạng thái), chi tiết, sửa, tạo |
| `POST /admin/users/:id/assignments`, `DELETE …/assignments/:aid` | Thêm hoặc gỡ vai trò; thêm có thể trả `applied:false` kèm yêu cầu chờ duyệt |
| `POST /admin/users/:id/lock`, `unlock`, `offboard`, `change-unit` | Tạm khóa (lý do ≥ 10 ký tự), mở khóa, "Khóa ngay" khi nghỉ việc, đổi đơn vị (có `effectiveAt` để hẹn giờ) |
| `GET /admin/role-requests`, `POST …/:id/approve`, `reject`, `cancel` | Yêu cầu chờ duyệt |
| `GET /admin/{org-units,users}/import/template`, `import/current` | Tải file mẫu và hiện trạng (`?format=csv|xlsx`) |
| `POST /admin/{org-units,users}/import/preview`, `POST …/import` | Kiểm tra (không ghi) và nhập; thân JSON `{fileName, contentBase64}` |

## 3. Quy tắc

- Đặt đơn vị: Division chỉ dưới gốc; Tổ bán hàng dưới Division hoặc Tổ bán hàng (lồng một cấp); các nhóm khác chỉ dưới Division. Tên không trùng trong cùng cha.
- Vai trò – đơn vị: `giam_doc_bh` ở Division; `giam_sat_bh`, `nvkd` ở Tổ bán hàng; `cskh`, `marketing`, `sale_admin`, `ke_toan`, `nv_thi_truong` ở nhóm tương ứng; `admin`, `quan_sat` ở gốc. Quản lý Division phải là `giam_doc_bh`, quản lý Tổ là `giam_sat_bh`; thay quản lý cũ phải xác nhận (`?replaceManager=1`).
- PQ-41: người dùng đăng nhập bằng phiên không sửa vai trò, đơn vị, khóa chính mình (403 "Không sửa được quyền của chính bạn."). Dòng của chính người nhập trong file bị báo lỗi.
- PQ-42: yêu cầu cho `giam_doc_bh` hoặc gán chéo division do `quan_sat` duyệt; cho `admin`, `quan_sat` do người duyệt cấp tập đoàn (`security_settings` `_id:'main'`, `groupApprover`). Q-PQ-17 chưa chốt: khi chưa đặt, người giữ `quan_sat` duyệt. Người tạo không tự duyệt; token thường (không phải phiên người dùng) không duyệt được.
- Khóa và "Khóa ngay" hủy mọi phiên đăng nhập của người đó ngay (không chờ bộ nhớ đệm 60 giây). Token thiết bị và MCP không gắn người nên chưa bị thu hồi theo (MH-PQ-04).
- Đổi đơn vị sang division khác: vai trò cũ gỡ, vai trò mới thành yêu cầu chờ duyệt.

## 4. Nhập lô từ file

- CSV (UTF-8, dấu phẩy hoặc chấm phẩy) hoặc xlsx, tối đa 2.000 dòng. Sai loại hoặc thiếu cột: "File không đúng mẫu. Tải file mẫu và thử lại."; không có dòng dữ liệu: "File không có dòng nào. Kiểm tra lại dòng tiêu đề và dữ liệu."
- Đơn vị: cột `ma_don_vi, ten, loai, ma_cha, email_quan_ly`. Thứ tự dòng tùy ý (cha có thể nằm sau con). `loai` nhận mã (`to_ban_hang`) hoặc nhãn ("Tổ bán hàng"). `ma_cha` trống với Division nghĩa là dưới gốc. Quản lý chưa có trong VClinks chỉ là cảnh báo vàng; quản lý được gắn khi nhập người dùng có `truong_nhom = co`.
- Người dùng: mỗi dòng là một gán vai trò; cột như MH-PQ-15. Kết quả mỗi dòng: Thêm, Đổi, Không đổi, Lỗi, Chờ duyệt. Còn lỗi thì không ghi gì. Gán chéo division cần `den_ngay` (tối đa 90 ngày). Cùng email khác họ tên là lỗi.
- Ghi tuần tự sau khi kiểm tra toàn bộ (MongoDB chạy máy đơn không có giao dịch); chạy lại cùng file không sinh trùng.
- Câu tổng kết: "Đã nhập <n> người: <a> thêm mới, <b> cập nhật, <c> chờ duyệt vai trò nhạy cảm."

## 5. Nạp dữ liệu TD

`pnpm seed:org` (đặt `MONGO_URI`, mặc định `vclinks_td`) nhập `cay-to-chuc-td.csv` và `nguoi-dung-td.csv` bằng chính mã nhập lô ở trên, rồi áp thẳng 4 vai trò nhạy cảm (đánh dấu `seed`). `SEED_ADMIN_EMAIL` nhận vai trò `admin` ở gốc. Chạy lại không đổi gì. File `nguoi-dung-vcparts-60-dong-loi.csv` dùng cho UAT-PQ-63. Khi có file E4 thật, nhập ở màn Quản trị → Người dùng → Nhập từ file.

## 6. Điểm lệch và việc chưa làm

- Dữ liệu TD (`du-lieu-kiem-thu.md`) vẽ "Khối bán hàng" giữa Division và các tổ; đặc tả §2.2 đặt tổ thẳng dưới Division. File TD theo §2.2 (bỏ khối).
- Số UAT-PQ lệch giữa `01-phan-quyen.md` và ghi chú Admin `ra-soat/dac-ta-vong-1/01-P-AD.md` (ví dụ 63–65). Phiên theo nội dung ca, không theo số.
- Chưa có: thông báo cho `quan_sat` (chỉ ghi `notifyQuanSat` trong nhật ký), Google Workspace (UAT-PQ-64), "Quyền hiệu lực" (UAT-PQ-9), cờ Sắp nghỉ và cảnh báo (UAT-PQ-82), GS tạm khóa khẩn (UAT-PQ-81: cần engine M1b-04), bàn giao nick, khách, lệnh gửi (UAT-PQ-40, 93 chỉ làm phần dữ liệu).
- Người chưa có vai trò vẫn đăng nhập được (M1b-02 chỉ xét trạng thái); từ M1b-04 người đó không gọi được route nào cần quyền.
- **M1b-04:** mỗi route `/api/admin/*` đã gắn khóa quyền (`org.view`, `org.edit`, `user.view`, `user.edit`, `user.import`, `user.lock`, `user.offboard`, `role.approve`) ở `apps/api/src/authz/route-permissions.ts`; danh sách cây và người dùng lọc theo phạm vi người gọi (UAT-PQ-02, 04); GET không còn tạo đơn vị gốc trong DB. Xem `docs/04-ky-thuat/api/phan-quyen.md`.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 04/10/2026 19:07 | Claude Code · M1b-04 | Ghi route admin đã gắn quyền, lọc theo phạm vi, GET không ghi DB | Phiên M1b-04 |
| 0.1 | 04/10/2026 18:18 | Claude Code · M1b-03 | Tạo mới | Kế hoạch M1b-03 được chủ dự án duyệt 04/10/2026 |
