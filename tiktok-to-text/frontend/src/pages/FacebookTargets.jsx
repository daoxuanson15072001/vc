import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useFetch, usePageTitle } from '../hooks'
import { dateTime } from '../format'
import { Badge, Empty, ErrorBox, Loading } from '../components/ui'
import { confirmDialog } from '../components/dialog'
import { SpaceSelect } from '../components/pickers'
import { toast } from '../components/toast'

// Kênh Facebook (BA 5.14): nơi bài Viết nhanh / chiến dịch được đăng lên. Fanpage kết nối bằng token (đăng thẳng,
// hẹn giờ); nhóm và trang cá nhân chỉ khai báo tên + link (Facebook không cho app đăng thay — đăng hỗ trợ).

export default function FacebookTargets() {
  usePageTitle('Kênh Facebook')
  const { data, error, loading, reload } = useFetch(() => api.fbTargets(), [])
  const { data: status } = useFetch(api.fbStatus, [])
  const { data: spaces } = useFetch(api.spaces, [])
  const [actionError, setActionError] = useState(null)

  const run = async (fn, msg) => {
    setActionError(null)
    try {
      await fn()
      if (msg) toast(msg)
      reload()
    } catch (e) {
      setActionError(e.message)
    }
  }

  return (
    <>
      <Link className="crumb link" to="/studio/quick">‹ Viết nhanh</Link>
      <header className="page-head">
        <div>
          <h1>Kênh Facebook</h1>
          <p className="muted">
            Nơi đăng bài mạng xã hội đã duyệt. <b>Fanpage</b> đăng thẳng hoặc hẹn giờ từ VC content.
            <b> Nhóm</b> và <b>trang cá nhân</b>: Facebook không cho ứng dụng đăng thay (bỏ từ 2018 với trang cá nhân, 04/2024 với nhóm),
            nên hệ thống chép sẵn bài, mở Facebook để bạn dán, rồi bạn dán link bài đã đăng về để theo dõi.
          </p>
        </div>
      </header>
      <ErrorBox>{error || actionError}</ErrorBox>

      <div className="grid-2">
        <ConnectPage spaces={spaces} status={status} onSaved={reload} />
        <AddManual spaces={spaces} onSaved={reload} />
      </div>

      <h2>Kênh đã có</h2>
      {loading && !data && <Loading />}
      {data?.length === 0 && <Empty>Chưa có kênh nào.</Empty>}
      {data?.length > 0 && (
        <div className="grid-2">
          {data.map((t) => (
            <section key={t.id} className="card" data-id={t.id} data-kind={t.kind} data-status={t.status} data-testid="fb-target-card">
              <div className="row-between">
                <div>
                  <div className="strong">{t.name}</div>
                  <div className="muted small">{t.kind_label} · {t.space_name}{t.checked_at && ` · kiểm tra ${dateTime(t.checked_at)}`}</div>
                </div>
                {t.mode === 'api'
                  ? (t.status === 'ok' ? <Badge tone="good">Đăng tự động</Badge> : <Badge tone="bad">Lỗi token</Badge>)
                  : <Badge tone="info">Đăng hỗ trợ</Badge>}
              </div>
              {t.error && <p className="small tone-bad">{t.error}</p>}
              {t.kind === 'page' && t.token_kind === 'user_short' && (
                <p className="notice small">Token ngắn hạn — Fanpage sẽ mất kết nối sau khoảng 1–2 giờ. Xem cách lấy token dài hạn ở ô kết nối.</p>
              )}
              {t.url && <a className="link small" href={t.url} target="_blank" rel="noreferrer">{t.url} ↗</a>}
              {t.can_edit && (
                <div className="actions">
                  {t.kind === 'page' && <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.checkFbTarget(t.id))}>Kiểm tra kết nối</button>}
                  <button className="btn btn-ghost btn-sm btn-danger-text" aria-label={`Xoá kênh: ${t.name}`} onClick={async () => {
                    if (!(await confirmDialog({ title: `Xoá kênh ${t.name}?`, body: 'Bài đã đăng vẫn giữ lịch sử đăng.', okLabel: 'Xoá kênh', danger: true }))) return
                    run(() => api.deleteFbTarget(t.id), 'Đã xoá kênh')
                  }}>Xoá</button>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function useDefaultSpace(spaces) {
  const [spaceId, setSpaceId] = useState('')
  const personal = spaces?.find((s) => s.type === 'personal' && s.my_role === 'owner')
  useEffect(() => { if (personal && !spaceId) setSpaceId(personal.id) }, [personal, spaceId])
  return [spaceId, setSpaceId]
}

function ConnectPage({ spaces, status, onSaved }) {
  const [spaceId, setSpaceId] = useDefaultSpace(spaces)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const rows = await api.fbConnectPages({ space_id: spaceId || null, token: token.trim() })
      toast(`Đã kết nối ${rows.length} Fanpage: ${rows.map((r) => r.name).join(', ')}`)
      setToken('')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="card form" onSubmit={submit} data-testid="fb-connect-page">
      <h2>Kết nối Fanpage</h2>
      <label className="field"><span>Lưu vào kho <em>(người sửa được kho này sẽ đăng được lên Fanpage)</em></span>
        <SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly />
      </label>
      <label className="field"><span>Access token (của người quản trị Fanpage, hoặc Page token)</span>
        <textarea rows={3} value={token} onChange={(e) => setToken(e.target.value)} required minLength={20} placeholder="EAAG…" autoComplete="off" spellCheck={false} />
      </label>
      <details className="small">
        <summary>Lấy token thế nào?</summary>
        <ol>
          <li>Vào <a className="link" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a>, chọn app của công ty (app cần sản phẩm <i>Facebook Login for Business</i>; người dùng phải có vai trò trong app nếu app chưa qua duyệt).</li>
          <li>Bấm <i>Generate Access Token</i>, cấp quyền <code>pages_show_list</code>, <code>pages_manage_posts</code>, <code>pages_read_engagement</code> và chọn các Fanpage cần đăng.</li>
          <li>{status?.app_configured
            ? 'Máy chủ đã cấu hình FB_APP_ID / FB_APP_SECRET: dán token vừa lấy, hệ thống tự đổi sang dài hạn — token Fanpage không hết hạn.'
            : <>Máy chủ chưa cấu hình <code>FB_APP_ID</code> / <code>FB_APP_SECRET</code>: mở <a className="link" href="https://developers.facebook.com/tools/debug/accesstoken/" target="_blank" rel="noreferrer">Access Token Debugger</a>, dán token, bấm <i>Extend Access Token</i> rồi dán token dài hạn vào đây — token Fanpage lấy từ nó không hết hạn.</>}
          </li>
          <li>Một token người dùng kết nối cùng lúc mọi Fanpage người đó quản trị. Token được lưu trên máy chủ, không hiện lại.</li>
        </ol>
      </details>
      <ErrorBox>{error}</ErrorBox>
      <div className="actions"><button className="btn btn-primary" disabled={busy || !spaceId}>{busy ? 'Đang kết nối…' : 'Kết nối'}</button></div>
    </form>
  )
}

function AddManual({ spaces, onSaved }) {
  const [spaceId, setSpaceId] = useDefaultSpace(spaces)
  const [f, setF] = useState({ kind: 'group', name: '', url: '' })
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await api.createFbTarget({ ...f, space_id: spaceId || null })
      toast(`Đã thêm ${f.name}`)
      setF({ ...f, name: '', url: '' })
      onSaved()
    } catch (err) {
      setError(err.message)
    }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form className="card form" onSubmit={submit} data-testid="fb-add-manual">
      <h2>Thêm nhóm / trang cá nhân</h2>
      <label className="field"><span>Lưu vào kho</span><SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly /></label>
      <div className="row">
        <label className="field"><span>Loại</span>
          <select value={f.kind} onChange={set('kind')}>
            <option value="group">Nhóm Facebook</option>
            <option value="profile">Trang cá nhân</option>
          </select>
        </label>
        <label className="field grow2"><span>Tên *</span><input value={f.name} onChange={set('name')} required maxLength={200} placeholder={f.kind === 'group' ? 'VD: Hội chủ xe Hà Nội' : 'VD: Bùi Thọ Anh'} /></label>
      </div>
      <label className="field"><span>Link {f.kind === 'group' ? 'nhóm *' : 'trang cá nhân'}</span>
        <input value={f.url} onChange={set('url')} required={f.kind === 'group'} placeholder="https://www.facebook.com/groups/…" />
      </label>
      <p className="muted small">Bài đăng trang cá nhân phải đứng tên người đó và được họ duyệt (hồ sơ <Link className="link" to="/studio/authors">Người đứng tên</Link>).</p>
      <ErrorBox>{error}</ErrorBox>
      <div className="actions"><button className="btn btn-primary" disabled={!spaceId}>Thêm</button></div>
    </form>
  )
}
