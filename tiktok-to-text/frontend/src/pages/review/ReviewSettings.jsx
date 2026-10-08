// Cấu hình duyệt (GOV-05 — số người duyệt tối thiểu) — chuyển từ đầu Hộp duyệt sang /admin tab *Duyệt*
// (DESIGN SCR-09 Đích, SCR-21). API giữ nguyên: GET / PUT /api/wiki/review-settings.
import { useId, useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { ErrorBox, Loading } from '../../components/ui'
import { toast } from '../../components/toast'

export function ReviewSettings() {
  const { data, error, reload } = useFetch(api.reviewSettings, [])
  const [busy, setBusy] = useState(false)
  const id = useId()
  if (error) return <ErrorBox onRetry={reload}>{error}</ErrorBox>
  if (!data) return <Loading />
  const save = async (v) => {
    setBusy(true)
    try {
      await api.saveReviewSettings({ min_approvers: Number(v) })
      await reload()
      toast(`Đã đổi số người duyệt tối thiểu thành ${v}`)
    } catch (e) {
      toast(`Không đổi được số người duyệt: ${e.message}`, { tone: 'error' })
    } finally { setBusy(false) }
  }
  const st = data.novelty_stats
  return (
    <section className="card review-settings" aria-labelledby={`${id}-h`} data-testid="admin-review-settings">
      <h2 id={`${id}-h`}>Luật duyệt thẻ VCWIKI</h2>
      <div className="field">
        <label htmlFor={id}>Số người duyệt tối thiểu</label>
        <select id={id} value={data.min_approvers} disabled={!data.can_edit || busy} onChange={(e) => save(e.target.value)}>
          <option value={2}>2 (bước 1 + bước 2)</option>
          <option value={1}>1 (dùng thử)</option>
        </select>
        <small>2: người duyệt trong kho rồi chủ nhánh / chủ sở hữu lĩnh vực. 1: một người đủ điều kiện duyệt là xong.</small>
      </div>
      {st?.total > 0 && (
        <p className="small muted">Người đổi kết quả cổng so sánh: {Math.round(st.rate * 100)}% trên {st.total} đề xuất (mục tiêu dưới 20%).</p>
      )}
      {!data.can_edit && <p className="small muted">Chỉ quản trị viên đổi được cấu hình này.</p>}
    </section>
  )
}
