// Nội dung trang Hướng dẫn sử dụng VCWIKI (/guide). Mỗi mục: id (neo #id), tiêu đề, nhóm người đọc, nút mở trang,
// thân bài Markdown (components/markdown.jsx — không đặt link trong thân bài, dùng `links` để mở trang trong app),
// `snippets` (tuỳ chọn): các đoạn chữ sao chép được (lời nhắn cho Claude) — Guide.jsx dựng khung + nút Sao chép.
// Tên nút / tab viết đúng như trên giao diện; đổi giao diện thì sửa ở đây cùng lượt.

export const AUDIENCE = {
  all: 'Mọi người',
  editor: 'Biên tập',
  reviewer: 'Người duyệt',
  learn: 'Học tập',
  marketing: 'Marketing',
  admin: 'Quản trị',
}

// Mục tổng quan 'content-engine' cố ý không có `links`: guide.for_path xếp mục theo nút mở trang, để Chat nhanh trỏ vào mục chi tiết.
export const SECTIONS = [
  {
    id: 'dao-tao-theo-mon',
    title: 'Đào tạo theo môn: giáo trình, giáo án và thực hành',
    audience: ['learn', 'editor', 'reviewer'],
    links: [{ to: '/learn/library?tab=subjects', label: 'Môn học' }, { to: '/learn/library?tab=programs', label: 'Chương trình học' }, { to: '/learn', label: 'Học tập của tôi' }],
    body: `
Thư viện xếp **Chương trình học → Môn học → Bài học**. Cây đào tạo riêng gồm **Khoa → Bộ môn → Môn học**; bấm môn để xổ bài. Đơn vị phụ trách, giảng viên và người học là các quan hệ riêng, không tự cấp quyền kho. Chức danh không quyết định năng lực chuyên môn.

Trong môn, tab **Giáo trình** chọn bài theo thứ tự, đối tượng, điều kiện đầu vào, đầu ra và thực hành / dự án; một bài dùng được trong nhiều giáo trình. Tab **Giáo án** chọn giáo trình, thêm nhiều buổi với bài, hoạt động, thời lượng và nhiệm vụ của hai phía. Tạo **Lớp học** từ giáo án đã phát hành; điều chỉnh lớp không sửa mẫu. **Chương trình học** chọn giáo trình từ nhiều khoa; **Lộ trình cá nhân** chọn phần cần học, mục tiêu và năng lực hiện tại.

Tạo bài luôn chọn môn; nút tạo môn ngay bộ chọn giữ nội dung đang soạn. Tạo từ giáo trình điền sẵn môn / đối tượng và thêm bài vào giáo trình khi lưu. Tên bài không ghi Bài 1 / Bài 2; số hiển thị theo giáo trình. Bài có học liệu theo thứ tự: video, trình chiếu, thẻ VCWIKI, podcast, talk show; nguồn liên kết HTTPS, tệp hoặc kho học liệu. Thẻ có xem trước; câu hỏi tạo ngay là nháp và cần duyệt trước phát hành. Không bắt bài có thẻ.

Tài liệu và nhiệm vụ: **Lưu nháp → người khác duyệt → Phát hành**. Bản đã duyệt / phát hành khoá nội dung; **Tạo bản sao** để sửa phiên bản mới. Xoá nháp đang được dùng sẽ bị chặn.

Ở **Học tập của tôi**, mở lớp / lộ trình để xem nội dung đã chụp, xác nhận học liệu bắt buộc sau khi xem / đọc / nghe, làm kiểm tra và thi cuối môn. Trong **Thực hành của tôi**, đọc nhiệm vụ, hạn và rubric; nộp sản phẩm cùng minh chứng đóng góp của từng thành viên khi làm nhóm. Người được phân công chấm ghi điểm từng tiêu chí, nhận xét và chốt; làm lại giữ lịch sử theo số lượt cho phép. Mở học liệu không hoàn thành thực hành. Công nhận tương đương cần người có quyền chấm quyết định bằng minh chứng cùng bài đã học; dự án của lớp đích vẫn phải đạt.

Các tab **Môn học kiểu cũ / Lộ trình kiểu cũ** giữ dữ liệu và kết quả cũ. Chuyển bài nháp sang môn dùng bảng ánh xạ đã xác định, thử trên QA; không tự biến cây lĩnh vực tri thức thành khoa / bộ môn.
`,
  },
  {
    id: 'bat-dau',
    title: 'Bắt đầu trong 5 phút',
    audience: ['all'],
    links: [{ to: '/wiki', label: 'Mở VCWIKI' }, { to: '/kb', label: 'Mở Kho tư liệu' }],
    body: `
VCWIKI là kho tri thức nội bộ của VC Phồn Vinh, gồm **hai tầng**:

- **Kho tư liệu** (tầng thô): link, video, PDF, ảnh, file Office, ghi âm… đã nạp và **chuyển thành chữ**, chưa phân tích.
- **VCWIKI** (tầng tinh): **thẻ tri thức** đã chắt lọc từ Kho tư liệu — mỗi thẻ là một ý dùng được ngay (khái niệm, quy trình, checklist, bài học…), có dẫn nguồn.

Năm phút đầu tiên:

1. Vào **VCWIKI**, gõ điều bạn cần vào ô *Tìm trong thẻ* — gõ không dấu cũng được.
2. Bấm tên một thẻ để mở **khung thẻ** ở bên phải màn hình (danh sách vẫn nằm phía sau): đọc *Tóm tắt*, *Ý chính*, *Khi nào dùng*, *Ví dụ*, bấm **Nguồn** để xem tài liệu gốc. Bấm **Esc** hoặc nền mờ để đóng.
3. Thấy hay thì chấm sao, góp ý ở *Thảo luận*, hoặc **🔊 Nghe thẻ** khi đang di chuyển.
4. Có tài liệu đáng giữ? Nạp vào **Kho tư liệu** — AI sẽ dựng thành thẻ nháp để người có quyền duyệt.
5. Cần hỏi nhanh? Bấm **Hỏi Claude** ở góc dưới bên phải — cửa sổ **Chat nhanh** mở ngay trên trang đang xem, Claude biết bạn đang ở trang nào.

Bạn chỉ thấy tư liệu và thẻ trong những **kho** bạn được xem (kho cá nhân của bạn, kho chia sẻ bạn là thành viên, kho công khai trong công ty).

**Giao diện sáng / tối:** bấm tên bạn ở cuối thanh bên → dòng *Giao diện* chọn **Theo máy** (theo cài đặt máy tính / điện thoại), **Sáng** hoặc **Tối**. Lựa chọn được nhớ trên trình duyệt đó.

Gõ sai đường dẫn hoặc mở link tới trang không có (hay trang bạn không có quyền), app hiện **Không tìm thấy trang** kèm nút *Về Việc của tôi*.

**Menu** xếp theo việc: trên cùng là **Việc của tôi** (trang đầu — những việc đang chờ bạn: đề xuất chờ duyệt, bài học được giao, bài chờ chấm, nội dung viết lỗi, nguồn lỗi; mỗi dòng bấm vào là tới đúng màn đã lọc, số chờ hiện cạnh tên menu), rồi bốn nhóm **Tri thức** (Kho tư liệu · VCWIKI · Hộp duyệt), **Nội dung** (Dự án marketing · Viết nhanh · Chiến dịch · Cài đặt nội dung), **Học tập**, **Tổ chức**; *Trò chuyện Claude* và *Hướng dẫn* ở cuối. Các màn phụ nằm thành tab trong màn chính: *Tiến độ tinh chế* là tab của Kho tư liệu; *Bản đồ*, *Danh sách phát*, *Bình chọn tháng* là tab của VCWIKI. Trên điện thoại menu là thanh dưới 5 nút, nút **Thêm** mở menu đầy đủ.

Đội marketing: xem thêm nhóm mục **Content Engine** bên dưới (đường đi chuẩn → Dự án marketing → Phân tích 7P → Chiến dịch → Viết nhanh).
`,
  },
  {
    id: 'tim-doc',
    title: 'Tìm và đọc thẻ',
    audience: ['all'],
    links: [{ to: '/wiki', label: 'Mở VCWIKI' }],
    body: `
**Tìm**: ô *Tìm trong thẻ* tìm cả theo từ khoá (không phân biệt dấu) lẫn theo nghĩa — gõ câu hỏi dài như "khách chê đắt thì nói gì" cũng ra thẻ gần nghĩa. Thẻ chỉ cần khớp một phần câu.

**Lọc** (hàng ô chọn phía trên danh sách):

- *Tất cả kho tôi xem được* — chỉ xem một kho.
- *Mọi loại thẻ* — Framework, Khái niệm, Case study, Quy định, Insight, Hook, Bài học, SOP, Checklist, Mẫu biểu, KPI.
- Trạng thái — *Nháp*, *Đã duyệt*, *Loại*. Thẻ **Đã duyệt** là tri thức chính thức; thẻ **Nháp** còn chờ người duyệt.
- *Mọi tag*, *Mọi cấp độ*, *Mọi division*, *Mọi bước quy trình*.

**Cây lĩnh vực** bên trái: bấm một nhánh để lọc (bấm lại để bỏ lọc), *⊞ Mở hết* / *⊟ Thu hết* để mở toàn bộ cây. Khung *✎ Sửa cây lĩnh vực* cũng thu / mở được từng nhánh (▸ / ▾) và cả cây. Bấm *Xoá* ở một nhánh (kể cả nhóm cấp 1) là xoá cả nhánh con; nếu còn thẻ, tài liệu gắn vào thì chọn nhánh nhận để chuyển sang rồi mới xoá — muốn giữ nhánh thì bấm *Ẩn*.

**Cây v2:** nhánh con tạo trong cây v2 được AI dùng khi phân loại. Sau khi hoàn tất chuyển dữ liệu và kiểm tra không còn tham chiếu cây cũ, vận hành có thể ẩn cây cũ để tránh hai nhánh cùng tên. Việc chuyển có chạy thử và nhật ký để quay lui; giữ các nhánh đã ẩn riêng.

**Liên kết tra cứu**: nhánh lĩnh vực có gắn web tra cứu (vd web tra mã phụ tùng các hãng VCPV phân phối) thì khi lọc nhánh đó (hoặc nhánh con) sẽ hiện khung *Liên kết tra cứu* phía trên danh sách thẻ — bấm để mở ở tab mới (các web này không cho nhúng vào VCWIKI). Thêm / sửa ở *✎ Sửa cây lĩnh vực* → *Sửa* nhánh → ô liên kết, mỗi dòng *Tên | https://… | ghi chú*.

**Hai cách xem**:

- **Lưới** — 30 thẻ mỗi trang.
- **Lộ trình** — khi đã chọn một lĩnh vực: thẻ xếp theo chặng từ bậc thấp lên cao (Nhập môn → Thực thi → Vận hành → Thiết kế → Điều hành), hợp để tự học một mảng từ đầu.

**Cấp độ người đọc** của thẻ:

| Cấp độ | Dành cho |
|---|---|
| Nhập môn | thuật ngữ, quy trình một trang, việc đơn giản đầu tiên |
| Thực thi | làm từng bước, mẫu biểu, lỗi hay gặp |
| Vận hành | phân việc, checklist tuần, review đầu ra, KPI cá nhân |
| Thiết kế | thiết kế hệ thống, chọn công cụ, đặt KPI, ngân sách |
| Điều hành | đáng tiền không, đo bằng gì, khi nào biết hỏng, hỏi cấp dưới câu gì |

**Division**: thẻ gắn VCpart, VCsoft, VCOBD, VCservice, VCE, VCmedia hoặc *Tập đoàn* (dùng chung mọi đơn vị).
`,
  },
  {
    id: 'khung-the',
    title: 'Khung thẻ: đọc, nghe, góp ý',
    audience: ['all'],
    body: `
Bấm một thẻ ở bất cứ đâu (VCWIKI, Trò chuyện Claude…) là mở **khung thẻ** ở bên phải màn hình (nút *Toàn màn hình* để đọc rộng, lần sau nhớ). Khung có tab *Nội dung · Thảo luận · Lịch sử · Duyệt*; chân khung có một nút chính theo trạng thái (thẻ nháp → *Gửi duyệt*, chờ duyệt → *Duyệt*, đã duyệt → *Đề xuất sửa*) và menu **Thêm ▾** cho việc ít dùng (*Về nháp*, *Từ chối*, *Sao chép sang kho*, *Xoá*…). Trên điện thoại khung phủ kín màn hình. Đóng bằng nút **✕**, phím **Esc** hoặc bấm ra nền mờ.

Dòng đầu cho biết: trạng thái (*Nháp* / *Đã duyệt* / *Loại*), nguồn gốc (*AI tổng hợp*, *AI tạo*, *Sao chép*, *Viết tay*), người tạo, người duyệt, số **Bản** hiện tại.

Tab **Nội dung**:

- Lĩnh vực, cấp độ, division, bước quy trình, ngày hiệu lực / hạn rà soát.
- **Chấm sao** 1–5 (không tự chấm thẻ của mình) — sao được tính vào *Bình chọn tháng*.
- **🔊 Nghe thẻ**: chọn giọng và tốc độ, bấm *■ Dừng* để dừng.
- **≡+ Danh sách phát**: thêm thẻ vào danh sách để nghe / đọc lần lượt.
- *Ý chính*, *Khi nào dùng*, *Ví dụ*, *Căn cứ*, tag, và **Nguồn** / *Tổng hợp từ N tài liệu* — bấm để xem tài liệu gốc ngay trong khung, kèm *link gốc ↗*.
- **Thảo luận**: góp ý, bổ sung, đặt câu hỏi; trả lời theo luồng, chấm sao bình luận hay.

Tab **Lịch sử**: mọi phiên bản của thẻ (xem mục *Sửa thẻ đã duyệt & lịch sử phiên bản*).
`,
  },
  {
    id: 'nap-tu-lieu',
    title: 'Nạp tư liệu vào Kho',
    audience: ['editor'],
    links: [{ to: '/kb', label: 'Mở Kho tư liệu' }, { to: '/kb/notes', label: 'Mở Ghi chép' }, { to: '/discover', label: 'Tìm video theo chủ đề' }],
    body: `
Vào **Kho tư liệu** → khung nạp ở đầu trang:

1. **Dán link** — mỗi dòng một link: bài viết, Google Docs / Sheets / Slides / file Drive, video hoặc cả kênh TikTok / YouTube / Facebook. Hệ thống tự nhận loại link.
2. Hoặc **⤒ Chọn file** / kéo thả / dán ảnh chụp màn hình (Ctrl/⌘+V): PDF, ảnh, Word / PowerPoint / Excel, ghi âm, video.
3. Chọn **Lưu vào kho** (mặc định kho cá nhân — ghi âm cuộc họp nên để kho cá nhân trước), gợi ý **Lĩnh vực** (tối đa 3) và **Tag** nếu muốn.
   Ô **Ghi chú của bạn** (không bắt buộc, tối đa 2000 ký tự): ghi điều bạn thích, vì sao lưu, cần chú ý gì — AI dùng làm gợi ý khi phân loại lĩnh vực và chọn ý nhấn mạnh, không chép vào thẻ. Sửa lại sau trong chi tiết nguồn → **Lưu ghi chú**.
4. Chọn **Dựng thẻ VCWIKI**: *Tự động* (video mạng xã hội chỉ chuyển chữ, loại khác dựng thẻ), *cho tất cả*, hoặc *Chỉ chuyển thành chữ*.
5. Bấm **Nạp vào kho**.

Lưu ý:

- Link Google phải chia sẻ **"Bất kỳ ai có đường liên kết"** (Người xem) — link riêng tư bị chặn, hệ thống báo *⚠ Chưa chia sẻ*. Chưa hỗ trợ cả thư mục Drive.
- Nhiều ảnh cùng lúc: tick *Gộp N ảnh thành 1 tài liệu*.
- Video / kênh: đặt *Video tối đa / kênh* (0 = lấy tất cả); TikTok / Facebook chặn thì chọn *Cookie trình duyệt*.
- Link đã có trong kho thì được bỏ qua, không nạp trùng.

Trạng thái nguồn: *Chờ xử lý* → *Đang chuyển thành chữ* → *Đã chuyển chữ* → *Đang dựng VCWIKI* → *Hoàn tất*. Video và ghi âm xếp hàng riêng (*Làn Whisper*), có giờ dự kiến xong. Máy chỉ chạy **một việc nặng một lúc**, theo thứ tự: chuyển thành chữ → dịch sang tiếng Việt → vector hoá tầng thô → tinh chế (dựng thẻ) → vector hoá thẻ. Bước sau đợi bước trước làm xong cả loạt — vd video tiếng nước ngoài của một kênh được chép chữ hết rồi mới dịch, dịch xong mới dựng thẻ. Khung hàng chờ ghi *▶ Đang làm …* và *⏸ Tạm dừng, làm sau …*.

**Ghi chép** — ghi lại điều muốn nhớ về cả nguồn (một kênh, một album) hay từng video / file, ai xem được nguồn đều ghi được:

1. Mở nguồn → khung **Ghi chép** ghi cho *cả nguồn*; ở từng tài liệu bấm **Ghi chép (n)** để ghi riêng cho video / file đó. Bấm **Xem video** ở một tài liệu thì video nằm bên phải, ô *Ghi chép khi xem* nằm ngay bên trái — vừa xem vừa gõ, **Ctrl / ⌘ + Enter** để lưu, mốc giây tự gắn (lấy lúc bắt đầu gõ); ghi chép hiện *▶ mm:ss*, bấm vào tua video tới đúng giây.
2. Tab **Ghi chép** (\`/kb/notes\`) gom mọi ghi chép theo nguồn, mới nhất trước: tìm chữ, lọc theo kho, **nguồn** (xem cả kênh), **tài liệu**, *Chỉ của tôi*, loại (*Ghi chép* / *Khi nạp* — ghi chú của người nạp). Bộ lọc nằm trên đường dẫn, gửi link cho đồng nghiệp là mở đúng chỗ.
3. Sửa / xoá: người viết, hoặc chủ kho. AI dựng thẻ và tổng hợp đọc ghi chép làm gợi ý phân loại, không chép vào thẻ.

**Tìm trong tư liệu thô**: chuyển ô tìm sang **Theo nội dung** để hỏi thẳng vào nội dung tài liệu (vd "bao lâu thay dầu hộp số"), không chỉ tên file.

**Tìm video theo chủ đề**: gõ nội dung cần tìm → *✦ Phân tích từ khoá* → sửa từ khoá → chọn TikTok / YouTube / Google → *⌕ Tìm video* → tick video → *⤓ Tải về & chuyển chữ…*.
`,
  },
  {
    id: 'dung-the',
    title: 'Từ tư liệu thành thẻ',
    audience: ['editor'],
    links: [{ to: '/refine', label: 'Mở Tiến độ tinh chế' }],
    body: `
Có hai cách để AI dựng thẻ từ tư liệu:

**1. Dựng thẻ từng tài liệu** — mặc định khi nạp. Mở nguồn trong Kho tư liệu → mỗi tài liệu có *Dựng thẻ* / *Dựng lại*.

**2. ✦ Tổng hợp theo chủ đề** — nên dùng cho kênh video hoặc nguồn có nhiều tài liệu ngắn nói lặp ý. Mở nguồn → **Tổng hợp N tài liệu**. AI làm 4 bước:

1. **Sàng lọc** — chấm độ hữu ích từng tài liệu, đề xuất bỏ tài liệu kém.
2. **Gom cụm** — nhóm tài liệu cùng ý.
3. **Bạn duyệt kế hoạch** — đổi tên cụm, chọn lĩnh vực, số thẻ (1–3), ghi chú cho AI, chuyển / bỏ tài liệu → **✦ Viết thẻ**.
4. **Viết thẻ** — mỗi cụm 1–3 thẻ nháp, dẫn về mọi tài liệu đã dùng (link + mốc thời gian + trích dẫn).

Nội dung của bên ngoài (không phải của công ty) thì tick *Nội dung của bên ngoài* để gắn tag.

**Tiến độ tinh chế** (tab cuối của Kho tư liệu): công tắc *Tổng hợp / Trực tiếp*; ở *Tổng hợp* có tab theo trạng thái (*Hàng chờ AI*, *Đang tổng hợp*, *Đã vào VCWIKI*, *Lỗi*…), chọn nhiều tài liệu rồi dùng menu **Thao tác ▾** để *Ưu tiên*, *Bỏ qua (không dựng thẻ)*, *Ngừng tinh chế* / *Chạy tiếp*; *Trực tiếp* xem AI đang làm gì theo thời gian thực.

Thẻ AI dựng luôn ở trạng thái **Nháp** và tự vào **Hộp duyệt** — chỉ thành tri thức chính thức khi có người duyệt.
`,
  },
  {
    id: 'tao-the',
    title: 'Tạo và sửa thẻ tay',
    audience: ['editor'],
    links: [{ to: '/wiki', label: 'Mở VCWIKI' }],
    body: `
Nút **+ Thẻ mới** (ở trang VCWIKI) hiện khi bạn là *Chủ kho* hoặc *Được sửa* ở ít nhất một kho.

Điền: **Kho**, **Loại thẻ**, **Tiêu đề**, **Lĩnh vực**, *Cấp độ người đọc*, *Ngày hiệu lực*, *Rà soát (tháng)*, *Division* (bỏ trống = Tập đoàn), *Bước quy trình* (tối đa 2), rồi nội dung: *Tóm tắt*, *Nội dung chi tiết (markdown)*, *Ý chính (mỗi dòng một ý)*, *Khi nào dùng*, *Ví dụ*, *Trích dẫn căn cứ*, *Tag* → **Tạo thẻ**.

Thẻ nháp: mở thẻ → **Sửa** để chỉnh, **Gửi duyệt** khi xong, **Xoá** nếu không cần. **Sao chép sang** một kho khác (kho bạn sửa được) — bản sao là thẻ nháp mới.

Viết thẻ tốt:

- **Một thẻ một ý**, tiêu đề là chính kết luận ("Chốt đơn giả định khách đã mua…"), không phải chủ đề chung chung.
- *Ý chính* 3–5 dòng; *Khi nào dùng* nói rõ tình huống; *Ví dụ* lấy từ việc thật của công ty.
- Luôn có **Căn cứ** / nguồn để người đọc kiểm lại.
`,
  },
  {
    id: 'duyet',
    title: 'Duyệt tri thức',
    audience: ['reviewer'],
    links: [{ to: '/wiki/review', label: 'Mở Hộp duyệt' }],
    body: `
Mọi thẻ phải được duyệt mới thành tri thức chính thức. Vào **Hộp duyệt**: tab *Chờ tôi duyệt*, *Tôi đề xuất*, *Gần đây*, *Duyệt hàng loạt*. Màn chia đôi: bên trái là danh sách đề xuất, bên phải là chi tiết đề xuất đang mở (*Bản hiện tại* / *Bản đề xuất*, kết quả cổng so sánh). Bấm **Duyệt** hoặc **Từ chối** (phải ghi lý do) — đề xuất kế tiếp tự mở; trong 8 giây có nút **Hoàn tác** trên thông báo (chưa gửi gì cho tới khi hết 8 giây). Màn hẹp / điện thoại: chi tiết mở thành ngăn kéo.

**Ai duyệt** — hai bước:

- **Bước 1**: người được sửa kho chứa thẻ.
- **Bước 2**: theo cấp độ thẻ — *Nhập môn / Thực thi / Vận hành*: chủ nhánh lĩnh vực chính (chưa gán thì quản trị viên); *Thiết kế / Điều hành*: quản trị viên.
- **Bốn mắt**: không ai tự duyệt nội dung mình viết; người bước 2 khác người bước 1. Thẻ do AI viết thì người nạp tài liệu vẫn duyệt được.
- Khi dùng thử, quản trị viên đặt *Số người duyệt tối thiểu* = *1 (dùng thử)* — một người đủ điều kiện duyệt là xong.

**Duyệt một thẻ**: bấm đề xuất để xem nội dung / phần thay đổi và kết quả **cổng so sánh** với thẻ sẵn có — *MỚI*, *TRÙNG*, *BỔ SUNG*, *MÂU THUẪN*, *NHIỄU* → **✓ Duyệt**, **Từ chối** (bắt buộc ghi lý do) hoặc **Nhận xét**. Đề xuất quá 3 ngày làm việc có nhãn *Quá hạn*.

**Duyệt hàng loạt**: tab *Duyệt hàng loạt* → chọn *Nhánh*, *Bậc*, *Division*, *Loại* → danh sách tự tải theo bộ lọc (bộ lọc nằm trên đường dẫn, gửi link cho người khác được) → bỏ tick thẻ không muốn → **Duyệt N thẻ** (hoặc *Từ chối N thẻ* kèm nhận xét chung). Mặc định loại ra: thẻ độ tin cậy thấp, thẻ chưa xếp cây, thẻ cổng so sánh xếp NHIỄU / TRÙNG, thẻ chưa có kết quả cổng so sánh — tick ô tương ứng nếu muốn gộp. Thẻ bạn là tác giả bị bỏ qua kèm lý do *Bạn là tác giả (bốn mắt)*.
`,
  },
  {
    id: 'sua-the-da-duyet',
    title: 'Sửa thẻ đã duyệt & lịch sử phiên bản',
    audience: ['editor', 'reviewer'],
    body: `
Thẻ **đã duyệt không sửa thẳng** — mọi thay đổi là một đề xuất, thẻ giữ nội dung cũ tới khi đề xuất được duyệt:

- **Đề xuất sửa** → sửa nội dung → ghi *Tóm tắt thay đổi* và *Mức thay đổi*: **Nhỏ** (chữ, tag, phân loại — không phải học lại) hay **Lớn** (kết luận, số liệu, các bước — người đã học phải học lại) → **Gửi đề xuất**.
- **Đề xuất lỗi thời** khi thẻ không còn đúng (ghi lý do).
- Người đề xuất theo dõi ở Hộp duyệt → tab *Tôi đề xuất*; thẻ đã lên bản mới trong lúc chờ thì bấm *Cập nhật lên bản mới*.
- Người duyệt thấy đề xuất cần sửa thêm thì bấm **Trả về** (ghi lý do, bắt buộc) thay vì từ chối: đề xuất không bị đóng, người đề xuất thấy dòng *Đề xuất cần sửa* ở *Việc của tôi* và nhãn **Cần sửa** ở tab *Tôi đề xuất* → **Sửa và gửi lại** → đề xuất về lại đúng người duyệt, hạn tính lại. Trong lúc bị trả về, người duyệt không duyệt / từ chối được; người đề xuất vẫn *Rút* được.

Tab **Lịch sử** trong khung thẻ: mỗi **Bản N** ghi người viết, người duyệt, lý do, thời điểm; bản đang dùng có nhãn *Hiệu lực*.

- **Xem** — đọc nội dung bản cũ.
- **So sánh bản … với bản …** — dòng xanh là thêm, dòng đỏ gạch ngang là bỏ.
- **Quay về bản này** — ghi lý do; hệ thống tạo **bản mới** mang nội dung cũ (không bản nào bị xoá). Thẻ đã duyệt thì việc quay về cũng là một đề xuất chờ duyệt.
`,
  },
  {
    id: 'kho-chia-se',
    title: 'Kho & chia sẻ',
    audience: ['all'],
    links: [{ to: '/spaces', label: 'Mở Kho & chia sẻ' }],
    body: `
Mọi tư liệu và thẻ nằm trong một **kho**. Quyền xem / sửa đi theo kho.

- **Kho cá nhân** (★): chỉ mình bạn thấy, trừ khi bạn mời người khác.
- **Kho chia sẻ**: làm chung theo nhóm / phòng. Tạo bằng **+ Kho chia sẻ mới** → *Tên kho*, *Mô tả*, tick **Công khai trong công ty** nếu muốn mọi người được xem.

Bấm **Quản lý** ở một kho để mở khung kho: tab *Thông tin* (tên, công khai / riêng tư — có hỏi lại kèm số thẻ / nguồn bị ảnh hưởng), tab *Thành viên*, tab *Nguy hiểm* (xoá kho, phải gõ đúng tên kho). **Chia sẻ theo đơn vị**: tab *Thành viên* → **Chia sẻ kho** → chọn *Đơn vị* trên cây cơ cấu tổ chức, quyền *Xem* hoặc *Sửa*, tick *Gồm đơn vị con* nếu muốn — ai đang thuộc đơn vị đó tự có quyền, chuyển đơn vị thì tự mất; người vừa được mời riêng vừa thuộc đơn vị lấy quyền cao hơn.

Vai trò trong kho:

| Vai trò | Được làm |
|---|---|
| Chủ kho | mọi việc, quản lý thành viên, xoá kho (khi kho rỗng) |
| Được sửa | nạp nguồn, tạo / sửa thẻ nháp, duyệt bước 1 |
| Chỉ xem | đọc tư liệu và thẻ |

Mời người: kho của bạn → **Quản lý** → *Email người được mời* + vai trò → **Mời**. Đổi vai trò hoặc bỏ thành viên ngay trong danh sách *Thành viên*. Không muốn ở một kho nữa: **Rời kho**.

Không thấy một thẻ đồng nghiệp nói tới? Thường là bạn chưa ở trong kho chứa thẻ đó — nhờ chủ kho mời.
`,
  },
  {
    id: 'nghe-binh-chon',
    title: 'Danh sách phát, bình chọn, bản đồ tri thức',
    audience: ['all'],
    links: [
      { to: '/playlists', label: 'Danh sách phát' },
      { to: '/leaderboard', label: 'Bình chọn tháng' },
      { to: '/wiki/graph', label: 'Bản đồ tri thức' },
    ],
    body: `
**Danh sách phát** — gom thẻ để nghe giọng đọc và đọc lần lượt, như playlist:

- Thêm thẻ từ khung thẻ (**≡+ Danh sách phát**), hoặc ở trang VCWIKI bấm **▶ Lưu thành danh sách phát** để lưu mọi thẻ đang lọc.
- Trình phát: phát / dừng (**Space**), thẻ sau (**Shift+N**), thẻ trước (**Shift+P**), *Trộn bài*, lặp danh sách / lặp thẻ; *Lên* / *Xuống* để đổi thứ tự.
- Danh sách **🌐 Công khai** hiện cho đồng nghiệp ở mục *Công khai từ đồng nghiệp*.

**Bình chọn tháng** — mỗi tháng tôn vinh người đóng góp tri thức:

- Chấm 1–5 sao cho thẻ hoặc bình luận (không tự chấm mình).
- Sao của thẻ tính cho người tạo thẻ; thẻ AI dựng tính cho người nạp tài liệu.
- Sao tính vào tháng của lần chấm đầu; tháng cũ bị khoá. Bằng sao thì xét số bình luận.

**Bản đồ tri thức** — mỗi chấm là một thẻ, nối theo lĩnh vực, tag, cùng nguồn, chủ đề AI. Tìm nút trên đồ thị (Enter để tới kết quả đầu), bật / tắt từng lớp, *⤓ Xuất Obsidian vault* để mang ra Obsidian.
`,
  },
  {
    id: 'content-engine',
    title: 'Content Engine: đường đi chuẩn để làm marketing',
    audience: ['marketing'],
    body: `
Nhóm menu **Content Engine** giúp đội marketing đi từ *hiểu khách và sản phẩm* tới *bài đăng có căn cứ* mà không phải dán lại tư liệu mỗi lần. Bốn cấp quản lý:

| Cấp | Là gì | Ở đâu |
| --- | --- | --- |
| **Dự án** | Việc dài hạn, VD *Marketing xưởng VCS*: gom tài nguyên tham chiếu, thẻ VCWIKI cần học, thành viên, phân tích 7P | Dự án marketing |
| **Kế hoạch kỳ** | Quý / tháng: mục tiêu, KPI theo kênh, duyệt trước rồi mới lập chiến dịch | *sắp có* |
| **Chiến dịch** | Một đợt có thông điệp, thời gian, các kênh bật; AI lập chiến lược và kế hoạch từng luồng | Chiến dịch |
| **Nội dung theo kênh** | Kịch bản video, bài SEO, bài mạng xã hội: AI viết, tự chấm, người duyệt | Trong chiến dịch, hoặc Viết nhanh cho bài lẻ |

**Đường đi chuẩn** (lần đầu mất khoảng một buổi, sau đó mỗi chiến dịch chỉ vài phút):

1. **Tạo dự án** và nạp *tài nguyên*: video viral trong Kho video, trang web đối thủ / top Google, bài mạng xã hội mẫu, tài liệu trong Kho tư liệu. Ghim *thẻ VCWIKI* mà đội cần đọc.
2. **Phân tích 7P**: AI soạn nháp có mã căn cứ, bạn sửa, chủ dự án chốt. Đây là "kim chỉ nam" để mọi bài sau nhất quán về định vị, giá, kênh, con người.
3. **Lập chiến dịch trong dự án**: brief ngắn, phần tham chiếu để trống thì hệ thống lấy từ kho dự án và 7P đã chốt. AI trả chiến lược, kế hoạch N tập / bài, rồi viết từng mục, tự chấm dưới 80 điểm thì sửa.
4. **Duyệt** từng kịch bản / bài, sao chép đi đăng. Bài lẻ ngoài kế hoạch thì dùng **Viết nhanh trong dự án**.

Chưa có dự án vẫn dùng được Chiến dịch và Viết nhanh như trước — chỉ phải dán tham chiếu tay. Mỗi mục dưới đây hướng dẫn chi tiết một bước.
`,
  },
  {
    id: 'du-an-marketing',
    title: 'Dự án marketing: tài nguyên, thẻ học, thành viên',
    audience: ['marketing'],
    links: [{ to: '/studio/projects', label: 'Mở Dự án marketing' }],
    body: `
**Tạo dự án.** Vào **Dự án marketing** → **+ Dự án mới**: tên, kho lưu, mục tiêu (viết rõ con số mong muốn — AI dùng câu này khi phân tích), mô tả bối cảnh. Người tạo là **Chủ dự án**. Chiến dịch và bài viết trong dự án sẽ nằm ở kho này.

**Tab Tài nguyên** — kho tham chiếu dùng chung cho mọi chiến dịch của dự án. Bấm **+ Thêm tài nguyên**, chọn loại ở thanh trên:

- *Video Kho video* (mã **R**…): gõ để lọc video đã chuyển chữ, xếp theo điểm viral, bấm **+ Thêm** từng video. Lời thoại video được chụp lại làm căn cứ.
- *Trang web* (mã **S**…): dán link trang đối thủ, trang top Google, bài báo; hệ thống tải và trích nội dung, đề mục.
- *Bài mẫu MXH* (mã **P**…): chọn kênh, dán bài mạng xã hội bạn thấy hay (tối thiểu 20 ký tự), có thể kèm link bài gốc.
- *Tài liệu Kho tư liệu* (mã **D**…): tìm theo tên tài liệu trong các kho bạn xem được (bảng giá, quy trình, tờ rơi đã nạp).

Mỗi mục có ô **Ghi chú** (vì sao tham khảo) — AI đọc ghi chú này. Bấm **Xem** để đọc nội dung đã chụp, **Bỏ** để gỡ; mã không đánh lại nên căn cứ của bài cũ vẫn đúng. Tối đa 60 tài nguyên mỗi dự án.

**Tab Thẻ học** — ghim **thẻ VCWIKI** (mã **K**…) và **khoá học** (mã **L**…) mà thành viên nên đọc trước khi làm; thẻ ghim cũng là căn cứ ưu tiên khi AI lập chiến dịch và Viết nhanh trong dự án. Gõ từ khoá → **+ Ghim**.

**Tab Tổng quan** — mục tiêu, số liệu, phân tích hiện hành, và **thành viên**. Quyền có hai lớp: ai xem được *kho* thì xem được dự án, ai sửa được kho thì sửa được dự án. Chủ dự án mời thêm người theo **email** với vai trò riêng cho dự án:

| Vai trò | Được làm gì |
| --- | --- |
| Chủ dự án | Mọi việc: sửa dự án, mời / đổi vai trò thành viên, chốt phân tích, lưu trữ |
| Biên tập | Thêm / bỏ tài nguyên, ghim thẻ, soạn phân tích, lập chiến dịch, viết bài |
| Người duyệt | Duyệt nội dung (đợt sau), xem mọi thứ |
| Chỉ xem | Chỉ đọc |

Người ngoài kho được mời vẫn xem được dự án, tài nguyên và phân tích; chiến dịch và bài viết hiện vẫn theo quyền kho. Dự án luôn phải còn ít nhất một chủ dự án.

**Tab Chiến dịch / Viết nhanh** — danh sách chiến dịch và bài đã gắn vào dự án, nút **+ Chiến dịch trong dự án** / **+ Viết nhanh trong dự án**. Chiến dịch hoặc bài có sẵn muốn gắn vào dự án: mở trang của nó, chọn ở ô **Thuộc dự án** (chỉ dự án cùng kho).

**Kết thúc dự án**: bấm **Lưu trữ** (ẩn khỏi danh sách mặc định, mở lại được). Dự án đã có chiến dịch / bài thì không xoá được, chỉ lưu trữ.
`,
  },
  {
    id: 'phan-tich-7p',
    title: 'Phân tích 7P: kim chỉ nam của dự án',
    audience: ['marketing'],
    links: [{ to: '/studio/projects', label: 'Mở Dự án marketing' }],
    body: `
**7P** là khung phân tích marketing dịch vụ: **Sản phẩm** (Product) · **Giá** (Price) · **Phân phối** (Place) · **Truyền thông** (Promotion) · **Con người** (People) · **Quy trình** (Process) · **Bằng chứng hữu hình** (Physical evidence). Làm xong bản 7P, mọi chiến dịch và bài viết trong dự án đều bám theo một định vị, một mức giá, một cách nói về con người và bằng chứng — không mỗi bài một kiểu.

**Cách làm** (tab **Phân tích** của dự án):

1. Nạp tài nguyên và ghim thẻ trước (mục *Dự án marketing*). Càng nhiều căn cứ thật — bảng giá, quy trình, bài khách khen, video của đối thủ — bản phân tích càng ít phải đoán.
2. Bấm **✦ AI soạn nháp 7P**. AI đọc mục tiêu dự án, toàn bộ tài nguyên và thẻ ghim; mỗi mục 4–10 câu, kèm **mã căn cứ** (R1, S2, P1, D1, K3…) — bấm chip mã để mở tài nguyên / thẻ gốc. Điều chưa có dữ liệu AI ghi vào **Câu hỏi còn mở** thay vì bịa. Thường mất 1–3 phút, trang tự cập nhật.
3. Đọc và **sửa**: bấm vào ô của mục, sửa chữ, thêm / bớt mã căn cứ (mã phải có trong dự án), rồi **Lưu sửa**. Muốn AI làm lại theo ý mình: gõ yêu cầu ở *Soạn lại bằng AI theo yêu cầu* → **✦ AI soạn lại** (AI viết trên nền bản hiện có).
4. Chủ dự án bấm **✓ Chốt phiên bản**. Bản đã chốt **không sửa được** và trở thành *phân tích hiện hành* (hiện ở tab Tổng quan và trên tab Phân tích).
5. Muốn cập nhật sau này: bấm **✦ AI soạn nháp 7P** hoặc **Bản trống** để có phiên bản mới (v2, v3…), sửa rồi chốt. Chiến dịch / bài đã tạo trước đó vẫn giữ bản cũ làm căn cứ — không bị lệch.

Máy chưa có AI (hoặc AI đang tạm ngưng): tạo **Bản trống**, điền tay từng mục rồi chốt như thường. Bản nháp không cần nữa thì **Xoá nháp**.

Mẹo: trước khi chốt, đọc *Câu hỏi còn mở* — thường là chỗ đội cần bổ sung tài nguyên (giá đối thủ, số liệu khách quay lại…). Bổ sung xong bấm *AI soạn lại* một lần nữa.
`,
  },
  {
    id: 'xuong-chien-dich',
    title: 'Chiến dịch: từ brief đến kịch bản, bài viết',
    audience: ['marketing'],
    links: [{ to: '/studio', label: 'Mở Chiến dịch' }, { to: '/studio/authors', label: 'Người đứng tên' }],
    body: `
**Chiến dịch** (menu *Nội dung*) biến một brief thành chiến lược, kế hoạch nhiều tập / bài và nội dung hoàn chỉnh cho 3 luồng: **video ngắn** (TikTok / Reels / Shorts), **bài website chuẩn SEO**, **bài mạng xã hội** (Fanpage, Facebook cá nhân, LinkedIn…). AI viết, tự kiểm tra và tự chấm; người chỉ duyệt.

**Lập chiến dịch** — **+ Chiến dịch mới** (hoặc **+ Chiến dịch trong dự án** từ trang dự án):

1. **Brief**: tên, *Thuộc dự án* (chọn thì kho và tham chiếu lấy theo dự án), luồng nội dung, sản phẩm, mục tiêu kinh doanh, đối tượng, số tuần, CTA, giới hạn / điều cấm. Luồng video có *Nền tảng*, *Video / tuần*, *Độ dài video*, *Nhân vật / giọng kể*.
2. **Video tham chiếu** (luồng video): lọc Kho video theo từ khoá / kênh / tag, bỏ tick video không muốn dùng. Trong dự án có video R… thì để trống — hệ thống dùng video của dự án.
3. **Bài website chuẩn SEO**: website, trang đích chuyển đổi, *từ khoá hạt giống*, link top Google (tối đa 10, hệ thống tải và mổ xẻ), sitemap để tránh trùng bài có sẵn.
4. **Bài mạng xã hội**: chọn kênh, *Bài MXH / tuần*, link muốn dẫn về (tự gắn UTM), dán bài mẫu (**+ Thêm bài mẫu**), chọn **Người đứng tên** — kênh cá nhân bắt buộc có người đã xác nhận đồng ý (lập hồ sơ ở *Người đứng tên*: giọng, chủ đề được / không được nói, bài mẫu).
5. **Kiến thức VCWIKI**: hệ thống tự tìm thẻ liên quan; thẻ ghim của dự án luôn đứng đầu. Bấm **Lập chiến dịch**.

**Trang chiến dịch** — AI làm 2–6 phút mỗi luồng, trang tự cập nhật:

- Tab **Chiến lược**: phân tích tham chiếu (ADN video R…, trang S…, bài mẫu P…), thông điệp chính, giọng, đối tượng, nên / không nên. Tab **Chiến dịch**: big idea, tagline, CTA.
- Tab từng luồng (*Video ngắn*, *Bài SEO*, *Bài MXH*): kế hoạch N mục, mỗi mục có hook, thông điệp, format, mã căn cứ bấm xem được. Tick các mục rồi xếp hàng cho AI viết.
- Tab **Tham chiếu**: video, trang, bài mẫu, thẻ, người đứng tên đã chụp lúc tạo.
- **Lập lại kế hoạch** (giữ chiến lược) / **Lập lại tất cả** khi muốn AI làm lại; nội dung đã viết được giữ. **⭳ Xuất hồ sơ (.md)** để gửi hoặc lưu.

**Từng nội dung** (mở từ kế hoạch): bản viết theo giây / theo đoạn, *Kiểm tra tự động* (độ dài, hashtag, on-page SEO…), điểm giám khảo thang 100 — dưới 80 AI đã tự sửa tối đa 3 vòng, giữ bản cao nhất. Bạn: **✓ Duyệt** / **Loại** / *Về nháp*, **Sao chép**, gõ góp ý rồi **Viết lại**. Bài SEO đi hai bước: dàn ý trước, **✓ Duyệt dàn ý & viết bài** (hoặc *Lập lại dàn ý* với góp ý). **Nhân bản sang** luồng khác (vd kịch bản video → 3 bài Fanpage): mỗi bản con một ý, giữ liên kết với bản gốc.

Chiến dịch trong dự án có 7P đã chốt: AI nạp phân tích vào cả bước lập chiến lược lẫn bước viết, nên định vị và giá nhất quán với các chiến dịch khác của dự án.
`,
  },
  {
    id: 'viet-nhanh',
    title: 'Viết nhanh nội dung marketing',
    audience: ['marketing'],
    links: [{ to: '/studio/quick', label: 'Mở Viết nhanh' }, { to: '/studio/authors', label: 'Người đứng tên' }],
    body: `
**Viết nhanh** (menu *Nội dung*) viết một nội dung trong vài phút, không cần lập chiến dịch. Chiến dịch nhiều bài, nhiều kênh thì dùng *Chiến dịch*. Chọn **Thuộc dự án** ở góc phải form (hoặc bấm *+ Viết nhanh trong dự án* từ trang dự án) thì bài lưu ở kho của dự án, AI dùng thẻ ghim và phân tích 7P đã chốt của dự án làm căn cứ.

1. Chọn loại nội dung: *Mạng xã hội* (Bài Facebook, Bài LinkedIn, Tin Zalo OA / nhóm Zalo, Caption + hashtag), *Video ngắn* (Kịch bản TikTok / Reels / Shorts, Ý tưởng series video), *SEO & website* (Bài blog chuẩn SEO, Meta title & description, Mô tả sản phẩm / dịch vụ, Nội dung landing page), *Quảng cáo & email* (Quảng cáo Facebook / Instagram, Quảng cáo Google tìm kiếm, Email marketing), *Lên ý tưởng*.
2. Điền các ô (ô có * là bắt buộc). Đăng lên **Facebook cá nhân / LinkedIn cá nhân** phải chọn *Người đứng tên* đã xác nhận đồng ý. Mở *Tư liệu thêm cho AI* để dán số liệu, lời kể thật hoặc link bài tham khảo — AI chỉ dùng sự thật có ở đây và trong VCWIKI, chỗ thiếu sẽ ghi *[cần xác minh: …]*.
3. Bấm **✎ Viết ngay**. Nếu để tick *Giám khảo AI chấm và tự sửa*, bài dưới 80 điểm được AI viết lại (tối đa 2 vòng), giữ bản điểm cao nhất.
4. Trang kết quả: chọn mở đầu, **Sao chép toàn bộ** hoặc chép từng phần; khung bên phải có *Kiểm tra tự động* (giới hạn ký tự, số hashtag…) và điểm giám khảo. Quảng cáo Google tô đỏ dòng vượt giới hạn ký tự.
5. **Chỉnh tiếp**: gõ góp ý rồi bấm *Sửa theo góp ý* (để trống thì *Viết lại bản khác*). *Chuyển thể sang* → *Mở form* để biến bài này thành loại khác (vd bài Facebook → email) — form điền sẵn, AI dùng bài gốc làm căn cứ.
6. **✓ Duyệt** / **Loại** / *Về nháp*. Danh sách *Nội dung đã viết* ở cuối trang lọc theo loại, trạng thái duyệt, *Của tôi*.
`,
  },
  {
    id: 'dang-facebook',
    title: 'Đăng bài lên Facebook: Fanpage, nhóm, trang cá nhân',
    audience: ['marketing'],
    links: [{ to: '/studio/facebook', label: 'Mở Kênh Facebook' }, { to: '/studio/quick', label: 'Viết nhanh' }],
    body: `
Bài **Facebook** của *Viết nhanh* và bài mạng xã hội của *Chiến dịch*, khi đã **✓ Duyệt**, đăng được lên Facebook từ khung **Đăng Facebook** trên trang bài.

**Facebook chỉ cho ứng dụng đăng thay vào Fanpage.** Nhóm (từ 04/2024) và trang cá nhân (từ 2018) Facebook không cho, nên hệ thống **đăng hỗ trợ**: chép sẵn bài, mở Facebook, bạn dán và bấm Đăng, rồi dán link bài về để ghi nhận.

**Lần đầu: thêm kênh** (menu *Content Engine* → **Kênh Facebook**)
1. **Kết nối Fanpage**: chọn kho (ai sửa được kho này sẽ đăng được lên Fanpage), dán **access token** của người quản trị Fanpage, bấm **Kết nối**. Một token kết nối cùng lúc mọi Fanpage người đó quản trị. Cách lấy token: mở *Lấy token thế nào?* ngay dưới ô — Graph API Explorer, cấp quyền pages_show_list, pages_manage_posts, pages_read_engagement. Nên dùng token **dài hạn** (nút *Extend Access Token* trong Access Token Debugger, hoặc máy chủ có cấu hình FB_APP_ID / FB_APP_SECRET), token ngắn hạn làm Fanpage mất kết nối sau 1–2 giờ.
2. **Thêm nhóm / trang cá nhân**: chọn loại, nhập tên và link nhóm (bắt buộc với nhóm).
3. Fanpage báo **Lỗi token** thì dán token mới ở ô kết nối; bấm *Kiểm tra kết nối* để thử lại.

**Đăng một bài**
1. Mở bài đã duyệt → khung **Đăng Facebook** → **Đăng…**.
2. Chọn *Đăng lên* (gợi ý sẵn theo kênh của bài). Sửa *Nội dung* nếu muốn — mặc định là mở đầu phương án 1 + thân bài + hashtag; *Link đính kèm* là link UTM của bài.
3. **Fanpage**: bấm **Đăng ngay** (bình luận đầu đăng liền sau bài), hoặc tick *Hẹn giờ đăng* (10 phút – 30 ngày; Facebook tự đăng, không cần mở máy) → **Hẹn giờ đăng**.
4. **Nhóm / trang cá nhân**: bấm **Chép bài & mở Facebook** → dán bài vào ô đăng của Facebook (thêm ảnh nếu có) → Đăng → mở bài vừa đăng, chép link → dán vào ô *Link bài đã đăng* → **Xác nhận đã đăng**. Chưa đăng kịp thì bấm *Để sau*, lần đăng nằm ở danh sách với nhãn *Chờ dán link*.

Danh sách dưới khung ghi mọi lần đăng: *Đã đăng* (bấm *Xem bài ↗*), *Hẹn giờ* (*Kiểm tra bài hẹn giờ đã lên chưa*, *Huỷ hẹn giờ*), *Chờ dán link*, *Lỗi* (kèm lý do — vd token hết hạn, thiếu quyền). Bài trang cá nhân phải đứng tên người đó và được họ đồng ý (*Người đứng tên*). Chưa hỗ trợ đăng kèm ảnh / video từ hệ thống.
`,
  },
  {
    id: 'hoc-tap',
    title: 'Học tập: học, luyện tập, thi',
    audience: ['learn'],
    links: [{ to: '/learn', label: 'Mở Học tập của tôi' }, { to: '/learn/library', label: 'Thư viện bài học' }],
    body: `
**Học tập của tôi** có ba tab: *Đang học*, *Đã xong*, *Tự ghi danh*. Mỗi khoá ghi hạn bằng chữ ("còn 3 ngày", *Quá hạn*), thanh tiến độ, và **một** nút chính là việc kế tiếp (*Tiếp tục bài 3*, *Vào thi*…).

**Khoá mở — tự ghi danh**: không cần ai giao, bạn vẫn học được các khoá L&D mở cho mọi người (vd khoá mẫu *Kỹ năng bán hàng B2B cho NVKD mới*, nhãn *Khoá mẫu*): ở *Học tập của tôi* → tab *Tự ghi danh* → **Ghi danh**. Hạn tính từ ngày ghi danh; bài tự luận do người tạo khoá chấm. Trên mỗi khoá, nút **Bắt đầu** / **Tiếp tục học** mở đúng bài bạn đang dở.

1. Mở từng bài học: bài gồm các thẻ VCWIKI (ghim đúng phiên bản lúc soạn) + phần diễn giải.
2. Bấm **Luyện tập** (URL thêm ?practice=1) → làm → **Nộp bài**: xem ngay điểm, đáp án đúng, giải thích. **↻ Làm lại** bao nhiêu lần cũng được. Bài có câu luyện tập thì luyện tập xong mới tính là học xong.
3. Học xong thì **Vào thi**: đề rút ngẫu nhiên, xáo câu và phương án, đồng hồ đếm ngược *Còn m:ss*, câu trả lời tự lưu. Hết giờ bài **tự nộp** (kể cả khi đóng trình duyệt).
4. Bài chỉ có trắc nghiệm được chấm ngay. Bài có tự luận: AI chấm sơ bộ, người giao lộ trình / quản lý trực tiếp chốt điểm và viết nhận xét.
5. **Xem kết quả**: điểm từng câu, đáp án, nhận xét. Không đồng ý thì **Gửi phản hồi** một lần.

**Thư viện bài học** mở Chương trình học, Môn học và Bài học. Mọi người đọc được bài đã phát hành trong kho mình xem được. Cây khoa / bộ môn là cấu trúc đào tạo riêng; xem hướng dẫn Đào tạo theo môn để soạn nội dung mới. Các bước ghi danh và lộ trình tuần / chuỗi khoá ở trên áp dụng dữ liệu kiểu cũ.
`,
  },
  {
    id: 'soan-khoa',
    title: 'Soạn khoá học: checklist từng dòng cho AI và người mới (quản lý, L&D)',
    audience: ['learn', 'admin'],
    links: [
      { to: '/learn/library?tab=questions', label: 'Ngân hàng câu hỏi' },
      { to: '/learn/library', label: 'Thư viện bài học' },
      { to: '/learn/paths', label: 'Lộ trình học' },
      { to: '/learn/design', label: 'Thiết kế lộ trình' },
      { to: '/learn/grading', label: 'Chấm bài' },
    ],
    body: `
Mục này giữ hướng dẫn theo mô hình kiểu cũ: **mỗi nhánh có bài là một khoá; lộ trình xếp nhiều khoá theo thứ tự**. Vào *Thư viện* → tab *Môn học kiểu cũ* để chọn nhánh, thêm bài và sắp thứ tự; tab *Lộ trình kiểu cũ* → *Tạo lộ trình chuỗi khoá* để chọn khoá, xếp thứ tự / hạn rồi đặt tên và lưu nháp. Mở bản nháp để chỉnh, phát hành và giao ở tab *Giao bài*. Người học làm bài theo thứ tự; bài sau và khoá sau chỉ mở khi đủ điều kiện. Các lộ trình tuần / tháng cũ vẫn giữ nhãn *Kiểu cũ*.

**Bản thuần văn bản cho AI (không cần chạy JS):** http://localhost:8000/guide/soan-khoa.md — cả hướng dẫn: /guide.md, mục lục JSON: /api/guide. Trang /guide là ứng dụng một trang, fetch HTML chỉ thấy vỏ.

### Quy ước đọc

- URL gốc là http://localhost:8000 (đổi nếu máy chủ khác). Trang trong app = URL gốc + đường dẫn, vd http://localhost:8000/learn/library?tab=questions. API = URL gốc + /api/…, JSON, cookie phiên vc_session.
- Tên nút / ô ghi trong ngoặc kép **đúng chữ trên màn hình**, kèm mã định danh trong ngoặc vuông là **data-testid** (cũng là aria-label khi ô có nhãn), vd nút "+ Câu hỏi mới" [q-new]. Tìm phần tử **theo data-testid trước** (ổn định qua mọi lần lưu), không thấy thì theo tên. Không đoán toạ độ.
- Ô nhập nhiều dòng ("Đề bài", "Giải thích", "Diễn giải"): **điền cả chuỗi một lần** (fill / dán), không gõ từng phím (gõ từng phím tiếng Việt qua công cụ tự động dễ lệch dấu). Ctrl/⌘+A rồi Delete xoá hết nội dung ô như bình thường. Điền xong đọc lại giá trị ô để chắc.
- Ô lỗi đỏ có data-testid tận cùng bằng **-error** (q-error, lesson-error, path-error, assign-error, lessons-error, questions-error) và nút "Thử lại" [-error-retry] khi là lỗi máy chủ. Chữ lỗi ghi rõ mã HTTP + endpoint khi là lỗi 5xx. Gặp lỗi → tra **Bảng xử lý tình huống** cuối mục.
- Không bịa: nội dung câu hỏi chỉ lấy từ **thẻ đã duyệt**; thẻ không có ý cần hỏi thì bỏ ý đó.

### Bước 0 — Chuẩn bị (làm trước Bước A, không bỏ)

**0.1 Kiểm tra đăng nhập và quyền soạn.** Gọi GET /api/auth/me. Kết quả 200 và JSON có can_design = true → đi tiếp. 401 → mở http://localhost:8000/ , điền "Email", "Mật khẩu" (hỏi người dùng, không đoán) → "Đăng nhập" → gọi lại. can_design = false → **dừng**, báo người dùng: "Tài khoản chưa có quyền soạn — cấp vai trò Quản lý đào tạo ở /org, tab Vai trò chức năng" (chi tiết ở mục *Tạo một khoá học từ A đến Z*, Bước 0).

**0.2 Lấy danh sách người học.** Gọi GET /api/users → mảng [{id, name, email, role}]. Cần **ít nhất một người khác** tài khoản đang đăng nhập. Thiếu → **dừng, không tự tạo tài khoản**; báo người dùng: "Chưa có tài khoản người học. Tạo ở menu Người dùng & lĩnh vực (/users → + Thêm người) rồi xếp vào Cơ cấu tổ chức (/org) với Quản lý trực tiếp = bạn; sau đó gọi tôi làm tiếp." Ghi lại id + tên từng người học sẽ giao. Người giao được còn phải nằm **trong cây dưới quyền** của bạn — Bước D kiểm lại bằng trường assignable.people.

**0.3 Tạo hoặc chọn kho chia sẻ.** Gọi GET /api/spaces → tìm phần tử có type = "shared", my_role là "owner" hoặc "editor" (ưu tiên visibility = "org"). Có → ghi SPACE_ID = id và SPACE_NAME = name. Không có → tạo: POST /api/spaces với body {"name": "Kho đào tạo hội nhập", "description": "Bài học, câu hỏi cho khoá hội nhập", "visibility": "org"} (hoặc trên web: /spaces → "+ Kho chia sẻ mới" → "Tên kho" → tick "Công khai trong công ty (mọi người được xem)"). Trong mọi ô "Lưu vào kho" sau này, nhãn để chọn là **"SPACE_NAME (chia sẻ)"**; kho cá nhân có nhãn "★ … (cá nhân)" — **không chọn**.

**0.4 Chọn thẻ theo lĩnh vực (không mò bằng q=).** (a) GET /api/categories → mảng [{slug, name, level, parent_id}]; chọn slug theo bảng dưới hoặc theo name. (b) Với mỗi slug: GET /api/wiki/cards?status=approved&category=SLUG&page_size=100 → items[{id, title, summary, key_points, when_to_use}] — chỉ thẻ **đã duyệt**, gồm cả nhánh con. (c) Chọn 2–3 thẻ mỗi bài; với mỗi thẻ ghi: **id** (24 ký tự hex), **tiêu đề đầy đủ**, **10 ký tự đầu tiêu đề** (để gõ vào ô tìm), 3–5 **ý chính** (từ key_points, summary) — đây là nguyên liệu viết câu. Muốn kiểm lại một thẻ theo tên: GET /api/wiki/cards?status=approved&match=title&q=10-ky-tu-dau (tìm theo tiêu đề, trả trong dưới 1 giây; **không** dùng q= không có match=title để chọn thẻ — đó là tìm theo nghĩa, lẫn thẻ khác chủ đề). Đọc trọn thẻ: GET /api/wiki/cards/ID.

Slug gợi ý cho khoá **hội nhập nhân viên mới** (số = thẻ đã duyệt lúc viết hướng dẫn, 28/09/2026):

| Slug | Nhánh | Dùng cho |
|---|---|---|
| vc-solution | Bộ giải pháp VCPV (gồm mọi nhánh con dưới) | Tổng quan hệ sinh thái |
| vc-solution.phu-tung-vcparts | Phụ tùng VCparts (21 thẻ) | Lời hứa giao hàng, kênh TikTok, xử lý hàng lỗi |
| vc-solution.dao-tao-vce | Chương trình đào tạo VCE (15) | VCedu là gì, các khoá |
| vc-solution.vcsoft.pmqlx-gara-o-to-vcgarage | Phần mềm gara VCgarage (15) | VCgarage là gì, phân hệ |
| vc-solution.vcsoft.vcdms | Quản lý phân phối VCDMS (5) | VCDMS, thang duyệt chiết khấu |
| vc-solution.vcsoft.vcinvoice | Hoá đơn điện tử VCinvoice (17) | VCinvoice là gì, luồng duyệt hoá đơn |
| qltt.van-hoa.gia-tri-hanh-vi | Giá trị cốt lõi & hành vi (3) | Văn hoá, hành vi mong đợi |
| qltt.chien-luoc.chien-luoc-danh-muc | Chiến lược tập đoàn & danh mục division (3) | Vì sao có các division |
| qltt.lanh-dao.giao-viec-uy-quyen | Giao việc, uỷ quyền & phản hồi (6) | Cách nhận việc, báo cáo |

### Bước A — Soạn câu hỏi (mỗi thẻ 2 câu, ví dụ 6 thẻ → 12 câu)

**A.1 Vào đâu:** http://localhost:8000/learn/library?tab=questions (menu "Thư viện bài học" → tab "Ngân hàng câu hỏi" [tab-questions]). **Bấm:** "+ Câu hỏi mới" [q-new] (hoặc mở thẳng …/learn/library?tab=questions&q=new). **Chờ:** ngăn kéo "Câu hỏi mới" [q-form] mở bên phải. **Kiểm tra:** thấy ô "Đề bài" [q-stem]. Sửa một câu: nút "Sửa" [q-edit] mở ngăn kéo ?q=ID_CÂU.

**A.2 Ba ô đầu (chỉ làm ở câu đầu — form nhớ cho các câu sau):** "Loại câu" [q-kind] chọn "Một đáp án" (giá trị single); "Độ khó (1–5)" [q-difficulty] chọn 2; "Lưu vào kho" [q-space] chọn "SPACE_NAME (chia sẻ)". **Kiểm tra:** **không** có dòng vàng "Kho cá nhân — chỉ bạn xem được" [q-private-hint]. Form mặc định đã chọn kho chia sẻ (nếu có) và nhớ Loại / Độ khó / Kho của câu vừa lưu.

**A.3 Nội dung câu:** "Đề bài" [q-stem] = đề bài (1 câu, 1 ý của thẻ). "Phương án 1" … "Phương án 4" [q-option-1] … [q-option-4] = 4 phương án (đủ 4 ô; thêm ô bằng "+ Phương án" [q-option-add]). Đánh dấu đáp án đúng: bấm nút tròn "Phương án N đúng" [q-correct-N] của **đúng 1** phương án. "Giải thích (trích thẻ)" [q-explanation] = câu bắt đầu bằng "Thẻ nêu: …". **Kiểm tra:** nút tròn đúng đang được chọn.

**A.4 Thẻ căn cứ:** ô "Gắn thẻ căn cứ" [q-card-search]: điền **10 ký tự đầu tiêu đề** hoặc **dán id thẻ** (24 ký tự hex). **Chờ:** dòng trạng thái [q-card-search-state] hết chữ "Đang tìm…" và trong [q-card-options] có chip "+ tiêu đề đầy đủ · Đã duyệt" mà data-card-id = id thẻ (tối đa 10 giây; gợi ý cũ bị xoá ngay khi gõ nên không bấm nhầm). **Bấm** chip đó (theo data-card-id, hoặc theo chữ đầy đủ). **Kiểm tra:** thẻ nằm trong danh sách đã chọn [q-card-picked] (một dòng, có tiêu đề); ô tìm trống lại.

**A.5 Lưu:** bấm "Lưu, tạo câu tiếp" [q-save-approve-next] (lưu **và duyệt** câu này rồi dọn form). **Chờ:** thông báo [toast] "Đã lưu và duyệt câu “…”" hiện; ô "Đề bài" trống, con trỏ ở đó. Form **giữ** Loại câu, Độ khó, Kho và **thẻ căn cứ** → quay lại A.3 soạn câu 2 của cùng thẻ. Sang thẻ khác: trong [q-card-picked] bấm "✕" (aria-label "Bỏ thẻ: …") rồi làm A.4. **Câu cuối cùng:** bấm "Lưu và duyệt" [q-save-approve] để đóng ngăn kéo. Không muốn duyệt ngay: "Lưu nháp" [q-save-draft].

**A.6 Kiểm tra thành công:** danh sách [q-list] có 12 dòng mới ở đầu, mỗi dòng nhãn "Đã duyệt" và dòng "Căn cứ: tiêu đề thẻ (bản n)". Hoặc GET /api/learn/questions?status=approved&page_size=50 → total tăng đúng 12. Thiếu câu → tìm theo đề bài, câu "Nháp" thì bấm "Duyệt".

**Cách nhanh — nhập một lượt:** ở tab Ngân hàng câu hỏi bấm "Nhập nhiều câu (JSON/CSV)" [q-import] (mở hộp [q-import-form], URL ?import=1) → dán JSON mảng câu (định dạng **giống body POST /api/learn/questions**, xem phần API) vào "Dán JSON hoặc CSV" [q-import-text] → "Lưu vào kho" [q-import-space] = kho chia sẻ → để tick "Duyệt luôn sau khi nhập" [q-import-approve] → "Xem trước" [q-import-preview] → bảng [q-import-rows] báo N/N câu hợp lệ → "Nhập N câu" [q-import-submit] → thông báo [toast] "Đã nhập N câu (đã duyệt)", hộp tự đóng; câu máy chủ từ chối liệt kê trong [q-import-result], hộp giữ mở. Nút "Tải mẫu JSON" / "Tải mẫu CSV" cho file mẫu. Cột CSV: kind, stem, option1…option6, correct (số thứ tự phương án đúng, nhiều thì "1;3"), explanation, difficulty, bloom, card_ids (nhiều id cách ";").

### Bước B — Soạn bài học (mỗi tuần 1 bài, ví dụ 2 bài)

**B.1 Vào đâu:** http://localhost:8000/learn/library (tab "Bài học" [tab-lessons]). **Bấm:** "+ Bài học mới" [lesson-new] (liên kết tới http://localhost:8000/learn/lessons/new). **Chờ:** trang "Bài học mới", khung [lesson-form].

**B.2 Điền:** "Tên bài học" [lesson-title]; "Lưu vào kho" [lesson-space] = "SPACE_NAME (chia sẻ)" (**kiểm tra** không có dòng vàng [lesson-private-hint]); "Mục tiêu (mỗi dòng một mục tiêu)" [lesson-objectives] = 1–3 dòng, mỗi dòng điều người học làm được.

**B.3 Thẻ trong bài:** ô "Thêm thẻ đã duyệt" [lesson-card-search] — làm như A.4 cho từng thẻ theo **thứ tự học**; **kiểm tra** [lesson-card-picked] có đủ dòng, đúng thứ tự (đổi bằng "↑" "↓").

**B.4 Diễn giải:** "Diễn giải" [lesson-body] = 5–10 dòng Markdown nối các thẻ (## Vì sao cần học → từng thẻ nói gì → áp dụng). Bấm "Xem trước" [lesson-preview] để soát, bấm lại để sửa.

**B.5 Câu luyện tập:** trong danh sách [lesson-practice] tick ô [lesson-practice-ID_CÂU] cho các câu của thẻ trong bài (câu gắn thẻ trong bài được xếp lên đầu; mỗi dòng mang data-question-id). **Kiểm tra:** dòng "Câu luyện tập (N đã chọn)" đúng số.

**B.6 Phát hành:** bấm "Phát hành" [lesson-publish] → hộp "Xác nhận phát hành" [lesson-publish-dialog] → **không** thấy cảnh báo kho cá nhân [publish-private-warning] → bấm "Xác nhận phát hành" [confirm-ok] trong hộp đó. **Chờ:** trang chuyển sang /learn/lessons/ID, tiêu đề bài hiện cùng nhãn "Đã phát hành" [lesson-status]. **Ghi** LESSON_ID từ URL. Lặp B.1–B.6 cho bài 2. (Bài để "Lưu nháp" [lesson-save-draft] vẫn đưa vào lộ trình được — phát hành cùng lộ trình.)

### Bước C — Dựng lộ trình (chuỗi khoá học)

**C.1 Tạo bản nháp chuỗi khoá:** http://localhost:8000/learn/library?tab=paths → *Tạo lộ trình chuỗi khoá* → chọn khoá ở bước 1 → xếp khoá, bài và số ngày ở bước 2 → nhập tên / mô tả ở bước 3 → *Lưu lộ trình nháp*. Mở bản nháp để rà nội dung, lưu, phát hành rồi giao cho người học. Lộ trình kiểu cũ vẫn dùng giao diện tuần / tháng.

**C.2 Mô tả:** "Mô tả / mục tiêu sau kỳ" [path-description] = 1–2 câu (người học đọc thấy).

**C.3 Tuần và bài:** bấm "+ Thêm tuần" [path-add-week] → khung tuần 1 [path-week-1]: "Chủ đề tuần 1" [path-week-1-title]; "Hạn tuần 1" [path-week-1-due] dạng YYYY-MM-DD; ô "Thêm bài học vào tuần 1" [path-week-1-lesson] chọn theo **tên bài** (chọn lại để thêm bài nữa); tick "bắt buộc" [path-required-LESSON_ID]. **Kiểm tra:** tên bài hiện trong khung tuần. Bấm "+ Thêm tuần" lần nữa cho tuần 2 ([path-week-2-title], [path-week-2-due], [path-week-2-lesson]).

**C.4 Bài thi:** mở tab "Đề thi" [path-tab-exam] (?tab=exam), tick "Có bài thi" [path-exam-on]; "Thời gian (phút)" [path-exam-duration] = 30; "Điểm đạt (%)" [path-exam-pass] = 70; "Số lượt thi" [path-exam-attempts] = 1; "Nguồn câu hỏi" [path-exam-scope] = "Câu gắn với bài học trong lộ trình" (path). Dòng ma trận 1: "Loại câu dòng 1" [path-bp-1-kind] = "Một đáp án"; "Số câu dòng 1" [path-bp-1-count] = **10** (phải ≤ số câu một đáp án đã duyệt gắn với thẻ trong các bài — ví dụ có 12); "Lĩnh vực dòng 1" để "Mọi lĩnh vực". Thêm dòng bằng "+ Dòng ma trận" [path-bp-add] (dòng 2: [path-bp-2-kind], [path-bp-2-count]).

**C.5 Lưu và phát hành:** bấm "Lưu nháp" [path-save] (chân trang) → **chờ** không có ô đỏ [path-error]; muốn xem lại tuần / bài thì bấm tab "Nội dung" [path-tab-content]. Bấm "Phát hành" [path-publish] → hộp xác nhận của trình duyệt → đồng ý. **Chờ / kiểm tra:** nhãn "Đã phát hành" ở đầu trang; trang tự chuyển sang tab "Giao bài" [path-tab-assign] và khung [assign-form] hiện phía dưới. Có ô đỏ → xem bảng tình huống.

### Bước D — Giao cho người học

**D.1** Trong [assign-form]: tick từng người [assign-person-USER_ID] (aria-label "Người: tên") — USER_ID lấy ở Bước 0.2, hoặc GET /api/learn/paths/PATH_ID → assignable.people. "Hạn hoàn thành" [assign-due] = YYYY-MM-DD (bỏ trống = hạn tuần cuối). Bấm "Giao" [assign-submit].

**D.2 Chờ / kiểm tra:** thông báo nổi (toast, [toast]) "Đã giao N người: tên…" (hiện 8 giây — đọc ngay). Dòng "Bỏ qua tên: lý do" → ghi lại lý do cho người dùng. Tab "Đã giao (n)" [path-tab-assigned] có bảng tiến độ người học với tên và trạng thái "Chưa bắt đầu".

**D.3 Báo lại người dùng:** link http://localhost:8000/learn/paths/PATH_ID, số câu đã duyệt, số bài đã phát hành, số người được giao, hạn; các dòng Bỏ qua (nếu có).

### Ví dụ đã điền đầy đủ: khoá "Hội nhập VC Phồn Vinh – T10/2026"

Không còn chỗ trống. Thẻ là thẻ **đã duyệt có thật** trên máy chủ này (id tra lại bằng 0.4 nếu máy chủ khác — tìm theo 10 ký tự đầu).

Thông số: kho "Kho đào tạo hội nhập" (chia sẻ, mở cho công ty). Lộ trình "Hội nhập VC Phồn Vinh – T10/2026", Kỳ Tháng, Năm 2026, Tháng 10. Mô tả: "Nhân viên mới nắm hệ sinh thái VC Phồn Vinh (VCparts, VCedu, VCgarage) và hai phần mềm VCsoft (VCDMS, VCinvoice); thi cuối tháng 10 câu, đạt 70%." Thi 30 phút, đạt 70%, 1 lượt, 1 dòng ma trận: Một đáp án × 10. Hạn giao 2026-10-31.

| Tuần | Chủ đề tuần | Hạn tuần | Bài học | Thẻ trong bài |
|---|---|---|---|---|
| 1 | Hệ sinh thái VC Phồn Vinh | 2026-10-15 | "VC Phồn Vinh có gì: VCparts, VCedu, VCgarage" — mục tiêu: "Kể được 3 mảng kinh doanh chính và lời hứa của VCparts" | thẻ 1, 2, 3 |
| 2 | Phần mềm VCsoft: VCDMS và VCinvoice | 2026-10-31 | "VCDMS và VCinvoice cho người mới" — mục tiêu: "Phân biệt VCDMS với VCsale; nêu luồng duyệt hoá đơn" | thẻ 4, 5, 6 |

| # | Tiêu đề đầy đủ (chip hiện đúng chữ này) | Gõ 10 ký tự đầu | id thẻ (máy chủ này) | Lĩnh vực |
|---|---|---|---|---|
| 1 | Lời hứa "phụ tùng sẵn kho, báo giá khỏi lo" của VCparts: 3 kho Hà Nội – Hải Phòng – TP.HCM (quận 2), hàng về hằng tuần, giao trong ngày nội thành, 2–4 ngày đi tỉnh | Lời hứa "p | 6ab8e8dbcc445f6ad2a9fd6f | vc-solution.phu-tung-vcparts |
| 2 | VCedu (VC Education – VCE): tổng quan trung tâm đào tạo nghề sửa chữa ô tô | VCedu (VC | 6ab8e6a8cc445f6ad2a9fd37 | vc-solution.dao-tao-vce |
| 3 | VCgarage là gì: phần mềm quản lý gara ô tô chuyên sâu (Vertical SaaS) "Quản đốc 4.0" của VC Phồn Vinh | VCgarage l | 6ab8d7a716800b4edd9fade3 | vc-solution.vcsoft.pmqlx-gara-o-to-vcgarage |
| 4 | VCDMS — hệ thống quản lý phân phối thị trường tích hợp trong VCsale | VCDMS — hệ | 6ab8e48dcc445f6ad2a9fd14 | vc-solution.vcsoft.vcdms |
| 5 | VCinvoice là gì: "cổng hoá đơn" nằm trên nhà cung cấp HĐĐT, không tự ký số, không nối thẳng cơ quan thuế | VCinvoice | 6ab8da2016800b4edd9fae02 | vc-solution.vcsoft.vcinvoice |
| 6 | Luồng duyệt hoá đơn trên VCinvoice: Sale xác nhận → Kế toán trưởng duyệt → (khi cần) người duyệt thứ 2 | Luồng duyệ | 6ab8db1316800b4edd9fae14 | vc-solution.vcsoft.vcinvoice |

12 câu mẫu (Loại "Một đáp án", Độ khó 2; đáp án đúng đổi vị trí giữa các câu). Điền đúng nguyên văn:

**Câu 1 — thẻ 1.** Đề bài: Theo lời hứa "phụ tùng sẵn kho, báo giá khỏi lo", VCparts có kho hàng ở những đâu?
Phương án 1: Hà Nội, Đà Nẵng, Cần Thơ · Phương án 2: Hà Nội, Hải Phòng, TP.HCM (quận 2) · Phương án 3: Chỉ có kho Hà Nội · Phương án 4: Hà Nội và Bình Dương
Đáp án đúng: **2**. Giải thích: Thẻ nêu: 3 kho Hà Nội, Hải Phòng, TP.HCM (kho ở quận 2), hàng về hằng tuần.

**Câu 2 — thẻ 1.** Đề bài: Gara ở tỉnh đặt hàng VCparts giao qua bưu cục thì theo kênh sẽ nhận trong bao lâu?
Phương án 1: Trong ngày · Phương án 2: 5–7 ngày · Phương án 3: 2–4 ngày · Phương án 4: Khoảng một tháng
Đáp án đúng: **3**. Giải thích: Thẻ nêu: nội thành có kho giao trong ngày; đi tỉnh 2–4 ngày qua bưu cục, gấp thì xe khách hôm sau hoặc đường bay.

**Câu 3 — thẻ 2.** Đề bài: VCedu (VC Education – VCE) là đơn vị làm gì?
Phương án 1: Trung tâm đào tạo nghề sửa chữa ô tô · Phương án 2: Nhà phân phối phụ tùng ô tô · Phương án 3: Phần mềm quản lý gara · Phương án 4: Cổng hoá đơn điện tử
Đáp án đúng: **1**. Giải thích: Thẻ nêu: VCE là trung tâm đào tạo nghề sửa chữa ô tô thuộc Công ty TNHH VC Phồn Vinh, thành lập chính thức 03/2023.

**Câu 4 — thẻ 2.** Đề bài: Điểm khác biệt trong cách đào tạo của VCedu là gì?
Phương án 1: Học hoàn toàn online qua video · Phương án 2: Chỉ học lý thuyết trên mô hình · Phương án 3: Cấp bằng đại học chính quy · Phương án 4: Thực hành trên xe thật Á và Âu, máy chẩn đoán chuyên hãng, phần mềm Alldata/Mitchell
Đáp án đúng: **4**. Giải thích: Thẻ nêu: khác biệt là thực hành trên xe thật Á/Âu, máy chẩn đoán chuyên hãng, phần mềm tra cứu Alldata/Mitchell.

**Câu 5 — thẻ 3.** Đề bài: VCgarage là loại sản phẩm gì?
Phương án 1: ERP đa năng dùng cho mọi ngành · Phương án 2: Vertical SaaS — phần mềm quản lý gara ô tô chuyên sâu · Phương án 3: Sàn thương mại điện tử bán phụ tùng · Phương án 4: Máy chẩn đoán lỗi ô tô
Đáp án đúng: **2**. Giải thích: Thẻ nêu: VCgarage là Vertical SaaS riêng cho gara ô tô, không phải ERP đa năng.

**Câu 6 — thẻ 3.** Đề bài: Slogan của VCgarage là gì?
Phương án 1: "Học để thành thạo, học để làm chủ" · Phương án 2: "Phụ tùng sẵn kho, báo giá khỏi lo" · Phương án 3: "Quản đốc 4.0" · Phương án 4: "Cổng hoá đơn một chạm"
Đáp án đúng: **3**. Giải thích: Thẻ nêu: slogan "Quản đốc 4.0" — gom tiếp nhận, báo giá, sửa chữa, kho, kế toán, hậu mãi trên một nền tảng.

**Câu 7 — thẻ 4.** Đề bài: VCDMS nằm ở đâu trong hệ phần mềm của VC Phồn Vinh?
Phương án 1: Hệ thống độc lập, đăng nhập riêng · Phương án 2: Một phân hệ của VCgarage · Phương án 3: Nhóm menu "DMS — Thị trường" trong module Bán hàng của VCsale · Phương án 4: Ứng dụng chỉ dành cho kế toán
Đáp án đúng: **3**. Giải thích: Thẻ nêu: VCDMS là nhóm menu «DMS — Thị trường» trong module Bán hàng của VCsale, không phải hệ thống riêng.

**Câu 8 — thẻ 4.** Đề bài: Với dữ liệu khách hàng, sản phẩm, tồn kho, công nợ, VCDMS theo nguyên tắc nào?
Phương án 1: Đọc từ VCsale, không nhân bản master data · Phương án 2: Nhập lại bằng tay trên app · Phương án 3: Đồng bộ từ Excel mỗi tuần · Phương án 4: Lưu riêng trên điện thoại nhân viên kinh doanh
Đáp án đúng: **1**. Giải thích: Thẻ nêu: không nhân bản master data — khách hàng, sản phẩm, tồn, công nợ, bảng giá đọc từ VCsale; DMS chỉ mở rộng.

**Câu 9 — thẻ 5.** Đề bài: Việc nào sau đây VCinvoice KHÔNG làm?
Phương án 1: Lập hoá đơn nháp từ đơn hàng · Phương án 2: Kiểm tra bộ rule trước khi phát hành · Phương án 3: Quản lý hoá đơn điều chỉnh, thay thế · Phương án 4: Tự ký số và nối thẳng cơ quan thuế
Đáp án đúng: **4**. Giải thích: Thẻ nêu: VCinvoice không tự ký số, không kết nối trực tiếp Tổng cục Thuế — việc đó do nhà cung cấp HĐĐT làm.

**Câu 10 — thẻ 5.** Đề bài: Ở giai đoạn 1, VCinvoice kết nối nhà cung cấp hoá đơn điện tử nào?
Phương án 1: MISA · Phương án 2: Viettel SInvoice · Phương án 3: VNPT · Phương án 4: BKAV
Đáp án đúng: **2**. Giải thích: Thẻ nêu: giai đoạn 1 chỉ có adapter Viettel SInvoice; VNPT/MISA ở giai đoạn sau.

**Câu 11 — thẻ 6.** Đề bài: Trong luồng duyệt hoá đơn trên VCinvoice, sau khi Sale xác nhận và gửi, ai là người duyệt?
Phương án 1: Giám đốc kinh doanh · Phương án 2: Kế toán trưởng · Phương án 3: Thủ kho · Phương án 4: Nhà cung cấp hoá đơn điện tử
Đáp án đúng: **2**. Giải thích: Thẻ nêu: Sale xác nhận và gửi KTT → Kế toán trưởng duyệt từng hoá đơn hoặc hàng loạt.

**Câu 12 — thẻ 6.** Đề bài: Trường hợp nào hoá đơn cần 2 người duyệt (rule C8.3)?
Phương án 1: Mọi hoá đơn bán lẻ dưới 1 triệu · Phương án 2: Hoá đơn của khách hàng quen · Phương án 3: Hoá đơn từ ngưỡng KTT quy định, điều chỉnh / thay thế, thuế suất 0%, ngoại tệ · Phương án 4: Hoá đơn do giám đốc tự lập
Đáp án đúng: **3**. Giải thích: Thẻ nêu: 2 người duyệt (Kế toán trưởng + Giám đốc tài chính) cho hoá đơn lớn, điều chỉnh / thay thế, thuế 0%, ngoại tệ.

### Quy tắc viết câu hỏi cho AI

1. **Một câu kiểm tra một ý** của thẻ (một dòng key_points hoặc một câu trong summary). Không gộp hai ý.
2. **Đáp án đúng trích nguyên văn hoặc sát chữ thẻ**; không suy diễn, không thêm số liệu thẻ không có.
3. **Ba phương án sai phải hợp lý**: lấy ý từ **thẻ khác trong cùng khoá** (vd slogan của VCedu làm phương án sai cho câu về VCgarage), cùng độ dài và văn phong với đáp án đúng; không dùng "tất cả đều đúng / sai".
4. **Đổi vị trí đáp án đúng** giữa các câu (không để luôn ở phương án 1 hay 2).
5. **Giải thích bắt đầu bằng "Thẻ nêu: …"** rồi chép ý thẻ; người học đọc sau khi nộp.
6. Đề bài là **một câu hỏi rõ**, có tên riêng (VCparts, VCinvoice…) để không mơ hồ; câu "KHÔNG" thì viết hoa chữ KHÔNG.
7. Độ khó 1–2 cho câu nhớ / hiểu (hội nhập), 3 cho vận dụng; Mức nhận thức có thể để trống.
8. Số câu một đáp án đã duyệt gắn với thẻ **trong các bài của lộ trình** phải ≥ "Số câu" của dòng ma trận.

### Bảng xử lý tình huống

| Tình huống | Làm gì | Thử lại tối đa | Báo người dùng |
|---|---|---|---|
| Ô tìm thẻ: chip **không hiện sau 10 giây** (trạng thái vẫn "Đang tìm…" hoặc "0 thẻ") | Xoá ô, dán **id thẻ** vào [q-card-search]; nếu vẫn không: gọi GET /api/wiki/cards/ID xem status có là approved không | 2 lần | "Thẻ ID chưa duyệt / không xem được — cần duyệt thẻ ở Hộp duyệt trước" |
| Ô đỏ có mã **503 / 502 / 0 (Không kết nối được máy chủ)** | Máy chủ đang khởi động lại (tự nạp code mới). Chờ 5 giây, bấm "Thử lại" [..-error-retry] hoặc tải lại trang; dữ liệu đã lưu không mất | 3 lần, mỗi lần cách 5 giây | Quá 3 lần: "Máy chủ :8000 không trả lời — cần khởi động lại bằng bash start_web.sh" và dừng |
| Ô đỏ **400 / 422** (câu BE viết, vd "một đáp án: đúng 1 phương án đúng") | Sửa đúng ô nêu trong câu lỗi rồi bấm lưu lại | 1 lần | Không sửa được thì chép nguyên câu lỗi cho người dùng |
| Ô đỏ **403** ("Bạn chỉ có quyền xem…") | Kho chọn sai (không có quyền sửa) → chọn lại "Lưu vào kho"; hoặc thiếu quyền soạn | 1 lần | "Cần quyền Quản lý đào tạo / quyền sửa kho X" |
| **Không thấy tên người học** trong "Giao lộ trình" (hoặc khung "Bạn chưa có ai trong cây dưới quyền" [assign-nobody]) | Không tự tạo / sửa tài khoản. Dừng bước D | 0 | "Người X chưa nằm trong cây dưới quyền của bạn — ở /org đặt Quản lý trực tiếp = bạn, hoặc cấp Quản lý đào tạo có phạm vi Đơn vị; rồi gọi tôi giao lại" |
| Phát hành báo **không đủ câu** / không rút đủ đề | Giảm "Số câu dòng 1" [path-bp-1-count] xuống bằng số câu đã duyệt (GET /api/learn/questions?status=approved&kind=single) rồi "Phát hành" lại | 2 lần | Ghi số câu thực có |
| Phát hành báo **"Bài học '…' chưa có thẻ"** | Mở bài đó ở Thư viện bài học → "Sửa" → thêm thẻ → "Lưu nháp" → quay lại phát hành | 1 lần | — |
| **Lỡ lưu vào kho cá nhân** (dòng vàng "Kho cá nhân" từng hiện) | Câu / bài không đổi kho được. Bài nháp: tạo lại trong kho chia sẻ; câu: tạo lại rồi để câu cũ ở trạng thái nháp (bấm "Sửa" → "Lưu nháp"). Lần sau kiểm tra [q-private-hint] / [lesson-private-hint] trước khi lưu | — | Liệt kê câu / bài phải tạo lại |
| Lộ trình đã **Phát hành nhầm** | Không sửa được nữa: tạo lộ trình mới (C.1) đúng nội dung; lộ trình cũ chưa giao ai thì để đó | — | Báo link lộ trình cũ để người dùng đóng |
| Chọn nhầm "Kỳ" = Năm | Ở "Sửa bản nháp" đổi "Kỳ" [path-period] về Tháng, chọn "Tháng", "Lưu nháp" | 1 lần | — |

### API tương đương từng bước (khi giao diện chậm, hoặc chạy hàng loạt)

Mọi lệnh: tiền tố http://localhost:8000/api, JSON, kèm cookie phiên vc_session lấy từ POST /api/auth/login {"email": "…", "password": "…"}. Lỗi 4xx: body {"detail": "câu tiếng Việt"} → sửa theo câu đó.

| Bước | Lệnh | Body tối thiểu | Lấy về |
|---|---|---|---|
| 0.1 | GET /api/auth/me | — | can_design = true |
| 0.2 | GET /api/users | — | [{id, name, email}] |
| 0.3 | POST /api/spaces | {"name": "Kho đào tạo hội nhập", "visibility": "org"} | id → SPACE_ID |
| 0.4 | GET /api/categories · GET /api/wiki/cards?status=approved&category=SLUG&page_size=100 · GET /api/wiki/cards?status=approved&match=title&q=10-ky-tu | — | items[{id, title, key_points}] |
| A | POST /api/learn/questions | {"kind": "single", "stem": "…", "difficulty": 2, "explanation": "Thẻ nêu: …", "card_ids": ["6ab8e8dbcc445f6ad2a9fd6f"], "space_id": "SPACE_ID", "options": [{"text": "…", "correct": false}, {"text": "…", "correct": true}, {"text": "…", "correct": false}, {"text": "…", "correct": false}]} | id → rồi PATCH /api/learn/questions/ID {"status": "approved"} |
| A (tự luận) | POST /api/learn/questions | {"kind": "essay", "stem": "…", "card_ids": ["…"], "space_id": "SPACE_ID", "model_answer": "…", "rubric": [{"criterion": "…", "max": 4, "descriptor": "…"}]} | như trên |
| B | POST /api/learn/lessons | {"title": "VC Phồn Vinh có gì: VCparts, VCedu, VCgarage", "space_id": "SPACE_ID", "objectives": ["Kể được 3 mảng kinh doanh chính"], "narrative": "## Vì sao cần học\\n…", "items": [{"card_id": "6ab8e8dbcc445f6ad2a9fd6f"}, {"card_id": "6ab8e6a8cc445f6ad2a9fd37"}, {"card_id": "6ab8d7a716800b4edd9fade3"}], "practice_question_ids": ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6"]} | id → PATCH /api/learn/lessons/ID {"status": "published"} |
| C | POST /api/learn/paths | {"title": "Hội nhập VC Phồn Vinh – T10/2026", "period": "month", "year": 2026, "month": 10} | id → PATH_ID |
| C | PATCH /api/learn/paths/PATH_ID | {"description": "…", "modules": [{"week": 1, "title": "Hệ sinh thái VC Phồn Vinh", "lesson_ids": ["LESSON_1"], "due_at": "2026-10-15T16:59:00Z"}, {"week": 2, "title": "Phần mềm VCsoft: VCDMS và VCinvoice", "lesson_ids": ["LESSON_2"], "due_at": "2026-10-31T16:59:00Z"}], "required_items": ["LESSON_1", "LESSON_2"], "exam": {"duration_min": 30, "pass_score": 70, "attempts": 1, "scope": "path", "blueprint": [{"kind": "single", "count": 10}]}} | modules, exam |
| C | POST /api/learn/paths/PATH_ID/publish | — | status = published (400 nêu thiếu gì) |
| D | GET /api/learn/paths/PATH_ID | — | assignable.people[{id, name}] |
| D | POST /api/learn/paths/PATH_ID/assign | {"learner_ids": ["USER_ID"], "due_at": "2026-10-31T16:59:00Z"} | assigned[], skipped[{name, reason}] |

Giờ hạn: 23:59 giờ Việt Nam = 16:59Z cùng ngày. Lời nhắn rút gọn cho AI yếu ở dưới (bấm "Sao chép").
`,
    snippets: [
      {
        title: 'Lời nhắn rút gọn cho AI yếu — chỉ bước đánh số và giá trị (ví dụ Hội nhập T10/2026)',
        text: [
          'Làm khoá học trên http://localhost:8000 theo đúng các bước, không suy luận thêm. Tìm phần tử theo data-testid ghi trong [ ]. Điền ô nhiều dòng bằng cách dán cả chuỗi. Gặp ô lỗi đỏ: đọc chữ, tra bảng tình huống ở http://localhost:8000/guide/soan-khoa.md, không tự lách. Xong mỗi bước báo 1 dòng.',
          '',
          '0.1 GET /api/auth/me → 200, can_design=true. Sai → hỏi email/mật khẩu, đăng nhập ở /, gọi lại. can_design=false → DỪNG, báo cần vai trò Quản lý đào tạo.',
          '0.2 GET /api/users → cần ≥ 1 người khác mình. Không có → DỪNG, báo tạo tài khoản ở /users rồi xếp vào /org (không tự tạo). Ghi USER_ID, tên.',
          '0.3 GET /api/spaces → kho type=shared, my_role owner/editor, tên "Kho đào tạo hội nhập". Không có → POST /api/spaces {"name":"Kho đào tạo hội nhập","visibility":"org"}. Nhãn để chọn: "Kho đào tạo hội nhập (chia sẻ)".',
          '0.4 Thẻ (id máy chủ này; khác thì GET /api/wiki/cards?status=approved&match=title&q=<10 ký tự đầu>): T1=6ab8e8dbcc445f6ad2a9fd6f "Lời hứa "p…"; T2=6ab8e6a8cc445f6ad2a9fd37 "VCedu (VC…"; T3=6ab8d7a716800b4edd9fade3 "VCgarage l…"; T4=6ab8e48dcc445f6ad2a9fd14 "VCDMS — hệ…"; T5=6ab8da2016800b4edd9fae02 "VCinvoice …"; T6=6ab8db1316800b4edd9fae14 "Luồng duyệ…".',
          '',
          'A. Mở /learn/library?tab=questions → bấm [q-new]. Câu đầu: [q-kind]=single, [q-difficulty]=2, [q-space]="Kho đào tạo hội nhập (chia sẻ)"; không được thấy [q-private-hint].',
          'A. Với 12 câu (nội dung ở mục "Ví dụ đã điền" của /guide/soan-khoa.md, câu 1–2 thẻ T1, 3–4 T2, 5–6 T3, 7–8 T4, 9–10 T5, 11–12 T6): dán [q-stem]; dán [q-option-1]..[q-option-4]; bấm [q-correct-N] với N = đáp án đúng; dán [q-explanation] bắt đầu "Thẻ nêu: ".',
          'A. Thẻ căn cứ (câu lẻ của mỗi thẻ; câu chẵn giữ nguyên): dán id thẻ vào [q-card-search] → chờ [q-card-search-state] hết "Đang tìm…" và chip có data-card-id = id (tối đa 10 giây) → bấm chip → kiểm tra [q-card-picked] có 1 dòng. Sang thẻ mới: bấm ✕ trong [q-card-picked] trước.',
          'A. Câu 1–11: bấm [q-save-approve-next] → chờ [toast] "Đã lưu và duyệt câu". Câu 12: bấm [q-save-approve]. Kiểm tra: [q-list] có 12 dòng "Đã duyệt". Ghi Q1..Q12 (data-question-id) — hoặc GET /api/learn/questions?status=approved&page_size=50.',
          '',
          'B. Bài 1: /learn/library → [lesson-new] → [lesson-title]="VC Phồn Vinh có gì: VCparts, VCedu, VCgarage"; [lesson-space]="Kho đào tạo hội nhập (chia sẻ)"; [lesson-objectives]="Kể được 3 mảng kinh doanh chính và lời hứa của VCparts"; [lesson-card-search] dán lần lượt T1, T2, T3 (mỗi lần chờ chip → bấm); [lesson-body]="## Vì sao cần học\\nNgười mới cần biết công ty bán gì, dạy gì, làm phần mềm gì.\\n## VCparts\\n3 kho, giao trong ngày nội thành.\\n## VCedu\\nĐào tạo nghề sửa ô tô, thực hành xe thật.\\n## VCgarage\\nPhần mềm quản lý gara, Quản đốc 4.0."; tick [lesson-practice-Q1]..[lesson-practice-Q6]; [lesson-publish] → [lesson-publish-dialog] bấm [confirm-ok] → chờ URL /learn/lessons/… → ghi LESSON_1.',
          'B. Bài 2: như trên với [lesson-title]="VCDMS và VCinvoice cho người mới"; [lesson-objectives]="Phân biệt VCDMS với VCsale; nêu luồng duyệt hoá đơn"; thẻ T4, T5, T6; [lesson-body]="## VCDMS\\nNhóm menu trong Bán hàng của VCsale, không nhân bản dữ liệu.\\n## VCinvoice\\nCổng hoá đơn, không tự ký số.\\n## Luồng duyệt\\nSale gửi → Kế toán trưởng duyệt → 2 người khi hoá đơn lớn."; tick Q7..Q12; phát hành → ghi LESSON_2.',
          '',
          'C. /learn/paths → [path-new] → [path-new-blank] → [path-title]="Hội nhập VC Phồn Vinh – T10/2026", [path-period]=month, [path-year]=2026, [path-month]=10 → [path-create] → chờ [path-editor] (tab Nội dung); ghi PATH_ID từ URL.',
          'C. [path-description]="Nhân viên mới nắm hệ sinh thái VC Phồn Vinh và hai phần mềm VCsoft; thi cuối tháng 10 câu, đạt 70%."',
          'C. [path-add-week] → [path-week-1-title]="Hệ sinh thái VC Phồn Vinh", [path-week-1-due]=2026-10-15, [path-week-1-lesson] chọn "VC Phồn Vinh có gì: VCparts, VCedu, VCgarage", tick [path-required-LESSON_1]. [path-add-week] → [path-week-2-title]="Phần mềm VCsoft: VCDMS và VCinvoice", [path-week-2-due]=2026-10-31, [path-week-2-lesson] chọn "VCDMS và VCinvoice cho người mới", tick [path-required-LESSON_2].',
          'C. Bấm tab [path-tab-exam]; tick [path-exam-on]; [path-exam-duration]=30; [path-exam-pass]=70; [path-exam-attempts]=1; [path-exam-scope]=path; [path-bp-1-kind]=single; [path-bp-1-count]=10.',
          'C. [path-save] → không có [path-error] → [path-publish] → đồng ý hộp xác nhận → chờ nhãn "Đã phát hành" và [assign-form] (tự sang tab Giao bài).',
          '',
          'D. Tick [assign-person-USER_ID] cho từng người ở 0.2; [assign-due]=2026-10-31; [assign-submit] → chờ toast [toast] "Đã giao N người". Không thấy người → DỪNG, báo cần xếp người vào cây dưới quyền ở /org.',
          'D. Báo lại: link /learn/paths/PATH_ID, 12 câu đã duyệt, 2 bài đã phát hành, N người được giao, các dòng Bỏ qua nếu có.',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'tao-khoa-hoc',
    title: 'Tạo một khoá học từ A đến Z (từng bước, cho người mới)',
    audience: ['learn', 'admin'],
    links: [
      { to: '/learn/library', label: 'Thư viện bài học' },
      { to: '/learn/paths', label: 'Lộ trình học' },
      { to: '/learn/design', label: 'Thiết kế lộ trình' },
      { to: '/org', label: 'Cơ cấu tổ chức' },
    ],
    body: `
Mục này dành cho người **chưa từng tạo khoá học**: tạo nội dung trong khoá ở Thư viện, sau đó tạo lộ trình chuỗi khoá, phát hành và giao cho nhân viên. Tên nút / ô nhập được viết đúng như trên màn hình. Lộ trình tuần / tháng cũ vẫn mở được để theo dõi.

### Khoá học trong VCWIKI được ghép từ gì?

| Thành phần | Là gì | Làm ở đâu |
|---|---|---|
| **Thẻ tri thức** (đã duyệt) | Nguyên liệu: mỗi thẻ một ý dùng được | VCWIKI → *+ Thẻ mới*, duyệt ở *Hộp duyệt* |
| **Câu hỏi** (đã duyệt) | Một đáp án / nhiều đáp án / tự luận, gắn thẻ căn cứ | *Thư viện bài học* → tab *Ngân hàng câu hỏi* |
| **Bài học** (đã phát hành) | 1–5 thẻ theo thứ tự + diễn giải + câu luyện tập | *Thư viện bài học* → tab *Bài học* |
| **Khoá học** | Một nhánh cây + các bài học xếp thứ tự; có thể đặt thi khoá | *Thư viện* → tab *Môn học kiểu cũ* |
| **Lộ trình** | Chuỗi khoá, hạn từng khoá, học theo thứ tự, phát hành và giao | *Thư viện* → tab *Lộ trình* |
| **Việc được giao** | Mỗi người học một hạn, tiến độ, lượt thi | Khung *Giao lộ trình* sau khi phát hành |

Chuỗi phụ thuộc (làm ngược là kẹt): **thẻ đã duyệt → câu hỏi đã duyệt → bài học → lộ trình → phát hành → giao**. Chỉ thẻ *Đã duyệt* mới vào được bài học / câu hỏi; chỉ câu *Đã duyệt* mới vào luyện tập và đề thi.

### Bước 0 — Kiểm tra bạn có quyền soạn

Bạn soạn được khi thanh menu bên trái có **Thiết kế lộ trình** và **Lộ trình học**. Quyền này có khi bạn (a) là *quản lý trực tiếp* của ít nhất một người (hồ sơ nhân viên ở *Cơ cấu tổ chức* ghi *Quản lý trực tiếp* = bạn), hoặc (b) được cấp vai trò **Biên tập viên** hay **Quản lý đào tạo** (L&D).

Chưa thấy menu? Nhờ quản trị viên: *Cơ cấu tổ chức* → tab **Vai trò chức năng** → khung **Cấp vai trò** → *Người* = bạn, *Vai trò* = **Quản lý đào tạo**, ba ô phạm vi (*Đơn vị*, *Lĩnh vực*, *Chức năng*) để trống nếu muốn soạn cho cả công ty → **Cấp vai trò**. Tải lại trang là thấy menu.

Lưu ý: tài khoản **quản trị viên không tự có** quyền soạn — quản trị viên cũng phải cấp *Quản lý đào tạo* cho chính mình.

### Bước 1 — Chọn kho lưu (để người học xem được)

Bài học, câu hỏi nằm trong một **kho**. Bài để trong *kho cá nhân* thì **chỉ bạn thấy**. Vì vậy:

1. *Kho & chia sẻ* → **+ Kho chia sẻ mới** → *Tên kho* (vd "Đào tạo Kinh doanh") → tick **Công khai trong công ty (mọi người được xem)** nếu ai cũng học được; không tick thì bấm **Quản lý** → *Email người được mời* + vai trò *Chỉ xem* → **Mời** từng người học.
2. Ghi nhớ tên kho này — mọi form phía sau có ô **Lưu vào kho**, luôn chọn đúng kho đó.

(Người được giao lộ trình vẫn đọc được bài học mức mật C0 / C1 dù không ở trong kho, nhưng dùng kho chung cho mọi thứ là cách ít lỗi nhất.)

### Bước 2 — Có đủ thẻ đã duyệt

1. Vào *VCWIKI*, lọc trạng thái **Đã duyệt**, tìm thẻ theo chủ đề khoá. Mỗi bài nên có **2–3 thẻ**; ghi lại **tên thẻ** (bạn sẽ gõ tên này để tìm khi soạn).
2. Thiếu thẻ thì tạo: **+ Thẻ mới** (mục *Tạo và sửa thẻ tay*) hoặc nạp tư liệu để AI dựng thẻ (mục *Nạp tư liệu vào Kho*). Thẻ mới là **Nháp** → **Gửi duyệt** → **người khác** duyệt ở *Hộp duyệt* (tác giả không tự duyệt được — bốn mắt). Cần duyệt nhiều thẻ một lượt: *Hộp duyệt* → tab **Duyệt hàng loạt**.
3. Thẻ mức mật **C3** không đưa vào khoá được (AI không sinh câu, người học không đọc qua khoá).

### Bước 3 — Soạn câu hỏi (Ngân hàng câu hỏi)

Mở *Thư viện bài học* → tab **Ngân hàng câu hỏi** → **+ Câu hỏi mới**. Điền theo thứ tự trên form:

1. *Loại câu*: **Một đáp án** / **Nhiều đáp án** / **Tự luận**. *Độ khó (1–5)*. *Mức nhận thức* (Nhớ / Hiểu / Vận dụng / Phân tích — có thể bỏ trống). *Lưu vào kho*: kho ở bước 1.
2. *Đề bài*: một câu hỏi rõ, ưu tiên tình huống thật ("Chủ gara nói má phanh đắt hơn 30%, bạn trả lời thế nào?").
3. Trắc nghiệm: **2–6 phương án**, bấm nút tròn / ô tick bên trái để đánh dấu **phương án đúng** (một đáp án: đúng **1**; nhiều đáp án: ít nhất 1). Thiếu phương án bấm *+ Phương án*.
4. Tự luận: **Rubric chấm** — mỗi dòng *Tiêu chí*, *Điểm tối đa*, *Mô tả mức đạt* (thêm dòng bằng *+ Tiêu chí*, tổng điểm phải > 0) và *Đáp án mẫu*.
5. *Giải thích (trích thẻ)*: người học thấy sau khi nộp.
6. *Thẻ căn cứ* (bắt buộc ≥ 1): gõ tên thẻ vào ô **Gắn thẻ căn cứ — gõ để tìm** → bấm chip **+ tên thẻ**.
7. **Lưu và duyệt** (câu của bạn tự duyệt được), **Lưu, tạo câu tiếp** (lưu và duyệt câu này, giữ nguyên thẻ căn cứ, loại câu, độ khó, kho — soạn nhiều câu cho một thẻ rất nhanh) hoặc **Lưu nháp** để xem lại sau. Form nhớ Loại câu / Độ khó / Kho của câu vừa lưu. Có sẵn danh sách câu? **Nhập nhiều câu (JSON/CSV)** ở đầu tab — dán, xem trước, nhập một lượt.

Cần bao nhiêu câu? **Bằng hoặc nhiều hơn số câu trong ma trận đề** ở bước 5 (vd đề 10 câu một đáp án thì cần ≥ 10 câu một đáp án đã duyệt gắn với thẻ trong khoá). Mỗi thẻ 2 câu là mức khởi điểm tốt.

**Cách nhanh — để AI sinh câu**: *Thiết kế lộ trình* → khung **AI sinh câu hỏi cho một thẻ** → gõ tên thẻ vào **Chọn thẻ đã duyệt** → bấm chip thẻ → *Số câu* (1–6) → **AI sinh câu hỏi**. Câu sinh ra là **Nháp**: bấm **Mở Ngân hàng câu hỏi để duyệt →**, đọc từng câu (đáp án, rubric), sửa nếu cần (*Sửa*), rồi tick **Chọn cả N câu chưa duyệt** → **Duyệt đã chọn (N)**. Loại câu AI chọn theo loại thẻ: SOP / checklist → nhiều đáp án; KPI, quy định → một đáp án; tình huống, bài học, mẫu biểu → tự luận có rubric.

### Bước 4 — Soạn bài học

*Thư viện bài học* → tab **Bài học** → **+ Bài học mới**:

1. *Tên bài học* (vd "Gặp khách lần đầu"). *Lưu vào kho*: kho ở bước 1 (form đã gợi ý sẵn kho chia sẻ bạn sửa được; thấy dòng cảnh báo *Kho cá nhân — chỉ bạn xem được* là đang chọn sai kho).
2. *Mục tiêu (mỗi dòng một mục tiêu)*: 1–3 dòng, viết điều người học **làm được** sau bài.
3. *Thẻ trong bài (theo thứ tự học)*: gõ tên thẻ vào ô **Thêm thẻ đã duyệt — gõ để tìm** → bấm chip **+ tên thẻ**; lặp cho từng thẻ; dùng **↑ ↓** sắp thứ tự, **✕** bỏ. Phiên bản thẻ được **ghim** lúc lưu — thẻ đổi sau đó không làm đổi bài.
4. *Diễn giải (Markdown)*: 5–15 dòng nối các thẻ thành mạch ("Vì sao cần học → thẻ 1 nói gì → áp dụng ra sao"). Bấm **Xem trước** để kiểm.
5. *Câu luyện tập*: tick các câu (câu gắn với thẻ trong bài được xếp lên đầu). Người học chỉ gặp câu **Đã duyệt**.
6. **Lưu nháp** (chỉ bạn thấy) hoặc **Phát hành** → hộp xác nhận → **Xác nhận phát hành**. Sau phát hành nội dung **khoá**; muốn sửa bấm **Tạo bản sao** rồi phát hành bản mới.

Mẹo: bài để **Nháp** vẫn đưa vào lộ trình được — khi phát hành lộ trình, các bài nháp của bạn được phát hành cùng.

### Bước 5 — Dựng lộ trình (chính là khoá học) — cách tạo tay

*Lộ trình học* → **+ Lộ trình mới**:

1. *Tên lộ trình* (vd "Kỹ năng bán hàng B2B — tháng 10/2026"), *Kỳ* = **Tháng** (khoá một tháng, chia tuần) hoặc **Năm (khung)** (khung 12 tháng cho cấp dưới kế thừa), *Năm*, *Tháng* → **Tạo bản nháp**.
2. Màn **Sửa bản nháp**: điền *Mô tả / mục tiêu sau kỳ* (người học đọc thấy).
3. **Các tuần và bài học**: bấm **+ Thêm tuần** → điền *Tuần* (số), *Chủ đề tuần*, *Hạn tuần* (ngày) → chọn bài trong ô **+ Thêm bài học…** (chọn nhiều lần để thêm nhiều bài; bài nháp có chữ *(nháp)*) → tick **bắt buộc** với bài không được bỏ. Lặp cho 4 tuần. Bỏ bài bằng **✕**, bỏ tuần bằng **Bỏ tuần**.
4. **Bài thi cuối kỳ**: tick **Có bài thi** → *Thời gian (phút)* (vd 30), *Điểm đạt (%)* (mặc định **70**), *Số lượt thi* (1–5), *Nguồn câu hỏi*: **Câu gắn với bài học trong lộ trình** (khuyên dùng) hoặc *Cả ngân hàng câu hỏi tôi xem được*. Bảng **ma trận đề**: mỗi dòng *Lĩnh vực* (để *Mọi lĩnh vực* nếu không cần lọc), *Độ khó*, *Loại câu*, *Số câu*; thêm dòng bằng **+ Dòng ma trận** (vd dòng 1: Một đáp án × 8; dòng 2: Nhiều đáp án × 5; dòng 3: Tự luận × 2). Đề được rút **ngẫu nhiên** từ câu đã duyệt khớp từng dòng.
5. **Lưu nháp** để làm tiếp sau, hoặc **Phát hành** → đồng ý hộp xác nhận. Phát hành = **khoá nội dung** (không sửa được nữa) và phát hành luôn các bài nháp của bạn trong lộ trình.

Lỗi hay gặp khi bấm Phát hành và cách sửa:

| Thông báo | Cách sửa |
|---|---|
| *Lộ trình cần ít nhất một bài học* | Thêm bài vào ít nhất một tuần |
| *Bài học '…' chưa có thẻ* | Mở bài đó ở Thư viện bài học → *Sửa* → thêm thẻ |
| *Bài thi cần ma trận đề…* | Điền ít nhất một dòng ma trận (loại câu + số câu) |
| *Không đủ câu hỏi…* / không rút đủ | Duyệt thêm câu đúng loại / độ khó, hoặc giảm *Số câu* của dòng đó; kiểm câu đã gắn thẻ **trong bài học của lộ trình** (khi *Nguồn câu hỏi* = câu gắn với bài học) |
| *Không được bỏ mục bắt buộc của khung* | Lộ trình kế thừa khung năm: thêm lại bài bắt buộc của khung |

### Bước 5 (cách nhanh) — Để AI dựng nháp ở *Thiết kế lộ trình*

1. Điền **form 6 ô**: (1) *Đối tượng*: *Cấp bậc*, *Mảng (của người học)*, *Division*, tick **Người học** (chỉ người trong cây dưới quyền); (2) *Mục tiêu sau kỳ (một câu, đo được)*; (3) *Thời lượng*: **Lộ trình tháng** + *Tháng* / *Năm*; (4) *Giờ học mỗi tuần*; (5) *Nhánh bắt buộc* (1–3 slug lĩnh vực hoặc chuỗi quy trình, vd "ban-hang-cskh, qt.ban-hang-b2b"); (6) *Cách đánh giá* + *Điểm đạt (%)*.
2. Ô **Prompt gửi AI** tự ghép từ form — sửa tự do (thêm "ưu tiên tình huống thực tế") → **AI dựng lộ trình nháp**.
3. Bản nháp hiện tuần → bài → thẻ (mã + *bản n*). Sửa ngay tại chỗ: đổi *Tên bài*, **↑ ↓** đổi thứ tự, ô **Chuyển sang** để đưa bài sang tuần khác, **✕** bỏ, **+ Thêm thẻ**, **+ Bài trong tuần n**; nút **AI sinh câu hỏi** cạnh từng thẻ tạo câu nháp. Khung **Thiếu tri thức** liệt kê nhánh / bậc chưa có thẻ — AI **không tự viết** nội dung thay thẻ.
4. Chọn **Lưu bài học vào kho (người học phải xem được kho này)** → **Lưu nháp** → hệ thống dựng các **bài học nháp** cho từng bài.
5. Sang *Lộ trình học*: bản nháp có nhãn **AI dựng** → mở → làm tiếp bước 5 mục 3–5 ở trên (AI chỉ ghi *Mô tả đề của AI* bằng chữ; bạn phải chuyển thành các **dòng ma trận**) → **Phát hành**.

### Bước 6 — Giao cho người học

Ngay dưới lộ trình đã phát hành có khung **Giao lộ trình**: tick **Người**, hoặc cả **Đơn vị** / **Chức năng** (chỉ giao cho người trong **cây dưới quyền** của bạn: nhân viên bạn quản lý trực tiếp / chuyên môn, hoặc phạm vi L&D được cấp) → *Hạn hoàn thành* (bỏ trống = hạn tuần cuối / cuối kỳ, 23:59 giờ Việt Nam) → **Giao**. Kết quả hiện *Đã giao N người*; người bị **Bỏ qua** có ghi lý do (thường là không xem được bài mức mật C2 / C3 — mời họ vào kho rồi giao lại). Bảng **Tiến độ người học** cập nhật trạng thái, hạn, điểm thi.

Không thấy ai trong khung *Giao lộ trình*? Bạn chưa có người dưới quyền: nhờ quản trị viên gán *Quản lý trực tiếp* cho nhân viên ở *Cơ cấu tổ chức*, hoặc cấp *Quản lý đào tạo* có *Đơn vị* phạm vi.

Khoá **mở cho mọi người tự ghi danh** (khu *Khoá mở — tự ghi danh* ở *Học tập của tôi*) hiện **chưa có nút bật trên web**: chỉ khoá mẫu do quản trị viên chạy lệnh seed_sample_course.py mới có cờ này. Muốn "mở khoá" cho một nhóm thì giao theo *Đơn vị*.

### Bước 7 — Người học học, bạn chấm

- Người học: *Học tập của tôi* → thẻ khoá → **Bắt đầu** / **Tiếp tục học** → đọc bài, **Luyện tập** → **Nộp bài** → **Vào thi** khi tới hạn. Chi tiết ở mục *Học tập: học, luyện tập, thi*.
- Bạn (người giao / quản lý trực tiếp): menu **Chấm bài** → tab *Chờ chấm* (lọc theo lộ trình, đơn vị, hạn, ngày nộp) → bấm tên người học → khung chấm mở bên phải (màn hẹp: ngăn kéo) → mỗi câu tự luận có điểm AI sơ bộ theo rubric, bạn nhập điểm; **Nhận xét cho người học (bắt buộc)** — bấm *Chèn nhận xét nháp của AI* rồi sửa; điểm lệch AI từ 20% thang điểm câu phải điền **Lý do lệch điểm AI** → **Chốt điểm** (có hỏi lại) — bài kế tiếp tự mở. Bài chỉ trắc nghiệm tự chốt khi nộp.

### Danh sách kiểm trước khi bấm Phát hành

| ✓ | Điều cần chắc |
|---|---|
| ☐ | Menu *Lộ trình học* hiện ra (có quyền soạn) |
| ☐ | Mọi bài học, câu hỏi nằm trong **cùng một kho** người học xem được |
| ☐ | Mọi thẻ trong bài là **Đã duyệt**, không có C3 |
| ☐ | Số câu **Đã duyệt** ≥ số câu trong từng dòng ma trận (đúng loại, đúng độ khó) |
| ☐ | Mỗi tuần có ít nhất một bài; bài quan trọng đã tick *bắt buộc* |
| ☐ | *Điểm đạt* 70 (trừ khi có lý do), *Thời gian* đủ làm hết đề |
| ☐ | Đã **Lưu nháp** lần cuối trước khi Phát hành (phát hành xong không sửa được) |

### Nhờ Claude làm thay

Ba lời nhắn sẵn ở dưới (bấm **Sao chép**). Điền các chỗ trong dấu < > rồi dán cho Claude. Dùng model nhỏ / AI hay lạc bước? Lấy **lời nhắn rút gọn** ở mục *Soạn khoá học: checklist từng dòng* phía trên (đã điền ví dụ đầy đủ, có data-testid từng ô, bản .md ở /guide/soan-khoa.md):

- **Lời nhắn 1** — Claude Desktop / Claude Code đã *Kết nối AI* (MCP vc-content): Claude tìm thẻ, sinh câu hỏi nháp, dựng lộ trình nháp bằng công cụ *generate_questions*, *design_path*. Việc duyệt câu, điền ma trận, phát hành, giao vẫn do bạn bấm trên web (AI qua MCP không được duyệt / phát hành).
- **Lời nhắn 2** — Claude Code có quyền điều khiển trình duyệt (Chrome DevTools MCP / Playwright): Claude bấm toàn bộ các bước 3–6 trên web bằng tài khoản của bạn, đúng tên nút ở trên.
- **Lời nhắn 3** — Claude Code gọi thẳng API (không cần trình duyệt): thứ tự lệnh và nội dung JSON tối thiểu.
`,
    snippets: [
      {
        title: 'Lời nhắn 1 — Claude qua MCP vc-content: chuẩn bị nháp (câu hỏi + lộ trình)',
        text: [
          'Bạn đang kết nối VCWIKI qua MCP vc-content. Giúp tôi chuẩn bị một khoá học. Làm đúng thứ tự, xong mỗi bước báo kết quả rồi mới sang bước sau. Không tự duyệt gì, không bịa nội dung: thẻ không có thì ghi "thiếu tri thức".',
          '',
          'Thông số:',
          '- Chủ đề / từ khoá tìm thẻ: <CHỦ ĐỀ, vd "bán hàng B2B chủ gara">',
          '- Tên khoá: <TÊN KHOÁ>; kỳ: tháng <T>/<NĂM>; <GIỜ> giờ học mỗi tuần',
          '- Mục tiêu sau kỳ (đo được): <MỘT CÂU>',
          '- Nhánh bắt buộc (slug lĩnh vực hoặc qt.<chuỗi quy trình>): <vd ban-hang-cskh>',
          '- Người học (email, phải trong cây dưới quyền tôi): <email1>, <email2>',
          '- Đánh giá: thi cuối tháng <N> câu trắc nghiệm + <M> câu tự luận, điểm đạt 70',
          '',
          'Bước 1. Gọi whoami. Nếu tôi không có quyền soạn bài (learn.author) thì dừng, bảo tôi xin vai trò Quản lý đào tạo ở /org.',
          'Bước 2. Gọi search_cards với từ khoá trên, chỉ giữ thẻ status = approved. Liệt kê tối đa 12 thẻ: mã thẻ, tiêu đề, lĩnh vực, bậc, loại. Hỏi tôi chốt danh sách thẻ.',
          'Bước 3. Với mỗi thẻ đã chốt, gọi generate_questions(card_id, n=2). Báo tổng số câu nháp đã tạo và link /learn/library?tab=questions&status=draft.',
          'Bước 4. Gọi design_path với goal, period="month", year, month, hours_per_week, branches, assessment, pass_score=70, learner_emails, title như thông số. Trình bày kết quả: tuần → bài → thẻ (mã + phiên bản), phần gaps (thiếu tri thức) và url bản nháp.',
          'Bước 5. Nhắc tôi ba việc chỉ làm trên web: (a) /learn/library?tab=questions → tick "Chọn cả N câu chưa duyệt" → "Duyệt đã chọn"; (b) mở url bản nháp ở /learn/design → chọn "Lưu bài học vào kho" → "Lưu nháp"; (c) /learn/paths → mở bản nháp có nhãn "AI dựng" → tick "Có bài thi", điền ma trận đề → "Phát hành" → "Giao".',
        ].join('\n'),
      },
      {
        title: 'Lời nhắn 2 — Claude Code điều khiển trình duyệt: làm hết trên web',
        text: [
          'Mở trình duyệt tới <URL ỨNG DỤNG, vd http://localhost:8000> và đăng nhập bằng tài khoản tôi cung cấp (hỏi tôi email và mật khẩu, không đoán). Đọc trước <URL ỨNG DỤNG>/guide/soan-khoa.md: mỗi ô / nút có data-testid ghi trong [ ] — tìm phần tử theo data-testid, không đoán toạ độ. Tạo một khoá học theo đúng các bước dưới đây. Dùng đúng tên nút / ô nhập trong ngoặc kép. Xong mỗi bước chụp màn hình và báo lại một dòng. Gặp thông báo lỗi màu đỏ thì đọc bảng xử lý tình huống trong hướng dẫn; không xử được thì dừng và hỏi tôi, không tự lách.',
          '',
          'Thông số:',
          '- Kho lưu: "<TÊN KHO CHIA SẺ>". Nếu chưa có: menu "Kho & chia sẻ" → "+ Kho chia sẻ mới" → "Tên kho" → tick "Công khai trong công ty (mọi người được xem)" → tạo.',
          '- Tên khoá: "<TÊN KHOÁ>"; "Kỳ" = Tháng; "Năm" <NĂM>; "Tháng" <T>. Thi 30 phút, điểm đạt 70%, 1 lượt.',
          '- Tuần 1 "<CHỦ ĐỀ TUẦN 1>": bài "<BÀI 1>" gồm thẻ: <tên thẻ a>, <tên thẻ b>. Tuần 2 "<CHỦ ĐỀ TUẦN 2>": bài "<BÀI 2>" gồm thẻ: <tên thẻ c>, <tên thẻ d>. (Thêm tuần 3, 4 tương tự nếu có.) Chỉ dùng thẻ đã duyệt; thẻ nào không tìm thấy trong ô chọn thì báo tôi.',
          '- Người học: <tên người 1>, <tên người 2>. Hạn hoàn thành: <NGÀY>.',
          '',
          'Bước A — Câu hỏi. Menu "Thư viện bài học" → tab "Ngân hàng câu hỏi" → "+ Câu hỏi mới" [q-new]. Với MỖI thẻ tạo 2 câu "Một đáp án": chọn "Loại câu" [q-kind], "Độ khó (1–5)" [q-difficulty] = 2, "Lưu vào kho" [q-space] = "<TÊN KHO CHIA SẺ> (chia sẻ)" (form nhớ 3 ô này cho câu sau); điền "Đề bài" [q-stem]; 4 ô "Phương án" [q-option-1..4] và bấm nút tròn [q-correct-N] của đúng 1 phương án đúng; "Giải thích (trích thẻ)" [q-explanation] bắt đầu "Thẻ nêu: "; ở "Thẻ căn cứ" gõ 10 ký tự đầu tên thẻ (hoặc dán id thẻ) vào ô "Gắn thẻ căn cứ" [q-card-search], chờ hết "Đang tìm…" rồi bấm chip "+ <tên thẻ đầy đủ> Đã duyệt"; bấm "Lưu, tạo câu tiếp" [q-save-approve-next] — lưu và duyệt rồi dọn form (câu cuối: "Lưu và duyệt" [q-save-approve]). Nội dung câu lấy từ Tóm tắt / Ý chính của thẻ (GET /api/wiki/cards/<id> hoặc mở thẻ ở VCWIKI), không bịa.',
          'Bước B — Bài học. Tab "Bài học" → "+ Bài học mới". Điền "Tên bài học", chọn "Lưu vào kho" = kho trên (không được thấy dòng "Kho cá nhân — chỉ bạn xem được"), "Mục tiêu (mỗi dòng một mục tiêu)" 1–2 dòng; thêm từng thẻ bằng ô "Thêm thẻ đã duyệt — gõ để tìm" → bấm chip "+ <tên thẻ>"; viết "Diễn giải (Markdown)" 5–10 dòng nối các thẻ; ở "Câu luyện tập" tick các câu vừa tạo cho thẻ trong bài; bấm "Phát hành" → "Xác nhận phát hành". Lặp cho từng bài.',
          'Bước C — Lộ trình. Menu "Lộ trình học" → "+ Lộ trình mới" → "Lộ trình trống" → "Tên lộ trình", "Kỳ" = Tháng, "Năm", "Tháng" → "Tạo bản nháp". Ở trang lộ trình (tab "Nội dung"): điền "Mô tả / mục tiêu sau kỳ"; với mỗi tuần bấm "+ Thêm tuần", điền "Chủ đề tuần", chọn bài trong ô "+ Thêm bài học…", tick "bắt buộc". Sang tab "Đề thi", tick "Có bài thi": "Thời gian (phút)" 30, "Điểm đạt (%)" 70, "Số lượt thi" 1, "Nguồn câu hỏi" = "Câu gắn với bài học trong lộ trình"; ma trận dòng 1: "Loại câu" = Một đáp án, "Số câu" = <tổng số câu đã duyệt ở bước A, không vượt>. Bấm "Lưu nháp", rồi "Phát hành" và đồng ý hộp xác nhận. Nếu báo không đủ câu: giảm "Số câu" rồi Phát hành lại.',
          'Bước D — Giao. Trong khung "Giao lộ trình" tick tên người học ở cột "Người" → chọn "Hạn hoàn thành" → bấm "Giao". Đọc kết quả "Đã giao N người" và các dòng "Bỏ qua" (nếu có) rồi báo lại cho tôi kèm link lộ trình đang mở.',
        ].join('\n'),
      },
      {
        title: 'Lời nhắn 3 — Claude Code gọi API trực tiếp (không cần trình duyệt)',
        text: [
          'Tạo một khoá học trên VCWIKI bằng API (tiền tố /api, JSON, cookie phiên). Máy chủ: <URL, vd http://localhost:8000>. Hỏi tôi email / mật khẩu, không đoán. Mỗi lệnh lỗi (mã 4xx) thì dừng và cho tôi xem nội dung lỗi.',
          '',
          '1. Đăng nhập: POST /auth/login {"email": "...", "password": "..."} → giữ cookie vc_session cho mọi lệnh sau. GET /auth/me phải trả can_design = true; không thì dừng (tôi cần vai trò Quản lý đào tạo).',
          '2. Kho: GET /spaces → chọn kho tên "<TÊN KHO>" mà my_role là owner hoặc editor → lấy id = SPACE.',
          '3. Thẻ: GET /wiki/cards?status=approved&q=<từ khoá>&page_size=20 → chọn các thẻ tôi chốt → lấy id.',
          '4. Câu hỏi (mỗi thẻ 2 câu): POST /learn/questions {"kind": "single", "stem": "...", "difficulty": 2, "explanation": "...", "card_ids": ["<card_id>"], "space_id": SPACE, "options": [{"text": "...", "correct": true}, {"text": "...", "correct": false}, {"text": "...", "correct": false}, {"text": "...", "correct": false}]} → rồi PATCH /learn/questions/{id} {"status": "approved"}. Tự luận: "kind": "essay", "rubric": [{"criterion": "...", "max": 4, "descriptor": "..."}], "model_answer": "...", không có options.',
          '5. Bài học: POST /learn/lessons {"title": "...", "space_id": SPACE, "objectives": ["..."], "narrative": "...", "items": [{"card_id": "..."}, {"card_id": "..."}], "practice_question_ids": ["<question_id>", ...]} → PATCH /learn/lessons/{id} {"status": "published"}.',
          '6. Lộ trình: POST /learn/paths {"title": "<TÊN KHOÁ>", "period": "month", "year": <NĂM>, "month": <T>} → PATCH /learn/paths/{id} {"description": "...", "modules": [{"week": 1, "title": "...", "lesson_ids": ["<lesson_id>"], "due_at": "<YYYY-MM-DDT16:59:00Z>"}, ...], "required_items": ["<lesson_id>"], "exam": {"duration_min": 30, "pass_score": 70, "attempts": 1, "scope": "path", "blueprint": [{"kind": "single", "count": <số câu single đã duyệt>}, {"kind": "essay", "count": <số câu essay đã duyệt>}]}}.',
          '7. Phát hành: POST /learn/paths/{id}/publish (lỗi 400 nêu thiếu gì — sửa rồi gọi lại).',
          '8. Giao: GET /learn/paths/{id} → trường assignable.people liệt kê ai giao được → POST /learn/paths/{id}/assign {"learner_ids": ["<user_id>"], "due_at": "<YYYY-MM-DDT16:59:00Z>"} → báo lại assigned và skipped (kèm reason).',
          'Cuối cùng gửi tôi link <URL>/learn/paths/{id}.',
        ].join('\n'),
      },
    ],
  },
  {
    id: 'claude',
    title: 'Hỏi Claude & kết nối AI',
    audience: ['all'],
    links: [{ to: '/chat', label: 'Trò chuyện Claude' }, { to: '/connect', label: 'Kết nối AI' }],
    body: `
**Chat nhanh** — bấm **Hỏi Claude** ở góc dưới bên phải bất kỳ trang nào: cửa sổ chat mở ngay tại chỗ, bạn vẫn thấy và thao tác trang đang xem. Mỗi câu hỏi gửi kèm trang đang mở (thẻ, nguồn, video, bài học… đang xem) nên hỏi được "trang này dùng thế nào", "tóm tắt thẻ này", "video này nói gì". Claude cũng đọc được **Hướng dẫn sử dụng** này để chỉ đúng nút / tab. Trên thanh tiêu đề: **☰** các cuộc trò chuyện trước, **＋** cuộc mới, **⤢** mở rộng thành trang *Trò chuyện Claude*, **—** thu nhỏ (cuộc trò chuyện vẫn giữ, mở lại là tiếp). Trên điện thoại cửa sổ chiếm cả màn hình.

**Trò chuyện Claude** (trang đầy đủ, menu trái) — cùng cuộc trò chuyện với Chat nhanh nhưng rộng hơn, có danh sách bên trái. Claude tra VCWIKI, Kho tư liệu, bản chữ video **bằng đúng quyền của bạn** (chỉ thấy kho bạn xem được) và có thể ghi thẳng vào VCWIKI thay bạn (thẻ tạo ra là nháp, vẫn phải duyệt). Cuộc trò chuyện được lưu; *+ Cuộc trò chuyện mới* để bắt đầu chủ đề khác. Enter để gửi, Shift+Enter xuống dòng.

**Khi Claude không hoạt động:** nếu máy chủ bật dự phòng và Ollama sẵn sàng, cả Chat nhanh và Trò chuyện Claude tự chuyển sang **AI local**. Nhãn dưới câu trả lời cho biết AI và model đang dùng. AI local dùng các công cụ đọc để tra cứu VCWIKI, Kho tư liệu, video, khoá học, hướng dẫn sử dụng và nghiệp vụ **theo đúng quyền của bạn**. Danh sách công cụ đã gọi hiện ngay trong câu trả lời. AI local chưa tạo, sửa, duyệt, xoá dữ liệu hoặc nạp link thay bạn.

Chữ Claude đang trả lời dở sẽ được thay bằng câu trả lời local, không ghép hai câu. Nếu bạn bấm **Dừng** hoặc Claude đã gọi công cụ, hệ thống không tự chạy lại qua local. Nút **Dừng** vẫn dùng được khi AI local trả lời. Lịch sử được giữ khi đổi AI; nếu cả hai đều lỗi, màn hình báo lý do để bạn thử gửi lại. Câu hỏi quá dài cho AI local sẽ được yêu cầu rút ngắn.

Hỏi hiệu quả:

- Nói rõ việc: "Tìm thẻ về xử lý khách chê giá, tóm lại thành 5 câu tôi nói với chủ gara".
- Bảo Claude trích nguồn: "kèm mã thẻ".
- Bấm vào thẻ Claude nhắc tới để mở khung thẻ đọc bản gốc.
- Hỏi cách dùng: "làm sao để đề xuất sửa thẻ đã duyệt?" — Claude trả lời theo Hướng dẫn sử dụng kèm link tới mục.

**Kết nối AI (MCP)** — dùng VCWIKI từ Claude Desktop / Claude Code / AI khác:

1. *Kết nối AI* → đặt *Tên token* → **+ Tạo token** → **sao chép ngay** (token chỉ hiện một lần).
2. Làm theo mục *Cách kết nối* trên trang để dán vào Claude Desktop hoặc Claude Code.
3. Không dùng nữa: **Thu hồi**. Nghỉ việc thì mọi token tự bị thu hồi.

AI qua MCP không duyệt được thẻ, không làm bài thi, không chốt điểm — những việc đó chỉ làm trên web.
`,
  },
  {
    id: 'quan-tri',
    title: 'Quản trị: người dùng, lĩnh vực, tổ chức',
    audience: ['admin'],
    links: [{ to: '/admin', label: 'Người dùng & lĩnh vực' }, { to: '/org', label: 'Cơ cấu tổ chức' }],
    body: `
- **Người dùng & lĩnh vực** (chỉ quản trị viên): tab *Người dùng* — tìm, lọc vai trò, cột **Đăng nhập gần nhất** (lọc *Không đăng nhập ≥ 30 ngày*, dùng token MCP không tính), **Tạo tài khoản**, đổi vai trò / khoá có hỏi lại; tab *Lĩnh vực* — sửa cây lĩnh vực; gán **Người chủ nhánh** cho nhánh tầng 2 — người duyệt bước 2 của thẻ trong nhánh.
- **Cơ cấu tổ chức**: tab *Sơ đồ* (cây đơn vị bên trái, người của đơn vị bên phải, thao tác đơn vị trong menu **Thêm ▾**) · *Của tôi* · *Chức năng* · *Cấp bậc* · *Vai trò chức năng* · *Nhập dữ liệu*; bấm tên người mở hồ sơ ở ngăn kéo — hồ sơ người (đơn vị, chức năng, cấp bậc 1–7, quản lý trực tiếp / chuyên môn), **Nghỉ việc** (khoá tài khoản, thu hồi token, chuyển người dưới quyền), nhập nhân sự từ Excel (*Xem trước* → *Xác nhận nhập*).
- **Vai trò chức năng**: cấp Biên tập viên, Người duyệt, Chủ sở hữu lĩnh vực, **Quản lý đào tạo (L&D)**… theo phạm vi đơn vị / lĩnh vực. Người giữ vai trò có thể **Uỷ quyền** tạm cho người khác khi nghỉ phép.
- **Bảng cấp bậc**: cấp bậc 1–7 ứng với cấp độ nội dung thẻ — dùng để chọn thẻ đúng tầm khi thiết kế lộ trình học.
- **Số người duyệt tối thiểu** (*Người dùng & lĩnh vực* → tab **Duyệt**, chỉ quản trị viên): *2* cho vận hành thật, *1 (dùng thử)* khi chưa đủ người.

Lưu ý: quyền quản trị **không tự kèm** quyền soạn bài học — muốn soạn bài / lộ trình thì tự cấp cho mình vai trò Quản lý đào tạo (L&D) ở Cơ cấu tổ chức.
`,
  },
  {
    id: 'hoi-dap',
    title: 'Câu hỏi thường gặp',
    audience: ['all'],
    body: `
**Tôi không thấy một thẻ / tư liệu mà đồng nghiệp nói tới.**
Bạn chưa ở trong kho chứa nó. Nhờ chủ kho mời (Kho & chia sẻ → Quản lý → Mời), hoặc nhờ họ sao chép thẻ sang kho chung.

**Tôi bấm Duyệt mà thẻ vẫn là Nháp.**
Có thể bạn là tác giả thẻ (bốn mắt — người khác phải duyệt), hoặc hệ thống cần 2 người duyệt và bạn mới là bước 1. Xem lý do ở Hộp duyệt / tab Duyệt hàng loạt.

**Sao không sửa thẳng được thẻ đã duyệt?**
Để tri thức chính thức không bị đổi âm thầm. Dùng **Đề xuất sửa**; thẻ giữ bản cũ tới khi đề xuất được duyệt thành bản mới.

**Thẻ AI dựng có đáng tin không?**
Thẻ AI luôn là **Nháp** tới khi người có quyền duyệt; mỗi thẻ dẫn về tài liệu gốc — bấm *Nguồn* để kiểm lại.

**Tìm không ra dù chắc chắn có thẻ.**
Thử bỏ bớt bộ lọc (kho, loại, cấp độ, trạng thái), gõ ngắn hơn, hoặc gõ câu hỏi đầy đủ để tìm theo nghĩa. Tư liệu chưa thành thẻ thì tìm ở Kho tư liệu → *Theo nội dung*.

**Link Google nạp không được.**
Mở tài liệu → Chia sẻ → "Bất kỳ ai có đường liên kết" (Người xem), rồi dán lại. Chưa hỗ trợ cả thư mục Drive.

**Tôi nên bắt đầu Content Engine từ đâu?**
Tạo một *Dự án marketing*, nạp 5–10 tài nguyên thật (bảng giá, video đối thủ, bài khách khen), ghim vài thẻ, bấm *AI soạn nháp 7P* rồi chốt. Sau đó lập chiến dịch trong dự án — mọi tham chiếu đã có sẵn. Xem mục *Content Engine: đường đi chuẩn*.

**AI không có gì để phân tích 7P.**
Dự án chưa có mục tiêu, tài nguyên hay thẻ ghim nào. Nạp ít nhất một thứ ở tab Tài nguyên / Thẻ học (hoặc điền Mục tiêu) rồi bấm lại.

**Chốt 7P rồi thấy sai, sửa thế nào?**
Bản đã chốt không sửa được — tạo phiên bản mới (*AI soạn nháp 7P* hoặc *Bản trống*), sửa rồi chốt. Chiến dịch tạo từ đây dùng bản mới; chiến dịch cũ giữ bản cũ nên không lệch căn cứ.

**Chiến dịch trong dự án lấy tham chiếu thế nào?**
Nếu bạn để trống phần video / link đối thủ / bài mẫu khi lập, hệ thống dùng tài nguyên R / S / P của dự án; thẻ ghim K luôn đứng đầu danh sách thẻ; phân tích 7P đã chốt được nạp vào prompt. Bạn vẫn có thể chọn tay để ghi đè.

**Người ngoài kho tôi mời vào dự án không thấy chiến dịch.**
Hiện chiến dịch và bài viết vẫn theo quyền kho; thành viên dự án ngoài kho chỉ xem được dự án, tài nguyên, thẻ và phân tích. Muốn họ xem cả chiến dịch, nhờ chủ kho mời họ vào kho (Kho & chia sẻ).

**Video nạp lâu.**
Video và ghi âm chuyển chữ tuần tự trên máy chủ; xem vị trí trong hàng và giờ dự kiến xong ở Kho tư liệu. Muốn một nguồn chạy trước: mở nguồn → *⇡ Ưu tiên xử lý trước* — kênh đang chạy nhường sau video hiện tại.

**Một số video trong kênh bị lỗi, không có chữ.**
Bấm *⚠ Video lỗi* ở thanh lọc Kho tư liệu để xem video lỗi của mọi kênh, gom theo nhóm lỗi (mạng, bị chặn, video đã gỡ…), kèm số lần lỗi và lịch sử lỗi. *▶ Chạy tiếp tất cả* tự lấy lại chữ các video lỗi — sau khi xong các nguồn mới; video lỗi đủ 3 lần — hoặc video chỉ dành cho hội viên kênh / đã bị gỡ (thử lại cũng không được) — thì máy thôi tự thử, muốn thử nữa thì bấm *Lấy lại chữ* ở video đó (được làm trước).
`,
  },
]
