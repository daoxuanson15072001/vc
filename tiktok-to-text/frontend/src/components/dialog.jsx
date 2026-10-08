// Hộp thoại xác nhận / nhập chữ trong app — thay window.confirm / window.prompt.
//
// Vì sao: hộp thoại gốc của trình duyệt không có tên phần tử, AI agent (Claude in Chrome, Playwright) và trình đọc
// màn hình hay kẹt; chữ nút chỉ là OK / Cancel nên không rõ đang đồng ý việc gì. Hộp thoại này có tiêu đề, nội dung,
// nút mang tên hành động thật ("Xoá thẻ", "Nộp bài"), Esc = Huỷ, tiêu điểm tự vào nút an toàn, khoá cuộn nền.
//
// Dùng:
//   import { confirmDialog, promptDialog } from '../components/dialog'
//   if (!(await confirmDialog({ title: 'Xoá thẻ này?', body: 'Thẻ đã duyệt được giữ lại.', okLabel: 'Xoá thẻ', danger: true }))) return
//   const reason = await promptDialog({ title: 'Lý do loại thẻ', label: 'Lý do', required: true })   // null = huỷ
//   confirmDialog('Xoá bình luận này?')  // chuỗi = tiêu đề, nút "Đồng ý"
//
// Có thể dùng ngoài React (hàm sự kiện, helper) vì hộp gắn vào <DialogHost/> duy nhất ở App.jsx qua ref module.
// Máy đọc: role=alertdialog, aria-labelledby, aria-describedby, data-testid="confirm-dialog" (data-kind="confirm"|"prompt"),
// nút data-testid="confirm-ok" / "confirm-cancel", ô nhập data-testid="confirm-input".
import { useEffect, useRef, useState } from 'react'
import { TextArea } from './ui'

let host = null                 // setter của DialogHost đang gắn
let queue = []                  // yêu cầu tới khi chưa có host / đang mở hộp khác

function normalize(opts, kind) {
  const o = typeof opts === 'string' ? { title: opts } : { ...opts }
  return {
    kind,
    title: o.title || (kind === 'prompt' ? 'Nhập thông tin' : 'Xác nhận'),
    body: o.body || '',
    okLabel: o.okLabel || (kind === 'prompt' ? 'Lưu' : 'Đồng ý'),
    cancelLabel: o.cancelLabel || 'Huỷ',
    danger: !!o.danger,
    // prompt
    label: o.label || '',
    placeholder: o.placeholder || '',
    defaultValue: o.defaultValue ?? '',
    required: o.required ?? true,
    multiline: !!o.multiline,
    minLength: o.minLength || 0,
    inputType: o.inputType || 'text',
    testId: o.testId || 'confirm-dialog',
  }
}

function open(req) {
  return new Promise((resolve) => {
    queue.push({ ...req, resolve })
    host?.()
  })
}

/** Hỏi xác nhận. Trả Promise<boolean>. */
export const confirmDialog = (opts) => open(normalize(opts, 'confirm'))
/** Hỏi nhập chữ. Trả Promise<string | null> (null = huỷ). */
export const promptDialog = (opts) => open(normalize(opts, 'prompt'))

// Gắn một lần ở App.jsx (trong và ngoài đăng nhập đều được)
export function DialogHost() {
  const [cur, setCur] = useState(null)
  const [, bump] = useState(0)

  useEffect(() => {
    host = () => bump((n) => n + 1)
    return () => { host = null }
  }, [])

  // lấy yêu cầu kế tiếp khi rảnh
  useEffect(() => {
    if (!cur && queue.length) setCur(queue.shift())
  })

  if (!cur) return null
  const done = (value) => {
    cur.resolve(value)
    setCur(null)
    host?.()   // còn hàng chờ thì mở tiếp
  }
  return <DialogBox req={cur} onDone={done} />
}

function DialogBox({ req, onDone }) {
  const isPrompt = req.kind === 'prompt'
  const [value, setValue] = useState(req.defaultValue)
  const [touched, setTouched] = useState(false)
  const okRef = useRef(null)
  const cancelRef = useRef(null)
  const inputRef = useRef(null)
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null)
  const id = useRef(`dlg-${Math.random().toString(36).slice(2, 8)}`).current

  const trimmed = String(value ?? '').trim()
  const invalid = isPrompt && ((req.required && !trimmed) || (req.minLength && trimmed.length < req.minLength))
  const hint = isPrompt && touched && invalid
    ? (!trimmed ? 'Bắt buộc nhập.' : `Tối thiểu ${req.minLength} ký tự.`)
    : ''

  const cancel = () => onDone(isPrompt ? null : false)
  const ok = () => {
    if (isPrompt) {
      if (invalid) { setTouched(true); inputRef.current?.focus(); return }
      onDone(String(value))
    } else onDone(true)
  }

  useEffect(() => {
    // tiêu điểm: prompt vào ô nhập; xác nhận nguy hiểm vào Huỷ; còn lại vào nút đồng ý
    const el = isPrompt ? inputRef.current : req.danger ? cancelRef.current : okRef.current
    el?.focus()
    if (isPrompt && inputRef.current?.select) inputRef.current.select()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel() }
      else if (e.key === 'Enter' && !(isPrompt && req.multiline) && !(e.target.tagName === 'BUTTON' && e.target !== okRef.current)) {
        // Enter trong ô nhập một dòng hoặc ở nền hộp = đồng ý; ở nút Huỷ vẫn là Huỷ
        if (e.target === cancelRef.current) return
        e.preventDefault(); ok()
      } else if (e.key === 'Tab') {
        // giữ tiêu điểm trong hộp
        const focusables = [inputRef.current, cancelRef.current, okRef.current].filter(Boolean)
        const i = focusables.indexOf(document.activeElement)
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); focusables[focusables.length - 1].focus() }
        else if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prev
      opener.current?.focus?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const Input = req.multiline ? TextArea : 'input'
  return (
    <>
      <div className="overlay overlay-dialog" aria-hidden="true" onClick={cancel} />
      <div className="modal dialog-box" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`}
        aria-describedby={req.body ? `${id}-body` : undefined} data-testid={req.testId} data-kind={req.kind}>
        <h2 id={`${id}-title`} className="dialog-title">{req.title}</h2>
        {req.body && <div id={`${id}-body`} className="dialog-body">{req.body}</div>}
        {isPrompt && (
          <label className="field dialog-field">
            <span>{req.label || req.title}</span>
            <Input ref={inputRef} type={req.multiline ? undefined : req.inputType} rows={req.multiline ? 3 : undefined}
              value={value} placeholder={req.placeholder} minLength={req.minLength || undefined}
              onChange={(e) => setValue(e.target.value)} onBlur={() => setTouched(true)}
              aria-invalid={touched && invalid ? 'true' : undefined} aria-describedby={hint ? `${id}-hint` : undefined}
              data-testid="confirm-input" />
            {hint && <small id={`${id}-hint`} className="tone-bad" role="alert">{hint}</small>}
          </label>
        )}
        <div className="actions dialog-actions">
          <button type="button" ref={cancelRef} className="btn btn-ghost" onClick={cancel} data-testid="confirm-cancel">{req.cancelLabel}</button>
          <button type="button" ref={okRef} className={`btn ${req.danger ? 'btn-danger' : 'btn-primary'}`} onClick={ok}
            aria-disabled={isPrompt && invalid ? 'true' : undefined} data-testid="confirm-ok">{req.okLabel}</button>
        </div>
      </div>
    </>
  )
}
