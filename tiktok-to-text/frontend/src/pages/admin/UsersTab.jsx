// SCR-21 tab Người dùng · SCR-21.1 Đăng nhập gần nhất (SYS-03, SYS-36) — chỉ quản trị viên.
// Bộ lọc / sắp xếp nằm trên URL (?q= &role= &stale=1 &sort=); lọc và sắp xếp làm trên danh sách đã tải (API trả tối đa 200 người).
import { useId, useMemo, useState } from 'react'
import { api } from '../../api'
import { useSession } from '../../session'
import { useUrlState } from '../../urlState'
import { DataTable } from '../../components/DataTable'
import { FilterBar, FilterChip, SearchField, SelectField } from '../../components/FilterBar'
import { Modal } from '../../components/Overlay'
import { Icon } from '../../components/icons'
import { ErrorBox } from '../../components/ui'
import { confirmDialog, promptDialog } from '../../components/dialog'
import { toast } from '../../components/toast'
import { unaccentLower } from '../../text'
import { fullLogin, isStale, relativeLogin, sortByLogin } from './lastLogin'

const ROLES = { member: 'Thành viên', admin: 'Quản trị viên' }
const FILTERS = {
  q: { default: '' },
  role: { default: '', values: ['', 'member', 'admin'] },
  stale: { type: 'bool' },
  sort: { default: '', values: ['', 'login_desc', 'login_asc'] },
}
const NEXT_SORT = { '': 'login_desc', login_desc: 'login_asc', login_asc: '' }
const EMPTY_FORM = { name: '', email: '', password: '', role: 'member' }

export function UsersTab({ users, error, loading, reload, creating, setCreating }) {
  const { user: me } = useSession()
  const [st, set] = useUrlState(FILTERS)
  const [actionError, setActionError] = useState(null)

  const rows = useMemo(() => {
    const q = unaccentLower(st.q.trim())
    const list = (users || []).filter((u) => (!q || unaccentLower(`${u.name} ${u.email}`).includes(q))
      && (!st.role || u.role === st.role) && (!st.stale || isStale(u.last_login_at)))
    return st.sort ? sortByLogin(list, st.sort === 'login_asc' ? 'asc' : 'desc') : list
  }, [users, st.q, st.role, st.stale, st.sort])

  const act = async (fn, okText) => {
    setActionError(null)
    try {
      await fn()
      await reload()
      if (okText) toast(okText)
    } catch (e) {
      setActionError(e.message)
    }
  }

  const changeRole = async (u, role) => {
    const ok = await confirmDialog({
      title: `Đổi vai trò của ${u.name} thành ${ROLES[role]}?`,
      body: role === 'admin' ? 'Quản trị viên quản lý người dùng và cây lĩnh vực của cả công ty.' : 'Người này mất quyền quản trị.',
      okLabel: 'Đổi vai trò',
    })
    if (ok) act(() => api.patchUser(u.id, { role }), `Đã đổi vai trò của ${u.name} thành ${ROLES[role]}`)
  }

  const toggleActive = async (u) => {
    const lock = u.active
    const ok = await confirmDialog(lock
      ? { title: `Khoá tài khoản ${u.email}?`, body: 'Người này bị đăng xuất ngay và mọi token API (AI / MCP) bị thu hồi.', okLabel: 'Khoá tài khoản', danger: true }
      : u.org?.status === 'left'
        ? { title: `Mở khoá ${u.email}?`, body: `${u.email} đã được xử lý nghỉ việc. Mở khoá = cho đi làm lại: hồ sơ tổ chức về trạng thái đang làm việc. Tiếp tục?`, okLabel: 'Mở khoá, cho đi làm lại' }
        : { title: `Mở khoá ${u.email}?`, okLabel: 'Mở khoá tài khoản' })
    if (ok) act(() => api.patchUser(u.id, { active: !lock }), lock ? `Đã khoá ${u.email}` : `Đã mở khoá ${u.email}`)
  }

  const resetPassword = async (u) => {
    const password = await promptDialog({
      title: `Mật khẩu mới cho ${u.email}`,
      body: 'Tối thiểu 8 ký tự. Người này sẽ bị đăng xuất khỏi mọi thiết bị.',
      label: 'Mật khẩu mới',
      inputType: 'password',
      minLength: 8,
      okLabel: 'Đặt lại mật khẩu',
    })
    if (password) act(() => api.patchUser(u.id, { password }), 'Đã đặt lại mật khẩu')
  }

  const sortLabel = st.sort === 'login_desc' ? 'mới nhất trước' : st.sort === 'login_asc' ? 'cũ nhất trước' : 'chưa sắp xếp'
  const active = !!(st.q || st.role || st.stale)

  const columns = [
    { key: 'name', header: 'Họ tên', title: true, render: (u) => (
      <>
        <span className="strong">{u.name}</span>{u.id === me.id && <span className="muted"> (bạn)</span>}
        <span className="muted small"> {u.email}</span>
      </>
    ) },
    { key: 'role', header: 'Vai trò', render: (u) => (
      <select value={u.role} disabled={u.id === me.id} aria-label={`Vai trò của ${u.name}`} onChange={(e) => changeRole(u, e.target.value)}>
        <option value="member">{ROLES.member}</option>
        <option value="admin">{ROLES.admin}</option>
      </select>
    ) },
    { key: 'active', header: 'Trạng thái', render: (u) => (u.active
      ? <span className="ui-badge" data-tone="good" data-status="active">Hoạt động</span>
      : <span className="ui-badge" data-tone="bad" data-status="locked">Đã khoá</span>) },
    { key: 'last_login_at', sort: st.sort === 'login_desc' ? 'descending' : st.sort === 'login_asc' ? 'ascending' : 'none', header: (
      <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" onClick={() => set({ sort: NEXT_SORT[st.sort] })}
        aria-label={`Sắp xếp theo đăng nhập gần nhất, đang ${sortLabel}; bấm để đổi`} data-testid="admin-sort-login">
        Đăng nhập gần nhất{st.sort && <Icon name="chevron-down" size={16} />}
      </button>
    ), render: (u) => (u.last_login_at
      ? <time dateTime={u.last_login_at} title={fullLogin(u.last_login_at)} data-testid="admin-user-login">{relativeLogin(u.last_login_at)}</time>
      : <span className="muted" data-testid="admin-user-login">Chưa đăng nhập</span>) },
  ]

  return (
    <>
      <FilterBar label="Lọc người dùng" count={rows.length} unit="người dùng" active={active} testId="admin-filters"
        onClear={() => set({ q: '', role: '', stale: false })}>
        <SearchField label="Tìm theo tên hoặc email" placeholder="Tìm theo tên hoặc email" value={st.q} onChange={(q) => set({ q })} testId="admin-search" />
        <SelectField label="Vai trò" value={st.role} onChange={(role) => set({ role })} testId="admin-role-filter"
          options={[{ value: '', label: 'Tất cả' }, { value: 'member', label: ROLES.member }, { value: 'admin', label: ROLES.admin }]} />
        <FilterChip pressed={st.stale} onClick={() => set({ stale: !st.stale })} testId="admin-stale-chip">Không đăng nhập ≥ 30 ngày</FilterChip>
      </FilterBar>
      <ErrorBox>{actionError}</ErrorBox>
      <DataTable
        caption="Danh sách người dùng" testId="admin-users" rows={rows} loading={loading} error={error} onRetry={reload}
        rowTestId="admin-user-row" getStatus={(u) => (u.active ? 'active' : 'locked')} rowName={(u) => u.name}
        empty={active ? 'Không có người dùng nào khớp bộ lọc.' : 'Chưa có người dùng.'}
        columns={columns}
        actions={(u) => (u.id === me.id ? null : (
          <div className="ui-row-actions">
            <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" aria-label={`Đặt lại mật khẩu: ${u.name}`}
              data-testid="admin-user-password-reset" onClick={() => resetPassword(u)}>Đặt lại MK</button>
            <button type="button" className={`ui-btn ui-btn-sm ui-btn-ghost${u.active ? ' ui-btn-danger' : ''}`}
              aria-label={`${u.active ? 'Khoá' : 'Mở khoá'} tài khoản: ${u.name}`} data-testid={u.active ? 'admin-user-lock' : 'admin-user-unlock'}
              onClick={() => toggleActive(u)}>{u.active ? 'Khoá' : 'Mở khoá'}</button>
          </div>
        ))}
      />
      <CreateUser open={creating} onClose={() => setCreating(false)} onCreated={async (email) => { await reload(); toast(`Đã tạo ${email}`) }} />
    </>
  )
}

function CreateUser({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const formId = useId()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const close = () => { setForm(EMPTY_FORM); setShow(false); setError(null); onClose() }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createUser(form)
      const email = form.email
      close()
      await onCreated(email)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Tạo tài khoản" size="sm" onClose={close} testId="admin-create-user"
      footer={(
        <>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={close}>Huỷ</button>
          <button type="submit" form={formId} className="ui-btn ui-btn-primary" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</button>
        </>
      )}>
      <form id={formId} onSubmit={submit} aria-label="Tạo tài khoản">
        <label className="field"><span>Họ tên</span><input value={form.name} onChange={set('name')} required maxLength={80} autoComplete="off" /></label>
        <label className="field"><span>Email</span><input type="email" value={form.email} onChange={set('email')} required autoComplete="off" /></label>
        <div className="field">
          <label htmlFor={`${formId}-pw`}>Mật khẩu ban đầu</label>
          <div className="ui-row-actions">
            <input id={`${formId}-pw`} type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={8}
              autoComplete="new-password" />
            <button type="button" className="ui-btn ui-btn-sm" aria-pressed={show} onClick={() => setShow(!show)}>Hiện</button>
          </div>
          <small>Tối thiểu 8 ký tự. Gửi riêng cho người dùng; họ tự đổi sau khi đăng nhập.</small>
        </div>
        <label className="field">
          <span>Vai trò</span>
          <select value={form.role} onChange={set('role')}>
            <option value="member">{ROLES.member}</option>
            <option value="admin">{ROLES.admin}</option>
          </select>
        </label>
        <p className="muted small">Mỗi tài khoản mới có sẵn một kho cá nhân.</p>
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  )
}
