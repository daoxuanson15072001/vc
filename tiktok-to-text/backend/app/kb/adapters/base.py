"""Giao diện chung cho mọi loại nguồn kiến thức.

Thêm một loại nguồn mới (vd Threads, podcast RSS...) = viết một class kế thừa `Adapter`
rồi khai báo trong `adapters/__init__.py`. Pipeline, API và giao diện tự nhận.

Mỗi bộ đọc là tầng chữ: chép lại nội dung gốc thành Markdown (không tóm tắt), có đánh dấu
vị trí gốc — `[12:30]` cho âm thanh / video, `[Trang 3]` cho PDF, `## Ảnh 2` cho ảnh.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterator


@dataclass
class ExtractedDoc:
    key: str                      # duy nhất trong một nguồn (vd ID video, "p1-40")
    title: str
    text: str                     # bản chữ chuẩn (Markdown)
    url: str | None = None
    meta: dict = field(default_factory=dict)
    images: list[str] = field(default_factory=list)   # ảnh gửi kèm cho AI dựng thẻ (đường dẫn trong raw dir)
    engine: str = ""              # công cụ đã chuyển thành chữ, vd "whisper:mlx-community/…", "claude:claude-opus-5"


@dataclass
class Context:
    raw_dir: Path                 # thư mục lưu thô của nguồn
    options: dict
    log: Callable[[str], None]
    cancelled: Callable[[], bool]
    lane: str = "light"
    existing_keys: set[str] = field(default_factory=set)      # khoá tài liệu nguồn này đã có (quét lại kênh)
    progress: Callable[..., None] = lambda **counts: None     # tiến độ nguồn nhiều mục: set_total=, processed=, ok=…
    # có nguồn cùng làn được ưu tiên cao hơn đang chờ? Bộ đọc nhiều mục (kênh) hỏi giữa hai mục; True -> dừng,
    # đặt `yielded` — pipeline xếp nguồn lại hàng chờ, lần sau chạy tiếp (mục đã xong được bỏ qua)
    should_yield: Callable[[], bool] = lambda: False
    yielded: bool = False
    # video mạng xã hội nói tiếng nước ngoài: chưa dịch ngay mà đánh dấu chờ dịch — pipeline dịch sau khi Whisper
    # chép xong cả loạt (kb/ai_slot.py: một lúc một việc, Whisper và gemma không nằm RAM cùng lúc)
    defer_translation: bool = False


class MoveToHeavyLane(Exception):
    """Bộ đọc làn nhẹ phát hiện nội dung cần Whisper (vd file Drive là ghi âm) -> xếp lại sang làn nặng."""


class Adapter:
    kind: str = ""
    label: str = ""
    file_exts: tuple[str, ...] = ()   # nguồn dạng file tải lên
    lane: str = "light"               # "heavy": cần Whisper / GPU, chạy ở làn riêng

    def match_url(self, url: str) -> bool:
        return False

    def extract(self, source: dict, ctx: Context) -> Iterator[ExtractedDoc]:
        raise NotImplementedError
