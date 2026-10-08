// Trang soạn / sửa bài học (SCR-16, LRN-01) — route riêng thay cho form thay danh sách tại chỗ:
//   /learn/lessons/new            bài mới; ?copy=<id> = bản sao của bài đã phát hành (h1 "Bài học mới")
//   /learn/lessons/:id/edit       sửa bản nháp (h1 = tên bài)
// Lưu nháp → về Thư viện; Phát hành → trang bài học; phản hồi bằng toast. Nút Quay lại của trình duyệt chạy đúng.
import { useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { ErrorBox, Loading } from '../../../components/ui'
import { Notice } from '../../../components/Notice'
import { PageHeader } from '../../../components/PageHeader'
import { StatusBadge } from '../../../components/StatusBadge'
import { toast } from '../../../components/toast'
import '../learn.css'
import { LessonForm } from './LessonForm'

const CRUMBS = [{ label: 'Học tập' }, { label: 'Thư viện bài học', to: '/learn/library' }]

export default function LessonEdit({ creating = false }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const copyId = creating ? params.get('copy') || '' : ''
  const defaultCourse = creating ? params.get('course') || '' : ''
  const defaultSubject = creating ? params.get('subject') || '' : ''
  const curriculumId = creating ? params.get('curriculum') || '' : ''
  const { data: curricula } = useFetch(() => curriculumId ? api.trainingDocuments({ kind: 'curriculum' }) : Promise.resolve(null), [curriculumId])
  const curriculum = curricula?.items.find(x => x.id === curriculumId)
  const navigate = useNavigate()
  const sourceId = creating ? copyId : id
  const { data: source, error, reload } = useFetch(() => (sourceId ? api.lesson(sourceId) : Promise.resolve(null)), [sourceId])

  const back = useCallback(() => {
    // Có trang trước trong app (react-router ghi idx) thì quay lại; mở thẳng link thì về Thư viện
    if ((window.history.state?.idx || 0) > 0) navigate(-1)
    else navigate(defaultCourse ? `/learn/library?tab=courses&course=${encodeURIComponent(defaultCourse)}` : '/learn/library')
  }, [navigate, defaultCourse])

  const onSaved = (l, published) => {
    if (published) {
      toast(`Đã phát hành bài học “${l.title}”`)
      navigate(`/learn/lessons/${l.id}`)
    } else {
      toast(`Đã lưu nháp bài học “${l.title}”`)
      navigate(defaultCourse ? `/learn/library?tab=courses&course=${encodeURIComponent(defaultCourse)}` : '/learn/library')
    }
  }

  const title = creating ? 'Bài học mới' : source?.title || 'Sửa bài học'
  const header = (meta) => <PageHeader title={title} crumbs={CRUMBS} meta={meta} />

  if (error) return <>{header()}<ErrorBox onRetry={reload} testId="lesson-error">{error}</ErrorBox></>
  if (sourceId && !source) return <>{header()}<Loading>Đang tải bài học…</Loading></>

  if (creating) {
    const lesson = source
      ? { ...source, id: null, copy_of: source.title, title: `${source.title} (bản sao)` }
      : {}
    return (
      <>
        {header()}
        {source && (
          <Notice tone="info" testId="lesson-copy-of">
            Bản sao của <Link className="link" to={`/learn/lessons/${source.id}`}>“{source.title}”</Link> — thẻ được ghim lại theo phiên bản
            mới nhất khi lưu.
          </Notice>
        )}
        <LessonForm key={`${copyId || 'new'}:${defaultCourse}:${curriculum?.id || ''}`} lesson={lesson} defaultCategory={defaultCourse} defaultSubject={curriculum?.subject_id || defaultSubject} curriculumId={curriculumId} defaultAudience={curriculum?.audience || ''} onSaved={onSaved} onCancel={back} />
      </>
    )
  }

  return (
    <>
      {header(<StatusBadge kind="lesson" status={source.status} testId="lesson-status" />)}
      {source.can_edit && source.status === 'draft' ? (
        <LessonForm key={source.id} lesson={source} onSaved={onSaved} onCancel={back} />
      ) : (
        <Notice tone="warn" testId="lesson-locked"
          action={<Link className="ui-btn ui-btn-sm" to={`/learn/lessons/new?copy=${source.id}`}>Tạo bản sao</Link>}>
          {source.status === 'draft'
            ? 'Bạn không sửa được bài học này — chỉ người soạn (còn quyền sửa kho) sửa được bản nháp.'
            : 'Bài học đã phát hành nên nội dung đã khoá. Muốn sửa, hãy tạo bản sao rồi phát hành bản mới.'}
        </Notice>
      )}
    </>
  )
}
