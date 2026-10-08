# Góp ý thiết kế D1 — P-GS (Hương)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Hương (P-GS, giám sát bán hàng, trưởng tổ 7 NVKD) góp ý lượt 1 lô thiết kế TK1 (D1) ngày 29/09/2026; xem màn 1, 1a, 3, 8, 9 (liếc 5 và 7).
- 17 góp ý: **5 Chặn** · 8 Nên sửa · 4 Gợi ý.
- Nhận định chung: gần như mọi màn vẽ theo mắt NVKD; giám sát không biết trong 1 phút tổ đang có vấn đề gì.
- Chặn: Hộp thư thiếu góc nhìn giám sát; trả lời thay không có dấu hiệu; nghỉ phép làm bằng "bàn giao có thời hạn" thay vì Trực thay; luồng nghỉ việc chưa vẽ; quy tắc "owner offline 15 phút thì chia người khác".
- Làm thử 5 việc: nhắc 9 hội thoại quá SLA mất khoảng 45 cú; chia 5 khách chưa phân công khoảng 25 cú.
- Ghi 10 chỗ lệch BA/đặc tả, gồm quyền `config.sla` (GS chỉ xem), GS-01, GS-03, trạng thái nick SZ-12.
- Kết quả xử lý xem `vong-2/P-GS.md`.

## Mục lục

- [Làm thử 5 việc](#làm-thử-5-việc)
- [Góp ý theo màn](#góp-ý-theo-màn)
- [Chỗ thiết kế lệch BA / đặc tả](#chỗ-thiết-kế-lệch-ba--đặc-tả)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

Người góp ý: Hương, giám sát bán hàng, trưởng tổ 7 NVKD (vai P-GS). Bản vẽ: canvas "VClinks UI Design", lô D1, 29/09/2026. Tôi xem các màn 1, 1a, 3, 8, 9 (có liếc qua 5 và 7).

Bản vẽ đẹp và quen tay như Zalo, nhưng gần như **mọi màn đều vẽ theo mắt NVKD** (avatar là Tú, "Của tôi (9)", "Việc hôm nay" của Tú). Sáng mở máy, tôi **không biết trong 1 phút** tổ đang có vấn đề gì: số quá SLA của từng bạn nằm sâu trong Quản trị, nick mất kết nối nằm ở Kênh kết nối, khách chưa phân công chỉ là một con số (3) trên nút. Những việc tôi làm hằng ngày (chia khách, nhắc bạn trả lời, trả lời thay) đều phải mở từng hội thoại, không có thao tác gọn. Hai thứ làm tôi lo nhất: **quy tắc "người phụ trách offline 15 phút thì chia cho người khác"** (sẽ gây tranh khách trong tổ) và **bàn giao khi nghỉ phép** đang làm bằng cách đổi người phụ trách có thời hạn, trong khi tôi chỉ cần một người trực thay.

## Làm thử 5 việc

| Việc | Các bước (màn) | Số cú bấm | Vướng ở đâu |
|---|---|---|---|
| (a) Tìm hội thoại quá SLA của tổ và nhắc NVKD | Hộp thư (1) → bấm "Tất cả" → đọc lướt danh sách (không có lọc "Quá SLA", không nhóm theo NVKD) → mở hội thoại → tab "Ghi chú nội bộ" → gõ "@Tú …" → Gửi. Muốn xem tổng theo người thì phải sang Quản trị (9) → chọn tổ trong cây → đọc cột "Quá SLA" (số không bấm được) | **5–6 cú / 1 hội thoại**, cộng 2–3 cú nếu đi qua Quản trị; 9 hội thoại quá SLA ≈ 45 cú | Không có danh sách "Quá SLA theo NVKD" (GS-01). Số ở Quản trị và Báo cáo không dẫn tới hội thoại. Không có nút "Nhắc" trên dòng, phải gõ ghi chú tay. Không thấy thông báo "quá SLA → báo giám sát" đến tôi ở đâu |
| (b) Chia 5 khách mới ở "Chưa phân công" | Hộp thư → "Chưa phân công (3)" → mở từng hội thoại → "Chuyển" → (hộp chọn người **chưa vẽ**) chọn NVKD → nhập lý do → xác nhận | **~5 cú × 5 khách = 25 cú** (ước, vì hộp "Chuyển" chưa có trên bản vẽ) | Không chọn nhiều dòng để chia một lượt. Không thấy khi chọn người: ai đang online, đang xử lý bao nhiêu, khu vực nào (F4.4). Danh sách mẫu chỉ vẽ chế độ "Của tôi", không biết dòng "Chưa phân công" trông thế nào (nguồn khách, khu vực, đã chờ bao lâu) |
| (c) Trả lời thay khách của NVKD đang nghỉ ốm (Huy) | Hộp thư → "Tất cả" → "Lọc" → chọn người phụ trách Huy (bộ lọc chưa vẽ) → mở hội thoại → gõ → Gửi | **~5 cú** + gõ | Ô soạn **không cho biết tôi đang trả lời thay** Huy, không có hộp xác nhận PQ-16, không có nhãn "Gửi bởi Hương (trả lời thay)" (bản vẽ để "chờ BA" dù BA đã chốt). Không thấy nick của Huy xanh/đỏ ngay trên tiêu đề. Quản trị thì gợi ý làm "Bàn giao 29/09 → 15/10" thay vì trực thay |
| (d) Bàn giao toàn bộ khách của NVKD nghỉ việc | Quản trị → chọn tổ trong cây → "Nhân viên nghỉ việc…" (**luồng không vẽ**). Dùng tạm khung "Bàn giao khách": Từ nhân viên (2) → Sang nhân viên (2) → Phạm vi "Toàn bộ 162 khách" (2) → nhập hiệu lực, lý do → "Bàn giao" | **~9–10 cú** | Không có bước khóa tài khoản, **không bàn giao nick**, không chia cho nhiều người (162 khách dồn hết cho Tú đang xử lý 14 hội thoại), không xem trước "bao nhiêu hội thoại mở, nhắc việc, báo giá treo đi theo", không có hộp xác nhận. Dòng chú thích "hết hiệu lực khách về lại người cũ" nếu áp cho nghỉ việc là sai |
| (e) Sửa quy tắc chia khách theo khu vực | Quản trị → khối "Chia hội thoại · VCparts" → chọn radio → "Lưu quy tắc" | **3 cú** | Nhanh nhưng **quá dễ**: đổi cho cả division chỉ bằng 1 radio, không hỏi lại, không xem trước. Không có chỗ khai tỉnh nào thuộc tổ nào / người nào ("khu vực HN/HCM" là quá thô với tổ 7 người cùng ở Hà Nội). Theo 01-phan-quyen tôi (GS) **không có quyền** `config.sla`, nhưng màn không cho biết tôi chỉ được xem hay được sửa |

## Góp ý theo màn

| # | Màn | Góp ý | Vì sao | Đề xuất sửa (cụ thể) | Mức |
|---|---|---|---|---|---|
| 1 | 1 Hộp thư | Không có góc nhìn giám sát: sáng mở máy không biết ai đang để khách chờ | GS-01 là MVP; persona hỏi "mất bao nhiêu cú bấm để biết tổ có vấn đề gì" | Khi người dùng là GS, mặc định chế độ "Tổ của tôi" và thêm **dải tóm tắt tổ** trên đầu danh sách: `Quá SLA 4 · Sắp quá 2 · Chưa phân công 3 · Nick đỏ 1`. Mỗi ô bấm được thành bộ lọc. Thêm lọc nhanh "Quá SLA" và tùy chọn **nhóm theo NVKD** (Tú 1 · Linh 2 · Huy 1). Tối đa 4–5 con số, không thêm biểu đồ | **Chặn** |
| 2 | 1 Hộp thư / 1b Ô soạn | Trả lời thay không có dấu hiệu gì khác tin thường | F12.6, GS-04, PQ-16 đã chốt; tôi sợ khách/NVKD tưởng Tú tự trả lời, rồi hai người trả lời chồng | Khi tôi không phải người phụ trách: dải vàng trên ô soạn `Bạn đang trả lời thay Phạm Quang Huy · gửi từ nick Huy`; nếu Huy đang online thì hộp xác nhận đúng câu PQ-16 `[Hủy] [Trả lời thay]`; tin đã gửi ghi `Gửi bởi Hương (trả lời thay)` dưới bong bóng; tự thêm ghi chú nội bộ `Hương đã trả lời thay lúc HH:mm` | **Chặn** |
| 3 | 9 Quản trị (Bàn giao) | Nghỉ phép/ốm đang làm bằng "bàn giao có hiệu lực 29/09 → 15/10" (đổi owner rồi trả lại) | 01-phan-quyen đã có **Trực thay** (`truc_thay`, tối đa 30 ngày) cho đúng việc này. Đổi owner tạm làm rối lịch sử khách, KPI của Huy, và dễ thành tranh khách khi Huy quay lại | Tách hai nút ở dòng NVKD: **"Đặt người trực thay…"** (chọn người, từ ngày → đến ngày, không đổi owner; hội thoại hiện nhãn `Huy nghỉ · Tú trực thay`) và **"Bàn giao khách…"** (đổi owner hẳn, có lý do). Bỏ câu "hết hiệu lực khách về người cũ" khỏi bàn giao | **Chặn** |
| 4 | 9 Quản trị (Nghỉ việc) | Nút "Nhân viên nghỉ việc…" có nhưng luồng không vẽ; khung bàn giao thiếu nick, chia nhiều người, xem trước, xác nhận | GS-05 MVP, M2 "100% khách được bàn giao", PQ-33/34. Đây là thao tác không quay lại được, 162 khách một lần | Vẽ luồng theo MH-PQ-04: ① Khóa (GĐ/Admin làm; nếu tôi là GS thì hiện "Đã khóa bởi … lúc …" hoặc nút "Đề nghị khóa") → ② Bàn giao khách: "Tất cả cho một người / Chia đều / Chọn từng khách", hiện tải hiện tại của người nhận → ③ **Bàn giao nick** (người giữ nick mới) → ④ Xác nhận: `162 khách · 23 hội thoại đang mở · 9 nhắc việc · 5 báo giá treo sẽ chuyển` + đếm ngược 24 giờ (PQ-34). Nút cuối ghi rõ số: `Bàn giao 162 khách và 1 nick` | **Chặn** |
| 5 | 9 Quản trị (Chia hội thoại) | Dòng "Người phụ trách offline quá 15 phút → chia theo quy tắc chung" | Khách đã có owner mà bị chia cho người khác chỉ vì owner đi ăn trưa là **nguồn tranh khách số một** trong tổ. Trái F12.3/BR02 và DK-21 (nick cá nhân chỉ người giữ nick xử lý) | Đổi thành: owner offline quá N phút → **chỉ báo giám sát** (và/hoặc người trực thay nếu đã đặt); hội thoại vẫn của owner. Nếu vẫn muốn chuyển, ghi rõ "chuyển người xử lý tạm, **không đổi owner**, chỉ áp dụng kênh OA/Fanpage" | **Chặn** |
| 6 | 1 Hộp thư (Chưa phân công) | Chia khách từng cái một, hộp "Chuyển" chưa vẽ | GS-02: chia 5 khách mất ~25 cú; không thấy tải/online nên chia không công bằng (nỗi sợ của tôi) | Ở chế độ "Chưa phân công": ô chọn nhiều dòng + nút **"Giao cho…"**. Hộp chọn NVKD hiện: chấm online/nghỉ, đang xử lý, số khách mới hôm nay, khu vực; lý do chọn nhanh ("đúng tuyến", "chia đều"…). Dòng chưa phân công hiện nguồn (quảng cáo/OA…), khu vực, đã chờ bao lâu. (Chỉ là giao việc trong VClinks, không phải gửi hàng loạt qua nick) | **Nên sửa** |
| 7 | 8 Kênh kết nối | Không trả lời được "nick nào của tổ tôi đang mất kết nối, từ lúc nào, ai giữ" | GS cần biết để nhắc bạn hoặc báo Admin trước khi khách phàn nàn; SZ-12 đã định nghĩa xanh/vàng/đỏ | Thêm cột **Người giữ nick**, lọc "Tổ của tôi", trạng thái theo SZ-12 (Xanh/Vàng/Đỏ) kèm `mất kết nối từ 07:52` và lý do ngắn. Nick đỏ của tổ phải hiện thêm ở dải tóm tắt tổ (#1) và có nút "Báo Admin". Tách câu kỹ thuật ("Extension", "Lệch 37 tin") sang tooltip "Chi tiết cho Admin" | **Nên sửa** |
| 8 | 1 Hộp thư (chip SLA) | Chip thiếu trạng thái ngoài giờ; dòng ở chế độ "Tất cả" không ghi ai phụ trách | GS-01 "chỉ tính giờ làm việc": tin 18:30 mà hiện "Quá SLA 13 giờ" là báo động giả. Nhìn "Nick Tú"/"OA VCparts" tôi không biết ai phải trả lời dòng OA | Thêm chip xám `Ngoài giờ · tính từ 8:00`. Ở chế độ Tổ/Tất cả, thêm avatar nhỏ + tên người phụ trách trên mỗi dòng. Ghi rõ nhóm Zalo có tính SLA không (tin @Tú trong nhóm thì tính, tin chat chung thì không?) | **Nên sửa** |
| 9 | 1 Hộp thư / thông báo | "Quá SLA → báo giám sát" đã có ô tích nhưng không thấy tôi nhận ở đâu | Nếu 20 thông báo/ngày đổ về tôi thì tôi sẽ tắt đi (sợ "duyệt quá nhiều") | Vẽ chuông thông báo của GS: **gộp theo đợt** ("3 hội thoại của tổ vừa quá SLA"), bấm mở đúng bộ lọc Quá SLA. Cho chọn tần suất: ngay / gộp 15 phút | **Nên sửa** |
| 10 | 9 Quản trị (quy tắc chia, SLA) | Không phân biệt ai được sửa; đổi quy tắc cả division bằng 1 radio + Lưu, không xác nhận | 01-phan-quyen: `config.sla` chỉ GĐ; GS không sửa. Đổi sai quy tắc là cả division chia lệch ngay | Với GS: khối chỉ đọc + nút "Đề xuất thay đổi cho GĐ". Với GĐ: bảng **khu vực → tổ** (tỉnh/quận nào về tổ nào), xem trước "tuần trước quy tắc mới sẽ chia: HN1 42 · HN2 38", hộp xác nhận ghi hiệu lực từ lúc nào, lưu phiên bản cũ để quay lại | **Nên sửa** |
| 11 | 9 Quản trị (Yêu cầu chuyển khách) | Chỉ một dòng + link "Duyệt", không có lý do đầy đủ, lịch sử, nút Từ chối | GS-03 MVP; đây là chỗ tranh khách, tôi cần đủ thông tin mới dám quyết | Mở ngăn bên: lý do của Linh, owner hiện tại (Huy/Tú), lần nhắn cuối của mỗi bên, báo giá/đơn gần nhất, tuyến/khu vực của khách; nút **Duyệt** / **Từ chối (bắt buộc lý do)**; hai bên nhận thông báo. Đưa số yêu cầu chờ duyệt lên dải tóm tắt tổ | **Nên sửa** |
| 12 | 9 Quản trị (bảng tổ) | Số "Đang xử lý", "Quá SLA", "Khách" không bấm được; dòng Huy "Nghỉ phép" không nói ai trực thay | Tôi thấy vấn đề nhưng phải đi đường khác mới xử lý được | Mỗi số là link mở Hộp thư đã lọc theo NVKD đó. Dòng nghỉ phép ghi `Nghỉ phép đến 15/10 · Tú trực thay`. Thêm cột "Chưa trả lời" và "Khách bị bỏ rơi 30 ngày" (GĐ2 để mờ) | **Nên sửa** |
| 13 | 3 Customer 360 | Nút "Bàn giao" ngay đầu trang, không thấy xác nhận/lý do; không thấy khách đang có người trực thay hay yêu cầu chuyển đang chờ | Bấm nhầm là đổi owner khách lớn (684 tr ₫/năm); tranh chấp cần nhìn thấy ngay trên hồ sơ | "Bàn giao" mở hộp: người nhận (trong tổ, hiện tải), lý do bắt buộc, "hội thoại mở đi theo". Đầu trang thêm nhãn `Yêu cầu chuyển đang chờ: Đỗ Mai Linh` / `Tú trực thay đến 15/10` và chấm online của người phụ trách. Dòng thời gian "Đổi phụ trách" đang có là tốt, giữ | **Nên sửa** |
| 14 | 1a Khung chat | Nhắc NVKD phải gõ ghi chú @ tay | Mỗi sáng tôi nhắc 5–10 lần; gõ tay mất thời gian | Trên dòng quá SLA (Hộp thư) và tiêu đề khung chat thêm nút **"Nhắc {tên}"**: 1 cú tạo ghi chú nội bộ mẫu `@Tú khách chờ 22′, em xử lý giúp chị` và gửi thông báo cho Tú. Ghi chú nội bộ màu vàng hiện tại là rõ, giữ | **Gợi ý** |
| 15 | 1 Hộp thư | "Chưa phân công" với nick Zalo cá nhân nghĩa là gì? | DK-21: khách nhắn nick nào thì người giữ nick xử lý, nên hàng chờ chỉ có ý nghĩa ở OA/Fanpage/lead quảng cáo | Ghi chú dưới tab: `Chưa phân công: khách mới từ OA, Fanpage, quảng cáo. Tin vào nick cá nhân luôn về người giữ nick` | **Gợi ý** |
| 16 | 9 Quản trị (tab Mẫu câu) | Tab có nhưng chưa vẽ chỗ tôi duyệt mẫu câu của tổ | GS-09 MVP | Vẽ danh sách "Chờ duyệt (n)" với nội dung, người tạo, nút Duyệt/Trả lại có lý do; hiện số chờ duyệt trên dải tóm tắt tổ | **Gợi ý** |
| 17 | 7 Báo cáo | Vẽ theo vai GĐ; ô "Chưa trả lời > 15′: 9" không bấm được | GS-06: tôi xem theo tổ, theo ngày để kèm cặp người | Khi GS mở: mặc định lọc tổ mình, khoảng "Hôm qua". Ô "Chưa trả lời" và dòng NVKD bấm mở Hộp thư đã lọc. Giữ nút Xuất Excel | **Gợi ý** |

**Tổng:** 17 góp ý — 5 Chặn, 8 Nên sửa, 4 Gợi ý.

## Chỗ thiết kế lệch BA / đặc tả

1. **Trực thay bị thay bằng "bàn giao có thời hạn"** (màn 9). 01-phan-quyen §quyền tạm thời có `truc_thay` (GS tạo, tối đa 30 ngày, không đổi owner); bản vẽ tự đề xuất "hết hiệu lực khách về người cũ" và ghi "BA chưa nói". Nên dùng Trực thay.
2. **Nhãn người gửi khi trả lời thay để "đề xuất – chờ BA"** (màn 1a). BA F12.6, GS-04 và PQ-16 đã chốt: ghi "Gửi bởi <tên> (trả lời thay)", tự thêm ghi chú nội bộ, báo owner, xác nhận nếu owner đang online.
3. **"Owner offline 15 phút → chia theo quy tắc chung"** (màn 9) lệch F12.3/BR02 (khách có owner về thẳng owner) và DK-21/D2 (chỉ người giữ nick, người trực thay, cấp trên trả lời thay được gửi qua nick). F4.4 chỉ nói "không chia **khách mới** cho người offline".
4. **Nghỉ việc thiếu các bước của MH-PQ-04 / PQ-33 / PQ-34**: khóa trước, bàn giao nick, chia nhiều người, xem trước, 24 giờ tự về "Chưa phân công". GS-05 yêu cầu "người cũ mất quyền xem ngay".
5. **Quyền cấu hình chia khách/SLA**: 01-phan-quyen `config.sla` = GĐ (DV), GS ✖. Màn 9 không thể hiện GS chỉ xem. Ngược lại `cust.handover` của GS chỉ trong tổ (ghi chú 17): hộp "Sang nhân viên" phải giới hạn người trong tổ, bàn giao sang tổ khác cần GĐ.
6. **GS-01 "danh sách Quá SLA theo NVKD, thông báo cho tôi"**: bản vẽ chỉ có chip trên từng dòng và cột số trong Quản trị; chưa có danh sách theo NVKD và chưa có thông báo cho GS.
7. **GS-03 "thấy lý do và lịch sử khách; duyệt / từ chối"**: bản vẽ chỉ có link "Duyệt".
8. **Phạm vi hộp thư** (03 MH-SZ-01 #4, 01 phạm vi `TỔ`): GS phải có "Của tôi / Chưa phân công / Tất cả (trong tổ)". Bản vẽ chỉ vẽ góc nhìn NVKD (Tú) nên không kiểm được chế độ của GS; F2.2 lọc "người phụ trách" nằm trong nút "Lọc" chưa vẽ.
9. **Trạng thái nick SZ-12** (03): màn 8 dùng "Đang chạy / Lệch 37 tin / Chưa đăng nhập" thay vì Xanh/Vàng/Đỏ có lý do và mốc thời gian; thiếu cột người giữ nick (PQ-17).
10. **F12.8 / GS-07 khách bị bỏ rơi**: có ô chọn 30/60/90 ngày (GĐ2) nhưng chưa có chỗ GS xem danh sách theo NVKD và thao tác nhắc/thu hồi (tab "Khách bị bỏ rơi" ở màn 5 chưa vẽ nội dung). Chấp nhận vì GĐ2, chỉ ghi lại.

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/tk1/vong-1/P-GS.md) | — |
