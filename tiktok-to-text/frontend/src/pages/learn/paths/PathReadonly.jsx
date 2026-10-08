// Lộ trình đã phát hành / của người khác — chỉ xem (không có form): tab *Nội dung* và *Đề thi* dạng chữ.
import { Link } from 'react-router-dom'
import { date } from '../../../format'
import { Badge } from '../../../components/ui'
import { QUESTION_KIND } from '../common'
import { unitOf } from './PathEditor'
import { useFetch } from '../../../hooks'
import { api } from '../../../api'

export function ContentView({ p }) {
  if (p.kind === 'courses') return <CourseContent p={p} />
  const req = new Set(p.required_items)
  return (
    <div className="lrn-form">
      {p.ai?.prompt && <div className="panel small lrn-prompt"><b>Prompt thiết kế:</b>{'\n'}{p.ai.prompt}</div>}
      {p.description && <p>{p.description}</p>}
      {p.modules.length === 0 && <p className="muted">Chưa có {unitOf(p.period).toLowerCase()} nào.</p>}
      {p.modules.map((m) => (
        <div key={m.week} className="lrn-week">
          <h2 className="lrn-sec">{unitOf(p.period)} {m.week}{m.title ? ` — ${m.title}` : ''}{m.due_at ? <span className="muted small"> · hạn {date(m.due_at)}</span> : null}</h2>
          <ul className="list">{m.lessons.map((l) => <li key={l.id}><Link className="link" to={`/learn/lessons/${l.id}`}>{l.title}</Link>{req.has(l.id) && <> <Badge tone="info">bắt buộc</Badge></>}</li>)}</ul>
        </div>
      ))}
    </div>
  )
}

function CourseContent({ p }) {
  return <div className="lrn-form">
    {p.description && <p>{p.description}</p>}
    {(p.courses || []).map((course, i) => <CourseContents key={`${course.category}:${i}`} course={course} index={i} />)}
  </div>
}

function CourseContents({ course, index }) {
  const { data, error } = useFetch(() => api.course(course.category), [course.category])
  if (error) return <div className="panel"><h2>{index + 1}. {course.category}</h2><p>{error}</p></div>
  const all = data?.lessons || []
  const rows = course.lesson_ids ? course.lesson_ids.map((id) => all.find((x) => x.id === id)).filter(Boolean) : all
  return <section className="panel lrn-week">
    <h2>{index + 1}. {data?.name || course.category}</h2>
    <p className="muted small">{course.days} ngày · {course.required ? 'bắt buộc' : 'không bắt buộc'}</p>
    <ol className="list">{rows.map((l, i) => <li key={l.id}><span>{i + 1}. </span><Link className="link" to={`/learn/lessons/${l.id}`}>{l.title}</Link></li>)}</ol>
    {data?.exam && <p className="small">Thi sau khoá: {data.exam.blueprint.reduce((n, r) => n + r.count, 0)} câu · {data.exam.duration_min} phút · đạt {data.exam.pass_score}%</p>}
  </section>
}

export function ExamView({ p }) {
  if (!p.exam?.blueprint.length) return <p className="muted">Không có bài thi.</p>
  return (
    <div className="panel small">
      <b>Bài thi:</b> {p.exam.blueprint.reduce((t, r) => t + r.count, 0)} câu · {p.exam.duration_min} phút · đạt từ {p.exam.pass_score}% · {p.exam.attempts} lượt
      <ul>{p.exam.blueprint.map((r, i) => <li key={i}>{r.count} câu · {r.category || 'mọi lĩnh vực'} · {r.difficulty ? `độ khó ${r.difficulty}` : 'mọi độ khó'} · {QUESTION_KIND[r.kind] || 'mọi loại'}</li>)}</ul>
    </div>
  )
}
