import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { num } from '../format'
import { Empty, ErrorBox, Loading, Stat } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { WikiTabs } from './wiki/WikiTabs'

const monthLabel = (m) => (m ? `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}` : '')

// Ngày cuối tháng — hạn chốt giải
const monthEnd = (m) => new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).toLocaleDateString('vi-VN')

export default function Leaderboard() {
  const [params, setParams] = useSearchParams()
  const month = params.get('month') || ''
  const { data, error } = useFetch(() => api.leaderboard(month), [month])
  const items = data?.items || []
  const leaders = items.filter((r) => data.leaders.includes(r.user_id))
  const total = (k) => items.reduce((s, r) => s + r[k], 0)

  return (
    <>
      <PageHeader title="Bình chọn tháng"
        description={<>Bình luận, trả lời nhau, chấm sao cho thẻ và từng bình luận. Cuối tháng, người <b>nhận nhiều sao nhất</b> sẽ nhận giải.</>}
        actions={
          <select className="wiki-month" value={data?.month || month} onChange={(e) => setParams(e.target.value === data?.current_month ? {} : { month: e.target.value })}
            aria-label="Chọn tháng">
            {(data?.months || []).map((m) => <option key={m} value={m}>{monthLabel(m)}{m === data.current_month ? ' (đang diễn ra)' : ''}</option>)}
          </select>
        } />
      <WikiTabs />
      <ErrorBox>{error}</ErrorBox>
      {!data && !error && <Loading />}

      {data && (
        <>
          <div className={`winner card ${data.closed ? 'winner-closed' : ''}`}>
            <div className="winner-icon" aria-hidden>🏆</div>
            <div className="grow">
              <div className="small muted">
                {data.closed ? `Người thắng giải ${monthLabel(data.month)}` : `Đang dẫn đầu ${monthLabel(data.month)} · chốt hết ngày ${monthEnd(data.month)}`}
              </div>
              {leaders.length ? (
                <div className="winner-name">
                  {leaders.map((r) => r.name).join(', ')}
                  <span className="muted"> — {num(leaders[0].stars_received)} sao{leaders.length > 1 && ' (đồng hạng)'}</span>
                </div>
              ) : (
                <div className="winner-name muted">Chưa ai nhận sao trong tháng này</div>
              )}
            </div>
          </div>

          <div className="stats">
            <Stat label="Người tham gia" value={num(items.length)} />
            <Stat label="Bình luận" value={num(total('comments'))} />
            <Stat label="Lượt chấm" value={num(total('votes_given'))} />
            <Stat label="Tổng sao đã trao" value={num(total('stars_given'))} />
          </div>

          {items.length === 0 ? (
            <Empty>{monthLabel(data.month)} chưa có hoạt động. Mở một thẻ trong <Link className="link" to="/wiki">VCWIKI</Link> để bình luận và chấm sao.</Empty>
          ) : (
            <div className="card table-wrap">
              <table className="table table-static" data-testid="leaderboard-table">
                <caption className="sr-only">Bảng xếp hạng {monthLabel(data.month)} theo số sao nhận được</caption>
                <thead>
                  <tr>
                    <th scope="col"><span aria-hidden="true">#</span><span className="sr-only">Hạng</span></th>
                    <th scope="col">Thành viên</th>
                    <th scope="col" className="num" title="Tổng sao nhận được — tiêu chí xét giải">Sao nhận được</th>
                    <th scope="col" className="num" title="Sao nhận từ thẻ tri thức mình viết / nạp">từ thẻ</th>
                    <th scope="col" className="num" title="Sao nhận từ bình luận">từ bình luận</th>
                    <th scope="col" className="num">Sao cho đi</th>
                    <th scope="col" className="num">Bình luận</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={r.user_id} className={r.is_me ? 'active' : ''} data-id={r.user_id}>
                      <th scope="row" className="rank"
                        aria-label={data.leaders.includes(r.user_id) ? `Hạng ${i + 1} (dẫn đầu)` : `Hạng ${i + 1}`}>
                        {data.leaders.includes(r.user_id) ? '🏆' : i + 1}
                      </th>
                      <td className="strong">{r.name}{r.is_me && <span className="muted small"> (bạn)</span>}</td>
                      <td className="num strong star-on">★ {num(r.stars_received)}</td>
                      <td className="num muted">{num(r.card_stars)}</td>
                      <td className="num muted">{num(r.comment_stars)}</td>
                      <td className="num">{num(r.stars_given)} <span className="muted small">/ {num(r.votes_given)} lượt</span></td>
                      <td className="num">{num(r.comments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted">
            Luật: mỗi người chấm 1–5 sao cho một thẻ hoặc một bình luận (kể cả câu trả lời); không tự chấm cho mình. Sao tính cho tháng
            chấm lần đầu — sang tháng mới thì lượt chấm cũ được chốt, không sửa được. Sao của thẻ tính cho người tạo thẻ
            (thẻ AI dựng: người nạp tài liệu). Bằng sao thì xếp theo số bình luận.
          </p>
        </>
      )}
    </>
  )
}
