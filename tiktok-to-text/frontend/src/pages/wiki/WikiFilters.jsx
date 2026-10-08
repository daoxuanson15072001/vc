// Thanh lọc thẻ VCWIKI (SCR-06, CMP-02): tìm, kho, loại, trạng thái thường trực; "Lọc thêm ▾" chứa tag + phân loại
// (bậc, division, bước quy trình). Mọi giá trị nằm trên URL (state.js) — dán link là thấy đúng bộ lọc.
import { useId, useState } from 'react'
import { CARD_TYPE } from '../../format'
import { statusInfo, STATUSES } from '../../statuses'
import { FilterBar, FilterChip, SearchField, SelectField } from '../../components/FilterBar'
import { Icon } from '../../components/icons'
import { spaceLabel } from '../../components/pickers'
import { ClassFilters } from '../../components/CardClassFields'
import { EXTRA_KEYS, KEYS } from './state'

export function WikiFilters({ f, q, setQ, update, spaces, tags, total }) {
  const extraCount = EXTRA_KEYS.filter((k) => f[k]).length
  const [more, setMore] = useState(extraCount > 0)
  const moreId = useId()
  const active = KEYS.some((k) => f[k])
  const clear = () => { setQ(''); update(Object.fromEntries(KEYS.map((k) => [k, '']))) }

  return (
    <FilterBar label="Lọc thẻ" count={total} unit="thẻ" active={active} onClear={clear} testId="wiki-filters">
      <SearchField label="Tìm trong thẻ" placeholder="Tìm trong thẻ — gõ không dấu cũng được" value={q} onChange={setQ} testId="wiki-search" />
      <SelectField label="Kho" value={f.space_id} onChange={(v) => update({ space_id: v })} testId="wiki-filter-space"
        options={[{ value: '', label: 'Tất cả kho tôi xem được' }, ...(spaces || []).map((s) => ({ value: s.id, label: spaceLabel(s) }))]} />
      <SelectField label="Loại thẻ" value={f.type} onChange={(v) => update({ type: v })} testId="wiki-filter-type"
        options={[{ value: '', label: 'Mọi loại thẻ' }, ...Object.entries(CARD_TYPE).map(([k, v]) => ({ value: k, label: v }))]} />
      <SelectField label="Trạng thái" value={f.status} onChange={(v) => update({ status: v })} testId="wiki-filter-status"
        options={[{ value: '', label: 'Nháp + đã duyệt + từ chối' },
          ...Object.keys(STATUSES.card).map((k) => ({ value: k, label: statusInfo('card', k).label }))]} />
      {f.source_id && <FilterChip pressed onClick={() => update({ source_id: '' })} testId="wiki-filter-source">Đang lọc theo một nguồn</FilterChip>}
      <button type="button" className="ui-btn ui-btn-sm" aria-expanded={more} aria-controls={moreId} data-testid="wiki-filter-more"
        onClick={() => setMore(!more)}>
        Lọc thêm{extraCount > 0 ? ` (${extraCount})` : ''}<Icon name="chevron-down" size={16} />
      </button>
      {more && (
        <div id={moreId} className="wiki-more" role="group" aria-label="Lọc thêm">
          <SelectField label="Tag" value={f.tag} onChange={(v) => update({ tag: v })} testId="wiki-filter-tag"
            options={[{ value: '', label: 'Mọi tag' }, ...(tags || []).map((t) => ({ value: t, label: `#${t}` }))]} />
          <ClassFilters f={f} update={update} />
        </div>
      )}
    </FilterBar>
  )
}
