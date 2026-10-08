// Chọn một trong 2–4 chế độ (DESIGN V.5 CMP-04): Lưới / Lộ trình, công tắc giao diện Theo máy / Sáng / Tối.
// Mẫu Radio Group của WAI-ARIA APG: role radiogroup / radio, aria-checked; một điểm Tab (mục đang chọn),
// ← → ↑ ↓ chuyển và chọn luôn. Trang ghi giá trị lên URL (?view=) bằng useUrlState nếu người dùng cần mở lại.
import { useRef } from 'react'
import { Icon } from './icons'

export function Segmented({ label, options, value, onChange, testId, size }) {
  const ref = useRef(null)
  const onKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const i = options.findIndex((o) => o.value === value)
    const next = options[(i + step + options.length) % options.length]
    onChange(next.value)
    // tiêu điểm theo mục vừa chọn (sau khi React vẽ lại)
    requestAnimationFrame(() => ref.current?.querySelector(`[data-value="${CSS.escape(next.value)}"]`)?.focus())
  }
  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- điểm Tab nằm ở radio đang chọn (roving tabindex, APG)
    <div ref={ref} role="radiogroup" aria-label={label} className={`ui-seg${size ? ` ui-seg-${size}` : ''}`} onKeyDown={onKeyDown}
      data-testid={testId}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-value={o.value}
            className={on ? 'is-on' : ''} onClick={() => onChange(o.value)} data-testid={testId ? `${testId}-${o.value}` : undefined}>
            {o.icon && <Icon name={o.icon} size={16} />}{o.label}
          </button>
        )
      })}
    </div>
  )
}
