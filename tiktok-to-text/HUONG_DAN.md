# VC Content Engine — hướng dẫn chạy máy chủ

> **Người dùng app:** hướng dẫn nằm ngay trong web — menu **Hướng dẫn sử dụng** (`/guide`), đọc không cần đăng nhập
> ở `/guide.md` (cả tài liệu) hoặc `/guide/<mục>.md`. Nguồn duy nhất là `frontend/src/pages/guide/content.js`
> (Claude trong app đọc qua tool MCP `read_guide`). File này **không** chép lại nội dung đó.
>
> File này chỉ dành cho người **cài đặt / chạy máy chủ** và công cụ dòng lệnh cũ `tiktok_to_text.py`.
> Thiết kế kỹ thuật đầy đủ: `docs/DESIGN.md` Phần I (cấu hình mục 5, môi trường mục 10, vận hành mục 12);
> nghiệp vụ: `docs/BA.md`; ca kiểm thử bàn giao: `docs/UAT.md`.

---

## 1. Cài lần đầu

1. `brew install ffmpeg tesseract poppler mongodb-community node`; `brew install --cask ollama-app` (tuỳ chọn `libreoffice` để xem trước Word / PowerPoint).
2. `bash setup.sh` — dựng `.venv`, cài `requirements.txt` + `backend/requirements.txt` + `backend/requirements-ml.txt`
   (torch + transformers cho reranker tìm kiếm, ~1 GB; bỏ bằng `bash setup.sh --no-ml` — tìm kiếm vẫn chạy nhưng không rerank).
3. `ollama pull gemma3:12b && ollama pull bge-m3` (AI local + embedding).
4. `bash setup_vector_db.sh` — Qdrant + job vector đêm (launchd).
5. (tuỳ chọn) đăng nhập `claude` CLI — dự phòng AI + trợ lý chat.
6. `bash start_web.sh` → mở `http://localhost:8000` → *Tạo tài khoản quản trị đầu tiên*.

Quên mật khẩu quản trị: `cd backend && ../.venv/bin/python scripts/create_user.py email@congty.com --admin`

## 2. Chạy các bản

| Bản | Lệnh | Địa chỉ | Database |
| --- | --- | --- | --- |
| **Bản thật** | `bash start_web.sh` (tự nạp code mới theo commit của nhánh đang chạy) · `--no-auto` tắt tự nạp · `--reload` BE tự reload | `http://localhost:8000` | `tiktok_to_text` |
| Dev | `bash start_web.sh --dev` (Vite HMR) | `http://localhost:5173` | như bản thật — cẩn thận |
| QA | `bash start_qa.sh` · `--ai` bật AI · `--vite` có FE Vite · `--reload` | `http://127.0.0.1:8300` (Vite `:5300`) | `tiktok_to_text_qa` — từ chối chạy nếu `MONGO_DB` là DB thật |
| UAT | `bash start_uat.sh` · `--ai` · `--reset` · `--seed-only` | `http://127.0.0.1:5400` | `tiktok_to_text_uat` |

- Các script tự bật MongoDB nếu chưa chạy, dò `mongod.conf` theo thứ tự `MONGOD_CONF` → `/usr/local/etc` → `/opt/homebrew/etc` (`lib_mongo.sh`).
- Khoá AI: `export ANTHROPIC_API_KEY="sk-ant-..."` trước khi chạy (không gửi khoá qua chat / email). Chưa có khoá thì
  dùng `claude` CLI rồi AI local; toàn bộ biến môi trường ở `backend/app/config.py` và DESIGN Phần I mục 5.
- Kiểm thử: `cd backend && E2E_SLOT=<tên> ../.venv/bin/python -m pytest` · `cd frontend && npm test` · `cd frontend && E2E_SLOT=<n> npm run e2e`
  (DESIGN Phần I mục 11).

## 3. Kết nối AI qua MCP (quản trị / người cài)

Người dùng làm theo trang **Kết nối AI** (`/connect`) và mục *Hỏi Claude & kết nối AI* của `/guide`. Phần dưới cho người cài máy chủ.

App mở cổng MCP tại `http://localhost:8000/mcp`, để Claude (hoặc AI khác hỗ trợ MCP) tra VCWIKI, Kho tư liệu, transcript video và thao tác thay bạn. AI dùng đúng quyền của tài khoản sở hữu token nên chỉ thấy các kho bạn được xem.

**1. Tạo token**: vào web → *Kết nối AI* → *Tạo token*. Token chỉ hiện một lần. Hoặc tạo từ dòng lệnh:

```bash
cd backend && ../.venv/bin/python scripts/create_token.py email@congty.com "Claude Desktop"
```

**2a. Claude Code**:

```bash
claude mcp add --transport http vc-content http://localhost:8000/mcp --header "Authorization: Bearer vcmcp_..."
```

**2b. Claude Desktop**: *Settings → Developer → Edit Config*, thêm vào `claude_desktop_config.json`, rồi khởi động lại Claude (cần Node.js):

```json
{
  "mcpServers": {
    "vc-content": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:8000/mcp", "--header", "Authorization: Bearer vcmcp_..."]
    }
  }
}
```

**2c. Gemini CLI** (cài: `npm install -g @google/gemini-cli`):

Lần đầu chạy `gemini`, chọn *Trust folder* cho thư mục làm việc — Gemini tắt MCP ở thư mục chưa tin cậy. Gõ `/mcp` để kiểm tra.

**Công cụ AI dùng được**: AI tự liệt kê khi kết nối (`tools/list`); mô tả từng tool ở `backend/app/mcp_server.py`, tóm tắt trong `docs/DESIGN.md` Phần IV mục 7.

**Mở cho máy khác / AI trên web**: mặc định cổng chỉ nhận kết nối từ chính máy này (chống DNS rebinding). Để mở ra ngoài, đưa app ra một tên miền HTTPS (vd Cloudflare Tunnel), rồi khai báo tên miền trước khi chạy: `export MCP_ALLOWED_HOSTS="mcp.congty.com"`. Không mở cổng 8000 trực tiếp ra Internet.

**Thu hồi**: *Kết nối AI* → *Thu hồi*. Khoá tài khoản cũng thu hồi mọi token của người đó.

## 4. Công cụ dòng lệnh cũ `tiktok_to_text.py`

Trên web, nạp kênh / video đã gộp vào **Kho tư liệu** (`/kb`). CLI vẫn chạy được để xuất Excel / Google Sheet nhanh.
Đưa kết quả CLI cũ (`output/cache`) vào web — chạy một lần, chạy lại không trùng:
`cd backend && ../.venv/bin/python scripts/import_cache.py`

> ⚠️ Chỉ dùng để nghiên cứu nội bộ, ví dụ phân tích đối thủ hay học cách viết kịch bản. **Không đăng lại** nội dung của kênh khác.

### 4.1 Cài đặt (làm 1 lần)

Máy cần có **Python 3.10 trở lên** và **ffmpeg**. Trên Mac, cài như sau:

```bash
brew install python ffmpeg
```

Sau đó mở Terminal trong thư mục này và chạy:

```bash
bash setup.sh
```

Setup sẽ tự chọn engine nhận dạng giọng nói:

- **Mac chip M1–M4**: cài `mlx-whisper`. Engine này chạy trên GPU của Mac, mỗi video 1–3 phút mất khoảng 5–10 giây.
- **Windows / Linux / Mac Intel**: cài `faster-whisper`. Có GPU NVIDIA thì nhanh, không có thì vẫn chạy được nhưng chậm hơn.

### 4.2 Chạy

Mỗi lần mở Terminal mới, cần kích hoạt môi trường trước:

```bash
source .venv/bin/activate
```

| Muốn làm gì                      | Lệnh                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Chạy thử 3 video                  | `python tiktok_to_text.py @tenkenh --limit 3`                         |
| Lấy toàn bộ kênh                | `python tiktok_to_text.py @tenkenh`                                   |
| Nhiều kênh cùng lúc             | `python tiktok_to_text.py @kenh1 @kenh2 @kenh3`                       |
| Danh sách kênh trong file         | `python tiktok_to_text.py --file kenh.txt` (mỗi dòng một kênh)    |
| Chỉ 50 video mới nhất mỗi kênh | `python tiktok_to_text.py @tenkenh --limit 50`                        |
| Một video lẻ                      | `python tiktok_to_text.py "https://www.tiktok.com/@abc/video/123..."` |

**Kết quả** nằm trong thư mục `output/`:

- `tiktok_<ngày giờ>.xlsx`: bảng tổng hợp. Dòng tiêu đề đã được cố định và bật bộ lọc.
- `txt/<id>.txt`: lời nói của từng video.
- `srt/<id>.srt`: phụ đề có mốc thời gian, dùng để xem câu nào nói ở giây nào.

**Chạy lại không mất công:** video đã xử lý được lưu trong `output/cache/` và sẽ được bỏ qua. Nếu đang chạy mà bị dừng giữa chừng, chỉ cần chạy lại đúng lệnh cũ.

### 4.3 Khi TikTok chặn

Nếu gặp lỗi khi quét kênh, hãy đăng nhập TikTok trên Chrome (hoặc Safari/Firefox) rồi thêm tham số cookies:

```bash
python tiktok_to_text.py @tenkenh --cookies-from-browser chrome
```

Mỗi video được nghỉ ngẫu nhiên tối đa 2 giây. Nếu vẫn bị chặn, tăng thời gian nghỉ, ví dụ `--sleep 5`.
Để thử lại những video bị lỗi ở lần trước, thêm `--retry-failed`.

### 4.4 Ghi ra Google Sheet (tùy chọn)

1. Vào [Google Cloud Console](https://console.cloud.google.com/), tạo project và bật **Google Sheets API**.
2. Vào IAM → **Service Accounts**, tạo service account. Ở tab Keys, chọn **Add key → JSON** rồi tải file về, đổi tên thành `service_account.json` và đặt vào thư mục này.
3. Mở Google Sheet, bấm **Share** cho email của service account (dạng `...@....iam.gserviceaccount.com`) với quyền **Editor**.
4. Chạy lệnh:

```bash
python tiktok_to_text.py @tenkenh --gsheet "https://docs.google.com/spreadsheets/d/XXXX/edit"
```

Kết quả được ghi vào tab `TikTok`. Mỗi lần chạy, tab này sẽ bị ghi đè. Muốn đổi tên tab thì dùng `--gsheet-tab "Đối thủ A"`.

> Không gửi file `service_account.json` qua chat hoặc email công khai. File này tương đương mật khẩu.

### 4.5 Tùy chỉnh engine / model

| Tham số                 | Ý nghĩa                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `--model small`        | Model nhỏ, nhanh hơn nhưng kém chính xác hơn (dùng với faster-whisper)           |
| `--backend phowhisper` | Dùng PhoWhisper của VinAI. Xem ghi chú bên dưới trước khi dùng                   |
| `--language auto`      | Tự nhận ngôn ngữ, dùng khi kênh nói tiếng Anh hoặc nói lẫn nhiều ngôn ngữ   |
| `--keep-media`         | Giữ lại file video sau khi xử lý (mặc định sẽ xóa để tiết kiệm dung lượng) |

Xem toàn bộ tùy chọn: `python tiktok_to_text.py --help`

**Ghi chú về PhoWhisper.** Đã thử trên kênh marketing, kết quả **kém hơn engine mặc định** ở 3 điểm:

- Không có dấu câu, không viết hoa.
- Phiên âm sai từ tiếng Anh, ví dụ "insight" thành "in sai", "5 Whys" thành "file white".
- Chậm hơn rất nhiều: khoảng 3–5 phút mỗi video, so với khoảng 5 giây của engine mặc định.

Chỉ nên dùng PhoWhisper cho video nói giọng vùng miền nặng và ít từ tiếng Anh. Cài thêm bằng lệnh `pip install transformers torch`. Lần chạy đầu sẽ tải model về, khoảng 6 GB.
Muốn chạy nhanh hơn khoảng 2 lần thì chuyển model sang định dạng CTranslate2 (làm 1 lần) rồi chạy qua faster-whisper:

```bash
pip install faster-whisper
ct2-transformers-converter --model vinai/PhoWhisper-large --output_dir models/PhoWhisper-large-ct2 --quantization int8_float16 --copy_files tokenizer.json preprocessor_config.json
python tiktok_to_text.py @tenkenh --backend faster --model models/PhoWhisper-large-ct2
```

Lần chạy đầu tiên, công cụ tải model về máy, khoảng 1,5 GB, mất 1–2 phút. Các lần sau không phải tải lại.
