// Tab «Kênh» của Kho tư liệu (SCR-03, chỉ dùng nhúng trong Knowledge.jsx): thống kê theo kênh đã quét. Tên kênh là
// link sang tab Video lọc sẵn kênh; cột Nền tảng; nút «Quét lại kênh» trên hàng gọi lại API nạp link kênh (lấy video
// mới, video đã có được bỏ qua; kênh chưa là nguồn trong kho cá nhân thì thành nguồn mới ở đó).
import { useState } from 'react'
import { api } from '../api'
import { useFetch } from '../hooks'
import { compact, date, num } from '../format'
import { DataTable } from '../components/DataTable'
import { toast } from '../components/toast'
import { Icon } from '../components/icons'

const PLATFORMS = {
  tiktok: { label: 'TikTok' },
  youtube: { label: 'YouTube' },
  facebook: { label: 'Facebook' },
  website: { label: 'Website' },
}

export default function Channels() {
  const { data, error, loading, reload } = useFetch(api.channels, [])
  const [busy, setBusy] = useState(null)

  const rescan = async (c) => {
    setBusy(c.handle)
    try {
      const r = await api.addLinks({ urls: [c.channel_url] })
      toast(r.requeued?.length ? `Đã xếp quét lại kênh ${c.name} — video đã có được bỏ qua`
        : r.created?.length ? `Đã nạp kênh ${c.name} thành nguồn mới trong kho cá nhân`
          : `Kênh ${c.name} đang được quét`)
    } catch (e) {
      toast(e.message, { tone: 'error' })
    }
    setBusy(null)
  }

  const plat = (c) => PLATFORMS[c.platform] || PLATFORMS.website
  const columns = [
    { key: 'name', header: 'Kênh', title: true, to: (c) => `/kb/videos?channel=${encodeURIComponent(c.handle)}`, render: (c) => c.name },
    { key: 'handle', header: 'Tài khoản', className: 'muted small', render: (c) => `@${c.handle}` },
    { key: 'platform', header: 'Nền tảng', render: (c) => <span className="ui-badge">{plat(c).label}</span> },
    { key: 'videos', header: 'Video', className: 'num', render: (c) => num(c.videos) },
    { key: 'ok', header: 'Có lời nói', className: 'num', render: (c) => num(c.ok) },
    { key: 'errors', header: 'Lỗi', className: 'num', render: (c) => <span className={c.errors ? 'tone-bad' : ''}>{num(c.errors)}</span> },
    { key: 'views', header: 'Tổng xem', className: 'num strong', render: (c) => compact(c.views) },
    { key: 'avg', header: 'TB xem/video', className: 'num', render: (c) => compact(c.avg_views) },
    { key: 'likes', header: 'Tổng thích', className: 'num', render: (c) => compact(c.likes) },
    { key: 'last', header: 'Video mới nhất', className: 'nowrap', render: (c) => date(c.last_posted_at) },
  ]

  return (
    <div className="kb-stack">
      <p className="muted kb-flush">
        Thống kê theo kênh đã quét. Bấm tên kênh để xem video của kênh; «Quét lại kênh» lấy video mới (video đã có được bỏ qua).
      </p>
      <DataTable caption="Thống kê theo kênh đã quét — bấm tên kênh để xem video của kênh" testId="channels-table"
        rows={data} columns={columns} getId={(c) => `${c.platform}:${c.handle}`} getKind={(c) => c.platform} rowName={(c) => c.name}
        loading={loading && !data} error={error} onRetry={reload} empty="Chưa có kênh nào — dán link kênh ở «Nạp nguồn» để bắt đầu."
        actionsHeader="Thao tác"
        actions={(c) => c.channel_url && (
          <span className="ui-row-actions">
            <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" disabled={busy === c.handle} onClick={() => rescan(c)}
              aria-label={`Quét lại kênh: ${c.name}`} data-testid="channels-rescan">
              <Icon name="refresh" size={16} />Quét lại kênh
            </button>
            <a className="ui-btn ui-btn-sm ui-btn-ghost" href={c.channel_url} target="_blank" rel="noreferrer"
              aria-label={`Mở kênh ${c.name} trên ${plat(c).label} (tab mới)`}>{plat(c).label} ↗</a>
          </span>
        )} />
    </div>
  )
}
