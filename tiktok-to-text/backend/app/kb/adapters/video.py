"""Video / kênh / playlist trên mạng xã hội: TikTok, YouTube, Facebook, Instagram, X, Vimeo...

Thay cho "lượt quét" TikTok → Text cũ. Dựa trên yt-dlp (hơn 1.000 trang), nên phần lớn mạng xã hội
mới không cần viết thêm code. Lời nói: phụ đề người làm (YouTube) -> transcript đã có trong bảng `videos`
-> Whisper. Phụ đề máy tự sinh (TikTok, YouTube auto) vẫn chạy Whisper làm bản chính, phụ đề giữ lại để
so khớp (asr_compare) — đo độ tin cậy và gom lỗi nghe nhầm để cải thiện Whisper. Mỗi video được ghi vào bảng `videos` (số liệu viral + transcript) — Kho video, xuất Excel
và Xưởng chiến dịch đọc từ đó.
"""

from __future__ import annotations

import functools
import json
import random
import re
import shutil
import tempfile
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Iterator

import requests
import yt_dlp

from ... import db
from ...config import DEFAULT_VIDEO_LIMIT, MEDIA_DIR
from ...worker import INFO_KEYS, core
from .. import asr_compare, media, translate, video_errors
from . import reddit
from .base import Adapter, Context, ExtractedDoc

# mã ngôn ngữ phụ đề theo tiền tố: YouTube dùng vi / en, TikTok dùng vie-VN / eng-US
SUB_PREFIX = {"vi": ("vi",), "en": ("en",), "auto": ("vi", "en")}
SUB_EXTS = ("vtt", "srt")
PLATFORMS = {"tiktok": "TikTok", "youtube": "YouTube", "facebook": "Facebook", "instagram": "Instagram",
             "twitter": "X", "vimeo": "Vimeo", "dailymotion": "Dailymotion", "twitch": "Twitch"}
DONE = ("ok", "no_speech")
# lỗi yt-dlp nghĩa là "trang này không có video" (khác lỗi mạng / bị chặn): chuyển sang crawl trang
NO_VIDEO = re.compile(r"Unsupported URL|No video (formats|could be found)|There'?s no video|does not contain (a )?video", re.I)


@functools.cache
def _extractors():
    return [ie for ie in yt_dlp.extractor.gen_extractor_classes() if ie.ie_key() != "Generic"]


def platform_of(url: str) -> str | None:
    for ie in _extractors():
        if ie.suitable(url):
            key = ie.ie_key().lower()
            return next((v for k, v in PLATFORMS.items() if key.startswith(k)), ie.ie_key())
    return None


class VideoAdapter(Adapter):
    kind = "video"
    label = "Video / kênh mạng xã hội"
    lane = "heavy"

    def match_url(self, url: str) -> bool:
        # bài Reddit phần lớn là chữ: để bộ đọc website lấy nội dung + bình luận (bài video tự chuyển về đây)
        return platform_of(url) is not None and not reddit.is_post(url)

    def extract(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        """Nguồn chọn loại "Video" nhưng link là trang web (bài Reddit, bài báo, trang yt-dlp không hỗ trợ /
        không có video) -> crawl trang như bộ đọc website; bài Reddit có video vẫn quay lại `extract_videos`."""
        url = source["url"]
        if reddit.is_post(url) or platform_of(url) is None:
            ctx.log("Link là trang web — crawl nội dung trang")
            yield from _crawl(source, ctx)
            return
        try:
            yield from self.extract_videos(source, ctx)
        except yt_dlp.utils.DownloadError as err:
            if not NO_VIDEO.search(str(err)):
                raise
            ctx.log(f"Không thấy video ({str(err)[:150]}) — crawl nội dung trang")
            yield from _crawl(source, ctx)

    def extract_videos(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        url = source["url"]
        limit = int(ctx.options.get("limit") if ctx.options.get("limit") is not None else DEFAULT_VIDEO_LIMIT)
        force = bool(ctx.options.get("force"))
        opts = self._ydl_opts(ctx) | {"extract_flat": "in_playlist", "skip_download": True}
        if limit:
            opts["playlistend"] = limit
        # TikTok hay chặn ngẫu nhiên trang kênh ("secondary user ID"): thử lại; lần cuối dùng secUid
        # đã nhớ từ lượt quét trước (tiktokuser:<secUid> không cần đọc trang hồ sơ)
        sec_uid = source.get("tiktok_sec_uid")
        tries = [url] * 4 + ([f"tiktokuser:{sec_uid}"] if sec_uid else [])
        for attempt, target in enumerate(tries, 1):
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(target, download=False)
                break
            except yt_dlp.utils.DownloadError as err:
                if attempt == len(tries) or ctx.cancelled():
                    raise
                ctx.log(f"Lấy danh sách video lỗi, thử lại lần {attempt + 1}: {str(err)[:150]}")
                time.sleep(random.uniform(2, 5) * min(attempt, 4))
        if info.get("extractor_key") == "TikTokUser" and info.get("id") and info["id"] != sec_uid:
            db.db["kb_sources"].update_one({"_id": source["_id"]}, {"$set": {"tiktok_sec_uid": info["id"]}})
        entries = [e for e in (info.get("entries") or [info]) if e]
        if info.get("entries") is not None:
            ctx.log(f"Kênh / playlist: {len(entries)} video" + (f" (giới hạn {limit})" if limit else ""))
        if name := playlist_title(info):   # nguồn là danh sách phát: lấy tên danh sách làm tên nguồn
            db.db["kb_sources"].update_one({"_id": source["_id"]}, {"$set": {"title": name[:200], "playlist": {
                "id": info.get("id"), "title": name, "count": info.get("playlist_count") or len(entries)}}})
            ctx.log(f"Danh sách phát: {name} — xử lý lần lượt từng video")
        ctx.progress(set_total=len(entries))
        sleep = float(ctx.options.get("sleep", 2.0) or 0) if len(entries) > 1 else 0

        # chuyển chữ lại cả kênh bị ngắt giữa chừng (nhường nguồn ưu tiên): video đã làm lại từ lượt trước thì bỏ qua
        since = ctx.options.get("force_since") if force else None
        for i, e in enumerate(entries, 1):
            if ctx.cancelled():
                return
            if i > 1 and ctx.should_yield():
                ctx.yielded = True
                ctx.log(f"⏸ Tạm nhường làn cho nguồn được ưu tiên — còn {len(entries) - i + 1} video, sẽ chạy tiếp sau")
                return
            vid = str(e.get("id") or "")
            vurl = e.get("webpage_url") or e.get("url")
            if not vurl or not str(vurl).startswith("http"):
                vurl = _tiktok_url(info, e)
            prefix = f"[{i}/{len(entries)}]"
            known = db.videos.find_one({"_id": vid, "status": {"$in": list(DONE)}}
                                       | ({"transcribed_at": {"$gte": since}} if force else {})) \
                if vid and (not force or since) else None
            if known and vid in ctx.existing_keys:
                ctx.log(f"{prefix} {vid} — đã có, bỏ qua")
                ctx.progress(processed=1, skipped=1)
                continue
            if known:   # đã chuyển chữ ở nguồn khác / lượt quét cũ: dùng lại, không tải lại
                ctx.log(f"{prefix} {vid} — dùng lại bản chữ đã có")
                ctx.progress(processed=1, skipped=1)
                yield video_document(known)
                continue
            if not force and (why := video_errors.exhausted(vid)):
                ctx.log(f"{prefix} {vid} — {why}, bỏ qua (lấy lại chữ thủ công nếu cần)")
                ctx.progress(processed=1, skipped=1)
                continue
            ctx.log(f"{prefix} {vurl}")
            try:
                v = self._one(vurl, source, ctx)
                ctx.progress(processed=1, ok=1)
                yield video_document(v)
            except Exception as err:  # noqa: BLE001 — một video lỗi không làm hỏng cả kênh
                msg = str(err)[:300]
                ctx.log(f"{prefix} ✗ {msg}")
                ctx.progress(processed=1, failed=1)
                video_errors.record(vid, vurl, msg, source["_id"], "scan")
            if sleep and i < len(entries):
                time.sleep(random.uniform(sleep / 2, sleep))   # nghỉ giữa các video để không bị chặn

    def _ydl_opts(self, ctx: Context) -> dict:
        opts = {"quiet": True, "no_warnings": True, "noprogress": True, "color": {"stdout": "no_color", "stderr": "no_color"}}
        if ctx.options.get("cookies_from_browser"):
            opts["cookiesfrombrowser"] = (ctx.options["cookies_from_browser"],)
        return opts

    def _one(self, url: str, source: dict, ctx: Context) -> dict:
        """Tải + chuyển chữ một video, ghi vào bảng `videos`, trả document vừa ghi."""
        # không bật writesubtitles thì yt-dlp không lấy danh sách phụ đề (TikTok trả {} dù video có phụ đề)
        with yt_dlp.YoutubeDL(self._ydl_opts(ctx) | {"writesubtitles": True, "writeautomaticsub": True}) as ydl:
            try:
                outer = ydl.extract_info(url, download=False)
            except yt_dlp.utils.DownloadError as err:
                if "No video formats found" in str(err) and platform_of(url) == "TikTok" and tiktok_shop(ydl, url):
                    raise TikTokShopVideo("Video TikTok Shop — TikTok ẩn link tải (isECVideo), "
                                          "cookie đăng nhập cũng không lấy được") from err
                raise
        # id theo link đã quét (bài Reddit là playlist, video bên trong có id khác) để lần quét sau nhận ra đã có
        vid = str(outer["id"])
        info = {k: v for k, v in outer.items() if k != "entries"} | core.single_entry(outer)
        vdir = ctx.raw_dir / re.sub(r"[^\w.-]", "_", vid)
        vdir.mkdir(exist_ok=True)
        meta = {k: info.get(k) for k in INFO_KEYS} | {"platform": platform_of(url)}
        (vdir / "info.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

        language = ctx.options.get("language") or "auto"
        sub = self._subtitles(info, vdir, language, platform_of(url) == "TikTok")
        check = None
        if sub and not sub["auto"]:
            segs, engine, how = sub["segs"], "subtitles", "phụ đề có sẵn"
            spoken = sub["lang"][:2].lower()
        else:
            MEDIA_DIR.mkdir(parents=True, exist_ok=True)
            # thư mục tạm riêng cho mỗi lần tải: hai luồng / hai tiến trình tải cùng video
            # không giành nhau file <id>.mp4.part ("Unable to rename file")
            tmp = Path(tempfile.mkdtemp(prefix=f"{vdir.name}-", dir=MEDIA_DIR))
            args = SimpleNamespace(cookies_from_browser=ctx.options.get("cookies_from_browser"), cookies=None)
            try:
                info, path = core.download_audio(url, tmp, args)
                segs, engine, spoken = media.transcribe(path, ctx.options)
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
            how = "Whisper"
        text = media.join((t for _, _, t in segs), spoken)
        (vdir / "transcript.txt").write_text(text, encoding="utf-8")
        ctx.log(f"  lời nói từ {how} ({translate.lang_name(spoken)}): {len(text)} ký tự")
        # bản gốc giữ nguyên tiếng người nói; bản tiếng Việt là luồng riêng
        translation, pending = None, ctx.defer_translation and translate.needs_translation(spoken)
        if pending:
            ctx.log("  chờ dịch sang tiếng Việt — dịch sau khi chép xong cả loạt")
        else:
            translation = translate.translate_segments(segs, spoken, ctx.log)
            if caption_vi := translation and translate_caption(info.get("description") or info.get("title"), spoken, ctx.log):
                translation["caption"] = caption_vi
        if sub and sub["auto"]:
            check = subtitle_check(text, sub)
            ctx.log(f"  so với phụ đề {sub['lang']}: khớp {check['agreement']:.0%}, {len(check['diffs'])} chỗ lệch")

        record = {"id": vid, "url": url, "info": {k: info.get(k) for k in INFO_KEYS}, "transcript": text, "status": "OK"}
        db.upsert_video(vid, db.video_doc_from_record(record) | {
            "segments": [{"start": round(s, 2), "end": round(e, 2), "text": t} for s, e, t in segs],
            "engine": engine.split(":")[1] if engine.startswith("whisper:") else engine,
            "model": engine.rsplit(":", 1)[-1] if engine.startswith("whisper:") else None,
            "text_engine": engine, "transcript_source": how,
            "language": spoken or language, "translation": translation, "translation_pending": pending,
            "source_id": source["_id"], "transcribed_at": db.now(),
        } | ({"subtitle_check": check} if check else {}))
        return db.videos.find_one({"_id": vid})

    def _subtitles(self, info: dict, vdir, language: str, platform_asr: bool) -> dict | None:
        """Phụ đề đúng ngôn ngữ -> {segs, lang, auto}. auto = máy tự sinh: TikTok đặt phụ đề ASR của nó
        vào `subtitles` nên coi cả nhóm đó là tự sinh. Bản dịch máy sang tiếng khác (eng-US của video
        tiếng Việt) không lấy vì ngôn ngữ không khớp."""
        for pool, auto in ((info.get("subtitles") or {}, platform_asr), (info.get("automatic_captions") or {}, True)):
            for prefix in SUB_PREFIX.get(language, (language,)):
                for lang, fmts in pool.items():
                    if not lang.lower().startswith(prefix):
                        continue
                    fmt = next((f for ext in SUB_EXTS for f in fmts if f.get("ext") == ext), None)
                    if not fmt:
                        continue
                    try:
                        raw = fmt.get("data") or requests.get(fmt["url"], timeout=30, headers=fmt.get("http_headers")).text
                    except requests.RequestException:
                        continue
                    segs = vtt_segments(raw)
                    if segs and vdir:
                        (vdir / f"subtitles.{lang}.{fmt['ext']}").write_text(raw, encoding="utf-8")
                    if segs:
                        return {"segs": segs, "lang": lang, "auto": auto}
        return None


class TikTokShopVideo(Exception):
    """Video bán hàng TikTok Shop: không tải được, video_errors xếp vào lỗi vĩnh viễn "tiktok_shop"."""


def tiktok_shop(ydl, url: str) -> bool:
    """Video TikTok báo "No video formats found" có phải video bán hàng (clip livestream, gắn giỏ TikTok Shop) không:
    trang web để trống playAddr và có cờ isECVideo / nhãn encodeUserTag "ecom_hiddenwm…". Đọc lại trang một lần
    bằng hàm nội bộ của extractor TikTok (yt-dlp không đưa các trường này ra info) — đổi tên / lỗi thì coi như không phải
    (giữ lỗi "no_formats" cũ, vẫn tự thử lại)."""
    try:
        ie = ydl.get_info_extractor("TikTok")
        data, _ = ie._extract_web_data_and_status(url, ie._match_id(url))
    except Exception:  # noqa: BLE001
        return False
    video = (data or {}).get("video") or {}
    ecom = str(data.get("isECVideo")) == "1" or str(video.get("encodeUserTag") or "").startswith("ecom_hiddenwm")
    return ecom and not video.get("playAddr")


def playlist_title(info: dict) -> str | None:
    """Tên danh sách phát YouTube (link /playlist?list=… hoặc watch?v=…&list=…); kênh / video lẻ -> None."""
    if info.get("_type") != "playlist" or not str(info.get("extractor_key") or "").startswith("Youtube"):
        return None
    if "list=" not in str(info.get("webpage_url") or info.get("original_url") or ""):
        return None
    return (info.get("title") or "").strip() or None


def _crawl(source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
    from .web import WebAdapter
    yield from WebAdapter().extract(source, ctx)


def translate_caption(caption: str | None, language: str | None, log) -> str | None:
    caption = (caption or "").strip()
    if not caption:
        return None
    try:
        return translate.translate_texts([caption], language)[0][0] or None
    except Exception as e:  # noqa: BLE001 — caption không dịch được thì thôi
        log(f"  dịch caption lỗi: {str(e)[:200]}")
        return None


def subtitle_check(whisper_text: str, sub: dict) -> dict:
    """Kết quả so Whisper với phụ đề máy, lưu kèm video (cả phụ đề để xem lại / so lại khi đổi model)."""
    sub_text = " ".join(t for _, _, t in sub["segs"])
    return asr_compare.compare(whisper_text, sub_text) | {
        "lang": sub["lang"], "checked_at": db.now(),
        "segments": [{"start": round(s, 2), "end": round(e, 2), "text": t} for s, e, t in sub["segs"]],
    }


def video_document(v: dict) -> ExtractedDoc:
    """Document `videos` -> bản chữ chuẩn. Dùng cho video mới, video đã có và chuyển dữ liệu cũ."""
    platform = PLATFORMS.get(v.get("platform") or "", (v.get("platform") or "").capitalize() or "Video")
    posted = v["posted_at"].strftime("%d/%m/%Y") if v.get("posted_at") else None
    stats = [f"{label}: {v[k]:,}".replace(",", ".") for k, label in
             (("views", "Lượt xem"), ("likes", "Thích"), ("comments", "Bình luận"), ("shares", "Chia sẻ"))
             if v.get(k) is not None]
    lines = [f"- Kênh: @{v.get('channel_handle') or ''}" + (f" ({v['channel_name']})" if v.get("channel_name") and
                                                         v.get("channel_name") != v.get("channel_handle") else ""),
             "- " + " · ".join(x for x in (platform, posted and f"Đăng {posted}",
                                           v.get("duration") and f"Dài {media.fmt_ts(v['duration'])}") if x)]
    if stats:
        lines.append("- " + " · ".join(stats))
    lines.append(f"- Link: {v.get('url')}")
    lang = v.get("language")
    segs = [(s["start"], s["end"], s["text"]) for s in v.get("segments") or []]
    speech = media.timeline_markdown(media.paragraphs(segs, lang)) if segs else (v.get("transcript") or "")
    caption = (v.get("caption") or "").strip()
    title = (caption.splitlines()[0] if caption else "") or v["_id"]
    tr = v.get("translation") or {}
    foreign = translate.needs_translation(lang) and lang != "auto"
    sections = [f"# {title[:200]}", "\n".join(lines), f"## Caption\n\n{caption or '(không có)'}"]
    if tr.get("caption"):
        sections.append(f"## Caption (dịch tiếng Việt)\n\n{tr['caption']}")
    sections.append(f"## Lời nói{f' ({translate.lang_name(lang)} — nguyên bản)' if foreign else ''}\n\n"
                    f"{speech or '(không có lời nói)'}")
    if tr.get("segments"):
        tsegs = [(s["start"], s["end"], s["text"]) for s in tr["segments"]]
        sections.append(f"## Lời nói (dịch tiếng Việt)\n\n{media.timeline_markdown(media.paragraphs(tsegs))}")
    text = "\n\n".join(sections)
    engine = v.get("text_engine") or ("whisper:" + ":".join(x for x in (v.get("engine"), v.get("model")) if x)
                                      if v.get("engine") else "")
    return ExtractedDoc(
        key=v["_id"], title=title[:200], url=v.get("url"), text=text, engine=engine,
        meta={k: v.get(k) for k in ("platform", "channel_handle", "duration", "views", "likes", "comments", "shares",
                                    "posted_at", "language")} | {"transcript_source": v.get("transcript_source") or "Whisper",
                                                                 "translated": bool(tr.get("segments")),
                                                                 "translation_pending": bool(v.get("translation_pending")),
                                                                 "video_id": v["_id"]},
    )


VTT_TIME = re.compile(r"(?:(\d+):)?(\d+):(\d+)[.,](\d+)\s*-->\s*(?:(\d+):)?(\d+):(\d+)[.,](\d+)")


def vtt_segments(vtt: str) -> list[tuple[float, float, str]]:
    """Phụ đề VTT -> [(start, end, text)]; bỏ thẻ và dòng lặp (phụ đề tự động của YouTube lặp từng dòng)."""
    out: list[tuple[float, float, str]] = []
    cur: tuple[float, float] | None = None
    last = ""
    for line in vtt.splitlines():
        if m := VTT_TIME.search(line):
            g = m.groups()
            sec = lambda h, mi, s, ms: int(h or 0) * 3600 + int(mi) * 60 + int(s) + int(ms) / 1000  # noqa: E731
            cur = (sec(*g[:4]), sec(*g[4:]))
            continue
        line = re.sub(r"<[^>]+>", "", line).strip()
        if not line or cur is None or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")) or line.isdigit():
            continue
        if line != last:
            out.append((cur[0], cur[1], line))
            last = line
    return out


def vtt_to_text(vtt: str) -> str:
    return " ".join(t for _, _, t in vtt_segments(vtt))


def _tiktok_url(info: dict, e: dict) -> str:
    uploader = info.get("uploader") or info.get("channel") or ""
    return f"https://www.tiktok.com/@{uploader}/video/{e['id']}"
