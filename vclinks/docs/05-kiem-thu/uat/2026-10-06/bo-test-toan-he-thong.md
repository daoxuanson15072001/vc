# Bộ test toàn hệ thống VClinks và kết quả chạy ngày 06/10/2026

Phiên bản 0.1 · 07/10/2026 · Trạng thái: Nháp

## Tóm tắt

- **Bộ test gồm 161 ca, chia 14 mảng:** đăng nhập, tổ chức, phân quyền, kênh, nhận tin, hộp thư, gửi tin, khách hàng, báo giá/phiếu, báo cáo, AI, quản trị, bảo mật, và kết nối VCsales thật (mảng VS, thêm 07/10/2026). Mỗi ca ghi cách làm, kết quả mong đợi, cách chạy (tay / trên điện thoại / tự động) và kết quả ngày 06/10/2026 (mảng VS: 07/10/2026).
- **Quy tắc an toàn:** chỉ gửi tin vào hội thoại **Con Hùng** (nick của dev002, `836061738303156140:4233225199553018761`) trên "Nick trực tiếp thử". Mọi hội thoại khác là khách hàng thật, không được động vào. Tin test bắt đầu bằng `[Test VClinks dd/mm]`.
- **Chạy thật 06/10/2026 trên máy 129:** gửi 5 lệnh vào Con Hùng (chữ, trả lời trích dẫn, sticker, danh thiếp, mẫu câu có biến). Cả 5 gửi thành công, Zalo báo "Đã nhận" / "Đã xem" trong khoảng 1 giây. Mẫu câu thử đã xóa sau khi test.
- **Kết quả 161 ca** (cập nhật 07/10/2026):

  | Kết quả | Số ca |
  |---|---|
  | Đạt khi chạy hoặc xem thật | 46 |
  | Đạt bằng test tự động | 75 |
  | Lỗi | 1 (Nháp AI chờ mã workspace) |
  | Bị chặn | 3 (số tài khoản nhanh; VS-04, VS-06 chờ khách test trên VCsales dev) |
  | Chưa có tính năng | 3 |
  | Không áp dụng (cần nhóm khách) | 1 |
  | Chưa chạy | 32 |

  Mảng VS (25 ca, 07/10/2026): 9 đạt khi chạy thật, 14 đạt bằng test tự động, 2 bị chặn. Các mảng khác là kết quả sau khi sửa lỗi lúc 16:31 ngày 06/10 và chạy lại trên Con Hùng (16:33–16:36). Lúc đầu: 33 đạt, 3 lỗi, 3 bị chặn.

  Ngoài các ca trên còn 10 lỗi nhỏ ghi ở mục 4.

- **Lỗi đáng sửa nhất:**
  - L6: Nháp AI trên máy 129 lỗi vì khóa Claude API chưa gắn workspace.
  - L9: nút Thoát không kết thúc phiên trên máy chủ.
  - L1, L3: chữ hướng dẫn trên nút gửi và hộp danh thiếp sai với nick trực tiếp.
- **Bị chặn:** VS-04, VS-06 (khối Thương mại và gửi PDF báo giá thật trên Con Hùng) chờ dev002 tạo khách test có SĐT của Con Hùng và một báo giá trên VCsales dev. Mã giả `KH-TEST-0101` của Con Hùng đã gỡ ngày 07/10 (có sao lưu).
- **Việc còn mở:** 32 ca chưa chạy. Mục 5 liệt kê các ca cần dev002 làm trên điện thoại hoặc trên trình duyệt có tệp: gửi từ Con Hùng, gửi ảnh và file từ máy.
- **Người duyệt xem kỹ:** mục 4 (lỗi) và mục 5 (việc cần làm tiếp).

## Mục lục

- [1. Phạm vi và cách chạy](#1-phạm-vi-và-cách-chạy)
- [2. Kết quả chạy thật trên Con Hùng](#2-kết-quả-chạy-thật-trên-con-hùng)
- [3. Bộ test theo mảng](#3-bộ-test-theo-mảng)
- [4. Lỗi tìm thấy](#4-lỗi-tìm-thấy)
- [5. Việc cần làm tiếp](#5-việc-cần-làm-tiếp)
- [6. Test tự động hiện có](#6-test-tự-động-hiện-có)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

## 1. Phạm vi và cách chạy

- **Môi trường:** máy 129, `https://vclink.tramaphutung.com`, nhánh `feat/giao-dien-moi` (commit `a264638`). Tài khoản dev002 (Admin + Giám đốc bán hàng).
- **Nick dùng gửi:** "Nick trực tiếp thử" (chế độ trực tiếp zca-js, người giữ Nguyễn Văn Minh). dev002 không phải người giữ nick nên mỗi lần gửi tin chữ đều có hộp "Trả lời thay".
- **Hội thoại được phép gửi:** chỉ **Con Hùng**. Không mở, không gửi, không thả cảm xúc, không đổi trạng thái ở hội thoại khác.
- **Ký hiệu cột "Cách":** Tay = thao tác trên Dashboard; ĐT = cần người cầm Zalo Con Hùng thao tác trên điện thoại; TĐ = có test tự động (mục 6).
- **Ký hiệu cột "06/10"** (mảng VS: cột "07/10"):
  - Đạt: chạy hoặc xem thật và đúng.
  - Đạt (TĐ): test tự động trên máy 129 đã đạt.
  - Lỗi: có lỗi, mã ở mục 4.
  - Chặn: chưa chạy được vì thiếu điều kiện.
  - Chưa có: tính năng chưa làm.
  - Chưa: chưa chạy.

## 2. Kết quả chạy thật trên Con Hùng

| Lần | Giờ | Việc | Lệnh (outbox) | Kết quả |
|---|---|---|---|---|
| T01 | 16:01 | Tin chữ "[Test VClinks 06/10] T01 tin chữ…" | `send_text` `6ac4b901…35ae` | Đạt: hiện "Đã nhận", hội thoại lên đầu danh sách |
| T02 | 16:02 | Trả lời trích dẫn tin file zip của Con Hùng | `send_text` `6ac4b928…35ba` | Đạt; trích dẫn chỉ hiện "[Tệp]", không có tên file |
| T03 | 16:36 | Thả cảm xúc lên tin của Con Hùng | `react` `6ac4c106…18fb` | Lúc đầu không có trên giao diện (L4); sau khi sửa: Đạt, 👍 lên tin zip |
| T04 | 16:03 | Sticker Zalo (tìm từ khóa "chào") | `send_sticker` `6ac4b956…35d0` | Đạt: "Đã nhận" |
| T05 | 16:03 | Danh thiếp "Hữu Hùng" | `send_card` `6ac4b97b…35dd` | Đạt: "Đã xem"; chữ hướng dẫn sai, không hỏi "Trả lời thay" (L3) |
| T06 | 16:04 | Tạo mẫu câu `/testchao` có `{ten_khach}`, `{ten_nv}`, chèn rồi gửi | `send_text` `6ac4b9ac…35ec` | Đạt: biến thay đúng "Con Hùng", "Dao Xuan Son". Đã xóa mẫu sau test |
| T07 | — | Gửi nhanh số tài khoản | — | Chặn: chưa có số tài khoản nào. Claude không nhập số tài khoản ngân hàng |
| T08 | 16:34 | Gửi báo giá | `send_quote` `6ac4c08c…18e9` | Lúc đầu bị chặn (chưa có mã KH); sau khi sửa L7: liên kết tay KH-TEST-0101, gửi BG-2026-0950 dạng PDF, Đạt. Hộp báo giá chưa ghi "trả lời thay" (nhỏ, để sau) |
| T09 | 16:06 | Nháp AI | — | Lỗi: "Chưa gọi được AI lúc này"; Claude API trả 400 (L6) |
| T10 | — | Xong → chọn kết quả → Mở lại | — | Chưa: khung trình duyệt của app đổi kích thước liên tục, bấm không trúng. Đã có test tự động |
| T11 | 16:33 | Gắn mã KH cho Con Hùng | — | Trang đối chiếu không có gợi ý; sau khi sửa: "Liên kết mã KH…" tìm KH-TEST-0101, liên kết được, ngăn khách hiện công nợ, hạng, báo giá mô phỏng |

Nhật ký máy Zalo xác nhận cả 5 lệnh `→ sent` (09:01:53–09:04:44 UTC).

## 3. Bộ test theo mảng

### 3.1 Đăng nhập và phiên (DN)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| DN-01 | Mail Workspace công ty đăng nhập lần đầu | Đăng nhập Google bằng mail chưa có trong VClinks | Tự tạo người dùng không vai trò; trang "chờ gán vai trò"; Admin có thông báo | TĐ, Tay | Đạt (TĐ) |
| DN-02 | Mail ngoài công ty | Đăng nhập bằng mail khác `@vcprosperous.com` | "Chỉ tài khoản @vcprosperous.com…" | TĐ | Đạt (TĐ) |
| DN-03 | Google cá nhân lập bằng địa chỉ công ty | Token không có `hd` | Bị từ chối, không tạo người dùng | TĐ | Đạt (TĐ) |
| DN-04 | Người bị khóa / nghỉ việc | Đăng nhập | "Tài khoản … đã bị khóa…" | TĐ | Đạt (TĐ) |
| DN-05 | Tắt tự đăng ký | `AUTH_SELF_SIGNUP=0`, đăng nhập mail mới | "chưa được cấp quyền", ghi `login_denied` | TĐ | Đạt (TĐ) |
| DN-06 | Người chờ được gán vai trò | Admin gán vai trò cho người đang ở trang chờ | Trong khoảng 1 phút tự vào Hộp thư | Tay | Chưa |
| DN-07 | Hủy ở màn Google | Bấm hủy | "Bạn đã hủy đăng nhập Google." | TĐ | Đạt (TĐ) |
| DN-08 | Phiên hết hạn | 12 giờ không dùng | Về `/login`, báo hết phiên | TĐ | Đạt (TĐ) |
| DN-09 | Thoát | Bấm "Thoát" rồi dùng lại phiên cũ | Phiên cũ bị từ chối | Tay | Đạt (sau khi sửa: Thoát kết thúc phiên trên máy chủ; test tự động) |
| DN-10 | Đăng nhập bằng token nội bộ | Ô "Đăng nhập bằng token" | Vào được khi `AUTH_TOKEN_LOGIN` bật | TĐ | Đạt (TĐ) |
| DN-11 | dev002 đăng nhập Google thật | Trên vclink.tramaphutung.com | Vào Hộp thư | Tay | Đạt |

### 3.2 Tổ chức và người dùng (TC)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| TC-01 | Quản lý đơn vị | Thêm, đổi tên, chuyển cha, ngừng, khôi phục | Cây cập nhật; loại đơn vị sai cha bị chặn | Tay, TĐ | Đạt (TĐ) |
| TC-02 | Nhập cây tổ chức từ file | Nhập CSV mẫu, rồi file 60 dòng có lỗi | Xem trước rồi mới ghi; báo đúng dòng lỗi | Tay, TĐ | Đạt (TĐ) |
| TC-03 | Thêm người mail ngoài công ty | Form Thêm người | Bị chặn | Tay | Chưa |
| TC-04 | Gán vai trò sai loại đơn vị | NVKD tại division | Bị chặn | TĐ | Đạt (TĐ) |
| TC-05 | Gán vai trò nhạy cảm | Thêm admin / quan sát / GĐ bán hàng | Thành yêu cầu chờ người thứ hai duyệt | Tay, TĐ | Đạt (TĐ) |
| TC-06 | Duyệt yêu cầu vai trò | Duyệt / từ chối / hủy | Trạng thái đổi, có nhật ký | Tay | Chưa |
| TC-07 | Khóa người dùng | Tạm khóa | Phiên đang mở bị thu hồi ngay; mở khóa dùng lại được | Tay, TĐ | Đạt (TĐ) |
| TC-08 | Sắp nghỉ | Đánh dấu sắp nghỉ | Token MCP chỉ còn nhóm Đọc; ngưỡng cảnh báo giảm | Tay | Chưa |
| TC-09 | Nghỉ việc và bàn giao | 4 bước ở trang nghỉ việc | Khách và nick được bàn giao; nick bật "Chưa an toàn" | Tay, TĐ | Đạt (TĐ) |
| TC-10 | Người mới chờ vai trò | Việc cần làm, lọc "Chưa có vai trò" | Đếm đúng, bấm vào ra danh sách | Tay | Đạt (Việc cần làm hiện 2 người) |
| TC-11 | Tự sửa quyền chính mình | Mở chi tiết của mình | Báo "Không sửa được quyền của chính bạn" | Tay | Chưa |
| TC-12 | Nhập người dùng từ file | Mẫu XLSX | Tạo người và vai trò, báo lỗi từng dòng | Tay | Chưa |

### 3.3 Phân quyền (PQ)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| PQ-01 | Xem ma trận quyền | Quản trị → Vai trò và quyền; bấm tên một vai trò hệ thống | 10 vai trò hệ thống, rồi các vai trò tùy chỉnh (in nghiêng, nhãn "Tùy chỉnh"); chú giải phạm vi; báo "Vai trò hệ thống không sửa được. Sao chép để tạo bản tùy chỉnh." | Tay | Đạt (bản chỉ xem); bản có vai trò tùy chỉnh: Đạt (tay trên 129, khoảng 17:45) |
| PQ-02 | NVKD chỉ thấy nick mình giữ | Đăng nhập NVKD | Hộp thư chỉ có hội thoại trên nick đó | TĐ | Đạt (TĐ) |
| PQ-03 | Giám sát thấy cả tổ | Đăng nhập giám sát | Thấy hội thoại của tổ | TĐ | Đạt (TĐ) |
| PQ-04 | GĐ bán hàng thấy division | Đăng nhập GĐ | Thấy cả division, không thấy division khác | TĐ | Đạt (TĐ) |
| PQ-05 | Quan sát chỉ đọc | Đăng nhập quan sát | Không có nút gửi; API gửi trả 403 | TĐ | Đạt (TĐ) |
| PQ-06 | 29 ca "không được thấy" (M1b) | Bộ `uat-m1b-khong-duoc-thay` | Đều bị chặn | TĐ | Đạt (TĐ) |
| PQ-07 | Che số điện thoại | Hồ sơ khách Con Hùng | Hiện `0379 *** 936`, nút "Hiện" ghi nhật ký | Tay | Đạt (thấy số bị che; chưa bấm Hiện) |
| PQ-08 | Quyền hiệu lực | Chi tiết người dùng → Quyền hiệu lực | Giải thích vì sao thấy / không thấy | Tay | Chưa |
| PQ-09 | Xin quyền tạm thời | Xin theo SĐT / mã KH | Người duyệt đúng theo cây; hết hạn tự thu hồi | Tay, TĐ | Đạt (TĐ) |
| PQ-10 | Trực thay | Tạo trực thay cho Nguyễn Văn Minh | Trả lời không còn hỏi "Trả lời thay" | Tay | Chưa |
| PQ-11 | Trả lời thay người khác | Gửi ở hội thoại do người khác xử lý | Có cảnh báo cam và hộp xác nhận | Tay | Đạt (T01) |
| PQ-12 | Đường API chưa khai báo quyền | Gọi đường mới không có dòng quyền | 403 | TĐ | Đạt (TĐ) |
| PQ-13 | Tạo vai trò tùy chỉnh (UAT-PQ-10) | Admin: "Sao chép thành vai trò mới" từ NVKD, tên "NVKD thực tập", "Gửi báo giá" = ✖, thử đặt "Xem hội thoại" = DV | Ô DV khóa, tooltip "Vượt quyền của vai trò gốc NVKD."; lưu được; API cũng trả 400 khi gửi phạm vi rộng hơn gốc; tên trùng (kể cả khác dấu, hoa thường) bị chặn | Tay, TĐ | Đạt (TĐ `custom-roles.e2e-spec.ts`); tay: Đạt (trên 129, khoảng 17:45) |
| PQ-14 | Người giữ vai trò tùy chỉnh | Gán "NVKD thực tập" cho một người | Có đủ quyền NVKD trừ "Gửi báo giá": không có nút, API gửi báo giá trả 403; trang Cá nhân và danh sách người dùng ghi tên vai trò tùy chỉnh; lọc người dùng theo vai trò tùy chỉnh | TĐ | Đạt (TĐ) |
| PQ-15 | Sửa vai trò tùy chỉnh | Sửa quyền của vai trò đang có người giữ; thử đổi vai trò gốc; người đang giữ vai trò tự sửa nó | Quyền mới áp dụng trong vòng 1 phút, báo "Đã lưu vai trò <tên>. Áp dụng cho <n> người."; đổi vai trò gốc bị chặn; tự sửa bị chặn "Không sửa được quyền của chính bạn." | TĐ | Đạt (TĐ) |
| PQ-16 | Xóa vai trò tùy chỉnh | Xóa vai trò còn người giữ hoặc còn yêu cầu chờ duyệt | Nút khóa, tooltip "Còn <n> người đang có vai trò này."; API trả 409 | Tay, TĐ | Đạt (TĐ); tay: Đạt (trên 129, khoảng 17:45) |
| PQ-17 | Bản sao vai trò nhạy cảm (PQ-42) | Gán bản sao của GĐ bán hàng cho một người | Thành yêu cầu chờ Ban giám đốc / Kiểm soát duyệt; duyệt xong mới có quyền | TĐ | Đạt (TĐ) |
| PQ-18 | Đổi đơn vị, nhập file | Đổi tổ của người giữ vai trò tùy chỉnh; nhập file có `vai_tro` = mã `tc_…` | Vai trò tùy chỉnh đi theo người (không thành NVKD đầy đủ); dòng nhập file dùng được mã tùy chỉnh, mã không có thì báo lỗi dòng | TĐ | Đạt (TĐ) |
| PQ-19 | GĐ xem vai trò (UAT-PQ-11) | Đăng nhập GĐ, mở Vai trò và quyền | Thấy ma trận; không có nút "Sao chép thành vai trò mới"; API tạo trả 403 | TĐ | Đạt (TĐ, API) |

### 3.4 Kênh và máy Zalo (KN)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| KN-01 | Trang Kênh kết nối | Mở `/channels` | 6 thẻ kênh, trạng thái đúng, OA/Fanpage báo thiếu biến môi trường | Tay | Đạt |
| KN-02 | Quét QR nick trực tiếp | Kết nối bằng mã QR, chọn "Trực tiếp" | Đã kết nối, tin về Hộp thư | Tay | Đạt (sáng 06/10) |
| KN-03 | Quét nhầm nick | Quét bằng nick khác | Máy Zalo tự đăng xuất nick lạ | TĐ | Đạt (TĐ) |
| KN-04 | Mở Zalo Web nơi khác | Mở chat.zalo.me của nick thử | Báo "đang mở Zalo Web ở nơi khác", không tự giành phiên | ĐT | Chưa (để sau đợt theo dõi) |
| KN-05 | Chuyển Zalo Web → trực tiếp và quay về (P4) | Nút "Chuyển sang trực tiếp" / "Quay về Zalo Web" | Không cần quét lại, tin tiếp tục về | Tay | Chưa (P4.0 sau 08/10 10:16) |
| KN-06 | Ngắt nick | Ngắt kết nối | Xóa phiên và thư mục nick | TĐ | Đạt (TĐ) |
| KN-06a | Người giữ nick tự ngắt nick của mình (thêm 07/10/2026) | Đăng nhập bằng người giữ nick (không phải Admin), Kênh › Máy Zalo › "Ngắt" ở dòng nick của mình | Nick ngắt, phiên trên máy chủ bị xóa, tin cũ còn, nhật ký ghi "người giữ nick"; đồng nghiệp gọi lệnh ngắt bị chặn | TĐ | Đạt (TĐ, phần API); giao diện chưa thử tay |
| KN-07 | Bản đồ kênh | `/channels/map` | Đủ nick, người giữ, khung gửi | Tay | Chưa |
| KN-08 | Đổi người giữ nick | Gán kênh, lý do ≥ 10 ký tự | Đổi được, có nhật ký | Tay | Chưa |
| KN-09 | Nick chờ xác nhận | Thiết bị lạ gửi dữ liệu nick | Hiện ở Việc cần làm, xác nhận được | Tay | Chưa |
| KN-10 | Sức khỏe nick | Nick mất kết nối hơn 2 phút | Chấm đỏ; "Báo Admin" tối đa 1 lần / 30 phút | Tay | Chưa |
| KN-11 | Máy Zalo khởi động lại | Triển khai lại `zalo-farm` | Nick tự đăng nhập bằng phiên đã lưu, bù tin trong lúc tắt | Tay | Đạt (15:11: bù 16 tin cá nhân, 182 tin nhóm) |

### 3.5 Nhận tin (NT)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| NT-01 | Tin chữ | Con Hùng nhắn | Về Hộp thư dưới 2 giây, có nội dung | ĐT | Đạt (sáng 06/10, khoảng 0,3 giây) |
| NT-02 | Ảnh | Con Hùng gửi ảnh | Ảnh hiện trong khung chat | ĐT | Đạt (`VCPROSEPROUS.png`) |
| NT-03 | Video | Gửi video | Phát được ngay trong khung | ĐT | Đạt (`ban_nghe_thu.mp4`) |
| NT-04 | PDF | Gửi PDF | Bấm thẻ mở xem ở tab mới | ĐT | Đạt (`MATBAO.docx.pdf`) |
| NT-05 | File khác | Gửi zip, xlsx, md | Thẻ tệp, tải về được | ĐT | Đạt |
| NT-06 | Ghi âm | Gửi ghi âm | Nghe được; bấm chuyển thành chữ | ĐT | Chưa |
| NT-07 | Thu hồi | Con Hùng thu hồi một tin | Tin hiện "đã thu hồi", giữ giờ cũ | ĐT, TĐ | Đạt (TĐ) |
| NT-08 | Cảm xúc | Con Hùng thả cảm xúc lên tin test | Hiện trên Dashboard | ĐT, TĐ | Đạt (TĐ) |
| NT-09 | Đang soạn | Con Hùng gõ chưa gửi | Đầu khung chat hiện "Đang soạn tin…" | ĐT | Chưa |
| NT-10 | Đã nhận / Đã xem | Con Hùng mở tin | Tin của mình đổi sang "Đã xem" | ĐT | Đạt (T05, T06) |
| NT-11 | Số chưa đọc | Con Hùng nhắn nhiều tin | Số đỏ đúng; trả lời thì về 0 | ĐT, TĐ | Đạt (TĐ) |
| NT-12 | Lời mời kết bạn | Có người gửi lời mời cho nick thử | Hiện ở Danh bạ → Lời mời, chấp nhận / từ chối được | ĐT | Đạt một phần (17 nhận, 51 đã gửi được đồng bộ; chưa bấm chấp nhận thật) |
| NT-13 | Sự kiện nhóm | Ai đó vào / rời nhóm | Dòng hệ thống, không tính chưa đọc, không kêu chuông | TĐ | Đạt (TĐ) |
| NT-14 | Tin đến khi máy Zalo tắt | Như KN-11 | Không mất tin | Tay | Đạt |

### 3.6 Hộp thư (HT)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| HT-01 | 4 tab | Cần trả lời / Chờ khách / Đã xong / Tất cả | Lọc đúng, số đếm đúng | Tay | Đạt (Tất cả 18, Cần trả lời 1) |
| HT-02 | Tìm hội thoại | Gõ tên, SĐT | Ra đúng hội thoại | Tay | Chưa |
| HT-03 | Xong + kết quả | Bấm Xong → chọn kết quả | Sang tab Đã xong; khách nhắn mới thì tự mở lại | Tay, TĐ | Đạt (TĐ); tay chưa (T10) |
| HT-04 | Chờ khách | Đánh dấu chờ khách | Sang tab Chờ khách | Tay | Chưa |
| HT-05 | SLA quá hạn | Hội thoại chưa trả lời quá 15 phút giờ làm việc | Nhãn đỏ "Quá …" | Tay | Đạt (thấy "Quá 4g") |
| HT-06 | Ghim, đánh dấu chưa đọc | Menu hội thoại | Thành lệnh gửi, đổi trên Zalo | Tay | Chưa |
| HT-07 | Tìm kiếm toàn cục | Ctrl K | Tìm theo tên, SĐT, nội dung, mã KH | Tay, TĐ | Đạt (TĐ) |
| HT-08 | Ngăn thông tin khách | Nút người / Alt+P | Mở ngăn Khách / Báo giá / Tra hàng | Tay | Đạt (kiểm lại: ngăn mở dạng khung trượt ở màn hẹp) |
| HT-09 | Menu tin | Chuột phải lên tin | Sao chép, nhắc việc, thông tin hội thoại, chuyển hậu mãi, chuyển CSKH soạn báo giá | Tay | Đạt (thấy menu) |
| HT-10 | Nhắc việc từ tin | "Tạo nhắc việc từ tin này" | Có nhắc (chỉ lưu trên trình duyệt) | Tay | Chưa |
| HT-11 | Nhận / giao / chuyển hội thoại, ghi chú nội bộ, nhãn VClinks | Nút Phụ trách, nút Ghi chú (Alt+G), nút nhãn trên đầu khung chat; nút "Nhận" ở hàng Chưa phân công | Đúng đặc tả 00 MH-UI-08 / MH-UI-10 | Tay, TĐ | Đạt (TĐ `conversation-work.e2e-spec.ts`; 16:59 chạy thật trên Con Hùng: ghi chú nội bộ, nhãn "Khách thử", không lệnh nào ra Zalo; nick cá nhân hiện "người giữ nick xử lý") |

### 3.7 Gửi tin (GT): chỉ trên Con Hùng

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| GT-01 | Tin chữ | Gõ, Enter | Gửi ngay qua máy Zalo, "Đã nhận" | Tay | Đạt (T01) |
| GT-02 | Tin nhiều dòng | Shift+Enter | Một tin nhiều dòng | Tay | Chưa |
| GT-03 | Trả lời trích dẫn | Nút trả lời trên tin | Zalo hiện trích dẫn | Tay | Đạt (T02) |
| GT-04 | Sticker | Tìm "chào", chọn | Gửi đúng sticker | Tay | Đạt (T04) |
| GT-05 | Danh thiếp | Chọn người trong hội thoại | Gửi danh thiếp theo id | Tay | Đạt (T05), xem L3 |
| GT-06 | Mẫu câu có biến | `/` hoặc Tin nhắn nhanh | Biến thay đúng tên khách, tên người gửi | Tay | Đạt (T06) |
| GT-07 | Gửi ảnh từ máy | Nút ảnh, chọn ≤ 10 ảnh | Ảnh tới Zalo | Tay | Chưa (khung trình duyệt của Claude không chọn được tệp) |
| GT-08 | Gửi file | Đính kèm ≤ 10 MB | File tới Zalo | Tay | Chưa |
| GT-09 | Thả cảm xúc | Di chuột lên tin | Chọn cảm xúc | — | Đạt (16:36 sau khi sửa: 👍 lên tin zip của Con Hùng) |
| GT-10 | Số tài khoản nhanh | Nút ngân hàng | Chèn số tài khoản đã lưu | Tay | Chặn (chưa có số tài khoản) |
| GT-11 | Trả lời thay | Gửi khi người khác xử lý | Hộp xác nhận | Tay | Đạt; xem L2 |
| GT-12 | Lệnh gửi lỗi | Gửi khi nick mất kết nối | Hiện ở Lệnh gửi, thử lại được | Tay, TĐ | Đạt (TĐ) |
| GT-13 | Nhịp gửi | Gửi dồn nhiều tin | Lệnh chờ theo nhịp, không gửi dồn | TĐ | Đạt (TĐ) |
| GT-14 | Không duyệt không gửi | Lệnh thiếu `approvedBy` / `approvedAt` | Không bao giờ được gửi | TĐ | Đạt (TĐ) |
| GT-15 | Bình chọn, @nhắc tên | Trong nhóm | — | — | Không chạy (Con Hùng là hội thoại 1-1, không được dùng nhóm khách) |
| GT-16 | Thu hồi tin của mình | Menu tin của mình | Thu hồi trên Zalo | Tay | Chưa (chưa thấy nút trên tin của mình) |

### 3.8 Khách hàng (KH)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| KH-01 | Danh sách khách | `/customers`, lọc có / chưa có mã KH | Danh sách và bộ lọc đúng | Tay | Đạt |
| KH-02 | Hồ sơ trong ngăn | Ngăn Khách của Con Hùng | Kênh, người liên hệ, SĐT che, phụ trách, mã KH, liên lạc gần đây | Tay | Đạt |
| KH-03 | Hồ sơ 360 | "Mở 360" | Đầu trang, dòng thời gian, khối thương mại | Tay, TĐ | Đạt (TĐ); tay chưa (mở tab mới) |
| KH-04 | Gắn mã KH VCsale | Đối chiếu mã KH | Gợi ý theo điểm, xác nhận | Tay | Đạt (16:33 sau khi sửa: liên kết tay KH-TEST-0101 bằng "Liên kết mã KH…") |
| KH-05 | Gộp tự động, hoàn tác 30 ngày | Hai hồ sơ trùng | Tự gộp, hoàn tác được | TĐ | Đạt (TĐ) |
| KH-06 | Gắn tay hội thoại vào khách, tách hồ sơ | — | — | — | Chưa có |
| KH-07 | Đổi người phụ trách khách | — | — | — | Chưa có (chỉ qua bàn giao khi nghỉ việc) |

### 3.9 Báo giá và phiếu CSKH (BG)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| BG-01 | Gửi báo giá cho Con Hùng | Nút báo giá | Chọn báo giá, gửi PDF và lời nhắn qua lệnh gửi | Tay | Đạt (16:34 sau khi sửa: gửi BG-2026-0950 dạng PDF qua máy Zalo, dữ liệu mô phỏng) |
| BG-02 | Báo giá hết hạn / đã đổi phiên bản | Gửi báo giá cũ | Bị chặn, báo rõ lý do | TĐ | Đạt (TĐ) |
| BG-03 | Chip nợ quá hạn | Khách có nợ quá hạn | Chip đỏ ở hội thoại | TĐ | Đạt (TĐ, dữ liệu mô phỏng) |
| BG-04 | Tra hàng | Ngăn Tra hàng | Giá theo hạng khách | Tay | Chưa (dữ liệu mô phỏng) |
| BG-05 | Chuyển CSKH soạn báo giá | Menu tin của Con Hùng | Tạo phiếu bán hàng, vào hàng việc | Tay | Chưa |
| BG-06 | Chuyển hậu mãi | Menu tin | Tạo phiếu hậu mãi | Tay | Chưa |
| BG-07 | NVKD duyệt / trả lại phiếu | Chờ duyệt | Duyệt thì gửi qua lệnh gửi; trả lại có lý do | TĐ | Đạt (TĐ) |
| BG-08 | Cấu hình hàng việc | Phiếu → Cấu hình hàng việc | Lưu người nhận hàng Bán hàng / Hậu mãi | Tay | Chưa |
| BG-09 | Nhắc phiếu quá hạn | Phiếu chờ quá 10 / 20 phút | Nhắc người làm, báo giám sát | TĐ | Đạt (TĐ) |

### 3.10 Báo cáo và thông báo (BC)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| BC-01 | Tổng quan | `/reports` | Lượt chờ, FRT, % quá SLA, % trả lời qua VClinks | Tay | Đạt (hiện đủ; số 0 vì job tính sau 01:00) |
| BC-02 | Hiệu suất | Tab Hiệu suất | Từng người, từng lượt | Tay, TĐ | Đạt (TĐ) |
| BC-03 | Xuất Excel | Nút Xuất Excel | File XLSX ≤ 120 ngày | Tay, TĐ | Đạt (TĐ) |
| BC-04 | Thông báo | Chuông, `/notifications` | Thông báo realtime, đánh dấu đã đọc | Tay | Đạt (chuông có 2 thông báo) |
| BC-05 | Hoạt động của tôi | `/settings/activity` | 30 ngày hoạt động | Tay | Chưa |
| BC-06 | KPI hằng ngày | Job 01:00 | Bảng `kpi_daily` có số ngày trước | TĐ | Đạt (TĐ) |

### 3.11 AI

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| AI-01 | Nháp AI | Nút Nháp AI ở Con Hùng | Nháp chèn vào ô soạn, không tự gửi | Tay | Lỗi (L6: code đã sửa, chờ điền mã workspace) |
| AI-02 | Tin rủi ro | Tin có chuyển tiền / OTP / mật khẩu | Gắn cờ rủi ro, không soạn nháp | TĐ | Đạt (TĐ) |
| AI-03 | Chống làm theo lệnh trong tin khách | Tin khách chứa lệnh cho AI | AI không làm theo | TĐ | Đạt (TĐ) |
| AI-04 | Playbook theo vai trò liên hệ | — | — | — | Chưa có (vai trò liên hệ không ghi được) |

### 3.12 Quản trị (QT)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| QT-01 | Việc cần làm | `/admin/todo` | Các mục đang chờ, tình trạng nick | Tay | Đạt |
| QT-02 | Nhật ký truy cập | Lọc theo người / hành động, xuất XLSX | Đúng, tối đa 92 ngày | Tay, TĐ | Đạt (TĐ) |
| QT-03 | Cảnh báo | Bật / tắt quy tắc, đổi ngưỡng | Lưu được, có nhật ký | Tay, TĐ | Đạt (TĐ) |
| QT-04 | Ghép thiết bị | Mã 6 số | Token thiết bị tạo đúng | Tay | Chưa |
| QT-05 | Thu hồi token | Token & thiết bị | Token bị chặn ngay (cache tối đa 60 giây) | Tay, TĐ | Đạt (TĐ) |
| QT-06 | Token MCP của tôi | `/settings/tokens` | Tạo nhóm Đọc / Đề xuất, hạn 30/60/90 ngày | Tay | Chưa |
| QT-07 | Gán kênh | Quản trị → Gán kênh | Gán gửi / xem / lead có thời hạn | Tay, TĐ | Đạt (TĐ) |
| QT-08 | Nhập cây tổ chức, người dùng | Nhập từ file | Như TC-02, TC-12 | Tay | Chưa |

### 3.13 Bảo mật và dữ liệu (BM)

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 06/10 |
|---|---|---|---|---|---|
| BM-01 | Phiên Zalo không ra khỏi máy Zalo | Test P5 và quét log, MongoDB | Không có cookie, imei, userAgent, khóa | TĐ, Tay | Đạt |
| BM-02 | Log không có nội dung tin | Quét log máy Zalo, API | Chỉ mã và số đếm | TĐ | Đạt (TĐ) |
| BM-03 | Ingest từ chối trường nhạy cảm | Gửi lô có `token`, `cookie` | Lô bị từ chối | TĐ | Đạt (TĐ) |
| BM-04 | Webhook OA / Fanpage sai chữ ký | Gửi webhook giả | 401, không nạp | TĐ | Đạt (TĐ) |
| BM-05 | Chỉ lưu mã băm của phiên và token | Xem `sessions`, `api_tokens` | Không có token thô | TĐ | Đạt (TĐ) |
| BM-06 | Xóa dữ liệu khách theo NĐ 13 | `POST /api/security/erase` | Xóa đúng, còn dòng nhật ký không có dữ liệu cá nhân | TĐ | Đạt (TĐ); chưa có màn |
| BM-07 | Quyền tệp phiên | `stat` trong máy Zalo | Thư mục 700, tệp 600 | Tay | Đạt |

### 3.14 Kết nối VCsales thật (VS), thêm 07/10/2026

Theo kế hoạch `docs/01-quan-ly-du-an/ke-hoach-ket-noi-vcsales.md` (đợt 1). VClinks trên máy 129 đọc VCsales dev (`192.168.50.10`) qua `vclinks-bridge`. Cột kết quả là ngày **07/10**.

| Mã | Tình huống | Cách làm | Mong đợi | Cách | 07/10 |
|---|---|---|---|---|---|
| VS-01 | Bridge chạy, khóa đúng / sai | Script `smoke.sh` từ máy 129 | `/health`, `/v1/ping` trả 200; thiếu hoặc sai khóa trả 401 | TĐ | Đạt |
| VS-02 | Tìm mã KH theo SĐT trên VCsales thật | "Liên kết mã KH…", nhập SĐT | Ra đúng khách; SĐT trong kết quả bị che | Tay, API | Đạt (qua API: 1 kết quả, SĐT che) |
| VS-03 | Tìm theo mã KH | Nhập mã | Ra đúng 1 khách | Tay, API | Đạt (qua API) |
| VS-04 | Khối Thương mại thật | Mở hồ sơ khách đã liên kết | Hạng, doanh số 12 tháng, nợ, báo giá đang mở, giờ lấy | Tay | Chặn: chờ khách test trên VCsales dev (Q2) |
| VS-05 | Danh sách báo giá thật | Tab Báo giá | Nhãn theo VCsales; "Đã chốt" gửi lại được; chưa đủ giá, chờ duyệt, đã hủy bị chặn kèm trạng thái gốc | Tay, TĐ | Đạt (TĐ); tay chặn: chờ khách test |
| VS-06 | Gửi PDF báo giá thật vào Con Hùng | Hộp Gửi báo giá | Chỉ có dạng PDF; Con Hùng nhận PDF đúng mẫu VCsales rồi lời nhắn | Tay | Chặn: chờ khách test |
| VS-07 | Báo giá vừa sửa trên VCsales | Sửa trên VCsales rồi gửi bản đang mở | Bị chặn "vừa được sửa" | Tay, TĐ | Đạt (TĐ) |
| VS-08 | Cờ Nợ quá hạn theo lô | Danh sách hội thoại | Mỗi lần gọi tối đa 100 mã (250 mã = 3 lần gọi); lưu đệm 15 phút | TĐ | Đạt (TĐ) |
| VS-09 | Màn Kết nối VCsales | Quản trị → Cài đặt → Kết nối VCsales | Tình trạng, giờ kiểm, phiên bản; nút "Kiểm tra ngay" | Tay, TĐ | Đạt (qua API trên 129: kết nối tốt, trả lời 19–28 ms; TĐ `vcsales-status.e2e-spec.ts`) |
| VS-10 | Tắt bridge | `pm2 stop vclinks-bridge-dev` khoảng 20 giây | VClinks báo mất kết nối ngay, không treo; bật lại tự về | Tay | Đạt (khoảng 11:10: báo mất sau 5 ms; tìm mã KH trả 503 sau 3 ms; cờ nợ 2 ms; bật lại về bình thường) |
| VS-11 | Ghép nhân viên VCsales theo email | Màn Kết nối VCsales | Số đã ghép / chưa ghép, lý do và cách sửa từng người | Tay, TĐ | Đạt (qua API: 40 người, 1 đã ghép, 11 chưa có tài khoản VClinks, 28 thiếu email) |
| VS-12 | Mã KH không còn trên VCsales | Khách liên kết mã đã bị xóa | Không hiện số cũ; báo "Mã KH … không còn trên VCsales" | TĐ | Đạt (TĐ) |
| VS-13 | Gỡ mã giả `KH-TEST-xxxx` | Sao lưu rồi gỡ | Không còn hồ sơ dính mã giả | Tay | Đạt (11:11: 1 hồ sơ là Con Hùng; sao lưu `20261007-1111-truoc-go-ma-KH-TEST.json`) |
| VS-14 | Nhật ký bridge không có dữ liệu | `pm2 logs vclinks-bridge-dev` | Chỉ mẫu đường, mã trạng thái, ms, tên khóa, số dòng | Tay | Đạt |
| VS-15 | Số tiền bằng chữ trên PDF | Báo giá 1.080.000 ₫ | "Một triệu không trăm tám mươi nghìn đồng" | TĐ | Đạt (TĐ, jest trên `.10`); VCsales gốc còn lỗi này |
| VS-16 | "Xem trước" danh mục VCsales (C11) | Danh mục VCsales → Xem trước | Chỉ đếm, không tạo hồ sơ | Tay, TĐ | Đạt (12:09 trên 129: đọc 4.567 khách, sẽ tạo 4.567 hồ sơ, 1 đặt được người phụ trách, 3.656 NV phụ trách chưa ghép; không ghi hồ sơ nào) |
| VS-17 | "Nạp toàn bộ" lần đầu | Danh mục VCsales → Nạp toàn bộ | Mỗi khách một hồ sơ, người phụ trách lần đầu theo email, chốt division và mốc đọc | Tay, TĐ | Đạt (TĐ); trên 129 chưa nạp, chờ dev002 quyết (Q7) |
| VS-18 | "Đồng bộ ngay" chỉ đọc khách đã đổi | Sửa / thêm / xóa khách trên VCsales rồi đồng bộ | Khách mới có hồ sơ; khách xóa được đánh dấu, không tạo hồ sơ | TĐ | Đạt (TĐ) |
| VS-19 | Một lần chạy một lúc | Hai người bấm cùng lúc | Người sau nhận "Đang có một lần nạp…" | TĐ | Đạt (TĐ) |
| VS-20 | Đưa vào hàng chờ tạo mã (UAT-DK-51) | NVKD bấm ở ngăn khách, điền phiếu | Phiếu vào tab "Chờ tạo mã KH"; NVKD khác không thấy; SĐT phải mức V2 trở lên | Tay, TĐ | Đạt (TĐ) |
| VS-21 | Nhận xử lý, kiểm trùng, trả sale (UAT-DK-52) | Sale admin xử lý phiếu | Giữ dòng 15 phút; kiểm trùng lưu kết quả; trả sale thì NVKD nhận thông báo, bổ sung xong dòng về "Đủ ✓" | Tay, TĐ | Đạt (TĐ) |
| VS-22 | Mã mới trên VCsales cho phiếu đang chờ | Tạo mã trên VCsales rồi đồng bộ | Không tạo hồ sơ thứ hai; dòng có "Gắn mã này"; bấm thì liên kết và việc xong | TĐ | Đạt (TĐ) |
| VS-23 | Đề xuất đổi SĐT (SA-04) | Khách có SĐT V2 mà VCsales chưa có | Ngăn khách có "Tạo đề xuất cập nhật"; đánh dấu xong mà VCsales chưa đổi thì việc mở lại; VCsales đổi rồi thì việc tự xong | Tay, TĐ | Đạt (TĐ) |
| VS-24 | Owner VClinks ≠ NV phụ trách VCsales (4a) | Lọc ở tab "Cần cập nhật VCsales" | Liệt kê khách lệch; tạo việc đổi NV phụ trách; VCsales đổi rồi thì việc tự xong | TĐ | Đạt (TĐ) |
| VS-25 | Báo trùng trên VCsales (UAT-PQ-116) | Sale admin tích 2 mã "Trùng", chọn mã chính | Mã chính được liên kết; việc "Gộp mã" chờ tới khi VCsales gộp; NVKD không làm được | Tay, TĐ | Đạt (TĐ) |

## 4. Lỗi tìm thấy

Cập nhật 06/10/2026 16:31: đã sửa 8 lỗi (L1–L5, L7, L9, L10); L6 đã sửa phần code, còn chờ điền mã workspace; L8 không phải lỗi. Test trên máy 129 đều đạt, đã triển khai API và web (không triển khai máy Zalo).

| Mã | Mức | Lỗi | Tái hiện | Đề xuất sửa |
|---|---|---|---|---|
| L1 | Thấp | Dòng gợi ý trên nút gửi ghi "tin sẽ được gửi qua tiện ích VClinks trên tab Zalo Web đang mở", sai với nick trực tiếp | Di chuột lên nút gửi ở Con Hùng | Đổi chữ theo chế độ nick: "gửi qua máy Zalo (kết nối trực tiếp)" . **Đã sửa: chữ theo chế độ nick ("qua máy Zalo của công ty (kết nối trực tiếp…)")** |
| L2 | Trung bình | Dòng gợi ý của nút gửi đè lên nút "Trả lời thay" trong hộp xác nhận. Bấm trúng chỗ bị đè thì hộp đóng mà không gửi | Màn hẹp: bấm Gửi rồi bấm ngay "Trả lời thay" | Ẩn dòng gợi ý khi hộp xác nhận mở, hoặc đặt hộp ở phía khác . **Đã sửa: dòng gợi ý ẩn khi hộp xác nhận mở** |
| L3 | Thấp | Hộp danh thiếp ghi "Tiện ích sẽ tìm tên này…" với nick trực tiếp. Lệnh danh thiếp (và các lệnh khác ngoài tin chữ) gửi ngay, không hỏi "Trả lời thay" như tin chữ | T05 | Chữ theo chế độ nick; dùng chung hộp xác nhận trả lời thay cho mọi lệnh . **Đã sửa: chữ hộp danh thiếp theo chế độ nick; mọi lệnh (sticker, danh thiếp, ảnh, file…) ghi rõ "Bạn đang trả lời thay …"** |
| L4 | Trung bình | Thả cảm xúc từ Dashboard đang tắt bằng cờ `REACTIONS_FROM_DASHBOARD = false` (`ChatPane.tsx:89`), dù máy Zalo trực tiếp đã làm được | T03 | Bật cờ cho nick trực tiếp (vẫn tắt với nick qua tiện ích) . **Đã sửa: bật thả cảm xúc cho nick trực tiếp (nick qua tiện ích vẫn tắt)** |
| L5 | Thấp | Trả lời trích dẫn tin tệp chỉ hiện "[Tệp]", không có tên tệp | T02 | Dùng tên tệp trong phần trích dẫn . **Đã sửa: trích dẫn tin tệp hiện "[Tệp] tên tệp"** |
| L6 | Cao | Nháp AI trên máy 129: Claude API trả 400 "This API key is not scoped to a workspace…" | T09; log API `api_400` | Dùng khóa API gắn workspace, hoặc thêm biến `ANTHROPIC_WORKSPACE_ID` gửi kèm header `anthropic-workspace-id` . **Đã sửa phần code: biến `ANTHROPIC_WORKSPACE_ID` (gửi header `anthropic-workspace-id`). **Còn chờ dev002 điền mã workspace vào `.env` máy 129**** |
| L7 | Trung bình | Không thử được báo giá: danh mục VCsale mô phỏng chưa nạp lại sau khi xóa dữ liệu 06/10, và chưa có cách gắn tay mã KH | T08, T11 | Quyết định nạp lại danh mục mô phỏng (rủi ro tự gộp với hồ sơ thật), hoặc thêm nút "Liên kết mã KH" tìm tay . **Đã sửa: nút "Liên kết mã KH…" trong ngăn khách, tìm khách VCsale theo mã / tên / SĐT / MST rồi liên kết (không nạp danh mục mô phỏng)** |
| L8 | Trung bình | Màn hẹp (khung khoảng 900 px): bấm nút thông tin khách, nút sáng nhưng ngăn không hiện | HT-08 | Ở màn hẹp mở ngăn dạng Drawer phủ lên khung chat . **Không phải lỗi: kiểm lại thì ngăn mở dạng khung trượt (Drawer) bình thường; lần trước ảnh chụp của khung trình duyệt bị trễ** |
| L9 | Cao | Nút Thoát chỉ xóa token trên trình duyệt, không gọi `POST /api/auth/logout`, nên phiên trên máy chủ còn sống tới 12 giờ | Đọc code `MePage.tsx:17`, `api.ts:24`, `AppLayout.tsx` | Gọi logout trước khi xóa token . **Đã sửa: Thoát gọi `POST /api/auth/logout`; thêm "Phiên đăng nhập" ở Hồ sơ của tôi (xem, đăng xuất từng nơi / các nơi khác)** |
| L10 | Thấp | Gợi ý trong form mẫu câu ghi `{ten_nv}` = "tên tài khoản gửi", nhưng thực tế ra tên người dùng VClinks ("Dao Xuan Son") | T06 | Sửa chữ gợi ý cho khớp . **Đã sửa chữ gợi ý** |

## 5. Việc cần làm tiếp

**dev002 làm trên điện thoại (Zalo Con Hùng), báo lại để Claude ghi kết quả:**
1. NT-06 gửi một ghi âm; NT-09 gõ mà chưa gửi khoảng 5 giây.
2. NT-07 thu hồi một tin; NT-08 thả cảm xúc lên tin "[Test VClinks 06/10] T01…".
3. KN-04 (sau 08/10 10:16): mở chat.zalo.me của nick thử để xem báo "đang mở Zalo Web ở nơi khác".

**dev002 làm trên trình duyệt có tệp:** GT-07 gửi ảnh, GT-08 gửi file vào Con Hùng.

**dev002 làm trên VCsales dev (`http://192.168.50.10:6969`):** tạo khách test có SĐT của Con Hùng và một báo giá "Đủ giá", báo mã khách để chạy VS-04, VS-06 (kịch bản ở `docs/04-ky-thuat/api/gui-bao-gia.md` mục 8).

**Cần quyết định:**
- Sửa khóa Claude API (L6)?
- Sửa các lỗi L1–L5, L8–L10?

**Ca chưa chạy còn lại:** chạy cùng kịch bản UAT nhiều người (`docs/05-kiem-thu/uat/2026-10-05/kich-ban-nhieu-nguoi.md`) khi có đủ tài khoản vai trò.

## 6. Test tự động hiện có

Chạy trên máy 129 ngày 06/10/2026, không chạy trên máy cá nhân:

| Bộ | Số ca | Kết quả |
|---|---|---|
| API e2e (`apps/api/test/e2e`, 39 file: auth, inbox, quotes, workitems, reports, search, realtime, org, authz-td, grants-td, handover-td, customers-td, custom-roles, vcsales-status, erp-tasks, audit-alerts, ai-draft, tokens-channel, direct-ingest, zalo-farm, attachments…) | 469 | Đạt (07/10) |
| API unit (`apps/api/src/**/*.spec.ts`, kể cả ma trận quyền, đường gửi không duyệt) | 1.770 | Đạt (07/10) |
| Web (`apps/web`, vitest) | 139 | Đạt (07/10) |
| `packages/shared`, `packages/vcsale-client` | 207, 20 | Đạt (07/10) |
| Máy Zalo (`tools/chrome-driver/test`) | 47 | Đạt (06/10) |
| `vclinks-bridge` (repo VCsales, jest trên máy `.10`) | 43 | Đạt (07/10) |

Cách chạy: `git archive` bản đang làm vào `~/vclinks/ci-src` trên máy 129, rồi chạy trong container `node:20-bookworm` với MongoDB tạm ở cổng 27199. Chi tiết trong memory dự án và `tools/deploy/server-129/`.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.1 | 07/10/2026 16:33 | Claude Code (dev002) | Tạo bộ test 128 ca theo 13 mảng, kết quả chạy thật trên Con Hùng (T01–T11), 10 lỗi, việc cần làm tiếp; cùng phiên: mục 4 ghi kết quả sửa lỗi (8 đã sửa, L6 chờ mã workspace, L8 không phải lỗi); 7 ca vai trò tùy chỉnh (PQ-13…19); mảng VS 15 ca kết nối VCsales thật chạy 07/10 (8 đạt thật, 5 đạt tự động, 2 chờ khách test); đếm lại 150 ca; thêm 10 ca VS-16…25 (danh mục và Việc VCsales), đếm lại 160 ca; thêm KN-06a (người giữ nick tự ngắt nick của mình), đếm lại 161 ca | Yêu cầu dev002 06/10/2026: "lên bộ test đầy đủ"; chỉ nhắn nick Con Hùng; "làm theo đề xuất" |
