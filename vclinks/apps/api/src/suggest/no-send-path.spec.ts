import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTE_PERMISSIONS } from '../authz/route-permissions';

/*
 * M1c-06 "Xác nhận xong" #2 (static half; the e2e half is test/e2e/ai-draft.e2e-spec.ts):
 * no path sends a draft without the user pressing "Gửi" (§12.1, BR07).
 * - the suggest code never writes to the outbox collection, never calls the outbox service, the dispatcher
 *   or a channel sender; its only outbox access is one read (findOne) to record the sent pair;
 * - no ai-draft route uses the send rule; sending stays POST /api/outbox (canSend, approvedBy = presser);
 * - the web draft card only inserts text into the composer.
 */
const DIR = __dirname;
const sources = readdirSync(DIR)
  .filter((n) => n.endsWith('.ts') && !n.endsWith('.spec.ts'))
  .map((n) => ({ n, s: readFileSync(join(DIR, n), 'utf8') }));

describe('AI drafts have no send path (M1c-06)', () => {
  it('suggest code does not reach the outbox service, dispatcher or channel senders', () => {
    for (const { n, s } of sources) {
      for (const re of [/OutboxService\b/, /OutboxDispatcher/, /ChannelSender/, /outbox\.create|\.reapprove\(/, /\/api\/outbox|'outbox\/pending'/, /markSent/]) {
        expect({ file: n, hit: re.test(s) ? re.source : null }).toEqual({ file: n, hit: null });
      }
    }
  });

  it('the outbox collection is only read, once, with findOne', () => {
    const uses = sources.flatMap(({ n, s }) => s.split('\n').map((line, i) => ({ n, i, line })).filter((x) => x.line.includes('C.suggestions')));
    expect(uses).toHaveLength(1);
    const { n, i } = uses[0]!;
    const lines = sources.find((x) => x.n === n)!.s.split('\n');
    const next = lines.slice(i, i + 2).join(' ');
    expect(next).toMatch(/\.findOne\(/);
    expect(next).not.toMatch(/insert|update|replace|delete|bulkWrite|findOneAnd/);
  });

  it('drafts are stored outside the outbox collection', () => {
    const svc = sources.find((x) => x.n === 'suggest.service.ts')!.s;
    expect(svc).toMatch(/export const AI_DRAFTS = 'ai_drafts'/);
  });

  it('no ai-draft route is a send route; only POST /api/outbox sends', () => {
    const aiRoutes = Object.entries(ROUTE_PERMISSIONS).filter(([k]) => /ai-draft/.test(k));
    expect(aiRoutes.length).toBeGreaterThanOrEqual(5);
    for (const [, rule] of aiRoutes) {
      expect(rule.kind).toBe('perm');
      if (rule.kind === 'perm') {
        expect(rule.send).toBeUndefined();
        expect([rule.key].flat()).toEqual(['ai.draft']);
      }
    }
  });

  it('the web draft card never posts to the outbox', () => {
    const card = join(DIR, '../../../web/src/components/chat/AiDraftCard.tsx');
    expect(existsSync(card)).toBe(true);
    const s = readFileSync(card, 'utf8');
    expect(s).not.toMatch(/\/outbox/);
    expect(s).toMatch(/onUse/);
  });
});
