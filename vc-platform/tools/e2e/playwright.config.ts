import { defineConfig } from '@playwright/test';

// Chạy với Keycloak local (scripts/kc-local.sh), realm đã áp (pnpm realm:apply:dev) và app mẫu ở cổng 4400.
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
});
