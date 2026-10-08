// Mảnh dùng chung của Cơ cấu tổ chức (SCR-18): nhãn, ô chọn người / đơn vị / chức năng, chạy hành động có toast.
// Chỉ dùng trong pages/Org.jsx và pages/org/*.
import { useId } from 'react'
import { toast } from '../../components/toast'

export const KIND = { group: 'Tập đoàn', division: 'Division', department: 'Phòng', team: 'Nhóm' }
export const KIND_ORDER = ['group', 'division', 'department', 'team']
export const ROLE = {
  editor: 'Biên tập viên',
  reviewer: 'Người duyệt',
  category_owner: 'Chủ sở hữu lĩnh vực',
  lnd: 'Quản lý đào tạo',
  doc_control: 'Kiểm soát tài liệu',
  auditor: 'Kiểm toán',
}
// Cấp bậc nhân sự (ORG-05 phần dữ liệu) — bảng ánh xạ sang bậc nội dung sửa ở tab Cấp bậc
export const LEVELS = { 1: 'Thực tập sinh', 2: 'Nhân viên', 3: 'Key staff', 4: 'Leader', 5: 'Trưởng phòng', 6: 'Giám đốc', 7: 'Tổng giám đốc' }
export const CONTENT_LEVEL = { 'nhap-mon': 'Nhập môn', 'thuc-thi': 'Thực thi', 'van-hanh': 'Vận hành', 'thiet-ke': 'Thiết kế', 'dieu-hanh': 'Điều hành' }

// Ngày (yyyy-mm-dd, giờ máy) -> hết ngày đó, dạng ISO
export const endOfDay = (d) => (d ? new Date(`${d}T23:59:59`).toISOString() : null)

export const scopeText = (s, fnName) => {
  const parts = []
  if (s?.unit) parts.push(`${s.unit.name} (${s.unit.code})`)
  if (s?.category) parts.push(`lĩnh vực ${s.category}`)
  if (s?.function) parts.push(`chức năng ${fnName?.(s.function) || s.function}`)
  return parts.length ? parts.join(' · ') : 'Toàn công ty'
}

export const fnNameOf = (functions) => (c) => functions.find((f) => f.code === c)?.name || c

// Trạng thái người: left (đã nghỉ) · locked (tài khoản khoá) · active
export const personStatus = (p) => (p.org?.status === 'left' ? 'left' : p.active ? 'active' : 'locked')

// Chạy một hành động: thành công → toast `ok` (chuỗi hoặc hàm của kết quả) rồi `after()`; lỗi → toast lỗi.
// Trả kết quả (hoặc true) khi thành công, false khi lỗi.
export async function run(fn, ok, after) {
  try {
    const r = await fn()
    after?.()
    if (ok) toast(typeof ok === 'function' ? ok(r) : ok)
    return r ?? true
  } catch (e) {
    toast(e.message, { tone: 'error' })
    return false
  }
}

export function PersonSelect({ people, value, onChange, exclude, required, empty = '— Chọn người —', id, label }) {
  const list = people.filter((p) => p.active && p.org?.status !== 'left' && p.id !== exclude)
  return (
    <select id={id} aria-label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{empty}</option>
      {list.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}
    </select>
  )
}

export function UnitSelect({ units, value, onChange, empty = '— Chọn đơn vị —', exclude = [], required, id, label }) {
  return (
    <select id={id} aria-label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{empty}</option>
      {units.filter((u) => u.active && !exclude.includes(u.id)).map((u) => (
        <option key={u.id} value={u.id}>{'\u00a0\u00a0'.repeat(u.depth - 1)}{u.name} ({u.code})</option>
      ))}
    </select>
  )
}

export function FunctionSelect({ functions, value, onChange, empty = '— Không —', id, label }) {
  return (
    <select id={id} aria-label={label} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{empty}</option>
      {functions.filter((f) => f.active || f.code === value).map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
    </select>
  )
}

// Ô có nhãn cho các ô chọn ở trên (label bọc + htmlFor để luật jsx-a11y thấy được ô bên trong component)
export function Field({ label, children }) {
  const id = useId()
  return <label className="field" htmlFor={id}><span>{label}</span>{children(id)}</label>
}
