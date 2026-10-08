"""Dịch lời nói tiếng nước ngoài sang tiếng Việt — luồng riêng, bản gốc giữ nguyên.

Whisper chép đúng ngôn ngữ người nói (tiếng Trung ra chữ Hán). Bản dịch đi từng câu, giữ mốc thời gian của câu
gốc để đặt cạnh nhau. AI local làm trước (context nhỏ nên chia lô ngắn), lỗi thì Claude; không có AI nào thì bỏ
qua bước dịch — bản gốc vẫn được lưu, dịch lại sau được.
"""

from __future__ import annotations

import re
import time

from ..worker import core
from . import glossary, local_ai, wiki

TARGET = "vi"
BATCH_CHARS = 600           # chữ gốc mỗi lượt gọi: vừa context 4k token của AI local kể cả câu trả lời
DENSE_WEIGHT = 3            # một chữ Hán / Kana / Thái ≈ một token và dịch ra dài gấp mấy lần: tính như 3 ký tự
LANG_NAMES = {"zh": "tiếng Trung", "yue": "tiếng Quảng Đông", "en": "tiếng Anh", "ja": "tiếng Nhật",
              "ko": "tiếng Hàn", "th": "tiếng Thái", "fr": "tiếng Pháp", "de": "tiếng Đức", "ru": "tiếng Nga",
              "es": "tiếng Tây Ban Nha", "id": "tiếng Indonesia", "ms": "tiếng Mã Lai", "km": "tiếng Khmer",
              "lo": "tiếng Lào", "vi": "tiếng Việt"}

SYSTEM = """Bạn là người dịch cho kho tri thức nội bộ. Dịch từng câu được đánh số sang tiếng Việt tự nhiên, \
đúng nghĩa, giữ thuật ngữ chuyên ngành. Chỉ kèm nguyên văn trong ngoặc cho tên riêng / thuật ngữ khó chưa có \
trong bảng thuật ngữ, ngay sau từ đó; không chép lại câu hay cụm gốc ở cuối câu dịch. \
Không tóm tắt, không thêm lời bình. Câu gốc là lời nói chuyển thành chữ nên có thể thiếu dấu câu hoặc nghe nhầm: \
dịch theo ngữ cảnh các câu xung quanh. Mỗi số chỉ dịch đúng câu của số đó — không gộp câu sau vào, \
câu bị ngắt giữa chừng thì dịch dở dang đúng phần đó. Trả đúng một bản dịch cho mỗi số. \
Bản dịch viết bằng chữ Việt: chữ gốc (chữ Hán, Kana, Hangul…) chỉ được nằm trong ngoặc cạnh bản dịch của nó, \
chỗ nghe nhầm / khó hiểu vẫn phải đoán nghĩa theo ngữ cảnh mà dịch ra tiếng Việt. Số, mã xe / mã lỗi / \
tên phần mềm (206, W223, EZS, SCN, DTS) giữ nguyên, không chú thích thêm. Có bảng thuật ngữ thì dùng đúng \
cách gọi của thợ Việt trong bảng."""
RETRY_NOTE = ("Lượt trước các câu này bị gộp / bỏ sót hoặc còn chữ gốc ngoài ngoặc. Dịch lại từng số riêng: mọi chữ "
              "gốc phải được dịch sang tiếng Việt, nếu cần giữ nguyên văn thì chỉ đặt trong ngoặc.")
# chữ gốc không phải chữ Latin còn sót trong bản dịch (ngoài ngoặc) -> dịch lại câu đó một lần
FOREIGN_SCRIPT = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff\u0e00-\u0e7f]")
RETRY_WAITS = (15, 60)
PARENS = re.compile(r"\([^()]*\)|（[^（）]*）")

SCHEMA = {"type": "object", "additionalProperties": False, "required": ["items"],
          "properties": {"items": {"type": "array", "items": {
              "type": "object", "additionalProperties": False, "required": ["index", "vi"],
              "properties": {"index": {"type": "integer"}, "vi": {"type": "string"}}}}}}


def lang_name(code: str | None) -> str:
    return LANG_NAMES.get(code or "", code or "không rõ")


def needs_translation(language: str | None) -> bool:
    return bool(language) and language != TARGET


def _batches(texts: list[str], language: str | None = None) -> list[list[int]]:
    weight = DENSE_WEIGHT if language in core.NO_SPACE_LANGS else 1
    out, cur, size = [], [], 0
    for i, t in enumerate(texts):
        if cur and size + len(t) * weight > BATCH_CHARS:
            out.append(cur)
            cur, size = [], 0
        cur.append(i)
        size += len(t) * weight
    return out + ([cur] if cur else [])


def leaks_source(vi: str) -> bool:
    """Bản dịch còn chữ gốc (Hán, Kana, Hangul, Kirin, Thái) nằm ngoài ngoặc."""
    return bool(FOREIGN_SCRIPT.search(PARENS.sub("", vi)))


def _call(texts: list[str], idx: list[int], language: str, out: list[str], models: set, note: str = "") -> None:
    numbered = "\n".join(f"{n}. {texts[i]}" for n, i in enumerate(idx, 1))
    terms = glossary.hints([texts[i] for i in idx], language)
    table = ("Bảng thuật ngữ (thợ Việt gọi):\n" + "\n".join(f"- {t} → {vi}" for t, vi in terms) + "\n\n") if terms else ""
    content = f"Ngôn ngữ gốc: {lang_name(language)}. {note}{table}Dịch {len(idx)} câu sau:\n\n{numbered}"
    data = local_ai.structured_call(SYSTEM, content, SCHEMA, engine="local", max_tokens=2000)
    models.add(data["usage"]["model"])
    for item in data["items"]:
        vi = item["vi"].strip()
        # lượt dịch lại chỉ thay khi sạch hơn
        if 1 <= item["index"] <= len(idx) and vi and not (note and leaks_source(vi)):
            out[idx[item["index"] - 1]] = vi


def translate_texts(texts: list[str], language: str) -> tuple[list[str], str]:
    """-> (bản dịch cùng thứ tự, model). Câu AI bỏ sót để rỗng. AI chưa sẵn sàng -> wiki.AINotReady."""
    out = [""] * len(texts)
    models = set()
    for idx in _batches(texts, language):
        _call(texts, idx, language, out, models)
    # AI local hay gộp nhiều câu vào một số (các số sau bỏ trống) hoặc để sót chữ gốc: dịch lại riêng các câu đó
    if redo := [i for i, vi in enumerate(out) if texts[i].strip() and (not vi or leaks_source(vi))]:
        for idx in _batches([texts[i] for i in redo], language):
            _call(texts, [redo[j] for j in idx], language, out, models, RETRY_NOTE + " ")
    return out, ", ".join(sorted(models))


def _with_retry(fn, log):
    """AI local bận (đang phục vụ việc khác, hỏi trạng thái quá 3 giây) bị coi là chưa sẵn sàng rồi rơi sang Claude;
    máy không có Claude thì chờ AI local rảnh, hỏi lại trạng thái rồi thử thêm trước khi bỏ bản dịch."""
    for wait in RETRY_WAITS:
        try:
            return fn()
        except wiki.AINotReady:
            log(f"  AI local chưa sẵn sàng, chờ {wait} giây rồi dịch lại")
            time.sleep(wait)
            local_ai.status(fresh=True)
    return fn()


def translate_segments(segs: list[tuple[float, float, str]], language: str, log=print) -> dict | None:
    """Câu Whisper -> {lang, source_lang, segments, text, engine}; None khi không cần / không dịch được."""
    if not segs or not needs_translation(language):
        return None
    try:
        vi, engine = _with_retry(lambda: translate_texts([t for _, _, t in segs], language), log)
    except wiki.AINotReady as e:
        log(f"  chưa dịch sang tiếng Việt: {e}")
        return None
    except Exception as e:  # noqa: BLE001 — dịch lỗi không làm mất bản chữ gốc
        log(f"  dịch sang tiếng Việt lỗi: {str(e)[:200]}")
        return None
    out = [(s, e, t) for (s, e, _), t in zip(segs, vi) if t]
    log(f"  đã dịch {lang_name(language)} → tiếng Việt: {len(out)}/{len(segs)} câu ({engine})")
    return {"lang": TARGET, "source_lang": language, "engine": engine,
            "segments": [{"start": round(s, 2), "end": round(e, 2), "text": t} for s, e, t in out],
            "text": " ".join(t for _, _, t in out)}
