#!/usr/bin/env python3
"""TK-16: gắn môn cho bài NHÁP trên QA/UAT qua mapping tường minh, có undo.
Chạy từ backend: MONGO_DB=tiktok_to_text_qa ../.venv/bin/python scripts/chuyen_mon_hoc.py --mapping /tmp/mapping.json
Mapping {"slug-cu": "id-mon-moi"}. Mặc định chỉ đếm; --apply mới ghi.
"""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bson import ObjectId
from app import db


def migrate(database, mapping, apply=False, undo=False):
    if database.name not in ('tiktok_to_text_qa', 'tiktok_to_text_uat') and not database.name.startswith('tiktok_to_text_pytest_'):
        raise ValueError('Chỉ chạy trên QA/UAT/pytest; chặn database thật')
    lessons = database.lessons; journal = database.learning_migration_journal
    if apply: journal.create_index('lesson_id', unique=True)
    counts = {'eligible': 0, 'changed': 0, 'skipped': 0, 'conflicts': 0}
    if undo:
        undo_filter = {'undone': {'$ne': True}}
        if mapping: undo_filter['after'] = {'$in': [ObjectId(v) for v in mapping.values()]}
        for row in journal.find(undo_filter):
            lesson = lessons.find_one({'_id': row['lesson_id']})
            if not lesson or lesson.get('subject_id') != row['after'] or lesson.get('status') != 'draft':
                counts['conflicts'] += 1; continue
            counts['eligible'] += 1
            if apply:
                update = {'$set': {'subject_id': row['before']}} if row['had_field'] else {'$unset': {'subject_id': ''}}
                result = lessons.update_one({'_id': row['lesson_id'], 'status': 'draft', 'subject_id': row['after']}, update)
                if result.modified_count:
                    journal.update_one({'_id': row['_id']}, {'$set': {'undone': True, 'undone_at': db.now()}})
                    counts['changed'] += 1
        return counts
    checked = {}
    for category, value in mapping.items():
        node = database.learning_nodes.find_one({'_id': ObjectId(value), 'kind': 'subject', 'status': 'active'})
        if not node: raise ValueError(f'Mapping {category}: không có môn hợp lệ')
        checked[category] = node['_id']
    for lesson in lessons.find({'category': {'$in': list(checked)}}):
        if lesson.get('status') != 'draft' or lesson.get('subject_id'):
            counts['skipped'] += 1; continue
        counts['eligible'] += 1
        if not apply: continue
        after = checked[lesson['category']]
        # Journal trước khi ghi; pending cho phép chạy lại sau gián đoạn.
        old = journal.find_one({'lesson_id': lesson['_id']})
        if old and not old.get('undone') and old['after'] != after:
            counts['conflicts'] += 1; continue
        journal.update_one({'lesson_id': lesson['_id']}, {'$set': {
            'before': lesson.get('subject_id'), 'had_field': 'subject_id' in lesson,
            'after': after, 'undone': False, 'at': db.now()}}, upsert=True)
        result = lessons.update_one({'_id': lesson['_id'], 'status': 'draft', 'subject_id': lesson.get('subject_id')}, {'$set': {'subject_id': after}})
        counts['changed'] += result.modified_count
    return counts


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mapping', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--undo', action='store_true')
    args = parser.parse_args()
    if not args.undo and not args.mapping: parser.error('Cần --mapping hoặc --undo')
    mapping = json.loads(args.mapping.read_text()) if args.mapping else {}
    print(json.dumps(migrate(db.db, mapping, args.apply, args.undo), ensure_ascii=False))
