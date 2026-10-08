import { describe, expect, it } from 'vitest';
import { buildTurns, dayStats, percentile, summarize, type TurnMessage } from '../src/kpi';
import type { WorkCalendar } from '../src/inbox';

const ALL_DAY: WorkCalendar = { weekdays: { '0': [['00:00', '24:00']], '1': [['00:00', '24:00']], '2': [['00:00', '24:00']], '3': [['00:00', '24:00']], '4': [['00:00', '24:00']], '5': [['00:00', '24:00']], '6': [['00:00', '24:00']] }, holidays: [] } as never;
const MIN = 60_000;
const T0 = Date.parse('2026-10-05T01:00:00Z');
const c = (m: number): TurnMessage => ({ at: T0 + m * MIN, own: false });
const o = (m: number, cli?: string): TurnMessage => ({ at: T0 + m * MIN, own: true, ...(cli ? { cliMsgId: cli } : {}) });

describe('kpi turns', () => {
  it('a turn starts at the first customer message and ends at the next own message', () => {
    const t = buildTurns([c(0), c(2), o(10, 'a'), c(20)], T0 - 1, T0 + 99 * MIN);
    expect(t).toEqual([{ startAt: T0, endAt: T0 + 10 * MIN, endCliMsgId: 'a' }, { startAt: T0 + 20 * MIN, endAt: null }]);
  });
  it('a turn already open before the window is not counted again', () => {
    expect(buildTurns([c(-5), c(1)], T0, T0 + 60 * MIN)).toEqual([]);
  });
  it('hand-checked day: waits 10, 20, 150 and one open 30; SLA 15', () => {
    const turns = [
      ...buildTurns([c(0), o(10, 'v1')], T0, T0 + MIN * 999),
      ...buildTurns([c(200), o(220)], T0, T0 + MIN * 999),
      ...buildTurns([c(300), o(450, 'v2')], T0, T0 + MIN * 999),
      ...buildTurns([c(500)], T0, T0 + MIN * 999),
    ];
    const s = dayStats(turns, { nowMs: T0 + 530 * MIN, calendar: ALL_DAY, slaMinutes: 15, sentFromVclinks: new Set(['v1', 'v2']) });
    expect(s).toMatchObject({ turns: 4, answered: 3, open: 1, breached: 3, over15: 3, over120: 1, viaVclinks: 2, fromPhone: 1 });
    expect(s.waits).toEqual([10, 20, 150]);
    const sum = summarize([s]);
    expect(sum).toMatchObject({ frtMedian: 20, frtP90: 150, pctBreached: 75, pctViaVclinks: 66.7 });
  });
  it('percentile of nothing is null; summarize of nothing has null shares', () => {
    expect(percentile([], 50)).toBeNull();
    expect(summarize([]).pctBreached).toBeNull();
  });
});
