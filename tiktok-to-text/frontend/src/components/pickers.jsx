import { useMemo, useState } from 'react'
import { unaccentLower } from '../text'
import { Modal } from './Overlay'
import { Tree } from './Tree'

// Dựng cây từ danh sách phẳng lĩnh vực (API trả theo level, order).
// Nút có cha không nằm trong danh sách (cha đã ẩn) bị bỏ, không đẩy lên làm gốc.
export function buildTree(cats) {
  const byId = new Map(cats.map((c) => [c.id, { ...c, children: [] }]))
  const roots = []
  byId.forEach((c) => {
    if (!c.parent_id) roots.push(c)
    else if (byId.has(c.parent_id)) byId.get(c.parent_id).children.push(c)
  })
  return roots
}

export function categoryLabel(cats, slug) {
  const bySlug = new Map((cats || []).map((c) => [c.slug, c]))
  const c = bySlug.get(slug)
  if (!c) return slug
  const parent = slug.includes('.') ? bySlug.get(slug.slice(0, slug.lastIndexOf('.'))) : null
  return parent ? `${parent.name} › ${c.name}` : c.name
}

export function CategoryChips({ cats, value = [] }) {
  if (!value.length) return null
  return (
    <span className="chips">
      {value.map((s) => <span key={s} className="chip">{categoryLabel(cats, s)}</span>)}
    </span>
  )
}

// Chọn nhiều lĩnh vực: chip đã chọn + nút mở Modal có ô lọc (SCR-06, CMP-08). Esc / bấm nền mờ để đóng.
export function CategoryPicker({ cats, value, onChange, max = 3 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const tree = useMemo(() => buildTree(cats || []), [cats])
  const toggle = (slug) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : value.length >= max ? value : [...value, slug])
  const match = (c) => !q || unaccentLower(c.name).includes(unaccentLower(q))
  const close = () => { setOpen(false); setQ('') }

  const renderNode = (c, depth) => {
    const kids = c.children.map((k) => renderNode(k, depth + 1)).filter(Boolean)
    if (!match(c) && !kids.length) return null
    return (
      <div key={c.id}>
        <label className="pick-row" data-depth={depth} title={c.description}>
          <input type="checkbox" checked={value.includes(c.slug)} onChange={() => toggle(c.slug)} />
          <span className={depth === 0 ? 'strong' : ''}>{c.name}</span>
        </label>
        {kids}
      </div>
    )
  }

  return (
    <div className="picker">
      <div className="picker-value">
        {value.map((s) => (
          <span key={s} className="chip">
            {categoryLabel(cats, s)}
            <button type="button" onClick={() => toggle(s)} aria-label={`Bỏ lĩnh vực ${categoryLabel(cats, s)}`} title="Bỏ">×</button>
          </span>
        ))}
        <button type="button" className="ui-btn ui-btn-sm" aria-haspopup="dialog" data-testid="category-picker-open" onClick={() => setOpen(true)}>
          {value.length ? 'Đổi lĩnh vực' : `Chọn lĩnh vực (tối đa ${max})`}
        </button>
      </div>
      <Modal open={open} title="Chọn lĩnh vực" sub={`Đã chọn ${value.length}/${max}`} onClose={close} initialFocus=".picker-filter"
        footer={<button type="button" className="ui-btn ui-btn-primary" onClick={close}>Xong</button>}>
        <input className="picker-filter" placeholder="Lọc lĩnh vực…" aria-label="Lọc lĩnh vực" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="picker-list">{tree.map((c) => renderNode(c, 0))}</div>
      </Modal>
    </div>
  )
}

// Cây lĩnh vực dùng làm bộ lọc (cột trái VCWIKI, thư viện bài học): Tree (CMP-17, APG Tree View — ↑ ↓ → ← Home End Enter).
// Bấm lại nhánh đang chọn thì bỏ lọc; "Tất cả lĩnh vực" là nút riêng phía trên cây; cây mặc định mở hết.
function toNodes(list) {
  return list.map((c) => ({ id: c.slug, label: c.name, description: c.description, count: c.card_count > 0 ? c.card_count : undefined, children: toNodes(c.children) }))
}

export function CategoryTree({ cats, value, onSelect }) {
  const tree = useMemo(() => buildTree(cats || []), [cats])
  const nodes = useMemo(() => toNodes(tree), [tree])
  const parents = useMemo(() => (cats || []).filter((c) => (cats || []).some((k) => k.parent_id === c.id)).map((c) => c.slug), [cats])
  const [rev, setRev] = useState({ n: 0, open: true })   // đổi n = dựng lại cây với trạng thái mở / thu mới
  const setAll = (open) => setRev({ n: rev.n + 1, open })
  return (
    <div data-testid="category-tree">
      <div className="wiki-tree-top">
        <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost wiki-tree-all" aria-current={!value ? 'true' : undefined}
          onClick={() => onSelect('')}>Tất cả lĩnh vực</button>
        {parents.length > 0 && (
          <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" onClick={() => setAll(!rev.open)}
            title={rev.open ? 'Thu gọn mọi nhánh' : 'Mở rộng mọi nhánh'}>
            {rev.open ? '⊟ Thu hết' : '⊞ Mở hết'}
          </button>
        )}
      </div>
      <Tree key={`${rev.n}:${parents.join(',')}`} label="Lĩnh vực" nodes={nodes} selected={value || undefined}
        defaultExpanded={rev.open ? parents : []} onSelect={(slug) => onSelect(value === slug ? '' : slug)}
        renderLabel={(n) => <span title={n.description || undefined}>{n.label}</span>} />
    </div>
  )
}

// Nhãn một kho trong ô chọn: kho chia sẻ ghi rõ "(chia sẻ)", kho cá nhân của mình "★ … (cá nhân)", kho người khác
// thêm tên chủ kho. Test e2e chọn theo nhãn này (fixtures.spaceLabel).
export const spaceLabel = (s) => {
  if (!s) return ''
  const own = s.my_role === 'owner'
  if (s.type === 'personal') return `${own ? '★ ' : ''}${s.name} (cá nhân${own ? '' : ` · ${s.owner?.name || ''}`})`
  return `${s.name} (chia sẻ${own ? '' : ` · ${s.owner?.name || ''}`})`
}

// Chọn kho; editableOnly = chỉ kho có quyền sửa (để nạp / tạo thẻ). `testId` / `label` để AI và test tìm đúng ô.
export function SpaceSelect({ spaces, value, onChange, editableOnly, allowAll, testId, label }) {
  const list = (spaces || []).filter((s) => !editableOnly || ['owner', 'editor'].includes(s.my_role))
  return (
    // Ô lọc (allowAll) đứng một mình, không nằm trong <label>: tên cho máy đọc mặc định "Kho" (axe select-name)
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} aria-label={label || (allowAll ? 'Kho' : undefined)}>
      {allowAll && <option value="">Tất cả kho tôi xem được</option>}
      {list.map((s) => <option key={s.id} value={s.id} data-space-type={s.type}>{spaceLabel(s)}</option>)}
    </select>
  )
}

// Tag của tài liệu, sửa tại chỗ. `inherited`: tag trên thẻ VCWIKI dẫn về tài liệu (chỉ xem).
// Gợi ý lấy từ <datalist id="kb-tag-list"> do trang cha dựng.
export function TagEditor({ value = [], inherited = [], canEdit, onChange }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const fromCards = inherited.filter((t) => !value.includes(t))
  if (!canEdit && !value.length && !fromCards.length) return null

  const save = async (tags) => {
    setBusy(true)
    try {
      await onChange(tags)
    } finally {
      setBusy(false)
    }
  }
  const add = (e) => {
    e.preventDefault()
    const t = input.trim()
    if (!t) return
    setInput('')
    save([...value, t])
  }

  return (
    <div className="tags">
      {value.map((t) => canEdit ? (
        <span key={t} className="tag tag-edit">
          #{t}
          <button className="tag-x" aria-label={`Bỏ tag ${t}`} disabled={busy} onClick={() => save(value.filter((x) => x !== t))}>×</button>
        </span>
      ) : <span key={t} className="tag">#{t}</span>)}
      {fromCards.map((t) => (
        <span key={t} className="tag tag-inherited" title="Tag của thẻ VCWIKI dựng từ tài liệu này">#{t}</span>
      ))}
      {canEdit && (
        <form onSubmit={add}>
          <input className="tag-input" list="kb-tag-list" value={input} disabled={busy}
            onChange={(e) => setInput(e.target.value)} placeholder="+ thêm tag, Enter" aria-label="Thêm tag cho tài liệu" />
        </form>
      )}
    </div>
  )
}

// Chọn dự án marketing (BA 5.13) trong một kho; `allowNone`: cho phép không thuộc dự án nào
export function ProjectSelect({ projects, value, onChange, allowNone = true, label = 'Không thuộc dự án', ariaLabel }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} aria-label={ariaLabel}>
      {allowNone && <option value="">{label}</option>}
      {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  )
}
