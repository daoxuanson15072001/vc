// Bảng dữ liệu (DESIGN V.5 CMP-05, AIX-03, AIX-07, AIX-08):
//   - caption (ẩn cho máy đọc nếu cần) + th scope="col";
//   - ô tiêu đề là <Link> tới URL đối tượng — KHÔNG onClick trên tr (bấm hàng chỉ chạy bằng chuột);
//   - tr mang data-id / data-status cho AI agent; cột hành động cuối dùng RowActions;
//   - chọn nhiều: checkbox có nhãn "Chọn <tên>", thanh hàng loạt "Đã chọn N" (role="status");
//   - trạng thái tải / rỗng / lỗi nằm trong bảng (một dòng chiếm mọi cột).
//
// Dùng:
//   <DataTable caption="Danh sách nguồn trong Kho tư liệu" rows={items} getId={(r) => r.id} getStatus={(r) => r.status}
//     columns={[{ key: 'title', header: 'Tên nguồn', title: true, to: (r) => `/kb?source=${r.id}` }, { key: 'kind', header: 'Loại' }]}
//     rowName={(r) => r.title} actions={(r) => <RowActions name={r.title} actions={…} />}
//     selection={{ selected, onChange: setSelected }} bulk={<button …>Gắn tag</button>} loading={loading} error={error} empty="Chưa có nguồn nào" />
import { Link } from 'react-router-dom'
import { ErrorBox, Loading, SrOnly } from './ui'

export function DataTable({
  caption, captionHidden = true, columns, rows, getId = (r) => r.id, getStatus, getKind, rowName = (r) => r.title ?? r.name,
  actions, actionsHeader = 'Hành động', selection, bulk, loading, error, onRetry, empty = 'Chưa có dữ liệu', current, testId,
  rowTestId, className = '',   // rowTestId: chuỗi hoặc (row) => chuỗi — data-testid trên mỗi tr (UI-3)
  // cột: { key, header, render?, title?, to?, className?, width?, sort?: 'ascending' | 'descending' | 'none' → aria-sort }
}) {
  const list = rows || []
  const selected = selection?.selected || new Set()
  const allOn = list.length > 0 && list.every((r) => selected.has(getId(r)))
  const someOn = list.some((r) => selected.has(getId(r)))
  const span = columns.length + (selection ? 1 : 0) + (actions ? 1 : 0)
  const toggle = (id) => {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    selection.onChange(n)
  }
  const toggleAll = () => {
    const n = new Set(selected)
    list.forEach((r) => (allOn ? n.delete(getId(r)) : n.add(getId(r))))
    selection.onChange(n)
  }

  return (
    <div className="ui-table-wrap" data-testid={testId}>
      {selection && selected.size > 0 && (
        <div className="ui-bulk" role="status" data-testid={testId ? `${testId}-bulk` : undefined}>
          <span className="ui-bulk-count">Đã chọn {selected.size}</span>
          {bulk}
          <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" onClick={() => selection.onChange(new Set())}>Bỏ chọn</button>
        </div>
      )}
      <table className={`ui-table ${className}`}>
        <caption>{captionHidden ? <SrOnly>{caption}</SrOnly> : caption}</caption>
        <thead>
          <tr>
            {selection && (
              <th scope="col" className="ui-col-check">
                <input type="checkbox" checked={allOn} ref={(el) => { if (el) el.indeterminate = someOn && !allOn }}
                  onChange={toggleAll} aria-label="Chọn tất cả trên trang" disabled={!list.length} />
              </th>
            )}
            {columns.map((c) => <th key={c.key} scope="col" className={c.className} aria-sort={c.sort} style={c.width ? { width: c.width } : undefined}>{c.header}</th>)}
            {actions && <th scope="col" className="ui-col-actions">{actionsHeader}</th>}
          </tr>
        </thead>
        <tbody>
          {loading && !list.length && (
            <tr><td colSpan={span}><Loading /></td></tr>
          )}
          {error && (
            <tr><td colSpan={span}><ErrorBox onRetry={onRetry}>{error}</ErrorBox></td></tr>
          )}
          {!loading && !error && !list.length && (
            <tr><td colSpan={span} className="ui-table-empty">{empty}</td></tr>
          )}
          {list.map((r) => {
            const id = getId(r)
            const name = rowName(r)
            return (
              <tr key={id} data-testid={typeof rowTestId === 'function' ? rowTestId(r) : rowTestId} data-id={id} data-status={getStatus?.(r)} data-kind={getKind?.(r)}
                aria-current={current !== undefined && current === id ? 'true' : undefined}
                className={selected.has(id) ? 'is-selected' : undefined}>
                {selection && (
                  <td className="ui-col-check">
                    <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} aria-label={`Chọn ${name}`} />
                  </td>
                )}
                {columns.map((c) => {
                  const val = c.render ? c.render(r) : r[c.key]
                  if (c.title) {
                    const to = c.to?.(r)
                    return (
                      <th key={c.key} scope="row" className={`ui-cell-title ${c.className || ''}`}>
                        {to ? <Link to={to} className="ui-title-link">{val}</Link> : val}
                      </th>
                    )
                  }
                  return <td key={c.key} className={c.className}>{val}</td>
                })}
                {actions && <td className="ui-col-actions">{actions(r)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
