// Các khối trong ngăn kéo chi tiết nguồn (SCR-03): ghi chú của người nạp (WK-44), ghi chép cả nguồn / từng tài liệu
// (WK-45, SCR-03.1 / 03.2 — giữ nguyên hành vi), tổng hợp theo chủ đề, tag các thẻ tinh chế ra, chữ của tài liệu.
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { dateTime, num } from '../../format'
import { ErrorBox } from '../../components/ui'
import { Icon } from '../../components/icons'
import { StatusBadge } from '../../components/StatusBadge'
import { toast } from '../../components/toast'
import { NoteForm, NoteList } from '../../components/kbNotes'
import { TranscriptSync } from '../../components/videoEmbed'
import { NoteField } from './AddSource'

// Ghi chú trên nguồn: người sửa được nguồn thì sửa + lưu; người chỉ xem thấy nội dung. Bản nháp không bị ghi đè khi
// ngăn kéo tự làm mới (3 giây / lần lúc đang xử lý).
export function SourceNote({ s, onSaved }) {
  const saved = s.note || ''
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false)
  const dirty = draft !== saved
  const last = useRef(saved)
  useEffect(() => {   // chưa sửa gì thì theo bản đã lưu mới nhất; đang sửa dở thì giữ bản nháp
    setDraft((d) => (d === last.current ? saved : d))
    last.current = saved
  }, [saved])
  if (!s.can_edit) {
    return saved ? (
      <div className="source-note" data-testid="kb-source-note">
        <h3>Ghi chú của người nạp</h3>
        <p className="pre-wrap">{saved}</p>
      </div>
    ) : null
  }
  const save = async () => {
    setBusy(true)
    try {
      const r = await api.setSourceNote(s.id, draft)
      setDraft(r.note)
      last.current = r.note
      toast(r.note ? 'Đã lưu ghi chú — dùng cho lần dựng thẻ sau' : 'Đã xoá ghi chú')
      onSaved()
    } catch (e) {
      toast(e.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="source-note">
      <NoteField value={draft} onChange={setDraft} testId="kb-source-note" disabled={busy} />
      <div className="row">
        <button type="button" className="ui-btn ui-btn-sm" disabled={busy || !dirty} onClick={save} data-testid="kb-source-note-save">
          {busy ? 'Đang lưu…' : 'Lưu ghi chú'}
        </button>
        {dirty && <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" disabled={busy} onClick={() => setDraft(saved)}>Huỷ sửa</button>}
      </div>
    </div>
  )
}

// Ghi chép trên nguồn (WK-45): mọi ghi chép cả nguồn + từng tài liệu, lọc nhanh, ô thêm ghi chép cho cả nguồn.
// Ai xem được nguồn thì ghi được (s.can_note); sửa / xoá theo từng ghi chép (can_edit: tác giả hoặc chủ kho).
export function SourceNotes({ s, focusDoc, onChanged }) {
  const headId = useId()
  const notes = s.notes || []
  const docTitle = focusDoc && s.documents.find((d) => d.id === focusDoc)?.title
  const [scope, setScope] = useState(docTitle ? 'doc' : 'all')
  const shown = scope === 'source' ? notes.filter((n) => !n.doc_id)
    : scope === 'doc' ? notes.filter((n) => n.doc_id === focusDoc) : notes
  return (
    <section className="source-notes" aria-labelledby={headId} data-testid="kb-source-notes">
      <div className="section-head">
        <h3 id={headId}>Ghi chép ({notes.length})</h3>
        <Link className="link small" to={`/kb/notes?source_id=${s.id}`}>Xem ở màn Ghi chép</Link>
      </div>
      {notes.length > 0 && (
        <label className="small">
          Hiện{' '}
          <select value={scope} onChange={(e) => setScope(e.target.value)} data-testid="kb-source-notes-scope">
            <option value="all">Tất cả ({notes.length})</option>
            <option value="source">Chỉ ghi chép cả nguồn ({notes.filter((n) => !n.doc_id).length})</option>
            {docTitle && <option value="doc">Tài liệu này: {docTitle.slice(0, 40)} ({notes.filter((n) => n.doc_id === focusDoc).length})</option>}
          </select>
        </label>
      )}
      <NoteList items={shown} onChanged={onChanged}
        empty={<p className="muted small">{notes.length ? 'Không có ghi chép nào trong phần đang lọc.' : 'Chưa có ghi chép. Ghi lại điều muốn nhớ về cả nguồn ở ô dưới, hoặc bấm «Ghi chép» ở từng tài liệu.'}</p>} />
      {s.can_note && <NoteForm sourceId={s.id} label="Ghi chép cho cả nguồn" onSaved={onChanged} />}
    </section>
  )
}

// Ghi chép của một tài liệu (một video, một file) — mở từ nút «Ghi chép (n)» trên dòng tài liệu.
// watch (SCR-03.2): đang xem video của tài liệu -> khung nằm cạnh video, ô ghi ở trên (mốc bật sẵn), danh sách dưới,
// bấm ▶ mm:ss tua player tại chỗ.
export function DocNotes({ s, d, sync, onChanged, watch = false }) {
  const items = (s.notes || []).filter((n) => n.doc_id === d.id)
  const list = (
    <NoteList items={items} onChanged={onChanged} showDoc={false} onSeek={watch && sync ? (t) => sync.seek(t) : null}
      empty={<p className="muted small">{watch ? 'Chưa có ghi chép cho video này — gõ ở ô trên trong lúc xem.' : 'Chưa có ghi chép cho tài liệu này.'}</p>} />
  )
  const form = s.can_note && (
    // autoFocus: khung mở do người dùng bấm «Ghi chép (n)» — đưa con trỏ vào ô ghi ngay (SCR-03.1)
    <NoteForm sourceId={s.id} docId={d.id} sync={sync} label={watch ? `Ghi chép khi xem (${items.length})` : `Ghi chép cho: ${d.title}`}
      // eslint-disable-next-line jsx-a11y/no-autofocus
      onSaved={onChanged} autoFocus={!watch} watch={watch} />
  )
  return (
    <div className={`doc-notes${watch ? ' doc-notes-watch' : ''}`} data-testid="kb-doc-notes-panel" data-id={d.id}>
      {watch ? <>{form}{list}</> : <>{list}{form}</>}
    </div>
  )
}

// sync: video của tài liệu đang mở -> hiện chữ theo câu có mốc thời gian (nếu có segments), bấm câu để tua
export function DocText({ id, sync = null }) {
  const { data } = useFetch(() => (sync ? api.documentSegments(id) : api.document(id)), [id, !!sync])
  if (sync && data?.segments?.length) return <TranscriptSync segments={data.segments} sync={sync} />
  return <pre className="doc-text">{data ? data.text || '(trống)' : 'Đang tải…'}</pre>
}

// Tổng hợp theo cụm chủ đề — hợp với kênh video / nguồn nhiều tài liệu ngắn, lặp ý
const SYNTH_ACTIVE = ['queued', 'triaging', 'clustering', 'planned', 'synthesizing']

export function SynthPanel({ s }) {
  const navigate = useNavigate()
  const { data: runs } = useFetch(() => api.sourceSynthRuns(s.id), [s.id, s.overall])
  const [external, setExternal] = useState(['video', 'web'].includes(s.kind))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const headId = useId()
  const waiting = s.docs.skipped + s.docs.pending + s.docs.error
  const active = runs?.find((r) => SYNTH_ACTIVE.includes(r.status))
  if (!runs || (!runs.length && (waiting < 2 || !s.can_edit))) return null

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.startSynth(s.id, { external })
      navigate(`/wiki/synth/${r.id}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <section className="synth-box" aria-labelledby={headId}>
      <div className="section-head kb-flush">
        <h3 id={headId} className="kb-flush"><Icon name="sparkles" size={16} /> Tổng hợp theo chủ đề</h3>
        {active ? (
          <Link className="ui-btn ui-btn-sm" to={`/wiki/synth/${active.id}`}>
            {active.status === 'planned' ? 'Duyệt kế hoạch' : 'Xem tiến độ'}
          </Link>
        ) : s.can_edit && waiting >= 2 && (
          <button type="button" className="ui-btn ui-btn-sm" disabled={busy || ['queued', 'extracting'].includes(s.status)} onClick={start}>
            <Icon name="sparkles" size={16} />{busy ? 'Đang tạo…' : `Tổng hợp ${num(waiting)} tài liệu`}
          </button>
        )}
      </div>
      {!active && s.can_edit && waiting >= 2 && (
        <>
          <p className="small muted">
            AI sàng lọc từng tài liệu, gom các tài liệu cùng ý thành cụm, bạn duyệt kế hoạch rồi AI viết mỗi cụm 1–3 thẻ dẫn nhiều nguồn.
            Nên dùng thay cho "Dựng thẻ từng tài liệu" khi nguồn có nhiều video ngắn nói lặp ý.
          </p>
          <label className="small inline">
            <input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} /> Nội dung của bên ngoài
            (gắn tag <span className="tag">#nguon-ben-ngoai</span>)
          </label>
        </>
      )}
      <ErrorBox>{error}</ErrorBox>
      {runs.length > 0 && (
        <ul className="synth-runs">
          {runs.map((r) => (
            <li key={r.id} data-id={r.id} data-status={r.status}>
              <StatusBadge kind="synth" status={r.status} />
              <Link className="link" to={`/wiki/synth/${r.id}`}>{dateTime(r.created_at)}</Link>
              <span className="muted">
                {r.doc_count} tài liệu{r.cluster_count ? ` · ${r.cluster_count} cụm` : ''}{r.card_count ? ` · ${r.card_count} thẻ` : ''} · {r.created_by_name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Tag các thẻ VCWIKI tinh chế từ nguồn — bấm để xem thẻ mang tag đó (trong phạm vi nguồn)
export function RefinedTags({ s }) {
  const tags = s.refined_tags || []
  if (!s.card_count && !s.docs.done) return <p className="muted">Nguồn này chưa tinh chế ra thẻ VCWIKI nào.</p>
  return (
    <div className="refined">
      <div className="section-head">
        <h3>Tinh chế ra ({num(s.card_count)} thẻ, {num(tags.length)} tag)</h3>
        {s.card_count > 0 && <Link className="ui-btn ui-btn-sm" to={`/wiki?source_id=${s.id}`}>Xem tất cả thẻ</Link>}
      </div>
      {tags.length > 0 ? (
        <div className="refined-tags">
          {tags.map((t) => (
            <Link key={t.tag} className="refined-tag" to={`/wiki?source_id=${s.id}&tag=${encodeURIComponent(t.tag)}`}
              title={`Xem ${t.cards} thẻ mang tag #${t.tag}`}>
              #{t.tag}<span>{num(t.cards)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted small">
          {s.card_count ? 'Các thẻ từ nguồn này chưa có tag.' : 'Đã tinh chế nhưng AI không rút ra thẻ nào — nội dung có thể không đủ giá trị.'}
        </p>
      )}
    </div>
  )
}
