// Thư viện bài học & ngân hàng câu hỏi (SCR-16 Thư viện, TPL-A; docs/BA.md mục 17 — LRN-01, LRN-02 phần tạo tay).
// Người soạn (quản lý, editor, L&D) dựng bài học từ thẻ VCWIKI đã duyệt (ghim phiên bản) + câu luyện tập;
// mọi người xem bài học đã phát hành trong kho mình xem được.
// Trạng thái trên URL (SYS-28): ?tab=questions, ?category= (cây lĩnh vực), ?status=&kind=&difficulty=&sample= (lọc câu),
// ?q=<id>|new (ngăn kéo câu hỏi), ?import=1 (hộp nhập nhiều câu). Soạn / sửa bài học là route riêng
// /learn/lessons/new, /learn/lessons/:id/edit (pages/learn/library/LessonEdit.jsx).
// Thân thiện với AI điều khiển trình duyệt: mọi ô / nút trong luồng soạn có data-testid ổn định (q-*, lesson-*) và
// aria-label đúng tên hiển thị — hướng dẫn /guide#soan-khoa liệt kê từng cái.
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { useSession } from '../../session'
import { ErrorBox, Loading } from '../../components/ui'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { Icon } from '../../components/icons'
import { useUrlState } from '../../urlState'
import './learn.css'
import { QuestionBank } from './library/QuestionBank'
import { CoursesPanel } from './library/CoursesPanel'
import { TrainingPanel } from './library/TrainingPanel'
import { WorkPanel } from './library/PracticalPanel'
import Paths from './Paths'

const URL_STATE = { tab: { default: 'programs', values: ['programs', 'subjects', 'lessons', 'work', 'courses', 'paths', 'questions'] }, course: { default: '' } }

export default function Library() {
  const { user } = useSession()
  const [st, set] = useUrlState(URL_STATE)
  const { data, error, reload } = useFetch(() => api.lessons({ page_size: 1 }), [])
  const canAuthor = !!data?.can_author

  const courses = <CoursesPanel category={st.course} onCategory={(course) => set({ course }, { push: true })} canAuthor={canAuthor} />

  return (
    <>
      <PageHeader
        title="Thư viện"
        description="Chương trình học, môn học, bài học và thực hành theo mục tiêu."
        actions={canAuthor && (
          <>
            {user?.can_design && (
              <Link className="ui-btn" to="/learn/design"><Icon name="sparkles" size={16} />Thiết kế bằng AI</Link>
            )}
            {st.tab === 'lessons' && <Link className="ui-btn ui-btn-primary" to="/learn/lessons/new" data-testid="lesson-new">+ Bài học mới</Link>}
          </>
        )}
      />
      <ErrorBox onRetry={reload} testId="lessons-error">{error}</ErrorBox>
      {!data && !error && <Loading>Đang tải thư viện…</Loading>}
      {data && <Tabs kind="panel" label="Thư viện" value={st.tab} onChange={(tab) => set({ tab }, { push: true })} items={[
        { id: 'programs', label: 'Chương trình học', content: <TrainingPanel mode="programs" canAuthor={canAuthor} /> },
        { id: 'subjects', label: 'Môn học', content: <TrainingPanel mode="subjects" canAuthor={canAuthor} /> },
        { id: 'lessons', label: 'Bài học', content: <TrainingPanel mode="lessons" canAuthor={canAuthor} /> },
        { id: 'work', label: 'Thực hành của tôi', content: <WorkPanel /> },
        { id: 'courses', label: 'Môn học kiểu cũ', testId: 'tab-courses', content: courses },
        canAuthor && { id: 'paths', label: 'Lộ trình kiểu cũ', testId: 'tab-paths', content: <Paths /> },
        canAuthor && { id: 'questions', label: 'Ngân hàng câu hỏi', testId: 'tab-questions', content: <QuestionBank /> },
      ].filter(Boolean)} />}
    </>
  )
}
