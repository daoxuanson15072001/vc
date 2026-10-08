// Lưới thẻ (DESIGN V.5 CMP-06, AIX-03): ul › li › article; tiêu đề h3 › Link tới URL đối tượng (không bấm cả thẻ);
// huy hiệu trạng thái bằng chữ; hành động trong RowActions. Mỗi article mang data-id / data-status / data-kind.
//
// <CardGrid label="Thẻ VCWIKI" items={cards} getId={(c) => c.id} testId="wiki-card"
//   renderCard={(c) => ({ title: c.title, to: `?card=${c.id}`, status: <StatusBadge kind="card" status={c.status} />,
//                        meta: 'Quy trình · 3 nguồn', body: <Tags/>, actions: <RowActions …/>, dataStatus: c.status, dataKind: c.type })} />
import { Link } from 'react-router-dom'

export function CardGrid({ label, items, getId = (x) => x.id, renderCard, testId, current }) {
  return (
    <ul className="ui-card-grid" aria-label={label}>
      {(items || []).map((it) => {
        const c = renderCard(it)
        const id = getId(it)
        return (
          <li key={id}>
            <article className={`ui-item-card${current === id ? ' is-current' : ''}`} data-testid={testId} data-id={id}
              data-status={c.dataStatus} data-kind={c.dataKind} aria-current={current === id ? 'true' : undefined}>
              {c.media}
              <div className="ui-item-body">
                {c.status}
                <h3 className="ui-item-title">{c.to ? <Link to={c.to} className="ui-title-link">{c.title}</Link> : c.title}</h3>
                {c.meta && <p className="ui-item-meta">{c.meta}</p>}
                {c.body}
                {c.actions && <div className="ui-item-actions">{c.actions}</div>}
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}
