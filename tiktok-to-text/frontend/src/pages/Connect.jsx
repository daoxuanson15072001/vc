import { useState } from 'react'
import { api } from '../api'
import { useFetch } from '../hooks'
import { dateTime } from '../format'
import { ErrorBox, Loading } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { toast } from '../components/toast'

// Khi dev (Vite :5173) cổng MCP vẫn nằm ở BE :8000
const MCP_URL = `${window.location.protocol}//${window.location.hostname}:${window.location.port === '5173' ? '8000' : window.location.port || '80'}/mcp`

const TOOLS = [
  ['search_cards / get_card', 'Tìm và đọc thẻ VCWIKI'],
  ['create_card / update_card', 'Tạo thẻ mới (bản nháp), sửa, duyệt thẻ'],
  ['save_memory / recall_memory / forget_memory', 'AI tự ghi skill, ghi nhớ, bối cảnh vào VCWIKI và đọc lại ở phiên sau'],
  ['list_sources / get_source / get_document', 'Xem nguồn đã nạp và văn bản trích xuất'],
  ['add_links', 'Nạp link web / video vào Kho tư liệu'],
  ['search_videos / get_video / list_channels / stats', 'Tra cứu transcript TikTok và số liệu kênh'],
  ['start_scan / get_scan', 'Quét kênh TikTok mới và theo dõi tiến độ'],
  ['list_spaces / list_categories / whoami', 'Kho, cây lĩnh vực, tài khoản'],
]

// Điểm vào cho AI agent (đường dẫn tương đối, cùng tên miền với app) — chỉ liệt kê route BE đã có
const AGENT_LINKS = [
  ['/guide.md', 'Toàn bộ hướng dẫn dạng Markdown — đọc không cần JS, không cần đăng nhập'],
  ['/api/guide', 'Mục lục hướng dẫn (JSON), mỗi mục có đường dẫn .md riêng'],
  ['/mcp', 'Cổng MCP (HTTP) — cần token ở trên trong header Authorization: Bearer …'],
  ['/openapi.json', 'Mô tả API REST (OpenAPI) — gọi bằng phiên đăng nhập'],
]

export default function Connect() {
  const { data: tokens, error, reload } = useFetch(api.tokens, [])
  const [name, setName] = useState('Claude Desktop')
  const [created, setCreated] = useState(null)
  const [err, setErr] = useState(null)

  const create = async (e) => {
    e.preventDefault()
    setErr(null)
    try {
      setCreated(await api.createToken({ name }))
      reload()
    } catch (e2) {
      setErr(e2.message)
    }
  }

  const revoke = async (t) => {
    if (!(await confirmDialog({ title: `Thu hồi token "${t.name}"?`, body: 'AI đang dùng token này sẽ mất kết nối.', okLabel: 'Thu hồi token', danger: true }))) return
    try {
      await api.revokeToken(t.id)
      reload()
    } catch (e2) {
      setErr(e2.message)
    }
  }

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(created.token)
      toast('Đã sao chép token')
    } catch {
      toast('Không sao chép được — chọn chữ token rồi sao chép tay', { tone: 'error' })
    }
  }

  const token = created?.token || '<TOKEN>'
  const claudeCode = `claude mcp add --transport http vc-content ${MCP_URL} --header "Authorization: Bearer ${token}"`
  const desktop = JSON.stringify({
    mcpServers: {
      'vc-content': { command: 'npx', args: ['-y', 'mcp-remote', MCP_URL, '--header', `Authorization: Bearer ${token}`] },
    },
  }, null, 2)

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Kết nối AI (MCP)</h1>
          <p className="muted">Cho Claude hoặc AI khác hỗ trợ MCP đọc VCWIKI, Kho tư liệu, transcript video và thực hiện thao tác thay bạn — với đúng quyền của tài khoản bạn.</p>
        </div>
      </header>
      <ErrorBox>{error}</ErrorBox>

      <section className="card form" aria-label="Tạo token MCP">
        <div className="field"><span>Địa chỉ cổng MCP</span><code data-testid="connect-mcp-url">{MCP_URL}</code></div>
        <form className="row" onSubmit={create} aria-label="Tạo token">
          <label className="field grow2"><span>Tên token (để nhớ AI nào đang dùng)</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /></label>
          <div className="actions" style={{ alignSelf: 'flex-end' }}><button className="btn btn-primary" data-testid="connect-token-create">+ Tạo token</button></div>
        </form>
        <ErrorBox>{err}</ErrorBox>
        {created && (
          <div className="field" role="status">
            <span className="tone-good" id="connect-new-token-label">Token mới — sao chép ngay, sẽ không hiện lại:</span>
            <output aria-labelledby="connect-new-token-label" data-testid="connect-token-new">
              <code style={{ wordBreak: 'break-all', padding: 8, display: 'block' }}>{created.token}</code>
            </output>
            <div className="actions">
              <button type="button" className="btn" onClick={copyToken} data-testid="connect-token-copy">Sao chép</button>
            </div>
          </div>
        )}
      </section>

      <h3 id="connect-agent">Dành cho AI agent</h3>
      <section className="card" aria-labelledby="connect-agent" data-testid="connect-agent-links">
        <p className="muted small">AI không chạy được JavaScript (fetch, curl) đọc các đường dẫn sau trên cùng địa chỉ app:</p>
        <ul className="list">
          {AGENT_LINKS.map(([path, text]) => (
            <li key={path}><a className="link" href={path}><code>{path}</code></a> — <span className="small">{text}</span></li>
          ))}
        </ul>
      </section>

      <h3>Cách kết nối</h3>
      <div className="card form">
        <div className="field">
          <span>Claude Code — chạy trong Terminal</span>
          <pre className="code-block">{claudeCode}</pre>
        </div>
        <div className="field">
          <span>Claude Desktop — Settings → Developer → Edit Config, thêm vào claude_desktop_config.json rồi khởi động lại (cần Node.js)</span>
          <pre className="code-block">{desktop}</pre>
        </div>
        <p className="muted small">Cổng chỉ nhận kết nối từ chính máy này. Muốn AI trên máy khác / trên web dùng được, cần mở qua tên miền HTTPS và khai báo MCP_ALLOWED_HOSTS — xem HUONG_DAN.md.</p>
      </div>

      <h3>Token của tôi</h3>
      {!tokens && !error && <Loading />}
      {tokens?.length === 0 && <p className="muted">Chưa có token nào.</p>}
      {tokens?.length > 0 && (
        <div className="card table-wrap">
          <table className="table" data-testid="connect-tokens-table">
            <caption className="sr-only">Token MCP của tôi</caption>
            <thead><tr><th scope="col">Tên</th><th scope="col">Đuôi</th><th scope="col">Tạo lúc</th><th scope="col">Dùng lần cuối</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} data-testid="connect-token-row" data-id={t.id} data-status={t.last_used_at ? 'used' : 'unused'}>
                  <td>{t.name}</td>
                  <td><code>…{t.hint}</code></td>
                  <td>{dateTime(t.created_at)}</td>
                  <td>{t.last_used_at ? dateTime(t.last_used_at) : 'Chưa dùng'}</td>
                  <td className="num"><button className="btn btn-ghost" onClick={() => revoke(t)} aria-label={`Thu hồi token: ${t.name}`} data-testid="connect-token-revoke">Thu hồi</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>AI làm được gì</h3>
      <div className="card table-wrap">
        <table className="table">
          <caption className="sr-only">Công cụ MCP và việc AI làm được</caption>
          <thead className="sr-only"><tr><th scope="col">Công cụ MCP</th><th scope="col">Việc làm được</th></tr></thead>
          <tbody>{TOOLS.map(([k, v]) => <tr key={k}><td><code>{k}</code></td><td>{v}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}
