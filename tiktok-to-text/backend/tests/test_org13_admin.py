"""ORG-13 — tách quản trị hệ thống khỏi quyền đọc nội dung (docs/BA.md mục 6.1, 15.9).

`admin` quản lý được người dùng và cây lĩnh vực, nhưng KHÔNG đọc được kho cá nhân / kho riêng của người khác qua
bất kỳ đường nào: API thẻ / nguồn / tài liệu, danh sách, tìm kiếm, bản đồ tri thức, xuất vault, số liệu tổng quan,
đếm theo lĩnh vực, tinh chế, tag, cuộc trò chuyện với Claude.
"""

from __future__ import annotations

import io
import zipfile

import pytest
from bson import ObjectId

from app import db
from app.spaces import personal_space, spaces
from tests.conftest import make_user

SECRET = "Bí mật riêng của An"


@pytest.fixture
def setup(client):
    admin, an = make_user("admin", role="admin"), make_user("an")
    client.login(admin)
    cat = client.post("/api/categories", json={"name": "Kỹ thuật riêng"}).json()["slug"]

    # kho cá nhân + một kho chia sẻ riêng (không công khai) của An
    pa = personal_space(an)
    shared = {"name": "Kho nhóm An", "description": "", "type": "shared", "owner_id": an["_id"],
              "visibility": "private", "created_at": db.now(),
              "members": [{"user_id": an["_id"], "role": "owner", "added_at": db.now()}]}
    shared["_id"] = spaces.insert_one(shared).inserted_id

    client.login(an)
    out = {"admin": admin, "an": an, "cat": cat, "spaces": [pa, shared], "cards": [], "sources": [], "docs": []}
    for sp in (pa, shared):
        r = client.post("/api/kb/sources/links", json={"space_id": str(sp["_id"]),
                                                       "urls": [f"https://example.com/{sp['_id']}"]})
        assert r.status_code == 201, r.text
        sid = r.json()["created"][0]
        src = db.db["kb_sources"].find_one({"_id": ObjectId(sid)})
        doc = {"source_id": src["_id"], "space_id": sp["_id"], "title": f"{SECRET} — tài liệu", "text": SECRET,
               "wiki_status": "pending", "chars": len(SECRET), "created_at": db.now()}
        doc["_id"] = db.db["kb_documents"].insert_one(doc).inserted_id
        r = client.post("/api/wiki/cards", json={"space_id": str(sp["_id"]), "type": "concept",
                                                 "title": f"{SECRET} — thẻ", "summary": SECRET,
                                                 "categories": [cat], "tags": ["bi-mat"]})
        assert r.status_code == 201, r.text
        out["cards"].append(r.json()["id"])
        out["sources"].append(sid)
        out["docs"].append(str(doc["_id"]))
    # một cuộc trò chuyện với Claude của An
    t = {"user_id": an["_id"], "title": SECRET, "message_count": 0, "cost_usd": 0, "claude_session_id": None,
         "search_text": "", "created_at": db.now(), "updated_at": db.now()}
    out["thread"] = str(db.db["chat_threads"].insert_one(t).inserted_id)
    return out


def test_owner_still_reads_own_content(client, setup):
    """Đối chứng: chính An đọc được — để các ca 404 bên dưới có nghĩa."""
    client.login(setup["an"])
    assert client.get(f"/api/wiki/cards/{setup['cards'][0]}").status_code == 200
    assert client.get(f"/api/kb/documents/{setup['docs'][1]}").status_code == 200
    assert client.get(f"/api/chat/threads/{setup['thread']}").status_code == 200


def test_admin_cannot_open_items_in_private_spaces(client, setup):
    client.login(setup["admin"])
    for cid in setup["cards"]:
        r = client.get(f"/api/wiki/cards/{cid}")
        assert (r.status_code, r.json()["detail"]) == (404, "Không tìm thấy thẻ")
        assert client.get(f"/api/wiki/cards/{cid}/comments").status_code == 404
        assert client.patch(f"/api/wiki/cards/{cid}", json={"title": "x"}).status_code == 404
    for sid in setup["sources"]:
        r = client.get(f"/api/kb/sources/{sid}")
        assert (r.status_code, r.json()["detail"]) == (404, "Không tìm thấy nguồn")
        assert client.get(f"/api/kb/sources/{sid}/raw/x.txt").status_code == 404
    for did in setup["docs"]:
        r = client.get(f"/api/kb/documents/{did}")
        assert (r.status_code, r.json()["detail"]) == (404, "Không tìm thấy tài liệu")
    for sp in setup["spaces"]:
        r = client.get(f"/api/spaces/{sp['_id']}")
        assert (r.status_code, r.json()["detail"]) == (404, "Không tìm thấy kho")
        for path in ("/api/wiki/cards", "/api/kb/sources", "/api/wiki/graph", "/api/kb/refine/documents",
                     "/api/wiki/tags"):
            assert client.get(path, params={"space_id": str(sp["_id"])}).status_code == 404, path


def test_admin_lists_and_aggregates_exclude_private_content(client, setup):
    client.login(setup["admin"])
    ids = {str(s["_id"]) for s in setup["spaces"]}
    assert not ids & {s["id"] for s in client.get("/api/spaces").json()}
    assert client.get("/api/wiki/cards", params={"q": "bi mat"}).json()["total"] == 0
    assert client.get("/api/kb/sources").json()["total"] == 0
    assert client.get("/api/kb/refine/documents").json()["total"] == 0
    assert "bi-mat" not in client.get("/api/wiki/tags").json()
    assert client.get("/api/wiki/graph").json()["nodes"] == []
    st = client.get("/api/stats").json()
    assert (st["cards"], st["sources"], st["recent_sources"]) == (0, 0, [])
    cats = {c["slug"]: c["card_count"] for c in client.get("/api/categories").json()}
    assert cats[setup["cat"]] == 0
    assert SECRET not in client.get("/api/studio/wiki-cards", params={"q": SECRET}).text
    r = client.get("/api/wiki/graph/vault.zip")
    assert (r.status_code, r.json()["detail"]) == (404, "Không có thẻ nào trong phạm vi để xuất")
    # admin có thẻ của mình thì vault chỉ chứa thẻ đó
    own = client.post("/api/wiki/cards", json={"type": "concept", "title": "Thẻ của admin"})
    assert own.status_code == 201, own.text
    z = zipfile.ZipFile(io.BytesIO(client.get("/api/wiki/graph/vault.zip").content))
    assert not any(SECRET in z.read(n).decode("utf-8", "ignore") for n in z.namelist())


def test_admin_cannot_read_others_chat(client, setup):
    client.login(setup["admin"])
    r = client.get(f"/api/chat/threads/{setup['thread']}")
    assert (r.status_code, r.json()["detail"]) == (404, "Không tìm thấy cuộc trò chuyện")
    items = client.get("/api/chat/threads", params={"all": "true"}).json()["items"]
    assert setup["thread"] not in {t["id"] for t in items}


def test_admin_still_manages_users_and_categories(client, setup):
    client.login(setup["admin"])
    r = client.post("/api/users", json={"email": "moi@test.local", "name": "Người mới", "password": "mat-khau-moi-1"})
    assert r.status_code == 201, r.text
    r = client.patch(f"/api/users/{setup['an']['_id']}", json={"active": False})
    assert r.status_code == 200, r.text
    r = client.post("/api/categories", json={"name": "Lĩnh vực mới"})
    assert r.status_code == 201, r.text
    cat = next(c for c in client.get("/api/categories").json() if c["slug"] == r.json()["slug"])
    assert client.patch(f"/api/categories/{cat['id']}", json={"name": "Đổi tên"}).status_code == 200
    # thành viên thường không làm được việc quản trị người dùng (cây lĩnh vực thì được — test_linh_vuc_crud.py)
    client.login(make_user("thuong"))
    assert client.post("/api/users", json={"email": "x@test.local", "name": "X",
                                           "password": "mat-khau-moi-1"}).status_code == 403
