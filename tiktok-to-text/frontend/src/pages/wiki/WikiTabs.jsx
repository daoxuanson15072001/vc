// Tab route đầu trang VCWIKI (SCR-06, CMP-03 kind="route"): Thẻ · Bản đồ · Danh sách phát · Bình chọn tháng.
// Gắn ở cả bốn trang (Wiki, WikiGraph, Playlists, Leaderboard); h1 mỗi trang vẫn theo routes.js.
// Kho đang lọc (?space_id=) được mang theo khi chuyển giữa Thẻ và Bản đồ.
import { useSearchParams } from 'react-router-dom'
import { Tabs } from '../../components/Tabs'

export function WikiTabs() {
  const [params] = useSearchParams()
  const space = params.get('space_id')
  const q = space ? `?space_id=${encodeURIComponent(space)}` : ''
  return (
    <Tabs kind="route" label="Chế độ VCWIKI" testId="wiki-tabs" items={[
      { to: `/wiki${q}`, label: 'Thẻ', end: true, testId: 'wiki-tab-cards' },
      { to: `/wiki/graph${q}`, label: 'Bản đồ', testId: 'wiki-tab-graph' },
      { to: '/playlists', label: 'Danh sách phát', testId: 'wiki-tab-playlists' },
      { to: '/leaderboard', label: 'Bình chọn tháng', testId: 'wiki-tab-leaderboard' },
    ]} />
  )
}
