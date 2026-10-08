// Cây dùng chung (DESIGN V.5 CMP-17): lĩnh vực, cơ cấu tổ chức, thư viện bài học — mẫu Tree View của WAI-ARIA APG:
//   ul role="tree" › li role="treeitem" (aria-level, aria-expanded khi có con, aria-selected) › ul role="group".
//   Một điểm Tab (roving tabindex: nút đang chọn, chưa chọn thì nút đầu). ↓ ↑ nút hiện kế tiếp / trước; → mở nhánh,
//   đang mở thì vào con đầu; ← đóng nhánh, đang đóng thì về cha; Home / End; Enter / Space chọn; * mở mọi nhánh
//   cùng cấp; gõ chữ cái nhảy tới nút bắt đầu bằng chữ đó. Tên mỗi nút lấy từ nhãn (aria-labelledby), không gộp chữ
//   của nhánh con. Nút đang chọn ghi URL do trang lo (useUrlState: ?category=, ?unit=).
//
// Dùng:
//   <Tree label="Lĩnh vực" nodes={[{ id, label, count, children: [...] }]} selected={st.category}
//         onSelect={(id) => set({ category: id }, { push: true })} defaultExpanded={['phu-tung']} />
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from './icons'
import { typeaheadIndex } from './ActionMenu'

// Danh sách phẳng các nút đang hiện (cha mở mới hiện con), kèm cấp và cha
export function visibleNodes(nodes, expanded, level = 1, parent = null, out = []) {
  for (const n of nodes || []) {
    out.push({ node: n, level, parent })
    if (n.children?.length && expanded.has(n.id)) visibleNodes(n.children, expanded, level + 1, n.id, out)
  }
  return out
}

// Đường từ gốc tới nút `id` (để tự mở các nhánh cha của nút đang chọn)
export function ancestorsOf(nodes, id, trail = []) {
  for (const n of nodes || []) {
    if (n.id === id) return trail
    const hit = ancestorsOf(n.children, id, [...trail, n.id])
    if (hit) return hit
  }
  return null
}

export function Tree({ label, nodes, selected, onSelect, defaultExpanded = [], testId, renderLabel }) {
  const base = useId()
  const [expanded, setExpanded] = useState(() => new Set([...defaultExpanded, ...(ancestorsOf(nodes, selected) || [])]))
  const [active, setActive] = useState(null)   // nút giữ điểm Tab
  const rootRef = useRef(null)
  const focusNext = useRef(false)
  const flat = useMemo(() => visibleNodes(nodes, expanded), [nodes, expanded])
  const ids = flat.map((f) => f.node.id)
  const tabStop = ids.includes(active) ? active : ids.includes(selected) ? selected : ids[0]

  // Nút đang chọn đổi từ ngoài (URL) → mở các nhánh cha
  useEffect(() => {
    const anc = ancestorsOf(nodes, selected)
    if (anc?.length) setExpanded((s) => (anc.every((a) => s.has(a)) ? s : new Set([...s, ...anc])))
  }, [nodes, selected])

  useEffect(() => {
    if (!focusNext.current) return
    focusNext.current = false
    rootRef.current?.querySelector(`[data-node="${CSS.escape(String(tabStop))}"]`)?.focus()
  })

  const nodeElId = (id) => `${base}-n-${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const moveTo = (id) => { focusNext.current = true; setActive(id) }
  const toggle = (id, open) => setExpanded((s) => {
    const n = new Set(s)
    if (open ?? !n.has(id)) n.add(id)
    else n.delete(id)
    return n
  })

  const onKeyDown = (e) => {
    const i = ids.indexOf(tabStop)
    const cur = flat[i]
    if (!cur) return
    const { node, parent } = cur
    const hasKids = !!node.children?.length
    const isOpen = expanded.has(node.id)
    let handled = true
    switch (e.key) {
      case 'ArrowDown': if (i < ids.length - 1) moveTo(ids[i + 1]); break
      case 'ArrowUp': if (i > 0) moveTo(ids[i - 1]); break
      case 'Home': moveTo(ids[0]); break
      case 'End': moveTo(ids[ids.length - 1]); break
      case 'ArrowRight':
        if (hasKids && !isOpen) toggle(node.id, true)
        else if (hasKids) moveTo(node.children[0].id)
        break
      case 'ArrowLeft':
        if (hasKids && isOpen) toggle(node.id, false)
        else if (parent !== null) moveTo(parent)
        break
      case 'Enter':
      case ' ':
        onSelect?.(node.id)
        break
      case '*': {
        const sibs = parent === null ? nodes : flat.find((f) => f.node.id === parent)?.node.children
        setExpanded((s) => new Set([...s, ...(sibs || []).filter((n) => n.children?.length).map((n) => n.id)]))
        break
      }
      default:
        if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const j = typeaheadIndex(flat.map((f) => f.node.label), i, e.key)
          if (j >= 0) moveTo(ids[j])
        } else handled = false
    }
    if (handled) { e.preventDefault(); e.stopPropagation() }
  }

  const renderNodes = (list, level) => list.map((n) => {
    const hasKids = !!n.children?.length
    const isOpen = expanded.has(n.id)
    const sel = n.id === selected
    const labelId = `${nodeElId(n.id)}-l`
    const countId = `${nodeElId(n.id)}-c`
    return (
      <li key={n.id} role="treeitem" aria-level={level} aria-expanded={hasKids ? isOpen : undefined} aria-selected={sel}
        aria-labelledby={n.count !== undefined && n.count !== null ? `${labelId} ${countId}` : labelId}
        tabIndex={n.id === tabStop ? 0 : -1} data-node={n.id} className="ui-tree-item"
        onFocus={(e) => { if (e.target === e.currentTarget) setActive(n.id) }}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- phím do li[role=treeitem] xử lý (onKeyDown ở ul[role=tree]) */}
        <div className={`ui-tree-row${sel ? ' is-on' : ''}`} style={{ '--level': level }}
          onClick={(e) => { e.stopPropagation(); setActive(n.id); onSelect?.(n.id) }}>
          {hasKids ? (
            <span className={`ui-tree-toggle${isOpen ? ' is-open' : ''}`} aria-hidden="true"
              onClick={(e) => { e.stopPropagation(); setActive(n.id); toggle(n.id) }}>
              <Icon name="chevron-right" size={16} />
            </span>
          ) : <span className="ui-tree-toggle" aria-hidden="true" />}
          <span id={labelId} className="ui-tree-label">{renderLabel ? renderLabel(n) : n.label}</span>
          {n.count !== undefined && n.count !== null && <span id={countId} className="ui-tree-count">{n.count}</span>}
        </div>
        {hasKids && isOpen && <ul role="group" className="ui-tree-group">{renderNodes(n.children, level + 1)}</ul>}
      </li>
    )
  })

  return (
    <ul ref={rootRef} role="tree" aria-label={label} className="ui-tree" onKeyDown={onKeyDown} data-testid={testId}>
      {renderNodes(nodes || [], 1)}
    </ul>
  )
}
