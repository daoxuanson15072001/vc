// Huy hiệu trạng thái (DESIGN V.5 CMP-14, AIX-07): luôn có chữ + data-status (máy đọc), màu chỉ bổ trợ.
// <StatusBadge kind="card" status={c.status} />   — kind là khoá trong statuses.js
import { statusInfo } from '../statuses'

export function StatusBadge({ kind, status, label, tone, testId }) {
  const s = statusInfo(kind, status)
  return <span className="ui-badge" data-tone={tone || s.tone} data-status={status} data-testid={testId}>{label || s.label}</span>
}
