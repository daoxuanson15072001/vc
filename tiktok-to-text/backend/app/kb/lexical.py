"""Tìm theo chữ có chấm điểm (BM25) — nửa "chữ" của tìm kiếm hybrid, nửa kia là embedding (kb/embeddings.py,
kb/doc_vectors.py). Module tách từ tiếng Việt dùng chung cho thẻ VCWIKI và tầng thô.

Tách từ kiểu đơn giản: NFC, chữ thường, bỏ dấu (đ -> d, tìm không dấu như cả app), mỗi âm tiết là một từ, thêm cặp
âm tiết liền nhau ("nhan_vien", "giu_chan") để câu có cụm từ khớp nguyên xếp trên câu chỉ chứa rải rác từng âm tiết.

- `tokens(text)`: bản đầy đủ — âm tiết (bỏ từ dừng) + cặp âm tiết + số hiệu / mã giữ nguyên dạng liền
  ("123/2020/nd-cp", "04465-0k240") bên cạnh từng phần. Dùng cho chỉ mục thẻ (`FieldIndex`).
- `terms(text)`: bản cũ (âm tiết + cặp âm tiết, không bỏ từ dừng, không mã liền) — vector thưa Qdrant của tầng thô
  đã dựng bằng bản này; đổi sang `tokens` thì phải dựng lại chỉ mục tầng thô.
- `sparse(text)`: vector thưa {indices, values} cho Qdrant — chỉ số = crc32 của từ, giá trị = tf bão hoà BM25;
  IDF do Qdrant tự tính (collection khai báo `modifier: idf`).
- `Corpus`: BM25 một trường trong Python (cách xếp cũ của thẻ, còn dùng khi SEARCH_RANKING=v1).
- `FieldIndex`: chỉ mục ngược BM25F nhiều trường có trọng số, trong RAM (thẻ VCWIKI — kb/card_search.py).
"""

from __future__ import annotations

import math
import re
import unicodedata
import zlib
from array import array
from collections import Counter
from typing import Any, Callable, Iterable

from .. import db

try:
    import numpy as np
except ImportError:   # thiếu numpy thì chấm bằng Python thuần (chậm hơn, cùng kết quả)
    np = None
    print("Cảnh báo: thiếu numpy — chấm BM25 bằng Python thuần (chậm hơn, cùng kết quả). "
          "Cài: .venv/bin/pip install -r backend/requirements.txt")

K1 = 1.2
B = 0.75
_WORD = re.compile(r"[a-z0-9]+")
_CODE = re.compile(r"[a-z0-9]+(?:[/.\-:][a-z0-9]+)+")   # số hiệu / mã: 123/2020/nd-cp, 04465-0k240, 5.000
# Từ dừng tối thiểu (dạng không dấu): chỉ bỏ ở âm tiết đơn, cặp âm tiết vẫn giữ ("van_de", "co_phan").
# Không đưa vào các âm tiết mà dạng không dấu trùng từ có nghĩa: "the" (thẻ), "o" (ô tô), "da" (đa), "dang" (dạng)...
STOPWORDS = frozenset("va la cua cac nhung thi ma voi duoc mot nay khi nhu nao gi ra vao bi se rat cung hay hoac "
                      "de sao ay kia ne co cho".split())


def norm(text: str) -> str:
    return db.unaccent(unicodedata.normalize("NFC", text or ""))


def tokens(text: str) -> list[str]:
    """Âm tiết (trừ từ dừng) + cặp âm tiết liền nhau + mã / số hiệu dạng liền (có chữ số)."""
    t = norm(text)
    s = _WORD.findall(t)
    return ([w for w in s if w not in STOPWORDS] + [f"{a}_{b}" for a, b in zip(s, s[1:])]
            + [c for c in _CODE.findall(t) if any(ch.isdigit() for ch in c)])


def is_unigram(term: str) -> bool:
    return "_" not in term


def syllables(text: str) -> list[str]:
    return _WORD.findall(db.unaccent(text or ""))


def terms(text: str) -> list[str]:
    s = syllables(text)
    return s + [f"{a}_{b}" for a, b in zip(s, s[1:])]


def sparse(text: str) -> dict:
    """Vector thưa cho Qdrant: tf bão hoà (không chuẩn hoá độ dài — các đoạn đã dài xấp xỉ nhau)."""
    tf: dict[int, float] = {}
    for t, n in Counter(terms(text)).items():
        i = zlib.crc32(t.encode()) & 0x7FFFFFFF
        tf[i] = tf.get(i, 0) + n
    idx = sorted(tf)
    return {"indices": idx, "values": [round(tf[i] * (K1 + 1) / (tf[i] + K1), 4) for i in idx]}


def query_sparse(q: str) -> dict:
    """Vector thưa của câu hỏi: mỗi từ trọng số 1 (Qdrant nhân IDF)."""
    idx = sorted({zlib.crc32(t.encode()) & 0x7FFFFFFF for t in terms(q)})
    return {"indices": idx, "values": [1.0] * len(idx)}


class Corpus:
    """df + độ dài trung bình của một tập văn bản; chấm BM25 cho câu hỏi."""

    def __init__(self, texts: list[str]):
        self.n = len(texts)
        self.df: Counter = Counter()
        total = 0
        for t in texts:
            ts = terms(t)
            total += len(ts)
            self.df.update(set(ts))
        self.avgdl = total / self.n if self.n else 1.0

    def idf(self, term: str) -> float:
        df = self.df.get(term, 0)
        return math.log(1 + (self.n - df + 0.5) / (df + 0.5))

    def score(self, q: str, text: str) -> float:
        qt = set(terms(q))
        if not qt:
            return 0.0
        ts = terms(text)
        dl = len(ts)
        tf = Counter(t for t in ts if t in qt)
        s = 0.0
        for t, n in tf.items():
            s += self.idf(t) * n * (K1 + 1) / (n + K1 * (1 - B + B * dl / self.avgdl))
        return s


class FieldIndex:
    """Chỉ mục ngược BM25F trong RAM cho văn bản nhiều trường (thẻ VCWIKI).

    tf giả của từ t trong văn bản d = Σ_trường w_f · tf_f / (1 − b_f + b_f · len_f / avglen_f): trường quan trọng
    nặng hơn, trường dài bị chuẩn hoá độ dài (thẻ rất dài không được lợi). Điểm = Σ idf(t) · tf(k1+1) / (tf + k1).
    Mỗi kết quả kèm `cover` (tỷ lệ idf các âm tiết của câu hỏi mà văn bản có) và
    `strong_cover` (như trên, chỉ tính các trường mạnh — vd tiêu đề / tóm tắt / tag). Posting lưu gọn bằng array
    (≈ 9 byte / cặp từ–văn bản) để vài chục nghìn thẻ vẫn vừa RAM.

    Văn bản đổi sau khi dựng (marker khác, hoặc chưa có) được đọc lại qua `load` lúc tìm và chấm riêng (phần "delta",
    df / độ dài trung bình lấy theo lúc dựng) — nơi dùng dựng lại cả chỉ mục khi delta lớn.
    """

    def __init__(self, weights: dict[str, float], b: dict[str, float], strong: Iterable[str], k1: float = K1):
        self.weights, self.b, self.k1 = weights, b, k1
        self.strong_bits = sum(1 << i for i, f in enumerate(weights) if f in set(strong))
        self.keys: list = []
        self.markers: list = []
        self.pos: dict = {}
        self.avglen = {f: 1.0 for f in weights}
        self.df: Counter = Counter()
        self.post: dict[str, tuple[Any, Any, Any]] = {}   # từ -> (vị trí văn bản, tf giả, bit trường)
        self.delta: dict = {}                             # key -> (marker, {từ: (tf giả, bit)})

    # --- dựng
    def _analyze(self, fields: dict[str, str]) -> tuple[dict[str, Counter], dict[str, int]]:
        counts = {f: Counter(tokens(fields.get(f) or "")) for f in self.weights}
        return counts, {f: sum(c.values()) for f, c in counts.items()}

    def _terms(self, counts: dict[str, Counter], lens: dict[str, int]) -> dict[str, tuple[float, int]]:
        out: dict[str, list] = {}
        for i, (f, w) in enumerate(self.weights.items()):
            norm_ = 1 - self.b[f] + self.b[f] * lens[f] / self.avglen[f]
            for t, n in counts[f].items():
                cur = out.setdefault(t, [0.0, 0])
                cur[0] += w * n / norm_
                cur[1] |= 1 << i
        return {t: (v[0], v[1]) for t, v in out.items()}

    def build(self, items: Iterable[tuple[Any, Any, dict[str, str]]]) -> "FieldIndex":
        """items: (key, marker, {trường: văn bản})."""
        analyzed = []
        total = Counter()
        for key, marker, fields in items:
            counts, lens = self._analyze(fields)
            analyzed.append((key, marker, counts, lens))
            total.update(lens)
        n = len(analyzed)
        self.avglen = {f: (total[f] / n if n and total[f] else 1.0) for f in self.weights}
        lists: dict[str, tuple[array, array, bytearray]] = {}
        for i, (key, marker, counts, lens) in enumerate(analyzed):
            self.keys.append(key)
            self.markers.append(marker)
            self.pos[key] = i
            for t, (tf, bits) in self._terms(counts, lens).items():
                p = lists.get(t)
                if p is None:
                    p = lists[t] = (array("i"), array("f"), bytearray())
                p[0].append(i)
                p[1].append(tf)
                p[2].append(bits)
        for t, (d, tf, bits) in lists.items():
            self.df[t] = len(d)
            self.post[t] = ((np.frombuffer(d, dtype=np.int32), np.frombuffer(tf, dtype=np.float32),
                             np.frombuffer(bytes(bits), dtype=np.uint8)) if np is not None else (d, tf, bytes(bits)))
        return self

    def __len__(self) -> int:
        return len(self.keys)

    def invalidate(self, keys: Iterable) -> None:
        """Văn bản đã đổi mà marker không đổi (vd chỉ sửa tag): lần tìm sau đọc lại."""
        for k in keys:
            if (i := self.pos.get(k)) is not None:
                self.markers[i] = object()
            self.delta.pop(k, None)

    # --- tìm
    def idf(self, term: str) -> float:
        n, df = len(self.keys), self.df.get(term, 0)
        return math.log(1 + (n - df + 0.5) / (df + 0.5))

    def search(self, q: str, allowed: dict, load: Callable[[list], Iterable[tuple[Any, Any, dict[str, str]]]]
               ) -> dict[Any, tuple[float, float, float]]:
        """Văn bản trong `allowed` ({key: marker}) có chứa ít nhất một từ của câu hỏi
        -> {key: (điểm, strong_cover, cover)}.
        `load(keys)` đọc lại văn bản chưa có / đã đổi."""
        qt = list(dict.fromkeys(tokens(q)))
        if not qt or not allowed:
            return {}
        idf = {t: self.idf(t) for t in qt}
        # mẫu số độ phủ gồm cả từ không văn bản nào có (vd "VPN") — câu hỏi về thứ kho không có thì độ phủ thấp
        uni = sum(idf[t] for t in qt if is_unigram(t)) or 1.0
        fresh, stale = [], []
        for k, m in allowed.items():
            i = self.pos.get(k)
            if i is not None and self.markers[i] == m:
                fresh.append(i)
            elif not (k in self.delta and self.delta[k][0] == m):
                stale.append(k)
        if stale:
            for key, marker, fields in load(stale):
                self.delta[key] = (marker, self._terms(*self._analyze(fields)))
        out: dict = {}
        k1 = self.k1
        if np is not None and fresh:
            n = len(self.keys)
            score = np.zeros(n, dtype=np.float32)
            cover = np.zeros(n, dtype=np.float32)
            strong = np.zeros(n, dtype=np.float32)
            for t in qt:
                if (p := self.post.get(t)) is None:
                    continue
                d, tf, b = p
                score[d] += idf[t] * tf * (k1 + 1) / (tf + k1)
                if is_unigram(t):
                    cover[d] += idf[t]
                    strong[d] += idf[t] * ((b & self.strong_bits) > 0)
            idx = np.asarray(fresh, dtype=np.int64)
            idx = idx[score[idx] > 0]
            for i, s, sc, c in zip(idx.tolist(), score[idx].tolist(), strong[idx].tolist(), cover[idx].tolist()):
                out[self.keys[i]] = (s, sc / uni, c / uni)
        elif fresh:
            acc: dict[int, list] = {}
            want = set(fresh)
            for t in qt:
                if (p := self.post.get(t)) is None:
                    continue
                for i, tf, b in zip(*p):
                    if i in want:
                        cur = acc.setdefault(i, [0.0, 0.0, 0.0])
                        cur[0] += idf[t] * tf * (k1 + 1) / (tf + k1)
                        if is_unigram(t):
                            cur[1] += idf[t] if b & self.strong_bits else 0.0
                            cur[2] += idf[t]
            out = {self.keys[i]: (s, sc / uni, c / uni) for i, (s, sc, c) in acc.items()}
        for k, m in allowed.items():
            if (i := self.pos.get(k)) is not None and self.markers[i] == m:
                continue
            got = self.delta.get(k)
            if not got:
                continue
            s = sc = c = 0.0
            for t in qt:
                if (hit := got[1].get(t)) is not None:
                    s += idf[t] * hit[0] * (k1 + 1) / (hit[0] + k1)
                    if is_unigram(t):
                        sc += idf[t] if hit[1] & self.strong_bits else 0.0
                        c += idf[t]
            if s > 0:
                out[k] = (s, sc / uni, c / uni)
        return out
