# Góp ý 07 — P-GD (Thắng, giám đốc bán hàng)

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- Góp ý của P-GD (Thắng, giám đốc bán hàng VCparts, người sửa quy tắc chia khách) cho đặc tả 07 Báo cáo và chia khách v1.0 (29/09/2026).
- Đánh giá 13 lo ngại cũ từ 04, 05, 06: phần lớn đã giải quyết; chưa giải quyết: đối chiếu VCsales, doanh số theo nguồn kênh, người duyệt thay khi GĐ vắng, tóm tắt sáng thứ Hai; số quý còn sai.
- 14 góp ý: 3 Chặn, 8 Nên sửa, 3 Gợi ý.
- Chặn: số chụp quý lấy bản tháng cuối quý (sai với số dòng chảy, thiếu `periodType = quarter`); không có khối đối chiếu VCsales; mở khu vực mới phải sửa hai bộ quy tắc (giao lead ở 05, chia khách ở 07).
- Nên sửa: tỷ lệ chốt so hai lứa khác tuổi, hai cách gán doanh số, bảng so sánh tổ thiếu cột, mốc "Họp tuần" và xu hướng, đường lùi khẩn cấp cho quy tắc chia, lỗ an toàn ở bộ khách mẫu, tải và độ phủ khu vực khi chạy lại, đề xuất liên tổ và người duyệt thay.
- Ý kiến cho Q-BC-01…16 (Q-BC-10 chọn gộp hai bộ quy tắc, Q-BC-13 chọn tóm tắt thứ Hai cho GĐ và GS) và 9 ca UAT đề xuất.
- Kết quả xử lý từng góp ý: xem [07-xu-ly.md](07-xu-ly.md).

## Mục lục

- [Lo ngại cũ → 07 đã giải quyết chưa](#lo-ngại-cũ--07-đã-giải-quyết-chưa)
- [Một tháng của tôi](#một-tháng-của-tôi)
- [Góp ý](#góp-ý)
- [Quyết định tôi nghiêng về](#quyết-định-tôi-nghiêng-về)
- [UAT tôi muốn thêm](#uat-tôi-muốn-thêm)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Tài liệu góp ý: `docs/02-yeu-cau/dac-ta/07-bao-cao-va-chia-khach.md` (v1.0, 29/09/2026). Vai: Thắng, giám đốc bán hàng VCparts. Tôi chịu doanh số division, họp tuần với các giám sát, là người **sửa quy tắc chia khách** (RT-11). Phần tôi đọc kỹ: §2 BC-11…BC-16, §3 KPI-05, 06, 12…16, MH-BC-04, MH-BC-06, MH-BC-09, §5 RT-01, RT-10…RT-13, MH-RT-01…05, §11.

Bản này là lần đầu tôi thấy mọi chỉ số có công thức, có người chịu, có danh sách loại trừ, và có UAT tính tay ra đúng số. Tin tự động không làm đẹp FRT, trả lời hộ ghi đúng người, số chụp không sửa được: đúng những gì tôi xin ở 04, 05, 06. Quy trình quy tắc chia (nháp → chạy lại 30 ngày → áp dụng có lý do → lịch sử) chặt hơn tôi mong. Nhưng tôi vẫn chưa dám cầm dashboard này vào họp quý, vì ba chỗ. **Số quý đang lấy bằng số tháng cuối quý.** **Không có dòng nào so thẳng với VCsales.** Còn khi mở khu vực mới, **tôi phải sửa hai bộ quy tắc ở hai màn khác nhau** (lead ở 05, khách ở 07) mà không có gì nhắc.

### Lo ngại cũ → 07 đã giải quyết chưa

| Lo ngại cũ (mã) | 07 xử lý ở đâu | Đánh giá |
|---|---|---|
| Không so kỳ trước, không có việc tồn để họp (04 #6) | BC-13 Δ "so cùng {n} ngày làm việc", màu theo hướng tốt; MH-BC-04 #2 "Việc tồn ngay bây giờ" | **Đã giải quyết** |
| FRT tính cả tin chào, bot (04 #7, 05 #5) | BC-01, KPI-05, UAT-BC-04 (tin chào 11:00 không kết thúc lượt) | **Đã giải quyết** |
| Hỏi giá qua OA chờ sale, không ai đo (04 #4, #6) | KPI-12 + ô "Hỏi giá owner quá hạn" trên MH-BC-04 | **Đã giải quyết** phần đo. Chưa có KPI-12 theo tổ trong bảng "So sánh tổ" (góp ý #6) |
| Trả lời trên oa.zalo.me không biết ai (04 #15) | BC-09, dòng "Trả lời ngoài VClinks" | **Đã giải quyết** |
| Excel không ghi nguồn, giờ chốt, định nghĩa (04 #17, 06 #11) | BC-19 sheet "Tóm tắt" + "Định nghĩa" | **Đã giải quyết** |
| Số đã gửi Ban giám đốc tự đổi (05 #7, 06 #2) | BC-15, BC-16, MH-BC-09 số chụp bất biến, chụp bổ sung có lý do | **Phần lớn.** Số **quý** lấy bằng bản tháng cuối quý, sai với chỉ số dòng chảy (góp ý #1) |
| Mốc kỳ không có Quý (06 #10) | MH-BC-01 #6 có "Quý này", "Quý trước", "Từ đầu năm" | **Có nút**, nhưng số chụp quý sai như trên |
| Số VClinks không có dòng khớp VCsales (05 #2, 06 #3) | BC-11 "lấy nguyên, không tính lại", ghi giờ lấy | **Chưa.** Lấy nguyên thì đúng, nhưng không có khối đối chiếu, không nói so với báo cáo nào của VCsales, và UAT-BC-23 chỉ so VClinks với VClinks (góp ý #2) |
| OA / kênh chung có ra đơn không (04 #3) | Trỏ sang 04 MH-OA-17 | **Chưa.** 07 chỉ đo tốc độ, không có doanh số theo nguồn kênh |
| Giá trị báo giá đang mở (05 #20, GD-03) | KPI-15 | **Hoãn sang GĐ2** (góp ý #12) |
| Không biết quy tắc chia có công bằng không (05 #19) | MH-RT-05 "Kết quả chia", KPI-24, lý do bị bỏ qua | **Đã giải quyết** cho khách chưa có owner |
| Không có người duyệt thay khi giám đốc vắng (04 #12) | Không nhắc tới đề xuất quy tắc chia | **Chưa** (góp ý #11) |
| Tóm tắt sáng thứ Hai cho giám đốc (06 #14) | Q-BC-13 chỉ nói tới GS, mặc định "không" | **Chưa** (góp ý #14) |

## Một tháng của tôi

| Mốc | Tôi làm gì | Màn hình | Ra được quyết định không? Mất bao lâu? |
|---|---|---|---|
| **Thứ Hai 07:45**, trước họp giám sát | Mở Báo cáo, cần "tuần trước, số chụp" để cả phòng họp nhìn cùng một số | MH-BC-01, MH-BC-04 | Mặc định của tôi là **"Tháng này · Số hiện tại"**. Tôi phải đổi kỳ sang "Tuần trước" và chọn "Số chụp" mỗi tuần. Được, khoảng 1 phút, nhưng giám sát mở trên máy họ thì lại ra "Tuần này" |
| Thứ Hai 08:00, họp | So sánh tổ: tổ nào tụt | MH-BC-04 #3 | **Được một nửa.** Có FRT, % quá SLA kèm Δ. Nhưng Δ chỉ có ở % quá SLA, FRT và tỷ lệ chốt không có. Không có xu hướng nhiều tuần: một tuần tụt 4 điểm là tai nạn hay là xu hướng, tôi không biết. Tổ HN1 nhiều nick cá nhân (hạn 15′), tổ HCM1 nhiều OA (hạn 30′), so thẳng % quá SLA là không công bằng |
| Thứ Hai 08:20 | Hỏi "tổ nào để khách hỏi giá OA chờ quá hạn owner?" | MH-BC-04 #2 | Có tổng "Hỏi giá owner quá hạn 2", **không có theo tổ** trong bảng so sánh. Phải bấm vào từng tổ |
| **Giữa tháng** | Mở thêm khu vực Đà Nẵng: tổ ĐN1 hai người, khách miền Trung về tổ này từ 01/11 | MH-RT-01…03, 05 MH-MK-08 | **Rủi ro cao.** Tôi sửa 07 xong, chạy lại 30 ngày, áp dụng. Nhưng khách lạ ở Đà Nẵng nhắn Fanpage là **lead**, đi theo 05 MH-MK-08, và bộ đó tôi quên sửa. Không màn nào nhắc. Chạy lại 30 ngày cho tổ mới gần như không có dữ liệu Đà Nẵng. Phần lớn khách OA có khu vực "Chưa rõ" nên vẫn rơi vào "Còn lại" của HN1 |
| Giữa tháng, sau khi áp dụng | Theo dõi xem quy tắc mới có chạy đúng không | MH-RT-05 | Phải tự vào xem. Nếu quy tắc sai làm khách dồn vào "Chưa phân công", tôi chỉ biết khi GS kêu. Muốn quay về v3 thì "Khôi phục thành bản nháp" lại **bắt chạy thử** lần nữa |
| Giữa tháng | Hương gửi đề xuất: chuyển khách Long Biên sang tổ HN2 cho gần | MH-RT-04 | **Hương không gửi được**: đề xuất chỉ được sửa quy tắc có nhóm nhận thuộc tổ mình, mà việc này đụng tới tổ HN2. Hương sẽ nhắn Zalo riêng cho tôi, tức là quay lại cách cũ |
| **Ngày 1 tháng sau** | Tháng 10 so tháng 9: FRT, % quá SLA, tỷ lệ chốt theo tổ | MH-BC-09 "So sánh" | FRT, % quá SLA thì được. **Tỷ lệ chốt thì sai hướng:** lứa báo giá tháng 10 mới 0–30 ngày, lứa tháng 9 đã có thêm một tháng để chốt. Tháng nào cũng thấy "tụt" |
| Ngày 2–3 | Đối chiếu với VCsales trước khi gửi anh Thọ Anh | MH-BC-04, Excel | **Không làm được.** Không có dòng "Tổng báo giá VCsales cùng kỳ" hay "Doanh số division theo VCsales" để thấy VClinks phủ bao nhiêu phần. "Báo giá đã gửi" đếm theo ngày gửi qua VClinks, VCsales đếm theo ngày tạo. Hai số chắc chắn lệch mà không ai giải thích được |
| **Cuối quý** | Số quý gửi Ban giám đốc | MH-BC-09 loại "Quý" | **Sai.** BC-15 lấy bản tháng cuối quý làm số quý, tức FRT quý = FRT tháng 9. Mô hình dữ liệu `report_snapshots.periodType` cũng chỉ có `week \| month` |

## Góp ý

| # | Màn / quy tắc / KPI | Góp ý | Vì sao | Đề xuất | Mức |
|---|---|---|---|---|---|
| 1 | BC-15, MH-BC-09 #1, §9 `report_snapshots` | **Số chụp quý = bản tháng cuối quý.** Cách này đúng với số tồn (tuổi nợ ở 06), nhưng **sai** với số dòng chảy: lượt chờ, FRT, % quá SLA, báo giá gửi của quý phải tính trên cả ba tháng. `periodType` không có `quarter` | Báo cáo quý là báo cáo tôi gửi Ban giám đốc. Nếu FRT quý thực ra là FRT tháng 9 thì khi bị hỏi tôi mất uy tín ngay | Thêm `periodType = quarter`, chụp 02:00 ngày đầu quý sau, **tính lại từ lượt của cả quý** (trung vị quý không phải trung bình ba trung vị, như BC-14). Số tồn (tức thời) thì mới lấy theo cuối kỳ. §3 ghi rõ chỉ số nào là "dòng chảy", chỉ số nào là "tồn". Thêm UAT (UAT-BC-GD-01) | **Chặn** |
| 2 | BC-11, KPI-13, KPI-16, MH-BC-04 #1, UAT-BC-23 | **Không có khối đối chiếu VCsales.** "Lấy nguyên" mới là điều kiện cần. Tôi còn cần thấy số VClinks **phủ bao nhiêu** so với VCsales. KPI-13 đếm theo **ngày gửi qua VClinks**, VCsales thường báo theo **ngày tạo báo giá**. Chưa nói so với báo cáo nào của VCsales | Câu đầu tiên tôi bị hỏi: "Số này khớp VCsales không?". Tỷ lệ chốt 38% trên VClinks, VCsales ra 25%: không có dòng giải thích thì cuộc họp dừng ở đó | Thêm khối "Đối chiếu VCsales" ở MH-BC-04 và sheet "Tóm tắt" của Excel: **Báo giá tạo trên VCsales trong kỳ** · trong đó **đã gửi qua VClinks** (% phủ) · **Doanh số division theo VCsales** · trong đó của khách có hội thoại VClinks trong kỳ. Mỗi dòng ghi tên báo cáo VCsales dùng để so và trường ngày dùng để lọc. KPI-13 ghi rõ trong tooltip: "đếm theo ngày gửi qua VClinks, không phải ngày tạo trên VCsales". Thêm UAT so với một báo cáo VCsales có tên (UAT-BC-GD-02) | **Chặn** |
| 3 | RT-01 (c), Q-BC-10, MH-RT-01 #4, 05 MH-MK-08 | **Mở khu vực mới phải sửa hai bộ quy tắc ở hai màn**: khách lạ là lead (05 `/leads/rules`), khách đã có mã KH chưa có owner đi 07. Hai bộ không nhìn thấy nhau, "Thử một khách" của 07 chỉ trả "sẽ tạo lead — xem Quy tắc giao lead" | Khi mở Đà Nẵng, tôi sẽ sửa một bên và quên bên kia. Khách miền Trung sẽ về HN1, còn tổ mới ngồi không. Không màn nào báo. Người chịu hậu quả là tôi | Chốt **Q-BC-10 phương án B** (một màn `/settings/routing`, hai nhóm quy tắc "Lead" và "Khách chưa có owner" dùng chung điều kiện khu vực). Nếu vẫn chọn A: (a) "Thử một khách" chạy **cả hai** động cơ và nói khách đi nhánh nào, tới ai; (b) khi áp dụng một bộ có **khu vực mới** mà bộ kia chưa có, cảnh báo "Khu vực {…} có ở quy tắc chia khách nhưng chưa có ở quy tắc giao lead" kèm link; (c) Lịch sử hai bộ hiện chung một dòng thời gian | **Chặn** |
| 4 | KPI-14, BC-13, BC-15, MH-BC-09 "So sánh" | **Tỷ lệ chốt so hai lứa khác tuổi.** Lứa tháng này mới 0–30 ngày, lứa tháng trước đã được thêm một tháng. Số chụp lúc 02:00 ngày 1 lại cố định lứa khi còn non, nên dải vàng "Số hiện tại khác số chụp" sẽ hiện **mãi** | Mọi tháng đều "tụt" rồi tự "tăng" khi xem lại, nên chỉ số này thành nhiễu. Tôi dễ trách nhầm tổ | Tính tỷ lệ chốt **theo tuổi cố định**: "Chốt trong 14 ngày" và "Chốt trong 30 ngày" từ lúc gửi. Δ chỉ so hai lứa cùng tuổi. Số chụp tháng M ghi "Chốt trong 30 ngày" của lứa **tháng M−1** (đã đủ tuổi). Tỷ lệ chốt không đưa vào đếm chênh lệch của dải vàng | **Nên sửa** |
| 5 | BC-05, KPI-16, BC-21 | **Hai cách gán doanh số.** Báo giá gán **owner VClinks**, doanh số lấy theo **"NV phụ trách" VCsales**. Lúc owner vừa đổi mà VCsales chưa đổi (02 MH-DK-12 còn chờ), báo giá của tổ A thành doanh số của tổ B | Bảng so sánh tổ sẽ có tổ "gửi nhiều báo giá, không có doanh số" và ngược lại. Hai GS sẽ cãi nhau trong phòng họp | Ghi một luật: doanh số theo tổ = NV phụ trách VCsales, **map sang tổ theo cây tổ chức lúc đơn** (BC-21). Dòng cảnh báo "{n} account có owner VClinks khác NV phụ trách VCsales" kèm link tới danh sách việc đổi NV phụ trách (02 MH-DK-12). Tooltip KPI-16 ghi rõ khác KPI-13 ở điểm này | **Nên sửa** |
| 6 | MH-BC-04 #3 "So sánh tổ" | Bảng thiếu những cột tôi cần để so công bằng và để hỏi GS. Δ chỉ có ở % quá SLA | % quá SLA của tổ nhiều nick cá nhân (hạn 15′) không so thẳng được với tổ nhiều OA (hạn 30′). Tổ ít người mà nhiều lượt thì chậm là đương nhiên | Thêm cột: **Lượt / NVKD / ngày làm việc**, % quá SLA **tách theo loại lượt** (Nick cá nhân · Kênh chung · Hỏi giá owner, KPI-12), **Chưa trả lời > 24h**, **Báo giá treo** (GĐ2). Có Δ cho FRT và tỷ lệ chốt. Mẫu số nhỏ ghi "(n = …)" như §3.6 | **Nên sửa** |
| 7 | MH-BC-01 #6, #8, MH-BC-04 | Họp thứ Hai cần **một cái nhìn cố định** và **xu hướng**. Mặc định của GD là "Tháng này · Số hiện tại". Một Δ không phân biệt được tai nạn một tuần với xu hướng | Mỗi thứ Hai tôi và 3 GS phải cùng nhìn một số. Nếu mỗi người tự chọn kỳ thì số sẽ khác nhau | Mốc nhanh **"Họp tuần: Tuần trước · Số chụp"** cho GS, GD (một bấm, link chia sẻ được). Bảng so sánh tổ có cột **xu hướng 8 tuần** (sparkline FRT, % quá SLA) lấy từ số chụp tuần | **Nên sửa** |
| 8 | RT-10, MH-RT-05 #8 "Khôi phục thành bản nháp" | **Không có đường lùi khẩn cấp**, và **không có theo dõi sau áp dụng**. Khôi phục v3 vẫn bắt chạy thử lại. Sau khi áp dụng, không có gì báo nếu quy tắc mới làm dồn "Chưa phân công" | Quy tắc sai lúc 08:00 thì tới 10:00 đã có vài chục khách chờ. Lúc đó tôi cần một nút, không phải một quy trình | (a) Nút **"Quay về v{n−1} ngay"** trong **24 giờ** đầu sau áp dụng: không cần chạy thử (bản đó đã chạy thật), vẫn bắt lý do và ghi nhật ký. (b) **Cảnh báo sau áp dụng** trong 2 ngày làm việc đầu, gửi GD: "Chưa phân công tăng {x}% so với 7 ngày trước", "Quy tắc {tên} chưa chia hội thoại nào sau {n} giờ làm", "Một người nhận > 50%" | **Nên sửa** |
| 9 | RT-12 (c), MH-RT-03 "Chạy bộ mẫu" | **Lỗ an toàn**: MH-RT-03 ghi chạy bộ khách mẫu "tính là đã chạy thử (RT-10 a)". Vậy một dòng mẫu đã đủ mở khóa "Áp dụng" kể cả khi division có hàng trăm hội thoại. RT-12 (c) lại nói bộ mẫu chỉ dùng khi dưới 20 hội thoại | Bước "bắt chạy lại 30 ngày" là lý do tôi yên tâm để GS đề xuất. Có đường vòng thì bước đó mất tác dụng | Division có ≥ 20 hội thoại trong 30 ngày: bộ mẫu **không** thay được "Chạy lại". Bộ mẫu chỉ là thêm (hữu ích khi mở khu vực mới, xem #10). Thêm UAT (UAT-RT-GD-05) | **Nên sửa** |
| 10 | MH-RT-03 #5 bảng so sánh | Chạy lại chỉ cho **số đếm theo quy tắc, theo người**. Mở tổ mới thì tôi cần biết **tải** và **độ phủ khu vực** | Tổ ĐN1 hai người nhận 40 hội thoại / ngày là hỏng ngay tuần đầu. Nếu 60% khách có khu vực "Chưa rõ" thì quy tắc theo khu vực chỉ là hình thức | Thêm vào kết quả chạy lại: **hội thoại / người / ngày làm việc** (trung bình, ngày cao nhất); **% hội thoại khu vực "Chưa rõ"** trên từng quy tắc có điều kiện khu vực; số hội thoại **ngoài giờ** sẽ dồn vào đầu giờ (RT-09). Cảnh báo RT-13 thêm "Một người nhận > {n} hội thoại / ngày" | **Nên sửa** |
| 11 | MH-RT-04 #1, RT-11, 04 #12 | Đề xuất của GS **chỉ được đụng tổ mình**. Không đề xuất được việc chuyển khu vực giữa hai tổ, là loại đề xuất hay gặp nhất. Không có **người duyệt thay** khi tôi vắng | GS sẽ quay lại nhắn Zalo riêng, còn đề xuất thì nằm chờ lúc tôi đi thị trường 3 ngày | (a) Cho GS gửi **đề xuất dạng mô tả** ("Chuyển Long Biên từ HN1 sang HN2") không kèm sửa quy tắc. GD dựng vào bản nháp; GS tổ bị ảnh hưởng nhận thông báo "Để biết". (b) GD **ủy quyền có thời hạn** việc áp dụng quy tắc chia cho một GS khác hoặc Ban giám đốc (người gửi đề xuất không tự áp dụng, PQ-27). (c) Đề xuất chờ quá 3 ngày làm việc thì nhắc GD | **Nên sửa** |
| 12 | KPI-15, MH-BC-04 #1, GD-03 | "Giá trị báo giá đang mở" để GĐ2, trong khi KPI-13, 14 đã lên MVP "khi có TT-01" và dùng cùng nguồn `QuoteShare` + trạng thái VCsales | Giữa tháng, đây là số sớm nhất cho tôi biết tháng này có ra tiền không | Đưa KPI-15 lên MVP cùng điều kiện với KPI-13, 14 (có TT-01). Biểu đồ phễu để GĐ2 cũng được | **Gợi ý** |
| 13 | BC-13, Q-BC-08, MH-BC-03 #3 | Có Δ, có ngưỡng tô vàng 20%, nhưng **không có mục tiêu** của division (FRT ≤ …, % quá SLA ≤ …) | Họp cần nói "đạt / chưa đạt mục tiêu", không chỉ "tăng / giảm" | GD đặt mục tiêu theo division (tùy chọn theo tổ) cho KPI-05, 06, 12 ở MH-RT-06 hoặc `/settings/sla`. Thẻ số có dòng "Mục tiêu {x}" và vạch trên sparkline (#7). Q-BC-08 dùng luôn mục tiêu này làm ngưỡng tô | **Gợi ý** |
| 14 | Q-BC-13, 00 MH-UI-03 | Tóm tắt sáng chỉ nhắc tới GS và mặc định "không". GD không có (06 #14 chưa xử lý) | Tôi không muốn thêm chuông. Tôi chỉ cần một bản đọc trên điện thoại trước khi vào họp | Thông báo **08:00 thứ Hai** cho GD, GS: so sánh tổ tuần trước (số chụp) + Δ, "Hỏi giá owner quá hạn" theo tổ, đề xuất quy tắc đang chờ, cảnh báo sau áp dụng (#8). Bấm vào mở mốc "Họp tuần" (#7) | **Gợi ý** |

**Tổng:** 14 góp ý: **3 Chặn** (#1, #2, #3), **8 Nên sửa** (#4–#11), **3 Gợi ý** (#12–#14).

## Quyết định tôi nghiêng về

| Mã | Tôi chọn | Lý do của người giữ doanh số và sửa quy tắc |
|---|---|---|
| **Q-BC-01** (QĐ-07) | **A**, đồng ý BA | Sale đi thị trường trả lời bằng điện thoại vẫn là trả lời. Cột "% qua VClinks" để theo dõi, không trừ điểm |
| **Q-BC-02** (QĐ-53) | **A**, đồng ý BA | Doanh số theo owner, giống VCsales. Người trực thay được ghi công ở cột "Trả lời hộ" là đủ |
| **Q-BC-03** (QĐ-50) | **A + B, N2**, đồng ý BA | Danh sách "tin không cần trả lời" do tôi cấu hình để "ok em" không làm xấu số |
| **Q-BC-05** (QĐ-48) | **A**: khu vực → tổ, trong tổ vòng tròn; loại khách "Đại lý" là ngoại lệ | Đúng cách tôi đang chia bằng tay. Nhưng xem #10: phải biết tỷ lệ "Chưa rõ" khu vực |
| **Q-BC-06** | **A** | Ban giám đốc xem tới tổ. Hỏi về một người thì hỏi tôi. Soi từng NVKD từ trên xuống làm GS mất quyền quản lý |
| **Q-BC-08** | **20%**, nhưng thay bằng **mục tiêu division** khi có (#13) | Ngưỡng cố định không hợp với kênh có hạn SLA khác nhau |
| **Q-BC-09** | **A** cho số của VClinks; **phần VCsales** (báo giá, doanh số) chụp **cùng giờ với TS-HD-11** (17:30 ngày làm việc cuối kỳ) | Số VCsales trên báo cáo của tôi và báo cáo thu nợ của kế toán phải cùng giờ chốt, không thì hai bản gửi Ban giám đốc lệch nhau |
| **Q-BC-10** | **B: gộp** hai bộ quy tắc vào một màn | Xem #3. Mở khu vực mới là việc của một người, nên một chỗ sửa là đủ. Nếu dev chưa kịp làm B thì bắt buộc làm (a), (b) của #3 |
| **Q-BC-11** | **B** (từ nấc thứ hai) | Thu hồi ở 30 ngày quá gắt với phụ tùng có chu kỳ dài, sale sẽ phản đối |
| **Q-BC-12** | **30′**, đồng ý | Kênh chung giờ cao điểm có thể cần 15′, xem lại sau 1 tháng chạy thật |
| **Q-BC-13** | **B** cho **cả GD và GS**, chỉ thứ Hai (xem #14) | Một bản tóm tắt tuần, không phải chuông mỗi ngày |
| **Q-BC-14** | **A**, đồng ý | Ca riêng từng người là việc của nhân sự, tôi không muốn GS phải cài |
| **Q-BC-15** | **A**, đồng ý | Hiện giờ trực tuyến sẽ bị hiểu là chấm công, nhân viên phản ứng mà tôi không được gì |
| **Q-BC-16** | **A** (GĐ3) | Không ảnh hưởng quyết định bán hàng |

## UAT tôi muốn thêm

| Mã đề xuất | Tiền điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| UAT-BC-GD-01 Số chụp quý tính trên cả quý | Seed lượt tháng 7: FRT trung vị 20′; tháng 8: 15′; tháng 9: 10′ (mỗi tháng 100 lượt) | Thắng mở MH-BC-09 loại "Quý", Q3/2026, "Xem" | FRT quý = trung vị **300 lượt** (không phải 10′ của tháng 9, không phải trung bình 15′); `periodType = quarter`; lượt chờ quý = 300 |
| UAT-BC-GD-02 Đối chiếu VCsales | VCsales mock: 10 báo giá tạo trong Tuần BC, 3 trong số đó gửi qua VClinks; 1 báo giá tạo tuần trước, gửi qua VClinks trong Tuần BC | Thắng mở MH-BC-04, Kỳ = Tuần BC | Khối "Đối chiếu VCsales": "Báo giá tạo trên VCsales **10** · đã gửi qua VClinks **3** (30%)"; thẻ "Báo giá đã gửi" = **4** kèm tooltip "đếm theo ngày gửi qua VClinks"; dòng tên báo cáo VCsales và giờ lấy; Excel "Tóm tắt" có cùng dòng |
| UAT-BC-GD-03 Tỷ lệ chốt cùng tuổi | Lứa tháng 8: 10 báo giá, 3 chốt trong 30 ngày, thêm 2 chốt sau ngày 30; lứa tháng 9: 10 báo giá, 4 chốt trong 30 ngày | Thắng so sánh số chụp tháng 10 với tháng 9 | "Chốt trong 30 ngày": lứa T9 **40%**, lứa T8 **30%**, Δ **▲10 điểm**; không dùng 50% (T8 đã quá 30 ngày) |
| UAT-RT-GD-04 Mở khu vực mới, hai bộ quy tắc | Có tổ ĐN1 (2 người); Thắng thêm quy tắc "Miền Trung → ĐN1" ở `/settings/routing`, **chưa** sửa quy tắc giao lead | (1) "Thử một khách": khách lạ, Fanpage, khu vực Đà Nẵng. (2) Bấm "Áp dụng…" | (1) Kết quả nói rõ "Khách này sẽ tạo lead → Quy tắc giao lead → {tổ / người}", **không** chỉ "xem Quy tắc giao lead". (2) Modal có cảnh báo "Khu vực Đà Nẵng có ở quy tắc chia khách nhưng chưa có ở quy tắc giao lead" + link |
| UAT-RT-GD-05 Bộ mẫu không thay chạy lại | TD-RT-H (24 hội thoại / 30 ngày ≥ 20) | Thắng sửa quy tắc 2, chạy **Bộ khách mẫu** 1 dòng, bấm "Áp dụng…" | "Áp dụng…" vẫn khóa, tooltip "Chạy lại 30 ngày trước khi áp dụng. Bộ khách mẫu chỉ dùng thêm." |
| UAT-RT-GD-06 Quay về bản trước ngay | v4 áp dụng 08:00, quy tắc 1 nhóm nhận là tổ không ai Trực tuyến | 09:30 Thắng bấm "Quay về v3 ngay", nhập lý do | Không yêu cầu chạy thử; v3 hiệu lực ngay (thành v5 = bản sao v3); nhật ký `config.routing.restore` có lý do; sau 24 giờ nút này không còn |
| UAT-RT-GD-07 Cảnh báo sau áp dụng | Như trên nhưng không quay về | Chờ 2 giờ làm việc | Thắng nhận "Chưa phân công của {tổ} tăng {x}% so với 7 ngày trước sau khi áp dụng v4" và "Quy tắc {tên} chưa chia hội thoại nào sau 2 giờ làm" |
| UAT-RT-GD-08 Đề xuất liên tổ | Hương (GS HN1), Đức (GS HN2) | Hương gửi đề xuất dạng mô tả "Chuyển Long Biên từ HN1 sang HN2" | Thắng thấy đề xuất ở tab "Đề xuất"; Đức nhận thông báo "Để biết"; Thắng dựng vào bản nháp, chạy lại, áp dụng; Hương nhận "Đề xuất DX-… đã được áp dụng" |
| UAT-RT-GD-09 Ủy quyền áp dụng khi vắng | Thắng ủy quyền cho Đức 3 ngày; Hương gửi đề xuất | Đức đưa đề xuất vào nháp, chạy lại, áp dụng | Đức áp dụng được; nhật ký "áp dụng thay cho Thắng"; hết 3 ngày Đức mất quyền; đề xuất **của chính Đức** thì Đức không áp dụng được |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/07-P-GD.md) | — |
