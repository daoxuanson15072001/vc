# Kế hoạch cải thiện giao diện: thân thiện với AI agent + tối ưu SEO

> **Đã gộp vào `docs/DESIGN.md` Phần V–VI (v0.3, 30/09/2026)** và yêu cầu BA SYS-26…34. File này giữ làm lịch sử, không cập nhật nữa.

> Lập ngày 28/09/2026 trên nhánh `develop` (sau commit bbf8207). Trạng thái: **đề xuất, chưa làm**. Khi bắt tay làm sẽ chuyển từng đợt thành yêu cầu phát triển và cập nhật BA (mục 9 Màn hình, mục 11.1 Phi chức năng).

## 0. Vì sao và hiện trạng

**Hai loại "người dùng máy" cần phục vụ:**

1. **AI agent điều khiển trình duyệt** (Claude in Chrome, Claude Desktop computer use, Playwright do AI viết): nhìn trang qua cây trợ năng (accessibility tree) + ảnh chụp, bấm theo tên phần tử, không tự chọn file, không đọc được toast biến mất nhanh, kẹt khi gặp hộp thoại gốc của trình duyệt (`confirm` / `prompt`).
2. **AI đọc không chạy JS** (Claude fetch URL, crawler, bot tìm kiếm): chỉ thấy vỏ `index.html` vì toàn bộ app là SPA React. Hiện đã có ngoại lệ: `/guide.md`, `/guide/<id>.md`, `/api/guide` và cổng MCP `/mcp`.

**Số liệu đo trên `frontend/src` ngày 28/09:**

| Chỉ số | Hiện có | Ý nghĩa |
|---|---|---|
| `aria-label` | 234 | Khá tốt, nhưng phân bố không đều |
| `data-testid` | 141 | Chỉ ở các màn đã có e2e |
| `role="dialog"` | 13 popup | Có, nhưng `aria-labelledby` chưa gắn |
| `aria-live` / `role="status"` | 1 / 5 | Toast, tiến độ hầu hết không được đọc |
| `window.confirm` / `window.prompt` | 42 / 7 | Rào cản lớn nhất với agent, ở 25 file |
| Hàng bảng / thẻ bấm bằng `onClick` trên `tr` / `div` / `li` | 17 | Không có tên, không bấm được bằng bàn phím |
| `id=` trên phần tử | 3 | Không neo được (`#…`), không `aria-labelledby` |
| Toast tự ẩn | 2,5 giây | Agent thường không kịp đọc |
| Landmark (`header`/`section`/`nav`) | có ở một số trang | Không thống nhất, `main` chỉ có 1 |
| `robots.txt`, `sitemap.xml`, `canonical`, Open Graph, JSON-LD | 0 | Chưa có gì |
| SPA fallback | mọi đường dẫn trả `200` + `index.html` | Soft-404: bot đánh giá trang lỗi là trang thật |
| Chuyển hướng link cũ (`/videos`, `/jobs`, `/channels`) | phía client | Bot thấy `200`, không phải `301` |

**Lưu ý thẳng về SEO:** ứng dụng nằm sau đăng nhập, bot tìm kiếm không index được gì ngoài trang đăng nhập. SEO có ý nghĩa thật chỉ khi tạo **lớp công khai** (phần C): trang giới thiệu, hướng dẫn, và thẻ VCWIKI ở kho công khai mà công ty muốn lộ ra ngoài. Nếu anh không muốn lộ bất kỳ nội dung nào, phần C rút xuống còn C1 + C2 (vỏ sạch, robots chặn đúng cách) và làm trong nửa ngày.

## 1. Mục tiêu và nguyên tắc

**Mục tiêu đo được (sau đợt 3):**

- Claude in Chrome chạy trọn 10 gói test `docs/test-claude-extension` mà **không cần người bấm hộ** ở bất kỳ bước nào ngoài chọn file.
- Mọi hành động chính trên mọi màn làm được bằng bàn phím (Tab, Enter, Esc) và có tên rõ trong cây trợ năng.
- `axe-core` trong Playwright: 0 lỗi mức *critical* / *serious* trên toàn bộ route.
- Lighthouse SEO ≥ 95 và Accessibility ≥ 95 trên các trang công khai; các trang sau đăng nhập ≥ 90 Accessibility.
- Mọi đối tượng có URL riêng đọc được dạng Markdown/JSON không cần JS (thẻ, nguồn, bài học, dự án, chiến dịch).

**Nguyên tắc:**

1. **Một thay đổi ở component dùng chung phải sửa được nhiều màn.** Ưu tiên `ui.jsx`, `modalFull.jsx`, `pickers.jsx`, `styles.css` trước rồi mới đi từng trang.
2. **Không đổi luật nghiệp vụ, không đổi bố cục lớn.** Đây là đợt làm "vỏ" cho máy đọc được; người dùng thấy giao diện gần như cũ, chỉ dễ dùng hơn.
3. **Tên phần tử là tiếng Việt, có nghĩa, duy nhất trong ngữ cảnh.** "Xoá thẻ *Mã lỗi DTC là gì*" thay vì "Xoá".
4. **Trạng thái phải ở dạng chữ, không chỉ màu.** Badge, tiến độ, đã chọn / chưa chọn.
5. **Mọi thứ mở được từ URL.** Popup, tab, bộ lọc, trang hiện tại đều nằm trên query string (nhiều màn đã có `?card=`, `?source=`, giữ và mở rộng).
6. **Không hộp thoại gốc của trình duyệt.** Thay bằng `<dialog>` trong app có tên, có nút Xác nhận / Huỷ rõ.

## 2. Phần A — Nền tảng dùng chung (làm trước, ảnh hưởng mọi màn)

### A1. Hộp thoại xác nhận / nhập chữ trong app (thay 42 `confirm` + 7 `prompt`)

- Thêm `components/dialog.jsx`: `useConfirm()` trả `confirm({ title, body, okLabel, danger })` → Promise; `usePrompt()` tương tự có ô nhập và kiểm tra bắt buộc.
- Dựng bằng `<dialog>` HTML (hoặc `role="alertdialog"` + `aria-modal` + `aria-labelledby` + `aria-describedby`), tự đặt con trỏ vào nút an toàn, Esc = Huỷ, khoá cuộn nền như `useModalEsc` đang làm.
- Nút OK mang tên hành động thật: "Xoá thẻ", "Gửi duyệt", "Kết thúc bài thi", không phải "OK".
- `data-testid="confirm-dialog"`, `confirm-ok`, `confirm-cancel`.
- Thay dần ở 25 file (danh sách ở mục 3), cập nhật e2e tương ứng (`page.on('dialog')` → bấm nút trong app). Sửa `_chung.md` mục 3.2 của bộ test Claude in Chrome.

### A2. Thông báo tồn tại đủ lâu và được đọc

- `components/toast.jsx` dùng chung (hiện mỗi trang tự viết `toast()` với `setTimeout 2500`): vùng `role="status" aria-live="polite"` cố định trong `App.jsx`, hiện **tối thiểu 6 giây**, có nút đóng, dừng đếm khi trỏ chuột / tiêu điểm vào, giữ lịch sử 5 thông báo gần nhất trong một nút "Thông báo" ở góc (agent đọc lại được).
- Thông báo lỗi giữ nguyên `ErrorBox role="alert"` nhưng thêm `aria-live="assertive"`.
- Hành động dài (nạp nguồn, dựng thẻ, chấm AI): vùng tiến độ gắn `aria-busy` + `role="progressbar"` + `aria-valuenow` + chữ "Đang xử lý 3/10".

### A3. Hàng bảng và ô bấm được: nút hoặc liên kết thật

- 17 chỗ `tr onClick` / `div onClick` / `li onClick` (Knowledge, Videos, Projects, Project ×2, Studio, Campaign ×2, QuickWrite): đưa `<Link>` vào ô tiêu đề hoặc thêm nút "Mở" cuối hàng; bỏ `onClick` ở `tr` hoặc giữ nhưng thêm `Link` để bàn phím và agent có đích rõ.
- Lớp `.overlay onClick={onClose}` (11 chỗ) vẫn giữ, thêm `aria-hidden="true"` vì đã có nút Đóng.

### A4. Popup có tên và neo URL

- `modalFull.jsx`: bọc `Modal` chung nhận `title`, tự sinh `id` và gắn `aria-labelledby`; nút đóng `aria-label="Đóng <title>"`; bẫy tiêu điểm (focus trap) trong popup; trả tiêu điểm về phần tử mở khi đóng.
- Mọi popup chi tiết đều có query tương ứng (đã có `?card=`, `?source=`, `?v=`; bổ sung cho: hồ sơ nhân sự Org, chi tiết chiến dịch/kịch bản trong Campaign, câu hỏi trong Library, người đứng tên Authors, dự án Projects).

### A5. Tên trang, cấu trúc và landmark thống nhất

- Mọi trang: đúng một `<h1>` khớp `usePageTitle`, bọc trong `<header className="page-head">`; khối chính `<section aria-labelledby>`; bảng có `<caption>` (ẩn bằng `.sr-only`) và `th scope="col"`.
- Thêm lớp `.sr-only` vào `styles.css` (chưa có).
- Sidebar: `<nav aria-label="Menu chính">`; nhóm menu `.nav-group` đổi thành `<h2>` hoặc `role="group" aria-label`; `NavLink` đã có `aria-current` nhờ router.
- Nút "Hỏi Claude" của `QuickChat`: cửa sổ nổi mang `role="complementary" aria-label="Chat nhanh"`; `getContext()` lấy thêm `h1` + trạng thái bộ lọc để Claude trả lời đúng ngữ cảnh.
- Nút chỉ có ký hiệu (`icon-btn`, 38 chỗ, 6 chưa có nhãn): bắt buộc `aria-label` + `title`; ESLint rule `jsx-a11y/control-has-associated-label` bật thành lỗi.

### A6. `data-testid` và thuộc tính máy đọc theo quy ước

- Quy ước đặt tên: `<màn>-<đối tượng>-<hành động>` (`wiki-card-open`, `kb-source-row`, `org-unit-add`). Ghi vào `docs/ke-hoach-giao-dien-ai-agent-seo.md` mục 6 (nay là DESIGN Phần VI; `HUONG_DAN.md` không còn chép quy ước này — 30/09/2026).
- Hàng dữ liệu gắn `data-id`, `data-status`, `data-kind` để agent / Playwright lọc không cần đọc chữ.
- Mở rộng từ 141 lên phủ mọi nút hành động chính ở 30 màn (ước 300 điểm).

### A7. Trạng thái tải, rỗng, lỗi có chữ

- `useFetch`: khi `loading` render `<div role="status" aria-busy="true">Đang tải…</div>` thay vì để trống; agent phân biệt được "chưa tải" và "không có dữ liệu".
- `Empty` có `role="note"` và câu gợi ý hành động (nhiều màn đã có).

### A8. Bàn phím và tiêu điểm

- Menu tài khoản (`UserBox`), `CategoryPicker`, `SpaceSelect`, gợi ý tìm kiếm: `role="menu"` / `listbox`, mũi tên lên xuống, Esc đóng, `aria-expanded`.
- Mọi hành động đang chỉ có khi trỏ chuột / cuộn: bổ sung nút tương đương (ví dụ "Tải thêm" thay vì chỉ cuộn vô hạn nếu có).
- Thứ tự Tab hợp lý trong popup và form dài (Org, Campaign, Design).

### A9. Tầng đọc không cần JS cho từng đối tượng (mở rộng cách `guide.py` đã làm)

- `GET /wiki/cards/<id>.md`, `/kb/sources/<id>.md`, `/learn/lessons/<id>.md`, `/studio/projects/<id>.md`, `/studio/<id>.md`: Markdown theo quyền của phiên hiện tại (cookie) hoặc token MCP; không đăng nhập → 401 rõ (không trả vỏ SPA).
- Mỗi trang SPA thêm `<link rel="alternate" type="text/markdown" href="…">` tương ứng (đã có cho `/guide`).
- `/llms.txt` ở gốc: giới thiệu hệ thống, cách đăng nhập, danh sách route, đường dẫn `.md`, cổng MCP `/mcp`, OpenAPI `/openapi.json`, `/guide.md`. Đây là điểm vào chuẩn để AI ngoài hiểu app trong một lần đọc.
- `/api/ui/state?path=…` (tuỳ chọn, đợt sau): trả JSON mô tả trang đang mở (tiêu đề, bộ lọc, các hành động có thể làm, id đối tượng) để agent không phải đọc DOM.

### A10. Nạp file cho agent không thể chọn file

- Ba chỗ `input type="file"` (Knowledge, Org nhập Excel, Library nhập câu hỏi): thêm đường thay thế **dán nội dung / dán URL** (Knowledge đã có dán link + ảnh; bổ sung "Dán bảng CSV" cho Org và "Dán văn bản câu hỏi" cho Library, dùng lại `questionImport.js` đang có).
- Thông báo ngay tại chỗ: "Không chọn được file? Dán nội dung vào đây."

### A11. Bộ kiểm chứng tự động

- `@axe-core/playwright` chạy trên mọi route trong `frontend/e2e/a11y.spec.js`, fail khi có lỗi critical/serious.
- ESLint plugin `jsx-a11y` (mức lỗi cho nhãn, vai trò, phím).
- Lighthouse CI cho trang công khai (phần C).
- Gói test mới `docs/test-claude-extension/P11-than-thien-ai-agent.md`: Claude in Chrome tự chạy chuỗi hành động xuyên màn không cần người bấm, báo lại chỗ kẹt.

## 3. Phần B — Từng màn hình: vấn đề và việc cụ thể

Ký hiệu độ ưu tiên: **P1** lõi (agent dùng hằng ngày / test P01–P03), **P2** thường dùng, **P3** phụ.

### 3.1 Vỏ ứng dụng — `App.jsx`, `Login.jsx`

| Ưu tiên | Vấn đề | Việc làm |
|---|---|---|
| P1 | `session.loading` trả `null` → trang trắng vài trăm ms, agent tưởng lỗi | Render "Đang kiểm tra phiên…" `role="status"` |
| P1 | Menu tài khoản là `button` không `aria-expanded`, đổi mật khẩu dùng `placeholder` làm nhãn | `aria-expanded`, `aria-controls`; nhãn `<label>` thật cho hai ô mật khẩu; nút "Đăng xuất" `data-testid="logout"` |
| P1 | Đăng nhập: lỗi hiện `ErrorBox` nhưng không gắn vào form | `aria-describedby` từ form → hộp lỗi; thêm `autocomplete` đã có; `h1` thay `h2`; `noindex` khi là trang setup lần đầu |
| P2 | `RouteTitle` chỉ theo menu, trang con (thẻ, bài học) không đổi tiêu đề tab | Trang con gọi `usePageTitle` với tên đối tượng ("Mã lỗi DTC là gì · VCWIKI") |
| P2 | Sidebar không có landmark, nhóm menu là `div` | `nav aria-label`, nhóm thành `role="group"` có nhãn |
| P2 | Không có liên kết "Bỏ qua tới nội dung" | Thêm `a.skip-link` đầu trang |

### 3.2 Tổng quan — `Dashboard.jsx` (P2)

- Ô `Stat` thành `<dl>` (`dt` nhãn, `dd` giá trị) để máy hiểu cặp nhãn–số.
- Danh sách nguồn / thẻ gần đây: `ul aria-label`.
- Tự tải lại 4 giây: gói trong `aria-live="off"` để không làm ồn cây trợ năng.

### 3.3 Kho tư liệu — `Knowledge.jsx` (1.227 dòng), `Videos.jsx`, `VideoDetail.jsx`, `Channels.jsx` (P1)

- Bảng nguồn: hàng bấm `tr onClick` → ô Tiêu đề thành `Link to="/kb?source=<id>"`; thêm `caption`, `th scope`, `data-id`, `data-status`.
- Ô nạp chung (dán link / kéo thả / dán ảnh): nhãn `aria-label="Dán link hoặc kéo file để nạp"`, nút "Nạp" rõ; chỉ dẫn cho agent về đường thay thế file.
- Popup chi tiết nguồn (`?source=`): `aria-labelledby` tiêu đề nguồn; tab con (Tài liệu / Thẻ / Nhật ký) thành `role="tablist"` + `aria-selected` + URL `&tab=`.
- 3 `confirm` (xoá nguồn, nạp lại, dừng) → A1.
- Tiến độ trích xuất: A2 (`progressbar`).
- Kho video: hàng `tr onClick` → `Link`; chi tiết video 2 `confirm` → A1; bộ lọc kênh / sắp xếp là `select` cần `aria-label` (một phần đã có).
- Kênh: bảng thêm `caption`; nút theo dõi / bỏ theo dõi có tên kèm tên kênh.
- Xuất Excel: nút ghi rõ "Xuất Excel (tải file)" để agent biết không đọc được kết quả.

### 3.4 Tìm video theo chủ đề — `Discover.jsx` (P3)

- Form tìm: `role="search"`, ô nhập có `label`.
- Kết quả: `ul` + mỗi mục `article` với tiêu đề `h3`; nút "Nạp video này" kèm tên video.
- Popup cấu hình quét: A4; overlay khi `busy` không đóng được → ghi rõ "Đang quét, không thể đóng" trong popup.

### 3.5 Tiến độ tinh chế — `Refine.jsx`, `RefineLive.jsx` (P2)

- Bảng công việc: `caption`, trạng thái dạng chữ (`Badge` đã có), thêm `data-status`.
- 2 `confirm` (dừng / chạy lại) → A1.
- Live: vùng log `role="log" aria-live="polite"`; nút Tạm dừng / Tiếp có `aria-pressed`.

### 3.6 VCWIKI — `Wiki.jsx` (696 dòng) + `components/social.jsx`, `playlist.jsx`, `listen.jsx`, `CardClassFields.jsx` (P1)

- Bộ lọc: gom vào `<form role="search" aria-label="Lọc thẻ">`; mỗi `select`/chip có nhãn; nút "Xoá lọc".
- Chuyển chế độ Lộ trình / Lưới: `role="radiogroup"` + `aria-checked` (một chỗ đã có) và URL `?view=` (đã có).
- Lưới thẻ: mỗi thẻ là `article` với `h3` là `Link to="?card=<id>"`; badge trạng thái / bậc là chữ (đã có).
- Popup thẻ: `aria-labelledby` tiêu đề thẻ; các khu (Nội dung / Lịch sử / Thảo luận / Duyệt) thành `tablist` hoặc `section aria-labelledby`, mở được bằng URL `&tab=`.
- 5 `confirm` + 1 ở `social.jsx` + 3 ở `categoryEditor.jsx` → A1 (xoá thẻ, xoá bình luận, xoá nhánh, khôi phục bản cũ…).
- Toast ("Đã quay về bản cũ", "Đã sao chép") → A2.
- Nút ★ bình chọn, 🔊 nghe, ＋ danh sách phát: `aria-label` kèm tên thẻ, `aria-pressed` cho đã bình chọn.
- Cây lĩnh vực (`CategoryTree`): `role="tree"` / `treeitem` / `aria-expanded` / `aria-level`, phím mũi tên.
- Trang con: A9 `/wiki/cards/<id>.md`.

### 3.7 Bản đồ tri thức — `WikiGraph.jsx`, `components/graph.jsx` (P3)

- Canvas/SVG không đọc được: thêm **bảng tương đương** ẩn/hiện ("Xem dạng danh sách") liệt kê nút và cạnh; `role="img" aria-label` tóm tắt (1 chỗ đã có).
- Ô tìm nút, bộ lọc lĩnh vực có nhãn; kết quả chọn nút phản chiếu lên URL `?node=`.

### 3.8 Hộp duyệt — `Review.jsx`, `BulkReview.jsx` (P1, là gói test P01)

- Danh sách chờ duyệt: `ul` mỗi mục `article`, nút "Duyệt" / "Từ chối" / "Yêu cầu sửa" kèm tên thẻ.
- Popup so sánh bản cũ / mới: hai cột có `aria-label="Bản hiện tại"` / `"Bản đề xuất"`; phần khác biệt đánh dấu bằng `ins`/`del` (chữ, không chỉ màu).
- Ô lý do từ chối: `label` bắt buộc, báo lỗi dạng chữ dưới ô.
- Duyệt hàng loạt: checkbox có nhãn theo tên thẻ; "Đã chọn N thẻ" là `role="status"`; 1 `confirm` → A1.
- URL: `?card=` + `&tab=review` để mở thẳng một thẻ trong hộp duyệt.

### 3.9 Tổng hợp thẻ — `Synth.jsx` (P2)

- Tiến trình nhiều bước: `ol` có `aria-current="step"`; 2 `confirm` → A1.
- Bảng cụm kết quả: `caption`, nút "Tạo thẻ từ cụm này" kèm tên cụm.

### 3.10 Danh sách phát, Bình chọn tháng — `Playlists.jsx`, `Player.jsx`, `Leaderboard.jsx` (P3)

- Player: nút phát/dừng `aria-pressed`, thanh tiến độ `role="slider"`; 1 `confirm` → A1.
- Leaderboard: bảng có `caption`, cột hạng là `th scope="row"`.

### 3.11 Kho & chia sẻ — `Spaces.jsx` (P1, gói P02 bảo mật)

- Bảng thành viên: `caption`, `select` vai trò có `aria-label="Vai trò của <tên>"`; nút gỡ kèm tên.
- 2 `confirm` (xoá kho, gỡ thành viên) → A1.
- Thẻ kho: chữ "Riêng tư / Công khai" rõ, không chỉ biểu tượng.

### 3.12 Kết nối AI — `Connect.jsx` (P2)

- Token chỉ hiện một lần: đặt trong `output` + nút "Sao chép" `aria-live` báo "Đã sao chép"; 1 `confirm` thu hồi → A1.
- Bổ sung khối hướng dẫn cho agent: đường dẫn `/llms.txt`, `/mcp`, `/openapi.json` (A9).

### 3.13 Trò chuyện Claude, Chat nhanh — `Chat.jsx`, `QuickChat.jsx` (P2)

- Vùng tin nhắn `role="log" aria-live="polite"`; mỗi tin `article` có `aria-label="Bạn"` / `"Claude"`.
- Ô soạn có `label`; nút Gửi `type="submit"`; 2 `confirm` (xoá luồng) → A1.
- Liên kết trong câu trả lời trỏ vào app (`appLink`) đang bắt `onClick` ở `div` cha: chuyển sang `a` thật với `href`, giữ hành vi mở popup.

### 3.14 Content Engine — `Projects.jsx`, `Project.jsx`, `ProjectAnalysis.jsx`, `Studio.jsx`, `Campaign.jsx` (848 dòng), `QuickWrite.jsx`, `Authors.jsx` (P2)

- 5 bảng có hàng `tr onClick` (Projects, Project ×2, Studio, QuickWrite) → `Link` ở ô tên (A3).
- Campaign: bảng kịch bản dùng `tr onClick` + `td stopPropagation` cho checkbox → checkbox có nhãn theo số thứ tự + tiêu đề, nút "Mở" riêng; 4 `confirm` → A1; các bước 7P / phân tích thành `ol` có `aria-current="step"`; URL `?tab=` cho từng khu (một phần đã có `searchParams`).
- Project: popup tạo chiến dịch / viết nhanh (2 overlay) → A4; 3 `confirm` → A1.
- ProjectAnalysis: 2 `confirm` → A1; kết quả phân tích có `h2`/`h3` phân đoạn để agent trích được.
- QuickWrite: trình soạn thảo có `label`; kết quả AI đặt trong `article aria-label="Bản nháp"`; nút "Sao chép" báo `aria-live`.
- Authors: overlay popup → A4; 1 `confirm` → A1; ảnh đại diện có `alt` tên người.
- A9: `/studio/projects/<id>.md`, `/studio/<id>.md`.

### 3.15 Học tập — `learn/Library.jsx` (691), `Design.jsx`, `PathEdit.jsx`, `Paths.jsx`, `MyLearning.jsx`, `Lesson.jsx`, `Attempt.jsx`, `Grading.jsx` (P1, gói P03–P04)

- **Library** (cây thư mục + bài học + câu hỏi): cây → `role="tree"`; nút thư mục có `aria-expanded`; kéo thả (nếu có sau này) phải có nút "Di chuyển vào…" tương đương; nhập câu hỏi từ file → thêm ô "Dán văn bản" (A10); 1 `confirm` → A1.
- **Design** (thiết kế lộ trình, AI): các bước `ol aria-current="step"`; kết quả AI có nút "Chấp nhận" / "Sửa" kèm tên mục; trạng thái "AI chưa sẵn sàng" là `role="status"`.
- **PathEdit / Paths**: bảng lộ trình `caption`; nút "Giao cho…" mở popup có `aria-labelledby`; 1 `confirm` → A1.
- **MyLearning**: danh sách bài đã giao `ul`; hạn nộp ghi chữ ("còn 3 ngày"); 1 `confirm` → A1.
- **Lesson**: nội dung bài là `article`; câu luyện tập `fieldset` + `legend` là câu hỏi, đáp án là `radio`/`checkbox` có `label`; 1 `confirm` → A1.
- **Attempt** (thi có giờ): đồng hồ `role="timer" aria-live="off"` + nhắc `aria-live="polite"` ở mốc 5 phút / 1 phút; nút "Nộp bài" là `type="submit"`, xác nhận nộp dùng A1 với tên "Nộp bài thi"; câu hỏi là `fieldset`/`legend`; điều hướng câu `nav aria-label="Câu hỏi"`.
- **Grading**: ô điểm là `input type="number"` có `label`; nhận xét có `label`; nút "Lưu điểm" kèm tên học viên.
- A9: `/learn/lessons/<id>.md`.

### 3.16 Cơ cấu tổ chức — `Org.jsx` (788 dòng), `Users.jsx`, `Admin.jsx` (P1, gói P05, P08)

- Cây đơn vị: `role="tree"`; hồ sơ nhân sự mở qua `?person=<id>` (A4).
- 4 `confirm` Org + 2 Users + 1 Admin → A1 (nghỉ việc, gỡ vai trò, uỷ quyền, khoá tài khoản).
- Nhập Excel/CSV: A10 thêm "Dán bảng CSV"; bảng xem trước lỗi có `caption` và cột "Dòng / Lỗi" dạng chữ.
- Users / Admin: `select` vai trò `aria-label="Vai trò của <tên>"`; nút "Đặt lại mật khẩu" kèm tên; cây lĩnh vực (`categoryEditor`) dùng chung với Wiki (3.6).

### 3.17 Hướng dẫn — `Guide.jsx`, `guide/content.js` (P2, đã tốt nhất về mặt máy đọc)

- Mỗi mục là `section id=<slug>` có `h2` (neo `#slug` hoạt động, hiện `id=` gần như không có).
- Mục lục `nav aria-label="Mục lục"`; nút "Sao chép lời nhắn" báo `aria-live`.
- Thêm mục mới **"Dành cho AI agent"**: cách đăng nhập, quy ước tên nút, `/llms.txt`, MCP, `.md` từng đối tượng, hạn chế (chọn file).

## 4. Phần C — SEO: lớp công khai

### C1. Vỏ sạch cho bot (P1, nửa ngày, không lộ dữ liệu)

- `robots.txt`: cho phép `/`, `/guide`, `/guide.md`, `/llms.txt`, `/sitemap.xml`; `Disallow` `/api/`, `/mcp`, `/assets/` để nguyên; chặn các route sau đăng nhập bằng `noindex` trong `index.html` khi chưa có phiên (`<meta name="robots" content="noindex">` gắn động qua `App.jsx`), vì robots.txt không ngăn index URL.
- **Soft-404**: SPA fallback trong `main.py` chỉ trả `index.html` cho route hợp lệ (danh sách route xuất từ `App.jsx` sang `frontend/routes.json` lúc build); còn lại trả **404** thật.
- Chuyển hướng cũ (`/videos`, `/jobs/*`, `/channels`) chuyển sang **301 ở BE** (giữ query), bỏ `Navigate` ở client.
- `index.html`: `lang="vi"` (đã có), `theme-color`, `canonical` động, Open Graph + Twitter card cơ bản, favicon PNG/SVG thật thay `data:` (đọc được khi chia sẻ link).
- Tiêu đề trang theo mẫu "Tên trang · VC Content Engine" (đã có) + `meta description` theo trang (hook `usePageMeta` mở rộng từ `usePageTitle`).

### C2. Hướng dẫn công khai đúng nghĩa (P1)

- `/guide` hiện là SPA sau đăng nhập; đã có `/guide.md`. Thêm **`/guide` bản HTML tĩnh do BE render** (Jinja từ `content.js` qua `guide.py`) khi chưa đăng nhập: `h1`/`h2` theo mục, `id` neo, breadcrumb JSON-LD (`BreadcrumbList`), `Article`/`FAQPage` cho mục "Hỏi đáp".
- `sitemap.xml` sinh động: `/`, `/guide`, `/guide#<id>` (hoặc `/guide/<id>`), và các trang C3 nếu có.

### C3. Cổng tri thức công khai (P2, chỉ khi anh muốn lộ nội dung; cần chốt trong BA)

- Chỉ thẻ **đã duyệt** thuộc kho có cờ mới `public_web = true` (thêm vào `spaces`, chủ kho + admin mới bật) mới lộ ra ngoài.
- Route BE render sẵn (server-side, Jinja, không cần JS): `/p/<slug>-<id>` trang thẻ, `/p/linh-vuc/<slug>` trang lĩnh vực, `/p` trang chủ cổng. Slug tiếng Việt không dấu từ tiêu đề (`text.js` đã có hàm bỏ dấu, chuyển sang Python dùng chung).
- JSON-LD `Article` (tiêu đề, ngày, tác giả là tên đơn vị, không lộ email), `BreadcrumbList`, `Organization`.
- `canonical` về `/p/…`; trang app `/wiki?card=` trỏ `link rel=canonical` sang bản công khai nếu có.
- `sitemap.xml` liệt kê thẻ công khai, `lastmod` = ngày duyệt; `robots.txt` cho phép `/p/`.
- Hình trong thẻ có `alt` (bắt buộc khi soạn: ô "Mô tả ảnh" trong trình soạn thẻ).
- Nội dung không muốn lộ (tên người, số nội bộ): bộ lọc "MẬT" theo mức mật trong ORG (BA 15.5) chặn xuất.

### C4. Hiệu năng và Core Web Vitals (P2)

- Vite: tách chunk theo route (`React.lazy` cho Campaign, Knowledge, Org, Library, Wiki), hiện bundle một khối.
- Font hệ thống hoặc `font-display: swap`; ảnh thumbnail `loading="lazy"` + `width/height` để tránh nhảy bố cục (CLS).
- Preload `/api/auth/me` song song với bundle để rút "màn trắng" đầu.
- Đo bằng Lighthouse CI trên `/`, `/guide`, `/p/…`; ngưỡng LCP < 2,5 s, CLS < 0,1.

### C5. Bài viết SEO do Content Engine sinh (đã có ở BA 5.8, không đổi)

- Không thuộc phạm vi đợt này. Chỉ nối một việc: khi mở C3, nút "Đăng lên cổng công khai" cho bài SEO đã duyệt (tái dùng render C3). Ghi vào backlog CE.

## 5. Lộ trình theo đợt

| Đợt | Nội dung | Kết quả kiểm chứng | Ước lượng |
|---|---|---|---|
| **1. Nền tảng** | A1 dialog + A2 toast + A5 `.sr-only`/landmark + A11 axe/jsx-a11y + C1 vỏ sạch, 404, 301 | axe chạy được trên mọi route (chưa cần xanh); Claude in Chrome không còn gặp `confirm` ở Wiki, Review, Spaces | 3–4 ngày |
| **2. Màn lõi P1** | 3.1, 3.3, 3.6, 3.8, 3.11, 3.15, 3.16 theo bảng; A3, A4, A6 cho các màn này; A10 | Chạy lại gói P01, P02, P03, P05, P08 bằng Claude in Chrome: 0 lần nhờ người bấm (ngoài chọn file) | 5–6 ngày |
| **3. Màn P2 + tầng `.md`** | 3.2, 3.5, 3.9, 3.12–3.14, 3.17; A9 `.md` + `/llms.txt`; C2 guide tĩnh + sitemap | axe 0 lỗi serious toàn app; Claude fetch `/llms.txt` rồi trả lời đúng "làm sao nạp nguồn" mà không cần đăng nhập | 4–5 ngày |
| **4. Màn P3 + cổng công khai** | 3.4, 3.7, 3.10; C3 (nếu chốt), C4 | Lighthouse SEO/A11y ≥ 95 trên trang công khai; Google Search Console nhận sitemap | 4–6 ngày |

Tổng 16–21 ngày công. Đợt 1–3 làm được ngay trên `develop` (giai đoạn test). Đợt 4 phần C3 cần anh chốt: có lộ nội dung VCWIKI ra ngoài hay không, và kho nào.

## 6. Quy ước kỹ thuật cần thống nhất (ghi ngay để mọi đợt dùng chung)

- `data-testid`: `<màn>-<đối tượng>-<hành động>`, chữ thường, không dấu, gạch nối.
- Tên nút hành động trên đối tượng: `"<Động từ> <loại>: <tên>"` trong `aria-label` (chữ hiện vẫn ngắn), ví dụ `aria-label="Xoá thẻ: Mã lỗi DTC là gì"`.
- Popup: luôn có `aria-labelledby` trỏ `h2` trong popup; luôn có query mở lại được.
- Trạng thái: chữ trước, màu sau; `data-status` trên phần tử bao.
- Thông báo thành công: qua `toast()` dùng chung, không tự viết `setTimeout`.
- Không dùng `window.confirm` / `window.prompt` / `alert` (ESLint `no-restricted-globals`).
- Mỗi đối tượng có trang: có `.md` tương ứng và `link rel="alternate"`.

## 7. Quyết định đã chốt (28/09/2026)

1. **C3 cổng công khai: làm.** Kho nào chủ kho bật cờ `public_web` thì thẻ đã duyệt trong kho đó lộ ra ngoài; không bật thì không lộ.
2. **Tên miền công khai: `wiki.vcprosperous.com`** (subdomain của tên miền công ty; đổi được qua biến cấu hình `PUBLIC_BASE_URL` trong `backend/app/config.py`, mọi `canonical` / `sitemap` / JSON-LD đọc từ đó). Bản app nội bộ giữ nguyên địa chỉ hiện tại.
3. **Toast: 8 giây**, có nút đóng, dừng đếm khi trỏ chuột hoặc tiêu điểm vào, lịch sử 5 thông báo gần nhất.
4. **Thứ tự làm: đợt 2 trước** (màn lõi P1: vỏ app, Kho tư liệu, VCWIKI, Hộp duyệt, Kho & chia sẻ, Học tập, Cơ cấu tổ chức), kéo theo phần nền tảng A1, A2, A3, A4, A5, A6, A10 mà các màn này cần. Đợt 1 còn lại (axe, jsx-a11y, C1 vỏ sạch) và đợt 3, 4 làm tiếp sau.
