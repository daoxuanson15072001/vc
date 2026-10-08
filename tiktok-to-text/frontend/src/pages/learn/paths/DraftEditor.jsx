// Bước 3 *Sửa* của Thiết kế lộ trình (LRN-04): sửa tên lộ trình / bài, xếp lại bài + thẻ, chuyển tuần, ma trận đề thi,
// chọn kho lưu bài học; thông báo khi lưu. Lưu nháp nằm ở chân trang chung (Design.jsx) — `plan` đến từ useDraftPlan.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { dateTime } from '../../../format'
import { Badge } from '../../../components/ui'
import { Notice } from '../../../components/Notice'
import { SpaceSelect } from '../../../components/pickers'
import { CardPicker } from '../common'

export const LEVEL_LABEL = { 'nhap-mon': 'Nhập môn', 'thuc-thi': 'Thực thi', 'van-hanh': 'Vận hành', 'thiet-ke': 'Thiết kế', 'dieu-hanh': 'Điều hành' }
const moveIn = (arr, i, d) => { [arr[i], arr[i + d]] = [arr[i + d], arr[i]] }

export default function DraftEditor({ draft, dp }) {
  const { plan, edit, locked, spaces, spaceId, setSpaceId, notices, overwrite, setOverwrite } = dp
  const unit = draft.period === 'year' ? 'Tháng' : 'Tuần'
  return (
    <section className="card lrn-step-card lrn-form">
      <h2 className="lrn-sec">Sửa bản nháp</h2>
      {locked && <Notice tone="warn">Lộ trình đã phát hành — nội dung bị khoá, không sửa được ở đây.</Notice>}
      <label className="field"><span>Tên lộ trình</span>
        <input value={plan.title || ''} disabled={locked} onChange={(e) => edit((p) => { p.title = e.target.value })} aria-label="Tên lộ trình" />
      </label>

      {plan.weeks.map((w, wi) => (
        <div key={w.week} className="panel lrn-week" aria-label={`${unit} ${w.week}`}>
          <div className="strong">{unit} {w.week}</div>
          {w.lessons.length === 0 && <p className="muted small">Chưa có bài.</p>}
          {w.lessons.map((l, li) => (
            <div key={li} className="lrn-lesson">
              <div className="row">
                <input className="grow" value={l.title} disabled={locked} aria-label={`Tên bài ${unit.toLowerCase()} ${w.week}.${li + 1}`}
                  onChange={(e) => edit((p) => { p.weeks[wi].lessons[li].title = e.target.value })} />
                {!locked && (
                  <span className="lrn-picked-actions">
                    <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" title="Bài lên" aria-label={`Bài lên: ${l.title}`} disabled={li === 0} onClick={() => edit((p) => moveIn(p.weeks[wi].lessons, li, -1))}>↑</button>
                    <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" title="Bài xuống" aria-label={`Bài xuống: ${l.title}`} disabled={li === w.lessons.length - 1} onClick={() => edit((p) => moveIn(p.weeks[wi].lessons, li, 1))}>↓</button>
                    <select aria-label={`Chuyển bài ${l.title} sang`} title="Chuyển sang" value={w.week} onChange={(e) => edit((p) => {
                      const [les] = p.weeks[wi].lessons.splice(li, 1)
                      p.weeks.find((x) => x.week === Number(e.target.value)).lessons.push(les)
                    })}>
                      {plan.weeks.map((x) => <option key={x.week} value={x.week}>{unit} {x.week}</option>)}
                    </select>
                    <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost ui-btn-danger" title="Bỏ bài" aria-label={`Bỏ bài: ${l.title}`} onClick={() => edit((p) => { p.weeks[wi].lessons.splice(li, 1) })}>✕</button>
                  </span>
                )}
              </div>
              {l.objectives?.length > 0 && <p className="muted small">Mục tiêu: {l.objectives.join('; ')}</p>}
              <ol className="lrn-picked">
                {l.cards.map((c, ci) => (
                  <CardRow key={c.card_id} c={c} locked={locked}
                    onUp={ci > 0 ? () => edit((p) => moveIn(p.weeks[wi].lessons[li].cards, ci, -1)) : null}
                    onDown={ci < l.cards.length - 1 ? () => edit((p) => moveIn(p.weeks[wi].lessons[li].cards, ci, 1)) : null}
                    onRemove={() => edit((p) => { p.weeks[wi].lessons[li].cards.splice(ci, 1) })} />
                ))}
              </ol>
              {l.cards.length === 0 && <p className="muted small">Bài không còn thẻ — sẽ bị bỏ khi lưu.</p>}
              {!locked && (
                <AddCard label={`Thêm thẻ vào bài ${w.week}.${li + 1}`}
                  onAdd={(c) => edit((p) => {
                    const cards = p.weeks[wi].lessons[li].cards
                    if (!cards.some((x) => x.card_id === c.card_id)) cards.push({ card_id: c.card_id, title: c.title })
                  })} />
              )}
              {l.practice?.length > 0 && <p className="muted small">Gợi ý luyện tập: {l.practice.join(' · ')}</p>}
            </div>
          ))}
          {!locked && (
            <button type="button" className="ui-btn ui-btn-ghost" onClick={() => edit((p) => { p.weeks[wi].lessons.push({ title: 'Bài mới', objectives: [], cards: [], narrative: '', practice: [] }) })}>
              + Bài trong {unit.toLowerCase()} {w.week}
            </button>
          )}
        </div>
      ))}

      <div className="row row-wrap">
        <label className="field grow2"><span>Ma trận đề thi cuối kỳ</span>
          <input value={plan.exam?.blueprint || ''} disabled={locked} onChange={(e) => edit((p) => { p.exam = { ...p.exam, blueprint: e.target.value } })} />
        </label>
        <label className="field"><span>Thời gian (phút)</span>
          <input type="number" min={1} value={plan.exam?.duration_min ?? 45} disabled={locked} onChange={(e) => edit((p) => { p.exam = { ...p.exam, duration_min: e.target.value } })} />
        </label>
        <label className="field"><span>Điểm đạt (%)</span>
          <input type="number" min={0} max={100} value={plan.exam?.pass_score ?? 70} disabled={locked} onChange={(e) => edit((p) => { p.exam = { ...p.exam, pass_score: e.target.value } })} />
        </label>
      </div>

      {!locked && !draft.exam_on && draft.edited_in_paths_at && <p className="muted small">Bài thi đã tắt ở màn Lộ trình — các ô trên chỉ dùng khi chọn “Ghi đè”.</p>}

      {!locked && (
        <>
          {draft.edited_in_paths_at && (
            <div className="panel" role="note" aria-label="Đã sửa ở màn Lộ trình">
              <div className="strong">Lộ trình đã được sửa ở màn <Link className="link" to={`/learn/paths/${draft.id}`}>Lộ trình</Link> lúc {dateTime(draft.edited_in_paths_at)}</div>
              <p className="small">
                <b>Lưu nháp</b> ở đây chỉ cập nhật các bài học của bản thiết kế (sửa tại chỗ, giữ câu luyện tập đã gắn); giữ nguyên
                {draft.manual_lesson_count ? ` ${draft.manual_lesson_count} bài thêm tay,` : ''} chủ đề + hạn tuần, số lượt / ma trận đề đã đặt ở màn Lộ trình.
              </p>
              <label className="row lrn-choice small"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                Ghi đè theo bản thiết kế: bỏ bài / tuần thêm tay, hạn tuần (mục bắt buộc trỏ bài không còn sẽ bị bỏ)</label>
            </div>
          )}
          <div className="field"><span>Lưu bài học vào kho (người học phải xem được kho này)</span>
            <SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly label="Lưu bài học vào kho (người học phải xem được kho này)" />
          </div>
          {notices.length > 0 && <ul className="small" aria-label="Thông báo khi lưu">{notices.map((n) => <li key={n}>{n}</li>)}</ul>}
        </>
      )}
      {draft.lesson_ids?.length > 0 && (
        <p className="small">Bài học nháp: {draft.lesson_ids.map((lid, i) => <Link key={lid} className="link" to={`/learn/lessons/${lid}`}>{`#${i + 1} `}</Link>)}</p>
      )}
      <Notice tone="info" testId="design-questions-link">
        Cần câu hỏi cho các thẻ này? Bấm <b>AI sinh câu hỏi</b> ở từng thẻ phía trên — câu nháp vào{' '}
        <Link className="link" to="/learn/library?tab=questions">Ngân hàng câu hỏi của Thư viện</Link>, xem và duyệt ở đó.
      </Notice>
    </section>
  )
}

// Thêm thẻ vào bài: bấm mới mở ô tìm (tránh mỗi bài hiện sẵn một dãy thẻ gợi ý)
function AddCard({ label, onAdd }) {
  const [open, setOpen] = useState(false)
  if (!open) return <button type="button" className="link small" onClick={() => setOpen(true)}>+ Thêm thẻ</button>
  return <CardPicker value={[]} max={1} label={label} onChange={([c]) => { if (c) { onAdd(c); setOpen(false) } }} />
}

// Một thẻ trong bài: liên kết VCWIKI + bản + cờ cảnh báo; AI sinh câu nháp cho riêng thẻ này (LRN-02, câu vào Ngân hàng)
export function CardRow({ c, locked, onUp, onDown, onRemove }) {
  const [gen, setGen] = useState(null)
  const generate = async () => {
    setGen({ busy: true })
    try {
      const r = await api.generateQuestions(c.card_id, 2)
      setGen({ text: `Đã tạo ${r.created} câu nháp` })
    } catch (e) {
      setGen({ text: e.message, bad: true })
    }
  }
  return (
    <li className="row-between">
      <span className="grow">
        <Link className="link" to={`/wiki?card=${c.card_id}`}>{c.title || c.card_id}</Link>
        <span className="muted small"> · bản {c.rev || c.current_rev || '—'}{c.level ? ` · ${LEVEL_LABEL[c.level] || c.level}` : ''}{c.type ? ` · ${c.type}` : ''}{c.process_steps?.length ? ` · ${c.process_steps.join(', ')}` : ''}</span>
        {c.outdated && <Badge tone="warn">thẻ đã có bản {c.current_rev}</Badge>}
        {c.unavailable && <Badge tone="bad">không dùng được: {c.unavailable_reason}</Badge>}
        {gen?.text && <span role="status" className={`small ${gen.bad ? 'badge badge-bad' : 'muted'}`}> · {gen.text}{!gen.bad && <> — <Link className="link" to="/learn/library?tab=questions">Ngân hàng câu hỏi</Link></>}</span>}
      </span>
      {!locked && (
        <span className="lrn-picked-actions">
          {!c.c3 && <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" aria-label={`AI sinh câu hỏi: ${c.title || c.card_id}`} disabled={gen?.busy} onClick={generate}>{gen?.busy ? '…' : 'AI sinh câu hỏi'}</button>}
          <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" title="Lên" aria-label={`Thẻ lên: ${c.title || c.card_id}`} disabled={!onUp} onClick={onUp}>↑</button>
          <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" title="Xuống" aria-label={`Thẻ xuống: ${c.title || c.card_id}`} disabled={!onDown} onClick={onDown}>↓</button>
          <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost ui-btn-danger" title="Bỏ thẻ" aria-label={`Bỏ thẻ: ${c.title || c.card_id}`} onClick={onRemove}>✕</button>
        </span>
      )}
    </li>
  )
}
