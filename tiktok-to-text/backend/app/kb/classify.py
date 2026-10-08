"""Trục phân loại v2 của thẻ VCWIKI ngoài lĩnh vực (BA 4.4, WK-27): cấp độ người đọc, đơn vị áp dụng,
bước quy trình, cùng ngày hiệu lực và chu kỳ rà soát (BA 16.6).

Một nơi giữ danh sách giá trị + hàm kiểm tra, dùng chung cho API web, MCP, pipeline AI và spec.py.
Thẻ cũ không có trường: level = None, division = ["tap-doan"], process_steps = [] (`defaults`).
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException

LEVELS = {
    "dieu-hanh": "Điều hành — đáng tiền không, đo bằng gì, khi nào biết hỏng, hỏi cấp dưới câu gì",
    "thiet-ke": "Thiết kế — thiết kế hệ thống, chọn công cụ, đặt KPI, ngân sách",
    "van-hanh": "Vận hành — phân việc, checklist tuần, review đầu ra, KPI cá nhân",
    "thuc-thi": "Thực thi — làm từng bước, mẫu biểu, lỗi hay gặp",
    "nhap-mon": "Nhập môn — thuật ngữ, quy trình 1 trang, việc đơn giản đầu tiên",
}
DIVISIONS = {
    "vcpart": "VCpart", "vcsoft": "VCsoft", "vcobd": "VCOBD", "vcservice": "VCservice", "vce": "VCE",
    "vcmedia": "VCmedia", "tap-doan": "Tập đoàn (dùng chung)",
}
DEFAULT_DIVISION = ["tap-doan"]
# Chuỗi quy trình A-B-C-D đã mở (Phân loại VCwiki v2 mục 10). Người nhập được chuỗi khác đúng định dạng;
# AI dựng thẻ chỉ chọn trong danh sách này.
PROCESS_CHAINS = {
    "ban-hang-b2b": "Bán hàng B2B phụ tùng", "san-tmdt": "Bán trên sàn", "mua-hang": "Mua hàng – nhập khẩu",
    "nhan-su": "Tuyển – dùng – giữ", "dieu-hanh-thang": "Nhịp điều hành tháng", "tuyen-sinh-vce": "Tuyển sinh VCE",
    "dich-vu-xuong": "Dịch vụ xưởng VCservice", "trien-khai-vcgarage": "Triển khai VCgarage",
}
PROCESS_STEP_RE = re.compile(r"^qt\.[a-z0-9-]+\.[a-d]$")
MAX_PROCESS_STEPS = 2
REVIEW_CYCLE_MAX = 60          # tháng
FIELDS = ("level", "division", "process_steps", "effective_at", "review_cycle_months")


def process_step_options() -> list[str]:
    return [f"qt.{c}.{s}" for c in PROCESS_CHAINS for s in "abcd"]


LABELS = {"level": "Cấp độ", "division": "Division", "process_steps": "Bước quy trình",
          "process_step": "Bước quy trình", "effective_at": "Ngày hiệu lực", "review_cycle_months": "Rà soát (tháng)",
          "type": "Loại thẻ", "status": "Trạng thái"}


def _bad(field: str, msg: str):
    """Lỗi nêu cả tên trường (AI / API) và nhãn trên form web."""
    label = f" ({LABELS[field]})" if field in LABELS else ""
    raise HTTPException(400, f"Trường {field}{label}: {msg}")


def check_level(v: str | None) -> str | None:
    if v in (None, ""):
        return None
    if v not in LEVELS:
        _bad("level", f"'{v}' không hợp lệ — chọn một trong {', '.join(LEVELS)}")
    return v


def check_division(v: list[str] | None) -> list[str]:
    vals = list(dict.fromkeys(x.strip() for x in v or [] if x and x.strip()))
    wrong = [x for x in vals if x not in DIVISIONS]
    if wrong:
        _bad("division", f"{', '.join(wrong)} không hợp lệ — chọn trong {', '.join(DIVISIONS)}")
    return vals or list(DEFAULT_DIVISION)


def csv(v: str | None) -> list[str]:
    """Bộ lọc nhiều giá trị "a, b,c" -> ["a", "b", "c"]: bỏ khoảng trắng, bỏ rỗng, bỏ trùng."""
    return list(dict.fromkeys(x.strip() for x in (v or "").split(",") if x.strip()))


def check_step_format(vals: list[str], field: str = "process_steps") -> list[str]:
    """Chỉ kiểm định dạng qt.<chuỗi>.<a|b|c|d> (dùng cả khi lọc — lọc không giới hạn số giá trị)."""
    wrong = [x for x in vals if not PROCESS_STEP_RE.match(x)]
    if wrong:
        _bad(field, f"{', '.join(wrong)} sai định dạng — dạng qt.<chuỗi>.<a|b|c|d>, vd qt.ban-hang-b2b.c")
    return vals


def check_process_steps(v: list[str] | None) -> list[str]:
    """Ghi thẻ: đúng định dạng và tối đa MAX_PROCESS_STEPS bước."""
    vals = check_step_format(list(dict.fromkeys(x.strip() for x in v or [] if x and x.strip())))
    if len(vals) > MAX_PROCESS_STEPS:
        _bad("process_steps", f"tối đa {MAX_PROCESS_STEPS} bước")
    return vals


DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def check_effective_at(v) -> datetime | None:
    if v in (None, ""):
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day, tzinfo=timezone.utc)
    s = str(v).strip()
    try:   # đúng YYYY-MM-DD, hoặc ngày giờ ISO đầy đủ (YYYY-MM-DDTHH:MM…) — không cắt bỏ đuôi lạ
        if DATE_RE.match(s):
            return check_effective_at(date.fromisoformat(s))
        if DATE_RE.match(s[:10]) and s[10:11] in ("T", " "):
            return check_effective_at(datetime.fromisoformat(s))
    except ValueError:
        pass
    _bad("effective_at", f"'{v}' không phải ngày YYYY-MM-DD")


def check_review_cycle(v) -> int | None:
    if v in (None, "", 0) and not isinstance(v, bool):
        return None
    if isinstance(v, bool) or not isinstance(v, int) or not 1 <= v <= REVIEW_CYCLE_MAX:
        _bad("review_cycle_months", f"số tháng 1–{REVIEW_CYCLE_MAX}")
    return v


def add_months(d: datetime, months: int) -> datetime:
    """Cộng tháng lịch; ngày không có ở tháng đích (31, 29/2…) -> ngày cuối tháng đó."""
    y, m = divmod(d.month - 1 + months, 12)
    y, m = d.year + y, m + 1
    last = (date(y + m // 12, m % 12 + 1, 1) - timedelta(days=1)).day
    return d.replace(year=y, month=m, day=min(d.day, last))


def next_review_at(effective_at: datetime | None, cycle: int | None) -> datetime | None:
    """Ngày phải rà lại = ngày hiệu lực + chu kỳ (tháng lịch)."""
    if not effective_at or not cycle:
        return None
    return add_months(effective_at, cycle)


def clean(changes: dict, card: dict | None = None) -> dict:
    """Kiểm tra các trường phân loại v2 có mặt trong `changes` (sai -> 400 nêu tên trường); tính next_review_at."""
    out = {}
    if "level" in changes:
        out["level"] = check_level(changes["level"])
    if "division" in changes:
        out["division"] = check_division(changes["division"])
    if "process_steps" in changes:
        out["process_steps"] = check_process_steps(changes["process_steps"])
    if "effective_at" in changes:
        out["effective_at"] = check_effective_at(changes["effective_at"])
    if "review_cycle_months" in changes:
        out["review_cycle_months"] = check_review_cycle(changes["review_cycle_months"])
    if {"effective_at", "review_cycle_months"} & out.keys():
        merged = (card or {}) | out
        out["next_review_at"] = next_review_at(merged.get("effective_at"), merged.get("review_cycle_months"))
    return out


STORED = (*FIELDS, "next_review_at")


def is_default(field: str, value) -> bool:
    """Giá trị mặc định không ghi vào DB (đọc ra vẫn có nhờ `defaults`) — thẻ không đổi nội dung thì snapshot phiên
    bản (kb/revisions.py) không lệch vì thêm trường rỗng."""
    return value in (None, "", []) or (field == "division" and value == DEFAULT_DIVISION)


def split(values: dict) -> tuple[dict, dict]:
    """-> ($set, $unset) cho các trường phân loại v2 trong `values`."""
    keep = {k: v for k, v in values.items() if k in STORED and not is_default(k, v)}
    drop = {k: "" for k, v in values.items() if k in STORED and is_default(k, v)}
    return keep, drop


def defaults(card: dict) -> dict:
    """Giá trị đọc ra cho thẻ cũ chưa có trường."""
    return {"level": card.get("level"), "division": card.get("division") or list(DEFAULT_DIVISION),
            "process_steps": card.get("process_steps") or [], "effective_at": card.get("effective_at"),
            "review_cycle_months": card.get("review_cycle_months"), "next_review_at": card.get("next_review_at")}


def filters(level: str | None = None, division: str | None = None, process_step: str | None = None) -> list[dict]:
    """Điều kiện Mongo cho bộ lọc; division tap-doan khớp cả thẻ cũ chưa có trường."""
    f: list[dict] = []
    if levels := csv(level):
        f.append({"level": {"$in": [check_level(x) for x in levels]}})
    if divs := csv(division):
        vals = check_division(divs)
        cond: dict = {"division": {"$in": vals}}
        f.append({"$or": [cond, {"division": {"$exists": False}}, {"division": []}]} if "tap-doan" in vals else cond)
    if steps := csv(process_step):   # lọc: bao nhiêu bước cũng được, giới hạn 2 chỉ áp khi ghi thẻ
        f.append({"process_steps": {"$in": check_step_format(steps, "process_step")}})
    return f


# --- AI dựng thẻ (kb/wiki.py, kb/synth.py) ---------------------------------------------------------------------

def ai_schema_props() -> dict:
    """Thuộc tính thêm vào structured output: chỉ chọn trong danh sách, không chắc thì để trống."""
    return {
        "level": {"type": "string", "enum": ["", *LEVELS],
                  "description": "Cấp độ người đọc; chuỗi rỗng nếu không chắc"},
        "division": {"type": "array", "items": {"type": "string", "enum": list(DIVISIONS)},
                     "description": "Đơn vị áp dụng; kiến thức dùng chung hoặc không rõ thì ['tap-doan']"},
        "process_steps": {"type": "array", "items": {"type": "string", "enum": process_step_options()},
                          "description": "0–2 bước quy trình; không thuộc chuỗi nào thì mảng rỗng, không bịa"},
    }


AI_RULES = ("- `level`: người đọc chính của thẻ — "
            + "; ".join(f"{k} = {v}" for k, v in LEVELS.items()) + ". Không chắc thì để chuỗi rỗng.\n"
            "- `division`: đơn vị VC Phồn Vinh mà thẻ áp dụng (" + ", ".join(f"{k} = {v}" for k, v in DIVISIONS.items())
            + "). Kiến thức chung hoặc không rõ: [\"tap-doan\"].\n"
            "- `process_steps`: 0–2 bước của chuỗi quy trình A-B-C-D mà thẻ giúp làm ("
            + "; ".join(f"qt.{k} = {v}" for k, v in PROCESS_CHAINS.items())
            + "). Không thuộc bước nào thì mảng rỗng, không bịa.")


def from_ai(card: dict) -> dict:
    """Làm sạch 3 trường AI trả về: giá trị lạ bị bỏ thay vì làm hỏng cả tài liệu."""
    level = card.get("level")
    divs = [d for d in card.get("division") or [] if d in DIVISIONS]
    steps = [s for s in card.get("process_steps") or [] if PROCESS_STEP_RE.match(s or "")]
    return {"level": level if level in LEVELS else None, "division": list(dict.fromkeys(divs)) or list(DEFAULT_DIVISION),
            "process_steps": list(dict.fromkeys(steps))[:MAX_PROCESS_STEPS]}


def ai_card(card: dict) -> dict:
    """Thẻ AI trả về -> bỏ 3 trường thô, thay bằng giá trị đã làm sạch (giá trị mặc định không ghi)."""
    return {k: v for k, v in card.items() if k not in STORED} | split(from_ai(card))[0]
