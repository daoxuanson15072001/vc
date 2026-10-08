// Mở nguồn Kho tư liệu tại chỗ (modal) từ link trong thẻ / chat, thay vì sang trang ngoài hoặc tab mới.
import { useEffect, useState } from 'react'
import { api } from '../api'
import { findUrls } from './markdown'
import { SourceModal } from '../pages/Knowledge'

// Bấm thường mới mở modal; Ctrl/⌘/Shift-click hoặc chuột giữa vẫn là link thường (tab mới)
export const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

// Link về một nguồn đã biết id (vd nguồn của thẻ)
export function SourceLink({ sourceId, docId, onOpen, children }) {
  if (!sourceId) return children
  return (
    <a className="link" href={`/kb?source=${sourceId}`} title="Xem nguồn trong Kho tư liệu"
      onClick={(e) => { if (plainClick(e)) { e.preventDefault(); onOpen({ id: sourceId, docId }) } }}>{children}</a>
  )
}

// Link http(s) trong `text` trùng tài liệu / nguồn đã nạp (mình xem được) -> bấm mở modal nguồn.
// Trả { onClick: gắn vào khung chứa các link, open: mở nguồn theo id, modal: phần tử cần render }
export function useSourcePeek(text) {
  const [known, setKnown] = useState({})   // url -> { source_id, document_id }
  const [peek, setPeek] = useState(null)   // { id, docId }
  const urls = findUrls(text)
  const key = urls.join(' ')

  useEffect(() => {
    if (!urls.length) { setKnown({}); return undefined }
    let live = true
    api.lookupDocuments(urls).then((m) => live && setKnown(m)).catch(() => {})   // tra lỗi: link vẫn mở tab mới như cũ
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const onClick = (e) => {
    if (!plainClick(e)) return
    const hit = known[e.target.closest('a[href]')?.getAttribute('href')]
    if (hit) { e.preventDefault(); setPeek({ id: hit.source_id, docId: hit.document_id }) }
  }
  const modal = peek && <SourceModal id={peek.id} docId={peek.docId} onClose={() => setPeek(null)} />
  return { onClick, open: setPeek, modal }
}
