# QA vòng 1 — Rà nhất quán và độ sẵn sàng UAT của bộ đặc tả v1.1

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Agent QA rà ngày 29/09/2026 độ nhất quán và độ sẵn sàng UAT của bộ đặc tả 00–05 v1.1; file 06 chưa có lúc rà, chưa rà canvas thiết kế.
- Tổng 69 lỗi: 13 Nghiêm trọng, 33 Trung bình, 23 Nhẹ; riêng mâu thuẫn giữa các file có 30 dòng (11 / 13 / 6).
- 144 việc chuyển file mới làm 12, làm một phần 18, chưa làm 114; 14 mục BA tổng cần cập nhật; 44% trong 68 dòng mẫu UAT có lỗi.
- Năm mâu thuẫn nghiêm trọng nhất: trạng thái owner và CSKH tạm giữ, mã kênh chatbot web, trang "Không có quyền", menu / route / quyền thấy menu, người duyệt chatbot và marketing gửi tin.
- Nhận định: bộ đặc tả chưa đủ để dev MVP; phần "Đã có" khớp code tốt (51/62), vấn đề nằm ở chỗ nối giữa các file.
- Việc cần xong trước khi chốt lô: sửa 11 mâu thuẫn Nghiêm trọng, làm việc chuyển sang 01 và 00 §2, viết 06, lập bộ dữ liệu kiểm thử chung, cập nhật BA tổng.
- File có sẵn mục "Tóm tắt" gốc của QA (bảng số lỗi, năm mâu thuẫn, nhận định); mục Tóm tắt này chỉ là bản rút gọn thêm khi hồi tố.

## Mục lục

- [Tóm tắt](#tóm-tắt-1)
- [1. Mâu thuẫn giữa các file](#1-mâu-thuẫn-giữa-các-file)
- [2. Việc chuyển file chưa làm](#2-việc-chuyển-file-chưa-làm)
- [3. Lệch BA tổng / nguyên tắc](#3-lệch-ba-tổng--nguyên-tắc)
- [4. Độ sẵn sàng UAT](#4-độ-sẵn-sàng-uat)
- [5. [Đã có] sai so với code](#5-đã-có-sai-so-với-code)
- [6. Tham chiếu hỏng](#6-tham-chiếu-hỏng)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Bước 7 của quy trình ở [../../README.md](../../README.md). Vòng này **chỉ rà đặc tả**; thiết kế đang được làm lại nên chưa rà canvas.
> Ngày: 29/09/2026 · Người rà: agent QA · Đầu vào: `00`–`05` v1.1, sổ xử lý `*-xu-ly.md`, `docs/vclinks-ba.md` v0.4, `CLAUDE.md` §12, code `apps/web/src`, `apps/api/src`, `packages/shared/src` (chỉ đọc).
> `06-hoa-don-cong-no.md` **chưa có** lúc rà, nên không rà được file này. Mọi chỗ trỏ sang 06 được tính là trỏ vào khoảng trống.
> Cách ghi vị trí: `số file:mục` hoặc `số file:dòng` (dòng tính theo bản lúc rà).

**Mức lỗi**
- **Nghiêm trọng:** mâu thuẫn hoặc thiếu sót làm dev làm sai, hoặc làm ca UAT chắc chắn trượt dù dev làm đúng một file.
- **Trung bình:** phải hỏi lại mới làm được. Có thể làm lệch câu chữ, màu hoặc quyền ở một màn.
- **Nhẹ:** tham chiếu, câu chữ, số đo lệch nhỏ.

---

## Tóm tắt

### Số lỗi theo mức

| Phần | Nghiêm trọng | Trung bình | Nhẹ |
|---|---|---|---|
| §1 Mâu thuẫn giữa các file | 11 | 13 | 6 |
| §3 Lệch nguyên tắc bắt buộc | 1 | 3 | 1 |
| §4 Độ sẵn sàng UAT (lỗi chung U1–U12) | 1 | 8 | 3 |
| §5 [Đã có] sai so với code | 0 | 4 | 5 |
| §6 Tham chiếu hỏng | 0 | 5 | 8 |
| **Tổng** | **13** | **33** | **23** |

Ngoài ra:
- **§2:** 144 việc chuyển file. Đã làm 12, làm một phần 18, **chưa làm 114**. File 01 gần như chưa nhận việc nào.
- **§3.2:** 14 mục BA tổng phải cập nhật theo đặc tả. BA tổng vẫn ở v0.4.
- **§4:** trong 68 dòng mẫu UAT, 44% lỗi, 7% chưa chạy được vì chờ quyết định.

### Năm mâu thuẫn nghiêm trọng nhất

1. **Trạng thái owner và CSKH tạm giữ (§1 dòng 2, 3).** 00, 02, 04, 05 dùng bốn bộ trạng thái và ba ngưỡng khác nhau (15′, [30]′, "> 15′"). Bốn file cũng hiểu "Đi thị trường" theo hai nghĩa ngược nhau. 02 cho CSKH tự tạm giữ và gửi câu giữ khách, nhưng 01 PQ-19 chỉ cho đọc và ghi chú. API làm theo 01 thì mọi ca tạm giữ đều trượt.
2. **Mã kênh chatbot web (§1 dòng 1).** 00, 01, 02 dùng `web_chat`; 05 dùng `webchat` và ghi "theo 00". Hai BA sửa chéo nhau theo bản cũ của nhau.
3. **Trang "Không có quyền" (§1 dòng 4, 28).** 00, 01, 02, 03, 04 có năm biến thể câu chữ. Riêng 00 còn tách 404 đối tượng, trái nguyên tắc NT8 của 01 (không để lộ sự tồn tại). Các ca UAT-UI-38…40 và UAT-PQ-06/16 không thể cùng đạt.
4. **Menu, route và quyền thấy menu (§1 dòng 5, 6).** 00 §2 thiếu khoảng 20 route mà 01, 02, 04, 05 đã đặt (`/leads`, `/zns/*`, `/customers/owner-conflicts`, `/admin/access-requests`, mục `Lệnh gửi`…). Cột vai trò của 00 lệch ma trận 01: sale không thấy `/sync`, GS không thấy `/admin/users`, KD không thấy `/tickets`.
5. **Người duyệt chatbot và marketing gửi tin (§1 dòng 7, 8).** 05 cho Trưởng marketing xuất bản kịch bản và cho NVMK trả lời bình luận. 01 chỉ cho GĐ xuất bản, và mặc định marketing không gửi tin. Hai dòng gần mức này: 01 **hủy** lệnh gửi của người nghỉ việc, còn 03 chuyển `Cần duyệt lại` (§1 dòng 9). UAT-DK-13 cho owner bấm "Hiện" SĐT, trái 01 D6 (§1 dòng 10).

### Nhận định

**Bộ đặc tả chưa đủ để dev MVP.** Từng file đã chi tiết, nhiều câu chữ có thể dùng làm UAT. Phần "Đã có" khớp code tốt (51/62). Mã màn, mã quy tắc và mã UAT không trùng, không hỏng. Vấn đề nằm ở **chỗ nối giữa các file**. Vòng 1 mỗi BA chỉ sửa file của mình, nên 114 việc chuyển chưa được làm. Nguồn chuẩn về quyền (01) và về route (00) chưa nhận thay đổi của 02–05.

Cần xong trước khi chốt lô:
1. Sửa 11 mâu thuẫn Nghiêm trọng ở §1. Trong đó ba việc phải hỏi chủ dự án: ngưỡng và nghĩa "Đi thị trường" (CH-2, Q-14), người duyệt chatbot (D-MK-8), marketing trả lời bình luận (PQ-21).
2. Làm các việc chuyển sang **01** (tạm giữ, `lead.card`, khóa ZNS lẻ, chi phí, trực thay sale admin) và sang **00 §2** (gom mọi route, sửa cột vai trò).
3. Viết **06-hoa-don-cong-no.md**, vì KT-01, KT-02 và 30 việc đang trỏ vào khoảng trống. Giao chủ quản trang **Báo cáo** và **khung gửi Fanpage**.
4. Lập **một bộ dữ liệu kiểm thử chung** (U1). Thêm cột Story và Tiền điều kiện vào mọi bảng UAT (U2, U7).
5. Cập nhật BA tổng theo §3.2 (vai trò marketing, BR02, BR03, kênh `web_chat`, thực thể mới).

Các phần tương đối sẵn sàng nếu tách lô: **03 Zalo cá nhân**, trừ §1 dòng 9, 11, 14, 15 và các ca chờ Q13/Q14. **04 khung gửi OA và ZNS**, trừ tạm giữ, màu và chữ của chip. **02 định danh và gộp hồ sơ** (§4 của 02). Phần chưa sẵn sàng: định tuyến đa kênh khi owner vắng (02 §5.2a ↔ 00 ↔ 01 ↔ 04), marketing và lead (05 ↔ 01 ↔ 00), hóa đơn (06).

---

## 1. Mâu thuẫn giữa các file

Nguyên tắc chọn bên: (1) nguyên tắc bắt buộc (`CLAUDE.md` §12, BA §2.2, §7); (2) file được giao làm **nguồn chuẩn**: 00 cho màu, chip, câu chữ và route; 01 cho quyền; 02 cho định tuyến và định danh; 04 cho khung gửi OA; (3) sau đó mới tới vai trò trực tiếp dùng màn.

| # | Mức | Khái niệm | File A (mục) nói | File B (mục) nói | Đề xuất thống nhất |
|---|---|---|---|---|---|
| 1 | **Nghiêm trọng** | Mã kênh chatbot web | 00 §3.2, câu hỏi mở 10: `web_chat`, ghi "thống nhất với 01, 02". 01 §2.5: `web_chat`. 02 §0.1, §2, §9: `web_chat`, `CHANNEL_INFO.web_chat` | 05 §3 (dòng 234), §7 `Channel`, §12.1 D-MK-5, Phụ lục A: `webchat`, ghi "theo file 00". 05 dòng 234 còn yêu cầu **02 đổi sang `webchat`** | Chọn **`web_chat`**, tiền tố `web_`. Ba trên bốn file đã dùng mã này, và 00 là nguồn chuẩn. Hai BA sửa chéo nhau theo bản cũ của nhau. Sửa 05 ở 4 chỗ, đóng câu hỏi 00 Q10, bỏ việc "02 đổi sang `webchat`" |
| 2 | **Nghiêm trọng** | Trạng thái của người dùng / owner và ngưỡng vắng | 00 MH-UI-05: bốn trạng thái **Trực tuyến / Đi thị trường / Tạm vắng / Ngoại tuyến**. Tự "Tạm vắng" sau **15′** (người dùng chọn 5–30′). "Đi thị trường" **không** nhận hội thoại mới và **tính như Tạm vắng** với DK-24, tức CSKH tạm giữ (dòng 899, Q-14). Chọn trạng thái qua `Dropdown` trên header | 02 §1.3, §5.2a DK-47: **Trực tuyến / Đang đi thị trường / Vắng / Nghỉ phép**. "Vắng" sau **[30]′** không hoạt động (CH-2). "Đang đi thị trường" **như trực tuyến**: tin vẫn về owner, hạn trả lời chạy. 04 OA-11: "owner vắng **> 15′**" thì CSKH tạm giữ. 05 §4.4, MK-05, MH-MK-12 #7: lead **vẫn giao** cho người "Đi thị trường" với SLA 30′, bật bằng `Switch` | Một bảng trạng thái duy nhất ở 00 MH-UI-05: tên, mã, ngưỡng (một tham số, chờ CH-2/Q-14). "Nghỉ phép" là cờ lấy từ trực thay, không phải trạng thái online. Chọn ngữ nghĩa của 02 cho "Đi thị trường": có mặt với khách cũ, không nhận hội thoại mới chưa có owner. Riêng lead, 05 phải ghi rõ có giao cho người "Đi thị trường" hay không (MK-04 đang ghi "không giao cho người offline"). Sửa 04 OA-11 bỏ "15′", trỏ DK-47 |
| 3 | **Nghiêm trọng** | CSKH tạm giữ hội thoại bán hàng của owner | 02 §5.2, §5.2a DK-24, DK-48: khi owner vắng hoặc quá hạn, hội thoại **tự** vào tạm giữ của CSKH. CSKH **gửi được** câu giữ khách (`/giu-khach`), không cần lý do, và là người tham gia. 02 ghi "khớp 01 PQ-19" | 01 PQ-19: CSKH **chỉ đọc + ghi chú**. Nút "Nhận xử lý" chỉ hiện khi quá SLA và owner không trực tuyến, bấm vào là **gửi yêu cầu tới giám sát** chứ không tự nhận. 01 §3.1 `conv.reply` chú thích (4) không có trường hợp tạm giữ. 00 UAT-UI-97 kỳ vọng ô soạn bị chặn | Theo 02 (định tuyến là phần của 02, CSKH cần giữ khách). Sửa 01 PQ-19 và chú thích (4): thêm "hội thoại Bán hàng đang tạm giữ theo DK-24, chỉ mẫu giữ khách, không nêu giá". Nếu không sửa, API chặn theo 01 và mọi ca tạm giữ của 02 và 04 đều trượt. Rà lại UAT-UI-97 (owner Trực tuyến thì vẫn chặn là đúng) |
| 4 | **Nghiêm trọng** | Trang và hộp "Không có quyền" | 00 MH-UI-06: tiêu đề "Bạn không có quyền xem trang này" / "Bạn không có quyền xem {khách hàng / hội thoại} này". Nút "Về trang chính", "Yêu cầu cấp quyền", "Yêu cầu xem tạm thời". Tách **404 đối tượng** riêng. Hộp chỉ có ô lý do. UAT-UI-38…40 | 01 MH-PQ-11: "Bạn không có quyền truy cập trang này" và "**Không tìm thấy hoặc bạn không có quyền xem**" (gộp 403/404 để không lộ sự tồn tại, NT8). Nút "Về Hộp thư", "Xin quyền truy cập". Trang quản trị (dạng A) không có nút xin quyền. Hộp có Loại quyền và Thời hạn. 03 MH-SZ-03 và UAT-SZ-12: "Bạn không có quyền xem hội thoại này." + nút `Xin quyền`. 04 MH-OA-03: "Hội thoại này không thuộc phạm vi của bạn." + `Xin quyền xem tạm` | Theo **01 MH-PQ-11**, vì 01 là nguồn chuẩn về quyền và NT8 cấm lộ sự tồn tại (00 tách 404 đối tượng là vi phạm). 00 MH-UI-06 chỉ giữ 404 trang, 500, lỗi giao diện, mất mạng, và trỏ 403 sang MH-PQ-11. Sửa câu ở 03, 04 và các UAT-UI-38…40, UAT-SZ-12 |
| 5 | **Nghiêm trọng** | Menu và route: 00 §2 chưa gom route của các file | 00 §2.1/§2.2 là "cây menu đầy đủ", nhưng thiếu hoặc khác: `/leads`, `/leads/rules` (05); `/content/vcwiki` (05); `/ads/sources`, `/ads/campaigns` (05); `/customers/merge` (00) khác `/customers/merge-suggestions` (02); `/customers/erp-link` (00, trang mặc định của SA theo R3) **không có màn nào ở 02** | 02 §8: `/customers/owner-conflicts`, `/customers/erp-tasks`, `/customers/erp-matching`, `/customers/data-log`, đều có "Menu Khách hàng → …". 04: `/zns/templates`, `/zns/campaigns`, `/zns/chi-phi`, `/automation/rules`, `/settings/sla` (00 dùng `/campaigns`, `/automations`, `/admin/routing`). 01: `/admin/access-requests`, `/admin/channel-access`, `/admin/alerts`, `/privacy-requests` (00 dùng `/admin/privacy`), `/settings/tokens`, `/settings/activity`. 03 SZ-24, MH-SZ-13: mục **`Lệnh gửi`** trên thanh điều hướng trái | 00 §2.2 là nguồn duy nhất về route. BA 00 gom mọi route ở 01–05 vào §2.1/§2.2, rồi mỗi file 01–05 chỉ trỏ tới đó. Phải chọn: `/campaigns` hay `/zns/*`, `/automations` hay `/automation/rules`, `/admin/routing` hay `/settings/sla`, `/customers/merge` hay `/customers/merge-suggestions`. Trang mặc định của SA đổi sang màn có thật (MH-DK-12 hoặc MH-DK-13) |
| 6 | **Nghiêm trọng** | Ai thấy mục menu (00 §2.2) so với ma trận quyền (01 §3) | 00 §2.2: `Đồng bộ` chỉ AD. `Người dùng` chỉ AD. `Ticket` ẩn với KD. `Nhật ký` ẩn với GS. `Quảng cáo` ẩn với AD. `Tự động hóa` hiện với AD và MK. `Chiến dịch & ZNS` ẩn với SA. `Vai trò & quyền` chỉ AD | 01: `sync.view` KD `NICK`, GĐ `DV`, QS; 03 MH-SZ-12b đặc tả **góc nhìn sale** của `/sync`. `user.view`/`user.lock`/`user.offboard` có GĐ, GS (MH-PQ-02, 04). `ticket.view` KD `CT`, TT `TUYẾN`. `audit.view` GS `TỔ`. `ads.connect` AD. `automation.edit` AD ✖, MK ✖. `zns_template.edit` SA `DV` (04 OA-18: SA soạn mẫu ZNS). `role.view` GĐ, GS, QS | 01 thắng. 00 §2.2 sửa cột vai trò theo đúng khóa quyền; cột nào là "chỉ đọc" thì ghi 👁. Cần sửa trước khi viết ca UAT "vai trò X thấy menu Y" |
| 7 | **Nghiêm trọng** | Ai duyệt và xuất bản kịch bản chatbot / widget | 01 §3.4 `bot.publish`: **chỉ GĐ (DV)**, MK ✖. 01 PQ-29: chatbot chạy khi kịch bản "Đã xuất bản" **do GĐ duyệt**. 04 OA-18: nội dung chatbot do **giám đốc division** duyệt | 05 §1.3, MK-10, MH-MK-03 (quyền), MH-MK-04: **Trưởng marketing** duyệt và xuất bản; GĐBH chỉ duyệt thêm khối Chính sách / Khuyến mãi. 05 D-MK-8 ghi "khớp OA-18 file 04", nhưng OA-18 không nói vậy | Hỏi chủ dự án (D-MK-8) rồi sửa **cả ba file** cùng lúc. Tới khi chốt, dev làm theo 01 (mặc định từ chối, NT2). 05 bỏ câu "khớp OA-18" |
| 8 | **Nghiêm trọng** | Marketing trả lời bình luận, nhắn riêng | 01 §3.1 `conv.reply` MK ✖ (5); PQ-21: **mặc định marketing không gửi tin**, Admin bật từng kênh. 01 §2.5: mức `lead` không cho gửi | 05 MH-MK-09: **NVMK là người dùng chính**, có nút `Trả lời công khai`, `Nhắn riêng` mà không có điều kiện PQ-21. 02 §5.10: "CSKH/marketing xử lý công khai" | Giữ 01 làm mặc định. 05 MH-MK-09 thêm điều kiện "khi kênh bật PQ-21", câu khóa nút theo MH-PQ-11 dạng C ("Kênh này chưa cho phép marketing trả lời lead."). Nếu chủ dự án muốn NVMK luôn trả lời bình luận thì đổi 01 PQ-21 |
| 9 | **Nghiêm trọng** | Lệnh gửi còn chờ khi người duyệt nghỉ việc / bị khóa | 01 PQ-33, PQ-51, D15: **hủy** lệnh gửi người đó đã duyệt còn chờ, ghi `outbox.cancelled` | 03 SZ-26, QT-SZ-11, UAT-SZ-60: chuyển **`Cần duyệt lại`**, không tự chạy, người nhận nick duyệt lại | Chọn 03 (`Cần duyệt lại`). Nội dung không mất, vẫn không chạy khi thiếu người duyệt còn hiệu lực, nên vẫn đúng NT6. Sửa 01 PQ-33, PQ-51 và `outbox.cancelled` → `outbox.needs_reapproval` |
| 10 | **Nghiêm trọng** | Owner xem SĐT | 00 §3.6, 01 D6, PQ-45: owner **luôn thấy đủ**, không có nút "Hiện", không ghi nhật ký mỗi lần. Câu dưới số khi bấm Hiện: "Lượt xem này đã được ghi nhật ký." (không toast) | 02 UAT-DK-13: "KD Minh (owner Garage Tuấn Phát) bấm **Hiện** SĐT… nhật ký có dòng 'xem SĐT'; `message` 'Đã ghi nhật ký xem SĐT.'". 02 MH-DK-01 #8 "Ẩn nếu không phải owner" thì đúng | Sửa UAT-DK-13: owner thấy đủ số, không có nút Hiện, không có dòng nhật ký `phone.reveal`. Thêm ca riêng cho GS bấm "Hiện" với câu của 00 §3.6 |
| 11 | Trung bình | Nhãn bong bóng tin gửi ngoài VClinks | 00 §3.3a, MH-UI-07: **"Gửi từ điện thoại"** (icon `MobileOutlined`, tooltip có sẵn); kênh API: "Gửi từ {trang quản lý OA / Meta Business Suite}" | 03 SZ-22: `Gửi ngoài VClinks · điện thoại` / `Gửi ngoài VClinks`; §2 dòng 68, 159. 02 §1.3 gọi là "Tin gửi ngoài VClinks". 04 OA-31: dòng báo cáo `Trả lời ngoài VClinks`, chưa có nhãn bong bóng | Theo 00 (việc 00→03 đã giao nhưng chưa làm). Giữ `sendSource = ngoai_vclinks` làm mã dữ liệu; nhãn hiển thị theo 00. 04 thêm nhãn bong bóng "Gửi từ trang quản lý OA" |
| 12 | Trung bình | Màu và chữ của chip kênh | 00 §3.2 (nguồn chuẩn): OA `#087A4D`, Fanpage `#3B5998`, FB cá nhân `#6B4FBB`, Web `#0E7C86`, Email `#C5221F`. Chữ chip ngắn: "Zalo", "OA", "FB"… | 02 §1.4: OA `#00A1E4`, Fanpage `#1877F2`, **FB cá nhân `#3B5998`** (trùng màu Fanpage của 00), Web `#13C2C2`, Email `#D93025`. Chữ chip dạng `Zalo · <tên nick>` | Xóa cột màu ở 02 §1.4, chỉ trỏ 00 §3.2. Nếu cần chip dài có tên nick / OA thì 00 định nghĩa thêm biến thể "chip + tên tài khoản kênh" |
| 13 | Trung bình | Màu vùng khung gửi OA | 00 §3.1–§3.3: bỏ tím; chip cảnh báo kiểu **Đặc** (vàng / cam / đỏ); "Có phí", "Hết khung", "Bỏ quan tâm" không dùng màu kênh | 04 §3.2: Z1 `green`, Z2 **`purple`**, Z3 `default`, Z0 **đỏ** | 00 quyết màu. Sửa cột "Màu Tag" ở 04 §3.2 (việc 00→04 (3) chưa làm) |
| 14 | Trung bình | Chip SLA và chip khung gửi trên danh sách | 00 §3.4: chip ngắn `⏰ {n}′`, `Quá {n}′`, "Còn hạn" **không hiện**, "Sắp quá" khi còn ≤ **25%** hạn. 00 §3.4a: chip khung gửi `⏱ {h}h`, `Có phí`, `Hết khung` | 03 MH-SZ-01 #9l: chip `chờ {n phút / n giờ}` **luôn hiện** khi chưa trả lời, xám → cam → đỏ `Quá SLA {n}`. 04 MH-OA-02 #9–#10: `Hạn trả lời: 25′`, cam khi ≤ **30′**, `Quá hạn trả lời 12′`, `Hạn trả lời: tạm dừng`; `Nhắn miễn phí: 41h`, `Nhắn: có phí`, `Nhắn: hết khung`. 04 bộ lọc SLA "Sắp quá hạn (≤ 30′)" | Chọn một bộ chữ ở 00 cho mọi inbox. 04 muốn chữ dài hơn cho `/cskh` thì 00 ghi thành biến thể "chip đủ" của cùng thành phần. Ngưỡng "sắp quá": thống nhất 25% hay 30′ |
| 15 | Trung bình | Giờ làm việc tính SLA | 00 §3.4: **lịch làm việc của division** (GĐ cấu hình, có nghỉ trưa, ngày lễ), không theo ca người. 04 OA-13, MH-OA-18: theo division | 03 SZ-21 (h): "giờ làm việc **của tổ** (F4.3)"; ngưỡng GS-01 15′ | Theo 00 và 04 (division). Sửa 03 SZ-21 (h) |
| 16 | Trung bình | Nhãn nút nhận việc và tên hàng chờ | 00 MH-UI-07 #8, MH-UI-10 #9: **"Nhận hội thoại này"** / "Nhận"; hàng **"Chưa phân công"** | 04 MH-OA-02 #14, UAT-OA-13, UAT-OA-82: **`Nhận xử lý`**, hàng **"Chưa nhận"**. 02 MH-DK-04 #13 cũng dùng "Nhận xử lý" (với gợi ý gộp, khác nghĩa) | Theo 00 cho hội thoại ("Nhận", "Chưa phân công"). Giữ "Nhận xử lý" cho ticket và gợi ý gộp. Việc 00→04 (1) chưa làm |
| 17 | Trung bình | Nút xem SĐT và thời gian hiện | 00 §3.6, 01 PQ-37: nút **"Hiện"**, hiện **60 giây**. 01 PQ-37: có nút **"Gọi"** cạnh "Hiện" ở mọi nơi (máy tính mở mã QR) | 05 §4.6, MH-MK-07 #2: nút **"Hiện số"**; với NVMK trước khi giao: **30 giây**. 00 §3.6: nút 📞 chỉ trên mobile và chỉ khi đang thấy số đầy đủ | "Hiện", 60 giây, theo 01 (`<MaskedContact>` dùng chung). 00 thêm nút "Gọi" theo PQ-37 (việc 01→00 làm một phần) |
| 18 | Trung bình | Quyền của giám sát CSKH, sale admin, kế toán ở 04 | 04 §1.3: giám sát CSKH **trả lời thay**, **cấu hình** chatbot, quy tắc tự động. MH-OA-10: giám sát CSKH **tạo** quy tắc (có hành động "Gửi tin mẫu câu"). Sale admin **gửi** xác nhận / cập nhật trạng thái đơn (CS-07). CSKH **gửi ZNS lẻ**. Kế toán **nhập chi phí thực** (MH-OA-19) | 01 §3: `conv.reply_on_behalf` CS ✖. `bot.edit` CS "Đề xuất sửa". `automation.edit` CS "NH (đề xuất)". SA `conv.reply` ✖, không nhận mức gán kênh nào (§2.5). Không có khóa cho ZNS lẻ, `cost.view`, `cost.edit_actual` | Thêm khóa vào 01 (`zns.send_single`, `cost.*`) và quyết từng điểm. Tới khi chốt, dev theo 01 |
| 19 | Trung bình | Người được gửi qua nick cá nhân | 01 D2, D13, PQ-44: người giữ nick, người trực thay, cấp trên (GS, GĐ trả lời thay) | 02 §5.1 #2: "Không ai gửi qua nick của người khác, **trừ giám sát** 'trả lời thay'" (thiếu GĐ và trực thay) | Sửa câu ở 02, trỏ 01 D2 |
| 20 | Trung bình | Vai trò marketing khi nhận lead Zalo cá nhân | 01 PQ-20: lead là account chưa có owner, **tạo từ kênh gán cho marketing** | 05 MK-21, §2.3b: tin đầu của người lạ tới nick Zalo cá nhân **cũng tạo lead** (người nhận là người giữ nick) | Bổ sung định nghĩa lead ở 01 PQ-20 (lead không nhất thiết từ kênh marketing; marketing chỉ thấy `lead.card`) |
| 21 | Trung bình | Tự gửi tin theo quy tắc hoặc mẫu (không có người bấm) | BA BR07, 01 NT6: tin tự động chỉ gồm kịch bản chatbot đã duyệt; 04 OA-01 liệt kê loại tin tự động được phép | 04 MH-OA-10: quy tắc tự động có hành động "Gửi tin mẫu câu" do giám sát CSKH tạo. 05 MH-MK-09 #10/#10a: "Tự nhắn riêng", "Tự trả lời công khai theo mẫu", "Tự nhắn riêng theo từ khóa", do TMK bật | Ghi một quy tắc chung (01 hoặc 00): mọi tin tự động phải dùng **mẫu đã duyệt**, lưu `approvedBy` = người duyệt mẫu và `approvedAt` = lúc duyệt phiên bản; người bật quy tắc không tự duyệt mẫu (PQ-27). Xem thêm §3 |
| 22 | Trung bình | Chủ quản của khung gửi Fanpage (24h, `HUMAN_AGENT`) | 00 §3.4a: ngưỡng và câu chặn chi tiết "ở 05 / file kênh Fanpage" | 04 §1.2: "file kênh Fanpage (chưa có, Q-OA-19)". 05: không đặc tả câu chặn `HUMAN_AGENT` hay hết cửa sổ. 02 §5.6 chỉ nêu 24h + 7 ngày | Giao một file (đề xuất 05, vì Fanpage đang nằm ở 05). Tới khi có, không viết được ca UAT chặn gửi Fanpage |
| 23 | Trung bình | Chủ quản Yêu cầu hóa đơn | 00 §2.2: `/invoice-requests` "chưa có file (câu hỏi mở 5)". 01 D11: trỏ 02, 04 | 04 §1.2, L9: chuyển sang **06** (chưa có) | Viết 06, rồi sửa 00 §2.2 và 01 D11 trỏ sang 06 |
| 24 | Nhẹ | Nhãn bong bóng trả lời thay | 00 §3.3a: "Gửi bởi {tên} (trả lời thay {người})". 03 SZ-22: `Gửi bởi {GS} (trả lời thay {tên})` | 01 PQ-16: "Gửi bởi <tên> (trả lời thay)" (không có tên người được thay) | Theo 00 |
| 25 | Nhẹ | Kích thước inbox | 00 §3.7: danh sách **344 px** (1280–1439: 320), panel phải **320 px** | 02 §8: danh sách **360 px**, panel **360 px** | Theo 00 |
| 26 | Nhẹ | Mã câu hỏi chờ chốt trùng nhau giữa các file | 02: CH-1…CH-4 (CH-2 = ngưỡng trực tuyến, CH-3 = hạn trả lời owner, CH-4 = xin owner đồng ý) | 04: CH-1…CH-7 (CH-2 = SLA sale trên OA, CH-3 = giai đoạn ZNS, CH-4 = ngân sách). 04 §1.3 ghi "DK-24 **[Chờ chốt CH-2]**", không rõ CH-2 của file nào | Thêm tiền tố file: `CH-DK-2`, `CH-OA-2` (như `Q-PQ-`, `Q-MK-`, `Q-OA-` đã làm) |
| 27 | Nhẹ | Tên 3 vùng khung gửi OA | 04 §8.3 L1: "**ba vùng**" | 04 §3.2 và 00 §3.4a: Z0, Z1 (3 mức), Z2, Z3 | Không sai, nhưng BA tổng nên ghi "ba vùng thời gian (Z1–Z3) + trạng thái Z0 bỏ quan tâm" cho khớp |
| 28 | **Nghiêm trọng** | Câu báo khi đăng nhập bị từ chối | 00 MH-UI-02, UAT-UI-13: "Tài khoản {email} chưa được cấp quyền dùng VClinks. Liên hệ Admin hệ thống để được thêm vào." Khóa (00:583): "Tài khoản {email} đã bị khóa. Liên hệ Admin hệ thống nếu đây là nhầm lẫn." | 01 PQ-10, UAT-PQ-05, UAT-PQ-40: "Tài khoản của bạn chưa được cấp quyền VClinks. Liên hệ quản trị viên." / "Tài khoản của bạn đã bị khóa. Liên hệ quản lý hoặc quản trị viên." | Chọn một câu và dùng ở cả hai file. Đề xuất giữ câu của 00 (có email, nên người dùng biết mình đăng nhập nhầm tài khoản nào), sửa 01 PQ-10 và hai ca UAT-PQ |
| 29 | Nhẹ | Câu lỗi mạng | 00 §6.1 `ERR-NET` | 01 §5 (dòng 589): "Không kết nối được máy chủ. Thử lại sau ít phút." | 01 trỏ mã lỗi của 00, không viết câu riêng |
| 30 | Nhẹ | Câu cho người chỉ xem | 03 MH-SZ-05: "Bạn chỉ có quyền xem hội thoại này." | 04 MH-OA-04 (dòng 648): "Bạn chỉ xem hội thoại này." | Đưa một câu vào 00 MH-UI-08 và dùng chung |

---

## 2. Việc chuyển file chưa làm

Đối chiếu từng việc trong mục "Việc chuyển file khác" (và các dòng "Chuyển file …" rải trong bảng góp ý) của `vong-1-dac-ta/00…05-xu-ly.md` với nội dung file đích lúc rà. Sổ 04 không có mục này, nên danh sách của 04 lấy từ đoạn "Việc cho file khác" (dòng 186) và các dòng góp ý.

**Tổng: 144 việc. Đã làm 12 · Làm một phần 18 · Chưa làm 114.**

| File nguồn | Đã làm | Một phần | Chưa làm |
|---|---|---|---|
| 00 | 4 | 4 | 23 |
| 01 | 1 | 3 | 17 |
| 02 | 0 | 4 | 25 |
| 03 | 6 | 4 | 13 |
| 04 | 0 | 1 | 16 |
| 05 | 1 | 2 | 20 |

Nguyên nhân: bản v1.1 của mỗi file chủ yếu xử lý góp ý của chính file đó. Việc từ file khác gần như chỉ được làm ở 00, nơi đã nhận phần lớn việc từ 03. File **01 hầu như chưa nhận việc nào**, trong khi 01 là nguồn chuẩn về quyền. Vì vậy phần lớn mâu thuẫn ở §1 (dòng 3, 7, 8, 9, 18) đến từ đây.

Bảng dưới liệt kê mọi việc **chưa làm** hoặc **làm một phần**. Việc đã làm liệt kê gọn ở cuối.

| Từ | Đến | Việc | Trạng thái |
|---|---|---|---|
| 00 | 01 | Thêm `search_phone` vào nhật ký PQ-38 (CS #15) | Chưa làm |
| 00 | 01 | `cust.commerce` "Đơn hàng" của CS: `TK` → `KÊNH` (CS #5) | Chưa làm (01:291 vẫn "Đơn hàng: TK") |
| 00 | 01 | Q-19: người được @nhắc có tự được quyền đọc không (CS #14) | Chưa làm |
| 00 | 01 | Q-17: ngoại lệ PQ-03, thẻ tối thiểu khi CS tìm đủ SĐT | Chưa làm |
| 00 | 01 | Ghi nhớ điện thoại 30 ngày ở MH-PQ-03/08, PQ-33 | Chưa làm |
| 00 | 01 | Trạng thái "Đi thị trường", lịch division có nghỉ trưa ở "Chia hội thoại & SLA" | Chưa làm |
| 00 | 01 | Người nhận nút "Báo Admin" theo division | Chưa làm |
| 00 | 02 | DK-24: định nghĩa owner offline 15′, kèm Q-14 | Làm một phần, **lệch**: DK-47 dùng [30]′ và tính "Đi thị trường" như trực tuyến (§1 dòng 2) |
| 00 | 02 | "Liên lạc gần đây" (MH-UI-09 #8b) khớp "Khách đang hoạt động" | Chưa làm |
| 00 | 02 | "Mở 360 đầy đủ" có bản dọc cho điện thoại | Một phần: chỉ trỏ panel 360 sang MH-UI-11 |
| 00 | 02 | Dòng sự kiện "tạm giữ / trả về owner" | Chưa làm |
| 00 | 02 | Việc cần làm "nhắc quay lại sau 15′/30′" (CS #17) | Chưa làm |
| 00 | 02 | Nhận đặc tả Báo cáo (câu hỏi mở 5) | Chưa làm (**không file nào đặc tả `/reports`**) |
| 00 | 03 | Đổi nhãn SZ-22 thành "Gửi từ điện thoại" | Chưa làm (§1 dòng 11) |
| 00 | 03 | 03 Q14 trùng 00 Q-13, chốt chung | Chưa làm |
| 00 | 03 | Tab "Tra hàng" là thành phần dùng chung mọi kênh | Chưa làm |
| 00 | 03 | Mẫu câu có biến chọn nhanh 5/10/15/30 phút (TT #11) | Chưa làm |
| 00 | 03 | Hạn lệnh chờ Q1 dùng cho tin "Đang chờ gửi" của 00 | Chưa làm |
| 00 | 04 | "Chưa nhận" → "Chưa phân công" (CS #1) | Chưa làm (§1 dòng 16) |
| 00 | 04 | "Hộp thư CSKH" trong nhóm LÀM VIỆC; CS mặc định `/cskh` | Một phần: 04:222 vẫn đề xuất nhóm menu "CSKH" riêng |
| 00 | 04 | Z2 "Có phí" bỏ màu tím | Chưa làm (§1 dòng 13) |
| 00 | 04 | Nhãn bong bóng "Gửi từ trang quản lý OA" | Một phần: báo cáo có, bong bóng chưa |
| 00 | 04 | Thông báo gộp "Khách chờ nhận" 5 phút | Chưa làm |
| 00 | 04 | Chip khung gửi trên `/conversations` chỉ hiện khi sắp hết / có phí / hết | Chưa làm |
| 00 | 05 | Ngưỡng cửa sổ Fanpage (Q-15), câu chữ `HUMAN_AGENT` / hết cửa sổ | Chưa làm (§1 dòng 22) |
| 00 | 05 | Màu chip "Bình luận" mới | Chưa làm |
| 00 | 05 | Mã kênh `web_chat` | **Làm ngược**: 05 đổi sang `webchat` "theo 00" (§1 dòng 1) |
| 00 | 06 | Trang `/invoice-requests`, kế toán gửi hóa đơn / nhắc nợ | Chưa làm (chưa có file) |
| 01 | 00 | Menu Quản trị thêm "Cảnh báo", "Yêu cầu dữ liệu cá nhân" (AD #9, BGD #8) | Chưa làm |
| 01 | 00 | Chuông nhận cảnh báo R*, nhắc phiếu NĐ 13, nick "Chưa an toàn" | Chưa làm |
| 01 | 00 | `<MaskedContact>` thêm nút "Gọi" | Một phần: chỉ mobile |
| 01 | 00 | Menu ⋯ có "Ghi nhận yêu cầu dữ liệu cá nhân" | Chưa làm |
| 01 | 02 | Luồng GS "Yêu cầu chuyển khách về tổ", tự duyệt khi 2 GS đồng ý | Chưa làm |
| 01 | 02 | Quy tắc chia khách theo tổ, GS xem được (GS #16) | Chưa làm |
| 01 | 02 | Mặc định đổi tổ theo Q-PQ-11 | Chưa làm |
| 01 | 03 | Tóm tắt trực thay lúc 18:00 | Chưa làm |
| 01 | 03 | Nhắc lead ở hàng tổ quá 30′; bảng lead đã chia theo NVKD (GS #16) | Chưa làm |
| 01 | 03 | Extension hiện mã ghép 6 số, tự nhận xoay vòng token (AD #7) | Chưa làm |
| 01 | 03 | Outbox hủy lệnh khi người duyệt bị khóa (`canDispatch`) | Chưa làm, và **mâu thuẫn** với SZ-26 (§1 dòng 9) |
| 01 | 03 | Phát hiện tin gửi từ điện thoại cho R11 | Một phần: SZ-21 nhận biết, không nối R11 |
| 01 | 03 | Owner của khách mới kết bạn khi người giữ nick vắng (Q-PQ-16) | Chưa làm |
| 01 | 04 | "Nhận xử lý" quá SLA: GS đặt, tự chuyển sau 15′ (Q-PQ-01, GS #17) | Chưa làm |
| 01 | 04 | CSKH mở hội thoại nick qua ticket: mặc định 30 ngày, ghi chú cho owner | Chưa làm (OA-12 vẫn chờ CH-1) |
| 01 | 04 | Điểm ghi nhận yêu cầu NĐ 13 từ OA / tổng đài | Chưa làm |
| 01 | 05 | Lead giao tổ: marketing chỉ đọc, ô soạn khóa "Lead đã giao cho <tổ>" | Một phần: thiếu câu khóa ô soạn |
| 01 | 05 | Nhắc lead chưa chia | Chưa làm |
| 01 | 06 | Danh sách chứng từ phải giữ khi xóa theo NĐ 13 (BGD #8) | Chưa làm (chưa có file) |
| 01 | 06 | Kế toán ghi nhận yêu cầu NĐ 13 (`privacy.intake`) | Chưa làm (chưa có file) |
| 02 | 00 | Bố cục mobile cho khung chat, 09A, 09B, panel 360 (P-KD #1c) | Một phần: không nhắc 09A/09B |
| 02 | 00 | Thông báo hai mức, mục "Tin về khách của tôi", email tắt (DK-59) | Một phần: thiếu hai mức, mục riêng, email |
| 02 | 00 | Công tắc "Đang đi thị trường", hiện trạng thái owner (DK-47) | Một phần: có công tắc, chưa hiện trạng thái owner cho người khác |
| 02 | 00 | @nhắc gắn sẵn khách cho nút "Hỏi [NV]" | Chưa làm |
| 02 | 00 | Trạng thái đã đọc của ghi chú nội bộ tự động | Chưa làm |
| 02 | 01 | CSKH xem `stated_commitments` (DK-49) | Chưa làm |
| 02 | 01 | Xác nhận phạm vi "Đơn hàng: TK" của CSKH | Chưa làm |
| 02 | 01 | PQ-19: tạm giữ, leo thang theo hạn owner; "Đi thị trường" = trực tuyến | Chưa làm (§1 dòng 3) |
| 02 | 01 | Quyền "Tạm gắn để xem" (DK-51) | Chưa làm |
| 02 | 01 | Xem xác nhận "trong phạm vi một đơn" (DK-50) | Chưa làm |
| 02 | 01 | Cờ khiếu nại mở cho division khác (P-KD #17) | Chưa làm |
| 02 | 01 | Trực thay cho sale admin (P-SA #16) | Chưa làm (PQ-32 chỉ NVKD) |
| 02 | 03 | Khóa trả lời và cảnh báo sau gửi cho tin từ điện thoại (DK-46) | Chưa làm |
| 02 | 03 | Nút `Chuyển hậu mãi cho CSKH` (P-CS #12) | Chưa làm |
| 02 | 03 | Nhắc "Kết bạn bằng nick owner", lệnh danh thiếp của owner (P-KD #9) | Chưa làm |
| 02 | 03 | Khối "Xe của khách" trên panel (P-KD #15) | Chưa làm |
| 02 | 03 | Menu "Tin này của…" (DK-53), "Đang mua cho" (DK-55) | Chưa làm |
| 02 | 03 | Tin trong nhóm Zalo đã gắn account (DK-52) | Chưa làm |
| 02 | 04 | Bảng phí hậu mãi đã duyệt (P-CS #5) | Chưa làm |
| 02 | 04 | Cam kết ticket vào `stated_commitments`; ghi chú khi sale "Vẫn gửi" | Chưa làm |
| 02 | 04 | Ba nút xác nhận danh tính trên OA/Fanpage (DK-50) | Chưa làm |
| 02 | 04 | OA-11, OA-12 theo DK-24/DK-48 mới | Chưa làm (OA-11 vẫn "> 15′", §1 dòng 2) |
| 02 | 04 | Định tuyến theo loại chỉ khi chưa có người xử lý (DK-23) | Chưa làm |
| 02 | 04 | Mẫu `/giu-khach`, `/cong-no-chuyen-owner` | Chưa làm |
| 02 | 04 | Nhận ticket từ "Chuyển hậu mãi cho CSKH" | Chưa làm |
| 02 | 05 | DK-25: CSKH/marketing chào lead không thành owner; owner cũ giữ | Một phần: thiếu câu "không thành owner" |
| 02 | 05 | Gợi ý gộp mang `campaignId` để lọc ở MH-DK-04 | Chưa làm |
| 02 | 06 | Dữ liệu hóa đơn/thanh toán cho DK-31 (P-CS #5) | Chưa làm (chưa có file) |
| 02 | 06 | Phiếu "Chờ tạo mã KH" dùng chung định nghĩa thông tin xuất HĐ (P-SA #4) | Chưa làm (chưa có file) |
| 03 | 00 | Mục `Lệnh gửi` có badge đỏ ở thanh điều hướng trái (KD-7) | Một phần: chỉ chấm đỏ trên "Hội thoại" (§1 dòng 5) |
| 03 | 00 | Thống nhất thời gian tin về: ≤ 5 giây (00) và ≤ 10 giây (03), Q13 | Chưa làm |
| 03 | 01 | MH-PQ-04 ③: checklist thu nick, quét lại QR, danh sách lời mời / nhóm; khóa Hoàn tất | Một phần: có ô "Đã đăng xuất…", không khóa Hoàn tất |
| 03 | 01 | Nghỉ việc: lệnh chờ → `Cần duyệt lại` (SZ-26) | Một phần, **lệch** (§1 dòng 9) |
| 03 | 01 | PQ-38 thêm `conversation.fetch_on_behalf` | Một phần: `channel_access.*` có, `fetch_on_behalf` chưa |
| 03 | 01 | Chú thích `conv.label`: đánh dấu đã đọc phải xác nhận (SZ-23) | Chưa làm |
| 03 | 01 | MH-PQ-07: NVKD "Đăng ký vắng", GS Đồng ý (GS-16) | Chưa làm |
| 03 | 01 | GS xem mẫu câu cá nhân của tổ | Chưa làm |
| 03 | 01 | Quyền Chặn / Hủy kết bạn (Q8) | Chưa làm |
| 03 | 02 | Chip `Khách này cũng nhắn…` hiện cả ngoài DK-30 (KD-21) | Chưa làm |
| 03 | 02 | Khối "3 đơn gần nhất" nếu Q21 chọn C | Chưa làm (chờ Q21) |
| 03 | 06 | `Gửi cho kế toán` từ một tin (KD-18, Q22) | Chưa làm (chưa có file) |
| 03 | 06 | Cảnh báo công nợ quá hạn trong panel (KD-15) | Chưa làm (chưa có file) |
| 03 | Báo cáo | Hiệu suất NVKD GS-06 / F10.2 dùng SZ-21, SZ-22 | Chưa làm (chưa có file báo cáo) |
| 03 | BA tổng | L11 định nghĩa "đã trả lời" vào F4.3; L12 làm rõ ZR4; L13 bổ sung F11.4 | Chưa làm (3 việc) |
| 04 | 06 | P-KT #1, #2, #3, #5, #6, #7, #8, #12, #17, #18 và câu hỏi H1–H3, H5, H6 | Chưa làm (11 việc, chưa có file) |
| 04 | 01 | P-CS #12: người xử lý ticket luôn thấy SĐT | Chưa làm (D6 giữ nguyên) |
| 04 | 01 | P-GD #12: ủy quyền duyệt có thời hạn | Chưa làm |
| 04 | 01 | Quyền `cost.view`, `cost.edit_actual` cho kế toán (MH-OA-19) | Chưa làm (§1 dòng 18) |
| 04 | 01 | Kế toán xem báo cáo chiến dịch nhắc thanh toán (MH-OA-14) | Chưa làm |
| 04 | 01 | D11 trỏ sang 06 | Chưa làm |
| 04 | 00 | `/invoice-requests` trỏ sang 06 | Một phần: câu hỏi mở 5 có, bảng route chưa |
| 05 | 00 | Menu "Hộp thư lead" `/leads`, các route MH-MK, NỘI DUNG `/content/vcwiki` | Chưa làm (§1 dòng 5) |
| 05 | 00 | `/campaigns` là chiến dịch gửi tin, khác chiến dịch marketing | Chưa làm |
| 05 | 00 | Chip `Lead` + đồng hồ SLA lead trong "Của tôi" | Chưa làm |
| 05 | 00 | MH-UI-11: tab "Lead", Web Push, công tắc "Đi thị trường" | Một phần: thiếu tab Lead |
| 05 | 00 | Gộp thông báo lead, bản tin sáng | Chưa làm |
| 05 | 01 | Mở rộng `lead.card` (PQ-20) | Chưa làm |
| 05 | 01 | D-MK-3: marketing xem hội thoại trước giao; TMK quyền tạm 24h | Chưa làm |
| 05 | 01 | Quyền `lead.dispute`, `ads.spend*` cho MK | Một phần: chỉ `report.export` |
| 05 | 01 | Duyệt thay kịch bản khi TMK vắng; bước duyệt của GĐBH | Chưa làm (§1 dòng 7) |
| 05 | 02 | Đổi `web_chat` → `webchat` | **Không nên làm** (§1 dòng 1) |
| 05 | 02 | Xét lại điểm chạm đầu của lead khi gộp | Chưa làm |
| 05 | 02 | "Đây là khách của tôi…" từ lead → gợi ý gộp, cờ tranh chấp | Chưa làm |
| 05 | 02 | "Yêu cầu liên kết mã KH" từ lead | Chưa làm |
| 05 | 02 | Việc cần làm loại "Liên hệ lead" | Chưa làm |
| 05 | 03 | Tin đầu của người lạ tới nick tạo lead (MK-21) | Chưa làm (03 không nhắc "lead") |
| 05 | 03 | Khối "Lead đang mở" ở panel, "Không phải lead", "Tạo lead" | Chưa làm |
| 05 | 03 | Luồng "Nhắn Zalo" từ Chi tiết lead | Chưa làm |
| 05 | 03 | Tin sale gửi từ điện thoại tính "Đã liên hệ" | Chưa làm |
| 05 | 04 | Tin chào / ngoài giờ Fanpage dùng MH-OA-08 (D-MK-1) | Chưa làm |
| 05 | 04 | Đồng bộ quy tắc duyệt OA-18 ↔ D-MK-8 | Chưa làm (§1 dòng 7) |
| 05 | 04 | Follow OA không tin, không SĐT → lead `Chờ thông tin` | Chưa làm |
| 05 | BA tổng | D-MK-1, 5, 12, 14 và §21 câu 13 | Chưa làm (chờ chốt) |

**Đã làm (12):** 00→03 Q11 giữ ở 03; 00→03 SZ-24 khớp lỗi gửi của 00; 00→05 bình luận xử lý ở `/comments`; 01→03 hộp xác nhận trực thay (SZ-25); 03→00 thông báo "Gửi lỗi" không tự đóng; 03→00 nhãn "Gửi từ điện thoại"; 03→00 sửa Q12; 03→00 "Chưa trả lời" cạnh "Chưa đọc"; 03→00 `Tắt thông báo`; 03→00 toast `Đang gửi {nhãn}…`; 05→01 "Marketing giao thẳng NVKD" (PQ-22); và 00→05 mã kênh (đã sửa nhưng theo hướng sai, xem trên).

---

## 3. Lệch BA tổng / nguyên tắc

### 3.1 Nguyên tắc bắt buộc (`CLAUDE.md` §12, BA §2.2, §7)

| # | Mức | Nguyên tắc | Chỗ lệch | Đề xuất |
|---|---|---|---|---|
| P1 | **Nghiêm trọng** | Không gửi khi chưa duyệt (§12.1, BR07, 01 NT6: "AI tự gửi tin" là trần cứng) | 05 §3.6 phương án B, MK-11, MK-US-20: **AI trả lời trực tiếp khách** trên website (tắt mặc định, GĐ3). Không có người bấm gửi, không phải kịch bản đã duyệt | Ghi rõ ở 05 rằng phương án B **trái** CLAUDE.md §12.1 và 01 NT6. Chỉ làm khi chủ dự án sửa nguyên tắc bằng văn bản. Tới lúc đó bỏ MK-US-20 khỏi bảng story |
| P2 | Trung bình | Không gửi khi chưa duyệt: tin tự động | 04 MH-OA-10 hành động "Gửi tin mẫu câu" (giám sát CSKH tạo quy tắc). 05 MH-MK-09 #10, #10a "Tự nhắn riêng", "Tự trả lời công khai". 00 §3.3a gọi chung là "tin tự động của quy tắc". Chưa file nào nói `approvedBy`/`approvedAt` của những tin này lấy từ đâu | Ghi một quy tắc chung (§1 dòng 21): chỉ dùng mẫu đã duyệt; `approvedBy` = người duyệt phiên bản mẫu; outbox từ chối tin tự động không có mẫu đã duyệt. Thêm vào ma trận 01 khóa duyệt mẫu cho từng loại |
| P3 | Trung bình | Không gửi hàng loạt qua nick cá nhân (BR14) | Không thấy chỗ vi phạm. 03 SZ-04, SZ-08, SZ-09; 05 MK-12; 01 NT6 đều chặn. Còn hở một chỗ: 05 §2.3b tạo lead từ nick Zalo, 02 §5.3 "Nhờ gửi danh thiếp", 01 PQ-24 "nháp gửi hóa đơn" đều là **một** tin, người bấm. Chưa có quy tắc nào chặn **nhiều nháp** (hóa đơn, danh thiếp) đổ vào nick cùng lúc | Thêm vào 03 SZ-04: mọi lệnh từ nháp của người khác vẫn đi qua nhịp 1,5 giây và giới hạn theo ngày của nick |
| P4 | Đạt | Không lưu bí mật phiên (§12.2) | 01 PQ-52 (token thiết bị do VClinks cấp, ghép bằng mã), 03 SZ-26 (không giữ mật khẩu Zalo), 04 OA-02 (token OA mã hóa), 05 §3.2 C6 (`visitor_id` không phải token) đều đạt. Thiếu một câu: 05 MH-MK-01 kết nối Meta Ads / Zalo Ads **không ghi** token lưu ở `channel_credentials`, mã hóa, không log | Thêm câu này vào 05 MH-MK-01 |
| P5 | Đạt | VClinks chỉ đọc VC ERP (BR12) | 02 MH-DK-12 (việc VCsales cho sale admin làm tay), 05 MK-16, MK-25, 04 §1.2 đều giữ đúng. Không thấy chỗ ghi sang VCsales | – |
| P6 | Trung bình | NĐ 13 | 05 MK-13: lead từ bình luận công khai có SĐT được xử lý **trước khi khách đồng ý** (chờ pháp chế Q-MK-14). 00 Q-16: lưu 360 rút gọn trên điện thoại khi mất mạng. 01 PQ-50 và MH-PQ-13 có phiếu NĐ 13, nhưng 00 §2.1 chưa có route (`/privacy-requests` hay `/admin/privacy`) và chưa có điểm ghi nhận từ OA / tổng đài (việc 01→04 chưa làm) | Chờ pháp chế cho MK-13. Gom route NĐ 13 vào 00 |
| P7 | Nhẹ | Log không chứa nội dung tin (§12.3) | Đạt ở 01 PQ-38, 04 OA-25, 05 MK-20. 00 nút "Báo Admin" nói rõ không kèm nội dung | – |

### 3.2 BA tổng cần cập nhật theo đặc tả

`docs/vclinks-ba.md` vẫn ghi v0.4. Git báo file đang sửa dở, nhưng chưa có mục nào dưới đây được đưa vào.

| # | Mục BA tổng | Hiện ghi | Đặc tả đã chốt / đề xuất | Nguồn |
|---|---|---|---|---|
| B1 | §4 Vai trò | Không có marketing; không có trưởng nhóm CSKH / giám sát CSKH; Viewer "chỉ đọc" | Thêm `marketing` (+ cờ Trưởng nhóm = TMK), cờ Trưởng nhóm cho CSKH, sale admin, kế toán, thị trường; Viewer đọc chat có nhật ký; Admin không đọc chat | 01 §2.1, L2, L3, L7; 04 L5; 05 D-MK-4 |
| B2 | BR02, F4.4 | "Owner offline quá X phút → chia theo quy tắc chung"; online/offline | Không bao giờ đổi owner vì vắng. Nick cá nhân luôn về người giữ nick. Kênh chính thức: CSKH **tạm giữ**, người xử lý vẫn là owner. Bốn trạng thái online (sau khi thống nhất §1 dòng 2) | 00 §8.3 #9, #10; 02 DK-24, DK-47, DK-48 |
| B3 | BR03, §13 C5 | Hai vùng: trong khung / ngoài khung chỉ ZNS | Ba vùng thời gian: 0–48h miễn phí, 48h–7 ngày có phí, > 7 ngày chỉ tin mẫu, cộng Z0 bỏ quan tâm; ZNS → ZBS Template Message | 04 §3.2, L1, L2 |
| B4 | §10, §16, §17, §19 | Livechat website ở "Kênh sau này", GĐ3; 5 kênh | Kênh `web_chat` (tiền tố `web_`), widget GĐ2 có điều kiện; 6 kênh + `email`; Fanpage tách Messenger / Bình luận khi hiển thị | 00 §8.3 #1; 02 L1; 05 §11, D-MK-1, D-MK-5 |
| B5 | §8 Mô hình dữ liệu | Chưa có các thực thể mới | `OrgUnit`, `RoleAssignment`, `channel_access`, `access_grants`, `role_change_requests`, phiếu NĐ 13, cảnh báo (01 §2.8); `ChannelIdentity`, `ContactPoint`, `merge_operations`, `stated_commitments`, `erp_tasks` (02 §9); `Lead`, `LeadSlaSegment`, `WebWidget`, `BotFlow`/`BotFlowVersion`, chiến dịch marketing, chi phí quảng cáo (05 §7); ticket mở rộng, `send_policy`, bảng đơn giá, chi phí thực (04); `sendSource`, `actualSender`, `unansweredSince` (03 SZ-22, D22) | 01, 02, 03, 04, 05 |
| B6 | F4.3, §18 | "Đã trả lời" chưa định nghĩa | Tin phản hồi gồm cả tin gửi từ điện thoại; tin tự động không tính; "Chưa trả lời" khác "Chưa đọc" | 00 §3.3a, 03 SZ-21 (L11) |
| B7 | F11.2, F11.3 | Ẩn SĐT "với người không phụ trách" | Owner, người giữ nick, NV thị trường luôn thấy; người khác (kể cả GS, GĐ) bấm "Hiện" 60 giây có nhật ký; che cả trong nội dung tin, tìm kiếm, file xuất, MCP | 01 D6, L8; 00 §3.6 |
| B8 | AD-05, §21-24 | Admin cấp token MCP | Chỉ chính chủ tự tạo token MCP cá nhân; Admin chỉ tạo token hệ thống | 01 L4, L14 |
| B9 | §19 Lộ trình | Ticket, ZNS, mobile web ở GĐ2; chatbot GĐ3 | 04 đặc tả ticket, SLA, ZNS như phạm vi chính (ZNS chờ CH-3 của 04); 05 và 00 đề xuất mobile tối thiểu ở MVP (D-MK-12, 00 Q-13, 03 Q14); menu OA + nút phân loại GĐ2 (04 L6) | 00 §8.3 #5; 04 L6; 05 §11 |
| B10 | §11.2 menu | "Hội thoại · Danh bạ · Kết nối kênh · Đồng bộ" | Menu đầy đủ ở 00 §2 (sau khi gom route, §1 dòng 5) | 00 §8.3 #8 |
| B11 | F12.6, F12.5, BR09 | Trả lời thay "cấp trên"; chỉ NVKD xin chuyển khách | GS/GĐ trả lời thay cả trên nick cá nhân; GS xin "chuyển khách về tổ"; GS giữ được nick | 01 L11, L15, L16 |
| B12 | BR06 | Chỉ Admin xóa | Phải có phiếu, xóa mềm 30 ngày, NĐ 13 xóa hẳn | 01 L10 |
| B13 | §18.6 KT-01, KT-02 | Kế toán gửi hóa đơn qua VClinks | Chỉ qua kênh chính thức; khách chỉ có nick → nháp cho owner; đặc tả ở 06 (chưa có) | 01 L5; 04 L9 |
| B14 | §1 nguyên tắc 4 và §1.2 | "Dữ liệu cá nhân không rời bộ giải pháp" nhưng AI đọc qua MCP | Mâu thuẫn nội tại BA tổng; chờ Q-PQ-18 và pháp chế | 01 L13 |

---

## 4. Độ sẵn sàng UAT

### 4.1 Mẫu đã rà

Đã rà **68 dòng mẫu** (một số dòng gộp 2–9 ca cùng lỗi, tổng hơn 80 ca), rải đầu, giữa và cuối mỗi file, gồm cả ca v1.1: 00 × 13, 01 × 12, 02 × 15, 03 × 9, 04 × 11, 05 × 8. Mỗi ca xét năm điều: có tiền điều kiện, có dữ liệu cụ thể, có bước, kết quả đo được (câu chữ hoặc số chính xác), và mã màn / quy tắc được trỏ có tồn tại.

| Kết quả | Số dòng | Tỉ lệ |
|---|---|---|
| Đạt | 14 | 21% |
| Đạt nhưng có lỗi nhẹ (thiếu dữ liệu, câu bị cắt một phần) | 19 | 28% |
| Lỗi (không đo được, sai so với màn, mâu thuẫn file khác, thiếu dữ liệu) | 30 | 44% |
| Chưa chạy được (chờ quyết định mở) | 5 | 7% |

| Mã | File:dòng | Kết quả | Lỗi |
|---|---|---|---|
| UAT-UI-01 | 00:513 | Đạt nhẹ | Kết quả "các mục đã bật cờ ở giai đoạn đang kiểm": tester phải tự suy ra danh sách menu |
| UAT-UI-02 | 00:514 | **Lỗi** | Danh sách menu Quản trị lệch 01 §5: thiếu "Gán kênh", "Quyền tạm thời", "Cảnh báo", "Yêu cầu dữ liệu cá nhân". Tên khác nhau: "Token & MCP" ↔ "Token & thiết bị", "Nhật ký" ↔ "Nhật ký truy cập" (§1 dòng 5) |
| UAT-UI-13 | 00:614 | **Lỗi** | Câu mâu thuẫn 01 PQ-10 / UAT-PQ-05 (§1 dòng 28) |
| UAT-UI-38/39/40 | 00:996–998 | **Lỗi** | Mâu thuẫn MH-PQ-11 / UAT-PQ-06, 16 (§1 dòng 4) |
| UAT-UI-42 | 00:1000 | **Lỗi** | "lỗi 500 **hoặc** thông báo `ERR-500`": hai kết quả, không xác định |
| UAT-UI-47 | 00:1230 | Đạt nhẹ | "dòng sự kiện tương ứng" không có câu chữ |
| UAT-UI-60 | 00:1391 | Đạt nhẹ | Vùng chặn cửa sổ 24h không trích câu (chủ quản Fanpage chưa có, §1 dòng 22) |
| UAT-UI-65 | 00:1494 | Đạt nhẹ | Đơn DH-2026-0456 không có trong dữ liệu §1.7, chỉ có trong wireframe |
| UAT-UI-84 | 00:742 | Đạt | – |
| UAT-UI-97 | 00:1241 | Đạt | Nhưng phải rà lại khi sửa PQ-19 (§1 dòng 3) |
| UAT-UI-108…116 | 00:1702–1710 | Chưa chạy được | Phương án [A] chờ Q-13 |
| UAT-UI-113 | 00:1706 | **Lỗi** | "Người thử đọc đúng cả 4 thông tin": không có giá trị chuẩn |
| UAT-UI-117 | 00:1240 | Đạt nhẹ | "⚠ Gửi lỗi: …" bị cắt |
| UAT-PQ-01 | 01:1554 | Đạt nhẹ | Bước 2 "lỗi tại ô Thuộc đơn vị" không có câu chữ |
| UAT-PQ-05 | 01:1558 | **Lỗi** | Mâu thuẫn UAT-UI-13 (§1 dòng 28) |
| UAT-PQ-06 | 01:1559 | **Lỗi** | Mâu thuẫn UAT-UI-38 (§1 dòng 4) |
| UAT-PQ-16 | 01:1579 | **Lỗi** | Mâu thuẫn UAT-UI-39 (§1 dòng 4) |
| UAT-PQ-36 | 01:1609 | Đạt nhẹ | "Lỗi thời hạn tối đa 30 ngày" không có câu chữ |
| UAT-PQ-40 | 01:1623 | **Lỗi** | Câu "Hoàn tất bàn giao trong 24 giờ…" bị cắt; câu khóa khác 00 (§1 dòng 28) |
| UAT-PQ-43 | 01:1626 | Đạt nhẹ | Kết quả có điều kiện ("nếu U-KD4 đã bị khóa…"), nên tách hai ca |
| UAT-PQ-62 | 01:1665 | Đạt nhẹ | "`405` / `404`": chưa xác định mã nào |
| UAT-PQ-72 | 01:1675 | Đạt | – |
| UAT-PQ-76 | 01:1695 | **Lỗi** | Khách K7 không có trong bộ dữ liệu 01 §7.1 (chỉ có K1–K6, K8–K10) |
| UAT-PQ-82 | 01:1686 | Đạt nhẹ | "ngưỡng đã giảm" không có số; một phần chờ Q-PQ-15 |
| UAT-PQ-92 | 01:1716 | Đạt nhẹ | "Có nhật ký 1 quý" không có dữ liệu cụ thể |
| UAT-DK-01 | 02:1820 | Đạt nhẹ | Không có tiền điều kiện; "sau 23 giờ …" bị cắt |
| UAT-DK-03 | 02:1839–1849 | **Lỗi** | Kết quả bị cắt: "Zalo·Minh VCparts · …", "Bạn không phải owner…" |
| UAT-DK-05 / 36 | 02:1862, 1974 | Chưa chạy được | Hai ca loại trừ nhau, chờ CH-4 |
| UAT-DK-12 | 02:1931 | **Lỗi** | "Bạn không có quyền mở hội thoại này." là biến thể 403 thứ tư (§1 dòng 4) |
| UAT-DK-13 | 02:1939 | **Lỗi** | Owner bấm "Hiện" (§1 dòng 10) |
| UAT-DK-14 | 02:1940 | **Lỗi** | "Bạn không có quyền xem khách hàng này…" bị cắt, khác MH-PQ-11 dạng B |
| UAT-DK-16 | 02:1942 | **Lỗi** | Không có tiền điều kiện (hội thoại nào, kênh đích nào); "Đã chép nháp sang …" bị cắt |
| UAT-DK-20 | 02:1946 | **Lỗi** | Không có dữ liệu (hai hồ sơ, hai mã KH); tooltip bị cắt |
| UAT-DK-23 / 27 | 02:1949, 1953 | Đạt nhẹ | Thông báo bị cắt ("cho …", "Garage Minh Khoa…") |
| UAT-DK-31 | 02:1962 | Đạt | – |
| UAT-DK-45 | 02:1983 | **Lỗi** | "khoảng 30 cụm", "phím hoạt động": tiêu chí mơ hồ |
| UAT-DK-51 | 02:1989 | Đạt | – |
| UAT-DK-56 | 02:1994 | **Lỗi** | "Bị cảnh báo DK-15" nhưng DK-15 không có câu cảnh báo |
| UAT-DK-58 | 02:1996 | **Lỗi** | Tiền điều kiện "SA đã xác nhận hai mã cùng chủ" không có trong dữ liệu §3 / §11.4 |
| UAT-DK-62 | 02:2000 | Đạt nhẹ | "trong 24 giờ trước đó khối thương mại đã thu gọn": khó kiểm lại |
| UAT-SZ-02 | 03:1560 | Đạt | Câu rỗng khớp MH-SZ-01 |
| UAT-SZ-12 | 03:1580 | **Lỗi** | Câu 403 khác MH-PQ-11 (§1 dòng 4); "NVKD B" không có trong dữ liệu |
| UAT-SZ-14 | 03:1582 | Đạt nhẹ | Kết quả ghi "chữ SZ-14", không trích câu |
| UAT-SZ-27 | 03:1610 | Đạt nhẹ | Không có số báo giá thử (QT-SZ-03 có BG-2026-0915); toast bị cắt |
| UAT-SZ-47 | 03:1660 | Đạt | Dựa vào tin TC18 ngày 29/09. Lưu ý: `docs/05-kiem-thu/uat/2026-09-29/` đang bị xóa ảnh và `ket-qua.json` trong working tree, sẽ mất bằng chứng hồi quy |
| UAT-SZ-55 | 03:1675 | Chưa chạy được | Ngưỡng "theo Q13" chưa chốt |
| UAT-SZ-59 | 03:1679 | **Lỗi** | Câu `Nick {nick} giảm 12 bạn bè…` chỉ có trong UAT, không có ở màn hay quy tắc nào; phụ thuộc Q19 |
| UAT-SZ-60 | 03:1680 | Đạt | Sẽ đổi nếu chọn phương án của 01 (§1 dòng 9) |
| UAT-SZ-64, 67 | 03:1689, 1692 | Chưa chạy được | Q13; hai kết quả thay thế theo Q9 |
| UAT-OA-01 | 04:356 | Đạt | – |
| UAT-OA-12 | 04:452 | **Lỗi** | Kỳ vọng `Miễn phí 47h`; màn MH-OA-02 #10 ghi `Nhắn miễn phí: 47h`. Kết quả có nhánh "(nếu quy tắc bật)" |
| UAT-OA-15 | 04:455 | **Lỗi** | Kỳ vọng `SLA quá 1′`; màn ghi `Quá hạn trả lời 1′`. Thông báo giám sát không trích câu |
| UAT-OA-16 | 04:456 | **Lỗi** | `Tạm dừng` khác `Hạn trả lời: tạm dừng`; "08:00 hôm sau" sai nếu khách nhắn tối thứ Bảy; ca không nêu ngày |
| UAT-OA-41 | 04:831 | **Lỗi** | Bước "chọn người nhóm khác" mâu thuẫn kết quả "không có trong danh sách" |
| UAT-OA-42 | 04:883 | Đạt nhẹ | Không có dữ liệu (bao nhiêu ticket, ticket nào quá SLA) |
| UAT-OA-110 | 04:1013 | **Lỗi** | Kết quả "khung 375 px" không có ở MH-OA-09 |
| UAT-OA-115 | 04:1213 | Đạt | – |
| UAT-OA-131 | 04:1577 | Đạt | Số đúng (A hạn 09:30, B hạn 09:27) |
| UAT-OA-135 | 04:1634 | **Lỗi** | Không có số kỳ vọng cho ước tính / thực / chênh lệch |
| UAT-OA-138 | 04:1637 | Đạt | – |
| UAT-MK-04 (và MK-17, 18, 48, 55) | 05:1602… | **Lỗi** | "thông báo đúng chữ" nhưng không trích câu |
| UAT-MK-06 | 05:1600 | Đạt | CPL 8.400.000 / 42 = 200.000 ₫ đúng |
| UAT-MK-11 | 05:1609 | Đạt nhẹ | Câu `Không nêu giá sản phẩm trong kịch bản (MK-10)` không có ở MH-MK-04 |
| UAT-MK-24 | 05:1622 | Chưa chạy được | Chờ D-MK-3 |
| UAT-MK-35 | 05:1633 | **Lỗi** | Cột Bước để "–" |
| UAT-MK-39 | 05:1637 | **Lỗi** | Dùng 0900 000 007 là "người lạ", nhưng 05 §10.1 định nghĩa số này là chủ Gara Minh Phát (owner Minh); xung đột với UAT-MK-57 |
| UAT-MK-44 | 05:1642 | Đạt nhẹ | Mã lead "L-…125" không đầy đủ |
| UAT-MK-56, 66 | 05:1654, 1664 | Đạt | – |

### 4.2 Lỗi chung về độ sẵn sàng UAT

| # | Mức | Lỗi | Chi tiết | Đề xuất |
|---|---|---|---|---|
| U1 | **Nghiêm trọng** | Không có **một** bộ dữ liệu kiểm thử chung | 00 §1.7 nói bộ DL-xx "dùng cho mọi file MH-*". Nhưng 01 dùng bộ U-/K-/H- (§7.1), 02 dùng bộ thứ ba (Minh/Linh/0900 000 1xx–7xx, §3), 05 dùng bộ thứ tư (§10.1), còn 03 và 04 **không có** bảng dữ liệu. Các bộ chồng lấn: NVKD "Nguyễn Văn An" (00) ↔ "Nguyễn An" (01); 0987 654 321 là Garage Hòa Bình (00) nhưng là anh Kiên (01); "Dũng" là NVKD VCe (01) nhưng là giám sát (02); 0900 000 007 hai nghĩa ngay trong 05 | Một file `docs/05-kiem-thu/du-lieu-kiem-thu.md` (người dùng, đơn vị, nick, OA, Page, khách, SĐT, mã KH, đơn, báo giá), mọi file trỏ vào. Không chạy UAT xuyên file được khi chưa có |
| U2 | Trung bình | Thiếu cột Tiền điều kiện / Dữ liệu | 03 chỉ có tiền điều kiện ở ca 62–75. 04 không có cột này ở mọi bảng. 01 không có cột Dữ liệu. 02 §11.2–11.4 gộp tiền điều kiện, dữ liệu, bước vào một cột "Kịch bản" | Dùng một khuôn bảng UAT: Mã · Story · Màn / quy tắc · Tiền điều kiện · Dữ liệu · Bước · Kết quả mong đợi |
| U3 | Trung bình | Kết quả không khớp chính màn của file | UAT-OA-12, 15, 16 dùng chữ khác MH-OA-02 cùng file. UAT-OA-110, UAT-SZ-59, UAT-MK-11 kỳ vọng câu / kích thước không có trong màn | Sửa UAT theo màn (hoặc thêm vào màn) |
| U4 | Trung bình | Kết quả bị cắt bằng "…" | UAT-UI-117, UAT-PQ-40, UAT-DK-01, 03, 14, 16, 20, 23, 27, UAT-SZ-27 | Viết đủ câu, tester so từng chữ |
| U5 | Trung bình | Kết quả không đo được | UAT-UI-42 (hai kết quả), UAT-UI-113 (chủ quan), UAT-DK-45 ("khoảng"), UAT-OA-135 (không có số), UAT-MK-04/17/18/48/55 ("đúng chữ" không trích), UAT-SZ-14 | Ghi giá trị cụ thể |
| U6 | Trung bình | Ca phụ thuộc quyết định chưa chốt | UAT-UI-108…116 (Q-13), UAT-DK-05/36 (CH-4), UAT-SZ-55, 58, 59, 64, 66, 67, 72 (Q9, Q13, Q14, Q19), UAT-MK-24, 29, 53, 58 (D-MK-3, Q-MK-15) | Đánh dấu "Chờ chốt" ở cột riêng; không tính vào tiêu chí xong lô |
| U7 | Trung bình | Không truy vết được story ↔ UAT | BA tổng §18 có 72 story. **19 story không file nào nhắc**: KD-09, KD-18, KD-19, GS-02, GS-07, GS-08, GS-10, GD-03, GD-06, CS-02, SA-02, AD-02, AD-03, AD-07, AD-08, BGD-02, KH-02, KH-03, KH-04 (CS-02, AD-02, KH-02, KH-04 thực ra có màn phủ: MH-MK-09, MH-SZ-12b, MH-SZ-05i, nhưng không ghi mã). KT-01, KT-02 trỏ sang 06 chưa có. **Gần như không ca UAT nào ghi mã story**: chỉ CS-06 → UAT-OA-54, KT-03 → UAT-OA-65 và bảng 01 dòng 1465–1475. Không ca UAT-SZ, UAT-MK nào dẫn story, kể cả SZ-US, MK-US | Thêm cột "Story" vào mọi bảng UAT; mỗi story có ít nhất một ca, hoặc ghi rõ "ngoài lô" |
| U8 | Trung bình | Màn thiếu trạng thái (rỗng / đang tải / lỗi / không có quyền) hoặc thiếu câu chính xác | **00–02 (22 màn):** MH-UI-01 (rỗng khi chưa có vai trò), UI-02 (ô trống), UI-05, UI-08 (lỗi tải mẫu câu), UI-09 (không quyền cả panel), UI-10 (lỗi không có "Thử lại"), UI-11 M9 (rỗng, tải, lỗi VCdms); MH-PQ-03 (lỗi tải), PQ-04, PQ-08, PQ-14 (đang tải), PQ-05, PQ-07 (rỗng các tab), PQ-09 (không quyền), PQ-12 (đang tải khi bấm Hiện), PQ-13 (tải, lỗi), PQ-15 (rỗng, tải thư mục Google); MH-DK-01/03/04 (câu 403 riêng), DK-06 (tải, rỗng), DK-09 (lỗi "như trên"), DK-13 (tải, 403 không câu), DK-14 (rỗng tab SĐT dùng chung). **03–05 (30 màn):** MH-SZ-02, 04, 05 và 05a–05h (lỗi tạo lệnh, không quyền), 05i, 06, 07, 08, 09, 10, 11, 12a, 12b, 13, 14 (thiếu câu không quyền); MH-OA-04 (lỗi gửi chỉ "theo bảng mã"), OA-06, 08, 09, 10, 12, 13, 14, 15, 16; MH-MK-07, 08, 09, 11, 12. Đủ trạng thái: MH-UI-03, 04, 07; MH-PQ-01, 02, 06, 10; MH-DK-02, 05, 07, 08, 10, 11, 12; MH-SZ-01, 03; MH-OA-01, 02, 03, 07, 11, 17, 19; MH-MK-01…06, 10 | Bổ sung. Câu "không có quyền" của mọi màn trỏ MH-PQ-11 (dạng B / C), không viết câu riêng |
| U9 | Trung bình | Quy tắc không có UAT | **00:** §3.5 múi giờ; §5 UI-TP-01…18 (0 ca); §6.3 `RT-LOST`; §7.3 khả năng tiếp cận; §7.4 hiệu năng (≤ 3 giây, 5.000 hội thoại); laptop 1366×768; phím Alt+A, Alt+D, Alt+Shift+↓, `?`. **01:** PQ-56 soát quyền định kỳ, PQ-36 ẩn email, PQ-52 xoay vòng token thiết bị, PQ-09 lưu nhật ký 24 tháng (bảng UAT 01 gần như không trỏ mã PQ). **02:** DK-19, 28, 34, 36, 38, 39, 43, 45, 51 (bảng 11.1 không trỏ mã DK) | Thêm ca, và thêm cột "Quy tắc" vào bảng UAT 01, 02 |
| U10 | Nhẹ | Dữ liệu trong ca không có trong bộ dữ liệu | UAT-UI-65 (DH-2026-0456), UAT-PQ-76 (K7), UAT-DK-58, UAT-SZ-12 ("NVKD B"), UAT-MK-44 | Gộp vào U1 |
| U11 | Nhẹ | Bước mâu thuẫn hoặc trống | UAT-OA-41 (bước và kết quả trái nhau), UAT-MK-35 (không có bước), UAT-PQ-43 (hai kết quả có điều kiện) | Sửa |
| U12 | Nhẹ | Mã phụ và thứ tự | Mã phụ "[KD UAT-01]", "GS01…GS13" dễ nhầm (§6 R11). UAT-UI-117 nằm giữa UI-96 và UI-97; UAT-PQ xen số trong các nhóm. Không có mã trùng, không nhảy số (UI 1–117, PQ 1–94, DK 1–64, SZ 1–75 + R01–R20, OA 1–138, MK 1–69) | Chấp nhận được; nên có bảng chỉ mục mã UAT theo màn |

---

## 5. [Đã có] sai so với code

Đã kiểm **62 chỗ** ghi "Đã có" / ✅ ở 00–05 với code `main` `f106e3b` (route, menu, icon, mã và màu kênh, câu chữ khung chat, ô soạn, thanh công cụ Zalo, mẫu câu, Thông tin người gửi, trang Đồng bộ, token và guard ở 01 §2.10, connector OA, webhook Fanpage). Kết quả: **51 đúng, 2 sai, 9 một phần.** Phần "Đã có" khớp code khá sát; lỗi tập trung ở ô soạn.

| # | Mức | File:mục (dòng) | Đặc tả nói | Code thực tế | Sửa |
|---|---|---|---|---|---|
| C1 | Trung bình | 00 MH-UI-08 #6 (dòng 1310) ✅; 03 MH-SZ-05 #12 ✅ | Ô soạn tối đa **4.000** ký tự | Web cho gõ 4.000 (`apps/web/src/components/chat/Composer.tsx:10` `MAX_LEN = 4000`), nhưng API chỉ nhận **2.000** (`packages/shared/src/outbox.ts:17` `OUTBOX_MAX_TEXT = 2000`, áp ở dòng 97). Tin 2.001–4.000 ký tự trên một dòng bị API trả 400. 04 §3.3 và MH-OA-04 lại ghi 2.000 | Đặc tả hạ về 2.000 ở 00 và 03 (khớp 04 và giới hạn của OA), và giao dev sửa `MAX_LEN` |
| C2 | Trung bình | 04 MH-OA-04 #1 (dòng 610), cột hiện trạng "**Đã có**" | Placeholder "Nhập tin trả lời {tên}…", `autoSize` 1–8 dòng, ≤ 2.000 ký tự có bộ đếm `0/2000` | `Composer.tsx:233–237` (dùng chung mọi kênh): placeholder `Nhập tin nhắn tới ${placeholderName}`, `autoSize` 1–6, `maxLength` 4000, **không có bộ đếm** | Đổi hiện trạng thành "Sửa" |
| C3 | Trung bình | 00 MH-UI-08 #5 (dòng 1309) ✅ | Gợi ý `/` theo phạm vi cá nhân / nhóm / công ty | `Composer.tsx:111–116` chỉ lọc theo phím tắt và tên; code chưa có khái niệm phạm vi mẫu câu | Đổi thành 🟡 |
| C4 | Trung bình | 00 MH-UI-08 #2a (dòng 1301) ✅ | ⚡ "Tin nhắn nhanh" là nút chung mọi kênh | `ChatPane.tsx:365–367`: `ComposerTools` (chứa ⚡) chỉ hiện khi kênh là `zalo` | Đổi thành 🟡 |
| C5 | Nhẹ | 00 MH-UI-01 #11 (dòng 480) ✅ | Trang khác đệm **24 px** (`app-content--padded`) | `apps/web/src/styles.css:124–126`: `padding: 16px` | Đổi thành 🟡 (00 §3.7 muốn 24 px) |
| C6 | Nhẹ | 00 MH-UI-07 #5 (dòng 1089) ✅ | Nhóm: "Nhóm · {n} thành viên · {nick}" | `ChatPane.tsx:246–252`: chỉ "Nhóm · n thành viên" | Đổi thành 🟡 |
| C7 | Nhẹ | 00 MH-UI-07 (dòng 1153–1154) ✅ | "Đã gửi" `CheckOutlined`, "Đã nhận" hai dấu ✓ | `MessageBubble.tsx:95, 247–259`: chỉ có chữ, không icon (chỉ `OutboxBubble` có ✓) | Đổi thành 🟡 |
| C8 | Nhẹ | 00 MH-UI-08 #7 (dòng 1311) ✅ | Tooltip "Gửi cho khách {đường gửi} (Enter)" | `Composer.tsx`: tooltip "Gửi (Enter)" | Đổi thành 🟡 |
| C9 | Nhẹ | 00 MH-UI-02 (dòng 586) ✅ | Đăng nhập xong "vào `next` hoặc R3" | `LoginPage.tsx:26` luôn về `/conversations` (chính 00 R2 ghi 🟡) | Sửa ký hiệu cho khớp R2 |

Các chỗ đúng tiêu biểu: bảng route và menu hiện có (`App.tsx:16–29`, `AppLayout.tsx`), token màu (`styles.css:2–45`), `CHANNEL_INFO` 4 kênh và tiền tố (`packages/shared/src/channels.ts`), `utils/time.ts`, câu chữ bong bóng và outbox, toàn bộ nhãn thanh công cụ Zalo MH-SZ-05a–h, MH-SZ-06, MH-SZ-08, MH-SZ-12b, 01 §2.10 (`token.service.ts`, `auth.guard.ts`, `outbox.controller.ts`), 04 §8.1 (PKCE, làm mới token, `needsReconnect`, kiểm chữ ký webhook, mã lỗi), 05 Phụ lục A (webhook Fanpage chưa đọc `referral`).

---

## 6. Tham chiếu hỏng

Rà tự động: mã màn `MH-*` (96 mã định nghĩa), quy tắc `DK/SZ/OA/MK/PQ-xx`, mã UAT (545 mã), link Markdown. **Không có** mã màn, mã quy tắc hay mã UAT nào được nhắc mà không tồn tại. Không có mã UAT trùng hay nhảy số. Lỗi còn lại là trỏ **đúng mã nhưng sai chỗ**, hoặc trỏ tới file chưa có:

| # | Mức | Vị trí | Tham chiếu | Vấn đề | Sửa |
|---|---|---|---|---|---|
| R1 | Trung bình | 01 PQ-03 (dòng 464) | "Mở bằng link → màn hình **MH-PQ-10**" | MH-PQ-10 là Nhật ký truy cập. Màn "Không có quyền" là **MH-PQ-11** | Đổi thành MH-PQ-11 |
| R2 | Nhẹ | 03 MH-SZ-01 #4 (dòng 482) | "00 **MH-UI-08** #2" cho phạm vi `Quá SLA` | MH-UI-08 là Ô soạn tin. Danh sách hội thoại là **MH-UI-10** (#2/#3) | Đổi thành MH-UI-10 |
| R3 | Nhẹ | 03 MH-SZ-01 #9l (dòng 502) | "khớp chip SLA dòng 3 của 00 **MH-UI-08**" | Như trên. Chip SLA ở 00 §3.4 / MH-UI-10 #7 | Đổi, và xem §1 dòng 14 |
| R4 | Trung bình | 00 §2.1 R3, §2.2 | Trang mặc định SA `/customers/erp-link` → "MH-DK" | 02 không có màn ở route này (MH-DK-10 là drawer, MH-DK-13 là `/customers/erp-matching`) | Trỏ MH-DK-12 hoặc MH-DK-13 |
| R5 | Trung bình | 04:39, 04:1652, 04 L9; 03 Q22 (dòng 1797); 00 Q5; 02 DK-58 | `06-hoa-don-cong-no.md` | File chưa có. KT-01, KT-02 và 30 việc chuyển đang trỏ vào khoảng trống | Viết 06 trước khi chốt lô |
| R6 | Trung bình | 00 §2.2 dòng "Báo cáo" `/reports`; 04 `/reports/cskh`; 05 `/reports/marketing` | "chưa có file (câu hỏi mở 5)" | Không file nào đặc tả trang Báo cáo chung (F10.1, F10.2, GS-06), dù 03 SZ-21 và 04 OA-31 định nghĩa chỉ số cho nó | Giao chủ quản (00 Q5 đề xuất MH-DK) |
| R7 | Nhẹ | README.md dòng 63 | `review/so-gop-y.md` | File không tồn tại. Sổ thực tế là `review/dac-ta-vong-1/*-xu-ly.md` | Sửa link |
| R8 | Nhẹ | README.md bảng Tài liệu | – | Chưa có dòng cho `06-hoa-don-cong-no.md` (mã màn, mã UAT) | Thêm khi viết 06 |
| R9 | Nhẹ | 00 dòng 1634 | `](G…` | Chuỗi bị hiểu là link Markdown hỏng | Thêm dấu cách hoặc escape |
| R10 | Nhẹ | 00 §3.5 (dòng 354) | `utils/time.ts` | Đường dẫn thiếu tiền tố; file thật là `apps/web/src/utils/time.ts` | Ghi đường dẫn đầy đủ |
| R11 | Nhẹ | 05 §10.2 (nhiều ca) | "[KD UAT-01]", "[GD UAT-46]", "[MK UAT-39]"; 03 "GS01…GS13" (dòng 1665) | Mã phụ lấy từ file góp ý của từng vai trò, không phải mã của file đặc tả nào, dễ nhầm với `UAT-xx-nn` | Đổi thành "(góp ý P-KD #…)" |
| R12 | (đã tính ở §1 dòng 26) | 02 §1.3, §5.2a; 04 §1.3, OA-11 | `CH-2`, `CH-3`, `CH-4` | Cùng mã, khác nghĩa giữa 02 và 04 | Thêm tiền tố file |
| R13 | (đã tính ở §1 dòng 7) | 05 D-MK-8 | "Khớp OA-18 file 04" | OA-18 nói GĐ duyệt, không khớp | Bỏ câu |
| R14 | Trung bình | 00 §2.2 các dòng "Chia hội thoại & SLA" `/admin/routing`, "Lưu trữ & NĐ 13" `/admin/privacy`, "Kết nối kênh" `/channels` (cột màn hình ghi "MH-PQ"); 00 dòng 197, 321, 886 | "MH-PQ (Chia hội thoại & SLA)" | 01 **không có màn nào** như vậy. Cấu hình SLA nằm ở 04 MH-OA-18 (`/settings/sla`); cấu hình thời hạn lưu trữ (PQ-55, UAT-PQ-94) không có màn; phiếu NĐ 13 là MH-PQ-13 `/privacy-requests` | Trỏ đúng màn (MH-OA-18, MH-PQ-13), hoặc giao 01 đặc tả màn "Chia hội thoại" và "Thời hạn lưu trữ" |
| R15 | Nhẹ | 01 MH-PQ-11 dòng "UAT:" (dòng 1237) | UAT-PQ-20, 30, 37 | Thiếu UAT-PQ-06, 16, 19, dù các ca này kiểm đúng màn đó | Bổ sung |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/qa.md) | — |
