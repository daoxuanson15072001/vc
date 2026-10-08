# VClinks Extension (Chrome MV3)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- VClinks Extension (Chrome MV3) đọc **IndexedDB của Zalo Web**, đẩy tin nhắn, danh bạ, nhóm, hội thoại về API; không cào giao diện.
- **Build và cài:** build ra `apps/extension/build`, nạp "Load unpacked"; hoặc chạy trong Chrome driver (`pnpm driver`); `pnpm dev:ext` tự build và extension tự tải lại.
- Selector DOM nằm trong bảng ánh xạ (`spec.dom`): Zalo đổi giao diện thì duyệt selector mới, **không cần build lại**.
- **Đồng bộ** 15 phút một lần hoặc bấm tay; thứ tự tài khoản → danh bạ → nhóm → hội thoại → tin nhắn; gửi số bản ghi gốc để đối chiếu.
- **Bảo mật:** chỉ mở store trong bảng ánh xạ, DB mở chỉ đọc, không đọc cookie / `localStorage`, lọc trường nhạy cảm trước khi rời tab, log chỉ có số đếm.
- **Drift:** thiếu DB / store / trường bắt buộc (trên 20% của 50 mẫu) thì dừng stream và báo; Claude đề xuất bảng ánh xạ mới, người duyệt.
- Bảng **cấu trúc mã** mô tả vai trò từng file trong `src/`.

## Mục lục

- [Build](#build)
- [Cài vào Chrome](#cài-vào-chrome)
- [Cấu hình](#cấu-hình)
- [Đồng bộ](#đồng-bộ)
- [Bảo mật](#bảo-mật)
- [Drift (lệch cấu trúc IndexedDB)](#drift-lệch-cấu-trúc-indexeddb)
- [Cấu trúc mã](#cấu-trúc-mã)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

Extension đọc trực tiếp **IndexedDB của Zalo Web** (`https://chat.zalo.me`) và đẩy tin nhắn, danh bạ, nhóm, hội thoại về VClinks API. Extension không cào giao diện, nên Zalo đổi giao diện không ảnh hưởng. Chỉ khi Zalo đổi cấu trúc IndexedDB thì mới cần duyệt một bảng ánh xạ trường mới.

## Build

```bash
pnpm --filter @vclinks/shared build        # nếu packages/shared chưa build
pnpm --filter @vclinks/extension build     # ra thư mục apps/extension/build
pnpm --filter @vclinks/extension watch     # build lại khi sửa code
pnpm --filter @vclinks/extension test
pnpm --filter @vclinks/extension typecheck
```

## Cài vào Chrome

1. Mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển**.
2. Bấm **Tải tiện ích đã giải nén** và chọn thư mục `apps/extension/build`.
3. Mở (hoặc tải lại) tab `https://chat.zalo.me` và đăng nhập. Tab Zalo đã mở từ trước khi cài extension phải được tải lại (F5).

### Chạy trong Chrome driver

Thay vì cài vào Chrome thường, `pnpm driver` (ở gốc repo) build extension và mở một Chrome for Testing riêng đã nạp sẵn nó, trỏ API `http://localhost:3000`. Xem [docs/06-van-hanh/chrome-driver.md](../../docs/06-van-hanh/chrome-driver.md).

### Tự cập nhật khi sửa code

Chạy ở thư mục gốc repo và để cửa sổ này mở:

```bash
pnpm dev:ext
```

Mỗi lần code đổi, lệnh này build lại và ghi `build/build-id.json`. Extension (bản giải nén) kiểm tra file này 30 giây một lần. Thấy bản mới thì nó **tự tải lại chính nó và tải lại tab Zalo**. Nếu đang đồng bộ dở, nó chờ đồng bộ xong mới tải lại.

- Lần đầu sau khi cập nhật lên bản có tính năng này, cần bấm tải lại thủ công trong `chrome://extensions` **một lần cuối**.
- Nếu sửa `manifest.json` và thêm quyền mới, Chrome có thể tắt extension để hỏi lại quyền. Khi đó phải bật lại thủ công.
- Build lỗi thì không ghi `build-id`, nên extension tiếp tục chạy bản cũ.

### Giao diện Zalo đổi thì không cần build lại

Selector DOM (đọc nội dung tin nhắn, tên hội thoại) nằm trong bảng ánh xạ (`spec.dom`), không nằm trong code. Khi Zalo đổi giao diện:

1. Extension báo drift `dom_selectors`.
2. Claude đề xuất selector mới (xem `docs/04-ky-thuat/api/mcp-client-guide.md` mục 2b).
3. Anh duyệt trên Dashboard.
4. Extension áp dụng trong vòng 5 phút, không phải tải lại gì.

## Cấu hình

Bấm biểu tượng VClinks, mở **Cài đặt kết nối**:

- **Địa chỉ API:** ví dụ `https://xxx.trycloudflare.com` hoặc `http://localhost:3000`. Chỉ chấp nhận `https://` hoặc `http://localhost`.
- **Token thiết bị:** token có scope `ingest`, tạo bằng `pnpm token:create -- --name extension --scopes ingest`.

Bấm **Lưu và kiểm tra**. Chrome sẽ hỏi quyền truy cập đúng địa chỉ API đó, rồi extension gọi `GET /api/me` và hiện các scope của token. Nếu báo **Token không hợp lệ** thì kiểm tra lại token.

## Đồng bộ

- Tự chạy **15 phút một lần** (`chrome.alarms`), khi có ít nhất một tab `chat.zalo.me` đang mở.
- **Đồng bộ ngay:** chỉ gửi bản ghi từ checkpoint trở đi.
- **Đồng bộ lại toàn bộ:** bỏ qua checkpoint, gửi lại mọi thứ. API upsert theo id nên không sinh trùng.

Với mỗi tài khoản Zalo tìm thấy (mỗi DB `zdb_<uid>`, các tài khoản ngang nhau), extension làm theo thứ tự: đăng ký tài khoản → danh bạ → nhóm → hội thoại → tin nhắn. Sau đó extension gửi **số bản ghi gốc** của từng store (`POST /api/sync/report`) để Dashboard đối chiếu. Popup hiển thị trạng thái lượt gần nhất của từng tài khoản: số bản ghi gốc, đã gửi, mới, cập nhật, bị từ chối, bỏ qua, và drift nếu có.

## Bảo mật

- Chỉ mở các store có trong bảng ánh xạ. Không bao giờ mở store có tên dạng `e2ee*`, `*token*`, `*session*`, `*key*`, `*cookie*`.
- Mở DB **không kèm version** và chỉ dùng transaction `readonly`: không nâng cấp, không ghi vào dữ liệu của Zalo.
- Không đọc cookie hay `localStorage`. Không xin quyền `cookies`, `tabs` hay `webRequest`.
- Mọi trường nhạy cảm (`e2ee_*`, `*token*`, mật khẩu, OTP…) bị lọc khỏi bản ghi trước khi rời tab (hàm `stripSensitive` dùng chung trong `@vclinks/shared`). API cũng từ chối nếu vẫn còn.
- Token API chỉ nằm trong service worker. Content script gửi dữ liệu qua service worker, không tự gọi API.
- Log console chỉ có số đếm, không có nội dung tin nhắn.

## Drift (lệch cấu trúc IndexedDB)

Bảng ánh xạ trường (`GET /api/mapping/active`) quy định stream nào đọc DB/store nào và trường nào là bắt buộc. Với từng stream:

- **Thiếu DB hoặc thiếu store:** extension gửi `POST /api/mapping/drift` (`missing_db` / `missing_store`, kèm danh sách tên store đang có) và bỏ qua stream đó.
- **Thiếu trường bắt buộc:** extension lấy **50 bản ghi đầu** làm mẫu. Nếu trên **20%** mẫu thiếu trường bắt buộc, extension **dừng đẩy stream đó** và gửi drift `missing_fields`, kèm tên các trường thiếu và **tên khóa** quan sát được trên mẫu. Drift không bao giờ gửi giá trị, và đã lọc bỏ tên khóa nhạy cảm.
- Nếu dưới ngưỡng, bản ghi lỗi chỉ bị bỏ qua và được đếm vào cột "Bỏ qua".

Khi có drift, Claude khảo sát IndexedDB mới và đề xuất bảng ánh xạ mới (`propose_field_mapping`). Người dùng duyệt trên Dashboard, và extension tự áp dụng bảng mới ở lượt đồng bộ sau.

## Cấu trúc mã

| File | Vai trò |
|---|---|
| `src/reader.ts` | Đọc IndexedDB chỉ đọc: tìm `zdb_<uid>`, mở DB, đọc store theo từng khối 500 bản ghi (transaction ngắn, tiếp tục sau khóa cuối) |
| `src/sync.ts` | Lõi đồng bộ: `mapRecord` (dùng chung), phát hiện drift, lọc theo checkpoint, chia lô ≤ 500. Không dùng API `chrome.*`, nhận API client qua tham số |
| `src/api.ts` | Interface `ApiClient` và `HttpApiClient` (thử lại 3 lần, backoff; 401 thì dừng) |
| `src/content.ts` | Content script trên `chat.zalo.me`: chạy lõi đồng bộ, chuyển lời gọi API sang service worker |
| `src/background.ts` | Service worker: cài đặt, gọi API, `chrome.alarms`, lưu trạng thái |
| `src/popup.ts`, `popup.html` | Giao diện popup |
| `src/compose.ts` | Gõ tin như người dùng (insertText, so khớp 100%, Enter một lần), dùng chung cho Zalo và Messenger |
| `src/messenger/` | Kênh Facebook cá nhân: content script `messenger.js` trên messenger.com và facebook.com/messages, chỉ đọc DOM đang hiển thị, gửi tin đã duyệt (xem `docs/04-ky-thuat/kenh/facebook-personal.md`) |
| `src/popup-fb.ts` | Mục "Facebook cá nhân" trong popup: tài khoản nhận ra, ID nhập tay, công tắc gửi tin trên Facebook (mặc định tắt) |
| `build.mjs` | Đóng gói bằng esbuild, tạo icon tạm |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:43 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm dòng trạng thái, Tóm tắt, Mục lục | `docs/01-quan-ly-du-an/hoi-to-tai-lieu-md.md` |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 28/09/2026 | — | Bản gốc (xem `git log --follow -- apps/extension/README.md`) | — |
