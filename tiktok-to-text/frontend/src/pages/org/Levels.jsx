// Tab Cấp bậc (SCR-18, ORG-05 phần dữ liệu, Phân loại v2 mục 11 — chỉ quản trị viên): bảng cấp bậc → bậc nội dung
// ở mảng của mình / mảng khác.
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { ErrorBox, Loading } from '../../components/ui'
import { CONTENT_LEVEL, LEVELS, run } from './shared'

const SIDE = { own: 'mảng của mình', other: 'mảng khác' }

export default function Levels() {
  const { data, error, reload } = useFetch(api.orgLevelMap, [])
  const [draft, setDraft] = useState(null)
  useEffect(() => { if (data) setDraft(data.levels) }, [data])
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!draft) return <Loading />
  const toggle = (lv, side, val) => {
    const cur = draft[lv][side]
    setDraft({ ...draft, [lv]: { ...draft[lv], [side]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] } })
  }
  return (
    <section className="card org-stack" aria-labelledby="org-levels-h">
      <h2 id="org-levels-h" className="org-h2">Cấp bậc → bậc nội dung</h2>
      <p className="muted small org-flush">
        Mỗi cấp bậc học / nhận thẻ ở bậc nào: <b>mảng của mình</b> = mảng tri thức của chức năng chính (tab Chức năng), <b>mảng khác</b> = các mảng còn lại.
        Dùng cho lộ trình học và phân phối thẻ mới — không dùng để chặn quyền xem.
      </p>
      <div className="table-wrap">
        <table className="table level-map">
          <caption className="sr-only">Bảng cấp bậc nhân sự và bậc nội dung được học ở mảng của mình và mảng khác</caption>
          <thead><tr><th scope="col">Cấp bậc</th><th scope="col">Mảng của mình</th><th scope="col">Mảng khác</th></tr></thead>
          <tbody>
            {Object.entries(LEVELS).map(([lv, name]) => (
              <tr key={lv}>
                <th scope="row" className="strong">{lv} · {name}</th>
                {['own', 'other'].map((side) => (
                  <td key={side}>
                    {Object.entries(CONTENT_LEVEL).map(([k, label]) => (
                      // aria-label giữ mã own / other (e2e + AI agent đang dùng); title đọc được cho người
                      <label key={k} className="check" title={`Cấp ${lv}, ${SIDE[side]}: ${label}`}>
                        <input type="checkbox" aria-label={`Cấp ${lv} ${side} ${label}`} checked={draft[lv][side].includes(k)} onChange={() => toggle(lv, side, k)} /> {label}
                      </label>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="org-actions">
        <button type="button" className="ui-btn" onClick={() => setDraft(data.levels)}>Hoàn tác</button>
        <button type="button" className="ui-btn ui-btn-primary" onClick={() => run(() => api.putOrgLevelMap(draft), 'Đã lưu bảng cấp bậc', reload)}>Lưu bảng</button>
      </div>
    </section>
  )
}
