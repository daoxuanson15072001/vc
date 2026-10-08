// Chạy trước mọi test: DB trống -> đi qua màn "Tạo tài khoản quản trị" lần đầu, lưu phiên admin, nạp video mẫu.
import { test as setup, expect } from '@playwright/test'
import { ADMIN, E2E_OUT, mongo } from './fixtures'

setup('lần chạy đầu: tạo tài khoản quản trị qua giao diện', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản quản trị' })).toBeVisible()

  await page.getByLabel('Họ tên').fill(ADMIN.name)
  await page.getByLabel('Email').fill(ADMIN.email)
  // Mật khẩu ngắn bị trình duyệt chặn (minLength=8) -> vẫn ở màn tạo tài khoản
  await page.getByLabel('Mật khẩu').fill('1234')
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản quản trị' })).toBeVisible()

  await page.getByLabel('Mật khẩu').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
  await expect(page.getByRole('heading', { name: 'Việc của tôi' })).toBeVisible()
  await expect(page.locator('.userbox')).toContainText(ADMIN.name)

  await page.context().storageState({ path: `${E2E_OUT}/admin.json` })
})

setup('nạp video mẫu vào DB test', async () => {
  // Giống document do worker ghi ra (xem backend/app/db.py video_doc_from_record + upsert_video)
  mongo(`
    const now = new Date()
    const v = (id, handle, caption, transcript, views, status, posted) => ({
      _id: id, url: 'https://www.tiktok.com/@' + handle + '/video/' + id,
      channel_handle: handle, channel_name: handle.toUpperCase(), posted_at: new Date(posted),
      duration: 60, views, likes: Math.round(views / 10), comments: 5, shares: 2,
      caption, transcript, status, error: status === 'error' ? 'Không tải được video' : null,
      chars_per_sec: transcript ? +(transcript.length / 60).toFixed(1) : null,
      segments: transcript ? [{ start: 0, end: 5, text: transcript.slice(0, 40) }] : [],
      tags: [], note: '', edited: false, created_at: now, updated_at: now, transcribed_at: now,
      engine: 'mlx', model: 'e2e',
      search_text: (transcript + ' ' + caption).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(),
    })
    db.videos.insertMany([
      v('7000000000000000001', 'kenh_a', 'Mẹo bán hàng online', 'Hôm nay mình chia sẻ cách chốt đơn nhanh gấp đôi', 150000, 'ok', '2026-09-01'),
      v('7000000000000000002', 'kenh_a', 'Nhạc nền chill', '', 42000, 'no_speech', '2026-09-05'),
      v('7000000000000000003', 'kenh_b', 'Review phụ tùng xe', 'Phụ tùng chính hãng giúp xe bền hơn và tiết kiệm chi phí', 980000, 'ok', '2026-09-10'),
      v('7000000000000000004', 'kenh_b', 'Video bị lỗi', '', 0, 'error', '2026-09-12'),
    ])
  `)
})
