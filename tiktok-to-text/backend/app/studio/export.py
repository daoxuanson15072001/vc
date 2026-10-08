"""Xuất hồ sơ chiến dịch (Markdown) — mở bằng Word / Google Docs / Notion."""

from __future__ import annotations

import re

from .. import db
from .ai import FLOWS, channel_label, flows_of
from .worker import plans_of


def _clock(sec) -> str:
    sec = int(sec or 0)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def _cell(text) -> str:
    return str(text or "").replace("|", "/").replace("\n", " ")


def _bullets(items) -> list[str]:
    return [f"- {x}" for x in items or []]


def _review(sc: dict) -> list[str]:
    rv = sc.get("review") or {}
    L = [f"- Điểm giám khảo AI: **{rv.get('total')}/100** — {rv.get('verdict')}"] if rv else []
    failed = [c for c in sc.get("checks") or [] if not c["ok"]]
    if failed:
        L.append("- Kiểm tra tự động chưa đạt: " + "; ".join(f"{c['label']} ({c['detail']})" for c in failed))
    return L


def _sources(c: dict) -> list[str]:
    L = []
    if c.get("facts_to_verify"):
        L += ["**Cần kiểm chứng trước khi đăng:**", *_bullets(c["facts_to_verify"]), ""]
    src = c.get("sources") or {}
    if src:
        L += [f"**Căn cứ:** {', '.join((src.get('refs') or []) + (src.get('cards') or []))} — {src.get('notes')}", ""]
    return L


def video_markdown(sc: dict) -> list[str]:
    c, ep = sc.get("content") or {}, sc.get("episode") or {}
    L = [f"### Tập {sc['episode_no']}: {c.get('title') or ep.get('title')}", ""]
    if c.get("logline"):
        L += [f"*{c['logline']}*", ""]
    L += [f"- Hình thức: {c.get('format')} · {c.get('duration_sec')} giây · Giọng: {c.get('persona_voice')}", *_review(sc)]
    h = c.get("hook") or {}
    L += ["", "**Hook (3 giây đầu)**", f"- Lời: “{h.get('voice')}”", f"- Chữ trên màn hình: {h.get('on_screen_text')}",
          f"- Hình: {h.get('visual')}", "", "| Thời gian | Cảnh quay | Hình ảnh / B-roll | Lời thoại | Chữ trên màn hình | Âm thanh |",
          "|---|---|---|---|---|---|"]
    for s in c.get("scenes") or []:
        L.append(f"| {_clock(s.get('start_sec'))}–{_clock(s.get('end_sec'))} | {_cell(s.get('shot'))} | {_cell(s.get('visual'))} "
                 f"| {_cell(s.get('voice'))} | {_cell(s.get('on_screen_text'))} | {_cell(s.get('sound'))} |")
    e = c.get("ending") or {}
    L += ["", f"**Kết + CTA:** “{e.get('voice')}” — chữ: {e.get('on_screen_text')} — hình: {e.get('visual')}", "",
          f"**Caption:** {c.get('caption')}", "", f"**Hashtag:** {' '.join(c.get('hashtags') or [])}", ""]
    if c.get("alt_hooks"):
        L += ["**Hook thay thế (A/B):**", *_bullets(c["alt_hooks"]), ""]
    p = c.get("production") or {}
    L += ["**Ghi chú sản xuất**", f"- Nhân vật: {', '.join(p.get('cast') or [])}", f"- Bối cảnh: {', '.join(p.get('locations') or [])}",
          f"- Đạo cụ: {', '.join(p.get('props') or [])}", f"- Thiết bị: {', '.join(p.get('equipment') or [])}",
          f"- Quay: {p.get('shooting_notes')}", f"- Dựng: {p.get('editing_notes')}", f"- Thời gian: {p.get('time_estimate')}", ""]
    return L + _sources(c)


def _demote(body: str) -> str:
    """Heading của thân bài (## …) nằm dưới "### Bài N" trong hồ sơ -> lùi 3 cấp để không phá mục lục."""
    return re.sub(r"^(#{1,6})(?=\s)", lambda m: "#" * min(6, len(m.group(1)) + 3), body, flags=re.M)


def seo_markdown(sc: dict) -> list[str]:
    c, o, ep = sc.get("content"), sc.get("outline") or {}, sc.get("episode") or {}
    if not c:   # mới có dàn ý
        L = [f"### Bài {sc['episode_no']} (dàn ý): {o.get('h1') or ep.get('title')}", "",
             f"- Từ khoá chính: **{o.get('primary_keyword')}** · ý định: {o.get('search_intent')} · ~{o.get('target_words')} chữ",
             f"- Góc viết: {o.get('angle')}", ""]
        for s in o.get("sections") or []:
            L.append(f"{'  ' if s.get('level') == 3 else ''}- **{s.get('heading')}** — {'; '.join(s.get('points') or [])}")
        return L + [""]
    L = [f"### Bài {sc['episode_no']}: {c.get('h1')}", "", *_review(sc),
         f"- Slug: `{c.get('slug')}`", f"- Meta title: {c.get('meta_title')}", f"- Meta description: {c.get('meta_description')}",
         f"- Từ khoá chính: **{c.get('primary_keyword')}** · phụ: {', '.join(c.get('secondary_keywords') or [])}",
         f"- Tác giả: {c.get('author')}", "", "---", "", f"#### {c.get('h1')}", "", _demote(c.get("body") or ""), ""]
    if c.get("faq"):
        L += ["##### Câu hỏi thường gặp", ""] + [f"**{f['q']}**\n\n{f['a']}\n" for f in c["faq"]]
    L += ["---", ""]
    if c.get("images"):
        L += ["**Ảnh cần chuẩn bị**", *[f"- {i['placement']}: {i['description']} — alt: “{i['alt']}” — `{i['filename']}`"
                                      for i in c["images"]], ""]
    if c.get("external_sources"):
        L += ["**Nguồn nên trích**", *[f"- {s['source_name']}: {s['what_to_cite']} {s.get('url') or ''}"
                                      for s in c["external_sources"]], ""]
    if c.get("schema_jsonld"):
        L += ["**Schema JSON-LD**", "", "```json", c["schema_jsonld"], "```", ""]
    return L + _sources(c)


def social_markdown(sc: dict) -> list[str]:
    c, ep = sc.get("content") or {}, sc.get("episode") or {}
    hooks = c.get("hooks") or []
    L = [f"### Bài {sc['episode_no']} — {channel_label(ep.get('channel'))}: {c.get('title') or ep.get('title')}", "",
         *_review(sc), f"- Người đứng tên: {c.get('author') or '—'} · giờ đăng: {c.get('best_time')}", "",
         "**Bài đăng (mở đầu phương án 1):**", "", (hooks[0] if hooks else ""), "", c.get("body") or "", "",
         " ".join(c.get("hashtags") or []), ""]
    if len(hooks) > 1:
        L += ["**Mở đầu thay thế (A/B):**", *_bullets(hooks[1:]), ""]
    link = c.get("link")
    if link:
        L += [f"**Link ({c.get('link_placement')}):** {link['utm_url']}", ""]
    if c.get("first_comment"):
        L += [f"**Bình luận đầu:** {c['first_comment']}", ""]
    v = c.get("visual") or {}
    L += [f"**Hình ảnh:** {v.get('type')} — {v.get('description')}", *_bullets(v.get("slides")), ""]
    return L + _sources(c)


RENDER = {"video": video_markdown, "seo": seo_markdown, "social": social_markdown}
PIECE_NAME = {"video": "Kịch bản video", "seo": "Bài SEO", "social": "Bài mạng xã hội"}


def plan_markdown(flow: str, plan: dict) -> list[str]:
    L = [f"- **Nhịp đăng:** {plan.get('cadence')}"]
    if plan.get("posting_times"):
        L.append(f"- **Khung giờ:** {'; '.join(plan['posting_times'])}")
    if flow == "video":
        L += ["", "| # | Tuần | Ngày | Trụ | Tên tập | Hook | Hình thức | Giây | CTA | Căn cứ | Dự đoán |",
              "|---|---|---|---|---|---|---|---|---|---|---|"]
        for e in plan.get("episodes") or []:
            L.append(f"| {e['no']} | {e['week']} | {_cell(e['day'])} | {_cell(e['pillar'])} | {_cell(e['title'])} | {_cell(e['hook'])} "
                     f"| {_cell(e['format'])} | {e['duration_sec']} | {_cell(e['cta'])} | {', '.join(e['refs'] + e['cards'])} | {e['predicted_score']} |")
        if plan.get("production_batches"):
            L += ["", "**Lịch quay gộp**", *[f"- {p['batch']}: tập {', '.join(map(str, p['episodes']))} — {p['timing']}. {p['notes']}"
                                             for p in plan["production_batches"]]]
    elif flow == "seo":
        cl = plan.get("cluster") or {}
        L += [f"- **Bài trụ:** {cl.get('pillar_topic')} — từ khoá “{cl.get('pillar_keyword')}”. {cl.get('rationale')}",
              f"- **Liên kết nội bộ:** {plan.get('internal_linking')}", "",
              "| # | Tuần | Vai trò | Tiêu đề | Từ khoá chính | Ý định | Góc viết | Chữ | Liên kết tới | Dự đoán |",
              "|---|---|---|---|---|---|---|---|---|---|"]
        for e in plan.get("episodes") or []:
            L.append(f"| {e['no']} | {e['week']} | {_cell(e['role'])} | {_cell(e['title'])} | {_cell(e['primary_keyword'])} "
                     f"| {_cell(e['search_intent'])} | {_cell(e['angle'])} | {e['target_words']} | {', '.join(map(str, e['links_to']))} | {e['predicted_score']} |")
    else:
        L += [f"- **Tỷ trọng:** {plan.get('mix')}", "",
              "| # | Tuần | Ngày | Kênh | Người đứng tên | Loại | Định dạng | Tên bài | Mở đầu | Link | Dự đoán |",
              "|---|---|---|---|---|---|---|---|---|---|---|"]
        for e in plan.get("episodes") or []:
            L.append(f"| {e['no']} | {e['week']} | {_cell(e['day'])} | {_cell(channel_label(e['channel']))} | {_cell(e['author'])} "
                     f"| {_cell(e['post_type'])} | {_cell(e['format'])} | {_cell(e['title'])} | {_cell(e['hook'])} | {_cell(e['link'])} | {e['predicted_score']} |")
    return L


def campaign_markdown(camp: dict, script_rows: list[dict]) -> str:
    b, st, flows = camp["brief"], camp.get("strategy") or {}, flows_of(camp)
    s, cp, plans = st.get("strategy") or {}, st.get("campaign") or {}, plans_of(camp)
    L = [f"# {camp['name']}", "", f"_Xuất từ VC Content Engine · {db.now().astimezone():%d/%m/%Y %H:%M}_", "",
         "## 1. Brief", "", f"- **Luồng:** {', '.join(FLOWS[f] for f in flows)}"]
    for label, key in [("Sản phẩm / thương hiệu", "product"), ("Mục tiêu", "goal"), ("Đối tượng", "audience"),
                       ("CTA", "cta"), ("Giới hạn", "constraints"), ("Ghi chú", "notes")]:
        if b.get(key):
            L.append(f"- **{label}:** {b[key]}")
    if "video" in flows:
        L.append(f"- **Video:** {b.get('platform')} · {b['weeks']} tuần × {b['posts_per_week']} video/tuần · "
                 f"{b.get('video_length')} · nhân vật: {b.get('persona') or '—'}")
    if "seo" in flows:
        so = b.get("seo") or {}
        L.append(f"- **SEO:** {so.get('website')} · từ khoá: {so.get('keywords')} · trang đích: {so.get('landing_url')} · "
                 f"{so.get('per_week')} bài/tuần")
    if "social" in flows:
        so = b.get("social") or {}
        L.append(f"- **MXH:** {', '.join(channel_label(c) for c in so.get('channels') or [])} · {so.get('per_week')} bài/tuần"
                 f" · link: {so.get('link_url') or '—'}")
    ba = st.get("brief_analysis") or {}
    if ba.get("open_questions"):
        L += ["", "**Câu hỏi cần chốt:**", *_bullets(ba["open_questions"])]

    L += ["", "## 2. Tham chiếu"]
    if camp.get("references"):
        L += ["", "| Mã | Kênh | Lượt xem | Viral score | Hook | Vì sao hiệu quả |", "|---|---|---|---|---|---|"]
        dna = {d["ref"]: d for d in st.get("reference_analysis") or []}
        for r in camp["references"]:
            d = dna.get(r["ref"], {})
            L.append(f"| [{r['ref']}]({r.get('url')}) | @{r.get('channel_handle')} | {r.get('views') or 0:,} "
                     f"| {r.get('metrics', {}).get('viral_score')} | {_cell(d.get('hook_text'))} | {_cell(d.get('why_it_works'))} |")
    if camp.get("competitors"):
        L += ["", "**Trang đối thủ (SEO)**", *[f"- {p['ref']}: [{p.get('title') or p['url']}]({p['url']}) — "
                                               f"{p.get('words') or '?'} chữ{' — lỗi: ' + p['error'] if p.get('error') else ''}"
                                               for p in camp["competitors"]]]
    if camp.get("social_refs"):
        L += ["", "**Bài MXH mẫu**", *[f"- {p['ref']} ({channel_label(p.get('channel'))}): {_cell(p['text'][:160])}…"
                                       for p in camp["social_refs"]]]
    if camp.get("authors"):
        L += ["", "**Người đứng tên**", *[f"- {a['ref']}: {a['name']} — {a.get('title') or ''}" for a in camp["authors"]]]
    if st.get("insights"):
        L += ["", "**Insight khán giả**", *[f"- {i['insight']} _(căn cứ: {i['evidence']}; {', '.join(i['refs'])})_" for i in st["insights"]]]

    if s:
        L += ["", "## 3. Chiến lược", "", f"- **Mục tiêu:** {s.get('objective')}", f"- **Bối cảnh:** {s.get('market_context')}",
              f"- **Định vị:** {s.get('positioning')}", f"- **Thông điệp chủ đạo:** {s.get('key_message')}",
              f"- **Giọng điệu:** {s.get('tone_of_voice')}", f"- **Nhân vật:** {s.get('persona')}", "",
              "**Khán giả mục tiêu**"]
        for a in s.get("audiences") or []:
            L += [f"- **{a['name']}** — {a['profile']}. Nỗi đau: {'; '.join(a['pains'])}. Mong muốn: {'; '.join(a['desires'])}. "
                  f"Thói quen: {a['content_habits']}"]
        L += ["", "**Lý do tin**", *_bullets(s.get("reasons_to_believe")), "", "**Trụ nội dung**", "",
              "| Trụ | Mục đích | Tỷ trọng | Hình thức | Căn cứ |", "|---|---|---|---|---|"]
        for p in s.get("pillars") or []:
            L.append(f"| {_cell(p['name'])} | {_cell(p['purpose'])} | {p['share_pct']}% | {_cell(', '.join(p['formats']))} | {', '.join(p['refs'])} |")
        L += ["", "**Nên**", *_bullets(s.get("dos")), "", "**Không nên**", *_bullets(s.get("donts"))]
    sr = st.get("seo_research")
    if sr:
        L += ["", "**Nghiên cứu SEO**", f"- Độ dài mục tiêu: ~{sr.get('target_words')} chữ",
              f"- Chủ đề bắt buộc: {'; '.join(sr.get('must_cover') or [])}",
              f"- Khoảng trống: {'; '.join(sr.get('content_gaps') or [])}", "",
              "| Từ khoá | Ý định | Ghi chú |", "|---|---|---|",
              *[f"| {_cell(k['keyword'])} | {_cell(k['intent'])} | {_cell(k['note'])} |" for k in sr.get("keyword_ideas") or []]]

    if cp:
        L += ["", "## 4. Chiến dịch", "", f"- **Tên:** {cp.get('name')}", f"- **Big idea:** {cp.get('big_idea')}",
              f"- **Tagline:** {cp.get('tagline')}", f"- **CTA:** {cp.get('cta')}", "", "**Giai đoạn**", "",
              "| Giai đoạn | Thời gian | Mục tiêu | Trọng tâm nội dung | KPI |", "|---|---|---|---|---|"]
        for p in cp.get("phases") or []:
            L.append(f"| {_cell(p['name'])} | {_cell(p['weeks'])} | {_cell(p['objective'])} | {_cell(p['content_focus'])} | {_cell(p['kpi'])} |")
        L += ["", "**Kênh**", *[f"- {c['platform']}: {c['role']} ({c['frequency']})" for c in cp.get("channels") or []],
              "", "**KPI**", *[f"- {k['metric']}: {k['target']} — đo: {k['how_to_measure']}" for k in cp.get("kpis") or []],
              "", "**Nguồn lực**", *_bullets(cp.get("resources")), "", f"**Ngân sách:** {cp.get('budget_notes')}",
              "", "**Rủi ro**", *[f"- {r['risk']} → {r['mitigation']}" for r in cp.get("risks") or []]]

    n = 5
    for flow in flows:
        if plans.get(flow):
            L += ["", f"## {n}. Kế hoạch — {FLOWS[flow]}", "", *plan_markdown(flow, plans[flow])]
            n += 1
    for flow in ("video", "seo", "social"):
        done = [sc for sc in script_rows if (sc.get("flow") or "video") == flow and (sc.get("content") or sc.get("outline"))]
        if done:
            L += ["", f"## {n}. {PIECE_NAME[flow]}", ""]
            for sc in done:
                L += RENDER[flow](sc)
            n += 1
    if camp.get("cards"):
        L += ["", "## Phụ lục — thẻ VCWIKI đã dùng", *[f"- {c['ref']}: {c['title']}" for c in camp["cards"]]]
    return "\n".join(L) + "\n"
