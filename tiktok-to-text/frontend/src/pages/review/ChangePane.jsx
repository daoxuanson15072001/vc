// Khung chi tiết đề xuất theo ?change= (DESIGN V.6 TPL-A2, SCR-09):
//   - màn ≥ 1000px: cột phải cố định, <section aria-labelledby> — tiêu đề h2 "Đề xuất: <tên thẻ>", nút ở chân khung;
//   - màn hẹp: Drawer (bẫy tiêu điểm, Esc đóng — đóng là bỏ ?change=).
// Sau khi trang tự mở mục kế (focusReq.current = id), tiêu điểm vào tiêu đề khung khi dữ liệu mục đó về.
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { usePageMeta } from '../../pageMeta'
import { Drawer } from '../../components/Overlay'
import { ErrorBox, Loading } from '../../components/ui'
import { toast } from '../../components/toast'
import { ChangeBody } from './ChangeBody'
import { ChangeActions } from './ChangeActions'
import { ResubmitForm } from './ResubmitForm'
import { changeTitle } from './queue'

function PaneNav({ nav }) {
  if (!nav || !nav.pos || nav.total < 2) return null
  return (
    <nav aria-label="Chuyển đề xuất" className="rv-pane-nav">
      {nav.prevHref && <Link to={nav.prevHref} aria-label="Đề xuất trước" data-testid="review-prev">‹ Trước</Link>}
      <span className="rv-muted">{nav.pos} / {nav.total} trong danh sách</span>
      {nav.nextHref && <Link to={nav.nextHref} aria-label="Đề xuất sau" data-testid="review-next">Sau ›</Link>}
    </nav>
  )
}

export function ChangePane({ id, wide, nav, focusReq, onDecide, onChanged, onClose }) {
  const { data, error, setData } = useFetch(() => api.change(id), [id])
  const ch = data?.id === id ? data : null
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)   // form *Sửa và gửi lại* (GOV-13)
  const titleRef = useRef(null)
  const titleId = useId()
  const title = ch ? `Đề xuất: ${changeTitle(ch)}` : 'Đề xuất'

  usePageMeta(ch ? { object: title } : {})
  useEffect(() => { setComment(''); setEditing(false) }, [id])
  useEffect(() => {
    if (ch && focusReq?.current === id) {
      focusReq.current = null
      titleRef.current?.focus({ preventScroll: false })
    }
  }, [ch, id, focusReq])

  // Hành động gửi ngay (nhận xét, rút, cập nhật lên bản mới, đổi kết quả cổng so sánh) — toast báo kết quả
  const act = useCallback(async (fn, okText, after) => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fn()
      if (res?.id === id) setData(res)
      after?.()
      onChanged?.()
      toast(`${okText}: ${changeTitle(res || ch)}`)
    } catch (e) {
      toast(`Không làm được: ${e.message}`, { tone: 'error' })
    } finally { setBusy(false) }
  }, [busy, ch, id, onChanged, setData])

  const decide = (decision, body) => onDecide({ id, title: changeTitle(ch), decision, body })

  const body = error ? <ErrorBox>{error}</ErrorBox>
    : !ch ? <Loading />
      : (
        <>
          {editing && ch.can_resubmit && <ResubmitForm ch={ch} busy={busy} onAct={act} onCancel={() => setEditing(false)} />}
          <ChangeBody ch={ch} busy={busy} onAct={act} comment={comment} />
        </>
      )
  const foot = ch && (ch.status === 'open' || ch.status === 'needs_rebase') && (
    <ChangeActions key={id} ch={ch} busy={busy} comment={comment} setComment={setComment} onDecide={decide} onAct={act}
      editing={editing} onResubmit={() => setEditing(true)} />
  )

  if (!wide) {
    return (
      <Drawer open title={<span ref={titleRef} tabIndex={-1} className="rv-title-focus">{title}</span>} sub="Hộp duyệt"
        onClose={onClose} closeLabel="Đóng đề xuất" footer={foot} size="wide" testId="review-detail"
        headExtra={<PaneNav nav={nav} />}>
        {body}
      </Drawer>
    )
  }
  return (
    <section className="rv-pane" aria-labelledby={titleId} data-testid="review-detail">
      <div className="rv-pane-head">
        <PaneNav nav={nav} />
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="rv-pane-title">{title}</h2>
      </div>
      <div className="rv-pane-body">{body}</div>
      {foot && <div className="rv-pane-foot">{foot}</div>}
    </section>
  )
}
