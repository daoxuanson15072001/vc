import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { routesManifest } from './src/routes.js'

// Ghi dist/routes.json từ src/routes.js (CMP-00): BE dùng để trả 404 thật cho đường dẫn lạ (SEO-02) và dựng /llms.txt
// (AIX-21). Chỉ đường dẫn, tên màn, mô tả — không có dữ liệu.
function routesJson() {
  return {
    name: 'routes-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'routes.json', source: `${JSON.stringify(routesManifest(), null, 1)}\n` })
    },
  }
}

export default defineConfig({
  plugins: [react(), routesJson()],
  server: {
    port: 5173,
    // Test E2E trỏ sang BE riêng (cổng khác, DB riêng) qua API_TARGET
    // /guide.md, /guide/<id>.md: bản thuần văn bản của hướng dẫn do BE dựng (app/guide.py) — dev / e2e cũng đi qua BE
    proxy: {
      '/api': process.env.API_TARGET || 'http://127.0.0.1:8000',
      '^/guide(/[^/]+)?\\.md$': process.env.API_TARGET || 'http://127.0.0.1:8000',
      '/robots.txt': process.env.API_TARGET || 'http://127.0.0.1:8000',
    },
  },
})
