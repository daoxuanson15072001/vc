// Hàng chờ chuyển chữ theo làn (Whisper / nhẹ) — SCR-03 chuyển từ tab Nguồn sang tab Tiến độ tinh chế (cùng chủ đề
// "đang xử lý"). Tên nguồn là link thật mở ngăn kéo chi tiết nguồn ở Kho tư liệu (/kb?source=<id>).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { AiJobNote } from '../../components/aiJob'
import { atClock, KindIcon, kindLabel, leftText } from './shared'

const LANE_LABEL = { heavy: 'Làn Whisper — video, ghi âm', light: 'Làn nhẹ — bài viết, PDF, ảnh, Office' }
const LANE_SHOWN = 5

export default function LaneQueue() {
  const [interval, setInterval_] = useState(5000)
  const { data } = useFetch(api.kbQueue, [], interval)
  const busy = data?.lanes.some((l) => l.jobs.length) || !!data?.ai_job?.running
  useEffect(() => setInterval_(busy ? 3000 : 15000), [busy])
  if (!busy) return null
  return (
    <section className="card lane-queue" aria-labelledby="kb-lane-title" data-testid="kb-lane-queue">
      <h2 id="kb-lane-title" className="kb-h2">Hàng chờ chuyển chữ</h2>
      <AiJobNote job={data.ai_job} />
      {data.lanes.filter((l) => l.jobs.length).map((l) => (
        <div key={l.lane} className="lane" data-kind={l.lane}>
          <div className="lane-head">
            <h3 className="kb-h3">{LANE_LABEL[l.lane] || l.lane}</h3>
            <span className="muted small">
              {l.running ? 'đang chạy 1' : 'rảnh'}{l.queued ? ` · ${l.queued} chờ` : ''} · làn trống lúc ~{atClock(l.finish_in)}
            </span>
          </div>
          <ol className="lane-jobs">
            {l.jobs.slice(0, LANE_SHOWN).map((j, i) => (
              <li key={j.id || i} className={j.running ? 'running' : ''} data-id={j.id} data-status={j.running ? 'running' : 'queued'}>
                <span className="lane-pos">{j.running ? 'Đang chạy' : j.position}</span>
                {j.id
                  ? (
                    <Link className="link clamp-1 grow" to={`/kb?source=${j.id}`} aria-label={`Mở nguồn: ${j.title || 'Không tên'}`}>
                      <KindIcon kind={j.kind} /> <span className="sr-only">{kindLabel(j.kind)}: </span>{j.title || 'Không tên'}
                    </Link>
                  )
                  : <span className="muted clamp-1 grow">Nguồn ở kho khác</span>}
                <span className="small muted nowrap">
                  {j.running && j.progress?.total > 1 ? `${j.progress.processed}/${j.progress.total} · ` : ''}
                  {j.running ? (j.overdue ? 'sắp xong' : `còn ~${leftText(j.finish_in)}`) : `xong ~${atClock(j.finish_in)}`}
                </span>
              </li>
            ))}
            {l.jobs.length > LANE_SHOWN && <li className="muted small">+ {l.jobs.length - LANE_SHOWN} việc nữa</li>}
          </ol>
        </div>
      ))}
    </section>
  )
}
