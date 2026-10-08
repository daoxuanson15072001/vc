# VC Home — Yêu cầu chức năng chi tiết

Phiên bản 0.2 · 08/10/2026 · Trạng thái: Đã chốt nội dung (chờ đội phát triển rà)

## Tóm tắt

- **Tài liệu nói gì:** đặc tả đủ 90 yêu cầu chức năng trong danh mục README mục 5 (78 yêu cầu ở mục 1–12, 12 yêu cầu nhận thêm ở mục 14), chia 12 phân hệ (AUT, HOM, NSU, ORG, APP, ACC, REQ, REV, LCM, INT, ADM, IMP).
- **Mỗi yêu cầu có:** ưu tiên và giai đoạn, tác nhân, mô tả, điều kiện trước, xử lý chính từng bước, thông báo lỗi nguyên văn tiếng Việt, dữ liệu dùng, quy tắc, màn hình, phụ thuộc, và 3–6 tiêu chí nghiệm thu đo được.
- **Bảng phụ đi kèm:** trường hồ sơ, trường vị trí, ma trận che thông tin theo người xem, loại đơn vị, danh mục chức năng, trường và trạng thái app, lý do gỡ quyền, mốc thời gian vào làm, chuyển, nghỉ việc, bộ claim theo giai đoạn, danh sách cảnh báo, danh sách cài đặt, mẫu Excel nhập dữ liệu.
- **Quy ước chung cho quyền** (dòng quyền, quyền hiệu lực, trạng thái, job hẹn giờ 15 phút từ GĐ C, thông báo bằng email ở GĐ C) nằm ở đầu mục 6.
- **Đã soát chéo** với README, 02, 05, 07, 08 và thiết kế SSO ngày 08/10/2026. Các quyết định khi soát ghi ở [12](12-cau-hoi-rui-ro.md) mục 5; khi đoạn nào còn lệch thì quyết định ở 12 mục 5 thắng.
- **Đề xuất bổ sung:** đã xử lý hết ngày 08/10/2026 (mục 13 cột "Trạng thái", [12](12-cau-hoi-rui-ro.md) mục 6).
- **Người duyệt xem kỹ:**
  - VH-AUT-05 (làm mới phiên chỉ khi có thao tác), VH-AUT-08 (gắn tài khoản);
  - VH-NSU-08 (che thông tin);
  - VH-ACC-01, 02 (luật và cách tính lại);
  - VH-LCM-01…03 (mốc thời gian vào làm, chuyển, nghỉ việc);
  - VH-INT-01 (claim);
  - VH-IMP-01 (mẫu Excel).

## Mục lục

- [1. AUT — Đăng nhập và phiên](#1-aut--đăng-nhập-và-phiên)
- [2. HOM — Trang chủ và chuyển app](#2-hom--trang-chủ-và-chuyển-app)
- [3. NSU — Hồ sơ nhân sự (VC People)](#3-nsu--hồ-sơ-nhân-sự-vc-people)
- [4. ORG — Cơ cấu tổ chức](#4-org--cơ-cấu-tổ-chức)
- [5. APP — Danh mục app và vai trò app](#5-app--danh-mục-app-và-vai-trò-app)
- [6. ACC — Cấp và gỡ quyền](#6-acc--cấp-và-gỡ-quyền)
- [7. REQ — Xin quyền và duyệt](#7-req--xin-quyền-và-duyệt)
- [8. REV — Rà soát định kỳ](#8-rev--rà-soát-định-kỳ)
- [9. LCM — Vòng đời nhân viên](#9-lcm--vòng-đời-nhân-viên)
- [10. INT — Tích hợp app](#10-int--tích-hợp-app)
- [11. ADM — Quản trị và nhật ký](#11-adm--quản-trị-và-nhật-ký)
- [12. IMP — Nhập và đồng bộ dữ liệu](#12-imp--nhập-và-đồng-bộ-dữ-liệu)
- [13. Đề xuất bổ sung (chưa cấp mã)](#13-đề-xuất-bổ-sung-chưa-cấp-mã)
- [14. Yêu cầu nhận thêm ngày 08/10/2026](#14-yêu-cầu-nhận-thêm-ngày-08102026)
- [Lịch sử cập nhật](#lịch-sử-cập-nhật)

---

## 1. AUT — Đăng nhập và phiên

Phân hệ VC ID lo câu hỏi "người này là ai". Nhân viên chỉ đăng nhập bằng tài khoản Google Workspace công ty. VC ID (Keycloak, realm `vc`, tại `id.vcprosperous.com`) đứng giữa Google và các app. Thiết kế kỹ thuật chi tiết ở [ky-thuat/thiet-ke-sso-keycloak.md](ky-thuat/thiet-ke-sso-keycloak.md) (gọi tắt "thiết kế SSO").

**Ghi chú chung cho mục 1–5:**
- Câu trong ngoặc kép là câu hiện cho người dùng, giữ đúng chữ. `{…}` là chỗ điền giá trị.
- "p95" nghĩa là 95% số lần đo đạt mức đó.
- Mọi giờ là giờ Việt Nam (VH-BR-22). "00:00" là nửa đêm giờ Việt Nam.
- Thuật ngữ kỹ thuật dùng nhiều lần:
  - **Token:** gói thông tin có chữ ký số do VC ID cấp sau khi đăng nhập. App kiểm chữ ký rồi mới tin nội dung.
  - **Claim:** một trường trong token, ví dụ `email`, `groups`.
  - **Phiên chung:** phiên đăng nhập của VC ID trên một trình duyệt, có mã `sid`. **Phiên riêng:** phiên mỗi app tự giữ sau khi nhận token.
  - **Back-channel:** VC ID gọi thẳng máy chủ của app, không qua trình duyệt, để báo một phiên đã kết thúc.
  - **API:** cổng để chương trình khác gọi lấy dữ liệu. **Job:** chương trình chạy tự động theo lịch. **Cache:** bản lưu tạm để đỡ phải tải lại.

**Mã lỗi đăng nhập dùng chung** (thiết kế SSO mục 5.2). VC Home hiện các câu này ở VH-MH-01. App dùng câu của mình nhưng giữ đúng nghĩa. Mỗi trang lỗi ghi thêm dòng "Mã lỗi: {mã} · {hh:mm:ss dd/mm/yyyy}", nút "Thử lại" và email hỗ trợ IT.

| Mã | Câu hiện cho người dùng |
|---|---|
| `outside_domain` | "Tài khoản này không thuộc công ty. Hãy chọn tài khoản @vcprosperous.com hoặc @vcpart.vn." · nút "Chọn tài khoản khác" |
| `app_not_granted` | "Bạn chưa được cấp quyền vào {tên app}. Mở VC Home để xem các ứng dụng bạn được dùng." (từ GĐ D thêm nút "Xin quyền") |
| `not_granted` | "Bạn chưa có tài khoản trong {tên app}. Liên hệ quản trị của {tên app}." |
| `locked` | "Tài khoản đã bị khoá. Liên hệ quản trị viên." |
| `identity_conflict` | "Tài khoản đăng nhập chưa gắn được với hồ sơ của bạn. IT đã được báo; vui lòng chờ hoặc liên hệ IT." |
| `state_invalid` | "Liên kết đăng nhập đã hết hạn hoặc đã được dùng. Hãy đăng nhập lại." |
| `idp_unreachable` | "Không kết nối được máy chủ đăng nhập VC ID. Thử lại sau ít phút. Nếu gấp, liên hệ IT." |
| `cancelled` | "Bạn đã huỷ đăng nhập." · nút "Đăng nhập lại" |

### VH-AUT-01 — Đăng nhập bằng tài khoản Google công ty qua VC ID

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | Nhân viên (mọi người có tài khoản Google công ty); Google Workspace; VC ID |
| Mô tả | Nhân viên vào VC Home và mọi app bằng tài khoản Google Workspace công ty, đi qua VC ID. VC ID và app không có mật khẩu riêng; mật khẩu và xác thực 2 bước do Google lo. Mục đích: mỗi người có một danh tính duy nhất (`sub`) dùng chung cho mọi app, nên khoá một nơi là mất quyền mọi nơi. |
| Điều kiện trước | Realm `vc` đang chạy và đã nối Google (OAuth client I3). Client `vchome` khai đúng địa chỉ trả về `/callback`, `/silent`. Người dùng có tài khoản Google công ty đang hoạt động, đã bật xác thực 2 bước theo chính sách Google Admin. |
| Xử lý chính | 1. Người dùng mở `home.vcprosperous.com`. VC Home thử đăng nhập im lặng (`prompt=none`, chờ tối đa 3 giây). Có phiên chung thì sang bước 7. Không có thì hiện trang chào VH-MH-01 với nút "Đăng nhập bằng tài khoản công ty".<br>2. Bấm nút: VC Home tạo `state`, `nonce` và mã PKCE (S256), rồi chuyển tới VC ID kèm `kc_idp_hint=google`. PKCE là cách chống người khác lấy trộm mã đăng nhập giữa đường.<br>3. VC ID chuyển thẳng sang Google; người dùng không thấy trang của Keycloak. Google hiện ô chọn tài khoản (`prompt=select_account`).<br>4. Google kiểm mật khẩu và xác thực 2 bước, trả VC ID thông tin `email`, `hd`, tên, ảnh.<br>5. VC ID kiểm domain (VH-AUT-02) và kiểm tài khoản không bị khoá. Lần đầu: tạo user với `sub` mới (UUID, không bao giờ đổi), gắn nhóm mặc định `app-vclinks`, `app-vcwiki`. Các lần sau: cập nhật tên, ảnh từ Google. Mở phiên chung có mã `sid`.<br>6. VC ID trả `code` về `/callback`. VC Home đổi `code` lấy token bằng PKCE, kiểm chữ ký, `iss`, `aud`, `nonce`. Token chỉ giữ trong bộ nhớ trang, không ghi vào `localStorage` hay `sessionStorage`.<br>7. VC Home hiện trang chủ VH-MH-02 (lưới app VH-HOM-01). Nếu người dùng mở một đường dẫn sâu trước khi đăng nhập thì quay về đúng đường dẫn đó; chỉ nhận đường dẫn trong `home.vcprosperous.com`.<br>8. Token GĐ A có 8 claim: `sub`, `email`, `email_verified`, `name`, `picture`, `hd`, `groups`, `sid`. GĐ B thêm thông tin hồ sơ (VH-AUT-08, VH-INT-01).<br>9. VC ID ghi sự kiện `LOGIN` (giữ 24 tháng). Từ GĐ B, VC Home API cập nhật lần đăng nhập cuối trong `accounts`. |
| Ngoại lệ, thông báo lỗi | Người dùng bấm "Huỷ" ở Google: câu `cancelled`.<br>Mở lại link `/callback` cũ hoặc quá 10 phút: câu `state_invalid`.<br>VC ID hoặc Google không trả lời: câu `idp_unreachable`.<br>Tài khoản bị khoá trên VC ID: trang "Tài khoản đã bị khoá. Liên hệ quản trị viên."<br>Sai domain: xem VH-AUT-02.<br>Lỗi khác: trang lỗi chung với mã lỗi ngắn và thời gian để báo IT. |
| Dữ liệu | VC ID: user (`sub`, email, tên, ảnh, `hd`, nhóm), phiên chung, sự kiện đăng nhập. Từ GĐ B: `accounts` (`sub`, nhân viên, lần đăng nhập cuối), `audit_log`. |
| Quy tắc | VH-BR-01, VH-BR-02, VH-BR-19, VH-BR-22 |
| Màn hình | VH-MH-01, VH-MH-02 |
| Phụ thuộc | VH-AUT-02, VH-AUT-08 (GĐ B), VH-INT-01; quy trình VH-QT-01. Đầu vào: I2 (DNS), I3 (OAuth client Google), I6 (hai domain cùng hay khác Workspace). GĐ B cần mapper `audience` để VC Home API nhận token của VC Home. |

**Tiêu chí nghiệm thu:**
1. Một tài khoản `@vcprosperous.com` và một tài khoản `@vcpart.vn` đăng nhập lần đầu từ VC Home đều thấy lưới app. Không bước nào hiện trang đăng nhập của Keycloak.
2. Từ lúc Google trả về tới lúc lưới app hiện ≤ 3 giây (p95 của 20 lần thử, mạng văn phòng).
3. Token giải mã ra có đủ 8 claim ở bước 8. `sub` giữ nguyên qua 3 lần đăng nhập và sau khi đổi tên trên Google.
4. Mở `home.vcprosperous.com/ho-so` khi chưa đăng nhập: đăng nhập xong về đúng `/ho-so`. Đường dẫn đích trỏ ra tên miền khác bị bỏ, về `/`.
5. Bấm "Huỷ" ở Google thì VH-MH-01 hiện đúng câu `cancelled` và nút "Đăng nhập lại". Mở lại một link `/callback` cũ thì hiện đúng câu `state_invalid`.
6. Sau khi đăng nhập, `localStorage` và `sessionStorage` của `home.vcprosperous.com` không có token nào (kiểm bằng công cụ của trình duyệt).

### VH-AUT-02 — Chặn tài khoản ngoài hai domain công ty

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | Người dùng bất kỳ; VC ID; app |
| Mô tả | Chỉ tài khoản thuộc Google Workspace công ty với đuôi `@vcprosperous.com` hoặc `@vcpart.vn` mới đăng nhập được. Chặn ở 3 lớp: Google, VC ID, app. Tài khoản Google cá nhân đăng ký bằng địa chỉ công ty (không do Workspace quản) cũng bị chặn vì không có claim `hd`. |
| Điều kiện trước | Danh sách domain `vcprosperous.com`, `vcpart.vn` đã cấu hình ở VC ID và ở từng app (`COMPANY_DOMAINS`). |
| Xử lý chính | 1. Lớp Google: VC ID gửi gợi ý domain công ty. Đây chỉ là gợi ý; người dùng vẫn chọn được Gmail cá nhân.<br>2. Lớp VC ID: khi Google trả về, kiểm cả hai điều: (a) đuôi email thuộc danh sách, so khớp đúng từng chữ, không phân biệt hoa thường, không nhận domain con như `abc.vcpart.vn`; (b) claim `hd` có mặt và thuộc danh sách. Thiếu một điều thì không tạo user, không mở phiên, hiện trang "Sai domain".<br>3. Lớp app: app kiểm lại đuôi email và `hd` trong token (hợp đồng tích hợp điểm 3). Sai thì từ chối với mã `outside_domain`.<br>4. Mỗi lần chặn ghi một dòng nhật ký `login_denied`, lý do `outside_domain`, email đã che bớt (ví dụ `n***@gmail.com`), IP rút gọn. Không tạo bản ghi người dùng nào cho tài khoản bị chặn.<br>5. Thêm hoặc bớt domain chỉ làm bằng sửa cấu hình (VC ID và mọi app), có chủ dự án duyệt. Không có màn sửa.<br>6. Từ GĐ B: đúng domain nhưng chưa có hồ sơ nhân sự thì vẫn vào được VC Home, nhưng trang chủ trống (VH-BR-02, VH-AUT-08). |
| Ngoại lệ, thông báo lỗi | Trang sai domain: "Tài khoản này không thuộc công ty. Hãy chọn tài khoản @vcprosperous.com hoặc @vcpart.vn." · nút "Chọn tài khoản khác" mở lại ô chọn tài khoản Google.<br>Nếu bản Keycloak đã ghim không nhận hai "hosted domain": dùng luồng "first broker login" có bước kiểm `hd` (thiết kế SSO mục 5.1.2). Người dùng thấy kết quả như nhau. |
| Dữ liệu | Cấu hình realm (hosted domain, mapper `hd`); sự kiện VC ID `IDENTITY_PROVIDER_LOGIN_ERROR`; từ GĐ B: `audit_log`. |
| Quy tắc | VH-BR-02, VH-BR-18, VH-BR-19 |
| Màn hình | VH-MH-01 |
| Phụ thuộc | VH-AUT-01, VH-INT-01; VH-ADM-04 (cảnh báo khi tỉ lệ đăng nhập lỗi > 20% trong 15 phút); đầu vào I6. |

**Tiêu chí nghiệm thu:**
1. Chọn Gmail cá nhân: hiện trang sai domain đúng câu chữ. Nút "Chọn tài khoản khác" mở lại ô chọn tài khoản Google. Realm `vc` không có user mới.
2. Tài khoản của một Google Workspace khác (domain ngoài) bị chặn như mục 1.
3. Tài khoản Google cá nhân đăng ký bằng địa chỉ `@vcpart.vn` (không có `hd`) bị chặn.
4. Trên môi trường test có máy phát token giả: gửi tới app một token đúng chữ ký nhưng email ngoài domain, app từ chối với `outside_domain`.
5. Mỗi lần chặn sinh đúng 1 dòng nhật ký có lý do và email đã che. Không dòng nào chứa email đầy đủ của người ngoài.

### VH-AUT-03 — Đăng nhập một lần giữa các app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | Nhân viên; VC ID; các app (VC Home, VClinks, VCwiki, app sau) |
| Mô tả | Đăng nhập một lần thì mở VC Home, VClinks, VCwiki và app sau không phải chọn tài khoản lại, cho tới khi phiên chung hết hạn. Mỗi app vẫn có phiên riêng, nhưng tạo phiên riêng không cần người dùng làm gì. Cách làm không dựa vào cookie dùng chung giữa các tên miền, nên app ở `tramaphutung.com` chạy như app ở `vcprosperous.com`. |
| Điều kiện trước | Có phiên chung còn hạn. App đã đạt 8 điểm của hợp đồng tích hợp (VH-APP-04). |
| Xử lý chính | 1. Người dùng bấm ô app ở VC Home (mở trong cùng tab) hoặc mở thẳng một đường dẫn sâu của app.<br>2. App chưa có phiên riêng thì chuyển tới VC ID (PKCE, `kc_idp_hint=google`). VC ID thấy phiên chung nên trả `code` ngay, không hiện gì.<br>3. App đổi `code` ở máy chủ, kiểm token đủ 6 điểm (chữ ký, `iss`, `aud`, `exp`, `nonce`, `email_verified`), kiểm domain, kiểm nhóm `app-<khoá app>` nếu bật `OIDC_REQUIRE_APP_GROUP`. Từ GĐ C kiểm vai trò app (VH-BR-20).<br>4. App tìm người dùng theo `sub`. Chưa có thì tìm theo email và gắn `sub` một lần. Tạo phiên riêng, lưu kèm `sid` và `sub`.<br>5. App đưa người dùng về đúng trang đích. Tham số trang đích chỉ nhận đường dẫn trong cùng app.<br>6. Không có phiên chung: làm như VH-AUT-01 bước 3–6 (chọn tài khoản Google một lần), rồi về app.<br>7. Tải lại VC Home: đăng nhập im lặng lại qua `/silent`, không hiện gì. `home.` và `id.` cùng tên miền gốc `vcprosperous.com`, nên cách này không bị trình duyệt chặn cookie bên thứ ba. |
| Ngoại lệ, thông báo lỗi | Không thuộc nhóm app hoặc không có vai trò app: câu `app_not_granted`.<br>App không cho tự tạo tài khoản và chưa có tài khoản: câu `not_granted`.<br>Bị khoá riêng trong app (ví dụ VClinks `tam_khoa`): app tự báo, không ảnh hưởng app khác.<br>Email đã gắn với `sub` khác trong app: câu `identity_conflict`, app báo admin của app. |
| Dữ liệu | Phiên chung VC ID (`sid`). Phía app: phiên riêng thêm `sid`, `idp_sub`; user thêm `idp_sub`, `idp_groups`. |
| Quy tắc | VH-BR-01, VH-BR-20, VH-BR-21 |
| Màn hình | VH-MH-02, VH-MH-21, VH-MH-01 |
| Phụ thuộc | VH-AUT-01, VH-INT-01, VH-INT-04, VH-APP-04; quy trình VH-QT-01. |

**Tiêu chí nghiệm thu:**
1. Đã đăng nhập VC Home, bấm ô VClinks: vào thẳng `/conversations` trong ≤ 2 giây, không có trang chọn tài khoản hay trang xác nhận nào.
2. Đã có phiên, dán một đường dẫn sâu của VCwiki vào thanh địa chỉ: vào đúng trang đó.
3. Chưa có phiên, mở đường dẫn sâu của VClinks: chọn tài khoản Google đúng 1 lần, rồi vào đúng trang.
4. Tải lại VC Home 10 lần liên tiếp: không lần nào phải chọn tài khoản.
5. Người không thuộc nhóm `app-vcwiki` (VCwiki bật kiểm nhóm) mở VCwiki: thấy câu `app_not_granted`, VCwiki không tạo phiên riêng.

### VH-AUT-04 — Đăng xuất một nơi là đăng xuất mọi app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | Nhân viên; VC ID; các app |
| Mô tả | Đăng xuất ở VC Home hay ở bất kỳ app nào thì mọi app trên trình duyệt đó mất phiên, kể cả app không còn tab nào đang mở. VC ID dùng back-channel để báo từng app thu hồi phiên theo `sid`. Phiên trên trình duyệt hay máy khác (khác `sid`) không bị ảnh hưởng; muốn đăng xuất các nơi đó dùng VH-AUT-10. |
| Điều kiện trước | Người dùng đang có phiên chung. App đã khai endpoint back-channel (VH-INT-04). |
| Xử lý chính | 1. Từ VC Home: menu ảnh đại diện → "Đăng xuất". VC Home gọi VC ID kèm `id_token_hint`, nên không hiện trang xác nhận.<br>2. Từ app: app thu hồi phiên riêng trước, rồi chuyển trình duyệt tới trang đăng xuất của VC ID kèm `post_logout_redirect_uri=https://home.vcprosperous.com/da-dang-xuat`. VC ID hiện trang xác nhận "Đăng xuất khỏi mọi ứng dụng VC Phồn Vinh?" với nút "Đăng xuất".<br>3. VC ID xoá phiên chung, gửi `logout_token` (có chữ ký, có `sid`) tới endpoint back-channel của mọi app đang có phiên của người này.<br>4. Mỗi app kiểm `logout_token`: chữ ký, `iss`, `aud`, `iat` trong 5 phút, có `events` đúng chuẩn, không có `nonce`, `jti` chưa dùng (lưu 10 phút). Đạt thì thu hồi phiên theo `sid` (không có `sid` thì theo `sub`) và trả `200`.<br>5. Trình duyệt về `/da-dang-xuat`: "Bạn đã đăng xuất khỏi mọi ứng dụng" · nút "Đăng nhập lại". Thêm dòng "Dùng máy chung? Hãy đăng xuất cả tài khoản Google." kèm liên kết đăng xuất Google. VC ID không tự đăng xuất Google.<br>6. Tab VC Home khác đang mở: phát hiện mất phiên ở lần gọi kế tiếp hoặc lần kiểm phiên định kỳ (≤ 10 giây khi tab đang hiện), rồi chuyển về `/da-dang-xuat`.<br>7. VC ID ghi sự kiện `LOGOUT`. Back-channel gửi lỗi được ghi và gom vào cảnh báo vận hành theo giờ (VH-ADM-04). |
| Ngoại lệ, thông báo lỗi | App không trả lời back-channel (mất mạng, lỗi 5xx): VC ID không gửi lại. Phiên riêng của app đó còn tới khi hết hạn; nhóm vận hành nhận cảnh báo; quản trị hệ thống đăng xuất lại hoặc khoá người dùng nếu cần (VH-AUT-06).<br>`logout_token` sai: app trả `400`, không thu hồi gì.<br>Người dùng đóng trang xác nhận mà không bấm: phiên chung còn; phiên riêng của app đã bị thu hồi ở bước 2, mở lại app sẽ đăng nhập im lặng. |
| Dữ liệu | Phiên chung VC ID; phiên riêng của app; `jti` đã dùng (phía app, `auth_logout_jti`, lưu 10 phút). |
| Quy tắc | VH-BR-14 (khoá khi nghỉ việc dùng cùng cơ chế), VH-BR-22 |
| Màn hình | VH-MH-01 (trang đã đăng xuất), VH-MH-02 (menu ảnh đại diện), VH-MH-21 |
| Phụ thuộc | VH-INT-04, VH-AUT-01, VH-AUT-03; quy trình VH-QT-02. VClinks phải sửa nút "Thoát" để gọi thu hồi phiên trên máy chủ trước khi chuyển sang VC ID (kiểm kê chức năng VClinks ghi nút này hiện chưa gọi `POST /api/auth/logout`). |

**Tiêu chí nghiệm thu:**
1. Đăng xuất ở VClinks: trang xác nhận đúng câu chữ. Bấm "Đăng xuất" thì tab VCwiki và VC Home đang mở mất phiên trong ≤ 10 giây.
2. Đăng xuất ở VC Home: không có trang xác nhận; VClinks và VCwiki mất phiên trong ≤ 10 giây.
3. Gửi lại cùng một `logout_token` lần thứ hai: app trả `400`.
4. `logout_token` có `nonce`, hoặc thiếu `events`, hoặc `iat` cũ hơn 5 phút: app trả `400`, phiên không bị thu hồi.
5. Cùng người đăng nhập trên trình duyệt A và B: đăng xuất ở A thì B vẫn dùng bình thường.

### VH-AUT-05 — Thời hạn phiên: 12 giờ không dùng, tối đa 7 ngày

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | Nhân viên; VC ID; các app |
| Mô tả | Phiên hết hạn sau 12 giờ không dùng, và chậm nhất 7 ngày kể từ lần chọn tài khoản Google, dù vẫn dùng liên tục. Thời hạn khớp VClinks hiện nay và giảm rủi ro khi quên đăng xuất trên máy chung. |
| Điều kiện trước | Cấu hình realm `ssoSessionIdleTimeout = 43200` (12 giờ), `ssoSessionMaxLifespan = 604800` (7 ngày), `accessTokenLifespan = 300` (5 phút). |
| Xử lý chính | 1. Phiên chung VC ID: hết hạn sau 12 giờ không có app hay VC Home nào xin token, và hết hạn cứng sau 7 ngày từ lúc đăng nhập Google.<br>2. Token truy cập sống 5 phút. App chỉ dùng `id_token` lúc đăng nhập rồi bỏ, không lưu.<br>3. Phiên riêng của app: không dài hơn 7 ngày từ lúc tạo, và hết sau 12 giờ không dùng. VClinks đã có hạn 12 giờ; VCwiki giảm cookie từ 14 xuống 7 ngày và phải thêm hạn 12 giờ không dùng.<br>4. VC Home chỉ gia hạn token im lặng khi tab đang hiện và người dùng có thao tác (chuột, phím, chạm) trong 30 phút gần nhất. Tab bỏ quên không được giữ phiên chung sống mãi.<br>5. Hết phiên chung: lần thao tác kế tiếp ở VC Home chuyển sang VH-MH-01 "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." Bấm "Đăng nhập lại" thì chọn tài khoản Google 1 lần rồi về đúng trang đang xem.<br>6. Hết phiên riêng của app nhưng phiên chung còn: app đăng nhập im lặng lại, người dùng không thấy gì.<br>7. Form đang nhập dở (đề nghị sửa hồ sơ, yêu cầu quyền) giữ bản nháp trên trình duyệt để không mất khi phải đăng nhập lại.<br>8. Thời hạn nằm trong cấu hình realm; đổi phải có chủ dự án duyệt. Từ GĐ D xem ở VH-MH-20 (VH-ADM-05). |
| Ngoại lệ, thông báo lỗi | Hết phiên: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."<br>Không gia hạn được vì VC ID không trả lời: câu `idp_unreachable`; phiên riêng của app đang có vẫn dùng tới hạn của nó. |
| Dữ liệu | Cấu hình realm; phiên chung; phiên riêng của app (thời điểm tạo, lần dùng cuối). |
| Quy tắc | VH-BR-22 |
| Màn hình | VH-MH-01 |
| Phụ thuộc | VH-AUT-01, VH-AUT-03, VH-INT-01, VH-ADM-05; thiết kế SSO câu Q5. |

**Tiêu chí nghiệm thu:**
1. Đăng nhập rồi để yên mọi app 12 giờ 5 phút: mở VC Home phải chọn tài khoản Google lại.
2. Dùng VC Home đều đặn (ít nhất 1 thao tác mỗi giờ): tới mốc 7 ngày từ lần đăng nhập Google vẫn phải đăng nhập lại. Thử trên staging với thời hạn rút ngắn theo cùng tỉ lệ.
3. Để tab VC Home mở và hiện nhưng không thao tác quá thời hạn không dùng (staging, thời hạn rút ngắn): phiên chung vẫn hết hạn như mục 1.
4. Mọi phiên riêng của VCwiki và VClinks trong cơ sở dữ liệu có hạn ≤ thời điểm tạo + 7 ngày.
5. Sau khi phải đăng nhập lại, người dùng về đúng trang đang xem.

### VH-AUT-06 — Khoá tài khoản khẩn cấp

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | Quản trị hệ thống (làm); HC-NS, quản lý trực tiếp, kiểm soát, chủ app (được báo) |
| Mô tả | Khi nghi lộ tài khoản, nghỉ việc gấp hoặc có lệnh của lãnh đạo, quản trị hệ thống khoá tài khoản trên VC ID; mọi app mất phiên trong ≤ 1 phút. Khoá không gỡ quyền và không đổi hồ sơ, để mở lại được nguyên trạng nếu khoá nhầm. Gỡ quyền khi nghỉ việc là việc của VH-LCM-03. |
| Điều kiện trước | Người làm thuộc nhóm `vc-id-admin` (GĐ A) hoặc có vai trò `vchome:qtht` (từ GĐ B). Người bị khoá có user trên realm `vc`. |
| Xử lý chính | 1. GĐ A: chạy `vc-provisioner disable <email> --reason "…"`, hoặc dùng màn quản trị Keycloak ở `id-admin.vcprosperous.com` (chỉ mở trong mạng công ty).<br>2. Từ GĐ B: VH-MH-11 → mở hồ sơ → ngăn "Tài khoản" (chỉ hiện với quản trị hệ thống) → nút "Khoá tài khoản". Từ GĐ C có thêm nút này trên VH-MH-17.<br>3. Hộp khoá: chọn lý do (Nghi lộ tài khoản / Nghỉ việc gấp / Yêu cầu của quản lý / Khác) và mô tả bắt buộc, ít nhất 10 ký tự. Hộp hiện họ tên, mã nhân viên, đơn vị để tránh khoá nhầm người. Nút "Khoá ngay".<br>4. Hệ thống tắt user trên VC ID, đăng xuất mọi phiên của user (VC ID gửi back-channel tới mọi app), thêm cờ khoá `khan_cap` vào `accounts` kèm lý do, người khoá, thời điểm.<br>5. Ghi nhật ký `account.locked`. Báo nhóm `vc-id-admin`, HC-NS phụ trách pháp nhân của người đó, quản lý trực tiếp và kiểm soát. GĐ A báo qua Telegram hoặc email nhóm vận hành; từ GĐ D thêm thông báo trong VC Home (VH-HOM-08).<br>6. Sau khi khoá, hiện danh sách việc tay cho quản trị hệ thống: (a) nếu nghi lộ, báo admin Google đổi mật khẩu và đăng xuất Google; (b) thu hồi token máy của người đó trong app (`vcz_` ở VClinks, `vcmcp_` ở VCwiki), vì token máy không đi qua VC ID; (c) nếu người đó là admin app, tắt đường đăng nhập khẩn cấp của họ (VH-AUT-09).<br>7. Mở khoá: nút "Mở khoá" (hoặc `vc-provisioner enable <email>`), lý do bắt buộc. Chỉ gỡ cờ `khan_cap`. Tài khoản còn cờ khác (`google`, `nghi_viec`, `tam_khoa`, `nghi_dai_ngay`) thì vẫn khoá.<br>8. Một tài khoản có thể mang nhiều cờ khoá cùng lúc; tài khoản chỉ mở khi hết mọi cờ. |
| Ngoại lệ, thông báo lỗi | Thiếu lý do: "Nhập lý do khoá (ít nhất 10 ký tự)."<br>Tự khoá chính mình: "Không tự khoá tài khoản của chính bạn. Nhờ một quản trị hệ thống khác."<br>VC ID không trả lời: "Chưa khoá được vì không kết nối được VC ID. Thử lại, hoặc dùng lệnh vc-provisioner trên máy chủ." Không ghi cờ khoá khi chưa khoá thật.<br>Mở khoá khi còn cờ khác: "Đã gỡ khoá khẩn cấp. Tài khoản vẫn bị khoá vì: {lý do còn lại}."<br>Người bị khoá đăng nhập lại: "Tài khoản đã bị khoá. Liên hệ quản trị viên." |
| Dữ liệu | User VC ID (bật/tắt); `accounts` (danh sách cờ khoá: loại, lý do, người, lúc); `audit_log`; `notifications` (GĐ D). |
| Quy tắc | VH-BR-14 (khoá gấp trước ngày nghỉ), VH-BR-17, VH-BR-18 (lý do bắt buộc khi khoá), VH-BR-22 |
| Màn hình | VH-MH-11 (ngăn Tài khoản), VH-MH-17, VH-MH-19, VH-MH-01 |
| Phụ thuộc | VH-INT-04, VH-AUT-04, VH-ADM-01, VH-ADM-03, VH-HOM-08, VH-LCM-03; quy trình VH-QT-02. |

**Tiêu chí nghiệm thu:**
1. Khoá một tài khoản thử đang mở VC Home, VClinks, VCwiki: cả ba mất phiên trong ≤ 1 phút, tính từ lúc bấm "Khoá ngay".
2. Người đó đăng nhập lại ngay: thấy trang khoá đúng câu chữ; không app nào tạo phiên mới.
3. Nhật ký có đúng 1 dòng `account.locked` ghi người khoá, lý do, thời điểm. Người không có vai trò quản trị hệ thống không thấy nút "Khoá tài khoản"; gọi thẳng API khoá thì nhận `403`.
4. Tài khoản mang cả cờ `khan_cap` và cờ `google`: mở khoá khẩn cấp xong vẫn bị khoá, câu thông báo nêu lý do còn lại.
5. Mở khoá xong (không còn cờ nào): người dùng đăng nhập lại được; quyền app giống hệt trước khi khoá.

### VH-AUT-07 — Đồng bộ trạng thái tài khoản Google (bị khoá, bị xoá → khoá)

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | Job `vc-provisioner`; admin Google Workspace; quản trị hệ thống |
| Mô tả | Nghỉ việc thường bắt đầu bằng việc admin Google khoá tài khoản. Job `vc-provisioner` mỗi giờ đọc trạng thái tài khoản ở từng Workspace; tài khoản bị khoá, lưu trữ hoặc xoá trên Google thì bị khoá trên VC ID và mất phiên ở mọi app trong ≤ 65 phút. Chiều ngược lại không tự làm: Google mở lại thì VC ID vẫn khoá cho tới khi người quyết. |
| Điều kiện trước | Tài khoản dịch vụ Google có uỷ quyền toàn miền, phạm vi `admin.directory.user.readonly`, cho từng Workspace (I4). Client `vc-provisioner` có quyền `view-users`, `manage-users`, `query-groups`, `view-events`. |
| Xử lý chính | 1. Chạy mỗi giờ. Với mỗi Workspace, đọc toàn bộ user qua Directory API, gồm cả user `suspended` và `archived`.<br>2. Kiểm an toàn trước khi làm gì: Google trả lỗi, hoặc số user ít hơn 50% lần chạy trước, thì dừng, không khoá ai, báo nhóm `vc-id-admin`.<br>3. So với user realm `vc` theo email:<br>• Google `suspended`, `archived` hoặc không còn: khoá trên VC ID, đăng xuất mọi phiên (back-channel tới mọi app), thêm cờ khoá `google`, báo nhóm.<br>• VC ID đang khoá vì cờ `google` mà Google đã hoạt động lại: không tự mở; báo quản trị hệ thống quyết.<br>• Có trên Google, chưa có trên VC ID: bỏ qua (user tự được tạo ở lần đăng nhập đầu).<br>4. Tuần đầu chạy ở chế độ thử `--dry-run`: chỉ báo danh sách sẽ khoá, không khoá.<br>5. Lệnh `vc-provisioner report` in danh sách lệch. Từ GĐ B, kết quả đẩy vào VH-MH-14 để HC-NS và quản trị hệ thống đối chiếu (VH-IMP-02).<br>6. Mỗi lần chạy ghi: thời điểm, số user đọc được ở từng Workspace, số tài khoản bị khoá, lỗi.<br>7. Thời gian tối đa: chờ tới lượt chạy ≤ 60 phút cộng thời gian chạy ≤ 5 phút, tổng ≤ 65 phút. |
| Ngoại lệ, thông báo lỗi | Báo khi khoá: "[VC ID] Đã khoá {email}: tài khoản Google bị {khoá/xoá} lúc {hh:mm dd/mm}."<br>Báo khi dừng: "[VC ID] Dừng đồng bộ: Google trả về {n} tài khoản, ít hơn 50% lần trước ({m}). Không khoá ai."<br>Báo khi Google mở lại: "[VC ID] {email} đã hoạt động lại trên Google nhưng vẫn khoá trên VC ID. Cần quản trị hệ thống quyết định mở."<br>Directory API hết hạn mức hoặc lỗi mạng: thử lại 3 lần, cách nhau 1 phút, rồi báo.<br>Job không chạy quá 2 giờ: cảnh báo vận hành (VH-ADM-04). |
| Dữ liệu | User VC ID; `accounts` (cờ khoá `google`, từ GĐ B); log của job; `audit_log` (`account.locked`, nguồn "Đồng bộ Google"). |
| Quy tắc | VH-BR-02, VH-BR-14, VH-BR-18, VH-BR-22 |
| Màn hình | VH-MH-14, VH-MH-19 |
| Phụ thuộc | Đầu vào I4, I6; VH-AUT-06 (cùng cơ chế khoá); VH-IMP-02; VH-ADM-04; VH-LCM-03. |

**Tiêu chí nghiệm thu:**
1. Khoá một tài khoản thử trên Google Admin: trong ≤ 65 phút mọi app mất phiên và đăng nhập lại bị chặn; nhóm `vc-id-admin` nhận thông báo đúng mẫu.
2. Xoá một tài khoản thử trên Google: kết quả như mục 1.
3. Mở lại tài khoản trên Google: sau 2 lần chạy, VC ID vẫn khoá; quản trị hệ thống nhận báo "cần quyết định mở".
4. Giả lập Google trả về danh sách rỗng: job dừng, không khoá ai, có cảnh báo.
5. Chế độ `--dry-run`: báo cáo đúng danh sách sẽ khoá; không user nào bị đổi.
6. Nếu hai domain là hai Workspace riêng (I6): tài khoản bị khoá ở Workspace nào cũng được xử lý.

### VH-AUT-08 — Gắn tài khoản đăng nhập với hồ sơ nhân sự

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | Nhân viên (đăng nhập); VC Home API; quản trị hệ thống (gắn lại tay); HC-NS (sửa dữ liệu khi có xung đột) |
| Mô tả | Từ GĐ B, mỗi tài khoản VC ID (`sub`) gắn với đúng một hồ sơ trên VC People, và ngược lại. Lần đầu gắn tự động theo email; gắn rồi thì không tự đổi, kể cả khi email đổi. Nhờ gắn, token mang thông tin hồ sơ và VC Home biết người đăng nhập là nhân viên nào. |
| Điều kiện trước | Hồ sơ đã có trên VC People (VH-NSU-01, VH-IMP-01), có email công ty hoặc email phụ. VC Home API có quyền ghi thuộc tính user trên VC ID. |
| Xử lý chính | 1. Gắn lần đầu khi chuyển sang GĐ B: job chạy một lần, duyệt mọi user đã có trên realm `vc` và gắn theo email như bước 3. Kết quả hiện ở VH-MH-14.<br>2. Mỗi lần đăng nhập: VC Home API nhận token, tìm trong `accounts` theo `sub`. Có thì đã gắn: cập nhật lần đăng nhập cuối và so email.<br>3. Chưa có: tìm hồ sơ theo email công ty, rồi theo email phụ, không phân biệt hoa thường. Gắn khi có đúng 1 hồ sơ khớp, hồ sơ đó chưa gắn tài khoản nào, và hồ sơ không ở trạng thái "Đã nghỉ". Tạo bản ghi `accounts` (nhân viên, `sub`, email lúc gắn, lúc gắn, người gắn = "Hệ thống"); ghi nhật ký `account.linked`.<br>4. Sau khi gắn, VC Home API ghi thông tin hồ sơ vào user VC ID để token có thêm claim GĐ B: `employee_code`, `title`, `unit{code,name}`, `division`, `legal_entity` (lấy theo vị trí chính). Hồ sơ đổi thì thuộc tính được cập nhật trong ≤ 5 phút; app thấy ở lần cấp token kế tiếp.<br>5. Một hồ sơ chỉ gắn 1 `sub`; một `sub` chỉ gắn 1 hồ sơ.<br>6. Đổi email (ví dụ chuyển từ `@vcpart.vn` sang `@vcprosperous.com`): HC-NS sửa email trên hồ sơ trước. Lần đăng nhập sau tìm theo `sub` nên vẫn đúng người. Email trên Google khác email trên hồ sơ thì gắn cờ "Email lệch" ở VH-MH-14.<br>7. Gỡ gắn hoặc gắn lại: chỉ quản trị hệ thống, trên ngăn "Tài khoản" của VH-MH-11, lý do bắt buộc. Ghi nhật ký trước/sau, báo người được gắn lại. HC-NS không gắn tài khoản. |
| Ngoại lệ, thông báo lỗi | Không có hồ sơ khớp: trang chủ trống với dòng "Tài khoản chưa có hồ sơ nhân sự, liên hệ HC-NS". Tài khoản vào danh sách "Chưa có hồ sơ" ở VH-MH-14.<br>Nhiều hồ sơ khớp (ví dụ email chính của hồ sơ này là email phụ của hồ sơ kia): không gắn. "Tài khoản của bạn khớp với nhiều hồ sơ nhân sự. HC-NS đã được báo để sửa." HC-NS thấy cảnh báo trên VH-MH-14.<br>Hồ sơ đã gắn với `sub` khác (ví dụ tài khoản Google bị xoá rồi tạo lại cùng email): không gắn, câu `identity_conflict`, báo quản trị hệ thống.<br>Hồ sơ ở trạng thái "Đã nghỉ": không gắn. "Hồ sơ nhân sự của bạn đang ở trạng thái đã nghỉ việc. Liên hệ HC-NS nếu có nhầm lẫn." Báo quản trị hệ thống vì tài khoản lẽ ra đã bị khoá.<br>Hồ sơ "Chưa vào làm": vẫn gắn; trang chủ hiện "Hồ sơ của bạn có hiệu lực từ {dd/mm/yyyy}." và chưa có app.<br>Hồ sơ "Tạm khoá": vẫn gắn, nhưng đăng nhập bị chặn bởi cờ khoá `tam_khoa` (VH-NSU-04). |
| Dữ liệu | `accounts` (nhân viên, `sub`, email, lúc gắn, người gắn, lần đăng nhập cuối, cờ khoá); `people` (email công ty, email phụ, trạng thái); thuộc tính user trên VC ID; `audit_log`. |
| Quy tắc | VH-BR-01, VH-BR-02, VH-BR-03, VH-BR-17, VH-BR-18, VH-BR-19 |
| Màn hình | VH-MH-02, VH-MH-11, VH-MH-14 |
| Phụ thuộc | VH-NSU-01, VH-NSU-04, VH-IMP-01, VH-IMP-02, VH-INT-01; câu hỏi Q-07 (tài khoản chưa có hồ sơ trong giai đoạn chuyển tiếp). |

**Tiêu chí nghiệm thu:**
1. Lô thử 50 hồ sơ có email trùng 50 user đã có trên VC ID: job gắn đúng 50/50; VH-MH-14 ghi 50 dòng "Đã gắn".
2. Người có email phụ khớp (email chính khác): lần đăng nhập đầu gắn đúng hồ sơ.
3. HC-NS đổi email hồ sơ từ `@vcpart.vn` sang `@vcprosperous.com`, admin Google đổi tương ứng: lần đăng nhập sau vẫn đúng hồ sơ, không tạo bản ghi `accounts` mới.
4. Bốn ca xung đột (không có hồ sơ, nhiều hồ sơ, đã gắn `sub` khác, đã nghỉ): mỗi ca hiện đúng câu chữ, không tạo liên kết, người cần được báo nhận thông báo.
5. Sau khi gắn, token cấp ở lần kế tiếp có đủ 5 claim GĐ B, giá trị khớp hồ sơ.
6. Tài khoản HC-NS gọi API gắn lại: `403`. Quản trị hệ thống gắn lại có lý do: nhật ký ghi đủ giá trị trước và sau.

### VH-AUT-09 — Đường đăng nhập khẩn cấp khi VC ID hoặc Google không dùng được

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · A |
| Tác nhân | Quản trị hệ thống; chủ dự án; admin của từng app; hai người giữ tài khoản khẩn cấp realm `master` (I5) |
| Mô tả | VC ID là điểm hỏng đơn: khi nó hoặc Google hỏng thì không ai đăng nhập mới được. Phiên riêng đang có ở app vẫn chạy tiếp, và một số ít admin có đường vào riêng để xử lý sự cố. Mọi đường khẩn cấp có danh sách người dùng đặt trước, bật có lý do, có nhật ký, tắt ngay khi hết sự cố. Bảng đường khẩn cấp ở dưới. |
| Điều kiện trước | Đã có I5 (hai tài khoản khẩn cấp có TOTP, cất ngoài máy). Mỗi app có danh sách admin khẩn cấp, tối đa 3 người. Có bản sao lưu PostgreSQL của VC ID hằng đêm. |
| Xử lý chính | 1. Phát hiện: cảnh báo vận hành (VH-ADM-04) khi kiểm sức khoẻ VC ID lỗi 2 lần liên tiếp, hoặc tỉ lệ đăng nhập lỗi > 20% trong 15 phút.<br>2. Quản trị hệ thống xác định loại sự cố theo bảng dưới, báo chủ dự án và nhóm vận hành, ghi giờ bắt đầu vào sổ sự cố.<br>3. Người dùng đang có phiên ở app làm việc tiếp (VClinks tối đa 12 giờ không dùng, mọi app tối đa 7 ngày). Đăng nhập mới hiện câu `idp_unreachable`.<br>4. Chỉ bật đường khẩn cấp khi có người phải vào ngay (admin xử lý sự cố, việc gấp của khách). Ai bật, lúc nào, lý do, ai đã dùng đều ghi vào sổ sự cố và nhật ký của app.<br>5. Đường khẩn cấp vẫn chỉ nhận email thuộc hai domain công ty.<br>6. VC ID hoạt động lại: tắt mọi đường khẩn cấp trong ≤ 1 giờ, kiểm lại cấu hình, ghi giờ kết thúc. Bật quá 24 giờ thì chủ dự án phải xác nhận tiếp.<br>7. Diễn tập mỗi quý trên staging: tắt Keycloak, bật đường khẩn cấp, khôi phục từ bản sao lưu, rồi tắt. |
| Ngoại lệ, thông báo lỗi | Trang đăng nhập app khi VC ID không trả lời: câu `idp_unreachable`.<br>VCwiki chế độ mật khẩu `admin`: form mật khẩu ghi "Chỉ dành cho quản trị khi khẩn cấp". Người không phải admin nhập đúng mật khẩu: "Đăng nhập bằng mật khẩu chỉ dành cho quản trị khi khẩn cấp. Hãy dùng nút Đăng nhập bằng tài khoản công ty."<br>VClinks `AUTH_TOKEN_LOGIN` bật: chỉ nhận token nội bộ gắn với một người dùng có tên trong danh sách admin khẩn cấp; token không gắn người dùng bị từ chối (giữ `AUTHZ_LEGACY_TOKENS` tắt). Sai token: "Token không hợp lệ hoặc không được dùng để đăng nhập khẩn cấp." |
| Dữ liệu | Biến môi trường của app (`AUTH_TOKEN_LOGIN` ở VClinks; `AUTH_PASSWORD_LOGIN` ở VCwiki; `AUTH_PROVIDER` ở VClinks tới phiên SSO-12); tài khoản realm `master`; bản sao lưu PostgreSQL; sổ sự cố trong `vc-platform/docs/van-hanh.md`; nhật ký của app. |
| Quy tắc | VH-BR-02, VH-BR-14, VH-BR-18 |
| Màn hình | VH-MH-01; trang đăng nhập của từng app (ngoài VC Home) |
| Phụ thuộc | Đầu vào I5; VH-ADM-04; VH-AUT-06; thiết kế SSO mục 5.7, 10, 11. |

**Bảng đường khẩn cấp:**

| Sự cố | Ảnh hưởng | Đường khẩn cấp | Ai bật | Mặc định ở production |
|---|---|---|---|---|
| VC ID ngừng (Keycloak, PostgreSQL hoặc đường hầm Cloudflare hỏng) | Không đăng nhập mới được; phiên riêng đang có vẫn chạy | VClinks: `AUTH_TOKEN_LOGIN` (dán token nội bộ gắn với một admin trong danh sách). VCwiki: `AUTH_PASSWORD_LOGIN=admin` | Quản trị hệ thống, báo chủ dự án | VClinks tắt (đặt rõ `AUTH_TOKEN_LOGIN=0`, vì code hiện coi biến trống là bật). VCwiki ở chế độ `admin` sau SSO-12 (theo thiết kế SSO) |
| Google không trả lời hoặc OAuth client Google hỏng | VC ID chạy nhưng không ai qua được bước Google; realm `vc` không có mật khẩu | Như dòng trên. Người giữ tài khoản realm `master` vào `id-admin.vcprosperous.com` để sửa cấu hình (không dùng để vào app) | Quản trị hệ thống | Tắt |
| Cấu hình VC ID sai sau khi áp | Đăng nhập lỗi hàng loạt | Áp lại bản `vc.yaml` trước đó bằng `keycloak-config-cli` | Quản trị hệ thống | — |
| Dữ liệu VC ID hỏng nặng | Mất user, phiên | Khôi phục PostgreSQL từ bản sao lưu đêm trước; trong lúc chờ dùng dòng đầu | Quản trị hệ thống | — |
| Cần quay về cách đăng nhập cũ | — | VClinks `AUTH_PROVIDER=google` (giữ tới phiên SSO-12); VCwiki `AUTH_PASSWORD_LOGIN=on` | Chủ dự án quyết | Tắt |

**Tiêu chí nghiệm thu:**
1. Tắt Keycloak trên staging: phiên đang có ở VClinks và VCwiki dùng tiếp được ít nhất 1 giờ; đăng nhập mới hiện đúng câu `idp_unreachable`.
2. Bật `AUTH_TOKEN_LOGIN` ở VClinks staging: admin trong danh sách dán token của mình đăng nhập được; token không gắn người dùng bị từ chối; mỗi lần dùng có 1 dòng nhật ký. Ở production, biến để trống hoặc bằng `0` thì form token không hiện (phải đổi mặc định trong code VClinks).
3. VCwiki ở `AUTH_PASSWORD_LOGIN=admin`: người dùng thường không đăng nhập bằng mật khẩu được; admin đăng nhập được.
4. Người giữ tài khoản realm `master` đăng nhập `id-admin` bằng mật khẩu và TOTP được; từ ngoài mạng công ty không mở được màn quản trị.
5. Khôi phục PostgreSQL của VC ID từ bản sao lưu đêm trước lên staging xong trong ≤ 2 giờ, đăng nhập lại được.
6. Sau diễn tập, mọi cờ khẩn cấp ở production về đúng mặc định trong bảng (kiểm bằng `GET /auth/config` của từng app).

### VH-AUT-10 — Xem và đăng xuất các phiên của chính mình

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | C · D |
| Tác nhân | Nhân viên |
| Mô tả | Nhân viên xem mình đang đăng nhập ở những trình duyệt, máy nào và đăng xuất từ xa phiên không cần, ví dụ quên đăng xuất trên máy ở cửa hàng. Mỗi phiên là một phiên chung của VC ID; đăng xuất phiên đó làm mọi app trên thiết bị đó mất phiên. |
| Điều kiện trước | Người dùng đã đăng nhập và đã gắn hồ sơ. VC Home API được VC ID cho phép xem và xoá phiên, chỉ theo `sub` của chính người gọi. |
| Xử lý chính | 1. VH-MH-03 → ngăn "Phiên đăng nhập": danh sách phiên chung của chính mình, tối đa 20 phiên, mới nhất trước.<br>2. Mỗi dòng: trình duyệt và hệ điều hành (nếu VC ID có), IP rút gọn (ví dụ `113.161.25.x`), lúc bắt đầu, lần dùng cuối, các app đã mở trong phiên. Phiên đang dùng có nhãn "Phiên này".<br>3. Nút "Đăng xuất" trên từng phiên khác, và nút "Đăng xuất mọi phiên khác". Phiên này dùng nút "Đăng xuất" thường (VH-AUT-04).<br>4. Hộp xác nhận: "Đăng xuất phiên này? Các app đang mở trên thiết bị đó sẽ phải đăng nhập lại."<br>5. VC Home API gọi VC ID xoá phiên theo `sid`; VC ID gửi back-channel tới mọi app có phiên đó.<br>6. Ghi nhật ký `session.revoked_by_user`.<br>7. Dưới danh sách có dòng: "Không nhận ra một phiên? Đăng xuất phiên đó và báo IT." |
| Ngoại lệ, thông báo lỗi | VC ID không trả lời: "Chưa tải được danh sách phiên. Thử lại sau."<br>Phiên đã kết thúc trước khi bấm: "Phiên này đã kết thúc." và danh sách tự làm mới. |
| Dữ liệu | Phiên VC ID (đọc qua VC Home API); `audit_log`. |
| Quy tắc | VH-BR-18, VH-BR-19 (IP rút gọn), VH-BR-22 |
| Màn hình | VH-MH-03 |
| Phụ thuộc | VH-AUT-04, VH-INT-04, VH-NSU-06. |

**Tiêu chí nghiệm thu:**
1. Đăng nhập trên 3 trình duyệt: ngăn hiện đủ 3 dòng, đúng 1 dòng có nhãn "Phiên này".
2. Bấm "Đăng xuất mọi phiên khác": 2 trình duyệt kia mất phiên ở mọi app trong ≤ 10 giây; phiên hiện tại vẫn dùng bình thường.
3. Gọi API xem hoặc xoá phiên với `sub` của người khác: `403`.
4. Không dòng nào hiện IP đầy đủ.

## 2. HOM — Trang chủ và chuyển app

Trang chủ là nơi nhân viên mở mỗi sáng: thấy mình là ai, được dùng app nào, việc gì đang chờ. Thanh chuyển app nằm trong từng app để đi qua lại không cần về trang chủ. Ở GĐ A, ô app hiện theo nhóm `app-<khoá app>` trong token; từ GĐ C, theo quyền (app, vai trò) do VC Home cấp.

### VH-HOM-01 — Lưới app theo quyền

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | Nhân viên |
| Mô tả | Trang chủ hiện các ô app mà người dùng được dùng, bấm ô là vào thẳng app. Người không có quyền vào app thì không thấy ô của app đó. Mục đích: một chỗ duy nhất để mở mọi app, không phải nhớ địa chỉ từng app. |
| Điều kiện trước | Đã đăng nhập (VH-AUT-01). Danh mục app (`catalog.json`) tải được. |
| Xử lý chính | 1. Sau khi đăng nhập, VC Home đọc `catalog.json` và quyền của người dùng.<br>2. GĐ A, B: ô app hiện khi claim `groups` có nhóm của app (`app-<khoá app>`) và app ở trạng thái `live` hoặc `beta`.<br>3. Từ GĐ C: ô hiện khi người dùng có ít nhất một quyền còn hiệu lực trong app (VH-BR-21). VC Home đọc quyền từ VC Home API. Nhóm `app-<khoá app>` trên VC ID do VC Home đẩy theo quyền (VH-ACC-07), nên hai nguồn luôn khớp.<br>4. Mỗi ô có biểu tượng, tên app, mô tả một dòng. App `beta` có nhãn "Thử nghiệm". Từ GĐ C có thêm vai trò (VH-HOM-03).<br>5. Thứ tự: ô đã ghim đứng trước (theo thứ tự ghim), sau đó theo thứ tự quản trị đặt. Ô "Sắp có" và liên kết ngoài nằm ở phần riêng bên dưới (VH-HOM-06).<br>6. Ghim: menu "⋯" trên ô → "Ghim lên đầu" hoặc "Bỏ ghim". Lưu trên trình duyệt (`localStorage`, khoá `vchome.pinned`, tách theo `sub`). Xoá dữ liệu trình duyệt thì về thứ tự mặc định.<br>7. Bấm ô: mở app trong cùng tab. Ctrl/Cmd + bấm hoặc bấm chuột giữa: mở tab mới.<br>8. Không hiện ô của: VC Home (khoá `vchome`), app `retired`, app người dùng không có quyền.<br>9. Bố cục: 4 cột khi màn ≥ 1200 px, 3 cột ≥ 900 px, 2 cột ≥ 600 px, 1 cột dưới 600 px. Vùng bấm của ô ≥ 44 × 44 px.<br>10. Từ GĐ B, tài khoản chưa gắn hồ sơ: lưới trống, hiện dòng "Tài khoản chưa có hồ sơ nhân sự, liên hệ HC-NS" (VH-BR-02).<br>11. Mục quản trị (Nhân sự, Cơ cấu, App, Luật…) không nằm trong lưới; hiện ở menu theo vai trò của người dùng trong VC Home. |
| Ngoại lệ, thông báo lỗi | Không có app nào: "Bạn chưa được cấp ứng dụng nào. Liên hệ quản trị viên." Từ GĐ D thêm nút "Xin quyền" (mở VH-MH-05).<br>Tải `catalog.json` lỗi nhưng còn bản lần trước trên trình duyệt: dùng bản cũ, hiện dòng nhỏ "Danh sách ứng dụng có thể chưa mới nhất."<br>Tải lỗi và không có bản cũ: "Chưa tải được danh sách ứng dụng." · nút "Thử lại". |
| Dữ liệu | `catalog.json` (GĐ A), `apps` (từ GĐ B); claim `groups` (GĐ A, B); `access_grants` (từ GĐ C); `localStorage` khoá `vchome.pinned`. |
| Quy tắc | VH-BR-08, VH-BR-20, VH-BR-21 |
| Màn hình | VH-MH-02 |
| Phụ thuộc | VH-APP-01, VH-AUT-01, VH-ACC-07 (GĐ C), VH-INT-01, VH-API-08. |

**Tiêu chí nghiệm thu:**
1. GĐ A: người thuộc `app-vclinks` và `app-vcwiki` thấy đúng 2 ô. Bỏ người đó khỏi `app-vcwiki`: lần đăng nhập sau còn 1 ô.
2. GĐ C: quản trị gỡ quyền VClinks duy nhất của một người: lần tải trang sau (≤ 5 phút) ô VClinks không còn.
3. Ghim VCwiki: VCwiki lên đầu và giữ nguyên sau khi tải lại. Xoá dữ liệu trình duyệt: về thứ tự quản trị đặt.
4. Màn rộng 375 px: lưới 1 cột, không có thanh cuộn ngang.
5. Lưới hiện trong ≤ 2 giây sau khi có token (p95, mạng văn phòng).
6. Người không có quyền app nào thấy đúng câu trạng thái rỗng.

### VH-HOM-02 — Thẻ hồ sơ ngắn trên trang chủ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | Nhân viên |
| Mô tả | Đầu trang chủ có một thẻ tóm tắt người đang đăng nhập: là ai, làm gì, ở đâu, báo cáo ai. Nhân viên thấy ngay thông tin sai để đề nghị sửa (VH-NSU-06). Dữ liệu lấy từ VC People, không lấy từ Google. |
| Điều kiện trước | Tài khoản đã gắn hồ sơ (VH-AUT-08). |
| Xử lý chính | 1. VC Home gọi VC Home API lấy hồ sơ của chính mình (dữ liệu mới nhất, không lấy từ token vì token có thể chậm tới 5 phút).<br>2. Thẻ hiện: ảnh; tên gọi và họ tên; chức danh · đơn vị của vị trí chính; mã nhân viên; email công ty (nút sao chép); pháp nhân; quản lý trực tiếp (tên, bấm mở ngăn danh bạ của người đó).<br>3. Có kiêm nhiệm: nhãn "+{n} kiêm nhiệm"; bấm thì hiện danh sách "chức danh · đơn vị".<br>4. Trạng thái đặc biệt: "Đang nghỉ dài ngày đến {dd/mm/yyyy}"; "Hồ sơ có hiệu lực từ {dd/mm/yyyy}" (chưa vào làm).<br>5. Liên kết "Xem hồ sơ của tôi" mở VH-MH-03.<br>6. Không có ảnh: hiện chữ cái đầu của tên trên nền màu cố định theo mã nhân viên.<br>7. Lời chào theo giờ: "Chào buổi sáng, {tên gọi}" (trước 12:00), "Chào buổi chiều, {tên gọi}" (12:00–17:59), "Chào buổi tối, {tên gọi}". |
| Ngoại lệ, thông báo lỗi | VC Home API lỗi: thẻ hiện bản rút gọn từ token (tên, email, ảnh) và dòng "Chưa tải được hồ sơ." · nút "Thử lại". Lưới app không bị ảnh hưởng.<br>Tài khoản chưa gắn hồ sơ: không có thẻ; hiện dòng "Tài khoản chưa có hồ sơ nhân sự, liên hệ HC-NS". |
| Dữ liệu | `people`, `positions`, `org_units`, `job_titles`, `legal_entities`, `accounts` (chỉ đọc). |
| Quy tắc | VH-BR-03, VH-BR-04, VH-BR-19 |
| Màn hình | VH-MH-02 |
| Phụ thuộc | VH-NSU-01, VH-NSU-02, VH-NSU-03, VH-AUT-08. |

**Tiêu chí nghiệm thu:**
1. Thẻ hiện đủ 7 thông tin ở bước 2, khớp hồ sơ trên VH-MH-11.
2. HC-NS đổi chức danh có hiệu lực hôm nay: tải lại trang chủ sau ≤ 1 phút thấy chức danh mới.
3. Người có 2 kiêm nhiệm: nhãn "+2 kiêm nhiệm"; bấm hiện đúng 2 dòng.
4. Tắt VC Home API: lưới app vẫn hiện; thẻ hiện bản rút gọn và nút "Thử lại".
5. Hồ sơ không có ảnh: hiện chữ cái đầu; cùng một người luôn cùng màu nền.

### VH-HOM-03 — Hiện vai trò trên ô app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · C |
| Tác nhân | Nhân viên |
| Mô tả | Mỗi ô app ghi người dùng đang có vai trò gì trong app đó, và quyền nào sắp mất. Nhân viên biết mình được làm gì mà không phải mở app, và biết trước khi quyền hết để kịp xin lại. |
| Điều kiện trước | GĐ C đã chạy: app đã khai vai trò (VH-APP-02), quyền đã tính (VH-ACC-01). |
| Xử lý chính | 1. Dưới tên app hiện tên vai trò. Vai trò theo đơn vị ghi kèm tên ngắn của đơn vị, ví dụ "NVKD · Tổ BH 1".<br>2. Nhiều vai trò: hiện 2 vai trò đầu và "+{n}"; di chuột hoặc chạm giữ thì hiện đủ.<br>3. Quyền đang trong thời gian chuyển tiếp (VH-BR-11): nhãn cam "Còn {N} ngày".<br>4. Quyền ngoại lệ còn ≤ 14 ngày (từ GĐ D): nhãn "Hết hạn {dd/mm}".<br>5. Quyền khẩn cấp: nhãn "Khẩn cấp".<br>6. Phần hiện đủ ghi nguồn của từng vai trò: "Luật", "Được duyệt", "Khẩn cấp".<br>7. Dữ liệu lấy từ VC Home API (quyền của tôi), không lấy từ token. |
| Ngoại lệ, thông báo lỗi | Không tải được quyền: ô vẫn hiện (theo `groups`), không ghi vai trò, không báo lỗi trên ô. |
| Dữ liệu | `access_grants`, `app_roles`, `apps`, `org_units` (chỉ đọc). |
| Quy tắc | VH-BR-08, VH-BR-09, VH-BR-11, VH-BR-24 |
| Màn hình | VH-MH-02, VH-MH-04 |
| Phụ thuộc | VH-APP-02, VH-APP-06, VH-ACC-01, VH-ACC-05 (GĐ D). |

**Tiêu chí nghiệm thu:**
1. Người là NVKD ở tổ A kiêm CSKH ở nhóm B: ô VClinks hiện 2 dòng vai trò với đúng tên ngắn của hai đơn vị.
2. Chuyển vị trí, VClinks đặt chuyển tiếp 3 ngày: ngày hiệu lực ô hiện "Còn 3 ngày"; ngày thứ 3 hiện "Còn 1 ngày"; ngày thứ 4 vai trò cũ không còn.
3. Quyền ngoại lệ hết hạn sau 10 ngày: ô hiện "Hết hạn {ngày}".
4. Người có 4 vai trò trong một app: ô hiện 2 vai trò và "+2"; phần hiện đủ có cả 4 kèm nguồn.

### VH-HOM-04 — Ô "Có thể xin quyền"

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Nhân viên |
| Mô tả | Dưới lưới app có phần "Có thể xin quyền": các app đang chạy mà người dùng chưa có quyền. Nhân viên biết công ty có app gì và xin quyền ngay tại chỗ, không phải hỏi IT. |
| Điều kiện trước | Tài khoản đã gắn hồ sơ, trạng thái Đang làm hoặc Nghỉ dài ngày. Luồng xin quyền đã chạy (VH-REQ-01). |
| Xử lý chính | 1. Phần này liệt kê app `live` hoặc `beta`, có ít nhất một vai trò đang dùng, và người dùng chưa có quyền nào còn hiệu lực trong app đó.<br>2. Ô mờ nhẹ, có biểu tượng, tên, mô tả và nút "Xin quyền".<br>3. Bấm "Xin quyền": mở ngăn VH-MH-05 với app đã chọn sẵn.<br>4. App đang có yêu cầu chờ duyệt: ô hiện nhãn "Đang chờ duyệt" và liên kết xem yêu cầu; không mở form mới.<br>5. Người dùng thu gọn được phần này; lựa chọn nhớ trên trình duyệt.<br>6. Không hiện cho tài khoản chưa gắn hồ sơ (chưa có quản lý để duyệt). |
| Ngoại lệ, thông báo lỗi | Không có app nào để xin: phần này ẩn hẳn.<br>Bấm "Xin quyền" khi đã có yêu cầu đang chờ: "Bạn đã có yêu cầu đang chờ duyệt cho {tên app}." |
| Dữ liệu | `apps`, `app_roles`, `access_grants`, `access_requests` (chỉ đọc). |
| Quy tắc | VH-BR-08, VH-BR-12, VH-BR-21 |
| Màn hình | VH-MH-02, VH-MH-05 |
| Phụ thuộc | VH-REQ-01, VH-APP-01, VH-APP-02. |

**Tiêu chí nghiệm thu:**
1. Người có quyền VClinks, chưa có quyền VCwiki: VCwiki nằm ở "Có thể xin quyền", không nằm trong lưới chính.
2. Bấm "Xin quyền" ở ô VCwiki: ngăn gửi yêu cầu mở với app VCwiki đã chọn sẵn.
3. Gửi yêu cầu xong: ô hiện "Đang chờ duyệt"; bấm lại không mở form mới.
4. App `coming_soon`, `paused`, `retired` và liên kết ngoài không bao giờ nằm trong phần này.

### VH-HOM-05 — Thanh chuyển app trong từng app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · A |
| Tác nhân | Nhân viên; đội của từng app |
| Mô tả | Mỗi app có nút 9 chấm ở thanh đầu trang. Bấm vào thấy VC Home và các app mình được dùng, chuyển sang app khác không phải đăng nhập lại. Thanh này là thành phần dùng chung; mọi app phải gắn khi được đưa vào VC Home. |
| Điều kiện trước | App đã đạt hợp đồng tích hợp (VH-APP-04). `catalog.json` công khai tại VC Home (VH-API-08). |
| Xử lý chính | 1. Máy chủ của app có `GET /api/platform/apps`: tải `catalog.json` của VC Home (cache 5 phút; lỗi thì dùng bản cũ), lọc theo nhóm của người dùng (`idp_groups`, GĐ A, B) hoặc vai trò app (từ GĐ C).<br>2. Bấm nút 9 chấm: mở danh sách. Mục đầu là "VC Home" (về trang chủ). Tiếp theo là các app người dùng được dùng, cùng thứ tự với trang chủ. App đang mở có dấu chọn.<br>3. Không hiện ô "Sắp có" và liên kết ngoài.<br>4. Bấm một app: mở trong cùng tab; nhờ VH-AUT-03 nên không hỏi đăng nhập.<br>5. Bàn phím: Tab tới nút, Enter hoặc Space để mở, phím mũi tên để chọn, Esc để đóng.<br>6. Điện thoại (dưới 600 px): mở thành ngăn kéo toàn màn hình.<br>7. VC Home cung cấp thành phần React (dùng `Dropdown` của antd) để app React dùng lại; app khác công nghệ làm theo hướng dẫn ở tài liệu tích hợp. |
| Ngoại lệ, thông báo lỗi | VC Home không trả `catalog.json` và app chưa có bản cache: danh sách chỉ có mục "VC Home"; app không báo lỗi cho người dùng, chỉ ghi log. |
| Dữ liệu | `catalog.json`; nhóm hoặc vai trò của người dùng phía app. |
| Quy tắc | VH-BR-20, VH-BR-21 |
| Màn hình | VH-MH-21 |
| Phụ thuộc | VH-APP-01, VH-APP-04, VH-API-08, VH-AUT-03. |

**Tiêu chí nghiệm thu:**
1. Trong VClinks bấm nút 9 chấm: thấy "VC Home" và "VCwiki". Bấm VCwiki: vào VCwiki, không hỏi đăng nhập.
2. Quản trị đổi tên một app trong danh mục: thanh chuyển app ở VClinks hiện tên mới trong ≤ 10 phút.
3. Tắt VC Home: thanh chuyển app vẫn hiện danh sách lần trước; trang của app không lỗi.
4. Người không có nhóm `app-vcwiki` không thấy VCwiki trong thanh chuyển app.
5. Dùng được hoàn toàn bằng bàn phím theo bước 5.

### VH-HOM-06 — Ô app "Sắp có" và ô liên kết ngoài

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | C · A |
| Tác nhân | Nhân viên; quản trị hệ thống (khai) |
| Mô tả | Trang chủ báo trước app sắp ra (ô mờ "Sắp có"), và gom các trang hay dùng ngoài hệ VC như Gmail, Google Drive, MISA vào một chỗ (ô liên kết ngoài). Liên kết ngoài chỉ là đường tắt: không đăng nhập một lần, không truyền thông tin người dùng. |
| Điều kiện trước | Quản trị hệ thống đã khai app trạng thái `coming_soon` hoặc liên kết ngoài (`kind = lien_ket_ngoai`) (VH-APP-01). |
| Xử lý chính | 1. Hai phần riêng dưới lưới app: "Sắp có" và "Liên kết hay dùng". Mọi người đều thấy cả hai phần.<br>2. Ô "Sắp có": mờ, nhãn "Sắp có", không bấm được (con trỏ thường, `aria-disabled="true"`). Di chuột hiện mô tả và "Dự kiến: {thời gian}" nếu quản trị có nhập.<br>3. Ô liên kết ngoài: có biểu tượng mũi tên ra ngoài; mở tab mới (`rel="noopener noreferrer"`); URL đúng như quản trị khai, không thêm tham số.<br>4. Quản trị khai liên kết ngoài: tên, URL (bắt buộc `https://`), biểu tượng, thứ tự. Tối đa 12 liên kết ngoài.<br>5. Người dùng thu gọn được phần "Sắp có"; lựa chọn nhớ trên trình duyệt.<br>6. Chuyển app từ `coming_soon` sang `live` hoặc `beta`: ô mờ biến mất; người có quyền thấy ô thường trong lưới. |
| Ngoại lệ, thông báo lỗi | Lúc khai, URL `http://`: "Liên kết ngoài phải dùng https://."<br>Khai liên kết thứ 13: "Tối đa 12 liên kết ngoài. Bỏ bớt liên kết ít dùng trước." |
| Dữ liệu | `apps` (trạng thái `coming_soon`, loại `lien_ket_ngoai`, mô tả, dự kiến); `catalog.json`. |
| Quy tắc | VH-BR-21 |
| Màn hình | VH-MH-02, VH-MH-15 |
| Phụ thuộc | VH-APP-01. |

**Tiêu chí nghiệm thu:**
1. VCsale trạng thái "Sắp có" hiện mờ cho mọi người; bấm không có tác dụng; trình đọc màn hình đọc "VCsale, sắp có".
2. Liên kết Gmail mở tab mới với đúng URL đã khai, không có tham số thêm.
3. Khai URL `http://…`: bị chặn đúng câu chữ.
4. Chuyển VCsale sang `live`: ô mờ không còn; người có quyền thấy ô thường.

### VH-HOM-07 — Số việc chờ trên ô app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | C · E |
| Tác nhân | Nhân viên; các app có API trạng thái |
| Mô tả | Ô app có con số nhỏ cho biết việc đang chờ người dùng trong app đó, ví dụ hội thoại chờ trả lời ở VClinks. Nhân viên biết nên mở app nào trước. Số do app tính và trả về; VC Home không lưu. |
| Điều kiện trước | App có API trạng thái `GET /api/vc-app/status` (VH-API-09, VH-INT-07) và đã bật cờ "Có API trạng thái" trong danh mục. VC ID đã có mapper `audience` để token của VC Home dùng được với app. |
| Xử lý chính | 1. Khi tải trang chủ, VC Home gọi song song API trạng thái của từng app có cờ, kèm token truy cập của người dùng. Chờ tối đa 2 giây mỗi app.<br>2. App trả `{access: granted hoặc pending, badges: [{label, count, url}]}`. Ví dụ VClinks: `{label: "Hội thoại chờ trả lời", count: 5, url: "/conversations?filter=waiting"}`.<br>3. Ô hiện tổng số ở góc trên, tối đa "99+". Di chuột hiện từng nhãn và số. Bấm vào một nhãn: mở `url` trong app.<br>4. Kết quả lưu tạm 60 giây trên trình duyệt; tự làm mới mỗi 5 phút khi tab đang hiện.<br>5. Chỉ hiện nhãn và số; nhãn dài quá 40 ký tự bị cắt. Không hiện nội dung chi tiết (tên khách, nội dung tin).<br>6. App trả chậm hoặc lỗi: ô đó không có số, không báo lỗi cho người dùng; VC Home ghi log. |
| Ngoại lệ, thông báo lỗi | Không có câu thông báo cho người dùng. Phản hồi sai mẫu (thiếu trường, số âm) bị bỏ qua và ghi log. |
| Dữ liệu | `apps` (cờ và URL API trạng thái); không lưu số việc trên VC Home. |
| Quy tắc | VH-BR-19, VH-BR-20 |
| Màn hình | VH-MH-02 |
| Phụ thuộc | VH-INT-07, VH-API-09, VH-APP-04. |

**Tiêu chí nghiệm thu:**
1. VClinks trả 5 việc chờ: ô VClinks có số 5 trong ≤ 3 giây sau khi trang chủ hiện.
2. App trả chậm 5 giây: lưới hiện bình thường, ô đó không có số, không có thông báo lỗi.
3. App trả 150: ô hiện "99+".
4. Phản hồi có nhãn dài 60 ký tự hoặc số âm: nhãn bị cắt ở 40 ký tự, số âm bị bỏ; giao diện không vỡ.

### VH-HOM-08 — Thông báo trong VC Home

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Mọi người dùng (nhận); hệ thống (tạo) |
| Mô tả | Biểu tượng chuông ở đầu mọi màn VC Home gom các việc cần người dùng biết hoặc làm: yêu cầu chờ duyệt, kết quả duyệt, quyền sắp hết hạn, đợt rà soát. Mỗi thông báo dẫn thẳng tới màn cần xử lý. |
| Điều kiện trước | Người dùng đã gắn hồ sơ. Các luồng sinh thông báo đã chạy (VH-REQ, VH-REV, VH-ACC-05, VH-NSU-06). |
| Xử lý chính | 1. Chuông có số thông báo chưa đọc, tối đa "99+".<br>2. Bấm chuông: danh sách mới nhất trước, 20 dòng mỗi trang. Mỗi dòng: tiêu đề ngắn, 1–2 câu nội dung, thời gian ("5 phút trước", quá 24 giờ thì ghi dd/mm hh:mm), chấm xanh nếu chưa đọc.<br>3. Bấm một thông báo: đánh dấu đã đọc và mở màn liên quan. Có nút "Đánh dấu tất cả đã đọc".<br>4. Các loại thông báo, ví dụ câu chữ:<br>• Yêu cầu chờ duyệt: "{Họ tên} xin vai trò {vai trò} trong {app}. Hạn duyệt {dd/mm}." → VH-MH-08.<br>• Nhắc duyệt sau 2 và 5 ngày (VH-BR-13): "Còn {n} yêu cầu chờ bạn duyệt, yêu cầu cũ nhất gửi {dd/mm}."<br>• Kết quả cho người xin: "Yêu cầu {vai trò} trong {app} đã được duyệt, có hiệu lực tới {dd/mm/yyyy}." / "… bị từ chối: {lý do}." / "… đã tự huỷ vì quá 7 ngày chưa duyệt xong."<br>• Quyền sắp hết hạn (mặc định 14 và 3 ngày trước, đặt ở VH-ADM-05): "Vai trò {vai trò} trong {app} hết hạn ngày {dd/mm}." · liên kết gia hạn.<br>• Quyền bị gỡ: "Vai trò {vai trò} trong {app} đã bị gỡ: {lý do}."<br>• Rà soát (trưởng đơn vị): "Đợt rà soát {tên đợt} mở, có {n} quyền cần bạn xác nhận trước {dd/mm}."<br>• Đề nghị sửa hồ sơ: "HC-NS đã {áp dụng/từ chối} đề nghị sửa {trường}."<br>• Cho HC-NS: "Có {n} đề nghị sửa hồ sơ mới." / "{n} vị trí đang thiếu quản lý trực tiếp."<br>5. Kiểm thông báo mới mỗi 60 giây khi tab đang hiện.<br>6. Giữ 90 ngày rồi xoá.<br>7. Nội dung chỉ có thông tin công việc; không chứa token hay dữ liệu C2, C3. |
| Ngoại lệ, thông báo lỗi | Không có thông báo: "Bạn không có thông báo nào."<br>Mở thông báo dẫn tới việc đã xử lý xong: màn đích hiện trạng thái hiện tại, ví dụ "Yêu cầu này đã được {người} duyệt lúc {hh:mm dd/mm}." |
| Dữ liệu | `notifications` (người nhận, loại, tiêu đề, nội dung, liên kết, lúc tạo, lúc đọc). |
| Quy tắc | VH-BR-12, VH-BR-13, VH-BR-16, VH-BR-19, VH-BR-22 |
| Màn hình | Chuông trên mọi màn VC Home (VH-MH-02 đến VH-MH-20); đích thường gặp: VH-MH-04, VH-MH-08, VH-MH-10, VH-MH-11 |
| Phụ thuộc | VH-REQ-01 đến VH-REQ-06, VH-REV-01 đến VH-REV-03, VH-ACC-05, VH-NSU-06, VH-ADM-05. |

**Tiêu chí nghiệm thu:**
1. Nhân viên gửi yêu cầu quyền: quản lý thấy thông báo trong ≤ 60 giây; bấm vào mở đúng yêu cầu trên VH-MH-08.
2. Yêu cầu chưa duyệt sau 2 ngày: người duyệt nhận nhắc. Sau 7 ngày: người xin nhận thông báo "đã tự huỷ".
3. Bấm "Đánh dấu tất cả đã đọc": số trên chuông về 0 ở mọi tab đang mở trong ≤ 60 giây.
4. Thông báo tạo cách đây 91 ngày không còn trong danh sách.
5. Gọi API thông báo với mã người dùng khác: chỉ trả thông báo của chính người gọi.

## 3. NSU — Hồ sơ nhân sự (VC People)

VC People là nguồn sự thật duy nhất về "ai là ai" trong tập đoàn (VH-BR-03). HC-NS tạo và sửa hồ sơ; nhân viên xem hồ sơ của mình và đề nghị sửa; app chỉ đọc qua token, API và sự kiện. VC People chỉ giữ thông tin công việc mức C0–C1 (VH-BR-19):
- **C0 (công khai nội bộ):** mã nhân viên, họ tên, tên gọi, ảnh, chức danh, đơn vị, chức năng, pháp nhân, email công ty, SĐT công việc.
- **C1 (nội bộ hạn chế):** email phụ, quản lý trực tiếp, ngày vào, ngày nghỉ, loại nhân viên, nơi làm việc, trạng thái làm việc, lịch sử vị trí.
- **C2, C3** (SĐT cá nhân, ngày sinh, CCCD, địa chỉ nhà, lương, hợp đồng, đánh giá): **không lưu**.

### VH-NSU-01 — Hồ sơ nhân sự

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS (tạo, sửa trong phạm vi pháp nhân hoặc division được gán); nhân viên (xem của mình); người xem khác theo VH-NSU-08 |
| Mô tả | Mỗi nhân viên có một hồ sơ trên VC People với mã nhân viên duy nhất toàn tập đoàn. Hồ sơ chỉ có thông tin công việc. Mọi app đọc hồ sơ từ đây, không app nào sửa, để cả tập đoàn chỉ có một bản đúng. |
| Điều kiện trước | Danh mục pháp nhân, nơi làm việc, chức danh, chức năng và cây đơn vị đã có (VH-ORG-01, 02, 03, 07). Người làm có vai trò `vchome:hcns` với phạm vi gồm pháp nhân của hồ sơ. |
| Xử lý chính | 1. HC-NS mở VH-MH-11 → "Thêm nhân viên" (hoặc nhập nhiều người bằng Excel, VH-IMP-01).<br>2. Nhập các trường ở bảng dưới. Kiểm hợp lệ khi rời từng ô và khi lưu.<br>3. Cùng form bắt buộc nhập vị trí chính (VH-NSU-02). Hồ sơ không có vị trí chính thì không lưu được.<br>4. Ngày vào sau hôm nay: trạng thái "Chưa vào làm". Ngày vào là hôm nay hoặc đã qua: "Đang làm".<br>5. Lưu: ghi `people`, `positions` và nhật ký. Từ GĐ C, khi hồ sơ có hiệu lực thì gửi sự kiện `vh.person.joined` (VH-LCM-01).<br>6. Sửa: sửa được mọi trường trừ mã nhân viên (mã khoá lại khi hồ sơ đã gắn tài khoản hoặc đã có hiệu lực). Sửa pháp nhân, loại nhân viên, nơi làm việc thì hỏi ngày hiệu lực, mặc định hôm nay (VH-BR-07), vì các trường này dùng trong luật cấp quyền.<br>7. Ảnh: mặc định lấy ảnh Google của tài khoản đã gắn. HC-NS tải ảnh khác được (JPG hoặc PNG ≤ 2 MB); hệ thống cắt vuông và lưu cỡ 400 × 400 px.<br>8. Không xoá hồ sơ đã có hiệu lực. Hồ sơ "Chưa vào làm" mà người đó không đến làm thì HC-NS bấm "Không nhận việc": hồ sơ chuyển sang Đã nghỉ với cờ `khong_vao_lam`, lý do bắt buộc (05 mục 4.1); mã nhân viên vẫn không dùng lại.<br>9. Danh sách trên VH-MH-11: tìm theo mã, họ tên (gõ không dấu được), email. Lọc theo pháp nhân, đơn vị (có cây con), trạng thái, loại nhân viên. Cột cảnh báo: "Thiếu quản lý", "Chưa gắn tài khoản", "Email lệch", "Có đề nghị sửa". Phân trang 50 dòng.<br>10. Từ GĐ C, đổi họ tên, email, ảnh, loại nhân viên thì gửi `vh.person.updated`. |
| Ngoại lệ, thông báo lỗi | "Mã nhân viên gồm 3–20 ký tự chữ hoa, số hoặc gạch ngang."<br>"Mã nhân viên {mã} đã dùng cho {họ tên} ({trạng thái}). Mã không được dùng lại."<br>"Email phải có đuôi @vcprosperous.com hoặc @vcpart.vn."<br>"Email {email} đã có trong hồ sơ {mã} – {họ tên}."<br>"Email phụ phải khác email công ty."<br>"Chưa có vị trí chính. Chọn đơn vị, chức danh và quản lý trực tiếp."<br>"Ngày vào cách hôm nay quá 180 ngày. Kiểm lại năm."<br>"Ảnh phải là JPG hoặc PNG, tối đa 2 MB."<br>"Bạn chỉ sửa được hồ sơ thuộc {tên pháp nhân hoặc division trong phạm vi}." |
| Dữ liệu | `people`, `positions`, `accounts` (chỉ đọc), `scheduled_changes`, `audit_log`; từ GĐ C: `event_outbox`. |
| Quy tắc | VH-BR-01, VH-BR-03, VH-BR-04, VH-BR-07, VH-BR-17, VH-BR-18, VH-BR-19, VH-BR-22 |
| Màn hình | VH-MH-11, VH-MH-03 |
| Phụ thuộc | VH-ORG-01, VH-ORG-02, VH-ORG-03, VH-ORG-07, VH-NSU-02, VH-NSU-04, VH-IMP-01, VH-AUT-08, VH-API-01, VH-API-02; quy trình VH-QT-03, VH-QT-04. |

**Bảng trường hồ sơ:**

| Trường | Bắt buộc | Kiểm tra | Mức | Ghi chú |
|---|---|---|---|---|
| Mã nhân viên | Có | 3–20 ký tự chữ hoa, số, gạch ngang; duy nhất toàn tập đoàn, kể cả hồ sơ đã nghỉ hoặc đã huỷ | C0 | Khoá nghiệp vụ (VH-BR-01); claim `employee_code` |
| Họ và tên | Có | 2–80 ký tự, không có chữ số | C0 | Họ tên đầy đủ có dấu |
| Tên gọi | Không | ≤ 30 ký tự | C0 | Hiện trên thẻ hồ sơ, lời chào. Trống thì dùng tên (chữ cuối của họ tên) |
| Email công ty | Có, trừ người không có tài khoản Google | Đuôi `@vcprosperous.com` hoặc `@vcpart.vn`; duy nhất trên mọi hồ sơ, tính cả email phụ | C0 | Dùng để gắn tài khoản (VH-AUT-08). Người không có tài khoản Google (thợ, kho…) để trống: không đăng nhập được nhưng vẫn có trong danh bạ, cây tổ chức |
| Email phụ | Không | Như email công ty; khác email công ty; duy nhất | C1 | Khi một người có địa chỉ ở cả hai domain |
| Ảnh | Không | JPG hoặc PNG ≤ 2 MB | C0 | Mặc định ảnh Google |
| SĐT công việc | Không | 10 số bắt đầu bằng 0, hoặc số bàn kèm máy lẻ (ví dụ `0243xxxxxxx #123`) | C0 | Không nhập số cá nhân (VH-BR-19) |
| Pháp nhân | Có | Chọn từ danh mục, đang hoạt động | C0 | Claim `legal_entity`; dùng trong luật |
| Loại nhân viên | Có | Chính thức / Thử việc / Cộng tác viên / Thực tập | C1 | Dùng trong luật (VH-BR-10) |
| Nơi làm việc | Không (nên nhập) | Chọn từ danh mục, đang dùng | C1 | Dùng trong luật; luật theo nơi làm việc không áp cho người để trống |
| Ngày vào | Có | Ngày hợp lệ; không quá 180 ngày tới | C1 | Ngày đầu tiên đi làm |
| Ngày nghỉ | Không | Sau ngày vào | C1 | Đặt qua VH-NSU-04; xử lý theo VH-LCM-03 |
| Trạng thái | Hệ thống tính | Chưa vào làm / Đang làm / Nghỉ dài ngày / Tạm khoá / Đã nghỉ | C1 | Theo VH-NSU-04; không sửa tay |

Hồ sơ không có trường nào cho CCCD, ngày sinh, giới tính, địa chỉ nhà, SĐT cá nhân, lương, hợp đồng, đánh giá.

**Tiêu chí nghiệm thu:**
1. Tạo hồ sơ đủ trường bắt buộc và vị trí chính: lưu xong trong ≤ 2 giây; tìm thấy ngay trên VH-MH-11, và trên danh bạ nếu trạng thái "Đang làm".
2. Nhập mã nhân viên trùng với một hồ sơ đã nghỉ: bị chặn đúng câu chữ.
3. Email đuôi `@gmail.com` bị chặn. Email trùng email phụ của hồ sơ khác bị chặn.
4. HC-NS phạm vi pháp nhân A mở hồ sơ pháp nhân B: không có nút "Sửa"; gọi thẳng API sửa thì nhận `403`.
5. Quản trị hệ thống mở hồ sơ: chỉ đọc, không có nút "Sửa"; nhật ký có 1 dòng "xem hồ sơ".
6. Schema của `people` không có trường nào trong danh sách không lưu ở trên (kiểm tự động).

### VH-NSU-02 — Vị trí công tác chính và kiêm nhiệm

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS |
| Mô tả | Vị trí công tác cho biết một người làm gì, ở đâu, báo cáo ai, từ ngày nào tới ngày nào. Mỗi nhân viên đang làm có đúng 1 vị trí chính và có thể có thêm kiêm nhiệm. Vị trí cũ không bị sửa đè mà được đóng lại, để giữ lịch sử và để luật cấp quyền tính đúng theo ngày. |
| Điều kiện trước | Hồ sơ đã có (VH-NSU-01). Đơn vị, chức danh, chức năng đang hoạt động. |
| Xử lý chính | 1. Mỗi hồ sơ ở trạng thái Đang làm, Nghỉ dài ngày hoặc Tạm khoá có đúng 1 vị trí chính còn hiệu lực tại mọi ngày, từ ngày vào tới ngày nghỉ: không chồng nhau, không hở ngày.<br>2. "Chuyển vị trí" (đổi vị trí chính): nhập vị trí mới và ngày hiệu lực. Hệ thống đóng vị trí cũ (đến ngày = ngày hiệu lực trừ 1) và mở vị trí mới. Không sửa đè vị trí cũ.<br>3. "Thêm kiêm nhiệm": 0..n vị trí. Cảnh báo (không chặn) khi quá 3 kiêm nhiệm. Không trùng cả đơn vị lẫn chức danh với một vị trí khác đang hiệu lực.<br>4. "Kết thúc kiêm nhiệm": đặt đến ngày.<br>5. "Đổi quản lý" trên một vị trí: hệ thống đóng bản cũ và mở bản mới cùng đơn vị, chức danh, chức năng, khác quản lý, từ ngày hiệu lực.<br>6. Ngày hiệu lực sau hôm nay: lưu vào `scheduled_changes`, áp lúc 00:00 của ngày đó. Vị trí hiện nhãn "Hẹn {dd/mm/yyyy}" và nút "Huỷ hẹn".<br>7. Ngày hiệu lực là hôm nay hoặc đã qua: áp ngay khi lưu. Quá 30 ngày thì cảnh báo.<br>8. Vị trí đã có hiệu lực chỉ sửa được căn cứ, ghi chú, đến ngày. Đổi đơn vị, chức danh, chức năng, quản lý phải qua bước 2 hoặc 5.<br>9. Nhập nhầm: "Huỷ vị trí" cho vị trí tạo trong 7 ngày gần nhất, lý do bắt buộc; ghi nhật ký; vị trí liền trước được mở lại nếu là vị trí chính.<br>10. Token GĐ B lấy `title`, `unit{code,name}`, `division`, `legal_entity` theo vị trí chính. Từ GĐ C, luật cấp quyền đánh giá trên mọi vị trí còn hiệu lực, cả kiêm nhiệm (VH-BR-24).<br>11. Từ GĐ C: đổi vị trí chính, thêm hoặc bỏ kiêm nhiệm, đổi quản lý thì gửi `vh.person.moved` và tính lại quyền trong ≤ 5 phút. |
| Ngoại lệ, thông báo lỗi | "Nhân viên đang làm phải có đúng 1 vị trí chính. Vị trí chính mới chồng ngày với vị trí tại {đơn vị} từ {dd/mm/yyyy}."<br>"Đơn vị {tên} đã ngừng từ {dd/mm/yyyy}. Chọn đơn vị khác."<br>"Chức danh {tên} đã ngừng dùng. Chọn chức danh khác."<br>"Kiêm nhiệm trùng đơn vị và chức danh với một vị trí đang có."<br>"Đến ngày phải bằng hoặc sau từ ngày."<br>"Đã có thay đổi hẹn ngày {dd/mm/yyyy} cho vị trí này. Huỷ hoặc sửa thay đổi đó trước."<br>Cảnh báo, không chặn: "Ngày hiệu lực đã qua {n} ngày. Lịch sử ghi đúng ngày bạn nhập; quyền và sự kiện tính từ lúc lưu."<br>Cảnh báo, không chặn: "Người này đã có {n} kiêm nhiệm."<br>Lỗi quản lý: xem VH-NSU-03. |
| Dữ liệu | `positions` (nhân viên, loại chính/kiêm nhiệm, đơn vị, chức danh, chức năng, quản lý trực tiếp, từ ngày, đến ngày, căn cứ, ghi chú); `scheduled_changes`; `people`, `org_units`, `job_titles`, `job_functions` (chỉ đọc); `audit_log`; từ GĐ C: `event_outbox`. |
| Quy tắc | VH-BR-04, VH-BR-05, VH-BR-07, VH-BR-11, VH-BR-18, VH-BR-22, VH-BR-24 |
| Màn hình | VH-MH-11, VH-MH-03, VH-MH-09 |
| Phụ thuộc | VH-ORG-01 đến VH-ORG-04, VH-NSU-03, VH-LCM-02, VH-ACC-02, VH-INT-01, VH-INT-03; quy trình VH-QT-05. |

**Bảng trường vị trí:**

| Trường | Bắt buộc | Kiểm tra | Ghi chú |
|---|---|---|---|
| Loại | Có | Chính / Kiêm nhiệm | |
| Đơn vị | Có | Đơn vị đang hoạt động tại từ ngày; mọi loại đơn vị | Ban giám đốc có thể đặt ở đơn vị Tập đoàn |
| Chức danh | Có | Từ danh mục, đang dùng | |
| Chức năng | Có | Từ danh mục, đang dùng | Tự điền theo chức danh, đổi được |
| Quản lý trực tiếp | Có, trừ người đứng đầu tập đoàn | Theo VH-NSU-03 | Gợi ý: trưởng đơn vị; nếu chính người này là trưởng thì gợi ý trưởng đơn vị cha |
| Từ ngày | Có | Ngày hợp lệ, không trước ngày vào | Ngày hiệu lực (VH-BR-07) |
| Đến ngày | Không | Bằng hoặc sau từ ngày | Trống là chưa định |
| Căn cứ | Không | ≤ 100 ký tự | Số quyết định, ví dụ "QĐ 15/2026/QĐ-VCP" |
| Ghi chú | Không | ≤ 300 ký tự | Không ghi thông tin C2, C3 |

**Tiêu chí nghiệm thu:**
1. Ngày 20/11 lưu "Chuyển vị trí" hiệu lực 01/12: tới 23:59 30/11 thẻ hồ sơ vẫn hiện vị trí cũ; lúc 00:05 01/12 vị trí cũ có đến ngày 30/11, vị trí mới có từ ngày 01/12.
2. Cố lưu hai vị trí chính chồng ngày: bị chặn đúng câu chữ.
3. Thêm 1 kiêm nhiệm: hồ sơ có 1 vị trí chính và 1 kiêm nhiệm; token vẫn ghi đơn vị và chức danh của vị trí chính.
4. "Huỷ hẹn" trước ngày hiệu lực: lúc 00:00 không có thay đổi nào được áp; nhật ký ghi việc huỷ.
5. "Đổi quản lý": lịch sử vị trí có 2 dòng (bản cũ đã đóng, bản mới đang mở); không dòng nào bị sửa đè đơn vị, chức danh hay quản lý.

### VH-NSU-03 — Quản lý trực tiếp và cây quản lý

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS (đặt, đổi); quản lý, nhân viên (xem); app (đọc qua API) |
| Mô tả | Mỗi nhân viên có đúng 1 quản lý trực tiếp, trừ người đứng đầu tập đoàn. Nối các quan hệ này thành cây quản lý dùng để duyệt yêu cầu, xem đội và tính phạm vi xem hồ sơ. Cây không được có vòng. |
| Điều kiện trước | Có vị trí công tác (VH-NSU-02). |
| Xử lý chính | 1. Quản lý trực tiếp của một nhân viên là quản lý ghi trên vị trí chính. Cây quản lý dựng từ vị trí chính của mọi người đang làm, nghỉ dài ngày hoặc tạm khoá.<br>2. Quản lý ghi trên vị trí kiêm nhiệm được xem hồ sơ C1 của người kiêm nhiệm đó (VH-BR-23), nhưng không nhận duyệt bước 1 (VH-BR-12 lấy theo vị trí chính) và không tạo nhánh trong cây.<br>3. Đúng một người được để trống quản lý: người đứng đầu tập đoàn.<br>4. Khi lưu, kiểm vòng: đi ngược chuỗi quản lý từ người được chọn; nếu gặp lại chính nhân viên đang sửa thì chặn. Chuỗi tối đa 15 cấp.<br>5. Quản lý phải là nhân viên ở trạng thái Đang làm hoặc Nghỉ dài ngày, và khác chính mình.<br>6. Gợi ý mặc định: trưởng đơn vị của đơn vị vị trí; nếu nhân viên là trưởng đơn vị đó thì gợi ý trưởng đơn vị cha. HC-NS đổi được.<br>7. Trên hồ sơ hiện: quản lý trực tiếp; chuỗi quản lý lên tới người đứng đầu; "Báo cáo trực tiếp ({n})"; "Cả cây dưới ({m})".<br>8. Quản lý nghỉ việc hoặc chuyển khỏi vị trí: các vị trí trỏ tới người đó gắn cảnh báo "Thiếu quản lý" trên VH-MH-11. Trong lúc chờ, việc duyệt dùng trưởng đơn vị (VH-BR-05).<br>9. "Chuyển người báo cáo": HC-NS chọn nhiều người đang báo cáo một quản lý, chọn quản lý mới và ngày hiệu lực; hệ thống làm "Đổi quản lý" (VH-NSU-02 bước 5) cho từng người.<br>10. Quản lý đang nghỉ dài ngày: không tự thay; VH-MH-11 hiện ghi chú cho HC-NS; việc duyệt dùng uỷ quyền (VH-REQ-03).<br>11. Nhập Excel cho phép tạm để trống quản lý; hồ sơ mang cảnh báo "Thiếu quản lý" (VH-IMP-01).<br>12. App lấy chuỗi quản lý qua VH-API-03. |
| Ngoại lệ, thông báo lỗi | "Không đặt được: {họ tên A} đang là cấp trên của {họ tên B}. Đặt thế này sẽ tạo vòng."<br>"Không chọn chính mình làm quản lý trực tiếp."<br>"Quản lý trực tiếp phải là nhân viên đang làm hoặc đang nghỉ dài ngày."<br>"Chỉ một người được để trống quản lý trực tiếp (người đứng đầu tập đoàn). Hiện là {họ tên}."<br>"Chuỗi quản lý vượt 15 cấp. Kiểm tra lại dữ liệu." |
| Dữ liệu | `positions` (quản lý trực tiếp), `org_units` (trưởng đơn vị), `people`, `scheduled_changes`, `audit_log`. |
| Quy tắc | VH-BR-05, VH-BR-06, VH-BR-12, VH-BR-23 |
| Màn hình | VH-MH-11, VH-MH-03, VH-MH-09, VH-MH-07 |
| Phụ thuộc | VH-NSU-02, VH-ORG-04, VH-API-03, VH-REQ-02, VH-REQ-03, VH-LCM-03. |

**Tiêu chí nghiệm thu:**
1. Đặt A làm quản lý của B khi B đang là cấp trên 2 cấp của A: bị chặn đúng câu chữ.
2. Quản lý X có 6 người báo cáo trực tiếp, đặt ngày nghỉ: từ ngày đó cả 6 vị trí có cảnh báo "Thiếu quản lý"; (GĐ D) yêu cầu quyền của họ chuyển tới trưởng đơn vị.
3. "Chuyển người báo cáo" 6 người sang Y hiệu lực ngày mai: lúc 00:05 ngày mai cả 6 có quản lý Y; lịch sử có 6 cặp dòng đóng/mở.
4. VH-API-03 trả chuỗi quản lý đúng thứ tự từ quản lý trực tiếp lên người đứng đầu, thời gian trả ≤ 300 ms.
5. Người là quản lý trên một vị trí kiêm nhiệm: xem được hồ sơ C1 của người kiêm nhiệm đó, nhưng không nhận yêu cầu duyệt của họ.

### VH-NSU-04 — Trạng thái làm việc có ngày hiệu lực

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS (đặt); hệ thống (áp theo ngày) |
| Mô tả | Trạng thái làm việc cho biết một người đã vào làm chưa, đang làm, đang nghỉ dài ngày, bị tạm khoá hay đã nghỉ. Mọi đổi trạng thái có ngày hiệu lực và hẹn trước được. Trạng thái là đầu vào của khoá tài khoản, gỡ quyền và sự kiện gửi app. |
| Điều kiện trước | Hồ sơ đã có (VH-NSU-01). |
| Xử lý chính | 1. HC-NS đổi trạng thái bằng thao tác riêng trên VH-MH-11: "Đặt nghỉ dài ngày", "Ghi nhận quay lại", "Tạm khoá", "Mở tạm khoá", "Đặt ngày nghỉ việc", "Không nhận việc". Không sửa thẳng ô trạng thái.<br>2. Mỗi thao tác có ngày hiệu lực. Ngày sau hôm nay: lưu vào `scheduled_changes`; job áp lúc 00:00 và xong trước 00:05. Hôm nay hoặc đã qua: áp ngay.<br>3. Một hồ sơ có thể có nhiều thay đổi hẹn, ví dụ nghỉ dài ngày 01/12–28/02 rồi nghỉ việc 01/04. Thay đổi mới mâu thuẫn với thay đổi đang hẹn thì hệ thống hỏi, không tự lưu cả hai.<br>4. Nghỉ dài ngày chỉ lưu từ ngày, đến ngày dự kiến và lựa chọn khoá đăng nhập (mặc định không khoá, VH-BR-15; chọn khoá thì tài khoản mang cờ `nghi_dai_ngay` trong thời gian nghỉ). Không lưu lý do nghỉ (thai sản, ốm…), vì đó là thông tin sức khoẻ, ngoài phạm vi VH-BR-19.<br>5. Tạm khoá (đình chỉ công tác, chờ xử lý): lý do chọn từ danh sách (Đình chỉ công tác / Chờ xử lý vi phạm / Khác) và ghi chú ≤ 200 ký tự. Từ GĐ B, tạm khoá thêm cờ khoá `tam_khoa` vào tài khoản và đăng xuất mọi app trong ≤ 1 phút; quyền giữ nguyên để mở lại nguyên trạng.<br>6. Tác động theo giai đoạn: GĐ B ghi và hiển thị trạng thái, tự khoá khi tạm khoá; nghỉ việc ở GĐ B thì quản trị hệ thống khoá tay (VH-AUT-06) hoặc chờ khoá từ Google (VH-AUT-07). GĐ C thêm tự xử lý vào làm và nghỉ việc (VH-LCM-01, VH-LCM-03). GĐ D thêm tự xử lý nghỉ dài ngày (VH-LCM-04).<br>7. Hồ sơ hiện trạng thái hiện tại, dòng thời gian trạng thái và các thay đổi đang hẹn.<br>8. Đặt ngày nghỉ việc cho người đang là trưởng đơn vị hoặc quản lý của người khác: cảnh báo kèm liên kết "Chuyển người báo cáo" (VH-NSU-03). |
| Ngoại lệ, thông báo lỗi | "Nghỉ dài ngày phải từ 7 ngày trở lên. Nghỉ ngắn hơn không cần khai trên VC Home."<br>"Ngày nghỉ việc phải sau ngày vào ({dd/mm/yyyy})."<br>"Hồ sơ đã nghỉ việc. Dùng chức năng 'Nhận lại' (VH-LCM-05) để mở lại."<br>"Đã có thay đổi hẹn ngày {dd/mm/yyyy}: {mô tả}. Thay đổi mới mâu thuẫn với thay đổi này. Huỷ thay đổi cũ và lưu thay đổi mới?"<br>Cảnh báo, không chặn: "Người này đang là trưởng {đơn vị} và quản lý trực tiếp của {n} người. Sau ngày nghỉ, các vị trí này sẽ thiếu quản lý." |
| Dữ liệu | `people` (trạng thái, ngày vào, ngày nghỉ); `scheduled_changes`; `accounts` (cờ khoá `tam_khoa`, `nghi_dai_ngay`); `audit_log`; từ GĐ C: `event_outbox`. |
| Quy tắc | VH-BR-05, VH-BR-07, VH-BR-14, VH-BR-15, VH-BR-19, VH-BR-22 |
| Màn hình | VH-MH-11, VH-MH-09, VH-MH-03 |
| Phụ thuộc | VH-LCM-01, VH-LCM-03, VH-LCM-04, VH-LCM-05, VH-AUT-06, VH-INT-03; câu hỏi Q-13 (ngày nghỉ là ngày đầu tiên không còn làm). |

**Bảng trạng thái:**

| Trạng thái | Mã | Nghĩa | Đăng nhập | Quyền (từ GĐ C) | Danh bạ |
|---|---|---|---|---|---|
| Chưa vào làm | `chua_vao_lam` | Có hồ sơ, chưa tới ngày vào | Gắn tài khoản được, chưa có app | Chưa có | Không hiện |
| Đang làm | `dang_lam` | Đang đi làm | Có | Theo luật và ngoại lệ | Hiện |
| Nghỉ dài ngày | `nghi_dai_ngay` | Nghỉ từ 7 ngày, có từ ngày, đến ngày | Có; HC-NS có thể chọn khoá | Giữ (VH-BR-15) | Hiện, nhãn "Tạm vắng" |
| Tạm khoá | `tam_khoa` | Đình chỉ, chờ xử lý | Khoá | Giữ nhưng không dùng được | Hiện như Đang làm |
| Đã nghỉ | `da_nghi` | Từ ngày nghỉ việc | Khoá | Gỡ hết (VH-BR-14) | Không hiện |

**Bảng chuyển trạng thái:**

| Từ → Sang | Ai làm | Khi áp | Phải nhập |
|---|---|---|---|
| (mới) → Chưa vào làm | HC-NS | Khi lưu | Ngày vào sau hôm nay |
| Chưa vào làm → Đang làm | Hệ thống | 00:00 ngày vào | — |
| Chưa vào làm → Đã nghỉ | HC-NS ("Không nhận việc") | Ngay | Lý do |
| Đang làm → Nghỉ dài ngày | HC-NS | 00:00 từ ngày | Từ ngày, đến ngày dự kiến (≥ 7 ngày), có khoá đăng nhập không |
| Nghỉ dài ngày → Nghỉ dài ngày | HC-NS (gia hạn) | Ngay | Đến ngày mới |
| Nghỉ dài ngày → Đang làm | Hệ thống (00:00 ngày sau đến ngày) hoặc HC-NS ("Ghi nhận quay lại" sớm) | Theo ngày | — |
| Đang làm, Nghỉ dài ngày → Tạm khoá | HC-NS | Ngay hoặc hẹn | Lý do |
| Tạm khoá → Đang làm | HC-NS ("Mở tạm khoá") | Ngay hoặc hẹn | Lý do |
| Đang làm, Nghỉ dài ngày, Tạm khoá → Đã nghỉ | HC-NS ("Đặt ngày nghỉ việc") | 00:00 ngày nghỉ | Ngày nghỉ |
| Đã nghỉ → Đang làm | Không làm trực tiếp | — | Dùng VH-LCM-05 |

**Tiêu chí nghiệm thu:**
1. Ngày 20/11 tạo hồ sơ có ngày vào 01/12: trạng thái "Chưa vào làm" tới 23:59 30/11; lúc 00:05 01/12 là "Đang làm".
2. Đặt nghỉ dài ngày 6 ngày: bị chặn đúng câu chữ. Đặt 30 ngày: lưu được; hồ sơ không có trường lý do nghỉ.
3. Đặt ngày nghỉ việc 15/12: lúc 00:05 15/12 trạng thái là "Đã nghỉ"; (từ GĐ C) tài khoản bị khoá và mọi quyền bị gỡ trong cùng lần áp.
4. Tạm khoá một người: người đó mất phiên ở mọi app trong ≤ 1 phút. "Mở tạm khoá": đăng nhập lại được, quyền như cũ.
5. Lưu hai thay đổi hẹn mâu thuẫn: hệ thống hiện câu hỏi; không có trường hợp lưu cả hai mà không hỏi.

### VH-NSU-05 — Lịch sử thay đổi hồ sơ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS, kiểm soát, quản trị hệ thống (xem); nhân viên (xem của mình); quản lý (xem lịch sử vị trí trong cây) |
| Mô tả | Mọi thay đổi hồ sơ, vị trí, trạng thái và gắn tài khoản đều để lại dấu: đổi gì, từ gì sang gì, có hiệu lực từ ngày nào, ai đổi, vì sao. Dùng để giải thích vì sao một người có hay mất quyền, và để kiểm soát. |
| Điều kiện trước | Nhật ký thao tác đã chạy (VH-ADM-01). |
| Xử lý chính | 1. Mỗi thay đổi sinh một dòng lịch sử: trường, giá trị trước, giá trị sau, ngày hiệu lực, lúc ghi, người làm (hoặc "Hệ thống"), nguồn (Màn hình / Nhập Excel lô #{n} / Đề nghị sửa #{n} / Đồng bộ Google / Lịch hẹn), lý do hoặc căn cứ.<br>2. Ngăn "Lịch sử" trên hồ sơ (VH-MH-11, VH-MH-03): dòng thời gian mới nhất trước. Lọc theo nhóm (Thông tin, Vị trí, Trạng thái, Tài khoản) và khoảng ngày. Tách "Đã áp" và "Đang hẹn".<br>3. "Hồ sơ tại ngày…": chọn một ngày để xem hồ sơ và vị trí đúng như ngày đó (dựng từ từ ngày, đến ngày của vị trí và lịch sử).<br>4. Lịch sử chi tiết nằm trong `audit_log`, giữ 24 tháng (VH-BR-18). Bản ghi vị trí trong `positions` giữ cùng hồ sơ theo thời hạn lưu hồ sơ. Không ai sửa hay xoá được.<br>5. Xuất CSV cho HC-NS (trong phạm vi) và kiểm soát: UTF-8, giờ dạng dd/mm/yyyy hh:mm giờ Việt Nam.<br>6. Ai xem gì theo VH-NSU-08: nhân viên xem lịch sử của mình; quản lý và trưởng đơn vị xem lịch sử vị trí trong phạm vi; HC-NS xem đủ trong phạm vi; quản trị hệ thống, kiểm soát chỉ đọc. |
| Ngoại lệ, thông báo lỗi | Lịch sử quá 24 tháng: "Lịch sử chi tiết trước {dd/mm/yyyy} đã hết thời hạn lưu. Vị trí công tác vẫn còn ở ngăn Vị trí."<br>Xuất quá lớn: "Xuất tối đa 10.000 dòng mỗi lần. Thu hẹp khoảng ngày."<br>Không có quyền xem: "Bạn không có quyền xem lịch sử của hồ sơ này." |
| Dữ liệu | `audit_log`, `positions`, `scheduled_changes`, `people`. |
| Quy tắc | VH-BR-04, VH-BR-07, VH-BR-18, VH-BR-22, VH-BR-23 |
| Màn hình | VH-MH-11, VH-MH-03, VH-MH-19 |
| Phụ thuộc | VH-ADM-01, VH-NSU-01 đến VH-NSU-04, VH-NSU-08. |

**Tiêu chí nghiệm thu:**
1. Sửa SĐT công việc: trong ≤ 5 giây lịch sử có 1 dòng với đúng giá trị trước, sau, người sửa, nguồn "Màn hình".
2. Hồ sơ nhập từ Excel: dòng lịch sử có nguồn "Nhập Excel lô #{n}" đúng số lô.
3. Người chuyển vị trí ngày 01/12: "Hồ sơ tại ngày" 15/11 hiện vị trí cũ, ngày 02/12 hiện vị trí mới.
4. Không có API nào sửa hay xoá dòng lịch sử; tài khoản cơ sở dữ liệu của VC Home API chỉ được thêm vào `audit_log` (kiểm cấu hình).
5. Nhân viên mở lịch sử của một đồng nghiệp cùng cấp: nhận đúng câu không có quyền (`403`).

### VH-NSU-06 — Hồ sơ của tôi và đề nghị sửa

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | Nhân viên (xem, đề nghị); HC-NS (xử lý đề nghị trong phạm vi) |
| Mô tả | Nhân viên xem đủ hồ sơ công việc của mình và báo chỗ sai. Nhân viên không tự sửa; mọi đề nghị đi qua HC-NS duyệt, để VC People vẫn là một nguồn đúng và có người chịu trách nhiệm. |
| Điều kiện trước | Tài khoản đã gắn hồ sơ (VH-AUT-08). Có ít nhất một HC-NS có phạm vi gồm pháp nhân của người đề nghị. |
| Xử lý chính | 1. VH-MH-03 "Hồ sơ của tôi" hiện: mọi trường C0, C1 của mình; vị trí chính và kiêm nhiệm; quản lý trực tiếp; người báo cáo trực tiếp; ngăn "Lịch sử" (VH-NSU-05); ngăn "Phiên đăng nhập" (VH-AUT-10, từ GĐ D). Từ GĐ C có liên kết "Quyền của tôi" (VH-MH-04).<br>2. Cạnh mỗi trường sửa được có nút "Đề nghị sửa". Phần vị trí có nút "Báo thông tin sai".<br>3. Form đề nghị: trường (chọn sẵn), giá trị hiện tại (chỉ đọc), giá trị đề nghị, lý do (bắt buộc, ≤ 500 ký tự). Đề nghị đổi ảnh: tải ảnh mới (JPG hoặc PNG ≤ 2 MB). Form có dòng nhắc: "Không gửi số CCCD, ngày sinh, địa chỉ nhà, lương. VC Home không lưu các thông tin này."<br>4. Trường đề nghị được: họ tên (sai chính tả), tên gọi, ảnh, SĐT công việc, email phụ, nơi làm việc, ngày vào. "Báo thông tin sai" cho đơn vị, chức danh, chức năng, quản lý, loại nhân viên: nhân viên mô tả, HC-NS sửa bằng thao tác chuẩn (VH-NSU-02, 03). Mã nhân viên, email công ty, trạng thái không đề nghị trên VC Home (email do admin Google đổi).<br>5. Gửi: đề nghị ở trạng thái "Chờ HC-NS", vào hàng chờ ngăn "Đề nghị sửa" trên VH-MH-11 của HC-NS phụ trách pháp nhân của người đó.<br>6. Mỗi người có tối đa 1 đề nghị đang chờ cho mỗi trường, và tối đa 5 đề nghị đang chờ cùng lúc.<br>7. HC-NS mở đề nghị: "Áp dụng" (được chỉnh giá trị trước khi áp, chọn ngày hiệu lực, mặc định hôm nay) hoặc "Từ chối" (lý do bắt buộc). HC-NS không xử lý đề nghị của chính mình; đề nghị của HC-NS đi tới HC-NS khác cùng phạm vi, không có thì tới HC-NS phạm vi toàn tập đoàn.<br>8. Người gửi huỷ được đề nghị khi còn chờ. Kết quả hiện trên VH-MH-03; từ GĐ D có thêm thông báo (VH-HOM-08).<br>9. Đề nghị chờ quá 5 ngày làm việc: nhãn "Quá hạn" trong hàng chờ của HC-NS.<br>10. Áp dụng xong: ghi lịch sử với nguồn "Đề nghị sửa #{n}". |
| Ngoại lệ, thông báo lỗi | "Bạn đã có đề nghị đang chờ cho trường này (gửi {dd/mm/yyyy}). Huỷ đề nghị cũ nếu muốn gửi lại."<br>"Bạn đang có 5 đề nghị chờ xử lý. Chờ HC-NS xử lý bớt rồi gửi tiếp."<br>"Giá trị đề nghị giống giá trị hiện tại."<br>"Nhập lý do (tối đa 500 ký tự)."<br>Thông báo từ chối: "HC-NS đã từ chối đề nghị sửa {trường}: {lý do}."<br>HC-NS mở đề nghị của chính mình: "Bạn không xử lý được đề nghị của chính mình."<br>Tài khoản chưa gắn hồ sơ: không có trang hồ sơ; hiện "Tài khoản chưa có hồ sơ nhân sự, liên hệ HC-NS". |
| Dữ liệu | `people`, `positions`; đề nghị sửa (người đề nghị, trường, giá trị hiện tại, giá trị đề nghị, lý do, trạng thái, người xử lý, lúc xử lý, ghi chú xử lý): README mục 9 chưa có collection cho dữ liệu này, xem "Đề xuất bổ sung"; `audit_log`; `notifications` (GĐ D). |
| Quy tắc | VH-BR-03, VH-BR-07, VH-BR-17, VH-BR-18, VH-BR-19 |
| Màn hình | VH-MH-03, VH-MH-11 |
| Phụ thuộc | VH-NSU-01, VH-NSU-02, VH-NSU-03, VH-NSU-05, VH-AUT-08, VH-HOM-08. |

**Tiêu chí nghiệm thu:**
1. Nhân viên đề nghị đổi SĐT công việc: HC-NS đúng pháp nhân thấy đề nghị trong hàng chờ ≤ 1 phút; HC-NS phạm vi pháp nhân khác không thấy.
2. HC-NS "Áp dụng": hồ sơ đổi ngay (hoặc theo ngày hiệu lực đã chọn); lịch sử ghi nguồn "Đề nghị sửa #{n}"; nhân viên thấy trạng thái "Đã áp dụng".
3. "Từ chối" khi chưa nhập lý do: không lưu được. Có lý do: nhân viên thấy đúng lý do.
4. Gửi đề nghị thứ hai cho cùng trường khi đề nghị đầu chưa xử lý: bị chặn đúng câu chữ.
5. HC-NS mở đề nghị của chính mình: không có nút "Áp dụng"; gọi thẳng API thì nhận `403`.
6. Trang "Hồ sơ của tôi" tải xong trong ≤ 2 giây (p95).

### VH-NSU-07 — Danh bạ công ty

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · B |
| Tác nhân | Mọi nhân viên |
| Mô tả | Danh bạ giúp tìm nhanh một đồng nghiệp: ai, làm gì, ở đơn vị nào, liên lạc thế nào. Danh bạ chỉ hiện thông tin C0; người có quyền xem C1 thấy thêm theo VH-NSU-08. |
| Điều kiện trước | Đã đăng nhập và đã gắn hồ sơ. |
| Xử lý chính | 1. VH-MH-06: ô tìm kiếm và bộ lọc. Mặc định hiện người cùng đơn vị của vị trí chính của người xem.<br>2. Tìm theo họ tên, tên gọi, email, mã nhân viên, SĐT công việc, chức danh. Không phân biệt dấu và hoa thường ("nguyen van an" khớp "Nguyễn Văn An"). Gõ từ 2 ký tự; kết quả cập nhật sau khi ngừng gõ 300 ms.<br>3. Lọc: pháp nhân, division, đơn vị (ô chọn "gồm đơn vị con"), chức năng, chức danh. Người có quyền C1 với một nhóm người thấy thêm lọc nơi làm việc, loại nhân viên, chỉ áp trong phạm vi của họ.<br>4. Ai hiện: Đang làm; Nghỉ dài ngày (nhãn "Tạm vắng", không ghi lý do, không ghi ngày); Tạm khoá (hiện như Đang làm). Không hiện: Chưa vào làm, Đã nghỉ. Người không có email công ty vẫn hiện.<br>5. Mỗi người: ảnh, họ tên (tên gọi), chức danh · đơn vị của vị trí chính, kiêm nhiệm nếu có, pháp nhân, email (nút sao chép, bấm mở thư), SĐT công việc (bấm để gọi trên điện thoại).<br>6. Bấm một người: ngăn chi tiết C0; người có quyền xem C1 thấy thêm theo VH-NSU-08 và có liên kết mở hồ sơ đầy đủ.<br>7. Phân trang 50 người. Sắp theo tên (thứ tự chữ cái tiếng Việt, theo tên rồi họ) hoặc theo đơn vị.<br>8. Nhân viên không có nút xuất danh bạ. HC-NS xuất CSV trong phạm vi của mình.<br>9. Chống thu thập hàng loạt: mỗi người mở tối đa 300 ngăn chi tiết mỗi giờ; vượt thì chặn 15 phút, ghi nhật ký, báo quản trị hệ thống.<br>10. App đọc danh bạ qua VH-API-02, không qua màn này. |
| Ngoại lệ, thông báo lỗi | Không có kết quả: "Không tìm thấy ai khớp '{từ khoá}'. Thử bỏ bớt bộ lọc."<br>Vượt giới hạn: "Bạn đã xem quá nhiều hồ sơ trong thời gian ngắn. Thử lại sau 15 phút."<br>Lỗi tải: "Chưa tải được danh bạ." · nút "Thử lại". |
| Dữ liệu | `people`, `positions`, `org_units`, `job_titles`, `job_functions`, `legal_entities` (chỉ đọc); `audit_log` (khi vượt giới hạn). |
| Quy tắc | VH-BR-03, VH-BR-19, VH-BR-23 |
| Màn hình | VH-MH-06 |
| Phụ thuộc | VH-NSU-01, VH-NSU-02, VH-NSU-08, VH-ORG-01, VH-API-02. |

**Tiêu chí nghiệm thu:**
1. Gõ "nguyen van an": "Nguyễn Văn An" nằm trong 3 kết quả đầu; thời gian trả ≤ 1 giây (p95, dữ liệu thử 1.000 hồ sơ).
2. Lọc một Division có chọn "gồm đơn vị con": đủ người của mọi tổ trong Division đó. Bỏ chọn: chỉ người gắn trực tiếp vào Division.
3. Người "Chưa vào làm" và "Đã nghỉ" không hiện ở bất kỳ tìm kiếm nào.
4. Nhân viên thường không thấy ô lọc "Nơi làm việc"; gọi thẳng API lọc theo nơi làm việc thì nhận `403`.
5. Trên điện thoại rộng 375 px, chạm SĐT công việc mở trình gọi điện.

### VH-NSU-08 — Che thông tin theo người xem

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | Mọi người xem; app (đọc qua API) |
| Mô tả | Mỗi người xem chỉ thấy các trường hợp với vai trò và phạm vi của mình. Che ở máy chủ: trường không được xem thì API không trả về, không chỉ ẩn trên giao diện. Bảng che ở dưới cụ thể hoá VH-BR-23 và ma trận quyền ở tài liệu 02 mục 3. |
| Điều kiện trước | Có vai trò VC Home (VH-ADM-03), cây quản lý (VH-NSU-03), trưởng đơn vị (VH-ORG-04). |
| Xử lý chính | 1. Với mỗi lượt xem, VC Home API xác định quan hệ giữa người xem và hồ sơ: chính mình; quản lý (hồ sơ nằm trong cây dưới theo vị trí chính, hoặc người xem là quản lý trên một vị trí kiêm nhiệm của hồ sơ); trưởng đơn vị (hồ sơ có vị trí trong đơn vị hoặc đơn vị con); HC-NS trong phạm vi; quản trị hệ thống; kiểm soát; còn lại là đồng nghiệp.<br>2. Một người có nhiều quan hệ cùng lúc thì thấy hợp các trường được phép.<br>3. API chỉ trả các trường được phép; trường bị che không có trong dữ liệu trả về.<br>4. Ghi nhật ký mỗi lần một người mở chi tiết hồ sơ C1 của người khác (VH-BR-18). Danh sách có cột C1 (VH-MH-09, VH-MH-11) ghi 1 dòng mỗi lần tải, kèm số người trong danh sách.<br>5. Quan hệ tính tại thời điểm xem: rời vị trí quản lý thì mất quyền xem ngay khi thay đổi có hiệu lực.<br>6. Hồ sơ "Đã nghỉ": chỉ HC-NS (trong phạm vi), quản trị hệ thống, kiểm soát mở được. Người khác chỉ thấy tên kèm "(đã nghỉ)" khi tên xuất hiện trong lịch sử, ví dụ người duyệt cũ.<br>7. App gọi API bằng token máy (VH-INT-06): nhận dữ liệu theo "mức dữ liệu nhân sự" của app (VH-APP-01). Mặc định C0; muốn C1 (quản lý, ngày vào, trạng thái, lịch sử vị trí…) phải ghi lý do khi đưa app vào (VH-APP-04). Sự kiện vòng đời (vào làm, nghỉ việc) gửi mọi app đã đăng ký, chỉ kèm ngày.<br>8. Không có trường C2, C3 nào để che vì VC Home không lưu (VH-BR-19). |
| Ngoại lệ, thông báo lỗi | Mở hồ sơ ngoài phạm vi qua đường dẫn: hiện bản C0, không báo lỗi.<br>Mở hồ sơ đã nghỉ hoặc chưa vào làm khi không có quyền: "Không tìm thấy nhân viên." (`404`, không lộ trạng thái). |
| Dữ liệu | `people`, `positions`, `org_units`, `accounts`, `access_grants` (chỉ đọc); `audit_log`. |
| Quy tắc | VH-BR-17, VH-BR-18, VH-BR-19, VH-BR-23 |
| Màn hình | VH-MH-03, VH-MH-06, VH-MH-07, VH-MH-09, VH-MH-11; API VH-API-01, VH-API-02 |
| Phụ thuộc | VH-NSU-01 đến VH-NSU-03, VH-ORG-04, VH-ADM-03, VH-INT-02, VH-INT-06. |

**Bảng che thông tin theo người xem.** Ký hiệu: ✓ xem được; (đ) chỉ đọc; — không thấy. "Đồng nghiệp" gồm cả HC-NS ngoài phạm vi, chủ app và Ban giám đốc khi xem hồ sơ (chủ app vẫn xem quyền app của mình theo tài liệu 02).

| Trường | Chính mình | Đồng nghiệp | Quản lý (cây dưới) | Trưởng đơn vị (đơn vị và con) | HC-NS trong phạm vi | Quản trị HT | Kiểm soát | App qua API |
|---|---|---|---|---|---|---|---|---|
| Mã NV, họ tên, tên gọi, ảnh | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chức danh, đơn vị, chức năng của vị trí đang hiệu lực (chính và kiêm nhiệm) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pháp nhân, email công ty, SĐT công việc | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Email phụ | ✓ | — | ✓ | ✓ | ✓ | (đ) | (đ) | — |
| Quản lý trực tiếp, người báo cáo trực tiếp | ✓ | — | ✓ | ✓ | ✓ | (đ) | (đ) | Chỉ app mức C1 |
| Ngày vào, loại nhân viên, nơi làm việc | ✓ | — | ✓ | ✓ | ✓ | (đ) | (đ) | Chỉ app mức C1 |
| Trạng thái làm việc và ngày | ✓ | Chỉ nhãn "Tạm vắng" khi nghỉ dài ngày | ✓ | ✓ | ✓ | (đ) | (đ) | Chỉ app mức C1; sự kiện vòng đời gửi mọi app đăng ký |
| Ngày nghỉ việc | ✓ | — | ✓ | ✓ | ✓ | (đ) | (đ) | ✓ (qua sự kiện) |
| Lịch sử vị trí | ✓ | — | ✓ | ✓ | ✓ | (đ) | (đ) | Chỉ app mức C1 |
| Lịch sử thay đổi (người sửa, giá trị trước và sau) | ✓ | — | — | — | ✓ | (đ) | (đ) | — |
| Tài khoản: đã gắn chưa, lần đăng nhập cuối, cờ khoá | ✓ | — | — | — | Chỉ "đã gắn / chưa gắn" | ✓ | (đ) | — |
| Quyền app (từ GĐ C) | ✓ | — | ✓ | ✓ | — | ✓ | (đ) | Chỉ quyền trong app gọi (VH-API-06) |

**Tiêu chí nghiệm thu:**
1. Đồng nghiệp gọi API lấy hồ sơ người khác: dữ liệu trả về chỉ có các trường C0 ở bảng; không có khoá nào của quản lý, ngày vào, loại nhân viên, nơi làm việc, trạng thái. App mức C0 gọi VH-API-01 cũng chỉ nhận các trường C0.
2. Quản lý 2 cấp trên xem hồ sơ người trong cây: thấy đủ C1. Xem hồ sơ người đồng cấp: chỉ C0.
3. HC-NS phạm vi pháp nhân A xem hồ sơ pháp nhân B: chỉ C0.
4. Mỗi lần quản trị hệ thống mở chi tiết một hồ sơ: đúng 1 dòng nhật ký "xem hồ sơ C1".
5. Quản lý chuyển sang đơn vị khác có hiệu lực hôm nay: sau thời điểm có hiệu lực, không còn thấy C1 của người dưới quyền cũ.
6. Bộ test tự động có ít nhất một ca cho mỗi ô của bảng che.

## 4. ORG — Cơ cấu tổ chức

Cơ cấu tổ chức gồm cây đơn vị và các danh mục dùng chung: chức danh, chức năng, pháp nhân, nơi làm việc. Đây là "bộ từ điển" để mô tả vị trí công tác và để viết luật cấp quyền (VH-BR-10). HC-NS quản lý; app chỉ đọc qua VH-API-04, VH-API-05 và sự kiện `vh.org.unit_changed`. Hiện VClinks và VCwiki mỗi app có một cây riêng; VC Home thay cả hai bằng một cây (VH-IMP-03).

### VH-ORG-01 — Cây đơn vị nhiều cấp

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS (thêm, sửa, ngừng); mọi người (xem qua VH-ORG-06); app (đọc qua API) |
| Mô tả | Cây đơn vị mô tả tập đoàn chia thành pháp nhân, division, khối hoặc phòng, tổ hoặc nhóm. Mỗi vị trí công tác gắn vào một đơn vị. App dùng cây này để tính phạm vi dữ liệu, ví dụ VClinks tính phạm vi theo tổ và division. |
| Điều kiện trước | Có danh mục pháp nhân (VH-ORG-07). Có sẵn một đơn vị gốc loại Tập đoàn. |
| Xử lý chính | 1. VH-MH-12: cây bên trái (mở, thu từng nhánh, tìm theo tên gõ không dấu), chi tiết đơn vị bên phải. Không kéo thả để tránh chuyển nhầm; đổi cha bằng nút "Chuyển".<br>2. Chọn một đơn vị → "Thêm đơn vị con". Ô loại chỉ hiện các loại hợp lệ dưới đơn vị cha đó (bảng dưới).<br>3. Nhập các trường ở bảng trường. Pháp nhân tự lấy theo đơn vị loại Pháp nhân gần nhất phía trên; Division nằm thẳng dưới Tập đoàn thì phải chọn pháp nhân.<br>4. Sửa tên, tên ngắn, thứ tự, email nhóm, mô tả: áp ngay. Ở GĐ B, đổi cha và ngừng cũng áp ngay khi lưu (hiệu lực hôm nay). Hẹn ngày, gộp đơn vị làm ở VH-ORG-05 từ GĐ C.<br>5. Ngừng: chỉ khi đơn vị không còn vị trí đang hiệu lực (kể cả kiêm nhiệm) và không còn đơn vị con đang hoạt động. Đơn vị ngừng không chọn được cho vị trí mới, vẫn giữ trong lịch sử.<br>6. Không xoá đơn vị đã từng có vị trí. Đơn vị tạo nhầm, chưa từng dùng thì "Xoá" được (xoá mềm, ghi nhật ký).<br>7. Khi đổi cha, kiểm vòng: đơn vị đích không được nằm trong cây con của đơn vị đang chuyển. Cây sâu tối đa 8 cấp.<br>8. Chi tiết đơn vị hiện: số người đang làm (vị trí chính, kiêm nhiệm riêng), số đơn vị con, trưởng đơn vị, đường đi từ gốc.<br>9. Token lấy từ vị trí chính: `unit{code,name}`; `division` là mã đơn vị loại Division gần nhất phía trên (có thể trống); `legal_entity` là mã pháp nhân.<br>10. Từ GĐ C: thêm, đổi tên, chuyển, ngừng đơn vị thì gửi `vh.org.unit_changed` và tính lại quyền của người bị ảnh hưởng trong ≤ 5 phút (luật theo đơn vị có thể gồm cây con).<br>11. Dữ liệu ban đầu lấy từ cây của VClinks và VCwiki (VH-IMP-03) hoặc Excel (VH-IMP-01). |
| Ngoại lệ, thông báo lỗi | "Mã đơn vị gồm 2–30 ký tự chữ hoa, số, gạch ngang hoặc gạch dưới."<br>"Mã {mã} đã dùng cho đơn vị {tên} ({trạng thái}). Mã không được dùng lại."<br>"{Loại} chỉ đặt dưới {danh sách loại cha}."<br>"Tổ / Nhóm chỉ chứa được Tổ / Nhóm con một cấp."<br>"Không chuyển được: {đơn vị đích} đang nằm dưới {đơn vị}. Chuyển thế này sẽ tạo vòng."<br>"Cây đơn vị sâu tối đa 8 cấp."<br>"Đơn vị còn {n} vị trí đang hiệu lực và {m} đơn vị con đang hoạt động. Chuyển hết người và đơn vị con trước khi ngừng."<br>"Tên {tên} đã có trong cùng đơn vị cha." |
| Dữ liệu | `org_units` (mã, tên, tên ngắn, loại, đơn vị cha, pháp nhân, trưởng đơn vị, trạng thái, hiệu lực từ, đến, thứ tự, email nhóm, mô tả); `legal_entities`, `positions` (chỉ đọc); `audit_log`; từ GĐ C: `event_outbox`. |
| Quy tắc | VH-BR-03, VH-BR-06, VH-BR-07, VH-BR-18, VH-BR-22 |
| Màn hình | VH-MH-12, VH-MH-07 |
| Phụ thuộc | VH-ORG-04, VH-ORG-05, VH-ORG-07, VH-IMP-01, VH-IMP-03, VH-API-04; quy trình VH-QT-03, VH-QT-12. |

**Bảng loại đơn vị:**

| Loại | Mã | Đặt dưới | Có đơn vị con | Ví dụ |
|---|---|---|---|---|
| Tập đoàn | `tap_doan` | Không (gốc, chỉ có 1) | Có | VC Phồn Vinh |
| Pháp nhân | `phap_nhan` | Tập đoàn | Có | Một công ty con; gắn 1–1 với một dòng trong danh mục pháp nhân |
| Division | `division` | Tập đoàn, Pháp nhân | Có | VCparts, VCservice, VCgarage |
| Khối / Phòng | `phong` | Tập đoàn, Pháp nhân, Division, Khối / Phòng | Có | Khối Kinh doanh, Phòng CSKH, Phòng Kế toán |
| Tổ / Nhóm | `to_nhom` | Division, Khối / Phòng | Không (VH-BR-06) | Tổ bán hàng 1, Nhóm CSKH, Nhóm sale admin |

**Bảng trường đơn vị:**

| Trường | Bắt buộc | Kiểm tra | Ghi chú |
|---|---|---|---|
| Mã | Có | 2–30 ký tự chữ hoa, số, `-`, `_`; duy nhất; không đổi; không dùng lại | Claim `unit.code` |
| Tên | Có | ≤ 100 ký tự; không trùng trong cùng đơn vị cha | |
| Tên ngắn | Không | ≤ 30 ký tự | Dùng trên ô app, thẻ hồ sơ, token (`unit.name`); trống thì dùng tên |
| Loại | Có | Theo bảng loại | Không đổi sau khi đã có vị trí |
| Đơn vị cha | Có, trừ gốc | Theo bảng loại; không tạo vòng | |
| Pháp nhân | Có | Tự lấy theo cha; chọn tay khi không có Pháp nhân phía trên | |
| Trưởng đơn vị | Không | Theo VH-ORG-04 | |
| Trạng thái | Hệ thống | Hoạt động / Ngừng | |
| Thứ tự hiển thị | Không | Số nguyên | Thứ tự giữa các đơn vị cùng cha |
| Email nhóm | Không | Email thuộc hai domain công ty | Google Group của đơn vị, nếu có |
| Mô tả | Không | ≤ 300 ký tự | |

**Tiêu chí nghiệm thu:**
1. Thêm Tổ / Nhóm dưới một Tổ / Nhóm: bị chặn đúng câu chữ.
2. Chuyển Division X vào một Khối / Phòng nằm dưới chính X: bị chặn vì tạo vòng.
3. Ngừng đơn vị còn 2 người: bị chặn, câu nêu đúng số. Chuyển hết người rồi ngừng: thành công; đơn vị không còn trong ô chọn đơn vị khi tạo vị trí mới.
4. Cây 300 đơn vị tải xong trong ≤ 2 giây; tìm "to ban hang 1" ra đúng nhánh.
5. VH-API-04 trả cây đúng quan hệ cha con; đơn vị ngừng vẫn có trong kết quả với trạng thái ngừng.

### VH-ORG-02 — Danh mục chức danh

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS (thêm, sửa, ngừng); app (đọc qua VH-API-05) |
| Mô tả | Danh mục chức danh dùng chung toàn tập đoàn để cùng một việc chỉ có một tên, ví dụ không để "NV kinh doanh" và "Nhân viên kinh doanh" song song. Chức danh hiện trên thẻ hồ sơ, danh bạ, token, và dùng được trong luật cấp quyền. |
| Điều kiện trước | Danh mục chức năng đã có (VH-ORG-03). |
| Xử lý chính | 1. VH-MH-13 → ngăn "Chức danh": danh sách, tìm, lọc theo trạng thái và chức năng; cột số người đang giữ.<br>2. Thêm hoặc sửa theo bảng trường. So trùng tên không phân biệt dấu, hoa thường, khoảng trắng thừa.<br>3. Đổi tên: áp cho mọi vị trí đang dùng (chỉ đổi tên hiển thị, không tạo vị trí mới). Token có tên mới ở lần cấp sau. Luật dùng mã nên quyền không đổi.<br>4. Ngừng: vị trí đang dùng giữ nguyên; không chọn được cho vị trí mới; tên hiện kèm "(ngừng)".<br>5. Xoá: chỉ khi chưa từng được dùng.<br>6. Từ GĐ C: chức danh đang dùng trong luật đang bật thì không ngừng được. |
| Ngoại lệ, thông báo lỗi | "Chức danh '{tên}' đã có (mã {mã})."<br>"Mã chức danh gồm 2–30 ký tự chữ hoa, số hoặc gạch dưới."<br>"Chức danh đang dùng trong {n} luật cấp quyền. Sửa hoặc tắt các luật đó trước."<br>"Chức danh đã được dùng, không xoá được. Hãy chuyển sang Ngừng." |
| Dữ liệu | `job_titles` (mã, tên, cấp bậc, chức năng mặc định, gợi ý là quản lý, trạng thái, mô tả); `positions`, `access_rules` (chỉ đọc); `audit_log`. |
| Quy tắc | VH-BR-03, VH-BR-10, VH-BR-18 |
| Màn hình | VH-MH-13 |
| Phụ thuộc | VH-ORG-03, VH-NSU-02, VH-ACC-01, VH-IMP-01, VH-API-05. |

**Bảng trường chức danh:**

| Trường | Bắt buộc | Kiểm tra | Ghi chú |
|---|---|---|---|
| Mã | Có | 2–30 ký tự chữ hoa, số, `_`; duy nhất; không đổi | Dùng trong luật |
| Tên | Có | ≤ 80 ký tự; không trùng | Claim `title` |
| Cấp bậc | Có | 1 Nhân viên · 2 Chuyên viên · 3 Trưởng nhóm, Giám sát · 4 Phó phòng · 5 Trưởng phòng · 6 Giám đốc division, khối · 7 Ban điều hành | Dùng để sắp xếp, báo cáo |
| Chức năng mặc định | Có | Từ danh mục chức năng | Tự điền khi tạo vị trí |
| Gợi ý là quản lý | Không | Có / Không | Chỉ để gợi ý; vai trò "Quản lý" vẫn suy ra từ cây quản lý |
| Trạng thái | Hệ thống | Đang dùng / Ngừng | |
| Mô tả | Không | ≤ 300 ký tự | |

Ví dụ khởi tạo: Nhân viên kinh doanh, Giám sát bán hàng, Giám đốc bán hàng, Nhân viên thị trường (Bán hàng); Nhân viên CSKH, Trưởng nhóm CSKH (CSKH); Sale admin (Sale admin); Kế toán viên, Kế toán trưởng (Kế toán); Kỹ thuật viên (Kỹ thuật / dịch vụ); Thủ kho (Kho); Nhân viên marketing (Marketing); Chuyên viên nhân sự (Nhân sự); Chuyên viên IT (IT); Tổng giám đốc, Giám đốc division (Ban giám đốc).

**Tiêu chí nghiệm thu:**
1. Thêm "nhân viên  kinh doanh" khi đã có "Nhân viên kinh doanh": bị chặn đúng câu chữ.
2. Ngừng một chức danh có 12 người đang giữ: 12 vị trí giữ nguyên; form tạo vị trí mới không còn chức danh này.
3. Đổi tên chức danh: thẻ hồ sơ của người giữ hiện tên mới trong ≤ 1 phút; token ở lần đăng nhập sau có `title` mới.
4. VH-API-05 trả cả chức danh đã ngừng, có trạng thái.

### VH-ORG-03 — Danh mục chức năng

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS (thêm, sửa, ngừng); quản trị hệ thống, chủ app (dùng trong luật) |
| Mô tả | Chức năng là mảng việc của một vị trí, gộp nhiều chức danh lại: ví dụ "Nhân viên kinh doanh" và "Giám sát bán hàng" đều thuộc chức năng Bán hàng. Luật cấp quyền viết theo chức năng thì ít luật hơn và không phải sửa khi thêm chức danh mới. |
| Điều kiện trước | Không có. |
| Xử lý chính | 1. VH-MH-13 → ngăn "Chức năng": danh sách, số vị trí đang dùng, số luật đang dùng (từ GĐ C).<br>2. Mã dạng chữ thường không dấu, 2–30 ký tự (`a-z`, `0-9`, `_`), duy nhất, không đổi sau khi tạo vì luật dùng mã.<br>3. Mỗi vị trí có đúng 1 chức năng; mặc định theo chức danh, HC-NS đổi được. Người làm hai mảng việc thì có hai vị trí (chính và kiêm nhiệm).<br>4. Ngừng: chặn khi còn vị trí đang hiệu lực hoặc luật đang bật dùng chức năng này.<br>5. Thêm chức năng mới: báo quản trị hệ thống (có thể cần luật mới). |
| Ngoại lệ, thông báo lỗi | "Mã chức năng gồm 2–30 ký tự chữ thường không dấu, số hoặc gạch dưới."<br>"Chức năng '{tên}' đã có."<br>"Chức năng đang gắn với {n} vị trí và {m} luật cấp quyền. Chuyển vị trí và sửa luật trước khi ngừng." |
| Dữ liệu | `job_functions` (mã, tên, mô tả, trạng thái); `job_titles`, `positions`, `access_rules` (chỉ đọc); `audit_log`. |
| Quy tắc | VH-BR-03, VH-BR-10, VH-BR-18 |
| Màn hình | VH-MH-13 |
| Phụ thuộc | VH-ORG-02, VH-ACC-01, VH-IMP-03 (ánh xạ vai trò VClinks sang chức năng), VH-API-05. |

**Danh mục chức năng khởi tạo** (cột vai trò app chỉ là ví dụ minh hoạ; luật thật đặt ở VH-ACC-01):

| Mã | Tên | Ví dụ chức danh | Ví dụ vai trò app thường đi kèm |
|---|---|---|---|
| `ban_hang` | Bán hàng | Nhân viên kinh doanh, Giám sát bán hàng, Nhân viên thị trường | VClinks `nvkd`, `giam_sat_bh`, `nv_thi_truong` |
| `cskh` | CSKH | Nhân viên CSKH, Trưởng nhóm CSKH | VClinks `cskh` |
| `sale_admin` | Sale admin | Sale admin | VClinks `sale_admin` |
| `ke_toan` | Kế toán | Kế toán viên, Kế toán trưởng | VClinks `ke_toan` |
| `ky_thuat` | Kỹ thuật / dịch vụ | Kỹ thuật viên | VCgarage (sau) |
| `kho` | Kho | Thủ kho | VCsale (sau) |
| `marketing` | Marketing | Nhân viên marketing | VClinks `marketing`, VCwiki |
| `nhan_su` | Nhân sự | Chuyên viên nhân sự | VC Home `hcns` |
| `it` | IT | Chuyên viên IT | — |
| `ban_giam_doc` | Ban giám đốc | Tổng giám đốc, Giám đốc division | VClinks `quan_sat`, VC Home `bgd` |

**Tiêu chí nghiệm thu:**
1. Danh mục lúc khởi tạo có đủ 10 chức năng ở bảng trên.
2. Tạo vị trí với chức danh "Nhân viên CSKH": ô chức năng tự điền "CSKH"; HC-NS đổi được.
3. Ngừng "Kho" khi còn 1 vị trí đang hiệu lực: bị chặn đúng câu chữ, câu nêu đúng số.
4. Mở một chức năng đã tạo: ô mã chỉ đọc; gọi thẳng API đổi mã thì bị từ chối.

### VH-ORG-04 — Trưởng đơn vị

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS (đặt, đổi); trưởng đơn vị (dùng vai trò suy ra) |
| Mô tả | Mỗi đơn vị có tối đa 1 trưởng. Trưởng đơn vị là vai trò suy ra, không ai gán tay trong phần quyền: có ngay khi được đặt, mất ngay khi thôi. Trưởng đơn vị xem được người của đơn vị mình và đơn vị con, rà soát quyền ngoại lệ của họ, và tạm duyệt khi một người thiếu quản lý. |
| Điều kiện trước | Đơn vị đang hoạt động. Người được chọn đang làm và có vị trí phù hợp. |
| Xử lý chính | 1. VH-MH-12 → chọn đơn vị → "Đặt trưởng đơn vị": chọn nhân viên, ngày hiệu lực (mặc định hôm nay).<br>2. Kiểm: đơn vị chưa có trưởng hoặc trưởng hiện tại sẽ thôi từ ngày hiệu lực; người được chọn có vị trí (chính hoặc kiêm nhiệm) thuộc đơn vị đó hoặc đơn vị cha trực tiếp (VH-BR-06).<br>3. Đặt trưởng mới khi đã có trưởng: trưởng cũ thôi từ ngày trước ngày hiệu lực.<br>4. Hệ thống hỏi: "Cập nhật quản lý trực tiếp cho {n} người đang báo cáo trưởng cũ trong đơn vị này?" (mặc định có). Chọn có thì tạo "Đổi quản lý" cùng ngày hiệu lực (VH-NSU-02).<br>5. Một người làm trưởng nhiều đơn vị được, ví dụ trưởng phòng kiêm trưởng một nhóm trong phòng.<br>6. Vai trò suy ra "Trưởng đơn vị" có từ ngày hiệu lực; phạm vi gồm mọi đơn vị con (VH-BR-23). Dùng cho rà soát (VH-BR-16), tạm duyệt khi thiếu quản lý (VH-BR-05), và trong luật ("là trưởng đơn vị", VH-BR-10).<br>7. Đơn vị không có trưởng: nhãn "Chưa có trưởng" trên VH-MH-12 và VH-MH-07. Việc rà soát và tạm duyệt đi lên trưởng của đơn vị cha gần nhất có trưởng.<br>8. Trưởng nghỉ việc, hoặc không còn vị trí hợp lệ ở đơn vị đó: tự thôi làm trưởng từ ngày đó; báo HC-NS.<br>9. Lịch sử trưởng đơn vị (ai, từ ngày, đến ngày) giữ trên đơn vị. |
| Ngoại lệ, thông báo lỗi | "Người được chọn chưa có vị trí trong {đơn vị} hoặc đơn vị cha trực tiếp. Thêm vị trí (chính hoặc kiêm nhiệm) trước."<br>"Chỉ chọn được nhân viên đang làm."<br>"Đơn vị đã ngừng, không đặt trưởng được." |
| Dữ liệu | `org_units` (trưởng đơn vị và lịch sử trưởng); `positions`; `scheduled_changes`; `audit_log`. |
| Quy tắc | VH-BR-05, VH-BR-06, VH-BR-07, VH-BR-10, VH-BR-16, VH-BR-23 |
| Màn hình | VH-MH-12, VH-MH-07, VH-MH-09 |
| Phụ thuộc | VH-ORG-01, VH-NSU-02, VH-NSU-03, VH-REQ-02, VH-REV-02. |

**Tiêu chí nghiệm thu:**
1. Đặt trưởng là người không có vị trí trong đơn vị hay đơn vị cha trực tiếp: bị chặn đúng câu chữ.
2. Đặt B thay A làm trưởng hiệu lực 01/12, chọn cập nhật quản lý: lúc 00:05 01/12 B là trưởng, A thôi; 8 người đang báo cáo A trong đơn vị chuyển sang báo cáo B.
3. B mở VH-MH-09 "Đội của tôi": thấy người của đơn vị và mọi đơn vị con.
4. Đơn vị không có trưởng: hiện nhãn "Chưa có trưởng"; (GĐ D) dòng rà soát của người trong đơn vị đó chuyển cho trưởng đơn vị cha.

### VH-ORG-05 — Đổi cơ cấu có ngày hiệu lực (đổi tên, chuyển, gộp, ngừng)

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · C |
| Tác nhân | HC-NS (soạn, hẹn); hệ thống (áp); app (nhận sự kiện) |
| Mô tả | Tái cơ cấu thường có quyết định ký trước và hiệu lực từ ngày 1 tháng sau. HC-NS soạn thay đổi trước, xem trước ai bị ảnh hưởng và quyền nào thay đổi, rồi để hệ thống tự áp đúng 00:00 ngày hiệu lực. App nhận sự kiện để cập nhật phạm vi dữ liệu. |
| Điều kiện trước | GĐ C đã chạy (quyền theo luật, sự kiện). Đơn vị liên quan đang hoạt động. |
| Xử lý chính | 1. VH-MH-12 → "Đổi cơ cấu": chọn thao tác (Đổi tên / Chuyển / Gộp / Ngừng), đơn vị, ngày hiệu lực (mặc định ngày 1 tháng sau), căn cứ (số quyết định), ghi chú.<br>• Đổi tên: tên mới, tên ngắn mới; mã giữ nguyên.<br>• Chuyển: đơn vị cha mới.<br>• Gộp A vào B: A và B cùng loại; mọi vị trí đang hiệu lực và đơn vị con của A chuyển sang B; A ngừng.<br>• Ngừng: như VH-ORG-01 bước 5, kiểm theo ngày hiệu lực.<br>2. Bắt buộc "Xem trước" trước khi lưu: số người và số vị trí bị chuyển, đơn vị con bị ảnh hưởng, trưởng đơn vị, số quyền thêm và mất theo từng app (dùng VH-ACC-03), các app sẽ nhận sự kiện.<br>3. Lưu: ghi vào `scheduled_changes`; hiện trong danh sách "Thay đổi cơ cấu đang hẹn". Sửa hoặc huỷ được trước ngày hiệu lực.<br>4. 00:00 ngày hiệu lực: áp theo thứ tự Đổi tên → Chuyển → Gộp → Ngừng. Gộp: đóng vị trí ở A (đến ngày = ngày hiệu lực trừ 1), mở vị trí mới ở B cùng chức danh, chức năng; quản lý đang là trưởng A thì đổi sang trưởng B.<br>5. Mỗi thay đổi áp theo kiểu "tất cả hoặc không": lỗi giữa chừng thì hoàn lại phần đã làm, đánh dấu "Lỗi khi áp", báo HC-NS và quản trị hệ thống.<br>6. Áp xong: gửi `vh.org.unit_changed` cho từng đơn vị bị đổi, `vh.person.moved` cho từng người bị chuyển; tính lại quyền trong ≤ 5 phút (VH-BR-11) và áp thời gian chuyển tiếp của từng app (VH-APP-06).<br>7. Đơn vị đổi tên giữ lịch sử tên; API trả tên hiện tại kèm lịch sử. |
| Ngoại lệ, thông báo lỗi | "Đã có thay đổi hẹn cho {đơn vị} ngày {dd/mm/yyyy}. Mỗi đơn vị chỉ có một thay đổi cơ cấu mỗi ngày."<br>"Chỉ gộp được hai đơn vị cùng loại."<br>"Chưa xem trước tác động. Bấm 'Xem trước' trước khi lưu."<br>"Thay đổi đã áp không huỷ được. Tạo thay đổi mới để đảo lại."<br>Báo khi lỗi: "Không áp được thay đổi cơ cấu {mô tả} ngày {dd/mm/yyyy}: {lý do}. Chưa có gì thay đổi." |
| Dữ liệu | `org_units`, `positions`, `scheduled_changes`; `access_grants` (qua VH-ACC-02); `event_outbox`; `audit_log`. |
| Quy tắc | VH-BR-06, VH-BR-07, VH-BR-11, VH-BR-18, VH-BR-22 |
| Màn hình | VH-MH-12 |
| Phụ thuộc | VH-ORG-01, VH-ORG-04, VH-NSU-02, VH-ACC-02, VH-ACC-03, VH-INT-03, VH-APP-06; quy trình VH-QT-12. |

**Tiêu chí nghiệm thu:**
1. Gộp Tổ A (7 người) vào Tổ B hiệu lực 01/01: lúc 00:05 01/01 cả 7 người có vị trí mới ở B, A ở trạng thái Ngừng; có 7 sự kiện `vh.person.moved` và sự kiện `vh.org.unit_changed` cho A.
2. Số người và số quyền thay đổi trong "Xem trước" khớp kết quả thật sau khi áp (lệch 0), nếu không có thay đổi khác xen giữa.
3. Huỷ thay đổi trước ngày hiệu lực: lúc 00:00 không có gì thay đổi.
4. Đổi tên đơn vị: sau ngày hiệu lực, token và API trả tên mới; mã giữ nguyên.
5. Giả lập lỗi khi áp: không người nào bị chuyển nửa chừng; HC-NS nhận thông báo đúng mẫu.

### VH-ORG-06 — Sơ đồ tổ chức

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · B |
| Tác nhân | Mọi nhân viên (theo đơn vị); quản lý, trưởng đơn vị, HC-NS, quản trị hệ thống, kiểm soát (thêm chế độ theo quản lý) |
| Mô tả | Sơ đồ cho mọi người thấy tập đoàn gồm những đơn vị nào, ai đứng đầu, mỗi nơi bao nhiêu người. Sơ đồ theo quản lý (ai báo cáo ai) là thông tin C1, nên chỉ hiện cho người có quyền xem phần cây đó. |
| Điều kiện trước | Có cây đơn vị (VH-ORG-01). |
| Xử lý chính | 1. VH-MH-07 có hai chế độ: "Theo đơn vị" cho mọi người; "Theo quản lý" chỉ cho người có quyền C1 với phần cây đó (quản lý thấy cây dưới mình, trưởng đơn vị thấy đơn vị mình, HC-NS trong phạm vi, quản trị hệ thống, kiểm soát).<br>2. Theo đơn vị: mỗi nút là một đơn vị, ghi tên, loại, trưởng đơn vị (ảnh, tên, chức danh), số người đang làm tính cả đơn vị con. Mở, thu từng nhánh; mặc định mở tới cấp Division.<br>3. Bấm một đơn vị: danh sách người (thông tin C0), trưởng trước, rồi theo tên. Nút "Xem cả đơn vị con".<br>4. Tìm một người hoặc đơn vị: mở và tô sáng đường đi từ gốc, cuộn tới nút đó.<br>5. Điện thoại (dưới 600 px): hiện dạng danh sách lồng nhau thay cho sơ đồ.<br>6. HC-NS xuất ảnh PNG hoặc PDF của nhánh đang xem.<br>7. Không hiện người Chưa vào làm, Đã nghỉ. Đơn vị ngừng ẩn; HC-NS có ô chọn "Hiện đơn vị ngừng".<br>8. Từ GĐ C, HC-NS có "Xem cơ cấu tại ngày…" để xem trước cơ cấu sau các thay đổi đang hẹn (VH-ORG-05). |
| Ngoại lệ, thông báo lỗi | Người không có quyền: không thấy chế độ "Theo quản lý"; gọi thẳng API thì nhận `403`.<br>Không tìm thấy: "Không có đơn vị hay người nào khớp '{từ khoá}'." |
| Dữ liệu | `org_units`, `positions`, `people` (chỉ đọc theo VH-NSU-08). |
| Quy tắc | VH-BR-06, VH-BR-19, VH-BR-23 |
| Màn hình | VH-MH-07 |
| Phụ thuộc | VH-ORG-01, VH-ORG-04, VH-NSU-03, VH-NSU-08. |

**Tiêu chí nghiệm thu:**
1. Cây 300 đơn vị, 1.000 người: sơ đồ hiện trong ≤ 2 giây; mở một nhánh trong ≤ 300 ms.
2. Nhân viên thường không thấy chế độ "Theo quản lý".
3. Tìm "Tổ bán hàng 3": đường đi từ Tập đoàn tới tổ được mở và tô sáng.
4. Số người ở mỗi nút khớp số kết quả của danh bạ khi lọc cùng đơn vị có chọn "gồm đơn vị con".
5. Trên màn rộng 375 px: hiện dạng danh sách, không có thanh cuộn ngang.

### VH-ORG-07 — Danh mục pháp nhân và nơi làm việc

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · B |
| Tác nhân | HC-NS phạm vi toàn tập đoàn (pháp nhân); HC-NS trong phạm vi (nơi làm việc); app (đọc) |
| Mô tả | Pháp nhân là công ty có đăng ký kinh doanh mà nhân viên ký hợp đồng. Nơi làm việc là địa điểm nhân viên đi làm: văn phòng, kho, garage, cửa hàng. Cả hai là thuộc tính hồ sơ và dùng được trong luật cấp quyền (VH-BR-10). |
| Điều kiện trước | Không có. |
| Xử lý chính | 1. VH-MH-13 có hai ngăn "Pháp nhân" và "Nơi làm việc".<br>2. Chỉ HC-NS phạm vi toàn tập đoàn thêm, sửa, ngừng pháp nhân. HC-NS theo pháp nhân chỉ xem ngăn này; được sửa nơi làm việc thuộc pháp nhân của mình hoặc nơi làm việc dùng chung.<br>3. Mỗi pháp nhân gắn 1–1 với một đơn vị loại Pháp nhân trên cây, nếu cây có đơn vị đó.<br>4. Đổi tên pháp nhân (theo đăng ký mới) có ngày hiệu lực; giữ tên cũ trong lịch sử.<br>5. Ngừng: chặn khi còn hồ sơ không ở trạng thái Đã nghỉ, hoặc còn đơn vị đang hoạt động gắn vào.<br>6. Token: `legal_entity` là mã pháp nhân.<br>7. Từ GĐ C: đổi pháp nhân hoặc nơi làm việc của một người thì tính lại quyền trong ≤ 5 phút. |
| Ngoại lệ, thông báo lỗi | "Mã số thuế gồm 10 chữ số, hoặc 10 chữ số, gạch ngang và 3 chữ số."<br>"Mã số thuế đã có ở pháp nhân {tên}."<br>"Pháp nhân còn {n} nhân viên và {m} đơn vị. Chuyển trước khi ngừng."<br>"Nơi làm việc còn {n} nhân viên. Chuyển trước khi ngừng."<br>"Chỉ HC-NS phạm vi toàn tập đoàn sửa được danh mục pháp nhân." |
| Dữ liệu | `legal_entities`, `work_locations`; `org_units`, `people` (chỉ đọc); `audit_log`. |
| Quy tắc | VH-BR-03, VH-BR-10, VH-BR-18, VH-BR-19 |
| Màn hình | VH-MH-13 |
| Phụ thuộc | VH-ORG-01, VH-NSU-01, VH-ACC-01, VH-API-05. |

**Bảng trường:**

| Danh mục | Trường | Bắt buộc | Kiểm tra |
|---|---|---|---|
| Pháp nhân | Mã | Có | 2–20 ký tự chữ hoa, số; duy nhất; không đổi |
| Pháp nhân | Tên đầy đủ | Có | Theo đăng ký kinh doanh, ≤ 200 ký tự |
| Pháp nhân | Tên ngắn | Có | ≤ 30 ký tự |
| Pháp nhân | Mã số thuế | Có | 10 số hoặc `NNNNNNNNNN-NNN`; duy nhất |
| Pháp nhân | Địa chỉ trụ sở | Có | ≤ 300 ký tự |
| Pháp nhân | Domain email chính | Không | `vcprosperous.com` hoặc `vcpart.vn` |
| Pháp nhân | Trạng thái, từ ngày | Hệ thống | Hoạt động / Ngừng |
| Nơi làm việc | Mã | Có | 2–30 ký tự chữ hoa, số, `_`; duy nhất |
| Nơi làm việc | Tên | Có | ≤ 100 ký tự, ví dụ "Văn phòng chính", "Kho tổng", "Garage số 1" |
| Nơi làm việc | Loại | Có | Văn phòng / Kho / Garage, xưởng / Cửa hàng / Khác |
| Nơi làm việc | Địa chỉ | Có | ≤ 300 ký tự |
| Nơi làm việc | Tỉnh, thành | Có | Chọn từ danh mục tỉnh, thành hiện hành |
| Nơi làm việc | Pháp nhân quản lý | Không | Từ danh mục pháp nhân; trống là dùng chung |
| Nơi làm việc | Trạng thái | Hệ thống | Đang dùng / Ngừng |

**Tiêu chí nghiệm thu:**
1. Mã số thuế "0101234567" và "0101234567-001" lưu được; "12345" bị chặn đúng câu chữ.
2. Ngừng nơi làm việc còn 3 người: bị chặn, câu nêu đúng số.
3. HC-NS phạm vi pháp nhân A không thấy nút "Thêm", "Sửa" ở ngăn Pháp nhân.
4. VH-API-05 trả danh mục pháp nhân chỉ gồm các trường ở bảng trên.

## 5. APP — Danh mục app và vai trò app

Danh mục app cho VC Home biết có những app nào, ở đâu, ai chịu trách nhiệm, và mỗi app có những vai trò gì. VC Home chỉ cấp **vai trò thô** (ví dụ "VClinks · NVKD"); app tự ánh xạ vai trò sang quyền chi tiết và phạm vi dữ liệu (VH-BR-08, VH-BR-20). VC Home cũng là một app trong danh mục, khoá `vchome`.

### VH-APP-01 — Danh mục app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A (tệp tĩnh), B (quản trị trên màn) |
| Tác nhân | Quản trị hệ thống (sửa); chủ app (xem app của mình); mọi app (đọc `catalog.json`) |
| Mô tả | Danh mục ghi mọi app trong hệ VC: tên, địa chỉ, biểu tượng, trạng thái, chủ app, cấu hình tích hợp. Trang chủ và thanh chuyển app đọc từ đây. Ở GĐ A danh mục là một tệp trong repo; từ GĐ B quản trị trên màn VH-MH-15. |
| Điều kiện trước | GĐ A: repo `vc-platform` có `home/apps.yaml` và bước build kiểm schema. GĐ B: VC Home API và collection `apps` đã có. |
| Xử lý chính | 1. GĐ A: quản trị hệ thống sửa `vc-platform/home/apps.yaml`, mở yêu cầu gộp code. Bước build kiểm schema (zod) rồi sinh `catalog.json`; sai schema thì build dừng, bản đang chạy giữ nguyên.<br>2. Từ GĐ B: sửa trên VH-MH-15, lưu vào `apps`. VC Home API sinh lại `catalog.json` trong ≤ 1 phút. `apps.yaml` chỉ còn là dữ liệu khởi đầu.<br>3. `catalog.json` công khai tại `https://home.vcprosperous.com/catalog.json` (VH-API-08): cho mọi tên miền đọc, cache 300 giây, chỉ có các trường đánh dấu "Công khai" ở bảng dưới, không có dữ liệu cá nhân.<br>4. Trạng thái theo bảng dưới. Chuyển `coming_soon` sang `beta` hoặc `live` chỉ khi đã đạt hợp đồng tích hợp (VH-APP-04).<br>5. Chuyển `live` sang `retired`: hỏi xác nhận, hiện số người đang có quyền trong app. Quyền cũ không tự gỡ; quản trị gỡ ở VH-MH-17 (VH-ACC-06).<br>6. Không xoá app đã từng `live`; chỉ chuyển `retired`.<br>7. VC Home có trong danh mục (khoá `vchome`) để giữ vai trò của chính VC Home, nhưng không hiện ô trên lưới.<br>8. Chủ app xem cấu hình app của mình ở chế độ chỉ đọc; chỉ quản trị hệ thống sửa. |
| Ngoại lệ, thông báo lỗi | "Khoá app gồm 2–30 ký tự, bắt đầu bằng chữ thường, chỉ có chữ thường, số hoặc gạch dưới."<br>"Khoá {khoá} đã dùng cho app {tên}."<br>"URL phải bắt đầu bằng https://."<br>"Biểu tượng phải là SVG hoặc PNG vuông, cạnh từ 128 px, tối đa 200 KB."<br>"Chưa đạt hợp đồng tích hợp: còn {n} mục chưa xong. Xem danh sách kiểm."<br>Hộp xác nhận ngừng: "App đang có {n} người có quyền. Chuyển sang Ngừng sẽ ẩn app khỏi trang chủ và thanh chuyển app; quyền cũ cần gỡ ở Tra cứu quyền." |
| Dữ liệu | `apps`; tệp `catalog.json`; `audit_log`. |
| Quy tắc | VH-BR-08, VH-BR-18, VH-BR-19, VH-BR-21 |
| Màn hình | VH-MH-15, VH-MH-02, VH-MH-21 |
| Phụ thuộc | VH-HOM-01, VH-HOM-05, VH-HOM-06, VH-APP-03, VH-APP-04, VH-APP-06, VH-API-08, VH-ADM-03. |

**Bảng trường app:**

| Trường | Bắt buộc | Kiểm tra | Công khai | Ghi chú |
|---|---|---|---|---|
| Khoá | Có | 2–30 ký tự, bắt đầu bằng chữ thường, gồm chữ thường, số, `_`; duy nhất; không đổi | Có | Tạo nhóm `app-<khoá>` và tên client trên VC ID |
| Tên | Có | ≤ 30 ký tự | Có | |
| Mô tả một dòng | Có | ≤ 80 ký tự | Có | |
| URL | Có, trừ `coming_soon` | Bắt đầu bằng `https://` | Có | Trang mở khi bấm ô |
| Biểu tượng | Có | SVG hoặc PNG vuông, cạnh từ 128 px, ≤ 200 KB | Có | |
| Trạng thái | Có | `live`, `beta`, `coming_soon`, `paused`, `retired`; thêm trường loại `kind` = `sso` (app đăng nhập qua VC ID) hoặc `lien_ket_ngoai` | Có (app `retired` không xuất) | Bảng trạng thái |
| Thứ tự | Có | Số nguyên | Có | |
| Nhóm VC ID | Hệ thống | `app-<khoá>` | Có | Không có với `lien_ket_ngoai` |
| Dự kiến | Không | ≤ 20 ký tự, ví dụ "Quý 1/2027" | Có | Chỉ cho `coming_soon` |
| Client trên VC ID | Có với `live`, `beta` | Theo VH-APP-04 | Không | |
| URL back-channel | Có với `live`, `beta` | `https://` | Không | VH-INT-04 |
| Chủ app | Có với `live`, `beta` từ GĐ C | 1–3 nhân viên đang làm | Không | VH-APP-03 |
| Thời gian chuyển tiếp | Có từ GĐ C | 0–7 ngày, mặc định 0 | Không | VH-APP-06 |
| URL nhận sự kiện | Từ GĐ C | `https://` | Không | VH-INT-03 |
| Mức dữ liệu nhân sự | Có | C0 / C1, mặc định C0 | Không | Muốn C1 phải ghi lý do khi đưa app vào; dùng ở VH-NSU-08 |
| API trạng thái | Không | Có / Không, kèm URL | Không | VH-HOM-07, GĐ E |
| Ghi chú nội bộ | Không | ≤ 500 ký tự | Không | |

**Bảng trạng thái app:**

| Trạng thái | Mã | Trang chủ | Thanh chuyển app | Cấp quyền mới |
|---|---|---|---|---|
| Đang chạy | `live` | Ô thường, cho người có quyền | Có | Có |
| Thử nghiệm | `beta` | Ô thường kèm nhãn "Thử nghiệm", cho người có quyền | Có | Có |
| Sắp có | `coming_soon` | Ô mờ cho mọi người, không bấm được | Không | Không |
| Tạm dừng | `paused` | Ô mờ kèm nhãn "Tạm dừng", không bấm được | Không | Không; quyền cũ giữ nguyên |
| Liên kết ngoài | `kind = lien_ket_ngoai` (trạng thái `live`) | Ô ở phần "Liên kết hay dùng", mở tab mới | Không | Không có vai trò |
| Ngừng | `retired` | Ẩn | Ẩn | Không; quyền cũ chờ gỡ |

**Tiêu chí nghiệm thu:**
1. GĐ A: `apps.yaml` thiếu trường `status` thì build lỗi; `catalog.json` đang chạy giữ nguyên.
2. GĐ B: đổi mô tả VCwiki trên VH-MH-15: `catalog.json` có mô tả mới trong ≤ 1 phút; trang chủ hiện mô tả mới trong ≤ 6 phút.
3. `catalog.json` không có chủ app, URL sự kiện, URL back-channel, client, ghi chú (kiểm tự động theo danh sách khoá).
4. Chuyển một app sang `retired`: ô biến mất ở trang chủ và thanh chuyển app của mọi người trong ≤ 10 phút.
5. Chủ app mở VH-MH-15: thấy app của mình ở chế độ chỉ đọc, không có nút "Sửa".

### VH-APP-02 — Vai trò của từng app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | Chủ app (khai vai trò app mình); quản trị hệ thống (mọi app) |
| Mô tả | Mỗi app công bố một danh sách vai trò thô, ví dụ VClinks có `nvkd`, `cskh`, `giam_sat_bh`. VC Home chỉ cấp những vai trò đã khai. Vai trò "theo đơn vị" đi kèm mã đơn vị để app tự tính phạm vi dữ liệu; vai trò "toàn app" không kèm đơn vị. |
| Điều kiện trước | App đã có trong danh mục (VH-APP-01) và có chủ app (VH-APP-03). |
| Xử lý chính | 1. VH-MH-15 → chọn app → ngăn "Vai trò": thêm, sửa, ngừng. Quản trị hệ thống làm cho mọi app; chủ app chỉ cho app của mình.<br>2. Nhập các trường ở bảng dưới.<br>3. Lưu: VC Home đồng bộ vai trò thành "client role" trên client của app ở VC ID trong ≤ 1 phút (VH-ACC-07).<br>4. Token từ GĐ C: `resource_access.<khoá app>.roles` là danh sách khoá vai trò (mỗi khoá một lần); `vh_roles` có dạng `{<khoá app>: [{role, unit}]}`, trong đó `unit` là mã đơn vị với vai trò theo đơn vị và `null` với vai trò toàn app.<br>5. Đơn vị của vai trò: với quyền từ luật, là đơn vị của vị trí thoả luật; với quyền từ yêu cầu, người xin chọn (mặc định đơn vị vị trí chính).<br>6. Ngừng vai trò: chặn khi còn quyền đang hiệu lực hoặc luật đang bật dùng vai trò. Vai trò ngừng không chọn được trong luật và yêu cầu mới.<br>7. Không xoá vai trò đã từng được cấp. Không đổi phạm vi (theo đơn vị ↔ toàn app) của vai trò đã cấp; phải tạo vai trò mới.<br>8. Trước khi bật vai trò mới, chủ app xác nhận app đã ánh xạ vai trò đó. App gặp vai trò chưa ánh xạ thì bỏ qua và ghi log (VH-BR-20). |
| Ngoại lệ, thông báo lỗi | "Khoá vai trò gồm 2–40 ký tự chữ thường, số hoặc gạch dưới."<br>"Vai trò {khoá} đã có trong {tên app}."<br>"Nhập mô tả: ai nên có vai trò này và được làm gì."<br>"Vai trò đang có {n} người giữ và {m} luật dùng. Gỡ quyền và sửa luật trước khi ngừng."<br>"Không đổi phạm vi của vai trò đã cấp. Tạo vai trò mới rồi chuyển quyền."<br>Chủ app sửa app khác: "Bạn chỉ quản vai trò của app mình." (`403`) |
| Dữ liệu | `app_roles` (app, khoá, tên, mô tả, nhạy cảm, phạm vi, loại đơn vị nhận, trạng thái, thứ tự); `access_grants`, `access_rules` (chỉ đọc); client role trên VC ID; `audit_log`. |
| Quy tắc | VH-BR-08, VH-BR-17, VH-BR-18, VH-BR-20, VH-BR-24 |
| Màn hình | VH-MH-15 |
| Phụ thuộc | VH-APP-01, VH-APP-03, VH-APP-05, VH-ACC-01, VH-ACC-07, VH-INT-01. |

**Bảng trường vai trò app:**

| Trường | Bắt buộc | Kiểm tra | Ghi chú |
|---|---|---|---|
| App | Có | Từ danh mục | |
| Khoá | Có | 2–40 ký tự chữ thường, số, `_`; duy nhất trong app; không đổi | Giá trị trong token |
| Tên | Có | ≤ 40 ký tự | Hiện trên ô app, màn quyền |
| Mô tả | Có | ≤ 300 ký tự | Ai nên có, được làm gì; hiện cho người xin quyền |
| Nhạy cảm | Có | Có / Không | VH-APP-05 |
| Phạm vi | Có | Theo đơn vị / Toàn app | Theo đơn vị: token kèm mã đơn vị |
| Loại đơn vị nhận | Không | Chọn trong 5 loại đơn vị | Chỉ với "Theo đơn vị", ví dụ `nvkd` chỉ nhận Tổ / Nhóm |
| Trạng thái | Hệ thống | Đang dùng / Ngừng | |
| Thứ tự | Không | Số nguyên | |

**Ví dụ khởi tạo** (theo code VClinks, thiết kế SSO và tài liệu 02; chủ app xác nhận lại):

| App | Khoá | Tên | Phạm vi | Nhạy cảm |
|---|---|---|---|---|
| VClinks | `admin` | Admin hệ thống | Toàn app | Có |
| VClinks | `quan_sat` | Ban giám đốc / Kiểm soát | Toàn app | Có |
| VClinks | `giam_doc_bh` | Giám đốc bán hàng | Theo đơn vị (Division) | Có |
| VClinks | `giam_sat_bh` | Giám sát bán hàng | Theo đơn vị (Tổ / Nhóm) | Không |
| VClinks | `nvkd` | Nhân viên kinh doanh | Theo đơn vị (Tổ / Nhóm) | Không |
| VClinks | `cskh`, `marketing`, `sale_admin`, `ke_toan`, `nv_thi_truong` | Nhân viên CSKH, Nhân viên marketing, Sale admin, Kế toán, NV thị trường | Theo đơn vị (Tổ / Nhóm) | Không |
| VCwiki | `admin` | Quản trị | Toàn app | Có |
| VCwiki | `member` | Thành viên | Toàn app | Không |
| VC Home | `hcns` | HC-NS | Theo đơn vị (Pháp nhân, Division, hoặc Tập đoàn cho toàn tập đoàn) | Không |
| VC Home | `qtht` | Quản trị hệ thống | Toàn app | Có |
| VC Home | `kiem_soat` | Kiểm soát | Toàn app | Có |
| VC Home | `bgd` | Ban giám đốc | Toàn app | Không |

**Tiêu chí nghiệm thu:**
1. Chủ VClinks thêm vai trò `thu_kho`: trong ≤ 1 phút client `vclinks` trên VC ID có client role `thu_kho`.
2. Người có `nvkd` ở 2 tổ: token có `resource_access.vclinks.roles` chứa `nvkd` đúng 1 lần; `vh_roles.vclinks` có 2 phần tử với 2 mã đơn vị.
3. Vai trò toàn app: phần tử trong `vh_roles` có `unit` là `null`.
4. Ngừng vai trò còn 3 người giữ: bị chặn đúng câu chữ.
5. Chủ VCwiki gọi API sửa vai trò của VClinks: nhận `403`.

### VH-APP-03 — Chủ app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | Quản trị hệ thống (gán); chủ app |
| Mô tả | Mỗi app có 1–3 chủ app chịu trách nhiệm nghiệp vụ: khai vai trò, cùng duyệt luật của app, duyệt bước 2 cho vai trò nhạy cảm. Chủ app không phải vai trò trong token; đó là một trường của app trong danh mục. |
| Điều kiện trước | App đã có trong danh mục. Người được gán là nhân viên đang làm. |
| Xử lý chính | 1. Quản trị hệ thống gán 1–3 chủ app trên VH-MH-15, trường "Chủ app".<br>2. Từ GĐ C, app `live` hoặc `beta` phải luôn có ít nhất 1 chủ app; không bỏ được người cuối.<br>3. Chủ app được làm, chỉ với app của mình (tài liệu 02 mục 3): xem cấu hình app (chỉ đọc); khai, sửa, ngừng vai trò; soạn luật và duyệt bước hai luật; duyệt bước 2 yêu cầu vai trò nhạy cảm; xem ai có quyền gì trong app; gỡ quyền; xem nhật ký liên quan; xem báo cáo của app.<br>4. Chủ app không được: sửa URL, client, trạng thái app; cấp quyền khẩn cấp; xem hồ sơ C1 (do là chủ app).<br>5. Chủ app chuyển sang Nghỉ dài ngày, Tạm khoá hay Đã nghỉ: hệ thống không giao việc duyệt cho người đó nữa, từ ngày có hiệu lực. Nếu app không còn chủ app nào đang làm: cảnh báo quản trị hệ thống; bước 2 tạm chuyển cho quản trị hệ thống cho tới khi có chủ mới.<br>6. Không tự duyệt: chủ app xin vai trò nhạy cảm của app mình thì bước 2 chuyển cho quản trị hệ thống (VH-BR-12). Luật do chủ app soạn thì người duyệt bước hai là chủ app khác của app đó hoặc quản trị hệ thống (VH-BR-25).<br>7. Thêm, bỏ chủ app đều ghi nhật ký và báo người được thêm hoặc bỏ (từ GĐ D qua VH-HOM-08). |
| Ngoại lệ, thông báo lỗi | "App đang chạy phải có ít nhất 1 chủ app."<br>"Mỗi app có tối đa 3 chủ app."<br>"Chủ app phải là nhân viên đang làm."<br>Cảnh báo cho quản trị hệ thống: "{Tên app} không còn chủ app đang làm. Việc duyệt bước 2 đang chuyển cho quản trị hệ thống." |
| Dữ liệu | `apps` (danh sách chủ app, từ ngày); `audit_log`; `notifications`. |
| Quy tắc | VH-BR-12, VH-BR-17, VH-BR-18, VH-BR-25 |
| Màn hình | VH-MH-15, VH-MH-08, VH-MH-16, VH-MH-17 |
| Phụ thuộc | VH-APP-01, VH-APP-02, VH-APP-05, VH-REQ-02, VH-ACC-01, VH-ADM-03. |

**Tiêu chí nghiệm thu:**
1. Gán chủ app thứ 4: bị chặn đúng câu chữ; gán 3 người thì lưu được.
2. Bỏ chủ app cuối của VClinks (đang `live`): bị chặn đúng câu chữ.
3. Chủ app duy nhất của một app được đặt ngày nghỉ: từ ngày đó, (GĐ D) yêu cầu vai trò nhạy cảm của app có người duyệt bước 2 là quản trị hệ thống; quản trị hệ thống nhận cảnh báo.
4. Chủ VClinks xin `vclinks:admin`: bước 2 ghi người duyệt là quản trị hệ thống, không phải chính người đó.
5. Chủ app mở VH-MH-15: không có nút sửa URL, client hay trạng thái app.

### VH-APP-04 — Đưa app mới vào theo hợp đồng tích hợp

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · E |
| Tác nhân | Đội phát triển app; chủ app; quản trị hệ thống |
| Mô tả | App mới (VCsale, VCgarage, VC AI, VCe, VCinvoice…) chỉ được hiện cho người dùng khi đạt đủ hợp đồng tích hợp. Danh sách kiểm có bằng chứng giúp mọi app làm giống nhau, an toàn như nhau, và không ai đưa app "chạy tạm" vào. |
| Điều kiện trước | Đội app đã đọc tài liệu tích hợp (07) và mục 5.2 thiết kế SSO. Có môi trường staging của VC ID. |
| Xử lý chính | 1. Đội app gửi đề nghị cho quản trị hệ thống: tên, khoá, URL staging và production, URL trả về sau đăng nhập, URL back-channel, URL nhận sự kiện, danh sách vai trò dự kiến, chủ app đề cử.<br>2. Quản trị hệ thống tạo app trạng thái `coming_soon` và client trên VC ID staging (cấu hình dạng code). Client secret giao qua kênh bí mật đã quy định, không gửi qua chat hay email thường.<br>3. Chủ app khai vai trò (VH-APP-02), soạn luật mặc định cùng quản trị hệ thống (VH-ACC-01), xem trước tác động (VH-ACC-03).<br>4. VC Home chạy bộ kiểm tự động trên staging: đọc cấu hình đăng nhập; đăng nhập thử bằng tài khoản thử; gửi `logout_token` sai (mong `400`) và đúng (mong `200`, phiên bị thu hồi); gửi sự kiện thử có chữ ký đúng (mong `2xx`) và chữ ký sai (mong `4xx`).<br>5. Đội app chạy các ca thử tối thiểu: đăng nhập, sai domain, thiếu vai trò, đăng xuất chung, bị khoá.<br>6. Danh sách kiểm 14 mục (bảng dưới): mỗi mục có người xác nhận, ngày, bằng chứng (liên kết kết quả test hoặc biên bản).<br>7. Đủ 14 mục: quản trị hệ thống tạo client production, chuyển app sang `beta`. Sau ít nhất 2 tuần chạy ổn và chủ app đồng ý: chuyển `live`.<br>8. Kết quả kiểm và các lần chuyển trạng thái lưu cùng app và ghi nhật ký. |
| Ngoại lệ, thông báo lỗi | "Chưa đạt hợp đồng tích hợp: còn {n} mục chưa xong. Xem danh sách kiểm."<br>"Endpoint back-channel trả {mã} với token sai (mong 400)."<br>"Endpoint nhận sự kiện chấp nhận sự kiện sai chữ ký (mong 4xx)."<br>"URL trả về phải là địa chỉ đầy đủ, không dùng ký tự *." |
| Dữ liệu | `apps` (danh sách kiểm, kết quả kiểm); `app_roles`; `access_rules`; client trên VC ID; `audit_log`. |
| Quy tắc | VH-BR-03, VH-BR-08, VH-BR-19, VH-BR-20, VH-BR-21 |
| Màn hình | VH-MH-15 |
| Phụ thuộc | VH-APP-01, VH-APP-02, VH-APP-03, VH-APP-06; VH-INT-01, VH-INT-03, VH-INT-04, VH-INT-05, VH-INT-06; VH-HOM-05; quy trình VH-QT-11. |

**Danh sách kiểm hợp đồng tích hợp:**

| # | Mục | Cách kiểm |
|---|---|---|
| 1 | Đăng nhập OIDC (chuẩn đăng nhập OpenID Connect) kiểu Authorization Code, PKCE S256, đổi `code` ở máy chủ | Xem cấu hình client; đăng nhập thử |
| 2 | Kiểm token đủ 6 điểm (chữ ký, `iss`, `aud`, `exp`, `nonce`, `email_verified`) | Test của app, mỗi điểm một ca sai |
| 3 | Kiểm lại domain email và `hd` | Ca sai domain |
| 4 | Khoá người dùng theo `sub`, gắn theo email một lần, báo `identity_conflict` | Ca xung đột |
| 5 | Mặc định chặn: không có vai trò app thì không cho vào (VH-BR-20) | Ca thiếu vai trò |
| 6 | Phiên riêng ≤ 7 ngày, hết sau 12 giờ không dùng, lưu `sid` | Xem cấu hình phiên |
| 7 | Endpoint back-channel đúng chuẩn | Bộ kiểm tự động bước 4 |
| 8 | Đăng xuất: thu hồi phiên riêng rồi chuyển tới VC ID | Ca đăng xuất chung |
| 9 | Đã ánh xạ mọi vai trò khai ở VH-APP-02 | Chủ app xác nhận |
| 10 | Nhận sự kiện có kiểm chữ ký, bỏ qua sự kiện trùng, có kéo dự phòng (VH-INT-03, VH-INT-05) | Bộ kiểm tự động bước 4 |
| 11 | Đọc hồ sơ và cơ cấu qua API bằng token máy, đúng mức dữ liệu nhân sự đã duyệt (C0 hoặc C1); không giữ màn sửa hồ sơ hay cây tổ chức riêng (VH-BR-03) | Xem màn của app; xem lý do nếu xin C1 |
| 12 | Có thanh chuyển app (VH-HOM-05) | Thử tay |
| 13 | Không đưa dữ liệu C2, C3 vào token, log hay sự kiện | Xem mẫu log và dữ liệu |
| 14 | Đã đặt chủ app và thời gian chuyển tiếp | Xem VH-MH-15 |

**Tiêu chí nghiệm thu:**
1. App chưa đủ 14 mục: nút chuyển sang `beta` hoặc `live` bị khoá; gọi thẳng API thì nhận lỗi đúng câu chữ.
2. Endpoint back-channel trả `200` với token sai: bộ kiểm tự động báo "không đạt" đúng câu chữ.
3. Một app mẫu (ví dụ VCsale) đi hết quy trình trên staging trong ≤ 5 ngày làm việc kể từ khi đội app báo sẵn sàng.
4. Client mới trên VC ID: PKCE S256 bắt buộc, tắt luồng implicit và direct grant, URL trả về không có `*` (kiểm cấu hình tự động).

### VH-APP-05 — Vai trò nhạy cảm

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | Chủ app, quản trị hệ thống (đánh dấu); người duyệt; kiểm soát (theo dõi) |
| Mô tả | Một số vai trò cho xem hoặc làm nhiều hơn hẳn người thường, ví dụ đọc nội dung chat với khách hay quản trị app. Các vai trò này được đánh dấu "Nhạy cảm": xin phải thêm chủ app duyệt, và được theo dõi riêng trong báo cáo và rà soát. |
| Điều kiện trước | Vai trò đã khai (VH-APP-02). |
| Xử lý chính | 1. Khi khai hoặc sửa vai trò, chọn "Nhạy cảm" và ít nhất một tiêu chí: (a) xem dữ liệu của nhiều đơn vị hoặc toàn công ty; (b) đọc nội dung trao đổi với khách; (c) quản trị app hoặc cấu hình quyền trong app; (d) xuất hàng loạt dữ liệu khách hoặc nhân viên; (e) duyệt tiền, giá, công nợ; (f) xem nhật ký của người khác.<br>2. Tác động:<br>• Từ GĐ D: yêu cầu quyền cần thêm bước 2 của chủ app (VH-BR-12); người xin là chủ app thì bước 2 là quản trị hệ thống.<br>• Nhãn đỏ "Nhạy cảm" ở VH-MH-04, 05, 08, 15, 16, 17.<br>• Báo cáo truy cập (VH-ADM-02) tách riêng số người giữ vai trò nhạy cảm theo từng app.<br>• Mọi lần cấp, gỡ vai trò nhạy cảm được báo cho kiểm soát.<br>• Đợt rà soát (VH-REV-01) liệt kê quyền ngoại lệ nhạy cảm lên đầu.<br>3. Đổi từ không sang có: quyền đang có giữ nguyên; yêu cầu mới đi luồng hai bước; báo chủ app và kiểm soát.<br>4. Đổi từ có sang không: chỉ quản trị hệ thống làm, lý do bắt buộc; báo chủ app và kiểm soát.<br>5. VH-MH-17 có danh sách mọi vai trò nhạy cảm của mọi app, kèm số người giữ, cho quản trị hệ thống và kiểm soát. |
| Ngoại lệ, thông báo lỗi | "Chọn ít nhất một tiêu chí nhạy cảm."<br>"Chỉ quản trị hệ thống bỏ được đánh dấu nhạy cảm."<br>"Nhập lý do bỏ đánh dấu nhạy cảm." |
| Dữ liệu | `app_roles` (nhạy cảm, tiêu chí); `access_requests`, `approval_steps` (GĐ D); `audit_log`; `notifications`. |
| Quy tắc | VH-BR-12, VH-BR-17, VH-BR-18, VH-BR-25 |
| Màn hình | VH-MH-15, VH-MH-04, VH-MH-05, VH-MH-08, VH-MH-16, VH-MH-17 |
| Phụ thuộc | VH-APP-02, VH-APP-03, VH-REQ-02, VH-REV-01, VH-ADM-02. |

**Tiêu chí nghiệm thu:**
1. (GĐ D) Yêu cầu `vclinks:quan_sat` (nhạy cảm) có 2 bước duyệt: quản lý trực tiếp rồi chủ app. Yêu cầu `vclinks:nvkd` chỉ có 1 bước.
2. Nhãn "Nhạy cảm" hiện ở mọi màn liệt kê vai trò đó trong danh sách ở bước 2.
3. Chủ app bỏ đánh dấu nhạy cảm: bị chặn. Quản trị hệ thống bỏ có lý do: nhật ký ghi giá trị trước và sau.
4. Đổi một vai trò từ không sang nhạy cảm: không quyền nào đang có bị mất.

### VH-APP-06 — Thời gian chuyển tiếp khi chuyển vị trí, đặt riêng từng app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · C |
| Tác nhân | Quản trị hệ thống (đặt); chủ app (đề xuất); hệ thống (áp) |
| Mô tả | Khi một người chuyển vị trí, quyền mới có ngay, còn quyền cũ có thể giữ thêm vài ngày để bàn giao. Mỗi app tự chọn số ngày, từ 0 tới 7. Ví dụ VClinks đặt 3 ngày để NVKD chuyển sang CSKH kịp bàn giao khách (VH-BR-11). |
| Điều kiện trước | GĐ C đã chạy (quyền theo luật, tính lại quyền). |
| Xử lý chính | 1. Trường "Thời gian chuyển tiếp" của app trên VH-MH-15: số nguyên 0–7 ngày, mặc định 0.<br>2. Áp khi một quyền từ luật không còn thoả vì hồ sơ, cơ cấu hoặc luật đổi. Không áp cho: nghỉ việc (gỡ ngay, VH-BR-14); quyền ngoại lệ (theo hạn riêng); quản trị gỡ tay.<br>3. Quyền chuyển sang trạng thái "Đang chuyển tiếp", có ngày gỡ = ngày hiệu lực của thay đổi + N ngày, gỡ lúc 00:00 ngày đó. Trong thời gian này token vẫn có vai trò, `vh_roles` giữ đơn vị cũ.<br>4. Ô app hiện "Còn {N} ngày" (VH-HOM-03); VH-MH-04 hiện ngày gỡ.<br>5. Tới ngày gỡ: gỡ quyền, đẩy sang VC ID (VH-ACC-07), gửi `vh.grant.removed` cho app.<br>6. Trong thời gian chuyển tiếp mà hồ sơ lại thoả luật (ví dụ huỷ điều chuyển): quyền về "Hiệu lực", bỏ ngày gỡ.<br>7. Đổi N chỉ áp cho lần chuyển tiếp mới; quyền đang chuyển tiếp giữ ngày gỡ cũ.<br>8. N = 0: gỡ ngay ở lần tính lại (≤ 5 phút sau khi thay đổi có hiệu lực).<br>Ví dụ: VClinks N = 3. Một NVKD chuyển sang CSKH hiệu lực 01/12: có `cskh` từ 00:00 01/12; giữ `nvkd` tới hết 03/12; mất `nvkd` lúc 00:00 04/12. |
| Ngoại lệ, thông báo lỗi | "Thời gian chuyển tiếp từ 0 đến 7 ngày." |
| Dữ liệu | `apps` (thời gian chuyển tiếp); `access_grants` (trạng thái, ngày gỡ); `event_outbox`; `audit_log`. |
| Quy tắc | VH-BR-09, VH-BR-11, VH-BR-14, VH-BR-22 |
| Màn hình | VH-MH-15, VH-MH-02, VH-MH-04 |
| Phụ thuộc | VH-ACC-02, VH-ACC-06, VH-ACC-07, VH-HOM-03, VH-LCM-02, VH-INT-03. |

**Tiêu chí nghiệm thu:**
1. Ví dụ VClinks N = 3 ở trên chạy đúng: `nvkd` bị gỡ trong khoảng 00:00–00:05 ngày 04/12; có 1 sự kiện `vh.grant.removed` gửi VClinks.
2. App có N = 0: vai trò cũ bị gỡ trong ≤ 5 phút sau khi thay đổi có hiệu lực.
3. Nhập 8: bị chặn đúng câu chữ.
4. Người đang chuyển tiếp thì nghỉ việc: mọi quyền bị gỡ lúc 00:00 ngày nghỉ, không chờ hết N ngày.
5. Đổi N của VClinks từ 3 xuống 0 khi có người đang chuyển tiếp: người đó vẫn giữ quyền tới ngày gỡ cũ.

## 6. ACC — Cấp và gỡ quyền

Phân hệ ACC giữ bảng quyền `access_grants`: ai có vai trò gì trong app nào, tại đơn vị nào, nhờ nguồn nào. Mọi thay đổi quyền đi qua một bộ tính chung (VH-ACC-02), rồi được đẩy sang VC ID (VH-ACC-07) và gửi sự kiện cho app (VH-INT-03).

### Quy ước chung cho mục 6–12

- **Dòng quyền:** một dòng `access_grants` là **một nguồn** của một quyền: (nhân viên, app, vai trò, đơn vị phạm vi, nguồn). Nguồn là `luat`, `yeu_cau` hoặc `khan_cap` (VH-BR-09). Đơn vị phạm vi là đơn vị app dùng để tính phạm vi dữ liệu (VH-BR-08, VH-BR-24); vai trò không gắn đơn vị (`app_roles.unit_scoped = false`) thì để trống.
- **Quyền hiệu lực:** bộ (app, vai trò, đơn vị) có ít nhất một dòng ở trạng thái Hiệu lực hoặc Chuyển tiếp. Token, lưới app, VH-API-06 và sự kiện chỉ nói về quyền hiệu lực, không nói về từng dòng.
- **Trạng thái dòng quyền** (05 mục 4.2): Chờ hiệu lực (`cho_hieu_luc`) → Hiệu lực (`hieu_luc`) → Chuyển tiếp (`chuyen_tiep`, chỉ nguồn luật) → Đã gỡ (`da_go`); hoặc Hiệu lực → Hết hạn (`het_han`, nguồn yêu cầu và khẩn cấp).
- **Sự kiện quyền:** `vh.grant.added` khi một quyền hiệu lực xuất hiện; `vh.grant.removed` khi nó biến mất. Thêm hay bớt một nguồn mà quyền hiệu lực không đổi thì không sinh sự kiện.
- **Job hẹn giờ quyền:** chạy mỗi 15 phút, có từ GĐ C. GĐ C làm: bật dòng Chờ hiệu lực khi tới ngày; gỡ dòng hết chuyển tiếp; chuyển quyền khẩn cấp quá hạn sang Hết hạn. GĐ D thêm: quyền theo yêu cầu hết hạn (VH-ACC-05), nhắc và tự huỷ yêu cầu (VH-REQ-04), nhắc gia hạn (VH-REQ-06). Job idempotent (chạy lại nhiều lần trên cùng dữ liệu cho cùng kết quả): dừng rồi chạy lại thì làm bù, không làm hai lần.
- **Thông báo:** GĐ C gửi email. Từ GĐ D thêm thông báo trong VC Home (VH-HOM-08, collection `notifications`).
- **Nhật ký:** mọi thao tác trong mục 6–12 ghi `audit_log` theo VH-ADM-01. Từng yêu cầu không nhắc lại.
- **Giờ:** mọi mốc giờ là giờ Việt Nam (VH-BR-22). "00:00 ngày X" là đầu ngày X.
- **Tên trạng thái** của nhân viên theo 05 mục 4.1: Chưa vào làm (`chua_vao_lam`), Đang làm (`dang_lam`), Nghỉ dài ngày (`nghi_dai_ngay`), Tạm khoá (`tam_khoa`), Đã nghỉ (`da_nghi`).

### VH-ACC-01 — Luật cấp quyền mặc định theo hồ sơ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | Quản trị hệ thống (soạn luật cho mọi app); chủ app (soạn luật cho app mình); người duyệt thứ hai khi luật lớn (VH-BR-25); hệ thống (áp luật) |
| Mô tả | Luật nói: "ai có các thuộc tính X thì có vai trò R trong app A". Luật chỉ dựa trên thuộc tính hồ sơ, không nhắm một người cụ thể. Quyền sinh ra từ luật là quyền mặc định, không có hạn. Luật được đánh giá trên mọi vị trí còn hiệu lực, cả vị trí chính lẫn kiêm nhiệm. |
| Điều kiện trước | App ở trạng thái `live`. Vai trò app đã khai và đang dùng (VH-APP-02). Người soạn có vai trò `vchome:qtht`, hoặc là chủ app của app đó (VH-APP-03). |
| Xử lý chính | 1. Ở VH-MH-16 bấm "Thêm luật". Nhập: tên luật (bắt buộc, ≤ 120 ký tự, ví dụ "NVKD các tổ bán hàng VCparts"), mô tả, app, vai trò app.<br>2. Thêm điều kiện. Mỗi điều kiện = thuộc tính + toán tử + giá trị. Các điều kiện nối bằng **VÀ**: vị trí phải thoả hết. Trong một điều kiện được chọn nhiều giá trị (thoả một trong các giá trị là được). Muốn "hoặc" giữa hai thuộc tính khác nhau thì tạo hai luật.<br>3. Thuộc tính dùng được (VH-BR-10): pháp nhân, division, đơn vị, chức danh, chức năng, loại nhân viên, nơi làm việc, là quản lý, là trưởng đơn vị. Không có thuộc tính email, mã nhân viên, họ tên.<br>4. Toán tử:<br>  - "thuộc" (in): giá trị nằm trong danh sách đã chọn;<br>  - "không thuộc" (not in): giá trị không nằm trong danh sách;<br>  - "thuộc cây" (under): chỉ cho đơn vị, nghĩa là đơn vị đã chọn và mọi đơn vị con, cháu của nó;<br>  - "là quản lý", "là trưởng đơn vị" chỉ có giá trị Có hoặc Không.<br>5. Cách lấy thuộc tính khi đánh giá một vị trí:<br>  - đơn vị, chức danh, chức năng: theo vị trí;<br>  - division, pháp nhân: theo đơn vị của vị trí (`org_units.division_code`, `legal_entity_code`);<br>  - loại nhân viên, nơi làm việc: theo hồ sơ;<br>  - là quản lý: có ít nhất 1 vị trí còn hiệu lực ghi người này là quản lý trực tiếp (`people.is_manager`);<br>  - là trưởng đơn vị: người này là trưởng của đơn vị của vị trí, hoặc của một đơn vị con trực tiếp của nó (VH-BR-06 cho phép trưởng đặt vị trí ở đơn vị cha).<br>6. Đơn vị của quyền (cách gắn đơn vị):<br>  - mặc định "theo vị trí": đơn vị của vị trí thoả luật;<br>  - riêng điều kiện "là trưởng đơn vị = Có": đơn vị người đó làm trưởng; làm trưởng nhiều đơn vị thì mỗi đơn vị một dòng quyền;<br>  - vai trò cấp division hoặc toàn tập đoàn: chọn "division của vị trí" hoặc "đơn vị cố định" (05 mục 3.9, `unit_binding`).<br>7. Bấm "Lưu nháp". Hệ thống kiểm (xem cột Ngoại lệ). Luật ở trạng thái Nháp (`nhap`).<br>8. Bấm "Xem trước" (VH-ACC-03), rồi "Áp dụng":<br>  - tác động ≤ 20 người: luật chuyển Hiệu lực (`hieu_luc`) ngay;<br>  - tác động > 20 người: luật chuyển Chờ duyệt (`cho_duyet`), báo người duyệt thứ hai (VH-BR-25). Người duyệt thứ hai là một quản trị hệ thống khác người soạn, hoặc một chủ app của app đó.<br>9. Luật chuyển Hiệu lực thì kích hoạt tính lại quyền (VH-ACC-02) cho người bị ảnh hưởng.<br>10. Sửa luật đang Hiệu lực: lưu thành bản nháp mới; bản đang chạy vẫn áp cho tới khi bản mới được áp, khi đó `version` tăng 1.<br>11. Tắt luật: đi cùng đường xem trước và duyệt như thêm luật; luật chuyển Tắt (`tat`). Luật Tắt không xoá, vẫn tra cứu được.<br>12. Người duyệt từ chối thì luật về Nháp, kèm ý kiến. |
| Ngoại lệ, thông báo lỗi | - Không có điều kiện: "Luật phải có ít nhất một điều kiện. Muốn cấp cho mọi người, hãy chọn điều kiện 'Loại nhân viên thuộc' với đủ các loại."<br>- Gửi thuộc tính email hay mã nhân viên qua API: "Luật không được dùng email hay mã nhân viên. Người cần ngoại lệ hãy gửi yêu cầu quyền."<br>- Vai trò ngừng: "Vai trò {vai trò} của {app} đã ngừng dùng, không dùng trong luật được."<br>- Không phải chủ app: "Bạn chỉ soạn được luật cho app mình làm chủ."<br>- Trùng: "Luật này trùng với luật {tên luật}: cùng điều kiện và cùng vai trò."<br>- Tự mâu thuẫn (cùng giá trị vừa "thuộc" vừa "không thuộc"): "Điều kiện {thuộc tính} tự mâu thuẫn, luật sẽ không khớp ai."<br>- Giá trị đã ngừng (đơn vị Ngừng, chức danh ngừng dùng): "{giá trị} đã ngừng dùng. Hãy chọn giá trị khác."<br>- Vai trò gắn đơn vị mà chưa chọn cách gắn: "Vai trò này gắn với đơn vị. Hãy chọn cách gắn đơn vị cho quyền."<br>- Người soạn bấm duyệt luật của mình: "Bạn là người soạn luật này nên không duyệt được." |
| Dữ liệu | `access_rules`: `app_key`, `role_key`, `name`, `conditions`, `unit_binding`, `status`, `version`, `preview`, `needs_second_approval`, `submitted_by`, `approved_by`, `approved_at`, `activated_at`, `deactivated_at`, `next_review_on`. Đọc `people`, `positions`, `org_units`, `job_titles`, `job_functions`, `legal_entities`, `work_locations`, `app_roles`. |
| Quy tắc | VH-BR-08, VH-BR-09, VH-BR-10, VH-BR-17, VH-BR-24, VH-BR-25 |
| Màn hình | VH-MH-16 |
| Phụ thuộc | VH-APP-02, VH-APP-03, VH-ORG-01, VH-ORG-02, VH-ORG-03, VH-ORG-07, VH-NSU-02, VH-ACC-02, VH-ACC-03; quy trình VH-QT-10 |

**Tiêu chí nghiệm thu:**
1. Luật "chức năng thuộc {CSKH} VÀ đơn vị thuộc cây {VCservice}" → VClinks · `cskh`: người có vị trí kiêm nhiệm CSKH ở một tổ con của VCservice nhận quyền với đơn vị = tổ đó; người CSKH ở VCparts không nhận.
2. Màn soạn luật không có thuộc tính email, mã nhân viên, họ tên; gọi API với thuộc tính `email` bị từ chối đúng câu lỗi.
3. Chủ app VCwiki không tạo được luật cho VClinks.
4. Luật làm thay đổi quyền của 21 người chuyển Chờ duyệt, chưa ai có quyền cho tới khi người thứ hai duyệt; luật ảnh hưởng 20 người áp ngay.
5. Sửa một luật đang Hiệu lực: trong lúc bản mới còn nháp, quyền theo bản cũ không đổi.
6. Người làm trưởng 2 đơn vị khớp luật "là trưởng đơn vị = Có" có 2 dòng quyền, mỗi dòng một đơn vị.

### VH-ACC-02 — Tính lại quyền khi hồ sơ, cơ cấu hoặc luật đổi

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | Hệ thống; quản trị hệ thống (bấm tính lại tay) |
| Mô tả | Mỗi khi dữ liệu đầu vào của luật đổi, hệ thống tính lại quyền mặc định của người bị ảnh hưởng, chậm nhất 5 phút (VH-BR-11). Quyền mới có ngay. Quyền mất còn dùng trong thời gian chuyển tiếp của app rồi mới bị gỡ. Bộ tính idempotent: chạy lại trên cùng dữ liệu không tạo, không gỡ thêm dòng nào. Bộ tính chỉ đụng dòng nguồn luật; quyền ngoại lệ không bị tính lại. |
| Điều kiện trước | Có ít nhất một luật Hiệu lực. |
| Xử lý chính | **Khi nào tính lại, tính cho ai:**<br>1. Hồ sơ đổi có hiệu lực (loại nhân viên, nơi làm việc, trạng thái): người đó.<br>2. Vị trí đổi có hiệu lực (mở, đóng vị trí chính hoặc kiêm nhiệm; đổi quản lý): người đó; cộng quản lý cũ và quản lý mới, vì thuộc tính "là quản lý" có thể đổi.<br>3. Cơ cấu đổi có hiệu lực (chuyển cha, gộp, ngừng đơn vị; đổi trưởng đơn vị; đổi division hoặc pháp nhân của nhánh): mọi người có vị trí trong cây con của đơn vị; cộng trưởng cũ và trưởng mới. Đổi tên đơn vị không cần tính lại.<br>4. Luật chuyển Hiệu lực, được sửa hoặc bị Tắt: mọi người thoả điều kiện cũ hoặc điều kiện mới.<br>5. Lần chạy an toàn hằng ngày lúc 00:05: mọi nhân viên.<br>6. Quản trị hệ thống bấm "Tính lại" cho một người (VH-MH-17) hoặc toàn bộ (VH-MH-16).<br>**Thuật toán cho một người** (khoá theo từng người: không chạy song song hai lần cho cùng một người):<br>7. Lập tập mong muốn D:<br>  - trạng thái Đã nghỉ: D rỗng;<br>  - trạng thái Chưa vào làm: tính trên vị trí sẽ có hiệu lực ngày vào làm, các dòng tạo ra ở trạng thái Chờ hiệu lực, `valid_from` = 00:00 ngày vào làm;<br>  - Đang làm, Nghỉ dài ngày, Tạm khoá: với mỗi vị trí còn hiệu lực, với mỗi luật Hiệu lực, nếu vị trí thoả mọi điều kiện thì thêm (app, vai trò, đơn vị, luật) vào D, ghi kèm vị trí khớp.<br>8. Lấy tập hiện có C = các dòng nguồn luật đang mở (Chờ hiệu lực, Hiệu lực, Chuyển tiếp) của người đó.<br>9. Có trong D, chưa có trong C: tạo dòng nguồn luật, Hiệu lực ngay (`valid_from` = bây giờ). Nếu quyền hiệu lực (app, vai trò, đơn vị) trước đó chưa có thì sinh `vh.grant.added`.<br>10. Có trong D, đang Chuyển tiếp trong C: trở lại Hiệu lực, xoá `transition_until`. Không sinh sự kiện.<br>11. Có trong C, không còn trong D:<br>  - app có thời gian chuyển tiếp 0 ngày: gỡ ngay;<br>  - app có N ngày (1–7, VH-APP-06): chuyển Chuyển tiếp, `transition_until` = lúc mất luật + N ngày; ô app hiện "Còn N ngày". Job hẹn giờ quyền gỡ khi tới giờ.<br>  - Lý do gỡ: `luat_tat` nếu do luật tắt hoặc sửa; `khong_con_thoa_luat` nếu do hồ sơ, vị trí, cơ cấu đổi.<br>12. Vai trò sinh ra bị xung đột tách nhiệm với vai trò người đó đang giữ (VH-BR-17, 02 mục 6, VH-ADM-03): không tạo dòng; ghi vào danh sách "bị chặn tách nhiệm"; báo quản trị hệ thống một lần cho mỗi cặp (người, vai trò) cho tới khi hết xung đột.<br>13. Có thay đổi quyền hiệu lực: đưa người vào hàng đợi đẩy sang VC ID (VH-ACC-07) và ghi sự kiện vào `event_outbox` **trong cùng giao dịch** với thay đổi dòng quyền.<br>14. Ghi nhật ký mỗi dòng tạo, đổi trạng thái, gỡ; kèm nguồn kích hoạt (ví dụ `job:recompute`, mã thay đổi hẹn, mã luật).<br>**Lần chạy an toàn 00:05:** chạy sau khi job áp thay đổi hẹn ngày đã áp các thay đổi của 00:00 (VH-BR-07, 05 mục 5.2). Nếu thấy chênh lệch mà các lần tính theo sự kiện bỏ sót: sửa như bước 9–11, ghi nhật ký "phát hiện bởi lần chạy an toàn", và cảnh báo vận hành (VH-ADM-04).<br>**Thời gian:** 1 người ≤ 5 giây; cả công ty (1.000 người, 100 luật) ≤ 5 phút (VH-NFR-13). |
| Ngoại lệ, thông báo lỗi | - Hàng đợi tính lại tồn quá 5 phút: cảnh báo vận hành "Tính lại quyền chậm: {n} người chờ quá 5 phút."<br>- Lỗi giữa chừng cho một người: huỷ toàn bộ thay đổi của người đó (giao dịch), thử lại 3 lần, rồi ghi lỗi và cảnh báo. Không để một người ở trạng thái nửa vời.<br>- Bấm tính lại toàn bộ khi đang có lần chạy khác: "Đang có lần tính lại toàn bộ chạy từ {HH:mm}. Hãy chờ xong."<br>- Bị chặn tách nhiệm: báo quản trị hệ thống "Quyền {app} · {vai trò} của {mã NV} bị chặn vì xung đột với {vai trò khác} (VH-BR-17)." |
| Dữ liệu | Đọc `people`, `positions`, `org_units`, `access_rules`, `apps.transition_days`. Ghi `access_grants` (`status`, `valid_from`, `transition_until`, `rule_id`, `rule_version`, `position_id`, `removed_reason`, `removed_at`, `removed_by`), `event_outbox`, `audit_log`. |
| Quy tắc | VH-BR-07, VH-BR-09, VH-BR-11, VH-BR-15, VH-BR-17, VH-BR-22, VH-BR-24 |
| Màn hình | VH-MH-16, VH-MH-17; kết quả hiện ở VH-MH-02 (ô "Còn N ngày") và VH-MH-04 |
| Phụ thuộc | VH-ACC-01, VH-APP-06, VH-NSU-02, VH-NSU-03, VH-NSU-04, VH-ORG-04, VH-ORG-05, VH-ACC-07, VH-INT-03 |

**Tiêu chí nghiệm thu:**
1. Đổi chức năng một người từ Bán hàng sang CSKH, hiệu lực 00:00 ngày 10/03, VClinks đặt chuyển tiếp 3 ngày: trước 00:05 ngày 10/03 người đó có VClinks · `cskh`; VClinks · `nvkd` chuyển Chuyển tiếp và bị gỡ trong khoảng 00:00–00:15 ngày 13/03.
2. Chạy tính lại toàn bộ hai lần liên tiếp không đổi dữ liệu: lần hai không tạo, không gỡ dòng nào và không sinh sự kiện.
3. Người có VClinks · `cskh` từ cả luật và yêu cầu đã duyệt: tắt luật thì không có `vh.grant.removed`; quyền vẫn hiệu lực tới hạn của yêu cầu.
4. Chuyển một tổ từ VCservice sang VCparts (VH-ORG-05): mọi người trong tổ được tính lại; luật "đơn vị thuộc cây VCservice" không còn khớp với họ.
5. Xoá tay một dòng quyền luật trong database thử rồi chờ 00:05: lần chạy an toàn tạo lại dòng đó và phát cảnh báo.
6. Người đổi chức năng rồi đổi lại trong thời gian chuyển tiếp: giữ quyền cũ liên tục, không có `vh.grant.removed`.

### VH-ACC-03 — Xem trước tác động của luật

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C (nâng từ S khi soát chéo: VH-BR-25 bắt buộc xem trước) |
| Tác nhân | Người soạn luật (quản trị hệ thống, chủ app); người duyệt thứ hai |
| Mô tả | Trước khi áp, sửa hay tắt một luật, người soạn thấy chính xác ai được thêm quyền, ai mất quyền. Luật làm thay đổi quyền của trên 20 người thì bắt buộc xem trước và chờ người thứ hai duyệt (VH-BR-25). Xem trước không ghi gì vào bảng quyền. |
| Điều kiện trước | Luật ở trạng thái Nháp (thêm, sửa) hoặc Hiệu lực (khi tắt). |
| Xử lý chính | 1. Bấm "Xem trước". Với mọi người Chưa vào làm, Đang làm, Nghỉ dài ngày, Tạm khoá, hệ thống tính hai tập quyền mặc định bằng chính bộ tính của VH-ACC-02: tập hiện tại, và tập nếu thay đổi này được áp.<br>2. So hai tập theo quyền hiệu lực (app, vai trò, đơn vị), có tính cả quyền ngoại lệ người đó đang có.<br>3. Kết quả gồm:<br>  a. Số đếm: người được thêm quyền; người mất quyền; người không đổi quyền hiệu lực nhưng đổi nguồn. Tổng người bị ảnh hưởng = số người được thêm hoặc mất (một người vừa thêm vừa mất chỉ đếm một lần).<br>  b. Danh sách "Được thêm": mã NV, họ tên, đơn vị chính, quyền thêm (app · vai trò · đơn vị), vị trí khớp.<br>  c. Danh sách "Mất": như trên, kèm lúc mất thật (ví dụ "mất sau 3 ngày chuyển tiếp, ngày 13/03"), hoặc dòng "vẫn giữ nhờ quyền ngoại lệ đến dd/mm/yyyy" (không tính vào "Mất").<br>  d. Danh sách "Bị chặn tách nhiệm" nếu có.<br>  e. Gom theo đơn vị cấp phòng; lọc, tìm; tải Excel đủ cột như màn.<br>4. Tổng người bị ảnh hưởng > 20: nút "Áp dụng" đổi thành "Gửi duyệt". Ảnh chụp kết quả (số đếm, danh sách, lúc tính, người tính) lưu kèm luật.<br>5. Người duyệt thứ hai mở luật thấy cùng ảnh chụp. Lúc bấm "Duyệt", hệ thống tính lại; nếu số người hoặc danh sách khác ảnh chụp thì hiện phần chênh và yêu cầu xác nhận lại.<br>6. Thời gian tính ≤ 10 giây với 1.000 nhân viên. |
| Ngoại lệ, thông báo lỗi | - Dữ liệu đổi từ lúc xem trước: "Số người bị ảnh hưởng đã đổi từ {a} thành {b} kể từ lúc soạn. Xem phần chênh trước khi duyệt."<br>- Ảnh chụp cũ quá 7 ngày: "Kết quả xem trước đã cũ hơn 7 ngày. Hãy xem trước lại."<br>- Không ai bị ảnh hưởng: "Luật này hiện không thay đổi quyền của ai." (vẫn cho áp)<br>- Từ chối: người duyệt phải ghi ý kiến ≥ 10 ký tự; người soạn nhận "Luật {tên} bị từ chối: {ý kiến}." |
| Dữ liệu | `access_rules.preview` (`at`, `add_count`, `remove_count`, `by`, cộng ảnh chụp danh sách), `needs_second_approval`, `approved_by`, `approved_at`. Đọc như VH-ACC-02. |
| Quy tắc | VH-BR-11, VH-BR-17, VH-BR-25 |
| Màn hình | VH-MH-16 |
| Phụ thuộc | VH-ACC-01, VH-ACC-02 (dùng chung bộ tính); VH-QT-10 |

**Tiêu chí nghiệm thu:**
1. Luật mới khớp 35 người: số đếm 35, danh sách 35 dòng, nút "Gửi duyệt".
2. Sau khi xem trước, `access_grants` không đổi và không có sự kiện nào.
3. Tắt một luật: người có cùng quyền từ yêu cầu đã duyệt hiện "vẫn giữ nhờ quyền ngoại lệ đến …" và không tính vào "Mất".
4. Thêm 3 người vào đơn vị sau khi gửi duyệt: lúc duyệt hiện chênh "35 → 38" và tên 3 người mới.
5. Tệp Excel tải về có đủ cột và đúng số dòng như màn.

### VH-ACC-04 — Cấp quyền khẩn cấp có lý do và hạn tối đa 7 ngày

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · C |
| Tác nhân | Quản trị hệ thống (cấp); người nhận; chủ app, quản lý trực tiếp, kiểm soát (được báo) |
| Mô tả | Khi có việc gấp (sự cố, thay người đột xuất) mà không chờ duyệt được, quản trị hệ thống cấp ngay một vai trò. Bắt buộc ghi lý do; hạn tối đa 7 ngày. Hết hạn thì tự mất; không gia hạn. |
| Điều kiện trước | Người nhận Đang làm hoặc Nghỉ dài ngày; tài khoản không bị khoá. Vai trò app đang dùng. |
| Xử lý chính | 1. Ở VH-MH-17 mở người nhận, bấm "Cấp khẩn cấp".<br>2. Nhập:<br>  - app, vai trò;<br>  - đơn vị phạm vi (mặc định đơn vị vị trí chính);<br>  - lý do (bắt buộc, 20–300 ký tự);<br>  - mã sự cố hoặc phiếu hỗ trợ (tuỳ chọn, ghi trong lý do);<br>  - hết hạn lúc (ngày giờ; mặc định sau 24 giờ; tối đa sau 7 ngày tính từ lúc cấp).<br>3. Hệ thống kiểm: không tự cấp cho mình; chưa có quyền hiệu lực trùng; không xung đột tách nhiệm.<br>4. Vai trò nhạy cảm: hiện thêm hộp xác nhận "Vai trò nhạy cảm. Chủ app và kiểm soát sẽ được báo ngay."<br>5. Lưu: dòng nguồn `khan_cap`, Hiệu lực ngay, `valid_to` đúng giờ đã chọn. Đẩy sang VC ID ưu tiên (≤ 1 phút). Sinh `vh.grant.added` nếu quyền hiệu lực mới xuất hiện.<br>6. Báo người nhận, quản lý trực tiếp của người nhận, mọi chủ app của app đó, nhóm kiểm soát: ai cấp, vai trò, lý do, hết hạn lúc nào.<br>7. Còn 24 giờ tới hạn (nếu thời hạn dài hơn 24 giờ): báo người nhận và người cấp "Quyền khẩn cấp {vai trò} trong {app} hết hạn lúc {HH:mm dd/mm}. Cần dùng tiếp thì gửi yêu cầu quyền."<br>8. Tới giờ hết hạn: job hẹn giờ quyền chuyển dòng sang Hết hạn, chậm nhất 15 phút sau giờ hết hạn. Việc này có từ GĐ C, không chờ VH-ACC-05 ở GĐ D.<br>9. Không gia hạn. Cấp khẩn cấp lần nữa cho cùng người, cùng vai trò trong vòng 30 ngày thì phải ghi lý do mới, và kiểm soát nhận báo riêng "Cấp khẩn cấp lặp lại". |
| Ngoại lệ, thông báo lỗi | - Tự cấp: "Bạn không tự cấp quyền khẩn cấp cho mình được."<br>- Hạn quá 7 ngày: "Quyền khẩn cấp tối đa 7 ngày. Cần lâu hơn hãy gửi yêu cầu quyền."<br>- Thiếu hoặc ngắn lý do: "Hãy ghi lý do cấp khẩn cấp (ít nhất 20 ký tự)."<br>- Đã có: "{họ tên} đã có vai trò {vai trò} trong {app} tại {đơn vị}."<br>- Người nhận đã nghỉ hoặc bị khoá: "Không cấp được: tài khoản của {họ tên} đang bị khoá hoặc đã nghỉ việc."<br>- Tách nhiệm: "Không cấp được: vai trò {vai trò} xung đột tách nhiệm với {vai trò khác} mà {họ tên} đang giữ (VH-BR-17)."<br>- Bấm gia hạn: "Quyền khẩn cấp không gia hạn được. Hãy gửi yêu cầu quyền mới." |
| Dữ liệu | `access_grants` (`source = khan_cap`, `reason`, `valid_from`, `valid_to`, `created_by`), `event_outbox`, `audit_log` (lý do bắt buộc), `notifications` (từ GĐ D) |
| Quy tắc | VH-BR-09, VH-BR-12 (không tự cấp), VH-BR-17, VH-BR-18 |
| Màn hình | VH-MH-17; người nhận xem ở VH-MH-04 |
| Phụ thuộc | VH-ACC-07, VH-APP-05, VH-INT-03, VH-ADM-03 |

**Tiêu chí nghiệm thu:**
1. Cấp khẩn cấp 2 ngày: người nhận đăng nhập lại là vào được app (≤ 1 phút sau khi cấp); chủ app và kiểm soát nhận báo.
2. Nhập hạn 8 ngày bị chặn đúng câu lỗi.
3. Tới giờ hết hạn: quyền mất trong 15 phút; app nhận `vh.grant.removed`.
4. Quản trị hệ thống tự cấp cho mình bị chặn.
5. Nhật ký có lý do, người cấp, hạn; báo cáo cấp khẩn cấp (VH-ADM-02) có dòng này.

### VH-ACC-05 — Quyền có hạn dùng, tự gỡ khi hết hạn

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · D |
| Tác nhân | Hệ thống; người giữ quyền; quản lý trực tiếp (được báo) |
| Mô tả | Mọi quyền ngoại lệ có hạn. Hết hạn thì hệ thống tự kết thúc, không cần ai bấm. Người giữ quyền được báo trước để kịp gia hạn. |
| Điều kiện trước | Dòng quyền nguồn `yeu_cau` hoặc `khan_cap`, có `valid_to`. |
| Xử lý chính | 1. Quyền theo yêu cầu: hạn tính theo ngày, dùng được đến hết ngày cuối; `valid_to` = 00:00 ngày kế tiếp. Ví dụ hạn 31/03 thì `valid_to` = 00:00 01/04. Quyền khẩn cấp: hạn theo ngày giờ (VH-ACC-04).<br>2. Job hẹn giờ quyền (mỗi 15 phút) lấy các dòng Hiệu lực có `valid_to` ≤ bây giờ, chuyển sang Hết hạn (`het_han`), ghi `removed_at`, `removed_by = he_thong`.<br>3. Nếu quyền hiệu lực (app, vai trò, đơn vị) không còn nguồn nào: sinh `vh.grant.removed`, đẩy sang VC ID.<br>4. Job dừng rồi chạy lại thì xử lý bù mọi dòng quá giờ, mỗi dòng đúng một lần.<br>5. Báo trước: 14 ngày (mở gia hạn, VH-REQ-06) và 3 ngày trước hạn, gửi người giữ quyền, chép quản lý trực tiếp. Quyền khẩn cấp báo trước 24 giờ (VH-ACC-04).<br>6. Hết hạn xong: báo người giữ quyền "Quyền {vai trò} trong {app} đã hết hạn ngày {dd/mm/yyyy}. Cần dùng tiếp hãy gửi yêu cầu mới."<br>7. VH-MH-04 hiện hạn của từng quyền; còn ≤ 14 ngày thì có nhãn "Còn N ngày" và nút "Gia hạn".<br>8. Quyền nguồn luật không có hạn, không qua bước này (trừ hết chuyển tiếp, VH-ACC-02). |
| Ngoại lệ, thông báo lỗi | - Job không chạy quá 30 phút: cảnh báo vận hành "Job hẹn giờ quyền không chạy từ {HH:mm}."<br>- Có yêu cầu gia hạn còn chờ lúc tới hạn: vẫn kết thúc đúng hạn và báo "Quyền {vai trò} đã hết hạn trong lúc yêu cầu gia hạn {mã} còn chờ duyệt. Quyền sẽ được cấp lại khi yêu cầu được duyệt." |
| Dữ liệu | `access_grants` (`valid_to`, `status`, `removed_at`, `removed_by`), `event_outbox`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-09, VH-BR-22 |
| Màn hình | VH-MH-04, VH-MH-17 |
| Phụ thuộc | VH-REQ-02 (sinh quyền có hạn), VH-REQ-06, VH-ACC-07, VH-HOM-08 |

**Tiêu chí nghiệm thu:**
1. Quyền hạn 31/03 vẫn dùng được cả ngày 31/03; mất trong khoảng 00:00–00:15 ngày 01/04.
2. Tắt job 2 giờ rồi bật lại: mọi quyền quá hạn trong 2 giờ đó được kết thúc đúng một lần, mỗi quyền một sự kiện.
3. Báo trước 14 ngày và 3 ngày tới đúng người, đúng ngày.
4. Dòng yêu cầu hết hạn trong khi cùng quyền còn nguồn luật: quyền hiệu lực giữ nguyên, không có sự kiện gỡ.

### VH-ACC-06 — Gỡ quyền

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | Quản trị hệ thống (mọi app); chủ app (app mình); trưởng đơn vị (chỉ qua rà soát, VH-REV-02); hệ thống |
| Mô tả | Gỡ là kết thúc một dòng quyền, luôn kèm một lý do trong danh mục cố định. Gỡ tay chỉ áp cho quyền ngoại lệ. Quyền từ luật không gỡ tay từng người, vì lần tính sau sẽ cấp lại; muốn gỡ thì sửa hồ sơ hoặc sửa luật (VH-BR-10). |
| Điều kiện trước | Dòng quyền đang mở (Chờ hiệu lực, Hiệu lực, Chuyển tiếp). |
| Xử lý chính | 1. Ở VH-MH-17 chọn một hoặc nhiều dòng nguồn `yeu_cau`, `khan_cap`, bấm "Gỡ". Ghi lý do (bắt buộc, 10–300 ký tự).<br>2. Gỡ nhiều dòng: tối đa 200 dòng một lần; hộp xác nhận "Gỡ {n} quyền của {k} người? Không hoàn tác được."<br>3. Dòng chuyển Đã gỡ, ghi `removed_at`, `removed_by`, `removed_reason = go_tay`; lý do chữ ghi ở nhật ký.<br>4. Quyền hiệu lực không còn nguồn nào: sinh `vh.grant.removed` (kèm lý do) và đẩy sang VC ID ngay.<br>5. Báo người giữ quyền và quản lý trực tiếp, trừ trường hợp nghỉ việc.<br>6. Dòng Chờ hiệu lực bị huỷ (yêu cầu bị huỷ, người không vào làm): `removed_reason = huy_truoc_hieu_luc`, không sinh sự kiện vì chưa từng hiệu lực.<br>7. Vai trò app chuyển Ngừng (VH-APP-02): không cấp mới; quyền đang có giữ tới khi gỡ (05 mục 3.8). Màn hiện "{n} người đang có vai trò này" và nút "Gỡ hết": gỡ dòng ngoại lệ với `go_tay`; luật của vai trò đó phải được tắt (dòng luật gỡ với `luat_tat`). App chuyển `retired` làm tương tự cho mọi vai trò của app.<br>8. Dòng Đã gỡ, Hết hạn không xoá; giữ 24 tháng để tra cứu (05 mục 7.1). |
| Ngoại lệ, thông báo lỗi | - Gỡ dòng nguồn luật: "Quyền này đến từ luật {tên luật}. Muốn gỡ, hãy sửa hồ sơ của người này hoặc sửa luật."<br>- Chủ app gỡ quyền app khác: "Bạn chỉ gỡ được quyền trong app mình làm chủ."<br>- Thiếu lý do: "Hãy ghi lý do gỡ (ít nhất 10 ký tự)."<br>- Quá 200 dòng: "Mỗi lần gỡ tối đa 200 quyền. Hãy lọc nhỏ lại." |
| Dữ liệu | `access_grants` (`status`, `removed_reason`, `removed_at`, `removed_by`), `event_outbox`, `audit_log` |
| Quy tắc | VH-BR-09, VH-BR-10, VH-BR-14, VH-BR-16, VH-BR-17, VH-BR-18 |
| Màn hình | VH-MH-17; VH-MH-10 (gỡ qua rà soát); VH-MH-15 (ngừng vai trò) |
| Phụ thuộc | VH-ACC-07, VH-INT-03, VH-REV-02, VH-REV-03, VH-LCM-03, VH-APP-02 |

**Danh mục lý do kết thúc một dòng quyền** (theo 05 mục 3.10 và 4.2):

| Mã | Trạng thái sau | Nghĩa | Ai, khi nào | Nguồn áp dụng |
|---|---|---|---|---|
| `khong_con_thoa_luat` | Đã gỡ | Hồ sơ, vị trí hoặc cơ cấu đổi, hết chuyển tiếp | Hệ thống, VH-ACC-02 | Luật |
| `luat_tat` | Đã gỡ | Luật bị tắt hoặc sửa, hết chuyển tiếp | Hệ thống, VH-ACC-02 | Luật |
| `ra_soat` | Đã gỡ | Người rà soát chọn gỡ, hoặc quá 14 ngày không xác nhận | Trưởng đơn vị (VH-REV-02) hoặc hệ thống (VH-REV-03) | Yêu cầu, khẩn cấp |
| `go_tay` | Đã gỡ | Quản trị hệ thống hoặc chủ app gỡ, có lý do | Người | Yêu cầu, khẩn cấp |
| `nghi_viec` | Đã gỡ | Nghỉ việc có hiệu lực | Hệ thống, VH-LCM-03 | Mọi nguồn |
| `huy_truoc_hieu_luc` | Đã gỡ | Dòng Chờ hiệu lực bị huỷ | Hệ thống | Mọi nguồn |
| (không có mã) | Hết hạn | Quá `valid_to` | Hệ thống, VH-ACC-04, VH-ACC-05 | Yêu cầu, khẩn cấp |

**Tiêu chí nghiệm thu:**
1. Gỡ tay một quyền yêu cầu: app nhận `vh.grant.removed` trong 1 phút (p95); nhật ký có lý do.
2. Dòng nguồn luật không có nút "Gỡ"; gọi API thì trả đúng câu lỗi.
3. Chủ app VCwiki không gỡ được quyền VClinks.
4. Ngừng vai trò VClinks · `giam_sat` đang có 12 người: màn hiện 12; bấm "Gỡ hết" thì 12 dòng ngoại lệ Đã gỡ, các luật của vai trò được yêu cầu tắt.
5. Mọi dòng Đã gỡ đều có một mã trong danh mục trên.

### VH-ACC-07 — Đẩy quyền sang VC ID (nhóm, vai trò app)

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | Bộ đồng bộ `vc-provisioner`; VC ID (Keycloak); quản trị hệ thống |
| Mô tả | VC Home là nơi quyết quyền; VC ID chỉ giữ bản sao để đưa vai trò vào token. Bộ đồng bộ đẩy quyền hiệu lực của từng người sang VC ID dưới dạng **client role** (vai trò gắn với client của từng app trên Keycloak) và nhóm `app-<khoá app>`. Đẩy theo thay đổi trong 1 phút, cộng một lần đối chiếu toàn bộ hằng đêm để tìm và sửa chỗ lệch (VH-NFR-18). |
| Điều kiện trước | Mỗi app có client trên VC ID (`apps.oidc_client_id`). Mỗi vai trò app có client role cùng khoá, tạo khi khai vai trò (VH-APP-02). Người đã có tài khoản VC ID gắn với hồ sơ (VH-AUT-08). Cờ `access_push` bật (10, tiêu chí R3). |
| Xử lý chính | 1. Trạng thái mong muốn của một người trên VC ID:<br>  a. client role `<client app>` · `<vai trò>` cho mỗi vai trò có ít nhất một quyền hiệu lực;<br>  b. nhóm `/app-<khoá>` khi có ít nhất một vai trò trong app đó;<br>  c. thuộc tính user `vh_roles_<khoá app>`: JSON danh sách `{role, unit}`, để mapper đưa vào claim `vh_roles` (VH-INT-01);<br>  d. thuộc tính hồ sơ công việc cho claim GĐ B (VH-INT-01; phần này có từ GĐ B).<br>2. Mỗi thay đổi quyền hiệu lực (từ VH-ACC-02, 04, 05, 06, VH-REQ, VH-REV, VH-LCM) đưa người đó vào hàng đợi đẩy. Bộ đồng bộ lấy hàng đợi mỗi 30 giây, đọc trạng thái thật trên VC ID (Admin API), tính chênh, thêm cái thiếu, bỏ cái thừa, ghi `idp_synced_at`. Từ lúc quyền đổi tới lúc VC ID đổi ≤ 1 phút.<br>3. Chỉ quản nhóm `app-*` và client role của app có trong danh mục. Nhóm khác (ví dụ `vc-id-admin`) không đụng.<br>4. Người Tạm khoá hoặc bị khoá khẩn cấp: tài khoản đã khoá trên VC ID; dòng quyền giữ nguyên trong VC Home, không đẩy thêm gì cho tới khi mở khoá (05 mục 4.1).<br>5. Lỗi khi đẩy: thử lại sau 30 giây, 2 phút, 10 phút, 30 phút, rồi mỗi giờ. Lỗi 3 lần liên tiếp hoặc chậm quá 15 phút thì cảnh báo vận hành.<br>6. Đối chiếu toàn bộ hằng đêm (và sau mỗi lần khôi phục VC ID từ bản sao lưu): so mọi user của realm `vc` với VC Home, lập báo cáo lệch 4 loại (bảng dưới). Mục tiêu: 0 lệch (10, tiêu chí R3).<br>7. Chế độ xử lý lệch: "Chỉ báo" trong 2 tuần đầu GĐ C, sau đó "Tự sửa" (VC Home thắng, VH-BR-03). Đổi ở VH-ADM-05.<br>8. Cầu dao an toàn: một lần đẩy hoặc đối chiếu định bỏ quá 50 vai trò, hoặc quá 20% số vai trò đang quản, mà không khớp một thay đổi đã duyệt (luật đã duyệt, nghỉ việc, đợt rà soát), thì dừng, không bỏ gì, cảnh báo. Quản trị hệ thống xem danh sách rồi bấm "Cho chạy tiếp" (ghi nhật ký).<br>9. Lần đăng nhập đầu: khi VH-AUT-08 gắn tài khoản với hồ sơ, VC Home đẩy ngay cho người đó (chờ tối đa 10 giây), rồi VC Home lấy lại token im lặng để lưới app có đủ ô. Mở thẳng một app ở lần đầu có thể gặp "chưa được cấp" trong tối đa 1 phút; trang lỗi của app có nút "Thử lại".<br>10. Chuyển sang GĐ C: bỏ nhóm mặc định `/app-vclinks`, `/app-vcwiki` trong cấu hình realm (ky-thuat mục 5.1.1) khi hết 30 ngày chuyển tiếp của Q-14; từ đó nhóm do bộ đồng bộ quản. Cờ `access_push` tắt thì VC ID giữ nhóm mặc định của GĐ A (quay lui).<br>11. Gỡ vai trò trên VC ID chỉ ảnh hưởng token cấp sau đó. App đang có phiên phải xử lý `vh.grant.removed` để cắt quyền ngay (VH-INT-03). Nghỉ việc thì khoá và đăng xuất (VH-LCM-03). |
| Ngoại lệ, thông báo lỗi | - Người chưa có tài khoản VC ID: không đẩy; tra cứu hiện "Chờ lần đăng nhập đầu".<br>- Client role chưa có trên VC ID: "Vai trò {app}:{vai trò} chưa có trên VC ID. Kiểm tra khai báo vai trò app." kèm cảnh báo.<br>- Cầu dao bật: cảnh báo "Đồng bộ quyền dừng an toàn: định gỡ {n} vai trò ({x}%). Cần quản trị hệ thống xác nhận."<br>- VC ID không trả lời: giữ hàng đợi, thử lại như bước 5; quyền đã đẩy trước đó vẫn hiệu lực (VH-NFR-10). |
| Dữ liệu | `access_grants.idp_synced_at`; `accounts` (`_id` = `sub`, `idp_enabled`, `lock`); `apps.oidc_client_id`; `app_roles`; báo cáo lệch (xem Đề xuất bổ sung về nơi lưu); `audit_log` |
| Quy tắc | VH-BR-03, VH-BR-08, VH-BR-20 |
| Màn hình | VH-MH-17 (thẻ "Lệch VC ID"; trạng thái đẩy của từng người) |
| Phụ thuộc | VH-AUT-08, VH-APP-02, VH-INT-01, VH-ADM-04; ky-thuat mục 5.1.3, 5.6; Q-14 |

**Các loại lệch giữa VC Home và VC ID:**

| Loại | Ví dụ | Xử lý ở chế độ "Tự sửa" |
|---|---|---|
| Thừa trên VC ID | Ai đó thêm tay client role `vclinks` · `giam_sat` trên màn quản trị Keycloak | Bỏ đi, ghi nhật ký, cảnh báo "Có sửa tay trên VC ID" |
| Thiếu trên VC ID | Đẩy lỗi; VC ID khôi phục từ bản sao lưu cũ | Thêm lại |
| Tài khoản chưa gắn hồ sơ còn nhóm app | Tài khoản từ GĐ A còn nhóm `app-vcwiki` | Sau thời gian chuyển tiếp Q-14: bỏ nhóm, báo HC-NS |
| Vai trò lạ | Client role trên VC ID không có trong `app_roles` | Chỉ báo, không tự xoá |

**Tiêu chí nghiệm thu:**
1. Cấp một quyền: trong 1 phút user trên VC ID có client role và nhóm tương ứng; token cấp sau đó có vai trò.
2. Thêm tay một client role trên Keycloak: lần đối chiếu kế tiếp báo lệch "Thừa"; ở chế độ "Tự sửa" thì vai trò bị bỏ.
3. Tắt Keycloak 20 phút rồi bật lại: mọi thay đổi trong lúc tắt được đẩy bù; có cảnh báo chậm quá 15 phút.
4. Giả lập một lần đẩy định gỡ 60 vai trò không do thay đổi đã duyệt: cầu dao dừng, không vai trò nào bị gỡ.
5. Nhóm `vc-id-admin` không bị đụng tới.
6. Nhân viên mới đăng nhập lần đầu từ VC Home thấy đủ ô app ngay ở lần vào đó.

### VH-ACC-08 — Tra cứu "ai có quyền gì", "người này có quyền gì"

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | Quản trị hệ thống; kiểm soát (chỉ đọc); chủ app (app mình); quản lý, trưởng đơn vị (cây dưới quyền, qua VH-MH-09) |
| Mô tả | Hai câu hỏi hay gặp nhất: "người này có quyền gì" và "ai có vai trò này". Thêm câu thứ ba cho kiểm toán: "tại ngày X, ai có quyền gì". Kết quả lọc được, tải Excel được. |
| Điều kiện trước | Người xem có phạm vi theo ma trận quyền (02 mục 3). |
| Xử lý chính | **Xem theo người:**<br>1. Tìm theo họ tên (có hoặc không dấu), mã NV, email; gõ ≥ 2 ký tự; gợi ý tối đa 20 người.<br>2. Hiện thẻ người: mã, họ tên, đơn vị chính, các vị trí, trạng thái, lần đăng nhập cuối.<br>3. Bảng quyền hiệu lực: app, vai trò (đánh dấu nhạy cảm), đơn vị, các nguồn (luật kèm tên luật; yêu cầu kèm mã yêu cầu; khẩn cấp kèm lý do), từ ngày, hạn, trạng thái (Hiệu lực; Chuyển tiếp còn N ngày; Chờ hiệu lực), trạng thái đẩy VC ID.<br>4. Thẻ "Lịch sử": dòng quyền đã kết thúc trong 24 tháng, có lý do. Thẻ "Yêu cầu" (GĐ D): yêu cầu đang chờ và đã xong. Thẻ "Bị chặn tách nhiệm" nếu có.<br>**Xem theo app, vai trò:**<br>5. Lọc: app, vai trò, đơn vị (có hoặc không gồm đơn vị con), nguồn, trạng thái, vai trò nhạy cảm, hạn trước ngày.<br>6. Kết quả: mỗi dòng một người × một quyền; tổng số người, tổng số dòng, đếm theo nguồn.<br>**Xem theo luật:**<br>7. Chọn một luật, thấy danh sách người đang có quyền nhờ luật đó.<br>**Tại một ngày:**<br>8. Chọn "Tại ngày" (trong 24 tháng gần nhất): kết quả dựng lại từ `valid_from` và lúc kết thúc của từng dòng quyền.<br>**Chung:**<br>9. Tải Excel đúng cột và bộ lọc đang xem; mỗi lần tải ghi nhật ký.<br>10. Phạm vi: chủ app chỉ thấy app mình; quản lý, trưởng đơn vị chỉ thấy người trong cây dưới quyền (VH-BR-23), xem ở VH-MH-09.<br>11. Thời gian trả kết quả ≤ 2 giây với 1.000 nhân viên và 20.000 dòng quyền (VH-NFR-14). |
| Ngoại lệ, thông báo lỗi | - Không có kết quả: "Không có ai khớp bộ lọc."<br>- Ngoài phạm vi: "Bạn không có quyền xem quyền của người này."<br>- Ngày ngoài 24 tháng: "Chỉ tra cứu được trong 24 tháng gần nhất." |
| Dữ liệu | Đọc `access_grants`, `people`, `positions`, `access_rules`, `access_requests`, `accounts`; ghi `audit_log` khi tải |
| Quy tắc | VH-BR-17, VH-BR-18, VH-BR-23 |
| Màn hình | VH-MH-17, VH-MH-09 |
| Phụ thuộc | VH-ACC-02, VH-ACC-07, VH-ADM-02 |

**Tiêu chí nghiệm thu:**
1. Tìm "hoa" ra chị Hoa: thấy VClinks · `nvkd` tại tổ bán hàng VCparts và VClinks · `cskh` tại VCservice, mỗi dòng đúng tên luật.
2. Lọc VClinks · `cskh`, đơn vị VCservice gồm đơn vị con: đúng số người như đếm tay trên dữ liệu thử.
3. Tra "tại ngày" 30 ngày trước cho một người đã chuyển vị trí: ra quyền cũ.
4. Chủ app VCwiki không thấy dòng nào của VClinks.
5. Mỗi lần tải Excel có một dòng nhật ký.

## 7. REQ — Xin quyền và duyệt

Đường xin quyền ngoại lệ (VH-QT-08). Trạng thái yêu cầu theo 05 mục 4.3: Nháp → Chờ duyệt bước 1 → (Chờ duyệt bước 2) → Đã duyệt; hoặc Từ chối, Tự huỷ, Người xin huỷ.

### VH-REQ-01 — Gửi yêu cầu quyền

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · D |
| Tác nhân | Nhân viên (xin cho mình); quản lý (xin thay, VH-REQ-05) |
| Mô tả | Người cần thêm vai trò mà luật không cho thì gửi yêu cầu. Yêu cầu nói rõ app, vai trò, đơn vị, lý do và thời hạn. Gửi xong, hệ thống tạo các bước duyệt (VH-REQ-02). |
| Điều kiện trước | Người gửi đã đăng nhập; hồ sơ Đang làm hoặc Nghỉ dài ngày. App `live`; vai trò đang dùng. |
| Xử lý chính | 1. Mở ngăn gửi yêu cầu (VH-MH-05) từ VH-MH-04, từ ô "Có thể xin quyền" (VH-HOM-04), hoặc từ link sâu `?app=<khoá>&role=<vai trò>` mà app đưa ra khi người dùng thiếu quyền.<br>2. Trường nhập:<br>  - App (bắt buộc): app `live` hoặc `beta` có ít nhất một vai trò đang dùng.<br>  - Vai trò (bắt buộc): hiện tên, mô tả; vai trò nhạy cảm có nhãn "Nhạy cảm, cần chủ app duyệt thêm"; vai trò đã có hiệu lực tại đơn vị mặc định thì mờ.<br>  - Đơn vị phạm vi (bắt buộc khi vai trò gắn đơn vị): mặc định đơn vị vị trí chính; chọn được đơn vị khác trong `allowed_unit_types` của vai trò. Chọn đơn vị ngoài các vị trí của mình thì hiện cảnh báo; người duyệt cũng thấy cảnh báo này.<br>  - Thời hạn (bắt buộc): mặc định theo `app_roles.default_request_days` (thường 90 ngày); chọn nhanh 30, 90, 180, 365 ngày hoặc chọn ngày kết thúc; tối đa `max_request_days` (≤ 365).<br>  - Ngày bắt đầu: mặc định hôm nay; hẹn trước tối đa 30 ngày.<br>  - Lý do (bắt buộc, 20–500 ký tự). Dòng nhắc dưới ô: "Làm việc gì, vì sao luật hiện tại chưa đủ. Không ghi thông tin sức khoẻ, lương, giấy tờ tuỳ thân."<br>3. Kiểm khi gửi: chưa có quyền hiệu lực trùng; chưa có yêu cầu đang mở trùng (app, vai trò, đơn vị); không xung đột tách nhiệm; app, vai trò còn dùng.<br>4. Lưu yêu cầu (`kind = moi`), trạng thái Chờ duyệt bước 1, `submitted_at`, `due_at` = gửi + 7 ngày. Tạo bước duyệt (VH-REQ-02); báo người duyệt bước 1.<br>5. Người gửi thấy yêu cầu ở VH-MH-04, thẻ "Yêu cầu của tôi": bước đang chờ, tên người duyệt, lúc tự huỷ.<br>6. Người gửi rút được khi còn chờ duyệt: trạng thái Người xin huỷ; báo người duyệt đang chờ.<br>7. Duyệt xong (VH-REQ-02): tạo dòng quyền nguồn `yeu_cau`. Ngày bắt đầu ở tương lai thì Chờ hiệu lực, ngược lại Hiệu lực. Hạn = ngày bắt đầu + thời hạn − 1 ngày (dùng hết ngày đó, VH-ACC-05). |
| Ngoại lệ, thông báo lỗi | - Đã có: "Bạn đã có vai trò {vai trò} trong {app} tại {đơn vị}." Nếu quyền đó còn ≤ 14 ngày: thêm "Quyền hết hạn ngày {dd/mm}. Bấm Gia hạn thay vì gửi yêu cầu mới."<br>- Trùng yêu cầu: "Bạn đã có yêu cầu {mã} đang chờ duyệt cho vai trò này."<br>- Lý do ngắn: "Hãy ghi lý do ít nhất 20 ký tự để người duyệt hiểu việc cần làm."<br>- Quá hạn tối đa: "Vai trò này cho xin tối đa {n} ngày."<br>- Hẹn quá xa: "Ngày bắt đầu chỉ hẹn trước tối đa 30 ngày."<br>- Tách nhiệm: "Vai trò này xung đột tách nhiệm với vai trò {vai trò} bạn đang giữ (VH-BR-17). Không gửi được."<br>- App hoặc vai trò vừa ngừng: "Vai trò này không còn dùng được. Hãy chọn vai trò khác." |
| Dữ liệu | `access_requests` (`requester_person_id`, `beneficiary_person_id`, `kind`, `app_key`, `role_key`, `unit_code`, `reason`, `requested_days`, `start_on`, `sensitive`, `status`, `submitted_at`, `due_at`, `grant_id`), `approval_steps`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-08, VH-BR-09, VH-BR-12, VH-BR-13, VH-BR-17, VH-BR-19 |
| Màn hình | VH-MH-05, VH-MH-04, VH-MH-02 |
| Phụ thuộc | VH-REQ-02, VH-HOM-04, VH-HOM-08, VH-APP-02, VH-APP-05; VH-QT-08 |

**Tiêu chí nghiệm thu:**
1. Gửi yêu cầu VCwiki · `bien_tap` 90 ngày: yêu cầu ở Chờ duyệt bước 1; quản lý trực tiếp nhận thông báo.
2. Vai trò đã có hiện mờ; gọi API thẳng thì trả đúng câu "Bạn đã có …".
3. Lý do 10 ký tự bị chặn.
4. Rút yêu cầu: trạng thái Người xin huỷ; hộp duyệt của người duyệt không còn yêu cầu này.
5. Yêu cầu bắt đầu 01/04, 30 ngày, được duyệt ngày 25/03: dòng quyền Chờ hiệu lực, có hiệu lực trong 00:00–00:15 ngày 01/04, dùng được hết ngày 30/04.

### VH-REQ-02 — Luồng duyệt: quản lý trực tiếp, thêm chủ app nếu vai trò nhạy cảm

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · D |
| Tác nhân | Quản lý trực tiếp (bước 1); chủ app (bước 2); trưởng đơn vị, quản lý cấp trên, quản trị hệ thống (người thay theo luật chuyển) |
| Mô tả | Bước 1 luôn là quản lý trực tiếp theo vị trí chính của người được cấp. Bước 2 chỉ có khi vai trò nhạy cảm; một trong các chủ app duyệt. Không ai duyệt yêu cầu mà mình là người gửi hoặc người được cấp (VH-BR-12). |
| Điều kiện trước | Yêu cầu Chờ duyệt. |
| Xử lý chính | **Chọn người duyệt bước 1** (đi theo thứ tự, dừng ở người hợp lệ đầu tiên):<br>1. Quản lý trực tiếp trên vị trí chính của người được cấp (`approver_rule = quan_ly_truc_tiep`). Người Chưa vào làm thì theo vị trí sẽ có hiệu lực.<br>2. Không có quản lý, quản lý đã nghỉ hoặc không có tài khoản: trưởng đơn vị của vị trí chính (`truong_don_vi_tam`, VH-BR-05).<br>3. Trưởng đơn vị trống hoặc chính là người được cấp: trưởng đơn vị cha, đi dần lên gốc.<br>4. Lên tới gốc vẫn không có: giao nhóm quản trị hệ thống (`quan_tri_he_thong`) và báo HC-NS "thiếu quản lý" cho người được cấp.<br>5. "Hợp lệ" là: Đang làm; tài khoản không khoá; không phải người gửi; không phải người được cấp. Người bị loại vì trùng người gửi thì chuyển lên quản lý trực tiếp của họ (`quan_ly_cap_tren`, VH-BR-12). Người đang Nghỉ dài ngày thì chuyển lên quản lý của họ, trừ khi có uỷ quyền (VH-REQ-03).<br>**Chọn người duyệt bước 2** (chỉ vai trò nhạy cảm):<br>6. Mọi chủ app của app đó (`chu_app`), trừ người gửi, người được cấp và người đã duyệt bước 1. Ai duyệt trước thì quyết.<br>7. Không còn chủ app hợp lệ (ví dụ chủ app xin cho mình): giao nhóm quản trị hệ thống, trừ người gửi và người được cấp (`quan_tri_he_thong`).<br>**Duyệt:**<br>8. Bước 2 chỉ mở khi bước 1 Duyệt. Yêu cầu chuyển Chờ duyệt bước 2.<br>9. Người duyệt thấy: người được cấp (đơn vị, vị trí, quyền đang có trong app đó, quyền từ luật), lý do, thời hạn, cảnh báo (vai trò nhạy cảm; đơn vị ngoài vị trí của người được cấp; cùng quyền từng bị gỡ ở rà soát).<br>10. Quyết định:<br>  - Duyệt: được rút ngắn thời hạn, không được kéo dài; ý kiến tuỳ chọn.<br>  - Từ chối: ý kiến bắt buộc, 10–500 ký tự.<br>11. Từ chối ở bước nào thì yêu cầu kết thúc Từ chối; báo người gửi và người được cấp kèm ý kiến.<br>12. Bước cuối Duyệt: yêu cầu Đã duyệt; tạo dòng quyền (VH-REQ-01 bước 7); đẩy VC ID; sinh `vh.grant.added` khi quyền bắt đầu hiệu lực; báo người gửi, người được cấp.<br>13. Đổi người duyệt khi đang chờ: quản lý của người được cấp đổi, người duyệt nghỉ việc hoặc bắt đầu Nghỉ dài ngày thì bước đang chờ chuyển sang người mới theo bước 1–7. Đồng hồ 7 ngày không đặt lại. Báo người duyệt mới.<br>14. Người được cấp nghỉ việc: yêu cầu chuyển Tự huỷ, các bước đang chờ `huy`.<br>15. Lúc bấm quyết định, hệ thống kiểm lại người bấm còn là người duyệt hợp lệ. |
| Ngoại lệ, thông báo lỗi | - Không còn là người duyệt: "Bạn không còn là người duyệt của yêu cầu này. Yêu cầu đã chuyển cho {họ tên}."<br>- Người khác đã quyết: "Yêu cầu này đã được {họ tên} {duyệt / từ chối} lúc {HH:mm dd/mm}."<br>- Kéo dài thời hạn: "Người duyệt chỉ rút ngắn được thời hạn, không kéo dài."<br>- Từ chối không ý kiến: "Hãy ghi lý do từ chối (ít nhất 10 ký tự)."<br>- Yêu cầu đã kết thúc: "Yêu cầu này đã kết thúc ({trạng thái})." |
| Dữ liệu | `approval_steps` (`request_id`, `step`, `approver_rule`, `assigned_person_ids`, `decision`, `decided_by_person_id`, `on_behalf_of_person_id`, `delegation_id`, `comment`, `decided_at`), `access_requests`, `access_grants`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-05, VH-BR-12, VH-BR-13, VH-BR-17, VH-BR-23 |
| Màn hình | VH-MH-08 |
| Phụ thuộc | VH-REQ-01, VH-REQ-03, VH-NSU-03, VH-ORG-04, VH-APP-03, VH-APP-05, VH-ACC-07 |

**Tiêu chí nghiệm thu:**
1. Vai trò thường: một bước; quản lý trực tiếp duyệt xong là có quyền.
2. Vai trò nhạy cảm: hai bước; bước 2 chỉ hiện với chủ app sau khi bước 1 duyệt.
3. Quản lý trực tiếp đã nghỉ việc: bước 1 giao trưởng đơn vị; HC-NS nhận cảnh báo thiếu quản lý.
4. Chủ app xin vai trò nhạy cảm của app mình: bước 2 giao quản trị hệ thống.
5. Người duyệt rút 90 xuống 30 ngày: quyền có hạn 30 ngày.
6. Đổi quản lý của người được cấp khi bước 1 đang chờ: bước chuyển cho quản lý mới; quản lý cũ không còn thấy.

### VH-REQ-03 — Uỷ quyền duyệt khi vắng

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Người duyệt (quản lý, chủ app); quản trị hệ thống (đặt hộ khi người duyệt vắng đột xuất) |
| Mô tả | Người duyệt sắp vắng thì uỷ việc duyệt cho người khác trong một khoảng thời gian. Trong khoảng đó, việc duyệt mới và việc đang chờ hiện cho cả hai người. Người được uỷ không duyệt được việc của chính mình. |
| Điều kiện trước | Người uỷ là người duyệt (có người dưới quyền, hoặc là chủ app). |
| Xử lý chính | 1. Ở VH-MH-08, thẻ "Uỷ quyền", bấm "Uỷ quyền duyệt". Nhập:<br>  - người được uỷ (Đang làm, có tài khoản không khoá, không phải mình);<br>  - từ lúc, đến lúc (tối đa 30 ngày);<br>  - phạm vi: bước 1 (quản lý), bước 2 (chủ app, chọn app), hoặc cả hai;<br>  - ghi chú (tuỳ chọn, ví dụ "Đi công tác"; không ghi lý do sức khoẻ).<br>2. Không cho hai uỷ quyền trùng khoảng thời gian của cùng một người uỷ.<br>3. Uỷ quyền không chuyền tiếp: B được A uỷ, B uỷ tiếp cho C thì C chỉ nhận việc của B, không nhận việc của A.<br>4. Từ lúc bắt đầu: việc đang chờ và việc mới của người uỷ (trong phạm vi) hiện ở hộp duyệt của người được uỷ với nhãn "Thay {họ tên người uỷ}". Người uỷ vẫn duyệt được.<br>5. Việc mà người được uỷ là người gửi hoặc người được cấp: không hiện cho người được uỷ; vẫn ở người uỷ. Người uỷ đang Nghỉ dài ngày thì việc đó chuyển lên quản lý của người uỷ.<br>6. Quyết định ghi "Duyệt bởi {B} thay {A} (uỷ quyền {từ}–{đến})" (`on_behalf_of_person_id`, `delegation_id`).<br>7. Báo người được uỷ khi uỷ quyền được tạo và lúc bắt đầu. Hết hạn thì trạng thái Hết hạn; người uỷ huỷ sớm được (Đã huỷ).<br>8. Quản trị hệ thống đặt hộ được khi người duyệt vắng đột xuất; bắt buộc ghi lý do; người uỷ nhận báo.<br>9. Uỷ quyền không áp cho rà soát (VH-REV-02): trách nhiệm rà soát không chuyển. |
| Ngoại lệ, thông báo lỗi | - Uỷ cho mình: "Không uỷ quyền cho chính mình được."<br>- Trùng khoảng: "Bạn đã có uỷ quyền cho {họ tên} từ {dd/mm} đến {dd/mm}. Hãy sửa uỷ quyền đó."<br>- Quá 30 ngày: "Uỷ quyền tối đa 30 ngày."<br>- Người được uỷ không hợp lệ: "{họ tên} không nhận uỷ quyền được (đã nghỉ hoặc tài khoản bị khoá)." Xảy ra giữa chừng thì uỷ quyền tự kết thúc và báo người uỷ. |
| Dữ liệu | `delegations` (`delegator_person_id`, `delegate_person_id`, `scope`, `from_at`, `to_at`, `reason`, `status`, `cancelled_at`), `approval_steps`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-12, VH-BR-17 |
| Màn hình | VH-MH-08 (thẻ Uỷ quyền) |
| Phụ thuộc | VH-REQ-02, VH-HOM-08 |

**Tiêu chí nghiệm thu:**
1. A uỷ B từ 10/01 đến 17/01: ngày 10/01 B thấy cả việc đang chờ và việc mới của A, có nhãn "Thay A".
2. Yêu cầu do chính B gửi không hiện ở hộp duyệt của B.
3. B uỷ tiếp cho C: C không thấy việc của A.
4. Quyết định qua uỷ quyền ghi đủ người duyệt, người được duyệt thay và mã uỷ quyền.

### VH-REQ-04 — Nhắc duyệt và tự huỷ yêu cầu quá hạn

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Hệ thống; người duyệt; người gửi |
| Mô tả | Yêu cầu không được để treo. Hệ thống nhắc người duyệt sau 2 ngày và 5 ngày. Sau 7 ngày chưa duyệt xong thì tự huỷ và báo người gửi (VH-BR-13). |
| Điều kiện trước | Yêu cầu Chờ duyệt bước 1 hoặc bước 2. |
| Xử lý chính | 1. Đồng hồ tính từ `submitted_at`, theo ngày lịch (cả thứ Bảy, Chủ nhật, ngày lễ). Không đặt lại khi chuyển bước hay đổi người duyệt.<br>2. Nhắc lần 1 lúc 08:00 của ngày thứ 2 sau ngày gửi; nhắc lần 2 lúc 08:00 của ngày thứ 5. Ví dụ gửi 15:00 thứ Hai 02/03: nhắc 08:00 04/03 và 08:00 07/03. Gửi cho người duyệt của bước đang chờ và người được uỷ (nếu có).<br>3. Nội dung nhắc: "Yêu cầu {mã} của {họ tên} xin {vai trò} trong {app} đang chờ bạn duyệt. Yêu cầu tự huỷ lúc {HH:mm dd/mm}."<br>4. Tự huỷ: job hẹn giờ (mỗi 15 phút) lấy yêu cầu còn chờ có `due_at` ≤ bây giờ; chuyển Tự huỷ; bước đang chờ `huy`; ghi `cancel` (`by = he_thong`).<br>5. Báo người gửi và người được cấp: "Yêu cầu {mã} đã tự huỷ vì quá 7 ngày chưa duyệt xong. Bạn có thể gửi lại." Nút "Gửi lại" tạo yêu cầu mới điền sẵn.<br>6. Hộp duyệt hiện số ngày còn lại; còn ≤ 2 ngày thì tô màu cảnh báo.<br>7. Báo cáo tháng cho quản trị hệ thống: số yêu cầu tự huỷ theo người duyệt (VH-ADM-02). |
| Ngoại lệ, thông báo lỗi | - Người duyệt bấm đúng lúc job huỷ: lệnh nào ghi trước thì thắng; lệnh sau nhận "Yêu cầu này đã kết thúc (Tự huỷ)."<br>- Email nhắc gửi lỗi: ghi lỗi; thông báo trong VC Home vẫn có. |
| Dữ liệu | `access_requests` (`due_at`, `reminders`, `status`, `cancel`), `approval_steps.decision`, `notifications` |
| Quy tắc | VH-BR-13, VH-BR-22 |
| Màn hình | VH-MH-08, VH-MH-04 |
| Phụ thuộc | VH-REQ-02, VH-REQ-03, VH-HOM-08, VH-ADM-05 |

**Tiêu chí nghiệm thu:**
1. Yêu cầu gửi 15:00 02/03: nhắc lúc 08:00 04/03 và 08:00 07/03; không nhắc thêm.
2. Lúc 15:00–15:15 ngày 09/03 yêu cầu chuyển Tự huỷ; người gửi nhận thông báo đúng câu.
3. Bước 1 duyệt ngày thứ 6: bước 2 vẫn tự huỷ đúng hạn 7 ngày tính từ lúc gửi.
4. Duyệt sau khi đã tự huỷ: báo đúng câu, không có quyền nào được tạo.

### VH-REQ-05 — Quản lý xin quyền thay cho người dưới quyền

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | C · D |
| Tác nhân | Quản lý trực tiếp, trưởng đơn vị (người gửi); người được cấp |
| Mô tả | Quản lý xin quyền thay cho người dưới quyền, ví dụ chuẩn bị quyền cho nhân viên mới trước ngày vào làm. Luồng duyệt vẫn như VH-REQ-02; quản lý gửi thì không tự duyệt bước 1. |
| Điều kiện trước | Người được cấp thuộc cây dưới quyền của người gửi (VH-BR-23); trạng thái Chưa vào làm, Đang làm hoặc Nghỉ dài ngày. |
| Xử lý chính | 1. Từ VH-MH-09 chọn người, bấm "Xin quyền thay"; hoặc ở VH-MH-05 chọn "Xin cho người khác".<br>2. Trường như VH-REQ-01, thêm "Người được cấp" (chỉ chọn trong cây dưới quyền). Người Chưa vào làm: ngày bắt đầu mặc định = ngày vào làm, được hẹn quá 30 ngày nếu ngày vào làm xa hơn.<br>3. Kiểm trùng quyền và tách nhiệm theo người được cấp.<br>4. Bước 1 là quản lý trực tiếp của người được cấp. Nếu chính người gửi là quản lý trực tiếp thì bước 1 chuyển lên quản lý trực tiếp của người gửi (VH-BR-12).<br>5. Báo người được cấp: "{họ tên quản lý} đã xin quyền {vai trò} trong {app} cho bạn." Người được cấp thấy yêu cầu ở VH-MH-04; người gửi rút được, người được cấp thì không.<br>6. Kết quả duyệt báo cả người gửi và người được cấp. |
| Ngoại lệ, thông báo lỗi | - Ngoài cây: "Bạn chỉ xin quyền thay được cho người trong cây dưới quyền của mình."<br>- Người được cấp đã nghỉ: "{họ tên} đã nghỉ việc, không xin quyền được." |
| Dữ liệu | `access_requests` (`requester_person_id` khác `beneficiary_person_id`), `approval_steps`, `notifications` |
| Quy tắc | VH-BR-12, VH-BR-23 |
| Màn hình | VH-MH-09, VH-MH-05, VH-MH-04 |
| Phụ thuộc | VH-REQ-01, VH-REQ-02, VH-LCM-01 |

**Tiêu chí nghiệm thu:**
1. Quản lý trực tiếp xin thay: bước 1 giao quản lý của quản lý đó, không giao chính người gửi.
2. Quản lý cấp trên (cách 2 cấp) xin thay: bước 1 giao quản lý trực tiếp của người được cấp.
3. Xin cho người ngoài cây bị chặn đúng câu.
4. Xin cho nhân viên mới vào làm ngày 15/04, được duyệt ngày 10/04: quyền có hiệu lực 00:00 15/04.

### VH-REQ-06 — Gia hạn quyền sắp hết hạn

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Người giữ quyền; quản lý (xin thay); người duyệt |
| Mô tả | Quyền ngoại lệ sắp hết hạn thì người giữ quyền gửi yêu cầu gia hạn, đi đúng luồng duyệt như yêu cầu mới. Duyệt kịp thì quyền dùng liên tục, không đứt quãng. |
| Điều kiện trước | Dòng quyền nguồn `yeu_cau`, Hiệu lực, còn ≤ 14 ngày tới hạn, hoặc đã hết hạn trong 7 ngày qua. Chưa có yêu cầu gia hạn khác đang mở cho dòng này. |
| Xử lý chính | 1. 14 ngày trước hạn: VH-MH-04 hiện nút "Gia hạn" trên dòng quyền và gửi thông báo "Quyền {vai trò} trong {app} hết hạn ngày {dd/mm}. Bấm Gia hạn nếu còn cần."<br>2. Bấm "Gia hạn": mở VH-MH-05 điền sẵn app, vai trò, đơn vị; `kind = gia_han`, `renew_grant_id` = dòng quyền; thời hạn mặc định theo vai trò; lý do bắt buộc (gợi ý "Vẫn cần vì …").<br>3. Hạn mới = hạn cũ + thời hạn chọn, và không quá ngày duyệt + `max_request_days`.<br>4. Duyệt theo VH-REQ-02; nhắc và tự huỷ theo VH-REQ-04.<br>5. Duyệt trước hạn cũ: kéo dài `valid_to` của chính dòng đó (05 mục 4.2); dòng vẫn Hiệu lực; nhật ký ghi hạn cũ, hạn mới. Không sinh sự kiện vì quyền không đứt.<br>6. Duyệt sau khi dòng đã Hết hạn: tạo dòng quyền mới từ lúc duyệt; sinh `vh.grant.added`.<br>7. Dòng đang nằm trong đợt rà soát vẫn gia hạn được; quyết định rà soát áp lên chính dòng đó.<br>8. Quyền khẩn cấp và quyền từ luật không có nút "Gia hạn". |
| Ngoại lệ, thông báo lỗi | - Chưa tới kỳ: "Chỉ gia hạn được khi còn 14 ngày hoặc ít hơn."<br>- Đã có yêu cầu: "Quyền này đã có yêu cầu gia hạn {mã} đang chờ duyệt."<br>- Khẩn cấp: "Quyền khẩn cấp không gia hạn được. Hãy gửi yêu cầu quyền mới."<br>- Từ luật: "Quyền này đến từ luật nên không có hạn, không cần gia hạn." |
| Dữ liệu | `access_requests` (`kind = gia_han`, `renew_grant_id`), `access_grants.valid_to`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-09, VH-BR-12, VH-BR-13 |
| Màn hình | VH-MH-04, VH-MH-05, VH-MH-08 |
| Phụ thuộc | VH-ACC-05, VH-REQ-01, VH-REQ-02, VH-REQ-04 |

**Tiêu chí nghiệm thu:**
1. Quyền hạn 31/03: nút "Gia hạn" hiện từ ngày 17/03, không hiện ngày 16/03.
2. Gia hạn 90 ngày được duyệt ngày 25/03: hạn mới 29/06; không có sự kiện; nhật ký có hạn cũ và hạn mới.
3. Gia hạn được duyệt ngày 02/04 (quyền đã hết hạn 01/04): dòng mới, có `vh.grant.added`.
4. Quyền khẩn cấp không có nút "Gia hạn"; gọi API thì trả đúng câu lỗi.

## 8. REV — Rà soát định kỳ

Rà soát hằng quý chỉ áp cho **quyền ngoại lệ** (nguồn yêu cầu, khẩn cấp). Quyền từ luật không rà từng người; thay vào đó **rà soát luật** mỗi nửa năm (VH-BR-16), mô tả ở VH-REV-01 bước 10. Quy trình VH-QT-09.

### VH-REV-01 — Mở đợt rà soát định kỳ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Quản trị hệ thống (mở, theo dõi); kiểm soát (theo dõi, chỉ đọc); hệ thống (nhắc theo lịch, giao dòng) |
| Mô tả | Mỗi quý, mọi quyền ngoại lệ đang hiệu lực được đưa vào một đợt rà soát. Mỗi quyền thành một dòng, giao cho trưởng đơn vị của người giữ quyền. Đợt kéo dài 14 ngày. |
| Điều kiện trước | Không có đợt nào đang Mở. Chưa có đợt cho kỳ này (`period` là duy nhất). |
| Xử lý chính | 1. Tới lịch ở VH-ADM-05 (mặc định 08:00 thứ Hai đầu tiên của tháng 1, 4, 7, 10), hệ thống báo quản trị hệ thống "Tới kỳ rà soát quý {q}/{năm}. Hãy mở đợt."<br>2. Quản trị hệ thống mở VH-MH-18, bấm "Mở đợt mới". Màn hiện phạm vi dự kiến: mọi dòng nguồn `yeu_cau`, `khan_cap` đang Hiệu lực, trừ dòng hết hạn trước hạn rà soát (sẽ tự hết). Thấy số dòng, số người, số người rà soát.<br>3. Bấm "Mở đợt". Hệ thống tạo đợt (`period` dạng `2027-Q2`, tên "Rà soát quyền ngoại lệ quý 2/2027"), chụp danh sách tại lúc mở. Quyền cấp sau lúc này để đợt sau.<br>4. Chọn người rà soát cho từng dòng:<br>  - trưởng đơn vị của vị trí chính của người giữ quyền (`reviewer_rule = truong_don_vi`, VH-BR-16);<br>  - trưởng đơn vị trống, chính là người giữ quyền, đã nghỉ hoặc đang Nghỉ dài ngày: lên trưởng đơn vị cha, đi dần lên gốc (`truong_don_vi_cap_tren`, 02 mục 6);<br>  - không tìm được ai: dòng hiện "Chưa có người rà soát"; quản trị hệ thống phải chỉ định một trưởng đơn vị (ghi nhật ký). Quản trị hệ thống không tự quyết thay.<br>5. Hạn rà soát `due_at` = lúc mở + 14 ngày.<br>6. Báo từng người rà soát: số dòng, hạn, link VH-MH-10.<br>7. Trạng thái đợt: Mở (`mo`) → Đã đóng (`da_dong`) sau khi VH-REV-03 xử lý xong. Không huỷ được đợt đang mở.<br>8. Trong đợt:<br>  - dòng quyền kết thúc vì lý do khác (hết hạn, nghỉ việc, gỡ tay): dòng rà soát đóng ở Gỡ, `decided_by = he_thong`, ghi chú lý do (05 mục 4.4);<br>  - người rà soát nghỉ việc hoặc bắt đầu Nghỉ dài ngày: các dòng chưa quyết chuyển lên trưởng đơn vị cấp trên; báo người mới.<br>9. Tiến độ trên VH-MH-18: % đã quyết theo đợt, theo đơn vị, theo người rà soát (`totals`: số dòng, Giữ, Gỡ, Quá hạn, Chờ).<br>10. **Rà soát luật nửa năm** (VH-BR-16): mỗi luật có `next_review_on` = lúc áp + 6 tháng. Tới ngày đó, chủ app của app và quản trị hệ thống nhận báo "Luật {tên} tới hạn rà soát." Ở VH-MH-16 lọc "Tới hạn rà soát", bấm "Đã rà soát, giữ nguyên" (`next_review_on` cộng 6 tháng) hoặc sửa, tắt theo VH-QT-10. Quá 14 ngày chưa rà: báo kiểm soát; không tự tắt luật. |
| Ngoại lệ, thông báo lỗi | - Đã có đợt mở: "Đang có đợt {tên} mở đến {dd/mm}. Đợi đợt đó đóng rồi mới mở đợt mới."<br>- Kỳ đã có đợt: "Kỳ {period} đã có đợt rà soát."<br>- Không có dòng nào: "Không có quyền ngoại lệ nào cần rà soát." (vẫn cho mở để có biên bản)<br>- Chưa mở sau 3 ngày từ lịch: nhắc lại quản trị hệ thống; sau 7 ngày: báo kiểm soát "Đợt rà soát quý {q}/{năm} chưa được mở." |
| Dữ liệu | `review_campaigns` (`period`, `name`, `scope`, `status`, `opened_at`, `opened_by`, `due_at`, `closed_at`, `totals`), `review_items` (`campaign_id`, `grant_id`, người giữ quyền, `app_key`, `role_key`, `unit_code`, `grant_valid_to`, `reviewer_person_id`, `reviewer_rule`, `status`), `access_rules.next_review_on`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-16, VH-BR-17, VH-BR-22 |
| Màn hình | VH-MH-18; VH-MH-16 (rà soát luật) |
| Phụ thuộc | VH-ADM-05, VH-ORG-04, VH-ACC-01; VH-QT-09 |

**Tiêu chí nghiệm thu:**
1. Thứ Hai 05/04/2027 08:00, quản trị hệ thống nhận nhắc mở đợt quý 2.
2. Mở đợt khi có 46 quyền ngoại lệ, 3 quyền hết hạn trong 14 ngày tới: đợt có 43 dòng, mỗi dòng có người rà soát.
3. Quyền của một trưởng đơn vị được giao cho trưởng đơn vị cấp trên, không giao cho chính người đó.
4. Mở đợt thứ hai khi đợt đầu chưa đóng bị chặn đúng câu.
5. Luật áp ngày 28/11/2026 tới hạn rà soát ngày 28/05/2027; bấm "Đã rà soát, giữ nguyên" thì hạn mới là 28/11/2027.

### VH-REV-02 — Trưởng đơn vị xác nhận hoặc gỡ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Trưởng đơn vị (người rà soát); trưởng đơn vị cấp trên (xem tiến độ đơn vị con, chỉ đọc) |
| Mô tả | Người rà soát xem từng quyền ngoại lệ của người trong đơn vị mình rồi chọn Giữ hoặc Gỡ. Giữ thì quyền giữ nguyên hạn cũ. Gỡ thì quyền mất ngay. |
| Điều kiện trước | Đợt đang Mở; dòng được giao cho người này. |
| Xử lý chính | 1. VH-MH-10 liệt kê các dòng, gom theo người giữ quyền. Cột: người giữ quyền, đơn vị, app, vai trò (đánh dấu nhạy cảm), đơn vị phạm vi, nguồn, lý do xin gốc, người duyệt gốc, ngày cấp, hạn, lần cuối người đó đăng nhập (`accounts.last_login_at`, `last_login_app`).<br>2. Mỗi dòng chọn "Giữ" hoặc "Gỡ". Gỡ bắt buộc ghi chú (10–300 ký tự); có gợi ý nhanh: "Không còn làm việc này", "Đã có quyền từ luật", "Không rõ vì sao có".<br>3. Chọn nhiều dòng rồi "Giữ các dòng đã chọn" hoặc "Gỡ các dòng đã chọn" (một ghi chú chung) được.<br>4. Gỡ: hộp xác nhận "Gỡ ngay {n} quyền? Muốn cấp lại phải gửi yêu cầu mới." Xác nhận xong, dòng quyền Đã gỡ ngay với `removed_reason = ra_soat` (VH-ACC-06); dòng rà soát ghi `removal_applied_at`; báo người giữ quyền.<br>5. Giữ: ghi quyết định; hạn quyền không đổi (VH-BR-16). Đổi từ Giữ sang Gỡ được tới khi đợt đóng; từ Gỡ không đổi lại được.<br>6. Dòng về chính người rà soát không bao giờ giao cho người đó (VH-REV-01 bước 4).<br>7. Nhắc người còn dòng chưa quyết lúc 08:00 ngày thứ 7 và ngày thứ 12 của đợt: "Bạn còn {n} quyền chưa rà soát. Hạn {HH:mm dd/mm}; quá hạn quyền sẽ tự bị gỡ."<br>8. Trưởng đơn vị cấp trên thấy tiến độ của đơn vị con, không quyết thay.<br>9. Rà soát không uỷ quyền được (VH-REQ-03 bước 9). |
| Ngoại lệ, thông báo lỗi | - Quá hạn: "Đợt rà soát đã hết hạn lúc {HH:mm dd/mm}. Không đổi được quyết định."<br>- Không phải người rà soát: "Dòng này giao cho {họ tên}. Bạn chỉ xem được."<br>- Thiếu ghi chú khi gỡ: "Hãy ghi lý do gỡ (ít nhất 10 ký tự)."<br>- Đổi từ Gỡ sang Giữ: "Quyền đã bị gỡ. Muốn cấp lại hãy gửi yêu cầu mới." |
| Dữ liệu | `review_items` (`status`, `decided_by`, `decided_at`, `comment`, `removal_applied_at`), `review_campaigns.totals`, `access_grants`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-16, VH-BR-17, VH-BR-23 |
| Màn hình | VH-MH-10 |
| Phụ thuộc | VH-REV-01, VH-ACC-06, VH-ACC-07 |

**Tiêu chí nghiệm thu:**
1. Chọn Gỡ một dòng: app nhận `vh.grant.removed` trong 1 phút; người giữ quyền nhận thông báo.
2. Chọn Giữ: hạn quyền không đổi.
3. Giữ 5 dòng bằng một lần bấm: 5 dòng đều ghi quyết định và người quyết.
4. Người không được giao chỉ xem, không có nút quyết.
5. Nhắc gửi đúng ngày 7 và ngày 12, chỉ cho người còn dòng Chờ.

### VH-REV-03 — Tự gỡ quyền không được xác nhận và báo cáo kết quả

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Hệ thống; quản trị hệ thống, kiểm soát, ban giám đốc, trưởng đơn vị (nhận báo cáo) |
| Mô tả | Hết 14 ngày, dòng nào chưa có quyết định thì quyền bị gỡ tự động. Đợt đóng lại với một báo cáo không sửa được. |
| Điều kiện trước | Đợt đang Mở và đã qua `due_at`. |
| Xử lý chính | 1. Job hẹn giờ (mỗi 15 phút) thấy đợt quá `due_at` thì xử lý.<br>2. Mỗi dòng còn Chờ: chuyển Quá hạn (`qua_han`, `decided_by = he_thong`); gỡ dòng quyền với `removed_reason = ra_soat` (05 mục 4.4).<br>3. Báo người giữ quyền: "Quyền {vai trò} trong {app} đã bị gỡ vì không được xác nhận trong đợt {tên đợt}. Cần dùng lại hãy gửi yêu cầu." Báo người rà soát danh sách dòng bị gỡ do quá hạn, chép quản lý trực tiếp của người rà soát.<br>4. Xử lý xong mọi dòng thì đợt chuyển Đã đóng, ghi `closed_at`; mọi dòng chỉ đọc.<br>5. Báo cáo đợt:<br>  - tổng dòng; số Giữ, Gỡ, Quá hạn;<br>  - tỉ lệ hoàn thành đúng hạn theo người rà soát và theo đơn vị;<br>  - danh sách quyền đã gỡ (do quyết định và do quá hạn);<br>  - danh sách người rà soát để quá hạn;<br>  - phân theo app và theo vai trò nhạy cảm.<br>6. Gửi báo cáo cho quản trị hệ thống và kiểm soát; ban giám đốc nhận bản số liệu (không tên); mỗi trưởng đơn vị nhận phần đơn vị mình.<br>7. Tải Excel và PDF. Bản PDF lưu kèm đợt làm biên bản; không sửa được. |
| Ngoại lệ, thông báo lỗi | - Gỡ lỗi giữa chừng: dòng lỗi thử lại ở lần chạy sau của job; đợt chỉ Đã đóng khi mọi dòng xong; cảnh báo vận hành "Đợt rà soát {tên}: {n} dòng gỡ lỗi."<br>- Cầu dao đồng bộ (VH-ACC-07) không chặn việc gỡ này vì đây là thay đổi đã duyệt. |
| Dữ liệu | `review_campaigns` (`status`, `closed_at`, `totals`), `review_items`, `access_grants`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-16, VH-BR-18 |
| Màn hình | VH-MH-18, VH-MH-10 |
| Phụ thuộc | VH-REV-01, VH-REV-02, VH-ACC-06, VH-ADM-02 |

**Tiêu chí nghiệm thu:**
1. Đợt mở 08:00 05/04, hạn 08:00 19/04: lúc 08:00–08:15 ngày 19/04 mọi dòng Chờ chuyển Quá hạn và quyền bị gỡ.
2. Người giữ quyền và người rà soát nhận đúng thông báo.
3. Báo cáo có số Giữ + Gỡ + Quá hạn = tổng dòng.
4. Sau khi đóng, không sửa được dòng nào; PDF biên bản tải được.
5. Ban giám đốc chỉ thấy số liệu, không thấy tên.

## 9. LCM — Vòng đời nhân viên

Vòng đời đi theo hồ sơ. HC-NS ghi sự việc với ngày hiệu lực; tới ngày, hệ thống tự làm phần quyền, tài khoản và sự kiện. HC-NS không cấp quyền (VH-BR-17). Mọi thay đổi đi qua `scheduled_changes` và job áp thay đổi chạy mỗi phút (05 mục 5). Quy trình VH-QT-04 đến VH-QT-07.

### VH-LCM-01 — Vào làm

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | HC-NS; quản lý trực tiếp; nhân viên mới; hệ thống; admin Google Workspace (tạo tài khoản Google, ngoài VC Home) |
| Mô tả | HC-NS tạo hồ sơ và vị trí chính với ngày vào làm. Tới 00:00 ngày đó, hồ sơ có hiệu lực, quyền từ luật có ngay, app nhận sự kiện. Lần đầu đăng nhập, nhân viên thấy đúng ô app và vai trò. |
| Điều kiện trước | Đơn vị, chức danh, chức năng đã có trong danh mục. Tài khoản Google công ty nên được tạo trước ngày vào làm ít nhất 1 ngày. |
| Xử lý chính | 1. HC-NS tạo hồ sơ ở VH-MH-11: mã NV, họ tên, email công ty, pháp nhân, loại nhân viên, nơi làm việc, ngày vào làm; vị trí chính (đơn vị, chức danh, chức năng, quản lý trực tiếp; từ ngày = ngày vào làm); kiêm nhiệm nếu có.<br>2. Ngày vào làm ở tương lai: hồ sơ Chưa vào làm; thay đổi nằm ở `scheduled_changes`. Hôm nay hoặc đã qua: áp ngay khi lưu.<br>3. Lưu xong, hệ thống tính trước quyền từ luật (VH-ACC-02): các dòng Chờ hiệu lực, `valid_from` = 00:00 ngày vào làm. Hồ sơ hiện "Quyền sẽ có từ ngày vào làm".<br>4. Báo quản lý trực tiếp: "{họ tên} vào làm ngày {dd/mm} ở {đơn vị}. Quyền sẽ có: {danh sách}. Cần thêm thì xin thay (từ GĐ D)."<br>5. 3 ngày trước ngày vào làm: kiểm email đã có trên Google chưa (dữ liệu của VH-IMP-02). Chưa có thì báo HC-NS và admin Google: "Chưa có tài khoản Google cho {email}; nhân viên vào làm ngày {dd/mm}."<br>6. 00:00 ngày vào làm: job áp thay đổi chuyển hồ sơ Đang làm và mở vị trí; ghi `vh.person.joined`; tính lại quyền chuyển các dòng Chờ hiệu lực sang Hiệu lực và ghi `vh.grant.added` cho từng quyền. Lần chạy an toàn 00:05 và job hẹn giờ quyền làm bù nếu sót.<br>7. Lần đăng nhập đầu: VH-AUT-08 gắn tài khoản theo email; VH-ACC-07 đẩy quyền ngay; VC Home lấy lại token; lưới app có đủ ô.<br>8. App tạo người dùng của mình khi nhận `vh.person.joined` hoặc `vh.grant.added`, hoặc ở lần đăng nhập OIDC đầu; khoá theo mã NV và `sub`. Sự kiện ghi trước lần đăng nhập đầu chưa có `sub` (xem Đề xuất bổ sung 5 của 05).<br>9. Không nhận việc (huỷ trước ngày vào làm): HC-NS bấm "Không nhận việc"; hồ sơ chuyển Đã nghỉ (05 mục 4.1); các dòng Chờ hiệu lực Đã gỡ (`huy_truoc_hieu_luc`). Không gửi sự kiện nào vì app chưa từng nhận `vh.person.joined`. Mã NV không dùng lại. |
| Ngoại lệ, thông báo lỗi | - Thiếu quản lý: "Vị trí chính phải có quản lý trực tiếp." (trừ người đứng đầu tập đoàn)<br>- Email ngoài domain: "Email phải là @vcprosperous.com hoặc @vcpart.vn."<br>- Email trùng: "Email {email} đang dùng cho nhân viên {mã NV}."<br>- Mã trùng: "Mã nhân viên {mã} đã có (kể cả người đã nghỉ). Mã không dùng lại."<br>- Ngày vào làm xa hơn 90 ngày: cảnh báo, vẫn cho lưu: "Ngày vào làm còn hơn 90 ngày nữa. Kiểm tra lại."<br>- Đăng nhập trước ngày vào làm: trang chủ hiện "Hồ sơ của bạn có hiệu lực từ {dd/mm/yyyy}." và chưa có app (VH-AUT-08) |
| Dữ liệu | `people` (`status`, `joined_on`), `positions`, `scheduled_changes`, `accounts`, `access_grants`, `event_outbox`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-01, VH-BR-02, VH-BR-04, VH-BR-05, VH-BR-07, VH-BR-11, VH-BR-17, VH-BR-24 |
| Màn hình | VH-MH-11, VH-MH-09, VH-MH-02, VH-MH-04 |
| Phụ thuộc | VH-NSU-01, VH-NSU-02, VH-NSU-03, VH-NSU-04, VH-AUT-08, VH-ACC-02, VH-ACC-07, VH-INT-03, VH-IMP-02, VH-REQ-05; VH-QT-04 |

**Mốc thời gian vào làm** (T = ngày vào làm):

| Mốc | Việc | Ai | Sự kiện gửi app |
|---|---|---|---|
| Lúc HC-NS lưu | Hồ sơ Chưa vào làm; tính trước quyền (Chờ hiệu lực); báo quản lý | HC-NS, hệ thống | Không |
| T − 3 ngày | Kiểm tài khoản Google | Hệ thống | Không |
| T 00:00 | Hồ sơ Đang làm; quyền Hiệu lực | Hệ thống | `vh.person.joined`; `vh.grant.added` cho từng quyền |
| T 00:05 | Lần chạy an toàn kiểm lại | Hệ thống | Không (nếu đã đúng) |
| Lần đăng nhập đầu | Gắn tài khoản; đẩy quyền sang VC ID; lấy lại token | Nhân viên, hệ thống | Không |

**Tiêu chí nghiệm thu:**
1. Hồ sơ vào làm ngày mai: hôm nay không có quyền hiệu lực, không có sự kiện; 00:05 ngày mai có đủ quyền từ luật và app đã nhận `vh.person.joined` và `vh.grant.added`.
2. Lần đăng nhập đầu từ VC Home thấy đủ ô app, không phải đăng nhập lại.
3. Chưa có tài khoản Google 3 ngày trước ngày vào làm: HC-NS và admin Google nhận báo.
4. Không nhận việc trước ngày vào làm: không sự kiện nào được gửi; mã NV không dùng lại được.
5. Người có kiêm nhiệm ngay từ ngày vào có quyền theo cả hai vị trí, mỗi quyền đúng đơn vị.

### VH-LCM-02 — Chuyển vị trí

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | HC-NS; quản lý cũ, quản lý mới; nhân viên; hệ thống; app (bàn giao) |
| Mô tả | Chuyển vị trí gồm: đổi vị trí chính (điều chuyển, thăng chức), thêm hoặc kết thúc kiêm nhiệm, đổi quản lý trực tiếp. HC-NS ghi với ngày hiệu lực. Tới ngày, quyền mới có ngay; quyền mất còn dùng trong thời gian chuyển tiếp của từng app để kịp bàn giao. |
| Điều kiện trước | Hồ sơ Đang làm, Nghỉ dài ngày hoặc Tạm khoá. |
| Xử lý chính | 1. Ở VH-MH-11 chọn loại thay đổi; nhập ngày hiệu lực (mặc định ngày mai), lý do hoặc số quyết định (tuỳ chọn, ≤ 200 ký tự), vị trí mới (đơn vị, chức danh, chức năng, quản lý).<br>2. Trước khi lưu, màn hiện "Tác động tới quyền": quyền thêm; quyền mất kèm số ngày chuyển tiếp của từng app (ví dụ "VClinks · nvkd: còn dùng 3 ngày sau ngày hiệu lực"); quyền ngoại lệ giữ nguyên.<br>3. Kiểm và cảnh báo trước khi lưu:<br>  - người này đang là quản lý của {n} người: "Kiểm tra lại quản lý trực tiếp của {n} người đang báo cáo cho {họ tên}.";<br>  - người này là trưởng đơn vị mà vị trí mới không còn hợp lệ (VH-BR-06): HC-NS phải chọn "Bỏ chức trưởng đơn vị {đơn vị}" mới lưu được.<br>4. Lưu: ghi `scheduled_changes` (đóng vị trí cũ, mở vị trí mới, cùng `group_id`). Báo nhân viên, quản lý cũ, quản lý mới. Huỷ hoặc sửa được trước ngày hiệu lực.<br>5. 00:00 ngày hiệu lực: đóng vị trí cũ (`end_on` = ngày trước ngày hiệu lực), mở vị trí mới (VH-BR-04); ghi `vh.person.moved` (vị trí cũ, mới; quản lý cũ, mới; ngày hiệu lực). Tính lại quyền (VH-ACC-02): quyền mới Hiệu lực ngay, ghi `vh.grant.added`; quyền mất chuyển Chuyển tiếp, ô app hiện "Còn N ngày".<br>6. Hết chuyển tiếp: gỡ, ghi `vh.grant.removed` (`khong_con_thoa_luat`).<br>7. App bàn giao theo `vh.person.moved`; VClinks mở bàn giao khách (M1b-11) trong thời gian chuyển tiếp.<br>8. Yêu cầu đang chờ mà người này là người được cấp: bước 1 chuyển cho quản lý mới. Việc duyệt người này đang giữ: chuyển theo VH-REQ-02 bước 13.<br>9. Quyền ngoại lệ không đổi; quản lý mới nhận danh sách quyền ngoại lệ của người này để biết và xử lý ở đợt rà soát tới.<br>10. Chỉ đổi quản lý: vẫn ghi `vh.person.moved`; tính lại cho quản lý cũ và quản lý mới (thuộc tính "là quản lý").<br>11. Sửa nhập nhầm (sai chức danh lúc nhập) đi đường riêng của 05 mục 5.4: sửa tại chỗ, bắt buộc lý do, vẫn ghi `vh.person.moved`. |
| Ngoại lệ, thông báo lỗi | - Vòng quản lý: "Không chọn được {họ tên} làm quản lý vì tạo vòng: {A → B → A}."<br>- Ngày hiệu lực trước ngày vào làm: "Ngày hiệu lực không được trước ngày vào làm {dd/mm/yyyy}."<br>- Hai vị trí chính: "Nhân viên đang làm phải có đúng một vị trí chính."<br>- Đơn vị ngừng hoặc sẽ ngừng: "Đơn vị {tên} đã ngừng hoặc sẽ ngừng trước ngày {dd/mm}. Chọn đơn vị khác."<br>- Trùng thay đổi hẹn: "Đã có thay đổi hẹn ngày {dd/mm} cho người này. Sửa thay đổi đó hoặc chọn ngày khác."<br>- Áp lỗi lúc 00:00 (ví dụ quản lý mới đã nghỉ): cả nhóm thay đổi ở trạng thái Lỗi, không áp nửa vời; HC-NS nhận "Không áp được thay đổi ngày {dd/mm} của {mã NV}: {lý do}." |
| Dữ liệu | `positions`, `scheduled_changes`, `people.primary`, `people.is_manager`, `org_units.head_person_id`, `access_grants`, `approval_steps`, `event_outbox`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-04, VH-BR-05, VH-BR-06, VH-BR-07, VH-BR-11, VH-BR-24 |
| Màn hình | VH-MH-11, VH-MH-09, VH-MH-02, VH-MH-04 |
| Phụ thuộc | VH-NSU-02, VH-NSU-03, VH-ACC-02, VH-APP-06, VH-INT-03, VH-REQ-02; VH-QT-05 |

**Mốc thời gian chuyển vị trí** (D = ngày hiệu lực, N = số ngày chuyển tiếp của app):

| Mốc | Việc | Sự kiện gửi app |
|---|---|---|
| Lúc HC-NS lưu | Xem tác động; báo các bên | Không |
| D 00:00 | Đổi vị trí; tính lại quyền | `vh.person.moved`; `vh.grant.added` cho quyền mới |
| Từ D tới trước D + N | Quyền cũ còn dùng, ô "Còn N ngày"; app bàn giao | Không |
| D + N 00:00 | Gỡ quyền cũ (N = 0 thì gỡ ngay lúc D 00:00) | `vh.grant.removed` cho quyền cũ |

**Tiêu chí nghiệm thu:**
1. NVKD chuyển sang CSKH ngày 01/04, VClinks chuyển tiếp 3 ngày: ngày 01/04 có cả `nvkd` (Còn 3 ngày) và `cskh`; 00:15 ngày 04/04 chỉ còn `cskh`.
2. App nhận `vh.person.moved` sau 00:00 ngày 01/04 và `vh.grant.removed` (`nvkd`) sau 00:00 ngày 04/04.
3. App có chuyển tiếp 0 ngày: quyền cũ mất ngay ngày 01/04.
4. Huỷ thay đổi hẹn trước ngày hiệu lực: không có sự kiện, quyền không đổi.
5. Đổi quản lý làm quản lý cũ không còn ai dưới quyền: luật "là quản lý = Có" không còn khớp với quản lý cũ.

### VH-LCM-03 — Nghỉ việc theo ngày hiệu lực

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | HC-NS; hệ thống; VC ID; app; quản trị hệ thống (khoá gấp nếu cần) |
| Mô tả | HC-NS đặt ngày nghỉ việc. Tới 00:00 ngày đó, hệ thống làm 4 việc theo đúng thứ tự VH-BR-14: khoá và đăng xuất; gỡ mọi quyền; gửi sự kiện để app bàn giao; đóng vị trí. Hồ sơ không xoá. |
| Điều kiện trước | Hồ sơ Đang làm, Nghỉ dài ngày hoặc Tạm khoá. |
| Xử lý chính | 1. HC-NS ở VH-MH-11 bấm "Nghỉ việc", nhập ngày nghỉ việc (ngày đầu tiên không còn làm, Q-13) và ghi chú (tuỳ chọn). Không ghi lý do nghỉ (VH-BR-19, 05 mục 6).<br>2. Màn hiện tác động: số quyền sẽ gỡ theo app; số người đang báo cáo cho người này; đơn vị người này làm trưởng; việc duyệt, rà soát đang giữ; uỷ quyền đang có.<br>3. Ngày nghỉ ở tương lai: lưu vào `scheduled_changes`; báo quản lý trực tiếp ngay và 3 ngày trước ngày nghỉ: "{họ tên} nghỉ việc từ {dd/mm}. Hãy chuẩn bị bàn giao."<br>4. Ngày nghỉ là hôm nay hoặc đã qua: hộp xác nhận "Nghỉ việc có hiệu lực ngay: khoá tài khoản, gỡ {n} quyền, đăng xuất mọi app. Tiếp tục?". Xác nhận thì làm ngay bước 5–9.<br>5. Bước 1 (00:00 ngày nghỉ): khoá user trên VC ID và gọi đăng xuất user; VC ID gửi đăng xuất phía máy chủ tới mọi app đang có phiên (VH-INT-04). Ghi `accounts.lock` (`kind = nghi_viec`).<br>6. Bước 2: mọi dòng quyền đang mở, mọi nguồn, chuyển Đã gỡ (`nghi_viec`), bỏ qua chuyển tiếp; bỏ client role và nhóm `app-*` trên VC ID; ghi `vh.grant.removed` cho từng quyền hiệu lực.<br>7. Bước 3: ghi `vh.person.left` (mã NV, `sub`, ngày nghỉ, đơn vị và quản lý cuối) cho mọi app đăng ký. VClinks mở bàn giao khách (M1b-11).<br>8. Bước 4: đóng mọi vị trí (`end_on` = ngày trước ngày nghỉ, `end_reason = nghi_viec`); trạng thái Đã nghỉ; bỏ chức trưởng đơn vị nếu có; vị trí của người khác đang trỏ quản lý tới người này được đánh dấu `manager_missing`; báo HC-NS danh sách đó và các đơn vị mất trưởng (VH-BR-05).<br>9. Dọn việc dở: yêu cầu mà người này là người được cấp thì Tự huỷ; việc duyệt người này giữ thì chuyển (VH-REQ-02 bước 13); dòng rà soát chuyển lên trên (VH-REV-01 bước 8); uỷ quyền cho và từ người này kết thúc.<br>10. Kiểm sau lúc 00:15: tài khoản đã khoá và không còn quyền hiệu lực. Sai thì cảnh báo khẩn (VH-ADM-04).<br>11. Tài khoản Google do admin Google khoá. Từ ngày nghỉ, đối chiếu Google (VH-IMP-02) báo dòng "hồ sơ đã nghỉ, Google còn hoạt động" cho tới khi Google bị khoá.<br>12. Huỷ nghỉ việc trước ngày hiệu lực: được, ghi nhật ký. Sau ngày hiệu lực: dùng VH-LCM-05.<br>13. Cần khoá trước ngày nghỉ (nghi lộ dữ liệu): quản trị hệ thống dùng VH-AUT-06; tới ngày nghỉ hệ thống vẫn chạy bước 6–9.<br>14. Hồ sơ giữ 24 tháng rồi ẩn danh; tài khoản VC ID xoá cùng lúc (05 mục 7). |
| Ngoại lệ, thông báo lỗi | - Ngày nghỉ trước ngày vào làm: "Ngày nghỉ việc phải sau ngày vào làm {dd/mm/yyyy}."<br>- Người đứng đầu tập đoàn: "Đây là người đứng đầu tập đoàn. Hãy chọn người thay trước khi đặt nghỉ việc."<br>- VC ID không trả lời lúc khoá: thử lại mỗi phút trong 15 phút, rồi cảnh báo khẩn "Chưa khoá được tài khoản của {mã NV} trên VC ID." Bước 2–4 vẫn làm. |
| Dữ liệu | `people` (`status`, `left_on`), `positions`, `scheduled_changes`, `accounts.lock`, `access_grants`, `access_requests`, `approval_steps`, `delegations`, `review_items`, `org_units.head_person_id`, `event_outbox`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-05, VH-BR-06, VH-BR-07, VH-BR-14, VH-BR-18, VH-BR-19 |
| Màn hình | VH-MH-11, VH-MH-09 |
| Phụ thuộc | VH-AUT-06, VH-AUT-07, VH-INT-03, VH-INT-04, VH-ACC-06, VH-ACC-07, VH-IMP-02; VH-QT-06; VClinks M1b-11; Q-13 |

**Mốc thời gian nghỉ việc** (D = ngày nghỉ việc):

| Mốc | Việc | Sự kiện, tín hiệu gửi app |
|---|---|---|
| Lúc HC-NS lưu | Xem tác động; báo quản lý | Không |
| D − 3 ngày | Nhắc quản lý chuẩn bị bàn giao | Không |
| D 00:00, bước 1 | Khoá VC ID, đăng xuất mọi app (≤ 1 phút) | Đăng xuất phía máy chủ của VC ID (không phải sự kiện VC Home) |
| D 00:00, bước 2 | Gỡ mọi quyền | `vh.grant.removed` cho từng quyền |
| D 00:00, bước 3 | Báo app bàn giao | `vh.person.left` |
| D 00:00, bước 4 | Đóng vị trí; báo HC-NS người thiếu quản lý | Không (HC-NS đổi quản lý cho người khác thì sinh `vh.person.moved` của họ) |
| D 00:15 | Kiểm sau | Không |

**Tiêu chí nghiệm thu:**
1. Nghỉ ngày 01/04: 23:59 ngày 31/03 còn dùng bình thường; 00:01 ngày 01/04 mọi app đã mất phiên, đăng nhập lại bị chặn.
2. 00:05 ngày 01/04: không còn dòng quyền mở; app đã nhận đủ `vh.grant.removed` và `vh.person.left`.
3. Người có 3 người báo cáo: HC-NS nhận danh sách 3 người; yêu cầu đang chờ người này duyệt chuyển cho trưởng đơn vị.
4. Hồ sơ vẫn tra được với trạng thái Đã nghỉ.
5. Nghỉ việc hiệu lực ngay: xong cả 4 bước trong 1 phút sau khi xác nhận.

### VH-LCM-04 — Nghỉ dài ngày và quay lại

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | HC-NS; hệ thống; app |
| Mô tả | Nghỉ từ 7 ngày trở lên (thai sản, ốm dài, đi học…) thì giữ quyền, mặc định không khoá. App nhận sự kiện "vắng" để không chia việc mới; hết nghỉ thì nhận sự kiện "quay lại" (VH-BR-15). |
| Điều kiện trước | Hồ sơ Đang làm. |
| Xử lý chính | 1. HC-NS ở VH-MH-11 bấm "Nghỉ dài ngày", nhập: từ ngày; đến ngày dự kiến (bắt buộc, ít nhất 7 ngày); khoá đăng nhập trong thời gian nghỉ (Có hoặc Không, mặc định Không).<br>2. Chỉ ghi "Nghỉ dài ngày", **không ghi loại hay lý do nghỉ** (thai sản, ốm là dữ liệu sức khoẻ, VH-BR-19; 05 mục 3.1 trường `leave`).<br>3. 00:00 từ ngày: trạng thái Nghỉ dài ngày; ghi `vh.person.leave_started` (từ ngày, đến ngày dự kiến, có khoá hay không). Nếu chọn khoá: khoá VC ID (`accounts.lock.kind = nghi_dai_ngay`) và đăng xuất mọi app; dòng quyền vẫn giữ.<br>4. Trong thời gian nghỉ:<br>  - danh bạ hiện "Tạm vắng" (không ghi ngày, VH-NSU-07);<br>  - người này không được giao duyệt mới (chuyển lên quản lý của họ, trừ khi có uỷ quyền) và không làm người rà soát;<br>  - quyền ngoại lệ tới hạn vẫn hết hạn bình thường.<br>5. 3 ngày trước đến ngày dự kiến: báo HC-NS "{họ tên} dự kiến đi làm lại ngày {dd/mm}. Kéo dài nếu cần."<br>6. HC-NS kéo dài, hoặc ghi ngày đi làm lại sớm hơn.<br>7. 00:00 ngày sau đến ngày dự kiến (hoặc ngày đi làm lại HC-NS ghi): trạng thái Đang làm; mở khoá nếu bước 3 đã khoá (đây là quyết định HC-NS đã chọn từ đầu); ghi `vh.person.returned`.<br>8. Tài khoản bị khoá vì lý do khác trong thời gian nghỉ (khoá khẩn cấp VH-AUT-06, khoá do Google): **không** tự mở.<br>9. Nghỉ việc trong lúc nghỉ dài ngày: theo VH-LCM-03. |
| Ngoại lệ, thông báo lỗi | - Dưới 7 ngày: "Nghỉ dài ngày tính từ 7 ngày. Nghỉ ngắn hơn không cần ghi trên VC Home."<br>- Chồng thời gian: "Đã có đợt nghỉ dài ngày từ {dd/mm} đến {dd/mm}."<br>- Đến ngày không hợp lệ: "Ngày đi làm lại dự kiến phải sau ngày bắt đầu nghỉ." |
| Dữ liệu | `people` (`status`, `leave`: `from_on`, `to_on`, `lock_login`), `accounts.lock`, `scheduled_changes`, `event_outbox`, `notifications`, `audit_log` |
| Quy tắc | VH-BR-07, VH-BR-15, VH-BR-19 |
| Màn hình | VH-MH-11, VH-MH-06, VH-MH-09 |
| Phụ thuộc | VH-NSU-04, VH-AUT-06, VH-INT-03, VH-INT-04, VH-REQ-02, VH-REV-01; VH-QT-07 |

**Tiêu chí nghiệm thu:**
1. Nghỉ từ 01/05 đến 31/07, không khoá: ngày 01/05 app nhận `vh.person.leave_started`; người đó vẫn đăng nhập được và giữ đủ quyền.
2. Chọn khoá: 00:01 ngày 01/05 mọi app mất phiên; ngày 01/08 mở khoá và app nhận `vh.person.returned`.
3. Yêu cầu mới mà người này là quản lý trực tiếp của người được cấp: bước 1 giao quản lý của người này.
4. Màn không có ô nhập loại hay lý do nghỉ; API nhận trường lạ thì bỏ qua và không lưu.
5. Bị khoá khẩn cấp trong lúc nghỉ: ngày quay lại không tự mở khoá.

### VH-LCM-05 — Quay lại làm sau khi đã nghỉ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | C · D |
| Tác nhân | HC-NS; quản trị hệ thống (gắn lại tài khoản khi cần); hệ thống |
| Mô tả | Người đã nghỉ quay lại làm thì dùng lại hồ sơ cũ và mã nhân viên cũ, không tạo người mới. Quyền tính lại từ đầu theo vị trí mới; quyền cũ không khôi phục. |
| Điều kiện trước | Hồ sơ Đã nghỉ, chưa bị ẩn danh (còn trong 24 tháng, 05 mục 7). |
| Xử lý chính | 1. HC-NS tìm hồ sơ Đã nghỉ ở VH-MH-11, bấm "Nhận lại". Khi HC-NS tạo hồ sơ mới mà trùng email hiện tại hoặc email cũ (`previous_emails`) của một hồ sơ Đã nghỉ, hệ thống gợi ý "Có thể là {họ tên}, mã {mã NV}, nghỉ ngày {dd/mm/yyyy}. Nhận lại?".<br>2. Nhập: ngày vào làm lại, email công ty (giữ cũ hoặc mới), loại nhân viên, vị trí chính mới, kiêm nhiệm.<br>3. Hồ sơ giữ mã NV và lịch sử cũ; trạng thái chuyển Chưa vào làm (05 mục 4.1); `joined_on` mới; lịch sử ngày vào, ngày nghỉ lần trước giữ ở nhật ký.<br>4. 00:00 ngày vào làm lại: Đang làm; mở khoá user cũ trên VC ID (cùng `sub`) nếu tài khoản Google vẫn là tài khoản cũ; tính lại quyền; ghi `vh.person.joined` có cờ `rehire = true` để app kích hoạt lại người dùng cũ thay vì tạo mới; rồi `vh.grant.added`.<br>5. Tài khoản Google đã bị xoá và tạo lại: liên kết Google của user cũ không còn khớp. Quản trị hệ thống gắn lại theo VH-BR-01 trước ngày vào làm; hệ thống nhắc 3 ngày trước.<br>6. Yêu cầu, quyền ngoại lệ, uỷ quyền cũ không khôi phục.<br>7. Hồ sơ đã ẩn danh: không nhận lại được; tạo hồ sơ mới với mã mới. |
| Ngoại lệ, thông báo lỗi | - Hồ sơ chưa nghỉ: "Hồ sơ này đang làm, không nhận lại được."<br>- Hồ sơ đã ẩn danh: "Hồ sơ này đã ẩn danh theo thời hạn lưu. Hãy tạo hồ sơ mới."<br>- Email thuộc người khác: "Email {email} đang dùng cho nhân viên {mã NV}. Chọn email khác."<br>- Ngày vào làm lại sai: "Ngày vào làm lại phải sau ngày nghỉ việc {dd/mm/yyyy}." |
| Dữ liệu | `people`, `positions`, `accounts`, `scheduled_changes`, `access_grants`, `event_outbox`, `audit_log` |
| Quy tắc | VH-BR-01, VH-BR-04, VH-BR-07, VH-BR-14 |
| Màn hình | VH-MH-11 |
| Phụ thuộc | VH-LCM-01, VH-AUT-08, VH-ACC-02, VH-ACC-07, VH-INT-03 |

**Tiêu chí nghiệm thu:**
1. Người nghỉ 6 tháng quay lại: cùng mã NV, cùng `sub`; ngày vào làm lại đăng nhập được với quyền theo vị trí mới.
2. App nhận `vh.person.joined` có `rehire = true` và kích hoạt lại người dùng cũ.
3. Quyền ngoại lệ trước khi nghỉ không quay lại.
4. Tạo hồ sơ mới trùng email cũ của người đã nghỉ: hiện gợi ý "Nhận lại?".

## 10. INT — Tích hợp app

Mục này nêu điều VC Home phải làm. Hợp đồng chi tiết cho đội app (dạng dữ liệu, mã mẫu, danh sách kiểm) ở [07](07-tich-hop.md).

### VH-INT-01 — Bộ claim chuẩn trong token theo giai đoạn

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A, B, C |
| Tác nhân | VC ID; app (đọc token); bộ đồng bộ (đưa dữ liệu vào VC ID) |
| Mô tả | Token là cách nhanh nhất để app biết người dùng là ai và có vai trò gì. Claim là một trường thông tin trong token. Bộ claim tăng theo giai đoạn và giữ tương thích ngược: claim đã có không đổi tên, không đổi nghĩa. Token chỉ chứa thông tin công việc mức C0 và mã đơn vị (VH-NFR-07), mỗi token nhỏ hơn 4 KB. |
| Điều kiện trước | Client của app khai trên VC ID theo ky-thuat mục 5.1.5. |
| Xử lý chính | 1. GĐ A: client scope `vc-basic` (ky-thuat mục 5.1.4). Client scope là gói claim gắn vào client.<br>2. GĐ B: thêm client scope `vc-people`, gắn mặc định cho mọi client. Bộ đồng bộ ghi hồ sơ công việc thành thuộc tính user trên VC ID trong 5 phút sau khi hồ sơ đổi có hiệu lực; mapper đưa thuộc tính vào token. App thấy giá trị mới ở lần đăng nhập hoặc lần làm mới token kế tiếp.<br>3. GĐ C: thêm client scope `vc-access`:<br>  - `resource_access.<client>.roles` là claim có sẵn của Keycloak; mỗi client chỉ thấy vai trò của app mình (tắt "Full scope allowed", ky-thuat mục 5.1.5);<br>  - `vh_roles` lấy từ thuộc tính user `vh_roles_<khoá app>` qua mapper riêng của từng client, đặt tên claim `vh_roles.<khoá app>`, nên token của app X chỉ có phần của X.<br>4. `groups` giữ ở mọi giai đoạn để app làm theo GĐ A (kiểm nhóm `app-<khoá>`) vẫn chạy.<br>5. Giới hạn cỡ: `id_token` và access token, mỗi loại < 4 KB sau khi mã hoá. CI (bước kiểm tự động khi build) sinh token cho một người mẫu có 3 vị trí, 10 app, 5 vai trò mỗi app; vượt thì build lỗi. Dữ liệu dài (kiêm nhiệm đầy đủ, quản lý) lấy qua API (VH-INT-02).<br>6. Không đưa vào token: quản lý trực tiếp, loại nhân viên, ngày vào, trạng thái, nơi làm việc, SĐT (đều là C1 hoặc không cần, 05 mục 6), và mọi dữ liệu ngoài VH-BR-19.<br>7. Token có độ trễ tới lần cấp lại (access token sống 5 phút; app chỉ đọc `id_token` lúc đăng nhập). App cần biết thay đổi ngay thì dùng sự kiện (VH-INT-03).<br>8. Tên claim `vh_*` ở bảng dưới là đề xuất, chốt ở 07. |
| Ngoại lệ, thông báo lỗi | - Người chưa gắn hồ sơ: không có claim `vh_*` (không để chuỗi rỗng); app hiểu là "chưa có hồ sơ".<br>- Token mẫu vượt cỡ trong CI: "Token mẫu {n} byte, vượt giới hạn 4096 byte." |
| Dữ liệu | Thuộc tính user trên VC ID do bộ đồng bộ ghi; nguồn `people`, `positions`, `org_units`, `access_grants` |
| Quy tắc | VH-BR-01, VH-BR-19, VH-BR-20, VH-BR-24 |
| Màn hình | — |
| Phụ thuộc | VH-ACC-07, VH-AUT-08; ky-thuat mục 5.1.4, 5.1.5; 07 mục token |

**Bộ claim theo giai đoạn:**

| Claim | GĐ | Ví dụ | Nghĩa |
|---|---|---|---|
| `sub` | A | `6f1c2b7e-…` | Khoá kỹ thuật, không đổi |
| `email`, `email_verified` | A | `hoa.nt@vcpart.vn`, `true` | Email công ty |
| `name`, `given_name`, `family_name`, `picture` | A | `Nguyễn Thị Hoa` | Họ tên, ảnh (GĐ A lấy từ Google; từ GĐ B theo VC People, 05 mục 8) |
| `hd` | A | `vcpart.vn` | Domain Google Workspace |
| `groups` | A | `["app-vclinks","app-vcwiki"]` | Nhóm app; từ GĐ C do bộ đồng bộ quản |
| `sid` | A | `b2a9…` | Phiên chung, dùng cho đăng xuất |
| `vh_emp_code` | B | `VCP0123` | Mã nhân viên |
| `vh_unit` | B | `VCP-TBH1` | Mã đơn vị của vị trí chính |
| `vh_division` | B | `VCP` | Mã division của vị trí chính |
| `vh_title` | B | `NVKD` | Mã chức danh của vị trí chính |
| `vh_function` | B | `ban_hang` | Mã chức năng của vị trí chính |
| `resource_access.<client>.roles` | C | `{"vclinks":{"roles":["nvkd","cskh"]}}` | Vai trò trong app nhận token |
| `vh_roles` | C | `{"vclinks":[{"role":"nvkd","unit":"VCP-TBH1"},{"role":"cskh","unit":"VCS-CSKH"}]}` | Vai trò kèm đơn vị phạm vi (VH-BR-24) |

**Tiêu chí nghiệm thu:**
1. GĐ A: `id_token` có đủ claim của `vc-basic`.
2. GĐ B: đổi đơn vị chính của một người; sau 5 phút đăng nhập lại thì `vh_unit` có giá trị mới.
3. GĐ C: token của VCwiki không chứa vai trò VClinks ở cả `resource_access` và `vh_roles`.
4. Token của người mẫu lớn nhất < 4 KB.
5. Kiểm tự động bằng danh sách claim cho phép: không có claim nào ngoài bảng trên và claim chuẩn OIDC (`iss`, `aud`, `exp`, `iat`, `nonce`, `azp`…).

### VH-INT-02 — API danh bạ và cơ cấu cho app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | App (gọi bằng token máy, VH-INT-06) |
| Mô tả | App đọc hồ sơ công việc và cơ cấu qua API REST (giao diện lập trình qua HTTP) chỉ đọc. Từ GĐ C thêm API danh sách quyền trong chính app gọi. App không sửa được gì (VH-BR-03). |
| Điều kiện trước | App có client máy với scope phù hợp (VH-INT-06). |
| Xử lý chính | 1. Các API ở bảng dưới; đường dẫn chốt ở 07.<br>2. Phân trang bằng cursor: server trả một con trỏ mốc, app gửi lại để lấy trang sau. `limit` mặc định 100, tối đa 500.<br>3. `changed_since` (VH-API-02, VH-API-06): trả bản ghi đổi từ mốc đó, kể cả người đã nghỉ, để app đồng bộ tăng dần.<br>4. Dữ liệu trả theo `apps.people_data_level`: app mức C0 chỉ nhận trường C0; app mức C1 nhận thêm trường C1 (quản lý, loại nhân viên, ngày vào, nơi làm việc, trạng thái). Không bao giờ có dữ liệu ngoài VH-BR-19.<br>5. Ngày giờ dạng ISO 8601 có múi giờ `+07:00` (VH-BR-22).<br>6. VH-API-06 chỉ trả quyền của app gắn với client gọi; không có tham số chọn app khác.<br>7. Mỗi lần gọi ghi nhật ký truy cập (client, đường dẫn, số bản ghi), không ghi nội dung trả về.<br>8. Giới hạn tần suất 600 lượt mỗi phút cho mỗi app (VH-NFR-04). Thời gian trả lời ≤ 300 ms (p95, VH-NFR-13). |
| Ngoại lệ, thông báo lỗi | Trả JSON `{error, message}`:<br>- 401 `invalid_token`: "Token không hợp lệ hoặc đã hết hạn."<br>- 403 `insufficient_scope`: "Token thiếu scope {scope}."<br>- 403 `not_service_token`: "API này chỉ nhận token máy của app."<br>- 404 `not_found`: "Không có nhân viên {mã}." hoặc "Không có đơn vị {mã}."<br>- 400 `invalid_cursor`: "Con trỏ không hợp lệ. Hãy bắt đầu lại từ trang đầu."<br>- 429 `rate_limited`: "Gọi quá nhanh. Thử lại sau {n} giây." |
| Dữ liệu | Đọc `people`, `positions`, `org_units`, `job_titles`, `job_functions`, `legal_entities`, `access_grants`, `apps.people_data_level`; ghi `audit_log` (truy cập API) |
| Quy tắc | VH-BR-03, VH-BR-19, VH-BR-22 |
| Màn hình | — |
| Phụ thuộc | VH-INT-06, VH-NSU-01, VH-NSU-02, VH-NSU-03, VH-ORG-01, VH-ORG-02, VH-ORG-03, VH-ORG-07, VH-ACC-02 |

**API cho app và yêu cầu chứa nó:**

| Mã | Đường dẫn (đề xuất, chốt ở 07) | Scope | Trả về | GĐ | Thuộc yêu cầu |
|---|---|---|---|---|---|
| VH-API-01 | `GET /api/v1/people/{ma_nv}`; `GET /api/v1/people/by-sub/{sub}` | `vh.people.read` | Một nhân viên: mã, `sub`, họ tên, email, ảnh, SĐT công việc, pháp nhân, mọi vị trí còn hiệu lực (đơn vị, chức danh, chức năng, chính hay kiêm nhiệm); trường C1 nếu app mức C1 | B | VH-INT-02 |
| VH-API-02 | `GET /api/v1/people?unit=&include_sub_units=&function=&status=&changed_since=&cursor=&limit=` | `vh.people.read` | Danh sách như trên | B | VH-INT-02 |
| VH-API-03 | `GET /api/v1/people/{ma_nv}/managers` | `vh.people.read` | Chuỗi quản lý từ gần tới xa, tới người đứng đầu (chỉ app mức C1) | B | VH-INT-02 |
| VH-API-04 | `GET /api/v1/org-units?include_inactive=`; `GET /api/v1/org-units/{ma}` | `vh.people.read` | Cây đơn vị; một đơn vị (mã, tên, loại, cha, division, pháp nhân, trưởng, trạng thái, ngày hiệu lực) | B | VH-INT-02 |
| VH-API-05 | `GET /api/v1/catalogs/job-titles`, `/job-functions`, `/legal-entities` | `vh.people.read` | Danh mục | B | VH-INT-02 |
| VH-API-06 | `GET /api/v1/grants?role=&unit=&changed_since=&cursor=&limit=` | `vh.grants.read` | Ai có vai trò gì trong app gọi: mã NV, `sub`, vai trò, đơn vị, trạng thái (Hiệu lực hoặc Chuyển tiếp), hạn | C | VH-INT-02 |
| VH-API-07 | `GET /api/v1/events?after=&limit=` | Theo loại sự kiện (VH-INT-05) | Sự kiện của app gọi từ một mốc | C | VH-INT-05 |
| (mọi API trên) | Xác thực bằng token máy | — | — | B | VH-INT-06 |

**Tiêu chí nghiệm thu:**
1. App có `vh.people.read` gọi VH-API-02 lọc đơn vị VCservice gồm đơn vị con: đúng danh sách; trang tối đa 500 dòng.
2. Gọi VH-API-06 bằng token không có `vh.grants.read`: 403 đúng câu.
3. VCwiki gọi VH-API-06 chỉ nhận quyền VCwiki.
4. `changed_since` trả cả người vừa nghỉ việc với trạng thái Đã nghỉ.
5. App mức C0 không nhận trường quản lý trực tiếp ở VH-API-01 và bị từ chối ở VH-API-03.

### VH-INT-03 — Sự kiện thay đổi gửi app (có chữ ký, gửi lại)

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · C |
| Tác nhân | VC Home (gửi); app (nhận) |
| Mô tả | Khi hồ sơ, cơ cấu hay quyền đổi, VC Home gọi webhook của app: một yêu cầu HTTP POST tới URL app đã đăng ký. Mỗi lần gửi có chữ ký để app biết đúng là VC Home. Gửi "ít nhất một lần": có thể trùng, app tự bỏ bản trùng theo mã sự kiện. |
| Điều kiện trước | App khai URL nhận sự kiện (`https://`), loại sự kiện đăng ký, và có bí mật ký (VH-APP-01, VH-MH-15). |
| Xử lý chính | 1. Sự kiện ghi vào `event_outbox` trong cùng giao dịch với thay đổi gốc (mẫu outbox: không có thay đổi nào thiếu sự kiện, không có sự kiện nào mà thay đổi bị huỷ).<br>2. Người nhận: `vh.person.*` và `vh.org.unit_changed` gửi mọi app đăng ký loại đó; `vh.grant.added`, `vh.grant.removed` chỉ gửi app của quyền (`target_app_keys`).<br>3. Thân sự kiện (JSON): `id` (UUID v7, có thứ tự thời gian), `type`, `spec_version`, `occurred_at`, `effective_at`, `subject` (`employee_code`, `sub`; hoặc `unit_code`), `stream`, `sequence`, `correlation_id`, `data` (ảnh chụp đầy đủ sau thay đổi). Trường C1 bị bỏ khi gửi app mức C0.<br>4. Header: `X-VH-Event-Id` = `id`; `X-VH-Timestamp` = giây Unix lúc gửi; `X-VH-Signature` = `v1=` + hex của HMAC-SHA256(bí mật của app, timestamp + "." + thân). HMAC-SHA256 là chữ ký tạo bằng một bí mật dùng chung giữa VC Home và app.<br>5. App kiểm: chữ ký đúng; timestamp lệch ≤ 5 phút; `X-VH-Event-Id` chưa xử lý. Trả 2xx trong 5 giây là nhận xong (05 mục 4.5).<br>6. Không nhận được (lỗi mạng, quá 5 giây, mã khác 2xx): gửi lại sau 1 phút, mỗi lần sau chờ gấp đôi, tối đa 4 giờ một lần; tròn 24 giờ kể từ lần gửi đầu thì dừng, trạng thái Thất bại.<br>7. Thứ tự: sự kiện cùng một luồng gửi lần lượt; sự kiện sau chỉ gửi khi sự kiện trước đã nhận hoặc đã Thất bại. Luồng là: hồ sơ của một người (`person:<id>`); quyền của một người trong một app (`grant:<id>:<app>`); một đơn vị (`org_unit:<mã>`). Luồng khác nhau gửi song song, nên app không được giả định thứ tự giữa hai luồng: nhận `vh.grant.added` cho người chưa biết thì gọi VH-API-01.<br>8. Thất bại: cảnh báo quản trị hệ thống và chủ app (VH-ADM-04); app lấy bù qua VH-INT-05; quản trị bấm "Gửi lại" được.<br>9. Xoay bí mật: trong 7 ngày sau khi xoay, header ký bằng cả bí mật mới và cũ (`v1=<chữ ký mới>,v1=<chữ ký cũ>`); sau 7 ngày bỏ bí mật cũ.<br>10. VH-MH-15 cho chủ app xem lần gửi trong 7 ngày gần nhất (mã, loại, kết quả, số lần thử) và bấm "Gửi thử" khi khai URL.<br>11. Sự kiện để app bàn giao: `vh.person.moved`, `vh.person.left` (VClinks M1b-11, 01 mục 7). |
| Ngoại lệ, thông báo lỗi | - URL không phải HTTPS: "URL nhận sự kiện phải dùng HTTPS."<br>- Gửi thử thất bại: "Gửi thử tới {URL} không thành công: {mã lỗi}. Kiểm tra endpoint của app."<br>- App lỗi kéo dài: cảnh báo "App {tên}: {n} sự kiện chờ quá 1 giờ." |
| Dữ liệu | `event_outbox` (`_id`, `type`, `spec_version`, `occurred_at`, `effective_at`, `subject`, `stream`, `sequence`, `correlation_id`, `data`, `target_app_keys`), `event_deliveries` (`app_seq`, `status`, `attempts`, `next_attempt_at`, `last_http_status`, `delivered_at`, `failed_at`), `apps` (`event_webhook_url`, `event_types`, `event_secret`, `event_secret_prev`, `people_data_level`) |
| Quy tắc | VH-BR-03, VH-BR-14, VH-BR-15, VH-BR-19, VH-BR-22 |
| Màn hình | VH-MH-15 |
| Phụ thuộc | VH-APP-01, VH-APP-04, VH-INT-05, VH-ADM-04; 07 mục sự kiện |

**Sự kiện và lúc sinh:**

| Sự kiện | Sinh khi | `data` chính | GĐ |
|---|---|---|---|
| `vh.person.joined` | Hồ sơ có hiệu lực ngày vào làm (cả nhận lại, cờ `rehire`) | Hồ sơ, vị trí | C |
| `vh.person.updated` | Đổi tên, email, ảnh, loại nhân viên (đề xuất thêm nơi làm việc, SĐT công việc, pháp nhân; xem Đề xuất bổ sung) | Hồ sơ sau thay đổi, trường đã đổi | C |
| `vh.person.moved` | Đổi vị trí chính, thêm hoặc bỏ kiêm nhiệm, đổi quản lý; sửa nhập nhầm vị trí | Vị trí cũ, mới; quản lý cũ, mới | C |
| `vh.person.leave_started` | Bắt đầu nghỉ dài ngày | Từ ngày, đến ngày dự kiến, có khoá không | D |
| `vh.person.returned` | Kết thúc nghỉ dài ngày | Ngày đi làm lại | D |
| `vh.person.left` | Nghỉ việc có hiệu lực | Ngày nghỉ, đơn vị cuối, quản lý cuối | C |
| `vh.grant.added` | Một quyền hiệu lực (app, vai trò, đơn vị) xuất hiện | Thay đổi, cùng danh sách vai trò hiện có trong app | C |
| `vh.grant.removed` | Một quyền hiệu lực biến mất | Thay đổi kèm lý do, cùng danh sách vai trò còn lại | C |
| `vh.org.unit_changed` | Thêm, đổi tên, chuyển, gộp, ngừng đơn vị (đề xuất thêm đổi trưởng đơn vị) | Loại thay đổi, đơn vị sau thay đổi | C |

**Tiêu chí nghiệm thu:**
1. Chữ ký kiểm được bằng đoạn mã mẫu ở 07; sửa 1 byte thân thì kiểm thất bại.
2. App trả 500 ba lần rồi 200: app xử lý đúng 1 lần (bỏ trùng theo `X-VH-Event-Id`); `event_deliveries` ghi 4 lần thử.
3. Hai sự kiện cùng luồng: sự kiện 2 không gửi trước khi sự kiện 1 được nhận.
4. App tắt 25 giờ: sự kiện chuyển Thất bại, có cảnh báo; VH-API-07 vẫn trả đủ sự kiện đó.
5. VCwiki không nhận `vh.grant.*` của VClinks; app mức C0 không nhận trường quản lý trong `data`.

### VH-INT-04 — Đăng xuất phía máy chủ (back-channel)

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A |
| Tác nhân | VC ID; app; quản trị hệ thống |
| Mô tả | Đăng xuất phía máy chủ (back-channel): VC ID gọi thẳng máy chủ của từng app, không qua trình duyệt, để app huỷ phiên của người dùng. Nhờ đó đăng xuất một nơi, bị khoá hay nghỉ việc là mất phiên ở mọi app. Mọi app đăng nhập qua VC ID bắt buộc có endpoint này. |
| Điều kiện trước | App là client confidential trên VC ID, có `backchannel.logout.url` và `backchannel.logout.session.required = true` (ky-thuat mục 5.1.5). |
| Xử lý chính | 1. VC ID gửi `logout_token` tới mọi app đang có phiên của người đó khi: người dùng đăng xuất ở bất kỳ app nào hay ở VC Home (VH-AUT-04); quản trị khoá khẩn cấp (VH-AUT-06); khoá theo Google (VH-AUT-07); nghỉ việc (VH-LCM-03); khoá khi nghỉ dài ngày (VH-LCM-04); HC-NS tạm khoá hồ sơ.<br>2. App kiểm đủ điểm theo ky-thuat mục 5.2 điểm 7: chữ ký JWKS (bộ khoá công khai của VC ID), `iss`, `aud`, `iat` trong 5 phút, claim `events` đúng, không có `nonce`, có `sid` hoặc `sub`, `jti` chưa dùng. Đạt thì huỷ phiên theo `sid`, không có `sid` thì theo `sub`; trả 200.<br>3. Thời gian: từ lúc đăng xuất tới lúc mọi app mất phiên ≤ 10 giây; từ lúc khoá ≤ 1 phút.<br>4. VC Home là SPA (ứng dụng chạy trên trình duyệt), không giữ phiên nên không cần endpoint. Từ GĐ B, VC Home API nhận access token sống 5 phút; sau đăng xuất, token cũ hết dùng chậm nhất sau 5 phút.<br>5. Khi đưa app mới vào (VH-APP-04): quản trị hệ thống cho VC ID gửi thử một `logout_token` với user thử; không đạt thì không chuyển app sang `live`.<br>6. Lỗi gửi back-channel được gom theo giờ và cảnh báo (VH-ADM-04). |
| Ngoại lệ, thông báo lỗi | - App trả khác 200: VC ID ghi sự kiện lỗi; cảnh báo "Đăng xuất phía máy chủ tới {app} lỗi {n} lần trong giờ qua."<br>- App chưa có endpoint: "App chưa có endpoint đăng xuất phía máy chủ. Xem hợp đồng tích hợp (07)." (chặn chuyển sang `live`) |
| Dữ liệu | Nhật ký sự kiện của VC ID; `apps.onboarding` (kết quả gửi thử); `audit_log` |
| Quy tắc | VH-BR-14, VH-BR-20 |
| Màn hình | VH-MH-15 |
| Phụ thuộc | VH-AUT-04, VH-AUT-06, VH-AUT-07, VH-APP-04, VH-ADM-04; ky-thuat mục 3.3, 5.2 |

**Tiêu chí nghiệm thu:**
1. Đăng xuất ở VClinks: VCwiki và VC Home mất phiên trong ≤ 10 giây.
2. Quản trị khoá khẩn cấp một người: mọi app mất phiên ≤ 1 phút; đăng nhập lại bị chặn.
3. Gửi lại cùng `logout_token` (cùng `jti`): app trả 400, không lỗi khác.
4. App mới không qua bước gửi thử thì không chuyển được sang `live`.

### VH-INT-05 — Kéo sự kiện dự phòng

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · C |
| Tác nhân | App |
| Mô tả | Khi app bỏ lỡ sự kiện (máy chủ app tắt quá 24 giờ, xử lý lỗi), app tự kéo sự kiện từ một mốc qua VH-API-07. Kéo trả đúng các sự kiện app nhận qua webhook, cùng mã, cùng thứ tự. |
| Điều kiện trước | Token máy có scope phù hợp (VH-INT-06). |
| Xử lý chính | 1. `GET /api/v1/events?after=<cursor>&limit=<n>`: trả sự kiện của app gọi theo thứ tự hàng của app (`event_deliveries.app_seq`), kèm `next_cursor`. `limit` mặc định 100, tối đa 1.000.<br>2. Bỏ trống `after`: trả từ sự kiện cũ nhất còn kéo được.<br>3. Kéo được trong 30 ngày (sự kiện lưu 90 ngày để tra lỗi, 05 mục 7.1).<br>4. Scope: `vh.people.read` thấy `vh.person.*`, `vh.org.*`; `vh.grants.read` thấy `vh.grant.*`. Thiếu scope nào thì không thấy loại đó.<br>5. App lưu cursor cuối đã xử lý; xử lý lại sự kiện đã có (cùng `id`) không gây hại.<br>6. Khuyến nghị cho app (ghi ở 07): khởi động lại sau sự cố thì kéo từ cursor cuối trước khi nhận webhook mới; mỗi ngày kéo một lần để kiểm không sót.<br>7. Kéo không đổi trạng thái gửi webhook. |
| Ngoại lệ, thông báo lỗi | - Mốc quá 30 ngày: 410 `cursor_expired`, "Mốc đã quá 30 ngày. Hãy đồng bộ lại toàn bộ qua VH-API-02 và VH-API-06 rồi kéo từ mốc mới."<br>- Cursor sai: 400 `invalid_cursor`, "Con trỏ không hợp lệ. Hãy bắt đầu lại từ trang đầu." |
| Dữ liệu | `event_outbox`, `event_deliveries.app_seq`; `audit_log` (truy cập API) |
| Quy tắc | VH-BR-22 |
| Màn hình | — |
| Phụ thuộc | VH-INT-03, VH-INT-06, VH-INT-02 |

**Tiêu chí nghiệm thu:**
1. App bỏ lỡ 50 sự kiện: kéo từ cursor cuối nhận đúng 50 sự kiện, đúng thứ tự, cùng `id` với webhook.
2. Token chỉ có `vh.people.read`: không thấy `vh.grant.*`.
3. Mốc 31 ngày trước: 410 đúng câu.

### VH-INT-06 — Token máy cho app gọi API VC Home

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | App (máy chủ); quản trị hệ thống (khai client); VC ID |
| Mô tả | App gọi API VC Home bằng token máy lấy theo luồng OAuth client credentials: máy chủ app dùng mã client và khoá bí mật của mình để xin token tại VC ID, không cần người đăng nhập. Token mang scope, tức danh sách việc app được làm. |
| Điều kiện trước | App đã có trong danh mục; chủ app đề nghị scope cần dùng. |
| Xử lý chính | 1. Quản trị hệ thống khai client máy `<khoá app>-service` (confidential, chỉ bật service account) trong cấu hình realm dạng code (ky-thuat mục 5.1.7); gán client scope tuỳ chọn `vh.people.read` và/hoặc `vh.grants.read`; ghi `apps.service_client_id`.<br>2. Khoá bí mật giao cho đội app qua kho bí mật, không qua chat hay email.<br>3. App gọi `POST {issuer}/protocol/openid-connect/token` với `grant_type=client_credentials` và scope cần dùng. Token sống 5 phút; app giữ lại dùng và xin lại trước khi hết hạn.<br>4. VC Home API kiểm: chữ ký qua JWKS, `iss`, `aud` là VC Home API, `exp`, scope; xác định app gọi từ `azp` (client id) để lọc VH-API-06, VH-API-07 và áp `people_data_level`.<br>5. Tối thiểu: chỉ cấp scope app thật sự cần; `vh.grants.read` chỉ cho app có vai trò app.<br>6. Xoay khoá bí mật 6 tháng một lần (VH-NFR-05); lộ khoá thì xoay ngay.<br>7. Thu hồi: tắt client trên VC ID; token đang có hết dùng trong 5 phút.<br>8. Token máy riêng của từng app (`vcz_`, `vcmcp_`) không đổi và không dùng để gọi VC Home. |
| Ngoại lệ, thông báo lỗi | - Sai khoá: VC ID trả `invalid_client`.<br>- Xin scope chưa được gán: VC ID trả `invalid_scope`.<br>- Token người dùng gọi API cho app: 403 `not_service_token`, "API này chỉ nhận token máy của app." |
| Dữ liệu | Cấu hình client trên VC ID; `apps.service_client_id`; `audit_log` |
| Quy tắc | VH-BR-03, VH-BR-19 |
| Màn hình | VH-MH-15 (xem client máy và scope của app; khai thật ở cấu hình VC ID) |
| Phụ thuộc | VH-INT-02, VH-INT-05, VH-APP-01; ky-thuat mục 5.1.5, 5.1.7, 5.7 |

**Tiêu chí nghiệm thu:**
1. Client `vclinks-service` xin token với scope `vh.people.read` và gọi VH-API-01 thành công.
2. Xin `vh.grants.read` khi chưa được gán: `invalid_scope`.
3. Tắt client: sau 5 phút mọi lời gọi trả 401.
4. Token của một người dùng gọi VH-API-02: 403 đúng câu.

### VH-INT-07 — API trạng thái app cho ô app

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | C · E |
| Tác nhân | VC Home (gọi); app (trả lời) |
| Mô tả | Ô app trên trang chủ hiện số việc chờ, ví dụ "3 phiếu chờ xử lý". VC Home gọi API trạng thái do từng app cung cấp (VH-API-09) bằng access token của người đang xem. |
| Điều kiện trước | App khai `status_url` trong danh mục; access token của VC Home có `aud` của app (thêm mapper audience, ky-thuat mục 14). |
| Xử lý chính | 1. Sau khi lưới app hiện xong, trình duyệt gọi song song `GET <app>/api/vc-app/status` cho các ô app người dùng có quyền.<br>2. App trả `{access: "granted" hoặc "pending", badges: [{label, count, url}]}`; tối đa 3 badge.<br>3. Chờ tối đa 2 giây; lỗi hay chậm thì ô hiện bình thường, không badge, không báo lỗi người dùng.<br>4. Giữ kết quả 60 giây trên trình duyệt; bấm badge mở `url` trong app.<br>5. `label` không chứa dữ liệu cá nhân của người khác. |
| Ngoại lệ, thông báo lỗi | Không có câu lỗi cho người dùng (ẩn badge). Lỗi ghi ở log trình duyệt cho dev. |
| Dữ liệu | `apps.status_url` |
| Quy tắc | VH-BR-19, VH-BR-21 |
| Màn hình | VH-MH-02 |
| Phụ thuộc | VH-HOM-07, VH-API-09, VH-APP-04 |

**Tiêu chí nghiệm thu:**
1. App trả 3 phiếu chờ: ô app hiện badge "3" và mở đúng trang khi bấm.
2. App chậm 3 giây: trang chủ không chờ, ô hiện bình thường không badge.
3. Tải lại trang trong 60 giây không gọi lại app.

### VH-INT-08 — Cấp tài khoản theo chuẩn SCIM cho app mua ngoài

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | W · — |
| Tác nhân | — |
| Mô tả | SCIM là chuẩn để hệ thống định danh tự tạo, sửa, khoá tài khoản trong app mua ngoài (phần mềm thuê bao). Lần này **không làm**. |
| Điều kiện trước | — |
| Xử lý chính | Không làm, vì:<br>1. Mọi app hiện có và dự kiến (VClinks, VCwiki, VCsale, VCgarage, VC AI, VCe, VCinvoice) là app nội bộ, nối bằng OIDC + sự kiện + API (VH-INT-01 đến 06). Cách này đủ cho vào làm, chuyển, nghỉ.<br>2. Keycloak không có sẵn SCIM; phải thêm plugin, tăng việc vận hành và chỗ có thể bị tấn công.<br>3. Chưa có app mua ngoài nào cần cấp tài khoản tự động.<br>**Xem lại khi:** công ty mua một app ngoài có SCIM và trên 20 người dùng, hoặc cần khoá tài khoản ở app ngoài ngay ngày nghỉ việc. Khi đó cân nhắc plugin SCIM cho Keycloak, hoặc một bộ chuyển nhận sự kiện VC Home rồi gọi SCIM của app. |
| Ngoại lệ, thông báo lỗi | — |
| Dữ liệu | — |
| Quy tắc | — |
| Màn hình | — |
| Phụ thuộc | VH-INT-03 (nguồn sự kiện nếu làm sau) |

**Tiêu chí nghiệm thu:**
1. Không áp dụng ở bộ tài liệu này. 07 ghi rõ SCIM chưa hỗ trợ và cách tạm cho app ngoài: tạo, khoá tài khoản tay theo `vh.person.joined`, `vh.person.left`.

## 11. ADM — Quản trị và nhật ký

### VH-ADM-01 — Nhật ký thao tác

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · A trở đi |
| Tác nhân | Hệ thống (ghi); quản trị hệ thống, kiểm soát (xem toàn bộ); HC-NS (dòng hồ sơ trong phạm vi); chủ app (dòng của app mình); nhân viên (dòng về chính mình) |
| Mô tả | Mọi thay đổi quan trọng ghi một dòng nhật ký: ai, lúc nào, làm gì, trên đối tượng nào, trước và sau, lý do. Nhật ký chỉ ghi thêm; không ai sửa hay xoá được, kể cả quản trị hệ thống. Giữ 24 tháng (VH-BR-18). |
| Điều kiện trước | — |
| Xử lý chính | 1. GĐ A: nhật ký là nhật ký sự kiện đăng nhập và nhật ký quản trị của VC ID (giữ 24 tháng, ky-thuat mục 5.1.1) cộng log của `vc-provisioner` (khoá, mở khoá, lý do). VC Home chưa có database.<br>2. Từ GĐ B: VC Home API ghi `audit_log` cho mọi việc ở VH-BR-18: tạo, sửa, xoá mềm hồ sơ, vị trí, cơ cấu, danh mục, app, vai trò app, luật, quyền, yêu cầu, quyết định duyệt, rà soát, cài đặt; mỗi lần xem hồ sơ C1 của người khác (`person.view_c1`); mỗi lần khoá, mở khoá; mỗi lần tải dữ liệu ra (Excel, CSV).<br>3. Một job mỗi giờ chép sự kiện đăng nhập, đăng xuất, khoá của VC ID sang `audit_log` (`actor.type = vc_id`) để xem một chỗ.<br>4. Các trường của một dòng: bảng dưới.<br>5. Ghi trong cùng giao dịch với thay đổi; ghi nhật ký lỗi thì thay đổi không được lưu.<br>6. Chống sửa:<br>  - tài khoản database của VC Home API chỉ có quyền thêm và đọc trên `audit_log`;<br>  - mỗi dòng có `hash` (SHA-256, hàm băm cho ra mã cố định theo nội dung);<br>  - mỗi ngày một dòng niêm phong `audit.daily_seal` nối chuỗi mã băm các dòng trong ngày với mã của ngày trước; bản niêm phong chép ra kho sao lưu ngoài máy;<br>  - job hằng ngày kiểm chuỗi; lệch thì cảnh báo khẩn (VH-NFR-09).<br>7. Hết 24 tháng: chỉ mục TTL (MongoDB tự xoá theo trường `expires_at`) xoá dòng quá hạn (05 mục 3.18).<br>8. Xem ở VH-MH-19: lọc theo khoảng thời gian, người làm, đối tượng (người, đơn vị, app, luật, quyền, yêu cầu), loại việc, `correlation_id`; xem trước/sau dạng so sánh; tải CSV. Xuất 1 tháng ≤ 30 giây.<br>9. Phạm vi xem theo 02 mục 3: nhân viên xem dòng về hồ sơ và quyền của mình ở VH-MH-03, VH-MH-04; HC-NS xem dòng hồ sơ trong phạm vi; chủ app xem dòng của app mình; quản trị hệ thống, kiểm soát xem hết. |
| Ngoại lệ, thông báo lỗi | - Không có kết quả: "Không có dòng nhật ký nào khớp bộ lọc."<br>- Khoảng thời gian quá 24 tháng: "Nhật ký chỉ giữ 24 tháng."<br>- Tải quá 100.000 dòng: "Mỗi lần tải tối đa 100.000 dòng. Hãy thu hẹp bộ lọc."<br>- Thao tác bắt buộc lý do mà thiếu (cấp khẩn cấp, khoá, gỡ tay): thao tác bị chặn ở màn tương ứng. |
| Dữ liệu | `audit_log`; nhật ký sự kiện của VC ID |
| Quy tắc | VH-BR-18, VH-BR-19, VH-BR-22 |
| Màn hình | VH-MH-19; VH-MH-03, VH-MH-04 (phần của mình) |
| Phụ thuộc | Mọi yêu cầu có thay đổi dữ liệu; VH-ADM-04 |

**Trường của một dòng nhật ký** (theo 05 mục 3.18):

| Trường | Nghĩa | Ví dụ |
|---|---|---|
| `at` | Lúc xảy ra (lưu UTC, hiện giờ Việt Nam) | `2026-11-30T17:00:02Z` |
| `actor` | Người làm: loại (`nguoi`, `he_thong`, `app`, `vc_id`), `person_id`, `employee_code`, `app_key`, `on_behalf_of_person_id` (duyệt thay, xin thay) | `{type: "nguoi", employee_code: "VCP0007"}` |
| `action` | Loại việc, dạng `đối_tượng.việc` | `grant.remove`, `rule.approve`, `person.view_c1`, `account.lock` |
| `target` | Đối tượng: loại, mã, nhãn (nhãn là mã, không ghi họ tên) | `{type: "grant", label: "VCP0123"}` |
| `before`, `after` | Giá trị trước, sau; chỉ trường đổi; không bao giờ chứa bí mật hay token | `{end_on: null}` → `{end_on: "2026-11-30"}` |
| `reason` | Lý do (≤ 300 ký tự); bắt buộc với cấp khẩn cấp, khoá, gỡ tay | "Thay trưởng ca CSKH nghỉ đột xuất" |
| `ip_prefix` | IP rút gọn: IPv4 bỏ nhóm số cuối | `113.161.20.0/24` |
| `correlation_id` | Mã nối các dòng và sự kiện của cùng một thao tác (VH-NFR-17) | `c-20261201-0000-a91e` |
| `hash` | Mã băm của dòng | `9d1e…c04a` |
| `expires_at` | `at` + 24 tháng | `2028-11-30T17:00:02Z` |

**Tiêu chí nghiệm thu:**
1. Gỡ tay một quyền: có một dòng `grant.remove` với người làm, trước/sau, lý do, `correlation_id` trùng với sự kiện `vh.grant.removed`.
2. Sửa trực tiếp một dòng trong database thử: job kiểm hằng ngày báo lệch.
3. API của VC Home không có thao tác sửa hay xoá nhật ký; tài khoản database không có quyền `update`, `remove` trên `audit_log`.
4. Nhân viên chỉ thấy dòng về mình; chủ app VCwiki không thấy dòng của VClinks.
5. Xuất CSV 1 tháng nhật ký ≤ 30 giây.

### VH-ADM-02 — Báo cáo truy cập

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · C |
| Tác nhân | Quản trị hệ thống; kiểm soát; ban giám đốc (chỉ số liệu); trưởng đơn vị, HC-NS (phạm vi của mình); chủ app (app mình) |
| Mô tả | Báo cáo tổng hợp trả lời: bao nhiêu người dùng app nào với vai trò gì; quyền ngoại lệ, khẩn cấp còn bao nhiêu; vào làm, nghỉ việc được xử lý nhanh hay chậm; rà soát có làm đúng hạn không. |
| Điều kiện trước | — |
| Xử lý chính | 1. Chọn báo cáo (bảng dưới), kỳ (tháng, quý, khoảng ngày), lọc pháp nhân, đơn vị, app.<br>2. Ban giám đốc chỉ thấy số đếm, không thấy danh sách tên.<br>3. Người có quyền xem danh sách bấm vào một số đếm thì mở danh sách ở VH-ACC-08.<br>4. Tải Excel; mỗi lần tải ghi nhật ký.<br>5. Ngày 1 hằng tháng, 08:00, gửi bản tóm tắt tháng trước cho quản trị hệ thống và kiểm soát.<br>6. Báo cáo ra trong ≤ 5 giây với dữ liệu 1.000 người. |
| Ngoại lệ, thông báo lỗi | - Không có dữ liệu: "Không có dữ liệu trong kỳ đã chọn."<br>- Ngoài phạm vi: "Bạn không có quyền xem báo cáo này." |
| Dữ liệu | Đọc `access_grants`, `access_requests`, `approval_steps`, `review_campaigns`, `review_items`, `people`, `accounts`, `import_batches`, `audit_log` |
| Quy tắc | VH-BR-17, VH-BR-19, VH-BR-23 |
| Màn hình | VH-MH-17 (thẻ "Báo cáo", mọi người xem báo cáo đều vào đây trong phạm vi của mình); VH-MH-09 chỉ hiện tóm tắt đội (xem Đề xuất bổ sung về màn cho ban giám đốc) |
| Phụ thuộc | VH-ACC-08, VH-ACC-07, VH-REV-03, VH-IMP-02 |

**Bộ báo cáo:**

| Báo cáo | Nội dung | Người xem | GĐ |
|---|---|---|---|
| Người dùng theo app | Số người theo app, vai trò, đơn vị; theo nguồn; tỉ lệ quyền từ luật (đích ≥ 90%, 12 RR-06) | Mọi vai trò ở cột Tác nhân, theo phạm vi | C |
| Cấp khẩn cấp | Mọi lần cấp trong kỳ: ai cấp, cho ai, vai trò, lý do, bao lâu; lần lặp lại | Quản trị hệ thống, kiểm soát | C |
| Vòng đời | Vào làm: thời gian từ 00:00 ngày vào tới khi có quyền. Nghỉ việc: thời gian tới khi khoá; số tài khoản còn quyền sau ngày nghỉ (phải bằng 0) | Quản trị hệ thống, kiểm soát, HC-NS | C |
| Không dùng | Người có quyền trong app mà 90 ngày không đăng nhập app đó | Quản trị hệ thống, chủ app, trưởng đơn vị | C |
| Lệch | Lệch VC ID (VH-ACC-07); lệch Google (VH-IMP-02) | Quản trị hệ thống | C |
| Quyền ngoại lệ | Đang hiệu lực, sắp hết hạn trong 14 ngày, theo app, theo vai trò nhạy cảm | Quản trị hệ thống, kiểm soát, chủ app | D |
| Yêu cầu | Số gửi, duyệt, từ chối, tự huỷ; thời gian duyệt trung vị; theo người duyệt | Quản trị hệ thống, kiểm soát | D |
| Rà soát | Kết quả từng đợt (VH-REV-03) | Quản trị hệ thống, kiểm soát, ban giám đốc (số), trưởng đơn vị (phần mình) | D |

**Tiêu chí nghiệm thu:**
1. Số người dùng VClinks theo vai trò khớp với tra cứu VH-ACC-08 cùng bộ lọc.
2. Ban giám đốc mở báo cáo rà soát chỉ thấy số, không thấy tên.
3. Báo cáo vòng đời tháng có nghỉ việc: số tài khoản còn quyền sau ngày nghỉ bằng 0.
4. Ngày 1 hằng tháng, quản trị hệ thống và kiểm soát nhận bản tóm tắt.

### VH-ADM-03 — Vai trò quản trị của chính VC Home

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | Quản trị hệ thống; chủ app của VC Home; kiểm soát; chủ dự án (chốt tên người theo Q-07) |
| Mô tả | VC Home là một app trong danh mục, khoá `vchome`. Vai trò quản trị của VC Home là vai trò app của nó: `vchome:hcns`, `vchome:qtht`, `vchome:kiem_soat`, `vchome:bgd`. Nhân viên, quản lý, trưởng đơn vị là vai trò suy ra từ hồ sơ, không gán (02 mục 2). Hệ thống chặn các tổ hợp xung đột tách nhiệm (VH-BR-17). |
| Điều kiện trước | Q-07 đã chốt người giữ từng vai trò (mỗi vai trò ít nhất 2 người). |
| Xử lý chính | 1. Khai app `vchome` với 4 vai trò. `qtht`, `kiem_soat` là vai trò nhạy cảm (02 mục 2, VH-NFR-06). `hcns` gắn đơn vị (phạm vi là pháp nhân hoặc division; gắn đơn vị gốc nghĩa là toàn tập đoàn). Chủ app của VC Home nên là người không giữ `vchome:qtht` (đề xuất: chủ dự án), để bước duyệt thứ hai không do chính quản trị hệ thống làm cho nhau.<br>2. GĐ B (chưa có luật và yêu cầu): danh sách người giữ 4 vai trò khai trong cấu hình VC ID dạng code (client role của client `vc-home`); đổi qua merge request có người thứ hai duyệt. VC Home API đọc vai trò từ token. Mỗi lần đổi ghi nhật ký.<br>3. GĐ C: chuyển sang `access_grants` bằng luật theo thuộc tính, ví dụ:<br>  - `vchome:hcns`: chức năng thuộc {Nhân sự}, đơn vị gắn "division của vị trí";<br>  - `vchome:bgd`: chức năng thuộc {Ban giám đốc};<br>  - `vchome:qtht`, `vchome:kiem_soat`: chức danh thuộc {chức danh quản trị hệ thống} hoặc {chức danh kiểm soát nội bộ}.<br>  So khớp với danh sách GĐ B rồi bỏ danh sách đó.<br>4. GĐ D: thêm đường xin quyền cho 4 vai trò (VH-REQ-01); `qtht`, `kiem_soat` qua bước 2.<br>5. Tách nhiệm: trước khi một quyền `vchome:*` có hiệu lực, kiểm các cặp cấm (02 mục 6): `hcns` với `qtht`; `kiem_soat` với `qtht`. Có xung đột thì quyền đến sau không được tạo (VH-ACC-02 bước 12), báo quản trị hệ thống và kiểm soát.<br>6. Ngoại lệ tách nhiệm (02 mục 6): một quản trị hệ thống **khác** người được miễn bật ngoại lệ cho một người, ghi lý do, hạn mặc định 30 ngày, tối đa 90 ngày; kiểm soát được báo. Hết hạn thì quyền đến sau bị gỡ (`go_tay`, lý do "hết ngoại lệ tách nhiệm") và báo.<br>7. Luôn có ít nhất 2 người giữ `vchome:qtht`: thao tác tay (gỡ, tắt luật) làm còn 0 người thì bị chặn; còn 1 người thì cảnh báo. Nghỉ việc không bị chặn, chỉ cảnh báo khẩn. Mất hết quản trị thì dùng tài khoản khẩn cấp ở realm `master` (ky-thuat mục 5.7).<br>8. Menu VC Home hiện theo vai trò (06); mọi API kiểm vai trò ở server theo 02 mục 3 (VH-NFR-02). |
| Ngoại lệ, thông báo lỗi | - Xung đột: "Không cấp được {vai trò}: {họ tên} đang giữ {vai trò khác}. Hai vai trò này không được giữ cùng lúc (VH-BR-17)."<br>- Tự bật ngoại lệ cho mình: "Bạn không tự bật ngoại lệ tách nhiệm cho mình được."<br>- Ngoại lệ quá 90 ngày: "Ngoại lệ tách nhiệm tối đa 90 ngày."<br>- Còn 0 quản trị: "Không thực hiện được: hệ thống sẽ không còn quản trị hệ thống nào."<br>- Gọi API không đủ vai trò: 403, "Bạn không có quyền làm việc này." |
| Dữ liệu | `apps` (`vchome`), `app_roles`, `access_rules`, `access_grants`; ngoại lệ tách nhiệm (xem Đề xuất bổ sung về nơi lưu); `audit_log` |
| Quy tắc | VH-BR-10, VH-BR-17, VH-BR-25 |
| Màn hình | VH-MH-15, VH-MH-16, VH-MH-17 |
| Phụ thuộc | VH-APP-01, VH-APP-02, VH-APP-03, VH-APP-05, VH-ACC-01, VH-REQ-01; Q-07 |

**Tiêu chí nghiệm thu:**
1. GĐ B: người có `vchome:hcns` trong cấu hình VC ID vào được VH-MH-11; người không có thì nhận 403.
2. Người đang giữ `vchome:hcns` khớp luật `vchome:qtht`: quyền `qtht` không được tạo; quản trị hệ thống và kiểm soát nhận báo.
3. Quản trị hệ thống A bật ngoại lệ tách nhiệm cho B 30 ngày: B có cả hai vai trò; ngày thứ 31 vai trò đến sau bị gỡ.
4. Gỡ người giữ `vchome:qtht` cuối cùng bị chặn đúng câu.
5. Mọi API quản trị gọi bằng vai trò không đủ trả 403.

### VH-ADM-04 — Cảnh báo vận hành

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · A |
| Tác nhân | Hệ thống giám sát; nhóm vận hành; quản trị hệ thống; chủ app (cảnh báo về app mình) |
| Mô tả | Hệ thống tự báo nhóm vận hành khi có việc bất thường, trước khi người dùng phải gọi. Mỗi cảnh báo nói cái gì hỏng, từ lúc nào, ảnh hưởng ai, làm gì tiếp. |
| Điều kiện trước | Kênh nhận cảnh báo đã cấu hình (VH-ADM-05). |
| Xử lý chính | 1. Danh sách theo dõi và ngưỡng: bảng dưới. GĐ A dùng 6 dòng đầu (ky-thuat mục 11); giai đoạn sau thêm dòng theo cột GĐ.<br>2. Hai mức: **Khẩn** gửi ngay; **Cảnh báo** gom theo giờ.<br>3. Kênh: nhóm Telegram vận hành và email nhóm vận hành. Cảnh báo về sự kiện thất bại của một app gửi thêm chủ app đó.<br>4. Không lặp: cùng một cảnh báo chỉ gửi lại sau 60 phút nếu vẫn còn. Hết lỗi thì gửi "Đã hết: {tên cảnh báo}, kéo dài {n} phút".<br>5. Nội dung không chứa token, bí mật hay dữ liệu cá nhân ngoài mã nhân viên.<br>6. Mỗi cảnh báo có link tới mục tương ứng trong sổ tay sự cố (`vc-platform/docs/van-hanh.md`). |
| Ngoại lệ, thông báo lỗi | - Telegram lỗi: gửi qua email. Cả hai lỗi: ghi log và hiện băng đỏ trên VH-MH-20 "Không gửi được cảnh báo từ {HH:mm}. Kiểm tra kênh cảnh báo." |
| Dữ liệu | Số đo giám sát (VH-NFR-17); `event_deliveries.alerted_at`; `access_grants.idp_synced_at`; `scheduled_changes`; `import_batches`; log |
| Quy tắc | VH-BR-11, VH-BR-14, VH-BR-18 |
| Màn hình | VH-MH-20 (kênh, ngưỡng) |
| Phụ thuộc | ky-thuat mục 11; VH-ACC-02, VH-ACC-07, VH-INT-03, VH-INT-04, VH-LCM-03, VH-IMP-02, VH-REV-01 |

**Danh sách theo dõi:**

| # | Theo dõi | Ngưỡng | Mức | GĐ |
|---|---|---|---|---|
| 1 | `/health/ready` của Keycloak, `/` của VC Home | Lỗi 2 lần liên tiếp (kiểm mỗi phút) | Khẩn | A |
| 2 | Tỉ lệ đăng nhập lỗi | > 20% trong 15 phút | Khẩn | A |
| 3 | Đăng xuất phía máy chủ gửi lỗi | Bất kỳ, gom theo giờ | Cảnh báo | A |
| 4 | `vc-provisioner` (trạng thái Google) | Không chạy quá 2 giờ, hoặc dừng vì danh sách bất thường | Khẩn | A |
| 5 | Ổ đĩa, RAM máy chủ | > 80% | Cảnh báo | A |
| 6 | Sao lưu | Không có bản mới trong 26 giờ | Khẩn | A (Keycloak), B (MongoDB) |
| 7 | VC Home API | Kiểm sức khoẻ lỗi 2 lần liên tiếp | Khẩn | B |
| 8 | Chuỗi băm nhật ký | Lệch | Khẩn | B |
| 9 | Job áp thay đổi hẹn ngày | Dòng chờ áp quá 15 phút, hoặc có dòng Lỗi | Cảnh báo | B |
| 10 | Đối chiếu Google | Lỗi, hoặc dừng an toàn | Cảnh báo | B |
| 11 | Số người giữ `vchome:qtht` | Dưới 2 | Cảnh báo | B |
| 12 | Tính lại quyền | Hàng đợi chờ quá 5 phút; lần chạy an toàn 00:05 thấy lệch | Cảnh báo | C |
| 13 | Đẩy quyền sang VC ID | Cầu dao bật | Khẩn | C |
| 14 | Đẩy quyền sang VC ID | Lỗi 3 lần liên tiếp; chậm quá 15 phút; đối chiếu đêm có lệch | Cảnh báo | C |
| 15 | Job hẹn giờ quyền | Không chạy quá 30 phút | Khẩn | C |
| 16 | Gửi sự kiện | Một app có sự kiện chờ quá 1 giờ; sự kiện Thất bại | Cảnh báo | C |
| 17 | Nghỉ việc | 00:15 ngày nghỉ còn tài khoản chưa khoá hoặc còn quyền | Khẩn | C |
| 18 | Rà soát | Đợt chưa mở sau 7 ngày từ lịch; dòng gỡ lỗi | Cảnh báo | D |

**Tiêu chí nghiệm thu:**
1. Tắt Keycloak trên staging: nhóm vận hành nhận cảnh báo Khẩn trong 3 phút; bật lại thì nhận "Đã hết".
2. Lỗi kéo dài 3 giờ chỉ sinh 3 tin cảnh báo (mỗi 60 phút một tin) và 1 tin "Đã hết".
3. Cho một app trả 500 liên tục 25 giờ: chủ app và quản trị hệ thống nhận cảnh báo sự kiện Thất bại.
4. Không tin cảnh báo nào chứa token, bí mật hay họ tên.

### VH-ADM-05 — Cài đặt hệ thống (thời hạn, nhắc, lịch rà soát)

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Quản trị hệ thống (sửa); kiểm soát (xem) |
| Mô tả | Các thông số vận hành (thời hạn mặc định, nhắc, lịch rà soát, ngưỡng an toàn, kênh cảnh báo) chỉnh trên màn, không phải sửa code. Giới hạn do quy tắc nghiệp vụ đặt thì chỉ xem, không sửa trên màn. |
| Điều kiện trước | — |
| Xử lý chính | 1. VH-MH-20 chia nhóm theo bảng dưới. Mỗi dòng có giá trị hiện tại, mặc định, giới hạn, căn cứ.<br>2. Sửa: nhập giá trị mới và lý do (bắt buộc), lưu. Hệ thống kiểm giới hạn. Giá trị mới áp cho việc phát sinh sau đó; không đổi việc đã tạo (ví dụ hạn của quyền đã cấp, hạn của đợt đang mở).<br>3. Mỗi lần sửa ghi nhật ký trước/sau và báo kiểm soát.<br>4. GĐ B, C (chưa có màn): giá trị lấy từ tệp cấu hình với đúng mặc định ở bảng. Màn có từ GĐ D.<br>5. Mỗi dòng có nút "Về mặc định". |
| Ngoại lệ, thông báo lỗi | - Ngoài giới hạn: "{tên cài đặt} phải trong khoảng {nhỏ nhất}–{lớn nhất}."<br>- Sửa dòng chỉ đọc: "Giá trị này do quy tắc {mã quy tắc} đặt. Muốn đổi phải sửa quy tắc."<br>- Thiếu lý do: "Hãy ghi lý do đổi cài đặt." |
| Dữ liệu | Cài đặt hệ thống (xem Đề xuất bổ sung về collection); `audit_log` |
| Quy tắc | VH-BR-09, VH-BR-11, VH-BR-13, VH-BR-15, VH-BR-16, VH-BR-18, VH-BR-25 |
| Màn hình | VH-MH-20 |
| Phụ thuộc | VH-ACC-02, VH-ACC-04, VH-ACC-05, VH-ACC-07, VH-REQ-01, VH-REQ-03, VH-REQ-04, VH-REV-01, VH-REV-02, VH-LCM-01, VH-LCM-03, VH-LCM-04, VH-IMP-01, VH-IMP-02, VH-ADM-03, VH-ADM-04 |

**Danh sách cài đặt:**

| Nhóm | Cài đặt | Mặc định | Giới hạn | Căn cứ |
|---|---|---|---|---|
| Quyền | Hạn mặc định khi xin (vai trò chưa đặt riêng) | 90 ngày | 1–365 | VH-BR-09; đặt riêng ở `app_roles.default_request_days` |
| Quyền | Hạn tối đa quyền theo yêu cầu | 365 ngày | Chỉ đọc | VH-BR-09 |
| Quyền | Hạn mặc định cấp khẩn cấp | 24 giờ | 1 giờ – 7 ngày | VH-ACC-04 |
| Quyền | Hạn tối đa cấp khẩn cấp | 7 ngày | Chỉ đọc | VH-BR-09 |
| Quyền | Báo trước khi hết hạn | 14 ngày và 3 ngày | 1–30 ngày | VH-ACC-05, VH-REQ-06 |
| Quyền | Ngưỡng luật lớn cần người thứ hai | 20 người | 1–20 (chỉ hạ, không nâng) | VH-BR-25 |
| Quyền | Giờ lần chạy an toàn | 00:05 | 00:05–05:00 | VH-ACC-02 |
| Quyền | Chuyển tiếp mặc định khi thêm app | 0 ngày | 0–7 | VH-BR-11; đặt riêng ở VH-APP-06 |
| Đồng bộ VC ID | Cầu dao an toàn | 50 vai trò hoặc 20% | 10–500 vai trò; 5–50% | VH-ACC-07 |
| Đồng bộ VC ID | Chế độ xử lý lệch | "Chỉ báo" 2 tuần đầu GĐ C, rồi "Tự sửa" | Chỉ báo hoặc Tự sửa | VH-ACC-07 |
| Yêu cầu | Nhắc duyệt | Ngày 2 và ngày 5, lúc 08:00 | Ngày 1–6 | VH-BR-13 |
| Yêu cầu | Tự huỷ | 7 ngày | Chỉ đọc | VH-BR-13 |
| Yêu cầu | Hẹn ngày bắt đầu tối đa | 30 ngày | 0–90 | VH-REQ-01 |
| Yêu cầu | Uỷ quyền tối đa | 30 ngày | 1–30 | VH-REQ-03 |
| Rà soát | Lịch mở đợt | 08:00 thứ Hai đầu tiên của tháng 1, 4, 7, 10 | Chọn tháng, thứ, giờ | VH-BR-16 |
| Rà soát | Thời hạn đợt | 14 ngày | Chỉ đọc | VH-BR-16 |
| Rà soát | Nhắc người rà soát | Ngày 7 và ngày 12 | Ngày 1–13 | VH-REV-02 |
| Rà soát | Chu kỳ rà soát luật | 6 tháng | Chỉ đọc | VH-BR-16 |
| Vòng đời | Kiểm tài khoản Google trước ngày vào làm | 3 ngày | 1–14 | VH-LCM-01 |
| Vòng đời | Nhắc quản lý trước ngày nghỉ việc | 3 ngày | 1–14 | VH-LCM-03 |
| Vòng đời | Ngưỡng nghỉ dài ngày | 7 ngày | Chỉ đọc | VH-BR-15 |
| Vòng đời | Mặc định khoá đăng nhập khi nghỉ dài ngày | Không | Có hoặc Không | VH-BR-15 |
| Tách nhiệm | Hạn ngoại lệ tách nhiệm | 30 ngày | 1–90 | 02 mục 6, VH-ADM-03 |
| Sự kiện | Hạn trả lời của app; gửi lại tối đa; kéo dự phòng | 5 giây; 24 giờ; 30 ngày | Chỉ đọc (hợp đồng 07) | VH-INT-03, VH-INT-05 |
| Nhập, đối chiếu | Giờ đối chiếu Google | 06:00 hằng ngày | 00:00–23:59 | VH-IMP-02 |
| Nhập, đối chiếu | Ngưỡng dừng an toàn đối chiếu | Ít hơn 50% số tài khoản lần trước | 30–90% | ky-thuat mục 5.6 |
| Nhập, đối chiếu | Thời gian được ghi sau khi kiểm | 24 giờ | 1–72 giờ | VH-IMP-01 |
| Cảnh báo | Kênh | Nhóm Telegram vận hành và email nhóm vận hành | — | VH-ADM-04 |
| Cảnh báo | Không lặp cảnh báo | 60 phút | 15–240 phút | VH-ADM-04 |
| Nhật ký | Thời hạn giữ | 24 tháng | Chỉ đọc | VH-BR-18, Q-10 |

**Tiêu chí nghiệm thu:**
1. Đổi nhắc duyệt sang ngày 1 và ngày 4: yêu cầu gửi sau đó nhắc theo lịch mới; yêu cầu cũ giữ lịch cũ.
2. Nhập ngưỡng luật lớn 25: bị chặn đúng câu.
3. Dòng "Tự huỷ 7 ngày" không sửa được.
4. Mỗi lần sửa có nhật ký và kiểm soát nhận báo.

## 12. IMP — Nhập và đồng bộ dữ liệu

### VH-IMP-01 — Nhập nhân sự và cơ cấu từ Excel

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | HC-NS (trong phạm vi pháp nhân, division được gán); quản trị hệ thống (hỗ trợ, xem) |
| Mô tả | Nhập hàng loạt cơ cấu, danh mục, hồ sơ và vị trí từ tệp Excel theo mẫu. Luôn **kiểm thử** trước (dry-run: đọc, kiểm, cho xem kết quả, chưa ghi gì), rồi mới **ghi thật**. Dùng cho nhập ban đầu (VH-QT-03) và cập nhật hàng loạt về sau. |
| Điều kiện trước | Có vai trò `vchome:hcns`. Tải mẫu mới nhất ở VH-MH-14; mẫu có số phiên bản. |
| Xử lý chính | 1. Hai mẫu (cột ở bảng dưới):<br>  - **Mẫu cơ cấu** (lô `co_cau`): trang Đơn vị, Chức danh, Chức năng, Pháp nhân, Nơi làm việc;<br>  - **Mẫu nhân sự** (lô `nhan_su`): một trang, mỗi dòng là một vị trí của một người (người có kiêm nhiệm thì nhiều dòng).<br>  Mỗi mẫu có trang Hướng dẫn và danh sách chọn cho cột mã.<br>2. Thứ tự khuyến nghị lần đầu: cơ cấu (để trống cột trưởng đơn vị) → nhân sự → cơ cấu lần hai chỉ để điền trưởng đơn vị (hoặc đặt ở VH-MH-12).<br>3. Tải tệp: chỉ `.xlsx`, ≤ 5 MB, ≤ 2.000 dòng. Chọn "Ngày hiệu lực chung" của lô (mặc định hôm nay); dòng có cột `ngay_hieu_luc` thì dùng giá trị của dòng.<br>4. Cột lạ không có trong mẫu (ví dụ "CCCD", "Ngày sinh"): bỏ qua, **không đọc giá trị**, chỉ ghi tên cột vào kết quả (VH-BR-19, 05 mục 3.19).<br>5. Kiểm thử, trạng thái lô Đã kiểm:<br>  - khoá ghép: danh mục theo mã; đơn vị theo `ma_don_vi`; người theo `ma_nhan_vien`; vị trí theo (mã NV, loại vị trí, mã đơn vị, mã chức danh);<br>  - có rồi thì sửa, chưa có thì thêm;<br>  - lô nhập không xoá gì: người, đơn vị có trên VC People mà không có trong tệp chỉ được liệt kê để HC-NS biết.<br>6. Kết quả kiểm thử: số dòng Thêm, Đổi (kèm trường trước → sau), Không đổi, Lỗi, Cảnh báo. Từ GĐ C thêm "Tác động tới quyền": số người được thêm, mất quyền (dùng bộ tính VH-ACC-03).<br>7. Tải "tệp kết quả": tệp gốc thêm cột `ket_qua` và `loi` ở mỗi dòng, để sửa rồi tải lên lại.<br>8. Còn dòng Lỗi thì không ghi được: cả lô hoặc không gì. Cảnh báo vẫn ghi được sau khi HC-NS tick "Đã xem cảnh báo".<br>9. Bấm "Ghi thật" trong 24 giờ sau khi kiểm. Hệ thống kiểm lại với dữ liệu hiện tại; có gì đổi từ lúc kiểm thì yêu cầu kiểm lại. Ghi trong một giao dịch; mọi thay đổi đi qua `scheduled_changes` (05 mục 5.1); mỗi thay đổi ghi nhật ký kèm mã lô. Trạng thái lô Đã áp.<br>10. Từ GĐ C, thay đổi do lô sinh sự kiện và tính lại quyền như thao tác tay. Lô nhập ban đầu ở GĐ B chưa sinh sự kiện (sự kiện có từ GĐ C).<br>11. Tệp gốc xoá sau 30 ngày; kết quả từng dòng giữ 12 tháng (05 mục 7.1).<br>12. Trạng thái lô: Đã tải lên → Đã kiểm → Đã áp; hoặc Đã huỷ, Lỗi. |
| Ngoại lệ, thông báo lỗi | Mức tệp:<br>- "Tệp không đúng mẫu: thiếu trang {trang}."<br>- "Trang {trang} thiếu cột bắt buộc {cột}."<br>- "Tệp dùng mẫu phiên bản {v}. Hãy tải mẫu mới nhất."<br>- "Tệp quá 5 MB hoặc quá 2.000 dòng. Hãy chia nhỏ."<br>- "Tệp này đã được nhập lúc {HH:mm dd/mm} (lô {mã}). Vẫn nhập lại?"<br>- Cảnh báo: "Đã bỏ qua cột lạ: {danh sách}. VC Home không lưu các thông tin này."<br>Mức dòng (lỗi):<br>- "Dòng {n}: thiếu {cột}."<br>- "Dòng {n}: ngày '{giá trị}' không đúng dạng dd/mm/yyyy."<br>- "Dòng {n}: email {email} không thuộc @vcprosperous.com hoặc @vcpart.vn."<br>- "Dòng {n}: mã nhân viên {mã} có thông tin hồ sơ khác với dòng {m}."<br>- "Dòng {n}: email {email} đang dùng cho nhân viên {mã khác}."<br>- "Dòng {n}: mã {mã} không có trong danh mục {danh mục}."<br>- "Dòng {n}: mã đơn vị {mã} sai dạng (chữ hoa, số, gạch, 2–30 ký tự)."<br>- "Dòng {n}: đơn vị cha {mã} tạo vòng: {A → B → A}."<br>- "Dòng {n}: Tổ/Nhóm chỉ chứa được Tổ/Nhóm con một cấp."<br>- "Nhân viên {mã}: có {k} vị trí chính đang hiệu lực; cần đúng 1."<br>- "Dòng {n}: quản lý {email} tạo vòng quản lý: {A → B → A}."<br>- "Dòng {n}: trưởng đơn vị {email} không có vị trí ở đơn vị {mã} hoặc đơn vị cha trực tiếp."<br>- "Dòng {n}: bạn không có quyền sửa dữ liệu của pháp nhân {mã}."<br>- "Dòng {n}: mã {mã} thuộc người đã nghỉ. Mã không dùng lại; người cũ quay lại thì dùng 'Nhận lại' (VH-LCM-05)."<br>Mức dòng (cảnh báo):<br>- "Dòng {n}: quản lý {email} chưa có tài khoản Google."<br>- "Dòng {n}: ngày hiệu lực đã qua hơn 30 ngày; thay đổi sẽ áp ngay."<br>- "{k} nhân viên đang làm trên VC People không có trong tệp."<br>- Ghi thật khi dữ liệu đã đổi: "Dữ liệu đã đổi từ lúc kiểm thử. Hãy kiểm thử lại." |
| Dữ liệu | `import_batches` (`kind`, `file_name`, `file_sha256`, `file_ref`, `columns_used`, `columns_ignored`, `status`, `effective_on`, `counts`, `rows`, `scheduled_change_group_ids`, `uploaded_by`, `applied_by`); ghi `people`, `positions`, `org_units`, `job_titles`, `job_functions`, `legal_entities`, `work_locations`, `scheduled_changes`; `audit_log` |
| Quy tắc | VH-BR-01, VH-BR-02, VH-BR-04, VH-BR-05, VH-BR-06, VH-BR-07, VH-BR-17, VH-BR-19 |
| Màn hình | VH-MH-14 |
| Phụ thuộc | VH-NSU-01, VH-NSU-02, VH-NSU-03, VH-NSU-04, VH-ORG-01, VH-ORG-02, VH-ORG-03, VH-ORG-04, VH-ORG-07, VH-ACC-03 (từ GĐ C); VH-QT-03; Q-01, Q-02, Q-11 |

**Mẫu cơ cấu** (* là bắt buộc):

| Trang | Cột |
|---|---|
| Đơn vị | `ma_don_vi`*, `ten_don_vi`*, `ten_ngan`, `loai`* (`tap_doan`, `division`, `phong`, `to_nhom`), `ma_don_vi_cha` (trống chỉ với gốc), `ma_phap_nhan`*, `ma_chuc_nang`, `email_truong_don_vi`, `ngay_bat_dau`*, `trang_thai` (`hoat_dong`, `ngung`), `ngay_hieu_luc` |
| Chức danh | `ma`*, `ten`*, `ma_chuc_nang_mac_dinh`*, `trang_thai` |
| Chức năng | `ma`*, `ten`*, `trang_thai` |
| Pháp nhân | `ma`*, `ten`*, `ten_ngan`*, `tien_to_ma_nv`, `ma_so_thue`, `domain_email`*, `trang_thai` |
| Nơi làm việc | `ma`*, `ten`*, `loai`* (`van_phong`, `kho`, `gara`, `cua_hang`, `khac`), `dia_chi`, `ma_phap_nhan`*, `trang_thai` |

**Mẫu nhân sự** (một trang, mỗi dòng một vị trí):

| Nhóm | Cột |
|---|---|
| Hồ sơ (giống nhau ở mọi dòng của cùng một người) | `ma_nhan_vien`*, `ho_ten`*, `email`*, `sdt_cong_viec`, `ma_phap_nhan`*, `loai_nhan_vien`* (`chinh_thuc`, `thu_viec`, `cong_tac_vien`, `thuc_tap`), `ma_noi_lam_viec`, `ngay_vao`*, `ngay_nghi` |
| Vị trí | `loai_vi_tri` (`chinh` mặc định, `kiem_nhiem`), `ma_don_vi`*, `chuc_danh`* (mã), `chuc_nang` (mã; trống thì lấy chức năng mặc định của chức danh), `email_quan_ly` (bắt buộc trừ người đứng đầu), `tu_ngay` (mặc định = ngày vào hoặc ngày hiệu lực của lô), `den_ngay` |
| Chung | `ngay_hieu_luc` (tuỳ chọn) |

Trạng thái hồ sơ không nhập: hệ thống suy ra (ngày vào ở tương lai: Chưa vào làm; có ngày nghỉ đã qua: Đã nghỉ; còn lại: Đang làm). Nghỉ dài ngày và tạm khoá chỉ ghi trên màn.

**Tiêu chí nghiệm thu:**
1. Tệp 212 dòng hợp lệ: kiểm thử báo Thêm 212, không ghi gì; ghi thật thì có 212 vị trí và nhật ký mang mã lô.
2. Tệp có cột "CCCD": cột bị bỏ qua, giá trị không có trong database, kết quả liệt kê tên cột.
3. Một dòng sai email: cả lô không ghi được; tệp kết quả chỉ đúng dòng lỗi.
4. Sửa dữ liệu trên màn sau khi kiểm thử: bấm "Ghi thật" bị yêu cầu kiểm thử lại.
5. HC-NS của VCparts nhập dòng thuộc VCservice: lỗi phạm vi đúng câu.
6. Từ GĐ C: kiểm thử hiện số người được thêm, mất quyền.

### VH-IMP-02 — Đối chiếu với Google Workspace

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | M · B |
| Tác nhân | Quản trị hệ thống (chạy, xem toàn bộ); HC-NS (xử lý dòng hồ sơ trong phạm vi); admin Google Workspace (xử lý phía Google, ngoài VC Home) |
| Mô tả | So danh sách tài khoản Google của cả hai Workspace với hồ sơ trên VC People để tìm chỗ lệch. Đối chiếu chỉ đọc Google và chỉ báo cáo: không tự sửa hồ sơ, không tự tạo hay khoá tài khoản Google. Riêng việc khoá VC ID khi Google khoá vẫn do VH-AUT-07 làm. |
| Điều kiện trước | Tài khoản dịch vụ Google đọc danh bạ của từng Workspace (ky-thuat mục 4.3, I4, I6). |
| Xử lý chính | 1. Chạy hằng ngày lúc 06:00 và khi bấm "Đối chiếu ngay" ở VH-MH-14.<br>2. Đọc từ Google: email chính, bí danh (email phụ trỏ về cùng hộp thư), họ tên, trạng thái (hoạt động, bị khoá, lưu trữ, đã xoá), lần đăng nhập Google cuối. Đọc từ VC People: hồ sơ Chưa vào làm, Đang làm, Nghỉ dài ngày, Tạm khoá, và Đã nghỉ trong 24 tháng.<br>3. Ghép theo email chính, rồi theo bí danh, rồi theo `previous_emails`; không phân biệt hoa thường.<br>4. Xếp vào các nhóm ở bảng dưới; mỗi dòng có hành động gợi ý.<br>5. Mỗi dòng có trạng thái: Mới; Đã xử lý (tự biến mất ở lần chạy sau khi hết lệch); Bỏ qua (bắt buộc lý do; sau 180 ngày tự hiện lại).<br>6. "Không phải người": hộp thư dùng chung, tài khoản dịch vụ, tài khoản phòng họp. Quản trị hệ thống đánh dấu kèm lý do; các tài khoản này không cần hồ sơ và không được cấp quyền app.<br>7. So tên: bỏ khác biệt hoa thường và khoảng trắng thừa; khác dấu tiếng Việt vẫn tính là lệch.<br>8. An toàn: Google trả lỗi, hoặc số tài khoản ít hơn 50% lần trước, thì dừng, giữ kết quả lần trước, cảnh báo (như ky-thuat mục 5.6).<br>9. Kết quả lưu thành một lô `doi_chieu_google`; màn hiện số mỗi nhóm và xu hướng 30 ngày; tải Excel.<br>10. VC People là gốc của họ tên và "email nào của ai"; Google là gốc của hộp thư và trạng thái tài khoản Google (05 mục 8). |
| Ngoại lệ, thông báo lỗi | - Dừng an toàn: "Đối chiếu dừng: Google trả {n} tài khoản, ít hơn 50% lần trước ({m}). Giữ kết quả lần trước."<br>- Không đọc được Google: "Không đọc được danh sách tài khoản của {domain}: {lỗi}."<br>- Bỏ qua thiếu lý do: "Hãy ghi lý do bỏ qua." |
| Dữ liệu | `import_batches` (`kind = doi_chieu_google`, `counts`, `rows`); đọc `people`, `accounts` (`google_status`); danh sách "không phải người" (xem Đề xuất bổ sung về nơi lưu); `audit_log` |
| Quy tắc | VH-BR-01, VH-BR-02, VH-BR-03, VH-BR-14 |
| Màn hình | VH-MH-14 |
| Phụ thuộc | VH-AUT-07, VH-LCM-01, VH-LCM-03, VH-NSU-01; ky-thuat mục 4.3, 5.6 |

**Nhóm lệch:**

| Nhóm | Điều kiện | Hành động gợi ý | Ai xử lý |
|---|---|---|---|
| 1. Có trên Google, không có hồ sơ | Tài khoản Google hoạt động, không khớp hồ sơ nào, chưa đánh dấu "không phải người" | Tạo hồ sơ (mở form điền sẵn email, tên); gắn vào hồ sơ có sẵn nếu là email mới của người cũ; đánh dấu "không phải người"; báo admin Google khoá nếu là tài khoản thừa | HC-NS, quản trị hệ thống |
| 2. Có hồ sơ, không có Google | Hồ sơ Chưa vào làm, Đang làm, Nghỉ dài ngày; email không có trên Google | Báo admin Google tạo tài khoản; hoặc sửa email trên hồ sơ nếu gõ sai | HC-NS, admin Google |
| 3. Lệch tên, email | Khớp theo bí danh hoặc email cũ nhưng email chính khác; hoặc họ tên khác | Sửa email trên hồ sơ theo email chính (HC-NS); hoặc báo admin Google sửa tên cho đúng hồ sơ | HC-NS, admin Google |
| 4. Tài khoản bị khoá | Google bị khoá, lưu trữ hoặc đã xoá; hồ sơ Đang làm hoặc Nghỉ dài ngày | HC-NS kiểm: nghỉ việc chưa ghi? Ghi nghỉ việc (VH-LCM-03) hoặc báo admin Google mở lại | HC-NS |
| Thêm: hồ sơ đã nghỉ, Google còn hoạt động | Hồ sơ Đã nghỉ; Google hoạt động | Báo admin Google khoá (VC ID đã khoá từ ngày nghỉ) | Admin Google |

**Tiêu chí nghiệm thu:**
1. Dữ liệu thử có 1 tài khoản mỗi nhóm: báo cáo xếp đúng 5 dòng vào 5 nhóm.
2. Đánh dấu một hộp thư chung "không phải người": lần chạy sau không còn ở nhóm 1.
3. Giả lập Google trả 40% số tài khoản: đối chiếu dừng, giữ kết quả cũ, có cảnh báo.
4. Đối chiếu không tạo, không sửa hồ sơ hay tài khoản nào (nhật ký không có dòng ghi nào ngoài lô đối chiếu).

### VH-IMP-03 — Lấy dữ liệu khởi đầu từ cây tổ chức của VClinks và VCwiki

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · B |
| Tác nhân | Quản trị hệ thống (tải dữ liệu); HC-NS (quyết từng chỗ lệch); đội dev VClinks, VCwiki (xuất dữ liệu) |
| Mô tả | VClinks và VCwiki đang có cây tổ chức riêng. Lấy hai cây này làm điểm khởi đầu cho VC People để HC-NS không phải nhập từ số 0. Mô hình ORG của VCwiki là điểm xuất phát (Q-06). Kết quả là tệp Excel điền sẵn theo mẫu của VH-IMP-01; HC-NS bổ sung rồi nhập qua đường kiểm thử, ghi thật như thường. |
| Điều kiện trước | Đội app xuất được dữ liệu chỉ đọc, dạng JSON (đầu vào ngoài):<br>- VClinks: đơn vị (mã, tên, loại, cha), người dùng (email, tên, vai trò, đơn vị);<br>- VCwiki: cây tổ chức ở phân hệ ORG (đơn vị, trục chức năng, cây quản lý), thành viên (email). |
| Xử lý chính | 1. Quản trị hệ thống tải hai tệp JSON lên VH-MH-14, mục "Khởi tạo từ app" (lô `khoi_tao_vclinks`, `khoi_tao_vcwiki`). Hệ thống chỉ giữ trường công việc (VH-BR-19), bỏ mọi trường khác.<br>2. Ghép đơn vị hai nguồn theo tên chuẩn hoá (bỏ hoa thường, khoảng trắng, tiền tố "Tổ", "Phòng") cộng đường dẫn cha; và theo tỉ lệ thành viên chung (≥ 80% coi là cùng đơn vị).<br>3. Kết quả ghép, mỗi đơn vị một dòng: Khớp cả hai; Chỉ có ở VClinks; Chỉ có ở VCwiki; Xung đột (cùng tên khác cha, hoặc thành viên chung 30–80%).<br>4. HC-NS xử lý từng dòng: "Theo VClinks", "Theo VCwiki", "Gộp thành một", "Tạo riêng", "Bỏ"; đặt mã đơn vị, loại, pháp nhân. Gợi ý mặc định: cấu trúc theo VCwiki (Q-06), mã theo VClinks khi khớp (cùng quy tắc mã, 05 mục 3.4). Không nguồn nào tự thắng.<br>5. Người: ghép theo email giữa hai app; gợi ý vị trí chính = đơn vị đã ghép; gợi ý quản lý từ cây quản lý của VCwiki; gợi ý chức năng từ vai trò VClinks theo bảng ánh xạ HC-NS duyệt (ví dụ `nvkd` → Bán hàng, `cskh` → CSKH). Người ở hai đơn vị khác nhau ở hai app: đánh dấu để HC-NS chọn vị trí chính; đơn vị còn lại là kiêm nhiệm hoặc bỏ.<br>6. Bấm "Xuất tệp nhập": sinh mẫu cơ cấu và mẫu nhân sự của VH-IMP-01 điền sẵn; ô thiếu (mã NV, ngày vào, loại nhân viên) để trống, tô vàng. HC-NS bổ sung từ dữ liệu nhân sự rồi nhập theo VH-IMP-01. Vị trí tạo ra có `source = khoi_tao_tu_app`.<br>7. Lưu bảng ánh xạ "mã đơn vị trong app → mã đơn vị VC People" cho từng app. App dùng bảng này để chuyển dữ liệu của mình sang mã VC People, rồi khoá màn sửa cây tổ chức riêng (VH-BR-03, 12 RR-03).<br>8. Chạy lại được (ghi đè bản nháp cũ) cho tới khi lô nhập đầu tiên được ghi thật. |
| Ngoại lệ, thông báo lỗi | - Tệp sai cấu trúc: "Tệp {tên} không đúng cấu trúc xuất của {app}: thiếu trường {trường}."<br>- Còn xung đột khi xuất: "Còn {n} dòng xung đột chưa chọn cách xử lý."<br>- Email ngoài domain công ty trong dữ liệu app: đưa vào danh sách "Không nhập", lý do "Email ngoài công ty" (liên quan ky-thuat I7). |
| Dữ liệu | `import_batches` (`kind = khoi_tao_vclinks` hoặc `khoi_tao_vcwiki`, `rows` gồm kết quả ghép và quyết định, bảng ánh xạ); `positions.source` |
| Quy tắc | VH-BR-02, VH-BR-03, VH-BR-06, VH-BR-19 |
| Màn hình | VH-MH-14 |
| Phụ thuộc | VH-IMP-01, VH-ORG-01; đầu vào từ đội VClinks và VCwiki; Q-06; VH-QT-03 |

**Tiêu chí nghiệm thu:**
1. Dữ liệu thử có 10 đơn vị khớp, 2 chỉ ở VClinks, 1 chỉ ở VCwiki, 1 xung đột: màn xếp đúng 4 nhóm.
2. Còn 1 xung đột chưa quyết thì không xuất tệp được.
3. Tệp xuất ra mở bằng mẫu VH-IMP-01, kiểm thử chỉ báo lỗi ở ô tô vàng còn trống.
4. Bảng ánh xạ có đủ mã đơn vị của cả hai app.
5. Trường ngoài danh sách công việc trong JSON (ví dụ số điện thoại cá nhân) không được lưu.

### VH-IMP-04 — Đồng bộ tự động từ phần mềm nhân sự

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | C · E |
| Tác nhân | Phần mềm nhân sự (nguồn); HC-NS; quản trị hệ thống |
| Mô tả | Nếu công ty dùng phần mềm nhân sự (Q-01, ví dụ MISA AMIS), VC People nhận hồ sơ tự động thay vì nhập Excel. Dữ liệu đi qua cùng bộ kiểm của VH-IMP-01. Trường do phần mềm nhân sự giữ thì khoá sửa trên VC Home. |
| Điều kiện trước | Q-01 chốt phần mềm nhân sự và cách lấy dữ liệu (API hoặc tệp định kỳ). |
| Xử lý chính | 1. Bộ nối lấy dữ liệu theo lịch (mặc định 05:00 hằng ngày) hoặc khi phần mềm nhân sự báo có thay đổi.<br>2. Ánh xạ trường nguồn sang trường VC People theo bảng cấu hình. Trường ngoài VH-BR-19 bị bỏ ngay tại bộ nối, không lưu.<br>3. Tạo một lô như VH-IMP-01 và kiểm thử tự động.<br>4. Lô không lỗi và nhỏ (≤ 20 người đổi, không đổi cây đơn vị) thì tự ghi. Lô lớn hơn, có đổi cơ cấu, hoặc có lỗi thì chờ HC-NS xem rồi bấm ghi.<br>5. Nghỉ việc từ phần mềm nhân sự: áp theo ngày hiệu lực như VH-LCM-03. Ngày nghỉ đã qua hơn 1 ngày thì chờ HC-NS xác nhận.<br>6. Trường do nguồn giữ có nhãn "Từ phần mềm nhân sự" và khoá sửa trên VH-MH-11; muốn sửa thì sửa ở nguồn.<br>7. Bộ nối lỗi 2 lần liên tiếp thì cảnh báo; trong lúc chờ, HC-NS vẫn dùng Excel được. |
| Ngoại lệ, thông báo lỗi | - Sửa trường do nguồn giữ: "Trường {trường} lấy từ phần mềm nhân sự. Hãy sửa ở phần mềm nhân sự."<br>- Lô chờ: "Đồng bộ nhân sự dừng: lô {mã} có {n} lỗi, chờ HC-NS xử lý." |
| Dữ liệu | `import_batches` (nguồn tự động); cấu hình bộ nối; các collection như VH-IMP-01 |
| Quy tắc | VH-BR-03, VH-BR-07, VH-BR-14, VH-BR-19 |
| Màn hình | VH-MH-14, VH-MH-11, VH-MH-20 |
| Phụ thuộc | Q-01, VH-IMP-01, VH-LCM-01, VH-LCM-02, VH-LCM-03 |

**Tiêu chí nghiệm thu:**
1. Phần mềm nhân sự có 3 người đổi đơn vị: lô tự ghi; tính lại quyền chạy như thao tác tay.
2. Lô có 25 người đổi: chờ HC-NS bấm ghi.
3. Trường "họ tên" do nguồn giữ: màn VH-MH-11 không cho sửa, hiện đúng câu.
4. Tắt kết nối 2 lần: có cảnh báo; nhập Excel vẫn chạy.

## 13. Đề xuất bổ sung (chưa cấp mã)

Gộp từ hai người viết phần 1–5 và 6–12. Cột "Trạng thái" ghi kết quả xử lý của BA trưởng ngày 08/10/2026 (người dùng uỷ quyền chốt). Không còn mục "Mở".

| # | Đề xuất | Lý do | Liên quan | Trạng thái |
|---|---|---|---|---|
| 1 | Khoá tài khoản (khẩn cấp, Google, nghỉ việc) cũng thu hồi token máy của người đó trong app (`vcz_` của VClinks, `vcmcp_` của VCwiki), qua một sự kiện riêng hoặc API của app | Token máy không đi qua VC ID nên vẫn chạy sau khi khoá; hiện chỉ có việc tay ở VH-AUT-06 bước 6 | VH-AUT-06, VH-AUT-07, VH-INT-03 | Đã xử lý một phần: sự kiện `vh.person.locked` và cách VClinks, VCwiki tạm ngưng token máy ([07](07-tich-hop.md) mục 6, 8.6, 9.5) |
| 2 | Thêm collection lưu đề nghị sửa hồ sơ (ví dụ `profile_change_requests`) vào README mục 9 và tài liệu 05 | VH-NSU-06 cần lưu đề nghị, trạng thái, người xử lý; README mục 9 chưa có | VH-NSU-06 | Đã xử lý: `profile_change_requests` (README mục 9, [05](05-du-lieu.md) mục 3.21) |
| 3 | Mở rộng `vh.person.updated` cho pháp nhân, nơi làm việc, SĐT công việc, tên gọi; thêm sự kiện cho Tạm khoá và mở tạm khoá | Pháp nhân, nơi làm việc dùng trong luật (VH-BR-10) nhưng chưa nằm trong định nghĩa sự kiện; app cần biết người bị tạm khoá | VH-NSU-01, VH-NSU-04, VH-INT-03 | Đã xử lý: mở rộng `vh.person.updated`, thêm `vh.person.locked` / `unlocked` (README mục 10) |
| 4 | Thêm trường "phạm vi" (theo đơn vị / toàn app), "loại đơn vị nhận" và "tiêu chí nhạy cảm" vào `app_roles` trong README mục 9 | Claim `vh_roles` cần biết vai trò có kèm đơn vị hay không | VH-APP-02, VH-APP-05 | Đã xử lý: `app_roles.unit_scoped`, `allowed_unit_types` ([05](05-du-lieu.md) mục 3.8) |
| 5 | Cho nhân viên tự sửa tên gọi, ảnh, SĐT công việc không cần HC-NS duyệt (vẫn ghi lịch sử) | Bớt việc cho HC-NS với trường ít rủi ro | VH-NSU-06 | Nhận: VH-NSU-09 (mục 14) |
| 6 | Gửi kèm email (Gmail công ty) cho thông báo quan trọng: yêu cầu chờ duyệt, nhắc duyệt, quyền sắp hết hạn, đợt rà soát | Người duyệt ít mở VC Home thì yêu cầu dễ quá 7 ngày và tự huỷ | VH-HOM-08, VH-REQ-04 | Nhận: gộp vào VH-HOM-08 (mục 14.2) |
| 7 | Vai trò "phó đơn vị" hoặc "người tạm quyền trưởng đơn vị" có thời hạn | Trưởng đơn vị vắng dài thì rà soát và tạm duyệt bị dồn lên cấp trên | VH-ORG-04, VH-REV-02 | Để sau (GĐ E) |
| 8 | Gộp hai mục trùng trong danh mục (chức danh, nơi làm việc) sau khi nhập dữ liệu, có giữ lịch sử | Dữ liệu từ Excel và từ cây VClinks, VCwiki dễ có tên gần giống nhau | VH-ORG-02, VH-ORG-07, VH-IMP-01, VH-IMP-03 | Nhận: VH-ORG-09 (mục 14) |
| 9 | Liên kết ngoài hiện theo pháp nhân hoặc chức năng (ví dụ MISA chỉ cho Kế toán) | Mỗi bộ phận dùng bộ công cụ ngoài khác nhau | VH-HOM-06 | Nhận: gộp vào VH-HOM-06 (mục 14.2) |
| 10 | Cờ "cho phép xin qua yêu cầu" trên vai trò app; vai trò tắt cờ chỉ có được qua luật hoặc khẩn cấp | Một số vai trò (ví dụ `admin`) không nên hiện trong ô "Có thể xin quyền" | VH-APP-02, VH-HOM-04, VH-REQ-01 | Nhận: VH-APP-07 (mục 14) |
| 11 | Với vai trò nhạy cảm: hạn tối đa ngắn hơn (ví dụ 90 ngày thay vì 365) và luật cấp vai trò nhạy cảm luôn cần người thứ hai duyệt, bất kể số người | Giảm rủi ro người giữ quyền rộng quá lâu | VH-APP-05, VH-BR-09, VH-BR-25 | Đã xử lý: VH-BR-09 (vai trò nhạy cảm tối đa 90 ngày), VH-BR-25 |
| 12 | Trang báo trạng thái VC ID đặt ở máy khác máy VC ID | Thiết kế SSO đặt VC Home cùng máy với VC ID, nên khi máy đó hỏng thì VC Home cũng không báo được gì | VH-AUT-09, VH-ADM-04 | Nhận như việc vận hành (VH-NFR-10), không cấp mã |
| 13 | Thời gian chuyển tiếp đặt riêng cho từng vai trò, ghi đè mức app | Trong một app, vai trò có khách cần bàn giao dài hơn vai trò chỉ xem | VH-APP-06 | Để sau (khi có số đo) |
| 14 | Lưu mã định danh Google (không đổi) của tài khoản vào `accounts` | Phát hiện ngay trường hợp tài khoản Google bị xoá rồi tạo lại cùng email | VH-AUT-07, VH-AUT-08 | Nhận: `accounts.google_id` (mục 14.2) |
| 15 | Màn "Tài khoản" riêng cho quản trị hệ thống (khoá, mở khoá, gắn lại, cờ khoá) thay vì ngăn trong VH-MH-11 | VH-MH-11 là màn của HC-NS; tách màn giúp tách nhiệm rõ hơn (VH-BR-17) | VH-AUT-06, VH-AUT-08 | Không làm: ngăn Tài khoản ở VH-MH-11 đủ dùng (D-BA-15) |
| 16 | Thêm collection cài đặt hệ thống (ví dụ `system_settings`) vào README mục 9 | VH-ADM-05 cần nơi lưu giá trị, người sửa, lý do; README mục 9 chưa có | VH-ADM-05 | Đã xử lý: `system_settings` |
| 17 | Thêm nơi lưu ngoại lệ tách nhiệm (ví dụ `sod_exceptions`: người, cặp vai trò, lý do, người bật, hạn) | 02 mục 6 cho bật ngoại lệ có hạn nhưng chưa có chỗ lưu và luồng hết hạn | VH-ADM-03, VH-BR-17 | Đã xử lý: `sod_exceptions` |
| 18 | Thêm nơi lưu danh sách tài khoản Google "không phải người" (ví dụ `directory_exclusions`) | Để đối chiếu không báo lại hộp thư chung, tài khoản dịch vụ mỗi ngày | VH-IMP-02 | Đã xử lý: `directory_exclusions` |
| 19 | Nơi lưu báo cáo lệch VC ID và danh sách "bị chặn tách nhiệm" (thêm `kind` cho `import_batches` hoặc collection riêng) | Cần cho thẻ "Lệch VC ID", báo cáo, và để không cảnh báo lặp | VH-ACC-02, VH-ACC-07 | Nhận: mục 14.2 (VH-IMP-02) |
| 20 | Toán tử "không thuộc" trong `access_rules.conditions` (05 mục 3.9 hiện chỉ có "thuộc" và "gồm đơn vị con") | Bản giao việc yêu cầu toán tử in / not in / under; thiếu "không thuộc" thì phải viết nhiều luật | VH-ACC-01 | Đã xử lý: danh sách loại trừ trong `access_rules.conditions` ([05](05-du-lieu.md) mục 3.9) |
| 21 | Luật cấp vai trò nhạy cảm luôn cần người thứ hai duyệt, kể cả khi ảnh hưởng ≤ 20 người | Một luật nhỏ vẫn có thể cấp `vchome:qtht` hay quyền tài chính | VH-ACC-01, VH-BR-25 | Đã xử lý: VH-BR-25 |
| 22 | Thuộc tính "cho phép xin" trên vai trò app | Có vai trò chỉ nên cấp theo luật (ví dụ vai trò theo chức danh trưởng), không cho xin ngoại lệ | VH-APP-02, VH-REQ-01 | Nhận: VH-APP-07 (mục 14) |
| 23 | Người giữ quyền tự "Trả quyền" ngoại lệ không dùng nữa (thêm lý do gỡ, ví dụ `tu_tra`) | Giảm quyền thừa trước kỳ rà soát | VH-ACC-06, VH-MH-04 | Nhận: VH-ACC-09 (mục 14) |
| 24 | Sự kiện báo trước nghỉ việc và chuyển vị trí (ví dụ `vh.person.leaving_scheduled`), và trường "người nhận bàn giao" trong `vh.person.left` | App (VClinks M1b-11) bắt đầu bàn giao trước ngày nghỉ, không phải đợi 00:00 ngày nghỉ | VH-LCM-02, VH-LCM-03, VH-INT-03 | Nhận: VH-INT-09 (mục 14) |
| 25 | Lịch ngày nghỉ của công ty (Tết, lễ) để dừng đồng hồ 7 ngày của yêu cầu và 14 ngày của rà soát | Yêu cầu gửi trước Tết dễ tự huỷ oan; rà soát rơi vào Tết dễ quá hạn hàng loạt | VH-REQ-04, VH-REV-01 | Nhận: VH-ORG-08 (mục 14) |
| 26 | Tạo sẵn tài khoản VC ID ở ngày vào làm (đã có ở 05 mục 9 đề xuất 5) | Bỏ được khoảng "chưa được cấp" khi nhân viên mới mở thẳng app ở lần đầu; cần sửa luồng "first broker login" ở ky-thuat mục 5.1.2 | VH-LCM-01, VH-ACC-07 | Đã xử lý: tạo sẵn user VC ID từ GĐ C (thiết kế SSO mục 5.1.2) |
| 27 | Hoàn tác một lô nhập Excel trong 24 giờ nếu chưa có thay đổi nào sau đó | Nhập nhầm cả lô là rủi ro cao ở lần nhập đầu (12 RR-01) | VH-IMP-01 | Nhận: VH-IMP-05 (mục 14) |
| 28 | Lô nhập làm mất quyền của trên 20 người cần xác nhận lần hai (giống tinh thần VH-BR-25) | Nhập sai đơn vị hàng loạt có tác động như một luật sai | VH-IMP-01, VH-BR-25 | Nhận: VH-BR-25 mở rộng cho thay đổi hàng loạt |
| 29 | Mở rộng README mục 10: `vh.person.updated` gồm cả nơi làm việc, SĐT công việc, pháp nhân; `vh.org.unit_changed` gồm cả đổi trưởng đơn vị; VH-API-05 gồm cả nơi làm việc | Đây là thuộc tính dùng trong luật (VH-BR-10) và hiện chưa có sự kiện, API nào báo app | VH-INT-02, VH-INT-03 | Đã xử lý: README mục 10, [07](07-tich-hop.md) mục 5.7 và 6.1 |
| 30 | Loại sự kiện thử (ví dụ `vh.test.ping`) cho nút "Gửi thử" khi khai URL | Để app biết đây là bản thử, không xử lý như sự kiện thật | VH-INT-03, VH-APP-04 | Nhận: VH-INT-10 (mục 14) |
| 31 | Màn báo cáo cho ban giám đốc và trưởng đơn vị (VH-MH-17 hiện chỉ cho quản trị hệ thống, kiểm soát, chủ app) | 02 mục 3 cho ban giám đốc và trưởng đơn vị xem báo cáo tổng hợp nhưng chưa có màn | VH-ADM-02 | Đã xử lý: VH-MH-17 mở cho BGĐ và trưởng đơn vị xem báo cáo trong phạm vi |
| 32 | Ghi màn hoặc thẻ "Uỷ quyền" vào danh mục màn (hiện đặt trong VH-MH-08) | README mục 8 chưa có chỗ cho uỷ quyền | VH-REQ-03 | Đã xử lý: ngăn Uỷ quyền trong VH-MH-08 |
| 33 | Mã yêu cầu riêng cho "rà soát luật nửa năm" | VH-BR-16 có rà soát luật nhưng README mục 5 chưa có yêu cầu riêng; hiện gộp vào VH-REV-01 bước 10 | VH-REV-01, VH-BR-16 | Nhận: VH-REV-04 (mục 14) |
| 34 | Ghi rõ kênh email cho thông báo ở GĐ C (trước khi có VH-HOM-08 ở GĐ D) | VH-ACC-04, VH-LCM-01..03 cần báo người ngay từ GĐ C | VH-HOM-08 | Đã xử lý: GĐ C gửi thông báo bằng email (README mục 9) |

## 14. Yêu cầu nhận thêm ngày 08/10/2026

Người dùng uỷ quyền cho BA trưởng chốt các đề xuất bổ sung. 12 đề xuất được nhận thành yêu cầu mới (mã cuối mỗi phân hệ trong README mục 5); một số khác gộp vào yêu cầu có sẵn (mục 14.2). Danh sách xử lý đầy đủ ở [12](12-cau-hoi-rui-ro.md) mục 6.

### 14.1 Yêu cầu mới

### VH-HOM-09 — Dải "Việc đang chờ bạn" trên trang chủ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | C · D |
| Tác nhân | Quản lý, trưởng đơn vị, chủ app, HC-NS, quản trị hệ thống |
| Mô tả | Đầu trang chủ hiện một dải nhắc các việc đang chờ chính người dùng trên VC Home, để người duyệt xử lý ngay khi mở trang. |
| Điều kiện trước | Người dùng có ít nhất một việc chờ. |
| Xử lý chính | 1. Đếm 5 loại việc: yêu cầu chờ tôi duyệt (VH-REQ-02), dòng rà soát chờ tôi (VH-REV-02), luật chờ tôi duyệt bước hai (VH-BR-25), đề nghị sửa hồ sơ chờ HC-NS (VH-NSU-06), quyền của tôi còn ≤ 14 ngày (VH-REQ-06).<br>2. Hiện tối đa 3 dòng, việc gấp trước. Ví dụ "Bạn có 4 yêu cầu chờ duyệt, 1 yêu cầu đã chờ quá 5 ngày." Mỗi dòng có nút tới màn tương ứng.<br>3. Không có việc thì không hiện dải.<br>4. Số liệu làm mới khi tải trang và mỗi 5 phút. |
| Ngoại lệ, thông báo lỗi | Không tải được số liệu: ẩn dải, không chặn lưới app. |
| Dữ liệu | `approval_steps`, `review_items`, `access_rules`, `profile_change_requests`, `access_grants` |
| Quy tắc | VH-BR-12, VH-BR-16, VH-BR-25 |
| Màn hình | VH-MH-02 |
| Phụ thuộc | VH-HOM-08, VH-REQ-02, VH-REV-02 |

**Tiêu chí nghiệm thu:**
1. Có 2 yêu cầu chờ tôi: dải hiện "Bạn có 2 yêu cầu chờ duyệt."; bấm thì mở VH-MH-08 đã lọc sẵn.
2. Không có việc chờ: không có dải.
3. VC Home API lỗi: lưới app vẫn hiện trong ≤ 1,5 giây (VH-NFR-12).

### VH-NSU-09 — Nhân viên tự sửa tên gọi, ảnh, SĐT công việc

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · B |
| Tác nhân | Nhân viên; HC-NS xem lịch sử |
| Mô tả | Ba trường ít rủi ro nhân viên tự sửa ngay, không qua HC-NS duyệt. Vẫn ghi lịch sử và (từ GĐ C) gửi sự kiện. Các trường khác vẫn đi qua đề nghị sửa (VH-NSU-06). |
| Điều kiện trước | Hồ sơ đang làm hoặc nghỉ dài ngày, đã gắn tài khoản. |
| Xử lý chính | 1. VH-MH-03 có nút "Sửa" cạnh tên gọi, ảnh, SĐT công việc.<br>2. Tên gọi 1–40 ký tự. Ảnh JPG hoặc PNG ≤ 2 MB, hệ thống cắt vuông 400 × 400 px. SĐT công việc 10 số bắt đầu bằng 0, hoặc số máy lẻ 3–5 số.<br>3. Lưu là áp ngay, không có ngày hiệu lực; ghi `audit_log`; từ GĐ C gửi `vh.person.updated`. |
| Ngoại lệ, thông báo lỗi | "Tên gọi từ 1 đến 40 ký tự."<br>"Ảnh phải là JPG hoặc PNG, tối đa 2 MB."<br>"Số điện thoại công việc chưa đúng mẫu: 10 số bắt đầu bằng 0, hoặc số máy lẻ 3–5 số." |
| Dữ liệu | `people.nickname`, `people.photo` (`source = nhan_vien`), `people.work_phone`; `audit_log`; `event_outbox` |
| Quy tắc | VH-BR-18, VH-BR-19 |
| Màn hình | VH-MH-03 |
| Phụ thuộc | VH-NSU-06, VH-INT-03 |

**Tiêu chí nghiệm thu:**
1. Đổi ảnh: trang chủ và danh bạ hiện ảnh mới trong ≤ 1 phút.
2. Lịch sử hồ sơ có dòng "Tự sửa ảnh" kèm giờ.
3. Ở VH-MH-03 không sửa trực tiếp được chức danh, đơn vị; chỉ có nút "Đề nghị sửa".

### VH-ORG-08 — Lịch ngày nghỉ của công ty

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | HC-NS |
| Mô tả | Danh sách ngày nghỉ (Tết, lễ, nghỉ bù) để dừng đồng hồ 7 ngày của yêu cầu (VH-BR-13), 14 ngày của rà soát (VH-BR-16), và không gửi nhắc vào ngày nghỉ. |
| Điều kiện trước | — |
| Xử lý chính | 1. VH-MH-13 có ngăn "Ngày nghỉ": thêm một ngày hoặc khoảng ngày, tên, áp cho toàn tập đoàn hoặc một pháp nhân.<br>2. Tháng 12 hằng năm, hệ thống gợi ý lịch nghỉ lễ năm sau theo Bộ luật Lao động; HC-NS xác nhận hoặc sửa.<br>3. Đồng hồ yêu cầu, rà soát và lịch nhắc chỉ đếm ngày làm việc: thứ Hai đến thứ Bảy, trừ ngày nghỉ áp cho pháp nhân của người đó.<br>4. Sửa lịch không đổi hạn của việc đã quá hạn. |
| Ngoại lệ, thông báo lỗi | "Ngày {dd/mm/yyyy} đã có trong lịch nghỉ ({tên})." |
| Dữ liệu | `company_holidays` |
| Quy tắc | VH-BR-13, VH-BR-16, VH-BR-22 |
| Màn hình | VH-MH-13 |
| Phụ thuộc | VH-REQ-04, VH-REV-01 |

**Tiêu chí nghiệm thu:**
1. Yêu cầu gửi thứ Sáu 05/02/2027, lịch nghỉ Tết 05–13/02: hạn tự huỷ tính từ thứ Hai 15/02.
2. Không có nhắc nào gửi vào ngày trong lịch nghỉ.
3. Ngày nghỉ khai riêng cho một pháp nhân chỉ dừng đồng hồ của người thuộc pháp nhân đó.

### VH-ORG-09 — Gộp mục trùng trong danh mục

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · B |
| Tác nhân | HC-NS; quản trị hệ thống xác nhận khi ảnh hưởng quyền lớn |
| Mô tả | Sau khi nhập Excel và lấy dữ liệu từ VClinks, VCwiki, danh mục chức danh, chức năng, nơi làm việc dễ có mục trùng (cùng nghĩa, khác chữ). HC-NS gộp về một mục, giữ lịch sử. |
| Điều kiện trước | Hai mục cùng loại danh mục. |
| Xử lý chính | 1. VH-MH-13 gợi ý cặp có thể trùng: tên bỏ dấu giống nhau hoặc khác ≤ 2 ký tự.<br>2. HC-NS chọn mục giữ và mục bị gộp; màn hiện số vị trí và số luật đang trỏ tới mục bị gộp.<br>3. Gộp: mọi vị trí, luật trỏ tới mục bị gộp chuyển sang mục giữ; mục bị gộp chuyển trạng thái "Đã gộp", không xoá.<br>4. Nếu việc gộp làm thay đổi quyền của từ 21 người trở lên thì cần quản trị hệ thống xác nhận (VH-BR-25). |
| Ngoại lệ, thông báo lỗi | "Không gộp được hai mục khác loại."<br>"Mục {tên} đã được gộp vào {tên}." |
| Dữ liệu | `job_titles`, `job_functions`, `work_locations`, `positions`, `access_rules`, `audit_log` |
| Quy tắc | VH-BR-18, VH-BR-25 |
| Màn hình | VH-MH-13 |
| Phụ thuộc | VH-IMP-01, VH-IMP-03 |

**Tiêu chí nghiệm thu:**
1. Gộp "NV kinh doanh" vào "Nhân viên kinh doanh": mọi vị trí trỏ tới mục giữ; mục cũ ở trạng thái "Đã gộp".
2. Luật đang dùng mục cũ tự trỏ sang mục giữ; quyền của mọi người không đổi.
3. Nhật ký có một dòng gộp, ghi số bản ghi đã đổi.

### VH-APP-07 — Vai trò app "cho phép xin"

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Chủ app, quản trị hệ thống |
| Mô tả | Cờ trên vai trò app cho biết vai trò có nhận yêu cầu xin quyền không. Vai trò tắt cờ (ví dụ `admin`, vai trò theo chức danh trưởng) chỉ có qua luật hoặc cấp khẩn cấp. |
| Điều kiện trước | Vai trò app đã khai (VH-APP-02). |
| Xử lý chính | 1. VH-MH-15 thêm cột "Cho phép xin": mặc định bật; vai trò nhạy cảm mặc định tắt.<br>2. VH-MH-04, VH-MH-05 và ô "Có thể xin quyền" (VH-HOM-04) chỉ hiện vai trò bật cờ.<br>3. Tắt cờ không gỡ quyền đang có; yêu cầu đang chờ của vai trò đó vẫn xử lý tiếp. |
| Ngoại lệ, thông báo lỗi | Mở link xin vai trò đã tắt cờ: "Vai trò này không nhận yêu cầu. Liên hệ chủ app {tên}." |
| Dữ liệu | `app_roles.requestable` |
| Quy tắc | VH-BR-09 |
| Màn hình | VH-MH-15, VH-MH-05 |
| Phụ thuộc | VH-APP-02, VH-REQ-01 |

**Tiêu chí nghiệm thu:**
1. `vclinks:admin` tắt cờ: không có trong danh sách xin quyền.
2. Link sâu `?app=vclinks&role=admin` hiện đúng câu báo ở trên.
3. Bật lại cờ: vai trò hiện trong danh sách xin quyền trong ≤ 1 phút.

### VH-ACC-09 — Người giữ quyền tự trả quyền ngoại lệ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Nhân viên |
| Mô tả | Người đang có quyền ngoại lệ (nguồn "Được duyệt") không dùng nữa thì tự trả, để giảm quyền thừa trước kỳ rà soát. |
| Điều kiện trước | Dòng quyền nguồn yêu cầu đang hiệu lực. |
| Xử lý chính | 1. VH-MH-04: dòng nguồn "Được duyệt" có nút "Trả quyền".<br>2. Hỏi xác nhận "Trả vai trò {vai trò} trong {app}? Muốn có lại phải xin lại."; lý do tuỳ chọn.<br>3. Gỡ ngay dòng nguồn yêu cầu với lý do `tu_tra`. Nếu cùng vai trò còn nguồn luật thì quyền vẫn còn.<br>4. Báo quản lý trực tiếp; dòng rà soát đang mở của quyền đó tự đóng. |
| Ngoại lệ, thông báo lỗi | Dòng nguồn "Luật" hoặc "Khẩn cấp" không có nút "Trả quyền". |
| Dữ liệu | `access_grants` (`removed_reason = tu_tra`), `review_items` |
| Quy tắc | VH-BR-09 |
| Màn hình | VH-MH-04 |
| Phụ thuộc | VH-ACC-06 |

**Tiêu chí nghiệm thu:**
1. Trả quyền chỉ có nguồn yêu cầu: app nhận `vh.grant.removed` trong ≤ 1 phút.
2. Cùng vai trò còn nguồn luật: quyền giữ nguyên, chỉ mất dòng ngoại lệ; không có `vh.grant.removed`.
3. Dòng rà soát đang mở của quyền đó chuyển sang đã đóng.

### VH-REQ-07 — Duyệt nhiều yêu cầu một lần

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Quản lý, chủ app, người được uỷ quyền |
| Mô tả | Người duyệt chọn tối đa 20 yêu cầu thường rồi duyệt hoặc từ chối một lần. Không áp cho vai trò nhạy cảm. |
| Điều kiện trước | Các yêu cầu đang chờ chính người đó duyệt. |
| Xử lý chính | 1. VH-MH-08: mỗi dòng có ô chọn; dòng vai trò nhạy cảm không có ô chọn.<br>2. Bấm "Duyệt các mục đã chọn" (≤ 20): hộp xác nhận liệt kê tên người và vai trò.<br>3. Mỗi yêu cầu ghi quyết định riêng trong `approval_steps` và nhật ký.<br>4. "Từ chối các mục đã chọn" cần một lý do chung, ≥ 10 ký tự. |
| Ngoại lệ, thông báo lỗi | "Chọn tối đa 20 yêu cầu mỗi lần."<br>"Vai trò nhạy cảm phải duyệt từng yêu cầu." |
| Dữ liệu | `approval_steps`, `access_requests` |
| Quy tắc | VH-BR-12, VH-BR-17 |
| Màn hình | VH-MH-08 |
| Phụ thuộc | VH-REQ-02 |

**Tiêu chí nghiệm thu:**
1. Duyệt 5 yêu cầu một lần: có 5 dòng quyết định riêng trong `approval_steps` và 5 dòng nhật ký.
2. Dòng vai trò nhạy cảm không chọn được.
3. Chọn đến mục thứ 21 thì ô chọn khoá và hiện câu "Chọn tối đa 20 yêu cầu mỗi lần."

### VH-REV-04 — Rà soát luật nửa năm

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Chủ app; quản trị hệ thống (app chưa có chủ, và mở đợt); kiểm soát xem |
| Mô tả | Mỗi nửa năm, mọi luật đang bật được chủ app xác nhận còn đúng, sửa hoặc tắt (VH-BR-16). |
| Điều kiện trước | Có luật đang bật. |
| Xử lý chính | 1. Ngày 01/01 và 01/07 hệ thống mở đợt rà soát luật (`review_campaigns.kind = luat`); mỗi luật một dòng, giao cho chủ app.<br>2. Dòng hiện điều kiện, số người đang có quyền từ luật, lần sửa cuối.<br>3. Chọn "Giữ", "Sửa" (mở VH-MH-16, theo VH-QT-10) hoặc "Tắt" (xem trước và duyệt theo VH-BR-25).<br>4. Hạn 14 ngày làm việc. Quá hạn **không** tự tắt luật (tránh mất quyền hàng loạt); chỉ báo quản trị hệ thống và kiểm soát. |
| Ngoại lệ, thông báo lỗi | — |
| Dữ liệu | `review_campaigns` (`kind = luat`), `review_items` |
| Quy tắc | VH-BR-16, VH-BR-25 |
| Màn hình | VH-MH-18, VH-MH-16 |
| Phụ thuộc | VH-ACC-01, VH-REV-01 |

**Tiêu chí nghiệm thu:**
1. Ngày 01/07 có đủ một dòng cho mỗi luật đang bật.
2. Quá hạn: quản trị hệ thống và kiểm soát nhận báo; luật vẫn bật.
3. Báo cáo đợt có tỉ lệ giữ, sửa, tắt.

### VH-INT-09 — Sự kiện báo trước nghỉ việc, chuyển vị trí

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · C |
| Tác nhân | HC-NS (gây ra); app (nhận) |
| Mô tả | Khi HC-NS lưu ngày nghỉ việc hoặc chuyển vị trí chính có ngày hiệu lực trong tương lai, VC Home gửi `vh.person.change_scheduled` để app chuẩn bị bàn giao (VClinks: cờ "Sắp nghỉ", PQ-82). |
| Điều kiện trước | App đã khai URL nhận sự kiện (VH-INT-03). |
| Xử lý chính | 1. Tạo, sửa ngày, huỷ một thay đổi hẹn ngày loại nghỉ việc hoặc đổi vị trí chính: gửi sự kiện với `kind` (`nghi_viec` · `chuyen_vi_tri`), `effective_on`, `status` (`hen` · `doi_ngay` · `huy`), đơn vị mới (khi chuyển), `handover_to` tuỳ chọn (người nhận bàn giao do HC-NS hoặc quản lý gợi ý).<br>2. Không gửi lý do.<br>3. Đến ngày hiệu lực vẫn gửi `vh.person.left` / `vh.person.moved` như cũ. |
| Ngoại lệ, thông báo lỗi | — |
| Dữ liệu | `scheduled_changes`, `event_outbox` |
| Quy tắc | VH-BR-07, VH-BR-14 |
| Màn hình | VH-MH-11 |
| Phụ thuộc | VH-INT-03 |

**Tiêu chí nghiệm thu:**
1. Ngày 10/11 HC-NS đặt ngày nghỉ 30/11: app nhận `vh.person.change_scheduled` trong ≤ 1 phút.
2. Đổi ngày: sự kiện `status = doi_ngay`; huỷ: `status = huy`.
3. Nội dung sự kiện không có lý do nghỉ.

### VH-INT-10 — Sự kiện thử và nút "Gửi thử"

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · C |
| Tác nhân | Quản trị hệ thống, chủ app |
| Mô tả | Khi khai URL nhận sự kiện của app, bấm "Gửi thử" để gửi `vh.test.ping` có chữ ký thật. Nhờ đó kiểm được app nhận đúng mà không cần dữ liệu thật. |
| Điều kiện trước | App có URL nhận sự kiện và bí mật ký. |
| Xử lý chính | 1. VH-MH-15 có nút "Gửi thử" cạnh URL.<br>2. Gửi `vh.test.ping` (dữ liệu `{message, sent_by}`), ký giống sự kiện thật.<br>3. Hiện kết quả: mã HTTP, thời gian phản hồi, nội dung lỗi rút gọn.<br>4. Sự kiện thử không vào luồng thứ tự và không tự gửi lại. |
| Ngoại lệ, thông báo lỗi | "App không trả lời trong 5 giây."<br>"App trả {mã}: {nội dung rút gọn}." |
| Dữ liệu | `event_deliveries` (`is_test = true`) |
| Quy tắc | — |
| Màn hình | VH-MH-15 |
| Phụ thuộc | VH-INT-03, VH-APP-04 |

**Tiêu chí nghiệm thu:**
1. App cấu hình đúng: màn hiện "Đã nhận (200) trong {n} giây".
2. App dùng sai bí mật: app trả 401, màn hiện lỗi.
3. Sự kiện thử không làm tăng số thứ tự của luồng nào.

### VH-ADM-06 — Cảnh báo quyền không dùng 90 ngày

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · D |
| Tác nhân | Quản trị hệ thống, chủ app |
| Mô tả | Mỗi tuần liệt kê người còn quyền ngoại lệ hoặc vai trò nhạy cảm mà không đăng nhập app đó trong 90 ngày, để chủ app gỡ hoặc giữ. Không tự gỡ. |
| Điều kiện trước | VC ID ghi sự kiện đăng nhập theo từng app (client). |
| Xử lý chính | 1. Job thứ Hai 08:00: lấy lần đăng nhập cuối theo app từ sự kiện của VC ID.<br>2. Lập danh sách theo app: người, vai trò, nguồn, lần đăng nhập cuối.<br>3. Gửi thông báo (và email) cho chủ app; trên VH-MH-17 có nút "Gỡ" (VH-ACC-06) hoặc "Giữ thêm 90 ngày".<br>4. Quyền thường từ luật không vào danh sách. |
| Ngoại lệ, thông báo lỗi | — |
| Dữ liệu | `accounts.last_login_at`, sự kiện đăng nhập của VC ID, `access_grants` |
| Quy tắc | VH-BR-16 |
| Màn hình | VH-MH-17 |
| Phụ thuộc | VH-ADM-02, VH-HOM-08 |

**Tiêu chí nghiệm thu:**
1. Người có `vclinks:admin` không đăng nhập VClinks 91 ngày: có trong danh sách tuần.
2. Chọn "Giữ thêm 90 ngày": người đó không bị báo lại trong 90 ngày.
3. Quyền NVKD từ luật của người không đăng nhập 120 ngày: không có trong danh sách.

### VH-IMP-05 — Hoàn tác lô nhập trong 24 giờ

| Mục | Nội dung |
|---|---|
| Ưu tiên · GĐ | S · B |
| Tác nhân | HC-NS; quản trị hệ thống xác nhận khi ảnh hưởng quyền lớn |
| Mô tả | Lô nhập Excel đã áp có thể hoàn tác trong 24 giờ, nếu sau đó chưa có thay đổi nào khác trên các bản ghi của lô. |
| Điều kiện trước | Lô ở trạng thái đã áp, chưa quá 24 giờ. |
| Xử lý chính | 1. VH-MH-14: lô đã áp có nút "Hoàn tác" trong 24 giờ.<br>2. Kiểm: mọi bản ghi lô đã tạo hoặc sửa chưa bị sửa tiếp. Có bản ghi đã sửa thì không cho hoàn tác và liệt kê bản ghi đó.<br>3. Hoàn tác: bản ghi lô đã sửa trả về giá trị trước (theo nhật ký); hồ sơ, vị trí lô đã tạo chuyển "Huỷ do hoàn tác" (không xoá, mã nhân viên không dùng lại).<br>4. Tính lại quyền; nếu làm thay đổi quyền của từ 21 người trở lên thì quản trị hệ thống xác nhận (VH-BR-25). |
| Ngoại lệ, thông báo lỗi | "Lô đã quá 24 giờ, không hoàn tác được."<br>"Có {n} bản ghi đã sửa sau lô này: {danh sách}. Hãy sửa tay." |
| Dữ liệu | `import_batches`, `audit_log`, `people`, `positions`, `org_units` |
| Quy tắc | VH-BR-18, VH-BR-25 |
| Màn hình | VH-MH-14 |
| Phụ thuộc | VH-IMP-01 |

**Tiêu chí nghiệm thu:**
1. Hoàn tác lô 50 người sau 2 giờ: dữ liệu trở về như trước lô; nhật ký có dòng hoàn tác.
2. Một hồ sơ trong lô đã sửa sau đó: hoàn tác bị chặn và hồ sơ đó được liệt kê.
3. Quá 24 giờ: nút "Hoàn tác" không còn.

### 14.2 Bổ sung vào yêu cầu có sẵn

Đọc kèm khi làm yêu cầu tương ứng.

| Yêu cầu | Bổ sung |
|---|---|
| VH-HOM-02 | Người đăng nhập trước ngày vào làm thấy "Bạn bắt đầu làm từ {dd/mm/yyyy}." thay cho trang trống |
| VH-HOM-05 | Thanh chuyển app hiện vai trò của người dùng trong từng app (lấy từ token) |
| VH-HOM-06 | Liên kết ngoài giới hạn được theo pháp nhân hoặc chức năng |
| VH-HOM-08 | Gửi kèm email cho: yêu cầu chờ duyệt, nhắc duyệt, quyền sắp hết hạn, đợt rà soát, luật chờ duyệt bước hai |
| VH-ACC-01 | Lưu mọi phiên bản luật. "Khôi phục bản trước" là tạo bản nháp từ bản cũ rồi duyệt lại. Lúc áp, số người bị ảnh hưởng lệch quá 20% so với bản xem trước đã duyệt thì phải duyệt lại (VH-BR-25) |
| VH-ACC-03 | Xem trước cả khi HC-NS sửa hồ sơ một người: hiện quyền sẽ thêm, mất (chỉ xem, không chặn) |
| VH-LCM-02 | Khi chuyển vị trí, báo quản lý mới danh sách quyền ngoại lệ người đó đang giữ |
| VH-LCM-04 | Nhắc HC-NS 3 ngày làm việc trước ngày về dự kiến |
| VH-INT-03 | `vh.person.moved` kèm `roles_in_transition` (vai trò đang chuyển tiếp và ngày gỡ) |
| VH-AUT-07 | Lưu mã tài khoản Google không đổi (`accounts.google_id`) để phát hiện tài khoản bị xoá rồi tạo lại cùng email |
| VH-IMP-02 | Báo cáo lệch VC Home ↔ VC ID lưu như một lô `import_batches.kind = doi_chieu_vc_id`; quyền bị chặn do tách nhiệm ghi `audit_log` hành động `grant.blocked_sod` |

## Lịch sử cập nhật

| Phiên bản | Ngày | Người / phiên | Thay đổi | Căn cứ |
|---|---|---|---|---|
| 0.2 | 08/10/2026 11:31 | Claude Code (vai BA trưởng) | Mục 13 ghi trạng thái cả 34 đề xuất (không còn "Mở"); thêm mục 14: 12 yêu cầu mới (14.1) và phần bổ sung cho 11 yêu cầu có sẵn (14.2) | Người dùng uỷ quyền chốt toàn bộ câu hỏi và đề xuất ngày 08/10/2026; [12](12-cau-hoi-rui-ro.md) mục 4, 6 |
| 0.1 | 08/10/2026 11:16 | Claude Code (vai BA, hai người viết phần 1–5 và 6–12, BA trưởng gộp và soát chéo) | Tạo tài liệu: 78 yêu cầu đủ mẫu và tiêu chí nghiệm thu; gộp đề xuất bổ sung; áp quyết định soát chéo (loại đơn vị có pháp nhân, trạng thái app có `beta`, `paused` và loại `lien_ket_ngoai`, hồ sơ không vào làm chuyển Đã nghỉ, client `vchome`, VH-ACC-03 nâng lên M) | README bộ tài liệu 0.1; 02, 05, 07, 08; thiết kế SSO 0.2 |
