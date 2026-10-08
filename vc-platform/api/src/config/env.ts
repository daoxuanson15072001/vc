/** Environment of the API, checked with zod at start (khung chung mục 8; kế hoạch GĐ B mục 11.2). */
import { z } from 'zod';

const onOff = z.enum(['on', 'off']);

export const EnvSchema = z
  .object({
    APP_ENV: z.enum(['dev', 'test', 'staging', 'production']).default('dev'),
    PORT: z.coerce.number().int().positive().default(3100),
    MONGO_URL: z.string().min(1, 'Thiếu MONGO_URL'),
    MONGO_DB: z.string().default('vchome'),
    OIDC_ISSUER: z.string().url().optional(),
    OIDC_AUDIENCE: z.string().default('vchome-api'),
    CLOCK_MODE: z.enum(['real', 'fake']).default('real'),
    JOBS: onOff.default('on'),
    JOBS_TICK_SECONDS: z.coerce.number().int().min(1).default(15),
    BODY_LIMIT: z.string().default('1mb'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    APP_VERSION: z.string().default('dev'),
    FEATURE_HOME_B: z.enum(['off', 'admin', 'on']).default('off'),
    FEATURE_ACCOUNT_LINK: onOff.default('off'),
    FEATURE_IDP_PUSH: onOff.default('off'),
    FEATURE_PUBLIC_API: onOff.default('off'),
    FEATURE_CATALOG_FROM_DB: onOff.default('off'),
    FEATURE_EXCLUSIONS_FROM_DB: onOff.default('off'),
    FEATURE_IMPORT: onOff.default('on'),
    RETENTION_MODE: z.enum(['dry_run', 'apply']).default('dry_run'),
  })
  .superRefine((e, ctx) => {
    // A fake clock in production would move effective dates (kế hoạch GĐ B mục 3.3 điểm 14).
    if (e.CLOCK_MODE === 'fake' && e.APP_ENV !== 'staging' && e.APP_ENV !== 'test') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLOCK_MODE'], message: 'CLOCK_MODE=fake chỉ dùng được khi APP_ENV là staging hoặc test' });
    }
  });

export type Env = z.infer<typeof EnvSchema>;
export const ENV = Symbol('ENV');

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // An empty value in .env means "not set".
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const r = EnvSchema.safeParse(cleaned);
  if (!r.success) throw new Error(`Cấu hình sai:\n${r.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  return r.data;
}
