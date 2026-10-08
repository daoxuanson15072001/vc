// Tab «Ghi chép» của Kho tư liệu — /kb/notes (WK-45, SCR-03, mẫu TPL-A): tìm lại và xem lại ghi chép của cả kênh hay
// từng đơn vị nguồn (một video, một file). Mọi bộ lọc + trang nằm trên URL (?q=&space_id=&source_id=&doc_id=&mine=1
// &kind=&page=). Kết quả gom theo nguồn, mới nhất trước; mục «Khi nạp» là ghi chú của người nạp (WK-44).
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDebounced, useFetch } from '../hooks'
import { num, SOURCE_KIND } from '../format'
import { Empty, ErrorBox, Loading, Pagination } from '../components/ui'
import { SpaceSelect } from '../components/pickers'
import { NoteForm, NoteList } from '../components/kbNotes'
import { groupBySource, readNoteFilters, withNoteFilter } from '../notes'

const PAGE_SIZE = 30

export default function KbNotes() {
  const [params, setParams] = useSearchParams()
  const f = readNoteFilters(params)
  const set = (k) => (v) => setParams(withNoteFilter(params, k, v), { replace: k !== 'page' })
  const { data: spaces } = useFetch(api.spaces, [])
  // chọn nguồn: 100 nguồn mới nhất của kho đang lọc + nguồn đang chọn (kể cả nguồn cũ hơn)
  const { data: srcList } = useFetch(() => api.sources({ space_id: f.space_id, page_size: 100 }), [f.space_id])
  const { data: picked } = useFetch(() => (f.source_id ? api.source(f.source_id) : Promise.resolve(null)), [f.source_id])

  const [q, setQ] = useState(f.q)
  useEffect(() => setQ(f.q), [f.q])
  const dq = useDebounced(q)
  useEffect(() => { if (dq !== f.q) set('q')(dq.trim()) }, [dq]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = { q: f.q, space_id: f.space_id, source_id: f.source_id, doc_id: f.doc_id, mine: f.mine ? 1 : '',
    kind: f.kind, page: f.page, page_size: PAGE_SIZE }
  const { data, error, reload } = useFetch(() => api.kbNotes(query), [JSON.stringify(query)])
  const sourceOptions = [...(srcList?.items || [])]
  if (picked && !sourceOptions.some((s) => s.id === picked.id)) sourceOptions.unshift(picked)
  const filtered = f.q || f.space_id || f.source_id || f.mine || f.kind

  return (
    <>
      <section className="filters card" aria-label="Lọc ghi chép">
        <input className="search" type="search" placeholder="Tìm trong ghi chép…" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Tìm trong ghi chép" data-testid="kb-notes-search" />
        <SpaceSelect spaces={spaces} value={f.space_id} onChange={set('space_id')} allowAll label="Kho" testId="kb-notes-filter-space" />
        <select value={f.source_id} onChange={(e) => set('source_id')(e.target.value)} aria-label="Nguồn"
          data-testid="kb-notes-filter-source">
          <option value="">Mọi nguồn</option>
          {sourceOptions.map((s) => (
            <option key={s.id} value={s.id}>{SOURCE_KIND[s.kind]?.icon} {(s.title || s.file?.name || s.url || '').slice(0, 70)}</option>
          ))}
        </select>
        {f.source_id && picked?.documents?.length > 0 && (
          <select value={f.doc_id} onChange={(e) => set('doc_id')(e.target.value)} aria-label="Tài liệu"
            data-testid="kb-notes-filter-doc">
            <option value="">Cả nguồn và mọi tài liệu ({num(picked.documents.length)})</option>
            {picked.documents.map((d) => (
              <option key={d.id} value={d.id}>{d.title.slice(0, 70)}{d.note_count ? ` (${d.note_count})` : ''}</option>
            ))}
          </select>
        )}
        <select value={f.kind} onChange={(e) => set('kind')(e.target.value)} aria-label="Loại ghi chép" data-testid="kb-notes-filter-kind">
          <option value="">Mọi loại</option>
          <option value="note">Ghi chép</option>
          <option value="intake">Khi nạp (ghi chú của người nạp)</option>
        </select>
        <label className="nowrap">
          <input type="checkbox" checked={!!f.mine} onChange={(e) => set('mine')(e.target.checked ? '1' : '')}
            data-testid="kb-notes-filter-mine" /> Chỉ của tôi
        </label>
        {filtered && <button className="btn btn-ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Xoá lọc</button>}
      </section>

      {f.source_id && picked?.can_note && (
        <div className="card note-add-card">
          <NoteForm key={`${f.source_id}|${f.doc_id}`} sourceId={f.source_id} docId={f.doc_id || null} onSaved={reload}
            label={f.doc_id ? `Ghi chép cho: ${picked.documents.find((d) => d.id === f.doc_id)?.title || 'tài liệu'}`
              : `Ghi chép cho cả nguồn: ${picked.title || picked.url || ''}`} />
        </div>
      )}

      <ErrorBox onRetry={reload}>{error}</ErrorBox>
      {!data && !error && <Loading />}
      {data && data.items.length === 0 && (
        <Empty testId="kb-notes-empty">
          {filtered
            ? 'Không có ghi chép nào khớp bộ lọc. Thử bỏ bớt lọc hoặc đổi từ khoá.'
            : <>Chưa có ghi chép nào. Mở một nguồn ở tab <Link className="link" to="/kb">Nguồn</Link>, bấm «Ghi chép» ở cả nguồn hoặc từng video / file để ghi lại điều muốn nhớ — AI cũng dùng ghi chép làm gợi ý khi phân loại.</>}
        </Empty>
      )}
      {data && data.items.length > 0 && (
        <div data-testid="kb-notes-list">
          {groupBySource(data.items).map((g) => (
            <section key={g.source_id} className="card note-group" aria-labelledby={`notes-src-${g.source_id}`}
              data-testid="kb-notes-group" data-id={g.source_id}>
              <div className="section-head">
                <h2 id={`notes-src-${g.source_id}`} className="clamp-2">
                  <span aria-hidden="true">{SOURCE_KIND[g.kind]?.icon} </span>{g.title}
                </h2>
                <div className="row small">
                  <span className="muted">{[SOURCE_KIND[g.kind]?.label, g.platform, g.space_name].filter(Boolean).join(' · ')}</span>
                  {f.source_id !== g.source_id && (
                    <Link className="link" to={`/kb/notes?${withNoteFilter(params, 'source_id', g.source_id)}`}
                      aria-label={`Chỉ xem ghi chép của nguồn: ${g.title}`}>Chỉ nguồn này</Link>
                  )}
                  <Link className="link" to={`/kb?source=${g.source_id}`} aria-label={`Mở nguồn: ${g.title}`}>Mở nguồn</Link>
                </div>
              </div>
              <NoteList items={g.items} onChanged={reload} />
            </section>
          ))}
          <div className="table-foot">
            <span className="muted small">{num(data.total)} ghi chép</span>
            <Pagination page={f.page} pageSize={PAGE_SIZE} total={data.total} onPage={set('page')} />
          </div>
        </div>
      )}
    </>
  )
}
