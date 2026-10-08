// Các bước của luồng nhiều bước (DESIGN V.5 CMP-16, TPL-C, AIX-06): danh sách có thứ tự (ol), bước đang làm
// aria-current="step" kèm chữ "đang làm", bước đã qua có chữ "đã xong" và (khi có onSelect) là nút bấm để quay lại
// bước đó. Bước chưa tới chỉ là chữ, không bấm được (đi tiếp bằng nút Tiếp ở chân trang). Trạng thái bước hiện tại
// do trang giữ (thường ở ?step= bằng useUrlState) — component không tự ghi URL.
//
// Dùng:
//   <Stepper label="Các bước thiết kế lộ trình" current="2" onSelect={(id) => set({ step: id }, { push: true })}
//     steps={[{ id: '1', label: 'Mục tiêu và người học' }, { id: '2', label: 'Bản nháp AI' }, …]} />
// steps[i].disabled: khoá bước đã qua (không quay lại được).
import { Icon } from './icons'

export function Stepper({ label, steps, current, onSelect, testId }) {
  const cur = Math.max(0, steps.findIndex((s) => s.id === current))
  return (
    <ol className="ui-steps" aria-label={label} data-testid={testId}>
      {steps.map((s, i) => {
        const state = i < cur ? 'done' : i === cur ? 'current' : 'todo'
        const body = (
          <>
            <span className="ui-step-n" aria-hidden="true">{state === 'done' ? <Icon name="check" size={14} /> : i + 1}</span>
            <span className="ui-step-text">
              <span className="ui-step-label">{s.label}</span>
              {state === 'done' && <span className="ui-step-note ui-step-done">đã xong</span>}
              {state === 'current' && <span className="ui-step-note">đang làm</span>}
            </span>
          </>
        )
        return (
          <li key={s.id} className={`ui-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined} data-step={s.id}>
            {state === 'done' && onSelect && !s.disabled
              ? <button type="button" className="ui-step-btn" onClick={() => onSelect(s.id)} data-testid={testId ? `${testId}-${s.id}` : undefined}>{body}</button>
              : <span className="ui-step-btn">{body}</span>}
          </li>
        )
      })}
    </ol>
  )
}
