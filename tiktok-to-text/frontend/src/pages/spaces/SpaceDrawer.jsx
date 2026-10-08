// Khung quản lý kho (SCR-19, CMP-08): Drawer ?space=<id>, tab ?tab= *Thông tin · Thành viên · Nguy hiểm*.
// - Thông tin: tên, mô tả; đổi công khai / riêng tư qua confirmDialog nêu hệ quả (số thẻ, số nguồn).
// - Thành viên (SCR-19.1): hai nhóm *Người* và *Đơn vị* (số người hiện có, quyền, gồm đơn vị con); nút chính
//   *Chia sẻ kho* ở chân khung mở Modal (ShareModal).
// - Nguy hiểm: xoá kho — phải gõ đúng tên kho.
// Chủ kho thấy đủ ba tab; quản trị viên không phải chủ kho chỉ có tab Thành viên, nhóm Đơn vị (BE: can_share_units).
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { num } from '../../format'
import { ErrorBox } from '../../components/ui'
import { Drawer } from '../../components/Overlay'
import { Tabs } from '../../components/Tabs'
import { StatusBadge } from '../../components/StatusBadge'
import { Icon } from '../../components/icons'
import { confirmDialog } from '../../components/dialog'
import { toast } from '../../components/toast'
import { ShareModal } from './ShareModal'
import { addSourceHref, GRANT_ROLES } from './shared'

export function SpaceDrawer({ space: s, onClose, onChanged }) {
  const [sharing, setSharing] = useState(false)
  if (!s) {
    return (
      <Drawer open title="Không tìm thấy kho" onClose={onClose} testId="spaces-drawer">
        <p>Kho không tồn tại hoặc bạn không có quyền xem.</p>
      </Drawer>
    )
  }
  const owner = s.my_role === 'owner'
  const people = s.members.length
  const units = s.unit_grants?.length || 0
  const items = [
    owner && { id: 'info', label: 'Thông tin', testId: 'spaces-tab-info', content: <InfoTab space={s} onChanged={onChanged} /> },
    { id: 'members', label: 'Thành viên', count: people + units, testId: 'spaces-tab-members',
      content: <MembersTab space={s} onChanged={onChanged} /> },
    owner && { id: 'danger', label: 'Nguy hiểm', testId: 'spaces-tab-danger', content: <DangerTab space={s} onDeleted={() => { onClose(); onChanged() }} /> },
  ].filter(Boolean)

  return (
    <Drawer open title={s.name} sub={s.type === 'personal' ? 'Kho cá nhân' : 'Kho chia sẻ'} onClose={onClose} testId="spaces-drawer"
      footer={(
        <>
          <Link className="ui-btn" to={`/wiki?space_id=${s.id}`}>Xem thẻ</Link>
          {['owner', 'editor'].includes(s.my_role) && <Link className="ui-btn" to={addSourceHref(s)}>Nạp nguồn</Link>}
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setSharing(true)} data-testid="spaces-share-open">
            <Icon name="plus" size={16} />Chia sẻ kho
          </button>
        </>
      )}>
      <div className="spaces-summary">
        <StatusBadge kind="spaceRole" status={s.my_role} />
        <StatusBadge kind="spaceVisibility" status={s.visibility} />
        <span className="muted">
          {num(s.counts.sources)} nguồn · {num(s.counts.cards)} thẻ · {num(people)} người · {num(units)} đơn vị
        </span>
      </div>
      <Tabs kind="panel" label={`Quản lý kho ${s.name}`} items={items} testId="spaces-tabs" />
      <ShareModal open={sharing} space={s} onClose={() => setSharing(false)}
        onShared={(text) => { setSharing(false); toast(text); onChanged() }} />
    </Drawer>
  )
}

// Gọi API, báo toast; lỗi hiện ở hộp lỗi của tab
function useAct(onChanged) {
  const [err, setErr] = useState(null)
  const act = async (fn, done) => {
    setErr(null)
    try {
      await fn()
      if (done) toast(done)
      onChanged()
      return true
    } catch (e) {
      setErr(e.message)
      return false
    }
  }
  return [err, act]
}

function InfoTab({ space: s, onChanged }) {
  const [form, setForm] = useState({ name: s.name, description: s.description || '' })
  const [err, act] = useAct(onChanged)
  const dirty = form.name !== s.name || form.description !== (s.description || '')
  const counts = `${num(s.counts.cards)} thẻ và ${num(s.counts.sources)} nguồn`
  const toOrg = s.visibility !== 'org'

  const switchVisibility = async () => {
    const ok = await confirmDialog(toOrg
      ? { title: 'Công khai kho trong công ty?',
          body: `Mọi người trong công ty sẽ đọc được ${counts} của kho “${s.name}” (quyền Xem). Người và đơn vị đã được chia sẻ giữ nguyên quyền.`,
          okLabel: 'Công khai trong công ty' }
      : { title: 'Chuyển kho về riêng tư?',
          body: `Người ngoài danh sách thành viên và đơn vị được chia sẻ sẽ mất quyền xem ${counts} của kho “${s.name}” ngay.`,
          okLabel: 'Chuyển về riêng tư', danger: true })
    if (ok) {
      act(() => api.patchSpace(s.id, { visibility: toOrg ? 'org' : 'private' }),
        toOrg ? `Kho “${s.name}” đã công khai trong công ty` : `Kho “${s.name}” đã chuyển về riêng tư`)
    }
  }

  return (
    <div className="spaces-tab">
      <form className="spaces-form" aria-label="Tên và mô tả kho"
        onSubmit={(e) => { e.preventDefault(); act(() => api.patchSpace(s.id, form), 'Đã lưu thông tin kho') }}>
        <label className="field">
          <span>Tên kho</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} data-testid="spaces-info-name" />
        </label>
        <label className="field">
          <span>Mô tả</span>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
        </label>
        <button type="submit" className="ui-btn spaces-self-start" disabled={!dirty} data-testid="spaces-info-save">Lưu</button>
      </form>

      <section className="spaces-block" aria-labelledby="spaces-vis-h">
        <h3 id="spaces-vis-h" className="spaces-h3">Ai trong công ty thấy kho</h3>
        <p className="spaces-flush">
          {toOrg
            ? 'Kho đang riêng tư — chỉ người và đơn vị được chia sẻ thấy kho.'
            : 'Kho đang công khai trong công ty — mọi người được xem.'}
        </p>
        <button type="button" className="ui-btn spaces-self-start" onClick={switchVisibility}
          aria-label={toOrg ? `Đổi kho ${s.name} sang công khai trong công ty` : `Đổi kho ${s.name} về riêng tư`}
          data-testid="spaces-visibility">
          {toOrg ? 'Đổi sang công khai…' : 'Đổi về riêng tư…'}
        </button>
      </section>
      <ErrorBox>{err}</ErrorBox>
    </div>
  )
}

function RoleSelect({ value, onChange, label, testId }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} data-testid={testId} className="spaces-role">
      {GRANT_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
    </select>
  )
}

function MembersTab({ space: s, onChanged }) {
  const owner = s.my_role === 'owner'
  const [err, act] = useAct(onChanged)
  const units = s.unit_grants || []

  const removePerson = async (m) => {
    if (await confirmDialog({ title: `Gỡ ${m.user.name} khỏi kho?`, body: `${m.user.email} sẽ không còn thấy kho “${s.name}” (trừ khi thuộc đơn vị được chia sẻ).`, okLabel: 'Gỡ thành viên', danger: true })) {
      act(() => api.removeMember(s.id, m.user.id), `Đã gỡ ${m.user.name} khỏi kho`)
    }
  }
  const removeUnit = async (g) => {
    if (await confirmDialog({ title: `Gỡ đơn vị ${g.unit_name} khỏi kho?`,
      body: `${num(g.member_count)} người hiện có của đơn vị${g.include_children ? ' (gồm đơn vị con)' : ''} mất quyền ngay — trừ người được mời riêng.`,
      okLabel: 'Gỡ đơn vị', danger: true })) {
      act(() => api.removeSpaceUnit(s.id, g.unit_id), `Đã gỡ đơn vị ${g.unit_name}`)
    }
  }

  return (
    <div className="spaces-tab">
      <section className="spaces-block" aria-labelledby="spaces-people-h">
        <h3 id="spaces-people-h" className="spaces-h3">Người <span className="ui-tab-count">{s.members.length}</span></h3>
        <ul className="spaces-list" aria-label={`Người được chia sẻ kho ${s.name}`}>
          {s.members.map((m) => (
            <li key={m.user.id} className="spaces-row" data-testid="spaces-member-row" data-id={m.user.id} data-status={m.role}>
              <span className="spaces-who">
                <span className="strong">{m.user.name}</span>
                <span className="muted small">{m.user.email}</span>
              </span>
              {m.role === 'owner' || !owner ? (
                <span className="ui-badge" data-tone={m.role === 'owner' ? 'good' : 'muted'}>
                  {m.role === 'owner' ? 'Quản lý · chủ kho' : GRANT_ROLES.find((r) => r.value === m.role)?.label}
                </span>
              ) : (
                <>
                  <RoleSelect value={m.role} label={`Quyền của ${m.user.name}`} testId="spaces-member-role"
                    onChange={(role) => act(() => api.setMemberRole(s.id, m.user.id, role), `Đã đổi quyền của ${m.user.name}`)} />
                  <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost ui-btn-danger" onClick={() => removePerson(m)}
                    aria-label={`Gỡ ${m.user.name} khỏi kho ${s.name}`} data-testid="spaces-member-remove">Gỡ</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="spaces-block" aria-labelledby="spaces-units-h">
        <h3 id="spaces-units-h" className="spaces-h3">Đơn vị <span className="ui-tab-count">{units.length}</span></h3>
        {units.length === 0 ? (
          <p className="muted spaces-flush" data-testid="spaces-units-empty">
            Chưa chia sẻ cho đơn vị nào. Chia sẻ theo đơn vị: người vào đơn vị tự có quyền, rời đơn vị tự mất.
          </p>
        ) : (
          <ul className="spaces-list" aria-label={`Đơn vị được chia sẻ kho ${s.name}`}>
            {units.map((g) => <UnitRow key={g.unit_id} g={g} space={s} act={act} onRemove={() => removeUnit(g)} />)}
          </ul>
        )}
      </section>
      <ErrorBox>{err}</ErrorBox>
    </div>
  )
}

function UnitRow({ g, space: s, act, onRemove }) {
  const id = useId()
  return (
    <li className="spaces-row" data-testid="spaces-unit-row" data-id={g.unit_id} data-status={g.role}>
      <span className="spaces-who">
        <span className="strong">{g.unit_name}{g.unit_active ? '' : ' (đã ẩn)'}</span>
        <span className="muted small" data-testid="spaces-unit-count">
          {num(g.member_count)} người hiện có · {g.include_children ? 'gồm đơn vị con' : 'không gồm đơn vị con'}
        </span>
      </span>
      <label className="spaces-check small" htmlFor={`${id}-c`}>
        <input id={`${id}-c`} type="checkbox" checked={g.include_children} data-testid="spaces-unit-children"
          onChange={(e) => act(() => api.patchSpaceUnit(s.id, g.unit_id, { include_children: e.target.checked }),
            e.target.checked ? `Đơn vị ${g.unit_name}: đã gồm đơn vị con` : `Đơn vị ${g.unit_name}: bỏ đơn vị con`)} />
        Gồm đơn vị con
      </label>
      <RoleSelect value={g.role} label={`Quyền của đơn vị ${g.unit_name}`} testId="spaces-unit-role"
        onChange={(role) => act(() => api.patchSpaceUnit(s.id, g.unit_id, { role }), `Đã đổi quyền của đơn vị ${g.unit_name}`)} />
      <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost ui-btn-danger" onClick={onRemove}
        aria-label={`Gỡ đơn vị ${g.unit_name} khỏi kho ${s.name}`} data-testid="spaces-unit-remove">Gỡ</button>
    </li>
  )
}

function DangerTab({ space: s, onDeleted }) {
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState(null)
  const id = useId()
  if (s.type === 'personal') {
    return <p className="spaces-flush">Kho cá nhân không xoá được — mỗi người luôn có một kho cá nhân.</p>
  }
  const empty = !s.counts.sources && !s.counts.cards
  const del = async (e) => {
    e.preventDefault()
    setErr(null)
    try {
      await api.deleteSpace(s.id)
      toast(`Đã xoá kho “${s.name}”`)
      onDeleted()
    } catch (e2) {
      setErr(e2.message)
    }
  }
  return (
    <form className="spaces-tab spaces-danger" onSubmit={del} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="spaces-h3">Xoá kho</h3>
      <p className="spaces-flush">
        {empty
          ? 'Kho trống — xoá xong không khôi phục được; mọi người và đơn vị được chia sẻ mất quyền.'
          : `Kho còn ${num(s.counts.sources)} nguồn và ${num(s.counts.cards)} thẻ — chỉ xoá được khi kho trống. Hãy xoá hoặc chuyển dữ liệu trước.`}
      </p>
      <label className="field">
        <span>Gõ đúng tên kho để xác nhận: <strong>{s.name}</strong></span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-testid="spaces-delete-confirm" />
      </label>
      <button type="submit" className="ui-btn ui-btn-danger spaces-self-start" disabled={typed !== s.name}
        aria-label={`Xoá kho: ${s.name}`} data-testid="spaces-space-delete">Xoá kho</button>
      <ErrorBox>{err}</ErrorBox>
    </form>
  )
}
