// Ngăn kéo «Nạp nguồn» (SCR-03, CMP-08): mở bằng ?add=1 (nhận thêm &space_id= để chọn sẵn kho), từ nút chính ở đầu
// Kho tư liệu hoặc khi kéo thả file vào bất kỳ đâu trên trang. Khung nạp chung: dán link, kéo thả / chọn file, dán ảnh
// chụp màn hình (Ctrl+V), ô «Ghi chú của bạn» (WK-44). Kết quả nạp giữ trong ngăn kéo (Notice tại chỗ, CMP-10).
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { api } from '../../api'
import { useDebounced, useFetch } from '../../hooks'
import { bytes, num, SOURCE_KIND } from '../../format'
import { ErrorBox, Loading, SrOnly } from '../../components/ui'
import { Drawer } from '../../components/Overlay'
import { Notice } from '../../components/Notice'
import { Icon } from '../../components/icons'
import { CategoryPicker, SpaceSelect } from '../../components/pickers'

export const NOTE_MAX = 2000   // ghi chú của người nạp (WK-44), khớp wiki.NOTE_MAX
const NOTE_HINT = 'Điều bạn thích, vì sao lưu, cần chú ý gì — AI dùng làm gợi ý khi phân loại lĩnh vực và chọn ý nhấn mạnh, không chép vào thẻ.'
const LINK_RE = /^(https?:\/\/|@|www\.)/i
const GOOGLE_ACCESS = {
  public: { tone: 'good', label: 'Công khai' },
  private: { tone: 'warn', label: 'Chưa chia sẻ', block: 'Mở tài liệu → Chia sẻ → “Bất kỳ ai có đường liên kết” (Người xem), rồi dán lại' },
  not_found: { tone: 'bad', label: 'Không tìm thấy', block: 'Link sai hoặc tài liệu đã bị xoá' },
  unsupported: { tone: 'bad', label: 'Chưa hỗ trợ', block: 'Chỉ nạp được Docs, Sheets, Slides và từng file Drive (chưa nạp cả thư mục)' },
  unknown: { tone: 'muted', label: 'Chưa kiểm tra được quyền' },
}
const BUILD_OPTIONS = [
  ['', 'Tự động — video mạng xã hội chỉ chuyển chữ, loại khác dựng thẻ'],
  ['true', 'Dựng thẻ VCWIKI cho tất cả'],
  ['false', 'Chỉ chuyển thành chữ, không dựng thẻ'],
]

// "Ghi chú của bạn" (WK-44): ô nhập có nhãn, gợi ý và bộ đếm ký tự — dùng ở khung nạp và chi tiết nguồn
export function NoteField({ value, onChange, testId, disabled = false }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>Ghi chú của bạn <em>(không bắt buộc)</em></label>
      <textarea id={id} rows={2} value={value} maxLength={NOTE_MAX} disabled={disabled} data-testid={testId}
        aria-describedby={`${id}-hint ${id}-count`} onChange={(e) => onChange(e.target.value)}
        placeholder="VD: thích phần kịch bản mở đầu 3 giây, muốn áp cho kênh TikTok phụ tùng" />
      <small id={`${id}-hint`}>{NOTE_HINT}</small>
      <small id={`${id}-count`} className="note-count" aria-live="polite">{num(value.length)}/{num(NOTE_MAX)} ký tự</small>
    </div>
  )
}

export default function AddSourceDrawer({ open, onClose, spaceId, dropped, onAdded }) {
  const { data: status } = useFetch(() => (open ? api.kbStatus() : Promise.resolve(null)), [open])
  const { data: spaces } = useFetch(() => (open ? api.spaces() : Promise.resolve(null)), [open])
  const { data: cats } = useFetch(() => (open ? api.categories() : Promise.resolve(null)), [open])
  const ready = status && spaces && cats
  return (
    <Drawer open={open} title="Nạp nguồn" sub="Kho tư liệu" onClose={onClose} testId="kb-add-drawer" fullKey="kb.addFull">
      {ready ? <AddPanel status={status} spaces={spaces} cats={cats} spaceId={spaceId} dropped={dropped} onAdded={onAdded} />
        : <Loading />}
    </Drawer>
  )
}

function AddPanel({ status, spaces, cats, spaceId: askedSpace, dropped, onAdded }) {
  const personal = spaces.find((s) => s.type === 'personal' && s.my_role === 'owner')
  const asked = askedSpace && spaces.find((s) => s.id === askedSpace && s.my_role !== 'viewer')
  const [spaceId, setSpaceId] = useState(asked?.id || personal?.id || '')
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [links, setLinks] = useState('')
  const [files, setFiles] = useState([])
  const [merge, setMerge] = useState(true)
  const [buildWiki, setBuildWiki] = useState('')
  const [opt, setOpt] = useState({ limit: status.default_video_limit, language: 'auto', cookies_from_browser: '', audio_type: '' })
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [detected, setDetected] = useState({})
  const fileRef = useRef(null)
  const linksRef = useRef(null)

  const extKind = useMemo(() => {
    const m = {}
    status.adapters.forEach((a) => a.exts.forEach((e) => { m[e] = a.kind }))
    return m
  }, [status])
  const kindOfFile = (f) => extKind[`.${f.name.split('.').pop().toLowerCase()}`]
  const limitOf = (kind) => (status.upload_limits[kind] || status.max_upload_mb) * 1048576

  const lines = links.split('\n').map((u) => u.trim()).filter((u) => u && !u.startsWith('#'))
  const dLines = useDebounced(lines.join('\n'), 500)
  useEffect(() => {
    dLines.split('\n').filter((u) => LINK_RE.test(u) && !(u in detected)).slice(0, 30).forEach(async (u) => {
      setDetected((d) => ({ ...d, [u]: null }))   // đang kiểm tra
      const r = await api.detect(u).catch(() => ({ kind: null, failed: true }))
      setDetected((d) => ({ ...d, [u]: r }))
    })
  }, [dLines]) // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = (list) => {
    const incoming = [...list]
    const rejected = []
    const ok = incoming.filter((f) => {
      const kind = kindOfFile(f)
      if (!kind) rejected.push(`${f.name}: định dạng chưa hỗ trợ`)
      else if (f.size > limitOf(kind)) rejected.push(`${f.name}: quá ${status.upload_limits[kind]} MB`)
      return kind && f.size <= limitOf(kind)
    })
    setFiles((prev) => [...prev, ...ok.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))])
    setError(rejected.length ? rejected.join('; ') : null)
  }
  // file kéo thả vào trang (ngoài ngăn kéo) — KbHeader giữ lại rồi mở ngăn kéo; mỗi lượt thả là một mảng mới
  useEffect(() => { if (dropped?.length) addFiles(dropped) }, [dropped]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPaste = (e) => {
    const imgs = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return   // dán chữ / link: để ô nhập xử lý như thường
    e.preventDefault()
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
    addFiles(imgs.map((f, i) => new File([f], `anh-dan-${stamp}-${i + 1}.${f.type.split('/')[1] || 'png'}`, { type: f.type })))
  }

  const linkRows = lines.map((u) => ({ line: u, d: detected[u], isLink: LINK_RE.test(u) }))
  const blocked = linkRows.filter((r) => !r.isLink || GOOGLE_ACCESS[r.d?.access]?.block)
  const sendLinks = linkRows.filter((r) => r.isLink && !GOOGLE_ACCESS[r.d?.access]?.block).map((r) => r.line)
  const fileKinds = files.map(kindOfFile)
  const images = fileKinds.filter((k) => k === 'image').length
  const hasVideoLink = linkRows.some((r) => r.d?.kind === 'video')
  const hasAudio = fileKinds.includes('audio')
  const hasSpeech = hasVideoLink || hasAudio || fileKinds.includes('video_file')
  const firstVideo = linkRows.find((r) => r.d?.kind === 'video')?.line
  // gợi ý ngôn ngữ theo caption của link video / kênh đầu tiên (backend đọc bảng video hoặc 5 video mới nhất)
  const [langHint, setLangHint] = useState({ url: null, hint: null, loading: false })
  useEffect(() => {
    if (!firstVideo || firstVideo === langHint.url) return undefined
    let stale = false
    setLangHint({ url: firstVideo, hint: null, loading: true })
    api.detectLanguage(firstVideo).then((r) => r.hint, () => null)
      .then((hint) => !stale && setLangHint({ url: firstVideo, hint, loading: false }))
    return () => { stale = true }
  }, [firstVideo]) // eslint-disable-line react-hooks/exhaustive-deps

  const sourcesCount = sendLinks.length + files.length - (merge && images > 1 ? images - 1 : 0)

  const submit = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    const total = { created: [], duplicates: [], rejected: blocked.map((r) => (r.isLink ? `${r.line}: ${GOOGLE_ACCESS[r.d.access].label}` : `${r.line}: không phải link`)), requeued: [] }
    const add = (r) => Object.keys(total).forEach((k) => total[k].push(...(r?.[k] || [])))
    try {
      if (sendLinks.length) {
        add(await api.addLinks({
          space_id: spaceId, urls: sendLinks, categories, tags: tagList, note,
          options: {
            limit: Number(opt.limit) || 0, language: opt.language, cookies_from_browser: opt.cookies_from_browser || null,
            build_wiki: buildWiki === '' ? null : buildWiki === 'true',
          },
        }))
        setLinks('')
      }
      if (files.length) {
        const form = new FormData()
        files.forEach((f) => form.append('files', f))
        form.append('space_id', spaceId)
        form.append('categories', categories.join(','))
        form.append('tags', tagList.join(','))
        form.append('note', note)
        form.append('merge_images', merge ? 'true' : 'false')
        form.append('build_wiki', buildWiki)
        form.append('language', opt.language)
        form.append('audio_type', opt.audio_type)
        setProgress(0)
        add(await api.addFiles(form, setProgress))
        setFiles([])
      }
      setResult(total)
      setNote('')
      onAdded?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
      setProgress(null)
      // nút Nạp vừa bị khoá (hết mục để nạp) -> đưa tiêu điểm về ô dán link, Esc / Tab vẫn trong ngăn kéo
      requestAnimationFrame(() => linksRef.current?.focus())
    }
  }

  const kindText = (d, isLink) => (!isLink ? '—' : d === undefined || d === null ? 'Đang nhận diện…'
    : d.kind ? (d.platform || SOURCE_KIND[d.kind].label) : 'Không rõ loại')

  return (
    // vùng thả file / dán ảnh; có nút «Chọn file» và ô dán link thay thế (AIX-09)
    <section
      className={`add-panel kb-add${drag ? ' drag' : ''}`}
      aria-label="Khung nạp nguồn"
      onPaste={onPaste}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false) }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
    >
      <div className="intake">
        <textarea ref={linksRef} rows={4} value={links} onChange={(e) => setLinks(e.target.value)} aria-label="Dán link hoặc kéo file để nạp"
          aria-describedby="kb-intake-hint"
          placeholder={'Mỗi dòng một link — video / kênh (@tenkenh), bài viết, Google Docs / Sheets / Slides / Drive, link file…\n@garagevc\nhttps://www.youtube.com/@kenh\nhttps://docs.google.com/document/d/…'} />
        <div className="intake-hint" id="kb-intake-hint">
          <button type="button" className="ui-btn ui-btn-sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />Chọn file</button>
          <span>hoặc kéo thả file vào bất kỳ đâu trên trang · <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>V</kbd> để dán ảnh chụp màn hình</span>
          <SrOnly>Không chọn được file (AI agent)? Dán link công khai của file (Google Drive / Docs, link tải trực tiếp) vào ô này.</SrOnly>
          <span className="muted">PDF · ảnh · Word / PowerPoint / Excel · ghi âm (≤ {status.upload_limits.audio} MB) · video (≤ {status.upload_limits.video_file} MB)</span>
        </div>
        <input ref={fileRef} type="file" multiple hidden aria-label="Chọn file để nạp" data-testid="kb-intake-file" accept={status.file_exts.join(',')}
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {(linkRows.length > 0 || files.length > 0) && (
        <ul className="items" aria-label="Các mục sẽ nạp">
          {linkRows.map(({ line, d, isLink }) => {
            const acc = GOOGLE_ACCESS[d?.access]
            return (
              <li key={`l:${line}`} className="item" data-kind={d?.kind || undefined}>
                <span className="kind">{kindText(d, isLink)}</span>
                <span className="src ellipsis" title={line}>{line}</span>
                <span className="opt">
                  {!isLink && <span className="ui-badge" data-tone="bad">Không phải link</span>}
                  {acc && <span className="ui-badge" data-tone={acc.tone}>{acc.label}</span>}
                  {acc?.block && <span className="small muted">{acc.block}</span>}
                  {d?.kind === 'video' && (/[?&]list=/.test(line)
                    ? <span className="small muted">playlist — chuyển chữ lần lượt từng video, nguồn mang tên playlist</span>
                    : /@|channel|playlist|\/c\/|\/user\//.test(line) && !/\/video\/|watch\?v=|shorts\//.test(line) && <span className="small muted">kênh / playlist</span>)}
                </span>
              </li>
            )
          })}
          {files.map((f, i) => (
            <li key={`f:${f.name}:${f.size}`} className="item" data-kind={fileKinds[i]}>
              <span className="kind">{SOURCE_KIND[fileKinds[i]]?.label}</span>
              <span className="src ellipsis" title={f.name}>{f.name}</span>
              <span className="opt">
                <span className="small muted">{bytes(f.size)}</span>
                <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost ui-btn-icon" aria-label={`Bỏ ${f.name}`} title="Bỏ file"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {(images > 1 || hasVideoLink || hasSpeech) && (
        <div className="row row-wrap">
          {images > 1 && (
            <label className="field field-check">
              <span>Ảnh</span>
              <span className="inline"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} /> Gộp {images} ảnh thành 1 tài liệu (theo thứ tự trên)</span>
            </label>
          )}
          {hasVideoLink && (
            <>
              <label className="field field-sm">
                <span>Video tối đa / kênh</span>
                <input type="number" min="0" max="5000" value={opt.limit} onChange={(e) => setOpt({ ...opt, limit: e.target.value })} />
                <small>0 = lấy tất cả</small>
              </label>
              <label className="field field-sm">
                <span>Cookie trình duyệt</span>
                <select value={opt.cookies_from_browser} onChange={(e) => setOpt({ ...opt, cookies_from_browser: e.target.value })}>
                  <option value="">Không dùng</option>
                  {status.browsers.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <small>Khi TikTok / Facebook chặn</small>
              </label>
            </>
          )}
          {hasSpeech && (
            <label className="field field-sm">
              <span>Ngôn ngữ lời nói</span>
              <select value={opt.language} onChange={(e) => setOpt({ ...opt, language: e.target.value })}>
                {status.languages.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              {hasVideoLink && langHint.loading && <small>Đang đoán ngôn ngữ từ caption…</small>}
              {hasVideoLink && langHint.hint && (
                <small>
                  Gợi ý: <b>{langHint.hint.label}</b> — {langHint.hint.reason}
                  {opt.language !== langHint.hint.language && (
                    <> · <button type="button" className="link" onClick={() => setOpt({ ...opt, language: langHint.hint.language })}>Dùng</button></>
                  )}
                </small>
              )}
            </label>
          )}
          {hasAudio && (
            <label className="field field-sm">
              <span>Loại ghi âm</span>
              <select value={opt.audio_type} onChange={(e) => setOpt({ ...opt, audio_type: e.target.value })}>
                <option value="">Không rõ</option>
                {Object.entries(status.audio_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="row row-wrap">
        <label className="field">
          <span>Lưu vào kho</span>
          <SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly />
          {hasAudio && spaceId !== personal?.id && <small>Ghi âm cuộc họp có thể nhạy cảm — nên lưu kho cá nhân trước, xem thẻ rồi mới chuyển kho nhóm.</small>}
        </label>
        <div className="field grow2" role="group" aria-labelledby="kb-add-cats">
          <span id="kb-add-cats">Lĩnh vực <em>(gợi ý cho AI, không bắt buộc)</em></span>
          <CategoryPicker cats={cats} value={categories} onChange={setCategories} />
        </div>
        <label className="field">
          <span>Tag</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="cách nhau dấu phẩy" aria-label="Tag" />
        </label>
      </div>
      <NoteField value={note} onChange={setNote} testId="kb-add-note" />
      <label className="field">
        <span>Dựng thẻ VCWIKI</span>
        <select aria-label="Dựng thẻ VCWIKI" value={buildWiki} onChange={(e) => setBuildWiki(e.target.value)}>
          {BUILD_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      <ErrorBox>{error}</ErrorBox>
      {progress != null && (
        <div className="small muted">
          Đang tải file lên… {Math.round(progress * 100)}%
          <div className="progress" role="progressbar" aria-label="Tải file lên" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}><div className="progress-bar" style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}
      {result && (
        <Notice tone={result.rejected.length && !result.created.length ? 'warn' : 'good'} testId="kb-add-result">
          {result.created.length > 0 && <span>Đã nạp {result.created.length} nguồn. </span>}
          {result.requeued.length > 0 && <span>Quét lại {result.requeued.length} kênh / video đã có. </span>}
          {result.duplicates.length > 0 && <span>Đã có trong kho, bỏ qua: {result.duplicates.join(', ')}. </span>}
          {result.rejected.length > 0 && <span className="tone-bad">Không nạp: {result.rejected.join('; ')}</span>}
        </Notice>
      )}
      <div className="form-foot">
        <span className="muted small intake-count">
          {sourcesCount} nguồn{blocked.length > 0 && ` · ${blocked.length} dòng không nạp được`}
        </span>
        <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !sourcesCount || !spaceId} onClick={submit} data-testid="kb-intake-submit">
          {busy ? 'Đang nạp…' : 'Nạp vào kho'}
        </button>
      </div>
    </section>
  )
}
