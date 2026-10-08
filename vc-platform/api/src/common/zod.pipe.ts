import type { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/** Checks a body or query with a zod schema from @vc/contracts; errors become 400 with the issues as details. */
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    return this.schema.parse(value);
  }
}
