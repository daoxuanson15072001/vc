# Danh sách chức năng UAT bàn giao code — VC Content Engine

> Bổ sung v0.13 trên nhánh `codex/mon-hoc-crud` @39d56dc: UAT-LRN-52…61 cho mô hình đào tạo mới; gộp develop theo yêu cầu chủ sản phẩm ngày 01/10/2026, chưa nghiệm thu người dùng.
>
> Danh sách chức năng **đã có trong code** (`develop` @ `9ff73e4`, 29/09/2026) cần người dùng nghiệm thu (UAT) trước khi bàn giao. Chức năng thiết kế chưa làm không có ca UAT — xem các danh sách *Chưa làm (backlog)* trong `docs/BA.md`.

---

## 0. Kiểm soát tài liệu

| Thuộc tính | Giá trị |
| --- | --- |
| Mã tài liệu | CE-UAT-001 |
| Phiên bản | **0.15** — Dự thảo |
| Ngày | 01/10/2026 |
| Chủ sở hữu | Bùi Thọ Anh |
| Căn cứ | `docs/BA.md` v0.61 · `docs/DESIGN.md` v0.38 · code TK-15a–d. v0.10 (01/10/2026): LV-01, 67 ca tự động đạt; chuyển / quay lui QA mẫu trên MongoDB riêng :27029 đạt, nghiệm thu giao diện chờ người dùng. v0.9 (30/09/2026, TK-15d): thêm UAT-LRN-51 (UI Thư viện, builder, trang người học và redirect). |
| Môi trường | UAT tách riêng: `bash start_uat.sh` → http://127.0.0.1:5400, DB `tiktok_to_text_uat` (Phần A) |

### Lịch sử sửa đổi

| Phiên bản | Ngày | Thay đổi |
| --- | --- | --- |
| 0.15 | 05/10/2026 | SYS-42 / OPS-01: thêm UAT-CORE-099, 100 xuất / nạp dữ liệu chuyển máy chủ |
| 0.14 | 03/10/2026 | SYS-41 / TK-17: thêm UAT-SYS-59 kiểm model Ollama tự nhả khi rảnh và khi dừng BE |
| 0.13 | 01/10/2026 | TK-16 SCR-16.2: thêm UAT-LRN-52…61; BA v0.60 / DESIGN v0.37; kiểm tra tự động đã chạy, UAT người dùng chờ nghiệm thu |
| 0.12 | 01/10/2026 | SYS-39 SCR-22.2: công cụ nghiệp vụ đọc cho AI local, UAT-SYS-56…58; giới hạn chữ trước đây được mở rộng bằng quyền MCP |
| 0.11 | 01/10/2026 | SYS-38 SCR-22.1: thêm UAT-SYS-50…55 cho trò chuyện dự phòng Ollama; giữ UAT-SYS-34 cũ với nhãn Loại bỏ |
| 0.10 | 01/10/2026 | LV-01 WK-26: thêm UAT-WK-075…077 cho chuyển cây cũ, nhật ký và quay lui; các ca cũ giữ nguyên |

**Kiểm chứng SYS-38 / SCR-22.1 @0c44273 (01/10/2026):** 96 ca backend đạt (chat, HTTP local, quyền, hàng chờ và hồi quy dự phòng tài liệu); 6 ca Playwright đạt (gồm 2 ca chuẩn bị, Chat nhanh và 3 ca Ollama, có kiểm WCAG A/AA); 66 ca frontend đạt; build đạt; lint không lỗi, 46 cảnh báo sẵn có. CLI / HTTP trả lời AI được giả lập, database test riêng; chưa nghiệm thu với mô hình Ollama thật. `npm test` hiện lỗi đường dẫn `src/` trên Node 24 nên chạy cùng 66 ca bằng danh sách tệp `.test.js` trực tiếp.

### Cách dùng

1. Dựng môi trường và kiểm điều kiện bắt đầu theo **Phần A**.
2. Chạy ca theo thứ tự ưu tiên: mọi ca **Cao** trước, rồi **TB/Trung bình**, cuối cùng **Thấp**.
3. Ghi vào hai cột cuối mỗi bảng: **Kết quả** = `Đạt` / `Không đạt` / `Chặn` (không chạy được vì lỗi khác) / `Không kiểm` (thiếu điều kiện như token Facebook, AI); **Ghi chú** = mã lỗi hoặc mô tả ngắn.
4. Nhãn trong ca: **[AI]** cần `bash start_uat.sh --ai`; **[MẠNG]** cần Internet; **[QDRANT]** cần Qdrant `:6333`; **[FB]** cần token Fanpage thử thật.
5. Đủ điều kiện kết thúc (A.4) thì ký bảng A.6.

### Tổng hợp số ca

| Phần | Phân hệ | Số ca | Ưu tiên Cao | Có nhãn [AI] |
| --- | --- | --- | --- | --- |
| Phần B | CORE | 87 (7 ca *Loại bỏ*) | 40 | 0 |
| Phần C | WK/TT/GOV | 89 (4 ca *Loại bỏ*) | 36 | 17 |
| Phần D | CE | 69 | 29 | 27 |
| Phần E | SYS/ORG/LRN | 107 | 62 | 7 |
| **Tổng** | | **352** | **167** | **51** |

---

## Phần A — Chuẩn bị UAT và điều kiện nghiệm thu

### A.1 Dựng môi trường

Môi trường UAT tách hẳn bản thật: BE `127.0.0.1:8400`, FE `http://127.0.0.1:5400`, DB `tiktok_to_text_uat`, dữ liệu thô `output/uat/`. Không đụng DB `tiktok_to_text`, không build lại `frontend/dist` của bản thật.

| Bước | Lệnh / thao tác | Kết quả cần thấy |
| --- | --- | --- |
| 1 | Kiểm tra cổng trống: `lsof -iTCP:8400 -sTCP:LISTEN; lsof -iTCP:5400 -sTCP:LISTEN` | không có tiến trình. Nếu có, script tự dừng và in `kill <pid>` |
| 2 | Chạy lần đầu hoặc dựng lại sạch: `bash start_uat.sh --reset` | in danh sách tài khoản, dòng `UAT: http://127.0.0.1:5400 (AI: tắt · mật khẩu mọi tài khoản: Test@12345)` |
| 3 | Chạy các lần sau (giữ dữ liệu): `bash start_uat.sh` | DB đã có người dùng thì không dựng lại |
| 4 | Ca cần AI (nhóm AI dự phòng): `bash start_uat.sh --ai` | AI theo khoá / CLI / Ollama của máy |
| 5 | Dựng lại dữ liệu khi server đang chạy: `bash start_uat.sh --seed-only` | dữ liệu mẫu mới; mọi người phải đăng nhập lại |
| 6 | Mở trình duyệt đúng địa chỉ `http://127.0.0.1:5400` (không dùng `localhost`) | cookie UAT không đè phiên bản thật ở `localhost:8000` |
| 7 | Dừng: `Ctrl+C` trong cửa sổ chạy script | BE tắt trong ≤ 5 s, Vite tắt theo (trap EXIT) |

Tuỳ chọn khi ghép: `--reset --ai`. Kịch bản gói P01–P10 cho Claude in Chrome ở `docs/test-claude-extension/` (mở `bo-test.html` để chép prompt).

### A.2 Tài khoản mẫu (`backend/scripts/seed_uat.py`)

Mật khẩu mọi tài khoản: **`Test@12345`**. Script từ chối chạy nếu `MONGO_DB` không có đuôi `_uat`.

| Khoá | Email | Họ tên | Chức danh | Đơn vị | Quản lý trực tiếp | Chức năng | Cấp bậc | Vai trò hệ thống | Vai trò chức năng / kho |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| admin | admin@uat.test | Quản trị UAT | Quản trị hệ thống | VCPV | — | — | — | **admin** | — |
| tgd | tgd@uat.test | Trần Tổng Giám | Tổng giám đốc | VCPV | — | — | 7 | member | trưởng VCPV |
| gd_garage | gd.garage@uat.test | Lê Giám Đốc Garage | Giám đốc VCgarage | VCGARAGE | tgd | tech | 6 | member | trưởng VCGARAGE; `category_owner` nhánh `nen.ky-thuat`; chủ nhánh `nen.ky-thuat` |
| tp_kt | tp.kt@uat.test | Phạm Trưởng Phòng KT | Trưởng phòng Kỹ thuật | VCGARAGE-KT | gd_garage | tech | 5 | member | trưởng VCGARAGE-KT; chủ *Kho Kỹ thuật VCgarage* |
| ks_kt | ks.kt@uat.test | Hoàng Key Staff KT | KTV chính | VCGARAGE-KT | tp_kt | tech | 3 | member | `reviewer` nhánh `nen.ky-thuat` (VCGARAGE-KT); editor kho KT |
| nv_kt | nv.kt@uat.test | Vũ Nhân Viên KT | Kỹ thuật viên | VCGARAGE-KT | ks_kt | tech | 2 | member | editor kho KT; được giao lộ trình mẫu |
| tts_kt | tts.kt@uat.test | Đỗ Thực Tập KT | Thực tập sinh kỹ thuật | VCGARAGE-KT | ks_kt | tech | 1 | member | viewer kho KT; được giao lộ trình mẫu |
| gd_part | gd.part@uat.test | Ngô Giám Đốc Part | Giám đốc VCpart | VCPART | tgd | sales | 6 | member | trưởng VCPART; chủ nhánh `bh.ky-nang-b2b` |
| tp_kd | tp.kd@uat.test | Bùi Trưởng Phòng KD | Trưởng phòng Kinh doanh | VCPART-KD | gd_part | sales | 5 | member | trưởng VCPART-KD; chủ *Kho Kinh doanh VCpart* |
| nv_kd | nv.kd@uat.test | Đặng Nhân Viên KD | Nhân viên kinh doanh | VCPART-KD | tp_kd | sales | 2 | member | editor kho KD |
| hr_lnd | hr.lnd@uat.test | Mai Đào Tạo | Chuyên viên L&D | TD-HR | tgd | hr | 4 | member | `lnd` phạm vi VCGARAGE; chủ *Kho Công khai VCPV* (công khai trong công ty) |
| auditor | auditor@uat.test | Lý Kiểm Toán | Kiểm soát nội bộ | TD-HR | tgd | hr | 4 | member | `auditor` |
| outsider | outsider@uat.test | Tạ Người Ngoài | Nhân viên (không thuộc kho nào) | TD-HR | hr_lnd | hr | 2 | member | không là thành viên kho nào (chỉ thấy kho công khai) |

Dữ liệu mẫu khác: cây tổ chức 6 đơn vị (VCPV → TD-HR, VCGARAGE → VCGARAGE-KT, VCPART → VCPART-KD), 4 chức năng, cây lĩnh vực v2, 3 kho, thẻ đã duyệt + thẻ nháp `[NHÁP]`, câu hỏi, 2 bài học, một lộ trình đã giao cho nv.kt và tts.kt, video mẫu.

### A.3 Điều kiện bắt đầu (entry)

1. Code cần kiểm đã merge vào `develop`; ghi mã commit (`git rev-parse --short HEAD`) vào biên bản.
2. `bash start_uat.sh --reset` chạy xong không lỗi, đăng nhập được `admin@uat.test`.
3. Toàn bộ pytest (`E2E_SLOT=uat ../.venv/bin/python -m pytest`) và e2e (`npm run e2e`) đã chạy trên cùng commit; lỗi còn lại đã ghi rõ.
4. Máy có MongoDB; với nhóm AI / job đêm: Ollama + `gemma3:12b` + `bge-m3`, Qdrant chạy, `claude` CLI đã đăng nhập.
5. Người kiểm thử có danh sách tài khoản A.2 và biểu mẫu ghi lỗi.

### A.4 Điều kiện kết thúc (exit)

1. 100% ca ưu tiên **Cao** đã chạy; ≥ 90% ca ưu tiên **Trung bình** đã chạy.
2. Không còn lỗi mức **Nghiêm trọng** hoặc **Cao** chưa đóng.
3. Lỗi **Trung bình** còn mở có kế hoạch sửa và người chịu trách nhiệm được ghi nhận.
4. Mọi ca *Chưa làm (backlog)* được ghi là "Không kiểm — chức năng chưa có", không tính là trượt.
5. Bảng ký duyệt A.6 đủ chữ ký.

### A.5 Mức độ lỗi

| Mức | Định nghĩa | Ví dụ | Xử lý |
| --- | --- | --- | --- |
| **Nghiêm trọng** | Mất / hỏng dữ liệu, lộ dữ liệu sai quyền, không đăng nhập được, máy chủ không khởi động | UAT ghi vào DB thật; thành viên vào được `/admin`; thấy thẻ kho không được chia sẻ | Dừng UAT, sửa ngay |
| **Cao** | Chức năng chính không dùng được, không có cách làm vòng | Đổi mật khẩu không lưu; AI dự phòng không chạy khi thiếu khoá | Sửa trước khi nghiệm thu |
| **Trung bình** | Chức năng chạy sai một phần, có cách làm vòng | Số liệu Tổng quan không tự làm mới; menu sai trên điện thoại | Sửa trong đợt sau, ghi kế hoạch |
| **Thấp** | Chữ, bố cục, câu báo lỗi chưa rõ | Sai chính tả, lệch căn lề | Gom sửa sau |

### A.6 Ký duyệt

| Vai trò | Họ tên | Kết quả (Đạt / Đạt có điều kiện / Không đạt) | Ghi chú | Ngày | Chữ ký |
| --- | --- | --- | --- | --- | --- |
| Chủ sở hữu sản phẩm | Bùi Thọ Anh | | | | |
| Người kiểm thử chính | | | | | |
| Đại diện người dùng (L&D / Kỹ thuật) | | | | | |
| Người phát triển | | | | | |

---


## Phần B — Nền tảng xuyên suốt (CORE)

Quy ước cột *Vai trò thực hiện*: tên khoá tài khoản ở A.2 (vd `admin`, `nv_kt`) hoặc *Vận hành* (người có quyền vào máy chủ, chạy lệnh). Ưu tiên: **Cao / Trung bình / Thấp**.

### B.1 Đăng nhập, đăng xuất, đổi mật khẩu

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-001 | Đăng nhập đúng | `/` (màn Đăng nhập) | nv_kt | Chưa đăng nhập | 1. Mở `http://127.0.0.1:5400` 2. Nhập `nv.kt@uat.test` / `Test@12345` 3. Bấm *Đăng nhập* | Vào *Tổng quan*; góc dưới thanh bên hiện tên "Vũ Nhân Viên KT" và email | SYS-02 | Cao |  |  |
| UAT-CORE-002 | Email không phân biệt hoa thường, bỏ khoảng trắng | Đăng nhập | nv_kt | Chưa đăng nhập | Nhập ` NV.KT@UAT.TEST ` + mật khẩu đúng | Đăng nhập được | SYS-02 | Thấp |  |  |
| UAT-CORE-003 | Sai mật khẩu / sai email | Đăng nhập | bất kỳ | Chưa đăng nhập | 1. Email đúng, mật khẩu sai 2. Email không tồn tại | Cả hai báo cùng câu "Sai email hoặc mật khẩu", không lộ email có tồn tại hay không | SYS-02 | Cao |  |  |
| UAT-CORE-004 | Tài khoản bị khoá | Đăng nhập; `/admin` | admin, outsider | outsider đang đăng nhập ở trình duyệt khác | 1. admin khoá outsider ở *Người dùng & lĩnh vực* 2. Ở trình duyệt của outsider bấm sang trang khác 3. outsider đăng nhập lại | Bước 2: quay về màn đăng nhập (phiên bị xoá). Bước 3: báo "Tài khoản đã bị khoá". Token MCP của outsider (nếu có) bị thu hồi | SYS-02, SYS-03 | Cao |  |  |
| UAT-CORE-005 | Đăng xuất | Thanh bên → menu tài khoản | nv_kt | Đang đăng nhập | 1. Bấm tên ở góc dưới thanh bên 2. *Đăng xuất* 3. Bấm *Back* của trình duyệt | Về màn đăng nhập; Back không vào lại được trang (API trả 401) | SYS-02 | Cao |  |  |
| UAT-CORE-006 | Phiên hết / bị xoá khi đang dùng | bất kỳ trang | nv_kt | Đang đăng nhập | 1. Vận hành chạy `bash start_uat.sh --seed-only` (xoá mọi phiên) 2. Người dùng bấm sang trang khác | Tự về màn đăng nhập, không trang trắng, không lỗi đỏ khó hiểu | SYS-02 | Trung bình |  |  |
| UAT-CORE-007 | Đổi mật khẩu thành công | Thanh bên → *Đổi mật khẩu* | nv_kd | Đang đăng nhập | 1. Mở menu tài khoản → *Đổi mật khẩu* 2. Nhập mật khẩu hiện tại `Test@12345`, mới `Moi@12345` 3. *Lưu* 4. Đăng xuất, đăng nhập bằng mật khẩu mới | Hiện "Đã đổi mật khẩu"; mật khẩu cũ không còn đăng nhập được, mật khẩu mới được | SYS-04 | Cao |  |  |
| UAT-CORE-008 | Đổi mật khẩu — sai mật khẩu hiện tại | như trên | nv_kd | Đang đăng nhập | Nhập mật khẩu hiện tại sai | Báo "Mật khẩu hiện tại không đúng"; mật khẩu không đổi | SYS-04 | Cao |  |  |
| UAT-CORE-009 | Đổi mật khẩu — mật khẩu mới ngắn | như trên | nv_kd | Đang đăng nhập | Nhập mật khẩu mới 7 ký tự | Trình duyệt chặn (tối thiểu 8); gửi thẳng API cũng bị từ chối 422 với câu tiếng Việt | SYS-04 | Trung bình |  |  |
| UAT-CORE-010 | Cookie tách giữa UAT và bản thật | Trình duyệt | Vận hành | Bản thật `localhost:8000` đang đăng nhập | Đăng nhập UAT ở `127.0.0.1:5400`, rồi mở lại `localhost:8000` | Hai phiên độc lập, không bị đăng xuất lẫn nhau | 11.1 (UAT) | Trung bình |  |  |
| UAT-CORE-011 | API cần đăng nhập | `curl` | Vận hành | Không có cookie | `curl -i http://127.0.0.1:8400/api/stats`; `curl -i http://127.0.0.1:8400/api/health` | `/api/stats` trả 401 "Cần đăng nhập"; `/api/health` trả 200 `{"ok": true}` | SYS-02 | Cao |  |  |
| UAT-CORE-012 | Cổng MCP từ chối khi thiếu token | `curl` | Vận hành | — | `curl -i -X POST http://127.0.0.1:8400/mcp` không header `Authorization` | 401 `invalid_token`, không mở phiên MCP | SYS-09 | Cao |  |  |
| UAT-CORE-013 | Tải trang chỉ kiểm phiên một lần; phiên mất thì về màn đăng nhập | bất kỳ trang (DevTools → Network, lọc `auth/me`) | nv_kt | Đang đăng nhập | 1. Mở DevTools tab Network, bấm F5 2. Đếm yêu cầu `GET /api/auth/me` 3. Vận hành chạy `bash start_uat.sh --seed-only` (xoá mọi phiên) 4. Bấm một mục menu khác | Bước 2: đúng **một** yêu cầu `/api/auth/me` mỗi lần tải trang (bản build; bản Vite dev cũng một). Bước 4: về màn đăng nhập ngay, không trang trắng, không lỗi đỏ | SYS-02 (DESIGN I mục 8.1, nợ KT #3) | Trung bình |  |  |

### B.2 Cài đặt lần đầu

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-020 | Màn tạo quản trị viên đầu tiên | `/` | Vận hành | DB trống: dừng UAT, chạy BE với `MONGO_DB=tiktok_to_text_uat_empty` (hoặc `mongosh tiktok_to_text_uat --eval 'db.users.deleteMany({})'` trên DB UAT) | Mở trang chủ | Tiêu đề "Tạo tài khoản quản trị", có ô Họ tên, Email, Mật khẩu (tối thiểu 8 ký tự), nút *Tạo tài khoản* | SYS-01 | Cao |  |  |
| UAT-CORE-021 | Tạo quản trị viên | như trên | Vận hành | UAT-CORE-020 | Nhập họ tên, email, mật khẩu 8 ký tự → *Tạo tài khoản* | Vào ngay Tổng quan; tài khoản có vai trò Quản trị viên (thấy nhóm menu *Quản trị*) | SYS-01 | Cao |  |  |
| UAT-CORE-022 | Khoá cài đặt khi đã có tài khoản | `curl` | Vận hành | Đã có ≥ 1 người dùng | `curl -i -X POST http://127.0.0.1:8400/api/auth/setup -H 'Content-Type: application/json' -d '{"email":"x@y.z","name":"X","password":"12345678"}'` | 409 "Hệ thống đã có tài khoản quản trị"; màn đăng nhập không còn form tạo | SYS-01 | Cao |  |  |
| UAT-CORE-023 | Kiểm tra dữ liệu nhập khi cài đặt | như UAT-CORE-020 | Vận hành | DB trống | 1. Email sai định dạng 2. Mật khẩu 7 ký tự | Báo lỗi tiếng Việt nêu ô sai ("Email không hợp lệ", "Mật khẩu: cần ít nhất 8 ký tự"); không tạo tài khoản | SYS-01 | Trung bình |  |  |

### B.3 Điều hướng và thanh bên theo quyền

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-030 | Menu của quản trị viên — **Loại bỏ** (v0.4, UI-2: menu đổi thành nhóm theo việc; thay bằng UAT-CORE-014) | Thanh bên | admin | Đăng nhập | Xem thanh bên | Có đủ nhóm: Tổng quan, Trò chuyện Claude, Hướng dẫn sử dụng; *Tri thức*; *Content Engine*; *Chia sẻ*; *Học tập*; *Duyệt tri thức*; **Quản trị → Người dùng & lĩnh vực**; *Tổ chức* | BA 9 (Thanh bên) | Cao |  |  |
| UAT-CORE-031 | Menu của thành viên thường | Thanh bên | nv_kt | Đăng nhập | Xem thanh bên | **Không** có nhóm *Quản trị*; không có *Thiết kế lộ trình*, *Lộ trình học* | BA 9, SYS-03 | Cao |  |  |
| UAT-CORE-032 | Chặn vào `/admin` bằng gõ địa chỉ — **Loại bỏ** (v0.3: từ UI-1 trang hiện *Không tìm thấy trang* thay vì chuyển về `/`, SYS-32; thay bằng UAT-CORE-025) | `/admin` | nv_kt | Đăng nhập | Gõ `http://127.0.0.1:5400/admin` | ~~Chuyển về `/` (Tổng quan)~~; API quản trị người dùng trả 403 nếu gọi thẳng | SYS-03 | Cao |  | Loại bỏ |
| UAT-CORE-033 | Menu học tập theo cờ quyền | Thanh bên | hr_lnd, tp_kt, tts_kt | Đăng nhập lần lượt | So sánh nhóm *Học tập* | hr_lnd (L&D) thấy *Thiết kế lộ trình*, *Lộ trình học*; người có cấp dưới / đã giao bài (tp_kt, người giao lộ trình mẫu) thấy *Chấm bài*; tts_kt chỉ thấy *Thư viện bài học*, *Học tập của tôi*. Ghi lại kết quả thực tế từng người | 17 (LRN), `policy.learn_flags` | Trung bình |  |  |
| UAT-CORE-034 | Gõ thẳng trang bị ẩn menu | `/learn/design` | tts_kt | Đăng nhập | Gõ địa chỉ | Trang mở nhưng mọi thao tác ghi bị API từ chối với câu báo quyền (menu chỉ ẩn, API tự kiểm) | 17, ORG-10 | Trung bình |  |  |
| UAT-CORE-035 | Link cũ chuyển hướng — **Loại bỏ** (v0.3: đường dẫn lạ không còn về `/`; link cũ kiểm ở UAT-CORE-025, 026) | `/jobs`, `/videos?channel=abc`, `/channels`, `/khong-co` | nv_kt | Đăng nhập | Gõ lần lượt 4 địa chỉ | `/jobs` → `/kb`; `/videos?channel=abc` → `/kb/videos?channel=abc` (giữ bộ lọc); `/channels` → `/kb/channels`; ~~đường dẫn lạ → `/`~~ | BA 9 | Thấp |  | Loại bỏ |
| UAT-CORE-036 | Tiêu đề tab trình duyệt | Mọi trang | nv_kt | Đăng nhập | Mở `/wiki/graph`, `/studio/quick/…`, `/kb/videos` | Tiêu đề theo mục menu khớp dài nhất + "· VC Content Engine" (vd "Bản đồ tri thức · VC Content Engine") | — | Thấp |  |  |
| UAT-CORE-037 | Mục menu đang chọn | Thanh bên | nv_kt | Đăng nhập | Bấm *VCWIKI* rồi *Bản đồ tri thức* | Chỉ đúng một mục được tô; *VCWIKI* không còn tô khi ở `/wiki/graph` | BA 9 | Thấp |  |  |
| UAT-CORE-038 | Máy chủ khởi động lại khi đang dùng | bất kỳ | nv_kt + Vận hành | Đăng nhập | 1. Vận hành dừng BE UAT 2. Người dùng bấm một nút tải dữ liệu 3. Bật lại BE, bấm *Thử lại* | Bước 2 báo "Không kết nối được máy chủ … bấm Thử lại sau vài giây", trang không trắng; bước 3 tải lại được | 11.1 (Độ bền) | Trung bình |  |  |
| UAT-CORE-024 | Giao diện Sáng / Tối | Menu tài khoản (cuối thanh bên) | nv_kt | Đăng nhập; máy đặt chế độ sáng | 1. Bấm tên mình ở cuối thanh bên → dòng *Giao diện* chọn **Tối** 2. Tải lại trang 3. Chọn **Theo máy**, đổi máy sang chế độ tối rồi sáng 4. Dùng bàn phím: Tab tới nhóm *Giao diện*, bấm ← → | 1: cả app chuyển nền tối, chữ đọc rõ, nút chính màu hồng sáng chữ đậm; 2: vẫn tối (nhớ trên trình duyệt); 3: app đổi theo máy; 4: mũi tên đổi lựa chọn, trình đọc màn hình đọc "Giao diện, nhóm nút chọn" | SYS-26 | Cao |  |  |
| UAT-CORE-025 | Trang *Không tìm thấy* trong app | `/khong-co-trang-nay`, `/admin` | nv_kt | Đăng nhập | 1. Gõ `http://127.0.0.1:5400/khong-co-trang-nay` 2. Bấm *Về trang Tổng quan* 3. Gõ `/admin` (nv_kt không phải quản trị viên) | 1: địa chỉ giữ nguyên, trang hiện tiêu đề **Không tìm thấy trang** + đường dẫn đã gõ, tiêu đề tab "Không tìm thấy trang · VC Content Engine"; 2: về Tổng quan; 3: cũng hiện *Không tìm thấy trang* (không lộ trang quản trị); gọi thẳng API quản trị người dùng trả 403 | SYS-32, SYS-03 | Cao |  |  |
| UAT-CORE-026 | Máy chủ trả 404 thật và 301 cho link cũ | Terminal | Vận hành | Bản build có `frontend/dist/routes.json` (build lại sau khi merge UI-1), BE :8400 | `curl -sI http://127.0.0.1:8400/khong-co`, `…/kb/khong-co/sau`, `…/kb`, `…/studio/abc123`, `…/videos?channel=abc`, `…/jobs/abc`, `…/channels` | `/khong-co`, `/kb/khong-co/sau` → **404** (trang HTML "Không tìm thấy trang"); `/kb`, `/studio/abc123` → 200; `/videos?channel=abc` → **301** `Location: /kb/videos?channel=abc`; `/jobs/abc` → 301 `/kb`; `/channels` → 301 `/kb/channels`. Bản build cũ chưa có `routes.json` → mọi đường dẫn vẫn 200 và log BE có cảnh báo | SYS-32 | TB |  |  |
| UAT-CORE-027 | robots.txt, noindex, ảnh xem trước khi dán link | Terminal + Zalo / Slack nội bộ | Vận hành | BE :8400 | 1. `curl -s http://127.0.0.1:8400/robots.txt` 2. Xem mã nguồn trang (Ctrl/⌘+U) 3. Dán link app vào ô chat nội bộ | 1: có `Disallow: /api/`, `Disallow: /mcp`, `Allow: /guide`, `Disallow: /`; 2: có `meta name="robots" content="noindex, nofollow"`, `theme-color`, `og:image` = `/og.png`, favicon chữ **VC** (không còn biểu tượng 🎬); 3: link hiện thẻ xem trước có tên *VC Content Engine* và ảnh (nếu ứng dụng chat truy cập được máy chủ) | SYS-32 | Thấp |  |  |
| UAT-CORE-028 | Tiêu đề tab và mô tả trang theo màn | Mọi trang | nv_kt | Đăng nhập | Mở `/wiki/graph`, `/kb/videos`, `/studio/projects`, `/learn`; xem tiêu đề tab và *meta description* (Ctrl/⌘+U hoặc công cụ dev) | Tiêu đề tab = tên màn + "· VC Content Engine" (vd "Bản đồ tri thức · VC Content Engine"; `/kb/videos` là "Kho tư liệu · …"); mô tả một câu đúng màn; trang mở đối tượng giữ cách đặt tiêu đề cũ (vd bài viết nhanh: "<tên bài> · VC Content Engine") | SYS-32 | Thấp |  |  |
| UAT-CORE-029 | Kiểm trợ năng tự động | Terminal | Vận hành / dev | Worktree có `npm ci` | 1. `cd frontend && npm run lint` 2. `E2E_SLOT=<số> npm run e2e -- a11y.spec.js ui-components.spec.js` | 1: **0 lỗi** (cảnh báo ở trang cũ được phép, UI-1 ghi 86); 2: xanh — trang mẫu component 0 lỗi *critical* / *serious*, cặp màu token đạt AA; bảng lỗi theo route ở `output/e2e_<số>/a11y.json` (UI-1: 8 critical, 18 serious ở trang cũ, trước khi sửa hai ô chọn kho — số mới xem ở lần chạy) | SYS-29, SYS-30 | TB |  |  |
| UAT-CORE-014 | Menu nhóm theo việc | Thanh bên | admin, nv_kt | Đăng nhập lần lượt | Xem thanh bên; mở `/wiki/graph`, `/playlists`, `/refine`, `/learn/design`, `/studio/facebook` | Trên cùng *Việc của tôi*; nhóm **Tri thức** (Kho tư liệu · VCWIKI · Hộp duyệt), **Nội dung** (Dự án marketing · Viết nhanh · **Chiến dịch** · Cài đặt nội dung), **Học tập**, **Tổ chức**; *Trò chuyện Claude*, *Hướng dẫn* ở cuối. nv_kt không có *Người dùng & lĩnh vực*, *Lộ trình học*. Ở các trang con thì mục cha sáng (VCWIKI, Kho tư liệu, Lộ trình học, Cài đặt nội dung) | SYS-27 | Cao |  |  |
| UAT-CORE-015 | Việc của tôi | `/` | tp_kt | Seed UAT (có đề xuất chờ, bài được giao) | Mở trang đầu | `h1` *Việc của tôi*, câu chào có tên và tổng số việc; 5 dòng việc (chờ duyệt, bài học được giao + hạn gần nhất, bài chờ chấm (khi có quyền), nội dung viết lỗi, nguồn lỗi của tôi), dòng 0 việc hiện mờ; bấm từng dòng tới đúng màn đã lọc và số trên màn đó bằng số ở dòng | SYS-27 | Cao |  |  |
| UAT-CORE-016 | Số liệu kho và tự làm mới | `/` | nv_kt + người thứ hai | Mở *Việc của tôi* | 1. Thu gọn / mở *Số liệu kho* 2. Bấm ô *Video lỗi* 3. Người thứ hai nạp một link | 2: sang `/kb/videos?status=error`; 3: trong ~30 giây *Nguồn nạp gần đây* có link mới, chữ "Cập nhật lúc hh:mm" đổi; khối *Thẻ mới duyệt* dẫn tới `/wiki?card=` | SYS-27, TT-14 | TB |  |  |
| UAT-CORE-017 | Huy hiệu số việc | Thanh bên | ks_kt | Có đề xuất chờ ks_kt duyệt | Xem *Hộp duyệt*, *Việc của tôi*; duyệt một đề xuất rồi đợi ≤ 60 giây | Số cạnh tên menu bằng số trên trang; trình đọc màn hình đọc "Hộp duyệt, n việc chờ"; số giảm sau khi duyệt | SYS-27 | TB |  |  |
| UAT-CORE-018 | Điện thoại | mọi trang | nv_kt | Rộng 390 px | Dùng thanh dưới; bấm *Thêm*; mở *Hỏi Claude* | Thanh dưới 5 nút (*Việc của tôi · Tri thức · Nội dung · Học tập · Thêm*); *Thêm* mở ngăn kéo đủ nhóm + tài khoản; nút *Hỏi Claude* không che thanh dưới; không cuộn ngang | SYS-27 | Cao |  |  |
| UAT-CORE-019 | Menu tài khoản bằng bàn phím | Thanh bên | nv_kt | — | Tab tới tên mình, Enter, ↓ ↑, Esc; chọn *Đổi mật khẩu* | Menu mở / đóng bằng phím, Esc trả tiêu điểm về nút; *Đổi mật khẩu* mở hộp riêng, lưu xong báo "Đã đổi mật khẩu" | SYS-29 | TB |  |  |

### B.4 Tổng quan (dashboard)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-040 | 6 thẻ số liệu — **Loại bỏ** (v0.4, UI-2: trang đầu thành *Việc của tôi*; thay bằng UAT-CORE-015, 016) | `/` | tp_kt | Dữ liệu seed | Mở Tổng quan | Đủ 6 thẻ: Video trong kho, Kênh, Đã chuyển chữ, Video lỗi, Nguồn tri thức, Thẻ VCWIKI (kèm số đã duyệt); số khớp với `/kb/videos`, `/kb/channels`, `/wiki` | BA 9 (Tổng quan) | Cao |  |  |
| UAT-CORE-041 | Số nguồn / thẻ theo quyền kho | `/` | tp_kt, outsider | Dữ liệu seed | So *Nguồn tri thức* và *Thẻ VCWIKI* giữa hai người | outsider chỉ đếm kho công khai → số nhỏ hơn tp_kt; số video / kênh như nhau (kho video dùng chung) | SYS-05, BA 2 | Cao |  |  |
| UAT-CORE-042 | Tự làm mới — **Loại bỏ** (v0.4, UI-2: tự làm mới 30 giây; thay bằng UAT-CORE-016) | `/` | nv_kt + người thứ hai | Mở Tổng quan | Người thứ hai nạp một link ở `/kb` | Trong ~4 giây, *Nguồn tri thức* tăng, hint "… đang xử lý", *Nguồn nạp gần đây* có dòng mới mà không cần tải lại trang | BA 9 | Trung bình |  |  |
| UAT-CORE-043 | Link đi tiếp | `/` | nv_kt | Có nguồn, video | Bấm *+ Nạp nguồn*, một dòng *Nguồn nạp gần đây*, một dòng *Nhiều lượt xem nhất* | Lần lượt tới `/kb`, `/kb?source=<id>` (mở đúng nguồn), `/kb/videos?sort=views&v=<id>` | BA 9 | Trung bình |  |  |
| UAT-CORE-044 | DB trống — **Loại bỏ** (v0.4, UI-2: thay bằng UAT-CORE-015) | `/` | admin | DB mới (UAT-CORE-021) | Mở Tổng quan | Số 0, "Chưa có nguồn nào.", "Chưa có video."; không lỗi | BA 9 | Thấp |  |  |

### B.5 Giao diện trên điện thoại

Thiết bị: iPhone (Safari) hoặc Chrome DevTools chế độ thiết bị 375 × 812 và 390 × 844. Mạng nội bộ: mở bằng IP máy chủ chỉ khi Vận hành cho phép (mặc định chỉ nghe 127.0.0.1 — dùng DevTools).

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-050 | Thanh bên thành thanh ngang | mọi trang | nv_kt | Rộng 375 px | Xem đầu trang, vuốt ngang menu | Menu nằm ngang, cuộn ngang được, ẩn tên nhóm và chữ thương hiệu; nút tài khoản ở bên phải | BA 9 | Cao |  |  |
| UAT-CORE-051 | Menu tài khoản trên điện thoại | Thanh ngang | nv_kt | Rộng 375 px | Bấm avatar → *Đổi mật khẩu* → *Huỷ* → *Đăng xuất* | Menu mở xuống dưới, không tràn màn hình, bấm được mọi nút | SYS-02, SYS-04 | Cao |  |  |
| UAT-CORE-052 | Tổng quan một cột — **Loại bỏ** (v0.4, UI-2: bố cục điện thoại mới; thay bằng UAT-CORE-018) | `/` | nv_kt | Rộng 375 px | Cuộn hết trang | Thẻ số liệu 2 cột; hai khối danh sách xếp chồng; không cuộn ngang cả trang | BA 9 | Trung bình |  |  |
| UAT-CORE-053 | Bảng rộng | `/kb/videos`, `/kb/channels` | nv_kt | Rộng 375 px | Mở bảng | Bảng cuộn ngang trong khung riêng, phần còn lại của trang không bị kéo rộng | BA 9 | Trung bình |  |  |
| UAT-CORE-054 | Màn đăng nhập | `/` | — | Rộng 375 px, chưa đăng nhập | Đăng nhập | Form vừa màn hình, bàn phím không che nút *Đăng nhập* | SYS-02 | Trung bình |  |  |
| UAT-CORE-055 | Chat nhanh toàn màn hình | mọi trang trừ `/chat` | nv_kt | Rộng 375 px | Bấm *✺ Hỏi Claude* | Cửa sổ chat chiếm cả màn hình, đóng được | BA 9 (Chat nhanh) | Thấp |  |  |
| UAT-CORE-056 | Chế độ tối | mọi trang | nv_kt | Điện thoại / máy bật Dark mode | Mở Tổng quan, VCWIKI | Màu nền tối, chữ đọc rõ, không còn khối trắng chói | — | Thấp |  |  |

### B.6 AI dự phòng (không có khoá → Claude Code CLI → AI local)

Chạy UAT với `--ai`. Thứ tự đúng theo code (`kb/wiki.py _fallback`): Claude API (có khoá) → việc thuần chữ chạy `claude -p` → CLI lỗi / chưa có thì AI local Ollama → việc có ảnh / PDF bắt buộc chờ Claude API.

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-060 | Không có AI nào | `/refine`, `/kb` | tp_kt | `bash start_uat.sh` (không `--ai`) | Nạp một bài viết vào *Kho Kỹ thuật VCgarage* | Chuyển chữ xong, tài liệu nằm ở "Chờ AI"; `/refine` báo "AI chưa sẵn sàng: … Dựng thẻ và tổng hợp theo cụm đều tạm dừng" | SYS-07 | Cao |  |  |
| UAT-CORE-061 | Không khoá, có CLI → chạy CLI trước | `/kb`, panel thẻ | tp_kt + Vận hành | `ANTHROPIC_API_KEY=` rỗng, `claude` đã đăng nhập, Ollama chạy; `bash start_uat.sh --ai` | 1. Nạp một bài viết 2. Chờ dựng thẻ 3. Mở thẻ vừa tạo | `/kb` báo "Đang chạy bằng Claude Code CLI (tài khoản Claude trên máy) … CLI lỗi thì AI local (gemma3:12b) làm thay"; thẻ nháp có người tinh chế / model dạng `cli:<model>` | 6.6 (v0.30), SYS-17 | Cao |  |  |
| UAT-CORE-062 | CLI lỗi → AI local | như trên | Vận hành | Như 061 nhưng `CLAUDE_BIN=/khong/co` | Nạp một bài viết ngắn (< ~9 000 ký tự) | Thẻ vẫn được dựng; model ghi `local:gemma3:12b` | 6.6, SYS-17 | Cao |  |  |
| UAT-CORE-063 | Đảo thứ tự: AI local trước | như trên | Vận hành | `CLAUDE_CLI_FIRST=off` | Nạp một bài viết ngắn | Thẻ dựng bằng `local:gemma3:12b`; banner `/kb` ghi "Đang chạy bằng AI local (gemma3:12b)" | 6.6 | Trung bình |  |  |
| UAT-CORE-064 | Việc dài quá context local | như trên | Vận hành | `CLAUDE_CLI_FIRST=off`, `LOCAL_LLM_CTX=4096`, CLI sẵn sàng | Nạp bài viết dài (~20 000 ký tự) | Không chạy local (tránh Ollama cắt đầu vào); việc chuyển sang CLI, model `cli:…` | 6.6 | Trung bình |  |  |
| UAT-CORE-065 | Việc có ảnh / PDF scan chờ Claude | `/kb` | tp_kt | Không khoá, CLI + local sẵn sàng | Nạp một ảnh chụp tài liệu | Chữ đọc bằng Tesseract (ghi rõ trong nhật ký nguồn); bước chỉ Claude làm được báo "chờ Claude", không đưa sang CLI / local | WK-16, 6.6 | Trung bình |  |  |
| UAT-CORE-066 | Tắt dự phòng | `/refine` | Vận hành | `AI_FALLBACK=off`, không khoá | Nạp bài viết | Tài liệu ở "Chờ AI", không chạy CLI / local | 6.6 | Thấp |  |  |
| UAT-CORE-067 | Một việc nặng một lúc | `/refine` | tp_kt | `--ai`; hàng chờ có video + tài liệu chờ dựng thẻ | Nạp 2 video + 1 bài viết cùng lúc, theo dõi `/refine` | Mỗi lúc chỉ một việc chạy; khối trạng thái ghi "đang làm <việc> — <việc khác> tạm dừng"; chuyển chữ video xong cả loạt rồi mới dịch / dựng thẻ | WK-17 | Cao |  |  |
| UAT-CORE-068 | Trạng thái AI ở Kho tư liệu | `/kb` | tp_kt | `--ai` | Mở `/kb` | Hiện đúng tình trạng AI (Claude / CLI / AI local), model, lỗi nếu có | SYS-07 | Trung bình |  |  |

### B.7 Job vector hoá ban đêm

Chạy trên máy chủ thật (không phải UAT) hoặc DB QA, do Vận hành thực hiện; chỉ đọc kết quả, không sửa dữ liệu.

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-070 | Cài Qdrant + job đêm | Terminal | Vận hành | Có Internet | `bash setup_vector_db.sh` rồi `launchctl list \| grep vcpv` | In "Qdrant đang chạy: http://127.0.0.1:6333" và "Job đêm: 00:30 mỗi đêm"; có 2 nhãn `com.vcpv.qdrant`, `com.vcpv.nightly-vectors`; chạy lại lệnh không lỗi | 11.1 (Môi trường), SYS-22 | Cao |  |  |
| UAT-CORE-071 | Qdrant tự bật lại | Terminal | Vận hành | UAT-CORE-070 | `kill` tiến trình qdrant, chờ 10 s, `curl -s 127.0.0.1:6333/readyz` | launchd tự bật lại, `readyz` trả OK | 11.1 | Trung bình |  |  |
| UAT-CORE-072 | Chạy job ngay | Terminal | Vận hành | UAT-CORE-070 | `launchctl kickstart gui/$(id -u)/com.vcpv.nightly-vectors`, xem `output/logs/nightly_vectors.log` | Log có dòng "bắt đầu", chạy `backfill_embeddings.py` rồi `index_raw_vectors.py`, dòng "kết thúc (mã 0)" | SYS-22 | Cao |  |  |
| UAT-CORE-073 | Tự bật Ollama / Qdrant | Terminal | Vận hành | Tắt Ollama và Qdrant trước | Chạy `bash nightly_vectors.sh` | Log ghi "Ollama chưa chạy — khởi động…", "Qdrant chưa chạy — khởi động…", job vẫn chạy xong | 11.1 | Trung bình |  |  |
| UAT-CORE-074 | Dừng êm theo giờ | Terminal | Vận hành | Có nhiều tài liệu chưa nạp | `STOP_AT=<giờ hiện tại + 2 phút> bash nightly_vectors.sh` | Tới giờ thì dừng êm, không lỗi; chạy lại lần sau chỉ nạp phần còn thiếu (tài liệu đã nạp đúng nội dung được bỏ qua) | SYS-22 | Trung bình |  |  |
| UAT-CORE-075 | Không chạy chồng việc nặng của máy chủ | `/refine` + log | Vận hành | Máy chủ đang chuyển chữ video | Kickstart job đêm | Job chờ chỗ (`vector_tho` đứng sau `tho`); `/refine` cho thấy việc vector hoá tầng thô đang chờ; không có hai model nặng cùng nạp (xem `ollama ps`) | WK-17 | Cao |  |  |
| UAT-CORE-076 | Kết quả dùng được | `/kb?mode=content`, MCP `search_documents` | tp_kt | Job chạy xong | Tìm theo nội dung một cụm từ nằm trong thân tài liệu (không ở tiêu đề), thử cả câu diễn đạt khác nghĩa gần | Tài liệu đúng xuất hiện ở đầu kết quả | WK-35, SYS-22 | Trung bình |  |  |
| UAT-CORE-077 | Gỡ job | Terminal | Vận hành | — | `bash setup_vector_db.sh --remove` | Gỡ 2 nhãn launchd; dữ liệu `data/qdrant` còn nguyên | 11.1 | Thấp |  |  |
| UAT-CORE-078 | Cập nhật thẻ hằng ngày chạy sau job đêm | `/kb?source=`, `/refine`, log | Vận hành | Bản QA / UAT `--ai`; có tài liệu *Chờ cập nhật thẻ (lượt hằng ngày)* | 1. Không đặt `CARD_UPDATE_AT`, để máy chủ chạy qua 07:45 (hoặc đặt `CARD_UPDATE_AT=<giờ hiện tại + 2 phút>` rồi khởi động lại) 2. Xem `/refine` và nhãn tài liệu | Trước 07:45 tài liệu vẫn chờ; sau 07:45 được thả vào hàng dựng thẻ một lần trong ngày; không chạy trong khung job vector đêm 00:30–07:30 | WK-32 | Trung bình |  |  |

### B.8 Script chạy / dừng hệ thống

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-080 | Chạy bản thật | Terminal, `http://localhost:8000` | Vận hành | Cổng 8000 trống | `bash start_web.sh` | Tự bật MongoDB nếu chưa chạy; kiểm Ollama / model / LibreOffice (chỉ cảnh báo, không chặn); build FE; in "Mở: http://localhost:8000"; dòng `[tự nạp …] đang theo nhánh develop @ <commit>` | 11.1 (Triển khai) | Cao |  |  |
| UAT-CORE-081 | Từ chối khi cổng bận | Terminal | Vận hành | Bản thật đang chạy | Chạy lại `bash start_web.sh` | In "Cổng 8000 đang được tiến trình <pid> dùng … kill <pid>", thoát mã 1, máy chủ cũ không bị ảnh hưởng | 11.1 | Cao |  |  |
| UAT-CORE-082 | Tự nạp code mới | Terminal | Vận hành | Bản thật chạy trên `develop` | Merge một commit đổi `frontend/` và `backend/` vào `develop` | Trong ~15 s log: "commit mới …", "build lại FE…", "khởi động lại BE…", "đã nạp <commit>"; tải lại trang thấy thay đổi | 11.1 | Cao |  |  |
| UAT-CORE-083 | Code mới lỗi import | Terminal | Vận hành | Như 082 | Commit (trên nhánh thử) một lỗi cú pháp trong `backend/app` rồi merge | Log "code mới import lỗi — giữ máy chủ cũ" + 5 dòng lỗi; máy chủ cũ vẫn phục vụ | 11.1 | Cao |  |  |
| UAT-CORE-084 | Không nạp khi đổi nhánh / đang merge | Terminal | Vận hành | Như 082 | `git checkout` nhánh khác trên cây chính | Không khởi động lại; về lại `develop` thì theo dõi tiếp | 11.1 | Trung bình |  |  |
| UAT-CORE-085 | Chế độ dev | Terminal, `:5173` | Vận hành | Cổng 8000, 5173 trống | `bash start_web.sh --dev`, sửa một chữ trong `frontend/src` và một file `backend/app` | FE cập nhật ngay (HMR); BE tự reload | 11.1 | Thấp |  |  |
| UAT-CORE-086 | Dừng bản thật | Terminal | Vận hành | Bản thật chạy | `Ctrl+C` hoặc `kill -TERM <pid của start_web.sh>` | BE tắt trong ≤ 30 s (quá thì `kill -9`), cổng 8000 được nhả; khởi động lại thì việc dở chạy tiếp | 11.1 (Độ bền) | Cao |  |  |
| UAT-CORE-087 | UAT không đụng bản thật | Terminal | Vận hành | Bản thật + UAT cùng chạy | Chạy `bash start_uat.sh --reset`; đếm người dùng ở hai DB | `tiktok_to_text` không đổi; `frontend/dist` không bị build lại; UAT ở DB `_uat` | 11.1 (UAT) | Cao |  |  |
| UAT-CORE-088 | Tắt worker nền khi dev | Terminal | Vận hành | Máy dev, không dùng DB thật | 1. `KB_WORKERS=off bash start_web.sh --dev` 2. Nạp một link video 3. Dừng, chạy lại không đặt biến | 1: log có `[worker] KB_WORKERS=off — bỏ qua …`, API + giao diện dùng bình thường 2: nguồn nằm hàng chờ, không chuyển chữ 3: worker bật, nguồn được xử lý | 11.1 | Thấp |  |  |
| UAT-CORE-089 | Quên mật khẩu quản trị | Terminal | Vận hành | — | `cd backend && ../.venv/bin/python scripts/create_user.py admin@uat.test "Quản trị UAT" --admin` (với `MONGO_DB=tiktok_to_text_uat`) (nhập mật khẩu mới khi được hỏi) | In "Đã đặt lại mật khẩu cho …"; tài khoản được mở khoá, mọi phiên cũ bị đăng xuất; đăng nhập bằng mật khẩu mới được | SYS-03 | Trung bình |  |  |
| UAT-CORE-094 | Tự dò `mongod.conf` khi bật MongoDB | Terminal | Vận hành | Máy QA / máy mới; MongoDB đang **tắt** (không làm trên máy đang phục vụ bản thật) | 1. Chạy `bash start_uat.sh` 2. Máy chỉ có `/opt/homebrew/etc/mongod.conf`: chạy lại 3. Đặt `MONGOD_CONF=/đường/không/có` và tạm đổi tên cả hai file (máy thử) | Bước 1: in "MongoDB chưa chạy — khởi động (cấu hình /usr/local/etc/mongod.conf)…" nếu có file đó. Bước 2: dùng `/opt/homebrew/etc/mongod.conf`. Bước 3: báo "không tìm thấy mongod.conf" + cách bật tay, thoát mã 1, không chạy BE | 11.1 (Môi trường) | Trung bình |  |  |
| UAT-CORE-095 | Chạy bản QA | Terminal, `http://127.0.0.1:8300` | Vận hành | Cổng 8300 trống | `bash start_qa.sh` (thêm `--vite` nếu chưa có `frontend/dist`) | In khung *BẢN QA*: Database `tiktok_to_text_qa`, thư mục `output/qa_raw`…, AI tắt, nhánh @ commit; BE nghe `127.0.0.1:8300`; đăng nhập được, không đụng phiên `localhost:8000` | 11.1 (Bản QA) | Cao |  |  |
| UAT-CORE-096 | [Âm] Bản QA từ chối DB thật | Terminal | Vận hành | — | 1. `MONGO_DB=tiktok_to_text bash start_qa.sh` 2. `MONGO_DB=tiktok_to_text_uat bash start_qa.sh` | Cả hai in "TỪ CHỐI: MONGO_DB=… không phải DB QA", thoát mã 1, không bật máy chủ, không ghi gì vào DB | 11.1 (Bản QA) | Cao |  |  |
| UAT-CORE-097 | Bản QA từ chối khi cổng bận | Terminal | Vận hành | Bản QA đang chạy | Chạy lại `bash start_qa.sh` | In "Cổng 8300 đang được tiến trình <pid> dùng — tắt nó trước", thoát mã 1 | 11.1 | Thấp |  |  |
| UAT-CORE-098 | Thiếu thư viện reranker báo rõ | Terminal, log BE | Vận hành | venv thử **không** có torch (`bash setup.sh --no-ml` trên máy thử) | Chạy bản QA, tìm một câu ở `/wiki` | Tìm kiếm vẫn trả kết quả; log BE có đúng một dòng "Reranker: TẮT — thiếu thư viện … Cài: .venv/bin/pip install -r backend/requirements-ml.txt" | 11.1 (Môi trường) | Thấp |  |  |

### B.9 Sao lưu và khôi phục

Code **chưa có** sao lưu tự động (*Chưa làm (backlog)*). Các ca dưới kiểm quy trình tay bằng `mongodump`; ca tự động ghi "Không kiểm — chức năng chưa có".

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| UAT-CORE-090 | Sao lưu tay DB | Terminal | Vận hành | UAT đang có dữ liệu | `mongodump --db tiktok_to_text_uat --archive=output/uat/backup-$(date +%F).gz --gzip` | File được tạo, dung lượng > 0 | 11.1 (Độ bền), 18.5 | Cao |  |  |
| UAT-CORE-091 | Khôi phục vào DB khác | Terminal, UAT | Vận hành | UAT-CORE-090 | `mongorestore --archive=… --gzip --nsFrom='tiktok_to_text_uat.*' --nsTo='tiktok_to_text_uat_restore.*'`; chạy BE với `MONGO_DB=tiktok_to_text_uat_restore` | Đăng nhập được bằng tài khoản seed; số thẻ, nguồn khớp bản gốc | 11.1 | Cao |  |  |
| UAT-CORE-092 | Sao lưu dữ liệu thô | Terminal | Vận hành | — | Sao chép `output/uat/raw` (bản thật: `data/raw`) ra ổ khác, mở một nguồn ở bản khôi phục | File thô mở được (xem trước, nghe / xem media) | 1.5 (Lưu thô trước) | Trung bình |  |  |
| UAT-CORE-093 | Dựng lại chỉ mục vector | Terminal | Vận hành | Sau khôi phục, Qdrant trống | `index_raw_vectors.py` + `backfill_embeddings.py` trên DB khôi phục | Tìm theo nội dung chạy lại được; không cần sao lưu `data/qdrant` | SYS-22 | Thấp |  |  |
| UAT-CORE-099 | Xuất trọn dữ liệu chuyển máy chủ | Terminal | Vận hành | MongoDB + Qdrant đang chạy | `bash export_du_lieu.sh` | Thư mục `output/migration/<giờ>/` có `mongo/`, `qdrant/`, `files/`, `MANIFEST.txt`, `SHA256SUMS`, `import_du_lieu.sh`; MANIFEST ghi số bản ghi từng collection, số điểm Qdrant, số file; Qdrant không còn snapshot tạm | SYS-42 | Cao |  |  |
| UAT-CORE-100 | Nạp bó dữ liệu ở máy đích | Terminal, máy đích | Vận hành | UAT-CORE-099; máy đích cài theo DESIGN 12.1 | 1. `bash <bó>/import_du_lieu.sh --kiem-tra` 2. chạy không cờ 3. chạy lại lần hai không `--drop` | 1: báo checksum khớp, không ghi gì. 2: mọi collection dòng ✓, số điểm Qdrant khớp, đăng nhập bằng tài khoản cũ được, mở được nguồn thô + media. 3: dừng vì DB đích đã có dữ liệu | SYS-42 | Cao |  |  |

---


## Phần C — WK · TT · GOV

### Dữ liệu và nhãn điều kiện

Chỉ liệt kê chức năng **đã có trong code** (`develop` `9ff73e4`).

**Chạy môi trường UAT:**
- Lệnh: `bash start_uat.sh`. Máy chủ BE ở `:8400`, giao diện ở **http://127.0.0.1:5400**, DB `tiktok_to_text_uat`.
- `--reset`: dựng lại từ đầu. `--seed-only`: chỉ dựng lại dữ liệu mẫu (`backend/scripts/seed_uat.py`).
- Không dùng `localhost:8000`: đó là bản thật.

**Tài khoản:** mật khẩu chung `Test@12345`. Chi tiết ở `docs/test-claude-extension/_chung.md`.

| Tài khoản | Vai trò trong kiểm thử |
|---|---|
| ADMIN `admin@uat.test` | Quản trị; tạm đóng vai TGĐ ở bước 2 |
| GD.GARAGE `gd.garage@uat.test` | Chủ nhánh `nen.ky-thuat` — người duyệt bước 2 của thẻ kỹ thuật. Không ở trong Kho Kỹ thuật |
| TP.KT `tp.kt@uat.test` | Chủ "Kho Kỹ thuật VCgarage" |
| KS.KT, NV.KT | Được sửa trong Kho Kỹ thuật. KS.KT duyệt được bước 1 |
| TTS.KT | Chỉ xem trong Kho Kỹ thuật |
| TP.KD, NV.KD | "Kho Kinh doanh VCpart" (riêng tư) |
| HR.LND | Chủ "Kho Công khai VCPV" |
| OUTSIDER | Không thuộc kho nào |

**Dữ liệu mẫu:**
- 10 thẻ đã duyệt, trong đó có "Mã lỗi DTC là gì", "Quy trình đọc lỗi bằng máy chẩn đoán OBD", "Thay má phanh: siết đúng lực" (đã có 2 phiên bản) và "Chính sách chiết khấu đại lý 2026 (MẬT KINH DOANH)".
- 2 thẻ nháp: "[NHÁP] Quy trình kiểm tra hệ thống làm mát" (tác giả NV.KT) và "[NHÁP] Khách gara ưu tiên báo giá rõ trước khi sửa" (tác giả KS.KT).
- 4 video mẫu:
  - Kênh `garage_tips`: một video `ok` (P0300) và một video `no_speech`.
  - Kênh `phutung_pro`: một video `ok` và một video `error`.

**Nhãn ở cột "Tiền điều kiện":**
- **[AI]**: cần `bash start_uat.sh --ai` (Claude API, `claude -p` hoặc Ollama đang chạy).
- **[MẠNG]**: cần Internet (yt-dlp, web, Google, DuckDuckGo / Bing, edge-tts).
- **[QDRANT]**: cần Qdrant `:6333` và đã chạy `index_raw_vectors.py` trên DB UAT.

**Đối chiếu gói test sẵn có** trong `docs/test-claude-extension/`:
- P07 (K01–K09): Kho tư liệu.
- P06 (W01–W08): VCWIKI.
- P01 (D01–D18): duyệt.
- P09 (X04, X05): tinh chế, tìm video.
- P10 (I02, I03, I07): AI.

---

### 1. Kho tư liệu — nạp nguồn (WK)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-WK-001 | Trang Kho tư liệu khi chưa có AI | `/kb` | NV.KT | UAT mặc định (không AI) | Mở `/kb` | Có khung "AI chưa sẵn sàng…" và 3 tab Nguồn / Video / Kênh; nạp nguồn vẫn được | WK-11, WK-17 | Cao |  |  |
| UAT-WK-002 | Nhận diện link khi dán | `/kb`, ô nạp chung | NV.KT | — | Dán nhiều dòng gồm `@kenh`, link TikTok, YouTube, Google Docs, web, một dòng `#ghi chú`, một dòng không phải link | Mỗi dòng hiện loại tự nhận. Dòng `#` bị bỏ qua. Dòng không phải link được báo. Link Google hiện trạng thái quyền truy cập | WK-01, WK-11, WK-15 | Cao |  |  |
| UAT-WK-003 | Nạp file PDF có dựng thẻ | `/kb` | NV.KT | File PDF có lớp chữ | Chọn Kho Kỹ thuật, tải PDF, để "Dựng thẻ: tự động" | Nguồn đi Chờ xử lý → Đang chuyển chữ → **Chờ cấu hình AI**; tài liệu có chữ + `[Trang n]`; công cụ chuyển chữ được ghi | WK-02, WK-12 | Cao |  |  |
| UAT-WK-004 | Nạp ảnh gộp album, chỉ chuyển chữ; nạp trùng | `/kb` | NV.KT | 2 file ảnh | Chọn 2 ảnh, bật gộp, chọn "Chỉ chuyển chữ", nạp. Nạp lại đúng 2 ảnh đó | Một nguồn album gồm `## Ảnh 1`, `## Ảnh 2` (Tesseract), trạng thái "Đã chuyển chữ". Lần nạp thứ hai báo trùng | WK-02, WK-13 | TB |  |  |
| UAT-WK-005 | Giới hạn và định dạng file | `/kb` | NV.KT | File `.exe` hoặc file > 100 MB | Tải lên | Báo sai định dạng / quá dung lượng; không tạo nguồn | WK-02 | TB |  |  |
| UAT-WK-006 | Người chỉ xem không nạp được vào kho | `/kb` | TTS.KT | — | Chọn Kho Kỹ thuật ở ô nạp | Kho không có trong danh sách, hoặc API trả 403 | WK-01, SYS-05 | Cao |  |  |
| UAT-WK-007 | Nạp link video / kênh thật | `/kb` | NV.KT | [MẠNG] | Nạp 1 link YouTube ngắn và 1 kênh với số video tối đa 2 | Nguồn vào làn Whisper; mỗi video một tài liệu có mốc `[mm:ss]`; bảng Video có thêm video; mặc định chỉ chuyển chữ | WK-01, TT-07, WK-19 | Cao |  |  |
| UAT-WK-008 | Nạp lại link kênh đã có | `/kb` | NV.KT | Có UAT-WK-007 | Dán lại link kênh | Nhận "Quét lại", chỉ lấy video mới | WK-01, TT-05 | TB |  |  |
| UAT-WK-009 | Gợi ý ngôn ngữ lời nói | `/kb` | NV.KT | [MẠNG] | Dán link kênh tiếng Trung / Anh | Dưới ô *Ngôn ngữ lời nói* có gợi ý; mặc định vẫn là *Tự nhận* | WK-31 | Thấp |  |  |
| UAT-WK-010 | Nạp ghi âm, chọn loại ghi âm | `/kb` | NV.KT | File mp3 ngắn; máy có Whisper | Tải lên, chọn "Cuộc họp" | Làn nặng; chữ có `[mm:ss]`; nghe lại được trong ngăn chi tiết | WK-14 | TB |  |  |
| UAT-WK-011 | Nạp Word / PowerPoint / Excel | `/kb` | NV.KT | File .docx / .pptx / .xlsx | Tải lên | Word giữ tiêu đề / bảng; PowerPoint theo `## Slide n`; Excel mỗi sheet một tài liệu | WK-18 | TB |  |  |
| UAT-WK-012 | Ghi chú của bạn khi nạp nguồn | `/kb`, khung nạp | NV.KT | — | Dán 1 link bài viết, gõ vào ô *Ghi chú của bạn* "Thích phần quy trình kiểm tra phanh", xem bộ đếm; thử dán đoạn > 2000 ký tự; bấm *Nạp vào kho*, mở nguồn vừa nạp | Ô có nhãn + dòng gợi ý + bộ đếm *n/2000 ký tự*; không gõ quá 2000 ký tự được. Nạp xong ô trống lại; chi tiết nguồn hiện đúng ghi chú. Áp dụng như nhau khi tải file / ghi âm / dán ảnh | WK-44 | TB |  |  |
| UAT-WK-013 | Sửa ghi chú trong chi tiết nguồn, quyền | `/kb?source=<id>` | NV.KT, TTS.KT | Có nguồn ở *Kho Kỹ thuật VCgarage* | NV.KT: sửa ghi chú, bấm *Lưu ghi chú*; tải lại trang. TTS.KT (viewer) mở cùng nguồn | NV.KT: nút *Lưu ghi chú* chỉ bật khi đã sửa; toast "Đã lưu ghi chú…"; nhật ký nguồn có *Sửa ghi chú của người nạp*; tải lại vẫn còn. TTS.KT thấy khối *Ghi chú của người nạp* dạng chữ, không có ô sửa / nút lưu | WK-44, SYS-05 | TB |  |  |
| UAT-WK-014 | AI dùng ghi chú làm gợi ý phân loại | `/kb` → thẻ nháp ở `/wiki` | NV.KT | [AI] | Nạp 1 bài viết về bảo dưỡng xe kèm ghi chú "Chú ý phần định giá giờ công, dùng cho kênh bán hàng", để *Dựng thẻ* | Thẻ nháp dựng xong; lĩnh vực / ý nhấn mạnh nghiêng theo ghi chú khi tài liệu có nội dung đó; câu ghi chú **không** bị chép thành nội dung hay `evidence` của thẻ | WK-44 | Thấp |  |  |

### 2. Kho tư liệu — chi tiết nguồn, hàng chờ, lấy lại chữ (WK)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-WK-020 | Bộ lọc nguồn, tag tài liệu | `/kb` | NV.KT | Có ≥ 2 nguồn | Lọc theo loại (có đếm), trạng thái, lĩnh vực, ô tìm; mở nguồn, thêm tag cho tài liệu | Danh sách lọc đúng; tag lưu lại (`PUT /kb/documents/{id}/tags`) và gợi ý từ bộ tag chung | WK-03, WK-04 | Cao |  |  |
| UAT-WK-021 | Xem dữ liệu thô trong app | `/kb?source=` → *Xem* | NV.KT | Nguồn PDF, docx, xlsx | Bấm *Xem* từng file | PDF trong iframe; Word → PDF (cần LibreOffice); Excel → lưới có tab sheet; Esc đóng; *Tải về* đúng tên | WK-29 | TB |  |  |
| UAT-WK-022 | Xử lý lại, dừng, xoá nguồn | `/kb?source=` | NV.KT | Nguồn có thẻ nháp và 1 thẻ đã duyệt | Bấm *Xử lý lại*, *Dừng* khi đang chờ, rồi *Xoá* | Xử lý lại → Chờ xử lý (đang chạy thì 409). Dừng → Đã dừng. Xoá: mất dữ liệu thô + thẻ nháp, **thẻ đã duyệt còn**, gắn "nguồn đã xoá" | WK-04, 13.1 | Cao |  |  |
| UAT-WK-023 | Ưu tiên nguồn + dự kiến thời gian | `/kb` | NV.KT | ≥ 2 nguồn đang chờ cùng làn | Bấm *Ưu tiên* nguồn xếp sau | Nguồn lên đầu hàng; hiện thứ tự và giờ dự kiến xong; kênh đang chạy nhường sau video hiện tại (nhật ký "Tạm nhường") | WK-21 | TB |  |  |
| UAT-WK-024 | Khung "đang làm / tạm dừng" (một việc nặng) | `/kb`, `/refine` | NV.KT | [AI] + có việc chép chữ và việc tinh chế cùng lúc | Quan sát khung hàng chờ | Báo *▶ Đang làm …* và *⏸ Tạm dừng, làm sau …*; chép chữ xong cả loạt rồi mới dịch / tinh chế | WK-17 (ai_slot) | TB |  |  |
| UAT-WK-025 | Lấy lại chữ nhiều video trong kênh | `/kb?source=<kênh>` | NV.KT | [MẠNG] + nguồn kênh | Chọn video (Shift chọn dải, *Ít chữ*, *Lỗi*) → *Lấy lại chữ* → xác nhận; rồi *Dừng lấy lại chữ* | Hộp xác nhận nêu số video + tổng thời lượng + cảnh báo lời đã sửa tay; tiến độ *Lấy lại chữ n/N*; trạng thái nguồn giữ nguyên | WK-30 | TB |  |  |
| UAT-WK-026 | Ngừng lấy chữ / Chạy tiếp tất cả | `/kb` | TP.KT | Có nguồn chờ | Lọc theo kho → *⏹ Ngừng lấy chữ* → xác nhận; rồi *▶ Chạy tiếp tất cả* | Đếm trước khi áp; chờ → Đã dừng; chạy tiếp giữ thứ tự nạp; nguồn không có quyền sửa bị bỏ qua | WK-33 | TB |  |  |
| UAT-WK-027 | Bảng video lỗi, giới hạn 3 lần | `/kb` → *⚠ Video lỗi* | NV.KT | Có video `error` (video mẫu `phutung_pro`) | Mở bảng, lọc nhóm lỗi, xem *Lịch sử lỗi*, bấm *Lấy lại chữ* | Nhãn *Lỗi n/3* hoặc *không tự thử lại*; đếm theo nhóm lỗi; lấy lại thủ công được | WK-37 | TB |  |  |
| UAT-WK-028 | Tìm theo nội dung tầng thô | `/kb?mode=content&q=` | NV.KT | [QDRANT] [AI] | Chuyển *Theo nội dung*, gõ câu, Enter; bấm `▶ mm:ss` | Thẻ kết quả có nhãn khớp, ≤ 3 đoạn tô từ khoá; mở chi tiết nguồn đúng tài liệu, video phát từ giây đó. Không có Qdrant thì báo *chưa sẵn sàng* | WK-35 | TB |  |  |
| UAT-WK-029 | Video nhúng + chữ đồng bộ | `/kb?source=<video>&doc=&t=` | NV.KT | [MẠNG] + nguồn YouTube / TikTok | Bấm ảnh bìa; bấm một câu `[mm:ss]` | Player chỉ tải khi bấm; bấm câu thì tua video; câu đang phát tô sáng. Video tắt nhúng thì báo và có nút *Mở trên …* | WK-29 | TB |  |  |
| UAT-WK-030 | TikTok nhúng không tự dừng khi chuyển tab (commit 9ff73e4) | Như UAT-WK-029 với video TikTok | NV.KT | [MẠNG] | Phát video TikTok → chuyển sang tab / cửa sổ khác 5 giây → quay lại; sau đó tự bấm dừng khi đang xem | Video tiếp tục phát khi tab ẩn / mất focus. Tự bấm dừng khi đang nhìn thì giữ dừng | WK-29 | TB |  |  |
| UAT-WK-031 | Song ngữ lời nói tiếng nước ngoài | `/kb/videos?v=` | NV.KT | [MẠNG] [AI] (AI local cho dịch) | Nạp 1 video tiếng Trung / Anh, để *Tự nhận* | Tài liệu có mục nguyên bản + bản dịch; chi tiết video có tab *Bản dịch tiếng Việt* (từng câu có mốc, ghi "Dịch máy …") | WK-24, TT-17 | TB |  |  |
| UAT-WK-032 | Ghi chép cả nguồn và từng video trong chi tiết nguồn | `/kb?source=<kênh>` | TTS.KT | Nguồn kênh nhiều video ở *Kho Kỹ thuật VCgarage* | TTS.KT (viewer) mở nguồn → khung *Ghi chép* gõ "Cả kênh: giọng rõ" → *Lưu ghi chép*; ở một video bấm *Ghi chép (0)* → gõ ghi chép → *Lưu ghi chép* | Toast "Đã lưu ghi chép"; khung *Ghi chép (2)*; nút ở video thành *Ghi chép (1)*; tên video trong danh sách là link mở đúng tài liệu; nhật ký nguồn có *Thêm ghi chép (…)*. Người chỉ xem vẫn ghi được | WK-45 | Cao |  |  |
| UAT-WK-033 | Gắn mốc thời gian khi đang xem video | `/kb?source=<video>` | NV.KT | [MẠNG] + nguồn YouTube / TikTok | Bấm *Xem video* ở một tài liệu, phát tới khoảng 1 phút → *Ghi chép (n)* → tick *Gắn mốc thời gian hiện tại* → lưu; bấm *▶ mm:ss* của ghi chép | Nhãn ô hiện giây đang phát; ghi chép hiện *▶ mm:ss*; bấm vào mở chi tiết nguồn đúng tài liệu và phát từ giây đó (`?source=&doc=&t=`) | WK-45, WK-35 | TB |  |  |
| UAT-WK-034 | Màn Ghi chép: tìm lại theo nguồn / tài liệu, URL | `/kb/notes` | NV.KT | Đã có ghi chép ở UAT-WK-032 và nguồn có ghi chú khi nạp | Mở tab *Ghi chép*; chọn *Nguồn* = kênh, rồi *Tài liệu* = một video; gõ chữ vào ô tìm; tick *Chỉ của tôi*; đổi *Loại* = *Khi nạp*; tải lại trang, sao chép link sang tab khác | Kết quả gom theo nguồn (tiêu đề nguồn + nền tảng + *Mở nguồn*), mới nhất trước; mục *Khi nạp* là ghi chú của người nạp; mọi bộ lọc + trang nằm trên URL, tải lại / mở link giữ nguyên; lọc không ra gì thì có câu gợi ý | WK-45 | Cao |  |  |
| UAT-WK-035 | Quyền sửa / xoá ghi chép | `/kb/notes`, `/kb?source=` | TTS.KT, NV.KT, TP.KT, outsider | Có ghi chép của TTS.KT và của NV.KT | TTS.KT: sửa ghi chép của mình, tìm nút sửa ở ghi chép của NV.KT. NV.KT (editor): thử xoá ghi chép của TTS.KT. TP.KT (chủ kho): xoá ghi chép của TTS.KT (xác nhận). outsider mở `/kb/notes?source_id=<id>` | Tác giả sửa / xoá được của mình; không ai khác thấy nút *Sửa* / *Xoá* trừ chủ kho; xoá qua hộp xác nhận, toast "Đã xoá ghi chép"; outsider không thấy ghi chép nào của kho KT (API 404) | WK-45, SYS-05 | Cao |  |  |
| UAT-WK-036 | AI dùng ghi chép làm gợi ý; xoá nguồn xoá ghi chép | `/kb?source=` → `/wiki` | NV.KT | [AI] | Ghi chép cho một tài liệu "Chú ý phần định giá giờ công" → *Dựng lại* tài liệu; sau đó xoá nguồn | Thẻ nháp nghiêng theo ghi chép khi tài liệu có nội dung đó, câu ghi chép **không** thành nội dung / `evidence`; xoá nguồn xong `/kb/notes` không còn ghi chép của nguồn | WK-45 | Thấp |  |  |
| UAT-WK-037 | Vừa xem video vừa ghi chép | `/kb?source=<kênh TikTok>` | NV.KT | Kênh đã nạp, video nhúng được | Bấm *Xem video* ở một tài liệu, bấm phát; trong lúc video chạy gõ vào ô *Ghi chép khi xem* rồi Ctrl / ⌘ + Enter; gõ tiếp ghi chép thứ hai; cuộn xuống đọc chữ; bấm *▶ mm:ss* của ghi chép đầu. Làm lại trên điện thoại | Ô ghi nằm ngay bên trái video (điện thoại: ngay dưới video), không phải cuộn; mốc bật sẵn, bằng giây lúc bắt đầu gõ; lưu xong con trỏ ở lại ô; cuộn chữ video vẫn thấy; bấm mốc thì video tua tới đúng giây, không tải lại ngăn kéo | WK-45 | TB |  |  |

### 3. Kho video mạng xã hội (TT)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-TT-001 | Danh sách video, lọc, tìm không dấu, sắp xếp | `/kb/videos` | NV.KT | 4 video mẫu | Gõ "p0300"; lọc kênh `garage_tips`, trạng thái, tag, ngày; sắp theo lượt xem | Tìm không dấu trúng video OBD; lọc và sắp đúng; phân trang 20 / 50 / 100 | TT-07 | Cao |  |  |
| UAT-TT-002 | Chi tiết video | `/kb/videos?v=7100000000000000001` | NV.KT | — | Mở ngăn chi tiết | Số liệu, caption, lời nói (sao chép), phụ đề theo mốc, tốc độ nói, link mở video gốc | TT-08 | Cao |  |  |
| UAT-TT-003 | Tag, ghi chú, sửa lời nói tay | Ngăn chi tiết video | NV.KT | — | Thêm tag, lưu ghi chú, sửa lời nói | Lưu được; lời nói đánh dấu đã sửa (`edited`); tag lan sang tài liệu / thẻ dẫn về video | TT-09 | TB |  |  |
| UAT-TT-004 | Tải SRT | Ngăn chi tiết video | NV.KT | Video có `segments` | Bấm *Tải SRT* | File `<id>.srt` đúng định dạng | TT-11 | Thấp |  |  |
| UAT-TT-005 | Chuyển chữ lại một video | Ngăn chi tiết video | NV.KT | [MẠNG] | Bấm *Chuyển chữ lại* | Tạo / xếp lại nguồn video với `force`; lỗi thì giữ kết quả cũ | TT-10 | TB |  |  |
| UAT-TT-006 | Xuất Excel theo bộ lọc | `/kb/videos` | NV.KT | — | Lọc kênh → *⭳ Xuất Excel* | File chỉ gồm tập đang lọc (≤ 5.000 dòng), cùng cột với CLI | TT-13 | TB |  |  |
| UAT-TT-007 | Tab Kênh | `/kb/channels` | NV.KT | — | Mở tab | 2 kênh mẫu với số video, số có lời nói, lỗi, tổng / trung bình lượt xem | TT-12 | TB |  |  |
| UAT-TT-008 | Tổng quan — **Loại bỏ** (v0.4, UI-2: số liệu kho nằm trong *Việc của tôi*; thay bằng UAT-CORE-016) | `/` | NV.KT | — | Mở trang chủ | Thẻ số liệu (video, kênh, thời lượng, lỗi, nguồn, thẻ VCWIKI), nguồn gần đây, top 5 video | TT-14 | TB |  |  |
| UAT-TT-009 | Đường dẫn cũ tự chuyển | `/jobs`, `/videos?v=…`, `/channels` | NV.KT | — | Gõ từng đường dẫn | Chuyển tới `/kb`, `/kb/videos?v=…` (giữ query), `/kb/channels` | WK-19 | Thấp |  |  |
| UAT-TT-010 | Bắt buộc đăng nhập | API `/api/videos` | Chưa đăng nhập | — | Gọi API khi chưa đăng nhập | 401 "Cần đăng nhập" | TT-16 | Cao |  |  |
| UAT-TT-011 | Tìm video theo chủ đề và nạp | `/discover` | NV.KT | [MẠNG]; [AI] để chấm liên quan (không có AI thì dùng câu gốc) | Gõ chủ đề → *✦ Phân tích từ khoá* → *⌕ Tìm video* → chọn → *⤓ Tải về & chuyển chữ…* (thử cả crawl kênh) | Có từ khoá, kết quả theo nền tảng, điểm liên quan 0–10, nhãn "Đã nạp"; nạp thành nguồn trong kho đã chọn | WK-39 | TB |  |  |

### 4. Tinh chế và tổng hợp theo cụm (WK)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-WK-040 | Dựng thẻ từ tài liệu | `/kb`, `/wiki` | NV.KT | [AI]; có UAT-WK-003 | Chờ tài liệu chạy | Tài liệu → Đã vào VCWIKI; ≤ 12 thẻ nháp có lĩnh vực (trong cây v2), trích dẫn, độ hữu ích; "AI tinh chế" ghi đúng engine (Claude / `cli:` / `local:`) | WK-05 | Cao |  |  |
| UAT-WK-041 | Dựng lại tài liệu / bật dựng thẻ cho nguồn chỉ chuyển chữ | `/kb?source=` | NV.KT | [AI] | Bấm *Dựng lại* một tài liệu; ở nguồn chỉ chuyển chữ bấm *Dựng thẻ* | Thẻ nháp AI cũ được thay; thẻ đã duyệt / thẻ tay giữ nguyên | WK-13, 13.2 | TB |  |  |
| UAT-WK-042 | Trang Tiến độ tinh chế — **Loại bỏ** (v0.4, UI-2: Tiến độ tinh chế là tab của Kho tư liệu; thay bằng UAT-WK-073) | `/refine` | TP.KT | Có tài liệu ở nhiều trạng thái | Xem thẻ số liệu, các tab; chọn tài liệu → *Đưa vào hàng chờ* / *Bỏ qua* / *Ưu tiên* | Đếm đúng; thao tác chỉ áp cho kho sửa được; tài liệu `processing` / `grouping` không bị đụng | WK-34 | TB |  |  |
| UAT-WK-043 | Ngừng / chạy tiếp tinh chế | `/refine` | TP.KT | Có tài liệu `pending` | *⏸ Ngừng tinh chế* (đếm + xác nhận) → tab *Đã dừng* → *▶ Chạy tiếp tất cả* | pending → paused → pending; MCP `list_documents` mặc định không thấy tài liệu paused | WK-34 | TB |  |  |
| UAT-WK-044 | Tinh chế trực tiếp (SSE) — **Loại bỏ** (v0.4, UI-2: chế độ *Trực tiếp* trong cùng màn; thay bằng UAT-WK-073) | `/refine/live` | TP.KT | [AI] + có việc đang chạy | Mở trang, để 1–2 phút | Nhãn "Trực tiếp"; bộ đếm, biểu đồ 60 phút, "AI đang làm", nhật ký tự cập nhật; mất kết nối thì tự nối lại | WK-42 | Thấp |  |  |
| UAT-WK-045 | Tổng hợp VCWIKI theo cụm | `/kb?source=<kênh>` → *✦ Tổng hợp theo chủ đề* → `/wiki/synth/:id` | NV.KT | [AI]; nguồn có ≥ 2 tài liệu chưa vào VCWIKI | Tạo lượt → chờ *planned* → sửa cụm (đổi tên, lĩnh vực, số thẻ, chuyển / bỏ tài liệu) → *Lưu kế hoạch* → *✦ Viết thẻ* | Bảng sàng lọc có độ hữu ích / lý do; chỉ sửa kế hoạch khi *planned* (khác → 409); mỗi cụm 1–3 thẻ có `sources` nhiều tài liệu; thẻ vào hộp duyệt | WK-20 | Cao |  |  |
| UAT-WK-046 | Huỷ lượt / chạy lại cụm lỗi | `/wiki/synth/:id` | NV.KT | [AI] | *Huỷ lượt* khi đang chạy; ở lượt khác bấm *Chạy lại* cụm lỗi | Huỷ: tài liệu trả trạng thái cũ. Chạy lại: lượt quay về *synthesizing* | WK-20, 13.4 | TB |  |  |
| UAT-WK-047 | Cập nhật thẻ khi chữ tài liệu đổi | `/kb?source=`, `/wiki/review` | NV.KT | [AI]; tài liệu có thẻ đã duyệt | Lấy lại chữ video để chữ đổi → xem nhãn → bấm *Ưu tiên* nguồn | Nhãn *Chờ cập nhật thẻ (lượt hằng ngày)*; Ưu tiên thả ngay; thẻ đã duyệt nhận **đề xuất sửa** origin AI (không sửa thẳng) | WK-32 | TB |  |  |

### 5. VCWIKI — thẻ, tìm kiếm, lĩnh vực, tính năng phụ (WK)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-WK-060 | Tạo thẻ tay đủ trường phân loại v2 | `/wiki` → *+ Thẻ mới* | NV.KT | — | Chọn Kho Kỹ thuật, loại `sop`, nhánh tầng 4, bậc, division, bước quy trình, ngày hiệu lực + chu kỳ | Thẻ nháp; `next_review_at` = hiệu lực + chu kỳ; giá trị sai → lỗi nêu tên trường; slug lạ → 400 kèm danh sách | WK-08, WK-26, WK-27 | Cao |  |  |
| UAT-WK-061 | Lọc cây lĩnh vực, Lộ trình / Lưới | `/wiki?category=nen.ky-thuat&view=` | TTS.KT | — | Chọn nhánh cha; đổi công tắc Lộ trình / Lưới | Ra thẻ cả nhánh con; Lộ trình chia chặng theo bậc; `?view=` được nhớ | WK-06 | Cao |  |  |
| UAT-WK-062 | Tìm thẻ không dấu + theo nghĩa | `/wiki?q=` | NV.KT | Không AI: chỉ nhánh chữ. [AI] (bge-m3) cho nhánh nghĩa | Gõ "ma loi dtc", rồi một câu dài theo ý | Không AI: thẻ "Mã lỗi DTC là gì" đứng đầu. Có AI: câu theo ý vẫn trúng; thẻ bộ nhớ AI không hiện trừ khi lọc loại | WK-06, 4.4 | Cao |  |  |
| UAT-WK-063 | Phân quyền xem thẻ theo kho | `/wiki` | OUTSIDER, NV.KD | — | Tìm "chiết khấu", mở link thẻ Kho Kỹ thuật | OUTSIDER không thấy thẻ MẬT KD và thẻ Kho Kỹ thuật (404); thấy thẻ Kho Công khai | WK-06, SYS-05 | Cao |  |  |
| UAT-WK-064 | Sửa, loại, về nháp, xoá thẻ nháp | Ngăn thẻ | NV.KT | Thẻ nháp của mình | Sửa trường; *Loại*; *Về nháp*; *Xoá* | Làm được với thẻ nháp; thẻ đã duyệt: *Sửa* → *Đề xuất sửa*, xoá → 409 | WK-07, 13.3 | Cao |  |  |
| UAT-WK-065 | Sao chép thẻ sang kho khác | Ngăn thẻ → *Sao chép* | NV.KT | — | Sao chép thẻ Kho Công khai về kho cá nhân | Bản sao là nháp, ghi `copied_from`; không chép được vào kho chỉ xem | WK-09 | TB |  |  |
| UAT-WK-066 | Sửa cây lĩnh vực: cấp 4, slug tay, liên kết tra cứu, ẩn nhánh | `/admin`, `/wiki` → *✎ Sửa cây lĩnh vực* | ADMIN | — | Thêm nhánh cấp 4 (slug tay), thử cấp 5; thêm `links`; ẩn nhánh cha | Cấp 5 bị từ chối; slug trùng → 409; khung *Liên kết tra cứu* hiện ở `/wiki?category=`; ẩn cha thì ẩn cả con, hiện lại đúng | WK-26, WK-36 | TB |  |  |
| UAT-WK-067 | Đề xuất lĩnh vực của AI | `/admin` | ADMIN | [AI]; có đề xuất trong `category_suggestions` | Chấp nhận / bỏ đề xuất | Chấp nhận → nhánh mới trong cây; bỏ → biến khỏi danh sách | WK-10 | Thấp |  |  |
| UAT-WK-068 | Bản đồ tri thức | `/wiki/graph` | TP.KT | Không AI: đồ thị. [AI] cho *AI phân tích chủ đề* | Lọc kho / lĩnh vực, bật lớp; bấm đúp nút thẻ; *⤓ Xuất Obsidian vault*; *✦ AI phân tích chủ đề* | Đồ thị đúng phạm vi quyền; mở thẻ; tải `.zip` có ghi chú markdown; phân tích xong hiện danh sách chủ đề (người không sửa kho thì nút bị khoá) | WK-38 | TB |  |  |
| UAT-WK-069 | Danh sách phát + trình phát | `/wiki` → *▶ Lưu thành danh sách phát* / *≡+ Danh sách phát*; `/playlists`, `/playlists/:id` | NV.KT | [MẠNG] cho giọng edge-tts (không có thì giọng trình duyệt) | Tạo danh sách riêng tư, thêm 3 thẻ, phát, *Tự chuyển thẻ*, trộn, lặp; đổi sang công khai; đăng nhập TTS.KT xem | Phát tuần tự; phím Space / Shift+N hoạt động; người khác chỉ thấy danh sách công khai và chỉ thẻ mình được đọc ("n thẻ bị ẩn") | WK-40 | Thấp |  |  |
| UAT-WK-070 | Nghe thẻ | Ngăn thẻ → *🔊 Nghe thẻ* | NV.KT | [MẠNG] | Chọn giọng nữ / nam, tốc độ | Có mp3 (lần sau lấy từ đệm); thẻ đổi nội dung thì đọc lại | (đề xuất WK-40) | Thấp |  |  |
| UAT-WK-071 | Thảo luận, chấm sao, bình chọn tháng | Ngăn thẻ → *Thảo luận*; `/leaderboard` | NV.KT, KS.KT | — | KS.KT bình luận + trả lời; NV.KT chấm sao thẻ của KS.KT; thử tự chấm thẻ mình; mở bảng bình chọn | Bình luận nhiều tầng, sửa / xoá của mình; không tự chấm được; sao cộng cho tác giả, hiện trên `/leaderboard` tháng hiện tại | WK-41 | Thấp |  |  |
| UAT-WK-072 | Kho tư liệu: lọc trên URL, nạp bằng ngăn kéo | `/kb` | nv_kt | Có nguồn ở nhiều trạng thái | 1. Chọn Kho, Loại, Trạng thái *Lỗi*, gõ tìm; tải lại trang; gửi link cho tp_kt 2. Bấm *Nạp nguồn*; kéo file từ máy vào giữa trang 3. Menu *Thao tác ▾* → *Ngừng lấy chữ các nguồn đang lọc* 4. Mở `/kb?status=error&mine=1` | 1: bộ lọc giữ nguyên sau khi tải lại và ở máy người nhận (theo quyền); 2: ngăn kéo nạp mở (`?add=1`), file kéo vào có sẵn trong khung; 3: hỏi lại kèm số nguồn, chỉ chạm nguồn đang lọc; 4: chỉ nguồn lỗi do mình nạp, thao tác hàng loạt cũng chỉ chạm nguồn của mình | WK-01…05, SYS-28 | Cao |  |  |
| UAT-WK-073 | Tiến độ tinh chế là tab của Kho tư liệu | `/refine`, `/refine/live` | tp_kt | Có tài liệu nhiều trạng thái | 1. Mở tab *Tiến độ tinh chế* 2. Chọn tab trạng thái *Lỗi*, chọn 1 tài liệu → *Thao tác ▾* 3. Chuyển *Trực tiếp*; mở `/refine/live` | 1: `h1` vẫn *Kho tư liệu*, tab cuối sáng; 2: menu ghi rõ "… — 1 tài liệu đã chọn", tên tài liệu mở chi tiết nguồn; 3: URL `?view=live`, `/refine/live` mở sẵn chế độ Trực tiếp | WK-34, WK-42 | TB |  |  |
| UAT-WK-074 | VCWIKI: tab, lưới, khung thẻ | `/wiki` | nv_kt, ks_kt | Có thẻ nháp và đã duyệt | 1. Đổi tab *Thẻ · Bản đồ · Danh sách phát · Bình chọn tháng* 2. Bấm tên một thẻ; Quay lại; chuyển tab trong khung 3. Thẻ nháp: *Gửi duyệt*; *Thêm ▾ → Từ chối* 4. *Thêm ▾ → Lưu kết quả lọc thành danh sách phát* | 1: `h1` đúng từng trang, tab đang mở sáng; 2: khung thẻ bên phải (`?card=`, `&ctab=`), Quay lại đóng / mở lại đúng thẻ; 3: một nút chính theo trạng thái, chữ **Từ chối** (không còn *Loại*), có hỏi lý do; 4: lưu toàn bộ kết quả lọc (tối đa 500) | WK-06…10, 40, 41 | Cao |  |  |
| UAT-WK-075 | Con mới kế thừa cây v2 | `/wiki` → Sửa cây; MCP list_categories | ADMIN | QA có cây v2 | Tạo nhánh con v2 bằng API / web; đọc danh sách AI | Nhánh có scheme v2, AI chọn được; không vượt 4 cấp | WK-26 / LV-01 | Cao | | |
| UAT-WK-076 | Chuyển cây cũ có nhật ký | Terminal QA | Vận hành | Dừng worker / sửa cây; QA có thẻ đã chuyển, nguồn / tài liệu còn v1 | Chạy script không tham số; chạy --apply; chạy lại; thử nhánh chưa ánh xạ / đích ẩn / quyền / khoá còn dùng v1 | Chạy thử không ghi; nhật ký tồn tại trước lần ghi đầu; nguồn / tài liệu v2 đúng thứ tự không trùng, trường thiếu giữ thiếu; cây cũ ẩn, nhánh ẩn riêng giữ; chạy lại 0 thay đổi; điều kiện lỗi chặn toàn bộ; DB thật bị từ chối | WK-26 / LV-01 | Cao | | |
| UAT-WK-077 | Quay lui và chuyển dở | Terminal QA | Vận hành | Có nhật ký của ca 076 | --undo nhật-ký; thêm --apply; chạy lại; sửa lĩnh vực sau chuyển rồi thử undo; thử nhật ký DB khác / ghi dừng giữa chừng | Chạy thử không ghi; phục hồi chính xác lĩnh vực, scheme, active / hidden_by kể cả trường thiếu; lần hai 0; xung đột / sai DB chặn trước ghi; nhật ký phục hồi được phần đã ghi | WK-26 / LV-01 | Cao | | |


### 6. Quản trị vòng đời tri thức (GOV)

Các ca GOV bám theo P01 (D01–D18). Dữ liệu: Kho Kỹ thuật, thẻ nháp mẫu, người duyệt bước 2 là GD.GARAGE.

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-GOV-001 | Tác giả gửi duyệt, không tự duyệt | Ngăn thẻ "[NHÁP] …làm mát" → *Gửi duyệt* | NV.KT | Thẻ nháp mẫu | Gửi duyệt; mở `/wiki/review` | Có đề xuất `create`; thông báo "bạn là tác giả nên không tự duyệt"; không có nút duyệt | GOV-02, GOV-05 | Cao |  |  |
| UAT-GOV-002 | Duyệt 2 bước theo `level` | `/wiki/review?tab=inbox` | KS.KT (bước 1), GD.GARAGE (bước 2) | Có UAT-GOV-001 | KS.KT duyệt → GD.GARAGE (ngoài kho) mở hộp duyệt, duyệt | Sau bước 1 vẫn `open` và "chờ bước 2"; sau bước 2 thẻ `approved`, có phiên bản mới ghi người duyệt | GOV-05, GOV-01 | Cao |  |  |
| UAT-GOV-003 | Người ngoài kho chỉ xem đề xuất được giao | `/wiki/review?change=<id>` | GD.GARAGE, OUTSIDER | Có đề xuất | GD.GARAGE mở đề xuất mình được giao; OUTSIDER mở cùng link | GD.GARAGE xem được nội dung thẻ trong đề xuất (ghi `access_log`); OUTSIDER → 404 | GOV-05 | Cao |  |  |
| UAT-GOV-004 | Thẻ bậc Thiết kế cần ADMIN ở bước 2 | Hộp duyệt | KS.KT, ADMIN | Thẻ nháp `level = thiet-ke` | KS.KT duyệt bước 1; GD.GARAGE thử duyệt; ADMIN duyệt | Chỉ ADMIN (TGĐ tạm) duyệt được bước 2 | GOV-05 | Cao |  |  |
| UAT-GOV-005 | Từ chối bắt buộc lý do; nhận xét; rút | Chi tiết đề xuất | KS.KT, NV.KT | Đề xuất mở | Từ chối không lý do → có lý do; nhận xét; NV.KT rút đề xuất khác | Thiếu lý do → không ghi gì; nhận xét giữ `open`; rút → `withdrawn` | GOV-02, GOV-04 | Cao |  |  |
| UAT-GOV-006 | Sửa thẻ nháp → thành tác giả, lượt duyệt cũ huỷ | Ngăn thẻ nháp | KS.KT | Đề xuất đã có bước 1 | KS.KT sửa nội dung thẻ nháp | KS.KT thành tác giả (`edited_by`), không duyệt được nữa; lượt duyệt cũ bị huỷ | GOV-05 (QA N-1) | TB |  |  |
| UAT-GOV-007 | Đề xuất sửa thẻ đã duyệt + mức thay đổi | Ngăn thẻ đã duyệt → *Đề xuất sửa* | TTS.KT (chỉ xem) | Thẻ "Mã lỗi DTC là gì" | Sửa tóm tắt, chọn `minor` / `major`, gửi; người duyệt đổi `change_kind` rồi duyệt | Thẻ không đổi cho tới khi duyệt; duyệt xong phiên bản mới ghi `change_kind`; diff hiện đúng trường | GOV-02, 16.3 | Cao |  |  |
| UAT-GOV-008 | Cần cập nhật lên bản mới (rebase) | Chi tiết đề xuất | NV.KT, TTS.KT | Hai đề xuất `update` cùng một thẻ | Duyệt đề xuất A; mở đề xuất B | B → `needs_rebase`; *Cập nhật lên bản mới* → `open` | GOV-02, 16.5 | TB |  |  |
| UAT-GOV-009 | Lịch sử phiên bản, diff | Ngăn thẻ → tab *Lịch sử* | NV.KT | Thẻ "Thay má phanh" (2 bản) | Xem danh sách, xem bản 1, diff 1↔2 | Ai sửa / ai duyệt / lý do; diff theo trường | GOV-01 | Cao |  |  |
| UAT-GOV-010 | Quay về bản cũ | Tab *Lịch sử* → *Quay về bản này* | NV.KT, GD.GARAGE | Thẻ đã duyệt có ≥ 2 bản; thêm một thẻ nháp có phiên bản | Thẻ đã duyệt: tạo đề xuất rollback, chủ lĩnh vực duyệt. Thẻ nháp: quay về | Thẻ đã duyệt → đề xuất `rollback`, cần chủ sở hữu lĩnh vực, tạo **bản mới** (không xoá lịch sử). Thẻ nháp → quay về ngay | GOV-07 | Cao |  |  |
| UAT-GOV-011 | Lỗi thời | Ngăn thẻ → *Đề xuất lỗi thời* | NV.KT, GD.GARAGE | Thẻ đã duyệt | Gửi lý do + thẻ thay thế → duyệt; thử đề xuất sửa lại thẻ | Thẻ có nhãn lỗi thời (trường `obsolete`, status vẫn approved); đề xuất mới → 409; đề xuất đang mở bị rút | GOV-02, 16.6 | TB |  |  |
| UAT-GOV-012 | Cổng so sánh + ẩn TRÙNG / NHIỄU | `/wiki/review` | NV.KT, KS.KT | [AI] (không có AI thì heuristic); thẻ nháp trùng ý thẻ đã có | Tạo thẻ nháp gần giống "Mã lỗi DTC là gì", gửi duyệt; xem hộp duyệt, bấm *Hiện*; người duyệt đổi kết quả | Đề xuất có kết quả (MỚI / TRÙNG / BỔ SUNG / MÂU THUẪN / NHIỄU) + lý do + thẻ gần; TRÙNG / NHIỄU ẩn mặc định; đổi kết quả lưu riêng kết quả AI gốc; tác giả không đổi được | GOV-03, GOV-04 | Cao |  |  |
| UAT-GOV-013 | Chế độ 1 người duyệt | `/wiki/review` → cài đặt | ADMIN | — | Đặt `min_approvers = 1`, duyệt một thẻ; **đặt lại 2** | Một người đủ điều kiện duyệt xong, `approvals[]` ghi cả 2 bước; người thường không sửa được cài đặt | GOV-05 | TB |  |  |
| UAT-GOV-014 | Duyệt thẳng từ ngăn thẻ; bấm đúp | Ngăn thẻ nháp → *✓ Duyệt* | KS.KT | Thẻ nháp của NV.KT | Bấm *✓ Duyệt* (nhanh hai lần) | Tự tạo đề xuất và ghi bước 1 (`submitted_by`); chỉ một lượt được ghi, lượt kia 409 | GOV-05 (QA C-1) | TB |  |  |
| UAT-GOV-015 | Duyệt hàng loạt — **Loại bỏ** (v0.4, UI-2: bỏ nút *Xem danh sách*, lọc trên URL; thay bằng UAT-GOV-019) | `/wiki/review?tab=bulk` (và `?ids=`) | KS.KT | ≥ 3 thẻ nháp; có thẻ tag `xem-lai-phan-loai` | Lọc nhánh / bậc → *Xem danh sách* → chọn → *Duyệt n thẻ*; thử *Từ chối* không nhận xét | Mỗi thẻ đi đúng luật bốn mắt (thẻ mình là tác giả bị bỏ qua kèm lý do); thẻ độ tin cậy thấp / TRÙNG mặc định loại ra; từ chối cần nhận xét | GOV-12 | TB |  |  |
| UAT-GOV-016 | Hạn duyệt | `/wiki/review` | KS.KT | Đề xuất có `due_at` đã qua (sửa DB UAT) | Mở hộp duyệt | Nhãn *Quá hạn* / *cần chuyển cấp*; sắp theo hạn (chưa có nhắc tự động — ngoài phạm vi UAT) | GOV-06 (một phần) | Thấp |  |  |
| UAT-GOV-017 | Thẻ AI tự vào hộp duyệt | `/wiki/review` | KS.KT | [AI]; có UAT-WK-040 | Mở hộp duyệt | Thẻ AI từ làn nhẹ / tổng hợp có đề xuất `create` origin `ai`, đã có kết quả cổng so sánh | GOV-02, GOV-03, 16.7 | TB |  |  |
| UAT-GOV-018 | Hộp duyệt chia đôi, tự mở đề xuất kế, Hoàn tác | `/wiki/review` | ks_kt | ≥ 3 đề xuất chờ ks_kt | 1. Mở ở màn rộng 2. *Duyệt* đề xuất đang mở 3. Bấm *Hoàn tác* trên thông báo trong 8 giây 4. *Duyệt* lại, đợi hết 8 giây 5. *Từ chối* khi chưa ghi lý do 6. Duyệt rồi đóng tab ngay | 1: trái danh sách, phải chi tiết đề xuất đầu (`?change=`); 2: đề xuất biến khỏi danh sách, đề xuất kế tự mở, số trên tab giảm; 3: đề xuất quay lại, chưa ghi gì; 4: quyết định được ghi; 5: báo lỗi bằng chữ dưới ô lý do, không gửi; 6: mở lại thấy quyết định đã ghi. Màn hẹp: chi tiết là ngăn kéo | GOV-02, 04…06 | Cao |  |  |
| UAT-GOV-019 | Duyệt hàng loạt và cấu hình số người duyệt | `/wiki/review?tab=bulk`, `/admin?tab=review` | ks_kt, admin | ≥ 3 thẻ nháp | 1. Đổi bộ lọc (nhánh, bậc, loại) — không có nút *Xem danh sách* 2. Tải lại trang 3. Chọn thẻ → *Duyệt N thẻ* 4. admin: *Người dùng & lĩnh vực* tab **Duyệt** đổi *Số người duyệt tối thiểu* | 1: danh sách tự tải, nhãn tiếng Việt (không slug); 2: bộ lọc giữ; 3: thanh "Đã chọn N", kết quả báo bằng thông báo, thẻ bỏ qua kèm lý do tiếng Việt; 4: đổi được, Hộp duyệt không còn ô cấu hình ở đầu trang | GOV-05, 12 | TB |  |  |
| UAT-GOV-020 | Trả về đề xuất, sửa và gửi lại | `/wiki/review`, `/` | ks_kt (duyệt), nv_kt (đề xuất) | Đề xuất của nv_kt chờ ks_kt | 1. ks_kt bấm *Trả về* không ghi lý do 2. Ghi lý do → *Trả về*; bấm *Hoàn tác* trong 8 giây, rồi trả về lại và để hết giờ 3. nv_kt mở *Việc của tôi* → dòng *Đề xuất cần sửa* 4. nv_kt *Sửa và gửi lại* 5. ks_kt mở link đề xuất khi đang bị trả về (trước bước 4) | 1: lỗi bằng chữ, không gửi; 2: đề xuất rời *Chờ tôi duyệt*, *Hoàn tác* đưa lại; 3: tới tab *Tôi đề xuất* lọc *Cần sửa*, thấy nhãn + lý do; 4: đề xuất về hộp ks_kt, đúng bước, hạn mới; lịch sử có lượt *Trả về* / *Gửi lại*; 5: không có nút *Duyệt* / *Từ chối* | GOV-13 | Cao |  |  |

---

### Tổng hợp

- **Số chức năng:** 79 dòng — WK 51, TT 11, GOV 17.
- **Ưu tiên Cao:** 29 dòng. Nên chạy trước theo thứ tự: nạp nguồn, chi tiết nguồn và xoá, Kho video cơ bản, tạo / tìm / phân quyền thẻ, rồi cả chuỗi GOV-001 → GOV-012.
- **Cần AI (`--ai`):** UAT-WK-014, 024, 031, 036, 040–041, 044–047, 062 (phần nghĩa), 067, 068 (phân tích), UAT-TT-011 (chấm liên quan), UAT-GOV-012 (đầy đủ), 017.
- **Cần mạng:** UAT-WK-007–009, 025, 029–031, 033, 069–070, UAT-TT-005, 011.
- **Cần Qdrant:** UAT-WK-028.
- **Mã BA mới (v0.32):** Bản đồ tri thức WK-38, Tìm video theo chủ đề WK-39, Danh sách phát / nghe thẻ WK-40, Thảo luận / bình chọn WK-41, Tinh chế trực tiếp WK-42, Duyệt hàng loạt GOV-12. **(v0.36)** Ghi chú của người nạp WK-44: UAT-WK-012…014. **(v0.39)** Ghi chép theo nguồn và từng đơn vị WK-45: UAT-WK-032…036. **(v0.41)** Xem video và ghi chép song song: UAT-WK-037.

---


## Phần D — CE (Content Engine)

Chỉ gồm chức năng **đã có trong code** (nhánh `develop`, 29/09/2026). Chức năng thiết kế chưa làm (kế hoạch kỳ, lịch, luồng duyệt 4 trạng thái, LinkedIn, CMS…) không có ca UAT — xem `docs/BA.md` v0.32 (backlog).

### Dữ liệu và nhãn điều kiện

- Dựng môi trường: `bash start_uat.sh` (BE `:8400`, FE **http://127.0.0.1:5400**, DB `tiktok_to_text_uat`, **không AI**). Ca gắn nhãn **[AI]** chạy bằng `bash start_uat.sh --ai` (Claude theo `.env`, dự phòng `claude -p` / AI local). Dựng lại dữ liệu: `bash start_uat.sh --reset` hoặc `--seed-only`. **Không** dùng `:8000` (bản thật).
- Ca gắn nhãn **[FB]** cần **token Facebook thật**: tài khoản quản trị một Fanpage thử (không phải Fanpage công ty đang chạy), access token có `pages_show_list`, `pages_manage_posts`, `pages_read_engagement` (Graph API Explorer). Ca đổi token dài hạn cần thêm `FB_APP_ID`, `FB_APP_SECRET` trong `.env` trước khi chạy `start_uat.sh`. Nhóm / trang cá nhân không cần token nhưng cần tài khoản Facebook để đăng tay.
- Tài khoản (mật khẩu chung `Test@12345`, `backend/scripts/seed_uat.py`, `docs/test-claude-extension/_chung.md`):
  - **TP.KT** `tp.kt@uat.test` — chủ **Kho Kỹ thuật VCgarage**.
  - **NV.KT** `nv.kt@uat.test`, **KS.KT** `ks.kt@uat.test` — *Được sửa* trong Kho Kỹ thuật.
  - **TTS.KT** `tts.kt@uat.test` — *Chỉ xem* trong Kho Kỹ thuật.
  - **TP.KD** `tp.kd@uat.test` — chủ **Kho Kinh doanh VCpart** (không thuộc Kho Kỹ thuật).
  - **OUTSIDER** `outsider@uat.test` — không thuộc kho chia sẻ nào.
- Dữ liệu CE **không có sẵn** trong seed: ca đầu mỗi nhóm tự tạo (người đứng tên, dự án, chiến dịch, bài). Seed có sẵn 2 video đã chuyển chữ (`@garage_tips` "Mẹo đọc lỗi OBD", `@phutung_pro` "Review phụ tùng") và thẻ VCWIKI đã duyệt trong Kho Kỹ thuật (vd "Quy trình đọc lỗi bằng máy chẩn đoán OBD") — đủ làm tham chiếu R… / K….
- Ca **không AI** kiểm tra được: form, kiểm tra đầu vào, quyền, trạng thái *Chờ cấu hình AI*, danh sách, xoá. Ca **[AI]** tốn token; nên chạy chiến dịch 1 tuần, 1–2 mục mỗi luồng.
- Ưu tiên: **Cao** = chặn bàn giao nếu lỗi; **TB** = cần sửa trước khi dùng rộng; **Thấp** = sửa sau được.

---

### 1. Người đứng tên (`/studio/authors`)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| ------ | --------- | -------------------- | ----------------- | -------------- | -------- | ---------------- | ------------- | ------- | --- | --- |
| UAT-CE-001 | Tạo hồ sơ người đứng tên | `/studio/authors` | NV.KT | — | 1) **+ Người đứng tên**, kho: Kho Kỹ thuật. 2) Nhập họ tên "Anh Thử", chức danh, giọng, câu cửa miệng, chủ đề được / không được nói, 1–2 bài mẫu. 3) Tick "đã đồng ý". 4) Lưu | Thẻ hồ sơ hiện nhãn **Đã đồng ý**, số bài mẫu đúng; hồ sơ thuộc Kho Kỹ thuật | CE-18 | Cao |  |  |
| UAT-CE-002 | Sửa, bỏ đồng ý, xoá hồ sơ | `/studio/authors` | NV.KT | Có hồ sơ UAT-CE-001 | 1) Sửa → bỏ tick đồng ý → Lưu. 2) Xoá → xác nhận | Bước 1: nhãn **Chưa đồng ý**. Bước 2: hồ sơ biến mất | CE-18 | TB |  |  |
| UAT-CE-003 | Giới hạn bài mẫu | `/studio/authors` | NV.KT | — | Thêm 6 bài mẫu, hoặc 1 bài > 6.000 ký tự → Lưu | Bị chặn với câu báo lỗi tiếng Việt (tối đa 5 bài, mỗi bài ≤ 6.000 ký tự) | CE-18 | Thấp |  |  |
| UAT-CE-004 | Quyền theo kho | `/studio/authors` | TTS.KT, TP.KD | Có hồ sơ trong Kho Kỹ thuật | 1) TTS.KT mở trang. 2) TP.KD mở trang | TTS.KT thấy hồ sơ nhưng không có nút sửa / xoá; TP.KD không thấy hồ sơ | CE-18, SYS | TB |  |  |

### 2. Chiến dịch — tạo và quản lý (`/studio`, `/studio/new`, `/studio/{id}`)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| ------ | --------- | -------------------- | ----------------- | -------------- | -------- | ---------------- | ------------- | ------- | --- | --- |
| UAT-CE-010 | Tạo chiến dịch luồng ② khi chưa có AI | `/studio/new` | NV.KT | Môi trường không AI | 1) Để trống tên → nút *Lập chiến dịch* mờ, có dòng "Còn thiếu…". 2) Tên "Chiến dịch thử OBD", kho: Kho Kỹ thuật, chỉ tick ② Video ngắn, 1 tuần. 3) Tìm video "OBD", chọn video. 4) Lập chiến dịch | Mở trang chiến dịch, trạng thái **Chờ cấu hình AI**; có tab Chiến lược / Chiến dịch / Video ngắn / Tham chiếu; tab Tham chiếu có video R1 kèm số liệu viral | CE-08, CE-03 | Cao |  |  |
| UAT-CE-011 | Kiểm tra đầu vào theo luồng | `/studio/new` | NV.KT | — | 1) Tick ① SEO, để trống từ khoá → Lập. 2) Tick ③ MXH, không chọn kênh → Lập. 3) ③ chọn kênh *Facebook cá nhân*, không chọn người đứng tên → Lập. 4) ② với bộ lọc không khớp video nào → Lập | Mỗi bước bị từ chối với câu tương ứng: "cần từ khoá hạt giống", "cần chọn ít nhất một kênh", "Kênh cá nhân … cần ít nhất một người đứng tên", "Không có video tham chiếu nào…" | CE-13, CE-14, CE-18 | Cao |  |  |
| UAT-CE-012 | Người đứng tên chưa đồng ý bị chặn | `/studio/new` | NV.KT | Có 1 hồ sơ **chưa đồng ý** | ③ MXH, kênh Facebook cá nhân, chọn hồ sơ chưa đồng ý → Lập | Từ chối "Chưa xác nhận đồng ý đứng tên: …" | CE-18 | Cao |  |  |
| UAT-CE-013 | Chiến dịch đa luồng ①②③ + tham chiếu SEO/MXH | `/studio/new` | NV.KT | Có hồ sơ đã đồng ý | Tick cả 3 luồng; SEO: website, trang đích, từ khoá, 2 link top Google, sitemap URL; MXH: Fanpage + FB cá nhân, link dẫn về, 1 bài mẫu ≥ 20 ký tự; chọn người đứng tên → Lập | Chiến dịch tạo được; tab Tham chiếu có S1, S2 (chờ tải), P1, A1, K… | CE-13, CE-15, CE-19 | TB |  |  |
| UAT-CE-014 | Danh sách, tìm, đổi tên, xoá chiến dịch | `/studio`, `/studio/{id}` | NV.KT | Có ≥ 2 chiến dịch | 1) Tìm theo tên. 2) Đổi tên. 3) Xoá → xác nhận | Tìm đúng; tên mới hiện ở danh sách; chiến dịch và mọi nội dung của nó biến mất | CE-08 | TB |  |  |
| UAT-CE-015 | Người chỉ xem không sửa được | `/studio/{id}` | TTS.KT | Chiến dịch trong Kho Kỹ thuật | Mở chiến dịch; thử xoá / dựng lại / xếp hàng viết (qua giao diện) | Xem được; không có nút sửa / xoá, hoặc gọi thì 403 "Bạn chỉ có quyền xem kho này" | SYS, CE-08 | Cao |  |  |
| UAT-CE-016 | Người ngoài kho không thấy | `/studio`, `/studio/{id}` | TP.KD | Chiến dịch trong Kho Kỹ thuật | 1) Xem danh sách. 2) Dán URL chiến dịch | Không có trong danh sách; mở URL báo không tìm thấy (404) | SYS | Cao |  |  |
| UAT-CE-017 **[AI]** | AI lập chiến lược + kế hoạch | `/studio/{id}` | NV.KT | `start_uat.sh --ai`; chiến dịch ② 1 tuần, 2 video/tuần | Tạo chiến dịch, chờ trạng thái chuyển *Đang lập…* → *Sẵn sàng* | Tab Chiến lược có phân tích brief, ADN video R…, insight, khán giả, trụ nội dung; tab Chiến dịch có big idea, giai đoạn, KPI; tab Video ngắn có đúng 2 tập, mỗi tập có hook, mã căn cứ R/K, điểm dự đoán | CE-04, CE-08, CE-13 | Cao |  |  |
| UAT-CE-018 **[AI]** | Luồng SEO tải trang đối thủ + sitemap | `/studio/{id}` | NV.KT | `--ai`; UAT-CE-013 | Chờ chiến dịch sẵn sàng; mở tab Tham chiếu và Bài SEO | Trang S… `ok` (có tiêu đề, số chữ) hoặc `error` kèm lý do; kế hoạch SEO có bài trụ (pillar) + vệ tinh, mỗi bài một từ khoá chính; `seo_research` có 15–30 từ khoá theo ý định | CE-14, CE-15 | TB |  |  |
| UAT-CE-019 **[AI]** | Dựng lại chiến dịch | `/studio/{id}` | NV.KT | Chiến dịch *Sẵn sàng* | 1) *Lập lại kế hoạch* (giữ chiến lược). 2) *Lập lại tất cả*. 3) Bấm lại khi đang chạy | Bước 1: chiến lược giữ nguyên, kế hoạch mới. Bước 2: cả hai lập lại, nội dung đã viết vẫn còn. Bước 3: báo "đang được AI xử lý" (409) | CE-08, BA 13.5 | TB |  |  |
| UAT-CE-020 | Gán / bỏ gán chiến dịch vào dự án | `/studio/{id}` | NV.KT | Có dự án cùng kho và dự án khác kho | 1) Chọn dự án cùng kho. 2) Chọn "— không —". 3) (qua API) gán dự án khác kho | Bước 1: dòng "Dự án: …" có link. Bước 2: bỏ gán. Bước 3: 400 "Dự án thuộc kho khác" | CE-25 | TB |  |  |

### 3. Nội dung chiến dịch — viết, chấm, duyệt, nhân bản, xuất

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| ------ | --------- | -------------------- | ----------------- | -------------- | -------- | ---------------- | ------------- | ------- | --- | --- |
| UAT-CE-030 **[AI]** | Viết kịch bản video + giám khảo | `/studio/{id}` tab Video ngắn | NV.KT | UAT-CE-017 | Chọn tập 1 → *Viết* → chờ xong, mở ngăn nội dung | Kịch bản có hook (lời / chữ / hình), phân cảnh theo giây, kết + CTA, caption, 5–8 hashtag, 2 hook thay thế, ghi chú sản xuất, căn cứ; điểm /100 kèm từng tiêu chí; ≤ 3 vòng, hiện lịch sử vòng; kiểm tra tự động (tốc độ đọc, phân cảnh, caption, hashtag) | CE-09 | Cao |  |  |
| UAT-CE-031 **[AI]** | Bài SEO: dàn ý → duyệt → viết bài | tab Bài SEO | NV.KT | UAT-CE-018 | 1) Viết bài số 1. 2) Xem dàn ý, nhập góp ý → *Lập lại dàn ý*. 3) *Duyệt dàn ý & viết bài* | Bước 1: chỉ có dàn ý, thông báo "Dàn ý chờ duyệt". Bước 3: bài đủ H1, slug, meta, thân Markdown, FAQ, link nội bộ, ảnh + alt, JSON-LD; xem trước kiểu Google; 13–15 phép kiểm tra on-page, điểm on-page quy ra /10 | CE-16 | Cao |  |  |
| UAT-CE-032 **[AI]** | Bài MXH theo kênh + UTM | tab Bài MXH | NV.KT | UAT-CE-013 sẵn sàng | Viết 1 bài Fanpage và 1 bài FB cá nhân | Mỗi bài có 3 mở đầu, thân, CTA, hashtag, gợi ý hình, bình luận đầu, giờ đăng; bài dẫn link có link UTM (`utm_source=facebook&utm_medium=social&utm_campaign=<slug>`); bài cá nhân có người đứng tên A…; kiểm tra độ dài / hashtag / đoạn văn theo kênh | CE-19 | Cao |  |  |
| UAT-CE-033 **[AI]** | Duyệt / loại / về nháp | ngăn nội dung | NV.KT | Có nội dung *done* | 1) ✓ Duyệt. 2) Loại. 3) Về nháp. 4) Thử duyệt mục đang viết | Nhãn đổi đúng (Đã duyệt / Loại / Nháp); ghi người duyệt; bước 4: 409 "Nội dung chưa viết xong" | CE-09, BA 13.6 | Cao |  |  |
| UAT-CE-034 **[AI]** | Viết lại theo góp ý | ngăn nội dung | NV.KT | Nội dung đã duyệt | Nhập góp ý → *Viết lại* | Trạng thái về hàng chờ, xong có bản mới theo góp ý và `review_status` về **Nháp** | CE-09 | TB |  |  |
| UAT-CE-035 **[AI]** | Nhân bản đa kênh | ngăn nội dung | NV.KT | Bài SEO hoặc kịch bản đã xong | *Nhân bản sang* Bài MXH, kênh Fanpage, 3 bản | Tab Bài MXH hiện 3 mục mới (số ≥ 1001), mỗi mục một ý khác nhau, ghi "bản chuyển thể i/3", liên kết về nội dung gốc | CE-20 | TB |  |  |
| UAT-CE-036 | Nhân bản sang kênh cá nhân khi chiến dịch không có người đứng tên | ngăn nội dung | NV.KT | Chiến dịch không có người đứng tên, có nội dung xong | Nhân bản sang Bài MXH, kênh FB cá nhân | Từ chối "Kênh cá nhân cần người đứng tên — chiến dịch này chưa có" | CE-18, CE-20 | Thấp |  |  |
| UAT-CE-037 | Xoá nội dung | ngăn nội dung | NV.KT | Có nội dung | Xoá → xác nhận | Nội dung biến mất; mục kế hoạch viết lại được | BA 13.6 | Thấp |  |  |
| UAT-CE-038 **[AI]** | Xuất hồ sơ `.md` | `/studio/{id}` | NV.KT | Có ≥ 1 nội dung duyệt, 1 nội dung loại | Bấm xuất hồ sơ | Tải file `<slug>.md` có chiến lược, kế hoạch, nội dung (SEO có khối JSON-LD); **không** có nội dung bị loại | CE-09, CE-16 | TB |  |  |

### 4. Viết nhanh (`/studio/quick`, `/studio/quick/{id}`)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| ------ | --------- | -------------------- | ----------------- | -------------- | -------- | ---------------- | ------------- | ------- | --- | --- |
| UAT-CE-050 | Danh mục loại và form theo loại | `/studio/quick` | NV.KT | — | Duyệt 5 nhóm; mở từng loại | 14 loại đúng nhóm; form mỗi loại có ô riêng (vd Bài blog SEO có từ khoá chính, ý định, độ dài, trang đích, URL site); khung "AI chưa sẵn sàng" khi không AI | CE-22 | Cao |  |  |
| UAT-CE-051 | Kiểm tra đầu vào | `/studio/quick` | NV.KT | — | 1) Bài Facebook để trống chủ đề. 2) Link tham khảo "abc". 3) Bài Facebook kênh *Facebook cá nhân*, không chọn người đứng tên | Bị chặn: "…: bắt buộc nhập", "…: link không hợp lệ", "Đăng trang cá nhân cần chọn người đứng tên" | CE-22 | Cao |  |  |
| UAT-CE-052 | Tạo bài khi chưa có AI | `/studio/quick` | NV.KT | Không AI | Tạo Bài Facebook Fanpage hợp lệ | Mở trang bài, trạng thái *Chờ cấu hình AI*; có trong *Nội dung đã viết* | CE-22 | TB |  |  |
| UAT-CE-053 **[AI]** | Viết + kiểm tra + giám khảo | `/studio/quick/{id}` | NV.KT | `--ai` | Tạo Bài Facebook (Fanpage, link dẫn về, link tham khảo) và Quảng cáo Google | Bài FB: 3 mở đầu, xem trước bài đăng, bình luận đầu, hình, link UTM `utm_campaign=viet-nhanh`; tham khảo hiện là S1. Google Ads: tiêu đề ≤ 30, mô tả ≤ 90 ký tự có đếm; điểm giám khảo /100, ≤ 2 vòng | CE-22, CE-23 | Cao |  |  |
| UAT-CE-054 **[AI]** | Loại không chấm mặc định | `/studio/quick` | NV.KT | `--ai` | Tạo *Ý tưởng & tiêu đề* và *Meta title & description* | Có kết quả sau 1 lượt, không có khung Giám khảo; meta có xem trước kiểu Google | CE-23 | Thấp |  |  |
| UAT-CE-055 **[AI]** | Sao chép toàn bộ / từng phần | `/studio/quick/{id}` | NV.KT | Bài đã xong | Bấm *Sao chép toàn bộ* và nút sao chép một phần | Bộ nhớ tạm có đúng văn bản (bài FB: mở đầu 1 + thân + hashtag) | CE-24 | TB |  |  |
| UAT-CE-056 **[AI]** | Duyệt / loại / về nháp + ghi chú | `/studio/quick/{id}` | NV.KT | Bài đã xong | ✓ Duyệt → Loại → Về nháp; nhập ghi chú người duyệt → Lưu | Nhãn đổi đúng; ghi chú lưu lại sau khi tải lại trang | CE-24 | Cao |  |  |
| UAT-CE-057 **[AI]** | Chỉnh tiếp theo góp ý / viết bản mới | `/studio/quick/{id}` | NV.KT | Bài đã duyệt | 1) *Chỉnh tiếp* với góp ý. 2) *Viết bài mới từ đầu vào này* | Cả hai về hàng chờ, `review_status` về **Nháp** ngay; bước 1 sửa trên bản cũ theo góp ý; bước 2 ra bản khác | CE-24 | TB |  |  |
| UAT-CE-058 **[AI]** | Chuyển thể sang loại khác | `/studio/quick/{id}` | NV.KT | Bài Facebook đã xong | *Chuyển thể sang* Email marketing → *Mở form* → viết | Form ghi "Chuyển thể từ Bài Facebook…"; bài mới có căn cứ G1, giữ thông điệp, không lặp nguyên văn | CE-24 | TB |  |  |
| UAT-CE-059 | Lọc danh sách, xoá bài | `/studio/quick` | NV.KT | Có vài bài | Lọc loại, lọc trạng thái duyệt; xoá 1 bài | Lọc đúng; bài xoá biến mất | CE-24 | Thấp |  |  |
| UAT-CE-060 | Quyền xem / sửa bài theo kho | `/studio/quick/{id}` | TTS.KT, TP.KD | Bài NV.KT trong Kho Kỹ thuật | Mở URL bài | TTS.KT xem được, không có nút duyệt / xoá; TP.KD báo không tìm thấy | CE-22, SYS | TB |  |  |

### 5. Dự án marketing (`/studio/projects`, `/studio/projects/{id}`)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| ------ | --------- | -------------------- | ----------------- | -------------- | -------- | ---------------- | ------------- | ------- | --- | --- |
| UAT-CE-070 | Tạo dự án | `/studio/projects` | NV.KT | — | **+ Dự án mới**: tên "Marketing xưởng VCS", kho Kho Kỹ thuật, mục tiêu, mô tả → Lưu | Mở trang dự án; tab Tổng quan có mục tiêu, mô tả, thành viên NV.KT vai trò **Chủ dự án**; có trong danh sách (Vai trò của tôi: Chủ dự án) | CE-25 | Cao |  |  |
| UAT-CE-071 | Thêm tài nguyên 4 loại | tab Tài nguyên | NV.KT | UAT-CE-070 | Thêm: video Kho video (tìm "OBD"), trang web (link bài có nội dung), bài mẫu (kênh Fanpage, ≥ 20 ký tự), tài liệu Kho tư liệu (nếu có) | Mã R1, S1, P1, D1 tăng theo loại; mở xem được nội dung chụp; thêm lại cùng video → "đã có trong dự án" (409); link trang lỗi → "Không tải được trang: …" | CE-26 | Cao |  |  |
| UAT-CE-072 | Bỏ tài nguyên, mã không đánh lại | tab Tài nguyên | NV.KT | Có R1 | Bỏ R1, thêm video khác | Video mới mang mã **R2** (không dùng lại R1) | CE-26 | TB |  |  |
| UAT-CE-073 | Ghim / bỏ thẻ VCWIKI và khoá học | tab Thẻ học | NV.KT | Dự án có | Ghim thẻ "Quy trình đọc lỗi … OBD", ghim lộ trình mẫu `/learn`; ghim lại thẻ đó; bỏ ghim | Mã K1, L1; ghim lại báo "Thẻ đã ghim"; bỏ ghim mất khỏi danh sách | CE-26 | TB |  |  |
| UAT-CE-074 | Thành viên và vai trò | tab Tổng quan | NV.KT (chủ) | Dự án có | Thêm TP.KD bằng email vai trò *Người duyệt*; đổi thành *Biên tập*; đổi vai trò của chính mình thành *Chỉ xem*; bỏ chính mình | Thêm / đổi được; bước đổi / bỏ chủ dự án cuối cùng bị chặn "Dự án cần ít nhất một chủ dự án"; email không tồn tại → "Không tìm thấy người dùng" | CE-32 | Cao |  |  |
| UAT-CE-075 | Thành viên ngoài kho | `/studio/projects/{id}` | TP.KD | Được thêm vào dự án (UAT-CE-074, vai trò Biên tập) | Mở danh sách dự án, mở dự án; xem tab Chiến dịch / Viết nhanh | Thấy dự án, tài nguyên, thẻ ghim, thêm được tài nguyên; **không** thấy chiến dịch / bài của dự án (đợt 1, chiến dịch theo quyền kho) | CE-32 | TB |  |  |
| UAT-CE-076 | Người chỉ xem dự án | `/studio/projects/{id}` | TTS.KT | Dự án trong Kho Kỹ thuật | Mở dự án, thử thêm tài nguyên / sửa | Xem được; không có nút sửa; gọi API → 403 | CE-32 | TB |  |  |
| UAT-CE-077 | Người không liên quan | `/studio/projects/{id}` | OUTSIDER | — | Dán URL dự án | Báo không tìm thấy (404), không có trong danh sách | CE-32 | Cao |  |  |
| UAT-CE-078 | Sửa thông tin, lưu trữ, mở lại | tab Tổng quan | NV.KT / KS.KT | KS.KT editor kho | 1) KS.KT sửa mục tiêu. 2) KS.KT bấm lưu trữ. 3) NV.KT (chủ) lưu trữ, rồi mở lại | Bước 1 được (editor sửa được thông tin). Bước 2: 403 (chỉ chủ dự án / chủ kho). Bước 3: dự án chuyển *Đã lưu trữ* rồi *Đang chạy*; lọc danh sách đúng | CE-25, CE-32 | TB |  |  |
| UAT-CE-079 | Xoá dự án | tab Tổng quan | NV.KT | 1 dự án trống, 1 dự án có chiến dịch | Xoá từng dự án | Dự án trống xoá được; dự án có chiến dịch / bài báo "hãy lưu trữ thay vì xoá" (409) | CE-25 | TB |  |  |
| UAT-CE-080 | Lập chiến dịch trong dự án, tham chiếu mặc định | `/studio/new?project=<id>` | NV.KT | Dự án có R, S, P, K | Từ tab Chiến dịch bấm lập; để trống video / link / bài mẫu; lập chiến dịch ①②③ | Kho khoá theo dự án, có ghi chú "dùng tài nguyên dự án…"; tab Tham chiếu có video R của dự án, trang S, bài mẫu P, thẻ ghim đứng đầu K1; chiến dịch hiện ở tab Chiến dịch của dự án | CE-26 | Cao |  |  |
| UAT-CE-081 | Viết nhanh trong dự án | `/studio/quick?project=<id>` | NV.KT | Dự án có thẻ ghim | Tạo bài từ tab Viết nhanh của dự án | Ghi chú "Viết trong dự án …"; thẻ ghim nằm đầu danh sách căn cứ K; bài hiện ở tab Viết nhanh của dự án; gán / bỏ gán dự án ở trang bài được | CE-31 | TB |  |  |

### 6. Phân tích 7P (tab Phân tích của dự án)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| ------ | --------- | -------------------- | ----------------- | -------------- | -------- | ---------------- | ------------- | ------- | --- | --- |
| UAT-CE-090 | Bản trống, sửa tay, mã căn cứ | tab Phân tích | NV.KT | Dự án có R1, K1 | *Bản trống* → điền mục Sản phẩm, mã căn cứ "R1, K1" → *Lưu sửa*; thử mã "R99" | Lưu được, chip căn cứ bấm được; "R99" bị từ chối "Mã căn cứ không có trong dự án" | CE-27 | Cao |  |  |
| UAT-CE-091 | Chốt phiên bản | tab Phân tích | NV.KT (chủ), KS.KT | Bản nháp có chữ | 1) KS.KT bấm *Chốt*. 2) NV.KT *Chốt*. 3) Thử sửa / xoá bản đã chốt. 4) Chốt bản trống | Bước 1: 403. Bước 2: bản thành *Đã chốt*, Tổng quan hiện "Phân tích hiện hành: 7P v1". Bước 3: bị chặn "đã chốt — tạo phiên bản mới". Bước 4: "Phân tích còn trống" | CE-27 | Cao |  |  |
| UAT-CE-092 **[AI]** | AI soạn nháp 7P, soạn lại theo yêu cầu | tab Phân tích | NV.KT | `--ai`; dự án có mục tiêu + tài nguyên | *✦ AI soạn nháp 7P* → chờ; nhập yêu cầu → *✦ AI soạn lại* | Đủ 7 mục, mỗi mục có chữ + mã căn cứ chỉ thuộc dự án; có tóm tắt, câu hỏi còn mở; soạn lại theo yêu cầu, phiên bản không đổi | CE-27 | Cao |  |  |
| UAT-CE-093 | Không cho AI soạn khi dự án rỗng | tab Phân tích | NV.KT | Dự án không mục tiêu, không tài nguyên, không thẻ | *✦ AI soạn nháp 7P* | "Dự án chưa có mục tiêu, tài nguyên hay thẻ ghim nào để AI phân tích" | CE-27 | Thấp |  |  |
| UAT-CE-094 **[AI]** | Chiến dịch / bài nạp 7P đã chốt | chiến dịch trong dự án | NV.KT | Dự án có 7P đã chốt | Lập chiến dịch trong dự án; sau đó tạo bản 7P mới và chốt | Chiến lược nhất quán với 7P; chiến dịch cũ vẫn giữ `analysis_id` bản cũ (không đổi căn cứ khi dự án chốt bản mới) | CE-27 | TB |  |  |
| UAT-CE-095 | Xoá bản nháp, lịch sử phiên bản | tab Phân tích | NV.KT | Có ≥ 2 phiên bản | Xoá một bản nháp; xem danh sách phiên bản | Bản nháp mất; số phiên bản tăng dần, bản hiện hành được đánh dấu | CE-27 | Thấp |  |  |

### 7. Kênh Facebook (`/studio/facebook`)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| ------ | --------- | -------------------- | ----------------- | -------------- | -------- | ---------------- | ------------- | ------- | --- | --- |
| UAT-CE-110 | Thêm nhóm / trang cá nhân | `/studio/facebook` | NV.KT | — | 1) Thêm nhóm không link. 2) Thêm nhóm link `https://example.com/…`. 3) Thêm nhóm link `https://www.facebook.com/groups/…`. 4) Thêm trang cá nhân không link | Bước 1, 2 bị chặn ("Nhóm cần link…", "Link phải là link Facebook"); bước 3, 4 tạo được, nhãn *Đăng hỗ trợ* | CE-21 (5.14) | Cao |  |  |
| UAT-CE-111 | Token sai | `/studio/facebook` | NV.KT | — | Dán chuỗi bất kỳ ≥ 20 ký tự → Kết nối | Báo lỗi tiếng Việt từ Facebook (token không hợp lệ / hết hạn), không tạo kênh | CE-21 (5.14) | TB |  |  |
| UAT-CE-112 **[FB]** | Kết nối Fanpage bằng token | `/studio/facebook` | NV.KT | Token thật (người dùng hoặc Page) | Dán token → Kết nối; kết nối lại cùng token | Hiện Fanpage (mọi trang người đó quản trị nếu là token người dùng), nhãn *Đăng tự động*; token ngắn hạn có cảnh báo 1–2 giờ; kết nối lại không nhân đôi; phản hồi API **không** chứa token | CE-21 (5.14) | Cao |  |  |
| UAT-CE-113 **[FB]** | Đổi token dài hạn | `/studio/facebook` | NV.KT | `.env` có FB_APP_ID, FB_APP_SECRET | Dán token người dùng ngắn hạn | Ghi chú "Máy chủ đã cấu hình…"; kênh không có cảnh báo ngắn hạn (token_kind user_long) | CE-21 (5.14) | TB |  |  |
| UAT-CE-114 **[FB]** | Kiểm tra kết nối | `/studio/facebook` | NV.KT | Fanpage đã kết nối | *Kiểm tra kết nối*; thu hồi quyền app trên Facebook rồi kiểm tra lại | Lần 1: OK, cập nhật giờ kiểm tra. Lần 2: nhãn **Lỗi token** kèm câu tiếng Việt | CE-21 (5.14) | TB |  |  |
| UAT-CE-115 | Quyền kênh theo kho | `/studio/facebook` | TTS.KT, TP.KD | Kênh trong Kho Kỹ thuật | Mở trang | TTS.KT thấy kênh, không sửa / xoá được; TP.KD không thấy | CE-21 (5.14) | TB |  |  |
| UAT-CE-116 | Sửa, xoá kênh | `/studio/facebook` | NV.KT | Có kênh | Đổi tên nhóm; xoá kênh | Tên mới hiện; kênh mất, lần đăng cũ vẫn giữ tên kênh | CE-21 (5.14) | Thấp |  |  |

### 8. Đăng Facebook (khung *Đăng Facebook* ở bài Viết nhanh / bài MXH chiến dịch)

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
| ------ | --------- | -------------------- | ----------------- | -------------- | -------- | ---------------- | ------------- | ------- | --- | --- |
| UAT-CE-130 **[AI]** | Chưa duyệt thì không đăng | `/studio/quick/{id}` | NV.KT | Bài Facebook đã viết, *Nháp* | Xem khung Đăng Facebook | Dòng "Duyệt nội dung rồi mới đăng được", không có nút *Đăng…*; gọi API → 409 | CE-21 (5.14) | Cao |  |  |
| UAT-CE-131 **[AI]** | Bài soạn sẵn + kênh gợi ý | `/studio/quick/{id}` | NV.KT | Bài FB kênh *Nhóm Facebook* đã duyệt; có kênh nhóm | *Đăng…* | Ô bài có mở đầu 1 + thân + hashtag, link UTM, bình luận đầu, sửa được; đích mặc định là kênh loại *nhóm* | CE-21 (5.14) | TB |  |  |
| UAT-CE-132 **[AI]** | Đăng hỗ trợ nhóm → dán link | `/studio/quick/{id}` | NV.KT | UAT-CE-131 | Đăng lên nhóm → mở nhóm ở tab mới, đăng tay → dán link bài `facebook.com/…` → xác nhận; lần khác bấm *Bỏ* | Lần đăng *Chờ dán link* → **Đã đăng** có link, bài ghi link đã đăng; dán link không phải Facebook bị chặn; *Bỏ* → *Đã huỷ* | CE-21 (5.14) | Cao |  |  |
| UAT-CE-133 **[AI]** | Đăng hỗ trợ trang cá nhân + hộp chia sẻ | `/studio/quick/{id}` | NV.KT | Bài FB cá nhân có người đứng tên đã đồng ý, đã duyệt; có kênh trang cá nhân | Đăng lên trang cá nhân (bài có link) | Mở trang cá nhân + có link hộp chia sẻ `facebook.com/sharer`; trạng thái *Chờ dán link* | CE-21 (5.14), CE-18 | TB |  |  |
| UAT-CE-134 **[AI][FB]** | Đăng Fanpage ngay + bình luận đầu | `/studio/quick/{id}` | NV.KT | Fanpage thử đã kết nối; bài Fanpage đã duyệt | Đăng ngay lên Fanpage, có bình luận đầu | Bài lên Fanpage thật; lần đăng **Đã đăng** có link bài; bình luận đầu xuất hiện (nếu lỗi: bài vẫn *Đã đăng*, có cảnh báo) | CE-21 (5.14) | Cao |  |  |
| UAT-CE-135 **[AI][FB]** | Hẹn giờ Fanpage, kiểm tra, huỷ | `/studio/quick/{id}` | NV.KT | Như trên | 1) Hẹn giờ 5 phút tới. 2) Hẹn giờ 15 phút tới. 3) Sau giờ hẹn bấm *Kiểm tra bài hẹn giờ đã lên chưa*. 4) Hẹn giờ khác rồi *Huỷ* | Bước 1: "phải cách bây giờ từ 10 phút đến 30 ngày". Bước 2: *Hẹn giờ*. Bước 3: *Đã đăng* với link thật. Bước 4: *Đã huỷ*, bài hẹn biến mất trên Facebook | CE-21 (5.14) | Cao |  |  |
| UAT-CE-136 **[AI][FB]** | Lỗi token khi đăng | `/studio/quick/{id}` | NV.KT | Fanpage có token đã thu hồi | Đăng lên Fanpage | Báo lỗi tiếng Việt "Token Facebook hết hạn… kết nối lại"; lần đăng *Lỗi* được lưu; kênh chuyển *Lỗi token* | CE-21 (5.14) | TB |  |  |
| UAT-CE-137 **[AI]** | Đăng bài MXH của chiến dịch | `/studio/{id}` ngăn bài MXH | NV.KT | Bài MXH chiến dịch đã duyệt | Mở ngăn bài → khung Đăng Facebook → đăng lên nhóm (hoặc Fanpage nếu có [FB]) | Đăng / xác nhận như bài Viết nhanh; kịch bản video và bài SEO **không** có khung đăng | CE-21 (5.14), CE-19 | TB |  |  |
| UAT-CE-138 **[AI]** | Quyền đăng | `/studio/quick/{id}` | TTS.KT | Bài đã duyệt trong Kho Kỹ thuật | Mở bài | Không có nút *Đăng…*; gọi API → 403 | CE-21 (5.14) | TB |  |  |

---

#### Tổng hợp theo điều kiện chạy

| Điều kiện | Ca |
| --------- | -- |
| Không AI (mặc định) | 001–004, 010–016, 020, 036*, 037*, 050–052, 059, 060*, 070–081, 090, 091, 093, 095, 110, 111, 115, 116 (* cần sẵn nội dung — chạy sau một lượt `--ai` hoặc bỏ qua) |
| Cần `start_uat.sh --ai` | 017–019, 030–035, 038, 053–058, 092, 094, 130–133, 137, 138 |
| Cần token Facebook thật | 112–114, 134–136 (134–136 cần thêm `--ai` để có bài đã duyệt) |

---


## Phần E — SYS · ORG · LRN

*Chỉ gồm chức năng đã có trong code (`develop` `9ff73e4`, 29/09/2026). Chức năng backlog (ORG-11 màn nhật ký, LRN-10 báo cáo, LRN-11 `stale`, SYS-14/15/16…) không đưa vào.*

### Dữ liệu và nhãn điều kiện

- Dựng: `bash start_uat.sh --reset` (không AI) → FE **http://127.0.0.1:5400**, BE :8400, DB `tiktok_to_text_uat` (seed `backend/scripts/seed_uat.py`). Ca đánh dấu **[AI]** chạy bằng `bash start_uat.sh --ai` (Claude theo `.env` / AI local Ollama); ca **[CLI]** cần thêm Claude Code CLI đăng nhập trên máy chủ (Trò chuyện Claude).
- Không bao giờ thao tác trên `localhost:8000` (bản thật).
- Tài khoản (mật khẩu chung `Test@12345`, chi tiết `docs/test-claude-extension/_chung.md`): **ADMIN** admin@uat.test · **TGD** tgd@ · **GD.GARAGE** gd.garage@ (chủ nhánh Kỹ thuật ô tô, grant `category_owner` VCGARAGE) · **TP.KT** tp.kt@ (chủ Kho Kỹ thuật) · **KS.KT** ks.kt@ (editor kho KT, grant `reviewer`, quản lý NV.KT + TTS.KT, người tạo lộ trình mẫu) · **NV.KT** nv.kt@ (editor kho KT, được giao lộ trình mẫu) · **TTS.KT** tts.kt@ (viewer kho KT, được giao) · **GD.PART**, **TP.KD** (chủ Kho KD), **NV.KD** · **HR.LND** hr.lnd@ (grant `lnd` phạm vi VCGARAGE, chủ Kho Công khai) · **AUDITOR** (grant `auditor`) · **OUTSIDER** (chỉ kho cá nhân, quản lý là HR.LND). Cây: TGD → GD.GARAGE → TP.KT → KS.KT → (NV.KT, TTS.KT); TGD → GD.PART → TP.KD → NV.KD; TGD → HR.LND → OUTSIDER; TGD → AUDITOR.
- Tất cả thông báo lỗi dưới đây là nguyên văn code.

---

### 1. SYS — Đăng nhập, tài khoản, vai trò

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-SYS-01 | Cài đặt lần đầu | `/` (màn Login ở chế độ cài đặt) | Người vận hành | DB rỗng (`MONGO_DB=tiktok_to_text_uat` sau `--reset` rồi xoá `users`, hoặc DB trống mới) | 1. Mở app. 2. Nhập họ tên, email, mật khẩu ≥ 8 ký tự. 3. Tạo | Vào app với vai trò quản trị; có "Kho của <tên>". Gọi lại `POST /api/auth/setup` → 409 "Hệ thống đã có tài khoản quản trị" | SYS-01 | Cao |  |  |
| UAT-SYS-02 | Đăng nhập đúng / sai | `/` | NV.KT | Seed UAT | 1. Đăng nhập sai mật khẩu. 2. Đăng nhập email không tồn tại. 3. Đăng nhập đúng | Bước 1, 2 cùng câu "Sai email hoặc mật khẩu" (không lộ email có tồn tại). Bước 3 vào trang chủ, thanh bên hiện tên | SYS-02 | Cao |  |  |
| UAT-SYS-03 | Đăng xuất | Thanh bên | NV.KT | Đang đăng nhập | 1. Bấm Đăng xuất. 2. Bấm Back trình duyệt / F5 | Về màn đăng nhập; gọi API bất kỳ → 401 "Cần đăng nhập" | SYS-02 | TB |  |  |
| UAT-SYS-04 | Tài khoản bị khoá không đăng nhập được | `/`, `/admin` | ADMIN, rồi OUTSIDER | — | 1. ADMIN khoá OUTSIDER ở `/admin` tab Người dùng. 2. OUTSIDER đăng nhập đúng mật khẩu | "Tài khoản đã bị khoá"; phiên OUTSIDER đang mở ở trình duyệt khác bị đăng xuất ngay | SYS-02, SYS-03 | Cao |  |  |
| UAT-SYS-05 | Tạo người dùng | `/admin` → Người dùng | ADMIN | — | 1. Tạo tài khoản mới (email hợp lệ, mật khẩu 8 ký tự, vai trò Thành viên). 2. Tạo lại cùng email | Tạo thành công, người mới có kho cá nhân khi đăng nhập. Lần 2: "Email đã được dùng". Mật khẩu 7 ký tự bị từ chối | SYS-03 | Cao |  |  |
| UAT-SYS-06 | Đổi vai trò, không tự hạ quyền / tự khoá | `/admin` | ADMIN | — | 1. Đổi NV.KD thành Quản trị viên rồi đổi lại. 2. Thử đổi vai trò / khoá chính mình | Bước 1 thành công. Bước 2: ô vai trò của mình bị khoá trên giao diện; gọi thẳng API → 400 "Không tự hạ quyền hoặc tự khoá tài khoản của mình" | SYS-03 | TB |  |  |
| UAT-SYS-07 | Đặt lại mật khẩu người khác | `/admin` | ADMIN, NV.KD | NV.KD đang đăng nhập ở trình duyệt khác và có token MCP | 1. ADMIN đặt lại mật khẩu NV.KD. 2. Kiểm trình duyệt NV.KD. 3. Gọi `/mcp` bằng token cũ của NV.KD | NV.KD bị đăng xuất mọi thiết bị, đăng nhập bằng mật khẩu mới được. Token MCP cũ **vẫn chạy** (hành vi hiện tại, BA 13.7) | SYS-03 | TB |  |  |
| UAT-SYS-08 | Tự đổi mật khẩu | Thanh bên → Đổi mật khẩu | NV.KT | — | 1. Nhập sai mật khẩu hiện tại. 2. Nhập đúng + mật khẩu mới ≥ 8 ký tự. 3. Đăng xuất, đăng nhập mật khẩu mới | Bước 1: "Mật khẩu hiện tại không đúng". Bước 2, 3 thành công | SYS-04 | Cao |  |  |
| UAT-SYS-09 | [Âm] Thành viên không vào được Quản trị | `/admin`, API | NV.KT | — | 1. Gõ `/admin`. 2. Gọi `POST /api/users` | Không có menu, `/admin` chuyển về trang chủ. API → 403 "Chỉ quản trị viên được thực hiện" | SYS-03 | Cao |  |  |
| UAT-SYS-10 | Mở khoá người đã nghỉ việc (đi làm lại) | `/admin` hoặc `/org` "Cho đi làm lại" | ADMIN | Đã chạy UAT-ORG-12 cho OUTSIDER | 1. Mở khoá OUTSIDER. 2. Xem hồ sơ tổ chức | OUTSIDER đăng nhập được; `org.status` về đang làm; vai trò đã chuyển cho quản lý **không** tự trả lại | ORG-08, SYS-03 | TB |  |  |

### 2. SYS — Kho và chia sẻ

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-SYS-11 | Danh sách kho | `/spaces` | NV.KT | Seed | Mở `/spaces` | Thấy kho cá nhân (★), Kho Kỹ thuật (Được sửa), Kho Công khai VCPV (Chỉ xem, công khai); **không** thấy Kho Kinh doanh | SYS-05 | Cao |  |  |
| UAT-SYS-12 | Tạo kho chia sẻ, đổi tên / mô tả / công khai | `/spaces` | OUTSIDER | — | 1. Tạo kho "Kho thử". 2. Đổi tên, mô tả. 3. Bật công khai trong công ty. 4. NV.KD mở `/spaces` | Bước 1–3 thành công. Bước 4: NV.KD thấy "Kho thử" với quyền Chỉ xem mà không cần mời | SYS-05 | Cao |  |  |
| UAT-SYS-13 | Mời thành viên, đổi quyền, gỡ | `/spaces` | TP.KD | — | 1. Mời NV.KT (Chỉ xem) vào Kho KD. 2. Đổi thành Được sửa. 3. Gỡ. 4. Mời email không tồn tại | 1–3 thành công, NV.KT thấy / mất Kho KD tương ứng. 4: "Không tìm thấy người dùng với email này" | SYS-05 | Cao |  |  |
| UAT-SYS-14 | Thành viên tự rời kho | `/spaces` | NV.KD | NV.KD là editor Kho KD | Bấm Rời kho | Kho biến mất khỏi danh sách của NV.KD | SYS-05 | TB |  |  |
| UAT-SYS-15 | Xoá kho: chỉ kho trống, không xoá kho cá nhân | `/spaces` | TP.KT | — | 1. Xoá Kho Kỹ thuật (còn thẻ). 2. Xoá kho cá nhân. 3. Tạo kho mới rồi xoá | 1: "Kho còn dữ liệu — hãy xoá hoặc chuyển dữ liệu trước". 2: "Không xoá được kho cá nhân". 3: xoá được | SYS-05 | TB |  |  |
| UAT-SYS-16 | [Âm] Không lộ kho khi không có quyền | API `/api/spaces/{id}` | OUTSIDER | Lấy id Kho KD từ tài khoản TP.KD | Gọi `GET /api/spaces/<id Kho KD>` | 404 "Không tìm thấy kho" (không phải 403) | SYS-05, 6.2 | Cao |  |  |
| UAT-SYS-17 | [Âm] Chỉ xem không sửa / quản lý được | `/spaces`, API | TTS.KT | TTS.KT là viewer kho KT | 1. Thử mời người vào Kho KT. 2. `PATCH /api/spaces/<kt>` | 403 "Chỉ chủ kho được thực hiện"; giao diện không hiện nút quản lý | SYS-05 | Cao |  |  |
| UAT-SYS-18 | [Âm] Admin không tự đọc kho người khác | `/wiki`, API | ADMIN | ADMIN không thuộc Kho KT | 1. Tìm thẻ "Mã lỗi DTC là gì". 2. `GET /api/spaces/<kt>` | Không thấy thẻ; API 404 | ORG-13 | Cao |  |  |

### 3. SYS — Token API, cổng MCP, trạng thái AI

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-SYS-19 | Tạo token, hiện một lần | `/connect` | NV.KT | — | 1. Tạo token tên "Claude Desktop". 2. Tải lại trang | Token `vcmcp_…` hiện đúng một lần kèm lệnh cài Claude Code / cấu hình Claude Desktop; sau khi tải lại chỉ còn tên, 4 ký tự cuối, tạo lúc, "Chưa dùng" | SYS-08, SYS-11 | Cao |  |  |
| UAT-SYS-20 | Kết nối MCP bằng token | Claude Desktop / Code hoặc `curl` tới `http://127.0.0.1:8400/mcp` | NV.KT | Có token (UAT-SYS-19) | 1. Cài token vào Claude Code (`claude mcp add … --header "Authorization: Bearer …"`). 2. Gọi `whoami`, `list_spaces` | Trả đúng NV.KT, kho giống `/spaces`; cột "Dùng lần cuối" ở `/connect` cập nhật | SYS-09 | Cao |  |  |
| UAT-SYS-21 | [Âm] Thiếu / sai token | `curl -X POST http://127.0.0.1:8400/mcp` | Bất kỳ | — | 1. Gọi không header. 2. Header `Bearer vcmcp_sai` | 401 `invalid_token` trước khi mở phiên | SYS-09 | Cao |  |  |
| UAT-SYS-22 | Thu hồi token | `/connect` | NV.KT | Token đang dùng | 1. Thu hồi. 2. Gọi lại `whoami` | 401; token biến khỏi danh sách | SYS-08 | Cao |  |  |
| UAT-SYS-23 | Khoá tài khoản thu hồi mọi token | `/admin` | ADMIN | NV.KD có token | 1. Khoá NV.KD. 2. Gọi MCP bằng token NV.KD. 3. Mở khoá, xem `/connect` của NV.KD | Bước 2: 401. Bước 3: danh sách token trống | SYS-03, SYS-08 | Cao |  |  |
| UAT-SYS-24 | MCP giữ quyền kho | Claude qua MCP | OUTSIDER | Token OUTSIDER | 1. `search_cards` "phanh". 2. `get_card` id thẻ Kho KT | 1: không có thẻ Kho KT. 2: lỗi tool "Không tìm thấy …" | SYS-09, 6.5 | Cao |  |  |
| UAT-SYS-25 | [Âm] MCP không duyệt được | Claude qua MCP | TP.KT | Có đề xuất đang chờ TP.KT duyệt bước 1 | Gọi `review_change(change_id, decision="approve")` | Lỗi tool kèm đường dẫn `/wiki/review?change=<id>`; đề xuất vẫn chờ. `view` / `comment` / `reject` chạy được | SYS-12 | Cao |  |  |
| UAT-SYS-26 | Thẻ tạo qua MCP ghi nguồn gốc | Claude qua MCP, panel thẻ `/wiki` | NV.KT | Token NV.KT | 1. `create_card(type=concept, title=…, space_id=<kt>, ai_model="Claude X")`. 2. Mở thẻ trên web | Thẻ ở trạng thái nháp / chờ duyệt; cột "AI tinh chế" hiện ứng dụng (Claude Code / Desktop hoặc tên token) + model | SYS-13 (phần tạo) | TB |  |  |
| UAT-SYS-27 | [Âm] Host lạ bị chặn | `curl -H "Host: evil.example" …/mcp` | Bất kỳ | Token hợp lệ, `MCP_ALLOWED_HOSTS` trống | Gọi với Host lạ | Bị từ chối (421 / 400 của lớp bảo vệ DNS rebinding) | SYS-10 | TB |  |  |
| UAT-SYS-28 | Trạng thái AI | `/kb` | NV.KT | Chạy **không** `--ai` | Mở `/kb` | Băng vàng "AI chưa sẵn sàng: …" nêu lý do; nạp nguồn vẫn chuyển chữ | SYS-07 | TB |  |  |
| UAT-SYS-29 | [AI] Trạng thái AI khi có AI local | `/kb`, `GET /api/kb/status` | ADMIN | `start_uat.sh --ai`, Ollama chạy | Xem `ai.local` | `ready = true`, `model`, `embed_model`, danh sách model; không hiện băng lỗi | SYS-07, SYS-17 | Thấp |  |  |

### 4. SYS — Trò chuyện Claude, Chat nhanh, Hướng dẫn, Kênh yêu cầu

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-SYS-30 | [CLI] Hỏi Claude trong app | `/chat` | NV.KT | `claude` CLI đăng nhập trên máy chủ | 1. Tạo cuộc trò chuyện mới. 2. Hỏi "Tìm thẻ về má phanh". 3. Chờ trả lời | Chữ hiện dần (SSE), có danh sách công cụ đã gọi (`search_cards`…), link thẻ mở panel tại chỗ; tiêu đề luồng = câu đầu | 14.8 | Cao |  |  |
| UAT-SYS-31 | [CLI] Claude trong chat chỉ có quyền người chat | `/chat` | OUTSIDER | Như trên | Hỏi "Đọc thẻ Chính sách chiết khấu đại lý 2026" | Claude báo không tìm thấy / không có quyền; không lộ nội dung | 14.8, ORG-10 | Cao |  |  |
| UAT-SYS-32 | [CLI] Dừng lượt, không gửi chồng | `/chat` | NV.KT | Lượt đang chạy | 1. Gửi câu thứ hai khi câu đầu chưa xong. 2. Bấm Dừng | Bước 1: "Claude đang trả lời câu trước". Bước 2: lượt dừng, ghi "Đã dừng" | 14.8 | TB |  |  |
| UAT-SYS-33 | [Âm] Không đọc luồng chat người khác | API `/api/chat/threads/{id}` | ADMIN | Lấy id luồng của NV.KT | 1. Gọi GET luồng. 2. Tích "Của mọi người" ở `/chat` | 1: 404 "Không tìm thấy cuộc trò chuyện". 2: vẫn chỉ thấy luồng của mình (ô này không còn tác dụng — xem backlog B-01) | ORG-13 | Cao |  |  |
| UAT-SYS-34 | **Loại bỏ** (v0.11, thay UAT-SYS-50/53): Chat khi máy chủ chưa có CLI | `/chat` | NV.KT | Máy UAT không có `claude` | Gửi câu hỏi | Màn báo chưa sẵn sàng; API gửi tin → 503 "Máy chủ chưa cài Claude Code CLI" | 14.8 | Thấp |  |  |
| UAT-SYS-35 | [CLI] Chat nhanh theo trang đang mở | Mọi trang (vd `/learn`) → nút *✺ Hỏi Claude* | NV.KT | Như UAT-SYS-30 | 1. Ở `/learn`, mở Chat nhanh. 2. Hỏi "Trang này dùng thế nào?". 3. ⤢ mở rộng | Trả lời theo mục hướng dẫn `hoc-tap` kèm link `/guide#…`; ⤢ mở `/chat/<id>` đúng luồng; F5 vẫn nhớ cửa sổ mở | 14.8 | TB |  |  |
| UAT-SYS-50 | Thiếu CLI, Ollama sẵn sàng | `/chat`, Chat nhanh | NV.KT | `CLAUDE_BIN=/khong/co`, `AI_FALLBACK=local`, Ollama có `LOCAL_LLM_MODEL` | Gửi câu hỏi chữ / cách dùng trang | Vẫn gửi được; chữ hiện dần; nhãn AI local + tra cứu theo quyền, chưa ghi dữ liệu (mở rộng bởi SYS-39); `model=local:<model>`; tải lại vẫn đúng câu | SYS-38, SCR-22.1 | Cao | | |
| UAT-SYS-51 | CLI lỗi / hết lượt / timeout / kết quả hỏng | `/chat` | NV.KT | CLI giả báo lỗi, chưa gọi công cụ; Ollama sẵn sàng | Gửi câu hỏi; thử trường hợp CLI đã phát chữ dở | Tự chuyển local đúng một lần; chữ dở Claude được thay, không nối vào câu local; token MCP và file tạm được dọn | SYS-38, SCR-22.1 | Cao | | |
| UAT-SYS-52 | Giữ lịch sử qua Claude → local → Claude | `/chat` | NV.KT | Cùng một luồng | Chat một lượt Claude; làm CLI lỗi để trả lời local; khôi phục CLI rồi hỏi tiếp | Local nhận lịch sử đúng luồng; lần Claude kế mở phiên mới kèm bối cảnh, câu hiện tại xuất hiện đúng một lần; không lộ luồng người khác | SYS-38, ORG-13, SCR-22.1 | Cao | | |
| UAT-SYS-53 | Cả hai AI lỗi / tắt dự phòng | `/chat`, Chat nhanh | NV.KT | CLI lỗi; Ollama tắt hoặc thiếu model; thử thêm `AI_FALLBACK=off` | Gửi câu hỏi | Nêu rõ chưa sẵn sàng / lỗi; không có câu trả lời rỗng mang trạng thái thành công; off không gọi local; giữ quyền CHAT_ACCESS | SYS-38, SCR-22.1 | Cao | | |
| UAT-SYS-54 | Dừng và chống chạy lặp thao tác | `/chat` | NV.KT | CLI giả đã gọi công cụ rồi lỗi; lượt khác local chờ chữ | 1. Kiểm CLI lỗi sau tool 2. Bấm Dừng khi local đang chờ / đang trả | 1: không chuyển local, giữ log công cụ 2: huỷ HTTP local, giữ chữ đã có và báo Đã dừng; không mở lượt AI khác | SYS-38, SCR-22.1 | Cao | | |
| UAT-SYS-55 | Giới hạn context và stream | `/chat` | NV.KT | CLI lỗi; local giả | Gửi câu dài hơn context; thử local trả rỗng, bị cắt, stream lỗi / thiếu kết thúc | Câu hỏi quá dài được yêu cầu rút ngắn, không gửi bị cắt âm thầm; chỉ lịch sử cũ được bỏ theo lượt; local lỗi ghi lỗi rõ | SYS-38, SCR-22.1 | TB | | |
| UAT-SYS-56 | Local đọc hướng dẫn video theo câu hỏi | `/chat`, Chat nhanh | NV.KT | Ollama gemma3:12b, CLI không hoạt động; đang mở `/learn` | Hỏi “tao them vi deo vao de chuyen doi du lieu nhu the nao” | Gọi read_guide mục nap-tu-lieu, trả các bước nạp video / chuyển chữ kèm `/guide#nap-tu-lieu`; không báo không có thông tin vì sai trang | SYS-39 SCR-22.2 | Cao | | |
| UAT-SYS-57 | Local tra cứu đúng quyền và có nhật ký | `/chat`, Chat nhanh | NV.KT, ADMIN | Có thẻ / tài liệu trong kho riêng người khác | Hỏi tìm thẻ / đọc video / khoá học; thử đọc ID thẻ kho riêng | Chỉ trả tài nguyên người chat xem được (admin không đọc kho riêng người khác); hiện công cụ / tham số / trạng thái; token tạm được thu hồi khi xong / dừng | SYS-39 ORG-13 SCR-22.2 | Cao | | |
| UAT-SYS-58 | Chặn ghi / JSON điều khiển / giới hạn vòng | `/chat` | NV.KT | Model giả yêu cầu công cụ ghi hoặc tham số ctx; giả vòng lặp / lỗi | Gửi câu hỏi; dừng khi đang chọn công cụ | Máy chủ chặn công cụ ghi / quyền giả, kiểm schema MCP, không phát JSON điều khiển làm câu trả lời; giới hạn số lượt và context; dừng không gọi tool kế tiếp, token được thu hồi | SYS-39 SCR-22.2 | Cao | | |
| UAT-SYS-59 | [AI] Ollama nhả model khi rảnh | `/chat` hoặc tìm theo nghĩa; Terminal `ollama ps` | NV.KT | `start_uat.sh --ai`; `LOCAL_AI_IDLE_SECONDS=5`; Ollama có model chữ và embedding | 1. Gửi một câu dùng AI local, chạy `ollama ps` khi đang làm và sau ≥ 5 giây 2. Tìm theo nghĩa rồi kiểm tương tự 3. Gửi hai lượt đồng thời, xác nhận không nhả giữa lượt 4. Dừng UAT khi model đang nạp | 1–2: model tương ứng xuất hiện lúc làm và biến khỏi `ollama ps` sau khi rảnh; 3: cả hai lượt hoàn tất, đồng hồ tính lại từ lượt cuối; 4: cả hai model được nhả ngay. Daemon Ollama vẫn chạy và lượt sau tự nạp lại | SYS-41 TK-17 | Cao | Kiểm tự động đạt — chờ UAT người dùng | 730 ca backend đạt theo hai lượt: full 729 đạt + ca đồng bộ BA đạt sau khi sinh lại Phụ lục A; 1 ca live bỏ qua |
| UAT-SYS-36 | Trang Hướng dẫn | `/guide` | TTS.KT | — | Mở `/guide`, bấm mục "Học tập", bấm nút mở trang trong mục | Mục lục đủ nhóm; neo `#id` cuộn đúng; nút dẫn đúng trang | 14.8 (v0.29) | TB |  |  |
| UAT-SYS-37 | Hướng dẫn cho AI không cần đăng nhập | `http://127.0.0.1:8400/guide.md`, `/api/guide`, `/guide/soan-khoa.md` | Không đăng nhập | — | Mở ba địa chỉ trong trình duyệt ẩn danh | Trả markdown / JSON nội dung giống `/guide`; không 401 | 14.8 (v0.29) | Thấp |  |  |
| UAT-SYS-38 | Kênh yêu cầu phát triển (vòng đầy đủ) | Claude qua MCP | ADMIN (2 phiên: "Desktop" và "Code") | Token ADMIN | 1. `submit_request(title, description, acceptance)`. 2. Phiên Code `claim_request`. 3. `update_request(needs_info, note)`. 4. `reply_request(text)`. 5. `claim_request` lại, `update_request(done, report={summary})` | Trạng thái lần lượt new → in_progress → needs_info → new → in_progress → done; `get_request` có đủ log | Phụ lục A.6 (kênh yêu cầu) | TB |  |  |
| UAT-SYS-39 | [Âm] Thành viên không dùng kênh yêu cầu | Claude qua MCP | NV.KT | Token NV.KT | Gọi `list_requests` | Lỗi "Chỉ quản trị viên dùng kênh yêu cầu phát triển" | 14.9 | TB |  |  |
| UAT-SYS-40 | Mỗi người giữ một yêu cầu | Claude qua MCP | ADMIN | Có 2 yêu cầu `new` | `claim_request` hai lần liên tiếp | Lần 2 trả lại chính yêu cầu đang giữ (không nhận thêm); kết thúc bắt buộc `report.summary` (thiếu → "Kết thúc (done / rejected) cần report có summary") | 14.9 | Thấp |  |  |
| UAT-SYS-41 | Chia sẻ kho theo đơn vị | `/spaces` | tp_kd (chủ kho), nv_kd, nv_kt | Kho *KD chung* của tp_kd; nv_kd thuộc phòng KD, nv_kt phòng KT | 1. *Quản lý* → tab *Thành viên* → *Chia sẻ kho* → *Đơn vị* = phòng KD, *Xem* 2. nv_kd mở `/spaces`, `/wiki?space_id=` 3. nv_kt mở link một thẻ trong kho 4. Đổi quyền *Sửa* + *Gồm đơn vị con*; nv_kd nạp nguồn 5. Gỡ đơn vị | 2: nv_kd thấy kho ở *Được chia sẻ với tôi*, đọc được thẻ; 3: "không tìm thấy"; 4: nạp được; 5: nv_kd mất quyền ngay (tải lại trang), trừ khi được mời riêng. Hàng đơn vị ghi số người hiện có | SYS-35 | Cao |  |  |
| UAT-SYS-42 | Đăng nhập gần nhất | `/admin` | admin, nv_kt | — | 1. nv_kt đăng nhập web 2. admin xem cột *Đăng nhập gần nhất*, bấm lọc *Không đăng nhập ≥ 30 ngày*, sắp xếp theo cột 3. nv_kt gọi `/api/users` | 2: nv_kt hiện "vừa xong" (rê chuột thấy ngày giờ đầy đủ); người chưa từng đăng nhập ghi "Chưa đăng nhập" và nằm trong lọc ≥ 30 ngày; 3: không có trường đăng nhập gần nhất. Dùng token MCP không làm đổi cột | SYS-36 | TB |  |  |
| UAT-SYS-43 | Khung quản lý kho | `/spaces?space=<id>` | tp_kd | Kho chia sẻ có dữ liệu | 1. Đổi công khai / riêng tư 2. Tab *Nguy hiểm* → *Xoá kho* 3. *Nạp nguồn* ở thẻ kho | 1: hỏi lại, nêu số thẻ / nguồn bị ảnh hưởng; 2: chỉ bấm được khi gõ đúng tên kho, kho còn dữ liệu thì báo lỗi; 3: mở `/kb?add=1&space_id=` chọn sẵn kho; nút Quay lại đóng khung | SYS-05 | TB |  |  |
| UAT-SYS-44 | Người dùng & lĩnh vực | `/admin` | admin | — | 1. Tìm theo tên / email, lọc vai trò; tải lại trang 2. Đổi vai trò một người, *Huỷ* rồi *Đồng ý* 3. Khoá / mở khoá 4. *Tạo tài khoản*: ô mật khẩu, nút *Hiện* 5. Menu tài khoản → *Đổi mật khẩu*, nhập lại không khớp | 1: bộ lọc giữ trên URL; 2, 3: luôn hỏi lại; 4: mật khẩu bị che, *Hiện* mở ra; 5: lỗi bằng chữ, không lưu | SYS-03, 06 | TB |  |  |

### 5. ORG — Cơ cấu tổ chức, vai trò, policy

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-ORG-01 | Sơ đồ tổ chức + "của tôi" | `/org` tab Sơ đồ tổ chức | KS.KT | Seed | Mở `/org` | Thấy cây VCPV → VCgarage → Phòng KT…; khối "Của tôi": quản lý TP.KT, người dưới quyền NV.KT, TTS.KT, vai trò `reviewer` | ORG-14 | Cao |  |  |
| UAT-ORG-02 | Thêm / sửa / sắp xếp / ẩn đơn vị | `/org` | ADMIN | — | 1. Thêm Phòng "VCPART-MKT" dưới VCpart. 2. Thêm Nhóm dưới phòng đó. 3. Đổi thứ tự. 4. Ẩn phòng | Tạo được; ẩn phòng ẩn cả nhóm con; mã trùng bị từ chối | ORG-01 | Cao |  |  |
| UAT-ORG-03 | Luật loại đơn vị / độ sâu | `/org` | ADMIN | — | 1. Tạo Division dưới Phòng. 2. Tạo tầng thứ 5 | Cả hai bị từ chối với thông báo nêu lý do (loại phải thấp hơn cha, tối đa 4 tầng) | ORG-01 | TB |  |  |
| UAT-ORG-04 | Chức năng + mảng tri thức | `/org` tab Chức năng | ADMIN | — | 1. Thêm chức năng `finance`. 2. Gắn `category_root`. 3. Ẩn / hiện | Thành công; mã không sửa được sau khi tạo | ORG-02, ORG-05 | TB |  |  |
| UAT-ORG-05 | Sửa hồ sơ tổ chức, chặn vòng quản lý | `/org` → Sửa hồ sơ | ADMIN | — | 1. Đặt NV.KT kiêm nhiệm VCPART-KD, cấp bậc 3. 2. Đặt quản lý của TP.KT là NV.KT | 1 lưu được. 2 bị từ chối (vòng quản lý) | ORG-03 | Cao |  |  |
| UAT-ORG-06 | Nhập Excel / CSV xem trước | `/org` tab Nhập Excel | ADMIN | File mẫu có 1 dòng lỗi (email quản lý sai) + cột Cấp bậc | 1. Tải file, xem trước. 2. Sửa lỗi, xem trước. 3. Ghi. 4. Nhập lại cùng file | 1: báo lỗi đúng dòng, không ghi gì. 3: tài khoản mới + mật khẩu ngẫu nhiên hiện một lần. 4: không tạo trùng | ORG-04 | Cao |  |  |
| UAT-ORG-07 | Cấp / thu hồi vai trò theo phạm vi | `/org` tab Vai trò chức năng | ADMIN | — | 1. Cấp `lnd` cho TP.KD phạm vi VCPART. 2. Cấp trùng thời gian. 3. Thu hồi | 1 OK. 2: báo trùng. 3: vai trò hết hạn (không xoá), hiện người / lúc thu hồi | ORG-06 | Cao |  |  |
| UAT-ORG-08 | Uỷ quyền có hạn | `/org` khối "Của tôi" | KS.KT | KS.KT có `reviewer` | 1. Uỷ quyền `reviewer` cho NV.KT đến ngày mai. 2. Uỷ quyền trùng. 3. NV.KT uỷ tiếp cho TTS.KT | 1 OK, NV.KT thấy vai trò "thay KS.KT". 2: 409. 3: bị từ chối | ORG-07 | TB |  |  |
| UAT-ORG-09 | Bảng cấp bậc → bậc nội dung | `/org` tab Cấp bậc | ADMIN | — | Sửa cấp 2 `own` thêm "vận hành", lưu; thử bỏ trống một cấp qua API | Lưu được; thiếu cấp → 400 "Thiếu cấp …" | ORG-05 | Thấp |  |  |
| UAT-ORG-10 | [Âm] Thành viên không sửa cơ cấu | `/org`, API | TP.KT | — | 1. Xem `/org`. 2. `POST /api/org/units` | Chỉ có tab Sơ đồ tổ chức; API 403 "Chỉ quản trị viên được sửa cơ cấu tổ chức" | ORG-01, 15.6 | Cao |  |  |
| UAT-ORG-11 | Nghỉ việc: bàn giao | `/org` → Xử lý nghỉ việc | ADMIN | KS.KT có `reviewer`, 2 người dưới quyền | Xử lý nghỉ việc KS.KT | KS.KT bị khoá, mất phiên + token; `reviewer` chuyển cho TP.KT (ghi chuyển từ); NV.KT, TTS.KT có quản lý mới là TP.KT; kết quả liệt kê đủ | ORG-08 | Cao |  |  |
| UAT-ORG-12 | Nghỉ việc — chặn trường hợp sai | `/org` | ADMIN | — | 1. Tự xử lý nghỉ việc cho mình. 2. Xử lý lần 2 cho người đã nghỉ | 1: "Không tự xử lý nghỉ việc cho chính mình". 2: 409 "Người này đã được xử lý nghỉ việc" | ORG-08 | TB |  |  |
| UAT-ORG-13 | Nhật ký người duyệt ngoài kho | `/wiki/review` | GD.GARAGE | Có đề xuất thẻ kỹ thuật chờ bước 2 (GD.GARAGE không ở Kho KT) | Mở đề xuất | Xem được đề xuất được giao; `access_log` có bản ghi `change.read_as_reviewer` (kiểm bằng mongosh DB UAT). Người không được giao mở cùng id → 404 | ORG-11 (phần ghi), ORG-13 | TB |  |  |
| UAT-ORG-14 | [Âm] Nhật ký truy cập chưa có API | `GET /api/org/access-log` | AUDITOR | — | Gọi API | 501 "Chưa triển khai (ORG-11)" — xác nhận đúng hiện trạng, không phải lỗi | ORG-11 | Thấp |  |  |
| UAT-ORG-15 | Cơ cấu tổ chức theo tab, cây, hồ sơ | `/org` | admin, nv_kt | Có cây đơn vị | 1. admin: tab *Sơ đồ*, đi cây bằng ↑ ↓ → ← Enter 2. Menu *Thêm ▾* của đơn vị: thêm đơn vị con, đưa lên / xuống, ẩn 3. Bấm tên người → hồ sơ → *Sửa hồ sơ* 4. Dán link `/org?unit=…&person=…` ở tab khác 5. nv_kt mở `/org`, gõ `?tab=levels` | 1: đơn vị chọn ghi `?unit=`; 2: sửa / thêm đơn vị trong hộp riêng, ẩn có hỏi lại; 3: hồ sơ ở ngăn kéo, lưu có thông báo; 4: mở đúng đơn vị + hồ sơ, Quay lại đóng hồ sơ; 5: chỉ có *Sơ đồ*, *Của tôi*, mặc định *Của tôi* | ORG-01…08 | Cao |  |  |

### 6. LRN — Học tập

| Mã UAT | Chức năng | Màn hình / đường dẫn | Vai trò thực hiện | Tiền điều kiện | Các bước | Kết quả mong đợi | Mã yêu cầu BA | Ưu tiên | Kết quả | Ghi chú |
|---|---|---|---|---|---|---|---|---| --- | --- |
| UAT-LRN-01 | Menu theo quyền | Thanh bên | TTS.KT, KS.KT, HR.LND | Seed | Đăng nhập từng người, xem menu Học tập | TTS.KT: Học tập của tôi, Thư viện. KS.KT: thêm Thiết kế lộ trình, Lộ trình học, Chấm bài. HR.LND: thêm Thiết kế / Lộ trình | LRN-06 | TB |  |  |
| UAT-LRN-02 | Học tập của tôi | `/learn` | NV.KT | Được giao lộ trình mẫu | Mở `/learn`, bấm **Bắt đầu** | Thẻ khoá có tên, số tuần / bài, hạn, thanh tiến độ, nhãn *Được giao*, "giao bởi KS.KT"; Bắt đầu mở đúng bài đầu tiên chưa xong | LRN-06 | Cao |  |  |
| UAT-LRN-03 | Đọc bài học ghim phiên bản | `/learn/lessons/:id` | NV.KT | — | Mở "Bài 1 — Đọc mã lỗi OBD" | Hiện diễn giải + nội dung thẻ đúng phiên bản ghim, mã thẻ + phiên bản | LRN-01 | Cao |  |  |
| UAT-LRN-04 | Luyện tập, làm tiếp lượt dở | `/learn/lessons/:id` → Luyện tập | NV.KT | Bài 1 có 3 câu | 1. Bắt đầu, trả lời 1 câu, Huỷ. 2. Bắt đầu lại. 3. Nộp | 2: tiếp tục lượt cũ, giữ câu đã chọn. 3: điểm + đáp án + giải thích ngay; bài tính "đã học" | LRN-09, 17.7 | Cao |  |  |
| UAT-LRN-05 | Soạn bài học từ thẻ đã duyệt | `/learn/library` | KS.KT | — | 1. Tạo bài chọn 2 thẻ approved ở Kho KT. 2. Thêm thẻ nháp. 3. Phát hành. 4. Sửa bài đã phát hành | 1 OK, mức mật = cao nhất của thẻ. 2: "Chỉ dùng được thẻ VCWIKI đã duyệt mà bạn xem được…". 4: 409 "Bài học đã phát hành — nội dung bị khoá. Tạo bản sao để sửa" | LRN-01 | Cao |  |  |
| UAT-LRN-06 | Ngân hàng câu hỏi — luật hợp lệ | `/learn/library?tab=questions` | KS.KT | — | 1. Câu một đáp án 2 phương án đúng. 2. Câu 1 phương án. 3. Tự luận không rubric. 4. Câu hợp lệ → *Lưu, duyệt và tạo câu tiếp* | 1: "Câu một đáp án phải có đúng 1 phương án đúng". 2: "Câu trắc nghiệm cần 2–6 phương án". 3: "Câu tự luận cần rubric ít nhất 1 tiêu chí". 4: lưu + duyệt, form giữ thẻ căn cứ | LRN-02 | Cao |  |  |
| UAT-LRN-07 | Nhập nhiều câu JSON / CSV | `/learn/library?tab=questions` → Nhập nhiều câu | KS.KT | File JSON 3 câu, 1 câu sai luật | Dán, xem trước, gửi | Xem trước đánh dấu câu sai; gửi 2 câu đúng | LRN-02 (v0.29) | TB |  |  |
| UAT-LRN-08 | [Âm] Người không soạn được | `/learn/library`, API | TTS.KT | — | `POST /api/learn/lessons` / `questions` | 403 "Chỉ quản lý, biên tập viên (editor) hoặc L&D được soạn bài học và câu hỏi"; ngân hàng câu hỏi (có đáp án) không hiện | LRN-01, 02, 15.6 | Cao |  |  |
| UAT-LRN-09 | Tạo lộ trình tháng, ma trận đề, phát hành | `/learn/paths` | KS.KT | Có bài học, câu approved đủ | 1. Tạo lộ trình tháng: tuần 1–2, bài, bài thi 3 câu single (điểm đạt để mặc định). 2. Phát hành. 3. Sửa sau phát hành | Điểm đạt mặc định 70; phát hành khoá nội dung; 3: 409 "Lộ trình đã phát hành — nội dung bị khoá". Ma trận thiếu câu → từ chối phát hành | LRN-03, 17.7 | Cao |  |  |
| UAT-LRN-10 | Kế thừa khung năm | `/learn/paths` | TGD rồi GD.GARAGE | TGD tạo + phát hành lộ trình năm có mục bắt buộc | GD.GARAGE tạo lộ trình tháng kế thừa khung, thử bỏ mục bắt buộc | Tuần 1 điền sẵn mục của khung; bỏ mục bắt buộc → "Không được bỏ mục bắt buộc của khung: …" | LRN-03, 17.4 | TB |  |  |
| UAT-LRN-11 | Giao bài trong cây dưới quyền | `/learn/paths/:id` → Giao | KS.KT | Lộ trình đã phát hành | Giao cho NV.KT, TTS.KT; thử giao cho NV.KD | Hai người trong cây nhận việc (hạn 23:59 ngày cuối kỳ). NV.KD → 403 "Chỉ giao được cho người trong cây dưới quyền của bạn" | LRN-05 | Cao |  |  |
| UAT-LRN-12 | L&D giao theo phạm vi đơn vị | `/learn/paths/:id` → Giao theo đơn vị | HR.LND | HR.LND có lộ trình đã phát hành | Giao theo đơn vị VCGARAGE-KT; thử giao NV.KD | Người ở VCgarage nhận; NV.KD (ngoài phạm vi VCGARAGE) bị từ chối | LRN-05, 15.6 | TB |  |  |
| UAT-LRN-13 | Người học đọc bài C0 / C1 ngoài kho qua lộ trình | `/learn` | OUTSIDER | HR.LND (quản lý OUTSIDER) giao lộ trình có bài ở Kho KT (C1) | OUTSIDER mở bài | Đọc được bài + thẻ trong bài dù không ở Kho KT | LRN-05 (vấn đề mở 33) | TB |  |  |
| UAT-LRN-14 | Thi có giờ, tự lưu, tự nộp | `/learn` → Vào thi → `/learn/attempts/:id` | NV.KT | Lộ trình mẫu (10 phút) | 1. Làm 1 câu, tải lại trang. 2. Để quá giờ (hoặc sửa `duration_min` ngắn ở lộ trình thử) | 1: câu trả lời còn. 2: bài tự nộp, nhãn *tự nộp*; chỉ trắc nghiệm → tự chốt, có điểm + đạt / chưa đạt (≥ 70%) | LRN-07, 17.7 | Cao |  |  |
| UAT-LRN-15 | Hết lượt thi | `/learn` | NV.KT | Đã dùng 1 lượt (`attempts = 1`) | Bấm vào thi lần nữa | Không cho bắt đầu lượt mới: 409 "Bạn đã dùng hết lượt thi của lộ trình này"; hiện kết quả lượt trước | LRN-07 | TB |  |  |
| UAT-LRN-16 | [AI] AI chấm sơ bộ tự luận | `/learn/grading` | TTS.KT nộp; KS.KT xem | `--ai`; lộ trình có câu tự luận hybrid | TTS.KT nộp bài có tự luận; KS.KT mở hàng chờ chấm | Điểm AI theo từng tiêu chí rubric + nhận xét nháp đánh số theo câu; `ai_status = done` | LRN-08 | Cao |  |  |
| UAT-LRN-17 | Chốt điểm tự luận (không AI) | `/learn/grading` | KS.KT | Không `--ai`; bài tự luận đã nộp | 1. Chốt không nhận xét. 2. Có nhận xét, chốt | 1: "Bắt buộc viết nhận xét cho người học trước khi chốt". 2: chốt; điểm AI trống không chặn; người học thấy điểm + nhận xét sau khi chốt | LRN-08 | Cao |  |  |
| UAT-LRN-18 | [AI] Lệch điểm AI ≥ 20% phải ghi lý do | `/learn/grading` | KS.KT | UAT-LRN-16 | Cho điểm lệch ≥ 20% thang câu, không lý do → chốt; rồi thêm lý do | Lỗi "Câu n: điểm lệch điểm AI (x) từ 20% thang điểm trở lên — bắt buộc ghi lý do"; có lý do thì chốt được, lưu cả điểm AI và người | LRN-08 | Cao |  |  |
| UAT-LRN-19 | [Âm] Người không được chấm | API `/learn/attempts/{id}/finalize`, `/learn/grading` | TP.KD | Bài của TTS.KT | Gọi finalize | 403 "Chỉ người giao lộ trình hoặc quản lý trực tiếp của người học được chốt điểm"; bài không có trong hàng chờ của TP.KD | LRN-08, 15.6 | Cao |  |  |
| UAT-LRN-20 | [Âm] Đồng nghiệp không xem được bài làm | API `/learn/attempts/{id}` | NV.KT | Lượt thi của TTS.KT (ngang cấp) | Gọi GET | 404 / 403, không lộ điểm | LRN-09, 15.6 | Cao |  |  |
| UAT-LRN-21 | Cấp trên nhiều tầng xem kết quả | API / `/learn/grading?inbox=0` | GD.GARAGE | Bài TTS.KT đã chốt | Xem danh sách "đã chấm" | Thấy kết quả của TTS.KT (chuỗi quản lý phía trên) nhưng không có nút chốt | 15.6 | TB |  |  |
| UAT-LRN-22 | Khoá sau khi chốt | API `PUT /learn/attempts/{id}/answers`, `finalize` | TTS.KT, KS.KT | Bài đã chốt | Sửa câu trả lời; chốt lại | 409 "Lượt làm đã chốt — không sửa được" | LRN-09 | Cao |  |  |
| UAT-LRN-23 | Phản hồi phiếu một lần | `/learn/attempts/:id` | TTS.KT, KS.KT | Bài đã chốt | 1. TTS.KT gửi phản hồi. 2. Gửi lần 2. 3. KS.KT trả lời. 4. TP.KD trả lời | 2: "Mỗi bài thi chỉ gửi phản hồi một lần". 3: OK. 4: "Chỉ người chấm trả lời phản hồi" | LRN-12 | TB |  |  |
| UAT-LRN-24 | Thiết kế lộ trình khi không có AI | `/learn/design` | KS.KT | Không `--ai` | Điền form 6 ô (đối tượng, mục tiêu, tháng, giờ/tuần, nhánh "nen.ky-thuat", thi cuối kỳ), chọn NV.KT, TTS.KT → Tạo | Nháp dựng bằng code, nhãn *Không có AI*; chỉ thẻ approved mà cả KS.KT + người học xem được; báo *thiếu tri thức* theo nhánh + bậc; điểm đạt 70 | LRN-04 | Cao |  |  |
| UAT-LRN-25 | [AI] AI thiết kế lộ trình theo prompt | `/learn/design` | KS.KT | `--ai` | Như UAT-LRN-24, sửa prompt tự do, Tạo → sửa → *Lưu nháp* → mở ở `/learn/paths` phát hành | Bản nháp tuần → bài → thẻ (có mã thẻ + phiên bản); Lưu nháp dựng bài học nháp; phát hành được như lộ trình tay | LRN-04, LRN-03 | Cao |  |  |
| UAT-LRN-26 | [Âm] Chọn người học ngoài cây khi thiết kế | API `POST /learn/paths/design` | KS.KT | — | Gửi `learners` có NV.KD | 400 "1 người học không ở trong cây dưới quyền của bạn" | LRN-04, 15.6 | TB |  |  |
| UAT-LRN-27 | [AI] AI sinh câu hỏi từ thẻ | `/learn/design` → *AI sinh câu hỏi* | KS.KT | `--ai` | Chọn thẻ SOP "Quy trình đọc lỗi…", n = 2 | 2 câu `draft`, `origin = ai`, gắn thẻ + phiên bản, kind theo loại thẻ (SOP → multi) | LRN-02 | TB |  |  |
| UAT-LRN-28 | Sinh câu hỏi khi không có AI / thẻ không hợp lệ | `/learn/design`, API | KS.KT | Không `--ai` | 1. Sinh câu từ thẻ approved. 2. Từ thẻ nháp | 1: 503 báo AI chưa sẵn sàng. 2: "Chỉ sinh câu hỏi từ thẻ đã duyệt" | LRN-02 | TB |  |  |
| UAT-LRN-29 | [AI] Duyệt thẻ bậc thực thi tự sinh câu nháp | `/wiki/review` | KS.KT (bước 1) + GD.GARAGE (bước 2) | `--ai`; thẻ nháp "[NHÁP] Quy trình kiểm tra hệ thống làm mát" gửi duyệt | Duyệt đủ 2 bước | Sau duyệt, ngân hàng câu hỏi có ≥ 2 câu nháp gắn thẻ này | LRN-02 (17.6) | TB |  |  |
| UAT-LRN-30 | Khoá mẫu + tự ghi danh | `/learn` khu *Khoá mở — tự ghi danh* | NV.KD | Khoá mẫu đã seed + phát hành (`seed_sample_course.py`, cần thẻ + câu đã duyệt) | Bấm ghi danh khoá mẫu, Bắt đầu | Việc mới nhãn *Khoá mẫu*, *tự ghi danh*; hạn = hôm nay + số tuần × 7; người chấm = người tạo khoá | 17.11 | TB |  |  |
| UAT-LRN-31 | Seed khoá mẫu dừng đúng bước | Dòng lệnh `backend/scripts/seed_sample_course.py --dry-run` / chạy thật | HR.LND (`--as hr.lnd@uat.test`) | DB UAT; thẻ khoá mẫu chưa duyệt | 1. `--dry-run`. 2. Chạy thật. 3. Chạy với `--as admin@uat.test` | 1: chỉ đọc, liệt kê 16 thẻ. 2: in link duyệt hàng loạt, mã thoát 2 (không tự duyệt). 3: báo thiếu quyền `learn.author` | 17.11 | Thấp |  |  |
| UAT-LRN-32 | MCP học tập | Claude qua MCP | NV.KT; KS.KT | Token | 1. NV.KT `my_assignments`. 2. KS.KT `design_path(prompt, learners)`. 3. KS.KT `generate_questions` | 1: danh sách theo tháng, `due_state`. 2: tạo nháp (không phát hành). 3: câu nháp (không AI → lỗi 503 dạng tool) | LRN-13 (phần đã có) | TB |  |  |
| UAT-LRN-33 | [Âm] Thẻ C3 không gửi AI | API `POST /learn/generate/questions` | KS.KT | Thẻ trong Kho KT đặt `classification = C3` (qua đề xuất `classify` đã duyệt, hoặc mongosh trên DB UAT) | Sinh câu hỏi từ thẻ đó | 403 "Thẻ mật C3 không gửi AI ngoài"; `/learn/design` không đưa thẻ C3 vào nháp | ORG-12 (phần Học tập) | TB |  |  |
| UAT-LRN-34 | [Âm] Bài C2 / C3 không giao cho người không xem được | `/learn/paths/:id` → Giao | HR.LND | Lộ trình có bài C2 ở Kho KT; OUTSIDER không ở Kho KT | Giao cho OUTSIDER | OUTSIDER bị bỏ qua kèm lý do; người học khác vẫn nhận | LRN-05, 15.7 quy tắc 4 | TB |  |  |
| UAT-LRN-35 | Học tập của tôi 3 tab | `/learn` | tts_kt | Có khoá được giao sắp hạn, khoá đã xong, khoá mở | 1. Xem tab *Đang học* 2. Học xong bài cuối 3. Tab *Tự ghi danh* → *Ghi danh* 4. Tải lại trang ở từng tab | 1: mỗi khoá ghi hạn bằng chữ ("còn N ngày", màu cam khi ≤ 3 ngày), thanh tiến độ, **một** nút chính; 2: nút chính đổi thành *Vào thi*; 3: thông báo, khoá sang *Đang học*; 4: giữ tab | LRN-05…07, 14 | Cao |  |  |
| UAT-LRN-36 | Thư viện: soạn bài có trang riêng, câu hỏi ở ngăn kéo | `/learn/library` | hr_lnd | Quyền soạn | 1. *+ Bài học mới* 2. *Phát hành* bài ở kho cá nhân 3. Tab *Ngân hàng câu hỏi* → lọc, dán link cho người khác 4. Sửa một câu hỏi; *Nhập nhiều câu* dán JSON có một câu sai 5. Học viên mở bài → *Luyện tập*, tải lại trang | 1: sang `/learn/lessons/new`; 2: hỏi lại, cảnh báo "chỉ mình tôi xem"; 3: lọc giữ trên URL; 4: câu hỏi mở ở ngăn kéo (`?q=`), nhập báo đúng số câu hợp lệ; 5: vẫn ở chế độ luyện tập (`?practice=1`) | LRN-01…04, 11 | Cao |  |  |
| UAT-LRN-37 | Lộ trình và Thiết kế lộ trình theo bước | `/learn/paths`, `/learn/design` | hr_lnd | Quyền soạn | 1. Lọc năm / tháng / trạng thái, dán link 2. *+ Lộ trình mới* → *Lộ trình trống* 3. Trang lộ trình: đổi tab bằng ← →, tải lại 4. *Thiết kế lộ trình (AI)*: đi qua 4 bước, quay lại bước đã xong, *Phát hành* | 1: đúng bộ lọc; 2: hộp tạo, xong vào trang sửa; 3: `h1` = tên lộ trình, giữ tab; 4: bước hiện tại được đánh dấu, bước xong ghi "đã xong", phát hành xong sang tab *Giao bài* [AI] | LRN-03, 04 | TB |  |  |
| UAT-LRN-38 | Chấm bài chia đôi | `/learn/grading` | tp_kt | ≥ 2 bài chờ chấm | 1. Mở ở màn rộng 2. Lọc theo *Đơn vị*, *Hạn*, dán link 3. Chấm bài đang mở → *Chốt điểm* 4. Màn hẹp | 1: bài đầu tự mở cột phải; 2: đúng bộ lọc; 3: hỏi lại, xong tự mở bài kế + thông báo; 4: khung chấm là ngăn kéo | LRN-08 | Cao |  |  |
| UAT-LRN-39 | Gắn và đổi khoá của bài học | API `POST /learn/lessons`, `PATCH /learn/lessons/{id}` | KS.KT | Cây có `nen.ky-thuat.lich`, `nen.garage` | 1. Tạo 2 bài `category = nen.ky-thuat.lich`. 2. Phát hành bài 1, PATCH `{category: "nen.garage"}`. 3. PATCH `{title, category}` bài 1. 4. PATCH `{category: "khong-co"}` | 1: `seq` 10, 20. 2: 200, bài 1 sang `nen.garage` xếp cuối, vẫn *đã phát hành*. 3: 409 (nội dung đã khoá). 4: 400 nêu nhánh lạ | LRN-15 | Cao |  |  |
| UAT-LRN-40 | Xoá nhánh cây kéo theo bài học | `/categories` (quản trị cây) hoặc API `DELETE /categories/{id}` | admin | Nhánh `nen.garage` có 2 bài; nhánh nhận đã có 1 bài | 1. Xoá không `move_to`. 2. Xoá với `move_to` | 1: 409 nêu "2 bài học". 2: 2 bài chuyển sang nhánh nhận, xếp sau bài sẵn có (`seq` 20, 30) | LRN-15 | TB |  |  |
| UAT-LRN-41 | Script chuyển dữ liệu khoá học | Dòng lệnh `backend/scripts/chuyen_khoa_hoc.py` | Người vận hành | DB UAT (`MONGO_DB=tiktok_to_text_uat`); bài học chưa có khoá | 1. Chạy không cờ. 2. `--apply`. 3. `--apply` lần hai. 4. `--undo` | 1: in DB, khoá → bài đánh số, *Chưa xếp khoá*, bài hoà; không ghi. 2: sao lưu vào `output/backup/khoa-hoc-…`, ghi `category` + `seq`, lộ trình `kind = weeks`. 3: không đổi gì. 4: gỡ trường script ghi, giữ bài đã sửa sau khi chuyển | LRN-15 | Cao |  |  |
| UAT-LRN-42 | Cây khoá và một khoá | API `GET /learn/courses`, `GET /learn/courses/{slug}`; MCP `list_courses`, `get_course` | KS.KT, TTS.KT | Nút `nen.ky-thuat.lich` có 2 bài đã phát hành + 1 bài nháp của KS.KT; nút cha `nen.ky-thuat` có 1 bài | 1. KS.KT xem cây. 2. TTS.KT xem cây, mở khoá. 3. Claude qua MCP `get_course` | 1: `nen.ky-thuat.lich` 3 bài, `nen.ky-thuat` 1 (không cộng nút con), `unassigned` = số bài chưa xếp của KS.KT. 2: 2 bài, đánh số 1, 2 (không thấy nháp). 3: không có đáp án, không có bài C3 | LRN-15 | Cao |  |  |
| UAT-LRN-43 | Sắp thứ tự mặc định của khoá | API `PUT /learn/courses/{slug}/order` | Chủ nhánh `nen` (gán ở cây lĩnh vực); KS.KT | UAT-LRN-42 | 1. KS.KT sắp. 2. Chủ nhánh gửi thiếu bài. 3. Chủ nhánh gửi đủ, đảo thứ tự | 1: 403. 2: 400 "đủ và đúng các bài". 3: 200, thứ tự mới; bài nháp chủ nhánh không thấy giữ chỗ cũ | LRN-15 | TB |  |  |
| UAT-LRN-44 | Thi khoá + điểm đạt bài | API `PUT /learn/courses/{slug}/settings` | HR.LND | Khoá có 1 bài đã phát hành, 1 câu đã duyệt | 1. Ma trận 5 câu. 2. Ma trận 1 câu, điểm đạt thi 80, điểm đạt bài 60 | 1: 400 "Ma trận đề dòng 1 … cần 5 câu". 2: 200; cây khoá `has_exam = true` | LRN-17 | TB |  |  |
| UAT-LRN-45 | Kiểm tra sau bài đạt / chưa đạt | `/learn/lessons/:id` → Luyện tập | TTS.KT | Bài có 2 câu trắc nghiệm đã duyệt, khoá chưa đặt điểm đạt (70) | 1. Làm đúng 1/2, nộp. 2. Làm lại đúng 2/2 | 1: `passed = false`. 2: `passed = true`; `GET /learn/courses/{slug}` → `my_result` điểm cao nhất 100, 2 lượt | LRN-17 | Cao |  |  |
| UAT-LRN-46 | Tạo và sửa lộ trình chuỗi khoá | `POST/PATCH /learn/paths` | KS.KT | Có hai khoá; bài đã phát hành thuộc từng khoá | 1. Tạo lộ trình 2 khoá. 2. Tạo rỗng, lặp khoá, chọn bài ngoài khoá, đặt `exam` ở cấp lộ trình hoặc `parent_path_id` | 1: 201, trả `kind=courses`. 2: 400 cho từng dữ liệu không hợp lệ; danh sách khoá cho phép chọn thứ tự riêng | LRN-16 | Cao |  |  |
| UAT-LRN-47 | Phát hành, giao chụp `plan`, mở bài theo thứ tự | `/learn/paths/{id}/publish`, `/assign`, `/learn/me`, `/learn/lessons/{id}` | KS.KT, NV.KT | Hai khoá, mỗi khoá có một bài đã phát hành; bài thứ hai cần kiểm tra | 1. Phát hành. 2. Giao. 3. Mở bài khoá sau hoặc bài sau khi chưa đạt bài trước. 4. Đạt bài trước rồi mở tiếp | 1: bài nháp không tự phát hành; khoá không có bài phát hành bị 400. 2: `assignments.plan` chụp bài theo thứ tự và hạn ngày nối tiếp. 3: 409 nêu bài/khoá cần hoàn thành. 4: mở được bài kế tiếp | LRN-16 | Cao |  |  |
| UAT-LRN-48 | Thi khoá và hoàn thành lộ trình | `POST /learn/courses/{slug}/exam/start`, `/learn/attempts/{id}/submit`, `GET /learn/me` | NV.KT, người giao | Lộ trình 2 khoá; khoá đầu có thi; câu đã duyệt thuộc bài khoá | 1. Thi trước khi hoàn thành bài. 2. Đạt bài, thi khoá. 3. Học khoá sau trước khi đạt thi khoá đầu. 4. Đạt thi và hoàn thành khoá bắt buộc cuối | 1: 409. 2: đề rút theo quyền thẻ người học, attempt gắn `assignment_id` + `course`. 3: 409. 4: `progress.courses` và trạng thái assignment cập nhật completed | LRN-17 | Cao |  |  |
| UAT-LRN-49 | Sao chép lộ trình thành nháp | `POST /learn/paths/{id}/copy` | KS.KT | Có lộ trình đã phát hành xem được | Sao chép, sửa và phát hành bản mới | 201, bản mới thuộc người gọi, là nháp độc lập, không kế thừa `parent_path_id`; bản gốc không đổi | LRN-16 | TB |  |  |
| UAT-LRN-50 | Đổi tên / gộp nhánh cập nhật lộ trình và tiến độ | `PATCH/DELETE /categories/{id}` | admin | Lộ trình và assignment có plan / progress theo slug; hai nhánh được gộp | 1. Đổi slug. 2. Xoá nhánh với `move_to` đã có trong lộ trình | 1: slug đổi trong lộ trình, snapshot và tiến độ. 2: lộ trình / plan chỉ còn một mục khoá nhận, danh sách bài hợp nhất, cài đặt thi đích được giữ | LRN-15, LRN-16 | Cao |  |  |
| UAT-LRN-51 | Thư viện khoá, builder chuỗi khoá và học theo thứ tự | `/learn/library`, `/learn/paths/{id}`, `/learn/me`, `/learn/paths` | KS.KT, NV.KT | Có khoá gồm bài đã phát hành và lộ trình chuỗi khoá được giao | 1. Mở tab Khoá học, chọn nhánh, sắp bài và thêm bài. 2. Mở tab Lộ trình, tạo lộ trình 2 khoá qua Stepper. 3. Mở lộ trình nháp, chỉnh ngày / thứ tự, phát hành và giao. 4. Vào Học tập của tôi, mở bài / thi và thử truy cập bài khoá sau. 5. Mở `/learn/paths` | 1: cây và thứ tự bài đúng, thao tác cập nhật thành công. 2: bản nháp có đúng thứ tự khoá. 3: lưu, phát hành, giao thành công. 4: nội dung hiện theo chuỗi, tác vụ bị khoá không mở trước điều kiện; bài thi mở khi đủ điều kiện. 5: 301 về `/learn/library?tab=paths` | LRN-15, LRN-16, LRN-17 | Cao |  |  |

| UAT-LRN-52 | Cây đào tạo và quyền liên khoa | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Tạo khoa / bộ môn / môn trong kho chia sẻ; người học khoa khác xem; thu hồi quyền kho; thử dùng cây tri thức làm parent | Đúng cây riêng; không tự sinh quyền theo chức danh; ngoài quyền bị chặn; không biến category thành khoa | LRN-18 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-53 | Tạo bài và tạo môn ngay | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Soạn tên / nội dung; tạo môn ngay bộ chọn; lưu từ kho bài rồi từ giáo trình; thử thiếu môn hoặc tên Bài 1 | Giữ bản soạn; bắt buộc môn; giáo trình điền môn / đối tượng và thêm bài; tên không chứa số thứ tự; năm 2027 hợp lệ | LRN-19,21,22 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-54 | Tái sử dụng bài và thứ tự độc lập | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Hai giáo trình dùng cùng bài theo thứ tự khác; đảo bài; sửa / xoá nội dung đã phát hành hoặc đang được dùng | Thứ tự độc lập; Bài n theo tổ hợp; khoá bản duyệt / phát hành; sửa bằng bản sao; xoá tham chiếu bị chặn | LRN-19,22 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-55 | Giáo án nhiều buổi và điều chỉnh lớp | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Giáo án từ giáo trình; một buổi nhiều bài, bài dùng nhiều buổi; giao lớp từ mẫu phát hành; sửa điều chỉnh lớp | Hoạt động / thời lượng / hai phía được lưu; chặn bài ngoài giáo trình; snapshot lớp và mẫu không ghi đè nhau | LRN-23 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-56 | Chương trình liên khoa và lộ trình cá nhân | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Chọn giáo trình hai khoa; lộ trình chọn một phần theo mục tiêu / năng lực; giao cho người trong phạm vi | Dùng tham chiếu không nhân bản môn; thứ tự giữ; ảnh chụp phát hành giữ lịch sử; ngoài quyền đọc hoặc quyền giao bị chặn | LRN-18,19,22 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-57 | Học liệu, xem trước thẻ, câu hỏi ngay | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Bài không thẻ có video / slide / podcast / talk show; thêm tệp, đổi thứ tự, phụ đề / chép lời; xem trước thẻ; tạo câu nháp ngay; thử phát hành câu chưa duyệt | Phát / mở nguồn thật theo quyền; không cần thẻ; giữ bản soạn; câu nháp cần duyệt; tệp nội bộ không mở trái quyền; màn 375px / bàn phím thao tác được | LRN-21,24 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-58 | Dự án VCS 2027 và SEO website X | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Tạo nhiệm vụ cá nhân / nhóm với đầu vào, sản phẩm, hạn, người hướng dẫn / chấm, rubric; nộp thiếu minh chứng rồi nộp đủ, chấm, làm lại | Thiếu đóng góp từng người bị chặn; chỉ người phân công và có quyền chấm được chốt; trọng số 100; lịch sử lượt chốt không sửa; nộp muộn ghi rõ | LRN-20 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-59 | Hoàn thành và thi cuối môn | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Mở học liệu; xác nhận đã học; làm kiểm tra; thử thi trước / sau đủ bài; nộp / chấm thi và dự án bắt buộc | Mở không tự hoàn thành; thiếu thực hành / dự án chưa đạt; thi giữ thời lượng / số lượt / pool đã chụp, không lộ đáp án; kết quả cũ giữ nguyên | LRN-20,22,24 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-60 | Công nhận tương đương bằng minh chứng | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Dùng kết quả thực học cùng bài ở lớp khác; thử tự công nhận / nối chuỗi; người có quyền ghi quyết định; dự án đích chưa đạt | Chặn tự công nhận, nối chuỗi và trùng quyết định; chỉ miễn học liệu / kiểm tra; thực hành / dự án đích vẫn bắt buộc | LRN-19,20 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |
| UAT-LRN-61 | Chuyển dữ liệu QA và quay lui | `/learn/library`, `/learn`, API | Quản lý / người duyệt / người học thử | Kho QA chia sẻ, cấu trúc riêng | Tạo bảng mapping category → môn có thật; chạy chuyen_mon_hoc.py dry-run, apply, apply lại, undo; thử DB thật | Chỉ bài nháp đủ mapping thay đổi; journal giữ trước / sau; idempotent; undo kiểm xung đột; bài phát hành / lịch sử không đổi; DB thật bị chặn | LRN-18,21 · TK-16 / SCR-16.2 | Cao | Chờ UAT người dùng | Kiểm tra tự động hỗ trợ, không thay nghiệm thu |

---

**Tổng:** 40 ca SYS, 14 ca ORG, 40 ca LRN (94 ca). Ca cần AI: UAT-SYS-29, UAT-LRN-16, 18, 25, 27, 29 → `start_uat.sh --ai`. Ca cần Claude Code CLI trên máy chủ: UAT-SYS-30, 31, 32, 35. Ca âm (người không có quyền bị chặn): UAT-SYS-09, 16, 17, 18, 21, 25, 33, 39; UAT-ORG-10, 12, 14; UAT-LRN-08, 19, 20, 22, 26, 33, 34.


**Kiểm chứng tự động v0.13 (01/10/2026):** E2E 2 kịch bản nghiệp vụ + 2 ca chuẩn bị đạt, gồm tạo phiên bản bài mới giữ nguyên bản gốc; màn 375px không tràn ngang, axe không lỗi critical/serious. Frontend lint toàn repo 0 lỗi (46 cảnh báo có sẵn ngoài phần sửa); lint phần học tập sửa không cảnh báo; build đạt, còn cảnh báo dung lượng bundle hiện hành. Nhóm kiểm tra cuối TK-16 / tổ chức / AI: 52 ca đạt; ca C3 đã chụp không gửi AI dù ngân hàng đổi mức mật và thu hồi quyền kho chặn tiến độ. Hồi quy toàn bộ học tập: 120/120 ca đạt (131 giây), gồm 13 ca TK-16; không có ca thất bại trong bản chốt. QA chuyển / quay lui bản ghi tạm đạt; không thực hiện chuyển dữ liệu thật. UAT-LRN-52…61 chờ người dùng, kiểm tra tự động không thay nghiệm thu.

**Truy vết bản triển khai:** LRN-18…24 → DESIGN TK-16 / SCR-16.2 Đã làm @39d56dc → UAT-LRN-52…61. Hồi quy 120 ca backend đạt; 4 ca E2E đạt (2 setup + 2 nghiệp vụ). Người dùng chưa ký nghiệm thu. Tại bàn giao ban đầu chưa merge / push, chưa chuyển dữ liệu thật. Chủ sản phẩm yêu cầu merge develop và push ngày 01/10/2026; việc này không thay nghiệm thu UAT hoặc cho phép chuyển dữ liệu thật.
**SYS-39 / SCR-22.2 — kiểm chứng 01/10/2026 @71e052a:** 95 kiểm thử backend đạt, 1 ca model thật bỏ qua trong lượt tự động; 6 ca Playwright đạt. Sau bổ sung phục hồi context / nhật ký tool: 38 backend đạt, 1 bỏ qua; 3 Playwright đạt. Frontend lint không lỗi (46 cảnh báo có sẵn), build đạt. UAT-SYS-56 thử riêng gemma3:12b thật đạt: câu hỏi video không dấu khi ở /learn đọc read_guide nap-tu-lieu và trả hướng dẫn kèm liên kết. UAT-SYS-57…58 đạt qua kiểm thử quyền kho riêng (cả admin), token thu hồi, chặn ghi / ctx giả, schema, giới hạn vòng / context, huỷ HTTP và SSE tool lưu qua tải lại.
