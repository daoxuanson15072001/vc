// Học tập — luồng E (docs/BA.md mục 17: LRN-01 bài học, LRN-02 ngân hàng câu hỏi tạo tay, LRN-09 luyện tập).
import { test, expect, seedOrg, pageAs, nav, uid, mongo } from './fixtures'

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

test('trưởng phòng soạn bài học + câu hỏi từ thẻ đã duyệt; nhân viên dưới quyền đọc bài, luyện tập, thấy điểm, làm lại', async ({ page, browser }) => {
  test.setTimeout(120_000)   // hai người dùng, nhiều bước giao diện
  const { people } = await seedOrg(page)
  const s = uid()
  const cardTitle = `Quy trình chào hàng ${s}`
  const spaceName = `Kho phòng KD ${s}`

  // Chuẩn bị (qua API): kho phòng có nhân viên là người xem, một thẻ đã duyệt, một thẻ nháp
  const tp = await pageAs(browser, people.tp_part_kd)
  const space = await ok(await tp.request.post('/api/spaces', { data: { name: spaceName } }))
  await ok(await tp.request.post(`/api/spaces/${space.id}/members`, { data: { email: people.nv_part_kd.email, role: 'viewer' } }))
  const card = await ok(await tp.request.post('/api/wiki/cards', {
    data: { space_id: space.id, type: 'framework', title: cardTitle, summary: 'Ba bước chào hàng', body: 'Chào — **hỏi nhu cầu** — đề xuất.' },
  }))
  mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${card.id}') }, { $set: { status: 'approved' } })`)   // duyệt 2 người: review.spec.js
  await ok(await tp.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'concept', title: `Thẻ nháp ${s}` } }))

  // Câu hỏi 1 (giao diện): một đáp án, lưu và duyệt
  await tp.goto('/')
  await nav(tp, 'Thư viện bài học').click()
  await tp.getByRole('tab', { name: 'Ngân hàng câu hỏi' }).click()
  await tp.getByRole('button', { name: '+ Câu hỏi mới' }).click()
  await tp.getByLabel('Lưu vào kho').selectOption({ label: `${spaceName} (chia sẻ)` })
  await tp.getByLabel('Đề bài').fill(`Bước thứ hai khi chào hàng? ${s}`)
  await tp.getByLabel('Phương án 1', { exact: true }).fill('Hỏi nhu cầu')
  await tp.getByLabel('Phương án 2', { exact: true }).fill('Báo giá ngay')
  await tp.getByLabel('Giải thích').fill('Theo thẻ quy trình chào hàng: hỏi nhu cầu trước khi đề xuất.')
  await tp.getByLabel('Gắn thẻ căn cứ').fill(s)
  await expect(tp.getByRole('button', { name: `+ Thẻ nháp ${s}` })).toHaveCount(0)      // chỉ thẻ đã duyệt
  await tp.getByRole('button', { name: `+ ${cardTitle}` }).click()
  await tp.getByRole('button', { name: 'Lưu và duyệt' }).click()
  const row = tp.locator('.lrn-qrow', { hasText: `Bước thứ hai khi chào hàng? ${s}` })
  await expect(row.getByText('Đã duyệt')).toBeVisible()
  await expect(row.getByText(`${cardTitle} (bản 1)`)).toBeVisible()

  // Câu hỏi 2 (API): nhiều đáp án; validate: câu một đáp án có 2 phương án đúng bị từ chối
  const bad = await tp.request.post('/api/learn/questions', {
    data: { kind: 'single', stem: 'Sai luật', card_ids: [card.id], options: [{ text: 'A', correct: true }, { text: 'B', correct: true }] },
  })
  expect(bad.status()).toBe(400)
  const q2 = await ok(await tp.request.post('/api/learn/questions', {
    data: { kind: 'multi', stem: `Những việc nên làm? ${s}`, card_ids: [card.id], space_id: space.id, explanation: 'Chào và hỏi nhu cầu.',
      options: [{ text: 'Chào khách', correct: true }, { text: 'Bỏ qua khách', correct: false }, { text: 'Hỏi nhu cầu', correct: true }] },
  }))
  await ok(await tp.request.patch(`/api/learn/questions/${q2.id}`, { data: { status: 'approved' } }))

  // Bài học (giao diện): chọn thẻ đã duyệt, viết diễn giải, chọn 2 câu luyện tập, phát hành
  await tp.getByRole('tab', { name: 'Bài học', exact: true }).click()
  await tp.getByRole('link', { name: '+ Bài học mới' }).click()
  await tp.getByLabel('Tên bài học').fill(`Chào hàng cơ bản ${s}`)
  await tp.getByLabel('Lưu vào kho').selectOption({ label: `${spaceName} (chia sẻ)` })
  await tp.getByLabel('Mục tiêu').fill('Nắm ba bước chào hàng')
  await tp.getByLabel('Thêm thẻ đã duyệt').fill(s)
  await tp.getByRole('button', { name: `+ ${cardTitle}` }).click()
  await tp.getByLabel('Diễn giải').fill('## Vì sao cần học\nKhách hàng mua **giải pháp**, không mua sản phẩm.')
  await tp.getByRole('checkbox', { name: new RegExp(`Bước thứ hai khi chào hàng\\? ${s}`) }).check()
  await tp.getByRole('checkbox', { name: new RegExp(`Những việc nên làm\\? ${s}`) }).check()
  await tp.getByRole('button', { name: 'Phát hành' }).click()
  await expect(tp.getByTestId('publish-private-warning')).toHaveCount(0)                 // kho phòng: không cảnh báo
  await tp.getByRole('button', { name: 'Xác nhận phát hành' }).click()
  await expect(tp.getByRole('heading', { name: `Chào hàng cơ bản ${s}` })).toBeVisible()
  await expect(tp.getByTestId('lesson-status')).toHaveText('Đã phát hành')
  const lessonUrl = tp.url()
  await tp.context().close()

  // Nhân viên dưới quyền: mở bài từ thư viện, đọc thẻ đúng phiên bản ghim, luyện tập
  const nv = await pageAs(browser, people.nv_part_kd)
  await nav(nv, 'Thư viện bài học').click()
  await expect(nv.getByRole('link', { name: '+ Bài học mới' })).toHaveCount(0)        // không phải người soạn
  await nv.getByRole('link', { name: `Chào hàng cơ bản ${s}` }).click()
  await expect(nv.getByRole('heading', { name: cardTitle })).toBeVisible()
  await expect(nv.getByText('bản 1', { exact: true })).toBeVisible()
  await expect(nv.getByRole('heading', { name: 'Vì sao cần học' })).toBeVisible()
  await nv.getByRole('button', { name: 'Luyện tập (2 câu)' }).click()

  const q1Box = nv.locator('.lrn-q', { hasText: 'Bước thứ hai khi chào hàng?' })
  await q1Box.getByRole('radio', { name: /Hỏi nhu cầu/ }).check()
  const q2Box = nv.locator('.lrn-q', { hasText: 'Những việc nên làm?' })
  await q2Box.getByRole('checkbox', { name: /Chào khách/ }).check()
  await q2Box.getByRole('checkbox', { name: /Hỏi nhu cầu/ }).check()
  await expect(nv.getByText('Giải thích:')).toHaveCount(0)                                 // chưa nộp: chưa lộ đáp án
  await nv.getByRole('button', { name: 'Nộp bài' }).click()
  await expect(nv.getByTestId('practice-score')).toHaveText('2/2')
  await expect(q1Box.getByText('Đúng', { exact: true })).toBeVisible()
  await expect(q1Box.getByText(/hỏi nhu cầu trước khi đề xuất/)).toBeVisible()

  // Làm lại: lượt mới, trả lời sai câu nhiều đáp án -> 1/2
  await nv.getByRole('button', { name: '↻ Làm lại' }).click()
  await expect(nv.getByRole('button', { name: 'Nộp bài' })).toBeVisible()                  // đề mới, chưa trả lời
  await expect(nv.getByTestId('practice-score')).toHaveCount(0)
  await nv.locator('.lrn-q', { hasText: 'Bước thứ hai khi chào hàng?' }).getByRole('radio', { name: /Hỏi nhu cầu/ }).check()
  await nv.locator('.lrn-q', { hasText: 'Những việc nên làm?' }).getByRole('checkbox', { name: /Chào khách/ }).check()
  await nv.getByRole('button', { name: 'Nộp bài' }).click()
  await expect(nv.getByTestId('practice-score')).toHaveText('1/2')
  await nv.getByRole('button', { name: 'Quay lại bài học' }).click()
  await expect(nv.getByRole('heading', { name: 'Các lần luyện tập của tôi' })).toBeVisible()
  await expect(nv.locator('.list-row', { hasText: '2/2' })).toBeVisible()
  await nv.context().close()

  // Người phòng khác không mở được bài học (không lộ sự tồn tại)
  const other = await pageAs(browser, people.nv_part_mkt)
  const lessonId = lessonUrl.split('/').pop()
  expect((await other.request.get(`/api/learn/lessons/${lessonId}`)).status()).toBe(404)
  await other.context().close()
})

// Lỗi QA đợt 2: B1 ô radio, B2 phát hành trong kho cá nhân, B3 bản sao bài người khác, B8 làm tiếp lượt luyện tập dở
test('QA: radio không chiếm cả dòng; cảnh báo kho cá nhân khi phát hành; bản sao bỏ câu không xem được; làm tiếp lượt dở', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const { people } = await seedOrg(page)
  const s = uid()
  const cardTitle = `Thẻ QA ${s}`
  const spaceName = `Kho phòng QA ${s}`

  const tp = await pageAs(browser, people.tp_part_kd)
  const space = await ok(await tp.request.post('/api/spaces', { data: { name: spaceName } }))
  await ok(await tp.request.post(`/api/spaces/${space.id}/members`, { data: { email: people.nv_part_kd.email, role: 'viewer' } }))
  await ok(await tp.request.post(`/api/spaces/${space.id}/members`, { data: { email: people.gd_part.email, role: 'viewer' } }))
  const card = await ok(await tp.request.post('/api/wiki/cards', { data: { space_id: space.id, type: 'concept', title: cardTitle, summary: 'Tóm tắt' } }))
  mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${card.id}') }, { $set: { status: 'approved' } })`)   // duyệt 2 người: review.spec.js
  // Hai câu hỏi nằm trong kho cá nhân của trưởng phòng (mặc định của form câu hỏi) — người soạn khác không xem được
  for (const [kind, stem, options] of [
    ['single', `Câu một đáp án ${s}?`, [{ text: 'Phương án đúng', correct: true }, { text: 'Phương án sai' }]],
    ['multi', `Câu nhiều đáp án ${s}?`, [{ text: 'Chọn A', correct: true }, { text: 'Chọn B' }]],
  ]) {
    const q = await ok(await tp.request.post('/api/learn/questions', { data: { kind, stem, options, card_ids: [card.id] } }))
    await ok(await tp.request.patch(`/api/learn/questions/${q.id}`, { data: { status: 'approved' } }))
  }

  // B1: form câu "Một đáp án" — radio nhỏ, ô nhập phương án đủ rộng
  await tp.goto('/learn/library?tab=questions')
  await tp.getByRole('button', { name: '+ Câu hỏi mới' }).click()
  const radioBox = await tp.getByLabel('Phương án 1 đúng').boundingBox()
  const inputBox = await tp.getByLabel('Phương án 1', { exact: true }).boundingBox()
  expect(radioBox.width).toBeLessThan(40)
  expect(inputBox.width).toBeGreaterThan(200)
  await tp.getByRole('button', { name: 'Huỷ' }).click()

  // B2: bài mới mặc định vào kho chia sẻ; chọn kho cá nhân thì có gợi ý + cảnh báo khi phát hành
  await tp.getByRole('tab', { name: 'Bài học', exact: true }).click()
  await tp.getByRole('link', { name: '+ Bài học mới' }).click()
  const spaceSelect = tp.getByLabel('Lưu vào kho')
  await expect(spaceSelect).toHaveValue(space.id)
  await expect(tp.getByTestId('lesson-private-hint')).toHaveCount(0)
  await tp.getByLabel('Tên bài học').fill(`Bài QA ${s}`)
  await tp.getByLabel('Thêm thẻ đã duyệt').fill(s)
  await tp.getByRole('button', { name: `+ ${cardTitle}` }).click()
  await tp.getByRole('checkbox', { name: new RegExp(`Câu một đáp án ${s}`) }).check()
  await tp.getByRole('checkbox', { name: new RegExp(`Câu nhiều đáp án ${s}`) }).check()
  await spaceSelect.selectOption({ label: `★ Kho của ${people.tp_part_kd.name} (cá nhân)` })
  await expect(tp.getByTestId('lesson-private-hint')).toBeVisible()
  await tp.getByRole('button', { name: 'Phát hành' }).click()
  await expect(tp.getByTestId('publish-private-warning')).toContainText('Bài trong kho cá nhân — chỉ bạn xem được; chuyển sang kho chia sẻ để giao cho nhân viên')
  await expect(tp.getByRole('button', { name: 'Vẫn phát hành (chỉ mình tôi xem)' })).toBeVisible()
  await tp.getByRole('button', { name: 'Quay lại' }).click()
  await spaceSelect.selectOption(space.id)
  await tp.getByRole('button', { name: 'Phát hành' }).click()
  await expect(tp.getByTestId('publish-private-warning')).toHaveCount(0)
  await tp.getByRole('button', { name: 'Xác nhận phát hành' }).click()
  await expect(tp.getByRole('heading', { name: `Bài QA ${s}` })).toBeVisible()
  await tp.context().close()

  // B3: giám đốc (người soạn khác) tạo bản sao — 2 câu luyện tập không xem được bị bỏ, lưu được
  const gd = await pageAs(browser, people.gd_part)
  await gd.goto('/learn/library')
  await gd.locator('.lrn-tile', { hasText: `Bài QA ${s}` }).getByRole('link', { name: 'Tạo bản sao' }).click()
  await expect(gd.getByTestId('copy-dropped')).toContainText('2 câu luyện tập bạn không xem được đã bị bỏ')
  await expect(gd.getByText('Câu luyện tập (0 đã chọn)')).toBeVisible()
  await gd.getByRole('button', { name: 'Lưu nháp' }).click()
  await expect(gd.locator('.lrn-tile', { hasText: `Bài QA ${s} (bản sao)` })).toBeVisible()
  await gd.context().close()

  // B8: nhân viên luyện tập, lưu nháp giữa chừng, rồi làm tiếp đúng lượt đó
  const nv = await pageAs(browser, people.nv_part_kd)
  await nv.goto('/learn/library')
  await nv.getByRole('link', { name: `Bài QA ${s}` }).click()
  await nv.getByRole('button', { name: 'Luyện tập (2 câu)' }).click()
  const single = nv.locator('.lrn-q', { hasText: `Câu một đáp án ${s}?` })
  const radio = single.getByRole('radio', { name: /Phương án đúng/ })
  expect((await radio.boundingBox()).width).toBeLessThan(40)                              // B1 ở màn làm bài
  await radio.check()
  await nv.getByRole('button', { name: 'Lưu nháp, làm tiếp sau' }).click()
  await expect(nv.locator('.list-row', { hasText: 'chưa nộp' })).toHaveCount(1)
  await nv.locator('.list-row', { hasText: 'chưa nộp' }).getByRole('button', { name: 'Làm tiếp' }).click()
  await expect(nv.getByText(/Đang làm tiếp lượt luyện tập chưa nộp/)).toBeVisible()
  await expect(nv.locator('.lrn-q', { hasText: `Câu một đáp án ${s}?` }).getByRole('radio', { name: /Phương án đúng/ })).toBeChecked()
  await nv.locator('.lrn-q', { hasText: `Câu nhiều đáp án ${s}?` }).getByRole('checkbox', { name: /Chọn A/ }).check()
  await nv.getByRole('button', { name: 'Nộp bài' }).click()
  await expect(nv.getByTestId('practice-score')).toHaveText('2/2')
  await nv.getByRole('button', { name: 'Quay lại bài học' }).click()
  await expect(nv.locator('.list-row', { hasText: 'chưa nộp' })).toHaveCount(0)            // không còn lượt dở treo
  await expect(nv.locator('.list-row')).toHaveCount(1)
  await nv.context().close()
})
