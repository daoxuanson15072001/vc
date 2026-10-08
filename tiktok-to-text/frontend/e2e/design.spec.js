// Thiết kế lộ trình bằng AI + AI sinh câu hỏi — luồng H (docs/BA.md 17.5 LRN-04, 17.6 LRN-02 phần AI).
// AI giả: bản ghi meta `learn_ai_fake` trong DB e2e (backend/app/learn/generate.py) — không cần Claude / AI local.
import { test, expect, seedOrg, pageAs, uid, mongo } from './fixtures'

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

test('trưởng phòng điền form 6 ô → AI dựng lộ trình nháp từ thẻ đã duyệt, báo thiếu tri thức → sửa → lưu nháp; AI sinh câu hỏi cho thẻ', async ({ page, browser }) => {
  test.setTimeout(120_000)
  mongo(`db.meta.updateOne({ _id: 'learn_ai_fake' }, { $set: { on: true } }, { upsert: true })`)
  const { people } = await seedOrg(page)
  const s = uid()
  const tp = await pageAs(browser, people.tp_part_kd)
  const space = await ok(await tp.request.post('/api/spaces', { data: { name: `Kho KD ${s}` } }))
  await ok(await tp.request.post(`/api/spaces/${space.id}/members`, { data: { email: people.nv_part_kd.email, role: 'viewer' } }))
  const mk = async (title, extra, approve = true) => {
    const c = await ok(await tp.request.post('/api/wiki/cards', {
      data: { space_id: space.id, type: 'sop', title: `${title} ${s}`, summary: `Tóm tắt ${title}`, key_points: ['Chào khách', 'Hỏi nhu cầu'],
        categories: ['ban-hang-cskh.ky-nang-ban-hang'], level: 'thuc-thi', division: ['vcpart'], ...extra },
    }))
    // thẻ do tác giả tự duyệt không được (bốn mắt, luồng F) — đặt thẳng trạng thái đã duyệt; luồng duyệt: review.spec.js
    if (approve) mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${c.id}') }, { $set: { status: 'approved' } })`)
    return c
  }
  await mk('Bước 2 chào hàng', { process_steps: ['qt.ban-hang-b2b.b'] })
  await mk('Bước 1 tìm khách', { process_steps: ['qt.ban-hang-b2b.a'], type: 'checklist' })
  await mk('Khái niệm nhu cầu', { type: 'concept' })
  await mk('Chiến lược giá', { level: 'dieu-hanh' })                 // bậc không hợp cấp 2 → loại
  await mk('Chào hàng xưởng', { division: ['vcservice'] })            // division khác → loại
  await mk('Thẻ nháp', {}, false)                                      // chưa duyệt → loại

  // Form 6 ô
  await tp.goto('/')
  await tp.goto('/learn/design')   // đã rời menu: là nút chính của Lộ trình học (DESIGN V.3.1)
  await tp.getByLabel('Cấp bậc').selectOption('2')
  await tp.getByLabel('Mảng (của người học)').selectOption({ label: 'Bán hàng & CSKH' })
  await tp.getByLabel('Division').selectOption('vcpart')
  await tp.getByRole('checkbox', { name: people.nv_part_kd.name }).check()
  await tp.getByLabel('2. Mục tiêu sau kỳ (một câu, đo được)').fill('Tự chào hàng đúng 3 bước')
  await tp.getByLabel(/5\. Nhánh bắt buộc/).fill('ban-hang-cskh')
  await tp.getByLabel('6. Cách đánh giá').fill('Thi cuối tháng 10 câu')
  await expect(tp.getByLabel('Prompt gửi AI')).toHaveValue(/Mục tiêu sau kỳ: Tự chào hàng đúng 3 bước/)
  await tp.getByLabel('Prompt gửi AI').fill((await tp.getByLabel('Prompt gửi AI').inputValue()) + '\nƯu tiên tình huống thực tế.')
  await tp.getByRole('button', { name: 'Tiếp: AI dựng lộ trình nháp' }).click()
  await expect(tp).toHaveURL(/step=2/)   // bước 2 Bản nháp AI

  // Bản nháp: chỉ 3 thẻ hợp lệ, xếp bước (không bước → a → b), kèm phiên bản; báo thiếu tri thức theo nhánh + bậc
  await expect(tp.getByText('AI: fake')).toBeVisible()
  const links = tp.locator('.lrn-week a.link')
  await expect(links).toHaveText([`Khái niệm nhu cầu ${s}`, `Bước 1 tìm khách ${s}`, `Bước 2 chào hàng ${s}`])
  const gaps = tp.getByLabel('Thiếu tri thức')
  await expect(gaps.locator('li', { hasText: 'Đàm phán' })).toContainText('thiếu thẻ bậc Thực thi')
  await expect(tp.locator('li', { hasText: `Khái niệm nhu cầu ${s}` }).getByText(/bản 1/)).toBeVisible()

  // Bước 3 Sửa: đổi tên bài 1, bỏ một thẻ, lưu nháp vào kho phòng
  await tp.getByRole('button', { name: /^Tiếp: Sửa/ }).click()
  await expect(tp).toHaveURL(/step=3/)
  await expect(tp.locator('[aria-current="step"]')).toContainText('Sửa')          // CMP-16: bước hiện tại + bước xong
  await expect(tp.getByTestId('design-steps')).toContainText('đã xong')
  await tp.getByLabel('Tên bài tuần 1.1').fill(`Nhập môn chào hàng ${s}`)
  await tp.locator('li', { hasText: `Bước 1 tìm khách ${s}` }).getByTitle('Bỏ thẻ').click()
  await expect(links).toHaveCount(2)
  await tp.getByLabel('Lưu bài học vào kho (người học phải xem được kho này)').selectOption({ label: `Kho KD ${s} (chia sẻ)` })
  await tp.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect(tp.getByText(/Đã lưu nháp: \d bài học nháp\./)).toBeVisible()

  // Mở lại từ URL: bản nháp giữ chỉnh sửa
  await tp.reload()
  await expect(tp.getByLabel('Tên bài tuần 1.1')).toHaveValue(`Nhập môn chào hàng ${s}`)
  await expect(links).toHaveCount(2)

  // AI sinh câu hỏi cho một thẻ (SOP → nhiều đáp án), câu nháp vào ngân hàng câu hỏi
  const row = tp.locator('li', { hasText: `Bước 2 chào hàng ${s}` })
  await row.getByRole('button', { name: 'AI sinh câu hỏi' }).click()
  await expect(row.getByText('Đã tạo 2 câu nháp')).toBeVisible()
  await row.getByRole('link', { name: 'Ngân hàng câu hỏi' }).click()
  const q = tp.locator('.lrn-qrow', { hasText: `theo thẻ “Bước 2 chào hàng ${s}”` }).first()
  await expect(q.getByText('Nháp')).toBeVisible()
  await tp.context().close()

  // Nhân viên (không có người dưới quyền) không dùng được
  const nv = await pageAs(browser, people.nv_part_kd)
  expect((await nv.request.post('/api/learn/paths/design', { data: { form: {} } })).status()).toBe(403)
  await nv.context().close()
  mongo(`db.meta.deleteOne({ _id: 'learn_ai_fake' })`)
})

// QA vòng 2 — L2: Lưu nháp ở màn thiết kế không đè phần đã sửa ở màn Lộ trình; ghi đè chỉ khi chọn rõ
test('lưu nháp ở màn thiết kế giữ tuần / bài thêm tay, hạn tuần, thời gian thi, mục bắt buộc sửa ở màn Lộ trình', async ({ page, browser }) => {
  test.setTimeout(120_000)
  mongo(`db.meta.updateOne({ _id: 'learn_ai_fake' }, { $set: { on: true } }, { upsert: true })`)
  const { people } = await seedOrg(page)
  const s = uid()
  const tp = await pageAs(browser, people.tp_part_kd)
  const space = await ok(await tp.request.post('/api/spaces', { data: { name: `Kho KD ${s}` } }))
  const card = async (title) => {
    const c = await ok(await tp.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'concept', title: `${title} ${s}`, summary: 'Tóm tắt' } }))
    mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${c.id}') }, { $set: { status: 'approved' } })`)
    return c
  }
  const c1 = await card('Khái niệm chào hàng')
  const c2 = await card('Kịch bản gọi điện')
  const manual = await ok(await tp.request.post('/api/learn/lessons', { data: { title: `Bài thêm tay ${s}`, space_id: space.id, items: [{ card_id: c2.id }] } }))
  await ok(await tp.request.patch(`/api/learn/lessons/${manual.id}`, { data: { status: 'published' } }))
  // bản nháp AI + lưu lần đầu (API), rồi sửa ở màn Lộ trình (API như màn I gửi)
  const d = await ok(await tp.request.post('/api/learn/paths/design', { data: { title: `LT ${s}`, form: { period: 'month', year: 2026, month: 10 } } }))
  const saved = await ok(await tp.request.put(`/api/learn/paths/${d.id}/design`, { data: {
    title: `LT ${s}`, space_id: space.id, exam: { blueprint: '10 câu', duration_min: 45, pass_score: 70 },
    weeks: [{ week: 1, lessons: [{ title: `Bài AI ${s}`, cards: [{ card_id: c1.id }] }] }] } }))
  const aiLesson = saved.lesson_ids[0]
  await ok(await tp.request.patch(`/api/learn/paths/${d.id}`, { data: {
    modules: [{ week: 1, title: 'Mở đầu', lesson_ids: [aiLesson], due_at: '2026-10-10T16:59:00Z' }, { week: 3, lesson_ids: [manual.id] }],
    required_items: [aiLesson, manual.id],
    exam: { blueprint: [{ kind: 'single', count: 1 }], duration_min: 20, pass_score: 50 } } }))

  // Màn thiết kế: cảnh báo đã sửa ở màn Lộ trình, thời gian thi đang có ở lộ trình; sửa tên bài, lưu nháp
  await tp.goto(`/learn/design?id=${d.id}`)
  await expect(tp.getByRole('note', { name: 'Đã sửa ở màn Lộ trình' })).toContainText('1 bài thêm tay')
  await expect(tp.getByLabel('Thời gian (phút)')).toHaveValue('20')
  await tp.getByLabel('Tên bài tuần 1.1').fill(`Bài AI đã sửa ${s}`)
  await tp.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect(tp.getByLabel('Thông báo khi lưu')).toContainText('Giữ 1 bài thêm ở màn Lộ trình')

  // Màn Lộ trình: còn tuần 3 + bài thêm tay (bắt buộc), chủ đề + hạn tuần 1, thời gian 20, bài AI đổi tên tại chỗ
  await tp.goto(`/learn/paths/${d.id}`)
  await expect(tp.getByText(`Bài AI đã sửa ${s}`)).toBeVisible()
  const manualRow = tp.locator('li', { hasText: `Bài thêm tay ${s}` })
  await expect(manualRow.getByRole('checkbox', { name: 'bắt buộc' })).toBeChecked()
  await expect(tp.getByLabel('Chủ đề tuần').first()).toHaveValue('Mở đầu')
  await expect(tp.getByLabel('Hạn tuần').first()).not.toHaveValue('')
  await tp.getByRole('tab', { name: 'Đề thi' }).click()
  await expect(tp.getByLabel('Thời gian (phút)')).toHaveValue('20')
  expect((await ok(await tp.request.get(`/api/learn/paths/${d.id}/design`))).lesson_ids).toEqual([aiLesson])

  // Ghi đè rõ ràng: bỏ bài thêm tay
  await tp.goto(`/learn/design?id=${d.id}`)
  await tp.getByRole('checkbox', { name: /Ghi đè theo bản thiết kế/ }).check()
  await tp.getByRole('button', { name: 'Lưu nháp (ghi đè)' }).click()
  await expect(tp.getByLabel('Thông báo khi lưu')).toContainText('Đã ghi đè')
  await tp.goto(`/learn/paths/${d.id}`)
  await expect(tp.getByText(`Bài AI đã sửa ${s}`)).toBeVisible()
  await expect(tp.locator('li', { hasText: `Bài thêm tay ${s}` })).toHaveCount(0)
  await tp.context().close()
  mongo(`db.meta.deleteOne({ _id: 'learn_ai_fake' })`)
})
