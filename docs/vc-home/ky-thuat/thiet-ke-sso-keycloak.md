# Kế hoạch code: đăng nhập một lần (SSO) bằng Keycloak và cổng VC Home

Phiên bản 0.6 · 08/10/2026 · Trạng thái: Đã code SSO-00…04 với thông số giả lập (chờ đầu vào I1–I9 để lên thật)

## Tóm tắt

- **Vị trí trong bộ tài liệu:** khung chung của mọi giai đoạn ở [ke-hoach-code-tong-quan.md](ke-hoach-code-tong-quan.md); đây là thiết kế kỹ thuật của **GĐ A (bản R1)** trong bộ tài liệu VC Home ([../README.md](../README.md)). Yêu cầu nghiệp vụ, quy tắc và các giai đoạn B–E nằm ở các file `01`–`12`; khi lệch nhau thì bộ tài liệu nghiệp vụ thắng.
- **Tài liệu nói gì:** kế hoạch code đầy đủ để VClinks, VCwiki và các app sau này dùng chung một cửa đăng nhập. Nhân viên đăng nhập một lần bằng tài khoản Google Workspace công ty (`@vcprosperous.com`, `@vcpart.vn`), vào trang **VC Home** thấy lưới app mình được dùng, bấm app nào vào thẳng app đó.
- **Kiến trúc:** Keycloak làm máy chủ định danh (gọi tắt **VC ID**) đứng giữa Google và các app. VC Home là trang tĩnh React + antd, không giữ phiên riêng. Các app là "app khách" theo chuẩn OpenID Connect (OIDC). Thêm một job nhỏ `vc-provisioner` đồng bộ trạng thái tài khoản từ Google.
- **Nguyên tắc:** VC ID chỉ trả lời "người này là ai, được vào app nào". Quyền chi tiết (vai trò, kho, mức mật) **vẫn nằm trong từng app**. Token cho máy (MCP, thiết bị, extension, agent máy Zalo) **không đổi**.
- **Khối lượng:** 13 phiên, khoảng 65 giờ dev (≈ 8 ngày công), cộng việc của người có quyền (máy chủ, DNS, Google Admin).
- **Lịch đề xuất:** dựng VC ID, VC Home và chuyển VCwiki từ 13/10 đến 24/10, không đụng VClinks. VClinks chuyển **sau mốc M1 26/10** (27/10–31/10). Tắt đăng nhập mật khẩu VCwiki khoảng 10/11.
- **Quay lui được ở mọi bước:** mỗi app có cờ (`AUTH_PROVIDER` ở VClinks, `AUTH_PASSWORD_LOGIN` ở VCwiki). Dữ liệu chỉ thêm trường, không xoá.
- **Có mail công ty chỉ là qua cổng** (VH-BR-26, D-BA-37…40): vào app phải là tài khoản cá nhân đủ điều kiện (bật xác thực 2 bước, không thuộc danh sách loại trừ như hộp thư dùng chung). `vc-provisioner` chạy mỗi 15 phút, cấp và gỡ nhóm app, tạo sẵn user VC ID; app kiểm nhóm ngay từ ngày bật.
- **Việc còn mở:** 9 đầu vào từ người có quyền (I1–I9, mục 4.3). Q1–Q5 (mục 4.1) đã chốt theo đề xuất ngày 08/10/2026 ([12](../12-cau-hoi-rui-ro.md) mục 4).
- **Đã code (08/10/2026, thông số giả lập):** SSO-00…04 trong `vc-platform/`: realm dạng code, theme, VC Home, `vc-provisioner`, compose production, sao lưu. Quyết định phát sinh khi code ở [12](../12-cau-hoi-rui-ro.md) D-BA-49…54, đã ghi vào các mục dưới. Có I3, I4, I6 thì chỉ đổi biến môi trường.
- **Người duyệt xem kỹ:** mục 4 (quyết định), mục 5.2 (hợp đồng tích hợp app), mục 8 (các phiên và lịch), mục 10 (chuyển đổi và quay lui).

## Mục lục

- [1. Mục tiêu và phạm vi](#1-mục-tiêu-và-phạm-vi)
- [2. Hiện trạng code (đọc ngày 08/10/2026)](#2-hiện-trạng-code-đọc-ngày-08102026)
- [3. Kiến trúc đích](#3-kiến-trúc-đích)
- [4. Quyết định và đầu vào cần có trước khi code](#4-quyết-định-và-đầu-vào-cần-có-trước-khi-code)
- [5. Thiết kế chi tiết](#5-thiết-kế-chi-tiết)
- [6. Repo mới `vc-platform`](#6-repo-mới-vc-platform)
- [7. Môi trường và triển khai](#7-môi-trường-và-triển-khai)
- [8. Kế hoạch theo phiên](#8-kế-hoạch-theo-phiên)
- [9. Kiểm thử và UAT](#9-kiểm-thử-và-uat)
- [10. Chuyển đổi dữ liệu và quay lui](#10-chuyển-đổi-dữ-liệu-và-quay-lui)
- [11. Vận hành và xử lý sự cố](#11-vận-hành-và-xử-lý-sự-cố)
- [12. Rủi ro](#12-rủi-ro)
- [13. Tài liệu phải cập nhật ở từng repo](#13-tài-liệu-phải-cập-nhật-ở-từng-repo)
- [14. Để sau (không làm trong kế hoạch này)](#14-để-sau-không-làm-trong-kế-hoạch-này)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. Mục tiêu và phạm vi

### 1.1 Người dùng thấy gì

1. Mở `home.vcprosperous.com` → bấm **"Đăng nhập bằng tài khoản công ty"** → chọn tài khoản Google công ty → về VC Home thấy lưới app (VClinks, VCwiki; ô "Sắp có" cho app sau).
2. Bấm VClinks → vào thẳng `/conversations`, không hỏi gì thêm. Mở thẳng một link sâu của VClinks hay VCwiki cũng vào thẳng (nếu đã có phiên) hoặc chỉ một lần chọn tài khoản Google (nếu chưa).
3. Trong VClinks và VCwiki có nút 9 chấm ở header để chuyển sang app khác.
4. Đăng xuất ở bất kỳ đâu → đăng xuất mọi app.
5. Bị khoá trên VC ID hoặc bị khoá trên Google → mất quyền ở mọi app trong ≤ 1 phút (khoá trên VC ID) hoặc ≤ 20 phút (khoá trên Google, qua job đồng bộ).

### 1.2 Trong phạm vi

| Hạng mục | Nội dung |
|---|---|
| VC ID (Keycloak) | Realm `vc`, nối Google, chỉ nhận 2 domain công ty, nhóm theo app, đăng xuất phía máy chủ, giao diện tiếng Việt cho các trang người dùng thấy, cấu hình dạng code |
| VC Home | Trang tĩnh: đăng nhập, lưới app theo nhóm, hồ sơ, đăng xuất, trang lỗi; file danh mục app `catalog.json` |
| `vc-provisioner` | Job mỗi 15 phút: tài khoản bị khoá hoặc xoá trên Google → khoá trên VC ID và đăng xuất mọi app; cấp và gỡ nhóm app theo điều kiện vào app (VH-BR-26) |
| VCwiki | Đăng nhập OIDC thay mật khẩu, gắn tài khoản cũ theo email, nhận thông báo đăng xuất, thanh chuyển app; băm token phiên và bật cờ `secure` cho cookie |
| VClinks | Đăng nhập OIDC thay Google trực tiếp, gắn tài khoản cũ, nhận thông báo đăng xuất, thanh chuyển app |
| Vận hành | Máy chủ production, sao lưu, giám sát, sổ tay sự cố |

### 1.3 Ngoài phạm vi

- Phân quyền chi tiết trong app (vai trò VClinks, kho và mức mật VCwiki): giữ nguyên.
- Token cho máy: `vcz_` (VClinks), `vcmcp_` (VCwiki), token thiết bị, agent máy Zalo: giữ nguyên.
- Danh bạ tổ chức chung, đổi token cho Gatekeeper, nhiều tổ chức (bán SME), app điện thoại: xem mục 14.
- VCsale, VCgarage…: vào sau theo hợp đồng ở mục 5.2.

## 2. Hiện trạng code (đọc ngày 08/10/2026)

### 2.1 VClinks (`vclinks/apps/api`, NestJS 10, Node ≥ 20)

| Thành phần | File | Hiện trạng |
|---|---|---|
| Đăng nhập Google | `src/auth/google.client.ts` | Gọi thẳng endpoint Google bằng `fetch`, `scope=openid email profile`, `prompt=select_account`, `hd` = domain hoặc `*`. **Không kiểm chữ ký `id_token`** (dựa vào TLS, chỉ so `aud`) |
| Luồng đăng nhập | `src/auth/auth.service.ts` | `state` một lần trong collection `auth_states` (10 phút); kiểm email và `hd` thuộc `COMPANY_DOMAINS`; tìm user theo email; tự tạo user không vai trò nếu `AUTH_SELF_SIGNUP` bật; chặn `tam_khoa`, `nghi_viec`; ghi `audit` |
| Phiên | `src/auth/session.service.ts` | Token `vcs_` ngẫu nhiên, lưu băm sha256 trong `sessions`, hết hạn sau 12 giờ không dùng, cache 60 giây; có `revokeUser`, `revokeOthers` |
| Trả phiên cho web | `src/auth/auth.controller.ts` | Chuyển về `/login#session=…&next=…` (token trong fragment); web lưu vào `localStorage` (`vclinks.token`), gửi `Authorization: Bearer` |
| Chặn route | `src/auth/auth.guard.ts` | Bearer: `vcs_` (phiên) hoặc `vcz_` (token máy, scope `ingest` / `mcp` / `dev`) |
| Body parser | `src/app.factory.ts` | Chỉ có `json()`; **chưa có `urlencoded()`** (cần cho thông báo đăng xuất) |
| Domain | `packages/shared/src/org.ts` | `COMPANY_DOMAINS = ['vcprosperous.com', 'vcpart.vn']` |
| Thư viện JWT | `apps/api/package.json` | Chưa có (`jose` chưa cài) |
| Realtime | `apps/web/src/utils/realtime.ts` | SSE qua `fetch` có header `Authorization`; không bị ảnh hưởng |

### 2.2 VCwiki (`tiktok-to-text/backend`, FastAPI, Python)

| Thành phần | File | Hiện trạng |
|---|---|---|
| Đăng nhập | `app/auth.py` | Email + mật khẩu (scrypt); `/auth/setup` tạo admin đầu tiên; admin tạo user tay; vai trò `admin` / `member` |
| Phiên | `app/auth.py` | Cookie `vc_session` httpOnly, SameSite=Lax, **không có cờ `secure`**, 14 ngày; **token lưu nguyên văn làm `_id`** trong `sessions` (không băm) |
| Token máy | `app/auth.py` | `vcmcp_`, lưu băm sha256 trong `api_tokens` |
| Quyền | `app/policy.py`, `app/org.py` | Một điểm kiểm quyền, kho, mức mật C0–C3, cây tổ chức riêng |
| Tài liệu | `docs/BA.md` | Mục 2 ghi "Đăng nhập Google Workspace / SSO: chờ quyết định"; mục 12 câu 4 đã trả lời "Email + mật khẩu". Mã SYS lớn nhất đang dùng: **SYS-42** (đọc lại 08/10/2026; `UAT-SYS-59` là mã ca kiểm thử, không phải mã SYS) |
| Quy trình | `CLAUDE.md` | Bắt buộc BA → DESIGN → Code → UAT, commit ghi mã BA + mã DESIGN |

### 2.3 Hệ quả cho thiết kế

- Hai app đều đã có **phiên riêng phía server** → giữ nguyên cơ chế phiên của từng app, chỉ thay bước "xác định người này là ai". Đây là thay đổi nhỏ nhất.
- VClinks đã có sẵn khung kiểm domain, `state` một lần, tự tạo user, khoá user: tái dùng.
- VCwiki cần sửa thêm hai lỗi bảo mật nhỏ ngay trong đợt này: băm token phiên, bật cờ `secure`.

## 3. Kiến trúc đích

### 3.1 Thành phần

```
                         ┌────────────────────────────────────────┐
  Google Workspace  ◄────┤  VC ID — Keycloak (realm "vc")         │◄──── vc-provisioner (mỗi 15 phút)
  @vcprosperous.com      │  id.vcprosperous.com                   │      đọc Google Directory, khoá + đăng xuất
  @vcpart.vn             │  · ai là ai (sub)  · được vào app nào   │
                         │  · phiên chung     · đăng xuất phía máy │
                         │    chủ             · nhật ký sự kiện    │
                         └───┬───────────────┬──────────────┬──────┘
             OIDC (PKCE)     │               │              │   OIDC + thông báo đăng xuất (back-channel)
          ┌──────────────────▼──┐  ┌─────────▼───────┐  ┌───▼────────────┐   ┌─────────────┐
          │ VC Home (SPA tĩnh)  │  │ VClinks         │  │ VCwiki         │   │ App sau     │
          │ home.vcprosperous   │  │ NestJS + React  │  │ FastAPI+React  │   │ VCsale…     │
          │ lưới app, hồ sơ     │  │ phiên vcs_      │  │ cookie phiên   │   │             │
          │ catalog.json        │  │ quyền chi tiết  │  │ quyền chi tiết │   │             │
          └─────────────────────┘  └─────────────────┘  └────────────────┘   └─────────────┘
               ▲ catalog.json (công khai, không có dữ liệu cá nhân) đọc bởi thanh chuyển app của mọi app
```

| Thành phần | Công nghệ | Chạy ở đâu | Giữ dữ liệu gì |
|---|---|---|---|
| VC ID | Keycloak (ghim bản 26.x mới nhất ở phiên SSO-00) + PostgreSQL | Máy chủ production riêng (không phải máy 129) | Người dùng (sub, email, tên, ảnh, trạng thái), liên kết Google, nhóm, phiên, nhật ký |
| VC Home | React + antd + Vite, `oidc-client-ts`; phục vụ bằng nginx | Cùng máy VC ID | Không có database; `catalog.json` sinh từ `apps.yaml` lúc build |
| `vc-provisioner` | Node 22, chạy theo lịch (cron trong container) | Cùng máy VC ID | Không lưu gì ngoài log |
| VClinks, VCwiki | Giữ nguyên stack | Giữ nguyên | Thêm `idp_sub` cho user, `sid` cho phiên |

**Ở GĐ A, vì sao VC Home không có backend và không giữ phiên** (từ GĐ B, VC Home có thêm backend "VC Home API" bằng NestJS + MongoDB để giữ VC People và quyền; phần đăng nhập của trang VC Home vẫn như mô tả ở đây): VC Home chỉ hiện danh sách app, không có dữ liệu nhạy cảm. Phiên của VC Home chính là phiên Keycloak; token nằm trong bộ nhớ trình duyệt, tải lại trang thì đăng nhập im lặng lại (Keycloak đã có phiên nên không hỏi gì). Bỏ được database, bảng phiên và endpoint đăng xuất của riêng VC Home. Khi cần số việc chờ trên ô app (mục 14), SPA gọi thẳng endpoint của app bằng access token.

### 3.2 Luồng đăng nhập

```
Trình duyệt              VC Home / App           VC ID (Keycloak)               Google
    │ mở app (chưa phiên)     │                          │                          │
    │────────────────────────►│ tạo state, nonce, PKCE   │                          │
    │◄── 302 /authorize?kc_idp_hint=google ─────────────►│                          │
    │                         │                          │ chưa có phiên chung      │
    │◄──────────────────────── 302 accounts.google.com (hd, select_account) ───────►│
    │                         │                          │◄── id_token Google ──────│
    │                         │                          │ kiểm 2 domain, tạo/gắn   │
    │                         │                          │ user (sub), nhóm app     │
    │                         │                          │ mở phiên chung (sid)     │
    │◄── 302 /callback?code&state ───────────────────────│                          │
    │────────────────────────►│ đổi code (PKCE + secret) │                          │
    │                         │────────────────────────►│ trả id_token (sub, email, │
    │                         │◄─────────────────────────│ name, hd, groups, sid)   │
    │                         │ kiểm chữ ký (JWKS), iss,  │                          │
    │                         │ aud, nonce, domain, nhóm │                          │
    │                         │ tìm/gắn user, tạo phiên   │                          │
    │◄── vào trang đích ──────│ riêng của app             │                          │
```

Lần mở app thứ hai: bước "chưa có phiên chung" được bỏ qua, Keycloak trả `code` ngay, người dùng không thấy gì.

### 3.3 Luồng đăng xuất

```
Người dùng bấm Đăng xuất ở app X
  1. App X thu hồi phiên riêng của mình
  2. App X chuyển trình duyệt tới VC ID /logout?client_id=X&post_logout_redirect_uri=home/da-dang-xuat
  3. VC ID hiện trang xác nhận tiếng Việt "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?" (chỉ khi không có id_token_hint;
     từ VC Home thì không hỏi vì SPA có id_token trong bộ nhớ)
  4. VC ID xoá phiên chung, gửi POST logout_token (JWT có chữ ký, có sid) tới endpoint back-channel của
     mọi app đang có phiên của người này
  5. Mỗi app kiểm logout_token rồi thu hồi phiên theo sid (hoặc theo sub nếu không có sid)
  6. Trình duyệt về home.vcprosperous.com/da-dang-xuat
```

Ghi chú: app **không lưu `id_token`** để làm `id_token_hint` (tránh lưu thêm một loại token, khớp tinh thần CLAUDE.md §12.2 của VClinks). Đổi lại là một trang xác nhận; trang này còn giúp người dùng hiểu rằng họ đăng xuất mọi app.

### 3.4 Luồng khoá tài khoản

| Tình huống | Ai làm | Hệ thống làm | Thời gian mất quyền |
|---|---|---|---|
| Khoá tạm, nghi lộ tài khoản | Admin VC ID | `vc-provisioner disable <email>` (hoặc màn quản trị Keycloak): khoá user + gọi API đăng xuất user → Keycloak gửi back-channel tới mọi app | ≤ 1 phút |
| Nghỉ việc | Admin Google Workspace khoá hoặc xoá tài khoản Google | Job `vc-provisioner` (mỗi 15 phút) thấy `suspended` / không còn → khoá trên VC ID + đăng xuất | ≤ 20 phút |
| Khoá riêng trong một app | Admin app (VClinks: `tam_khoa`, `nghi_viec`; VCwiki: `active=false`) | App tự chặn như hiện nay; không ảnh hưởng app khác | Ngay |

Bàn giao khách khi nghỉ việc (VClinks M1b-11) vẫn là quy trình riêng của VClinks.

## 4. Quyết định và đầu vào cần có trước khi code

### 4.1 Chủ dự án chốt

**Đã chốt ngày 08/10/2026:** người dùng uỷ quyền BA chốt cả 5 câu theo cột "Đề xuất" ([12](../12-cau-hoi-rui-ro.md) mục 4). Cột "Đề xuất" dưới đây là bản chốt.

| Mã | Câu hỏi | Đề xuất |
|---|---|---|
| Q1 | Tên miền của VC ID và VC Home? | `id.vcprosperous.com`, `home.vcprosperous.com`, màn quản trị riêng `id-admin.vcprosperous.com` (chặn ngoài mạng công ty). App giữ tên miền hiện tại. Thiết kế không dựa vào cookie dùng chung giữa các tên miền, nên app ở `tramaphutung.com` vẫn chạy đúng |
| Q2 | Máy chủ production chạy ở đâu? | Một máy ảo **đặt tại Việt Nam** (2 vCPU, 4 GB RAM, 40 GB SSD, Ubuntu 24.04), không đặt trên máy 129. Đặt ở Việt Nam để dữ liệu nhân viên không phải làm hồ sơ chuyển ra nước ngoài theo Luật Bảo vệ dữ liệu cá nhân |
| Q3 | Ai thấy app nào lúc đầu? | Mọi tài khoản cá nhân đủ điều kiện (bật 2 bước, không thuộc danh sách loại trừ; D-BA-37) vào cả VClinks và VCwiki. Ai chưa có vai trò thì app tự báo "đang chờ cấp quyền" như hiện nay |
| Q4 | VCwiki có tự tạo tài khoản ở lần đăng nhập đầu không? | Có, vai trò `member`, chỉ thấy kho công khai; báo admin như VClinks đang làm |
| Q5 | Thời hạn phiên? | Hết hạn sau 12 giờ không dùng, tối đa 7 ngày phải đăng nhập lại (VCwiki giảm từ 14 xuống 7 ngày cho khớp) |

### 4.2 Dev tự chốt theo đề xuất (báo lại một câu)

| Mã | Nội dung | Chọn |
|---|---|---|
| D1 | Bản Keycloak | Bản 26.x mới nhất tại thời điểm SSO-00, ghim đúng số bản trong `compose.yml`; nâng bản theo quý |
| D2 | Cấu hình Keycloak | Dạng code: file YAML realm + công cụ áp `@vc/realm-apply` (áp lại được nhiều lần, có `--dry-run`, không sửa tay trên màn quản trị; D-BA-49) |
| D3 | VC Home giữ phiên? | Không. SPA public client + PKCE, token trong bộ nhớ (`oidc-client-ts`, `InMemoryWebStorage`) |
| D4 | Phạm vi đăng xuất | Đăng xuất một app = đăng xuất mọi app |
| D5 | Khoá người dùng trong app | Theo `sub` của VC ID, không theo email; lần đầu gắn theo email một lần |
| D6 | Thư viện kiểm JWT | VClinks: `jose`; VCwiki: `PyJWT[crypto]` (có sẵn `PyJWKClient`) + `httpx` |
| D7 | Repo | GitLab mới `vc-platform` chứa cấu hình Keycloak, theme, VC Home, `vc-provisioner`, tài liệu |

### 4.3 Đầu vào từ người có quyền

| Mã | Việc | Ai | Hạn | Chặn phiên |
|---|---|---|---|---|
| I1 | Máy chủ production theo Q2, có SSH cho dev | Chủ dự án | 17/10 | SSO-10 |
| I2 | Bản ghi DNS `id.`, `id-admin.`, `home.` trỏ về Cloudflare tunnel của máy I1 | Admin Cloudflare | 17/10 | SSO-10 |
| I3 | OAuth client loại "Web application" trên Google Cloud cho Keycloak; redirect `https://id.vcprosperous.com/realms/vc/broker/google/endpoint` (thêm bản staging); màn đồng ý "Internal" nếu 2 domain cùng một Workspace, "External" nếu là 2 Workspace riêng | Admin Google Workspace (chủ dự án) | 13/10 | SSO-02 |
| I4 | Tài khoản dịch vụ Google có ủy quyền toàn miền, phạm vi `admin.directory.user.readonly`, **cho từng Workspace** | Admin Google Workspace | 20/10 | SSO-04 |
| I5 | Hai người giữ tài khoản quản trị khẩn cấp của VC ID (có TOTP) | Chủ dự án | 17/10 | SSO-10 |
| I6 | Xác nhận `vcpart.vn` là domain phụ trong cùng Workspace với `vcprosperous.com` hay một Workspace riêng | Admin Google Workspace | 10/10 | SSO-00 |
| I7 | Danh sách người dùng VCwiki có email ngoài 2 domain công ty (sẽ mất quyền khi tắt mật khẩu) | Admin VCwiki (dev chạy truy vấn, người duyệt quyết) | 22/10 | SSO-07 |
| I8 | Bật **bắt buộc** xác thực 2 bước trong Google Admin cho cả 2 domain (có thời gian cho người dùng đăng ký, ví dụ 1 tuần) | Admin Google Workspace (chủ dự án) | 24/10 | Lên R1 |
| I9 | Danh sách loại trừ: hộp thư dùng chung, tài khoản dịch vụ, tài khoản thử; rồi duyệt danh sách "ai được vào app" do `vc-provisioner report` sinh ra | Chủ dự án + IT | 24/10 | SSO-07, SSO-10 |

## 5. Thiết kế chi tiết

### 5.1 VC ID (Keycloak)

#### 5.1.1 Realm `vc`

| Thiết lập | Giá trị | Lý do |
|---|---|---|
| Đăng ký, quên mật khẩu, "nhớ tôi" | Tắt | Chỉ đăng nhập qua Google |
| Mật khẩu cục bộ | Không có user nào trong realm `vc` có mật khẩu | Tài khoản khẩn cấp nằm ở realm `master` |
| `ssoSessionIdleTimeout` | 43200 (12 giờ) | Q5, khớp VClinks MH-UI-02 |
| `ssoSessionMaxLifespan` | 604800 (7 ngày) | Q5 |
| `accessTokenLifespan` | 300 (5 phút) | Token ngắn; app chỉ dùng `id_token` lúc đăng nhập |
| Chống dò mật khẩu | Bật | Mặc định an toàn |
| Nhật ký đăng nhập, nhật ký quản trị | Bật, giữ 24 tháng | QĐ-70 của VClinks |
| Ngôn ngữ | `vi` mặc định, `en` phụ | Giao diện tiếng Việt |
| Nhóm mặc định | Không có | D-BA-37: `vc-provisioner` cấp nhóm app theo điều kiện vào app |
| Khoá ký | RS256, xoay vòng mỗi năm (giữ khoá cũ song song 1 tuần) | App lấy khoá qua JWKS nên xoay không cần sửa app |

#### 5.1.2 Nối Google

- Identity provider `google` (loại Google có sẵn), "Trust email" bật, "Sync mode" `FORCE` (đổi tên, ảnh trên Google thì VC ID cập nhật ở lần đăng nhập sau). Áp dụng ở GĐ A. Từ GĐ B, VC People là nguồn sự thật (VH-BR-03): đổi sang chế độ chỉ nhập lần đầu (`IMPORT`) và để VC Home đẩy tên, email, ảnh sang VC ID.
- **Giới hạn domain** (D-BA-50), ba lớp: (1) mục "Hosted domain" khai cả hai domain (còn kiểm với Google thật khi có I3); (2) **bộ lọc claim** của chỗ nối Google: chỉ nhận token có `hd` khớp `^(vcprosperous\.com|vcpart\.vn)$`, chặn trước khi tạo user, hiện câu tiếng Việt ở mục 5.1.6. Kiểm mẫu email ở user profile **không** chặn được (SSO-00: vẫn tạo user); (3) app kiểm lại `hd` và domain email.
- **Danh sách tài khoản:** nối Google đặt `prompt=select_account` để Google luôn hiện danh sách tài khoản. Trang đăng nhập của realm `vc` chuyển thẳng sang Google (bước "Identity Provider Redirector" mặc định `google`), không có form mật khẩu (D-BA-53).
- Mapper `picture`: ảnh Google vào thuộc tính `picture` cho VC Home.
- Mapper của Google: lấy claim `hd` thành thuộc tính user `hd`.
- Luồng "first broker login": bỏ bước "Review profile", tạo user nếu chưa có, không cho gắn với user cục bộ (realm không có user cục bộ). **Từ GĐ C** (quyết định BA khi soát chéo 08/10/2026): VC Home tạo sẵn user trên VC ID ngay khi hồ sơ có hiệu lực (để có `sub` trong `vh.person.joined` và đẩy vai trò trước lần đăng nhập đầu); luồng này đổi sang tự gắn tài khoản Google vào user có sẵn khi trùng email đã xác minh.
- Mọi app gửi `kc_idp_hint=google` để Keycloak chuyển thẳng sang Google, người dùng không thấy trang đăng nhập của Keycloak.

#### 5.1.3 Nhóm

```
/app-vclinks        được vào VClinks (mặc định)
/app-vcwiki         được vào VCwiki (mặc định)
/app-vcsale         (sau) được vào VCsale
/vc-id-admin        quản trị VC ID qua vc-provisioner, không phải quản trị Keycloak
```

**Realm không có nhóm mặc định** (D-BA-37). `vc-provisioner` cấp `/app-vclinks`, `/app-vcwiki` cho tài khoản đủ điều kiện và gỡ khi hết điều kiện (mục 5.6). Thuộc tính user `vc_trang_thai` (`du_dieu_kien` · `chua_bat_2_buoc` · `loai_tru`; trống là chưa xét) do `vc-provisioner` ghi, đưa vào claim cùng tên để VC Home báo đúng lý do (06 VH-MH-02).

Bỏ một người khỏi `/app-vcwiki` → VC Home không hiện ô VCwiki, VCwiki từ chối đăng nhập với mã `app_not_granted` (nếu bật `OIDC_REQUIRE_APP_GROUP`).

#### 5.1.4 Client scope dùng chung `vc-basic`

Gắn mặc định cho mọi client. Claim trong `id_token`:

| Claim | Nguồn | Ví dụ |
|---|---|---|
| `sub` | Keycloak (UUID, không đổi) | `6f1c…` |
| `email`, `email_verified` | Google | `an.nguyen@vcpart.vn`, `true` |
| `name`, `given_name`, `family_name`, `picture` | Google | `Nguyễn Văn An` |
| `hd` | Thuộc tính user `hd` | `vcpart.vn` |
| `groups` | Mapper "Group membership", tắt đường dẫn đầy đủ | `["app-vclinks","app-vcwiki"]` |
| `sid` | Keycloak (mặc định) | `b2a9…` |
| `vc_trang_thai` | Thuộc tính user do `vc-provisioner` ghi | `du_dieu_kien` |

#### 5.1.5 Client

| Client | Loại | Redirect URI | Back-channel logout URL | Ghi chú |
|---|---|---|---|---|
| `vchome` | Public, PKCE S256 bắt buộc | `https://home.vcprosperous.com/callback`, `/silent` | — | Post-logout redirect `https://home.vcprosperous.com/da-dang-xuat` |
| `vclinks` | Confidential (client secret), PKCE S256 bắt buộc | `https://vclink.tramaphutung.com/api/auth/oidc/callback` | `https://vclink.tramaphutung.com/api/auth/backchannel-logout` (yêu cầu `sid`) | Tắt direct access grants, implicit, service account |
| `vcwiki` | Confidential, PKCE S256 bắt buộc | `https://vcwiki.tramaphutung.com/api/auth/oidc/callback` | `https://vcwiki.tramaphutung.com/api/auth/backchannel-logout` (yêu cầu `sid`) | Như trên |
| `vc-provisioner` | Confidential, chỉ service account | — | — | Vai trò `realm-management`: `view-users`, `manage-users`, `query-groups`, `view-events` |
| `*-dev` | Như bản chính | `http://localhost:<cổng>/…` | Theo cổng dev | Chỉ có ở realm của môi trường dev và staging |

Mọi client: tắt "Consent required", tắt "Full scope allowed", chỉ khai đúng redirect URI (không dùng `*`). Riêng `vc-provisioner` bật "Full scope allowed" và scope `roles` để token máy mang 4 vai trò đã cấp (thiếu thì Admin API trả 403; D-BA-54).

#### 5.1.6 Theme `vc`

Người dùng chỉ thấy vài trang của Keycloak; viết `messages_vi.properties` và chỉnh giao diện cho đúng các trang này:

| Trang | Khi nào hiện | Nội dung tiếng Việt |
|---|---|---|
| Xác nhận đăng xuất | Đăng xuất từ app (không có `id_token_hint`) | "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?" · nút "Đăng xuất" |
| Đã đăng xuất | Không có `post_logout_redirect_uri` | "Bạn đã đăng xuất." · link về VC Home |
| Sai domain | Tài khoản Google ngoài 2 domain | "Tài khoản này không thuộc công ty. Hãy chọn tài khoản @vcprosperous.com hoặc @vcpart.vn." · nút "Chọn tài khoản khác" |
| Tài khoản bị khoá | User bị khoá trên VC ID | "Tài khoản đã bị khoá. Liên hệ quản trị viên." |
| Lỗi chung | Lỗi khác | Mã lỗi ngắn + thời gian để báo dev |

#### 5.1.7 Cấu hình dạng code (phác thảo, tên khoá chính xác chốt ở SSO-00)

```yaml
# vc-platform/keycloak/realm/vc.yaml — áp bằng @vc/realm-apply, biến lấy từ môi trường (bản đầy đủ nằm trong repo)
realm: vc
displayName: VC Phồn Vinh
enabled: true
registrationAllowed: false
resetPasswordAllowed: false
rememberMe: false
ssoSessionIdleTimeout: 43200
ssoSessionMaxLifespan: 604800
accessTokenLifespan: 300
bruteForceProtected: true
eventsEnabled: true
adminEventsEnabled: true
internationalizationEnabled: true
supportedLocales: [vi, en]
defaultLocale: vi
loginTheme: vc
# Không có defaultGroups (D-BA-37): vc-provisioner cấp /app-vclinks, /app-vcwiki theo điều kiện vào app
groups:
  - name: app-vclinks
  - name: app-vcwiki
  - name: vc-id-admin
identityProviders:
  - alias: google
    providerId: google
    enabled: true
    trustEmail: true
    firstBrokerLoginFlowAlias: vc first broker login
    config:
      clientId: $(env:GOOGLE_CLIENT_ID)
      clientSecret: $(env:GOOGLE_CLIENT_SECRET)
      hostedDomain: vcprosperous.com,vcpart.vn   # kiểm ở SSO-00
      syncMode: FORCE
clientScopes:
  - name: vc-basic
    protocol: openid-connect
    protocolMappers:
      - name: groups
        protocolMapper: oidc-group-membership-mapper
        config: { claim.name: groups, full.path: "false", id.token.claim: "true", access.token.claim: "true", userinfo.token.claim: "true" }
      - name: hd
        protocolMapper: oidc-usermodel-attribute-mapper
        config: { user.attribute: hd, claim.name: hd, id.token.claim: "true", access.token.claim: "true" }
defaultDefaultClientScopes: [profile, email, vc-basic]
clients:
  - clientId: vclinks
    publicClient: false
    secret: $(env:VCLINKS_CLIENT_SECRET)
    standardFlowEnabled: true
    directAccessGrantsEnabled: false
    implicitFlowEnabled: false
    fullScopeAllowed: false
    redirectUris: [$(env:VCLINKS_BASE)/api/auth/oidc/callback]
    attributes:
      pkce.code.challenge.method: S256
      post.logout.redirect.uris: $(env:HOME_BASE)/da-dang-xuat
      backchannel.logout.url: $(env:VCLINKS_BASE)/api/auth/backchannel-logout
      backchannel.logout.session.required: "true"
  # vcwiki, vchome, vc-provisioner: tương tự
```

### 5.2 Hợp đồng tích hợp app

Mọi app (cả app sau này) phải đạt 8 điều sau mới được thêm vào danh mục VC Home:

1. **App khách OIDC:** luồng Authorization Code + PKCE S256, đổi `code` ở server (confidential client). Đọc cấu hình từ `{issuer}/.well-known/openid-configuration`, cache 1 giờ.
2. **Kiểm `id_token` đủ 6 điểm:** chữ ký qua JWKS (cache khoá, tải lại khi gặp `kid` lạ), `iss` = issuer, `aud` chứa client id, `exp` còn hạn (lệch đồng hồ ≤ 60 giây), `nonce` khớp, `email_verified = true`.
3. **Kiểm domain lần nữa:** đuôi email thuộc `COMPANY_DOMAINS`, và `hd` (nếu có) thuộc `COMPANY_DOMAINS`.
4. **Khoá người dùng theo `sub`:** tìm theo `idp_sub`; không thấy thì tìm theo email và gắn `idp_sub` **một lần** (ghi nhật ký `user.idp_linked`); user đã có `idp_sub` khác thì từ chối mã `identity_conflict` và báo admin. Mỗi lần đăng nhập cập nhật tên, email, nhóm từ claim.
5. **Kiểm nhóm app:** khi bật `OIDC_REQUIRE_APP_GROUP=1`, thiếu nhóm `app-<key>` trong `groups` thì từ chối mã `app_not_granted`.
6. **Phiên riêng của app** lưu kèm `sid` và `idp_sub`; hết hạn sau 12 giờ không dùng và tối đa 7 ngày (VH-AUT-05).
7. **Endpoint back-channel** `POST /api/auth/backchannel-logout`, body `application/x-www-form-urlencoded` với `logout_token`. Kiểm: chữ ký JWKS, `iss`, `aud`, `iat` trong 5 phút, có claim `events` chứa `http://schemas.openid.net/event/backchannel-logout`, **không có** `nonce`, có `sid` hoặc `sub`, `jti` chưa dùng (lưu 10 phút để chống gửi lại). Đạt → thu hồi phiên theo `sid` (không có `sid` thì theo `sub`), trả `200` với `Cache-Control: no-store`; không đạt → `400`.
8. **Đăng xuất:** thu hồi phiên riêng rồi chuyển trình duyệt tới `{issuer}/protocol/openid-connect/logout?client_id=<app>&post_logout_redirect_uri=<home>/da-dang-xuat`.

Không bắt buộc ở đợt này: endpoint `GET /api/vc-app/status` (trạng thái quyền và số việc chờ cho ô app, mục 14).

**Mã lỗi đăng nhập dùng chung** (mỗi app tự đổi sang câu tiếng Việt của mình):

| Mã | Nghĩa |
|---|---|
| `outside_domain` | Email ngoài 2 domain công ty |
| `app_not_granted` | Không thuộc nhóm app |
| `not_granted` | App không cho tự tạo tài khoản và chưa có tài khoản |
| `locked` | Bị khoá trong app |
| `identity_conflict` | Email đã gắn với một định danh khác |
| `state_invalid` | Hết hạn hoặc mở lại link cũ |
| `idp_unreachable` | VC ID hoặc Google không trả lời |
| `cancelled` | Người dùng huỷ ở Google |

**Danh mục app `catalog.json`** (công khai, không có dữ liệu cá nhân; sinh từ `vc-platform/home/apps.yaml`):

```json
{
  "version": 1,
  "apps": [
    { "key": "vclinks", "name": "VClinks", "description": "Chăm sóc khách hàng đa kênh",
      "url": "https://vclink.tramaphutung.com/", "icon": "/icons/vclinks.svg",
      "group": "app-vclinks", "status": "live", "order": 10 },
    { "key": "vcwiki", "name": "VCwiki", "description": "Kho tri thức, học tập, Content Engine",
      "url": "https://vcwiki.tramaphutung.com/", "icon": "/icons/vcwiki.svg",
      "group": "app-vcwiki", "status": "live", "order": 20 },
    { "key": "vcsale", "name": "VCsale", "description": "Bán hàng, kho, công nợ",
      "url": null, "icon": "/icons/vcsale.svg", "group": "app-vcsale", "status": "coming_soon", "order": 30 }
  ]
}
```

### 5.3 VC Home

| Đường dẫn | Màn | Nội dung |
|---|---|---|
| `/` | Lưới app | Lời chào, ô app theo `groups` (ô `coming_soon` hiện mờ cho mọi người); bấm ô mở app trong cùng tab; ô có biểu tượng, tên, mô tả một dòng |
| `/callback`, `/silent` | (không giao diện) | Nhận `code`, đổi token bằng PKCE; `silent` dùng khi tải lại trang (`prompt=none`) |
| `/ho-so` | Hồ sơ | Ảnh, tên, email, domain, danh sách app được dùng; dòng "Thông tin lấy từ Google Workspace, sửa ở Google" (GĐ A; từ GĐ B lấy từ VC People, đề nghị sửa gửi HC-NS qua VH-NSU-06) |
| `/da-dang-xuat` | Đã đăng xuất | "Bạn đã đăng xuất khỏi mọi ứng dụng" · nút "Đăng nhập lại" |
| `/loi` | Lỗi | Theo mã lỗi ở mục 5.2; có nút thử lại và email hỗ trợ |
| `/catalog.json` | (dữ liệu) | Phục vụ với `Access-Control-Allow-Origin: *`, `Cache-Control: max-age=300` |

Header: logo VC Phồn Vinh · menu ảnh đại diện (Hồ sơ, Đăng xuất). Trạng thái rỗng: "Bạn chưa được cấp ứng dụng nào. Liên hệ quản trị viên." Nếu claim `vc_trang_thai` là `chua_bat_2_buoc`, `loai_tru` hoặc trống thì hiện câu riêng theo 06 VH-MH-02. Giao diện dùng token màu và component antd giống VClinks; chạy tốt trên điện thoại (lưới 1 cột dưới 600 px).

Cấu hình `oidc-client-ts`: `authority = https://id.vcprosperous.com/realms/vc`, `client_id = vchome`, `response_type = code`, `scope = openid profile email`, `extraQueryParams = { kc_idp_hint: 'google' }`, `userStore = InMemoryWebStorage`, `automaticSilentRenew = false`. Đăng xuất gọi `signoutRedirect()` (có `id_token_hint` nên không hiện trang xác nhận). Cấu hình chạy đọc từ `/config.json` do container ghi lúc khởi động (một ảnh cho staging và production).

Phiên (D-BA-52): tải lại trang thì đăng nhập im lặng (`prompt=none`). Gia hạn token và kiểm phiên mỗi 60 giây **chỉ khi tab đang hiện và người dùng có thao tác trong 30 phút gần nhất** (VH-AUT-05; tab bỏ quên không giữ phiên chung sống mãi). VC Home không có back-channel nên dùng hai đường: iframe kiểm phiên OIDC thấy đăng xuất ở app khác trong vài giây (UAT-SSO-07); khoá do quản trị trên máy chủ thì lượt kiểm 60 giây sau làm VC Home về trang "Phiên đăng nhập đã hết hạn" (UAT-SSO-09).

"Chọn tài khoản khác" (trang lỗi `outside_domain`, D-BA-53): nếu đang có phiên VC ID thì đăng xuất phiên đó (không hỏi lại) rồi sang Google; không có phiên thì sang Google với `prompt=login`.

Header bảo mật của nginx: `Content-Security-Policy` chỉ cho `self` và `id.vcprosperous.com` (`style-src` thêm `'unsafe-inline'` vì antd chèn CSS lúc chạy; ảnh thêm `*.googleusercontent.com`), `Strict-Transport-Security`, `X-Frame-Options: DENY` và `frame-ancestors 'none'` (riêng `/silent`: `SAMEORIGIN` vì nằm trong iframe của chính VC Home), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`. Kiểm ở e2e: không có vi phạm CSP, không lỗi truy cập nghiêm trọng (axe); Lighthouse trên điện thoại: truy cập 100.

### 5.4 VClinks: thay đổi theo file

Làm **sau 26/10**, sau cờ `AUTH_PROVIDER=google|oidc` (mặc định `google` cho tới khi UAT đạt).

| File | Thay đổi |
|---|---|
| `apps/api/package.json` | Thêm `jose`. Nếu Node trên máy chạy < 20.19 (chưa `require` được ESM) thì ghim `jose@5` (có bản CommonJS); kiểm ở SSO-00 |
| `apps/api/src/auth/oidc.client.ts` (mới) | Lớp mỏng giống `google.client.ts`: `discover()` (cache 1 giờ), `authUrl({state, nonce, codeChallenge, redirectUri, loginHint})` thêm `kc_idp_hint`, `exchange(code, verifier, redirectUri)`, `verifyIdToken(token, nonce)`, `verifyLogoutToken(token)`; dùng `createRemoteJWKSet` + `jwtVerify` của `jose`; ném `IdpUnreachableError` khi mạng lỗi |
| `apps/api/src/auth/auth.service.ts` | `startLogin` lưu thêm `codeVerifier`, `nonce` vào `auth_states`; `handleCallback` rẽ nhánh theo `AUTH_PROVIDER`; nhánh OIDC: kiểm 6 điểm + domain + nhóm (mục 5.2 điểm 2, 3, 5), tìm user theo `idpSub` rồi email (điểm 4), giữ nguyên tự tạo user và chặn `tam_khoa` / `nghi_viec`, ghi `audit` (`login`, `login_denied` kèm lý do, `user.idp_linked`) |
| `apps/api/src/auth/auth.controller.ts` | Thêm `GET /auth/oidc`, `GET /auth/oidc/callback` (cùng cách trả `#session=` như hiện nay), `POST /auth/backchannel-logout` (`@Public`); `GET /auth/config` trả thêm `provider`, `homeUrl`, `logoutUrl`; `POST /auth/logout` trả thêm `redirect` (URL đăng xuất VC ID) khi `provider=oidc` |
| `apps/api/src/auth/session.service.ts` | `SessionDoc` thêm `sid?`, `idpSub?`; `create()` nhận thêm hai trường; thêm `revokeBySid(sid)`, `revokeByIdpSub(sub)` (xoá cache như `revokeUser`); thêm hạn tối đa 7 ngày (`SESSION_MAX_MS`) trong `verify()` |
| `apps/api/src/users/users.service.ts` | `UserDoc` thêm `idpSub?`, `idpGroups?`; thêm `findByIdpSub()`, `linkIdpSub()` (chỉ gắn khi đang trống, trả xung đột nếu khác), `syncFromIdp()` (tên, email, nhóm) |
| `apps/api/src/db/db.service.ts` | Index: `users` `{tenant_id, idpSub}` unique có điều kiện `idpSub` tồn tại; `sessions` `{sid: 1}`; collection mới `auth_logout_jti` có TTL 10 phút |
| `apps/api/src/app.factory.ts` | Thêm `urlencoded({ extended: false, limit: '16kb' })` **chỉ cho** đường `/api/auth/backchannel-logout` |
| `apps/api/src/platform/` (mới) | `GET /api/platform/apps`: tải `catalog.json` của VC Home (cache 5 phút, lỗi thì dùng bản cache cũ), lọc theo `idpGroups` của user |
| `packages/shared` | Thêm mã lỗi `app_not_granted`, `identity_conflict`, `idp_unreachable`; kiểu `AuthProvider`, `CatalogApp` |
| `apps/web/src/pages/LoginPage.tsx` | Nút "Đăng nhập bằng tài khoản công ty"; khi `provider=oidc` và không có lỗi thì tự chuyển sang VC ID (người dùng không phải bấm); thêm câu tiếng Việt cho mã lỗi mới (cập nhật đặc tả 00 MH-UI-02) |
| `apps/web/src/api.ts` | `logout()`: sau khi server thu hồi phiên, nếu có `redirect` thì chuyển trình duyệt tới đó |
| `apps/web/src/components/AppSwitcher.tsx` (mới) | Nút 9 chấm ở header (antd `Dropdown`), đọc `/api/platform/apps`, mục đầu "VC Home" |
| `.env.example` | `AUTH_PROVIDER`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_IDP_HINT=google`, `OIDC_REQUIRE_APP_GROUP=1` (bật ngay từ ngày bật SSO, D-BA-37), `VC_HOME_URL` |

Không đổi: token `vcz_`, `/mcp`, `/mcp/dev`, ingest, webhook, outbox, agent máy Zalo, `AUTH_TOKEN_LOGIN` (đăng nhập bằng token nội bộ, giữ làm đường khẩn cấp; **phải đặt rõ `AUTH_TOKEN_LOGIN=0` ở production**, vì trong code giá trị mặc định đang bật và `.env.example` đặt `1`).

Phác thảo kiểm `logout_token`:

```ts
// apps/api/src/auth/oidc.client.ts (phác thảo)
async verifyLogoutToken(token: string): Promise<{ sid?: string; sub?: string; jti: string }> {
  const { issuer, jwks } = await this.discover();
  const { payload } = await jwtVerify(token, jwks, { issuer, audience: this.clientId, clockTolerance: 60 });
  const events = payload.events as Record<string, unknown> | undefined;
  if (!events || !('http://schemas.openid.net/event/backchannel-logout' in events)) throw new Error('events');
  if ('nonce' in payload) throw new Error('nonce');
  if (!payload.jti || (!payload.sid && !payload.sub)) throw new Error('claims');
  if (!payload.iat || Date.now() / 1000 - payload.iat > 300) throw new Error('iat');
  return { sid: payload.sid as string | undefined, sub: payload.sub, jti: payload.jti };
}
```

### 5.5 VCwiki: thay đổi theo file

Đi đúng quy trình của repo: **BA → DESIGN → Code → UAT**.

- **BA:** mã mới **SYS-43** "Đăng nhập một lần qua VC ID".
  - Sửa mục 2: dòng "Đăng nhập Google Workspace / SSO" đổi thành "Đã chốt, SYS-43".
  - Sửa mục 12 câu 4: câu trả lời mới, giữ câu cũ gạch ngang.
  - Sửa mục 1.4 kiến trúc.
- **DESIGN:**
  - Một mục theo mẫu Phần 0 mục 0.6.
  - Mã TK lấy số kế tiếp còn trống **sau khi đối chiếu** với file chuẩn hoá VC Marketing (đang giữ TK-18 đến TK-34), đề xuất **TK-35**.
  - Mã màn hình cho trang đăng nhập lấy số SCR kế tiếp.
- **Commit:** ghi `SYS-43 TK-35: …`.

| File | Thay đổi |
|---|---|
| `backend/requirements.txt` | Thêm `PyJWT[crypto]>=2.9`, `httpx>=0.27` |
| `backend/app/config.py` | `AUTH_SSO` (bật/tắt), `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_IDP_HINT`, `OIDC_REQUIRE_APP_GROUP`, `AUTH_PASSWORD_LOGIN` (`on` / `admin` / `off`), `AUTH_SELF_SIGNUP`, `COMPANY_DOMAINS`, `PUBLIC_BASE_URL`, `VC_HOME_URL`, `SESSION_DAYS=7`, `COOKIE_SECURE` |
| `backend/app/oidc.py` (mới) | `discover()`, `auth_url()`, `exchange()`, `verify_id_token()`, `verify_logout_token()` bằng `httpx` + `PyJWKClient` |
| `backend/app/auth.py` | Route `GET /auth/oidc/start`, `GET /auth/oidc/callback`, `POST /auth/backchannel-logout`, `GET /auth/config`; collection `auth_states` (TTL 10 phút) và `auth_logout_jti` (TTL 10 phút); `users` thêm `idp_sub` (unique, chỉ khi có), `idp_groups`, `last_login_via`; tìm và gắn user như mục 5.2 điểm 4; tự tạo `member` khi `AUTH_SELF_SIGNUP` (Q4); `sessions` thêm `sid`, `idp_sub`, **lưu băm sha256 của token thay token gốc**; `start_session` đặt `secure=COOKIE_SECURE`, `max_age` theo `SESSION_DAYS`; `login` (mật khẩu) theo `AUTH_PASSWORD_LOGIN`; `setup` đóng khi `AUTH_SSO` bật và đã có user |
| `backend/app/main.py` | Không đổi thứ tự router; thêm origin VC Home vào CORS chỉ nếu cần (thiết kế hiện tại không cần) |
| `backend/app/platform.py` (mới) | `GET /platform/apps` như VClinks |
| `frontend/src/pages/Login.jsx` | Nút SSO là chính; form mật khẩu chỉ hiện khi `passwordLogin` khác `off` (chế độ `admin` ghi rõ "Chỉ dành cho quản trị khi khẩn cấp"); tự chuyển sang VC ID như VClinks; câu lỗi theo mã |
| `frontend/src/api.js`, header trong `App.jsx` | Đăng xuất chuyển tới URL đăng xuất VC ID; nút 9 chấm đọc `/api/platform/apps` |
| `backend/tests/test_dang_nhap_sso.py` (mới) | `state` một lần và hết hạn; `nonce` sai; chữ ký sai; `aud` sai; domain ngoài; thiếu nhóm; gắn user cũ theo email; xung đột `idp_sub`; tự tạo `member`; user `active=false` |
| `backend/tests/test_backchannel_logout.py` (mới) | Token hợp lệ thu hồi đúng `sid`; thiếu `events`; có `nonce`; `jti` gửi lại; `iat` quá cũ; chỉ có `sub` |
| `backend/tests/test_dang_nhap_gan_nhat.py` | Cập nhật SYS-36: ghi lần đăng nhập cho cả đường SSO |

**Chuyển phiên cũ:** băm token phiên làm mọi phiên đang có hết hiệu lực một lần, nên mọi người phải đăng nhập lại một lần vào ngày bật. Báo trước trong thông báo phát hành.

### 5.6 `vc-provisioner`

- **Chạy mỗi 15 phút** (D-BA-40), cộng một lệnh tay. Khoá theo Google vì vậy ≤ 20 phút.
- Với **mỗi Workspace** (I4, I6): đọc danh sách user (Directory API, `admin.directory.user.readonly`), gồm cả `suspended`, `archived` và trường `isEnrolledIn2Sv`.
- Đọc danh sách loại trừ `provisioner/loai-tru.yaml` (GĐ A–B; từ GĐ B chuyển sang collection `directory_exclusions` của VC Home API). Mỗi dòng: email, loại (`hop_thu_chung` · `dich_vu` · `thu` · `chua_ro_chu`), lý do, người thêm.
- **Điều kiện vào app ở GĐ A–B** (VH-BR-26): tài khoản đang hoạt động trên Google **và** đã bật 2 bước **và** không thuộc danh sách loại trừ.
- Đối chiếu với user của realm `vc` (Admin API, client `vc-provisioner`):

| Trường hợp | Làm gì |
|---|---|
| Đủ điều kiện, VC ID chưa có user | **Tạo sẵn user** (email, tên, ảnh) và gắn liên kết `google` với `userId` = `id` của Directory (chính là `sub` của Google, kiểm ở SSO-00); cấp nhóm app mặc định; `vc_trang_thai = du_dieu_kien`. Lần đăng nhập đầu vào thẳng, có ngay ô app |
| Đủ điều kiện, VC ID đã có user | Bảo đảm có nhóm app mặc định; `vc_trang_thai = du_dieu_kien` |
| Chưa bật 2 bước, hoặc thuộc danh sách loại trừ | Gỡ nhóm app mặc định, gọi đăng xuất user; `vc_trang_thai = chua_bat_2_buoc` hoặc `loai_tru`. Không khoá user: vẫn vào được VC Home để đọc lý do |
| Có trên VC ID, trên Google bị `suspended` / `archived` / đã xoá | Khoá user trên VC ID, gọi `POST /admin/realms/vc/users/{id}/logout` (Keycloak gửi back-channel tới mọi app), ghi log, gửi thông báo cho nhóm `vc-id-admin` |
| Có trên VC ID đang khoá, trên Google hoạt động lại | **Không tự mở**; chỉ báo admin (mở khoá là quyết định của người) |
| User do đăng nhập lần đầu tự tạo (tài khoản không đủ điều kiện) | Xét ở lượt chạy kế tiếp như các dòng trên |

- Nhóm app khác (không phải mặc định, ví dụ `/app-vcsale`) do người cấp; `vc-provisioner` không đụng tới, trừ khi khoá user.
- Lệnh tay:
  - `vc-provisioner disable <email> --reason "…"`, `vc-provisioner enable <email>`: khoá tức thời và mở khoá.
  - `vc-provisioner report`: danh sách lệch, và danh sách **"ai được vào app"** chia theo trạng thái để chủ dự án duyệt trước R1 (I9).
  - `vc-provisioner sync`: chạy ngay một lượt (dùng khi có người mới).
- Chế độ `--dry-run` là mặc định trong tuần đầu.
- An toàn: nếu Google trả lỗi hoặc danh sách rỗng bất thường (ít hơn 50% lần trước) thì **dừng, không khoá ai, không gỡ nhóm của ai**, và báo admin. Một lượt gỡ nhóm của hơn 20 người cũng dừng và chờ admin xác nhận (khớp VH-BR-25).
- Từ GĐ C, điều kiện "đủ điều kiện" chuyển sang VC Home API (có hồ sơ "Đang làm"); `vc-provisioner` chỉ còn việc đối chiếu trạng thái Google (kế hoạch code GĐ C).

### 5.7 Bảo mật

| Hạng mục | Cách làm |
|---|---|
| Truyền tải | HTTPS mọi nơi qua Cloudflare; HSTS; Keycloak `KC_PROXY_HEADERS=xforwarded`, `KC_HOSTNAME` đúng tên miền |
| Màn quản trị Keycloak | Tách tên miền `id-admin.vcprosperous.com` (`KC_HOSTNAME_ADMIN`), chặn bằng Cloudflare Access hoặc danh sách IP văn phòng; tên miền công khai không mở `/admin`: nginx "edge" trước Keycloak chỉ mở `/realms/`, `/resources/` ở `id.` và chặn realm `master` (D-BA-51) |
| Tài khoản khẩn cấp | Hai admin realm `master` có mật khẩu dài + TOTP, cất offline (I5); dùng khi Google sập hoặc cấu hình Google hỏng |
| Bí mật | Client secret, mật khẩu PostgreSQL, khoá Google chỉ nằm trong file `.env` trên máy chủ (quyền 600) hoặc kho bí mật; **không vào git** (bài học lộ khoá ở vccar-service); có `.env.example`; quét bí mật trong CI của `vc-platform` |
| Xoay khoá | Client secret xoay 6 tháng một lần; khoá ký realm xoay mỗi năm |
| Luồng OIDC | `state` một lần, `nonce`, PKCE S256, redirect URI chính xác, `next` chỉ nhận đường dẫn cùng app (VClinks đã có `safeNext`) |
| Token | `id_token` chỉ dùng lúc đăng nhập rồi bỏ; app không lưu `id_token`, access token, refresh token; log không chứa token hay `code` |
| Chống gửi lại | `jti` của `logout_token` lưu 10 phút |
| Xác thực 2 bước | Bắt buộc trong Google Admin cho cả 2 domain (I8), là **điều kiện lên R1**; tài khoản chưa bật không có nhóm app (mục 5.6). Xác thực lại khi dùng vai trò nhạy cảm: mục 14 |
| Tài khoản dùng chung | Không vào app nghiệp vụ (VH-BR-26); nằm trong danh sách loại trừ |
| Dữ liệu cá nhân | VC ID chỉ giữ email, tên, ảnh, `hd`, nhóm; máy chủ đặt tại Việt Nam (Q2); nhật ký giữ 24 tháng |
| Cookie | VCwiki: `HttpOnly`, `Secure`, `SameSite=Lax`, giữ tên `vc_session`. VClinks giữ token Bearer như hiện nay; chuyển sang cookie httpOnly là việc để sau (mục 14) |

## 6. Repo mới `vc-platform`

```
vc-platform/
├─ README.md                    tóm tắt, cách chạy dev, link tài liệu
├─ compose.yml                  production: postgres, keycloak, edge (nginx trước Keycloak), home (nginx), provisioner, realm-apply, backup, cloudflared
├─ compose.dev.yml              dev: postgres + keycloak + config-cli, client *-dev trỏ localhost
├─ .env.example
├─ keycloak/
│  ├─ realm/vc.yaml             cấu hình realm dạng code (mục 5.1.7)
│  ├─ realm/vc.dev.yaml         phần khác của môi trường dev
│  ├─ themes/vc/login/          template + messages_vi.properties + css
│  └─ Dockerfile                bản ghim + `kc.sh build` (bật health, metrics, postgres)
├─ home/                        VC Home: React + antd + Vite + oidc-client-ts
├─ api/                         (từ GĐ B) VC Home API: NestJS + MongoDB, VC People, quyền, sự kiện — xem ../05-du-lieu.md, ../07-tich-hop.md
│  ├─ apps.yaml                 nguồn của catalog.json
│  ├─ scripts/build-catalog.ts  kiểm schema (zod) rồi sinh public/catalog.json
│  ├─ src/
│  └─ nginx.conf                header bảo mật, cache catalog.json
├─ provisioner/                 Node 22 + TypeScript
│  ├─ src/google.ts             Directory API theo từng Workspace
│  ├─ src/keycloak.ts           Admin API (client credentials)
│  ├─ src/sync.ts               quy tắc ở mục 5.6
│  └─ src/cli.ts                disable / enable / report / sync --dry-run
├─ backup/                      pg_dump hằng đêm, đẩy bản sao ra ngoài máy, script khôi phục
└─ docs/
   ├─ ke-hoach-sso-keycloak.md  bản này (chuyển từ repo vc)
   ├─ hop-dong-tich-hop-app.md  mục 5.2 tách riêng cho đội các app sau
   └─ van-hanh.md               sổ tay mục 11
```

Quy ước tài liệu: theo CLAUDE.md §13 của VClinks (tóm tắt → mục lục → lịch sử có ngày giờ).

## 7. Môi trường và triển khai

| Môi trường | Ở đâu | Keycloak | Dùng cho |
|---|---|---|---|
| Dev | Máy dev (`docker compose -f compose.dev.yml up`) | `http://localhost:8180`, realm `vc` với client `*-dev` | Code VC Home, VClinks, VCwiki trên localhost |
| Staging | Máy 129 (chỉ để thử) | `https://id-staging.tramaphutung.com` | UAT với bản chạy thử của VClinks, VCwiki trên máy 129 |
| Production | Máy I1 | `https://id.vcprosperous.com` | Người dùng thật |

**Cấu hình Keycloak production** (biến môi trường):

```
KC_DB=postgres  KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak
KC_HOSTNAME=https://id.vcprosperous.com  KC_HOSTNAME_ADMIN=https://id-admin.vcprosperous.com
KC_PROXY_HEADERS=xforwarded  KC_HTTP_ENABLED=true
KC_HEALTH_ENABLED=true  KC_METRICS_ENABLED=true
JAVA_OPTS_KC_HEAP=-Xms512m -Xmx1024m
```

Chạy `start --optimized` sau bước `kc.sh build` trong Dockerfile.

**Sao lưu:**
- `pg_dump` hằng đêm (database `keycloak`), giữ 14 bản ngày và 6 bản tháng.
- Đẩy một bản ra ngoài máy (bộ lưu trữ S3 tương thích hoặc Google Drive công ty).
- Mỗi tháng khôi phục thử một lần lên staging.

**Thứ tự lên production:**
1. Máy I1 + DNS I2.
2. `compose up` PostgreSQL + Keycloak + edge; `docker compose run --rm realm-apply` áp `vc.yaml` (xem trước bằng `--dry-run`).
3. Kiểm `/health/ready` ở cổng quản lý 9000.
4. Một admin đăng nhập thử bằng Google.
5. VC Home.
6. `vc-provisioner` chạy `--dry-run` 1 tuần.
7. VCwiki bật `AUTH_SSO`.
8. Sau 26/10, VClinks bật `AUTH_PROVIDER=oidc`.

## 8. Kế hoạch theo phiên

Mỗi phiên có Đầu vào, Việc, Đầu ra, Xong khi. Model theo CLAUDE.md §15.7 của VClinks: Opus cho phiên đụng bảo mật, Sonnet cho phần còn lại.

| Phiên | Việc | Đầu vào | Đầu ra / Xong khi | Giờ | Model |
|---|---|---|---|---:|---|
| **SSO-00** Thử kỹ thuật | Chạy Keycloak bản mới nhất trên máy dev. Kiểm: (1) Google IdP nhận 2 hosted domain; (2) `kc_idp_hint` bỏ qua trang Keycloak; (3) claim `groups`, `hd`, `sid`; (4) back-channel gửi tới một endpoint thử; (5) `jose` build được trong `apps/api` của VClinks với Node trên máy 129; (6) `PyJWKClient` trong VCwiki; (7) mapper `vh_roles` kiểu JSON theo từng client chạy được trên bản đã ghim (không được thì dùng mapper kịch bản, hoặc app đọc vai trò qua VH-API-06 của [07](../07-tich-hop.md)); (8) tạo sẵn user có liên kết `google` bằng `id` của Directory API rồi đăng nhập Google vào thẳng user đó (nếu không được: `vc-provisioner` cấp nhóm theo email sau lần đăng nhập đầu, người mới chờ tối đa 15 phút) | I3 (client Google thử), I6 | Ghi chú thử nghiệm trong `vc-platform/docs`; số bản ghim; tên khoá cấu hình chính xác cho `vc.yaml` | 3 | Opus |
| **SSO-01** Hạ tầng | Repo `vc-platform`; `compose.dev.yml`, `compose.yml`, Dockerfile Keycloak, `.env.example`, script sao lưu và khôi phục | SSO-00 | `docker compose up` trên máy dev chạy Keycloak + PostgreSQL; sao lưu và khôi phục thử thành công | 6 | Sonnet |
| **SSO-02** Realm và theme | `vc.yaml` đủ mục 5.1 (không có nhóm mặc định, mapper `vc_trang_thai`); theme `vc` với 5 trang mục 5.1.6; client `*-dev` | SSO-01, I3 | Áp `vc.yaml` hai lần không lỗi (áp lại được); đăng nhập Google domain công ty được, Gmail cá nhân bị chặn với câu tiếng Việt | 6 | Opus |
| **SSO-03** VC Home | SPA mục 5.3; 3 câu trạng thái theo `vc_trang_thai`; `apps.yaml` → `catalog.json` có kiểm schema; nginx | SSO-02 | Đăng nhập, lưới 2 app, hồ sơ, đăng xuất, tải lại trang không phải đăng nhập lại; Lighthouse truy cập ≥ 90 trên điện thoại | 7 | Sonnet |
| **SSO-04** `vc-provisioner` | Mục 5.6: khoá theo Google, điều kiện vào app (2 bước, danh sách loại trừ), tạo sẵn user, cấp và gỡ nhóm, chạy mỗi 15 phút; test với Google và Keycloak giả | SSO-02, I4, I9 | `report` và `sync --dry-run` đúng trên dữ liệu thật; danh sách "ai được vào app" gửi chủ dự án; khoá thử một tài khoản test thì app thử nhận back-channel | 8 | Opus |
| **SSO-05** VCwiki BA + DESIGN | SYS-43, TK-35, mã SCR, ca UAT | Bản kế hoạch này | Người duyệt VCwiki duyệt BA và DESIGN | 2 | Sonnet |
| **SSO-06** VCwiki code | Mục 5.5 | SSO-02, SSO-05 | Test mới xanh, test cũ xanh; trên staging: đăng nhập SSO, gắn đúng user cũ, back-channel thu hồi phiên | 8 | Opus |
| **SSO-07** VCwiki chuyển | Bật `AUTH_SSO` trên production với `AUTH_PASSWORD_LOGIN=on`; theo dõi 2 tuần; rồi đổi sang `admin` | SSO-06, SSO-10, I7 | Mọi người dùng thường đã đăng nhập ít nhất 1 lần bằng SSO; danh sách I7 đã xử lý | 3 | Sonnet |
| **SSO-08** VClinks code | Mục 5.4 (sau 26/10) | SSO-02, mốc M1 xong | `pnpm ci:local` xanh; e2e mới: đăng nhập OIDC với issuer giả (server test sinh khoá bằng `jose`), back-channel, xung đột `idpSub`, thiếu nhóm | 8 | Opus |
| **SSO-09** VClinks giao diện | LoginPage, thanh chuyển app, đăng xuất, câu lỗi MH-UI-02 | SSO-08 | Thử tay trên staging với tài khoản thử theo vai trò | 3 | Sonnet |
| **SSO-10** Production | Lên production theo mục 7; giám sát; sổ tay vận hành | I1, I2, I5, SSO-03, SSO-04 | Health xanh; cảnh báo thử gửi được; khôi phục thử đạt | 5 | Sonnet |
| **SSO-11** UAT tổng | Chạy 23 ca mục 9.2 với người dùng thật (NVKD, CSKH, biên tập VCwiki, admin) | SSO-07, SSO-09 | 23/23 ca đạt; biên bản UAT trong `vc-platform/docs/uat/<ngày>/` | 4 | Sonnet |
| **SSO-12** Dọn | Bỏ nhánh Google trực tiếp ở VClinks (`google.client.ts`) sau 2 tuần ổn định; VCwiki giữ `AUTH_PASSWORD_LOGIN=admin`; cập nhật tài liệu cuối | SSO-11 + 2 tuần | Không còn đường đăng nhập ngoài VC ID trừ đường khẩn cấp | 2 | Sonnet |
| | **Tổng** | | | **65** | |

**Lịch đề xuất** (giả định có một dev làm làn SSO không trùng việc M1; nếu cùng hai dev đang dồn cho M1 thì chỉ làm SSO-00 và chốt Q, I trước 26/10, phần còn lại dời sau):

| Thời gian | Phiên | Ghi chú |
|---|---|---|
| 09–10/10 | I3, I6 (Q1–Q5 đã chốt 08/10) | Chủ dự án |
| 13/10 | SSO-00 | |
| 14–15/10 | SSO-01, SSO-02 | |
| 16–17/10 | SSO-03; SSO-05 | I1, I2, I5 xong trước 17/10 |
| 20–21/10 | SSO-04 (cần I4); SSO-10 | Production lên trước, chưa app nào dùng |
| 22–24/10 | SSO-06; bật SSO-07 trên production | VCwiki chuyển trước, không ảnh hưởng M1 |
| 27–29/10 | SSO-08, SSO-09 | Sau mốc M1 |
| 30–31/10 | SSO-11 UAT tổng | |
| ~07/11 | SSO-07 bước 2 (VCwiki mật khẩu chỉ cho admin) | Sau 2 tuần |
| ~14/11 | SSO-12 | Sau 2 tuần VClinks ổn định |

## 9. Kiểm thử và UAT

### 9.1 Test tự động

| Lớp | VClinks (jest) | VCwiki (pytest) | vc-platform |
|---|---|---|---|
| Kiểm `id_token` | 6 điểm mục 5.2, mỗi điểm một ca sai | Như VClinks | — |
| Gắn user | Mới, theo email, theo `sub`, xung đột, khoá, thiếu nhóm, tự tạo bật/tắt | Như VClinks | — |
| Back-channel | Hợp lệ theo `sid`; chỉ `sub`; thiếu `events`; có `nonce`; `jti` lặp; `iat` cũ; sai chữ ký; sai `aud`; body không phải form | Như VClinks | — |
| End-to-end | Issuer giả trong test (discovery + JWKS + token) → đăng nhập → gọi API → back-channel → API trả 401 | Tương tự bằng `TestClient` | Playwright: VC Home với Keycloak dev (đăng nhập bằng user thử của realm dev) |
| Cấu hình | — | — | `@vc/realm-apply` áp `vc.yaml` hai lần (lần hai 0 thay đổi); kiểm schema `apps.yaml`; quét bí mật; `scripts/thu-production.sh` dựng cụm production và kiểm 16 bước |
| Hồi quy | Toàn bộ `pnpm ci:local` | Toàn bộ test hiện có | — |

### 9.2 Ca UAT

| Mã | Ca | Mong đợi |
|---|---|---|
| UAT-SSO-01 | Lần đầu đăng nhập bằng `@vcprosperous.com` từ VC Home | Thấy 2 ô app |
| UAT-SSO-02 | Như trên với `@vcpart.vn` | Như trên |
| UAT-SSO-03 | Chọn Gmail cá nhân | Bị từ chối, câu tiếng Việt, nút chọn tài khoản khác |
| UAT-SSO-04 | Từ VC Home bấm VClinks | Vào thẳng `/conversations`, không hỏi gì |
| UAT-SSO-05 | Đã có phiên, mở thẳng link sâu VCwiki | Vào đúng trang |
| UAT-SSO-06 | Chưa có phiên, mở thẳng link sâu VClinks | Chọn tài khoản Google một lần rồi vào đúng trang |
| UAT-SSO-07 | Đăng xuất ở VClinks | Trang xác nhận tiếng Việt; sau đó VCwiki và VC Home đều mất phiên trong ≤ 10 giây |
| UAT-SSO-08 | Đăng xuất ở VC Home | Không có trang xác nhận; mọi app mất phiên |
| UAT-SSO-09 | Admin `vc-provisioner disable` | Mọi app mất phiên ≤ 1 phút; đăng nhập lại bị chặn |
| UAT-SSO-10 | Khoá tài khoản thử trên Google | Mất quyền ≤ 20 phút; admin nhận thông báo |
| UAT-SSO-11 | Người dùng VCwiki cũ (mật khẩu) đăng nhập SSO lần đầu | Gắn đúng tài khoản cũ, giữ vai trò, kho, lịch sử học |
| UAT-SSO-12 | Người dùng VClinks cũ | Giữ vai trò, khách đang phụ trách, phiếu |
| UAT-SSO-13 | Email đã gắn với `sub` khác | Từ chối `identity_conflict`, admin được báo |
| UAT-SSO-14 | Bỏ người dùng khỏi nhóm `app-vcwiki` (bật `OIDC_REQUIRE_APP_GROUP`) | Ô VCwiki biến mất ở VC Home và ở thanh chuyển app; mở thẳng VCwiki báo chưa được cấp |
| UAT-SSO-15 | Token MCP VClinks và VCwiki, extension, agent máy Zalo, webhook OA/Fanpage | Chạy bình thường |
| UAT-SSO-16 | Tắt Keycloak trên staging | Phiên đang có ở app vẫn dùng được; đăng nhập mới báo `idp_unreachable` bằng câu dễ hiểu |
| UAT-SSO-17 | Quay lui: VClinks `AUTH_PROVIDER=google`, VCwiki `AUTH_PASSWORD_LOGIN=on` | Đăng nhập theo cách cũ được |
| UAT-SSO-18 | Để yên 12 giờ | Phải đăng nhập lại (một lần chọn tài khoản) |
| UAT-SSO-19 | Đổi tên trên Google rồi đăng nhập lại | Tên mới hiện ở VC Home, VClinks, VCwiki |
| UAT-SSO-20 | Trên điện thoại | VC Home dùng được, lưới 1 cột, đăng nhập và đăng xuất được |
| UAT-SSO-21 | Hộp thư dùng chung (ví dụ `cskh.test@vcpart.vn`, có trong danh sách loại trừ) đăng nhập | Vào được VC Home, không có ô app, câu "tài khoản dùng chung…"; mở thẳng VClinks báo `app_not_granted` |
| UAT-SSO-22 | Tài khoản chưa bật 2 bước đăng nhập; sau đó bật 2 bước | Lúc đầu không có ô app, câu "chưa bật xác thực 2 bước…"; bật xong, sau ≤ 15 phút tải lại thì có 2 ô app |
| UAT-SSO-23 | Admin Google tạo tài khoản mới đủ điều kiện, chạy `vc-provisioner sync` | Người mới đăng nhập lần đầu có ngay 2 ô app, vào VClinks không phải chờ |

## 10. Chuyển đổi dữ liệu và quay lui

| Bước | Dữ liệu | Quay lui |
|---|---|---|
| Thêm `idp_sub`, `idp_groups` vào user (cả hai app) | Chỉ thêm trường, gắn dần ở lần đăng nhập | Bỏ qua trường; code cũ không đọc |
| Thêm `sid`, `idp_sub` vào phiên | Chỉ thêm trường | Như trên |
| VCwiki băm token phiên | Phiên cũ hết hiệu lực một lần | Không cần: quay lui code thì mọi người đăng nhập lại một lần nữa |
| Bật SSO ở VCwiki | `AUTH_SSO=on`, mật khẩu vẫn `on` | `AUTH_SSO=off` |
| Bật SSO ở VClinks | `AUTH_PROVIDER=oidc` | `AUTH_PROVIDER=google` (giữ tới SSO-12) |
| Keycloak hỏng nặng | — | VClinks bật `AUTH_TOKEN_LOGIN` cho admin, VCwiki `AUTH_PASSWORD_LOGIN=admin`; khôi phục PostgreSQL từ bản sao lưu |

Trước khi bật ở mỗi app: chạy báo cáo user có email ngoài 2 domain và user trùng email (chỉ đọc), người duyệt xem trước.

## 11. Vận hành và xử lý sự cố

**Giám sát:**

| Theo dõi | Ngưỡng cảnh báo | Gửi tới |
|---|---|---|
| `/health/ready` của Keycloak, `/` của VC Home | Lỗi 2 lần liên tiếp (kiểm 1 phút/lần) | Telegram hoặc email nhóm vận hành |
| Tỉ lệ đăng nhập lỗi (sự kiện `LOGIN_ERROR`, `IDENTITY_PROVIDER_LOGIN_ERROR`) | > 20% trong 15 phút | Như trên |
| Back-channel gửi lỗi | Bất kỳ, gom theo giờ | Như trên |
| `vc-provisioner` | Không chạy quá 45 phút, dừng vì danh sách bất thường, hoặc chờ xác nhận gỡ nhóm hàng loạt | Như trên |
| Ổ đĩa, RAM máy chủ | > 80% | Như trên |
| Sao lưu | Không có bản mới trong 26 giờ | Như trên |

**Sổ tay sự cố** (đầy đủ trong `vc-platform/docs/van-hanh.md`):

| Tình huống | Làm gì |
|---|---|
| Không ai đăng nhập được | Kiểm Keycloak health → log → Cloudflare tunnel → Google. Trong lúc chờ, phiên đang có vẫn chạy 12 giờ; cần gấp thì bật đường khẩn cấp ở app |
| Một người không đăng nhập được | Xem sự kiện của người đó trong màn quản trị: sai domain, bị khoá, thiếu nhóm, xung đột `sub` |
| Nghi lộ tài khoản | `vc-provisioner disable <email>`; báo admin Google đổi mật khẩu và đăng xuất Google |
| Lộ client secret | Tạo secret mới trong `vc.yaml` + `.env`, áp lại, khởi động lại app liên quan; phiên đang có không bị ảnh hưởng |
| Xoay khoá ký | Thêm khoá mới (ưu tiên cao hơn), chờ 1 tuần, tắt khoá cũ; app tự lấy khoá mới qua JWKS |
| Nâng bản Keycloak | Đọc ghi chú phát hành, thử trên staging bằng bản sao lưu production, rồi nâng production ngoài giờ |

### 11.1 Quy trình nghỉ việc trước GĐ C (D-BA-40)

Trước R3 VC People chưa có ngày nghỉ, nên khoá vẫn làm tay. Gửi HC-NS và IT cùng lúc lên R1.

1. **HC-NS** báo IT ít nhất 1 ngày làm việc trước ngày nghỉ (email tới it@vcprosperous.com, tiêu đề "Nghỉ việc: {họ tên} – {email} – {ngày nghỉ}"); báo thêm chủ app VClinks nếu người đó đang phụ trách khách (bàn giao M1b-11).
2. **Người nắm dữ liệu nhạy cảm** (quản trị, kế toán, giám đốc bán hàng, người có vai trò nhạy cảm) hoặc nghỉ do kỷ luật: IT chạy `vc-provisioner disable <email> --reason "Nghỉ việc"` **ngay khi nhận báo** (≤ 1 phút mọi app).
3. **Người khác:** IT tạm ngưng tài khoản Google đầu giờ ngày đầu tiên không còn làm; `vc-provisioner` khoá VC ID và mọi app trong ≤ 20 phút.
4. IT kiểm `vc-provisioner report` cuối ngày: người đã nghỉ không còn phiên nào.
5. Không xoá tài khoản Google ngay: chuyển dữ liệu Gmail, Drive cho quản lý theo quy định của công ty rồi mới xoá.

Từ GĐ C, VC Home tự khoá theo ngày nghỉ HC-NS nhập (VH-LCM-03), quy trình này chỉ còn là dự phòng.

## 12. Rủi ro

| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Đội chưa quen Keycloak, cấu hình sai | Trung bình | Cấu hình dạng code, có CI áp thử; SSO-00 thử kỹ trước; phiên đụng bảo mật dùng Opus |
| Keycloak là điểm hỏng đơn | Trung bình | App giữ phiên riêng 12 giờ; sao lưu và khôi phục thử hằng tháng; đường khẩn cấp ở từng app; chạy 2 bản trước khi VCsale nối vào (mục 14) |
| Hai domain là 2 Workspace riêng | Trung bình | I6 trả lời sớm; Google IdP dùng màn đồng ý "External"; `vc-provisioner` dùng thông tin đăng nhập riêng cho từng Workspace |
| Keycloak không nhận 2 hosted domain | Thấp | Phương án dự phòng ở mục 5.1.2; app luôn kiểm lại domain |
| Tranh sức với mốc M1 | Cao | Không đụng VClinks trước 26/10; nếu cùng dev thì dời toàn bộ sau 26/10 |
| Người dùng VCwiki có email ngoài công ty mất quyền | Trung bình | I7 xử lý trước SSO-07; giữ mật khẩu cho admin |
| Lộ mật khẩu Google của một người là lộ mọi app (một chìa mở mọi cửa) | Trung bình | 2 bước bắt buộc (I8); không cấp app cho tài khoản chưa bật; tài khoản dùng chung bị loại trừ |
| Lộ bí mật | Cao nếu xảy ra | Không đưa vào git, quét bí mật trong CI, xoay định kỳ |
| Cấu hình redirect URI sai làm lộ `code` | Thấp | Chỉ khai URI chính xác, PKCE bắt buộc |
| Repo `vc` đang public chứa tài liệu này và code hai app | Cao | Đổi repo `vc` sang private trước khi đưa thông tin máy chủ, tên miền quản trị vào |

## 13. Tài liệu phải cập nhật ở từng repo

| Repo | Tài liệu | Sửa gì |
|---|---|---|
| `vclinks` | `CLAUDE.md` §9 mục 4, §14; `AGENTS.md` (bản sao) | Đăng nhập qua VC ID; đường khẩn cấp; bỏ câu hỏi SSO đã chốt |
| `vclinks` | `docs/02-yeu-cau/dac-ta/01-phan-quyen.md` PQ-10; `00-giao-dien-chung.md` MH-UI-02 | Luồng mới, mã lỗi mới, câu tiếng Việt |
| `vclinks` | `docs/04-ky-thuat/api/dang-nhap-oidc.md` (mới) | Route, biến môi trường, kiểm token, back-channel |
| `vclinks` | `docs/06-van-hanh/` | Cách bật, quay lui, đường khẩn cấp |
| `vclinks` | `docs/01-quan-ly-du-an/lo-trinh-ai-trung-tam-vclinks-vcwiki.md` | Q7 (SSO chung) chuyển sang "đang làm", trỏ tới kế hoạch này |
| `tiktok-to-text` | `docs/BA.md` (SYS-43, mục 1.4, 2, 12), `docs/DESIGN.md` (TK-35, SCR), `docs/UAT.md` | Theo quy trình BA → DESIGN → Code → UAT |
| `vc-platform` | Toàn bộ `docs/` | Mục 6 |

Mỗi file sửa theo quy định §13 của VClinks: tăng phiên bản một lần lúc commit, ghi lịch sử có ngày giờ, cập nhật README của thư mục.

## 14. Để sau (không làm trong kế hoạch này)

- **Ô app có số việc chờ:** mỗi app thêm `GET /api/vc-app/status` nhận access token của VC Home (thêm mapper `audience`), trả `{access: granted|pending, badges}`.
- **Màn quản trị danh mục app và nhóm** trong VC Home thay cho sửa `apps.yaml` và màn quản trị Keycloak. Đã đưa vào lộ trình: danh mục app quản trị trên màn từ GĐ B (VH-APP-01), quyền và nhóm theo luật từ GĐ C (VH-ACC-01, 07).
- **Danh bạ tổ chức một nguồn:** đồng bộ đơn vị và chức danh từ HR hoặc Google vào nhóm Keycloak (`/org/vcparts/to-ban-hang-1`…), hai app đọc để tự gán đơn vị. Đây là bước giải quyết ba cây tổ chức đang lệch nhau.
- **Gatekeeper:** dùng cơ chế đổi token (Token Exchange, RFC 8693) của Keycloak để AI hành động thay người với quyền hẹp; bỏ bảng `identity_links` vì mọi app đã chung `sub`.
- **Bán cho doanh nghiệp ngoài:** dùng tính năng Organizations của Keycloak, mỗi khách một tổ chức với Google hoặc Microsoft riêng.
- ~~**VClinks chuyển token sang cookie httpOnly**~~: đã đưa vào R4 (D-BA-42, kế hoạch code GĐ D).
- **Xác thực lại khi dùng vai trò nhạy cảm** (step-up): Keycloak yêu cầu xác thực lại hoặc khoá bảo mật khi mở màn quản trị hay dùng vai trò nhạy cảm (D-BA-38).
- **Chạy Keycloak 2 bản** (cluster) khi có trên 5 app hoặc trên 500 người dùng, và **bắt buộc trước khi VCsale hoặc app vận hành khác nối vào** (D-BA-41).
- **App điện thoại:** client public riêng với PKCE và mở trình duyệt hệ thống.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.6 | 08/10/2026 15:52 | Claude Code (code GĐ A với thông số giả lập) | Ghi quyết định phát sinh khi code: công cụ áp realm, chặn domain bằng bộ lọc claim `hd`, Google luôn hiện danh sách tài khoản, realm chuyển thẳng sang Google, quyền `vc-provisioner`, phiên và "Chọn tài khoản khác" của VC Home, header nginx, edge trước Keycloak; sửa bảng 5.1.1 (không có nhóm mặc định) | [12](../12-cau-hoi-rui-ro.md) D-BA-49…54; code `vc-platform` |
| 0.5 | 08/10/2026 14:31 | Claude Code (vai BA trưởng, soát chéo) | Mã VCwiki đổi SYS-60 thành SYS-43 (BA.md hiện tới SYS-42; SYS-59 là mã ca UAT); bỏ `defaultGroups` trong phác thảo `vc.yaml`, sửa Q3 và sơ đồ đăng nhập theo D-BA-37 | Soát chéo kế hoạch code ngày 08/10/2026; [12](../12-cau-hoi-rui-ro.md) D-BA-44…48 |
| 0.4 | 08/10/2026 13:50 | Claude Code (vai BA trưởng) | 6 điểm vá bảo mật: điều kiện vào app ở GĐ A–B (không nhóm mặc định, bật 2 bước, danh sách loại trừ, tạo sẵn user), `vc-provisioner` mỗi 15 phút (khoá ≤ 20 phút), I8–I9, mục 11.1 quy trình nghỉ việc tay, UAT-SSO-21…23, mục 14; 65 giờ | [12](../12-cau-hoi-rui-ro.md) D-BA-37…42; người dùng đồng ý 08/10/2026 |
| 0.3 | 08/10/2026 11:31 | Claude Code (vai BA) | Ghi Q1–Q5 đã chốt theo đề xuất (mục 4.1, tóm tắt, lịch); thêm kiểm (7) mapper `vh_roles` vào SSO-00 | [12](../12-cau-hoi-rui-ro.md) mục 4; [07](../07-tich-hop.md) mục 11 đề xuất 8 |
| 0.2 | 08/10/2026 10:04 | Claude Code (vai BA) | Chuyển file từ `docs/sso/ke-hoach-sso-keycloak.md` vào bộ tài liệu VC Home (`docs/vc-home/ky-thuat/`), đổi tên; ghi rõ đây là thiết kế GĐ A; VC Home có thêm backend từ GĐ B; thêm thư mục `api/` vào cấu trúc repo `vc-platform` | Bộ tài liệu VC Home 0.1 |
| 0.1 | 08/10/2026 09:46 | Claude Code | Tạo kế hoạch: hiện trạng code hai app, kiến trúc VC ID (Keycloak) + VC Home + vc-provisioner, hợp đồng tích hợp app, thay đổi theo file ở VClinks và VCwiki, repo `vc-platform`, môi trường, 13 phiên 60 giờ, 20 ca UAT, chuyển đổi và quay lui, vận hành, rủi ro | Yêu cầu người dùng 08/10/2026 ("lên bản plan code đầy đủ nhất… dựng keycloak"); đọc code `vclinks/apps/api/src/auth`, `tiktok-to-text/backend/app/auth.py` |
