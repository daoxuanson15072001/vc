// VCWIKI — /wiki (SCR-06, TPL-A). Tách file: wiki/{WikiTabs,WikiFilters,CardList,CardDrawer,CardForm,History,ReviewTab,Diff,state}.
// URL: ?space_id ?category ?type ?status ?tag ?q ?source_id ?level ?division ?process_step ?page ?view ?card ?ctab (state.js).
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDebounced, useFetch } from '../hooks'
import { num } from '../format'
import { Empty, ErrorBox, Loading, Pagination } from '../components/ui'
import { promptDialog } from '../components/dialog'
import { toast } from '../components/toast'
import { PageHeader } from '../components/PageHeader'
import { ActionMenu } from '../components/ActionMenu'
import { Segmented } from '../components/Segmented'
import { Drawer } from '../components/Overlay'
import { CategoryTree } from '../components/pickers'
import { CategoryEditor } from '../components/categoryEditor'
import { CardDrawer } from './wiki/CardDrawer'
import { CategoryLinks, Timeline, WikiGrid } from './wiki/CardList'
import { WikiFilters } from './wiki/WikiFilters'
import { WikiTabs } from './wiki/WikiTabs'
import { fetchAllCards, KEYS, PAGE_SIZE, storedView, storeView, TIMELINE_MAX, VIEWS } from './wiki/state'

// Màn khác (Chat, Hộp duyệt) dùng lại hai phần của thẻ
export { CardDrawer } from './wiki/CardDrawer'
export { DiffFields } from './wiki/Diff'

const PLAYLIST_MAX = TIMELINE_MAX   // 1.000 thẻ — khớp playlists.MAX_ITEMS ở BE (Q8, BA 0.48 WK-40)

export default function Wiki() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const f = Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']))
  const page = Number(params.get('page') || 1)
  const openId = params.get('card')
  const [q, setQ] = useState(f.q)
  const [saveError, setSaveError] = useState(null)
  const [editCats, setEditCats] = useState(false)
  const dq = useDebounced(q)

  const update = (changes, resetPage = true) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (resetPage) next.delete('page')
    setParams(next, { replace: true })
  }
  useEffect(() => { if (dq !== f.q) update({ q: dq }) }, [dq]) // eslint-disable-line react-hooks/exhaustive-deps

  // địa chỉ mở một thẻ (giữ bộ lọc đang có) — tiêu đề thẻ trong lưới / lộ trình là Link thật tới đây
  const cardHref = (id) => { const next = new URLSearchParams(params); next.set('card', id); next.delete('ctab'); return `?${next}` }
  const closeCard = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('card'); n.delete('ctab'); return n })
  const openCard = (id) => setParams((p) => { const n = new URLSearchParams(p); n.set('card', id); n.delete('ctab'); return n })

  const urlView = VIEWS.includes(params.get('view')) ? params.get('view') : null
  const saved = storedView()
  const view = urlView || (f.category ? (VIEWS.includes(saved) ? saved : 'timeline') : 'grid')
  const timeline = view === 'timeline'
  const setView = (v) => { storeView(v); update({ view: v }, false) }

  const query = timeline ? f : { ...f, page, page_size: PAGE_SIZE }
  const { data, error, reload } = useFetch(() => (timeline ? fetchAllCards(f) : api.cards(query)),
    [view, JSON.stringify(query)])
  const { data: cats, reload: reloadCats } = useFetch(api.categories, [])
  const { data: spaces } = useFetch(api.spaces, [])
  const { data: tags } = useFetch(() => api.wikiTags({ space_id: f.space_id }), [f.space_id])
  const canCreate = (spaces || []).some((s) => ['owner', 'editor'].includes(s.my_role))
  const refresh = () => { reload(); reloadCats() }
  // link cũ trỏ slug trước khi đổi tên nhánh -> thay bằng slug hiện tại
  useEffect(() => {
    const moved = f.category && cats && !cats.some((c) => c.slug === f.category) &&
      cats.find((c) => c.old_slugs?.includes(f.category))
    if (moved) update({ category: moved.slug }, false)
  }, [f.category, cats]) // eslint-disable-line react-hooks/exhaustive-deps

  // gom TOÀN BỘ kết quả lọc (không chỉ trang đang xem) thành một danh sách phát rồi mở trình phát
  const saveAsPlaylist = async () => {
    const name = await promptDialog({
      title: 'Lưu kết quả lọc thành danh sách phát', label: `Tên danh sách phát (${num(data.total)} thẻ khớp bộ lọc, lưu tối đa ${num(PLAYLIST_MAX)}):`,
      defaultValue: f.q || f.tag || f.category || 'Danh sách mới', okLabel: 'Lưu danh sách phát',
    })
    if (!name?.trim()) return
    setSaveError(null)
    try {
      const all = timeline ? data : await fetchAllCards(f)
      const items = all.items.slice(0, PLAYLIST_MAX)
      const p = await api.createPlaylist({ name: name.trim(), card_ids: items.map((c) => c.id) })
      if (all.total > items.length) toast(`Đã lưu ${num(items.length)}/${num(all.total)} thẻ — danh sách phát tối đa ${num(PLAYLIST_MAX)} thẻ`)
      navigate(`/playlists/${p.id}`)
    } catch (e) { setSaveError(e.message) }
  }

  const menu = [
    data?.items.length > 0 && { label: 'Lưu kết quả lọc thành danh sách phát', icon: 'list-plus', onSelect: saveAsPlaylist, testId: 'wiki-playlist-save' },
    { label: 'Sửa cây lĩnh vực', icon: 'pencil', onSelect: () => setEditCats(true), testId: 'wiki-cats-edit' },
  ]

  return (
    <>
      <PageHeader title="VCWIKI" description="Tri thức đã phân tích, chắt lọc từ Kho tư liệu." actions={
        <>
          <ActionMenu items={menu} label="Thêm" testId="wiki-more" />
          {canCreate && <button type="button" className="ui-btn ui-btn-primary" data-testid="wiki-card-new" onClick={() => openCard('new')}>+ Thẻ mới</button>}
        </>
      } />
      <WikiTabs />

      <div className="wiki-layout">
        <aside className="card wiki-side" aria-label="Cây lĩnh vực">
          <CategoryTree cats={cats} value={f.category} onSelect={(slug) => update({ category: slug })} />
        </aside>
        <section className="wiki-main" aria-label="Danh sách thẻ">
          <WikiFilters f={f} q={q} setQ={setQ} update={update} spaces={spaces} tags={tags} total={data?.total} />

          <CategoryLinks cats={cats} slug={f.category} />
          <ErrorBox>{error || saveError}</ErrorBox>
          {!data && !error && <Loading />}
          {data && data.items.length === 0 && (
            <Empty>Chưa có thẻ nào khớp. Nạp tài liệu ở <b>Kho tư liệu</b> hoặc tạo thẻ tay — xem <Link className="link" to="/guide#nap-tu-lieu">hướng dẫn</Link>.</Empty>
          )}
          <div className="view-bar">
            <span className="muted small">
              {timeline && data ? `${num(data.items.length)} thẻ theo mạch từ bậc thấp lên cao` : ''}
              {timeline && data && data.items.length < data.total && ` — đang hiện ${num(data.items.length)}/${num(data.total)}, lọc thêm để xem hết`}
            </span>
            <Segmented label="Chế độ xem" value={view} onChange={setView} testId="wiki-view"
              options={[{ value: 'timeline', label: 'Lộ trình' }, { value: 'grid', label: 'Lưới' }]} />
          </div>
          {timeline
            ? data && <Timeline cards={data.items} cats={cats} openId={openId} cardHref={cardHref} />
            : <>
              {data && <WikiGrid cards={data.items} cats={cats} openId={openId} cardHref={cardHref} />}
              {data && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => update({ page: p }, false)} />}
            </>}
        </section>
      </div>

      {openId && spaces && cats && (
        <CardDrawer id={openId} spaces={spaces} cats={cats} urlTabs onClose={closeCard} onChanged={refresh}
          onCreated={(c) => update({ card: c.id }, false)} />
      )}
      <Drawer open={editCats} title="Sửa cây lĩnh vực" sub="Dùng chung toàn công ty · AI cũng sửa được qua MCP" size="wide"
        onClose={() => setEditCats(false)}>
        <CategoryEditor stacked onChanged={reloadCats} />
      </Drawer>
    </>
  )
}
