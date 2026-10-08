"""TK-16: giao, nộp, chấm thực hành; mỗi lượt và rubric được giữ riêng."""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from .. import db, policy
from ..auth import current_user, users
from .routes import oid, plain, require_author, target_space, load_lesson
from .training import subject, check_people, output, editable
from .materials import load_asset, public_url

router = APIRouter(prefix='/api/learn')
tasks = db.db['learning_tasks']
works = db.db['learning_work']


class Criterion(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=500)
    weight: float = Field(gt=0, le=100)
    descriptor: str = Field('', max_length=3000)


class TaskIn(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    kind: Literal['exercise', 'project']
    subject_id: str
    lesson_id: str | None = None
    space_id: str | None = None
    mission: str = Field(min_length=1, max_length=20000)
    inputs: str = Field(min_length=1, max_length=20000)
    deliverable: str = Field(min_length=1, max_length=10000)
    guidance: str = Field('', max_length=10000)
    mode: Literal['individual', 'group'] = 'individual'
    required: bool = True
    rubric: list[Criterion] = Field(min_length=1, max_length=30)
    pass_score: float = Field(70, ge=0, le=100)
    max_attempts: int = Field(3, ge=1, le=10)
    revision: int = Field(1, ge=1)

    @model_validator(mode='after')
    def weights(self):
        if abs(sum(r.weight for r in self.rubric) - 100) > .001:
            raise ValueError('Tổng trọng số tiêu chí phải bằng 100')
        return self


def task_load(value, user):
    task = tasks.find_one({'_id': oid(value)} | policy.visible_filter(user, 'lesson'))
    if not task or (task['status'] != 'published' and not policy.can(user, 'learn.author')): raise HTTPException(404, 'Không tìm thấy nhiệm vụ')
    return task


@router.get('/tasks')
def list_tasks(subject_id: str | None = None, lesson_id: str | None = None, user: dict = Depends(current_user)):
    f = policy.visible_filter(user, 'lesson')
    if not policy.can(user, 'learn.author'): f['status'] = 'published'
    if subject_id: f['subject_id'] = oid(subject_id)
    if lesson_id: f['lesson_id'] = oid(lesson_id)
    return {'items': [output(x, user) for x in tasks.find(f)]}


@router.post('/tasks', status_code=201)
def create_task(body: TaskIn, user: dict = Depends(current_user)):
    require_author(user); space = target_space(user, body.space_id)
    sub = subject(body.subject_id, user)
    lesson = load_lesson(body.lesson_id, user) if body.lesson_id else None
    if lesson and lesson.get('subject_id') != sub['_id']: raise HTTPException(400, 'Bài không thuộc môn')
    data = body.model_dump(exclude={'space_id', 'revision'})
    data |= {'subject_id': sub['_id'], 'lesson_id': lesson['_id'] if lesson else None,
             'space_id': space['_id'], 'created_by': user['_id'], 'classification': policy.inherit_classification([sub, lesson or {}]),
             'status': 'draft', 'revision': 1, 'created_at': db.now()}
    data['_id'] = tasks.insert_one(data).inserted_id
    return output(data, user)


@router.delete('/tasks/{task_id}')
def delete_task(task_id: str, user: dict = Depends(current_user)):
    task = task_load(task_id, user); editable(task, user)
    from .training import documents
    if tasks.count_documents({'source_id': task['_id']}) or documents.count_documents({'task_ids': task['_id']}) or works.count_documents({'task_id': task['_id']}): raise HTTPException(409, 'Nhiệm vụ đã được giao')
    tasks.delete_one({'_id': task['_id'], 'status': 'draft'})
    return {'deleted': True}


class AssignIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    learner_ids: list[str] = Field(min_length=1, max_length=100)
    grader_id: str
    mentor_id: str
    document_id: str | None = None
    due_at: datetime


@router.post('/tasks/{task_id}/assign', status_code=201)
def assign_task(task_id: str, body: AssignIn, user: dict = Depends(current_user)):
    task = task_load(task_id, user); require_author(user)
    if task['status'] != 'published': raise HTTPException(409, 'Nhiệm vụ phải phát hành trước khi giao')
    if not policy.can(user, 'space.write', task): raise HTTPException(403, 'Không có quyền giao từ kho này')
    members = check_people(body.learner_ids)
    grader, mentor = check_people([body.grader_id, body.mentor_id]) if body.grader_id != body.mentor_id else (oid(body.grader_id), oid(body.mentor_id))
    check_people([body.grader_id, body.mentor_id])
    if body.due_at.tzinfo is None or body.due_at <= datetime.now(timezone.utc):
        raise HTTPException(400, 'Hạn nộp cần múi giờ và nằm trong tương lai')
    if not set(members) <= set(policy.assignable_learners(user)):
        raise HTTPException(403, 'Có người học ngoài phạm vi giao')
    if task['mode'] == 'individual' and len(members) != 1:
        raise HTTPException(400, 'Bài cá nhân chỉ giao một người mỗi lần')
    if grader in members: raise HTTPException(403, 'Người học không tự chấm')
    for uid in {grader, mentor}:
        task_load(task_id, users.find_one({'_id': uid}))
    grading_user = users.find_one({'_id': grader})
    for uid in members:
        if not policy.can(grading_user, 'learn.grade', {'learner_id': uid, 'assigned_by': user['_id']}):
            raise HTTPException(403, 'Người chấm phải có quyền chấm từng thành viên')
        learner = users.find_one({'_id': uid})
        if not tasks.find_one({'_id': task['_id']} | policy.visible_filter(learner, 'lesson')):
            raise HTTPException(403, 'Người học không có quyền xem kho nhiệm vụ')
    document_id = None
    if body.document_id:
        from .training import load, documents, frozen_tasks
        document = load(documents, body.document_id, user)
        if document['status'] != 'published' or document['kind'] not in ('class', 'route') or not set(members) <= set(document.get('learner_ids', [])) or task['_id'] not in frozen_tasks(document):
            raise HTTPException(400, 'Nhiệm vụ / người học không thuộc lớp hoặc lộ trình đã phát hành')
        document_id = document['_id']
    doc = {'document_id': document_id, 'task_id': task['_id'], 'snapshot': deepcopy(task), 'learner_ids': members,
           'assigned_by': user['_id'], 'grader_id': grader, 'mentor_id': mentor, 'due_at': body.due_at,
           'status': 'assigned', 'revision': 1, 'submissions': [], 'created_at': db.now()}
    doc['_id'] = works.insert_one(doc).inserted_id
    return work_out(doc)


def work_out(doc):
    out = plain(doc); out['id'] = out.pop('_id'); return out


def work_load(value, user):
    doc = works.find_one({'_id': oid(value)})
    if not doc or user['_id'] not in {*doc['learner_ids'], doc['grader_id'], doc['mentor_id'], doc['assigned_by']}:
        raise HTTPException(404, 'Không tìm thấy bài thực hành')
    task_load(str(doc['task_id']), user)
    return doc


@router.get('/work')
def list_work(user: dict = Depends(current_user)):
    return {'items': [work_out(x) for x in works.find({'$or': [{k: user['_id']} for k in ('learner_ids', 'grader_id', 'mentor_id', 'assigned_by')]}).sort('created_at', -1) if tasks.find_one({'_id': x['task_id']} | policy.visible_filter(user, 'lesson'))]}


class SubmissionIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    revision: int = Field(ge=1)
    product: str = Field(min_length=1, max_length=30000)
    links: list[str] = Field(default_factory=list, max_length=20)
    asset_ids: list[str] = Field(default_factory=list, max_length=20)
    contributions: dict[str, str] = Field(default_factory=dict)


@router.post('/work/{work_id}/submit')
def submit_work(work_id: str, body: SubmissionIn, user: dict = Depends(current_user)):
    doc = work_load(work_id, user)
    if user['_id'] not in doc['learner_ids']: raise HTTPException(403, 'Chỉ người học được nộp')
    if doc['status'] not in ('assigned', 'retry'): raise HTTPException(409, 'Bài đang chấm hoặc đã đạt')
    if len(doc['submissions']) >= doc['snapshot']['max_attempts']: raise HTTPException(409, 'Đã hết lượt nộp')
    if not body.product.strip(): raise HTTPException(400, 'Cần sản phẩm nộp')
    if doc['snapshot']['mode'] == 'group':
        if set(body.contributions) != {str(i) for i in doc['learner_ids']} or any(not x.strip() for x in body.contributions.values()):
            raise HTTPException(400, 'Nhóm cần minh chứng đóng góp của từng thành viên')
    try:
        for url in body.links: public_url(url)
    except ValueError as e: raise HTTPException(400, str(e)) from None
    asset_ids = []
    for value in body.asset_ids:
        asset = load_asset(value, user)
        # Người chấm và cả nhóm cần đọc được sản phẩm, không lách quyền qua nộp bài.
        for uid in {*doc['learner_ids'], doc['grader_id'], doc['mentor_id']}:
            load_asset(value, users.find_one({'_id': uid}))
        asset_ids.append(asset['_id'])
    row = body.model_dump(exclude={'revision', 'asset_ids'}) | {'asset_ids': asset_ids, 'submitted_by': user['_id'], 'submitted_at': db.now(), 'late': datetime.now(timezone.utc) > doc['due_at'].replace(tzinfo=timezone.utc)}
    new = works.find_one_and_update({'_id': doc['_id'], 'revision': body.revision, 'status': {'$in': ['assigned', 'retry']}},
        {'$push': {'submissions': row}, '$set': {'status': 'submitted'}, '$inc': {'revision': 1}}, return_document=True)
    if not new: raise HTTPException(409, 'Bài vừa thay đổi; tải lại')
    return work_out(new)


class GradeIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    revision: int = Field(ge=1)
    scores: list[float] = Field(min_length=1, max_length=30)
    feedback: str = Field(min_length=1, max_length=10000)
    individual_feedback: dict[str, str] = Field(default_factory=dict)


@router.post('/work/{work_id}/grade')
def grade_work(work_id: str, body: GradeIn, user: dict = Depends(current_user)):
    doc = work_load(work_id, user)
    if user['_id'] != doc['grader_id'] or user['_id'] in doc['learner_ids']:
        raise HTTPException(403, 'Chỉ người chấm được phân công chốt điểm')
    for uid in doc['learner_ids']:
        if not policy.can(user, 'learn.grade', {'learner_id': uid, 'assigned_by': doc['assigned_by']}):
            raise HTTPException(403, 'Quyền chấm đã thay đổi')
    rubric = doc['snapshot']['rubric']
    if len(body.scores) != len(rubric) or any(not 0 <= x <= 100 for x in body.scores) or not body.feedback.strip():
        raise HTTPException(400, 'Chấm đủ tiêu chí 0…100 và nhận xét')
    if doc['snapshot']['mode'] == 'group' and (set(body.individual_feedback) != {str(i) for i in doc['learner_ids']} or any(not x.strip() for x in body.individual_feedback.values())):
        raise HTTPException(400, 'Cần đánh giá đóng góp từng thành viên')
    score = round(sum(x * r['weight'] / 100 for x, r in zip(body.scores, rubric)), 2)
    passed = score >= doc['snapshot']['pass_score']
    if doc['status'] != 'submitted': raise HTTPException(409, 'Chỉ chấm bài đã nộp, mỗi lượt chốt một lần')
    rows = deepcopy(doc['submissions'])
    rows[-1]['grading'] = body.model_dump(exclude={'revision'}) | {'score': score, 'passed': passed, 'graded_by': user['_id'], 'graded_at': db.now()}
    new = works.find_one_and_update({'_id': doc['_id'], 'revision': body.revision, 'status': 'submitted'},
        {'$set': {'submissions': rows, 'status': 'passed' if passed else 'retry', 'score': score, 'passed': passed}, '$inc': {'revision': 1}}, return_document=True)
    if not new: raise HTTPException(409, 'Bài vừa được chấm; tải lại')
    return work_out(new)


@router.put('/tasks/{task_id}')
def update_task(task_id: str, body: TaskIn, user: dict = Depends(current_user)):
    task = task_load(task_id, user); editable(task, user)
    if body.subject_id != str(task['subject_id']) or (body.lesson_id or None) != (str(task['lesson_id']) if task.get('lesson_id') else None):
        raise HTTPException(409, 'Đổi phạm vi nhiệm vụ bằng bản sao')
    data = body.model_dump(exclude={'subject_id', 'lesson_id', 'space_id', 'revision'})
    new = tasks.find_one_and_update({'_id': task['_id'], 'status': 'draft', 'revision': body.revision}, {'$set': data, '$inc': {'revision': 1}}, return_document=True)
    if not new: raise HTTPException(409, 'Nhiệm vụ vừa thay đổi')
    return output(new, user)


@router.post('/tasks/{task_id}/approve')
def approve_task(task_id: str, revision: int, user: dict = Depends(current_user)):
    task = task_load(task_id, user); require_author(user)
    if task['created_by'] == user['_id'] or not policy.can(user, 'space.write', task):
        raise HTTPException(403, 'Cần người khác có quyền soạn / sửa kho duyệt')
    new = tasks.find_one_and_update({'_id': task['_id'], 'status': 'draft', 'revision': revision}, {'$set': {'status': 'approved', 'approved_by': user['_id'], 'approved_at': db.now()}, '$inc': {'revision': 1}}, return_document=True)
    if not new: raise HTTPException(409, 'Nháp vừa thay đổi / đã khoá')
    return output(new, user)


@router.post('/tasks/{task_id}/publish')
def publish_task(task_id: str, revision: int, user: dict = Depends(current_user)):
    task = task_load(task_id, user); require_author(user)
    if not policy.can(user, 'space.write', task): raise HTTPException(403, 'Không có quyền phát hành')
    new = tasks.find_one_and_update({'_id': task['_id'], 'status': 'approved', 'revision': revision}, {'$set': {'status': 'published', 'published_at': db.now()}, '$inc': {'revision': 1}}, return_document=True)
    if not new: raise HTTPException(409, 'Chỉ phát hành bản đã duyệt')
    return output(new, user)


@router.post('/tasks/{task_id}/copy', status_code=201)
def copy_task(task_id: str, user: dict = Depends(current_user)):
    task = task_load(task_id, user); require_author(user); target_space(user, str(task['space_id']))
    data = {k: deepcopy(v) for k, v in task.items() if k not in ('_id', 'approved_by', 'approved_at', 'published_at')}
    data |= {'source_id': task['_id'], 'version': task.get('version', 1) + 1, 'created_by': user['_id'], 'status': 'draft', 'revision': 1}
    data['_id'] = tasks.insert_one(data).inserted_id
    return output(data, user)
