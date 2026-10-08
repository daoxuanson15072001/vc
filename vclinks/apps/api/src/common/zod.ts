import { BadRequestException } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/** Parses `value` with `schema` or throws a 400 listing the zod issues. */
export function parseOr400<S extends ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new BadRequestException(
      r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return r.data;
}

export const toIso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
