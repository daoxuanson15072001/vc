// Lịch sử phiên bản thẻ VCWIKI (GOV-01, GOV-07 — docs/BA.md mục 16.5).
// Đợt 1 chưa có luồng duyệt tự ghi phiên bản (luồng F nối ở đợt 2), nên test dựng sẵn 2 phiên bản thẳng trong DB
// rồi thao tác qua giao diện: xem lịch sử → so sánh → xem bản cũ → quay về bản 1 → thấy bản 3 mang nội dung bản 1.
import { test, expect, uid, mongo } from './fixtures'

async function createCard(page, data) {
  const res = await page.request.post('/api/wiki/cards', { data: { type: 'framework', ...data } })
  expect(res.ok(), await res.text()).toBeTruthy()
  return res.json()
}

// Bản 1 = nội dung lúc tạo; bản 2 = nội dung mới áp vào thẻ (như khi một đề xuất được duyệt)
function seedTwoRevisions(cardId, v2) {
  mongo(`
    const id = ObjectId('${cardId}')
    const c = db.wiki_cards.findOne({ _id: id })
    const pick = (x) => ({ type: x.type, title: x.title, summary: x.summary, body: x.body, key_points: x.key_points,
      when_to_use: x.when_to_use, example: x.example, evidence: x.evidence, tags: x.tags, categories: x.categories })
    db.card_revisions.insertOne({ card_id: id, rev: 1, snapshot: pick(c), change_request_id: null,
      reason: 'Phiên bản đầu', author_id: c.created_by, approved_by: [], created_at: new Date(Date.now() - 60000) })
    const next = { ...c, ...${JSON.stringify(v2)} }
    db.wiki_cards.updateOne({ _id: id }, { $set: { ...${JSON.stringify(v2)}, current_revision: 2, version: 2 } })
    db.card_revisions.insertOne({ card_id: id, rev: 2, snapshot: pick(next), change_request_id: null,
      reason: 'Bổ sung số liệu', author_id: c.created_by, approved_by: [c.created_by], created_at: new Date() })
  `)
}

test('lịch sử phiên bản: xem, so sánh, quay về bản 1 tạo bản 3', async ({ page }) => {
  const title = `Thẻ phiên bản ${uid()}`
  await page.goto('/wiki')
  const card = await createCard(page, { title, summary: 'Tóm tắt gốc', body: 'Dòng A\nDòng B' })
  seedTwoRevisions(card.id, { title: `${title} (bản 2)`, body: 'Dòng A\nDòng B đã sửa\nDòng C' })

  await page.goto(`/wiki?card=${card.id}`)
  const drawer = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await expect(drawer.getByRole('heading', { name: `${title} (bản 2)` })).toBeVisible()
  await drawer.getByRole('tab', { name: 'Lịch sử' }).click()

  const rows = drawer.locator('.revision-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Bản 2')
  await expect(rows.nth(0)).toContainText('Hiệu lực')
  await expect(rows.nth(0)).toContainText('Bổ sung số liệu')
  await expect(rows.nth(1)).toContainText('Phiên bản đầu')
  await expect(rows.nth(0).getByRole('button', { name: /^Quay về bản/ })).toHaveCount(0)   // bản hiệu lực

  // So sánh (mặc định bản 1 → bản 2)
  await drawer.getByRole('button', { name: 'So sánh', exact: true }).click()
  const diff = drawer.getByRole('region', { name: 'So sánh bản 1 với bản 2' })
  await expect(diff.getByText('Nội dung chi tiết')).toBeVisible()
  await expect(diff.locator('.diff-delete', { hasText: 'Dòng B' })).toBeVisible()
  await expect(diff.locator('.diff-insert', { hasText: 'Dòng B đã sửa' })).toBeVisible()
  await expect(diff.locator('.diff-insert', { hasText: 'Dòng C' })).toBeVisible()
  await expect(diff.locator('.diff-insert', { hasText: `${title} (bản 2)` })).toBeVisible()

  // Xem bản cũ
  await rows.nth(1).getByRole('button', { name: 'Xem' }).click()
  const old = drawer.getByRole('region', { name: 'Nội dung bản 1' })
  await expect(old.getByRole('heading', { name: `Bản 1 — ${title}` })).toBeVisible()
  await expect(old.getByText('Tóm tắt gốc')).toBeVisible()

  // Quay về bản 1 — hỏi lý do
  await rows.nth(1).getByRole('button', { name: 'Quay về bản 1' }).click()
  await page.getByTestId('confirm-input').fill('Bản 2 ghi sai số liệu')
  await page.getByTestId('confirm-ok').click()
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('Bản 3')
  await expect(rows.nth(0)).toContainText('Hiệu lực')
  await expect(rows.nth(0)).toContainText('Quay về bản 1: Bản 2 ghi sai số liệu')
  await expect(drawer.getByRole('heading', { name: `Thẻ VCWIKI: ${title}`, exact: true })).toBeVisible()

  // Bản 3 mang nội dung bản 1: so sánh 1 ↔ 3 không có khác biệt; bản 2 vẫn còn nguyên
  await drawer.getByLabel('Từ bản').selectOption('1')
  await drawer.getByLabel('Đến bản').selectOption('3')
  await drawer.getByRole('button', { name: 'So sánh', exact: true }).click()
  await expect(drawer.getByRole('region', { name: 'So sánh bản 1 với bản 3' }).getByText('Hai bản có nội dung giống nhau.')).toBeVisible()
  await expect(rows.nth(1)).toContainText('Bản 2')

  // Tab nội dung hiện nội dung bản 1
  await drawer.getByRole('tab', { name: 'Nội dung' }).click()
  await expect(drawer.getByText('Tóm tắt gốc')).toBeVisible()
  await expect(drawer.locator('.meta-line')).toContainText('Bản 3')
})

test('thẻ chưa có phiên bản hiện "Chưa có lịch sử"', async ({ page }) => {
  await page.goto('/wiki')
  const card = await createCard(page, { title: `Thẻ mới ${uid()}` })
  await page.goto(`/wiki?card=${card.id}`)
  const drawer = page.getByRole('dialog', { name: 'Thẻ VCWIKI' })
  await drawer.getByRole('tab', { name: 'Lịch sử' }).click()
  await expect(drawer.getByText('Chưa có lịch sử phiên bản cho thẻ này.')).toBeVisible()
})
