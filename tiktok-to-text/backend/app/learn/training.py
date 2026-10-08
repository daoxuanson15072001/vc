"""TK-16 LRN-18…24: cấu trúc đào tạo độc lập, tài liệu có phiên bản."""
from __future__ import annotations

from copy import deepcopy
from typing import Literal
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from .. import db, policy, org
from ..auth import current_user, users
from .routes import oid, oids, plain, require_author, target_space, lesson_scope, load_lesson
from .models import lessons
from .paths import ExamIn

router = APIRouter(prefix="/api/learn")
nodes = db.db['learning_nodes']
documents = db.db['learning_documents']


def scope(user):
    if policy.can(user, 'learn.author'):
        return policy.visible_filter(user, 'lesson')
    return {'$and': [policy.visible_filter(user, 'lesson'), {'$or': [
        {'status': {'$in': ['approved', 'published', 'active']}}, {'created_by': user['_id']},
        {'learner_ids': user['_id']}]}]}


def load(collection, value, user):
    doc = collection.find_one({'_id': oid(value)} | scope(user))
    if not doc or (collection.name == 'learning_documents' and not document_visible(doc, user)):
        raise HTTPException(404, 'Không tìm thấy nội dung đào tạo')
    return doc


def document_visible(doc, user):
    if doc['kind'] not in ('class', 'route'):
        return True
    if doc['status'] in ('draft', 'approved') and policy.can(user, 'learn.author') and policy.can(user, 'space.write', doc):
        return True
    if user['_id'] in {doc['created_by'], *doc.get('learner_ids', []), *doc.get('teacher_ids', [])}:
        return True
    return any(policy.can(user, 'learn.view_result', {'learner_id': uid, 'assigned_by': doc['created_by']}) for uid in doc.get('learner_ids', []))


def editable(doc, user):
    require_author(user)
    if doc['created_by'] != user['_id'] or not policy.can(user, 'space.write', doc):
        raise HTTPException(403, 'Chỉ người soạn còn quyền sửa kho được chỉnh sửa')
    if doc.get('status') not in ('draft', 'active'):
        raise HTTPException(409, 'Nội dung đã khoá; hãy tạo bản sao')


def output(doc, user):
    def strip_private(value):
        if isinstance(value, dict): return {k: strip_private(v) for k, v in value.items() if not k.startswith(('_exam', '_practice')) }
        if isinstance(value, list): return [strip_private(v) for v in value]
        return value
    out = strip_private(plain(doc))
    out['id'] = out.pop('_id')
    if 'snapshot' in out:
        readable = set(policy.readable_space_ids(user))
        def safe(row):
            if row.get('space_id') and oid(row['space_id']) not in readable:
                return {'title': 'Nội dung không còn quyền xem', 'unavailable': True}
            return row | ({'snapshot': [safe(r) for r in row['snapshot']]} if 'snapshot' in row else {})
        out['snapshot'] = [safe(r) for r in out['snapshot']]
    out['can_edit'] = doc['created_by'] == user['_id'] and policy.can(user, 'learn.author') and policy.can(user, 'space.write', doc) and doc['status'] in ('draft', 'active')
    return out


def subject(value, user):
    doc = load(nodes, value, user)
    if doc['kind'] != 'subject':
        raise HTTPException(400, 'Phải chọn một môn học')
    return doc


class NodeIn(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    kind: Literal['faculty', 'department', 'subject']
    title: str = Field(min_length=1, max_length=200)
    description: str = Field('', max_length=10000)
    parent_id: str | None = None
    space_id: str | None = None
    owner_unit_id: str | None = None
    teacher_ids: list[str] = Field(default_factory=list, max_length=100)
    revision: int = Field(1, ge=1)


def node_content(body, user):
    data = body.model_dump(exclude={'space_id', 'revision'})
    expected = {'department': 'faculty', 'subject': 'department'}.get(body.kind)
    if expected:
        parent = load(nodes, body.parent_id, user)
        if parent['kind'] != expected:
            raise HTTPException(400, 'Cấp cha không đúng Khoa → Bộ môn → Môn')
        data['parent_id'] = parent['_id']
    elif body.parent_id:
        raise HTTPException(400, 'Khoa không có cấp cha')
    if body.owner_unit_id:
        unit = org.org_units.find_one({'_id': oid(body.owner_unit_id)})
        if not unit:
            raise HTTPException(400, 'Đơn vị phụ trách không tồn tại')
        data['owner_unit_id'] = unit['_id']
    data['teacher_ids'] = check_people(body.teacher_ids)
    return data


def check_people(values):
    ids = oids(values, 'người dùng')
    if users.count_documents({'_id': {'$in': ids}, 'active': {'$ne': False}}) != len(ids):
        raise HTTPException(400, 'Có người dùng không tồn tại / đã ngừng hoạt động')
    return ids


@router.get('/structure')
def list_structure(user: dict = Depends(current_user)):
    return {'items': [output(x, user) for x in nodes.find(scope(user)).sort('title', 1)],
            'can_author': policy.can(user, 'learn.author')}


@router.post('/structure', status_code=201)
def create_node(body: NodeIn, user: dict = Depends(current_user)):
    require_author(user)
    space = target_space(user, body.space_id)
    data = node_content(body, user)
    doc = data | {'space_id': space['_id'], 'created_by': user['_id'], 'classification': 'C0',
                  'status': 'active', 'revision': 1, 'created_at': db.now(), 'updated_at': db.now()}
    doc['_id'] = nodes.insert_one(doc).inserted_id
    return output(doc, user)


@router.put('/structure/{node_id}')
def update_node(node_id: str, body: NodeIn, user: dict = Depends(current_user)):
    doc = load(nodes, node_id, user); editable(doc, user)
    if body.kind != doc['kind']:
        raise HTTPException(409, 'Không đổi loại của nhánh đang tồn tại')
    data = node_content(body, user)
    new = nodes.find_one_and_update({'_id': doc['_id'], 'revision': body.revision},
                                    {'$set': data | {'updated_at': db.now()}, '$inc': {'revision': 1}}, return_document=True)
    if not new:
        raise HTTPException(409, 'Dữ liệu vừa thay đổi; tải lại trước khi sửa')
    return output(new, user)


@router.delete('/structure/{node_id}')
def delete_node(node_id: str, user: dict = Depends(current_user)):
    doc = load(nodes, node_id, user); editable(doc, user)
    if nodes.count_documents({'parent_id': doc['_id']}) or lessons.count_documents({'subject_id': doc['_id']}) or documents.count_documents({'subject_id': doc['_id']}) or db.db.learning_tasks.count_documents({'subject_id': doc['_id']}):
        raise HTTPException(409, 'Nhánh đang có nội dung; không thể xoá')
    nodes.delete_one({'_id': doc['_id'], 'revision': doc['revision']})
    return {'deleted': True}


class Activity(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=500)
    minutes: int = Field(ge=1, le=480)
    teacher: str = Field('', max_length=3000)
    learner: str = Field('', max_length=3000)


class Session(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=200)
    lesson_ids: list[str] = Field(default_factory=list, max_length=100)
    teacher_ids: list[str] = Field(default_factory=list, max_length=30)
    goal: str = ''
    format: Literal['onsite', 'online', 'hybrid'] = 'onsite'
    preparation: str = ''
    activities: list[Activity] = Field(default_factory=list, max_length=50)
    assessment: str = ''
    homework: str = ''
    adjustments: str = ''


class DocumentIn(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    kind: Literal['curriculum', 'plan', 'program', 'class', 'route']
    title: str = Field(min_length=1, max_length=200)
    space_id: str | None = None
    subject_id: str | None = None
    curriculum_id: str | None = None
    plan_id: str | None = None
    program_id: str | None = None
    audience: str = Field('', max_length=3000)
    current_level: str = Field('', max_length=3000)
    entry: str = Field('', max_length=10000)
    outcome: str = Field('', max_length=10000)
    goal: str = Field('', max_length=10000)
    lesson_ids: list[str] = Field(default_factory=list, max_length=100)
    task_ids: list[str] = Field(default_factory=list, max_length=100)
    exam: ExamIn | None = None
    curriculum_ids: list[str] = Field(default_factory=list, max_length=100)
    sessions: list[Session] = Field(default_factory=list, max_length=100)
    teacher_ids: list[str] = Field(default_factory=list, max_length=100)
    learner_ids: list[str] = Field(default_factory=list, max_length=100)
    adjustments: str = Field('', max_length=20000)
    revision: int = Field(1, ge=1)


def document_content(body, user):
    data = body.model_dump(exclude={'space_id', 'revision'})
    for field, kind in [('curriculum_id', 'plan'), ('plan_id', 'class'), ('program_id', 'route')]:
        if data.get(field) and body.kind != kind:
            raise HTTPException(400, 'Tham chiếu không phù hợp loại tài liệu')
    if body.lesson_ids and body.kind != 'curriculum':
        raise HTTPException(400, 'Chỉ giáo trình có tổ hợp bài trực tiếp')
    if body.curriculum_ids and body.kind not in ('program', 'route'):
        raise HTTPException(400, 'Chỉ chương trình / lộ trình có tổ hợp giáo trình')
    if body.exam and (body.kind != 'curriculum' or body.exam.scope != 'path'):
        raise HTTPException(400, 'Thi cuối môn chỉ dùng câu từ bài của giáo trình')
    refs = []
    for field, kind in [('curriculum_id', 'curriculum'), ('plan_id', 'plan'), ('program_id', 'program')]:
        if value := data[field]:
            ref = load(documents, value, user)
            if ref['kind'] != kind:
                raise HTTPException(400, 'Loại tài liệu tham chiếu không đúng')
            data[field] = ref['_id']; refs.append(ref)
    if body.kind in ('curriculum', 'plan'):
        if body.kind == 'plan':
            if not body.curriculum_id:
                raise HTTPException(400, 'Giáo án cần giáo trình')
            data['subject_id'] = refs[0]['subject_id']
        else:
            data['subject_id'] = subject(body.subject_id, user)['_id']
    elif data['subject_id']:
        data['subject_id'] = subject(body.subject_id, user)['_id']
    data['lesson_ids'] = oids(body.lesson_ids, 'bài')
    for lid in data['lesson_ids']:
        lesson = load_lesson(str(lid), user)
        if body.kind == 'curriculum' and lesson.get('subject_id') != data['subject_id']:
            raise HTTPException(400, 'Bài học phải thuộc cùng môn của giáo trình')
    from .practical import task_load
    data['task_ids'] = oids(body.task_ids, 'nhiệm vụ')
    for tid in data['task_ids']:
        task = task_load(str(tid), user)
        if body.kind != 'curriculum' or task['subject_id'] != data['subject_id']:
            raise HTTPException(400, 'Nhiệm vụ phải cùng môn của giáo trình')
        refs.append(task)
    data['curriculum_ids'] = oids(body.curriculum_ids, 'giáo trình')
    for cid in data['curriculum_ids']:
        ref = load(documents, str(cid), user)
        if ref['kind'] != 'curriculum':
            raise HTTPException(400, 'Chương trình chỉ dùng giáo trình')
        refs.append(ref)
    if body.kind in ('plan', 'class'):
        allowed = set(refs[0].get('lesson_ids', [])) if body.kind == 'plan' else ref_lesson_ids([refs[0]])
        for session in data['sessions']:
            session['lesson_ids'] = oids(session['lesson_ids'], 'bài')
            if not set(session['lesson_ids']) <= allowed:
                raise HTTPException(400, 'Buổi dạy chỉ chọn bài thuộc giáo trình')
            session['teacher_ids'] = check_people(session['teacher_ids'])
    data['teacher_ids'] = check_people(body.teacher_ids)
    data['learner_ids'] = check_people(body.learner_ids)
    if body.kind not in ('class', 'route') and body.learner_ids:
        raise HTTPException(400, 'Chỉ lớp / lộ trình có người học')
    if body.kind in ('class', 'route'):
        field = 'plan_id' if body.kind == 'class' else 'program_id'
        if not data[field]:
            raise HTTPException(400, 'Lớp cần giáo án / lộ trình cần chương trình')
        if any(r['status'] != 'published' for r in refs):
            raise HTTPException(400, 'Lớp / lộ trình chỉ sử dụng mẫu đã phát hành')
        if body.kind == 'route':
            program = next(r for r in refs if r['kind'] == 'program')
            if not set(data['curriculum_ids']) <= set(program.get('curriculum_ids', [])):
                raise HTTPException(400, 'Lộ trình chỉ chọn giáo trình trong chương trình')
            chosen = data['curriculum_ids'] or program.get('curriculum_ids', [])
            trimmed = deepcopy(program)
            snapshot_map = {r.get('_id'): r for r in program.get('snapshot', [])}
            trimmed['snapshot'] = [snapshot_map[i] for i in chosen if i in snapshot_map]
            trimmed['curriculum_ids'] = list(chosen)
            refs = [trimmed]
        allowed = set(policy.assignable_learners(user))
        if not set(data['learner_ids']) <= allowed:
            raise HTTPException(403, 'Có người học ngoài phạm vi giao')
        # Mỗi người phải đọc được mọi bài của mẫu, kể cả bài liên khoa.
        all_lessons = ref_lesson_ids(refs)
        for uid in data['learner_ids']:
            learner = users.find_one({'_id': uid})
            for lid in all_lessons:
                lesson = load_lesson(str(lid), learner)
                from .materials import materials_out
                if any(m.get('required') and m.get('unavailable') for m in materials_out(lesson.get('materials', []), learner)):
                    raise HTTPException(403, 'Người học chưa có quyền xem học liệu bắt buộc')
        data['snapshot'] = [deepcopy(r) for r in refs]
    data['classification'] = policy.inherit_classification([
        *refs, *list(lessons.find({'_id': {'$in': data['lesson_ids']}}))])
    return data


def ref_lesson_ids(refs):
    ids = set()
    for ref in refs:
        ids.update(ref.get('lesson_ids', []))
        for session in ref.get('sessions', []):
            ids.update(session.get('lesson_ids', []))
        for nested in ref.get('snapshot', []):
            ids.update(ref_lesson_ids([nested]))
    return ids


@router.get('/documents')
def list_documents(kind: str | None = None, subject_id: str | None = None, user: dict = Depends(current_user)):
    f = scope(user)
    if kind: f['kind'] = kind
    if subject_id: f['subject_id'] = oid(subject_id)
    return {'items': [output(x, user) for x in documents.find(f).sort('updated_at', -1).limit(500) if document_visible(x, user)]}


@router.post('/documents', status_code=201)
def create_document(body: DocumentIn, user: dict = Depends(current_user)):
    require_author(user); space = target_space(user, body.space_id)
    data = document_content(body, user)
    doc = data | {'space_id': space['_id'], 'created_by': user['_id'], 'status': 'draft',
                  'revision': 1, 'version': 1, 'created_at': db.now(), 'updated_at': db.now()}
    doc['_id'] = documents.insert_one(doc).inserted_id
    return output(doc, user)


@router.put('/documents/{doc_id}')
def update_document(doc_id: str, body: DocumentIn, user: dict = Depends(current_user)):
    doc = load(documents, doc_id, user); editable(doc, user)
    if body.kind != doc['kind']:
        raise HTTPException(409, 'Không đổi loại tài liệu')
    data = document_content(body, user)
    # Mẫu đã chụp cho lớp không đổi khi điều chỉnh lớp.
    if doc['kind'] in ('class', 'route'):
        if any(data.get(k) != doc.get(k) for k in ('plan_id', 'program_id', 'curriculum_ids')):
            raise HTTPException(409, 'Đổi mẫu bằng lớp / lộ trình mới')
        data['snapshot'] = doc['snapshot']
    new = documents.find_one_and_update({'_id': doc['_id'], 'status': 'draft', 'revision': body.revision},
        {'$set': data | {'updated_at': db.now()}, '$inc': {'revision': 1}}, return_document=True)
    if not new: raise HTTPException(409, 'Dữ liệu vừa thay đổi; tải lại')
    return output(new, user)


@router.post('/documents/{doc_id}/approve')
def approve_document(doc_id: str, revision: int, user: dict = Depends(current_user)):
    doc = load(documents, doc_id, user); require_author(user)
    if doc['created_by'] == user['_id'] or not policy.can(user, 'space.write', doc):
        raise HTTPException(403, 'Cần người khác có quyền soạn và sửa kho duyệt')
    new = documents.find_one_and_update({'_id': doc['_id'], 'status': 'draft', 'revision': revision},
        {'$set': {'status': 'approved', 'approved_by': user['_id'], 'approved_at': db.now()}, '$inc': {'revision': 1}}, return_document=True)
    if not new: raise HTTPException(409, 'Bản nháp đã thay đổi / đã khoá')
    return output(new, user)


@router.post('/documents/{doc_id}/publish')
def publish_document(doc_id: str, revision: int, user: dict = Depends(current_user)):
    doc = load(documents, doc_id, user); require_author(user)
    if not policy.can(user, 'space.write', doc): raise HTTPException(403, 'Không có quyền phát hành kho')
    refs = []
    for field in ('curriculum_id', 'plan_id', 'program_id'):
        if doc.get(field): refs.append(load(documents, str(doc[field]), user))
    refs += [load(documents, str(i), user) for i in doc.get('curriculum_ids', [])]
    refs += [load_lesson(str(i), user) for i in doc.get('lesson_ids', [])]
    from .practical import task_load
    refs += [task_load(str(i), user) for i in doc.get('task_ids', [])]
    if any(r['status'] != 'published' for r in refs):
        raise HTTPException(400, 'Mọi bài / tài liệu tham chiếu phải phát hành trước')
    if doc['kind'] == 'curriculum' and not doc.get('lesson_ids'):
        raise HTTPException(400, 'Giáo trình cần bài học')
    if doc['kind'] == 'program' and not doc.get('curriculum_ids'):
        raise HTTPException(400, 'Chương trình cần giáo trình')
    if doc['kind'] == 'plan' and not doc.get('sessions'):
        raise HTTPException(400, 'Giáo án cần buổi dạy')
    exam_pool = None
    if doc.get('exam'):
        from . import grading
        from .routes import usable_practice, cards
        by_id = {q['_id']: deepcopy(q) for lesson in refs if 'practice_question_ids' in lesson for q in usable_practice(user, lesson)}
        exam_pool = list(by_id.values())
        card_ids = {r['card_id'] for q in exam_pool for r in q.get('card_refs', [])}
        categories = {c['_id']: c.get('categories', []) for c in cards.find({'_id': {'$in': list(card_ids)}})}
        for q in exam_pool:
            q['_cats'] = {category for r in q.get('card_refs', []) for category in categories.get(r['card_id'], [])}
        grading.draw(exam_pool, doc['exam']['blueprint'])
        for question in exam_pool:
            question['_cats'] = list(question.get('_cats') or [])
    snapshot = doc.get('snapshot') if doc['kind'] in ('class', 'route') else deepcopy(refs)
    new = documents.find_one_and_update({'_id': doc['_id'], 'status': 'approved', 'revision': revision},
        {'$set': {'status': 'published', '_exam_pool': exam_pool, 'snapshot': snapshot, 'classification': policy.inherit_classification(refs + (exam_pool or [])), 'published_at': db.now(), 'published_by': user['_id']}, '$inc': {'revision': 1}}, return_document=True)
    if not new: raise HTTPException(409, 'Chỉ phát hành đúng phiên bản đã duyệt')
    return output(new, user)


@router.post('/documents/{doc_id}/copy', status_code=201)
def copy_document(doc_id: str, user: dict = Depends(current_user)):
    doc = load(documents, doc_id, user); require_author(user)
    space = target_space(user, str(doc['space_id']))
    data = {k: deepcopy(v) for k, v in doc.items() if k not in ('_id', 'approved_by', 'approved_at', 'published_by', 'published_at')}
    data |= {'source_id': doc['_id'], 'created_by': user['_id'], 'space_id': space['_id'], 'status': 'draft',
             'revision': 1, 'version': doc.get('version', 1) + 1, 'created_at': db.now(), 'updated_at': db.now()}
    data['_id'] = documents.insert_one(data).inserted_id
    return output(data, user)


@router.delete('/documents/{doc_id}')
def delete_document(doc_id: str, user: dict = Depends(current_user)):
    doc = load(documents, doc_id, user); editable(doc, user)
    if documents.count_documents({'$or': [{k: doc['_id']} for k in ('curriculum_id', 'plan_id', 'program_id', 'curriculum_ids', 'source_id')]}):
        raise HTTPException(409, 'Tài liệu đang được dùng')
    documents.delete_one({'_id': doc['_id'], 'status': 'draft', 'revision': doc['revision']})
    return {'deleted': True}

# Hoàn thành chương trình/lớp mới tách khỏi tiến độ legacy.
receipts = db.db['learning_receipts']

class ReceiptIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    lesson_id: str
    material_index: int = Field(ge=0, le=99)


def assigned_document(doc_id, user):
    doc = load(documents, doc_id, user)
    if doc['kind'] not in ('class', 'route') or doc['status'] != 'published' or user['_id'] not in doc.get('learner_ids', []): raise HTTPException(404, 'Không có lớp / lộ trình được giao')
    return doc


def frozen_lessons(doc):
    result = {}
    def walk(row):
        if 'practice_question_ids' in row and '_id' in row:
            result[row['_id']] = row
        for child in row.get('snapshot', []): walk(child)
    walk(doc)
    return result


@router.get('/documents/{doc_id}/progress')
def document_progress(doc_id: str, user: dict = Depends(current_user)):
    from .models import attempts
    from .practical import works
    doc = assigned_document(doc_id, user)
    frozen = frozen_lessons(doc)
    # Lớp có mẫu plan → curriculum → lesson snapshot.
    rows = []
    for lid, lesson in frozen.items():
        load_lesson(str(lid), user)
        required = [i for i, m in enumerate(lesson.get('materials', [])) if m.get('required', True)]
        acknowledged = {r['material_index'] for r in receipts.find({'document_id': doc['_id'], 'learner_id': user['_id'], 'lesson_id': lid})}
        equivalent = equivalencies.find_one({'document_id': doc['_id'], 'learner_id': user['_id'], 'lesson_id': lid})
        qs = lesson.get('practice_question_ids', [])
        quiz_passed = not qs or bool(attempts.find_one({'lesson_id': lid, 'learner_id': user['_id'], 'passed': True, 'finalized_at': {'$ne': None}, 'started_at': {'$gte': doc['published_at']}}))
        required_tasks = [t for t in frozen_tasks(doc).values() if t.get('required') and t.get('lesson_id') == lid]
        practical_passed = all(works.find_one({'document_id': doc['_id'], 'task_id': t['_id'], 'learner_ids': user['_id'], 'passed': True}) for t in required_tasks)
        rows.append({'lesson_id': str(lid), 'title': lesson['title'], 'materials_done': len(set(required) & acknowledged),
                     'materials_required': len(required), 'equivalency': plain(equivalent) if equivalent else None, 'quiz_passed': bool(equivalent) or quiz_passed, 'practical_passed': practical_passed,
                     'completed': (bool(equivalent) or (set(required) <= acknowledged and quiz_passed)) and practical_passed})
    projects = [t for t in frozen_tasks(doc).values() if t.get('required') and (t.get('kind') == 'project' or not t.get('lesson_id'))]
    projects_passed = all(works.find_one({'document_id': doc['_id'], 'task_id': t['_id'], 'learner_ids': user['_id'], 'passed': True}) for t in projects)
    exam_rows = []
    for cid, curriculum in frozen_curricula(doc).items():
        if curriculum.get('exam'):
            result = attempts.find_one({'training_document_id': doc['_id'], 'curriculum_id': cid, 'learner_id': user['_id'], 'kind': 'exam', 'passed': True, 'finalized_at': {'$ne': None}})
            latest = attempts.find_one({'training_document_id': doc['_id'], 'curriculum_id': cid, 'learner_id': user['_id'], 'kind': 'exam'}, sort=[('started_at', -1)])
            exam_rows.append({'curriculum_id': str(cid), 'title': curriculum['title'], 'passed': bool(result), 'attempt_id': str(latest['_id']) if latest else None})
    return {'items': rows, 'exams': exam_rows, 'projects_passed': bool(projects_passed),
            'completed': bool(rows) and all(r['completed'] for r in rows) and bool(projects_passed) and all(e['passed'] for e in exam_rows)}


def frozen_tasks(doc):
    result = {}
    def walk(row):
        if 'mission' in row and 'rubric' in row and '_id' in row:
            result[row['_id']] = row
        for child in row.get('snapshot', []): walk(child)
    walk(doc)
    return result


@router.post('/documents/{doc_id}/receipt')
def acknowledge_material(doc_id: str, body: ReceiptIn, user: dict = Depends(current_user)):
    from .materials import materials_out
    doc = assigned_document(doc_id, user)
    lesson = frozen_lessons(doc).get(oid(body.lesson_id))
    if not lesson: raise HTTPException(404, 'Bài không thuộc lớp / lộ trình')
    load_lesson(body.lesson_id, user)
    material = materials_out(lesson.get('materials', []), user)
    if body.material_index >= len(material) or material[body.material_index].get('unavailable'):
        raise HTTPException(400, 'Học liệu không có / không được xem')
    receipts.update_one({'document_id': doc['_id'], 'learner_id': user['_id'], 'lesson_id': lesson['_id'], 'material_index': body.material_index},
                        {'$setOnInsert': {'acknowledged_at': db.now()}}, upsert=True)
    return document_progress(doc_id, user)

# Công nhận tương đương chỉ qua quyết định có minh chứng, không theo chức danh.
equivalencies = db.db['learning_equivalencies']

class EquivalencyIn(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    learner_id: str
    lesson_id: str
    source_document_id: str
    evidence: str = Field(min_length=1, max_length=10000)


@router.post('/documents/{doc_id}/equivalencies', status_code=201)
def recognize_equivalency(doc_id: str, body: EquivalencyIn, user: dict = Depends(current_user)):
    doc = load(documents, doc_id, user)
    learner_id, lesson_id = oid(body.learner_id), oid(body.lesson_id)
    if doc['status'] != 'published' or doc['kind'] not in ('class', 'route') or learner_id not in doc.get('learner_ids', []):
        raise HTTPException(400, 'Chọn người học trong lớp / lộ trình đã phát hành')
    if learner_id == user['_id'] or not policy.can(user, 'learn.grade', {'learner_id': learner_id, 'assigned_by': doc['created_by']}):
        raise HTTPException(403, 'Chỉ người giao / quản lý có quyền chấm công nhận; không tự công nhận')
    if lesson_id not in frozen_lessons(doc): raise HTTPException(400, 'Bài không thuộc nội dung được giao')
    learner = users.find_one({'_id': learner_id})
    source = assigned_document(body.source_document_id, learner)
    if source['_id'] == doc['_id']: raise HTTPException(400, 'Cần kết quả từ lớp / lộ trình khác')
    if lesson_id not in frozen_lessons(source): raise HTTPException(400, 'Chỉ công nhận đúng cùng bài / phiên bản đã phát hành')
    # Không nối chuỗi công nhận: nguồn phải thực học và kiểm tra đạt ở lượt gốc.
    result = next((r for r in document_progress(body.source_document_id, learner)['items'] if r['lesson_id'] == body.lesson_id), None)
    if not result or not result['completed'] or equivalencies.find_one({'document_id': source['_id'], 'learner_id': learner_id, 'lesson_id': lesson_id}):
        raise HTTPException(400, 'Nguồn chưa hoàn thành hoặc đã là kết quả công nhận')
    record = {'_id': f"{doc['_id']}:{learner_id}:{lesson_id}", 'document_id': doc['_id'], 'learner_id': learner_id, 'lesson_id': lesson_id,
              'source_document_id': source['_id'], 'evidence': body.evidence, 'recognized_by': user['_id'], 'recognized_at': db.now()}
    from pymongo.errors import DuplicateKeyError
    try:
        equivalencies.insert_one(record)
    except DuplicateKeyError:
        raise HTTPException(409, 'Đã công nhận; quyết định được giữ bất biến') from None
    return plain(record)



def frozen_curricula(doc):
    result = {}
    def walk(row):
        if row.get('kind') == 'curriculum' and '_id' in row: result[row['_id']] = row
        for child in row.get('snapshot', []): walk(child)
    walk(doc)
    return result


@router.post('/documents/{doc_id}/exams/{curriculum_id}/start', status_code=201)
def start_training_exam(doc_id: str, curriculum_id: str, user: dict = Depends(current_user)):
    from datetime import timedelta
    from uuid import uuid4
    from pymongo.errors import DuplicateKeyError
    key = f'{doc_id}:{curriculum_id}:{user["_id"]}'
    token = uuid4().hex
    locks = db.db['learning_exam_locks']
    lease = {'token': token, 'expires_at': db.now() + timedelta(seconds=60)}
    try:
        locks.insert_one({'_id': key} | lease)
    except DuplicateKeyError:
        if not locks.find_one_and_update({'_id': key, 'expires_at': {'$lte': db.now()}}, {'$set': lease}):
            raise HTTPException(409, 'Đang mở lượt thi; hãy thử lại') from None
    try:
        return _start_training_exam(doc_id, curriculum_id, user)
    finally:
        locks.delete_one({'_id': key, 'token': token})


def _start_training_exam(doc_id: str, curriculum_id: str, user: dict):
    from datetime import timedelta
    from . import attempts as att, grading
    from .models import assignments, attempts
    doc = assigned_document(doc_id, user)
    cid = oid(curriculum_id)
    curriculum = frozen_curricula(doc).get(cid)
    if not curriculum or not curriculum.get('exam'):
        raise HTTPException(404, 'Giáo trình không có thi cuối môn')
    progress = document_progress(doc_id, user)
    states = {oid(r['lesson_id']): r['completed'] for r in progress['items']}
    if not all(states.get(lid) for lid in curriculum.get('lesson_ids', [])):
        raise HTTPException(409, 'Hoàn thành các bài của giáo trình trước khi thi')
    exam = curriculum['exam']
    f = {'training_document_id': doc['_id'], 'curriculum_id': cid, 'learner_id': user['_id'], 'kind': 'exam'}
    grading.expire_due(f)
    pending = attempts.find_one(f | {'submitted_at': None})
    if pending: return grading.exam_out(pending, user)
    if attempts.count_documents(f) >= exam['attempts']:
        raise HTTPException(409, 'Đã hết lượt thi cuối môn')
    from .routes import visible_card_ids
    pool = []
    for q in curriculum.get('_exam_pool') or []:
        ids = [r['card_id'] for r in q.get('card_refs', [])]
        if set(ids) <= visible_card_ids(user, ids): pool.append(q)
    drawn = grading.draw(pool, exam['blueprint'])
    paper = att.build_paper(drawn)
    classes = {q['_id']: policy.effective_classification(q) for q in drawn}
    for item in paper:
        item['classification'] = classes[item['question_id']]
    key = {'path_id': doc['_id'], 'learner_id': user['_id']}
    asg = assignments.find_one_and_update(key, {'$setOnInsert': {
        'training_document_id': doc['_id'], 'assigned_by': doc['created_by'], 'lesson_ids': [],
        'due_at': None, 'status': 'in_progress', 'created_at': db.now(), 'progress': {}}}, upsert=True, return_document=True)
    now = db.now()
    attempt = att.new_attempt(user['_id'], 'exam', paper, assignment_id=asg['_id'], path_id=doc['_id'],
        training_document_id=doc['_id'], curriculum_id=cid, started_at=now,
        deadline_at=now + timedelta(minutes=exam['duration_min']), duration_min=exam['duration_min'],
        pass_score=exam['pass_score'], auto_submitted=False, ai_status=None, ai_error=None, ai_feedback=None)
    return grading.exam_out(attempt, user)
