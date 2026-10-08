// Ngăn kéo chi tiết nguồn (SCR-03, CMP-08 Drawer): mở bằng ?source=<id> (&doc=<tài liệu>&t=<giây>), tab ?stab=
// Nội dung · Tài liệu · Thẻ · Dữ liệu thô · Nhật ký; chân 1 nút chính theo trạng thái + menu Thêm ▾ (Xoá nguồn ở cuối).
// Mở từ chỗ khác (thẻ VCWIKI, chat — SourceModal): cùng ngăn kéo, nổi trên popup đang mở, tab giữ trong state (không
// ghi ?stab= lên URL của trang khác).
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../hooks'
import { dateTime, num, time } from '../../format'
import { usePageMeta } from '../../pageMeta'
import { ErrorBox, Loading, SrOnly } from '../../components/ui'
import { Drawer } from '../../components/Overlay'
import { Tabs } from '../../components/Tabs'
import { ActionMenu } from '../../components/ActionMenu'
import { toast } from '../../components/toast'
import FilePreview, { canPreviewDoc } from '../../components/FilePreview'
import { CategoryChips } from '../../components/pickers'
import { createSync, VideoEmbed } from '../../components/videoEmbed'
import { canEmbed, parseVideoUrl, sourceVideo } from '../../videoEmbed'
import { ACTIVE, kindLabel, QueueInfo, SourceProgress, SourceStatusBadge, sourceName } from './shared'
import { DocNotes, RefinedTags, SourceNote, SourceNotes, SynthPanel } from './SourcePanels'
import SourceDocs from './SourceDocs'

const RAW_SHOWN = 40
const MEDIA_RE = /\.(mp3|m4a|wav|ogg|oga|opus|aac|flac|mp4|mov|m4v|webm)$/i
const VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i
const STABS = ['content', 'docs', 'cards', 'raw', 'log']

// docId: mở sẵn tab Tài liệu ở tài liệu đó (và cuộn tới); startAt (giây, tìm theo nội dung WK-35): bung video của tài
// liệu đó và phát từ giây này — video đầu ngăn kéo (nguồn một video), video từng tài liệu, hoặc file media tải lên.
export default function SourceDetail({ id, docId = null, startAt = null, cats, onClose, onChanged, modal = false }) {
  const [interval, setInterval_] = useState(3000)
  const { data: s, error, reload } = useFetch(() => api.source(id), [id], interval)
  const [params, setParams] = useSearchParams()
  const [localTab, setLocalTab] = useState(null)
  const [openDoc, setOpenDoc] = useState(docId)
  const [videoDoc, setVideoDoc] = useState(null)          // tài liệu đang bung video nhúng (một video tại một thời điểm)
  const [allRaw, setAllRaw] = useState(false)
  const [preview, setPreview] = useState(null)            // file thô đang xem trong app
  const syncs = useRef({})
  const syncOf = (key) => (syncs.current[key] ||= createSync())

  const redoing = !!s?.redo
  useEffect(() => setInterval_(s && !ACTIVE.includes(s.overall) && !redoing ? 0 : 3000), [s?.overall, redoing]) // eslint-disable-line react-hooks/exhaustive-deps

  const name = s ? sourceName(s) : 'Đang tải…'
  usePageMeta(s && !modal ? { object: name } : {})   // tên nguồn nối vào tiêu đề tab (V.2 nguyên tắc 3)
  const act = async (fn, ok, close = false) => {
    try {
      await fn()
      if (ok) toast(ok)
      onChanged()
      if (close) onClose()
      else { setInterval_(3000); reload() }
    } catch (e) {
      toast(e.message, { tone: 'error' })
    }
  }

  const album = s?.kind === 'image' ? (s.files || (s.file ? [s.file] : [])) : []
  const raw = s ? s.raw_files.filter((p) => !p.startsWith('text/')) : []
  // file gốc tải lên, hoặc file media tải về từ link (download.m4a…)
  const mediaFile = s && (s.file && MEDIA_RE.test(s.file.stored_name) ? s.file.stored_name : raw.find((p) => p.startsWith('download.') && MEDIA_RE.test(p)))
  const media = mediaFile ? api.rawUrl(s.id, mediaFile) : null
  const isVideo = VIDEO_RE.test(mediaFile || '')
  // nguồn một video YouTube / TikTok chưa có file media tải về -> nhúng ở đầu ngăn kéo thay cho player
  const head = s && !media && s.kind === 'video' ? sourceVideo(s.url, s.documents) : null
  const docVideo = (d) => (!head && !media && d.url ? parseVideoUrl(d.url, { key: d.key, meta: d.meta }) : null)

  // Tab: ?stab= (trang Kho tư liệu) hoặc state (mở từ thẻ / chat). Mặc định: có ?doc= (không phải video đầu) → Tài liệu
  const urlTab = modal ? localTab : params.get('stab')
  const defTab = docId && head?.doc?.id !== docId ? 'docs' : 'content'
  const tab = STABS.includes(urlTab) ? urlTab : defTab
  const setTab = (t) => {
    if (modal) return setLocalTab(t)
    const p = new URLSearchParams(params)
    if (t === defTab) p.delete('stab')
    else p.set('stab', t)
    return setParams(p, { replace: true })
  }

  // Tới đúng tài liệu / giây một lần khi nạp xong. Video đầu ngăn kéo: sync.seek nạp player và bắt đầu từ giây đó;
  // video từng tài liệu: seek giữ giây chờ sẵn, VideoEmbed autoStart lấy ra khi được bung.
  const jumped = useRef(false)
  useEffect(() => {
    if (!s || jumped.current || !docId) return
    jumped.current = true
    const d = s.documents.find((x) => x.id === docId)
    if (!d) return
    let target = `doc-${d.id}`
    if (startAt != null) {
      if (head?.doc?.id === d.id) {
        syncOf(d.id).seek(startAt)
        target = null   // video ở đầu ngăn kéo: giữ nguyên chỗ cuộn để thấy video
      } else if (canEmbed(docVideo(d))) {
        syncOf(d.id).seek(startAt)
        setVideoDoc(d.id)
      }
    }
    if (target) setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
  }, [s]) // eslint-disable-line react-hooks/exhaustive-deps
  const mediaAt = media && startAt != null && docId ? `${media}#t=${startAt}` : media   // media fragment: bắt đầu từ giây

  const content = s && (
    <div className="kb-stack">
      <div className="meta-line">
        <SourceStatusBadge s={s.overall} />
        <span>Nạp bởi {s.created_by_name} · {dateTime(s.created_at)}</span>
        {s.options?.build_wiki === false && <span className="ui-badge">Chỉ chuyển chữ</span>}
        {s.url && <a className="link" href={s.url} target="_blank" rel="noreferrer" aria-label={`Mở link gốc (tab mới): ${name}`}>Mở link gốc ↗</a>}
      </div>
      {s.file && canPreviewDoc(s.file.stored_name) && album.length <= 1 && (
        <button type="button" className="ui-btn ui-btn-sm kb-self-start" onClick={() => setPreview(s.file.stored_name)}>Xem file gốc</button>
      )}
      <SourceProgress s={s} />
      <QueueInfo s={s} />
      <CategoryChips cats={cats} value={s.categories} />
      <SourceNote s={s} onSaved={() => { onChanged(); reload() }} />
      <SourceNotes s={s} focusDoc={docId} onChanged={reload} />
      <ErrorBox>{s.error}</ErrorBox>
      {/* eslint-disable jsx-a11y/media-has-caption -- file người dùng tải lên không kèm phụ đề; chữ chuyển ra ở tab Tài liệu */}
      {media ? (isVideo
        ? <video className="media" controls preload="metadata" src={mediaAt} autoPlay={mediaAt !== media} />
        : <audio className="media" controls preload="metadata" src={mediaAt} autoPlay={mediaAt !== media} />)
      /* eslint-enable jsx-a11y/media-has-caption */
        : head && (head.doc ? (
          <div className="watch-pane" data-testid="kb-watch" data-id={head.doc.id}>
            <div className="watch-main">
              <DocNotes s={s} d={head.doc} sync={syncOf(head.doc.id)} onChanged={reload} watch />
            </div>
            <div className="watch-video">
              <VideoEmbed key={head.video.id} video={head.video} url={s.url} meta={head.doc.meta} title={s.title} sync={syncOf(head.doc.id)} />
            </div>
          </div>
        ) : <VideoEmbed key={head.video.id} video={head.video} url={s.url} title={s.title} />)}
      {album.length > 1 && (
        <div className="thumbs">
          {album.map((f, i) => (
            <a key={f.stored_name} href={api.rawUrl(s.id, f.stored_name)} target="_blank" rel="noreferrer" title={f.name}>
              <img src={api.rawUrl(s.id, f.stored_name)} alt={`Ảnh ${i + 1}: ${f.name}`} loading="lazy" />
              <span>{i + 1}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )

  const rawList = s && (
    <ul className="raw-list">
      {(allRaw ? raw : raw.slice(0, RAW_SHOWN)).map((p) => (
        <li key={p}>
          <a className="link" href={api.rawUrl(s.id, p)} target="_blank" rel="noreferrer">{p}</a>
          <button type="button" className="link small raw-view" onClick={() => setPreview(p)} aria-label={`Xem trong app: ${p}`}>Xem</button>
        </li>
      ))}
      {raw.length > RAW_SHOWN && !allRaw && <li><button type="button" className="link small" onClick={() => setAllRaw(true)}>+ {raw.length - RAW_SHOWN} file nữa</button></li>}
      {!raw.length && <li className="muted">Chưa có</li>}
    </ul>
  )

  const logs = s && (
    <div className="log" role="log" aria-label="Nhật ký xử lý nguồn">
      {(s.logs || []).map((l, i) => (
        <div key={i} className={l.msg.includes('✗') ? 'tone-bad' : l.msg.includes('⚠') ? 'tone-warn' : ''}><span className="log-time">{time(l.at)}</span> {l.msg}</div>
      ))}
    </div>
  )

  return (
    <Drawer
      open
      size="wide"
      title={<><SrOnly>Chi tiết nguồn: </SrOnly>{name}</>}
      sub={s ? [kindLabel(s.kind), s.platform, s.space_name].filter(Boolean).join(' · ') : 'Chi tiết nguồn'}
      closeLabel={`Đóng: ${name}`}
      onClose={onClose}
      fullKey="kb.sourceFull"
      className={`kb-source${modal ? ' kb-source-top' : ''}`}
      testId="kb-source-detail"
      footer={s?.can_edit ? <SourceFoot s={s} name={name} act={act} /> : null}
    >
      <ErrorBox onRetry={reload}>{error}</ErrorBox>
      {!s && !error && <Loading />}
      {s && (
        <div className="kb-source-body" data-id={id} data-status={s.overall} data-kind={s.kind}>
          <Tabs kind="panel" label={`Khu chi tiết nguồn: ${name}`} value={tab} onChange={setTab} keepMounted testId="kb-source-tabs" items={[
            { id: 'content', label: 'Nội dung', content, testId: 'kb-stab-content' },
            { id: 'docs', label: 'Tài liệu', count: num(s.documents.length + (s.failed_videos?.length || 0)), testId: 'kb-stab-docs', content: (
              <SourceDocs s={s} cats={cats} docId={docId} act={act} reload={reload} onRedoQueued={() => { setInterval_(3000); reload() }}
                v={{ videoDoc, setVideoDoc, openDoc, setOpenDoc, syncOf, head, docVideo }} />
            ) },
            { id: 'cards', label: 'Thẻ', count: num(s.card_count), testId: 'kb-stab-cards', content: (
              <div className="kb-stack"><SynthPanel s={s} /><RefinedTags s={s} /></div>
            ) },
            { id: 'raw', label: 'Dữ liệu thô', count: num(raw.length), testId: 'kb-stab-raw', content: rawList },
            { id: 'log', label: 'Nhật ký', testId: 'kb-stab-log', content: logs },
          ]} />
          {preview && <FilePreview sourceId={s.id} path={preview} onClose={() => setPreview(null)} />}
        </div>
      )}
    </Drawer>
  )
}

// Chân ngăn kéo: tối đa một nút chính theo trạng thái, còn lại vào menu Thêm ▾ (Xoá nguồn luôn cuối, có xác nhận)
function SourceFoot({ s, name, act }) {
  const running = ['queued', 'extracting'].includes(s.status)
  const waitingDocs = s.docs.pending > 0 || s.docs.card_update > 0
  const prioOn = s.priority > 0 && !s.docs.card_update
  const retryLabel = s.kind === 'video' ? 'Quét lại (lấy video mới)' : s.kind === 'google' ? 'Đồng bộ lại từ Google' : 'Xử lý lại từ dữ liệu thô'
  const prio = {
    label: 'Ưu tiên xử lý trước', testId: 'kb-source-priority',
    title: s.docs.card_update > 0
      ? `Đưa lên đầu hàng chờ — cập nhật thẻ ngay cho ${s.docs.card_update} tài liệu đã đổi nội dung, không đợi lượt hằng ngày`
      : 'Chạy ngay sau video hiện tại — kênh đang chuyển chữ tạm nhường rồi tự chạy tiếp',
    onSelect: () => act(() => api.prioritizeSource(s.id), `Đã ưu tiên xử lý: ${name}`),
  }
  const unprio = { label: 'Bỏ ưu tiên', onSelect: () => act(() => api.prioritizeSource(s.id, false), `Đã bỏ ưu tiên: ${name}`) }
  const stop = { label: 'Ngừng lấy chữ', testId: 'kb-source-stop', onSelect: () => act(() => api.cancelSource(s.id), `Đã ngừng lấy chữ: ${name}`) }
  const retry = (label = retryLabel) => ({ label, testId: 'kb-source-retry', onSelect: () => act(() => api.retrySource(s.id), `Đã xếp lại hàng chờ: ${name}`) })

  let primary = null
  const more = []
  if (s.status === 'cancelled') primary = retry('Chạy tiếp')
  else if (s.status === 'error') primary = retry()
  else if (running) {
    if (prioOn) more.push(unprio)
    else primary = prio
    more.push(stop)
  } else {
    if (waitingDocs) {
      if (prioOn) more.push(unprio)
      else primary = prio
    }
    if (!primary && s.kind === 'video') primary = retry()
    else more.push(retry())
  }
  more.push({
    label: 'Xoá nguồn', danger: true, testId: 'kb-source-delete',
    confirm: { title: 'Xoá nguồn, dữ liệu thô và thẻ nháp?', body: 'Thẻ đã duyệt được giữ lại.', okLabel: 'Xoá nguồn' },
    onSelect: () => act(() => api.deleteSource(s.id), `Đã xoá nguồn: ${name}`, true),
  })
  return (
    <>
      <ActionMenu name={name} items={more} testId="kb-source-more" size="md" align="end" />
      {primary && (
        <button type="button" className="ui-btn ui-btn-primary" title={primary.title} onClick={primary.onSelect} data-testid={primary.testId}>
          {primary.label}
        </button>
      )}
    </>
  )
}
