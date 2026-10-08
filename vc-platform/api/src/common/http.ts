/**
 * Express-level pieces shared by every route: request id, request log, and the two error shapes
 * (internal API: `{code, message, details?}`; API for apps: `{error: {code, message, correlation_id}}`).
 */
import { randomBytes } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { APP_CODE, errorMessage, ERRORS, type AppErrorCode, type ErrorCode } from '@vc/contracts';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from './api-error';
import type { JsonLogger } from './logger';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

const ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Takes the caller's X-Correlation-Id when it is safe, otherwise makes one; echoes it on every response (VH-NFR-17). */
export function correlation(log: JsonLogger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const given = req.header('x-correlation-id');
    req.correlationId = given && ID.test(given) ? given : randomBytes(8).toString('hex');
    res.setHeader('X-Correlation-Id', req.correlationId);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      // Path without query string: queries can carry search text about people.
      log.info('http', {
        rid: req.correlationId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
      });
    });
    next();
  };
}

/** Routes of the API for apps (kế hoạch GĐ B mục 5.1; 07 mục 5.1). */
export function isAppRoute(path: string): boolean {
  return /^\/api\/v1\/(people|org-units|catalogs)(\/|$)/.test(path) || /^\/api\/v1\/apps\/[^/]+\/(grants|roles|events)(\/|$)/.test(path);
}

interface Normalized {
  code: ErrorCode;
  status: number;
  message: string;
  details?: unknown;
  appCode?: AppErrorCode;
}

const BY_STATUS: Record<number, ErrorCode> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict_rev',
  413: 'payload_too_large',
  429: 'rate_limited',
  503: 'feature_off',
};

export function normalizeError(err: unknown, rid: string): Normalized {
  if (err instanceof ApiError) return { code: err.code, status: err.status, message: err.message, details: err.details };
  if (err instanceof ZodError) {
    return {
      code: 'bad_request',
      status: 400,
      message: ERRORS.bad_request.message,
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  // body-parser: too large, broken JSON.
  const bp = err as { type?: string; status?: number };
  if (bp?.type === 'entity.too.large') return { code: 'payload_too_large', status: 413, message: ERRORS.payload_too_large.message };
  if (bp?.type === 'entity.parse.failed') return { code: 'bad_request', status: 400, message: 'Nội dung gửi lên không phải JSON hợp lệ.' };
  if (err instanceof HttpException) {
    const code = BY_STATUS[err.getStatus()];
    if (code) return { code, status: ERRORS[code].status, message: ERRORS[code].message };
  }
  return { code: 'server_error', status: 500, message: errorMessage('server_error', rid) };
}

export function sendError(req: Request, res: Response, err: unknown, log: JsonLogger): void {
  const rid = req.correlationId ?? '';
  const n = normalizeError(err, rid);
  if (n.status >= 500) log.write('error', 'request_failed', { rid, path: req.path, error: describe(err) });
  if (res.headersSent) return;
  if (isAppRoute(req.path)) {
    res.status(n.status).json({ error: { code: n.appCode ?? APP_CODE[n.code], message: n.message, correlation_id: rid } });
  } else {
    res.status(n.status).json(n.details === undefined ? { code: n.code, message: n.message } : { code: n.code, message: n.message, details: n.details });
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
