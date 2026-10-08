"""So bản chữ Whisper với phụ đề nền tảng (TikTok tự sinh phụ đề cho phần lớn video).

Phụ đề TikTok cũng là máy nhận dạng (không dấu câu, viết hoa lung tung, vẫn nghe nhầm) nên không coi là
đáp án đúng: đây là hai bộ nhận dạng độc lập — chỗ hai bên khớp gần như chắc đúng, chỗ lệch là nơi có lỗi.
Gom các cặp lệch lặp lại qua nhiều video (scripts/asr_report.py) để biết Whisper hay nghe sai từ nào,
rồi quyết định: đổi model, thêm từ vựng chuyên ngành vào prompt, hay sửa sau nhận dạng.
"""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

MAX_DIFFS = 80      # số chỗ lệch giữ lại mỗi video (đủ để gom thống kê, không phình document)


# Khác cách viết chứ không phải nghe sai: đưa về một dạng trước khi so, để báo cáo chỉ còn lỗi thật
NUM_WORDS = {"không": None, "một": "1", "hai": "2", "ba": "3", "bốn": "4", "tư": None, "năm": "5", "sáu": "6",
             "bảy": "7", "tám": "8", "chín": "9", "mười": "10"}      # hai bên đổi như nhau nên "năm 2024" -> "5 2024" vẫn khớp; "không" / "tư" giữ nguyên
SPELLING = {"tỉ": "tỷ", "kĩ": "kỹ", "lí": "lý", "mĩ": "mỹ", "hông": "không", "ô kê": "ok", "oke": "ok", "okay": "ok",
            "nhá": "nhé", "nha": "nhé"}
FILLERS = {"ờ", "ừ", "ừm", "ưm", "à", "ơ", "ấy", "ạ"}


def words(text: str) -> list[str]:
    """Chuẩn hoá để so: NFC, chữ thường, bỏ dấu câu, bỏ từ đệm, số viết chữ -> chữ số,
    "10.000.000" / "10 000 000" -> "10 triệu", chính tả i/y. Chỉ dùng để so, không sửa bản chữ."""
    text = unicodedata.normalize("NFC", text or "").lower()
    for a, b in SPELLING.items():
        text = re.sub(rf"(?<!\w){a}(?!\w)", b, text)
    text = re.sub(r"(\d)[ .,]000[ .,]000[ .,]000(?!\d)", r"\1 tỷ", text)
    text = re.sub(r"(\d)[ .,]000[ .,]000(?!\d)", r"\1 triệu", text)
    text = re.sub(r"(\d)[ .,]000(?!\d)", r"\1 nghìn", text)
    text = re.sub(r"(?<!\w)ngàn(?!\w)", "nghìn", text)
    out = [w for w in re.findall(r"[\w%]+", text) if w not in FILLERS]
    return [NUM_WORDS[w] if NUM_WORDS.get(w) else w for w in out]


def compare(whisper_text: str, sub_text: str) -> dict:
    """-> {agreement, wer, words_whisper, words_sub, diffs: [{whisper, sub, at}]}.

    agreement = tỉ lệ từ khớp trên tổng từ của bản dài hơn; wer = (thay + thêm + thiếu) / số từ phụ đề.
    `at` là vị trí từ trong bản Whisper, để mở đúng đoạn khi xem lại.
    """
    a, b = words(whisper_text), words(sub_text)
    sm = SequenceMatcher(None, a, b, autojunk=False)
    same = sum(blk.size for blk in sm.get_matching_blocks())
    errors, diffs = 0, []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        errors += max(i2 - i1, j2 - j1)
        if len(diffs) < MAX_DIFFS:
            diffs.append({"whisper": " ".join(a[i1:i2]), "sub": " ".join(b[j1:j2]), "at": i1})
    return {
        "agreement": round(same / max(len(a), len(b), 1), 4),
        "wer": round(errors / max(len(b), 1), 4),
        "words_whisper": len(a), "words_sub": len(b),
        "diffs": diffs,
    }
