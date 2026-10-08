// Popup thẻ VCWIKI (SCR-06): Drawer (CMP-08) mở theo ?card=<id> (do trang lo, Chat cũng dùng), có Toàn màn hình.
// Đầu = tiêu đề + huy hiệu + hàng tương tác nhỏ (★, Nghe, + Danh sách phát, Sao chép link); Tabs kind="panel"
// ?ctab= Nội dung · Thảo luận (n) · Lịch sử · Duyệt; chân = 1 nút chính theo trạng thái + Sửa + Thêm ▾ (mục nguy hiểm cuối).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, usePageTitle } from '../../hooks'
import { CARD_LEVEL, CARD_TYPE, dateTime } from '../../format'
import { statusInfo } from '../../statuses'
import { useUrlState } from '../../urlState'
import { Badge, ErrorBox, Loading, SrOnly } from '../../components/ui'
import { promptDialog } from '../../components/dialog'
import { toast } from '../../components/toast'
import { Drawer, Modal } from '../../components/Overlay'
import { Tabs } from '../../components/Tabs'
import { ActionMenu } from '../../components/ActionMenu'
import { StatusBadge } from '../../components/StatusBadge'
import { Icon } from '../../components/icons'
import { CategoryChips } from '../../components/pickers'
import { CardVote, Discussion } from '../../components/social'
import { CardListen } from '../../components/listen'
import { AddToPlaylist, CardContent } from '../../components/playlist'
import { ClassBadges, classBody } from '../../components/CardClassFields'
import { CardForm, EMPTY } from './CardForm'
import { CardHistory } from './History'
import { ReviewTab } from './ReviewTab'

const TAB_IDS = ['content', 'discuss', 'history', 'review']
const TAB_SCHEMA = { ctab: { default: 'content', values: TAB_IDS } }
const statusText = (status) => (status === 'approved' ? null : statusInfo('card', status).label)

// urlTabs: tab đang mở ghi lên ?ctab= (trang VCWIKI); tắt thì giữ trong state (Chat mở thẻ không đụng URL của Chat)
export function CardDrawer({ id, spaces, cats, onClose, onChanged, onCreated, urlTabs = false }) {
  const isNew = id === 'new'
  const personal = spaces.find((s) => s.type === 'personal' && s.my_role === 'owner')
  const { data: card, error, setData, reload: reloadCard } = useFetch(() => (isNew ? Promise.resolve(null) : api.card(id)), [id])
  usePageTitle(card?.title ? `${card.title} · VCWIKI` : null)
  const [edit, setEdit] = useState(isNew)
  const [draft, setDraft] = useState(EMPTY)
  const [spaceId, setSpaceId] = useState(personal?.id || '')
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyTo, setCopyTo] = useState('')
  const [actionError, setActionError] = useState(null)
  const [localTab, setLocalTab] = useState('content')
  const [urlSt, setUrlSt] = useUrlState(TAB_SCHEMA)
  const tab = urlTabs ? urlSt.ctab : localTab
  const setTab = (t) => (urlTabs ? setUrlSt({ ctab: t }, { push: true }) : setLocalTab(t))
  const [notice, setNotice] = useState(null)   // { text, change } — kết quả gửi duyệt / đề xuất (GOV)
  const [proposal, setProposal] = useState({ summary: '', kind: '' })   // tóm tắt + mức thay đổi khi đề xuất sửa
  // Đề xuất đang mở của thẻ (GOV-02): thẻ nháp chờ duyệt, đề xuất sửa thẻ đã duyệt
  const { data: openChanges, reload: reloadChanges } = useFetch(
    () => (isNew ? Promise.resolve({ items: [] }) : api.changes({ card_id: id, status: 'open,needs_rebase' })), [id])

  useEffect(() => { setEdit(isNew); setDraft(EMPTY); setNotice(null); setLocalTab('content') }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pending = (openChanges?.items || []).find((x) => x.kind === 'create')
  const proposals = (openChanges?.items || []).filter((x) => x.kind !== 'create')
  const editable = spaces.filter((s) => ['owner', 'editor'].includes(s.my_role) && s.id !== card?.space_id)

  const startEdit = () => {
    setDraft({ ...EMPTY, ...card })
    setProposal({ summary: '', kind: '' })
    setActionError(null)
    setEdit(true)
  }

  const run = async (fn, okText) => {
    setActionError(null)
    try {
      const res = await fn()
      onChanged()
      if (okText) toast(okText)
      return res ?? true   // xoá trả 204 (null) — vẫn là thành công
    } catch (e) {
      setActionError(e.message)
      return null
    }
  }

  // kết quả gửi duyệt / đề xuất hiện ở tab Duyệt
  const showNotice = (text, change) => { setNotice({ text, change }); reloadChanges(); setTab('review') }
  const gov = (c) => { if (c.notice) showNotice(c.notice, c.change); else reloadChanges() }

  const save = async () => {
    const body = {
      type: draft.type, title: draft.title, summary: draft.summary, body: draft.body,
      key_points: (typeof draft.key_points === 'string' ? draft.key_points.split('\n') : draft.key_points).map((x) => x.trim()).filter(Boolean),
      when_to_use: draft.when_to_use, example: draft.example, evidence: draft.evidence, categories: draft.categories,
      tags: (typeof draft.tags === 'string' ? draft.tags.split(',') : draft.tags).map((x) => x.trim()).filter(Boolean),
      ...classBody(draft),
    }
    if (isNew) {
      const c = await run(() => api.createCard({ ...body, space_id: spaceId }), 'Đã tạo thẻ')
      if (c) onCreated(c)
    } else if (card.status === 'approved') {
      // Thẻ đã duyệt không sửa trực tiếp — lưu = tạo đề xuất sửa (BA 16.7); tóm tắt + mức thay đổi nhập ngay trong form
      const c = await run(() => api.patchCard(id, {
        ...body, change_summary: proposal.summary.trim() || undefined, change_kind: proposal.kind || undefined,
      }))
      if (c) { setEdit(false); if (!c.change) setData(c); gov(c) }   // bộ nhớ AI sửa thẳng, không thành đề xuất
    } else {
      const c = await run(() => api.patchCard(id, body), 'Đã lưu')
      if (c) { setData(c); setEdit(false) }
    }
  }

  const setStatus = async (status) => {
    let reason
    if (status === 'rejected' && pending) {
      reason = await promptDialog({ title: 'Lý do từ chối thẻ?', label: 'Lý do', body: 'Bắt buộc — thẻ đang chờ duyệt.', okLabel: 'Từ chối thẻ', danger: true })
      if (!reason?.trim()) return
    }
    setNotice(null)
    const c = await run(() => api.patchCard(id, { status, reason }), statusText(status))
    if (c) { setData(c); gov(c) }
  }

  const submit = async () => {
    const ch = await run(() => api.createChange({ kind: 'create', card_id: id }))
    if (ch) showNotice('Đã gửi duyệt — cổng so sánh đang chạy nền', ch)
  }

  const obsolete = async () => {
    const reason = await promptDialog({
      title: 'Lý do thẻ lỗi thời?', label: 'Lý do', body: 'Bắt buộc — tạo đề xuất, chủ sở hữu lĩnh vực duyệt.', okLabel: 'Đề xuất lỗi thời',
    })
    if (!reason?.trim()) return
    const ch = await run(() => api.createChange({ kind: 'obsolete', card_id: id, summary: reason.trim() }))
    if (ch) showNotice('Đã tạo đề xuất lỗi thời — chờ duyệt', ch)
  }

  const remove = async () => { if ((await run(() => api.deleteCard(id))) !== null) onClose() }

  const copyCard = async () => {
    if ((await run(() => api.copyCard(id, copyTo), 'Đã sao chép (thẻ nháp)')) !== null) { setCopyOpen(false); setCopyTo('') }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/wiki?card=${id}`)
      toast('Đã sao chép link thẻ')
    } catch { toast('Trình duyệt chặn sao chép — copy từ thanh địa chỉ') }
  }

  // --- chân popup: 1 nút chính theo trạng thái + Sửa + Thêm ▾ ---
  const footerView = () => {
    if (edit) {
      return (
        <>
          <button type="button" className="ui-btn" onClick={() => (isNew ? onClose() : setEdit(false))}>Huỷ</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={!draft.title.trim() || (isNew && !spaceId)} onClick={save}
            data-testid="wiki-card-save">{isNew ? 'Tạo thẻ' : card?.status === 'approved' ? 'Gửi đề xuất' : 'Lưu'}</button>
        </>
      )
    }
    if (!card) return null
    const approved = card.status === 'approved'
    const items = [
      !approved && card.can_edit && card.status === 'draft' && !pending && { label: 'Duyệt ngay', icon: 'check', onSelect: () => setStatus('approved'), testId: 'wiki-card-approve-now' },
      card.can_edit && card.status === 'rejected' && { label: 'Về nháp', onSelect: () => setStatus('draft'), testId: 'wiki-card-to-draft' },
      !approved && card.can_edit && card.status !== 'rejected' && { label: 'Từ chối', onSelect: () => setStatus('rejected'), testId: 'wiki-card-reject' },
      editable.length > 0 && { label: 'Sao chép sang kho', icon: 'copy', onSelect: () => setCopyOpen(true), testId: 'wiki-card-copy' },
      approved && !card.obsolete && { label: 'Đề xuất lỗi thời', onSelect: obsolete, testId: 'wiki-card-obsolete' },
      !approved && card.can_edit && { label: 'Xoá', icon: 'trash', danger: true, onSelect: remove, testId: 'wiki-card-delete',
        confirm: { title: 'Xoá thẻ này?', body: card.title, okLabel: 'Xoá thẻ' } },
    ].filter(Boolean)
    return (
      <>
        <ActionMenu items={items} label="Thêm" align="start" size="" testId="wiki-card-more" />
        {!approved && card.can_edit && <button type="button" className="ui-btn" onClick={startEdit} data-testid="wiki-card-edit">Sửa</button>}
        {approved && !card.obsolete && <button type="button" className="ui-btn ui-btn-primary" onClick={startEdit} data-testid="wiki-card-propose">Đề xuất sửa</button>}
        {!approved && card.can_edit && card.status === 'draft' && !pending &&
          <button type="button" className="ui-btn ui-btn-primary" onClick={submit} data-testid="wiki-card-submit">Gửi duyệt</button>}
        {!approved && card.can_edit && card.status === 'draft' && pending?.can_decide &&
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setStatus('approved')} data-testid="wiki-card-approve">Duyệt</button>}
      </>
    )
  }

  const tabItems = card && [
    { id: 'content', label: 'Nội dung', testId: 'wiki-ctab-content', content: (
      <>
        <CategoryChips cats={cats} value={card.categories} />
        <ClassBadges card={card} full />
        <CardContent card={card} />
        <ErrorBox>{actionError}</ErrorBox>
      </>) },
    { id: 'discuss', label: 'Thảo luận', count: card.social?.comments ?? 0, testId: 'wiki-ctab-discuss', content: (
      <Discussion cardId={card.id} onChanged={() => { onChanged(); reloadCard() }} />) },
    { id: 'history', label: 'Lịch sử', testId: 'wiki-ctab-history', content: (
      <CardHistory card={card} cats={cats} onRestored={(c) => { setData(c); onChanged(); toast('Đã quay về bản cũ') }}
        onProposed={(ch, text) => showNotice(text, ch)} />) },
    { id: 'review', label: 'Duyệt', count: (openChanges?.items || []).length || undefined, testId: 'wiki-ctab-review', content: (
      <ReviewTab card={card} pending={pending} proposals={proposals} notice={notice} />) },
  ]

  return (
    <>
      <Drawer open title={<><SrOnly>Thẻ VCWIKI: </SrOnly>{isNew ? 'Tạo thẻ tri thức' : card?.title || 'Thẻ VCWIKI'}</>}
        sub={isNew ? 'Thẻ mới' : `${CARD_TYPE[card?.type] || ''} · ${card?.space_name || ''}`} onClose={onClose} fullKey="wiki.cardFull"
        testId="wiki-card-drawer" className="wiki-drawer" footer={footerView()}>
        <ErrorBox>{error}</ErrorBox>
        {edit ? (
          <CardForm isNew={isNew} card={card} draft={draft} setDraft={setDraft} spaces={spaces} spaceId={spaceId} setSpaceId={setSpaceId}
            cats={cats} proposal={proposal} setProposal={setProposal} error={actionError} />
        ) : card ? (
          <>
            <div className="meta-line">
              <StatusBadge kind="card" status={card.status} testId="card-status" />
              <Badge tone="info">{CARD_TYPE[card.type] || card.type}</Badge>
              {card.level && <Badge tone="muted">{CARD_LEVEL[card.level] || card.level}</Badge>}
              <span>{card.synth_run_id ? <Link className="link" to={`/wiki/synth/${card.synth_run_id}`}>AI tổng hợp</Link> : card.origin === 'ai' ? 'AI tạo' : card.origin === 'copy' ? 'Sao chép' : 'Viết tay'} · {card.created_by_name} · {dateTime(card.created_at)}</span>
              {card.reviewed_by_name && <span>Duyệt: {card.reviewed_by_name}</span>}
              {card.current_revision && <span>Bản {card.current_revision}</span>}
            </div>
            <div className="wiki-interact" role="group" aria-label="Tương tác với thẻ">
              <CardVote small card={card} onVoted={(c) => { setData(c); onChanged() }} />
              <CardListen card={card} />
              <AddToPlaylist cardId={card.id} />
              <button type="button" className="ui-btn ui-btn-sm" onClick={copyLink} data-testid="card-copy-link"><Icon name="link" size={16} />Sao chép link</button>
            </div>
            <Tabs kind="panel" label="Khu của thẻ" items={tabItems} value={tab} onChange={setTab} testId="wiki-ctabs" />
          </>
        ) : !error && <Loading />}
      </Drawer>
      <Modal open={copyOpen} title="Sao chép sang kho" size="sm" onClose={() => setCopyOpen(false)}
        footer={<>
          <button type="button" className="ui-btn" onClick={() => setCopyOpen(false)}>Huỷ</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={!copyTo} onClick={copyCard} data-testid="wiki-card-copy-ok">Sao chép</button>
        </>}>
        <p className="small muted">Bản sao là thẻ nháp trong kho nhận.</p>
        <select aria-label="Kho nhận bản sao" value={copyTo} onChange={(e) => setCopyTo(e.target.value)}>
          <option value="">— chọn kho —</option>
          {editable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Modal>
    </>
  )
}
