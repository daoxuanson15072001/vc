// So sánh hai phiên bản thẻ (GOV-01, GOV-07) — dùng chung cho tab Lịch sử của thẻ và Hộp duyệt (Review.jsx).
// Hiển thị kết quả revisions.diff_snapshots. labels: tên hai cột khi so trường dạng khối (máy đọc: role=group +
// aria-label); dòng thêm / bỏ dùng <ins>/<del> và chữ ẩn "Thêm:" / "Bỏ:" để không chỉ phân biệt bằng màu.
import { SrOnly } from '../../components/ui'
import { classValueLabel } from '../../components/CardClassFields'

const SIGN = { insert: '+', delete: '−', equal: ' ' }
const DIFF_SR = { insert: 'Thêm: ', delete: 'Bỏ: ', equal: '' }

export function DiffFields({ changes, labels = ['Bản cũ', 'Bản mới'] }) {
  // trục phân loại v2 hiện nhãn tiếng Việt thay mã thô (dieu-hanh -> Điều hành…)
  const show = (field, v) => (v == null || v === '' ? '(trống)' : classValueLabel(field, v) ?? (typeof v === 'string' ? v : JSON.stringify(v, null, 2)))
  return (
    <>
      {changes.map((c) => (
        <div key={c.field} className="diff-field">
          <div className="strong small">
            {c.label}
            {c.kind === 'lines' && <span className="muted"> · <span className="tone-good">+{c.added}</span> <span className="tone-bad">−{c.removed}</span></span>}
          </div>
          {c.kind === 'lines' ? (
            <div className="diff-lines">
              {c.lines.map((l, i) => {
                const text = (l.text && classValueLabel(c.field, l.text)) || l.text || ' '
                return (
                  <div key={i} className={`diff-line diff-${l.op}`}>
                    <span aria-hidden="true" className="diff-sign">{SIGN[l.op]}</span>
                    {DIFF_SR[l.op] && <SrOnly>{DIFF_SR[l.op]}</SrOnly>}
                    {l.op === 'insert' ? <ins>{text}</ins> : l.op === 'delete' ? <del>{text}</del> : <span>{text}</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="diff-cols">
              <pre className="doc-text diff-delete" role="group" aria-label={`${labels[0]}: ${c.label}`}>
                <del>{show(c.field, c.before)}</del>
              </pre>
              <pre className="doc-text diff-insert" role="group" aria-label={`${labels[1]}: ${c.label}`}>
                <ins>{show(c.field, c.after)}</ins>
              </pre>
            </div>
          )}
        </div>
      ))}
    </>
  )
}
