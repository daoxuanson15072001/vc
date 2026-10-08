"""ORG-10 — một điểm kiểm tra quyền (docs/BA.md mục 15.7 quy tắc 1).

Quét mã nguồn `backend/app/**/*.py`: ngoài `policy.py` không module nào được tự diễn giải vai trò trong kho
(`ROLE_RANK`, `role_in`, `readable_filter`, so `role` của thành viên kho) để ra quyết định quyền.
Cần quyền mới -> thêm vào `policy.py` rồi gọi `policy.can` / `require` / `visible_filter` / `load_space`.
"""

from __future__ import annotations

import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "app"

# Chỉ policy.py được dùng các tên / mẫu này
FORBIDDEN = {
    "ROLE_RANK": re.compile(r"\bROLE_RANK\b"),
    "role_in": re.compile(r"\brole_in\b"),
    "readable_filter": re.compile(r"\breadable_filter\b"),
    # tự lọc thành viên kho theo vai trò, vd {"members": {"$elemMatch": {..., "role": ...}}}
    "members.$elemMatch + role": re.compile(r"members\"?\s*:\s*\{\s*\"\$elemMatch\"[^}]*\"role\""),
    # tự so vai trò thành viên kho, vd role in ("owner", "editor")
    "so vai trò kho": re.compile(r"in \(\s*\"owner\",\s*\"editor\"\s*\)|in \(\s*\"editor\",\s*\"owner\"\s*\)"),
}
ALLOWED = {"policy.py"}


def _sources():
    for p in sorted(APP.rglob("*.py")):
        if p.relative_to(APP).as_posix() not in ALLOWED:
            yield p


def test_no_permission_decisions_outside_policy():
    hits = []
    for p in _sources():
        for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if line.lstrip().startswith("#"):
                continue
            for name, rx in FORBIDDEN.items():
                if rx.search(line):
                    hits.append(f"{p.relative_to(APP)}:{n}: {name}: {line.strip()}")
    assert not hits, "Kiểm tra quyền phải đi qua policy.py (ORG-10):\n" + "\n".join(hits)


def test_spaces_get_space_only_compat_wrapper():
    """spaces.get_space / readable_space_ids chỉ còn là lớp tương thích gọi lại policy; code trong app gọi policy."""
    hits = []
    for p in _sources():
        if p.name == "spaces.py":
            continue
        for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if re.search(r"\bget_space\b|spaces\.readable_space_ids|from \.+spaces import .*readable_space_ids", line):
                hits.append(f"{p.relative_to(APP)}:{n}: {line.strip()}")
    assert not hits, "Dùng policy.load_space / policy.readable_space_ids:\n" + "\n".join(hits)


def test_scanner_catches_violation(tmp_path):
    """Chính bộ quét phải bắt được vi phạm (không thì test trên luôn xanh vô nghĩa)."""
    bad = ['if ROLE_RANK[r] >= 2:', 'role_in(space, user)', 'spaces.find(readable_filter(user))',
           '{"members": {"$elemMatch": {"user_id": u, "role": {"$in": ["editor"]}}}}',
           'if role in ("owner", "editor"):']
    for line in bad:
        assert any(rx.search(line) for rx in FORBIDDEN.values()), line
    assert not any(rx.search('policy.can(user, "card.write", card)') for rx in FORBIDDEN.values())
