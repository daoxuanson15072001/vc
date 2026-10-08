// Hộp *Chia sẻ kho* (SCR-19.1, CMP-08): Segmented *Người · Đơn vị*.
// - Người: email + quyền Xem / Sửa (POST /api/spaces/{id}/members) — chỉ chủ kho.
// - Đơn vị: chọn đơn vị bằng Tree (CMP-17, cây /api/org/tree), ô *Gồm đơn vị con*, quyền Xem / Sửa
//   (POST /api/spaces/{id}/units). Quyền Quản lý chỉ chủ kho — không cấp được.
import { useId, useMemo, useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { num } from '../../format'
import { ErrorBox, Loading } from '../../components/ui'
import { Modal } from '../../components/Overlay'
import { Segmented } from '../../components/Segmented'
import { Tree } from '../../components/Tree'
import { GRANT_ROLES } from './shared'

const toNodes = (units) => (units || []).map((u) => ({ id: u.id, label: u.name, count: `${num(u.member_count)} người`, children: toNodes(u.children) }))

// id -> { node, path: [tên từ gốc], all: [id của nút và mọi con cháu] }
function indexTree(units, trail = [], out = {}) {
  for (const u of units || []) {
    indexTree(u.children, [...trail, u.name], out)
    const kids = (u.children || []).flatMap((c) => out[c.id].all)
    out[u.id] = { unit: u, path: [...trail, u.name], all: [u.id, ...kids] }
  }
  return out
}

export function ShareModal({ open, space: s, onClose, onShared }) {
  if (!open) return null
  return <ShareForm space={s} onClose={onClose} onShared={onShared} />
}

function ShareForm({ space: s, onClose, onShared }) {
  const owner = s.my_role === 'owner'
  const [kind, setKind] = useState(owner ? 'person' : 'unit')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [unit, setUnit] = useState(null)
  const [children, setChildren] = useState(false)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const id = useId()
  const { data: tree, error: treeErr } = useFetch(() => api.orgTree(), [])
  const nodes = useMemo(() => toNodes(tree?.units), [tree])
  const index = useMemo(() => indexTree(tree?.units), [tree])
  const granted = new Set((s.unit_grants || []).map((g) => g.unit_id))
  const picked = unit && index[unit]
  const pickedPeople = picked && (children
    ? picked.all.reduce((n, x) => n + (index[x]?.unit.member_count || 0), 0)
    : picked.unit.member_count)

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (kind === 'unit' && !unit) { setErr('Hãy chọn một đơn vị trong cây'); return }
    setBusy(true)
    try {
      if (kind === 'person') {
        await api.addMember(s.id, { email, role })
        onShared(`Đã chia sẻ kho cho ${email} (quyền ${GRANT_ROLES.find((r) => r.value === role).label})`)
      } else {
        await api.addSpaceUnit(s.id, { unit_id: unit, role, include_children: children })
        onShared(`Đã chia sẻ kho cho đơn vị ${picked.unit.name} (quyền ${GRANT_ROLES.find((r) => r.value === role).label})`)
      }
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={`Chia sẻ kho ${s.name}`} size="wide" onClose={onClose} testId="spaces-share-modal"
      closeLabel="Đóng hộp chia sẻ kho"
      footer={(
        <>
          <button type="button" className="ui-btn" onClick={onClose}>Huỷ</button>
          <button type="submit" form={`${id}-f`} className="ui-btn ui-btn-primary" disabled={busy}
            data-testid={kind === 'person' ? 'spaces-member-invite' : 'spaces-unit-share'}>
            {kind === 'person' ? 'Chia sẻ với người' : 'Chia sẻ với đơn vị'}
          </button>
        </>
      )}>
      <form id={`${id}-f`} className="spaces-form" onSubmit={submit}>
        {owner && (
          <Segmented label="Chia sẻ với" value={kind} onChange={(v) => { setKind(v); setErr(null) }} testId="spaces-share-kind"
            options={[{ value: 'person', label: 'Người' }, { value: 'unit', label: 'Đơn vị' }]} />
        )}

        {kind === 'person' ? (
          <label className="field">
            <span>Email người được mời <span className="muted">(bắt buộc)</span></span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ten@vcprosperous.com"
              data-testid="spaces-share-email" />
          </label>
        ) : (
          <div className="spaces-unit-pick">
            <p className="spaces-label" id={`${id}-tl`}>Chọn đơn vị <span className="muted">(bắt buộc)</span></p>
            {treeErr && <ErrorBox>{treeErr}</ErrorBox>}
            {!tree && !treeErr && <Loading />}
            {tree && nodes.length === 0 && <p className="muted">Chưa có cơ cấu tổ chức — quản trị viên tạo đơn vị ở màn Cơ cấu tổ chức.</p>}
            {tree && nodes.length > 0 && (
              <div className="spaces-tree">
                <Tree label="Chọn đơn vị" nodes={nodes} selected={unit} onSelect={setUnit} testId="spaces-unit-tree"
                  defaultExpanded={nodes.map((n) => n.id)} />
              </div>
            )}
            <label className="spaces-check">
              <input type="checkbox" checked={children} onChange={(e) => setChildren(e.target.checked)} data-testid="spaces-share-children" />
              Gồm đơn vị con
            </label>
            <p className="small spaces-flush" role="status" data-testid="spaces-share-picked">
              {picked
                ? <>Đã chọn: {picked.path.join(' › ')} — khoảng {num(pickedPeople)} người{children && picked.all.length > 1 ? ', tính cả đơn vị con' : ''}.
                  {granted.has(unit) && ' Đơn vị này đã được chia sẻ — đổi quyền ở hàng đơn vị trong tab Thành viên.'}</>
                : 'Chưa chọn đơn vị.'}
            </p>
          </div>
        )}

        <fieldset className="spaces-roles">
          <legend>Quyền</legend>
          {GRANT_ROLES.map((r) => (
            <label key={r.value} className="spaces-radio">
              <input type="radio" name={`${id}-role`} value={r.value} checked={role === r.value} onChange={() => setRole(r.value)}
                data-testid={`spaces-share-role-${r.value}`} />
              <span className="strong">{r.label}</span><span className="muted small">— {r.hint}</span>
            </label>
          ))}
          <label className="spaces-radio">
            <input type="radio" name={`${id}-role`} value="owner" disabled />
            <span className="strong">Quản lý</span><span className="muted small">— chỉ chủ kho, không cấp được</span>
          </label>
        </fieldset>
        {kind === 'unit' && (
          <p className="muted small spaces-flush">
            Người vào đơn vị tự có quyền, rời đơn vị tự mất; ai vừa được mời riêng vừa thuộc đơn vị thì lấy quyền cao hơn.
          </p>
        )}
        <ErrorBox>{err}</ErrorBox>
      </form>
    </Modal>
  )
}
