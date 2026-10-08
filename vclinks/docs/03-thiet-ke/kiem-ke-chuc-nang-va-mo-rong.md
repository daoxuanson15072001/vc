# Kiểm kê chức năng VClinks và đánh giá khả năng mở rộng

Phiên bản 0.1 · 06/10/2026 · Trạng thái: Nháp

## Tóm tắt

- **Tài liệu nói gì:** liệt kê toàn bộ phần của VClinks trên nhánh `feat/giao-dien-moi` (bản chạy trên máy 129 ngày 06/10/2026). Gồm: tài khoản, phân quyền, kênh, hộp thư, gửi tin, khách hàng, báo giá, phiếu CSKH, báo cáo, AI, quản trị. Với mỗi phần, tài liệu ghi rõ cấu hình nằm ở đâu: người dùng tự đổi trên giao diện, biến môi trường, sửa tay trong cơ sở dữ liệu, hay phải sửa code.
- **Số đếm từ code:** 10 vai trò, 164 khóa quyền, 13 mã phạm vi dữ liệu, 255 đường API có khai báo quyền, 4 kênh chạy được (2 kênh nữa "Sắp có"), 14 loại lệnh gửi, 11 loại nội dung tin.
- **Kết luận chính:** luồng nghiệp vụ chạy thật và chặt (quyền theo cây tổ chức, duyệt trước khi gửi, nhật ký). Nhưng **hầu hết "luật chơi" còn nằm trong code**:
  - Ma trận của 10 vai trò hệ thống cố định trong code. Từ 06/10/2026 Admin tạo được **vai trò tùy chỉnh** trên giao diện (sao chép vai trò hệ thống rồi bớt quyền).
  - SLA và giờ làm việc chỉ sửa tay trong DB.
  - Playbook AI là file trên máy chủ.
  - Mẫu tin báo giá, loại phiếu, kết quả hội thoại là danh mục cố định.
- **Phần người dùng tự cấu hình được trên giao diện:** cây tổ chức, người dùng và vai trò, vai trò tùy chỉnh, SLA và giờ làm việc theo division, gán kênh, quyền tạm thời, quy tắc cảnh báo, hàng việc CSKH, mẫu câu nhanh, kết nối OA/Fanpage, nick máy Zalo, token và thiết bị.
- **Dữ liệu ngoài vẫn là mô phỏng:** VCsale (khách, công nợ, báo giá, PDF, giá) và VCwiki đều là mock. Nháp AI trên máy 129 đang lỗi cấu hình khóa (mục 9).
- **Đánh giá mở rộng (mục 8):** nền tảng dữ liệu và kênh mở rộng tốt (đa tenant ở tầng dữ liệu, thêm kênh API theo một khuôn). Độ "động" cho người dùng ở mức trung bình thấp. Có 8 đề xuất xếp theo ưu tiên ở mục 8.3.
- **Việc còn mở:** chủ dự án / dev002 chọn thứ tự làm các đề xuất ở mục 8.3; VCsale và VCwiki thật vẫn chờ endpoint (CLAUDE.md §14).
- **Người duyệt xem kỹ:** mục 7 (bảng cấu hình) và mục 8 (đánh giá, đề xuất).

## Mục lục

- [1. Bản đồ màn hình](#1-bản-đồ-màn-hình)
- [2. Tài khoản và đăng nhập](#2-tài-khoản-và-đăng-nhập)
- [3. Tổ chức, vai trò và phân quyền](#3-tổ-chức-vai-trò-và-phân-quyền)
- [4. Kênh và nhận tin](#4-kênh-và-nhận-tin)
- [5. Hộp thư và gửi tin](#5-hộp-thư-và-gửi-tin)
- [6. Khách hàng, báo giá, phiếu, báo cáo, AI](#6-khách-hàng-báo-giá-phiếu-báo-cáo-ai)
- [7. Cấu hình nằm ở đâu](#7-cấu-hình-nằm-ở-đâu)
- [8. Đánh giá khả năng mở rộng](#8-đánh-giá-khả-năng-mở-rộng)
- [9. Lỗi và chỗ thiếu thấy khi kiểm](#9-lỗi-và-chỗ-thiếu-thấy-khi-kiểm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Bản đồ màn hình

Thanh menu bên trái chỉ hiện những mục người dùng có quyền (`apps/web/src/utils/nav.ts`).

| Menu | Đường dẫn | Chức năng chính | Trạng thái |
|---|---|---|---|
| Nick | (nút trên cùng) | Chọn nick đang xem, chấm sức khỏe nick | Chạy |
| Hộp thư | `/conversations` | 4 tab Cần trả lời / Chờ khách / Đã xong / Tất cả. Soạn và gửi tin, công cụ Zalo, Xong / Mở lại, ngăn thông tin khách | Chạy |
| Lệnh gửi | `/outbox` | Lệnh của tôi: thử lại, gửi ngay, bỏ, duyệt lại | Chạy |
| Chờ duyệt | `/approvals` | Phiếu CSKH chờ NVKD duyệt | Chạy |
| Phiếu | `/workitems` | Hàng việc CSKH Bán hàng / Hậu mãi, cấu hình hàng việc | Chạy |
| Báo cáo | `/reports` | Tổng quan, Hiệu suất (lượt chờ, FRT, % quá SLA), xuất Excel | Chạy, số liệu tính sau 01:00 mỗi ngày |
| Khách | `/customers`, `/customers/:id` | Danh sách khách, hồ sơ 360 | Chạy; tab Hóa đơn và Việc cần làm còn trống |
| Mã KH | `/customers/erp-matching` | Đối chiếu khách với mã KH VCsale | Chạy trên dữ liệu **mô phỏng** |
| Danh bạ | `/contacts`, `/contacts/requests` | Liên hệ Zalo, lời mời kết bạn | Chạy (chỉ đọc vai trò liên hệ) |
| Kênh | `/channels`, `/channels/map` | Thẻ 6 kênh, máy Zalo (quét QR), OA, Fanpage, FB cá nhân, Bản đồ kênh | Chạy; WhatsApp và Email "Sắp có" |
| Đồng bộ | `/sync` | Thẻ đồng bộ từng nick, drift, bảng ánh xạ trường | Chạy |
| Quản trị | `/admin/*` | Việc cần làm; Tổ chức và người dùng; Vai trò và quyền; Kênh và thiết bị; Nhật ký và cảnh báo | Chạy |
| Cá nhân | `/me`, `/settings/tokens`, `/settings/activity`, `/notifications` | Hồ sơ, token MCP của tôi, hoạt động 30 ngày, thông báo | Chạy |

## 2. Tài khoản và đăng nhập

| Chức năng | Code chính | Cấu hình ở đâu | Ghi chú |
|---|---|---|---|
| Đăng nhập Google (SSO) | `apps/api/src/auth/auth.service.ts`, `google.client.ts` | ENV `GOOGLE_CLIENT_ID/SECRET`, `AUTH_BASE_URL`, `AUTH_WEB_URL`. Tên miền viết cứng `vcprosperous.com` | Từ 06/10/2026: mọi tài khoản Workspace công ty vào được, lần đầu tự tạo người dùng chưa có vai trò (`AUTH_SELF_SIGNUP`, mặc định bật) |
| Đăng nhập bằng token nội bộ | `LoginPage.tsx` | ENV `AUTH_TOKEN_LOGIN` | Token không gắn người dùng chỉ có toàn quyền khi `AUTHZ_LEGACY_TOKENS=1` |
| Phiên đăng nhập | `auth/session.service.ts` | CODE: hết sau 12 giờ không dùng | Không có màn xem / thu hồi phiên. **Nút Thoát không gọi `POST /api/auth/logout`** nên phiên trên máy chủ còn sống tới 12 giờ |
| Token thiết bị, MCP, đồng bộ, tác tử gửi | `auth/token.service.ts`, `tokens/` | UI: Admin ở "Token & thiết bị", người dùng ở "Token MCP của tôi". Hạn 30/60/90 ngày, tối đa 3 token/người: CODE | Danh sách người được tự tạo token MCP chỉ có API (`PUT /api/admin/token-settings`), chưa có màn hình |
| Ghép thiết bị bằng mã 6 số | `TokensTab.tsx` | UI | Có "Thay máy cũ" |

## 3. Tổ chức, vai trò và phân quyền

| Chức năng | Code chính | Cấu hình ở đâu | Ghi chú |
|---|---|---|---|
| Cây tổ chức: thêm, đổi tên, chuyển cha, ngừng, khôi phục, nhập CSV/XLSX | `apps/api/src/org/org.service.ts`, `OrgTreeTab.tsx` | **UI** | 8 loại đơn vị và luật cha–con, đơn vị gốc "Tập đoàn VC Phồn Vinh": CODE |
| Người dùng: thêm, sửa, khóa, mở khóa, sắp nghỉ, nghỉ việc và bàn giao 4 bước, nhập từ file | `org/people.service.ts`, `UsersTab.tsx`, `OffboardPage.tsx` | **UI** | Đổi đơn vị / hẹn đổi đơn vị chỉ có API. Lọc "Chưa có vai trò" (06/10/2026) |
| Gán vai trò tại đơn vị (có trưởng nhóm, từ / đến) | `people.service.ts` | **UI** (chưa có ô ngày từ / đến) | Vai trò nào đặt ở loại đơn vị nào: CODE |
| 10 vai trò, ma trận 164 khóa quyền | `packages/shared/src/org.ts`, `permissions.ts` | **CODE**, sinh từ đặc tả `01-phan-quyen.md` bằng `tools/authz/gen-permissions.js` | Vai trò hệ thống không sửa được (PQ-06) |
| Vai trò tùy chỉnh | `custom_roles`, `packages/shared/src/custom-roles.ts`, `org/custom-roles.*`, `CustomRoleDrawer.tsx` | **UI** từ 06/10/2026 (Quản trị → Vai trò & quyền → "Sao chép thành vai trò mới", khóa `role.edit`) | Chỉ bớt hoặc thu hẹp phạm vi so với vai trò gốc; gán, nhập file (`vai_tro` = mã `tc_…`), đổi đơn vị đều giữ vai trò tùy chỉnh |
| 13 mã phạm vi dữ liệu (TĐ, DV, TỔ, NH, CT, Của tôi, NICK, KÊNH, TK, LEAD, TUYẾN, YC, ALL) | `authz/engine.ts` | CODE | Admin chỉ chỉnh dữ liệu đầu vào: cây đơn vị, vai trò, gán kênh, quyền tạm thời. 27 ô có điều kiện đang bị bỏ qua |
| Kiểm quyền từng đường API | `authz/route-permissions.ts` (255 đường) | CODE | Đường mới thiếu khai báo thì bị chặn (an toàn mặc định) |
| Duyệt người thứ hai khi gán vai trò nhạy cảm | `people.service.ts`, `RequestsTab.tsx` | UI duyệt; luật duyệt CODE; "người duyệt tập đoàn" chỉ đặt bằng DB | |
| Quyền tạm thời: xin / duyệt / thu hồi, trực thay, đăng ký vắng | `authz/grants.service.ts`, `AccessRequestsTab.tsx` | **UI**; thời hạn (4 giờ, 1/3/7 ngày, trực thay ≤ 30 ngày): CODE | |
| Che số điện thoại, nút "Hiện" có ghi nhật ký | `authz/phone-mask.interceptor.ts` | CODE theo ô `cust.phone_full` | |
| Quyền hiệu lực ("vì sao thấy / không thấy") | `authz/effective-rights.ts` | **UI** | |
| Nhật ký truy cập, xuất XLSX, cảnh báo R1–R11 | `audit/` | **UI**: bật/tắt quy tắc, ngưỡng, người nhận. Bộ quy tắc và "ngoài giờ" (22h–6h, Chủ nhật): CODE | Cảnh báo chỉ trong app, chưa có email |
| Đa tenant | `db/tenant-collection.ts`, `tenant-context.ts` | ENV `DEFAULT_TENANT_ID` | Tầng dữ liệu sẵn sàng; đăng nhập luôn vào tenant mặc định, chưa có màn quản lý tenant |

## 4. Kênh và nhận tin

| Chức năng | Code chính | Cấu hình ở đâu | Ghi chú |
|---|---|---|---|
| Zalo cá nhân qua máy Zalo (quét QR, chế độ Zalo Web hoặc trực tiếp zca-js) | `apps/api/src/zalo-farm/`, `tools/chrome-driver/farm-*.js` | **UI**: tạo, quét QR, ngắt, chuyển trực tiếp / quay về, "Lấy nội dung tin chưa đọc". ENV phía máy chủ | Tối đa 4 nick trên máy 129. Chế độ trực tiếp đang thử nghiệm (theo dõi tới 08/10/2026 10:16) |
| Zalo cá nhân qua tiện ích Chrome | `apps/extension/` | Popup tiện ích | Từ 06/10/2026 chỉ dùng để đồng bộ dữ liệu cũ |
| Zalo OA, Fanpage (OAuth, webhook có kiểm chữ ký) | `apps/api/src/channels/` | **UI** kết nối / ngắt; ENV app id và secret | Máy 129 chưa có ENV nên chưa kết nối được. Chỉ gửi chữ |
| Facebook cá nhân qua tiện ích trên messenger.com | `apps/extension/src/messenger/` | Popup tiện ích | Chỉ gửi chữ |
| Thêm kênh API mới | `channels/channel-sender.ts` | CODE theo khuôn `ChannelSender` | Thêm kênh còn phải sửa khoảng 10 chỗ riêng cho Zalo (mục 8.2) |
| Gán kênh: người giữ nick, gửi, xem, lead | `channel-access/`, `ChannelAccessTab.tsx` | **UI** | 4 mức cố định |
| Bảng ánh xạ trường, drift | `apps/api/src/mapping/` | Claude đề xuất qua MCP, người duyệt trên UI | |
| Realtime (SSE): tin mới, trạng thái, đang soạn | `apps/api/src/realtime/` | ENV chu kỳ | |
| File đính kèm | `apps/api/src/attachments/`, GridFS | ENV `ATTACHMENT_*` | **Chưa dùng MinIO** dù CLAUDE.md ghi MinIO; file nằm trong MongoDB GridFS |
| Ghi âm thành chữ (ASR) | `workers/asr/` | ENV `ASR_*` | Chạy thật trên máy 129 |

## 5. Hộp thư và gửi tin

| Chức năng | Code chính | Cấu hình ở đâu | Ghi chú |
|---|---|---|---|
| 4 tab, 3 phạm vi (Của tôi / Chưa phân công / Tất cả) | `ConversationList.tsx`, `packages/shared/src/inbox.ts` | CODE | |
| Xong / Mở lại, 5 kết quả (Hỏi giá, Đặt hàng, Khiếu nại, Không cần, Khác) | `DoneControl.tsx` | UI dùng; danh sách kết quả CODE | Khách nhắn mới thì tự mở lại |
| SLA trả lời 15 phút, cảnh báo ở 25%, lịch T2–T6 và sáng T7 | `inbox.ts`, `conversations/inbox-state.ts`, `sla-settings.*` | **UI** từ 06/10/2026: Quản trị → Cài đặt → SLA và giờ làm việc (GĐ bán hàng sửa division mình, Admin xem) | Có ngày lễ; cài đặt chung (`default`) vẫn chỉ sửa trong DB |
| Nhận / giao / chuyển / trả về hội thoại, ghi chú nội bộ (@nhắc), nhãn riêng của VClinks | `conversations/conversation-work.*`, `HandlerControl.tsx`, `InternalNotes.tsx`, `LabelsControl.tsx` | **UI** từ 06/10/2026 (quyền theo ma trận: `conv.claim`, `conv.assign`, `conv.transfer`, `conv.note`, `conv.label`) | Nhận / giao / chuyển chỉ cho kênh không có người giữ nick (OA, Fanpage); nick cá nhân do người giữ nick xử lý (02 DK-21). Nhãn: danh sách chung, ai có `conv.label` tạo được, tối đa 5 / hội thoại, quản lý (`conv.assign`) đổi tên / xóa (đặc tả chưa có, đây là mặc định) |
| Mẫu câu nhanh, 2 loại (câu, số tài khoản), biến `{ten_khach}`, `{ten_nv}` | `apps/api/src/quick-replies/`, `QuickRepliesModal.tsx` | **UI**: thêm / sửa / xóa | Một danh sách chung cả công ty, chưa có mẫu cá nhân / theo nhóm |
| Công cụ soạn: sticker Zalo (nick trực tiếp tìm được kho sticker Zalo), ảnh, file, danh thiếp, bình chọn, @nhắc tên, báo giá, số tài khoản, trả lời trích dẫn | `ComposerTools.tsx` | CODE | Chỉ cho Zalo cá nhân |
| Thả cảm xúc từ Dashboard | `ChatPane.tsx` (`REACTIONS_FROM_DASHBOARD = false`) | CODE (cờ đang tắt) | Máy Zalo trực tiếp đã làm được, chỉ cần bật cờ |
| Lệnh gửi: 14 loại, 8 trạng thái, hết hạn 30 phút | `packages/shared/src/outbox.ts`, `apps/api/src/outbox/` | CODE | Bấm Gửi chính là duyệt (`approvedBy`, `approvedAt`). Trả lời thay người khác phải xác nhận thêm |
| Nhịp gửi mỗi nick (mặc định 1,5 giây giữa 2 lệnh, tối đa 20 lệnh/phút) | `outbox/outbox-pace.ts` | ENV + API `PATCH /accounts/:uid` | **Chưa có màn hình** |
| Tìm kiếm toàn cục | `apps/api/src/search/` | CODE | |

## 6. Khách hàng, báo giá, phiếu, báo cáo, AI

| Chức năng | Code chính | Trạng thái | Cấu hình ở đâu |
|---|---|---|---|
| Hồ sơ khách tự tạo từ chat 1-1, tự gộp, hoàn tác 30 ngày | `apps/api/src/customers/` | Chạy | Luật gộp CODE |
| Gắn tay hội thoại vào khách, tách hồ sơ, gắn nhóm vào khách | — | **Chưa làm** | — |
| Liên kết tay mã KH VCsale (tìm theo mã, tên, SĐT, MST) | `ErpLinkModal.tsx`, `GET /api/customers/erp-search` | Chạy từ 06/10/2026 (dữ liệu VCsale vẫn mô phỏng) | Người xác nhận: sale admin, Admin |
| Đổi người phụ trách khách trên UI | — | **Chưa làm** (chỉ qua bàn giao khi nghỉ việc) | — |
| Đối chiếu mã KH VCsale | `ErpMatchingPage.tsx` | Chạy trên **mock**; nạp danh mục chỉ có API | ENV `VCSALE_MODE` |
| Gửi báo giá trong chat (kiểm hạn, phiên bản, qua lệnh gửi) | `apps/api/src/quotes/`, `SendQuoteModal.tsx` | Luồng chạy; dữ liệu báo giá và PDF là **mock**. Cần khách đã liên kết mã KH | Mẫu lời nhắn báo giá CODE. Nhắc theo dõi báo giá chưa làm |
| Công nợ, chip "Nợ quá hạn", tra hàng theo hạng khách | `quotes/debt-flags.service.ts`, `catalog/` | **Mock** | ENV |
| Phiếu CSKH (báo giá / hậu mãi): CSKH soạn → NVKD duyệt → gửi | `apps/api/src/workitems/` | Chạy | Hàng việc: **UI** (phải gõ mã người dùng). Loại phiếu, lý do, ngưỡng: CODE và ENV |
| Báo cáo: lượt chờ, FRT, % quá SLA, % trả lời qua VClinks; xuất XLSX | `apps/api/src/reports/`, `metrics/` | Chạy, tính sau 01:00 | Giới hạn 120 ngày / 500 lượt: CODE |
| Thông báo trong app | `apps/api/src/notifications/` | Chạy, giữ 50 tin | Chưa có email / push |
| Nháp AI (30 tin gần nhất, VCwiki, VCsale) | `apps/api/src/suggest/` | Khung chạy; VCwiki và tra giá OE là **mock**. Máy 129 đang lỗi khóa (mục 9) | ENV `SUGGEST_*`, `ANTHROPIC_API_KEY`; playbook là FILE `config/playbook.yaml`, sửa xong phải khởi động lại API |
| Vai trò liên hệ (khách hàng, đại lý, NCC…) để AI chọn giọng | `packages/shared/src/schemas.ts` | **Không có đường ghi** (không API, không UI) | Nên playbook theo vai trò gần như không có tác dụng |

## 7. Cấu hình nằm ở đâu

| Mức | Những gì |
|---|---|
| **Người dùng / Admin tự đổi trên giao diện** | Cây tổ chức; người dùng, vai trò, trưởng nhóm; vai trò tùy chỉnh (bớt quyền của vai trò hệ thống); yêu cầu đổi vai trò; quyền tạm thời, trực thay; gán kênh, người giữ nick; token, thiết bị; quy tắc cảnh báo; hàng việc CSKH; mẫu câu nhanh; kết nối OA / Fanpage; nick máy Zalo (quét QR, chuyển chế độ, lấy nội dung tin chưa đọc); tên nick; giao diện sáng / tối |
| **Chỉ có API, chưa có màn** | Nhịp gửi mỗi nick; danh sách người được tự tạo token MCP; đổi / hẹn đổi đơn vị; duyệt đề xuất gộp khách; nạp danh mục VCsale; xóa dữ liệu khách theo NĐ 13; CSV KPI |
| **Chỉ sửa tay trong DB** | SLA chung của cả công ty (`sla_settings` `default`; SLA từng division sửa trên UI từ 06/10/2026); người duyệt tập đoàn (`security_settings.groupApprover`); vai trò liên hệ |
| **File trên máy chủ** | Playbook AI (`config/playbook.yaml`) |
| **Biến môi trường** (khoảng 90 biến) | Khóa và secret; chế độ mock / live (`VCSALE_MODE`, `SUGGEST_MODE`, `ASR_MODE`); bật / tắt job (`*_JOBS`); ngưỡng phiếu CSKH; nhịp gửi mặc định; tự đăng ký (`AUTH_SELF_SIGNUP`) |
| **Phải sửa code** | 10 vai trò hệ thống và ma trận của chúng; ý nghĩa phạm vi dữ liệu; loại đơn vị; tên miền công ty; tab hộp thư và kết quả hội thoại; loại lệnh gửi và loại tin; loại phiếu và hàng việc; mẫu lời nhắn báo giá; bộ quy tắc cảnh báo; giờ chạy các job; giới hạn báo cáo; chữ giao diện (chưa có lớp dịch) |

## 8. Đánh giá khả năng mở rộng

### 8.1 Chấm theo mảng

Thang 1–5: 5 là mở rộng dễ hoặc người dùng tự cấu hình được.

| Mảng | Mở rộng kỹ thuật | Người dùng tự cấu hình | Nhận xét |
|---|---|---|---|
| Dữ liệu, đa tenant | 4 | 1 | `tenant_id` trên mọi bản ghi, job chạy theo từng tenant. Thiếu: chọn tenant khi đăng nhập, màn tạo tenant, tên miền theo tenant |
| Phân quyền | 4 | 3 | Engine đọc hàng quyền theo từng lần gán vai trò (`rowOf`), an toàn mặc định ở từng đường API. Vai trò tùy chỉnh lưu DB, luôn hẹp hơn hoặc bằng vai trò gốc. 10 vai trò hệ thống vẫn cố định |
| Kênh | 4 | 3 | Kênh API mới theo khuôn `ChannelSender`. Kênh cá nhân mới tốn công (tiện ích hoặc máy Zalo). Khoảng 10 chỗ viết riêng cho Zalo |
| Hộp thư, gửi tin | 3 | 3 | Lệnh gửi có máy trạng thái rõ. Danh mục (tab, kết quả, loại lệnh) cố định. Từ 06/10/2026: màn SLA theo division; nhận / giao / chuyển hội thoại, ghi chú nội bộ, nhãn |
| Khách, báo giá | 3 | 1 | Lớp `vcsale-client` tách sẵn, thay mock bằng API thật là đủ. Mẫu báo giá, luật gộp, người phụ trách chưa cấu hình được |
| Phiếu CSKH | 3 | 3 | Hàng việc cấu hình trên UI; loại phiếu và ngưỡng cố định |
| AI | 3 | 1 | Playbook là file; vai trò liên hệ không ghi được; lọc rủi ro là regex cố định |
| Quản trị, kiểm soát | 4 | 4 | Cảnh báo, quyền tạm thời, gán kênh, token đều tự làm trên UI |

**Tổng:** về kỹ thuật mở rộng tốt, khoảng 3,5/5: code tách lớp, có `packages/shared` dùng chung, test dày (lúc kiểm kê: API e2e 427 ca, unit 1.759, web 135, máy Zalo 47). Về độ "động" cho người dùng còn thấp, khoảng 2,4/5 (trước đề xuất 2–4 là 2,1/5): phần lớn luật nghiệp vụ là hằng số trong code, đổi phải có dev và triển khai lại.

### 8.2 Chỗ viết cứng cản mở rộng nhiều nhất

1. Vai trò hệ thống và ma trận quyền: `packages/shared/src/org.ts:56`, `permissions.ts:539` (sinh từ đặc tả). Vai trò tùy chỉnh đã làm (đề xuất 4); thêm vai trò hệ thống mới vẫn phải sửa đặc tả và code.
2. Tên miền công ty và tenant: `auth.service.ts:11,101`, `org.ts:9`, `customers.ts:148`, `UsersTab.tsx:262`, `LoginPage.tsx:13`.
3. SLA và giờ làm việc: `packages/shared/src/inbox.ts:89-96`. `sla_settings` không có đường ghi.
4. Thêm kênh: `channels.ts:11,29`, `ChannelBadge.tsx`, `Composer.tsx:77`, `ChannelsPage.tsx:32`, và các chỗ chỉ cho `zalo` (`outbox.service.ts:111,259`, `ChatPane.tsx:46,662`).
5. Loại lệnh và loại tin: `outbox.ts:171,305-372`, `schemas.ts:316`, `MessageBubble.tsx:16`, kèm bộ thực hiện lệnh trong tiện ích và `farm-direct.js`.
6. Báo giá: mẫu lời nhắn `quote.ts:154`, mốc theo dõi `quote.ts:75`, nhắc theo dõi chưa có job.
7. AI: playbook đọc một lần khi khởi động (`suggest/playbook.ts:56`); vai trò liên hệ không ghi được (`schemas.ts:19`).
8. Giờ chạy các job theo +07:00 viết cứng: 18:00 tóm tắt quyền tạm thời, 8:30 nhắc bàn giao, 01:00 KPI.

### 8.3 Đề xuất, xếp theo ưu tiên

| # | Việc | Lợi ích | Ước lượng |
|---|---|---|---|
| 1 | **Đã làm 06/10/2026.** Sửa nút Thoát gọi `POST /api/auth/logout`; thêm màn "Phiên đăng nhập của tôi" | Bảo mật: phiên không còn sống 12 giờ sau khi thoát | 2–3 giờ |
| 2 | **Đã làm 06/10/2026** (Quản trị → Cài đặt → SLA và giờ làm việc). Màn **Cài đặt SLA và giờ làm việc** theo division (ghi `sla_settings`, có ngày lễ) | Báo cáo FRT và % quá SLA đúng thực tế; khóa `config.sla` đã có | 6–8 giờ |
| 3 | **Đã làm 06/10/2026** (bản đầu, xem dưới bảng). **Nhận / giao / chuyển hội thoại, ghi chú nội bộ, nhãn VClinks** | Đúng nghiệp vụ chia việc; khóa quyền đã có trong ma trận | 16–24 giờ |
| 4 | **Đã làm 06/10/2026** (Quản trị → Vai trò & quyền, xem dưới bảng). **Vai trò tùy chỉnh**: lưu trong DB, sao chép vai trò hệ thống rồi bớt quyền (đúng PQ-06) | Admin tự điều chỉnh quyền không cần dev | 24–32 giờ |
| 5 | Màn nhịp gửi theo nick, danh sách tự tạo token MCP, đổi đơn vị có hẹn giờ (đã có API) | Bớt việc phải gọi API tay | 6–8 giờ |
| 6 | Mẫu câu theo phạm vi (cá nhân / nhóm / công ty) và thêm biến; mẫu lời nhắn báo giá sửa được | Sale tự quản lý câu chữ | 8–12 giờ |
| 7 | Playbook AI và vai trò liên hệ sửa trên UI (lưu DB, không cần khởi động lại) | AI soạn đúng giọng theo loại khách | 12–16 giờ |
| 8 | Tên miền và tenant cấu hình được (danh sách domain theo tenant, chọn tenant khi đăng nhập) | Bán / dùng cho công ty khác trong tập đoàn | 16–24 giờ |

Đề xuất 3 (bản đầu, 06/10/2026) theo đặc tả 00 MH-UI-08 / MH-UI-10, 01 §3.1:
- **Nhận:** người bấm trước được; người sau thấy "Hội thoại {tên} vừa được {người} nhận."
- **Phân công / Chuyển:** chỉ giao cho người xem được hội thoại; chuyển bắt buộc lý do ≥ 10 ký tự; người nhận có thông báo.
- **Trả về Chưa phân công.** Mỗi thao tác có dòng sự kiện trong khung chat và một dòng nhật ký.
- **Ghi chú nội bộ:** khung riêng (Alt+G, Ctrl+Enter lưu), khối vàng trong khung chat; @nhắc chỉ người xem được hội thoại, có thông báo (không chép nội dung ghi chú vào thông báo). Tác giả sửa / xóa trong 15 phút. Gửi tin cho khách mà có "@tên đồng nghiệp" thì hỏi "Chuyển thành ghi chú?".
- **Chưa làm:** "Đã xem" của ghi chú, chọn nhiều để giao ("Giao cho…", đặc tả chưa có), tự nhận theo division (QĐ-43), Admin xóa ghi chú cũ.

Đề xuất 4 (06/10/2026) theo đặc tả 01 PQ-06, PQ-42, MH-PQ-05:
- **Tạo:** Admin (`role.edit`) bấm "Sao chép thành vai trò mới", chọn vai trò gốc, đặt tên (2–60 ký tự, không trùng, mặc định "<vai trò gốc> (tùy chỉnh)"), rồi bớt từng quyền. Mỗi ô chỉ chọn phạm vi bằng hoặc hẹp hơn gốc (TĐ ⊃ DV ⊃ TỔ ⊃ CT, NH ⊃ CT); ô rộng hơn bị khóa, ghi "Vượt quyền của vai trò gốc <tên>.". API cũng chặn (400).
- **Lưu:** chỉ lưu những ô khác gốc; hàng quyền dựng lại từ ma trận hệ thống mỗi lần đọc, nên vai trò tùy chỉnh không bao giờ rộng hơn gốc, kể cả khi ma trận gốc đổi sau này.
- **Gán:** ô Vai trò ở chi tiết người dùng có nhóm "Vai trò tùy chỉnh"; đặt ở cùng loại đơn vị với vai trò gốc. Bản sao của Admin, Ban giám đốc / Kiểm soát, GĐ bán hàng cần người thứ hai duyệt (PQ-42). Đổi đơn vị và nhập file giữ nguyên vai trò tùy chỉnh. Bộ lọc người dùng lọc được theo vai trò tùy chỉnh.
- **Sửa / xóa:** không đổi vai trò gốc sau khi tạo; sửa xong áp dụng cho người đang giữ trong vòng 1 phút ("Đã lưu vai trò <tên>. Áp dụng cho <n> người."); không ai sửa được vai trò mình đang giữ (NT6); không xóa được khi còn người giữ hoặc còn yêu cầu chờ duyệt ("Còn <n> người đang có vai trò này."). Mọi thao tác ghi nhật ký `role.create` / `role.update` / `role.delete` và báo Ban giám đốc / Kiểm soát.
- **SĐT đầy đủ:** chỉ bớt được phần bấm "Hiện"; phần luôn hiện theo quan hệ với khách (owner, người giữ nick) giữ nguyên (PQ-45).
- **Chưa làm:** "Xuất ma trận" ra Excel (MH-PQ-05, tùy chọn).

VCsale và VCwiki thật không nằm trong bảng: chỉ cần thay lớp mock khi có endpoint (CLAUDE.md §14).

## 9. Lỗi và chỗ thiếu thấy khi kiểm

Chi tiết từng ca và cách tái hiện: `docs/05-kiem-thu/uat/2026-10-06/bo-test-toan-he-thong.md` mục 4. Cập nhật 06/10/2026 16:31: các lỗi dưới đây đã sửa, trừ Nháp AI còn chờ điền mã workspace; lỗi màn hẹp không có thật.

- **Nháp AI lỗi trên máy 129:** Claude API trả 400 "API key không gắn workspace". Cần khóa gắn workspace, hoặc thêm header `anthropic-workspace-id`.
- **Nút Thoát không kết thúc phiên trên máy chủ.**
- **Chữ hướng dẫn sai với nick trực tiếp:** nút gửi ghi "gửi qua tiện ích… tab Zalo Web", hộp danh thiếp ghi "Tiện ích sẽ tìm tên này".
- **Thả cảm xúc đang tắt** dù máy Zalo trực tiếp làm được.
- **Gửi báo giá chưa thử được:** khách chưa có mã KH, danh mục VCsale mô phỏng chưa nạp lại sau khi xóa dữ liệu ngày 06/10/2026.
- **Màn hẹp (dưới khoảng 1.100 px) không hiện ngăn thông tin khách** dù nút đã sáng.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 07/10/2026 11:22 | Claude Code (dev002) | Tạo bản kiểm kê: bản đồ màn hình, tài khoản, phân quyền, kênh, hộp thư, nghiệp vụ, bảng cấu hình, chấm điểm mở rộng, 8 đề xuất, lỗi thấy khi kiểm; cùng phiên: đề xuất 1, 2, 3, 4 đã làm (4: vai trò tùy chỉnh, chấm lại mục 8.1), bảng SLA, liên kết tay mã KH, mục 9 sau khi sửa | Yêu cầu dev002 06/10/2026: "thống kê toàn bộ các phần… đánh giá độ mở rộng, đã làm động để người dùng tự config hay chưa"; đọc code nhánh `feat/giao-dien-moi` và chạy thật trên máy 129 |
