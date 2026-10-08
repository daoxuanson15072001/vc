"""Xưởng chiến dịch (Content Engine) — 3 luồng đầu ra trên một lõi chung. Thiết kế: docs/BA.md mục 5.

  brief + tham chiếu (video R… · trang đối thủ S… · bài MXH mẫu P… · người đứng tên A… · thẻ VCWIKI K…)
    ──AI──► chiến lược + chiến dịch ──AI──► kế hoạch riêng từng luồng (video / seo / social)
  mục kế hoạch ──AI viết──► kiểm tra tự động ──AI chấm (thang 100)──► < ngưỡng thì sửa, tối đa N vòng ──► người duyệt
  Bài SEO đi thêm một bước: dàn ý ──người duyệt──► viết bài.
Viết nhanh (quick.py): một nội dung lẻ từ form ngắn — cùng vòng viết → kiểm tra → chấm, không cần chiến dịch.
"""

from .. import db

campaigns = db.db["campaigns"]
scripts = db.db["campaign_scripts"]   # mọi nội dung sản xuất (kịch bản video, bài SEO, bài MXH), phân biệt bằng `flow`
authors = db.db["studio_authors"]     # hồ sơ người đứng tên (CE-18)
quick_pieces = db.db["studio_quick"]  # Viết nhanh: một nội dung lẻ không thuộc chiến dịch (studio/quick.py)
marketing_projects = db.db["studio_projects"]   # Dự án marketing: tầng trên chiến dịch / Viết nhanh (studio/projects.py, BA 5.13)
analyses = db.db["studio_analyses"]         # Phân tích dự án (7P…) có phiên bản, chốt mới dùng (studio/analysis.py, CE-27)


def ensure_indexes() -> None:
    campaigns.create_index([("space_id", 1), ("created_at", -1)])
    campaigns.create_index([("status", 1), ("created_at", 1)])
    scripts.update_many({"flow": {"$exists": False}}, {"$set": {"flow": "video"}})   # dữ liệu trước khi có 3 luồng
    scripts.create_index([("campaign_id", 1), ("flow", 1), ("episode_no", 1)])
    scripts.create_index([("status", 1), ("created_at", 1)])
    authors.create_index([("space_id", 1), ("name", 1)])
    quick_pieces.create_index([("space_id", 1), ("created_at", -1)])
    quick_pieces.create_index([("status", 1), ("created_at", 1)])
    quick_pieces.create_index([("project_id", 1), ("created_at", -1)])
    campaigns.create_index([("project_id", 1), ("created_at", -1)])
    marketing_projects.create_index([("space_id", 1), ("updated_at", -1)])
    marketing_projects.create_index([("members.user_id", 1)])
    analyses.create_index([("project_id", 1), ("version", -1)])
    analyses.create_index([("status", 1), ("created_at", 1)])
