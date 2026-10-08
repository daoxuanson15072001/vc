/** Operational alerts (thiết kế SSO mục 11; kế hoạch GĐ B mục 6.3): a log line, and the GĐ A webhook when set. */
import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { LOGGER, type JsonLogger } from './logger';

export type AlertLevel = 'khan' | 'cao' | 'trung_binh';

@Injectable()
export class AlertService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(LOGGER) private readonly log: JsonLogger,
  ) {}

  async send(level: AlertLevel, code: string, text: string, fields: Record<string, unknown> = {}): Promise<void> {
    this.log.write('error', 'alert', { level, code, text, ...fields });
    if (!this.env.ALERT_WEBHOOK_URL) return;
    await fetch(this.env.ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `[VC Home ${this.env.APP_ENV}] ${level === 'khan' ? 'KHẨN: ' : ''}${text}` }),
      signal: AbortSignal.timeout(5000),
    }).catch((e: Error) => this.log.write('error', 'alert_send_failed', { code, error: e.message }));
  }
}
