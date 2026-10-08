// Đổi mật khẩu của chính mình (SCR-21 · SYS-03) — hộp `Modal` dùng chung, thay form đổi mật khẩu dựng riêng trong
// AppShell: nhãn thật cho từng ô, có ô nhập lại, lỗi hiện bằng chữ (ErrorBox), thành công báo bằng toast.
//
// Dùng (AppShell): <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
import { useId, useState } from 'react'
import { api } from '../api'
import { ErrorBox } from './ui'
import { Modal } from './Overlay'
import { toast } from './toast'

const EMPTY = { current: '', new: '', confirm: '' }

export default function ChangePassword({ open = true, onClose }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const formId = useId()

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const close = () => { setForm(EMPTY); setError(null); onClose() }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (form.new !== form.confirm) return setError('Mật khẩu nhập lại không khớp')
    setBusy(true)
    try {
      await api.changePassword({ current: form.current, new: form.new })
      close()
      toast('Đã đổi mật khẩu')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Đổi mật khẩu" size="sm" onClose={close} testId="password-modal"
      footer={(
        <>
          <button type="button" className="ui-btn ui-btn-ghost" onClick={close}>Huỷ</button>
          <button type="submit" form={formId} className="ui-btn ui-btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
        </>
      )}>
      <form id={formId} onSubmit={submit} aria-label="Đổi mật khẩu">
        <label className="field">
          <span>Mật khẩu hiện tại</span>
          <input type="password" placeholder="Mật khẩu hiện tại" value={form.current} onChange={set('current')} required autoComplete="current-password" />
        </label>
        <label className="field">
          <span>Mật khẩu mới</span>
          <input type="password" placeholder="Mật khẩu mới (≥ 8 ký tự)" value={form.new} onChange={set('new')} required minLength={8} autoComplete="new-password" />
          <small>Tối thiểu 8 ký tự</small>
        </label>
        <label className="field">
          <span>Nhập lại mật khẩu mới</span>
          <input type="password" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" />
        </label>
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  )
}
