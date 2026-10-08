"""Prompt + schema cho Xưởng chiến dịch — 3 luồng: video ngắn, bài SEO, bài mạng xã hội (BA mục 5.5, 5.7–5.9).

Mọi lời gọi Claude đi qua kb.wiki.structured_call (structured output).
"""

from __future__ import annotations

import json

from ..config import STUDIO_MODEL
from ..kb.wiki import structured_call

S = {"type": "string"}
I = {"type": "integer"}


def arr(items: dict) -> dict:
    return {"type": "array", "items": items}


def obj(**props) -> dict:
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


STRS = arr(S)

FLOWS = {"video": "Video ngắn (TikTok / Reels / Shorts)", "seo": "Bài viết website chuẩn SEO",
         "social": "Bài đăng mạng xã hội"}

# Kênh của luồng MXH. personal: đứng tên người thật -> bắt buộc có hồ sơ người đứng tên đã đồng ý (CE-18).
# max_chars là mức khuyến nghị để đọc thoải mái (LinkedIn chặn cứng ở 3.000 ký tự).
CHANNELS = {
    "fb_personal": {"label": "Facebook cá nhân", "personal": True, "max_chars": 2000, "hashtags": (0, 3),
                    "utm_source": "facebook"},
    "fanpage": {"label": "Fanpage Facebook", "personal": False, "max_chars": 1500, "hashtags": (0, 5),
                "utm_source": "facebook"},
    "linkedin": {"label": "LinkedIn cá nhân", "personal": True, "max_chars": 3000, "hashtags": (3, 5),
                 "utm_source": "linkedin"},
    "linkedin_page": {"label": "Trang LinkedIn công ty", "personal": False, "max_chars": 3000, "hashtags": (3, 5),
                      "utm_source": "linkedin"},
    "other": {"label": "Kênh ngoài khác (Zalo OA, nhóm, diễn đàn, trang đối tác…)", "personal": False,
              "max_chars": 2000, "hashtags": (0, 3), "utm_source": "other"},
}

BASE_SYSTEM = """Bạn là giám đốc chiến lược nội dung đa kênh của tập đoàn VC Phồn Vinh (phụ tùng ô tô, garage, đào tạo \
nghề ô tô, phần mềm quản lý). Bạn phụ trách 3 luồng: bài viết website chuẩn SEO, video ngắn (TikTok, Reels, Shorts) \
và bài đăng mạng xã hội (Facebook cá nhân, Fanpage, LinkedIn, kênh ngoài). Bạn làm việc dựa trên dữ liệu thật: video \
tham chiếu đã chuyển chữ kèm số liệu, trang đối thủ trên Google, bài mạng xã hội mẫu, hồ sơ người đứng tên và thẻ tri \
thức VCWIKI của công ty.

Nguyên tắc:
- Học cấu trúc, cách mở đầu, nhịp và góc nhìn của tham chiếu — KHÔNG sao chép câu chữ, không đạo ý tưởng độc quyền.
- Không bịa số liệu, lời chứng thực, trải nghiệm cá nhân, cam kết (lương, thu nhập, hiệu quả), lượng tìm kiếm hay URL. \
Chỗ cần số liệu / chuyện thật thì ghi rõ "[cần xác minh: …]" hoặc "[cần chuyện thật: …]" để người làm bổ sung.
- Luôn trích căn cứ bằng mã: R1… (video), S1… (trang đối thủ), P1… (bài MXH mẫu), A1… (người đứng tên), K1… (thẻ \
VCWIKI). Chỉ dùng mã có trong dữ liệu.
- Viết tiếng Việt tự nhiên, cụ thể, làm được ngay; tránh sáo rỗng kiểu "nâng cao nhận thức", "lan toả giá trị".
- Phần mở đầu quyết định tất cả: 3 giây đầu của video, 2–3 dòng đầu của bài mạng xã hội, đoạn đầu của bài SEO. \
Không mở đầu bằng chào hỏi hay giới thiệu bản thân."""


def flows_of(camp: dict) -> list[str]:
    return camp.get("flows") or ["video"]


def targets_of(camp: dict) -> dict:
    return camp.get("targets") or {"video": camp.get("episodes_target") or 0}


def channel_label(ch: str | None) -> str:
    return CHANNELS.get(ch or "", {}).get("label", ch or "")


# ---------------------------------------------------------------------------
# Dữ liệu đưa vào prompt
# ---------------------------------------------------------------------------

def brief_text(camp: dict) -> str:
    b, flows, t = camp["brief"], flows_of(camp), targets_of(camp)
    rows = [
        ("Tên chiến dịch / series", b.get("name")),
        ("Sản phẩm / thương hiệu", b.get("product")),
        ("Mục tiêu kinh doanh", b.get("goal")),
        ("Đối tượng", b.get("audience")),
        ("Luồng nội dung", ", ".join(FLOWS[f] for f in flows)),
        ("Thời lượng chiến dịch", f"{b.get('weeks')} tuần"),
        ("CTA mong muốn", b.get("cta")),
        ("Giới hạn / điều cấm", b.get("constraints")),
        ("Ghi chú thêm", b.get("notes")),
    ]
    if "video" in flows:
        rows += [("Video — nền tảng", b.get("platform")),
                 ("Video — số tập", f"{b.get('posts_per_week')} video/tuần → {t.get('video')} tập, "
                                    f"mỗi video {b.get('video_length')}"),
                 ("Video — nhân vật / giọng kể", b.get("persona"))]
    if "seo" in flows:
        s = b.get("seo") or {}
        rows += [("SEO — website", s.get("website")), ("SEO — trang đích chuyển đổi", s.get("landing_url")),
                 ("SEO — từ khoá hạt giống", s.get("keywords")), ("SEO — khu vực", s.get("location")),
                 ("SEO — số bài", f"{s.get('per_week')} bài/tuần → {t.get('seo')} bài")]
    if "social" in flows:
        s = b.get("social") or {}
        rows += [("MXH — kênh", ", ".join(f"{channel_label(c)} (mã {c})" for c in s.get("channels") or [])),
                 ("MXH — số bài", f"{s.get('per_week')} bài/tuần → {t.get('social')} bài"),
                 ("MXH — link muốn dẫn về", s.get("link_url"))]
    return "<brief>\n" + "\n".join(f"- {k}: {v}" for k, v in rows if v) + "\n</brief>"


def refs_text(videos: list[dict], max_chars: int = 1800) -> str:
    """videos: [{ref, video, metrics}] — video là document đầy đủ trong `videos`."""
    if not videos:
        return "<video_tham_chieu>(không có)</video_tham_chieu>"
    parts = []
    for r in videos:
        v, m = r["video"], r.get("metrics") or {}
        stats = (f"views={v.get('views')} likes={v.get('likes')} comments={v.get('comments')} "
                 f"shares={v.get('shares')} dài={v.get('duration')}s viral_score={m.get('viral_score')} "
                 f"gấp_trung_vị_kênh={m.get('outlier')} tỷ_lệ_chia_sẻ={m.get('share_rate')}")
        transcript = (v.get("transcript") or "").strip()
        if len(transcript) > max_chars:
            transcript = transcript[:max_chars] + " …(cắt bớt)"
        parts.append(f'<video ma="{r["ref"]}" kenh="@{v.get("channel_handle")}" {stats}>\n'
                     f'Caption: {(v.get("caption") or "").strip()[:400]}\nLời nói: {transcript}\n</video>')
    return "<video_tham_chieu>\n" + "\n\n".join(parts) + "\n</video_tham_chieu>"


def pages_text(pages: list[dict], max_chars: int = 3000) -> str:
    """Trang đối thủ top Google (luồng SEO) — đã tải về ở bước đầu của chiến dịch."""
    ok = [p for p in pages if p.get("status") == "ok"]
    if not ok:
        return "<trang_doi_thu>(không có)</trang_doi_thu>"
    parts = []
    for p in ok:
        text = (p.get("text") or "")
        if len(text) > max_chars:
            text = text[:max_chars] + " …(cắt bớt)"
        parts.append(f'<trang ma="{p["ref"]}" url="{p["url"]}" so_chu="{p.get("words")}">\n'
                     f'Tiêu đề: {p.get("title")}\nDàn ý: {" | ".join(p.get("headings") or [])[:1500]}\n'
                     f'Nội dung: {text}\n</trang>')
    return "<trang_doi_thu>\n" + "\n\n".join(parts) + "\n</trang_doi_thu>"


def posts_text(posts: list[dict]) -> str:
    if not posts:
        return "<bai_mxh_mau>(không có)</bai_mxh_mau>"
    parts = [f'<bai ma="{p["ref"]}" kenh="{channel_label(p.get("channel"))}" so_lieu="{p.get("metrics") or ""}">\n'
             f'{p["text"][:3000]}\n</bai>' for p in posts]
    return "<bai_mxh_mau>\n" + "\n\n".join(parts) + "\n</bai_mxh_mau>"


AUTHOR_FIELDS = [("title", "Chức danh"), ("expertise", "Lĩnh vực / kinh nghiệm"), ("voice", "Giọng, cách xưng hô"),
                 ("catchphrases", "Câu cửa miệng"), ("topics_ok", "Chủ đề được nói"),
                 ("topics_avoid", "Chủ đề KHÔNG được nói")]


def authors_text(authors: list[dict], samples: bool = False) -> str:
    if not authors:
        return "<nguoi_dung_ten>(không có)</nguoi_dung_ten>"
    parts = []
    for a in authors:
        rows = [f"- {label}: {a[k]}" for k, label in AUTHOR_FIELDS if a.get(k)]
        if samples and a.get("samples"):
            rows.append("Bài mẫu do chính người này viết (học giọng, KHÔNG chép):\n" +
                        "\n---\n".join(s[:2500] for s in a["samples"]))
        parts.append(f'<nguoi ma="{a["ref"]}" ten="{a["name"]}">\n' + "\n".join(rows) + "\n</nguoi>")
    return "<nguoi_dung_ten>\n" + "\n\n".join(parts) + "\n</nguoi_dung_ten>"


def site_text(urls: list[str], limit: int = 200) -> str:
    if not urls:
        return "<url_tren_website>(chưa có — không được tự đặt URL nội bộ, để trống url)</url_tren_website>"
    return "<url_tren_website>\n" + "\n".join(urls[:limit]) + "\n</url_tren_website>"


def cards_text(cards: list[dict]) -> str:
    if not cards:
        return "<vcwiki>(không có thẻ liên quan)</vcwiki>"
    parts = []
    for c in cards:
        body = (c.get("body") or "")[:1200]
        parts.append(f'<the ma="{c["ref"]}" loai="{c.get("type")}">\n{c.get("title")}\n{c.get("summary", "")}\n{body}\n</the>')
    return "<vcwiki>\n" + "\n\n".join(parts) + "\n</vcwiki>"


def dump(x) -> str:
    return json.dumps(x, ensure_ascii=False)


def analysis_text(a: dict | None) -> str:
    """Phân tích dự án đã chốt (studio/analysis.py) — nạp vào mọi prompt của chiến dịch / Viết nhanh thuộc dự án."""
    if not a:
        return ""
    from .analysis import FRAMEWORKS   # tránh import vòng
    fw = FRAMEWORKS.get(a.get("framework") or "7p") or FRAMEWORKS["7p"]
    rows = []
    for k, label, _ in fw["sections"]:
        sec = (a.get("sections") or {}).get(k) or {}
        if sec.get("text"):
            ev = f" [căn cứ: {', '.join(sec['evidence'])}]" if sec.get("evidence") else ""
            rows.append(f"- {label}: {sec['text']}{ev}")
    body = (f"Tóm tắt: {a['summary']}\n" if a.get("summary") else "") + "\n".join(rows)
    return (f'<phan_tich_du_an khung="{fw["label"]}" phien_ban="{a.get("version")}">\n{body}\n</phan_tich_du_an>\n'
            "Mọi chiến lược và nội dung phải nhất quán với phân tích này (định vị, giá, kênh, con người, bằng chứng).")


# ---------------------------------------------------------------------------
# Bước 1 — phân tích tham chiếu, chiến lược, chiến dịch (chung cho mọi luồng)
# ---------------------------------------------------------------------------

def strategy_schema(flows: list[str]) -> dict:
    props = dict(
        brief_analysis=obj(summary=S, assumptions=STRS, open_questions=STRS),
        reference_analysis=arr(obj(ref=S, hook_text=S, hook_type=S, structure=S, emotion=S, format=S,
                                   why_it_works=S, takeaway=S)),
        insights=arr(obj(insight=S, evidence=S, refs=STRS)),
        strategy=obj(
            objective=S, market_context=S,
            audiences=arr(obj(name=S, profile=S, pains=STRS, desires=STRS, content_habits=S)),
            positioning=S, key_message=S, reasons_to_believe=STRS, tone_of_voice=S, persona=S,
            pillars=arr(obj(name=S, purpose=S, share_pct=I, formats=STRS, refs=STRS)),
            dos=STRS, donts=STRS,
        ),
        campaign=obj(
            name=S, big_idea=S, tagline=S,
            phases=arr(obj(name=S, weeks=S, objective=S, content_focus=S, kpi=S)),
            channels=arr(obj(platform=S, role=S, frequency=S)),
            kpis=arr(obj(metric=S, target=S, how_to_measure=S)),
            cta=S, resources=STRS, budget_notes=S,
            risks=arr(obj(risk=S, mitigation=S)),
        ),
    )
    if "seo" in flows:
        props["seo_research"] = obj(
            keyword_ideas=arr(obj(keyword=S, intent=S, note=S)),
            serp_pages=arr(obj(ref=S, page_type=S, word_count=I, outline=STRS, subtopics=STRS, questions=STRS,
                               weaknesses=S)),
            must_cover=STRS, content_gaps=STRS, target_words=I,
        )
    if "social" in flows:
        props["social_analysis"] = arr(obj(ref=S, hook=S, structure=S, format=S, cta_type=S, why_it_works=S,
                                           takeaway=S))
    return obj(**props)


def strategy_task(flows: list[str]) -> str:
    task = """Nhiệm vụ: từ brief và dữ liệu tham chiếu, lập CHIẾN LƯỢC và CHIẾN DỊCH nội dung dùng chung cho mọi luồng \
đã chọn.

1. brief_analysis: tóm brief; giả định bạn phải đặt ra; câu hỏi mở người làm cần trả lời (3–5 câu).
2. reference_analysis: mổ xẻ ADN của TỪNG video tham chiếu R… (hook nguyên văn 3 giây đầu, kiểu hook, cấu trúc theo \
nhịp, cảm xúc, hình thức, vì sao hiệu quả — gắn với số liệu, bài học rút ra). Không có video thì để mảng rỗng.
3. insights: 4–8 insight khán giả rút từ dữ liệu; mỗi insight có căn cứ và mã tham chiếu.
4. strategy: mục tiêu đo được, bối cảnh, 1–3 nhóm khán giả (nỗi đau, mong muốn, thói quen tìm / xem / đọc), định vị, \
thông điệp chủ đạo, lý do tin, giọng điệu, nhân vật / người đứng tên, 3–5 trụ nội dung dùng chung cho các luồng (tỷ \
trọng % cộng lại 100; formats ghi rõ dạng nội dung ở từng luồng), nên / không nên.
5. campaign: tên, big idea, tagline, các giai đoạn theo tuần (vd "Tuần 1–2"), vai trò từng kênh + tần suất (đủ mọi \
kênh của các luồng đã chọn), KPI có mục tiêu số và cách đo theo từng luồng, CTA, nguồn lực, ngân sách, rủi ro + cách giảm."""
    if "seo" in flows:
        task += """
6. seo_research: 15–30 ý tưởng từ khoá từ từ khoá hạt giống, gom theo ý định tìm kiếm (tìm hiểu / so sánh / mua / địa \
phương) — KHÔNG bịa lượng tìm kiếm, note chỉ ghi vì sao đáng làm. serp_pages: mổ xẻ từng trang đối thủ S… (loại trang, \
số chữ, dàn ý chính, chủ đề con, câu hỏi được trả lời, điểm yếu). must_cover: chủ đề con bắt buộc có. content_gaps: \
khoảng trống chưa trang nào làm tốt mà công ty có lợi thế. target_words: độ dài mục tiêu (theo trung vị đối thủ; không \
có trang đối thủ thì ước lượng theo ý định tìm kiếm)."""
    if "social" in flows:
        task += """
7. social_analysis: mổ xẻ từng bài MXH mẫu P… (mở đầu nguyên văn, cấu trúc, định dạng, kiểu CTA, vì sao hiệu quả, bài \
học). Không có bài mẫu thì để mảng rỗng."""
    return task


def generate_strategy(camp: dict, inputs: dict) -> dict:
    flows = flows_of(camp)
    parts = [brief_text(camp), analysis_text(inputs.get("analysis")), refs_text(inputs["videos"]), cards_text(inputs["cards"])]
    if "seo" in flows:
        parts += [pages_text(inputs["pages"]), site_text(inputs["site_urls"], 100)]
    if "social" in flows:
        parts += [posts_text(inputs["posts"]), authors_text(inputs["authors"])]
    parts.append(strategy_task(flows))
    return structured_call(BASE_SYSTEM, "\n\n".join(x for x in parts if x), strategy_schema(flows), max_tokens=32000,
                           model=STUDIO_MODEL)


def strategy_context(strategy: dict, keys=("strategy", "campaign", "insights")) -> str:
    return "<chien_luoc_da_duyet>\n" + dump({k: strategy.get(k) for k in keys if strategy.get(k)}) + "\n</chien_luoc_da_duyet>"


# ---------------------------------------------------------------------------
# Bước 2 — kế hoạch riêng từng luồng (mọi luồng đều trả `episodes`, đánh số từ 1)
# ---------------------------------------------------------------------------

PLAN_SCHEMAS = {
    "video": obj(
        cadence=S, posting_times=STRS,
        episodes=arr(obj(no=I, week=I, day=S, phase=S, pillar=S, title=S, hook=S, format=S, duration_sec=I,
                         key_message=S, cta=S, refs=STRS, cards=STRS, rationale=S, predicted_score=I)),
        production_batches=arr(obj(batch=S, episodes=arr(I), timing=S, notes=S)),
    ),
    "seo": obj(
        cadence=S, cluster=obj(pillar_topic=S, pillar_keyword=S, rationale=S), internal_linking=S,
        episodes=arr(obj(no=I, week=I, day=S, role=S, pillar=S, title=S, primary_keyword=S,
                         secondary_keywords=STRS, search_intent=S, angle=S, target_words=I, links_to=arr(I),
                         cta=S, refs=STRS, cards=STRS, rationale=S, predicted_score=I)),
    ),
    "social": obj(
        cadence=S, posting_times=STRS, mix=S,
        episodes=arr(obj(no=I, week=I, day=S, channel=S, author=S, pillar=S, post_type=S, format=S, title=S,
                         hook=S, key_message=S, cta=S, link=S, refs=STRS, cards=STRS, rationale=S,
                         predicted_score=I)),
    ),
}


def plan_task(flow: str, n: int, camp: dict) -> str:
    if flow == "video":
        return f"""Nhiệm vụ: lập KẾ HOẠCH VIDEO NGẮN gồm đúng {n} tập, bám chiến lược và chiến dịch ở trên.

- Mỗi tập: số thứ tự (no, từ 1), tuần, thứ đăng (vd "Thứ 3"), giai đoạn, trụ nội dung (đúng tên trụ đã có), tên tập, \
hook 3 giây đầu (lời nói nguyên văn), hình thức (talking head, POV, kể chuyện, listicle, trước/sau, phỏng vấn đường \
phố…), thời lượng giây, thông điệp chính, CTA, mã video / thẻ làm căn cứ, lý do chọn, điểm dự đoán 0–100.
- Phân bổ trụ theo tỷ trọng; xen kẽ hình thức; tập đầu phải mạnh nhất; có tập nối tiếp để giữ người xem theo series.
- cadence: nhịp đăng; posting_times: khung giờ đăng đề xuất kèm lý do ngắn.
- production_batches: gom tập quay chung buổi (cùng bối cảnh / nhân vật) để tiết kiệm công sản xuất."""
    if flow == "seo":
        return f"""Nhiệm vụ: lập KẾ HOẠCH BÀI SEO gồm đúng {n} bài theo mô hình cụm chủ đề, bám chiến lược ở trên.

- Bài số 1 là bài trụ (role "pillar") nhắm từ khoá rộng nhất; các bài còn lại là bài vệ tinh (role "cluster").
- Mỗi bài MỘT từ khoá chính riêng — không hai bài cùng nhắm một từ khoá, không nhắm từ khoá mà URL có sẵn trên website \
đã nhắm (xem danh sách URL). secondary_keywords 3–6 từ; search_intent: tìm hiểu / so sánh / mua / địa phương.
- Mỗi bài: tuần, thứ đăng, trụ nội dung, tiêu đề dự kiến, góc viết (angle — khác đối thủ ở đâu, dựa khoảng trống nào), \
số chữ mục tiêu, links_to: số thứ tự các bài trong kế hoạch mà bài này liên kết tới (vệ tinh → trụ, trụ → mọi vệ tinh), \
CTA dẫn về trang đích, mã căn cứ (S…, K…), lý do, điểm dự đoán 0–100.
- Đăng bài trụ sớm; xen kẽ ý định tìm kiếm. cluster: chủ đề trụ, từ khoá trụ, lý do. internal_linking: sơ đồ liên kết \
nội bộ bằng lời. cadence: nhịp đăng."""
    s = camp["brief"].get("social") or {}
    chans = ", ".join(f'"{c}" = {channel_label(c)}' for c in s.get("channels") or [])
    personal = [c for c in s.get("channels") or [] if CHANNELS[c]["personal"]]
    return f"""Nhiệm vụ: lập KẾ HOẠCH BÀI MẠNG XÃ HỘI gồm đúng {n} bài, chia cho các kênh: {chans}.

- channel: đúng MÃ kênh ở trên. author: mã A… của người đứng tên — BẮT BUỘC với kênh cá nhân ({", ".join(personal) or "không có"}), \
chọn người hợp chủ đề và "chủ đề được nói" của họ; trang công ty / kênh khác thì để "".
- post_type: "giá trị" / "tương tác" / "bán hàng" — tỷ trọng mặc định ≈ 70 / 20 / 10 trừ khi chiến lược nói khác.
- format: chữ / ảnh / album / carousel / bình chọn / bài dẫn link / video. link: "có" nếu bài dẫn người đọc về \
{s.get("link_url") or "website"}, ngược lại "không".
- Mỗi bài: tuần, thứ đăng, trụ nội dung, tên bài (nội bộ), mở đầu 1–2 dòng nguyên văn (hook), thông điệp chính, CTA, mã \
căn cứ, lý do, điểm dự đoán 0–100. Cùng một ý đăng nhiều kênh thì mỗi kênh một góc và một mở đầu khác nhau.
- cadence: nhịp đăng theo kênh; posting_times: khung giờ đề xuất kèm lý do; mix: tỷ trọng thực tế của kế hoạch."""


def generate_plan(flow: str, camp: dict, strategy: dict, inputs: dict) -> dict:
    parts = [brief_text(camp), cards_text(inputs["cards"])]
    keys = ["strategy", "campaign", "insights"]
    if flow == "video":
        parts.append(refs_text(inputs["videos"], max_chars=600))
        keys.append("reference_analysis")
    elif flow == "seo":
        parts.append(site_text(inputs["site_urls"]))
        keys.append("seo_research")
    else:
        parts += [posts_text(inputs["posts"]), authors_text(inputs["authors"])]
        keys.append("social_analysis")
    parts += [strategy_context(strategy, keys), plan_task(flow, targets_of(camp)[flow], camp)]
    return structured_call(BASE_SYSTEM, "\n\n".join(parts), PLAN_SCHEMAS[flow], max_tokens=32000, model=STUDIO_MODEL)


# ---------------------------------------------------------------------------
# Bước 3 — viết nội dung từng mục + giám khảo chấm
# ---------------------------------------------------------------------------

SOURCES = obj(refs=STRS, cards=STRS, notes=S)

WRITE_SCHEMAS = {
    "video": obj(
        title=S, logline=S, duration_sec=I, format=S, persona_voice=S,
        hook=obj(voice=S, on_screen_text=S, visual=S),
        scenes=arr(obj(start_sec=I, end_sec=I, shot=S, visual=S, voice=S, on_screen_text=S, sound=S)),
        ending=obj(voice=S, on_screen_text=S, visual=S),
        caption=S, hashtags=STRS, alt_hooks=STRS,
        production=obj(cast=STRS, locations=STRS, props=STRS, equipment=STRS, shooting_notes=S, editing_notes=S,
                       time_estimate=S),
        sources=SOURCES, facts_to_verify=STRS,
    ),
    "outline": obj(
        h1=S, primary_keyword=S, secondary_keywords=STRS, search_intent=S, angle=S, target_words=I,
        sections=arr(obj(level=I, heading=S, points=STRS, needs=STRS)),
        faq=STRS, internal_links=arr(obj(anchor=S, url=S, reason=S)), cta=S, sources=SOURCES,
    ),
    "seo": obj(
        h1=S, slug=S, meta_title=S, meta_description=S, primary_keyword=S, secondary_keywords=STRS,
        search_intent=S, body=S, faq=arr(obj(q=S, a=S)),
        internal_links=arr(obj(anchor=S, url=S, placement=S)),
        external_sources=arr(obj(source_name=S, what_to_cite=S, url=S)),
        images=arr(obj(placement=S, description=S, alt=S, filename=S)),
        schema_jsonld=S, author=S, cta=S, sources=SOURCES, facts_to_verify=STRS,
    ),
    "social": obj(
        channel=S, author=S, title=S, hooks=STRS, body=S, cta=S, hashtags=STRS,
        visual=obj(type=S, description=S, slides=STRS),
        first_comment=S, link_placement=S, best_time=S, sources=SOURCES, facts_to_verify=STRS,
    ),
}

WRITE_TASKS = {
    "video": """Nhiệm vụ: viết KỊCH BẢN SẢN XUẤT video ngắn hoàn chỉnh cho mục kế hoạch trên, để ê-kíp cầm đi quay ngay.

- hook: lời nói 3 giây đầu, chữ trên màn hình, hình mở đầu (cảnh gì, góc máy).
- scenes: phân cảnh liên tục theo giây từ 0 đến hết (start_sec/end_sec), mỗi cảnh: cỡ cảnh / góc máy (shot), hình ảnh \
hoặc B-roll (visual), lời thoại nguyên văn (voice), chữ trên màn hình, âm thanh / nhạc / hiệu ứng. Cảnh đầu tiên là \
phần hook. Lời thoại đọc được trong thời lượng (≈ 2,5–3 từ/giây).
- ending: kết + CTA.
- caption (≤ 150 ký tự, có câu gợi bình luận), 5–8 hashtag, 2 hook thay thế để thử A/B.
- production: diễn viên / nhân vật, bối cảnh, đạo cụ, thiết bị, ghi chú quay, ghi chú dựng, ước lượng thời gian sản xuất.
- sources: mã tham chiếu / thẻ đã dùng và học được gì từ đó. facts_to_verify: mọi số liệu / khẳng định cần kiểm chứng \
trước khi đăng.""",
    "outline": """Nhiệm vụ: lập DÀN Ý CHI TIẾT cho bài SEO của mục kế hoạch trên (người duyệt sẽ xem dàn ý trước khi \
viết bài).

- h1 chứa từ khoá chính, tự nhiên; primary_keyword, secondary_keywords, search_intent, angle (khác đối thủ ở đâu).
- sections: các mục theo thứ tự, level 2 (H2) hoặc 3 (H3, nằm dưới một H2); mỗi mục: tiêu đề, 2–5 ý sẽ viết, needs = chỗ \
cần số liệu / chuyện thật / ảnh thật của công ty. Mục đầu tiên trả lời thẳng câu hỏi chính. Phủ đủ chủ đề bắt buộc và \
lấp khoảng trống của đối thủ.
- faq: 3–6 câu hỏi người tìm thật sự hỏi. internal_links: chỉ URL có trong danh sách URL website (không có thì bỏ trống \
mảng). cta dẫn về trang đích. target_words: số chữ dự kiến.""",
    "seo": """Nhiệm vụ: viết BÀI SEO hoàn chỉnh theo dàn ý đã duyệt, sẵn sàng dán vào CMS.

- h1 chứa từ khoá chính. slug: chữ thường không dấu, nối bằng "-", ngắn, chứa từ khoá chính.
- meta_title 50–60 ký tự, từ khoá chính ở đầu. meta_description 120–155 ký tự, nêu lợi ích + lời mời bấm.
- body: Markdown, KHÔNG có dòng H1 (#). Bắt đầu bằng đoạn mở 2–3 câu trả lời thẳng câu hỏi chính và có từ khoá chính; \
sau đó các mục ## / ### theo dàn ý (không nhảy cấp), ít nhất một H2 chứa từ khoá chính. Đoạn ngắn, dùng danh sách / \
bảng khi phù hợp. Dùng từ khoá tự nhiên, không nhồi. Đặt link nội bộ trong câu bằng cú pháp [anchor](url). Chỗ cần ảnh \
ghi [ẢNH: mô tả]. Đủ độ dài mục tiêu.
- faq: 3–6 câu hỏi + trả lời ngắn. internal_links: mọi link nội bộ đã dùng — CHỈ URL có trong danh sách URL website \
hoặc trang đích. external_sources: nguồn uy tín nên trích cho số liệu (cơ quan nhà nước, hãng xe, nghiên cứu) — url để \
"" nếu không có sẵn trong dữ liệu, KHÔNG bịa URL.
- images: mọi ảnh cần có (vị trí, mô tả cần chụp / thiết kế — ưu tiên ảnh thật của xưởng / sản phẩm, alt có nghĩa, \
tên file không dấu).
- schema_jsonld: JSON-LD hợp lệ (Article hoặc BlogPosting + BreadcrumbList; thêm Product / LocalBusiness / Course nếu \
đúng loại trang), url và ảnh để giá trị giữ chỗ như "[URL]".
- author: tên người đứng tên (nếu có) hoặc "[cần tác giả có chuyên môn]". cta: dẫn về trang đích.
- sources, facts_to_verify như thường lệ.""",
    "social": """Nhiệm vụ: viết BÀI ĐĂNG MẠNG XÃ HỘI hoàn chỉnh cho mục kế hoạch trên, đúng văn hoá kênh.

- channel: mã kênh; author: mã A… người đứng tên (kênh cá nhân bắt buộc có, viết đúng giọng, cách xưng hô, câu cửa \
miệng của người đó và chỉ nói trong "chủ đề được nói"; không bịa trải nghiệm của họ — cần chuyện thật thì đánh dấu).
- hooks: đúng 3 phương án mở đầu (mỗi phương án 1–3 dòng, ≤ 200 ký tự) — thứ người đọc thấy trước nút "xem thêm".
- body: phần còn lại của bài NGAY SAU mở đầu (không lặp lại mở đầu), xuống dòng thoáng, mỗi đoạn ≤ 3 dòng, đọc tốt \
trên điện thoại; kết bằng CTA / câu hỏi gợi bình luận. Không chèn hashtag và URL vào body.
- hashtags: theo văn hoá kênh (LinkedIn 3–5; Facebook 0–3, chỉ khi có ích).
- visual: loại hình (ảnh đơn / album / carousel / không cần), mô tả ảnh cần chụp hoặc thiết kế — ưu tiên ảnh thật; \
carousel thì slides = nội dung từng trang.
- first_comment: bình luận đầu / bình luận ghim (bổ sung thông tin, hoặc chứa link nếu đặt link ở bình luận).
- link_placement: "trong bài" / "bình luận đầu" / "không có link". best_time: giờ đăng đề xuất.
- sources, facts_to_verify như thường lệ.""",
}

RUBRICS = {  # BA mục 5.5, 5.8, 5.9 — thang 100 điểm
    "video": {
        "hook": ("Sức mạnh hook", 25),
        "retention": ("Giữ chân người xem", 20),
        "insight": ("Đúng insight khán giả", 15),
        "authenticity": ("Chân thật, đúng giọng nhân vật", 15),
        "clarity": ("Rõ ràng, một thông điệp", 10),
        "shareability": ("Khả năng chia sẻ", 10),
        "safety": ("An toàn và chính xác", 5),
    },
    "seo": {
        "intent": ("Đáp ứng đúng ý định tìm kiếm", 20),
        "expertise": ("Chuyên môn, kinh nghiệm thật, chính xác (E-E-A-T)", 20),
        "coverage": ("Độ phủ chủ đề + lấp khoảng trống", 15),
        "readability": ("Cấu trúc, dễ đọc, trả lời nhanh", 15),
        "onpage": ("On-page (kiểm tra tự động)", 10),
        "links": ("Liên kết nội bộ và nguồn dẫn", 10),
        "conversion": ("Chuyển đổi: CTA, đúng trang đích", 10),
    },
    "social": {
        "hook": ("Mở đầu 2–3 dòng giữ người đọc", 25),
        "value": ("Giá trị / insight thật", 20),
        "voice": ("Đúng giọng người đứng tên và văn hoá kênh", 15),
        "engagement": ("Kích tương tác: bình luận, chia sẻ, lưu", 15),
        "readability": ("Dễ đọc trên điện thoại", 10),
        "cta": ("CTA và link phù hợp mục tiêu", 10),
        "safety": ("An toàn và chính xác", 5),
    },
    "general": {   # Viết nhanh: quảng cáo, email, landing page, Zalo… (studio/quick.py)
        "goal": ("Đúng mục tiêu và đối tượng", 20),
        "hook": ("Tiêu đề / mở đầu thu hút", 20),
        "persuasion": ("Thuyết phục, lợi ích rõ ràng", 20),
        "voice": ("Đúng giọng yêu cầu, tự nhiên", 15),
        "cta": ("CTA rõ, dễ làm theo", 10),
        "format": ("Đúng quy cách kênh", 10),
        "safety": ("An toàn và chính xác", 5),
    },
}
RUBRIC = RUBRICS["video"]
AUTO_SCORED = {"seo": {"onpage"}}   # tiêu chí chấm bằng kiểm tra tự động, không để AI chấm

JUDGE_RULES = {
    "video": """- Hook mở bằng chào hỏi / giới thiệu → hook ≤ 10.
- similarity_risk: so với lời nói video tham chiếu R….""",
    "seo": """- Không trả lời câu hỏi chính ngay đoạn đầu, lan man → intent ≤ 12.
- Nội dung chung chung ai cũng viết được, không có kinh nghiệm / số liệu / ví dụ riêng của công ty → expertise ≤ 10.
- Số liệu không căn cứ và không đánh dấu cần xác minh → trừ mạnh expertise. Nhồi từ khoá → trừ readability.
- Link nội bộ ít hoặc anchor vô nghĩa ("tại đây") → trừ links.
- similarity_risk: so với nội dung trang đối thủ S….""",
    "social": """- Mở đầu bằng chào hỏi / "Hôm nay mình muốn chia sẻ" / giới thiệu bản thân → hook ≤ 10.
- Giọng không giống hồ sơ và bài mẫu của người đứng tên, hoặc nói ngoài "chủ đề được nói" → voice ≤ 7.
- Bán hàng lộ liễu trên trang cá nhân → trừ voice và engagement. Đoạn dài dày đặc → readability ≤ 4.
- similarity_risk: so với bài mẫu P… và video R….""",
    "general": """- Mở đầu / tiêu đề chung chung, không nêu lợi ích hay điều gây tò mò → hook ≤ 10.
- Kiểm tra tự động trượt (vượt giới hạn ký tự, thiếu số phương án…) → format ≤ 4.
- Hứa hẹn tuyệt đối, vi phạm chính sách quảng cáo, số liệu không căn cứ → safety = 0.
- similarity_risk: so với tư liệu / trang tham khảo S1.""",
}


def rubric_text(flow: str) -> str:
    return "\n".join(f"- {k}: {label} (tối đa {mx} điểm)" for k, (label, mx) in RUBRICS[flow].items()
                     if k not in AUTO_SCORED.get(flow, ()))


def judge_system(flow: str) -> str:
    kind = {"video": "kịch bản video ngắn", "seo": "bài viết SEO", "social": "bài đăng mạng xã hội",
            "general": "nội dung marketing"}[flow]
    return f"""Bạn là giám khảo khó tính chấm {kind} trước khi xuất bản. Chấm theo thang:
{rubric_text(flow)}

- Chấm thẳng tay: bản trung bình chỉ đạt 60–70% số điểm.
- Số liệu, lời hứa không có căn cứ hoặc không đánh dấu cần xác minh → trừ mạnh điểm an toàn / chính xác.
{JUDGE_RULES[flow]}
- Kết quả <kiem_tra_tu_dong> là số đo chính xác: mục nào trượt phải đưa vào fixes.
- fixes: 3–6 sửa đổi cụ thể, làm được ngay (chỉ rõ đoạn / câu / cảnh nào, sửa thành gì). verdict: một câu kết luận."""


def judge_schema(flow: str) -> dict:
    keys = [k for k in RUBRICS[flow] if k not in AUTO_SCORED.get(flow, ())]
    return obj(scores=obj(**{k: I for k in keys}), strengths=STRS, fixes=STRS, similarity_risk=S, verdict=S)


def score_total(flow: str, scores: dict) -> int:
    return sum(max(0, min(scores.get(k, 0), mx)) for k, (_, mx) in RUBRICS[flow].items())


def checks_text(checks: list[dict]) -> str:
    if not checks:
        return ""
    return "<kiem_tra_tu_dong>\n" + "\n".join(
        f"- [{'ĐẠT' if c['ok'] else 'TRƯỢT'}] {c['label']}{': ' + c['detail'] if c.get('detail') else ''}"
        for c in checks) + "\n</kiem_tra_tu_dong>"


def piece_context(camp: dict, piece: dict, inputs: dict, parent: dict | None = None,
                  siblings: list[str] | None = None) -> str:
    """Bối cảnh chung cho lượt viết + lượt chấm của một mục."""
    flow, st = piece["flow"], camp.get("strategy") or {}
    s, cp = st.get("strategy") or {}, st.get("campaign") or {}
    ctx = {"chien_dich": {k: cp.get(k) for k in ("name", "big_idea", "tagline", "cta")},
           "chien_luoc": {k: s.get(k) for k in ("key_message", "tone_of_voice", "persona", "audiences", "dos", "donts")}}
    parts = [brief_text(camp), analysis_text(inputs.get("analysis")), cards_text(inputs["cards"])]
    if flow == "video":
        parts.append(refs_text(inputs["videos"], max_chars=3000))
    elif flow == "seo":
        ctx["nghien_cuu_seo"] = st.get("seo_research")
        seo = camp["brief"].get("seo") or {}
        parts += [pages_text(inputs["pages"], max_chars=2500), site_text(inputs["site_urls"]),
                  f"<trang_dich>{seo.get('landing_url') or '(chưa có)'}</trang_dich>"]
    else:
        ctx["phan_tich_bai_mau"] = st.get("social_analysis")
        ch = piece["episode"].get("channel")
        parts += [posts_text(inputs["posts"]), authors_text(inputs["authors"], samples=True),
                  f'<kenh ma="{ch}">{channel_label(ch)}</kenh>']
    parts += [f"<boi_canh>\n{dump(ctx)}\n</boi_canh>", f"<muc_ke_hoach>\n{dump(piece['episode'])}\n</muc_ke_hoach>"]
    if parent:
        d = piece["episode"].get("derived") or {}
        body = dump(parent.get("content") or parent.get("outline") or {})
        parts.append(f'<noi_dung_goc luong="{FLOWS[parent["flow"]]}">\n{body[:15000]}\n</noi_dung_goc>\n'
                     f'Đây là nội dung con số {d.get("index")}/{d.get("count")} CHUYỂN THỂ từ nội dung gốc sang luồng '
                     f'"{FLOWS[flow]}". Chọn MỘT ý / góc riêng trong nội dung gốc, viết lại hoàn toàn cho đúng văn hoá '
                     f'kênh mới — không lặp nguyên văn. Mỗi nội dung con một ý khác nhau.')
        if siblings:
            parts.append("<cac_ban_con_da_co>\n" + "\n".join(f"- {t}" for t in siblings) +
                         "\n</cac_ban_con_da_co>\nChọn ý khác với các bản trên.")
    return "\n\n".join(x for x in parts if x)


def write_piece(flow: str, context: str, outline: dict | None = None, previous: dict | None = None,
                review: dict | None = None, checks: list[dict] | None = None, feedback: str = "") -> dict:
    """flow = 'video' | 'outline' | 'seo' | 'social' ('outline' là bước dàn ý của bài SEO)."""
    parts = [context]
    if outline:
        parts.append(f"<dan_y_da_duyet>\n{dump(outline)}\n</dan_y_da_duyet>")
    parts.append(WRITE_TASKS[flow])
    if previous and review:
        parts.append("<ban_truoc>\n" + dump(previous) + "\n</ban_truoc>\n<nhan_xet_giam_khao>\n"
                     + dump({k: review[k] for k in ("scores", "fixes", "similarity_risk")}) + "\n</nhan_xet_giam_khao>\n"
                     + checks_text(checks or [])
                     + "\nViết lại toàn bộ, sửa hết các điểm giám khảo và kiểm tra tự động nêu, giữ phần đã tốt.")
    if feedback:
        parts.append(f"<yeu_cau_cua_nguoi_duyet>\n{feedback}\n</yeu_cau_cua_nguoi_duyet>\nƯu tiên làm đúng yêu cầu này.")
    return structured_call(BASE_SYSTEM, "\n\n".join(parts), WRITE_SCHEMAS[flow], max_tokens=32000 if flow == "seo" else 24000,
                           model=STUDIO_MODEL)


def judge_piece(flow: str, context: str, content: dict, checks: list[dict], auto_scores: dict | None = None) -> dict:
    body = context + "\n\n<ban_can_cham>\n" + dump(content) + "\n</ban_can_cham>\n\n" + checks_text(checks)
    res = structured_call(judge_system(flow), body, judge_schema(flow), max_tokens=8000, model=STUDIO_MODEL)
    res["scores"] |= auto_scores or {}
    res["total"] = score_total(flow, res["scores"])
    return res
