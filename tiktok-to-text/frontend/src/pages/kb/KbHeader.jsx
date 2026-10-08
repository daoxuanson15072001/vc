// Đầu trang chung của Kho tư liệu (SCR-03) ở mọi tab: h1 «Kho tư liệu», nút *Tìm video theo chủ đề* (/discover) + nút
// chính **Nạp nguồn** (link ?add=1 → ngăn kéo nạp, nhận thêm &space_id=), tab route Nguồn · Video · Kênh · Ghi chép ·
// Tiến độ tinh chế (/refine, /refine/live giữ route). Kéo thả file vào bất kỳ đâu trên trang cũng mở ngăn kéo nạp.
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { Icon } from '../../components/icons'
import AddSourceDrawer from './AddSource'
import { KB_CHANGED } from './shared'

export const KB_TABS = [
  { to: '/kb', label: 'Nguồn', end: true, testId: 'kb-tab-sources' },
  { to: '/kb/videos', label: 'Video', testId: 'kb-tab-videos' },
  { to: '/kb/channels', label: 'Kênh', testId: 'kb-tab-channels' },
  { to: '/kb/notes', label: 'Ghi chép', testId: 'kb-tab-notes' },
  { to: '/refine', label: 'Tiến độ tinh chế', testId: 'kb-tab-refine' },
]

const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files')

export default function KbHeader() {
  const [params, setParams] = useSearchParams()
  const { search } = useLocation()
  const adding = params.get('add') === '1'
  const [dropped, setDropped] = useState(null)
  const [dragging, setDragging] = useState(false)

  const addHref = (() => { const p = new URLSearchParams(search); p.set('add', '1'); return `?${p}` })()
  const openAdd = useCallback(() => setParams((p) => { const n = new URLSearchParams(p); n.set('add', '1'); return n }), [setParams])
  const closeAdd = () => {
    setDropped(null)
    setParams((p) => { const n = new URLSearchParams(p); n.delete('add'); return n })
  }

  // Thả file ở bất kỳ đâu: giữ file lại, mở ngăn kéo nạp (khung nạp tự thêm file). Thả đúng vào khung nạp thì khung tự
  // xử lý (preventDefault) — ở đây bỏ qua.
  useEffect(() => {
    const over = (e) => { if (!hasFiles(e)) return; e.preventDefault(); setDragging(true) }
    const leave = (e) => { if (!e.relatedTarget) setDragging(false) }
    const drop = (e) => {
      setDragging(false)
      if (!hasFiles(e) || e.defaultPrevented) return
      e.preventDefault()
      setDropped([...e.dataTransfer.files])
      openAdd()
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [openAdd])

  return (
    <>
      <PageHeader
        title="Kho tư liệu"
        description="Nạp link, file, ghi âm; theo dõi chuyển chữ và dựng thẻ VCWIKI."
        actions={(
          <>
            <Link className="ui-btn" to="/discover" data-testid="kb-discover"><Icon name="search" size={16} />Tìm video theo chủ đề</Link>
            <Link className="ui-btn ui-btn-primary" to={addHref} data-testid="kb-add-open"><Icon name="plus" size={16} />Nạp nguồn</Link>
          </>
        )}
      />
      <Tabs kind="route" label="Khu Kho tư liệu" items={KB_TABS} testId="kb-tabs" />
      {dragging && !adding && (
        <div className="kb-drop-hint" role="status" data-testid="kb-drop-hint">
          <Icon name="upload" /> Thả file để nạp vào Kho tư liệu
        </div>
      )}
      <AddSourceDrawer open={adding} onClose={closeAdd} spaceId={params.get('space_id') || ''} dropped={dropped}
        onAdded={() => window.dispatchEvent(new Event(KB_CHANGED))} />
    </>
  )
}
