import { useMemo, useState } from 'react'
import { api } from '../api'
import { useFetch } from '../hooks'
import { dateTime } from '../format'
import { Badge, ErrorBox } from './ui'
import { confirmDialog } from './dialog'
import { buildTree, categoryLabel } from './pickers'
import { useSession } from '../session'
import { unaccentLower } from '../text'

// Như categories.slugify ở backend: 'VCgarage & VCsale' -> 'vcgarage-vcsale'
const slugify = (name) => unaccentLower(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'linh-vuc'
const slugHead = (slug) => (slug.includes('.') ? slug.slice(0, slug.lastIndexOf('.') + 1) : '')
const slugTail = (slug) => slug.slice(slug.lastIndexOf('.') + 1)

// Liên kết tra cứu của nhánh <-> ô nhập nhiều dòng "Tên | https://… | ghi chú"
const linksToText = (links) => (links || []).map((l) => [l.label, l.url, l.note].filter(Boolean).join(' | ')).join('\n')
function parseLinks(text) {
  const links = []
  for (const [i, line] of text.split('\n').entries()) {
    if (!line.trim()) continue
    const [label = '', url = '', ...rest] = line.split('|').map((x) => x.trim())
    if (!url) throw new Error(`Liên kết dòng ${i + 1}: cần dạng “Tên | https://… | ghi chú”`)
    links.push({ label, url, note: rest.join(' | ') })
  }
  return links
}

// Sửa cây lĩnh vực dùng chung toàn công ty — mọi người dùng thêm / sửa / ẩn / xoá nhánh rỗng (trang /wiki và /admin).
// Gán chủ nhánh (người duyệt thẻ trong nhánh) chỉ quản trị viên. onChanged: báo trang cha tải lại cây.
export function CategoryEditor({ onChanged, stacked }) {
  const { user } = useSession()
  const isAdmin = user?.role === 'admin'
  const { data: cats, reload } = useFetch(() => api.categories({ include_inactive: true }), [])
  const { data: sugg, reload: reloadSugg } = useFetch(api.categorySuggestions, [])
  const { data: users } = useFetch(() => (isAdmin ? api.users() : Promise.resolve([])), [isAdmin])
  const tree = useMemo(() => buildTree(cats || []), [cats])
  const [adding, setAdding] = useState(null)   // parent id | 'root'
  const [form, setForm] = useState({ name: '', description: '' })
  const [editing, setEditing] = useState(null)
  const [err, setErr] = useState(null)         // { at: chỗ thao tác (id nhánh / 'add:<cha>' / 'sugg'), text }
  // Thu gọn / mở rộng từng nhánh (như cây lọc cột trái VCWIKI); mặc định mở hết
  const [collapsed, setCollapsed] = useState({})
  const parentIds = useMemo(() => (cats || []).filter((c) => (cats || []).some((k) => k.parent_id === c.id)).map((c) => c.id), [cats])
  const anyOpen = parentIds.some((id) => !collapsed[id])
  const setAll = (close) => setCollapsed(close ? Object.fromEntries(parentIds.map((id) => [id, true])) : {})

  // at: lỗi hiện ngay dưới dòng / form vừa thao tác, không nằm cuối cây ngoài màn hình
  const act = async (fn, at) => {
    setErr(null)
    try {
      await fn()
      reload()
      reloadSugg()
      onChanged?.()
      return true
    } catch (e) {
      setErr({ at, text: e.message })
      return false
    }
  }
  const errAt = (at) => err?.at === at && <ErrorBox>{err.text}</ErrorBox>

  // Xoá nhánh (mọi cấp, kể cả cấp 1) cùng nhánh con: nhánh lá không thẻ thì hỏi xác nhận rồi xoá; còn nhánh con / thẻ
  // hoặc server báo còn dữ liệu (409) thì mở khung chọn nhánh nhận dữ liệu — chuyển sang đó rồi xoá
  const [deleting, setDeleting] = useState(null)   // { id, moveTo }
  const remove = async (c) => {
    if (c.children.length || c.card_count) return setDeleting({ id: c.id, moveTo: '' })
    if (!(await confirmDialog({ title: `Xoá hẳn nhánh “${c.name}” (${c.slug})?`, okLabel: 'Xoá nhánh', danger: true }))) return
    if (!(await act(() => api.deleteCategory(c.id), c.id))) setDeleting({ id: c.id, moveTo: '' })
  }
  const subtreeIds = (c) => [c.id, ...c.children.flatMap(subtreeIds)]
  const flat = (list, depth = 0) => list.flatMap((c) => [{ c, depth }, ...flat(c.children, depth + 1)])
  const deleteForm = (c, depth) => {
    const skip = new Set(subtreeIds(c))
    const kids = subtreeIds(c).length - 1
    return (
      <>
        <div className="cat-row cat-delete" style={{ paddingLeft: 8 + depth * 20 }}>
          <span className="grow small">
            Xoá <span className="strong">{c.name}</span>{kids > 0 && ` cùng ${kids} nhánh con`}
            {c.card_count > 0 && ` — ${c.card_count} thẻ`}. Thẻ, tài liệu, nguồn, lộ trình học đang gắn chuyển sang:
          </span>
          <select value={deleting.moveTo} aria-label="Nhánh nhận dữ liệu" onChange={(e) => setDeleting({ ...deleting, moveTo: e.target.value })}>
            <option value="">— không chuyển (chỉ xoá được khi cả nhánh rỗng) —</option>
            {flat(tree).filter(({ c: k }) => k.active && !skip.has(k.id)).map(({ c: k, depth: d }) => (
              <option key={k.id} value={k.slug}>{'\u00a0\u00a0'.repeat(d)}{k.code ? `${k.code} ` : ''}{k.name}</option>
            ))}
          </select>
          <button className="btn btn-danger" onClick={async () => {
            const target = deleting.moveTo && categoryLabel(cats, deleting.moveTo)
            if (!(await confirmDialog({
              title: `Xoá hẳn “${c.name}”${kids ? ` và ${kids} nhánh con` : ''}?`,
              body: `${target ? `Dữ liệu đang gắn chuyển sang “${target}”. ` : ''}Không hoàn tác được.`,
              okLabel: 'Xoá cả nhánh', danger: true,
            }))) return
            if (await act(() => api.deleteCategory(c.id, deleting.moveTo || undefined), `del:${c.id}`)) setDeleting(null)
          }}>Xoá cả nhánh</button>
          <button className="btn btn-ghost" onClick={() => setDeleting(null)}>Huỷ</button>
        </div>
        {errAt(`del:${c.id}`)}
      </>
    )
  }

  const save = async (c) => {
    let links
    try { links = parseLinks(editing.links) } catch (e) { setErr({ at: c.id, text: e.message }); return false }
    const body = { name: editing.name, description: editing.description, code: editing.code, scope_note: editing.scope_note,
      slug: slugHead(c.slug) + (editing.tail.trim() || slugify(editing.name)), links }
    if (body.slug !== c.slug && c.card_count > 0 &&
        !(await confirmDialog({
          title: `Đổi đường dẫn “${c.slug}” → “${body.slug}”?`,
          body: `${c.card_count} thẻ và dữ liệu đang gắn nhánh này (cả nhánh con) sẽ chuyển theo; link cũ vẫn mở được.`,
          okLabel: 'Đổi đường dẫn',
        }))) return false
    if (isAdmin) body.owner_id = editing.owner_id
    return act(() => api.patchCategory(c.id, body), c.id)
  }

  const node = (c, depth, parentActive = true) => (
    <div key={c.id}>
      <div className={`cat-row ${c.active ? '' : 'inactive'}`} style={{ paddingLeft: 8 + depth * 20 }}>
        {c.children.length ? (
          <button className="tree-toggle" onClick={() => setCollapsed({ ...collapsed, [c.id]: !collapsed[c.id] })}
            aria-expanded={!collapsed[c.id]} aria-label={`${collapsed[c.id] ? 'Mở' : 'Thu gọn'} ${c.name}`}>
            {collapsed[c.id] ? '▸' : '▾'}
          </button>
        ) : <span className="tree-toggle" />}
        {editing?.id === c.id ? (
          <>
            <input value={editing.name} aria-label="Tên lĩnh vực" onChange={(e) => {
              const name = e.target.value
              // slug chạy theo tên cho tới khi người dùng tự sửa ô slug
              setEditing({ ...editing, name, tail: editing.tailTouched ? editing.tail : (name === c.name ? slugTail(c.slug) : slugify(name)) })
            }} />
            <span className="cat-slug" title="Đường dẫn /wiki?category=… — đổi thì dữ liệu đang gắn chuyển theo, link cũ vẫn mở được">
              <span className="muted small">{slugHead(c.slug)}</span>
              <input value={editing.tail} aria-label="Slug" placeholder={slugify(editing.name)}
                onChange={(e) => setEditing({ ...editing, tail: e.target.value, tailTouched: true })} />
            </span>
            <input className="cat-code" aria-label="Mã" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="Mã, vd 1.3.2" />
            <input value={editing.description} aria-label="Mô tả" onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Mô tả (AI dùng để phân loại)" />
            {isAdmin && (
              <select value={editing.owner_id} onChange={(e) => setEditing({ ...editing, owner_id: e.target.value })} aria-label="Chủ nhánh">
                <option value="">— chưa có chủ nhánh —</option>
                {(users || []).filter((u) => u.active || u.id === editing.owner_id).map((u) => <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
              </select>
            )}
            <textarea rows={4} aria-label="Scope note" value={editing.scope_note} onChange={(e) => setEditing({ ...editing, scope_note: e.target.value })}
              placeholder={'Gồm: …\nKhông gồm: … → <mã nhánh đúng>\nDễ nhầm với: <mã> — phân biệt: …\nVí dụ thẻ: …'} />
            <textarea rows={3} value={editing.links} aria-label="Liên kết tra cứu" onChange={(e) => setEditing({ ...editing, links: e.target.value })}
              title="Hiện thành nút mở tab mới khi lọc VCWIKI theo nhánh này (và nhánh con) — tối đa 20 dòng"
              placeholder={'Liên kết tra cứu, mỗi dòng: Tên | https://… | ghi chú\nvd: Tra mã Febi | https://partsfinder.bilsteingroup.com | catalog Febi, Blue Print'} />
            <button className="btn btn-primary" onClick={async () => (await save(c)) && setEditing(null)}>Lưu</button>
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>Huỷ</button>
          </>
        ) : (
          <>
            <span className="grow">
              {c.code && <span className="muted small">{c.code} </span>}
              <span className={depth === 0 ? 'strong' : ''}>{c.name}</span>
              <span className="muted small"> · {c.slug}{c.description ? ` · ${c.description}` : ''}</span>
              {c.owner_name && <span className="muted small"> · chủ nhánh {c.owner_name}</span>}
              {c.scope_note && <span className="small" title={c.scope_note}> · scope note ✓</span>}
              {c.links?.length > 0 && <span className="small" title={c.links.map((l) => `${l.label} — ${l.url}`).join('\n')}> · {c.links.length} liên kết</span>}
              {!c.active && <> <Badge tone="muted">Đã ẩn</Badge></>}
            </span>
            <span className="muted small">{c.card_count} thẻ</span>
            <button className="link small" aria-label={`Sửa nhánh ${c.name}`} onClick={() => setEditing({ id: c.id, tail: slugTail(c.slug), name: c.name, description: c.description, code: c.code || '', scope_note: c.scope_note || '', links: linksToText(c.links), owner_id: c.owner_id || '' })}>Sửa</button>
            {c.level < 4 && c.active && <button className="link small" aria-label={`+ Nhánh con của ${c.name}`} onClick={() => { setAdding(c.id); setForm({ name: '', description: '' }); setCollapsed({ ...collapsed, [c.id]: false }) }}>+ Nhánh con</button>}
            {c.active || parentActive
              ? <button className="link small" aria-label={`${c.active ? 'Ẩn' : 'Hiện'} nhánh ${c.name}`} onClick={() => act(() => api.patchCategory(c.id, { active: !c.active }), c.id)}>{c.active ? 'Ẩn' : 'Hiện'}</button>
              : <span className="muted small" title="Nhánh cha đang ẩn — hiện nhánh cha trước (các nhánh con ẩn theo cha sẽ hiện lại cùng)">Cha đang ẩn</span>}
            <button className="link small tone-bad" aria-label={`Xoá nhánh ${c.name}`} onClick={() => remove(c)}>Xoá</button>
          </>
        )}
      </div>
      {errAt(c.id)}
      {deleting?.id === c.id && deleteForm(c, depth)}
      {adding === c.id && addForm(c.id, depth + 1)}
      {!collapsed[c.id] && c.children.map((k) => node(k, depth + 1, parentActive && c.active))}
    </div>
  )

  const addForm = (parentId, depth) => (
    <>
      <form className="cat-row" style={{ paddingLeft: 8 + depth * 20 }} onSubmit={async (e) => {
        e.preventDefault()
        if (!form.name.trim()) return setErr({ at: `add:${parentId}`, text: 'Tên lĩnh vực không được để trống' })
        if (await act(() => api.createCategory({ ...form, slug: form.slug?.trim() || null, code: form.code?.trim() || null, parent_id: parentId === 'root' ? null : parentId }), `add:${parentId}`)) setAdding(null)
      }}>
        <input placeholder="Tên lĩnh vực" aria-label="Tên lĩnh vực" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
        <input placeholder="Mô tả ngắn" aria-label="Mô tả ngắn" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input placeholder="Slug (tuỳ chọn, vd mkt.digital.seo)" aria-label="Slug (tuỳ chọn)" value={form.slug || ''} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <input className="cat-code" placeholder="Mã" aria-label="Mã" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        <textarea rows={2} aria-label="Scope note (tuỳ chọn)" placeholder="Scope note (tuỳ chọn): Gồm / Không gồm / Dễ nhầm với / Ví dụ thẻ" value={form.scope_note || ''} onChange={(e) => setForm({ ...form, scope_note: e.target.value })} />
        <button className="btn btn-primary">Thêm</button>
        <button type="button" className="btn btn-ghost" onClick={() => setAdding(null)}>Huỷ</button>
      </form>
      {errAt(`add:${parentId}`)}
    </>
  )

  return (
    <div className={stacked ? 'stack' : 'split split-wide'}>
      <section className="card">
        <div className="card-head">
          <h2>Cây lĩnh vực</h2>
          <span className="row-actions-inline">
            {parentIds.length > 0 && (
              <button className="btn btn-ghost" onClick={() => setAll(anyOpen)} title={anyOpen ? 'Thu gọn mọi nhánh' : 'Mở rộng mọi nhánh'}>
                {anyOpen ? '⊟ Thu hết' : '⊞ Mở hết'}
              </button>
            )}
            <button className="btn" onClick={() => { setAdding('root'); setForm({ name: '', description: '' }) }}>+ Lĩnh vực cấp 1</button>
          </span>
        </div>
        <p className="muted small">Tối đa 4 cấp (Mảng → Chuyên ngành → Chuyên môn → Đầu việc). Đổi tên thì slug (đường dẫn) đổi theo — thẻ, tài liệu, nhánh con đã gắn chuyển sang slug mới, link cũ vẫn mở được. Ẩn nhánh cha sẽ ẩn cả nhánh con. Xoá một nhánh (kể cả cấp 1) là xoá cả nhánh con — còn thẻ, tài liệu thì chọn nhánh nhận để chuyển sang; muốn giữ thì ẩn. Mô tả càng rõ, AI phân loại càng đúng.</p>
        {adding === 'root' && addForm('root', 0)}
        {tree.map((c) => node(c, 0))}
      </section>
      <section className="card">
        <h2>AI đề xuất lĩnh vực mới</h2>
        <p className="muted small">Khi nội dung không khớp nhánh nào, AI ghi đề xuất ở đây — bấm Thêm để đưa vào cây.</p>
        {(sugg || []).length === 0 && <p className="muted">Chưa có đề xuất.</p>}
        <ul className="member-list">
          {(sugg || []).map((s) => (
            <li key={s.id}>
              <span className="grow">
                <span className="strong">{s.name}</span>
                <span className="muted small"> · dưới {s.parent_slug ? categoryLabel(cats, s.parent_slug) : 'gốc'} · {s.count} lần · {dateTime(s.created_at)}</span>
                <div className="small">{s.reason}</div>
              </span>
              <button className="btn btn-primary" aria-label={`Thêm lĩnh vực đề xuất ${s.name}`} onClick={() => act(() => api.acceptSuggestion(s.id), 'sugg')}>Thêm</button>
              <button className="btn btn-ghost" aria-label={`Bỏ đề xuất ${s.name}`} onClick={() => act(() => api.rejectSuggestion(s.id), 'sugg')}>Bỏ</button>
            </li>
          ))}
        </ul>
        {errAt('sugg')}
      </section>
    </div>
  )
}
