// Tính thuần cho hàng chờ Chấm bài (TPL-A2, SCR-17): lọc phía trình duyệt (BE trả tối đa 300 bài) và cắt trang.
const DAY = 86400000

// path: tên lộ trình ('' = mọi); unit: id đơn vị người học; days: nộp trong N ngày gần đây (0 = mọi);
// due: '' | overdue (quá hạn bài giao) | soon (còn ≤ 3 ngày) | none (bài giao không hạn); status: '' | pending | finalized
export function filterRows(items, { path = '', unit = '', days = 0, due = '', status = '' } = {}, now = Date.now()) {
  return (items || []).filter((r) => {
    if (path && r.path_title !== path) return false
    if (unit && r.learner_unit_id !== unit) return false
    const dueAt = r.due_at ? new Date(r.due_at).getTime() : null
    if (due === 'none' && dueAt) return false
    if (due === 'overdue' && !(dueAt && dueAt < now)) return false
    if (due === 'soon' && !(dueAt && dueAt >= now && dueAt <= now + 3 * DAY)) return false
    if (days && !(new Date(r.submitted_at).getTime() >= now - days * DAY)) return false
    if (status === 'pending' && r.finalized_at) return false
    if (status === 'finalized' && !r.finalized_at) return false
    return true
  })
}

export function pathOptions(items) {
  return [...new Set((items || []).map((r) => r.path_title).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
}

// Đơn vị người học có trong danh sách: [{ value: id, label: tên }]
export function unitOptions(items) {
  const m = new Map()
  for (const r of items || []) if (r.learner_unit_id && !m.has(r.learner_unit_id)) m.set(r.learner_unit_id, r.learner_unit || r.learner_unit_id)
  return [...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'))
}

export function pageSlice(rows, page, size) {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(Math.max(1, page), pages)
  return { rows: rows.slice((p - 1) * size, p * size), page: p, pages }
}
