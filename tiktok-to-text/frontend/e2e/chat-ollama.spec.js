// SYS-38 / SCR-22.1: kiểm giao diện với SSE giả, không gọi Claude hoặc Ollama thật.
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

const localStatus = {
  available: true, allowed: true, cli: false, fallback: true,
  local: { ready: true, model: 'gemma3:12b', error: null },
}
const LIMIT = 'AI local tra cứu dữ liệu theo quyền của bạn; chưa tạo, sửa hoặc xoá dữ liệu.'

async function checkA11y(page) {
  const result = await new AxeBuilder({ page }).include('main, [data-testid="qchat"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(result.violations.filter((v) => ['critical', 'serious'].includes(v.impact))).toEqual([])
}

// Chủ động phát từng sự kiện để kiểm chữ dở đã biến mất trước khi có done (done tự thay toàn bộ tin nhắn).
async function fakeStream(page) {
  await page.addInitScript(() => {
    window.__chatStreams = []
    window.EventSource = class {
      constructor(url) { this.url = url; window.__chatStreams.push(this) }
      close() { this.closed = true }
    }
  })
}
async function emit(page, events) {
  await page.evaluate((batch) => {
    const stream = window.__chatStreams.at(-1)
    for (const event of batch) stream.onmessage({ data: JSON.stringify(event) })
  }, events)
}

test('trò chuyện: thay chữ Claude bằng local, phát lại SSE và giữ nhãn sau tải lại', async ({ page }) => {
  const id = 'ollama-thread-e2e'
  const question = { id: 'user-e2e', role: 'user', content: 'Hướng dẫn tìm thẻ', tools: [] }
  const answer = { id: 'assistant-e2e', role: 'assistant', content: '', status: 'queued', tools: [], model: null }
  let thread = { id, title: 'Dự phòng Ollama', messages: [], message_count: 0, can_write: true, cost_usd: 0 }
  await page.route('**/api/chat/status', (route) => route.fulfill({ json: { ...localStatus, cli: true } }))
  await page.route('**/api/chat/threads?*', (route) => route.fulfill({ json: { items: [] } }))
  await page.route(`**/api/chat/threads/${id}`, (route) => route.fulfill({ json: thread }))
  await page.route(`**/api/chat/threads/${id}/messages`, (route) => {
    thread = { ...thread, message_count: 2, messages: [question, answer] }
    return route.fulfill({ json: { user_message: question, assistant_message: answer } })
  })
  await fakeStream(page)
  await page.goto(`/chat/${id}`)
  await page.getByLabel('Hỏi Claude', { exact: true }).fill(question.content)
  await page.getByTestId('chat-send').click()
  await expect.poll(() => page.evaluate(() => window.__chatStreams.length)).toBe(1)
  const message = page.locator('[data-role="assistant"]')
  await emit(page, [{ t: 'status', status: 'running', model: 'claude-sonnet' }, { t: 'text', d: 'Câu Claude còn dang dở' }])
  await expect(message).toContainText('Câu Claude còn dang dở')
  await expect(message.getByTestId('chat-engine')).toHaveText('Claude')

  const localStart = [
    { t: 'reset' },
    { t: 'status', status: 'running', model: 'local:gemma3:12b', note: 'Claude lỗi, đang dùng AI local.' },
  ]
  await emit(page, localStart)
  await expect(message).not.toContainText('Câu Claude còn dang dở')
  await expect(message).toHaveAttribute('aria-label', 'AI local')
  await expect(message.getByTestId('chat-engine')).toHaveText('AI local · gemma3:12b')
  await expect(message).toContainText(LIMIT)
  await expect(message).toContainText('Claude lỗi, đang dùng AI local.')
  await expect(page.getByTestId('chat-stop')).toBeVisible()
  const localTool = { id: 'local-1', name: 'read_guide', input: { section: 'tim-doc' }, status: 'running' }
  await emit(page, [{ t: 'tool', tool: localTool }])
  await expect(message.locator('.chat-tools')).toContainText('Đọc hướng dẫn')
  const finishedTool = { ...localTool, status: 'done', result: 'Dùng ô tìm kiếm ở VCWIKI.' }
  await emit(page, [{ t: 'tool_result', tool: finishedTool }])
  const reply = 'Mở VCWIKI và dùng ô tìm kiếm.'
  await emit(page, [{ t: 'text', d: reply }])
  await expect(message.locator('.chat-md')).toHaveText(reply)

  // Nối lại SSE phát toàn bộ từ đầu: chữ và nhãn model phải đổi theo lượt phát, không cộng lặp.
  await page.evaluate(() => window.__chatStreams.at(-1).onerror())
  await emit(page, [{ t: 'status', status: 'running', model: 'claude-sonnet' }, { t: 'text', d: 'Câu Claude còn dang dở' }])
  await expect(message.getByTestId('chat-engine')).toHaveText('Claude')
  await expect(message).not.toContainText(LIMIT)
  await expect(message).not.toContainText('Claude lỗi, đang dùng AI local.')
  await expect(message.locator('.chat-md')).toHaveText('Câu Claude còn dang dở')
  await emit(page, [...localStart, { t: 'text', d: reply }])
  await expect(message.locator('.chat-md')).toHaveText(reply)

  const saved = { ...answer, content: reply, status: 'done', model: 'local:gemma3:12b', duration_ms: 2500, tools: [finishedTool] }
  thread = { ...thread, messages: [question, saved] }
  await emit(page, [{ t: 'done', message: saved }])
  await expect(page.getByTestId('chat-stop')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__chatStreams.at(-1).closed)).toBe(true)
  await page.reload()
  await expect(message.getByTestId('chat-engine')).toHaveText('AI local · gemma3:12b')
  await expect(message.locator('.chat-md')).toHaveText(reply)
  await expect(message).toContainText(LIMIT)
  await expect(message.locator('.chat-tools')).toContainText('Đọc hướng dẫn')
  await checkA11y(page)
})

test('chat nhanh: chỉ Ollama sẵn sàng vẫn nhập được, ghi giới hạn và gợi ý hướng dẫn', async ({ page }) => {
  await page.route('**/api/chat/status', (route) => route.fulfill({ json: localStatus }))
  await page.goto('/wiki')
  await page.getByRole('button', { name: 'Hỏi Claude', exact: true }).click()
  const box = page.getByTestId('qchat')
  await expect(box.getByTestId('chat-engine')).toHaveText('AI local · gemma3:12b')
  await expect(box).toContainText(LIMIT)
  await expect(box.getByRole('button', { name: 'Trang này dùng thế nào?' })).toBeEnabled()
  await expect(box.getByRole('button', { name: 'Hướng dẫn tôi cách tìm thẻ trong VCWIKI' })).toBeEnabled()
  await expect(box.getByRole('button', { name: /Hàng chờ tinh chế/ })).toHaveCount(0)
  await expect(box.getByLabel('Hỏi Claude')).toHaveAttribute('placeholder', /Hỏi AI local/)
  await box.getByLabel('Hỏi Claude').fill('Hướng dẫn tìm thẻ')
  await expect(box.getByTestId('chat-send')).toBeEnabled()
  await checkA11y(page)
})

test('trò chuyện: báo cả hai AI thiếu, hoặc dự phòng bị tắt', async ({ page }) => {
  let status = { ...localStatus, available: false, local: { ready: false, error: 'Chưa có model gemma3:12b.' } }
  await page.route('**/api/chat/status', (route) => route.fulfill({ json: status }))
  await page.goto('/chat')
  await expect(page.getByRole('status').filter({ hasText: 'Claude CLI và AI local chưa sẵn sàng' })).toContainText('Chưa có model gemma3:12b.')
  await page.getByLabel('Hỏi Claude').fill('Xin chào')
  await expect(page.getByTestId('chat-send')).toBeDisabled()
  status = { ...status, fallback: false }
  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: 'dự phòng AI local đang tắt' })).toBeVisible()
})
