"""Thảo luận & bình chọn trên VCWIKI: bình luận, chấm sao, bảng xếp hạng theo tháng.

- Chấm 1–5 sao cho thẻ và cho từng bình luận (mỗi người một lượt / thẻ hoặc bình luận).
- Bình luận trả lời nối tiếp nhau qua `parent_id` (bình luận được trả lời).
- Sao cộng cho người viết (thẻ: `created_by`; bình luận: người bình luận). Không tự chấm cho mình.
- Mỗi lượt chấm tính vào tháng chấm lần đầu (giờ Việt Nam). Sang tháng mới thì lượt chấm cũ đã chốt,
  không sửa / gỡ được nữa — để kết quả trao giải các tháng trước không đổi.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pymongo import ASCENDING

from .. import db

VN = ZoneInfo("Asia/Ho_Chi_Minh")

comments = db.db["wiki_comments"]
votes = db.db["wiki_votes"]


def ensure_indexes() -> None:
    comments.create_index([("card_id", ASCENDING), ("created_at", ASCENDING)])
    comments.create_index([("month", ASCENDING), ("user_id", ASCENDING)])
    votes.create_index([("target_id", ASCENDING), ("giver_id", ASCENDING)], unique=True)
    votes.create_index([("card_id", ASCENDING)])
    votes.create_index([("month", ASCENDING)])


def month_of(ts: datetime | None = None) -> str:
    return (ts or db.now()).astimezone(VN).strftime("%Y-%m")


# ---------------------------------------------------------------------------
# Bình chọn
# ---------------------------------------------------------------------------

def cast_vote(*, target: str, target_id, card: dict, receiver_id, giver: dict, stars: int) -> None:
    """Ghi / sửa / gỡ (stars=0) lượt chấm của `giver` cho một thẻ hoặc bình luận."""
    if receiver_id == giver["_id"]:
        raise HTTPException(400, "Không tự bình chọn cho nội dung của mình")
    mine = votes.find_one({"target_id": target_id, "giver_id": giver["_id"]})
    if mine and mine["month"] != month_of():
        raise HTTPException(409, f"Lượt bình chọn tháng {mine['month']} đã chốt, không sửa được nữa")
    if not stars:
        if mine:
            votes.delete_one({"_id": mine["_id"]})
        return
    now = db.now()
    votes.update_one(
        {"target_id": target_id, "giver_id": giver["_id"]},
        {"$set": {"stars": stars, "updated_at": now},
         "$setOnInsert": {"target": target, "card_id": card["_id"], "space_id": card["space_id"],
                          "receiver_id": receiver_id, "month": month_of(now), "created_at": now}},
        upsert=True,
    )


def card_stats(card_ids: list, user_id) -> dict:
    """{card_id: {stars, voters, avg, mine, comments}} cho danh sách thẻ."""
    stats = {i: {"stars": 0, "voters": 0, "avg": None, "mine": 0, "comments": 0} for i in card_ids}
    for r in votes.aggregate([
        {"$match": {"target": "card", "card_id": {"$in": card_ids}}},
        {"$group": {"_id": "$card_id", "stars": {"$sum": "$stars"}, "voters": {"$sum": 1}}},
    ]):
        stats[r["_id"]] |= {"stars": r["stars"], "voters": r["voters"], "avg": round(r["stars"] / r["voters"], 1)}
    for v in votes.find({"target": "card", "card_id": {"$in": card_ids}, "giver_id": user_id}, {"card_id": 1, "stars": 1}):
        stats[v["card_id"]]["mine"] = v["stars"]
    for r in comments.aggregate([
        {"$match": {"card_id": {"$in": card_ids}, "deleted": {"$ne": True}}},
        {"$group": {"_id": "$card_id", "n": {"$sum": 1}}},
    ]):
        stats[r["_id"]]["comments"] = r["n"]
    return stats


def comment_stats(comment_ids: list, user_id) -> dict:
    """{comment_id: {stars, voters, avg, mine}} cho danh sách bình luận."""
    stats = {i: {"stars": 0, "voters": 0, "avg": None, "mine": 0} for i in comment_ids}
    for r in votes.aggregate([
        {"$match": {"target": "comment", "target_id": {"$in": comment_ids}}},
        {"$group": {"_id": "$target_id", "stars": {"$sum": "$stars"}, "voters": {"$sum": 1}}},
    ]):
        stats[r["_id"]] |= {"stars": r["stars"], "voters": r["voters"], "avg": round(r["stars"] / r["voters"], 1)}
    for v in votes.find({"target": "comment", "target_id": {"$in": comment_ids}, "giver_id": user_id},
                        {"target_id": 1, "stars": 1}):
        stats[v["target_id"]]["mine"] = v["stars"]
    return stats


# ---------------------------------------------------------------------------
# Bảng xếp hạng
# ---------------------------------------------------------------------------

def leaderboard(month: str) -> list[dict]:
    """Mỗi người có hoạt động trong tháng: số bình luận, sao cho đi, sao nhận được (thẻ / bình luận)."""
    rows: dict = {}

    def row(uid):
        return rows.setdefault(uid, {"user_id": uid, "comments": 0, "stars_given": 0, "votes_given": 0,
                                     "stars_received": 0, "card_stars": 0, "comment_stars": 0})

    for r in comments.aggregate([
        {"$match": {"month": month, "deleted": {"$ne": True}}},
        {"$group": {"_id": "$user_id", "n": {"$sum": 1}}},
    ]):
        row(r["_id"])["comments"] = r["n"]
    for r in votes.aggregate([
        {"$match": {"month": month}},
        {"$group": {"_id": "$giver_id", "stars": {"$sum": "$stars"}, "n": {"$sum": 1}}},
    ]):
        row(r["_id"]).update(stars_given=r["stars"], votes_given=r["n"])
    for r in votes.aggregate([
        {"$match": {"month": month}},
        {"$group": {"_id": {"u": "$receiver_id", "t": "$target"}, "stars": {"$sum": "$stars"}}},
    ]):
        x = row(r["_id"]["u"])
        x["card_stars" if r["_id"]["t"] == "card" else "comment_stars"] += r["stars"]
        x["stars_received"] += r["stars"]
    return sorted(rows.values(), key=lambda x: (-x["stars_received"], -x["comments"], -x["stars_given"]))


def active_months() -> list[str]:
    """Các tháng có hoạt động, mới nhất trước (luôn có tháng hiện tại)."""
    months = set(votes.distinct("month")) | set(comments.distinct("month")) | {month_of()}
    return sorted(months, reverse=True)

