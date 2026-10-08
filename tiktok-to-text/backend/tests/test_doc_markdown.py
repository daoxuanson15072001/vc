"""Bộ đọc tài liệu giữ bảng + tiêu đề (DOC_ENGINE, adapters/docmd.py) và đường lui về bộ đọc cũ."""

from __future__ import annotations

import pytest

from app import config
from app.kb.adapters import docmd
from app.kb.adapters.base import Context
from app.kb.adapters.office import office_docs
from app.kb.adapters.pdf import extract_pdf

from .doc_samples import make_docx, make_pdf, make_pptx, make_xlsx

HEADER = "| Hang muc | So luong | Don gia |"
ROW = "| Dau may | 4 | 320000 |"


@pytest.fixture
def ctx(tmp_path):
    logs: list[str] = []
    c = Context(raw_dir=tmp_path, options={}, log=logs.append, cancelled=lambda: False)
    c.logs = logs
    return c


@pytest.fixture
def engine(monkeypatch):
    def use(name: str):
        monkeypatch.setattr(config, "DOC_ENGINE", name)
    use("markitdown")
    return use


def _one(docs):
    docs = list(docs)
    assert len(docs) == 1
    return docs[0]


def _table_ok(text: str):
    lines = text.split("\n")
    i = lines.index(HEADER)
    assert lines[i + 1].replace(" ", "") == "|---|---|---|"
    assert ROW in lines


def test_docx_markitdown_giu_tieu_de_va_bang(ctx, engine):
    d = _one(office_docs(make_docx(ctx.raw_dir / "a.docx"), "a", None, ctx))
    assert d.engine == "markitdown"
    assert "# Quy trình bảo dưỡng" in d.text and "## Vật tư" in d.text
    _table_ok(d.text)           # dòng tiêu đề rỗng của mammoth đã được thay bằng dòng dữ liệu đầu
    assert "|  |  |  |" not in d.text
    assert "Kiểm tra lốp" in d.text


def test_docx_legacy_va_duong_lui(ctx, engine, monkeypatch):
    path = make_docx(ctx.raw_dir / "a.docx")
    engine("legacy")
    d = _one(office_docs(path, "a", None, ctx))
    assert d.engine == "python-docx"
    _table_ok(d.text)

    engine("markitdown")        # markitdown chưa cài -> bộ đọc cũ, không lỗi

    def missing():
        raise ImportError("markitdown")
    monkeypatch.setattr(docmd, "_markitdown", missing)
    d = _one(office_docs(path, "a", None, ctx))
    assert d.engine == "python-docx"
    _table_ok(d.text)


def test_docx_markitdown_loi_thi_bao_va_lui(ctx, engine, monkeypatch):
    class Broken:
        def convert(self, _):
            raise ValueError("file hỏng")
    monkeypatch.setattr(docmd, "_markitdown", lambda: Broken())
    d = _one(office_docs(make_docx(ctx.raw_dir / "a.docx"), "a", None, ctx))
    assert d.engine == "python-docx"
    assert any("markitdown không đọc được" in m for m in ctx.logs)


def test_pptx_slide_tieu_de_bang_ghi_chu(ctx, engine):
    d = _one(office_docs(make_pptx(ctx.raw_dir / "a.pptx"), "a", None, ctx))
    assert d.engine == "markitdown"
    assert "## Slide 1: Đào tạo kỹ thuật viên" in d.text
    assert "## Slide 2: Bảng giá vật tư" in d.text
    _table_ok(d.text)
    assert "> Ghi chú người trình bày: Nhấn mạnh giá má phanh" in d.text
    assert "<!--" not in d.text and "### Notes" not in d.text
    assert "PowerPoint 2 slide" in ctx.logs


def test_xlsx_van_dung_openpyxl(ctx, engine):
    d = _one(office_docs(make_xlsx(ctx.raw_dir / "a.xlsx"), "a", None, ctx))
    assert d.engine == "openpyxl"
    _table_ok(d.text)


def test_pdf_bang_ke_o_va_tieu_de(ctx, engine):
    d = _one(extract_pdf(make_pdf(ctx.raw_dir / "a.pdf"), "a", ctx))
    assert d.engine == "pypdf + pdfplumber"
    assert d.text.startswith("[Trang 1]\n# Bao duong dinh ky")
    _table_ok(d.text)
    # đoạn văn trước / sau bảng giữ đúng thứ tự
    t = d.text
    assert t.index("Bang vat tu cho lan") < t.index(HEADER) < t.index("Ghi chu: thay loc gio")


def test_pdf_legacy_giu_chu_pypdf(ctx, engine):
    engine("legacy")
    d = _one(extract_pdf(make_pdf(ctx.raw_dir / "a.pdf"), "a", ctx))
    assert d.engine == "pypdf"
    assert "|" not in d.text and "Dau may 4 320000" in d.text


def test_pdf_loi_bo_cuc_thi_giu_chu_pypdf(ctx, engine, monkeypatch):
    def boom(*_):
        raise RuntimeError("bố cục lạ")
    monkeypatch.setattr(docmd, "_layout", boom)
    d = _one(extract_pdf(make_pdf(ctx.raw_dir / "a.pdf"), "a", ctx))
    assert "Dau may 4 320000" in d.text and "|" not in d.text


def test_pdf_docling_chua_cai_thi_dung_pdfplumber(ctx, engine):
    pytest.importorskip("pdfplumber")
    try:
        import docling  # noqa: F401
        pytest.skip("máy có docling")
    except ImportError:
        pass
    engine("docling")
    d = _one(extract_pdf(make_pdf(ctx.raw_dir / "a.pdf"), "a", ctx))
    assert d.engine == "pypdf + pdfplumber"
    _table_ok(d.text)
    assert any("chưa cài docling" in m for m in ctx.logs)


def test_hau_xu_ly_markdown():
    md = "Đoạn\n\n|  |  |\n| --- | --- |\n| A | B |\n| 1 | 2 |\n\n![](data:image/png;base64...)\n![Sơ đồ](Picture3.jpg)"
    out = docmd._header_rows(docmd._images(md))
    assert "| A | B |\n| --- | --- |\n| 1 | 2 |" in out
    assert "[Hình]" in out and "[Hình: Sơ đồ]" in out
    assert docmd._apply_headings("Tieu de\nnoi dung", {"Tieu de": "## Tieu de"}) == "## Tieu de\n\nnoi dung"
