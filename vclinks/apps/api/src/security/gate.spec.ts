import type { AiContext } from '@vclinks/shared';
import type { DbService } from '../db/db.service';
import type { ExternalAiClient, ExternalAiRequest } from './ai-client';
import { AiGateway, C3BlockedError, gate } from './ai-gateway';

/** Mock external AI client: records every call it receives (M1b-14 "Xác nhận xong" #1). */
class RecordingClient implements ExternalAiClient {
  calls: ExternalAiRequest[] = [];
  async complete(req: ExternalAiRequest) {
    this.calls.push(req);
    return { text: 'ok' };
  }
}

function setup() {
  const audits: unknown[][] = [];
  const db = { audit: async (...a: unknown[]) => void audits.push(a) } as unknown as DbService;
  const client = new RecordingClient();
  return { gw: new AiGateway(db, client), client, audits };
}

const msg = (text: string): AiContext['parts'][number] => ({ kind: 'message', text });
const base: AiContext['parts'] = [
  { kind: 'instruction', text: 'Soạn nháp trả lời khách.' },
  { kind: 'playbook', text: 'Xưng em, gọi khách là anh/chị.' },
  msg('Má phanh Vios 2018 còn hàng không em?'),
];

/** Contexts that hold C3 one way or another: declared by the source, detected in text, nested deep. */
const C3_CONTEXTS: AiContext[] = [
  { purpose: 'suggest', parts: [...base, { kind: 'sale', text: 'Trạng thái công nợ: quá hạn', level: 'C3', source: 'vcsale:debt' }] },
  { purpose: 'suggest', parts: [...base, msg('Anh xem giúp công nợ của em còn 12.500.000đ phải không?')] },
  { purpose: 'suggest', parts: [...base, { kind: 'profile', text: 'Hạn mức tín dụng 50 triệu, dùng 80%' }] },
  { purpose: 'summary', parts: [{ kind: 'other', text: 'x', level: 'C3' }] },
  { purpose: 'extract', parts: [...base, ...Array.from({ length: 30 }, (_, i) => msg(`tin ${i}`)), msg('giá riêng gara anh 850k nhé')] },
];

describe('C3 gate before external AI (M1b-14)', () => {
  it('a context with C3 never reaches the AI client', async () => {
    const { gw, client, audits } = setup();
    for (const ctx of C3_CONTEXTS) {
      await expect(gw.complete(ctx)).rejects.toBeInstanceOf(C3BlockedError);
    }
    expect(client.calls).toHaveLength(0);
    expect(audits).toHaveLength(C3_CONTEXTS.length);
    // The audit log carries counts, never content.
    expect(JSON.stringify(audits)).not.toMatch(/công nợ|12\.500|850k|Hạn mức/i);
  });

  it('0 C3 messages out of a 1,000-message corpus reach the client (NFR-22)', async () => {
    const { gw, client } = setup();
    const topics = ['Công nợ', 'cong no', 'Dư nợ', 'Hạn mức', 'Chính sách giá', 'Giá riêng', 'Chiết khấu riêng', 'Nợ quá hạn'];
    const amounts = ['12.500.000đ', '50 triệu', '3,2 tr', '850k', '15%', '1.200.000 VND', '2 tỷ', '700 nghìn'];
    let blocked = 0;
    for (let i = 0; i < 1000; i++) {
      const text = `${i % 3 ? 'Anh ơi ' : ''}${topics[i % topics.length]} của gara ${i} là ${amounts[(i * 7) % amounts.length]} ạ`;
      try {
        await gw.complete({ purpose: 'suggest', parts: [...base, msg(text)] });
      } catch (e) {
        if (e instanceof C3BlockedError) blocked++;
        else throw e;
      }
    }
    expect(blocked).toBe(1000);
    expect(client.calls).toHaveLength(0);
  });

  it('a C2 context goes through, unchanged', async () => {
    const { gw, client } = setup();
    const ctx: AiContext = { purpose: 'suggest', parts: [...base, msg('Giá 850.000 đ anh ạ'), { kind: 'sale', text: 'Tồn kho: 12' }] };
    await expect(gw.complete(ctx)).resolves.toEqual({ text: 'ok' });
    expect(client.calls).toEqual([{ purpose: 'suggest', parts: ctx.parts }]);
  });

  it('gate() reports level and blocked count without calling anything', () => {
    expect(gate({ purpose: 'p', parts: base })).toEqual({ allowed: true, level: 'C2', blockedParts: 0 });
    expect(gate(C3_CONTEXTS[0])).toEqual({ allowed: false, level: 'C3', blockedParts: 1 });
  });

  it('refuses a malformed context instead of guessing', async () => {
    const { gw, client } = setup();
    await expect(gw.complete({ purpose: 'p', parts: [{ kind: 'message' } as never] })).rejects.toThrow();
    expect(client.calls).toHaveLength(0);
  });
});
