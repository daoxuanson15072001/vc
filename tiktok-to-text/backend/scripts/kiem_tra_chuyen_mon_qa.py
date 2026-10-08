"""Kiểm chuyển/quay lui trên bản ghi tạm QA; không đụng bài QA đang có."""
from pathlib import Path
import sys
from uuid import uuid4
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bson import ObjectId
from app import db
from chuyen_mon_hoc import migrate

if db.db.name != 'tiktok_to_text_qa':
    raise SystemExit('Chỉ được chạy với MONGO_DB=tiktok_to_text_qa')
category = 'qa-tk16-' + uuid4().hex
subject_id, draft_id, pub_id = ObjectId(), ObjectId(), ObjectId()
try:
    db.db.learning_nodes.insert_one({'_id': subject_id, 'kind': 'subject', 'status': 'active', 'title': category})
    db.db.lessons.insert_many([{'_id': draft_id, 'title': category, 'status': 'draft', 'category': category}, {'_id': pub_id, 'title': category, 'status': 'published', 'category': category}])
    mapping = {category: str(subject_id)}
    dry = migrate(db.db, mapping)
    assert dry['eligible'] == 1 and dry['changed'] == 0
    applied = migrate(db.db, mapping, True)
    assert applied['changed'] == 1
    assert 'subject_id' not in db.db.lessons.find_one({'_id': pub_id})
    assert migrate(db.db, mapping, True)['changed'] == 0
    undone = migrate(db.db, mapping, True, True)
    # undo scoped below is required: never process someone else's journal.
    assert 'subject_id' not in db.db.lessons.find_one({'_id': draft_id})
    print({'database': db.db.name, 'dry_run': dry, 'applied': applied, 'undo': undone, 'published_unchanged': True})
finally:
    db.db.learning_migration_journal.delete_many({'lesson_id': draft_id})
    db.db.lessons.delete_many({'_id': {'$in': [draft_id, pub_id]}})
    db.db.learning_nodes.delete_one({'_id': subject_id})
