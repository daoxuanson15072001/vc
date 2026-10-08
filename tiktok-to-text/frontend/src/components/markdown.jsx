// Markdown tối giản (heading, danh sách, bảng, trích dẫn, đậm, nghiêng, code, link) — dựng phần tử React, không dùng innerHTML.
// Đọc theo từng dòng nên heading / danh sách không cần dòng trống ngăn cách (AI hay viết liền).

// Link trần (https://…) cũng thành link; dấu câu cuối (. , ; : ! ?) không tính vào link
const BARE_URL = 'https?:\\/\\/[^\\s<>()\\[\\]"\'`]*[^\\s<>()\\[\\]"\'`.,;:!?]'
const INLINE = new RegExp(`(\\*\\*[^*]+\\*\\*|__[^_]+__|\`[^\`]+\`|\\[[^\\]]+\\]\\([^)\\s]+\\)|${BARE_URL}|\\*[^*\\s][^*]*\\*)`, 'g')
const IS_URL = new RegExp(`^${BARE_URL}$`)

// Mọi link http(s) trong văn bản markdown (dạng [chữ](url) lẫn link trần) — khớp đúng href mà inline() dựng ra
export const findUrls = (text) => [...new Set((text || '').match(new RegExp(BARE_URL, 'g')) || [])]

export function inline(text) {
  return (text || '').split(INLINE).map((part, i) => {
    if (!part) return null
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) return <b key={i}>{inline(part.slice(2, -2))}</b>
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) return <code key={i}>{part.slice(1, -1)}</code>
    const m = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (m) return /^(https?:|mailto:|\/)/.test(m[2]) ? <a key={i} className="link" href={m[2]} target="_blank" rel="noreferrer">{m[1]}</a> : m[1]
    if (IS_URL.test(part)) return <a key={i} className="link" href={part} target="_blank" rel="noreferrer">{part}</a>
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <i key={i}>{inline(part.slice(1, -1))}</i>
    return part
  })
}

const LIST = /^\s*([-*+•]|\d+[.)])\s+/
const isTableRow = (l) => l.trim().startsWith('|')

export function Markdown({ text, className = '' }) {
  const lines = (text || '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()
    if (!t) { i++; continue }

    const h = t.match(/^(#{1,6})\s+(.*?)\s*#*$/)
    if (h) {
      const Tag = `h${Math.min(6, h[1].length + 1)}`
      out.push(<Tag key={i}>{inline(h[2])}</Tag>)
      i++
      continue
    }

    if (/^([-*_])\1{2,}$/.test(t)) { out.push(<hr key={i} />); i++; continue }

    if (LIST.test(line)) {
      const start = i
      const ordered = /^\s*\d/.test(line)
      const items = []
      while (i < lines.length && lines[i].trim() && LIST.test(lines[i])) {
        items.push(lines[i].replace(LIST, ''))
        i++
        // dòng thụt vào ngay sau là phần nối của mục trước
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !LIST.test(lines[i])) { items[items.length - 1] += ' ' + lines[i].trim(); i++ }
      }
      const Tag = ordered ? 'ol' : 'ul'
      // danh sách số bị dòng trống cắt thành nhiều khối (AI hay viết vậy): giữ đúng số bắt đầu
      const first = ordered ? parseInt(lines[start], 10) || 1 : undefined
      out.push(<Tag key={start} start={first > 1 ? first : undefined}>{items.map((x, j) => <li key={j}>{inline(x)}</li>)}</Tag>)
      continue
    }

    if (t.startsWith('>')) {
      const start = i
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('>')) { rows.push(lines[i].trim().replace(/^>\s?/, '')); i++ }
      out.push(<blockquote key={start}>{rows.map((r, j) => <span key={j}>{j > 0 && <br />}{inline(r)}</span>)}</blockquote>)
      continue
    }

    if (isTableRow(line)) {
      const start = i
      const rows = []
      while (i < lines.length && isTableRow(lines[i])) { rows.push(lines[i]); i++ }
      const cells = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim()))
      out.push(
        <div key={start} className="table-wrap">
          <table className="table table-static">
            <thead><tr>{cells[0].map((x, j) => <th key={j} scope="col">{inline(x)}</th>)}</tr></thead>
            <tbody>{cells.slice(1).map((r, j) => <tr key={j}>{r.map((x, k) => <td key={k}>{inline(x)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      continue
    }

    // đoạn văn: gom các dòng liền nhau cho tới dòng trống hoặc khối khác
    const start = i
    const rows = []
    while (i < lines.length && lines[i].trim() && !/^#{1,6}\s/.test(lines[i].trim()) && !LIST.test(lines[i]) && !lines[i].trim().startsWith('>') && !isTableRow(lines[i])) {
      rows.push(lines[i].trim())
      i++
    }
    out.push(<p key={start}>{rows.map((r, j) => <span key={j}>{j > 0 && <br />}{inline(r)}</span>)}</p>)
  }
  return <div className={`md ${className}`.trim()}>{out}</div>
}
