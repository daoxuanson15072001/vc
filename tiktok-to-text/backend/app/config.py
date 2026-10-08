"""Cấu hình từ biến môi trường — nơi DUY NHẤT trong backend/app đọc os.environ (DESIGN Phần I mục 5).

Hằng số đọc một lần lúc import (đổi phải khởi động lại). Vài giá trị đọc lúc gọi (hàm ở cuối file) vì test / script
đổi biến giữa chừng. Module khác import từ đây, giữ tên cục bộ cũ (vd `from ..config import CHAT_TIMEOUT as TIMEOUT`)
để test monkeypatch như trước. Ngoại lệ có chủ ý: chat.py và kb/adapters/ocr.py chép os.environ để truyền cho tiến
trình con (không phải đọc cấu hình).
"""

import os
import shutil
from pathlib import Path


def _on(name: str, default: str = "on") -> bool:
    """Cờ kiểu on/off: tắt khi giá trị là off / 0 / false / no (không phân biệt hoa thường)."""
    return os.getenv(name, default).strip().lower() not in ("off", "0", "false", "no")


def _not_zero(name: str) -> bool:
    """Cờ kiểu 1/0: chỉ đúng "0" mới tắt (mặc định bật)."""
    return os.getenv(name, "1") != "0"


ROOT_DIR = Path(__file__).resolve().parents[2]          # thư mục TIKTIKTOTEXT
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
MONGO_DB = os.getenv("MONGO_DB", "tiktok_to_text")
MEDIA_DIR = Path(os.getenv("MEDIA_DIR", ROOT_DIR / "output" / "media"))
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

JOB_LOG_LIMIT = 500
EXPORT_LIMIT = 5000
MAX_TARGETS = 50

# Worker nền (pipeline chuyển chữ + dựng thẻ, tổng hợp cụm, xưởng chiến dịch, cổng so sánh). Đặt KB_WORKERS=off
# để chạy API/FE lúc dev mà không nạp pipeline AI — Whisper/Ollama vốn chỉ nạp khi có việc nên máy rảnh cho code.
KB_WORKERS_ON = _on("KB_WORKERS")

# --- Kho tư liệu / VCWIKI ---
RAW_DIR = Path(os.getenv("RAW_DIR", ROOT_DIR / "data" / "raw"))        # dữ liệu thô: file tải lên, HTML, metadata video
TTS_DIR = Path(os.getenv("TTS_DIR", ROOT_DIR / "data" / "tts"))            # mp3 đọc thẻ VCWIKI (bộ đệm, xoá được)
TESSDATA_DIR = Path(os.getenv("TESSDATA_PREFIX", ROOT_DIR / "data" / "tessdata"))  # OCR tiếng Việt + Anh
WIKI_MODEL = os.getenv("WIKI_MODEL", "claude-opus-5")
TEXT_MODEL = os.getenv("TEXT_MODEL", WIKI_MODEL)   # tầng chữ: đọc ảnh, PDF scan, khung hình, làm sạch bài viết
SYNTH_TRIAGE_MODEL = os.getenv("SYNTH_TRIAGE_MODEL", WIKI_MODEL)   # tổng hợp theo cụm: bước sàng lọc từng tài liệu
# --- AI local (SYS-17): Ollama / MLX-LM qua API tương thích OpenAI, dữ liệu không ra khỏi máy ---
LOCAL_LLM_URL = os.getenv("LOCAL_LLM_URL", "http://127.0.0.1:11434")
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "gemma3:12b")      # dịch, sàng lọc, lọc trang crawl
LOCAL_EMBED_MODEL = os.getenv("LOCAL_EMBED_MODEL", "bge-m3")      # embedding tìm theo nghĩa
# Nhả model Ollama khỏi RAM/GPU sau bấy nhiêu giây không có lời gọi cùng model; 0 = nhả ngay, âm = giữ như cũ.
LOCAL_AI_IDLE_SECONDS = float(os.getenv("LOCAL_AI_IDLE_SECONDS", "60"))
TRIAGE_ENGINE = os.getenv("TRIAGE_ENGINE", "local")               # sàng lọc: local (lỗi thì Claude) / claude
# Claude hết quota: "local" = việc chỉ có chữ chuyển AI local, "off" = chờ.
# Trò chuyện (SYS-38) dùng cùng cờ: CLI không hoạt động → local; off giữ lỗi CLI.
AI_FALLBACK = os.getenv("AI_FALLBACK", "local")
CLAUDE_QUOTA_PAUSE = int(os.getenv("CLAUDE_QUOTA_PAUSE", "900"))   # giây nghỉ Claude trước khi thử lại
# Context (token) Ollama đang chạy — xem cột CONTEXT của `ollama ps`, tăng bằng OLLAMA_CONTEXT_LENGTH. Việc dài hơn
# không đưa sang AI local (Ollama cắt bớt đầu vào mà không báo lỗi -> thẻ sai), mà chờ Claude.
LOCAL_LLM_CTX = int(os.getenv("LOCAL_LLM_CTX", "4096"))
MAX_UPLOAD_MB = 100           # tài liệu, ảnh
UPLOAD_LIMIT_MB = {"audio": 500, "video_file": 2048}   # ghi âm, video tải lên được lớn hơn
MAX_DOC_CHARS = 120_000       # tài liệu dài hơn được chia phần trước khi dựng thẻ
# Đọc file tài liệu thành Markdown giữ bảng / tiêu đề: markitdown (Word, PowerPoint; PDF qua pdfplumber) /
# docling (PDF bảng phức tạp, cần cài riêng, nặng) / legacy (pypdf, python-docx, python-pptx như cũ)
DOC_ENGINE = os.getenv("DOC_ENGINE", "markitdown")
DEFAULT_VIDEO_LIMIT = 0       # số video tối đa khi nạp cả kênh / playlist (0 = tất cả)
AUDIO_CHUNK_SEC = 30 * 60     # ghi âm / video dài: mỗi 30 phút thành một tài liệu
MAX_ALBUM_IMAGES = 20         # ảnh gộp: tối đa bấy nhiêu ảnh mỗi tài liệu gửi AI

# --- Xưởng chiến dịch (Content Engine) ---
STUDIO_MODEL = os.getenv("STUDIO_MODEL", WIKI_MODEL)
STUDIO_MAX_REFS = 30          # số video tham chiếu tối đa mỗi chiến dịch
STUDIO_MAX_EPISODES = 30      # số mục tối đa trong kế hoạch mỗi luồng (tập video / bài SEO / bài MXH)
STUDIO_MAX_COMPETITORS = 10   # luồng SEO: số trang đối thủ (top Google) người dùng dán vào
STUDIO_MAX_SITE_URLS = 500    # luồng SEO: số URL trên website (sitemap) để gợi ý link nội bộ
STUDIO_MAX_SOCIAL_REFS = 20   # luồng MXH: số bài mẫu người dùng dán vào
STUDIO_PASS_SCORE = 80        # kịch bản dưới ngưỡng này được AI tự sửa
STUDIO_MAX_ROUNDS = 3         # số vòng viết + chấm tối đa mỗi kịch bản
STUDIO_QUICK_MAX_ROUNDS = 2   # Viết nhanh: ít vòng hơn để có bài sớm (người dùng vẫn bấm "Viết lại" được)
# Đăng Facebook (studio/facebook.py): Fanpage đăng qua Graph API bằng Page token; FB_APP_ID + FB_APP_SECRET (tuỳ chọn)
# để đổi token người dùng ngắn hạn -> dài hạn, khi đó Page token lấy ra không hết hạn. Không có thì Page token sống ~1 giờ.
FB_GRAPH_URL = os.getenv("FB_GRAPH_URL", "https://graph.facebook.com")
FB_GRAPH_VERSION = os.getenv("FB_GRAPH_VERSION", "v23.0")
FB_APP_ID = os.getenv("FB_APP_ID", "")
FB_APP_SECRET = os.getenv("FB_APP_SECRET", "")

# --- Claude CLI dự phòng (kb/cli_ai.py) + trợ lý chat (chat.py) ---
CLAUDE_CLI_FALLBACK = _on("CLAUDE_CLI_FALLBACK")
CLAUDE_CLI_FIRST = _on("CLAUDE_CLI_FIRST")
CLAUDE_CLI_TIMEOUT = int(os.getenv("CLAUDE_CLI_TIMEOUT", "1200"))   # giây mỗi lượt (bài dài, kế hoạch nhiều tập)
CLAUDE_BIN = os.getenv("CLAUDE_BIN") or shutil.which("claude") or str(Path.home() / ".local/bin/claude")
CHAT_MODEL = os.getenv("CHAT_MODEL", "")                     # trống = model mặc định của CLI
CHAT_ACCESS = os.getenv("CHAT_ACCESS", "all")                # all | admin
CHAT_MAX_PARALLEL = int(os.getenv("CHAT_MAX_PARALLEL", "2"))  # số lượt chạy cùng lúc, còn lại xếp hàng
CHAT_TIMEOUT = int(os.getenv("CHAT_TIMEOUT", "900"))          # giây / lượt
# thư mục trống ngoài repo: CLI không nạp CLAUDE.md / .claude của dự án nào
CHAT_SANDBOX = Path(os.getenv("CHAT_SANDBOX", Path.home() / ".vc-content-engine" / "chat"))
CHAT_MCP_URL = os.getenv("CHAT_MCP_URL", "")                 # trống = cổng /mcp của chính máy chủ này

# --- Một việc nặng một lúc (kb/ai_slot.py) ---
AI_ONE_JOB = _on("AI_ONE_JOB")
AI_SLOT_LOCK = os.getenv("AI_SLOT_LOCK")   # None = data/ai_slot-<MONGO_DB>.lock (ai_slot tự dựng theo tên DB)

# --- Tìm kiếm: thẻ theo nghĩa (kb/embeddings.py), xếp hạng (kb/card_search.py), reranker (kb/rerank.py) ---
SEARCH_SEMANTIC = _not_zero("SEARCH_SEMANTIC")
SEARCH_SEMANTIC_MIN = float(os.getenv("SEARCH_SEMANTIC_MIN", "0.52"))
SEARCH_SEMANTIC_MARGIN = float(os.getenv("SEARCH_SEMANTIC_MARGIN", "0.10"))
SEARCH_SEMANTIC_TOPK = int(os.getenv("SEARCH_SEMANTIC_TOPK", "30"))
SEARCH_EMBED_TIMEOUT = float(os.getenv("SEARCH_EMBED_TIMEOUT", "8"))
SEARCH_RANKING = os.getenv("SEARCH_RANKING", "v2")
RERANK = _not_zero("RERANK")
RERANK_MODEL = os.getenv("RERANK_MODEL", "BAAI/bge-reranker-v2-m3")
RERANK_TOPN = int(os.getenv("RERANK_TOPN", "30"))
RERANK_MIN = float(os.getenv("RERANK_MIN", "0"))
RERANK_TIMEOUT = int(os.getenv("RERANK_TIMEOUT_MS", "2500")) / 1000   # giây
# --- Tầng thô trong Qdrant (kb/doc_vectors.py) ---
QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333").rstrip("/")
RAW_SEMANTIC = _not_zero("RAW_SEMANTIC")
RAW_SEMANTIC_MIN = float(os.getenv("RAW_SEMANTIC_MIN", "0.50"))
RAW_RERANK_MIN = float(os.getenv("RAW_RERANK_MIN", "0.005"))   # đo 27/09: dưới 0,005 toàn lạc đề
RAW_RERANK_DOCS = int(os.getenv("RAW_RERANK_DOCS", "10"))       # đo 27/09: 10 ngang 20 về chất lượng, nhanh hơn
RAW_HYBRID = _not_zero("RAW_HYBRID")                            # 0: chỉ nhánh nghĩa
RAW_RRF_DENSE = float(os.getenv("RAW_RRF_DENSE", "1"))
RAW_RRF_SPARSE = float(os.getenv("RAW_RRF_SPARSE", "1"))
# --- Đề xuất dọn hàng chờ (kb/queue_cleanup.py) ---
CLEANUP_COVER_SIM = float(os.getenv("CLEANUP_COVER_SIM", "0.72"))
CLEANUP_COVER_RATIO = float(os.getenv("CLEANUP_COVER_RATIO", "0.8"))
CLEANUP_DUP_SIM = float(os.getenv("CLEANUP_DUP_SIM", "0.92"))
CLEANUP_DUP_RATIO = float(os.getenv("CLEANUP_DUP_RATIO", "0.8"))

# --- Cổng so sánh (kb/novelty.py, kb/changes.py) ---
NOVELTY_ENGINE = os.getenv("NOVELTY_ENGINE", "auto")
NOVELTY_ENGINE_SET = "NOVELTY_ENGINE" in os.environ   # không khai báo thì changes.py đặt "local" (18.7.2)
NOVELTY_EMBED = _not_zero("NOVELTY_EMBED")
NOVELTY_EMBED_MIN = float(os.getenv("NOVELTY_EMBED_MIN", "0.70"))

# --- Việc khác của Kho tư liệu ---
VIDEO_MAX_AUTO_RETRY = int(os.getenv("VIDEO_MAX_AUTO_RETRY", "3"))   # kb/video_errors.py
# Giờ gom cập nhật thẻ khi tài liệu gốc đổi (kb/card_update.py): 07:45 = sau job vector đêm (00:30 → STOP_AT 07:30)
CARD_UPDATE_AT = os.getenv("CARD_UPDATE_AT", "07:45")
GOOGLE_CSE_KEY = os.getenv("GOOGLE_CSE_KEY")                 # kb/discover.py — tìm video theo chủ đề
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
PREVIEW_MAX_ROWS = int(os.getenv("PREVIEW_MAX_ROWS", "2000"))   # kb/preview.py
PREVIEW_MAX_COLS = int(os.getenv("PREVIEW_MAX_COLS", "100"))
PREVIEW_TIMEOUT = int(os.getenv("PREVIEW_TIMEOUT", "90"))       # giây cho một lượt LibreOffice


# --- Đọc lúc gọi (test / script đổi biến giữa chừng) ---

def anthropic_key_set() -> bool:
    """Có ANTHROPIC_API_KEY hoặc ANTHROPIC_AUTH_TOKEN (kb/wiki.py)."""
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


def preview_dir() -> str | None:
    """PREVIEW_DIR (kb/preview.py); None = cạnh RAW_DIR."""
    return os.getenv("PREVIEW_DIR")


def soffice_bin_env() -> str | None:
    """SOFFICE_BIN (kb/preview.py); None = dò PATH / bản cài macOS."""
    return os.getenv("SOFFICE_BIN")


def mcp_allowed_hosts() -> list[str]:
    """MCP_ALLOWED_HOSTS: host thêm ngoài 127.0.0.1 / localhost, cách nhau dấu phẩy (mcp_server.py)."""
    return [h.strip() for h in os.getenv("MCP_ALLOWED_HOSTS", "").split(",") if h.strip()]


def learn_ai_fake() -> bool:
    """LEARN_AI_FAKE=1: AI học tập trả kết quả giả (test) — learn/generate.py."""
    return os.getenv("LEARN_AI_FAKE") == "1"


def seed_sample_course() -> bool:
    """SEED_SAMPLE_COURSE=1: tự dựng khoá mẫu /learn lúc khởi động — learn/sample.py."""
    return os.getenv("SEED_SAMPLE_COURSE") == "1"


def seed_sample_as() -> str | None:
    """SEED_SAMPLE_AS: email người chạy seed khoá mẫu (trống = quản trị viên đầu tiên)."""
    return os.getenv("SEED_SAMPLE_AS")
