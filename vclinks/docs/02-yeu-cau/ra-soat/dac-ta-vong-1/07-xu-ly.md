# Xử lý góp ý vòng 1 — 07 Báo cáo chung và quy tắc chia khách

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA xử lý góp ý vòng 1 cho đặc tả 07 Báo cáo và chia khách ngày 29/09/2026, đưa đặc tả lên v1.1. Nguồn: P-GD (14 góp ý, 3 Chặn), P-GS (15, 3 Chặn), P-BGD (12, 3 Chặn).
- Tổng 41 góp ý: Đã sửa 37 (1 một phần), Hỏi chủ dự án 3 (Q-BC-06, Q-BC-13, Q-BC-18), Chuyển file khác 1 (01 MH-PQ-04); 3 phần nhỏ không làm, có lý do.
- 9 góp ý Chặn đều có lời giải trong v1.1; P-GD #3 mới làm mức tối thiểu (RT-19), việc gộp hai bộ quy tắc chờ Q-BC-10.
- Sửa chính: số chụp quý / năm riêng, khối "Đối chiếu VCsales" (BC-23), tính lượt theo giờ gửi thật (BC-24), nghỉ đột xuất hồi tố (BC-25), giải trình và đề nghị tính lại (BC-26), hàng mục tiêu G1–G6 (BC-28), độ phủ kênh KPI-29, quay về bản trước (RT-20), đề xuất liên tổ (RT-22).
- Câu hỏi cho chủ dự án: cập nhật Q-BC-06 (A+), Q-BC-10 (đề xuất B), Q-BC-13 (B-thứ Hai); mới Q-BC-17, Q-BC-18, Q-BC-19; thông số TS-BC-01…07.
- Kèm 13 việc cho designer (D1–D13), việc chuyển sang 00–06, dữ liệu kiểm thử, VCsoft, sổ quyết định, và bảng hợp nhất UAT đề xuất.
- Còn mở: chỉ tiêu G1–G6 và tên báo cáo VCsales chuẩn (Q-BC-17, Q-BC-19); ca UAT-RT-GD-09 (ủy quyền) chưa viết, chờ 01 thêm quyền tạm thời.

## Mục lục

- [Bảng xử lý](#bảng-xử-lý)
- [Câu hỏi cho chủ dự án](#câu-hỏi-cho-chủ-dự-án)
- [Việc cho designer](#việc-cho-designer)
- [Việc chuyển file khác](#việc-chuyển-file-khác)
- [UAT đề xuất đã hợp nhất](#uat-đề-xuất-đã-hợp-nhất)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Đặc tả: `docs/02-yeu-cau/dac-ta/07-bao-cao-va-chia-khach.md` (nay là **v1.1**) · Góp ý: `07-P-GD.md` (Thắng, giám đốc bán hàng — 14 góp ý, 3 Chặn), `07-P-GS.md` (Hương, giám sát Tổ HN1 — 15 góp ý, 3 Chặn), `07-P-BGD.md` (ban giám đốc / kiểm soát — 12 góp ý, 3 Chặn) · BA xử lý ngày 29/09/2026 theo bước 3 của `docs/02-yeu-cau/README.md`.
>
> **Nguyên tắc lọc đã áp:** (1) Giữ nguyên tắc bắt buộc: không nội dung tin, không SĐT trên báo cáo (BC-18); không xếp hạng công khai (BC-12); định tuyến theo 02 (người "Đi thị trường" không nhận khách mới, DK-47, DK-62); quyền theo 01 (PQ-27 người gửi không tự duyệt, PQ-48 xuất). (2) Góp ý đổi nghiệp vụ, phạm vi, giai đoạn → **Hỏi chủ dự án** (Q-BC-06, 10, 13 cập nhật phương án; Q-BC-17, 18, 19 mới). BA không tự chốt. (3) Con số mới ghi thành thông số `TS-BC-01…07` (07 §11), chạy theo mặc định tới khi chốt. (4) Quyền, thông báo, dòng sự kiện, mốc kỳ chung thuộc 01 / 00: 07 đặc tả hành vi, việc đặt vào file chủ quản ở "Việc chuyển file khác".
>
> **Tổng:** 41 góp ý · **Đã sửa 37** (trong đó 1 một phần) · **Hỏi chủ dự án 3** (Q-BC-06, Q-BC-13, Q-BC-18) · **Chuyển file khác 1** (01 MH-PQ-04) · Chuyển designer 0 làm chính (13 việc designer đi kèm các dòng Đã sửa) · Không làm 0 làm chính (3 phần nhỏ không làm, có lý do: P-GS #1 b, P-GS #13 phần chia cho người Đi thị trường, P-BGD #2 d).
>
> **Mức Chặn (9):** P-GD #1, #2, #3 · P-GS #1, #2, #3 · P-BGD #1, #2, #3 — đều có lời giải trong v1.1. Riêng P-GD #3: đã làm mức tối thiểu (RT-19), việc gộp hai bộ quy tắc chờ **Q-BC-10** (BA đề xuất B). P-GD #2 và P-BGD #1 phần tên báo cáo VCsales, chỉ tiêu G1–G6 chờ Q-BC-17, Q-BC-19 nhưng màn hình đã dùng được (ghi "chờ xác nhận" / "Chưa đặt chỉ tiêu").

## Bảng xử lý

| Nguồn | Mức | Tóm tắt góp ý | Kết quả | Chỗ sửa hoặc lý do |
|---|---|---|---|---|
| P-GD #1 | Chặn | Số chụp quý = bản tháng cuối quý, sai với số dòng chảy; `periodType` không có `quarter` | **Đã sửa** | BC-15 (a): số chụp **quý và năm riêng**, số dòng chảy tính lại trên mọi lượt của kỳ, số tồn lấy cuối kỳ; §3.5b bảng "Dòng chảy / Tồn"; MH-BC-09 #1 loại "Quý", "Năm"; §9 `periodType = week\|month\|quarter\|year`. Dữ liệu TD-BC-T; UAT-BC-37; story BC-US-14 |
| P-GD #2 | Chặn | Không có khối đối chiếu VCsales; KPI-13 đếm theo ngày gửi, VCsales theo ngày tạo; UAT-BC-23 chỉ so VClinks với VClinks | **Đã sửa** (tên báo cáo VCsales: Q-BC-17) | BC-23 khối "Đối chiếu VCsales" (báo giá tạo trên VCsales · đã gửi qua VClinks · % phủ · báo giá gửi trong kỳ và "tạo trước kỳ" · doanh số GĐ2), tên báo cáo + trường ngày; KPI-26; tooltip KPI-13; MH-BC-04 #1b, MH-BC-05 #2a, sheet "Tóm tắt". **UAT-BC-23 sửa** (so với báo cáo VCsales mock), thêm UAT-BC-38; dữ liệu TD-BC-C; story BC-US-15 |
| P-GD #3 | Chặn | Mở khu vực mới phải sửa hai bộ quy tắc (lead ở 05, khách ở 07), không màn nào nhắc | **Đã sửa** mức tối thiểu + **Hỏi chủ dự án** (Q-BC-10) | RT-19: (a) "Thử một khách" chạy cả động cơ giao lead, nói rõ nhánh và người nhận; (b) Modal "Áp dụng…" cảnh báo khu vực có ở bộ này mà chưa có ở bộ kia + nhắc việc cho GĐ; (c) lịch sử chung. MH-RT-01, MH-RT-03 #3, MH-RT-05 #6; RT-13. Q-BC-10: phương án B ghi là **đề xuất BA** kèm lý do, GĐ nghiêng B, không tự chốt. UAT-RT-22; story BC-US-16 |
| P-GD #4 | Nên sửa | Tỷ lệ chốt so hai lứa khác tuổi; dải vàng hiện mãi | **Đã sửa** | KPI-14 thành "Chốt trong 30 ngày" (dòng phụ 14 ngày), Δ chỉ so lứa cùng tuổi, số chụp ghi lứa đủ tuổi gần nhất, KPI-14 không đếm vào dải vàng. UAT-BC-15 sửa; UAT-BC-39; dữ liệu TD-BC-R |
| P-GD #5 | Nên sửa | Báo giá gán owner VClinks, doanh số theo NV phụ trách VCsales → lệch tổ | **Đã sửa** | BC-05: doanh số theo tổ = NV phụ trách VCsales map theo cây lúc ghi đơn; dòng cảnh báo "{n} account có người phụ trách VClinks khác NV phụ trách VCsales" → 02 MH-DK-12; MH-BC-04 #1b + hành động "Xem danh sách" |
| P-GD #6 | Nên sửa | Bảng so sánh tổ thiếu cột để so công bằng | **Đã sửa** | MH-BC-04 #3: Lượt / NVKD / ngày làm việc, % quá SLA tách theo loại lượt (nick, kênh chung, hỏi giá owner KPI-12), Chưa trả lời > 24h, Δ cho FRT và tỷ lệ chốt, "(n = …)". Việc designer D3 |
| P-GD #7 | Nên sửa | Họp thứ Hai cần một cái nhìn cố định và xu hướng | **Đã sửa** | MH-BC-01 #6 mốc "Họp tuần" (Tuần trước · Số chụp, link chia sẻ), mặc định thứ Hai cho GD, XEM; MH-BC-04 #3 cột "Xu hướng 8 tuần". UAT-BC-43 |
| P-GD #8 | Nên sửa | Không có đường lùi khẩn cấp, không theo dõi sau áp dụng | **Đã sửa** | RT-20 "Quay về v{n−1} ngay" trong 24 giờ (TS-BC-04) không cần chạy thử, có lý do, nhật ký `config.routing.rollback`; RT-21 cảnh báo sau áp dụng 2 ngày làm việc (TS-BC-05). MH-RT-01 #11a. UAT-RT-24, 25 |
| P-GD #9 | Nên sửa | Lỗ an toàn: bộ khách mẫu một dòng mở khóa "Áp dụng" | **Đã sửa** | RT-10 (a), RT-12 (c): division ≥ 20 hội thoại / 30 ngày phải chạy lại 30 ngày thật; bộ mẫu chỉ thay khi < 20 và ≥ 5 dòng. MH-RT-01 #12 tooltip, MH-RT-03 hành động "Chạy bộ mẫu". UAT-RT-23 |
| P-GD #10 | Nên sửa | Chạy lại chỉ có số đếm; cần tải và độ phủ khu vực | **Đã sửa** | RT-12 (d): hội thoại / người / ngày (TB, ngày cao nhất), % khu vực "Chưa rõ", số ngoài giờ dồn đầu giờ; RT-13 thêm cảnh báo > TS-BC-03 / ngày và > 40% "Chưa rõ". MH-RT-03 #5. UAT-RT-29 |
| P-GD #11 | Nên sửa | GS không đề xuất được việc liên tổ; không có người duyệt thay; không nhắc đề xuất chờ | **Đã sửa** (a, c) + **Chuyển file khác** (b → 01) | (a) RT-22 loại đề xuất "Chuyển bớt sang tổ khác", GĐ "Dựng vào bản nháp", GS tổ nhận được báo; (c) RT-22 (e) nhắc GĐ sau 3 ngày làm việc. (b) ủy quyền áp dụng khi GĐ vắng = quyền tạm thời `config.sla` DV theo 01, PQ-27 giữ nguyên (RT-11; §10 dòng 01). UAT-RT-26, 31 |
| P-GD #12 | Gợi ý | Đưa KPI-15 "Giá trị báo giá đang mở" lên MVP | **Hỏi chủ dự án** (Q-BC-18) | Đổi giai đoạn nên không tự sửa; BA thấy B hợp lý (cùng nguồn với KPI-13, 14) |
| P-GD #13 | Gợi ý | Có Δ mà không có mục tiêu division | **Đã sửa** | BC-29 (b) mục tiêu division cho KPI-05, 06, 12 (tùy chọn theo tổ), vạch trên sparkline, thay ngưỡng Q-BC-08 khi đã đặt; MH-RT-06 #10; §9 `report_targets` |
| P-GD #14 | Gợi ý | Tóm tắt sáng thứ Hai cho GĐ và GS | **Hỏi chủ dự án** (Q-BC-13) | Q-BC-13 thêm phương án "B-thứ Hai", BA đề xuất B-thứ Hai; mặc định vẫn A tới khi chốt |
| P-GS #1 | Chặn | Tin điện thoại về VClinks trễ tính theo giờ nào; nick đỏ bị tính oan; số chụp chốt khi nick chưa đồng bộ | **Đã sửa** | BC-24: lượt bắt đầu / kết thúc theo **giờ gửi thật** (`sendDttm`), tin về trễ → lượt tính lại, bỏ quá hạn nếu giờ gửi trong hạn; hàng "Ngay bây giờ" ghi "{n} nick đang mất kết nối, số có thể chưa đúng"; BC-15 (b) số chụp **tạm → khóa** sau TS-BC-01 (24 giờ), tin về trễ trong khoảng tạm làm bản tạm tính lại; lúc khóa còn nick chưa đồng bộ lại → "Thiếu dữ liệu nick {tên}". Drawer cột "Về VClinks lúc". Phần (b) "không tính vào % cá nhân các lượt trong lúc nick đỏ": **không làm** vì khi nick đỏ VClinks không nhận cả tin khách lẫn tin trả lời; khi đồng bộ lại cả hai tính theo giờ gửi thật nên không còn oan, còn loại hẳn thì mở đường né KPI bằng cách tắt nick. UAT-BC-40, 41; story BC-US-17 |
| P-GS #2 | Chặn | Nghỉ đột xuất báo muộn: lượt trước lúc bật cờ bị tính cho người nghỉ; KPI-17 tính cho owner nghỉ dài | **Đã sửa** + **Chuyển file khác** (01 PQ-32, MH-PQ-07) | BC-25: "Hiệu lực từ" lùi tới đầu ngày làm việc, lý do bắt buộc, NVKD tự đăng ký hồi tố cần GS đồng ý, nhật ký `grant.cover.backdate`; lượt hết hạn trong khoảng hồi tố → "Không người chịu (nghỉ đột xuất)"; KPI-17 bỏ ngày nghỉ phép, không thu hồi khi owner đang nghỉ. §1.4, MH-BC-03 #3, MH-BC-07 #4a, #6. UAT-BC-42, 52; dữ liệu TD-BC-V; story BC-US-18 |
| P-GS #3 | Chặn | Form đề xuất chỉ sửa quy tắc tổ mình; GS không thấy điều kiện quy tắc phía trên nên không đề xuất giảm tải được | **Đã sửa** | RT-22: (a) GS thấy chỉ đọc tên, điều kiện, tổ nhận của mọi quy tắc xét trước (không tên người); (b) loại đề xuất "Chuyển bớt sang tổ khác" (điều kiện, tổ đề nghị nhận tùy chọn, lý do, số đính kèm); (c) GĐ dựng vào nháp. RT-18 bảng "Còn lại" theo khu vực / loại khách. MH-RT-01 #14, #15, MH-RT-04 #0, #0a, #7a, MH-RT-05 #4a. UAT-RT-14 sửa, UAT-RT-26; story BC-US-20 |
| P-GS #4 | Nên sửa | Kỳ mặc định "Tuần này" trống sáng thứ Hai; "Hôm qua" là Chủ nhật | **Đã sửa** | MH-BC-01 #6: mốc "Ngày làm việc trước", mặc định của GS. UAT-BC-43 |
| P-GS #5 | Nên sửa | "Chưa trả lời" gộp tồn và mới | **Đã sửa** | KPI-07 tách "Tồn từ hôm trước" / "Hôm nay"; MH-BC-03 #1, #1a |
| P-GS #6 | Nên sửa | Không nhắc được NVKD ngay tại dashboard | **Đã sửa** + **Chuyển file khác** (00) | MH-BC-03 #1a nút "Nhắc", bảng hành động (thông báo "Cần làm ngay", dòng sự kiện, 1 lần / 15 phút); 00: nút "Nhắc {tên}" và "Trả lời thay" trên danh sách, loại thông báo, dòng sự kiện. UAT-BC-46 |
| P-GS #7 | Nên sửa | Người trực thay bị xấu số mà bảng không tách | **Đã sửa** | KPI-11 "Lượt trực thay" + % quá SLA phần trực thay; MH-BC-03 #3 cột tự bật, tooltip; Drawer lọc "Chỉ lượt trực thay". UAT-BC-44 |
| P-GS #8 | Nên sửa | Không ghi được giải trình, không đề nghị tính lại | **Đã sửa** | BC-26 giải trình (NVKD, GS), đề nghị tính lại (GS) → GĐ duyệt; số hiện tại và bản tạm tính lại, bản đã khóa giữ; NVKD thấy trạng thái. MH-BC-06 #10 + hành động; §9 `turn_notes`, `turn_adjust_requests`. UAT-BC-45; story BC-US-19 |
| P-GS #9 | Nên sửa | Kèm cặp cần xu hướng 8 tuần và giờ hay quá SLA của một người | **Đã sửa** + việc designer (bố cục in) | MH-BC-06 "Nhóm theo: Tuần", #5a khối "Xu hướng của {tên}" (8 tuần, đường tổ nét đứt, heatmap lượt quá SLA theo giờ), nút "In trang tóm tắt". Việc designer D5 |
| P-GS #10 | Nên sửa | "Chia đều trong tháng" dồn khách cho người vừa quay lại | **Đã sửa** | RT-06 chia theo số ngày làm việc có mặt; RT-07 + MH-RT-06 #5b trần "Tối đa khách mới mỗi người mỗi ngày"; RT-12 (d) chạy lại hiện ca người quay lại. UAT-RT-05 sửa, UAT-RT-27 |
| P-GS #11 | Nên sửa | GS không so được tải với tổ khác | **Đã sửa** | RT-18 dòng "Khách mới / NVKD: tổ · TB division · tổ cao nhất" (không tên NVKD tổ khác); MH-RT-05 #4a. UAT-RT-28 |
| P-GS #12 | Nên sửa | Nhắc xong mất dấu, không biết owner đã liên hệ chưa | **Đã sửa** | MH-BC-07 #4a cột "Nhắc gần nhất", "Đã liên hệ sau nhắc", lọc "Đã nhắc mà chưa liên hệ > 3 ngày làm việc". UAT-BC-47 |
| P-GS #13 | Gợi ý | Người Đi thị trường bị bỏ qua mất lượt; cho chia cho người Đi thị trường | **Đã sửa** (một phần) · phần còn lại **Không làm** | RT-23 tùy chọn "giữ lượt" trên quy tắc Vòng tròn (mặc định tắt, tối đa 2 lượt nợ / ngày), cột "Được bù"; MH-RT-02 #6a. UAT-RT-30. **Không làm** "cho phép chia cho người Đi thị trường": 02 DK-47, DK-62 quy định người Đi thị trường không nhận khách mới (02 thắng về định tuyến); muốn đổi thì nêu ở 02 |
| P-GS #14 | Gợi ý | Bảng theo NVKD 12 cột, quá nhiều | **Đã sửa** | MH-BC-03 #3, #3a: mặc định 5 cột (Lượt · % quá SLA · Chưa trả lời · Từ điện thoại · Báo giá), P90 trong tooltip FRT, còn lại ở "Cột hiển thị"; wireframe sửa |
| P-GS #15 | Gợi ý | "Chia đều" khi bàn giao chỉ đếm số khách, không theo giá trị | **Chuyển file khác** (01 MH-PQ-04) | Bàn giao khách là màn của 01 (RT-17 chỉ trỏ tới). 01 MH-PQ-04 #6 đã có cột doanh số 12 tháng ở bảng xem trước; đề nghị 01 thêm cách "Chia đều theo doanh số 12 tháng" (§10) |
| P-BGD #1 | Chặn | Dashboard tập đoàn không trả lời 6 mục tiêu G1–G6 | **Đã sửa** (chỉ tiêu: Q-BC-19) | BC-28 hàng "Mục tiêu VClinks" trên MH-BC-05 #0 và MH-BC-04 #0, mỗi mục một chỉ số có công thức: G1 = KPI-27 (mới, % lượt chờ quá 15′), G2 = KPI-05, G3 = KPI-21, G4 = KPI-26 (mới) + KPI-28 (mới, thời gian tới báo giá), G5 = KPI-29 (mới), G6 = KPI-30 (mới); thẻ chưa có dữ liệu ghi lý do, không ẩn. BC-29 (a) chỉ tiêu tập đoàn chờ Q-BC-19. UAT-BC-48; story BC-US-21 |
| P-BGD #2 | Chặn | Không đo "khách thuộc công ty"; số chỉ tính trên nick đã kết nối nên đẹp giả | **Đã sửa** | KPI-29 "Độ phủ kênh": (a) tài khoản kênh đã khai báo đang đồng bộ khỏe, (b) ngày-nick mất đồng bộ, (c) % account có owner; theo tổ chỉ tính tài khoản có người giữ. BC-27 mọi thẻ / dòng ghi "Trên {n}/{m} tài khoản kênh đang đồng bộ", dưới TS-BC-02 (90%) tô vàng "Số có thể thiếu"; số chụp lưu độ phủ. Phần (d) "% tin phản hồi đi qua nick công ty đã kết nối": **không làm** — tin đi qua kênh chưa kết nối thì VClinks không thấy nên không có mẫu số; độ phủ (a), (b) là cách đo thay. UAT-BC-49; dữ liệu TD-BC-K; story BC-US-22 |
| P-BGD #3 | Chặn | Excel có dòng theo khách tới 50.000 dòng không cần duyệt vì không có SĐT | **Đã sửa** + **Chuyển file khác** (01) | BC-19: file **tổng hợp** tải tự do; file **có dòng theo khách** áp 01 PQ-48 (`exportMaxRows` TS-30 = 500, vượt trần cần duyệt, mã xuất, dòng đầu / chân, link 24 giờ), là sự kiện cho PQ-46; hộp xuất hai lựa chọn (MH-BC-01). Rút đề nghị miễn duyệt ở §10; đề nghị 01 luôn duyệt danh sách chu kỳ mua lại / bỏ rơi từ division trở lên. UAT-BC-11, 27 sửa; UAT-BC-50; story BC-US-23 |
| P-BGD #4 | Nên sửa | GĐ tự chụp bổ sung số của mình, so kỳ tự đổi, XEM chỉ "Để biết" | **Đã sửa** | BC-15 (d): bản khóa đầu = "Bản đã báo cáo"; bản bổ sung chỉ thay số so kỳ khi XEM "Chấp nhận" (tự chấp nhận sau TS-BC-06); thông báo "Cần xử lý"; MH-BC-09 #6 Drawer so hai bản; "Cần chú ý" trên MH-BC-05. UAT-BC-35 sửa |
| P-BGD #5 | Nên sửa | Số quý chưa rõ; thêm năm, cùng kỳ năm trước | **Đã sửa** | Cùng P-GD #1; thêm loại "Năm", nút "Cùng kỳ năm trước" (MH-BC-09 #4). UAT-BC-37 |
| P-BGD #6 | Nên sửa | So division khập khiễng (SLA, lịch, cơ cấu kênh) | **Đã sửa** | MH-BC-05 #2 cột "SLA áp dụng", "Tỷ trọng kênh", tooltip "SLA đổi trong kỳ"; thước chung KPI-27 "% lượt chờ quá 15′" cho mọi division |
| P-BGD #7 | Nên sửa | Chưa đạt "1 phút sáng thứ Hai" | **Đã sửa** | MH-BC-01 #6 XEM thứ Hai mặc định "Họp tuần"; MH-BC-05 #0a dải "Cần chú ý" ≤ 5 dòng tự sinh (Δ xấu vượt TS-BC-07, nick mất đồng bộ > 24 giờ, drift, PQ-46, NĐ 13 sắp hạn, bản bổ sung chờ chấp nhận). UAT-BC-51 |
| P-BGD #8 | Nên sửa | Dashboard tập đoàn không có dòng nào về rủi ro dữ liệu | **Đã sửa** | MH-BC-05 #2b khối "Kiểm soát dữ liệu tuần này" lấy nguyên từ 01 MH-PQ-10, nút mở; chỉ XEM và GĐ (division) thấy |
| P-BGD #9 | Nên sửa | MH-BC-08 cho XEM thấy tên từng owner, lệch BC-12 | **Đã sửa** | MH-BC-08 #3: XEM thấy "Mã KH theo tổ", không tên owner; ghi rõ sửa đồng thời nếu Q-BC-06 chốt khác. UAT-BC-34 sửa |
| P-BGD #10 | Gợi ý | Cần biết vấn đề cấp người mà không xem tên | **Hỏi chủ dự án** (Q-BC-06) | Q-BC-06 thêm phương án **A+** (A + cột ngoại lệ không tên + quyền tạm thời khi có vụ việc), BA đề xuất A+; MH-BC-05 #2 ghi cột chỉ bật nếu chốt A+ |
| P-BGD #11 | Gợi ý | Heatmap, "Tin khách", "Báo giá gửi" thừa với BGĐ | **Đã sửa** | MH-BC-05: bỏ hàng thẻ cũ, heatmap, cột "Tin khách", Pie kênh; thay bằng hàng G1–G6 và cột "Tỷ trọng kênh" |
| P-BGD #12 | Gợi ý | Chi phí kênh (ZNS, quảng cáo, AI) chưa lên màn tập đoàn | **Đã sửa** (AI giữ Q-BC-16) | MH-BC-05 #2c dòng "Chi phí kỳ này" lấy nguyên từ 04 MH-OA-19, 05 MH-MK-10; AI "Chưa đo" |

## Câu hỏi cho chủ dự án

Ghi ở 07 §11 (đề nghị BA trưởng thêm vào `quyet-dinh-chu-du-an.md`). Tới khi chốt, 07 chạy theo cột "Mặc định đang chạy".

| Mã | Câu hỏi | Phương án | Mặc định đang chạy | BA đề xuất | Nguồn |
|---|---|---|---|---|---|
| **Q-BC-10** (cập nhật) | Gộp quy tắc giao lead (05) và quy tắc chia khách (07) thành một màn? | A tách (như hiện tại) · B gộp một nơi `/settings/routing`, hai nhóm "Lead" / "Khách chưa có owner" dùng chung điều kiện khu vực · C mọi hội thoại mới đều là lead | A + mức tối thiểu RT-19 | **B**: mở khu vực mới là việc của một người, hai màn thì có lúc sửa một quên một. Chi phí: 05 tách phần chia người khỏi `/leads/rules`. GĐ nghiêng B | P-GD #3 (Chặn) |
| **Q-BC-06** (cập nhật) | XEM có xem hiệu suất từng NVKD? | A tới tổ · B có · C có, ghi nhật ký · **A+** = A + cột ngoại lệ không tên + quyền tạm thời khi có vụ việc | A | **A+** (P-BGD chọn A + ngoại lệ không tên + quyền tạm thời; GĐ chọn A) | P-BGD #10 |
| **Q-BC-13** (cập nhật) | Tóm tắt đầu giờ cho GS / GĐ? | A không · B 08:00 hằng ngày · C thêm email · **B-thứ Hai** chỉ 08:00 thứ Hai cho GĐ và GS | A | **B-thứ Hai** | P-GD #14 |
| **Q-BC-17** (mới) | Báo cáo VCsales nào làm chuẩn đối chiếu, lọc theo trường ngày nào; báo giá nội bộ / khách vãng lai có loại khỏi mẫu số KPI-26? | A ngày tạo + "Đã duyệt" · B ngày duyệt · C báo cáo anh chỉ định | A, ghi "Báo cáo VCsales: chờ xác nhận" | A; cần VCsoft xác nhận (TT-01) | P-GD #2 |
| **Q-BC-18** (mới) | KPI-15 "Giá trị báo giá đang mở" lên MVP? | A GĐ2 · B MVP khi có TT-01 | A | B hợp lý (cùng nguồn KPI-13, 14) | P-GD #12 |
| **Q-BC-19** (mới) | Chỉ tiêu G1–G6 bao nhiêu, ai đặt? | A một bộ tập đoàn do chủ dự án chốt, XEM sửa có nhật ký · B mỗi division một bộ · C chưa đặt | C ("Chưa đặt chỉ tiêu") | A; số để bàn: G1 ≤ 5%, G2 ≤ 10′, G3 ≥ 90%, G4 ≥ 80% và ≤ 1 giờ làm, G5 = 100%, G6 ≥ 80% | P-BGD #1 |

**Thông số mới** (chạy theo mặc định, đề nghị gộp vào bảng TS): TS-BC-01 khóa số chụp sau 24 giờ · TS-BC-02 ngưỡng độ phủ 90% · TS-BC-03 cảnh báo > 15 hội thoại mới / người / ngày khi chạy thử · TS-BC-04 cửa sổ quay về 24 giờ · TS-BC-05 theo dõi sau áp dụng 2 ngày làm việc · TS-BC-06 tự chấp nhận bản bổ sung sau 3 ngày làm việc · TS-BC-07 ngưỡng "Cần chú ý" 3 điểm / 20%.

**Ý kiến vai** cho các Q-BC đã có (Q-BC-01, 02, 03, 05, 08, 09, 11, 12, 14, 15, 16): ghi ở bảng "Ý kiến các vai vòng 1" trong 07 §11; không vai nào phản đối mặc định BA; P-GD và P-BGD cùng muốn phần VCsales của số chụp chụp cùng giờ TS-HD-11 (Q-BC-09).

## Việc cho designer

| Mã | Màn | Việc |
|---|---|---|
| D1 | MH-BC-01 khung | Mốc nhanh "Ngày làm việc trước", "Họp tuần", "Năm trước"; nhãn "Số chụp tạm · khóa lúc …", tag trạng thái "Thiếu dữ liệu nick", "Bản đã báo cáo · có bản bổ sung chờ chấp nhận"; hộp "Xuất Excel" hai lựa chọn (tổng hợp / kèm danh sách chi tiết), trạng thái "Cần duyệt" + ô lý do + "Gửi yêu cầu xuất" |
| D2 | MH-BC-03 tổ | Theo wireframe v1.1: "Chưa trả lời · tồn từ hôm trước", `Alert` nick mất kết nối, nút "Nhắc" cạnh tên (trạng thái khóa 15 phút), bảng 5 cột mặc định, cột "Lượt trực thay" tự bật, dòng "Không người chịu (nghỉ đột xuất)", dòng độ phủ dưới hàng thẻ; đổi nhãn "Tỷ lệ chốt" → "Chốt trong 30 ngày" (mọi màn) |
| D3 | MH-BC-04 division | Hàng "Mục tiêu VClinks" 6 thẻ (Đạt / Chưa đạt / Chưa đặt / Chưa bật); khối "Đối chiếu VCsales" + dòng cảnh báo owner ≠ NV phụ trách; bảng so sánh tổ cột mới (lượt / NVKD / ngày, % quá SLA ba loại, sparkline 8 tuần có vạch mục tiêu, Δ FRT, Δ chốt) |
| D4 | MH-BC-05 tập đoàn | Dải "Cần chú ý"; hàng G1–G6; bảng division cột Độ phủ (tô vàng cả dòng), SLA áp dụng, Tỷ trọng kênh, % quá 15′; bỏ heatmap, thẻ cũ, Pie; khối "Kiểm soát dữ liệu tuần này", dòng "Chi phí kỳ này"; chỗ cho hai cột ngoại lệ không tên (ẩn tới khi Q-BC-06) |
| D5 | MH-BC-06 hiệu suất | Drawer: cột "Về VClinks lúc" / nhãn "Về trễ", icon giải trình, bộ lọc lượt trực thay, nút và Modal "Ghi giải trình", "Đề nghị tính lại", "Duyệt / Từ chối"; khối "Xu hướng của {tên}" (đường 8 tuần + heatmap quá SLA theo giờ) và **bố cục in một trang** cho buổi kèm cặp; tab Báo giá cột mới |
| D6 | MH-BC-07 chăm sóc | Cột "Nhắc gần nhất", "Đã liên hệ sau nhắc", lọc "Đã nhắc mà chưa liên hệ"; nhãn "(Nghỉ phép tới dd/MM)" ở cột Owner, nút thu hồi khóa |
| D7 | MH-BC-08 | Biến thể của XEM: bảng "Mã KH theo tổ" |
| D8 | MH-BC-09 số chụp | Loại "Năm"; cột "Bản" với trạng thái tạm / khóa / bổ sung chờ chấp nhận; Drawer "Bản đã báo cáo và bản bổ sung" (Δ từng chỉ số, nút Chấp nhận / Không chấp nhận của XEM); nút "Cùng kỳ năm trước" |
| D9 | MH-RT-01 | Biến thể GS: khối "Được xét trước quy tắc của tổ bạn (chỉ đọc)", `Dropdown.Button` hai loại đề xuất; GĐ: nút "Quay về v{n−1} ngay" + đếm giờ còn lại; Modal "Áp dụng…" có cảnh báo lệch khu vực với quy tắc giao lead |
| D10 | MH-RT-03 | Câu kết quả nhánh lead; bảng chạy lại thêm "% khu vực Chưa rõ", "TB / ngày", "Ngày cao nhất", dòng ngoài giờ; thông điệp bộ mẫu khi division ≥ 20 |
| D11 | MH-RT-04 | Wireframe mới "Chuyển bớt sang tổ khác" (điều kiện, tổ đề nghị nhận, số liệu đính kèm), nút GĐ "Dựng vào bản nháp" |
| D12 | MH-RT-05 | Dòng so tải, bảng "Còn lại theo khu vực / loại khách", cột "Được bù", `Checkbox` lịch sử quy tắc giao lead (nhãn "Lead") |
| D13 | MH-RT-02, MH-RT-06 | MH-RT-02 #6a "giữ lượt"; MH-RT-06 #5b trần khách mới / ngày, khối "Mục tiêu báo cáo" (theo division, tùy chọn theo tổ) + dòng chỉ tiêu tập đoàn chỉ đọc |

## Việc chuyển file khác

| File | Việc | Nguồn góp ý |
|---|---|---|
| **00** | UI-TP-07 mốc "Ngày làm việc trước", "Họp tuần", "Năm trước"; MH-UI-03 loại thông báo mới (GS nhắc, bản bổ sung chờ chấp nhận, đề nghị tính lại, cảnh báo sau áp dụng, đề xuất chuyển khách sang tổ bạn, đề xuất chờ quá 3 ngày); MH-UI-07 dòng sự kiện "{GS} nhắc lúc {HH:mm}"; MH-UI-10 nút "Nhắc {tên} ({n} hội thoại)" và "Trả lời thay" trên danh sách; §2 route `type=year` | P-GS #4, #6; P-GD #7, #8, #11; P-BGD #4, #7 |
| **01** | Rút đề nghị miễn duyệt file báo cáo: file có dòng theo khách áp PQ-48 / TS-30, xuất là sự kiện PQ-46; đề nghị luôn duyệt danh sách chu kỳ mua lại / bỏ rơi từ division trở lên. PQ-32 / MH-PQ-07 "Hiệu lực từ" lùi tới đầu ngày làm việc, lý do, GS đồng ý khi NVKD tự đăng ký, `grant.cover.backdate`. Khóa mới `report.turn_note`, `report.turn_adjust_request`, `report.turn_adjust_decide`, `report.snapshot_accept`, `config.report_target`. Quyền tạm thời `config.sla` DV để áp dụng quy tắc chia khi GĐ vắng. PQ-38 mã nhật ký mới. MH-PQ-10 cấp số cho khối kiểm soát trên MH-BC-05. MH-PQ-04 cách chia "Chia đều theo doanh số 12 tháng" | P-BGD #3, #8; P-GS #2, #8, #15; P-GD #11 (b) |
| **02** | DK-47 cờ Nghỉ phép hồi tố chỉ tác động báo cáo (định tuyến đổi từ lúc bấm); DK-62 "Chia đều" theo ngày có mặt + trần khách mới / ngày; MH-DK-12 là đích link từ cảnh báo owner ≠ NV phụ trách | P-GS #2, #10; P-GD #5 |
| **03** | SZ-21, SZ-22: thời điểm tin = giờ gửi thật `sendDttm`, lưu thêm `ingestedAt`; MH-SZ-12a lưu lịch sử trạng thái nick cho KPI-29 và "Thiếu dữ liệu nick" | P-GS #1; P-BGD #2 |
| **04** | MH-OA-19 cấp số chi phí ZNS / tin có phí theo division, kỳ; `sla_config` có phiên bản cho tooltip "SLA đổi trong kỳ" | P-BGD #6, #12 |
| **05** | MH-MK-08 mức tối thiểu RT-19: API "thử một khách" của động cơ giao lead (chỉ đọc), cảnh báo ngược khi áp dụng bộ lead có khu vực chưa có ở 07, cho 07 đọc lịch sử phiên bản; chờ Q-BC-10. MH-MK-10 cấp số chi phí quảng cáo đã khóa | P-GD #3; P-BGD #12 |
| **06** | HD-57: 07 có số chụp quý / năm riêng (dòng chảy tính lại toàn kỳ, tồn lấy cuối kỳ); cơ chế tạm → khóa và "Bản đã báo cáo" dùng chung được | P-GD #1; P-BGD #4, #5 |
| **TD (du-lieu-kiem-thu.md)** | Gộp TD-BC-S, V, T, R, C, K; mở rộng khoảng dành cho nhóm ca BC tới **T−12**; số báo giá mới `BG-2026-0601…0610`, `0721…0730`, `0740…0747` (kiểm trùng §5.1); tổ giả lập "Tổ ĐN1" cho UAT-RT-22 | Mọi UAT mới |
| **VCsoft (TT-01)** | Q-BC-17; API danh sách báo giá theo ngày tạo, trạng thái "Đã chốt" có ngày chốt (KPI-14), NV phụ trách theo đơn | P-GD #2, #4, #5 |
| **quyet-dinh-chu-du-an.md** | Thêm Q-BC-17, 18, 19; cập nhật phương án Q-BC-06 (A+), Q-BC-10 (đề xuất B), Q-BC-13 (B-thứ Hai); gộp TS-BC-01…07; ghi ý kiến vai | Tất cả |

## UAT đề xuất đã hợp nhất

| Đề xuất | Thành ca |
|---|---|
| P-GD UAT-BC-GD-01…03 | UAT-BC-37 (GD-01, dữ liệu Q2/2026 TD-BC-T), UAT-BC-38 (GD-02, TD-BC-C) + **UAT-BC-23 sửa**, UAT-BC-39 (GD-03, TD-BC-R) |
| P-GD UAT-RT-GD-04…09 | UAT-RT-22 (GD-04), 23 (GD-05), 24 (GD-06), 25 (GD-07), 26 (GD-08, gộp với P-GS RT-02), 31 (nhắc đề xuất chờ); GD-09 (ủy quyền) chờ 01 thêm quyền tạm thời `config.sla`, chưa viết ca |
| P-GS UAT-BC-GS-01…08 | UAT-BC-40 (GS-01), 41 (GS-02, phần số chụp "Thiếu dữ liệu nick"), 42 (GS-03), 43 (GS-04), 44 (GS-05), 45 (GS-06), 46 (GS-07), 47 (GS-08) |
| P-GS UAT-RT-GS-01…03 | UAT-RT-27 (GS-01), 26 (GS-02), 28 (GS-03) |
| P-BGD (không có ca đề xuất) | UAT-BC-48 (G1–G6), 49 (độ phủ), 50 (xuất có dòng khách), 51 ("Cần chú ý", mặc định thứ Hai), 52 (KPI-17 owner nghỉ phép) |
| BA | UAT-RT-29 (tải và % "Chưa rõ" khi chạy lại), UAT-RT-30 (giữ lượt) |
| Sửa ca cũ | UAT-BC-11 (hai loại file, mã xuất), UAT-BC-15 (KPI-14 không vào dải vàng, "Chốt trong 30 ngày"), UAT-BC-23 (so với báo cáo VCsales), UAT-BC-27 (vượt trần cần duyệt), UAT-BC-34 (XEM không thấy tên owner), UAT-BC-35 (bản bổ sung chờ chấp nhận), UAT-RT-05 (chia theo ngày có mặt), UAT-RT-14 (GS thấy điều kiện quy tắc xét trước) |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/07-xu-ly.md) | — |
