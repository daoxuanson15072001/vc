import AxeBuilder from '@axe-core/playwright'
import { test, expect, mongo, uid } from './fixtures'

// Ảnh PNG 1x1 — đủ để đi hết luồng tải file mà không cần file mẫu
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const PNG2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

// Khung nạp nằm trong ngăn kéo «Nạp nguồn» (?add=1, SCR-03); bảng nguồn là DataTable (tiêu đề là link ?source=)
const panel = (page) => page.getByTestId('kb-add-drawer').locator('.add-panel')
const rows = (page) => page.getByTestId('kb-sources-table').locator('tbody tr')
const openAdd = async (page) => {
  await page.goto('/kb')
  await page.getByTestId('kb-add-open').click()
  await expect(page).toHaveURL(/[?&]add=1/)
  await expect(panel(page)).toBeVisible()
}
const closeAdd = async (page) => {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('kb-add-drawer')).toHaveCount(0)
}
const openRow = (page, text) => rows(page).filter({ hasText: text }).getByTestId('kb-source-open').click()

test('báo AI chưa sẵn sàng khi thiếu API key', async ({ page }) => {
  await page.goto('/kb')
  await expect(page.getByTestId('kb-ai-banner')).toContainText('AI chưa sẵn sàng')
})

test('đầu trang chung: h1, tab route 5 mục, nút Tìm video theo chủ đề + Nạp nguồn', async ({ page }) => {
  await page.goto('/kb')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kho tư liệu')
  const tabs = page.getByRole('navigation', { name: 'Khu Kho tư liệu' })
  await expect(tabs.getByRole('link')).toHaveText(['Nguồn', 'Video', 'Kênh', 'Ghi chép', 'Tiến độ tinh chế'])
  await expect(tabs.getByRole('link', { name: 'Nguồn' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByTestId('kb-discover')).toHaveAttribute('href', '/discover')
  await tabs.getByRole('link', { name: 'Tiến độ tinh chế' }).click()
  await expect(page).toHaveURL(/\/refine$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kho tư liệu')
  await expect(page.getByRole('navigation', { name: 'Khu Kho tư liệu' }).getByRole('link', { name: 'Tiến độ tinh chế' })).toHaveAttribute('aria-current', 'page')
  // ?add=1&space_id= mở ngăn kéo nạp chọn sẵn kho
  const sp = (await (await page.request.get('/api/spaces')).json()).find((x) => x.type === 'personal')
  await page.goto(`/kb?add=1&space_id=${sp.id}`)
  await expect(page.getByRole('dialog', { name: 'Nạp nguồn' })).toBeVisible()
  await expect(panel(page).getByLabel('Lưu vào kho')).toHaveValue(sp.id)
})

test('ô nạp chung: nhận diện link kênh @handle, video, bài viết; bỏ dòng không phải link', async ({ page }) => {
  await openAdd(page)
  const box = panel(page).getByLabel('Dán link hoặc kéo file để nạp')
  const submit = page.getByRole('button', { name: 'Nạp vào kho' })
  await expect(submit).toBeDisabled()

  await box.fill('@e2ekenh\n# ghi chú bị bỏ qua\nhttps://www.youtube.com/@e2ekenh\nhttps://example.com/bai-viet\nkhong phai link')
  const items = panel(page).locator('.items .item')
  await expect(items).toHaveCount(4)
  // @handle kiểu TikTok -> link kênh TikTok; kênh video -> hiện ô số video tối đa + cookie
  await expect(items.nth(0)).toContainText('TikTok')
  await expect(items.nth(1)).toContainText('YouTube')
  await expect(items.nth(2)).toContainText('Bài viết')
  await expect(items.nth(3)).toContainText('Không phải link')
  await expect(panel(page).getByText('Video tối đa / kênh')).toBeVisible()
  await expect(panel(page).getByText('Cookie trình duyệt')).toBeVisible()
  await expect(panel(page).locator('.intake-count')).toHaveText('3 nguồn · 1 dòng không nạp được')
})

test('dán link: nạp, trùng link bị bỏ qua, xem chi tiết, xoá', async ({ page }) => {
  await openAdd(page)
  const box = panel(page).getByLabel('Dán link hoặc kéo file để nạp')
  const submit = page.getByRole('button', { name: 'Nạp vào kho' })
  const url = `https://example.com/e2e-${Date.now()}`

  await box.fill(url)
  await panel(page).getByPlaceholder('cách nhau dấu phẩy').fill('e2e')
  await submit.click()
  await expect(page.getByText('Đã nạp 1 nguồn')).toBeVisible()
  await expect(rows(page).filter({ hasText: url })).toBeVisible()

  await box.fill(url)
  await submit.click()
  await expect(page.getByText(/Đã có trong kho, bỏ qua/)).toBeVisible()

  // Mở chi tiết (link ?source= mở được lại), tab ?stab=, xoá nguồn qua menu Thêm ▾
  await closeAdd(page)
  await openRow(page, url)
  await expect(page).toHaveURL(/\?source=/)
  const drawer = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await drawer.getByRole('tab', { name: 'Nhật ký' }).click()
  await expect(page).toHaveURL(/stab=log/)
  await expect(drawer.getByRole('log', { name: 'Nhật ký xử lý nguồn' })).toBeVisible()
  const more = drawer.getByTestId('kb-source-more')
  await expect(more).toBeVisible({ timeout: 30_000 })
  await more.click()
  await page.getByTestId('kb-source-delete').click()
  await expect(drawer).toHaveCount(0)
  await expect(page.getByTestId('toast').filter({ hasText: 'Đã xoá nguồn' })).toBeVisible()
  await expect(rows(page).filter({ hasText: url })).toHaveCount(0)
})

test('ghi chú của bạn (WK-44): nhập khi nạp, hiện và sửa được trong chi tiết nguồn', async ({ page }) => {
  await openAdd(page)
  const url = `https://example.com/ghi-chu-${Date.now()}`
  await panel(page).getByLabel('Dán link hoặc kéo file để nạp').fill(url)
  const note = panel(page).getByLabel(/Ghi chú của bạn/)
  await expect(note).toHaveAttribute('data-testid', 'kb-add-note')
  await note.fill('Thích phần hook mở đầu')
  await expect(panel(page).getByText('22/2.000 ký tự')).toBeVisible()
  await page.getByTestId('kb-intake-submit').click()
  await expect(page.getByText('Đã nạp 1 nguồn')).toBeVisible()
  await expect(page.getByTestId('kb-add-note')).toHaveValue('')

  await closeAdd(page)
  await openRow(page, url)
  const drawer = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  const edit = drawer.getByTestId('kb-source-note')
  await expect(edit).toHaveValue('Thích phần hook mở đầu')
  const save = drawer.getByTestId('kb-source-note-save')
  await expect(save).toBeDisabled()
  await edit.fill('Chú ý phần định giá giờ công')
  await save.click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Đã lưu ghi chú' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('dialog', { name: 'Chi tiết nguồn' }).getByTestId('kb-source-note')).toHaveValue('Chú ý phần định giá giờ công')
})

test('chọn "Chỉ chuyển thành chữ": nguồn được gắn nhãn chỉ chuyển chữ', async ({ page }) => {
  await openAdd(page)
  const url = `https://example.com/chi-chu-${Date.now()}`
  await panel(page).getByLabel('Dán link hoặc kéo file để nạp').fill(url)
  await panel(page).getByLabel('Dựng thẻ VCWIKI', { exact: true }).selectOption('false')
  await page.getByRole('button', { name: 'Nạp vào kho' }).click()
  await expect(page.getByText('Đã nạp 1 nguồn')).toBeVisible()
  const row = rows(page).filter({ hasText: url })
  await expect(row.getByText('chỉ chuyển chữ')).toBeVisible()
})

test('tải file: bỏ file sai định dạng, gộp 2 ảnh thành 1 nguồn, trùng album bị bỏ qua', async ({ page }) => {
  await openAdd(page)
  const input = panel(page).locator('input[type=file]')
  const stamp = Date.now()
  await input.setInputFiles([
    { name: `e2e-${stamp}-1.png`, mimeType: 'image/png', buffer: PNG },
    { name: `e2e-${stamp}-2.png`, mimeType: 'image/png', buffer: PNG2 },
    { name: 'khong-ho-tro.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') },
  ])
  await expect(panel(page).locator('.error-box')).toContainText('khong-ho-tro.exe: định dạng chưa hỗ trợ')
  const items = panel(page).locator('.items .item')
  await expect(items).toHaveCount(2)
  await expect(items.first()).toContainText('Ảnh chụp')

  // Bỏ một file rồi thêm lại
  await items.nth(1).getByRole('button').click()
  await expect(items).toHaveCount(1)
  await input.setInputFiles({ name: `e2e-${stamp}-2.png`, mimeType: 'image/png', buffer: PNG2 })
  await expect(panel(page).getByLabel(/Gộp 2 ảnh thành 1 tài liệu/)).toBeChecked()
  await expect(panel(page).locator('.intake-count')).toHaveText('1 nguồn')

  await page.getByRole('button', { name: 'Nạp vào kho' }).click()
  await expect(page.getByText('Đã nạp 1 nguồn')).toBeVisible()
  const row = rows(page).filter({ hasText: `e2e-${stamp}-1 (+1 ảnh)` })
  await expect(row).toBeVisible()

  // Nạp lại đúng 2 ảnh đó -> trùng
  await input.setInputFiles([
    { name: `e2e-${stamp}-1.png`, mimeType: 'image/png', buffer: PNG },
    { name: `e2e-${stamp}-2.png`, mimeType: 'image/png', buffer: PNG2 },
  ])
  await page.getByRole('button', { name: 'Nạp vào kho' }).click()
  await expect(page.getByText(/Đã có trong kho, bỏ qua/)).toBeVisible()

  // Chi tiết: thư viện 2 ảnh theo thứ tự, dữ liệu thô
  await closeAdd(page)
  await row.getByTestId('kb-source-open').click()
  const drawer = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await expect(drawer.locator('.thumbs a')).toHaveCount(2)
  await drawer.getByRole('tab', { name: /Dữ liệu thô/ }).click()
  await expect(drawer.locator('.raw-list a').first()).toHaveText(`01_e2e-${stamp}-1.png`)
  await drawer.getByRole('button', { name: /^Đóng: / }).click()
  await expect(drawer).toHaveCount(0)
})

test('kéo thả file vào trang mở ngăn kéo nạp với file đó', async ({ page }) => {
  await page.goto('/kb')
  const dt = await page.evaluateHandle(() => {
    const d = new DataTransfer()
    d.items.add(new File(['x'], 'keo-tha.png', { type: 'image/png' }))
    return d
  })
  await page.dispatchEvent('main', 'dragover', { dataTransfer: dt })
  await expect(page.getByTestId('kb-drop-hint')).toBeVisible()
  await page.dispatchEvent('main', 'drop', { dataTransfer: dt })
  await expect(page).toHaveURL(/[?&]add=1/)
  await expect(panel(page).locator('.items .item')).toContainText(['keo-tha.png'])
})

test('lọc theo loại nguồn có đếm số; mọi lọc + trang trên URL; menu Thao tác', async ({ page }) => {
  await page.goto('/kb')
  const kind = page.getByTestId('kb-filter-kind')
  await expect(kind.locator('option').first()).toHaveText(/^Tất cả \(\d+\)$/)
  await expect(kind.locator('option[value="web"]')).toHaveText(/^Bài viết \/ link \(\d+\)$/)
  await kind.selectOption('web')
  await expect(page).toHaveURL(/kind=web/)
  await expect(rows(page).first()).toHaveAttribute('data-kind', 'web')
  await page.getByTestId('kb-filter-status').selectOption('error')
  await page.getByTestId('kb-filter-mine').click()
  await expect(page).toHaveURL(/status=error/)
  await expect(page).toHaveURL(/mine=1/)
  await page.reload()
  await expect(page.getByTestId('kb-filter-kind')).toHaveValue('web')
  await expect(page.getByTestId('kb-filter-mine')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('kb-sources-filter-clear').click()
  await expect(page).toHaveURL(/\/kb$/)

  // link từ Việc của tôi: /kb?status=error&mine=1 — gửi mine=1 cho API
  const req = page.waitForRequest((r) => r.url().includes('/api/kb/sources?') && r.url().includes('mine=1'))
  await page.goto('/kb?status=error&mine=1')
  await req
  await expect(page.getByTestId('kb-filter-status')).toHaveValue('error')

  await page.getByTestId('kb-sources-actions').click()
  const menu = page.getByTestId('kb-sources-actions-menu')
  await expect(menu.getByRole('menuitem')).toHaveText(['Ngừng lấy chữ các nguồn đang lọc', 'Chạy tiếp tất cả nguồn đang lọc', 'Xem video lỗi mọi kênh'])
  await menu.getByRole('menuitem', { name: 'Xem video lỗi mọi kênh' }).click()
  await expect(page).toHaveURL(/failed=1/)
  await expect(page.getByRole('region', { name: 'Video lỗi' })).toBeVisible()
})

test('gắn tag tài liệu: đồng bộ sang thẻ VCWIKI và video gốc, hiện tag riêng của thẻ', async ({ page }) => {
  const id = uid()
  await page.request.get('/api/spaces')   // bảo đảm đã có kho cá nhân
  const ids = JSON.parse(mongo(`
    const u = db.users.findOne({email: 'admin@e2e.test'});
    const sp = db.spaces.findOne({type: 'personal', owner_id: u._id});
    const now = new Date(); const url = 'https://www.tiktok.com/@e2e/video/${id}';
    db.videos.insertOne({_id: 'v-${id}', url, status: 'ok', tags: ['hook-hay'], created_at: now, updated_at: now});
    const src = db.kb_sources.insertOne({space_id: sp._id, created_by: u._id, kind: 'video', url, title: 'Nguồn tag ${id}',
      status: 'done', lane: 'heavy', priority: 0, tags: [], categories: [], logs: [], options: {}, created_at: now}).insertedId;
    const doc = db.kb_documents.insertOne({source_id: src, key: 'v-${id}', space_id: sp._id, title: 'Video tag ${id}', text: 'x',
      chars: 1, meta: {video_id: 'v-${id}'}, tags: ['hook-hay'], categories: [], wiki_status: 'done', priority: 0, created_at: now}).insertedId;
    const card = db.wiki_cards.insertOne({space_id: sp._id, source_id: src, document_id: doc, type: 'hook', title: 'Thẻ tag ${id}',
      summary: '', body: '', tags: ['hook-hay', 'ai-rieng'], categories: [], status: 'draft', origin: 'ai', created_by: u._id,
      created_at: now, updated_at: now}).insertedId;
    print(JSON.stringify({src: src.toString(), card: card.toString()}))`))

  await page.goto(`/kb?source=${ids.src}&stab=docs`)
  const row = page.getByRole('dialog', { name: 'Chi tiết nguồn' }).locator('.doc-row').filter({ hasText: `Video tag ${id}` })
  await expect(row.locator('.tag-edit')).toHaveText(['#hook-hay×'])
  await expect(row.locator('.tag-inherited')).toHaveText(['#ai-rieng'])   // tag riêng của thẻ, chỉ xem

  // thêm tag có dấu -> chuẩn hoá; bỏ hook-hay
  await row.getByLabel('Thêm tag cho tài liệu').fill('Dòng Tiền')
  await row.getByLabel('Thêm tag cho tài liệu').press('Enter')
  await expect(row.locator('.tag-edit')).toHaveText(['#hook-hay×', '#dong-tien×'])
  await row.getByRole('button', { name: 'Bỏ tag hook-hay' }).click()
  await expect(row.locator('.tag-edit')).toHaveText(['#dong-tien×'])

  const state = JSON.parse(mongo(`print(JSON.stringify({
    video: db.videos.findOne({_id: 'v-${id}'}).tags,
    card: db.wiki_cards.findOne({_id: ObjectId('${ids.card}')}).tags}))`))
  expect(state.video).toEqual(['dong-tien'])
  expect(state.card.sort()).toEqual(['ai-rieng', 'dong-tien'])

  // dọn: kho video dùng chung với videos.spec.js (đếm số video)
  mongo(`db.videos.deleteOne({_id: 'v-${id}'}); db.wiki_cards.deleteOne({_id: ObjectId('${ids.card}')});
    db.kb_documents.deleteMany({source_id: ObjectId('${ids.src}')}); db.kb_sources.deleteOne({_id: ObjectId('${ids.src}')})`)
})

// SCR-04: Tiến độ tinh chế là tab thứ 5 của Kho tư liệu — một màn, Tổng hợp / Trực tiếp (?view=live), tab trạng thái
// ?status=, tiêu đề tài liệu là link mở ngăn kéo nguồn ở đúng tài liệu
test('tiến độ tinh chế: Tổng hợp / Trực tiếp trên URL, tab trạng thái, tài liệu là link', async ({ page }) => {
  const id = uid()
  await page.request.get('/api/spaces')
  const ids = JSON.parse(mongo(`
    const u = db.users.findOne({email: 'admin@e2e.test'});
    const sp = db.spaces.findOne({type: 'personal', owner_id: u._id});
    const now = new Date();
    const src = db.kb_sources.insertOne({space_id: sp._id, created_by: u._id, kind: 'web', url: 'https://example.com/tt-${id}',
      title: 'Nguồn tinh chế ${id}', status: 'extracted', lane: 'light', priority: 0, tags: [], categories: [], logs: [], options: {},
      created_at: now}).insertedId;
    const doc = db.kb_documents.insertOne({source_id: src, key: 'd${id}', space_id: sp._id, title: 'Tài liệu lỗi ${id}', text: 'x',
      chars: 1, meta: {}, tags: [], categories: [], wiki_status: 'error', wiki_error: 'AI lỗi', priority: 0, created_at: now}).insertedId;
    print(JSON.stringify({src: src.toString(), doc: doc.toString()}))`))

  await page.goto('/refine')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kho tư liệu')
  await expect(page.getByTestId('refine-view-')).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('tab', { name: /^Lỗi/ }).click()
  await expect(page).toHaveURL(/status=error/)
  const row = page.getByTestId('refine-docs-table').locator('tbody tr').filter({ hasText: `Tài liệu lỗi ${id}` })
  await expect(row).toHaveAttribute('data-status', 'error')
  await expect(row.getByTestId('refine-doc-open')).toHaveAttribute('href', `/kb?source=${ids.src}&doc=${ids.doc}`)

  // một menu Thao tác cho cả tab / hàng đã chọn
  await row.getByRole('checkbox').check()
  await page.getByTestId('refine-actions').click()
  await expect(page.getByTestId('refine-bulk-queue')).toHaveText('Đưa vào hàng chờ AI — 1 tài liệu đã chọn')
  await page.keyboard.press('Escape')

  await page.getByTestId('refine-view-live').click()
  await expect(page).toHaveURL(/view=live/)
  await expect(page.getByTestId('refine-live-conn')).toBeVisible()
  await page.goto('/refine/live')
  await expect(page.getByTestId('refine-view-live')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('heading', { name: 'Nhật ký trực tiếp' })).toBeVisible()
  await page.getByTestId('refine-view-').click()
  await expect(page).toHaveURL(/\/refine$/)
  mongo(`db.kb_documents.deleteMany({source_id: ObjectId('${ids.src}')}); db.kb_sources.deleteOne({_id: ObjectId('${ids.src}')})`)
})

// axe ở trạng thái mở của Kho tư liệu (a11y.spec chỉ quét route trần): ngăn kéo nạp, ngăn kéo nguồn từng tab, menu Thao tác
test('trợ năng: 0 lỗi critical / serious khi mở ngăn kéo nạp, ngăn kéo nguồn, menu Thao tác', async ({ page }) => {
  const scan = async (where) => {
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    const bad = r.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.map((n) => n.target.join(" ") + " " + (n.any[0]?.message || "")).join(" | ")}`)
    expect(bad, where).toEqual([])
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })   // không đo giữa lúc ngăn kéo trượt vào (màu đang mờ dần)
  const url = `https://example.com/axe-${uid()}`
  const { created } = await (await page.request.post('/api/kb/sources/links', { data: { urls: [url] } })).json()
  await page.goto('/kb?add=1')
  await expect(panel(page)).toBeVisible()
  await scan('/kb?add=1')
  for (const stab of ['content', 'docs', 'cards', 'raw', 'log']) {
    await page.goto(`/kb?source=${created[0]}&stab=${stab}`)
    await expect(page.getByRole('dialog', { name: 'Chi tiết nguồn' }).getByRole('tabpanel')).toBeVisible()
    await scan(`/kb?source=…&stab=${stab}`)
  }
  await page.goto('/kb')
  await page.getByTestId('kb-sources-actions').click()
  await scan('/kb menu Thao tác')
  // một tài liệu có trong bảng Tiến độ tinh chế (hai link chồng nhau trong ô: target-size)
  mongo(`const s = db.kb_sources.findOne({_id: ObjectId('${created[0]}')});
    db.kb_documents.insertOne({source_id: s._id, key: 'axe', space_id: s.space_id, title: 'Tài liệu axe', text: 'x', chars: 1, meta: {},
      tags: [], categories: [], wiki_status: 'error', wiki_error: 'AI lỗi', priority: 0, created_at: new Date()})`)
  await page.goto('/refine?status=all')
  await expect(page.getByTestId('refine-docs-table').locator('tbody tr').filter({ hasText: 'Tài liệu axe' })).toBeVisible()
  await scan('/refine?status=all')
  mongo(`db.kb_documents.deleteMany({source_id: ObjectId('${created[0]}')})`)
  await page.request.delete(`/api/kb/sources/${created[0]}`)
})
