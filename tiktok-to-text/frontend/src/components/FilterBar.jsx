// Thanh lọc (DESIGN V.5 CMP-02): form role="search" có tên ("Lọc nguồn"); mỗi ô có nhãn thật; nút Xoá lọc chỉ hiện
// khi đang lọc; số kết quả đọc được (role="status", "128 nguồn"). Giá trị đồng bộ URL do trang lo bằng useUrlState
// (gõ chữ: replace; chọn: replace) — dán link là thấy đúng bộ lọc.
//
// Dùng:
//   <FilterBar label="Lọc nguồn" count={total} unit="nguồn" active={!!st.q || st.status !== ''} onClear={() => set({ q: '', status: '' })}>
//     <SearchField label="Tìm nguồn" value={st.q} onChange={(q) => set({ q, page: 1 })} />
//     <SelectField label="Trạng thái" value={st.status} onChange={…} options={[{ value: '', label: 'Tất cả' }, …]} />
//     <FilterChip pressed={st.mine} onClick={() => set({ mine: !st.mine })}>Của tôi</FilterChip>
//   </FilterBar>
import { useId } from 'react'
import { Icon } from './icons'

export function FilterBar({ label, count, unit = 'mục', active, onClear, children, testId }) {
  return (
    <form role="search" aria-label={label} className="ui-filters" onSubmit={(e) => e.preventDefault()} data-testid={testId}>
      {children}
      {active && onClear && (
        <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" onClick={onClear} data-testid={testId ? `${testId}-clear` : undefined}>
          Xoá lọc
        </button>
      )}
      {count !== undefined && count !== null && (
        <span className="ui-result-count" role="status">{Number(count).toLocaleString('vi-VN')} {unit}</span>
      )}
    </form>
  )
}

export function SearchField({ label, value, onChange, placeholder, testId }) {
  return (
    <label className="ui-search">
      <Icon name="search" size={16} />
      <input type="search" aria-label={label} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        data-testid={testId} />
    </label>
  )
}

// Nhãn hiện ngay trước ô chọn ("Trạng thái:") — không dùng placeholder làm nhãn
export function SelectField({ label, value, onChange, options, testId }) {
  const id = useId()
  return (
    <span className="ui-select">
      <label htmlFor={id}>{label}:</label>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </span>
  )
}

export function FilterChip({ pressed, onClick, children, testId }) {
  return (
    <button type="button" className={`ui-chip${pressed ? ' is-on' : ''}`} aria-pressed={!!pressed} onClick={onClick} data-testid={testId}>
      {children}{pressed && <Icon name="close" size={16} />}
    </button>
  )
}
