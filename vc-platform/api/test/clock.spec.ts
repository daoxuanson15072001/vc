import { FakeClock, todayOn } from '../src/common/clock';
import { loadEnv } from '../src/config/env';
import { checkSchedule, lastOccurrence } from '../src/jobs/schedule';

describe('Ngày giờ Việt Nam (B-01 xong khi: todayOn đúng ở 16:59:59Z và 17:00:00Z)', () => {
  test('todayOn đổi ngày lúc 17:00:00Z', () => {
    const clock = new FakeClock(new Date('2026-11-30T16:59:59Z'));
    expect(todayOn(clock)).toBe('2026-11-30');
    clock.advance(1000);
    expect(clock.now().toISOString()).toBe('2026-11-30T17:00:00.000Z');
    expect(todayOn(clock)).toBe('2026-12-01');
  });

  test('Đồng hồ giả chạy tiếp từ giờ đã đặt khi bật running', () => {
    const clock = new FakeClock();
    clock.set(new Date('2027-01-01T00:00:00Z'), { running: true });
    const a = clock.now().getTime();
    expect(a).toBeGreaterThanOrEqual(Date.parse('2027-01-01T00:00:00Z'));
    expect(a).toBeLessThan(Date.parse('2027-01-01T00:00:05Z'));
  });
});

describe('Lịch job theo giờ Việt Nam', () => {
  const at = (iso: string) => new Date(iso);
  test('Mỗi phút: lượt là đầu phút', () => {
    expect(lastOccurrence({ everyMinutes: 1 }, at('2026-10-08T03:04:59Z'))?.toISOString()).toBe('2026-10-08T03:04:00.000Z');
    expect(lastOccurrence({ everyMinutes: 15 }, at('2026-10-08T03:29:59Z'))?.toISOString()).toBe('2026-10-08T03:15:00.000Z');
  });
  test('00:10 hằng ngày là 17:10Z hôm trước; trước 00:10 thì lượt gần nhất là hôm qua', () => {
    expect(lastOccurrence({ dailyAt: '00:10' }, at('2026-10-07T17:10:00Z'))?.toISOString()).toBe('2026-10-07T17:10:00.000Z');
    expect(lastOccurrence({ dailyAt: '00:10' }, at('2026-10-07T17:09:59Z'))?.toISOString()).toBe('2026-10-06T17:10:00.000Z');
  });
  test('Mỗi giờ phút 7', () => {
    expect(lastOccurrence({ hourlyAtMinute: 7 }, at('2026-10-08T03:07:00Z'))?.toISOString()).toBe('2026-10-08T03:07:00.000Z');
    expect(lastOccurrence({ hourlyAtMinute: 7 }, at('2026-10-08T03:06:59Z'))?.toISOString()).toBe('2026-10-08T02:07:00.000Z');
  });
  test('Lịch sai bị từ chối', () => {
    expect(() => checkSchedule({ dailyAt: '24:00' })).toThrow('HH:MM');
    expect(() => checkSchedule({ everyMinutes: 7 })).toThrow('chia hết');
    expect(() => checkSchedule({ hourlyAtMinute: 60 })).toThrow();
    expect(lastOccurrence('manual', new Date())).toBeUndefined();
  });
});

describe('Cấu hình', () => {
  test('CLOCK_MODE=fake chỉ chạy được ở staging hoặc test (mục 3.3 điểm 14)', () => {
    expect(() => loadEnv({ MONGO_URL: 'mongodb://x', APP_ENV: 'production', CLOCK_MODE: 'fake' })).toThrow('CLOCK_MODE=fake');
    expect(() => loadEnv({ MONGO_URL: 'mongodb://x', APP_ENV: 'dev', CLOCK_MODE: 'fake' })).toThrow('CLOCK_MODE=fake');
    expect(loadEnv({ MONGO_URL: 'mongodb://x', APP_ENV: 'staging', CLOCK_MODE: 'fake' }).CLOCK_MODE).toBe('fake');
  });
  test('Cờ mặc định là giá trị production (kế hoạch GĐ B mục 11.2); giá trị rỗng coi như không đặt', () => {
    const e = loadEnv({ MONGO_URL: 'mongodb://x', OIDC_ISSUER: '' });
    expect(e.FEATURE_HOME_B).toBe('off');
    expect(e.FEATURE_IMPORT).toBe('on');
    expect(e.RETENTION_MODE).toBe('dry_run');
    expect(e.OIDC_ISSUER).toBeUndefined();
    expect(() => loadEnv({})).toThrow('MONGO_URL');
  });
});
