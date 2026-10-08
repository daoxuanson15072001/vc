// Checklist "Soạn khoá học" ở /guide#soan-khoa (28/09/2026) chạy đúng như một AI làm theo từng dòng: mọi ô / nút tìm
// bằng data-testid mới (q-*, lesson-*, path-*, assign-*), ô tìm thẻ trả chip đúng nhanh (match=title) và không lộ thẻ
// nháp, "Lưu, duyệt và tạo câu tiếp" giữ thẻ / loại / độ khó / kho, nhập nhiều câu JSON có xem trước, lỗi 5xx ghi mã +
// endpoint + nút Thử lại, bản /guide/soan-khoa.md đọc được bằng HTTP thuần.
import { test, expect, seedOrg, pageAs, uid, mongo } from './fixtures'

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

test('checklist Soạn khoá học qua data-testid: 4 câu (2 tạo tiếp + 2 nhập JSON) → bài học → lộ trình có thi → giao; guide .md; lỗi 503 có Thử lại', async ({ page, browser }) => {
  test.setTimeout(300_000)   // nhiều bước giao diện; máy dev có Ollama thì tìm theo nghĩa chậm
  const { people } = await seedOrg(page)
  const s = uid()
  const tp = await pageAs(browser, people.tp_part_kd)

  // ---- Bước 0 (API): quyền soạn, người học, kho chia sẻ, thẻ đã duyệt
  const me = await ok(await tp.request.get('/api/auth/me'))
  expect(me.can_design).toBe(true)
  const users = await ok(await tp.request.get('/api/users'))
  expect(users.some((u) => u.id === people.nv_part_kd.id)).toBe(true)
  const space = await ok(await tp.request.post('/api/spaces', { data: { name: `Kho đào tạo ${s}`, visibility: 'org' } }))
  const titles = [`Lời hứa giao hàng VCparts ${s}: 3 kho, giao trong ngày`, `Lời hứa bảo hành VCparts ${s}: đổi 1-1`]
  const cards = []
  for (const title of titles) {
    const c = await ok(await tp.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'concept', title, summary: `Tóm tắt ${title}`, body: 'Nội dung' } }))
    mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${c.id}') }, { $set: { status: 'approved' } })`)   // duyệt 2 người: review.spec.js
    cards.push(c)
  }
  const draft = await ok(await tp.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'concept', title: `Lời hứa nháp ${s}`, summary: 'Chưa duyệt' } }))
  // 0.4: tìm theo tiêu đề (match=title) — tiền tố xếp trước, chỉ thẻ đã duyệt, không lẫn thẻ khớp tóm tắt
  const byTitle = await ok(await tp.request.get(`/api/wiki/cards?status=approved&match=title&q=${encodeURIComponent(titles[0].slice(0, 10))}&page_size=12`))
  expect(byTitle.match).toBe('title')
  expect(byTitle.items.map((c) => c.id)).toContain(cards[0].id)
  expect(byTitle.items[0].match).toBe('title_prefix')
  expect(byTitle.items.map((c) => c.id)).not.toContain(draft.id)

  // ---- Bước A: câu hỏi trên giao diện
  await tp.goto('/learn/library?tab=questions')
  await tp.getByTestId('q-new').click()
  await expect(tp.getByTestId('q-form')).toBeVisible()
  await expect(tp.getByTestId('q-space')).toHaveValue(space.id)                 // mặc định kho chia sẻ, không phải kho cá nhân
  await expect(tp.getByTestId('q-space').locator('option:checked')).toHaveText(`Kho đào tạo ${s} (chia sẻ)`)
  await expect(tp.getByTestId('q-private-hint')).toHaveCount(0)
  await tp.getByTestId('q-kind').selectOption('single')
  await tp.getByTestId('q-difficulty').selectOption('2')
  await tp.getByTestId('q-stem').fill(`Câu 1 ${s}: VCparts có mấy kho?`)
  for (const [i, t] of ['1 kho', '3 kho', '5 kho', '2 kho'].entries()) await tp.getByTestId(`q-option-${i + 1}`).fill(t)
  await tp.getByTestId('q-correct-2').check()
  await tp.getByTestId('q-explanation').fill('Thẻ nêu: 3 kho Hà Nội – Hải Phòng – TP.HCM.')
  // A.4: gõ 10 ký tự đầu tiêu đề → "Đang tìm…" → chip đúng, đủ tiêu đề, có data-card-id; thẻ nháp không hiện
  const search = tp.getByTestId('q-card-search')
  await search.fill(titles[0].slice(0, 10))
  const t0 = Date.now()
  const chip = tp.getByTestId('q-card-options').locator(`[data-card-id="${cards[0].id}"]`)
  await expect(chip).toBeVisible({ timeout: 10_000 })
  expect(Date.now() - t0).toBeLessThan(3000)
  await expect(chip).toContainText(titles[0])
  await expect(chip).toContainText('Đã duyệt')
  await expect(tp.getByTestId('q-card-options').locator(`[data-card-id="${draft.id}"]`)).toHaveCount(0)
  await chip.click()
  await expect(tp.getByTestId('q-card-picked')).toContainText(titles[0])
  await expect(search).toHaveValue('')
  await expect(tp.getByTestId('q-card-options').locator('[data-card-id]')).toHaveCount(0)   // gợi ý cũ bị xoá
  // A.5: lưu, duyệt và tạo câu tiếp — giữ thẻ, loại, độ khó, kho; dọn đề bài
  await tp.getByTestId('q-save-approve-next').click()
  await expect(tp.getByTestId('toast').filter({ hasText: `Câu 1 ${s}` })).toContainText('Đã lưu và duyệt câu')   // phản hồi bằng toast (SCR-16)
  await expect(tp.getByTestId('q-stem')).toHaveValue('')
  await expect(tp.getByTestId('q-option-1')).toHaveValue('')
  await expect(tp.getByTestId('q-difficulty')).toHaveValue('2')
  await expect(tp.getByTestId('q-space')).toHaveValue(space.id)
  await expect(tp.getByTestId('q-card-picked')).toContainText(titles[0])
  // câu 2: đổi thẻ bằng cách dán id thẻ
  await tp.getByRole('button', { name: `Bỏ thẻ: ${titles[0]}` }).click()
  await search.fill(cards[1].id)
  await tp.getByTestId('q-card-options').locator(`[data-card-id="${cards[1].id}"]`).click()
  await expect(tp.getByTestId('q-card-picked')).toContainText(titles[1])
  await tp.getByTestId('q-stem').fill(`Câu 2 ${s}: hàng lỗi xử lý sao?`)
  for (const [i, t] of ['Trả tiền', 'Bỏ qua', 'Đổi 1-1', 'Giảm giá'].entries()) await tp.getByTestId(`q-option-${i + 1}`).fill(t)
  await tp.getByTestId('q-correct-3').check()
  await tp.getByTestId('q-explanation').fill('Thẻ nêu: đổi 1-1.')
  await tp.getByTestId('q-save-approve').click()
  await expect(tp.getByTestId('q-form')).toHaveCount(0)
  const row1 = tp.locator('.lrn-qrow', { hasText: `Câu 1 ${s}` })
  await expect(row1.getByText('Đã duyệt')).toBeVisible()
  await expect(row1).toContainText(`Căn cứ: ${titles[0]} (bản 1)`)
  await expect(tp.locator('.lrn-qrow', { hasText: `Câu 2 ${s}` }).getByText('Đã duyệt')).toBeVisible()

  // Nhập nhiều câu (JSON): 3 dòng, 1 dòng sai luật → xem trước báo 2/3, nhập 2, duyệt luôn
  await tp.getByTestId('q-import').click()
  const rows = [
    { kind: 'single', stem: `Câu 3 ${s}: giao nội thành mất bao lâu?`, difficulty: 2, explanation: 'Thẻ nêu: trong ngày.', card_ids: [cards[0].id],
      options: [{ text: 'Trong ngày', correct: true }, { text: '2–4 ngày', correct: false }, { text: '1 tuần', correct: false }, { text: '1 tháng', correct: false }] },
    { kind: 'single', stem: `Câu 4 ${s}: đi tỉnh mất bao lâu?`, difficulty: 2, explanation: 'Thẻ nêu: 2–4 ngày.', card_ids: [cards[0].id],
      options: [{ text: 'Trong ngày', correct: false }, { text: '2–4 ngày', correct: true }, { text: '1 tuần', correct: false }] },
    { kind: 'single', stem: `Câu sai ${s}`, card_ids: [cards[0].id], options: [{ text: 'A', correct: true }, { text: 'B', correct: true }] },
  ]
  await tp.getByTestId('q-import-text').fill(JSON.stringify(rows))
  await expect(tp.getByTestId('q-import-space')).toHaveValue(space.id)
  await tp.getByTestId('q-import-preview').click()
  await expect(tp.getByTestId('q-import-rows')).toContainText('2/3 câu hợp lệ')
  await expect(tp.getByTestId('q-import-rows').locator('tr[data-ok="no"]')).toContainText('đúng 1 phương án đúng')
  await tp.getByTestId('q-import-submit').click()
  await expect(tp.getByTestId('toast').filter({ hasText: 'Đã nhập 2 câu (đã duyệt)' })).toBeVisible()
  await expect(tp.getByTestId('q-import-form')).toHaveCount(0)                  // nhập hết thì hộp tự đóng
  await expect(tp.getByTestId('q-list')).toContainText(`Câu 3 ${s}`)
  const approved = await ok(await tp.request.get(`/api/learn/questions?status=approved&page_size=50&q=${encodeURIComponent(s)}`))
  expect(approved.total).toBe(4)

  // ---- Bước B: bài học
  await tp.getByTestId('tab-lessons').click()
  await tp.getByTestId('lesson-new').click()
  await expect(tp.getByTestId('lesson-form')).toBeVisible()
  await tp.getByTestId('lesson-title').fill(`Hội nhập VCparts ${s}`)
  await expect(tp.getByTestId('lesson-space')).toHaveValue(space.id)
  await expect(tp.getByTestId('lesson-private-hint')).toHaveCount(0)
  await tp.getByTestId('lesson-objectives').fill('Kể được lời hứa giao hàng\nBiết cách xử lý hàng lỗi')
  await tp.getByTestId('lesson-card-search').fill(cards[0].id)
  await tp.getByTestId('lesson-card-options').locator(`[data-card-id="${cards[0].id}"]`).click()
  await tp.getByTestId('lesson-card-search').fill(titles[1].slice(0, 10))
  await tp.getByTestId('lesson-card-options').locator(`[data-card-id="${cards[1].id}"]`).click()
  await expect(tp.getByTestId('lesson-card-picked').locator('li')).toHaveCount(2)
  await tp.getByTestId('lesson-body').fill('## Vì sao cần học\nNgười mới cần nói đúng lời hứa của VCparts với gara.\n## Lời hứa giao hàng\n3 kho, giao trong ngày nội thành.')
  for (const q of approved.items) await tp.getByTestId(`lesson-practice-${q.id}`).check()
  await expect(tp.getByText('Câu luyện tập (4 đã chọn)')).toBeVisible()
  await tp.getByTestId('lesson-publish').click()
  await expect(tp.getByTestId('lesson-publish-dialog')).toBeVisible()
  await expect(tp.getByTestId('publish-private-warning')).toHaveCount(0)
  await tp.getByTestId('lesson-publish-dialog').getByTestId('confirm-ok').click()
  await expect(tp).toHaveURL(/\/learn\/lessons\/[0-9a-f]{24}$/)
  await expect(tp.getByRole('heading', { name: `Hội nhập VCparts ${s}` })).toBeVisible()
  await expect(tp.getByTestId('lesson-status')).toHaveText('Đã phát hành')
  const lessonId = tp.url().split('/').pop()

  // ---- Bước C: lộ trình tháng có bài thi
  await tp.goto('/learn/paths')
  await tp.getByTestId('path-new').click()
  await tp.getByTestId('path-new-blank').click()          // menu tách: Lộ trình trống
  await tp.getByTestId('path-title').fill(`Hội nhập T10 ${s}`)
  await tp.getByTestId('path-period').selectOption('month')
  await tp.getByTestId('path-year').fill('2026')
  await tp.getByTestId('path-month').selectOption('10')
  await tp.getByTestId('path-create').click()
  await expect(tp).toHaveURL(/\/learn\/paths\/[0-9a-f]{24}$/)
  await expect(tp.getByTestId('path-editor')).toBeVisible()
  await tp.getByTestId('path-description').fill('Nhân viên mới nắm lời hứa của VCparts; thi cuối tháng 3 câu.')
  await tp.getByTestId('path-add-week').click()
  await tp.getByTestId('path-week-1-title').fill('Hệ sinh thái VC Phồn Vinh')
  await tp.getByTestId('path-week-1-due').fill('2026-10-15')
  await tp.getByTestId('path-week-1-lesson').selectOption(lessonId)
  await tp.getByTestId(`path-required-${lessonId}`).check()
  await tp.getByTestId('path-tab-exam').click()          // tab Đề thi (?tab=exam)
  await tp.getByTestId('path-exam-on').check()
  await tp.getByTestId('path-exam-duration').fill('30')
  await tp.getByTestId('path-exam-pass').fill('70')
  await tp.getByTestId('path-exam-attempts').fill('1')
  await tp.getByTestId('path-exam-scope').selectOption('path')
  await tp.getByTestId('path-bp-1-kind').selectOption('single')
  await tp.getByTestId('path-bp-1-count').fill('3')
  await tp.getByTestId('path-save').click()
  await expect(tp.getByTestId('path-error')).toHaveCount(0)
  await tp.getByTestId('path-tab-content').click()
  await expect(tp.getByTestId('path-week-1')).toContainText(`Hội nhập VCparts ${s}`)
  await tp.getByTestId('path-publish').click()          // hộp xác nhận: fixture tự đồng ý
  await expect(tp.locator('.ui-ph').getByText('Đã phát hành')).toBeVisible()
  await expect(tp.getByTestId('assign-form')).toBeVisible()          // phát hành xong tự sang tab Giao bài

  // ---- Bước D: giao
  await tp.getByTestId(`assign-person-${people.nv_part_kd.id}`).check()
  await tp.getByTestId('assign-due').fill('2026-10-31')
  await tp.getByTestId('assign-submit').click()
  await expect(tp.getByTestId('toast').filter({ hasText: `Đã giao 1 người: ${people.nv_part_kd.name}` })).toBeVisible()

  // ---- Hướng dẫn đọc bằng HTTP thuần (không cần JS)
  const md = await tp.request.get('/guide/soan-khoa.md')
  expect(md.status()).toBe(200)
  expect(md.headers()['content-type']).toContain('text/markdown')
  const text = await md.text()
  for (const needle of ['Bước 0', 'q-save-approve-next', 'lesson-publish-dialog', 'path-bp-1-count', 'assign-submit', 'Hội nhập VC Phồn Vinh', 'Lời nhắn rút gọn']) {
    expect(text).toContain(needle)
  }
  const toc = await ok(await tp.request.get('/api/guide'))
  expect(toc.sections.map((x) => x.id)).toContain('soan-khoa')

  // ---- Lỗi máy chủ: 503 ghi mã + endpoint, nút Thử lại tải lại được (tp không phải page của fixture nên 5xx giả không bị
  // tính lỗi). Chặn 503 cho tới khi test mở lại (dev StrictMode gọi fetch 2 lần — `times: 1` sẽ lọt lần hai).
  let serverDown = true
  await tp.route((u) => u.pathname === '/api/learn/lessons', (route) => (serverDown
    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue()))
  await tp.goto('/learn/library')
  await expect(tp.getByTestId('lessons-error')).toContainText('503 GET /api/learn/lessons')
  await expect(tp.getByTestId('lessons-error')).toContainText('Thử lại')
  serverDown = false
  await tp.getByTestId('lessons-error-retry').click()
  await expect(tp.getByTestId('lessons-error')).toHaveCount(0)
  await expect(tp.getByTestId('lesson-list')).toContainText(`Hội nhập VCparts ${s}`)
  await tp.context().close()
})
