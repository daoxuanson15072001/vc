/** pnpm job:run <tên> — chạy một job ngay (kế hoạch GĐ B mục 6.1). Không có tên: liệt kê job. */
import { JobRegistry } from '../jobs/registry';
import { JobRunner } from '../jobs/runner';
import { toolContext } from './context';

async function main(): Promise<number> {
  const app = await toolContext();
  try {
    const name = process.argv[2];
    if (!name) {
      for (const j of app.get(JobRegistry).list()) console.log(`${j.name}\t${JSON.stringify(j.schedule)}\t${j.description}`);
      return 0;
    }
    const result = await app.get(JobRunner).runNow(name);
    console.log(result === 'ok' ? `${name}: xong` : result === 'dang_chay' ? `${name}: tiến trình khác đang chạy, thử lại sau` : `${name}: lỗi, xem log`);
    return result === 'ok' ? 0 : 1;
  } finally {
    await app.close();
  }
}

main().then(
  (code) => process.exit(code),
  (e: Error) => {
    console.error(`Lỗi: ${e.message}`);
    process.exit(1);
  },
);
