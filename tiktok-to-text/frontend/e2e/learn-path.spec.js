// Luồng I — lộ trình, giao bài, thi, chấm (docs/BA.md mục 17: LRN-03, 05…08, 12).
// Luồng dùng thử: phát hành lộ trình → giao → người học thi → người chấm chốt → người học xem kết quả.
// AI chấm tự luận là AI giả: ghi thẳng kết quả chấm sơ bộ vào DB e2e (không phụ thuộc Claude / AI local).
import { test, expect, seedOrg, pageAs, nav, uid, mongo } from './fixtures'

import AxeBuilder from '@axe-core/playwright'

// SCR-15/17: màn có dữ liệu thật phải 0 lỗi critical / serious (a11y.spec.js chỉ quét màn trống)
async function noSeriousA11y(page, where) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const bad = r.violations.filter((v) => ['critical', 'serious'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
  expect(bad, `axe ${where}`).toEqual([])
}

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

test('trưởng phòng dựng lộ trình tháng có bài thi, giao nhân viên; nhân viên thi; trưởng phòng chấm, chốt; nhân viên xem kết quả', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const { people } = await seedOrg(page)
  const s = uid()
  const lessonTitle = `Chào hàng ${s}`
  const pathTitle = `Tháng 10 — bán hàng ${s}`
  const essayStem = `Khách chê giá cao, bạn xử lý thế nào? ${s}`

  // Chuẩn bị (API): kho phòng (nhân viên xem được), thẻ đã duyệt, 2 câu đã duyệt, bài học đã phát hành
  const tp = await pageAs(browser, people.tp_part_kd)
  const space = await ok(await tp.request.post('/api/spaces', { data: { name: `Kho KD ${s}` } }))
  await ok(await tp.request.post(`/api/spaces/${space.id}/members`, { data: { email: people.nv_part_kd.email, role: 'viewer' } }))
  const card = await ok(await tp.request.post('/api/wiki/cards', {
    data: { space_id: space.id, type: 'framework', title: `Quy trình chào hàng ${s}`, summary: 'Ba bước', body: 'Chào — hỏi nhu cầu — đề xuất.' },
  }))
  // tác giả không tự duyệt thẻ (bốn mắt, luồng F) — đặt thẳng trạng thái đã duyệt; luồng duyệt: review.spec.js
  mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${card.id}') }, { $set: { status: 'approved' } })`)
  const q1 = await ok(await tp.request.post('/api/learn/questions', {
    data: { kind: 'single', stem: `Bước thứ hai khi chào hàng? ${s}`, card_ids: [card.id], space_id: space.id,
      options: [{ text: 'Hỏi nhu cầu', correct: true }, { text: 'Báo giá ngay', correct: false }] },
  }))
  const q2 = await ok(await tp.request.post('/api/learn/questions', {
    data: { kind: 'essay', stem: essayStem, card_ids: [card.id], space_id: space.id, model_answer: 'Hỏi nhu cầu, nêu giá trị, đề xuất gói phù hợp',
      rubric: [{ criterion: 'Nêu đủ bước', max: 4, descriptor: 'Đủ 3 bước' }] },
  }))
  for (const q of [q1, q2]) await ok(await tp.request.patch(`/api/learn/questions/${q.id}`, { data: { status: 'approved' } }))
  const lesson = await ok(await tp.request.post('/api/learn/lessons', {
    data: { title: lessonTitle, space_id: space.id, items: [{ card_id: card.id }], practice_question_ids: [q1.id] },
  }))
  await ok(await tp.request.patch(`/api/learn/lessons/${lesson.id}`, { data: { status: 'published' } }))

  // 1. Trưởng phòng: tạo lộ trình tháng (giao diện), thêm tuần + bài học, ma trận đề 1 câu một đáp án + 1 câu tự luận
  await tp.goto('/')
  await nav(tp, 'Lộ trình học').click()
  await tp.getByRole('button', { name: '+ Lộ trình mới' }).click()
  await tp.getByRole('menuitem', { name: 'Lộ trình trống' }).click()
  await tp.getByLabel('Tên lộ trình').fill(pathTitle)
  await tp.getByRole('button', { name: 'Tạo bản nháp' }).click()
  await expect(tp.getByRole('heading', { level: 1, name: pathTitle })).toBeVisible()   // h1 = tên lộ trình
  await expect(tp.getByTestId('path-editor')).toBeVisible()
  await tp.getByRole('button', { name: '+ Thêm tuần' }).click()
  await tp.getByLabel('Thêm bài học vào tuần 1').selectOption({ label: lessonTitle })
  await tp.getByRole('tab', { name: 'Đề thi' }).click()
  await tp.getByRole('checkbox', { name: /Có bài thi/ }).check()
  await tp.getByLabel('Loại câu dòng 1').selectOption('single')
  await tp.getByLabel('Số câu dòng 1').fill('1')
  await tp.getByRole('button', { name: '+ Dòng ma trận' }).click()
  await tp.getByLabel('Loại câu dòng 2').selectOption('essay')
  await tp.getByLabel('Số câu dòng 2').fill('1')
  await tp.getByLabel('Điểm đạt (%)').fill('50')
  await tp.getByRole('button', { name: 'Phát hành' }).click()
  await expect(tp.locator('.ui-ph').getByText('Đã phát hành')).toBeVisible()   // phát hành xong tự sang tab Giao bài

  // 2. Giao cho nhân viên dưới quyền (chỉ người trong cây hiện ra)
  await expect(tp.getByRole('checkbox', { name: new RegExp(people.nv_part_mkt.name) })).toHaveCount(0)
  await tp.getByRole('checkbox', { name: new RegExp(people.nv_part_kd.name) }).check()
  await tp.getByRole('button', { name: 'Giao', exact: true }).click()
  await expect(tp.getByTestId('toast').filter({ hasText: 'Đã giao 1 người' })).toBeVisible()   // kết quả giao qua toast
  await tp.getByRole('tab', { name: /Đã giao/ }).click()
  await expect(tp.locator('.ui-table', { hasText: people.nv_part_kd.name }).getByText('Chưa bắt đầu')).toBeVisible()
  const pathId = new URL(tp.url()).pathname.split('/').pop()   // URL có ?tab=
  // giao cho người ngoài cây dưới quyền bị chặn ở server
  expect((await tp.request.post(`/api/learn/paths/${pathId}/assign`, { data: { learner_ids: [people.nv_part_mkt.id] } })).status()).toBe(403)

  // 3. Nhân viên: thấy việc được giao ở Học tập của tôi, vào thi, làm bài, nộp
  const nv = await pageAs(browser, people.nv_part_kd)
  // nhân viên thường (không soạn, không có bài để chấm): không thấy menu thiết kế / lộ trình / chấm bài (A6)
  await expect(nav(nv, 'Học tập của tôi')).toBeVisible()
  for (const label of ['Thiết kế lộ trình', 'Lộ trình học', 'Chấm bài']) await expect(nav(nv, label)).toHaveCount(0)
  await nav(nv, 'Học tập của tôi').click()
  const item = nv.getByTestId('assignment').filter({ hasText: pathTitle })
  await expect(item.getByRole('link', { name: lessonTitle })).toBeVisible()
  await expect(item.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await noSeriousA11y(nv, '/learn')
  await item.getByRole('button', { name: 'Vào thi' }).click()
  await expect(nv.getByTestId('exam-timer')).toContainText('Còn')
  await noSeriousA11y(nv, '/learn/attempts/:id (làm bài)')
  await nv.getByRole('navigation', { name: 'Câu hỏi' }).getByRole('button', { name: /Câu 2/ }).click()
  await expect(nv).toHaveURL(/\?q=2$/)                                                      // SCR-17: ?q= mở lại đúng câu
  await expect(nv.getByRole('timer')).toHaveAttribute('aria-live', 'off')
  await expect(nv.getByRole('navigation', { name: 'Câu hỏi' }).getByRole('button', { name: /Câu 1/ })).toBeVisible()
  await expect(nv.getByRole('group', { name: /Bước thứ hai khi chào hàng\?/ })).toBeVisible()   // fieldset + legend
  await nv.locator('.lrn-q', { hasText: 'Bước thứ hai khi chào hàng?' }).getByRole('radio', { name: /Hỏi nhu cầu/ }).check()
  await nv.locator('.lrn-q', { hasText: essayStem }).locator('textarea').fill('Em hỏi nhu cầu rồi đề xuất gói rẻ hơn.')
  await nv.getByRole('button', { name: 'Nộp bài' }).click()
  await expect(nv.getByText(/Bài đã nộp/)).toBeVisible()
  const attemptId = nv.url().split('/').pop().split('?')[0]

  // AI giả chấm sơ bộ tự luận: 3/4
  mongo(`
    const a = db.attempts.findOne({ _id: ObjectId('${attemptId}') })
    const e = a.paper.find((p) => p.kind === 'essay')
    db.attempts.updateOne({ _id: a._id }, { $set: { ai_status: 'done', ai_error: null, ai_feedback: 'Câu 1: Thiếu bước nêu giá trị (AI giả)',
      ai_grading: [{ question_id: e.question_id.toString(), score: 3, feedback: 'Thiếu bước nêu giá trị (AI giả)', engine: 'fake',
        per_criterion: e.rubric.map((r) => ({ criterion: r.criterion, score: 3, max: r.max, comment: 'Khá' })) }] } })
  `)

  // 4. Trưởng phòng chấm: điểm AI sơ bộ, cho điểm lệch ≥ 20% -> bắt buộc lý do; nhận xét bắt buộc; chốt
  await tp.goto('/')
  await nav(tp, 'Chấm bài').click()
  await tp.getByTestId('grading-row').filter({ hasText: people.nv_part_kd.name }).getByRole('link', { name: people.nv_part_kd.name }).click()
  await expect(tp).toHaveURL(/\/learn\/grading\?attempt=[0-9a-f]{24}/)         // TPL-A2: khung chấm ở cột phải, mở theo ?attempt=
  await expect(tp.getByTestId('ai-score')).toHaveText('3/4')
  await noSeriousA11y(tp, '/learn/grading?attempt=')
  const essayBox = tp.locator('.lrn-q', { hasText: essayStem })
  await essayBox.getByRole('spinbutton').fill('1')
  await expect(tp.getByRole('button', { name: 'Chốt điểm' })).toBeDisabled()          // chưa có nhận xét
  await tp.getByRole('button', { name: 'Chèn nhận xét nháp của AI' }).click()
  await tp.getByLabel('Nhận xét cho người học').fill('Em cần nêu giá trị trước khi đề xuất gói.')
  await tp.getByRole('button', { name: 'Chốt điểm' }).click()
  await expect(tp.getByText(/bắt buộc ghi lý do/)).toBeVisible()
  await essayBox.getByLabel(/Lý do lệch điểm AI/).fill('Chưa nêu giá trị sản phẩm, đề xuất gói rẻ là sai hướng')
  await tp.getByRole('button', { name: 'Chốt điểm' }).click()
  await expect(tp.getByTestId('toast').filter({ hasText: 'Đã chốt điểm' })).toContainText('2/5')   // chốt xong: toast + bài kế tự mở
  await expect(tp.getByTestId('grading-detail-empty')).toBeVisible()                              // hàng chờ hết bài
  await tp.goto(`/learn/attempts/${attemptId}`)
  await expect(tp.getByText('Đã chốt điểm').first()).toBeVisible()
  await expect(tp.getByTestId('final-score')).toHaveText('2/5')

  // 5. Nhân viên xem kết quả + nhận xét, gửi phản hồi một lần
  await nav(nv, 'Học tập của tôi').click()
  await nv.getByRole('tab', { name: 'Đã xong' }).click()                    // hết lượt thi → khoá chuyển sang tab Đã xong
  await expect(item.getByTestId('exam-score')).toHaveText('2/5')
  await item.getByRole('link', { name: 'Xem kết quả' }).click()
  await expect(nv.getByTestId('final-score')).toHaveText('2/5')
  await expect(nv.getByTestId('feedback')).toContainText('Em cần nêu giá trị trước khi đề xuất gói.')
  await expect(nv.getByText('Chưa đạt')).toBeVisible()
  await nv.getByLabel('Phản hồi').fill('Em đã nêu nhu cầu khách')
  await nv.getByRole('button', { name: 'Gửi phản hồi' }).click()
  await expect(nv.getByText('Chờ người chấm trả lời.')).toBeVisible()
  await nv.context().close()

  // Đồng nghiệp khác phòng không xem được bài làm
  const other = await pageAs(browser, people.nv_part_mkt)
  expect((await other.request.get(`/api/learn/attempts/${attemptId}`)).status()).toBe(404)
  await other.context().close()
  await tp.context().close()
})

// QA vòng 2 — L10 (lộ trình năm hiện "Tháng"), L14 (400 px: dấu ○ / ✓ cùng dòng tên bài, ô tick cạnh tên người)
test('lộ trình năm hiện theo tháng; 400 px giữ dấu tiến độ và ô tick cùng dòng', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const { people } = await seedOrg(page)
  const s = uid()
  const tp = await pageAs(browser, people.tp_part_kd)
  const space = await ok(await tp.request.post('/api/spaces', { data: { name: `Kho KD ${s}` } }))
  await ok(await tp.request.post(`/api/spaces/${space.id}/members`, { data: { email: people.nv_part_kd.email, role: 'viewer' } }))
  const card = await ok(await tp.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'concept', title: `Thẻ ${s}`, summary: 'x' } }))
  mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${card.id}') }, { $set: { status: 'approved' } })`)
  const lesson = await ok(await tp.request.post('/api/learn/lessons', { data: { title: `Bài năm ${s}`, space_id: space.id, items: [{ card_id: card.id }] } }))
  await ok(await tp.request.patch(`/api/learn/lessons/${lesson.id}`, { data: { status: 'published' } }))
  const year = await ok(await tp.request.post('/api/learn/paths', { data: {
    title: `Khung năm ${s}`, period: 'year', year: 2026, modules: [{ week: 1, lesson_ids: [lesson.id] }] } }))

  await tp.setViewportSize({ width: 400, height: 900 })
  await tp.goto(`/learn/paths/${year.id}`)
  await expect(tp.getByRole('heading', { name: 'Các tháng và bài học' })).toBeVisible()
  await expect(tp.getByLabel('Tháng', { exact: true }).first()).toHaveValue('1')
  await tp.getByRole('button', { name: 'Phát hành' }).click()
  await expect(tp.locator('.ui-ph').getByText('Đã phát hành')).toBeVisible()
  const box = tp.locator('.lrn-assign label', { hasText: people.nv_part_kd.name })
  expect((await box.boundingBox()).height).toBeLessThan(40)          // ô tick cùng dòng tên, không tách dòng
  await box.getByRole('checkbox').check()
  await tp.getByRole('button', { name: 'Giao', exact: true }).click()
  await expect(tp.getByTestId('toast').filter({ hasText: people.nv_part_kd.name })).toBeVisible()
  await tp.context().close()

  const nv = await pageAs(browser, people.nv_part_kd)
  await nv.setViewportSize({ width: 400, height: 900 })
  await nv.goto('/learn')
  const item = nv.getByTestId('assignment').filter({ hasText: `Khung năm ${s}` })
  await expect(item.getByText('Tháng 1', { exact: true })).toBeVisible()
  const row = item.locator('li', { hasText: `Bài năm ${s}` })
  const [mark, link] = [await row.getByText('○').boundingBox(), await row.getByRole('link').boundingBox()]
  expect(Math.abs(mark.y - link.y)).toBeLessThan(12)                // dấu ○ cùng dòng tên bài
  expect(await nv.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400)
  await nv.context().close()
})

// UI-3 SCR-16: danh sách lộ trình lọc trên URL; menu tách *+ Lộ trình mới*; trang lộ trình có tab ?tab= và h1 = tên
test('danh sách lộ trình lọc qua URL; tab ?tab= trên trang lộ trình; menu Thiết kế lộ trình', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const { people } = await seedOrg(page)
  const s = uid()
  const tp = await pageAs(browser, people.tp_part_kd)
  const a = await ok(await tp.request.post('/api/learn/paths', { data: { title: `LT tháng ${s}`, period: 'month', year: 2031, month: 3 } }))
  await ok(await tp.request.post('/api/learn/paths', { data: { title: `Khung năm ${s}`, period: 'year', year: 2032 } }))

  await tp.goto('/learn/paths?year=2031&status=draft&mine=1')
  await expect(tp.getByRole('search', { name: 'Lọc lộ trình' })).toContainText('1 lộ trình')
  await expect(tp.getByRole('link', { name: `LT tháng ${s}` })).toBeVisible()
  await expect(tp.getByRole('link', { name: `Khung năm ${s}` })).toHaveCount(0)
  await tp.getByLabel('Năm:').selectOption('2032')
  await expect(tp).toHaveURL(/year=2032/)
  await expect(tp.getByRole('link', { name: `Khung năm ${s}` })).toBeVisible()
  await tp.getByRole('button', { name: 'Xoá lọc' }).click()
  await expect(tp).not.toHaveURL(/year=/)

  await tp.getByRole('button', { name: '+ Lộ trình mới' }).click()
  await expect(tp.getByRole('menuitem', { name: 'Thiết kế lộ trình (AI)' })).toHaveAttribute('href', '/learn/design')
  await tp.keyboard.press('Escape')

  await tp.getByRole('link', { name: `LT tháng ${s}` }).click()
  await expect(tp.getByRole('heading', { level: 1, name: `LT tháng ${s}` })).toBeVisible()
  await expect(tp.getByRole('navigation', { name: 'Vị trí' })).toContainText('Lộ trình học')
  await tp.getByRole('tab', { name: 'Đề thi' }).click()
  await expect(tp).toHaveURL(new RegExp(`/learn/paths/${a.id}\\?tab=exam`))
  await tp.reload()
  await expect(tp.getByRole('tab', { name: 'Đề thi' })).toHaveAttribute('aria-selected', 'true')
  await expect(tp.getByRole('tab', { name: 'Nội dung' })).toHaveAttribute('aria-selected', 'false')
  await tp.context().close()
})
