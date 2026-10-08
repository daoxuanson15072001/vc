"""Điểm quyết định quyền duy nhất (ORG-10 — docs/BA.md mục 15.6, 15.7).

Mọi câu hỏi "ai được làm gì với cái gì" — từ web, cổng MCP, chat, graph, AI nội bộ — đều hỏi module này.
Ba nhóm hàm (hợp đồng chốt ở đợt 0; đổi chữ ký phải qua người điều phối):

- `can(user, action, resource)` / `require(...)` — kiểm tra từng hành động.
- `visible_filter(user, kind, channel)` — điều kiện MongoDB cho mọi truy vấn danh sách / tìm kiếm.
- `subordinates`, `assignable_learners`, `result_viewers` — câu hỏi theo cây quản lý (học tập).
- `step2_reviewers(card, change)` — người duyệt bước 2 của đề xuất thay đổi thẻ (GOV, BA 16.4).
- `can_read_via_assignment(user, lesson)`, `via_assignment_filter(user)` — đọc bài học qua lộ trình được giao
  (vấn đề mở 33, BA LRN-05).
- `learn_flags(user)` — cờ hiện menu Học tập (`can_design`, `can_grade`).
- `space_role(user, space)` — vai trò hiệu lực trong kho: cao nhất giữa mời riêng (`members`), cấp theo đơn vị
  (`unit_grants`, SYS-35) và kho công khai; `can_share_space_units` — ai cấp quyền kho theo đơn vị.
- `learn_author_status(user)` — giải thích vì sao (không) soạn được bài học (chỉ hiển thị, không cấp quyền).

Đợt 0: luật tri thức **giữ nguyên hành vi hiện tại** (quyền theo kho, spaces.py). Luồng B chuyển các chỗ kiểm tra
rải rác sang đây; luồng G thêm mức mật C0–C3; luồng F thay luật duyệt. Luật học tập dùng cây quản lý (org.py).

Quy ước lỗi: không xem được → 404 "không tìm thấy" (không lộ sự tồn tại); xem được mà thiếu quyền → 403.

Hướng phụ thuộc: `spaces.py` giữ dữ liệu kho (collection, tạo kho cá nhân, API kho); module này đọc dữ liệu đó và là
nơi DUY NHẤT diễn giải vai trò trong kho (`ROLE_RANK`, vai trò suy từ `members` / `unit_grants` / `visibility`).
`tests/test_policy_single_point.py` chặn module khác tự so vai trò.

ORG-13: vai trò hệ thống `admin` chỉ dùng cho quản trị (`org.manage`, `audit.read`, người dùng, cây lĩnh vực) —
không có ngoại lệ nào cho quyền đọc nội dung (kho, thẻ, nguồn, tài liệu, cuộc trò chuyện của người khác).
"""

from __future__ import annotations

from typing import Literal

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException

from . import db, org
from . import categories as cat_mod
from .auth import users
from .spaces import spaces

Channel = Literal["web", "mcp", "chat", "ai_internal"]
Classification = Literal["C0", "C1", "C2", "C3"]
CLASSIFICATIONS: tuple[str, ...] = Classification.__args__

# Hành động trên dữ liệu nằm trong kho -> quyền kho tối thiểu (hành vi hiện tại)
SPACE_ACTIONS: dict[str, str] = {
    "space.read": "viewer", "space.write": "editor", "space.manage": "owner",
    "source.read": "viewer", "source.write": "editor",
    "document.read": "viewer", "document.write": "editor",
    "card.read": "viewer", "card.write": "editor",
    "card.propose": "viewer",          # GOV: ai xem được thẻ thì đề xuất được (luồng F dùng)
    "card.review": "editor",           # đợt 0 như hiện tại: sửa được kho thì duyệt được — luồng F thay
    "card.approve_final": "editor",    # bước 2 loại dual — luồng F thay bằng category_owner
    "card.rollback": "editor",         # luồng F thay bằng category_owner
    "card.classify": "editor",         # luồng G thay bằng luật mức mật
    # Ghi chép theo nguồn / từng tài liệu (WK-45): ai xem được nguồn thì đọc và thêm ghi chép; sửa / xoá ghi chép của
    # người khác chỉ chủ kho (người quản lý kho). Sửa / xoá của chính mình: hành động `note.edit` bên dưới.
    "note.read": "viewer", "note.create": "viewer", "note.moderate": "owner",
}

# Thứ bậc vai trò trong kho: owner (quản lý thành viên) > editor (nạp nguồn, sửa / duyệt thẻ) > viewer (chỉ xem)
ROLE_RANK = {"viewer": 1, "editor": 2, "owner": 3}

# Tên vai trò cũ (code gọi `need="editor"`...) -> hành động tương ứng trên kho
ROLE_ACTIONS: dict[str, str] = {"viewer": "space.read", "editor": "space.write", "owner": "space.manage"}

# Câu báo 403 khi xem được kho nhưng thiếu quyền — theo vai trò tối thiểu của hành động (giữ nguyên câu cũ)
SPACE_DENIED: dict[str, str] = {"editor": "Bạn chỉ có quyền xem kho này", "owner": "Chỉ chủ kho được thực hiện"}

Action = Literal[
    "space.read", "space.write", "space.manage",
    "source.read", "source.write", "document.read", "document.write",
    "card.read", "card.write", "card.propose", "card.review", "card.approve_final", "card.rollback", "card.classify",
    "note.read", "note.create", "note.moderate", "note.edit",
    "chat.read",
    "org.manage", "audit.read",
    "category.edit", "category.owner",
    "learn.author", "learn.assign", "learn.view_result", "learn.grade", "learn.report", "learn.course.arrange",
    "project.read", "project.review", "project.write", "project.manage",
]

# Dự án marketing (CE-32, BA 5.13): hành động trên dự án -> vai trò dự án tối thiểu.
# Vai trò hiệu lực = cao hơn giữa vai trò kho chứa dự án (viewer / editor / owner, cùng tên) và vai trò thành viên
# dự án (`members[].role`, thêm `reviewer` chỉ duyệt nội dung). Không có ngoại lệ cho admin (ORG-13).
PROJECT_ACTIONS: dict[str, str] = {"project.read": "viewer", "project.review": "reviewer",
                                   "project.write": "editor", "project.manage": "owner"}
PROJECT_RANK = {"viewer": 1, "reviewer": 2, "editor": 3, "owner": 4}
PROJECT_ROLES: tuple[str, ...] = tuple(PROJECT_RANK)


# ---------------------------------------------------------------------------
# Kho
# ---------------------------------------------------------------------------

# SYS-35: quyền cấp theo đơn vị chỉ có Xem / Sửa — quyền Quản lý (chủ kho) không cấp theo đơn vị
UNIT_GRANT_ROLES: tuple[str, ...] = ("viewer", "editor")


def user_unit_ancestry(user: dict) -> tuple[set[ObjectId], set[ObjectId]]:
    """(đơn vị người này đang thuộc — chính + kiêm nhiệm, các đơn vị tổ tiên của chúng) tại thời điểm hỏi.
    Người đã nghỉ (`org.status = left`) coi như không thuộc đơn vị nào."""
    o = org.user_org(user)
    direct = set(o["unit_ids"]) if o["status"] != "left" else set()
    if not direct:
        return set(), set()
    ancestors = {a for u in org.org_units.find({"_id": {"$in": list(direct)}}, {"path": 1})
                 for a in u.get("path") or []}
    return direct, ancestors


def unit_grant_applies(grant: dict, direct: set, ancestors: set) -> bool:
    """Quyền cấp cho đơn vị `grant.unit_id` có áp cho người thuộc `direct` (tổ tiên `ancestors`) không:
    thuộc chính đơn vị đó, hoặc thuộc đơn vị con cháu khi `include_children`."""
    return grant.get("unit_id") in direct or (bool(grant.get("include_children")) and grant.get("unit_id") in ancestors)


def space_unit_role(user: dict, space: dict | None, scope: tuple[set, set] | None = None) -> str | None:
    """Vai trò cao nhất người này có trong kho **qua đơn vị** (`spaces.unit_grants`, SYS-35); None nếu không có."""
    grants = (space or {}).get("unit_grants") or []
    if not grants:
        return None
    direct, ancestors = scope or user_unit_ancestry(user)
    roles = [g["role"] for g in grants if g.get("role") in UNIT_GRANT_ROLES and unit_grant_applies(g, direct, ancestors)]
    return max(roles, key=ROLE_RANK.__getitem__) if roles else None


def space_role(user: dict, space: dict | None) -> str | None:
    """Vai trò hiệu lực của người dùng trong kho = cao nhất trong: vai trò thành viên (`members`, mời riêng), vai trò
    qua đơn vị (`unit_grants`, tính theo đơn vị hiện tại — SYS-35), kho công khai trong công ty -> viewer."""
    if not space:
        return None
    roles = [m["role"] for m in space.get("members", []) if m["user_id"] == user["_id"]]
    roles.append(space_unit_role(user, space))
    if space.get("visibility") == "org":
        roles.append("viewer")
    roles = [r for r in roles if r in ROLE_RANK]
    return max(roles, key=ROLE_RANK.__getitem__) if roles else None


def visible_spaces_filter(user: dict, channel: Channel = "web") -> dict:
    """Điều kiện MongoDB trên chính collection `spaces`: các kho người này xem được — thành viên, công khai trong công
    ty, hoặc được chia sẻ cho đơn vị mình đang thuộc (đơn vị cha có `include_children` cũng tính, SYS-35)."""
    ors: list[dict] = [{"members.user_id": user["_id"]}, {"visibility": "org"}]
    direct, ancestors = user_unit_ancestry(user)
    if direct:
        ors.append({"unit_grants": {"$elemMatch": {"unit_id": {"$in": list(direct)}}}})
    if ancestors:
        ors.append({"unit_grants": {"$elemMatch": {"unit_id": {"$in": list(ancestors)}, "include_children": True}}})
    return {"$or": ors}


def can_share_space_units(user: dict, space: dict) -> bool:
    """Ai cấp / đổi / gỡ quyền kho theo đơn vị (SYS-35): chủ kho (`space.manage`) và quản trị viên.
    Quản trị viên chỉ quản lý việc cấp quyền — không vì thế mà đọc được nội dung kho (ORG-13)."""
    return user.get("role") == "admin" or can(user, "space.manage", space)


def readable_space_ids(user: dict, channel: Channel = "web") -> list[ObjectId]:
    return [s["_id"] for s in spaces.find(visible_spaces_filter(user, channel), {"_id": 1})]


def editable_space_ids(user: dict, among=None, channel: Channel = "web") -> list[ObjectId]:
    """Kho người này được sửa (`space.write`), theo thứ tự tìm thấy; `among` (tuỳ chọn): chỉ xét trong các id này."""
    f = visible_spaces_filter(user, channel)
    if among is not None:
        f = {"$and": [f, {"_id": {"$in": list(among)}}]}
    return [s["_id"] for s in spaces.find(f, {"members": 1, "visibility": 1, "unit_grants": 1})
            if can(user, "space.write", s, channel)]


def load_space(space_id, user: dict, action: str = "space.read", what: str = "kho",
               channel: Channel = "web") -> dict:
    """Tra kho theo id (chuỗi hoặc ObjectId) và kiểm tra quyền `action` (hành động kho, hoặc tên vai trò cũ
    "viewer" / "editor" / "owner"). Không xem được / id sai / không có -> 404 "Không tìm thấy <what>";
    xem được mà thiếu quyền -> 403 với câu cũ ("Bạn chỉ có quyền xem kho này" / "Chỉ chủ kho được thực hiện")."""
    action = ROLE_ACTIONS.get(action, action)
    if action not in SPACE_ACTIONS:
        raise ValueError(f"Hành động không phải hành động trên kho: {action}")
    try:
        oid = space_id if isinstance(space_id, ObjectId) else ObjectId(space_id)
    except (InvalidId, TypeError):
        raise HTTPException(404, f"Không tìm thấy {what}") from None
    space = spaces.find_one({"_id": oid})
    if not space:
        raise HTTPException(404, f"Không tìm thấy {what}")
    require(user, action, space, what, channel, denied=SPACE_DENIED.get(SPACE_ACTIONS[action]))
    return space


def _space_of(resource: dict) -> dict | None:
    if "members" in resource and "space_id" not in resource:
        return resource                                  # chính là kho (dự án cũng có members nhưng nằm trong kho)
    sid = resource.get("space_id")
    return spaces.find_one({"_id": sid}) if sid else None


# ---------------------------------------------------------------------------
# Dự án marketing (CE-32)
# ---------------------------------------------------------------------------

def project_role(user: dict, project: dict | None) -> str | None:
    """Vai trò hiệu lực trong dự án: cao hơn giữa vai trò kho chứa dự án và vai trò thành viên dự án."""
    if not project:
        return None
    found = [space_role(user, _space_of({"space_id": project.get("space_id")}))]
    found += [m["role"] for m in project.get("members", []) if m["user_id"] == user["_id"]]
    roles = [r for r in found if r in PROJECT_RANK]
    return max(roles, key=PROJECT_RANK.__getitem__) if roles else None


def visible_projects_filter(user: dict, channel: Channel = "web") -> dict:
    """Điều kiện MongoDB trên `studio_projects`: dự án trong kho xem được, hoặc mình là thành viên dự án."""
    return {"$or": [{"space_id": {"$in": readable_space_ids(user, channel)}}, {"members.user_id": user["_id"]}]}


# ---------------------------------------------------------------------------
# Kiểm tra hành động
# ---------------------------------------------------------------------------

def can(user: dict, action: Action, resource: dict | None = None, channel: Channel = "web") -> bool:
    """resource theo hành động:
    - `space.*`, `source.*`, `document.*`, `card.*`: bản ghi kho, hoặc bản ghi có `space_id`;
    - `chat.read`: cuộc trò chuyện ({"user_id": ObjectId});
    - `learn.assign`, `learn.view_result`, `learn.grade`: {"learner_id": ObjectId, "assigned_by"?: ObjectId};
    - `org.manage`, `audit.read`, `category.edit`, `category.owner`, `learn.author`, `learn.report`: None;
    - `learn.course.arrange`: {"category": slug khoá};
    - `project.*`: bản ghi dự án (`studio_projects`, có `space_id` + `members`);
    - `note.edit`: bản ghi ghi chép (`kb_notes`, có `space_id` + `created_by`).
    """
    r = resource or {}
    if action == "note.edit":
        # sửa / xoá một ghi chép (WK-45): tác giả khi còn xem được kho, hoặc chủ kho (note.moderate)
        return can(user, "note.read", r, channel) and (
            r.get("created_by") == user["_id"] or can(user, "note.moderate", r, channel))
    if action in PROJECT_ACTIONS:
        role = project_role(user, r)
        return bool(role) and PROJECT_RANK[role] >= PROJECT_RANK[PROJECT_ACTIONS[action]]
    if action in SPACE_ACTIONS:
        role = space_role(user, _space_of(r))   # không có ngoại lệ cho admin (ORG-13)
        return bool(role) and ROLE_RANK[role] >= ROLE_RANK[SPACE_ACTIONS[action]]
    if action == "chat.read":
        # cuộc trò chuyện chứa nội dung người tạo đọc bằng quyền của mình -> chỉ người tạo (ORG-13: admin cũng không)
        return r.get("user_id") == user["_id"]
    if action == "org.manage":
        return user.get("role") == "admin"
    if action == "category.edit":
        # cây lĩnh vực là dữ liệu dùng chung: mọi người dùng (web / MCP) được thêm, sửa, ẩn, xoá nhánh (còn dữ liệu thì chuyển sang nhánh khác)
        return bool(user.get("_id"))
    if action == "category.owner":
        # gán chủ nhánh = trao quyền duyệt thẻ trong nhánh (step2_reviewers) -> chỉ quản trị viên
        return user.get("role") == "admin"
    if action == "audit.read":
        return user.get("role") == "admin" or bool(org.active_grants(user, "auditor"))
    if action == "learn.author":
        return bool(subordinates(user, direct_only=True)) or any(
            g["role"] in ("editor", "lnd") for g in org.active_grants(user))
    if action == "learn.assign":
        return r["learner_id"] in assignable_learners(user)
    if action == "learn.view_result":
        return user["_id"] in result_viewers(r["learner_id"], r.get("assigned_by"))
    if action == "learn.grade":
        learner = users.find_one({"_id": r["learner_id"]}, {"org": 1}) or {}
        return user["_id"] in {r.get("assigned_by"), org.user_org(learner)["manager_id"]} - {None}
    if action == "learn.report":
        return bool(subordinates(user, direct_only=True)) or bool(org.active_grants(user, "lnd"))
    if action == "learn.course.arrange":
        # sắp thứ tự mặc định, đặt thi khoá, điểm đạt bài (BA 17.12 luật 2): L&D; chủ nhánh của nút hoặc nút cha
        # (16.4); cả chuỗi nhánh chưa ai làm chủ thì quản trị viên — như người duyệt thẻ bước 2 (kb/changes.py)
        if org.active_grants(user, "lnd"):
            return True
        slug = r.get("category") or ""
        parts = slug.split(".")
        chain = [".".join(parts[:i]) for i in range(1, len(parts) + 1)]
        owners = {c.get("owner_id") for c in cat_mod.categories.find({"slug": {"$in": chain}}, {"owner_id": 1})}
        owners.discard(None)
        return user["_id"] in owners if owners else user.get("role") == "admin"
    raise ValueError(f"Hành động không hợp lệ: {action}")


def require(user: dict, action: Action, resource: dict | None = None, what: str = "dữ liệu",
            channel: Channel = "web", denied: str | None = None) -> None:
    """Như `can` nhưng ném lỗi HTTP: không xem được -> 404, xem được mà thiếu quyền -> 403.
    `denied` (tuỳ chọn): câu báo 403 thay cho câu mặc định."""
    if can(user, action, resource, channel):
        return
    read_action = action.split(".")[0] + ".read"
    if (read_action in SPACE_ACTIONS or read_action in PROJECT_ACTIONS or read_action == "chat.read") \
            and not can(user, read_action, resource, channel):
        raise HTTPException(404, f"Không tìm thấy {what}")
    raise HTTPException(403, denied or "Bạn không có quyền thực hiện việc này")


# ---------------------------------------------------------------------------
# Lọc truy vấn
# ---------------------------------------------------------------------------

def visible_filter(user: dict, kind: str = "card", channel: Channel = "web") -> dict:
    """Điều kiện MongoDB: bản ghi loại `kind` (mọi collection có `space_id`: card, source, document, lesson…)
    mà người này xem được qua kênh `channel`.
    Đợt 0: theo kho. Luồng G thêm mức mật (C1 theo đơn vị, C2 / C3 theo danh sách) và loại C3 khi channel là mcp / chat.
    """
    return {"space_id": {"$in": readable_space_ids(user, channel)}}


def visible_to_all(people: list[dict], kind: str = "card") -> dict:
    """Giao phạm vi xem của nhiều người (BA 15.7 quy tắc 4): AI dựng bài học chỉ dùng thẻ
    người thiết kế VÀ mọi người học đều xem được."""
    sets = [set(readable_space_ids(p)) for p in people]
    return {"space_id": {"$in": list(set.intersection(*sets)) if sets else []}}


# ---------------------------------------------------------------------------
# Mức mật (luồng G triển khai đầy đủ)
# ---------------------------------------------------------------------------

def effective_classification(doc: dict) -> str:
    """Bản ghi chưa có trường `classification` coi như C1 — chỉ người trong kho xem được, đúng hành vi hiện tại."""
    c = doc.get("classification")
    return c if c in CLASSIFICATIONS else "C1"


def inherit_classification(items: list[dict], default: str = "C0") -> str:
    """Thẻ / bài học dựng từ nhiều nguồn nhận mức mật cao nhất (BA 15.5 quy tắc 1)."""
    if not items:
        return default
    return max((effective_classification(i) for i in items), key=CLASSIFICATIONS.index)


# ---------------------------------------------------------------------------
# Cây quản lý — học tập
# ---------------------------------------------------------------------------

def subordinates(user: dict, direct_only: bool = False) -> list[ObjectId]:
    """Người dưới quyền theo tuyến hành chính (mọi tầng, trừ khi direct_only)."""
    return org.subordinate_ids(user["_id"], direct_only=direct_only)


def _lnd_units(user: dict) -> list[ObjectId] | None:
    """Phạm vi đơn vị của vai trò L&D; None = toàn công ty; [] = không có vai trò."""
    units: list[ObjectId] = []
    for g in org.active_grants(user, "lnd"):
        unit = (g.get("scope") or {}).get("unit_id")
        if not unit:
            return None
        units.extend(org.unit_and_descendants(unit))
    return units


def assignable_learners(user: dict) -> list[ObjectId]:
    """Người `user` được giao lộ trình: cây dưới quyền + tuyến chức năng + phạm vi L&D (BA 15.6)."""
    ids = set(subordinates(user)) | set(org.subordinate_ids(user["_id"], field="functional_manager_id"))
    lnd = _lnd_units(user)
    if lnd is None or lnd:
        f = {"active": True} | ({} if lnd is None else {"org.unit_ids": {"$in": lnd}})
        ids.update(u["_id"] for u in users.find(f, {"_id": 1}))
    ids.discard(user["_id"])
    return list(ids)


def result_viewers(learner_id: ObjectId, assigned_by: ObjectId | None = None) -> set[ObjectId]:
    """Ai xem được bài làm / điểm: bản thân, mọi cấp quản lý phía trên, người giao, L&D có phạm vi.
    Đồng nghiệp ngang cấp không nằm trong tập này."""
    out = {learner_id, *org.manager_chain(learner_id)}
    if assigned_by:
        out.add(assigned_by)
    learner = users.find_one({"_id": learner_id}, {"org": 1})
    if learner:
        learner_units = set(org.user_org(learner)["unit_ids"])
        for uid in org.grants.distinct("user_id", {"role": "lnd"}):
            u = users.find_one({"_id": uid, "active": True})
            lnd = _lnd_units(u) if u else []
            if lnd is None or learner_units & set(lnd or []):
                out.add(uid)
    return out


def learn_flags(user: dict) -> dict:
    """Cờ hiện menu Học tập (web chỉ dùng để ẩn menu — API vẫn tự kiểm quyền từng lệnh):
    - `can_design`: soạn bài / lộ trình (`learn.author`) → menu *Thiết kế lộ trình*, *Lộ trình học*;
    - `can_grade`: có bài để chấm / xem kết quả — người có cấp dưới trực tiếp hoặc L&D (`learn.report`), hoặc người đã
      giao lộ trình (người giao chấm được bài mình giao) → menu *Chấm bài*."""
    return {"can_design": can(user, "learn.author"),
            "can_grade": can(user, "learn.report") or bool(
                db.db["assignments"].count_documents({"assigned_by": user["_id"]}, limit=1))}


def learn_author_status(user: dict) -> dict:
    """Vì sao người này (không) soạn được bài học — chỉ để giải thích trên giao diện, KHÔNG cấp quyền.
    Cùng điều kiện với `can(user, "learn.author")`: có cấp dưới trực tiếp, hoặc vai trò `editor` / `lnd` còn hiệu lực.
    `org_empty`: cây tổ chức chưa có đơn vị nào; `is_admin`: người xem quản trị được /org (`org.manage`)."""
    grant_roles = sorted({g["role"] for g in org.active_grants(user)})
    has_subs = bool(subordinates(user, direct_only=True))
    return {"can_author": has_subs or any(r in ("editor", "lnd") for r in grant_roles),
            "in_org": bool(org.user_org(user)["unit_ids"]),
            "has_subordinates": has_subs,
            "grant_roles": grant_roles,
            "is_admin": can(user, "org.manage"),
            "org_empty": not org.org_units.count_documents({}, limit=1)}


def content_levels_for(user: dict, category_root: str | None) -> list[str]:
    """Bậc nội dung (level của thẻ) hợp với người này ở mảng `category_root` (slug gốc cây lĩnh vực), theo bảng ánh
    xạ cấp bậc (ORG-05 phần dữ liệu, `org.level_map`): mảng của chức năng chính → `own`, mảng khác → `other`.
    Người chưa có cấp bậc → []. Chỉ để chọn nội dung (lộ trình học, phân phối thẻ) — KHÔNG dùng để chặn quyền."""
    o = org.user_org(user)
    if not o["level"]:
        return []
    entry = org.level_map().get(o["level"]) or {}
    own = bool(category_root) and org.function_category_root(o["function"]) == category_root
    return list(entry.get("own" if own else "other") or [])


# ---------------------------------------------------------------------------
# Duyệt tri thức — người duyệt bước 2 (GOV, BA 16.4 v0.12; chuyển từ kb/changes.step2_rule)
# ---------------------------------------------------------------------------

TOP_LEVELS = ("thiet-ke", "dieu-hanh")     # bước 2 = TGĐ (tạm: quản trị viên)


def admin_ids() -> list[ObjectId]:
    return [u["_id"] for u in users.find({"role": "admin", "active": True}, {"_id": 1})]


def _active(uid) -> bool:
    return bool(uid) and bool(users.count_documents({"_id": uid, "active": True}, limit=1))


def category_chain(slug: str | None) -> list[dict]:
    """Nhánh của slug từ gốc xuống (cấp 1, 2, …, chính nó)."""
    cat = cat_mod.categories.find_one({"slug": slug}) if slug else None
    if not cat:
        return []
    anc = {c["slug"]: c for c in cat_mod.categories.find({"slug": {"$in": cat.get("path") or []}})}
    return [anc[s] for s in cat.get("path") or [] if s in anc] + [cat]


def tier2_owner(card: dict) -> ObjectId | None:
    """Chủ nhánh tầng 2 chứa lĩnh vực chính (`categories[0]`)."""
    chain = category_chain((card.get("categories") or [None])[0])
    tier2 = next((c for c in chain if c.get("level") == 2), None)
    return tier2["owner_id"] if tier2 and _active(tier2.get("owner_id")) else None


def category_owner(card: dict) -> ObjectId | None:
    """Chủ sở hữu lĩnh vực của thẻ: người chủ nhánh gần nhất tính từ `categories[0]` đi lên."""
    for c in reversed(category_chain((card.get("categories") or [None])[0])):
        if _active(c.get("owner_id")):
            return c["owner_id"]
    return None


def classification_rank(v: str | None) -> int:
    """Thứ tự mức mật C0 < C1 < C2 < C3; thiếu / lạ coi như C1 (như `effective_classification`)."""
    return CLASSIFICATIONS.index(v) if v in CLASSIFICATIONS else 1


def card_after_change(card: dict, change: dict | None) -> dict:
    """Thẻ sau khi áp đề xuất `change` (proposal {set, unset}) — không ghi DB."""
    p = (change or {}).get("proposal") or {}
    return {k: v for k, v in card.items() if k not in (p.get("unset") or [])} | (p.get("set") or {})


def step2_reviewers(card: dict, change: dict | None = None) -> tuple[list[ObjectId], str]:
    """(người duyệt bước 2, nhãn) của đề xuất `change` trên thẻ `card` (BA 16.4). Xét cả nội dung trước và sau đề
    xuất để không hạ bậc thẻ mà né người duyệt:
    - cổng so sánh ra MÂU THUẪN → chủ sở hữu lĩnh vực của thẻ cũ;
    - `rollback`, `obsolete`, `classify` hạ mức mật → chủ sở hữu lĩnh vực;
    - thẻ bậc thiết kế / điều hành → TGĐ (tạm: quản trị viên);
    - còn lại (kể cả thẻ chưa có level) → chủ nhánh tầng 2 của `categories[0]`.
    Chưa gán chủ → quản trị viên."""
    ch = change or {}
    after = card_after_change(card, ch)
    lowers = classification_rank(after.get("classification")) < classification_rank(card.get("classification"))
    nov = ch.get("novelty") or {}
    if nov.get("verdict") == "conflict" and nov.get("related"):
        old = db.db["wiki_cards"].find_one({"_id": nov["related"][0]["card_id"]}, {"categories": 1})
        owner = category_owner(old or {})
        return ([owner], "Chủ sở hữu lĩnh vực của thẻ cũ (mâu thuẫn)") if owner else (
            admin_ids(), "Quản trị viên (thẻ cũ chưa có chủ lĩnh vực — mâu thuẫn)")
    kind = ch.get("kind")
    if kind in ("rollback", "obsolete") or (kind == "classify" and lowers):
        owner = category_owner(after) or category_owner(card)
        return ([owner], "Chủ sở hữu lĩnh vực") if owner else (admin_ids(), "Quản trị viên (lĩnh vực chưa có chủ)")
    if {card.get("level"), after.get("level")} & set(TOP_LEVELS):
        return admin_ids(), "TGĐ (tạm thời: quản trị viên)"
    owner = tier2_owner(after) or tier2_owner(card)
    return ([owner], "Chủ nhánh tầng 2") if owner else (admin_ids(), "Quản trị viên (nhánh tầng 2 chưa có chủ)")


# ---------------------------------------------------------------------------
# Đọc bài học qua lộ trình được giao (vấn đề mở 33 — luồng I; chuyển từ learn/routes.py)
# ---------------------------------------------------------------------------

# Mức mật bài học được mở qua việc được giao: bài C0 / C1 trong lộ trình được giao (hoặc khung năm của cấp trên với
# người soạn cấp dưới) thì xem được dù không ở trong kho; C2 / C3 vẫn theo kho.
VIA_ASSIGNMENT_LEVELS = ("C0", "C1")
VIA_ASSIGNMENT = {"classification": {"$nin": ["C2", "C3"]}}


def assigned_lesson_ids(user: dict) -> set[ObjectId]:
    """Bài học trong các lộ trình được giao cho người này."""
    return set(db.db["assignments"].distinct("lesson_ids", {"learner_id": user["_id"]}))


def frame_lesson_ids(user: dict) -> set[ObjectId]:
    """Bài học trong khung năm đã phát hành của các cấp quản lý phía trên — người soạn cấp dưới kế thừa khung được
    dùng / đọc (BA 17.4: cấp trên phát hành khung = giao nội dung khung cho cấp dưới; QA vòng 2, L3)."""
    if not can(user, "learn.author"):
        return set()
    frames = db.db["learning_paths"].find(
        {"period": "year", "status": {"$in": ["published", "closed"]},
         "owner_id": {"$in": org.manager_chain(user["_id"])}}, {"modules.lesson_ids": 1, "required_items": 1})
    return {i for p in frames for i in [*(p.get("required_items") or []),
                                        *[x for m in p.get("modules") or [] for x in m.get("lesson_ids") or []]]}


def lessons_opened_via_assignment(user: dict) -> set[ObjectId]:
    """Id bài học mở cho người này qua lộ trình: được giao + khung năm của cấp trên."""
    return assigned_lesson_ids(user) | frame_lesson_ids(user)


def via_assignment_filter(user: dict, opened: set[ObjectId] | None = None) -> dict | None:
    """Điều kiện MongoDB trên `lessons`: bài đọc được qua lộ trình (đã phát hành, C0 / C1). None = không có bài nào."""
    opened = lessons_opened_via_assignment(user) if opened is None else opened
    if not opened:
        return None
    return {"_id": {"$in": list(opened)}, "status": {"$ne": "draft"}} | VIA_ASSIGNMENT


def can_read_via_assignment(user: dict, lesson: dict) -> bool:
    """Người này đọc được bài `lesson` (và mọi thẻ trong bài) nhờ lộ trình: bài C0 / C1 đã phát hành, nằm trong
    lộ trình được giao hoặc khung năm của cấp trên."""
    return (effective_classification(lesson) in VIA_ASSIGNMENT_LEVELS and lesson.get("status") != "draft"
            and lesson["_id"] in lessons_opened_via_assignment(user))
