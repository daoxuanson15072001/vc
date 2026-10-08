/** Response shapes shared with the SPA and apps; JSON Schema is generated from these (scripts/gen-json-schema.ts). */
import { z } from 'zod';

export const InternalError = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  })
  .describe('Lỗi của API nội bộ cho SPA (khung chung mục 6)');

export const AppError = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      correlation_id: z.string(),
    }),
  })
  .describe('Lỗi của API cho app (07 mục 5.1)');

export const Health = z
  .object({
    status: z.enum(['ok', 'loi']),
    app_env: z.string(),
    version: z.string(),
    time: z.string().datetime(),
    mongo: z.object({
      ok: z.boolean(),
      replica_set: z.string().nullable(),
      writable_primary: z.boolean(),
      latency_ms: z.number().nullable(),
    }),
    jobs: z.object({
      enabled: z.boolean(),
      last_heartbeat_at: z.string().datetime().nullable(),
    }),
  })
  .describe('GET /api/health');

export type HealthT = z.infer<typeof Health>;

/** Schemas published to app teams as JSON Schema (name → schema). */
export const PUBLISHED = { 'loi-api-cho-app': AppError } as const;
