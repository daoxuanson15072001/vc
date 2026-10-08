// Đăng Facebook (BA 5.14): kết nối Fanpage bằng token, đăng ngay lên Fanpage, đăng hỗ trợ vào nhóm rồi dán link.
// Graph API là máy chủ giả trên cổng FB_FAKE_PORT (playwright.config đặt FB_GRAPH_URL cho BE) — không gọi Facebook thật.
import http from 'node:http'
import { test, expect, mongo, uid } from './fixtures'
import { FB_FAKE_PORT } from './slot.js'

const PAGE_TOKEN = 'EAAPAGE' + 'x'.repeat(30)
let server
const calls = []

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const path = new URL(req.url, 'http://x').pathname.replace(/^\/v[\d.]+\//, '')
      calls.push(`${req.method} ${path}`)
      const reply = path === 'me' ? { id: '111', name: 'VC Garage E2E', metadata: { type: 'page' } }
        : path.endsWith('/feed') ? { id: '111_555' }
          : path.endsWith('/comments') ? { id: 'c1' } : { id: path, name: 'VC Garage E2E' }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(reply))
    })
  })
  await new Promise((ok) => server.listen(FB_FAKE_PORT, '127.0.0.1', ok))
})
test.afterAll(() => server?.close())

async function approvedPost(page, channel) {
  const res = await page.request.post('/api/studio/quick', { data: { type: 'fb_post', inputs: { topic: `Má phanh ${uid()}`, channel } } })
  const p = await res.json()
  const content = {
    channel, author: '', title: 'Má phanh', body: 'Thân bài thử đăng.', hooks: ['Phanh kêu ken két là đã muộn.'], cta: 'Nhắn tin',
    hashtags: ['#VCGarage'], visual: { type: 'ảnh', description: '', slides: [] }, first_comment: 'Đặt lịch tại đây',
    link_placement: 'bình luận đầu', best_time: '20:00', sources: { refs: [], cards: [], notes: '' }, facts_to_verify: [],
  }
  mongo(`db.studio_quick.updateOne({_id: ObjectId("${p.id}")}, {$set: {status: "done", review_status: "approved", content: ${JSON.stringify(content)}}})`)
  return p
}

test('kết nối Fanpage, đăng ngay kèm bình luận đầu; nhóm đăng hỗ trợ rồi dán link', async ({ page, context }) => {
  await page.goto('/studio/facebook')
  await expect(page.getByRole('heading', { name: 'Kênh Facebook', level: 1 })).toBeVisible()
  const connect = page.getByTestId('fb-connect-page')
  await connect.getByLabel(/Access token/).fill(PAGE_TOKEN)
  await connect.getByRole('button', { name: 'Kết nối' }).click()
  await expect(page.getByTestId('fb-target-card').filter({ hasText: 'VC Garage E2E' })).toContainText('Đăng tự động')

  const manual = page.getByTestId('fb-add-manual')
  await manual.getByLabel('Tên *').fill('Hội chủ xe E2E')
  await manual.getByLabel(/Link nhóm/).fill('https://www.facebook.com/groups/hoichuxe')
  await manual.getByRole('button', { name: 'Thêm' }).click()
  await expect(page.getByTestId('fb-target-card').filter({ hasText: 'Hội chủ xe E2E' })).toContainText('Đăng hỗ trợ')

  // Fanpage: đăng ngay
  const p = await approvedPost(page, 'fanpage')
  await page.goto(`/studio/quick/${p.id}`)
  const box = page.getByTestId('fb-publish')
  await box.getByTestId('fb-publish-open').click()
  await expect(box.getByTestId('fb-target')).toHaveValue(/.+/)
  await expect(box.getByTestId('fb-message')).toHaveValue(/Phanh kêu ken két[\s\S]*#VCGarage/)
  await box.getByTestId('fb-publish-submit').click()
  const pub = box.getByTestId('fb-publication').first()
  await expect(pub).toHaveAttribute('data-status', 'published')
  await expect(pub.getByRole('link', { name: /Xem bài/ })).toHaveAttribute('href', 'https://www.facebook.com/111_555')
  expect(calls).toContain('POST 111/feed')
  expect(calls).toContain('POST 111_555/comments')

  // Nhóm: chép bài + mở nhóm ở tab mới, dán link bài đã đăng
  const g = await approvedPost(page, 'fb_group')
  await page.goto(`/studio/quick/${g.id}`)
  const gbox = page.getByTestId('fb-publish')
  await gbox.getByTestId('fb-publish-open').click()
  await expect(gbox.getByTestId('fb-target').locator('option:checked')).toHaveText(/Hội chủ xe E2E/)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await context.route('https://www.facebook.com/**', (r) => r.fulfill({ body: 'Facebook giả' }))   // không mở Facebook thật
  const [tab] = await Promise.all([context.waitForEvent('page'), gbox.getByTestId('fb-publish-submit').click()])
  await tab.waitForURL(/facebook\.com\/groups\/hoichuxe/)
  await tab.close()
  const steps = gbox.getByTestId('fb-manual-steps')
  await steps.getByLabel('Link bài đã đăng').fill('https://www.facebook.com/groups/hoichuxe/posts/123')
  await steps.getByRole('button', { name: 'Xác nhận đã đăng' }).click()
  await expect(gbox.getByTestId('fb-publication').first()).toHaveAttribute('data-status', 'published')
  expect(calls.filter((c) => c.includes('hoichuxe'))).toEqual([])   // nhóm không đi qua Graph API
})
