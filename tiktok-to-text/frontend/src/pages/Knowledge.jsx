// Kho tư liệu (SCR-03, TPL-A) — vỏ trang: đầu trang + tab route chung (pages/kb/KbHeader.jsx) rồi nội dung tab.
// Tab Nguồn ở pages/kb/Sources.jsx; Video / Kênh / Ghi chép dùng trang riêng ở chế độ nhúng. Tiến độ tinh chế là tab thứ
// 5 nhưng giữ route /refine (pages/Refine.jsx dựng cùng đầu trang). Giữ export SourceModal cho thẻ VCWIKI / chat.
import { api } from '../api'
import { useFetch } from '../hooks'
import KbHeader from './kb/KbHeader'
import Sources from './kb/Sources'
import SourceDetail from './kb/SourceDetail'
import Videos from './Videos'
import Channels from './Channels'
import KbNotes from './KbNotes'

export default function Knowledge({ tab = 'sources' }) {
  return (
    <>
      <KbHeader />
      {tab === 'sources' && <Sources />}
      {tab === 'videos' && <Videos embedded />}
      {tab === 'channels' && <Channels embedded />}
      {tab === 'notes' && <KbNotes />}
    </>
  )
}

// Xem nguồn từ chỗ khác (thẻ, chat): ngăn kéo (Drawer tự portal) nổi trên popup đang mở, mở sẵn chữ của tài liệu docId nếu có
export function SourceModal({ id, docId, onClose }) {
  const { data: cats } = useFetch(api.categories, [])
  if (!cats) return null
  return <SourceDetail id={id} docId={docId} cats={cats} onClose={onClose} onChanged={() => {}} modal />
}
