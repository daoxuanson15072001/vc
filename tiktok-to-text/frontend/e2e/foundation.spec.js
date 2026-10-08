// Đợt 0 (docs/BA.md mục 18.2 — F0): fixture tổ chức mẫu dùng được, hợp đồng API mới có mặt.
import { test, expect, seedOrg, pageAs } from './fixtures'

test('tổ chức mẫu: người đăng nhập thấy đơn vị, người quản lý, người dưới quyền của mình', async ({ page, browser }) => {
  const { people, units } = await seedOrg(page)
  expect(Object.keys(units)).toHaveLength(8)

  const tp = await pageAs(browser, people.tp_part_mkt)
  const me = await (await tp.request.get('/api/org/me')).json()
  expect(me.units.map((u) => u.name)).toEqual(['Phòng Marketing VCpart'])
  expect(me.manager.email).toBe(people.gd_part.email)
  expect(me.functional_manager.email).toBe(people.gd_mkt.email)
  expect(me.direct_reports.map((r) => r.email)).toEqual([people.nv_part_mkt.email])
  await tp.context().close()
})

test('hợp đồng API đợt 0: endpoint tổ chức / đề xuất / học tập trả 501 cho tới khi luồng phụ trách làm', async ({ page }) => {
  // /api/wiki/changes: luồng F đã triển khai (đợt 2) — thay bằng endpoint còn chờ luồng K
  for (const path of ['/api/org/access-log', '/api/wiki/reviews/due', '/api/learn/reports']) {
    const r = await page.request.get(path)
    expect(r.status(), path).toBe(501)
  }
})
