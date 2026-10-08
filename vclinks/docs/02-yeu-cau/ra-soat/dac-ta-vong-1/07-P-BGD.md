# Góp ý 07 — P-BGD (ban giám đốc / kiểm soát)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý của P-BGD (ban giám đốc / kiểm soát nội bộ, vai trò `quan_sat`, xem toàn tập đoàn) cho đặc tả 07 Báo cáo và chia khách v1.0 (29/09/2026).
- Đi qua 7 tình huống: xem nhanh sáng thứ Hai, họp quý so division, "khách đã thuộc về công ty chưa", kiểm số với VCsales, GĐ chụp bổ sung, rủi ro xuất Excel, Q-BC-06.
- 12 góp ý: 3 Chặn, 6 Nên sửa, 3 Gợi ý.
- Chặn: dashboard tập đoàn MH-BC-05 không trả lời 6 mục tiêu G1–G6; không đo được độ phủ kênh và "khách thuộc về công ty"; file Excel có dòng theo khách xuất được mà không qua duyệt.
- Nên sửa: GĐ tự chụp bổ sung số của division mình, số quý chưa rõ cách tính, so division khập khiễng (SLA, lịch, kênh), chưa đạt "1 phút sáng thứ Hai", thiếu khối rủi ro dữ liệu, MH-BC-08 lộ tên owner lệch BC-12.
- Nghiêng về: Q-BC-06 A kèm cột ngoại lệ không tên và quyền tạm thời khi có vụ việc; không miễn duyệt file có dòng khách; chi phí ZNS và quảng cáo lên MVP.
- Không đề xuất ca UAT. Kết quả xử lý từng góp ý: xem [07-xu-ly.md](07-xu-ly.md).

## Mục lục

- [Tôi đi qua](#tôi-đi-qua)
- [Góp ý](#góp-ý)
- [Quyết định tôi nghiêng về](#quyết-định-tôi-nghiêng-về)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Tài liệu góp ý: `docs/02-yeu-cau/dac-ta/07-bao-cao-va-chia-khach.md` v1.0 (29/09/2026). Vai: ban giám đốc và kiểm soát nội bộ VC Phồn Vinh, vai trò `quan_sat` (XEM), chỉ xem toàn tập đoàn. Đối chiếu: `docs/vclinks-ba.md` §1 (G1–G6), BGD-01…03; `01-phan-quyen.md` §3.7 `report.*`, PQ-48; góp ý trước của tôi ở [01-P-BGD.md](01-P-BGD.md).

Phần định nghĩa chỉ số làm kỹ, tôi yên tâm: có "Số này tính thế nào", tin gửi từ điện thoại vẫn được tính, có số chụp không sửa được, không xếp hạng từng người. Nhưng MH-BC-05, màn dành cho tôi, hiện đang là **dashboard division thu nhỏ** (lượng tin, FRT, SLA, heatmap). Nó chưa trả lời câu tôi thật sự hỏi: VClinks có đạt 6 mục tiêu G1–G6 chưa, và khách đã thật sự thuộc về công ty chưa. Có hai chỗ làm tôi chưa dám tin số. Một là mọi số chỉ tính trên các nick **đã kết nối**: nick chưa kết nối hoặc mất đồng bộ 3 ngày sẽ biến mất, và số lại càng đẹp. Hai là GĐ tự chụp bổ sung được số của chính mình, còn tôi chỉ được "để biết". Chỗ đáng lo nhất về rủi ro là file Excel báo cáo. Nó có danh sách tên khách, owner, giá trị báo giá và khách sắp đến chu kỳ mua lại, tới 50.000 dòng, mà không cần ai duyệt, chỉ vì file không có SĐT.

## Tôi đi qua

| # | Tình huống | Làm được trên đặc tả? | Chỗ vướng |
|---|---|---|---|
| 1 | **Sáng thứ Hai, 1 phút:** "Tuần trước cả tập đoàn thế nào, có gì bất thường?" | Một phần. Mở `/reports` thì mặc định là "Tháng này" (MH-BC-01 #6), số hiện tại, 5 thẻ và bảng division | Phải tự đổi sang "Tuần trước" và tự đọc bảng để thấy chỗ xấu. Không có dải "cần chú ý" nào. Không biết nick nào đỏ, drift nào đang mở, cảnh báo rò rỉ nào chưa xử lý. Heatmap giờ chiếm chỗ mà tôi không dùng |
| 2 | **Họp quý, so VCparts với VCedu** | Một phần. Có bảng theo division và số chụp | "Tháng cuối quý dùng làm số quý" (BC-15): FRT trung vị của **quý** không suy ra được từ số của tháng 9. SLA hai division khác nhau (lịch làm việc, hạn theo kênh, 04 MH-OA-18), nên "% quá SLA 18% vs 12%" là so hai thước đo khác nhau mà màn không nói. Tỷ trọng kênh cũng khác |
| 3 | **"Khách đã thật sự thuộc về công ty chưa?"** (G5, G3) | **Không** trên MH-BC-05. KPI-21 "% hội thoại gắn hồ sơ" nằm ở tab Chất lượng dữ liệu. Không có chỉ số nào về nick | Không có "% nick / tài khoản bán hàng đã kết nối", không có "nick đang dùng bán hàng mà chưa kết nối", không có "account chưa có owner". KPI-10 "% qua VClinks" chỉ đo **trong** các nick đã kết nối |
| 4 | **Kiểm tra số có đáng tin:** hỏi GĐ VCparts "Số này có khớp VCsales không?" | Một phần. Có dòng "VCsales lấy lúc…", và trạng thái số chụp "Thiếu số VCsales" | Không có dòng đối chiếu kiểu "Báo giá VCsales trong kỳ 620, gửi qua VClinks 540 (87%)", tức chỉ số G4. Số chụp "Đủ" chỉ xét VCsales, **không xét** nick nào mất đồng bộ trong kỳ |
| 5 | **GĐ chụp bổ sung sau khi đã báo cáo tôi** | Có nhật ký, và tôi nhận thông báo "Để biết" | So kỳ tự chuyển sang bản mới nhất. Số tôi đã cầm vào họp bị thay mà không cần tôi đồng ý. Trên màn không thấy bản gốc lệch bản bổ sung bao nhiêu |
| 6 | **Rủi ro dữ liệu:** một GS sắp nghỉ vào MH-BC-07, tab "Chu kỳ mua lại", rồi Xuất Excel | **Không chặn.** `report.export` TỔ +NK tải ngay, không qua duyệt (BC-19) | File có tên khách, owner, ngày dự kiến mua, giá trị báo giá. Đây chính là danh sách đối thủ cần, không cần SĐT vì tên garage đủ để tìm ra. Nhật ký có ghi `export.report`, nhưng ghi lại mà không ai được báo |
| 7 | **Q-BC-06:** tôi có cần xem từng NVKD? | Mặc định A: xem tới tổ | Tôi đồng ý A cho việc xem thường ngày. Nhưng MH-BC-08 lại cho XEM thấy bảng "Mã KH theo owner" có **tên từng người**, lệch với BC-12 |

## Góp ý

| # | Màn/KPI | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | MH-BC-05, BGD-01, BA §1 G1–G6 | **Dashboard tập đoàn không trả lời 6 mục tiêu của dự án.** Có G1 (gần đúng, qua % quá SLA và "Chưa trả lời > 24h") và G2 (FRT). **Thiếu** G3 (KPI-21 chỉ có ở tab khác), G4 (chỉ đếm "Báo giá gửi", không có % báo giá VCsales gửi qua VClinks, không có thời gian từ lúc hỏi tới lúc nhận báo giá), G5 (không có chỉ số nào), G6 (KPI-18 GĐ2, không lên màn tập đoàn) | Ban giám đốc duyệt đầu tư VClinks theo đúng 6 chỉ số này. Nếu dashboard không có chúng thì mỗi quý lại phải nhờ BA hay dev kéo số tay | Thêm hàng đầu MH-BC-05 **"Mục tiêu VClinks"** gồm 6 thẻ G1…G6, mỗi thẻ có chỉ tiêu, số kỳ này, Δ, theo division. G1 = KPI-06 hoặc "% chưa trả lời > 15′". G2 = KPI-05. G3 = KPI-21. G4 = **KPI mới** "% báo giá VCsales trong kỳ được gửi qua VClinks" (mẫu số lấy từ VCsales, ghi "Chờ kết nối VCsales" khi chưa có TT-01). G5 = **KPI mới** (xem #2). G6 = KPI-18 phần "Đã nhắc" (GĐ2, hiện "Chưa bật" chứ không ẩn). Thẻ nào chưa có dữ liệu thì ghi rõ lý do, **không ẩn** | **Chặn** |
| 2 | KPI mới (G5), MH-BC-05, MH-BC-08, KPI-25 | **Không đo được "khách thuộc về công ty"**, và số hiện tại chỉ tính trên nick đã kết nối, nên **độ phủ** không thấy được | Nick chưa kết nối, hoặc bị đăng xuất mà không ai báo, thì hội thoại không vào VClinks: FRT và % quá SLA của tổ đó trông tốt hơn thực tế. Đây là chỗ nhân viên mang khách đi dễ nhất | KPI mới **"Độ phủ kênh"**: (a) nick / OA / Page bán hàng **đã khai báo** (theo người giữ nick ở 01) ÷ đã kết nối và đang đồng bộ; (b) số ngày-nick **mất đồng bộ** trong kỳ (lấy từ trạng thái nick ở 03 MH-SZ-12a); (c) % account có owner; (d) % tin phản hồi đi qua nick công ty đã kết nối. Mọi thẻ hiệu suất ghi thêm dòng phụ "Trên {n}/{m} nick đang đồng bộ". Division có độ phủ < 90% thì tô vàng cả dòng và chú thích "Số có thể thiếu" | **Chặn** |
| 3 | BC-19, MH-BC-06 #9, MH-BC-07 "Xuất Excel", 01 PQ-48 | **File Excel báo cáo có dòng mức khách** (sheet "Lượt chờ", "Báo giá", danh sách bỏ rơi / chu kỳ mua lại / báo giá treo: tên khách, owner, giá trị) mà **không qua duyệt**, tới 50.000 dòng, chỉ vì không có SĐT | Tên garage kèm giá trị và ngày dự kiến mua là đủ để đối thủ chào hàng. "Không SĐT" không có nghĩa là không rò rỉ. PQ-48 đã có trần `exportMaxRows`, nhưng BC-19 lại xin miễn | Tách hai loại file: (a) **chỉ số tổng hợp** (Tóm tắt, Theo tổ/kênh/ngày, Định nghĩa) thì tải tự do như hiện tại; (b) **có dòng mức khách** thì áp `exportMaxRows` của PQ-48: vượt trần thì phải duyệt, file có mã xuất, dòng đầu và dòng chân, link hết hạn 24 giờ. Danh sách "Chu kỳ mua lại" và "Bỏ rơi" từ phạm vi division trở lên luôn phải duyệt. Mỗi lần xuất loại (b) đưa vào quy tắc cảnh báo PQ-46. Xin 01 **không** xác nhận miễn như §10 đang đề nghị | **Chặn** |
| 4 | BC-15, MH-BC-09 "Chụp bổ sung" | **GĐ tự chụp bổ sung số của chính division mình**, so kỳ tự dùng bản mới, XEM chỉ được "Để biết" | Người bị đánh giá lại tự sửa được số đã nộp lên. Dù bản cũ vẫn giữ, số trên màn họp đã đổi | Bản đầu tiên đã xem hoặc xuất ở cấp tập đoàn là **"Bản đã báo cáo"**, luôn hiện cạnh bản bổ sung kèm Δ từng chỉ số. Bản bổ sung chỉ thay số so kỳ **sau khi XEM bấm "Chấp nhận"** (hoặc tự chấp nhận sau 3 ngày làm việc nếu không phản đối). Thông báo cho XEM ở mức "Cần xử lý", không phải "Để biết". Trên MH-BC-05 hiện "Division có bản bổ sung chưa chấp nhận: {n}" | **Nên sửa** |
| 5 | BC-15 "tháng cuối quý dùng làm số quý", MH-BC-09 #1 | **Số quý chưa rõ cách tính.** Trung vị FRT và % quá SLA của quý không suy ra được từ số tháng 9 | Họp quý là lúc tôi dùng báo cáo nhiều nhất. Nếu số quý là số tháng 9 thì mọi so sánh quý đều sai | Chụp riêng loại **Quý**: tính lại trên toàn bộ lượt của 3 tháng, cùng giờ với bản tháng cuối quý. Thêm loại **Năm**. Drawer "So sánh" cho phép so **cùng kỳ năm trước**. Ghi rõ trong BC-15 và thêm UAT | **Nên sửa** |
| 6 | MH-BC-05 bảng "Theo division", BC-02, KPI-06 | **So sánh division khập khiễng mà màn không cảnh báo:** SLA, lịch làm việc và cơ cấu kênh mỗi division một khác | Trong họp quý, 18% của VCparts với 12% của VCedu dễ bị hiểu là VCedu làm tốt hơn, trong khi hạn SLA của hai bên có thể khác | Bảng division có cột **"SLA áp dụng"** (ví dụ "Zalo 15′ · OA 30′") và **"Tỷ trọng kênh"**. Tooltip của Δ ghi "SLA đổi trong kỳ" khi `sla_config` có phiên bản mới. Thêm cột so sánh chuẩn chung: "% lượt trả lời trong 15′ giờ làm" (đúng thước G1), tính như nhau cho mọi division | **Nên sửa** |
| 7 | MH-BC-05, MH-BC-01 #6, BC-TP-04 | **Chưa đạt "1 phút sáng thứ Hai".** Mặc định là "Tháng này" + số hiện tại, không có dải ngoại lệ | Sáng thứ Hai tôi cần tuần trước đã chốt, và 3 điều cần chú ý, không cần đọc bảng | XEM mở vào thứ Hai: mặc định **"Tuần trước · Số chụp"**; ngày khác mặc định "Tháng này". Trên cùng có dải **"Cần chú ý"** (tối đa 5 dòng, tự sinh): division có Δ xấu nhất vượt ngưỡng; nick đỏ / mất đồng bộ > 24h; drift ánh xạ đang mở; cảnh báo bất thường PQ-46 chưa xử lý; phiếu NĐ 13 sắp hết hạn; bản chụp bổ sung chờ chấp nhận. Mỗi dòng bấm được | **Nên sửa** |
| 8 | MH-BC-05, 01 MH-PQ-10 "Tổng quan kiểm soát" | **Dashboard tập đoàn không có một dòng nào về rủi ro dữ liệu.** Muốn biết "ai xem, ai xuất danh sách khách tuần này" phải sang `/admin/audit` | Kiểm soát rủi ro là một nửa công việc của tôi. Tách hẳn sang màn khác thì sẽ không ai mở hằng tuần | Thêm khối nhỏ **"Kiểm soát dữ liệu tuần này"**: số lần xuất (tổng hợp / mức khách / kèm SĐT), số yêu cầu xuất chờ duyệt, cảnh báo bất thường mới, số lần hiện SĐT, phiếu NĐ 13 đang mở. Số lấy nguyên từ MH-PQ-10, có nút "Mở Tổng quan kiểm soát". Chỉ XEM và GĐ (theo division) thấy khối này | **Nên sửa** |
| 9 | MH-BC-08 #3 "Mã KH theo owner", §1.3 dòng XEM, BC-12 | **Lệch quy tắc:** BC-12 nói XEM chỉ xem tới tổ, nhưng MH-BC-08 cho XEM thấy bảng theo **tên từng owner** | Hai màn trả lời hai kiểu, đúng câu Q-BC-06 đang chờ chốt | Theo Q-BC-06: XEM xem MH-BC-08 **nhóm theo tổ**, không có tên owner. Nếu chốt khác thì sửa đồng thời BC-12, MH-BC-06 #1 và MH-BC-08. Thêm UAT kiểm tra XEM không thấy tên NVKD ở mọi tab | **Nên sửa** |
| 10 | Q-BC-06, BC-12, MH-BC-05 #2 | Xem tới tổ là đủ cho việc thường ngày, nhưng tôi vẫn cần **biết có vấn đề ở cấp người** mà không phải xem tên | Ví dụ một tổ có số tốt nhưng một người giữ 40% khách của tổ và 0% khách có mã KH: đây là rủi ro mang khách đi | Dòng tổ thêm cột **không tên**: "NVKD vượt ngưỡng % quá SLA: {n}", "Khách tập trung ở 1 người: {x}% (cao nhất)". Khi cần điều tra thì dùng quyền tạm thời của 01, có lý do và nhật ký, GĐ division được báo (tức phương án C chỉ dùng khi có vụ việc) | **Gợi ý** |
| 11 | MH-BC-05 heatmap, cột "Tin khách", thẻ "Báo giá gửi" | **Thừa với ban giám đốc:** heatmap giờ và số tin khách là số vận hành của GĐ. "Báo giá gửi 540" là số đếm, không cho biết tốt hay xấu | Màn 1 phút mà có quá nhiều số thì không ai đọc | Bỏ heatmap và cột "Tin khách" khỏi MH-BC-05 (vẫn còn khi bấm vào division ở MH-BC-04). Thay "Báo giá gửi" bằng thẻ G4 (#1) | **Gợi ý** |
| 12 | Q-BC-16, MH-BC-05 | **Chi phí kênh chưa lên màn tập đoàn:** ZNS, quảng cáo, AI | Tôi sợ nhất là chi phí ZNS và quảng cáo không ai kiểm soát. Số đã có ở 04 MH-OA-19 và 05 MH-MK-10 | Thêm một dòng "Chi phí kỳ này theo division: ZNS {…} · Quảng cáo {…} · AI {…} (khi có)", lấy nguyên từ 04, 05, có nút "Mở". AI để "Chưa đo" tới GĐ3 như Q-BC-16 A | **Gợi ý** |

**Tổng:** 3 Chặn · 6 Nên sửa · 3 Gợi ý.

## Quyết định tôi nghiêng về

| Câu | Tôi chọn | Lý do ngắn |
|---|---|---|
| **Q-BC-06** (XEM có xem từng NVKD không) | **A** cho màn thường ngày, cộng thêm cột ngoại lệ không tên (#10). Khi có vụ việc thì mở từng người qua **quyền tạm thời có lý do và nhật ký** (tinh thần C), báo GĐ division | Ban giám đốc soi từng NVKD thì giám sát và giám đốc mất vai trò, còn nhân viên sẽ phản ứng. Nhưng kiểm soát vẫn phải có đường xuống từng người khi cần điều tra |
| Q-BC-09 (giờ chụp) | **A** 02:00. Riêng phần VCsales thì dùng chung giờ với TS-HD-11 nếu kế toán cần | Chụp sau khi đồng bộ bù đêm thì ít phải chụp bổ sung, cũng là ít chỗ để sửa số |
| Q-BC-16 (chi phí AI) | **A** GĐ3, nhưng dòng chi phí ZNS và quảng cáo lên MVP (#12) | Hai chi phí này đã có số, chỉ cần đưa lên |
| BC-19 xin 01 miễn duyệt file báo cáo | **Không miễn** với file có dòng mức khách (#3) | "Không SĐT" chưa phải là "không rò rỉ" |
| Q-BC-15 (thời gian trực tuyến) | **A** không hiện | Đồng ý với BA: không biến VClinks thành máy chấm công |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/07-P-BGD.md) | — |
