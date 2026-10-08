import { test, expect, mongo, uid } from './fixtures'

// Ghi chép theo nguồn và từng đơn vị (WK-45, SCR-03): khung Ghi chép trong chi tiết nguồn, nút «Ghi chép (n)» ở từng
// tài liệu, tab Ghi chép /kb/notes với bộ lọc trên URL.

function seedChannel(id) {
  return JSON.parse(mongo(`
    const u = db.users.findOne({email: 'admin@e2e.test'});
    const sp = db.spaces.findOne({type: 'personal', owner_id: u._id});
    const now = new Date();
    const src = db.kb_sources.insertOne({space_id: sp._id, created_by: u._id, kind: 'video', url: 'https://www.tiktok.com/@e2e${id}',
      title: 'Kênh ghi chép ${id}', platform: 'tiktok', status: 'extracted', lane: 'heavy', priority: 0, tags: [], categories: [],
      logs: [], options: {build_wiki: false}, note: 'Khi nạp ${id}', created_at: now}).insertedId;
    const docs = [0, 1].map((i) => db.kb_documents.insertOne({source_id: src, key: 'k${id}' + i, space_id: sp._id,
      title: 'Video ' + i + ' ${id}', text: 'x', chars: 1, meta: {}, tags: [], categories: [], wiki_status: 'skipped', priority: 0,
      created_at: now}).insertedId.toString());
    print(JSON.stringify({src: src.toString(), docs}))`))
}

const cleanup = (src) => mongo(`db.kb_notes.deleteMany({source_id: ObjectId('${src}')});
  db.kb_documents.deleteMany({source_id: ObjectId('${src}')}); db.kb_sources.deleteOne({_id: ObjectId('${src}')})`)

test('ghi chép trong chi tiết nguồn: cả nguồn và từng tài liệu', async ({ page }) => {
  const id = uid()
  await page.request.get('/api/spaces')   // bảo đảm đã có kho cá nhân
  const ids = seedChannel(id)
  await page.goto(`/kb?source=${ids.src}`)
  const drawer = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  const box = drawer.getByTestId('kb-source-notes')
  await expect(box.getByRole('heading', { name: 'Ghi chép (0)' })).toBeVisible()

  await box.getByLabel('Ghi chép cho cả nguồn').fill('Cả kênh: giọng rõ, hook tốt')
  await box.getByTestId('kb-note-save').click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Đã lưu ghi chép' })).toBeVisible()
  await expect(box.getByTestId('kb-note-item')).toHaveCount(1)
  await expect(box.getByRole('heading', { name: 'Ghi chép (1)' })).toBeVisible()

  await drawer.getByRole('tab', { name: /Tài liệu/ }).click()           // ngăn kéo có tab ?stab= (SCR-03)
  await expect(page).toHaveURL(/stab=docs/)
  const row = drawer.locator('.doc-row').filter({ hasText: `Video 1 ${id}` })
  await row.getByRole('button', { name: `Ghi chép của tài liệu: Video 1 ${id} (0)` }).click()
  const panel = row.getByTestId('kb-doc-notes-panel')
  await panel.getByLabel(`Ghi chép cho: Video 1 ${id}`).fill('Video 1: đoạn bảng giá')
  await panel.getByTestId('kb-note-save').click()
  await expect(panel.getByTestId('kb-note-item')).toHaveCount(1)
  await expect(row.getByTestId('kb-doc-notes')).toHaveText('Ghi chép (1)')
  await expect(box.getByTestId('kb-note-item')).toHaveCount(2)

  // tên tài liệu trong danh sách là link thật mở đúng tài liệu
  await drawer.getByRole('tab', { name: 'Nội dung' }).click()
  await expect(box.getByRole('link', { name: `Video 1 ${id}` })).toHaveAttribute('href', `/kb?source=${ids.src}&doc=${ids.docs[1]}`)
  const log = JSON.parse(mongo(`print(JSON.stringify(db.kb_sources.findOne({_id: ObjectId('${ids.src}')}).logs.map((l) => l.msg)))`))
  expect(log.some((m) => m.startsWith(`Thêm ghi chép («Video 1 ${id}»)`))).toBe(true)
  cleanup(ids.src)
})

test('tab Ghi chép: gom theo nguồn, lọc trên URL, sửa và xoá', async ({ page }) => {
  const id = uid()
  await page.request.get('/api/spaces')
  const ids = seedChannel(id)
  for (const body of [{ source_id: ids.src, text: `Nguồn ${id} ghi một` },
    { source_id: ids.src, doc_id: ids.docs[0], text: `Video 0 ${id} ghi hai`, t: 83 }]) {
    expect((await page.request.post('/api/kb/notes', { data: body })).status()).toBe(201)
  }

  await page.goto('/kb/notes')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kho tư liệu')
  await expect(page.getByRole('link', { name: 'Ghi chép', exact: true })).toHaveAttribute('aria-current', 'page')
  const group = page.getByTestId('kb-notes-group').filter({ has: page.getByRole('heading', { name: `Kênh ghi chép ${id}` }) })
  await expect(group.getByTestId('kb-note-item')).toHaveCount(3)          // 2 ghi chép + mục Khi nạp
  await expect(group.locator('[data-kind="intake"]')).toContainText(`Khi nạp ${id}`)
  await expect(group.getByRole('link', { name: 'Mở tại 01:23' })).toHaveAttribute('href', `/kb?source=${ids.src}&doc=${ids.docs[0]}&t=83`)
  await expect(group.getByRole('link', { name: `Mở nguồn: Kênh ghi chép ${id}` })).toHaveAttribute('href', `/kb?source=${ids.src}`)

  // lọc nguồn + tìm chữ -> lên URL, tải lại vẫn giữ
  await page.getByTestId('kb-notes-filter-source').selectOption(ids.src)
  await expect(page).toHaveURL(new RegExp(`source_id=${ids.src}`))
  await page.getByTestId('kb-notes-search').fill('ghi hai')
  await expect(page).toHaveURL(/q=ghi\+hai/)
  await page.reload()
  await expect(page.getByTestId('kb-notes-search')).toHaveValue('ghi hai')
  await expect(page.getByTestId('kb-notes-list').getByTestId('kb-note-item')).toHaveCount(1)

  // sửa rồi xoá (hộp xác nhận tự đồng ý trong e2e)
  const item = page.getByTestId('kb-notes-list').getByTestId('kb-note-item').first()
  await item.getByRole('button', { name: /^Sửa ghi chép/ }).click()
  await item.getByTestId('kb-note-edit').fill(`Video 0 ${id} ghi hai đã sửa`)
  await item.getByTestId('kb-note-edit-save').click()
  await expect(item).toContainText('đã sửa')
  await item.getByTestId('kb-note-delete').click()
  await expect(page.getByTestId('toast').filter({ hasText: 'Đã xoá ghi chép' })).toBeVisible()
  await expect(page.getByTestId('kb-notes-empty')).toBeVisible()
  expect(mongo(`print(db.kb_notes.countDocuments({source_id: ObjectId('${ids.src}')}))`).trim()).toBe('1')
  cleanup(ids.src)
})

// SCR-03.2: bấm «Xem video» -> dòng tài liệu thành hai cột, ô ghi chép của chính video nằm cạnh video (không phải cuộn)
test('xem video và ghi chép song song', async ({ page }) => {
  const id = uid()
  await page.request.get('/api/spaces')
  const ids = seedChannel(id)
  mongo(`db.kb_documents.updateOne({_id: ObjectId('${ids.docs[0]}')},
    {$set: {url: 'https://www.tiktok.com/@e2e${id}/video/7690436175676378374'}})`)
  await page.goto(`/kb?source=${ids.src}`)
  const drawer = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await drawer.getByRole('tab', { name: /Tài liệu/ }).click()
  const row = drawer.locator('.doc-row').filter({ hasText: `Video 0 ${id}` })
  await row.getByRole('button', { name: 'Xem video' }).click()

  const watch = drawer.getByTestId('kb-watch')
  await expect(watch).toHaveAttribute('id', `doc-${ids.docs[0]}`)
  const box = watch.getByLabel('Ghi chép khi xem (0)')
  await expect(box).toBeVisible()
  await expect(watch.getByTestId('kb-note-stamp')).toBeChecked()
  await expect(row.getByTestId('kb-doc-notes')).toHaveCount(0)   // khung đã mở sẵn, không cần nút
  // ô ghi nằm bên trái video, cùng tầm mắt
  const [b, v] = [await box.boundingBox(), await watch.locator('.watch-video').boundingBox()]
  expect(b.x + b.width).toBeLessThanOrEqual(v.x)
  expect(b.y).toBeLessThan(v.y + v.height)

  await box.fill('Đoạn hệ sinh thái CRM')
  await box.press('Control+Enter')
  await expect(page.getByTestId('toast').filter({ hasText: 'Đã lưu ghi chép' })).toBeVisible()
  await expect(watch.getByTestId('kb-note-item')).toHaveCount(1)
  await expect(watch.getByLabel('Ghi chép khi xem (1)')).toBeFocused()
  cleanup(ids.src)
})
