"""Collection + index của phân hệ Học tập (LRN — docs/BA.md mục 7, 17). Trường chi tiết: BA mục 7.

- `lessons`: title, objectives, owner_unit_id, space_id, items [{card_id, rev}], narrative, practice_question_ids,
  classification, status (draft / published / stale), created_by, ai {prompt, engine};
  category (slug khoá = một nút cây, null = Chưa xếp khoá), seq (thứ tự trong khoá) — LRN-15, `learn/courses.py`.
- `questions`: kind (single / multi / essay), stem, options [{text, correct}], rubric [{criterion, max, descriptor}],
  model_answer, card_refs [{card_id, rev}], difficulty 1–5, bloom, status (draft / approved / stale), created_by.
- `learning_paths`: title, period (year / month), year, month, owner_id, owner_unit_id, parent_path_id, required_items,
  modules [{week, lesson_ids, due_at}], exam {blueprint, duration_min, pass_score, attempts},
  status (draft / published / closed), ai {prompt, plan, engine}.
- `assignments`: path_id, learner_id, assigned_by, due_at, status (assigned / in_progress / completed / overdue), progress.
- `attempts`: assignment_id, learner_id, kind (practice / exam), paper (ảnh chụp đề), answers, auto_score, ai_grading,
  human_grading, feedback, final_score, passed, started_at, submitted_at, finalized_by, finalized_at, appeal.
  **Không sửa sau khi chốt.**
- `courses` (LRN-15, 17 — TK-15b): category (unique, slug nút cây), exam {blueprint, duration_min, pass_score,
  attempts} | null, lesson_pass_score, updated_by, updated_at. Chưa có bản ghi = khoá không thi, điểm đạt bài 70.

Trường thêm ở luồng E (đợt 1 — ghi trong báo cáo cho người điều phối, chưa có ở BA mục 7):
- `lessons`: published_at, published_by, updated_at.
- `questions`: space_id (để `policy.visible_filter(kind="question")` lọc được), explanation (giải thích — BA 17.6),
  classification (= cao nhất của thẻ căn cứ), origin (manual / ai), approved_by, approved_at, updated_at.
- `attempts`: lesson_id (luyện tập theo bài học, assignment_id = None), max_score, auto_max, auto_items (điểm từng câu),
  saved_at. Định dạng `paper` / `answers`: xem `learn/attempts.py`.
"""

from __future__ import annotations

from typing import Literal

from pymongo import ASCENDING, DESCENDING

from .. import db

# Điểm đạt mặc định của bài thi (% tổng điểm — BA 17.7, đã quyết 26/09): mọi chỗ tạo lộ trình / bài thi dùng số này
DEFAULT_PASS_SCORE = 70


def pass_score_of(exam: dict | None) -> float:
    """Điểm đạt (%) của bài thi / lượt thi; thiếu hoặc rỗng → mặc định 70 (không bao giờ coi như 0 — đạt mọi bài)."""
    v = (exam or {}).get("pass_score")
    return DEFAULT_PASS_SCORE if v is None or v == "" else v

lessons = db.db["lessons"]
questions = db.db["questions"]
learning_paths = db.db["learning_paths"]
assignments = db.db["assignments"]
attempts = db.db["attempts"]
courses = db.db["courses"]

QuestionKind = Literal["single", "multi", "essay"]
Bloom = Literal["remember", "understand", "apply", "analyze"]
LessonStatus = Literal["draft", "published", "stale"]
QuestionStatus = Literal["draft", "approved", "stale"]
PathStatus = Literal["draft", "published", "closed"]
AssignmentStatus = Literal["assigned", "in_progress", "completed", "overdue"]
AttemptKind = Literal["practice", "exam"]


def ensure_indexes() -> None:
    lessons.create_index("items.card_id")
    lessons.create_index('subject_id')
    for name, fields in {'learning_nodes': ['parent_id', 'space_id'], 'learning_documents': ['subject_id', 'kind', 'space_id'],
                         'learning_tasks': ['subject_id', 'lesson_id'], 'learning_work': ['learner_ids', 'grader_id', 'task_id'],
                         'learning_assets': ['space_id', 'sha256']}.items():
        for field in fields: db.db[name].create_index(field)
    lessons.create_index([("owner_unit_id", ASCENDING), ("status", ASCENDING)])
    lessons.create_index([("category", ASCENDING), ("seq", ASCENDING)])      # khoá học theo cây chủ đề (LRN-15)
    courses.create_index("category", unique=True)
    db.db['learning_equivalencies'].create_index([('document_id', 1), ('learner_id', 1), ('lesson_id', 1)], unique=True)
    db.db['learning_receipts'].create_index([('document_id', 1), ('learner_id', 1), ('lesson_id', 1), ('material_index', 1)], unique=True)
    questions.create_index("card_refs.card_id")
    questions.create_index([("status", ASCENDING), ("difficulty", ASCENDING)])
    learning_paths.create_index([("owner_id", ASCENDING), ("year", DESCENDING), ("month", DESCENDING)])
    learning_paths.create_index("parent_path_id")
    assignments.create_index([("learner_id", ASCENDING), ("due_at", ASCENDING)])
    assignments.create_index([("path_id", ASCENDING), ("learner_id", ASCENDING)], unique=True)
    attempts.create_index([("assignment_id", ASCENDING), ("kind", ASCENDING)])
    attempts.create_index([("learner_id", ASCENDING), ("submitted_at", DESCENDING)])
    attempts.create_index([("finalized_at", ASCENDING)])
