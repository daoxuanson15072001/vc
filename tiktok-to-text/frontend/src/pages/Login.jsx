import { useId, useState } from 'react'
import { api } from '../api'
import { ErrorBox } from '../components/ui'

export default function Login({ needsSetup, onDone }) {
  const [form, setForm] = useState({ email: '', name: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const titleId = useId()
  const errId = useId()

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onDone(needsSetup ? await api.setup(form) : await api.login({ email: form.email, password: form.password }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit} aria-labelledby={titleId} aria-describedby={error ? errId : undefined} data-testid="login-form">
        <div className="brand">
          <span className="brand-mark">🎬</span>
          <div>
            <div className="brand-name">VC Content Engine</div>
            <div className="brand-sub">TikTok → Text · VCWIKI</div>
          </div>
        </div>
        {/* h1 duy nhất của màn; giữ cỡ chữ như .login h2 cũ (styles.css) */}
        <h1 id={titleId} className="login-title" style={{ fontSize: 16, margin: '18px 0 8px' }}>{needsSetup ? 'Tạo tài khoản quản trị' : 'Đăng nhập'}</h1>
        {needsSetup && <p className="muted small">Lần chạy đầu tiên. Tài khoản này quản lý người dùng và cây lĩnh vực.</p>}
        {needsSetup && (
          <label className="field"><span>Họ tên</span><input value={form.name} onChange={set('name')} required /></label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          <span>Mật khẩu</span>
          <input type="password" value={form.password} onChange={set('password')} minLength={needsSetup ? 8 : undefined}
            autoComplete={needsSetup ? 'new-password' : 'current-password'} required />
          {needsSetup && <small>Tối thiểu 8 ký tự</small>}
        </label>
        <div id={errId}><ErrorBox testId="login-error">{error}</ErrorBox></div>
        <button className="btn btn-primary btn-block" disabled={busy} data-testid="login-submit">
          {busy ? 'Đang xử lý…' : needsSetup ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
        {!needsSetup && <p className="muted small">Chưa có tài khoản? Liên hệ quản trị viên.</p>}
      </form>
    </div>
  )
}
