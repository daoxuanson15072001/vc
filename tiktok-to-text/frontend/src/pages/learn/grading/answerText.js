// Chữ hiện của câu trả lời một câu hỏi (dùng ở kết quả và ở khung chấm)
export function answerText(p, given) {
  if (p.kind === 'essay') return given || '(bỏ trống)'
  const keys = Array.isArray(given) ? given : given ? [given] : []
  return keys.length ? keys.map((k) => k.toUpperCase()).join(', ') : '(bỏ trống)'
}
