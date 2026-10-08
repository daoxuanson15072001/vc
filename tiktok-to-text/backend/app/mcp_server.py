"""Cổng MCP (Model Context Protocol) — cho AI (Claude Desktop / Claude Code / agent khác) dùng dữ liệu của app.

Địa chỉ: http://localhost:8000/mcp (Streamable HTTP). Xác thực: `Authorization: Bearer <token>`,
token tạo ở trang "Kết nối AI" hoặc `python scripts/create_token.py`. AI hành động với đúng quyền
của người sở hữu token — mọi tool gọi lại hàm API sẵn có nên phân quyền theo kho được giữ nguyên.
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta
from typing import Literal

from bson import ObjectId
from fastapi import HTTPException
from mcp.server.mcpserver import Context, MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.streamable_http_manager import StreamableHTTPASGIApp
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import StrictInt, ValidationError
from starlette.types import Receive, Scope, Send

from . import auth, db, devreq, org, policy, spaces
from .config import mcp_allowed_hosts
from . import spec as spec_mod
from . import guide as guide_mod
from . import categories as cat_mod
from .kb import routes as kb
from .kb import tags as tag_mod
from .kb.pipeline import cards
from .kb.wiki import AI_CARD_TYPES

READ = ToolAnnotations(readOnlyHint=True)
WRITE = ToolAnnotations(readOnlyHint=False, destructiveHint=False)
DESTRUCTIVE = ToolAnnotations(readOnlyHint=False, destructiveHint=True)

mcp = MCPServer(
    name="vc-content-engine",
    title="VC Content Engine",
    instructions=(
        "Dữ liệu nội bộ VC Phồn Vinh gồm hai tầng. Kho tư liệu = tầng thô: nguồn đã nạp (link, video, file) và "
        "văn bản đã chuyển thành chữ, chưa phân tích. VCWIKI = tầng tinh: thẻ tri thức đã phân tích, chắt lọc từ "
        "Kho tư liệu. Việc tinh chế: list_documents (mặc định là hàng chờ chưa vào VCWIKI) → get_document đọc "
        "văn bản → create_card kèm document_id để thẻ dẫn về tài liệu gốc (tài liệu tự chuyển sang 'đã vào VCWIKI'); "
        "tài liệu không có gì đáng giữ thì mark_document. Tìm tri thức bằng search_cards / search_videos trước, "
        "rồi get_* để đọc chi tiết. Tìm kiếm không phân biệt dấu. Tag dùng chung một bộ từ vựng cho video, tài "
        "liệu và thẻ: gắn tag ở tài liệu / video (tag_document, tag_video) thì thẻ dẫn về nó nhận theo, thẻ tạo từ "
        "tài liệu thừa kế tag của tài liệu; xem list_tags để dùng lại tag có sẵn. Thẻ AI tạo ở trạng thái "
        "draft cho tới khi người có quyền duyệt. Bộ nhớ dài hạn của bạn (AI) cũng nằm trong VCWIKI: đầu phiên gọi "
        "recall_memory để nạp skill / ghi nhớ / bối cảnh đã lưu; khi học được cách làm hay, điều người dùng muốn "
        "hoặc bối cảnh đáng nhớ thì gọi save_memory (cùng key sẽ cập nhật, không tạo trùng). Kiến thức / quy tắc người dùng giao có thể "
        "chưa khớp hệ thống: trước khi áp vào dữ liệu, gọi get_system_spec (hiện trạng từ code) và read_ba (ý đồ "
        "nghiệp vụ) để đối chiếu, báo chỗ lệch thay vì ghi thử. Gán lĩnh vực chỉ nhận slug "
        "có trong cây (list_categories); cây lĩnh vực không cố định trong code — thiếu nhánh thì tự thêm bằng create_category, \
sửa / ẩn bằng update_category, xoá nhánh (kèm nhánh con; còn dữ liệu thì chuyển sang nhánh khác bằng move_to) bằng delete_category. update_card đổi "
        "được loại thẻ (type) và thêm trường tự do qua fields; lệnh ghi thẻ trả kết quả gọn, cần cả thẻ thì full=true. "
        "Kênh yêu cầu phát triển (quản trị viên): Claude Desktop gửi yêu cầu tính năng bằng submit_request, theo dõi "
        "bằng list_requests / get_request, trả lời câu hỏi bằng reply_request; Claude Code nhận bằng claim_request, "
        "làm trên code, báo tiến độ / hỏi lại / báo cáo kết quả bằng update_request."
    ),
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user(ctx: Context) -> dict:
    header = (ctx.headers or {}).get("authorization", "")
    user = auth.user_from_api_token(header.removeprefix("Bearer ").strip())
    if not user:
        raise ToolError("Token không hợp lệ hoặc đã bị thu hồi")
    return user


def _call(fn, *args, **kwargs):
    """Gọi hàm API, chuyển HTTPException / lỗi kiểm tra model thành lỗi tool cho AI đọc được."""
    try:
        return fn(*args, **kwargs)
    except HTTPException as e:
        raise ToolError(str(e.detail)) from None
    except ValidationError as e:
        raise ToolError(_validation_msg(e)) from None


def _validation_msg(e: ValidationError) -> str:
    """Lỗi pydantic -> "Trường title: tối đa 200 ký tự; …" (SDK MCP giấu lỗi lạ thành thông báo trống)."""
    parts = []
    for err in e.errors():
        field = ".".join(str(x) for x in err.get("loc", ())) or "?"
        ctx = err.get("ctx") or {}
        kind = err.get("type")
        if kind == "string_too_long":
            msg = f"tối đa {ctx.get('max_length')} ký tự"
        elif kind == "string_too_short":
            n = ctx.get("min_length")
            msg = "không được rỗng" if n == 1 else f"tối thiểu {n} ký tự"
        elif kind == "int_type":
            msg = "phải là số nguyên"
        elif kind == "too_long":
            msg = f"tối đa {ctx.get('max_length')} mục"
        else:
            msg = err.get("msg", "không hợp lệ")
        parts.append(f"Trường {field}: {msg}")
    return "; ".join(parts) or "Dữ liệu không hợp lệ"


def _model(cls, **kwargs):
    """Dựng model nội bộ (CategoryIn, CardIn…) — sai thì ToolError nêu tên trường và giới hạn."""
    return _call(cls, **kwargs)


def _refiner(ctx: Context, user: dict, ai_model: str | None) -> dict:
    """Ghi AI nào tinh chế: tên ứng dụng (đoán theo User-Agent, không rõ thì lấy tên token) + model AI tự khai."""
    h = ctx.headers or {}
    ua = h.get("user-agent", "").lower()
    tok = auth.api_tokens.find_one(
        {"_id": auth._token_hash(h.get("authorization", "").removeprefix("Bearer ").strip())}, {"name": 1}) or {}
    app = ("Claude Code" if "claude-code" in ua or "claude-cli" in ua
           else "Claude Desktop" if "mcp-remote" in ua or "claude" in ua
           else tok.get("name") or "AI qua MCP")
    return db.refiner("mcp", app, (ai_model or "").strip()[:60] or None, user["_id"]) | {"token": tok.get("name")}


def _dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, default=str)


def _main():
    from . import main  # main.py import module này -> import muộn tránh vòng
    return main


# ---------------------------------------------------------------------------
# Chung
# ---------------------------------------------------------------------------

@mcp.tool(annotations=READ)
def whoami(ctx: Context) -> str:
    """Người dùng mà token này đại diện."""
    return _dump(auth.public_user(_user(ctx)))


@mcp.tool(annotations=READ)
def get_system_spec(ctx: Context, topic: spec_mod.Topic | None = None) -> str:
    """Hệ thống ĐANG hỗ trợ gì, đọc thẳng từ code: loại / trạng thái / trường của thẻ, giới hạn cây lĩnh vực, \
phân quyền (kèm quyền của chính bạn), tổ chức, học tập, danh sách tool MCP. topic: cards · categories · \
permissions · org · learning · mcp (bỏ trống = tất cả). Gọi TRƯỚC khi áp một quy tắc / phân loại / quy trình người \
dùng đưa vào dữ liệu: chỗ nào hệ thống chưa có (loại thẻ, trường, số cấp cây, trạng thái…) thì báo lệch cho người \
dùng và đề xuất cách tạm (tag, fields) — đừng ghi thử rồi để app bỏ lặng."""
    user = _user(ctx)
    res = spec_mod.system_spec(topic)
    if topic in (None, "permissions"):
        res.setdefault("permissions", {})["you"] = {
            "role": user.get("role"),
            "grants": [{"role": g["role"], "scope": g.get("scope")} for g in org.active_grants(user)],
            "spaces": [{"id": s["id"], "name": s["name"], "role": s.get("my_role")} for s in spaces.list_spaces(user)],
        }
    return _dump(res)


@mcp.tool(annotations=READ)
def read_ba(ctx: Context, section: str | None = None, query: str | None = None, offset: int = 0,
            max_chars: int = 20000) -> str:
    """Đọc tài liệu phân tích nghiệp vụ docs/BA.md — ý đồ, luồng, yêu cầu (mã WK-, ORG-, GOV-, LRN-…) kèm trạng \
thái triển khai. Không truyền gì: mục lục. section: số mục ("4.3", "15", "15.6") hoặc chữ trong tiêu đề ("Phụ lục \
A") -> nội dung mục đó gồm mục con. query: tìm dòng chứa từ khoá (không phân biệt dấu). BA có thể mô tả phần chưa \
làm — hiện trạng thật xem get_system_spec (cũng là Phụ lục A của BA)."""
    _user(ctx)
    query, section = (query or "").strip(), (section or "").strip()   # chỉ có khoảng trắng = không truyền
    if query:
        return _dump({"matches": spec_mod.ba_search(query)})
    if not section:
        return _dump({"toc": [f"{'  ' * (h['level'] - 2)}{h['title']}" for h in spec_mod.ba_toc() if h["level"] <= 3]})
    text = spec_mod.ba_section(section)
    if text is None:
        raise ToolError(f"Không có mục '{section}' — gọi read_ba không tham số để xem mục lục")
    part = text[max(offset, 0):max(offset, 0) + min(max(max_chars, 1000), 60000)]
    return _dump({"section": section, "total_chars": len(text), "offset": offset, "text": part,
                  "more": offset + len(part) < len(text)})


@mcp.tool(annotations=READ)
def read_guide(ctx: Context, section: str | None = None, query: str | None = None, path: str | None = None) -> str:
    """Đọc Hướng dẫn sử dụng của app (trang /guide — cách dùng từng màn hình, tên nút / tab đúng như giao diện, câu \
hỏi thường gặp). Dùng để trả lời "làm thế nào để…", "nút này ở đâu", "sao tôi không thấy…". Không truyền gì: mục lục \
(id + tiêu đề). section: id mục (vd "tim-doc") hoặc chữ trong tiêu đề -> nội dung markdown của mục. query: tìm dòng \
chứa từ khoá (không phân biệt dấu). path: đường dẫn trang người dùng đang mở (vd "/wiki?card=…") -> các mục liên \
quan. Hướng dẫn là nội dung cho người dùng; hiện trạng kỹ thuật xem get_system_spec, ý đồ nghiệp vụ xem read_ba."""
    _user(ctx)
    query, section, path = (query or "").strip(), (section or "").strip(), (path or "").strip()
    if query:
        return _dump({"matches": guide_mod.search(query)})
    if path:
        return _dump({"path": path, "sections": guide_mod.for_path(path)})
    if not section:
        return _dump({"toc": guide_mod.toc(), "note": "Neo trong app: /guide#<id>"})
    s = guide_mod.section(section)
    if s is None:
        raise ToolError(f"Không có mục '{section}' — gọi read_guide không tham số để xem mục lục")
    return _dump({"id": s["id"], "title": s["title"], "anchor": f"/guide#{s['id']}", "links": s["links"],
                  "text": s["body"]})


@mcp.tool(annotations=READ)
def list_spaces(ctx: Context) -> str:
    """Các kho (space) bạn xem được (kho cá nhân, kho chia sẻ, kho công khai) kèm quyền của bạn."""
    return _dump(spaces.list_spaces(_user(ctx)))


@mcp.tool(annotations=READ)
def list_categories(ctx: Context, root: str | None = None, with_scope_note: bool = False) -> str:
    """Cây lĩnh vực tối đa 4 cấp (Mảng → Chuyên ngành → Chuyên môn → Đầu việc): slug, mã hiển thị (code, vd \
1.3.2), tên, mô tả, cấp, người chủ nhánh, số thẻ. Dùng slug để lọc / gán thẻ. root: chỉ lấy một nhánh (slug, gồm \
nhánh con). with_scope_note=true: kèm scope note 4 dòng (Gồm / Không gồm / Dễ nhầm với / Ví dụ thẻ) — đọc trước \
khi xếp thẻ vào nhánh. Nhánh có liên kết tra cứu (vd web tra mã phụ tùng) thì kèm links [{label, url, note}]."""
    rows = cat_mod.tree(False, _user(ctx))
    if root:
        rows = [c for c in rows if c["slug"] == root or c["slug"].startswith(root + ".")]
    keep = ("slug", "code", "name", "description", "level", "owner_name", "card_count") + \
        (("scope_note",) if with_scope_note else ())
    return _dump([{k: c[k] for k in keep} | ({"links": c["links"]} if c["links"] else {}) for c in rows])


@mcp.tool(annotations=WRITE)
def create_category(ctx: Context, name: str, description: str = "", parent_slug: str | None = None,
                    slug: str | None = None, code: str | None = None, scope_note: str = "",
                    links: list[dict] | None = None) -> str:
    """Thêm một nhánh (node) vào cây lĩnh vực (mọi người dùng). parent_slug: slug nhánh cha (bỏ trống = \
nhánh gốc); cây tối đa 4 cấp. slug: đặt tay, phải nối sau slug cha (vd cha "mkt.digital" -> "mkt.digital.seo"); \
bỏ trống thì sinh từ tên không dấu. code: mã hiển thị (vd "1.3.2"). scope_note: 4 dòng Gồm / Không gồm / Dễ nhầm \
với / Ví dụ thẻ. links: liên kết tra cứu [{"label": tên ≤ 80, "url": "https://…", "note": ghi chú ≤ 200}] (tối đa \
20) — trang VCWIKI lọc nhánh này hiện thành nút mở tab mới (vd web tra mã phụ tùng các hãng VCPV phân phối). Dùng \
đúng slug trả về để gán cho thẻ. Tên đã có dưới cùng nhánh cha thì trả về nhánh cũ (links không ghi — sửa bằng \
update_category)."""
    user = _user(ctx)
    _call(cat_mod.require_edit, user)
    name = _call(cat_mod.check_name, name)
    parent = None
    if parent_slug:
        parent = cat_mod.categories.find_one({"slug": parent_slug.strip()})
        if not parent:
            raise ToolError(f"Không có nhánh cha '{parent_slug}' — xem list_categories")
        _call(cat_mod.check_parent_active, parent)
    same = cat_mod.categories.find_one({"parent_id": parent["_id"] if parent else None,
                                        "name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}})
    if same:
        if not same.get("active", True):
            cat_mod.set_active(same, True)
        return _dump({"slug": same["slug"], "name": same["name"], "level": same["level"], "created": False})
    body = _model(cat_mod.CategoryIn, name=name, description=description, slug=slug, code=code,
                  scope_note=scope_note, parent_id=str(parent["_id"]) if parent else None, links=links or [])
    res = _call(cat_mod.create, body, user)
    return _dump({"slug": res["slug"], "name": name, "level": res["level"], "created": True})


@mcp.tool(annotations=WRITE)
def update_category(ctx: Context, slug: str, name: str | None = None, description: str | None = None,
                    code: str | None = None, scope_note: str | None = None, owner_email: str | None = None,
                    active: bool | None = None, order: int | None = None, new_slug: str | None = None,
                    links: list[dict] | None = None) -> str:
    """Sửa một nhánh cây lĩnh vực (mọi người dùng): tên (đổi tên thì slug đổi theo — sinh từ tên mới, hoặc đặt tay \
bằng new_slug dạng <slug cha>.<ten-khong-dau>; nhánh con, thẻ, tài liệu… đang gắn slug cũ chuyển theo, slug cũ vẫn \
tra ra nhánh này), mô tả, mã hiển thị, scope note 4 dòng, thứ tự trong nhánh cha (order), active=false để ẩn (ẩn cả nhánh con; thẻ cũ giữ \
nguyên), active=true để hiện lại. owner_email: người chủ nhánh (duyệt thẻ trong nhánh; chuỗi rỗng = gỡ) — chỉ \
quản trị viên. links: liên kết tra cứu [{"label": tên ≤ 80, "url": "https://…", "note": ghi chú ≤ 200}] (tối đa 20; \
url phải http(s)) — thay cả danh sách, [] = xoá hết; trang VCWIKI lọc nhánh này (và nhánh con) hiện thành nút mở \
tab mới, dùng cho web tra mã phụ tùng các hãng VCPV phân phối (các web này chặn nhúng khung). Chỉ trường truyền \
vào bị thay."""
    user = _user(ctx)
    c = cat_mod.categories.find_one({"slug": cat_mod.resolve_slug(slug.strip())})
    if not c:
        raise ToolError(f"Không có nhánh '{slug}' — xem list_categories")
    owner_id = None
    if owner_email is not None:
        owner_id = ""
        if owner_email.strip():
            u = auth.users.find_one({"email": owner_email.strip().lower()}, {"_id": 1})
            if not u:
                raise ToolError(f"Không có người dùng {owner_email}")
            owner_id = str(u["_id"])
    patch = _model(cat_mod.CategoryPatch, name=name, description=description, code=code, scope_note=scope_note,
                   owner_id=owner_id, active=active, order=order, slug=new_slug, links=links)
    res = _call(cat_mod.update, str(c["_id"]), patch, user)
    row = next(x for x in cat_mod.tree(True, user) if x["slug"] == res["slug"])
    return _dump({k: row[k] for k in ("slug", "code", "name", "description", "scope_note", "owner_name", "level",
                                      "order", "active", "links")})


@mcp.tool(annotations=DESTRUCTIVE)
def delete_category(ctx: Context, slug: str, move_to: str | None = None) -> str:
    """Xoá hẳn một nhánh cây lĩnh vực cùng mọi nhánh con (mọi cấp, kể cả cấp 1; mọi người dùng). Cả nhánh rỗng thì \
xoá luôn. Còn thẻ / tài liệu / nguồn / lộ trình học gắn slug trong nhánh thì phải truyền move_to = slug nhánh nhận \
dữ liệu (đang hiện, ngoài nhánh bị xoá) — dữ liệu chuyển sang đó rồi mới xoá; không truyền thì báo lỗi kèm số lượng. \
Còn phạm vi quyền / chức năng tổ chức gắn nhánh thì không xoá được — gỡ ở trang quản trị trước. Muốn giữ lại thì \
ẩn bằng update_category(active=false)."""
    user = _user(ctx)
    c = cat_mod.categories.find_one({"slug": slug.strip()})
    if not c:
        raise ToolError(f"Không có nhánh '{slug}' — xem list_categories")
    out = _call(cat_mod.delete, str(c["_id"]), move_to, user)
    return _dump({"slug": c["slug"], "name": c["name"], "deleted": True, "deleted_slugs": out["deleted"],
                  "moved_to": out["moved_to"], "moved": out["moved"]})


# ---------------------------------------------------------------------------
# VCWIKI — thẻ tri thức
# ---------------------------------------------------------------------------

CardType = Literal["framework", "concept", "case_study", "regulation", "insight", "hook", "lesson",
                   "sop", "checklist", "template", "kpi"]
CardStatus = Literal["draft", "approved", "rejected"]


BRIEF = ("id", "type", "title", "status", "categories", "level", "division", "process_steps", "tags", "fields",
         "updated_at")


def _brief(card: dict) -> dict:
    """Kết quả ghi thẻ ở dạng gọn (~100 token thay vì cả thẻ ~2.000)."""
    return {k: card.get(k) for k in BRIEF}


@mcp.tool(annotations=READ)
def search_cards(ctx: Context, query: str = "", space_id: str | None = None, type: str | None = None,
                 status: str | None = None, category: str | None = None, tag: str | None = None,
                 level: str | None = None, division: str | None = None, process_step: str | None = None,
                 page: int = 1, page_size: int = 20, include_ai_memory: bool = False) -> str:
    """Tìm thẻ VCWIKI theo từ khoá (tiêu đề, tóm tắt, nội dung, tag — xếp theo độ khớp) và theo nghĩa (khi máy chủ \
có AI local embedding: thẻ cùng ý dù khác chữ; mỗi thẻ kèm match = text / semantic / both, semantic_score, \
text_score, rerank_score = độ liên quan 0–1 do reranker chấm lại các thẻ đầu, thẻ đầu bảng đã xếp theo điểm này; \
reranked=false: lượt này không rerank được — reranker tắt / bận / lỗi, giữ thứ tự gộp). Thẻ bộ nhớ AI (skill / \
memory / context) không nằm trong kết quả tìm có query — đọc bằng recall_memory, hoặc lọc type=context / \
include_ai_memory=true. type / status / level / division / \
process_step: nhiều giá trị cách nhau dấu phẩy. status: draft/approved/rejected. category: slug lĩnh vực (gồm cả \
nhánh con). level: dieu-hanh / thiet-ke / van-hanh / thuc-thi / nhap-mon. division: vcpart / vcsoft / vcobd / \
vcservice / vce / vcmedia / tap-doan (tap-doan gồm cả thẻ cũ chưa gán). process_step: vd qt.ban-hang-b2b.c."""
    res = _call(kb.list_cards, space_id, query, type, status, tag, None, category, level, division, process_step,
                max(page, 1), min(max(page_size, 1), 100), _user(ctx), include_ai_memory)
    keep = ("id", "type", "title", "summary", "categories", "level", "division", "process_steps", "tags", "status",
            "space_name", "updated_at")
    # hybrid: khớp chữ / nghĩa / cả hai; chỉ chữ (AI local tắt): điểm chữ
    extra = ("match", "semantic_score", "text_score", "rerank_score", "reranked") if res.get("semantic") else (
        ("text_score", "rerank_score", "reranked") if query.strip() else ())
    return _dump({"total": res["total"], "items": [{k: c.get(k) for k in keep + extra} for c in res["items"]]})


@mcp.tool(annotations=READ)
def get_card(ctx: Context, card_id: str) -> str:
    """Toàn bộ nội dung một thẻ VCWIKI (body, ý chính, khi nào dùng, ví dụ, trích dẫn nguồn)."""
    return _dump(_call(kb.get_card, card_id, _user(ctx)))


@mcp.tool(annotations=WRITE)
def create_card(ctx: Context, type: CardType, title: str, summary: str = "", body: str = "",
                key_points: list[str] | None = None, when_to_use: str = "", example: str = "",
                evidence: str = "", categories: list[str] | None = None, tags: list[str] | None = None,
                fields: dict[str, str] | None = None, level: str | None = None, division: list[str] | None = None,
                process_steps: list[str] | None = None, effective_at: str | None = None,
                review_cycle_months: StrictInt | None = None, space_id: str | None = None, document_id: str | None = None,
                ai_model: str | None = None, full: bool = False) -> str:
    """Tạo thẻ VCWIKI mới (trạng thái draft). body dùng markdown. document_id: tài liệu trong Kho tư liệu mà \
thẻ được tinh chế từ đó — luôn truyền khi phân tích từ tài liệu, để thẻ dẫn về nguồn gốc và tài liệu được đánh \
dấu đã vào VCWIKI (tài liệu nhận bằng claim_documents: chỉ xong khi gọi mark_document done). Không ghi space_id thì vào cùng kho với tài liệu (nếu bạn được sửa), không thì kho cá nhân. ai_model: tên model của bạn (vd "Claude Opus 5.5") — ghi vào cột "AI tinh chế". fields: trường tự thêm \
{tên trường: giá trị}, vd {"Hiệu lực": "01/07/2026"}. Mặc định trả kết quả gọn (id, loại, trạng thái, lĩnh vực…); \
full=true để nhận cả thẻ. categories: 1 slug chính (sâu nhất có thể, tối đa cấp 4) đứng đầu + ≤ 2 phụ. \
type sop / checklist / template / kpi: quy trình từng bước / danh sách kiểm tra / mẫu biểu / định nghĩa chỉ số. \
level: cấp độ người đọc — dieu-hanh / thiet-ke / van-hanh / thuc-thi / nhap-mon. division: đơn vị áp dụng (nhiều \
giá trị) — vcpart / vcsoft / vcobd / vcservice / vce / vcmedia / tap-doan (mặc định). process_steps: 0–2 bước quy \
trình dạng qt.<chuỗi>.<a|b|c|d>, vd qt.ban-hang-b2b.c. effective_at: ngày hiệu lực YYYY-MM-DD; review_cycle_months: \
chu kỳ rà soát (tháng). Giá trị sai hoặc slug lĩnh vực chưa có trong cây -> lỗi nêu rõ trường sai, thẻ không được ghi."""
    user = _user(ctx)
    claimed = bool(document_id) and bool(ObjectId.is_valid(document_id)) and kb.documents.count_documents(
        {"_id": ObjectId(document_id), "wiki_status": "processing", "claimed_by": user["_id"]})
    card = _model(kb.CardIn, space_id=space_id, document_id=document_id, type=type, title=title, summary=summary,
                  body=body, key_points=key_points or [], when_to_use=when_to_use, example=example,
                  evidence=evidence, categories=categories or [], tags=tags or [], fields=fields or {}, level=level,
                  division=division or [], process_steps=process_steps or [], effective_at=effective_at,
                  review_cycle_months=review_cycle_months)
    res = _call(kb.create_card, card, user)
    by = _refiner(ctx, user, ai_model)
    cards.update_one({"_id": ObjectId(res["id"])}, {"$set": {"origin": "mcp", "refined_by": by}})
    if claimed:   # đang làm dở: giữ việc (gia hạn), chưa vào VCWIKI — hết quota giữa chừng không bị tính là xong
        kb.documents.update_one({"_id": ObjectId(document_id)}, {"$set": {
            "wiki_status": "processing", "claimed_by": user["_id"], "claimed_at": db.now(), "refined_by": by}})
    elif document_id:
        kb.documents.update_one({"_id": ObjectId(document_id)}, {"$set": {"refined_by": by}})
    by = {"refined_by": {k: by[k] for k in ("label", "model")}}
    return _dump((res if full else _brief(res)) | by | _gov_submit(res["id"], user))


@mcp.tool(annotations=WRITE)
def update_card(ctx: Context, card_id: str, type: CardType | None = None, title: str | None = None,
                summary: str | None = None, body: str | None = None, key_points: list[str] | None = None,
                when_to_use: str | None = None, example: str | None = None, evidence: str | None = None,
                categories: list[str] | None = None, tags: list[str] | None = None,
                fields: dict[str, str | None] | None = None, level: str | None = None,
                division: list[str] | None = None, process_steps: list[str] | None = None,
                effective_at: str | None = None, review_cycle_months: StrictInt | None = None,
                status: CardStatus | None = None, full: bool = False) -> str:
    """Sửa thẻ, đổi loại thẻ (type) hoặc đổi trạng thái duyệt. Chỉ trường nào truyền vào mới bị thay. Cần quyền \
sửa kho. fields: thêm / sửa trường tự thêm {tên trường: giá trị}; giá trị rỗng hoặc null thì xoá trường đó, \
trường không nhắc tới giữ nguyên. Mặc định trả kết quả gọn; full=true để nhận cả thẻ. level / effective_at = \
chuỗi rỗng, review_cycle_months = 0, division = [] (về tap-doan): gỡ giá trị. Thẻ đã duyệt (approved) không sửa \
trực tiếp: phần sửa thành ĐỀ XUẤT chờ người duyệt (kết quả có change_request + notice; thẻ giữ nguyên tới khi \
duyệt). status=approved trên thẻ nháp chỉ gửi thẻ vào hộp duyệt — AI không duyệt thẻ."""
    user = _user(ctx)
    merged = None
    if fields is not None:
        card, _ = _call(kb.load, kb.cards, card_id, user, "card.read", "thẻ")
        merged = {k: v for k, v in ((card.get("fields") or {}) | fields).items() if v}
    patch = _model(kb.CardPatch, type=type, title=title, summary=summary, body=body, key_points=key_points,
                   when_to_use=when_to_use, example=example, evidence=evidence, categories=categories,
                   tags=tags, fields=merged, level=level, division=division, process_steps=process_steps,
                   effective_at=effective_at, review_cycle_months=review_cycle_months, status=status)
    res = _call(kb.update_card_as, card_id, patch, user, "mcp")   # GOV: thẻ đã duyệt -> đề xuất sửa (BA 16.7)
    return _dump((res if full else _brief(res)) | _gov_result(res))


# ---------------------------------------------------------------------------
# Bộ nhớ AI — skill / ghi nhớ / bối cảnh AI tự ghi vào VCWIKI
# ---------------------------------------------------------------------------

MemoryKind = Literal["skill", "memory", "context"]


def _memory_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", db.unaccent(text)).strip("-")[:80]


@mcp.tool(annotations=WRITE)
def save_memory(ctx: Context, kind: MemoryKind, title: str, body: str, summary: str | None = None,
                when_to_use: str | None = None, key: str | None = None, tags: list[str] | None = None,
                categories: list[str] | None = None, space_id: str | None = None) -> str:
    """Ghi skill / ghi nhớ / bối cảnh của bạn (AI) vào VCWIKI để các phiên sau đọc lại bằng recall_memory. \
kind: skill = cách làm một việc (body là các bước, when_to_use là lúc nên dùng); memory = sở thích, quyết định, \
phản hồi của người dùng; context = bối cảnh dự án / tổ chức / thuật ngữ. key: định danh ổn định (mặc định lấy \
từ title) — ghi lại cùng kind + key trong cùng kho thì CẬP NHẬT thẻ cũ thay vì tạo trùng; khi cập nhật, summary / \
when_to_use / tags / categories không truyền thì giữ nguyên. body dùng markdown, mỗi thẻ một chủ đề. Không ghi space_id thì vào kho cá nhân."""
    user = _user(ctx)
    space = _call(policy.load_space, space_id, user, "card.write") if space_id else spaces.personal_space(user)
    mkey = _memory_key(key or title)
    if not mkey:
        raise ToolError("key / title phải có chữ hoặc số")
    old = cards.find_one({"space_id": space["_id"], "type": kind, "memory_key": mkey}, {"_id": 1})
    if old:   # chỉ ghi đè trường được truyền (summary / when_to_use bỏ trống thì giữ như tags / categories)
        patch = _model(kb.CardPatch, title=title, summary=summary, body=body, when_to_use=when_to_use,
                       tags=tags, categories=categories)
        return _dump(_call(kb.patch_card, str(old["_id"]), patch, user) | {"action": "updated"})
    card = _model(kb.CardIn, space_id=str(space["_id"]), type=kind, title=title, summary=summary or "", body=body,
                  when_to_use=when_to_use or "", categories=categories or [], tags=tags or [])
    res = _call(kb.create_card, card, user)
    cards.update_one({"_id": ObjectId(res["id"])}, {"$set": {"memory_key": mkey, "origin": "mcp"}})
    return _dump(res | {"memory_key": mkey, "origin": "mcp", "action": "created"})


@mcp.tool(annotations=READ)
def recall_memory(ctx: Context, query: str = "", kind: MemoryKind | None = None, space_id: str | None = None,
                  full: bool = True, limit: int = 30) -> str:
    """Đọc lại skill / ghi nhớ / bối cảnh AI đã ghi (mới cập nhật trước, bỏ thẻ bị loại). Nên gọi đầu phiên \
làm việc. query: từ khoá (không phân biệt dấu). full=false chỉ lấy tiêu đề + tóm tắt để lướt nhanh."""
    user = _user(ctx)
    f = _call(kb.space_scope, space_id, user) | {"type": kind or {"$in": list(AI_CARD_TYPES)},
                                                 "status": {"$ne": "rejected"}}
    if query.strip():
        f["search_text"] = db.search_regex(query)
    rows = list(cards.find(f).sort("updated_at", -1).limit(min(max(limit, 1), 100)))
    keep = ("id", "type", "memory_key", "title", "summary", "when_to_use", "tags", "status", "space_name",
            "updated_at") + (("body",) if full else ())
    return _dump({"total": cards.count_documents(f),
                  "items": [{k: c.get(k) for k in keep} for c in kb.cards_out(rows, user)]})


@mcp.tool(annotations=DESTRUCTIVE)
def forget_memory(ctx: Context, card_id: str) -> str:
    """Xoá hẳn một thẻ skill / ghi nhớ / bối cảnh AI đã lỗi thời hoặc sai. Chỉ xoá được thẻ loại AI."""
    user = _user(ctx)
    card = _call(kb.get_card, card_id, user)
    if card["type"] not in AI_CARD_TYPES:
        raise ToolError("Chỉ xoá được thẻ skill / memory / context — thẻ tri thức thường thì sửa bằng update_card")
    _call(kb.delete_card, card_id, user)
    return _dump({"deleted": card_id, "title": card["title"]})


# ---------------------------------------------------------------------------
# Kho tư liệu — nguồn & tài liệu thô (đã chuyển chữ, chờ tinh chế vào VCWIKI)
# ---------------------------------------------------------------------------

@mcp.tool(annotations=READ)
def list_sources(ctx: Context, query: str = "", space_id: str | None = None, status: str | None = None,
                 category: str | None = None, page: int = 1, page_size: int = 20) -> str:
    """Nguồn đã nạp (link web, video, file). overall: queued/extracting/building/done/error... note: ghi chú của \
người nạp (điều họ thích / vì sao lưu) — gợi ý phân loại, không phải nội dung nguồn."""
    res = _call(kb.list_sources, space_id, None, query or None, category, status,
                max(page, 1), min(max(page_size, 1), 100), _user(ctx))
    keep = ("id", "kind", "title", "url", "overall", "docs", "card_count", "space_name", "created_at", "error",
            "priority", "queue_position", "eta", "note")
    return _dump({"total": res["total"], "items": [{k: s.get(k) for k in keep} for s in res["items"]]})


@mcp.tool(annotations=READ)
def get_source(ctx: Context, source_id: str) -> str:
    """Chi tiết một nguồn và danh sách tài liệu đã trích xuất (dùng get_document để đọc văn bản). note: ghi chú \
của người nạp; notes: ghi chép của người dùng trên cả nguồn (doc_id rỗng) và từng tài liệu (doc_id, t = giây trong \
video), documents[].note_count — dùng làm gợi ý chọn lĩnh vực / ý cần nhấn mạnh, không chép vào thẻ như sự thật."""
    return _dump(_call(kb.get_source, source_id, _user(ctx)))


@mcp.tool(annotations=WRITE)
def prioritize_source(ctx: Context, source_id: str, top: bool = True) -> str:
    """Ưu tiên xử lý trước một nguồn: đưa lên đầu hàng chờ của làn (video / ghi âm dùng chung làn Whisper), \
tài liệu chờ dựng thẻ cũng được làm trước. Việc đang chạy không bị ngắt. top=False: về mức thường."""
    return _dump(_call(kb.prioritize_source, source_id, kb.PriorityIn(top=top), _user(ctx)))


@mcp.tool(annotations=READ)
def get_document(ctx: Context, document_id: str, offset: int = 0, max_chars: int = 30000) -> str:
    """Văn bản đã trích xuất của một tài liệu. Tài liệu dài: đọc tiếp bằng offset."""
    user = _user(ctx)
    doc = _call(kb.get_document, document_id, user=user)
    # đang đọc tài liệu mình đã nhận -> gia hạn nhận việc, tài liệu dài không bị trả về hàng chờ giữa chừng
    kb.documents.update_one({"_id": ObjectId(document_id), "wiki_status": "processing", "claimed_by": user["_id"]},
                            {"$set": {"claimed_at": db.now()}})
    text = doc.pop("text", "")
    offset = max(offset, 0)
    part = text[offset:offset + min(max(max_chars, 1000), 100_000)]
    doc |= {"text": part, "offset": offset, "total_chars": len(text),
            "next_offset": offset + len(part) if offset + len(part) < len(text) else None}
    return _dump(doc)


@mcp.tool(annotations=READ)
def list_documents(ctx: Context, status: str = "skipped,pending,error", query: str = "", space_id: str | None = None,
                   source_id: str | None = None, tag: str | None = None, page: int = 1, page_size: int = 20) -> str:
    """Tài liệu trong Kho tư liệu (văn bản đã chuyển chữ), cũ trước. Mặc định là hàng chờ tinh chế — chưa vào \
VCWIKI: skipped = chỉ chuyển chữ, pending = chờ AI tự dựng, error = AI dựng lỗi. status=done: đã vào VCWIKI. \
paused = người dùng đã ngừng tinh chế — KHÔNG tinh chế tài liệu này cho tới khi họ bấm chạy tiếp. Nhiều trạng thái cách nhau dấu phẩy (status="" = mọi trạng thái). query: tìm trong tiêu đề. tag: tài liệu \
mang tag hoặc có thẻ VCWIKI mang tag đó. Đọc văn bản bằng get_document."""
    user = _user(ctx)
    f = _call(kb.space_scope, space_id, user)
    if status.strip():
        f["wiki_status"] = {"$in": [x.strip() for x in status.split(",") if x.strip()]}
    if source_id:
        f["source_id"] = _call(kb.oid, source_id, "nguồn")
    if query.strip():
        f["title"] = {"$regex": re.escape(query.strip()), "$options": "i"}
    if tag and tag.strip():
        f = {"$and": [f, tag_mod.document_filter(tag)]}
    size = min(max(page_size, 1), 100)
    keep = {"title": 1, "url": 1, "source_id": 1, "space_id": 1, "chars": 1, "wiki_status": 1, "card_count": 1,
            "summary": 1, "categories": 1, "tags": 1, "created_at": 1}
    rows = list(kb.documents.find(f, keep).sort("created_at", 1).skip((max(page, 1) - 1) * size).limit(size))
    return _dump({"total": kb.documents.count_documents(f), "items": [kb.out(r) for r in rows]})


@mcp.tool(annotations=READ)
def search_documents(ctx: Context, query: str, status: str = "", space_id: str | None = None, limit: int = 10) -> str:
    """Tìm trong NỘI DUNG tài liệu Kho tư liệu (tầng thô: bản chép lời video, bài viết, file) — theo nghĩa và theo \
từ khoá cùng lúc, rồi reranker chấm lại; tìm được cả tài liệu chưa tinh chế vào VCWIKI, cùng ý dù khác chữ. Mỗi \
tài liệu kèm rerank_score (độ liên quan 0–1; null nếu máy chủ không rerank được — reranked=false) và passages: đoạn khớp (start = vị \
trí ký tự, đọc tiếp quanh đó bằng get_document offset=start; time = giây trong video / ghi âm của mốc [mm:ss] gần \
nhất, null nếu văn bản không có mốc). status: lọc trạng thái như list_documents \
("" = mọi trạng thái; "skipped,pending,error" = chưa vào VCWIKI). Nên search_cards trước — thẻ đã tinh chế đáng tin \
hơn. Tài liệu mới nạp được đưa vào tìm theo nghĩa trong đêm. available=false: máy chủ chưa bật cơ sở dữ liệu vector \
hoặc AI local — dùng list_documents (tìm theo tiêu đề)."""
    return _dump(_call(kb.semantic_documents, space_id, query, status, min(max(limit, 1), 50), _user(ctx)))


@mcp.tool(annotations=WRITE)
def mark_document(ctx: Context, document_id: str, status: Literal["done", "skipped", "pending"] = "done",
                  summary: str | None = None, ai_model: str | None = None) -> str:
    """Đánh dấu tài liệu đã tinh chế xong (done — kể cả khi không có gì đáng tạo thẻ), trả về hàng chờ \
(skipped), hoặc trả lại hàng chờ AI (pending — nhả tài liệu đã nhận bằng claim_documents mà không làm được). \
summary: tóm tắt ngắn tài liệu. create_card có document_id đã tự đánh dấu done, không cần gọi thêm. ai_model: tên model của bạn (vd "Claude Opus 5.5") — ghi vào cột "AI tinh chế"."""
    user = _user(ctx)
    doc, _ = _call(kb.load, kb.documents, document_id, user, "editor", "tài liệu")
    if status == "done":
        kb.mark_document_refined(doc["_id"], summary, by=_refiner(ctx, user, ai_model))
    else:
        kb.documents.update_one({"_id": doc["_id"]}, {"$set": {"wiki_status": status, "claimed_by": None}})
    return _dump({"id": document_id, "wiki_status": status})


CLAIM_TTL_MIN = 20   # tài liệu AI ngoài nhận mà 20 phút không đọc / tạo thẻ -> tự trả lại hàng chờ
CLAIM_MAX = 2        # mỗi người giữ tối đa 2 tài liệu: AI hết quota giữa chừng thì ít việc dở dang


PARTIAL_HOLD_H = 6   # tài liệu làm dở (đã có thẻ) để dành cho Claude làm tiếp ~ một chu kỳ quota, rồi máy chủ mới lấy


def release_claims(f: dict) -> int:
    """Trả tài liệu đã nhận về hàng chờ. Tài liệu đã có thẻ (làm dở) thì máy chủ chờ PARTIAL_HOLD_H giờ
    (wiki_retry_at) — claim_documents vẫn giao nó trước cho Claude làm tiếp, không tạo thẻ trùng."""
    now = db.now()
    n = 0
    for d in kb.documents.find({"wiki_status": "processing", "claimed_by": {"$ne": None}} | f, {"_id": 1}):
        partial = cards.count_documents({"document_id": d["_id"]}) > 0
        upd = {"wiki_status": "pending", "claimed_by": None, "partial": partial}
        if partial:
            upd["wiki_retry_at"] = now + timedelta(hours=PARTIAL_HOLD_H)
        n += kb.documents.update_one({"_id": d["_id"], "wiki_status": "processing"}, {"$set": upd}).modified_count
    return n


def _claim_out(doc: dict) -> dict:
    """Tài liệu đã nhận + thẻ đã tạo từ nó (làm dở lượt trước) để làm tiếp, không tạo trùng."""
    made = list(cards.find({"document_id": doc["_id"]}, {"title": 1, "type": 1}))
    src = kb.sources.find_one({"_id": doc.get("source_id")}, {"note": 1}) or {}
    from .kb import notes as notes_mod
    notes = [{"scope": "document" if n.get("doc_id") else "source", "text": n["text"], "t": n.get("t"),
              "created_at": n["created_at"]} for n in notes_mod.for_prompt(doc.get("source_id"), [doc["_id"]])]
    return kb.out(doc) | {"cards_done": [{"id": str(c["_id"]), "type": c["type"], "title": c["title"]} for c in made],
                          "source_note": src.get("note") or "", "notes": notes}


@mcp.tool(annotations=WRITE)
def claim_documents(ctx: Context, limit: int = 1, space_id: str | None = None) -> str:
    """Nhận việc từ hàng "Chờ AI" (pending) để bạn tự tinh chế — MỖI LẦN MỘT TÀI LIỆU: làm xong hẳn (mark_document \
done) rồi mới nhận tiếp, để nếu bạn hết quota thì không bỏ dở nhiều tài liệu. Tài liệu chuyển sang processing nên \
máy chủ và phiên khác không làm trùng. Đang giữ tài liệu chưa xong thì trả lại chính các tài liệu đó (không nhận \
thêm) — cards_done là thẻ đã tạo lượt trước: làm tiếp phần còn thiếu, không tạo lại. Quy trình: get_document đọc \
hết → create_card kèm document_id (từng thẻ) → mark_document status="done" (BẮT BUỘC, tài liệu chỉ vào VCWIKI \
khi gọi bước này). Không làm được: mark_document status="pending". 20 phút không đọc / tạo thẻ thì tài liệu tự về \
hàng chờ. Sắp hết lượt / hết quota: dừng nhận việc mới. source_note: "Ghi chú của người nạp" trên nguồn (điều họ \
thích / vì sao lưu / cần chú ý); notes: ghi chép của người dùng trên cả nguồn (scope=source) và trên chính tài liệu \
(scope=document, t = giây trong video nếu có), mới nhất trước — cùng là gợi ý chọn lĩnh vực và ý cần nhấn mạnh, \
KHÔNG chép vào thẻ, không coi là sự thật."""
    user = _user(ctx)
    now = db.now()
    release_claims({"claimed_at": {"$lt": now - timedelta(minutes=CLAIM_TTL_MIN)}})
    if space_id:
        ids = [_call(policy.load_space, space_id, user, "document.write")["_id"]]
    else:
        ids = policy.editable_space_ids(user)
    keep = {"title": 1, "url": 1, "source_id": 1, "space_id": 1, "chars": 1, "tags": 1}
    # tài liệu còn chờ dịch (kb/ai_slot.py) chưa giao: dựng thẻ khi đã có bản tiếng Việt
    left = lambda: kb.documents.count_documents({"wiki_status": "pending", "translate_pending": {"$ne": True},  # noqa: E731
                                                 "space_id": {"$in": ids}})
    held = list(kb.documents.find({"wiki_status": "processing", "claimed_by": user["_id"]}, keep))
    if held:
        kb.documents.update_many({"_id": {"$in": [d["_id"] for d in held]}}, {"$set": {"claimed_at": now}})
        return _dump({"claimed": [_claim_out(d) for d in held], "pending_left": left(),
                      "note": "Bạn còn tài liệu chưa xong — làm xong (mark_document done) rồi mới nhận tiếp."})
    got = []
    for _ in range(min(max(limit, 1), CLAIM_MAX)):
        doc = kb.documents.find_one_and_update(
            {"wiki_status": "pending", "translate_pending": {"$ne": True}, "space_id": {"$in": ids}},
            {"$set": {"wiki_status": "processing", "claimed_by": user["_id"], "claimed_at": now, "wiki_error": None,
                      "partial": False}},
            sort=[("partial", -1), ("priority", -1), ("created_at", 1)], projection=keep)   # làm dở trước
        if not doc:
            break
        got.append(_claim_out(doc))
    return _dump({"claimed": got, "pending_left": left()})


@mcp.prompt(name="tinh_che_hang_cho", title="Tinh chế hàng Chờ AI",
            description="Tinh chế lần lượt từng tài liệu trong hàng Chờ AI thành thẻ VCWIKI (chạy song song với máy chủ).")
def tinh_che_hang_cho(so_tai_lieu: str = "5") -> str:
    return (
        f"Bạn là biên tập viên VCWIKI. Tinh chế tối đa {so_tai_lieu} tài liệu từ hàng Chờ AI, MỖI LẦN MỘT TÀI LIỆU. "
        "Đầu phiên gọi list_categories. Lặp: claim_documents(limit=1) (claimed rỗng thì dừng) → get_document đọc hết "
        "(theo next_offset) → search_cards chống trùng → create_card từng thẻ, luôn kèm document_id và ai_model (tên "
        "model của bạn) — mỗi thẻ một ý, chỉ ghi điều có trong tài liệu, evidence trích nguyên văn ngắn, categories "
        "dùng slug có trong cây, 2–8 thẻ / tài liệu; nếu có cards_done thì chỉ làm phần còn thiếu → mark_document "
        "status=done kèm summary và ai_model (BẮT BUỘC, xong tài liệu này mới nhận tài liệu sau). Không có gì đáng "
        "giữ: mark_document done kèm summary lý do. Không làm được: mark_document status=pending. Thấy sắp hết lượt "
        "dùng thì dừng sau tài liệu đang làm. Cuối cùng báo bảng: tài liệu → số thẻ, và pending_left."
    )


@mcp.tool(annotations=READ)
def list_tags(ctx: Context, query: str = "", space_id: str | None = None, limit: int = 100) -> str:
    """Tag đang dùng trên thẻ VCWIKI và tài liệu, kèm số lượng, nhiều trước. Xem trước khi gắn tag để dùng lại \
tag có sẵn thay vì đặt tag mới gần nghĩa. Tag chuẩn: chữ thường không dấu nối gạch ngang (vd `dong-tien`)."""
    user = _user(ctx)
    return _dump(tag_mod.vocabulary(_call(kb.space_scope, space_id, user), query, min(max(limit, 1), 500)))


@mcp.tool(annotations=WRITE)
def tag_document(ctx: Context, document_id: str, add: list[str] | None = None,
                 remove: list[str] | None = None) -> str:
    """Gắn / gỡ tag trên một tài liệu (đơn vị nhỏ nhất của Kho tư liệu, vd một video đã chuyển chữ). Tag lan \
sang mọi thẻ VCWIKI dẫn về tài liệu; tài liệu từ video thì đồng bộ luôn với video trong Kho video. Chỉ thêm / \
bớt đúng tag nêu ra, tag khác giữ nguyên. Tag tự chuẩn hoá (không dấu, gạch ngang) — xem list_tags trước."""
    doc, _ = _call(kb.load, kb.documents, document_id, _user(ctx), "editor", "tài liệu")
    tags = tag_mod.set_document_tags(doc, tag_mod.edit(doc.get("tags"), add, remove))
    return _dump({"id": document_id, "tags": tags})


@mcp.tool(annotations=WRITE)
def add_links(ctx: Context, urls: list[str], space_id: str | None = None, categories: list[str] | None = None,
              tags: list[str] | None = None, note: str = "", video_limit: int = 0,
              build_wiki: bool | None = None) -> str:
    """Nạp link vào Kho tư liệu: bài viết, video / kênh / playlist mạng xã hội, Google Docs / Sheets / Slides / \
file Drive (chia sẻ công khai), link file PDF / ảnh / Office / ghi âm. Nội dung được chuyển thành chữ rồi dựng \
thẻ VCWIKI. video_limit: số video tối đa khi link là kênh / playlist (0 = tất cả). build_wiki: bỏ trống = video \
mạng xã hội chỉ chuyển chữ, loại khác dựng thẻ; false = chỉ chuyển chữ. note: ghi chú của người nạp (≤ 2000 ký \
tự: điều thích, vì sao lưu, cần chú ý) — AI dựng thẻ dùng làm gợi ý phân loại / nhấn mạnh."""
    try:
        body = kb.LinksIn(space_id=space_id, urls=urls, categories=categories or [], tags=tags or [], note=note,
                          options=kb.SourceOptions(limit=min(max(video_limit, 0), 5000), build_wiki=build_wiki))
    except ValueError as e:
        raise ToolError(str(e)) from None
    return _dump(_call(kb.add_links, body, _user(ctx)))


# ---------------------------------------------------------------------------
# TikTok → Text — kho video & lượt quét
# ---------------------------------------------------------------------------

VideoSort = Literal["posted_at", "views", "likes", "comments", "shares", "duration", "updated_at"]


@mcp.tool(annotations=READ)
def search_videos(ctx: Context, query: str = "", channel: str | None = None, tag: str | None = None,
                  status: str | None = None, date_from: date | None = None, date_to: date | None = None,
                  sort: VideoSort = "posted_at", order: Literal["asc", "desc"] = "desc",
                  page: int = 1, page_size: int = 20) -> str:
    """Tìm video đã chuyển chữ theo lời nói / caption / ghi chú. channel: handle kênh (không @). \
status: ok/no_speech/error. Kết quả có đoạn đầu transcript; đọc đủ bằng get_video."""
    _user(ctx)
    res = _call(_main().list_videos, query or None, channel, status, tag, date_from, date_to, sort, order,
                max(page, 1), min(max(page_size, 1), 100))
    return _dump(res)


@mcp.tool(annotations=READ)
def get_video(ctx: Context, video_id: str, with_segments: bool = False) -> str:
    """Toàn bộ transcript và số liệu của một video. with_segments=true để lấy mốc thời gian từng câu."""
    _user(ctx)
    v = _call(_main().get_video, video_id)
    if not with_segments:
        v.pop("segments", None)
    return _dump(v)


@mcp.tool(annotations=WRITE)
def tag_video(ctx: Context, video_id: str, add: list[str] | None = None, remove: list[str] | None = None) -> str:
    """Gắn / gỡ tag trên một video trong Kho video (id từ search_videos). Đồng bộ sang tài liệu chuyển chữ của \
video và thẻ VCWIKI dẫn về nó — như tag_document. Chỉ thêm / bớt đúng tag nêu ra."""
    _user(ctx)
    video = _call(_main().get_video_or_404, video_id)
    tags = tag_mod.set_video_tags(video, tag_mod.edit(video.get("tags"), add, remove))
    db.videos.update_one({"_id": video["_id"]}, {"$set": {"tags": tags, "updated_at": db.now()}})
    return _dump({"id": video_id, "tags": tags})


@mcp.tool(annotations=READ)
def list_channels(ctx: Context) -> str:
    """Các kênh đã quét: số video, lượt xem, lượt thích, trung bình view, lần đăng gần nhất."""
    _user(ctx)
    return _dump(_main().channels())


@mcp.tool(annotations=READ)
def stats(ctx: Context) -> str:
    """Tổng quan: số video, số giờ đã chuyển chữ, số kênh, số nguồn / thẻ, video top view, nguồn nạp gần đây."""
    return _dump(_main().stats(_user(ctx)))


@mcp.tool(annotations=WRITE)
def start_scan(ctx: Context, targets: list[str], limit: int = 20, language: str = "auto",
               space_id: str | None = None) -> str:
    """Quét kênh (@handle hoặc link) / link video TikTok, YouTube…: tải về, chuyển lời nói thành chữ, lưu vào \
Kho tư liệu (chỉ chuyển chữ, không dựng thẻ). language: "auto" (mặc định) giữ tiếng gốc, video tiếng nước ngoài \
có thêm bản dịch tiếng Việt; "vi" / "en" / "zh" ép một ngôn ngữ. limit: số video mới nhất mỗi kênh (0 = tất cả). Kênh đã nạp \
thì quét lại để lấy video mới. Theo dõi bằng get_scan với id nguồn trả về."""
    try:
        body = kb.LinksIn(space_id=space_id, urls=targets,
                          options=kb.SourceOptions(limit=min(max(limit, 0), 5000), language=language, build_wiki=False))
    except ValueError as e:
        raise ToolError(str(e)) from None
    return _dump(_call(kb.add_links, body, _user(ctx)))


@mcp.tool(annotations=READ)
def get_scan(ctx: Context, source_id: str) -> str:
    """Tiến độ quét / chuyển chữ một nguồn (trạng thái, số video đã xử lý / lỗi, 20 dòng nhật ký cuối)."""
    src = _call(kb.get_source, source_id, _user(ctx))
    keep = ("id", "kind", "url", "title", "status", "overall", "progress", "docs", "error", "created_at")
    return _dump({k: src.get(k) for k in keep} | {"logs": (src.get("logs") or [])[-20:]})


# ---------------------------------------------------------------------------
# Kênh yêu cầu phát triển: Claude Desktop gửi → Claude Code nhận, làm, báo cáo (devreq.py)
# ---------------------------------------------------------------------------

def _via(ctx: Context, user: dict) -> str:
    return _refiner(ctx, user, None)["label"]


@mcp.tool(annotations=WRITE)
def submit_request(ctx: Context, title: str, description: str, acceptance: list[str] | None = None,
                   priority: devreq.Priority = "normal", spec_ref: str | None = None) -> str:
    """Gửi yêu cầu phát triển (tính năng mới / sửa lỗi) cho Claude Code làm trên code của app này. description: \
bối cảnh, vì sao cần, hành vi mong muốn — viết đủ để người không dự cuộc trò chuyện hiểu. acceptance: tiêu chí \
nghiệm thu, mỗi dòng một điều kiểm tra được. spec_ref: mã mục BA liên quan nếu có (vd "LRN-03"). Đối chiếu \
get_system_spec / read_ba trước để không yêu cầu thứ đã có. Theo dõi bằng list_requests / get_request."""
    user = _user(ctx)
    return _dump(_call(devreq.submit, user, _via(ctx, user), title, description, acceptance, priority, spec_ref))


@mcp.tool(annotations=READ)
def list_requests(ctx: Context, status: str = "open", mine: bool = False, limit: int = 20) -> str:
    """Danh sách yêu cầu phát triển, mới cập nhật trước. status: open (= new, in_progress, needs_info) | new | \
in_progress | needs_info | done | rejected | cancelled, nhiều giá trị cách dấu phẩy, "" = tất cả. mine=true: chỉ \
yêu cầu bạn gửi. needs_info = Claude Code đang chờ trả lời (reply_request)."""
    return _dump(_call(devreq.list_requests, _user(ctx), status, mine, limit))


@mcp.tool(annotations=READ)
def get_request(ctx: Context, request_id: str) -> str:
    """Chi tiết yêu cầu: mô tả, tiêu chí nghiệm thu, nhánh / commit, báo cáo kết quả và nhật ký hỏi–đáp."""
    return _dump(_call(devreq.get, _user(ctx), request_id))


@mcp.tool(annotations=WRITE)
def claim_request(ctx: Context) -> str:
    """(Claude Code) Nhận MỘT yêu cầu để làm — làm dở / ưu tiên cao / cũ trước. Đang giữ yêu cầu chưa xong thì \
trả lại chính nó. request=null: hàng chờ trống. Mỗi lần update_request gia hạn giữ việc; quá 3 giờ không cập nhật \
thì yêu cầu tự về hàng chờ."""
    user = _user(ctx)
    return _dump(_call(devreq.claim, user, _via(ctx, user)))


@mcp.tool(annotations=WRITE)
def update_request(ctx: Context, request_id: str, status: Literal["in_progress", "needs_info", "done", "rejected"]
                   | None = None, note: str = "", branch: str | None = None, commits: list[str] | None = None,
                   report: dict | None = None) -> str:
    """(Claude Code) Ghi tiến độ yêu cầu đang giữ. note: ghi chú tiến độ; với status=needs_info thì note là câu \
hỏi cho người gửi (yêu cầu nhả ra, chờ reply_request). Kết thúc bằng status=done hoặc rejected kèm report = \
{summary, changes, tests, verify, followups}: summary = đã làm gì / vì sao từ chối, changes = file / chức năng đổi, \
tests = lệnh test và kết quả, verify = cách người dùng tự kiểm tra, followups = việc còn lại. branch / commits: \
nhánh git và mã commit."""
    user = _user(ctx)
    return _dump(_call(devreq.update, user, _via(ctx, user), request_id, status, note, branch, commits, report))


@mcp.tool(annotations=WRITE)
def reply_request(ctx: Context, request_id: str, text: str = "", cancel: bool = False) -> str:
    """(Người gửi) Trả lời câu hỏi của Claude Code (yêu cầu needs_info quay lại hàng chờ, được làm trước), bổ \
sung ý cho yêu cầu, hoặc mở lại yêu cầu đã đóng bằng ý mới. cancel=true: huỷ yêu cầu chưa đóng."""
    user = _user(ctx)
    return _dump(_call(devreq.reply, user, _via(ctx, user), request_id, text, cancel))


# --- GOV --- (luồng F / M: tool đề xuất thay đổi, thay update_card trên thẻ đã duyệt — BA 16.7)
from .kb import changes as gov   # noqa: E402


def _gov_result(res: dict) -> dict:
    """Phần đề xuất trong kết quả ghi thẻ (update_card / create_card)."""
    ch = res.get("change")
    if not ch:
        return {}
    return {"change_request": {k: ch.get(k) for k in ("id", "kind", "status", "step", "min_approvers",
                                                       "step2_label", "summary", "change_kind")},
            "notice": res.get("notice")}


def _gov_submit(card_id: str, user: dict) -> dict:
    """create_card: thẻ AI viết qua MCP vào hộp duyệt, cổng so sánh chạy nền (BA 16.7)."""
    card = cards.find_one({"_id": ObjectId(card_id)})
    if not card or not gov.governed(card):
        return {}
    ch = gov.submit_draft(card, user, "mcp")
    return {"change_request": {"id": str(ch["_id"]), "kind": "create", "status": ch["status"]},
            "notice": "Thẻ nháp đã vào hộp duyệt; cổng so sánh đang chạy nền"}


def _change_brief(o: dict) -> dict:
    keep = ("id", "kind", "kind_label", "status", "summary", "change_kind", "step", "min_approvers", "step2_label",
            "due_at", "overdue", "created_by_name", "can_decide", "returned", "can_resubmit")
    nov = o.get("novelty") or {}
    return {k: o.get(k) for k in keep} | {
        "card": {k: (o.get("card") or {}).get(k) for k in ("id", "title", "status", "level")},
        "novelty": {k: nov.get(k) for k in ("verdict", "reason", "engine")} if nov else None}


@mcp.tool(annotations=READ)
def list_review_queue(ctx: Context, limit: int = 20) -> str:
    """Hộp duyệt của tôi: đề xuất thay đổi thẻ VCWIKI đang chờ tôi duyệt ở bước hiện tại, hạn gần trước. Mỗi mục \
có kết quả cổng so sánh (new / duplicate / supplement / conflict / noise). Đọc chi tiết + diff bằng \
review_change(change_id, decision="view")."""
    user = _user(ctx)
    rows = gov.inbox(user, min(max(limit, 1), 100))
    return _dump({"total": len(rows), "items": [_change_brief(gov.change_out(ch, user, card=c)) for ch, c in rows]})


@mcp.tool(annotations=WRITE)
def review_change(ctx: Context, change_id: str,
                  decision: Literal["view", "approve", "reject", "comment", "return"] = "view",
                  comment: str = "", change_kind: Literal["minor", "major"] | None = None) -> str:
    """Xem / nhận xét / trả về / từ chối một đề xuất thay đổi thẻ. decision=view: nội dung trước / sau, diff, kết quả \
cổng so sánh. comment: ghi nhận xét (đề xuất vẫn mở). return: trả đề xuất về người đề xuất sửa (bắt buộc comment = \
lý do; đề xuất vẫn mở, rời hộp duyệt tới khi người đề xuất gửi lại — GOV-13). reject bắt buộc comment (lý do). KHÔNG \
duyệt được qua MCP (SYS-12 — người duyệt cuối là người trên web): decision=approve báo lỗi kèm đường dẫn \
/wiki/review?change=<id> để người dùng tự mở và bấm Duyệt. change_kind: mức thay đổi (minor / major) — chỉ người \
duyệt sửa trên web."""
    user = _user(ctx)
    ch = _call(gov.load_change, change_id, user, channel="mcp")
    if decision == "approve":
        # SYS-12: AI ngoài không duyệt cuối, kể cả thay mặt chủ token — người bấm Duyệt trên web
        raise ToolError(f"Không duyệt được qua MCP (SYS-12) — mở /wiki/review?change={ch['_id']} trên web để "
                        "người duyệt tự xem và bấm Duyệt. Qua MCP chỉ xem (view), nhận xét (comment) hoặc từ chối "
                        "(reject, cần lý do), trả về người đề xuất sửa (return, cần lý do).")
    if decision != "view":
        ch = _call(gov.decide, ch, user, decision, comment, None, channel="mcp")
    o = gov.change_out(ch, user, full=True)
    keep = ("before", "after", "diff", "approvals", "related_cards", "step2_names")
    return _dump(_change_brief(o) | {k: o.get(k) for k in keep})


@mcp.tool(annotations=WRITE)
def propose_card_change(ctx: Context, card_id: str = "", kind: Literal["update", "classify", "obsolete", "rollback"] = "update",
                        summary: str = "", changes: dict | None = None, change_kind: Literal["minor", "major"] | None = None,
                        rev: int | None = None, replaced_by: str | None = None,
                        resubmit_change_id: str | None = None, note: str = "") -> str:
    """Tạo đề xuất thay đổi cho thẻ ĐÃ DUYỆT (thẻ nháp thì sửa thẳng bằng update_card). kind: update (changes = \
các trường như update_card: title, summary, body, key_points, categories, level…), classify (đổi lĩnh vực / mức \
mật), obsolete (summary = lý do, replaced_by = thẻ thay thế), rollback (rev = phiên bản muốn quay về, summary = lý \
do). summary: tóm tắt / lý do đề xuất — ghi vào lịch sử phiên bản khi duyệt. change_kind: minor (chữ, tag, phân \
loại) / major (kết luận, số liệu, bước) — bỏ trống thì hệ thống đoán. resubmit_change_id: SỬA VÀ GỬI LẠI đề xuất \
của chính bạn đang bị người duyệt trả về (GOV-13; xem lý do ở review_change view → returned.note) — changes (nếu \
có) ghi đè từng trường lên nội dung đề xuất cũ, summary (nếu có) thay tóm tắt, note = lời nhắn cho người duyệt; card_id / \
kind bỏ qua. Thẻ nháp bị trả về: sửa bằng update_card rồi gọi với resubmit_change_id (không kèm changes)."""
    user = _user(ctx)
    if resubmit_change_id:
        ch = _call(gov.load_change, resubmit_change_id, user, channel="mcp")
        ch = _call(gov.resubmit, ch, user, changes, summary or None, note)
        return _dump(_change_brief(gov.change_out(ch, user)))
    body = gov.ChangeIn(kind=kind, card_id=card_id, summary=summary, change_kind=change_kind, rev=rev,
                        replaced_by=replaced_by, changes=changes)
    ch = _call(gov.create_from_api, body, user, "mcp")
    return _dump(_change_brief(gov.change_out(ch, user)))
# --- /GOV ---

# --- LRN --- (luồng M: tool học tập — BA LRN-13)
# LRN · H — AI học tập: chỉ tạo NHÁP (lộ trình, câu hỏi); phát hành / giao / duyệt làm trên web

_DESIGN_FIELDS = {"level": "level (cấp bậc người học)", "month": "month (tháng)", "year": "year (năm)",
                  "hours_per_week": "hours_per_week (giờ học mỗi tuần)", "pass_score": "pass_score (điểm đạt %)",
                  "branches": "branches (nhánh bắt buộc)", "goal": "goal (mục tiêu)", "prompt": "prompt",
                  "assessment": "assessment (cách đánh giá)", "title": "title (tên lộ trình)",
                  "learners": "learner_emails (người học)", "period": "period (kỳ)"}


def _design_error(e: ValidationError) -> str:
    """Lỗi kiểm tra form design_path -> câu tiếng Việt nêu trường + giới hạn (QA vòng 2, L13)."""
    parts = []
    for err in e.errors():
        loc = [str(x) for x in err.get("loc", ())]
        name = _DESIGN_FIELDS.get(loc[-1] if loc else "", loc[-1] if loc else "?")
        ctx, kind = err.get("ctx") or {}, err.get("type")
        if kind in ("less_than_equal", "greater_than_equal"):
            lo = {"level": 1, "month": 1, "year": 2000}.get(loc[-1] if loc else "", 0)
            hi = ctx.get("le")
            msg = (f"phải từ {lo} đến {hi}" if kind == "less_than_equal" and hi is not None
                   else f"tối thiểu {ctx.get('ge')}")
        elif kind in ("too_long", "string_too_long"):
            msg = f"tối đa {ctx.get('max_length')} {'mục' if kind == 'too_long' else 'ký tự'}"
        elif kind == "literal_error":
            msg = "chỉ nhận " + str(ctx.get("expected")).replace(" or ", " hoặc ")
        elif kind in ("int_type", "int_parsing", "float_parsing"):
            msg = "phải là số"
        else:
            msg = "không hợp lệ"
        parts.append(f"{name}: {msg}")
    return "Form thiết kế lộ trình sai — " + "; ".join(parts or ["dữ liệu không hợp lệ"])


@mcp.tool(annotations=WRITE)
def design_path(ctx: Context, prompt: str = "", level: int | None = None, area: str | None = None,
                division: str | None = None, goal: str = "", period: Literal["month", "year"] = "month",
                year: int | None = None, month: int | None = None, hours_per_week: float | None = None,
                branches: list[str] | None = None, assessment: str = "", pass_score: int | None = None,
                content_levels: list[str] | None = None, include_unleveled: bool = False,
                learner_emails: list[str] | None = None, title: str | None = None) -> str:
    """Thiết kế lộ trình học NHÁP (BA 17.5) từ thẻ VCWIKI đã duyệt — không phát hành, không giao. Form 6 ô: \
level (cấp bậc người học 1–7) + area (mảng: slug gốc cây lĩnh vực) + division; goal (mục tiêu đo được); period \
month / year; hours_per_week; branches (1–3 slug lĩnh vực hoặc chuỗi quy trình qt.<chuỗi>); assessment + pass_score. \
content_levels: bậc nội dung chọn tay (ghi đè bảng ánh xạ cấp bậc). learner_emails: người học trong cây dưới quyền \
bạn (chỉ dùng thẻ mọi người học xem được). Kết quả: tuần → bài → thẻ (card_id + rev), gaps (thiếu tri thức theo \
nhánh + bậc), url bản nháp để người thiết kế sửa + lưu trên web /learn/design."""
    from .learn import designer
    user = _user(ctx)
    ids = []
    for email in learner_emails or []:
        u = auth.users.find_one({"email": email.strip().lower()}, {"_id": 1})
        if not u:
            raise ToolError(f"Không có người dùng {email}")
        ids.append(str(u["_id"]))
    try:
        form = designer.DesignForm(level=level, area=area, division=division, goal=goal, period=period, year=year,
                                   month=month, hours_per_week=hours_per_week, branches=branches or [],
                                   assessment=assessment, pass_score=pass_score, content_levels=content_levels or [],
                                   include_unleveled=include_unleveled)
        body = designer.DesignIn(prompt=prompt, learners=ids, form=form, title=title)
    except ValidationError as e:
        raise ToolError(_design_error(e)) from None
    out = _call(designer.design, user, body, "mcp")
    return _dump(out | {"url": f"/learn/design?id={out['id']}"})


@mcp.tool(annotations=WRITE)
def generate_questions(ctx: Context, card_id: str, n: int = 2) -> str:
    """AI sinh n (1–6) câu hỏi NHÁP cho một thẻ đã duyệt, loại câu theo loại thẻ (BA 17.6: sop / checklist → nhiều \
đáp án, kpi / regulation → một đáp án, template / case_study / lesson / insight → tự luận có rubric…), gắn card_id + \
phiên bản. Câu ở trạng thái draft — người soạn duyệt ở ngân hàng câu hỏi (/learn/library?tab=questions)."""
    from .learn import designer
    user = _user(ctx)
    return _dump(_call(designer.generate_for_card, user, card_id, max(1, min(6, n)), "mcp"))


# LRN · I — lộ trình, giao bài, thi, chấm: chỉ đọc việc được giao. AI ngoài không làm bài thi, không chốt điểm.
def my_assignments_for(user: dict) -> dict:
    from .learn import paths as learn_paths
    return learn_paths.my_assignments(user)


@mcp.tool(annotations=READ)
def my_assignments(ctx: Context) -> str:
    """Lộ trình học được giao cho tôi, gộp theo tháng: bài học (đã học / chưa), hạn (due_state: ok / soon — còn ≤ 3 ngày / overdue / done), bài thi (số câu, thời gian, lượt đã dùng, kết quả sau khi người chấm chốt). Chỉ đọc — làm bài thi và chốt điểm chỉ trên web."""
    return _dump(_call(my_assignments_for, _user(ctx)))


# LRN-15 — khoá học theo cây chủ đề (TK-15b): chỉ đọc. Bài C3 không gửi AI ngoài (ORG-12) — bỏ khỏi danh sách.
def list_courses_for(user: dict) -> dict:
    from .learn import course_api
    return course_api.list_courses(user)


def get_course_for(user: dict, slug: str) -> dict:
    from .learn import course_api
    out = course_api.get_course(slug, user)
    out["lessons"] = [x for x in out["lessons"] if x.get("classification") != "C3"]
    return out


@mcp.tool(annotations=READ)
def list_courses(ctx: Context) -> str:
    """Cây khoá học: mỗi nút của cây lĩnh vực (list_categories) là một khoá. Trả số bài tôi xem được gắn thẳng vào từng nút (lesson_count — không cộng nút con) và nút nào có thi khoá (has_exam); người soạn thấy thêm số bài của mình chưa xếp khoá (unassigned)."""
    return _dump(_call(list_courses_for, _user(ctx)))


@mcp.tool(annotations=READ)
def get_course(ctx: Context, slug: str) -> str:
    """Một khoá học (slug nút cây): bài theo thứ tự (no = 1, 2, 3… trên các bài tôi xem được), bài nào có kiểm tra sau bài (has_quiz), kết quả kiểm tra của tôi (my_result), cài đặt thi khoá và điểm đạt bài. Không kèm đáp án. Sắp thứ tự / đặt thi khoá chỉ trên web."""
    return _dump(_call(get_course_for, _user(ctx), slug))
# --- /LRN ---


# ---------------------------------------------------------------------------
# Gắn vào FastAPI
# ---------------------------------------------------------------------------

def _allowed_hosts() -> TransportSecuritySettings:
    """Chống DNS rebinding. Mở ra ngoài (tunnel / tên miền) thì thêm host vào MCP_ALLOWED_HOSTS."""
    extra = mcp_allowed_hosts()
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=["127.0.0.1:*", "localhost:*", "[::1]:*", *extra],
        allowed_origins=["http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*",
                         *(f"https://{h}" for h in extra)],
    )


# stateless: mỗi request độc lập, restart máy chủ không làm client dính "Session not found"
mcp.streamable_http_app(transport_security=_allowed_hosts(), stateless_http=True)   # tạo session manager
_transport = StreamableHTTPASGIApp(mcp.session_manager)


class _MCPEndpoint:
    """ASGI app cho /mcp: chặn sớm request không có token hợp lệ (401) trước khi vào phiên MCP."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        from fastapi.concurrency import run_in_threadpool

        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        token = headers.get("authorization", "").removeprefix("Bearer ").strip()
        if not await run_in_threadpool(auth.user_from_api_token, token):
            body = b'{"error":"invalid_token","error_description":"Thieu hoac sai token. Tao token o trang Ket noi AI."}'
            await send({"type": "http.response.start", "status": 401, "headers": [
                (b"content-type", b"application/json"), (b"www-authenticate", b'Bearer error="invalid_token"')]})
            await send({"type": "http.response.body", "body": body})
            return
        await _transport(scope, receive, send)


mcp_endpoint = _MCPEndpoint()
