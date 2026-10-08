// Chế độ xem "Lộ trình" của /wiki khi lọc theo lĩnh vực: xếp thẻ thành một mạch A → B → C…
// Hàm thuần (không React) để unit test bằng `npm test` (node --test).

// Bậc từ thấp lên cao (backend/app/kb/classify.py LEVELS liệt kê từ cao xuống)
export const LEVEL_ORDER = ['nhap-mon', 'thuc-thi', 'van-hanh', 'thiet-ke', 'dieu-hanh']
// Mạch học theo loại thẻ; loại khác xếp sau
export const TYPE_ORDER = ['concept', 'framework', 'regulation', 'insight', 'case_study', 'lesson', 'hook']
export const NO_LEVEL = ''

const rank = (list, v) => {
  const i = list.indexOf(v)
  return i === -1 ? list.length : i
}

// Bước quy trình sớm nhất của thẻ (qt.<chuỗi>.<a-d>); không có -> null
const firstStep = (c) => [...(c.process_steps || [])].sort()[0] || null

// Thời điểm tạo: created_at, thiếu thì lấy từ ObjectId (4 byte đầu là giây)
const createdMs = (c) => {
  const t = c.created_at ? Date.parse(c.created_at) : NaN
  if (!Number.isNaN(t)) return t
  return /^[0-9a-f]{24}$/.test(c.id || '') ? parseInt(c.id.slice(0, 8), 16) * 1000 : 0
}

// Thứ tự trong một chặng: có bước quy trình (theo bước) -> loại theo mạch học -> cũ trước mới
export function compareInStage(a, b) {
  const sa = firstStep(a), sb = firstStep(b)
  if (sa !== sb) {
    if (sa === null) return 1
    if (sb === null) return -1
    return sa < sb ? -1 : 1
  }
  const ta = rank(TYPE_ORDER, a.type), tb = rank(TYPE_ORDER, b.type)
  if (ta !== tb) return ta - tb
  return createdMs(a) - createdMs(b)
}

const stageLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`)

// cards -> [{ key, letter, level, cards: [{ ...card, n }] }]; bậc trống bị bỏ, chữ cái liên tục,
// thẻ không có bậc (hoặc bậc lạ) vào chặng cuối "Chưa xếp bậc"; n đánh số liên tục 1..N qua các chặng
export function buildTimeline(cards) {
  const groups = new Map([...LEVEL_ORDER, NO_LEVEL].map((l) => [l, []]))
  for (const c of cards || []) groups.get(LEVEL_ORDER.includes(c.level) ? c.level : NO_LEVEL).push(c)
  const stages = []
  let n = 0
  for (const [level, list] of groups) {
    if (!list.length) continue
    stages.push({
      key: level || 'none',
      letter: stageLetter(stages.length),
      level,
      cards: [...list].sort(compareInStage).map((c) => ({ ...c, n: ++n })),
    })
  }
  return stages
}
