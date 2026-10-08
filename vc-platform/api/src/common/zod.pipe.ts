import type { PipeTransform } from '@nestjs/common';
import { defaultErrorMap, type ZodErrorMap, type ZodTypeAny, type z } from 'zod';
import { ApiError } from './api-error';

/** Checks a body or query with a zod schema from @vc/contracts; errors become 400 with the issues as details. */
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    return this.schema.parse(value);
  }
}

/**
 * Vietnamese text for checks whose schema gives no sentence of its own (unknown field, wrong type). A parse-time map
 * runs last, so it keeps any sentence the schema set (`required_error`, enum `errorMap`) and replaces only zod's English.
 */
const viErrorMap: ZodErrorMap = (issue, ctx) => {
  if (ctx.defaultError !== defaultErrorMap(issue, { data: ctx.data, defaultError: ctx.defaultError }).message) return { message: ctx.defaultError };
  if (issue.code === 'unrecognized_keys') return { message: `Trường không hợp lệ: ${issue.keys.join(', ')}.` };
  return { message: `Giá trị của trường ${issue.path.join('.') || 'gửi lên'} không hợp lệ.` };
};

/** Like ZodPipe, but the response message is the first issue's sentence (forms show it as is). */
export function parseInput<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value, { errorMap: viErrorMap });
  if (r.success) return r.data;
  const details = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  throw new ApiError('bad_request', { message: details[0].message, details });
}
