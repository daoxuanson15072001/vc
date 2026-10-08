// Video lấy chữ lỗi của mọi kênh (SCR-03, menu Thao tác ▾ → «Xem video lỗi mọi kênh», mở bằng ?failed=1) theo kho / ô tìm
// / lĩnh vực đang lọc: nhóm lỗi để tìm chỗ cải tiến, số lần lỗi, lịch sử từng lần; «Lấy lại chữ» thủ công được ưu tiên.
// Lọc riêng của khung lên URL: ?fkind= (nhóm lỗi), ?fmax= (true / false: đã dừng tự thử), ?fpage=.
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { dateTime, num } from '../../format'
import { ErrorBox, Pagination } from '../../components/ui'
import { FilterChip, SelectField } from '../../components/FilterBar'
import { useUrlState } from '../../urlState'
import { toast } from '../../components/toast'
import { withOpen } from '../../contentSearch'
import { FailLog, FailTimes } from './shared'

const SCHEMA = { fkind: { default: '' }, fmax: { default: '', values: ['', 'true', 'false'] }, fpage: { type: 'number', default: 1 } }

export default function FailedVideos({ spaceId, q, category }) {
  const [st, set] = useUrlState(SCHEMA)
  const [params] = useSearchParams()
  const [sent, setSent] = useState(() => new Set())
  const query = { space_id: spaceId, q, category, error_kind: st.fkind, exhausted: st.fmax, page: st.fpage, page_size: 30 }
  const { data, error, reload } = useFetch(() => api.failedVideos(query), [JSON.stringify(query)])
  const max = data?.max_auto_retry || 3
  const redo = async (v) => {
    try {
      await api.retranscribeVideos(v.source_id, { video_ids: [v.key] })
      setSent(new Set(sent).add(v.key))
      toast(`Đã xếp lấy lại chữ (ưu tiên): ${v.title}`)
    } catch (e) {
      toast(e.message, { tone: 'error' })
    }
  }
  return (
    <section className="card failed-videos" aria-label="Video lỗi" data-testid="kb-failed-videos">
      <div className="section-head">
        <h2 className="kb-h2">Video lấy chữ lỗi {data && <span className="muted">({num(data.total)})</span>}</h2>
        <SelectField label="Số lần lỗi" value={st.fmax} onChange={(v) => set({ fmax: v, fpage: 1 })} options={[
          { value: '', label: 'Mọi số lần lỗi' },
          { value: 'false', label: `Máy còn tự thử (dưới ${max} lần)` },
          { value: 'true', label: `Dừng tự thử (≥${max} lần, hội viên, đã gỡ)` }]} />
        <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" onClick={reload}>Làm mới</button>
      </div>
      {data?.kinds.length > 0 && (
        <div className="kb-chips" role="group" aria-label="Nhóm lỗi">
          <FilterChip pressed={!st.fkind} onClick={() => set({ fkind: '', fpage: 1 })}>Mọi lỗi</FilterChip>
          {data.kinds.map((k) => (
            <FilterChip key={k.kind} pressed={st.fkind === k.kind} onClick={() => set({ fkind: st.fkind === k.kind ? '' : k.kind, fpage: 1 })}>
              {k.label} ({num(k.n)})
            </FilterChip>
          ))}
        </div>
      )}
      <ErrorBox onRetry={reload}>{error}</ErrorBox>
      {data && !data.items.length && <p className="muted">Không có video lỗi nào trong bộ lọc này.</p>}
      {data?.items.map((v) => (
        <div key={`${v.source_id}:${v.key}`} className="doc-row" data-id={v.key} data-status="error">
          <div className="grow">
            <div className="strong clamp-1">{v.title}</div>
            <div className="muted small">
              <Link className="link" to={`?${withOpen(params, v.source_id)}`} aria-label={`Mở nguồn: ${v.source_title}`}>{v.source_title}</Link>
              {v.space_name && ` · ${v.space_name}`}{v.last_failed_at && ` · lỗi gần nhất ${dateTime(v.last_failed_at)}`}
            </div>
            <div className="meta">
              <span className="ui-badge">{v.error_label}</span> <FailTimes v={v} max={max} />
              {sent.has(v.key) && <span className="ui-badge" data-tone="warn">Đã xếp lấy lại chữ (ưu tiên)</span>}
            </div>
            <div className="tone-bad small clamp-2">{v.error}</div>
            <FailLog log={v.fail_log} />
          </div>
          <div className="doc-actions">
            {v.url && <a className="link small" href={v.url} target="_blank" rel="noreferrer" aria-label={`Mở video (tab mới): ${v.title}`}>Mở video ↗</a>}
            {v.can_edit && !sent.has(v.key) && (
              <button type="button" className="link small" onClick={() => redo(v)} aria-label={`Lấy lại chữ: ${v.title}`}>Lấy lại chữ</button>
            )}
          </div>
        </div>
      ))}
      {data && data.total > 30 && <Pagination page={st.fpage} total={data.total} pageSize={30} onPage={(p) => set({ fpage: p })} />}
    </section>
  )
}
