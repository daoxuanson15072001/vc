import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900 },
  // VC Home API (GĐ B) chạy ở cổng 3100 trên máy dev; production đi qua nginx cùng tên miền.
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:3100' } },
  preview: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:3100' } },
});
