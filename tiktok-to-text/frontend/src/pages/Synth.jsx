import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { CARD_STATUS, CARD_TYPE, CLUSTER_STATUS, dateTime, num, SYNTH_STATUS, time } from '../format'
import { Badge, ErrorBox, Loading } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { categoryLabel } from '../components/pickers'
import { AiJobBanner } from '../components/aiJob'

// Tổng hợp VCWIKI theo cụm chủ đề: AI sàng lọc → gom cụm → người duyệt kế hoạch → AI viết thẻ

const RUNNING = ['queued', 'triaging', 'clustering', 'synthesizing']
const STEPS = ['Sàng lọc', 'Gom cụm', 'Duyệt kế hoạch', 'Viết thẻ', 'Duyệt thẻ']
const STEP_OF = { queued: 0, triaging: 0, clustering: 1, planned: 2, synthesizing: 3, done: 4 }

const relTone = (r) => (r == null ? 'muted' : r >= 7 ? 'good' : r >= 4 ? 'warn' : 'bad')
let tempKey = 0

export default function Synth() {
  const { id } = useParams()
  const [interval, setInterval_] = useState(2500)
  const { data: run, error, setData } = useFetch(() => api.synthRun(id), [id], interval)
  const { data: cats } = useFetch(api.categories, [])
  const [plan, setPlan] = useState(null)       // bản kế hoạch đang sửa (chỉ khi chờ duyệt)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  useEffect(() => setInterval_(run && RUNNING.includes(run.status) ? 2500 : 0), [run?.status]) // eslint-disable-line react-hooks/exhaustive-deps
  // Lấy kế hoạch từ máy chủ khi vừa chuyển sang bước duyệt (không ghi đè bản đang sửa)
  useEffect(() => {
    if (run?.status === 'planned' && !dirty) setPlan(run.clusters.map((c) => ({ ...c })))
    if (run && run.status !== 'planned') setPlan(null)
  }, [run]) // eslint-disable-line react-hooks/exhaustive-deps

  const docs = useMemo(() => Object.fromEntries((run?.docs || []).map((d) => [d.id, d])), [run])
  if (!run || !cats) return error ? <ErrorBox>{error}</ErrorBox> : <div className="card muted page-loading"><Loading /></div>

  const editing = run.status === 'planned' && run.can_edit && plan
  const clusters = editing ? plan : run.clusters
  const used = new Set(clusters.flatMap((c) => c.doc_ids))
  const skipped = run.docs.filter((d) => !used.has(d.id) && d.relevance != null)
  const expected = clusters.reduce((a, c) => a + (c.doc_ids.length ? c.n_cards : 0), 0)

  const act = async (fn) => {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fn()
      if (res) setData(res)
      return res
    } catch (e) {
      setActionError(e.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  // --- Sửa kế hoạch -----------------------------------------------------------------------
  const change = (next) => { setPlan(next); setDirty(true) }
  const setCluster = (key, patch) => change(plan.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  const moveDoc = (docId, target) => {
    let next = plan.map((c) => ({ ...c, doc_ids: c.doc_ids.filter((i) => i !== docId) }))
    if (target === '__new') {
      const d = docs[docId]
      next.push({ key: `new-${++tempKey}`, title: d.summary?.slice(0, 80) || d.title.slice(0, 80), category: d.category,
        doc_ids: [docId], primary_id: docId, n_cards: 1, note: '', status: 'pending' })
    } else if (target) {
      next = next.map((c) => (c.key === target ? { ...c, doc_ids: [...c.doc_ids, docId] } : c))
    }
    next = next.map((c) => (c.doc_ids.includes(c.primary_id) ? c : { ...c, primary_id: c.doc_ids[0] }))
    change(next)
  }
  const removeCluster = (key) => change(plan.filter((c) => c.key !== key))
  const addCluster = () => change([...plan, { key: `new-${++tempKey}`, title: 'Cụm mới', category: null, doc_ids: [],
    primary_id: null, n_cards: 1, note: '', status: 'pending' }])

  const payload = () => plan.map(({ key, title, category, doc_ids, primary_id, n_cards, note }) =>
    ({ key: key.startsWith('new-') ? null : key, title, category, doc_ids, primary_id, n_cards, note }))
  const save = async () => {
    const res = await act(() => api.saveSynthPlan(id, payload()))
    if (res) { setDirty(false); setPlan(res.clusters.map((c) => ({ ...c }))) }
    return res
  }
  const start = async () => {
    if (!(await confirmDialog({
      title: 'Viết thẻ?', body: `AI sẽ viết khoảng ${expected} thẻ nháp từ ${plan.filter((c) => c.doc_ids.length).length} cụm. Tiếp tục?`,
      okLabel: `Viết ${expected} thẻ`,
    }))) return
    if (dirty && !(await save())) return
    await act(() => api.runSynth(id))
    setInterval_(2500)
  }
  const cancel = async () => {
    if (!(await confirmDialog({
      title: 'Huỷ lượt tổng hợp?', body: 'Thẻ đã viết được giữ lại, tài liệu chưa xử lý trả về hàng chờ.',
      okLabel: 'Huỷ lượt tổng hợp', cancelLabel: 'Không huỷ', danger: true,
    }))) return
    act(() => api.cancelSynth(id))
  }

  const step = STEP_OF[run.status] ?? -1
  const p = run.progress || {}
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0

  return (
    <>
      <header className="page-head">
        <div>
          <div className="muted small">
            <Link className="link" to={`/kb?source=${run.source_id}`}>← {run.source_title || 'Nguồn'}</Link>
          </div>
          <h1>Tổng hợp VCWIKI theo chủ đề</h1>
          <p className="muted">
            {run.created_by_name} · {dateTime(run.created_at)}
            {run.external && <> · thẻ gắn tag <span className="tag">#nguon-ben-ngoai</span></>}
          </p>
        </div>
        <Badge tone={SYNTH_STATUS[run.status]?.tone}>{SYNTH_STATUS[run.status]?.label || run.status}</Badge>
      </header>

      <ol className="stepper" aria-label="Các bước tổng hợp">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? 'done' : i === step ? 'on' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="step-no">{i < step ? '✓' : i + 1}</span>{label}
          </li>
        ))}
      </ol>

      <section className="card synth-status" aria-label="Tiến độ tổng hợp" data-status={run.status}>
        <div className="synth-stats">
          <span><b>{num(run.doc_count)}</b> tài liệu</span>
          <span><b>{num(run.docs.filter((d) => used.has(d.id)).length)}</b> đưa vào cụm</span>
          <span><b>{num(skipped.length)}</b> bỏ qua</span>
          <span><b>{num(clusters.filter((c) => c.doc_ids.length).length)}</b> cụm</span>
          <span><b>{num(run.card_count || expected)}</b> {run.card_count ? 'thẻ đã viết' : 'thẻ dự kiến'}</span>
          {run.usage && <span className="muted small">{num(run.usage.calls)} lượt gọi AI · {num(run.usage.input_tokens + run.usage.output_tokens)} token</span>}
        </div>
        {RUNNING.includes(run.status) && (
          <>
            <AiJobBanner />
            <div className="progress" role="progressbar" aria-label="Tiến độ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="progress-bar progress-live" style={{ width: `${Math.max(pct, 4)}%` }} /></div>
            <div className="small muted" role="status">
              {run.status === 'queued' && 'Đang chờ đến lượt…'}
              {run.status === 'triaging' && `AI đang sàng lọc ${p.done}/${p.total} tài liệu`}
              {run.status === 'clustering' && `AI đang gom cụm chủ đề${p.total > 1 ? ` (${p.done}/${p.total} nhóm lĩnh vực)` : ''}…`}
              {run.status === 'synthesizing' && `AI đang viết thẻ${run.stage ? ` — cụm "${run.stage}"` : ''} · ${p.done}/${p.total} cụm`}
            </div>
          </>
        )}
        {run.status === 'planned' && (
          <div className="notice">
            <b>Đến lượt bạn:</b> xem các cụm AI đề xuất bên dưới — đổi tên, chọn lĩnh vực và số thẻ, chuyển tài liệu giữa các cụm,
            bỏ hoặc khôi phục tài liệu. Xong bấm <b>Viết thẻ</b>.
          </div>
        )}
        {run.status === 'done' && (
          <div className="row row-wrap">
            <span className="tone-good">✓ Đã viết {num(run.card_count)} thẻ nháp — cần người duyệt trước khi dùng.</span>
            <Link className="btn btn-primary" to={`/wiki?source_id=${run.source_id}&status=draft`}>Duyệt thẻ nháp →</Link>
          </div>
        )}
        <ErrorBox>{run.error}</ErrorBox>
        <ErrorBox>{actionError}</ErrorBox>
      </section>

      {clusters.length > 0 && (
        <div className="section-head">
          <h2>Cụm chủ đề</h2>
          {editing && <button className="btn btn-ghost" data-testid="synth-cluster-add" onClick={addCluster}>+ Cụm mới</button>}
        </div>
      )}
      {clusters.map((c) => (
        <Cluster key={c.key} c={c} docs={docs} cats={cats} clusters={clusters} editing={editing} busy={busy}
          onChange={(patch) => setCluster(c.key, patch)} onMove={moveDoc} onRemove={() => removeCluster(c.key)}
          onRetry={() => act(() => api.retrySynthCluster(id, c.key)).then(() => setInterval_(2500))} />
      ))}

      {skipped.length > 0 && (
        <section className="card cluster cluster-skipped">
          <div className="cluster-head">
            <h3 className="grow">Bỏ qua ({skipped.length})</h3>
            <span className="muted small">Không đưa vào VCWIKI. {editing && 'Chọn cụm để khôi phục.'}</span>
          </div>
          {skipped.map((d) => (
            <DocRow key={d.id} d={d} showReason>
              {editing && (
                <select aria-label={`Khôi phục ${d.title}`} value="" onChange={(e) => moveDoc(d.id, e.target.value)}>
                  <option value="">Khôi phục vào…</option>
                  {clusters.map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
                  <option value="__new">+ Cụm mới</option>
                </select>
              )}
            </DocRow>
          ))}
        </section>
      )}

      {(editing || RUNNING.includes(run.status)) && run.can_edit && (
        <div className="sticky-foot">
          {editing && (
            <>
              <span className="muted small grow">
                {dirty ? 'Có thay đổi chưa lưu · ' : ''}{plan.filter((c) => c.doc_ids.length).length} cụm · ~{expected} thẻ
                {plan.some((c) => !c.doc_ids.length) && ' · cụm rỗng sẽ bị bỏ khi lưu'}
              </span>
              <button className="btn" data-testid="synth-plan-save" disabled={!dirty || busy} onClick={save}>Lưu kế hoạch</button>
              <button className="btn btn-primary" data-testid="synth-run-start" disabled={busy || !expected} onClick={start}>✦ Viết thẻ ({expected})</button>
            </>
          )}
          {!editing && <span className="grow" />}
          <button className="btn btn-ghost btn-danger-text" data-testid="synth-run-cancel" disabled={busy} onClick={cancel}>Huỷ lượt</button>
        </div>
      )}

      <details className="card synth-log">
        <summary>Nhật ký ({run.logs.length})</summary>
        <div className="log" role="log" aria-label="Nhật ký tổng hợp">
          {run.logs.map((l, i) => (
            <div key={i} className={l.msg.includes('✗') ? 'tone-bad' : l.msg.includes('⚠') ? 'tone-warn' : ''}>
              <span className="log-time">{time(l.at)}</span> {l.msg}
            </div>
          ))}
        </div>
      </details>
    </>
  )
}

function Cluster({ c, docs, cats, clusters, editing, busy, onChange, onMove, onRemove, onRetry }) {
  const [open, setOpen] = useState(editing)
  useEffect(() => setOpen(editing), [editing])
  const members = c.doc_ids.map((i) => docs[i]).filter(Boolean)
  return (
    <section className={`card cluster ${!c.doc_ids.length ? 'row-off' : ''}`} aria-label={`Cụm: ${c.title}`} data-id={c.key} data-status={c.status}>
      <div className="cluster-head">
        {editing ? (
          <>
            <input className="grow cluster-title" aria-label="Tên cụm" value={c.title} onChange={(e) => onChange({ title: e.target.value })} />
            <select aria-label="Lĩnh vực" value={c.category || ''} onChange={(e) => onChange({ category: e.target.value || null })}>
              <option value="">— Lĩnh vực —</option>
              {cats.map((x) => <option key={x.slug} value={x.slug}>{x.level > 1 ? '　' : ''}{x.name}</option>)}
            </select>
            <select aria-label="Số thẻ" value={c.n_cards} onChange={(e) => onChange({ n_cards: Number(e.target.value) })}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n} thẻ</option>)}
            </select>
            <button className="icon-btn" title="Bỏ cụm (tài liệu chuyển sang Bỏ qua)" aria-label={`Bỏ cụm ${c.title}`} onClick={onRemove}>✕</button>
          </>
        ) : (
          <>
            <button className="link grow cluster-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
              <span className="strong">{c.title}</span>
              <span className="muted small"> · {members.length} tài liệu · {c.n_cards} thẻ{c.category ? ` · ${categoryLabel(cats, c.category)}` : ''}</span>
            </button>
            <Badge tone={CLUSTER_STATUS[c.status]?.tone}>{CLUSTER_STATUS[c.status]?.label}</Badge>
            {c.status === 'error' && <button className="btn btn-ghost" disabled={busy} aria-label={`Chạy lại cụm ${c.title}`} onClick={onRetry}>Chạy lại</button>}
          </>
        )}
      </div>
      {editing && (
        <input className="cluster-note small" aria-label="Ghi chú cho AI" placeholder="Ghi chú cho AI khi viết thẻ (không bắt buộc) — vd: nhấn vào ứng dụng cho garage"
          value={c.note || ''} onChange={(e) => onChange({ note: e.target.value })} />
      )}
      {!editing && c.note && <div className="muted small">{c.note}</div>}
      {c.error && <div className="tone-bad small">{c.error}</div>}
      {c.cards?.length > 0 && (
        <ul className="cluster-cards" aria-label={`Thẻ đã viết từ cụm ${c.title}`}>
          {c.cards.map((k) => (
            <li key={k.id}>
              <Link className="link" to={`/wiki?card=${k.id}`}>{k.title}</Link>{' '}
              <span className="muted small">{CARD_TYPE[k.type]}</span>{' '}
              <Badge tone={CARD_STATUS[k.status]?.tone}>{CARD_STATUS[k.status]?.label}</Badge>
            </li>
          ))}
        </ul>
      )}
      {open && members.map((d) => (
        <DocRow key={d.id} d={d} primary={d.id === c.primary_id}>
          {editing && (
            <>
              <label className="small nowrap" title="Tài liệu chính: thẻ dẫn về tài liệu này trước">
                <input type="radio" name={`primary-${c.key}`} checked={d.id === c.primary_id} onChange={() => onChange({ primary_id: d.id })} /> Chính
              </label>
              <select aria-label={`Chuyển ${d.title}`} value="" onChange={(e) => onMove(d.id, e.target.value === '__skip' ? '' : e.target.value)}>
                <option value="">Chuyển sang…</option>
                {clusters.filter((x) => x.key !== c.key).map((x) => <option key={x.key} value={x.key}>{x.title}</option>)}
                <option value="__new">+ Cụm mới</option>
                <option value="__skip">✕ Bỏ qua tài liệu này</option>
              </select>
            </>
          )}
        </DocRow>
      ))}
    </section>
  )
}

function DocRow({ d, primary, showReason, children }) {
  return (
    <div className={`doc-mini ${primary ? 'doc-primary' : ''}`}>
      <Badge tone={relTone(d.relevance)}>{d.relevance ?? '–'}/10</Badge>
      <div className="grow">
        <div className="clamp-1">
          {primary && <span title="Tài liệu chính" aria-label="Tài liệu chính">★ </span>}
          {d.url ? <a className="link" href={d.url} target="_blank" rel="noreferrer">{d.title}</a> : d.title}
          {d.views != null && <span className="muted small"> · {num(d.views)} lượt xem</span>}
        </div>
        {d.summary && <div className="small muted clamp-2">{d.summary}</div>}
        {showReason && d.reason && <div className="small tone-warn">{d.reason}</div>}
      </div>
      {children && <div className="doc-mini-actions">{children}</div>}
    </div>
  )
}
