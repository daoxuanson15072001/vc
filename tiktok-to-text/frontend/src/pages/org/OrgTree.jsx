// Tab Sơ đồ (SCR-18): cây đơn vị bên trái (Tree CMP-17, ?unit=<id> | none = chưa xếp đơn vị), người của đơn vị bên
// phải (UnitPanel). Hàng cây chỉ tên + số người; thao tác đơn vị (↑ ↓, sửa, + đơn vị con, ẩn / hiện) nằm trong menu
// Thêm ▾ của đơn vị đang chọn; thêm / sửa đơn vị mở Modal.
import { useMemo, useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { ErrorBox, Loading } from '../../components/ui'
import { Tree } from '../../components/Tree'
import { Modal } from '../../components/Overlay'
import { Icon } from '../../components/icons'
import { confirmDialog } from '../../components/dialog'
import { useUrlState } from '../../urlState'
import { Field, FunctionSelect, KIND, KIND_ORDER, UnitSelect, run } from './shared'
import UnitPanel from './UnitPanel'

const toNodes = (list) => list.map((u) => ({ id: u.id, label: u.name, count: u.member_count, active: u.active, children: toNodes(u.children) }))

export default function OrgTree({ ctx }) {
  const { admin } = ctx
  const { data: tree, error, reload } = useFetch(() => api.orgTree({ include_inactive: admin }), [ctx.version])
  const [st, set] = useUrlState({ unit: { default: '' } })
  const [form, setForm] = useState(null)    // { mode: 'add' | 'edit', parent?, unit?, code, name, kind, parent_id, function }
  const after = () => { reload(); ctx.bump() }

  // Danh sách phẳng + anh em cùng cha của từng đơn vị (để đưa lên / xuống)
  const { flat, siblingsOf } = useMemo(() => {
    const out = []
    const sib = {}
    const walk = (list) => list.forEach((u) => { out.push(u); sib[u.id] = list; walk(u.children) })
    walk(tree?.units || [])
    return { flat: out, siblingsOf: sib }
  }, [tree])
  const nodes = useMemo(() => {
    const n = toNodes(tree?.units || [])
    if (tree?.unassigned > 0) n.push({ id: 'none', label: 'Chưa xếp đơn vị', count: tree.unassigned, active: true })
    return n
  }, [tree])
  const expandedAtStart = useMemo(() => flat.filter((u) => u.depth <= 2 && u.children.length).map((u) => u.id), [flat])
  const selected = flat.find((u) => u.id === st.unit)
  const select = (unit) => set({ unit }, { push: true })

  const move = (u, dir) => {
    const list = [...siblingsOf[u.id]]
    const i = list.findIndex((x) => x.id === u.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    run(async () => {
      for (const [k, x] of list.entries()) if (x.order !== k) await api.patchOrgUnit(x.id, { order: k })
    }, `Đã đưa ${u.name} ${dir < 0 ? 'lên' : 'xuống'}`, after)
  }

  // Hiện lại đơn vị; nhánh con đang ẩn (bị ẩn theo cha) thì hỏi có hiện cả nhánh không — cha trước, con sau
  const show = (u) => run(async () => {
    await api.patchOrgUnit(u.id, { active: true })
    const hidden = flat.filter((x) => x.path.includes(u.id) && !x.active).sort((a, b) => a.depth - b.depth)
    if (hidden.length && await confirmDialog({
      title: `Hiện cả ${hidden.length} đơn vị con đang ẩn của ${u.name}?`,
      body: `Đơn vị con đang ẩn: ${hidden.map((x) => x.code).join(', ')}`,
      okLabel: 'Hiện cả nhánh',
      cancelLabel: 'Chỉ hiện đơn vị này',
    })) {
      for (const x of hidden) await api.patchOrgUnit(x.id, { active: true })
    }
  }, `Đã hiện ${u.name}`, after)
  const hide = (u) => run(() => api.patchOrgUnit(u.id, { active: false }), `Đã ẩn ${u.name}`, after)

  const openAdd = (parent) => {
    const kinds = parent ? KIND_ORDER.slice(KIND_ORDER.indexOf(parent.kind) + 1) : ['group']
    setForm({ mode: 'add', parent, code: parent ? `${parent.code}-` : '', name: '', kind: parent?.kind === 'group' ? 'division' : kinds[0], function: '' })
  }
  const openEdit = (u) => setForm({ mode: 'edit', unit: u, code: u.code, name: u.name, kind: u.kind, parent_id: u.parent_id || '', function: u.function || '' })

  const unitActions = (u) => {
    if (!admin || !u) return []
    const sibs = siblingsOf[u.id] || []
    const i = sibs.findIndex((x) => x.id === u.id)
    return [
      { label: 'Sửa đơn vị…', icon: 'pencil', onSelect: () => openEdit(u), testId: 'org-unit-edit' },
      u.active && u.kind !== 'team' && u.depth < 4 && { label: 'Thêm đơn vị con…', icon: 'plus', onSelect: () => openAdd(u), testId: 'org-unit-add' },
      { label: 'Đưa lên', icon: 'arrow-up', disabled: i <= 0, onSelect: () => move(u, -1), testId: 'org-unit-up' },
      { label: 'Đưa xuống', icon: 'arrow-down', disabled: i < 0 || i >= sibs.length - 1, onSelect: () => move(u, 1), testId: 'org-unit-down' },
      u.active
        ? { label: 'Ẩn đơn vị', icon: 'eye-off', onSelect: () => hide(u), testId: 'org-unit-hide' }
        : { label: 'Hiện đơn vị', icon: 'eye', onSelect: () => show(u), testId: 'org-unit-show' },
    ]
  }

  return (
    <div className="org-split">
      <section className="card org-tree-card" aria-labelledby="org-tree-h">
        <div className="org-card-head">
          <h2 id="org-tree-h" className="org-h2">Cây đơn vị</h2>
          {admin && (
            <button type="button" className="ui-btn ui-btn-sm" data-testid="org-root-add" onClick={() => openAdd(null)}>
              <Icon name="plus" size={16} />Thêm tập đoàn
            </button>
          )}
        </div>
        {admin && <p className="muted small">Tối đa 4 tầng. Không xoá đơn vị — chỉ ẩn, và chỉ ẩn được khi không còn ai đang làm ở đó.</p>}
        <ErrorBox>{error}</ErrorBox>
        {!tree && !error && <Loading />}
        {tree && !nodes.length && <p className="muted">Chưa có đơn vị nào.{admin ? ' Bấm Thêm tập đoàn để bắt đầu, hoặc nhập ở tab Nhập dữ liệu.' : ''}</p>}
        {nodes.length > 0 && (
          <Tree label="Cây đơn vị" nodes={nodes} selected={st.unit || null} onSelect={select} defaultExpanded={expandedAtStart}
            testId="org-tree"
            renderLabel={(n) => <>{n.label}{!n.active && <span className="ui-badge org-tree-badge" data-tone="muted" data-status="hidden">Đã ẩn</span>}</>} />
        )}
      </section>
      <UnitPanel ctx={ctx} unit={selected} unassigned={st.unit === 'none'} actions={unitActions(selected)} />
      {form && <UnitModal ctx={ctx} flat={flat} form={form} setForm={setForm} onSaved={(u) => { after(); if (u?.id) select(u.id) }} />}
    </div>
  )
}

function UnitModal({ ctx, flat, form, setForm, onSaved }) {
  const edit = form.mode === 'edit'
  const kinds = edit ? KIND_ORDER : form.parent ? KIND_ORDER.slice(KIND_ORDER.indexOf(form.parent.kind) + 1) : ['group']
  const below = edit ? flat.filter((x) => x.path.includes(form.unit.id)).map((x) => x.id) : []
  const title = edit ? `Sửa đơn vị ${form.unit.name}` : form.parent ? `Thêm đơn vị con của ${form.parent.name}` : 'Thêm tập đoàn'
  const close = () => setForm(null)
  const submit = async (e) => {
    e.preventDefault()
    const body = { code: form.code, name: form.name, kind: form.kind, function: form.function || null }
    const r = edit
      ? await run(() => api.patchOrgUnit(form.unit.id, { ...body, parent_id: form.parent_id || null }), `Đã lưu đơn vị ${form.name}`)
      : await run(() => api.createOrgUnit({ ...body, parent_id: form.parent?.id || null }), `Đã thêm đơn vị ${form.name}`)
    if (r) { close(); onSaved(r) }
  }
  const change = (k) => (e) => setForm({ ...form, [k]: k === 'code' ? e.target.value.toUpperCase() : e.target.value })
  return (
    <Modal open title={title} onClose={close} testId="org-unit-modal"
      footer={(
        <>
          <button type="button" className="ui-btn" onClick={close}>Huỷ</button>
          <button type="submit" form="org-unit-form" className="ui-btn ui-btn-primary" data-testid="org-unit-save">{edit ? 'Lưu đơn vị' : 'Thêm đơn vị'}</button>
        </>
      )}>
      <form id="org-unit-form" onSubmit={submit}>
        <label className="field"><span>Mã đơn vị</span>
          <input value={form.code} onChange={change('code')} placeholder="vd VCPART-KD" required />
          <small>Duy nhất trong cả cây; chữ in hoa, chữ số, gạch ngang</small>
        </label>
        <label className="field"><span>Tên đơn vị</span><input value={form.name} onChange={change('name')} required /></label>
        <label className="field"><span>Loại đơn vị</span>
          <select value={form.kind} onChange={change('kind')}>
            {kinds.map((k) => <option key={k} value={k}>{KIND[k]}</option>)}
          </select>
        </label>
        {edit && (
          <Field label="Đơn vị cha">{(id) => <UnitSelect id={id} units={ctx.units} value={form.parent_id} onChange={(v) => setForm({ ...form, parent_id: v })} empty="— Không có cha (gốc) —" exclude={[form.unit.id, ...below]} />}</Field>
        )}
        <Field label="Chức năng">{(id) => <FunctionSelect id={id} functions={ctx.functions} value={form.function} onChange={(v) => setForm({ ...form, function: v })} empty="— Không —" />}</Field>
      </form>
    </Modal>
  )
}
