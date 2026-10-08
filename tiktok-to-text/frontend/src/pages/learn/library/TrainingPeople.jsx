import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { ErrorBox } from '../../../components/ui'

export function PeoplePicker({ label, value, onChange, multiple = false, required = false, disabled = false }) {
  const { data, error, reload } = useFetch(() => api.orgPeople(), [])
  return <div className="field"><label><span>{label}</span><select multiple={multiple} value={value || (multiple ? [] : '')} required={required} disabled={disabled} onChange={e => onChange(multiple ? Array.from(e.target.selectedOptions, x => x.value) : e.target.value)}>
    {!multiple && <option value="">Chọn người</option>}{(data || []).map(x => <option key={x.id} value={x.id}>{x.name} · {x.email}</option>)}
  </select></label>{multiple && <small className="muted">Giữ Ctrl / ⌘ để chọn nhiều người.</small>}<ErrorBox onRetry={reload}>{error}</ErrorBox></div>
}
export function UnitPicker({ value, onChange }) {
  const { data, error, reload } = useFetch(() => api.orgUnits(), [])
  return <div className="field"><label><span>Đơn vị phụ trách</span><select value={value || ''} onChange={e => onChange(e.target.value)}><option value="">Chưa gắn đơn vị</option>{(data || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><ErrorBox onRetry={reload}>{error}</ErrorBox></div>
}
