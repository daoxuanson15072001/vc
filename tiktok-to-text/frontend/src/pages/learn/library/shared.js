// Hàm dùng chung của Thư viện bài học (SCR-16): chọn kho mặc định khi soạn, nhớ lựa chọn của câu hỏi vừa lưu.

// Kho cá nhân chưa chia sẻ: chỉ chủ kho xem được bài học trong đó (khớp only_owner_sees ở backend/app/learn/routes.py)
export const onlyOwner = (s) => !!s && s.type === 'personal' && s.visibility !== 'org' && (s.members?.length || 0) <= 1

// Kho gợi ý khi soạn mới: kho chia sẻ mình sửa được, ưu tiên kho có người xem (mở cho công ty / có thành viên)
export const preferredSpace = (spaces) => {
  const shared = (spaces || []).filter((s) => s.type !== 'personal' && ['owner', 'editor'].includes(s.my_role))
  return shared.find((s) => s.visibility === 'org' || s.members?.length > 1) || shared[0] || null
}

export const editableSpace = (spaces, id) => (spaces || []).find((s) => s.id === id && ['owner', 'editor'].includes(s.my_role))

// Kho đang áp cho đối tượng mới: kho đã chọn, không thì kho cá nhân của mình (mặc định phía máy chủ)
export const currentSpace = (spaces, id) => (spaces || []).find((s) => s.id === id)
  || (spaces || []).find((s) => s.type === 'personal' && s.my_role === 'owner')

// Nhớ Loại câu / Độ khó / Mức nhận thức / Kho của câu vừa lưu (trong trình duyệt) — soạn 12 câu không phải chỉnh lại 12 lần
const PREFS_KEY = 'learn.question.prefs'
export const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } catch { return {} } }
export const savePrefs = (p) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch { /* bộ nhớ trình duyệt tắt */ } }

// Rút gọn đề bài cho nhãn nút / thông báo
export const short = (text, n = 60) => (text && text.length > n ? `${text.slice(0, n)}…` : text || '')
