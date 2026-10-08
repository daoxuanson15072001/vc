#!/usr/bin/env python3
"""Sinh bo-test.html: một trang mở thẳng bằng Chrome, mỗi gói test có nút "Copy prompt" (đã ghép PHẦN CHUNG + gói).

Chạy lại sau khi sửa _chung.md hoặc P*.md:  python3 docs/test-claude-extension/build_html.py
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent


def meta(text: str) -> tuple[str, str]:
    title = re.search(r"^# (.+)$", text, re.M).group(1)
    info = re.search(r"^> (.+)$", text, re.M)
    return title, info.group(1) if info else ""


def main() -> None:
    common = (HERE / "_chung.md").read_text(encoding="utf-8").strip()
    packs = []
    for f in sorted(HERE.glob("P[0-9][0-9]-*.md")):
        body = f.read_text(encoding="utf-8").strip()
        title, info = meta(body)
        packs.append({"id": f.stem[:3], "file": f.name, "title": title, "info": info,
                      "cases": len(re.findall(r"^### ", body, re.M)),
                      "prompt": f"{common}\n\n---\n\n# GÓI TEST CẦN CHẠY\n\n{body}\n"})
    cards = "\n".join(f"""
<section class="pack" data-id="{p['id']}">
  <div class="head">
    <label class="done"><input type="checkbox"> Đã chạy</label>
    <h2>{html.escape(p['title'])}</h2>
  </div>
  <p class="info">{html.escape(p['info'])}</p>
  <p class="meta">{p['cases']} ca · file <code>{p['file']}</code> · {len(p['prompt']):,} ký tự</p>
  <div class="actions">
    <button class="copy" data-i="{i}">Copy prompt</button>
    <button class="view" data-i="{i}">Xem nội dung</button>
  </div>
  <pre hidden></pre>
</section>""" for i, p in enumerate(packs))
    data = json.dumps([p["prompt"] for p in packs], ensure_ascii=False).replace("</", "<\\/")
    page = f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bộ test Claude in Chrome</title>
<style>
:root{{--bg:#f7f7f5;--card:#fff;--fg:#1d1d1b;--mut:#6b6b66;--line:#e2e1dc;--acc:#1f5fbf;--ok:#1d7a3e}}
@media (prefers-color-scheme:dark){{:root{{--bg:#161615;--card:#1f1f1d;--fg:#ecebe6;--mut:#a09f98;--line:#33332f;--acc:#6ea3ff;--ok:#5cc585}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,system-ui,sans-serif}}
main{{max-width:900px;margin:0 auto;padding:24px 16px 64px}}
h1{{font-size:24px;margin:0 0 6px}} .lead{{color:var(--mut);margin:0 0 20px}}
ol.steps{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 14px 14px 34px}}
.pack{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}}
.pack.is-done{{opacity:.6}} .pack.is-done h2{{text-decoration:line-through}}
.head{{display:flex;gap:12px;align-items:center;flex-wrap:wrap}} h2{{font-size:17px;margin:0}}
.info,.meta{{margin:6px 0;color:var(--mut);font-size:13.5px}} code{{font-size:12.5px}}
.done{{font-size:13px;color:var(--ok);white-space:nowrap}}
.actions{{display:flex;gap:8px;margin-top:8px}}
button{{font:inherit;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:8px;padding:6px 12px;cursor:pointer}}
button.copy{{background:var(--acc);border-color:var(--acc);color:#fff}}
pre{{white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;max-height:480px;overflow:auto;font-size:12.5px}}
</style></head><body><main>
<h1>Bộ test phần mềm cho Claude in Chrome</h1>
<p class="lead">VC Content Engine / VCWIKI · môi trường UAT http://127.0.0.1:5400 · mật khẩu mọi tài khoản Test@12345</p>
<ol class="steps">
<li>Bật môi trường test: <code>bash start_uat.sh</code> (lần đầu tự dựng dữ liệu mẫu).</li>
<li>Trước mỗi gói (trừ P09): dựng lại dữ liệu bằng <code>bash start_uat.sh --seed-only</code>. Gói P10 cần <code>bash start_uat.sh --ai --reset</code>.</li>
<li>Mở Chrome ở <code>http://127.0.0.1:5400</code>, mở Claude in Chrome, bấm <b>Copy prompt</b> của gói rồi dán vào.</li>
<li>Chép báo cáo cuối cùng của Claude in Chrome gửi cho Claude Code để sửa lỗi. Tick "Đã chạy" để đánh dấu.</li>
</ol>
{cards}
</main>
<script>
const PROMPTS = {data};
const KEY = 'uat-packs-done';
let done = {{}}; try {{ done = JSON.parse(localStorage.getItem(KEY) || '{{}}') }} catch (e) {{}}
document.querySelectorAll('.pack').forEach(sec => {{
  const id = sec.dataset.id, box = sec.querySelector('.done input')
  box.checked = !!done[id]; sec.classList.toggle('is-done', box.checked)
  box.addEventListener('change', () => {{
    done[id] = box.checked; sec.classList.toggle('is-done', box.checked)
    try {{ localStorage.setItem(KEY, JSON.stringify(done)) }} catch (e) {{}}
  }})
}})
document.querySelectorAll('button.copy').forEach(b => b.addEventListener('click', async () => {{
  const text = PROMPTS[b.dataset.i]
  try {{ await navigator.clipboard.writeText(text) }} catch (e) {{
    const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select()
    document.execCommand('copy'); t.remove()
  }}
  const old = b.textContent; b.textContent = 'Đã copy ✓'; setTimeout(() => b.textContent = old, 1500)
}}))
document.querySelectorAll('button.view').forEach(b => b.addEventListener('click', () => {{
  const pre = b.closest('.pack').querySelector('pre')
  if (!pre.textContent) pre.textContent = PROMPTS[b.dataset.i]
  pre.hidden = !pre.hidden; b.textContent = pre.hidden ? 'Xem nội dung' : 'Ẩn nội dung'
}}))
</script></body></html>
"""
    (HERE / "bo-test.html").write_text(page, encoding="utf-8")
    print(f"Đã sinh bo-test.html — {len(packs)} gói")


if __name__ == "__main__":
    main()
