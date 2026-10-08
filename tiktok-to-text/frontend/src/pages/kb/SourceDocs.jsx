// Tab «Tài liệu» của ngăn kéo chi tiết nguồn (SCR-03, ?stab=docs): từng tài liệu (chữ, tag, ghi chép, xem video song
// song — SCR-03.2), chọn video để lấy lại chữ (Shift chọn dải), video lỗi của kênh, hộp xác nhận lấy lại chữ.
import { useId, useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { engineLabel, num, totalTime } from '../../format'
import { ErrorBox } from '../../components/ui'
import { Modal } from '../../components/Overlay'
import { StatusBadge } from '../../components/StatusBadge'
import { CategoryChips, TagEditor } from '../../components/pickers'
import { canEmbed } from '../../videoEmbed'
import { VideoEmbed } from '../../components/videoEmbed'
import { FailLog, FailTimes } from './shared'
import { DocNotes, DocText } from './SourcePanels'

const FEW_CHARS = 50   // "Ít chữ": lời nói dưới mức này (Whisper ra rỗng / sai ngôn ngữ)

// v: { videoDoc, setVideoDoc, openDoc, setOpenDoc, syncOf, head, docVideo } — trạng thái video / chữ đang mở do SourceDetail giữ
export default function SourceDocs({ s, cats, docId, v, act, reload, onRedoQueued }) {
  const [picked, setPicked] = useState(() => new Set())   // chọn video để lấy lại chữ: id tài liệu / 'v:<id video lỗi>'
  const [lastPick, setLastPick] = useState(null)
  const [redoOpen, setRedoOpen] = useState(null)          // danh sách mục đưa vào hộp xác nhận
  const [onlyFailed, setOnlyFailed] = useState(false)     // chỉ hiện video lỗi (ẩn tài liệu đã có chữ)
  const [notesDoc, setNotesDoc] = useState(null)          // tài liệu đang mở khung ghi chép (WK-45)
  const { videoDoc, setVideoDoc, openDoc, setOpenDoc, syncOf, head, docVideo } = v
  const { data: tagList } = useFetch(() => api.kbTags({ limit: 300 }), [])

  // danh sách chọn được: tài liệu video + video lỗi chưa có tài liệu
  const canRedo = s.can_edit && s.kind === 'video'
  const rows = canRedo ? [
    ...s.documents.filter((d) => d.url).map((d) => ({ id: d.id, key: d.key, title: d.title, chars: d.speech_chars, edited: d.edited, duration: d.meta?.duration })),
    ...(s.failed_videos || []).map((x) => ({ id: `v:${x.key}`, key: x.key, title: x.title, failed: true })),
  ] : []
  const pick = (id, e) => {
    const next = new Set(picked)
    const on = !next.has(id)
    const i = rows.findIndex((r) => r.id === id)
    const j = rows.findIndex((r) => r.id === lastPick)
    const range = e?.shiftKey && j >= 0 ? rows.slice(Math.min(i, j), Math.max(i, j) + 1) : [rows[i]]
    range.forEach((r) => (on ? next.add(r.id) : next.delete(r.id)))
    setPicked(next)
    setLastPick(id)
  }
  const pickWhere = (fn) => setPicked(new Set(rows.filter(fn).map((r) => r.id)))
  const redoState = (key) => s.redo?.keys?.[key]
  const few = rows.filter((r) => !r.failed && r.chars != null && r.chars < FEW_CHARS).length
  const failedN = rows.filter((r) => r.failed).length

  return (
    <div className="kb-docs">
      <div className="section-head">
        <h3>Tài liệu ({s.documents.length})</h3>
        {s.can_edit && s.docs.skipped > 0 && (
          <button type="button" className="ui-btn ui-btn-sm" title="AI dựng thẻ riêng cho từng tài liệu"
            onClick={() => act(() => api.buildWiki(s.id))}>Dựng thẻ từng tài liệu ({s.docs.skipped})</button>
        )}
      </div>
      {s.redo && (
        <div className="redo-bar" role="status">
          <span className="grow">
            Lấy lại chữ: <b>{s.redo.done}/{s.redo.total}</b> xong
            {s.redo.failed > 0 && <span className="tone-bad"> · {s.redo.failed} lỗi</span>}
            {s.redo.running > 0 && ' · đang chạy 1'}{s.redo.queued > 0 && ` · ${s.redo.queued} chờ`}
          </span>
          {s.can_edit && s.redo.queued > 0 && (
            <button type="button" className="ui-btn ui-btn-sm" onClick={() => act(() => api.cancelRetranscribe(s.id))}>Ngừng lấy lại chữ</button>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <div className="pick-bar small">
          <span className="muted">Chọn để lấy lại chữ:</span>
          <button type="button" className="link" onClick={() => pickWhere(() => true)}>Tất cả ({rows.length})</button>
          <button type="button" className="link" title={`Lời nói dưới ${FEW_CHARS} ký tự`}
            onClick={() => pickWhere((r) => !r.failed && r.chars != null && r.chars < FEW_CHARS)}>Ít chữ ({few})</button>
          {failedN > 0 && <button type="button" className="link" onClick={() => pickWhere((r) => r.failed)}>Lỗi ({failedN})</button>}
          {picked.size > 0 && <button type="button" className="link" onClick={() => setPicked(new Set())}>Bỏ chọn</button>}
          {failedN > 0 && (
            <label className="nowrap"><input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> Chỉ hiện video lỗi</label>
          )}
        </div>
      )}
      <datalist id="kb-tag-list">{(tagList || []).map((t) => <option key={t.tag} value={t.tag} />)}</datalist>
      {!(onlyFailed && canRedo) && s.documents.map((d) => {
        const vid = docVideo(d)
        const synced = head?.doc?.id === d.id || videoDoc === d.id
        const watching = videoDoc === d.id && canEmbed(vid)   // SCR-03.2: video phải, ghi chép + chữ trái
        return (
          <div key={d.id} id={`doc-${d.id}`} data-testid={watching ? 'kb-watch' : undefined} data-id={d.id} data-status={d.wiki_status}
            className={`doc-row${d.id === docId ? ' doc-row-target' : ''}${watching ? ' doc-row-watch' : ''}`}>
            {canRedo && d.url && (
              <input type="checkbox" className="doc-pick" checked={picked.has(d.id)} aria-label={`Chọn ${d.title}`}
                onChange={() => {}} onClick={(e) => pick(d.id, e)} />
            )}
            <div className="grow">
              <div className="strong clamp-1">{d.title}</div>
              <div className="muted small">
                {num(d.chars)} ký tự
                {d.text_engine && ` · chuyển chữ bằng ${engineLabel(d.text_engine)}`}
                {d.relevance != null && ` · hữu ích ${d.relevance}/10`}
                {d.card_count != null && ` · ${d.card_count} thẻ`}
              </div>
              {redoState(d.key) && <span className="ui-badge" data-tone="warn">{redoState(d.key) === 'running' ? 'Đang lấy lại chữ…' : 'Chờ lấy lại chữ'}</span>}
              {d.card_update === 'waiting' && (
                <span className="ui-badge" data-tone="info" title="Nội dung đã đổi — thẻ VCWIKI được cập nhật trong lượt hằng ngày (mặc định 07:45, sau job vector đêm) (bấm Ưu tiên để làm ngay)">
                  Chờ cập nhật thẻ (lượt hằng ngày)
                </span>
              )}
              {d.summary && <div className="small">{d.summary}</div>}
              {d.wiki_error && <div className="tone-bad small">{d.wiki_error}</div>}
              <CategoryChips cats={cats} value={d.categories} />
              <TagEditor value={d.tags} inherited={d.card_tags} canEdit={s.can_edit}
                onChange={(tags) => act(() => api.setDocumentTags(d.id, tags))} />
              {watching && <DocNotes s={s} d={d} sync={syncOf(d.id)} onChanged={reload} watch />}
              {watching && openDoc === d.id && <DocText id={d.id} sync={syncOf(d.id)} />}
            </div>
            <div className="doc-actions">
              <StatusBadge kind="doc" status={d.wiki_status} />
              <button type="button" className="link small" aria-expanded={openDoc === d.id} aria-label={`${openDoc === d.id ? 'Ẩn chữ' : 'Xem chữ'}: ${d.title}`}
                onClick={() => setOpenDoc(openDoc === d.id ? null : d.id)}>
                {openDoc === d.id ? 'Ẩn chữ' : 'Xem chữ'}
              </button>
              {!watching && (
                <button type="button" className="link small" aria-expanded={notesDoc === d.id} data-testid="kb-doc-notes"
                  aria-label={`Ghi chép của tài liệu: ${d.title} (${d.note_count || 0})`}
                  onClick={() => setNotesDoc(notesDoc === d.id ? null : d.id)}>
                  Ghi chép ({d.note_count || 0})
                </button>
              )}
              {canEmbed(vid) && (
                <button type="button" className="link small" aria-expanded={videoDoc === d.id}
                  onClick={() => { const on = videoDoc !== d.id; setVideoDoc(on ? d.id : null); if (on) setOpenDoc(d.id) }}>
                  {videoDoc === d.id ? 'Ẩn video' : 'Xem video'}
                </button>
              )}
              {s.can_edit && ['done', 'error', 'skipped'].includes(d.wiki_status) && (
                <button type="button" className="link small" onClick={() => act(() => api.rebuildDocument(d.id))}
                  aria-label={`${d.wiki_status === 'skipped' ? 'Dựng thẻ' : 'Dựng lại thẻ'}: ${d.title}`}>
                  {d.wiki_status === 'skipped' ? 'Dựng thẻ' : 'Dựng lại'}
                </button>
              )}
            </div>
            {watching && (
              <div className="watch-video">
                <VideoEmbed key={d.id} video={vid} url={d.url} meta={d.meta} title={d.title} sync={syncOf(d.id)} autoStart />
              </div>
            )}
            {!watching && notesDoc === d.id && <DocNotes s={s} d={d} sync={synced ? syncOf(d.id) : null} onChanged={reload} />}
            {!watching && openDoc === d.id && <DocText id={d.id} sync={synced ? syncOf(d.id) : null} />}
          </div>
        )
      })}
      {canRedo && (s.failed_videos || []).map((x) => (
        <div key={x.key} className="doc-row doc-row-failed" data-id={x.key} data-status="error">
          <input type="checkbox" className="doc-pick" checked={picked.has(`v:${x.key}`)} aria-label={`Chọn ${x.title}`}
            onChange={() => {}} onClick={(e) => pick(`v:${x.key}`, e)} />
          <div className="grow">
            <div className="strong clamp-1">{x.title}</div>
            <div className="meta"><span className="ui-badge">{x.error_label}</span> <FailTimes v={x} max={s.max_auto_retry || 3} /></div>
            <div className="tone-bad small clamp-2">Lỗi: {x.error}</div>
            <FailLog log={x.fail_log} />
            {redoState(x.key) && <span className="ui-badge" data-tone="warn">{redoState(x.key) === 'running' ? 'Đang lấy lại chữ…' : 'Chờ lấy lại chữ'}</span>}
          </div>
          {x.url && <a className="link small" href={x.url} target="_blank" rel="noreferrer" aria-label={`Mở video (tab mới): ${x.title}`}>Mở video ↗</a>}
        </div>
      ))}
      {picked.size > 0 && (
        <div className="pick-action" role="status">
          <span className="grow">Đã chọn <b>{picked.size}</b> video</span>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setRedoOpen(rows.filter((r) => picked.has(r.id)))}>Lấy lại chữ</button>
        </div>
      )}
      {redoOpen && (
        <RedoDialog s={s} items={redoOpen} onClose={() => setRedoOpen(null)}
          onDone={() => { setRedoOpen(null); setPicked(new Set()); onRedoQueued() }} />
      )}
    </div>
  )
}

// Xác nhận lấy lại chữ các video đã chọn: ngôn ngữ (gợi ý theo caption), cảnh báo lời nói đã sửa tay
function RedoDialog({ s, items, onClose, onDone }) {
  const { data: status } = useFetch(api.kbStatus, [])
  const current = s.options?.language || 'auto'
  const hint = s.language_hint
  const [language, setLanguage] = useState(hint?.differs ? hint.language : current)
  const [saveLang, setSaveLang] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const langId = useId()
  const list = items
  const edited = list.filter((r) => r.edited).length
  const secs = list.reduce((t, r) => t + (r.duration || 0), 0)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.retranscribeVideos(s.id, {
        document_ids: list.filter((r) => !r.failed).map((r) => r.id),
        video_ids: list.filter((r) => r.failed).map((r) => r.key),
        language: language === current ? null : language,
        save_language: language !== current && saveLang,
      })
      setBusy(false)
      onDone()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal open title={`Lấy lại chữ ${list.length} video`} onClose={onClose} testId="kb-redo-dialog"
      footer={(
        <>
          <button type="button" className="ui-btn" onClick={onClose}>Huỷ</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={submit}>{busy ? 'Đang xếp…' : 'Lấy lại chữ'}</button>
        </>
      )}>
      <p className="muted small">
        Tải và chuyển chữ lại lần lượt từng video, ghi đè bản chữ hiện có. Chạy ở làn riêng — không chờ kênh khác đang chuyển chữ.
        {secs > 0 && ` Tổng thời lượng khoảng ${totalTime(secs)}.`}
      </p>
      <div className="field">
        <label htmlFor={langId}>Ngôn ngữ lời nói</label>
        <select id={langId} value={language} onChange={(e) => setLanguage(e.target.value)}>
          {(status?.languages || [{ value: current, label: current }]).map((l) => (
            <option key={l.value} value={l.value}>{l.label}{l.value === current ? ' — đang dùng' : ''}</option>
          ))}
        </select>
        {hint && <small>Gợi ý: <b>{hint.label}</b> — {hint.reason}</small>}
      </div>
      {language !== current && (
        <label className="check">
          <input type="checkbox" checked={saveLang} onChange={(e) => setSaveLang(e.target.checked)} />
          Dùng ngôn ngữ này cho cả nguồn (các lần quét sau)
        </label>
      )}
      {edited > 0 && <p className="tone-warn small">{edited} video có lời nói đã sửa tay — bản sửa sẽ bị ghi đè.</p>}
      <ErrorBox>{error}</ErrorBox>
    </Modal>
  )
}
