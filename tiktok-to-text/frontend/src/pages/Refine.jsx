// Tiến độ tinh chế (SCR-04, TPL-D) — tab thứ 5 của Kho tư liệu, giữ route /refine và /refine/live. Một màn hai chế độ
// (Segmented «Tổng hợp / Trực tiếp»): /refine?view=live hoặc /refine/live (mở sẵn Trực tiếp). Kho lọc ở ?space_id=.
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { Segmented } from '../components/Segmented'
import { SelectField } from '../components/FilterBar'
import { spaceLabel } from '../components/pickers'
import { useUrlState } from '../urlState'
import KbHeader from './kb/KbHeader'
import RefineSummary from './kb/RefineSummary'
import RefineLiveView from './kb/RefineLiveView'

const SCHEMA = { view: { default: '', values: ['', 'live'] }, space_id: { default: '' } }

export default function Refine({ live = false }) {
  const [st, set] = useUrlState(SCHEMA)
  const { search } = useLocation()
  const navigate = useNavigate()
  const { data: spaces } = useFetch(api.spaces, [])
  const view = live || st.view === 'live' ? 'live' : ''
  const setView = (v) => {
    if (v === view) return
    const p = new URLSearchParams(search)
    p.delete('view')
    if (live) navigate({ pathname: '/refine', search: p.toString() })        // /refine/live → Tổng hợp
    else set({ view: v }, { push: true })
  }
  return (
    <>
      <KbHeader />
      <div className="kb-refine-bar">
        <Segmented label="Chế độ xem tiến độ" value={view} onChange={setView} testId="refine-view" options={[
          { value: '', label: 'Tổng hợp' }, { value: 'live', label: 'Trực tiếp' }]} />
        <SelectField label="Kho" value={st.space_id} onChange={(v) => set({ space_id: v })} testId="refine-space"
          options={[{ value: '', label: 'Tất cả kho tôi xem được' }, ...(spaces || []).map((s) => ({ value: s.id, label: spaceLabel(s) }))]} />
      </div>
      {view === 'live' ? <RefineLiveView spaceId={st.space_id} /> : <RefineSummary spaceId={st.space_id} />}
    </>
  )
}
