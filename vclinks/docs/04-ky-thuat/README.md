# Tài liệu kỹ thuật — thư mục `docs/04-ky-thuat/`

Phiên bản 0.25 · 07/10/2026 · Trạng thái: Đang áp dụng

## Tóm tắt

- Tài liệu kỹ thuật cho dev và AI: API (REST, MCP), hướng dẫn kết nối từng kênh, khảo sát Zalo Web.
- Ba nhóm con: `api/`, `kenh/` (có README riêng), `zalo-web/`.
- Nhiều chỗ tài liệu lệch code (cột Ghi chú). Chủ dự án quyết **không sửa tài liệu theo code** (04/10/2026); chỉ ghi lại ở đây.
- Đáng chú ý: `rest-api.md` thiếu khoảng 20 nhóm endpoint; `zalo-dom-selectors.md` và code hiểu `message.status = 3` khác nhau.

## Mục lục

- [api/](#api)
- [kenh/](#kenh)
- [zalo-web/](#zalo-web)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## api/

| File | Tóm tắt 1 dòng | Phiên bản | Cập nhật | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| [bao-cao.md](api/bao-cao.md) | Báo cáo cơ bản `/reports`: API hiệu suất, lượt chờ, xuất Excel; ai thấy gì; việc chưa làm | 0.2 | 04/10/2026 | Chờ duyệt | M1c-09 |
| [rest-api.md](api/rest-api.md) | Danh mục REST `/api` GĐ1 theo scope: ingest của extension, Dashboard, bảng ánh xạ và drift | 1.1 | 04/10/2026 | Đang áp dụng | **Lệch nhiều:** thiếu outbox, autosync, webhooks, channels, media, fetch-requests…; thiếu scope `dev`; thiếu stream tùy chọn |
| [mcp-client-guide.md](api/mcp-client-guide.md) | Hướng dẫn Claude dùng MCP `/mcp`: theo dõi đồng bộ, xử lý drift, đẩy dự phòng, gửi tin đã duyệt | 1.1 | 04/10/2026 | Đang áp dụng | Ví dụ cấu hình còn tên cũ `vczalo` / `VCZALO_AUTH`; chưa nói "Gửi lại" áp dụng cho tin `failed` |
| [dev-mcp.md](api/dev-mcp.md) | MCP `vclinks-dev`: quy trình yêu cầu BA → Design → Code, tool, cài đặt, việc từng chặng | 1.1 | 04/10/2026 | Đang áp dụng | Đường dẫn cũ `docs/vclinks-ba.md` (nay ở `docs/02-yeu-cau/`), cả trong `dev-mcp.tools.ts`; thư mục worktree tên cũ `VCzalo-worktrees/` |
| [quan-tri-to-chuc.md](api/quan-tri-to-chuc.md) | API quản trị `/api/admin/*`: cây tổ chức, người dùng và gán vai trò, nhập lô CSV/Excel, luật PQ-41/PQ-42 | 0.2 | 04/10/2026 | Chờ duyệt | Đã gắn quyền (M1b-04); thử bằng dữ liệu TD, chờ file nhân sự thật E4 |
| [panel-thong-tin-l5.md](api/panel-thong-tin-l5.md) | Panel thông tin hội thoại (API `/shared`), loại tin L5 (vị trí, cuộc gọi, nhắc hẹn), quyền riêng tư, mẫu thật cần thử (M1c-08) | 0.3 | 04/10/2026 | Nháp | Selector L5 là phỏng đoán, chờ mẫu thật |
| [gui-bao-gia.md](api/gui-bao-gia.md) | Gửi báo giá VCsales trong khung chat: hộp gửi, chặn hết hạn / hủy / khác khách ở API, lệnh `send_quote`, `quote_sends`, công nợ (dòng thống nhất, chip, lọc, tự nhắc), checklist thử (M1c-02); đọc VCsales thật qua `vclinks-bridge` từ 07/10 | 0.3 | 07/10/2026 | Nháp | Chỉ PDF với VCsales thật; nhắc việc, ảnh xem trước, báo kế toán chưa làm |
| [phieu-cskh.md](api/phieu-cskh.md) | Phiếu báo giá / hậu mãi CSKH soạn ⇄ NVKD duyệt: máy trạng thái D9-02, hàng việc, Duyệt & gửi qua QuotesService / outbox, CSKH không gửi qua nick, nhắc 10′ / giám sát 20′ (M1c-03) | 0.1 | 05/10/2026 | Nháp | Giao diện chờ thiết kế E6; T-36, C3, QĐ-04 chờ E7; GS duyệt thay chờ ô on_behalf |
| [tim-kiem.md](api/tim-kiem.md) | Tìm tin nhắn toàn văn theo quyền: không dấu, SĐT / mã OE / biển số, che SĐT, nhảy tới tin `?msg=` (M1c-05) | 0.2 | 04/10/2026 | Chờ duyệt |
| [vclinks-bridge.md](api/vclinks-bridge.md) | Thiết kế `vclinks-bridge` (API chỉ đọc VCsales cho VClinks): cấu trúc ứng dụng, cấu hình, khóa API, số liệu thật máy dev `.10`, 11 API kèm câu truy vấn MongoDB, cách tính nợ lai sổ cái / hóa đơn, cách `vcsale-client` gọi; kết quả chạy trên máy dev | 0.1 | 07/10/2026 | Chờ duyệt | Sổ cái dev mới có 4 bút toán 131; 28/40 nhân viên kinh doanh thiếu email; lỗi số tiền bằng chữ của VCsales |
| [viec-vcsales.md](api/viec-vcsales.md) | Danh mục VCsales (xem trước, nạp toàn bộ, đồng bộ thay đổi mỗi giờ, khách xóa, giữ mã cho phiếu đang chờ) và Việc VCsales 02 MH-DK-12 (4 loại việc, xử lý, đồng bộ tự đóng / mở lại việc, API, quyền) | 0.1 | 07/10/2026 | Chờ duyệt | Chưa nạp danh mục thật trên 129 (Q7); đoạn trích tin nguồn, gợi ý cho lead chưa làm |
| [kho-file-va-ghi-am.md](api/kho-file-va-ghi-am.md) | Kho file công ty (ảnh, tệp, ghi âm, video), create_upload_url / confirm_upload, hàng đợi ghi âm → chữ, quyền và xóa theo khách; quyết định giữ GridFS | 0.2 | 04/10/2026 | Chờ duyệt | M1c-04; chưa thử ghi âm thật qua nick test |
| [realtime.md](api/realtime.md) | Luồng SSE realtime lọc theo quyền (tin mới, lệnh lỗi, nick đỏ, thông báo) và giám sát SLA 15 phút trong giờ làm việc (M1c-07) | 0.2 | 04/10/2026 | Chờ duyệt |
| [phan-quyen.md](api/phan-quyen.md) | Engine phân quyền: ma trận sinh từ đặc tả, khai báo quyền từng route, lọc dữ liệu trong truy vấn, ẩn SĐT, bảng ô ma trận dịch hẹp, màn hình và thành phần dùng chung (M1b-05), gán kênh, token thiết bị và MCP (M1b-06), quyền tạm thời, trực thay, Cần duyệt lại (M1b-10), nghỉ việc và bàn giao (M1b-11) | 0.6 | 04/10/2026 | Chờ duyệt | 94 ô chữ tự do dịch hẹp chờ chủ dự án chốt; phạm vi CT/TK/LEAD/TUYẾN chờ M1b-09, M1b-12 |
| [mo-hinh-khach.md](api/mo-hinh-khach.md) | Mô hình khách ba cấp, 7 collection, nạp danh mục VCsales, quy tắc tự gộp D8-05 và hoàn tác, migration có cách lùi (M1b-12); màn Kết nối VCsales (ghép nhân viên theo email) | 0.2 | 07/10/2026 | Chờ duyệt | Chưa có nút gỡ liên kết mã KH; ghép tay nhân viên thiếu email chưa làm |
| [customer-360.md](api/customer-360.md) | Customer 360, panel Khách trong khung chat, dòng thời gian hợp nhất, che SĐT theo quyền, Ctrl+K tìm khách, số đo mở 360 (M1b-13) | 0.1 | 04/10/2026 | Chờ duyệt | Ca UAT-DK-25, 26, 38 chưa làm; VCsales là bản mô phỏng |
| [muc-mat-va-khoa-theo-khach.md](api/muc-mat-va-khoa-theo-khach.md) | Mức mật C0–C3, cổng chặn C3 trước AI ngoài, khóa mã hóa theo khách, hủy khóa và áp lại sau khôi phục backup (M1b-14) | 0.2 | 04/10/2026 | Chờ duyệt | Mẫu nhận diện C3; khách đã xóa nhắn tiếp; danh sách chỗ đọc tin trước khi bật mã hóa |
| [goi-y-ai.md](api/goi-y-ai.md) | Gợi ý trả lời AI: nháp dưới ô soạn, khung prompt chống injection, cờ rủi ro, bộ lọc đầu ra, playbook theo vai trò, cách bật Claude API khi có E8 (M1c-06) | 0.3 | 06/10/2026 | Chờ duyệt | Chạy mock tới khi có E8; VCwiki và tra giá / tồn VCsales là bản mô phỏng; chưa có BullMQ |
| [nhat-ky-canh-bao.md](api/nhat-ky-canh-bao.md) | Nhật ký truy cập (lọc theo phạm vi), Hoạt động của tôi, cảnh báo bất thường R1–R9 và quy tắc cảnh báo (M1b-07) | 0.1 | 04/10/2026 | Nháp | R6, R7, R10, R11 chờ dữ liệu IP / token thiết bị / bàn giao; ghi mcp.call chờ M1b-06 |

## kenh/

Hướng dẫn kết nối Zalo OA, Fanpage, Facebook cá nhân. Quản lý chi tiết: [kenh/README.md](kenh/README.md).

| File | Tóm tắt 1 dòng | Phiên bản | Cập nhật | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| [zalo-oa.md](kenh/zalo-oa.md) | Kết nối Zalo OA bằng API chính thức: webhook có ký, OAuth PKCE, gửi tin Tư vấn đã duyệt, tự làm mới token | 1.2 | 07/10/2026 | Đang áp dụng | Bảng lỗi §6 thiếu mã `-200`, `-201`, `-204`, `-205`, `-210`, `-224`, `-248` có trong `zalo-oa.sender.ts` |
| [facebook-page.md](kenh/facebook-page.md) | Kết nối Fanpage qua Messenger Platform: Meta App, quyền, webhook ký, gửi trong khung 24 giờ, App Review | 1.1 | 04/10/2026 | Đang áp dụng | Khớp code |
| [facebook-personal.md](kenh/facebook-personal.md) | Facebook cá nhân qua extension đọc DOM Messenger: giới hạn, msgId, nhịp gửi an toàn, checklist selector | 1.1 | 04/10/2026 | Đang áp dụng | Chưa kiểm chứng giới hạn "20 tin/giờ", "30 giây" trong code |

## zalo-web/

| File | Tóm tắt 1 dòng | Phiên bản | Cập nhật | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| [zalo-web-extraction.md](zalo-web/zalo-web-extraction.md) | Khảo sát Zalo Web: siêu dữ liệu từ IndexedDB, nội dung từ DOM, đồng bộ tự động và quy tắc gửi tin | 1.2 | 04/10/2026 | Đang áp dụng | Tên endpoint, tên reader, chu kỳ poll là thiết kế ban đầu, khác code hiện tại |
| [zalo-dom-selectors.md](zalo-web/zalo-dom-selectors.md) | Selector DOM thật của bong bóng tin, thanh bên, khung chat, danh sách bạn bè, lời mời kết bạn Zalo Web; phân loại và báo drift; kết quả tìm kiếm | 1.5 | 04/10/2026 | Đang áp dụng | `status = 3` ghi "Đã gửi", còn code và feature-map coi là "Đã xem" |
| [zalo-web-feature-map.md](zalo-web/zalo-web-feature-map.md) | Ánh xạ mọi tính năng Zalo Web sang VClinks: kiểu ánh xạ, hiện trạng, ưu tiên, lô L1–L5 | 1.3 | 04/10/2026 | Đang áp dụng | Nhịp gửi theo nick (M1a-06) đã ghi ở §2; nhiều dòng hiện trạng đã cũ (E4–E8, B5); link `vclinks-ba.md` gãy |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.25 | 07/10/2026 12:12 | Claude Code (dev002) | api/goi-y-ai.md lên 0.3 (biến `ANTHROPIC_WORKSPACE_ID`); cùng phiên: thêm api/vclinks-bridge.md (0.1), api/gui-bao-gia.md lên 0.3, api/mo-hinh-khach.md lên 0.2 (đọc VCsales thật); thêm api/viec-vcsales.md (0.1) | Kiểm hệ thống 06/10/2026 |
| 0.24 | 06/10/2026 08:58 | Claude Code (dev002) | zalo-web-extraction.md lên 1.2 (ngoại lệ mở hội thoại chưa đọc) | Yêu cầu dev002 06/10/2026 |
| 0.23 | 05/10/2026 00:05 | Agent Opus · M1c-03 | Thêm api/phieu-cskh.md (phiếu CSKH soạn – NVKD duyệt) | Phiên M1c-03 |
| 0.22 | 04/10/2026 23:27 | Agent Sonnet · M1c-02 | Thêm api/gui-bao-gia.md (gửi báo giá, công nợ, checklist thử); panel-thong-tin-l5.md lên 0.3 (tab Báo giá đã nối) (nhánh ghi 0.21, gác cổng đánh lại 0.22) | Phiên M1c-02 |
| 0.21 | 04/10/2026 23:16 | Agent Sonnet · M1b-18 | phan-quyen.md lên 0.6 (quyền hộ, Phạm vi ảnh hưởng, Sắp nghỉ) (nhánh ghi 0.19, gác cổng đánh lại 0.21) | Phiên M1b-18 |
| 0.20 | 04/10/2026 23:02 | Agent Sonnet · M1c-04 | Thêm api/kho-file-va-ghi-am.md (kho file công ty, create_upload_url, hàng đợi ghi âm → chữ) (nhánh ghi 0.18, gác cổng đánh lại 0.20); gác cổng: kho-file-va-ghi-am.md lên 0.2 | Phiên M1c-04 |
| 0.19 | 04/10/2026 22:57 | Agent Sonnet · M1c-05 | Thêm dòng tim-kiem.md (tìm tin nhắn) (nhánh ghi 0.18, gác cổng đánh lại 0.19); gác cổng: tim-kiem.md lên 0.2 | Phiên M1c-05 |
| 0.17 | 04/10/2026 22:32 | Agent Opus · M1c-06 | Thêm goi-y-ai.md (gợi ý trả lời AI) (nhánh ghi 0.15, gác cổng đánh lại 0.17); gác cổng: goi-y-ai.md lên 0.2 | Phiên M1c-06 |
| 0.16 | 04/10/2026 22:09 | Claude Code · M1c-07 | Thêm dòng realtime.md (nhánh ghi 0.13, gác cổng đánh lại 0.16); gác cổng: realtime.md lên 0.2 | Phiên M1c-07 |
| 0.15 | 04/10/2026 22:12 | Claude Code · M1c-09 | Thêm api/bao-cao.md (báo cáo cơ bản) (nhánh ghi 0.13, gác cổng đánh lại 0.15); gác cổng: bao-cao.md lên 0.2 | Phiên M1c-09 |
| 0.14 | 04/10/2026 22:04 | Agent Sonnet · M1b-13 | Thêm dòng customer-360.md | Phiên M1b-13 |
| 0.13 | 04/10/2026 21:59 | Claude Code · M1b-11 | phan-quyen.md lên 0.5 (nghỉ việc, bàn giao) | Phiên M1b-11 |
| 0.12 | 04/10/2026 20:44 | Claude Code · M1a-06 | Cập nhật dòng zalo-dom-selectors.md lên 1.4, zalo-web-feature-map.md lên 1.2 | Phiên M1a-06 |
| 0.11 | 04/10/2026 20:41 | Claude Code · gác cổng M1b-10 | Gộp M1b-10: phan-quyen.md lên 0.4 (nhánh M1b-10 ghi 0.9, đánh lại 0.11) | Gác cổng M1b-10 |
| 0.10 | 04/10/2026 20:30 | Claude Code · gác cổng M1b-12 | Dòng muc-mat-va-khoa-theo-khach.md lên 0.2 | Gác cổng M1b-12 |
| 0.9 | 04/10/2026 20:22 | Claude Code · M1b-12 | Thêm dòng mo-hinh-khach.md | Phiên M1b-12 |
| 0.8 | 04/10/2026 20:25 | Claude Code · M1b-06 | phan-quyen.md lên 0.3 | Phiên M1b-06 |
| 0.7 | 04/10/2026 20:19 | Claude Code · M1b-07 | Thêm dòng nhat-ky-canh-bao.md | Phiên M1b-07 |
| 0.6 | 04/10/2026 19:47 | Claude Code · M1a-04 | Cập nhật dòng zalo-dom-selectors.md lên 1.3 (lời mời kết bạn, hộp Thêm bạn) | Phiên M1a-04 |
| 0.5 | 04/10/2026 20:04 | Claude Code · M1b-14 | Thêm dòng muc-mat-va-khoa-theo-khach.md | Phiên M1b-14 |
| 0.4 | 04/10/2026 19:18 | Claude Code · M1b-05 | phan-quyen.md lên 0.2 | Phiên M1b-05 |
| 0.3 | 04/10/2026 19:07 | Claude Code · M1b-04 | Thêm dòng phan-quyen.md; quan-tri-to-chuc.md lên 0.2 | Phiên M1b-04 |
| 0.2 | 04/10/2026 18:18 | Claude Code · M1b-03 | Thêm dòng quan-tri-to-chuc.md | Phiên M1b-03 |
| 0.1 | 04/10/2026 13:33 | Claude Code | Tạo file quản lý thư mục khi sắp xếp lại docs/ | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:33 |
