"""Cây lĩnh vực chuyên môn dùng chung toàn công ty (tối đa 4 cấp: Mảng → Chuyên ngành → Chuyên môn → Đầu việc).
Xem docs/BA.md mục 4.3."""

from __future__ import annotations

import re

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from . import db
from .auth import current_user

categories = db.db["categories"]
suggestions = db.db["category_suggestions"]

MAX_LEVEL = 4
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$")
SCOPE_NOTE_MAX = 2000
LINKS_MAX = 20          # số liên kết tra cứu tối đa mỗi nhánh

DEFAULT_TREE = [
    ("Marketing", "Chiến lược, truyền thông, nội dung và quảng cáo", [
        ("Chiến lược & thương hiệu", "Định vị, xây dựng thương hiệu, kế hoạch marketing"),
        ("Tâm lý khách hàng", "Động cơ, cảm xúc, thiên kiến, hành vi ra quyết định mua"),
        ("Chân dung khách hàng", "Persona, phân khúc, hành trình khách hàng, nghiên cứu nhu cầu"),
        ("Nội dung & mạng xã hội", "Content marketing, lên tuyến nội dung, fanpage, cộng đồng"),
        ("Video ngắn / TikTok", "Kịch bản, hook, xu hướng, thuật toán video ngắn"),
        ("SEO", "Tối ưu tìm kiếm, từ khoá, nội dung website"),
        ("Quảng cáo trả phí", "Facebook Ads, Google Ads, TikTok Ads, tối ưu chi phí"),
        ("Copywriting", "Viết lời quảng cáo, tiêu đề, kêu gọi hành động"),
        ("Nghiên cứu thị trường & đối thủ", "Phân tích thị trường, đối thủ cạnh tranh, xu hướng ngành"),
    ]),
    ("Bán hàng & CSKH", "Bán hàng, chăm sóc và giữ chân khách hàng", [
        ("Kỹ năng bán hàng", "Tư vấn, xử lý từ chối, chốt đơn"),
        ("Chăm sóc khách hàng", "Hậu mãi, giữ chân, xử lý khiếu nại"),
        ("Đàm phán", "Đàm phán giá, hợp đồng, với đối tác"),
        ("Kênh phân phối", "Đại lý, bán buôn, thương mại điện tử"),
    ]),
    ("Tài chính", "Quản trị tài chính doanh nghiệp", [
        ("Phân tích tài chính", "Báo cáo tài chính, chỉ số, hiệu quả kinh doanh"),
        ("Quản trị dòng tiền", "Thu chi, công nợ, vốn lưu động"),
        ("Ngân sách & kế hoạch", "Lập ngân sách, dự báo, kiểm soát chi phí"),
        ("Đầu tư & huy động vốn", "Thẩm định dự án, vay vốn, gọi vốn"),
    ]),
    ("Kế toán", "Nghiệp vụ và chuẩn mực kế toán", [
        ("Kế toán tài chính", "Hạch toán, chuẩn mực, báo cáo tài chính"),
        ("Kế toán quản trị", "Giá thành, phân tích chi phí, báo cáo quản trị"),
        ("Thuế", "Thuế GTGT, TNDN, TNCN, hoá đơn, quyết toán"),
        ("Chứng từ & quy trình", "Chứng từ, kiểm soát nội bộ, quy trình kế toán"),
    ]),
    ("Nhân sự & quản trị", "Con người và tổ chức", [
        ("Tuyển dụng", "Tìm kiếm, phỏng vấn, tuyển chọn"),
        ("Đào tạo & phát triển", "Đào tạo nội bộ, lộ trình nghề nghiệp"),
        ("Lãnh đạo & quản lý đội ngũ", "Giao việc, tạo động lực, quản lý hiệu suất"),
        ("Văn hoá doanh nghiệp", "Giá trị, gắn kết, truyền thông nội bộ"),
    ]),
    ("Ngành ô tô", "Chuyên môn ngành ô tô của VC Phồn Vinh", [
        ("Kỹ thuật ô tô", "Cấu tạo, chẩn đoán, sửa chữa"),
        ("Phụ tùng", "Mã phụ tùng, thương hiệu, nguồn cung, kinh doanh phụ tùng"),
        ("Dịch vụ garage", "Vận hành xưởng, báo giá, dịch vụ khách hàng garage"),
        ("Hướng nghiệp ngành ô tô", "Học nghề, lộ trình nghề nghiệp, thị trường lao động ngành ô tô"),
    ]),
    ("Công nghệ & chuyển đổi số", "Công nghệ ứng dụng trong doanh nghiệp", [
        ("AI & tự động hoá", "Ứng dụng AI, tự động hoá quy trình"),
        ("Phần mềm quản trị", "ERP, CRM, phần mềm garage"),
        ("Dữ liệu & phân tích", "Báo cáo, dashboard, phân tích dữ liệu"),
    ]),
    ("Pháp lý", "Pháp luật áp dụng cho hoạt động kinh doanh", [
        ("Hợp đồng", "Soạn thảo, rà soát hợp đồng"),
        ("Sở hữu trí tuệ", "Nhãn hiệu, bản quyền, nội dung"),
        ("Quy định ngành", "Quy định kinh doanh ô tô, phụ tùng, quảng cáo"),
    ]),
]


def slugify(name: str) -> str:
    s = db.unaccent(name)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "linh-vuc"


def ensure_indexes() -> None:
    categories.create_index("slug", unique=True)
    categories.create_index("path")
    suggestions.create_index([("status", 1), ("created_at", -1)])


def seed_defaults() -> None:
    if categories.count_documents({}, limit=1):
        return
    for i, (name, desc, children) in enumerate(DEFAULT_TREE):
        parent = _insert(name, desc, None, i)
        for j, (cname, cdesc) in enumerate(children):
            _insert(cname, cdesc, parent, j)


def check_slug(slug: str, parent: dict | None, self_id: ObjectId | None = None) -> str:
    """Slug đặt tay (vd `mkt.digital.seo`): chữ thường không dấu, gạch ngang; nối sau slug cha; chưa ai dùng.
    self_id: nhánh đang đổi slug (không tính trùng với chính nó)."""
    slug = slug.strip()
    prefix = parent["slug"] + "." if parent else ""
    if not SLUG_RE.match(slug) or not slug.startswith(prefix) or "." in slug[len(prefix):]:
        want = f"{prefix}<ten-khong-dau>" if parent else "<ten-khong-dau> (không có dấu chấm)"
        raise HTTPException(400, f"Slug '{slug}' không hợp lệ — dạng {want}, chữ thường, số, gạch ngang")
    if categories.find_one({"slug": slug, "_id": {"$ne": self_id}}, {"_id": 1}):
        raise HTTPException(409, f"Slug '{slug}' đã có trong cây")
    return slug


def check_name(name: str) -> str:
    """Tên nhánh bỏ khoảng trắng thừa; chỉ có khoảng trắng -> 400 (không tạo nhánh tên rỗng)."""
    name = " ".join((name or "").split())
    if not name:
        raise HTTPException(400, "Cần tên nhánh (không được chỉ có khoảng trắng)")
    return name


def check_parent_active(parent: dict | None) -> None:
    """Nhánh cha đã ẩn thì không thêm / bật nhánh con (con sẽ thành nút mồ côi trong cây đang dùng)."""
    if parent and not parent.get("active", True):
        raise HTTPException(400, f"Nhánh cha '{parent['slug']}' đã ẩn — bật lại nhánh cha trước")


def _insert(name: str, description: str, parent: dict | None, order: int, slug: str | None = None,
            code: str | None = None, scope_note: str = "", owner_id: ObjectId | None = None,
            created_by: ObjectId | None = None, links: list[dict] | None = None) -> dict:
    name = check_name(name)
    if slug:
        slug = check_slug(slug, parent)
    else:
        slug = (parent["slug"] + "." if parent else "") + slugify(name)
        base, n = slug, 2
        while categories.find_one({"slug": slug}, {"_id": 1}):
            slug, n = f"{base}-{n}", n + 1
    doc = {"slug": slug, "name": name.strip(), "description": description.strip(),
           "code": (code or "").strip() or None, "scope_note": scope_note.strip(), "owner_id": owner_id,
           "links": links or [],
           "parent_id": parent["_id"] if parent else None,
           "path": (parent["path"] + [parent["slug"]]) if parent else [],
           "level": (parent["level"] + 1) if parent else 1, "order": order, "active": True,
           "created_at": db.now(), "created_by": created_by}
    if parent and parent.get("scheme"):
        doc["scheme"] = parent["scheme"]            # nhánh con của cây v2 cũng thuộc v2 (ai_list chỉ lấy scheme v2)
    doc["_id"] = categories.insert_one(doc).inserted_id
    return doc


def _live(rows: list[dict]) -> list[dict]:
    """Bỏ nhánh có tổ tiên đang ẩn (dữ liệu cũ trước khi chặn nhánh con mồ côi)."""
    paths = {p for c in rows for p in c.get("path", [])}
    hidden = {c["slug"] for c in categories.find({"slug": {"$in": list(paths)}, "active": False}, {"slug": 1})}
    return [c for c in rows if not hidden.intersection(c.get("path", []))]


def active_list() -> list[dict]:
    return _live(list(categories.find({"active": True}).sort([("level", 1), ("order", 1)])))


def ai_list() -> list[dict]:
    """Nhánh AI được chọn khi dựng thẻ. Đã nạp cây v2 (scheme = "v2", scripts/seed_tree_v2.py) thì chỉ cây v2 —
    cây cũ còn hiệu lực cho thẻ cũ và người gán tay tới khi chuyển xong; chưa nạp thì cả cây như trước."""
    rows = active_list()
    return [c for c in rows if c.get("scheme") == "v2"] or rows


def prompt_tree(rows: list[dict] | None = None) -> str:
    """Cây lĩnh vực đưa vào prompt AI: slug (mã) tên đầy đủ — mô tả, kèm scope note 4 dòng nếu có."""
    full = labels()
    lines = []
    for c in rows if rows is not None else ai_list():
        code = f" ({c['code']})" if c.get("code") else ""
        lines.append(f"- {c['slug']}{code}: {full.get(c['slug'], c['name'])} — {c.get('description', '')}")
        if note := (c.get("scope_note") or "").strip():
            lines.append("  " + note.replace("\n", "\n  "))
    return "\n".join(lines)


def resolve_slug(slug: str) -> str:
    """Slug cũ (trước khi đổi tên nhánh — `old_slugs`) -> slug hiện tại; slug đang dùng hoặc lạ thì giữ nguyên."""
    if not slug or categories.find_one({"slug": slug}, {"_id": 1}):
        return slug
    c = categories.find_one({"old_slugs": slug}, {"slug": 1})
    return c["slug"] if c else slug


def valid_slugs(slugs: list[str]) -> list[str]:
    """Chỉ giữ mã lĩnh vực có thật và đang dùng (pipeline AI — slug lạ bị bỏ, không làm hỏng cả tài liệu).
    Slug cũ của nhánh đã đổi tên được đổi sang slug hiện tại."""
    slugs = [resolve_slug(s) for s in slugs]
    rows = _live(list(categories.find({"slug": {"$in": list(slugs)}, "active": True}, {"slug": 1, "path": 1})))
    ok = {c["slug"] for c in rows}
    return [s for s in dict.fromkeys(slugs) if s in ok]


def check_slugs(slugs: list[str], keep: list[str] | None = None) -> list[str]:
    """Như valid_slugs nhưng slug chưa có trong cây (hoặc đã ẩn) -> 400 kèm danh sách, không bỏ lặng.
    Dùng khi người / AI qua MCP gán lĩnh vực cho thẻ. keep: slug thẻ đang có — giữ nguyên dù nhánh đã ẩn
    (ẩn nhánh không khoá việc sửa thẻ cũ), chỉ slug mới thêm phải còn trong cây."""
    slugs = list(dict.fromkeys(resolve_slug(s.strip()) for s in slugs if s and s.strip()))
    kept = set(keep or [])
    ok = set(valid_slugs([s for s in slugs if s not in kept])) | kept
    if wrong := [s for s in slugs if s not in ok]:
        raise HTTPException(400, f"Lĩnh vực chưa có trong cây hoặc đã ẩn: {', '.join(wrong)} — chọn nhánh đang dùng "
                                 "trong cây lĩnh vực (AI: list_categories) hoặc thêm nhánh (AI: create_category)")
    return [s for s in slugs if s in ok]


def with_descendants(slug: str) -> list[str]:
    """Lọc nhánh X = X và mọi nhánh con (X là slug cũ của nhánh đã đổi tên thì theo slug hiện tại)."""
    slug = resolve_slug(slug)
    return [c["slug"] for c in categories.find({"$or": [{"slug": slug}, {"path": slug}]}, {"slug": 1})]


def labels() -> dict[str, str]:
    """slug -> 'Cha › Con' để hiển thị và đưa vào prompt."""
    cats = list(categories.find({}, {"slug": 1, "name": 1}))
    names = {c["slug"]: c["name"] for c in cats}
    return {s: " › ".join(names[p] for p in [*_ancestors(s), s] if p in names) for s in names}


def _ancestors(slug: str) -> list[str]:
    parts = slug.split(".")
    return [".".join(parts[:i]) for i in range(1, len(parts))]


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/api/categories")


class CategoryLink(BaseModel):
    """Liên kết tra cứu gắn với nhánh (vd web tra mã phụ tùng của hãng VCPV phân phối). Trang VCWIKI lọc nhánh này
    hiện thành nút mở tab mới — các web này chặn nhúng iframe nên không nhúng khung."""
    label: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=1, max_length=500)
    note: str = Field("", max_length=200)

    @field_validator("label", "note", mode="before")
    @classmethod
    def _strip(cls, v):
        return " ".join(v.split()) if isinstance(v, str) else v

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^https?://[^\s/]+\.[^\s]+$", v, re.IGNORECASE):
            raise ValueError(f"url phải là địa chỉ http(s) đầy đủ, vd https://tramaphutung.com (nhận '{v}')")
        return v



class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field("", max_length=300)
    parent_id: str | None = None
    slug: str | None = Field(None, max_length=120)      # đặt tay, vd mkt.digital.seo; bỏ trống = sinh từ tên
    code: str | None = Field(None, max_length=20)       # mã hiển thị, vd 1.3.2
    scope_note: str = Field("", max_length=SCOPE_NOTE_MAX)   # 4 dòng: Gồm / Không gồm / Dễ nhầm với / Ví dụ thẻ
    owner_id: str | None = None                          # người chủ nhánh (giám đốc chuyên ngành) — duyệt, rà soát
    links: list[CategoryLink] = Field(default_factory=list, max_length=LINKS_MAX)   # liên kết tra cứu


class CategoryPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=80)
    description: str | None = Field(None, max_length=300)
    code: str | None = Field(None, max_length=20)
    scope_note: str | None = Field(None, max_length=SCOPE_NOTE_MAX)
    owner_id: str | None = None                          # "" = gỡ người chủ
    active: bool | None = None
    order: int | None = None
    slug: str | None = Field(None, max_length=120)      # slug mới đặt tay; bỏ trống mà đổi tên = sinh lại từ tên mới
    links: list[CategoryLink] | None = Field(None, max_length=LINKS_MAX)   # thay cả danh sách; [] = xoá hết


def _owner(owner_id: str | None) -> ObjectId | None:
    if not owner_id:
        return None
    from .auth import users
    try:
        u = users.find_one({"_id": ObjectId(owner_id)}, {"_id": 1})
    except InvalidId:
        u = None
    if not u:
        raise HTTPException(400, "Không tìm thấy người chủ nhánh (owner_id)")
    return u["_id"]


def _get(cat_id: str) -> dict:
    try:
        c = categories.find_one({"_id": ObjectId(cat_id)})
    except InvalidId:
        c = None
    if not c:
        raise HTTPException(404, "Không tìm thấy lĩnh vực")
    return c


def _count_by_slug(space_ids: list) -> dict[str, int]:
    rows = db.db["wiki_cards"].aggregate([
        {"$match": {"space_id": {"$in": space_ids}}},
        {"$unwind": "$categories"}, {"$group": {"_id": "$categories", "n": {"$sum": 1}}}])
    return {r["_id"]: r["n"] for r in rows}


@router.get("")
def tree(include_inactive: bool = False, user: dict = Depends(current_user)):
    """Danh sách phẳng (FE tự dựng cây), kèm số thẻ trong các kho người dùng xem được (gồm nhánh con)."""
    from . import policy   # nạp muộn như trước (tránh import vòng khi khởi động)

    f = {} if include_inactive else {"active": True}
    cats = list(categories.find(f).sort([("level", 1), ("order", 1), ("name", 1)]))
    if not include_inactive:
        cats = _live(cats)
    own = _count_by_slug(policy.readable_space_ids(user))
    total = {c["slug"]: sum(n for s, n in own.items() if s == c["slug"] or s.startswith(c["slug"] + "."))
             for c in cats}
    from .auth import users
    owners = {u["_id"]: u["name"] for u in users.find(
        {"_id": {"$in": list({c["owner_id"] for c in cats if c.get("owner_id")})}}, {"name": 1})}
    return [{"id": str(c["_id"]), "slug": c["slug"], "name": c["name"], "description": c.get("description", ""),
             "code": c.get("code"), "scope_note": c.get("scope_note", ""),
             "owner_id": str(c["owner_id"]) if c.get("owner_id") else None, "owner_name": owners.get(c.get("owner_id")),
             "parent_id": str(c["parent_id"]) if c.get("parent_id") else None, "level": c["level"],
             "order": c.get("order", 0), "active": c.get("active", True), "old_slugs": c.get("old_slugs") or [],
             "links": c.get("links") or [],
             "card_count": total.get(c["slug"], 0)} for c in cats]


def require_edit(user: dict, body_owner: bool = False) -> None:
    from . import policy
    policy.require(user, "category.edit")
    if body_owner:
        policy.require(user, "category.owner", denied="Chỉ quản trị viên được gán chủ nhánh (chủ nhánh duyệt thẻ)")


@router.post("", status_code=201)
def create(body: CategoryIn, user: dict = Depends(current_user)):
    require_edit(user, bool(body.owner_id))
    parent = _get(body.parent_id) if body.parent_id else None
    check_parent_active(parent)
    if parent and parent["level"] >= MAX_LEVEL:
        raise HTTPException(400, f"Cây lĩnh vực tối đa {MAX_LEVEL} cấp")
    siblings = categories.count_documents({"parent_id": parent["_id"] if parent else None})
    c = _insert(body.name, body.description, parent, siblings, slug=body.slug, code=body.code,
                scope_note=body.scope_note, owner_id=_owner(body.owner_id), created_by=user["_id"],
                links=[x.model_dump() for x in body.links])
    return {"id": str(c["_id"]), "slug": c["slug"], "level": c["level"]}


@router.patch("/{cat_id}")
def update(cat_id: str, body: CategoryPatch, user: dict = Depends(current_user)):
    """Đổi tên thì slug (đường dẫn /wiki?category=…) đổi theo — sinh từ tên mới, hoặc slug đặt tay trong `slug`;
    nhánh con và dữ liệu đang gắn slug cũ chuyển theo (xem rename_slug). Trả slug hiện tại."""
    c = _get(cat_id)
    changes = body.model_dump(exclude_none=True)
    owner_changed = "owner_id" in changes and (_owner(changes["owner_id"]) != c.get("owner_id"))
    require_edit(user, owner_changed)
    active = changes.pop("active", None)
    new_slug = changes.pop("slug", "").strip()
    if "name" in changes:
        changes["name"] = check_name(changes["name"])
        if not new_slug and changes["name"] != c["name"]:
            prefix = c["slug"].rpartition(".")[0]
            new_slug = (prefix + "." if prefix else "") + slugify(changes["name"])
    if new_slug and new_slug != c["slug"]:
        parent = categories.find_one({"_id": c["parent_id"]}) if c.get("parent_id") else None
        c = rename_slug(c, check_slug(new_slug, parent, self_id=c["_id"]))
    if "owner_id" in changes:
        changes["owner_id"] = _owner(changes["owner_id"])
    if "code" in changes:
        changes["code"] = changes["code"].strip() or None
    if active is not None:
        set_active(c, active)
    categories.update_one({"_id": c["_id"]}, {"$set": {**changes, "updated_at": db.now(), "updated_by": user["_id"]}})
    return {"ok": True, "slug": c["slug"]}


# Chỗ lưu slug lĩnh vực ngoài cây: (collection, trường, điều kiện thêm). Trường có "$[]" là mảng lồng
# (vd exam.blueprint[].category). Lịch sử phiên bản thẻ (card_revisions) giữ nguyên slug lúc đó.
SLUG_FIELDS = [
    ("wiki_cards", "categories", {}),
    ("kb_documents", "categories", {}),
    ("kb_documents", "primary_category", {}),
    ("kb_sources", "categories", {}),
    ("change_requests", "proposal.set.categories", {"status": {"$in": ["open", "needs_rebase"]}}),
    ("org_functions", "category_root", {}),
    ("grants", "scope.category", {}),
    ("learning_paths", "ai.form.area", {}),
    ("learning_paths", "ai.form.branches", {}),
    ("learning_paths", "exam.blueprint.$[].category", {}),
    ("lessons", "category", {}),                  # khoá học = nút cây (LRN-15)
    ("courses", "category", {}),                  # cài đặt khoá: thi khoá, điểm đạt bài (TK-15b)
    ("learning_paths", "courses.$[].category", {}), # chuỗi khoá trong lộ trình (TK-15c)
    ("assignments", "plan.$[].category", {}),       # ảnh chụp lúc giao (TK-15c)
    ("category_suggestions", "parent_slug", {}),
    ("category_suggestions", "category_slug", {}),
    ("wiki_topic_maps", "category", {}),
]


def _move_value(coll, field: str, extra: dict, old: str, new: str) -> None:
    """Thay giá trị `old` -> `new` ở trường `field` (chuỗi, phần tử mảng chuỗi, hay trường trong mảng object)."""
    if "$[]" in field:
        arr, key = field.split(".$[].")
        coll.update_many({**extra, f"{arr}.{key}": old}, {"$set": {f"{arr}.$[e].{key}": new}},
                         array_filters=[{f"e.{key}": old}])
        return
    coll.update_many({**extra, field: old, f"{field}.0": {"$exists": False}}, {"$set": {field: new}})   # chuỗi
    coll.update_many({**extra, field: old}, {"$set": {f"{field}.$[e]": new}}, array_filters=[{"e": old}])  # mảng


def rename_slug(c: dict, new: str) -> dict:
    """Đổi slug nhánh `c` (và mọi nhánh con: old.x -> new.x). Cây cập nhật trước (slug, path, hidden_by; slug cũ
    ghi vào `old_slugs` để link / slug cũ vẫn tra ra nhánh), sau đó chuyển mọi dữ liệu đang gắn slug cũ."""
    old = c["slug"]
    move = lambda s: new + s[len(old):] if s == old or s.startswith(old + ".") else s   # noqa: E731
    subtree = list(categories.find({"$or": [{"_id": c["_id"]}, {"path": old}]}))
    pairs = [(n["slug"], move(n["slug"])) for n in subtree]
    for n in subtree:
        upd = {"slug": move(n["slug"]), "path": [move(p) for p in n.get("path", [])]}
        if n.get("hidden_by"):
            upd["hidden_by"] = move(n["hidden_by"])
        aliases = [a for a in dict.fromkeys([*(n.get("old_slugs") or []), n["slug"]]) if a != upd["slug"]]
        categories.update_one({"_id": n["_id"]}, {"$set": {**upd, "old_slugs": aliases}})
    for coll, field, extra in SLUG_FIELDS:
        for a, b in pairs:
            _move_value(db.db[coll], field, extra, a, b)
    from .learn import courses
    courses.rename_course_progress(pairs)
    return categories.find_one({"_id": c["_id"]})


# Dữ liệu chuyển theo khi xoá nhánh (move_to): mọi chỗ trong SLUG_FIELDS trừ phạm vi quyền và chức năng tổ chức —
# chuyển chúng sang nhánh khác là đổi quyền / cơ cấu, phải gỡ ở trang quản trị trước
NO_MOVE = {"chức năng tổ chức", "phạm vi quyền"}


def usage(slugs: list[str]) -> dict[str, int]:
    """Dữ liệu đang gắn các slug (một nhánh và nhánh con): thẻ, tài liệu, nguồn, chức năng tổ chức, phạm vi quyền,
    lộ trình học."""
    d, q = db.db, {"$in": slugs}
    counts = {
        "thẻ": d["wiki_cards"].count_documents({"categories": q}),
        "tài liệu": d["kb_documents"].count_documents({"$or": [{"categories": q}, {"primary_category": q}]}),
        "nguồn": d["kb_sources"].count_documents({"categories": q}),
        "chức năng tổ chức": d["org_functions"].count_documents({"category_root": q}),
        "phạm vi quyền": d["grants"].count_documents({"scope.category": q}),
        "lộ trình học": d["learning_paths"].count_documents({"$or": [{"ai.form.area": q}, {"ai.form.branches": q},
                                                                       {"courses.category": q}]}),
        "bài học": d["lessons"].count_documents({"category": q}),
        "cài đặt khoá": d["courses"].count_documents({"category": q}),
        "việc được giao": d["assignments"].count_documents({"plan.category": q}),
    }
    return {k: n for k, n in counts.items() if n}


def _dedupe(target: str) -> None:
    """Sau khi chuyển nhiều slug về một nhánh: bỏ phần tử trùng trong các trường mảng (giữ thứ tự)."""
    uniq = {"$reduce": {"input": "$$arr", "initialValue": [],
                        "in": {"$cond": [{"$in": ["$$this", "$$value"]}, "$$value",
                                         {"$concatArrays": ["$$value", ["$$this"]]}]}}}
    for coll, field, extra in SLUG_FIELDS:
        if "$[]" in field:
            continue
        db.db[coll].update_many({**extra, field: target, f"{field}.1": {"$exists": True}},
                                [{"$set": {field: {"$let": {"vars": {"arr": f"${field}"}, "in": uniq}}}}])


def remove(c: dict, move_to: str | None = None) -> dict:
    """Xoá nhánh `c` cùng mọi nhánh con. Cả nhánh rỗng thì xoá luôn; còn dữ liệu gắn thì cần `move_to` (slug nhánh
    đích đang hiện, ngoài nhánh bị xoá) — thẻ, tài liệu, nguồn, lộ trình học… chuyển sang đó rồi mới xoá.
    Còn phạm vi quyền / chức năng tổ chức gắn nhánh thì không xoá (409) — gỡ ở trang quản trị trước."""
    subtree = list(categories.find({"$or": [{"_id": c["_id"]}, {"path": c["slug"]}]}, {"slug": 1}))
    slugs = [n["slug"] for n in subtree]
    used = usage(slugs)
    kids = f" và {len(subtree) - 1} nhánh con" if len(subtree) > 1 else ""
    if blocked := {k: n for k, n in used.items() if k in NO_MOVE}:
        detail = ", ".join(f"{n} {k}" for k, n in blocked.items())
        raise HTTPException(409, f"Nhánh '{c['slug']}'{kids} còn {detail} — gỡ ở trang quản trị trước rồi mới xoá")
    target = None
    if move_to:
        target = categories.find_one({"slug": resolve_slug(move_to.strip())})
        if not target or target["slug"] in slugs or not valid_slugs([target["slug"]]):
            raise HTTPException(400, f"Nhánh nhận dữ liệu '{move_to}' không hợp lệ — phải là nhánh đang hiện, "
                                     "nằm ngoài nhánh bị xoá")
    elif used:
        detail = ", ".join(f"{n} {k}" for k, n in used.items())
        raise HTTPException(409, f"Nhánh '{c['slug']}'{kids} còn đang dùng ({detail}) — chọn nhánh nhận dữ liệu "
                                 "(move_to) để chuyển sang rồi xoá, hoặc ẩn nhánh thay vì xoá")
    if target:
        # Bài của các khoá bị xoá nối vào cuối khoá nhận (giữ thứ tự: khoá theo cây, trong khoá theo seq) — LRN-15
        moved = [r["_id"] for s in slugs
                 for r in db.db["lessons"].find({"category": s}, {"_id": 1}).sort([("seq", 1), ("_id", 1)])]
        from .learn import courses          # import muộn: learn.routes import categories
        courses.merge_course_docs(slugs, target["slug"])
        courses.move_course_progress(slugs, target["slug"])
        for coll, field, extra in SLUG_FIELDS:
            for slug in slugs:
                _move_value(db.db[coll], field, extra, slug, target["slug"])
        courses.dedupe_course_refs()
        _dedupe(target["slug"])
        if moved:
            courses.append(moved, target["slug"])
    categories.delete_many({"_id": {"$in": [n["_id"] for n in subtree]}})
    suggestions.update_many({"parent_slug": {"$in": slugs}, "status": "pending"},
                            {"$set": {"parent_slug": target["slug"] if target else None}})
    return {"deleted": slugs, "moved_to": target["slug"] if target else None, "moved": used}


@router.delete("/{cat_id}")
def delete(cat_id: str, move_to: str | None = None, user: dict = Depends(current_user)):
    """Xoá hẳn một nhánh cùng nhánh con (mọi cấp, kể cả cấp 1). Còn dữ liệu gắn thì cần `move_to` — chuyển sang nhánh
    đó rồi xoá; không có thì 409 kèm số lượng từng loại."""
    require_edit(user)
    return {"ok": True, **remove(_get(cat_id), move_to)}


def set_active(c: dict, active: bool) -> None:
    """Ẩn nhánh -> ẩn dây chuyền nhánh con đang hiện (đánh dấu hidden_by = slug nhánh này).
    Hiện nhánh -> cần cha đang hiện; bật lại đúng các nhánh con bị ẩn THEO nó (con ẩn riêng vẫn ẩn)."""
    if active:
        if c.get("parent_id"):
            check_parent_active(categories.find_one({"_id": c["parent_id"]}))
        categories.update_one({"_id": c["_id"]}, {"$set": {"active": True}, "$unset": {"hidden_by": ""}})
        categories.update_many({"path": c["slug"], "hidden_by": c["slug"]},
                               {"$set": {"active": True}, "$unset": {"hidden_by": ""}})
    else:
        categories.update_one({"_id": c["_id"]}, {"$set": {"active": False}, "$unset": {"hidden_by": ""}})
        categories.update_many({"path": c["slug"], "active": {"$ne": False}},
                               {"$set": {"active": False, "hidden_by": c["slug"]}})


@router.get("/suggestions")
def list_suggestions(status: str = "pending", _user: dict = Depends(current_user)):
    rows = suggestions.find({"status": status}).sort("created_at", -1).limit(200)
    return [{"id": str(s["_id"]), "name": s["name"], "parent_slug": s.get("parent_slug"),
             "reason": s.get("reason", ""), "count": s.get("count", 1), "status": s["status"],
             "document_ids": [str(d) for d in s.get("document_ids", [])][:20],
             "created_at": s["created_at"]} for s in rows]


@router.post("/suggestions/{sid}/accept")
def accept_suggestion(sid: str, user: dict = Depends(current_user)):
    require_edit(user)
    s = suggestions.find_one({"_id": ObjectId(sid), "status": "pending"})
    if not s:
        raise HTTPException(404, "Không tìm thấy đề xuất")
    parent = categories.find_one({"slug": s.get("parent_slug")}) if s.get("parent_slug") else None
    if parent and parent["level"] >= MAX_LEVEL:
        parent = categories.find_one({"_id": parent["parent_id"]})
    c = _insert(s["name"], s.get("reason", ""), parent,
                categories.count_documents({"parent_id": parent["_id"] if parent else None}), created_by=user["_id"])
    suggestions.update_one({"_id": s["_id"]}, {"$set": {"status": "accepted", "category_slug": c["slug"]}})
    return {"id": str(c["_id"]), "slug": c["slug"]}


@router.post("/suggestions/{sid}/reject")
def reject_suggestion(sid: str, user: dict = Depends(current_user)):
    require_edit(user)
    suggestions.update_one({"_id": ObjectId(sid)}, {"$set": {"status": "rejected"}})
    return {"ok": True}


def record_suggestion(name: str, parent_slug: str | None, reason: str, document_id) -> None:
    """AI đề xuất lĩnh vực mới: gộp đề xuất trùng tên (không dấu) thành một mục, đếm số lần."""
    key = slugify(name)
    suggestions.update_one(
        {"key": key, "status": "pending"},
        {"$setOnInsert": {"name": name.strip(), "parent_slug": parent_slug, "reason": reason.strip(),
                          "created_at": db.now(), "status": "pending"},
         "$inc": {"count": 1}, "$addToSet": {"document_ids": document_id}},
        upsert=True,
    )
