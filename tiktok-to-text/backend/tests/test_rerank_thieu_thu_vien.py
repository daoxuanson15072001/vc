"""Nợ kỹ thuật #10 (DESIGN Phần I mục 13): thiếu torch / transformers thì reranker báo rõ và tắt, không im lặng."""

import sys

from app.kb import rerank


def test_thieu_torch_bao_ro_va_tat_han(monkeypatch, capsys):
    monkeypatch.setattr(rerank, "_model", None)
    monkeypatch.setattr(rerank, "_down_until", 0.0)
    monkeypatch.setitem(sys.modules, "torch", None)   # import torch -> ImportError
    assert rerank._load() is None
    out = capsys.readouterr().out
    assert "Reranker: TẮT — thiếu thư viện" in out and "requirements-ml.txt" in out
    # Nghỉ hẳn tới khi khởi động lại: lần gọi sau không thử nạp lại, không in thêm
    assert rerank._down_until == float("inf")
    assert rerank._load() is None
    assert capsys.readouterr().out == ""
