"""TK-16 LRN-18…24: quyền, snapshot, đa phương tiện, nộp/chấm, chuyển/quay lui."""
from datetime import timedelta
from importlib.util import spec_from_file_location, module_from_spec
from pathlib import Path
import pytest
from bson import ObjectId
from app import db
from app.learn.training import nodes, documents
from app.learn.models import lessons
from .test_learn_api import shared_space

@pytest.fixture
def training(org_sample, client):
    p = org_sample['people']; author = p['tp_part_kd']; reviewer = p['tp_part_mkt']
    space = shared_space(author, [(reviewer, 'editor'), (p['nv_part_kd'], 'viewer')])
    client.login(author)
    def node(kind, title, parent=None):
        r = client.post('/api/learn/structure', json={'kind': kind, 'title': title, 'parent_id': parent, 'space_id': str(space['_id'])})
        assert r.status_code == 201, r.text
        return r.json()['id']
    faculty = node('faculty', 'Tài chính'); department = node('department', 'Kế hoạch', faculty)
    sub = node('subject', 'Lập kế hoạch', department)
    faculty2 = node('faculty', 'Marketing'); department2 = node('department', 'SEO', faculty2)
    sub2 = node('subject', 'Kế hoạch SEO', department2)
    return {'c': client, 'p': p, 'author': author, 'reviewer': reviewer, 'space': space, 'subject': sub, 'subject2': sub2}


def new_lesson(w, title='Phân tích dữ liệu', **extra):
    r = w['c'].post('/api/learn/lessons', json={'title': title, 'subject_id': w['subject'], 'space_id': str(w['space']['_id']), 'materials': [{'title': 'Video bài giảng', 'kind': 'video', 'source': 'link', 'url': 'https://example.com/lesson.mp4'}]} | extra)
    assert r.status_code == 201, r.text
    return r.json()


def new_doc(w, kind, **extra):
    r = w['c'].post('/api/learn/documents', json={'kind': kind, 'title': 'Tài liệu ' + kind, 'subject_id': w['subject'], 'space_id': str(w['space']['_id'])} | extra)
    assert r.status_code == 201, r.text
    return r.json()


def publish_doc(w, doc):
    c = w['c']; c.login(w['reviewer'])
    r = c.post(f"/api/learn/documents/{doc['id']}/approve?revision={doc['revision']}")
    assert r.status_code == 200, r.text
    doc = r.json(); c.login(w['author'])
    r = c.post(f"/api/learn/documents/{doc['id']}/publish?revision={doc['revision']}")
    assert r.status_code == 200, r.text
    return r.json()


def test_structure_separate_and_cross_faculty_permissions(training):
    w = training; c = w['c']
    assert db.db.categories.count_documents({}) == 0
    c.login(w['p']['nv_part_kd'])
    assert len(c.get('/api/learn/structure').json()['items']) == 6
    assert c.post('/api/learn/structure', json={'kind': 'faculty', 'title': 'X'}).status_code == 403
    c.login(w['p']['nv_part_mkt'])
    assert c.get('/api/learn/structure').json()['items'] == []


def test_lesson_subject_required_media_without_cards_and_title(training):
    w = training; c = w['c']
    assert c.post('/api/learn/lessons', json={'title': 'Bài thiếu môn'}).status_code == 400
    assert c.post('/api/learn/lessons', json={'title': 'Bài 1 Phân tích', 'subject_id': w['subject']}).status_code == 400
    l = new_lesson(w)
    r = c.patch('/api/learn/lessons/' + l['id'], json={'status': 'published'})
    assert r.status_code == 200, r.text
    assert r.json()['items'] == [] and len(r.json()['materials']) == 1
    assert c.patch('/api/learn/lessons/' + l['id'], json={'title': 'Sửa lịch sử'}).status_code == 409
    copied = c.post('/api/learn/lessons/' + l['id'] + '/copy')
    assert copied.status_code == 201, copied.text
    assert copied.json()['status'] == 'draft' and copied.json()['version'] == 2 and copied.json()['source_id'] == l['id']
    assert c.patch('/api/learn/lessons/' + copied.json()['id'], json={'title': 'Phiên bản bài mới'}).status_code == 200
    assert c.get('/api/learn/lessons/' + l['id']).json()['title'] == l['title']


def test_curriculum_order_reuse_and_inline_lesson(training):
    w = training; c = w['c']; l1 = new_lesson(w); l2 = new_lesson(w, 'Lập phương án')
    a = new_doc(w, 'curriculum', lesson_ids=[l1['id'], l2['id']], audience='Giám đốc học nền tảng')
    b = new_doc(w, 'curriculum', lesson_ids=[l2['id'], l1['id']])
    assert a['lesson_ids'] == b['lesson_ids'][::-1]
    l3 = new_lesson(w, 'Dự toán', curriculum_id=a['id'])
    assert l3['audience'] == a['audience']
    assert documents.find_one({'_id': ObjectId(a['id'])})['lesson_ids'][-1] == ObjectId(l3['id'])
    assert c.delete('/api/learn/lessons/' + l1['id']).status_code == 409
    assert c.delete('/api/learn/structure/' + w['subject']).status_code == 409
    assert c.patch('/api/learn/lessons/' + l1['id'], json={'subject_id': w['subject2']}).status_code == 409


def test_plan_sessions_and_class_snapshot(training):
    w = training; c = w['c']; l = new_lesson(w)
    assert c.patch('/api/learn/lessons/' + l['id'], json={'status': 'published'}).status_code == 200
    curr = publish_doc(w, new_doc(w, 'curriculum', lesson_ids=[l['id']]))
    plan = new_doc(w, 'plan', curriculum_id=curr['id'], sessions=[{'title': 'Nền tảng', 'lesson_ids': [l['id']]}, {'title': 'Vận dụng', 'lesson_ids': [l['id']]}])
    assert len(plan['sessions']) == 2
    assert c.post(f"/api/learn/documents/{plan['id']}/approve?revision=1").status_code == 403
    plan = publish_doc(w, plan)
    cls = new_doc(w, 'class', plan_id=plan['id'], learner_ids=[str(w['p']['nv_part_kd']['_id'])], adjustments='Thêm ví dụ VCS')
    assert cls['snapshot'][0]['sessions'] == plan['sessions']
    assert documents.find_one({'_id': ObjectId(plan['id'])}).get('adjustments') == ''
    assert c.delete('/api/learn/documents/' + plan['id']).status_code in (403, 409)
    copy = c.post('/api/learn/documents/' + plan['id'] + '/copy').json()
    assert copy['version'] == 2 and copy['status'] == 'draft'


@pytest.mark.parametrize('title,inputs,product', [
    ('Xây dựng kế hoạch kinh doanh 2027 cho xưởng VCS', 'Dữ liệu 2026, công suất, khách hàng, chi phí', 'Kế hoạch, dự toán, KPI và trình bày'),
    ('Xây dựng kế hoạch SEO cho website X', 'Hiện trạng website, từ khóa, đối thủ', 'Kế hoạch nội dung, kỹ thuật, tiến độ, ngân sách')])
def test_project_group_evidence_grading_retry_history(training, title, inputs, product):
    w = training; c = w['c']; p = w['p']; learner = p['nv_part_kd']
    from .conftest import make_user, set_org
    other = set_org(make_user('hoc-vien-2'), [p['nv_part_kd']['org']['unit_ids'][0]], w['author'])
    db.db.spaces.update_one({'_id': w['space']['_id']}, {'$push': {'members': {'user_id': other['_id'], 'role': 'viewer'}}})
    r = c.post('/api/learn/tasks', json={'title': title, 'kind': 'project', 'subject_id': w['subject'], 'space_id': str(w['space']['_id']), 'mission': title, 'inputs': inputs, 'deliverable': product, 'mode': 'group', 'rubric': [{'title': 'Phương án khả thi', 'weight': 60}, {'title': 'Minh chứng và trình bày', 'weight': 40}]})
    assert r.status_code == 201, r.text
    task = r.json(); c.login(w['reviewer'])
    r = c.post(f"/api/learn/tasks/{task['id']}/approve?revision=1"); assert r.status_code == 200, r.text
    c.login(w['author']); r = c.post(f"/api/learn/tasks/{task['id']}/publish?revision=2"); assert r.status_code == 200, r.text
    members = [str(learner['_id']), str(other['_id'])]
    r = c.post('/api/learn/tasks/' + task['id'] + '/assign', json={'learner_ids': members, 'mentor_id': str(w['author']['_id']), 'grader_id': str(w['author']['_id']), 'due_at': (db.now() + timedelta(days=14)).isoformat()})
    assert r.status_code == 201, r.text
    work = r.json(); c.login(learner)
    url = '/api/learn/work/' + work['id']
    assert c.post(url + '/submit', json={'revision': 1, 'product': product}).status_code == 400
    contributions = {i: 'Phân tích có nguồn và lịch sử chỉnh sửa' for i in members}
    r = c.post(url + '/submit', json={'revision': 1, 'product': product, 'contributions': contributions})
    assert r.status_code == 200, r.text
    assert c.post(url + '/grade', json={'revision': 2, 'scores': [90, 90], 'feedback': 'Đạt'}).status_code == 403
    c.login(w['author'])
    r = c.post(url + '/grade', json={'revision': 2, 'scores': [40, 50], 'feedback': 'Cần bổ sung nguồn', 'individual_feedback': contributions})
    assert r.status_code == 200, r.text
    assert r.json()['status'] == 'retry' and r.json()['score'] == 44
    c.login(learner)
    r = c.post(url + '/submit', json={'revision': 3, 'product': product + ' bổ sung', 'contributions': contributions})
    assert r.status_code == 200
    c.login(w['author'])
    r = c.post(url + '/grade', json={'revision': 4, 'scores': [90, 100], 'feedback': 'Đạt đầy đủ', 'individual_feedback': contributions})
    assert r.json()['status'] == 'passed' and len(r.json()['submissions']) == 2
    assert r.json()['submissions'][0]['grading']['score'] == 44
    assert c.post(url + '/grade', json={'revision': 5, 'scores': [0, 0], 'feedback': 'Ghi đè', 'individual_feedback': contributions}).status_code == 409


def test_assets_private_and_bad_links(training, tmp_path, monkeypatch):
    from app.learn import materials
    monkeypatch.setattr(materials.config, 'RAW_DIR', tmp_path)
    w = training; c = w['c']
    r = c.post('/api/learn/assets', data={'space_id': str(w['space']['_id'])}, files={'file': ('slide.pdf', b'%PDF-1.4\n%test', 'application/pdf')})
    assert r.status_code == 201, r.text
    url = '/api/learn/assets/' + r.json()['id'] + '/content'
    c.login(w['p']['nv_part_mkt']); assert c.get(url).status_code == 404
    c.login(w['author']); assert c.get(url).status_code == 200
    assert c.post('/api/learn/assets', files={'file': ('fake.pdf', b'not a pdf', 'application/pdf')}).status_code == 400
    for bad in ['http://example.com/file', 'https://127.0.0.1/test', 'https://localhost/file', 'javascript:alert(1)']:
        assert c.post('/api/learn/lessons', json={'title': 'X', 'subject_id': w['subject'], 'materials': [{'title': 'X', 'kind': 'video', 'url': bad}]}).status_code == 400


def test_migration_dry_apply_undo_keeps_published(training):
    w = training
    spec = spec_from_file_location('migration', Path(__file__).parents[1] / 'scripts/chuyen_mon_hoc.py'); module = module_from_spec(spec); spec.loader.exec_module(module)
    draft = lessons.insert_one({'title': 'Bài cũ', 'status': 'draft', 'category': 'cu'}).inserted_id
    published = lessons.insert_one({'title': 'Bài đã giao', 'status': 'published', 'category': 'cu'}).inserted_id
    mapping = {'cu': w['subject']}
    assert module.migrate(db.db, mapping)['eligible'] == 1
    assert 'subject_id' not in lessons.find_one({'_id': draft})
    assert module.migrate(db.db, mapping, True)['changed'] == 1
    assert module.migrate(db.db, mapping, True)['changed'] == 0
    assert 'subject_id' not in lessons.find_one({'_id': published})
    assert module.migrate(db.db, {}, True, True)['changed'] == 1
    assert 'subject_id' not in lessons.find_one({'_id': draft})
    with pytest.raises(ValueError): module.migrate(db.client['tiktok_to_text'], {}, True)


def test_progress_requires_receipt_and_project_not_opening(training):
    w = training; c = w['c']; learner = w['p']['nv_part_kd']
    lesson = new_lesson(w)
    c.patch('/api/learn/lessons/' + lesson['id'], json={'status': 'published'})
    r = c.post('/api/learn/tasks', json={'title': 'Kế hoạch SEO cho website X', 'kind': 'project', 'subject_id': w['subject'], 'space_id': str(w['space']['_id']), 'mission': 'Thiết kế kế hoạch SEO', 'inputs': 'Dữ liệu hiện trạng', 'deliverable': 'Kế hoạch và KPI', 'rubric': [{'title': 'Khả thi', 'weight': 100}]})
    assert r.status_code == 201
    task = r.json(); c.login(w['reviewer'])
    assert c.post(f"/api/learn/tasks/{task['id']}/approve?revision=1").status_code == 200
    c.login(w['author']); assert c.post(f"/api/learn/tasks/{task['id']}/publish?revision=2").status_code == 200
    curr = publish_doc(w, new_doc(w, 'curriculum', lesson_ids=[lesson['id']], task_ids=[task['id']]))
    program = publish_doc(w, new_doc(w, 'program', curriculum_ids=[curr['id']]))
    route = publish_doc(w, new_doc(w, 'route', program_id=program['id'], curriculum_ids=[curr['id']], learner_ids=[str(learner['_id'])]))
    url = '/api/learn/documents/' + route['id']
    c.login(learner); assert not c.get(url + '/progress').json()['completed']
    assert c.get('/api/learn/lessons/' + lesson['id']).status_code == 200
    assert not c.get(url + '/progress').json()['completed']
    r = c.post(url + '/receipt', json={'lesson_id': lesson['id'], 'material_index': 0})
    assert r.status_code == 200, r.text
    assert not r.json()['completed'] and not r.json()['projects_passed']
    c.login(w['author'])
    r = c.post('/api/learn/tasks/' + task['id'] + '/assign', json={'learner_ids': [str(learner['_id'])], 'grader_id': str(w['author']['_id']), 'mentor_id': str(w['author']['_id']), 'document_id': route['id'], 'due_at': (db.now() + timedelta(days=14)).isoformat()})
    assert r.status_code == 201, r.text
    work = r.json(); c.login(learner)
    r = c.post('/api/learn/work/' + work['id'] + '/submit', json={'revision': 1, 'product': 'Kế hoạch SEO và KPI'})
    assert r.status_code == 200, r.text
    c.login(w['author'])
    assert c.post('/api/learn/work/' + work['id'] + '/grade', json={'revision': 2, 'scores': [90], 'feedback': 'Đạt'}).status_code == 200
    c.login(learner); assert c.get(url + '/progress').json()['completed'] is True


def test_manual_equivalence_not_self_or_automatic(training):
    w = training; c = w['c']; learner = w['p']['nv_part_kd']
    l = new_lesson(w); c.patch('/api/learn/lessons/' + l['id'], json={'status': 'published'})
    curr = publish_doc(w, new_doc(w, 'curriculum', lesson_ids=[l['id']]))
    program = publish_doc(w, new_doc(w, 'program', curriculum_ids=[curr['id']]))
    a = publish_doc(w, new_doc(w, 'route', program_id=program['id'], learner_ids=[str(learner['_id'])]))
    b = publish_doc(w, new_doc(w, 'route', program_id=program['id'], learner_ids=[str(learner['_id'])]))
    c.login(learner)
    assert c.post('/api/learn/documents/' + a['id'] + '/receipt', json={'lesson_id': l['id'], 'material_index': 0}).json()['completed']
    assert not c.get('/api/learn/documents/' + b['id'] + '/progress').json()['completed']
    body = {'learner_id': str(learner['_id']), 'lesson_id': l['id'], 'source_document_id': a['id'], 'evidence': 'Cùng bài đã phát hành và kết quả học từ lớp gốc'}
    url = '/api/learn/documents/' + b['id'] + '/equivalencies'
    assert c.post(url, json=body).status_code == 403
    c.login(w['author']); assert c.post(url, json=body).status_code == 201
    assert c.post(url, json=body).status_code == 409
    c.login(learner); assert c.get('/api/learn/documents/' + b['id'] + '/progress').json()['completed']


def test_timed_final_exam_reuses_grading_and_hides_pool(training):
    from .test_learn_api import add_card, make_question, SINGLE
    w = training; c = w['c']; learner = w['p']['nv_part_kd']
    card = add_card(w['space'], 'Đầu vào kế hoạch VCS', current_revision=1)
    q = make_question(c, SINGLE | {'space_id': str(w['space']['_id'])}, [card])
    l = new_lesson(w, practice_question_ids=[q['id']])
    assert c.patch('/api/learn/lessons/' + l['id'], json={'status': 'published'}).status_code == 200
    db.db.questions.update_one({'_id': ObjectId(q['id'])}, {'$set': {'stem': 'Nội dung ngân hàng sửa sau phát hành'}})
    curr = publish_doc(w, new_doc(w, 'curriculum', lesson_ids=[l['id']], exam={'blueprint': [{'kind': 'single', 'count': 1}], 'duration_min': 30, 'attempts': 1}))
    program = publish_doc(w, new_doc(w, 'program', curriculum_ids=[curr['id']]))
    route = publish_doc(w, new_doc(w, 'route', program_id=program['id'], learner_ids=[str(learner['_id'])]))
    c.login(learner)
    raw = c.get('/api/learn/documents').text
    assert '_exam_pool' not in raw and '_practice_pool' not in raw and 'Vì thẻ nói vậy' not in raw and 'correct' not in raw
    url = f"/api/learn/documents/{route['id']}/exams/{curr['id']}/start"
    assert c.post(url).status_code == 409
    c.post('/api/learn/documents/' + route['id'] + '/receipt', json={'lesson_id': l['id'], 'material_index': 0})
    practice = c.post('/api/learn/lessons/' + l['id'] + '/practice').json()
    assert practice['paper'][0]['stem'] == q['stem']
    item = practice['paper'][0]; key = next(x['key'] for x in item['options'] if x['text'] == 'Đúng')
    r = c.post('/api/learn/attempts/' + practice['id'] + '/submit', json={'answers': {q['id']: key}})
    assert r.status_code == 200 and r.json()['passed']
    r = c.post(url); assert r.status_code == 201, r.text
    exam = r.json(); assert 'correct' not in r.text and exam['deadline_at']
    assert c.post(url).json()['id'] == exam['id']
    assert exam['paper'][0]['stem'] == q['stem']
    item = exam['paper'][0]; key = next(x['key'] for x in item['options'] if x['text'] == 'Đúng')
    r = c.post('/api/learn/attempts/' + exam['id'] + '/submit', json={'answers': {q['id']: key}})
    assert r.status_code == 200, r.text
    assert r.json()['passed'] is True
    assert c.get('/api/learn/documents/' + route['id'] + '/progress').json()['completed']
    assert c.post(url).status_code == 409
    assert not c.get('/api/learn/me').json()['months']
    db.db.spaces.update_one({'_id': w['space']['_id']}, {'$pull': {'members': {'user_id': learner['_id']}}})
    assert c.get('/api/learn/documents/' + route['id'] + '/progress').status_code == 404


def test_subject_deletion_blocks_practical_reference(training):
    w = training; c = w['c']
    task = c.post('/api/learn/tasks', json={'kind': 'exercise', 'title': 'Lập kế hoạch SEO website X', 'subject_id': w['subject2'], 'space_id': str(w['space']['_id']), 'mission': 'Lập danh sách từ khoá', 'inputs': 'Website X', 'deliverable': 'Bảng từ khoá', 'guidance': 'Giải thích nhu cầu tìm kiếm', 'rubric': [{'title': 'Phù hợp mục tiêu', 'weight': 100}]} )
    assert task.status_code == 201, task.text
    assert c.delete('/api/learn/structure/' + w['subject2']).status_code == 409


def test_frozen_c3_exam_does_not_send_ai_after_bank_reclassification(training, monkeypatch):
    from app.learn import grading, attempts as att
    from .test_learn_api import ESSAY
    w = training
    question = ESSAY | {'_id': ObjectId(), 'status': 'approved', 'classification': 'C0'}
    db.db.questions.insert_one(question)
    paper = att.build_paper([question]); paper[0]['classification'] = 'C3'
    attempt = att.new_attempt(w['p']['nv_part_kd']['_id'], 'exam', paper, ai_status='pending')
    db.db.attempts.update_one({'_id': attempt['_id']}, {'$set': {'answers': {str(question['_id']): 'Nội dung mật trong bản thi đã chụp'}, 'submitted_at': db.now()}})
    def forbidden(*args):
        raise AssertionError('Không được gửi nội dung C3 sang AI')
    monkeypatch.setattr(grading, 'ai_call', forbidden)
    grading.run_ai_grading(attempt['_id'])
    result = db.db.attempts.find_one({'_id': attempt['_id']})
    assert result['ai_status'] == 'done' and result['ai_grading'][0]['engine'] == 'c3'
