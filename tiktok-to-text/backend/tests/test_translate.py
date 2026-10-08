"""Lời nói tiếng nước ngoài: giữ nguyên bản, bản dịch tiếng Việt là luồng riêng."""

from app.kb import translate
from app.kb.adapters.video import video_document


def fake_ai(calls):
    def call(system, content, schema, **kw):
        n = sum(1 for line in content.splitlines() if line[:1].isdigit() and ". " in line)
        calls.append(n)
        return {"items": [{"index": i, "vi": f"câu {i}"} for i in range(1, n + 1)],
                "usage": {"model": "local:test"}}
    return call


def test_tieng_viet_khong_dich(monkeypatch):
    monkeypatch.setattr(translate.local_ai, "structured_call", fake_ai([]))
    assert translate.translate_segments([(0, 1, "xin chào")], "vi") is None


def test_chu_han_chia_lo_nho_hon(monkeypatch):
    calls = []
    monkeypatch.setattr(translate.local_ai, "structured_call", fake_ai(calls))
    segs = [(i, i + 1, "坏的最多的是大灯和雷达" * 2) for i in range(20)]   # 22 chữ Hán / câu
    tr = translate.translate_segments(segs, "zh", log=lambda *_: None)
    assert len(calls) > 1 and sum(calls) == 20
    assert tr["source_lang"] == "zh" and len(tr["segments"]) == 20 and tr["segments"][0]["start"] == 0


def test_tai_lieu_video_giu_goc_va_ban_dich():
    v = {"_id": "1", "url": "u", "caption": "奔驰编程", "language": "zh",
         "segments": [{"start": 0, "end": 2, "text": "坏的最多的是大灯。"}],
         "translation": {"caption": "Lập trình Mercedes", "segments": [{"start": 0, "end": 2, "text": "Hỏng nhiều nhất là đèn pha."}]}}
    d = video_document(v)
    assert "## Lời nói (tiếng Trung — nguyên bản)" in d.text and "坏的最多的是大灯。" in d.text
    assert "## Lời nói (dịch tiếng Việt)" in d.text and "Hỏng nhiều nhất là đèn pha." in d.text
    assert "Lập trình Mercedes" in d.text
    assert d.meta["language"] == "zh" and d.meta["translated"]


def test_ban_dich_sot_chu_han_duoc_dich_lai(monkeypatch):
    calls = []

    def call(system, content, schema, **kw):
        calls.append(content)
        retry = "Lượt trước" in content
        return {"items": [{"index": 1, "vi": "hai xe đều lập trình radar (编雷达)" if retry else "hai xe đều là biên雷达"}],
                "usage": {"model": "local:test"}}
    monkeypatch.setattr(translate.local_ai, "structured_call", call)
    vi, _ = translate.translate_texts(["两个车都是编雷达"], "zh")
    assert len(calls) == 2 and vi == ["hai xe đều lập trình radar (编雷达)"]


def test_chu_goc_trong_ngoac_khong_tinh_la_sot():
    assert not translate.leaks_source("bắn mã (射码) ngoại tuyến")
    assert translate.leaks_source("một thì死退 thời gian")
    assert translate.leaks_source("Phụ đề Субтитры")


def test_loc_cau_bia_nhieu_thu_tieng():
    import tiktok_to_text as core
    for s in ("Субтитры создавал DimaTorzok", "字幕由Amara.org社区提供", "请不吝点赞 订阅 转发 打赏支持明镜与点点栏目"):
        assert core.HALLUCINATION_PATTERNS.search(s), s
    assert not core.HALLUCINATION_PATTERNS.search("点赞加关注我们一起学技术")   # lời thật trong video


def test_ai_local_ban_thi_cho_roi_dich_lai(monkeypatch):
    from app.kb import wiki
    state = {"n": 0}

    def call(system, content, schema, **kw):
        state["n"] += 1
        if state["n"] == 1:
            raise wiki.AINotReady("Chưa cấu hình ANTHROPIC_API_KEY")
        return {"items": [{"index": 1, "vi": "xin chào"}], "usage": {"model": "local:test"}}
    monkeypatch.setattr(translate.local_ai, "structured_call", call)
    monkeypatch.setattr(translate.local_ai, "status", lambda fresh=False: {})
    monkeypatch.setattr(translate, "RETRY_WAITS", (0,))
    tr = translate.translate_segments([(0, 1, "你好")], "zh", log=lambda *_: None)
    assert tr and tr["segments"][0]["text"] == "xin chào"


def test_cau_khong_co_chu_bi_loc():
    import tiktok_to_text as core
    assert not core.HAS_LETTER.search("?") and not core.HAS_LETTER.search("... ♪")
    assert core.HAS_LETTER.search("你好") and core.HAS_LETTER.search("Привет")


def test_ai_gop_cau_thi_dich_lai_cau_trong(monkeypatch):
    calls = []

    def call(system, content, schema, **kw):
        calls.append(content)
        if len(calls) == 1:   # gộp cả 3 câu vào số 1
            return {"items": [{"index": 1, "vi": "một hai ba"}], "usage": {"model": "local:test"}}
        return {"items": [{"index": 1, "vi": "hai"}, {"index": 2, "vi": "ba"}], "usage": {"model": "local:test"}}
    monkeypatch.setattr(translate.local_ai, "structured_call", call)
    vi, _ = translate.translate_texts(["一", "二", "三"], "zh")
    assert len(calls) == 2 and vi == ["một hai ba", "hai", "ba"]


def test_vong_lap_whisper_bi_loc():
    import tiktok_to_text as core
    assert core.is_repetition_loop("That's it, " * 50)
    assert not core.is_repetition_loop("奔驰223坏的最多的就是这个小东西一个车有四个短程雷达左前右前左后右后这个模块不贵啊就几百块")
    assert not core.is_repetition_loop("hai cái xe đều lập trình radar, hai cái xe đồng thời đang lập trình")


def test_doan_khong_co_tieng_noi_bi_loc():
    import tiktok_to_text as core
    assert core.is_no_speech(0.9, -1.4) and core.is_no_speech(0.0, -1.98)   # nhạc: "Thank you."
    assert not core.is_no_speech(0.9, -0.3) and not core.is_no_speech(0.1, -1.4) and not core.is_no_speech(None, None)
