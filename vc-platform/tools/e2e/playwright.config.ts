import { defineConfig } from '@playwright/test';

// Cần Keycloak local (scripts/kc-local.sh) và realm đã áp (pnpm realm:apply:dev). App mẫu (cổng 4400) và
// VC Home (bản build, cổng 5173) tự chạy nếu chưa chạy.
export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    locale: 'vi-VN',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: [
    { command: 'pnpm --filter @vc/app-mau start', url: 'http://localhost:4400/', reuseExistingServer: true, timeout: 60_000 },
    {
      command: 'pnpm --filter @vc/home build && pnpm --filter @vc/home preview',
      url: 'http://localhost:5173/config.json',
      reuseExistingServer: true,
      timeout: 180_000,
      env: { CATALOG_EXTRA_FILES: 'apps.dev.yaml' },
    },
  ],
});
