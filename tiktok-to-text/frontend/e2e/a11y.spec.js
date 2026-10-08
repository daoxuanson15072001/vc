// Kiểm trợ năng tự động (DESIGN V.9.1, Phần VI mục 1, SYS-29): axe-core trên mọi route trong src/routes.js.
// UI-1: chưa bắt buộc xanh — ghi bảng số lỗi theo route vào output/e2e*/a11y.json và in tóm tắt; đặt A11Y_STRICT=1
// thì trượt khi có lỗi critical / serious. Riêng trang mẫu component /dev/ui (code mới) luôn phải 0 critical / serious.
// Route có :id thay bằng id không tồn tại (trang báo không tìm thấy — vẫn phải đọc được).
import { writeFileSync, mkdirSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'
import { PAGE_ROUTES } from '../src/routes.js'
import { OUT } from './slot.js'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const FAKE_ID = '000000000000000000000000'
const STRICT = !!process.env.A11Y_STRICT

async function scan(page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const by = { critical: 0, serious: 0, moderate: 0, minor: 0 }
  for (const v of r.violations) by[v.impact] = (by[v.impact] || 0) + v.nodes.length
  return { by, rules: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })) }
}

async function settle(page) {
  await page.locator('main h1, [data-testid="not-found"]').first().waitFor({ timeout: 10_000 }).catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})
}

test('axe trên mọi route (báo cáo)', async ({ page }) => {
  test.setTimeout(240_000)
  const paths = [...new Set(PAGE_ROUTES.map((r) => r.path.replace(/:[^/]+/g, FAKE_ID)))]
  const report = []
  for (const path of paths) {
    await page.goto(path)
    await settle(page)
    report.push({ path, ...(await scan(page)) })
  }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(`${OUT}/a11y.json`, JSON.stringify(report, null, 1))
  const total = report.reduce((a, r) => ({ critical: a.critical + r.by.critical, serious: a.serious + r.by.serious }), { critical: 0, serious: 0 })
  const lines = report.map((r) => `${r.path.padEnd(34)} critical ${r.by.critical}  serious ${r.by.serious}  moderate ${r.by.moderate}  ${r.rules.map((x) => x.id).join(', ')}`)
  console.log(`\naxe — ${paths.length} route, critical ${total.critical}, serious ${total.serious}\n${lines.join('\n')}`)
  test.info().annotations.push({ type: 'axe', description: `critical ${total.critical}, serious ${total.serious} (chi tiết ${OUT}/a11y.json)` })
  if (STRICT) expect(total, 'A11Y_STRICT: không được có lỗi critical / serious').toEqual({ critical: 0, serious: 0 })
})

test('trang mẫu component /dev/ui: 0 lỗi critical / serious ở mọi trạng thái', async ({ page }) => {
  const states = ['/dev/ui', '/dev/ui?tab=tree&node=ma-phanh', '/dev/ui?tab=misc', '/dev/ui?item=src-2030']
  for (const s of states) {
    await page.goto(s)
    await settle(page)
    const r = await scan(page)
    expect({ path: s, critical: r.by.critical, serious: r.by.serious, rules: r.rules.filter((x) => ['critical', 'serious'].includes(x.impact)) })
      .toEqual({ path: s, critical: 0, serious: 0, rules: [] })
  }
  // Modal và menu đang mở
  await page.goto('/dev/ui')
  await page.getByTestId('uikit-open-modal').click()
  expect((await scan(page)).by.serious).toBe(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Thêm hành động cho Thư viện component' }).click()
  const r = await scan(page)
  expect(r.by.critical + r.by.serious, JSON.stringify(r.rules)).toBe(0)
})

test('tương phản token: cặp chữ / nền chính đạt AA ở sáng và tối', async ({ page }) => {
  await page.goto('/dev/ui')
  for (const theme of ['light', 'dark']) {
    const ratios = await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      const css = getComputedStyle(document.documentElement)
      const v = (n) => css.getPropertyValue(n).trim()
      const lum = (hex) => {
        const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255)
          .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      }
      const ratio = (a, b) => { const [x, y] = [lum(v(a)), lum(v(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
      return {
        'text/bg': ratio('--text', '--bg'), 'muted/surface-2': ratio('--muted', '--surface-2'), 'on-primary/primary': ratio('--on-primary', '--primary'),
        'primary/primary-soft': ratio('--primary', '--primary-soft'), 'primary/surface': ratio('--primary', '--surface'),
        'good/good-soft': ratio('--good', '--good-soft'), 'bad/bad-soft': ratio('--bad', '--bad-soft'), 'warn/warn-soft': ratio('--warn', '--warn-soft'),
        'info/info-soft': ratio('--info', '--info-soft'), 'border-strong/surface': ratio('--border-strong', '--surface'),
        'focus/surface': ratio('--focus', '--surface'),
      }
    }, theme)
    for (const [pair, r] of Object.entries(ratios)) {
      const need = pair.startsWith('border-strong') || pair.startsWith('focus') ? 3 : 4.5
      expect(r, `${theme} ${pair} = ${r.toFixed(2)}:1 (cần ≥ ${need})`).toBeGreaterThanOrEqual(need)
    }
  }
})
