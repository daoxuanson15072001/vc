// Quay video hướng dẫn "Tạo một khoá học từ A đến Z" cho trang /guide#tao-khoa-hoc (không phải test hồi quy).
// Chạy riêng khi cần làm lại video:   RECORD_GUIDE=1 E2E_SLOT=9 npx playwright test video-tao-khoa-hoc
// Kết quả: output/huong-dan/tao-khoa-hoc.webm (đổi sang .mp4 bằng ffmpeg nếu cần). Bấm chậm (slowMo) + chú thích
// từng bước chèn lên góc màn hình để người xem theo kịp. Dữ liệu: cây tổ chức mẫu (seedOrg) trên DB e2e.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, seedOrg, uid, mongo, login } from './fixtures'

test.skip(!process.env.RECORD_GUIDE, 'Chỉ chạy khi RECORD_GUIDE=1 (quay video hướng dẫn)')
test.use({ launchOptions: { slowMo: 350 }, actionTimeout: 15_000 })

const OUT_DIR = path.resolve('../output/huong-dan')
const SIZE = { width: 1280, height: 800 }

async function ok(res) {
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

// Chú thích bước hiện đáy màn hình (không bắt chuột để không che nút); giữ qua điều hướng trong app (SPA), gọi lại sau mỗi goto
const say = async (page, text, ms = 1800) => {
  await page.evaluate((t) => {
    let el = document.getElementById('guide-caption')
    if (!el) {
      el = document.createElement('div')
      el.id = 'guide-caption'
      el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:99999;max-width:900px;pointer-events:none;background:#111827;color:#fff;'
        + 'padding:10px 14px;border-radius:10px;font:600 15px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.35)'
      document.body.appendChild(el)
    }
    el.textContent = t
  }, text)
  await page.waitForTimeout(ms)
}
const pause = (page, ms = 900) => page.waitForTimeout(ms)

test('quay video: trưởng phòng tạo câu hỏi → bài học → lộ trình → phát hành → giao; nhân viên thấy khoá', async ({ page, browser }) => {
  test.setTimeout(600_000)
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const { people } = await seedOrg(page)
  const s = uid()
  const tp = people.tp_part_kd
  const nv = people.nv_part_kd

  // Chuẩn bị bằng API (không quay): kho chia sẻ công khai + 4 thẻ đã duyệt (duyệt thẻ có mục riêng trong hướng dẫn)
  // phiên trống (không kế thừa storageState admin của cấu hình) rồi đăng nhập trưởng phòng
  const prep = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const pp = await prep.newPage()
  await login(pp, tp)
  const space = await ok(await pp.request.post('/api/spaces', { data: { name: 'Đào tạo Kinh doanh', visibility: 'org' } }))
  const cards = []
  const mk = async (type, title, summary, key_points) => {
    const c = await ok(await pp.request.post('/api/wiki/cards', { data: { space_id: space.id, type, title, summary, key_points,
      categories: ['ban-hang-cskh'], level: 'thuc-thi', division: ['vcpart'] } }))
    mongo(`db.wiki_cards.updateOne({ _id: ObjectId('${c.id}') }, { $set: { status: 'approved', current_revision: 1 } })`)
    cards.push({ ...c, title })
  }
  await mk('framework', 'Ba bước chào hàng chủ gara', 'Chào hỏi — hỏi nhu cầu — đề xuất phù hợp.', ['Không báo giá trước khi hiểu nhu cầu', 'Đề xuất theo vấn đề khách nêu'])
  await mk('checklist', 'Chuẩn bị trước cuộc gặp', 'Kiểm 5 điều trước khi gặp khách.', ['Tra lịch sử mua', 'Mang bảng giá mới', 'Chuẩn bị 2 câu hỏi mở'])
  await mk('sop', 'Xử lý khách chê giá', 'Nghe hết — tìm lý do thật — đưa giá trị để khách tự so sánh.', ['Không giảm giá ngay', 'Nêu hoá đơn, bảo hành, độ bền'])
  await mk('concept', 'Khách hàng B2B là ai', 'Người mua cho gara, quyết định theo lợi nhuận và dòng tiền.', ['Mua lặp lại', 'Cần hoá đơn và công nợ'])
  await prep.close()

  // Quay: một phiên duy nhất, đăng nhập trưởng phòng
  const ctx = await browser.newContext({ recordVideo: { dir: OUT_DIR, size: SIZE }, viewport: SIZE, locale: 'vi-VN', storageState: { cookies: [], origins: [] } })
  const p = await ctx.newPage()
  p.on('dialog', (d) => d.accept())
  await p.goto('/')
  await say(p, 'Hướng dẫn: tạo một khoá học từ A đến Z — đăng nhập bằng tài khoản quản lý (có nhân viên dưới quyền)')
  await p.getByLabel('Email').fill(tp.email)
  await p.getByLabel('Mật khẩu').fill(tp.password)
  await p.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(p.locator('.sidebar')).toBeVisible()
  await say(p, 'Bước 0 — Có quyền soạn thì menu trái có "Thiết kế lộ trình" và "Lộ trình học"', 2500)

  // Bước 3 — câu hỏi
  await p.locator('.sidebar nav').getByRole('link', { name: 'Thư viện bài học' }).click()
  await say(p, 'Bước 3 — Soạn câu hỏi: Thư viện bài học → tab "Ngân hàng câu hỏi"')
  await p.getByRole('tab', { name: 'Ngân hàng câu hỏi' }).click()
  await pause(p)
  const questions = [
    { card: cards[0], stem: 'Trong ba bước chào hàng chủ gara, bước thứ hai là gì?', opts: ['Hỏi nhu cầu', 'Báo giá ngay', 'Gửi catalogue', 'Xin số điện thoại'], right: 0, why: 'Thẻ "Ba bước chào hàng": chào hỏi → hỏi nhu cầu → đề xuất.' },
    { card: cards[0], stem: 'Khi nào nên đề xuất sản phẩm cho chủ gara?', opts: ['Ngay khi gặp', 'Sau khi hiểu nhu cầu', 'Khi khách hỏi giá', 'Cuối tháng'], right: 1, why: 'Đề xuất theo vấn đề khách nêu, sau khi hỏi nhu cầu.' },
    { card: cards[1], stem: 'Điều nào cần chuẩn bị trước cuộc gặp khách?', opts: ['Tra lịch sử mua của gara', 'Đặt lịch nghỉ phép', 'In hợp đồng mẫu 20 trang', 'Không cần chuẩn bị'], right: 0, why: 'Checklist "Chuẩn bị trước cuộc gặp": tra lịch sử mua, bảng giá mới, 2 câu hỏi mở.' },
    { card: cards[2], stem: 'Khách chê giá đắt hơn 30%, việc đầu tiên nên làm là gì?', opts: ['Giảm giá ngay', 'Nghe hết và tóm lại ý khách', 'Cãi lại', 'Bỏ đi'], right: 1, why: 'SOP: nghe hết → tìm lý do thật → đưa giá trị.' },
    { card: cards[3], stem: 'Khách hàng B2B của VCpart quyết định mua chủ yếu theo gì?', opts: ['Sở thích cá nhân', 'Lợi nhuận và dòng tiền của gara', 'Quảng cáo TikTok', 'Màu bao bì'], right: 1, why: 'Khái niệm "Khách hàng B2B": mua cho gara, theo lợi nhuận và dòng tiền.' },
  ]
  for (const [i, q] of questions.entries()) {
    await p.getByRole('button', { name: '+ Câu hỏi mới' }).click()
    if (i === 0) await say(p, '"+ Câu hỏi mới": chọn Loại câu, Độ khó, kho lưu; điền Đề bài, Phương án, đánh dấu đáp án đúng, Giải thích, Thẻ căn cứ')
    await p.getByLabel('Loại câu').selectOption('single')
    await p.getByLabel('Độ khó (1–5)').selectOption('2')
    await p.getByLabel('Lưu vào kho').selectOption({ label: 'Đào tạo Kinh doanh (chia sẻ)' })
    await p.getByLabel(/Đề bài/).fill(q.stem)
    for (const [j, t] of q.opts.entries()) await p.getByLabel(`Phương án ${j + 1}`, { exact: true }).fill(t)
    await p.getByLabel(`Phương án ${q.right + 1} đúng`).check()
    await p.getByLabel(/Giải thích/).fill(q.why)
    await p.getByLabel('Gắn thẻ căn cứ').fill(q.card.title.slice(0, 12))
    await p.getByRole('button', { name: `+ ${q.card.title}` }).click()
    if (i === 0) await say(p, 'Gõ tên thẻ vào ô "Gắn thẻ căn cứ" rồi bấm chip "+ tên thẻ" → "Lưu và duyệt"')
    await p.getByRole('button', { name: 'Lưu và duyệt' }).click()
    await expect(p.locator('.lrn-qrow', { hasText: q.stem })).toBeVisible()
  }
  await say(p, `Đã có ${questions.length} câu "Đã duyệt" — đủ cho đề thi 5 câu`, 2200)

  // Bước 4 — bài học
  await p.getByRole('tab', { name: 'Bài học', exact: true }).click()
  await say(p, 'Bước 4 — Soạn bài học: tab "Bài học" → "+ Bài học mới"')
  const lessons = [
    { title: 'Tuần 1 — Hiểu khách và chuẩn bị', cards: [cards[3], cards[1]], goal: 'Kể được 3 điều cần chuẩn bị trước khi gặp chủ gara', qs: [questions[2], questions[4]] },
    { title: 'Tuần 2 — Chào hàng và xử lý chê giá', cards: [cards[0], cards[2]], goal: 'Chào hàng đúng 3 bước và trả lời khách chê giá không giảm giá ngay', qs: [questions[0], questions[1], questions[3]] },
  ]
  for (const [i, l] of lessons.entries()) {
    await p.getByRole('link', { name: '+ Bài học mới' }).click()
    await p.getByLabel(/Tên bài học/).fill(l.title)
    await p.getByLabel('Lưu vào kho').selectOption({ label: 'Đào tạo Kinh doanh (chia sẻ)' })
    await p.getByLabel('Mục tiêu (mỗi dòng một mục tiêu)').fill(l.goal)
    for (const c of l.cards) {
      await p.getByLabel('Thêm thẻ đã duyệt').fill(c.title.slice(0, 12))
      await p.getByRole('button', { name: `+ ${c.title}` }).click()
    }
    if (i === 0) await say(p, 'Thêm thẻ bằng ô "Thêm thẻ đã duyệt — gõ để tìm" → bấm chip; sắp thứ tự bằng ↑ ↓')
    await p.getByLabel('Diễn giải').fill(`## Vì sao cần học\nBài này nối các thẻ thành một mạch: ${l.cards.map((c) => c.title).join(' → ')}.\n\nĐọc từng thẻ rồi làm câu luyện tập bên dưới.`)
    for (const q of l.qs) await p.locator('.lrn-qpick label', { hasText: q.stem }).getByRole('checkbox').check()
    if (i === 0) await say(p, 'Tick "Câu luyện tập" thuộc thẻ trong bài → "Phát hành" → "Xác nhận phát hành"')
    await p.getByRole('button', { name: 'Phát hành' }).click()
    await p.getByRole('button', { name: 'Xác nhận phát hành' }).click()
    await expect(p.getByRole('heading', { name: l.title })).toBeVisible()
    if (i === 0) await say(p, 'Bài đã phát hành: thẻ ghim đúng phiên bản, nút "✎ Luyện tập" cho người học', 2200)
    await p.locator('.sidebar nav').getByRole('link', { name: 'Thư viện bài học' }).click()
  }

  // Bước 5 — lộ trình
  await p.locator('.sidebar nav').getByRole('link', { name: 'Lộ trình học' }).click()
  await say(p, 'Bước 5 — Dựng lộ trình (khoá học): Lộ trình học → "+ Lộ trình mới"')
  await p.getByRole('button', { name: '+ Lộ trình mới' }).click()
  await p.getByRole('menuitem', { name: 'Lộ trình trống' }).click()
  await p.getByLabel('Tên lộ trình').fill('Kỹ năng bán hàng B2B cho NVKD mới')
  await p.getByLabel('Kỳ').selectOption('month')
  await p.getByRole('button', { name: 'Tạo bản nháp' }).click()
  await expect(p.getByTestId('path-editor')).toBeVisible()
  await say(p, 'Màn "Sửa bản nháp": mô tả, các tuần → bài học, bài thi cuối kỳ')
  await p.getByLabel('Mô tả / mục tiêu sau kỳ').fill('Sau 2 tuần tự chuẩn bị cuộc gặp, chào hàng đúng 3 bước và xử lý khách chê giá.')
  for (const [i, l] of lessons.entries()) {
    await p.getByRole('button', { name: '+ Thêm tuần' }).click()
    await p.getByLabel('Chủ đề tuần').nth(i).fill(l.title.split('— ')[1])
    await p.getByLabel(`Thêm bài học vào tuần ${i + 1}`).selectOption({ label: l.title })
    await p.locator('.lrn-week').nth(i).getByRole('checkbox', { name: 'bắt buộc' }).check()
  }
  await say(p, '"+ Thêm tuần" → Chủ đề tuần → chọn bài ở "+ Thêm bài học…" → tick "bắt buộc"')
  await p.getByRole('tab', { name: 'Đề thi' }).click()
  await p.getByRole('checkbox', { name: /Có bài thi/ }).check()
  await say(p, 'Tick "Có bài thi": thời gian, điểm đạt 70%, số lượt, nguồn câu hỏi; ma trận đề = loại câu × số câu')
  await p.getByLabel('Thời gian (phút)').fill('30')
  await p.getByLabel('Loại câu dòng 1').selectOption('single')
  await p.getByLabel('Số câu dòng 1').fill('5')
  await p.getByRole('button', { name: 'Lưu nháp' }).click()
  await pause(p)
  await say(p, '"Lưu nháp" rồi "Phát hành" — phát hành xong nội dung bị khoá')
  await p.getByRole('button', { name: 'Phát hành' }).click()
  await expect(p.locator('.ui-ph').getByText('Đã phát hành')).toBeVisible()
  await say(p, 'Bước 6 — Giao: tick người trong cây dưới quyền → Hạn hoàn thành → "Giao"', 2200)
  await p.getByRole('checkbox', { name: new RegExp(nv.name) }).check()
  const due = new Date(Date.now() + 21 * 86400e3).toLocaleDateString('sv-SE')
  await p.getByLabel('Hạn hoàn thành').fill(due)
  await p.getByRole('button', { name: 'Giao', exact: true }).click()
  await expect(p.getByTestId('toast').filter({ hasText: 'Đã giao 1 người' })).toBeVisible()
  await say(p, 'Đã giao 1 người — bảng "Tiến độ người học" theo dõi trạng thái, hạn, điểm thi', 2500)
  const pathUrl = p.url()

  // Nhân viên thấy khoá
  await p.request.post('/api/auth/logout')
  await p.goto('/')
  await say(p, 'Về phía người học: đăng nhập tài khoản nhân viên được giao')
  await p.getByLabel('Email').fill(nv.email)
  await p.getByLabel('Mật khẩu').fill(nv.password)
  await p.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(p.locator('.sidebar')).toBeVisible()
  await p.locator('.sidebar nav').getByRole('link', { name: 'Học tập của tôi' }).click()
  await expect(p.getByTestId('assignment').filter({ hasText: 'Kỹ năng bán hàng B2B' })).toBeVisible()
  await say(p, '"Học tập của tôi": khoá được giao, hạn, tiến độ, nút "Bắt đầu" mở bài đầu tiên, khu "Bài thi cuối kỳ"', 2600)
  await p.getByRole('link', { name: 'Bắt đầu' }).click()
  await expect(p.getByRole('button', { name: /Luyện tập/ })).toBeVisible()
  await say(p, 'Bài học: đọc thẻ đã ghim, bấm "✎ Luyện tập". Hết video — chi tiết chữ ở Hướng dẫn sử dụng → "Tạo một khoá học từ A đến Z"', 3200)

  const video = p.video()
  await ctx.close()
  const src = await video.path()
  fs.copyFileSync(src, path.join(OUT_DIR, 'tao-khoa-hoc.webm'))
  fs.writeFileSync(path.join(OUT_DIR, 'tao-khoa-hoc.txt'), `Lộ trình mẫu trong video: ${pathUrl}\nQuay ${new Date().toISOString()}\n`)
})
