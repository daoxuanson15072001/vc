import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 900 },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
