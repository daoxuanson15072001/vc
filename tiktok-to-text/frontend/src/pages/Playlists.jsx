// Danh sách phát: của tôi + công khai từ đồng nghiệp. Bấm vào để nghe và đọc lần lượt các thẻ.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { dateTime } from '../format'
import { Empty, ErrorBox, Loading } from '../components/ui'
import { PlaylistForm } from './Player'
import { PageHeader } from '../components/PageHeader'
import { WikiTabs } from './wiki/WikiTabs'

export default function Playlists() {
  const navigate = useNavigate()
  const { data: mine, error } = useFetch(() => api.playlists({ scope: 'mine' }), [])
  const { data: shared } = useFetch(() => api.playlists({ scope: 'public' }), [])
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState(null)

  const create = async (body) => {
    setErr(null)
    try {
      const p = await api.createPlaylist(body)
      navigate(`/playlists/${p.id}`)
    } catch (e) { setErr(e.message) }
  }

  return (
    <>
      <PageHeader title="Danh sách phát" description="Gom thẻ VCWIKI thành danh sách để nghe giọng đọc và đọc lần lượt — như playlist YouTube." actions={
        <button type="button" className="ui-btn ui-btn-primary" data-testid="playlists-create" onClick={() => setCreating(true)}>+ Danh sách mới</button>
      } />
      <WikiTabs />

      {creating && (
        <div className="card pl-create">
          <PlaylistForm submitLabel="Tạo danh sách" onSave={create} onCancel={() => setCreating(false)} />
          <ErrorBox>{err}</ErrorBox>
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>
      <section aria-label="Danh sách phát của tôi">
      <h2 className="wiki-section-h">Của tôi</h2>
      {!mine && !error && <Loading />}
      {mine?.length === 0 && (
        <Empty>Chưa có danh sách nào. Tạo mới ở trên, hoặc mở một thẻ trong <Link className="link" to="/wiki">VCWIKI</Link> và bấm <b>≡+ Danh sách phát</b>.</Empty>
      )}
      <Grid lists={mine} />
      </section>

      {shared?.length > 0 && (
        <section aria-label="Danh sách phát công khai từ đồng nghiệp">
          <h2 className="wiki-section-h">Công khai từ đồng nghiệp</h2>
          <Grid lists={shared} />
        </section>
      )}
    </>
  )
}

function Grid({ lists }) {
  return (
    <div className="card-grid">
      {lists?.map((p) => (
        <Link key={p.id} className="wiki-card pl-tile" to={`/playlists/${p.id}`} data-id={p.id} data-status={p.visibility}
          aria-label={`${p.name} — ${p.count} thẻ, ${p.visibility === 'public' ? 'công khai' : 'riêng tư'}`}>
          <div className="pl-cover">
            <span className="pl-cover-play" aria-hidden="true">▶</span>
            <span className="pl-cover-count">≡ {p.count} thẻ</span>
            {p.cover_title && <span className="pl-cover-title clamp-2">{p.cover_title}</span>}
          </div>
          <div className="strong clamp-2">{p.name}</div>
          {p.description && <div className="muted small clamp-2">{p.description}</div>}
          <div className="meta">
            <span>{p.visibility === 'public' ? '🌐 Công khai' : '🔒 Riêng tư'}</span>
            {!p.can_edit && <span>{p.owner_name}</span>}
            <span>cập nhật {dateTime(p.updated_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
