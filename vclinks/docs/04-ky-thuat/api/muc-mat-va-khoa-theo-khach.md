# Mức mật C0–C3 và khóa mã hóa theo khách (M1b-14)

Phiên bản 0.2 · 04/10/2026 · Trạng thái: Chờ duyệt

## Tóm tắt

- Có hai việc bảo mật nền theo BA §2.2 #8, #9: **cổng mức mật** đứng trước mọi lời gọi AI ngoài, và **khóa mã hóa riêng cho từng khách**. Ẩn danh một khách nghĩa là hủy khóa của khách đó.
- Mức mật C0–C3 nằm trong `packages/shared/src/sensitivity.ts`. Hội thoại mặc định là C2. Một phần ngữ cảnh là C3 khi nguồn tự đánh dấu C3 (công nợ, hạn mức hay giá riêng lấy từ VCsale), hoặc khi trong chữ có từ khóa C3 đứng cạnh một số tiền.
- `AiGateway` (`apps/api/src/security/ai-gateway.ts`) là đường duy nhất để gọi AI ngoài. Ngữ cảnh có C3 thì **chặn cả lời gọi** (chủ dự án chốt Q2) và ghi nhật ký `ai.gate_blocked`, nhật ký chỉ có số đếm. Một test quét mã bảo đảm không file nào khác dùng client AI.
- Mỗi danh tính kênh (`${uid}:${userId}`, trùng `identity_links._id` của M1b-12) có một khóa riêng. Khóa được bọc bằng khóa chủ `CUSTOMER_KEK` lấy từ biến môi trường, không lưu trong DB. Hủy khóa thì tin của khách hiện "[Đã ẩn danh]", các khách khác không bị ảnh hưởng.
- Mỗi lần xóa được ghi vào **sổ xóa** đặt ở một database riêng (`ERASURE_LEDGER_DB`). Sau khi khôi phục backup, chạy `security:reapply-erasures` để hủy lại các khóa đã xóa.
- **Công tắc `CUSTOMER_ENCRYPTION`** mặc định tắt (chủ dự án chốt Q1), vì nội dung đã mã hóa thì chỉ mục tìm kiếm toàn văn không đọc được. Khi tắt, lệnh xóa vẫn xóa nội dung dạng rõ của khách đó.
- `stripC3()` có sẵn để MCP lọc dữ liệu trước khi trả ra. Phiên này chưa sửa tool MCP nào (Q3).
- **Người duyệt cần xem kỹ:** cách nhận diện C3 bằng mẫu chữ (mục 2); hành vi khi khách đã bị xóa mà vẫn nhắn tiếp (mục 3); những chỗ đọc tin chưa giải mã trước khi bật công tắc (mục 5).

## Mục lục

- [1. Thành phần](#1-thành-phần)
- [2. Mức mật và cổng trước AI ngoài](#2-mức-mật-và-cổng-trước-ai-ngoài)
- [3. Khóa theo khách, hủy khóa, áp lại sau khôi phục](#3-khóa-theo-khách-hủy-khóa-áp-lại-sau-khôi-phục)
- [4. Biến môi trường và route](#4-biến-môi-trường-và-route)
- [5. Việc còn lại trước khi bật mã hóa](#5-việc-còn-lại-trước-khi-bật-mã-hóa)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Thành phần

| File | Việc |
|---|---|
| `packages/shared/src/sensitivity.ts` | `SENSITIVITY_LEVELS`, `classifyPart`, `classifyContext`, `detectSensitivity`, `stripC3`, `aiContextSchema`, `C3_BLOCKED_TEXT`, `ERASED_TEXT` |
| `apps/api/src/security/ai-gateway.ts` | `gate()` (hàm thuần) và `AiGateway.complete()` / `check()` |
| `apps/api/src/security/ai-client.ts` | Token `EXTERNAL_AI_CLIENT`. Mặc định là client từ chối mọi lời gọi; client thật gắn ở M1c (cần E8) |
| `apps/api/src/security/customer-keys.service.ts` | Khóa theo khách, mã hóa hai tầng AES-256-GCM, `erase`, `reapplyErasures` |
| `apps/api/src/security/subject-resolver.ts` | Token `SUBJECT_RESOLVER` để M1b-12 nối danh tính với khách (`identityIdsOfAccount`, `accountOfIdentity`) |
| `apps/api/src/security/message-vault.ts` | Mã hóa nội dung tin sau khi ghi (`sealMessages`), giải mã khi đọc (`open`), xóa nội dung dạng rõ (`scrubSubjects`) |
| `apps/api/src/security/security.controller.ts` | `GET /api/security/status`, `POST /api/security/erase` |
| `apps/api/src/scripts/reapply-erasures.ts` | Lệnh chạy sau khi khôi phục backup |

## 2. Mức mật và cổng trước AI ngoài

- **C0** công khai · **C1** nội bộ (playbook, thẻ VCwiki) · **C2** nội dung hội thoại, hồ sơ khách · **C3** công nợ, hạn mức, chính sách giá riêng.
- Mỗi loại phần ngữ cảnh có mức mặc định: lời dặn (`instruction`), playbook và thẻ wiki là C1; tin nhắn, hồ sơ, kết quả tra VCsale và phần khác là C2. Mức khai báo không bao giờ bị hạ.
- **Nhận diện C3 bằng mẫu chữ** (đã bỏ dấu tiếng Việt): một từ khóa (`công nợ`, `nợ quá hạn`, `dư nợ`, `hạn mức`, `tín dụng`, `chính sách giá`, `giá riêng`, `chiết khấu riêng`, `giá đại lý cấp`…) đứng trong khoảng 60 ký tự quanh một số tiền (`đ`, `k`, `triệu`, `tr`, `tỷ`, `%`, hoặc số có dấu phân cách hàng nghìn).
  - "Giá 850.000 đ anh ạ" vẫn là C2, vì giá niêm yết không phải số mật.
  - "anh còn nợ không em" vẫn là C2, vì không kèm số tiền.
  - Mẫu chủ ý rộng tay: nhận nhầm C3 chỉ mất một lần gợi ý AI, còn bỏ sót C3 là lộ số mật.
- Có C3 thì chặn **cả** lời gọi, không cắt riêng phần C3. AI chạy tại chỗ cho C3 làm ở M3.

## 3. Khóa theo khách, hủy khóa, áp lại sau khôi phục

- **Chủ thể (người sở hữu khóa) của một tin:** hội thoại 1-1 thì là người kia, cho cả tin đến và tin đi. Hội thoại nhóm thì là người gửi với tin đến, và là nhóm với tin của chính nick.
- `customer_keys { _id: chủ thể, wrapped, kekId, createdAt }`: khóa dữ liệu chỉ lưu ở dạng đã bọc, không có khóa dạng rõ trong DB.
- `messages.sealed { v, k, iv, tag, data }` chứa các trường `text`, `content`, `quoteRef`, `senderName`, `raw` đã mã hóa. Khi công tắc bật, các trường dạng rõ này bị gỡ khỏi bản ghi.
- **Hủy khóa** (`POST /api/security/erase`, bắt buộc gửi `confirm: true`), theo thứ tự:
  1. Ghi sổ xóa.
  2. Xóa khóa và ghi vào `erased_subjects`.
  3. Đóng dấu `erasedAt`, `erasedBy` lên `customer_accounts` và `customer_contacts` (nếu đã có, do M1b-12 tạo).
  4. Xóa nội dung dạng rõ còn sót của khách đó.
  5. Ghi nhật ký `security.erase`, nhật ký chỉ có số đếm.
- **Khách đã xóa mà vẫn nhắn tiếp:** không tạo khóa mới. Tin mới chỉ lưu "[Đã ẩn danh]". Áp dụng cả khi công tắc tắt và khi extension đẩy lại tin cũ: mọi lần ghi tin (ingest, nội dung DOM) đều thay nội dung của danh tính đã xóa (có trong `erased_subjects` hoặc hồ sơ khách có `erasedAt`) bằng "[Đã ẩn danh]" (gác cổng M1b-12, test `test/e2e/erased-reingest.e2e-spec.ts`). Cần chủ dự án xác nhận cách này (theo NĐ 13 thì làm lại khi khách đồng ý lại, M2).
- **Áp lại sau khôi phục backup:** sổ xóa nằm ở database `ERASURE_LEDGER_DB` (mặc định `<db>_erasures`) và **phải được sao lưu tách khỏi** database chính. Sau khi khôi phục, chạy `pnpm --filter @vclinks/api security:reapply-erasures [--tenant vcpv]`. Lệnh này chạy lặp lại nhiều lần vẫn cho cùng kết quả.

## 4. Biến môi trường và route

| Biến | Ý nghĩa |
|---|---|
| `CUSTOMER_KEK` | Khóa chủ, base64 32 byte. Không commit, không log. Mất khóa này thì mọi tin đã mã hóa không đọc được nữa |
| `CUSTOMER_ENCRYPTION` | `1` thì mã hóa nội dung tin lúc ingest; mặc định tắt |
| `ERASURE_LEDGER_DB` | Tên database của sổ xóa |

Route khai báo quyền trong nhóm "Security" của `apps/api/src/authz/route-permissions.ts`: `GET /api/security/status` cần `config.security`; `POST /api/security/erase` cần `cust.privacy_execute` (có ghi nhật ký `+NK`).

## 5. Việc còn lại trước khi bật mã hóa

- **Tìm kiếm toàn văn** (`messages.text`) không đọc được tin đã mã hóa, nên phiên tìm kiếm (5.3) phải chọn cách đánh chỉ mục khác.
- **Những chỗ còn đọc `text` mà chưa gọi `MessageVault.open`:** dòng xem trước tin cuối trong danh sách hội thoại, xem trước trích dẫn, `outbox.service` (`phoneDuplicate`), `participants`, `fetch-requests`, `autosync`, MCP `search_messages`.
- M1b-12 gắn `SUBJECT_RESOLVER` để hủy khóa theo `accountId`.
- Lệnh xóa chưa ẩn danh tên hay SĐT trong `contacts` (phiếu NĐ 13 MH-PQ-13 thuộc M2).

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 04/10/2026 20:30 | Claude Code · gác cổng M1b-12 | Mục 3: khách đã xóa được giữ "[Đã ẩn danh]" cả khi công tắc tắt và khi đẩy lại tin cũ | Gác cổng M1b-12 |
| 0.1 | 04/10/2026 20:04 | Claude Code · M1b-14 | Tạo mới | Kế hoạch M1 mục M1b-14; chủ dự án chốt Q1–Q3 04/10/2026 |
