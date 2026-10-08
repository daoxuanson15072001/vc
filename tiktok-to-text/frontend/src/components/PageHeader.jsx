// Đầu trang (DESIGN V.5 CMP-01, AIX-11): đúng một h1 mỗi trang, theo luật tên Phần V mục 2 nguyên tắc 3:
//   - Màn mục menu: h1 = tên mục menu = tiêu đề tab (vỏ app đặt tiêu đề tab theo routes.js).
//   - Trang đối tượng /…/:id: h1 = tên đối tượng; tên mục menu nằm ở breadcrumb (crumbs); tiêu đề tab
//     "<tên đối tượng> · <mục menu>" — PageHeader tự báo tên đối tượng cho usePageMeta khi có crumbs.
// actions: tối đa một nút chính (ui-btn-primary) + hai nút phụ + ActionMenu, nút chính đặt cuối (góc phải).
//
// Dùng:
//   <PageHeader title="Kho tư liệu" description="Nạp link, file, ghi âm…" actions={<button className="ui-btn ui-btn-primary">Nạp nguồn</button>} />
//   <PageHeader title={project.name} crumbs={[{ label: 'Nội dung' }, { label: 'Dự án marketing', to: '/studio/projects' }]}
//               meta={<span className="ui-badge" data-status="running">Đang chạy</span>} actions={…} />
import { Link } from 'react-router-dom'
import { usePageMeta } from '../pageMeta'

export function Breadcrumbs({ items, current }) {
  return (
    <nav className="ui-crumbs" aria-label="Vị trí">
      <ol>
        {items.map((c, i) => (
          <li key={i}>
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
            <span className="ui-crumb-sep" aria-hidden="true">›</span>
          </li>
        ))}
        {current && <li><span aria-current="page">{current}</span></li>}
      </ol>
    </nav>
  )
}

export function PageHeader({ title, description, crumbs, meta, actions, children, testId = 'page-title' }) {
  const isObject = !!crumbs?.length
  const plain = typeof title === 'string' ? title : undefined
  usePageMeta(isObject ? { object: plain } : {})
  return (
    <header className="ui-ph">
      <div className="ui-ph-text">
        {isObject && <Breadcrumbs items={crumbs} current={plain} />}
        <div className="ui-ph-title">
          <h1 data-testid={testId}>{title}</h1>
          {meta}
        </div>
        {description && <p className="ui-ph-desc">{description}</p>}
        {children}
      </div>
      {actions && <div className="ui-ph-actions">{actions}</div>}
    </header>
  )
}
