"""Vệ sinh tag theo Phân loại VCwiki v2 (mục 13 + bảng bổ sung sau bước A2, yêu cầu R3 ngày 26/09/2026).

Tag chỉ giữ ba việc: kênh nguồn (`nguon-*`), chủ đề hẹp chưa đủ mở nhánh, từ khoá tra cứu. Ba bảng dưới đây là
nguồn sự thật — `scripts/clean_tags_v2.py` và các bước sau (R4 áp bảng quyết định) gọi `clean()` / `run()`;
chạy lại bao nhiêu lần cũng cho cùng kết quả.

Áp cho thẻ VCWIKI, tài liệu và video (tag dùng chung một bộ từ vựng). Chỉ đổi `tags` (thẻ: cả `search_text`);
không đổi status, updated_at, không tạo phiên bản thẻ.
"""

from __future__ import annotations

from .. import db
from .pipeline import card_search_text, cards, documents

# tag cũ -> tag chuẩn (mục 13 + bổ sung sau A2)
MERGE = {
    # livestream
    "livestream-tiktok": "livestream", "livestream-ban-hang": "livestream", "livestream-tiktok-shop": "livestream",
    # affiliate / KOC
    "koc": "affiliate-koc", "koc-affiliate": "affiliate-koc", "affiliate-marketing": "affiliate-koc",
    "booking-koc": "affiliate-koc", "koc-kol": "affiliate-koc", "tiep-thi-lien-ket": "affiliate-koc",
    "affiliate": "affiliate-koc", "koc-tiktok": "affiliate-koc",
    # định giá
    "dinh-gia-ban": "dinh-gia", "chien-luoc-gia": "dinh-gia", "chinh-sach-gia": "dinh-gia", "gia-ban": "dinh-gia",
    # động lực
    "dong-luc-nhan-vien": "dong-luc",
    # quản lý cấp trung
    "quan-ly-doi-ngu": "quan-ly-cap-trung", "lanh-dao-doi-ngu": "quan-ly-cap-trung",
    "ky-nang-quan-ly": "quan-ly-cap-trung",
    # GMV Max
    "gmv-max-2-0": "gmv-max", "quang-cao-gmv": "gmv-max", "quang-cao-gmv-max": "gmv-max",
    # chính sách sàn
    "chinh-sach-tiktok": "chinh-sach-san", "chinh-sach-tiktok-shop": "chinh-sach-san",
    "tiktok-shop-chinh-sach": "chinh-sach-san", "chinh-sach-nen-tang": "chinh-sach-san",
    # rủi ro thuế
    "quan-tri-thue": "rui-ro-thue", "quan-ly-thue": "rui-ro-thue", "tuan-thu-thue": "rui-ro-thue",
    # quảng cáo TikTok
    "tiktok-shop-ads": "quang-cao-tiktok", "c-ads": "quang-cao-tiktok", "tiktok-ads": "quang-cao-tiktok",
    # ROI
    "roi-quang-cao": "roi", "bao-ve-roi": "roi",
    # phí sàn
    "phi-san": "phi-san-tmdt", "phi-san-tiktok-shop": "phi-san-tmdt", "chi-phi-san-tmdt": "phi-san-tmdt",
    # tag chủ đề trùng tiền tố nguon-* của tag kênh (thư ký duyệt 26/09 13:25)
    "nguon-khach": "tim-khach", "nguon-ung-vien": "kenh-tuyen-dung",
}

# Tag kênh nguồn -> nguon-<kênh>. Mục 13 nêu 4 kênh + "…", R3 nêu thêm 6; 9 kênh còn lại tìm được bằng cách đối
# chiếu tag của thẻ với tên kênh thật trong `videos` / `kb_sources` (26/09/2026).
SOURCE_CHANNELS = [
    "the-hoang-work", "co-chinh-qttc", "chi-gai-ke-toan", "do-xuan-tung",                         # mục 13
    "tien-hoc-marketing", "duy-muoi", "quang-trung-tv", "x-coastie", "ra-diesel-tech", "origin-ai-agent",  # R3
    "anh-anh-tudo", "dam-van-tuan", "tran-manh-hung", "hoang-comme", "mentor-ha-nguyen", "goc-gara", "ccmfast",
    "chuyen-mar", "goc-ghe-hang-a",                                                               # đối chiếu kênh
]

# Tag trùng tên nhánh cây — cây đã gánh, xoá (mục 13)
DROP = {
    "van-hoa-doanh-nghiep", "ke-toan-quan-tri", "tuyen-dung", "cham-soc-khach-hang", "ky-nang-ban-hang",
    "kenh-phan-phoi", "quang-cao-tra-phi", "tam-ly-khach-hang", "dao-tao-phat-trien", "chan-dung-khach-hang",
    "dam-phan", "video-ngan-tiktok", "ky-thuat-o-to", "kiem-soat-noi-bo", "quan-tri-tai-chinh",
}

RENAME = MERGE | {c: f"nguon-{c}" for c in SOURCE_CHANNELS}
MAX_TAGS = 5    # quy tắc cho thẻ mới (mục 13.4) — script chỉ báo số thẻ vượt, không tự cắt


def clean(tags: list | None) -> list[str]:
    """Một danh sách tag -> sau khi gộp / đổi tên / xoá; bỏ rỗng, bỏ trùng, giữ thứ tự."""
    out = []
    for t in db.clean_tags(tags or [], limit=1000):
        t = RENAME.get(t, t)
        if t not in DROP and t not in out:
            out.append(t)
    return out


TARGETS = (("cards", cards), ("documents", documents), ("videos", db.videos))


def run(apply: bool = False) -> dict:
    """Quét thẻ, tài liệu, video có tag cần đổi. apply=False: chỉ đếm. Trả số bản ghi đổi và bảng tag trước → sau."""
    touched = set(RENAME) | DROP
    stats: dict = {"changed": {}, "tags": {}, "cards_over_max": 0}
    for name, coll in TARGETS:
        n = 0
        for row in coll.find({"tags": {"$in": list(touched)}}, {"tags": 1, "title": 1, "summary": 1, "body": 1,
                                                                   "fields": 1}):
            old = row.get("tags") or []
            new = clean(old)
            if new == old:
                continue
            n += 1
            for t in old:
                if t in touched:
                    rec = stats["tags"].setdefault(t, {"to": RENAME.get(t) if t not in DROP else None,
                                                       "cards": 0, "documents": 0, "videos": 0})
                    rec[name] += 1
            if apply:
                upd = {"tags": new}
                if name == "cards":
                    upd["search_text"] = card_search_text(row | upd)
                coll.update_one({"_id": row["_id"]}, {"$set": upd})
        stats["changed"][name] = n
    stats["cards_over_max"] = cards.count_documents({f"tags.{MAX_TAGS}": {"$exists": True}})
    return stats
