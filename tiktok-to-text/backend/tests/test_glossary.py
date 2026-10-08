"""Bảng thuật ngữ dịch rút từ lời thợ Việt: gộp theo ngưỡng, tra trong câu gốc, đưa vào lượt dịch."""

import pytest

from app.kb import glossary, translate


@pytest.fixture(autouse=True)
def reset_cache():
    glossary._cache = None
    yield
    glossary._cache = None


def raw(vid, channel, *terms):
    from app import db
    db.videos.insert_one({"_id": vid, "transcript": " ".join(h or vi for vi, h, _, _ in terms)})
    glossary.raw.insert_one({"_id": vid, "channel": channel,
                             "terms": [{"vi": vi, "heard": h, "zh": zh, "en": en} for vi, h, zh, en in terms]})


def seed():
    rotuyn = ("rotuyn", "rô tuyên", "球头", "Ball Joint")
    radar = ("radar điểm mù", "", "盲点雷达", "Blind Spot Radar")
    raw("v1", "carplus", rotuyn, radar, ("bầu dầu", "", "水箱盖", "Radiator Cap"))
    raw("v2", "gocgara", ("Rotuyn", "", "球头", "Ball Joint"), radar)
    raw("v3", "carplus", rotuyn, ("radar", "", "雷达", "Radar"), radar)
    raw("v4", "gocgara", ("radar", "", "雷达", "Radar"))
    raw("v5", "xeyeu", ("radar", "", "雷达", "Radar"))


def test_gop_theo_nguong_video_va_kenh():
    seed()
    entries = {e["_id"]: e for e in glossary.aggregate(min_videos=3, min_channels=2)}
    assert set(entries) == {"rotuyn", "radar điểm mù", "radar"}          # "bầu dầu" chỉ 1 video: bỏ
    assert entries["rotuyn"]["heard"] == ["rô tuyên"] and entries["rotuyn"]["terms"]["zh"] == ["球头"]


def test_tra_thuat_ngu_dai_truoc():
    seed()
    glossary.save(glossary.aggregate(3, 2))
    hints = glossary.hints(["223坏的最多的是盲点雷达", "球头坏了"], "zh")
    assert ("盲点雷达", "radar điểm mù") in hints and ("球头", "rotuyn") in hints
    assert not any(t == "雷达" for t, _ in hints)                        # đã nằm trong 盲点雷达
    assert glossary.hints(["the ball joint is worn"], "en") == [("Ball Joint", "rotuyn")]
    assert glossary.hints(["xin chào"], "vi") == []
    assert "盲点雷达" in glossary.whisper_prompt("zh")


def test_gop_lai_khong_ghi_de_ban_nguoi_sua():
    seed()
    glossary.save(glossary.aggregate(3, 2))
    glossary.glossary.update_one({"_id": "rotuyn"}, {"$set": {"vi": "rô-tuyn", "status": "approved"}})
    glossary.save(glossary.aggregate(3, 2))
    assert glossary.glossary.find_one({"_id": "rotuyn"})["vi"] == "rô-tuyn"


def test_bo_thuat_ngu_bi_loai():
    seed()
    glossary.save(glossary.aggregate(3, 2))
    glossary.glossary.update_one({"_id": "rotuyn"}, {"$set": {"status": "rejected"}})
    glossary._cache = None
    assert glossary.hints(["球头坏了"], "zh") == []


def test_luot_dich_kem_bang_thuat_ngu(monkeypatch):
    seed()
    glossary.save(glossary.aggregate(3, 2))
    seen = []

    def call(system, content, schema, **kw):
        seen.append(content)
        return {"items": [{"index": 1, "vi": "radar điểm mù hỏng"}], "usage": {"model": "local:test"}}
    monkeypatch.setattr(translate.local_ai, "structured_call", call)
    translate.translate_texts(["盲点雷达坏了"], "zh")
    assert "- 盲点雷达 → radar điểm mù" in seen[0]


def test_bo_pinyin_khi_rut(monkeypatch):
    monkeypatch.setattr(glossary.local_ai, "structured_call", lambda *a, **k: {"terms": [
        {"vi": "rotuyn", "heard": "rô tuyên", "zh": "球头 (qiú tóu)", "en": "Ball Joint"}]})
    assert glossary.extract({"transcript": "rô tuyên"})[0]["zh"] == "球头"


def test_bo_thuat_ngu_khong_co_trong_loi_noi():
    seed()
    glossary.raw.update_one({"_id": "v4"}, {"$push": {"terms": {"vi": "rotuyn", "heard": "", "zh": "球头", "en": ""}}})
    glossary.raw.update_one({"_id": "v5"}, {"$push": {"terms": {"vi": "lỗi", "heard": "", "zh": "故障", "en": ""}}})
    entries = {e["_id"]: e for e in glossary.aggregate(3, 2)}
    assert entries["rotuyn"]["videos"] == 3 and "lỗi" not in entries    # v4 không nói "rotuyn": không tính


# --- nguồn chung: tài liệu theo lĩnh vực / kênh sửa xe + thẻ VCWIKI, job đêm ---

def _doc(title, text, categories=(), handle=None, video_id=None, language="vi"):
    meta = {"language": language} | ({"channel_handle": handle} if handle else {}) | (
        {"video_id": video_id} if video_id else {})
    return glossary.documents.insert_one({"title": title, "text": text, "chars": len(text), "meta": meta,
                                          "categories": list(categories), "source_id": "s1",
                                          "updated_at": None}).inserted_id


def _card(title, body, status="draft", categories=("nganh-o-to.ky-thuat-o-to",)):
    from app import db
    return glossary.cards.insert_one({"title": title, "summary": "", "body": body, "status": status,
                                      "categories": list(categories), "updated_at": db.now()}).inserted_id


LONG = " kim phun bị tắc, phải tháo kim phun ra vệ sinh bằng máy siêu âm." * 5


def test_nguon_theo_linh_vuc_kenh_va_the():
    _doc("Kim phun", LONG, categories=["nganh-o-to.ky-thuat-o-to"])          # PDF / bài viết ngành ô tô
    _doc("Video gara", LONG, handle="gocgara", video_id="v9")                 # kênh sửa xe chưa gắn lĩnh vực
    _doc("Kế toán", LONG, categories=["ke-toan"])                             # ngành khác: bỏ
    _doc("Tiếng Trung", LONG, categories=["nganh-o-to"], language="zh")       # không phải tiếng Việt: bỏ
    _card("Vệ sinh kim phun", LONG)
    _card("Thẻ bị loại", LONG, status="rejected")
    got = {(s["kind"], s["key"].split(":")[0]) for s in glossary.sources()}
    assert got == {("document", "doc"), ("video", "v9"), ("card", "card")}


def test_nguon_da_rut_bo_qua_sua_sau_thi_rut_lai():
    from app import db
    cid = _card("Vệ sinh kim phun", LONG)
    src = next(glossary.sources())
    glossary.save_raw(src, [])
    assert list(glossary.sources()) == []
    glossary.cards.update_one({"_id": cid}, {"$set": {"updated_at": db.now()}})
    assert [s["key"] for s in glossary.sources()] == [f"card:{cid}"]


def test_the_tinh_nang_hon_va_the_duyet_la_du():
    kim = {"vi": "kim phun", "heard": "", "zh": "喷油嘴", "en": "fuel injector"}
    sieu_am = {"vi": "máy siêu âm", "heard": "", "zh": "超声波清洗机", "en": "ultrasonic cleaner"}
    glossary.raw.insert_one({"_id": "v1", "channel": "gocgara", "kind": "video", "grounded": True, "terms": [kim]})
    glossary.raw.insert_one({"_id": "card:a", "channel": "vcwiki", "kind": "card", "grounded": True,
                             "approved": False, "terms": [kim]})
    glossary.raw.insert_one({"_id": "card:b", "channel": "vcwiki", "kind": "card", "grounded": True,
                             "approved": True, "terms": [sieu_am]})
    entries = {e["_id"]: e for e in glossary.aggregate(3, 2)}
    assert entries["kim phun"]["videos"] == 1 and entries["kim phun"]["cards"] == 1   # 1 + 2 = 3, 2 kênh
    assert "máy siêu âm" in entries                                                   # thẻ đã duyệt: một thẻ đủ


def test_the_bi_loai_sau_khi_rut_khong_tinh():
    cid = _card("Vệ sinh kim phun", LONG, status="rejected")
    glossary.raw.insert_one({"_id": f"card:{cid}", "channel": "vcwiki", "kind": "card", "grounded": True,
                             "approved": True, "terms": [{"vi": "kim phun", "heard": "", "zh": "喷油嘴", "en": ""}]})
    assert glossary.aggregate(3, 2) == []


def test_rut_chi_giu_thuat_ngu_co_trong_noi_dung(monkeypatch):
    monkeypatch.setattr(glossary.local_ai, "structured_call", lambda *a, **k: {"terms": [
        {"vi": "kim phun", "heard": "", "zh": "喷油嘴", "en": ""},
        {"vi": "rotuyn", "heard": "rô tuyên", "zh": "球头", "en": ""},         # AI bịa: không có trong nội dung
        {"vi": "kiểm tra", "heard": "", "zh": "检查", "en": ""}]})             # từ chung chung
    assert [t["vi"] for t in glossary.extract_text("x", LONG)] == ["kim phun"]


def test_update_rut_phan_moi_roi_ghi_bang(monkeypatch, tmp_path):
    import importlib.util
    import sys
    spec = importlib.util.spec_from_file_location("build_glossary", "scripts/build_glossary.py")
    bg = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bg)
    monkeypatch.setattr(bg, "LOCK", tmp_path / "g.lock")
    monkeypatch.setattr(glossary.local_ai, "structured_call", lambda *a, **k: {"terms": [
        {"vi": "máy siêu âm", "heard": "", "zh": "超声波清洗机", "en": ""}]})
    _card("Vệ sinh kim phun", LONG, status="approved")
    monkeypatch.setattr(sys, "argv", ["x", "update", "--out", str(tmp_path / "p.csv")])
    bg.main()
    assert glossary.glossary.find_one({"_id": "máy siêu âm"})["status"] == "auto"
    held = bg.lock()                                          # đang có lượt khác giữ khoá -> bỏ qua
    monkeypatch.setattr(glossary, "sources", lambda *a, **k: (_ for _ in ()).throw(AssertionError("không được rút")))
    bg.main()
    held.close()
