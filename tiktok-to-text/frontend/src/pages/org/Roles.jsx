// Tab Vai trò chức năng (SCR-18, ORG-06 — chỉ quản trị viên; id tab `grants`, được link từ Thư viện bài học):
// "ai có quyền gì ở đâu" — lọc trên URL (?grole= ?gunit= ?guser= ?gall=1), bảng vai trò, thu hồi qua menu Thêm ▾,
// form cấp vai trò bên phải.
import { useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { date } from '../../format'
import { DataTable } from '../../components/DataTable'
import { RowActions } from '../../components/ActionMenu'
import { StatusBadge } from '../../components/StatusBadge'
import { FilterBar, FilterChip, SelectField } from '../../components/FilterBar'
import { useUrlState } from '../../urlState'
import { Field, FunctionSelect, PersonSelect, ROLE, UnitSelect, endOfDay, fnNameOf, run, scopeText } from './shared'
import { usePersonLink } from './PersonDrawer'

const FILTERS = { grole: { default: '' }, gunit: { default: '' }, guser: { default: '' }, gall: { type: 'bool' } }
const BLANK = { user_id: '', role: 'reviewer', unit_id: '', category: '', function: '', valid_to: '' }
const grantStatus = (g) => (g.revoked_at ? 'revoked' : g.upcoming ? 'upcoming' : g.active ? 'active' : 'ended')

export default function Roles({ ctx }) {
  const [f, set] = useUrlState(FILTERS)
  const { data: grants, error, loading, reload } = useFetch(
    () => api.orgGrants({ role: f.grole, unit_id: f.gunit, user_id: f.guser, include_inactive: f.gall }),
    [f.grole, f.gunit, f.guser, f.gall, ctx.version],
  )
  const { data: cats } = useFetch(() => api.categories(), [])
  const [form, setForm] = useState(BLANK)
  const fnName = fnNameOf(ctx.functions)
  const link = usePersonLink()
  const active = !!(f.grole || f.gunit || f.guser || f.gall)

  const revoke = (g) => run(() => api.revokeOrgGrant(g.id), `Đã thu hồi vai trò ${ROLE[g.role] || g.role} của ${g.user?.name}`, reload)
  const submit = async (e) => {
    e.preventDefault()
    const body = {
      user_id: form.user_id, role: form.role, valid_to: endOfDay(form.valid_to),
      scope: { unit_id: form.unit_id || null, category: form.category || null, function: form.function || null },
    }
    if (await run(() => api.createOrgGrant(body), (r) => `Đã cấp ${ROLE[r.role]} cho ${r.user?.name}`, reload)) setForm(BLANK)
  }

  return (
    <div className="org-split org-split-form">
      <section className="org-stack" aria-labelledby="org-grants-h">
        <h2 id="org-grants-h" className="org-h2">Ai có quyền gì ở đâu</h2>
        <FilterBar label="Lọc vai trò chức năng" count={grants?.length} unit="vai trò" active={active} testId="org-grant-filters"
          onClear={() => set({ grole: '', gunit: '', guser: '', gall: false })}>
          <SelectField label="Vai trò" value={f.grole} onChange={(grole) => set({ grole })}
            options={[{ value: '', label: 'Mọi vai trò' }, ...Object.entries(ROLE).map(([value, label]) => ({ value, label }))]} />
          <SelectField label="Đơn vị" value={f.gunit} onChange={(gunit) => set({ gunit })}
            options={[{ value: '', label: 'Mọi đơn vị' }, ...ctx.units.filter((u) => u.active).map((u) => ({ value: u.id, label: `${'  '.repeat(u.depth - 1)}${u.name} (${u.code})` }))]} />
          <SelectField label="Người" value={f.guser} onChange={(guser) => set({ guser })}
            options={[{ value: '', label: 'Mọi người' }, ...ctx.people.filter((p) => p.active).map((p) => ({ value: p.id, label: p.name }))]} />
          <FilterChip pressed={f.gall} onClick={() => set({ gall: !f.gall })}>Cả vai trò đã hết hạn / thu hồi</FilterChip>
        </FilterBar>
        {f.gunit && <p className="muted small org-flush">Gồm vai trò cấp ở đơn vị này, ở đơn vị cha và vai trò không giới hạn đơn vị.</p>}
        <DataTable
          caption="Vai trò chức năng"
          rows={grants}
          loading={loading}
          error={error}
          onRetry={reload}
          rowTestId="org-grant-row"
          getStatus={grantStatus}
          rowName={(g) => `${ROLE[g.role] || g.role} của ${g.user?.name}`}
          empty="Không có vai trò nào."
          columns={[
            { key: 'user', header: 'Người', title: true, to: (g) => (g.user?.id ? link(g.user.id) : undefined), render: (g) => g.user?.name || '—' },
            { key: 'role', header: 'Vai trò', render: (g) => (
              <>
                {ROLE[g.role] || g.role}
                {g.delegated_by && <> <span className="ui-badge" data-tone="info">Uỷ quyền từ {g.delegated_by.name}</span></>}
                {g.transferred_from && <> <span className="ui-badge" data-tone="muted">Nhận bàn giao</span></>}
              </>
            ) },
            { key: 'scope', header: 'Phạm vi', render: (g) => scopeText(g.scope, fnName) },
            { key: 'valid', header: 'Hiệu lực', render: (g) => (
              <span className="small">
                {g.upcoming ? `Từ ${date(g.valid_from)} · ` : ''}{g.valid_to ? `Đến ${date(g.valid_to)}` : 'Không thời hạn'}
                {g.created_by ? ` · cấp bởi ${g.created_by.name}` : ''}{g.note ? ` · ${g.note}` : ''}
              </span>
            ) },
            { key: 'status', header: 'Trạng thái', render: (g) => (
              <StatusBadge kind="orgGrant" status={grantStatus(g)} label={g.upcoming ? `Sắp hiệu lực từ ${date(g.valid_from)}` : undefined} />
            ) },
          ]}
          actions={(g) => ((g.active || g.upcoming)
            ? <RowActions name={`${ROLE[g.role] || g.role} của ${g.user?.name}`} testId="org-grant" actions={[
              { label: 'Thu hồi vai trò…', danger: true, testId: 'org-grant-revoke', onSelect: () => revoke(g),
                confirm: { title: `Thu hồi vai trò ${ROLE[g.role] || g.role} của ${g.user?.name}?`, okLabel: 'Thu hồi vai trò' } },
            ]} />
            : null)}
        />
      </section>

      <form className="card form" aria-labelledby="org-grant-add-h" onSubmit={submit} data-testid="org-grant-form">
        <h2 id="org-grant-add-h" className="org-h2">Cấp vai trò</h2>
        <Field label="Người">{(id) => <PersonSelect id={id} people={ctx.people} value={form.user_id} onChange={(v) => setForm({ ...form, user_id: v })} required />}</Field>
        <label className="field"><span>Vai trò</span>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ROLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <p className="muted small">Phạm vi — bỏ trống chiều nào thì không giới hạn chiều đó. Đơn vị / lĩnh vực gồm cả nhánh con.</p>
        <Field label="Đơn vị">{(id) => <UnitSelect id={id} units={ctx.units} value={form.unit_id} onChange={(v) => setForm({ ...form, unit_id: v })} empty="— Mọi đơn vị —" />}</Field>
        <label className="field"><span>Lĩnh vực</span>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">— Mọi lĩnh vực —</option>
            {(cats || []).filter((c) => c.active).map((c) => <option key={c.slug} value={c.slug}>{c.slug.includes('.') ? '  ' : ''}{c.name}</option>)}
          </select>
        </label>
        <Field label="Chức năng">{(id) => <FunctionSelect id={id} functions={ctx.functions} value={form.function} onChange={(v) => setForm({ ...form, function: v })} empty="— Mọi chức năng —" />}</Field>
        <label className="field"><span>Hết hạn</span>
          <input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
          <small>Bỏ trống = không thời hạn</small>
        </label>
        <button type="submit" className="ui-btn ui-btn-primary">Cấp vai trò</button>
      </form>
    </div>
  )
}
