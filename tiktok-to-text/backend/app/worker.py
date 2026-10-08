"""Whisper dùng chung cho mọi nơi chuyển giọng nói thành chữ (video mạng xã hội, ghi âm, video tải lên).

Lượt quét TikTok cũ đã gộp vào Kho tư liệu (kb/pipeline.py) — module này chỉ còn giữ model Whisper
trong bộ nhớ và khoá GPU để hai việc không cùng chạy Whisper một lúc.
"""

from __future__ import annotations

import gc
import sys
import threading

from .config import ROOT_DIR

sys.path.insert(0, str(ROOT_DIR))
import tiktok_to_text as core  # noqa: E402  — dùng lại nguyên code tải + nhận dạng của CLI

INFO_KEYS = ("extractor_key", "uploader", "uploader_id", "uploader_url", "channel_url", "channel", "webpage_url", "timestamp", "upload_date", "duration",
             "view_count", "like_count", "comment_count", "repost_count", "description", "title")


# Whisper dùng hết GPU và model dùng chung (self._transcribers) không an toàn luồng: mọi nơi chuyển giọng nói
# phải lấy khoá này. Khi ai_slot bật (AI_ONE_JOB=on, mặc định) khoá này luôn trống vì mọi lời gọi đã nằm trong
# ai_slot.hold("tho") (pipeline.py, làn nặng + làn lấy lại chữ) — chỉ tốn một lần acquire. Nhưng AI_ONE_JOB=off
# thì làn nặng và làn lấy lại chữ chạy song song (pipeline._extract_next) và khoá này là lớp duy nhất chặn hai luồng
# cùng gọi / nhả model → KHÔNG bỏ (DESIGN Phần I mục 13 #13).
TRANSCRIBE_LOCK = threading.Lock()


class Whisper:
    def __init__(self) -> None:
        self._transcribers: dict[tuple, core.Transcriber] = {}

    def transcribe(self, path, opts: dict) -> tuple[core.Transcriber, str, list, str | None]:
        """-> (transcriber, toàn văn, câu, ngôn ngữ nhận ra). Đọc ngôn ngữ ngay trong khoá: model dùng chung."""
        with TRANSCRIBE_LOCK:
            transcriber = self._transcriber(opts)
            text, segs = transcriber.transcribe(path, opts.get("prompt"), opts.get("force_language"))
            language = transcriber.detected_language
        return transcriber, text, segs, language

    def release(self) -> None:
        """Nhả model Whisper khỏi RAM (chuyển sang bước khác — kb/ai_slot.py); lần chép sau tự nạp lại."""
        with TRANSCRIBE_LOCK:
            if not self._transcribers:
                return
            self._transcribers.clear()
            try:   # mlx-whisper giữ model trong ModelHolder riêng của nó
                from mlx_whisper.transcribe import ModelHolder
                ModelHolder.model = ModelHolder.model_path = None
                import mlx.core as mx
                mx.clear_cache()
            except Exception:  # noqa: BLE001 — không dùng mlx / bản khác: bỏ qua
                pass
            gc.collect()
            print("[whisper] đã nhả model khỏi RAM")

    def _transcriber(self, opts: dict) -> core.Transcriber:
        backend = core.pick_backend(opts.get("backend") or "auto")
        key = (backend, opts.get("model") or None, opts.get("language") or "auto")
        if key not in self._transcribers:
            self._transcribers.clear()  # chỉ giữ một model trong bộ nhớ
            self._transcribers[key] = core.Transcriber(*key)
        return self._transcribers[key]


worker = Whisper()
