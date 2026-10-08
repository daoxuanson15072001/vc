// Nhập nhiều câu hỏi (SCR-16, LRN-02, AIX-09): Modal mở theo ?import=1 — ô dán JSON / CSV (đường chính cho AI agent)
// + nút chọn file. Định dạng giống body POST /api/learn/questions. Nhập xong hết thì đóng + toast; có câu lỗi thì giữ
// Modal, liệt kê lỗi trong Notice [q-import-result] để sửa rồi nhập lại.
import { useEffect, useId, useRef, useState } from 'react'
import { api } from '../../../api'
import { useFetch } from '../../../hooks'
import { ErrorBox, TextArea } from '../../../components/ui'
import { Modal } from '../../../components/Overlay'
import { Notice } from '../../../components/Notice'
import { SpaceSelect } from '../../../components/pickers'
import { toast } from '../../../components/toast'
import { checkQuestion, CSV_COLUMNS, parseQuestions, SAMPLE_CSV, SAMPLE_JSON } from '../../../questionImport'
import { QUESTION_KIND } from '../common'
import { editableSpace, loadPrefs, onlyOwner, preferredSpace, short } from './shared'

const download = (name, content, type) => {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ImportQuestions({ onClose, onDone }) {
  const { data: spaces } = useFetch(() => api.spaces(), [])
  const [text, setText] = useState('')
  const [rows, setRows] = useState(null)      // [{q, errors}] sau khi Xem trước
  const [approve, setApprove] = useState(true)
  const [spaceId, setSpaceId] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)
  const [fails, setFails] = useState([])      // câu máy chủ từ chối ở lần nhập vừa rồi — giữ trên màn để sửa
  const fileRef = useRef(null)
  const uid = useId()
  useEffect(() => {
    if (spaceId || !spaces) return
    const s = editableSpace(spaces, loadPrefs().space_id) || preferredSpace(spaces)
    if (s) setSpaceId(s.id)
  }, [spaces, spaceId])

  const preview = () => {
    setErr(null)
    setFails([])
    try {
      const qs = parseQuestions(text)
      if (!qs.length) throw new Error('Không đọc được câu nào')
      setRows(qs.map((q) => ({ q, errors: checkQuestion(q) })))
    } catch (e) { setErr(`Không đọc được dữ liệu: ${e.message}`); setRows(null) }
  }
  const submit = async () => {
    const good = rows.filter((r) => !r.errors.length)
    setErr(null)
    const done = []
    const bad = []
    for (let i = 0; i < good.length; i++) {
      setBusy(`${i + 1}/${good.length}`)
      const { q } = good[i]
      try {
        let saved = await api.createQuestion({ ...q, space_id: spaceId || null })
        if (approve) saved = await api.patchQuestion(saved.id, { status: 'approved' })
        done.push(saved)
      } catch (e) { bad.push({ stem: q.stem, error: e.message }) }
    }
    setBusy(null)
    const summary = `Đã nhập ${done.length} câu${approve ? ' (đã duyệt)' : ' (nháp)'}`
    if (done.length) onDone()
    if (!bad.length) {
      toast(summary)
      onClose()
      return
    }
    toast(`${summary}; ${bad.length} câu lỗi — xem danh sách trong hộp nhập`, { tone: 'error' })
    setFails(bad)
    setRows(null)
  }
  const readFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then((t) => { setText(t); setRows(null); setFails([]) })
    e.target.value = ''
  }
  const okCount = rows ? rows.filter((r) => !r.errors.length).length : 0
  const space = (spaces || []).find((s) => s.id === spaceId)

  return (
    <Modal open title="Nhập nhiều câu hỏi (JSON / CSV)" size="wide" onClose={onClose} testId="q-import-form"
      initialFocus='[data-testid="q-import-text"]'
      footer={(
        <>
          <button type="button" className="ui-btn ui-btn-ghost" data-testid="q-import-cancel" onClick={onClose}>Đóng</button>
          <button type="button" className="ui-btn" data-testid="q-import-preview" onClick={preview} disabled={!text.trim() || !!busy}>Xem trước</button>
          <button type="button" className="ui-btn ui-btn-primary" data-testid="q-import-submit" disabled={!rows || !okCount || !!busy} onClick={submit}>
            {busy ? `Đang nhập ${busy}…` : `Nhập ${okCount} câu`}
          </button>
        </>
      )}>
      <p className="muted small">
        Định dạng <b>giống body API</b> <code>POST /api/learn/questions</code>: JSON là mảng câu hỏi (kind, stem, options[text, correct], explanation, difficulty, bloom, card_ids; tự luận thêm rubric, model_answer).
        CSV: cột <code>{CSV_COLUMNS.join(', ')}</code> — <code>correct</code> là số thứ tự phương án đúng (nhiều thì "1;3"), <code>card_ids</code> cách nhau bằng ";". Thẻ căn cứ là <b>id thẻ đã duyệt</b> (24 ký tự hex — lấy ở VCWIKI hoặc GET /api/wiki/cards?status=approved&amp;match=title&amp;q=…).
      </p>
      <div className="row row-wrap">
        <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" data-testid="q-import-sample-json" onClick={() => download('cau-hoi-mau.json', JSON.stringify(SAMPLE_JSON, null, 2), 'application/json')}>Tải mẫu JSON</button>
        <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" data-testid="q-import-sample-csv" onClick={() => download('cau-hoi-mau.csv', SAMPLE_CSV, 'text/csv')}>Tải mẫu CSV</button>
        <button type="button" className="ui-btn ui-btn-sm" onClick={() => fileRef.current?.click()}>Chọn file…</button>
        <input ref={fileRef} type="file" accept=".json,.csv,text/csv,application/json" hidden aria-label="Chọn file JSON hoặc CSV" data-testid="q-import-file" onChange={readFile} />
      </div>
      <label className="field" htmlFor={`${uid}-text`}><span>Dán JSON hoặc CSV</span>
        <TextArea id={`${uid}-text`} rows={8} value={text} onChange={(e) => { setText(e.target.value); setRows(null) }} aria-label="Dán JSON hoặc CSV" data-testid="q-import-text" placeholder='[{"kind": "single", "stem": "…", "options": [{"text": "…", "correct": true}, …], "card_ids": ["…"]}]' /></label>
      <div className="row row-wrap">
        <div className="field"><span>Lưu vào kho</span><SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly label="Lưu vào kho" testId="q-import-space" /></div>
        <label className="row lrn-choice"><input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} data-testid="q-import-approve" /> Duyệt luôn sau khi nhập</label>
      </div>
      {onlyOwner(space) && <Notice tone="warn" testId="q-import-private-hint">Kho cá nhân — chỉ bạn xem được. Chọn kho chia sẻ để câu vào được bài học / đề thi giao cho nhân viên.</Notice>}
      <ErrorBox testId="q-import-error">{err}</ErrorBox>
      {fails.length > 0 && (
        <Notice tone="bad" title={`${fails.length} câu không nhập được:`} testId="q-import-result">
          <ul>{fails.map((x, i) => <li key={i}>“{short(x.stem)}”: {x.error}</li>)}</ul>
        </Notice>
      )}
      {rows && (
        <div className="table-wrap" data-testid="q-import-rows">
          <p className="small" role="status"><b>{okCount}/{rows.length}</b> câu hợp lệ. Câu lỗi sẽ bị bỏ qua — sửa rồi Xem trước lại.</p>
          <table className="table">
            <caption className="sr-only">Xem trước câu hỏi sẽ nhập</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Loại</th><th scope="col">Đề bài</th><th scope="col">Phương án / rubric</th><th scope="col">Thẻ căn cứ</th><th scope="col">Kiểm tra</th></tr></thead>
            <tbody>
              {rows.map(({ q, errors }, i) => (
                <tr key={i} data-ok={errors.length ? 'no' : 'yes'}>
                  <td>{i + 1}</td>
                  <td>{QUESTION_KIND[q.kind] || q.kind}</td>
                  <td>{q.stem}</td>
                  <td className="small">{q.kind === 'essay' ? (q.rubric || []).map((r) => `${r.criterion} (${r.max})`).join('; ')
                    : (q.options || []).map((o) => `${o.correct ? '(đúng)' : '·'} ${o.text}`).join(' · ')}</td>
                  <td className="small">{(q.card_ids || []).join(', ')}</td>
                  <td className={errors.length ? 'tone-bad small' : 'tone-good small'}>{errors.length ? errors.join('; ') : 'Hợp lệ'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
