"""Cây lĩnh vực v2 — 8 khối × 4 tầng (Phân loại VCwiki v2 ngày 26/09/2026, mục 3–9; VCWIKI context
`phan-loai-vcwiki-v2`; khối 7 tách từ 0.5 ngày 27/09/2026). Nạp bằng `scripts/seed_tree_v2.py`.

Tầng 1–2 lấy nguyên bảng của tài liệu (mã, slug, "Gồm", "Dễ nhầm với → xếp về"); tầng 3 lấy cột "Tầng 3", slug sinh
từ tên; tầng 4 mới mở mẫu ở SEO (mục 4). Scope note tầng 2 dựng từ hai cột trên; dòng "Ví dụ thẻ" và scope note
tầng 3 viết sau (bước A3). Nhánh nạp mang `scheme = "v2"`; cây cũ giữ nguyên để thẻ cũ không hỏng.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from . import db

EXAMPLES_PENDING = "(bổ sung sau — bước A3)"

# (mã, slug, tên, mô tả, [(mã, slug, tên, gồm, dễ nhầm → xếp về, [tầng 3...]), ...])
TREE = [
    ("0", "nen", "Nền ngành ô tô",
     "Kiến thức nền ngành ô tô — môn học đầu tiên của thực tập sinh và nhân sự mới", [
         ("0.1", "nen.ky-thuat", "Kỹ thuật ô tô", "Cấu tạo, nguyên lý, chẩn đoán, sửa chữa, bảo dưỡng",
          "Vận hành xưởng → 0.3; sản phẩm OBD của VCPV → 7",
          ["Cấu tạo & nguyên lý hệ thống", "Chẩn đoán & OBD", "Sửa chữa & bảo dưỡng định kỳ", "Xe điện & hybrid",
           "Dụng cụ & an toàn xưởng"]),
         ("0.2", "nen.phu-tung", "Phụ tùng & thị trường aftermarket",
          "Mã phụ tùng, thương hiệu, phân khúc, nguồn cung, thị trường VN, quy định kinh doanh phụ tùng",
          "Kỹ năng bán phụ tùng → 2.2; kế hoạch mua → 6.1",
          ["Mã & tra cứu (OE / OEM / aftermarket, VIN, catalog)", "Thương hiệu & phân khúc chất lượng",
           "Chuỗi cung ứng phụ tùng (Tier-1, nhập khẩu)", "Thị trường aftermarket VN & đối thủ",
           "Quy định kinh doanh phụ tùng"]),
         ("0.3", "nen.garage", "Dịch vụ garage",
          "Mô hình, vận hành xưởng, cố vấn dịch vụ, năng suất KTV, quy định xưởng",
          "Marketing cho gara → 1; phần mềm VCgarage → 7",
          ["Mô hình & vận hành xưởng", "Tiếp nhận – chẩn đoán – báo giá – bàn giao", "Quản lý KTV & năng suất",
           "Mở & mở rộng gara", "Định giá dịch vụ & quy định xưởng"]),
         ("0.4", "nen.nghe", "Nghề & hướng nghiệp",
          "Bản đồ nghề, lộ trình, học nghề, thị trường lao động ngành",
          "Tuyển sinh VCE (bán) → 2; đào tạo nội bộ → 4.3",
          ["Bản đồ nghề & lộ trình", "Học nghề & chứng chỉ", "Thị trường lao động ngành ô tô"]),
     ]),
    ("1", "mkt", "Marketing", "Chiến lược, khách hàng, digital, nội dung, trade marketing", [
        ("1.1", "mkt.chien-luoc", "Chiến lược & thương hiệu",
         "Kế hoạch marketing, định vị, thông điệp, nhận diện, nhãn hiệu, quy định quảng cáo",
         "Chiến lược kinh doanh tập đoàn → 5.1",
         ["Kế hoạch & ngân sách marketing", "Định vị & thông điệp",
          "Nhận diện & tài sản thương hiệu (nhãn hiệu, SHTT, quy định quảng cáo)", "Marketing B2B cho gara & đại lý",
          "Đo lường hiệu quả marketing tổng thể", "Sản phẩm & danh mục marketing (4P)"]),
        ("1.2", "mkt.khach-hang", "Khách hàng & thị trường",
         "Chân dung, hành trình, tâm lý mua, nghiên cứu thị trường & đối thủ",
         "Kỹ năng khai thác nhu cầu khi bán → 2.2",
         ["Chân dung & phân khúc (gara, đại lý, chủ xe, học viên)", "Hành trình khách hàng & điểm chạm",
          "Tâm lý & hành vi mua", "Nghiên cứu thị trường & đối thủ", "Khảo sát & insight"]),
        ("1.3", "mkt.digital", "Digital marketing", "Kênh số: SEO, ads, social, video, website, CRM, đo lường",
         "Ads chạy trong tài khoản sàn → 2.5; kịch bản & bài viết → 1.4",
         ["SEO", "Quảng cáo trả phí (Google, Facebook, TikTok Ads)", "Social & cộng đồng (fanpage, group, Zalo OA)",
          "Video ngắn & livestream", "Website & landing page", "Email, Zalo, CRM automation",
          "Đo lường digital (GA4, pixel, UTM, dashboard)"]),
        ("1.4", "mkt.noi-dung", "Nội dung & sáng tạo",
         "Chiến lược nội dung, copywriting, kịch bản, thiết kế, quy trình sản xuất", "Chọn kênh phát → 1.3",
         ["Chiến lược & lịch nội dung (pillar, tuyến)", "Copywriting & tiêu đề", "Kịch bản video & thư viện hook",
          "Thiết kế & hình ảnh", "Nội dung kỹ thuật ô tô cho marketing",
          "Quy trình sản xuất & duyệt nội dung (PDCA)"]),
        ("1.5", "mkt.trade", "Trade marketing & sự kiện",
         "Khuyến mãi, POSM, hội thảo, hội chợ, hợp tác với hãng", "Chính sách chiết khấu → 2.3",
         ["Chương trình khuyến mãi cho gara & đại lý", "POSM & vật phẩm",
          "Hội thảo & đào tạo kỹ thuật cho khách", "Hội chợ & triển lãm", "Co-op marketing với hãng"]),
    ]),
    ("2", "bh", "Bán hàng & CSKH", "Tổ chức bán hàng, kỹ năng B2B, giá, kênh đại lý, sàn TMĐT, CSKH", [
        ("2.1", "bh.to-chuc", "Chiến lược & tổ chức bán hàng",
         "Mô hình phân phối, tuyến, đội hình, chỉ tiêu, quản lý đội sales, công cụ, phân quyền duyệt",
         "Cơ chế lương chung → 4.4; lãnh đạo chung → 5.4",
         ["Mô hình phân phối & phân tuyến", "Cơ cấu đội sales, định biên & MTCV",
          "Chỉ tiêu, hạn ngạch & thưởng doanh số", "Quản lý đội sales (họp, coaching, pipeline)",
          "Công cụ bán hàng (DMS / VCsale, CRM)", "Phân quyền & duyệt báo giá"]),
        ("2.2", "bh.ky-nang-b2b", "Kỹ năng bán hàng B2B",
         "Tiếp cận, tư vấn, báo giá, xử lý từ chối, chốt, tái ghé, telesale",
         "Đàm phán giá lớn → 2.3; kiến thức phụ tùng → 0.2",
         ["Tìm kiếm & tiếp cận khách (đi tuyến)", "Khai thác nhu cầu & tư vấn kỹ thuật", "Trình bày & báo giá",
          "Xử lý từ chối & chốt đơn", "Pipeline, tái ghé & đơn lặp", "Bán qua điện thoại & Zalo (telesale)"]),
        ("2.3", "bh.gia-dam-phan", "Giá, chiết khấu & đàm phán",
         "Chính sách giá, bậc giá, chiết khấu, công nợ, đàm phán, hợp đồng bán", "Tính lãi gộp theo mã → 3.3",
         ["Chính sách giá & bậc giá", "Chiết khấu, công nợ & điều khoản thanh toán",
          "Đàm phán với khách & đối tác", "Hợp đồng mua bán & điều khoản"]),
        ("2.4", "bh.kenh-dai-ly", "Kênh đại lý & phân phối",
         "Đại lý cấp 2, bán buôn, chính sách kênh, sell-in / sell-out", "Bán trực tiếp gara → 2.2",
         ["Phát triển & tuyển đại lý", "Chính sách kênh & xung đột kênh",
          "Hiệu quả đại lý (sell-in, sell-out, tồn)", "Bán buôn & khách dự án"]),
        ("2.5", "bh.san-tmdt", "Sàn TMĐT & bán lẻ online",
         "TikTok Shop, Shopee: chọn hàng, vận hành shop, phí & chính sách sàn, ads sàn, livestream, affiliate, đối soát",
         "Nội dung video → 1.4; hạch toán & thuế sàn → 3.6 (liên kết)",
         ["Chọn sản phẩm & định giá bán sàn", "Vận hành shop (listing, đơn, hoàn huỷ)", "Chính sách & phí sàn",
          "Quảng cáo sàn & GMV Max", "Livestream & affiliate / KOC bán hàng", "Đối soát & báo cáo sàn"]),
        ("2.6", "bh.cskh", "CSKH, bảo hành & giữ chân",
         "Quy trình CSKH, khiếu nại, bảo hành với khách, tái mua, NPS", "Khiếu nại với hãng → 6.5",
         ["Quy trình CSKH & kênh hỗ trợ", "Xử lý khiếu nại & đánh giá xấu", "Bảo hành & đổi trả cho khách",
          "Khách hàng thân thiết & tái mua", "Đo lường (NPS, tỷ lệ giữ chân)"]),
    ]),
    ("3", "tckt", "Tài chính – Kế toán", "Ngân sách, dòng tiền, phân tích, vốn, kế toán, thuế, kiểm soát nội bộ", [
        ("3.1", "tckt.ngan-sach", "Kế hoạch & ngân sách",
         "Kế hoạch kinh doanh – tài chính, ngân sách, dự báo, kiểm soát chi",
         "Chiến lược tập đoàn → 5.1; KPI điều hành → 5.3",
         ["Kế hoạch kinh doanh & ngân sách năm / tháng", "Dự báo doanh thu – chi phí",
          "Kiểm soát chi phí & phê duyệt chi", "Ngân sách theo division & dự án"]),
        ("3.2", "tckt.dong-tien", "Dòng tiền, công nợ & vốn lưu động",
         "Kế hoạch tiền, thu hồi nợ, lịch trả, vốn lưu động, tồn kho tính theo tiền",
         "Hạn mức công nợ cho khách (chính sách) → 2.3",
         ["Kế hoạch & theo dõi dòng tiền", "Công nợ phải thu & thu hồi nợ", "Công nợ phải trả & lịch thanh toán",
          "Vốn lưu động & tồn kho (CCC, DIO)", "Quỹ, thanh toán & ngân hàng giao dịch"]),
        ("3.3", "tckt.phan-tich", "Phân tích tài chính & báo cáo quản trị",
         "Đọc BCTC, chỉ số, giá thành, báo cáo quản trị, lãi gộp theo mã / kênh", "Hạch toán → 3.5",
         ["Đọc & phân tích BCTC", "Chỉ số hiệu quả (biên, ROI, điểm hoà vốn)", "Giá thành & phân tích chi phí",
          "Báo cáo quản trị theo division, dự án, kênh", "Lãi gộp & định giá theo mã, theo kênh"]),
        ("3.4", "tckt.von", "Vốn vay & đầu tư",
         "Vay ngân hàng, hồ sơ tín dụng, thẩm định dự án, gọi vốn, quan hệ ngân hàng",
         "Quản trị công ty & cổ đông → 5.2",
         ["Vay ngân hàng & hồ sơ tín dụng (hạn mức, tài sản bảo đảm, L/C, UPAS)", "Thẩm định dự án đầu tư",
          "Gọi vốn & cơ cấu vốn", "Quan hệ & báo cáo cho ngân hàng"]),
        ("3.5", "tckt.ke-toan", "Kế toán tài chính", "Hạch toán, chuẩn mực, khoá sổ, BCTC, phần mềm kế toán",
         "Chứng từ & kiểm soát → 3.7",
         ["Nguyên lý & hạch toán (TT200 / TT133)", "Kế toán bán hàng – mua hàng – kho", "Kế toán tiền & công nợ",
          "Lập BCTC & khoá sổ", "Phần mềm kế toán & liên kết ERP"]),
        ("3.6", "tckt.thue", "Thuế & hoá đơn",
         "Hoá đơn điện tử, GTGT, TNDN, TNCN, thuế nhập khẩu, hộ kinh doanh, thuế sàn, quyết toán",
         "Tính lương → 4.4; thủ tục hải quan → 6.3",
         ["Hoá đơn điện tử (NĐ 123, thời điểm xuất)", "Thuế GTGT", "Thuế TNDN & chi phí được trừ",
          "Thuế TNCN & lương", "Thuế nhập khẩu", "Hộ kinh doanh & thuế sàn TMĐT",
          "Kê khai, quyết toán & rủi ro thuế"]),
        ("3.7", "tckt.kiem-soat", "Chứng từ, quy trình & kiểm soát nội bộ",
         "Chứng từ hợp lệ, quy trình thu – chi, phân quyền, kiểm kê, giao dịch liên kết",
         "Quy trình chung tập đoàn → 5.6",
         ["Chứng từ hợp lệ & lưu trữ", "Quy trình thu – chi – tạm ứng", "Kiểm soát nội bộ & phân quyền",
          "Kiểm kê & đối chiếu", "Giao dịch liên kết & rủi ro pháp lý"]),
    ]),
    ("4", "hcns", "Hành chính nhân sự", "Cơ cấu, tuyển dụng, đào tạo, lương thưởng, đánh giá, tuân thủ, hành chính", [
        ("4.1", "hcns.co-cau", "Cơ cấu, định biên & MTCV",
         "Sơ đồ, định biên, mô tả công việc, khung năng lực, thang chức danh", "Mô hình khối – division → 5.2",
         ["Sơ đồ tổ chức & định biên", "Mô tả công việc & khung năng lực",
          "Thang chức danh (7 cấp) & lộ trình thăng tiến"]),
        ("4.2", "hcns.tuyen-dung", "Tuyển dụng & onboarding", "Kế hoạch, chi phí, nguồn, phỏng vấn, thử việc",
         "Tuyển sinh học viên VCE → 2",
         ["Kế hoạch & chi phí tuyển dụng", "Nguồn & thương hiệu tuyển dụng", "Phỏng vấn & đánh giá ứng viên",
          "Onboarding & thử việc"]),
        ("4.3", "hcns.dao-tao", "Đào tạo & phát triển",
         "Hệ thống đào tạo nội bộ, lộ trình học, kỹ năng nghề, kỹ năng cá nhân, kế thừa",
         "Nội dung chuyên môn → mảng tương ứng; lãnh đạo → 5.4",
         ["Hệ thống đào tạo nội bộ, wiki & lộ trình học", "Đào tạo hội nhập & kỹ năng nghề",
          "Kỹ năng làm việc cá nhân", "Kèm cặp & phát triển kế thừa"]),
        ("4.4", "hcns.luong", "Lương thưởng & đãi ngộ",
         "Cơ chế lương, thang bảng, thưởng, hoa hồng, phúc lợi, quỹ lương, tính lương",
         "Thuế TNCN → 3.6; thưởng doanh số theo tuyến → 2.1",
         ["Cơ chế lương & thang bảng lương", "Thưởng, hoa hồng & phúc lợi", "Quỹ lương & chi phí nhân sự",
          "Tính lương & bảng lương"]),
        ("4.5", "hcns.danh-gia", "Đánh giá hiệu suất",
         "KPI cá nhân, đánh giá định kỳ, phản hồi, hiệu suất kém, kết quả học tập", "KPI công ty & division → 5.3",
         ["KPI cá nhân & thiết lập mục tiêu", "Đánh giá định kỳ & phản hồi", "Xử lý hiệu suất kém",
          "Kết quả học tập & thi trong đánh giá"]),
        ("4.6", "hcns.tuan-thu", "Quan hệ lao động & tuân thủ",
         "HĐLĐ, nội quy, BHXH, kỷ luật, nghỉ việc, giờ làm & ngày nghỉ", "Văn hoá → 5.5",
         ["Hợp đồng lao động & nội quy", "BHXH, BHYT, BHTN", "Kỷ luật & xử lý vi phạm", "Nghỉ việc & bàn giao",
          "Giờ làm việc, ngày nghỉ & chấm công"]),
        ("4.7", "hcns.hanh-chinh", "Hành chính & văn phòng",
         "Tài sản, mua sắm nội bộ, văn thư, con dấu, giấy phép, sự kiện nội bộ", "Mua hàng hoá kinh doanh → 6",
         ["Tài sản & mua sắm nội bộ", "Văn thư, con dấu & giấy phép doanh nghiệp", "Sự kiện & gắn kết nội bộ",
          "An toàn & môi trường làm việc"]),
    ]),
    ("5", "qltt", "Quản lý tập trung",
     "Chiến lược, tổ chức, điều hành, lãnh đạo, văn hoá, quy trình, hệ thống — mảng của TGĐ và BOD", [
         ("5.1", "qltt.chien-luoc", "Chiến lược & mô hình kinh doanh",
          "Chiến lược tập đoàn, danh mục division, mô hình & đơn vị kinh tế, mở mới / đóng",
          "Chiến lược marketing → 1.1; kế hoạch tài chính → 3.1",
          ["Chiến lược tập đoàn & danh mục division", "Mô hình kinh doanh & đơn vị kinh tế",
           "Kế hoạch năm & phân bổ nguồn lực", "Mở mới, M&A & đóng"]),
         ("5.2", "qltt.to-chuc", "Cơ cấu tổ chức & phân quyền",
          "Mô hình khối – division, uỷ quyền, quản trị công ty, pháp nhân", "Định biên & MTCV → 4.1",
          ["Mô hình khối – division", "Phân quyền & uỷ quyền (ngưỡng duyệt)",
           "Quản trị công ty (HĐQT, cổ đông, điều lệ)", "Pháp nhân & quan hệ nội bộ tập đoàn"]),
         ("5.3", "qltt.dieu-hanh", "Mục tiêu, nhịp điều hành & báo cáo",
          "OKR / KPI công ty, nhịp tháng – tuần, họp, Horenso, giao việc", "KPI cá nhân → 4.5",
          ["OKR / KPI công ty & division", "Nhịp điều hành (02 – 14 – 28, tuần)", "Họp & biên bản",
           "Báo cáo Horenso & Ohitashi", "Giao việc & theo dõi (todolist, email)"]),
         ("5.4", "qltt.lanh-dao", "Lãnh đạo & quản lý đội ngũ",
          "Tư duy lãnh đạo, giao việc, phản hồi, động lực, cấp trung, xung đột",
          "Kỹ năng cá nhân của nhân viên → 4.3; kỷ luật theo luật → 4.6",
          ["Tư duy & phong cách lãnh đạo", "Giao việc, uỷ quyền & phản hồi", "Tạo động lực & giữ người (Gen Z)",
           "Quản lý cấp trung", "Xử lý xung đột & kỷ luật đội", "Xây đội & kế thừa"]),
         ("5.5", "qltt.van-hoa", "Văn hoá doanh nghiệp",
          "Giá trị, hành vi, truyền thông nội bộ, ghi nhận, văn hoá học tập", "Sự kiện nội bộ (tổ chức) → 4.7",
          ["Giá trị cốt lõi & hành vi", "Truyền thông nội bộ", "Gắn kết & ghi nhận", "Văn hoá học tập & wiki"]),
         ("5.6", "qltt.quy-trinh", "Quy trình, dự án & cải tiến",
          "SOP, quản trị dự án, PDCA, rủi ro, kiểm soát tài liệu", "Quy trình kế toán → 3.7",
          ["Thiết kế quy trình & SOP", "Quản trị dự án", "PDCA & cải tiến liên tục",
           "Kiểm soát rủi ro & tuân thủ", "Kiểm soát tài liệu & phiên bản (quy chế wiki)"]),
         ("5.7", "qltt.he-thong", "Hệ thống, dữ liệu & AI",
          "ERP, phần mềm quản trị, dữ liệu, dashboard, AI, công cụ làm việc, bảo mật",
          "Bán phần mềm VCgarage → 2; sản phẩm VCsoft → 7",
          ["ERP & phần mềm quản trị (VCsale, VCgarage, kế toán)", "Dữ liệu, báo cáo & dashboard",
           "AI & tự động hoá (agent, MCP)", "Công cụ làm việc (Gmail, wiki, todolist)",
           "Bảo mật & phân quyền dữ liệu"]),
     ]),
    ("6", "mh", "Mua hàng & chuỗi cung ứng", "Kế hoạch mua, nhà cung cấp, nhập khẩu, kho, bảo hành với hãng", [
        ("6.1", "mh.ke-hoach", "Kế hoạch mua & danh mục",
         "Dự báo, kế hoạch mua, SKU, kiến trúc danh mục, giá vốn về kho",
         "Định giá bán → 2.3; kiến thức phụ tùng → 0.2",
         ["Dự báo nhu cầu & kế hoạch mua", "Kiến trúc danh mục & SKU (mồi / chủ lực)", "Giá vốn & landed cost"]),
        ("6.2", "mh.nha-cung-cap", "Nhà cung cấp & đàm phán",
         "Tìm, đánh giá NCC, đàm phán, hợp đồng mua, quan hệ hãng", "Đàm phán với khách → 2.3",
         ["Tìm & đánh giá NCC", "Đàm phán giá, MOQ & điều khoản", "Hợp đồng mua & quan hệ hãng",
          "Hỗ trợ & chính sách từ hãng"]),
        ("6.3", "mh.nhap-khau", "Nhập khẩu & logistics", "PO, C/O, hải quan, forwarder, vận chuyển",
         "Thuế nhập khẩu (kê khai) → 3.6",
         ["Quy trình nhập khẩu (PO, Form E, C/O, L/C)", "Hải quan & thủ tục", "Forwarder & vận chuyển quốc tế",
          "Vận chuyển nội địa & giao hàng"]),
        ("6.4", "mh.kho", "Kho & tồn kho", "Nhập – xuất – kiểm kê, tồn an toàn, hàng chậm, đóng gói",
         "Tồn kho theo tiền (DIO) → 3.2",
         ["Vận hành kho (nhập, xuất, kiểm kê)", "Quản lý tồn kho (tồn an toàn, hàng chậm luân chuyển)",
          "Đóng gói & giao hàng cho sàn"]),
        ("6.5", "mh.bao-hanh-hang", "Bảo hành & khiếu nại với hãng",
         "Hàng lỗi, hồ sơ bảo hành với NCC, thống kê lỗi", "Bảo hành cho khách → 2.6",
         ["Quy trình khiếu nại hàng lỗi với NCC", "Hồ sơ bảo hành & đổi trả", "Thống kê lỗi & đánh giá NCC"]),
    ]),
    # Tách khỏi 0 Nền ngành (từng là 7, slug nen.san-pham-vcpv) lên khối gốc 27/09/2026; tầng 3 cũ thành tầng 2
    ("7", "san-pham-vcpv", "Sản phẩm & giải pháp VCPV", "Danh mục, tính năng, lợi thế từng sản phẩm VCPV", [
        ("7.1", "san-pham-vcpv.danh-muc-vcpart", "Danh mục & thương hiệu uỷ quyền VCpart",
         "nhóm hàng VCpart đang bán; từng hãng được uỷ quyền: xuất xứ, thế mạnh, dòng xe phủ, bảo hành, lợi thế so với hàng cùng phân khúc",
         "thương hiệu phụ tùng toàn thị trường → 0.2.2; hỗ trợ, chính sách từ hãng → 6.2.4; chiến lược division VCpart → 5.1.1", []),
        ("7.2", "san-pham-vcpv.vcgarage-vcsale", "Chuyển đổi số VCsoft",
         "tính năng, gói, lợi thế VCgarage (quản lý gara, bảo hiểm) và VCsale (bán hàng, kho, tra mã); chọn phần mềm gara, so sánh đối thủ",
         "kỹ năng bán phần mềm cho gara → 2.2; dùng VCsale trong đội sales → 2.1.5; quy trình vận hành gara → 0.3.1", []),
        ("7.3", "san-pham-vcpv.thiet-bi-vcobd", "Thiết bị chẩn đoán VCOBD",
         "dòng máy, tính năng, độ phủ hãng xe, gói cập nhật – bản quyền, bảo hành, hướng dẫn dùng VCOBD, so sánh máy cùng phân khúc",
         "kỹ thuật chẩn đoán, đọc lỗi theo ca → 0.1.2; kỹ năng bán máy cho gara → 2.2; nhập máy từ hãng → 6.3.1", []),
        ("7.4", "san-pham-vcpv.dao-tao-vce", "Chương trình đào tạo VCE",
         "khoá học VCE: đối tượng, đầu ra, thời lượng, học phí, giáo trình, giảng viên, chứng chỉ cấp, hỗ trợ việc làm sau khoá",
         "tư vấn, chốt tuyển sinh học viên → 2.2; nội dung truyền thông tuyển sinh → 1.4.1; đào tạo nội bộ nhân viên VCPV → 4.3.1", []),
        ("7.5", "san-pham-vcpv.chuoi-xuong-vcservice", "Chuỗi xưởng VCservice",
         "mô hình, địa điểm, gói dịch vụ, bảng giá, tiêu chuẩn và quy trình chuẩn của các xưởng VCservice; điểm khác biệt khi giới thiệu với chủ xe",
         "vận hành gara nói chung → 0.3.1; mở thêm xưởng mới → 0.3.4; marketing kéo khách cho xưởng → 1.1.4", []),
        ("7.6", "san-pham-vcpv.vcmedia", "VCmedia",
         "những gì division truyền thông cung cấp: kênh nội dung ngành ô tô, gói sản xuất video, quảng cáo cho gara, đối tác truyền thông",
         "kế hoạch marketing của các division → 1.1.1; kỹ thuật viết kịch bản video → 1.4.3; vận hành fanpage, group VCPV → 1.3.3", []),
    ]),
]

# Tầng 4 mẫu — slug tầng 3 cha -> [(slug cuối, tên đầu việc)] (mục 4, ví dụ SEO)
LEVEL4 = {
    # R4 (26/09/2026, bổ sung 12:20): 211 thẻ sàn TMĐT xếp tầng 4
    "bh.san-tmdt.quang-cao-gmv-max": [
        ("gmv-max", "GMV Max"),
        ("quang-cao-video", "Quảng cáo video, C-Ads & tệp khách"),
        ("quang-cao-live", "Quảng cáo livestream"),
        ("tai-khoan-do-luong", "Tài khoản, ngân sách & đo lường ads"),
    ],
    "bh.san-tmdt.livestream-affiliate": [
        ("host-kich-ban", "Kỹ năng host & kịch bản live"),
        ("van-hanh-live", "Xây đội & vận hành phiên live"),
        ("affiliate-koc", "Affiliate, KOC & booking"),
        ("setup-live", "Setup phòng live & kỹ thuật"),
    ],
    "hcns.dao-tao.ky-nang-ca-nhan": [
        ("giao-tiep", "Giao tiếp & ứng xử công sở"),
        ("thoi-gian", "Quản lý thời gian & hiệu suất cá nhân"),
        ("lam-viec-voi-sep", "Làm việc với sếp"),
    ],
    "mkt.digital.seo": [
        ("nghien-cuu-tu-khoa", "Nghiên cứu từ khoá & ý định tìm kiếm"),
        ("cau-truc-web", "Dựng cấu trúc web pillar – cluster"),
        ("viet-bai-on-page", "Viết bài chuẩn SEO (on-page)"),
        ("seo-ky-thuat", "SEO kỹ thuật: tốc độ, index, schema"),
        ("seo-local", "SEO local: Google Business Profile cho xưởng"),
        ("link-building", "Xây liên kết (off-page)"),
        ("seo-nen-tang", "SEO trên sàn & nền tảng: Shopee, TikTok, YouTube"),
        ("ai-search", "Tối ưu cho AI search (GEO)"),
        ("do-luong-seo", "Đo lường: Search Console, GA4, thứ hạng"),
    ],
}

# Scope note đầy đủ đã có trong tài liệu (mục 13) — thay bản dựng tự động
# Mô tả ngắn cho nhánh tầng 3–4 (tầng 1–2 lấy từ bảng TREE)
DESCRIPTIONS = {
    "hcns.dao-tao.ky-nang-ca-nhan": "Phát triển bản thân, tự học, tư duy nghề nghiệp; giao tiếp, thời gian, làm việc "
                                    "với sếp ở tầng 4",
    "mkt.chien-luoc.san-pham-4p": "Quản trị sản phẩm góc nhìn marketing, marketing mix 4P, cấp độ sản phẩm, vòng đời",
}

SCOPE_NOTES = {
    # R4 — 8 nhánh tầng 4 của 2.5.4 / 2.5.5
    "bh.san-tmdt.quang-cao-gmv-max.gmv-max": (
        'Gồm: cơ chế phân phối, ROI mục tiêu & bảo vệ ROI, ngân sách & scale, nguồn video cho camp, tính năng mới (2.0, Pro, Coupon, Creative Boost, Promotion Day), xử lý camp không cắn tiền / tụt'
        '\nKhông gồm: GMV Max cho livestream → 2.5.4.3; ROI hoà vốn theo lãi thực, tài khoản & thanh toán → 2.5.4.4'
        '\nDễ nhầm với: 2.5.4.2 — phân biệt: 2.5.4.2 là quảng cáo video thường / C-Ads, không phải GMV Max'
        '\nVí dụ thẻ: "Bảo vệ ROI trong GMV Max: điều kiện kích hoạt…"; "GMV Max cần tối thiểu 30–50 video/thẻ sản phẩm"'),
    "bh.san-tmdt.quang-cao-gmv-max.quang-cao-video": (
        'Gồm: quảng cáo mua sắm qua video trên Ads Manager, C-Ads, chạy song song với GMV Max, target & remarketing tệp, nút Quảng bá trên điện thoại, chạy ads hộ video KOC qua mã uỷ quyền'
        '\nKhông gồm: GMV Max → 2.5.4.1'
        '\nDễ nhầm với: 1.3.2 Quảng cáo trả phí ngoài sàn — phân biệt: chạy trong tài khoản sàn thì ở đây'
        '\nVí dụ thẻ: "Quy trình setup C-Ads từ A-Z"; "Quét tệp khách đã mua, bỏ giỏ để target quảng cáo"'),
    "bh.san-tmdt.quang-cao-gmv-max.quang-cao-live": (
        'Gồm: Live GMV Max, quảng cáo mua sắm qua live, đẩy mắt xem bằng ads, video teaser dẫn vào live, khi nào nên chạy ads cho live'
        '\nKhông gồm: kỹ năng host, vận hành phiên → 2.5.5'
        '\nDễ nhầm với: 2.5.5.2 — phân biệt: ở đây là tiền quảng cáo cho live, 2.5.5.2 là vận hành phiên'
        '\nVí dụ thẻ: "Setup Live GMV Max: tách chiến dịch theo phiên"; "Chỉ chạy quảng cáo cho livestream khi phiên live đã chuyển đổi tốt"'),
    "bh.san-tmdt.quang-cao-gmv-max.tai-khoan-do-luong": (
        'Gồm: tài khoản quảng cáo (tín nhiệm, trả trước/sau, đình chỉ & kháng nghị, nạp tiền, hoàn tín, agency), đọc chỉ số CPM/CPC/CTR/ROAS/CPA, cửa sổ ghi nhận đơn, ROI hoà vốn theo lãi thực, tăng ngân sách, mùa vụ'
        '\nKhông gồm: hạch toán chi phí ads → 3.6'
        '\nDễ nhầm với: 2.5.6 Đối soát & báo cáo sàn — phân biệt: ở đây là số liệu quảng cáo, 2.5.6 là đối soát doanh thu sàn'
        '\nVí dụ thẻ: "Đọc chỉ số quảng cáo TikTok (CPM, CPC, CTR, ROAS)…"; "Tài khoản quảng cáo TikTok bị đình chỉ vĩnh viễn: cách khiếu nại"'),
    "bh.san-tmdt.livestream-affiliate.host-kich-ban": (
        'Gồm: mở đầu & giữ chân người xem, deal mồi 1k/9k, kích comment, chốt đơn, xử lý chê giá, giọng & phong thái, công cụ tương tác trong live (đấu giá, minigame, flash sale)'
        '\nKhông gồm: kịch bản video ngắn → 1.4'
        '\nDễ nhầm với: 2.2 Kỹ năng bán hàng — phân biệt: ở đây là bán trong phiên live'
        '\nVí dụ thẻ: "Kịch bản và công cụ giữ chân người xem livestream"; "Xử lý khách chê giá đắt trong live"'),
    "bh.san-tmdt.livestream-affiliate.van-hanh-live": (
        'Gồm: lịch & khung giờ, thời lượng, đội live in-house, kế hoạch live ngày sale / mega live, chỉ số phiên (mắt xem, giữ chân, GPM, chuyển đổi), chẩn đoán phiên, thao tác trợ live'
        '\nKhông gồm: lương & KPI nhân viên live → 4.4, 4.5'
        '\nDễ nhầm với: 2.5.4.3 — phân biệt: 2.5.4.3 là quảng cáo cho live'
        '\nVí dụ thẻ: "TikTok đề xuất thêm mắt xem live dựa trên tỷ lệ giữ chân và GPM"; "Không có khung giờ vàng cố định cho livestream"'),
    "bh.san-tmdt.livestream-affiliate.affiliate-koc": (
        'Gồm: mô hình & mức hoa hồng, chọn và booking KOC/KOL, gửi mẫu, quản lý affiliate trên Seller Center, voucher riêng cho KOC, rủi ro KOC'
        '\nKhông gồm: hợp đồng KOC → 2.3.4; hạch toán hoa hồng → 3'
        '\nDễ nhầm với: 2.4 đại lý — phân biệt: KOC bán qua nội dung, đại lý mua đứt bán đoạn'
        '\nVí dụ thẻ: "Benchmark hoa hồng KOC/affiliate hợp lý"; "Tiêu chí chọn KOC để booking"'),
    "bh.san-tmdt.livestream-affiliate.setup-live": (
        'Gồm: không gian, ánh sáng, thiết bị, live 2 điện thoại, cài đặt trước phiên (giới hạn 10 phút, độ tuổi), live giấu mặt, chữ trên màn hình'
        '\nKhông gồm: quay dựng video → 1.4'
        '\nDễ nhầm với: 2.5.5.1 — phân biệt: ở đây là kỹ thuật phòng live, 2.5.5.1 là người host'
        '\nVí dụ thẻ: "Livestream cùng lúc bằng 2 điện thoại"; "Cài đặt trước phiên live để tránh bị giới hạn 10 phút"'),
    # Bổ sung sau bước A2 (đọc 1.538 thẻ) — yêu cầu R3, 26/09/2026
    "mkt.chien-luoc.san-pham-4p": (
        "Gồm: quản trị sản phẩm góc nhìn marketing, marketing mix 4P, 5 cấp độ sản phẩm, danh mục & vòng đời, "
        "đóng gói & định vị sản phẩm\n"
        "Không gồm: định giá bán sàn → 2.5.1; mua hàng & danh mục nhập → 6; sản phẩm VCPV cụ thể → 7\n"
        "Dễ nhầm với: 1.1.2 Định vị & thông điệp — phân biệt: 1.1.2 định vị thương hiệu, không phải sản phẩm\n"
        "Ví dụ thẻ: \"Marketing mix 4P: vấn đề ở P sau luôn bắt nguồn từ P trước\"; \"Mô hình 5 cấp độ sản phẩm\""),
    "hcns.dao-tao.ky-nang-ca-nhan.giao-tiep": (
        "Gồm: giao tiếp với đồng nghiệp, phép tắc phòng họp, business manner, xung đột với đồng nghiệp, bị cô lập / "
        "bè phái, hình ảnh chuyên nghiệp\n"
        "Không gồm: giao tiếp với sếp → 4.3.3.3; giao tiếp với khách hàng → khối 2; xử lý xung đột trong đội từ góc "
        "quản lý → 5.4.5\n"
        "Dễ nhầm với: 5.4.5 (góc nhìn người quản lý), 5.5 văn hoá — phân biệt: ở đây là góc nhìn người nhân viên\n"
        "Ví dụ thẻ: \"3 quy tắc ngầm phòng họp\"; \"Giải quyết xung đột công sở: đối thoại 1-1 trước\""),
    "hcns.dao-tao.ky-nang-ca-nhan.thoi-gian": (
        "Gồm: ưu tiên việc (Eisenhower, Pareto, 3M), Pomodoro, mục tiêu SMART, kỷ luật bản thân, PDCA cá nhân, tự "
        "kiểm việc, cân bằng tránh burnout\n"
        "Không gồm: KPI & đánh giá nhân sự → 4.5; giao việc & quản thời gian của đội → 5.4.2\n"
        "Dễ nhầm với: 4.5 KPI; 5.4.2 giao việc — phân biệt: ở đây là một người tự quản việc của mình\n"
        "Ví dụ thẻ: \"Ma trận Eisenhower\"; \"Kỹ thuật Pomodoro 5 bước\""),
    "hcns.dao-tao.ky-nang-ca-nhan.lam-viec-voi-sep": (
        "Gồm: hiểu kiểu sếp, báo cáo & chủ động, nhận việc & ranh giới, đón nhận phê bình, xây lòng tin, được trọng "
        "dụng, ứng xử với sếp khó\n"
        "Không gồm: lãnh đạo từ góc sếp → 5.4; thăng tiến & thang chức danh → 4.1.3; nghỉ việc → 4.6.4\n"
        "Dễ nhầm với: 5.4.2 Giao việc & phản hồi — phân biệt: 5.4.2 là chiều từ sếp xuống, ở đây chiều từ dưới lên\n"
        "Ví dụ thẻ: \"4 kiểu sếp cơ bản\"; \"Giải mã ngôn ngữ sếp\""),
    "bh.san-tmdt": (
        "Gồm: chọn hàng & giá bán sàn; vận hành shop; phí & chính sách sàn; ads trong sàn, GMV Max; livestream & "
        "affiliate bán hàng; đối soát sàn\n"
        "Không gồm: kịch bản video → 1.4; hạch toán & thuế sàn → 3.6; đóng gói kho → 6.4\n"
        "Dễ nhầm với: 1.3 Digital — phân biệt: chạy trong tài khoản sàn thì 2.5, chạy ngoài sàn kéo về web / "
        "fanpage thì 1.3\n"
        "Ví dụ thẻ: \"Cơ cấu lương nhân viên livestream\"; \"Đối soát TikTok Shop theo kỳ\"; \"Giá trần khi chọn mã "
        "bán sàn\""),
}

STOPWORDS = {"cho", "voi", "cua", "va"}
# Tên mà quy tắc chung cho slug khó đọc -> đặt tay (slug cuối, không gồm slug cha)
SLUG_OVERRIDES = {
    "Danh mục & 10 thương hiệu uỷ quyền VCpart": "danh-muc-vcpart",
    "Tiếp nhận – chẩn đoán – báo giá – bàn giao": "tiep-nhan-ban-giao",
    "Thị trường aftermarket VN & đối thủ": "aftermarket-vn",
    "Nội dung kỹ thuật ô tô cho marketing": "noi-dung-ky-thuat",
    "Đo lường hiệu quả marketing tổng thể": "do-luong-marketing",
    "Quy trình sản xuất & duyệt nội dung (PDCA)": "san-xuat-duyet",
    "Livestream & affiliate / KOC bán hàng": "livestream-affiliate",
    "Hộ kinh doanh & thuế sàn TMĐT": "ho-kinh-doanh-thue-san",
    "Thang chức danh (7 cấp) & lộ trình thăng tiến": "thang-chuc-danh",
    "Kỹ năng làm việc cá nhân": "ky-nang-ca-nhan",
    "Sản phẩm & danh mục marketing (4P)": "san-pham-4p",
    "Hệ thống đào tạo nội bộ, wiki & lộ trình học": "he-thong-dao-tao",
    "BHXH, BHYT, BHTN": "bao-hiem",
    "Nhịp điều hành (02 – 14 – 28, tuần)": "nhip-dieu-hanh",
    "Email, Zalo, CRM automation": "crm-automation",
    "Vốn lưu động & tồn kho (CCC, DIO)": "von-luu-dong",
    "Quỹ, thanh toán & ngân hàng giao dịch": "quy-thanh-toan",
    "Chiết khấu, công nợ & điều khoản thanh toán": "chiet-khau-cong-no",
    "Chỉ tiêu, hạn ngạch & thưởng doanh số": "chi-tieu-thuong",
    "Cơ cấu đội sales, định biên & MTCV": "doi-sales",
    "Pipeline, tái ghé & đơn lặp": "pipeline-tai-ghe",
    "Kế hoạch kinh doanh & ngân sách năm / tháng": "ke-hoach-ngan-sach",
    "Vay ngân hàng & hồ sơ tín dụng (hạn mức, tài sản bảo đảm, L/C, UPAS)": "vay-ngan-hang",
    "Nguyên lý & hạch toán (TT200 / TT133)": "hach-toan",
    "Kế toán bán hàng – mua hàng – kho": "ke-toan-ban-mua-kho",
    "Quy trình thu – chi – tạm ứng": "thu-chi-tam-ung",
    "ERP & phần mềm quản trị (VCsale, VCgarage, kế toán)": "erp-phan-mem",
    "Quy trình nhập khẩu (PO, Form E, C/O, L/C)": "quy-trinh-nhap-khau",
    "Mở mới, M&A & đóng": "mo-moi-ma",
    "Chuỗi cung ứng phụ tùng (Tier-1, nhập khẩu)": "chuoi-cung-ung",
    "Quy định kinh doanh phụ tùng": "quy-dinh-kinh-doanh",
    "Quản lý KTV & năng suất": "nang-suat-ktv",
    "Mở & mở rộng gara": "mo-rong-gara",
    "Bản đồ nghề & lộ trình": "ban-do-nghe",
    "Thị trường lao động ngành ô tô": "thi-truong-lao-dong",
    "Thiết bị chẩn đoán VCOBD": "thiet-bi-vcobd",
    "Chương trình đào tạo VCE": "dao-tao-vce",
    "Chuỗi xưởng VCservice": "chuoi-xuong-vcservice",
    "Quảng cáo trả phí (Google, Facebook, TikTok Ads)": "quang-cao-tra-phi",
    "Đo lường digital (GA4, pixel, UTM, dashboard)": "do-luong-digital",
    "Chiến lược & lịch nội dung (pillar, tuyến)": "lich-noi-dung",
    "Kịch bản video & thư viện hook": "kich-ban-video",
    "Chương trình khuyến mãi cho gara & đại lý": "khuyen-mai",
    "Hội chợ & triển lãm": "hoi-cho-trien-lam",
    "Co-op marketing với hãng": "co-op-marketing",
    "Quản lý đội sales (họp, coaching, pipeline)": "quan-ly-doi-sales",
    "Công cụ bán hàng (DMS / VCsale, CRM)": "cong-cu-ban-hang",
    "Phân quyền & duyệt báo giá": "duyet-bao-gia",
    "Khai thác nhu cầu & tư vấn kỹ thuật": "khai-thac-nhu-cau",
    "Phát triển & tuyển đại lý": "tuyen-dai-ly",
    "Hiệu quả đại lý (sell-in, sell-out, tồn)": "hieu-qua-dai-ly",
    "Bán buôn & khách dự án": "ban-buon-du-an",
    "Chọn sản phẩm & định giá bán sàn": "chon-hang-dinh-gia",
    "Vận hành shop (listing, đơn, hoàn huỷ)": "van-hanh-shop",
    "Quy trình CSKH & kênh hỗ trợ": "quy-trinh-cskh",
    "Xử lý khiếu nại & đánh giá xấu": "khieu-nai",
    "Đo lường (NPS, tỷ lệ giữ chân)": "nps-giu-chan",
    "Kế hoạch & theo dõi dòng tiền": "ke-hoach-dong-tien",
    "Công nợ phải thu & thu hồi nợ": "cong-no-phai-thu",
    "Công nợ phải trả & lịch thanh toán": "cong-no-phai-tra",
    "Chỉ số hiệu quả (biên, ROI, điểm hoà vốn)": "chi-so-hieu-qua",
    "Báo cáo quản trị theo division, dự án, kênh": "bao-cao-quan-tri",
    "Thẩm định dự án đầu tư": "tham-dinh-du-an",
    "Quan hệ & báo cáo cho ngân hàng": "quan-he-ngan-hang",
    "Kế toán tiền & công nợ": "ke-toan-tien-cong-no",
    "Phần mềm kế toán & liên kết ERP": "phan-mem-ke-toan",
    "Hoá đơn điện tử (NĐ 123, thời điểm xuất)": "hoa-don-dien-tu",
    "Thuế nhập khẩu": "thue-nhap-khau",
    "Chứng từ hợp lệ & lưu trữ": "chung-tu",
    "Giao dịch liên kết & rủi ro pháp lý": "giao-dich-lien-ket",
    "Mô tả công việc & khung năng lực": "mtcv-khung-nang-luc",
    "Kế hoạch & chi phí tuyển dụng": "ke-hoach-tuyen-dung",
    "Nguồn & thương hiệu tuyển dụng": "nguon-tuyen-dung",
    "Cơ chế lương & thang bảng lương": "co-che-luong",
    "KPI cá nhân & thiết lập mục tiêu": "kpi-ca-nhan",
    "Xử lý hiệu suất kém": "hieu-suat-kem",
    "Kết quả học tập & thi trong đánh giá": "ket-qua-hoc-tap",
    "Văn thư, con dấu & giấy phép doanh nghiệp": "van-thu-con-dau",
    "Quản trị công ty (HĐQT, cổ đông, điều lệ)": "quan-tri-cong-ty",
    "OKR / KPI công ty & division": "okr-kpi",
    "Báo cáo Horenso & Ohitashi": "horenso",
    "Giao việc & theo dõi (todolist, email)": "giao-viec-theo-doi",
    "Tư duy & phong cách lãnh đạo": "tu-duy-lanh-dao",
    "Tạo động lực & giữ người (Gen Z)": "dong-luc-giu-nguoi",
    "Quản lý cấp trung": "quan-ly-cap-trung",
    "Xử lý xung đột & kỷ luật đội": "xung-dot-ky-luat",
    "Truyền thông nội bộ": "truyen-thong-noi-bo",
    "Văn hoá học tập & wiki": "van-hoa-hoc-tap",
    "Quản trị dự án": "quan-tri-du-an",
    "Kiểm soát rủi ro & tuân thủ": "rui-ro-tuan-thu",
    "Kiểm soát tài liệu & phiên bản (quy chế wiki)": "kiem-soat-tai-lieu",
    "AI & tự động hoá (agent, MCP)": "ai-tu-dong-hoa",
    "Công cụ làm việc (Gmail, wiki, todolist)": "cong-cu-lam-viec",
    "Tìm & đánh giá NCC": "danh-gia-ncc",
    "Đàm phán giá, MOQ & điều khoản": "dam-phan-moq",
    "Vận hành kho (nhập, xuất, kiểm kê)": "van-hanh-kho",
    "Quản lý tồn kho (tồn an toàn, hàng chậm luân chuyển)": "quan-ly-ton-kho",
    "Quy trình khiếu nại hàng lỗi với NCC": "khieu-nai-ncc",
    "Kế hoạch kinh doanh & ngân sách năm / tháng": "ke-hoach-kinh-doanh",
}


def short_slug(name: str) -> str:
    """Slug tầng 3 từ tên: bỏ phần trong ngoặc; tối đa 2 vế (tách theo & , – /), mỗi vế 2 từ đầu, bỏ chữ nối."""
    if name in SLUG_OVERRIDES:
        return SLUG_OVERRIDES[name]
    parts = re.split(r"\s*(?:&|,|–|/)\s*", re.sub(r"\(.*?\)", " ", name))
    words = []
    for part in [p for p in parts if p.strip()][:2]:
        words += [w for w in re.sub(r"[^a-z0-9]+", " ", db.unaccent(part)).split() if w not in STOPWORDS][:2]
    return "-".join(words)


def scope_note(gom: str, nham: str) -> str:
    codes = list(dict.fromkeys(re.findall(r"→\s*([0-9](?:\.[0-9])?)", nham)))
    return (f"Gồm: {gom}\nKhông gồm: {nham}\n"
            f"Dễ nhầm với: {', '.join(codes)} — phân biệt theo dòng Không gồm\nVí dụ thẻ: {EXAMPLES_PENDING}")


SCOPE_NOTES_FILE = Path(__file__).resolve().parents[1] / "scripts" / "data" / "scope_notes_v2.json"


def file_scope_notes() -> dict[str, str]:
    """Scope note 4 dòng theo MÃ nhánh (Claude Desktop soạn 26/09/2026, dòng "Ví dụ thẻ" lấy thẻ thật): tầng 2, 3, 4."""
    try:
        data = json.loads(SCOPE_NOTES_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return {str(k): str(v).strip() for k, v in data.items() if str(v).strip()}


def nodes() -> list[dict]:
    """Danh sách phẳng theo thứ tự cha trước con: {code, slug, name, description, scope_note, parent_slug, order}.
    Scope note ưu tiên: file JSON theo mã > SCOPE_NOTES viết tay theo slug > bản dựng tự động từ bảng."""
    by_code = file_scope_notes()
    out = []
    for i, (code1, slug1, name1, desc1, level2) in enumerate(TREE):
        out.append({"code": code1, "slug": slug1, "name": name1, "description": desc1, "parent_slug": None,
                    "order": i, "scope_note": f"Gồm: {'; '.join(n[2] for n in level2)}"})
        for j, (code2, slug2, name2, gom, nham, level3) in enumerate(level2):
            out.append({"code": code2, "slug": slug2, "name": name2, "description": gom[:300], "parent_slug": slug1,
                        "order": j, "scope_note": SCOPE_NOTES.get(slug2) or scope_note(gom, nham)})
            for k, name3 in enumerate(level3):
                slug3 = f"{slug2}.{short_slug(name3)}"
                out.append({"code": f"{code2}.{k + 1}", "slug": slug3, "name": name3,
                            "description": DESCRIPTIONS.get(slug3, ""), "parent_slug": slug2, "order": k,
                            "scope_note": SCOPE_NOTES.get(slug3, "")})
                for m, (tail, name4) in enumerate(LEVEL4.get(slug3, [])):
                    out.append({"code": f"{code2}.{k + 1}.{m + 1}", "slug": f"{slug3}.{tail}", "name": name4,
                                "description": DESCRIPTIONS.get(f"{slug3}.{tail}", ""), "parent_slug": slug3,
                                "order": m, "scope_note": SCOPE_NOTES.get(f"{slug3}.{tail}", "")})
    for n in out:
        n["scope_note"] = by_code.get(n["code"]) or n["scope_note"]
    return out


def seed(apply: bool = True) -> dict:
    """Nạp / cập nhật cây v2 theo slug (chạy lại an toàn). Không đụng nhánh cũ, không đụng thẻ.
    Nhánh đã có: cập nhật tên, mã; giữ owner và trạng thái ẩn / hiện. Nhánh người đã đổi tên (slug seed nằm trong
    `old_slugs`) giữ tên + slug mới, chỉ cập nhật mã; nhánh con mới của nó nối sau slug mới. Mô tả / scope note trống trong dữ liệu seed
    không xoá giá trị đang có; scope note đã được sửa tay (update_category) sau lần seed trước — khác
    `scope_note_seed` — được giữ, không bị seed đè."""
    from . import categories as cat_mod

    stats = {"created": 0, "updated": 0, "by_level": {}, "scope_note_kept": 0}
    by_slug: dict[str, dict] = {}
    for n in nodes():
        level = n["slug"].count(".") + 1
        stats["by_level"][level] = stats["by_level"].get(level, 0) + 1
        old = cat_mod.categories.find_one({"slug": n["slug"]})
        renamed = not old and cat_mod.categories.find_one({"old_slugs": n["slug"]})   # người đã đổi tên -> giữ
        if renamed:
            if apply:
                cat_mod.categories.update_one({"_id": renamed["_id"]}, {"$set": {"code": n["code"], "scheme": "v2"}})
            by_slug[n["slug"]] = renamed
            stats["updated"] += 1
            continue
        if not apply:
            stats["updated" if old else "created"] += 1
            continue
        if old:
            upd = {"name": n["name"], "code": n["code"], "order": n["order"], "scheme": "v2"}
            if n["description"]:
                upd["description"] = n["description"]
            cur, seeded = old.get("scope_note") or "", old.get("scope_note_seed")
            if n["scope_note"] and (not cur or seeded is None or cur == seeded):
                upd |= {"scope_note": n["scope_note"], "scope_note_seed": n["scope_note"]}
            elif n["scope_note"] and cur != n["scope_note"]:
                stats["scope_note_kept"] += 1          # người đã sửa tay sau lần seed trước
            cat_mod.categories.update_one({"_id": old["_id"]}, {"$set": upd})
            by_slug[n["slug"]] = old
            stats["updated"] += 1
            continue
        parent = by_slug.get(n["parent_slug"]) if n["parent_slug"] else None
        slug = parent["slug"] + n["slug"][len(n["parent_slug"]):] if parent else n["slug"]   # cha đã đổi slug
        doc = cat_mod._insert(n["name"], n["description"], parent, n["order"], slug=slug, code=n["code"],
                              scope_note=n["scope_note"])
        cat_mod.categories.update_one({"_id": doc["_id"]}, {"$set": {"scheme": "v2", "scope_note_seed": n["scope_note"]}})
        by_slug[n["slug"]] = doc
        stats["created"] += 1
    return stats
