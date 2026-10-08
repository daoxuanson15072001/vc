// Danh sách thẻ VCWIKI (SCR-06): lưới CardGrid (CMP-06), lộ trình (mục là Link) và khung liên kết tra cứu của lĩnh vực.
import { Link } from 'react-router-dom'
import { CARD_LEVEL, CARD_TYPE, processStepLabel, SOURCE_KIND } from '../../format'
import { Badge } from '../../components/ui'
import { CardGrid } from '../../components/CardGrid'
import { StatusBadge } from '../../components/StatusBadge'
import { CategoryChips } from '../../components/pickers'
import { SocialLine } from '../../components/social'
import { ClassBadges } from '../../components/CardClassFields'
import { buildTimeline } from '../../timeline'

// Lưới: tiêu đề là Link tới ?card=<id> (giữ bộ lọc đang có); cả thẻ không bấm được, chỉ tiêu đề
export function WikiGrid({ cards, cats, openId, cardHref }) {
  return (
    <CardGrid label="Thẻ VCWIKI" items={cards} testId="wiki-card" current={openId}
      renderCard={(c) => ({
        title: c.title,
        to: cardHref(c.id),
        dataStatus: c.status,
        dataKind: c.type,
        status: (
          <div className="wiki-card-top">
            <Badge tone="info">{CARD_TYPE[c.type] || c.type}</Badge>
            <StatusBadge kind="card" status={c.status} />
          </div>
        ),
        meta: (
          <>
            <SocialLine social={c.social} />
            <span>{c.space_name}</span>
            {c.source && <span className="ellipsis">{SOURCE_KIND[c.source.kind]?.icon} {c.source.title}</span>}
          </>
        ),
        body: (
          <div className="wiki-card-body">
            {c.summary && <div className="muted small clamp-2">{c.summary}</div>}
            <CategoryChips cats={cats} value={c.categories} />
            <ClassBadges card={c} />
          </div>
        ),
      })} />
  )
}

// Dạng Lộ trình: một đường dọc, chia chặng A/B/C… theo bậc, mỗi thẻ là một trạm đánh số liên tục
export function Timeline({ cards, cats, openId, cardHref }) {
  const stages = buildTimeline(cards)
  return (
    <div className="timeline">
      {stages.map((s) => (
        <section key={s.key} className="timeline-stage">
          <h2 className="timeline-stage-head">
            <span className="timeline-letter">{s.letter}</span>
            {s.level ? CARD_LEVEL[s.level] : 'Chưa xếp bậc'} <span className="muted">({s.cards.length} thẻ)</span>
          </h2>
          <ol className="timeline-list">
            {s.cards.map((c) => (
              <li key={c.id}>
                <Link className={`timeline-item ${c.id === openId ? 'active' : ''}`} to={cardHref(c.id)}
                  data-testid="wiki-timeline-item" data-id={c.id} data-status={c.status} data-kind={c.type}>
                  <span className="timeline-num">{c.n}</span>
                  <span className="timeline-body">
                    <span className="wiki-card-top">
                      <Badge tone="info">{CARD_TYPE[c.type] || c.type}</Badge>
                      {c.level && <Badge tone="muted">{CARD_LEVEL[c.level] || c.level}</Badge>}
                      {c.status !== 'approved' && <StatusBadge kind="card" status={c.status} />}
                      {(c.process_steps || []).map((p) => <span key={p} className="small muted">⟶ {processStepLabel(p)}</span>)}
                    </span>
                    <span className="strong">{c.title}</span>
                    {c.summary && <span className="muted small clamp-3">{c.summary}</span>}
                    <CategoryChips cats={cats} value={c.categories} />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

// Liên kết tra cứu của nhánh đang lọc (gộp cả nhánh cha, trùng địa chỉ thì bỏ) — vd web tra mã phụ tùng các hãng
// VCPV phân phối. Các web này chặn nhúng iframe (X-Frame-Options / CSP) nên chỉ hiện nút mở tab mới.
export function CategoryLinks({ cats, slug }) {
  if (!slug || !cats) return null
  const bySlug = new Map(cats.map((c) => [c.slug, c]))
  const parts = slug.split('.')
  const seen = new Set()
  const links = []
  parts.forEach((_, i) => {
    const c = bySlug.get(parts.slice(0, parts.length - i).join('.'))   // nhánh đang lọc trước, rồi lần lên cha
    for (const l of c?.links || []) {
      if (seen.has(l.url)) continue
      seen.add(l.url)
      links.push({ ...l, from: i ? c.name : null })
    }
  })
  if (!links.length) return null
  const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }
  return (
    <section className="card cat-links" aria-label="Liên kết tra cứu">
      <div className="cat-links-head">
        <h2>Liên kết tra cứu</h2>
        <span className="muted small">Mở ở tab mới — các trang này không cho nhúng vào VCWIKI</span>
      </div>
      <div className="cat-links-grid">
        {links.map((l) => (
          <a key={l.url} className="cat-link" href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>
            <span className="strong">{l.label} <span aria-hidden="true">↗</span></span>
            {l.note && <span className="small clamp-2">{l.note}</span>}
            <span className="muted small ellipsis">{host(l.url)}{l.from ? ` · từ ${l.from}` : ''}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
