/** Schema of `catalog.json` version 1 (07 mục 5.10). Readers must ignore unknown fields; never personal data. */
import { z } from 'zod';

const STATUSES = ['live', 'beta', 'coming_soon', 'paused', 'retired'] as const;

const isLocalHttp = (u: URL) => u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname);

export const AppEntry = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,29}$/, 'key: chữ thường, số, gạch dưới; 2–30 ký tự'),
    name: z.string().min(1).max(40),
    description: z.string().min(1).max(120),
    url: z
      .string()
      .url()
      .refine((s) => {
        const u = new URL(s);
        return u.protocol === 'https:' || isLocalHttp(u);
      }, 'url phải là https:// (http chỉ cho localhost)')
      .nullable(),
    icon: z.string().regex(/^\/icons\/[a-z0-9_-]+\.svg$/, 'icon: /icons/<tên>.svg'),
    group: z.string().regex(/^app-[a-z0-9_-]+$/, 'group: app-<khoá>'),
    status: z.enum(STATUSES),
    order: z.number().int(),
    eta: z.string().max(40).optional(),
  })
  .strict()
  .refine((a) => a.status === 'coming_soon' || a.url !== null, { message: 'url bắt buộc với app không phải coming_soon', path: ['url'] });

export const Catalog = z
  .object({ version: z.literal(1), apps: z.array(AppEntry) })
  .strict()
  .superRefine((c, ctx) => {
    for (const field of ['key', 'group'] as const) {
      const seen = new Set<string>();
      for (const a of c.apps) {
        if (seen.has(a[field])) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${field} trùng: ${a[field]}`, path: ['apps'] });
        seen.add(a[field]);
      }
    }
  });

export type CatalogT = z.infer<typeof Catalog>;
