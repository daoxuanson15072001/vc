import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { dateTime } from '../format'
import { Badge, Empty, ErrorBox, Loading } from '../components/ui'
import { confirmDialog } from '../components/dialog'

// Tab Phân tích của dự án (BA 5.13, CE-27): khung 7P — AI soạn nháp có căn cứ, người sửa, chủ dự án chốt phiên bản.
const BUSY = ['queued', 'generating']

export default function ProjectAnalysis({ p, reloadProject }) {
  const [selected, setSelected] = useState(null)   // id phân tích đang xem
  const { data: list, error, reload: reloadList } = useFetch(() => api.analyses(p.id), [p.id])
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  const items = list?.items || []
  const current = items.find((a) => a.id === selected) || items.find((a) => a.is_current) || items[0]

  useEffect(() => { if (items.length && !selected) setSelected((items.find((a) => a.is_current) || items[0]).id) }, [items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setActionError(null)
    setBusy(true)
    try {
      const res = await fn()
      await reloadList()
      if (res?.id) setSelected(res.id)
      return res
    } catch (e) {
      setActionError(e.message)
      return null
    } finally {
      setBusy(false)
    }
  }
  const create = (mode) => run(() => api.createAnalysis(p.id, { framework: '7p', mode }))

  return (
    <>
      <div className="row-between">
        <p className="muted small grow">
          <b>7P</b>: Sản phẩm · Giá · Phân phối · Truyền thông · Con người · Quy trình · Bằng chứng hữu hình. AI soạn nháp từ mục tiêu, tài nguyên và thẻ ghim
          của dự án, mỗi mục kèm mã căn cứ; bạn sửa rồi <b>chủ dự án chốt</b>. Chiến dịch / bài viết tạo sau khi chốt sẽ nạp bản đã chốt làm căn cứ.
        </p>
        {p.can_edit && p.status === 'active' && (
          <div className="actions">
            <button className="btn btn-primary" disabled={busy} data-testid="analysis-draft-ai" onClick={() => create('ai')}>✦ AI soạn nháp 7P</button>
            <button className="btn btn-ghost" disabled={busy} data-testid="analysis-draft-blank" onClick={() => create('blank')}>Bản trống</button>
          </div>
        )}
      </div>
      <ErrorBox>{error || actionError}</ErrorBox>
      {items.length === 0 && <Empty>Chưa có phân tích nào. {p.can_edit ? 'Thêm tài nguyên và thẻ ghim trước, rồi bấm AI soạn nháp 7P.' : ''}</Empty>}
      {items.length > 0 && (
        <div className="tabs" role="group" aria-label="Các phiên bản phân tích">
          {items.map((a) => (
            <button key={a.id} className={current?.id === a.id ? 'active' : ''} aria-pressed={current?.id === a.id} data-id={a.id} data-status={a.state} onClick={() => setSelected(a.id)}>
              v{a.version} {a.state === 'final' ? (a.is_current ? '· đã chốt (hiện hành)' : '· đã chốt') : '· nháp'}
            </button>
          ))}
        </div>
      )}
      {current && <AnalysisView key={current.id} p={p} id={current.id} onChanged={async () => { await reloadList(); reloadProject() }} />}
    </>
  )
}

function AnalysisView({ p, id, onChanged }) {
  const [interval, setInterval_] = useState(0)
  const { data: a, error, setData, reload } = useFetch(() => api.analysis(p.id, id), [p.id, id], interval)
  const [draft, setDraft] = useState(null)   // bản đang sửa: { summary, sections }
  const [feedback, setFeedback] = useState('')
  const [actionError, setActionError] = useState(null)
  useEffect(() => setInterval_(a && BUSY.includes(a.status) ? 3000 : 0), [a?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn, after) => {
    setActionError(null)
    try {
      const res = await fn()
      if (res?.id === id) setData(res)
      else reload()
      if (after) await after()
      return true
    } catch (e) {
      setActionError(e.message)
      return false
    }
  }

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!a) return <Loading />
  const editable = p.can_edit && a.state === 'draft' && !BUSY.includes(a.status)
  const refIndex = Object.fromEntries([...(p.resources || []), ...(p.cards || []), ...(p.courses || [])].map((r) => [r.ref, r]))
  const d = draft || { summary: a.summary || '', sections: a.sections }
  const setSec = (k, patch) => setDraft({ ...d, sections: { ...d.sections, [k]: { ...d.sections[k], ...patch } } })
  const save = () => run(() => api.patchAnalysis(p.id, id, {
    summary: d.summary,
    sections: Object.fromEntries(Object.entries(d.sections).map(([k, s]) => [k, { text: s.text, evidence: s.evidence }])),
  }), async () => setDraft(null))

  return (
    <section className="card" aria-labelledby={`analysis-${id}-title`} data-id={id} data-status={a.state} data-testid="analysis-view">
      <div className="row-between">
        <div>
          <h2 id={`analysis-${id}-title`}>7P phiên bản {a.version} {a.state === 'final' ? <Badge tone="good">{a.is_current ? 'Đã chốt · hiện hành' : 'Đã chốt'}</Badge> : <Badge tone="warn">Nháp</Badge>}</h2>
          <div className="muted small">
            {a.created_by_name} · {dateTime(a.created_at)}
            {a.finalized_at && <> · chốt bởi {a.finalized_by_name} {dateTime(a.finalized_at)}</>}
            {a.usage?.input_tokens && <> · {a.usage.input_tokens + (a.usage.output_tokens || 0)} token</>}
          </div>
        </div>
        <div className="actions">
          {draft && <button className="btn btn-primary" data-testid="analysis-save" onClick={save}>Lưu sửa</button>}
          {draft && <button className="btn btn-ghost" onClick={() => setDraft(null)}>Bỏ sửa</button>}
          {editable && !draft && p.can_manage && (
            <button className="btn btn-primary" data-testid="analysis-finalize" onClick={async () => {
              if (await confirmDialog({ title: 'Chốt phiên bản này?', body: 'Sau khi chốt không sửa được, chiến dịch và bài viết mới sẽ dùng bản này.', okLabel: 'Chốt phiên bản' })) run(() => api.finalizeAnalysis(p.id, id), onChanged)
            }}>✓ Chốt phiên bản</button>
          )}
          {editable && !draft && (
            <button className="btn btn-ghost btn-danger-text" data-testid="analysis-delete" onClick={async () => {
              if (await confirmDialog({ title: 'Xoá bản nháp này?', body: `7P phiên bản ${a.version}`, okLabel: 'Xoá nháp', danger: true })) run(() => api.deleteAnalysis(p.id, id), onChanged)
            }}>Xoá nháp</button>
          )}
        </div>
      </div>
      <ErrorBox>{actionError}</ErrorBox>
      {BUSY.includes(a.status) && (
        <div className="current" role="status"><span className="pulse" />{a.status === 'queued' ? 'Đang chờ AI…' : `AI đang làm: ${a.stage || '…'}`}<span className="muted small"> — thường 1–3 phút, trang tự cập nhật.</span></div>
      )}
      {a.overall === 'waiting_ai' && <div className="notice">Máy chủ chưa có AI — phân tích sẽ tự chạy khi được cấu hình. Bạn vẫn có thể điền tay.</div>}
      {a.status === 'error' && <ErrorBox>Lỗi khi AI phân tích: {a.error}</ErrorBox>}

      <h3>Tóm tắt định vị</h3>
      {editable ? <textarea rows={4} value={d.summary} onChange={(e) => setDraft({ ...d, summary: e.target.value })} placeholder="5–8 câu: định vị và 3 việc nội dung nên tập trung" aria-label="Tóm tắt" />
        : <p>{a.summary || <span className="muted">—</span>}</p>}

      {a.section_order.map((k) => {
        const s = d.sections[k] || { text: '', evidence: [] }
        return (
          <div key={k} className="analysis-section" data-id={k}>
            <h3>{a.labels[k]} <span className="muted small">— {a.hints[k]}</span></h3>
            {editable ? (
              <>
                <textarea rows={5} value={s.text} onChange={(e) => setSec(k, { text: e.target.value })} aria-label={a.labels[k]} />
                <label className="field"><span className="small">Mã căn cứ <em>(R1, S2, P1, D1, K3… cách nhau bằng dấu phẩy)</em></span>
                  <input value={s.evidence.join(', ')} onChange={(e) => setSec(k, { evidence: e.target.value.split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean) })} />
                </label>
              </>
            ) : (
              <>
                <p className="pre-line">{s.text || <span className="muted">Chưa có nhận định.</span>}</p>
                {s.evidence.length > 0 && (
                  <div className="chips">
                    {s.evidence.map((ref) => <EvidenceChip key={ref} refCode={ref} item={refIndex[ref]} projectId={p.id} />)}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}

      {a.open_questions?.length > 0 && (
        <>
          <h3>Câu hỏi còn mở</h3>
          <ul>{a.open_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </>
      )}

      {editable && !draft && (
        <div className="regen">
          <label className="field"><span>Soạn lại bằng AI theo yêu cầu <em>(tuỳ chọn)</em></span>
            <textarea rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="VD: nhấn mạnh giá so với đối thủ, bỏ phần chưa có số liệu" />
          </label>
          <button className="btn" data-testid="analysis-regenerate" onClick={() => run(() => api.regenerateAnalysis(p.id, id, feedback))}>✦ AI soạn lại</button>
        </div>
      )}
    </section>
  )
}

function EvidenceChip({ refCode, item, projectId }) {
  if (!item) return <span className="chip" title="Mã không còn trong dự án">{refCode}</span>
  const title = item.title || refCode
  if (refCode.startsWith('K')) return <Link className="chip" to={`/wiki?card=${item.card_id}`} title={title}>{refCode} · {title.slice(0, 40)}</Link>
  if (refCode.startsWith('L')) return <Link className="chip" to={`/learn/paths/${item.course_id}`} title={title}>{refCode} · {title.slice(0, 40)}</Link>
  return <Link className="chip" to={`/studio/projects/${projectId}?tab=resources`} title={title}>{refCode} · {title.slice(0, 40)}</Link>
}
