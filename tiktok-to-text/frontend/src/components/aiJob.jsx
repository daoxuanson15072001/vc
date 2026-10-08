import { useEffect, useState } from 'react'
import { api } from '../api'
import { useFetch } from '../hooks'
import { totalTime } from '../format'

// Một lúc máy chỉ làm một việc nặng (backend kb/ai_slot.py), theo thứ tự bước: xử lý thô → dịch → vector hoá tầng thô
// → tinh chế → vector hoá thẻ. Báo việc đang chạy và các loại việc đang có hàng chờ nhưng tạm dừng.
export function AiJobNote({ job }) {
  if (!job?.enabled || !job.running) return null
  const r = job.running
  return (
    <div className="ai-job" role="status" data-testid="ai-job" data-status="running">
      <div>
        <b>▶ Đang làm: {r.label}</b>
        {r.detail && <span className="muted"> — {r.detail}</span>}
        {r.seconds >= 60 && <span className="muted small"> · {totalTime(r.seconds)}</span>}
      </div>
      {job.paused.length > 0 && (
        <div className="small">
          <span className="tone-warn">⏸ Tạm dừng, làm sau:</span>{' '}
          {job.paused.map((p) => `${p.label}${p.waiting > 1 ? ` (${p.waiting} việc chờ)` : ''}`).join(' · ')}
        </div>
      )}
      <div className="small muted">
        Máy chỉ chạy một việc nặng một lúc để không tràn RAM, theo thứ tự {job.order.join(' → ')}: bước sau đợi bước
        trước làm xong cả loạt.
      </div>
    </div>
  )
}

// Bản tự tải — cho trang không có sẵn dữ liệu /kb/queue.
export function AiJobBanner() {
  const [interval, setInterval_] = useState(5000)
  const { data } = useFetch(api.kbQueue, [], interval)
  const running = !!data?.ai_job?.running
  useEffect(() => setInterval_(running ? 3000 : 15000), [running])
  return <AiJobNote job={data?.ai_job} />
}
