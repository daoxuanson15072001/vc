"""OCR bằng Tesseract (tiếng Việt + Anh), dữ liệu ngôn ngữ trong data/tessdata."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from ...config import TESSDATA_DIR


def ocr_image(path: Path) -> str:
    env = os.environ | {"TESSDATA_PREFIX": str(TESSDATA_DIR)}
    out = subprocess.run(["tesseract", str(path), "stdout", "-l", "vie+eng", "--psm", "3"],
                         capture_output=True, text=True, env=env, timeout=180)
    if out.returncode != 0:
        raise RuntimeError(f"OCR lỗi: {out.stderr.strip()[:200]}")
    return out.stdout.strip()
