import { describe, expect, it } from 'vitest';
import { SEND_PACE_DEFAULT, resolveSendPace, sendPaceMessage, sendPaceSchema, sendPaceWaitMs } from '../src';

describe('send pace (M1a-06, SZ-04)', () => {
  it('defaults, env and nick override, clamped so pacing is never disabled', () => {
    expect(resolveSendPace()).toEqual(SEND_PACE_DEFAULT);
    expect(resolveSendPace({ gapMs: '4000', perMinute: '6' })).toEqual({ gapMs: 4000, perMinute: 6 });
    expect(resolveSendPace({ gapMs: 4000 }, { gapMs: 2000 })).toEqual({ gapMs: 2000, perMinute: 20 });
    expect(resolveSendPace({ gapMs: '0', perMinute: 1000 })).toEqual({ gapMs: 1000, perMinute: 30 });
    expect(resolveSendPace({ gapMs: 'abc' }, { perMinute: null })).toEqual(SEND_PACE_DEFAULT);
  });

  it('schema refuses values outside the bounds and unknown keys', () => {
    expect(sendPaceSchema.safeParse({ gapMs: 500 }).success).toBe(false);
    expect(sendPaceSchema.safeParse({ perMinute: 31 }).success).toBe(false);
    expect(sendPaceSchema.safeParse({ burst: 5 }).success).toBe(false);
    expect(sendPaceSchema.parse({ gapMs: 3000, perMinute: 5 })).toEqual({ gapMs: 3000, perMinute: 5 });
  });

  it('waits for the gap after the last start', () => {
    const pace = { gapMs: 3000, perMinute: 20 };
    expect(sendPaceWaitMs(pace, [], 10_000)).toBe(0);
    expect(sendPaceWaitMs(pace, [9000], 10_000)).toBe(2000);
    expect(sendPaceWaitMs(pace, [5000, 7000], 10_000)).toBe(0);
  });

  it('waits for a slot of the 60-second window', () => {
    const pace = { gapMs: 1000, perMinute: 3 };
    const now = 100_000;
    // Three starts within the minute: the oldest (50 s ago) frees its slot in 10 s.
    expect(sendPaceWaitMs(pace, [now - 50_000, now - 20_000, now - 5_000], now)).toBe(10_000);
    // Starts older than the window do not count.
    expect(sendPaceWaitMs(pace, [now - 70_000, now - 20_000, now - 5_000], now)).toBe(0);
  });

  it('ten back-to-back commands come out exactly one gap apart', () => {
    const pace = { gapMs: 2000, perMinute: 30 };
    const starts: number[] = [];
    let t = 0;
    for (let i = 0; i < 10; i++) {
      t += sendPaceWaitMs(pace, starts, t);
      starts.push(t);
    }
    expect(starts).toEqual([0, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000]);
  });

  it('explains a refused claim in Vietnamese', () => {
    expect(sendPaceMessage({ gapMs: 1500, perMinute: 20 }, 700)).toContain('1,5 giây');
  });
});
