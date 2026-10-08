import Anthropic from '@anthropic-ai/sdk';
import { Logger, type Provider } from '@nestjs/common';
import type { AiContext } from '@vclinks/shared';

/*
 * Client of an external AI (Claude API...). ONLY AiGateway may inject it (ai-boundary.spec.ts checks
 * that no other file references EXTERNAL_AI_CLIENT or an AI SDK): every call passes the C3 gate first
 * (BA §2.2 #8, VCL-AI-14, D5-13).
 *
 * M1c-06: SUGGEST_MODE picks the client — `mock` (default, no network, deterministic), `live` (Claude API
 * through the official SDK; needs ANTHROPIC_API_KEY, E8), `off` (refuses every call). The key is only read
 * from the environment and never logged; prompts and answers are never logged either.
 */
export const EXTERNAL_AI_CLIENT = Symbol('EXTERNAL_AI_CLIENT');

export interface ExternalAiRequest {
  purpose: string;
  /** Parts already cleared by the gate (none is C3). */
  parts: AiContext['parts'];
}

export interface ExternalAiResponse {
  text: string;
  /** `mock` | `live` and the model id, stored with the draft. */
  mode?: 'mock' | 'live';
  model?: string;
}

export interface ExternalAiClient {
  complete(req: ExternalAiRequest): Promise<ExternalAiResponse>;
}

/** Default when SUGGEST_MODE=off or before a client is wired: refuses every call. */
export class UnconfiguredAiClient implements ExternalAiClient {
  async complete(): Promise<ExternalAiResponse> {
    throw new Error('External AI client is not configured');
  }
}

/** Raised when the AI could not answer (refusal, API error); carries no prompt or answer text. */
export class ExternalAiError extends Error {
  constructor(readonly code: string) {
    super(`External AI failed: ${code}`);
    this.name = 'ExternalAiError';
  }
}

/**
 * Offline stand-in for the Claude API (until E8). Never reads the untrusted message block: it writes a
 * polite holding answer from the trusted parts only (VCsales lines, first VCwiki card), so tests exercise
 * the frame, the gate and the output guard without a network call.
 */
export class MockExternalAiClient implements ExternalAiClient {
  readonly calls: ExternalAiRequest[] = [];

  async complete(req: ExternalAiRequest): Promise<ExternalAiResponse> {
    this.calls.push(req);
    const base = { mode: 'mock' as const, model: 'mock' };
    if (req.purpose === 'summary') {
      const n = req.parts.find((p) => p.kind === 'message')?.source?.split(':')[1] ?? '0';
      return { ...base, text: `Tóm tắt mẫu (chưa bật AI thật): hội thoại có ${n} tin gần nhất. Mở hội thoại để đọc chi tiết.` };
    }
    const lines = ['Dạ em chào anh/chị ạ.'];
    // Data lines of a part: after its header line, without the block tags.
    const dataLines = (text: string) => text.split('\n').slice(1).filter((l) => l && !l.startsWith('<'));
    const sale = req.parts.find((p) => p.kind === 'sale');
    if (sale) {
      const first = dataLines(sale.text)[0];
      if (first) lines.push(`Em báo anh/chị: ${first}.`);
    }
    const card = req.parts.find((p) => p.kind === 'wiki');
    if (card) {
      // First data line is the card title.
      const body = dataLines(card.text).slice(1).join(' ').trim();
      const firstSentence = body.split(/(?<=\.)\s/)[0];
      if (firstSentence) lines.push(firstSentence);
    }
    lines.push('Em kiểm tra thêm và báo lại anh/chị ngay ạ.');
    return { ...base, text: lines.join(' ') };
  }
}

/** Default Claude model of the suggest worker (SUGGEST_MODEL overrides). */
export const DEFAULT_SUGGEST_MODEL = 'claude-opus-5-5';

/**
 * Claude API through @anthropic-ai/sdk. Trusted parts (instruction, playbook) form the system prompt; the
 * other parts (profile, VCwiki, VCsales, the wrapped untrusted message block) form the user turn.
 */
export class AnthropicAiClient implements ExternalAiClient {
  private readonly client: Anthropic;
  private readonly log = new Logger('AnthropicAiClient');

  constructor(
    apiKey: string,
    readonly model: string = DEFAULT_SUGGEST_MODEL,
    private readonly effort: 'low' | 'medium' | 'high' = 'low',
    workspaceId?: string,
  ) {
    // A key that is not scoped to a workspace must name one in every request (API answers 400 otherwise).
    this.client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2, ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}) });
  }

  async complete(req: ExternalAiRequest): Promise<ExternalAiResponse> {
    const system = req.parts
      .filter((p) => p.kind === 'instruction' || p.kind === 'playbook')
      .map((p) => p.text)
      .join('\n\n');
    const user = req.parts
      .filter((p) => p.kind !== 'instruction' && p.kind !== 'playbook')
      .map((p) => p.text)
      .join('\n\n');
    let res: Anthropic.Beta.BetaMessage;
    try {
      res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: this.effort },
        // Server-side fallback on a policy refusal (routes by refusal category).
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (e) {
      // Status only: the SDK error message may echo request details.
      const code = e instanceof Anthropic.APIError ? `api_${e.status ?? 'network'}` : 'network';
      this.log.warn(`Claude API call failed (${req.purpose}): ${code}`);
      throw new ExternalAiError(code);
    }
    if (res.stop_reason === 'refusal') throw new ExternalAiError('refusal');
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return { text, mode: 'live', model: res.model ?? this.model };
  }
}

export type SuggestMode = 'mock' | 'live' | 'off';

export function suggestMode(env: NodeJS.ProcessEnv = process.env): SuggestMode {
  const m = (env.SUGGEST_MODE ?? 'mock').trim().toLowerCase();
  return m === 'live' || m === 'off' ? m : 'mock';
}

/**
 * Client from the environment. `live` without a key does not crash the process (the connector shares this
 * module and must keep receiving messages): it logs once and refuses every call, so drafts show "failed".
 */
export function createExternalAiClient(env: NodeJS.ProcessEnv = process.env): ExternalAiClient {
  const mode = suggestMode(env);
  if (mode === 'off') return new UnconfiguredAiClient();
  if (mode === 'live') {
    const key = env.ANTHROPIC_API_KEY?.trim();
    if (!key) {
      new Logger('ExternalAiClient').error('SUGGEST_MODE=live needs ANTHROPIC_API_KEY (E8); AI drafts are disabled');
      return new UnconfiguredAiClient();
    }
    const effort = env.SUGGEST_EFFORT === 'medium' || env.SUGGEST_EFFORT === 'high' ? env.SUGGEST_EFFORT : 'low';
    return new AnthropicAiClient(key, env.SUGGEST_MODEL?.trim() || DEFAULT_SUGGEST_MODEL, effort, env.ANTHROPIC_WORKSPACE_ID?.trim() || undefined);
  }
  return new MockExternalAiClient();
}

/** Nest provider of the client (registered next to AiGateway in the core module). */
export const externalAiClientProvider: Provider = { provide: EXTERNAL_AI_CLIENT, useFactory: () => createExternalAiClient() };
