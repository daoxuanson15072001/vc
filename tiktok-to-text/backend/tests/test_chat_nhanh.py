"""Chat nhanh (cửa sổ góc phải) — 28/09/2026: Claude đọc Hướng dẫn sử dụng (app/guide.py bóc từ
frontend/src/pages/guide/content.js), tool MCP `read_guide`, dòng bối cảnh trang kèm mục hướng dẫn liên quan (chat.py)."""

from __future__ import annotations

import json

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from app import chat, guide, mcp_server

from .conftest import make_user
from .test_phan_loai_v2 import ctx_for


def test_guide_boc_du_moi_muc_tu_content_js():
    secs = guide.sections()
    ids = [s["id"] for s in secs]
    assert len(secs) >= 15 and len(ids) == len(set(ids)), ids
    # mục nào cũng có tiêu đề, nhóm người đọc, thân bài markdown; số mục = số `id:` trong file (không bỏ sót mục)
    assert all(s["title"] and s["audience"] and len(s["body"]) > 100 for s in secs)
    assert guide.GUIDE_PATH.read_text(encoding="utf-8").count("\n    id: '") == len(secs)
    assert {"bat-dau", "tim-doc", "duyet", "claude", "hoi-dap"} <= set(ids)
    assert guide.section("khung-the")["title"].startswith("Khung thẻ")
    assert guide.section("Tìm và đọc")["id"] == "tim-doc"          # theo chữ trong tiêu đề, không dấu cũng được
    assert guide.section("tim va doc")["id"] == "tim-doc"
    assert guide.section("khong-co") is None
    assert guide.search("bon mat")[0]["section"] == "duyet"


@pytest.mark.parametrize("path,first", [
    ("/wiki?card=abc", "tim-doc"), ("/kb?source=1", "bat-dau"), ("/kb/videos?video=2", "nap-tu-lieu"),
    ("/learn/lessons/5", "hoc-tap"), ("/studio/quick/3", "viet-nhanh"), ("/studio/projects/2", "du-an-marketing"),
    ("/", "bat-dau"), ("/org", "quan-tri"), ("/chat/9", "claude"), ("/wiki/review", "duyet"), ("/spaces", "kho-chia-se"),
    ("http://localhost:5173/wiki/graph", "nghe-binh-chon"),
])
def test_guide_theo_trang_dang_mo(path, first):
    ids = [r["id"] for r in guide.for_path(path)]
    assert ids and ids[0] == first and len(ids) <= 3, (path, ids)


def test_guide_muc_tao_khoa_hoc_co_loi_nhan_sao_chep():
    """Mục 'Tạo một khoá học từ A đến Z' (28/09): 3 lời nhắn sao chép cho Claude (snippets) — bóc được và nối vào body
    để AI trong app / MCP đọc cùng mục; trang /learn/paths, /learn/design trỏ mục này trước."""
    s = guide.section("tao-khoa-hoc")
    assert [x["title"][:11] for x in s["snippets"]] == ["Lời nhắn 1 ", "Lời nhắn 2 ", "Lời nhắn 3 "]
    assert "design_path" in s["snippets"][0]["text"] and "Bước A — Câu hỏi" in s["snippets"][1]["text"]
    assert "POST /learn/paths/{id}/publish" in s["snippets"][2]["text"]
    assert s["body"].count("### Lời nhắn") == 3 and s["body"].index("### Lời nhắn 1") > s["body"].index("Danh sách kiểm")
    assert guide.section("bat-dau")["snippets"] == []
    for path in ("/learn/paths/abc", "/learn/design?id=1"):
        assert [r["id"] for r in guide.for_path(path)][:2] == ["tao-khoa-hoc", "soan-khoa"], path
    # 28/09 (v0.29): mục soan-khoa (checklist cho AI, đứng trước) cũng nói "Lưu và duyệt" — cả hai mục đều phải tìm ra
    assert {r["section"] for r in guide.search("Lưu và duyệt")} >= {"soan-khoa", "tao-khoa-hoc"}


def test_guide_trang_khong_khop():
    assert guide.for_path("/guide") == [] and guide.for_path("") == [] and guide.for_path(None) == []


def test_dong_boi_canh_trang_trong_chat():
    line = chat.context_line("/wiki?card=abc (Xử lý khách chê giá)")
    assert line.startswith("[Người dùng đang mở trang: /wiki?card=abc (Xử lý khách chê giá) — mục hướng dẫn liên quan: tim-doc (")
    assert line.endswith("]\n\n")
    assert chat.context_line(None) == "" and chat.context_line("") == ""
    # trang không có mục hướng dẫn: vẫn báo trang, không thêm gợi ý
    assert chat.context_line("/guide") == "[Người dùng đang mở trang: /guide]\n\n"
    # system prompt nhắc đọc hướng dẫn + cách hiểu đường dẫn trang
    sp = chat.system_prompt({"name": "A", "role": "member"})
    assert "mcp__vcwiki__read_guide" in sp and "tim-doc — Tìm và đọc thẻ" in sp and "/wiki?card=<id> → get_card" in sp


def test_mcp_read_guide():
    ctx = ctx_for(make_user("u1"))
    toc = json.loads(mcp_server.read_guide(ctx))
    assert any(t["id"] == "claude" for t in toc["toc"]) and toc["note"]
    sec = json.loads(mcp_server.read_guide(ctx, section="claude"))
    assert sec["anchor"] == "/guide#claude" and "Chat nhanh" in sec["text"] and sec["links"][0]["to"] == "/chat"
    hit = json.loads(mcp_server.read_guide(ctx, query="bon mat"))
    assert hit["matches"][0]["section"] == "duyet"
    rel = json.loads(mcp_server.read_guide(ctx, path="/wiki/review"))
    assert rel["sections"][0]["id"] == "duyet"
    with pytest.raises(ToolError):
        mcp_server.read_guide(ctx, section="khong-co-muc-nay")
    with pytest.raises(ToolError):
        mcp_server.read_guide(type("C", (), {"headers": {}})())
