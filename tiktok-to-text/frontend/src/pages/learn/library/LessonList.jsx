// Tab Bài học của Thư viện (SCR-16, TPL-A): cây lĩnh vực (Tree qua CategoryTree, ?category=) + lưới bài học.
// Sửa / tạo bài không thay danh sách tại chỗ nữa — liên kết sang route /learn/lessons/new, /learn/lessons/:id/edit.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { dateTime } from '../../../format'
import { Empty } from '../../../components/ui'
import { Notice } from '../../../components/Notice'
import { StatusBadge } from '../../../components/StatusBadge'
import { CategoryTree } from '../../../components/pickers'

// Cây lĩnh vực như VCWIKI; số bên cạnh nhánh = số bài học (lĩnh vực của bài = lĩnh vực các thẻ trong bài, gồm nhánh con)
function LessonTree({ counts, value, onSelect }) {
  const { data: cats } = useFetch(() => api.categories(), [])
  const withCounts = useMemo(() => (cats || []).map((c) => ({ ...c, card_count: counts?.[c.slug] || 0 })), [cats, counts])
  return <CategoryTree cats={withCounts} value={value} onSelect={onSelect} />
}

export function LessonsPanel({ data, canAuthor, category, onCategory }) {
  const filtered = !!category
  return (
    <div className="wiki-layout">
      <aside className="card wiki-side" aria-label="Cây lĩnh vực">
        <LessonTree counts={data?.category_counts} value={category} onSelect={onCategory} />
      </aside>
      <div className="stack">
        {canAuthor && <p className="muted small">Bản nháp chỉ mình bạn thấy. Phát hành xong thì khoá nội dung — muốn sửa hãy tạo bản sao.</p>}
        {canAuthor && data?.approved_cards < data?.few_approved_threshold && (
          <Notice tone="warn" testId="few-approved">
            {data.approved_cards === 0 ? 'Chưa có thẻ nào đã duyệt' : `Chỉ có ${data.approved_cards} thẻ đã duyệt`} trong các kho bạn xem được —
            bài học chỉ dựng từ thẻ <b>đã duyệt</b>. <Link className="link" to="/wiki/review">Sang Hộp duyệt</Link>
          </Notice>
        )}
        {data?.items?.length === 0 && filtered && <Empty>Nhánh này chưa có bài học nào. Chọn nhánh khác hoặc <b>Tất cả lĩnh vực</b>.</Empty>}
        {data?.items?.length === 0 && !filtered && (
          <Empty>{canAuthor ? 'Chưa có bài học nào. Bấm “+ Bài học mới” để soạn từ thẻ VCWIKI đã duyệt.' : 'Chưa có bài học nào được phát hành cho bạn.'}</Empty>
        )}
        {data && !canAuthor && data.author_status && <AuthorHelp st={data.author_status} />}
        <div className="card-grid" data-testid="lesson-list">
          {data?.items?.map((l) => (
            <div key={l.id} className="wiki-card lrn-tile" data-lesson-id={l.id} data-status={l.status}>
              <div className="row-between">
                <Link className="strong clamp-2 link" to={`/learn/lessons/${l.id}`}>{l.title}</Link>
                <StatusBadge kind="lesson" status={l.status} />
              </div>
              {l.objectives.length > 0 && <div className="muted small clamp-2">Mục tiêu: {l.objectives.join(' · ')}</div>}
              <div className="meta">
                <span>{l.item_count} thẻ</span>
                <span>{l.practice_question_ids.length} câu luyện tập</span>
                <span>{l.space_name}</span>
                <span>{l.created_by_name}</span>
                <span>{dateTime(l.updated_at)}</span>
              </div>
              {canAuthor && (l.can_edit || l.status !== 'draft') && (
                <div className="actions">
                  {l.can_edit && (
                    <Link className="ui-btn ui-btn-sm ui-btn-ghost" aria-label={`Sửa bài học: ${l.title}`} data-testid="lesson-edit"
                      to={`/learn/lessons/${l.id}/edit`}>Sửa</Link>
                  )}
                  {l.status !== 'draft' && (
                    <Link className="ui-btn ui-btn-sm ui-btn-ghost" aria-label={`Tạo bản sao: ${l.title}`} data-testid="lesson-copy"
                      to={`/learn/lessons/new?copy=${l.id}`}>Tạo bản sao</Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Vì sao chưa soạn được bài (backend/app/policy.py learn_author_status): quyền soạn = có cấp dưới trực tiếp, hoặc vai
// trò Biên tập viên / Quản lý đào tạo (BA 15.6). Admin không tự có quyền (ORG-13) — dẫn sang /org, không có đường tắt.
function AuthorHelp({ st }) {
  const missing = []
  if (!st.in_org) missing.push('bạn chưa được xếp vào cơ cấu tổ chức')
  if (!st.has_subordinates) missing.push('chưa có ai báo cáo trực tiếp cho bạn')
  missing.push('chưa được cấp vai trò Biên tập viên hoặc Quản lý đào tạo')
  return (
    <Notice tone="info" title="Bạn chưa có quyền soạn bài học" testId="author-help">
      — {missing.join('; ')}. Quyền soạn bài có ở người quản lý (có cấp dưới trực tiếp)
      hoặc người được cấp vai trò Biên tập viên / Quản lý đào tạo.
      {st.is_admin ? (
        <p className="lrn-help-next">
          {st.org_empty
            ? <>Cây tổ chức đang trống. Vào <Link className="link" to="/org">Cơ cấu tổ chức</Link>: tạo Tập đoàn, rồi cấp vai trò <b>Quản lý đào tạo</b> cho người soạn bài (kể cả chính bạn) ở tab <Link className="link" to="/org?tab=grants">Vai trò chức năng</Link>.</>
            : <>Cấp vai trò <b>Quản lý đào tạo</b> hoặc <b>Biên tập viên</b> ở <Link className="link" to="/org?tab=grants">Cơ cấu tổ chức → Vai trò chức năng</Link>.</>}
        </p>
      ) : (
        <p className="lrn-help-next">Cần soạn bài? Nhờ quản trị viên cấp vai trò ở trang Cơ cấu tổ chức.</p>
      )}
    </Notice>
  )
}
