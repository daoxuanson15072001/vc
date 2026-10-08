// SCR-01 Việc của tôi (TPL-D, DESIGN V.7): việc chờ tôi (API gom /me/inbox/counts) + số liệu kho thu gọn được.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { useSession } from '../session'
import { dateTime, num, SOURCE_KIND, totalTime } from '../format'
import { Empty, ErrorBox, Loading, SourceStatus, Stat } from '../components/ui'
import { PageHeader } from '../components/PageHeader'

// Link đích của từng loại việc (DESIGN 9.2). Bài Viết nhanh "cần sửa": trạng thái thật do nhánh API báo — sửa ở đây một chỗ.
// Bài Viết nhanh AI viết lỗi của tôi (inbox.py CONTENT_FIX_STATUS = "error"); danh sách mặc định lọc "Của tôi"
const CONTENT_FIX_LINK = '/studio/quick?status=error'
const REFRESH_MS = 30_000

const TASKS = [
  { kind: 'review', key: 'review', label: 'Chờ tôi duyệt', to: '/wiki/review' },
  // GOV-13: đề xuất của tôi bị người duyệt trả về (inbox.py returned_to_me) → tab Tôi đề xuất, lọc Cần sửa
  { kind: 'returned', key: 'returned_to_me', label: 'Đề xuất cần sửa', to: '/wiki/review?tab=mine&status=returned' },
  { kind: 'learn', key: 'learn_due', label: 'Bài học được giao', to: '/learn' },
  { kind: 'grading', key: 'grading', label: 'Bài chờ chấm', to: '/learn/grading', need: 'can_grade' },
  { kind: 'content_fix', key: 'content_fix', label: 'Nội dung cần sửa', to: CONTENT_FIX_LINK },
  { kind: 'sources_error', key: 'sources_error', label: 'Nguồn lỗi của tôi', to: '/kb?status=error&mine=1' },
]

// "còn 3 ngày" / "hôm nay" / "quá hạn 2 ngày" — ngày đầy đủ đặt ở title
function dueText(iso, now = Date.now()) {
  if (!iso) return null
  const days = Math.ceil((new Date(iso).getTime() - now) / 86_400_000)
  if (days > 0) return `còn ${days} ngày`
  if (days === 0) return 'hôm nay'
  return `quá hạn ${-days} ngày`
}

const hhmm = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

function TaskList({ counts, user }) {
  const rows = TASKS.filter((t) => !t.need || user?.[t.need])
  const total = rows.reduce((n, t) => n + (counts[t.key] || 0), 0)
  return (
    <>
      <p className="home-greet" data-testid="home-greeting">Chào {user?.name}. Hôm nay có {num(total)} việc chờ bạn.</p>
      <ul className="home-tasks" data-testid="home-tasks" aria-label="Việc chờ bạn">
        {rows.map((t) => {
          const n = counts[t.key] || 0
          const due = t.kind === 'learn' && n > 0 ? dueText(counts.learn_next_due) : null
          return (
            <li key={t.kind} data-testid="home-task" data-kind={t.kind} data-count={n} className={n === 0 ? 'is-zero' : ''}>
              <Link to={t.to} className="home-task-link">
                <span className="home-task-label">{t.label}</span>
                <span className="home-task-count">{num(n)}</span>
                {due && <span className="home-task-due muted small" title={dateTime(counts.learn_next_due)}>hạn gần nhất: {due}</span>}
                <span aria-hidden="true" className="home-task-go">→</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function StatLink({ to, ...rest }) {
  return <Link to={to} className="home-stat-link"><Stat {...rest} /></Link>
}

export default function Dashboard() {
  const { user } = useSession()
  const { data: s, error } = useFetch(api.stats, [], REFRESH_MS)
  const { data: counts, error: countsError, reload: reloadCounts } = useFetch(api.inboxCounts, [], REFRESH_MS)
  const { data: newCards } = useFetch(() => api.cards({ status: 'approved', page_size: 5 }), [], REFRESH_MS)
  const [open, setOpen] = useState(true)
  const stamp = counts?.updated_at ? new Date(counts.updated_at) : (s ? new Date() : null)

  return (
    <>
      <PageHeader
        title="Việc của tôi"
        actions={<Link to="/kb?add=1" className="ui-btn ui-btn-primary" data-testid="dashboard-source-add">Nạp nguồn</Link>}
      />
      {stamp && <p className="muted small home-stamp" data-testid="home-updated">Cập nhật lúc {hhmm(stamp)}</p>}

      <div aria-live="off">
        <section className="card home-work" aria-label="Việc chờ bạn">
          {countsError && <ErrorBox onRetry={reloadCounts}>{`Không tải được việc của bạn: ${countsError}`}</ErrorBox>}
          {!counts && !countsError && <Loading />}
          {counts && <TaskList counts={counts} user={user} />}
        </section>

        <ErrorBox>{error && `Không kết nối được BE: ${error}`}</ErrorBox>
        {!s && !error && <Loading />}
        {s && (
          <>
            <section className="home-kb" aria-labelledby="home-kb-h">
              <h2 id="home-kb-h" className="home-kb-h">
                <button type="button" className="home-kb-toggle" aria-expanded={open} aria-controls="home-kb-body" onClick={() => setOpen(!open)} data-testid="home-kb-toggle">
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span> Số liệu kho
                </button>
              </h2>
              <div id="home-kb-body" hidden={!open}>
                <div className="stats stats-6" data-testid="dashboard-stats">
                  <StatLink to="/kb" label="Nguồn tri thức" value={num(s.sources)} hint={s.sources_active ? `${num(s.sources_active)} đang xử lý` : 'trong các kho bạn xem được'} />
                  <StatLink to="/wiki" label="Thẻ VCWIKI" value={num(s.cards)} hint={`${num(s.cards_approved)} đã duyệt`} />
                  <StatLink to="/kb/videos" label="Video trong kho" value={num(s.videos)} hint={`${num(s.ok)} có lời nói · ${num(s.no_speech)} chỉ có nhạc`} />
                  <StatLink to="/kb/videos?status=error" label="Video lỗi" value={num(s.errors)} hint={s.errors ? 'xem và nạp lại' : 'không có'} />
                  <StatLink to="/kb/channels" label="Kênh" value={num(s.channels)} />
                  <StatLink to="/kb/videos" label="Đã chuyển chữ" value={totalTime(s.seconds)} hint="tổng thời lượng video" />
                </div>
              </div>
            </section>

            <div className="grid-2">
              <section className="card" aria-labelledby="dash-recent-sources">
                <div className="card-head">
                  <h2 id="dash-recent-sources">Nguồn nạp gần đây</h2>
                  <Link to="/kb" className="link">Kho tư liệu →</Link>
                </div>
                {s.recent_sources.length === 0 && <Empty>Chưa nạp nguồn nào.</Empty>}
                <ul className="list" aria-label="Nguồn nạp gần đây">
                  {s.recent_sources.map((src) => (
                    <li key={src.id} data-id={src.id} data-status={src.overall} data-kind={src.kind}>
                      <Link to={`/kb?source=${src.id}`} className="list-row">
                        <div className="grow">
                          <div className="ellipsis strong">
                            <span className="kind-icon" title={SOURCE_KIND[src.kind]?.label} aria-hidden="true">{SOURCE_KIND[src.kind]?.icon}</span>
                            {src.title || src.file?.name || src.url}
                          </div>
                          <div className="muted small">
                            {dateTime(src.created_at)} · {src.docs.total} tài liệu · {src.card_count} thẻ
                            {src.status === 'extracting' && src.progress?.total > 1 && ` · ${src.progress.processed}/${src.progress.total}`}
                          </div>
                        </div>
                        <SourceStatus status={src.overall} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card" aria-labelledby="dash-new-cards" data-testid="home-new-cards">
                <div className="card-head">
                  <h2 id="dash-new-cards">Thẻ mới duyệt</h2>
                  <Link to="/wiki" className="link">VCWIKI →</Link>
                </div>
                {newCards?.items.length === 0 && <Empty>Chưa có thẻ nào được duyệt.</Empty>}
                <ul className="list" aria-label="Thẻ mới duyệt">
                  {(newCards?.items || []).map((c) => (
                    <li key={c.id} data-id={c.id}>
                      <Link to={`/wiki?card=${c.id}`} className="list-row">
                        <div className="grow">
                          <div className="ellipsis strong">{c.title}</div>
                          <div className="muted small">{dateTime(c.updated_at)}</div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  )
}
