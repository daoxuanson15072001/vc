#!/usr/bin/env python3
"""Thử nghiệm luồng hai tầng: Whisper CHỈ NGHE, Claude ĐOÁN CÂU — so với cách chép hiện tại.

    cd backend && ../.venv/bin/python scripts/asr_nghe_doan.py run [--n 10] [--pick low|random] [--engine mlx|batched]
    cd backend && ../.venv/bin/python scripts/asr_nghe_doan.py report

Tầng nghe: Whisper không được đoán câu — không prompt thuật ngữ, không nối chữ cửa sổ trước
(condition_on_previous_text=False), temperature 0 cố định (không lấy mẫu lại cho "trôi" hơn), cắt đoạn độc lập
rồi chép song song (engine batched: faster-whisper BatchedInferencePipeline; engine mlx: từng cửa sổ 30 giây độc
lập trên GPU). Kết quả là chuỗi âm tiết kèm xác suất từng từ — từ nghe không chắc đánh dấu ⟨từ~0.42⟩.

Tầng đoán: Claude (claude -p, tài khoản Pro/Max — không cần ANTHROPIC_API_KEY) nhận chuỗi âm tiết + tiêu đề video,
ghép thành câu, thêm dấu câu, sửa từ nghe nhầm gần âm (dấu thanh, phụ âm cuối, thuật ngữ). Các video chạy song song.

Đo: mỗi video có ba bản — bản đang lưu (Whisper hiện tại), bản nghe thô, bản Claude đoán — đều so với phụ đề
TikTok (videos.subtitle_check, một bộ nhận dạng độc lập, KHÔNG phải đáp án đúng; xem kb/asr_compare.py).
Chỉ đọc DB, không ghi gì vào video; kết quả ở output/asr_nghe_doan/.
"""

from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import db, worker  # noqa: E402
from app.config import ROOT_DIR  # noqa: E402
from app.kb import ai_slot, asr_compare, media  # noqa: E402

core = worker.core
OUT = ROOT_DIR / "output" / "asr_nghe_doan"
MEDIA = OUT / "media"
LOW_PROB = 0.5          # xác suất từ dưới ngưỡng này: đánh dấu "nghe không chắc" cho Claude

SYSTEM = """Bạn là tầng ĐOÁN CÂU trong hệ chuyển giọng nói thành chữ. Tầng NGHE (Whisper) đã chép âm tiết của \
một video ngắn tiếng Việt, cố ý không sửa câu: không dấu câu chuẩn, có thể nghe nhầm dấu thanh, phụ âm đầu / cuối, \
thuật ngữ, tên riêng, tiếng Anh chen giữa. Từ bọc ⟨từ~0.42⟩ là từ Whisper nghe không chắc (số là xác suất).

Việc của bạn: dựng lại lời nói thành câu tiếng Việt đúng chính tả, có dấu câu, giữ nguyên mốc [mm:ss] đầu mỗi dòng.
Quy tắc:
- Chỉ sửa khi từ nghe được và từ bạn sửa GẦN ÂM nhau (vd "hộp xố" → "hộp số", "cam bi a" → "cambia"), và câu sau \
khi sửa hợp nghĩa hơn rõ rệt. Không thay bằng từ đồng nghĩa, không viết lại câu cho hay hơn.
- Không thêm ý, không bỏ ý, không tóm tắt. Từ đệm (ờ, à, thì là) giữ nguyên.
- Đoạn không đoán được thì giữ nguyên âm tiết đã nghe; hoàn toàn không rõ ghi [không rõ].
- Tiêu đề / mô tả video chỉ là ngữ cảnh để đoán thuật ngữ, tên riêng — không chép vào bản chữ.
- Liệt kê mọi chỗ bạn sửa trong `changes` (heard = chữ tầng nghe, fixed = chữ bạn sửa)."""

SCHEMA = {
    "type": "object",
    "properties": {
        "lines": {"type": "array", "items": {"type": "object", "properties": {
            "at": {"type": "string"}, "text": {"type": "string"}}, "required": ["at", "text"]}},
        "changes": {"type": "array", "items": {"type": "object", "properties": {
            "heard": {"type": "string"}, "fixed": {"type": "string"}}, "required": ["heard", "fixed"]}},
    },
    "required": ["lines", "changes"],
}


# ---------------------------------------------------------------------------
# Tầng nghe
# ---------------------------------------------------------------------------

_batched = None


def listen(path: Path, engine: str, language: str | None) -> list[dict]:
    """-> [{start, end, words: [(word, prob)]}] — chỉ nghe, không ngữ cảnh."""
    global _batched
    if engine == "batched":
        if _batched is None:
            from faster_whisper import BatchedInferencePipeline, WhisperModel
            _batched = BatchedInferencePipeline(WhisperModel("large-v3-turbo", device="cpu", compute_type="int8"))
        segments, _ = _batched.transcribe(str(path), language=language, batch_size=8, temperature=0.0,
                                          word_timestamps=True, without_timestamps=True)
        raw = [{"start": s.start, "end": s.end, "no_speech_prob": s.no_speech_prob, "avg_logprob": s.avg_logprob,
                "words": [(w.word.strip(), w.probability) for w in (s.words or [])]} for s in segments]
    else:
        import mlx_whisper
        res = mlx_whisper.transcribe(str(path), path_or_hf_repo=core.DEFAULT_MODELS["mlx"], language=language,
                                     condition_on_previous_text=False, initial_prompt=None, temperature=0.0,
                                     word_timestamps=True)
        raw = [{"start": s["start"], "end": s["end"], "no_speech_prob": s.get("no_speech_prob"),
                "avg_logprob": s.get("avg_logprob"),
                "words": [(w["word"].strip(), w["probability"]) for w in s.get("words", [])]} for s in res["segments"]]
    out = []
    for s in raw:   # bộ lọc im lặng / câu bịa giống luồng chính, để so công bằng
        text = " ".join(w for w, _ in s["words"])
        if core.is_no_speech(s["no_speech_prob"], s["avg_logprob"]) or not core.HAS_LETTER.search(text) \
                or core.HALLUCINATION_PATTERNS.search(text) or core.is_repetition_loop(text):
            continue
        out.append({"start": s["start"], "end": s["end"], "words": [(w, round(p, 3)) for w, p in s["words"] if w]})
    return out


def heard_text(segs: list[dict]) -> str:
    return " ".join(w for s in segs for w, _ in s["words"])


def heard_markup(segs: list[dict]) -> str:
    return "\n".join(f"[{media.fmt_ts(s['start'])}] " + " ".join(
        f"⟨{w}~{p:.2f}⟩" if p < LOW_PROB else w for w, p in s["words"]) for s in segs)


# ---------------------------------------------------------------------------
# Tầng đoán
# ---------------------------------------------------------------------------

def guess(segs: list[dict], video: dict, model: str) -> dict:
    ctx = (video.get("info") or {})
    title = video.get("title") or ctx.get("title") or ""
    desc = (video.get("description") or ctx.get("description") or "")[:500]
    prompt = f"Tiêu đề: {title}\nMô tả: {desc}\n\n<tang_nghe>\n{heard_markup(segs)}\n</tang_nghe>"
    t0 = time.time()
    cp = subprocess.run(
        ["claude", "-p", "--model", model, "--output-format", "json", "--json-schema", json.dumps(SCHEMA),
         "--system-prompt", SYSTEM, "--tools", "", "--strict-mcp-config"],
        input=prompt, capture_output=True, text=True, timeout=600, cwd=OUT)
    if cp.returncode:
        raise RuntimeError((cp.stderr or cp.stdout)[-300:])
    res = json.loads(cp.stdout)
    data = res.get("structured_output")
    if data is None:   # bản CLI cũ: JSON nằm trong chữ trả về
        txt = res.get("result", "")
        data = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    data["seconds"] = round(time.time() - t0, 1)
    data["cost_usd"] = res.get("total_cost_usd")
    return data


# ---------------------------------------------------------------------------
# Chạy + đo
# ---------------------------------------------------------------------------

def pick(n: int, how: str, ids: list[str] | None) -> list[dict]:
    fields = {"url": 1, "transcript": 1, "language": 1, "duration": 1, "title": 1, "description": 1,
              "info.title": 1, "info.description": 1, "subtitle_check.agreement": 1, "subtitle_check.segments": 1}
    if ids:
        return list(db.videos.find({"_id": {"$in": ids}}, fields))
    q = {"subtitle_check.agreement": {"$exists": True}, "duration": {"$gte": 20, "$lte": 240},
         "language": {"$in": ["vi", None]}, "subtitle_check.words_sub": {"$gte": 40}}
    if how == "low":    # chỗ luồng hiện tại lệch phụ đề nhiều: nơi tầng đoán có đất để giúp
        q["subtitle_check.agreement"] = {"$gte": 0.5, "$lt": 0.85}
    pool = list(db.videos.find(q, {"_id": 1}).limit(3000))
    chosen = [v["_id"] for v in random.Random(42).sample(pool, min(n, len(pool)))]
    return list(db.videos.find({"_id": {"$in": chosen}}, fields))


def score(text: str, sub: str) -> dict:
    c = asr_compare.compare(text, sub)
    return {"agreement": c["agreement"], "wer": c["wer"]}


def run(args) -> None:
    MEDIA.mkdir(parents=True, exist_ok=True)
    videos = pick(args.n, args.pick, args.ids)
    print(f"{len(videos)} video · engine {args.engine} · Claude {args.claude_model}")
    ydl_args = SimpleNamespace(cookies=None, cookies_from_browser=None)
    heard: list[tuple[dict, list[dict], float]] = []

    # 1) nghe: lần lượt từng video (Whisper giữ chỗ "tho" như luồng chính, không tranh RAM với máy chủ)
    for i, v in enumerate(videos, 1):
        out = OUT / f"{v['_id']}.json"
        if out.exists() and not args.force:
            print(f"[{i}] {v['_id']} đã có kết quả, bỏ qua (--force để chạy lại)")
            continue
        try:
            _, path = core.download_audio(v["url"], MEDIA, ydl_args)
            with ai_slot.hold("tho", f"thử nghiệm nghe/đoán {v['_id']}"):
                t0 = time.time()
                segs = listen(path, args.engine, "vi")
                took = time.time() - t0
        except Exception as e:  # noqa: BLE001 — một video lỗi thì bỏ qua
            print(f"[{i}] {v['_id']} ✗ nghe: {str(e)[:150]}")
            continue
        print(f"[{i}] {v['_id']} nghe {took:.1f}s cho {v.get('duration')}s audio · {len(segs)} đoạn")
        heard.append((v, segs, took))

    # 2) đoán: Claude chạy song song nhiều video
    def one(item):
        v, segs, took = item
        try:
            g = guess(segs, v, args.claude_model) if segs else {"lines": [], "changes": []}
        except Exception as e:  # noqa: BLE001
            print(f"{v['_id']} ✗ đoán: {str(e)[:200]}")
            return
        sub = " ".join(x["text"] for x in v["subtitle_check"].get("segments", []))
        guessed = " ".join(line["text"] for line in g["lines"])
        rec = {
            "id": v["_id"], "url": v["url"], "duration": v.get("duration"), "engine": args.engine,
            "claude_model": args.claude_model, "listen_seconds": round(took, 1), "guess_seconds": g.get("seconds"),
            "cost_usd": g.get("cost_usd"),
            "score": {"hien_tai": score(v.get("transcript") or "", sub), "nghe": score(heard_text(segs), sub),
                      "doan": score(guessed, sub)},
            "texts": {"hien_tai": v.get("transcript"), "nghe": heard_markup(segs),
                      "doan": "\n".join(f"[{x['at']}] {x['text']}" for x in g["lines"]), "tiktok": sub},
            "changes": g["changes"],
        }
        (OUT / f"{v['_id']}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
        s = rec["score"]
        print(f"{v['_id']} khớp phụ đề: hiện tại {s['hien_tai']['agreement']:.0%} · nghe {s['nghe']['agreement']:.0%}"
              f" · đoán {s['doan']['agreement']:.0%} · {len(g['changes'])} chỗ sửa")

    with ThreadPoolExecutor(args.jobs) as ex:
        list(ex.map(one, heard))
    report(args)


def report(args) -> None:
    recs = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(OUT.glob("*.json"))]
    if not recs:
        print("Chưa có kết quả. Chạy: scripts/asr_nghe_doan.py run")
        return
    n = len(recs)
    print(f"\n{n} video · so với phụ đề TikTok (khớp cao hơn = tốt hơn, WER thấp hơn = tốt hơn)")
    for key, label in (("hien_tai", "Whisper hiện tại"), ("nghe", "Tầng nghe (thô)"), ("doan", "Nghe + Claude đoán")):
        a = sum(r["score"][key]["agreement"] for r in recs) / n
        w = sum(r["score"][key]["wer"] for r in recs) / n
        print(f"  {label:22} khớp {a:6.1%} · WER {w:6.1%}")
    better = sum(r["score"]["doan"]["agreement"] > r["score"]["hien_tai"]["agreement"] + 0.01 for r in recs)
    worse = sum(r["score"]["doan"]["agreement"] < r["score"]["hien_tai"]["agreement"] - 0.01 for r in recs)
    audio = sum(r.get("duration") or 0 for r in recs)
    print(f"  Đoán tốt hơn hiện tại: {better}/{n} video · kém hơn: {worse}/{n}")
    print(f"  Thời gian nghe {sum(r['listen_seconds'] for r in recs):.0f}s cho {audio:.0f}s audio"
          f" · Claude trung bình {sum(r['guess_seconds'] or 0 for r in recs) / n:.0f}s/video")
    print("\nVí dụ chỗ Claude sửa:")
    for r in recs[:5]:
        for c in r["changes"][:4]:
            print(f"  {r['id']}  {c['heard']!r} → {c['fixed']!r}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest="cmd", required=True)
    r = sp.add_parser("run")
    r.add_argument("--n", type=int, default=10)
    r.add_argument("--pick", choices=["low", "random"], default="low")
    r.add_argument("--ids", nargs="*")
    r.add_argument("--engine", choices=["mlx", "batched"], default="mlx")
    r.add_argument("--claude-model", default="sonnet")
    r.add_argument("--jobs", type=int, default=3, help="số video Claude đoán song song")
    r.add_argument("--force", action="store_true")
    sp.add_parser("report")
    args = p.parse_args()
    (run if args.cmd == "run" else report)(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
