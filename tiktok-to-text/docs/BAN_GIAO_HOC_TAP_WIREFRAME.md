# Bàn giao thiết kế học tập VCWIKI — 01/10/2026

## Cập nhật triển khai 01/10/2026

Khi gộp develop, đổi số lịch sử riêng của nhánh học tập: BA 0.55…0.58 → 0.57…0.60; DESIGN 0.35 → 0.37; UAT 0.11 → 0.13, tránh trùng công việc SYS-38/39 đã gộp. Số trong trạng thái bàn giao ban đầu bên dưới là số tại thời điểm đó.

Chủ sản phẩm đã duyệt wireframe và yêu cầu triển khai trong phiên này. DESIGN v0.37 TK-16 / SCR-16.2 đã được viết trước code; BA v0.60 phản ánh mô hình mới đã triển khai trên codex/mon-hoc-crud. Backend, UI và kiểm tra tự động đã bổ sung @39d56dc (120 ca backend, 4 ca E2E đạt); UAT người dùng còn chờ theo docs/UAT.md v0.11. Chuyển / quay lui chỉ thử trên QA với dữ liệu tạm, chưa chạy dữ liệu thật. Chủ sản phẩm đã yêu cầu merge develop và push remote ở lượt tiếp theo; UAT và chuyển dữ liệu thật vẫn chưa thực hiện. Các nội dung trạng thái bàn giao ban đầu dưới đây được giữ để truy lịch sử.

## Trạng thái và giới hạn lúc bàn giao ban đầu

Chủ sản phẩm đang duyệt wireframe. Chỉ sửa bản mô phỏng giao diện và BA mục 17.13 (LRN-18…24, phiên bản 0.57). Chưa viết DESIGN cho yêu cầu mới, chưa code ứng dụng, chưa UAT chức năng, chưa commit / merge / push nhánh này. Việc đồng ý quan hệ dữ liệu dưới đây không phải phê duyệt toàn bộ wireframe hoặc cho phép bắt đầu code.

Nhánh: `codex/mon-hoc-crud`. Worktree: `/Users/apple/TIKTIKTOTEXT/.worktrees/mon-hoc-crud`. BA nằm tại `docs/BA.md` trong worktree này, không phải bản develop. Wireframe: `/Users/apple/.codex/visualizations/2026/10/01/01a0f647-5bee-79b3-b326-2a8f24161d35/thu-vien-mon-hoc-wireframe.html`.

Không đụng các thay đổi khác của người dùng trên develop. Công việc cây lĩnh vực trước đó đã merge local develop tại `a912931`, chưa push develop; đây là công việc khác.

## Yêu cầu và mô hình đã thống nhất

- Đổi tên Khoá học thành Môn học; quản lý tạo / sửa / xoá môn, bài và nhánh phân loại trong phạm vi quyền. Không mở quyền mới chỉ vì đổi tên.
- Tổ chức đào tạo theo Khoa → Bộ môn → Môn → Bài. Giám đốc tương ứng trưởng khoa; trưởng phòng trưởng bộ môn; keystaff giảng viên; staff và thực tập sinh người học. Một người có thể đồng thời là người phụ trách, giảng viên và người học.
- Đơn vị phụ trách môn, giảng viên và người học là các quan hệ riêng. Chương trình có thể dùng môn từ nhiều khoa. Ví dụ khoa Cơ khí ô tô dùng môn Đọc hiểu báo cáo tài chính của khoa Tài chính – Kế toán, do keystaff Tài chính giảng dạy. Không sao chép môn để học liên khoa.
- Thư viện hiển thị Chương trình học → Môn học → Bài học. Chương trình là khung chung; lộ trình cá nhân chọn phần cần học theo mục tiêu và khoảng thiếu năng lực.
- Bài học thuộc một môn. Tạo bài bắt buộc chọn môn, không bắt buộc chọn giáo trình / giáo án. Có thể tạo môn còn thiếu ngay trong màn tạo bài, giữ bản soạn.
- Giáo trình tham chiếu và sắp xếp bài của môn cho đối tượng / mục tiêu. Một môn có bản mặc định, có thể thêm bản phù hợp đối tượng khác. Tạo bài từ giáo trình điền sẵn môn / đối tượng, lưu xong thêm vào giáo trình đó; tạo từ kho bài chỉ gắn môn, có thể thêm vào giáo trình sau khi lưu.
- Giáo án là kế hoạch dạy toàn môn dựa trên giáo trình, gồm nhiều buổi. Một buổi dùng nhiều bài; một bài dùng trong nhiều buổi. Giáo án mẫu dùng lại và có điều chỉnh riêng theo lớp. Không ghi đè mẫu khi sửa cho lớp.
- Tên bài không chứa số. Bài 1 / Bài 2 là số hiển thị trong tổ hợp giáo trình / chương trình; đổi vị trí đổi số, không đổi tên. Buổi 1 / Buổi 2 thuộc giáo án.
- Cây bấm tên môn xổ bài. Màn Bài học không có nút + Môn học mới ở cấp trang; nút tạo môn nằm ở bộ chọn môn khi soạn bài.

## Bài học, giáo trình, giáo án

Bài học là đơn vị có đối tượng, điều kiện đầu vào, đầu ra, học liệu, thực hành và kiểm tra. Học liệu gồm video, file trình chiếu / slide, thẻ VCWIKI, podcast, talk show (video hoặc âm thanh); người học xem / đọc / nghe. Có nhiều học liệu theo thứ tự trong một bài, bắt buộc hoặc tham khảo. Không bắt mọi bài có thẻ. Nguồn có thể từ kho, liên kết hoặc tệp; phụ đề / bản chép lời khi có. Người học vẫn phải tuân quyền nội dung và dữ liệu mật.

Bộ chọn thẻ cần xem danh sách và nội dung mẫu. Bộ chọn câu hỏi cho tạo câu ngay, lưu nháp và duyệt theo quy trình hiện hành; không tự dùng câu nháp cho kiểm tra đã phát hành.

Giáo trình: tên, môn, đối tượng, bậc chuyên môn hiện tại, đầu vào, đầu ra, tổ hợp bài / lý thuyết, ví dụ, bài tập, dự án cuối môn và tiêu chí đánh giá.

Giáo án: tên, giáo trình, đối tượng, danh sách buổi. Mỗi buổi có bài tham chiếu, mục tiêu, giảng viên, hình thức, chuẩn bị, hoạt động / thời lượng, việc giảng viên / người học, minh chứng đánh giá, bài tập sau buổi và điều chỉnh theo lớp. Lớp / đợt học chọn giáo án và phân công người dạy.

Chức danh tách khỏi năng lực chuyên môn: giám đốc học lĩnh vực mới có thể học nền tảng; chuyên viên lên quản lý cần bổ sung quản lý. Cùng môn / chủ đề có tổ hợp bài, thực hành và tiêu chí khác nhau.

## Hai dự án thực tiễn yêu cầu

1. Xây dựng kế hoạch kinh doanh 2027 cho xưởng VCS: dữ liệu 2026, khách hàng, đối thủ, công suất, chi phí; đầu ra là kế hoạch, dự toán, tiến độ, trách nhiệm, chỉ tiêu và trình bày. Thực tập sinh thu thập dữ liệu; staff xây từng phần; trưởng phòng tổng hợp; giám đốc đánh giá phương án / nguồn lực / rủi ro. Đây là gợi ý mẫu, không ánh xạ chức danh cứng.
2. Xây dựng kế hoạch SEO cho website X: hiện trạng, từ khóa, nội dung, việc kỹ thuật, lịch triển khai, ngân sách và chỉ tiêu. Thiết kế kế hoạch, không tự triển khai lên website thật.

Bài tập sau bài luyện kỹ năng; dự án cuối môn vận dụng tổng hợp. Cần đầu vào, nhiệm vụ, sản phẩm, thời hạn, cá nhân / nhóm, hướng dẫn, người chấm và tiêu chí đạt. Kết quả nhóm và đóng góp cá nhân riêng. Đạt trắc nghiệm / mở bài không có nghĩa đã hoàn thành dự án.

## Giới hạn của wireframe

Dữ liệu mẫu và thao tác cục bộ. Không tải tệp, phát video / âm thanh thật, lưu máy chủ hoặc đổi quyền. Các tham chiếu giáo trình / giáo án, nhiều phiên bản, lớp và phân công còn đơn giản; không dùng cấu trúc JavaScript của wireframe làm thiết kế dữ liệu sản xuất. Một số thao tác xoá chỉ minh hoạ trường hợp bị chặn. Không coi nút lưu mô phỏng là chức năng đã triển khai.

## Việc tiếp theo cho người nhận bàn giao

1. Đọc AGENTS.md, chạy `bash ra_nhanh.sh --ngan`; đọc BA 17.10–17.13 và DESIGN Phần 0 / V / VI. Kiểm nhánh mới nhất và các thay đổi chưa commit trước khi sửa.
2. Tiếp tục duyệt wireframe với chủ sản phẩm. Chốt ánh xạ khoa / bộ môn với cây tổ chức và lĩnh vực, giáo trình mặc định / các bản theo đối tượng, quyền soạn / duyệt / giảng dạy / chấm, phiên bản, nộp bài, rubric, trọng số, làm lại, công nhận tương đương và hoàn thành.
3. Sau khi duyệt mới viết DESIGN theo mẫu 0.6, mã mới không tái sử dụng. Bài học hiện tại gắn category; không tự thay thành khoa / bộ môn hoặc thay cây lĩnh vực tri thức. Có kế hoạch chuyển dữ liệu và quay lui; giữ bài đã giao, kết quả và phiên bản đang dùng.
4. Code theo DESIGN, kiểm thử thích hợp, thêm ca UAT; commit nhắc BA + DESIGN. Cập nhật BA trạng thái đúng code và DESIGN Đã làm @commit.
5. Chỉ merge khi có yêu cầu, kiểm phiên bản tài liệu develop theo AGENTS.md; không tự push remote. Người dùng trước đây yêu cầu tự push qua IDE.

## Hiện trạng kỹ thuật cần kiểm lại trước code

- API môn hiện là category: `backend/app/learn/course_api.py`; bài tạo / sửa trong `backend/app/learn/routes.py`, chưa có delete lesson.
- Category có CRUD; dùng lại chính sách hiện có, không suy quyền từ vai trò đào tạo. Bài đã phát hành khoá nội dung, sửa bằng bản sao.
- Frontend thư viện ở `CoursesPanel`; có `LessonsPanel` riêng cần kiểm việc sử dụng thực tế. Không triển khai dựa vào tên cũ trong ví dụ wireframe.
- BA LRN-15…17 / mục 17.12 giữ hiện trạng cũ; LRN-18…24 / mục 17.13 là đích. Không xoá lịch sử hoặc tự ghi Đã làm.
