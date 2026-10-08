// Nhập nhiều câu hỏi (tab Ngân hàng câu hỏi → "Nhập nhiều câu (JSON/CSV)"): đọc JSON / CSV thành body giống
// POST /api/learn/questions và kiểm tra sơ bộ theo luật BA 17.6. JS thuần để test bằng `npm test`.
const HEX24 = /^[0-9a-f]{24}$/i

export const CSV_COLUMNS = ['kind', 'stem', 'option1', 'option2', 'option3', 'option4', 'option5', 'option6', 'correct', 'explanation', 'difficulty', 'bloom', 'card_ids']
export const SAMPLE_JSON = [
  { kind: 'single', stem: 'VCparts có bao nhiêu kho hàng?', difficulty: 2, bloom: 'remember', explanation: 'Thẻ nêu: 3 kho Hà Nội – Hải Phòng – TP.HCM.',
    card_ids: ['<id thẻ 24 ký tự hex>'], options: [{ text: '3 kho', correct: true }, { text: '1 kho', correct: false }, { text: '5 kho', correct: false }, { text: '2 kho', correct: false }] },
  { kind: 'multi', stem: 'Những cam kết giao hàng của VCparts?', difficulty: 3, explanation: 'Thẻ nêu: giao trong ngày nội thành, 2–4 ngày đi tỉnh.',
    card_ids: ['<id thẻ>'], options: [{ text: 'Giao trong ngày nội thành', correct: true }, { text: 'Tỉnh 2–4 ngày', correct: true }, { text: 'Miễn phí mọi đơn', correct: false }] },
  { kind: 'essay', stem: 'Gara hỏi "có hàng luôn không?", bạn trả lời thế nào?', difficulty: 3, card_ids: ['<id thẻ>'],
    model_answer: 'Check mã tại kho gần nhất, có thì giao trong ngày; không thì báo thời gian chuyển kho.', rubric: [{ criterion: 'Nêu đúng cách check mã', max: 3, descriptor: 'Nêu đủ bước' }, { criterion: 'Nêu thời gian giao', max: 2, descriptor: 'Đúng SLA' }] },
]
export const SAMPLE_CSV = [CSV_COLUMNS.join(','),
  'single,"VCparts có bao nhiêu kho hàng?","3 kho","1 kho","5 kho","2 kho",,,1,"Thẻ nêu: 3 kho Hà Nội – Hải Phòng – TP.HCM.",2,remember,<id thẻ 24 ký tự hex>',
  'multi,"Những cam kết giao hàng của VCparts?","Giao trong ngày nội thành","Tỉnh 2–4 ngày","Miễn phí mọi đơn",,,,1;2,"Thẻ nêu: giao trong ngày nội thành, 2–4 ngày đi tỉnh.",3,,<id thẻ>',
].join('\n')


// CSV: dấu phẩy ngăn cột, ô có dấu phẩy / xuống dòng bọc trong "…", dấu " trong ô viết "" (như Excel xuất)
export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', inQ = false
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQ) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') inQ = false
      else cell += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// Chữ dán vào → danh sách body câu hỏi (JSON: mảng hoặc {questions: […]}; CSV: cột như CSV_COLUMNS, correct = "1" hay "1;3")
export function parseQuestions(text) {
  const t = text.trim()
  if (!t) return []
  if (t.startsWith('[') || t.startsWith('{')) {
    const data = JSON.parse(t)
    const arr = Array.isArray(data) ? data : data.questions || data.items
    if (!Array.isArray(arr)) throw new Error('JSON phải là một mảng câu hỏi (hoặc {"questions": [...]})')
    return arr
  }
  const rows = parseCsv(t)
  if (rows.length < 2) throw new Error('CSV cần dòng tiêu đề và ít nhất một dòng câu hỏi')
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (r, name) => { const i = head.indexOf(name); return i >= 0 ? (r[i] ?? '').trim() : '' }
  return rows.slice(1).map((r) => {
    const opts = [1, 2, 3, 4, 5, 6].map((n) => col(r, `option${n}`)).filter(Boolean)
    const correct = new Set(col(r, 'correct').split(/[;| ]+/).map((x) => Number(x)).filter((n) => n >= 1))
    const q = { kind: col(r, 'kind') || 'single', stem: col(r, 'stem'), explanation: col(r, 'explanation'),
      difficulty: Number(col(r, 'difficulty')) || 3, bloom: col(r, 'bloom') || null,
      card_ids: col(r, 'card_ids').split(/[;| ]+/).filter(Boolean),
      options: opts.map((text, i) => ({ text, correct: correct.has(i + 1) })) }
    if (q.kind === 'essay') { q.options = []; q.model_answer = col(r, 'model_answer'); q.rubric = [] }
    return q
  })
}

// Kiểm tra sơ bộ trước khi gửi (luật BA 17.6) — BE kiểm lại lần nữa
export function checkQuestion(q) {
  const errs = []
  if (!['single', 'multi', 'essay'].includes(q.kind)) errs.push(`kind phải là single / multi / essay (đang "${q.kind}")`)
  if (!q.stem?.trim()) errs.push('thiếu stem (đề bài)')
  if (!Array.isArray(q.card_ids) || !q.card_ids.length) errs.push('thiếu card_ids (ít nhất 1 id thẻ đã duyệt)')
  else if (q.card_ids.some((id) => !HEX24.test(String(id)))) errs.push('card_ids phải là id thẻ 24 ký tự hex')
  if (q.kind !== 'essay') {
    const opts = q.options || []
    if (opts.length < 2 || opts.length > 6) errs.push(`cần 2–6 phương án (đang ${opts.length})`)
    const n = opts.filter((o) => o.correct).length
    if (q.kind === 'single' && n !== 1) errs.push(`một đáp án: đúng 1 phương án đúng (đang ${n})`)
    if (q.kind === 'multi' && n < 1) errs.push('nhiều đáp án: ít nhất 1 phương án đúng')
  } else if (!(q.rubric || []).length) errs.push('tự luận cần rubric ≥ 1 tiêu chí')
  if (q.difficulty != null && !(q.difficulty >= 1 && q.difficulty <= 5)) errs.push('difficulty 1–5')
  return errs
}

