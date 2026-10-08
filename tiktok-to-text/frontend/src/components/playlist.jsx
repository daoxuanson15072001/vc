// Nội dung đọc của một thẻ VCWIKI (dùng ở khung thẻ và trình phát danh sách) + nút thêm thẻ vào danh sách phát.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { SOURCE_KIND } from '../format'
import { ErrorBox, Loading } from './ui'
import { Markdown, inline } from './markdown'
import { SourceLink, useSourcePeek } from './sourcePeek'
import { Icon } from './icons'
import { Modal } from './Overlay'

// Chữ của thẻ có thể chứa link — link trùng tài liệu đã nạp thì mở modal nguồn
const cardText = (c) => [c.body, ...(c.key_points || []), c.when_to_use, c.example, ...Object.values(c.fields || {})].join('\n')

export function CardContent({ card }) {
  const { onClick, open: setPeek, modal } = useSourcePeek(cardText(card))
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- ủy quyền bấm cho các <a> bên trong (Enter trên link cũng sinh click)
    <div className="card-content" onClick={onClick}>
      {card.summary && <p className="lead">{card.summary}</p>}
      {card.body && <Markdown className="card-body" text={card.body} />}
      {card.key_points?.length > 0 && (<><h3>Ý chính</h3><ul>{card.key_points.map((k, i) => <li key={i}>{inline(k)}</li>)}</ul></>)}
      {card.when_to_use && (<><h3>Khi nào dùng</h3><p>{inline(card.when_to_use)}</p></>)}
      {card.example && (<><h3>Ví dụ</h3><p>{inline(card.example)}</p></>)}
      {card.evidence && (<><h3>Căn cứ</h3><blockquote>{card.evidence}</blockquote></>)}
      {card.fields && Object.keys(card.fields).length > 0 && (
        <dl className="card-fields">
          {Object.entries(card.fields).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{inline(v)}</dd></div>)}
        </dl>
      )}
      {card.tags?.length > 0 && <div className="meta">{card.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>}
      {card.sources?.length > 0 && (
        <>
          <h3>Tổng hợp từ {card.sources.length} tài liệu</h3>
          <ul className="card-sources">
            {card.sources.map((s) => (
              <li key={s.document_id}>
                <SourceLink sourceId={card.source_id} docId={s.document_id} onOpen={setPeek}>{s.title}</SourceLink>
                {s.url && <> · <a className="link small" href={s.url} target="_blank" rel="noreferrer">link gốc ↗</a></>}
                {s.timestamp && <span className="muted"> {s.timestamp}</span>}
                {s.quote && <blockquote>{s.quote}</blockquote>}
              </li>
            ))}
          </ul>
        </>
      )}
      {card.source && !card.sources?.length && (
        <>
          <h3>Nguồn</h3>
          <p className="small">
            {SOURCE_KIND[card.source.kind]?.icon}{' '}
            {card.source_deleted ? card.source.title
              : <SourceLink sourceId={card.source_id} docId={card.document_id} onOpen={setPeek}>{card.source.title}</SourceLink>}
            {card.source.url && <> · <a className="link" href={card.source.url} target="_blank" rel="noreferrer">link gốc ↗</a></>}
            {card.source_deleted && <span className="muted"> (nguồn đã xoá)</span>}
          </p>
        </>
      )}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Esc trong popup nguồn không được lan lên popup thẻ */}
      <div onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation() }}>{modal}</div>
    </div>
  )
}

// Nút "+ Danh sách phát": mở Modal bật / tắt thẻ trong từng danh sách của tôi, hoặc tạo danh sách mới có sẵn thẻ này
export function AddToPlaylist({ cardId }) {
  const [open, setOpen] = useState(false)
  const [lists, setLists] = useState(null)
  const [name, setName] = useState('')
  const [err, setErr] = useState(null)

  const load = async () => {
    try { setLists(await api.playlists({ scope: 'mine', card_id: cardId })) } catch (e) { setErr(e.message) }
  }
  const show = () => { load(); setOpen(true); setErr(null) }

  // đổi ngay trên màn hình, gọi API sau; lỗi thì trả lại như cũ
  const flip = async (p) => {
    setErr(null)
    const set = (has) => setLists((ls) => ls.map((x) => (x.id === p.id ? { ...x, has_card: has, count: p.count + (has === p.has_card ? 0 : has ? 1 : -1) } : x)))
    set(!p.has_card)
    try {
      if (p.has_card) await api.removeFromPlaylist(p.id, cardId)
      else await api.addToPlaylist(p.id, cardId)
    } catch (e) {
      set(p.has_card)
      setErr(e.message)
    }
  }

  const create = async (e) => {
    e.preventDefault()
    setErr(null)
    try {
      await api.createPlaylist({ name: name.trim(), card_ids: [cardId] })
      setName('')
      load()
    } catch (e2) { setErr(e2.message) }
  }

  return (
    <>
      <button type="button" className="ui-btn ui-btn-sm" onClick={show} aria-haspopup="dialog" title="Thêm vào danh sách phát"
        aria-label="Danh sách phát: thêm / bỏ thẻ này" data-testid="card-add-playlist">
        <Icon name="list-plus" size={16} />Danh sách phát
      </button>
      <Modal open={open} title="Thêm vào danh sách phát" onClose={() => setOpen(false)}
        footer={<button type="button" className="ui-btn ui-btn-primary" onClick={() => setOpen(false)}>Xong</button>}>
        {lists === null && !err && <Loading />}
        {lists?.length === 0 && <div className="muted small">Bạn chưa có danh sách nào — tạo ở dưới.</div>}
        {lists?.map((p) => (
          <label key={p.id} className="pl-add-row">
            <input type="checkbox" checked={p.has_card} onChange={() => flip(p)} />
            <span className="grow ellipsis">{p.name}</span>
            <span className="muted small">{p.visibility === 'public' ? '🌐' : '🔒'} {p.count}</span>
            <Link className="link small" to={`/playlists/${p.id}`} aria-label={`Mở danh sách ${p.name}`}>mở</Link>
          </label>
        ))}
        <form className="pl-add-new" onSubmit={create}>
          <input placeholder="Tên danh sách mới" aria-label="Tên danh sách mới" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          <button className="ui-btn ui-btn-primary" disabled={!name.trim()}>Tạo</button>
        </form>
        <ErrorBox>{err}</ErrorBox>
      </Modal>
    </>
  )
}
