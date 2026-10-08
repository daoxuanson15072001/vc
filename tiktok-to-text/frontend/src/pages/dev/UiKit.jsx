// Thư viện component (DESIGN V.9.1) — trang mẫu chỉ có khi chạy dev (vite dev, e2e): dựng mỗi component của
// CMP-01…08, 17, 22 bằng dữ liệu mẫu để xem bằng mắt và để e2e kiểm bàn phím (e2e/ui-components.spec.js).
// Không nằm trong routes.js / routes.json, bản build bỏ hẳn.
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Tabs } from '../../components/Tabs'
import { Segmented } from '../../components/Segmented'
import { FilterBar, FilterChip, SearchField, SelectField } from '../../components/FilterBar'
import { DataTable } from '../../components/DataTable'
import { ActionMenu, RowActions } from '../../components/ActionMenu'
import { Drawer, Modal, useUrlOverlay } from '../../components/Overlay'
import { Tree } from '../../components/Tree'
import { ICON_NAMES, Icon } from '../../components/icons'
import { toast } from '../../components/toast'
import { useUrlState } from '../../urlState'
import { usePageMeta } from '../../pageMeta'

const SOURCES = [
  { id: 'src-2031', title: 'Cách kiểm tra lọc gió động cơ Vios 2019', kind: 'TikTok', status: 'refined', label: 'Đã vào VCWIKI', tone: 'good' },
  { id: 'src-2030', title: 'Bảng giá phụ tùng Toyota tháng 9.pdf', kind: 'File PDF', status: 'transcribing', label: 'Đang chuyển chữ', tone: 'info' },
  { id: 'src-2029', title: 'Livestream garage Thủ Đức 28/09', kind: 'Ghi âm', status: 'queued', label: 'Chờ tinh chế', tone: 'warn' },
  { id: 'src-2028', title: 'Hướng dẫn thay má phanh Innova', kind: 'YouTube', status: 'failed', label: 'Lỗi tải', tone: 'bad' },
]

const TREE = [
  { id: 'phu-tung', label: 'Phụ tùng ô tô', count: 412, children: [
    { id: 'phanh', label: 'Hệ thống phanh', count: 86, children: [
      { id: 'ma-phanh', label: 'Má phanh', count: 41 },
      { id: 'dia-phanh', label: 'Đĩa phanh', count: 23 },
    ] },
    { id: 'loc', label: 'Lọc gió, lọc dầu', count: 57, children: [{ id: 'loc-gio', label: 'Lọc gió', count: 30 }] },
  ] },
  { id: 'dich-vu', label: 'Dịch vụ garage', count: 203, children: [{ id: 'nhan-xe', label: 'Nhận xe', count: 12 }] },
  { id: 'marketing', label: 'Marketing', count: 9 },
]

const FILTERS = { q: { default: '' }, status: { default: '', values: ['', 'refined', 'transcribing', 'queued', 'failed'] }, tiktok: { type: 'bool' },
  node: { default: '' }, view: { default: 'grid', values: ['grid', 'path', 'table'] } }

export default function UiKit() {
  usePageMeta({ title: 'Thư viện component', description: 'Trang mẫu component, chỉ có khi chạy dev' })
  const [st, set] = useUrlState(FILTERS)
  const [selected, setSelected] = useState(new Set())
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [log, setLog] = useState([])
  const item = useUrlOverlay('item')
  const { search } = useLocation()
  // Link mở nguồn giữ nguyên bộ lọc đang bật
  const withItem = (id) => { const p = new URLSearchParams(search); p.set('item', id); return `?${p}` }
  const say = (t) => { setLog((l) => [t, ...l].slice(0, 5)); toast(t) }

  const rows = useMemo(() => SOURCES.filter((s) => (!st.q || s.title.toLowerCase().includes(st.q.toLowerCase()))
    && (!st.status || s.status === st.status) && (!st.tiktok || s.kind === 'TikTok')), [st.q, st.status, st.tiktok])
  const open = SOURCES.find((s) => s.id === item.value)

  return (
    <div className="page" data-testid="uikit">
      <PageHeader
        title="Thư viện component"
        description="Trang mẫu chỉ có khi chạy dev: CMP-01…08, 17, 22 dựng bằng dữ liệu mẫu."
        actions={(
          <>
            <ActionMenu name="Thư viện component" testId="uikit-page-more" items={[
              { label: 'Sao chép liên kết', icon: 'copy', onSelect: () => say('Đã sao chép liên kết') },
              { label: 'Tải xuống', icon: 'download', onSelect: () => say('Đã tải xuống') },
              { label: 'Làm mới', icon: 'refresh', onSelect: () => say('Đã làm mới') },
              { label: 'Xoá dữ liệu mẫu…', icon: 'trash', danger: true, confirm: { title: 'Xoá dữ liệu mẫu?', okLabel: 'Xoá dữ liệu mẫu' },
                onSelect: () => say('Đã xoá dữ liệu mẫu'), testId: 'uikit-danger' },
            ]} />
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => setCreating(true)} data-testid="uikit-open-modal">
              <Icon name="plus" size={16} />Tạo lĩnh vực
            </button>
          </>
        )}
      />

      <p role="status" className="muted" data-testid="uikit-log">{log[0] || 'Chưa có hành động nào'}</p>

      <Tabs kind="panel" label="Khu thư viện" testId="uikit-tabs" items={[
        { id: 'table', label: 'Bảng', count: rows.length, testId: 'uikit-tab-table', content: (
          <>
            <FilterBar label="Lọc nguồn" count={rows.length} unit="nguồn" active={!!(st.q || st.status || st.tiktok)} testId="uikit-filters"
              onClear={() => set({ q: '', status: '', tiktok: false })}>
              <SearchField label="Tìm nguồn" value={st.q} onChange={(q) => set({ q })} testId="uikit-search" />
              <SelectField label="Trạng thái" value={st.status} onChange={(status) => set({ status })} testId="uikit-status" options={[
                { value: '', label: 'Tất cả' }, { value: 'refined', label: 'Đã vào VCWIKI' }, { value: 'transcribing', label: 'Đang chuyển chữ' },
                { value: 'queued', label: 'Chờ tinh chế' }, { value: 'failed', label: 'Lỗi tải' }]} />
              <FilterChip pressed={st.tiktok} onClick={() => set({ tiktok: !st.tiktok })} testId="uikit-chip">TikTok</FilterChip>
            </FilterBar>
            <DataTable
              caption="Danh sách nguồn mẫu"
              testId="uikit-table"
              rows={rows}
              getStatus={(r) => r.status}
              current={item.value}
              columns={[
                { key: 'title', header: 'Tên nguồn', title: true, to: (r) => withItem(r.id) },
                { key: 'kind', header: 'Loại' },
                { key: 'label', header: 'Trạng thái', render: (r) => <span className="ui-badge" data-tone={r.tone} data-status={r.status}>{r.label}</span> },
              ]}
              actions={(r) => (
                <RowActions name={r.title} testId={`uikit-row-${r.id}`} actions={[
                  { label: 'Tinh chế', onSelect: () => say(`Tinh chế: ${r.title}`) },
                  { label: 'Gắn tag', icon: 'tag', onSelect: () => say(`Gắn tag: ${r.title}`) },
                  { label: 'Mở chi tiết', icon: 'eye', onSelect: () => item.open(r.id) },
                  { label: 'Xoá nguồn…', icon: 'trash', danger: true, onSelect: () => say(`Đã xoá nguồn: ${r.title}`) },
                ]} />
              )}
              selection={{ selected, onChange: setSelected }}
              bulk={<button type="button" className="ui-btn ui-btn-sm" onClick={() => say(`Gắn tag ${selected.size} nguồn`)}><Icon name="tag" size={16} />Gắn tag</button>}
              empty="Không có nguồn nào khớp bộ lọc."
            />
          </>
        ) },
        { id: 'tree', label: 'Cây', testId: 'uikit-tab-tree', content: (
          <div className="card uikit-tree-card">
            <Tree label="Lĩnh vực" nodes={TREE} selected={st.node || null} onSelect={(node) => set({ node }, { push: true })}
              defaultExpanded={['phu-tung']} testId="uikit-tree" />
            <p className="muted small" data-testid="uikit-tree-selected">Đang chọn: {st.node || 'chưa chọn'}</p>
          </div>
        ) },
        { id: 'misc', label: 'Khác', testId: 'uikit-tab-misc', content: (
          <div className="stack">
            <Segmented label="Chế độ xem" value={st.view} onChange={(view) => set({ view })} testId="uikit-view" options={[
              { value: 'grid', label: 'Lưới' }, { value: 'path', label: 'Lộ trình' }, { value: 'table', label: 'Bảng' }]} />
            <Tabs kind="route" label="Chế độ VCWIKI" items={[{ to: '/dev/ui', label: 'Thư viện', end: true }, { to: '/wiki', label: 'VCWIKI' }]} />
            <ul className="uikit-icons" aria-label="Biểu tượng">
              {ICON_NAMES.map((n) => <li key={n}><Icon name={n} /><code>{n}</code></li>)}
            </ul>
          </div>
        ) },
      ]} />

      <Modal open={creating} title="Tạo lĩnh vực" size="sm" onClose={() => setCreating(false)} testId="uikit-modal"
        footer={(
          <>
            <button type="button" className="ui-btn" onClick={() => setCreating(false)}>Huỷ</button>
            <button type="submit" form="uikit-create" className="ui-btn ui-btn-primary">Tạo lĩnh vực</button>
          </>
        )}>
        <form id="uikit-create" onSubmit={(e) => { e.preventDefault(); setCreating(false); say(`Đã tạo lĩnh vực ${name}`) }}>
          <label className="field">
            <span>Tên lĩnh vực <span className="muted">(bắt buộc)</span></span>
            <input value={name} onChange={(e) => setName(e.target.value)} required data-testid="uikit-modal-name" />
          </label>
        </form>
      </Modal>

      <Drawer open={!!open} title={open?.title} sub="Nguồn" onClose={item.close} testId="uikit-drawer"
        footer={(
          <>
            <button type="button" className="ui-btn" onClick={item.close}>Đóng</button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => { say(`Đã duyệt: ${open?.title}`); item.close() }}>Duyệt thẻ</button>
          </>
        )}>
        {open && (
          <>
            <span className="ui-badge" data-tone={open.tone} data-status={open.status}>{open.label}</span>
            <p>Loại: {open.kind}. Mã: <code>{open.id}</code></p>
            <ActionMenu name={open.title} testId="uikit-drawer-more" items={[
              { label: 'Gắn tag', icon: 'tag', onSelect: () => say(`Gắn tag: ${open.title}`) },
              { label: 'Xoá nguồn…', icon: 'trash', danger: true, onSelect: () => say(`Đã xoá nguồn: ${open.title}`) },
            ]} />
          </>
        )}
      </Drawer>
    </div>
  )
}
