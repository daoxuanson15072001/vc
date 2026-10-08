// Tab dùng chung (DESIGN V.5 CMP-03, AIX-06) — hai kiểu:
//   kind="route": mỗi tab là một route (nav + NavLink, tab đang mở aria-current="page"), Tab / Enter như liên kết thường.
//   kind="panel": mẫu Tabs của WAI-ARIA APG — role tablist / tab / tabpanel, aria-selected, aria-controls; chỉ tab
//     đang chọn nằm trong thứ tự Tab (roving tabindex); ← → xoay vòng, Home / End; mặc định chọn theo tiêu điểm
//     (activation="manual" thì phải Enter / Space). Tab đang chọn ghi lên URL ở `urlKey` (mặc định ?tab=, push).
// Số đếm (count) hiện bằng chữ trong tab — máy đọc đọc được "Bài viết 24".
//
// Dùng:
//   <Tabs kind="route" label="Chế độ VCWIKI" items={[{ to: '/wiki', label: 'Thẻ', end: true }, { to: '/wiki/graph', label: 'Bản đồ' }]} />
//   <Tabs kind="panel" label="Khu dự án" items={[{ id: 'overview', label: 'Tổng quan', content: <Overview/> }, …]} />
import { useId, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useUrlState } from '../urlState'

export function Tabs({ kind = 'panel', ...props }) {
  return kind === 'route' ? <RouteTabs {...props} /> : <PanelTabs {...props} />
}

function Count({ n }) {
  if (n === undefined || n === null) return null
  return <span className="ui-tab-count">{n}</span>
}

function RouteTabs({ label, items, testId, className = '' }) {
  return (
    <nav className={`ui-tabs ${className}`} aria-label={label} data-testid={testId}>
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `ui-tab${isActive ? ' is-on' : ''}`}
          data-testid={it.testId}>
          {it.label}<Count n={it.count} />
        </NavLink>
      ))}
    </nav>
  )
}

function UrlPanelTabs(props) {
  const { urlKey = 'tab', items } = props
  const [st, set] = useUrlState({ [urlKey]: { default: items[0]?.id, values: items.map((i) => i.id) } })
  return <PanelTabsView {...props} value={st[urlKey]} onChange={(v) => set({ [urlKey]: v }, { push: true })} />
}

function PanelTabs(props) {
  // Có value + onChange: trang tự giữ trạng thái; không có: ghi lên URL
  if (props.onChange) return <PanelTabsView {...props} />
  return <UrlPanelTabs {...props} />
}

function PanelTabsView({ label, items, value, onChange, activation = 'auto', testId, keepMounted = false }) {
  const base = useId()
  const listRef = useRef(null)
  const current = items.some((i) => i.id === value) ? value : items[0]?.id
  const tabId = (id) => `${base}-t-${id}`
  const panelId = (id) => `${base}-p-${id}`

  const onKeyDown = (e) => {
    const tabs = [...(listRef.current?.querySelectorAll('[role="tab"]:not([disabled])') || [])]
    const i = tabs.indexOf(document.activeElement)
    let j = null
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = tabs.length - 1
    if (j === null) return
    e.preventDefault()
    tabs[j].focus()
    if (activation === 'auto') onChange(tabs[j].dataset.tab)
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- điểm Tab nằm ở tab đang chọn (roving tabindex, APG) */}
      <div ref={listRef} role="tablist" aria-label={label} className="ui-tabs" onKeyDown={onKeyDown} data-testid={testId}>
        {items.map((it) => {
          const on = it.id === current
          return (
            <button key={it.id} type="button" role="tab" id={tabId(it.id)} aria-selected={on} aria-controls={panelId(it.id)}
              tabIndex={on ? 0 : -1} disabled={it.disabled} className={`ui-tab${on ? ' is-on' : ''}`} data-tab={it.id}
              onClick={() => onChange(it.id)} data-testid={it.testId}>
              {it.label}<Count n={it.count} />
            </button>
          )
        })}
      </div>
      {items.map((it) => {
        const on = it.id === current
        // Panel ẩn vẫn có phần tử (aria-controls trỏ tới được) nhưng không dựng nội dung, trừ keepMounted
        return (
          <div key={it.id} role="tabpanel" id={panelId(it.id)} aria-labelledby={tabId(it.id)} hidden={!on} tabIndex={0}
            className="ui-tabpanel" data-testid={it.testId ? `${it.testId}-panel` : undefined}>
            {(on || keepMounted) && it.content}
          </div>
        )
      })}
    </>
  )
}
