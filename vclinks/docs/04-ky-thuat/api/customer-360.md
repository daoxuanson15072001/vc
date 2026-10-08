# Customer 360, panel khách và dòng thời gian (M1b-13)

Phiên bản 0.1 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Tài liệu mô tả phần code của phiên M1b-13: trang Customer 360 (`/customers/:id`), panel Khách trong khung chat, dòng thời gian hợp nhất, danh sách khách, trang Đối chiếu mã KH, ô tìm khách ở Ctrl+K.
- SĐT và email trong hồ sơ khách che theo quyền (DK-44): owner và người giữ nick thấy đủ, người có quyền "Hiện" bấm xem 60 giây và bị ghi nhật ký, còn lại thấy dạng che. Không nới ô ma trận nào trong `phan-quyen.md` mục 4.
- Dữ liệu thương mại lấy từ VCsales **mô phỏng** (`VCSALE_MODE=mock`, chưa có API ERP). Chỉ đọc, có giờ lấy, mất kết nối thì giữ bản chụp cũ kèm ERR-ERP.
- Mở 360 của khách nhiều tin nhất trên bản sao dữ liệu thật: 6 đến 18 ms (yêu cầu ≤ 3 giây).
- Chưa làm (để phiên sau): tách danh tính và gắn tay, sửa tag, "Cam kết đã nêu", kiểm tra mâu thuẫn trước khi gửi (MH-DK-09), tab Tra hàng / Báo giá / Việc, màn hình điện thoại.
- **Người duyệt cần xem kỹ:** mục 3 (ai thấy SĐT và dữ liệu thương mại) và mục 7 (các ca UAT chưa đạt, lý do).

## Mục lục

- [1. Route và quyền](#1-route-và-quyền)
- [2. Dữ liệu trả về](#2-dữ-liệu-trả-về)
- [3. Che SĐT, email và khối thương mại theo quyền](#3-che-sđt-email-và-khối-thương-mại-theo-quyền)
- [4. Dòng thời gian](#4-dòng-thời-gian)
- [5. Panel trong khung chat](#5-panel-trong-khung-chat)
- [6. Ctrl+K và menu](#6-ctrlk-và-menu)
- [7. Kiểm tra, số đo và việc chưa làm](#7-kiểm-tra-số-đo-và-việc-chưa-làm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Route và quyền

| Route API | Quyền (`route-permissions.ts`) | Việc |
|---|---|---|
| `GET /api/customers/:id/360` | `cust.view` | Trang 360: hồ sơ, danh tính, hoạt động, thương mại, 5 sự kiện gần nhất. `?refresh=1` lấy lại khối VCsales |
| `GET /api/customers/by-identity/:uid/:userId/360` | `cust.view` trên kênh `uid` | Panel khung chat: cùng dữ liệu, thêm `identity`, `crossNick`, `unconfirmed` |
| `GET /api/customers/:id/timeline` | `cust.timeline` (service kiểm lại trên khách) | Dòng thời gian, lọc `contact`, `uid`, `type`, `from`, `to`, `q`, phân trang `before` |
| `POST /api/customers/:id/reveal` | `cust.view` (service kiểm `cust.phone_full`) | "Hiện" / "Sao chép" SĐT hoặc email |
| `GET /api/search/quick` | `search.global` | Thêm nguồn khách (`kind: 'customer'`) |

Trang web: `/customers` (danh sách), `/customers/:id?tab=` (8 tab), `/customers/erp-matching` (MH-DK-13). Mọi route trước đó của M1b-12 giữ nguyên.

## 2. Dữ liệu trả về

- Kiểu dùng chung ở `packages/shared/src/customer360.ts` (`Customer360`, `TimelineEvent`, `CommerceBlock`...).
- `viewer`: `phone` (`full` / `reveal` / `masked`), `commerce` (`full` / `none`), `timeline`, `isOwner`, `canConfirmErp`. Giao diện chỉ dựa vào đây để hiện nút.
- `activity`: mỗi danh tính của khách có tin vào trong 7 ngày là một dòng (kênh, tên nick, người giữ nick, số tin chưa trả lời, `locked` nếu người xem không mở được hội thoại). Chấm xanh khi tin vào ≤ 30 phút.
- `crossNick`: nick khác của cùng khách có tin chưa trả lời trong 24 giờ ("Khách này cũng nhắn Zalo · Hải (1 tin chưa trả lời)", UAT-DK-73).
- `recommendedConversationId`: hội thoại mở được, có tin chưa trả lời, tin vào mới nhất.
- `commerceHidden`: `no_right` (không có quyền), `unconfirmed` (danh tính chưa xác nhận, DK-15), `no_link` (chưa có mã KH).

## 3. Che SĐT, email và khối thương mại theo quyền

- Trước đây bộ chặn `PhoneMaskInterceptor` che mọi trường `phone` theo **một kênh**, mà hồ sơ khách không có kênh nên luôn che. Nay `/api/customers` nằm trong danh sách bỏ qua của bộ chặn; `CustomersService.detail` tự che bằng `CustomerPrivacyService` (`customers/customer-privacy.ts`).
- Cách tính: dựng các đối tượng (target) của khách: một cho mỗi division có owner (owner, tổ của owner) và một cho mỗi danh tính kênh (người giữ nick). Hàm `phoneVisibility` có sẵn của engine chạy trên từng đối tượng, lấy mức cao nhất. **Không sửa ô ma trận nào.**
- Kết quả theo vai trò (khớp UAT-DK-13, 13a): NVKD owner và người giữ nick thấy đủ, không nút "Hiện", không ghi `phone.reveal`; GS (tổ của owner), GĐ division, sale admin thấy `0900 *** 101` kèm nút "Hiện"; người ngoài phạm vi nhận 404 "Không tìm thấy hoặc bạn không có quyền xem" không kèm tên khách.
- "Hiện" gọi `POST /api/customers/:id/reveal`: ghi `phone.reveal` (hoặc `email.reveal`) vào `audit_log`, **không có số trong nhật ký**; hiện 60 giây rồi tự che (giao diện). Hiện quá nhiều lần trong một giờ thì cảnh báo R1 như `/api/reveal`.
- Khối thương mại chỉ khi có `cust.commerce`. Ô "CS xem phần đơn hàng" (`orders_only`) vẫn **đóng** như `phan-quyen.md` mục 4: code đã chừa chỗ, chưa truyền điều kiện, nên CS hiện chưa thấy khối này. UAT-DK-14 phần CS chờ có ticket (M2).
- Dòng thời gian và 5 sự kiện gần nhất cần `cust.timeline`; sale admin có ô này kèm điều kiện `no_messages` (đóng) nên chưa mở được.

## 4. Dòng thời gian

- Tin của mọi danh tính trong hồ sơ, sắp theo giờ gốc (`sentAt`), cộng thao tác hồ sơ (gộp, hoàn tác, liên kết mã KH). Chỉ mục `(uid, threadId, sentAt)` có sẵn, nên không cần chỉ mục mới.
- Hội thoại người xem không mở được (`conv.view` trên đối tượng hội thoại): **không đọc nội dung**, trả dòng `hidden` có số tin ("3 tin · bạn không có quyền xem nội dung"). Tìm theo chữ (`q`) chỉ chạy trên hội thoại mở được.
- Cụm tin, vạch "Chuyển sang", dải "Khách dùng n kênh trong 1 giờ", tiêu đề ngày vẽ ở trình duyệt (`apps/web/src/utils/timeline.ts`, có test). Cụm đặt ở tin đầu tiên của cụm; tin của kênh khác có thể xen giữa các tin cùng cụm (UAT-DK-79).
- Nội dung đã mã hóa theo khách (M1b-14) được giải mã qua `MessageVault.open` như trang hội thoại; khách đã xóa hiện "[Đã ẩn danh]".

## 5. Panel trong khung chat

- `CustomerPanel` (`apps/web/src/components/customers/`): tên khách, "Mở 360 ↗", loại và khu vực, chip kênh, người liên hệ, SĐT theo quyền, phụ trách (chữ cam nếu người xem không phải owner), mã KH, cảnh báo nick khác, "Liên lạc gần đây" (3 dòng, dòng khóa có tooltip), khối thương mại có nút ↻.
- Hiện sẵn khi cửa sổ ≥ 1360 px, Alt+P ẩn / hiện, hẹp hơn thì mở bằng nút "Khách" thành ngăn kéo.
- Danh tính chưa xác nhận: banner vàng, khối thương mại thay bằng khung viền đỏ "Không chia sẻ với người trong hội thoại này", API không trả dữ liệu thương mại.
- Hội thoại chưa có hồ sơ (nhóm chat, khách mới): "Hội thoại này chưa gắn với hồ sơ khách."

## 6. Ctrl+K và menu

- `ShellService.quickSearch` gọi thêm `CustomersService.quickSearch`: tên không dấu (trường `nameFold`, ghi dần mỗi phút một lần cho tài khoản chưa có), mã KH, hoặc từ 3 chữ số SĐT. Chỉ trong các khách người xem được; SĐT luôn che. Khách xếp trước liên hệ, bấm mở `/customers/:id`.
- Menu "KHÁCH HÀNG": thêm "Khách hàng" (`cust.view`) và "Đối chiếu mã KH" (`cust.erp_link`: sale admin xác nhận, GĐ division chỉ xem, GS không có). Test `nav.test.ts` kiểm đủ 10 vai trò.

## 7. Kiểm tra, số đo và việc chưa làm

| Việc | Kết quả |
|---|---|
| Test e2e `apps/api/test/e2e/customer-360.e2e-spec.ts` (20 ca) | UAT-DK-13, 13a, 14 (phần KD), 15 (phần Zalo), 17, 18, 73, 79 (sắp xếp), UI-67 (VCsales lỗi), DK-15, Ctrl+K |
| Test web `utils/timeline.test.ts`, `utils/nav.test.ts` | Cụm 3 tin, vạch "Chuyển sang OA · sau 1 phút", dải đa kênh, menu theo vai trò |
| Đo mở 360 | `pnpm --filter @vclinks/api build && MONGO_URI=<bản sao> node dist/scripts/measure-360.js`. Bản sao dữ liệu thật (16.206 tin, 1.436 khách): khách nhiều tin nhất 554 tin, 1 danh tính: 18 ms lần đầu, 6 đến 7 ms các lần sau. Dữ liệu seed 20.000 tin một khách: 19 ms |

Chưa làm và lý do:

- **UAT-DK-25, 26** (kiểm tra mâu thuẫn trước khi gửi, MH-DK-09B, báo giá VCsales): cần chặn ở đường gửi (outbox), phiên khác đang sửa, và dính §12.1. Để phiên có chủ đích riêng.
- **UAT-DK-38** ("Cam kết đã nêu"): cần bộ trích cam kết (DK-49) chưa có.
- **UAT-DK-15, 16 phần Fanpage / "Soạn ở kênh này"**: cần kênh Fanpage và OA (M4).
- **UAT-DK-14 phần CS**: chờ ticket (M2) và điều kiện `orders_only`.
- Tách danh tính, gắn tay (MH-DK-06, 07), sửa tag, đổi chủ, tab Việc / Hóa đơn có dữ liệu, bản điện thoại (00 MH-UI-11 #M1 đến #M8), cột "Khách VClinks" trong Danh bạ.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 04/10/2026 22:04 | Agent Sonnet · M1b-13 | Tạo tài liệu: route 360, che SĐT theo quyền, dòng thời gian, panel, Ctrl+K, số đo, việc chưa làm | Phiên M1b-13 |
