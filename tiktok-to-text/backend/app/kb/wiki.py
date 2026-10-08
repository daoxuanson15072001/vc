"""Dựng thẻ VCWIKI từ một tài liệu đã trích xuất, bằng Claude (structured output)."""

from __future__ import annotations

import base64
import json
import mimetypes
import re
import subprocess
import time
from pathlib import Path

import anthropic
import httpx

from . import classify
from ..config import AI_FALLBACK, CLAUDE_QUOTA_PAUSE, LOCAL_LLM_CTX, TEXT_MODEL, WIKI_MODEL, anthropic_key_set

CARD_TYPES = {
    "framework": "Mô hình, quy trình, kỹ năng có thể áp dụng",
    "concept": "Khái niệm, định nghĩa",
    "case_study": "Tình huống thực tế của một doanh nghiệp / chiến dịch",
    "regulation": "Quy định, chuẩn mực, văn bản pháp lý (ghi rõ số hiệu, hiệu lực nếu có)",
    "insight": "Sự thật về khách hàng, thị trường, hành vi",
    "hook": "Công thức mở đầu, mẫu câu thu hút sự chú ý",
    "lesson": "Bài học, nguyên tắc ngắn gọn",
    "sop": "Quy trình từng bước, có đầu vào – đầu ra",
    "checklist": "Danh sách kiểm tra trước / sau một việc",
    "template": "Mẫu biểu, mẫu email, mẫu báo cáo",
    "kpi": "Định nghĩa chỉ số: công thức, nguồn số, tần suất, ngưỡng",
}

# Thẻ do AI bên ngoài (qua MCP) tự ghi — không nằm trong CARD_TYPES để tầng dựng thẻ tự động không sinh ra
AI_CARD_TYPES = {
    "skill": "Kỹ năng AI: cách làm một việc cụ thể, từng bước, khi nào dùng",
    "memory": "Ghi nhớ AI: sở thích, quyết định, phản hồi của người dùng",
    "context": "Bối cảnh AI: dự án, tổ chức, thuật ngữ, quy ước cần biết khi làm việc",
}

SYSTEM_TEMPLATE = """Bạn là biên tập viên của VCWIKI — kho kiến thức nội bộ của tập đoàn VC Phồn Vinh \
(phụ tùng ô tô, garage, đào tạo nghề ô tô, phần mềm). Kho phục vụ mọi khối: marketing, bán hàng, \
tài chính, kế toán, nhân sự, kỹ thuật.

Nhiệm vụ:
1. Phân loại tài liệu theo cây lĩnh vực bên dưới.
2. Bóc tài liệu thành các thẻ tri thức độc lập, mỗi thẻ đọc riêng vẫn hiểu và áp dụng được.

Loại thẻ:
{types}

Cây lĩnh vực (mã: tên đầy đủ — mô tả):
{tree}

Quy tắc:
- Chỉ ghi điều có trong tài liệu. Không thêm kiến thức bên ngoài, không bịa số liệu.
- `evidence` là trích dẫn nguyên văn ngắn (dưới 300 ký tự) từ tài liệu làm căn cứ cho thẻ.
- Lĩnh vực: chỉ dùng mã có trong cây; chọn nhánh cụ thể nhất phù hợp (vd chọn "tâm lý khách hàng" thay vì \
chỉ "marketing"). Mỗi thẻ 1–3 lĩnh vực.
- Nếu một nội dung quan trọng không khớp nhánh nào, ghi vào `suggested_categories` (tên ngắn, mã nhánh cha phù hợp \
nhất hoặc chuỗi rỗng, lý do). Không đề xuất nhánh trùng nghĩa với nhánh đã có.
- Viết tiếng Việt, rõ ràng, súc tích. `body` dùng markdown (gạch đầu dòng, bước đánh số).
- Tối đa 12 thẻ, ưu tiên thẻ có giá trị áp dụng cao. Gộp các ý trùng nhau.
- Tài liệu quá ít thông tin hoặc không có giá trị kiến thức cho doanh nghiệp: trả `cards` rỗng và `relevance` thấp.
- `tags`: 2–6 từ khoá chữ thường, nối bằng gạch ngang (vd `tiktok`, `dong-tien`, `persona`).
- "Ghi chép của người dùng" / "Ghi chú của người nạp" (nếu có) là lời người dùng, không phải nội dung tài liệu: \
dùng làm gợi ý chọn lĩnh vực và ý cần nhấn mạnh; không chép vào thẻ, không coi là sự thật, không trích làm `evidence`.
{rules}"""


def output_schema(slugs: list[str]) -> dict:
    cat = {"type": "string", "enum": slugs}
    card = {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": list(CARD_TYPES)},
            "title": {"type": "string"},
            "summary": {"type": "string"},
            "body": {"type": "string"},
            "key_points": {"type": "array", "items": {"type": "string"}},
            "when_to_use": {"type": "string"},
            "example": {"type": "string"},
            "evidence": {"type": "string"},
            "categories": {"type": "array", "items": cat},
            "tags": {"type": "array", "items": {"type": "string"}},
            **classify.ai_schema_props(),
        },
        "required": ["type", "title", "summary", "body", "key_points", "when_to_use", "example", "evidence",
                     "categories", "tags", *classify.ai_schema_props()],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "doc_summary": {"type": "string"},
            "relevance": {"type": "integer", "description": "0-10: mức hữu ích làm kiến thức cho doanh nghiệp"},
            "primary_category": cat,
            "categories": {"type": "array", "items": cat},
            "suggested_categories": {"type": "array", "items": {
                "type": "object",
                "properties": {"name": {"type": "string"}, "parent_slug": {"type": "string"},
                               "reason": {"type": "string"}},
                "required": ["name", "parent_slug", "reason"], "additionalProperties": False}},
            "cards": {"type": "array", "items": card},
        },
        "required": ["doc_summary", "relevance", "primary_category", "categories", "suggested_categories", "cards"],
        "additionalProperties": False,
    }


SOURCE_LABELS = {"video": "video mạng xã hội", "audio": "ghi âm", "video_file": "video tải lên", "web": "bài viết",
                 "pdf": "PDF", "image": "ảnh chụp", "google": "Google Docs / Sheets / Slides", "office": "file Office"}
AUDIO_HINTS = {
    "meeting": "Đây là ghi âm cuộc họp: ưu tiên bóc quyết định, quy trình, phân công, bài học; bỏ phần xã giao.",
    "lecture": "Đây là bài giảng / hội thảo: ưu tiên framework, khái niệm, ví dụ minh hoạ.",
    "interview": "Đây là phỏng vấn: ưu tiên insight, kinh nghiệm thực tế, trích dẫn của người được phỏng vấn.",
    "note": "Đây là ghi chú giọng nói: gom ý thành thẻ ngắn, giữ nguyên ý người nói.",
}

NOTE_MAX = 2000        # ghi chú của người nạp trên nguồn (WK-44)
USER_NOTES_MAX = 4000  # cả khối ghi chép người dùng trong một prompt (WK-45)
USER_NOTES_GUARD = (
    "Ghi chép của người dùng — gồm Ghi chú của người nạp (khi nạp nguồn) và ghi chép thêm về nguồn / từng tài liệu "
    "(lời người dùng, KHÔNG phải nội dung tài liệu — chỉ dùng làm gợi ý phân loại lĩnh vực và chọn ý cần nhấn mạnh; "
    "không chép vào thẻ, không coi là sự thật, không trích làm evidence):")


def user_notes_block(source: dict | None, doc_ids=(), doc_titles: dict | None = None,
                     notes: list[dict] | None = None) -> str:
    """Khối "Ghi chép của người dùng" đưa vào prompt dựng thẻ / tổng hợp (WK-44 + WK-45); không có gì -> "".

    Gồm ghi chú của người nạp (`source.note`) + ghi chép cả nguồn + ghi chép của các tài liệu `doc_ids`
    (`kb_notes`, mới nhất trước), tổng không quá `USER_NOTES_MAX` ký tự. `doc_titles` {doc_id: tiêu đề}: ghi rõ ghi
    chép thuộc tài liệu nào (tổng hợp nhiều tài liệu); bỏ trống -> "tài liệu này" (dựng thẻ một tài liệu).
    `notes`: truyền sẵn danh sách (vd [] = chỉ ghi chú của người nạp, không đọc DB).
    Ghi chép là ngữ cảnh người dùng (điều họ thích, vì sao lưu, cần chú ý) nên được bọc riêng và dặn AI không chép
    vào thẻ."""
    from . import notes as notes_mod
    from .media import fmt_ts
    src = source or {}
    intake = (src.get("note") or "").strip()[:NOTE_MAX]
    if notes is None:
        notes = notes_mod.for_prompt(src["_id"], doc_ids) if src.get("_id") else []
    budget = USER_NOTES_MAX - len(intake)
    lines: list[str] = []
    for n in notes:
        text = (n.get("text") or "").strip()
        if not text:
            continue
        if n.get("doc_id") is None:
            where = "cả nguồn"
        elif doc_titles is None:
            where = "tài liệu này"
        else:
            where = f"tài liệu «{(doc_titles.get(n['doc_id']) or doc_titles.get(str(n['doc_id'])) or '')[:80]}»"
        if n.get("t") is not None:
            where += f" · {fmt_ts(n['t'])}"
        line = f"- [{where}] {text}"
        if len(line) > budget:
            if budget >= 200:
                lines.append(line[:budget - 1] + "…")
            break
        lines.append(line)
        budget -= len(line) + 1
    if not intake and not lines:
        return ""
    parts = [USER_NOTES_GUARD]
    if intake:
        parts.append(f"<ghi_chu_nguoi_nap>\n{intake}\n</ghi_chu_nguoi_nap>")
    if lines:
        parts.append("<ghi_chep_nguoi_dung>\n" + "\n".join(lines) + "\n</ghi_chep_nguoi_dung>")
    return "\n".join(parts)


def uploader_note(source: dict | None) -> str:
    """Chỉ phần ghi chú của người nạp (WK-44), không đọc `kb_notes` — giữ cho chỗ gọi cũ."""
    return user_notes_block(source, notes=[])


IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


class AINotReady(Exception):
    pass


class AIRetryLater(Exception):
    pass


_auth_error: tuple[float, str] | None = None   # key sai: tạm dừng 5 phút thay vì gọi API liên tục
_quota_error: tuple[float, str] | None = None  # hết credit / chạm giới hạn chi tiêu: nghỉ Claude, dùng AI local
# Hết tiền khác bị giới hạn tốc độ: 429 "rate limit" chỉ cần chờ, còn mấy lỗi này chờ bao lâu cũng không hết
QUOTA_RE = re.compile(r"credit balance|usage limits?|spend(ing)? limit|billing|quota", re.I)


def claude_paused() -> str | None:
    """Lý do Claude đang tạm nghỉ vì hết quota (None = dùng bình thường). Hết hạn nghỉ thì thử Claude lại."""
    if _quota_error and time.time() - _quota_error[0] < CLAUDE_QUOTA_PAUSE:
        return _quota_error[1]
    return None


def _has_key() -> bool:
    return anthropic_key_set()


def claude_off() -> str | None:
    """Vì sao lúc này không gọi được Claude (None = gọi được): chưa có key, key sai, hết quota."""
    if not _has_key():
        return "Chưa cấu hình ANTHROPIC_API_KEY"
    if _auth_error and time.time() - _auth_error[0] < 300:
        return _auth_error[1]
    return claude_paused()


def claude_ready() -> bool:
    """Claude dùng được ngay — cho việc chỉ Claude làm được (đọc ảnh, PDF scan); không thì bộ đọc dùng Tesseract."""
    return claude_off() is None


def _local_fallback() -> bool:
    from . import cli_ai, local_ai
    return AI_FALLBACK == "local" and (local_ai.ready() or cli_ai.ready())


def ai_ready() -> bool:
    """Có AI dựng thẻ / tổng hợp / chiến dịch: Claude, hoặc AI local thay khi Claude không dùng được."""
    if _has_key() and not (_auth_error and time.time() - _auth_error[0] < 300):
        return True   # kể cả khi hết quota: structured_call tự chuyển local hoặc báo thử lại sau
    return _local_fallback()


def ai_status() -> dict:
    from . import cli_ai, local_ai
    off = claude_off()
    ready = ai_ready()
    error = None if ready else (off if AI_FALLBACK != "local" else
                                f"{off}; AI local cũng chưa sẵn sàng: {local_ai.status()['error']}")
    paused = off and ready and {
        "reason": off, "fallback": AI_FALLBACK == "local",
        "until": _quota_error[0] + CLAUDE_QUOTA_PAUSE if off == claude_paused() else None}
    return {"ready": ready, "model": WIKI_MODEL, "text_model": TEXT_MODEL, "error": error,
            "local": local_ai.status(), "cli": {"ready": cli_ai.ready(), "first": cli_ai.first()},
            "claude_paused": paused or None}


_client: anthropic.Anthropic | None = None


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def _text_only(content: list[dict] | str, images_optional: bool) -> str | None:
    """Nội dung -> một chuỗi cho AI local; có ảnh / PDF bắt buộc -> None."""
    if isinstance(content, str):
        return content
    extra = {"image"} if images_optional else set()
    if all(b.get("type") in {"text"} | extra for b in content):
        return "\n\n".join(b["text"] for b in content if b.get("type") == "text")
    return None


def _try_cli(system: str, text: str, schema: dict, model: str | None) -> tuple[dict | None, str | None]:
    """Chạy Claude Code CLI (tài khoản Claude trên máy): (kết quả, None) hoặc (None, lý do lỗi)."""
    from . import cli_ai
    if not cli_ai.ready():
        return None, None
    try:
        return cli_ai.cli_call(system, text, schema, model), None
    except (OSError, ValueError, subprocess.TimeoutExpired) as e:
        return None, f"Claude CLI lỗi: {str(e)[:150]}"


def _fallback(system: str, content: list[dict] | str, schema: dict, max_tokens: int, reason: str,
              images_optional: bool = False, model: str | None = None) -> dict:
    """Claude API không dùng được: việc thuần chữ chạy Claude Code CLI trước (CLAUDE_CLI_FIRST), CLI lỗi / chưa có thì
    AI local; tắt CLAUDE_CLI_FIRST thì AI local trước, CLI chỉ nhận việc dài quá context local. Việc có ảnh / PDF chờ
    Claude API."""
    from . import cli_ai, local_ai
    text = _text_only(content, images_optional)
    if AI_FALLBACK != "local":
        raise AIRetryLater(reason)
    if text is None:
        raise AIRetryLater(f"{reason} — việc có ảnh / PDF chờ Claude")
    cli_tried = False

    def cli(why: str) -> dict:
        res, err = (None, None) if cli_tried else _try_cli(system, text, schema, model)
        if res is None:
            raise AIRetryLater(f"{why} — {err}" if err else why)
        return res

    if cli_ai.first():
        res, err = _try_cli(system, text, schema, model)
        if res is not None:
            return res
        cli_tried = True
        reason = f"{reason} — {err}"
    if not local_ai.ready():
        return cli(f"{reason} — AI local cũng chưa sẵn sàng: {local_ai.status()['error']}")
    too_long = (f"{reason} — việc dài hơn context AI local ({LOCAL_LLM_CTX} token), chờ Claude "
                f"(tăng OLLAMA_CONTEXT_LENGTH + LOCAL_LLM_CTX để chạy local)")
    if (len(system) + len(text)) / 3 > LOCAL_LLM_CTX * 0.8:   # ~3 ký tự / token, chừa chỗ cho câu trả lời
        return cli(too_long)
    try:
        res = local_ai.local_call(system, text, schema, max_tokens)
    except (httpx.HTTPError, ValueError, KeyError) as e:
        raise AIRetryLater(f"{reason} — AI local lỗi: {str(e)[:150]}") from e
    if res["usage"]["input_tokens"] >= LOCAL_LLM_CTX * 0.95:   # Ollama đã cắt đầu vào
        return cli(too_long)
    return res


def build_cards(doc: dict, source: dict, raw_dir: Path, existing: list[str] | None = None) -> dict:
    """Trả về {doc_summary, relevance, primary_category, categories, suggested_categories, cards: [...]}.
    `existing`: tiêu đề thẻ đã có cho tài liệu này (Claude làm dở qua MCP / cập nhật thẻ khi nội dung đổi) — AI chỉ
    viết phần còn thiếu."""
    from .. import categories as cat_mod
    if not ai_ready():
        raise AINotReady(claude_off() or "AI chưa sẵn sàng")

    content: list[dict] = []
    for name in doc.get("images", []):
        path = raw_dir / name
        mime = mimetypes.guess_type(path.name)[0]
        if mime in IMAGE_TYPES and path.exists() and path.stat().st_size <= MAX_IMAGE_BYTES:
            content.append({"type": "image", "source": {"type": "base64", "media_type": mime,
                                                        "data": base64.standard_b64encode(path.read_bytes()).decode()}})
    cats = cat_mod.ai_list()
    full = cat_mod.labels()
    system = SYSTEM_TEMPLATE.format(types="\n".join(f"- {k}: {v}" for k, v in CARD_TYPES.items()),
                                    tree=cat_mod.prompt_tree(cats), rules=classify.AI_RULES)

    header = [f"Loại nguồn: {SOURCE_LABELS.get(source['kind'], source['kind'])}", f"Tiêu đề: {doc['title']}"]
    if doc.get("url"):
        header.append(f"Link: {doc['url']}")
    if hint := AUDIO_HINTS.get((source.get("options") or {}).get("audio_type") or ""):
        header.append(hint)
    if source["kind"] in ("audio", "video_file", "video"):
        header.append("Mốc [mm:ss] trong tài liệu là thời điểm trong ghi âm / video — giữ mốc trong `evidence`.")
    if source.get("categories"):
        hint = ", ".join(full.get(s, s) for s in source["categories"])
        header.append(f"Người nạp gợi ý lĩnh vực: {hint}")
    if note := user_notes_block(source, [doc["_id"]] if doc.get("_id") else []):
        header.append(note)
    if existing:
        header.append("Tài liệu này đã có các thẻ sau — KHÔNG viết lại các ý này, chỉ viết thẻ cho "
                      "phần còn thiếu (không còn gì đáng viết thì trả `cards` rỗng):\n"
                      + "\n".join(f"- {t}" for t in existing))
    content.append({"type": "text", "text": "\n".join(header) + f"\n\n<tai_lieu>\n{doc['text']}\n</tai_lieu>"})
    return structured_call(system, content, output_schema([c["slug"] for c in cats]), images_optional=True,
                           too_long="Kết quả quá dài, bị cắt — hãy chia nhỏ tài liệu")


def structured_call(system: str, content: list[dict] | str, schema: dict, max_tokens: int = 16000,
                    model: str | None = None, too_long: str = "Kết quả quá dài, bị cắt",
                    images_optional: bool = False) -> dict:
    """Gọi Claude, trả JSON theo `schema` kèm `usage`. Dùng chung cho VCWIKI và Xưởng chiến dịch.
    Claude không dùng được (chưa có key, hết quota) -> việc chỉ có chữ chạy trên AI local (Ollama); việc có ảnh /
    PDF chờ Claude, trừ khi `images_optional` (ảnh chỉ là phần phụ, vd ảnh kèm tài liệu khi dựng thẻ) thì bỏ ảnh."""
    global _auth_error, _quota_error
    if not ai_ready():
        raise AINotReady(claude_off() or "AI chưa sẵn sàng")
    if reason := claude_off():
        return _fallback(system, content, schema, max_tokens, reason, images_optional, model or WIKI_MODEL)
    model = model or WIKI_MODEL
    kwargs: dict = {}
    if model.startswith(("claude-opus-5", "claude-fable")):
        # Khi bộ lọc an toàn từ chối nhầm, API tự chạy lại trên model dự phòng phù hợp
        kwargs = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"}
    try:
        # stream: đầu ra dài (kế hoạch nhiều tập, kịch bản) không bị timeout HTTP
        with client().beta.messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": content}],
            output_config={"format": {"type": "json_schema", "schema": schema}},
            **kwargs,
        ) as stream:
            res = stream.get_final_message()
    except anthropic.AuthenticationError as e:
        _auth_error = (time.time(), "ANTHROPIC_API_KEY không hợp lệ")
        raise AINotReady(_auth_error[1]) from e
    except (anthropic.BadRequestError, anthropic.PermissionDeniedError, anthropic.RateLimitError) as e:
        if not QUOTA_RE.search(str(e)):
            if isinstance(e, anthropic.RateLimitError):
                raise AIRetryLater(str(e)[:200]) from e
            raise
        _quota_error = (time.time(), f"Claude hết quota: {str(e)[:200]}")
        print(f"{_quota_error[1]} — nghỉ Claude {CLAUDE_QUOTA_PAUSE // 60} phút")
        return _fallback(system, content, schema, max_tokens, _quota_error[1], images_optional, model)
    except (anthropic.RateLimitError, anthropic.APIConnectionError, anthropic.InternalServerError) as e:
        raise AIRetryLater(str(e)[:200]) from e

    if res.stop_reason == "refusal":
        raise ValueError("AI từ chối xử lý yêu cầu này")
    if res.stop_reason == "max_tokens":
        raise ValueError(too_long)
    text = next(b.text for b in res.content if b.type == "text")
    data = json.loads(text)
    data["usage"] = {"input_tokens": res.usage.input_tokens, "output_tokens": res.usage.output_tokens,
                     "model": res.model}
    return data
