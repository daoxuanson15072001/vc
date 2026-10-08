import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useDebounced, useFetch } from '../hooks'
import { CAMPAIGN_STATUS, CARD_STATUS, CARD_TYPE, CHANNEL, FLOW, PERSONAL_CHANNELS, compact, date, dateTime, duration, num, pct } from '../format'
import { Badge, Empty, ErrorBox, Loading, Pagination } from '../components/ui'
import { ProjectSelect, SpaceSelect } from '../components/pickers'

export const CampaignStatus = ({ s }) => {
  const x = CAMPAIGN_STATUS[s] || { label: s, tone: 'muted' }
  return <Badge tone={x.tone}>{x.label}</Badge>
}

export default function Studio({ creating = false }) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [interval, setInterval_] = useState(0)
  const { data, error, loading } = useFetch(() => api.campaigns({ q: dq, page, page_size: 30 }), [dq, page], interval)
  const { data: status } = useFetch(api.studioStatus, [])
  useEffect(() => {
    setInterval_(data?.items.some((c) => ['queued', 'generating'].includes(c.status)) ? 4000 : 0)
  }, [data])

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Chiến dịch</h1>
          <p className="muted">
            Một brief → chiến lược chung → kế hoạch và nội dung cho 3 luồng: <b>video ngắn</b> (tham chiếu <Link className="link" to="/kb/videos">Kho video</Link>),
            <b> bài website chuẩn SEO</b> và <b>bài mạng xã hội</b> — có căn cứ từ <Link className="link" to="/wiki">VCWIKI</Link>, AI tự chấm và sửa trước khi người duyệt.
          </p>
        </div>
        {!creating && <Link className="btn btn-primary" to="/studio/new" data-testid="studio-campaign-create">+ Chiến dịch mới</Link>}
      </header>

      {status?.ai.claude_paused && (
        <div className="notice">
          <b>{status.ai.cli?.first ? 'Đang chạy bằng Claude Code CLI (tài khoản Claude trên máy)'
            : `Đang chạy bằng AI local (${status.ai.local.model})`}:</b> {status.ai.claude_paused.reason}.
          {status.ai.cli?.first && ` CLI lỗi thì AI local (${status.ai.local.model}) làm thay.`}
          {status.ai.claude_paused.until && ` Thử lại Claude lúc ${new Date(status.ai.claude_paused.until * 1000).toLocaleTimeString('vi-VN')}.`}
          {' '}Việc cần đọc ảnh / PDF scan dùng OCR Tesseract.
        </div>
      )}
      {status && !status.ai.ready && (
        <div className="notice">
          <b>AI chưa sẵn sàng:</b> {status.ai.error}. Chiến dịch vẫn được lưu và sẽ tự chạy khi máy chủ có <code>ANTHROPIC_API_KEY</code>.
        </div>
      )}

      {creating ? <NewCampaign /> : (
        <>
          <section className="filters card" role="search" aria-label="Tìm chiến dịch">
            <input className="search" type="search" placeholder="Tìm theo tên chiến dịch…" aria-label="Tìm theo tên chiến dịch" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          </section>
          <ErrorBox>{error}</ErrorBox>
          {loading && !data && <Loading />}
          {data && data.items.length === 0 && (
            <Empty>Chưa có chiến dịch nào. Bấm <b>+ Chiến dịch mới</b>, hoặc lọc video ở <Link className="link" to="/kb/videos">Kho video</Link> rồi chọn “Lập chiến dịch”.</Empty>
          )}
          {data && data.items.length > 0 && (
            <div className="card table-wrap">
              <table className="table">
                <caption className="sr-only">Danh sách chiến dịch</caption>
                <thead>
                  <tr><th scope="col">Chiến dịch</th><th scope="col">Kho</th><th scope="col">Trạng thái</th><th scope="col">Luồng</th><th scope="col" className="num">Mục</th><th scope="col">Tạo lúc</th></tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id} data-id={c.id} data-status={c.overall} data-testid="studio-campaign-row" onClick={() => navigate(`/studio/${c.id}`)}>
                      <td className="cell-video">
                        <Link className="strong clamp-1" to={`/studio/${c.id}`}>{c.name}</Link>
                        <div className="muted small clamp-1">{[c.brief?.product, c.brief?.goal].filter(Boolean).join(' · ')}</div>
                      </td>
                      <td className="small">{c.space_name}<div className="muted">{c.created_by_name}</div></td>
                      <td><CampaignStatus s={c.overall} />{c.error && <div className="tone-bad small clamp-2">{c.error}</div>}</td>
                      <td><span className="chips">{(c.flows || ['video']).map((f) => <span key={f} className="chip">{FLOW[f]?.label}</span>)}</span></td>
                      <td className="num">{c.episode_count || Object.values(c.targets || {}).reduce((a, b) => a + b, 0)}</td>
                      <td className="nowrap small">{dateTime(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="table-foot">
                <span className="muted small">{num(data.total)} chiến dịch</span>
                <Pagination page={page} pageSize={30} total={data.total} onPage={setPage} />
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

const PLATFORMS = ['TikTok', 'TikTok + Facebook Reels', 'YouTube Shorts', 'Đa nền tảng video ngắn']
const MAX_ITEMS = 30
const lines = (text) => text.split('\n').map((x) => x.trim()).filter(Boolean)

function NewCampaign() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: spaces } = useFetch(api.spaces, [])
  const { data: channels } = useFetch(api.channels, [])
  const { data: tags } = useFetch(api.tags, [])
  const { data: authorList } = useFetch(() => api.authors(), [])
  const personal = spaces?.find((s) => s.type === 'personal' && s.my_role === 'owner')
  const [spaceId, setSpaceId] = useState('')
  // Dự án marketing (BA 5.13): ?project=<id> từ trang dự án; chọn dự án thì kho = kho dự án, tham chiếu mặc định lấy từ kho dự án
  const [projectId, setProjectId] = useState(params.get('project') || '')
  const { data: projects } = useFetch(() => api.projects({ status: 'active' }), [])
  const project = projects?.find((x) => x.id === projectId)
  useEffect(() => { if (project) setSpaceId(project.space_id) }, [project])
  const [flows, setFlows] = useState(params.get('flow') ? [params.get('flow')] : ['video'])
  const [brief, setBrief] = useState({
    name: '', product: '', goal: '', audience: '', persona: '', platform: 'TikTok',
    weeks: 4, posts_per_week: 3, video_length: '45–90 giây', cta: '', constraints: '', notes: '',
  })
  const [seo, setSeo] = useState({ website: '', landing_url: '', keywords: '', location: '', sitemap_url: '', per_week: 1 })
  const [competitors, setCompetitors] = useState('')
  const [siteUrls, setSiteUrls] = useState('')
  const [social, setSocial] = useState({ channels: ['fanpage'], per_week: 3, link_url: '' })
  const [authorIds, setAuthorIds] = useState([])
  const [posts, setPosts] = useState([])
  const [ref, setRef] = useState({ q: params.get('q') || '', channel: params.get('channel') || '', tag: params.get('tag') || '', limit: 12 })
  const [excluded, setExcluded] = useState(new Set())
  const [useWiki, setUseWiki] = useState(true)
  const [wikiQuery, setWikiQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const has = (f) => flows.includes(f)

  useEffect(() => { if (personal && !spaceId) setSpaceId(personal.id) }, [personal, spaceId])

  const dRef = useDebounced(ref, 400)
  const { data: preview, error: previewError } = useFetch(() => (has('video') ? api.studioRefs(dRef) : Promise.resolve(null)), [JSON.stringify(dRef), has('video')])
  useEffect(() => setExcluded(new Set()), [JSON.stringify(dRef)]) // eslint-disable-line react-hooks/exhaustive-deps

  const autoWikiQuery = [brief.name, brief.product, brief.goal, brief.audience, has('seo') ? seo.keywords : ''].join(' ')
  const dWiki = useDebounced(wikiQuery.trim() || autoWikiQuery, 600)
  const { data: wikiCards } = useFetch(() => (useWiki && dWiki.trim() ? api.studioCards({ q: dWiki }) : Promise.resolve([])), [useWiki, dWiki])

  const num_ = (e) => (e.target.type === 'number' ? Number(e.target.value) : e.target.value)
  const set = (k) => (e) => setBrief({ ...brief, [k]: num_(e) })
  const setS = (k) => (e) => setSeo({ ...seo, [k]: num_(e) })
  const setSo = (k) => (e) => setSocial({ ...social, [k]: num_(e) })
  const setR = (k) => (e) => setRef({ ...ref, [k]: k === 'limit' ? Number(e.target.value) : e.target.value })
  const toggleIn = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])
  const chosen = (preview?.items || []).filter((v) => !excluded.has(v.id))

  const counts = {
    video: Math.min(brief.weeks * brief.posts_per_week, MAX_ITEMS),
    seo: Math.min(brief.weeks * seo.per_week, MAX_ITEMS),
    social: Math.min(brief.weeks * social.per_week, MAX_ITEMS),
  }
  const summary = [has('video') && `${counts.video} tập`, has('seo') && `${counts.seo} bài SEO`, has('social') && `${counts.social} bài MXH`].filter(Boolean).join(' · ')
  const needAuthor = has('social') && social.channels.some((c) => PERSONAL_CHANNELS.includes(c))
  const pickedAuthors = (authorList || []).filter((a) => authorIds.includes(a.id))
  const competitorList = lines(competitors)

  const problems = [
    !brief.name.trim() && 'nhập tên chiến dịch',
    !flows.length && 'chọn ít nhất một luồng',
    has('video') && !chosen.length && 'chọn video tham chiếu',
    has('seo') && !seo.keywords.trim() && 'nhập từ khoá hạt giống SEO',
    has('social') && !social.channels.length && 'chọn kênh mạng xã hội',
    needAuthor && !pickedAuthors.length && 'chọn người đứng tên cho kênh cá nhân',
    pickedAuthors.some((a) => !a.consent) && 'người đứng tên chưa xác nhận đồng ý',
    competitorList.length > 10 && 'tối đa 10 trang đối thủ',
  ].filter(Boolean)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const references = excluded.size ? { video_ids: chosen.map((v) => v.id) } : ref
      const c = await api.createCampaign({
        space_id: spaceId || null, project_id: projectId || null,
        flows, brief: { ...brief, seo, social }, references, use_wiki: useWiki, wiki_query: wikiQuery,
        competitor_urls: has('seo') ? competitorList : [], site_urls: has('seo') ? lines(siteUrls) : [],
        social_refs: has('social') ? posts.filter((p) => p.text.trim()) : [], author_ids: has('social') ? authorIds : [],
      })
      navigate(`/studio/${c.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  let n = 1
  return (
    <form className="form" onSubmit={submit}>
      <section className="card">
        <h2>{n++}. Brief</h2>
        <div className="row">
          <label className="field grow2"><span>Tên chiến dịch / series *</span>
            <input value={brief.name} onChange={set('name')} required maxLength={150} placeholder="VD: Series “Chủ gara nói thật” quý 4" />
          </label>
          <label className="field"><span>Thuộc dự án</span><ProjectSelect projects={projects?.filter((x) => x.can_edit)} value={projectId} onChange={(v) => setProjectId(v || '')} /></label>
          <label className="field"><span>Lưu vào kho</span>
            {project ? <input value={project.space_name || ''} readOnly title="Kho của dự án" /> : <SpaceSelect spaces={spaces} value={spaceId} onChange={setSpaceId} editableOnly />}
          </label>
        </div>
        {project && (
          <div className="notice small">
            Chiến dịch thuộc dự án <Link className="link" to={`/studio/projects/${project.id}`}>{project.name}</Link>: video tham chiếu, bài mẫu, trang web và thẻ ghim
            của dự án ({project.resource_count} tài nguyên, {project.card_count} thẻ) được dùng làm căn cứ khi các mục dưới để trống.
          </div>
        )}
        <div className="field">
          <span>Luồng nội dung *</span>
          <div className="flow-picks">
            {Object.entries(FLOW_INFO).map(([k, f]) => (
              <label key={k} className={`flow-pick ${has(k) ? 'on' : ''}`}>
                <input type="checkbox" checked={has(k)} onChange={() => setFlows(toggleIn(flows, k))} />
                <span><b>{f.title}</b><small>{f.desc}</small></span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid-2">
          <label className="field"><span>Sản phẩm / thương hiệu</span>
            <textarea rows={2} value={brief.product} onChange={set('product')} placeholder="VD: Phần mềm quản lý gara VC Garage — quản lý lệnh sửa chữa, kho phụ tùng, công nợ" />
          </label>
          <label className="field"><span>Mục tiêu kinh doanh</span>
            <textarea rows={2} value={brief.goal} onChange={set('goal')} placeholder="VD: 300 chủ gara đăng ký dùng thử trong 8 tuần" />
          </label>
          <label className="field"><span>Đối tượng</span>
            <textarea rows={2} value={brief.audience} onChange={set('audience')} placeholder="VD: Chủ gara 1–5 cầu nâng, 30–50 tuổi, đang quản lý bằng sổ / Excel" />
          </label>
          <label className="field"><span>Ghi chú thêm <em>(chuyện thật, ưu đãi, lịch sự kiện…)</em></span>
            <textarea rows={2} value={brief.notes} onChange={set('notes')} />
          </label>
        </div>
        <div className="row">
          <label className="field field-sm"><span>Số tuần</span><input type="number" min={1} max={12} value={brief.weeks} onChange={set('weeks')} /></label>
          <label className="field"><span>CTA mong muốn</span><input value={brief.cta} onChange={set('cta')} placeholder="VD: Đăng ký dùng thử miễn phí 30 ngày" /></label>
          <label className="field"><span>Giới hạn / điều cấm</span><input value={brief.constraints} onChange={set('constraints')} placeholder="VD: Không nói xấu đối thủ, không hứa doanh thu" /></label>
        </div>
        {summary && <p className="muted small">Kế hoạch sẽ có <b>{summary}</b> (mỗi luồng tối đa {MAX_ITEMS}).</p>}
      </section>

      {has('video') && (
        <section className="card">
          <h2>{n++}. Video tham chiếu</h2>
          <div className="row">
            <label className="field"><span>Nền tảng</span>
              <select value={brief.platform} onChange={set('platform')}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
            </label>
            <label className="field field-sm"><span>Video / tuần</span><input type="number" min={1} max={7} value={brief.posts_per_week} onChange={set('posts_per_week')} /></label>
            <label className="field field-sm"><span>Độ dài video</span><input value={brief.video_length} onChange={set('video_length')} /></label>
          </div>
          <label className="field"><span>Nhân vật / giọng kể</span>
            <input value={brief.persona} onChange={set('persona')} placeholder="VD: Anh kỹ thuật trưởng 15 năm nghề, xưng anh – các chủ gara, nói thẳng" />
          </label>
          <p className="muted small">Lấy video đã chuyển chữ khớp bộ lọc, xếp theo <b>viral score</b> (đột biến so với trung vị kênh 40% · tỷ lệ chia sẻ 25% · tương tác 20% · bình luận 15%). Bỏ tick video không muốn dùng.</p>
          <div className="filters">
            <input className="search" type="search" placeholder="Từ khoá trong lời nói / caption — không dấu cũng được" value={ref.q} onChange={setR('q')} />
            <select value={ref.channel} onChange={setR('channel')}>
              <option value="">Tất cả kênh</option>
              {channels?.map((c) => <option key={c.handle} value={c.handle}>@{c.handle} ({c.videos})</option>)}
            </select>
            <select value={ref.tag} onChange={setR('tag')}>
              <option value="">Mọi tag</option>
              {tags?.map((t) => <option key={t} value={t}>#{t}</option>)}
            </select>
            <select value={ref.limit} onChange={setR('limit')}>
              {[6, 9, 12, 15, 20, 30].map((x) => <option key={x} value={x}>Top {x}</option>)}
            </select>
          </div>
          <ErrorBox>{previewError}</ErrorBox>
          {preview && <p className="muted small">{num(preview.matched)} video khớp · dùng <b>{chosen.length}</b> video</p>}
          {preview?.items.length === 0 && <Empty>Không có video đã chuyển chữ nào khớp. Nới bộ lọc hoặc quét thêm kênh ở mục Lượt quét.</Empty>}
          {preview?.items.length > 0 && <RefTable items={preview.items} excluded={excluded} onToggle={(id) => {
            const next = new Set(excluded)
            next.has(id) ? next.delete(id) : next.add(id)
            setExcluded(next)
          }} />}
        </section>
      )}

      {has('seo') && (
        <section className="card">
          <h2>{n++}. Bài website chuẩn SEO</h2>
          <div className="grid-2">
            <label className="field"><span>Từ khoá hạt giống *</span>
              <textarea rows={2} value={seo.keywords} onChange={setS('keywords')} placeholder="VD: phần mềm quản lý gara, quản lý xưởng sửa chữa ô tô" />
            </label>
            <label className="field"><span>Website</span>
              <input value={seo.website} onChange={setS('website')} placeholder="VD: vcgarage.com" />
              <small>Khu vực (SEO địa phương)</small>
              <input value={seo.location} onChange={setS('location')} placeholder="VD: toàn quốc / Hà Nội" aria-label="Khu vực" />
            </label>
          </div>
          <div className="row">
            <label className="field"><span>Trang đích chuyển đổi</span><input type="url" value={seo.landing_url} onChange={setS('landing_url')} placeholder="https://…/dung-thu" /></label>
            <label className="field"><span>Sitemap <em>(để gợi ý link nội bộ)</em></span><input type="url" value={seo.sitemap_url} onChange={setS('sitemap_url')} placeholder="https://…/sitemap.xml" /></label>
            <label className="field field-sm"><span>Bài SEO / tuần</span><input type="number" min={1} max={7} value={seo.per_week} onChange={setS('per_week')} /></label>
          </div>
          <div className="grid-2">
            <label className="field"><span>Trang đối thủ top Google <em>(mỗi dòng một link, tối đa 10)</em></span>
              <textarea rows={4} value={competitors} onChange={(e) => setCompetitors(e.target.value)} placeholder={'Tìm từ khoá trên Google, dán link các trang đứng đầu:\nhttps://…\nhttps://…'} />
              <small>Hệ thống tải nội dung các trang này để phân tích dàn ý, chủ đề con và khoảng trống — không tự tìm trên Google.</small>
            </label>
            <label className="field"><span>URL có sẵn trên website <em>(tuỳ chọn, mỗi dòng một link)</em></span>
              <textarea rows={4} value={siteUrls} onChange={(e) => setSiteUrls(e.target.value)} placeholder="Dùng khi không có sitemap" />
              <small>Chỉ những URL này (và trang đích) được dùng làm link nội bộ; AI không tự đặt URL.</small>
            </label>
          </div>
        </section>
      )}

      {has('social') && (
        <section className="card">
          <h2>{n++}. Bài mạng xã hội</h2>
          <div className="field">
            <span>Kênh *</span>
            <div className="checks">
              {Object.entries(CHANNEL).map(([k, label]) => (
                <label key={k}><input type="checkbox" checked={social.channels.includes(k)} onChange={() => setSocial({ ...social, channels: toggleIn(social.channels, k) })} /> {label}</label>
              ))}
            </div>
          </div>
          <div className="row">
            <label className="field field-sm"><span>Bài MXH / tuần</span><input type="number" min={1} max={14} value={social.per_week} onChange={setSo('per_week')} /></label>
            <label className="field"><span>Link muốn dẫn về <em>(tự gắn UTM)</em></span><input type="url" value={social.link_url} onChange={setSo('link_url')} placeholder="https://… (bài SEO, trang đích, form đăng ký)" /></label>
          </div>
          <div className="field">
            <span>Người đứng tên {needAuthor ? '*' : ''} <em>— bắt buộc với Facebook cá nhân / LinkedIn cá nhân</em></span>
            {authorList?.length === 0 && <p className="muted small">Chưa có hồ sơ nào. <Link className="link" to="/studio/authors">+ Tạo người đứng tên</Link></p>}
            {authorList?.length > 0 && (
              <div className="checks">
                {authorList.map((a) => (
                  <label key={a.id} title={a.consent ? a.title : 'Chưa xác nhận đồng ý đứng tên'}>
                    <input type="checkbox" checked={authorIds.includes(a.id)} onChange={() => setAuthorIds(toggleIn(authorIds, a.id))} />
                    {a.name}{a.title && <span className="muted small">· {a.title}</span>}
                    {!a.consent && <Badge tone="warn">chưa đồng ý</Badge>}
                  </label>
                ))}
                <Link className="link small" to="/studio/authors">Quản lý hồ sơ ›</Link>
              </div>
            )}
          </div>
          <div className="field">
            <span>Bài mẫu hiệu quả <em>(dán nội dung bài của mình hoặc kênh khác — hệ thống không tự lấy từ Facebook / LinkedIn)</em></span>
            {posts.map((p, i) => (
              <div key={i} className="post-ref">
                <div className="row">
                  <select value={p.channel} onChange={(e) => setPosts(posts.map((x, j) => (j === i ? { ...x, channel: e.target.value } : x)))} aria-label={`Kênh bài mẫu ${i + 1}`}>
                    {Object.entries(CHANNEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <input value={p.metrics} placeholder="Số liệu (VD: 1.2k thích, 85 bình luận)" aria-label={`Số liệu bài mẫu ${i + 1}`} onChange={(e) => setPosts(posts.map((x, j) => (j === i ? { ...x, metrics: e.target.value } : x)))} />
                  <button type="button" className="btn btn-ghost btn-danger-text" aria-label={`Bỏ bài mẫu ${i + 1}`} onClick={() => setPosts(posts.filter((_, j) => j !== i))}>Bỏ</button>
                </div>
                <textarea rows={3} value={p.text} placeholder="Nội dung bài (≥ 20 ký tự)" aria-label={`Nội dung bài mẫu ${i + 1}`}
                  onChange={(e) => setPosts(posts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              </div>
            ))}
            {posts.length < 20 && <button type="button" className="btn btn-ghost" onClick={() => setPosts([...posts, { channel: social.channels[0] || 'fanpage', text: '', metrics: '', url: '' }])}>+ Thêm bài mẫu</button>}
          </div>
        </section>
      )}

      <section className="card">
        <h2>{n++}. Kiến thức VCWIKI</h2>
        <div className="checks">
          <label><input type="checkbox" checked={useWiki} onChange={(e) => setUseWiki(e.target.checked)} /> Dùng thẻ VCWIKI liên quan làm căn cứ (framework, insight, case study…)</label>
        </div>
        {useWiki && (
          <>
            <label className="field"><span>Tìm thẻ theo <em>(để trống = theo tên, sản phẩm, mục tiêu, đối tượng)</em></span>
              <input value={wikiQuery} onChange={(e) => setWikiQuery(e.target.value)} placeholder="VD: hook tiktok tâm lý chủ gara" />
            </label>
            {wikiCards?.length === 0 && <p className="muted small">Chưa tìm thấy thẻ phù hợp — chiến dịch vẫn lập được chỉ từ tham chiếu.</p>}
            {wikiCards?.length > 0 && (
              <ul className="list">
                {wikiCards.map((c) => (
                  <li key={c.id} className="list-row">
                    <Badge tone="info">{CARD_TYPE[c.type] || c.type}</Badge>
                    <Badge tone={CARD_STATUS[c.status]?.tone}>{CARD_STATUS[c.status]?.label}</Badge>
                    <span className="grow ellipsis">{c.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="form-foot">
          <span className="muted small">
            {problems.length ? `Còn thiếu: ${problems.join(', ')}.` : `AI sẽ lập chiến lược + kế hoạch ${summary} (vài phút). Nội dung từng mục viết sau, theo mục bạn chọn.`}
          </span>
          <div className="actions">
            <Link className="btn btn-ghost" to="/studio">Huỷ</Link>
            <button className="btn btn-primary" disabled={busy || problems.length > 0} data-testid="studio-campaign-submit">{busy ? 'Đang tạo…' : 'Lập chiến dịch'}</button>
          </div>
        </div>
        <ErrorBox>{error}</ErrorBox>
      </section>
    </form>
  )
}

const FLOW_INFO = {
  video: { title: 'Video ngắn', desc: 'Kịch bản TikTok / Reels / Shorts' },
  seo: { title: 'Bài website chuẩn SEO', desc: 'Từ khoá, dàn ý, bài + meta, schema' },
  social: { title: 'Bài mạng xã hội', desc: 'Facebook cá nhân, Fanpage, LinkedIn, kênh ngoài' },
}

export function RefTable({ items, excluded, onToggle, dna }) {
  return (
    <div className="table-wrap">
      <table className="table table-static">
        <caption className="sr-only">Video tham chiếu{onToggle ? ' — bỏ chọn video không muốn dùng' : ''}</caption>
        <thead>
          <tr>
            {onToggle && <th scope="col"><span className="sr-only">Dùng</span></th>}
            {dna && <th scope="col">Mã</th>}
            <th scope="col">Video</th>
            <th scope="col" className="num" title="Điểm viral 0–100">Viral</th>
            <th scope="col" className="num">Xem</th>
            <th scope="col" className="num" title="Lượt xem ÷ trung vị 30 video gần nhất của kênh">× kênh</th>
            <th scope="col" className="num" title="Chia sẻ ÷ lượt xem">Chia sẻ</th>
            <th scope="col" className="num" title="(Thích + bình luận + chia sẻ) ÷ lượt xem">Tương tác</th>
            <th scope="col" className="num">Dài</th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => {
            const m = v.metrics || {}
            const d = dna?.[v.ref]
            return (
              <tr key={v.id || v.video_id} className={excluded?.has(v.id) ? 'row-off' : ''} data-id={v.id || v.video_id} data-status={excluded?.has(v.id) ? 'excluded' : undefined}>
                {onToggle && <td><input type="checkbox" checked={!excluded.has(v.id)} onChange={() => onToggle(v.id)} aria-label={`Dùng video này: ${(v.caption || v.id || '').slice(0, 60)}`} /></td>}
                {dna && <td className="strong">{v.ref}</td>}
                <td className="cell-video">
                  <div className="strong clamp-1">{v.caption || <span className="muted">(không caption)</span>}</div>
                  {d ? (
                    <>
                      <div className="small"><b>Hook:</b> “{d.hook_text}” <span className="muted">· {d.hook_type} · {d.format} · {d.emotion}</span></div>
                      <div className="small"><b>Cấu trúc:</b> {d.structure}</div>
                      <div className="small"><b>Vì sao hiệu quả:</b> {d.why_it_works}</div>
                      <div className="small tone-good"><b>Bài học:</b> {d.takeaway}</div>
                    </>
                  ) : <div className="muted small clamp-2">{v.transcript_preview}</div>}
                  <div className="meta">
                    <span>@{v.channel_handle}</span><span>{date(v.posted_at)}</span>
                    {v.url && <a className="link" href={v.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>mở ↗</a>}
                  </div>
                </td>
                <td className="num strong">{m.viral_score ?? '—'}</td>
                <td className="num">{compact(v.views)}</td>
                <td className="num">{m.outlier ? `${m.outlier}×` : '—'}</td>
                <td className="num">{pct(m.share_rate, 2)}</td>
                <td className="num">{pct(m.engagement_rate)}</td>
                <td className="num nowrap">{duration(v.duration)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
