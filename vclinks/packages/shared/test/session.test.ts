import { describe, expect, it } from 'vitest';
import { sessionReportSchema } from '../src/session';

describe('session report schema', () => {
  it('requires a reason only when lost', () => {
    expect(sessionReportSchema.safeParse({ state: 'ok' }).success).toBe(true);
    expect(sessionReportSchema.safeParse({ state: 'lost', reason: 'qr' }).success).toBe(true);
    expect(sessionReportSchema.safeParse({ state: 'lost' }).success).toBe(false);
    expect(sessionReportSchema.safeParse({ state: 'ok', reason: 'qr' }).success).toBe(false);
  });

  it('rejects unknown reasons and extra fields (no cookies or tokens ride along)', () => {
    expect(sessionReportSchema.safeParse({ state: 'lost', reason: 'banned' }).success).toBe(false);
    expect(sessionReportSchema.safeParse({ state: 'ok', cookie: 'x' }).success).toBe(false);
  });
});
