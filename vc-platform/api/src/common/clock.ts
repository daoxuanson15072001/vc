/** Business code never calls `new Date()`: it asks the Clock (khung chung mục 6), so tests and staging can move time. */
import { ymdInVn } from '@vc/contracts';

export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Frozen at a set instant, or running with an offset from real time. */
export class FakeClock implements Clock {
  private frozenAt?: number;
  private offsetMs = 0;

  constructor(start?: Date) {
    if (start) this.set(start);
  }

  now(): Date {
    return new Date(this.frozenAt ?? Date.now() + this.offsetMs);
  }

  set(at: Date, opts: { running?: boolean } = {}): void {
    if (opts.running) {
      this.frozenAt = undefined;
      this.offsetMs = at.getTime() - Date.now();
    } else this.frozenAt = at.getTime();
  }

  advance(ms: number): void {
    if (this.frozenAt !== undefined) this.frozenAt += ms;
    else this.offsetMs += ms;
  }
}

/** Today's date in Vietnam (`YYYY-MM-DD`). */
export function todayOn(clock: Clock): string {
  return ymdInVn(clock.now());
}
