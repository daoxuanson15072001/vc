/** pnpm migrate — chạy migration rồi thoát (API cũng tự chạy lúc khởi động). */
import { toolContext } from './context';

toolContext().then(
  async (app) => {
    await app.close();
    console.log('Migration: xong');
  },
  (e: Error) => {
    console.error(`Lỗi: ${e.message}`);
    process.exit(1);
  },
);
