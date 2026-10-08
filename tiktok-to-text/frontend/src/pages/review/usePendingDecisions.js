// Hoãn gửi quyết định duyệt để *Hoàn tác* được (DESIGN V.9.2 "Hoàn tác ở TPL-A2") — BE chưa có lệnh huỷ duyệt.
//
// defer(job): mục rời danh sách ngay (pendingIds), toast "Đã duyệt: <tên>" có nút Hoàn tác; hết giờ (8 giây) / bấm ✕ /
// bị toast mới đẩy ra → gửi thật. Hoàn tác → bỏ việc, không gọi API, mục quay lại (onUndo). Gửi lỗi → toast lỗi, mục
// quay lại. Rời màn (unmount) / đổi tab (flush) → gửi ngay các việc còn hoãn; đóng / tải lại trang (pagehide) → gửi
// bằng fetch keepalive (trình duyệt vẫn gửi xong sau khi trang đóng).
//
// job: { id, title, body, verb: 'Duyệt' | 'Từ chối' | 'Trả về', done: 'Đã duyệt' | 'Đã từ chối' | 'Đã trả về người đề xuất' }
// Thời gian hoãn: 8 giây (toast mặc định); e2e đặt window.__e2eFast = true thì 2 giây.
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { api } from '../../api'
import { toast } from '../../components/toast'

const decideUrl = (id) => `/api/wiki/changes/${id}/decide`

export function deferDuration() {
  return typeof window !== 'undefined' && window.__e2eFast ? 2000 : undefined
}

export function usePendingDecisions({ onSettled, onUndo } = {}) {
  const jobs = useRef(new Map())
  const [, bump] = useReducer((x) => x + 1, 0)
  const cb = useRef({ onSettled, onUndo })
  cb.current = { onSettled, onUndo }

  const send = useCallback(async (id) => {
    const job = jobs.current.get(id)
    if (!job || job.sent) return
    job.sent = true
    let ok = false
    try {
      await api.decideChange(id, job.body)
      ok = true
    } catch (e) {
      toast(`Không ${job.verb.toLowerCase()} được «${job.title}»: ${e.message}`, { tone: 'error' })
    }
    // Giữ mục ẩn tới khi danh sách tải lại xong (không nháy lại mục vừa duyệt)
    try { await cb.current.onSettled?.(id, ok) } finally {
      jobs.current.delete(id)
      bump()
    }
  }, [])

  const undo = useCallback((id) => {
    const job = jobs.current.get(id)
    if (!job || job.sent) {
      toast('Quyết định đã gửi đi — không hoàn tác được nữa', { tone: 'info' })
      return
    }
    jobs.current.delete(id)
    bump()
    cb.current.onUndo?.(job)
  }, [])

  const defer = useCallback((job) => {
    jobs.current.set(job.id, { ...job, sent: false })
    bump()
    toast(`${job.done}: ${job.title}`, {
      duration: deferDuration(),
      action: { label: 'Hoàn tác', onClick: () => undo(job.id) },
      onExpire: () => send(job.id),
    })
  }, [send, undo])

  // Gửi ngay mọi việc còn hoãn (đổi tab, rời màn)
  const flush = useCallback(() => {
    ;[...jobs.current.keys()].forEach((id) => send(id))
  }, [send])

  useEffect(() => {
    const list = jobs.current
    const onHide = () => {
      list.forEach((job, id) => {
        if (job.sent) return
        job.sent = true
        try {
          fetch(decideUrl(id), { method: 'POST', keepalive: true, credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job.body) })
        } catch { /* trang đang đóng — không còn chỗ báo lỗi */ }
      })
      list.clear()   // trang quay lại từ bfcache thì không giữ mục ẩn nữa
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      ;[...list.keys()].forEach((id) => send(id))   // rời màn trong app: gửi ngay
    }
  }, [send])

  const pendingIds = new Set(jobs.current.keys())   // bump() vẽ lại khi danh sách việc hoãn đổi
  return { pendingIds, defer, flush }
}
