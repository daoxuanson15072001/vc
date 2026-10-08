// Fixture chung: test nào làm trang văng lỗi JS hoặc API trả 5xx đều bị đánh fail.
import { test as base, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'

export const ADMIN = { name: 'Quản trị E2E', email: 'admin@e2e.test', password: 'admin-e2e-123' }
import { E2E_DB_NAME, OUT } from './slot.js'

export const E2E_DB = `mongodb://127.0.0.1:27017/${E2E_DB_NAME}`
export const E2E_OUT = OUT

export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = []
    page.on('pageerror', (e) => problems.push(`Lỗi JS: ${e.message}`))
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && problems.push(`console.error: ${m.text()}`))
    page.on('response', (r) => r.url().includes('/api/') && r.status() >= 500 && problems.push(`${r.status()} ${r.request().method()} ${r.url()}`))
    // Hộp thoại gốc còn sót (window.confirm / prompt): mặc định đồng ý; test cần nhập prompt thì tự gắn handler riêng
    page.on('dialog', (d) => d.type() !== 'prompt' && d.accept())
    // Hộp thoại xác nhận trong app (components/dialog.jsx): mặc định tự bấm nút đồng ý — giống hành vi cũ với
    // window.confirm — để test cũ không phải sửa. Hộp nhập chữ (data-kind=prompt) không tự bấm: test điền
    // confirm-input rồi bấm confirm-ok. Test muốn tự bấm Huỷ / kiểm tra chữ trong hộp: gọi manualConfirm(page).
    await page.addInitScript(autoConfirmScript)
    await use(page)
    expect(problems, 'Trang không được có lỗi JS / lỗi 5xx').toEqual([])
  },
})
export { expect }

// Script chạy trong trang: tự bấm "confirm-ok" của hộp xác nhận trong app khi nó xuất hiện (trừ hộp nhập chữ),
// tắt được bằng window.__e2eAutoConfirm = false (xem manualConfirm)
const autoConfirmScript = () => {
  window.__e2eAutoConfirm = true
  const tick = () => {
    if (window.__e2eAutoConfirm === false) return
    const box = document.querySelector('[data-testid="confirm-dialog"][data-kind="confirm"]')
    box?.querySelector('[data-testid="confirm-ok"]')?.click()
  }
  new MutationObserver(tick).observe(document, { childList: true, subtree: true })
}

// Từ đây test tự xử lý hộp xác nhận trong app (bấm confirm-ok / confirm-cancel, đọc tiêu đề)
export const manualConfirm = (page) => page.evaluate(() => { window.__e2eAutoConfirm = false })

// Hộp xác nhận trong app đang mở (role=alertdialog)
export const confirmDialog = (page) => page.getByTestId('confirm-dialog')

// Chuỗi duy nhất cho mỗi lượt chạy để các test không đụng dữ liệu của nhau
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const mongo = (script) => execFileSync('mongosh', ['--quiet', E2E_DB, '--eval', script], { encoding: 'utf8' })

export async function login(page, { email, password }) {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill(password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page.locator('.sidebar')).toBeVisible()
}

// Tạo tài khoản qua API bằng phiên admin của `page` (nhanh hơn bấm UI khi chỉ cần dữ liệu)
export async function createUser(page, user) {
  const res = await page.request.post('/api/users', { data: { role: 'member', ...user } })
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

// Mở phiên thứ hai (người dùng khác) trong cửa sổ riêng; confirm() tự đồng ý như page chính
export async function pageAs(browser, user) {
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const p = await ctx.newPage()
  p.on('dialog', (d) => d.type() !== 'prompt' && d.accept())
  await p.addInitScript(autoConfirmScript)
  if (user) await login(p, user)
  return p
}

export const nav = (page, label) => page.locator('.sidebar nav').getByRole('link', { name: label })

// Cây tổ chức mẫu (docs/BA.md mục 15.2) — giống fixture `org_sample` của pytest (backend/tests/conftest.py).
// Tạo người qua API (cần phiên admin của `page`), gắn đơn vị / người quản lý thẳng vào DB vì API tổ chức
// (luồng A) chưa có. Trả về { units: {code: id}, people: {key: {id, email, password, name}} }.
// Mỗi lần gọi dùng hậu tố riêng nên gọi nhiều lần trong một lượt chạy không đụng nhau.
export async function seedOrg(page) {
  const s = uid()
  const units = [
    ['VCPV', 'Tập đoàn VC Phồn Vinh', 'group', null, null],
    ['TD-MKT', 'Marketing tập đoàn', 'department', 'VCPV', 'marketing'],
    ['VCPART', 'VCpart', 'division', 'VCPV', null],
    ['VCPART-KD', 'Phòng Kinh doanh VCpart', 'department', 'VCPART', 'sales'],
    ['VCPART-MKT', 'Phòng Marketing VCpart', 'department', 'VCPART', 'marketing'],
    ['VCGARAGE', 'VCgarage', 'division', 'VCPV', null],
    ['VCGARAGE-KT', 'Phòng Kỹ thuật VCgarage', 'department', 'VCGARAGE', 'tech'],
    ['VCGARAGE-KD', 'Phòng Kinh doanh VCgarage', 'department', 'VCGARAGE', 'sales'],
  ]
  // [khoá, mã đơn vị, người quản lý, chức năng, quản lý chuyên môn]
  const people = [
    ['tgd', 'VCPV', null, null, null],
    ['gd_mkt', 'TD-MKT', 'tgd', 'marketing', null],
    ['gd_part', 'VCPART', 'tgd', null, null],
    ['tp_part_kd', 'VCPART-KD', 'gd_part', 'sales', null],
    ['nv_part_kd', 'VCPART-KD', 'tp_part_kd', 'sales', null],
    ['tp_part_mkt', 'VCPART-MKT', 'gd_part', 'marketing', 'gd_mkt'],
    ['nv_part_mkt', 'VCPART-MKT', 'tp_part_mkt', 'marketing', 'gd_mkt'],
    ['gd_garage', 'VCGARAGE', 'tgd', null, null],
    ['tp_garage_kt', 'VCGARAGE-KT', 'gd_garage', 'tech', null],
    ['ks_garage_kt', 'VCGARAGE-KT', 'tp_garage_kt', 'tech', null],
    ['tts_garage_kt', 'VCGARAGE-KT', 'ks_garage_kt', 'tech', null],
    ['hr_lnd', 'VCPV', 'tgd', 'hr', null],
  ]
  const out = { units: {}, people: {} }
  for (const [key] of people) {
    const u = { name: `${key} ${s}`, email: `${key}.${s}@e2e.test`, password: 'mat-khau-e2e' }
    const created = await createUser(page, u)
    out.people[key] = { ...u, id: created.id }
  }
  const js = JSON.stringify({ s, units, people, ids: Object.fromEntries(Object.entries(out.people).map(([k, v]) => [k, v.id])) })
  const res = mongo(`
    const d = ${js}
    const unitId = {}
    for (const [code, name, kind, parent, fn] of d.units) {
      const p = parent ? db.org_units.findOne({ _id: unitId[parent] }) : null
      const r = db.org_units.insertOne({ code: code + '-' + d.s, name, kind, parent_id: p ? p._id : null,
        path: p ? [...p.path, p._id] : [], function: fn, head_id: null, active: true, order: 0 })
      unitId[code] = r.insertedId
    }
    const oid = (k) => (k ? ObjectId(d.ids[k]) : null)
    for (const [key, unit, mgr, fn, fmgr] of d.people) {
      db.users.updateOne({ _id: oid(key) }, { $set: { org: { unit_ids: [unitId[unit]], function: fn, position: null,
        manager_id: oid(mgr), functional_manager_id: oid(fmgr), level: null, status: 'active' } } })
    }
    db.grants.insertOne({ user_id: oid('hr_lnd'), role: 'lnd', scope: { unit_id: unitId['VCGARAGE'], category: null,
      function: null }, delegated_from: null, valid_from: null, valid_to: null, created_by: null })
    print(JSON.stringify(Object.fromEntries(Object.entries(unitId).map(([k, v]) => [k, v.toString()]))))
  `)
  out.units = JSON.parse(res.trim().split('\n').pop())
  return out
}
