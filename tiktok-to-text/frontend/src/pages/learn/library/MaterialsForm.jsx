import { useState } from 'react'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { ErrorBox } from '../../../components/ui'

const TYPES = { card: 'Thẻ VCWIKI', video: 'Video', slides: 'Slide / trình chiếu', podcast: 'Podcast', talk_video: 'Talk show video', talk_audio: 'Talk show âm thanh' }
export function MaterialsForm({ value, onChange, spaceId }) {
  const { data: repo, reload } = useFetch(() => api.learningAssets(), [])
  const [error, se] = useState(''); const [busy, sb] = useState(false)
  const set = (i, k, v) => onChange(value.map((m, j) => i === j ? { ...m, [k]: v } : m))
  const upload = async (i, file, subtitle = false) => {
    if (!file) return
    sb(true); se(''); try {
      const body = new FormData(); body.append('file', file); if (spaceId) body.append('space_id', spaceId); body.append('classification', value[i].classification || 'C0')
      const result = await api.uploadLearningAsset(body)
      onChange(value.map((m, j) => i === j ? (subtitle ? { ...m, subtitle_id: result.id } : { ...m, source: 'file', asset_id: result.id, url: null, title: m.title || result.filename }) : m)); reload()
    } catch(e) { se(e.message) } finally { sb(false) }
  }
  const move = (i, d) => { const next = [...value]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next) }
  return <section className="stack" data-testid="material-editor"><h3>Học liệu theo thứ tự</h3>
    {value.map((m, i) => <section className="panel stack" key={i}>
      <label className="field"><span>Tên học liệu {i + 1}</span><input required value={m.title} onChange={e => set(i, 'title', e.target.value)} /></label>
      <label className="field"><span>Loại học liệu</span><select aria-label="Loại học liệu" value={m.kind} disabled={m.kind === 'card'} onChange={e => set(i, 'kind', e.target.value)}>{Object.entries(TYPES).filter(([k]) => k !== 'card' || m.kind === 'card').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      {m.kind !== 'card' && <><label className="field"><span>Nguồn</span><select aria-label="Nguồn học liệu" value={m.source} onChange={e => onChange(value.map((x, j) => i === j ? { ...x, source: e.target.value, url: null, asset_id: null } : x))}><option value="link">Liên kết HTTPS</option><option value="file">Tải tệp</option><option value="repository">Kho học liệu</option></select></label>
      {m.source === 'link' ? <label className="field"><span>Liên kết học liệu</span><input required type="url" value={m.url || ''} onChange={e => set(i, 'url', e.target.value)} /></label> : m.source === 'file' ? <label className="field"><span>Tệp học liệu (tối đa 50 MB){m.asset_id && ' · đã tải'}</span><input type="file" accept=".mp4,.webm,.mp3,.m4a,.ogg,.wav,.pdf,.pptx" disabled={busy} onChange={e => upload(i, e.target.files[0])} /></label> : <label className="field"><span>Tệp trong kho có quyền xem</span><select required value={m.asset_id || ''} onChange={e => set(i, 'asset_id', e.target.value)}><option value="">Chọn tệp</option>{repo?.items.filter(x => !x.filename.endsWith('.vtt')).map(x => <option key={x.id} value={x.id}>{x.filename}</option>)}</select></label>}
      </>}
      {m.kind === 'card' && <p>Thẻ được ghim phiên bản; chọn / xem trước trong bộ chọn thẻ bên dưới.</p>}
      <label className="field"><span>Mức mật</span><select aria-label="Mức mật học liệu" value={m.classification || 'C0'} onChange={e => set(i, 'classification', e.target.value)}>{['C0', 'C1', 'C2', 'C3'].map(x => <option key={x}>{x}</option>)}</select></label>
      <label><input type="checkbox" checked={m.required} onChange={e => set(i, 'required', e.target.checked)} /> Học liệu bắt buộc</label>
      <label className="field"><span>Bản chép lời (nếu có)</span><textarea value={m.transcript || ''} onChange={e => set(i, 'transcript', e.target.value)} /></label>
      {['video', 'talk_video'].includes(m.kind) && <label className="field"><span>Phụ đề VTT (tuỳ chọn){m.subtitle_id && ' · đã tải'}</span><input type="file" accept=".vtt" disabled={busy} onChange={e => upload(i, e.target.files[0], true)} /></label>}
      <div className="actions"><button type="button" className="ui-btn" disabled={!i || busy} aria-label={`Xếp học liệu ${i + 1} lên`} onClick={() => move(i, -1)}>↑</button><button type="button" className="ui-btn" disabled={i === value.length - 1 || busy} aria-label={`Xếp học liệu ${i + 1} xuống`} onClick={() => move(i, 1)}>↓</button><button type="button" className="ui-btn" disabled={busy} onClick={() => onChange(value.filter((_, j) => j !== i))}>Bỏ học liệu {i + 1}</button></div>
    </section>)}
    <ErrorBox>{error}</ErrorBox>{busy && <p role="status">Đang tải học liệu…</p>}
    <button type="button" className="ui-btn" disabled={busy} onClick={() => onChange([...value, { title: '', kind: 'video', source: 'link', required: true, url: '', asset_id: null, subtitle_id: null, classification: 'C0', transcript: '' }])}>+ Học liệu</button>
  </section>
}

export function LessonMaterials({ materials, renderCard }) {
  return <section className="stack" aria-label="Học liệu">{materials.map((m, i) => <section key={i} className="card" data-testid={`material-${i + 1}`}>
    <h2>{m.title}</h2><p>{m.required ? 'Bắt buộc' : 'Tham khảo'}</p>
    {m.unavailable ? <p>Bạn không có quyền xem học liệu này.</p> : m.kind === 'card' ? renderCard?.(m.card_id) : <>
      {['video', 'talk_video'].includes(m.kind) ? <video controls preload="metadata" src={m.url} style={{ width: '100%' }} aria-label={m.title}><track kind="captions" src={m.subtitle_url || undefined} srcLang="vi" label="Tiếng Việt" default /></video>
        : ['podcast', 'talk_audio'].includes(m.kind) ? <audio controls preload="metadata" src={m.url} aria-label={m.title}><track kind="captions" src={m.subtitle_url || undefined} srcLang="vi" label="Tiếng Việt" />Trình duyệt không hỗ trợ phát âm thanh.</audio> : null}
      <a className="ui-btn" href={m.url} target="_blank" rel="noreferrer">{m.kind === 'slides' ? 'Mở / tải trình chiếu' : 'Mở nguồn học liệu'}</a>
      {m.transcript && <details><summary>Bản chép lời</summary><p style={{ whiteSpace: 'pre-wrap' }}>{m.transcript}</p></details>}
    </>}
  </section>)}</section>
}
