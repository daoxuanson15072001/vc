// Tab *Đã giao (n)*: tiến độ người học của lộ trình (LRN-05 / 06) — hạn, trạng thái, điểm bài thi.
import { Link } from 'react-router-dom'
import { date } from '../../../format'
import { DataTable } from '../../../components/DataTable'
import { ASSIGNMENT_STATUS, DueBadge, scoreText, StatusBadge } from '../common'

export default function PathAssigned({ p }) {
  return (
    <DataTable
      caption="Tiến độ người học của lộ trình"
      testId="path-assigned"
      rows={p.assignments || []}
      rowName={(x) => x.learner_name}
      getStatus={(x) => x.status}
      rowTestId="assignment-row"
      empty="Chưa giao cho ai."
      columns={[
        { key: 'learner_name', header: 'Người học', title: true },
        { key: 'due', header: 'Hạn', render: (x) => <>{date(x.due_at)} <DueBadge state={x.due_state} /></> },
        { key: 'status', header: 'Trạng thái', render: (x) => <StatusBadge map={ASSIGNMENT_STATUS} status={x.status} /> },
        { key: 'exam', header: 'Bài thi', render: (x) => (x.exam
          ? <Link className="link" to={`/learn/attempts/${x.exam.attempt_id}`}>{scoreText(x.exam.final_score, x.exam.max_score)} {x.exam.passed ? 'đạt' : 'chưa đạt'}</Link> : '—') },
      ]}
    />
  )
}
