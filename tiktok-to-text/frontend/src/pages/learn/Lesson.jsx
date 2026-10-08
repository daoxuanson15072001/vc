// Bài học (SCR-16 Bài học, TPL-E; docs/BA.md mục 17 — LRN-01, LRN-09): đọc nội dung thẻ đúng phiên bản đã ghim +
// diễn giải, rồi luyện tập: làm bài -> nộp -> xem điểm, đáp án, giải thích -> làm lại. h1 = tên bài, breadcrumb
// Học tập › Thư viện bài học › <tên>; chế độ luyện tập ở ?practice=1 (tải lại không mất).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { CARD_TYPE, dateTime } from '../../format'
import { Badge, Empty, ErrorBox, Loading } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { Markdown } from '../../components/markdown'
import { PageHeader } from '../../components/PageHeader'
import { StatusBadge } from '../../components/StatusBadge'
import { toast } from '../../components/toast'
import { useUrlState } from '../../urlState'
import './learn.css'
import { LessonMaterials } from './library/MaterialsForm'
import { PracticalPanel } from './library/PracticalPanel'
import { CLASSIFICATION, QUESTION_KIND, scoreText } from './common'

const CRUMBS = [{ label: 'Học tập' }, { label: 'Thư viện bài học', to: '/learn/library' }]
const URL_STATE = { practice: { type: 'bool' } }

// Đưa tiêu điểm (và khung nhìn) về h1 của trang — thay window.scrollTo khi vào / ra chế độ luyện tập
function focusTitle() {
  const h1 = document.querySelector('#main h1') || document.querySelector('h1')
  if (!h1) return
  if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1')
  h1.focus()
}

export default function Lesson() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { data: lesson, error, reload } = useFetch(() => api.lesson(id), [id])
  const [st, setUrl] = useUrlState(URL_STATE)
  const [attempt, setAttempt] = useState(null)
  const starting = useRef(false)
  const canPractice = !!lesson && lesson.practice_count > 0

  // Chế độ luyện tập theo ?practice=1 (tải lại trang không mất): vào thì mở lượt (máy chủ trả lượt dở nếu còn)
  const start = useCallback(async () => {
    if (starting.current) return
    starting.current = true
    try {
      setAttempt(await api.startPractice(id))
    } catch (e) {
      toast(`Không mở được luyện tập: ${e.message}`, { tone: 'error' })
      setUrl({ practice: false })
    } finally { starting.current = false }
  }, [id, setUrl])

  useEffect(() => {
    if (!st.practice) { setAttempt(null); return }
    if (canPractice && !attempt) start()
  }, [st.practice, canPractice, attempt, start])

  // Vào / ra luyện tập: tiêu điểm về tên bài (đầu trang)
  const attemptId = attempt?.id
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    focusTitle()
  }, [attemptId])

  const openPractice = () => setUrl({ practice: true }, { push: true })
  const closePractice = () => { setUrl({ practice: false }, { push: true }); reload() }

  // Lượt luyện tập chưa nộp gần nhất (bấm “Luyện tập” sẽ làm tiếp lượt này — QA B8)
  const pending = lesson?.my_attempts?.find((a) => !a.submitted_at)

  if (error) return <><PageHeader title="Không mở được bài học" crumbs={CRUMBS} /><ErrorBox onRetry={reload}>{error}</ErrorBox></>
  if (!lesson) return <Loading>Đang tải bài học…</Loading>

  const practicing = st.practice && canPractice
  return (
    <>
      <PageHeader
        title={lesson.title}
        crumbs={CRUMBS}
        meta={<StatusBadge kind="lesson" status={lesson.status} testId="lesson-status" />}
        actions={lesson.can_copy || (lesson.can_edit && lesson.status === 'draft') || (!practicing && canPractice) ? (
          <>
            {lesson.can_edit && lesson.status === 'draft' && (
              <Link className="ui-btn" to={`/learn/lessons/${lesson.id}/edit`} data-testid="lesson-edit-open">Sửa bài học</Link>
            )}
            {lesson.can_copy && <button type="button" className="ui-btn" data-testid="lesson-copy" onClick={async () => { try { const copied = await api.copyLesson(id); navigate(`/learn/lessons/${copied.id}/edit`) } catch(e) { toast(e.message, { tone: 'bad' }) } }}>Tạo phiên bản mới</button>}
            {!practicing && canPractice && (
              <button type="button" className="ui-btn ui-btn-primary" onClick={openPractice} data-testid="lesson-practice-start">
                {pending ? 'Làm tiếp luyện tập' : `Luyện tập (${lesson.practice_count} câu)`}
              </button>
            )}
          </>
        ) : null}
      >
        <div className="meta">
          <Badge tone="info">{CLASSIFICATION[lesson.classification] || lesson.classification}</Badge>
          <span>{lesson.items.length} thẻ</span>
          <span>{lesson.space_name}</span>
          <span>soạn: {lesson.created_by_name}</span>
          {lesson.published_at && <span>phát hành {dateTime(lesson.published_at)}</span>}
        </div>
      </PageHeader>

      {practicing ? (
        attempt
          ? <Practice key={attempt.id} attempt={attempt} onRetry={() => { setAttempt(null); start() }} onClose={closePractice} />
          : <Loading>Đang mở lượt luyện tập…</Loading>
      ) : (
        <article className="stack" aria-label={`Nội dung bài học: ${lesson.title}`} data-testid="lesson-content">
          {lesson.objectives.length > 0 && (
            <section className="card">
              <h2 className="lrn-h">Mục tiêu</h2>
              <ul>{lesson.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </section>
          )}
          {lesson.narrative && <section className="card"><Markdown text={lesson.narrative} /></section>}
          <LessonMaterials materials={lesson.materials || []} renderCard={id => <PinnedCard card={lesson.items.find(c => c.card_id === id) || { unavailable: true }} index={lesson.items.findIndex(c => c.card_id === id) + 1} />} />
          {lesson.subject_id && <PracticalPanel subjectId={lesson.subject_id} lessonId={lesson.id} canAuthor={lesson.can_edit} />}
          {lesson.items.filter(c => !(lesson.materials || []).some(m => m.card_id === c.card_id)).map((c, i) => <PinnedCard key={`${c.card_id}-${i}`} card={c} index={i + 1} />)}
          {lesson.practice_count === 0 && <Empty>Bài học chưa có câu luyện tập đã duyệt.</Empty>}
          {lesson.my_attempts.length > 0 && (
            <section className="card">
              <h2 className="lrn-h">Các lần luyện tập của tôi</h2>
              <ul className="list">
                {lesson.my_attempts.map((a) => (
                  <li key={a.id} className="list-row">
                    <span className="grow">{dateTime(a.started_at)}</span>
                    {a.submitted_at ? <b>{scoreText(a.final_score, a.auto_max)}</b> : (
                      <>
                        <span className="muted small">chưa nộp</span>
                        {a.id === pending?.id && <button type="button" className="link small link-gap" onClick={openPractice}>Làm tiếp</button>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
    </>
  )
}

function PinnedCard({ card, index }) {
  if (card.unavailable) {
    return <section className="card muted">Thẻ {index}: bạn không có quyền xem thẻ này (hoặc thẻ đã bị xoá).</section>
  }
  return (
    <section className="card lrn-card">
      <div className="card-head">
        <div>
          <div className="muted small">Thẻ {index} · {CARD_TYPE[card.type] || card.type}</div>
          <h2 className="lrn-h lrn-card-title">{card.title}</h2>
        </div>
        <div className="meta">
          <Badge tone="muted">bản {card.rev}</Badge>
          {card.outdated && <Badge tone="warn" >thẻ đã có bản {card.current_rev}</Badge>}
          {card.pinned_rev_missing && <span title="Chưa có lịch sử phiên bản cho thẻ này — đang hiện nội dung hiện tại">nội dung hiện tại</span>}
          <Link className="link small" to={`/wiki?card=${card.card_id}`}>Mở trong VCWIKI</Link>
        </div>
      </div>
      {card.summary && <p className="strong">{card.summary}</p>}
      {card.body && <div className="card-body"><Markdown text={card.body} /></div>}
      {card.key_points?.length > 0 && <ul>{card.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>}
      {card.when_to_use && <p><b>Khi nào dùng:</b> {card.when_to_use}</p>}
      {card.example && <div className="panel"><b>Ví dụ:</b> <Markdown text={card.example} /></div>}
    </section>
  )
}

function Practice({ attempt: initial, onRetry, onClose }) {
  const [a, setA] = useState(initial)
  const [answers, setAnswers] = useState(initial.answers || {})
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const done = !!a.finalized_at
  const result = done ? Object.fromEntries(a.items.map((i) => [i.question_id, i])) : {}
  const sol = done ? Object.fromEntries(a.solution.map((s) => [s.question_id, s])) : {}

  const choose = (p, key, on) => {
    if (done) return
    const cur = answers[p.question_id]
    const next = p.kind === 'single' ? key : (on ? [...(cur || []), key] : (cur || []).filter((k) => k !== key))
    setAnswers({ ...answers, [p.question_id]: next })
  }
  // Thoát giữa chừng: lưu nháp câu trả lời lên máy chủ, lần sau bấm “Luyện tập” làm tiếp đúng lượt này (QA B8)
  const pause = async () => {
    setErr(null)
    setBusy(true)
    try {
      await api.saveAnswers(a.id, answers)
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const submit = async () => {
    const missing = a.paper.filter((p) => !answers[p.question_id] || answers[p.question_id].length === 0).length
    if (missing && !(await confirmDialog({ title: `Còn ${missing} câu chưa trả lời. Vẫn nộp bài?`, body: 'Câu bỏ trống tính 0 điểm; bạn làm lại được sau khi nộp.', okLabel: 'Nộp bài' }))) return
    setErr(null)
    setBusy(true)
    try { setA(await api.submitAttempt(a.id, answers)) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const goTo = (i) => {
    const el = document.getElementById(`lrn-practice-q-${i + 1}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.querySelector('input, textarea')?.focus({ preventScroll: true })
  }
  const answered = (p) => { const v = answers[p.question_id]; return !!v && v.length > 0 }
  return (
    <section className="stack lrn-practice" aria-label="Luyện tập">
      {a.resumed && !done && <p className="muted small">Đang làm tiếp lượt luyện tập chưa nộp (bắt đầu {dateTime(a.started_at)}).</p>}
      {done && (
        <div className="card lrn-score">
          <div className="row-between">
            <div>
              <div className="muted small">Điểm trắc nghiệm</div>
              <div className="stat-value" data-testid="practice-score">{scoreText(a.final_score, a.auto_max)}</div>
              {a.items.some((i) => i.kind === 'essay') && <div className="muted small">Câu tự luận không chấm điểm trong luyện tập — so với đáp án mẫu và rubric bên dưới.</div>}
            </div>
            <div className="actions">
              <button className="btn btn-primary" onClick={onRetry}>↻ Làm lại</button>
              <button className="btn" onClick={onClose}>Quay lại bài học</button>
            </div>
          </div>
        </div>
      )}
      {a.paper.length > 1 && (
        <nav aria-label="Câu hỏi" className="lrn-qnav" data-testid="practice-qnav">
          {a.paper.map((p, i) => (
            <button key={p.question_id} type="button" className={`btn btn-ghost btn-sm ${answered(p) ? 'lrn-qnav-done' : ''}`}
              aria-label={`Câu ${i + 1}${answered(p) ? ' (đã trả lời)' : ' (chưa trả lời)'}`} title={`Tới câu ${i + 1}`}
              onClick={() => goTo(i)}>{i + 1}</button>
          ))}
        </nav>
      )}
      {a.paper.map((p, i) => {
        const r = result[p.question_id]
        const s = sol[p.question_id]
        const given = answers[p.question_id]
        return (
          <fieldset key={p.question_id} id={`lrn-practice-q-${i + 1}`} className="card lrn-q">
            <legend className="lrn-legend">
              <span className="strong">Câu {i + 1}. {p.stem}</span>
              <span className="meta">
                <span>{QUESTION_KIND[p.kind]}</span>
                {r && r.is_correct === true && <Badge tone="good">Đúng</Badge>}
                {r && r.is_correct === false && <Badge tone="bad">Sai</Badge>}
              </span>
            </legend>
            {p.kind === 'essay' ? (
              <>
                {p.rubric.length > 0 && <div className="muted small">Tiêu chí: {p.rubric.map((c) => `${c.criterion} (${c.max}đ)`).join(' · ')}</div>}
                <textarea rows={4} aria-label={`Trả lời câu ${i + 1}`} value={given || ''} disabled={done}
                  onChange={(e) => setAnswers({ ...answers, [p.question_id]: e.target.value })} />
              </>
            ) : (
              <ul className="list">
                {p.options.map((o) => {
                  const picked = p.kind === 'single' ? given === o.key : (given || []).includes(o.key)
                  const right = s?.correct.includes(o.key)
                  return (
                    <li key={o.key}>
                      <label className={`row lrn-choice ${done && right ? 'tone-good strong' : ''}`}>
                        <input type={p.kind === 'single' ? 'radio' : 'checkbox'} name={p.question_id} checked={!!picked} disabled={done}
                          onChange={(e) => choose(p, o.key, e.target.checked)} />
                        <span>{o.key.toUpperCase()}. {o.text}{done && right ? ' ✓' : ''}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {s && (
              <div className="panel small">
                {s.explanation && <div><b>Giải thích:</b> {s.explanation}</div>}
                {s.model_answer && <div><b>Đáp án mẫu:</b> <Markdown text={s.model_answer} /></div>}
                {s.rubric?.length > 0 && <ul>{s.rubric.map((c, j) => <li key={j}>{c.criterion} — {c.max}đ{c.descriptor ? `: ${c.descriptor}` : ''}</li>)}</ul>}
              </div>
            )}
          </fieldset>
        )
      })}
      <ErrorBox>{err}</ErrorBox>
      {!done && (
        <div className="actions">
          <button className="btn btn-primary" disabled={busy} onClick={submit}>Nộp bài</button>
          <button className="btn btn-ghost" disabled={busy} onClick={pause} title="Lưu câu trả lời đã chọn, lần sau làm tiếp">Lưu nháp, làm tiếp sau</button>
        </div>
      )}
    </section>
  )
}
