import { test, expect, uid, mongo, nav } from './fixtures'

test('bản đồ tri thức: đồ thị, tìm nút, chủ đề AI, xuất Obsidian vault', async ({ page }) => {
  const tag = `do-thi-${uid()}`
  const cats = await (await page.request.get('/api/categories')).json()
  const slug = cats.find((c) => c.level === 2)?.slug || cats[0].slug
  const titles = ['Chốt đơn bằng câu hỏi đóng', 'Xử lý từ chối về giá', 'Theo dõi khách sau mua'].map((t) => `${t} ${uid()}`)
  const ids = []
  for (const title of titles) {
    const res = await page.request.post('/api/wiki/cards', { data: { type: 'framework', title, summary: `Tóm tắt ${title}`, categories: [slug], tags: [tag, 'e2e'] } })
    expect(res.ok(), await res.text()).toBeTruthy()
    ids.push((await res.json()).id)
  }

  // Chưa có AI key: gọi phân tích trả 503, nút bị khoá
  expect((await page.request.post('/api/wiki/graph/analyze', { data: {} })).status()).toBe(503)

  await page.goto('/wiki')
  await page.getByTestId('wiki-tab-graph').click()   // tab route của VCWIKI
  await expect(page).toHaveURL(/\/wiki\/graph/)
  await expect(nav(page, 'VCWIKI')).toHaveClass(/active/)
  await expect(page.getByTestId('wiki-tab-graph')).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Bản đồ tri thức' })).toBeVisible()
  await expect(page.getByLabel('Đồ thị tri thức')).toBeVisible()
  await expect(page.getByRole('button', { name: '✦ AI phân tích chủ đề' })).toBeDisabled()

  // API đồ thị: thẻ nối với lĩnh vực và tag dùng chung
  const g = await (await page.request.get('/api/wiki/graph')).json()
  expect(g.nodes.filter((n) => ids.includes(n.id.slice(2)))).toHaveLength(3)
  expect(g.edges.filter((e) => e.t === `t:${tag}`)).toHaveLength(3)
  expect(g.edges.filter((e) => e.t === `k:${slug}` && ids.includes(e.s.slice(2)))).toHaveLength(3)

  // Tìm nút -> Enter -> bảng chi tiết thẻ
  await page.getByPlaceholder(/Tìm nút trên đồ thị/).fill(titles[1].replace('Xử lý', 'xu ly'))
  await page.getByPlaceholder(/Tìm nút trên đồ thị/).press('Enter')
  const side = page.locator('.graph-side')
  await expect(side.getByRole('heading', { name: titles[1] })).toBeVisible()
  await expect(side.getByText(`Tóm tắt ${titles[1]}`)).toBeVisible()
  await expect(side.getByRole('link', { name: 'Mở thẻ' })).toHaveAttribute('href', `/wiki?card=${ids[1]}`)
  await side.getByRole('button', { name: 'Đóng' }).click()
  await expect(side.getByText('Chủ đề AI')).toBeVisible()

  // Bản đồ chủ đề do AI dựng (chèn thẳng DB thay cho gọi Claude)
  const me = await (await page.request.get('/api/auth/me')).json()
  mongo(`
    const ids = ${JSON.stringify(ids)}.map((x) => ObjectId(x))
    db.wiki_topic_maps.insertOne({ space_id: null, category: '', owner_id: ObjectId('${me.id}'), status: 'done',
      overview: 'Kho mạnh về chốt đơn, còn mỏng về chăm sóc sau bán.', card_count: 3, created_by: ObjectId('${me.id}'),
      created_at: new Date(), finished_at: new Date(),
      topics: [{ key: 't0', name: 'Chốt đơn', description: 'Kỹ thuật chốt', card_ids: ids.slice(0, 2), related: ['t1'] },
               { key: 't1', name: 'Hậu mãi', description: 'Giữ chân khách', card_ids: ids.slice(2), related: [] }],
      links: [{ a: ids[0], b: ids[2], reason: 'Chốt xong cần theo dõi' }] })
  `)
  await page.reload()
  await expect(side.getByText('Kho mạnh về chốt đơn')).toBeVisible()
  await expect(page.getByRole('button', { name: '✦ Phân tích lại bằng AI' })).toBeDisabled()
  await side.getByRole('button', { name: /Hậu mãi/ }).click()
  await expect(side.getByRole('heading', { name: 'Hậu mãi' })).toBeVisible()
  await side.getByRole('button', { name: titles[2] }).click()
  await expect(side.getByRole('heading', { name: titles[2] })).toBeVisible()
  await expect(side.getByText('Chốt xong cần theo dõi')).toBeVisible()

  // Tắt lớp Liên kết AI vẫn giữ trang chạy bình thường
  await page.getByLabel('Liên kết AI').uncheck()
  await expect(page.getByLabel('Đồ thị tri thức')).toBeVisible()

  // Xuất vault: zip có ghi chú thẻ, lĩnh vực, chủ đề
  const zip = await page.request.get(await page.getByRole('link', { name: '⤓ Xuất Obsidian vault' }).getAttribute('href'))
  expect(zip.ok()).toBeTruthy()
  expect(zip.headers()['content-type']).toBe('application/zip')
  const body = (await zip.body()).toString('latin1')
  expect(body).toContain('VCWIKI/')
  expect(body).toContain('.md')
})
