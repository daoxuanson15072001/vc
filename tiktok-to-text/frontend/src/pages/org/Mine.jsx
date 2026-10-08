// Tab Của tôi (SCR-18, ORG-14, ORG-07): đơn vị, quản lý của tôi, người dưới quyền của tôi, vai trò chức năng mình giữ
// và uỷ quyền có thời hạn (Modal).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { date } from '../../format'
import { ErrorBox, Loading } from '../../components/ui'
import { Modal } from '../../components/Overlay'
import { Field, PersonSelect, ROLE, endOfDay, fnNameOf, run, scopeText } from './shared'
import { usePersonLink } from './PersonDrawer'

export default function Mine({ ctx }) {
  const { data: me, error, reload } = useFetch(api.orgMe, [ctx.version])
  const [delegating, setDelegating] = useState(null)
  const link = usePersonLink()
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!me) return <Loading />
  const fnName = fnNameOf(ctx.functions)
  const person = (p) => (p
    ? <><Link to={link(p.id)} className="strong">{p.name}</Link> <span className="muted small">{p.email}</span></>
    : <span className="muted">—</span>)
  const empty = !me.units.length && !me.manager && !me.direct_reports.length

  return (
    <div className="org-stack">
      <section className="card my-org" aria-labelledby="org-mine-h">
        <h2 id="org-mine-h" className="org-h2">Vị trí của tôi</h2>
        {empty ? (
          <p className="muted">Bạn chưa được xếp vào cơ cấu tổ chức. Liên hệ quản trị viên để được gắn đơn vị và người quản lý.</p>
        ) : (
          <dl className="kv">
            <dt>Đơn vị</dt>
            <dd>{me.units.length ? me.units.map((u, i) => <span key={u.id}>{i ? ' · ' : ''}{u.name} <span className="muted small">({u.code}{i ? ', kiêm nhiệm' : ''})</span></span>) : '—'}</dd>
            <dt>Chức năng · chức danh</dt>
            <dd>{me.function ? fnName(me.function) : '—'} · {me.position || '—'}</dd>
            <dt>Cấp bậc</dt>
            <dd data-testid="my-level">{me.level ? `${me.level} · ${me.level_name}` : <span className="muted">Chưa xếp</span>}</dd>
            <dt>Quản lý của tôi</dt>
            <dd data-testid="my-manager">{person(me.manager)}</dd>
            <dt>Quản lý chuyên môn</dt>
            <dd>{person(me.functional_manager)}</dd>
            <dt>Người dưới quyền của tôi</dt>
            <dd data-testid="my-reports">{me.direct_reports.length
              ? me.direct_reports.map((r, i) => <span key={r.id}>{i ? ', ' : ''}<Link to={link(r.id)}>{r.name}</Link></span>)
              : <span className="muted">—</span>}</dd>
          </dl>
        )}
      </section>

      <section className="card" aria-labelledby="org-mine-grants-h">
        <h2 id="org-mine-grants-h" className="org-h2">Vai trò chức năng của tôi</h2>
        {!me.grants.length && <p className="muted">Bạn chưa giữ vai trò chức năng nào.</p>}
        {me.grants.length > 0 && (
          <>
            <ul className="member-list" data-testid="my-grants">
              {me.grants.map((g) => (
                <li key={g.id} data-id={g.id}>
                  <span className="grow">
                    <span className="strong">{ROLE[g.role] || g.role}</span>
                    <span className="muted small"> · {scopeText(g.scope, fnName)}</span>
                    {g.delegated_by && <> <span className="ui-badge" data-tone="info">Thay mặt {g.delegated_by.name}</span></>}
                    {g.valid_to && <span className="muted small"> · đến {date(g.valid_to)}</span>}
                  </span>
                  {!g.delegated_from && (
                    <button type="button" className="ui-btn ui-btn-sm" aria-label={`Uỷ quyền: ${ROLE[g.role] || g.role}`}
                      onClick={() => setDelegating({ grant: g, user_id: '', valid_to: '', note: '' })}>Uỷ quyền</button>
                  )}
                </li>
              ))}
            </ul>
            <p className="muted small">Uỷ quyền có thời hạn, tự hết hạn; người được uỷ quyền không uỷ quyền tiếp được.</p>
          </>
        )}
      </section>

      {delegating && (
        <Modal open title={`Uỷ quyền ${ROLE[delegating.grant.role] || delegating.grant.role}`} size="sm" onClose={() => setDelegating(null)}
          testId="org-delegate-modal"
          footer={(
            <>
              <button type="button" className="ui-btn" onClick={() => setDelegating(null)}>Huỷ</button>
              <button type="submit" form="org-delegate-form" className="ui-btn ui-btn-primary">Uỷ quyền</button>
            </>
          )}>
          <form id="org-delegate-form" onSubmit={async (e) => {
            e.preventDefault()
            const { grant, ...rest } = delegating
            const ok = await run(() => api.delegateOrgGrant({ ...rest, grant_id: grant.id, valid_to: endOfDay(rest.valid_to) }),
              (r) => `Đã uỷ quyền cho ${r.user?.name} đến ${date(r.valid_to)}`, reload)
            if (ok) setDelegating(null)
          }}>
            <p className="muted small">Phạm vi: {scopeText(delegating.grant.scope, fnName)}</p>
            <Field label="Người nhận uỷ quyền">{(id) => <PersonSelect id={id} people={ctx.people} value={delegating.user_id} onChange={(v) => setDelegating({ ...delegating, user_id: v })} required />}</Field>
            <label className="field"><span>Đến hết ngày</span>
              <input type="date" value={delegating.valid_to} onChange={(e) => setDelegating({ ...delegating, valid_to: e.target.value })} required />
            </label>
            <label className="field"><span>Ghi chú</span>
              <input value={delegating.note} onChange={(e) => setDelegating({ ...delegating, note: e.target.value })} placeholder="vd Nghỉ phép" />
            </label>
          </form>
        </Modal>
      )}
    </div>
  )
}
