import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/*
 * M1b-14: AiGateway is the only door to an external AI. No other source file of the API may inject the
 * client or talk to an AI provider directly, so the C3 gate cannot be bypassed.
 */
const SRC = join(__dirname, '..');
const ALLOWED = new Set(['security/ai-client.ts', 'security/ai-gateway.ts']);
const FORBIDDEN = [/EXTERNAL_AI_CLIENT/, /UnconfiguredAiClient/, /@anthropic-ai\//, /api\.anthropic\.com/, /\bopenai\b/i];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
}

describe('external AI boundary (M1b-14)', () => {
  it('only the gateway references the external AI client', () => {
    const offenders = files(SRC)
      .map((p) => relative(SRC, p).split('\\').join('/'))
      .filter((r) => !ALLOWED.has(r))
      .filter((r) => FORBIDDEN.some((re) => re.test(readFileSync(join(SRC, r), 'utf8'))));
    expect(offenders).toEqual([]);
  });
});
