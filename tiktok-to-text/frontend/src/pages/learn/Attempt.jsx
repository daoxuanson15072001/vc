// Một lượt thi (docs/BA.md mục 17.7 — LRN-07, 08, 12):
// - người học: làm bài có đồng hồ (giờ tính ở server), tự lưu, hết giờ tự nộp; sau khi chốt: điểm + nhận xét +
//   đáp án, gửi phản hồi một lần;
// - người chấm (người giao / quản lý trực tiếp): đọc bài, xem điểm AI sơ bộ theo rubric, cho điểm, nhận xét bắt
//   buộc, lý do khi lệch điểm AI ≥ 20% thang điểm câu, chốt;
// - cấp trên khác / L&D: chỉ xem.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, usePageTitle } from '../../hooks'
import { useUrlState } from '../../urlState'
import { dateTime } from '../../format'
import { PageHeader } from '../../components/PageHeader'
import { Badge, ErrorBox, Loading } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { Markdown } from '../../components/markdown'
import './learn.css'
import './scr15-17.css'
import { QUESTION_KIND, scoreText } from './common'
import { answerText } from './grading/answerText'
import { GradeStandalone } from './grading/GradeForm'

export default function Attempt() {
  const { id } = useParams()
  const { data: a, error, reload, setData } = useFetch(() => api.attempt(id), [id])
  usePageTitle(a?.path_title ? `Bài thi — ${a.path_title}` : 'Bài thi')
  if (error) return <><Link className="crumb link" to="/learn">‹ Học tập của tôi</Link><ErrorBox>{error}</ErrorBox></>
  if (!a) return <Loading>Đang tải bài…</Loading>
  const crumbs = a.is_learner ? [{ label: 'Học tập của tôi', to: '/learn' }] : [{ label: 'Chấm bài', to: '/learn/grading' }]
  return (
    <>
      <PageHeader title={`${a.kind === 'exam' ? 'Bài thi' : 'Luyện tập'}${a.path_title ? `: ${a.path_title}` : ''}`} crumbs={crumbs}
        meta={a.finalized_at ? <Badge tone="good">Đã chốt điểm</Badge> : a.auto_submitted ? <Badge tone="warn">Hết giờ — tự nộp</Badge> : null}>
        <div className="meta">
          {!a.is_learner && <span>Người học: <b>{a.learner_name}</b></span>}
          <span>bắt đầu {dateTime(a.started_at)}</span>
          {a.submitted_at && <span>nộp {dateTime(a.submitted_at)}</span>}
          {a.auto_submitted && a.finalized_at && <Badge tone="warn">Hết giờ — tự nộp</Badge>}
        </div>
      </PageHeader>
      {a.is_learner && !a.submitted_at ? <Take a={a} onDone={setData} reload={reload} />
        : a.finalized_at ? <Result a={a} onChange={setData} />
          : a.is_learner ? <div className="card">Bài đã nộp{a.auto_submitted ? ' (hết giờ, hệ thống tự nộp phần đã lưu)' : ''}. Điểm và nhận xét hiện ở đây khi người chấm chốt.</div>
            : <GradeStandalone a={a} onDone={setData} />}
    </>
  )
}

// ---------------------------------------------------------------------------
// Làm bài
// ---------------------------------------------------------------------------

function Take({ a, onDone, reload }) {
  const [answers, setAnswers] = useState(a.answers || {})
  const [saved, setSaved] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [uq, setUrl] = useUrlState({ q: { type: 'number' } })
  // lệch đồng hồ máy người học so với server
  const skew = useRef(new Date(a.server_now).getTime() - Date.now())
  const deadline = a.deadline_at ? new Date(a.deadline_at).getTime() : null
  const [left, setLeft] = useState(deadline ? deadline - (Date.now() + skew.current) : null)
  const dirty = useRef(false)
  const submitting = useRef(false)
  // nhắc cho trình đọc màn hình / AI agent: chỉ ở mốc còn 5 phút và 1 phút (đồng hồ chính aria-live=off để khỏi đọc mỗi giây)
  const [notice, setNotice] = useState('')
  const warned = useRef(left == null ? {} : { 5: left <= 5 * 60000, 1: left <= 60000 })   // mốc đã qua lúc mở bài: không nhắc

  const submit = async (auto = false) => {
    if (submitting.current) return
    if (!auto) {
      const missing = a.paper.filter((p) => !answers[p.question_id] || answers[p.question_id].length === 0).length
      const ok = await confirmDialog(missing
        ? { title: `Còn ${missing} câu chưa trả lời. Vẫn nộp bài?`, body: 'Sau khi nộp không sửa được.', okLabel: a.kind === 'exam' ? 'Nộp bài thi' : 'Nộp bài' }
        : { title: 'Nộp bài? Sau khi nộp không sửa được.', okLabel: a.kind === 'exam' ? 'Nộp bài thi' : 'Nộp bài' })
      if (!ok) return
    }
    submitting.current = true
    setBusy(true)
    setErr(null)
    try { onDone(await api.submitAttempt(a.id, answers, auto)) } catch (e) { setErr(e.message); submitting.current = false; reload() } finally { setBusy(false) }
  }

  // đồng hồ; hết giờ -> tự nộp (server cũng tự nộp nếu trình duyệt đã đóng)
  useEffect(() => {
    if (!deadline) return
    const t = setInterval(() => {
      const l = deadline - (Date.now() + skew.current)
      setLeft(l)
      for (const m of [5, 1]) {
        if (l > 0 && l <= m * 60000 && !warned.current[m]) {
          warned.current = { ...warned.current, [m]: true }
          setNotice(`Còn ${m} phút làm bài. Hết giờ bài tự nộp.`)
        }
      }
      if (l <= 0) submit(true)
    }, 1000)
    return () => clearInterval(t)
  })

  // tự lưu 1 giây sau lần sửa cuối
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(async () => {
      try { await api.saveAnswers(a.id, answers); setSaved(new Date()) } catch (e) { setErr(e.message); reload() }
    }, 1000)
    return () => clearTimeout(t)
  }, [answers]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (qid, v) => { dirty.current = true; setAnswers({ ...answers, [qid]: v }) }
  const choose = (p, key, on) => {
    const cur = answers[p.question_id]
    set(p.question_id, p.kind === 'single' ? key : (on ? [...(cur || []), key] : (cur || []).filter((k) => k !== key)))
  }
  const mm = left == null ? null : Math.max(0, Math.floor(left / 1000))
  const answered = (p) => { const v = answers[p.question_id]; return !!v && v.length > 0 }
  const focusQuestion = (i) => {
    const el = document.getElementById(`lrn-take-q-${i + 1}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.querySelector('input, textarea')?.focus({ preventScroll: true })
  }
  const goTo = (i) => { setUrl({ q: i + 1 }); focusQuestion(i) }
  // ?q=<số câu>: mở lại đúng câu (dán link / tải lại trang) — chỉ cuộn một lần lúc vào bài
  useEffect(() => {
    const n = uq.q
    if (n >= 1 && n <= a.paper.length) requestAnimationFrame(() => focusQuestion(n - 1))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form className="stack" aria-label="Làm bài" onSubmit={(e) => { e.preventDefault(); submit(false) }}>
      <div className="card lrn-timer lt-bar">
        <span>{a.paper.length} câu · <span role="status" className="lt-saved" data-testid="exam-saved">{saved
          ? `Đã lưu lúc ${saved.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : 'Lưu tự động khi bạn trả lời'}</span></span>
        {mm != null && <b data-testid="exam-timer" role="timer" aria-live="off" aria-label={`Thời gian còn lại ${Math.floor(mm / 60)} phút ${mm % 60} giây`}
          className={mm < 60 ? 'tone-bad' : ''}>Còn {Math.floor(mm / 60)}:{String(mm % 60).padStart(2, '0')}</b>}
      </div>
      <div className="sr-only" aria-live="polite" data-testid="exam-timer-notice">{notice}</div>
      {a.paper.length > 1 && (
        <nav aria-label="Câu hỏi" className="lrn-qnav" data-testid="exam-qnav">
          {a.paper.map((p, i) => (
            <button key={p.question_id} type="button" className={`btn btn-ghost btn-sm ${answered(p) ? 'lrn-qnav-done' : ''}`}
              aria-label={`Câu ${i + 1}${answered(p) ? ' (đã trả lời)' : ' (chưa trả lời)'}`} title={`Tới câu ${i + 1}`}
              onClick={() => goTo(i)}>{i + 1}</button>
          ))}
        </nav>
      )}
      {a.paper.map((p, i) => (
        <fieldset key={p.question_id} id={`lrn-take-q-${i + 1}`} className="card lrn-q">
          <legend className="lrn-legend">
            <span className="strong">Câu {i + 1}. {p.stem}</span>
            <span className="meta"><span>{QUESTION_KIND[p.kind]}</span><span>{p.max}đ</span></span>
          </legend>
          {p.kind === 'essay' ? (
            <>
              {p.rubric.length > 0 && <div className="muted small">Tiêu chí: {p.rubric.map((c) => `${c.criterion} (${c.max}đ)`).join(' · ')}</div>}
              <textarea rows={5} aria-label={`Trả lời câu ${i + 1}`} value={answers[p.question_id] || ''} onChange={(e) => set(p.question_id, e.target.value)} />
            </>
          ) : (
            <ul className="list">
              {p.options.map((o) => {
                const given = answers[p.question_id]
                const picked = p.kind === 'single' ? given === o.key : (given || []).includes(o.key)
                return (
                  <li key={o.key}>
                    <label className="row lrn-choice">
                      <input type={p.kind === 'single' ? 'radio' : 'checkbox'} name={p.question_id} checked={!!picked}
                        onChange={(e) => choose(p, o.key, e.target.checked)} />
                      <span>{o.key.toUpperCase()}. {o.text}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </fieldset>
      ))}
      <ErrorBox>{err}</ErrorBox>
      <div className="actions"><button type="submit" className="btn btn-primary" disabled={busy} data-testid="attempt-submit">Nộp bài</button></div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Kết quả (sau khi chốt)
// ---------------------------------------------------------------------------

function Result({ a, onChange }) {
  const items = Object.fromEntries((a.items || []).map((i) => [i.question_id, i]))
  const sol = Object.fromEntries((a.solution || []).map((s) => [s.question_id, s]))
  const [text, setText] = useState('')
  const [err, setErr] = useState(null)
  const send = async (body) => {
    setErr(null)
    try { onChange(await api.appealAttempt(a.id, body)); setText('') } catch (e) { setErr(e.message) }
  }
  return (
    <section className="stack">
      <div className="card lrn-score">
        <div className="muted small">Điểm</div>
        <div className="stat-value" data-testid="final-score">{scoreText(a.final_score, a.max_score)}</div>
        {a.passed != null && (a.passed ? <Badge tone="good">Đạt</Badge> : <Badge tone="bad">Chưa đạt</Badge>)}
        {a.pass_score != null && <span className="muted small"> · đạt từ {a.pass_score}%</span>}
        {a.feedback && <div className="panel lt-notes"><b>Nhận xét của người chấm:</b><div data-testid="feedback"><Markdown text={a.feedback} /></div></div>}
      </div>
      {a.paper.map((p, i) => {
        const r = items[p.question_id]
        const s = sol[p.question_id]
        return (
          <div key={p.question_id} className="card lrn-q">
            <div className="row-between">
              <div className="strong">Câu {i + 1}. {p.stem}</div>
              <span className="meta">
                {r && <b>{scoreText(r.score, r.max)}</b>}
                {r?.is_correct === true && <Badge tone="good">Đúng</Badge>}
                {r?.is_correct === false && <Badge tone="bad">Sai</Badge>}
              </span>
            </div>
            {p.kind !== 'essay' && <ul className="list">{p.options.map((o) => <li key={o.key} className={s?.correct.includes(o.key) ? 'tone-good strong' : ''}>{o.key.toUpperCase()}. {o.text}{s?.correct.includes(o.key) ? ' ✓' : ''}</li>)}</ul>}
            <div className="small"><b>Bạn trả lời:</b> {answerText(p, a.answers?.[p.question_id])}</div>
            {s && (s.explanation || s.model_answer) && (
              <div className="panel small">
                {s.explanation && <div><b>Giải thích:</b> {s.explanation}</div>}
                {s.model_answer && <div><b>Đáp án mẫu:</b> <Markdown text={s.model_answer} /></div>}
              </div>
            )}
          </div>
        )
      })}
      {a.kind === 'exam' && (
        <div className="card">
          <h3>Phản hồi về kết quả</h3>
          {a.appeal ? (
            <>
              <p><b>Phản hồi của người học</b> ({dateTime(a.appeal.at)}): {a.appeal.text}</p>
              {a.appeal.answer ? <p><b>Người chấm trả lời:</b> {a.appeal.answer}</p> : <p className="muted">Chờ người chấm trả lời.</p>}
              {a.can_answer_appeal && (
                <div className="row">
                  <input className="grow" aria-label="Trả lời phản hồi" value={text} onChange={(e) => setText(e.target.value)} />
                  <button className="btn" disabled={!text.trim()} onClick={() => send({ answer: text })}>Trả lời</button>
                </div>
              )}
            </>
          ) : a.is_learner ? (
            <>
              <p className="muted small">Không đồng ý với kết quả? Bạn được gửi phản hồi một lần.</p>
              <div className="row">
                <input className="grow" aria-label="Phản hồi" value={text} onChange={(e) => setText(e.target.value)} />
                <button className="btn" disabled={!text.trim()} onClick={() => send({ text })}>Gửi phản hồi</button>
              </div>
            </>
          ) : <p className="muted">Người học chưa gửi phản hồi.</p>}
          <ErrorBox>{err}</ErrorBox>
        </div>
      )}
    </section>
  )
}
