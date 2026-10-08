# Phân quyền: engine và chặn ở API (M1b-04)

Phiên bản 0.6 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Mô tả engine phân quyền ở `apps/api/src/authz/` theo đặc tả `docs/02-yeu-cau/dac-ta/01-phan-quyen.md` §2, §3: một hàm `decide()` dùng chung cho REST, MCP và lọc danh sách.
- Ma trận quyền (164 khóa × 10 vai trò) **sinh tự động** từ §3 vào `packages/shared/src/permissions.ts` (`node tools/authz/gen-permissions.js`); test `matrix.spec.ts` đọc lại đặc tả, mỗi ô một ca (1.641 ca).
- Mọi route khai báo quyền ở `apps/api/src/authz/route-permissions.ts`; route chưa khai báo bị chặn (403). Test quét route bảo đảm không route nào thiếu.
- Danh sách hội thoại / danh bạ / tài khoản lọc **ngay trong truy vấn MongoDB** theo phạm vi của người đăng nhập (giống cách lọc tenant).
- SĐT khách bị ẩn phía API (`0900 *** 201`) trừ khi `cust.phone_full` cho xem đầy đủ; nút "Hiện" gọi `POST /api/reveal`, ghi nhật ký `phone.reveal` không chứa số.
- Quyết định chủ dự án 04/10/2026: token cũ không gắn người dùng chỉ chạy khi `AUTHZ_LEGACY_TOKENS=1` (dev/test); nick chưa có division thuộc `AUTHZ_DEFAULT_DIVISION` (VCparts); tài khoản chủ dự án = admin + giám đốc bán hàng VCparts.
- **Người duyệt cần xem kỹ:** bảng 94 ô ma trận viết bằng chữ tự do, đã dịch theo cách **hẹp** (mục 4); 28 ô "chờ điều kiện" hiện đang hoạt động như ✖.
- M1b-10 (mục 8): màn Quyền tạm thời (duyệt, trực thay, đăng ký vắng), `canDispatch` đã nối vào outbox, trạng thái `Cần duyệt lại`, `approvedBy` = mã người dùng, người không giữ nick mở hội thoại không làm khách thấy "Đã xem".
- Chưa làm (để phiên sau): owner / người phụ trách hội thoại / ticket / lead / tuyến (M1b-12) nên phạm vi CT, TK, LEAD, TUYẾN hiện luôn rỗng; ẩn SĐT nằm trong nội dung tin.

## Mục lục

- [1. Thành phần](#1-thành-phần)
- [2. Luồng một request](#2-luồng-một-request)
- [3. Dữ liệu và biến môi trường](#3-dữ-liệu-và-biến-môi-trường)
- [4. Ô ma trận dịch theo cách hẹp (cần chủ dự án chốt)](#4-ô-ma-trận-dịch-theo-cách-hẹp-cần-chủ-dự-án-chốt)
- [5. Việc chưa làm](#5-việc-chưa-làm)
- [6. Màn hình và thành phần dùng chung (M1b-05)](#6-màn-hình-và-thành-phần-dùng-chung-m1b-05)
- [7. Gán kênh, token thiết bị, token MCP (M1b-06)](#7-gán-kênh-token-thiết-bị-token-mcp-m1b-06)
- [8. Quyền tạm thời, trực thay, Cần duyệt lại (M1b-10)](#8-quyền-tạm-thời-trực-thay-cần-duyệt-lại-m1b-10)
- [9. Nghỉ việc và bàn giao (M1b-11)](#9-nghỉ-việc-và-bàn-giao-m1b-11)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Thành phần

| File | Việc |
|---|---|
| `packages/shared/src/permissions.ts` | Mã phạm vi, `PERMISSION_KEYS`, `PERMISSION_INFO`, `ROLE_MATRIX` (sinh tự động), kiểu `MePermissions`, `maskPhone`, `maskEmail`, `NO_ACCESS_TEXT`, `MCP_TOOL_GROUPS` |
| `tools/authz/matrix-source.js` | Đọc §3 của đặc tả; bảng `NARROW_CELLS` (ô chữ tự do) và `FOLLOWS` (dòng "theo `conv.view`") |
| `apps/api/src/authz/engine.ts` | Hàm thuần: `decide`, `hasKey`, `effectivePermissions`, `phoneVisibility` |
| `apps/api/src/authz/authz.service.ts` | Nạp người dùng (vai trò, cây, người giữ nick, quyền tạm thời) và đối tượng; `canSend`, `dataScope` |
| `apps/api/src/authz/authz.guard.ts` | Guard thứ hai sau `AuthGuard`: kiểm route, đặt phạm vi dữ liệu, kiểm đối tượng, ghi nhật ký `+NK` / `YC` |
| `apps/api/src/authz/route-permissions.ts` | Bảng quyền từng route |
| `apps/api/src/authz/phone-mask.interceptor.ts` | Ẩn SĐT trong mọi phản hồi JSON (trừ `/api/admin`, `/api/me`) |
| `apps/api/src/authz/authz.controller.ts` | `GET /api/me/permissions`, `GET /api/admin/roles` (cho MH-PQ-05), `POST /api/reveal` |

## 2. Luồng một request

1. `AuthGuard`: token, scope, tenant (như cũ).
2. `AuthzGuard`: tìm dòng của route. Không có dòng thì trả 403.
3. Token không gắn người dùng: token thiết bị / MCP đi đúng route của mình; token dashboard cũ chỉ qua khi `AUTHZ_LEGACY_TOKENS=1`.
4. Người đăng nhập: tính phạm vi dữ liệu (các nick / kênh được xem theo `conv.view`, hoặc `dataKey` của route), gắn vào request. Mọi collection kênh (`accounts`, `conversations`, `messages`, `contacts`, `groups`, `reactions`, `labels`, `read_states`, `checkpoints`, `suggestions`, `fetch_requests`) tự thêm điều kiện `uid ∈ phạm vi`.
5. Kiểm khóa ở mức vai trò (`hasKey`), rồi kiểm đối tượng (hội thoại, kênh, đơn vị, người dùng). Gửi tin dùng `canSend` (§2.9). Ngoài phạm vi: 403 "Không tìm thấy hoặc bạn không có quyền xem".
6. Ô có `+NK` hoặc mở bằng quyền tạm thời: ghi `audit_log` (không nội dung tin).

## 3. Dữ liệu và biến môi trường

- `channel_access` (§2.5): người giữ nick (`giu_nick`), mức `gui` / `xem` / `lead` cho người hoặc đơn vị. M1b-04 chỉ đọc; màn gán kênh ở M1b-06. Seed: `pnpm seed:org` gán người giữ các nick TD (TD-NK01 cần `SEED_NK01_UID`).
- `access_grants` (§2.6): engine đọc các quyền `hieu_luc` còn hạn. Xin / duyệt ở M1b-05 / M1b-10.
- `accounts.divisionId`: division của kênh; thiếu thì lấy `AUTHZ_DEFAULT_DIVISION`.
- `AUTHZ_LEGACY_TOKENS` (mặc định tắt), `AUTHZ_CACHE_MS` (mặc định 30 000 ms; đổi vai trò có hiệu lực ≤ 60 giây, sửa ở `/api/admin` có hiệu lực ngay).

## 4. Ô ma trận dịch theo cách hẹp (cần chủ dự án chốt)

Cột "Cách hiểu hẹp": phạm vi được áp; "chờ điều kiện" = engine chưa kiểm được điều kiện đó nên hiện **không cho** cho tới khi phiên có tính năng tương ứng khai báo điều kiện. Ba dòng `msg.attachment`, `msg.react`, `search.global` ghi "theo khóa khác" được chép đúng cột của `conv.view` / `conv.reply`.

| Khóa | Vai trò | Ô trong đặc tả | Cách hiểu hẹp |
|---|---|---|---|
| `conv.transfer` | KD | Gửi yêu cầu (8) | CT, NICK; chỉ gửi yêu cầu |
| `outbox.reapprove` | CS | Hội thoại kênh chính thức mình đang xử lý | CT |
| `msg.recall` | GĐ | Tin mình gửi; NICK (10) | SELF, NICK |
| `msg.recall` | GS | Tin mình gửi; NICK (10) | SELF, NICK |
| `msg.recall` | CS | Tin mình gửi | SELF |
| `msg.recall` | TT | Tin mình gửi; NICK (10) | SELF, NICK |
| `cust.timeline` | SA | Không có tin nhắn (14) | DV; chờ điều kiện `no_messages` |
| `cust.commerce` | CS | Đơn hàng: TK, KÊNH (34) | TK, KENH; chờ điều kiện `orders_only` |
| `cust.edit` | CS | Tag + ghi chú: TK | TK; chờ điều kiện `tag_note_only` |
| `cust.edit` | TT | Ghi chú: TUYẾN | TUYEN; chờ điều kiện `note_only` |
| `cust.import` | MK | DV (lead) | DV; chờ điều kiện `lead_only` |
| `cust.transfer_request` | GS | Về tổ mình (27) | TO; chờ điều kiện `to_own_team` |
| `cust.phone_full` | GĐ | CT, NICK: luôn hiện · DV: Hiện +NK | CT, NICK; Hiện: DV |
| `cust.phone_full` | GS | CT, NICK: luôn hiện · TỔ: Hiện +NK | CT, NICK; Hiện: TO |
| `cust.phone_full` | KD | CT, NICK: luôn hiện | CT, NICK |
| `cust.phone_full` | CS | TK đang mở: luôn hiện (35) · KÊNH: Hiện +NK | TK; Hiện: KENH; chờ điều kiện `ticket_open` |
| `cust.phone_full` | MK | LEAD: Hiện +NK | —; Hiện: LEAD |
| `cust.phone_full` | SA | DV: Hiện +NK | —; Hiện: DV |
| `cust.phone_full` | KT | Phiếu HĐ: Hiện +NK | —; Hiện: DV; chờ điều kiện `invoice_request` |
| `cust.phone_full` | TT | TUYẾN, NICK: luôn hiện | TUYEN, NICK |
| `cust.phone_full` | QS | TĐ: Hiện +NK | —; Hiện: TD |
| `cust.export` | MK | Lead chưa giao: DV +NK | DV; chờ điều kiện `unassigned_leads` |
| `cust.export_phone` | GĐ | DV: yêu cầu → duyệt +NK (18) | DV; chỉ gửi yêu cầu |
| `export.approve` | GĐ | Theo Q-PQ-19 | —; chờ điều kiện `q_pq_19` |
| `export.approve` | QS | TĐ (mặc định, Q-PQ-19) | TD |
| `cust.privacy_request` | AD | ✅ (không thấy nội dung) | ALL; chờ điều kiện `no_content` |
| `cust.privacy_request` | QS | Xem sổ: TĐ | TD; chỉ xem |
| `workitem.approve` | GĐ | DV (trả lời thay) | DV; chờ điều kiện `on_behalf` |
| `workitem.approve` | GS | TỔ (trả lời thay) | TO; chờ điều kiện `on_behalf` |
| `workitem.queue_config` | GĐ | DV (duyệt) | DV |
| `workitem.queue_config` | CS | NH (soạn) | NH; chỉ đề xuất |
| `payment_reply.process` | GĐ | DV (xem) | DV; chỉ xem |
| `debt.hold` | GĐ | DV (duyệt lý do "Khách chiến lược", quyết khi KT không đồng ý "Xin giữ lại" / tạm hoãn — 0 | DV |
| `debt.hold` | GS | TỔ (đề nghị) | TO; chỉ đề xuất |
| `debt.hold` | KD | CT (đề nghị) | CT; chỉ đề xuất |
| `debt.hold` | KT | DV (đặt, duyệt đề nghị thường) | DV |
| `debt.notice.respond` | GS | TỔ (thay owner vắng) | TO; chờ điều kiện `owner_absent` |
| `debt.note` | SA | DV (chỉ đọc) | DV; chỉ xem |
| `debt.note` | QS | TĐ (chỉ đọc) | TD; chỉ xem |
| `invoice_settings.edit` | AD | Mức tích hợp | ALL; chờ điều kiện `integration_only` |
| `ticket.view` | KD | CT (khách của tôi) | CT |
| `ticket.view` | CS | TK (NH) | TK |
| `media.delete` | MK | Của mình | SELF |
| `zns.send_single` | SA | DV (mẫu Xác nhận / trạng thái đơn) | DV; chờ điều kiện `order_templates` |
| `zns.send_single` | KT | DV (mẫu Hóa đơn, Thanh toán — PQ-24) | DV; chờ điều kiện `invoice_payment_templates` |
| `campaign.create` | MK | DV (chỉ mục đích **Nuôi lead**, nguồn "Từ lead" — 04 MH-OA-13; NVMK và TMK) **(v1.4.5·D8-2 | DV; chờ điều kiện `purpose_nurture_lead` |
| `campaign.create` | SA | DV (Xác nhận đơn) | DV; chờ điều kiện `purpose_order_confirm` |
| `campaign.create` | KT | DV (Nhắc thanh toán, Đối chiếu công nợ, Hóa đơn — 06 HD-28) | DV; chờ điều kiện `purpose_payment` |
| `campaign.run` | CS | Của mình | SELF |
| `campaign.run` | MK | Của mình (Nuôi lead) **(v1.4.5·D8-26)** | SELF; chờ điều kiện `purpose_nurture_lead` |
| `campaign.run` | SA | Của mình | SELF |
| `campaign.run` | KT | Của mình | SELF |
| `campaign.report` | GS | TỔ (khách tổ) | TO |
| `campaign.report` | MK | DV (mục đích Nuôi lead) **(v1.4.5·D8-26)** | DV; chờ điều kiện `purpose_nurture_lead` |
| `campaign.report` | SA | Của mình | SELF |
| `campaign.report` | KT | DV: mục đích Nhắc thanh toán, Đối chiếu công nợ, Hóa đơn (kể cả người khác tạo) | DV; chờ điều kiện `purpose_payment` |
| `cost.view` | AD | TĐ (xem) | TD; chỉ xem |
| `cost.view` | CS | NH (chỉ xem, không xuất) **(v1.4.3·D8-08)** | NH; chỉ xem |
| `ads.spend_lock` | MK | NH (trưởng nhóm) | NH |
| `lead.dispute` | GĐ | DV (quyết) | DV |
| `lead.dispute` | GS | TỔ (quyết) | TO |
| `bot.edit` | CS | NH (soạn nháp, 04 MH-OA-08, 09) | NH; chỉ đề xuất |
| `bot.kill` | MK | DV (mọi NV marketing, không chỉ trưởng) **(v1.4.3·D8-09)** | DV |
| `automation.edit` | GĐ | DV (bật / tắt) | DV; chờ điều kiện `toggle_only` |
| `automation.edit` | CS | NH (tạo, sửa; GĐ bật) (40) **(v1.4.3·D8-07)** giữ, 00 §2.2 đã theo | NH; chờ điều kiện `no_activate` |
| `channel.confirm` | GĐ | DV (xem) | DV; chỉ xem |
| `channel.safety_confirm` | GS | NICK (người giữ mới) | NICK |
| `channel.safety_confirm` | KD | NICK (người giữ mới) | NICK |
| `channel.safety_confirm` | TT | NICK (người giữ mới) | NICK |
| `user.edit` | AD | ✅ trừ chính mình (29) | ALL; trừ chính mình |
| `role.approve` | QS | ✅ theo PQ-42 / Q-PQ-17 | ALL |
| `user.lock` | GS | TỔ: chỉ tạm khóa khẩn (28) | TO; chờ điều kiện `emergency_lock_only` |
| `access.review` | AD | TĐ (lập danh sách) | TD; chỉ đề xuất |
| `access.review` | GĐ | DV (xác nhận) | DV |
| `access.review` | QS | TĐ (xem) | TD; chỉ xem |
| `grant.revoke` | GS | TỔ (do mình duyệt) | TO; chờ điều kiện `own_approved` |
| `token.manage` | AD | ✅ — **không tạo** token MCP cá nhân cho người khác (PQ-43) | ALL |
| `audit.view` | KD | Của tôi | SELF |
| `audit.view` | CS | Của tôi | SELF |
| `audit.view` | MK | Của tôi | SELF |
| `audit.view` | SA | Của tôi | SELF |
| `audit.view` | KT | Của tôi | SELF |
| `audit.view` | TT | Của tôi | SELF |
| `alert.handle` | AD | TĐ (loại kỹ thuật) | TD; chờ điều kiện `technical_alerts` |
| `alert.handle` | GS | TỔ (người nhận theo quy tắc) | TO |
| `alert.config` | GĐ | Xem | ALL; chỉ xem |
| `alert.config` | QS | Xem + đề xuất | ALL; chỉ đề xuất |
| `config.sla` | AD | Xem | ALL; chỉ xem |
| `config.sla` | GS | Xem: TỔ | TO; chỉ xem |
| `config.sla` | QS | Xem | ALL; chỉ xem |
| `config.report_target` | QS | Đề xuất: TĐ | TD; chỉ đề xuất |
| `config.retention` | AD | Đề xuất (25) | ALL; chỉ đề xuất |
| `config.retention` | QS | Duyệt (25) | ALL |
| `config.security` | QS | Xem | ALL; chỉ xem |

## 5. Việc chưa làm

- Owner, người phụ trách, ticket, lead, tuyến chưa có trong dữ liệu: các ca UAT dựa vào chúng (UAT-PQ-08, 09, 18, 21–23) chờ M1b-09 / M1b-12.
- Còn thiếu của M1b-06 (xem mục 7): gán chéo division chờ cơ chế duyệt PQ-42; thông báo cho chủ token khi bị thu hồi; cảnh báo IP mới / thiết bị im lặng; xoay vòng tự động 180 ngày; nút "Hạn dùng" của token thiết bị.
- SĐT nằm trong **nội dung tin nhắn** chưa ẩn; email khách chưa có trường để ẩn.
- Route của M1a-04 / M1a-05 đã khai báo trước trong bảng; khi gộp, route mới khác tên phải thêm dòng.

## 6. Màn hình và thành phần dùng chung (M1b-05)

| Việc | Ở đâu |
|---|---|
| Đọc quyền, quy tắc ẩn / khóa nút D8-02 | `apps/web/src/state/permissions.tsx` (`usePermissions`), `utils/permissions.ts` (`buttonState`, `canSeeTechnical`), bọc nút bằng `components/access/Can.tsx` |
| Màn Vai trò & quyền, chỉ đọc (MH-PQ-05) | `/admin/roles`, `pages/admin/RolesTab.tsx`, nguồn `GET /api/admin/roles` |
| "Không có quyền" dạng A (trang) và B (đối tượng; API 403 hoặc 404 như nhau) | `components/access/NoAccess.tsx` |
| Xin quyền truy cập | `AccessRequestModal.tsx`; `GET /api/access-grants/approver` (người duyệt theo PQ-30), `POST /api/access-grants` (ghi `access_grants` trạng thái `cho_duyet`, nhật ký `grant.request` không chứa lý do). Màn duyệt: M1b-10 |
| Ẩn SĐT / email | `components/contacts/MaskedContact.tsx`: nút Hiện gọi `POST /api/reveal`, tự ẩn sau 60 giây; dùng ở Danh bạ và thẻ người gửi |
| Người chỉ xem không có ô soạn | `GET /api/conversations/:id/access` trả `canReply`; ChatPane thay ô soạn bằng câu "Bạn chỉ có quyền xem hội thoại này." |
| NVKD không thấy UID, "Xem nội dung gốc", phần kỹ thuật của /sync | `canSeeTechnical`: `sync.view` phải có phạm vi rộng hơn NICK |
| Menu Quản trị | Ẩn khi không có `org.view`, `user.view`, `role.view`; trang quản trị không đủ quyền hiện dạng A |

Giới hạn: mới bọc nút Kết nối / Ngắt kết nối kênh API và hai ô trên; các nút còn lại bọc dần khi từng màn được làm. Sao chép SĐT không cần Hiện (`allowCopy`) có sẵn nhưng chưa màn nào bật.

## 7. Gán kênh, token thiết bị, token MCP (M1b-06)

- **Gán kênh** (`/admin/channel-access`, khóa `channel.access`): ghi bảng `channel_access` mà engine đọc. Kênh cá nhân chỉ có đúng một người giữ nick (đổi người cần `?replace=1` và lý do ≥ 10 ký tự; không gỡ được người giữ nick); kênh chính thức gán `gui` / `xem` / `lead` cho người hoặc đơn vị. Vai trò giới hạn mức (`nvkd` chỉ giữ nick, `cskh` chỉ `gui`/`xem`, `quan_sat` và `sale_admin` không nhận). Không ai tự gán cho mình (PQ-41). Gán chéo division bị từ chối cho tới khi có cơ chế duyệt PQ-42.
- **Token** (`api_tokens`, chỉ lưu sha256): loại `device` (thiết bị), `mcp_user` (MCP cá nhân), `sync`, `agent`; token cũ không có loại là `legacy`, không gắn nick, vẫn chạy như trước. Chuỗi token chỉ nằm trong phản hồi của lệnh tạo; ghép máy bằng mã thì token sinh ra lúc extension hỏi (poll) và trả đúng một lần, không lưu ở đâu, kể cả giữa lúc Admin duyệt và lúc extension nhận.
- **Token thiết bị gắn nick**: `AuthzGuard` chặn mọi request có `uid` (đường dẫn, body, query, hoặc `:id` của lệnh outbox / fetch) ngoài danh sách nick của token (403 "Thiết bị không được gán nick này"); `GET /api/outbox/pending` tự thu về nick của token. Thu hồi có hiệu lực ngay trên tiến trình đang chạy, tối đa 60 giây nếu connector chạy tiến trình riêng (bộ nhớ đệm 60 giây).
- **Nick chờ xác nhận** (PQ-52 d): thiết bị đã ghép khai báo một nick lạ thì tài khoản được tạo với `status = cho_xac_nhan`; dữ liệu vẫn nhận nhưng `dataScope` loại nick đó với mọi người, kể cả Admin; Admin xác nhận vào division (kèm người giữ) hoặc từ chối và xóa (lý do ≥ 10 ký tự, nhật ký chỉ ghi số lượng).
- **Token MCP cá nhân** (`/settings/tokens`, `token.own`): chỉ chính chủ tạo, mặc định tắt cho tới khi Admin bật theo division / vai trò (`security_settings.allowSelfMcpToken`), tối đa 3 token đang dùng, hạn 30 / 60 / 90 ngày. Token chạy bằng quyền chủ token: `AuthzGuard` áp phạm vi dữ liệu của chủ lên request `/mcp`; chỉ có hai tool đọc `search_messages`, `get_contact_profile` (SĐT luôn che); mỗi lần gọi ghi `mcp.call` kèm `onBehalfOf`, không có nội dung. Admin không có API tạo hộ (POST `/api/admin/tokens` loại `mcp` hoặc có `userId` trả 403).
- **Token tác tử gửi / đồng bộ** (Admin tạo): chỉ thấy nhóm tool tương ứng và chỉ chạm nick trong danh sách.
- **M1b-18 (PQ-70, 72, 82):** (a) `POST /api/admin/users/:id/grant-request` (khóa `permission.explain`, không thêm ô ma trận) tạo dòng `access_grants` `cho_duyet` nhân danh người được kiểm tra, người duyệt tính theo PQ-30, `requestedBy` = Admin, báo người được kiểm tra (`grant_on_behalf`); không cấp quyền, Admin không tự duyệt được; nhật ký `grant.request_on_behalf` không có lý do. (b) `GET /api/admin/tokens/:id/impact` (`token.manage`): đọc dòng `mcp.call` của token, trả số lần gọi, mã hội thoại, IP, 20 lần gần nhất; không có chuỗi token hay nội dung. (c) Đặt cờ Sắp nghỉ: mọi token `mcp_user` của người đó mất nhóm `de_xuat` ngay, `forgetCache()` như thu hồi; tạo mới nhóm `de_xuat` trả 403; bỏ cờ không tự trả lại nhóm. Ngày nghỉ dự kiến tới: `HandoverService.remindPreLeaveDue` nhắc quản lý, Admin, QS mỗi ngày một lần từ 08:30, không tự khóa.
- **Cờ `AUTHZ_LEGACY_TOKENS` được giữ**: nhiều e2e cũ và công cụ dev dùng token Dashboard không gắn người; bỏ cờ phải viết lại các test đó nên để phiên riêng. Token cũ của Chrome driver vẫn chạy (không gắn nick); ghép lại bằng mã để có token gắn nick.

## 8. Quyền tạm thời, trực thay, Cần duyệt lại (M1b-10)

| Việc | Ở đâu |
|---|---|
| Màn MH-PQ-07 `/admin/access-requests?tab=` (Chờ tôi duyệt, Của tôi, Trực thay, Tất cả trong phạm vi, Tất cả) | `apps/web/src/pages/admin/AccessRequestsTab.tsx`; API `apps/api/src/authz/grants.service.ts`, `grants.controller.ts` |
| Duyệt / Từ chối / Hủy / Thu hồi / Đề nghị xem lại | `POST /api/access-grants/:id/{approve,reject,cancel,revoke,review-request}`. Duyệt: người duyệt PQ-30 hoặc quản lý có `grant.approve` trên đối tượng; không tự duyệt; người duyệt phải tự xem được đối tượng (PQ-31); chỉ rút ngắn thời hạn. Thu hồi: AD mọi quyền, GĐ trong division, GS chỉ quyền mình duyệt |
| Xin quyền theo SĐT / mã KH (PQ-49) | `POST /api/access-grants/by-identity`: câu trả lời luôn giống nhau, không lộ khách có tồn tại hay không |
| Trực thay (PQ-32) | `POST /api/access-grants/covers`: một dòng `access_grants` loại `truc_thay` cho mỗi nick người vắng giữ, ≤ 30 ngày, không trùng khoảng, người trực không đang được trực thay; lùi "Từ" tới 00:00 hôm nay cần lý do, quyền chỉ có từ lúc bấm. `POST /:id/end` kết thúc sớm. Engine đọc grant này thành phạm vi `NICK` |
| Đăng ký vắng | `POST /api/leave-requests` (collection `leave_requests`), người duyệt = quản lý gần nhất; "Đồng ý" = tạo trực thay kèm `leaveRequestId` |
| Cờ Nghỉ phép, tóm tắt 18:00 | `GET /api/me/profile` trả `leave`; job 5 phút/lần gửi một thông báo mỗi ngày mỗi nick sau 18:00 (giờ VN) |
| Thông báo | Collection `notifications`, `GET /api/notifications` (M1c-07 thêm realtime) |
| Gửi trên nick người khác (QT-SZ-10) | `GET /api/conversations/:id/access` trả `sendMode` (`truc_thay` / `tra_loi_thay`), `holderName`, `coverUntil`; lệnh outbox lưu `sendSource`, `onBehalfOf`; nhật ký `reply_cover` / `reply_on_behalf`; biến mẫu câu `{ten_nguoi_giu_nick}` |
| SZ-23 (không "Đã xem") | `autoFetch` chỉ đúng với người giữ nick / trực thay; `POST /conversations/:id/fetch` của người khác bị chặn, GS/GĐ gửi `{onBehalf:true}` (nhật ký `conversation.fetch_on_behalf`); "Đánh dấu đã đọc" của người không giữ nick có hộp xác nhận |
| `Cần duyệt lại` (D40, PQ-51) | `packages/shared/src/outbox.ts`: cạnh `hold`, `reapprove`; `canDispatch` (`authz.service.ts`) chạy ở `/outbox/pending`, `claim`, dispatcher; khóa / cho nghỉ việc chuyển ngay lệnh chờ của người đó; `POST /api/outbox/:id/reapprove` chỉ người giữ nick / trực nick; `approvedBy` = mã người dùng, `approvedByName` để hiện |
| Lệnh kết bạn | `POST /api/outbox` với `friend_*` cần thêm `friend.respond` trên nick (PQ-44) |

Giới hạn: chưa có "Trực nhóm khách", "Ủy quyền duyệt", nhắc / chuyển yêu cầu quá 2 / 4 giờ làm việc, ghi chú nội bộ tự động khi trả lời thay; "đầu ngày làm việc" tạm tính 00:00 (chưa theo lịch division); "Chia đều" khi bàn giao nghỉ việc đã loại người Vắng / Ngoại tuyến / Nghỉ phép (mục 9).

## 9. Nghỉ việc và bàn giao (M1b-11)

Màn MH-PQ-04 `/admin/users/:id/offboard` (`apps/web/src/pages/admin/OffboardPage.tsx`), API ở `apps/api/src/handover/`. Hợp đồng chung: `packages/shared/src/handover.ts`.

| Việc | Ở đâu |
|---|---|
| Bước ① Khóa ngay | `POST /api/admin/users/:id/offboard` (`user.offboard`: Admin, GĐ). Ngoài khóa phiên và chuyển lệnh chờ sang `Cần duyệt lại`: thu hồi token MCP cá nhân, thu hồi token thiết bị gắn nick người đó giữ (trừ máy Admin chọn "Giữ", chỉ Admin được chọn), thu hồi quyền tạm thời và trực thay liên quan, báo Admin / GĐ / GS. Đơn vị đang quản lý để trống |
| Xem trước | `GET /api/admin/users/:id/offboard-preview`: số khách, hội thoại mở, thiết bị, lệnh chờ, nick và việc còn trên nick (chỉ số đếm, không nội dung) |
| Bước ② Chia khách | `POST /api/admin/users/:id/handover/preview` rồi `POST .../handover`. Cách chia: một người, chia đều, theo khu vực / tag, chọn từng khách. Người nhận: NVKD / GS đang hoạt động trong phạm vi bàn giao của người thao tác. "Chia đều" và "Theo khu vực" bỏ người Vắng, Ngoại tuyến, Nghỉ phép (bảng xem trước ghi lý do); chọn tay vẫn chọn được họ. Doanh số 12 tháng chưa có nguồn (chờ VCsales): cột trả `null`; chưa có "Chia đều theo doanh số" |
| Bước ③ Nick | Mỗi nick đang giữ bắt buộc có người giữ mới. Chưa tick "Đã đăng xuất điện thoại cũ" thì nick `unsafe` + `safety = chua_an_toan`: không ai gửi qua nick (`canSend`, `canDispatch`), tin khách vẫn về. Không có ô mật khẩu. Tick lúc bàn giao cần `channel.safety_confirm` |
| Xác nhận sau | `POST /api/admin/channel-access/:uid/safety-confirm` (`channel.safety_confirm` trên nick): ghi người xác nhận + thời điểm, nick gửi lại được; nút ở tab Gán kênh |
| Hoàn tất | Owner khách đổi ngay (`customer_accounts.owners`), hội thoại gán cho người cũ đi theo khách (còn lại về người giữ nick), đổi `channel_access giu_nick`, lệnh còn chờ trên nick chuyển `Cần duyệt lại` (`holder_changed`), thông báo người nhận, bản ghi `handovers` (chỉ số đếm và mã), nhật ký `user.handover`. Chạy lại an toàn: chỉ đổi phần người cũ còn giữ |
| Đồng hồ (PQ-34, PQ-51) | Job 5 phút (`HANDOVER_JOBS=off` để tắt): nhắc GS / GĐ / Admin ở 4 giờ và 20 giờ sau khóa; quá 24 giờ khách còn lại về "Chưa phân công", nick gắn tạm cho quản lý gần nhất và đánh "Chưa an toàn"; nhắc hằng ngày từ 08:30 (VN) cho nick còn chưa an toàn |
| Người cũ | Phiên bị thu hồi (401); phiên còn sót vẫn nhận 403 ở hội thoại cũ (`subject.active = false`, test `handover-td.e2e-spec.ts`) |

Giới hạn: hiệu lực hẹn giờ chưa làm (bàn giao có hiệu lực ngay, hẹn giờ vào tương lai bị từ chối); nhắc việc theo khách và nhóm làm trưởng nhóm chưa có dữ liệu nên chỉ hiện số lời mời kết bạn, lệnh, hội thoại chưa trả lời; cảnh báo R11 (tin gửi từ thiết bị khác sau khi khóa, UAT-PQ-69) và đồng bộ khóa từ Google Workspace (UAT-PQ-71) chưa làm; "Nhắn khách" qua kênh chính thức chưa làm; mẫu câu cá nhân không bị xóa nhưng chưa có chỗ người nhận xem và sao chép riêng. Phản hồi GS của Tổ khác (UAT-DK-67 ghi GS Hương chia cho Tổ 1) bị chặn theo phạm vi `TO` của `user.handover`: ca chạy bằng GĐ.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.6 | 04/10/2026 23:16 | Agent Sonnet · M1b-18 | Mục 7: yêu cầu quyền hộ, ngăn kéo Phạm vi ảnh hưởng, Sắp nghỉ hạ token và nhắc khóa | Phiên M1b-18 |
| 0.5 | 04/10/2026 21:59 | Claude Code · M1b-11 | Thêm mục 9: nghỉ việc và bàn giao (khóa, chia khách, đổi người giữ nick, nick Chưa an toàn, đồng hồ 4h/20h/24h); sửa giới hạn mục 8 | Phiên M1b-11 |
| 0.4 | 04/10/2026 20:38 | Claude Code · M1b-10 | Thêm mục 8: quyền tạm thời, trực thay, đăng ký vắng, Cần duyệt lại, canDispatch, SZ-23; bỏ dòng canDispatch khỏi Chưa làm | Phiên M1b-10 |
| 0.3 | 04/10/2026 20:25 | Claude Code · M1b-06 | Thêm mục 7: gán kênh, token thiết bị gắn nick, nick chờ xác nhận, token MCP cá nhân; cập nhật "Chưa làm" | Phiên M1b-06 |
| 0.2 | 04/10/2026 19:18 | Claude Code · M1b-05 | Thêm mục 6: màn hình và thành phần dùng chung, 3 route mới | Phiên M1b-05 |
| 0.1 | 04/10/2026 19:06 | Claude Code · M1b-04 | Tạo tài liệu engine phân quyền, bảng ô dịch hẹp | Phiên M1b-04, chủ dự án duyệt kế hoạch đợt 1 |
