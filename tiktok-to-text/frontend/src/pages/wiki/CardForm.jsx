// Form tạo / sửa thẻ VCWIKI (SCR-06): 12 ô chia 3 fieldset — Nội dung · Phân loại · Nguồn và hiệu lực.
// Nút Lưu / Huỷ đặt ở chân popup (CardDrawer). Ô dài dùng --fs-base (lớp .wiki-form).
import { CARD_TYPE } from '../../format'
import { ErrorBox } from '../../components/ui'
import { CategoryPicker, SpaceSelect } from '../../components/pickers'
import { ClassEditor } from '../../components/CardClassFields'

export const AI_TYPES = ['skill', 'memory', 'context']   // bộ nhớ AI — không qua duyệt (đổi sang loại tri thức thì có)
export const EMPTY = {
  type: 'framework', title: '', summary: '', body: '', key_points: [], when_to_use: '', example: '', evidence: '',
  categories: [], tags: [], level: '', division: [], process_steps: [], effective_at: '', review_cycle_months: '',
}

export function CardForm({ isNew, card, draft, setDraft, spaces, spaceId, setSpaceId, cats, proposal, setProposal, error }) {
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value })
  const asProposal = !isNew && card?.status === 'approved' && !(AI_TYPES.includes(card.type) && AI_TYPES.includes(draft.type))
  return (
    <form className="wiki-form" onSubmit={(e) => e.preventDefault()} aria-label={isNew ? 'Tạo thẻ' : 'Sửa thẻ'}>
      <fieldset>
        <legend>Nội dung</legend>
        <label className="field"><span>Tiêu đề</span><input value={draft.title} onChange={set('title')} required /></label>
        <label className="field"><span>Tóm tắt</span><textarea rows={2} value={draft.summary} onChange={set('summary')} /></label>
        <label className="field"><span>Nội dung chi tiết <em>(markdown)</em></span><textarea rows={8} value={draft.body} onChange={set('body')} /></label>
        <label className="field">
          <span>Ý chính <em>(mỗi dòng một ý)</em></span>
          <textarea rows={3} value={Array.isArray(draft.key_points) ? draft.key_points.join('\n') : draft.key_points}
            onChange={(e) => setDraft({ ...draft, key_points: e.target.value })} />
        </label>
        <div className="row">
          <label className="field"><span>Khi nào dùng</span><textarea rows={2} value={draft.when_to_use} onChange={set('when_to_use')} /></label>
          <label className="field"><span>Ví dụ</span><textarea rows={2} value={draft.example} onChange={set('example')} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Phân loại</legend>
        {isNew && (
          <div className="field"><span>Kho</span><SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly label="Kho" /></div>
        )}
        <label className="field field-sm">
          <span>Loại thẻ</span>
          <select value={draft.type} onChange={set('type')}>
            {Object.entries(CARD_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="field" role="group" aria-labelledby="wiki-form-cats">
          <span id="wiki-form-cats">Lĩnh vực</span>
          <CategoryPicker cats={cats} value={draft.categories} onChange={(v) => setDraft({ ...draft, categories: v })} />
        </div>
        <ClassEditor draft={draft} setDraft={setDraft} />
        <label className="field">
          <span>Tag <em>(cách nhau dấu phẩy)</em></span>
          <input value={Array.isArray(draft.tags) ? draft.tags.join(', ') : draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Nguồn và hiệu lực</legend>
        <label className="field"><span>Trích dẫn căn cứ</span><textarea rows={2} value={draft.evidence} onChange={set('evidence')} /></label>
        {asProposal && (
          <fieldset className="proposal-box">
            <legend className="small strong">Đề xuất thay đổi — thẻ giữ nguyên tới khi được duyệt</legend>
            <label className="field"><span>Tóm tắt thay đổi <em>(ghi vào lịch sử phiên bản khi được duyệt)</em></span>
              <textarea rows={2} value={proposal.summary} onChange={(e) => setProposal({ ...proposal, summary: e.target.value })}
                placeholder="Vd: Cập nhật bước 3 theo quy định mới" />
            </label>
            <label className="field field-sm"><span>Mức thay đổi</span>
              <select value={proposal.kind} onChange={(e) => setProposal({ ...proposal, kind: e.target.value })}>
                <option value="">Để hệ thống đoán</option>
                <option value="minor">Nhỏ (minor) — chữ, tag, phân loại; không phải học lại</option>
                <option value="major">Lớn (major) — kết luận, số liệu, các bước; người đã học phải học lại</option>
              </select>
            </label>
          </fieldset>
        )}
      </fieldset>
      <ErrorBox>{error}</ErrorBox>
    </form>
  )
}
