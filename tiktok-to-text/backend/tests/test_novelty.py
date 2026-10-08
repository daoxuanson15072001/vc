"""Cổng so sánh (GOV-03 — docs/BA.md mục 16.2). Chạy không cần mạng: `structured_call` và embedding đều được giả lập.
Đánh giá với AI thật: backend/scripts/eval_novelty.py."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from bson import ObjectId

from app import db
from app.kb import local_ai, novelty, wiki
from app.kb.pipeline import card_search_text, cards
from app.spaces import personal_space, spaces
from tests.conftest import make_user

CASES = json.loads((Path(__file__).parent / "data" / "novelty_cases.json").read_text(encoding="utf-8"))["cases"]


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """Mặc định: không AI, không embedding — từng test tự bật cái mình cần."""
    monkeypatch.setattr(novelty, "_embed_ready", lambda: False)
    monkeypatch.setattr(novelty, "NOVELTY_ENGINE", "auto")
    monkeypatch.setattr(wiki, "ai_ready", lambda: False)
    monkeypatch.setattr(local_ai, "ready", lambda: False)
    novelty._embed_cache.clear()


def add_card(space: dict, title: str, summary: str = "", body: str = "", status: str = "approved", **extra) -> dict:
    doc = {"space_id": space["_id"], "title": title, "summary": summary, "body": body, "key_points": [],
           "tags": [], "categories": [], "status": status, "type": "lesson", "created_at": db.now(),
           "updated_at": db.now()} | extra
    doc["search_text"] = card_search_text(doc)
    doc["_id"] = cards.insert_one(doc).inserted_id
    return doc


def shared_space(owner: dict, visibility: str = "private") -> dict:
    doc = {"name": "Kho chung", "type": "shared", "owner_id": owner["_id"], "visibility": visibility,
           "members": [{"user_id": owner["_id"], "role": "owner"}], "created_at": db.now()}
    doc["_id"] = spaces.insert_one(doc).inserted_id
    return doc


OIL = ("Chu kỳ thay dầu động cơ xe con",
       "Dầu khoáng thay sau 5.000 km, dầu tổng hợp thay sau 10.000 km hoặc 6 tháng.",
       "Thay lọc dầu cùng lúc thay dầu.")
DRAFT_OIL = {"title": "Chu kỳ thay dầu động cơ cho xe con",
             "summary": "Dầu khoáng thay sau 5.000 km, dầu tổng hợp thay sau 10.000 km hoặc 6 tháng.",
             "body": "Nhớ thay lọc dầu cùng lúc thay dầu."}


# ---------------------------------------------------------------------------
# Tìm ứng viên: phạm vi, trạng thái, bỏ chính nó
# ---------------------------------------------------------------------------

def test_candidates_only_visible_spaces():
    a, b = make_user("a"), make_user("b")
    mine = add_card(personal_space(a), *OIL)
    add_card(personal_space(b), *OIL)                              # kho riêng của người khác
    org_card = add_card(shared_space(b, visibility="org"), *OIL)   # kho cả công ty xem được
    got = {c["card"]["_id"] for c in novelty.find_candidates(DRAFT_OIL, a)}
    assert got == {mine["_id"], org_card["_id"]}


def test_candidates_status_obsolete_and_self():
    a = make_user("a")
    s = personal_space(a)
    ok = add_card(s, *OIL)
    draft_card = add_card(s, *OIL, status="draft")
    add_card(s, *OIL, status="rejected")
    add_card(s, *OIL, obsolete={"at": db.now(), "reason": "thay bằng thẻ khác"})
    got = [c["card"]["_id"] for c in novelty.find_candidates(DRAFT_OIL, a)]
    assert got == [ok["_id"]]                                     # chỉ thẻ đã duyệt, còn hiệu lực
    # cho phép thẻ nháp: vẫn không tự so với chính nó
    me = cards.find_one({"_id": draft_card["_id"]})
    other_draft = add_card(s, *OIL, status="draft")
    got = {c["card"]["_id"] for c in novelty.find_candidates(me, a, include_drafts=True)}
    assert got == {ok["_id"], other_draft["_id"]}


def test_text_search_ranks_and_limits():
    a = make_user("a")
    s = personal_space(a)
    best = add_card(s, *OIL)
    add_card(s, "Thay lọc gió động cơ", "Lọc gió thay mỗi 20.000 km.")
    for i in range(12):
        add_card(s, f"Thay dầu hộp số {i}", "Dầu hộp số tự động thay sau 40.000 km.")
    add_card(s, "Chúc mừng năm mới", "Kính chúc quý khách an khang.")
    res = novelty.find_candidates(DRAFT_OIL, a)
    assert len(res) == 10
    assert res[0]["card"]["_id"] == best["_id"] and res[0]["method"] == "text"
    assert res[0]["score"] > 0.6 and res[0]["score"] == res[0]["text_score"]
    assert [r["score"] for r in res] == sorted((r["score"] for r in res), reverse=True)
    assert len(novelty.find_candidates(DRAFT_OIL, a, limit=3)) == 3


def test_text_search_ignores_accents():
    a = make_user("a")
    card = add_card(personal_space(a), "Bảo quản ắc quy tồn kho", "Sạc bổ sung 3 tháng một lần.")
    res = novelty.find_candidates({"title": "bao quan ac quy ton kho", "summary": "sac bo sung"}, a)
    assert res and res[0]["card"]["_id"] == card["_id"]


def test_embedding_search(monkeypatch):
    """Có embedding: xếp theo nghĩa (cosine), kể cả thẻ không chung chữ nào; nhớ embedding của thẻ."""
    a = make_user("a")
    s = personal_space(a)
    near = add_card(s, "Nhớt máy", "Thay nhớt đúng hạn")            # ít chữ chung nhưng cùng nghĩa
    far = add_card(s, *OIL[:1], "Chuyện khác hẳn")
    calls: list[list[str]] = []

    def fake_embed(texts):
        calls.append(texts)
        return [[1.0, 0.0] if ("nhớt" in t.lower() or "thay dầu" in t.lower()) and "khác hẳn" not in t
                else [0.0, 1.0] for t in texts]

    monkeypatch.setattr(novelty, "_embed_ready", lambda: True)
    monkeypatch.setattr(local_ai, "embed", fake_embed)
    res = novelty.find_candidates(DRAFT_OIL, a)
    assert [r["card"]["_id"] for r in res] == [near["_id"], far["_id"]]
    assert res[0]["method"] == "embedding" and res[0]["score"] == pytest.approx(1.0)
    assert "text_score" in res[0]
    novelty.find_candidates(DRAFT_OIL, a)
    assert sum(len(c) for c in calls) == 2 + 1 + 1                  # lần 2 chỉ tính embedding cho thẻ nháp


def test_embedding_error_falls_back_to_text(monkeypatch):
    import httpx
    a = make_user("a")
    card = add_card(personal_space(a), *OIL)

    def broken(_texts):
        raise httpx.ConnectError("tắt Ollama")

    monkeypatch.setattr(novelty, "_embed_ready", lambda: True)
    monkeypatch.setattr(local_ai, "embed", broken)
    res = novelty.find_candidates(DRAFT_OIL, a)
    assert res[0]["card"]["_id"] == card["_id"] and res[0]["method"] == "text"


# ---------------------------------------------------------------------------
# Xếp loại bằng AI (structured_call giả lập)
# ---------------------------------------------------------------------------

def mock_ai(monkeypatch, answer: dict, model: str = "claude-opus-5") -> list[dict]:
    seen: list[dict] = []

    def fake(system, content, schema, **kw):
        seen.append({"system": system, "content": content, "schema": schema, **kw})
        return answer | {"usage": {"input_tokens": 1, "output_tokens": 1, "model": model}}

    monkeypatch.setattr(wiki, "ai_ready", lambda: True)
    monkeypatch.setattr(wiki, "structured_call", fake)
    return seen


def two_cards(user: dict) -> tuple[dict, dict]:
    s = personal_space(user)
    oil = add_card(s, *OIL, current_revision=3)
    coolant = add_card(s, "Chu kỳ thay nước làm mát", "Thay nước làm mát mỗi 40.000 km hoặc 2 năm.")
    return oil, coolant


def test_classify_prompt_schema_and_mapping(monkeypatch):
    a = make_user("a")
    oil, coolant = two_cards(a)
    draft = {"title": "Nước làm mát dùng rất lâu", "summary": "Chỉ cần thay nước làm mát mỗi 100.000 km."}
    cands = novelty.find_candidates(draft, a)
    idx = [c["card"]["_id"] for c in cands].index(coolant["_id"]) + 1
    seen = mock_ai(monkeypatch, {"verdict": "conflict", "related": [idx, 99, idx],
                                 "reason": "Trái thẻ «Chu kỳ thay nước làm mát» (40.000 km)."})
    res = novelty.classify(draft, a, cands)

    call = seen[0]
    for word in ("MỚI", "TRÙNG", "BỔ SUNG", "MÂU THUẪN", "NHIỄU", "new", "duplicate", "supplement", "conflict",
                 "noise"):
        assert word in call["system"]
    assert "<the_nhap>" in call["content"] and draft["title"] in call["content"]
    assert f"[{idx}]" in call["content"] and "Chu kỳ thay nước làm mát" in call["content"]
    schema = call["schema"]
    assert schema["properties"]["verdict"]["enum"] == list(novelty.VERDICTS)
    assert schema["properties"]["related"]["items"]["maximum"] == len(cands)
    assert set(schema["required"]) == {"verdict", "related", "reason"} and schema["additionalProperties"] is False

    assert res["verdict"] == "conflict"
    assert res["related"] == [{"card_id": coolant["_id"], "rev": 1, "score": cands[idx - 1]["score"]}]
    assert res["reason"].startswith("Trái thẻ") and res["engine"] == "claude:claude-opus-5"
    assert set(res) == {"verdict", "related", "reason", "engine"}   # đúng dạng change_requests.novelty


def test_classify_rev_and_local_engine(monkeypatch):
    a = make_user("a")
    oil, _ = two_cards(a)
    mock_ai(monkeypatch, {"verdict": "duplicate", "related": [1], "reason": "Trùng thẻ «Chu kỳ thay dầu»."},
            model="local:gemma3:27b")
    res = novelty.classify(DRAFT_OIL, a)
    assert res["related"][0]["card_id"] == oil["_id"] and res["related"][0]["rev"] == 3
    assert res["engine"] == "local:gemma3:27b"


def test_classify_needs_related_card(monkeypatch):
    """AI nói BỔ SUNG mà quên chỉ thẻ: lấy thẻ gần nhất."""
    a = make_user("a")
    oil, _ = two_cards(a)
    mock_ai(monkeypatch, {"verdict": "supplement", "related": [], "reason": "Thêm chi tiết."})
    res = novelty.classify(DRAFT_OIL, a)
    assert res["verdict"] == "supplement" and res["related"][0]["card_id"] == oil["_id"]


def test_classify_without_candidates_only_new_or_noise(monkeypatch):
    a = make_user("a")
    seen = mock_ai(monkeypatch, {"verdict": "noise", "related": [], "reason": "Lời chúc, không có tri thức."})
    res = novelty.classify({"title": "Chúc mừng sinh nhật anh Hùng", "summary": "Chúc anh vui vẻ."}, a)
    assert seen[0]["schema"]["properties"]["verdict"]["enum"] == ["new", "noise"]
    assert "(không có thẻ nào gần)" in seen[0]["content"]
    assert res == {"verdict": "noise", "related": [], "reason": "Lời chúc, không có tri thức.",
                   "engine": "claude:claude-opus-5"}


def test_classify_skips_weak_embedding_candidates(monkeypatch):
    """Thẻ chỉ cùng lĩnh vực (độ giống theo nghĩa dưới ngưỡng) không đưa cho AI — AI chỉ chọn được MỚI / NHIỄU."""
    a = make_user("a")
    oil, coolant = two_cards(a)
    cands = [{"card": oil, "score": novelty.EMBED_RELATED_MIN + 0.05, "method": "embedding", "text_score": 0.1},
             {"card": coolant, "score": novelty.EMBED_RELATED_MIN - 0.05, "method": "embedding", "text_score": 0.1}]
    seen = mock_ai(monkeypatch, {"verdict": "supplement", "related": [1], "reason": "Thêm chi tiết."})
    res = novelty.classify(DRAFT_OIL, a, cands)
    assert "Chu kỳ thay dầu" in seen[0]["content"] and "nước làm mát" not in seen[0]["content"]
    assert seen[0]["schema"]["properties"]["related"]["items"]["maximum"] == 1
    assert res["related"][0]["card_id"] == oil["_id"]
    seen = mock_ai(monkeypatch, {"verdict": "new", "related": [], "reason": "Chưa có."})
    res = novelty.classify(DRAFT_OIL, a, cands[1:])
    assert seen[0]["schema"]["properties"]["verdict"]["enum"] == ["new", "noise"]
    assert res == {"verdict": "new", "related": [], "reason": "Chưa có.", "engine": "claude:claude-opus-5"}


def test_classify_local_engine_setting(monkeypatch):
    """NOVELTY_ENGINE=local: gọi AI local trước (local_ai.structured_call, engine=local)."""
    a = make_user("a")
    got = {}

    def fake_local(system, content, schema, engine="local", **kw):
        got["engine"] = engine
        return {"verdict": "new", "related": [], "reason": "Chưa có.",
                "usage": {"model": "local:gemma3:27b"}}

    monkeypatch.setattr(novelty, "NOVELTY_ENGINE", "local")
    monkeypatch.setattr(local_ai, "ready", lambda: True)
    monkeypatch.setattr(local_ai, "structured_call", fake_local)
    res = novelty.classify(DRAFT_OIL, a)
    assert got["engine"] == "local" and res["engine"] == "local:gemma3:27b" and res["verdict"] == "new"


def test_classify_ai_error_falls_back_to_heuristic(monkeypatch):
    a = make_user("a")
    oil, _ = two_cards(a)
    monkeypatch.setattr(wiki, "ai_ready", lambda: True)

    def boom(*_a, **_kw):
        raise wiki.AIRetryLater("Claude hết quota — AI local cũng chưa sẵn sàng")

    monkeypatch.setattr(wiki, "structured_call", boom)
    res = novelty.classify(DRAFT_OIL, a)
    assert res["engine"] == "heuristic" and res["verdict"] == "duplicate"
    assert "AI lỗi" in res["reason"] and res["related"][0]["card_id"] == oil["_id"]


def test_prompt_fits_local_context():
    long = "Nội dung rất dài về quy trình bảo dưỡng. " * 200
    cands = [{"card": {"_id": ObjectId(), "title": f"Thẻ {i}", "summary": long, "body": long}, "score": 0.5,
              "method": "text", "text_score": 0.5} for i in range(10)]
    content, n = novelty.build_prompt({"title": "Nháp", "summary": long, "body": long}, cands)
    assert 1 <= n <= 10
    assert len(content) <= novelty._prompt_budget() + novelty.DRAFT_CHARS
    assert (len(novelty.SYSTEM) + len(content)) / 3 <= novelty.LOCAL_LLM_CTX * 0.8   # không bị wiki._fallback từ chối


def test_classify_does_not_write(monkeypatch):
    a = make_user("a")
    two_cards(a)
    mock_ai(monkeypatch, {"verdict": "duplicate", "related": [1], "reason": "Trùng."})
    before = {n: db.db[n].count_documents({}) for n in db.db.list_collection_names()}
    novelty.classify(DRAFT_OIL, a)
    novelty.classify(DRAFT_OIL, a, [])
    assert {n: db.db[n].count_documents({}) for n in db.db.list_collection_names()} == before


# ---------------------------------------------------------------------------
# Không có AI: luật heuristic
# ---------------------------------------------------------------------------

def test_heuristic_duplicate_new_and_empty():
    a = make_user("a")
    oil, _ = two_cards(a)
    dup = novelty.classify(DRAFT_OIL, a)
    assert dup["verdict"] == "duplicate" and dup["engine"] == "heuristic"
    assert dup["related"][0] == {"card_id": oil["_id"], "rev": 3, "score": dup["related"][0]["score"]}
    assert "Chu kỳ thay dầu" in dup["reason"]

    other = novelty.classify({"title": "Xử lý phản đối giá cao", "summary": "Hỏi khách so với mã hàng nào; "
                                                                           "nêu bảo hành và giao nhanh."}, a)
    assert other["verdict"] == "new" and "chưa có AI để so sánh sâu" in other["reason"]

    nothing = novelty.classify(DRAFT_OIL, make_user("b"))           # người b không xem được kho của a
    assert nothing == {"verdict": "new", "related": [], "engine": "heuristic",
                       "reason": nothing["reason"]} and "chưa có AI để so sánh sâu" in nothing["reason"]

    assert novelty.classify({"title": " ", "summary": ""}, a)["verdict"] == "noise"


# ---------------------------------------------------------------------------
# Bộ mẫu có nhãn
# ---------------------------------------------------------------------------

def test_cases_file_well_formed():
    assert len(CASES) >= 30
    labels = [c["label"] for c in CASES]
    assert set(labels) == set(novelty.VERDICTS) and min(labels.count(v) for v in novelty.VERDICTS) >= 5
    assert len({c["id"] for c in CASES}) == len(CASES)
    for c in CASES:
        keys = [e["key"] for e in c["existing"]]
        assert 1 <= len(keys) <= 3 and len(set(keys)) == len(keys), c["id"]
        assert set(c["related"]) <= set(keys), c["id"]
        assert bool(c["related"]) == (c["label"] in ("duplicate", "supplement", "conflict")), c["id"]
        assert c["draft"]["title"] and c["draft"]["summary"] and c["note"], c["id"]


def test_cases_text_search_finds_related_card():
    """Nạp mọi thẻ của bộ mẫu vào một kho: tìm chữ phải đưa thẻ liên quan đúng vào 10 ứng viên."""
    a = make_user("a")
    s = personal_space(a)
    ids = {}
    for c in CASES:
        for e in c["existing"]:
            ids[(c["id"], e["key"])] = add_card(s, e["title"], e["summary"], e.get("body", ""))["_id"]
    for c in CASES:
        if c["related"]:
            got = [r["card"]["_id"] for r in novelty.find_candidates(c["draft"], a)]
            assert ids[(c["id"], c["related"][0])] in got, c["id"]
