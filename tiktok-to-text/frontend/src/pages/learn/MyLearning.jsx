// Học tập của tôi (docs/BA.md mục 17 — LRN-05…07, LRN-14; DESIGN V.7 SCR-15, mẫu TPL-D).
// PageHeader + Tabs kind="panel" ?tab= Đang học (n) · Đã xong · Tự ghi danh. Mỗi thẻ bài giao: tên lộ trình, hạn bằng
// chữ ("còn 3 ngày", màu --warn khi ≤ 3 ngày), thanh tiến độ role=progressbar + chữ, MỘT nút chính là việc kế tiếp
// (Tiếp tục bài N / Vào thi …), liên kết phụ (Xem kết quả). Danh mục khoá mở: nút thường "Ghi danh", phản hồi bằng toast.
// Lần đầu mở (F2 — yêu cầu 6ab889cd…9949de): chưa có khoá nào mà có khoá mở tự ghi danh (gồm khoá mẫu) → mở sẵn tab
// Tự ghi danh; người soạn thấy khoá mẫu đang chờ duyệt gì — không để màn trống trơn. Tính thuần: due.js.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, usePageTitle } from '../../hooks'
import { useUrlState } from '../../urlState'
import { date, dateTime } from '../../format'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { StatusBadge } from '../../components/StatusBadge'
import { Empty, ErrorBox, Loading } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { toast } from '../../components/toast'
import './learn.css'
import './scr15-17.css'
import { scoreText } from './common'
import { dueInfo, nextAction } from './due'

const TABS = ['learning', 'done', 'enroll']
const SCHEMA = { tab: { default: '', values: TABS } }

import { LearningRoutes } from './library/LearningRoutes'

export default function MyLearning() {
  usePageTitle('Học tập của tôi')
  const [st, set] = useUrlState(SCHEMA)
  const { data, error, reload } = useFetch(() => api.myLearning(), [])
  const { data: cat, error: catErr, reload: reloadCat } = useFetch(() => api.learnCatalog(), [])
  const refresh = () => { reload(); reloadCat() }

  const all = data?.months || []
  const learning = all.map((m) => ({ ...m, items: m.items.filter((a) => a.status !== 'completed') })).filter((m) => m.items.length)
  const done = all.map((m) => ({ ...m, items: m.items.filter((a) => a.status === 'completed') })).filter((m) => m.items.length)
  const learningCount = learning.reduce((n, m) => n + m.items.length, 0)
  const open = (cat?.items || []).filter((c) => !c.enrolled)
  const ready = !!data && !!cat
  // chưa chọn tab: chưa có khoá đang học mà có khoá mở → mở sẵn Tự ghi danh; còn lại Đang học
  const tab = st.tab || (ready && learningCount === 0 && open.length > 0 ? 'enroll' : 'learning')
  const goTab = (id) => set({ tab: id }, { push: true })

  return (
    <>
      <PageHeader title="Học tập của tôi"
        description="Khoá được giao và khoá bạn tự ghi danh. Đọc bài, luyện tập, rồi làm bài thi cuối khoá trước hạn." />
      <LearningRoutes />
      <ErrorBox>{error || catErr}</ErrorBox>
      {!ready && !(error || catErr) && <Loading />}
      {ready && (
        <>
          {(cat.samples || []).map((s) => <SamplePending key={s.sample_key} s={s} />)}
          <Tabs kind="panel" label="Nhóm khoá học" value={tab} onChange={goTab} testId="learn-tabs"
            items={[
              {
                id: 'learning', label: 'Đang học', count: learningCount, testId: 'learn-tab-learning',
                content: <MonthGroups groups={learning} empty={(
                  <Empty>
                    Bạn chưa có khoá nào đang học. Khi quản lý giao lộ trình hoặc L&amp;D mở khoá tự ghi danh, khoá sẽ hiện ở đây.
                    {' '}Trong lúc chờ, bạn có thể đọc bài học trong <Link className="link" to="/learn/library">Thư viện bài học</Link>.
                  </Empty>
                )} />,
              },
              {
                id: 'done', label: 'Đã xong', testId: 'learn-tab-done',
                content: <MonthGroups groups={done} empty={<Empty>Chưa có khoá nào hoàn thành.</Empty>} />,
              },
              {
                id: 'enroll', label: 'Tự ghi danh', testId: 'learn-tab-enroll',
                content: <Catalog items={open} onEnrolled={refresh} onOpenLearning={() => goTab('learning')} />,
              },
            ]} />
        </>
      )}
    </>
  )
}

function MonthGroups({ groups, empty }) {
  if (!groups.length) return empty
  return groups.map((m) => (
    <section key={m.key} className="lm-section" aria-label={m.label}>
      <h2>{m.label}</h2>
      <div className="lm-list">
        {m.items.map((a) => <AssignmentCard key={a.id} a={a} />)}
      </div>
    </section>
  ))
}

const SAMPLE_STAGE = {
  cards: 'chờ duyệt thẻ',
  build: 'chưa dựng bài học (chạy seed_sample_course.py)',
  questions: 'chờ duyệt câu hỏi',
  publish: 'chưa phát hành (chạy lại seed_sample_course.py)',
  error: 'lỗi dữ liệu thẻ (chạy seed_sample_course.py --dry-run để xem)',
}

function SamplePending({ s }) {
  return (
    <div className="card lm-sample" data-testid="sample-pending">
      <div>
        <b>Khoá mẫu “{s.title}”</b> <span className="ui-badge" data-tone="warn">{SAMPLE_STAGE[s.stage] || s.stage}</span>
        <div className="muted small">
          Khoá mẫu chờ duyệt {s.cards_pending} thẻ, {s.questions_draft} câu
          {s.questions_total ? ` (đã sinh ${s.questions_total} câu)` : ''}. Chỉ người soạn / L&amp;D thấy khung này.
        </div>
      </div>
      <div className="lm-sample-btns">
        {s.review_link && <Link className="ui-btn ui-btn-primary" to={s.review_link}>Duyệt {s.cards_pending} thẻ</Link>}
        {s.questions_link && <Link className="ui-btn ui-btn-primary" to={s.questions_link}>Duyệt {s.questions_draft} câu hỏi</Link>}
      </div>
    </div>
  )
}

function Catalog({ items, onEnrolled, onOpenLearning }) {
  const [busy, setBusy] = useState(null)
  const enroll = async (c) => {
    setBusy(c.id)
    try {
      await api.enrollPath(c.id)
      toast(`Đã ghi danh: ${c.title}`, { action: { label: 'Mở Đang học', onClick: onOpenLearning } })
      onEnrolled()
    } catch (e) { toast(`Không ghi danh được: ${e.message}`, { tone: 'error' }) } finally { setBusy(null) }
  }
  if (!items.length) return <Empty>Hiện không có khoá mở nào để tự ghi danh.</Empty>
  return (
    <section className="lm-section" aria-label="Khoá mở tự ghi danh">
      <div className="lm-list">
        {items.map((c) => (
          <div key={c.id} className="card lm-card" data-testid="catalog-item" data-id={c.id}>
            <div className="lm-head">
              <div>
                <h3 className="lm-title">{c.title}</h3>
                <div className="lm-meta">
                  {c.is_sample && <span className="ui-badge" data-tone="info">Khoá mẫu</span>}
                  <span>{c.weeks} tuần · {c.lesson_count} bài</span>
                  {c.hours_per_week && <span>~{c.hours_per_week} giờ/tuần</span>}
                  {c.exam && <span>thi {c.exam.question_count} câu · {c.exam.duration_min} phút · đạt từ {c.exam.pass_score}%</span>}
                </div>
              </div>
              <button type="button" className="ui-btn" disabled={busy === c.id} aria-label={`Ghi danh: ${c.title}`}
                onClick={() => enroll(c)}>Ghi danh</button>
            </div>
            {c.description && <p className="lm-desc">{c.description}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function AssignmentCard({ a }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const pct = a.lesson_total ? Math.round((a.lesson_done / a.lesson_total) * 100) : 0
  const ex = a.exam
  const cur = ex?.attempt
  const due = a.status === 'completed' ? null : dueInfo(a.due_at)
  if (a.kind === 'courses') return <CourseAssignmentCard a={a} due={due} />
  const { primary, extra } = nextAction(a)

  const start = async () => {
    if (!cur && !(await confirmDialog({ title: `Bắt đầu bài thi? Bạn có ${ex.duration_min} phút, hết giờ bài tự nộp.`, body: a.title, okLabel: 'Bắt đầu thi' }))) return
    setBusy(true)
    try {
      const att = await api.startExam(a.id)
      navigate(`/learn/attempts/${att.id}`)
    } catch (e) { toast(`Không vào thi được: ${e.message}`, { tone: 'error' }) } finally { setBusy(false) }
  }

  // Một nút chính; phần phụ là nút thường / liên kết
  const btn = (act, main) => {
    const cls = `ui-btn${main ? ' ui-btn-primary' : ''}`
    if (act.kind === 'lesson') {
      return <Link key="lesson" className={cls} to={`/learn/lessons/${a.next_lesson_id}`}>{act.started ? `Tiếp tục bài ${act.no}` : 'Bắt đầu'}</Link>
    }
    if (act.kind === 'resume-exam') return <button key="resume" type="button" className={cls} disabled={busy} onClick={start}>Tiếp tục làm bài thi</button>
    if (act.kind === 'exam') return <button key="exam" type="button" className={cls} disabled={busy} onClick={start}>Vào thi</button>
    return <Link key="result" className="link" to={`/learn/attempts/${cur.id}`}>{act.done ? 'Xem kết quả' : 'Xem bài đã nộp'}</Link>
  }

  return (
    <article className="card lm-card" data-testid="assignment" data-id={a.id} data-status={a.status} aria-label={a.title}>
      <div className="lm-head">
        <div>
          <h3 className="lm-title">{a.title}</h3>
          <div className="lm-meta">
            {a.is_sample ? <span className="ui-badge" data-tone="info">Khoá mẫu</span> : <span className="ui-badge">Được giao</span>}
            <StatusBadge kind="learnAssign" status={a.status} />
            {due && <span className="lm-due" data-tone={due.tone}>Hạn {date(a.due_at)} — {due.text}</span>}
            {!due && a.due_at && <span>hạn {date(a.due_at)}</span>}
            {a.weeks > 0 && a.period !== 'year' && <span>{a.weeks} tuần · {a.lesson_total} bài</span>}
            {a.self_enrolled ? <span>tự ghi danh</span> : a.assigned_by_name && <span>giao bởi {a.assigned_by_name}</span>}
          </div>
        </div>
      </div>
      <div className="lm-progress">
        <div className="progress" role="progressbar" aria-label={`Tiến độ bài học: ${a.title}`} aria-valuemin={0}
          aria-valuemax={a.lesson_total || 100} aria-valuenow={a.lesson_done} aria-valuetext={`${a.lesson_done}/${a.lesson_total} bài học`}>
          <div className="progress-bar" style={{ width: `${pct}%` }} />
        </div>
        <span className="lm-progress-text">Bài học {a.lesson_done}/{a.lesson_total}</span>
      </div>
      {(primary || extra.length > 0) && (
        <div className="lm-actions">
          {primary && btn(primary, true)}
          {extra.map((x) => btn(x, false))}
        </div>
      )}
      {ex && cur?.submitted_at && !cur.finalized_at && <div className="lm-result">Đã nộp {dateTime(cur.submitted_at)} — chờ người chấm chốt điểm.</div>}
      {ex && cur?.finalized_at && (
        <div className="lm-result">
          Kết quả: <b data-testid="exam-score">{scoreText(cur.final_score, cur.max_score)}</b>{' '}
          <StatusBadge kind="learnPass" status={cur.passed ? 'pass' : 'fail'} />
        </div>
      )}
      {ex && <div className="muted small">Bài thi cuối kỳ: {ex.question_count} câu · {ex.duration_min} phút · đạt từ {ex.pass_score}% · lượt thi {ex.attempts_used}/{ex.attempts_allowed}</div>}
      {a.description && <p className="lm-desc">{a.description}</p>}
      {a.modules.map((m) => (
        <div key={m.week} className="lm-week">
          <div className="small strong">{a.period === 'year' ? 'Tháng' : 'Tuần'} {m.week}{m.title ? ` — ${m.title}` : ''}{m.due_at ? <span className="muted"> · hạn {date(m.due_at)}</span> : null}</div>
          <ul>
            {m.lessons.map((l) => (
              <li key={l.id} className="lm-lesson">
                <span className={l.done ? 'lm-done' : 'muted'} aria-hidden="true">{l.done ? '✓' : '○'}</span>
                <Link className="link" to={`/learn/lessons/${l.id}`}>{l.title}</Link>
                <span className="sr-only">{l.done ? '(đã xong)' : '(chưa xong)'}</span>
                {l.required && <span className="ui-badge" data-tone="info">bắt buộc</span>}
                {l.practice_count > 0 && !l.done && <span className="muted small">luyện tập {l.practice_count} câu để hoàn thành</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </article>
  )
}

function CourseAssignmentCard({ a, due }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const pct = a.lesson_total ? Math.round(a.lesson_done / a.lesson_total * 100) : 0
  const startExam = async (course) => {
    if (!(await confirmDialog({ title: `Bắt đầu thi khoá ${course.category}?`, body: a.title, okLabel: 'Bắt đầu thi' }))) return
    setBusy(true)
    try { const att = await api.startCourseExam(course.category, a.id); navigate(`/learn/attempts/${att.id}`) }
    catch (e) { toast(`Không vào thi được: ${e.message}`, { tone: 'error' }) } finally { setBusy(false) }
  }
  return <article className="card lm-card" data-testid="assignment" data-id={a.id} data-status={a.status} aria-label={a.title}>
    <div className="lm-head"><div><h3 className="lm-title">{a.title}</h3><div className="lm-meta"><span className="ui-badge">Lộ trình chuỗi khoá</span><StatusBadge kind="learnAssign" status={a.status} />
      {due && <span className="lm-due" data-tone={due.tone}>Hạn {date(a.due_at)} — {due.text}</span>}{a.assigned_by_name && <span>giao bởi {a.assigned_by_name}</span>}</div></div></div>
    <div className="lm-progress"><div className="progress" role="progressbar" aria-label={`Tiến độ bài học: ${a.title}`} aria-valuemin="0" aria-valuemax={a.lesson_total || 100} aria-valuenow={a.lesson_done} aria-valuetext={`${a.lesson_done}/${a.lesson_total} bài học`}><div className="progress-bar" style={{ width: `${pct}%` }} /></div><span className="lm-progress-text">Bài học {a.lesson_done}/{a.lesson_total}</span></div>
    {a.next_lesson_id && <Link className="ui-btn ui-btn-primary" to={`/learn/lessons/${a.next_lesson_id}`}>Tiếp tục bài học</Link>}
    {a.description && <p className="lm-desc">{a.description}</p>}
    {(a.courses || []).map((c, i) => <section key={`${c.category}-${i}`} className="lm-week" data-testid={`assignment-course-${i + 1}`}>
      <div className="small strong">{i + 1}. {c.category} · {c.days} ngày{c.due_at ? ` · hạn ${date(c.due_at)}` : ''} {!c.unlocked && ' · đang khoá'}</div>
      <ol>{c.lessons.map((l, j) => <li key={l.id} className="lm-lesson"><span aria-hidden="true">{l.done ? '✓' : l.unlocked ? '○' : '🔒'}</span>{l.unlocked ? <Link className="link" to={`/learn/lessons/${l.id}`}>{l.title}</Link> : <span>{l.title}</span>}</li>)}</ol>
      {c.exam && <div className="row row-wrap"><span className="muted small">Thi khoá · đạt {c.exam.pass_score}% · lượt {c.exam.attempts_used}/{c.exam.attempts_allowed}</span>
        {c.exam.attempt?.finalized_at ? <Link className="link" to={`/learn/attempts/${c.exam.attempt.id}`}>{c.exam.attempt.passed ? 'Đã đạt — xem kết quả' : 'Chưa đạt — xem kết quả'}</Link>
          : c.unlocked && c.lessons.every(x => x.done) && <button type="button" className="ui-btn" disabled={busy || c.exam.attempts_used >= c.exam.attempts_allowed} onClick={() => startExam(c)}>{c.exam.attempt?.submitted_at ? 'Bài thi đang chờ chấm' : 'Vào thi khoá'}</button>}
      </div>}
    </section>)}
  </article>
}
