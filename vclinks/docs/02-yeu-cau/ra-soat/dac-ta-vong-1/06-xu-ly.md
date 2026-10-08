# Xử lý góp ý vòng 1 — 06 Hóa đơn VAT và công nợ

Phiên bản 1.1 · 04/10/2026 · Trạng thái: Lưu trữ (đã xử lý)

## Tóm tắt

- BA xử lý góp ý vòng 1 cho đặc tả 06 Hóa đơn VAT và công nợ ngày 29/09/2026, đưa đặc tả lên v1.1. Nguồn: P-KT (15 góp ý, 3 Chặn), P-KD (14, 3 Chặn), P-GD (14, 5 Chặn).
- Tổng 43 góp ý: Đã sửa 40, Hỏi chủ dự án 3 (HD-CH-9, HD-CH-10, QĐ-01), không góp ý nào bị bỏ.
- 11 góp ý Chặn đều có lời giải trong v1.1; riêng phần "làm việc trên điện thoại" của P-KD #3 chờ QĐ-01.
- Quy tắc mới chính: HD-48 nạp người nhận thanh toán, HD-49 báo khi hồ sơ xuất HĐ đổi, HD-50 mốc sao kê, HD-51 báo trước owner mọi lần nhắc nợ, HD-55 / HD-56 chip quá hạn và ghi chú thu nợ, HD-57 / HD-58 tuổi nợ, số chụp cuối kỳ và đối chiếu VCsales.
- Câu hỏi cho chủ dự án: HD-CH-1…8 kèm ý kiến ba vai (đổi đề xuất ở HD-CH-5, HD-CH-6), thêm HD-CH-9 (trần tin nhắc nợ) và HD-CH-10 (kế toán tạo phiếu không tin nguồn); 13 thông số TS-HD-01…13.
- Kèm 14 việc cho designer (D1–D14), việc chuyển sang 00–04, VCsoft, pháp chế, và bảng hợp nhất UAT đề xuất thành các ca UAT-HD-59…93.
- Còn mở: khoảng chờ TS-HD-01 2 giờ (P-KD, BA) hay 4 giờ (P-GD); duyệt một lần chiến dịch định kỳ chờ QĐ-60; pháp chế Q-HD-03, Q-HD-11, Q-HD-12.

## Mục lục

- [Bảng xử lý](#bảng-xử-lý)
- [Câu hỏi cho chủ dự án](#câu-hỏi-cho-chủ-dự-án)
- [Việc cho designer](#việc-cho-designer)
- [Việc chuyển file khác](#việc-chuyển-file-khác)
- [UAT đề xuất đã hợp nhất](#uat-đề-xuất-đã-hợp-nhất)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

> Đặc tả: `docs/02-yeu-cau/dac-ta/06-hoa-don-cong-no.md` (nay là **v1.1**) · Góp ý: `06-P-KT.md` (Hà, kế toán — 15 góp ý, 3 Chặn), `06-P-KD.md` (Minh, NVKD — 14 góp ý, 3 Chặn), `06-P-GD.md` (Thắng, giám đốc bán hàng — 14 góp ý, 5 Chặn) · BA xử lý ngày 29/09/2026 theo bước 3 của `docs/02-yeu-cau/README.md`.
>
> **Nguyên tắc lọc đã áp:** (1) Không bỏ nguyên tắc bắt buộc: VClinks không tự xuất hóa đơn, không ghi công nợ / thanh toán vào VCsales (N1, N2, BR12); mọi tin tới khách do người bấm gửi, trừ ZNS tự động đã duyệt (N3); không gửi hàng loạt qua nick cá nhân (BR14); kế toán không đọc chat (N4). (2) Góp ý đổi nghiệp vụ, vai trò, phạm vi → **Hỏi chủ dự án** (HD-CH-9, HD-CH-10) hoặc trỏ quyết định chung đã có (QĐ-01 điện thoại, QĐ-15 cảnh báo công nợ ở MVP, QĐ-60 duyệt chiến dịch định kỳ một lần, QĐ-67 ngân sách tin). BA không tự chốt các QĐ đó. (3) Con số mới ghi thành thông số `TS-HD-n` (bảng ở cuối), chạy theo đề xuất tới khi chốt. (4) Kênh gửi, chiến dịch, màn duyệt thuộc 04; 06 đặc tả nội dung, 04 đặt vào màn (mục "Việc chuyển file khác").
>
> **Tổng:** 43 góp ý · **Đã sửa 40** · **Hỏi chủ dự án 3** (HD-CH-9, HD-CH-10, QĐ-01) · Chuyển designer 0 làm chính (14 việc designer đi kèm các dòng Đã sửa, xem cuối file) · Chuyển file khác 0 làm chính (các dòng Đã sửa kéo theo việc ở 00, 01, 02, 03, 04, xem cuối file) · Không làm 0 (một phần của P-KT #10 và P-KD #3 chờ quyết định, có ghi).
>
> **Mức Chặn (11):** P-KT #1, #2, #3 · P-KD #1, #2, #3 · P-GD #1, #2, #3, #4, #5 — đều đã có lời giải trong v1.1; riêng P-KD #3 phần "làm việc trên điện thoại" chờ QĐ-01, phần tối thiểu (việc "Khách xin hóa đơn · chưa có phiếu") đã sửa.

## Bảng xử lý

| Nguồn | Mức | Tóm tắt góp ý | Kết quả | Chỗ sửa hoặc lý do |
|---|---|---|---|---|
| P-KT #1 | Chặn | Ngày đầu dùng không khách nào có người liên hệ thanh toán; không nạp được hàng loạt; người biết SĐT kế toán garage là sale | **Đã sửa** | HD-48 (nhập VCsales S8 / Excel có xem trước, "Nhờ owner bổ sung", gợi ý chủ garage, báo KT khi người khác đổi); màn mới **MH-HD-12**; MH-HD-07 #11; MH-HD-09 #2; §7.2 S8 theo lô. UAT-HD-59; story HD-US-15. Việc designer D1 |
| P-KT #2 | Chặn | Hồ sơ xuất HĐ đổi / ngừng dùng thì phiếu đang mở và HĐ chưa gửi theo MST cũ không bị báo | **Đã sửa** | HD-49; MH-HD-03 #3a (dải đỏ + "Dùng hồ sơ mới" / "Giữ hồ sơ cũ"); MH-HD-05 #1 (cảnh báo, bắt xác nhận); MH-HD-06 ⚠; MH-HD-02 nút "Hồ sơ vừa đổi"; MH-HD-09 #4 (hộp báo số phiếu / HĐ bị ảnh hưởng). UAT-HD-60; story HD-US-19 |
| P-KT #3 | Chặn | Tiền khách vừa chuyển mà kế toán chưa nhập sao kê thì tin vẫn đòi đủ | **Đã sửa** | N11; HD-50 (mốc sao kê: chiến dịch chờ tới khi kế toán xác nhận trong ngày, không tự gửi; giờ gửi mặc định TS-HD-09 = 10:30; tin có `{so_lieu_tinh_toi}` + câu "xin bỏ qua nếu đã thanh toán sau"; nhắc lẻ cảnh báo khi hôm nay chưa xác nhận); HD-33 sửa; MH-HD-07 #10; §2.4 bước 4b. UAT-HD-62; story HD-US-18. Tham số mẫu → 04 |
| P-KT #4 | Nên sửa | "Thu trong 7 ngày" không khớp VCsales; thiếu cắt kỳ, chi tiết số chứng từ | **Đã sửa** | HD-58 (cắt kỳ theo ngày thu hoặc ngày nhắc, cửa sổ 7 / 14 / 30, "Tính lại", bỏ mốc "chốt 16:00", sheet chi tiết có số chứng từ, dòng "Theo VCsales"); MH-HD-10 #2, #2a, #5, #6; §7.2 S10. UAT-HD-70, UAT-HD-56 (sửa chữ) |
| P-KT #5 | Nên sửa | "Sao chép tất cả" thiếu mã đơn / mã phiếu; không rõ VCinvoice khớp theo trường nào; xin I6 ở M2; thiếu hình thức thanh toán | **Đã sửa** | MH-HD-03 #4 (hình thức TT, dòng "Hàng hóa theo đơn VCsales"), #5 (chép theo thứ tự ô VCinvoice + dòng Ghi chú mã đơn / mã phiếu), #10 (I6 dùng cả ở M2); §9.3 câu 5 hỏi VCsoft trường khớp; HD-CH-1 ghi đề nghị I6 trước I7. UAT-HD-69 |
| P-KT #6 | Nên sửa | Không rõ ai chịu trách nhiệm gửi một HĐ; owner và KT cùng nhận nhắc, ai cũng tưởng người kia gửi | **Đã sửa** | HD-21 (người gửi phụ trách: owner nếu chỉ nick, KT nếu có kênh chính thức; mốc N chỉ người phụ trách, 2N người còn lại + giám sát); MH-HD-06 cột + "Nhận gửi" / "Giao cho"; MH-HD-11 #15. UAT-HD-71, UAT-HD-33 (sửa) |
| P-KT #7 | Nên sửa | HD-36 (a) coi mọi tin trong 7 ngày là phản hồi thanh toán, tin đặt hàng lọt vào hộp kế toán | **Đã sửa** | HD-36 (a1) 2 giờ đầu sau tin mẫu, (a2) trong 7 ngày chỉ khi AI xếp "Công nợ – hóa đơn" hoặc có ảnh chứng từ; "Không phải thanh toán" dạy AI. UAT-HD-63 |
| P-KT #8 | Nên sửa | Khách trả lời đối chiếu công nợ không có kết quả "xác nhận / không đồng ý số dư" | **Đã sửa** | HD-60; §2.5; MH-HD-08 #8, #9; MH-HD-07 cột "Đối chiếu kỳ", lọc "Đối chiếu chưa xác nhận"; Excel danh sách xác nhận. Giá trị chứng từ: ⚠ Q-HD-11 (pháp chế). UAT-HD-67 |
| P-KT #9 | Nên sửa | ERP mất kết nối mà đồng hồ hạn và nhắc vẫn chạy → nhắc giả | **Đã sửa** | HD-52 (dừng đồng hồ HD-13, HD-21, HD-41 cho việc phụ thuộc ERP; ghi Hoạt động; M2 "Đánh dấu đã phát hành, chờ khớp", tự đối chiếu khi có lại); MH-HD-03 hành động, #12. UAT-HD-68 |
| P-KT #10 | Nên sửa | Không thấy "đơn đã giao chưa có HĐ, chưa có phiếu"; kế toán không được tạo phiếu | **Hỏi chủ dự án** (HD-CH-10) | Phần xem đã sửa: MH-HD-02 tab "Đơn chưa có HĐ" (#8) + "Nhờ owner tạo phiếu", cột "Ngày giao sớm nhất"; §7.2 S1 mở rộng. Kế toán tự tạo phiếu không tin nguồn đổi vai trò ở HD-01 → HD-CH-10; tới khi chốt nút ẩn. Thời hạn xuất theo ngày giao: ⚠ Q-HD-03. UAT-HD-72 |
| P-KT #11 | Nên sửa | Sửa được MST trong cùng hồ sơ; đổi hồ sơ mặc định không ai báo kế toán | **Đã sửa** | HD-10 (khóa MST khi hồ sơ đã dùng ≥ 1 HĐ; đổi mặc định / ngừng dùng / sửa → báo KT, áp HD-49); MH-HD-09 #4. UAT-HD-61 |
| P-KT #12 | Nên sửa | Mẫu trả lời thanh toán thiếu tham số số tiền, ngày | **Đã sửa** | HD-40 (`{so_tien_nhan}` `{ngay_nhan}` `{con_no}` `{so_lieu_tinh_toi}` lấy từ VCsales lúc gửi, không gõ tay; không có khoản khớp → mẫu "Đã nhận" khóa); MH-HD-08 #10. UAT-HD-73. Tham số mẫu → 04 MH-OA-11 |
| P-KT #13 | Gợi ý | Đầu tháng 40 phiếu quá hạn cùng lúc, trưởng nhóm nhận 40 thông báo | **Đã sửa** | HD-13 (báo gộp tối đa 2 lượt / ngày; hạn riêng 3 ngày làm việc đầu tháng TS-HD-12; sắp theo ngày giao); MH-HD-11 #20. UAT-HD-93 |
| P-KT #14 | Gợi ý | VCinvoice mất kết nối cả buổi, phải nhớ quay lại gửi từng HĐ | **Đã sửa** | HD-61 "Gửi khi VCinvoice có lại": lệnh do người bấm (người duyệt), chỉ kênh chính thức / ZNS, kiểm HD-17 trước khi gửi, hết hạn 21:00, trong 08:00–21:00. MH-HD-05 hành động, trạng thái; §2.5 trạng thái gửi mới. UAT-HD-90 |
| P-KT #15 | Gợi ý | Mục "AI phát hiện" lẫn với trả lời nhắc nợ | **Đã sửa** | MH-HD-08 #2 (nhóm trả lời nhắc nợ / đối chiếu lên trước, lọc Nguồn nhiều lựa chọn) |
| P-KD #1 | Chặn | Nhắc lẻ không báo owner; không có quyền giữ lại khi đang chốt đơn | **Đã sửa** | N10; HD-51 (mọi lần nhắc, lẻ và chiến dịch, báo trước owner; khoảng chờ TS-HD-01 = 2 giờ làm việc; "Tôi tự nhắc" / "Xin giữ lại" / "Đồng ý"; hết giờ không bấm thì gửi; "Xin giữ lại" không bao giờ bị gửi ngược, KT đồng ý hoặc giám đốc quyết; "Gửi gấp" cho KT có lý do, owner vẫn được báo trước); màn mới **MH-HD-13**; MH-HD-04 #15; MH-HD-07 #9, #12; §2.4 bước 4. UAT-HD-74, 76, 89; story HD-US-16. Việc designer D2 |
| P-KD #2 | Chặn | Không tự loại khi owner đang có báo giá mở / vừa chat với khách | **Đã sửa** | HD-30 (g): báo giá gửi trong TS-HD-03 (3 ngày làm việc) chưa chốt, hoặc tin 2 chiều trong TS-HD-02 (4 giờ) → chiến dịch loại lúc gửi, lẻ cảnh báo; KT thấy lý do và giờ, không thấy nội dung; chặn hoãn nối tiếp; §7.2 S11. UAT-HD-74, 75 |
| P-KD #3 | Chặn | Không có gì cho điện thoại; khách xin hóa đơn lúc sale ở garage thì lại chụp màn hình | **Hỏi chủ dự án** (QĐ-01) — phần tối thiểu **Đã sửa** | HD-54 việc "Khách xin hóa đơn · chưa có phiếu" (kể cả khi sale trả lời bằng app Zalo) ở hộp thư "Của tôi" + tab Việc; §2.2 bước 1c; KD-17 ghi rõ phần phụ thuộc QĐ-01 (A: không; B: MH-HD-01 một cột, gửi HĐ từ thông báo, khối công nợ 360). MH-HD-13 thiết kế dùng được ở 375 px. UAT-HD-79; story HD-US-23 |
| P-KD #4 | Nên sửa | Chỉ chọn được đơn đã giao; khách xin HĐ lúc hàng đang đi | **Đã sửa** | HD-59 (trạng thái "Chờ giao hàng", tự sang "Chờ kế toán" khi VCsales báo giao, không tính hạn); §2.5; HD-03; MH-HD-01 #5; MH-HD-02 tab. Xuất trước khi giao: ⚠ Q-HD-12. UAT-HD-64 |
| P-KD #5 | Nên sửa | Nợ quá hạn chỉ thấy khi mở tab panel; không rõ được bán tiếp không | **Đã sửa** | HD-55 (chip trên khung chat + bước báo giá, không chặn; bán tiếp theo hạn mức VCsales, N2 / N10); MH-HD-04 #13. MVP hay GĐ2: QĐ-15. UAT-HD-78; story HD-US-20 |
| P-KD #6 | Nên sửa | Hai người (owner, KT) cùng trả lời một khách, không ai thấy người kia | **Đã sửa** | HD-63 (hiển thị chéo không nội dung; tin phàn nàn → ẩn "Gửi mẫu" của KT; phân vai số tiền / quan hệ); MH-HD-08 #2, #3, #10; MH-HD-04 #18; §2.4 bước 8. UAT-HD-81 |
| P-KD #7 | Nên sửa | Owner tự nhắc qua nick nhưng không có công cụ, không được ghi nhận | **Đã sửa** | HD-53 (mẫu `/nhac-no-nhe` chèn số từ VCsales, không tự gửi, hỏi lại khi số khác; ghi một lần nhắc; "Tôi đã nhắc (ngoài VClinks)"; khách ra khỏi nhắc tự động 7 ngày); MH-HD-04 #16. UAT-HD-77; story HD-US-17 |
| P-KD #8 | Nên sửa | Cần cài đặt theo account "Owner nhắc trước, kế toán nhắc sau" | **Đã sửa** | HD-62; MH-HD-09 #6; HD-30 (j). Owner đề nghị, KT duyệt, từ chối thì chuyển giám đốc. UAT-HD-91 |
| P-KD #9 | Nên sửa | Kế toán gửi HĐ cho khách của tôi mà tôi không được báo, dễ gửi trùng | **Đã sửa** | HD-22 (báo owner, đóng thông báo cũ, bỏ chip "chưa gửi"; modal hiện "Đã gửi … bởi …"); §2.2 bước 10b; MH-HD-05 #1. UAT-HD-80 |
| P-KD #10 | Nên sửa | Khách hỏi "hóa đơn đâu": phải gõ tay trả lời, nhắn riêng hối kế toán | **Đã sửa** | MH-HD-04 #17 "Trả lời khách" (mẫu theo trạng thái, không tự gửi) và "Hối kế toán" (1 lần / phiếu / ngày, ghi Hoạt động); MH-HD-03 #12. UAT-HD-82 |
| P-KD #11 | Gợi ý | Phải tích "đã đối chiếu" cả khi chọn hồ sơ đã lưu không đổi | **Đã sửa** | HD-06 (chỉ bắt khi có trường AI hoặc khác hồ sơ); MH-HD-01 #22. UAT-HD-65 |
| P-KD #12 | Gợi ý | Thiếu email thì chỉ khóa nút, không có cách hỏi khách nhanh | **Đã sửa** | MH-HD-01 #25 "Hỏi khách phần còn thiếu" (chèn mẫu, không tự gửi; AI điền tiếp vào nháp dạng gợi ý, N6); HD-03. UAT-HD-66 |
| P-KD #13 | Gợi ý | Không đặt được người nhận TT ngay từ tin của chị kế toán garage trong nhóm; người chỉ có Zalo không đặt được | **Đã sửa** | MH-HD-09 hành động "Đặt làm người nhận thanh toán" từ menu tin / tên trong nhóm; HD-29 (SĐT V2+ chỉ bắt buộc cho ZNS; người chỉ có Zalo nhận hóa đơn, nhắc qua owner). UAT-HD-92 |
| P-KD #14 | Gợi ý | Bị báo giám sát khi HĐ chưa gửi dù không phải lỗi mình | **Đã sửa** | HD-21 (mốc N chỉ người phụ trách, kèm nút nhanh "Khách lấy bản giấy" / "Khách đã nhận qua email" / "Gửi ngay"; thông báo giám sát ghi đã nhắc ai lúc nào). UAT-HD-33 (sửa) |
| P-GD #1 | Chặn | Không có tuổi nợ theo tổ / NVKD; nấc dừng ở > 30 | **Đã sửa** | HD-57 (Chưa đến hạn · 1–30 · 31–60 · 61–90 · > 90, gom tổ → NVKD → khách, căn theo VCsales); MH-HD-10 tab "Tuổi nợ" (#5b, bấm ô ra MH-HD-07 lọc sẵn); MH-HD-07 #2, #3 (lọc Tổ); MH-HD-11 #7; §7.2 S9; §9.3 câu 6. UAT-HD-83; story HD-US-21. Việc designer D8 |
| P-GD #2 | Chặn | Không lưu số cuối kỳ nên không so tháng / quý | **Đã sửa** | HD-57 (c) số chụp cuối ngày làm việc cuối tháng (TS-HD-11 = 17:30), ưu tiên API số dư theo kỳ của VCsales; `debt_snapshots`; Δ kỳ trước trên mọi thẻ (MH-HD-10 #1). UAT-HD-84 |
| P-GD #3 | Chặn | Không có dòng số khớp VCsales | **Đã sửa** | HD-58 (a); MH-HD-10 #2a khối "Theo VCsales" (tổng công nợ, quá hạn, thu trong kỳ lấy nguyên; tách từ khách được nhắc / không nhắc); §7.2 S9, S10. UAT-HD-70, 83 |
| P-GD #4 | Chặn | Không có luồng "khách nợ quá hạn vẫn đặt hàng"; không có chỗ ghi thỏa thuận thu nợ | **Đã sửa** | N10; §2.4 đoạn mới; HD-55 (chip không chặn; báo KT + GS khi báo giá ≥ TS-HD-08 cho khách quá hạn > 60 ngày); HD-56 "Ghi chú thu nợ" dùng chung; MH-HD-04 #13, #14; MH-HD-07 cột; MH-HD-09 #7. Quyết định cho nợ thêm vẫn trên VCsales. UAT-HD-78, 85 |
| P-GD #5 | Chặn | Tạm hoãn cho khách chiến lược do kế toán quyết một mình | **Đã sửa** | HD-31 (a) lý do "Khách chiến lược / đang đàm phán": owner / GS đề nghị kèm ghi chú thu nợ, **GĐ duyệt**, ≤ TS-HD-06 = 30 ngày, gia hạn duyệt lại; (b) KT từ chối → owner "Chuyển giám đốc quyết"; (c) không dừng tuổi nợ; MH-HD-07 #9, hành động; MH-HD-10 tab "Tạm hoãn". UAT-HD-85, 86; story HD-US-22 |
| P-GD #6 | Nên sửa | Màn duyệt chiến dịch nhắc nợ thiếu số tiền và rủi ro | **Đã sửa** | HD-65 (tổng tiền theo nhóm tuổi, top 20, khách có ghi chú, owner chưa trả lời, kết quả lần trước tiền thu / chi phí, "Loại khách này"). Đặt vào màn: chuyển 04 MH-OA-13. UAT-HD-87 |
| P-GD #7 | Nên sửa | Owner không có thời hạn xin loại; chiến dịch duyệt ngay sau khi gửi | **Đã sửa** | HD-51 (e): "Duyệt" khóa tới khi mọi owner đã trả lời hoặc hết khoảng chờ; người duyệt thấy đã xem / chưa xem. Khoảng chờ dùng chung TS-HD-01; **P-GD đề xuất 4 giờ, P-KD và BA đề xuất 2 giờ** → chủ dự án sửa số ở TS-HD-01 nếu muốn. UAT-HD-87 |
| P-GD #8 | Nên sửa | Chưa rõ nhắc nợ có tính vào trần 2 tin / 7 ngày không | **Hỏi chủ dự án** (HD-CH-9) | Đổi chính sách tần suất của 04 OA-29. Tới khi chốt chạy theo đề xuất B: HD-64 (trần riêng, cảnh báo vừa nhận tin marketing). UAT-HD-88 |
| P-GD #9 | Nên sửa | Thu nợ không chia theo tổ / owner / chi phí tin | **Đã sửa** | MH-HD-10 #5a (theo tổ → owner, kênh gồm owner tự nhắc, chi phí từ MH-OA-19, tiền thu / 1.000 ₫ chi phí, đối chứng thô) |
| P-GD #10 | Nên sửa | Kỳ chỉ có tháng | **Đã sửa** | MH-HD-10 #1 (Quý này, Quý trước, Từ đầu năm, "So với kỳ trước"). UAT-HD-84 |
| P-GD #11 | Nên sửa | Excel không ghi nguồn và giờ | **Đã sửa** | MH-HD-10 #6 (sheet Tóm tắt: giờ lấy VCsales / VCinvoice, số chụp, giờ tính, định nghĩa, dòng Theo VCsales; sheet Chi tiết thu nợ, Tuổi nợ) |
| P-GD #12 | Gợi ý | Danh sách công nợ thiếu cột Tổ, Ghi chú thu nợ, Người duyệt tạm hoãn | **Đã sửa** | MH-HD-07 #4 (Tổ, Ghi chú thu nợ, Tạm hoãn kèm người duyệt, Đối chiếu kỳ); GD có nút duyệt tạm hoãn chiến lược (#9) |
| P-GD #13 | Gợi ý | Chỉ số thành công không có thu nợ | **Đã sửa** | §1.1 mục tiêu 7, 8 và chỉ số thu nợ (quá hạn > 60 theo tổ, 0 lần nhắc ngoài ý owner với khách chiến lược, số lần "đụng nhau", % khách có người nhận TT) — đề xuất, chốt khi UAT |
| P-GD #14 | Gợi ý | Cần bản tóm tắt tuần thay chuông báo | **Đã sửa** | HD-66 (thông báo sáng thứ Hai 07:30, một thông báo, tắt được). Email tóm tắt: không làm ở GĐ2 (VClinks chưa gửi email, cùng lý do HD-CH-8) |

### Lo ngại vòng 04 mà P-KT đánh giá "giải quyết một phần" / "chưa"

| Lo ngại (04-P-KT) | Xử lý ở v1.1 |
|---|---|
| #3 Hồ sơ đổi không báo phiếu đang mở | HD-49 (P-KT #2) |
| #7 Chưa rõ ai gửi | HD-21 người gửi phụ trách (P-KT #6) |
| #9 Chưa nạp được người nhận | HD-48, MH-HD-12 (P-KT #1) |
| #10 Tiền vừa chuyển chưa ghi | HD-50 (P-KT #3) |
| #12 Quy tắc (a) quá rộng | HD-36 sửa (P-KT #7) |
| #13 Duyệt một lần chiến dịch định kỳ | Vẫn chờ **QĐ-60** (04 CH-6); không đổi trong 06 |
| #17 Báo cáo nhắc nợ chưa khớp VCsales | HD-58 (P-KT #4) |
| H7 Đối chiếu chưa có kết quả phù hợp | HD-60 (P-KT #8) |

### Câu hỏi của người dùng trong góp ý

| Nguồn | Câu hỏi | Trả lời / xử lý |
|---|---|---|
| P-KD Q1 | Kế toán nhắc lẻ khách của tôi có báo trước không, trước bao lâu, tôi giữ lại hay chỉ xin? | Có, mọi lần (HD-51), trước TS-HD-01 = 2 giờ làm việc. "Xin giữ lại" chặn tin; kế toán đồng ý hoặc giám đốc quyết, không ai gửi ngược ý bạn khi giám đốc chưa quyết. Kế toán "Gửi gấp" được (lý do), bạn vẫn được báo trước khi tin đi, và không dùng được khi bạn đã xin giữ lại |
| P-KD Q2 | Khách quá hạn vẫn đặt: được bán tiếp không, ai quyết, VClinks chặn không? | VClinks chỉ cảnh báo, không chặn (HD-55, N10). Bán tiếp theo hạn mức tín dụng trên VCsales. Khách quá hạn > 60 ngày có báo giá lớn → kế toán và giám sát được báo |
| P-KD Q3 | Gửi phiếu cho đơn chưa giao được không? | Được, phiếu "Chờ giao hàng", tự chuyển kế toán khi giao (HD-59). Xuất trước khi giao: chờ pháp chế Q-HD-12 |
| P-KD Q4 | Khách trả lời nhắc nợ trên OA khi tôi ở ngoài: ai trả lời trước; đọc OA trên điện thoại? | Phân vai HD-63: số tiền, chứng từ → kế toán (mẫu); thái độ, quan hệ → owner. Tin phàn nàn chỉ owner trả lời. Đọc OA trên điện thoại: QĐ-01 |
| P-KD Q5 | Nhắc nợ, phiếu hóa đơn có tính vào chỉ số của tôi; giám sát xem theo người? | Đặc tả không đặt KPI cho NVKD. MH-HD-10 có bảng theo người tạo phiếu (% cần bổ sung, % thay thế) để kèm cặp; v1.1 cho GS xem trong tổ mình. Muốn đưa vào KPI là quyết định của chủ dự án khi chốt chỉ số (chưa mở câu hỏi riêng) |
| P-KD Q6 | Tôi tự nhắc qua Zalo có được ghi nhận để kế toán không nhắc thêm? | Có (HD-53): khách ra khỏi nhắc tự động 7 ngày |
| P-KT lo ngại #13 | Duyệt một lần chiến dịch đối chiếu đầu tháng | QĐ-60 (04 CH-6), chưa chốt |

## Câu hỏi cho chủ dự án

> Tới khi chốt, đặc tả chạy theo **BA đề xuất**. HD-CH-1…8 đã có ở v1.0; dưới đây gộp ý kiến ba vai. P-KD không chọn phương án cho HD-CH-1…8 (ý của P-KD ở 03 P-KD #18 đã tính vào HD-CH-3).

1. **HD-CH-1 — Mức tích hợp VCinvoice** (§21 câu 19, 24).
   - A. M1: VCinvoice mở API nhận phiếu + đọc hóa đơn + sự kiện phát hành.
   - B. M2: chỉ đọc hóa đơn, PDF, link; kế toán lập HĐ trên VCinvoice từ phiếu VClinks; VClinks tự gắn HĐ.
   - C. M3: chưa có API; kế toán gắn số HĐ và tải PDF tay.
   - **P-KT:** B, làm sẵn C; xin I6 (link sâu điền sẵn) trước I7; điều kiện là chốt VCinvoice khớp HĐ theo trường nào. **P-GD:** B, làm C trước; không đòi M1.
   - **BA đề xuất B, làm C để chạy ngay, và đề nghị VCsoft làm I6 sớm, tách khỏi I7** (bỏ khoảng 200 lần dán mỗi đầu tháng, rẻ hơn M1). Cần VCsoft trả lời §9.3 câu 5.

2. **HD-CH-2 — Tin nhắc nợ ghi tổng hay từng khoản.**
   - A. Tổng còn nợ đến hạn + số khoản + hạn sớm nhất; chi tiết qua link đối chiếu.
   - B. Mỗi khoản một tin.
   - C. Tổng + tối đa 3 khoản.
   - **P-KT:** A, kèm "số liệu tính tới {giờ}". **P-GD:** A, nhưng tách số quá hạn và số đến hạn.
   - **BA đề xuất A, tách `{so_qua_han}` / `{so_den_han}`, có `{so_lieu_tinh_toi}` = mốc sao kê** (HD-27, HD-50). Cần sale admin nộp lại mẫu ZNS có các tham số này.

3. **HD-CH-3 — Bản nhanh "Gửi cho kế toán" lên MVP?**
   - A. Có (MH-HD-01 bản nhanh + MH-HD-02/03 tối giản, gắn HĐ kiểu M3).
   - B. Không, để GĐ2.
   - **P-KT:** A, giữ trường bắt buộc, "Gắn hóa đơn" kiểu M3, cảnh báo "MST khác lần trước" dựa trên phiếu đã có. **P-GD:** A. **P-KD** (03 #18): A.
   - **BA đề xuất A, thêm ba ý của P-KT và việc HD-54** ("Khách xin hóa đơn · chưa có phiếu") vào bản nhanh.

4. **HD-CH-4 — Kế toán gõ tin tự do trả lời khách về thanh toán?**
   - A. Chỉ mẫu loại "Thanh toán" đã duyệt, kênh chính thức, trong khung; ngoài ra nhờ owner.
   - B. Cho gõ tự do trên kênh chính thức, trong hội thoại có phản hồi thanh toán.
   - **P-KT:** A, nếu mẫu có tham số số tiền (đã sửa HD-40). **P-GD:** A trong GĐ2; sau 1 tháng xem số lần "Nhờ owner trả lời" và thời gian owner trả lời rồi mới xét B.
   - **BA đề xuất A**, xem lại sau 1 tháng theo chỉ số P-GD nêu.

5. **HD-CH-5 — Gửi hóa đơn cho nhiều khách một lần?**
   - A. Gửi từng HĐ, "chuyển sang HĐ kế tiếp".
   - B. "Gửi hóa đơn hàng loạt" qua kênh chính thức, mục đích Hóa đơn, mẫu đã duyệt, người bấm là người duyệt, không cần giám đốc duyệt.
   - **P-KT:** B từ GĐ2, không chờ QĐ-60 (đầu tháng 40 HĐ ≈ 120 lần bấm). **P-GD:** B với điều kiện chỉ kênh chính thức, mẫu đã duyệt, người bấm, **tính vào ngân sách ZNS và có hạn mức ngày**; chưa có trần thì A.
   - **BA đề xuất (sửa so với v1.0): B từ GĐ2 theo điều kiện của P-GD**, không qua nick cá nhân, gắn với ngân sách và hạn mức ZNS lẻ / người / ngày của **QĐ-67**. QĐ-67 không chọn trần cứng thì giữ A.

6. **HD-CH-6 — Nguồn tra MST.**
   - **P-KT:** VCinvoice trước, rồi VCsales master data. **P-GD:** VCsales trước (nguồn sự thật về khách), rồi VCinvoice. Cả hai: không dùng nguồn ngoài, không cào trang tra cứu.
   - **BA đề xuất (sửa so với v1.0):** VCsales master data để điền và so; dịch vụ tra của VCinvoice (nếu có) để xem tình trạng hoạt động; không nguồn ngoài.

7. **HD-CH-7 — Email VCinvoice đã gửi có tính là "đã gửi"?**
   - **P-KT:** tính, nhưng email lỗi / bị trả về thì "Chưa gửi", vẫn nhắc, có chip riêng. **P-GD:** đồng ý BA (tính, không ghi ngược).
   - **BA đề xuất:** tính khi gửi thành công; lỗi / bị trả về → "Chưa gửi" + chip "Email VCinvoice lỗi" (cần I9 trả được lỗi); không ghi ngược sang VCinvoice.

8. **HD-CH-8 — VClinks tự gửi email hóa đơn trước GĐ3?**
   - **P-KT, P-GD:** để GĐ3.
   - **BA đề xuất:** giữ GĐ3.

9. **[Mới] HD-CH-9 — Nhắc thanh toán / đối chiếu công nợ có tính vào trần "2 tin chăm sóc / 7 ngày" của 04 OA-29?** (P-GD #8). Tính chung thì tin nhắc bảo dưỡng của marketing lấy mất lượt nhắc nợ; không trần thì khách có thể nhận 4 tin một tuần.
   - A. Tính chung một trần.
   - B. Trần riêng: 1 tin / khoản / 7 ngày (OA-29 mẫu + đối tượng) và tối đa 2 tin mục đích thanh toán / account / 7 ngày trên mọi OA; không tính vào trần chăm sóc; cảnh báo khi khách vừa nhận tin marketing trong 3 ngày.
   - C. Không trần cho nhắc nợ.
   - **BA đề xuất B** (HD-64). Chốt xong 04 ghi lại OA-29.

10. **[Mới] HD-CH-10 — Kế toán có được tạo phiếu "Xuất mới" không có tin nguồn cho đơn đã giao mà chưa ai xin hóa đơn?** (P-KT #10). Hiện HD-01 không cho (kế toán không có tin nguồn). Sale quên, khách không đòi thì đơn nằm đó.
    - A. Không. Kế toán chỉ thấy tab "Đơn chưa có HĐ" và "Nhờ owner tạo phiếu".
    - B. Được, khi khách có hồ sơ xuất HĐ mặc định; ghi chú nguồn bắt buộc (vd. "Xuất gộp tháng theo thỏa thuận"); owner được báo.
    - C. Như B, và hệ thống nhắc theo ngày giao khi sắp quá thời hạn xuất theo luật.
    - **BA đề xuất B.** C chỉ sau khi pháp chế trả lời Q-HD-03.

**Quyết định chung đã có, 06 chỉ trỏ tới (không mở câu mới):** **QĐ-01** điện thoại (P-KD #3: bản điện thoại của MH-HD-01, gửi HĐ từ thông báo, khối công nợ 360); **QĐ-15** cảnh báo công nợ quá hạn lên MVP (HD-55); **QĐ-60** duyệt một lần chiến dịch định kỳ (đối chiếu công nợ đầu tháng — P-KT lo ngại #13); **QĐ-67** ngân sách và hạn mức ZNS (HD-CH-5); **QĐ-03** ZNS lẻ ở MVP (nhắc lẻ, gửi HĐ qua ZNS chỉ có khi ZNS lẻ đã chạy); **TT-01** API VCsales (S8…S11).

### Thông số đề xuất (gộp vào Bảng thông số của `quyet-dinh-chu-du-an.md`)

| Mã | Thông số | Đề xuất | Ghi chú | Chỗ dùng |
|---|---|---|---|---|
| TS-HD-01 | Khoảng chờ owner trước mỗi lần nhắc nợ / đối chiếu (lẻ và chiến dịch) | 2 giờ làm việc | P-KD đề xuất 2 giờ; **P-GD đề xuất 4 giờ** cho chiến dịch | HD-51 |
| TS-HD-02 | "Owner vừa chat với khách" | Tin 2 chiều trong 4 giờ, mọi kênh | | HD-30 g |
| TS-HD-03 | "Báo giá mở" | Báo giá gửi trong 3 ngày làm việc, chưa chốt / chưa hủy | Tránh hoãn mãi (P-GD) | HD-30 g |
| TS-HD-04 | Hạn owner "Tôi tự nhắc" | 1 ngày làm việc | Quá hạn trả về kế toán | HD-53 |
| TS-HD-05 | "Xin giữ lại" tối đa | 3 ngày làm việc; giám đốc quyết trong 1 ngày làm việc | Dài hơn → tạm hoãn | HD-51 |
| TS-HD-06 | Tạm hoãn "Khách chiến lược" tối đa | 30 ngày, gia hạn giám đốc duyệt lại | P-GD | HD-31 |
| TS-HD-07 | Chip quá hạn trên hội thoại | Từ 1 ngày quá hạn; đỏ từ 30 ngày | P-KD muốn > 0; P-GD muốn ≥ 30 → hai mức màu | HD-55 |
| TS-HD-08 | Báo KT + GS khi báo giá cho khách quá hạn > 60 ngày | ≥ 50.000.000 ₫ | P-GD để "X triệu" | HD-55 |
| TS-HD-09 | Giờ gửi mặc định chiến dịch nhắc nợ / đối chiếu | 10:30 | Sau giờ nhập sao kê (P-KT) | HD-50 |
| TS-HD-10 | Cửa sổ thu sau nhắc; cắt kỳ | 7 ngày; theo ngày thu | | HD-58 |
| TS-HD-11 | Giờ chụp số cuối kỳ | 17:30 ngày làm việc cuối tháng | Sau giờ làm (TS-01) | HD-57 |
| TS-HD-12 | Hạn phiếu 3 ngày làm việc đầu tháng | 2 ngày làm việc | Ngày thường giữ 1 ngày | HD-13 |
| TS-HD-13 | Đơn đã giao chưa có HĐ tô đỏ | Sau 3 ngày | Không phải thời hạn luật (Q-HD-03) | MH-HD-02 #8 |

## Việc cho designer

| # | Màn | Việc |
|---|---|---|
| D1 | MH-HD-12 Người nhận thanh toán (mới) | Hai tab Theo dõi / Nạp: dải tiến độ 5 số, bảng khách chưa có, nút "Nhờ owner bổ sung"; bước nạp: chọn nguồn, bảng xem trước có bộ đếm theo kết quả, xác nhận. Trạng thái S8 chưa có (chỉ Excel) |
| D2 | MH-HD-13 Báo trước nhắc nợ (mới) | Modal 520 px và màn một cột 375 px: đồng hồ đếm ngược, số tiền + mốc sao kê, ghi chú thu nợ, xem trước tin thu gọn, ba nút lớn; form "Xin giữ lại"; màn kết quả sau khi chọn / hết giờ |
| D3 | MH-HD-07 Công nợ | Dải "Sao kê đã ghi tới …" (ba màu: có mốc / hôm nay chưa có / chiến dịch đang chờ); dải "{n} khách chưa có người nhận TT"; nấc theo nhóm tuổi mới; cột Tổ, Ghi chú thu nợ (một dòng dưới tên khách), Đối chiếu kỳ, người duyệt tạm hoãn; các tag lý do "✖" mới; nút "Gửi gấp" trong dropdown của "Nhắc (1 khách)" |
| D4 | MH-HD-04 Panel 360 + khung chat | Chip "Quá hạn {n} ngày · {tiền}" trên đầu khung chat (vàng / đỏ); khối Công nợ thêm dòng "Kế toán sẽ nhắc lúc … còn …", Ghi chú thu nợ + popover thêm, nút "Tôi tự nhắc khách"; dòng phiếu có "Trả lời khách" / "Hối kế toán"; dòng "Kế toán đã gửi mẫu … lúc …" |
| D5 | MH-HD-03 Chi tiết phiếu | Dải đỏ "Hồ sơ xuất HĐ vừa đổi" với hai nút; dòng Hình thức thanh toán, chú thích hàng hóa; nút "Đánh dấu đã phát hành, chờ khớp" và trạng thái "chờ khớp VCinvoice" |
| D6 | MH-HD-05 Gửi hóa đơn | Cảnh báo đỏ MST khác hồ sơ hiện tại + ô tích + link tạo phiếu thay thế; dòng "Đã gửi qua … bởi …"; trạng thái VCinvoice mất kết nối có nút "Gửi khi VCinvoice có lại" |
| D7 | MH-HD-06, MH-HD-02 | MH-HD-06: cột "Người gửi phụ trách" + menu Nhận gửi / Giao cho, nút nhanh "Tôi phụ trách gửi", chip "Email VCinvoice lỗi". MH-HD-02: tab "Chờ giao hàng" (chip viền cam), tab "Đơn chưa có HĐ" với chọn nhiều "Nhờ owner tạo phiếu", cột "Ngày giao sớm nhất" |
| D8 | MH-HD-10 Báo cáo | Khối "Theo VCsales" ở đầu (3 thẻ + dòng tách); tab Tuổi nợ dạng bảng tổ → NVKD mở rộng, mỗi ô tiền + số khách, cột Δ có mũi tên; tab Tạm hoãn; bảng Thu nợ theo tổ → owner; chọn cửa sổ và cắt kỳ; nút "Tính lại"; mốc kỳ quý |
| D9 | MH-HD-08 Phản hồi thanh toán | Nhóm nguồn trong danh sách, tag "Khách phàn nàn"; bộ kết quả riêng cho "Đối chiếu công nợ" có ô "Số khách báo"; dòng "Owner đã trả lời lúc …"; xem trước mẫu có số tiền từ VCsales |
| D10 | MH-HD-09 Hóa đơn & thanh toán | Ô MST khóa + gợi ý tạo hồ sơ mới; hộp báo phiếu / HĐ bị ảnh hưởng khi lưu; khối "Cách nhắc nợ" (chờ duyệt); danh sách Ghi chú thu nợ; dòng "Chưa dùng được cho ZNS" cho người nhận chỉ có Zalo |
| D11 | MH-HD-01 Tạo phiếu | Tag "Chưa giao" trên dòng đơn + chú thích "Chờ giao hàng"; ô tích đối chiếu ẩn / hiện theo điều kiện; nút "Hỏi khách phần còn thiếu" ở chân drawer |
| D12 | Hộp thư "Của tôi" (00 / 03) | Chip "Xin hóa đơn" trên dòng hội thoại và nút lọc nhanh "Xin hóa đơn chưa có phiếu ({n})"; mục "Đặt làm người nhận thanh toán" trong menu tin / tên người trong nhóm |
| D13 | 04 MH-OA-13 màn duyệt (mục đích thanh toán) | Khối tiền theo nhóm tuổi, top 20, khách có ghi chú, owner chưa trả lời; "Duyệt" khóa kèm đếm ngược; "Loại khách này" trên dòng; trạng thái chiến dịch "Chờ xác nhận sao kê" |
| D14 | MH-HD-11 Cấu hình | Nhóm các ô mới (#12–#20) theo khối: Phối hợp owner · Cảnh báo sale · Báo cáo · Hạn phiếu |

## Việc chuyển file khác

| File | Việc | Nguồn góp ý |
|---|---|---|
| **00** | MH-UI-07: chip công nợ quá hạn ở dải cảnh báo đầu khung chat; menu tin / tên người "Đặt làm người nhận thanh toán". MH-UI-10 / "Của tôi": chip và lọc "Xin hóa đơn chưa có phiếu". MH-UI-03: loại thông báo "Báo trước nhắc nợ" (nhóm Gấp, đẩy lên điện thoại nếu có), "Tóm tắt tuần" GD, thông báo gộp phiếu quá hạn. MH-UI-09 #13: các loại việc mới. §2.1: menu "Người nhận thanh toán" | P-KD #3, #5, #13; P-KT #1, #13; P-GD #14 |
| **01** | Khóa mới / sửa: `debt.notice.respond` (KD `CT`, GS `TỔ`); `debt.hold` duyệt "Khách chiến lược" và quyết tranh chấp chỉ GD `DV`; `debt.note` (thêm / đọc: KD, GS, GD, KT; đọc: SA, XEM; CS ✖); `debt.urgent_send`, `statement.confirm` (KT `DV`); `billing_contact.import` (KT, SA `DV`); `report.invoice` thêm GS `TỔ`; `invoice_req.create` cho KT chờ HD-CH-10. PQ-23 / N4: ghi rõ "Ghi chú thu nợ" và lý do "Owner đang trao đổi (giờ)" không phải nội dung chat | P-KD #1, #2; P-GD #4, #5; P-KT #1, #3, #10 |
| **02** | Người liên hệ chỉ có Zalo làm người nhận hóa đơn (không ZNS); "Cách nhắc nợ" trên account; "Ghi chú thu nợ" ở tab "Hóa đơn & thanh toán"; tạo người liên hệ từ thành viên nhóm Zalo; DK-33 mở rộng báo trước mọi lần nhắc nợ | P-KD #8, #13; P-GD #4; P-KD #1 |
| **03** | MH-SZ-07 panel và luồng báo giá (F9.6): chip quá hạn, nhắc lại ở bước gửi báo giá, báo KT + GS với báo giá lớn; nút "Tôi tự nhắc khách" + mẫu `/nhac-no-nhe`; HD-54 áp cho tin từ app Zalo (khớp SZ-21); Q21 / QĐ-15 dùng HD-55 | P-KD #3, #5, #7; P-GD #4 |
| **04** | OA-36 cho mục đích thanh toán / đối chiếu: thay `Xin loại` bằng ba lựa chọn HD-51 + khoảng chờ; MH-OA-13: giờ mặc định TS-HD-09, trạng thái "Chờ xác nhận sao kê", lý do loại mới, màn duyệt khóa tới khi hết khoảng chờ + khối tiền HD-65; MH-OA-12: nhắc lẻ qua báo trước, dòng mốc sao kê, "Gửi gấp"; MH-OA-11: tham số `{so_qua_han}` `{so_den_han}` `{so_lieu_tinh_toi}`, `{so_tien_nhan}` `{ngay_nhan}` `{con_no}`; OA-29 theo HD-CH-9; MH-OA-14 "Đã thanh toán" dùng cắt kỳ HD-58 | P-KD #1; P-KT #3, #12; P-GD #6, #7, #8 |
| **quyet-dinh-chu-du-an.md** | Thêm HD-CH-9, HD-CH-10 vào danh sách QĐ; gộp TS-HD-01…13 vào Bảng thông số; ghi ý kiến ba vai cho HD-CH-1…8 (HD-CH-5, HD-CH-6 đổi đề xuất) | Tất cả |
| **VCsoft (§9.3)** | Câu 5 (trường khớp HĐ – đơn, thứ tự ô, I6 trước I7), câu 6 (nhóm tuổi, S8 theo lô, S9, S10, S11), câu 7 (NV phụ trách, tổ) | P-KT #5; P-GD #1, #3; P-KD #2 |
| **Pháp chế / kế toán (§9.2)** | Q-HD-11 (xác nhận đối chiếu qua chat có làm chứng từ không), Q-HD-12 (xuất trước khi giao) | P-KT #8; P-KD #4 |

## UAT đề xuất đã hợp nhất

| Đề xuất | Thành ca |
|---|---|
| P-KT (12 ca) | UAT-HD-59, 60, 61, 62, 63, 67, 68, 69, 70, 71, 72, 73; thêm UAT-HD-90 (#14), 93 (#13) |
| P-KD UAT-HD-KD-01…08 | 74 (KD-01), 75 (KD-02), 64 (KD-03), 78 (KD-04, gộp GD-3), 79 (KD-05), 80 (KD-06), 81 (KD-07), 82 (KD-08); thêm 65, 66, 76, 77, 91, 92 |
| P-GD UAT-HD-GD-1…7 | 83 (GD-1), 84 (GD-2), 78 (GD-3), 85 (GD-4), 86 (GD-5), 87 (GD-6), 88 (GD-7, chờ HD-CH-9); 70 dùng chung với P-KT |
| BA | 89 (Gửi gấp) |
| Sửa ca cũ | UAT-HD-33 (người gửi phụ trách), UAT-HD-35 (nấc mới), UAT-HD-36 (báo trước thay OA-36), UAT-HD-38 (đã xác nhận sao kê), UAT-HD-56 (tên chỉ số) |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 1.1 | 04/10/2026 13:41 | Claude Code | Hồi tố theo CLAUDE.md §13: thêm Tóm tắt, Mục lục, dòng trạng thái | Chủ dự án yêu cầu làm đủ hồ sơ rà soát 04/10/2026 13:41 |
| — | 04/10/2026 13:35 | Claude Code | Cập nhật đường dẫn tài liệu theo cấu trúc `docs/` mới; nội dung không đổi | Chủ dự án duyệt cấu trúc docs/ 04/10/2026 13:35 |
| 1.0 | 30/09/2026 | — | Bản gốc (xem git log --follow -- docs/02-yeu-cau/ra-soat/dac-ta-vong-1/06-xu-ly.md) | — |
