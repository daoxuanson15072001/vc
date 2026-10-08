// Video lỗi trong kênh: khung "Video lỗi" (menu Thao tác ▾ → Xem video lỗi mọi kênh, ?failed=1: nhóm lỗi, số lần lỗi,
// lịch sử), chi tiết kênh "Chỉ hiện video lỗi", "Chạy tiếp tất cả nguồn đang lọc" xếp lấy lại chữ các video lỗi chưa đủ 3 lần.
import { confirmDialog, expect, manualConfirm, mongo, test, uid } from './fixtures.js'

test('video lỗi: lọc theo nhóm lỗi, lịch sử lỗi, chạy tiếp tất cả xếp lấy lại chữ', async ({ page }) => {
  const id = uid()
  await page.request.get('/api/spaces')
  const src = mongo(`
    const u = db.users.findOne({email: 'admin@e2e.test'});
    const sp = db.spaces.findOne({type: 'personal', owner_id: u._id});
    const now = new Date();
    const src = db.kb_sources.insertOne({space_id: sp._id, created_by: u._id, kind: 'video', url: 'https://www.tiktok.com/@loi${id}',
      title: 'Kênh lỗi ${id}', status: 'done', lane: 'heavy', priority: 0, tags: [], categories: [], logs: [], options: {},
      created_at: now}).insertedId;
    const mk = (key, n, kind, err) => db.videos.insertOne({_id: key + '${id}', url: 'https://www.tiktok.com/@loi/video/' + key,
      source_id: src, status: 'error', error: err, error_kind: kind, fail_count: n, last_failed_at: now, caption: 'Video ' + key + ' ${id}',
      fail_log: Array.from({length: n}, (_, i) => ({at: now, error: err, kind, via: i ? 'auto' : 'scan'}))});
    mk('mang', 1, 'network', 'curl: (35) TLS connect error');
    mk('chan', 3, 'forbidden', 'HTTP Error 403: Forbidden');
    print(src.toString())`).trim()

  await page.goto('/kb')
  await page.getByRole('button', { name: /^Thao tác hàng loạt/ }).click()
  await page.getByRole('menuitem', { name: 'Xem video lỗi mọi kênh' }).click()
  await expect(page).toHaveURL(/failed=1/)
  const panel = page.getByRole('region', { name: 'Video lỗi' })
  await expect(panel.locator('.doc-row').filter({ hasText: id })).toHaveCount(2)
  await panel.getByRole('button', { name: /Bị chặn/ }).click()
  const chan = panel.locator('.doc-row').filter({ hasText: `Video chan ${id}` })
  await expect(chan).toContainText('Lỗi 3/3 — đã dừng tự thử')
  await expect(panel.locator('.doc-row').filter({ hasText: `Video mang ${id}` })).toHaveCount(0)
  await chan.getByRole('button', { name: 'Lịch sử lỗi (3)' }).click()
  await expect(chan.locator('.fail-log li')).toHaveCount(3)

  // chạy tiếp tất cả: chỉ video lỗi dưới 3 lần được xếp (việc tự động)
  await manualConfirm(page)
  await page.getByRole('button', { name: /^Thao tác hàng loạt/ }).click()
  await page.getByRole('menuitem', { name: 'Chạy tiếp tất cả nguồn đang lọc' }).click()
  const ask = confirmDialog(page)
  await expect(ask).toContainText('Chạy tiếp theo bộ lọc đang xem?')
  await expect(ask).toContainText(/video lỗi trong các kênh/)
  await ask.getByTestId('confirm-ok').click()
  await expect.poll(() => mongo(`print(db.kb_redo.countDocuments({key: 'mang${id}', auto: true}))`).trim()).toBe('1')
  expect(mongo(`print(db.kb_redo.countDocuments({key: 'chan${id}'}))`).trim()).toBe('0')

  // chi tiết kênh: chỉ hiện video lỗi, số lần lỗi
  await page.goto(`/kb?source=${src}&stab=docs`)
  const dlg = page.getByRole('dialog', { name: 'Chi tiết nguồn' })
  await dlg.getByLabel('Chỉ hiện video lỗi').check()
  await expect(dlg.locator('.doc-row-failed')).toHaveCount(2)
  await expect(dlg.locator('.doc-row-failed').filter({ hasText: `Video mang ${id}` })).toContainText(/Lỗi [12]\/3/)   // luồng nền có thể vừa tự thử lại (link giả lỗi tiếp)

  // dọn: 2 video lỗi + nguồn giả không được làm lệch số liệu của test sau (Tổng quan đếm video trong kho)
  mongo(`db.videos.deleteMany({_id: {$in: ['mang${id}', 'chan${id}']}});
    db.kb_redo.deleteMany({key: {$in: ['mang${id}', 'chan${id}']}});
    db.kb_sources.deleteOne({_id: ObjectId('${src}')})`)
})
