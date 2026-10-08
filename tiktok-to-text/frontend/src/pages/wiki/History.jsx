// Tab Lịch sử của thẻ (GOV-01, GOV-07 — docs/BA.md mục 16.5): danh sách phiên bản · xem bản cũ · so sánh hai bản ·
// quay về bản cũ (tạo bản mới, không xoá lịch sử).
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { CARD_TYPE, dateTime } from '../../format'
import { Badge, Empty, ErrorBox, Loading } from '../../components/ui'
import { promptDialog } from '../../components/dialog'
import { CategoryChips } from '../../components/pickers'
import { CardContent } from '../../components/playlist'
import { DiffFields } from './Diff'

export function CardHistory({ card, cats, onRestored, onProposed }) {
  const { data, error, reload } = useFetch(() => api.cardRevisions(card.id), [card.id, card.current_revision])
  const [view, setView] = useState(null)      // { kind: 'rev', rev } | { kind: 'diff', from, to }
  const [pair, setPair] = useState({ from: '', to: '' })
  const [actionError, setActionError] = useState(null)
  const items = data?.items || []

  useEffect(() => {
    // mặc định so bản hiệu lực với bản ngay trước
    if (items.length >= 2) setPair({ from: String(items[1].rev), to: String(items[0].rev) })
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const restore = async (rev) => {
    const reason = await promptDialog({
      title: `Lý do quay về bản ${rev}?`, label: 'Lý do',
      body: `Bắt buộc — hệ thống tạo bản mới mang nội dung bản ${rev}, không xoá bản nào.`, okLabel: `Quay về bản ${rev}`,
    })
    if (!reason?.trim()) return
    setActionError(null)
    try {
      const res = await api.rollbackCard(card.id, rev, reason.trim())
      setView(null)
      if (res.change) onProposed(res.change, `Đã tạo đề xuất quay về bản ${rev} — chờ chủ sở hữu lĩnh vực duyệt`)
      else { onRestored(res.card); reload() }
    } catch (e) { setActionError(e.message) }
  }

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <Loading />
  if (!items.length) return <Empty>Chưa có lịch sử phiên bản cho thẻ này.</Empty>

  return (
    <div className="tab-body revision-history">
      {data.has_unversioned_changes && (
        <p className="small muted">Nội dung hiện tại có chỉnh sửa trực tiếp chưa ghi thành phiên bản. Khi quay về bản cũ, nội dung đó được ghi lại thành một bản trước để không mất.</p>
      )}
      <ul className="list">
        {items.map((r) => (
          <li key={r.rev} className={`list-row revision-row ${view?.kind === 'rev' && view.rev === r.rev ? 'active' : ''}`}>
            <div className="revision-rev">
              <div className="strong">Bản {r.rev}</div>
              {r.current && <Badge tone="good">Hiệu lực</Badge>}
            </div>
            <div className="grow">
              <div>{r.reason}</div>
              <div className="meta">
                <span>{r.author_name || 'Không rõ'}</span>
                {r.approved_by_names?.length > 0 && <span>Duyệt: {r.approved_by_names.join(', ')}</span>}
                <span>{dateTime(r.created_at)}</span>
              </div>
            </div>
            <div className="revision-actions">
              <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" aria-label={`Xem bản ${r.rev}`} onClick={() => setView({ kind: 'rev', rev: r.rev })}>Xem</button>
              {data.can_rollback && (!r.current || data.has_unversioned_changes) && (
                <button type="button" className="ui-btn ui-btn-sm" aria-label={`Quay về bản ${r.rev}`} onClick={() => restore(r.rev)}>Quay về bản này</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {items.length >= 2 && (
        <div className="copy-row">
          <span className="small muted">So sánh bản</span>
          <select aria-label="Từ bản" value={pair.from} onChange={(e) => setPair({ ...pair, from: e.target.value })}>
            {items.map((r) => <option key={r.rev} value={r.rev}>{r.rev}</option>)}
          </select>
          <span className="small muted">với bản</span>
          <select aria-label="Đến bản" value={pair.to} onChange={(e) => setPair({ ...pair, to: e.target.value })}>
            {items.map((r) => <option key={r.rev} value={r.rev}>{r.rev}</option>)}
          </select>
          <button type="button" className="ui-btn ui-btn-sm" disabled={!pair.from || pair.from === pair.to}
            onClick={() => setView({ kind: 'diff', from: Number(pair.from), to: Number(pair.to) })}>So sánh</button>
        </div>
      )}
      <ErrorBox>{actionError}</ErrorBox>

      {view?.kind === 'rev' && <RevisionView cardId={card.id} rev={view.rev} cats={cats} onClose={() => setView(null)} />}
      {view?.kind === 'diff' && <RevisionDiff cardId={card.id} from={view.from} to={view.to} onClose={() => setView(null)} />}
    </div>
  )
}

function RevisionView({ cardId, rev, cats, onClose }) {
  const { data, error } = useFetch(() => api.cardRevision(cardId, rev), [cardId, rev])
  return (
    <section className="card revision-view" aria-label={`Nội dung bản ${rev}`}>
      <div className="revision-view-head">
        <h3>Bản {rev}{data ? ` — ${data.snapshot.title}` : ''}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng bản xem">✕</button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {data && (
        <>
          <div className="meta-line small muted">
            {CARD_TYPE[data.snapshot.type] || data.snapshot.type} · {data.author_name || 'Không rõ'} · {dateTime(data.created_at)}
          </div>
          <CategoryChips cats={cats} value={data.snapshot.categories} />
          <CardContent card={data.snapshot} />
        </>
      )}
    </section>
  )
}

function RevisionDiff({ cardId, from, to, onClose }) {
  const { data, error } = useFetch(() => api.cardDiff(cardId, from, to), [cardId, from, to])
  return (
    <section className="card revision-diff" aria-label={`So sánh bản ${from} với bản ${to}`}>
      <div className="revision-view-head">
        <h3>Bản {from} → bản {to}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng so sánh">✕</button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {data && data.changes.length === 0 && <p className="muted">Hai bản có nội dung giống nhau.</p>}
      {data && <DiffFields changes={data.changes} />}
    </section>
  )
}
