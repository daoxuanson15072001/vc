// Tổng hợp VCWIKI theo cụm chủ đề. BE test không có API key -> worker AI không chạy:
// phần AI (sàng lọc, gom cụm, viết thẻ) được giả lập bằng cách ghi thẳng vào DB như worker (backend/app/kb/synth.py).
import { test, expect, mongo, uid } from './fixtures'

async function seedSource(page, title, n) {
  const spaces = await (await page.request.get('/api/spaces')).json()
  const space = spaces.find((s) => s.type === 'personal' && s.my_role === 'owner')
  const me = await (await page.request.get('/api/auth/me')).json()
  const out = mongo(`
    const sid = new ObjectId()
    db.kb_sources.insertOne({ _id: sid, space_id: ObjectId('${space.id}'), kind: 'video', status: 'extracted', lane: 'heavy',
      title: '${title}', url: 'https://www.tiktok.com/@e2e', platform: 'TikTok', created_by: ObjectId('${me.id}'),
      categories: [], tags: [], options: { build_wiki: false }, logs: [], created_at: new Date() })
    for (let i = 0; i < ${n}; i++) db.kb_documents.insertOne({ source_id: sid, space_id: ObjectId('${space.id}'), key: 'v' + i,
      title: 'Video ' + i + ' ${title}', text: '[00:0' + i + '] nội dung video ' + i, url: 'https://www.tiktok.com/@e2e/video/' + i,
      meta: { views: 1000 * (i + 1) }, chars: 30, images: [], wiki_status: 'skipped', created_at: new Date(Date.now() + i) })
    print(sid.toString())
  `)
  return out.trim()
}

// Giả lập bước 1 + 2 của AI: chấm điểm, bỏ video cuối, gom 2 cụm
const fakePlan = (runId) => mongo(`
  const r = db.wiki_synth_runs.findOne({ _id: ObjectId('${runId}') })
  const docs = r.docs.map((d, i) => ({ ...d, relevance: i === r.docs.length - 1 ? 2 : 8, summary: 'Ý chính của ' + d.title,
    category: 'marketing', topics: ['e2e'], keep: i !== r.docs.length - 1, reason: i === r.docs.length - 1 ? 'Nội dung giải trí' : '' }))
  const id = (i) => docs[i].id.toString()
  db.wiki_synth_runs.updateOne({ _id: r._id }, { $set: { status: 'planned', docs, clusters: [
    { key: 'cumA', title: 'Chủ đề A', category: 'marketing', doc_ids: [id(0), id(1), id(2)], primary_id: id(1), n_cards: 2, note: '', status: 'pending', card_ids: [], error: null },
    { key: 'cumB', title: 'Chủ đề B', category: 'marketing', doc_ids: [id(3)], primary_id: id(3), n_cards: 1, note: '', status: 'pending', card_ids: [], error: null },
  ] } })
`)

test('tổng hợp theo chủ đề: tạo lượt, sửa kế hoạch, viết thẻ, xem thẻ nhiều nguồn', async ({ page }) => {
  const title = `Kênh E2E ${uid()}`
  const sid = await seedSource(page, title, 5)

  // Chi tiết nguồn -> nút tổng hợp
  await page.goto(`/kb?source=${sid}`)
  const drawer = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await drawer.getByRole('tab', { name: /^Thẻ/ }).click()   // ngăn kéo nguồn có tab ?stab= (SCR-03)
  await expect(drawer.getByRole('heading', { name: 'Tổng hợp theo chủ đề' })).toBeVisible()
  await expect(drawer.getByLabel(/Nội dung của bên ngoài/)).toBeChecked()
  await drawer.getByRole('button', { name: 'Tổng hợp 5 tài liệu' }).click()

  await expect(page).toHaveURL(/\/wiki\/synth\/[0-9a-f]{24}$/)
  const runId = page.url().split('/').pop()
  await expect(page.getByRole('heading', { name: 'Tổng hợp VCWIKI theo chủ đề' })).toBeVisible()
  await expect(page.locator('.page-head .badge')).toHaveText('Chờ chạy')
  await expect(page.locator('.stepper li.on')).toContainText('Sàng lọc')
  await expect(page.getByRole('button', { name: 'Huỷ lượt' })).toBeVisible()

  // Tài liệu bị khoá khi đang tổng hợp
  const docs = await (await page.request.get(`/api/kb/sources/${sid}`)).json()
  expect(docs.documents.every((d) => d.wiki_status === 'grouping')).toBeTruthy()
  expect(docs.overall).toBe('synth')

  // AI xong bước gom cụm -> trang tự làm mới sang bước duyệt kế hoạch
  fakePlan(runId)
  await expect(page.locator('.page-head .badge')).toHaveText('Chờ duyệt kế hoạch', { timeout: 10_000 })
  await expect(page.locator('.stepper li.on')).toContainText('Duyệt kế hoạch')
  await expect(page.getByText('Đến lượt bạn')).toBeVisible()
  await expect(page.getByLabel('Tên cụm')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '✦ Viết thẻ (3)' })).toBeVisible()
  const skippedBox = page.locator('.cluster-skipped')
  await expect(skippedBox).toContainText('Bỏ qua (1)')
  await expect(skippedBox).toContainText('Nội dung giải trí')

  // Sửa: đổi tên cụm A, giảm còn 1 thẻ, ghi chú
  const cumA = page.locator('.cluster').nth(0)   // theo thứ tự: ô tên đổi giá trị ngay khi gõ
  await cumA.getByLabel('Tên cụm').fill('Chủ đề A (đã sửa)')
  await cumA.getByLabel('Số thẻ').selectOption('1')
  await cumA.getByLabel('Ghi chú cho AI').fill('Nhấn vào garage')
  await expect(page.getByText('Có thay đổi chưa lưu')).toBeVisible()

  // Chuyển Video 0 sang cụm B, bỏ qua Video 2, khôi phục video bị AI loại vào cụm mới
  await page.getByLabel(`Chuyển Video 0 ${title}`).selectOption({ label: 'Chủ đề B' })
  await page.getByLabel(`Chuyển Video 2 ${title}`).selectOption('__skip')
  await expect(skippedBox).toContainText('Bỏ qua (2)')
  await page.getByLabel(`Khôi phục Video 4 ${title}`).selectOption('__new')
  await expect(page.getByLabel('Tên cụm')).toHaveCount(3)
  await expect(skippedBox).toContainText('Bỏ qua (1)')

  // Đặt Video 3 làm tài liệu chính của cụm B
  const cumB = page.locator('.cluster').nth(1)
  await cumB.locator('.doc-mini', { hasText: 'Video 3' }).getByRole('radio').check()

  await page.getByRole('button', { name: 'Lưu kế hoạch' }).click()
  await expect(page.getByText('Có thay đổi chưa lưu')).toHaveCount(0)
  const saved = await (await page.request.get(`/api/wiki/synth/${runId}`)).json()
  expect(saved.clusters.map((c) => [c.title, c.doc_ids.length, c.n_cards])).toEqual([
    ['Chủ đề A (đã sửa)', 1, 1], ['Chủ đề B', 2, 1], [expect.stringContaining('Ý chính của Video 4'), 1, 1]])
  expect(saved.clusters[0].note).toBe('Nhấn vào garage')
  expect(saved.clusters[1].primary_id).toBe(saved.docs[3].id)

  // Viết thẻ -> bước 4
  await page.getByRole('button', { name: '✦ Viết thẻ (3)' }).click()
  await expect(page.locator('.page-head .badge')).toHaveText('AI đang viết thẻ')
  await expect(page.getByLabel('Tên cụm')).toHaveCount(0)
  await expect(page.locator('.cluster .badge', { hasText: 'Chờ viết' })).toHaveCount(3)

  // Giả lập AI viết xong: cụm B ra 1 thẻ dẫn 2 video, cụm A lỗi, cụm 3 xong 0 thẻ
  mongo(`
    const r = db.wiki_synth_runs.findOne({ _id: ObjectId('${runId}') })
    const b = r.clusters[1]
    const cid = db.wiki_cards.insertOne({ type: 'framework', title: 'Thẻ tổng hợp E2E', summary: 's', body: 'b', key_points: [],
      when_to_use: '', example: '', evidence: '', categories: ['marketing'], tags: ['nguon-ben-ngoai'], space_id: r.space_id,
      source_id: r.source_id, document_id: ObjectId(b.primary_id), status: 'draft', origin: 'ai', synth_run_id: r._id,
      source: { kind: 'video', title: 'Video 3', url: null }, created_by: r.created_by, created_at: new Date(), updated_at: new Date(),
      sources: b.doc_ids.map((d, i) => ({ document_id: ObjectId(d), title: 'Nguồn ' + i, url: 'https://x/' + i, quote: 'trích ' + i, timestamp: '[00:0' + i + ']' })),
      search_text: 'the tong hop e2e' }).insertedId
    db.wiki_synth_runs.updateOne({ _id: r._id }, { $set: { status: 'done', finished_at: new Date(),
      'clusters.0.status': 'error', 'clusters.0.error': 'AI quá tải', 'clusters.1.status': 'done', 'clusters.1.card_ids': [cid],
      'clusters.2.status': 'done' } })
  `)
  await expect(page.locator('.page-head .badge')).toHaveText('Hoàn tất', { timeout: 10_000 })
  await expect(page.getByText('Đã viết 1 thẻ nháp')).toBeVisible()
  await expect(page.locator('.cluster', { hasText: 'Chủ đề A (đã sửa)' })).toContainText('AI quá tải')
  await expect(page.getByRole('button', { name: 'Chạy lại' })).toBeVisible()

  // Chạy lại cụm lỗi -> quay về bước viết thẻ
  await page.getByRole('button', { name: 'Chạy lại' }).click()
  await expect(page.locator('.page-head .badge')).toHaveText('AI đang viết thẻ')
  await expect(page.locator('.cluster', { hasText: 'Chủ đề A (đã sửa)' }).locator('.badge')).toHaveText('Chờ viết')

  // Mở thẻ: có danh sách nhiều nguồn và link về lượt tổng hợp
  await page.getByRole('link', { name: 'Thẻ tổng hợp E2E' }).click()
  const card = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await expect(card.getByRole('heading', { name: 'Tổng hợp từ 2 tài liệu' })).toBeVisible()
  await expect(card.locator('.card-sources li')).toHaveCount(2)
  await expect(card.locator('.card-sources')).toContainText('[00:01]')
  // Bấm tên tài liệu nguồn: modal nguồn nổi trên thẻ, mở sẵn chữ tài liệu đó; đóng modal thì thẻ vẫn còn
  await card.getByRole('link', { name: 'Nguồn 1' }).click()
  const peek = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await expect(peek).toBeVisible()
  await expect(peek.locator('.doc-text')).toHaveCount(1)
  await expect(page).toHaveURL(/\/wiki\?card=/)
  await peek.getByRole('button', { name: 'Đóng' }).click()
  await expect(peek).toHaveCount(0)
  await expect(card).toBeVisible()
  await card.getByRole('link', { name: 'AI tổng hợp' }).click()
  await expect(page).toHaveURL(new RegExp(`/wiki/synth/${runId}$`))
})

test('huỷ lượt tổng hợp trả tài liệu về hàng chờ; nguồn ít tài liệu không hiện nút', async ({ page }) => {
  const title = `Kênh huỷ ${uid()}`
  const sid = await seedSource(page, title, 3)
  await page.goto(`/kb?source=${sid}&stab=cards`)
  await page.getByRole('dialog', { name: 'Chi tiết nguồn' }).getByRole('button', { name: 'Tổng hợp 3 tài liệu' }).click()
  await expect(page).toHaveURL(/\/wiki\/synth\//)
  await page.getByRole('button', { name: 'Huỷ lượt' }).click()
  await expect(page.locator('.page-head .badge')).toHaveText('Đã huỷ')
  await expect(page.getByRole('button', { name: 'Huỷ lượt' })).toHaveCount(0)
  const src = await (await page.request.get(`/api/kb/sources/${sid}`)).json()
  expect(src.documents.every((d) => d.wiki_status === 'skipped')).toBeTruthy()

  // Quay lại nguồn: lịch sử lượt + có thể tổng hợp lại
  await page.goto(`/kb?source=${sid}&stab=cards`)
  const drawer = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await expect(drawer.locator('.synth-runs li')).toContainText('Đã huỷ')
  await expect(drawer.getByRole('button', { name: 'Tổng hợp 3 tài liệu' })).toBeVisible()

  // Nguồn chỉ 1 tài liệu: không có khung tổng hợp
  const one = await seedSource(page, `Một video ${uid()}`, 1)
  await page.goto(`/kb?source=${one}&stab=docs`)
  await expect(page.getByRole('dialog', { name: 'Chi tiết nguồn' }).locator('.doc-row')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Tổng hợp theo chủ đề' })).toHaveCount(0)
})

test('link trần trong nội dung thẻ: trùng tài liệu đã nạp thì mở modal nguồn, link lạ vẫn là link ngoài', async ({ page }) => {
  const title = `Link thẻ ${uid()}`
  const sid = await seedSource(page, title, 2)
  const url = `https://www.tiktok.com/@e2e/video/${uid()}`
  const cid = mongo(`
    const d = db.kb_documents.findOne({ source_id: ObjectId('${sid}'), key: 'v1' })
    db.kb_documents.updateOne({ _id: d._id }, { $set: { url: '${url}' } })
    const s = db.kb_sources.findOne({ _id: d.source_id })
    print(db.wiki_cards.insertOne({ type: 'framework', title: '${title}', summary: 's', key_points: [], when_to_use: '', example: '',
      evidence: '', categories: [], tags: [], space_id: s.space_id, status: 'draft', origin: 'ai', created_by: s.created_by,
      body: '## Nguồn tổng hợp\\n- Video một — ${url} [00:36–04:12]\\n- Trang lạ — https://example.com/khong-co.',
      search_text: 'link the', created_at: new Date(), updated_at: new Date() }).insertedId.toString())
  `).trim()
  await page.goto(`/wiki?card=${cid}`)
  const card = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await expect(card.getByRole('link', { name: 'https://example.com/khong-co' })).toHaveAttribute('target', '_blank')
  await card.getByRole('link', { name: url }).click()
  const peek = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await expect(peek.getByRole('heading', { name: title })).toBeVisible()
  await expect(peek.locator('.doc-text')).toContainText('nội dung video 1')
  await expect(page).toHaveURL(new RegExp(`/wiki\\?card=${cid}`))
})
