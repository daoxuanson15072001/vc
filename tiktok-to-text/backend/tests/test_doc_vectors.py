"""Tìm tầng thô theo nghĩa (kb/doc_vectors.py): Qdrant giả trong bộ nhớ + embedding giả (tests/test_semantic_search.py),
không cần Qdrant / Ollama thật."""

from __future__ import annotations

import json
import math
import re
from types import SimpleNamespace

import pytest
from bson import ObjectId

from app import auth, mcp_server
from app.kb import doc_vectors as dv
from app.kb import embeddings
from app.spaces import personal_space
from tests.conftest import make_user
from tests.test_semantic_search import fake_embed


class FakeQdrant:
    """Đủ các lệnh REST doc_vectors dùng: collection, index, points (ghi / xoá / scroll / query/groups có prefetch +
    RRF). Vector thưa chấm bằng tích vô hướng (không IDF)."""

    def __init__(self):
        self.params = None
        self.points: dict[str, dict] = {}

    @staticmethod
    def _ok(p: dict, flt: dict | None) -> bool:
        for c in (flt or {}).get("must", []):
            v, m = p["payload"].get(c["key"]), c["match"]
            if ("value" in m and v != m["value"]) or ("any" in m and v not in m["any"]):
                return False
        for c in (flt or {}).get("must_not", []):
            v, m = p["payload"].get(c["key"]), c["match"]
            if ("value" in m and v == m["value"]) or ("any" in m and v in m["any"]):
                return False
        return True

    def _rank(self, q: dict, flt) -> list[tuple[float, dict]]:
        out = []
        for p in self.points.values():
            if not self._ok(p, flt) or q["using"] not in p["vector"]:
                continue
            v = p["vector"][q["using"]]
            if q["using"] == dv.DENSE:
                a = q["query"]
                s = sum(x * y for x, y in zip(a, v)) / (math.sqrt(sum(x * x for x in a)) or 1) / (
                    math.sqrt(sum(x * x for x in v)) or 1)
                if s < q.get("score_threshold", -1):
                    continue
            else:
                w = dict(zip(v["indices"], v["values"]))
                s = sum(w.get(i, 0) * x for i, x in zip(q["query"]["indices"], q["query"]["values"]))
                if s <= 0:
                    continue
            out.append((s, p))
        return sorted(out, key=lambda x: -x[0])[:q.get("limit", 10 ** 9)]

    def __call__(self, method: str, path: str, body: dict | None = None, ok404: bool = False):
        path = path.split("?")[0].removeprefix(f"/collections/{dv.COLLECTION}")
        if path == "":
            if method == "GET":
                return None if self.params is None else {"config": {"params": self.params}}
            if method == "PUT":
                self.params = {"vectors": body["vectors"], "sparse_vectors": body.get("sparse_vectors")}
            if method == "DELETE":
                self.params, self.points = None, {}
            return True
        if self.params is None:
            return None
        if path == "/index":
            return True
        if path == "/points" and method == "PUT":
            for p in body["points"]:
                assert len(p["vector"][dv.DENSE]) == self.params["vectors"][dv.DENSE]["size"]
                assert p["vector"].get(dv.SPARSE, {"indices": [0]})["indices"], "Qdrant không nhận vector thưa rỗng"
                self.points[p["id"]] = p
            return True
        if path == "/points/delete":
            self.points = {k: p for k, p in self.points.items() if not self._ok(p, body["filter"])}
            return True
        if path == "/points/scroll":
            want = body.get("with_vector")
            hits = [{"id": k, "payload": p["payload"]} | ({"vector": {n: p["vector"][n] for n in want}} if want else {})
                    for k, p in self.points.items() if self._ok(p, body["filter"])]
            return {"points": hits, "next_page_offset": None}
        if path == "/points/query/batch":
            return [{"points": [{"id": p["id"], "score": sc, "payload": p["payload"]}
                                for sc, p in self._rank(q, q.get("filter"))]} for q in body["searches"]]
        if path == "/points/query/groups":
            flt = body.get("filter")
            if "prefetch" in body:
                assert body["query"] == {"fusion": "rrf"}
                fused: dict[str, float] = {}
                pts = {}
                for pre in body["prefetch"]:
                    for r, (_, p) in enumerate(self._rank(pre, pre.get("filter"))):
                        fused[p["id"]] = fused.get(p["id"], 0) + 1 / (r + 2)
                        pts[p["id"]] = p
                scored = sorted(((sc, pts[i]) for i, sc in fused.items() if self._ok(pts[i], flt)), key=lambda x: -x[0])
            else:
                scored = self._rank(body, flt)
            groups: dict[str, list] = {}
            for s, p in scored:
                g = groups.setdefault(p["payload"][body["group_by"]], [])
                if len(g) < body["group_size"]:
                    g.append({"score": s, "payload": p["payload"]})
            return {"groups": [{"id": k, "hits": h} for k, h in list(groups.items())[:body["limit"]]]}
        raise AssertionError(f"lệnh Qdrant lạ: {method} {path}")


@pytest.fixture(autouse=True)
def fake_stack(monkeypatch):
    fake = FakeQdrant()
    monkeypatch.setattr(dv, "_q", fake)
    monkeypatch.setattr(dv, "up", lambda fresh=False: True)
    monkeypatch.setattr(dv, "ENABLED", True)
    monkeypatch.setattr(dv, "HYBRID", True)
    monkeypatch.setattr(dv, "_sparse", None)
    monkeypatch.setattr(embeddings, "ENABLED", True)
    monkeypatch.setattr(embeddings, "ready", lambda: True)
    monkeypatch.setattr(embeddings, "_down_until", 0.0)
    monkeypatch.setattr(dv.local_ai, "embed", fake_embed)
    monkeypatch.setattr(embeddings.local_ai, "embed", fake_embed)
    embeddings._queries.clear()
    return fake


def add_doc(space, title: str, text: str, status: str = "skipped") -> dict:
    d = {"_id": ObjectId(), "title": title, "text": text, "source_id": ObjectId(), "space_id": space["_id"],
         "wiki_status": status, "chars": len(text)}
    dv.documents.insert_one(d)
    return d


def test_split_covers_text_with_overlap():
    text = " ".join(f"Câu số {i} nói về bảo dưỡng xe." for i in range(400))
    parts = dv.split(text)
    assert len(parts) > 5
    assert all(len(p) <= dv.CHUNK_CHARS for _, p in parts)
    for (s1, p1), (s2, _) in zip(parts, parts[1:]):
        assert s1 < s2 < s1 + len(p1)                        # gối nhau, không hụt đoạn nào
    assert parts[-1][1].endswith("xe.")
    assert [p for _, p in dv.split("ngắn")] == ["ngắn"]
    assert dv.split("   ") == []


def test_index_is_idempotent_and_replaces_changed_docs(fake_stack):
    u = make_user("a")
    sp = personal_space(u)
    d = add_doc(sp, "Thay dầu", "Dầu động cơ nên thay sau 10.000 km. " * 100)
    assert dv.index_documents([d]) > 1
    n = len(fake_stack.points)
    assert dv.indexed() == {str(d["_id"]): dv.doc_hash(d)}
    assert dv.index_documents([d]) == n and len(fake_stack.points) == n   # nạp lại: thay, không nhân đôi
    d["text"] = "Ngắn thôi."
    dv.index_documents([d])
    assert len(fake_stack.points) == 1                                  # đoạn thừa của bản cũ bị xoá
    dv.delete_documents([d["_id"]])
    assert dv.indexed() == {}


def test_search_by_meaning_filters_scope_and_status(client):
    a, b = make_user("a"), make_user("b")
    sa, sb = personal_space(a), personal_space(b)
    oil = add_doc(sa, "Bảo dưỡng", "Mở đầu chung chung. " * 80 + "Nhớt tổng hợp dùng được lâu hơn nhớt khoáng.")
    add_doc(sa, "Khách hàng", "Xử lý phàn nàn của khách trong 24 giờ.")
    other = add_doc(sb, "Kho người khác", "Dầu nhớt của kho B.")
    done = add_doc(sa, "Đã tinh chế", "Chu kỳ thay dầu.", status="done")
    dv.index_documents([oil, other, done] + list(dv.documents.find({"title": "Khách hàng"})))

    client.login(a)
    r = client.get("/api/kb/documents/semantic", params={"q": "bao lâu đổi dầu"})
    assert r.status_code == 200, r.text
    res = r.json()
    ids = [x["id"] for x in res["items"]]
    assert res["available"] and str(oil["_id"]) in ids and str(done["_id"]) in ids
    assert str(other["_id"]) not in ids                                  # kho không có quyền
    assert all("text" not in x for x in res["items"])
    hit = next(x for x in res["items"] if x["id"] == str(oil["_id"]))
    assert "Nhớt" in hit["passages"][0]["text"] and hit["passages"][0]["start"] > 0   # trỏ đúng đoạn trong văn bản

    r = client.get("/api/kb/documents/semantic", params={"q": "bao lâu đổi dầu", "status": "skipped"})
    assert [x["id"] for x in r.json()["items"]] == [str(oil["_id"])]     # chỉ tài liệu chưa tinh chế


def test_unavailable_when_qdrant_down(client, monkeypatch):
    client.login(make_user("a"))
    monkeypatch.setattr(dv, "up", lambda fresh=False: False)
    r = client.get("/api/kb/documents/semantic", params={"q": "dầu"})
    assert r.json() == {"available": False, "items": []}


def test_mcp_search_documents():
    a = make_user("a")
    oil = add_doc(personal_space(a), "Bảo dưỡng", "Nhớt nên thay định kỳ.")
    dv.index_documents([oil])
    token, _ = auth.issue_api_token(a, "test")
    ctx = SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "claude-code/test"})
    out = json.loads(mcp_server.search_documents(ctx, query="đổi dầu"))
    assert out["available"] and out["items"][0]["id"] == str(oil["_id"])
    assert out["items"][0]["passages"][0]["text"] == "Nhớt nên thay định kỳ."


def test_keyword_branch_works_without_local_ai(monkeypatch):
    """AI local tắt: vẫn tìm được theo từ khoá (vector thưa), không dấu."""
    sp = personal_space(make_user("a"))
    oil = add_doc(sp, "Bảo dưỡng", "Lịch bảo dưỡng định kỳ cho xe tải.")
    add_doc(sp, "Khác", "Chuyện hoàn toàn khác.")
    dv.index_documents(list(dv.documents.find({})))
    monkeypatch.setattr(embeddings, "ready", lambda: False)
    res = dv.search({}, "bao duong dinh ky")
    assert [d["_id"] for d in res] == [oil["_id"]]


def test_rerank_reorders_documents(monkeypatch):
    sp = personal_space(make_user("a"))
    a = add_doc(sp, "Dầu A", "Dầu nhớt loại A.")
    b = add_doc(sp, "Dầu B", "Dầu nhớt loại B, thay định kỳ.")
    dv.index_documents([a, b])
    monkeypatch.setattr(dv.rerank, "score", lambda q, texts: [0.9 if "loại B" in t else 0.1 for t in texts])
    res = dv.search({}, "dầu nhớt")
    assert [d["_id"] for d in res] == [b["_id"], a["_id"]]
    assert res[0]["rerank_score"] == 0.9 and res[0]["passages"][0]["rerank_score"] == 0.9
    monkeypatch.setattr(dv, "RERANK_MIN", 0.5)
    assert [d["_id"] for d in dv.search({}, "dầu nhớt")] == [b["_id"]]      # dưới ngưỡng rerank thì bỏ
    monkeypatch.setattr(dv.rerank, "score", lambda q, texts: None)          # reranker hỏng: vẫn trả kết quả
    assert {d["_id"] for d in dv.search({}, "dầu nhớt")} == {a["_id"], b["_id"]}


def test_old_dense_only_collection_is_rebuilt(fake_stack):
    """Collection bản cũ (một vector không tên, chưa có vector thưa) -> xoá tạo lại theo cấu trúc mới."""
    fake_stack.params = {"vectors": {"size": 66}, "sparse_vectors": None}
    fake_stack.points = {"x": {"id": "x", "vector": {}, "payload": {"document_id": "cu"}}}
    d = add_doc(personal_space(make_user("a")), "Dầu", "Dầu nhớt.")
    dv.index_documents([d])
    assert dv.SPARSE in fake_stack.params["sparse_vectors"] and "x" not in fake_stack.points


def test_fuse_weighted_rrf_marks_match_and_merges_passages():
    hit = (lambda start, sc: {"score": sc, "payload": {"start": start, "text": f"đoạn {start}"}})
    branches = {"dense": [{"id": "a", "hits": [hit(0, 0.8), hit(1500, 0.7)]}, {"id": "b", "hits": [hit(0, 0.6)]}],
                "sparse": [{"id": "c", "hits": [hit(300, 9.0)]}, {"id": "a", "hits": [hit(1500, 4.0)]}]}
    out = dv.fuse(branches, {"dense": 1.0, "sparse": 1.0})
    assert [x[0] for x in out] == ["a", "c", "b"]                            # 1/61+1/62 > 1/61 (c) > 1/62 (b)
    a = next(x for x in out if x[0] == "a")
    assert a[2] == "both"
    assert a[3][0]["start"] == 1500 and a[3][0]["match"] == "both"            # đoạn khớp cả hai nhánh lên đầu
    assert a[3][0]["semantic_score"] == 0.7 and a[3][0]["text_score"] == 4.0
    assert {x[0]: x[2] for x in out} == {"a": "both", "b": "dense", "c": "sparse"}
    heavy = dv.fuse(branches, {"dense": 2.0, "sparse": 1.0})
    assert [x[0] for x in heavy] == ["a", "b", "c"]                          # trọng số nghĩa kéo b lên trên c


def _code_docs():
    sp = personal_space(make_user("a"))
    code = add_doc(sp, "Phụ tùng", "Mã lọc gió 17801-0Y040 cho Vios.")
    meaning = add_doc(sp, "Bảo dưỡng", "Nhớt nên thay định kỳ.")
    dv.index_documents([code, meaning])
    return code, meaning


def test_hybrid_off_is_dense_only(fake_stack, monkeypatch):
    """RAW_HYBRID=0 hoặc collection chưa có vector thưa: không gửi truy vấn thưa, chỉ tìm theo nghĩa như trước."""
    code, meaning = _code_docs()
    sent = []
    real = fake_stack.__call__
    monkeypatch.setattr(dv, "_q", lambda m, p, b=None, ok404=False: (sent.append(b), real(m, p, b, ok404))[1])
    on = dv.search({}, "17801-0Y040")
    assert code["_id"] in [d["_id"] for d in on]
    assert next(d for d in on if d["_id"] == code["_id"])["match"] in ("sparse", "both")
    monkeypatch.setattr(dv, "HYBRID", False)
    sent.clear()
    off = dv.search({}, "đổi dầu")
    assert all((b or {}).get("using") != dv.SPARSE for b in sent)
    assert [d["_id"] for d in off] == [meaning["_id"]] and off[0]["match"] == "dense"
    assert off[0]["passages"][0]["match"] == "dense" and off[0]["passages"][0]["text_score"] is None
    monkeypatch.setattr(dv, "HYBRID", True)
    fake_stack.params["sparse_vectors"] = None                          # collection bản cũ, chưa có vector thưa
    monkeypatch.setattr(dv, "_sparse", None)
    sent.clear()
    assert [d["_id"] for d in dv.search({}, "đổi dầu")] == [meaning["_id"]]
    assert all((b or {}).get("using") != dv.SPARSE for b in sent)


@pytest.mark.parametrize("ai_on", [True, False])
def test_sparse_branch_never_leaks_out_of_scope(client, monkeypatch, ai_on):
    """Tài liệu ngoài phạm vi quyền (kho người khác, tài liệu kho mình đã lọc trạng thái) không lộ qua nhánh từ khoá,
    kể cả khi chỉ còn nhánh này (AI local tắt) và khi khớp nguyên mã hiếm."""
    a, b = make_user("a"), make_user("b")
    mine = add_doc(personal_space(a), "Của mình", "Bảng giá lọc gió 17801-0Y040.")
    theirs = add_doc(personal_space(b), "Kho B", "Mã 17801-0Y040 bí mật của kho B. 17801-0Y040 17801-0Y040")
    done = add_doc(personal_space(a), "Đã tinh chế", "17801-0Y040", status="done")
    dv.index_documents([mine, theirs, done])
    monkeypatch.setattr(embeddings, "ready", lambda: ai_on)
    monkeypatch.setattr(dv, "_space_filter", lambda f: None)            # dù Qdrant không lọc kho gì, Mongo vẫn chặn
    client.login(a)
    r = client.get("/api/kb/documents/semantic", params={"q": "17801-0Y040"})
    ids = [x["id"] for x in r.json()["items"]]
    assert str(mine["_id"]) in ids and str(theirs["_id"]) not in ids
    r = client.get("/api/kb/documents/semantic", params={"q": "17801-0Y040", "status": "skipped"})
    assert [x["id"] for x in r.json()["items"]] == [str(mine["_id"])]


# --- mốc thời gian của đoạn khớp (WK-35): FE tua video tới đúng giây ---

VIDEO_TEXT = ("## Lời nói\n\n"
              "[00:00] Chào các bạn, hôm nay nói về xe.\n"
              "[00:25] Đầu tiên là lốp xe và áp suất lốp.\n"
              "[01:10] Tiếp theo là dầu nhớt động cơ, thay sau 5000 km.\n"
              "[1:02:03] Cuối cùng là phanh đĩa và má phanh.\n")


def test_passage_time_picks_last_mark_before_start():
    t = VIDEO_TEXT
    assert dv.time_marks(t) == [(t.index("[00:00]"), 0), (t.index("[00:25]"), 25), (t.index("[01:10]"), 70),
                                (t.index("[1:02:03]"), 3723)]
    assert dv.passage_time(t, t.index("[01:10]"), 40) == 70                 # đoạn bắt đầu đúng tại mốc
    assert dv.passage_time(t, t.index("dầu nhớt"), 40) == 70                # giữa hai mốc -> mốc đứng trước
    assert dv.passage_time(t, t.index("phanh đĩa"), 20) == 3723             # định dạng h:mm:ss
    assert dv.passage_time(t, 0, 30) == 0                                   # đoạn trước mốc đầu tiên -> mốc đầu trong đoạn
    assert dv.passage_time(t, t.index("[00:25]") - 1, 40) == 25            # khoảng trắng đầu đoạn không tính
    assert dv.passage_time("Bài viết không có mốc nào.", 3, 10) is None
    assert dv.passage_time("", 0) is None
    assert dv.passage_time("Mở đầu dài.\n\nChưa có mốc.\n[00:09] câu", 0, 5) is None   # trước mốc đầu, đoạn không chứa mốc
    assert dv.passage_time("Mở đầu dài.\n\nChưa có mốc.\n[00:09] câu", 0, 60) == 9     # đoạn chứa mốc đầu tiên


def test_passage_time_does_not_cross_heading():
    t = VIDEO_TEXT + "\n## Lời nói (dịch tiếng Việt)\n\n[00:05] Hello, today about cars.\n"
    assert dv.passage_time(t, t.index("## Lời nói (dịch"), 80) == 5        # mốc của mục trước không dùng


def test_search_returns_passage_time(client):
    a = make_user("a")
    sp = personal_space(a)
    vid = add_doc(sp, "Video bảo dưỡng", VIDEO_TEXT)
    plain = add_doc(sp, "Bài viết", "Dầu nhớt động cơ cần thay sau 5000 km, không có mốc thời gian.")
    dv.index_documents([vid, plain])
    client.login(a)
    items = client.get("/api/kb/documents/semantic", params={"q": "dầu nhớt"}).json()["items"]
    by = {x["id"]: x for x in items}
    assert by[str(vid["_id"])]["passages"][0]["time"] == 0                   # văn bản ngắn: 1 đoạn từ đầu
    assert by[str(plain["_id"])]["passages"][0]["time"] is None
    assert by[str(vid["_id"])]["space_name"] == sp["name"] and "source_title" in by[str(vid["_id"])]
    assert all("text" not in x for x in items)                              # văn bản gốc chỉ đọc để tính, không trả ra


def test_search_time_in_long_video_and_mcp():
    a = make_user("a")
    lines = [f"[{i // 60:02d}:{i % 60:02d}] Câu chuyện chung chung số {i} về cửa hàng." for i in range(0, 600, 5)]
    lines[90] = "[07:30] Má phanh mòn thì phải thay ngay, kiểm tra đĩa phanh."
    d = add_doc(personal_space(a), "Video dài", "\n".join(lines))
    dv.index_documents([d])
    res = dv.search({}, "má phanh mòn")
    assert res and res[0]["passages"]
    for p in res[0]["passages"]:                                        # mốc mỗi 5 giây, mỗi dòng một mốc
        mm, ss = re.search(r"\[(\d\d):(\d\d)\]", p["text"]).groups()      # đoạn trả ra đã gộp dòng
        first = int(mm) * 60 + int(ss)
        assert p["time"] == (first if p["text"].startswith("[") else first - 5)
    token, _ = auth.issue_api_token(a, "test")
    ctx = SimpleNamespace(headers={"authorization": f"Bearer {token}", "user-agent": "claude-code/test"})
    out = json.loads(mcp_server.search_documents(ctx, query="má phanh mòn"))
    assert all("time" in p for p in out["items"][0]["passages"])            # MCP search_documents cũng có `time`
