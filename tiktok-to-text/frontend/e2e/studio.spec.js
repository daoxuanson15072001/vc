import { test, expect, mongo, uid } from './fixtures'

// Môi trường E2E không có ANTHROPIC_API_KEY: chiến dịch nằm ở "Chờ cấu hình AI";
// kế hoạch được ghi thẳng vào DB để kiểm tra phần hiển thị + xếp hàng viết kịch bản.
const episode = (no) => ({
  no, week: 1, day: 'Thứ 3', phase: 'Khởi động', pillar: 'Sự thật nghề', title: `Tập mẫu ${no}`,
  hook: `Hook tập ${no}`, format: 'Talking head', duration_sec: 60, key_message: 'Thông điệp', cta: 'Bình luận',
  refs: ['R1'], cards: [], rationale: 'Lý do', predicted_score: 70,
})

test('lập chiến dịch từ Kho video, xem kế hoạch, xếp hàng viết kịch bản, xoá', async ({ page }) => {
  const name = `Chiến dịch E2E ${uid()}`
  await page.goto('/kb/videos')
  await page.getByRole('link', { name: /Lập chiến dịch/ }).click()
  await expect(page).toHaveURL(/\/studio\/new/)

  // Xem trước tham chiếu: video đã chuyển chữ, có điểm viral; bỏ tick thì số video dùng giảm
  const refRows = page.locator('section', { hasText: '2. Video tham chiếu' }).locator('tbody tr')
  await expect(refRows.first()).toBeVisible()
  const total = await refRows.count()
  await expect(page.getByText(`dùng ${total} video`)).toBeVisible()
  if (total > 1) {
    await refRows.first().locator('input[type=checkbox]').uncheck()
    await expect(page.getByText(`dùng ${total - 1} video`)).toBeVisible()
  }

  await page.getByLabel(/Tên chiến dịch/).fill(name)
  await page.getByLabel('Số tuần').fill('1')
  await page.getByLabel('Video / tuần').fill('2')
  await expect(page.getByText('Kế hoạch sẽ có 2 tập')).toBeVisible()
  await page.getByRole('button', { name: 'Lập chiến dịch' }).click()

  await expect(page).toHaveURL(/\/studio\/[0-9a-f]{24}/)
  const id = page.url().split('/studio/')[1].split('?')[0]
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByText('Chờ cấu hình AI').first()).toBeVisible()
  await page.getByRole('button', { name: 'Tham chiếu' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(Math.max(1, total - 1))

  // Chưa có kế hoạch -> API từ chối viết kịch bản
  const early = await page.request.post(`/api/studio/campaigns/${id}/scripts`, { data: { episodes: [1] } })
  expect(early.status()).toBe(400)

  mongo(`db.campaigns.updateOne({_id: ObjectId("${id}")}, {$set: {status: "ready", strategy: {}, plan: {
    cadence: "2 video/tuần", posting_times: ["19:00"], production_batches: [],
    episodes: ${JSON.stringify([episode(1), episode(2)])}}}})`)
  await page.goto(`/studio/${id}?tab=plan`)
  await expect(page.getByText('Tập mẫu 2')).toBeVisible()
  await page.getByLabel('Chọn tập 1').check()
  await page.getByRole('button', { name: /Viết kịch bản 1 tập đã chọn/ }).click()
  await expect(page.getByText('Đã xếp hàng 1 kịch bản')).toBeVisible()
  await expect(page.getByLabel('Chọn tập 1')).toBeDisabled()

  // Hồ sơ xuất được dù chưa có kịch bản
  const md = await page.request.get(`/api/studio/campaigns/${id}/export.md`)
  expect(md.ok()).toBeTruthy()
  expect(await md.text()).toContain('Tập mẫu 1')

  await page.getByRole('button', { name: 'Xoá' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await expect(page.getByText(name)).toHaveCount(0)
})

// --- Luồng SEO + bài mạng xã hội (BA mục 5.7–5.9) ---------------------------------------------------------
const seoItem = (no) => ({
  no, week: 1, day: 'Thứ 2', role: no === 1 ? 'pillar' : 'cluster', pillar: 'Quản lý xưởng', title: `Bài SEO mẫu ${no}`,
  primary_keyword: `phần mềm gara ${no}`, secondary_keywords: ['quản lý xưởng'], search_intent: 'tìm hiểu', angle: 'Góc riêng',
  target_words: 1200, links_to: [], cta: 'Dùng thử', refs: [], cards: [], rationale: 'Lý do', predicted_score: 72,
})
const socialItem = (no, channel) => ({
  no, week: 1, day: 'Thứ 4', channel, author: 'A1', pillar: 'Chuyện nghề', post_type: 'giá trị', format: 'chữ',
  title: `Bài MXH mẫu ${no}`, hook: `Mở đầu ${no}`, key_message: 'Thông điệp', cta: 'Bình luận', link: 'có',
  refs: [], cards: [], rationale: 'Lý do', predicted_score: 70,
})

test('chiến dịch SEO + MXH: người đứng tên, duyệt dàn ý, xem trước bài đăng, nhân bản', async ({ page }) => {
  const name = `Đa luồng E2E ${uid()}`
  const author = `Anh Hùng ${uid()}`

  // Hồ sơ người đứng tên (đã đồng ý)
  await page.goto('/studio/authors')
  await page.getByRole('button', { name: '+ Người đứng tên' }).click()
  await page.getByLabel('Họ tên *').fill(author)
  await page.getByLabel('Chức danh').fill('Kỹ thuật trưởng')
  await page.getByLabel('Bài mẫu 1').fill('Nói thật nhé, xe không biết nói dối.')
  await page.getByLabel(/đã đồng ý cho nội dung đăng dưới tên mình/).check()
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.locator('.author-card', { hasText: author })).toContainText('Đã đồng ý')

  // Form: bỏ video, chọn SEO + MXH
  await page.goto('/studio/new')
  await page.getByLabel(/Tên chiến dịch/).fill(name)
  await page.locator('.flow-pick', { hasText: 'Video ngắn' }).locator('input').uncheck()
  await page.locator('.flow-pick', { hasText: 'Bài website chuẩn SEO' }).locator('input').check()
  await page.locator('.flow-pick', { hasText: 'Bài mạng xã hội' }).locator('input').check()
  await page.getByLabel('Số tuần').fill('1')
  await expect(page.getByText('Kế hoạch sẽ có 1 bài SEO · 3 bài MXH')).toBeVisible()
  await expect(page.locator('section', { hasText: 'Video tham chiếu' })).toHaveCount(0)
  const submit = page.getByRole('button', { name: 'Lập chiến dịch' })
  await expect(submit).toBeDisabled()
  await expect(page.getByText(/nhập từ khoá hạt giống SEO/)).toBeVisible()
  await page.getByLabel('Từ khoá hạt giống *').fill('phần mềm quản lý gara')
  await page.getByLabel('Trang đích chuyển đổi').fill('https://vcgarage.example/dung-thu')
  await page.getByLabel('LinkedIn cá nhân').check()
  await expect(page.getByText(/chọn người đứng tên cho kênh cá nhân/)).toBeVisible()
  await page.locator('.checks label', { hasText: author }).locator('input').check()
  await page.getByLabel(/Link muốn dẫn về/).fill('https://vcgarage.example/dung-thu')
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page).toHaveURL(/\/studio\/[0-9a-f]{24}/)
  const id = page.url().split('/studio/')[1].split('?')[0]
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bài SEO' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bài MXH' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Video ngắn/ })).toHaveCount(0)

  // Kế hoạch ghi thẳng vào DB (không có AI trong E2E)
  mongo(`db.campaigns.updateOne({_id: ObjectId("${id}")}, {$set: {status: "ready", strategy: {}, plans: {
    seo: {cadence: "1 bài/tuần", cluster: {pillar_topic: "Quản lý gara", pillar_keyword: "phần mềm gara", rationale: "r"},
          internal_linking: "vệ tinh → trụ", episodes: ${JSON.stringify([seoItem(1)])}},
    social: {cadence: "3 bài/tuần", posting_times: ["20:00"], mix: "70/20/10",
             episodes: ${JSON.stringify([socialItem(1, 'linkedin'), socialItem(2, 'fanpage')])}}}}})`)

  // SEO: lập dàn ý -> (giả lập AI xong) -> duyệt dàn ý & viết bài
  await page.goto(`/studio/${id}?tab=seo`)
  await expect(page.getByText('Bài SEO mẫu 1')).toBeVisible()
  await page.getByLabel('Chọn bài 1').check()
  await page.getByRole('button', { name: /Lập dàn ý 1 bài đã chọn/ }).click()
  await expect(page.getByText(/Đã xếp hàng lập dàn ý 1 bài/)).toBeVisible()
  const outline = { h1: 'Phần mềm quản lý gara là gì', primary_keyword: 'phần mềm quản lý gara', secondary_keywords: ['quản lý xưởng'],
    search_intent: 'tìm hiểu', angle: 'Từ góc chủ xưởng nhỏ', target_words: 1200,
    sections: [{ level: 2, heading: 'Phần mềm quản lý gara là gì', points: ['định nghĩa'], needs: [] }],
    faq: ['Giá bao nhiêu?'], internal_links: [], cta: 'Dùng thử', sources: { refs: [], cards: [], notes: '' } }
  mongo(`db.campaign_scripts.updateOne({campaign_id: ObjectId("${id}"), flow: "seo"}, {$set: {status: "done", outline: ${JSON.stringify(outline)}}})`)
  await page.reload()
  await page.getByText('Dàn ý — chờ duyệt').click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('H2 · Phần mềm quản lý gara là gì')).toBeVisible()
  await drawer.getByRole('button', { name: 'Duyệt dàn ý & viết bài' }).click()
  await expect(page.getByText('Đã gửi AI viết bài')).toBeVisible()
  const seo = JSON.parse(mongo(`JSON.stringify(db.campaign_scripts.findOne({campaign_id: ObjectId("${id}"), flow: "seo"}, {step: 1, status: 1}))`))
  expect(seo).toMatchObject({ step: 'article', status: 'queued' })
  await drawer.getByRole('button', { name: 'Đóng' }).click()

  // MXH: bài đã viết (giả lập) -> xem trước, UTM, duyệt, nhân bản
  await page.goto(`/studio/${id}?tab=social`)
  await expect(page.getByRole('cell', { name: /LinkedIn cá nhân/ })).toContainText(author)
  await page.getByLabel('Chọn bài 1').check()
  await page.getByRole('button', { name: /Viết 1 bài đã chọn/ }).click()
  await expect(page.getByText('Đã xếp hàng 1 bài đăng')).toBeVisible()
  const content = { channel: 'linkedin', author: 'A1', title: 'Bài MXH mẫu 1', hooks: ['Mở đầu A', 'Mở đầu B', 'Mở đầu C'],
    body: 'Thân bài ngắn.\n\nBạn nghĩ sao?', cta: 'Bình luận', hashtags: ['#gara', '#oto', '#quanly'],
    visual: { type: 'ảnh đơn', description: 'Ảnh xưởng', slides: [] }, first_comment: 'Link dùng thử ở đây', link_placement: 'bình luận đầu',
    best_time: '20:00', sources: { refs: [], cards: [], notes: '' }, facts_to_verify: [],
    link: { url: 'https://vcgarage.example/dung-thu', utm_url: 'https://vcgarage.example/dung-thu?utm_source=linkedin&utm_medium=social' } }
  const checks = [{ key: 'hooks', label: 'Đủ 3 phương án mở đầu', ok: true, detail: '3 phương án' }]
  mongo(`db.campaign_scripts.updateOne({campaign_id: ObjectId("${id}"), flow: "social"}, {$set: {status: "done", score: 84,
    content: ${JSON.stringify(content)}, checks: ${JSON.stringify(checks)}, rounds: [{total: 84}]}})`)
  await page.reload()
  await page.getByRole('button', { name: /84\/100/ }).click()
  await expect(drawer.locator('.post-preview')).toContainText('Mở đầu A')
  await drawer.getByText('Mở đầu B').click()
  await expect(drawer.locator('.post-preview')).toContainText('Mở đầu B')
  await expect(drawer.getByText(/utm_source=linkedin/).first()).toBeVisible()
  await expect(drawer.getByText('✓ Đủ 3 phương án mở đầu')).toBeVisible()
  await drawer.getByRole('button', { name: '✓ Duyệt' }).click()
  await expect(drawer.getByText('Đã duyệt').first()).toBeVisible()
  await drawer.getByLabel('Luồng nhân bản').selectOption('video')
  await drawer.getByRole('button', { name: 'Nhân bản' }).click()
  await expect(page.getByText(/Đã xếp hàng 1 bản/)).toBeVisible()
  await drawer.getByRole('button', { name: 'Đóng' }).click()
  // Chiến dịch không chọn video vẫn hiện tab Video ngắn vì có nội dung nhân bản sang
  await page.getByRole('button', { name: /^Video ngắn/ }).click()
  await expect(page.getByText('Nhân bản từ nội dung khác')).toBeVisible()

  const md = await page.request.get(`/api/studio/campaigns/${id}/export.md`)
  const text = await md.text()
  expect(text).toContain('Kế hoạch — Bài viết website chuẩn SEO')
  expect(text).toContain('Mở đầu A')
  expect(text).toContain('utm_source=linkedin')

  await page.getByRole('button', { name: 'Xoá' }).click()
  await expect(page).toHaveURL(/\/studio$/)
})
