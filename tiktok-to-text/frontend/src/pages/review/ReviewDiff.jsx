// So sánh hai cột cho Hộp duyệt (DESIGN SCR-09): trái *Bản hiện tại*, phải *Bản đề xuất* (role="group" + aria-label);
// dòng bỏ là <del>, dòng thêm là <ins> kèm chữ ẩn "Bỏ: " / "Thêm: " — không chỉ phân biệt bằng màu.
// Dữ liệu: `diff` của GET /api/wiki/changes/{id} (revisions.diff_snapshots): kind "lines" (lines[{op,text}]) hoặc
// kind "value" (before / after).
import { classValueLabel } from '../../components/CardClassFields'
import { SrOnly } from '../../components/ui'

const show = (field, v) => {
  if (v == null || v === '') return '(trống)'
  const label = classValueLabel(field, v)
  if (label !== undefined) return label
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2)
}

function Lines({ change, side }) {
  const keep = side === 'before' ? 'delete' : 'insert'
  const lines = change.lines.filter((l) => l.op === 'equal' || l.op === keep)
  return (
    <div className="rv-diff-lines">
      {lines.map((l, i) => {
        const text = (l.text && classValueLabel(change.field, l.text)) || l.text || ' '
        if (l.op === 'insert') return <div key={i}><ins className="diff-insert"><SrOnly>Thêm: </SrOnly>{text}</ins></div>
        if (l.op === 'delete') return <div key={i}><del className="diff-delete"><SrOnly>Bỏ: </SrOnly>{text}</del></div>
        return <div key={i}>{text}</div>
      })}
    </div>
  )
}

function Side({ changes, side, label }) {
  return (
    <div role="group" aria-label={label} className={`rv-diff-side rv-diff-${side}`}>
      <h4 className="rv-diff-head">{label}</h4>
      {changes.map((c) => (
        <div key={c.field} className="rv-diff-field">
          <div className="rv-diff-label">{c.label}</div>
          {c.kind === 'lines' ? <Lines change={c} side={side} /> : (
            <div className="rv-diff-lines">
              {side === 'before'
                ? <del className="diff-delete"><SrOnly>Bỏ: </SrOnly>{show(c.field, c.before)}</del>
                : <ins className="diff-insert"><SrOnly>Thêm: </SrOnly>{show(c.field, c.after)}</ins>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function ReviewDiff({ changes, currentRev }) {
  const beforeLabel = currentRev ? `Bản hiện tại (bản ${currentRev})` : 'Bản hiện tại'
  return (
    <div className="rv-diff">
      <Side changes={changes} side="before" label={beforeLabel} />
      <Side changes={changes} side="after" label="Bản đề xuất" />
    </div>
  )
}
