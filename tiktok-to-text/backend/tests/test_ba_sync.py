"""docs/BA.md Phụ lục A phải khớp code (backend/app/spec.py) — code đổi loại / trạng thái / quyền / tool MCP mà
chưa sinh lại phụ lục thì test này đỏ. Sửa: cd backend && ../.venv/bin/python scripts/sync_ba.py"""

from __future__ import annotations

from app import spec


def test_ba_appendix_matches_code():
    assert spec.sync_ba(check=True), "Phụ lục A của docs/BA.md lệch code — chạy scripts/sync_ba.py"


def test_spec_reads_real_constants():
    s = spec.system_spec()
    assert {"framework", "skill"} <= {t["type"] for t in s["cards"]["types"]}
    assert s["cards"]["statuses"] == ["draft", "approved", "rejected"]
    assert s["categories"]["max_level"] >= 1
    assert s["permissions"]["space_actions"]["card.write"] == "editor"
    assert "get_system_spec" in {t["name"] for t in s["mcp"]["tools"]}


def test_ba_section_lookup():
    assert spec.ba_section("4.3").startswith("### 4.3")
    assert spec.ba_section("15").startswith("## 15.")
    assert spec.ba_section("Phụ lục A") is not None
    assert spec.ba_section("99.9") is None
