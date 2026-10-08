/** One JSON line per log entry (khung chung mục 6). Never log tokens, `code`, C1 data or Excel content. */
import type { LoggerService } from '@nestjs/common';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type Level = (typeof LEVELS)[number];

export class JsonLogger implements LoggerService {
  constructor(private readonly min: Level = 'info') {}

  write(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
    if (LEVELS.indexOf(level) < LEVELS.indexOf(this.min)) return;
    const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
    (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
  }

  info(msg: string, fields?: Record<string, unknown>): void {
    this.write('info', msg, fields);
  }

  // LoggerService (Nest's own messages): the last optional argument is the context name.
  log(message: unknown, ...rest: unknown[]): void {
    this.write('info', String(message), context(rest));
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.write('error', String(message), context(rest));
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.write('warn', String(message), context(rest));
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.write('debug', String(message), context(rest));
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.write('debug', String(message), context(rest));
  }
}

function context(rest: unknown[]): Record<string, unknown> {
  const ctx = rest.at(-1);
  return typeof ctx === 'string' ? { ctx } : {};
}

export const LOGGER = Symbol('LOGGER');
