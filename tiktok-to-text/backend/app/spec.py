"""Thông số hệ thống đọc thẳng từ code — nguồn sự thật để AI đối chiếu kiến thức người dùng giao với tính năng thật.

Ba nơi dùng chung một hàm `system_spec()`:
- MCP `get_system_spec` — AI ngoài (Claude) hỏi trước khi áp quy tắc / phân loại mới vào dữ liệu;
- MCP `read_ba` — đọc docs/BA.md theo mục (ý đồ nghiệp vụ, kể cả phần chưa triển khai);
- `scripts/sync_ba.py` — ghi phụ lục "Thông số hệ thống" trong docs/BA.md; `tests/test_ba_sync.py` báo lỗi khi lệch.

Chỉ đọc hằng số / kiểu trong code (không đọc DB) nên kết quả chỉ đổi khi code đổi. Thêm tính năng mới có tham số
người dùng cần biết (loại, trạng thái, giới hạn, quyền) -> thêm vào đây, chạy `scripts/sync_ba.py`.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Literal, get_args, get_origin

BA_PATH = Path(__file__).resolve().parents[2] / "docs" / "BA.md"
TOPICS = ("cards", "categories", "permissions", "org", "learning", "mcp")
Topic = Literal["cards", "categories", "permissions", "org", "learning", "mcp"]


def _values(annotation) -> list[str]:
    """Các giá trị của Literal (kể cả `Literal[...] | None`)."""
    if get_origin(annotation) is Literal:
        return list(get_args(annotation))
    return [v for a in get_args(annotation) for v in _values(a)]


def _cards() -> dict:
    from .kb import routes
    from .kb import classify
    from .kb.wiki import AI_CARD_TYPES, CARD_TYPES

    desc = CARD_TYPES | AI_CARD_TYPES
    return {
        "types": [{"type": t, "description": desc.get(t, ""), "ai_memory_only": t in AI_CARD_TYPES}
                  for t in _values(routes.CardType)],
        "statuses": _values(routes.CardPatch.model_fields["status"].annotation),
        "fields": [f for f in routes.CardIn.model_fields if f not in ("space_id", "document_id")],
        "custom_fields": {"max": routes.MAX_FIELDS, "key_max_chars": 60, "value_max_chars": 4000,
                          "note": "Trường tự do {tên: giá trị} trên từng thẻ, ngoài các trường có kiểu dưới đây"},
        "classification_v2": {
            "level": {"values": dict(classify.LEVELS), "per_card": "0–1; thẻ cũ = null"},
            "division": {"values": dict(classify.DIVISIONS), "per_card": "≥ 1; mặc định / thẻ cũ = [tap-doan]"},
            "process_steps": {"format": classify.PROCESS_STEP_RE.pattern, "max": classify.MAX_PROCESS_STEPS,
                              "chains": {f"qt.{k}": v for k, v in classify.PROCESS_CHAINS.items()},
                              "note": "AI dựng thẻ chỉ chọn chuỗi trong danh sách; người nhập được chuỗi khác đúng định dạng"},
            "effective_at": "ngày hiệu lực YYYY-MM-DD (BA 16.6)",
            "review_cycle_months": f"1–{classify.REVIEW_CYCLE_MAX}; next_review_at = effective_at + chu kỳ",
            "version": "= current_revision (lịch sử phiên bản, BA 16.5); người duyệt / lý do sửa nằm ở card_revisions",
            "filters": "danh sách thẻ / search_cards lọc được level, division, process_step (nhiều giá trị, dấu phẩy)",
            "invalid_value": "400 nêu rõ trường sai; thẻ không được ghi",
        },
        "new_card_status": "draft",
    }


def _categories() -> dict:
    from . import categories

    return {"max_level": categories.MAX_LEVEL,
            "levels": "Mảng → Chuyên ngành → Chuyên môn → Đầu việc",
            "slug": "slug cha + '.' + tên không dấu nối gạch ngang, hoặc admin đặt tay (vd mkt.digital.seo, phải nối "
                    "sau slug cha); đổi tên thì slug đổi theo (sinh từ tên mới hoặc đặt tay) — nhánh con và thẻ / tài "
                    "liệu / nguồn / đề xuất đang mở / chức năng tổ chức / phạm vi quyền / lộ trình học gắn slug cũ chuyển "
                    "theo; slug cũ lưu ở old_slugs, link và lệnh gán dùng slug cũ vẫn tra ra nhánh",
            "node_fields": {"code": "mã hiển thị, vd 1.3.2",
                            "scope_note": f"≤ {categories.SCOPE_NOTE_MAX} ký tự, 4 dòng Gồm / Không gồm / Dễ nhầm "
                                          "với / Ví dụ thẻ — đưa vào prompt AI dựng thẻ",
                            "owner_id": "người chủ nhánh (giám đốc chuyên ngành), duyệt và rà soát thẻ trong nhánh"},
            "who_can_edit": "mọi người dùng (policy category.edit), web /wiki + /admin và MCP create_category / "
                            "update_category / delete_category; gán chủ nhánh (owner_id) chỉ admin (category.owner)",
            "delete": "xoá nhánh cùng mọi nhánh con (mọi cấp, kể cả cấp 1); cả nhánh rỗng thì xoá luôn; còn thẻ / tài "
                      "liệu / nguồn / lộ trình học gắn slug thì cần move_to (nhánh đích đang hiện, ngoài nhánh bị xoá) "
                      "— dữ liệu chuyển sang rồi mới xoá, không có -> 409 kèm số lượng; còn phạm vi quyền / chức năng "
                      "tổ chức -> 409, gỡ ở quản trị trước; muốn giữ thì ẩn (active=false)",
            "ai_suggestions": "pipeline AI dựng thẻ không tự thêm nhánh — ghi đề xuất vào hàng chờ, người dùng duyệt; "
                              "AI qua MCP thêm / sửa trực tiếp theo quyền người dùng",
            "ai_tree": "đã nạp cây v2 (scheme v2) thì AI dựng thẻ chỉ chọn trong cây v2; cây cũ còn cho thẻ cũ",
            "unknown_slug_on_card": "400 kèm danh sách slug sai (web và MCP); pipeline AI bỏ slug lạ",
            "card_categories": "lưu danh sách slug; lọc một nhánh ra cả nhánh con"}


def _permissions() -> dict:
    from . import org, policy

    other = [a for a in _values(policy.Action) if a not in policy.SPACE_ACTIONS]
    return {
        "system_roles": {"admin": "quản trị: người dùng, cây lĩnh vực, tổ chức, nhật ký — KHÔNG tự đọc nội dung kho "
                                  "của người khác (ORG-13)", "member": "người dùng thường"},
        "space_roles": list(policy.ROLE_ACTIONS),   # viewer < editor < owner
        "space_actions": dict(policy.SPACE_ACTIONS),
        "other_actions": other,
        "project_roles": list(policy.PROJECT_RANK),   # viewer < reviewer < editor < owner (dự án marketing, CE-32)
        "project_actions": dict(policy.PROJECT_ACTIONS),
        "org_grant_roles": list(org.GRANT_ROLES),
        "classifications": list(policy.CLASSIFICATIONS),
        "rules": ["Mọi kiểm tra quyền đi qua backend/app/policy.py",
                  "Không xem được -> 404 'không tìm thấy'; xem được mà thiếu quyền -> 403",
                  "Kho công khai trong công ty: mọi người là viewer",
                  "Mức mật chưa áp dụng lên thẻ (ORG-09 chưa triển khai); bản ghi không có mức mật coi như C1"],
    }


def _org() -> dict:
    from . import org

    return {"unit_kinds": [{"kind": k, "label": org.KIND_LABEL[k]} for k in sorted(org.KIND_RANK, key=org.KIND_RANK.get)],
            "max_depth": org.MAX_DEPTH,
            "grant_roles": list(org.GRANT_ROLES),
            "career_levels": {str(k): v for k, v in org.LEVEL_NAMES.items()},
            "career_level_rules": "users.org.level 1–7 hoặc null; chỉ dữ liệu (ORG-05 phần dữ liệu) — CHƯA có luật "
                                  "quyền theo cấp",
            "level_map_default": {str(k): v for k, v in org.DEFAULT_LEVEL_MAP.items()},
            "level_map_note": "cấp bậc → bậc nội dung của thẻ: own = mảng của chức năng chính "
                              "(org_functions.category_root), other = mảng khác; sửa ở /org tab Cấp bậc "
                              "(GET / PUT /api/org/level-map); policy.content_levels_for(user, category_root)"}


def _learning() -> dict:
    from .learn import models

    return {name: _values(getattr(models, name)) for name in
            ("QuestionKind", "Bloom", "LessonStatus", "QuestionStatus", "PathStatus", "AssignmentStatus", "AttemptKind")}


def _mcp() -> dict:
    from .mcp_server import mcp

    return {"tools": [{"name": t.name, "summary": _first_sentence(t.description or "")}
                      for t in mcp._tool_manager.list_tools()]}


def _first_sentence(text: str, limit: int = 140) -> str:
    first = text.strip().split("\n")[0].split(". ")[0].rstrip(".")
    return first if len(first) <= limit else first[:limit].rsplit(" ", 1)[0].rstrip(",:;(") + "…"


_BUILDERS = {"cards": _cards, "categories": _categories, "permissions": _permissions, "org": _org,
             "learning": _learning, "mcp": _mcp}


def system_spec(topic: str | None = None) -> dict:
    return {t: _BUILDERS[t]() for t in ([topic] if topic else TOPICS)}


# ---------------------------------------------------------------------------
# docs/BA.md
# ---------------------------------------------------------------------------

HEADING = re.compile(r"^(#{1,4})\s+(.*)$")


def ba_toc() -> list[dict]:
    out = []
    for i, line in enumerate(BA_PATH.read_text(encoding="utf-8").splitlines(), 1):
        if (m := HEADING.match(line)) and len(m.group(1)) >= 2:
            out.append({"level": len(m.group(1)), "title": m.group(2).strip(), "line": i})
    return out


def _heading_matches(title: str, key: str) -> bool:
    """"4" khớp "4. Phân hệ…" (không khớp "4.3 …"); "4.3" khớp "4.3 …"; chữ thì khớp khi nằm trong tiêu đề."""
    if key[:1].isdigit():
        return re.match(re.escape(key) + r"\.?(\s|$)", title) is not None
    return key in title


def ba_section(section: str) -> str | None:
    """Nội dung một mục theo số ("4.3", "15", "Phụ lục A") hoặc chữ trong tiêu đề — gồm cả mục con."""
    lines = BA_PATH.read_text(encoding="utf-8").splitlines()
    key = section.strip().rstrip(".").lower()
    start = level = None
    for i, line in enumerate(lines):
        m = HEADING.match(line)
        if not m:
            continue
        if start is None:
            if _heading_matches(m.group(2).strip().lower(), key):
                start, level = i, len(m.group(1))
        elif len(m.group(1)) <= level:
            return "\n".join(lines[start:i]).strip()
    return "\n".join(lines[start:]).strip() if start is not None else None


def ba_search(query: str, limit: int = 30) -> list[dict]:
    """Dòng BA chứa từ khoá (không phân biệt dấu), kèm mục chứa nó."""
    from .db import unaccent

    q, head, out = unaccent(query), "", []
    for i, line in enumerate(BA_PATH.read_text(encoding="utf-8").splitlines(), 1):
        if m := HEADING.match(line):
            head = m.group(2).strip()
        elif q in unaccent(line):
            out.append({"line": i, "section": head, "text": line.strip()[:300]})
            if len(out) >= limit:
                break
    return out


# ---------------------------------------------------------------------------
# Phụ lục tự sinh trong docs/BA.md
# ---------------------------------------------------------------------------

START = "<!-- AUTO:SYSTEM-SPEC:START — sinh bởi backend/scripts/sync_ba.py từ backend/app/spec.py, đừng sửa tay -->"
END = "<!-- AUTO:SYSTEM-SPEC:END -->"


def _code(items) -> str:
    return " · ".join(f"`{i}`" for i in items)


def render_markdown() -> str:
    s = system_spec()
    c, cat, p, o, lr, m = (s[t] for t in TOPICS)
    rows = [
        "## Phụ lục A — Thông số hệ thống (sinh tự động từ code)",
        "",
        "Phần này phản ánh **đúng những gì code đang chạy**, sinh lại bằng `backend/scripts/sync_ba.py`; "
        "`backend/tests/test_ba_sync.py` báo lỗi khi code đổi mà phụ lục chưa sinh lại. Các mục khác của BA mô tả "
        "ý đồ nghiệp vụ, có thể gồm phần chưa triển khai — khi lệch, phụ lục này là hiện trạng. AI qua MCP đọc cùng "
        "dữ liệu bằng tool `get_system_spec`.",
        "",
        "### A.1 Thẻ VCWIKI",
        "",
        "| Loại (`type`) | Dùng cho | Chỉ bộ nhớ AI |",
        "| --- | --- | --- |",
        *[f"| `{t['type']}` | {t['description']} | {'có' if t['ai_memory_only'] else ''} |" for t in c["types"]],
        "",
        f"- Trạng thái: {_code(c['statuses'])}; thẻ mới luôn là `{c['new_card_status']}`.",
        f"- Trường: {_code(c['fields'])}.",
        f"- Trường tự thêm (`fields`): tối đa {c['custom_fields']['max']} trường / thẻ, tên ≤ "
        f"{c['custom_fields']['key_max_chars']} ký tự, giá trị ≤ {c['custom_fields']['value_max_chars']} ký tự. "
        f"{c['custom_fields']['note']}.",
        "",
        "### A.2 Cây lĩnh vực",
        "",
        f"- Tối đa **{cat['max_level']} cấp**. Slug: {cat['slug']}.",
        f"- Ai sửa cây: {cat['who_can_edit']}. {cat['ai_suggestions']}.",
        f"- Slug chưa có trong cây khi gán cho thẻ: {cat['unknown_slug_on_card']}. Thẻ {cat['card_categories']}.",
        "",
        "### A.3 Phân quyền",
        "",
        *[f"- Vai trò hệ thống `{k}`: {v}." for k, v in p["system_roles"].items()],
        f"- Vai trò trong kho (thấp → cao): {_code(p['space_roles'])}.",
        "",
        "| Hành động trên kho | Vai trò kho tối thiểu |",
        "| --- | --- |",
        *[f"| `{a}` | `{r}` |" for a, r in p["space_actions"].items()],
        "",
        f"- Hành động khác (luật riêng trong `policy.can`): {_code(p['other_actions'])}.",
        f"- Dự án marketing: vai trò dự án (thấp → cao) {_code(p['project_roles'])}; hành động → vai trò tối thiểu: "
        + ", ".join(f"`{a}` → `{r}`" for a, r in p["project_actions"].items())
        + " (vai trò hiệu lực = cao hơn giữa vai trò kho chứa dự án và vai trò thành viên dự án).",
        f"- Vai trò chức năng theo tổ chức: {_code(p['org_grant_roles'])}. Mức mật: {_code(p['classifications'])}.",
        *[f"- {r}." for r in p["rules"]],
        "",
        "### A.4 Tổ chức",
        "",
        f"- Loại đơn vị (cao → thấp): {' > '.join(f'{u['label']} (`{u['kind']}`)' for u in o['unit_kinds'])}; "
        f"tối đa {o['max_depth']} tầng.",
        f"- Cấp bậc nhân sự: {o['career_levels']}.",
        "",
        "### A.5 Học tập",
        "",
        *[f"- `{k}`: {_code(v)}." for k, v in lr.items()],
        "",
        "### A.6 Cổng MCP",
        "",
        "| Tool | Việc |",
        "| --- | --- |",
        *[f"| `{t['name']}` | {t['summary'].replace('|', '/')} |" for t in m["tools"]],
    ]
    return "\n".join([START, *rows, END])


def sync_ba(check: bool = False) -> bool:
    """Ghi phụ lục vào docs/BA.md (thay khối cũ, chưa có thì thêm cuối file). Trả về True nếu đã đúng sẵn."""
    text = BA_PATH.read_text(encoding="utf-8")
    block = render_markdown()
    if START in text and END in text:
        new = text[:text.index(START)] + block + text[text.index(END) + len(END):]
    else:
        new = text.rstrip("\n") + "\n\n---\n\n" + block + "\n"
    if new == text:
        return True
    if not check:
        BA_PATH.write_text(new, encoding="utf-8")
    return False
