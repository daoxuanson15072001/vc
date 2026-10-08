// SCR-19 Kho & chia sẻ (TPL-F, DESIGN Phần V mục 7): PageHeader + nút chính *Tạo kho chia sẻ* (Modal);
// CardGrid hai khu h2 *Kho của tôi* / *Được chia sẻ với tôi*; *Quản lý* mở Drawer ?space=<id> (pages/spaces/SpaceDrawer)
// với tab Thông tin · Thành viên · Nguy hiểm; *Nạp nguồn* → /kb?add=1&space_id=<id>. Chia sẻ theo đơn vị: SCR-19.1.
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useFetch } from '../hooks'
import { num } from '../format'
import { ErrorBox, Loading } from '../components/ui'
import { PageHeader } from '../components/PageHeader'
import { CardGrid } from '../components/CardGrid'
import { StatusBadge } from '../components/StatusBadge'
import { Modal, useUrlOverlay } from '../components/Overlay'
import { Icon } from '../components/icons'
import { confirmDialog } from '../components/dialog'
import { toast } from '../components/toast'
import { useSession } from '../session'
import { SpaceDrawer } from './spaces/SpaceDrawer'
import { addSourceHref, canManage } from './spaces/shared'

export default function Spaces() {
  const { user } = useSession()
  const { data: spaces, error, reload } = useFetch(api.spaces, [])
  const [creating, setCreating] = useState(false)
  const drawer = useUrlOverlay('space')
  const { search } = useLocation()
  const [, setParams] = useSearchParams()
  // Đóng khung: bỏ cả ?space= lẫn ?tab= (tab của khung) — Quay lại của trình duyệt mở lại đúng khung, đúng tab
  const closeDrawer = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('space'); n.delete('tab'); return n })
  const hrefOf = (id) => { const p = new URLSearchParams(search); p.set('space', id); p.delete('tab'); return `?${p}` }

  const mine = (spaces || []).filter((s) => s.owner?.id === user.id)
  const shared = (spaces || []).filter((s) => s.owner?.id !== user.id)
  const open = (spaces || []).find((s) => s.id === drawer.value)

  const leave = async (s) => {
    if (!(await confirmDialog({ title: 'Rời khỏi kho này?', body: `Kho “${s.name}”. Muốn vào lại phải được chủ kho mời.`, okLabel: 'Rời kho', danger: true }))) return
    try {
      await api.removeMember(s.id, user.id)
      toast(`Đã rời kho “${s.name}”`)
      reload()
    } catch (e) {
      toast(e.message, { tone: 'bad' })
    }
  }

  const grid = (items, label) => (
    <CardGrid label={label} items={items} testId="spaces-space-card" current={drawer.value}
      renderCard={(s) => {
        const units = s.unit_grants?.length || 0
        return {
          title: <>{s.type === 'personal' && <span aria-hidden="true">★ </span>}{s.name}</>,
          to: canManage(s) ? hrefOf(s.id) : `/wiki?space_id=${s.id}`,
          dataStatus: s.visibility,
          dataKind: s.type,
          status: <StatusBadge kind="spaceRole" status={s.my_role} />,
          meta: s.type === 'personal' ? 'Kho cá nhân' : `Kho chia sẻ · chủ kho ${s.owner?.name || '—'}`,
          body: (
            <>
              {s.description && <p className="spaces-desc">{s.description}</p>}
              <p className="spaces-counts">
                {num(s.counts.sources)} nguồn · {num(s.counts.cards)} thẻ · {num(s.members.length)} người{units ? ` · ${num(units)} đơn vị` : ''}
              </p>
              <StatusBadge kind="spaceVisibility" status={s.visibility} />
            </>
          ),
          actions: (
            <>
              <Link className="ui-btn ui-btn-sm" to={`/wiki?space_id=${s.id}`} aria-label={`Xem thẻ: ${s.name}`}>Xem thẻ</Link>
              {['owner', 'editor'].includes(s.my_role) && (
                <Link className="ui-btn ui-btn-sm ui-btn-ghost" to={addSourceHref(s)} aria-label={`Nạp nguồn vào kho ${s.name}`}
                  data-testid="spaces-space-add">Nạp nguồn</Link>
              )}
              {canManage(s) && (
                <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" onClick={() => drawer.open(s.id)}
                  aria-label={`Quản lý kho ${s.name}`} data-testid="spaces-space-manage">Quản lý</button>
              )}
              {s.my_role !== 'owner' && s.members.some((m) => m.user.id === user.id) && (
                <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost ui-btn-danger" onClick={() => leave(s)}
                  aria-label={`Rời kho: ${s.name}`} data-testid="spaces-space-leave">Rời kho</button>
              )}
            </>
          ),
        }
      }} />
  )

  return (
    <div className="page spaces-page">
      <PageHeader
        title="Kho & chia sẻ"
        description="Kho cá nhân chỉ mình bạn thấy, trừ khi bạn chia sẻ. Kho chia sẻ để làm chung theo người hoặc theo đơn vị."
        actions={(
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setCreating(true)} data-testid="spaces-space-new">
            <Icon name="plus" size={16} />Tạo kho chia sẻ
          </button>
        )}
      />
      <ErrorBox onRetry={reload}>{error}</ErrorBox>
      {!spaces && !error && <Loading />}

      {spaces && (
        <>
          <section aria-labelledby="spaces-mine" className="spaces-section">
            <h2 id="spaces-mine" className="spaces-h2">Kho của tôi <span className="ui-tab-count">{mine.length}</span></h2>
            {grid(mine, 'Kho của tôi')}
          </section>
          <section aria-labelledby="spaces-shared" className="spaces-section">
            <h2 id="spaces-shared" className="spaces-h2">Được chia sẻ với tôi <span className="ui-tab-count">{shared.length}</span></h2>
            {shared.length === 0
              ? <p className="muted">Chưa có kho nào được chia sẻ với bạn hoặc đơn vị của bạn.</p>
              : grid(shared, 'Được chia sẻ với tôi')}
          </section>
        </>
      )}

      <CreateSpace open={creating} onClose={() => setCreating(false)}
        onCreated={(s) => { setCreating(false); toast(`Đã tạo kho “${s.name}”`); reload() }} />

      {drawer.value && spaces && (
        <SpaceDrawer space={open} onClose={closeDrawer} onChanged={reload} />
      )}
    </div>
  )
}

function CreateSpace({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', visibility: 'private' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const s = await api.createSpace(form)
      setForm({ name: '', description: '', visibility: 'private' })
      onCreated(s)
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} title="Tạo kho chia sẻ" onClose={onClose} testId="spaces-create-modal"
      footer={(
        <>
          <button type="button" className="ui-btn" onClick={onClose}>Huỷ</button>
          <button type="submit" form="spaces-create-form" className="ui-btn ui-btn-primary" disabled={busy}
            data-testid="spaces-space-create">Tạo kho</button>
        </>
      )}>
      <form id="spaces-create-form" className="spaces-form" onSubmit={submit}>
        <label className="field">
          <span>Tên kho <span className="muted">(bắt buộc)</span></span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="vd Kho Marketing" required maxLength={100} />
        </label>
        <label className="field">
          <span>Mô tả</span>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} />
        </label>
        <label className="spaces-check">
          <input type="checkbox" checked={form.visibility === 'org'} onChange={(e) => setForm({ ...form, visibility: e.target.checked ? 'org' : 'private' })} />
          Công khai trong công ty (mọi người được xem)
        </label>
        <ErrorBox>{err}</ErrorBox>
      </form>
    </Modal>
  )
}
