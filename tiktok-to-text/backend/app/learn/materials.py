"""Học liệu bất biến, tải/phát có phiên và quyền kho (TK-16)."""
from __future__ import annotations
import hashlib
import ipaddress
from pathlib import Path
from uuid import uuid4
from urllib.parse import urlsplit
from typing import Literal
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict
from .. import db, policy, config
from ..auth import current_user
from .routes import oid, plain, target_space, require_author

router = APIRouter(prefix='/api/learn')
assets = db.db['learning_assets']
EXTS = {'.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
        '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.pdf': 'application/pdf', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.vtt': 'text/vtt'}
MAX_BYTES = 50 * 1024 * 1024


def public_url(value):
    if not value: return value
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Liên kết học liệu phải dùng HTTPS')
    host = parsed.hostname.lower()
    if host == 'localhost' or '.' not in host or host.endswith(('.local', '.internal')):
        raise ValueError('Không dùng địa chỉ nội bộ trong liên kết học liệu')
    try:
        if not ipaddress.ip_address(host).is_global: raise ValueError('Không dùng địa chỉ IP nội bộ')
    except ValueError as e:
        if 'địa chỉ' in str(e): raise
    return value


class Material(BaseModel):
    model_config = ConfigDict(extra='forbid')
    title: str = Field(min_length=1, max_length=200)
    kind: Literal['video', 'slides', 'card', 'podcast', 'talk_video', 'talk_audio']
    source: Literal['link', 'file', 'repository'] = 'link'
    url: str | None = Field(None, max_length=2000)
    asset_id: str | None = None
    card_id: str | None = None
    rev: int | None = None
    required: bool = True
    transcript: str = Field('', max_length=50000)
    subtitle_id: str | None = None
    classification: Literal['C0', 'C1', 'C2', 'C3'] = 'C0'


def load_asset(value, user):
    doc = assets.find_one({'_id': oid(value)} | policy.visible_filter(user, 'lesson'))
    if not doc: raise HTTPException(404, 'Không tìm thấy học liệu / không có quyền xem')
    return doc


def validate_materials(values, user):
    out = []
    for item in values:
        m = Material.model_validate(item).model_dump()
        if m['kind'] == 'card':
            from .routes import pin_cards
            pins, cards = pin_cards(user, [oid(m['card_id'])], {oid(m['card_id']): m['rev']} if m['rev'] else None)
            if m['rev'] and m['rev'] != (cards[0].get('current_revision') or 1):
                from .routes import card_revisions
                if not card_revisions.find_one({'card_id': pins[0]['card_id'], 'rev': m['rev']}):
                    raise HTTPException(400, 'Phiên bản thẻ không tồn tại')
            m |= {'card_id': pins[0]['card_id'], 'rev': pins[0]['rev'], 'classification': policy.effective_classification(cards[0]), 'source': 'repository', 'url': None}
            out.append(m); continue
        if m['source'] == 'link':
            try: public_url(m['url'])
            except ValueError as e: raise HTTPException(400, str(e)) from None
            if not m['url']: raise HTTPException(400, 'Học liệu cần liên kết')
        else:
            asset = load_asset(m['asset_id'], user)
            ext = Path(asset['filename']).suffix.lower()
            allowed = { 'video': {'.mp4', '.webm'}, 'talk_video': {'.mp4', '.webm'},
                        'slides': {'.pdf', '.pptx'}, 'podcast': {'.mp3', '.m4a', '.ogg', '.wav'},
                        'talk_audio': {'.mp3', '.m4a', '.ogg', '.wav'}}
            if ext not in allowed[m['kind']]: raise HTTPException(400, 'Định dạng tệp không đúng loại học liệu')
            m['asset_id'] = asset['_id']; m['sha256'] = asset['sha256']
            m['classification'] = policy.inherit_classification([m, asset])
            m['url'] = None
        if m['subtitle_id']:
            sub = load_asset(m['subtitle_id'], user)
            if not sub['filename'].lower().endswith('.vtt'): raise HTTPException(400, 'Phụ đề cần tệp VTT')
            m['subtitle_id'] = sub['_id']
            m['classification'] = policy.inherit_classification([m, sub])
        out.append(m)
    return out


@router.get('/assets')
def list_assets(user: dict = Depends(current_user)):
    require_author(user)
    return {'items': [plain({k: v for k, v in x.items() if k != 'path'}) | {'id': str(x['_id'])}
                      for x in assets.find(policy.visible_filter(user, 'lesson')).sort('created_at', -1).limit(200)]}


@router.post('/assets', status_code=201)
async def upload_asset(file: UploadFile = File(...), space_id: str | None = Form(None),
                       classification: str = Form('C0'), user: dict = Depends(current_user)):
    space = target_space(user, space_id)
    ext = Path(file.filename or '').suffix.lower()
    if ext not in EXTS or classification not in ('C0', 'C1', 'C2', 'C3'):
        raise HTTPException(400, 'Định dạng hoặc mức mật không hợp lệ')
    root = config.RAW_DIR / 'learning'; root.mkdir(parents=True, exist_ok=True)
    path = root / (uuid4().hex + ext)
    size = 0; checksum = hashlib.sha256()
    try:
        with path.open('wb') as target:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES: raise HTTPException(413, 'Tệp tối đa 50 MB')
                checksum.update(chunk); target.write(chunk)
        if not size: raise HTTPException(400, 'Tệp rỗng')
        with path.open('rb') as handle:
            header = handle.read(32)
        valid = {'.pdf': header.startswith(b'%PDF'), '.pptx': header.startswith(b'PK'),
                 '.mp3': header.startswith(b'ID3') or header[:1] == b'\xff', '.m4a': b'ftyp' in header,
                 '.mp4': b'ftyp' in header, '.webm': header.startswith(b'\x1aE\xdf\xa3'),
                 '.ogg': header.startswith(b'OggS'), '.wav': header.startswith(b'RIFF'),
                 '.vtt': header.lstrip(b'\xef\xbb\xbf').startswith(b'WEBVTT')}[ext]
        if not valid: raise HTTPException(400, 'Nội dung tệp không khớp định dạng')
        doc = {'filename': Path(file.filename).name, 'path': str(path), 'media_type': EXTS[ext],
               'size': size, 'sha256': checksum.hexdigest(), 'space_id': space['_id'],
               'classification': classification, 'created_by': user['_id'], 'created_at': db.now()}
        doc['_id'] = assets.insert_one(doc).inserted_id
    except BaseException:
        path.unlink(missing_ok=True); raise
    finally: await file.close()
    return {'id': str(doc['_id']), 'filename': doc['filename'], 'sha256': doc['sha256']}


@router.get('/assets/{asset_id}/content')
def content(asset_id: str, user: dict = Depends(current_user)):
    asset = load_asset(asset_id, user)
    path = Path(asset['path'])
    if not path.is_file(): raise HTTPException(404, 'Tệp không còn trên máy chủ')
    return FileResponse(path, media_type=asset['media_type'], filename=asset['filename'],
                        content_disposition_type='inline' if path.suffix != '.pptx' else 'attachment',
                        headers={'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store'})


def materials_out(values, user):
    out = []
    for raw in values:
        m = plain(raw)
        try:
            if m['kind'] == 'card':
                from .routes import visible_card_ids
                if oid(m['card_id']) not in visible_card_ids(user, [oid(m['card_id'])]):
                    raise HTTPException(404, 'Không có quyền xem thẻ')
            if m.get('asset_id'):
                load_asset(m['asset_id'], user)
                m['url'] = f"/api/learn/assets/{m['asset_id']}/content"
            if m.get('subtitle_id'):
                load_asset(m['subtitle_id'], user)
                m['subtitle_url'] = f"/api/learn/assets/{m['subtitle_id']}/content"
            out.append(m)
        except HTTPException:
            out.append({'title': m['title'], 'unavailable': True, 'required': m['required']})
    return out
