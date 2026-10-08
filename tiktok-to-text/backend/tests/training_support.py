"""Dữ liệu môn tường minh cho các ca hồi quy trước TK-16 (không đổi quyền)."""
from app import auth, db
from app.spaces import personal_space


def training_subject(client):
    session = auth.sessions.find_one({'_id': client.cookies.get(auth.SESSION_COOKIE)})
    user = auth.users.find_one({'_id': session['user_id']})
    found = db.db.learning_nodes.find_one({'kind': 'subject', 'created_by': user['_id'], 'test_fixture': True})
    if found: return str(found['_id'])
    space = personal_space(user)
    parent = None
    for kind in ('faculty', 'department', 'subject'):
        doc = {'kind': kind, 'title': 'Môn hồi quy' if kind == 'subject' else kind, 'parent_id': parent,
               'created_by': user['_id'], 'space_id': space['_id'], 'classification': 'C0', 'status': 'active',
               'test_fixture': True, 'revision': 1}
        parent = db.db.learning_nodes.insert_one(doc).inserted_id
    return str(parent)
