// Bước 2 *Bản nháp AI* (chỉ đọc): AI dùng engine nào, ghi chú, chỗ thiếu tri thức, dàn ý tuần → bài → thẻ (mã thẻ + phiên
// bản), prompt đã gửi. Sửa ở bước 3.
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui'
import { LEVEL_LABEL } from './DraftEditor'

export default function DraftReview({ draft, plan }) {
  const unit = draft.period === 'year' ? 'Tháng' : 'Tuần'
  return (
    <section className="card lrn-step-card lrn-form">
      <div className="row-between">
        <h2 className="lrn-sec">Bản nháp AI dựng</h2>
        <span className="row">
          <span role="status" data-testid="design-ai-status" data-status={draft.no_ai ? 'no-ai' : 'ai'}>
            {draft.no_ai ? <Badge tone="warn">Không có AI — nháp dựng bằng code</Badge> : <Badge tone="info">AI: {draft.engine}</Badge>}
          </span>
          <Badge tone={draft.status !== 'draft' ? 'good' : 'warn'}>{draft.status !== 'draft' ? 'Đã phát hành' : 'Nháp'}</Badge>
        </span>
      </div>
      {draft.no_ai && draft.no_ai_reason && <p className="muted small" role="status">Lý do: {draft.no_ai_reason}</p>}
      {draft.notes?.map((n) => <p key={n} className="muted small">• {n}</p>)}
      {draft.dropped_ids?.length > 0 && <p className="muted small">• Đã bỏ {draft.dropped_ids.length} mã thẻ AI trả không có trong danh sách được dùng.</p>}

      {draft.gaps?.length > 0 && (
        <div className="panel" aria-label="Thiếu tri thức">
          <div className="strong">Thiếu tri thức ({draft.gaps.length})</div>
          <ul className="list">
            {draft.gaps.map((g, i) => (
              <li key={i}>
                <b>{g.topic}</b> — {g.reason}{g.source === 'ai' ? <span className="muted small"> · AI nhận định</span> : null}
              </li>
            ))}
          </ul>
          <p className="muted small">Gợi ý: nạp tài liệu / tạo thẻ cho các nhánh này ở <Link className="link" to="/wiki">VCWIKI</Link>, duyệt xong thì dựng lộ trình lại.</p>
        </div>
      )}

      <div>
        <div className="strong">{plan.title || draft.title}</div>
        {plan.weeks.map((w) => (
          <div key={w.week} className="panel lrn-week" aria-label={`${unit} ${w.week}`}>
            <div className="strong">{unit} {w.week}</div>
            {w.lessons.length === 0 && <p className="muted small">Chưa có bài.</p>}
            {w.lessons.map((l, li) => (
              <div key={li} className="lrn-lesson">
                <div>{l.title}</div>
                {l.objectives?.length > 0 && <p className="muted small">Mục tiêu: {l.objectives.join('; ')}</p>}
                <ol className="lrn-picked">
                  {l.cards.map((c) => (
                    <li key={c.card_id}>
                      <Link className="link" to={`/wiki?card=${c.card_id}`}>{c.title || c.card_id}</Link>
                      <span className="muted small"> · bản {c.rev || c.current_rev || '—'}{c.level ? ` · ${LEVEL_LABEL[c.level] || c.level}` : ''}{c.type ? ` · ${c.type}` : ''}{c.process_steps?.length ? ` · ${c.process_steps.join(', ')}` : ''}</span>
                      {c.outdated && <> <Badge tone="warn">thẻ đã có bản {c.current_rev}</Badge></>}
                      {c.unavailable && <> <Badge tone="bad">không dùng được: {c.unavailable_reason}</Badge></>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ))}
      </div>
      <details>
        <summary className="muted small">Prompt đã gửi AI</summary>
        <pre className="small lrn-prompt">{draft.prompt}</pre>
      </details>
    </section>
  )
}
