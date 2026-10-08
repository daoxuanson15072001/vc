// Khoá mẫu /learn (yêu cầu 6ab889cd…9949de — backend/app/learn/sample.py, scripts/seed_sample_course.py).
// Dữ liệu test: kho org "Kho video TikTok" + 17 thẻ đúng mã của khoá (nháp, tác giả là người khác) — chỉ trên DB e2e.
// Duyệt thẻ / câu hỏi là tài khoản test L&D bấm trên web (bốn mắt vẫn giữ: tác giả không tự duyệt).
// AI giả: meta `learn_ai_fake` (sinh câu, diễn giải, chấm tự luận) — không gọi Claude / AI local.
import { spawnSync } from 'node:child_process'
import { test, expect, uid, createUser, pageAs, mongo } from './fixtures'
import { E2E_DB_NAME } from './slot.js'

const KEY = 'nvkd-b2b-v1'
const TITLE = 'Kỹ năng bán hàng B2B cho NVKD mới'
const GRADED = [
  '6ab4ba0fb1c921b0a784dc0d', '6ab4ba4ab1c921b0a784dc21', '6ab4ba29b1c921b0a784dc18', '6ab4baa0b1c921b0a784dc39',
  '6ab4b978b1c921b0a784dbe9', '6ab4ba40b1c921b0a784dc1f', '6ab4b9dab1c921b0a784dc01', '6ab4b9a8b1c921b0a784dbf4',
  '6ab4b9beb1c921b0a784dbfa', '6ab4b9c3b1c921b0a784dbfb', '6ab4ba12b1c921b0a784dc0f', '6ab4ba4cb1c921b0a784dc22',
  '6ab4b975b1c921b0a784dbe7', '6ab4ba5ab1c921b0a784dc23', '6ab4b98ab1c921b0a784dbed', '6ab4ba06b1c921b0a784dc0b',
]
const READING = '6ab4b9d9b1c921b0a784dbff'
const IDS = `[${[...GRADED, READING].map((i) => `ObjectId('${i}')`).join(', ')}]`

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

function seed(email) {
  const r = spawnSync('../.venv/bin/python', ['scripts/seed_sample_course.py', '--as', email], {
    cwd: '../backend', encoding: 'utf8', env: { ...process.env, MONGO_DB: E2E_DB_NAME, ANTHROPIC_API_KEY: '' },
  })
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` }
}

test('khoá mẫu: duyệt thẻ → seed → duyệt câu → NV tự ghi danh, học, thi, quản lý chốt → Đạt', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const s = uid()
  const pw = 'mat-khau-e2e'
  const mk = async (key, name) => {
    const u = { name: `${name} ${s}`, email: `${key}.${s}@e2e.test`, password: pw }
    return { ...u, id: (await createUser(page, u)).id }
  }
  await page.goto('/')
  const author = await mk('tac-gia', 'Tác giả')
  const lnd = await mk('lnd', 'L&D')
  const nv = await mk('nv', 'NV kinh doanh')
  await ok(await page.request.put('/api/wiki/review-settings', { data: { min_approvers: 1 } }))
  mongo(`
    db.meta.updateOne({ _id: 'learn_ai_fake' }, { $set: { on: true } }, { upsert: true })
    db.grants.insertOne({ user_id: ObjectId('${lnd.id}'), role: 'lnd', scope: { unit_id: null, category: null, function: null },
      delegated_from: null, valid_from: null, valid_to: null, created_by: null })
    const sp = db.spaces.insertOne({ name: 'Kho video TikTok', description: '', type: 'shared', owner_id: ObjectId('${lnd.id}'),
      visibility: 'org', created_at: new Date(), members: [{ user_id: ObjectId('${lnd.id}'), role: 'owner' }] }).insertedId
    const lessonType = ['6ab4b975b1c921b0a784dbe7', '${READING}']
    for (const id of [...${JSON.stringify(GRADED)}, '${READING}']) {
      db.wiki_cards.insertOne({ _id: ObjectId(id), space_id: sp, title: 'Thẻ ' + id.slice(-4), summary: 'Tóm tắt ' + id.slice(-4),
        type: lessonType.includes(id) ? 'lesson' : id === '6ab4ba06b1c921b0a784dc0b' ? 'checklist' : 'framework',
        key_points: ['Ý một', 'Ý hai'], body: 'Nội dung', status: 'draft', origin: 'manual',
        created_by: ObjectId('${author.id}'), categories: [], created_at: new Date(), updated_at: new Date() })
    }`)

  try {
    // 1) L&D mở /learn: khoá mẫu chờ duyệt 16 thẻ → bấm tới tab Duyệt hàng loạt đã lọc sẵn → duyệt
    const l = await pageAs(browser, lnd)
    await l.goto('/learn')
    await expect(l.getByTestId('sample-pending')).toContainText('Khoá mẫu chờ duyệt 16 thẻ, 0 câu')
    await l.getByRole('link', { name: 'Duyệt 16 thẻ' }).click()
    await expect(l).toHaveURL(/tab=bulk&ids=/)
    // link gộp cả thẻ đọc thêm chưa duyệt: 16 thẻ tính điểm + 1
    await l.getByRole('button', { name: 'Duyệt 17 thẻ' }).click()
    await expect(l.getByTestId('toast').filter({ hasText: 'Đã duyệt' })).toContainText('Đã duyệt 17 thẻ')   // SCR-09: kết quả qua toast
    // tác giả không tự duyệt được (bốn mắt) — thẻ đã duyệt bởi L&D
    expect(mongo(`db.wiki_cards.countDocuments({ _id: { $in: ${IDS} }, status: 'approved' })`).trim()).toBe('17')

    // 2) seed: dựng bài học + câu nháp, dừng chờ duyệt câu (mã 3), không tự duyệt câu nào
    let r = seed(lnd.email)
    expect(r.code, r.out).toBe(3)
    expect(r.out).toContain(`/learn/library?tab=questions&sample=${KEY}&status=draft`)
    expect(mongo(`db.questions.countDocuments({ sample_key: '${KEY}', status: 'approved' })`).trim()).toBe('0')

    // 3) L&D duyệt 34 câu ở ngân hàng câu hỏi đã lọc theo khoá
    await l.goto('/learn')
    await expect(l.getByTestId('sample-pending')).toContainText('chờ duyệt 0 thẻ, 34 câu')
    await l.getByRole('link', { name: 'Duyệt 34 câu hỏi' }).click()
    await expect(l.getByText(`Khoá mẫu: ${KEY}`)).toBeVisible()
    await l.getByLabel('Chọn mọi câu chưa duyệt').check()
    await l.getByRole('button', { name: 'Duyệt đã chọn (34)' }).click()
    await expect(l.getByText('Không còn câu nào khớp bộ lọc của khoá mẫu.')).toBeVisible({ timeout: 30_000 })

    // 4) seed lần 2: phát hành + ghi danh L&D; lần 3 không tạo trùng
    r = seed(lnd.email)
    expect(r.code, r.out).toBe(0)
    r = seed(lnd.email)
    expect(r.code, r.out).toBe(0)
    expect(mongo(`db.learning_paths.countDocuments({ sample_key: '${KEY}' })`).trim()).toBe('1')

    // 5) NV (không là thành viên kho) mở /learn ở 375 px: thấy khoá mẫu → ghi danh → Bắt đầu → bài 1
    const n = await pageAs(browser, nv)
    await n.setViewportSize({ width: 375, height: 800 })
    await n.goto('/learn')
    const item = n.getByTestId('catalog-item')
    await expect(item).toContainText(TITLE)
    await expect(item).toContainText('Khoá mẫu')
    await expect(item).toContainText('4 tuần · 8 bài')
    await item.getByRole('button', { name: 'Ghi danh' }).click()
    await expect(n.getByTestId('toast').filter({ hasText: 'Đã ghi danh' })).toBeVisible()   // SCR-15: phản hồi bằng toast
    const card = n.getByTestId('assignment')
    await expect(card).toContainText('4 tuần · 8 bài')
    await expect(card).toContainText('tự ghi danh')
    await card.getByRole('link', { name: 'Bắt đầu' }).click()
    await expect(n.getByRole('heading', { name: 'Bài 1: Tư thế người bán' })).toBeVisible()
    await expect(n.getByText('6ab4ba0fb1c921b0a784dc0d').first()).toBeVisible()          // trích mã thẻ + phiên bản
    const noScroll = await n.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    expect(noScroll).toBeTruthy()

    // học 8 bài + luyện tập (API của chính người học)
    const me = await ok(await n.request.get('/api/learn/me'))
    const a = me.months[0].items[0]
    for (const m of a.modules) {
      for (const ls of m.lessons) {
        const lesson = await ok(await n.request.get(`/api/learn/lessons/${ls.id}`))
        expect(lesson.items.every((i) => !i.unavailable)).toBeTruthy()
        const att = await ok(await n.request.post(`/api/learn/lessons/${ls.id}/practice`))
        await ok(await n.request.post(`/api/learn/attempts/${att.id}/submit`, { data: { answers: {} } }))
      }
    }
    await n.goto('/learn')
    await expect(n.getByTestId('assignment')).toContainText('Bài học 8/8')

    // 6) thi: 15 TN + 2 TL, 30 phút; trả lời đúng trắc nghiệm, tự luận có nội dung
    const ex = await ok(await n.request.post(`/api/learn/assignments/${a.id}/attempts`, { data: { kind: 'exam' } }))
    expect(ex.paper.filter((q) => q.kind !== 'essay')).toHaveLength(15)
    expect(ex.paper.filter((q) => q.kind === 'essay')).toHaveLength(2)
    const right = JSON.parse(mongo(`JSON.stringify(db.questions.find({ sample_key: '${KEY}' }).toArray()
      .map((q) => [q._id.toString(), (q.options || []).filter((o) => o.correct).map((o) => o.text)]))`))
    const truth = Object.fromEntries(right)
    const answers = {}
    for (const q of ex.paper) {
      if (q.kind === 'essay') { answers[q.question_id] = 'Nghe hết và tóm lại, hỏi lý do thật, đưa giá trị: hoá đơn, bảo hành.'; continue }
      const keys = q.options.filter((o) => truth[q.question_id].includes(o.text)).map((o) => o.key)
      answers[q.question_id] = q.kind === 'single' ? keys[0] : keys
    }
    await ok(await n.request.post(`/api/learn/attempts/${ex.id}/submit`, { data: { answers } }))

    // 7) người tạo khoá (L&D) chốt có nhận xét, giữ điểm AI gợi ý
    let graded
    await expect.poll(async () => {
      graded = await ok(await l.request.get(`/api/learn/attempts/${ex.id}`))
      return graded.grading?.ai_status
    }, { timeout: 20_000 }).toBe('done')
    await ok(await l.request.post(`/api/learn/attempts/${ex.id}/finalize`, { data: {
      feedback: 'Nắm được 3 bước xử lý phản đối, nên thêm ví dụ về bảo hành.',
      scores: graded.grading.ai_grading.map((g) => ({ question_id: g.question_id, score: g.score })) } }))
    await n.goto('/learn?tab=done')
    await expect(n.getByTestId('assignment')).toContainText('Đạt')
  } finally {
    await page.request.put('/api/wiki/review-settings', { data: { min_approvers: 2 } })
    // dọn sạch: thẻ org-visible của khoá mẫu không được lọt sang các spec đếm thẻ chạy sau (wiki, playlists…)
    mongo(`
      db.meta.deleteOne({ _id: 'learn_ai_fake' })
      const p = db.learning_paths.findOne({ sample_key: '${KEY}' })
      if (p) {
        const aids = db.assignments.find({ path_id: p._id }).toArray().map((a) => a._id)
        db.attempts.deleteMany({ assignment_id: { $in: aids } })
        db.assignments.deleteMany({ path_id: p._id })
        db.learning_paths.deleteOne({ _id: p._id })
      }
      const lids = db.lessons.find({ sample_key: '${KEY}' }).toArray().map((l) => l._id)
      db.attempts.deleteMany({ lesson_id: { $in: lids } })
      db.lessons.deleteMany({ sample_key: '${KEY}' })
      db.questions.deleteMany({ sample_key: '${KEY}' })
      db.change_requests.deleteMany({ card_id: { $in: ${IDS} } })
      db.card_revisions.deleteMany({ card_id: { $in: ${IDS} } })
      db.card_embeddings.deleteMany({ card_id: { $in: ${IDS} } })
      db.wiki_cards.deleteMany({ _id: { $in: ${IDS} } })
      db.spaces.deleteMany({ name: 'Kho video TikTok', owner_id: ObjectId('${lnd.id}') })`)
  }
})
