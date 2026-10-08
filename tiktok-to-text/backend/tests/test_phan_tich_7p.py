"""Phân tích 7P của dự án marketing (BA 5.13, CE-27): nháp AI có căn cứ, sửa tay, chốt phiên bản, nạp vào prompt."""

from __future__ import annotations

from bson import ObjectId

from app import db
from app.kb.pipeline import cards
from app.studio import ai, analyses, campaigns, marketing_projects, quick, quick_pieces, worker

from .conftest import make_user
from .test_du_an import _add_space_member, _project, _space, _video

USAGE = {"input_tokens": 10, "output_tokens": 20, "model": "fake"}
SEVEN = ["product", "price", "place", "promotion", "people", "process", "physical"]


def _fake_7p(*a, **k):
    return {"summary": "VCS là xưởng gần nhà, giá rõ ràng.",
            "sections": {k: {"text": f"Nhận định {k}", "evidence": ["R1", "K1", "X9"] if k == "product" else []} for k in SEVEN},
            "open_questions": ["Giá đối thủ?"], "usage": USAGE}


def _setup(client):
    owner = make_user("owner")
    sp = _space(client, owner)
    p = _project(client, owner, sp["id"])
    url = f"/api/studio/projects/{p['id']}"
    client.post(f"{url}/resources", json={"kind": "video", "video_id": _video()})
    client.post(f"{url}/resources", json={"kind": "social_post", "channel": "fanpage", "text": "Bài mẫu dự án về bảo dưỡng mùa mưa"})
    cid = cards.insert_one({"space_id": ObjectId(sp["id"]), "type": "lesson", "title": "Thẻ ghim", "summary": "Tóm tắt",
                            "body": "Thân thẻ", "status": "approved", "search_text": "the ghim", "created_at": db.now(),
                            "updated_at": db.now()}).inserted_id
    client.post(f"{url}/cards", json={"card_id": str(cid)})
    return owner, sp, p, url


def test_ai_soan_nhap_co_can_cu_roi_chot(client, monkeypatch):
    owner, sp, p, url = _setup(client)
    monkeypatch.setattr(worker.wiki, "ai_ready", lambda: True)
    seen = []
    monkeypatch.setattr(ai, "structured_call", lambda s, c, *a, **k: seen.append(c) or _fake_7p())

    r = client.post(f"{url}/analyses", json={"mode": "ai"})
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["version"] == 1 and a["state"] == "draft" and a["status"] == "queued" and a["framework_label"] == "7P marketing"
    assert set(a["section_order"]) == set(SEVEN) and a["labels"]["physical"].startswith("Bằng chứng")

    assert worker.StudioWorker()._analysis_next()
    assert not worker.StudioWorker()._analysis_next()   # hết việc
    ctx = seen[0]
    assert "Marketing xưởng VCS" in ctx and 'ma="R1"' in ctx and 'ma="P1"' in ctx and 'ma="K1"' in ctx and "Thân thẻ" in ctx
    assert "Nhiệm vụ: lập phân tích 7P" in ctx

    a = client.get(f"{url}/analyses/{a['id']}").json()
    assert a["status"] == "idle" and a["summary"].startswith("VCS") and a["open_questions"] == ["Giá đối thủ?"]
    assert a["sections"]["product"] == {"text": "Nhận định product", "evidence": ["R1", "K1"]}   # X9 bịa -> bỏ
    assert a["usage"]["input_tokens"] == 10

    # Sửa tay: mục đúng khung, mã căn cứ phải có trong dự án
    r = client.patch(f"{url}/analyses/{a['id']}", json={"sections": {"price": {"text": "Giá niêm yết", "evidence": ["p1"]}},
                                                        "summary": "Tóm tắt sửa"})
    assert r.status_code == 200 and r.json()["sections"]["price"] == {"text": "Giá niêm yết", "evidence": ["P1"]}
    assert r.json()["sections"]["product"]["text"] == "Nhận định product"   # mục khác giữ nguyên
    assert client.patch(f"{url}/analyses/{a['id']}", json={"sections": {"price": {"text": "x", "evidence": ["R9"]}}}).status_code == 400
    assert client.patch(f"{url}/analyses/{a['id']}", json={"sections": {"swot": {"text": "x"}}}).status_code == 400

    # Chốt: chỉ chủ dự án; trở thành phân tích hiện hành; không sửa được nữa
    editor = make_user("editor")
    _add_space_member(sp["id"], editor, "editor")
    client.login(editor)
    assert client.post(f"{url}/analyses/{a['id']}/finalize").status_code == 403
    client.login(owner)
    r = client.post(f"{url}/analyses/{a['id']}/finalize")
    assert r.status_code == 200 and r.json()["state"] == "final" and r.json()["is_current"] and r.json()["finalized_by_name"] == "owner"
    assert client.get(url).json()["analysis"]["version"] == 1
    assert client.patch(f"{url}/analyses/{a['id']}", json={"summary": "x"}).status_code == 409
    assert client.delete(f"{url}/analyses/{a['id']}").status_code == 409
    assert client.post(f"{url}/analyses/{a['id']}/regenerate", json={}).status_code == 409

    # Phiên bản mới là nháp v2, bản 1 vẫn hiện hành cho tới khi chốt v2
    v2 = client.post(f"{url}/analyses", json={"mode": "blank"}).json()
    assert v2["version"] == 2 and v2["status"] == "idle" and not v2["is_current"]
    assert client.post(f"{url}/analyses/{v2['id']}/finalize").status_code == 400   # còn trống
    items = client.get(f"{url}/analyses").json()["items"]
    assert [x["version"] for x in items] == [2, 1] and "sections" not in items[0]
    assert client.delete(f"{url}/analyses/{v2['id']}").status_code == 204


def test_chien_dich_va_viet_nhanh_nap_phan_tich_da_chot(client, monkeypatch):
    owner, sp, p, url = _setup(client)
    a = client.post(f"{url}/analyses", json={"mode": "blank"}).json()
    client.patch(f"{url}/analyses/{a['id']}", json={"summary": "Định vị: xưởng gần nhà",
                                                    "sections": {"price": {"text": "Giá niêm yết công khai", "evidence": ["P1"]}}})
    client.post(f"{url}/analyses/{a['id']}/finalize")

    brief = {"name": "CD", "product": "Bảo dưỡng", "goal": "Khách mới", "audience": "Chủ xe", "weeks": 1, "posts_per_week": 1}
    c = client.post("/api/studio/campaigns", json={"project_id": p["id"], "flows": ["video"], "brief": brief,
                                                   "references": {"q": "", "channel": "", "tag": "", "limit": 12}}).json()
    assert c["analysis_id"] == a["id"]
    camp = campaigns.find_one({"_id": ObjectId(c["id"])})
    inputs = worker.load_inputs(camp)
    assert inputs["analysis"]["version"] == 1
    seen = []
    monkeypatch.setattr(ai, "structured_call", lambda s, content, *x, **k: seen.append(content) or {"usage": USAGE})
    ai.generate_strategy(camp, inputs)
    assert '<phan_tich_du_an khung="7P marketing" phien_ban="1">' in seen[0]
    assert "Giá (Price): Giá niêm yết công khai [căn cứ: P1]" in seen[0] and "Định vị: xưởng gần nhà" in seen[0]
    assert "Sản phẩm (Product)" not in seen[0]   # mục trống không đưa vào

    # Viết nhanh trong dự án: bối cảnh có phân tích
    q = client.post("/api/studio/quick", json={"project_id": p["id"], "type": "ideas", "inputs": {"topic": "Mùa mưa"}}).json()
    assert q["analysis_id"] == a["id"]
    qp = quick_pieces.find_one({"_id": ObjectId(q["id"])})
    assert "Giá niêm yết công khai" in quick.context(qp, [], None)

    # Chốt phiên bản 2 sau đó: chiến dịch cũ vẫn dùng bản 1
    v2 = client.post(f"{url}/analyses", json={"mode": "blank"}).json()
    client.patch(f"{url}/analyses/{v2['id']}", json={"sections": {"price": {"text": "Giá mới", "evidence": []}}})
    client.post(f"{url}/analyses/{v2['id']}/finalize")
    assert marketing_projects.find_one({"_id": ObjectId(p["id"])})["analysis_id"] == ObjectId(v2["id"])
    assert worker.load_inputs(camp)["analysis"]["version"] == 1
    assert analyses.count_documents({"state": "final"}) == 2


def test_quyen_va_dieu_kien_tao(client):
    owner, sp, p, url = _setup(client)
    viewer, outsider = make_user("viewer"), make_user("outsider")
    _add_space_member(sp["id"], viewer, "viewer")
    client.login(viewer)
    assert client.get(f"{url}/analyses").status_code == 200
    assert client.post(f"{url}/analyses", json={"mode": "blank"}).status_code == 403
    client.login(outsider)
    assert client.get(f"{url}/analyses").status_code == 404
    # Dự án trống hoàn toàn thì AI không có gì để phân tích
    client.login(owner)
    empty = client.post("/api/studio/projects", json={"space_id": sp["id"], "name": "Trống", "goal": ""}).json()
    assert client.post(f"/api/studio/projects/{empty['id']}/analyses", json={"mode": "ai"}).status_code == 400
    assert client.post(f"/api/studio/projects/{empty['id']}/analyses", json={"mode": "blank"}).status_code == 201
