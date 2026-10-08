// Test E2E: Playwright điều khiển Chromium bấm qua giao diện thật.
// Chạy: npm run e2e        (ẩn trình duyệt)
//       npm run e2e:headed (xem trình duyệt chạy)
//       npm run e2e:ui     (giao diện chọn test, tua lại từng bước)
// BE riêng cổng 8100 + DB `tiktok_to_text_e2e` (xoá sạch mỗi lần chạy) -> không đụng dữ liệu thật.
// Nhiều agent chạy song song (docs/BA.md mục 18.1): đặt E2E_SLOT=n -> cổng 8100+n / 5180+n,
// DB `tiktok_to_text_e2e_<n>`, thư mục output/e2e_<n>. Không đặt = như cũ.
import { defineConfig, devices } from '@playwright/test'
import { BE_PORT, E2E_DB_NAME as E2E_DB, FB_FAKE_PORT, FE_PORT, OUT as TMP } from './e2e/slot.js'

export default defineConfig({
  testDir: './e2e',
  // Các test dùng chung một DB -> chạy tuần tự cho dễ đoán
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: `${TMP}/report` }]],
  outputDir: `${TMP}/results`,
  use: {
    baseURL: `http://localhost:${FE_PORT}`,
    locale: 'vi-VN',
    // Tắt hiệu ứng (tokens.css: --dur = 0 khi prefers-reduced-motion) — axe đo màu lúc popup đang mờ dần sẽ ra
    // tương phản thấp giả (vd huy hiệu warn 4,37:1 thay vì 4,51:1)
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.js/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: `${TMP}/admin.json` },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command:
        `mongosh --quiet mongodb://127.0.0.1:27017/${E2E_DB} --eval "db.dropDatabase()" && ` +
        `rm -rf ${TMP}/raw ${TMP}/media ${TMP}/tts && ` +
        `cd ../backend && ../.venv/bin/uvicorn app.main:app --port ${BE_PORT}` +
        // E2E_RELOAD=1: BE tự nạp lại khi sửa backend/app (mặc định tắt để lượt chạy không bị ngắt giữa chừng)
        (process.env.E2E_RELOAD ? ' --reload --reload-dir app' : ''),
      url: `http://127.0.0.1:${BE_PORT}/api/auth/setup`,
      env: {
        MONGO_DB: E2E_DB,
        RAW_DIR: `${TMP}/raw`,
        MEDIA_DIR: `${TMP}/media`,
        TTS_DIR: `${TMP}/tts`,
        ANTHROPIC_API_KEY: '',
        ANTHROPIC_AUTH_TOKEN: '',
        // e2e chạy không AI: máy dev có Ollama thì BE không được chuyển sang AI local (test "Chờ cấu hình AI" hỏng)
        AI_FALLBACK: 'off',
        // tìm thẻ chỉ theo chữ như pytest (conftest): máy dev có Ollama bge-m3 thì tìm theo nghĩa kéo thêm thẻ gần nghĩa
        SEARCH_SEMANTIC: '0',
        // Graph API giả do e2e/dang-facebook.spec.js dựng — không bao giờ gọi Facebook thật
        FB_GRAPH_URL: `http://127.0.0.1:${FB_FAKE_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${FE_PORT} --strictPort`,
      url: `http://localhost:${FE_PORT}`,
      env: { API_TARGET: `http://127.0.0.1:${BE_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
