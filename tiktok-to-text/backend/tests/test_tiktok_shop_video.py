"""Video bán hàng TikTok Shop (isECVideo, clip livestream gắn giỏ): trang web để trống playAddr nên yt-dlp báo
"No video formats found" — adapter nhận ra, báo lỗi "tiktok_shop" (vĩnh viễn) để máy không tự thử lại."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
import yt_dlp

from app import db
from app.kb import video_errors
from app.kb.adapters import video as video_mod

URL = "https://www.tiktok.com/@shop/video/7543829909047627015"


class FakeIE:
    def __init__(self, data):
        self.data = data

    def _match_id(self, url):
        return url.rsplit("/", 1)[-1]

    def _extract_web_data_and_status(self, url, video_id):
        if isinstance(self.data, Exception):
            raise self.data
        return self.data, 0


class FakeYDL:
    def __init__(self, data):
        self.ie = FakeIE(data)

    def get_info_extractor(self, key):
        assert key == "TikTok"
        return self.ie


@pytest.mark.parametrize("data, shop", [
    ({"isECVideo": 1, "video": {"playAddr": "", "encodeUserTag": ""}}, True),
    ({"video": {"playAddr": "", "encodeUserTag": "ecom_hiddenwm_item_only"}}, True),
    ({"isECVideo": 1, "video": {"playAddr": "https://v16.tiktokcdn.com/x.mp4"}}, False),   # có link tải: lỗi khác
    ({"isECVideo": 0, "video": {"playAddr": ""}}, False),
    (RuntimeError("yt-dlp đổi hàm nội bộ"), False),
])
def test_tiktok_shop_detection(data, shop):
    assert video_mod.tiktok_shop(FakeYDL(data), URL) is shop


def test_one_raises_permanent_error(monkeypatch):
    class YDL:
        def __init__(self, opts):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def extract_info(self, url, download=False):
            raise yt_dlp.utils.DownloadError("ERROR: [TikTok] 7543829909047627015: No video formats found!")

    monkeypatch.setattr(video_mod.yt_dlp, "YoutubeDL", YDL)
    monkeypatch.setattr(video_mod, "tiktok_shop", lambda ydl, url: True)
    with pytest.raises(video_mod.TikTokShopVideo) as err:
        video_mod.VideoAdapter()._one(URL, {"_id": "s"}, SimpleNamespace(options={}))
    msg = str(err.value)
    assert video_errors.kind_of(msg) == "tiktok_shop"
    video_errors.record("7543829909047627015", URL, msg, "s", "scan")
    assert video_errors.exhausted("7543829909047627015")                # lỗi đầu tiên đã thôi tự thử lại
    assert db.videos.find_one({"_id": "7543829909047627015"})["error_kind"] == "tiktok_shop"


def test_plain_no_formats_still_retried():
    assert video_errors.kind_of("ERROR: [TikTok] 1: No video formats found!") == "no_formats"
    assert "no_formats" not in video_errors.PERMANENT
