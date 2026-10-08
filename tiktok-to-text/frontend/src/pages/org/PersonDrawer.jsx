// Hồ sơ tổ chức của một người (SCR-18, AIX-05): Drawer mở theo ?person=<id>, sửa hồ sơ theo ?edit=1 (chỉ quản trị
// viên). Đơn vị kiêm nhiệm chọn bằng checkbox có nhãn (không dùng select multiple). Nghỉ việc / cho đi làm lại dùng
// chung với hàng của bảng người (usePersonActions).
import { useId, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { Drawer } from '../../components/Overlay'
import { ActionMenu } from '../../components/ActionMenu'
import { StatusBadge } from '../../components/StatusBadge'
import { Notice } from '../../components/Notice'
import { Loading } from '../../components/ui'
import { confirmDialog } from '../../components/dialog'
import { usePageMeta } from '../../pageMeta'
import { Field, FunctionSelect, LEVELS, PersonSelect, ROLE, UnitSelect, fnNameOf, personStatus, run, scopeText } from './shared'

export const offboardConfirm = (p) => ({
  title: `Xử lý nghỉ việc cho ${p.name}?`,
  body: `Tài khoản bị khoá, vai trò chuyển cho quản lý trực tiếp, người dưới quyền chuyển sang quản lý của ${p.name}.`,
  okLabel: 'Xử lý nghỉ việc',
})

// Link giữ nguyên tham số đang có (tab, unit), thay ?person=, bỏ ?edit=
export function usePersonLink() {
  const { search } = useLocation()
  return (id, edit = false) => {
    const p = new URLSearchParams(search)
    p.set('person', id)
    if (edit) p.set('edit', '1')
    else p.delete('edit')
    return `?${p}`
  }
}

// Mở hồ sơ, sửa hồ sơ, nghỉ việc, cho đi làm lại — dùng ở hàng bảng người và chân Drawer
export function usePersonActions(ctx) {
  const [, setParams] = useSearchParams()
  const open = (id, edit = false) => setParams((prev) => {
    const n = new URLSearchParams(prev)
    n.set('person', id)
    if (edit) n.set('edit', '1')
    else n.delete('edit')
    return n
  })
  // Hộp xác nhận do ActionMenu hỏi (mục danger + offboardConfirm) — ở đây chỉ gọi API
  const offboard = async (p) => {
    const r = await run(() => api.offboardUser(p.id), `Đã xử lý nghỉ việc cho ${p.name}`, ctx.bump)
    if (r) { ctx.setOffboard(r); open(p.id) }
  }
  // Mở khoá người đã nghỉ việc = cho đi làm lại: tài khoản mở, hồ sơ tổ chức về "đang làm" (QA B4)
  const rejoin = async (p) => {
    if (!(await confirmDialog({
      title: `Cho ${p.name} đi làm lại?`,
      body: 'Tài khoản được mở khoá, hồ sơ tổ chức về trạng thái đang làm việc (giữ đơn vị cũ). Vai trò đã bàn giao cho quản lý không tự trả lại — cấp lại nếu cần.',
      okLabel: 'Cho đi làm lại',
    }))) return
    await run(() => api.patchUser(p.id, { active: true }), `${p.name} đã đi làm lại — kiểm tra lại đơn vị, quản lý, vai trò`, ctx.bump)
  }
  return { offboard, rejoin, edit: (p) => open(p.id, true), open }
}

export default function PersonDrawer({ ctx }) {
  const [params, setParams] = useSearchParams()
  const id = params.get('person')
  const editing = ctx.admin && params.get('edit') === '1'
  const p = ctx.people.find((x) => x.id === id)
  const actions = usePersonActions(ctx)
  const link = usePersonLink()
  usePageMeta(p ? { object: p.name } : {})
  const close = () => {
    ctx.setOffboard(null)
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      n.delete('person')
      n.delete('edit')
      return n
    })
  }
  if (!id) return null
  const status = p && personStatus(p)
  const result = p && ctx.offboard?.user?.id === p.id ? ctx.offboard : null

  let footer = null
  if (p && ctx.admin) {
    if (editing) {
      footer = (
        <>
          <button type="button" className="ui-btn" onClick={() => actions.open(p.id)}>Huỷ</button>
          <button type="submit" form="org-profile-form" className="ui-btn ui-btn-primary" data-testid="org-profile-save">Lưu hồ sơ</button>
        </>
      )
    } else if (status === 'left') {
      footer = <button type="button" className="ui-btn ui-btn-primary" onClick={() => actions.rejoin(p)} data-testid="org-drawer-rejoin">Cho đi làm lại</button>
    } else {
      footer = (
        <>
          <ActionMenu name={p.name} testId="org-drawer-more" items={[
            { label: 'Nghỉ việc…', danger: true, confirm: offboardConfirm(p), onSelect: () => actions.offboard(p), testId: 'org-drawer-offboard' },
          ]} />
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => actions.edit(p)} data-testid="org-drawer-edit">Sửa hồ sơ</button>
        </>
      )
    }
  }

  return (
    <Drawer open title={p?.name || 'Hồ sơ tổ chức'} sub="Hồ sơ tổ chức" onClose={close} footer={footer} testId="org-person-drawer"
      className="org-person-drawer">
      {!p && (ctx.people.length ? <p className="muted">Không tìm thấy người này (có thể đã bị xoá).</p> : <Loading />)}
      {p && result && <OffboardResult r={result} fnName={fnNameOf(ctx.functions)} />}
      {p && !editing && <ProfileView ctx={ctx} p={p} link={link} />}
      {p && editing && <ProfileForm key={`${p.id}-${ctx.version}`} ctx={ctx} person={p} onSaved={() => actions.open(p.id)} />}
    </Drawer>
  )
}

function ProfileView({ ctx, p, link }) {
  const o = p.org || {}
  const fnName = fnNameOf(ctx.functions)
  const byId = Object.fromEntries(ctx.people.map((x) => [x.id, x]))
  const unitName = (uid) => { const u = ctx.units.find((x) => x.id === uid); return u ? `${u.name} (${u.code})` : '—' }
  const who = (pid) => (pid && byId[pid] ? <Link to={link(pid)}>{byId[pid].name}</Link> : <span className="muted">—</span>)
  const reports = ctx.people.filter((x) => x.org?.manager_id === p.id && x.org?.status !== 'left')
  return (
    <dl className="kv org-kv" data-testid="org-profile" data-id={p.id} data-status={personStatus(p)}>
      <dt>Email</dt><dd>{p.email}</dd>
      <dt>Trạng thái</dt><dd><StatusBadge kind="orgPerson" status={personStatus(p)} /></dd>
      <dt>Đơn vị chính</dt><dd>{o.unit_ids?.[0] ? unitName(o.unit_ids[0]) : <span className="muted">Chưa xếp</span>}</dd>
      <dt>Kiêm nhiệm</dt><dd>{o.unit_ids?.length > 1 ? o.unit_ids.slice(1).map(unitName).join(' · ') : <span className="muted">—</span>}</dd>
      <dt>Chức năng · chức danh</dt><dd>{o.function ? fnName(o.function) : '—'} · {o.position || '—'}</dd>
      <dt>Cấp bậc</dt><dd data-testid="org-profile-level">{o.level ? `cấp ${o.level} · ${LEVELS[o.level]}` : <span className="muted">Chưa xếp</span>}</dd>
      <dt>Quản lý trực tiếp</dt><dd>{who(o.manager_id)}</dd>
      <dt>Quản lý chuyên môn</dt><dd>{who(o.functional_manager_id)}</dd>
      <dt>Người dưới quyền</dt>
      <dd>{reports.length ? reports.map((r, i) => <span key={r.id}>{i ? ', ' : ''}<Link to={link(r.id)}>{r.name}</Link></span>) : <span className="muted">—</span>}</dd>
    </dl>
  )
}

function ProfileForm({ ctx, person, onSaved }) {
  const o = person.org || {}
  const [v, setV] = useState({
    primary: o.unit_ids?.[0] || '', extra: (o.unit_ids || []).slice(1),
    function: o.function || '', position: o.position || '',
    manager_id: o.manager_id || '', functional_manager_id: o.functional_manager_id || '',
    level: o.level || '',
  })
  const extraId = useId()
  const others = useMemo(() => ctx.units.filter((u) => u.active && u.id !== v.primary), [ctx.units, v.primary])
  const toggleExtra = (uid) => setV({ ...v, extra: v.extra.includes(uid) ? v.extra.filter((x) => x !== uid) : [...v.extra, uid] })
  const submit = async (e) => {
    e.preventDefault()
    const body = {
      unit_ids: [v.primary, ...v.extra.filter((x) => x !== v.primary)].filter(Boolean),
      function: v.function || null, position: v.position,
      manager_id: v.manager_id || null, functional_manager_id: v.functional_manager_id || null,
      level: v.level ? Number(v.level) : null,
    }
    if (await run(() => api.patchOrgUser(person.id, body), `Đã lưu hồ sơ của ${person.name}`, ctx.bump)) onSaved()
  }
  return (
    <form id="org-profile-form" aria-label={`Sửa hồ sơ tổ chức: ${person.name}`} data-testid="org-profile-form" onSubmit={submit}>
      <Field label="Đơn vị chính">{(id) => <UnitSelect id={id} units={ctx.units} value={v.primary} onChange={(x) => setV({ ...v, primary: x, extra: v.extra.filter((e) => e !== x) })} />}</Field>
      <fieldset className="org-checks" aria-describedby={extraId}>
        <legend>Đơn vị kiêm nhiệm</legend>
        <small id={extraId} className="muted">Đánh dấu mọi đơn vị người này làm kiêm nhiệm.</small>
        <div className="org-checks-list" data-testid="org-profile-extra">
          {others.map((u) => (
            <label key={u.id} className="org-check">
              <input type="checkbox" checked={v.extra.includes(u.id)} onChange={() => toggleExtra(u.id)} />
              {u.name} <span className="muted small">({u.code})</span>
            </label>
          ))}
          {!others.length && <span className="muted small">Không còn đơn vị nào khác.</span>}
        </div>
      </fieldset>
      <Field label="Chức năng">{(id) => <FunctionSelect id={id} functions={ctx.functions} value={v.function} onChange={(x) => setV({ ...v, function: x })} />}</Field>
      <label className="field"><span>Chức danh</span><input value={v.position} onChange={(e) => setV({ ...v, position: e.target.value })} placeholder="vd Trưởng phòng" /></label>
      <label className="field"><span>Cấp bậc</span>
        <select value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })}>
          <option value="">— Chưa xếp —</option>
          {Object.entries(LEVELS).map(([k, name]) => <option key={k} value={k}>{k} · {name}</option>)}
        </select>
      </label>
      <Field label="Quản lý trực tiếp">{(id) => <PersonSelect id={id} people={ctx.people} value={v.manager_id} exclude={person.id} empty="— Không có —" onChange={(x) => setV({ ...v, manager_id: x })} />}</Field>
      <Field label="Quản lý chuyên môn">{(id) => <PersonSelect id={id} people={ctx.people} value={v.functional_manager_id} exclude={person.id} empty="— Không có —" onChange={(x) => setV({ ...v, functional_manager_id: x })} />}</Field>
    </form>
  )
}

function OffboardResult({ r, fnName }) {
  return (
    <Notice tone="good" title={`Kết quả xử lý nghỉ việc: ${r.user.name}`} testId="org-offboard-result">
      <ul className="org-result offboard-result">
        <li>Tài khoản đã khoá, đăng xuất mọi thiết bị, thu hồi token AI.</li>
        <li>Người nhận bàn giao: {r.heir ? `${r.heir.name} (${r.heir.email})` : 'không có quản lý trực tiếp — vai trò bị thu hồi, cần cấp lại'}</li>
        {r.grants_transferred.map((g) => (
          <li key={g.id}>Vai trò {ROLE[g.role]} · {scopeText(g.scope, fnName)} → {g.to.user?.name}{g.existing ? ' (đã có sẵn)' : ''}</li>
        ))}
        {r.grants_ended.map((g) => <li key={g.id}>Vai trò {ROLE[g.role]} · {scopeText(g.scope, fnName)} đã hết hiệu lực</li>)}
        {r.reports_moved.length > 0 && <li>Người dưới quyền chuyển sang {r.heir?.name || '(chưa có quản lý)'}: {r.reports_moved.map((x) => x.name).join(', ')}</li>}
        {r.functional_reports_cleared.length > 0 && <li>Bỏ quản lý chuyên môn của: {r.functional_reports_cleared.map((x) => x.name).join(', ')}</li>}
        {r.units_head_cleared.length > 0 && <li>Bỏ trưởng đơn vị: {r.units_head_cleared.map((x) => x.code).join(', ')}</li>}
      </ul>
    </Notice>
  )
}
