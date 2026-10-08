import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { C3_BLOCKED_TEXT, aiContextSchema, classifyPart, maxSensitivity, type AiContext, type Sensitivity } from '@vclinks/shared';
import { DbService } from '../db/db.service';
import { EXTERNAL_AI_CLIENT, UnconfiguredAiClient, type ExternalAiClient, type ExternalAiResponse } from './ai-client';

export interface GateDecision {
  allowed: boolean;
  level: Sensitivity;
  /** Number of C3 parts (never their content). */
  blockedParts: number;
}

/** Thrown when a context holds C3: the whole call is refused (owner decision 04/10/2026, Q2). */
export class C3BlockedError extends ForbiddenException {
  constructor() {
    super(C3_BLOCKED_TEXT);
  }
}

/** Pure check: a context may go to an external AI only if none of its parts is C3. */
export function gate(ctx: AiContext): GateDecision {
  const levels = ctx.parts.map(classifyPart);
  const blockedParts = levels.filter((l) => l === 'C3').length;
  return { allowed: blockedParts === 0, level: maxSensitivity(levels), blockedParts };
}

/**
 * The only way to reach an external AI (BA §2.2 #8, VCL-AI-14). `gate()` runs before every call;
 * a context with C3 never reaches the client and the refusal is logged (counts only, no content).
 * Local AI for C3 comes in M3.
 */
@Injectable()
export class AiGateway {
  constructor(
    private readonly db: DbService,
    @Optional() @Inject(EXTERNAL_AI_CLIENT) private readonly client: ExternalAiClient = new UnconfiguredAiClient(),
  ) {}

  /** Gate decision without calling anything (UI: disable "AI trích lại" on C3). */
  check(ctx: AiContext): GateDecision {
    return gate(aiContextSchema.parse(ctx));
  }

  async complete(ctx: AiContext, actor = 'system'): Promise<ExternalAiResponse> {
    const parsed = aiContextSchema.parse(ctx);
    const d = gate(parsed);
    if (!d.allowed) {
      await this.db.audit(actor, 'ai.gate_blocked', parsed.purpose, { level: d.level, parts: parsed.parts.length, blockedParts: d.blockedParts });
      throw new C3BlockedError();
    }
    return this.client.complete({ purpose: parsed.purpose, parts: parsed.parts });
  }
}
