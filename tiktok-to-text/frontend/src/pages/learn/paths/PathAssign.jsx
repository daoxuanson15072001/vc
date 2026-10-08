// Tab *Giao bài* (LRN-05): giao lộ trình đã phát hành cho người / đơn vị / chức năng trong cây dưới quyền.
// Kết quả giao báo bằng toast (số người đã giao + dòng «Bỏ qua … lý do»).
import { useState } from 'react'
import { api } from '../../../api'
import { ErrorBox } from '../../../components/ui'
import { Notice } from '../../../components/Notice'
import { toast } from '../../../components/toast'
import { endOfDay } from './PathEditor'

export default function PathAssign({ p, onDone }) {
  const a = p.assignable
  const [people, setPeople] = useState(new Set())
  const [units, setUnits] = useState(new Set())
  const [funcs, setFuncs] = useState(new Set())
  const [due, setDue] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const toggle = (s, setS, v) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); setS(n) }
  if (p.status !== 'published') return <Notice tone="info" testId="assign-unpublished">Phát hành lộ trình (khoá nội dung) rồi mới giao bài được.</Notice>
  if (!a?.people.length) return <p className="muted" data-testid="assign-nobody">Bạn chưa có ai trong cây dưới quyền để giao lộ trình này.</p>
  const go = async () => {
    setErr(null)
    setBusy(true)
    try {
      const res = await api.assignPath(p.id, { learner_ids: [...people], unit_ids: [...units], functions: [...funcs], due_at: endOfDay(due) })
      const skipped = res.skipped.map((x) => `Bỏ qua ${x.name}: ${x.reason}`).join('; ')
      toast(`Đã giao ${res.assigned.length} người${res.assigned.length ? `: ${res.assigned.map((x) => x.name).join(', ')}` : ''}.${skipped ? ` ${skipped}.` : ''}`,
        { tone: res.assigned.length ? 'ok' : 'error' })
      setPeople(new Set()); setUnits(new Set()); setFuncs(new Set())
      onDone()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="lrn-form" data-testid="assign-form">
      <p className="muted small">Chỉ người trong cây dưới quyền của bạn (tuyến quản lý, tuyến chuyên môn, phạm vi L&amp;D). Chọn đơn vị / chức năng thì chỉ giao cho người trong cây của bạn thuộc đơn vị / chức năng đó.</p>
      <div className="row row-wrap lrn-assign">
        <div className="field"><span>Người</span>
          {a.people.map((u) => <label key={u.id} className="row small" data-user-id={u.id}><input type="checkbox" aria-label={`Người: ${u.name}`} data-testid={`assign-person-${u.id}`} checked={people.has(u.id)} onChange={() => toggle(people, setPeople, u.id)} />{u.name}<span className="muted"> · {u.units.join(', ')}</span></label>)}
        </div>
        {a.units.length > 0 && <div className="field"><span>Đơn vị</span>
          {a.units.map((u) => <label key={u.id} className="row small"><input type="checkbox" aria-label={`Đơn vị: ${u.name}`} data-testid={`assign-unit-${u.id}`} checked={units.has(u.id)} onChange={() => toggle(units, setUnits, u.id)} />{u.name}</label>)}
        </div>}
        {a.functions.length > 0 && <div className="field"><span>Chức năng</span>
          {a.functions.map((f) => <label key={f.code} className="row small"><input type="checkbox" aria-label={`Chức năng: ${f.name}`} data-testid={`assign-function-${f.code}`} checked={funcs.has(f.code)} onChange={() => toggle(funcs, setFuncs, f.code)} />{f.name}</label>)}
        </div>}
      </div>
      <div className="row row-wrap">
        <label className="field field-sm"><span>Hạn hoàn thành</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Hạn hoàn thành" data-testid="assign-due" /></label>
        <span className="muted small grow">Bỏ trống = hạn tuần cuối / cuối kỳ.</span>
        <button type="button" className="ui-btn ui-btn-primary" data-testid="assign-submit" disabled={busy || (!people.size && !units.size && !funcs.size)} onClick={go}>Giao</button>
      </div>
      <ErrorBox testId="assign-error">{err}</ErrorBox>
    </div>
  )
}
